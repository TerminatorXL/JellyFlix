// Checks the Filmweb plugin against a real Jellyfin that has it installed — and through it, the
// real Filmweb API, so this needs the internet and fails when Filmweb changes its answers. That is
// the point: the unit tests (npm run test:plugin) pin the parsing to captured responses, and only
// this notices when the live ones have drifted.
//
//   tools/pw.sh tools/filmweb-check.mjs                      look, but change nothing
//   tools/pw.sh tools/filmweb-check.mjs --apply              also identify one film and one series
//   ... --movie "Inception" --year 2010 --series "The Witcher"
//
// Without --apply it only searches, which writes nothing. With it, it does what a user does by
// hand: puts Filmweb first among the library's metadata downloaders, runs Identify on one film and
// one series, and reads back what landed on the items. The library options are restored
// afterwards; the two items keep their Filmweb metadata.
import { BASE, TOKEN, USER, arg, flag } from './lib.mjs';

const PROVIDER = 'Filmweb';
const movieName = arg('movie', 'Inception');
const movieYear = parseInt(arg('year', '2010'), 10);
const seriesName = arg('series', 'The Witcher');

const headers = { Authorization: `MediaBrowser Token="${TOKEN}"`, 'Content-Type': 'application/json' };
async function call(method, path, body) {
    const response = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${await response.text()}`);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}
const get = path => call('GET', path);
const post = (path, body) => call('POST', path, body);

let failures = 0;
function check(what, ok, detail = '') {
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${what}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures++;
}
const short = (text, n = 90) => (text || '').replace(/\s+/g, ' ').slice(0, n);

/* ------------------------------------------------------------------ the plugin is there */

const plugin = (await get('/Plugins')).find(p => p.Name === PROVIDER);
check('the plugin is loaded', plugin?.Status === 'Active', plugin ? `${plugin.Version}, ${plugin.Status}` : 'not in /Plugins — was the server restarted?');
if (!plugin) process.exit(1);

for (const [contentType, itemType] of [['movies', 'Movie'], ['tvshows', 'Series']]) {
    const available = await get(`/Libraries/AvailableOptions?libraryContentType=${contentType}&isNewLibrary=false`);
    const type = available.TypeOptions.find(t => t.Type === itemType);
    check(`offered as a metadata downloader for ${itemType}`, !!type?.MetadataFetchers.some(f => f.Name === PROVIDER));
    check(`offered as an image fetcher for ${itemType}`, !!type?.ImageFetchers.some(f => f.Name === PROVIDER));
}

/* ----------------------------------------------------------------------------- Identify */

const me = (await get('/Users')).find(u => u.Name === USER);
const find = async (type, name) =>
    (await get(`/Items?userId=${me.Id}&Recursive=true&IncludeItemTypes=${type}&Fields=Path`)).Items
        .find(i => i.Name === name || (i.Path || '').includes(`/${name} (`) || (i.Path || '').endsWith(`/${name}`));
const movie = await find('Movie', movieName);
const series = await find('Series', seriesName);
check(`the library has the film "${movieName}"`, !!movie);
check(`the library has the series "${seriesName}"`, !!series);

const search = (type, item, searchInfo) =>
    post(`/Items/RemoteSearch/${type}`, { SearchInfo: searchInfo, ItemId: item?.Id, SearchProviderName: PROVIDER, IncludeDisabledProviders: true });

const movieHits = await search('Movie', movie, { Name: movieName, Year: movieYear });
const movieHit = movieHits.find(h => h.ProductionYear === movieYear) || movieHits[0];
check('Identify finds the film', !!movieHit?.ProviderIds?.[PROVIDER],
    movieHits.slice(0, 4).map(h => `${h.Name} (${h.ProductionYear}) #${h.ProviderIds?.[PROVIDER]}`).join(' · '));
check('every hit is credited to Filmweb', movieHits.length > 0 && movieHits.every(h => h.SearchProviderName === PROVIDER));
check('a hit has a poster', /^https:\/\/fwcdn\.pl\/fpo\/.+\.jpg$/.test(movieHit?.ImageUrl || ''), movieHit?.ImageUrl);
if (movieHit?.ImageUrl) {
    // jellyfin-web puts the address straight into an <img>, so the CDN has to serve it to a page
    // that is not Filmweb's own.
    const poster = await fetch(movieHit.ImageUrl, { headers: { Referer: `${BASE}/web/` } });
    check('the poster loads from a page that is not Filmweb\'s',poster.ok && (poster.headers.get('content-type') || '').startsWith('image/'),
        `${poster.status} ${poster.headers.get('content-type')}`);
}

const seriesHits = await search('Series', series, { Name: seriesName });
const seriesHit = seriesHits[0];
check('Identify finds the series', !!seriesHit?.ProviderIds?.[PROVIDER],
    seriesHits.slice(0, 4).map(h => `${h.Name} (${h.ProductionYear}) #${h.ProviderIds?.[PROVIDER]}`).join(' · '));

if (movieHit) {
    // What people actually have at hand is the page's address, not the number.
    const pasted = `https://www.filmweb.pl/film/x-${movieHit.ProductionYear}-${movieHit.ProviderIds[PROVIDER]}`;
    const byAddress = await search('Movie', movie, { Name: 'something else', ProviderIds: { [PROVIDER]: pasted } });
    check('a pasted page address finds exactly that title',
        byAddress.length === 1 && byAddress[0].ProviderIds[PROVIDER] === movieHit.ProviderIds[PROVIDER], byAddress.map(h => h.Name).join(', '));
}

/* ------------------------------------------------------------------------------- apply */

if (flag('apply') && movie && series && movieHit && seriesHit) {
    const folders = await get('/Library/VirtualFolders');
    const touched = [];
    try {
        for (const [contentType, itemType] of [['movies', 'Movie'], ['tvshows', 'Series']]) {
            const folder = folders.find(f => f.CollectionType === contentType);
            const available = (await get(`/Libraries/AvailableOptions?libraryContentType=${contentType}&isNewLibrary=false`))
                .TypeOptions.find(t => t.Type === itemType);
            const first = names => [PROVIDER, ...names.filter(n => n !== PROVIDER)];
            const metadata = first(available.MetadataFetchers.map(f => f.Name));
            const images = first(available.ImageFetchers.map(f => f.Name));
            const options = structuredClone(folder.LibraryOptions);
            options.TypeOptions = [
                ...(options.TypeOptions || []).filter(t => t.Type !== itemType),
                { Type: itemType, MetadataFetchers: metadata, MetadataFetcherOrder: metadata, ImageFetchers: images, ImageFetcherOrder: images }
            ];
            touched.push(folder);
            await post('/Library/VirtualFolders/LibraryOptions', { Id: folder.ItemId, LibraryOptions: options });
        }

        for (const [item, hit, label] of [[movie, movieHit, 'film'], [series, seriesHit, 'series']]) {
            await post(`/Items/RemoteSearch/Apply/${item.Id}?replaceAllImages=false`, hit);
            const after = await get(`/Items/${item.Id}?userId=${me.Id}`);
            const id = hit.ProviderIds[PROVIDER];
            console.log(`\n  ${label}: ${after.Name} / ${after.OriginalTitle} (${after.ProductionYear}), ★ ${after.CommunityRating}, critics ${after.CriticRating}`);
            console.log(`  ${short(after.Overview, 160)}`);
            console.log(`  ${(after.Genres || []).join(', ')} · ${(after.ProductionLocations || []).join(', ')} · ${after.PremiereDate?.slice(0, 10)}`);
            console.log(`  ${(after.People || []).map(p => `${p.Name} [${p.Type}]`).join(', ')}`);

            check(`the ${label} carries the Filmweb id`, after.ProviderIds?.[PROVIDER] === id, after.ProviderIds?.[PROVIDER]);
            check(`the ${label} is named as Filmweb names it`, after.Name === hit.Name, `${after.Name} vs ${hit.Name}`);
            check(`the ${label} has a synopsis`, (after.Overview || '').length > 40);
            check(`the ${label} has genres`, (after.Genres || []).length > 0);
            check(`the ${label} has the users' rating`, after.CommunityRating >= 1 && after.CommunityRating <= 10, String(after.CommunityRating));
            check(`the ${label} has a premiere date`, !!after.PremiereDate);
            check(`the ${label} has a director or a cast`, (after.People || []).length > 0, `${(after.People || []).length} people`);
            check(`the ${label} links to its Filmweb page`,
                (after.ExternalUrls || []).some(u => u.Name === PROVIDER && u.Url.includes(`id=${id}`)),
                (after.ExternalUrls || []).map(u => u.Name).join(', '));

            const remote = await get(`/Items/${item.Id}/RemoteImages?providerName=${PROVIDER}`);
            const posters = remote.Images.filter(i => i.Type === 'Primary');
            const stills = remote.Images.filter(i => i.Type === 'Backdrop');
            check(`the ${label} is offered a poster`, posters.length === 1, posters[0]?.Url);
            check(`the ${label} is offered stills`, stills.length > 0, `${stills.length}, first ${stills[0]?.Url}`);
            for (const image of [posters[0], stills[0]].filter(Boolean)) {
                const response = await fetch(image.Url);
                check(`  ${image.Type.toLowerCase()} is really on the CDN`, response.ok && (response.headers.get('content-type') || '').startsWith('image/'),
                    `${response.status} ${response.headers.get('content-length')} bytes`);
            }
        }
    } finally {
        for (const folder of touched) {
            await post('/Library/VirtualFolders/LibraryOptions', { Id: folder.ItemId, LibraryOptions: folder.LibraryOptions });
        }
        if (touched.length) console.log('\n  library options restored');
    }
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);

// Functional check for the episodePicker module: the OSD button, the drawer, the season selector,
// and actually switching episode.
//   tools/pw.sh tools/picker-check.mjs [--profile modern-desktop|tv|android-webview] [--css file] [--out name]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { root, sleep, go, login, launch, newContext, api, USER, arg, readInjectCss } from './lib.mjs';

const me = (await api('/Users')).find(u => u.Name === USER);
const series = (await api(`/Items?userId=${me.Id}&Recursive=true&IncludeItemTypes=Series&SortBy=SortName`)).Items;
// A series with more than one season, so the season selector has something to do.
let show = null;
for (const s of series) {
    const seasons = (await api(`/Shows/${s.Id}/Seasons?userId=${me.Id}`)).Items;
    if (seasons.length >= 1) { show = { ...s, seasons }; if (seasons.length > 1) break; }
}
const first = (await api(`/Shows/${show.Id}/Episodes?userId=${me.Id}&seasonId=${show.seasons[0].Id}`)).Items;
console.log(`serial: ${show.Name} — ${show.seasons.length} sezon(y), ${first.length} odcinkow w pierwszym\n`);

const outDir = join(root, '_shots', arg('out', 'episode-picker'));
mkdirSync(outDir, { recursive: true });

const browser = await launch();
const { context } = await newContext(browser, arg('profile', 'modern-desktop'),
    { injectCss: readInjectCss(arg('css', '')) });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => {
    if (m.type() === 'error' && !/WebSocket connection/.test(m.text())) errors.push('console: ' + m.text());
});
await login(page);

await go(page, `#/details?id=${first[0].Id}&serverId=${me.ServerId}`);
await page.locator('.itemDetailPage:not(.hide) .mainDetailButtons .btnPlay').first().click();
await page.waitForSelector('#videoOsdPage', { timeout: 20000 });
await sleep(4000);                                  // let the item resolve and the button appear

// Wake the OSD so the shelf (and our button) is on screen.
await page.mouse.move(960, 540);
await page.mouse.move(980, 560);
await sleep(600);

const button = await page.evaluate(() => {
    const b = document.querySelector('.jfx-eps-btn');
    return b ? { title: b.title, inRow: !!b.closest('.videoOsdBottom .buttons'), visible: b.offsetWidth > 0 } : null;
});
console.log('guzik:  ', JSON.stringify(button));
await page.screenshot({ path: join(outDir, 'osd-with-button.png') });

await page.click('.jfx-eps-btn');
await sleep(2500);

const panel = await page.evaluate(() => {
    const p = document.querySelector('.jfx-eps');
    if (!p) return { mounted: false };
    const items = Array.from(p.querySelectorAll('.jfx-eps-item'));
    const select = p.querySelector('.jfx-eps-seasons');
    return {
        mounted: true,
        open: p.hasAttribute('data-jfx-open'),
        parent: p.parentElement?.id,
        lastChild: p.parentElement?.lastElementChild === p,
        series: p.querySelector('.jfx-eps-series')?.textContent,
        seasons: Array.from(select.options).map(o => o.textContent),
        selected: select.selectedOptions[0]?.textContent,
        episodes: items.length,
        withThumbs: items.filter(i => i.querySelector('.jfx-eps-thumb img')).length,
        current: p.querySelector('.jfx-eps-item[data-jfx-current] .jfx-eps-title')?.textContent,
        firstTitle: items[0]?.querySelector('.jfx-eps-title')?.textContent
    };
});
console.log('panel:  ', JSON.stringify(panel, null, 1));
await page.screenshot({ path: join(outDir, 'panel-open.png') });

// Season selector, when there is more than one.
let seasonSwitch = null;
if (panel.seasons && panel.seasons.length > 1) {
    await page.selectOption('.jfx-eps-seasons', { index: 1 });
    await sleep(2000);
    seasonSwitch = await page.evaluate(() => ({
        selected: document.querySelector('.jfx-eps-seasons').selectedOptions[0]?.textContent,
        episodes: document.querySelectorAll('.jfx-eps-item').length,
        firstTitle: document.querySelector('.jfx-eps-item .jfx-eps-title')?.textContent
    }));
    console.log('sezon 2:', JSON.stringify(seasonSwitch));
    await page.screenshot({ path: join(outDir, 'season-2.png') });
    await page.selectOption('.jfx-eps-seasons', { index: 0 });
    await sleep(1500);
}

// Pick a different episode and check playback actually moves.
const before = await page.evaluate(() => (document.querySelector('.videoOsd-appBar p')?.textContent || '').trim());
await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.jfx-eps-item'));
    const other = items.find(i => !i.hasAttribute('data-jfx-current'));
    other.click();
});
await sleep(8000);
const after = await page.evaluate(() => ({
    osd: (document.querySelector('.videoOsd-appBar p')?.textContent || '').trim(),
    panelOpen: !!document.querySelector('.jfx-eps')?.hasAttribute('data-jfx-open')
}));
console.log(`OSD przed: ${JSON.stringify(before)}`);
console.log(`OSD po:    ${JSON.stringify(after.osd)}`);
await page.screenshot({ path: join(outDir, 'after-switch.png') });

const results = [
    ['guzik jest w pasku OSD', !!button && button.inRow && button.visible],
    ['panel zamontowany w #videoOsdPage jako ostatnie dziecko', panel.parent === 'videoOsdPage' && panel.lastChild],
    ['panel otwarty', panel.open === true],
    ['pokazuje nazwe serialu', panel.series === show.Name],
    ['wylistowal sezony', panel.seasons && panel.seasons.length === show.seasons.length],
    ['wylistowal odcinki', panel.episodes === first.length],
    ['oznaczyl biezacy odcinek', panel.current === first[0].Name],
    ['przelaczenie sezonu dziala', panel.seasons.length < 2 || (seasonSwitch && seasonSwitch.selected !== panel.selected)],
    ['klikniecie odcinka przelaczylo odtwarzanie', !!after.osd && after.osd !== before],
    ['panel sie zamknal', after.panelOpen === false]
];
console.log();
results.forEach(([n, ok]) => console.log(`  ${ok ? '✔' : '✘'} ${n}`));
console.log(results.every(r => r[1]) ? '\nALL PASS' : '\nFAILED');
if (errors.length) console.log('\nbledy konsoli:\n' + errors.join('\n'));
console.log('\nzrzuty ->', outDir);

await context.close();
await browser.close();

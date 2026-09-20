// Functional check for the add-on's pauseInfo module: plays an item, pauses it, and reports what the
// card actually rendered — the logo URL and its naturalWidth, the headline, the S/E line, the meta
// line, the synopsis — then resumes and checks the card really goes away.
//
// Run it through the Playwright container, like the other harness scripts:
//   tools/pw.sh tools/addon-check.mjs [--css file] [--profiles modern-desktop,modern-mobile,tv] [--out name]
// Options:
//   --css file         also inject a stylesheet of your own, the way Jellyfin renders Custom CSS
//                      (default: the add-on alone, on a stock Jellyfin)
//   --server           inject nothing — check an add-on the SERVER already delivers (JavaScript
//                      Injector plugin, reverse-proxy sub_filter, patched index.html)
//   --profiles a,b     layout profiles (see PROFILES in lib.mjs); default: modern-desktop
//   --out name         output folder under _shots/ (default: addon-pause)
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { root, arg, flag, sleep, resolveRoutes, settle, go, login, launch, newContext, readInjectCss } from './lib.mjs';

const serverSide = flag('server');
const injectJs = serverSide ? '' : readFileSync(join(root, 'dist', 'jellyflix-addon.user.js'), 'utf8');
const injectCss = serverSide ? '' : readInjectCss(arg('css', ''));
const profiles = arg('profiles', 'modern-desktop').split(',');
const outDir = join(root, '_shots', arg('out', 'addon-pause'));

const ROUTES = await resolveRoutes();
const browser = await launch();
const results = [];

async function probe(page, label, dir) {
    const play = page.locator('.itemDetailPage:not(.hide) .mainDetailButtons .btnPlay').first();
    await play.click();
    await page.waitForSelector('#videoOsdPage', { timeout: 20000 });
    await page.waitForFunction(() => {
        const v = document.querySelector('.videoPlayerContainer video');
        return v && v.readyState >= 2;
    }, null, { timeout: 20000 });
    await sleep(2500);                       // let the client report playback start to /Sessions

    // Pause the way a viewer does: the OSD pause button.
    await page.evaluate(() => {
        const btn = document.querySelector('#videoOsdPage:not(.hide) .btnPause');
        if (btn) btn.click();
        else document.querySelector('.videoPlayerContainer video').pause();
    });
    await sleep(1400);

    const shown = await page.evaluate(() => {
        const card = document.querySelector('.jfx-pause');
        if (!card) return { mounted: false };
        const style = getComputedStyle(card);
        const logo = card.querySelector('.jfx-pause-logo');
        const text = sel => (card.querySelector(sel)?.textContent || '').trim();
        return {
            mounted: true,
            open: card.hasAttribute('data-jfx-open'),
            opacity: style.opacity,
            type: card.getAttribute('data-jfx-pause-type'),
            parent: card.parentElement?.className,
            prevSibling: card.previousElementSibling?.tagName,
            logo: logo && logo.style.display !== 'none'
                ? { src: logo.currentSrc || logo.src, natural: logo.naturalWidth, alt: logo.alt }
                : null,
            eyebrow: text('.jfx-pause-eyebrow'),
            title: text('.jfx-pause-title'),
            subtitle: text('.jfx-pause-subtitle'),
            meta: text('.jfx-pause-meta'),
            overview: text('.jfx-pause-overview')
        };
    });
    await page.screenshot({ path: join(dir, `${label}-paused.png`) });

    // …and again with the OSD woken up, to check the card does not collide with the shelf.
    const box = page.viewportSize();
    await page.mouse.move(box.width / 2, box.height / 2);
    await page.mouse.move(box.width / 2 + 24, box.height / 2 + 24);
    await sleep(500);
    await page.screenshot({ path: join(dir, `${label}-paused-osd.png`) });

    // …and it must disappear the moment playback resumes.
    await page.evaluate(() => {
        const btn = document.querySelector('#videoOsdPage:not(.hide) .btnPause');
        if (btn) btn.click();
        else document.querySelector('.videoPlayerContainer video').play();
    });
    await sleep(700);
    const hidden = await page.evaluate(() => {
        const card = document.querySelector('.jfx-pause');
        return { open: !!card?.hasAttribute('data-jfx-open'), opacity: card ? getComputedStyle(card).opacity : null };
    });
    await page.screenshot({ path: join(dir, `${label}-playing.png`) });

    await page.goBack();
    await settle(page, 600);
    return { shown, hidden };
}

for (const profileName of profiles) {
    const dir = join(outDir, profileName);
    mkdirSync(dir, { recursive: true });
    const { context } = await newContext(browser, profileName, { injectCss, injectJs });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('console', m => {
        if (m.type() === 'error' && !/WebSocket connection/.test(m.text())) errors.push(`console: ${m.text()}`);
    });

    await login(page);
    console.log(`[${profileName}] add-on version seen by the page:`,
        await page.evaluate(() => window.JellyFlixAddon ? window.JellyFlixAddon.version : 'NOT LOADED'));
    for (const route of ['details-episode', 'details-movie']) {
        await go(page, ROUTES[route]);
        const r = await probe(page, route, dir);
        results.push({ profile: profileName, route, ...r });
        console.log(`\n[${profileName}] ${route}`);
        console.log(JSON.stringify(r, null, 1));
    }
    if (errors.length) console.log(`\n[${profileName}] errors:\n` + errors.join('\n'));
    await context.close();
}

await browser.close();
console.log('\nShots ->', outDir);

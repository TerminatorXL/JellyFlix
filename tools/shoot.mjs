// Screenshot harness for the local Jellyfin 12.x test server.
// Drives a headless browser through the main pages in several layout profiles and saves
// PNGs to _shots/<out>/<profile>/<page>.png (+ errors.log with console/page errors).
//
// Run it through tools/shoot.sh (Playwright container on the Docker network), e.g.:
//   tools/shoot.sh --out current --apply --profiles modern-desktop,legacy-mobile --pages home,details-movie
// Options:
//   --profiles a,b     layout profiles (see PROFILES in lib.mjs); default: 4 main profiles
//   --pages x,y        pages to capture (see ALL_PAGES); default: all
//   --out name         output folder under _shots/ (default: current)
//   --apply            build + upload dist/jellyflix.css into server Custom CSS first (real install path)
//   --clear            remove server Custom CSS first (stock look)
//   --inject a.css,b   inject CSS files as the last <style> in <body> (no server change; "dist" = bundle)
//   --js file.js       inject a JS file on every page load (add-on testing)
//   --full             full-page screenshots instead of viewport
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root, arg, flag, sleep, resolveRoutes, settle, go, login, readInjectCss, launch, newContext, BASE } from './lib.mjs';

const ALL_PAGES = [
    'login', 'home', 'home-scrolled', 'home-hover', 'favorites', 'movies', 'shows', 'details-movie',
    'details-movie-scrolled', 'details-series', 'details-season', 'details-episode', 'details-person',
    'search', 'player', 'prefs', 'prefs-display', 'dashboard', 'dashboard-branding'
];

const profiles = arg('profiles', 'modern-desktop,modern-mobile,legacy-desktop,legacy-mobile').split(',');
const pages = arg('pages', ALL_PAGES.join(',')).split(',');
const outRoot = join(root, '_shots', arg('out', 'current'));
const fullPage = flag('full');

if (flag('apply')) {
    execFileSync('node', [join(root, 'tools', 'build.mjs')], { stdio: 'inherit' });
    execFileSync('node', [join(root, 'tools', 'apply.mjs')], { stdio: 'inherit' });
} else if (flag('clear')) {
    execFileSync('node', [join(root, 'tools', 'apply.mjs'), '--clear'], { stdio: 'inherit' });
}
const injectCss = readInjectCss(arg('inject', ''));
const injectJs = arg('js', '') ? readFileSync(join(root, arg('js')), 'utf8') : '';

const ROUTES = await resolveRoutes();
const browser = await launch();
const report = [];

async function shot(page, dir, name) {
    await page.screenshot({ path: join(dir, `${name}.png`), fullPage });
    console.log(`  ✓ ${name}`);
}

for (const profileName of profiles) {
    const dir = join(outRoot, profileName);
    mkdirSync(dir, { recursive: true });
    const { context, profile: p } = await newContext(browser, profileName, { injectCss, injectJs });
    console.log(`\n[${profileName}] ${p.viewport.width}x${p.viewport.height} layout=${p.layout}${injectCss ? ' +inject' : ''}`);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('console', m => {
        if (m.type() === 'error' && !/WebSocket connection/.test(m.text())) errors.push(`console: ${m.text()}`);
    });

    try {
        if (pages.includes('login')) {
            await page.goto(`${BASE}/web/#/login`);
            await page.waitForSelector('#loginPage', { timeout: 20000 });
            await settle(page, 1500);
            await shot(page, dir, 'login');
            const manual = page.locator('#loginPage .btnManual');
            if (await manual.isVisible()) {
                await manual.click();
                await sleep(500);
                await shot(page, dir, 'login-manual');
            }
        }
        await login(page);

        for (const name of pages) {
            if (name === 'login') continue;
            try {
                if (name === 'home-scrolled' || name === 'details-movie-scrolled') {
                    await go(page, ROUTES[name.replace('-scrolled', '')]);
                    await page.mouse.move(p.viewport.width / 2, p.viewport.height / 2);
                    await page.mouse.wheel(0, Math.round(p.viewport.height * 0.8));
                    await sleep(1200);
                    await shot(page, dir, name);
                } else if (name === 'home-hover') {
                    if (p.mobile || p.layout === 'tv') continue;
                    await go(page, ROUTES.home);
                    const card = page.locator('.homeSectionsContainer .emby-scroller .card').nth(1);
                    await card.hover();
                    await sleep(900);
                    await shot(page, dir, 'home-hover');
                } else if (name === 'player') {
                    await go(page, ROUTES['details-movie']);
                    const play = page.locator('.itemDetailPage:not(.hide) .mainDetailButtons .btnPlay').first();
                    await play.click();
                    await page.waitForSelector('#videoOsdPage', { timeout: 20000 });
                    await sleep(4000);
                    await page.mouse.move(p.viewport.width / 2, p.viewport.height / 2);
                    await page.mouse.move(p.viewport.width / 2 + 20, p.viewport.height / 2 + 20);
                    await sleep(600);
                    await shot(page, dir, 'player');
                    await page.goBack();
                    await settle(page, 500);
                } else if (ROUTES[name]) {
                    await go(page, ROUTES[name]);
                    await shot(page, dir, name);
                } else {
                    console.warn(`  ? unknown page ${name}`);
                }
            } catch (e) {
                console.warn(`  ✗ ${name}: ${e.message.split('\n')[0]}`);
                errors.push(`harness ${name}: ${e.message.split('\n')[0]}`);
            }
        }
    } catch (e) {
        console.warn(`  ✗ profile failed: ${e.message.split('\n')[0]}`);
        errors.push(`harness: ${e.message.split('\n')[0]}`);
    }
    writeFileSync(join(dir, 'errors.log'), errors.join('\n'));
    report.push({ profile: profileName, errors: errors.length });
    await context.close();
}

await browser.close();
console.log('\nDone ->', outRoot);
console.table(report);

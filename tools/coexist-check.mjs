// Both plugins installed at once: each ships the same core, so the second bundle to load must JOIN
// the first one's framework instead of replacing it. Checks that both modules end up running and
// that both features actually work on the same page.
//   tools/pw.sh tools/coexist-check.mjs
import { sleep, go, login, launch, newContext, api, USER } from './lib.mjs';

const me = (await api('/Users')).find(u => u.Name === USER);
const eps = (await api(`/Items?userId=${me.Id}&Recursive=true&IncludeItemTypes=Episode&SortBy=SortName`)).Items;
const ep = eps[0];

const browser = await launch();
const { context } = await newContext(browser, 'modern-desktop');
const page = await context.newPage();
const warnings = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning' || /JellyFlix/.test(m.text())) warnings.push(m.type() + ': ' + m.text().slice(0, 300)); });
page.on('pageerror', e => warnings.push('pageerror: ' + e.message));
await login(page);
await go(page, '#/home');
await sleep(2000);

const framework = await page.evaluate(() => ({
    bundle: window.JellyFlixAddon.bundle,
    build: window.JellyFlixAddon.build,
    modules: window.JellyFlixAddon.modules.map(m => ({ id: m.id, running: !!m.running, broken: !!m.broken }))
}));
console.log('framework:', JSON.stringify(framework, null, 1));

await go(page, `#/details?id=${ep.Id}&serverId=${me.ServerId}`);
await page.locator('.itemDetailPage:not(.hide) .mainDetailButtons .btnPlay').first().click();
await page.waitForSelector('#videoOsdPage', { timeout: 20000 });
await sleep(4500);
await page.mouse.move(960, 540);
await page.mouse.move(980, 560);
await sleep(600);

const hasButton = await page.evaluate(() => !!document.querySelector('.jfx-eps-btn'));
await page.click('.jfx-eps-btn');
await sleep(2000);
const picker = await page.evaluate(() => ({
    open: !!document.querySelector('.jfx-eps')?.hasAttribute('data-jfx-open'),
    episodes: document.querySelectorAll('.jfx-eps-item').length
}));
await page.keyboard.press('Escape');
await sleep(800);

const beforePause = await page.evaluate(() => {
    const v = document.querySelector('.videoPlayerContainer video');
    const A = window.JellyFlixAddon;
    return {
        videoPresent: !!v,
        videoPaused: v ? v.paused : null,
        osdPresent: !!document.querySelector('#videoOsdPage:not(.hide)'),
        mode: A.player.state.mode,
        item: A.player.state.item?.Name || null,
        pauseCfg: A.config.pauseInfo
    };
});
console.log('przed pauza:', JSON.stringify(beforePause));

await page.evaluate(() => document.querySelector('.videoPlayerContainer video')?.pause());
await sleep(2500);
const cardDiag = await page.evaluate(() => {
    const A = window.JellyFlixAddon;
    const c = document.querySelector('.jfx-pause');
    return {
        addonPaused: A.player.state.paused,
        cardNode: !!c,
        cardParent: c?.parentElement?.className || null,
        hasOpenAttr: !!c?.hasAttribute('data-jfx-open')
    };
});
console.log('po pauzie:  ', JSON.stringify(cardDiag));

const card = await page.evaluate(() => {
    const c = document.querySelector('.jfx-pause');
    return {
        open: !!c?.hasAttribute('data-jfx-open'),
        shown: (c?.querySelector('.jfx-pause-logo')?.alt || c?.querySelector('.jfx-pause-title')?.textContent || '').trim()
    };
});

const ids = framework.modules.map(m => m.id);
const results = [
    ['oba moduly sa zarejestrowane', ids.includes('pauseInfo') && ids.includes('episodePicker')],
    ['zaden modul nie jest broken', framework.modules.every(m => !m.broken)],
    ['oba moduly dzialaja', framework.modules.filter(m => ['pauseInfo', 'episodePicker'].includes(m.id)).every(m => m.running)],
    ['guzik odcinkow jest', hasButton],
    ['panel odcinkow dziala', picker.open && picker.episodes > 0],
    ['karta pauzy dziala', card.open && !!card.shown]
];
console.log();
results.forEach(([n, ok]) => console.log(`  ${ok ? '✔' : '✘'} ${n}`));
console.log(results.every(r => r[1]) ? '\nALL PASS' : '\nFAILED');
if (warnings.length) console.log('\nkomunikaty [JellyFlix]:\n' + warnings.join('\n'));
await context.close(); await browser.close();

// The drawer driven the way a TV remote drives it: arrows and Enter, no mouse.
import { sleep, go, login, launch, newContext, api, USER, arg } from './lib.mjs';
const me = (await api('/Users')).find(u => u.Name === USER);
const ep = (await api(`/Items?userId=${me.Id}&Recursive=true&IncludeItemTypes=Episode&SortBy=SortName`)).Items[0];
const browser = await launch();
const { context } = await newContext(browser, arg('profile', 'tv'));
const page = await context.newPage();
await login(page);
await go(page, `#/details?id=${ep.Id}&serverId=${me.ServerId}`);
await page.locator('.itemDetailPage:not(.hide) .mainDetailButtons .btnPlay').first().click();
await page.waitForSelector('#videoOsdPage', { timeout: 20000 });
await sleep(4500);

const focused = () => page.evaluate(() => {
    const a = document.activeElement;
    return a ? (a.className || a.tagName) + (a.textContent ? ' :: ' + a.textContent.trim().slice(0, 30) : '') : 'brak';
});
const media = () => page.evaluate(() => {
    const v = document.querySelector('.videoPlayerContainer video');
    return { t: +v.currentTime.toFixed(1), paused: v.paused };
});

await page.keyboard.press('ArrowUp');        // obudz OSD, jak pilot
await sleep(800);
await page.evaluate(() => document.querySelector('.jfx-eps-btn').click());   // OK na guziku
await sleep(2000);
console.log('po otwarciu, fokus :', await focused());

await page.keyboard.press('ArrowDown'); await sleep(500);
console.log('po ArrowDown       :', await focused());
await page.keyboard.press('ArrowDown'); await sleep(500);
console.log('po 2x ArrowDown    :', await focused());

const beforeSeek = await media();
await page.keyboard.press('ArrowRight'); await sleep(900);
const afterSeek = await media();
console.log('ArrowRight: czas', beforeSeek.t, '->', afterSeek.t,
    Math.abs(afterSeek.t - beforeSeek.t) > 3 ? '  <-- PRZEWINELO FILM' : '  ok');

// poczekaj az OSD samo sie schowa (3 s bezczynnosci) i sprobuj ponownie
await sleep(4000);
const osdHidden = await page.evaluate(() => {
    const b = document.querySelector('.videoOsdBottom');
    return !!b && (b.classList.contains('videoOsdBottom-hidden') || b.classList.contains('hide'));
});
const beforeSeek2 = await media();
await page.keyboard.press('ArrowRight'); await sleep(900);
const afterSeek2 = await media();
console.log('OSD schowane:', osdHidden, '| ArrowRight: czas', beforeSeek2.t, '->', afterSeek2.t,
    Math.abs(afterSeek2.t - beforeSeek2.t) > 3 ? '  <-- PRZEWINELO FILM' : '  ok');

// zejdz na drugi odcinek i zatwierdz, jak pilotem
const playing = () => page.evaluate(() => window.JellyFlixAddon.player.state.item?.Name || null);
await page.keyboard.press('ArrowDown'); await sleep(400);
await page.keyboard.press('ArrowDown'); await sleep(400);
console.log('fokus przed Enter  :', await focused());
const nameBefore = await playing();
await page.keyboard.press('Enter'); await sleep(8000);
const nameAfter = await playing();
console.log('Enter: odcinek', JSON.stringify(nameBefore), '->', JSON.stringify(nameAfter),
    nameAfter && nameAfter !== nameBefore ? '  <-- WLACZYL' : '  <-- nie zmienil');
console.log('stan po Enter      :', JSON.stringify(await media()));
await context.close(); await browser.close();

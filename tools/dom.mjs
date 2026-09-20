// Live DOM inspector for the local Jellyfin test server.
// Prints a compact tree (tag#id.classes [attrs] "text") of the elements matching --selector on a page,
// optionally with computed styles, so theme authors can target the real 12.x markup.
//
// Run via:  tools/pw.sh tools/dom.mjs --profile modern-desktop --route home --selector ".homeSectionsContainer" --depth 5
// Options:
//   --profile name       layout profile (default modern-desktop)
//   --route name|#/hash  named route from lib.resolveRoutes() or a raw hash (default home)
//   --selector css       root element(s) to print (default body); first 3 matches are printed
//   --depth n            max depth (default 6)
//   --computed a,b,c     print these computed style properties for every printed element
//   --inject a.css,dist  inject CSS like shoot.mjs does (to inspect themed state)
//   --hover css          hover this element before dumping
//   --click css          click this element before dumping
//   --scroll px          wheel-scroll the page by px before dumping
//   --html               print raw outerHTML (truncated to --max chars) instead of the tree
//   --max n              max output characters (default 20000)
//   --nologin            do not log in (for login/select-server pages)
import { arg, flag, sleep, resolveRoutes, go, login, settle, readInjectCss, launch, newContext, BASE } from './lib.mjs';

const profileName = arg('profile', 'modern-desktop');
const routeArg = arg('route', 'home');
const selector = arg('selector', 'body');
const depth = Number(arg('depth', '6'));
const computed = arg('computed', '').split(',').filter(Boolean);
const max = Number(arg('max', '20000'));

const browser = await launch();
const { context, profile } = await newContext(browser, profileName, { injectCss: readInjectCss(arg('inject', '')) });
const page = await context.newPage();

if (flag('nologin')) {
    await page.goto(`${BASE}/web/${routeArg.startsWith('#') ? routeArg : '#/login'}`);
    await settle(page, 1500);
} else {
    await login(page);
    const routes = await resolveRoutes();
    await go(page, routeArg.startsWith('#') ? routeArg : routes[routeArg]);
}
if (arg('scroll')) {
    await page.mouse.move(profile.viewport.width / 2, profile.viewport.height / 2);
    await page.mouse.wheel(0, Number(arg('scroll')));
    await sleep(800);
}
if (arg('click')) { await page.click(arg('click')); await sleep(1000); }
if (arg('hover')) { await page.hover(arg('hover')); await sleep(800); }

const out = await page.evaluate(({ selector, depth, computed, html, max }) => {
    const roots = [...document.querySelectorAll(selector)].slice(0, 3);
    if (!roots.length) return `No element matches ${selector}`;
    if (html) return roots.map(r => r.outerHTML).join('\n\n').slice(0, max);

    const sig = el => el.tagName + '.' + [...el.classList].sort().join('.');
    const describe = el => {
        let s = el.tagName.toLowerCase();
        if (el.id) s += '#' + el.id;
        if (el.classList.length) s += '.' + [...el.classList].join('.');
        const attrs = ['role', 'data-type', 'data-action', 'data-index', 'is', 'href', 'aria-label', 'data-testid', 'type']
            .filter(a => el.hasAttribute(a))
            .map(a => `${a}="${String(el.getAttribute(a)).slice(0, 40)}"`);
        if (attrs.length) s += ` [${attrs.join(' ')}]`;
        const r = el.getBoundingClientRect();
        s += ` {${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}}`;
        const cs = getComputedStyle(el);
        if (cs.display === 'none') s += ' (display:none)';
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
        if (own) s += ` "${own.slice(0, 50)}"`;
        if (computed.length) s += '  ⟨' + computed.map(p => `${p}: ${cs.getPropertyValue(p)}`).join('; ') + '⟩';
        return s;
    };
    const lines = [];
    const walk = (el, d) => {
        lines.push('  '.repeat(d) + describe(el));
        if (d >= depth || ['svg', 'script', 'style'].includes(el.tagName.toLowerCase())) return;
        const kids = [...el.children];
        let prevSig = null, run = 0;
        kids.forEach((k, i) => {
            const s = sig(k);
            run = s === prevSig ? run + 1 : 0;
            prevSig = s;
            if (run < 2) walk(k, d + 1);
            else if (run === 2) {
                const rest = kids.slice(i).filter(x => sig(x) === s).length;
                lines.push('  '.repeat(d + 1) + `… (+${rest} more ${s.toLowerCase()})`);
            }
        });
    };
    roots.forEach(r => walk(r, 0));
    return lines.join('\n').slice(0, max);
}, { selector, depth, computed, html: flag('html'), max });

console.log(`# ${profileName} ${routeArg} ${selector}  (html.class="${await page.evaluate(() => document.documentElement.className)}", data-theme="${await page.evaluate(() => document.documentElement.dataset.theme)}")`);
console.log(out);
await browser.close();

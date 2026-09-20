// Shared helpers for the JellyFlix dev harness (shoot.mjs, dom.mjs).
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const BASE = process.env.JF_URL || 'http://localhost:8096';
export const USER = process.env.JF_USER || 'admin';
export const PASS = process.env.JF_PASS || 'jellyflix';
export const TOKEN = process.env.JF_TOKEN || readFileSync(join(root, '_test', 'token.txt'), 'utf8').trim();

export const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';

export const PROFILES = {
    'modern-desktop': { viewport: { width: 1920, height: 1080 }, layout: 'modern' },
    'modern-laptop': { viewport: { width: 1366, height: 768 }, layout: 'modern' },
    'modern-tablet': { viewport: { width: 820, height: 1180 }, layout: 'modern', mobile: true },
    'modern-mobile': { viewport: { width: 390, height: 844 }, layout: 'modern', mobile: true },
    'legacy-desktop': { viewport: { width: 1920, height: 1080 }, layout: 'desktop-legacy' },
    'legacy-mobile': { viewport: { width: 390, height: 844 }, layout: 'mobile-legacy', mobile: true },
    'tv': { viewport: { width: 1920, height: 1080 }, layout: 'tv' }
};

export const arg = (name, def) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 && process.argv[i + 1] !== undefined && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
};
export const flag = name => process.argv.includes(`--${name}`);
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export const api = async path =>
    (await fetch(`${BASE}${path}`, { headers: { Authorization: `MediaBrowser Token="${TOKEN}"` } })).json();

/** Resolves named routes (hash URLs) using real item ids from the test server. */
export async function resolveRoutes() {
    const me = (await api('/Users')).find(u => u.Name === USER);
    const views = (await api(`/UserViews?userId=${me.Id}`)).Items;
    const moviesView = views.find(v => v.CollectionType === 'movies');
    const showsView = views.find(v => v.CollectionType === 'tvshows');
    const withArt = i => i.BackdropImageTags?.length && i.ImageTags?.Logo;
    const movies = (await api(`/Items?userId=${me.Id}&Recursive=true&IncludeItemTypes=Movie&SortBy=SortName`)).Items;
    const series = (await api(`/Items?userId=${me.Id}&Recursive=true&IncludeItemTypes=Series&SortBy=SortName`)).Items;
    const movie = movies.find(withArt) || movies[0];
    const show = series.find(withArt) || series[0];
    const season = (await api(`/Shows/${show.Id}/Seasons?userId=${me.Id}`)).Items[0];
    const episode = (await api(`/Shows/${show.Id}/Episodes?userId=${me.Id}&seasonId=${season.Id}`)).Items[0];
    const person = (await api(`/Persons?userId=${me.Id}&limit=1`)).Items?.[0];
    const sid = me.ServerId;
    return {
        home: '#/home',
        movies: `#/movies?topParentId=${moviesView?.Id}&collectionType=movies`,
        shows: `#/tv?topParentId=${showsView?.Id}&collectionType=tvshows`,
        favorites: '#/home?tab=1',
        'details-movie': `#/details?id=${movie.Id}&serverId=${sid}`,
        'details-series': `#/details?id=${show.Id}&serverId=${sid}`,
        'details-season': `#/details?id=${season.Id}&serverId=${sid}`,
        'details-episode': `#/details?id=${episode.Id}&serverId=${sid}`,
        'details-person': person ? `#/details?id=${person.Id}&serverId=${sid}` : undefined,
        search: '#/search?query=dark',
        prefs: '#/mypreferencesmenu',
        'prefs-display': '#/mypreferencesdisplay',
        'prefs-home': '#/mypreferenceshome',
        dashboard: '#/dashboard',
        'dashboard-branding': '#/dashboard/branding',
        ids: { movie: movie.Id, show: show.Id, season: season.Id, episode: episode.Id, serverId: sid }
    };
}

export async function settle(page, extra = 1200) {
    try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch { /* long-polling is fine */ }
    try {
        await page.waitForFunction(() => {
            const spinner = document.querySelector('.docspinner, .MuiCircularProgress-root');
            return !spinner || spinner.offsetParent === null;
        }, null, { timeout: 8000 });
    } catch { /* keep going */ }
    await sleep(extra);
}

export async function go(page, hash, extra) {
    await page.goto(`${BASE}/web/${hash}`);
    await settle(page, extra);
}

export async function login(page) {
    await page.goto(`${BASE}/web/#/login`);
    await page.waitForSelector('#loginPage', { timeout: 20000 });
    await settle(page, 800);
    if (!(await page.isVisible('#txtManualName'))) {
        const manual = page.locator('#loginPage .btnManual');
        if (await manual.isVisible()) await manual.click();
    }
    await page.fill('#txtManualName', USER);
    await page.fill('#txtManualPassword', PASS);
    await page.click('#loginPage .manualLoginForm .button-submit');
    await page.waitForURL(/#\/home/, { timeout: 20000 });
    await settle(page);
}

/**
 * Reads CSS to inject from a comma-separated list of files/globs-free paths (relative to repo root).
 * "dist" is a shortcut for dist/jellyflix.css.
 */
export function readInjectCss(list) {
    if (!list) return '';
    return list.split(',').filter(Boolean).map(f => {
        const p = f === 'dist' ? join(root, 'dist', 'jellyflix.css') : (isAbsolute(f) ? f : join(root, f));
        return readFileSync(p, 'utf8');
    }).join('\n');
}

export async function launch() {
    return chromium.launch({
        channel: (process.env.PW_CHANNEL ?? 'msedge') || undefined,
        headless: true,
        args: ['--autoplay-policy=no-user-gesture-required']
    });
}

/**
 * Creates a browser context for a layout profile.
 * @param {object} opts.injectCss CSS text appended as the LAST <style> in <body> on every page load,
 *   which mirrors how Jellyfin renders Branding "Custom CSS" (a <style> inside the React root, i.e. after
 *   all <head> styles). Lets parallel workers test CSS without touching the shared server config.
 * @param {string} opts.injectJs JS source evaluated on every page load (for testing add-on scripts).
 */
export async function newContext(browser, profileName, { injectCss = '', injectJs = '' } = {}) {
    const p = PROFILES[profileName];
    if (!p) throw new Error(`Unknown profile ${profileName}. Known: ${Object.keys(PROFILES).join(', ')}`);
    const context = await browser.newContext({
        viewport: p.viewport,
        deviceScaleFactor: 1,
        isMobile: !!p.mobile,
        hasTouch: !!p.mobile,
        userAgent: p.mobile ? MOBILE_UA : undefined,
        locale: 'pl-PL'
    });
    await context.addInitScript(({ layout, css }) => {
        try { localStorage.setItem('layout', layout); } catch { /* ignore */ }
        if (!css) return;
        const attach = () => {
            let el = document.getElementById('jellyflix-inject');
            if (!el) {
                el = document.createElement('style');
                el.id = 'jellyflix-inject';
                el.textContent = css;
            }
            if (document.body && document.body.lastElementChild !== el) document.body.appendChild(el);
        };
        document.addEventListener('DOMContentLoaded', () => {
            attach();
            new MutationObserver(() => {
                if (!document.getElementById('jellyflix-inject')) attach();
            }).observe(document.body, { childList: true });
        });
    }, { layout: p.layout, css: injectCss });
    if (injectJs) {
        await context.addInitScript(src => {
            document.addEventListener('DOMContentLoaded', () => {
                const s = document.createElement('script');
                s.textContent = src;
                document.body.appendChild(s);
            });
        }, injectJs);
    }
    return { context, profile: p };
}

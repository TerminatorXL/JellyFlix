// ==UserScript==
// @name         JellyFlix add-on
// @namespace    https://github.com/jellyflix
// @version      1.0.0
// @description  Optional JavaScript companion for the JellyFlix theme (Jellyfin 12.x): home billboard, row tagging, smooth app-bar ramp, card metadata.
// @match        *://*/web/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/*
 * JellyFlix add-on — OPTIONAL. The CSS theme is complete without it.
 *
 * What it adds (each can be switched off in CONFIG below):
 *   1. rowTags    — writes data-jfx-row="<slug of the row title>" on every home row,
 *                   so CSS can style a row by name (e.g. the Top-10 numerals).
 *   2. scrollVar  — writes --jflix-scroll: 0..1 on <html> so the app bar can fade in
 *                   smoothly on browsers without scroll-driven animations (TV boxes).
 *   3. hero       — prepends a Netflix-style billboard to the home page. All styling
 *                   comes from the theme (.jfx-hero* classes); this only builds markup.
 *   4. cardMeta   — writes data-jfx-overview / -genres / -runtime on home cards so the
 *                   theme can show an expanded hover panel. Off by default (extra API calls).
 *
 * How to install (pick ONE):
 *   a) Browser userscript manager (Tampermonkey/Violentmonkey) — per client, survives server upgrades.
 *   b) Jellyfin plugin "JavaScript Injector" (repo: https://raw.githubusercontent.com/n00bcodr/jellyfin-plugins/main/12/manifest.json)
 *      — paste the body of this file (the userscript header is ignored).
 *   c) Reverse proxy sub_filter injecting <script src="...jellyflix-addon.user.js"></script> before </body>.
 *
 * It never writes to the server: only GET requests to the same Jellyfin instance you are logged into.
 */
(function () {
    'use strict';

    var CONFIG = {
        rowTags: true,
        scrollVar: true,
        hero: true,
        cardMeta: false,
        // Hero content: which libraries/types to pick from and how it behaves.
        heroTypes: 'Movie,Series',
        heroPoolSize: 24,        // how many candidates to fetch
        heroRotateMs: 15000,     // 0 = no rotation
        heroRequireLogo: false,  // true = only show items that have a logo image
        debug: false
    };

    var LOG = function () {
        if (CONFIG.debug) console.log.apply(console, ['[JellyFlix]'].concat([].slice.call(arguments)));
    };

    /* ------------------------------------------------------------------ utils */

    // "Filmy — ostatnio dodane" -> "filmy-ostatnio-dodane" (diacritics folded; ł/Ł handled explicitly
    // because NFD does not decompose it).
    function slugify(text) {
        var s = (text || '').toLowerCase().replace(/ł/g, 'l');
        if (s.normalize) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
        return s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function api() {
        var client = window.ApiClient;
        if (!client || !client.serverAddress || !client.accessToken) return null;
        var address = client.serverAddress();
        var token = client.accessToken();
        var userId = client.getCurrentUserId && client.getCurrentUserId();
        if (!address || !token || !userId) return null;
        return { address: address, token: token, userId: userId };
    }

    function apiGet(path, params) {
        var ctx = api();
        if (!ctx) return Promise.reject(new Error('no api client'));
        var query = Object.keys(params || {}).map(function (k) {
            return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
        }).join('&');
        return fetch(ctx.address + path + (query ? '?' + query : ''), {
            headers: { Authorization: 'MediaBrowser Token="' + ctx.token + '"' }
        }).then(function (r) {
            if (!r.ok) throw new Error(path + ' -> ' + r.status);
            return r.json();
        });
    }

    function imageUrl(itemId, type, tag, maxWidth) {
        var ctx = api();
        if (!ctx) return '';
        return ctx.address + '/Items/' + itemId + '/Images/' + type + '/0'
            + '?tag=' + encodeURIComponent(tag)
            + (maxWidth ? '&maxWidth=' + maxWidth : '')
            + '&api_key=' + encodeURIComponent(ctx.token);
    }

    function onHomePage() {
        return /#\/home/.test(location.hash) || location.hash === '' || location.hash === '#/';
    }

    function homeContainer() {
        // The visible home page only — viewManager keeps old pages in the DOM with .hide.
        var page = document.querySelector('#indexPage:not(.hide), .homePage:not(.hide)');
        if (!page) return null;
        return page.querySelector('.homeSectionsContainer') || page.querySelector('.sections');
    }

    /* -------------------------------------------------------------- 1. rowTags */

    function tagRows() {
        var container = homeContainer();
        if (!container) return;
        var sections = container.querySelectorAll('.verticalSection, .section0, .section1, .section2, .section3, .section4, .section5, .section6, .section7, .section8, .section9');
        Array.prototype.forEach.call(sections, function (section) {
            var title = section.querySelector('h2.sectionTitle, .sectionTitle');
            if (!title) return;
            var slug = slugify(title.textContent);
            if (slug && section.getAttribute('data-jfx-row') !== slug) {
                section.setAttribute('data-jfx-row', slug);
            }
        });
    }

    /* ------------------------------------------------------------ 2. scrollVar */

    function installScrollVar() {
        var raf = 0;
        var update = function (target) {
            var top = 0;
            if (target && target !== document && target.scrollTop != null) top = target.scrollTop;
            if (!top) top = window.pageYOffset || document.documentElement.scrollTop || 0;
            var ratio = Math.max(0, Math.min(1, top / 120));
            document.documentElement.style.setProperty('--jflix-scroll', ratio.toFixed(3));
        };
        var onScroll = function (e) {
            var target = e && e.target;
            if (raf) return;
            raf = requestAnimationFrame(function () {
                raf = 0;
                update(target && target.scrollTop != null ? target : null);
            });
        };
        document.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', function () { update(null); }, { passive: true });
        update(null);
    }

    /* ----------------------------------------------------------------- 3. hero */

    var heroState = { items: [], index: 0, timer: 0, node: null };

    function buildHeroNode() {
        var hero = el('div', 'jfx-hero');
        hero.setAttribute('data-jfx-hero', '');
        var art = el('div', 'jfx-hero-art');
        var img = el('img', 'jfx-hero-backdrop');
        img.alt = '';
        img.decoding = 'async';
        art.appendChild(img);
        var scrim = el('div', 'jfx-hero-scrim');
        var body = el('div', 'jfx-hero-body');
        var logo = el('img', 'jfx-hero-logo');
        logo.alt = '';
        var title = el('h1', 'jfx-hero-title');
        var meta = el('div', 'jfx-hero-meta');
        var overview = el('p', 'jfx-hero-overview');
        var actions = el('div', 'jfx-hero-actions');
        var play = el('a', 'jfx-hero-btn jfx-hero-btn-play');
        play.innerHTML = '<span class="material-icons play_arrow" aria-hidden="true"></span><span></span>';
        var info = el('a', 'jfx-hero-btn jfx-hero-btn-info');
        info.innerHTML = '<span class="material-icons info_outline" aria-hidden="true"></span><span></span>';
        actions.appendChild(play);
        actions.appendChild(info);
        body.appendChild(logo);
        body.appendChild(title);
        body.appendChild(meta);
        body.appendChild(overview);
        body.appendChild(actions);
        hero.appendChild(art);
        hero.appendChild(scrim);
        hero.appendChild(body);
        return hero;
    }

    function renderHero(item) {
        var hero = heroState.node;
        if (!hero || !item) return;
        var backdropTag = (item.BackdropImageTags || [])[0];
        var img = hero.querySelector('.jfx-hero-backdrop');
        if (backdropTag) {
            img.src = imageUrl(item.Id, 'Backdrop', backdropTag, 1920);
            img.style.display = '';
        } else {
            img.removeAttribute('src');
            img.style.display = 'none';
        }
        var logo = hero.querySelector('.jfx-hero-logo');
        var logoTag = item.ImageTags && item.ImageTags.Logo;
        var title = hero.querySelector('.jfx-hero-title');
        if (logoTag) {
            logo.src = imageUrl(item.Id, 'Logo', logoTag, 800);
            logo.alt = item.Name || '';
            logo.style.display = '';
            title.style.display = 'none';
            title.textContent = item.Name || '';
        } else {
            logo.removeAttribute('src');
            logo.style.display = 'none';
            title.style.display = '';
            title.textContent = item.Name || '';
        }
        var bits = [];
        if (item.ProductionYear) bits.push(item.ProductionYear);
        if (item.OfficialRating) bits.push(item.OfficialRating);
        if (item.RunTimeTicks && item.Type === 'Movie') bits.push(Math.round(item.RunTimeTicks / 600000000) + ' min');
        if (item.Type === 'Series' && item.ChildCount) bits.push(item.ChildCount + (item.ChildCount === 1 ? ' sezon' : ' sezony'));
        if (item.Genres && item.Genres.length) bits.push(item.Genres.slice(0, 3).join(' • '));
        hero.querySelector('.jfx-hero-meta').textContent = bits.join('   ');
        hero.querySelector('.jfx-hero-overview').textContent = item.Overview || '';
        var play = hero.querySelector('.jfx-hero-btn-play');
        var info = hero.querySelector('.jfx-hero-btn-info');
        var detailsHref = '#/details?id=' + item.Id + (item.ServerId ? '&serverId=' + item.ServerId : '');
        play.setAttribute('href', detailsHref);
        info.setAttribute('href', detailsHref);
        play.lastChild.textContent = localizedLabel('play');
        info.lastChild.textContent = localizedLabel('info');
        hero.setAttribute('data-jfx-hero-type', item.Type || '');
    }

    function localizedLabel(kind) {
        var lang = (document.documentElement.lang || navigator.language || 'en').slice(0, 2).toLowerCase();
        var labels = {
            pl: { play: 'Odtwórz', info: 'Więcej informacji' },
            de: { play: 'Abspielen', info: 'Mehr Infos' },
            es: { play: 'Reproducir', info: 'Más información' },
            fr: { play: 'Lecture', info: "Plus d'infos" },
            en: { play: 'Play', info: 'More info' }
        };
        return (labels[lang] || labels.en)[kind];
    }

    function rotateHero() {
        if (!heroState.items.length) return;
        heroState.index = (heroState.index + 1) % heroState.items.length;
        renderHero(heroState.items[heroState.index]);
    }

    function loadHeroItems() {
        return apiGet('/Items', {
            userId: api().userId,
            IncludeItemTypes: CONFIG.heroTypes,
            Recursive: true,
            SortBy: 'Random',
            Limit: CONFIG.heroPoolSize,
            Fields: 'Overview,Genres,ProductionYear,OfficialRating,RunTimeTicks,ChildCount',
            ImageTypeLimit: 2,
            EnableImageTypes: 'Backdrop,Logo',
            EnableTotalRecordCount: false
        }).then(function (data) {
            var items = (data.Items || []).filter(function (i) {
                if (!(i.BackdropImageTags || []).length) return false;
                if (CONFIG.heroRequireLogo && !(i.ImageTags && i.ImageTags.Logo)) return false;
                return true;
            });
            LOG('hero candidates', items.length);
            return items;
        });
    }

    function ensureHero() {
        if (!CONFIG.hero || !onHomePage()) return;
        var container = homeContainer();
        if (!container) return;
        if (heroState.node && heroState.node.parentNode === container) return;   // already mounted

        var hero = heroState.node || buildHeroNode();
        heroState.node = hero;
        container.insertBefore(hero, container.firstChild);
        document.documentElement.setAttribute('data-jfx-addon', 'on');

        if (heroState.items.length) {
            renderHero(heroState.items[heroState.index]);
        } else if (api()) {
            loadHeroItems().then(function (items) {
                heroState.items = items;
                if (items.length) renderHero(items[0]);
                else hero.remove();
            }).catch(function (err) {
                LOG('hero failed', err);
                hero.remove();
            });
        }
        if (CONFIG.heroRotateMs && !heroState.timer) {
            heroState.timer = setInterval(function () {
                if (document.hidden) return;
                if (!heroState.node || !heroState.node.isConnected) return;
                if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
                rotateHero();
            }, CONFIG.heroRotateMs);
        }
    }

    /* ------------------------------------------------------------- 4. cardMeta */

    function annotateCards() {
        if (!CONFIG.cardMeta) return;
        var container = homeContainer();
        if (!container) return;
        var cards = container.querySelectorAll('.card[data-id]:not([data-jfx-meta])');
        var ids = [];
        Array.prototype.forEach.call(cards, function (card) {
            var id = card.getAttribute('data-id');
            if (id && ids.indexOf(id) === -1) ids.push(id);
        });
        if (!ids.length) return;
        apiGet('/Items', {
            userId: api().userId,
            ids: ids.slice(0, 60).join(','),
            Fields: 'Overview,Genres,RunTimeTicks'
        }).then(function (data) {
            var byId = {};
            (data.Items || []).forEach(function (i) { byId[i.Id] = i; });
            Array.prototype.forEach.call(cards, function (card) {
                var item = byId[card.getAttribute('data-id')];
                if (!item) return;
                card.setAttribute('data-jfx-meta', '1');
                if (item.Overview) card.setAttribute('data-jfx-overview', item.Overview.slice(0, 240));
                if (item.Genres && item.Genres.length) card.setAttribute('data-jfx-genres', item.Genres.slice(0, 3).join(' • '));
                if (item.RunTimeTicks) card.setAttribute('data-jfx-runtime', Math.round(item.RunTimeTicks / 600000000) + ' min');
            });
        }).catch(function (err) { LOG('cardMeta failed', err); });
    }

    /* ------------------------------------------------------------------- boot */

    function tick() {
        if (CONFIG.rowTags) tagRows();
        if (CONFIG.hero) ensureHero();
        if (CONFIG.cardMeta) annotateCards();
    }

    function start() {
        LOG('starting');
        if (CONFIG.scrollVar) installScrollVar();
        var scheduled = 0;
        var schedule = function () {
            if (scheduled) return;
            scheduled = setTimeout(function () { scheduled = 0; tick(); }, 150);
        };
        new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
        window.addEventListener('hashchange', function () {
            heroState.index = 0;
            schedule();
        });
        schedule();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();

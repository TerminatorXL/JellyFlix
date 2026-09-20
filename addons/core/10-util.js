/* Small helpers shared by every module: logging, DOM building, slugs, a debouncer,
 * a stylesheet injector and the string table.
 */
JFX.util = (function () {
    /* ---------------------------------------------------------------- strings */

    // Modules call addStrings() with their own table; t() falls back en -> key.
    var STRINGS = { en: {} };

    function lang() {
        var code = document.documentElement.lang || navigator.language || 'en';
        return code.slice(0, 2).toLowerCase();
    }

    function addStrings(table) {
        for (var code in table) {
            if (!Object.prototype.hasOwnProperty.call(table, code)) continue;
            if (!STRINGS[code]) STRINGS[code] = {};
            for (var key in table[code]) {
                if (Object.prototype.hasOwnProperty.call(table[code], key)) {
                    STRINGS[code][key] = table[code][key];
                }
            }
        }
    }

    // t('remaining', 21) -> "Pozostało 21 min" (every %s is replaced, in order).
    function t(key) {
        var dict = STRINGS[lang()] || {};
        var text = dict[key];
        if (text == null) text = STRINGS.en[key];
        if (text == null) return key;
        var args = Array.prototype.slice.call(arguments, 1);
        return text.replace(/%s/g, function () {
            return args.length ? args.shift() : '';
        });
    }

    /* ---------------------------------------------------------------- logging */

    function log() {
        if (!JFX.config.debug) return;
        console.log.apply(console, ['[JellyFlix]'].concat([].slice.call(arguments)));
    }

    function warn() {
        console.warn.apply(console, ['[JellyFlix]'].concat([].slice.call(arguments)));
    }

    /* -------------------------------------------------------------------- DOM */

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    /* "Filmy — ostatnio dodane" -> "filmy-ostatnio-dodane".
     *
     * Diacritics are folded through NFD; ł/Ł is handled explicitly because Unicode does not
     * decompose it (it is a letter with a stroke, not a letter plus a combining mark). Both the
     * ł literal and the combining range are written as \u escapes on purpose: the built bundle is
     * pasted into a plugin's XML text field, a proxy config or a userscript manager, and at least
     * one of those will mangle a raw combining character. ASCII-only source survives all of them.
     */
    function slugify(text) {
        var s = (text || '').toLowerCase().replace(/ł/g, 'l');
        if (s.normalize) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
        return s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    /* A module stylesheet goes in as the FIRST child of <head>, which makes it the weakest sheet
     * on the page: Jellyfin's own CSS, and above all the theme's Custom CSS (rendered as a <style>
     * inside the React root, i.e. last), override it at equal specificity. That is the contract
     * The add-on supplies structure and a bare-minimum look; a stylesheet of your own
     * supplies the looks. */
    function injectCss(id, css) {
        if (!css || !document.head || document.getElementById(id)) return;
        var style = document.createElement('style');
        style.id = id;
        style.textContent = css;
        document.head.insertBefore(style, document.head.firstChild);
    }

    function removeCss(id) {
        var style = document.getElementById(id);
        if (style && style.parentNode) style.parentNode.removeChild(style);
    }

    /* ------------------------------------------------------------------ timing */

    function debounce(fn, ms) {
        var timer = 0;
        return function () {
            if (timer) return;                       // leading-edge coalescing, like the old add-on
            timer = setTimeout(function () { timer = 0; fn(); }, ms);
        };
    }

    function reducedMotion() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    /* Options object for addEventListener, feature-detected once.
     *
     * Passive listeners are worth real frames on a scroll handler, but an engine that predates
     * them (webOS 5 is borderline) reads the options OBJECT as the boolean `capture` argument — so
     * `{ passive: true }` would silently become `capture: true`, and the matching
     * removeEventListener(name, fn) would then fail to unhook anything. Detect, or fall back to
     * the plain boolean. */
    var passiveSupported = false;
    try {
        window.addEventListener('jfx-probe', null, Object.defineProperty({}, 'passive', {
            get: function () { passiveSupported = true; return false; }
        }));
    } catch (err) { /* older engine: passiveSupported stays false */ }

    function listenerOpts(capture) {
        return passiveSupported ? { capture: !!capture, passive: true } : !!capture;
    }

    /* ----------------------------------------------------------------- format */

    // Jellyfin counts in 100 ns ticks.
    function ticksToMinutes(ticks) {
        return Math.max(1, Math.round(ticks / 600000000));
    }

    function clamp(text, max) {
        if (!text) return '';
        if (text.length <= max) return text;
        var cut = text.slice(0, max);
        var space = cut.lastIndexOf(' ');
        return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:—-]+$/, '') + '…';
    }

    return {
        lang: lang,
        addStrings: addStrings,
        t: t,
        log: log,
        warn: warn,
        el: el,
        slugify: slugify,
        injectCss: injectCss,
        removeCss: removeCss,
        debounce: debounce,
        reducedMotion: reducedMotion,
        listenerOpts: listenerOpts,
        ticksToMinutes: ticksToMinutes,
        clamp: clamp
    };
})();

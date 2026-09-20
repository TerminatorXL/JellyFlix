/* The one shared object. Every other file in the bundle hangs off it, and it is exposed as
 * window.JellyFlixAddon so it can be inspected or re-configured from the browser console:
 *     JellyFlixAddon.version
 *     JellyFlixAddon.config.pauseInfo.delayMs = 1000
 *     JellyFlixAddon.setConfig({ cardMeta: { enabled: true } })  // persisted in localStorage
 *
 * Every file below is plain ES5 on purpose: the theme targets TV browsers down to Chromium 68
 * (webOS 5), where `let`, arrow functions and template literals are a coin flip.
 *
 * ---------------------------------------------------------------------------------------------
 * DOUBLE INJECTION
 * ---------------------------------------------------------------------------------------------
 * The bundle has no single install channel — a userscript manager, the JavaScript Injector plugin
 * and an nginx `sub_filter` can all be live on the same page, and during an upgrade two DIFFERENT
 * builds will be. `JFX.started` alone never caught that: build-addon.mjs wraps the whole bundle in
 * one IIFE, so a second copy simply built a brand-new namespace object over the first one, with
 * `started: false`, and then registered every module a second time. Two billboards, two scroll
 * listeners, two pause cards.
 *
 * `__BUILD__` is a content hash of this exact bundle, stamped in by build-addon.mjs. That turns the
 * question into an answerable one:
 *
 *   same build already running   -> this copy is a literal duplicate; return, do nothing at all.
 *   a different build running    -> this copy is an upgrade; tear the old one down and take over.
 *   an old build with no stop()  -> nothing safe to do; warn and stand down rather than double up.
 *
 * The bare `return` below is legal because build-addon.mjs concatenates every file into a single
 * function body — it aborts the rest of the bundle, so nothing registers and nothing starts.
 */
var JFX;

/* Set when this copy is riding on a framework another bundle already installed. The build wraps
 * core/10-* … core/50-* in `if (!JFX_JOINED)`, so joining skips them entirely and this bundle
 * contributes nothing but its own modules. */
var JFX_JOINED = false;

if (window.JellyFlixAddon && window.JellyFlixAddon.modules) {
    var running = window.JellyFlixAddon;

    if (running.build === '__BUILD__') {
        return;                                    // exact duplicate — the running copy is this copy
    }

    if (running.bundle === '__BUNDLE__') {
        /* Same bundle, different build: an upgrade. Note this also stops any modules another
         * bundle had joined onto the old framework; they come back on the next page load. */
        if (typeof running.stop !== 'function') {
            console.warn('[JellyFlix] another build of "__BUNDLE__" is running and cannot be stopped;'
                + ' this copy (__BUILD__) stands down. Remove one of the two installs.');
            return;
        }
        console.warn('[JellyFlix] replacing build', running.build, 'with __BUILD__');
        try {
            running.stop();
        } catch (err) {
            console.warn('[JellyFlix] the previous build did not shut down cleanly', err);
        }
    } else if (typeof running.register === 'function') {
        /* A DIFFERENT bundle — a second plugin from this repository. Do not fight it: register this
         * bundle's modules into the framework that is already up. That is what lets two plugins,
         * each shipping the same core, coexist on one page instead of tearing each other down. */
        JFX = running;
        JFX_JOINED = true;
    } else {
        console.warn('[JellyFlix] an unrecognised add-on is already running; "__BUNDLE__" stands down.');
        return;
    }
}

if (!JFX_JOINED) {
    JFX = (window.JellyFlixAddon = {
    version: '__VERSION__',

    /** Which bundle this is: a plugin slug, or 'all' for the complete userscript. */
    bundle: '__BUNDLE__',

    /** Content hash of this bundle. Used by the double-injection guard above. */
    build: '__BUILD__',

    /** Registered modules, in bundle order. Filled by JFX.register(). */
    modules: [],

    /** Effective config: module defaults <- window.JELLYFLIX_ADDON_CONFIG <- localStorage. */
    config: { debug: false },

        /** Set by JFX.start(); guards against JFX.start() being called twice. */
        started: false
    });
}

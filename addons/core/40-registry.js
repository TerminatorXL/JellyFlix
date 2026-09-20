/* Module registry and lifecycle.
 *
 * A module is a plain object:
 *     JFX.register({
 *         id:       'pauseInfo',            // also the key in JFX.config
 *         title:    'Pause info card',      // for logs
 *         defaults: { enabled: true, … },   // merged into JFX.config[id]
 *         css:      '…',                    // optional baseline stylesheet, injected once
 *         init:     function (cfg) {},      // once, when the module starts
 *         route:    function (cfg) {},      // optional, on every hashchange
 *         tick:     function (cfg) {},      // optional, debounced after DOM mutations
 *         destroy:  function () {}          // optional, when the module is switched off
 *     });
 *
 * Only `id` and one of init/tick are required. A module that throws is disabled rather than
 * allowed to take the rest of the bundle down with it — the add-on is strictly additive.
 */
(function () {
    var STORE_KEY = 'jellyflix-addon-config';
    var TICK_MS = 150;
    var tick = null;                           // set by JFX.start()
    var observer = null;                       // the DOM MutationObserver, so JFX.stop() can unhook
    var onRoute = null;                        // the hashchange listener, same reason

    function isPlainObject(value) {
        return !!value && typeof value === 'object' && !(value instanceof Array);
    }

    function merge(target, patch) {
        for (var key in patch) {
            if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
            if (isPlainObject(patch[key])) {
                if (!isPlainObject(target[key])) target[key] = {};
                merge(target[key], patch[key]);
            } else {
                target[key] = patch[key];
            }
        }
        return target;
    }

    function stored() {
        try {
            return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
        } catch (err) {
            return {};
        }
    }

    function rebuildConfig() {
        var config = { debug: false };
        for (var i = 0; i < JFX.modules.length; i++) {
            var mod = JFX.modules[i];
            config[mod.id] = merge({ enabled: true }, mod.defaults || {});
        }
        /* Both overlays are user-supplied and must survive being the wrong shape: merge() walks
         * `for (key in patch)`, which on a string would enumerate character indices and quietly
         * produce config.0 = "h". Anything that is not a plain object is ignored. */
        if (isPlainObject(window.JELLYFLIX_ADDON_CONFIG)) merge(config, window.JELLYFLIX_ADDON_CONFIG);
        var fromStore = stored();
        if (isPlainObject(fromStore)) merge(config, fromStore);
        JFX.config = config;
        return config;
    }

    function guard(mod, name, arg) {
        var fn = mod[name];
        if (!fn) return;
        try {
            fn.call(mod, arg);                 // `this` is the module, so hooks can stash state on it
        } catch (err) {
            JFX.util.warn(mod.id + '.' + name + '() failed — module disabled', err);
            mod.broken = true;
        }
    }

    function startModule(mod) {
        if (mod.running || mod.broken) return;
        if (!JFX.config[mod.id] || !JFX.config[mod.id].enabled) return;
        mod.running = true;
        if (mod.css) JFX.util.injectCss('jellyflix-addon-' + mod.id, mod.css);
        guard(mod, 'init', JFX.config[mod.id]);
        JFX.util.log('module on:', mod.id);
    }

    function stopModule(mod) {
        if (!mod.running) return;
        mod.running = false;
        guard(mod, 'destroy');
        JFX.util.log('module off:', mod.id);
    }

    function sync() {
        for (var i = 0; i < JFX.modules.length; i++) {
            var mod = JFX.modules[i];
            if (JFX.config[mod.id] && JFX.config[mod.id].enabled) startModule(mod);
            else stopModule(mod);
        }
        // A module switched on mid-session must not wait for the next DOM mutation to see the page.
        if (tick) tick();
    }

    /* -------------------------------------------------------------- public API */

    JFX.register = function (mod) {
        if (!mod || !mod.id) throw new Error('JellyFlix add-on: a module needs an id');
        JFX.modules.push(mod);
        if (JFX.started) {                     // registered late (console, second bundle) — honour it
            rebuildConfig();
            sync();
        }
    };

    /** Persisted overrides. setConfig(null) forgets them. */
    JFX.setConfig = function (patch) {
        try {
            if (patch === null) localStorage.removeItem(STORE_KEY);
            else localStorage.setItem(STORE_KEY, JSON.stringify(merge(stored(), patch)));
        } catch (err) {
            JFX.util.warn('config not persisted (storage blocked)', err);
            if (patch) merge(JFX.config, patch);
        }
        rebuildConfig();
        sync();
        return JFX.config;
    };

    JFX.start = function () {
        if (JFX.started) return;               // JFX.start() called twice in one copy of the bundle
        if (!document.body) {                  // injected before the document had a body
            JFX.util.warn('start() called with no <body>; deferring');
            document.addEventListener('DOMContentLoaded', function () { JFX.start(); });
            return;
        }
        JFX.started = true;
        rebuildConfig();
        JFX.util.log('v' + JFX.version, 'build', JFX.build, 'modules:', JFX.modules.length);
        sync();

        tick = JFX.util.debounce(function () {
            JFX.player.scan();
            for (var i = 0; i < JFX.modules.length; i++) {
                var mod = JFX.modules[i];
                if (mod.running && !mod.broken && mod.tick) guard(mod, 'tick', JFX.config[mod.id]);
            }
        }, TICK_MS);

        onRoute = function () {
            for (var i = 0; i < JFX.modules.length; i++) {
                var mod = JFX.modules[i];
                if (mod.running && !mod.broken && mod.route) guard(mod, 'route', JFX.config[mod.id]);
            }
            tick();
        };

        observer = new MutationObserver(tick);
        observer.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('hashchange', onRoute);
        tick();
    };

    /** Full shutdown. Called by a NEWER bundle taking over this one (see core/00-namespace.js),
     *  and available by hand: JellyFlixAddon.stop() leaves the page exactly as jellyfin-web
     *  rendered it. Every module's destroy() is responsible for removing what it added. */
    JFX.stop = function () {
        if (!JFX.started) return;
        JFX.started = false;
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        if (onRoute) {
            window.removeEventListener('hashchange', onRoute);
            onRoute = null;
        }
        for (var i = 0; i < JFX.modules.length; i++) stopModule(JFX.modules[i]);
        tick = null;
        JFX.util.log('stopped');
    };
})();

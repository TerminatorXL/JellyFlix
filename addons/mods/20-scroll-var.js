/* --jflix-scroll: 0…1 on <html>, so the app bar can ramp its scrim smoothly everywhere.
 *
 * `animation-timeline: scroll()` needs Chromium 115 and exists on no TV engine; this works back to
 * webOS 5 (Chromium 68). Every rule that reads the variable must still supply a fallback —
 * var(--jflix-scroll, 0) — so the stylesheet is correct when the add-on is absent.
 */
JFX.register({
    id: 'scrollVar',
    title: 'App-bar scroll ramp',
    defaults: { enabled: true, rampPx: 120 },

    init: function (cfg) {
        var raf = 0;

        var update = function (target) {
            var top = 0;
            if (target && target !== document && target.scrollTop != null) top = target.scrollTop;
            if (!top) top = window.pageYOffset || document.documentElement.scrollTop || 0;
            var ratio = Math.max(0, Math.min(1, top / cfg.rampPx));
            document.documentElement.style.setProperty('--jflix-scroll', ratio.toFixed(3));
        };

        var schedule = window.requestAnimationFrame
            ? function (fn) { return window.requestAnimationFrame(fn); }
            : function (fn) { return setTimeout(fn, 16); };

        this.onScroll = function (e) {
            var target = e && e.target;
            if (raf) return;
            raf = schedule(function () {
                raf = 0;
                update(target && target.scrollTop != null ? target : null);
            });
        };
        this.onResize = function () { update(null); };

        /* The options must be IDENTICAL on add and remove or the listener is never unhooked —
         * which is why both go through util.listenerOpts(), and why that helper falls back to a
         * plain boolean on engines that read an options object as `capture`. Capture is required:
         * the app scrolls an inner element on some layouts and scroll does not bubble. */
        this.scrollOpts = JFX.util.listenerOpts(true);
        this.resizeOpts = JFX.util.listenerOpts(false);
        document.addEventListener('scroll', this.onScroll, this.scrollOpts);
        window.addEventListener('resize', this.onResize, this.resizeOpts);
        update(null);
    },

    destroy: function () {
        if (this.onScroll) document.removeEventListener('scroll', this.onScroll, this.scrollOpts);
        if (this.onResize) window.removeEventListener('resize', this.onResize, this.resizeOpts);
        document.documentElement.style.removeProperty('--jflix-scroll');
    }
});

/* data-jfx-row="<slug of the row title>" on every home row.
 *
 * The highest-leverage lines of JS in the bundle. CSS cannot match text, so without this a row can
 * only be addressed by its slot index (.section0….section9) — which changes the moment the user
 * reorders their home screen. With it a stylesheet can say [data-jfx-row="do-obejrzenia"] and mean it.
 */
JFX.register({
    id: 'rowTags',
    title: 'Row tagging',
    defaults: { enabled: true },

    tick: function () {
        var container = JFX.home.container();
        if (!container) return;
        var sections = container.querySelectorAll(
            '.verticalSection, .section0, .section1, .section2, .section3, .section4,'
            + ' .section5, .section6, .section7, .section8, .section9');
        Array.prototype.forEach.call(sections, function (section) {
            var title = section.querySelector('h2.sectionTitle, .sectionTitle');
            if (!title) return;
            var slug = JFX.util.slugify(title.textContent);
            if (slug && section.getAttribute('data-jfx-row') !== slug) {
                section.setAttribute('data-jfx-row', slug);
            }
        });
    },

    /* Switched off, or handing over to a newer bundle: put the DOM back exactly as jellyfin-web
     * rendered it, so `JellyFlixAddon.stop()` really does leave no trace. */
    destroy: function () {
        var tagged = document.querySelectorAll('[data-jfx-row]');
        Array.prototype.forEach.call(tagged, function (section) {
            section.removeAttribute('data-jfx-row');
        });
    }
});

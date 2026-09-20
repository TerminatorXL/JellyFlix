/* Last file in the bundle. Every module has registered by now, so start them.
 *
 * Nothing above this line touches the page: registration only fills JFX.modules. That is what makes
 * "disabled by config" cost exactly nothing, and what lets a module be added or removed by dropping
 * a file into addons/mods/.
 */
if (JFX_JOINED) {
    /* Someone else's framework is already up and running. JFX.register() above has handed it this
     * bundle's modules, and the registry starts anything registered after JFX.start() on its own —
     * so there is deliberately nothing to do here. */
    JFX.util.log('joined the running framework as bundle "__BUNDLE__"');
} else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { JFX.start(); });
} else {
    JFX.start();
}

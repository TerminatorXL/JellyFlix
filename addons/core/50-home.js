/* Home-page lookups, used by the rowTags and cardMeta modules.
 *
 * viewManager keeps pages in the DOM and only adds `.hide`, so "the home page" always means
 * "the one that is not hidden" — otherwise a stale #indexPage from a previous visit gets decorated.
 *
 * The home page also has TABS. `#/home?tab=1` is the favourites list: `#indexPage` is still
 * visible, but `#homeTab` loses `.is-active` and `#favoritesTab` gets it. Both tabs contain a
 * `.sections` div, and the favourites one is NOT a `.homeSectionsContainer` — so a bare
 * `querySelector('.sections')` would happily hand a caller the favourites list and let it
 * decorate the wrong cards. container() therefore returns null unless the home tab itself is the
 * one on screen, so nothing gets decorated on the strength of the favourites list being open.
 */
JFX.home = (function () {
    function isCurrent() {
        return /#\/home/.test(location.hash) || location.hash === '' || location.hash === '#/';
    }

    function hasClass(node, name) {
        if (!node) return false;
        if (node.classList) return node.classList.contains(name);
        return (' ' + node.className + ' ').indexOf(' ' + name + ' ') > -1;
    }

    function container() {
        var page = document.querySelector('#indexPage:not(.hide), .homePage:not(.hide)');
        if (!page) return null;
        var homeTab = page.querySelector('#homeTab');
        if (homeTab && !hasClass(homeTab, 'is-active')) return null;    // a different tab is showing
        var host = homeTab || page;
        return host.querySelector('.homeSectionsContainer') || host.querySelector('.sections');
    }

    return { isCurrent: isCurrent, container: container };
})();

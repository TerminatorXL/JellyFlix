# Modern layout shell — app bar, nav, drawer, library toolbar (Jellyfin 12.1)

Scope: `src/apps/modern/AppLayout.tsx`, `OffsetAppBar`, `AppToolbar` (+ base `components/toolbar/*`),
`UserViewNav`, `SearchButton`, `RemotePlayButton`, `SyncPlayButton`, user avatar menu, `AppDrawer` +
`MainDrawerContent`, `LibraryToolbar` (tabs menu, filter/sort/view, `AlphabetPicker`, `Pagination`),
`AppOverrides.scss`.

All paths below are relative to `_ref/jellyfin-web/` unless stated otherwise.

---

## Where it appears (routes, layouts, breakpoints)

**Layout gate.** The whole shell only renders when the *Modern* app is active. `<html>` carries
`layout-desktop | layout-mobile | layout-tv` (set by `src/components/layoutManager.js:8-16`, value derived from
`appSettings.layout`, normalized `mobile-legacy -> mobile`) and `data-theme="dark|light|appletv|blueradiance|purplehaze|wmc"`.
Verified live: `modern-desktop` → `html.layout-desktop`, `modern-tablet` and `modern-mobile` → `html.layout-mobile`
(the class follows **browser/UA touch detection, not viewport width**). `body` carries `libraryDocument`
(`src/scripts/libraryMenu.js:587`) and `withSectionTabs` (`src/components/maintabsmanager.js:133`) — legacy leftovers
that are still toggled in the modern app.

**Routes.** The shell wraps every user route of the modern app (`AppLayout` is the route element).
`AppToolbar` returns `null` only on `/video` (`src/apps/modern/components/AppToolbar/index.tsx:28`).
On `PUBLIC_PATHS` (login/select-server) the nav, the 3 action buttons and the avatar are hidden
(`index.tsx:34,38,49,59`).

**Second toolbar row (`LibraryToolbar`)** renders only when `isLibraryPath(pathname)` is true
(`AppLayout.tsx:51`), i.e. pathname is exactly one of
`/livetv /books /boxsets /movies /music /tv /homevideos /musicvideos /playlists /mixed`
(`src/apps/modern/features/libraries/constants/libraryRoutes.ts:9,46,88,110,152,199,246,273,300,317`).
Note **`/tv`, not `/shows`**. `/home`, `/details`, `/search`, `/mypreferences*` → single-row app bar.

**App bar height (measured live):**

| profile / route | app bar height | rows |
|---|---|---|
| modern-desktop 1920 `/home`, `/details`, `/search` | **48px** | 1 |
| modern-desktop 1920 `/movies` | **96px** | 2 × 48 |
| modern-laptop 1366 `/movies` | **96px** | 2 × 48 |
| modern-tablet 820 `/movies` | **96px** | 2 × 48 |
| modern-tablet 820 `/details`, modern-mobile 390 `/home`, `/search` | **48px** | 1 |
| modern-mobile 390 `/movies` | **132px** | 48 + **84** (library row wraps to 2 lines) |

Both toolbars are MUI `variant='dense'` → `min-height: 48px` (never changes at breakpoints).

**MUI breakpoints that actually change this subsystem** (sm 600 / md 900 / lg 1200 / xl 1536):

| breakpoint | what flips | source |
|---|---|---|
| **md 900** | `< md`: hamburger + `AppDrawer` appear, and the **whole left block (logo/server button + `UserViewNav`) is not rendered at all**. `>= md`: no hamburger, no drawer, logo + nav links shown. | `AppLayout.tsx:26-27,47`; `AppToolbar/index.tsx:52` |
| **lg 1200** | main toolbar `flex-wrap`: `wrap` below, `nowrap` at/above. Verified: 820 → `wrap`, 1366/1920 → `nowrap`. | `components/toolbar/AppToolbar.tsx:49-54` |
| **lg 1200 / xl 1536** | max primary nav items: 3 (< lg), 5 (lg), 8 (xl); the rest go into a "More" overflow menu (only if count > max+1). | `UserViewNav.tsx:26-28,66-72,93-101` |
| **sm 600** | `LibraryToolbar`: below sm the button groups use `size='small'` and the play/shuffle labels are hidden; the right-hand `Stack` gets `flex-basis:100%` (wraps to its own line) and `margin-top: 8px`. | `LibraryToolbar.tsx:58,128-143,157,166,204` |
| **sm 600** | `AlphabetPicker` `top`: `144px` (xs) vs `96px` (sm+), `align-items: flex-start` vs `center`. | `AlphabetPicker.tsx:36-47` |

---

## DOM skeleton (real markup, trimmed; hashed emotion classes marked `css-*`)

```
body.libraryDocument.withSectionTabs            {overflow: hidden auto  ← page scroll lives HERE}
  div#reactRoot
    div.backdropContainer                        {position:fixed; z-index:-1; contain:size layout style}
    div.backgroundContainer                      {position:fixed; contain:strict; background:#101010}
    div[style="display: none"]                   ← legacy shell, PRESENT but hidden in modern layout
      div.mainDrawer.transition.touch-menu-la    {z-index:1099}
      div.skinHeader.skinHeader-withBackground…  {z-index:999}
      div.mainDrawerHandle
    div.MuiBox-root.css-sjv9i2                   ← AppLayout root  {position:relative; display:flex; column; height:100%}
      header.MuiPaper-root.MuiPaper-elevation0.MuiAppBar-root
             .MuiAppBar-colorTransparent .MuiAppBar-positionFixed .mui-fixed .css-1u7mpsp
                                                 {position:fixed; top:0; z-index:1100; bg transparent; box-shadow:none}
        div.MuiToolbar-root.MuiToolbar-gutters.MuiToolbar-dense.padded-left.padded-right.css-1tmqktv   ← AppToolbar (row 1)
          button.MuiIconButton-root.MuiIconButton-sizeLarge  > svg[data-testid="MenuIcon"]   ← only < md
          [button > svg[data-testid="ArrowBackIcon"]]                                        ← only in NativeShell
          div.MuiStack-root.css-x5lcu9                                                       ← only >= md
            a.MuiButton-root.MuiButton-text.MuiButton-sizeLarge.MuiButton-colorInherit[href="#/"]
                 > span.MuiButton-startIcon > img          ← Jellyfin logo (PNG) + server name text
            a.MuiButton-root…[href="#/home?tab=1"]         ← "Favorites"  svg[data-testid="FavoriteIcon"]
            a.MuiButton-root…[href="#/movies?topParentId=…"]  svg[data-testid="MovieIcon"]
            a.MuiButton-root…[href="#/tv?topParentId=…"]      svg[data-testid="TvIcon"]
            [button.MuiButton-root > span.MuiButton-endIcon > svg[data-testid="ArrowDropDownIcon"]]  ← "More"
          div.MuiBox-root.css-1riowxi                                        {flex-grow:1; justify-content:flex-end}
            button.MuiIconButton-root > span.MuiBadge-root > svg[data-testid="GroupsIcon"]  ← SyncPlay
                                        + span.MuiBadge-badge.MuiBadge-dot.MuiBadge-invisible
            button.MuiIconButton-root > svg[data-testid="CastIcon"]          ← RemotePlay (idle)
              ▸ when casting: div.MuiBox-root > button.MuiButton-root[startIcon CastConnectedIcon] "device name"
            a.MuiIconButton-root[href="#/search…"] > svg[data-testid="SearchIcon"]   (+ .Mui-disabled on /search)
          div.MuiBox-root.css-2uchni                                          {flex-grow:0}
            button.MuiIconButton-root.css-g99rn3 (padding:0)
              div.MuiAvatar-root.MuiAvatar-circular[.MuiAvatar-colorDefault]
                 > img  |  svg.MuiAvatar-fallback[data-testid="PersonIcon"]
        div.MuiToolbar-root.MuiToolbar-gutters.MuiToolbar-dense.padded-left.padded-right.css-133e01t  ← LibraryToolbar (row 2, library routes only)
          button.MuiButton-root.MuiButton-sizeLarge[aria-controls="library-view-menu"]
            span.MuiTypography-root.MuiTypography-h2 "Filmy"      ← tab/view title (h2 = 1.5rem)
            span.MuiButton-endIcon > svg[data-testid="ArrowDropDownIcon"]
          div.MuiBox-root.css-179zilw > div.MuiChip-root.MuiChip-filled > span.MuiChip-label "24"   ← item count
          div.MuiStack-root.css-174l32b
            div.MuiBox-root.css-sr31s2
              div.MuiButtonGroup-root.MuiButtonGroup-contained[role="group"]
                button.MuiButton-containedPrimary.MuiButtonGroup-firstButton  "Odtwarzaj wszystko"  [PlayArrowIcon]
                button.MuiButton-containedPrimary.MuiButtonGroup-lastButton   [ShuffleIcon]
              [NewCollectionButton | NewPlaylistButton]
            div.MuiButtonGroup-root.MuiButtonGroup-text.MuiButtonGroup-colorInherit[role="group"]
              button …firstButton  > span.MuiBadge-root > svg[data-testid="FilterAltIcon"]   ← filter
              button …middleButton > svg[data-testid="SortByAlphaIcon"]                      ← sort
              button …lastButton   > svg[data-testid="ViewModuleIcon"|"ViewListIcon"]        ← view settings
            div.MuiButtonGroup-root.MuiButtonGroup-text[role="group"]                        ← Pagination
              button[.Mui-disabled] > svg[data-testid="NavigateBeforeIcon"]
              button[.Mui-disabled] > svg[data-testid="NavigateNextIcon"]
      div[aria-hidden="true"][style="height: 96px; width: 100%; flex-shrink: 0;"]   ← OffsetAppBar SPACER (JS-set height)
      div.PrivateSwipeArea-root.css-a5dz9y     ← only < md (SwipeableDrawer edge), position:fixed, 20px wide
      main.MuiBox-root.css-1iogify             {position:relative; width:100%; flex-grow:1}
        div.mainAnimatedPages.skinBody         ← legacy ViewManager pages (height 0 when empty)
          div#loginPage.page.mainAnimatedPage.hide …
        div.skinBody                           ← React <Outlet/>  (height 0; the page inside is absolute)
          div#moviesPage.page.mainAnimatedPage.libraryPage.pageWithAbsoluteTabs.withTabs
                                               {position:absolute; inset:0; contain:size style}
            div.padded-bottom-page.MuiBox-root.css-0
              div.alphaPicker-fixed-right.MuiBox-root.css-11cf6b   {position:fixed; z-index:1099; right:.4em; top:144px|96px}
                div.MuiPaper-root.MuiPaper-elevation0
                  div.MuiToggleButtonGroup-root.MuiToggleButtonGroup-vertical[role="group"]
                    button.MuiToggleButton-root.MuiToggleButton-sizeSmall …firstButton "#"
                    … 26 more, last = …lastButton "Z"
    link[href="themes/dark/theme.css"]         ← ThemeCss
    <style>…Branding Custom CSS…</style>       ← CustomCss (src/components/CustomCss.tsx:13) — LAST in #reactRoot

  ── portals appended directly to <body> ──
  div#app-user-menu.MuiPopover-root.MuiMenu-root.MuiModal-root[.MuiModal-hidden]   {z-index:1300}
    div.MuiBackdrop-root.MuiBackdrop-invisible.MuiModal-backdrop                   {z-index:-1, transparent}
    div.MuiPaper-root.MuiPaper-elevation8.MuiPopover-paper.MuiMenu-paper           {bg #202020; radius 4px}
      ul.MuiList-root.MuiMenu-list[role="menu"]
        a.MuiMenuItem-root[role="menuitem"][href="#/userprofile?userId=…"]  > div.MuiListItemIcon-root + div.MuiListItemText-root
        a.MuiMenuItem-root[href="#/mypreferencesmenu"] · hr.MuiDivider-root
        a.MuiMenuItem-root[href="#/dashboard"] · a.MuiMenuItem-root[href="#/metadata"]   ← admin only
        a.MuiMenuItem-root[href="#/quickconnect"] · li.MuiMenuItem-root (logout)
  div#app-sync-play-menu … · div#app-remote-play-menu … · div#app-remote-play-active-menu …
  div#user-view-overflow-menu … · div#library-view-menu …          (all .MuiMenu-root, keepMounted)
  div#filter-popover | #sort-popover | #selectview-popover .MuiPopover-root          (id only while open)
  div.MuiDrawer-root.MuiDrawer-anchorLeft.MuiDrawer-modal.MuiModal-root[.MuiModal-hidden]  {z-index:1200}
    div.MuiBackdrop-root.MuiModal-backdrop                         {rgba(0,0,0,.5)}
    div.MuiPaper-root.MuiPaper-elevation16.MuiDrawer-paper.MuiDrawer-paperAnchorLeft
                                   {position:fixed; bg #202020; padding-bottom:4.2rem; width = CONTENT WIDTH (191px @390)}
      div.MuiBox-root[role="presentation"]            ← click anywhere closes the drawer
        ul.MuiList-root.MuiList-padding               (paddingTop:0)
          li.MuiListItem-root > a.MuiListItemButton-root[href="#/"]      ← DrawerHeaderLink: logo + server name (h6) + version
          li.MuiListItem-root > a.MuiListItemButton-root[href="#/home"][.Mui-selected]   [HomeIcon]
          li.MuiListItem-root > a.MuiListItemButton-root[href="#/home?tab=1"]            [FavoriteIcon]
        hr.MuiDivider-root
        ul.MuiList-root.MuiList-subheader
          div#libraries-subheader.MuiListSubheader-root.MuiListSubheader-sticky "Biblioteki"
          li.MuiListItem-root > a.MuiListItemButton-root[href="#/movies?topParentId=…"]  [MovieIcon]
          li.MuiListItem-root > a.MuiListItemButton-root[href="#/tv?topParentId=…"]      [TvIcon]
  div.docspinner.mdl-spinner {z-index: 9999999}
  div.appfooter · div.tmla-mask.hide
```

---

## Selector table

`safe?` = ✅ stable across builds · ⚠️ stable but shared with other areas (scope it) · ❌ hashed / generated, never target.

| selector | what it is | layout(s) | safe to style? | notes (file:line) |
|---|---|---|---|---|
| `html.layout-desktop` / `html.layout-mobile` / `html.layout-tv` | layout switch | all | ✅ | UA/touch driven, **not** width. `components/layoutManager.js:8-16` |
| `html[data-theme="dark"]` | color scheme selector | all | ✅ | `src/themes/index.ts:15` |
| `body.libraryDocument` / `body.withSectionTabs` | legacy body flags, still set | all | ⚠️ | `scripts/libraryMenu.js:587`, `components/maintabsmanager.js:133` |
| `#reactRoot` | React mount point | all | ✅ | gets `aria-hidden="true"` while any modal is open |
| `#reactRoot > .backgroundContainer` | the solid page background (`#101010`) | all | ✅ | `styles/site.scss:73-80`, `contain: strict` |
| `#reactRoot > .backdropContainer` | item backdrop layer, `z-index:-1` | all | ✅ | `components/backdrop/backdrop.scss:1` |
| `#reactRoot > div[style*="display: none"]` | legacy `.skinHeader` / `.mainDrawer` container | modern | ⚠️ | do **not** style `.skinHeader`/`.mainDrawer` for the modern theme — invisible here, but they are live in legacy layout |
| `header.MuiAppBar-root` | **the app bar** | all | ✅ | `position:fixed; top:0; z-index:1100` — `components/OffsetAppBar.tsx:67-75` |
| `header.MuiAppBar-colorTransparent` | not-scrolled state | all | ✅ | `background: transparent; color: var(--jf-palette-text-primary)`; `themes/_base/theme.ts:61-67` |
| `header.MuiAppBar-colorDefault` | scrolled state (`scrollTop > 0`) | all | ✅ | `background:#202020` (`--jf-palette-AppBar-defaultBg`), `OffsetAppBar.tsx:30-33,71` |
| `header.MuiPaper-elevation0` / `.MuiPaper-elevation1` | shadow off / on (scroll) | all | ✅ | `elevation1 = --jf-shadows-1`; `OffsetAppBar.tsx:72` |
| `header.mui-fixed` | MUI scroll-lock marker | all | ⚠️ | MUI writes inline `padding-right` here when a modal opens on a classic-scrollbar browser |
| `header.MuiAppBar-root > .MuiToolbar-root:first-child` | **AppToolbar row** | all | ✅ | hashed twin is `css-1tmqktv` — use `:first-child` |
| `header.MuiAppBar-root > .MuiToolbar-root:nth-child(2)` | **LibraryToolbar row** | library routes | ✅ | hashed twin is `css-133e01t` |
| `.MuiToolbar-dense` | both rows, `min-height:48px` | all | ⚠️ | shared; always scope under `header.MuiAppBar-root` |
| `.MuiToolbar-root.padded-left` / `.padded-right` | 3.3% side gutter | all | ✅ | `styles/librarybrowser.scss:1326,1336`; real selector is `[dir="ltr"] .padded-left` → **specificity (0,2,0)** |
| `header .MuiIconButton-root:has(svg[data-testid="MenuIcon"])` | hamburger (opens drawer) | `< md` only | ✅ | `components/toolbar/AppToolbar.tsx:56-67`; `aria-label` is **localized**, use the icon testid |
| `header .MuiIconButton-root:has(svg[data-testid="ArrowBackIcon"])` | back button | NativeShell only | ✅ | `AppToolbar.tsx:69-80`; never present in a browser |
| `header .MuiStack-root:has(> a[href="#/"])` | logo + nav container | `>= md` | ✅ | hashed twin `css-x5lcu9`; `AppToolbar/index.tsx:52-63` |
| `header a.MuiButton-root[href="#/"]` | **logo / server-name button** | `>= md` | ✅ | `components/toolbar/ServerButton.tsx:14-35` |
| `header a.MuiButton-root[href="#/"] .MuiButton-startIcon img` | the Jellyfin PNG logo | `>= md` | ✅ | `<img src=…icon-transparent.png>` with **inline** `max-height/max-width:1.25em` (`ServerButton.tsx:24-27`) |
| `header a.MuiButton-root[href="#/home?tab=1"]` | "Favorites" nav item | `>= md` | ✅ | `UserViewNav.tsx:126-134` |
| `header a.MuiButton-root[href^="#/movies"]`, `[href^="#/tv"]`, `[href^="#/music"]`, `[href^="#/livetv"]`, `[href^="#/boxsets"]`, `[href^="#/playlists"]`, `[href^="#/books"]`, `[href^="#/homevideos"]`, `[href^="#/musicvideos"]`, `[href^="#/mixed"]` | library nav items | `>= md` | ✅ | href built from `appRouter.getRouteUrl`; `UserViewNav.tsx:154-165` |
| `header .MuiStack-root a.MuiButton-colorPrimary` (or `.MuiButton-textPrimary`) | **active nav item** | `>= md` | ✅ | non-active siblings are `.MuiButton-colorInherit`; `UserViewNav.tsx:128,158` |
| `header .MuiStack-root a.MuiButton-root[target="_blank"]` | custom `menuLinks` from `config.json` | `>= md` | ✅ | `UserViewNav.tsx:136-151` |
| `header button.MuiButton-root[aria-controls="user-view-overflow-menu"]` | "More" nav overflow button | `>= md`, many libraries | ✅ | `UserViewNav.tsx:170-179` |
| `header .MuiBox-root:has(> a[href^="#/search"])` | right-hand action group | all | ✅ | hashed twin `css-1riowxi`; `flex-grow:1; justify-content:flex-end`; `AppToolbar.tsx:84-86` |
| `header .MuiIconButton-root:has(svg[data-testid="GroupsIcon"])` | SyncPlay button | all (plugin+policy gated) | ✅ | `SyncPlayButton.tsx:46-66`; returns `null` when unavailable |
| `header .MuiBadge-badge.MuiBadge-dot` | SyncPlay/filter status dot | all | ⚠️ | `.MuiBadge-invisible` when off; colors `success`/`primary`/`info` |
| `header .MuiIconButton-root:has(svg[data-testid="CastIcon"])` | RemotePlay (idle) | all | ✅ | `RemotePlayButton.tsx:82-93` |
| `header .MuiButton-root:has(svg[data-testid="CastConnectedIcon"])` | RemotePlay (casting, shows device name) | all | ✅ | colored with inline-ish `sx` → `color: var(--jf-palette-primary-main)`; `RemotePlayButton.tsx:56-80` |
| `header a.MuiIconButton-root[href^="#/search"]` | search button | all | ✅ | `SearchButton.tsx:42-54` |
| `header a.MuiIconButton-root[href^="#/search"].Mui-disabled` | search button on `/search` | all | ✅ | verified live on `modern-desktop /search` |
| `header .MuiBox-root:has(> button:has(.MuiAvatar-root))` | avatar wrapper (`flex-grow:0`) | all | ✅ | hashed twin `css-2uchni`; `AppToolbar.tsx:88-92` |
| `header button.MuiIconButton-root:has(.MuiAvatar-root)` | **user menu button** | all | ✅ | `padding:0` via `sx`; `UserMenuButton.tsx:28-39` |
| `header .MuiAvatar-root` | user avatar, 40×40 | all | ✅ | `bgcolor` = `background.paper` (with image) or `primary.dark` (fallback); `UserAvatar.tsx:28-35` |
| `header .MuiAvatar-root svg[data-testid="PersonIcon"]` | avatar fallback glyph | all | ✅ | `.MuiAvatar-fallback` |
| `header.MuiAppBar-root + div[aria-hidden="true"]` | **the spacer that pushes content down** | all | ✅ (needs `!important`) | inline `height` written by JS/ResizeObserver; `OffsetAppBar.tsx:77-84` |
| `main.MuiBox-root` | content column | all | ✅ | `position:relative; flex-grow:1`; `AppLayout.tsx:65-72` |
| `main > .mainAnimatedPages.skinBody` | legacy ViewManager host | all | ✅ | `components/AppBody.tsx:16` |
| `main > .skinBody:not(.mainAnimatedPages)` | React `<Outlet/>` host | all | ✅ | `AppBody.tsx:17` |
| `.page.mainAnimatedPage` | any page (legacy or React) | all | ⚠️ | `position:absolute; inset:0; contain:size style !important` |
| `#moviesPage`, `#tvshowsPage`, `#musicPage`, `#booksPage`, `#boxsetsPage`, `#playlistsPage`, `#liveTvPage`, `#homevideos`, `#musicvideos`, `#mixed` | library page roots | all | ✅ | `features/libraries/components/LibraryPage.tsx:15-29` |
| `#indexPage`, `#itemDetailPage`, `#searchPage`, `#myPreferencesMenuPage` | other page roots | all | ✅ | `#searchPage` is legacy markup (`.searchFields`, `#searchTextInput`) |
| `header button[aria-controls="library-view-menu"]` | **library tab / view dropdown button** | library routes | ✅ | `LibraryViewMenu.tsx:39-50` |
| `header button[aria-controls="library-view-menu"] .MuiTypography-h2` | the big library title ("Filmy") | library routes | ✅ | `h2 = 1.5rem` (`themes/_base/theme.ts:46-48`) |
| `header .MuiToolbar-root:nth-child(2) .MuiChip-root` | item-count chip ("24" / "1-50 of 200") | library routes | ✅ | loading state renders `∙`; `LibraryToolbar.tsx:120` |
| `header .MuiToolbar-root:nth-child(2) .MuiStack-root` | right-hand button cluster | library routes | ✅ | hashed twin `css-174l32b`; `LibraryToolbar.tsx:124-143` |
| `header .MuiButtonGroup-contained` | Play-all / Shuffle / Queue group | library routes | ✅ | `MuiButton-containedPrimary`, bg `--jf-palette-primary-main` |
| `header .MuiButtonGroup-text button:has(svg[data-testid="FilterAltIcon"])` | filter button | library routes | ✅ | `filter/FilterButton.tsx:188-196` |
| `header .MuiButtonGroup-text button:has(svg[data-testid="SortByAlphaIcon"])` | sort button | library routes | ✅ | `SortButton.tsx` |
| `header .MuiButtonGroup-text button:has(svg[data-testid="ViewModuleIcon"], svg[data-testid="ViewListIcon"])` | grid/list view button | library routes | ✅ | `ViewSettingsButton.tsx:112-118` |
| `header .MuiButtonGroup-text button:has(svg[data-testid="NavigateBeforeIcon"])` / `NavigateNextIcon` | pagination prev / next | library routes, `libraryPageSize > 0` | ✅ | `Pagination.tsx:50-64`; `.Mui-disabled` at bounds |
| `.MuiButtonGroup-firstButton` / `-middleButton` / `-lastButton` | group corner rounding | all | ⚠️ | needed to re-round a themed button group |
| `#filter-popover`, `#sort-popover`, `#selectview-popover` | the three library popovers | library routes | ✅ | ids exist **only while open** (`FilterButton.tsx:102`, `SortButton.tsx:178`, `ViewSettingsButton.tsx:56`) |
| `#filter-popover .MuiPopover-paper` | filter panel | library routes | ⚠️ | carries **inline** `max-height:50%; width:250px` (`FilterButton.tsx:210-216`) |
| `.alphaPicker-fixed-right` | **A–Z rail** | library routes with pagination/sort | ✅ | `AlphabetPicker.tsx:33`; `components/alphaPicker/style.scss:112-132` |
| `.alphaPicker-fixed-right .MuiToggleButtonGroup-vertical` | the rail's button column | as above | ✅ | `size='small'`, `color='primary'` |
| `.alphaPicker-fixed-right .MuiToggleButton-root.Mui-selected` | active letter | as above | ✅ | |
| `.MuiDrawer-root.MuiDrawer-modal` | mobile drawer root | `< md` | ✅ | `z-index:1200`; `MuiModal-hidden` added when closed |
| `.MuiDrawer-modal .MuiDrawer-paper` | **drawer panel** | `< md` | ✅ | `position:fixed`, bg `#202020`, `padding-bottom:4.2rem`, **width = content width** (191px @390) — `ResponsiveDrawer.tsx:45-60` |
| `.MuiDrawer-modal .MuiModal-backdrop` | drawer scrim | `< md` | ✅ | `rgba(0,0,0,.5)` |
| `.PrivateSwipeArea-root` | 20px edge swipe strip | `< md` | ✅ | MUI-generated but stable name; `position:fixed`, full height |
| `.MuiDrawer-paper a.MuiListItemButton-root[href="#/"]` | drawer header (logo + server name + version) | `< md` | ✅ | `DrawerHeaderLink.tsx:16-31`; `ListItemIcon` has `sx minWidth:56`, img `height:2.5rem` |
| `.MuiDrawer-paper a.MuiListItemButton-root[href="#/home"]`, `[href="#/home?tab=1"]` | Home / Favorites | `< md` | ✅ | `MainDrawerContent.tsx:41-55` |
| `.MuiDrawer-paper a.MuiListItemButton-root.Mui-selected` | current drawer entry | `< md` | ✅ | bg = `rgba(0,164,220,.2)` (primary @ `selectedOpacity .2`); `ListItemLink.tsx:35-46` |
| `#libraries-subheader` | "Libraries" heading | `< md` | ✅ | `MainDrawerContent.tsx:92`; `MuiListSubheader-sticky`, `background: inherit` (`themes/_base/theme.ts:108-116`) |
| `.MuiDrawer-paper .MuiListItemIcon-root` | drawer icons | `< md` | ⚠️ | `min-width:36` from theme (`theme.ts:101-107`), 56 on the header row |
| `#app-user-menu` | avatar dropdown | all | ✅ | `components/toolbar/AppUserMenu.tsx:27`; `keepMounted` → always in DOM |
| `#app-user-menu a[href="#/userprofile?userId="]`…`[href="#/mypreferencesmenu"]`, `[href="#/dashboard"]`, `[href="#/metadata"]`, `[href="#/quickconnect"]` | menu entries | all | ✅ | admin entries only for `Policy.IsAdministrator` |
| `#app-sync-play-menu`, `#app-remote-play-menu`, `#app-remote-play-active-menu`, `#user-view-overflow-menu`, `#library-view-menu` | the other menus | all | ✅ | all `keepMounted`; use `.MuiModal-hidden` to detect closed |
| `.MuiMenu-paper`, `.MuiPopover-paper` | any menu/popover surface | all | ⚠️ | `#202020`, radius 4, elevation 8 — one rule restyles every menu in the app |
| `.MuiBackdrop-root.MuiBackdrop-invisible` | menu scrim (transparent) | all | ⚠️ | do not darken this or every menu dims the page |
| `svg.MuiSvgIcon-root[data-testid="…"]` | **every MUI icon** | all | ✅ | `data-testid` ships in production — the only non-localized way to identify a button |
| `.css-1u7mpsp`, `.css-1tmqktv`, `.css-133e01t`, `.css-sjv9i2`, `.css-1iogify`, `.css-x5lcu9`, `.css-1riowxi`, `.css-2uchni`, `.css-174l32b`, `.css-179zilw`, `.css-sr31s2`, `.css-11cf6b`, `.css-i2hxb6`, `.css-g99rn3`, `.css-iqm7ky`, `.css-1f20jcn`, `.css-19rbmc7` | emotion hashes | all | ❌ | change on every jellyfin-web rebuild — **never target** |

---

## Existing styling that will fight a custom theme

1. **The spacer's inline height is JS-written.** `<div aria-hidden="true" style="height:96px;width:100%;flex-shrink:0">`
   is measured from the real app bar by `getBoundingClientRect()` + `ResizeObserver`
   (`components/OffsetAppBar.tsx:35-63`). Good news: if your CSS changes the toolbar height, the spacer follows
   automatically. Bad news: to make the app bar *overlay* the content (Netflix style) you must zero the spacer
   with `!important`, e.g. `header.MuiAppBar-root + div[aria-hidden="true"] { height: 0 !important; }`.
   Never fake the app bar height with `transform` — the observer reads the layout box and will not notice.

2. **`MuiAppBar-colorTransparent` ⇄ `colorDefault` is a class swap, not a CSS transition.** Only `box-shadow`
   transitions (`0.3s cubic-bezier(.4,0,.2,1)`); the background snaps. A Netflix-style fade needs
   *both* classes given the same `background-image`/`background-color` with a `transition` declared on
   `header.MuiAppBar-root` itself, and the values differentiated per class.

3. **`.padded-left` / `.padded-right` have specificity (0,2,0)**, because SCSS compiles them to
   `[dir="ltr"] .padded-left { padding-left: max(3.3%, env(safe-area-inset-left)) }`
   (`styles/librarybrowser.scss:1326-1344`). A bare `.MuiToolbar-root { padding-left: … }` (0,1,0) **loses**.
   Use `[dir="ltr"] header .MuiToolbar-root.padded-left` or add `!important`. Measured gutters:
   63.36px @1920, 45.06px @1366, 27.05px @820, 12.87px @390.

4. **`!important` already in the source you must out-weigh (equal-specificity `!important` from the custom
   `<style>` wins because it is later in the cascade):**
   - `styles/site.scss:88-90` → `.mainAnimatedPage { contain: style size !important; }`
   - `styles/site.scss:121-125` → `.content-primary, .padded-bottom-page, .page, .pageWithAbsoluteTabs .pageTabContent { padding-bottom: calc(env(safe-area-inset-bottom) + 5em) !important; }`
   - `apps/modern/AppOverrides.scss:18-24` → `.homePage.libraryPage.withTabs, .libraryPage:not(.itemDetailPage) { padding-top: 0 !important; }`
   - `apps/modern/AppOverrides.scss:33-35` (layout-mobile only) → `.itemBackdrop { margin-top: -48px !important; }`
     — **hard-codes the 48px dense app bar height**. If your theme changes the app bar height on mobile, the
     details backdrop will be misaligned until you override this with your own `!important`.
   - `apps/modern/AppOverrides.scss:9-15` → `#myPreferencesMenuPage .lnkQuickConnectPreferences, .adminSection, .userSection { display:none !important }`
   - `components/alphaPicker/style.scss:134-138` → `@media (max-height: 31.25em) { .alphaPicker-fixed { display:none !important } }` (does **not** match the modern `.alphaPicker-fixed-right`).

5. **Inline styles you cannot beat without `!important`:**
   - spacer `height/width/flex-shrink` (above)
   - `ServerButton` logo `<img style="max-height:1.25em;max-width:1.25em">` (`ServerButton.tsx:24-27`)
   - filter popover paper `style="max-height:50%;width:250px"` (`FilterButton.tsx:210-216`)
   - legacy `.mainDrawer` `style="width:320px;left:-320px"` (hidden container, harmless)
   - MUI scroll-lock: while any menu/drawer is open, `body` gets `style="overflow:hidden"`, and on a browser with
     classic scrollbars `body` **and every `.mui-fixed` element** also get an inline `padding-right: <scrollbarWidth>px`.
     Verified live: with the user menu open, `body style="overflow: hidden;"` and `#reactRoot[aria-hidden="true"]`.
     Do not set `padding-right` on `header.MuiAppBar-root` without `!important`-awareness — you will be fighting MUI.

6. **Containment / stacking ancestors:**
   - `.page.mainAnimatedPage` → `contain: size style` (verified computed). `size` means the page box is laid out
     as if empty (`#moviesPage` = 909px tall while its content is 1059px) and content visibly overflows.
     It does **not** contain `layout`, so `position:fixed` children (the A–Z rail) still anchor to the viewport.
     Do not add `contain: layout`, `transform`, `filter`, `perspective`, `backdrop-filter` or `will-change`
     to `.page` / `.skinBody` / `main` — any of those would turn them into a containing block and drag
     `.alphaPicker-fixed-right`, and the whole `position:fixed` app bar if applied to an ancestor of `header`.
     (The source comment at `components/viewManager/viewContainer.scss:9-11` documents exactly this bug.)
   - `.backgroundContainer` → `contain: strict`, `.backdropContainer` → `contain: size layout style`.
   - **Page scrolling happens on `<body>`** (`overflow: hidden auto`), not on `main`. A sticky/scroll-reactive
     header must key off `window` scroll, which is what `useScrollTrigger` already does.

7. **z-index stack (measured):** `.backdropContainer` −1 · `.backgroundContainer` auto · legacy `.skinHeader` 999 ·
   `.alphaPicker-fixed-right` **1099** (`theme.zIndex.appBar - 1`) · legacy `.mainDrawer` 1099 ·
   `header.MuiAppBar-root` **1100** · `.MuiDrawer-root` **1200** · `.MuiPopover-root` / `.MuiMenu-root` **1300** ·
   `.docspinner` 9999999. `#reactRoot` creates no stacking context; `div.MuiBox-root` (AppLayout root) is
   `position:relative; z-index:auto`, so it does not either — keep it that way.

8. **Hashed emotion classes.** Every `sx`/styled rule compiles to `css-XXXXXXX` in `<head>`. The two toolbars are
   distinguishable **only** by hash (`css-1tmqktv` vs `css-133e01t`) or by structure. Use
   `header > .MuiToolbar-root:first-child` / `:nth-child(2)`, or `:has()` anchors (below). Same for
   `div.MuiBox-root` — there are five different ones in the app bar with identical class lists.

9. **Localized `aria-label`/`title`.** `aria-label="Otwórz menu"`, `"Menu użytkownika"`, `"Szukaj"`,
   `title="Filter"` etc. all follow the UI language. Never key selectors on them — use
   `svg[data-testid="…"]` or `href` instead.

10. **The legacy shell is still in the DOM** (`.skinHeader`, `.mainDrawer`, `.mainDrawerHandle`, `#loginPage`),
    inside a `display:none` wrapper. Styling them does nothing in the modern layout but will affect the legacy
    layout if a user switches — keep legacy rules behind `html:not(.layout-tv) .skinHeader` style guards or a
    separate file.

---

## Theming hooks

**`--jf-*` variables consumed in this subsystem** (measured on `html.layout-desktop[data-theme="dark"]`).
They are defined on `:root`/`html` by MUI `cssVariables` with `cssVarPrefix:'jf'` and
`colorSchemeSelector:'[data-theme="%s"]'` (`src/themes/index.ts:12-28`). Redefining them on
`html`, `:root` or `[data-theme]` retints the entire MUI shell in one place:

| variable | value (dark) | where it lands here |
|---|---|---|
| `--jf-palette-AppBar-defaultBg` | `#202020` | `header.MuiAppBar-colorDefault` background (scrolled) |
| `--jf-palette-background-default` | `#101010` | `.backgroundContainer` |
| `--jf-palette-background-paper` | `#202020` | drawer paper, all menu/popover papers, avatar bg when an image exists |
| `--jf-palette-primary-main` | `#00a4dc` | active nav item, Play-all button, `MuiToggleButton` selected, SyncPlay badge |
| `--jf-palette-primary-dark` | `rgb(0,114,154)` | avatar fallback background |
| `--jf-palette-text-primary` | `#fff` | `MuiAppBar-colorTransparent` text (`themes/_base/theme.ts:63-65`) |
| `--jf-palette-text-secondary` | `rgba(255,255,255,.7)` | drawer secondary text (version), subheader |
| `--jf-palette-divider` | `rgba(255,255,255,.12)` | `hr.MuiDivider-root`, `MuiButtonGroup` separators |
| `--jf-palette-action-hover` | `rgba(255,255,255,.08)` | nav button / menu item hover |
| `--jf-palette-action-selected` | `rgba(255,255,255,.16)` | item-count `MuiChip` background |
| `--jf-palette-action-selectedOpacity` | `0.2` | `.Mui-selected` drawer row tint |
| `--jf-zIndex-appBar` / `-drawer` / `-modal` | `1100` / `1200` / `1300` | the stack above |
| `--jf-shadows-1` | `0 2px 1px -1px …` | app bar elevation when scrolled |
| `--jf-shape-borderRadius` | `4px` | menu papers, chips, buttons |
| `--jf-spacing` | `8px` | all `Stack`/`Box` gaps in the toolbars |
| `--jf-palette-common-background` / `-onBackground` | `#000` / `#fff` | MUI channel math |
| `--jf-palette-secondary-main`, `-error-main`, `-starIcon-main`, `-Chip-defaultBorder` | `#00a4dc`, `#c62828`, `#f2b01e`, `#616161` | badges, chips |

Typography defaults worth knowing: `font-family: "Noto Sans", sans-serif`, `button { text-transform: none }`,
`h1 1.8rem / h2 1.5rem / h3 1.17rem` (`themes/_base/theme.ts:37-51`). The library title uses `h2`.

**Classes toggled by JS (use as state selectors):**

| class | toggled when | on |
|---|---|---|
| `MuiAppBar-colorTransparent` ⇄ `MuiAppBar-colorDefault` | `scrollTop === 0` ⇄ `> 0` | `header.MuiAppBar-root` |
| `MuiPaper-elevation0` ⇄ `MuiPaper-elevation1` | same trigger | `header.MuiAppBar-root` |
| `MuiButton-colorInherit` ⇄ `MuiButton-colorPrimary` | nav item is the current library | nav `<a>` |
| `Mui-selected` | current drawer row / current library-view menu item | `.MuiListItemButton-root`, `.MuiMenuItem-root` |
| `Mui-disabled` | search button on `/search`; pagination at first/last page | `a.MuiIconButton-root`, pagination buttons |
| `MuiModal-hidden` | menu/drawer is closed (they are `keepMounted`) | `#app-*-menu`, `.MuiDrawer-root` |
| `MuiBadge-invisible` | SyncPlay inactive / no filters set | `.MuiBadge-badge` |
| `aria-hidden="true"` on `#reactRoot` | any modal open | `#reactRoot` |
| `body[style*="overflow: hidden"]` | any modal open | `body` |

**Useful `:has()` / `:not()` anchors (Chromium/Firefox/Safari all ship `:has()`; Jellyfin 12 targets evergreen):**

```css
/* library route = two-row app bar */
header.MuiAppBar-root:has(> .MuiToolbar-root + .MuiToolbar-root) { … }
/* single-row app bar (home, details, search, prefs) */
header.MuiAppBar-root:not(:has(> .MuiToolbar-root + .MuiToolbar-root)) { … }
/* the AppToolbar row, whatever its hash */
header .MuiToolbar-root:has(.MuiAvatar-root) { … }
/* the LibraryToolbar row */
header .MuiToolbar-root:has(> .MuiStack-root .MuiButtonGroup-root) { … }
/* mobile/tablet (hamburger present) without a media query */
header .MuiToolbar-root:has(svg[data-testid="MenuIcon"]) { … }
/* desktop (nav present) */
header .MuiToolbar-root:has(a.MuiButton-root[href="#/"]) { … }
/* details page (transparent bar over a backdrop) */
body:has(#itemDetailPage:not(.hide)) header.MuiAppBar-root { … }
/* a menu is open */
body:has(.MuiModal-root:not(.MuiModal-hidden)) header.MuiAppBar-root { … }
```

**Where your CSS lands.** Dashboard → General → Custom CSS is rendered by
`src/components/CustomCss.tsx:13` as a `<style>` inside `#reactRoot` (after `link[href="themes/<id>/theme.css"]`),
i.e. after every `<head>` sheet including emotion. Equal specificity therefore wins for you,
and `!important` beats the source's `!important`. The per-user "custom CSS" setting renders a second
`<style>` right after it. Verified: the harness `--inject` reproduces this by appending the last `<style>` to `<body>`.

---

## Netflix-relevance notes

| Netflix UI element | Jellyfin 12.1 modern equivalent | feasibility in pure CSS |
|---|---|---|
| Top bar: transparent over the hero, fading to solid black on scroll | `header.MuiAppBar-colorTransparent` → `.MuiAppBar-colorDefault` at `scrollTop > 0` | **Free.** The state machine already exists. Give `colorTransparent` a `linear-gradient(180deg, rgba(0,0,0,.7), transparent)` and `colorDefault` `#141414`, add `transition: background-color .4s` on `header.MuiAppBar-root`. Netflix's *gradual* opacity ramp is not reproducible — the swap is binary at 0px. |
| Bar height ~68px desktop / 46px mobile | fixed dense 48px both | **Free**, via `min-height` on the toolbars; the spacer auto-follows. Remember `AppOverrides.scss:34` hard-codes `-48px` for the mobile details backdrop. |
| Red "NETFLIX" wordmark, left | `a.MuiButton-root[href="#/"]`: `<img>` logo + server-name text | **Partly.** You can hide the `<img>` (`.MuiButton-startIcon { display:none }`), hide the text with `font-size:0`, and paint a wordmark via `background-image`/`::before` on the anchor — but the server name is real text you cannot replace with the *server's* branding image from CSS. Keeping the name and styling it as a wordmark (tight tracking, brand red, uppercase) is the honest option. |
| Nav row "Home · TV Shows · Movies · New & Popular · My List" | `UserViewNav` buttons: Favorites + user views, `>= md` only | **Mostly free.** Order and labels come from the server's library list, not CSS. Active item = `.MuiButton-colorPrimary` → restyle as white-bold vs `rgba(255,255,255,.7)`. Netflix has no icons — hide `.MuiButton-startIcon`. "My List" ≈ the Favorites button (`[href="#/home?tab=1"]`). |
| Nav collapses to a "Browse ▾" dropdown < 900px | at `< md` Jellyfin drops the nav **entirely** and shows a hamburger drawer instead | **Impossible in CSS.** The nav is not rendered below `md` — there is nothing to restyle. Tablet (820px) shows only hamburger + icons. Accept the drawer, or style the drawer to look like Netflix's mobile sheet. |
| Search: icon that expands into an inline input | icon link to `/search`; `/search` is a **legacy page** with `.searchFields > #searchTextInput` | **Impossible** (it is a route change, not an expansion). You can style `#searchPage .searchFields` into a Netflix-looking bordered field and re-skin `header a[href^="#/search"]`. |
| Profile avatar + caret, dropdown with profiles | `button:has(.MuiAvatar-root)` + `#app-user-menu` | **Free.** Avatar is 40×40 circular → Netflix uses a 32×32 **rounded square**: `header .MuiAvatar-root { width:32px; height:32px; border-radius:4px }`. The caret does not exist; add one with `::after` on the wrapper `.MuiBox-root`. Menu: restyle `#app-user-menu .MuiMenu-paper` (dark, hairline border, no radius). |
| Notifications bell | none | Nothing to style (SyncPlay/Cast icons occupy that slot; hide them with `header .MuiIconButton-root:has(svg[data-testid="GroupsIcon"]) { display:none }` if you want the Netflix silhouette). |
| Library header ("Movies ▾" + genre dropdown, sticky) | `LibraryToolbar` row 2: `button[aria-controls="library-view-menu"]` with `.MuiTypography-h2` + `ArrowDropDownIcon`, plus count chip, play/shuffle, filter/sort/view, pagination | **Close.** Netflix has only the title + a genre select; Jellyfin adds 6 more controls. Hide the chip and the play group, keep filter/sort/view as ghost buttons. The row is already sticky — it is part of the `position:fixed` app bar, not a separate sticky element. |
| Netflix "Movies / TV Shows" as top-level routes | the same: `#/movies`, `#/tv` per library id | Free. |
| A–Z index rail | `.alphaPicker-fixed-right` | Netflix has no equivalent. Either hide it (`display:none`) — note this loses functionality — or restyle it as a thin translucent rail. Its `top` is a hard-coded `96px`/`144px` in `sx` (`AlphabetPicker.tsx:36-40`), so **if you change the app bar height you must re-set `top` yourself**. |
| Hero/billboard flush to the top of the viewport, bar floating over it | app bar is `position:fixed` **plus** a 48/96px spacer that pushes `main` down | **Free but needs care:** `header.MuiAppBar-root + div[aria-hidden="true"] { height:0 !important }` to let the hero go under the bar. Do this only for the routes where you have a hero (`body:has(#itemDetailPage)` / `#indexPage`), otherwise every page loses its top offset. Mobile details already does this natively via `AppOverrides.scss:33-35`. |
| Mobile bottom tab bar (Home / New & Hot / Downloads / My Netflix) | does not exist — Jellyfin uses a left drawer | **Impossible in pure CSS** (no elements to move; `position:fixed` on the drawer list would break the modal). Restyle the drawer instead: `.MuiDrawer-paper` is currently **content-width (191px @390)** — set an explicit `width: 80vw` and a `#141414` background for a Netflix-ish sheet, and darken `.MuiDrawer-modal .MuiModal-backdrop` to `rgba(0,0,0,.75)`. |
| Netflix red `#E50914` accent | `--jf-palette-primary-main: #00a4dc` | **Free and global:** redefine `--jf-palette-primary-main` (and `-primary-dark`, `-secondary-main`) on `html`. This retints active nav, Play-all, toggles and badges in one declaration. |
| Netflix near-black `#141414` page / `#000` bar | `--jf-palette-background-default: #101010`, `--jf-palette-AppBar-defaultBg: #202020` | Free via the same variables (plus `.backgroundContainer`, which reads `background.default`). |
| Netflix font (Netflix Sans) | `"Noto Sans", sans-serif` from the theme | Substitutable with any webfont you `@import` in the custom CSS; the real face is proprietary. |

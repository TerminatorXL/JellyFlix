# Legacy + TV app shell: `.skinHeader`, drawer, tabs, page frame (Jellyfin 12.1)

Source paths are relative to `_ref/jellyfin-web/`. Every number marked *(live)* was measured with
`tools/pw.sh tools/dom.mjs` against the 12.1 test server; everything else is read from source.

## Where it appears (routes, layouts, breakpoints)

**Layout modes.** `LegacyLayoutModes = { desktop-legacy, mobile-legacy, tv }` (`src/constants/layoutMode.ts:19-24`).
TV is a *legacy* layout — `layoutManager.modern === false` — so the TV layout uses exactly this shell, not the MUI one.
`layoutManager` puts `layout-desktop | layout-mobile | layout-tv` on `<html>` (`src/components/layoutManager.js:8-16`);
`<html>` also carries `data-theme="dark|light|appletv|blueradiance|purplehaze|wmc"` (MUI `colorSchemeSelector`).

**Who renders it.** `AppHeader` is mounted by `RootAppLayout` for *every* layout
(`src/RootAppRouter.tsx:52-63`) and emits empty `.mainDrawer` / `.skinHeader` / `.mainDrawerHandle`
(`src/components/AppHeader.tsx:20-26`). `src/scripts/libraryMenu.js` (side-effect import, `AppHeader.tsx:10-13`)
fills them with HTML strings. **The header exists in the modern layout and on the new dashboard too**, but is
wrapped in `<div style="display:none">` (`RootAppRouter.tsx:59`, `AppHeader.tsx:20`) — see *Legacy vs modern*.

| profile | shell visible | header geometry *(live, `#/home`)* | root font-size *(live)* |
|---|---|---|---|
| legacy-desktop 1920×1080 | yes | `.skinHeader` `1920×64.4`, `position:fixed`, tabs overlap the icon row | `14.88px` (`html{font-size:93%}`) |
| legacy-mobile 390×844 | yes | `.skinHeader` `390×106.8`, `position:fixed` + headroom, tabs on a 2nd row | `14.4px` (`.layout-mobile{90%}`) |
| tv 1920×1080 | yes | `.skinHeader` `1920×87.6`, **`position:relative`** (in flow), tabs 55% wide, centred | `20px` (`.layout-tv{125%}`) |
| modern-desktop / modern-mobile | **no** (`display:none` wrapper) | elements still in DOM, `0×0` | same per `layout-*` class |
| any layout, `#/dashboard`, `#/metadata`, `#/configurationpage` | **no** (`display:none` wrapper) | MUI `AppBar` + `MuiDrawer` instead | — |

**Breakpoints** (all `em` media queries resolve against the 16px initial font size, *not* against the
93%/90%/125% root size):

* `min-width: 100em` (1600px) — single-row header: `.headerTabs{align-self:center;width:auto;margin-top:-4.3em}`,
  `.libraryPage:not(.noSecondaryNavPage){padding-top:4.6em}`, `.headerTop{padding:.8em}` (`src/styles/librarybrowser.scss:386-415`).
* `max-width: 100em` — two-row header: `.sectionTabs{font-size:83.5%}`, `.withSectionTabs .headerTop{padding-bottom:.55em}`
  (`librarybrowser.scss:372-384`). Verified live at 390px.
* `max-width: 37.5em` (600px) — `.headerSelectedPlayer{display:none}` (`librarybrowser.scss:422-426`).
* `min-width: 40em` (640px) — the dead `.dashboardDocument` drawer-as-sidebar block (`librarybrowser.scss:333-370`).

**Routes exercised:** `home`, `movies`, `shows` (tabs present, `body.withSectionTabs`);
`details-movie|series|season|episode` (`.skinHeader.semiTransparent`, `.headerTabs.hide`);
`search`, `prefs`, `list` (`.noSecondaryNavPage`); `dashboard` (shell hidden).

## DOM skeleton (indented tree of the real markup, trimmed)

Legacy desktop, `#/home`, logged in *(live)*:

```
html.layout-desktop [data-theme="dark"]                       font-size 14.88px
  body.libraryDocument.withSectionTabs                        overflow: hidden auto
    div#reactRoot
      div.backdropContainer                                   fixed, z-index -1
      div.backgroundContainer                                 fixed, contain: strict, bg #101010
      div                                                     <- AppHeader wrapper, NO class
                                                                 (inline style="display:none" in modern/dashboard)
        div.mainDrawer.transition.touch-menu-la[.drawer-open][.hide]
                                                              fixed, z 1099, contain: strict,
                                                              inline width:320px; left:-320px; transform
          div.mainDrawer-scrollContainer.scrollContainer.focuscontainer-y.scrollY
            div[style="height:.5em;"]
            a.navMenuOption.lnkMediaFolder.emby-button [is=emby-linkbutton href="#/home"]
              span.material-icons.navMenuOptionIcon.home
              span.navMenuOptionText                          "Start"
            div.customMenuOptions                             <- webSettings menuLinks
            div.libraryMenuOptions
              h3.sidebarHeader                                "Multimedia"
              a.lnkMediaFolder.navMenuOption.emby-button[.navMenuOption-selected] [data-itemid=<viewId>]
                span.material-icons.navMenuOptionIcon.movie
                span.sectionName.navMenuOptionText            "Filmy"
            div.adminMenuOptions                              (admins only)
              h3.sidebarHeader ; a.navMenuOption.lnkManageServer ; a.navMenuOption.editorViewMenu
            div.userMenuOptions
              h3.sidebarHeader ; a.navMenuOption.btnSelectServer? ; .btnSettings ; .btnLogout ; .exitApp?
        div.skinHeader.focuscontainer-x.skinHeader-withBackground.skinHeader-blurred
                      [.semiTransparent][.noHomeButtonHeader][.headroomDisabled]
                      [.headroom.headroom--top|--not-top.headroom--pinned|--unpinned]   <- mobile only
                                                              fixed (relative on TV), z 999,
                                                              contain: layout style paint
          div.flex.align-items-center.flex-grow.headerTop
            div.headerLeft                                    flex, flex-grow 1, overflow hidden
              button.headerButton.headerButtonLeft.headerBackButton[.hide].paper-icon-button-light[.show-focus]
                span.material-icons.arrow_back                (chevron_left on Safari)
              button.headerButton.headerHomeButton.barsMenuButton.headerButtonLeft[.hide]...
                span.material-icons.home
              button.headerButton.mainDrawerButton.barsMenuButton.headerButtonLeft[.hide]...
                span.material-icons.menu
              h3.pageTitle[.pageTitleWithLogo.pageTitleWithDefaultLogo]
            div.headerRight                                   flex, justify-content flex-end
              button.headerSyncButton.syncButton.headerButton.headerButtonRight[.hide]...
              span.headerSelectedPlayer
              button.headerAudioPlayerButton.audioPlayerButton...[.hide]
              button.headerCastButton.castButton...[.castButton-active][.hide]
              button.headerButton.headerButtonRight.headerSearchButton[.hide]...
              button.headerButton.headerButtonRight.headerUserButton[.headerUserButtonRound][.hide]
                span.material-icons.person   |   div.headerButton.headerButtonRight
                                                    .paper-icon-button-light.headerUserButtonRound
                                                    [style="background-image:url('...')"]
              div.currentTimeText[.hide]                      <- un-hidden only on TV (clock)
          div.headerTabs.sectionTabs[.hide]
            div.tabs-viewmenubar.emby-tabs.focusable.scrollX[.hiddenScrollX][.smoothScrollX] [is=emby-tabs data-index=N]
              div.emby-tabs-slider [style="white-space:nowrap;"]
                button.emby-tab-button.emby-button[.emby-tab-button-active][.show-focus][.lastFocused]
                       [is=emby-button data-index=0]
                  div.emby-button-foreground                  "Start"
                a.emby-tab-button.emby-button [is=emby-linkbutton href=...]   <- when the tab has t.href
        div.mainDrawerHandle                                  fixed, z 1, width .8em, edge-swipe target
      div.mainAnimatedPages.skinBody                          <- viewManager pages live here (legacy only)
        div#indexPage.page.homePage.libraryPage.allLibraryPage.pageWithAbsoluteTabs.withTabs.mainAnimatedPage
                                                              absolute, contain: style size !important
          div#homeTab.tabContent.pageTabContent.is-active [data-index=0]
          div#favoritesTab.tabContent.pageTabContent [data-index=1]      (display:none)
      div.skinBody                                            <- React <Outlet/> pages (legacy)
      link[href="themes/<id>/theme.css"]                      <- ThemeCss
      style                                                   <- branding CustomCss  (LAST)
      style                                                   <- per-user CustomCss  (LAST)
    div.docspinner.mdl-spinner                                fixed, z 9999999
    div.appfooter                                             fixed, z 1201 !important
    div.tmla-mask[.hide][.backdrop]                           fixed, z 1098, appended to <body> by NavDrawer
```

TV differences *(live)*: `.skinHeader` is `position:relative` and sits in normal flow (so `.skinBody` starts at
`y = 87.6`), `.mainDrawer` keeps `.hide` (`display:none`), `.mainDrawerButton` and `.headerCastButton` are `.hide`,
`.currentTimeText` is visible, every button/tab gains `.show-focus`, and `.headerTabs` is `width:55%`.

Mobile differences *(live)*: `.skinHeader` gains `headroom headroom--top headroom--bottom`, and after scrolling
`headroom--not-top headroom--unpinned` → `transform: translateY(-100%)` (`matrix(1,0,0,1,0,-106.8)`).

## Selector table

| selector | what it is | layout(s) | safe to style? | notes (file:line) |
|---|---|---|---|---|
| `#reactRoot > div:has(> .skinHeader)` | unclassed AppHeader wrapper | all | read-only anchor | gets inline `display:none` in modern + dashboard — `AppHeader.tsx:20`, `RootAppRouter.tsx:59` |
| `.skinHeader` | the whole top bar | legacy, mobile, tv | **yes** | `fixed; right/left 0; top 0; z-index 999; flex-direction:column; contain: layout style paint; transition: background .5s` — `librarybrowser.scss:212-226` |
| `.layout-tv .skinHeader` | TV variant | tv | yes | `position: relative` on purpose — `librarybrowser.scss:228-232` |
| `.skinHeader-withBackground` | opaque-bg modifier | all | **yes, main hook** | `background-color: var(--jf-palette-AppBar-defaultBg,#202020); background-image: var(--jf-palette-AppBar-gradient,none)` — `themes/_base/_theme.scss:88-92`; always added — `libraryMenu.js:57` |
| `.skinHeader.semiTransparent` | transparent-over-backdrop | all | yes, but see gotchas | `background-color: var(--jf-palette-AppBar-transparentBg, rgba(0,0,0,.4)); background-image:none; backdrop-filter:none !important`; `.layout-tv &{background:none}` — `_theme.scss:100-108` |
| `.skinHeader-blurred` | **pure hook, zero stock CSS** | all | **yes — free real estate** | only added, never styled — `libraryMenu.js:58`; grep confirms no rule anywhere |
| `.skinHeader.headroomDisabled` | set on dashboard pages, non-mobile | all | yes | `libraryMenu.js:578-582`; no stock CSS |
| `.skinHeader.osdHeader` | video OSD header (different element) | all | separate subsystem | `apps/modern/routes/video/index.tsx:52`, `styles/videoosd.scss:37-55` |
| `.hiddenViewMenuBar .skinHeader` | `display:none` | — | **dead in 12.1** | CSS exists (`librarybrowser.scss:234-236`), nothing sets the class |
| `.headerTop` | icon row inside the header | all | yes | `padding:.54em 0`; `.8em` at ≥100em; `.withSectionTabs &{padding-bottom:.55em}` at <100em — `librarybrowser.scss:238-240, 373-375, 387-389` |
| `.headerLeft` | back/home/menu/title group | all | yes | `flex; align-items:center; flex-grow:1; overflow:hidden` — `librarybrowser.scss:153-159` |
| `.headerRight` | sync/player/cast/search/user/clock | all | yes | `flex; justify-content:flex-end` — `librarybrowser.scss:161-165` |
| `.noHeaderRight .headerRight` | hides right group | all | yes | `display:none !important` — `librarybrowser.scss:167-170`; nothing sets `.noHeaderRight` in 12.1 |
| `.noHomeButtonHeader .headerHomeButton` | hides home icon on home | all | yes | `display:none !important`; class toggled by `apps/legacy/controllers/home.js:15,20`, `apps/modern/routes/home.tsx:130,138`, wizard controllers |
| `.headerButton` | shared class on every header icon | all | yes | only `flex-shrink:0` — `librarybrowser.scss:145-147` |
| `.headerButtonLeft` / `.headerButtonRight` / `.barsMenuButton` | position markers | all | **yes — no stock CSS** | pure hooks, great for Netflix reordering |
| `.paper-icon-button-light` | actual button styling of every header icon | all | yes | `padding:.556em; border-radius:50%; overflow:hidden; transition:.2s; outline:none !important` — `elements/emby-button/emby-button.scss:86-118`; icon is `1.6695em` — `:134-141` |
| `.headerBackButton`, `.headerHomeButton`, `.mainDrawerButton`, `.headerSearchButton`, `.headerUserButton`, `.headerCastButton`, `.headerSyncButton`, `.headerAudioPlayerButton` | individual buttons | all | yes | `libraryMenu.js:39-50`; each is `display:none` via `.hide` until enabled |
| `.headerUserButton.headerUserButtonRound` | avatar mode | all | yes | inner `div` gets inline `background-image` — `libraryMenu.js:191-199`, CSS `librarybrowser.scss:138-143` |
| `.castButton-active` | cast connected | non-tv | yes | `libraryMenu.js:528`; no stock CSS |
| `.headerSelectedPlayer` | remote player name | all | yes | `max-width:10em; white-space:nowrap`, hidden <600px — `librarybrowser.scss:84-89, 417-426` |
| `.currentTimeText` | clock | **tv only** (`.hide` elsewhere) | yes | `padding: 0 .8em` — `librarybrowser.scss:1482-1485`; `libraryMenu.js:201-210` |
| `.pageTitle` | `h3`, title *or* logo | all | yes | `inline-flex; height:1.7em; margin-left:.5em`, `font-size:1.17em` from `h3` — `librarybrowser.scss:172-185`, `site.scss:104-107` |
| `.pageTitleWithLogo` | logo mode (element text is empty) | all | yes | `background-position:left center; background-size:contain; width:13.2em` (=230px desktop, 309px TV) — `librarybrowser.scss:201-210` |
| `.pageTitleWithDefaultLogo` | default Jellyfin banner | all | **yes — brand swap point** | `background-image:url(banner-light.png)`; `.layout-tv &{url(icon-transparent.png)}` — `_theme.scss:110-123` |
| `.headerTabs` | tab strip container | all | yes | `align-self:center;width:auto;margin-top:-4.3em` ≥100em (overlays `.headerTop`) — `librarybrowser.scss:391-398` |
| `.sectionTabs` | same element, second class | all | yes | `width:100%; text-align:center`; `font-size:83.5%` <100em; `.layout-tv &{width:55%}` (100% <100em) — `librarybrowser.scss:79-82, 242-248, 377-383` |
| `.headerTabs.hide` | no tabs on this page | all | — | `.hide{display:none !important}` — `index.html:61-68`; toggled by `maintabsmanager.js:87,100` |
| `body.withSectionTabs` | a page with tabs is showing | all | **yes — best tab-state anchor** | `maintabsmanager.js:84,133` |
| `[is="emby-tabs"].tabs-viewmenubar` | the tab scroller | all | yes | classes `emby-tabs focusable` added in JS — `elements/emby-tabs/emby-tabs.js:156-160` |
| `.emby-tabs-slider` | inline-block strip of buttons | all | careful | inline `style="white-space:nowrap"` — `maintabsmanager.js:107`; `position:relative` — `emby-tabs.scss:30-32`; scroller may add inline `transform/will-change/transition` — `lib/scroller/index.js:772-773` |
| `.emby-tab-button` | one tab | all | **yes** | `padding:1.5em; font-weight:600; border-radius:0; overflow:hidden; background:transparent` — `emby-tabs.scss:1-22`; colour `var(--jf-palette-text-secondary)` — `_theme.scss:486-488` |
| `.emby-tab-button-active` | selected tab | all | **yes** | colour only (`var(--jf-palette-text-primary)`), **no underline/indicator exists** — `_theme.scss:490-492` |
| `.emby-tab-button:hover`, `.emby-tab-button.show-focus:focus` | hover/TV focus | all / tv | yes | colour `var(--jf-palette-secondary-main)` — `_theme.scss:494-497`; TV also `transform:scale(1.3)!important; background:0!important` — `emby-tabs.scss:24-28` |
| `.emby-tab-button.lastFocused` | last focused tab (TV) | tv | yes | `emby-tabs.js:117` |
| `.hidingAnimatedTab` | tab-swap transition | all | yes | `visibility:hidden` — `librarybrowser.scss:428-430` |
| `.mainDrawer` | the nav drawer | legacy desktop/mobile (`.hide` on TV) | yes, with care | `background-color: var(--jf-palette-background-default)` — `_theme.scss:467-470` |
| `.touch-menu-la` | added by NavDrawer on init | same | yes | `fixed; top/bottom 0; contain:strict; z-index:1099; background-color:#fff; will-change:transform; transition:transform 40ms, left 260ms` — `lib/navdrawer/navdrawer.scss:1-21`, class added `navdrawer.js:205` |
| `.mainDrawer.transition` | slower transition while not dragging | same | yes | `transform 240ms` — `navdrawer.scss:23-29` |
| `.mainDrawer.drawer-open` | open state | same | **yes — best drawer anchor** | `box-shadow:2px 0 12px rgba(0,0,0,.4)` — `navdrawer.scss:31-33`; toggled `navdrawer.js:261,272` |
| `.mainDrawer-scrollContainer.scrollContainer.scrollY` | inner scroller | same | yes | `flex-grow:1; overflow-y:auto; padding-bottom:10vh` — `navdrawer.scss:35-37`, `librarybrowser.scss:329-331`, `scrollstyles.scss:27-30` |
| `.navMenuOption` | one drawer row (`<a is=emby-linkbutton>`, also has `.emby-button`) | same | yes, but everything is `!important` | `display:flex!important; font-weight:400!important; margin:0!important; border-radius:0!important; padding:.9em 0 .9em 2.4em!important` — `librarybrowser.scss:254-271` |
| `.navMenuOption:hover` | hover | same | yes | `var(--jf-palette-action-hover)` — `_theme.scss:472-474` |
| `.navMenuOption-selected` | active library | same | yes, needs `!important` | `background: var(--jf-palette-primary-main) !important; color: var(--jf-palette-primary-contrastText)` — `_theme.scss:476-479`; toggled `libraryMenu.js:537-565` |
| `.navMenuOptionIcon` / `.navMenuOptionText` | icon / label | same | yes | `margin-right:1em` / `line-height:1.35em; white-space:nowrap; text-overflow:ellipsis` — `librarybrowser.scss:273-288, 84-89` |
| `.lnkMediaFolder[data-itemid]` | library rows + dashboard/editor/settings rows | same | yes | `data-itemid` is the library id or `dashboard|editor|settings|logout|selectserver|exitapp` — `libraryMenu.js:324-356, 476-480` |
| `.sidebarHeader` | drawer group heading (`h3`) | same | yes | `font-size:1em; margin:1em 0 .5em; padding-left:1.2em` — `librarybrowser.scss:290-301` |
| `.libraryMenuOptions`, `.customMenuOptions`, `.adminMenuOptions`, `.userMenuOptions` | drawer groups | same | **yes — pure hooks** | built in `libraryMenu.js:321-363`; no stock CSS |
| `.mainDrawerHandle` | invisible edge-swipe strip | all | yes | `fixed; top/bottom 0; z-index:1; width:.8em; left:0` — **defined in `index.html:70-86`**, not in any .scss |
| `.tmla-mask` / `.tmla-mask.backdrop` | drawer scrim, child of `<body>` | same | yes | `fixed; inset; z-index:1098; opacity 0→1; background rgba(0,0,0,.3); contain:strict` — `navdrawer.scss:39-51`; created `navdrawer.js:213-217` |
| `body.bodyWithPopupOpen` | drawer open on mobile | mobile | yes | `overflow-y:hidden !important` — `site.scss:96-98`; `libraryMenu.js:303-307` |
| `body.libraryDocument` / `body.hideMainDrawer` | page-type flags | all | yes | `libraryMenu.js:586-607`; `.hideMainDrawer .mainDrawerButton{display:none}` — `librarybrowser.scss:149-151` |
| `.skinBody` | page host | all | careful | no stock CSS except `.dashboardDocument .skinBody` (absolute inset + `pointer-events:none`) — `librarybrowser.scss:303-320` and `position:unset!important` — `apps/dashboard/AppOverrides.scss:18-20` |
| `.mainAnimatedPages.skinBody` | viewManager host | all | careful | in **legacy** it is `#reactRoot > .mainAnimatedPages`; in modern/dashboard it is `main > .mainAnimatedPages` |
| `.page.mainAnimatedPage` | one legacy view | all | careful | `contain: style size !important` — `site.scss:88-90`; `position:absolute` |
| `.libraryPage` | most content pages | **shared with modern** | careful | `padding-top:7em!important`; `:not(.noSecondaryNavPage)` `7.5em!important`; `4.6em` ≥100em — `librarybrowser.scss:91-93, 111-113, 400-402` |
| `.pageWithAbsoluteTabs:not(.noSecondaryNavPage)` | tabbed pages ≥100em | shared | careful | `padding-top:6.7em!important` → **99.7px** *(live, legacy-desktop)* — `librarybrowser.scss:404-406` |
| `.itemDetailPage` | details view | shared | careful | `padding-top:0!important`; `.layout-tv &{4.2em!important}` → 84px *(live)* — `librarybrowser.scss:95-101` |
| `.standalonePage` / `.wizardPage` | login, select-server / wizard | legacy | careful | `4.5em!important` (67px live) / `7em!important` — `librarybrowser.scss:103-109` |
| `.absolutePageTabContent` | absolutely-positioned tab panel | legacy | careful | `position:absolute; inset 0 0 0; z-index:1; top:6.9em!important` (`5.7em` ≥100em); `margin:0!important` — `librarybrowser.scss:115-124, 408-410` |
| `.pageTabContent:not(.is-active)` / `.tabContent:not(.is-active)` | hidden panels | all | leave alone | `display:none !important` — `librarybrowser.scss:126-128`, `emby-tabs.scss:34-36` |
| `.focuscontainer-x`, `.focuscontainer-y`, `.focuscontainer-left/right/down`, `.focusable` | **JS spatial-navigation hooks, zero CSS** | tv mostly | do not repurpose | `components/focusManager.js:47-58, 153-180` |
| `.show-focus` | added at element creation when `layoutManager.tv` | tv | yes | `emby-button.js:42`, `paper-icon-button-light.js:11`, `elements/emby-button/Button.tsx:31` |
| `.layout-tv .padded-top-focusscale` / `-bottom-` | room for the TV focus scale | tv | yes | `padding 1.5em; margin -1.5em` — `librarybrowser.scss:1354-1362` |
| `.hide`, `.hide-desktop`, `.hide-mobile`, `.hide-tv`, `.hide-mouse-idle` | global hide helpers | all | leave alone | `display:none !important` in the `<head>` style — `index.html:61-68` |

## Existing styling that will fight a custom theme

**Containment / clipping (the biggest one).**

* `.skinHeader { contain: layout style paint }` (`librarybrowser.scss:221`, computed `contain: content` *(live)*).
  `paint` **clips every descendant to the header box** and makes the header a containing block for
  `position: fixed` children. Any Netflix-style hover mega-menu, profile dropdown or search-expand drawn
  *inside* `.skinHeader` will be cut off. Fix: `.skinHeader { contain: none; }` (custom CSS is last, equal
  specificity wins) — accept the repaint cost, or render the overlay outside the header (impossible in pure CSS).
* `.mainDrawer` inherits `contain: strict` from `.touch-menu-la` (`navdrawer.scss:6`) — size containment, so the
  drawer can never size itself to its content; width comes from the inline style only.
* `.mainAnimatedPage { contain: style size !important }` (`site.scss:88-90`) — page height is not derived from
  content; you cannot make a legacy page grow.
* `.backgroundContainer { contain: strict }` (`site.scss:73-80`), `.backdropContainer { contain: size layout style }`.

**Inline styles set from JS (cannot be beaten without `!important`).**

| element | inline property | source |
|---|---|---|
| AppHeader wrapper `div` | `display: none` (modern + dashboard routes) | `AppHeader.tsx:20`, `RootAppRouter.tsx:59` |
| `.mainDrawer` | `width: <240..320>px`, `left: -<width>px` (`right` in RTL) | `navdrawer.js:206-211`; width = `clamp(240, screen.availWidth-50, 320)` — `libraryMenu.js:654-663` |
| `.mainDrawer` | `transform: translateX(<px>)` / `none` on open/close/drag | `navdrawer.js:220-226` — **do not animate `transform` yourself** |
| `.emby-tabs-slider` | `white-space: nowrap` | `maintabsmanager.js:107` |
| `.emby-tabs-slider` | `transform`, `will-change`, `transition` (scroller mode) | `lib/scroller/index.js:316,337,772-773` |
| `.pageTitle` | `background-image` (set to `null` on every title change) | `libraryMenu.js:745,771` |
| `.headerUserButtonRound > div` | `background-image: url(<avatar>)` | `libraryMenu.js:194` |
| drawer first child | `height: .5em` | `libraryMenu.js:323` |

**`!important` already in the stock cascade** (your override must also be `!important`, and custom CSS is the
last `<style>` in `<body>` so equal specificity + `!important` wins):

`.hide{display:none!important}` (`index.html:61-68`) · `.libraryPage/.itemDetailPage/.standalonePage/.wizardPage`
`padding-top !important` · `.page{padding-bottom:calc(env(safe-area-inset-bottom) + 5em)!important}` (`site.scss:119-126`)
· `.absolutePageTabContent{margin:0!important;top:…!important}` · `.pageTabContent:not(.is-active){display:none!important}`
· `.navMenuOption{display/font-weight/margin/border-radius/padding !important}` · `.navMenuOption-selected{background:…!important}`
· `.noHeaderRight .headerRight`, `.noHomeButtonHeader .headerHomeButton{display:none!important}`
· **`.skinHeader.semiTransparent{backdrop-filter:none!important}`** (`_theme.scss:103`) — re-enabling blur on the
transparent header needs `backdrop-filter: blur(x) !important` · `.emby-tab-button.show-focus:focus{transform:scale(1.3)!important;background:0!important}`
· `.paper-icon-button-light{outline:none!important}` · `.selectedMediaFolder{background-color:#f2f2f2!important}` (legacy dead rule)
· `.transparentDocument{background:none!important}` (`index.html:26-30`) · `.mainAnimatedPage{contain:style size!important}`
· `.dashboardDocument .mainDrawer{z-index/left/top/transform/box-shadow/width !important}` (`librarybrowser.scss:339-355`, dead in 12.1)
· `.layout-tv .scrollX::-webkit-scrollbar{height:0!important}`.

**JS-computed sizes.** Drawer width (above); TV tab centring via the `ScrollerFactory` (`emby-tabs.js:120-152`);
headroom translate (`src/styles/site.scss:146-157` + `headroom.js`, mobile only, `libraryMenu.js:251-253,635-638`);
`.emby-tabs` may become a native scroller (`scrollX hiddenScrollX smoothScrollX` added by
`lib/scroller/index.js:735-749`) instead of a transform scroller.

**Font-size cascade.** `html{font-size:93%}` (`styles/fonts.scss:6-11`) → 14.88px, beaten by
`.layout-mobile{90%}` → 14.4px and `.layout-tv{125%}` → 20px (`fonts.scss:43-51`) *(all live)*. Every `em` in the
shell scales with this; `em` **media queries do not** (they stay on 16px). Touch `html{font-size}` at your peril —
it rescales the whole shell, all page paddings and the drawer's em-based padding at once.

**Hashed emotion classes.** None inside this subsystem — the legacy shell is hand-written HTML strings. The
neighbouring MUI chrome (`header.MuiAppBar-root`, `.MuiDrawer-root`, `.MuiBox-root.css-1iogify`) belongs to the
modern/dashboard layouts; never target `css-*`.

**z-index stack (live + source).**

```
-1       .backdropContainer                       backdrop/backdrop.scss:8
auto     .backgroundContainer
0/1      .mainDrawerHandle (1)                    index.html:74
999      .skinHeader                              librarybrowser.scss:216
1000     subtitle settings / remote control       subtitlesettings.scss:7
1002     .slideshow*                              slideshow/style.scss:36
1098     .tmla-mask                               navdrawer.scss:43
1099     .mainDrawer / .touch-menu-la             navdrawer.scss:16
1200     MUI Drawer (modern/dashboard only)
1201     .appfooter / nowPlayingBar  !important   appFooter.scss:5
10000    .skipButton                              skipbutton.scss:7
99998/9  multiSelect
999998/9 dialogs (backdrop / dialog) !important   dialoghelper.scss:10,151
9999999  .docspinner, .toast                      loading.scss:277, toast.scss:7
1e8      .emby-button ripple                      emby-button.scss:169
```

A Netflix-style header that must sit above the now-playing bar needs `z-index > 1201`; above dialogs is not
advisable (they are `!important` at 999998).

## Theming hooks

**`--jf-*` variables consumed by this subsystem** (values read live on `legacy-desktop`, `data-theme="dark"`):

| variable | live value | where it lands | defined in |
|---|---|---|---|
| `--jf-palette-AppBar-defaultBg` | `#202020` | `.skinHeader-withBackground`, `.detailRibbon` | MUI `DEFAULT_COLOR_SCHEME` — `themes/_base/theme.ts:29-31` |
| `--jf-palette-AppBar-transparentBg` | `rgba(0,0,0,.4)` | `.skinHeader.semiTransparent` | `:root` in `themes/_base/_theme.scss:57-62` |
| `--jf-palette-AppBar-gradient` | `none` | `background-image` of `.skinHeader-withBackground` | `_theme.scss:57-62` — **set this to a gradient for the Netflix top fade** |
| `--jf-palette-background-default` | `#101010` | `html`, `.backgroundContainer`, `.mainDrawer`, `.drawer-open` | MUI |
| `--jf-palette-background-paper` | `#202020` | menus/dropdowns | MUI |
| `--jf-palette-background-defaultImage` | `none` | `html` / `.backgroundContainer` background-image | `_theme.scss:57-62` |
| `--jf-palette-primary-main` | `#00a4dc` | `.navMenuOption-selected`, `.emby-button.show-focus:focus` | MUI |
| `--jf-palette-primary-contrastText` | `rgba(0,0,0,.87)` | text on the selected drawer row | MUI |
| `--jf-palette-primary-mainChannel` | `0 164 220` | `.paper-icon-button-light:hover/:active` background | MUI |
| `--jf-palette-action-selectedOpacity` | `0.2` | same hover background alpha | MUI |
| `--jf-palette-secondary-main` | `#00a4dc` | tab hover/focus colour, input focus | MUI |
| `--jf-palette-text-primary` | `#fff` | `.emby-tab-button-active` | MUI |
| `--jf-palette-text-secondary` | `rgba(255,255,255,.7)` | `.skinHeader` + `html` colour, `.emby-tab-button` | MUI |
| `--jf-palette-action-hover` | `rgba(255,255,255,.08)` | `.navMenuOption:hover` | MUI |
| `--jf-palette-divider` | `rgba(255,255,255,.12)` | collapsible buttons | MUI |
| `--jf-card-borderRadius` | `0.2em` | cards (not the shell, but shared) | `_theme.scss:57-62` |

Redefining these on `:root` (or `:root[data-theme="dark"]` to beat MUI's own `[data-theme="dark"]` block, which has
specificity `(0,1,0)`) re-skins the header, drawer and tabs in one shot, with zero selector risk.

**Classes toggled by JS — use them as state selectors, never invent new ones**

* `<html>`: `layout-desktop | layout-mobile | layout-tv`, `transparentDocument` (`backdrop.js:300-310`), `data-theme`.
* `<body>`: `libraryDocument`, `hideMainDrawer`, `dashboardDocument`, `withSectionTabs`, `bodyWithPopupOpen`.
* `.skinHeader`: `skinHeader-withBackground`, `skinHeader-blurred`, `semiTransparent`, `headroomDisabled`,
  `noHomeButtonHeader`, `headroom`, `headroom--top|--not-top`, `headroom--pinned|--unpinned`,
  `headroom--bottom|--not-bottom`.
* `.mainDrawer`: `touch-menu-la`, `transition`, `drawer-open`, `hide`. `.tmla-mask`: `hide`, `backdrop`.
* rows: `navMenuOption-selected`. tabs: `emby-tab-button-active`, `lastFocused`, `scrollX/hiddenScrollX/smoothScrollX`.
* buttons: `show-focus` (TV only), `hide`, `castButton-active`, `headerUserButtonRound`.

**Useful `:has()` / `:not()` anchors** (all Chromium/WebKit/Firefox ≥121; WebOS/Tizen browsers may be older — keep
these as progressive enhancement, not as the only path):

```css
/* legacy/TV shell only — in modern & dashboard .mainAnimatedPages is nested under <main> */
body:has(> #reactRoot > .mainAnimatedPages.skinBody) { }

/* the unclassed AppHeader wrapper */
#reactRoot > div:has(> .skinHeader) { }

/* header currently showing tabs (equivalent to body.withSectionTabs, but scoped) */
.skinHeader:has(.headerTabs:not(.hide)) { }

/* header with nothing but the logo (home) */
.skinHeader:has(.pageTitleWithDefaultLogo) { }

/* drawer open — also usable as `body:has(.mainDrawer.drawer-open)` for page-level dimming */
body:has(.mainDrawer.drawer-open) { }

/* transparent header that is NOT on TV */
html:not(.layout-tv) .skinHeader.semiTransparent { }

/* avatar present vs. generic person icon */
.headerUserButton.headerUserButtonRound { } / .headerUserButton:not(.headerUserButtonRound) { }
```

## Netflix-relevance notes

| Netflix element | closest Jellyfin 12.1 legacy element | feasible in pure CSS? |
|---|---|---|
| Top bar: transparent at scroll-top, solid after scroll | `.skinHeader.semiTransparent` ↔ `.skinHeader-withBackground` | **Partly.** The toggle is route-driven (`setTransparentMenu`, details/login/queue only), *not* scroll-driven, and `libraryMenu` adds `skinHeader-withBackground` permanently. A scroll-linked fade needs `animation-timeline: scroll()` (Chromium 115+, not on most TVs) or JS. Stock also kills blur with `backdrop-filter:none !important` on `.semiTransparent`. |
| Red wordmark, far left | `.pageTitleWithDefaultLogo` (empty `h3`, logo is a `background-image`, `width:13.2em`) | **Yes.** Override `background-image` (+ `width`, `height`) on `.pageTitleWithDefaultLogo`; the TV variant swaps to the square icon, override `.layout-tv .pageTitleWithDefaultLogo` too. Text titles use the *same* element without the logo classes, so style `.pageTitle:not(.pageTitleWithLogo)` separately. |
| Primary nav ("Home / Series / Films / New") inline next to the logo | `.headerTabs.sectionTabs` **plus** `.mainDrawer`'s `.libraryMenuOptions` | **Partly.** The header tabs are *page* tabs (Start/Ulubione, Filmy/Sugestie/…), not global nav; the global nav lives in the drawer. At ≥1600px the tabs already sit on the same row as the icons (`margin-top:-4.3em`) so a horizontal nav strip is a re-skin away; moving drawer links into the header is impossible in CSS (different DOM subtree). |
| Active nav item (white, others grey) | `.emby-tab-button-active` | **Yes**, and an underline/pill indicator is free to add (`::after` on `.emby-tab-button-active`) — no stock indicator exists to remove. |
| Right cluster: search / notifications / avatar+caret | `.headerRight` → `.headerSearchButton`, `.headerCastButton`, `.headerSyncButton`, `.headerUserButton` | **Yes** for styling/reordering (`order:` on flex children; each has a stable class). Expanding search into an inline input is **not** possible — the button dispatches a route change (`inputManager.handleCommand('search')`). |
| Avatar as a rounded square with caret | `.headerUserButtonRound > div` (inline `background-image`) | **Yes** — `border-radius`, `width/height`; the stock `border-radius:100em` and `transform:scale(1.8)` on `.paper-icon-button-light > div` must both be overridden (`librarybrowser.scss:138-143`, `emby-button.scss:143-151`). |
| Hover mega-menu / profile dropdown from the header | — | **No.** No such DOM exists, and `.skinHeader{contain: layout style paint}` clips anything you draw inside it. Set `contain:none` first; still, the content has to exist. |
| Left slide-in drawer (Netflix mobile) | `.mainDrawer.touch-menu-la` + `.tmla-mask` | **Yes** for colours/typography/scrim. Width is an **inline style** (240–320px) — override needs `width: … !important` *and* you must not touch `transform`, which JS drives. `contain:strict` blocks auto-sizing. |
| Selected row highlight (red bar) | `.navMenuOption-selected` | **Yes**, needs `!important` on `background`; add a left bar via `box-shadow: inset` or `border-left` (padding is `!important`, so adjust with `!important` too). |
| Full-bleed hero with top-fade under the header | `.itemBackdrop` + `.skinHeader.semiTransparent`; `--jf-palette-AppBar-gradient` | **Yes** for the gradient (`--jf-palette-AppBar-gradient: linear-gradient(...)` feeds `background-image` of `.skinHeader-withBackground`). Note the details page already forces `padding-top:0!important` on `.itemDetailPage`, and the header is `position:fixed` (desktop/mobile) but `position:relative` on TV — a TV hero cannot slide under the header without `.layout-tv .skinHeader{position:fixed}` (which the upstream comment explicitly avoids for focus reasons). |
| Header hides on scroll down, returns on scroll up | `.headroom--unpinned/--pinned` | **Yes, mobile only** — Headroom is initialised solely when `layoutManager.mobile` (`libraryMenu.js:251-253`). On desktop/TV there is no scroll state in CSS. |
| Row hover "zoom" | `.card`/`.cardBox` (different subsystem) | header/drawer only give you `:hover` and, on TV, `.show-focus:focus` (which already applies `transform:scale(1.3)!important`). |

**Pure-CSS impossibilities to plan around:** adding/removing header items; turning the drawer into a permanent
sidebar on desktop (the drawer is `position:fixed` with a JS transform and `contain:strict`; the old
`.dashboardDocument` sidebar rules at `librarybrowser.scss:333-370` are dead in 12.1); scroll-driven header states
outside mobile; moving `.headerTabs` out of `.skinHeader`; any content change (labels, icons, extra links).

## Legacy vs modern: collisions to guard against

Both layouts are served the same global stylesheets, so these selectors hit **both** unless scoped:

| selector | legacy / TV | modern (and dashboard) | scope with |
|---|---|---|---|
| `.skinHeader`, `.mainDrawer`, `.mainDrawerHandle`, `.headerTabs`, `.emby-tab-button`, `.navMenuOption` | visible, in use | **present in the DOM but inside `<div style="display:none">`**; `maintabsmanager` still fills `.headerTabs` there | safe as-is (invisible), but never rely on their absence |
| `body.libraryDocument`, `body.withSectionTabs` | set | **also set** (verified live on `modern-desktop #/home`) | add `html.layout-tv` or the `:has()` legacy anchor |
| `.libraryPage`, `.pageWithAbsoluteTabs`, `.homePage`, `.allLibraryPage`, `.mainAnimatedPage`, `.page` | padding from `librarybrowser.scss` (99.7px live) | `apps/modern/AppOverrides.scss:17-24` forces `padding-top:0!important` (0px live) | if you change page padding, scope it: `#reactRoot > .mainAnimatedPages .libraryPage` |
| `.skinBody`, `.mainAnimatedPages` | `#reactRoot > .mainAnimatedPages.skinBody` | `#reactRoot > .MuiBox-root > main > .mainAnimatedPages.skinBody` | the child-combinator difference is the cleanest legacy discriminator |
| `.paper-icon-button-light`, `.emby-button`, `.material-icons` | used everywhere | used inside legacy views embedded in modern pages too | keep restyles inside `.skinHeader` / `.mainDrawer` |
| `.layout-desktop`/`.layout-mobile` on `<html>` | present | **also present** (modern reuses them) | `layout-*` alone never tells you legacy vs modern; only `layout-tv` implies legacy |
| MUI chrome `header.MuiAppBar-root`, `.MuiDrawer-*`, `.css-*` | absent | present | never target hashed `css-*`; use `.MuiAppBar-root` etc. in the *modern* map |

**Custom-CSS load order** (verified in the DOM): `link[href="themes/<id>/theme.css"]` → branding `<style>` →
per-user `<style>`, all as the last children of `#reactRoot` inside `<body>` (`components/ThemeCss.tsx`,
`components/CustomCss.tsx`, `apps/legacy/AppLayout.tsx:10-16`). So a custom rule with **equal specificity** beats
`theme.css` and `librarybrowser.scss`, and `!important` beats any stock `!important` at equal specificity.
The `<head>` inline block (`index.html:25-87`) is earlier still, so `.hide{display:none!important}` is beatable
with `!important` — but don't: it is load-bearing for every JS toggle in this subsystem.

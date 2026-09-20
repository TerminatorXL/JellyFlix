# Theme foundation — CSS variables, cascade, global surfaces, typography, buttons, forms

Target: Jellyfin **12.1** web client (`_ref/jellyfin-web` @ tag `v12.1`, `package.json` version `12.1.0`).
Everything below was read in the source **and** verified on the live test server (`jellyflix-test`, Docker) unless a
row says "source only".

Delivery vehicle for JellyFlix: Dashboard → General → **Custom CSS** (server Branding), and/or user-level
Display → Custom CSS. Both are rendered as `<style>` elements **inside `#reactRoot`, after the theme `<link>`**, i.e.
after every `<head>` stylesheet — so at *equal specificity a custom rule always wins by source order*.

---

## Where it appears (routes, layouts, breakpoints)

| Axis | Values seen live |
|---|---|
| `<html>` class | `layout-desktop` \| `layout-mobile` \| `layout-tv` (+ `transparentDocument` while a video plays) |
| `<html data-theme>` | `dark` (default) \| `light` \| `appletv` \| `blueradiance` \| `purplehaze` \| `wmc` |
| `<body>` class | `libraryDocument`, `withSectionTabs`, `dashboardDocument`, `hideMainDrawer`, `bodyWithPopupOpen`, `hide-scroll`, `noScroll`, `screensaver-noScroll`, `mouseIdle`, `mouseIdle-tv`, `force-scroll` (see gotcha G9) |
| App shell | **Modern** (React+MUI, default desktop/mobile) and **Legacy** produce *different* shells; TV uses the legacy shell with `layout-tv` |
| Routes | This subsystem is global: it applies on every route, including `#/login` (verified: the `themes/dark/theme.css` link and therefore the sibling Custom-CSS `<style>` exist on the unauthenticated login page) |

Root font size (measured live on `html`, this is what every `em`/`rem` in the app resolves against):

| Profile | `html` font-size | source |
|---|---|---|
| `modern-desktop`, `legacy-desktop` | **14.88px** (93%) | `src/styles/fonts.scss:6-11` |
| `modern-mobile`, `legacy-mobile`, `modern-tablet` | **14.4px** (90%, `.layout-mobile` class beats the `html` type selector) | `src/styles/fonts.scss:49-51` |
| `tv` | **20px** (125%) | `src/styles/fonts.scss:43-47` |
| real TV device (`browser.tv && !android`) | 20px / 27px by viewport height — `fonts.sized.scss` replaces `fonts.scss` | `src/index.jsx:138-150`, `src/styles/fonts.sized.scss:6-15` (source only — the `tv` harness profile is a viewport override, not a TV UA, so it loads the Noto path) |

Breakpoints that matter at this layer:
* `@media all and (min-width: 100em)` → **1600 CSS px** (media-query `em` = the *initial* 16px, not the 93% `html` size). Changes page top padding and header layout: `src/styles/librarybrowser.scss:386-414`.
* MUI default breakpoints used by the modern shell: sm 600 / md 900 / lg 1200 / xl 1536 (`src/apps/modern/AppOverrides.scss:3-6`). `md` (900px) decides whether the modern app shows a drawer button.
* Horizontal gutter everywhere: `max(3.3%, env(safe-area-inset-*))` (`src/styles/librarybrowser.scss:1326-1343`, `src/elements/emby-scroller/emby-scroller.scss:82-85`). Measured live on `modern-desktop`: `padding: 0 max(0px, 3.3%)`.

---

## DOM skeleton (real markup, trimmed)

### Modern shell (`modern-desktop`, `#/home`)

```
html.layout-desktop[data-theme="dark"]          (bg #101010, color rgba(255,255,255,.7))
  head
    style                                       (webcomponents: body transition)
    style                                       (inline from index.html:25-87 — .hide/.transparentDocument/.mainDrawerHandle)
    link  1133.*.css                            (Material Icons @font-face)
    link  main.jellyfin.*.css                   (site/librarybrowser/dashboard/detailtable/livetv)
    link  25348.*.css                           (fonts.scss: html 93%, layout-tv 125%, layout-mobile 90%)
    link  73560.*.css                           (Noto Sans @font-face x1108)
    …route-level chunk css…
    style[data-emotion="css-global"]            (MUI cssVariables  →  :root / [data-theme="…"]  — ALL --jf-* palette)
    style[data-emotion="css"]                   (MUI component classes .css-xxxxx, appended at runtime)
  body.libraryDocument.withSectionTabs          (margin/padding 0, height 100%, overflow-x hidden, bg transparent !important)
    div#reactRoot                               (height 100%)
      div.backdropContainer                     (fixed, 100vw/100vh, z-index -1, contain:layout style size)
        div.backdropImage.displayingBackdropImage.backdropImageFadeIn   (style="background-image:url(…)")
      div.backgroundContainer[.withBackdrop]    (fixed, inset 0, contain:strict, bg var(--jf-palette-background-default))
      div                                       (display:none in modern — legacy header wrapper)
        div.mainDrawer.transition.touch-menu-la
        div.skinHeader.focuscontainer-x.skinHeader-withBackground[.semiTransparent|.headroomDisabled]
        div.mainDrawerHandle
      div.MuiBox-root.css-sjv9i2                (position:relative; display:flex; flex-direction:column; height:100%)
        header.MuiPaper-root.MuiPaper-elevation0.MuiAppBar-root.MuiAppBar-colorTransparent.MuiAppBar-positionFixed.mui-fixed
          div.MuiToolbar-root.MuiToolbar-dense.padded-left.padded-right
        div                                     (48px spacer — OffsetAppBar)
        main.MuiBox-root                        (position:relative; width:100%; flex-grow:1)
          div.mainAnimatedPages.skinBody        (legacy ViewManager mount point)
            div#loginPage.page.standalonePage.backdropPage.mainAnimatedPage.hide
          div.skinBody                          (React page mount point)
            div
              div#indexPage.page.mainAnimatedPage.homePage.libraryPage.allLibraryPage.pageWithAbsoluteTabs.withTabs
                div#homeTab.tabContent.pageTabContent.is-active
                div#favoritesTab.tabContent.pageTabContent
      link[rel=stylesheet][href="themes/dark/theme.css"]     ← ThemeCss
      (style)  ← CustomCss: server Branding CSS
      (style)  ← CustomCss: user-level custom CSS            ← LAST STYLE IN THE DOCUMENT
    div.docspinner.mdl-spinner                  (fixed, z-index 9999999)
    div.appfooter                               (fixed, z-index 1201, bg var(--jf-palette-background-paper))
    div.tmla-mask.hide                          (fixed, z-index 1098)
    div#app-*-menu.MuiPopover-root.MuiMenu-root.MuiModal-root  (z-index 1300, MUI portals appended to body)
```

### Legacy shell (`legacy-desktop`, `#/home`) — differences only

```
  body.withSectionTabs.libraryDocument
    div#reactRoot
      div.backdropContainer / div.backgroundContainer
      div                                       (VISIBLE here)
        div.mainDrawer.transition.touch-menu-la          {-320,0 320x1080} fixed z-index 1099 contain:strict
        div.skinHeader.focuscontainer-x.skinHeader-withBackground.skinHeader-blurred
                                                         {0,0 1920x64}    fixed z-index 999  contain:content
        div.mainDrawerHandle                             {0,0 12x1080}    fixed z-index 1
      div.mainAnimatedPages.skinBody            ← pages live HERE (no <main>, no MUI AppBar)
        div#indexPage.page.homePage.libraryPage.…mainAnimatedPage   padding: 99.7px 0 74.4px
      div.skinBody                              (empty)
      link themes/dark/theme.css
```

### Dashboard shell (`modern-desktop`, `#/dashboard`)

```
      div.MuiBox-root
        header.MuiAppBar-root.MuiAppBar-colorTransparent    {240,0 1680x48}
        div.MuiDrawer-root.MuiDrawer-anchorLeft.MuiDrawer-docked
          div.MuiPaper-root.MuiPaper-elevation0.MuiDrawer-paper.MuiDrawer-paperAnchorDockedLeft  {0,0 240x1080} bg #202020, z 1200
        main.MuiBox-root
          div.mainAnimatedPages.skinBody / div.skinBody
```
`document.body` additionally carries `dashboardDocument` (`src/apps/dashboard/AppLayout.tsx`), and legacy dashboard
pages carry `.type-interior`, which makes `autoThemes` swap to the **dashboardTheme** (`src/scripts/autoThemes.js:19-24`).

### Form primitives (live markup)

```
div.inputContainer                                    (margin-bottom 1.8em)
  label.inputLabel.inputLabelUnfocused                (→ .inputLabelFocused on focus)
  input#…​.emby-input[is="emby-input"]                 bg rgba(255,255,255,.09), border .16em, radius .2em, font-size 110%

div.selectContainer[.selectContainer-inline]
  label.selectLabel
  select#embyselect0.emby-select.emby-select-withcolor[is="emby-select"]   bg var(--jf-palette-background-paper)
  div.selectArrowContainer > span.selectArrow.material-icons

label.checkboxContainer.emby-checkbox-label           (padding-left 2.4em, height 2.35em)
  input.emby-checkbox[is="emby-checkbox"]             (1x1px, opacity 0 — focusable only)
  span.checkboxLabel
  span.checkboxOutline                                (abs, 1.83em box, border .14em currentcolor)
    span.material-icons.checkboxIcon.checkboxIcon-checked.check
    span.material-icons.checkboxIcon.checkboxIcon-unchecked

button.raised.button-submit.block.emby-button[is="emby-button" type="submit"]   bg primary-main, color primary-contrastText
  span                                                (label is wrapped in a bare <span>)
button.raised.cancel.block.btnCancel.emby-button                                bg Button-inheritContainedBg (#424242)

div.sliderContainer[.mdl-slider-container] style="margin:.5em 0 .25em"     ← INLINE style
  div.sliderMarkerContainer
  input.osdPositionSlider.mdl-slider.mdl-js-slider.mdl-slider-hoverthumb[is="emby-slider" type="range"]
  div.mdl-slider-background-flex-container > .mdl-slider-background-flex > .mdl-slider-background-flex-inner
      div.mdl-slider-background-upper  style="left:0%; width:100%"          ← INLINE, JS-driven
      div.mdl-slider-background-lower  style="width:59.81%"                 ← INLINE, JS-driven
  div.sliderBubbleTrack > div.sliderBubble[.hide]

label.MuiButtonBase-root.MuiButton-root.MuiButton-outlined.MuiButton-outlinedPrimary.Mui-disabled.css-nu23t2
div.MuiFormControl-root.MuiFormControl-fullWidth.MuiTextField-root
  label.MuiFormLabel-root.MuiInputLabel-root.MuiInputLabel-filled
  div.MuiInputBase-root.MuiFilledInput-root.MuiFilledInput-underline.MuiFilledInput-multiline[.textarea-mono]
    textarea.MuiInputBase-input.MuiFilledInput-input
  p.MuiFormHelperText-root
```

---

## Selector table

| selector | what it is | layout(s) | safe to style? | notes (file:line) |
|---|---|---|---|---|
| `:root` / `html` | variable host; also the page background + default text colour | all | **yes — primary override point** | bg/img from `--jf-palette-background-default(/-defaultImage)`; `_base/_theme.scss:125-133`; colour `_base/_theme.scss:69-72` |
| `html.layout-desktop` / `.layout-mobile` / `.layout-tv` | layout switch, set by JS | all | yes (read-only anchor) | `src/components/layoutManager.js:8-16`; also drives root font-size |
| `html[data-theme="…"]` | active built-in theme id, set by JS | all | yes (anchor) | `src/scripts/themeManager.js:46` |
| `html.transparentDocument` | set while a video player is open | all | careful | `src/components/backdrop/backdrop.js:301-315`; head rule forces `background:none!important` (`index.html:26-30`) |
| `body` | full-page box, **the vertical scroll container on desktop** | all | yes | `height:100%; margin/padding 0; overflow-x:hidden; background-color:transparent !important` — `src/styles/site.scss:46-51` |
| `body.libraryDocument` / `.dashboardDocument` / `.withSectionTabs` | page-kind flags | all | yes (anchors) | `src/scripts/libraryMenu.js:587-606`, `src/apps/dashboard/AppLayout.tsx` |
| `body.mouseIdle`, `.mouseIdle-tv` | cursor-idle ≥5 s | all | yes | `src/scripts/mouseManager.js:23-37`; head rule sets `cursor:none!important` |
| `#reactRoot` | React root, `height:100%` | all | yes | `src/styles/site.scss:53-55` |
| `.backdropContainer` | fixed full-viewport backdrop layer | all | **yes — key Netflix hook** | `fixed; 100vw×100vh; z-index:-1; contain:layout style size` — `src/components/backdrop/backdrop.scss:1-9` |
| `.backdropImage` / `.displayingBackdropImage` / `.backdropImageFadeIn` | one backdrop image, `background-image` set inline by JS | all | yes (but URL is inline) | `backdrop.scss:11-25`; element built in `backdrop.js:28-35` |
| `.backgroundContainer` | solid colour/gradient sheet over the backdrop | all | **yes — key hook** | `fixed; inset 0; contain:strict` (`site.scss:73-80`) + colour/img (`_theme.scss:125-133`) |
| `.backgroundContainer.withBackdrop` | added by JS when a backdrop is showing | all | yes | `opacity:.86` — `_theme.scss:135-137`; set in `backdrop.js:116-121` |
| `.backgroundContainer-transparent:not(.withBackdrop)` | player transparency | all | no (head `!important`) | `src/index.html:26-30` |
| `.mainAnimatedPages` / `.skinBody` | page mount containers | all | yes | `src/components/AppBody.tsx:16-17`; `.dashboardDocument .skinBody{position:unset!important}` (`apps/dashboard/AppOverrides.scss:18-20`) |
| `.mainAnimatedPage` | every page view | all | careful | `position:absolute; inset:0; contain:layout style size` — `viewManager/viewContainer.scss:1-12` (also `contain:style size!important` in `site.scss:88-90`) |
| `.page`, `.content-primary`, `.padded-bottom-page`, `.pageWithAbsoluteTabs .pageTabContent` | bottom room for the music bar | all | needs `!important` | `padding-bottom: calc(env(safe-area-inset-bottom) + 5em) !important` — `src/styles/site.scss:119-126` |
| `.libraryPage` | every library-ish page | all | needs `!important` | `padding-top:7em!important` (`librarybrowser.scss:91-93`); `:not(.noSecondaryNavPage)` → `7.5em!important` (`:111-113`); at ≥100em → `4.6em` / `pageWithAbsoluteTabs` `6.7em` (`:400-406`) |
| `.itemDetailPage` | details page | all | needs `!important` | `padding-top:0!important` (`:95-97`), `layout-tv` → `4.2em!important` (`:99-101`) |
| `.homePage.libraryPage.withTabs`, `.libraryPage:not(.itemDetailPage)` | modern-only padding reset | modern | n/a (already `!important`) | `apps/modern/AppOverrides.scss:18-24` — this is why modern pages measure `padding-top:0` |
| `.padded-left` / `.padded-right` | the app's 3.3 % gutter | all | yes, but needs ≥ (0,2,0) | defined as `[dir="ltr"] .padded-left{…}` — `librarybrowser.scss:1326-1343` |
| `.emby-scroller` | horizontal row viewport | all | yes | same gutter mixin — `emby-scroller/emby-scroller.scss:82-85` |
| `.scrollX` / `.scrollY` / `.hiddenScrollX` / `.smoothScrollY` | scroll helpers | all | yes | `src/styles/scrollstyles.scss:1-57`; `.layout-tv .scrollX::-webkit-scrollbar{height:0!important}` |
| `.skinHeader` | legacy top bar | legacy + TV (hidden div in modern) | yes | `fixed; z-index:999; contain:content`; bg `--jf-palette-AppBar-defaultBg` + `--jf-palette-AppBar-gradient` (`_theme.scss:88-92`) |
| `.skinHeader.semiTransparent` | header over a backdrop | legacy + TV | yes | bg `--jf-palette-AppBar-transparentBg`, `backdrop-filter:none!important` (`_theme.scss:100-108`) |
| `.detailRibbon` | details-page title ribbon | all | yes | `rgba(var(--jf-palette-background-paperChannel, 32 32 32) / .8)` — `themes/dark/theme.scss:28-32` |
| `.mainDrawer`, `.drawer-open` | legacy nav drawer | legacy/mobile/TV | yes | bg `--jf-palette-background-default` — `_theme.scss:467-470` |
| `.navMenuOption:hover` / `.navMenuOption-selected` | drawer rows | legacy | selected needs `!important` | `_theme.scss:472-479` (`background: … !important`) |
| `.appfooter` | now-playing bar shell | all | yes | bg `--jf-palette-background-paper`, fixed z-index 1201 — `_theme.scss:311-315` |
| `.emby-button` | every legacy button | all | yes | `inline-flex; padding:.9em 1em; radius .2em; font-weight 600; outline:none!important; transition .2s` — `emby-button/emby-button.scss:1-32` |
| `.emby-button.show-focus:focus` | TV focus | TV | yes | `transform:scale(1.2)` (`emby-button.scss:34-37`) + bg primary (`_theme.scss:481-484`) |
| `.raised`, `.fab`, `a[data-role="button"]` | neutral filled button | all | yes | bg `--jf-palette-Button-inheritContainedBg`, hover `…HoverBg`, focus `--jf-palette-secondary-main` — `_theme.scss:165-178` |
| `.button-submit` | primary CTA | all | yes | bg `--jf-palette-primary-main`, text `--jf-palette-primary-contrastText`, hover `primary-dark` — `_theme.scss:180-192` |
| `.button-delete` | destructive | all | yes | `--jf-palette-error-main` / `error-contrastText` — `_theme.scss:194-197` |
| `.button-flat`, `.button-link` | text buttons | all | yes | `emby-button.scss:43-57`; colours `_theme.scss:380-386` |
| `.paper-icon-button-light` | icon button | all | yes | `border-radius:50%; padding:.556em; overflow:hidden; outline:none!important` — `emby-button.scss:86-118`; hover tint `rgba(var(--jf-palette-primary-mainChannel) / var(--jf-palette-action-selectedOpacity))` (`_theme.scss:143-155`) |
| `.fab` | round FAB | all | yes | `emby-button.scss:68-76` |
| `.emby-button.block` | full-width button | all | yes | `emby-button.scss:78-84` |
| `.filterButtonBubble` | filter count badge | all | yes | hard-coded `#03a9f4`, `z-index:100000000` — `emby-button.scss:162-178` |
| `.emby-input`, `.emby-textarea` | text inputs | all | yes | bg `--jf-palette-FilledInput-bg`, border-color `--jf-palette-FilledInput-borderColor` (**undeclared → free hook**), `font-size:110%`, `outline:none!important`, `margin-bottom:0!important` — `_theme.scss:394-406`, `emby-input/emby-input.scss:1-17` |
| `.inputContainer`, `.selectContainer`, `.checkboxContainer`, `.toggleContainer` | field wrappers | all | yes | `margin-bottom:1.8em` each |
| `.inputLabel(.inputLabelUnfocused)` / `.inputLabelFocused` | field labels | all | yes | `_theme.scss:203-215` |
| `.emby-select`, `.emby-select-withcolor` | native selects | all | yes | bg `--jf-palette-background-paper` (deliberately *not* FilledInput-bg), `:focus` border `--jf-palette-secondary-main !important` — `_theme.scss:408-431` |
| `.emby-select-withcolor > option` | dropdown options | all | yes | `_theme.scss:419-422` |
| `.selectArrowContainer`, `.selectArrow` | select chevron | all | yes | `emby-select.scss:103-131` |
| `.emby-checkbox` + `.checkboxOutline` + `.checkboxIcon` | checkbox | all | yes | checked/focus colours `_theme.scss:433-448`; box geometry `emby-checkbox/emby-checkbox.scss:46-66`; checked icon toggled with `display:flex!important` (`:73-81`) |
| `.mdl-radio`, `.mdl-radio__circles`, `.mdl-radio__outer-circle/__inner-circle/__focus-circle` | radio | all | partly | only the `.show-focus:focus` circles read `--jf-palette-secondary-main` (`_theme.scss:633-636`); `__focus-circle` bg is hard-coded `#00a4dc` (`emby-radio.scss:103`) |
| `.mdl-switch__track`, `.mdl-switch__thumb`, `.mdl-switch__focus-helper` | toggle | all | needs explicit CSS | **no `--jf-` vars at all**: `rgba(0,164,220,.5)` (`emby-toggle.scss:45`), `#00a4dc` (`:79`), `rgba(0,164,220,.26)` (`:108-109`) |
| `.mdl-slider`, `.mdl-slider-background-lower`, `.mdl-slider-background-upper`, `.sliderBubble`, `.sliderMarker` | slider | all | needs explicit CSS | **no `--jf-` vars**: `#00a4dc` at `emby-slider.scss:8,61,81,101,182,275`; track `rgba(255,255,255,.4)` at `:208`; bubble `#282828` at `:228` |
| `.emby-tab-button`, `.emby-tab-button-active` | legacy tabs | all | yes | `_theme.scss:486-497`; geometry `emby-tabs/emby-tabs.scss:40-61` |
| `.listItem`, `.listItem:hover`, `.listItem:focus`, `.listItem-border` | legacy list rows | all | yes | `--jf-palette-action-hover` / `-focus` / `-divider` — `_theme.scss:364-374` |
| `.paperList`, `.visualCardBox`, `.collapseContent`, `.formDialogHeader/Footer` | "surface" panels | all | **must hard-code** | background is the compiled SASS literal `#202020`, **no var** — see gotcha G3 (`_theme.scss:221-231`, compiled `theme.css`) |
| `.dialog` | dialog surface | all | yes | `--jf-palette-background-default` — `_theme.scss:139-141` |
| `.toast` | snackbar | all | yes | `--jf-palette-SnackbarContent-bg/-color` — `_theme.scss:306-309` |
| `.infoBanner` | info banner | all | yes | `--jf-palette-Alert-infoFilledBg/-Color` — `_theme.scss:550-555` |
| `.countIndicator`, `.playedIndicator`, `.mediaSourceIndicator`, `.fullSyncIndicator` | card badges | all | yes | primary-main / primary-contrastText, incl. `> svg {fill}` — `_theme.scss:454-465` |
| `.itemProgressBarForeground` | resume bar | all | yes | `--jf-palette-primary-main` — `_theme.scss:441-444` |
| `.show-focus` | "draw a focus ring" marker added on TV layout | TV (and a few dialogs) | yes (anchor) | `Button.tsx:31`, `IconButton.tsx:25`, `emby-button.js:38-42`, `cardbuilder/utils/builder.ts:97`; 54 elements carry it on `tv` home |
| `.hide`, `.layout-desktop .hide-desktop`, `.layout-mobile .hide-mobile`, `.layout-tv .hide-tv` | visibility helpers | all | no | `display:none!important` in the `<head>` inline style — `src/index.html:61-68` |
| `*` (scrollbar) | Firefox/standards scrollbar | all | yes | `scrollbar-width:thin; scrollbar-color:#3b3b3b #202020` — `_theme.scss:64-67` (specificity 0,0,0 → trivially overridable) |
| `::-webkit-scrollbar-track`, `::-webkit-scrollbar-track-piece`, `::-webkit-scrollbar-thumb:horizontal/:vertical` | WebKit scrollbar | all | yes | `_theme.scss:579-597`; thumb `#888`, track-piece `#3b3b3b` |
| `.layout-desktop ::-webkit-scrollbar`, `.layout-tv ::-webkit-scrollbar` | scrollbar size | desktop/TV | yes, but needs ≥ (0,1,0) | `width/height: .4em` — `_theme.scss:587-591`; use `.layout-desktop ::-webkit-scrollbar` (ties on specificity, wins on order) |
| `.MuiAppBar-root.MuiAppBar-colorTransparent` | modern top bar | modern + dashboard | **yes — key Netflix hook** | `--AppBar-background:transparent; --AppBar-color:inherit`; `color` comes from `--jf-palette-text-primary` (`themes/_base/theme.ts:61-67`) |
| `.MuiToolbar-root.MuiToolbar-dense` | toolbar row (48px) | modern | yes | carries `.padded-left .padded-right` on home |
| `.MuiPaper-root` (+ `.MuiMenu-paper`, `.MuiPopover-paper`, `.MuiDrawer-paper`) | every MUI surface | modern/dashboard | yes | `background-color: var(--jf-palette-background-paper); color: var(--jf-palette-text-primary); box-shadow: var(--Paper-shadow); background-image: var(--Paper-overlay)` — see gotcha G5 |
| `.MuiButton-root` + `.MuiButton-contained/-outlined/-text`, `.MuiButton-colorPrimary/-colorInherit`, `.MuiButton-startIcon` | MUI buttons | modern/dashboard | yes | per-instance `--variant-containedBg`, `--variant-textBg`, `--variant-outlinedBg` on the hashed class |
| `.MuiIconButton-root` + `-colorInherit`, `-sizeLarge` | MUI icon buttons | modern/dashboard | yes | `--IconButton-hoverBg: rgba(var(--jf-palette-action-activeChannel) / var(--jf-palette-action-hoverOpacity))` |
| `.MuiFormControl-root`, `.MuiTextField-root`, `.MuiInputBase-root`, `.MuiFilledInput-root`, `.MuiFilledInput-underline`, `.MuiInputBase-input`, `.MuiInputLabel-root`, `.MuiFormLabel-root`, `.MuiFormHelperText-root` | MUI forms (default variant is **filled**) | modern/dashboard | yes | defaults set in `themes/_base/theme.ts:84-100`; helper text forced to `1rem` (`:89-95`) |
| `.MuiList-root`, `.MuiListItem-root`, `.MuiListItemButton-root`, `.MuiListItemIcon-root`, `.MuiListItemText-primary`, `.MuiListSubheader-root`, `.MuiDivider-root`, `.MuiTypography-root/-body1/-body2` | MUI lists & text | modern/dashboard | yes | `MuiListItemIcon` min-width 36px, `MuiListSubheader` `background-color:inherit; position:initial` (`theme.ts:101-116`) |
| `.MuiBackdrop-root`, `.MuiModal-root`, `.MuiPopover-root`, `.MuiMenu-root` | portals appended to `<body>` | modern/dashboard | yes | z-index 1300 (`--jf-zIndex-modal`) |
| `.Mui-disabled`, `.Mui-focusVisible`, `.Mui-selected`, `.Mui-error` | MUI state classes (stable) | modern/dashboard | yes | prefer these over `:disabled`/`:focus-visible` |
| `.css-xxxxxx` | emotion hash | modern/dashboard | **NEVER** | changes on any MUI/theme/build change |

---

## Existing styling that will fight a custom theme

**G1 — Cascade order (verified live, `document.styleSheets` in order).**
27 sheets on `#/home`: 0-11 head `<link>`/`<style>` (app CSS), **12 = `<style data-emotion="css-global">` (all `--jf-*`)**,
**13 = `<style data-emotion="css">` (`.css-*` component rules)**, 14-24 head route chunks,
**25 = `<link href="themes/dark/theme.css">` in `<body>` inside `#reactRoot`**, **26 = the Custom-CSS `<style>`**.
Consequences:
* Custom CSS is the last sheet → **ties on specificity are won by Custom CSS**.
* Emotion appends *new* `.css-*` rules to the **head** sheet at runtime (lazy-loaded components), so they can never
  jump ahead of Custom CSS. Verified: sheet 13 gained rules between routes and still sorts before sheet 26.
* The theme `<link>` (sheet 25) is also in `<body>` but **before** Custom CSS, so Custom CSS beats `themes/*/theme.css`
  at equal specificity too.
* Custom CSS is React-rendered from a react-query result (`CustomCss.tsx:7-21`, `useBrandingOptions.ts:19-25`) → there
  is a short **flash of unthemed UI** on cold load. Nothing CSS can do about it.
* Order inside `CustomCss`: server Branding CSS first, then the **user-level** custom CSS (`CustomCss.tsx:12-21`), so a
  user's personal CSS beats the server theme. `disableCustomCss` (Display prefs) disables **only** the Branding one.

**G2 — `[data-theme="…"]` specificity is the same as `:root`.** MUI is configured with
`cssVarPrefix:'jf'`, `colorSchemeSelector:'[data-theme="%s"]'`, `defaultColorScheme:'dark'`
(`src/themes/index.ts:12-28`). It emits, in sheet 12:
`:root{…49 non-colour tokens…}`, `[data-theme="dark"]{…27 overlays + AppBar-dark*…}`,
`:root, [data-theme="dark"]{…157 palette vars…}`, then `[data-theme="appletv|blueradiance|purplehaze|wmc|light"]{…}`.
`:root` and `[data-theme="x"]` are both specificity **(0,1,0)** → a plain `:root{}` in Custom CSS wins on order.
**Verified live**: with `[data-theme="dark"]{--jf-palette-primary-main:#0000ff}` written *before* `:root{--jf-palette-primary-main:#e50914}`
in the injected sheet, the computed value on `html` was `#e50914`.

**G3 — Hard-coded surface colour (`$surface-overlay`) is NOT a variable.** In `themes/dark/theme.css` these compile to a
literal `#202020` with no `var()` fallback pair (`_base/_theme.scss:221-248`):
```
.collapseContent,.formDialogFooter:not(.formDialogFooter-clear),.formDialogHeader:not(.formDialogHeader-clear){background-color:#202020}
.paperList,.visualCardBox{background-color:#202020}
.cardBox:not(.visualCardBox) .cardPadder{background-color:#202020}
.cardPadder .cardImageIcon{color:#202020}
```
**Verified**: setting `--jf-palette-background-paper:#181818` moved `.MuiMenu-paper` and `.detailRibbon` but left
`.cardBox .cardPadder` at `rgb(32,32,32)`. A custom theme must restyle these four selectors explicitly.

**G4 — Other hard-coded accents that ignore the palette** (a Netflix theme must override them by selector):
`.mdl-slider*` `#00a4dc` (`emby-slider.scss:8,61,81,101,182,275`), slider track `rgba(255,255,255,.4)` (`:208`),
`.sliderBubble` `#282828` (`:228`), `.mdl-switch__*` (`emby-toggle.scss:45,79,108-109`),
`.mdl-radio__focus-circle` (`emby-radio.scss:103`), `.filterButtonBubble` `#03a9f4` (`emby-button.scss:176`),
`.checkboxIcon{color:#fff}` (`emby-checkbox.scss:63-66`), `.defaultCardBackground1..5` (`themes/dark/theme.scss:5-23`),
guide programme cells `#3949ab/#5e35b1/#039be5/#43a047/#1e1e1e !important` (`_base/_theme.scss:505-523`),
scrollbar `#3b3b3b`/`#202020`/`#888` (`_theme.scss:64-67,579-597`),
`.searchfields-icon{color:#aaa}` (`librarybrowser.scss:1375-1380` area), dashboard `#00a4dc !important`
(`styles/dashboard.scss:123`, `styles/metadataeditor.scss:49`, `librarybrowser.scss:1379`).

**G5 — MUI writes custom properties as INLINE styles on every `Paper`.** Verified live:
`<div class="MuiPaper-root … MuiPaper-elevation8 MuiMenu-paper css-18bruhv" style="--Paper-shadow: var(--jf-shadows-8); --Paper-overlay: var(--jf-overlays-8); …">`.
A stylesheet rule `.MuiPaper-root{--Paper-shadow:…}` is therefore **ignored** (verified: box-shadow unchanged).
*But* the inline value is itself a `var()`, so redefining `--jf-shadows-8` / `--jf-overlays-8` on `:root` **does** work —
verified: `:root{--jf-overlays-8:none;--jf-shadows-8:0 8px 24px rgba(0,0,0,.9)}` changed the menu's
`background-image` to `none` and `box-shadow` to `rgba(0,0,0,.9) 0 8px 24px 0`.
Other inline styles at this layer: `.backdropImage[style="background-image:url(…)"]`,
`.mdl-slider-background-lower/-upper[style="width:…%"]`, `.sliderContainer[style="margin:.5em 0 .25em"]`,
MUI transition state (`opacity`, `transform`, `visibility`) on popovers.

**G6 — Typography does NOT flow through `--jf-font-*`.** The `--jf-font-h1…overline` variables exist on `:root`, but the
components are compiled with literal values. Verified rule for a list-item label:
`.css-pl8nxc { margin:0; font-family:"Noto Sans",sans-serif; font-weight:400; font-size:1rem; line-height:1.5 }`.
Tests:
* `html, body { font-family: X }` → `html`, `h1`, `.emby-button` change; `.MuiTypography-root`, `.MuiButton-root`,
  `.MuiListItemText-primary` stay `"Noto Sans", sans-serif`. ❌
* `:root { --jf-font-body1: … X; --jf-font-button: … X }` → **no effect at all**. ❌
* `html, body { font-family: X } [class*="Mui"] { font-family: X }` → everything changes. ✅ (verified on `#/mypreferencesmenu`)
  Caveat: exclude the ligature icon font — `.material-icons` is lowercase so `[class*="Mui"]` does not match it, but do
  not let the rule reach `.MuiIcon-root` if it ever appears.

**G7 — `!important` already present in app CSS** (you must match or beat it):
`site.scss:124-125` page bottom padding; `librarybrowser.scss:91,95,99,103,107,111,400,404,410` page top padding;
`apps/modern/AppOverrides.scss:9-24` and `apps/dashboard/AppOverrides.scss:11-26`;
`index.html:26-30,52-53,61-68` (`background:none!important`, `cursor:none!important`, `display:none!important`);
`emby-button.scss:13` and `emby-input/select/textarea` `outline:none!important`, `margin-bottom:0!important`;
`_theme.scss:103` `backdrop-filter:none!important`, `:325` selection panel colour, `:425-431` select focus,
`:477` `.navMenuOption-selected`, `:527-528` guide focus, `:563` `.buttonActive`, `:568` card focus border;
`emby-tabs.scss:65-66` TV tab focus; `fonts.scss:25-41` `.textarea-mono` font stack.

**G8 — containment / transform / overflow ancestors that clip or isolate.**
`.backgroundContainer{contain:strict}` (`site.scss:79`) — nothing can paint outside it;
`.backdropContainer{contain:layout style size; z-index:-1}` (`backdrop.scss:1-9`) — sits *behind* `#reactRoot` content,
so you cannot raise a child of the page above it without a new stacking context;
`.mainAnimatedPage{position:absolute; inset:0; contain:layout style size}` (`viewContainer.scss:1-12`) +
`contain:style size!important` (`site.scss:88-90`) — **`position:fixed` inside a page still works** (no transform), but
the page cannot size itself from its children;
`.skinHeader{contain:content}`, `.mainDrawer{contain:strict}`, `.appfooter{contain:layout style}`,
`.tmla-mask{contain:strict}`, `.docspinner{contain:size layout style}`;
`.headroom{will-change:transform; transition:transform 200ms}` + `.headroom--unpinned{transform:translateY(-100%)}`
(`site.scss:146-157`) — a transformed ancestor for anything inside the legacy header;
`.paper-icon-button-light{overflow:hidden}` (`emby-button.scss:110`) — ripples/badges are clipped;
`body{overflow-x:hidden}` (`site.scss:48`); `.pageContainer{overflow-x:visible!important}` (`site.scss:92-94`).

**G9 — z-index stack (measured live).**
`-1` `.backdropContainer` · `0` `.emby-button`/`.paper-icon-button-light` · `1` `.mainDrawerHandle`,
`.emby-button.show-focus:focus`, `.absolutePageTabContent` · `2` `.checkboxOutline` ·
`999` `.skinHeader` · `1098` `.tmla-mask` · `1099` `.mainDrawer` ·
`1100` `.MuiAppBar-root` (`--jf-zIndex-appBar`) · `1200` `.MuiDrawer-paper` (`--jf-zIndex-drawer`) ·
`1201` `.appfooter` · `1300` MUI modals/popovers (`--jf-zIndex-modal`) · `1400` snackbar · `1500` tooltip ·
`100000000` `.filterButtonBubble` · `9999999` `.docspinner`.

**G10 — upstream bug: `body` never gets `.force-scroll`.** `autoThemes.js:8-12` adds it in `.then()` of
`skinManager.setTheme()`, but `themeManager.setTheme` (`src/scripts/themeManager.js:30-53`) only calls `resolve()` on its
two early-return paths — the happy path never resolves. Verified: `document.body.className` is
`"libraryDocument withSectionTabs"` on every route tested. So the desktop scrollbar appears/disappears between pages
and the layout shifts ~15px. A theme can fix this with `body{overflow-y:scroll}` or
`html{scrollbar-gutter:stable}`.

**G11 — hashed emotion classes.** `.css-sjv9i2`, `.css-1u7mpsp`, `.css-1iogify`, `.css-18bruhv`, `.css-pl8nxc`, …
appear on every MUI node and are build-dependent. Never target them. `:where([data-theme="dark"]) .css-xxxx{…}` rules
exist too (specificity (0,1,0) because `:where()` contributes 0).

**G12 — things a custom theme simply cannot reach with CSS.** The `<style>` in `index.html` and the head chunk CSS
*can* be overridden (Custom CSS is later), but: the `themeColor` meta, the banner/logo images
(`.pageTitleWithDefaultLogo` uses `url(banner-light.png)` — replaceable only by `background-image`), the
`data-theme` value, and everything that depends on JS-added classes (`withBackdrop`, `show-focus`, `.is-active`,
`mouseIdle`) can only be *reacted to*, not produced.

---

## Theming hooks

### A. The override technique that works (verified)

```css
/* Put this at the top of the Custom CSS. Plain :root is enough. */
:root {
    --jf-palette-background-default: #141414;
    --jf-palette-primary-main:       #e50914;
    --jf-palette-primary-contrastText: #fff;   /* MUST set — otherwise text stays rgba(0,0,0,.87) */
    /* … */
}
```
Why `:root` and nothing fancier:
1. It is (0,1,0), identical to MUI's `[data-theme="dark"]`, and Custom CSS is the **last** sheet → it wins.
   Verified end-to-end on `modern-desktop`: `html` computed `--jf-palette-primary-main:#e50914`,
   `--jf-palette-background-default:#141414`, `--jf-card-borderRadius:.5em`; `.backgroundContainer` painted
   `rgb(20,20,20)`; `.skinHeader` painted `rgb(11,11,11)` from `--jf-palette-AppBar-defaultBg`;
   `.cardPadder` `border-radius` became `7.44px` (= .5em × 14.88px).
2. It is **theme-agnostic**: it also beats `[data-theme="light|appletv|…"]`, so the look survives a user picking a
   different built-in theme *and* the separate `dashboardTheme` used on `.type-interior` pages.
   (If you *want* to respect the user's light/dark choice, scope with `[data-theme="dark"]:root` — (0,2,0) — instead.)
3. `html{…}` alone would be (0,0,1) and would **lose** to `[data-theme="dark"]`. Do not use it for variables.
   If you ever need to beat a `:root` rule from another plugin's Custom CSS, use `:root:root` (0,2,0).
4. Variables resolve through MUI's own `var()` chains: overriding `--jf-palette-grey-800` changed
   `--jf-palette-Button-inheritContainedBg` and repainted `.raised` to `rgb(42,42,42)` (verified).

For non-variable properties the same rule applies — match MUI's specificity and let source order win, e.g.
`.MuiAppBar-root.MuiAppBar-colorTransparent{background-image:linear-gradient(…)}` **verified** to repaint the modern
header. For `[dir]`-scoped rules like `.padded-left` you need `[dir="ltr"] .padded-left` (0,2,0).
For WebKit scrollbars, match `.layout-desktop ::-webkit-scrollbar` (0,1,0).

### B. Complete `--jf-*` inventory (dumped from the live `:root`)

**B1. Declared by MUI on `:root` only — 49 non-colour tokens** (`style[data-emotion="css-global"]`):
`--jf-spacing: 8px` · `--jf-shape-borderRadius: 4px` ·
`--jf-shadows-0 … --jf-shadows-24` (Material elevation shadows; `-0: none`) ·
`--jf-zIndex-mobileStepper 1000`, `-fab 1050`, `-speedDial 1050`, `-appBar 1100`, `-drawer 1200`, `-modal 1300`,
`-snackbar 1400`, `-tooltip 1500` ·
`--jf-font-button|h1|h2|h3|h4|h5|h6|subtitle1|subtitle2|body1|body2|caption|overline|inherit`
(e.g. `--jf-font-h1: 300 1.8rem/1.167 "Noto Sans",sans-serif`) — **declared but not consumed, see G6**.

**B2. Declared on `[data-theme="dark"]` only — 27:**
`--jf-overlays-0 … --jf-overlays-24` (`linear-gradient(rgba(255 255 255/.051), …)` … `/.165`; `-0: none`) ·
`--jf-palette-AppBar-darkBg: var(--jf-palette-background-paper,#202020)` ·
`--jf-palette-AppBar-darkColor: var(--jf-palette-text-primary,#fff)`.
(The same 27 also appear on `[data-theme="blueradiance"]`; `light`/`appletv` carry the light-mode variants.)

**B3. Declared on `:root, [data-theme="dark"]` — the 157-entry palette.** Values for the stock Dark theme:

| group | variables (dark values) |
|---|---|
| primary / secondary | `-main #00a4dc`, `-light rgb(51,182,227)`, `-dark rgb(0,114,154)`, `-contrastText rgba(0,0,0,.87)` (both groups identical) |
| background | `-default #101010`, `-paper #202020` |
| action | `-active #fff`, `-hover rgba(255,255,255,.08)`, `-selected rgba(255,255,255,.16)`, `-disabled rgba(255,255,255,.3)`, `-disabledBackground rgba(255,255,255,.12)`, `-focus rgba(255,255,255,.12)`, `-hoverOpacity .08`, `-selectedOpacity .2`, `-disabledOpacity .38`, `-focusOpacity .12`, `-activatedOpacity .24` |
| text | `-primary #fff`, `-secondary rgba(255,255,255,.7)`, `-disabled rgba(255,255,255,.5)`, `-icon rgba(255,255,255,.5)` |
| status | `error-main #c62828` (`-light rgb(209,83,83)`, `-dark rgb(138,28,28)`, `-contrastText #fff`), `warning-main #ffa726`, `info-main #29b6f6`, `success-main #66bb6a`, `starIcon-main #f2b01e` |
| common / grey | `common-black #000`, `common-white #fff`, `common-background #000`, `common-onBackground #fff`, `grey-50…900`, `grey-A100/A200/A400/A700` |
| divider | `--jf-palette-divider rgba(255,255,255,.12)` |
| components | `AppBar-defaultBg #202020` · `SnackbarContent-bg #303030` / `-color rgba(255,255,255,.87)` · `Alert-*FilledBg/-FilledColor/-StandardBg/-IconColor/-Color` (8 states × 4) · `Avatar-defaultBg` · `Button-inheritContainedBg var(--jf-palette-grey-800)` / `-inheritContainedHoverBg var(--jf-palette-grey-700)` · `Chip-defaultBorder/-defaultAvatarColor/-defaultIconColor` · `FilledInput-bg rgba(255,255,255,.09)` / `-hoverBg rgba(255,255,255,.13)` / `-disabledBg rgba(255,255,255,.12)` · `LinearProgress-{primary,secondary,error,info,success,warning}Bg` · `Skeleton-bg` · `Slider-{…}Track` · `SpeedDialAction-fabHoverBg` · `StepConnector-border` · `StepContent-border` · `Switch-defaultColor/-defaultDisabledColor/-{primary,secondary,error,info,success,warning}DisabledColor` · `TableCell-border rgba(81,81,81,1)` · `Tooltip-bg rgba(97,97,97,.92)` |
| opacity | `--jf-opacity-inputPlaceholder .5`, `-inputUnderline .7`, `-switchTrack .3`, `-switchTrackDisabled .2` |

**B4. "Channel" triplets — space-separated `R G B`, meant for `rgba(var(--…Channel) / <alpha>)`.**
Full list: `primary-{main,light,dark,contrastText}Channel`, `secondary-{main,light,dark,contrastText}Channel`,
`error|warning|info|success-{main,light,dark,contrastText}Channel`, `starIcon-mainChannel`,
`background-defaultChannel (16 16 16)`, `background-paperChannel (32 32 32)`,
`action-activeChannel (255 255 255)`, `action-selectedChannel (255 255 255)`,
`text-primaryChannel (255 255 255)`, `text-secondaryChannel (255 255 255)`,
`common-backgroundChannel (0 0 0)`, `common-onBackgroundChannel (255 255 255)`, `dividerChannel (255 255 255)`.
Consumers you can see in the compiled CSS:
`rgba(var(--jf-palette-primary-mainChannel) / var(--jf-palette-action-selectedOpacity))` on
`.paper-icon-button-light:hover/:active` (`_theme.scss:143-155`) and
`rgba(var(--jf-palette-background-paperChannel, 32 32 32) / .8)` on `.detailRibbon`
(`themes/dark/theme.scss:28-32`), plus MUI's `--IconButton-hoverBg` and `--variant-textBg/-outlinedBg`.
**If you change `-main` you must change `-mainChannel` too** — verified: `--jf-palette-background-paperChannel: 24 24 24`
turned `.detailRibbon` into `rgba(24,24,24,.8)`.

**B5. Declared by `themes/<id>/theme.css` on `:root` (4)** — `_base/_theme.scss:57-62`:
`--jf-palette-background-defaultImage: none` · `--jf-palette-AppBar-transparentBg: rgba(0,0,0,.4)` ·
`--jf-palette-AppBar-gradient: none` · `--jf-card-borderRadius: 0.2em`.
All four verified to work from Custom CSS: a `linear-gradient` in `--jf-palette-background-defaultImage` painted
`html` **and** `.backgroundContainer`; a gradient in `--jf-palette-AppBar-gradient` painted `.skinHeader`;
`--jf-card-borderRadius:.5em` moved `.cardPadder`, `.cardContent`, `.cardImageContainer`, `.blurhash-canvas`,
`.itemDetailImage`, `.cardOverlayContainer`, `.paperList`, `.visualCardBox` (and the focus ring uses
`calc(var(--jf-card-borderRadius) + .5em)`).

**B6. Referenced but never declared — a free hook.**
`--jf-palette-FilledInput-borderColor` is read by `.emby-input`, `.emby-textarea`, `.emby-select-withcolor`
(`_base/_theme.scss:394-417`) but is *not* in any stylesheet. Verified: defining it on `:root` changed
`.emby-input` `border-color` to `rgb(229,9,20)` while `background-color` stayed at `--jf-palette-FilledInput-bg`.

**B7. Un-prefixed MUI runtime variables (no `jf`).**
On hashed classes (overridable from Custom CSS via the stable sibling class, since ties go to the later sheet):
`--AppBar-background`, `--AppBar-color` (AppBar), `--variant-containedBg`, `--variant-textBg`,
`--variant-outlinedBg` (Button), `--IconButton-hoverBg` (IconButton).
**Inline on the element** (only reachable through the `--jf-*` they reference, or `!important`):
`--Paper-shadow: var(--jf-shadows-N)`, `--Paper-overlay: var(--jf-overlays-N)`.

### C. Classes toggled by JS (anchors for `:has()` / `:not()`)

| class | on | set by |
|---|---|---|
| `layout-desktop/mobile/tv` | `<html>` | `components/layoutManager.js:8-16` |
| `data-theme="<id>"` | `<html>` | `scripts/themeManager.js:46` |
| `transparentDocument` | `<html>` | `components/backdrop/backdrop.js:301-315` |
| `libraryDocument`, `hideMainDrawer` | `<body>` | `scripts/libraryMenu.js:587-606` |
| `dashboardDocument` | `<body>` | `apps/dashboard/AppLayout.tsx` |
| `withSectionTabs` | `<body>` | `components/maintabsmanager.js` |
| `bodyWithPopupOpen` | `<body>` | `scripts/libraryMenu.js` |
| `hide-scroll` / `noScroll` / `screensaver-noScroll` | `<body>` | `plugins/htmlVideoPlayer/plugin.js`, `components/dialogHelper/dialogHelper.js`, `scripts/screensavermanager.js` |
| `mouseIdle`, `mouseIdle-tv` | `<body>` | `scripts/mouseManager.js:23-37` (5 s idle) |
| `withBackdrop` | `.backgroundContainer` | `components/backdrop/backdrop.js:116-121` |
| `backgroundContainer-transparent` | `.backgroundContainer` | `backdrop.js:301-311` |
| `displayingBackdropImage`, `backdropImageFadeIn` | `.backdropImage` | `backdrop.js:28-35` |
| `semiTransparent`, `headroomDisabled`, `noHeaderRight`, `skinHeader-blurred`, `skinHeader-withBackground` | `.skinHeader` | `scripts/libraryMenu.js`, `src/index.jsx:65-70` |
| `show-focus`, `show-animation` | buttons/cards | TV layout: `elements/emby-button/Button.tsx:31`, `IconButton.tsx:25`, `emby-button.js:38-42`, `cardbuilder/utils/builder.ts:97` |
| `is-active` | `.pageTabContent` | `elements/emby-tabs` |
| `Mui-disabled`, `Mui-focusVisible`, `Mui-selected`, `Mui-error` | MUI nodes | MUI |

Useful anchors, e.g.:
`html.layout-desktop body:not(.dashboardDocument) .MuiAppBar-root {…}`,
`.backgroundContainer:not(.withBackdrop) {…}`,
`body:has(.itemDetailPage:not(.hide)) .MuiAppBar-root {…}` (details-page-only header treatment).

### D. Fonts — what is loaded and where

* `html { font-family: "Noto Sans", "Noto Sans HK", "Noto Sans JP", "Noto Sans KR", "Noto Sans SC", "Noto Sans TC", sans-serif }`
  from `src/styles/fonts.noto.scss:70-72` (plus `html[lang|="ja|ko|zh-*"]` reorderings at `:74-92`).
  `@font-face` blocks come from `@fontsource/noto-sans*` via `src/styles/_font.scss:1-16` — 1108 rules in the
  `73560.*.css` chunk. Fallback before the brand font loads: `Arial, Helvetica, sans-serif` (`site.scss:38-44`).
* Icons: `material-design-icons-iconfont` 6.7.0 — `@font-face { font-family:"Material Icons" }` in the `1133.*.css`
  chunk, used by `.material-icons` (`site.scss:68-71`, `font-feature-settings:"liga"`). **Do not change the
  font-family of `.material-icons` or ligature icons break.**
* MUI typography family: `"Noto Sans", sans-serif`, `button.textTransform:'none'`, `h1 1.8rem / h2 1.5rem / h3 1.17rem`
  (`src/themes/_base/theme.ts:36-51`) — **compiled into the emotion classes, not read from `--jf-font-*`** (G6).
* Loader logic: `src/index.jsx:138-150` — real TVs get `fonts.sized.scss` (system fonts, px sizes).
* `.textarea-mono` forces a monospace stack with `!important` (`fonts.scss:25-41`) — used by the Branding
  Custom-CSS textarea itself.
* Recipe to change the app typeface (verified):
  `html, body { font-family: <stack> } [class*="Mui"] { font-family: <stack> }` plus `@font-face`/Google-Fonts `@import`
  at the very top of the Custom CSS. `line-height: 1.35` is set on `html` (`site.scss:43`).

### E. Focus / selection

* There is **no `::selection` / `::-moz-selection` rule anywhere in the app** (grepped) → browser default. Free to claim.
* No `:focus-visible` rules in the app's own SCSS either; MUI uses the `.Mui-focusVisible` class.
* Legacy focus is opt-in via `.show-focus`, added only on the TV layout:
  `.emby-button.show-focus:focus{transform:scale(1.2); z-index:1}` (`emby-button.scss:34-37`) +
  `background:var(--jf-palette-primary-main); color:var(--jf-palette-primary-contrastText)` (`_theme.scss:481-484`);
  `.paper-icon-button-light.show-focus:focus{transform:scale(1.3)}` (`emby-button.scss:120-123`);
  `.emby-tab-button.show-focus:focus{transform:scale(1.3)!important; background:0!important}` (`emby-tabs.scss:63-67`);
  `.card:focus .cardBox…{border-color:var(--jf-palette-secondary-main)!important}` (`_theme.scss:566-577`).
* Every interactive legacy element sets `outline: none !important`
  (`emby-button.scss:13,109`, `emby-input.scss:14`, `emby-select.scss:89`, `emby-textarea.scss:19`) →
  a custom focus ring must be drawn with `box-shadow`/`border`, and needs `!important` if you want `outline` back.
* `.emby-checkbox:focus + span + .checkboxOutline{border-color:var(--jf-palette-common-white)}` and
  `:focus:not(:checked)` → `--jf-palette-secondary-main` (`_theme.scss:437-448`).
* `--jf-palette-secondary-main` is the designated "focus/interactive" colour and defaults to `$primary-main`
  (`_base/_theme.scss:44-47`) — set it separately if the Netflix red should not double as the focus colour.

### F. Scrollbars

```
*                                             { scrollbar-width: thin; scrollbar-color: #3b3b3b #202020 }   _theme.scss:64-67
::-webkit-scrollbar-track                     { box-shadow: inset 0 0 6px rgba(0,0,0,.3) }                  _theme.scss:579-581
::-webkit-scrollbar-track-piece               { background-color: #3b3b3b }                                 _theme.scss:583-585
.layout-desktop ::-webkit-scrollbar,
.layout-tv      ::-webkit-scrollbar           { width: .4em; height: .4em }                                 _theme.scss:587-591
::-webkit-scrollbar-thumb:horizontal/:vertical{ border-radius: 2px; background: center no-repeat #888 }      _theme.scss:593-597
.hiddenScrollX::-webkit-scrollbar,
.layout-tv .scrollX::-webkit-scrollbar        { height: 0 !important; display: none }                       scrollstyles.scss:21-25
.hiddenScrollY::-webkit-scrollbar, …          { width: 0 !important; display: none }                        scrollstyles.scss:52-57
```
Measured live on `modern-desktop`: `html`/`body`/`.scrollX` all report `scrollbar-color: rgb(59,59,59) rgb(32,32,32)`,
`scrollbar-width: thin`; `body` is `overflow-x:hidden / overflow-y:auto` (the page scroller); `.scrollX` is
`overflow-x:auto; overflow-y:hidden; white-space:nowrap`.

---

## Netflix-relevance notes

| Netflix element | Jellyfin 12.1 equivalent at this layer | how |
|---|---|---|
| Near-black page (`#141414`) | `html` + `.backgroundContainer` | `:root{--jf-palette-background-default:#141414}` — one line, verified |
| Netflix red (`#E50914`) | primary everywhere: `.button-submit`, `.checkboxOutline`, `.itemProgressBarForeground`, `.countIndicator`, MUI contained buttons | `:root{--jf-palette-primary-main:#e50914; --jf-palette-primary-mainChannel:229 9 20; --jf-palette-primary-contrastText:#fff}`. **Do not skip contrastText** — it stays `rgba(0,0,0,.87)` otherwise and the CTA label goes black-on-red |
| Transparent header that fades to a gradient on scroll | **modern**: `.MuiAppBar-root.MuiAppBar-colorTransparent` (verified: `background-image:linear-gradient(...)` applies); **legacy/TV**: `.skinHeader.semiTransparent` via `--jf-palette-AppBar-transparentBg` + `.skinHeader-withBackground` via `--jf-palette-AppBar-gradient` (both verified) | note the two shells need two rules |
| Hero/billboard with a bottom fade | `.backdropContainer > .backdropImage` (fixed, `z-index:-1`) + `.backgroundContainer.withBackdrop{opacity:.86}` | the vignette is best done as a `::after` on `.backdropContainer`; **`opacity:.86` on `.backgroundContainer` fades the whole colour sheet, so reduce it and add your own gradient instead** |
| Full-bleed page background gradient | `--jf-palette-background-defaultImage` (verified with a `linear-gradient`) — applied to `html`, `.backgroundContainer`, `.nowPlayingPlaylist` with `background-size:cover; background-position:top center` | |
| Flat dark menus/dropdowns (no Material elevation tint) | MUI `Paper` | `:root{--jf-overlays-1…24:none}` + `--jf-shadows-*` (verified); `--jf-palette-background-paper:#181818` |
| Rounded-4px cards | `--jf-card-borderRadius` (verified) — reaches `.cardPadder`, `.cardContent`, `.cardImageContainer`, `.blurhash-canvas`, `.itemDetailImage`, `.cardOverlayContainer`, `.paperList`, `.visualCardBox`, and the focus ring via `calc(… + .5em)` | Netflix uses ~4px → `0.27em` at 14.88px, or just `4px` |
| Netflix Sans / Bebas-style display font | `html, body` + `[class*="Mui"]` font-family (verified); `--jf-font-*` does **not** work (G6) | keep `.material-icons` untouched |
| Wide 4 %/60px gutters | `[dir="ltr"] .padded-left` / `.padded-right` / `.emby-scroller` (currently `max(3.3%, env(safe-area-inset-*))`) | needs (0,2,0) specificity |
| Thin/invisible scrollbars | `*{scrollbar-*}` (0,0,0) and `.layout-desktop ::-webkit-scrollbar` (0,1,0) | see §F |
| Red focus ring on TV/keyboard | `.show-focus` family + `--jf-palette-secondary-main` | all legacy controls have `outline:none!important`, so use `box-shadow` |

**Impossible / not worth attempting in pure CSS at this layer**

* **Hover-to-expand card previews with autoplay trailers.** Needs JS + a video element; CSS can only scale/elevate the
  existing `.card` (and `.cardBox` sits inside `.mainAnimatedPage{contain:layout style size}` and
  `.emby-scroller{overflow-x:auto}`, so a scaled card is clipped horizontally unless you also relax that overflow).
* **A real "Top 10" rank badge** (the big outlined numeral) — there is no per-position element and CSS counters cannot
  read the server's ranking.
* **Reordering rows or re-grouping sections** — the home sections are produced by JS in DOM order; `order`/`flex` can
  reorder siblings only if the parent is made a flex/grid container, and `.homeSectionsContainer` children are plain
  blocks. Anything content-driven (e.g. "continue watching first") is out of reach.
* **Changing the header's scroll behaviour.** The legacy `.headroom--pinned/--unpinned` transform is driven by JS;
  in the modern shell the AppBar is `position:fixed` from MUI with no scroll-state class at all, so a
  "transparent → solid on scroll" header cannot be expressed without JS (a `body:has()` trick has nothing to hang on).
* **Killing the elevation overlay for a specific Paper only** — `--Paper-overlay` is inline per element (G5); you can
  only neutralise it globally via `--jf-overlays-*` or per selector with `background-image:none!important`.
* **Text-fitting / truncation counts, marquee titles, dynamic contrast against the backdrop** — all JS.
* **Pre-paint theming.** Custom CSS is React-rendered after the branding API responds, so the stock dark UI flashes
  first. Only a server-side `index.html` patch (out of scope for a Custom-CSS theme) could avoid it.

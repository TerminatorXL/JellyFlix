# Cards, scrollers and home sections — Jellyfin 12.1 DOM/CSS map

Source of truth: `_ref/jellyfin-web` @ `v12.1` (`git describe` = `v12.1`).
Everything below was either read in that source or observed in a live dump against the
`jellyflix-test` container. Live-verified combinations are listed at the end of each section.

**The single most important fact:** Jellyfin 12.1 has **two different card renderers** that emit
**different DOM for the same visual card**:

| renderer | file | emits | used on |
|---|---|---|---|
| legacy string builder | `src/components/cardbuilder/cardBuilder.js:736` (`buildCard`) | `<a class="cardImageContainer cardContent lazy">` (one element), `<bdi>` inside `.cardText`, `background-image` set inline by `imageLoader` | **the whole home page (both layouts)**, favorites, details page, Live TV, legacy library pages |
| React components | `src/components/cardbuilder/Card/*.tsx` | `.cardContent > .cardImageContainer` (two elements), `<img>` with inline styles, MUI `Box`/emotion classes | modern library grids (`#/movies`, `#/tv`), suggestions/upcoming/genres/programs sections |

The home page is **not** React in 12.1: `src/apps/modern/routes/home.tsx:74` dynamically imports
`apps/legacy/controllers/hometab`, so `modern-desktop` and `legacy-desktop` produce **byte-identical
home markup** (verified live). Only `<html class>` differs (`layout-desktop` in both cases for the
desktop profiles; `layout-mobile` for mobile; `layout-tv` for TV).

---

## Where it appears (routes, layouts, breakpoints)

| Area | Routes | Layouts | Renderer |
|---|---|---|---|
| Home sections (`.homeSectionsContainer`) | `#/home`, `#/home?tab=1` (favorites) | desktop / mobile / tv | legacy (`homesections.js` + `cardBuilder.js`) |
| Horizontal scroller rows | home, details page, search, suggestions | all | `emby-scroller` (legacy custom element) or `Scroller.tsx` (React) |
| Library grid (`vertical-wrap`) | `#/movies`, `#/tv`, `#/list?...` | desktop / mobile | React `Cards` via `ItemsView.tsx:173` |
| Legacy library grid | same routes with Legacy layout | desktop-legacy / mobile-legacy | legacy `cardBuilder` |
| Cast / similar / next-up on details | `#/details?id=…` | all | legacy (`.detailVerticalSection`) |
| Lists (`.listItem`) | `#/details` season/episode lists, search, playlists | all | `listview.js` (legacy) / `listview/List/*.tsx` (React) |

**Layout switch** — `layoutManager` decides, and it changes the DOM, not just CSS:

* `layoutManager.desktop` → `.card` gets `card-hoverable`, a `.cardOverlayContainer` hover menu is
  rendered (`cardBuilder.js:985` → `getHoverMenuHtml` at `:997`, `CardBox.tsx:61`), scroll buttons exist.
* `layoutManager.mobile` → no hover menu; instead permanently-visible overlay buttons
  (`cardBuilder.js:828`, `CardOverlayButtons.tsx`); scroller falls back to native `overflow-x:auto`.
* `layoutManager.tv` → the card root becomes `<button class="card … show-focus show-animation itemAction">`
  (`CardWrapper.tsx:15`, `cardBuilder.js:930`), `.itemsContainer` gains `itemsContainer-tv`.

**Breakpoints.** All card-width media queries in `card.scss` are in `em`, which in a media query is
always the **browser default 16 px**, not the document font size. So:

| `em` | px | affects |
|---|---|---|
| 25em | 400 | `.backdropCard`, `.overflowPortraitCard` |
| 31.25em | 500 | `.smallBackdropCard`, `.squareCard`, `.portraitCard` |
| 35em | 560 | `.overflowSquareCard`, `.overflowBackdropCard`, `.overflowSmallBackdropCard` |
| 43.75em | 700 | `.squareCard`, `.portraitCard`, overflow square/portrait |
| 48.125em | 770 | `.backdropCard`, overflow backdrop |
| 50em | 800 | `.bannerCard`, `.squareCard`, `.portraitCard`, `.smallBackdropCard`, overflow square/portrait, `.cardBox-bottompadded` |
| 62.5em | 1000 | `.smallBackdropCard` |
| 75em | 1200 | backdrop / square / portrait / banner / smallBackdrop + overflow variants |
| 87.5em | 1400 | square/portrait + overflow square/portrait |
| 100em | 1600 | smallBackdrop, backdrop, square/portrait + overflow variants |
| 120em | 1920 | square/portrait + overflow square/portrait |
| 131.25em | 2100 | banner, square/portrait + overflow square/portrait |
| 156.25em | 2500 | backdrop + overflow backdrop/smallBackdrop |

There is also an `@media (orientation: landscape)` block (`card.scss:718-741`) that overrides the
overflow-card widths — on a landscape phone/tablet the widths come from there, not from the width
queries.

The **document** font size is `html { font-size: 93% }` (`src/styles/fonts.scss:6`) →
**14.88 px** live on modern-desktop. Every `em` inside `card.scss` (paddings, margins, radii)
resolves against that, so `.cardBox { margin: 0.6em }` = 8.93 px and
`.cardBox-bottompadded { margin-bottom: 1.8em }` = 26.8 px.

---

## DOM skeleton (real markup, trimmed)

### 1. Home page (modern-desktop **and** legacy-desktop — identical)

```
div#indexPage.page.mainAnimatedPage.homePage.libraryPage.allLibraryPage.pageWithAbsoluteTabs.withTabs   {contain: style size !important}
  div#homeTab.tabContent.pageTabContent.is-active [data-index=0]
    div.sections.homeSectionsContainer                              ← homesections.js:75
      div.verticalSection.section0.emby-scroller-container          ← "My media" (SmallLibraryTiles)
        h2.sectionTitle.sectionTitle-cards.padded-left  "Moje multimedia"
        div.emby-scrollbuttons.padded-right [is=emby-scrollbuttons] ← SIBLING, precedes the scroller
          button.emby-scrollbuttons-button.paper-icon-button-light[.hide]
            span.material-icons.chevron_left
          button.emby-scrollbuttons-button.paper-icon-button-light[.hide]
            span.material-icons.chevron_right
        div.padded-top-focusscale.padded-bottom-focusscale.emby-scroller [is=emby-scroller]
          div.itemsContainer.scrollSlider.focuscontainer-x.animatedScrollX [is=emby-itemscontainer]
            div.card.overflowBackdropCard.card-hoverable.card-withuserdata […data-*]
            div.card… (×N)
      div.verticalSection.section1.hide.emby-scroller-container     ← Continue watching (empty ⇒ .hide)
      div.verticalSection.section2.hide…                            ← Continue listening
      div.verticalSection.section3.hide…                            ← Continue reading
      div.verticalSection.section4                                  ← unused slot, height 0
      div.verticalSection.section5.hide.emby-scroller-container     ← Next up
        div.sectionTitleContainer.sectionTitleContainer-cards.padded-left
          a.button-flat.button-flat-mini.sectionTitleTextButton.emby-button [is=emby-linkbutton]
            h2.sectionTitle.sectionTitle-cards  "Do obejrzenia"
            span.material-icons.chevron_right
        …scrollbuttons + scroller…
      div.section6                                                  ← Latest media HOST (verticalSection REMOVED)
        div.verticalSection.emby-scroller-container                 ← one per library
          div.sectionTitleContainer.sectionTitleContainer-cards.padded-left
            a.more.button-flat.button-flat-mini.sectionTitleTextButton.emby-button
              h2.sectionTitle.sectionTitle-cards "Filmy — ostatnio dodane"
              span.material-icons.chevron_right
          div.emby-scrollbuttons.padded-right
          div.…emby-scroller > div.itemsContainer.scrollSlider.focuscontainer-x.animatedScrollX
            div.card.overflowPortraitCard.card-hoverable.card-withuserdata (×16)
        div.verticalSection.emby-scroller-container                 ← next library
      div.verticalSection.section7 / .section8 / .section9          ← empty slots, height 0
```

Modern-**mobile** home (same HTML, different scroller mode — no scroll buttons at all):

```
div.verticalSection.section0                                        ← NO .emby-scroller-container
  h2.sectionTitle.sectionTitle-cards.padded-left
  div.padded-top-focusscale.padded-bottom-focusscale.emby-scroller.scrollX.hiddenScrollX
      {overflow: auto hidden}                                       ← native scroll
    div.itemsContainer.scrollSlider.focuscontainer-x                ← NO .animatedScrollX
      div.card.overflowBackdropCard.card-withuserdata               ← NO .card-hoverable
```

### 2. Legacy card (home / details / favorites / legacy library) — `cardBuilder.js:988`

```
div.card.overflowPortraitCard.card-hoverable.card-withuserdata
    [data-index data-isfolder data-serverid data-id data-type data-mediatype
     data-context="home" data-prefix data-positionticks data-path …]
  div.cardBox.cardBox-bottompadded                        ← .visualCardBox instead when cardLayout:true
    div.cardScalable
      div.cardPadder.cardPadder-overflowPortrait[.lazy-hidden-children]   ← aspect-ratio spacer
        span.cardImageIcon.material-icons.movie                            ← placeholder glyph
      canvas.blurhash-canvas[.lazy-hidden]                ← INSERTED BY JS before the image element
      a.cardImageContainer.coveredImage.cardContent.itemAction.lazy.blurhashed.lazy-image-fadein-fast
          [href role="img" aria-label data-action="link" data-src data-blurhash]
          style="background-image:url(…)"                 ← INLINE, set by imageLoader.js:122
        div.cardIndicators
          div.countIndicator.indicator            "6"     (or .playedIndicator.indicator > span.material-icons.check)
          div.hide.progressring [is=emby-itemrefreshindicator]
        div.innerCardFooter[.fullInnerCardFooter][.innerCardFooterClear]   ← only when overlayText/progress
          div.cardText …
          div.itemProgressBar > div.itemProgressBarForeground[style="width:NN%"]
      button.cardOverlayButton.cardOverlayButton-br.itemAction            ← MOBILE only, always visible
      div.cardOverlayContainer.itemAction [data-action]                   ← DESKTOP only, hover menu
        button.cardOverlayButton.cardOverlayButton-hover.itemAction.paper-icon-button-light.cardOverlayFab-primary
            [data-action="resume"]
          span.material-icons.cardOverlayButtonIcon.cardOverlayButtonIcon-hover.play_arrow
        div.cardOverlayButton-br.flex
          button…[is=emby-playstatebutton]   > span.material-icons.…check.playstatebutton-icon-unplayed
          button…[is=emby-ratingbutton]      > span.material-icons.…favorite
          button…[data-action="menu"]        > span.material-icons.…more_vert
    div.cardText.cardTextCentered.cardText-first          ← NO .cardFooter wrapper (see gotcha #3)
      bdi > a.itemAction.textActionButton "Glass Onion…"
    div.cardText.cardTextCentered.cardText-secondary
      bdi "2022"
```

### 3. React card (modern library grid) — `Card.tsx` → `CardBox.tsx` → `CardContent.tsx`

```
div.itemsContainer.padded-left.padded-right.vertical-wrap.MuiBox-root.css-0
  div.card.portraitCard.card-hoverable.card-withuserdata [data-* same set]
    div.cardBox.cardBox-bottompadded
      div.cardScalable
        div.cardPadder.cardPadder-portrait                ← EMPTY (no icon child in React path)
        div.cardContent                                   ← SEPARATE element (legacy merges it)
          div.cardImageContainer.coveredImage
            div.indicators.MuiBox-root.css-0
              div.cardIndicators.MuiBox-root.css-0
                div.playedIndicator.indicator.MuiBox-root.css-0
                  svg.MuiSvgIcon-root.indicatorIcon.css-iguwhy [data-testid=CheckIcon]
                div.countIndicator.indicator.unplayedItemCount.MuiBox-root.css-0  "6"
            div                                           ← UNCLASSED wrapper from Image.tsx:43
              img [src] style="position:absolute;inset:0;width:100%;height:100%;
                               z-index:0;object-fit:cover;opacity:1;transition:0.1s"
            (BlurhashCanvas — inline-styled <canvas>, NO .blurhash-canvas class)
        div.cardOverlayContainer.itemAction.MuiBox-root.css-0        ← desktop
          a.cardImageContainer [href aria-label]          ← 2nd element with this class!
          button.MuiButtonBase-root.MuiIconButton-root.paper-icon-button-light
                 .cardOverlayButton.cardOverlayButton-hover.itemAction.cardOverlayFab-primary.css-mk0p0t
            svg.MuiSvgIcon-root.css-iguwhy [data-testid=PlayArrowIcon]
          div.MuiButtonGroup-root.…cardOverlayButton-br.flex.css-xsgcp5 [role=group]
            button…css-1vwv0k3 (played) / (favorite) / …css-mk0p0t (menu)
        a [href aria-label] style="position:absolute;inset:0;user-select:none;border-radius:0.2em"
                                                          ← MOBILE: UNCLASSED full-card anchor
          div.MuiButtonGroup-root.…cardOverlayButton-br.css-xsgcp5
            button.…cardOverlayButton.itemAction.css-mk0p0t [data-action=play]
      div.cardText.cardTextCentered.cardText-first.MuiBox-root.css-0
        a.itemAction.textActionButton "Batman"            ← NO <bdi> in the React path
      div.cardText.cardTextCentered.cardText-secondary.MuiBox-root.css-0  "2022"
```

### 4. List view (`#/details` season page, live)

```
div.listItem.listItem-largeImage.listItem-withContentWrapper [data-type=Episode data-action=none]
  div.listItem-content
    div.listItemImage.listItemImage-large.itemAction.lazy.non-blurhashable.lazy-image-fadein-fast
      button.listItemImageButton.itemAction.paper-icon-button-light [data-action=resume]
        span.material-icons.listItemImageButton-icon.play_arrow
    div.listItemBody.itemAction
      div.listItemBodyText > bdi "1. Pilot"
      div.secondary.listItemMediaInfo.listItemBodyText
        div.mediaInfoItem / div.starRatingContainer.mediaInfoItem / div.endsAt.mediaInfoItem
      div.secondary.listItem-overview.listItemBodyText > bdi
    div.listViewUserDataButtons
      button.listItemButton.itemAction.paper-icon-button-light (×4)
  div.listItem-bottomoverview.secondary
```

---

## Selector table

Legend for "safe to style": **yes** = no `!important`/inline conflict; **care** = specificity or
JS-set value fights you; **no** = inline style or emotion hash, needs `!important` or a different anchor.

### Card core

| selector | what it is | layout(s) | safe to style? | notes (file:line) |
|---|---|---|---|---|
| `.card` | card root, `div` (or `button` on TV) | all | **care** | 10 `!important` declarations: `font-size/family/weight`, `background`, `background-color`, `color`, `outline` — `card.scss:10-27`. `contain: layout style paint` when not `.show-animation` (`card.scss:29`) ⇒ **clips everything** |
| `.card.show-animation` | TV only | tv | yes | drops `contain: paint`; enables the built-in focus zoom `card.scss:101-118` |
| `.card.show-focus` | TV only | tv | yes | focus ring implemented as transparent border `card.scss:106-114` |
| `.card-hoverable` | present iff `layoutManager.desktop` | desktop | yes | the only hover hook: `.card-hoverable:hover/:focus-within` `card.scss:861-867` |
| `.card-withuserdata` | not MusicAlbum/Artist/Audio | all | yes | `builder.ts:100`, `useCard.ts:93` |
| `.itemAction` | click delegation marker | tv card root, links, buttons | yes | no styling of its own |
| `.groupedCard` | `showChildCountIndicator && ChildCount` | all | yes | `builder.ts:99` |
| `.portraitCard` `.backdropCard` `.squareCard` `.bannerCard` `.smallBackdropCard` | grid shapes, **`width` in %** | all | **care** | `card.scss:507-669` + 12 media queries |
| `.overflowPortraitCard` `.overflowBackdropCard` `.overflowSquareCard` `.overflowSmallBackdropCard` | scroller shapes, **`width` in vw** | all | **care** | `card.scss:671-821`; `.overflowBackdropCard-textCard` uses `width: … !important` (`card.scss:806`) |
| `.mixedPortraitCard` `.mixedSquareCard` `.mixedBackdropCard` | `em`-width shapes | all | yes | `card.scss:527-537` |
| `.itemsContainer-tv > .*Card` | TV width overrides | tv | yes | `card.scss:659-669, 802-821` |
| `.cardBox` | inner box that carries the card margin | all | **care** | `padding: 0 !important`, `outline: none !important`, `contain: style` `card.scss:88-99` |
| `.cardBox.visualCardBox` | "card layout" variant (solid tile w/ footer) | all | yes | `card.scss:276-279`; theme paints it `_theme.scss:228-231` |
| `.cardBox-bottompadded` | extra bottom margin when an outer footer exists | all | **care** | `margin-bottom: 1.8em !important` (1.2em ≤50em) `card.scss:120-128` |
| `.cardScalable` | positioning context for image/overlay | all | yes | `position: relative; contain: layout style` `card.scss:53-56` |
| `.cardPadder` + `.cardPadder-{shape}` | aspect-ratio spacer (`padding-bottom` %) | all | **care** | `contain: strict` `card.scss:58-86`; 56.25 % backdrop / 100 % square / 150 % portrait / 18.5 % banner; background painted by theme `_theme.scss:242` |
| `.cardPadder.lazy-hidden-children` | added after the image fades in | legacy only | yes | hides the placeholder glyph, `imageLoader.js:103`, `images/style.scss:21` |
| `.cardContent` | absolute fill layer | all | **care** | `margin/border/padding: 0 !important`, `outline: none !important`, `contain: strict`, `overflow: hidden` `card.scss:197-222`. **Legacy: same element as `.cardImageContainer`. React: separate parent.** |
| `.cardImageContainer` | image surface | all | **care** | `background-clip: content-box !important` `card.scss:173`; `contain: strict` when inside `.cardScalable` `card.scss:182-186`. **Matches twice per React card** (also the overlay's `<a>`, `CardHoverMenu.tsx:50`) |
| `.coveredImage` / `.coveredImage-contain` | `background-size: cover / contain` | all | yes | `card.scss:262-269`; React sets `object-fit` inline instead |
| `.defaultCardBackground` `.defaultCardBackground1..5` | hashed placeholder colour | all | yes | `builder.ts:135`, colour defined per theme |
| `.textCardImageContainer` / `.chapterCardImageContainer` | `#333` / `#000` fills | all | yes | `card.scss:188-195` |
| `.blurhash-canvas` | blurhash `<canvas>` | legacy only | yes | inserted by `imageLoader.js:42` **as a sibling before the image**; `images/style.scss:26-35`; React uses an inline-styled canvas with **no class** (`Image.tsx:45`) |
| `.lazy` `.lazy-hidden` `.lazy-image-fadein` `.lazy-image-fadein-fast` `.blurhashed` `.non-blurhashable` | image-loading state classes | legacy only | yes | `imageLoader.js:99-160`, `images/style.scss:11-24` |
| `.cardImage` | `<img>` variant (rarely used) | all | yes | `card.scss:250-260` |
| `.cardImageIcon` | placeholder material icon | all | yes | `font-size: 5em` `card.scss:389`; centred by `transform: translate(-50%,-50%)` in `.cardPadder` `card.scss:394-400` |
| `.cardDefaultText` | text placeholder when no icon | all | yes | `card.scss:382-387` |

### Card footers and text

| selector | what it is | layout(s) | safe to style? | notes |
|---|---|---|---|---|
| `.cardFooter` | outer footer **wrapper** | all | yes | `card.scss:271-274`. **Only emitted when `cardLayout:true` or a logo exists or it is the inner footer** — `cardBuilder.js:600-605`, `CardFooterText.tsx:39`. **Absent on the whole home page.** |
| `.cardFooter-transparent` | class added when `!cardLayout` | all | yes | **has no CSS rule anywhere in 12.1** — free hook |
| `.cardFooter-vibrant` | legacy vibrant footer | — | yes | only styled in `_theme.scss:268`, never emitted by 12.1 code — dead hook |
| `.cardFooter-withlogo` / `.cardFooterLogo` | channel/parent logo footer | all | yes | `card.scss:357-371`; legacy emits `div.lazy.cardFooterLogo[data-src]` (`cardBuilder.js:374`), React emits `Box.cardFooterLogo > Image` |
| `.innerCardFooter` | overlay footer inside the image | all | yes | `background: rgba(0,0,0,.7); position:absolute; bottom:0; z-index:1` `card.scss:281-291` |
| `.fullInnerCardFooter` | stretches to `right: 0` | all | yes | `card.scss:297` |
| `.innerCardFooterClear` | transparent variant (progress-only) | all | yes | `card.scss:293` |
| `.cardText` | one text line | all | **care** | `white-space:nowrap; overflow:hidden; text-overflow:ellipsis` + dir-scoped `text-align` `card.scss:301-314` |
| `.cardText-first` / `.cardText-secondary` | 1st / 2nd+ line of the **outer** footer | all | yes | `card.scss:320-326`; `-secondary` colour from `--jf-palette-text-secondary` `_theme.scss:254-262` |
| `.cardTextCentered` | `text-align: center !important` | all | **care** | `card.scss:373-376` — beats any plain `text-align` you write |
| `.cardText-rightmargin` | mobile + cardLayout only | mobile | yes | `card.scss:378` |
| `.textActionButton` | link inside `.cardText` | all | **care** | 4 `!important`s (`border`, `padding`, `outline`) `card.scss:328-351`; underlines on hover |
| `bdi` (unclassed) | wraps legacy card text | legacy only | yes | `cardBuilder.js:286`; **absent in React cards** — do not rely on it |
| `.btnCardOptions` | mobile "more" button in the footer | mobile + cardLayout | yes | `card.scss:136-142` |

### Indicators and progress

| selector | what it is | layout(s) | safe to style? | notes |
|---|---|---|---|---|
| `.cardIndicators` | top-right indicator strip | all | yes | `position:absolute; top:.225em; right:.225em; z-index:1; contain:layout style` `card.scss:406-421` |
| `.indicators` | React-only outer `Box` | modern grids | yes | `CardImageContainer.tsx:42`, no CSS of its own |
| `.indicator` | shared 2em round badge | all | yes | `indicators.scss:30-38`; `+ .indicator` margin `:48-56` |
| `.playedIndicator` | check badge | all | yes | `indicators.scss:75-83`; background `--jf-palette-primary-main` `_theme.scss:455-460` |
| `.countIndicator` | unplayed/child count badge | all | yes | `indicators.scss:64-73` |
| `.countIndicator.unplayedItemCount` / `.childCountIndicator` | **React only** extra classes | modern grids | yes | `useIndicator.tsx:145,159`; legacy emits only `countIndicator indicator` (`indicators.js:81,96`) |
| `.videoIndicator` `.timerIndicator` `.syncIndicator` `.missingIndicator` `.unairedIndicator` | type/status badges | all | yes | `indicators.scss:40-46, 85-114` |
| `.indicatorIcon` | glyph inside a badge | all | yes | `font-size:1.6em` `indicators.scss:58-62`; `<span class="material-icons">` legacy vs `<svg class="MuiSvgIcon-root">` React |
| `.mediaSourceIndicator` | "N versions" bubble, top-left | all | **care** | hard-coded `background: rgb(51,136,204)` in `card.scss:144-162`, re-themed in `_theme.scss:455` |
| `.itemProgressBar` | legacy resume bar track | legacy | yes | `indicators.scss:1-6` |
| `.itemProgressBarForeground` | legacy fill | legacy | **care** | **`style="width:NN%"` is inline** (`indicators.js:19,33`); colour = `--jf-palette-primary-main` `_theme.scss:441-443` |
| `.itemProgressBarForeground-recording` | recording fill | legacy | yes | `--jf-palette-error-light` `_theme.scss:450` |
| `.itemLinearProgress` | **React** resume bar (MUI `LinearProgress`) | modern grids | **no** | `position: absolute !important` `indicators.scss:8-14`; the *bar* colour `#00a4dc` comes from an `sx` prop → emotion hash `useIndicator.tsx:192-197` |
| `.progressring` `[is=emby-itemrefreshindicator]` | library refresh ring | all | yes | inside `.cardIndicators` for CollectionFolder cards |

### Overlays / hover menu

| selector | what it is | layout(s) | safe to style? | notes |
|---|---|---|---|---|
| `.cardOverlayContainer` | full-card dim layer | desktop | yes | `background: rgba(0,0,0,.5); opacity:0; transition: opacity .2s; pointer-events:none` with `* { pointer-events: auto }` `card.scss:823-841` |
| `.cardOverlayButton` | overlay icon button | all | **care** | `.cardOverlayButton.paper-icon-button-light` nested rule exists *specifically* to out-specify MUI `card.scss:453-455` |
| `.cardOverlayButton-hover` | fades in with the container | desktop | yes | `card.scss:850-855` |
| `.cardOverlayButton-br` | bottom-right button group | all | yes | `card.scss:458-469`; React renders it as a `MuiButtonGroup` |
| `.cardOverlayButton-centered` | mobile centred play FAB | mobile | **care** | `background-color: … !important`, `padding: …!important` `card.scss:488-505` |
| `.cardOverlayFab-primary` | desktop centred play FAB | desktop | yes | `card.scss:869-885`; hover `transform: scale(1.4)` |
| `.cardOverlayButtonIcon` | round icon chip | all | **care** | `background-color: …!important; width/height: 1.5em !important; font-size: 1.669…em !important` `card.scss:471-486` |
| `.cardOverlayButtonIcon-hover` | transparent variant | desktop | **care** | `background: transparent !important` `card.scss:857` |
| `.paper-icon-button-light` | legacy icon button base | all | care | shared with the rest of the app |
| unclassed `<a style="position:absolute;inset:0;…">` | **React mobile** full-card link | modern mobile | **no** | `CardOverlayButtons.tsx:66-78`; only reachable via `.cardScalable > a:not([class])` or `:has()` |

### Scrollers

| selector | what it is | layout(s) | safe to style? | notes |
|---|---|---|---|---|
| `.emby-scroller` | scroll frame | all | **care** | `padding-left/right: max(3.3%, safe-area)` `emby-scroller.scss:7-10`; **this is the row gutter** |
| `.emby-scroller-container` | added to the scroller's **parent** when scroll buttons mount | desktop only | yes | `position: relative` `emby-scroller.scss:3-5`; added by `emby-scrollbuttons.js:149` / `ScrollButtons.tsx:34` |
| `.scrollSlider` | the element actually translated | all | **no** | JS sets `style.will-change = transform`, `style.transition`, `style.transform = translateX(-Npx)` (`lib/scroller/index.js:337,772-773`), and `white-space: nowrap` (`emby-scroller.js:116`) |
| `.animatedScrollX` / `.animatedScrollY` | transform-scroll mode marker | desktop, tv | yes | `lib/scroller/index.js:776-778` |
| `.scrollX` `.hiddenScrollX` `.hiddenScrollX-forced` `.smoothScrollX` | native-scroll mode on the **frame** | mobile, tv | **care** | `scrollstyles.scss:1-25`; `overflow-x:auto; overflow-y:hidden; white-space:nowrap`, scrollbar hidden with `height: 0 !important` |
| `.itemsContainer` | card container | all | yes | `display: flex` `card.scss:33-35`; `margin: 0 auto` `librarybrowser.scss:1197` |
| `.itemsContainer > .card > .cardBox` | first-card alignment rule | all | **care** | `margin-left: 0; margin-right: 1.2em` (dir-scoped) `emby-scroller.scss:18-28` — this is why row items are 1.2em apart but flush with the heading |
| `.vertical-wrap` / `.vertical-list` / `.centered` | grid / list / centred modes | all | yes | `card.scss:37-51` |
| `.focuscontainer-x` | TV focus container | all | yes | no visual CSS |
| `.emby-scrollbuttons` | prev/next button strip | desktop only | yes | `position:absolute; top:0; right:0; min-width:104px; padding-top:.85em; z-index:1; color:#fff` `emby-scrollbuttons.scss:1-20` |
| `.emby-scrollbuttons-button` `.btnPrev` `.btnNext` | the two buttons | desktop | yes | `.btnPrev/.btnNext` exist **only in the React path** (`ScrollButtons.tsx:48,56`); the legacy path uses `data-direction="left|right"` (`emby-scrollbuttons.js:18`) |
| `.emby-scrollbuttons-button.hide` | legacy: row fits ⇒ buttons hidden | desktop | yes | `emby-scrollbuttons.js:49-55`; React unmounts the whole strip instead (`Scroller.tsx:236`) |
| ~~`.emby-scrollbuttons-scrollstart` / `-scrollend`~~ | **does not exist in 12.1** | — | — | grepped: 0 hits in `src/`. Edge state is expressed as `button[disabled]` |
| `.no-padding` | removes the scroller gutter | all | yes | `emby-scroller.scss:30-38` |
| `.padded-left` `.padded-right` | `max(3.3%, safe-area)` gutters | all | **care** | `librarybrowser.scss:1326-1344` |
| `.padded-right-withalphapicker` | 7.5 % right gutter on library grids | all | yes | `librarybrowser.scss:1365-1371` |
| `.padded-top-focusscale` / `.padded-bottom-focusscale` | TV focus-zoom breathing room | tv only | yes | `padding:1.5em; margin:-1.5em` `librarybrowser.scss:1354-1361`; **no-ops off TV** |

### Home sections

| selector | what it is | layout(s) | safe to style? | notes |
|---|---|---|---|---|
| `.sections` | tab content host | all | yes | in the React page shell `home.tsx:178` |
| `.homeSectionsContainer` | added to `.sections` once views load | all | yes | `homesections.js:75`; **no CSS rule in 12.1** — free hook |
| `.verticalSection` | one home row | all | yes | **no base CSS rule in 12.1** (only `.verticalSection-extrabottompadding` `librarybrowser.scss:1223`) — free hook |
| `.section0` … `.section9` (`.section10` on TV) | slot index, **not** `.homeSection0` | all | yes | `homesections.js:71`; `MAX_SECTIONS = 10`, `MAX_SECTIONS_TV = 11` `homesections.js:24-25` |
| `.section6` w/o `.verticalSection` | "Latest media" host — the class is **removed** | all | **care** | `recentlyAdded.ts:155`; it then holds one `.verticalSection` per library (`recentlyAdded.ts:168-173`). Same trick for library buttons (`libraryButtons.ts:31`) |
| `.hide` | section has no items | all | yes | toggled by `emby-itemscontainer.js:427-429`; `display:none` (verified live) |
| `.sectionTitle` | `<h2>` row heading | all | yes | no rule in `librarybrowser.scss`; only `.sectionTitleContainer > .sectionTitle` `:1242` and `div:not(.sectionTitleContainer-cards) > .sectionTitle-cards` `:1254` |
| `.sectionTitle-cards` | heading above a card row | all | **care** | `librarybrowser.scss:1254-1263` uses `div:not(.sectionTitleContainer-cards) >` — a *parent-dependent* selector |
| `.sectionTitleContainer` / `.sectionTitleContainer-cards` | heading + "see all" wrapper | all | yes | `margin: 1.25em 0` / `margin:0; padding-top:1.25em` `librarybrowser.scss:1238-1252` |
| `.sectionTitleTextButton` | the clickable heading link | all | **care** | `margin: 0 !important; display: inline-flex !important; color: inherit !important` `librarybrowser.scss:1305-1322` |
| `.more` | on "Latest from X" heading links only | all | yes | `recentlyAdded.ts:116` |
| `.homeLibraryButtonContainer` `.homeLibraryButton` `.homeLibraryIcon` `.homeLibraryText` | "My media" **button** variant | all | **care** | `homesections.scss:1-29`; `.homeLibraryButton` uses `margin: …!important` and `width: …!important` in two media queries |
| "My media" **tile** variant | `.verticalSection > h2.sectionTitle + scroller` of backdrop cards | all | yes | `libraryTiles.ts:19-25`; default for `SmallLibraryTiles` — this is what the test server shows |

### List view (secondary for this subsystem)

| selector | what it is | layout(s) | safe to style? | notes |
|---|---|---|---|---|
| `.listItem` | list row | all | **care** | `outline: none !important`, `contain: layout style`, dir-scoped padding `listview.scss:1-33` |
| `.listItem-content` `.listItemBody` `.listItemBodyText` `.listItem-overview` `.listItem-bottomoverview` | row internals | all | yes/care | `.listItem-overview`/`.listItem-bottomoverview` are hidden with `display: none !important` in media queries `listview.scss:315-324` |
| `.listItemImage` `.listItemImage-large` `.listItemImageButton` | row thumbnail + play button | all | yes | legacy `background-image` inline, same trap as cards |
| `.listViewUserDataButtons` `.listItemButton` | trailing action buttons | all | yes | `librarybrowser.scss:1207-1210` |
| `.listItemMediaInfo` `.mediaInfoItem` `.starRatingContainer` `.endsAt` | metadata line | all | yes | `listview.scss:1-9` |

---

## Existing styling that will fight a custom theme

1. **`contain` on the card chain (the #1 blocker for a Netflix hover zoom).** Verified live on
   `modern-desktop`/`home`:

   | element | computed `contain` | computed `overflow` | clips? |
   |---|---|---|---|
   | `.card` (non-TV) | `content` (= layout style paint) | visible | **YES — paint containment clips any scaled child to the card's border box** |
   | `.card.show-animation` (TV) | `layout style` | visible | no |
   | `.cardBox` | `style` | visible | no |
   | `.cardScalable` | `layout style` | visible | no |
   | `.cardPadder` | `strict` (size layout style paint) | visible | yes (itself only) |
   | `.cardContent` | `strict` | **hidden** | yes |
   | `.cardImageContainer` (in `.cardScalable`) | `strict` | hidden (legacy, same node) / visible (React) | yes |
   | `.cardOverlayContainer` | none | visible | no |
   | `.emby-scroller` desktop | none | **visible** | no |
   | `.emby-scroller` mobile (`.scrollX.hiddenScrollX`) | none | **auto hidden** | **yes (vertically)** |
   | `.scrollSlider` | none | visible | no, but `will-change: transform` (inline) makes it a containing block + stacking context |
   | `#indexPage.mainAnimatedPage` | `style size !important` (`site.scss:88`) | visible | no (size only) |
   | `.skinHeader` | `content` | visible | yes (irrelevant here) |
   | `body` | — | `hidden auto` (`site.scss:48`) | **yes horizontally — page-level clip at the row edges** |

   `card.scss:24` sets `contain: layout style` on `.card` and `card.scss:29-31` upgrades it to
   `layout style paint` for every card that is **not** `.show-animation` (i.e. everything except TV).
   A theme must neutralise this (`.card { contain: layout style !important }` or `contain: none`)
   before any `transform: scale()` can escape the card box.

2. **Inline styles set by JS** (cannot be overridden without `!important`, and some not at all):
   * legacy: `elem.style.backgroundImage = url(...)` on `.cardImageContainer` — `imageLoader.js:122`.
     `background-size`/`-position`/`-repeat` stay themeable; the **image itself** does not.
   * legacy: `style="width:NN%"` on `.itemProgressBarForeground` — `indicators.js:19,33`.
   * legacy: `slider.style['white-space'] = 'nowrap'` on `.scrollSlider` — `emby-scroller.js:116`.
   * scroller: `slideeElement.style['will-change'] = 'transform'` and
     `style.transition = 'transform NNNms ease-out'`, then `transform: translateX(-Npx)` on every
     scroll — `lib/scroller/index.js:772-773, 337`. Never animate `.scrollSlider` yourself.
   * scroller on TV: `frame.style.overflow = 'hidden'` — `lib/scroller/index.js:769`.
   * React `<img>`: `position/inset/width/height/z-index/object-fit/opacity/transition` all inline —
     `Image.tsx:7-16,60-65`. Changing `object-fit` needs `!important`.
   * React blurhash `<canvas>`: fully inline-styled **and has no class** — `Image.tsx:45-55`.
   * React mobile overlay `<a>`: `position:absolute; inset:0; user-select:none; border-radius:0.2em`
     inline — `CardOverlayButtons.tsx:69-77`.

3. **`!important` already in the stock CSS that you will collide with**
   (Custom CSS is the last `<style>` in `<body>`, so equal specificity wins — but `!important`
   still beats you unless you also use `!important`):
   * `.card`: `font-size`, `font-family`, `background`, `background-color`, `color`, `outline`,
     `font-weight` (`card.scss:12-26`).
   * `.card:focus`: `position: relative !important; z-index: 10 !important` (`card.scss:130-134`).
   * `.cardBox`: `padding: 0 !important; outline: none !important` (`card.scss:89,97`).
   * `.cardBox-bottompadded`: `margin-bottom: …!important` (`card.scss:121,126`).
   * `.cardContent`: `margin/border/padding: 0 !important; outline: none !important` (`card.scss:208-220`).
   * `.cardImageContainer`: `background-clip: content-box !important` (`card.scss:173`).
   * `.cardTextCentered`: `text-align: center !important` (`card.scss:373-376`).
   * `.textActionButton`: `border/padding/outline …!important` (`card.scss:329-335`).
   * `.cardOverlayButtonIcon`: `background-color/width/height/font-size …!important` (`card.scss:472-479`).
   * `.cardOverlayButton-centered`: `background-color/padding …!important` (`card.scss:500-502`).
   * `.cardOverlayButtonIcon-hover`: `background: transparent !important` (`card.scss:857-859`).
   * `.overflowBackdropCard-textCard`: `width: 15.5vw !important` (`card.scss:806-808`).
   * `.sectionTitleTextButton`: `margin/display/color …!important` (`librarybrowser.scss:1305-1322`).
   * `.sectionTitleButton`, `.sectionTitleIconButton`: `margin-* …!important` (`librarybrowser.scss:1231-1303`).
   * `.homeLibraryButton`: `margin`/`width` `!important` (`homesections.scss:8,12,13,16`).
   * `.itemLinearProgress`: `position: absolute !important` (`indicators.scss:10`).
   * `.hiddenScrollX::-webkit-scrollbar`: `height: 0 !important` (`scrollstyles.scss:23`).
   * `.mainAnimatedPage`: `contain: style size !important` (`site.scss:89`).
   * `.page`: `padding-bottom: …!important` (`site.scss:121-127`).
   * `button { -webkit-border-fit: border !important }` (`card.scss:1-3`).

4. **JS-computed sizes.** `setCardData()` (`cardBuilder.js:80-133`) → `getImageWidth()` (`:70-73`) →
   `getPostersPerRow()` (`builder.ts:195-320`) picks the **image request resolution only**
   (`fillWidth`/`fillHeight` in the image URL). Verified live: at 1920 px the `portrait` shape
   requests `fillWidth=213&fillHeight=320` (1920 ÷ 9 posters/row) and at 390 px it requests
   `fillWidth=130&fillHeight=195` (390 ÷ 3). **The number of cards actually visible per row is pure
   CSS** (`%` for grid shapes, `vw` for overflow shapes) — a theme can freely change it, at the cost
   of the server-side image being slightly the wrong resolution. The JS also rounds the screen width
   down to the nearest 100 px when the window is resizable (`cardBuilder.js:126-129`).

   Measured live (modern-desktop, 1920 px, `html` font-size 14.88 px):
   * `.overflowPortraitCard` = 10.41 vw = **200 px** (card) / 182 px (cardBox) → ~9 posters visible in a 1793 px row.
   * `.overflowBackdropCard` = 18.7 vw = **359 px** / 341 px → ~5 per row.
   * `.portraitCard` (grid) = 11.111 % of 1794 px = **199 px**.
   Measured live (modern-mobile, 390 px): `.overflowPortraitCard` = 40 vw = **156 px** (2.3 visible),
   `.overflowBackdropCard` = 72 vw = **281 px**.

5. **Hashed emotion classes — never target these.** Observed live on the React cards:
   `css-0` (empty `MuiBox`), `css-iguwhy` (`MuiSvgIcon`), `css-mk0p0t` (`MuiIconButton` medium),
   `css-1vwv0k3` (`MuiIconButton` small), `css-xsgcp5` (`MuiButtonGroup`), `css-sjv9i2`, `css-1iogify`,
   `css-1u7mpsp`, `css-1tmqktv` (layout shell). Stable, *class-name* anchors that sit on the same
   nodes: `MuiBox-root`, `MuiSvgIcon-root`, `MuiIconButton-root`, `MuiButtonGroup-root`,
   `MuiButtonBase-root` — plus the Jellyfin classes (`cardOverlayButton`, `cardIndicators`, …) which
   are always present alongside. Prefer the Jellyfin class, fall back to `Mui*-root`,
   **never** `css-*`.

6. **z-index stack inside a card** (all `position` values are from `card.scss` unless noted):
   ```
   .card:focus                     z-index: 10 !important   (card.scss:132)
   .cardOverlayButton              z-index: 1               (card.scss:448)
   .cardIndicators                 z-index: 1               (card.scss:412)
   .innerCardFooter                z-index: 1               (card.scss:287)
   .mediaSourceIndicator           z-index: 1               (card.scss:161)
   .btnCardOptions                 z-index: 1               (card.scss:141)
   .emby-scrollbuttons             z-index: 1               (emby-scrollbuttons.scss:9)
   React <img>                     z-index: 0  (inline)     (Image.tsx:15)
   .cardOverlayContainer           auto, but painted after .cardContent in DOM order
   ```
   `.cardScalable` has `contain: layout style` but **no** `isolation`/`transform`, so it is *not* a
   stacking context — `.card:focus { z-index: 10 }` genuinely lifts the whole card above its
   neighbours. That is the only stock mechanism for letting a card overlap its row.

7. **Selector traps**
   * `.cardImageContainer` matches **twice** per React desktop card (the real image container and the
     overlay's `<a>` — `CardHoverMenu.tsx:50`). Scope with `.cardContent > .cardImageContainer`.
   * `.cardContent` and `.cardImageContainer` are the **same node** in the legacy path
     (`cardBuilder.js:873`), so `.cardContent .cardImageContainer` matches nothing on the home page.
   * `.cardFooter` does **not** exist on the home page; style `.cardBox > .cardText` instead.
   * `div:not(.sectionTitleContainer-cards) > .sectionTitle-cards` (`librarybrowser.scss:1254`) is
     parent-dependent — a heading's padding changes depending on whether it is wrapped.
   * `.cardText > .textActionButton` (`card.scss:346`) only matches the React path; legacy nests the
     link inside a `<bdi>`.
   * Dir-scoped rules `[dir="ltr"] &` / `[dir="rtl"] &` appear on `.cardText`, `.cardIndicators`,
     `.cardOverlayButton-br`, `.itemsContainer > .card > .cardBox`, `.padded-*` — they carry an extra
     attribute-selector's specificity (0,2,0 or more).

---

## Theming hooks

**`--jf-*` variables consumed by this subsystem** (read live from `html` on modern-desktop, dark theme):

| variable | live value | where it lands here |
|---|---|---|
| `--jf-card-borderRadius` | `0.2em` | `.visualCardBox`, `.cardBox:not(.visualCardBox) .cardPadder`, `.cardContent`, `.cardImageContainer`, `.blurhash-canvas`, `.cardOverlayContainer`, `.itemDetailImage` (`_theme.scss:228-240`); also `+0.5em` for the TV focus ring (`_theme.scss:574-577`) |
| `--jf-palette-primary-main` | `#00a4dc` | `.countIndicator`, `.playedIndicator`, `.mediaSourceIndicator`, `.fullSyncIndicator` background; `.itemProgressBarForeground` (`_theme.scss:441-460`) |
| `--jf-palette-primary-contrastText` | `rgba(0,0,0,.87)` | text colour of those badges |
| `--jf-palette-background-paper` | `#202020` | `$surface-overlay` → `.visualCardBox` and `.cardBox:not(.visualCardBox) .cardPadder` background, `.cardPadder .cardImageIcon` colour (`_theme.scss:228-248`). This is why the empty padder reads `rgb(32,32,32)` live, not the `#242424` in `card.scss:238` |
| `--jf-palette-background-default` | `#101010` | page background behind the rows |
| `--jf-palette-text-secondary` | `rgba(255,255,255,.7)` | `.cardText-secondary` (`_theme.scss:254-262`) |
| `--jf-palette-error-light` | theme | `.itemProgressBarForeground-recording` |
| `--jf-palette-divider`, `--jf-shape-borderRadius` (`4px`) | theme | MUI surfaces around the cards |

`<html>` carries `class="layout-desktop|layout-mobile|layout-tv"` and `data-theme="dark|light|…"`
(verified live for all four profiles), so `html.layout-desktop .card { … }` and
`:root[data-theme="dark"]` are valid, cheap top-level switches. Note the harness' *legacy* profiles
still report `layout-desktop` / `layout-mobile` — the Modern/Legacy split is **not** expressed in a
class, only in which renderer produced the markup.

**Classes toggled by JS (use as state hooks, never assume they exist):**

| class | on | toggled by |
|---|---|---|
| `hide` | `.verticalSection`, `.emby-scrollbuttons-button` | `emby-itemscontainer.js:427-429`, `emby-scrollbuttons.js:50-54` |
| `emby-scroller-container` | the section wrapper | `emby-scrollbuttons.js:149`, `ScrollButtons.tsx:34` — **desktop + fine pointer only** |
| `animatedScrollX` / `scrollX` / `hiddenScrollX` / `hiddenScrollX-forced` / `smoothScrollX` | `.scrollSlider` / `.emby-scroller` | `lib/scroller/index.js:736-778` |
| `lazy-hidden`, `lazy-image-fadein[-fast]`, `blurhashed`, `non-blurhashable`, `lazy-hidden-children` | image element / `.cardPadder` | `imageLoader.js:99-160` |
| `card-hoverable`, `show-focus`, `show-animation`, `itemAction` | `.card` | `builder.ts:90-103`, `useCard.ts:86-100` |
| `withMultiSelect`, `itemSelectionPanel`, `checkedInitial` | `.itemsContainer` / cards | `multiSelect.js:35,113,116` |
| `is-active` | `.tabContent` | tabs manager |
| `playstatebutton-icon-unplayed` | the check glyph | `emby-playstatebutton` |

**Useful structural anchors (no hashed classes needed):**

```css
/* a home row that actually has content */
.homeSectionsContainer > .verticalSection:not(.hide) { }

/* the "Latest media" host that lost its .verticalSection class */
.homeSectionsContainer > div[class^="section"]:not(.verticalSection) > .verticalSection { }

/* only rows that are horizontal scrollers */
.verticalSection:has(> .emby-scroller) { }

/* outer footer text on the home page (there is no .cardFooter there) */
.cardBox > .cardText { }

/* legacy card image surface only (not the React overlay anchor) */
a.cardImageContainer.cardContent { }
/* React card image surface only */
.cardContent > .cardImageContainer { }

/* React image / blurhash, which carry no classes */
.cardImageContainer > div:not([class]) > img { }
.cardImageContainer > canvas:not([class]) { }

/* React mobile full-card link */
.cardScalable > a:not([class]) { }

/* card that is currently showing its hover menu */
.card-hoverable:hover .cardOverlayContainer,
.card-hoverable:focus-within .cardOverlayContainer { }

/* first / last card in a row, for edge-safe hover zoom */
.itemsContainer.scrollSlider > .card:first-child,
.itemsContainer.scrollSlider > .card:last-child { }

/* rows that carry scroll buttons (desktop fine-pointer only) */
.emby-scroller-container > .emby-scrollbuttons { }
```

---

## Netflix-relevance notes

| Netflix UI element | Jellyfin 12.1 counterpart | verdict for a pure-CSS theme |
|---|---|---|
| Row ("Trending Now") | `.verticalSection` + `h2.sectionTitle(-cards)` + `.emby-scroller > .itemsContainer.scrollSlider` | **Easy.** `.verticalSection` and `.homeSectionsContainer` have *zero* stock CSS — full freedom for spacing, backgrounds and row rhythm. |
| Row title with "›" chevron on hover | `.sectionTitleContainer-cards > a.sectionTitleTextButton > h2.sectionTitle + span.material-icons.chevron_right` | **Easy**, but three `!important`s on `.sectionTitleTextButton` must be matched. Note: rows built by `libraryTiles`/`resume` have a **bare `h2.sectionTitle`, no link and no chevron** (`libraryTiles.ts:19`, `resume.ts:92`) — the theme cannot add a link there. |
| Boxart tile | `.card > .cardBox > .cardScalable > .cardPadder + .cardContent/.cardImageContainer` | **Easy** for radius/shadow/border. Aspect ratio is the `.cardPadder`'s `padding-bottom` — override per shape (`card.scss:58-86`) to get Netflix's 16:9 "billboard" tiles from portrait posters. |
| **Hover zoom (scale ~1.3, card lifts above its neighbours)** | nothing equivalent ships on desktop; `.card.show-animation:focus > .cardBox { transform: scale(1.07) }` exists **TV-only** (`card.scss:116-118`, confirmed live: focused TV card's `.cardBox` computed `matrix(1.07,0,0,1.07,0,0)`) | **Possible but requires 4 unlocks:** (1) `.card { contain: layout style }` to kill paint containment; (2) a `z-index`/`position: relative` on the hovered card (stock only does this on `:focus`, `card.scss:130-134`); (3) scale `.cardBox` or `.cardScalable`, **not** `.scrollSlider` (JS owns its transform) and **not** `.cardContent`/`.cardImageContainer` (both `contain: strict`); (4) accept that `body { overflow-x: hidden }` and, on mobile, `.emby-scroller { overflow: auto hidden }` will still clip a zoom at the row edges — use `:first-child`/`:last-child` + `transform-origin` to zoom inward. |
| Row that grows taller on hover (neighbours slide sideways) | — | **Impossible in CSS.** The row is a flex line inside a JS-translated `.scrollSlider`; making a card wider on hover would fight `lib/scroller/index.js`'s cached `offsetWidth` maths (`emby-scrollbuttons/utils.ts:48,82,91`) and break the paging. Transform-only zoom is the safe approach. |
| Expanded hover card (trailer preview, big title, synopsis, extra buttons) | only `.cardOverlayContainer` + 3-4 icon buttons (`CardHoverMenu.tsx`, `cardBuilder.js:997`) | **Mostly impossible.** No synopsis/genre/duration text exists in the card DOM to reveal, and CSS cannot fetch it. What *is* available to re-style into a Netflix-ish hover panel: `.cardOverlayContainer` (dim layer), `.cardOverlayFab-primary` (round play FAB → Netflix's white circular play), `.cardOverlayButton-br` group (played ✓ / favourite ♥ / ⋮ → Netflix's +, 👍, ⌄), and `.cardText-first`/`.cardText-secondary` which can be pulled into the tile with `position:absolute` — but only **inside** `.cardBox`, since `.card` clips. |
| Progress bar on "Continue Watching" | `.itemProgressBar > .itemProgressBarForeground[style="width:N%"]` (legacy) / `.itemLinearProgress` MUI bar (React) | **Easy for the track**, and the fill colour comes from `--jf-palette-primary-main` on legacy. On React the fill colour is an emotion `sx` hash — you need `.itemLinearProgress .MuiLinearProgress-bar { background-color: … !important }`. The **width is inline** and must stay. |
| "N" episode badge | `.countIndicator.indicator` (legacy) / `+ .unplayedItemCount` (React) | **Easy** — background from `--jf-palette-primary-main`. |
| Netflix red accent | `--jf-palette-primary-main` (`#00a4dc`) drives indicators + progress; `.mediaSourceIndicator` also hard-codes `rgb(51,136,204)` in `card.scss:159` | **Easy**, but remember to override `.mediaSourceIndicator` explicitly or the blue bubble survives. |
| Title treatment / logo art over the tile | `.cardFooterLogo` (only when `showLogo`/`showChannelLogo` is on — **never on the home page**) | **Not reachable** from the home rows. Home tiles get the logo baked into the backdrop image by the server (visible in `_shots/baseline/modern-desktop/home.png` for "Filmy"/"Seriale"). |
| Gradient scrim under the title | `.innerCardFooter` (`rgba(0,0,0,.7)`, `card.scss:281-291`) | **Easy** when a section sets `overlayText`, otherwise absent — home sections set `overlayText: false` (`resume.ts:64`, `nextUp.ts:64`, `recentlyAdded.ts:90`, `libraryTiles.ts:32`), so you must build your own scrim inside `.cardScalable`. |
| Left/right row arrows on hover (full-height, dark gradient) | `.emby-scrollbuttons` (two small buttons at the **top-right of the row**, above the cards) | **Restyleable but not relocatable into the row**: `.emby-scrollbuttons` is `position:absolute; top:0; right:0` relative to `.emby-scroller-container` (the whole section, including the heading), so it *can* be re-anchored with `top/bottom/left/right` to sit over the card strip. It only exists on **desktop with a fine pointer** (`Scroller.tsx:164`, `emby-scroller.js:120`) and only when the row overflows — **on touch/mobile there are no arrows at all** and no `.emby-scroller-container` positioning context. |
| Hidden scrollbar | already hidden on mobile/TV (`scrollstyles.scss:11-25`) and on desktop the row uses transform scrolling with `overflow: visible` | **Nothing to do.** |
| Full-bleed hero billboard at the top of Home | — | **Impossible here.** No hero element exists in `.homeSectionsContainer`; the backdrop lives in `.backdropContainer` outside the page. Would need a different subsystem (see the backdrop/detail map). |
| Cards per row fixed to 6 like Netflix | `.overflow*Card { width: N vw }` | **Easy** — override the `vw` widths (and the `@media (orientation: landscape)` block at `card.scss:718-741`, which otherwise wins on landscape phones/tablets). Only side effect: the server-requested image width stays sized for the old count. |

**Order-of-operations for the theme:** kill `contain: paint` on `.card` → give `.card:hover` a
`position: relative; z-index` → transform `.cardBox` (never `.scrollSlider`, `.cardContent` or
`.cardImageContainer`) → handle row edges with `:first-child`/`:last-child` + `transform-origin` →
re-style `.cardOverlayContainer` as the hover panel → rebuild the text scrim inside `.cardScalable`
because `.cardFooter` does not exist on Home.

---

## Live verification log

| profile | route | selector | what it confirmed |
|---|---|---|---|
| modern-desktop | home | `.homeSectionsContainer` (depth 4) | `.sections.homeSectionsContainer`, `.verticalSection.sectionN`, `.emby-scroller-container`, scrollbuttons-before-scroller, `.section6` without `.verticalSection` |
| modern-desktop | home | `.card` + `--hover .card` + computed | full legacy card tree, hover overlay, `contain`/`overflow`/`z-index`/background per node |
| modern-desktop | home | `body` (depth 4), `#indexPage` (depth 2) | ancestor clipping chain, `body{overflow:hidden auto}`, `.mainAnimatedPage{contain:style size}` |
| modern-desktop | home | `html` + computed custom props | `font-size: 14.88px`, `--jf-card-borderRadius`, `--jf-palette-*` live values |
| modern-desktop | movies | `.itemsContainer` (depth 6) + `.cardContent` (`--html`) | React card tree, emotion hashes, inline `<img>` styles |
| modern-desktop | shows | `.cardIndicators` (`--html`) | `.countIndicator.indicator.unplayedItemCount` (React only) |
| modern-desktop | details-movie | `.verticalSection` | details page is legacy (`.detailVerticalSection`, `.nextUpItems`) |
| modern-desktop | details-season | `.listItem` | live list-view row markup |
| modern-mobile | home | `.homeSectionsContainer` (depth 6) | no scroll buttons, `.emby-scroller.scrollX.hiddenScrollX`, no `.card-hoverable`, no `.animatedScrollX` |
| modern-mobile | movies | `.cardScalable` (`--html`) | React mobile overlay: unclassed inline-styled `<a>` + `MuiButtonGroup.cardOverlayButton-br` |
| legacy-desktop | home | `.homeSectionsContainer` (depth 5) | identical to modern-desktop home |
| legacy-desktop | movies | `.itemsContainer.vertical-wrap:not(#divUsers)` | legacy grid: `.portraitCard`, `.padded-right-withalphapicker`, `.cardIndicators` |
| tv | home | `.card` (depth 3) + computed | `<button class="card … show-focus show-animation itemAction">`, `.card` `contain: layout style` (no paint), focused `.cardBox` `transform: matrix(1.07,…)` |
| — | — | `_shots/baseline/{modern-desktop,modern-mobile}/home.png` | visual match: My-media backdrop tiles, portrait latest rows, count badges, mobile always-on play buttons |

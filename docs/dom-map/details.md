# Item details page (movie / series / season / episode / person / collection)

Jellyfin **12.1.0** (`_ref/jellyfin-web` @ `fae41f3 "Bump version to 12.1"`).
All selectors below were seen either in the 12.1 source or in a live `tools/dom.mjs` dump against the
`jellyflix-test` container. Anything the SCSS styles but 12.1 never emits is flagged **DEAD**.

## Where it appears (routes, layouts, breakpoints)

* Route: `#/details?id=<itemId>&serverId=<id>` (plus `&context=movies|tvshows|music|…`).
* **The details page is the legacy controller in BOTH layouts — confirmed.**
  * `src/apps/modern/routes/legacyRoutes/user.ts:5-9` → `{ path: 'details', pageProps: { controller: 'itemDetails/index', view: 'itemDetails/index.html' } }`
  * `src/apps/legacy/routes/legacyRoutes/user.ts:5-9` → identical.
  * Live proof: the `#itemDetailPage` tree is byte-identical on `modern-desktop` and `legacy-desktop`; only the ancestors differ.
* **`src/apps/modern/features/details/**` is DEAD CODE in 12.1.** Nothing imports it
  (`grep -rn "features/details" src/ | grep -v "^src/apps/modern/features/details"` → empty).
  It contains `components/buttons/{PlayOrResume,Shuffle,PlayTrailer,MoreCommands,Download,InstantMix,SplitVersions,CancelTimer,CancelSeriesTimer}Button.tsx`
  and `hooks/api/useGetItemByType.ts` — a future MUI rewrite, not rendered today. **Do not target it.**
* Same markup for every item type; sections are shown/hidden by JS (`.hide`). Type-specific branching lives in
  `setInitialCollapsibleState()` (`src/apps/legacy/controllers/itemDetails/index.js:820`).
* Layout switches come from `<html class="layout-desktop|layout-mobile|layout-tv">`, not media queries, for most
  detail-page rules. Real media-query breakpoints used here: `31.25em`, `32em`, `40em`, `50em`, `62.5em`, `64em`,
  `68.75em`, `75em`, `100em`, plus `max-height: 31.25em`.
* Root font-size is user-scalable: live `html { font-size: 14.88px }` on desktop, `14.4px` on mobile — every `em`
  in `librarybrowser.scss` scales with it.

### Ancestors (differ per layout — this is where the two layouts actually diverge)

| | modern | legacy |
|---|---|---|
| chain | `body.libraryDocument > #reactRoot > div.MuiBox-root.css-sjv9i2 > main.MuiBox-root.css-1iogify > .mainAnimatedPages.skinBody > #itemDetailPage` | `body.libraryDocument > #reactRoot > .mainAnimatedPages.skinBody > #itemDetailPage` |
| header | `header.MuiAppBar-root.MuiAppBar-colorTransparent.MuiAppBar-positionFixed.mui-fixed.css-1u7mpsp`, `position:fixed; z-index:1100; height:48px` + a 48px spacer `<div>` | `.skinHeader.skinHeader-withBackground.skinHeader-blurred.semiTransparent`, `position:fixed; z-index:999; contain:content` |
| page origin | `main` starts at `y=48` → `#itemDetailPage` and `#itemBackdrop` start at `y=48` (AppBar overlaps nothing) | page starts at `y=0`, the fixed `.skinHeader` overlaps the backdrop |
| legacy `.skinHeader` | still in the DOM but inside a `display:none` wrapper | active |
| `src/apps/modern/AppOverrides.scss` | loaded (`src/apps/modern/AppLayout.tsx:19`) | **not loaded** |

Consequences of that last row (verified live):

| | modern-mobile | legacy-mobile |
|---|---|---|
| `#itemDetailPage` | `overflow: clip visible` / `overflow-x: clip` | `overflow-x: visible` |
| `#itemBackdrop` `margin-top` | `-48px` (`!important`) | `+43.2px` (`3rem`) |
| `#itemBackdrop::before` gradient | yes | no |

`body` is the scroll container (`overflow: hidden auto`).

## DOM skeleton (real markup, trimmed)

Source of truth: `src/apps/legacy/controllers/itemDetails/index.html` (250 lines). Live-verified additions are marked `←`.

```
div#itemDetailPage.page.libraryPage.itemDetailPage.noSecondaryNavPage.selfBackdropPage
                  .mainAnimatedPage                                   ← added by viewManager
                  [.noBackdropTransparency]                           ← JS, desktop only (index.js:520)
  div#itemBackdrop.itemBackdrop[.lazy][.lazy-image-fadein-fast]       ← bg-image ONLY on mobile
  div.detailLogo[.hide][.lazy][.lazy-image-fadein-fast]               ← background-image, hidden <=68.75em / mobile / tv
  div.detailPageWrapperContainer
    div.detailPagePrimaryContainer
      div.detailImageContainer.hide-mobile                            ← desktop/tv poster slot
        div.card.{portrait|backdrop|square|banner}Card                ← shape from PrimaryImageAspectRatio
          div.cardBox
            div.cardScalable
              div.cardPadder.cardPadder-{shape}[.lazy-hidden-children]
                span.cardImageIcon.material-icons.{movie|tv|person|folder}
              canvas.blurhash-canvas[.lazy-hidden]                    ← inserted by imageLoader
              div.cardImageContainer.coveredImage.cardContent.lazy[.blurhashed][.lazy-image-fadein-fast]
                                                                      ← style="cursor:default" + inline background-image
      div.detailRibbon.padded-left.padded-right
        div.infoWrapper
          div.detailImageContainer.hide-desktop.hide-tv               ← mobile poster slot (same card markup)
          div.nameContainer
            h1.parentName.focuscontainer-x > bdi > a.button-link.itemAction   (episode/season only)
            h1.itemName.infoText.parentNameLast[.withOriginalTitle] > bdi     (movie/person)
            h3.itemName.infoText.subtitle[.focuscontainer-x] > bdi            (episode/season)
            h4.itemName.infoText.originalTitle                                (when OriginalTitle != Name)
            h3.parentName.musicParentName[.focuscontainer-x]                  (music only)
          div.itemMiscInfo.itemMiscInfo-primary[.hide]   style="margin-bottom:.6em"
            div.mediaInfoItem                                    "2022" / "20.01.2008"
            div.mediaInfoItem                                    runtime "1m"
            div.mediaInfoItem.mediaInfoText.mediaInfoOfficialRating   "PL-16"
            div.starRatingContainer.mediaInfoItem > span.material-icons.starIcon.star + "7.7"
            div.mediaInfoItem.mediaInfoCriticRating.mediaInfoCriticRating{Fresh|Rotten}
            div.endsAt.mediaInfoItem                             "Koniec o 21:49"
            div.mediaInfoItem.mediaInfoText.closedCaptionMediaInfoText  "CC"
          div.itemMiscInfo.itemMiscInfo-secondary[.hide] style="margin-bottom:.6em"
        div.mainDetailButtons.focuscontainer-x
          button.button-flat.btnPlay.detailButton.emby-button   [data-action=resume]  ← title flips Play/Resume
          button.button-flat.btnReplay.detailButton             [data-action=play]    ← shown only when resumable
          button.button-flat.btnDownload.detailButton
          button.button-flat.btnPlayTrailer.detailButton
          button.button-flat.btnInstantMix.detailButton
          button.button-flat.btnShuffle.detailButton                                  ← folders + music
          button.button-flat.btnCancelSeriesTimer.detailButton
          button.button-flat.btnCancelTimer.detailButton
          button.button-flat.btnPlaystate.detailButton[.playstatebutton-played] [is=emby-playstatebutton data-type=Movie]
          button.button-flat.btnUserRating.detailButton[.ratingbutton-withrating]   [is=emby-ratingbutton]
          button.button-flat.btnSplitVersions.detailButton
          button.button-flat.btnMoreCommands.detailButton
          (each) > div.detailButton-content > span.material-icons.detailButton-icon.<glyph>
      div.detailPagePrimaryContent.padded-right
        div.detailSection
          form.trackSelections.focuscontainer-x[.hide]
            div.selectContainer.select{Source|Video|Audio|Subtitles}Container[.hide]
                 .trackSelectionFieldContainer.flex-shrink-zero
              label.selectLabel
              select#embyselectN.select{Source|Video|Audio|Subtitles}.detailTrackSelect
                    .emby-select-withcolor.emby-select [is=emby-select][disabled when 1 option]
              div.selectArrowContainer > span.selectArrow.material-icons.keyboard_arrow_down
          div.recordingFields[.hide] style="margin:.5em 0 1.5em"
          div.detailSectionContent
            p.itemGenres                                   (always empty in 12.1)
            h3.tagline[.hide] > bdi
            p.overview[.hide][.detail-clamp-text] > bdi > p…      ← markdown-it + DOMPurify
            div.overview-controls > a.overview-expand[.hide].emby-button
            p#itemBirthday | p#itemBirthLocation | p#itemDeathDate | p#seriesAirTime   (each [.hide])
            div.itemTags.focuscontainer-x[.hide]  style="margin:.7em 0;font-size:92%"
                 "Znaczniki: " + a.button-link.emby-button …
            div.itemExternalLinks.focuscontainer-x[.hide] style="margin:.7em 0;font-size:92%"
                 a.button-link.emby-button  (IMDb, TMDB, …)
            div.seriesRecordingEditor
          div.itemDetailsGroup                              ← 6 React render targets
            div > div.detailsGroupItem.MuiBox-root.css-0
                    p.MuiTypography-root.MuiTypography-body1.label.css-pl8nxc   "Reżyser"
                    div.focuscontainer-x.MuiBox-root.css-0
                      span.MuiBox-root.css-0 > a.emby-button.button-link style="color: inherit;"
          div#seriesTimerScheduleSection.verticalSection.detailVerticalSection[.hide] style="margin-top:-3em"
          div.collectionItems[.hide]                        ← BoxSet only
            div.verticalSection > div.sectionTitleContainer.sectionTitleContainer-cards.padded-left > h2.sectionTitle.sectionTitle-cards > span
                                > div.itemsContainer.collectionItemsContainer.vertical-wrap.padded-left.padded-right
          div.nextUpSection.verticalSection.detailVerticalSection[.hide]    ← Series only
            h2.sectionTitle.sectionTitle-cards  "Do obejrzenia"
            div.nextUpItems.vertical-wrap.padded-right.itemsContainer
              div.card.overflowBackdropCard.card-hoverable.card-withuserdata [data-type=Episode]
          div.programGuideSection[.hide].verticalSection.detailVerticalSection > div.programGuide
          div#listChildrenCollapsible[.hide].verticalSection.detailVerticalSection
                                     [.verticalSection-extrabottompadding]   ← added for Season/MusicAlbum
            h2.sectionTitle.sectionTitle-cards[.hide] > span                 ← hidden for Season/MusicAlbum
            div#childrenContent
              div.itemsContainer.padded-right.{vertical-list|vertical-wrap|scrollX hiddenScrollX} style="text-align:left"
    div.detailPageSecondaryContainer.padded-left.padded-bottom-page
      div#childrenCollapsible[.hide].verticalSection.detailVerticalSection            (non-LIST_VIEW_TYPES folders)
      div#additionalPartsCollapsible …  > div#additionalPartsContent
      div.verticalSection.detailVerticalSection.moreFromSeasonSection …               (episode)
      div#lyricsSection.verticalSection-extrabottompadding.detailVerticalSection.lyricsContainer
      div.verticalSection.detailVerticalSection.moreFromArtistSection …
      div#castCollapsible.verticalSection.detailVerticalSection[.emby-scroller-container]
        h2#peopleHeader.sectionTitle.sectionTitle-cards.padded-right
        div.emby-scrollbuttons.padded-right [is=emby-scrollbuttons]          ← desktop/tv only
          button.emby-scrollbuttons-button.paper-icon-button-light > span.material-icons.chevron_left|chevron_right
        div.padded-top-focusscale.padded-bottom-focusscale.no-padding.emby-scroller[.scrollX.hiddenScrollX]
          div#castContent.scrollSlider.focuscontainer-x.itemsContainer[.animatedScrollX]
            div.card.overflowPortraitCard.personCard.card-hoverable.card-withuserdata [data-type=Actor data-index=0]
              div.cardBox.cardBox-bottompadded > div.cardScalable > …
              div.cardText.cardTextCentered.cardText-first      > bdi > a.itemAction.textActionButton   (name)
              div.cardText.cardTextCentered.cardText-secondary  > bdi > span                            (role)
      div#guestCastCollapsible … > div#guestCastContent
      div#seriesScheduleSection … > div#seriesScheduleList.itemsContainer.vertical-list.padded-right
      div#specialsCollapsible …  > div#specialsContent                     "Dodatki specjalne"
      div#musicVideosCollapsible … > div#musicVideosContent
      div#scenesCollapsible.verticalSection-extrabottompadding … > div#scenesContent    (chapters)
      div#collectionsCollapsible.verticalSection-extrabottompadding … > div#collectionsContent.collectionsContent
      div#similarCollapsible.verticalSection-extrabottompadding … > div.scrollSlider.focuscontainer-x.itemsContainer.similarContent
```

### Season / episode list item (`#childrenContent` on `details-season`)

`listView.getListViewHtml({ imageSize:'large', enableOverview:true, imagePlayButton:true, … })`
(`index.js:1440-1452`). Live markup:

```
div.listItem.listItem-largeImage.listItem-withContentWrapper [data-type=Episode data-action=none]
  div.listItem-content
    div.listItemImage.listItemImage-large.itemAction.lazy[.non-blurhashable][.lazy-image-fadein-fast] [data-action=link]
                                                        ← 19.5vw x 13vw, inline background-image
      button.listItemImageButton.itemAction.paper-icon-button-light [data-action=resume]
        span.material-icons.listItemImageButton-icon.play_arrow
      (div.listItemProgressBar when partially watched)
      (div.listItemIndicators > .indicator …)
    div.listItemBody.itemAction
      div.listItemBodyText > bdi                                   "1. Pilot"
      div.secondary.listItemMediaInfo.listItemBodyText             runtime / star / endsAt
      div.secondary.listItem-overview.listItemBodyText > bdi > p
    div.listViewUserDataButtons
      button.listItemButton.itemAction.paper-icon-button-light [data-action=link]  (info_outline)
      button.listItemButton.paper-icon-button-light.emby-button [is=emby-playstatebutton]
      button.listItemButton.paper-icon-button-light.emby-button [is=emby-ratingbutton]
      button.listItemButton.itemAction.paper-icon-button-light [data-action=menu]  (more_vert)
  div.listItem-bottomoverview.secondary[.hide] > bdi > p
```

### Which child container is used

`renderChildren()` (`index.js:1341-1342`) picks `#listChildrenCollapsible` when
`item.Type ∈ LIST_VIEW_TYPES = [MusicAlbum, Playlist, Season, Series]` (`index.js:56-61`), otherwise `#childrenCollapsible`.
So **Series seasons and Season episodes both live in `#listChildrenCollapsible`, i.e. inside
`.detailPagePrimaryContent` (indented past the poster column), not in the full-width secondary container.**

| item type | container | content shape |
|---|---|---|
| Series | `#listChildrenCollapsible` | `overflowPortrait` cards, `.vertical-wrap`; title "Sezony" visible |
| Season | `#listChildrenCollapsible` | `listView` `.listItem-largeImage`, `.vertical-list`; **`.sectionTitle` gets `.hide` + section gets `.verticalSection-extrabottompadding`** (`index.js:1520-1525`) |
| Episode | `#childrenCollapsible` (via `.moreFromSeasonSection` path) / siblings only when ≥2 | `overflowBackdrop` cards, `.scrollX.hiddenScrollX` |
| MusicAlbum | `#listChildrenCollapsible` | track `listView`, title hidden |
| Playlist / Person / Studio / Genre | `#listChildrenCollapsible` | rendered by `itemsByName` / `playlistViewer` |
| BoxSet | both hidden; content goes to `.collectionItems` | `renderCollectionItems()` `index.js:1687` |
| Movie / Episode (leaf) | both hidden | — |

## Selector table

| selector | what it is | layout(s) | safe to style? | notes (file:line) |
|---|---|---|---|---|
| `#itemDetailPage`, `.itemDetailPage` | page root, also `.page .libraryPage .noSecondaryNavPage .selfBackdropPage .mainAnimatedPage` | all | yes | `padding-top:0 !important` (`librarybrowser.scss:95`); tv `4.2em !important` (`:99`); `padding-bottom:5em !important` from `.page` (`site.scss:120-125`). Computed `contain: size style`, `position:absolute`, inset 0 |
| `.itemDetailPage.noBackdropTransparency` | JS flag: banner on + global backdrops off | desktop/tv | yes | `index.js:520`; gives `.detailPageWrapperContainer` a solid bg (`_theme.scss:354`). **Present by default in this test server.** |
| `#itemBackdrop`, `.itemBackdrop` | 40vh hero spacer | all (`display:none` on tv) | yes | `librarybrowser.scss:571`; `background-attachment: fixed`, `height:40vh`, `animation: backdrop-fadein 800ms`; `52vh` at `max-height:31.25em` (`:1201`) |
| `.layout-mobile .itemBackdrop` | same element, **real** `background-image` | mobile | yes | `librarybrowser.scss:580-588` (`background-attachment:initial`, `background-position:top center`, `margin-top:3rem`, `30vh` in portrait ≤40em); modern adds `margin-top:-48px !important` + `::before` gradient (`AppOverrides.scss:33-45`) |
| `.backdropContainer` / `.backdropImage.displayingBackdropImage` | the **desktop** hero image, fixed behind everything | desktop/tv | yes | `backdrop.scss:1-22`; `position:fixed; z-index:-1; contain:size layout style`; image set by inline `style.backgroundImage` |
| `.backgroundContainer.withBackdrop` | the dimmer over the backdrop | desktop/tv | yes | `opacity: .86` (`_theme.scss:135`), `contain: strict`, `background-color: var(--jf-palette-background-default)` |
| `.detailLogo` | item/parent Logo image | desktop ≥68.75em only | yes | `librarybrowser.scss:486`: `position:absolute; top:10vh; right:25vw; width:25vw; height:16vh; background-size:contain`. `display:none` for mobile/tv and `max-width:68.75em`. `.hide` when no logo (`index.js:693-703`) |
| `.detailPageWrapperContainer` | everything below the hero | all | yes | `librarybrowser.scss:1132`: `border-collapse:collapse`; `.layout-desktop &` → `display:flex; flex-direction:column; min-height:60vh` |
| `.noBackdropTransparency .detailPageWrapperContainer` | opaque page body | desktop/tv | yes | `_theme.scss:354-361`; live `background-color: rgb(16,16,16)` |
| `.detailPagePrimaryContainer` | hero-row wrapper | all | yes | only `position: relative` (`librarybrowser.scss:810`) |
| `.detailImageContainer.hide-mobile` | poster slot, desktop/tv | desktop/tv | yes | hidden on mobile by `.layout-mobile .hide-mobile{display:none!important}` (`index.html:61-67`) |
| `.detailImageContainer.hide-desktop.hide-tv` | poster slot, mobile | mobile | yes | same mechanism, inverted |
| `.detailImageContainer .card` | the poster card itself | all | yes | `librarybrowser.scss:826-887`. Desktop: `left:3.3%; top:-12.96em; margin-bottom:-12.96em; width:25vw; float:left; z-index:3`. Mobile: `position:absolute; left:5%(→0 ≤32em); bottom:1rem(→0); max-width:30vw; filter:drop-shadow(0 0 .5rem #000)`; `&.backdropCard{top:1.6em}`. `top:10%` under `max-width:62.5em` (`:962`) |
| `.card.portraitCard` / `.backdropCard` / `.squareCard` / `.bannerCard` | poster shape, chosen from `PrimaryImageAspectRatio` | all | yes | `cardImage.ts:20-30,59` — `≥3` banner, `≥1.33` backdrop, `>0.8` square, else portrait |
| `.detailImageContainer .cardImageContainer.coveredImage.cardContent.lazy` | the actual poster `<div>` (**Primary** image, background-image) | all | careful | inline `style="cursor: default;"` + JS-set inline `background-image` (`cardImage.ts:66-69`, `imageLoader.js:118-124`) |
| `.detailRibbon` | title/meta/buttons band | all | yes | `librarybrowser.scss:752-783`: `display:flex; align-items:center; z-index:2`. Desktop/tv `padding-left:32.45vw`; desktop `position:relative; margin-top:-7.2em; height:7.2em`. Mobile `display:block; position:relative; padding:.5rem 5%`. tv `display:block` |
| `.detailRibbon` (colour) | | all | yes | base `_theme.scss:89-92` uses `--jf-palette-AppBar-defaultBg`+`--jf-palette-AppBar-gradient`; **dark theme overrides** to `rgba(var(--jf-palette-background-paperChannel) / .8)` (`themes/dark/theme.scss:26`). Live: `rgba(32,32,32,0.8)` |
| `.infoWrapper` | title + meta column | all | yes | `librarybrowser.scss:785-803`: `flex:1 0 0; min-width:0`. Mobile gets `header-poster-padding` (`padding-left:37.5%` → `10%` across 7 breakpoints, `librarybrowser.scss:5-33`) to clear the poster |
| `.nameContainer` | holds h1/h3/h4 | all | yes | `display:flex; flex-direction:column; flex-wrap:wrap` (`:680`) |
| `.itemName`, `.itemName.infoText` | title | all | yes | `:638` `margin:.5em 0; font-weight:600; white-space:nowrap; text-overflow:ellipsis; overflow:hidden`; mobile unclamps + `font-size:1.6em` for `h1` (`:663`) |
| `.itemName.parentNameLast`, `.withOriginalTitle`, `.originalTitle`, `.subtitle` | title variants | all | yes | `:651-678`, `:739-750` |
| `.parentName` | series name on episode/season | all | yes | `:615`; `h1.parentName` mobile `font-size:1.6em` |
| `.parentName a`, `.subtitle a` | parent links | all | **needs `!important`** | inline `style="color:inherit;"` in `renderName()` (`index.js:444,450,452,456`) |
| `.itemMiscInfo`, `.itemMiscInfo-primary`, `.itemMiscInfo-secondary` | meta rows | all | careful | `:686` `display:flex; flex-wrap:wrap; align-items:center`; `:85-89` `text-overflow:ellipsis; overflow:hidden`. **Inline `style="margin-bottom:.6em"` from the template** (`index.html:14-15`) |
| `.mediaInfoItem` | one meta chip | all | yes | `mediainfo.scss:1-11` `margin:0 1em 0 0` |
| `.mediaInfoText` | boxed chip (rating, CC) | all | yes | `mediainfo.scss:13-21` + `_theme.scss:388-392` `border: 1px solid; border-color: inherit` |
| `.mediaInfoOfficialRating` | age rating box | all | yes | emitted as `mediaInfoItem mediaInfoText mediaInfoOfficialRating` (`mediainfo.js:271-275`) |
| `.starRatingContainer` / `.starIcon` | community rating | all | yes | `mediainfo.scss:43-57`, star hard-coded `#f2b01e` |
| `.mediaInfoCriticRating{Fresh,Rotten}` | tomato score | all | yes | `mediainfo.scss:59-80`, `background-image: url(assets/img/{fresh,rotten}.svg)` |
| `.endsAt.mediaInfoItem` | "Koniec o …" | all | yes | hidden `≤31.25em` (`librarybrowser.scss:1119`); text ticked by JS (`mediainfo.js:396-402`) |
| `.mainDetailButtons` | button row | all | yes | `:632` `display:flex; align-items:center; margin:1em 0`; `≥100em` `font-size:108%` (`:1096`); mobile centered + `header-poster-padding` (`:711-737`) |
| `.detailButton` | one action button, also `.button-flat.emby-button` | all | careful | `:1030-1058` `margin:0 !important; padding:.7em !important` then `padding-left/right` `!important` at 29/32/35em |
| `.btnPlay` | play **and** resume (`data-action="resume"`, title flips) | all | yes | `index.js:328-360`. **There is no `.btnResume` in 12.1** |
| `.btnReplay` | "start over", shown only when resumable | all | yes | `index.js:341,351-352` |
| `.btnShuffle` | folders + music | all | yes | `index.js:347` |
| `.btnPlayTrailer` | trailer | all | yes | `index.js:508-513` |
| `.btnPlaystate[.playstatebutton-played]` | watched toggle | all | yes | `emby-playstatebutton.js:37-46`; icon gets `.playstatebutton-icon-played` / `-unplayed`, coloured `--jf-palette-error-light` (`_theme.scss:557-560`) |
| `.btnUserRating[.ratingbutton-withrating]` | favourite | all | yes | `emby-ratingbutton.js:39-48`; icon `.ratingbutton-icon-withrating` |
| `.btnDownload`, `.btnInstantMix`, `.btnCancelTimer`, `.btnCancelSeriesTimer`, `.btnSplitVersions`, `.btnMoreCommands` | remaining actions | all | yes | `index.html:31-89` |
| `.detailButton-content` / `.detailButton-icon` | icon wrapper / glyph | all | careful | `:1060-1071`; icon `font-size:1.6em !important` |
| `.detailPagePrimaryContent` | right-hand column | all | yes | `:889-911` `padding-top:1.25em; padding-left:32.45vw`; mobile `padding-left/right: 5% !important`; has `::after{clear:both}` |
| `.detailSection` | inner wrapper | all | yes | no rules of its own — free hook |
| `.trackSelections` + `.selectContainer` + `.detailTrackSelect` | media source / video / audio / subtitle selects | all | yes | `:1417-1460`; `max-width:44em`; label `flex-basis:6.25em` (mobile `4.5em`); `margin … !important` |
| `.emby-select-withcolor` | the `<select>` skin | all | yes | `_theme.scss:408-426`; `background: var(--jf-palette-background-paper)`. `[disabled]` forces `background:none!important; border-color:transparent!important; color:inherit!important` (`emby-select.scss:30-34`) |
| `.detailSectionContent` | genres/tagline/overview/tags/links | all | yes | only `a { color: inherit }` (`:595`) |
| `.tagline` | `h3`, first tagline | all | yes | no dedicated rule — free hook |
| `.overview` | synopsis, `<bdi><p>…` | all | yes | no dedicated rule; JS adds `.detail-clamp-text` |
| `.detail-clamp-text` | line clamp | all | **careful** | `:1467-1480` `-webkit-line-clamp: 12` (`6` ≥40em) + `display:-webkit-box` |
| `.overview-controls` / `.overview-expand` | "Pokaż więcej" | all | yes | `:1462-1465` `display:flex; justify-content:flex-end`. Visibility decided by a **one-shot JS measurement** (see gotchas) |
| `#itemBirthday`, `#itemBirthLocation`, `#itemDeathDate`, `#seriesAirTime` | person/series facts | all | yes | `index.js:609-663`, `renderSeriesAirTime` `:1283` |
| `.itemTags` | tag links | all | careful | inline `style="margin:.7em 0;font-size:92%"` (`index.html:124`); contains a leading text node `"Znaczniki: "` from `TagsValue` (`index.js:1333`) |
| `.itemExternalLinks` | IMDb / TMDB | all | careful | inline `style="margin:.7em 0;font-size:92%"` (`index.html:125`); items joined by literal `", "` text nodes (`index.js:743-747`) |
| `.itemDetailsGroup` | Director/Writer/Studio/Genre block | all | yes | `:1413` `margin-top:1.5em`; contains 6 unstyled `<div>` React roots (always 6, even when empty) |
| `.detailsGroupItem` | one metadata row (**MUI `Box`**) | all | yes | `:1421-1430` `display:flex; max-width:44em; margin:0 0 .5em !important`; live classes `detailsGroupItem MuiBox-root css-0` |
| `.detailsGroupItem .label` | row label (**MUI `Typography`**) | all | yes | `:1432-1439` `flex-basis:6.25em` (mobile `4.5em`); live `p.MuiTypography-root.MuiTypography-body1.label.css-pl8nxc` — **target `.label`, never `css-pl8nxc`** |
| `.detailsGroupItem a.button-link` | metadata links | all | **needs `!important`** | inline `style="color: inherit;"` (`ItemDetailsMetadataList.tsx:38`) |
| `.detailPageSecondaryContainer` | full-width sections | all | yes | `:814-824` `padding-top:1.25em`; desktop `flex-grow:1`; also `.padded-left` (3.3%) + `.padded-bottom-page` (`padding-bottom:5em !important`) |
| `.verticalSection` | generic section | all | yes | **no CSS at all in 12.1** — a completely free hook |
| `.detailVerticalSection` | detail-page section | all | yes | only `:1124` (`.emby-scrollbuttons{padding-top:.4em}`) and `:1128` (tv `margin-bottom:3.4em !important`) — near-free hook |
| `.verticalSection-extrabottompadding` | extra gap | all | yes | `:1223-1229` `margin-bottom:2.7em` (mobile `1em`) |
| `.sectionTitle`, `.sectionTitle-cards` | `h2` headings | all | yes | `:1254-1262` `div:not(.sectionTitleContainer-cards) > .sectionTitle-cards { margin:0; padding-top:.5em; padding-bottom:.2em }` |
| `#castCollapsible` / `#peopleHeader` / `#castContent` | cast row | all | yes | `index.js:1846-1864`. **`.peopleSection` does not exist in 12.1** |
| `#guestCastCollapsible` / `#guestCastHeader` / `#guestCastContent` | guest stars | all | yes | `index.js:1866-1884` |
| `.personCard` | a cast card | all | yes | `card.overflowPortraitCard.personCard.card-hoverable.card-withuserdata [data-type=Actor]`; `_theme.scss:273-300` turns it into a circle only when the theme sets `$rounded-person-cards` (purplehaze) |
| `.personCard .cardText-first` / `.cardText-secondary` | name / role | all | yes | role text lives in `.cardText-secondary > bdi > span`; coloured `--jf-palette-text-secondary` (`_theme.scss:250-262`) |
| `#similarCollapsible` / `.similarContent` | "Więcej podobnych" | all | yes | `index.js:1233`, `shape:'autooverflow'` |
| `.nextUpSection` / `.nextUpItems` | Series next-up | all | yes | `index.js:786-817`, `shape:'overflowBackdrop'`, container `.vertical-wrap` |
| `#specialsCollapsible` / `#specialsContent` | "Special features" | all | yes | shown when `item.SpecialFeatureCount > 0` (`index.js:853-857`); cards via `getVideosHtml` `shape:'autooverflow'`, `action:'play'` |
| `#scenesCollapsible` / `#scenesContent` | chapters | all | yes | `renderScenes()` `index.js:1801-1823`; requires `Chapters[0].ImageTag` |
| `.chapterCard`, `.chapterCardImageContainer`, `.innerCardFooter` | one chapter card (`<button>`) | all | yes | `chapterCardBuilder.js:20,88,106`; `.chapterCardImageContainer{background-color:#000;border-radius:0}` (`card.scss:186-189`) |
| `#collectionsCollapsible` / `.collectionsContent` | "Kolekcje" this item belongs to | all | yes | `renderItemCollections()` `index.js:1182`, `shape:'overflowPortrait'` |
| `.collectionItems` / `.collectionItemsContainer` | BoxSet children, grouped by type | all | yes | `index.js:1736-1762`; `.itemsContainer.collectionItemsContainer.vertical-wrap.padded-left.padded-right` |
| `.moreFromSeasonSection` / `.moreFromArtistSection` | sibling rows | all | yes | `index.js:1081`, `:1127` |
| `#additionalPartsCollapsible` / `#additionalPartsContent` | multi-part video | all | yes | `index.js:893-896` |
| `#lyricsSection.lyricsContainer` / `.lyricsLineContainer` | lyrics | all | yes | `index.js:1049`; `:1487` `width:fit-content` |
| `#seriesScheduleSection` / `#seriesScheduleList` | upcoming TV | all | yes | `index.js:1614` |
| `#seriesTimerScheduleSection` | live-TV schedule | all | careful | inline `style="margin-top:-3em"` (`index.html:131`) |
| `.recordingFields` | live-TV record controls | all | careful | inline `style="margin:.5em 0 1.5em"` (`index.html:110`); `.mainDetailButtons.hide + .recordingFields{margin-top:1.5em !important}` (`:1026`) |
| `#listChildrenCollapsible` / `#childrenContent` | seasons/episodes/tracks | all | yes | see table above |
| `#childrenCollapsible` | other folder children | all | careful | inner `.itemsContainer` has inline `style="text-align:left"` (`index.html:152,165`) |
| `.emby-scroller-container` / `.emby-scroller` / `.scrollSlider` | horizontal row plumbing | all | careful | `emby-scroller.scss:3-11`; desktop rows get `.animatedScrollX` + inline `transform`/`will-change` (see gotchas). Mobile uses `.scrollX.hiddenScrollX` native scroll instead |
| `.emby-scrollbuttons` / `.emby-scrollbuttons-button` | row arrows | desktop/tv | yes | only rendered when the scroller is transform-driven; `.hide` when at an edge |
| `.itemsContainer`, `.vertical-list`, `.vertical-wrap` | flex containers | all | yes | `card.scss:33-48`; `.itemsContainer{margin:0 auto}` (`librarybrowser.scss:1197`) |
| `.itemsContainer > .card > .cardBox` | first-card alignment | all | careful | `emby-scroller.scss:19-27` `margin-left:0; margin-right:1.2em` |
| `.listItem.listItem-largeImage.listItem-withContentWrapper` | episode row | all | yes | `listview.scss:1-42` — **`contain: layout style`**; `overflow:hidden`; `padding:.25em .25em .25em .5em` |
| `.listItemImage.listItemImage-large` | episode thumbnail | all | careful | `listview.scss:135-156` `width:19.5vw; height:13vw` (`22vw/16vw` ≤64em; `30vw/20vw !important` with `-tv`); inline `background-image`. `display:none` ≤40em for `[data-type=Movie|Series]` |
| `.listItemImageButton` / `-icon` | hover play on the thumb | all | yes | hard-coded `#00a4dc` hover (`listview.scss:158-178`) |
| `.listItemBody` / `.listItemBodyText` | text column | all | yes | `listview.scss:101-127`; **`contain: layout style`** on `.listItemBody` |
| `.listItemMediaInfo` | runtime/rating strip | all | yes | `listview.scss:1-10`; **`display:none` ≤50em** (`:217`) |
| `.listItem-overview`, `.listItem .endsAt`, `.listItem .criticRating` | | all | yes | **`display:none !important` ≤50em** (`listview.scss:306-311`) |
| `.listItem-bottomoverview` | alternate overview slot | all | yes | `listview.scss:300-304`; `.hide` in practice |
| `.listViewUserDataButtons` / `.listItemButton` | row actions | all | yes | `librarybrowser.scss:1207`, `listview.scss:83-91` (`contain: layout style`) |
| `.listItemProgressBar` / `.itemProgressBar` / `.itemProgressBarForeground` | resume bar | all | yes | `listview.scss:262-267`, `indicators.scss:1-28` |
| `.listItemIndicators`, `.indicator`, `.countIndicator`, `.playedIndicator`, `.cardIndicators` | badges | all | yes | `listview.scss:298-304`, `indicators.scss:30-85`, `card.scss:406-418` (`z-index:1`, `contain: layout style`) |
| `.listItem:hover` / `:focus` | | all | yes | `--jf-palette-action-hover` / `-focus` (`_theme.scss:367-373`); `:focus{border-radius:.2em}` and `:focus .secondary{color:inherit !important}` (`listview.scss:269-275`) |
| `.hide` | universal hide | all | **override needs `!important`** | `display:none !important` in the **inline `<style>` in `<head>`** (`src/index.html:61-67`) |
| `.hide-mobile` / `.hide-desktop` / `.hide-tv` | layout-scoped hide | all | same | same block |

### DEAD selectors (styled by 12.1 SCSS but never emitted) — do not build on them

`.itemDetailImage` (`librarybrowser.scss:913`), `.itemDetailGalleryLink` (`:922,926,942`),
`.detailImageProgressContainer` (`:1073`), `.itemBackdropProgressBar` (`:603`), `.detailButton-text` (`:1079`),
`.detailButtonHideonMobile` (`:1086`), `.btnPlaySimple` (`:967`), `.lnkSibling` (`:973`),
`.mobileDetails` / `.desktopDetails` (`:989,995`), `.desktopMiscInfoContainer` (`:610`),
`.personBackdrop` (`:599,1092`), `.detailPageCollabsible` (`:1008`), `.detailCollapsibleSection` (`:1004`),
`.itemTag` singular (`:523`), `.itemOverview` (`:528`), `.itemLinks` (`:532`), `.criticReview*` (`:511-521`),
`.review*` (`:540-569`).
Also **not present in 12.1 at all**: `.detailBackdrop`, `.btnResume`, `.peopleSection`, `.btnTrailer`
(it is `.btnPlayTrailer`).

## Existing styling that will fight a custom theme

**Inline styles (beat every non-`!important` rule)**

| element | inline style | origin |
|---|---|---|
| `#itemBackdrop` (mobile only) | `background-image: url(…)` | `imageLoader.js:118-124` via `renderHeaderBackdrop` |
| `.detailLogo` | `background-image: url(…)` | same, via `renderLogo` (`index.js:693-703`) |
| `.backdropImage` | `background-image: url(…)` | `backdrop.js:31` |
| `.detailImageContainer .cardImageContainer` | `cursor: default;` then `background-image: url(…)` | `cardImage.ts:66`, `imageLoader.js:118` |
| `.listItemImage` | `background-image: url(…)` | `imageLoader.js:118` |
| `.itemMiscInfo-primary/-secondary` | `margin-bottom: .6em` | `index.html:14-15` |
| `.itemTags`, `.itemExternalLinks` | `margin: .7em 0; font-size: 92%` | `index.html:124-125` |
| `.recordingFields` | `margin: .5em 0 1.5em` | `index.html:110` |
| `#seriesTimerScheduleSection` | `margin-top: -3em` | `index.html:131` |
| `#childrenContent .itemsContainer`, `#childrenCollapsible .itemsContainer` | `text-align: left` | `index.html:152,165` |
| `.detailsGroupItem a.button-link` | `color: inherit` | `ItemDetailsMetadataList.tsx:38` |
| `.parentName a`, `.subtitle a` | `color: inherit` | `index.js:444,450,452,456` |
| `.scrollSlider.animatedScrollX` (desktop rows) | `will-change: transform; transition: transform NNNms ease-out; transform: translateX(…)` | `src/lib/scroller/index.js:772-777` |

**`!important` already in the stock CSS** (your rules must match or exceed it)

`.hide{display:none!important}` (head `<style>`), `.libraryPage{padding-top:7em!important}`,
`.itemDetailPage{padding-top:0!important}`, `.page{padding-bottom:5em!important}`,
`.detailButton{margin:0!important;padding:.7em!important}` + three `padding-left/right` overrides,
`.detailButton-icon{font-size:1.6em!important}`, `.detailPagePrimaryContent` mobile `padding-left/right:5%!important`,
`.detailsGroupItem,.trackSelections .selectContainer{margin:0 0 .5em!important}`,
`.cardBox{padding:0!important}`, `.cardBox-bottompadded{margin-bottom:1.8em!important}`,
`.layout-tv .detailVerticalSection{margin-bottom:3.4em!important}`,
`.mainDetailButtons.hide+.recordingFields{margin-top:1.5em!important}`,
`.emby-select[disabled]{background:none!important;border-color:transparent!important;color:inherit!important}`,
`.listItem-overview,.listItem .endsAt,.listItem .criticRating{display:none!important}` ≤50em,
`.listItemImage-large-tv{width/height … !important}`,
`.layout-mobile .itemBackdrop{margin-top:-48px!important}` (modern only),
`.hideMainDrawer`, `.noHeaderRight`, `.pageTabContent:not(.is-active){display:none!important}`.
Custom CSS is the **last `<style>` in `<body>`**, so at equal specificity + equal `!important` you win — but you
must repeat `!important` wherever they used it.

**JS-measured / JS-set sizes**

* `.overview-expand` ("Pokaż więcej") visibility is decided **once**, at render, by
  `Math.abs(overview.scrollHeight - overview.offsetHeight) > 2` (`index.js:936-941`). If your theme changes the
  `.overview` font-size, width or `-webkit-line-clamp`, the button will be shown/hidden wrongly and never re-evaluated.
* The poster image URL is requested at `window.innerWidth * 0.25` (`index.js:759`) and the backdrop at
  `dom.getScreenWidth()` — making the poster visually wider than 25vw will upscale a too-small JPEG.
* Horizontal rows: `scroller` writes `transform`, `transition` and `will-change` inline on `.scrollSlider`
  (`src/lib/scroller/index.js:772-777`) and toggles `.hide` on `.emby-scrollbuttons-button` from measured
  scroll positions. Changing card widths is fine; changing the slider's `position`/`overflow` will break it.
* `.emby-scroller` on mobile becomes native `overflow-x:auto` (`.scrollX.hiddenScrollX`) instead
  (`enableScrollX()` `index.js:1044-1046`, `browser.mobile && screen.availWidth <= 1000`).
* `imageLoader` toggles `.lazy-hidden` / `.lazy-image-fadein(-fast)` / `.blurhashed` / `.non-blurhashable`
  and injects a sibling `canvas.blurhash-canvas` **before** the image element
  (`imageLoader.js:36-46, 108-134`). Anything that assumes `.cardImageContainer` is the first child is wrong.

**Containment / transform / overflow ancestors**

| ancestor | value | effect |
|---|---|---|
| `#itemDetailPage.mainAnimatedPage` | `contain: style size` (live) — `site.scss:88-90` overrides `viewContainer.scss:1-8`'s `layout style size` with `style size !important` | **no `layout`/`paint` ⇒ `position:fixed` descendants still anchor to the viewport.** Good news for sticky/fixed Netflix-style hero overlays. `size` means page height never grows from content; the page box stays viewport-sized and content overflows visibly |
| `.layout-mobile .itemDetailPage` (modern only) | `overflow-x: clip` | horizontal bleed is clipped on modern-mobile but **not** on legacy-mobile |
| `.backdropContainer` | `contain: size layout style`, `position:fixed`, `z-index:-1` | isolated; `.backdropImage` inside has `contain: layout style` |
| `.backgroundContainer` | `contain: strict`, `position:fixed`, `opacity:.86` when `.withBackdrop` | an opacity < 1 creates a stacking context |
| `.skinHeader` (legacy) | `contain: layout style paint` | fixed children inside it are trapped |
| `.listItem`, `.listItemBody`, `.listItemMediaInfo`, `.listItemButton` | `contain: layout style` | can't overflow decorations out of a row |
| `.card` | `contain: content`; `.cardScalable` `contain: layout style`; `.cardPadder-*` `contain: strict`; `.cardImageContainer` (in `.cardScalable`) `contain: strict` | **a card cannot paint outside itself** — Netflix-style hover cards that grow past the tile need `.card:focus`-like `z-index` plus removing/limiting containment |
| `.scrollSlider.animatedScrollX` | inline `transform` | creates a containing block; `position:fixed` inside a desktop row will not escape |
| `.itemDetailPage` itself | `overflow: visible` on desktop | full-bleed hero is possible on desktop without hacks |

**z-index stack on this page (live)**

```
 1100  header.MuiAppBar (modern)
 1099  .mainDrawer
  999  .skinHeader (legacy)
    3  .detailImageContainer .card          (poster)
    2  .detailRibbon
    1  .cardIndicators
    0  .emby-button (all detail buttons)
   -1  .backdropContainer
```
`.card:focus` jumps to `z-index: 10 !important` (`card.scss:130-134`).

**Hashed MUI/emotion classes present on this page — never target them**

`header…css-1u7mpsp`, `.MuiToolbar-root…css-1tmqktv`, `div.MuiBox-root.css-sjv9i2`, `main.MuiBox-root.css-1iogify`,
`.detailsGroupItem.MuiBox-root.css-0`, `p.MuiTypography-root.MuiTypography-body1.label.css-pl8nxc`,
`span.MuiBox-root.css-0`.
Stable alternatives: `.detailsGroupItem`, `.detailsGroupItem .label`, `.detailsGroupItem .focuscontainer-x`,
and for the chrome `header.MuiAppBar-root` / `.MuiToolbar-root` (MUI's own non-hashed utility classes are stable).

## Theming hooks

**`--jf-*` variables consumed on this page** (live values, `data-theme="dark"`):

| variable | live value | where it lands here |
|---|---|---|
| `--jf-palette-background-default` | `#101010` | `.backgroundContainer`, `html`, `.noBackdropTransparency .detailPageWrapperContainer` |
| `--jf-palette-background-defaultImage` | `none` | same (page background image) |
| `--jf-palette-background-paper` | `#202020` | `.emby-select-withcolor` and its `<option>`s |
| `--jf-palette-background-paperChannel` | `32 32 32` | **`.detailRibbon` background** = `rgba(… / .8)` (dark theme) |
| `--jf-palette-AppBar-defaultBg` | `#202020` | `.detailRibbon` in the base theme |
| `--jf-palette-AppBar-gradient` | `none` | `.detailRibbon` `background-image` — **a free gradient slot the base theme already wires up** |
| `--jf-palette-AppBar-transparentBg` | `rgba(0,0,0,.4)` | `.skinHeader.semiTransparent` |
| `--jf-palette-primary-main` | `#00a4dc` | `.button-link` (tags, external links), `.button-flat:hover`, `.paper-icon-button-light:hover` |
| `--jf-palette-secondary-main` | `#00a4dc` | card focus ring, `.emby-select-withcolor:focus` |
| `--jf-palette-text-primary` | `#fff` | headings |
| `--jf-palette-text-secondary` | `rgba(255,255,255,.7)` | `html`, `.listItem .secondary`, `.cardText-secondary` |
| `--jf-palette-divider` | `rgba(255,255,255,.12)` | `.listItem-border` |
| `--jf-palette-action-hover` / `-focus` | `rgba(255,255,255,.08)` / `.12` | `.listItem:hover` / `:focus` |
| `--jf-palette-error-light` | `rgb(209,83,83)` | `.playstatebutton-icon-played`, `.ratingbutton-icon-withrating` |
| `--jf-card-borderRadius` | `0.2em` | card focus ring radius (`_theme.scss:569,576`) — note `.cardImageContainer` itself hard-codes `border-radius:.2em` (`card.scss:170`) |

Redefine them on `:root` / `[data-theme="dark"]` from custom CSS — the MUI `cssVariables` block lives in a
`<style>` in `<head>`, so a `:root{…}` in custom CSS wins at equal specificity.
`--jf-palette-AppBar-gradient` is the cleanest way to put a Netflix-like gradient on `.detailRibbon` without
touching `background-color`.

**Classes toggled by JS (usable as state selectors)**

| class | on | meaning |
|---|---|---|
| `.hide` | almost every section/button | not applicable to this item |
| `.noBackdropTransparency` | `#itemDetailPage` | header banner on, global backdrops off (`index.js:520`) |
| `.playstatebutton-played` / `.playstatebutton-icon-played` / `-unplayed` | `.btnPlaystate` / its icon | watched state |
| `.ratingbutton-withrating` / `.ratingbutton-icon-withrating` | `.btnUserRating` / icon | favourited |
| `.detail-clamp-text` | `.overview` | clamped; removed while expanded |
| `.lazy` / `.lazy-hidden` / `.lazy-image-fadein` / `.lazy-image-fadein-fast` / `.blurhashed` / `.non-blurhashable` / `.lazy-hidden-children` | every image host | load state |
| `.scrollX` / `.hiddenScrollX` / `.vertical-wrap` / `.vertical-list` | `#childrenContent .itemsContainer` | layout mode chosen per item type (`index.js:1459-1474`) |
| `.verticalSection-extrabottompadding` | `#listChildrenCollapsible` | added for Season/MusicAlbum |
| `.animatedScrollX` | `.scrollSlider` | desktop transform-driven row |
| `.card-hoverable` / `.card-withuserdata` / `.show-focus` / `.show-animation` | cards | interaction affordances |
| `.withBackdrop` | `.backgroundContainer` | a backdrop image is active |
| `.transparentDocument` | `<html>` | player/fullscreen transparency mode |

**Useful `:has()` / `:not()` anchors** (no JS needed)

```css
/* item type, straight off the play-state button */
#itemDetailPage:has(.btnPlaystate[data-type="Movie"])   { … }
#itemDetailPage:has(.btnPlaystate[data-type="Series"])  { … }
#itemDetailPage:has(.btnPlaystate[data-type="Season"])  { … }
#itemDetailPage:has(.btnPlaystate[data-type="Episode"]) { … }
/* person pages have no play-state button at all */
#itemDetailPage:not(:has(.btnPlaystate:not(.hide))):has(#itemBirthday:not(.hide)) { … }

/* resume vs fresh play */
.mainDetailButtons:has(.btnReplay:not(.hide)) .btnPlay { /* this is "Resume" */ }

/* only the sections that are actually rendered */
.detailVerticalSection:not(.hide) { … }
.detailPageSecondaryContainer > .verticalSection:not(.hide) + .verticalSection:not(.hide) { … }

/* hero without a logo */
#itemDetailPage:has(.detailLogo.hide) .infoWrapper .itemName { /* show the text title big */ }

/* mobile vs desktop poster slot */
.detailImageContainer:not(.hide-mobile) { /* the in-ribbon, mobile one */ }
```

## Netflix-relevance notes

| Netflix element | Jellyfin 12.1 equivalent | notes / what pure CSS can and cannot do |
|---|---|---|
| Full-bleed hero still (title art billboard) | **desktop/tv:** `.backdropContainer > .backdropImage` (fixed, `z-index:-1`) seen through the transparent `#itemBackdrop` spacer; **mobile:** `#itemBackdrop` itself with a real `background-image` | Two completely different mechanisms — **you must style both**. On desktop you cannot change the backdrop's *height*: it is a fixed 100vw×100vh layer; you shape the reveal by restyling `#itemBackdrop` (`height`, `mask-image`) and by removing `.noBackdropTransparency`'s solid background. On mobile you style `#itemBackdrop` directly |
| Bottom-fade gradient over the hero | none on desktop; modern-mobile has a *top* fade via `.layout-mobile .itemBackdrop::before` (`AppOverrides.scss:38-45`) | Add your own `#itemBackdrop::after` (desktop) — it is an empty element, so a pseudo is free. On modern-mobile the `::before` is already taken; use `::after` |
| Big title logo over the art | `.detailLogo` | Already a `background-image` box at `top:10vh; right:25vw; width:25vw`. **Hidden below 68.75em and on mobile/tv** (`librarybrowser.scss:501-508`) — re-showing it on mobile is one `display:block`, but its absolute coordinates assume a desktop hero |
| Left-aligned title block over the art | `.detailRibbon > .infoWrapper` | Currently a horizontal opaque band pinned to the bottom of the hero (`margin-top:-7.2em; height:7.2em`). To get Netflix's "text floating on the art" look: `background: transparent` on `.detailRibbon`, drop the fixed `height`, and drop the desktop `padding-left: 32.45vw` |
| Big red ▶ Play / Resume pill with text | `.btnPlay` (+ `.btnReplay`) inside `.mainDetailButtons` | The button contains **only an icon** (`div.detailButton-content > span.material-icons.play_arrow`) — there is no text node. A "Play" label must be a `::after { content: "Play" }` on `.btnPlay`, which is **not localisable** and will read as decorative text to screen readers. Rounding + red fill + width are trivial |
| "+ My List" / thumbs | `.btnUserRating` (heart) and `.btnPlaystate` (check) | Icon glyphs come from the Material Icons ligature in the class name (`.favorite`, `.check`). You cannot swap the glyph in CSS without `content:` overrides on `.material-icons`, which fights the ligature font |
| Match %, year, rating badge, HD badge row | `.itemMiscInfo-primary > .mediaInfoItem`, `.mediaInfoOfficialRating`, `.starRatingContainer`, `.mediaInfoCriticRating` | Reorderable with `order:` (the parent is `display:flex`). There is **no "match %"** concept in Jellyfin — `.starRatingContainer` (community rating) is the closest stand-in; recolouring it green is pure CSS |
| Synopsis + cast/genre sidebar | `.overview` + `.itemDetailsGroup > .detailsGroupItem` | Netflix's two-column "description \| Cast/Genres/This show is" split is achievable: make `.detailSectionContent` a grid and move `.itemDetailsGroup` into the second column. Caveat: `.itemDetailsGroup` always contains **6** wrapper `<div>`s, 2 of which are usually empty — target `.detailsGroupItem` (the inner node) for spacing, not the wrappers |
| Episode list with big thumbnail | `.listItem.listItem-largeImage` (Season page) | Very close to Netflix already. `.listItemMediaInfo` and `.listItem-overview` are `display:none` below 50em (`listview.scss:217, 306-311`) — re-show them with `!important` if you want the mobile episode row to keep its synopsis |
| Episode-number circle | `.listItemBodyText > bdi` text is `"1. Pilot"` — number and title are one text node | **Impossible in pure CSS** to split the number into its own badge |
| Season picker dropdown | none — seasons are a **card row** (`#listChildrenCollapsible`, `.overflowPortraitCard`) on the Series page, and each season is its own route | Cannot be turned into a `<select>`; you can make it a horizontal pill row |
| "More Like This" grid | `#similarCollapsible .similarContent` (horizontal scroller) | Netflix uses a wrapping grid. `.itemsContainer` is flex; adding `flex-wrap: wrap` works only on mobile (native scroll). On desktop the scroller writes inline `transform` and keeps `white-space`/measurement state — forcing a wrap there fights `src/lib/scroller` |
| Hover-to-expand card previews | `.card-hoverable`, `.cardOverlayContainer`, `.cardOverlayButton*` | Scaling on hover is possible, but `.card{contain:content}` and `.cardScalable{contain:layout style}` **clip anything painted outside the tile**. A real Netflix expand-out-of-row card needs containment relaxed on `.card`/`.cardScalable` plus a `z-index` bump — doable but it changes stock paint behaviour, and the row itself may clip via `overflow-x:auto` on mobile |
| Video autoplay preview in the hero | none | `#itemBackdrop` is a `<div>` with a background image — **no `<video>` element exists**; impossible in CSS |
| Top-nav that turns opaque on scroll | modern `header.MuiAppBar-colorTransparent`; legacy `.skinHeader.semiTransparent` + `.headroom--pinned/--unpinned` | Scroll-state classes are applied by the header code, not this page. Use `--jf-palette-AppBar-transparentBg` |
| Dark page body under the hero | `.noBackdropTransparency .detailPageWrapperContainer` (solid) vs the translucent `.backgroundContainer` (`opacity:.86`) | Which one applies depends on the **user's** "Backdrops" and "Details banner" settings (`index.js:516-524`). Write rules for both states: `#itemDetailPage.noBackdropTransparency …` and `#itemDetailPage:not(.noBackdropTransparency) …` |

### Verified live

`modern-desktop` × `details-movie`, `details-series`, `details-season`, `details-episode`, `details-person`;
`modern-mobile` × `details-movie`; `legacy-desktop` × `details-movie`; `legacy-mobile` × `details-movie`, `details-series`.
Baseline screenshots inspected: `_shots/baseline/modern-desktop/{details-movie,details-season,details-episode}.png`,
`_shots/baseline/modern-mobile/details-movie.png`.
Not live-verified (no such content in the test library): `#specialsCollapsible`, `#scenesCollapsible`,
`#collectionsCollapsible`, `#additionalPartsCollapsible`, `#lyricsSection`, `.collectionItems` (BoxSet),
`.moreFromArtistSection`, `#seriesTimerScheduleSection`, `.recordingFields`, `.programGuideSection` —
those are documented from source only.

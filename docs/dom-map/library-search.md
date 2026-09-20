# Library / browse views, filters, search, genres, lists (Jellyfin 12.1)

Scope: everything between the app bar and the item details page — library grid pages, the library
toolbar (view menu / count chip / play / filter / sort / view-settings / pagination), the alphabet
picker, the genre / suggestion / upcoming section rows, the search page, list view, the no-items
placeholders, and the overlays (MUI popovers/menus + legacy `formDialog`s) these controls open.

Everything marked **[live]** was dumped from the running 12.1 test server with
`tools/pw.sh tools/dom.mjs`. Everything marked **[src]** comes from `_ref/jellyfin-web` at v12.1 and
was not (or could not be) reproduced live. Root font-size is **14.88px** **[live]**, so every `em`
value in stock CSS is 14.88px-based, not 16px.

---

## Where it appears (routes, layouts, breakpoints)

### Modern layout (`html.layout-desktop` / `html.layout-mobile`, React + MUI) — the default

`src/apps/modern/features/libraries/components/LibraryPage.tsx:44-60` renders one `Page` per
collection type; `PageTabContent.tsx:19-69` switches the body by `viewType`.

| hash route | page id | tabs (`?tab=`) | body component |
|---|---|---|---|
| `#/movies?topParentId=<id>` | `#moviesPage` | 0 Movies, 1 Suggestions, 2 Favorites, 3 Collections, 4 Genres, 5 Studios, 6 Playlists | `ItemsView` except 1=`SuggestionsSectionView`, 4=`GenresView` |
| `#/tv?topParentId=<id>` | `#tvshowsPage` | 0 Shows, 1 Suggestions, 2 Upcoming, 3 Genres, 4 Networks, 5 Episodes, 6 Collections, 7 Playlists | `ItemsView` except 1=`Suggestions`, 2=`UpcomingView`, 3=`GenresView` |
| `#/music` | `#musicPage` | 0 Albums, 1 Suggestions, 2 AlbumArtists, 3 Artists, 4 Playlists, 5 Songs, 6 Genres, 7 Collections | Songs defaults to **list view** (`settings.ts:21`) |
| `#/books` | `#booksPage` | 0 Folders, 1 Books, 2 Authors, 3 Suggestions, 4 Genres, 5 Collections, 6 Favorites | |
| `#/boxsets` | `#boxsetsPage` | 0 Collections, 1 Favorites, 2 Genres | |
| `#/playlists` | `#playlistsPage` | 0 Playlists, 1 Favorites | |
| `#/homevideos` | `#homevideos` | 0 Folders, 1 Photos, 2 PhotoAlbums, 3 Videos | |
| `#/musicvideos` | `#musicvideos` | 0 Folders, 1 Suggestions, 2 Videos, 3 Playlists | |
| `#/livetv` | `#liveTvPage` | 0 Programs, 1 Guide, 2 Channels, 3 Recordings, 4 Schedule, 5 SeriesTimers | `ProgramsSectionView` / `GuideView` |
| `#/mixed` | `#mixed` | 0 Folders, 1 Suggestions, 2 Media, 3 Collections, 4 Playlists | |
| `#/search?query=…` | `#searchPage` | — | **legacy** components (`src/apps/legacy/routes/search.tsx:24-43`) even in the modern app |
| `#/list?genreId=…` / `?itemTypes=…` | `.page.libraryPage.noSecondaryNavPage` (no id) | — | **legacy** controller `src/apps/legacy/controllers/list.html` — this is where genre "see all" and suggestion-section headers link |

Route list: `src/apps/modern/features/libraries/constants/libraryRoutes.ts:7-348`.
`isLibraryPath()` (`utils/path.ts:14-16`) is what makes `AppLayout.tsx:51` render `<LibraryToolbar/>`,
so the toolbar exists on the 10 paths above but **not** on `#/search` or `#/list`.

The library toolbar lives **inside the fixed AppBar**, not inside the page
(`AppLayout.tsx:45-52`): `header.MuiAppBar-root` holds toolbar 1 (app nav) and toolbar 2 (library).

### Legacy layout (`html.layout-desktop` with `localStorage.layout=desktop-legacy`)

`#/movies` → `div#moviesPage.page.libraryPage.collectionEditorPage.pageWithAbsoluteTabs.withTabs`
with pre-rendered, `display:none`-toggled tab panes `#moviesTab` / `#suggestionsTab` /
`#favoritesTab` / `#collectionsTab` / `#genresTab`, each `.pageTabContent[data-index]`
(`src/apps/legacy/controllers/movies/movies.html:1-81`) **[live]**. Controls are
`paper-icon-button-light` buttons in a centered flex bar, not MUI.

### TV layout (`html.layout-tv`)

Cards become `<button>` instead of `<div>` (`CardWrapper.tsx`), lists get
`itemAction listItem-button listItem-focusscale` (`ListWrapper.tsx:31-33`), grids get
`.itemsContainer-tv` fixed card widths (`card.scss:659-670`). **[src]**

### Breakpoints that change this subsystem

* MUI `sm` = 600px: `LibraryToolbar.tsx:58` `isSmallScreen` — below it the button row wraps to its own
  line (`flexBasis: 100%`), buttons switch to `size="small"`, play/shuffle lose their labels. **[live]**
  desktop AppBar = 96px tall (2×48), mobile = **132px** (48 + 84 wrapped).
* `ItemsView.tsx:43-52`: alphabet picker renders only if
  `(max-width:600px) and (min-height:575px)` **or** `(min-width:600px) and (min-height:610px)`.
* `alphaPicker/style.scss:134-138`: `.alphaPicker-fixed { display:none !important }` under
  `max-height: 31.25em` (≈465px).
* Card widths are percentage steps in `card.scss:507-657`: portrait/square go
  33.3% → 25% (31.25em) → 20% (50em) → 16.67% (75em) → 14.29% (87.5em) → 12.5% (100em) →
  11.11% (120em) → 10% (131.25em). **[live]** 1920px desktop = 11.111% (199.25px card in a
  1793.28px content box); 390px mobile = 33.333% (121px).
* `librarybrowser.scss:1393-1403`: `.listIconButton-autohide` hidden ≥40em, `.listTextButton-autohide`
  hidden ≤40em (legacy `#/list` toolbar only).

---

## DOM skeleton (real markup, trimmed)

### A. Modern library grid — `#/movies` (modern-desktop) **[live]**

```
html.layout-desktop[data-theme="dark"]
  body.libraryDocument.withSectionTabs          ← overflow: hidden auto (clips the row overflow)
    div#reactRoot
      div.backdropContainer / div.backgroundContainer
      div.MuiBox-root.css-sjv9i2                ← flex column, height:100%
        header.MuiPaper-root.MuiAppBar-root.MuiAppBar-colorTransparent.MuiAppBar-positionFixed.mui-fixed  {1920x96, z-index 1100}
          div.MuiToolbar-root.MuiToolbar-dense.padded-left.padded-right        ← app nav toolbar (other subsystem)
          div.MuiToolbar-root.MuiToolbar-dense.padded-left.padded-right        ← LIBRARY TOOLBAR
            button.MuiButton-root.MuiButton-sizeLarge [aria-controls="library-view-menu" aria-haspopup="true"]
              span.MuiTypography-root.MuiTypography-h2 "Filmy"
              span.MuiButton-endIcon > svg[data-testid="ArrowDropDownIcon"]
            div.MuiBox-root                                                    ← count chip wrapper
              div.MuiChip-root.MuiChip-filled.MuiChip-sizeMedium
                span.MuiChip-label.MuiChip-labelMedium "24"                    ← or "1-24 z 24" when paginated, "∙" while pending
            div.MuiStack-root                                                  ← right-hand button cluster
              div.MuiBox-root
                div.MuiButtonGroup-root.MuiButtonGroup-contained[role="group"]
                  button…MuiButtonGroup-firstButton  > svg[data-testid="PlayArrowIcon"] "Odtwarzaj wszystko"
                  button…MuiButtonGroup-lastButton   > svg[data-testid="ShuffleIcon"]
                (+ NewCollection / NewPlaylist Buttons here on those tabs, outside the group)
              div.MuiButtonGroup-root.MuiButtonGroup-text[role="group"]
                button > span.MuiBadge-root > svg[data-testid="FilterAltIcon"] + span.MuiBadge-badge.MuiBadge-dot.MuiBadge-colorInfo
                button > svg[data-testid="SortByAlphaIcon"]
                button > svg[data-testid="ViewModuleIcon"]                     ← ViewListIcon in list mode
              div.MuiButtonGroup-root.MuiButtonGroup-text[role="group"]        ← Pagination
                button.Mui-disabled > svg[data-testid="NavigateBeforeIcon"]
                button.Mui-disabled > svg[data-testid="NavigateNextIcon"]
        div[aria-hidden="true"][style="height: 96px; width: 100%; flex-shrink: 0;"]   ← JS-measured spacer
        main.MuiBox-root                                                        {position:relative; flex-grow:1}
          div.mainAnimatedPages.skinBody                                        ← legacy ViewManager host (0px tall here)
          div.skinBody
            div#moviesPage.page.mainAnimatedPage.libraryPage.pageWithAbsoluteTabs.withTabs
                                            {position:absolute; contain:size style; padding-bottom:74.4px}
              div.padded-bottom-page.MuiBox-root.css-0                          ← ItemsView root
                div.alphaPicker-fixed-right.MuiBox-root.css-11cf6b              {position:fixed; z-index:1099; top:96px; bottom:0}
                  div.MuiPaper-root.MuiPaper-elevation0                         {background:#202020; overflow:hidden; border-radius:1}
                    div.MuiToggleButtonGroup-root.MuiToggleButtonGroup-vertical[role="group"]
                      button.MuiToggleButton-root.MuiToggleButton-sizeSmall.MuiToggleButtonGroup-firstButton "#"
                      button…MuiToggleButtonGroup-middleButton "A" … (27 total)
                      button…MuiToggleButtonGroup-lastButton "Z"
                div.itemsContainer.padded-left.padded-right.vertical-wrap.MuiBox-root.css-0
                                            {display:flex; flex-wrap:wrap; padding:0 63.36px; margin:0 auto}
                  div.card.portraitCard.card-hoverable.card-withuserdata[data-type="Movie"]   {width:11.111%; contain:content}
                    div.cardBox.cardBox-bottompadded
                      div.cardScalable
                        div.cardPadder.cardPadder-portrait
                        div.cardContent > div.cardImageContainer.coveredImage > div.indicators
                        div.cardOverlayContainer.itemAction.MuiBox-root[data-action="link"]   ← desktop only
                          a.cardImageContainer[href="#/details?id=…"]
                          button.MuiIconButton-root.cardOverlayButton.cardOverlayButton-hover.cardOverlayFab-primary[data-action="play"]
                          div.MuiButtonGroup-root.cardOverlayButton-br.flex[role="group"]
                      div.cardText.cardTextCentered.cardText-first.MuiBox-root
                        a.itemAction.textActionButton[data-type="Movie" href="#/details?id=…"]
                      div.cardText.cardTextCentered.cardText-secondary.MuiBox-root "2022"
                  … (one .card per item, no virtualisation)
```

Mobile (`modern-mobile`) is the same tree; the card loses `.card-hoverable` and
`.cardOverlayContainer`, the `<a href>` wraps the image directly, and the overlay group is a single
`button[data-action="play"]`. **[live]**

### B. Section-row views — Genres tab (`&tab=4`) and Suggestions tab (`&tab=1`) **[live]**

```
div#moviesPage.page.libraryPage…
  div.alphaPicker-fixed-right.MuiBox-root            ← Genres only (GenresItemsContainer.tsx:88)
  div.verticalSection.MuiBox-root.css-0[.emby-scroller-container]   ← 2nd class ADDED BY JS when scroll buttons mount
    div.sectionTitleContainer.sectionTitleContainer-cards.padded-left.MuiBox-root
      a.MuiLink-root.MuiLink-underlineNone.clearLink.button-flat.sectionTitleTextButton[href="#/list?genreId=…"]
        h2.MuiTypography-h2.sectionTitle.sectionTitle-cards "Akcja"
        svg[data-testid="ChevronRightIcon"]
      (no <a> when the section has no url or ≤1 item — the h2 is then a direct child)
    div.emby-scrollbuttons.padded-right               {position:absolute}   ← desktop + fine pointer only
      button.paper-icon-button-light.emby-scrollbuttons-button.btnPrev > span.material-icons.chevron_left
      button.paper-icon-button-light.emby-scrollbuttons-button.btnNext > span.material-icons.chevron_right
    div.emby-scroller                                 {padding:0 63.36px; overflow:visible}
      div.itemsContainer.scrollSlider.MuiBox-root.css-0.animatedScrollX
                                                      {transform: matrix(…); will-change: transform  ← INLINE}
        div.card.overflowPortraitCard.card-hoverable.card-withuserdata[data-type="Movie"]   {width:10vw-ish step}
          … same cardBox tree as above …
  … one .verticalSection per genre / suggestion section …
  div.MuiBox-root[style="height: 1px"]                ← IntersectionObserver sentinel (Genres/Upcoming infinite scroll)
```

Upcoming (`#/tv&tab=2`) is the same but `isScrollerMode={false}` and the items container carries
`vertical-wrap padded-left padded-right` instead of `scrollSlider` (`UpcomingView.tsx:69-76`). **[src]**

### C. Modern search — `#/search?query=dark` **[live]**

Rendered by the **legacy** search components even in the modern app.

```
div#searchPage.page.mainAnimatedPage.libraryPage.allLibraryPage.noSecondaryNavPage
  div.padded-left.padded-right.searchFields
    div.searchFieldsInner.flex.align-items-center.justify-content-center      {max-width:60em; margin:0 auto}
      span.searchfields-icon.material-icons.search
      div.inputContainer.flex-grow[style="margin-bottom: 0"]                   ← INLINE style
        label.inputLabel.inputLabelFocused
        input#searchTextInput.emby-input.searchfields-txtSearch[type=text]
  div.searchResults.padded-top.padded-bottom-page
    div.verticalSection.emby-scroller-container
      h2.sectionTitle.sectionTitle-cards.focuscontainer-x.padded-left.padded-right "Filmy"
      div.emby-scrollbuttons.padded-right[is="emby-scrollbuttons"] > button.emby-scrollbuttons-button.hide ×2
      div.padded-top-focusscale.padded-bottom-focusscale.emby-scroller[is="emby-scroller"]
        div.focuscontainer-x.itemsContainer.scrollSlider.animatedScrollX[is="emby-itemscontainer"]
          div.card.overflowPortraitCard.card-hoverable.card-withuserdata[data-type="Movie" data-index="0"]
            div.cardBox.cardBox-bottompadded > div.cardScalable
              div.cardPadder.cardPadder-overflowPortrait.lazy-hidden-children > span.cardImageIcon.material-icons.movie
              canvas.blurhash-canvas.lazy-hidden
              a.cardImageContainer.coveredImage.cardContent.itemAction.lazy.blurhashed.lazy-image-fadein-fast[role="img" data-action="link"]
                div.cardIndicators > div.countIndicator.indicator "3"
              div.cardOverlayContainer.itemAction[data-action="link"]
                button.cardOverlayButton.cardOverlayButton-hover.cardOverlayFab-primary[data-action="resume"]
                div.cardOverlayButton-br.flex > button[is="emby-playstatebutton"] / [is="emby-ratingbutton"] / [data-action="menu"]
              div.cardText.cardTextCentered.cardText-first > bdi > a.itemAction.textActionButton
              div.cardText.cardTextCentered.cardText-secondary > bdi "2008"
    … one .verticalSection per result section (Filmy / Seriale / Osoby / …) …
```

Search **cards are built by the legacy `cardBuilder`** (`SearchResultsRow.tsx:12-17` injects the
scroller as an HTML string, `:29-32` calls `cardBuilder.buildCards`) — so they have
`.cardPadder`, `canvas.blurhash-canvas`, `.lazy`, `.cardIndicators`, `[data-index]` and
`[is="emby-*"]` attributes that the modern React cards on library pages **do not** have.
Any card rule written only against the React markup will miss search results, and vice versa.

Empty query → suggestions **[live]**:

```
div.verticalSection.searchSuggestions[style="text-align: center"]            ← INLINE style
  div > h2.sectionTitle.padded-left.padded-right "Polecane"
  div.searchSuggestionsList.padded-left.padded-right
    div > a.emby-button.button-link[style="display: inline-block; padding: 0.5em 1em"]   ← INLINE style
```

No results **[live]**: `div.noItemsMessage.centerMessage` containing the translated text and,
in a library-scoped search, `div > a.emby-button[href="#/search?query=…"]`
(`SearchResults.tsx:29-43`).

### D. Legacy library page — `#/movies` (legacy-desktop) **[live]**

```
div#moviesPage.page.libraryPage.collectionEditorPage.pageWithAbsoluteTabs.withTabs
  div#moviesTab.pageTabContent.is-active[data-index="0"]
    div.flex.align-items-center.justify-content-center.flex-wrap-wrap.padded-top.padded-left.padded-right.padded-bottom.focuscontainer-x
      div.paging > div.listPaging > span "1-24 z 24"
      button.btnPlayAll.autoSize.paper-icon-button-light  > span.material-icons.play_arrow
      button.btnShuffle.autoSize…                          > span.material-icons.shuffle
      button.btnSelectView.autoSize…                       > span.material-icons.view_comfy
      button.btnSort.autoSize…                             > span.material-icons.sort_by_alpha
      div.btnFilter-wrapper > button.btnFilter.autoSize…   > span.material-icons.filter_alt
    div.alphaPicker.alphaPicker-fixed.alphaPicker-vertical.focusable.alphabetPicker-right.alphaPicker-fixed-right
      div.alphaPickerRow.alphaPickerRow-vertical
        button.alphaPickerButton.alphaPickerButton-vertical "#" … "Z"   (+ .alphaPickerButton-selected)
    div.itemsContainer.padded-left.padded-right.padded-right-withalphapicker.vertical-wrap[is="emby-itemscontainer"]
      div.card.portraitCard.card-hoverable.card-withuserdata[data-type="Movie" data-index="0"]
        … legacy cardBuilder tree (cardPadder / blurhash-canvas / cardOverlayContainer / cardIndicators) …
    div.flex…padded-top.padded-left.padded-right.padded-bottom…  > div.paging > div.listPaging   ← bottom pager
  div#suggestionsTab.pageTabContent[data-index="1"]        (display:none until active)
    div#resumableSection.verticalSection.hide > div.sectionTitleContainer.sectionTitleContainer-cards > h2.sectionTitle.sectionTitle-cards.padded-left
    div#resumableItems.itemsContainer.padded-left.padded-right[is="emby-itemscontainer"]
    div.verticalSection > … > div#recentlyAddedItems.itemsContainer.padded-left.padded-right
    div.recommendations
    div.noItemsMessage.hide.padded-left.padded-right > br + p
  div#favoritesTab.pageTabContent[data-index="2"]   (paging + btnSelectView + .itemsContainer)
  div#collectionsTab.pageTabContent[data-index="3"] (adds button.btnNewCollection; container has
                                                     class "vertical-wrap centered" + style="text-align:center")
  div#genresTab.pageTabContent[data-index="4"] > div#items
```

### E. Legacy `#/list` page (genre "see all", studio/network drill-downs) **[live]**

```
div.page.libraryPage.noSecondaryNavPage.mainAnimatedPage
  div.alphaPicker.alphaPicker-vertical.alphaPicker-fixed.focuscontainer-y.hide
  div.padded-left.padded-right.padded-bottom-page
    div.flex.align-items-center.focuscontainer-x.itemsViewSettingsContainer.padded-top.padded-bottom.flex-wrap-wrap
      div.paging
      button.btnPlay / .btnQueue / .btnShuffle / .btnNewItem  ×2 each (.button-flat.listTextButton-autohide
                                                                      and .paper-icon-button-light.listIconButton-autohide)
      button.btnSort.button-flat.listTextButton-autohide > span.btnSortText + span.material-icons.btnSortIcon.arrow_upward
      button.btnFilter.button-flat.listTextButton-autohide
      button.btnViewSettings.button-flat.listTextButton-autohide > span.material-icons.more_vert
    div.vertical-wrap.itemsContainer[is="emby-itemscontainer"]
    div.flex…focuscontainer-x > div.paging
```

### F. List view (`ViewMode.ListView`) — `.listItem` tree **[live, from `#/details` season]**

Identical component (`components/listview/List/*`) to what `ItemsView` renders when
`libraryViewSettings.ViewMode === ListView` (`ItemsView.tsx:155-160`), inside
`.itemsContainer.padded-left.padded-right.vertical-list`.

```
div.listItem[.listItem-border][.listItem-largeImage][.listItem-withContentWrapper][data-type="Episode" data-action=…]
  div.listItem-content                                        ← only when enableContentWrapper
    div.listItemImage[.listItemImage-large][.itemAction]       {width:4em; or 19.5vw/13vw when -large}
      button.listItemImageButton.itemAction.paper-icon-button-light[data-action="resume"]
        span.material-icons.listItemImageButton-icon.play_arrow
      div.indicators.listItemIndicators                        {position:absolute; right/top .324em}
    div.listItemBody.itemAction
      div.listItemBodyText > bdi "1. Pilot"
      div.secondary.listItemMediaInfo.listItemBodyText
        div.mediaInfoItem / div.starRatingContainer.mediaInfoItem / div.endsAt.mediaInfoItem
      div.secondary.listItem-overview.listItemBodyText > bdi > p
    div.listViewUserDataButtons
      button.listItemButton.itemAction.paper-icon-button-light[data-action="link"|"menu"]
      button.listItemButton.paper-icon-button-light.emby-button[is="emby-playstatebutton"|"emby-ratingbutton"]
  div.listItem-bottomoverview.secondary                        (display:none ≥50em)
```

Group headers: `h2.MuiTypography-h2.listGroupHeader[.listGroupHeader-first]`
(`ListGroupHeaderWrapper.tsx`). **[src]**

### G. Overlays

**Filter popover** `#filter-popover` **[live]** (`FilterButton.tsx:102,197-534`):

```
div#filter-popover.MuiPopover-root.MuiModal-root[role="presentation"]
  div.MuiBackdrop-root.MuiBackdrop-invisible.MuiModal-backdrop
  div.MuiPaper-root.MuiPaper-elevation8.MuiPopover-paper[style="max-height:50%;width:250px"]   ← INLINE style
    div.MuiPaper-root.MuiPaper-elevation0.MuiAccordion-root                     (one per filter group)
      h3.MuiAccordion-heading
        button#filtersStatus-header.MuiAccordionSummary-root                    ← stable ids, see list below
          span.MuiAccordionSummary-content > p.MuiTypography-body1 "Filtry"
          span.MuiAccordionSummary-expandIconWrapper[.Mui-expanded] > svg[data-testid="ArrowForwardIosSharpIcon"]
      div.MuiAccordionDetails-root                                              (mounted only while expanded)
        div.MuiFormGroup-root > label.MuiFormControlLabel-root > span.MuiCheckbox-root  [src]
    button.MuiButton-fullWidth[.Mui-disabled] "Zresetuj filtry" > svg[data-testid="ClearIcon"]
```

Stable accordion header ids (`FilterButton.tsx`): `#filtersStatus-header`,
`#filtersSeriesStatus-header`, `#filtersEpisodesStatus-header`, `#filtersFeatures-header`,
`#filtersVideoTypes-header`, `#filtersGenres-header`, `#filtersOfficialRatings-header`,
`#filtersTags-header`, `#filtersYears-header`, `#filtersStudios-header`,
`#filtersAudioLanguages-header`, `#filtersSubtitleLanguages-header`. Which ones render depends on
`viewType` and on what the server returns.

**Sort popover** `#sort-popover` **[live]** (`SortButton.tsx:178`):
`div#sort-popover.MuiPopover-root > .MuiPopover-paper > ul.MuiList-root[role=menu] >
li.MuiMenuItem-root > div.MuiListItemText-root + div.MuiListItemIcon-root >
svg[data-testid="ArrowUpwardIcon"|"ArrowDownwardIcon"]` (icon only on the active sort).

**View-settings popover** `#selectview-popover` **[live]** (`ViewSettingsButton.tsx:56`):
`ul[role=menu]` with two `li.MuiMenuItem-root` (Grid / List); the active one has
`div.MuiListItemIcon-root > svg[data-testid="CheckIcon"]`, and the Grid row also carries
`button.MuiIconButton-root.MuiIconButton-sizeSmall > svg[data-testid="SettingsIcon"]` which expands a
`MuiCollapse` with `MuiListSubheader` + `MuiSwitch` rows (ShowTitle / ShowYear / CardLayout) and the
image-type list. **[src for the collapsed part]**

**Tab menu** `#library-view-menu` **[live]** (`LibraryViewMenu.tsx:14,53-74`):
`div#library-view-menu.MuiPopover-root.MuiMenu-root > .MuiMenu-paper > ul.MuiMenu-list[role=menu] >
li.MuiMenuItem-root[.Mui-selected]`. It is `keepMounted`, so it is in the DOM (hidden,
`.MuiModal-hidden`) at all times.

**New Collection / New Playlist** open **legacy `formDialog`s**, not MUI
(`NewCollectionButton.tsx:19-35`, `NewPlaylistButton.tsx:19-36`). **[live]**:

```
div.dialogContainer
  div.focuscontainer.dialog.dialog-fixedSize.dialog-small.formDialog.opened
    div.formDialogHeader > button.btnCancel.autoSize.paper-icon-button-light + h3.formDialogHeaderTitle
    div.formDialogContent.smoothScrollY
      div.dialogContentInner.dialog-content-centered
        form.newCollectionForm
          div.fldSelectCollection.hide > div.selectContainer > label.selectLabel + select#selectCollectionToAddTo.emby-select
          div.newCollectionInfo
            div.inputContainer > label.inputLabel.inputLabel-float + input#txtNewCollectionName.emby-input + div.fieldDescription
            label.checkboxContainer.emby-checkbox-label > input#chkEnableInternetMetadata.emby-checkbox + span.checkboxLabel + span.checkboxOutline
          div.formDialogFooter > button.raised.btnSubmit.block.formDialogFooterItem.button-submit.emby-button
```

**Legacy filter dialog** (legacy `.btnFilter`) **[live]** (`components/filterdialog/filterdialog.js:491-502`):

```
div.dialogContainer
  div.focuscontainer.dialog.smoothScrollY.ui-body-a.background-theme-a.formDialog.filterDialog.centeredDialog.opened.dynamicFilterDialog
    div.filterDialogContent
      div.emby-collapse[is="emby-collapse"]           (.seriesStatus / .features / .genreFilters / …)
        button#expandButton.emby-collapsible-button.iconRight.emby-button
          h3.emby-collapsible-title "Filtry" + span.material-icons.emby-collapse-expandIcon.expand_more
        div.collapseContent[.filterOptions][.hide]
          div.checkboxList > label.emby-checkbox-label > input.chkStandardFilter.emby-checkbox + span.checkboxLabel + span.checkboxOutline
```

### H. No-items placeholders **[live]**

* Modern, inside a library grid (e.g. empty Collections tab): the message is a child of the items
  container — `div.itemsContainer.padded-left.padded-right.vertical-wrap > div.noItemsMessage.centerMessage.MuiBox-root >
  h1.MuiTypography-h1 + p.MuiTypography-body1` (`NoItemsMessage.tsx:13-22`).
* Modern, view-level (Upcoming/Genres with nothing at all): `div.noItemsMessage.centerMessage` is a
  direct child of `#tvshowsPage`, with **no** `.itemsContainer` wrapper.
* Search: `div.noItemsMessage.centerMessage` directly under `#searchPage` (no `h1`).
* Legacy: `div.noItemsMessage.hide.padded-left.padded-right > br + p`.

---

## Selector table

| selector | what it is | layout(s) | safe to style? | notes (file:line) |
|---|---|---|---|---|
| `body.libraryDocument` | body flag while a library/search page is mounted | all | yes (anchor only) | **[live]**; also `body.withSectionTabs` in legacy |
| `#moviesPage`, `#tvshowsPage`, `#musicPage`, `#booksPage`, `#boxsetsPage`, `#playlistsPage`, `#liveTvPage`, `#searchPage`, `#homevideos`, `#musicvideos`, `#mixed` | per-collection page roots | modern + legacy | yes | `LibraryPage.tsx:14-28`; `#searchPage` from `search.tsx:26` |
| `.page.libraryPage` | every library page root | all | **careful** | `position:absolute; contain:size style` **[live]**; stock sets `padding-top:7em!important` (`librarybrowser.scss:91`) which modern cancels with `padding-top:0!important` (`AppOverrides.scss:20-24`) |
| `.libraryPage.pageWithAbsoluteTabs.withTabs` | modern tabbed library page | modern | yes | `LibraryPage.tsx:50` |
| `.libraryPage.allLibraryPage.noSecondaryNavPage` | search page | modern + legacy | yes | `search.tsx:28` |
| `header.MuiAppBar-root` | fixed app bar holding both toolbars | modern | yes | `z-index:1100`, `MuiAppBar-colorTransparent` ⇄ `MuiAppBar-colorDefault` on scroll **[live]** |
| `header.MuiAppBar-root + div[aria-hidden="true"]` | JS-sized spacer under the app bar | modern | **no — inline height** | `OffsetAppBar.tsx:76-83`, live `style="height:96px"` |
| `.MuiToolbar-root:has(button[aria-controls="library-view-menu"])` | the library toolbar row | modern | yes | only reliable anchor — both toolbars share `.MuiToolbar-dense.padded-left.padded-right` **[live]** |
| `button[aria-controls="library-view-menu"]` | the "Filmy ▾" tab button | modern | yes | `LibraryViewMenu.tsx:44` **[live]** |
| `button[aria-controls="library-view-menu"] .MuiTypography-h2` | tab label text | modern | yes | `LibraryViewMenu.tsx:48-50` |
| `#library-view-menu` | tab dropdown (keepMounted) | modern | yes | `LibraryViewMenu.tsx:14,56` |
| `#library-view-menu li.Mui-selected` | active tab row | modern | yes | `LibraryViewMenu.tsx:69` |
| `.MuiToolbar-root:has(…) .MuiChip-root` | item-count / "1-24 z 24" chip | modern | yes | `LibraryToolbar.tsx:120` |
| `button:has(svg[data-testid="PlayArrowIcon"])` in the toolbar | Play All | modern | yes | `PlayAllButton` via `LibraryToolbar.tsx:159-169` |
| `button:has(svg[data-testid="ShuffleIcon"])` | Shuffle | modern | yes | `LibraryToolbar.tsx:171-181` |
| `button:has(svg[data-testid="QueueMusicIcon"])` | Queue (audio parents only) | modern | yes | `LibraryToolbar.tsx:183-190` **[src]** |
| `button:has(svg[data-testid="FilterAltIcon"])` | Filter | modern | yes | `FilterButton.tsx:188-196` |
| `.MuiBadge-badge.MuiBadge-dot.MuiBadge-colorInfo` (inside that button) | "filters active" dot | modern | yes | `FilterButton.tsx:193`; `.MuiBadge-invisible` when no filters |
| `button:has(svg[data-testid="SortByAlphaIcon"])` | Sort | modern | yes | `SortButton.tsx` |
| `button:has(svg[data-testid="ViewModuleIcon"])` / `[data-testid="ViewListIcon"]` | View settings (grid vs list icon) | modern | yes | `ViewSettingsButton.tsx:6-7` |
| `button:has(svg[data-testid="NavigateBeforeIcon"])` / `NavigateNextIcon` | pagination prev/next | modern | **don't hide** | `Pagination.tsx:50-64`; `Mui-disabled` at bounds |
| `button:has(svg[data-testid="AddIcon"])` / `[data-testid="PlaylistAddIcon"]` | New Collection / New Playlist | modern | yes | `NewCollectionButton.tsx:42-49`, `NewPlaylistButton.tsx:42-49` |
| `#filter-popover` / `#sort-popover` / `#selectview-popover` | the three toolbar popovers | modern | yes | `FilterButton.tsx:102`, `SortButton.tsx:178`, `ViewSettingsButton.tsx:56` **[live]** |
| `#filter-popover .MuiPopover-paper` | filter panel surface | modern | **inline `max-height:50%;width:250px`** | `FilterButton.tsx:210-217` |
| `#filtersStatus-header` … `#filtersSubtitleLanguages-header` | filter group headers | modern | yes | ids listed above |
| `#filter-popover .MuiAccordionSummary-root` | filter group header row | modern | yes but | styled-component sets `background: rgba(255,255,255,.05)` (`FilterButton.tsx:62-66`) |
| `#filter-popover .MuiAccordionDetails-root` | filter group body | modern | yes but | `borderTop: 1px solid rgba(0,0,0,.125)` (`FilterButton.tsx:77`) — invisible on dark, a theme should override |
| `#filter-popover .MuiAccordion-root` | filter group | modern | yes but | `border: 1px solid theme.palette.divider` (`FilterButton.tsx:48`) |
| `.alphaPicker-fixed-right` | alphabet picker root (both layouts) | modern + legacy | yes | modern: also `.MuiBox-root` with emotion `top/bottom/zIndex` (`AlphabetPicker.tsx:33-50`); legacy: `.alphaPicker.alphaPicker-fixed.alphaPicker-vertical` |
| `.alphaPicker-fixed-right .MuiToggleButtonGroup-vertical` | modern letter strip | modern | yes | `AlphabetPicker.tsx:59-66` |
| `.alphaPicker-fixed-right .MuiToggleButton-root[.Mui-selected]` | one letter / active letter | modern | yes | `AlphabetPicker.tsx:68-87` |
| `.alphaPickerButton` / `.alphaPickerButton-selected` | legacy letter | legacy, tv | yes | `alphaPicker/style.scss:31-46`, themed via `--jf-palette-text-secondary` (`themes/_base/_theme.scss:341-347`) |
| `.itemsContainer` | every item container (grid, row, list) | all | yes | `display:flex` (`card.scss:33`), `margin:0 auto` (`librarybrowser.scss:1197`) |
| `.itemsContainer.vertical-wrap` | wrapping grid | all | yes | `flex-direction:row; flex-wrap:wrap` (`card.scss:43-47`) |
| `.itemsContainer.vertical-list` | list mode | all | yes | `flex-direction:column; flex-wrap:nowrap` (`card.scss:37-41`); set by `ItemsView.tsx:196-201` |
| `.vertical-wrap.centered` | centered grid (legacy collections, login users) | legacy | yes | `card.scss:49-51`; the legacy collections container also has inline `text-align:center` |
| `.itemsContainer.scrollSlider.animatedScrollX` | horizontal row slider | all (desktop) | **do not change `transform`/`will-change`** | JS animates `translateX` (`lib/scroller/index.js:337,772-777`) **[live]** |
| `.padded-left` / `.padded-right` | the 3.3% page gutter | all | yes — **the single knob for Netflix-width gutters** | `librarybrowser.scss:1326-1344`; live 63.36px @1920, 12.87px @390 |
| `.padded-right-withalphapicker` | legacy grid gutter when picker is shown | legacy | yes | `librarybrowser.scss:1364-1372` (7.5%) |
| `.padded-bottom-page` | 5em bottom room for the now-playing bar | all | **`!important` in stock** | `site.scss:119-126` |
| `.emby-scroller` | horizontal row frame | all | yes | `padding-left/right:3.3%` (`emby-scroller.scss:7-10`); live `overflow:visible` |
| `.no-padding` | kills the scroller's left gutter | all | yes | `emby-scroller.scss:30-38` |
| `.verticalSection` | one titled section/row | all | yes | `SectionContainer.tsx:90` |
| `.verticalSection.emby-scroller-container` | section that got scroll buttons | modern desktop | yes (anchor) | class added by JS (`ScrollButtons.tsx:34`), gives `position:relative` **[live]** |
| `.sectionTitleContainer.sectionTitleContainer-cards` | row header wrapper | all | yes | `SectionContainer.tsx:30-34`; `margin:0; padding-top:1.25em` (`librarybrowser.scss:1249-1252`) |
| `.sectionTitle.sectionTitle-cards` | row title (`h2`) | all | yes | `SectionContainer.tsx:45-47` |
| `a.sectionTitleTextButton` | clickable row title → `#/list?…` | modern | yes | `SectionContainer.tsx:39-51`; only when `url` **and** `items.length > 1` |
| `.emby-scrollbuttons`, `.emby-scrollbuttons-button.btnPrev/.btnNext` | row arrows | modern desktop, legacy | yes | `ScrollButtons.tsx:44-58`; legacy variant uses `[is="emby-scrollbuttons"]` and `.hide` |
| `.noItemsMessage.centerMessage` | empty placeholder | all | yes | `NoItemsMessage.tsx:14`, `SearchResults.tsx:31`; `width:30%; padding:5em 0; margin:auto` (`librarybrowser.scss:322-327`) |
| `.searchFields` / `.searchFieldsInner` | search bar row / centered inner | all | yes | `SearchFields.tsx:38-39`; inner `max-width:60em; margin:0 auto` (`searchfields.scss:1-4`) |
| `#searchTextInput.emby-input.searchfields-txtSearch` | the search input | all | yes | `SearchFields.tsx:45-58` |
| `.searchfields-icon` | magnifier glyph | all | yes | `color:#aaa` hard-coded (`librarybrowser.scss:1374-1376`) |
| `.searchResults` | results wrapper | all | yes | `SearchResults.tsx:65` |
| `.searchSuggestions` / `.searchSuggestionsList` | empty-query suggestions | all | **inline styles** | `SearchSuggestions.tsx:22-23,31,36` |
| `.listItem` | one list row | all | yes | `listview.scss:13-35`; `contain: layout style` (`listview.scss:1-6`) |
| `.listItem-border` | row divider | all | yes | `border-color: var(--jf-palette-divider)` (`themes/_base/_theme.scss:364-366`) |
| `.listItem:hover` / `:focus` | row states | all | yes | `--jf-palette-action-hover` / `-focus` (`themes/_base/_theme.scss:368-374`) |
| `.listItemImage`, `.listItemImage-large` | row thumb | all | yes | `4em` / `19.5vw × 13vw` (`listview.scss:141-159`) |
| `.listItemBody`, `.listItemBodyText`, `.secondary` | row text | all | yes | `listview.scss:107-139` |
| `.listItemMediaInfo` | runtime/rating/endsAt strip | all | yes | hidden ≤50em (`listview.scss:216-218`) |
| `.listViewUserDataButtons`, `.listItemButton` | row action buttons | all | yes | `librarybrowser.scss:1208-1211` |
| `.listGroupHeader`, `.listGroupHeader-first` | list group headings | all | yes | `ListGroupHeaderWrapper.tsx` |
| `.card`, `.portraitCard`, `.overflowPortraitCard`, `.backdropCard`, `.squareCard`, `.bannerCard`, `.smallBackdropCard` | grid/row card + shape (= width) | all | **width yes, background/color need `!important`** | `card.scss:10-27` sets `background/background-color/color/font-size/outline` with `!important`; widths `card.scss:507-657` |
| `.card-hoverable` | desktop-only card (enables overlay) | modern/legacy desktop | yes | `useCard.ts:91` |
| `.itemsContainer > .card > .cardBox` | per-card gutter inside a row | all | yes | `margin-right:1.2em` (`emby-scroller.scss:18-28`) |
| `.itemsContainer-tv > .portraitCard` etc. | TV fixed widths | tv | yes | `card.scss:659-670` |
| `.dialogContainer > .dialog.formDialog` | New Collection / New Playlist / legacy filter | all | yes | `collectionEditor.js:234`, `filterdialog.js:491-502` |
| `.filterDialog .emby-collapse`, `.collapseContent`, `.checkboxList` | legacy filter groups | legacy | yes | **[live]** |
| `.itemsViewSettingsContainer` | `#/list` toolbar | modern + legacy (`#/list`) | yes | `list.html:5`, `librarybrowser.scss:1389-1391` |
| `.btnSelectView`, `.btnSort`, `.btnFilter`, `.btnPlayAll`, `.btnShuffle`, `.btnNewCollection`, `.btnViewSettings`, `.btnFilter-wrapper` | legacy toolbar buttons | legacy, `#/list` | yes | `movies.html:5-12`, `list.html:6-45` |
| `.paging`, `.listPaging` | legacy pager text | legacy, `#/list` | yes | `librarybrowser.scss:78-82` |
| `.pageTabContent[data-index]`, `.pageTabContent.is-active` | legacy tab panes | legacy | **don't override `display`** | `librarybrowser.scss:126-128` `:not(.is-active){display:none!important}` |
| `.listTextButton-autohide` / `.listIconButton-autohide` | 40em swap pair | `#/list` | **don't unhide both** | `librarybrowser.scss:1393-1403` |

---

## Existing styling that will fight a custom theme

1. **`!important` in stock CSS you must out-`!important`:**
   * `.page`, `.padded-bottom-page`, `.content-primary`, `.pageWithAbsoluteTabs .pageTabContent` →
     `padding-bottom: 5em !important` twice (`site.scss:119-126`). Live: 74.4px.
   * `.libraryPage { padding-top: 7em !important }` and
     `.libraryPage:not(.noSecondaryNavPage) { padding-top: 7.5em !important }`
     (`librarybrowser.scss:91-93,111-113`, plus a 4.6em/6.7em pair ≥100em at `:400-407`) —
     in modern these are neutralised by `.libraryPage:not(.itemDetailPage){padding-top:0!important}`
     (`AppOverrides.scss:20-24`), but they are still live for legacy and for `#searchPage`.
   * `.card { background:none!important; background-color:transparent!important; color:inherit!important;
     font-size:inherit!important; font-family:inherit!important; outline:none!important }` (`card.scss:10-27`).
   * `.pageTabContent:not(.is-active){display:none!important}` (`librarybrowser.scss:126-128`).
   * `.alphaPickerButton { border:0!important; outline:none!important }` and the
     `padding-top/bottom: 0|1px !important` height-media-query ladder (`alphaPicker/style.scss:31-46,48-80`).
   * `.alphaPicker-fixed { display:none!important }` under `max-height:31.25em`
     (`alphaPicker/style.scss:134-138`).
   * `.listIconButton-autohide` / `.listTextButton-autohide` `display:none!important`
     (`librarybrowser.scss:1393-1403`).
   * `.listItemBody-noleftpadding{padding-left:0!important}`, `.listItemIcon{width/height:1em!important}`,
     `.listItem-bottomoverview{display:none!important}` ≥50em (`listview.scss:121-123,234-245,306-323`).
   * `.sectionTitleButton,.sectionTitleIconButton{margin-right:0!important}` (`librarybrowser.scss:1231-1236`).

2. **Inline styles (unbeatable without `!important`):**
   * AppBar spacer `style="height:96px;width:100%;flex-shrink:0"` — recomputed by a ResizeObserver
     (`OffsetAppBar.tsx:76-83`). If a theme changes the toolbar height the spacer follows; if a theme
     makes the AppBar non-fixed or overlaid, the spacer becomes dead space.
   * `#filter-popover .MuiPopover-paper` `style="max-height:50%;width:250px"` (`FilterButton.tsx:210-217`).
   * `.itemsContainer.scrollSlider.animatedScrollX` gets `will-change:transform` +
     `transition:transform …ms ease-out` inline and an animated `transform:translateX(-Npx)`
     (`lib/scroller/index.js:337,772-777`). **[live]** confirmed `transform: matrix(1,0,0,1,0,0)`.
   * `.searchFields .inputContainer` `style="margin-bottom:0"` (`SearchFields.tsx:41-44`).
   * `.searchSuggestions` `style="text-align:center"` and each suggestion link
     `style="display:inline-block;padding:.5em 1em"` (`SearchSuggestions.tsx:22-23,36`).
   * Legacy collections container `style="text-align:center"` (`movies/movies.html:72`).
   * Infinite-scroll sentinels: `Box sx={{height:'1px'}}` (`GenresItemsContainer.tsx:80`,
     `UpcomingView.tsx:93`) — emotion class, effectively a bare 1px `div`.

3. **`contain` / `overflow` / `transform` ancestors that clip or trap children:**
   * `.page` → `contain: size style` **[live]**. The page box does not grow with its content
     (live: page 984px tall, content 1134px). Anything positioned against the page, or any
     `height:100%` child, will be wrong.
   * `.card:not(.show-animation)` → `contain: layout style paint` (`card.scss:29-31`), live
     `contain: content`. **A hover effect that paints outside the card box is clipped.** This is the
     single biggest blocker for a Netflix "card grows over its neighbours" hover.
   * `.listItem`, `.listItemBody`, `.listItemMediaInfo`, `.listItemButton` → `contain: layout style`
     (`listview.scss:1-6,87-93`).
   * `.cardPadder-*` → `contain: strict` (`card.scss:57-63,…`).
   * `body` → `overflow: hidden auto` **[live]** — this is what actually clips the horizontally
     translated rows, because `.emby-scroller` itself is `overflow: visible` **[live]**.
   * `.scrollSlider.animatedScrollX` has a non-none `transform`, so it is a containing block for
     `position:fixed` descendants and a stacking context.
   * Modern layout root `div.MuiBox-root` is `display:flex; flex-direction:column; height:100%`
     (`AppLayout.tsx:36-43`); `main` is `position:relative; flex-grow:1`.

4. **Hashed emotion classes — never target these:** `css-sjv9i2`, `css-1u7mpsp` (AppBar),
   `css-1tmqktv` / `css-133e01t` (the two toolbars), `css-174l32b` (button stack), `css-1so75cn`
   (count chip), `css-11cf6b` (alphabet picker box), `css-12vt1e4` (its Paper), `css-eee7z4`
   (letters), `css-1v2vhpl` (popover paper), `css-mbeig7` (menu item), `css-0` (empty).
   They change on every build. Use the `MuiXxx-*` classes, the stable `#…-popover` / `#…-header` ids,
   `data-testid` on the icons, and `:has()`.

5. **Specificity notes.** Custom CSS is the last `<style>` in `<body>`, so at **equal** specificity it
   beats both `<head>` emotion rules and the theme stylesheet. But emotion `sx` rules are single-class
   (0,1,0) and often inside media queries — to override `AlphabetPicker`'s `top`/`bottom`/`zIndex`
   use `.MuiBox-root.alphaPicker-fixed-right` (0,2,0) or repeat the media query.

6. **Things that must keep working.**
   * **Pagination**: `Pagination.tsx:33,41` calls `window.scrollTo(0,0)` on page change; the prev/next
     buttons are `Mui-disabled` at bounds. Do not `display:none` them, do not remove the count chip
     (it is the only "1-24 z 24" indicator in modern).
   * **Infinite scroll** (Genres, Upcoming): the 1px sentinel `div` must stay in flow and reachable —
     a blanket `#moviesPage > div:last-child{display:none}` or a `height` override kills paging.
   * **No virtualisation** in 12.1: the whole page of items is in the DOM (page size =
     `userSettings.libraryPageSize`, default 100). Heavy per-card `filter`/`backdrop-filter`/
     `box-shadow` costs multiply by that count.
   * **Scroller measurement**: `Scroller.tsx:89-118` subtracts the computed `padding-left/right` of
     both `.emby-scroller` and `.scrollSlider` to size the scroll frame, and
     `ScrollButtons` only mounts when `scrollWidth > scrollSize + 20`. Changing those paddings
     changes arrow visibility and scroll distance; changing `.card` width changes `scrollBy: 200`
     alignment (it is a fixed 200px step, `Scroller.tsx:172`).
   * `ItemsContainer` attaches multi-select, drag-reorder (playlists) and context-menu handlers to the
     container; `sortablejs` writes inline transforms on cards while dragging.

7. **Stacking order (live):** AppBar `z-index:1100` → alphabet picker `1099`
   (`AlphabetPicker.tsx:49`, `theme.zIndex.appBar - 1`) → `.absolutePageTabContent` `z-index:1`
   (legacy) → MUI modals/popovers above everything (`.MuiModal-root` default 1300).

---

## Theming hooks

**`--jf-*` variables actually consumed in this area** (live values on `data-theme="dark"` **[live]**):

| variable | live value | used by |
|---|---|---|
| `--jf-palette-background-default` | `#101010` | `html`, page backgrounds |
| `--jf-palette-background-paper` | `#202020` | alphabet-picker Paper, popover papers, `.paperList` |
| `--jf-palette-text-primary` | `#fff` | `.alphaPickerButton-selected` |
| `--jf-palette-text-secondary` | `rgba(255,255,255,.7)` | `.cardText-secondary`, `.listItem .secondary`, `.alphaPickerButton`, `.fieldDescription` (`themes/_base/_theme.scss:254-262,341-343`) |
| `--jf-palette-primary-main` | `#00a4dc` | selected toggle/menu items, progress rings |
| `--jf-palette-action-hover` | `rgba(255,255,255,.08)` | `.listItem:hover` (`_theme.scss:372-374`) |
| `--jf-palette-action-focus` | — | `.listItem:focus` (`_theme.scss:368-370`) |
| `--jf-palette-divider` | `rgba(255,255,255,.12)` | `.listItem-border`, filter `Accordion` border, `.actionsheetDivider` |
| `--jf-card-borderRadius` | `0.2em` | `.cardPadder`, `.cardContent`, `.cardImageContainer`, `.blurhash-canvas`, `.cardOverlayContainer`, `.visualCardBox` (`_theme.scss:228-240`) |
| `--jf-palette-AppBar-defaultBg` | `#202020` | scrolled app bar |
| `--jf-palette-AppBar-transparentBg` | `rgba(0,0,0,.4)` | unscrolled app bar |
| `--jf-palette-AppBar-gradient` | `none` | app-bar background-image |

Redefining `--jf-card-borderRadius` on `:root` is the cheapest way to restyle every card corner in
both the React and legacy card trees at once.

**Classes/attributes toggled by JS (use as state selectors):**

| toggle | meaning |
|---|---|
| `html.layout-desktop` / `.layout-mobile` / `.layout-tv` | layout manager |
| `html[data-theme="dark"|"light"|…]` | active built-in theme |
| `body.libraryDocument`, `body.withSectionTabs` | a library page is mounted / legacy tabs present |
| `header.MuiAppBar-root.MuiAppBar-colorTransparent` ⇄ `.MuiAppBar-colorDefault` + `.MuiPaper-elevation0` ⇄ `.MuiPaper-elevation1` | **scroll position** (`OffsetAppBar.tsx:30-33,70-74`) — the Netflix "transparent header that solidifies on scroll" hook, already wired |
| `.verticalSection.emby-scroller-container` | this row got scroll arrows (`ScrollButtons.tsx:34`) |
| `.itemsContainer.animatedScrollX` | JS-transform scrolling is active on this row |
| `.card.card-hoverable` | desktop card with hover overlay |
| `.MuiBadge-badge:not(.MuiBadge-invisible)` inside the filter button | filters are active |
| `.MuiMenuItem-root.Mui-selected` in `#library-view-menu` | current tab |
| `.MuiToggleButton-root.Mui-selected` in the alphabet picker | active letter |
| `.MuiButton-root.Mui-disabled` in the pagination group | first/last page |
| `.pageTabContent.is-active` (legacy) | visible tab |
| `.alphaPickerButton-selected` (legacy) | active letter |
| `.lazy-hidden` / `.blurhashed` / `.lazy-image-fadein-fast` (legacy cards, incl. search) | image load state |

**Useful `:has()` / `:not()` anchors (`:has()` verified working live):**

```css
/* the library toolbar row, distinct from the app-nav toolbar */
.MuiToolbar-root:has(button[aria-controls="library-view-menu"]) { }

/* grid pages only (not the section-row tabs) */
.libraryPage:has(> .padded-bottom-page > .itemsContainer.vertical-wrap) { }

/* list mode only */
.itemsContainer.vertical-list > .MuiBox-root > .listItem { }

/* a row that is actually scrollable (arrows mounted) */
.verticalSection.emby-scroller-container .emby-scroller { }

/* rows whose title links somewhere */
.sectionTitleContainer:has(a.sectionTitleTextButton) { }

/* empty state, without touching populated grids */
.itemsContainer:has(> .noItemsMessage) { }

/* modern React cards vs legacy cardBuilder cards (search results, #/list, legacy layout) */
.card:has(> .cardBox > .cardScalable > .cardContent > .cardImageContainer) { }  /* React */
.card:has(canvas.blurhash-canvas) { }                                          /* legacy */

/* exclude the search page from library-grid rules */
.libraryPage:not(.allLibraryPage) { }
```

**Layout knobs with the widest blast radius (in order):**
1. `.padded-left` / `.padded-right` — the 3.3% gutter shared by the toolbar, grids, rows, section
   titles and the search bar. Changing it re-aligns everything at once.
2. `.portraitCard` / `.backdropCard` / `.squareCard` width media-query ladder — cards per row.
3. `.itemsContainer.vertical-wrap` — can be switched to CSS grid
   (`display:grid; grid-template-columns:repeat(auto-fill,minmax(…,1fr))`) since nothing in JS reads
   the flex layout; card `width:%` then becomes harmless, but keep `.card{min-width:0}`.
4. `--jf-card-borderRadius`.
5. `.emby-scroller` padding (must stay in sync with expectations in `Scroller.tsx:89-118`).

---

## Netflix-relevance notes

| Netflix UI element | Jellyfin 12.1 counterpart | verdict in pure CSS |
|---|---|---|
| Top bar: transparent over the hero, solid dark on scroll | `header.MuiAppBar-root` already swaps `MuiAppBar-colorTransparent` ⇄ `MuiAppBar-colorDefault` and elevation 0⇄1 on scroll | **free** — restyle both states + `--jf-palette-AppBar-transparentBg` / `-defaultBg` / `-gradient` |
| Category rows ("Trending Now", "Because you watched X") | `.verticalSection` + `.sectionTitleContainer-cards h2.sectionTitle` + `.emby-scroller > .itemsContainer.scrollSlider` — exactly the Genres and Suggestions tabs | **yes** — this is already a Netflix row; restyle title (uppercase-ish weight, hover chevron reveal) and card spacing |
| Row arrows on hover (large translucent chevrons on the row edges) | `.emby-scrollbuttons.padded-right > .btnPrev/.btnNext`, `position:absolute` inside `.verticalSection.emby-scroller-container` | **yes** — reposition to the row's vertical centre and reveal on `.verticalSection:hover`. Note they mount only on desktop with a fine pointer, and only when the row overflows |
| Card hover: scale up, lift above neighbours, show a detail flyout | `.card-hoverable` + `.cardOverlayContainer` / `.cardOverlayButton-*` | **partly impossible.** `.card` is `contain: layout style paint`, so anything painted outside the card box is clipped. A theme must first do `.card{contain:none !important}` (and accept the paint cost with ~100 cards), then `transform: scale()` on `.cardScalable`/`.cardBox` plus `z-index` on the card. Even then the row's `.scrollSlider` transform makes the card a child of an animated layer, and `body{overflow-x:hidden}` clips growth past the viewport edge. Cards growing *sideways out of the row* cannot be done reliably without JS |
| Sliding/peeking rows with partial next card | `.overflowPortraitCard` widths are `vw`-based (`card.scss:679-712`) and the scroller steps a fixed 200px | **partly** — widths are themeable, but the 200px `scrollBy` is JS (`Scroller.tsx:172`) so the "snap to one card" feel is not reachable |
| Big library grid ("Movies" page) | `.itemsContainer.padded-left.padded-right.vertical-wrap` + `.card.portraitCard` | **yes** — switch to CSS grid, drop the title/year block or restyle `.cardText-first`/`.cardText-secondary` into an overlay |
| Netflix's title-on-image overlay instead of a caption under the poster | `.cardText.cardTextCentered.cardText-first` / `.cardText-secondary` live **outside** `.cardScalable`, as siblings inside `.cardBox` | **yes with effort** — `position:absolute` them over `.cardScalable` requires `.cardBox{position:relative}` and defeating `.cardBox-bottompadded`; or hide them and use `.cardImageContainer[aria-label]` (the title is in `aria-label` on the modern `<a>` **[live]**) with `content: attr(aria-label)` on a `::after` |
| Netflix filter/sort bar ("Genres ▾", "Suggested for you ▾") | `button[aria-controls="library-view-menu"]` + the filter/sort/view `MuiButtonGroup`s | **yes** — restyle to pill/ghost buttons; the popovers (`#filter-popover`, `#sort-popover`, `#selectview-popover`) are plain MUI and fully themeable except the inline `width:250px` on the filter paper |
| Netflix search: instant grid of results | Jellyfin shows **horizontal rows per type** (`.searchResults > .verticalSection`) | **yes** — `.searchResults .emby-scroller{overflow:visible}` is already true; force the slider to wrap with `.searchResults .itemsContainer.scrollSlider{flex-wrap:wrap; transform:none !important}` — but this fights the JS scroller, which will keep writing `transform` inline; `!important` wins visually, the arrows must then be hidden |
| Netflix search bar (thin, right-aligned, expanding) | `.searchFields` is a centred 60em block with a boxed `emby-input` | **yes** — restyle `.searchFieldsInner{max-width:…}` and the input; the magnifier is a separate `span.searchfields-icon` with a hard-coded `#aaa` |
| Netflix "My List" / row of collections | Collections tab = ordinary `ItemsView` grid of `BoxSet` cards; New Collection opens a **legacy `formDialog`** | **yes** for the grid; the dialog needs separate `.dialogContainer > .dialog.formDialog` styling (it is not MUI) |
| A–Z jump rail | `.alphaPicker-fixed-right` — Netflix has no equivalent | consider hiding it (`display:none`) for a Netflix look; it is `position:fixed` and already self-hides under 465px height |
| Netflix's per-row "see all" page | `a.sectionTitleTextButton` → `#/list?genreId=…`, which is the **legacy** `list.html` page with `.itemsViewSettingsContainer` chrome that looks nothing like the modern toolbar | must be themed separately, or the theme will have one obviously unstyled page |
| Netflix hero/billboard at the top of a category page | **does not exist** on library pages — the modern library page starts straight with the toolbar and grid. A CSS-only theme cannot synthesise a billboard (no backdrop element, no synopsis markup, and `.page` is `contain: size style`) | **impossible in pure CSS** |
| Netflix per-card progress bar / "Top 10" badges | Progress exists only as legacy card indicators (`.cardIndicators`, `.playedIndicator`, `.countIndicator`) and `.listItemProgressBar`; the modern React grid card renders `div.indicators` (often empty) | ranking badges **impossible**; progress restyling possible where the element exists |

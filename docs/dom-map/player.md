# Video player OSD, now-playing bar, up-next, media segments, subtitles

Jellyfin 12.1 (`_ref/jellyfin-web` @ v12.1). All source paths below are relative to `_ref/jellyfin-web/`.
Live-verified on the docker test server (`jellyflix-test`) — see "Verified live" at the end.

**One-line summary for a themer:** the whole video OSD is *legacy* markup (plain HTML + `classList` toggles),
identical in Modern and Legacy layout, and it uses **zero `--jf-*` variables** except for icon-button
hover/active/focus colours. Everything else is hard-coded (`rgba(16,16,16,.75)`, `#fff`, `#00a4dc`, `#282828`,
`#303030`). That makes it the easiest subsystem in the app to re-skin — there are no hashed emotion classes to
fight except on the **Modern top bar**, which is React/MUI.

---

## Where it appears (routes, layouts, breakpoints)

| Thing | Route / trigger | Layouts |
|---|---|---|
| `#videoOsdPage` (video OSD) | `#/video` — reached by playing any video; the harness route `player` | desktop, mobile, tv — **same markup in Modern and Legacy** |
| OSD top bar | part of the video page | Legacy + TV: the real `.skinHeader`. Modern: a separate MUI `Box` (see gotchas) |
| `.videoPlayerContainer` > `video.htmlvideoplayer` | created on playback start, `document.body.insertBefore(..., body.firstChild)` (`src/plugins/htmlVideoPlayer/plugin.js:1853`) | all |
| `.upNextContainer` / `.upNextDialog` | last ~N s of an Episode when `enableNextVideoInfoOverlay()` and a next item exists (`.../video/index.js:688` `showComingUpNext`) | all (TV auto-focuses `.btnStartNow`, `upnextdialog.js:241-243`) |
| `.skip-button-container` > `.skip-button` | media segment of type Intro/Outro/… whose user action is `AskToSkip`; injected into `document.body` (`src/components/playback/skipsegment.ts:56`) | all |
| Still-Watching prompt | `PreplayInterceptPlugin`, before the *next* episode starts (`src/plugins/stillWatching/plugin.ts:63`) — a generic `confirm()` **formDialog**, not player markup | all |
| `.nowPlayingBar` | audio playback, or remote-controlled playback. **Never** for local video and **never** on TV (`nowPlayingBar.js:644,649`) | desktop, mobile |
| `#nowPlayingPage` (remote control / queue) | `#/queue` | all |
| `.playerStats` | OSD settings ⚙ → "PlaybackData"; appended to `document.body` (`playerstats.js:45`) | all (`playerStats-tv` variant on TV) |
| `.videoSubtitles*` | only when `useCustomSubtitles()` is on and the track is text-based (`plugin.js:1560`) | all |
| `.subtitleSync` | OSD settings ⚙ → "SubtitleOffset" | all |

**Breakpoints that hide OSD parts** (`src/styles/videoosd.scss:202-234`, all `display:none !important`):

| max-width | hidden |
|---|---|
| `30em` | `.btnUserRating`, `.osdMediaInfo`, `.osdPoster` |
| `33.75em` | (not hiding — removes `margin` from `.videoOsdBottom .paper-icon-button-light`) |
| `43em` | `.videoOsdBottom .volumeButtons`, `.osdMediaStatus span` |
| `50em` | `.videoOsdBottom .btnFastForward`, `.videoOsdBottom .btnRewind` |
| `75em` | `.videoOsdBottom .endsAtText` |

Live on `modern-mobile` (390px) this leaves exactly: ⏸ · ⚙ · PiP · ⛶ plus the scrubber row.

---

## DOM skeleton (real markup, trimmed)

### Body-level stack during playback (identical in Modern and Legacy)

```
body.libraryDocument.hide-scroll                 (html.layout-desktop.transparentDocument, data-theme="dark")
  div.videoPlayerContainer                        position:fixed; inset:0; background:#000 !important; FIRST child of body
    video.htmlvideoplayer[poster=<backdrop>]      width/height 100%
    div.videoSubtitles                            ← only with custom-element subtitles
      div.videoSecondarySubtitlesInner            ← only when 2nd subtitle + verticalPosition < 0
      div.videoSubtitlesInner
    canvas / .libassjs-canvas-parent              ← only for ASS/SSA (libass-wasm), order:-1
  div#reactRoot
    div.backdropContainer.hide
    div.backgroundContainer.backgroundContainer-transparent
    div                                           ← LEGACY shell; display:none in Modern, visible in Legacy/TV
      div.mainDrawer.transition.touch-menu-la
      div.skinHeader.focuscontainer-x.skinHeader-withBackground.skinHeader-blurred.osdHeader
      div.mainDrawerHandle
    ── MODERN ONLY ──
    div.MuiBox-root.css-XXXXX
      header.MuiAppBar-root.MuiAppBar-colorTransparent.mui-fixed.css-XXXXX   (0px tall on this route)
      main.MuiBox-root.css-XXXXX
        div.skinHeader.skinHeader-withBackground.skinHeader-blurred.osdHeader.MuiBox-root.css-XXXXX
          style="opacity: 1"                      ← MUI <Fade>, see gotchas
          div.MuiToolbar-root.MuiToolbar-dense.videoOsd-appBar.css-XXXXX
            button.MuiIconButton-root  > svg[data-testid="ArrowBackIcon"]
            p.MuiTypography-root                  ← the title
            div.MuiBox-root                       ← SyncPlay + Cast buttons
        div#videoOsdPage…
    ── LEGACY/TV ONLY ──
    div.mainAnimatedPages.skinBody
      div#videoOsdPage…
  div.docspinner.mdl-spinner                      z-index:9999999
  div.appfooter                                   z-index:1201; hosts .nowPlayingBar
  div.tmla-mask.hide                              z-index:1098
  div.dialogContainer > div.dialog.opened         z-index:999999 !important  (actionSheet / confirm)
  div > div.subtitleSync > div.subtitleSyncContainer.hide
  div.playerStats.hide                            appended to body on first use
  div.skip-button-container > button.skip-button  appended to body on first media-segment prompt
```

### `#videoOsdPage` (source: `src/apps/legacy/controllers/playback/video/index.html`)

```
div#videoOsdPage.page.libraryPage.mainAnimatedPage [data-role=page data-type=video-osd data-backbutton=true]
  div.syncPlayContainer                           absolute inset:0, pointer-events:none
    div#syncPlayIcon.syncPlayIconCircle           visibility toggled inline by JS
      span.primary-icon.material-icons.<name>
      span.secondary-icon.material-icons.<name>
  div.upNextContainer.hide                        ← UpNextDialog renders into this
  div.videoOsdBottom.videoOsdBottom-maincontrols  position:fixed bottom; pointer-events:NONE
    div.osdControls                               pointer-events:all; flex-grow:1; padding:0 .8em
      div.osdTextContainer.osdMainTextContainer
        h3.osdTitle                               ← always EMPTY in 12.1 (title lives in the top bar)
        div.osdMediaStatus.hide
          span.material-icons.animate.autorenew   spin-clockwise 4s infinite
          span                                    "Fetching data"
      div.osdTextContainer.osdSecondaryMediaInfo[.hide]
      div.flex.flex-direction-row.align-items-center [dir=ltr]
        div.osdTextContainer.startTimeText.osdPositionText   style="margin:0 .25em 0 0"   e.g. "0:00"
        div.sliderContainer.flex-grow.mdl-slider-container   style="margin:.5em 0 .25em"
          div.sliderMarkerContainer               ← chapter ticks, JS-filled
            span.sliderMarker.watched|.unwatched  style="left:calc(N% - Wpx)"
          input.osdPositionSlider.mdl-slider.mdl-js-slider[.mdl-slider-hoverthumb]
                [is=emby-slider type=range data-slider-keep-progress=true data-embyslider=true]
          div.mdl-slider-background-flex-container
            div.mdl-slider-background-flex         the grey track (rgba(255,255,255,.3), height .2em)
              div.mdl-slider-background-flex-inner
                div.mdl-slider-background-upper    style="left:0%; width:100%"   ← buffered range
                div.mdl-slider-background-lower    style="width:4.84%"           ← played, #00a4dc
          div.sliderBubbleTrack
            div.sliderBubble[.hide]                style="left:895.42px"         ← scrub tooltip
              h1.sliderBubbleText                  plain time, OR ↓
              div.chapterThumbContainer[.chapterBubblePosition]
                div.chapterThumbWrapper            style="overflow:hidden;width:Npx;height:Npx;
                                                          background-image:url(trickplay);
                                                          background-position-x/-y:-Npx"   (trickplay)
                img.chapterThumb                   (chapter images, non-trickplay)
                div.chapterThumbTextContainer[.chapterBubblePosition]
                  div.chapterThumbText.chapterThumbText-dim   chapter name
                  h2.chapterThumbText                          timestamp
        div.osdTextContainer.endTimeText.osdDurationText      style="margin:0 0 0 .25em"   e.g. "-0:19"
      div.buttons.focuscontainer-x
        div [dir=ltr]                              ← transport cluster (left)
          button.btnRecord.autoSize.hide.paper-icon-button-light  > span.xlargePaperIconButton.material-icons.fiber_manual_record
          button.btnPreviousTrack.autoSize.hide…   > …skip_previous
          button.btnPreviousChapter.autoSize.hide… > …undo
          button.btnRewind…                        > …fast_rewind
          button.btnPause.autoSize…                > span.xlargePaperIconButton.material-icons.pause|play_arrow
          button.btnFastForward…                   > …fast_forward
          button.btnNextChapter.autoSize.hide…     > …redo
          button.btnNextTrack.autoSize.hide…       > …skip_next
        div.osdTimeText                            margin-left:1em; margin-right:auto  ← the flex spacer
          span.endsAtText                          "Ends at 22:03"
        button.btnUserRating.autoSize.paper-icon-button-light [is=emby-ratingbutton]  > …favorite
        button.btnSubtitles.hide.autoSize…         > …closed_caption
        button.btnAudio.hide.autoSize…             > …audiotrack
        div.volumeButtons.hide-mouse-idle-tv
          button.buttonMute.autoSize…              > …volume_up|volume_off
          div.sliderContainer.osdVolumeSliderContainer.mdl-slider-container
            input.osdVolumeSlider.mdl-slider…      (same internals as above)
        button.btnVideoOsdSettings.autoSize…       > span.largePaperIconButton.material-icons.settings
        button.btnAirPlay.hide.autoSize…           > …airplay
        button.btnPip.autoSize…                    > …picture_in_picture_alt
        button.btnFullscreen.autoSize…             > …fullscreen|fullscreen_exit
```

### `.upNextDialog` (`src/components/upnextdialog/upnextdialog.js:17-45`)

```
div.upNextContainer.upNextDialog[.hide][.upNextDialog-hidden]     ← the SAME element, classes added by init()
  div.flex.flex-direction-column.flex-grow
    h2.upNextDialog-nextVideoText  style="margin:.25em 0"   > span.upNextDialog-countdownText
    h3.upNextDialog-title          style="margin:.25em 0 .5em"
    div.flex.flex-direction-row.upNextDialog-mediainfo      ← mediaInfo.getPrimaryMediaInfoHtml()
    div.flex.flex-direction-row.upNextDialog-buttons  style="margin-top:1em"
      button.raised.raised-mini.btnStartNow.upNextDialog-button [is=emby-button]
      button.raised.raised-mini.btnHide.upNextDialog-button    [is=emby-button]
```

### Media-segment skip button (`src/components/playback/skipsegment.ts:54`)

```
div.skip-button-container                         position:fixed; bottom:8rem; z-index:10000; pointer-events:none
  button.skip-button[.hide][.skip-button-hidden][.no-transition] [is=emby-button]
    "Skip Intro" + span.material-icons.skip_next
```

### `.nowPlayingBar` (audio / remote only — `src/components/nowPlayingBar/nowPlayingBar.js:51-116`)

```
div.appfooter                                     position:fixed; bottom:0; z-index:1201 !important
  div.nowPlayingBar[.hide][.nowPlayingBar-hidden][.noMediaProgress]
    div.nowPlayingBarTop
      div.nowPlayingBarPositionContainer.sliderContainer.mdl-slider-container [dir=ltr]   position:absolute !important; top:-0.56em
        input.slider-medium-thumb.nowPlayingBarPositionSlider [is=emby-slider pin]
      div.nowPlayingBarInfoContainer               width:40%
        div.nowPlayingImage                        background-image set via imageLoader; display toggled inline
        div.nowPlayingBarText
          div > a                                  line 1
          div.nowPlayingBarSecondaryText > a       line 2
      div.nowPlayingBarCenter [dir=ltr]            position:absolute; z-index:2
        button.previousTrackButton.mediaButton
        button.playPauseButton.mediaButton
        button.stopButton.mediaButton
        button.nextTrackButton.mediaButton         ← desktop/tv position
        div.nowPlayingBarCurrentTime
      div.nowPlayingBarRight                       z-index:2
        button.muteButton.mediaButton
        div.sliderContainer.nowPlayingBarVolumeSliderContainer.hide  style="width:9em;vertical-align:middle;display:inline-flex"
          input.slider-medium-thumb.nowPlayingBarVolumeSlider
        button.btnAirPlay.mediaButton
        button.openLyricsButton.mediaButton.hide
        button.toggleRepeatButton.mediaButton
        button.btnShuffleQueue.mediaButton
        div.nowPlayingBarUserDataButtons
        button.playPauseButton.mediaButton         ← second copy; hidden on desktop/tv by CSS
        button.nextTrackButton.mediaButton         ← mobile position
        button.btnToggleContextMenu.mediaButton    ← desktop/tv only
```

### `.playerStats` (`src/components/playerstats/playerstats.js:19-45`)

```
div.playerStats[.playerStats-tv][.hide]           position:absolute; top:5em; left:1.5em; background:rgba(28,28,28,.8)
  div.playerStats-content[.playerStats-content-tv]
    button.playerStats-closeButton                (omitted on TV)
    div.playerStats-stats
      div.playerStats-stat[.playerStats-stat-header]
        div.playerStats-stat-label
        div.playerStats-stat-value
```

### `#nowPlayingPage` — remote control (`src/apps/legacy/controllers/playback/queue/index.html`)

```
div#nowPlayingPage.page.libraryPage.nowPlayingPage.noSecondaryNavPage.selfBackdropPage
  div.remoteControlContent.padded-left.padded-right
    div.nowPlayingInfoContainer
      div.nowPlayingPageImageContainer[.nowPlayingPageImageContainerNoAlbum] > .nowPlayingPageImage
      div.nowPlayingInfoControls
        div.infoContainer.flex
          div.nowPlayingInfoContainerMedia
            h2.nowPlayingPageTitle
            div.nowPlayingSongName.nowPlayingEpisode   style="font-weight:bold"
            div.nowPlayingAlbum.nowPlayingSeason
            div.nowPlayingArtist.nowPlayingSerie
          div.nowPlayingPageUserDataButtonsTitle
        div.sliderContainer.flex [dir=ltr]
          div.positionTime / div.nowPlayingPositionSliderContainer > input.nowPlayingPositionSlider / div.runtime
        div.nowPlayingButtonsContainer.focuscontainer-x.justify-content-space-between
          div.nowPlayingInfoButtons  [btnRepeat, btnRewind/btnNowPlayingRewind, btnPreviousTrack,
                                      btnPlayPause, btnStop, btnNextTrack, btnFastForward, btnShuffleQueue]
          div.nowPlayingSecondaryButtons [btnAudioTracks, btnSubtitles, .nowPlayingPageUserDataButtons,
                                      btnToggleFullscreen, btnLyrics, btnShuffleQueue, btnRepeat]
    div.remoteControlSection > .navigationSection (btnArrowUp/Left/Ok/Right/Down) …
    div.playlistSection / .nowPlayingPlaylist / .contextMenuList
```

---

## Selector table

`safe?` = safe to restyle from Custom CSS. ✅ yes · ⚠️ works but fights an inline style / JS-set value · ❌ hashed or volatile.

| selector | what it is | layout(s) | safe to style? | notes (file:line) |
|---|---|---|---|---|
| `#videoOsdPage` | the OSD page root | all | ✅ | gets `padding-top:7.5em !important` from `.libraryPage:not(.noSecondaryNavPage)` (`styles/librarybrowser.scss:111`) and `padding-bottom:5em !important` from `.page` (`styles/site.scss:120-125`); `contain: style size !important` via `.mainAnimatedPage` (`styles/site.scss:88`) |
| `#videoOsdPage[data-type="video-osd"]` | stable attribute anchor | all | ✅ | set by `ViewManagerPage type='video-osd'` (`apps/modern/routes/video/index.tsx:83`) — better than `#videoOsdPage` if you want to scope without ids |
| `.videoOsdBottom` | bottom control shelf | all | ✅ | `position:fixed; padding-top:7.5em; padding-bottom:1.75em; background:linear-gradient(0deg,rgba(16,16,16,.75),rgba(16,16,16,0)); pointer-events:none; transition:opacity .3s` (`styles/videoosd.scss:15-35`) |
| `.videoOsdBottom-maincontrols` | second class on the same node | all | ✅ | only used as a JS handle (`video/index.js:1655`) — no CSS |
| `.videoOsdBottom-hidden` | OSD faded out | all | ✅ | `opacity:0` (`videoosd.scss:118`); `.hide` is added on `transitionend` (`video/index.js:322-327`) |
| `.osdControls` | inner column of the shelf | all | ✅ | `pointer-events:all; flex-grow:1; padding:0 .8em` (`videoosd.scss:122-126`) — **the only clickable region of `.videoOsdBottom`** |
| `.osdTextContainer` | flex row wrapper for text bits | all | ✅ | `margin-bottom:.7em; padding-left:.5em` (`videoosd.scss:176`) |
| `.osdMainTextContainer` | wraps `.osdTitle` + `.osdMediaStatus` | all | ✅ | `align-items:baseline` (`videoosd.scss:184`) |
| `.osdTitle` | `<h3>` title slot | all | ✅ | **always empty in 12.1** — the title is rendered in the top bar instead. Free real estate: fill with `content` on `::after` is not possible (no data) but you can `display:none` it |
| `.osdMediaStatus` | "Fetching data" spinner row | all | ✅ | `.hide` toggled at `video/index.js:574,578`; `.animate` = `spin-clockwise 4s linear infinite` |
| `.osdSecondaryMediaInfo` | resolution/codec chips row | all | ⚠️ | `padding-left:.6em !important` (`videoosd.scss:172`); innerHTML from `mediaInfo.getSecondaryMediaInfoHtml` (`video/index.js:105`) |
| `.startTimeText` / `.osdPositionText` | elapsed time | all | ⚠️ | inline `style="margin:0 .25em 0 0"` in the template (`index.html:22`) |
| `.endTimeText` / `.osdDurationText` | remaining/total time | all | ⚠️ | inline `style="margin:0 0 0 .25em"` (`index.html:27`); click toggles remaining↔total |
| `.osdControls .sliderContainer.flex-grow` | scrubber wrapper | all | ⚠️ | inline `style="margin:.5em 0 .25em"` (`index.html:23`); also gets `.mdl-slider-container` from `emby-slider.js:312` |
| `.osdPositionSlider` | the `<input type=range>` itself | all | ✅ | transparent; `color:#00a4dc` from `.mdl-slider` (`emby-slider.scss:8`); thumb is `::-webkit-slider-thumb` / `::-moz-range-thumb` |
| `.mdl-slider::-webkit-slider-thumb`, `.mdl-slider::-moz-range-thumb` | the scrub handle | all | ✅ | `1.08em` circle, `background:#00a4dc`, `transition:.2s` (`emby-slider.scss:55-93`). **Must be written as two separate rules** — one invalid pseudo kills the whole selector list |
| `.mdl-slider-hoverthumb:hover::-webkit-slider-thumb` | grow on hover | desktop, tv | ✅ | class only added when `!layoutManager.mobile` (`emby-slider.js:295`) |
| `.mdl-slider.show-focus:focus::-webkit-slider-thumb` | grow on focus | tv | ✅ | class only on TV (`emby-slider.js:298`) |
| `.mdl-slider-background-flex` | the unplayed track | all | ✅ | `background:rgba(255,255,255,.3); height:.2em; overflow:hidden` (`emby-slider.scss:151-169`) — live: 3px tall |
| `.mdl-slider-background-lower` | played portion | all | ⚠️ | `background-color:#00a4dc` (`emby-slider.scss:176-191`), **`width` set inline by JS** every rAF (`emby-slider.js:190`) |
| `.mdl-slider-background-lower-clear` | played bar hidden | all | ✅ | `background-color:transparent` (`emby-slider.scss:193`), toggled by `setIsClear()` (`emby-slider.js:622-630`) |
| `.mdl-slider-background-upper` | buffered portion | all | ⚠️ | `background:rgba(255,255,255,.4)` (`emby-slider.scss:205-214`), **`left`/`right`+`width` set inline** (`emby-slider.js:573-583`) |
| `.sliderBubbleTrack` | positioning rail for the bubble | all | ✅ | `position:absolute; margin:0 .54em` (`emby-slider.scss:216`) |
| `.sliderBubble` | scrub tooltip | all | ⚠️ | `transform:translate3d(-50%,-120%,0); background:#282828` (`emby-slider.scss:223`), **`left` set inline in px** (`emby-slider.js:210`) |
| `.sliderBubbleText` | `<h1>` time inside the bubble | all | ✅ | `padding:.5em .75em` (`emby-slider.scss:236`) |
| `.chapterThumbContainer` | bubble body when chapters/trickplay exist | all | ⚠️ | `box-shadow:0 0 1.9vh #000; flex-grow:1` (`videoosd.scss:61`); trickplay path also sets `style="overflow:hidden"` inline (`video/index.js:1473`) |
| `.chapterThumbWrapper` | trickplay tile viewport | all | ❌ for size | **`width`/`height`/`background-image`/`background-position-x`/`-y` all inline from the trickplay manifest** (`video/index.js:1477-1524`). Only decorate (border, radius, shadow) |
| `.chapterThumb` | `<img>` preview (non-trickplay chapters) | all | ✅ | `height:20vh; min-width:20vh`, `30vw` in portrait, `30vh` under `max-height:50em` landscape (`videoosd.scss:70-91`) |
| `.chapterThumbTextContainer` | caption strip over the thumb | all | ✅ | `position:absolute; bottom:0; padding:.25em .5em` (`videoosd.scss:93`) |
| `.chapterThumbText` / `.chapterThumbText-dim` | timestamp `<h2>` / chapter-name `<div>` | all | ✅ | `text-shadow:0 0 25px #000, 0 0 6px #000` (`videoosd.scss:104`) |
| `.chapterBubblePosition` | makes the bubble body relatively positioned | all | ⚠️ | `position:relative !important` (`videoosd.scss:66`) |
| `.sliderMarkerContainer` | chapter-tick rail | all | ✅ | `position:absolute; margin:0 .54em` (`emby-slider.scss:256`) |
| `.sliderMarker`, `.sliderMarker.watched`, `.sliderMarker.unwatched` | chapter ticks | all | ⚠️ | 2×12px, `#00a4dc` / `rgba(255,255,255,.3)` (`emby-slider.scss:263-276`); **`left` inline via `calc()`** (`emby-slider.js:243`); markers come from `getMarkerInfo()` = chapters (`video/index.js:1929`) |
| `.videoOsdBottom .buttons` | the button row | all | ✅ | `display:flex; flex-wrap:wrap; align-items:center; padding:.25em 0 0`; RTL flips to `row-reverse` (`videoosd.scss:128-137`) |
| `.videoOsdBottom .buttons > div[dir="ltr"]` | left transport cluster | all | ✅ | unclassed wrapper — use this child selector |
| `.btnRecord`, `.btnPreviousTrack`, `.btnPreviousChapter`, `.btnRewind`, `.btnPause`, `.btnFastForward`, `.btnNextChapter`, `.btnNextTrack` | transport buttons | all | ✅ | all `is="paper-icon-button-light"`; `.hide` is toggled by JS (`video/index.js:65-81,229-233,920-923`) |
| `.btnPause > .material-icons` | play/pause glyph | all | ✅ | class swapped between `pause` and `play_arrow` (`video/index.js:726-739`) — use `.btnPause .play_arrow` as a "paused" hook |
| `.osdTimeText` | ends-at label + **the flex spacer** | all | ✅ | `margin-left:1em; margin-right:auto` (`videoosd.scss:156`) — this is what pushes the right cluster to the edge. Change it and the whole row reflows |
| `.endsAtText` | "Ends at HH:MM" | all | ✅ | innerHTML starts with 4 `&nbsp;` (`video/index.js:832`) |
| `.btnUserRating` | favourite heart | all | ✅ | `is="emby-ratingbutton"`; JS removes the `emby-button` class (`video/index.js:1962`) |
| `.btnSubtitles`, `.btnAudio` | track pickers | all | ✅ | `.hide` unless tracks exist (`video/index.js:215-225`) |
| `.volumeButtons` | mute + volume slider group | all | ✅ | `margin:0 1em 0 .29em; display:flex` (`videoosd.scss:150`); also `.hide-mouse-idle-tv` |
| `.buttonMute > .material-icons` | volume glyph | all | ✅ | `volume_up` ↔ `volume_off` (`video/index.js:886-893`) |
| `.osdVolumeSliderContainer` | volume slider wrapper | all | ✅ | `width:9em; flex-grow:1` (`videoosd.scss:139`) |
| `.btnVideoOsdSettings` | ⚙ | all | ✅ | opens an `actionSheet` (`playersettingsmenu.js:244`) |
| `.btnAirPlay`, `.btnPip`, `.btnFullscreen` | right cluster | all | ✅ | `.hide` from `appHost` capabilities (`video/index.js:768-784`) |
| `.btnFullscreen > .material-icons` | ⛶ glyph | all | ✅ | `fullscreen` ↔ `fullscreen_exit` (`video/index.js:497-504`) |
| `.xlargePaperIconButton`, `.largePaperIconButton` | size hint spans on every OSD icon | all | ✅ **free** | **no CSS rule anywhere in 12.1** — glyph size comes from `.paper-icon-button-light > .material-icons {font-size:1.6696em}` (`emby-button.scss:135`). Perfect hook for per-size icon scaling without side effects |
| `.videoOsdBottom .paper-icon-button-light` | every OSD icon button | all | ✅ | base: `padding:.556em; border-radius:50%; transition:.2s; overflow:hidden; outline:none !important` (`emby-button.scss:86-118`) |
| `.syncPlayContainer` | SyncPlay pulse overlay | all | ✅ | `position:absolute; inset:0; pointer-events:none` (`videoosd.scss:236`) |
| `#syncPlayIcon.syncPlayIconCircle` | the pulsing circle | all | ⚠️ | `visibility` set inline (`video/index.js:2010,2024,2032`); `class` attribute **replaced wholesale** via `setAttribute` (`video/index.js:2015`) — extra classes you add are wiped |
| `.primary-icon`, `.secondary-icon`, `.secondary-icon.centered`, `.secondary-icon.shifted`, `.spin` | SyncPlay glyphs | all | ⚠️ | several `!important` font-sizes (`videoosd.scss:248-273`); `class` also replaced via `setAttribute` (`video/index.js:2018,2021`) |
| `.skinHeader.osdHeader` | OSD top bar | **legacy + tv** | ✅ | `position:relative; z-index:1; height:7.5em; backdrop-filter:none; color:#eee; pointer-events:none; background:linear-gradient(180deg,rgba(16,16,16,.75),rgba(16,16,16,0))` (`videoosd.scss:37-46`) |
| `.osdHeader-hidden` | top bar faded out | **legacy + tv only** | ✅ | `opacity:0` (`videoosd.scss:48`) — in Modern this class lands on a `display:none` element, see gotchas |
| `.osdHeader .headerTop` | top bar inner row | legacy + tv | ✅ | `pointer-events:all; max-height:3.5em` (`videoosd.scss:52`) |
| `.osdHeader .headerButton:not(.headerBackButton):not(.headerCastButton):not(.headerSyncButton)` | trims the header buttons | legacy + tv | ✅ | `display:none` (`videoosd.scss:57`) |
| `.headerBackButton`, `.headerCastButton`, `.headerSyncButton`, `.pageTitle`, `.currentTimeText` | surviving header items | legacy + tv | ✅ | `.currentTimeText` (the clock) is visible only on TV |
| `.osdHeader.MuiBox-root` | **Modern** OSD top bar | modern | ⚠️ | carries `skinHeader skinHeader-withBackground skinHeader-blurred osdHeader` + a hashed `css-*`; **inline `style="opacity:…"` from `<Fade>`** (`apps/modern/routes/video/index.tsx:47-60`) |
| `.videoOsd-appBar` | **Modern** toolbar inside it | modern | ✅ | stable class passed to `AppToolbar` (`apps/modern/routes/video/index.tsx:73`); CSS: `margin-left/right: env(safe-area-inset-*); padding-left/right:1em` (`videoosd.scss:3-8`) |
| `.videoOsd-appBar .MuiIconButton-root` | back / SyncPlay / Cast in Modern | modern | ⚠️ | MUI classes are **stable**; the `css-*` siblings are not — never target `css-*` |
| `.videoOsd-appBar .MuiTypography-root` | the Modern OSD title | modern | ⚠️ | same caveat |
| `.videoOsd-appBar svg[data-testid="ArrowBackIcon"]` | back chevron | modern | ✅ | `data-testid` is a stable anchor for MUI icons |
| `.videoPlayerContainer` | the `<video>` wrapper | all | ⚠️ | `position:fixed !important; inset:0; display:flex; align-items:center; background:#000 !important` (`plugins/htmlVideoPlayer/style.scss:1-10`) |
| `.videoPlayerContainer-onTop` | fullscreen playback | all | ✅ | `z-index:1000` (`style.scss:12`); **removed once the OSD page is showing** (`plugin.js:1070,1130`) — live it is absent, so the OSD wins by DOM order, not z-index |
| `video.htmlvideoplayer` | the media element | all | ⚠️ | `margin/padding: 0 !important; width/height:100%` (`style.scss:28`); JS sets `poster` (`plugin.js:1850`) and `style.animation` for the zoom-in (`plugin.js:153`) |
| `.htmlvideoplayer::cue` | native WebVTT cue | all | ❌ | a JS-generated `<style id="htmlvideoplayer-cuestyle">` in `<head>` emits `!important` on every property (`plugin.js:1604-1623`) |
| `.htmlvideoplayer::-webkit-media-text-track-container` | native cue box | all (Chromium) | ⚠️ | `font-size:170% !important; line-height:50%` (`style.scss:44`) |
| `.htmlvideoplayer::-webkit-media-text-track-display` | native cue line | all (Chromium) | ✅ | `max-width:70%; margin-left:15%` (`style.scss:48`) |
| `.videoSubtitles` | custom subtitle window | all | ⚠️ | `position:fixed; bottom:0; font-size:170%; flex column` (`style.scss:53`); JS sets inline `top`/`bottom` from the vertical-position setting (`subtitleappearancehelper.js:118-133`) |
| `.videoSubtitlesInner` | primary cue box | all | ❌ for text | `max-width:70%; background-color:rgba(0,0,0,.8)` (`style.scss:69`) but JS writes **inline** `font-size, font-weight, text-shadow, background-color, color, font-family, font-variant, margin-top/bottom` (`subtitleappearancehelper.js:6-115`) |
| `.videoSecondarySubtitlesInner` | secondary cue box | all | ❌ for text | same + `min-height:0 !important; margin-top/bottom:.5em !important` (`style.scss:74-79`) |
| `.libassjs-canvas-parent` | ASS/SSA renderer canvas | all | ✅ | `order:-1` (`style.scss:16`) — **contents are a canvas, not stylable at all** |
| `.subtitleSync`, `.subtitleSyncContainer`, `.subtitleSyncTextField`, `.subtitleSync-closeButton`, `.subtitleSyncSliderContainer` | subtitle-offset widget | all | ✅ | `components/subtitlesync/subtitlesync.scss` — `rgba(28,28,28,.8)`, `border-radius:.3em` |
| `.upNextContainer` | the up-next panel | all | ✅ | `position:fixed; right:0; bottom:0; width:30em; padding:1em; background:rgba(0,0,0,.7); transition:opacity 300ms` + `margin:0 2em 2em 0` LTR (`upnextdialog.scss:1-23`) |
| `.upNextDialog` | added by `init()` | all | ✅ | `@media (orientation:landscape) { flex-direction:row }` (`upnextdialog.scss:52`) |
| `.upNextDialog-hidden` | faded out | all | ✅ | `opacity:0` (`upnextdialog.scss:25`) |
| `.upNextDialog-nextVideoText` | "Next episode in…" `<h2>` | all | ⚠️ | inline `style="margin:.25em 0"` (`upnextdialog.js:22`) |
| `.upNextDialog-countdownText` | the seconds counter `<span>` | all | ✅ | `font-weight:500; white-space:nowrap` (`upnextdialog.scss:29`) |
| `.upNextDialog-title` | `<h3>` next title | all | ⚠️ | `width:25.5em; text-overflow:ellipsis` (`upnextdialog.scss:34`) + inline `margin` (`upnextdialog.js:24`) |
| `.upNextDialog-mediainfo` | chips row | all | ✅ | — |
| `.upNextDialog-buttons` | button row | all | ⚠️ | `width:29.75em; justify-content:end` (`upnextdialog.scss:41`) + inline `style="margin-top:1em"` (`upnextdialog.js:29`) |
| `.upNextDialog-button`, `.btnStartNow`, `.btnHide` | the two buttons | all | ✅ | `background:#404040; color:#fff` (`upnextdialog.scss:47`) |
| `.skip-button-container` | media-segment skip anchor | all | ✅ | `position:fixed; bottom:8rem; z-index:10000; pointer-events:none` (`skipbutton.scss:1`) |
| `.skip-button` | "Skip Intro/Outro" | all | ✅ | `margin-left:auto; margin-right:6rem; padding:12px 20px; background:#303030; color:rgba(255,255,255,.87); border-radius:.2em; font-weight:bold; font-size:1.2em; transition:opacity 200ms` (`skipbutton.scss:10-27`) |
| `.skip-button-hidden` | faded out | all | ✅ | `opacity:0` (`skipbutton.scss:33`) |
| `.no-transition` | suppresses the fade | all | ⚠️ | **global, unscoped class name** (`skipbutton.scss:29`) |
| `.nowPlayingBar` | audio bar | desktop, mobile | ✅ | `contain:layout style; transition:transform 200ms; cursor:pointer` (`nowPlayingBar.scss:10`) |
| `.nowPlayingBar-hidden` | slid down | desktop, mobile | ✅ | `transform:translate3d(0,100%,0)` (`nowPlayingBar.scss:19`) |
| `.appfooter` | its container | all | ⚠️ | `position:fixed; bottom:0; z-index:1201 !important; contain:layout style` (`appFooter.scss:1-12`); `.appfooter.headroom--unpinned { transform:translateY(100%) !important }` |
| `.nowPlayingBarTop` | 4.2em row | desktop, mobile | ✅ | `nowPlayingBar.scss:23` |
| `.nowPlayingBarPositionContainer` | progress rail over the bar | desktop, mobile | ⚠️ | `position:absolute !important; top:-0.56em; z-index:1` (`nowPlayingBar.scss:86`) |
| `.noMediaProgress .nowPlayingBarPositionContainer`, `.headroom--unpinned .nowPlayingBarPositionContainer` | hides the rail | desktop, mobile | ✅ | `nowPlayingBar.scss:94,98` |
| `.nowPlayingBarInfoContainer`, `.nowPlayingImage`, `.nowPlayingBarText`, `.nowPlayingBarSecondaryText` | left art+text block | desktop, mobile | ⚠️ | `width:40%` → `45%` @80em → `100%` @60em; `.nowPlayingImage` gets inline `display`/`background-image` (`nowPlayingBar.js:509-516`) |
| `.nowPlayingBarCenter`, `.nowPlayingBarRight`, `.nowPlayingBarCurrentTime`, `.mediaButton` | control clusters | desktop, mobile | ✅ | `nowPlayingBar.scss:73-145`; `.layout-mobile`/`.layout-desktop`/`.layout-tv` variants at `:174-186` |
| `.nowPlayingBarPositionSlider::-webkit-slider-thumb` | its thumb | desktop, mobile | ⚠️ | `width/height:1.2em !important` (`nowPlayingBar.scss:142`) |
| `.playerStats`, `.playerStats-tv`, `.playerStats-content`, `.playerStats-content-tv`, `.playerStats-closeButton`, `.playerStats-stats`, `.playerStats-stat`, `.playerStats-stat-header`, `.playerStats-stat-label`, `.playerStats-stat-value` | stats overlay | all | ✅ | `components/playerstats/playerstats.scss` |
| `#nowPlayingPage`, `.remoteControlContent`, `.nowPlayingInfoContainer`, `.nowPlayingPageImageContainer`, `.nowPlayingPageImage`, `.nowPlayingPageTitle`, `.nowPlayingAlbum`, `.nowPlayingArtist`, `.nowPlayingButtonsContainer`, `.nowPlayingInfoButtons`, `.nowPlayingSecondaryButtons`, `.nowPlayingPositionSlider(Container)`, `.nowPlayingPlaylist`, `.playlistSection*`, `.contextMenuList`, `.navigationSection`, `.btnArrowUp/Left/Right/Down`, `.btnOk` | remote-control page | all | ✅ | `components/remotecontrol/remotecontrol.scss` (477 lines; heavy `.layout-mobile` / `.layout-desktop` / `.layout-tv` branching at `:166-253` and `@media` blocks at `:254+`) |
| `.actionSheet`, `.actionSheetContent`, `.actionSheetMenuItem`, `.actionSheetItemText`, `.actionSheetItemAsideText`, `.actionsheetDivider`, `.actionSheetScroller[-tv]`, `.btnCloseActionSheet` | the ⚙ menu (quality / aspect / rate / repeat / SubtitleOffset / PlaybackData) | all | ✅ | `components/actionSheet/actionSheet.scss`; markup at `actionSheet.ts:204-293` |
| `.dialogContainer > .dialog.opened`, `.formDialog`, `.formDialogHeaderTitle`, `.dialogContentInner`, `.formDialogFooter` | Still-Watching prompt and every other `confirm()` | all | ✅ | `components/dialog/dialog.template.html`; container `z-index:999999 !important; contain:strict` (`dialogHelper/dialoghelper.scss:1-13`) |

### Selectors that look real but are **dead in 12.1**

| selector | status |
|---|---|
| `.osdPoster` | no element anywhere; only a `display:none !important` media-query rule survives (`videoosd.scss:205`) |
| `.osdMediaInfo` | no element; two orphan rules (`videoosd.scss:144,167`) and one **dead JS reference that would throw** (`video/index.js:203`, only reached when `NowPlayingItem` is null) |
| `.osdTitleSmall` | no element; orphan rule (`videoosd.scss:163`) |
| `.btnStats` | **does not exist.** Stats are opened from the ⚙ action sheet item with `data-id="stats"` (`playersettingsmenu.js:235-240`) |
| `.videoOsdTop`, `.pauseOverlay`, "compact playback info" | not present in 12.1 — the top bar is `.skinHeader.osdHeader` (legacy/tv) or the MUI `Box` (modern); there is no pause overlay |

---

## Existing styling that will fight a custom theme

**1. Inline styles written by the template (static, but they beat any non-`!important` rule):**

| element | inline style | source |
|---|---|---|
| `.startTimeText` | `margin: 0 .25em 0 0` | `index.html:22` |
| `.osdControls .sliderContainer` | `margin: .5em 0 .25em` | `index.html:23` |
| `.endTimeText` | `margin: 0 0 0 .25em` | `index.html:27` |
| `.upNextDialog-nextVideoText` | `margin:.25em 0` | `upnextdialog.js:22` |
| `.upNextDialog-title` | `margin:.25em 0 .5em` | `upnextdialog.js:24` |
| `.upNextDialog-buttons` | `margin-top:1em` | `upnextdialog.js:29` |
| `.nowPlayingBarVolumeSliderContainer` | `width:9em;vertical-align:middle;display:inline-flex` | `nowPlayingBar.js:87` |
| `.openLyricsButton .material-icons` | `top:0.1em` | `nowPlayingBar.js:94` |
| `.nowPlayingSongName` | `font-weight:bold` | `queue/index.html:13` |

**2. Inline styles written continuously by JS (you cannot win these without `!important`, and even then
geometry breaks):**

- `.mdl-slider-background-lower` → `width: N%` every animation frame (`emby-slider.js:190`)
- `.mdl-slider-background-upper` → `left`/`right` + `width` in `%` (`emby-slider.js:573-583`)
- `.sliderBubble` → `left: Npx`, clamped against `getBoundingClientRect()` of `.sliderBubbleTrack` and of the
  bubble itself (`emby-slider.js:200-210`). **If your theme changes the bubble's width, the clamp still works —
  it re-measures. If you change its `transform`, the `-50%` centring breaks.**
- `.sliderMarker` → `left: calc(N% - Wpx)` where `W` is the measured marker width (`emby-slider.js:243`).
  **If you change `.sliderMarker { width }`, markers reposition correctly only after the next `updateMarkers()`.**
- `.chapterThumbWrapper` → `width`, `height` (raw trickplay tile px), `background-image`, `background-position-x`,
  `background-position-y`, `overflow:hidden` (`video/index.js:1473-1524`). **Do not touch width/height/background.**
- `#syncPlayIcon` → `visibility` (`video/index.js:2010,2024,2032`) and its **entire `class` attribute is replaced**
  with `setAttribute('class', 'syncPlayIconCircle ' + animationClass)` (`video/index.js:2015`); same for
  `.primary-icon` (`:2018`) and `.secondary-icon` (`:2021`). Classes you add via JS are wiped; CSS is fine.
- `video.htmlvideoplayer` → `poster` attribute (`plugin.js:1850`) and `style.animation` for the 240 ms zoom-in
  (`plugin.js:153`).
- `.videoSubtitlesInner` / `.videoSecondarySubtitlesInner` → **the entire text appearance** (`font-size`,
  `font-weight`, `text-shadow`, `background-color`, `color`, `font-family`, `font-variant`, `margin-top`/`-bottom`)
  and `.videoSubtitles` → `top`/`bottom` (`subtitleappearancehelper.js:6-158`, applied at `plugin.js:1594-1600`).
  **Only `!important` overrides these, and doing so breaks the user's subtitle settings.**
- `.nowPlayingImage` → `display` and `background-image`; `.nowPlayingBarText` → `margin-left`
  (`nowPlayingBar.js:509-516`).
- MUI `<Fade>` on the Modern `.osdHeader` → `opacity`, and `visibility:hidden` when out
  (`apps/modern/routes/video/index.tsx:47-50`).

**3. `!important` already in the stock CSS that your rules must out-weigh (equal specificity is enough —
Custom CSS is the last `<style>` in `<body>`, so a later `!important` at the same specificity wins):**

| rule | file |
|---|---|
| `.videoPlayerContainer { position: fixed !important; background:#000 !important }` | `htmlVideoPlayer/style.scss:2,9` |
| `.htmlvideoplayer { margin:0 !important; padding:0 !important }` | `style.scss:29,30` |
| `.htmlvideoplayer::-webkit-media-text-track-container { font-size:170% !important }` | `style.scss:44` |
| `.videoSecondarySubtitlesInner { min-height:0 !important; margin-top/bottom:.5em !important }` | `style.scss:77-79` |
| `video[controls]::-webkit-media-controls { display:none !important }` | `style.scss:25` |
| `.osdSecondaryMediaInfo { padding-left:.6em !important }` | `videoosd.scss:173` |
| `.chapterBubblePosition { position:relative !important }` | `videoosd.scss:67` |
| `.primary-icon.spin { font-size:76px !important }`, `.secondary-icon.centered { font-size:28px !important }` | `videoosd.scss:255,265` |
| the five `@media` blocks hiding OSD parts (`display:none !important`) | `videoosd.scss:202-234` |
| `.hide`, `.layout-*/.hide-*`, `.mouseIdle .hide-mouse-idle`, `.mouseIdle-tv .hide-mouse-idle-tv { display:none !important }` | `src/index.html:61-68` (head `<style>`) |
| `.layout-tv .mouseIdle …, .transparentDocument .mouseIdle … { cursor:none !important }` | `src/index.html:32-54` |
| `.libraryPage { padding-top:7em !important }`, `.libraryPage:not(.noSecondaryNavPage) { padding-top:7.5em !important }` (TV: `4.6em`) | `styles/librarybrowser.scss:92,112,400` |
| `.page { padding-bottom:5em !important }` (and the `calc(env(safe-area-inset-bottom)+5em)` variant) | `styles/site.scss:120-125` |
| `.mainAnimatedPage { contain: style size !important }` | `styles/site.scss:88` |
| `.appfooter { z-index:1201 !important }`, `.appfooter.headroom--unpinned { transform:translateY(100%) !important }` | `appFooter.scss:5,19` |
| `.nowPlayingBarPositionContainer { position:absolute !important }` | `nowPlayingBar.scss:87` |
| `.nowPlayingBarPositionSlider::-webkit-slider-thumb { width/height:1.2em !important }` | `nowPlayingBar.scss:143` |
| `.dialogContainer { z-index:999999 !important }` | `dialogHelper/dialoghelper.scss:10` |
| `.skinHeader.semiTransparent { backdrop-filter:none !important }` | `themes/_base/_theme.scss:103` |
| `.paper-icon-button-light { outline:none !important }` | `emby-button.scss:109` |
| Modern osdHeader `sx: { pointerEvents: 'unset !important' }` (becomes a hashed emotion rule) | `apps/modern/routes/video/index.tsx:59` |

**4. Containment / transform / clipping ancestors:**

- `#videoOsdPage` has `contain: style size !important` (`.mainAnimatedPage`). No `layout`/`paint`, so
  `position:fixed` children (`.videoOsdBottom`, `.upNextContainer`) still anchor to the viewport — but the page
  box's own size is computed as if empty.
- `.skinHeader` has `contain: layout style paint` (`librarybrowser.scss:221`). **Paint containment clips
  everything to the header box and makes it a stacking context** — a dropdown, glow, or overhanging logo drawn
  from a header child will be cut off. `videoosd.scss:39` only overrides `position`, not `contain`.
- `.nowPlayingBar` and `.appfooter` have `contain: layout style` — same stacking-context caveat, no clipping.
- `.dialogContainer` has `contain: strict` (size+layout+paint+style) — anything you draw outside the dialog box
  is clipped.
- `.videoOsdBottom` has `will-change: opacity`; `.upNextContainer` has `will-change: transform, opacity`;
  `.dialog` has `will-change: transform, opacity`; `.nowPlayingBar` has `will-change: transform` — each of these
  creates a stacking context.
- `.mdl-slider-background-lower-withtransform` uses `transform: scaleX(0)` with `transform-origin: left center`
  (`emby-slider.scss:197-203`) — unused on the OSD slider today but it would become a containing block.
- `.paper-icon-button-light` has `overflow:hidden` + `border-radius:50%` — **any ::after badge/ring you add to an
  OSD button is clipped to the circle.** Set `overflow: visible` first.
- `.upNextDialog-title` and `.nowPlayingBarText` use `overflow:hidden; text-overflow:ellipsis` on a fixed `em`
  width — change the font and the ellipsis point moves.

**5. Hashed emotion classes (never target, and they change on every jellyfin-web build):**

Only the **Modern top bar** is MUI. The observed values on this build were
`css-4r8yee` (the `.osdHeader` Box), `css-1tmqktv` (the `Toolbar`), `css-i2hxb6` (`IconButton`),
`css-pl8nxc` (`Typography`), `css-iguwhy` (`SvgIcon`), `css-1riowxi` / `css-chz7cr` / `css-14qzax9`
(`Box` / `Badge`). Use the stable companions instead: `.osdHeader`, `.videoOsd-appBar`,
`.MuiToolbar-root`, `.MuiIconButton-root`, `.MuiTypography-root`, `.MuiSvgIcon-root`,
`svg[data-testid="ArrowBackIcon"]`, `svg[data-testid="CastIcon"]`, `svg[data-testid="GroupsIcon"]`.
Everything inside `#videoOsdPage` itself is plain legacy markup — no emotion at all.

**6. z-index stack during playback (measured live):**

```
.dialogContainer            999999 !important   ← ⚙ action sheet, confirm(), Still-Watching
.docspinner                 9999999             (only while loading)
.skip-button-container      10000
.appfooter                  1201 !important     (empty during local video)
.MuiAppBar-root             1100                (0px tall on the video route)
.mainDrawer                 1099
.tmla-mask                  1098
.skinHeader / .osdHeader    1                   ← NOTE: videoosd.scss:40 drops it from 999 to 1
.mainDrawerHandle           1
.mdl-slider (input)         1
.sliderBubble               1
.videoOsdBottom             auto                ← wins over the video by DOM order only
.videoPlayerContainer       auto                ← FIRST child of body; -onTop (z:1000) is removed
                                                   once the OSD page shows (plugin.js:1070,1130)
.backdropContainer          -1
```

The consequence: **`.videoOsdBottom` sits above the video purely because it comes later in the document.**
If your theme gives `.videoPlayerContainer` a `z-index` or a `transform`, the OSD disappears behind it.

---

## Theming hooks

**`--jf-*` variables actually consumed in this subsystem** — there are only these, and all of them come from
`themes/_base/_theme.scss` applying to the shared `.paper-icon-button-light` / `.skinHeader` classes:

| variable | where it lands | file |
|---|---|---|
| `--jf-palette-primary-main` | OSD icon-button `:hover` and `:active` colour | `_theme.scss:145,152` |
| `--jf-palette-primary-mainChannel` + `--jf-palette-action-selectedOpacity` | OSD icon-button hover/active background | `_theme.scss:147,154` |
| `--jf-palette-secondary-main` | OSD icon-button `.show-focus:focus` colour (TV) | `_theme.scss:158` |
| `--jf-palette-text-secondary` | `.skinHeader` base colour (overridden to `#eee` by `.osdHeader`) | `_theme.scss:69-72` |
| `--jf-palette-AppBar-defaultBg` / `--jf-palette-AppBar-gradient` | `.skinHeader-withBackground` — **overridden** on the OSD by `.skinHeader-withBackground.osdHeader` (0,2,0 beats 0,1,0) | `_theme.scss:88-92` vs `videoosd.scss:37-46` |
| `--jf-palette-background-default` / `-defaultImage` | `html`, `.backgroundContainer`, `.nowPlayingPlaylist` | `_theme.scss:124-130` |

**Everything else in the player is hard-coded.** A JellyFlix theme should define its own custom properties on
`:root` (or on `#videoOsdPage`) and rewrite these literals:

| hard-coded value | where |
|---|---|
| `rgba(16,16,16,.75) → transparent` gradient | `.videoOsdBottom`, `.skinHeader-withBackground.osdHeader` |
| `#00a4dc` | slider thumb (3 vendor pseudos), `.mdl-slider-background-lower`, `.sliderMarker.watched`, `.mdl-slider` `color` |
| `rgba(255,255,255,.3)` / `rgba(255,255,255,.4)` | `.mdl-slider-background-flex` / `-upper`, `.sliderMarker.unwatched` |
| `#282828` | `.sliderBubble` |
| `#303030` + `rgba(255,255,255,.87)` | `.skip-button` |
| `#404040` | `.upNextDialog-button` |
| `rgba(0,0,0,.7)` | `.upNextContainer` |
| `rgba(28,28,28,.8)` | `.playerStats`, `.subtitleSyncContainer` |
| `rgba(0,0,0,.8)` | `.videoSubtitlesInner`, `.videoSecondarySubtitlesInner` |
| `#fff` / `#eee` / `#ccc` | OSD text, header text, close buttons |
| `rgba(0,164,220,*)` | SyncPlay pulse keyframes (`videoosd.scss:300-344`) |

**Classes toggled by JS (your state hooks):**

| class | on | meaning | source |
|---|---|---|---|
| `.hide` | almost everything | `display:none !important` | `src/index.html:61` |
| `.videoOsdBottom-hidden` | `.videoOsdBottom` | OSD fading out (then `.hide` on transitionend) | `video/index.js:361,322` |
| `.osdHeader` | `.skinHeader` | video page is active | `video/index.js:1665` (removed `:1755`) |
| `.osdHeader-hidden` | `.skinHeader` | top bar fading out — **legacy/TV only** | `video/index.js:309,314` |
| `.mouseIdle` / `.mouseIdle-tv` | `<body>` | 5 s without mouse input → `cursor:none` + hides `.hide-mouse-idle-tv` | `scripts/mouseManager.js:24-36` |
| `.hide-scroll` | `<body>` | playback started | `plugin.js:1861,1884` |
| `.transparentDocument` | `<html>` | backdrop transparency FULL — set on the video page | `components/backdrop/backdrop.js:300-311` |
| `.backgroundContainer-transparent` | `.backgroundContainer` | same | `backdrop.js:301` |
| `.videoPlayerContainer-onTop` | `.videoPlayerContainer` | fullscreen before the OSD mounts; removed after | `plugin.js:1813 / 1070,1130` |
| `.show-focus` | every `emby-slider` / `paper-icon-button-light` | TV layout only | `emby-slider.js:298` |
| `.mdl-slider-hoverthumb` | every `emby-slider` | non-mobile only | `emby-slider.js:294` |
| `.focusable` | `.osdPositionSlider` | TV only | `video/index.js:1659` |
| `.upNextDialog` / `.upNextDialog-hidden` | `.upNextContainer` | dialog created / faded | `upnextdialog.js:121-123,182` |
| `.skip-button-hidden` / `.no-transition` | `.skip-button` | faded / instant | `skipsegment.ts:104,121,90` |
| `.nowPlayingBar-hidden`, `.noMediaProgress` | `.nowPlayingBar` | slid down / no seekable media | `nowPlayingBar.js:122,314` |
| `.headroom--unpinned` | `.appfooter` | footer auto-hidden on scroll | `appFooter.scss:18` |
| `.material-icons.pause` ↔ `.play_arrow` | `.btnPause > span` | playing / paused | `video/index.js:726-739` |
| `.material-icons.fullscreen` ↔ `.fullscreen_exit` | `.btnFullscreen > span` | fullscreen state | `video/index.js:497-504` |
| `.material-icons.volume_up` ↔ `.volume_off` | `.buttonMute > span` | mute state | `video/index.js:886-893` |
| `.sliderMarker.watched` ↔ `.unwatched` | chapter ticks | passed / upcoming | `emby-slider.js:246-250` |
| `.playerStats-tv`, `.playerStats-content-tv` | `.playerStats` | TV layout | `playerstats.js:22,35` |

**Useful `:has()` / `:not()` / attribute anchors (all verified in the live DOM):**

```css
/* "is the OSD currently visible?" */
#videoOsdPage:has(.videoOsdBottom:not(.videoOsdBottom-hidden):not(.hide)) { }

/* "is playback paused?" — the pause button swaps its glyph class */
#videoOsdPage:has(.btnPause .play_arrow) { }
#videoOsdPage:has(.btnPause .pause)      { }

/* "is the up-next card showing?" */
#videoOsdPage:has(.upNextContainer:not(.hide):not(.upNextDialog-hidden)) { }

/* "is a skip-segment button offered?" */
body:has(.skip-button:not(.hide):not(.skip-button-hidden)) .videoOsdBottom { }

/* layout / theme scoping — html carries both */
html.layout-desktop[data-theme="dark"] .videoOsdBottom { }
html.layout-tv .videoOsdBottom { }
html.transparentDocument .videoOsdBottom { }   /* == "a fullscreen player page is open" */

/* Modern vs Legacy top bar without touching emotion hashes */
.osdHeader.MuiBox-root { }        /* Modern only */
.osdHeader.focuscontainer-x { }   /* Legacy + TV only */

/* stable route anchor */
[data-type="video-osd"] { }

/* the transport cluster has no class of its own */
.videoOsdBottom .buttons > div[dir="ltr"] { }

/* chapter markers exist? */
.osdControls:has(.sliderMarker) .mdl-slider-background-flex { }

/* trickplay vs plain-time bubble */
.sliderBubble:has(.chapterThumbWrapper) { }
.sliderBubble:has(> .sliderBubbleText)  { }
```

The `.xlargePaperIconButton` / `.largePaperIconButton` spans are **unstyled in stock 12.1** — the cleanest way to
resize OSD glyphs per class without disturbing the rest of the app.

---

## Netflix-relevance notes

| Netflix element | Jellyfin 12.1 counterpart | verdict |
|---|---|---|
| Bottom control bar, near-black fade to transparent | `.videoOsdBottom` (already a `linear-gradient(0deg, rgba(16,16,16,.75), transparent)`) | **Easy.** Deepen to `rgba(0,0,0,.85)` and raise `padding-top` to ~10em for Netflix's taller scrim. |
| Thin red scrubber, thick on hover, square-ish handle | `.mdl-slider-background-flex` (track) + `.mdl-slider-background-lower` (`#00a4dc`) + `::-webkit-slider-thumb` / `::-moz-range-thumb` | **Easy, with one caveat.** Recolour to `#e50914`; `height` on the track and thumb size are pure CSS. Grow-on-hover already exists via `.mdl-slider-hoverthumb:hover::-webkit-slider-thumb { transform: scale(1.3) }` — retarget it to the track by styling `.osdControls .sliderContainer:hover .mdl-slider-background-flex { height: .45em }`. Write the webkit and moz thumb rules as **separate** rules. |
| Buffered (grey) bar behind the played bar | `.mdl-slider-background-upper` | **Easy** (colour only; width is inline). |
| Chapter/segment ticks on the timeline | `.sliderMarker.watched` / `.unwatched` — but sourced from **chapters**, not media segments | **Partial.** Colour/size are CSS; `left` is inline so keep the width small or accept a one-frame lag. You cannot add per-segment colouring — the DOM carries no segment type. |
| Scrub preview thumbnail with a time chip | `.sliderBubble` > `.chapterThumbContainer` > `.chapterThumbWrapper` (trickplay) or `img.chapterThumb` | **Partial.** You can restyle the frame (radius, shadow, caption bar) but **not the thumbnail size** — `width`/`height` are inline, set from the trickplay tile geometry; forcing them with `!important` shifts the sprite offset and shows the wrong frame. Only the `img.chapterThumb` (non-trickplay) path is freely resizable (`height:20vh`). |
| Title / "S1:E3 Episode name" above the scrubber | `h3.osdTitle` exists but is **always empty**; the title lives in the top bar (`.pageTitle` legacy/TV, `.videoOsd-appBar .MuiTypography-root` modern) | **Impossible in pure CSS.** You cannot move text from the top bar into `.osdTitle`. Best approximation: hide the top-bar toolbar chrome except the back button, and style the top-bar title as the Netflix title block. |
| Big centred play/pause + 10 s skip arrows | `.btnPause`, `.btnRewind`/`.btnFastForward` — all left-aligned in `.videoOsdBottom .buttons > div[dir="ltr"]` | **Easy for size/shape**, layout is flex so you can re-order with `order`. Note `.btnRewind`/`.btnFastForward` are `display:none !important` under `50em`, and `.btnPreviousTrack`/`.btnNextTrack` are `.hide`-ed unless there's a queue. |
| Right-hand cluster: audio/subs, next episode, episodes, speed, fullscreen | `.btnSubtitles`, `.btnAudio`, `.btnVideoOsdSettings`, `.btnPip`, `.btnFullscreen`, `.volumeButtons` | **Easy.** `.osdTimeText { margin-right:auto }` is the spacer that creates the left/right split — keep it. |
| "Next Episode" card, bottom-right, with countdown ring | `.upNextContainer` / `.upNextDialog` (bottom-right, 30em, `rgba(0,0,0,.7)`, countdown in `.upNextDialog-countdownText`) | **Very close already.** Restyle to a card with a thumbnail — but there is **no image in the markup**, only text + `.upNextDialog-mediainfo` chips. A poster would have to be faked with a static `background-image`; per-item art is impossible. The countdown is text, not a ring — a CSS ring cannot read the number. |
| "Skip Intro" pill, bottom-right | `.skip-button` inside `.skip-button-container` (`bottom:8rem; margin-right:6rem`) | **Easy and a near-exact match.** Netflix uses a white/translucent rectangular pill; change `background`, `border-radius: 0`, `border: 1px solid`. Note the trailing `span.material-icons.skip_next` — hide it for Netflix's text-only pill. |
| "Are you still watching?" modal | `stillWatching` plugin → generic `confirm()` → `.dialogContainer > .dialog.opened.formDialog` | **Partial.** It's a shared dialog with no player-specific class, so styling it Netflix-style also restyles every other confirm in the app. Scope it with `html.transparentDocument .dialogContainer .formDialog` (only true while a player page is open). |
| Subtitles: white text, black drop shadow, no box | `.videoSubtitlesInner` (custom renderer) or `::cue` (native) or a libass canvas | **Mostly impossible.** Custom-element subtitles get every text property inline from user settings; native cues get a `!important` `<style>` injected into `<head>`; ASS/SSA is rendered into a `<canvas>` and is completely untouchable. Direct users to Settings → Subtitles instead. |
| Top-left back chevron over a fade | Legacy/TV: `.skinHeader.osdHeader` + `.headerBackButton`. Modern: `.osdHeader.MuiBox-root` + `.videoOsd-appBar .MuiIconButton-root` | **Easy but must be done twice** — the two layouts render different elements and the Modern one is driven by MUI `<Fade>` inline `opacity`, so do not animate `opacity` on it from CSS. Also remember `.skinHeader { contain: layout style paint }` clips anything overhanging the header box. |
| Netflix has **no** persistent audio bar | `.nowPlayingBar` never appears for local video (`nowPlayingBar.js:649`) | Nothing to do for the video OSD; style it separately as a Spotify-ish bar for music. |
| Netflix's mouse-idle auto-hide | already implemented: 3 s timer → `.videoOsdBottom-hidden` + `.osdHeader-hidden`, 5 s → `body.mouseIdle` + `cursor:none` | **Free.** Only the transition curve/duration is yours: `transition: opacity .3s ease-out` on `.videoOsdBottom` (`videoosd.scss:28`). |

**Hard blockers, restated:**

1. No poster/thumbnail element anywhere in the OSD (`.osdPoster` is dead) — you cannot add per-item art.
2. `h3.osdTitle` is empty; CSS cannot relocate the title from the top bar.
3. Trickplay thumbnail dimensions are inline px from the server manifest — untouchable.
4. Subtitle appearance is inline JS or `!important` head CSS or a canvas.
5. The up-next countdown is text; no ring/progress element exists.
6. `.videoOsdBottom { pointer-events: none }` — any full-width decoration you add there is click-through by
   design; only `.osdControls` receives input. Do not change this or you will swallow clicks meant for the video.
7. Giving `.videoPlayerContainer` a `z-index` or `transform` will hide the entire OSD behind the video.

---

## Verified live

Harness: `./tools/pw.sh tools/dom.mjs …`, each run starting playback with
`--route details-movie --click ".mainDetailButtons .btnPlay"`.

| profile | what was dumped |
|---|---|
| `modern-desktop` | `#videoOsdPage` depth 7 (full OSD tree); `body` depth 3 with `position,z-index,background-color,opacity,pointer-events`; `.osdHeader` depth 6 with `position,z-index,height,opacity,pointer-events,background-image,backdrop-filter` (**two matches** — the hidden legacy one and the MUI one); `.osdHeader.MuiBox-root --html` (inline `style="opacity: 1"`); `.osdControls .sliderContainer --html --hover .osdPositionSlider` (inline slider + bubble styles) |
| `legacy-desktop` | `body` depth 3 with `position,z-index,background-color,pointer-events`; `.videoOsdBottom, .osdPositionSlider, .mdl-slider-background-flex` with `position,z-index,background-image,background-color,padding,opacity,pointer-events,transition,color,contain` |
| `modern-mobile` | `.videoOsdBottom` depth 4 with `padding,font-size` (confirmed which buttons the media queries hide at 390px, and that `.mdl-slider-hoverthumb` is absent) |
| `tv` | `#videoOsdPage, .skinHeader` depth 4 with `font-size,padding,background-color` (confirmed TV uses the **legacy** `.skinHeader`, `.show-focus` on every button, `#videoOsdPage` padding `92px 0 100px`, `.currentTimeText` clock visible) |

Baseline screenshots inspected: `_shots/baseline/{modern-desktop,modern-mobile,legacy-desktop,tv}/player.png`.

Measured reference values (root font size 14.88px on desktop, 20px on TV):
`.videoOsdBottom` = `1920×223`, `padding 111.6px 0 26.04px`, gradient `rgba(16,16,16,.75)→0`, `pointer-events:none`;
`.osdControls` = `padding 0 11.904px`, `pointer-events:all`;
slider track height 3px; `.osdPositionSlider` computed `color: rgb(0,164,220)`;
TV `.videoOsdBottom` = `1920×300`, `padding 150px 0 35px`.

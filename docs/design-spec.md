# JellyFlix — authoritative design specification

**Target:** Jellyfin **12.1** web client, delivered as a single flat stylesheet pasted into
Dashboard → General → **Custom CSS** (and/or the per-user Display → Custom CSS field).

**Status:** this document is the *contract*. Implementation agents follow it literally. Where it gives a
number, that number ships. Where it says "must", a missing check fails the definition of done (§7).

**Sources synthesised:** (A) a live-measured Netflix web UI reference, (B) a media-server design system,
(C) a CSS-feasibility study against `_ref/jellyfin-web@v12.1` + the live `jellyflix-test` container.
**On any technical question, lens C wins.** Every place the three disagreed is resolved in §0.3 with a
one-line reason.

---

## 0. Ground rules before any CSS is written

### 0.1 The delivery channel

`src/components/CustomCss.tsx` renders **two `<style>` elements and nothing else** — the server Branding
CSS first, the per-user CSS second — as the **last children of `#reactRoot`**, after
`link[href="themes/dark/theme.css"]` and after every `<head>` sheet including emotion.

| Fact | Consequence for this spec |
|---|---|
| `<style>` only, no `<script>` | **Zero JS in the base theme.** Everything in §3 must work with the stylesheet alone. |
| Last sheet in the document | At **equal specificity JellyFlix wins**; our `!important` beats stock `!important`. |
| Specificity still compared first | `.card{}` (0,1,0) **loses** to stock `.card:not(.show-animation){}` (0,2,0). Match or exceed the stock selector. |
| Media queries add **zero** specificity | One flat declaration beats all 12 `card.scss` width breakpoints at once. This is the single biggest lever in the file. |
| Emotion hashes (`css-1u7mpsp`, …) change per build | **Never target `css-*`.** Use `MuiAppBar-root`, `MuiToolbar-dense`, `Mui-selected`, `:nth-child()`, `svg[data-testid]`, and the legacy plain classes. |
| `:root` beats `[data-theme="dark"]` on source order | Declare all dark tokens on **`:root`** (verified live). Light overrides go on `html[data-theme="light"]` (0,1,1). |

### 0.2 House rules (non-negotiable)

1. **Flat rules only.** No CSS nesting (Chromium 112+, no TV support). This is one hand-written file.
2. **One `:has()` per rule, never grouped with a plain selector.** A selector list is not forgiving — one
   unknown pseudo-class kills the whole rule. `:has()` is an **enhancement only**, never load-bearing
   (webOS ≤23 / Tizen ≤2022 lack it).
3. **`!important` only where stock used it.** Stock `!important` you will collide with:
   `.card` (7 props) · `.card:focus` (position, z-index) · `.cardBox` (padding, outline) ·
   `.cardContent` · `.cardImageContainer` · `.cardTextCentered` · `.cardOverlayButtonIcon` ·
   `.overflowBackdropCard-textCard` (width) · `.sectionTitleTextButton` · `.itemLinearProgress` ·
   `.mainAnimatedPage` (contain) · `.page` (padding-bottom) · `.libraryPage` / `.itemDetailPage` (padding-top) ·
   `.detailButton` (margin, padding) · `.layout-mobile .itemBackdrop` (margin-top) · `.hide` (display) ·
   `.emby-*` (`outline:none`, `margin-bottom:0`) · `_theme.scss:103` (`backdrop-filter:none`).
4. **Never target:** `css-*` hashes · `.scrollSlider`'s `transform`/`transition`/`will-change`/`position`/
   `overflow` (JS owns them and writes `translateX()` every scroll tick) · `.hide` (resurrecting a hidden
   element breaks every JS toggle — always write `:not(.hide)` when selecting "visible") · any inline
   `background-image`, inline progress `width`, or the app-bar spacer's inline `height` (except a
   deliberate, route-scoped `height:0 !important`).
5. **Never add `transform`, `filter`, `perspective`, `backdrop-filter`, `contain: layout|paint` or
   `will-change` to** `main`, `.skinBody`, `.page`, `.mainAnimatedPage` or `#reactRoot`. Any of them makes
   the element a containing block and drags the fixed app bar and `.alphaPicker-fixed-right` out of place.
6. **No `will-change` anywhere.** 128 promoted card layers ≈ 30 MB of GPU texture and is the classic way to
   crash a Tizen browser. A `transform` on `:hover` is composited anyway.
7. **No `transition: all`.** Always name the property.
8. **No shadows at rest.** Shadows only on `:hover`/`:focus` and on floating layers (menus, dialogs, OSD).
9. **No unconditional `backdrop-filter` or `filter: blur()`.** Gate on
   `@media (hover:hover) and (pointer:fine)` **and** `html:not(.layout-tv)`.
10. **Layout switches are classes, not media queries.** `html.layout-desktop|layout-mobile|layout-tv` follow
    UA/touch detection, **not width** — an 820 px tablet reports `layout-mobile`, a 900 px desktop window
    reports `layout-desktop`. Gate *interaction* on `@media (hover:hover) and (pointer:fine)`; gate *size* on
    width. Never conflate them.
11. **Root font-size is off-limits.** `html{font-size:93%}` → **14.88 px** desktop, 14.4 px mobile, 20 px TV.
    Every stock `em` (all of `card.scss`) resolves against it; every `em` in a media query resolves against
    **16 px**. All JellyFlix type is specified in **px**.
12. **File order:** tokens → `--jf-*` bridge → global/typography → shell (modern) → shell (legacy, guarded) →
    home rows → cards → details → library/search → list view → forms/dialogs → player → TV
    (`html.layout-tv`) → dashboard (`body.dashboardDocument`) → light theme →
    `@supports` enhancements → `prefers-reduced-motion` / `prefers-contrast` / `forced-colors`.

### 0.3 Conflict resolutions (decided here, once)

| # | Conflict | Decision | Why (one line) |
|---|---|---|---|
| 1 | Accent `#E50914` (A) vs `#E11D2E` (B) | **`#E11D2E`** | Trademark hygiene, and it measures 4.14:1 on the page vs 3.86:1 — strictly better, visually indistinguishable. |
| 2 | Page `#141414` (A) vs `#0B0B0B` (B) | **`#0B0B0B`** page, `#141414` promoted to surface-1 | Gives a full 6-step ladder with room to replace stock `#202020`; the app bar still goes solid at page colour, exactly as the reference does. |
| 3 | Red as the primary CTA (A) vs white primary (B) | **White primary, glass-grey secondary** | The reference's hero Play button *is* white; red-everywhere both misses the reference and collides with `.button-delete`. |
| 4 | Hover zoom ~1.5× (A) vs 1.10 (B) vs 1.12 (C) | **1.12 rows / 1.06 grids** | Lens C measured the vertical clearance budget; 1.12 grows a ~317 px `.cardBox` by 19 px/side and fits inside our own row rhythm with zero layout change. |
| 5 | Hover in-delay 400 ms (A) vs 250 ms (B) vs 350 ms (C) | **250 ms in / 90 ms out** | 250 ms already stops row flicker at 8–10 tiles/s; longer feels broken on a library you are scanning. |
| 6 | Gutter 4 % (A) vs `clamp(16px,3.75vw,72px)` (B) vs stock 3.3 % (C) | **`max(16px, 4%)`**, applied through the app's own `.padded-*` mechanism | Hits the reference's signature 4 % line, keeps `env(safe-area-inset)` behaviour, and is one edit to an existing hook. |
| 7 | Tile radius 8 px (A) vs 4 px (B) | **8 px** | Measured live as the most-used radius on the reference today; 4 px reads as the old design. |
| 8 | All rows 16:9 (A) vs portrait rails (B/C) | **Portrait everywhere except Continue Watching / Next Up / My Media** | `recentlyAdded.ts` passes `preferThumb:null` + `getPortraitShape()`, so the server returns a 2:3 Primary poster; cropping to 16:9 discards 62 % of the image. |
| 9 | Card captions hidden (A) vs always visible (B) | **Faded on desktop home rows only**, revealed on hover/focus-within; always visible in grids, on mobile and on TV | Jellyfin posters carry baked-in titles (verified in the baseline), so the home row reads correctly; a 5000-item grid does not. |
| 10 | 740 ms slider paging (A) | **Dropped — impossible** | JS owns `.scrollSlider`'s `transition` (0.05 s / 0.27 s) and its paging maths reads a cached `offsetWidth`. |
| 11 | Tile-hover `z-index: 30` (B) vs `3` (C) | **3**, section lift `4` | Stock reserves `z-index:10 !important` for `.card:focus`; 30 would make hover outrank keyboard focus. |
| 12 | `--jf-palette-error-main` ← accent red (B) vs keep off-red (C) | **Leave `error-main` at stock `#C62828`; JellyFlix never paints a filled red button except destructive confirms** | The dashboard's Restart/Shutdown already use `.button-delete`; since our primary button is white, the two reds never compete as "which do I press". |
| 13 | Web font (A/B) vs restyle the loaded font (C) | **Default to the already-loaded `"Noto Sans"`;** ship an optional, commented `@font-face` block | `@import` is a blocking third-party round-trip issued *after* first paint, on an app that is often LAN-only. |
| 14 | App bar 64 px (B) vs leave 48 px (C) | **64 desktop / 56 tablet / 48 mobile (fixed)**, with the two obligations in §3.1 made mandatory | The reference proportion is worth it, and the spacer follows automatically via `OffsetAppBar`'s `ResizeObserver` — only two hard-coded values need re-setting. |
| 15 | Row title in `vw` (A) vs fixed px (B) | **Fixed px with discrete breakpoint bumps** | `h2.sectionTitle` is shared with library page titles; `vw` there causes reflow, and the app's own `em` breakpoints already fight `vw`. |

---

## 1. Design principles

1. **Near-black canvas, restrained red.** The identity is carried by the *surface ladder and the scrims*,
   not by the accent. Red appears in exactly five slots (§2.3) and never as a background wash, a border, a
   heading or body text.
2. **The artwork is the interface.** Every surface that shows art follows one rule —
   **art → scrim → text** — and the scrim is always one of the five tokens in §2.6, never an ad-hoc gradient.
   Shadows are never used *on top of* artwork; separation over art is done with scrims, separation over flat
   surfaces with elevation.
3. **One alignment line.** The wordmark slot, every row title, the first tile of every row, the hero text
   block and the details overview all start at the same `--jflix-gutter` line. This single trait carries more
   of the "it looks like the reference" impression than any colour.
4. **Dense portrait rails.** Rows are the primary browse surface: 7 portrait tiles at 1920, tuned so the
   tile stays ~190–250 px wide at every breakpoint. Tile *size* is the constant, tile *count* is the variable.
5. **Motion is a pointer-intent filter, not decoration.** The 250 ms hover-in delay is a usability
   requirement (it stops a row flickering as the pointer sweeps), and keyboard focus reaches the same
   end-state with zero delay so it never waits.
6. **A media server is not a storefront.** Long metadata — cast, codecs, file paths, library folders — is
   the product. Clamp only the hero synopsis and card captions. Never `display:none` an episode synopsis, a
   filter control, the A–Z rail, or a sort/view toggle for visual cleanliness.
7. **Admin pages get density, not glamour.** Dashboard, settings, users, logs and metadata editors switch to
   compact density, lose the wide gutter, and lose hover-scale entirely. A zooming settings tile reads as a bug.
8. **Degrade, never break.** Every enhancement (`:has()`, scroll-driven animation, `backdrop-filter`) sits in
   its own rule so a TV browser that lacks it keeps a complete, coherent theme.

---

## 2. Token table

All tokens are `--jflix-*`. Declared on **`:root`** (beats MUI's `[data-theme="dark"]` on source order,
verified live). Light overrides on `html[data-theme="light"]` (0,1,1). TV overrides on `html.layout-tv`.

### 2.1 Surface ladder

Six opaque steps, each ≥ 2 ΔL apart so adjacent surfaces separate without borders. Translucency is reserved
for the explicit overlay tokens in §2.5.

| Token | Value | Purpose |
|---|---|---|
| `--jflix-surface-0` | `#0B0B0B` | Page background, solid app bar, player background, TV background |
| `--jflix-surface-1` | `#141414` | Section bands, sticky sub-toolbars, drawer, table header, legacy skin header |
| `--jflix-surface-2` | `#1C1C1C` | Card plate / empty poster padder, list rows, admin panels |
| `--jflix-surface-3` | `#232323` | Menus, popovers, dialogs, snackbars, MUI `paper` |
| `--jflix-surface-4` | `#2B2B2B` | Form-field fill, chips, secondary button on a flat surface, slider track |
| `--jflix-surface-5` | `#3A3A3A` | Pressed field, scrollbar thumb, secondary button hover on a flat surface |
| `--jflix-line-hairline` | `rgba(255,255,255,.08)` | List dividers, table rules (1 px) |
| `--jflix-line-subtle` | `rgba(255,255,255,.16)` | Field border at rest, chip border |
| `--jflix-line-strong` | `rgba(255,255,255,.38)` | Field border on hover, certification pill border |
| `--jflix-line-invert` | `#FFFFFF` | Focus-ring outer, active field border (2 px) |

### 2.2 Text

| Token | Value | on surface-0 | on surface-2 | Use |
|---|---|---|---|---|
| `--jflix-text-primary` | `#FFFFFF` | 19.7:1 | 17.0:1 | Headings, titles, primary body |
| `--jflix-text-secondary` | `rgba(255,255,255,.72)` | 10.2:1 | 9.3:1 | Metadata, synopsis, row titles, labels |
| `--jflix-text-tertiary` | `rgba(255,255,255,.56)` | 6.5:1 | 6.1:1 | Timestamps, counts, helper text — **lowest legal body token** |
| `--jflix-text-quaternary` | `rgba(255,255,255,.44)` | 4.4:1 | 4.3:1 | **Only** at ≥ 24 px, or ≥ 18.66 px bold, or non-text |
| `--jflix-text-disabled` | `rgba(255,255,255,.38)` | 3.5:1 | 3.6:1 | Disabled only (WCAG-exempt) |
| `--jflix-text-on-accent` | `#FFFFFF` | 4.75:1 on accent | — | Label on a red fill |
| `--jflix-text-on-light` | `#0B0B0B` | 19.7:1 on `#FFF` | — | Label on the white primary button |

`--jflix-text-quaternary` and below never carry meaning alone.

### 2.3 Accent and semantics

| Token | Value | Contrast | Scope (exhaustive) |
|---|---|---|---|
| `--jflix-accent` | `#E11D2E` | 4.14:1 on s0, 3.58:1 on s2 | wordmark slot · watch-progress fill · active-tab / active-nav indicator · unwatched count badge · destructive confirm |
| `--jflix-accent-hover` | `#F5243A` | — | accent hover |
| `--jflix-accent-active` | `#B3121F` | white on it 6.95:1 | accent pressed |
| `--jflix-accent-glow` | `rgba(225,29,46,.35)` | — | `0 0 24px` glow behind the wordmark slot; TV focus tint |
| `--jflix-success` | `#46D369` | 10.1:1 on s0 | watched check, "new episode", sync OK |
| `--jflix-warning` | `#F2B01E` | 10.3:1 on s0 | star rating (keeps Jellyfin's own value), transcoding notice |
| `--jflix-danger` | `#C62828` | — | destructive **fill** only (`.button-delete`) — deliberately darker/duller than the accent |
| `--jflix-danger-text` | `#FF6B6B` | 5.7:1 on s3 | error *text*, helper text, invalid field border |
| `--jflix-info` | `#5AA7FF` | 7.9:1 on s0 | links, informational chips, snackbar action label |

| `--jflix-progress-track` | `#141414` (**opaque**, = `--jflix-surface-1`) | 3.9:1 vs the accent fill | watch-progress / scrubber track |

**The progress track must be opaque.** Both source lenses proposed `rgba(255,255,255,.28–.30)`; over a tile
plate that composites to `rgb(92,92,92)` and the red fill reads **1.42:1** against it — the "how far
watched" state is not perceivable. Over *white* artwork any translucent track is worse still (1.29:1). An
opaque `#141414` track is artwork-independent and gives **3.88:1**, clearing SC 1.4.11. The only exception
is the player scrubber's **buffered** segment, which may stay translucent because it is not a state the
user must read precisely.

**Accent-as-text is forbidden on every surface** (3.58:1 on surface-2 fails 4.5:1). Use
`--jflix-danger-text` or `--jflix-info`.

### 2.4 Type

| Token | Value | Use |
|---|---|---|
| `--jflix-font` | `"Noto Sans", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | Everything except icons |
| `--jflix-font-num` | `"Noto Sans", ui-monospace, monospace` + `font-variant-numeric: tabular-nums` | Durations, timecodes, file sizes, bitrates |

Type tokens are `font` shorthands that embed the family, so `font: var(--jflix-type-row)` is a one-liner.
Tracking is applied separately (the `font` shorthand does not reset `letter-spacing`).

| Token | Value | Tracking | Use |
|---|---|---|---|
| `--jflix-type-display` | `800 56px/1.04 var(--jflix-font)` | `-0.022em` | Hero title when no logo art (max 2 lines) |
| `--jflix-type-h1` | `700 40px/1.10 var(--jflix-font)` | `-0.018em` | Details-page item name |
| `--jflix-type-h2` | `700 24px/1.20 var(--jflix-font)` | `-0.012em` | Page title, dialog title |
| `--jflix-type-row` | `700 20px/1.30 var(--jflix-font)` | `-0.006em` | **Row / section heading** |
| `--jflix-type-h3` | `600 17px/1.35 var(--jflix-font)` | `0` | Sub-section, list group header |
| `--jflix-type-body-lg` | `400 16px/1.55 var(--jflix-font)` | `0` | Hero synopsis, details overview |
| `--jflix-type-body` | `400 14px/1.50 var(--jflix-font)` | `0` | Default body, list primary text |
| `--jflix-type-body-sm` | `400 13px/1.45 var(--jflix-font)` | `0` | Metadata row, card caption, table cells |
| `--jflix-type-label` | `600 12px/1.35 var(--jflix-font)` | `+0.01em` | Form labels, helper text |
| `--jflix-type-micro` | `700 11px/1.20 var(--jflix-font)` | `+0.06em`, uppercase | Chips, quality badges |
| `--jflix-type-button` | `600 14px/1 var(--jflix-font)` | `+0.005em` | All button labels |
| `--jflix-type-button-lg` | `700 16px/1 var(--jflix-font)` | `0` | Hero primary button |

**Row-title step-up** (replaces the reference's `vw` sizing; see §0.3 #15):
`≥1600px → 22px`, `≥1920px → 24px`. No other token uses viewport units.

**Tracking law:** −0.02em at ≥ 40 px · −0.012em at 20–39 px · 0 at 13–19 px · +0.06em at ≤ 12 px uppercase.
Never letter-space running body text. **Never uppercase a string longer than 14 characters** — Polish labels
("Ostatnio dodane", "Ponowne uruchomienie") lose diacritic legibility at 11 px uppercase.

**Font-family plumbing (load-bearing, verified):** `--jf-font-*` variables exist but MUI components compile
literal values, so `:root{--jf-font-body1:…}` has **no effect**. The family must be set with
**two** rules: `html, body { font-family: … }` **and** `[class*="Mui"] { font-family: … }`. Do not let the
second rule reach `.MuiIcon-root`; `.material-icons` is lowercase and already excluded.
`font-synthesis: none` — do not let the browser fake a bold.

### 2.5 Overlays and translucency

| Token | Value | Purpose |
|---|---|---|
| `--jflix-overlay-hover` | `rgba(255,255,255,.08)` | List/menu row hover |
| `--jflix-overlay-press` | `rgba(255,255,255,.14)` | Pressed |
| `--jflix-overlay-selected` | `rgba(255,255,255,.12)` | Selected row — always paired with a 3 px accent bar, never colour alone |
| `--jflix-overlay-glass` | `rgba(109,109,110,.70)` | Secondary button **over artwork** (white on it = 8.1:1) |
| `--jflix-overlay-glass-hover` | `rgba(109,109,110,.45)` | Its hover — **over artwork only**; on flat surfaces use `--jflix-surface-5` |
| `--jflix-overlay-icon` | `rgba(42,42,42,.60)` | Circular icon button over artwork |
| `--jflix-scrim-modal` | `rgba(0,0,0,.72)` | Dialog backdrop |
| `--jflix-scrim-tile` | `rgba(0,0,0,.55)` | Hover dim on a tile |

### 2.6 Gradient scrims (the load-bearing part of the look)

```
--jflix-scrim-top:    linear-gradient(180deg, rgba(0,0,0,.78) 0%, rgba(0,0,0,.42) 46%, rgba(0,0,0,0) 100%);
--jflix-scrim-bottom: linear-gradient(0deg,  #0B0B0B 0%, rgba(11,11,11,.88) 14%, rgba(11,11,11,.50) 36%, rgba(11,11,11,0) 66%);
--jflix-scrim-left:   linear-gradient(90deg, rgba(11,11,11,.94) 0%, rgba(11,11,11,.74) 26%, rgba(11,11,11,.26) 50%, rgba(11,11,11,0) 72%);
--jflix-scrim-tile-b: linear-gradient(0deg,  rgba(0,0,0,.92) 0%, rgba(0,0,0,.58) 38%, rgba(0,0,0,0) 78%);
--jflix-scrim-osd-b:  linear-gradient(0deg,  rgba(0,0,0,.88) 0%, rgba(0,0,0,.45) 45%, rgba(0,0,0,0) 100%);
```

Geometry: top scrim **140 px** tall desktop / 96 px mobile · bottom hero scrim occupies the lower **62 %** of
the hero · left scrim applies only ≥ 1000 px · tile scrim occupies the lower **52 %** of the tile ·
OSD bottom scrim **180 px**.

**Scrim contrast rule (enforceable, §5):** the first text baseline must sit where the scrim is at
**≥ 0.72 alpha black**. Worst case (pure-white artwork) the composite is `rgb(71,71,71)`; white on that is
**9.2:1**. `--jflix-text-shadow` is belt-and-braces and **does not count** toward WCAG — the scrim carries it alone.

### 2.7 Space

Base 4 px: `--jflix-space-1:4` · `-2:8` · `-3:12` · `-4:16` · `-5:20` · `-6:24` · `-7:32` · `-8:40` ·
`-9:48` · `-10:64` · `-11:80` · `-12:96`.

Semantic aliases (what component recipes reference):

| Token | Desktop ≥1200 | Laptop 1000–1199 | Tablet 600–999 | Phone <600 | TV |
|---|---|---|---|---|---|
| `--jflix-gutter` | `max(16px, 4%)` → 76.8 @1920 | 40 @1024 | 32 | 16 | `5%` (overscan-safe) |
| `--jflix-row-gap` | 48 | 40 | 32 | 24 | 56 |
| `--jflix-tile-gap` | 8 | 8 | 6 | 8 | 12 |
| `--jflix-row-title-gap` | 12 | 12 | 10 | 8 | 16 |
| `--jflix-section-gap` | 40 | 36 | 28 | 24 | 48 |
| `--jflix-field-gap` | 16 (compact 8) | 16 | 16 | 16 | 20 |

`--jflix-gutter` is applied through the app's own mechanism —
`[dir="ltr"] .padded-left`, `[dir="rtl"] .padded-right`, `.emby-scroller`, `.MuiToolbar-root.padded-left` —
which is `(0,2,0)`, so a bare `.MuiToolbar-root{padding-left:…}` will lose. Write both `dir` variants;
logical properties are Chromium 87+ and fail on webOS 22 / Tizen 2021.

### 2.8 Sizes

| Token | Value | Notes |
|---|---|---|
| `--jflix-bar-h` | **64** desktop / 56 tablet / **48 mobile (fixed)** | Mobile **must** stay 48: `apps/modern/AppOverrides.scss:34` hard-codes `-48px` for the mobile details backdrop. |
| `--jflix-bar-h-2` | 48 | Second (library) toolbar row, unchanged |
| `--jflix-control-h` | 40 | Default button/field height (44 on `pointer: coarse`) |
| `--jflix-control-h-lg` | 48 | Hero primary button, dialog actions |
| `--jflix-control-h-sm` | 32 | Toolbar ghost buttons, chips |
| `--jflix-control-h-dense` | 36 | Compact (admin) density |
| `--jflix-touch-min` | 44 | Minimum touch target |
| `--jflix-tv-target-min` | 48 | Minimum TV focusable height, 16 px apart |
| `--jflix-icon-sm` / `-md` / `-lg` / `-xl` / `-tv` | 16 / 20 / 24 / 28 / 32 | |
| `--jflix-avatar` | 32 (rounded square, `--jflix-radius-sm`) | Stock is a 40 px circle |
| `--jflix-list-row-h` | 96 large-image / 56 compact / 40 dense / 72 TV | |
| `--jflix-table-cell-pad` | `12px 16px` (dense `6px 12px`, TV `16px 20px`) | |
| `--jflix-type-row-block` | `26px` desktop / 29 @1600 / 31 @1920 / 20 mobile / 36 TV | The row title's rendered block height (`--jflix-type-row` size × its line-height, rounded up). Declared, not computed: the scroll-arrow anchor in §3.4 needs a length, and a `calc()` over a `font` shorthand is not available. **Re-derive it whenever `--jflix-type-row` changes.** |
| `--jflix-scroll` | `0` | Written 0→1 by the optional JS add-on (§6.4); every rule that reads it **must** supply a fallback, e.g. `var(--jflix-scroll, 0)`, so the theme is correct without the add-on. |

### 2.9 Tile geometry

One custom property drives every breakpoint. Because media queries carry no specificity, **one** flat width
rule plus per-breakpoint redeclarations of `--jflix-tiles` beats all 12 `card.scss` breakpoints:

```
.overflowPortraitCard, .overflowSquareCard { width: calc(100% / var(--jflix-tiles)); }
.overflowBackdropCard, .overflowSmallBackdropCard { width: calc(100% / var(--jflix-tiles-wide)); }
```

`%` (not `vw`) is mandatory: `vw` includes the classic scrollbar and overflows the last card by ~15 px on
desktop Firefox/Windows Chrome. `.scrollSlider` is `display:flex` with a definite width equal to the
scroller content box, so `%` is exact.

| Viewport | `--jflix-tiles` (portrait 2:3) | `--jflix-tiles-wide` (16:9) | Resulting portrait pitch |
|---|---|---|---|
| ≥ 1920 | **7** | 5 | 252 px (visual 244 after gap) |
| 1600–1919 | 6 | 4 | 245 @1600 |
| 1200–1599 | 5 | 4 | 251 @1366 |
| 900–1199 | 4 | 3 | 236 @1024 |
| 600–899 | **3.4** (peek) | 2.4 | 189 @700 |
| < 600 | **2.6** (peek) | 1.6 | 138 @390 |
| TV | 6 | 4 | 288 @1920 |

Fractional counts create a deliberate **peek** that signals scrollability on touch, where there are no
arrows. Desktop counts are whole — a half-tile reads as a bug when arrows exist.

**Image-resolution ceiling:** the server still requests the *old* size (`setCardData()` /
`getPostersPerRow()`); a 200 px stock card requests `fillWidth=223&fillHeight=335`. **Never widen a tile
beyond ~1.35× the stock pitch** or the JPEG visibly softens. 7-up at 1920 is 1.26× — inside budget. 6-up
would be 1.49× and is forbidden.

**Three traps:**
1. TV out-specifies you: `.itemsContainer-tv > .overflowPortraitCard{width:15.6vw}` is (0,2,0). **Repeat the
   rule with the same selector** for TV.
2. `.overflowBackdropCard-textCard{width:15.5vw !important}` needs `!important`.
3. The `@media (orientation: landscape)` block in `card.scss` is beaten by a flat rule, but any tile-width
   override must also be repeated inside an `@media (orientation: landscape)` block or a rotated phone
   silently reverts.

Gap comes from `.cardBox{margin-right:1.2em}` (≈17.9 px) — **not** flex `gap` (Chromium 84 / webOS 22).
Override to `--jflix-tile-gap` for both `dir` variants.

Hover scale: `--jflix-zoom-row: 1.12` · `--jflix-zoom-grid: 1.06`.
Growth per side = `cardBoxHeight × (s−1) / 2`; at 1.12 on a ~317 px box that is 19 px, which fits inside our
48 px `--jflix-row-gap` + 12 px title gap with margin. Horizontal is not binding: at 76.8 px gutter the
portrait ceiling is s ≤ 1.80, backdrop s ≤ 1.45.

### 2.10 Radius

| Token | Value | Applied to |
|---|---|---|
| `--jflix-radius-xs` | `2px` | Badges, progress bars, quality chips |
| `--jflix-radius-sm` | `4px` | Buttons, inputs, selects, toolbar controls |
| `--jflix-radius-md` | `6px` | Dialogs, menus, popovers, snackbars, tooltips |
| `--jflix-radius-tile` | `8px` | **Tiles**, poster art, hero logo plate, list thumbs |
| `--jflix-radius-lg` | `12px` | Mobile bottom-sheet top corners |
| `--jflix-radius-pill` | `999px` | Filter chips, genre pills |
| `--jflix-radius-circle` | `50%` | Icon FABs, person cards, cast avatars |

Set `--jf-card-borderRadius: 8px` — **px, not em**. As an `em` the custom property re-resolves against each
consuming element's own font-size, so the tile, the padder and the blurhash canvas silently disagree.
`.cardImageContainer` **also hard-codes `border-radius:.2em`** (`card.scss:170`) and must be overridden
explicitly, together with `.blurhash-canvas` and `.cardContent`.

### 2.11 Elevation, focus, blur

| Token | Value | Use |
|---|---|---|
| `--jflix-elev-0` | `none` | Tiles at rest, flat surfaces, header |
| `--jflix-elev-1` | `0 1px 2px rgba(0,0,0,.65)` | Solid app bar, sticky toolbar |
| `--jflix-elev-2` | `0 4px 12px rgba(0,0,0,.55)` | Menus, popovers, tooltips |
| `--jflix-elev-3` | `0 10px 28px rgba(0,0,0,.68)` | **Hovered tile**, hover overlay |
| `--jflix-elev-4` | `0 18px 48px rgba(0,0,0,.78)` | Dialogs, drawer |
| `--jflix-elev-tv` | `0 0 0 4px var(--jflix-surface-0), 0 12px 32px rgba(0,0,0,.8)` | TV focus (no large blur radii) |
| `--jflix-focus-ring` | `0 0 0 2px var(--jflix-surface-0), 0 0 0 4px #FFFFFF` | Dark contour + white ring ⇒ ≥3:1 against both near-black page **and** bright poster |
| `--jflix-focus-ring-tv` | `0 0 0 3px var(--jflix-surface-0), 0 0 0 7px #FFFFFF` | TV |
| `--jflix-text-shadow` | `0 1px 3px rgba(0,0,0,.9)` | Text over artwork (decorative only) |
| `--jflix-blur` | `blur(8px)` | **Gated**: `@media (hover:hover) and (pointer:fine)` + `html:not(.layout-tv)` |

`html.layout-tv` caps blur radius at 32 px and forbids `backdrop-filter` entirely — both are frame-rate
killers on TV browser engines, and stock already ships `.skinHeader.semiTransparent{backdrop-filter:none!important}`.

**MUI elevation plumbing (verified):** MUI writes `--Paper-shadow`/`--Paper-overlay` as **inline styles** on
every `Paper`, so `.MuiPaper-root{--Paper-shadow:…}` is ignored. The inline value is itself a `var()`, so
redefining **`--jf-shadows-1…24`** and **`--jf-overlays-1…24`** on `:root` *does* work. Set all
`--jf-overlays-*: none` (kills MUI's white elevation wash) and map `--jf-shadows-2 → elev-2`,
`--jf-shadows-8 → elev-2`, `--jf-shadows-16/24 → elev-4`.

### 2.12 z-index ladder

Must interleave with the app's existing stack (measured live):

`-1` `.backdropContainer` (stock) · **`--jflix-z-tile-hover: 3`** · **`--jflix-z-row-lift: 4`** ·
`10` `.card:focus` (stock `!important` — keyboard focus must stay on top) ·
**`--jflix-z-row-arrow: 5`** · **`--jflix-z-sticky: 900`** · `999` `.skinHeader` (stock) ·
`1098` `.tmla-mask` · `1099` `.mainDrawer` · `1100` MUI `AppBar` · `1200` `.MuiDrawer-paper` ·
`1201` `.appfooter` · `1300` MUI modal/popover · `1400` snackbar · `1500` tooltip.

A hovered tile must never exceed 999 or it paints over the header.

### 2.13 Motion

| Token | Value | Use |
|---|---|---|
| `--jflix-dur-instant` | `80ms` | Press feedback |
| `--jflix-dur-fast` | `120ms` | Colour/opacity on hover, chevron slide, arrow fade |
| `--jflix-dur-base` | `200ms` | Transform on hover/focus, menu open |
| `--jflix-dur-hover-out` | `160ms` | Hover reverse |
| `--jflix-dur-slow` | `250ms` | Default; colour changes, floating label |
| `--jflix-dur-nav` | `400ms` | App-bar transparent ⇄ solid |
| `--jflix-dur-dialog` | `320ms` | Dialog enter, drawer slide |
| `--jflix-dur-hero` | `600ms` | Hero image / gradient cross-fade |
| `--jflix-dur-osd` | `3000ms` | Player chrome idle timeout |
| `--jflix-delay-hover-in` | `250ms` | Tile hover-intent delay |
| `--jflix-delay-hover-out` | `90ms` | Tile hover-leave grace |
| `--jflix-ease-exit` | `cubic-bezier(.4,0,.68,.06)` | Colour/border changes, leaving (reference-exact) |
| `--jflix-ease-enter` | `cubic-bezier(.32,.94,.6,1)` | Motion/size changes, arriving (reference-exact) |
| `--jflix-ease-slide` | `cubic-bezier(.5,0,.1,1)` | Panel/overlay slide |
| `--jflix-ease-emphasis` | `cubic-bezier(.16,1,.3,1)` | Tile zoom (overshoot-free settle) |
| `--jflix-ease-standard` | `cubic-bezier(.2,0,0,1)` | Fallback |

**Pressed state duration is 0 ms** — press feedback is instant, release animates.

### 2.14 Text labels (localisation hooks)

Pseudo-element `content` is untranslatable. Every literal string the theme injects is exposed as a variable,
documented as the single retranslation point. All are **decorative** — they sit next to an element that
already carries a localized `title`/`aria-label`.

| Token | Default (server locale is Polish) |
|---|---|
| `--jflix-label-play` | `"Odtwórz"` |
| `--jflix-label-seen` | `"Obejrzane"` |
| `--jflix-label-resume` | `"Wznów"` |
| `--jflix-label-new` | `"Nowość"` |

### 2.15 Density

`--jflix-density` is documented as the switch name; implementation is a selector, not a real switch:
`body.dashboardDocument`, `#dashboardPage`, `.type-interior`, `#myPreferencesMenuPage` and metadata editors
get the compact column.

| Token | comfortable | compact | tv |
|---|---|---|---|
| `--jflix-control-h` | 40 | 36 | 56 |
| `--jflix-list-row-h` | 56 | 40 | 72 |
| `--jflix-field-gap` | 16 | 8 | 20 |
| `--jflix-type-body` | 14 px | 13 px | 20 px |
| `--jflix-gutter` | `max(16px,4%)` | `clamp(16px,2vw,32px)` | `5%` |
| `--jflix-table-cell-pad` | `12px 16px` | `6px 12px` | `16px 20px` |
| `--jflix-zoom-row` | 1.12 | **1** (disabled) | stock 1.07, untouched |

Compact is **mandatory** on dashboard, settings, user management, logs and metadata editors.

### 2.16 Bridge to Jellyfin's `--jf-palette-*`

One block on `:root` retints MUI **and** the legacy SCSS, because
`src/themes/_base/_theme.scss` reads the same variables MUI emits (`cssVarPrefix:'jf'`,
`colorSchemeSelector:'[data-theme="%s"]'`).

| Jellyfin variable | ← JellyFlix token | Stock | Why it matters |
|---|---|---|---|
| `--jf-palette-background-default` | `--jflix-surface-0` | `#101010` | `html`, `.backgroundContainer`, `.dialog`, `.mainDrawer`, `.nowPlayingPlaylist` |
| `--jf-palette-background-defaultImage` | `none` | `none` | Keep none |
| `--jf-palette-background-paper` | `--jflix-surface-3` | `#202020` | MUI menus/popovers/drawer, `.appfooter`, `.emby-select-withcolor` |
| `--jf-palette-background-paperChannel` | `35 35 35` | `32 32 32` | Drives `.detailRibbon`'s `rgba(… / .8)` in the dark theme |
| `--jf-palette-primary-main` | `--jflix-accent` | `#00a4dc` | `.countIndicator`, `.playedIndicator`, `.fullSyncIndicator`, `.itemProgressBarForeground`, `.button-link`, `.paper-icon-button-light:hover`, active tab |
| `--jf-palette-primary-dark` | `--jflix-accent-active` | `#00729a` | |
| `--jf-palette-primary-light` | `--jflix-accent-hover` | `#33b6e3` | |
| `--jf-palette-primary-hover` | `rgba(225,29,46,.20)` | `rgba(0,164,220,.2)` | |
| `--jf-palette-primary-contrastText` | `#FFFFFF` | `rgba(0,0,0,.87)` | **Must change** — dark text on red fails; white on `#E11D2E` = 4.76:1 |
| `--jf-palette-secondary-main` | `#FFFFFF` | `#00a4dc` | Card focus ring, `.emby-select:focus`, `.raised:focus`, `.show-focus` — white matches the system |
| `--jf-palette-secondary-contrastText` | `--jflix-surface-0` | | |
| `--jf-palette-AppBar-defaultBg` | `--jflix-surface-0` | `#202020` | Scrolled app bar + `.skinHeader-withBackground` |
| `--jf-palette-AppBar-transparentBg` | `transparent` | `rgba(0,0,0,.4)` | Scrim is painted separately on `::before` |
| `--jf-palette-AppBar-gradient` | `none` | `none` | Free gradient slot; left at `none` because we use pseudo-elements (a `background-image` cannot transition) |
| `--jf-palette-text-primary` | `--jflix-text-primary` | `#fff` | |
| `--jf-palette-text-secondary` | `--jflix-text-secondary` | `rgba(255,255,255,.7)` | Also the default `html` colour |
| `--jf-palette-divider` | `--jflix-line-hairline` | `rgba(255,255,255,.12)` | `.listItem-border`, `.emby-collapsible-button` |
| `--jf-palette-action-hover` | `--jflix-overlay-hover` | `rgba(255,255,255,.08)` | `.listItem:hover` |
| `--jf-palette-action-focus` | `--jflix-overlay-press` | `rgba(255,255,255,.12)` | `.listItem:focus` |
| `--jf-palette-error-main` | `--jflix-danger` (`#C62828`, unchanged) | `#c62828` | **Deliberately left at stock** — see §0.3 #12 |
| `--jf-palette-error-light` | `--jflix-danger-text` | `#d15353` | `.itemProgressBarForeground-recording`; the *icon* uses are re-pointed by selector below |
| `--jf-palette-error-contrastText` | `#FFFFFF` | `#fff` | |
| `--jf-palette-FilledInput-bg` | `--jflix-surface-4` | `rgba(255,255,255,.09)` | **Must be opaque** — a translucent field over a backdrop is unreadable |
| `--jf-palette-FilledInput-borderColor` | `--jflix-line-subtle` | *(undeclared — free hook)* | |
| `--jf-palette-Button-inheritContainedBg` | `--jflix-surface-4` | `#424242` | `.raised`, `.fab`, `.btnCancel`, MUI inherit-contained |
| `--jf-palette-Button-inheritContainedHoverBg` | `--jflix-surface-5` | `#616161` | Flat-surface hover; the glass hover is applied by selector on hero buttons only |
| `--jf-palette-SnackbarContent-bg` | `--jflix-surface-3` | `#303030` | `.toast` |
| `--jf-palette-SnackbarContent-color` | `rgba(255,255,255,.92)` | `rgba(255,255,255,.87)` | |
| `--jf-palette-Alert-infoFilledBg` | `#1F2A38` | `#0288d1` | Kills the bright blue banner |
| `--jf-palette-Alert-infoFilledColor` | `#CFE3FF` | `#fff` | |
| `--jf-card-borderRadius` | `8px` | `0.2em` | **px, not em** |
| `--jf-shape-borderRadius` | `4px` | `4px` | MUI surfaces |
| `--jf-overlays-1…24` | `none` | MUI wash | Kills the white elevation overlay on every `Paper` |
| `--jf-shadows-2 / -8` | `--jflix-elev-2` | MUI | Menus/popovers |
| `--jf-shadows-16 / -24` | `--jflix-elev-4` | MUI | Dialogs/drawer |

**Hard-coded values the bridge does NOT reach.** Every one of these must be overridden by selector, or a
piece of Jellyfin blue survives:

| Selector | Stock literal | Source |
|---|---|---|
| `.paperList`, `.visualCardBox`, `.collapseContent`, `.formDialogHeader:not(.formDialogHeader-clear)`, `.formDialogFooter:not(.formDialogFooter-clear)` | `#202020` | `_theme.scss:221-248` (compiled literal, no `var()`) |
| `.cardBox:not(.visualCardBox) .cardPadder` | `#202020` | same — this is why an empty padder reads `rgb(32,32,32)` |
| `.cardPadder .cardImageIcon` | `#202020` | same |
| `.mediaSourceIndicator` | `rgb(51,136,204)` | `card.scss:144-162` |
| `.mdl-slider`, `-background-lower`, `.sliderMarker` | `#00a4dc` | `emby-slider.scss:8,61,81,101,182,275` |
| `.mdl-slider-background-flex` (track) | `rgba(255,255,255,.3)` | `emby-slider.scss:151-169` |
| `.mdl-slider-background-upper` (buffered) | `rgba(255,255,255,.4)` | `emby-slider.scss:205-214` |
| `.sliderBubble` | `#282828` | `emby-slider.scss:223` |
| `.mdl-switch__track`, `__thumb`, `__focus-helper` | `rgba(0,164,220,.5)`, `#00a4dc`, `rgba(0,164,220,.26)` | `emby-toggle.scss:45,79,108` |
| `.mdl-radio__focus-circle` | `#00a4dc` | `emby-radio.scss:103` |
| `.filterButtonBubble` | `#03a9f4`, `z-index:100000000` | `emby-button.scss:162-178` |
| `.starIcon` | `#f2b01e` | keep — retarget to `--jflix-warning` (same value) |
| `.listItemImageButton:hover` | `#00a4dc` | `listview.scss:158-178` |
| `.searchfields-icon` | `#aaa` | `librarybrowser.scss` |
| `.defaultCardBackground1…5` | theme literals | `themes/dark/theme.scss:5-23` |
| Guide programme cells | `#3949ab/#5e35b1/#039be5/#43a047/#1e1e1e !important` | `_theme.scss:505-523` |
| Scrollbar | `#3b3b3b` / `#202020` / `#888` | `_theme.scss:64-67,579-597` |
| Dashboard accents | `#00a4dc !important` | `styles/dashboard.scss:123`, `styles/metadataeditor.scss:49` |
| `.playstatebutton-icon-played`, `.ratingbutton-icon-withrating` | `--jf-palette-error-light` | re-point to `--jflix-success` and `--jflix-accent` respectively |
| `.alphaPicker-fixed-right` | `top: 96px / 144px` (MUI `sx`) | `AlphabetPicker.tsx:36-47` — see §3.1 |
| `.layout-mobile .itemBackdrop` | `margin-top: -48px !important` | `apps/modern/AppOverrides.scss:33-35` — pins the mobile bar at 48 |

### 2.17 Light-theme overrides (`html[data-theme="light"]`)

JellyFlix targets dark as its primary scheme, but a user must never land on a half-styled app. The light
column redefines only the colour tokens; every geometry, motion and z-index token is shared.

| Token | Light value |
|---|---|
| `--jflix-surface-0` | `#F7F7F7` |
| `--jflix-surface-1` | `#F0F0F0` |
| `--jflix-surface-2` | `#E8E8E8` |
| `--jflix-surface-3` | `#FFFFFF` |
| `--jflix-surface-4` | `#E2E2E2` |
| `--jflix-surface-5` | `#D2D2D2` |
| `--jflix-text-primary` | `#0B0B0B` |
| `--jflix-text-secondary` | `rgba(11,11,11,.72)` |
| `--jflix-text-tertiary` | `rgba(11,11,11,.58)` |
| `--jflix-text-quaternary` | `rgba(11,11,11,.46)` |
| `--jflix-text-disabled` | `rgba(11,11,11,.38)` |
| `--jflix-text-on-light` | `#FFFFFF` (the primary button inverts to `--jflix-surface-0` fill on light… see rule below) |
| `--jflix-line-hairline` / `-subtle` / `-strong` | `rgba(0,0,0,.10)` / `rgba(0,0,0,.20)` / `rgba(0,0,0,.42)` |
| `--jflix-line-invert` | `#0B0B0B` |
| `--jflix-overlay-hover` / `-press` / `-selected` | `rgba(0,0,0,.06)` / `rgba(0,0,0,.12)` / `rgba(0,0,0,.10)` |
| `--jflix-accent` | `#C2101F` (5.8:1 on light `surface-0` — legal even as text there) |
| `--jflix-danger-text` | `#B3121F` |
| `--jflix-info` | `#0B5FBF` |
| `--jflix-focus-ring` | `0 0 0 2px #FFFFFF, 0 0 0 4px #0B0B0B` |
| `--jflix-elev-1…4` | same geometry, alpha halved (`.30` / `.22` / `.26` / `.30`) |
| `--jflix-scrim-*` | **unchanged** — artwork is still dark-cropped and text over it is still white |

**Light-specific rules:** the primary button inverts to a `--jflix-surface-0`-on-`#0B0B0B` pairing (dark
fill, white label) so it stays the highest-contrast control on the page; `--jflix-overlay-glass` becomes
`rgba(255,255,255,.78)` with `--jflix-text-on-light` labels; scrims stay dark because they sit on artwork,
not on the page.

The four remaining built-in themes (`appletv`, `blueradiance`, `purplehaze`, `wmc`) inherit the **dark**
colour column and all geometry. They are not individually tuned; this is documented behaviour, not a bug.

### 2.18 TV overrides (`html.layout-tv`)

Root font-size is already 125 % (20 px) on TV, but our type scale is in **px**, so every size must be
re-declared explicitly:

```
--jflix-type-row:      700 28px/1.3  var(--jflix-font);
--jflix-type-h1:       700 48px/1.1  var(--jflix-font);
--jflix-type-h2:       700 32px/1.2  var(--jflix-font);
--jflix-type-body-lg:  400 22px/1.5  var(--jflix-font);
--jflix-type-body:     400 20px/1.5  var(--jflix-font);
--jflix-type-body-sm:  400 18px/1.45 var(--jflix-font);
--jflix-type-button:   600 20px/1    var(--jflix-font);
--jflix-gutter: 5%;  --jflix-row-gap: 56px;  --jflix-tile-gap: 12px;
--jflix-control-h: 56px;  --jflix-icon-md: 28px;  --jflix-icon-lg: 32px;
--jflix-tiles: 6;  --jflix-tiles-wide: 4;
--jflix-zoom-row: 1;          /* stock .card.show-animation:focus scale(1.07) is left untouched */
--jflix-blur: none;
--jflix-focus-ring: var(--jflix-focus-ring-tv);
```

Plus: `html.layout-tv #itemBackdrop{background-attachment:scroll}` (the stock `fixed` forces a
1920×432 repaint every scroll frame on low-end GPUs), no `backdrop-filter`, blur radii capped at 32 px, and
a 5 % overscan inset on all four edges of full-bleed surfaces.

---

## 3. Component specifications

Every recipe lists **rest · hover · focus-visible · active · selected · disabled · TV-focus**.
`:focus-visible` on pointer platforms; **`:focus` under `html.layout-tv`** because the app drives focus
programmatically. `outline: none` without a replacement is banned — and note stock already ships
`.card{outline:none!important}` and `.cardBox{outline:none!important}`, so the focus affordance **must** be a
`box-shadow`.

### 3.1 App bar — modern (`header.MuiAppBar-root`)

**Geometry.** Height `--jflix-bar-h` via `min-height` on `.MuiToolbar-root.MuiToolbar-dense` — the spacer
`header.MuiAppBar-root + div[aria-hidden="true"]` is re-measured by `OffsetAppBar`'s `ResizeObserver` and
follows automatically. **Never fake height with `transform`** — the observer reads the layout box.
Horizontal padding `--jflix-gutter`, written as `[dir="ltr"] header .MuiToolbar-root.padded-left` (0,3,0).

**Two mandatory obligations of raising the bar to 64 px** (fail the DoD if skipped):
1. `.alphaPicker-fixed-right` takes `top: 96px` / `144px` from a hard-coded MUI `sx` prop, **not** from the
   bar measurement. Re-set both by +16 px (expect `112px` / `160px`; verify the live value first).
2. `.layout-mobile .itemBackdrop{margin-top:-48px !important}` pins the **mobile** bar at 48 px. Mobile
   stays 48; do not raise it.

**Scroll state.** The class swap `MuiAppBar-colorTransparent` ⇄ `MuiAppBar-colorDefault` already exists and
is driven by MUI's `useScrollTrigger` reading `document.documentElement.scrollTop` (live-confirmed after a
700 px scroll). A `background-image` gradient **never transitions**, so the scrim lives on a pseudo-element
whose `opacity` transitions. `header` is `position:fixed; z-index:1100`, i.e. a stacking context, so a
`z-index:-1` pseudo paints above the header's own background and below the toolbar.

| State | Background | Scrim `::before` | Shadow |
|---|---|---|---|
| Rest (`colorTransparent`) | `transparent` | `--jflix-scrim-top`, 140 px tall, `opacity: 1`, `pointer-events:none` | none |
| Scrolled (`colorDefault`) | `--jflix-surface-0`, `background-image: none` | `opacity: .35` — **never 0** | `--jflix-elev-1` |

Both transition `--jflix-dur-nav` `--jflix-ease-exit`. Keeping the scrim permanently painted at 35 % makes
the swap a *deepening* rather than a flash; the trigger is binary at `scrollTop > 0` and a 0→1 opacity jump
is visible. `header.MuiAppBar-root.MuiAppBar-colorDefault` is (0,2,1) and beats MUI's emotion rule, killing
the `linear-gradient(rgba(255,255,255,.05),…)` elevation overlay.

**Contents.**

| Element | Rest | Hover | Focus-visible | Active | Selected | Disabled | TV-focus |
|---|---|---|---|---|---|---|---|
| Wordmark slot (`.pageTitleWithDefaultLogo` / server name) | height 26 px, `--jflix-accent`, weight 800, tracking −0.03em, `margin-right: 32px` | — | ring | — | — | — | — |
| Nav link | `--jflix-text-secondary`, `--jflix-type-body`, weight 400, no icon, no underline, `margin-left: 18px` | `--jflix-text-primary`, `--jflix-dur-fast` | `--jflix-focus-ring`, radius 4 px, no bg change | `opacity: .7`, 80 ms | `--jflix-text-primary` + weight 700 **and** a 2 px `--jflix-accent` bar on the item's bottom edge, radius `2px 2px 0 0` | `--jflix-text-disabled`, `pointer-events:none` | ring + `scale(1.04)`, 180 ms |
| Icon button (search / cast / SyncPlay) | 40×40, icon `--jflix-icon-md`, `--jflix-text-secondary` | `--jflix-overlay-hover` circle + `--jflix-text-primary` | ring, offset 2 | `scale(.94)` | — | opacity .4 | ring, bg `--jflix-overlay-hover` |
| Avatar (`header .MuiAvatar-root`) | 32×32, `--jflix-radius-sm` (rounded square, **not** the stock circle), + a 6 px caret `::after` | `--jflix-line-invert` 2 px ring | ring | — | caret rotates 180° | — | ring |

Selected state uses **two channels** (weight + bar) so it survives greyscale and colour-blindness.

### 3.2 App bar — legacy (`.skinHeader`)

Legacy markup is **present in the modern DOM** inside a `display:none` wrapper. It becomes live the moment a
user switches layout, so it gets its own guarded block. The discriminator is
`#reactRoot > .mainAnimatedPages.skinBody` (direct child) — `layout-desktop`/`layout-mobile` do **not**
distinguish modern from legacy.

* `.skinHeader` — `fixed; z-index:999; contain:content`, height 64 desktop / 56 tablet / 48 mobile.
  `.skinHeader-withBackground` → `--jflix-surface-0` + `--jflix-elev-1`.
  `.skinHeader.semiTransparent` → `transparent` + `--jflix-scrim-top` on `::before`; stock already forces
  `backdrop-filter:none !important` — leave it.
* `.headerTabs` / `.emby-tab-button` — `--jflix-type-button`, `--jflix-text-secondary`;
  `.emby-tab-button-active` → `--jflix-text-primary` + 2 px `--jflix-accent` bottom bar.
* `.headroom--unpinned{transform:translateY(-100%)}` is stock and is a transformed ancestor for everything
  inside the legacy header — do not put a `position:fixed` child in there.
* Legacy pages carry `padding: 99.7px 0 74.4px` on `#indexPage`; the gutter is applied by `.padded-*` as in
  modern, so the same `--jflix-gutter` rule covers both.

### 3.3 Drawer (`.mainDrawer` legacy / `.MuiDrawer-paper` modern)

* Rest: `--jflix-surface-1`, `--jflix-elev-4`, no border. Width **80vw, max 360 px** on phone (stock is
  content-width, 191 px @390 — unusably narrow); 240 px docked on the dashboard (unchanged).
* Top corners `--jflix-radius-lg` on phone; square when docked.
* Row: height 48 (56 touch, 64 TV), padding-inline `--jflix-space-4`, icon `--jflix-icon-md` at
  `--jflix-text-tertiary`, label `--jflix-type-body`.
* Hover `--jflix-overlay-hover` · focus-visible ring inset 2 px · active `--jflix-overlay-press` ·
  **selected** `--jflix-overlay-selected` + a 3 px `--jflix-accent` bar on the leading edge + label weight 700
  (stock `.navMenuOption-selected` uses `background … !important` — match it) · disabled opacity .45 ·
  TV-focus `--jflix-surface-3` fill + ring.
* Backdrop `--jflix-scrim-modal`.

### 3.4 Content rows (`.verticalSection`, `.emby-scroller`, `.itemsContainer.scrollSlider`)

`.homeSectionsContainer`, `.verticalSection`, `.detailSection`, `.tagline`, `.overview` and
`.cardFooter-transparent` carry **zero stock CSS** — they are completely free hooks. Spend them.

* **Section:** `margin-bottom: var(--jflix-row-gap)`. Do **not** set `padding-block` unless the
  hover-clearance check in §7 fails — it costs ~72 px × 8 rows ≈ 576 px of page height.
* **Row title** (`h2.sectionTitle`, `.sectionTitleTextButton`): `font: var(--jflix-type-row)`,
  `letter-spacing:-0.006em`, `--jflix-text-secondary`, `padding-inline: var(--jflix-gutter)`,
  `margin-bottom: var(--jflix-row-title-gap)`. Stock `.sectionTitleTextButton` has
  `margin/display/color !important` — match it.
  * Hover on the section: title → `--jflix-text-primary`.
  * A `›` chevron (`.sectionTitleTextButton .material-icons`) fades in on section
    `:hover`/`:focus-within`: `opacity 0→1` + `translateX(0→4px)`, `--jflix-dur-fast`. Only rows that link
    somewhere get the chevron. On touch the chevron is permanently visible.
* **Strip:** `.emby-scroller` gets `padding-inline: var(--jflix-gutter)`. Tile widths per §2.9.
  Never touch `.scrollSlider`'s `transform`/`transition`/`overflow`/`position`.
* **Scroll arrows** (`.emby-scrollbuttons`): stock is `position:absolute; top:0; right:0; min-width:104px;
  z-index:1`, anchored to `.emby-scroller-container` — i.e. to the **whole section including the heading**
  (measured `{1753,48 167×37}` while cards start at y=94). Re-anchor into the card strip:
  * `top: calc(var(--jflix-type-row-block) + var(--jflix-row-title-gap)); bottom: 0; right: 0;`
    `width: var(--jflix-gutter); min-width: 0; padding: 0;`
  * `background: linear-gradient(90deg, transparent, rgba(0,0,0,.62))` (mirror for the left arrow),
    chevron `--jflix-icon-xl` white.
  * Rest `opacity: 0`; `.verticalSection:hover > .emby-scrollbuttons`, and `:focus-within`, → `opacity: 1`,
    `--jflix-dur-fast`. Hover on the arrow itself → `rgba(0,0,0,.78)` + chevron `scale(1.15)` over 100 ms.
  * **Never animate width or position** — only `opacity` and the chevron `transform`.
  * They exist only on desktop with a fine pointer, and only when the row overflows (`.hide` is toggled by
    JS). On touch there are no arrows **and no `.emby-scroller-container` positioning context** — write
    nothing that assumes it.
* **Scroll-snap:** touch only (`scroll-snap-type: x proximity` on the scroller, `scroll-snap-align: start`
  on tiles). Never on desktop — the JS scroller writes `transform` and snapping fights it.
* **Row lift** (enhancement, own rule, `:has()`): every `.scrollSlider` computes an identity
  `transform: matrix(1,0,0,1,0,0)`, so **every desktop row is its own stacking context** and a hovered card
  cannot paint over the next row. Fix:
  ```
  html.layout-desktop .verticalSection:has(.card-hoverable:hover) { position: relative; z-index: 4; }
  html.layout-desktop .verticalSection:has(.card-hoverable:focus-within) { position: relative; z-index: 4; }
  ```
  Two separate rules, never grouped. Keep the subject narrow (`.verticalSection`, never `body`) — a broad
  `:has()` subject invalidates a ~1200-node subtree on every pointer move. On a `:has()`-less TV browser the
  rule is simply dropped, and TV has no hover anyway.

Sizes per tier: desktop title 20/22/24 px · laptop 20 · tablet 18 · phone 16 · TV 28.

### 3.5 Cards / tiles

Jellyfin 12.1 has **two card renderers emitting different DOM for the same visual card**. Both must be
styled:

| Renderer | Emits | Used on |
|---|---|---|
| Legacy string builder (`cardBuilder.js`) | `<a class="cardImageContainer cardContent lazy">` (one element), `<bdi>` inside `.cardText`, inline `background-image` | **the whole home page in both layouts**, favorites, details, Live TV, legacy library pages |
| React (`cardbuilder/Card/*.tsx`) | `.cardContent > .cardImageContainer` (two elements), `<img>` with inline styles | modern library grids (`#/movies`, `#/tv`), suggestions, genres |

The home page is **not** React in 12.1 — `modern-desktop` and `legacy-desktop` produce byte-identical home
markup.

**Geometry.** Width per §2.9 × aspect (2:3 portrait, 16:9 landscape, 1:1 square, circle for person).
`border-radius: var(--jflix-radius-tile)` on `.cardImageContainer`, `.cardContent`, `.blurhash-canvas` and
`.cardPadder` (each hard-codes or inherits `.2em`). Plate background `--jflix-surface-2`.
`overflow: hidden` belongs on the **plate**, never on `.card` (the root must not clip the zoom).
Aspect ratios stay on `.cardPadder`'s `padding-bottom: %` — **do not switch to `aspect-ratio`**
(Chromium 88 / webOS 22 / Tizen 2022).

**Hover zoom — the four unlocks, in order.** Stock desktop hover is *only* `opacity:1` on
`.cardOverlayContainer`; there is no zoom and no lift.

1. **Relax paint containment.** `.card:not(.show-animation){contain: layout style paint}` clips every
   descendant to the border box and guillotines a scaled child.
   Write `.card:not(.show-animation){contain: layout style}` — equal specificity (0,2,0), later in the
   cascade, **no `!important` needed**. Keep `layout style`: it is what keeps a 128-card page cheap.
   **Never write `contain: none`.** Safe because all absolutely-positioned card internals anchor to
   `.cardScalable` (`position:relative`), not to `.card`.
2. **Lift above neighbours.** Removing paint containment also removes `.card`'s stacking context, so a
   neighbour's `.cardIndicators{z-index:1}` would paint over the zoomed tile:
   `.card-hoverable:hover, .card-hoverable:focus-within { position: relative; z-index: 3; }` — above the
   neighbours' 1, below stock `.card:focus{z-index:10!important}` so keyboard focus still wins.
3. **Escape the row** — §3.4's `:has()` section lift.
4. **Remaining clips.** `.emby-scroller` is `overflow: visible` on desktop; `#indexPage.mainAnimatedPage` is
   `contain: style size` (no paint, no clip); `html` is `overflow: visible` so `body{overflow:hidden auto}`
   propagates to the viewport and body itself behaves as `visible`. The only remaining clip is the viewport
   edge, and the gutter is the budget. **Do not "fix" it with `body{overflow-x:visible}`** — that
   re-propagates `visible` and a zoomed edge tile adds a real horizontal scrollbar.

**Scale `.cardBox` and nothing else.** Not `.scrollSlider` (JS owns its transform), not `.cardContent` or
`.cardImageContainer` or `.cardPadder` (all `contain: strict`). `.cardBox` has only `contain: style` and no
stock transform on desktop. `.card-hoverable` exists **only** when `layoutManager.desktop`, so mobile and TV
are excluded for free, and TV's own `.card.show-animation:focus > .cardBox{transform:scale(1.07)}` is
untouched.

| State | Treatment |
|---|---|
| **Rest** | No shadow, no border, `filter: none`. Caption below the tile: title 1 line (`--jflix-type-body-sm`, `--jflix-text-primary`) + year 1 line (`--jflix-type-body-sm`, `--jflix-text-tertiary`), both ellipsised, block height 40 px. |
| **Hover** | `transform: scale(var(--jflix-zoom-row))` on `.cardBox`, `--jflix-dur-base` `--jflix-ease-emphasis`, **delay `--jflix-delay-hover-in`**; `z-index: 3` applied at 0 ms (no transition); `--jflix-elev-3`; overlay fades in at +70 ms over `--jflix-dur-fast`. `transform-origin: center center` (see below). |
| **Hover-out** | Reverse: delay `--jflix-delay-hover-out`, duration `--jflix-dur-hover-out`, `--jflix-ease-exit`. |
| **Focus-visible** | Identical end-state, **0 ms delay**, **plus** `--jflix-focus-ring` on the card root (outside the scaled plate). |
| **Active** | `scale(1.06)`, 80 ms. |
| **Selected** (multi-select / now playing) | `box-shadow: inset 0 0 0 3px var(--jflix-accent)` **and** a 20 px check badge top-left — never the ring alone. |
| **Disabled / unavailable** | `opacity: .45`, `filter: grayscale(.4)`, no transform, `cursor: default`. |
| **TV-focus** | Stock `scale(1.07)` untouched + `--jflix-elev-tv` + `--jflix-focus-ring-tv`; ring radius = `calc(var(--jflix-radius-tile) + 4px)`; caption switches to `--jflix-text-primary`. |

`transform-origin`: `left center` for `:first-child`, `right center` for `:last-child`, `center` otherwise —
but note this only helps at scroll offset 0; once the row is transform-scrolled the leftmost *visible* card
is a middle child. The 76.8 px gutter is the real budget and it is not binding at 1.12.

**Grids** (`.vertical-wrap`, `#/movies`, `#/tv`): `--jflix-zoom-grid: 1.06`. A grid has neighbours above and
below; 1.12 overlaps two rows at once and reads as chaos. **Disable hover-scale entirely when a grid shows
more than 60 tiles** and on `body.dashboardDocument`.

**Card text.** All home rows pass `showTitle:true, showYear:true`. On desktop home rows only:
```
html.layout-desktop .homeSectionsContainer .cardBox > .cardText { opacity: 0; transition: opacity var(--jflix-dur-fast); }
html.layout-desktop .homeSectionsContainer .card-hoverable:hover .cardBox > .cardText,
html.layout-desktop .homeSectionsContainer .card-hoverable:focus-within .cardBox > .cardText { opacity: 1; }
```
Use `opacity`, **never `display:none`** — removing the lines changes `.cardBox` height, the row height and
the hover-zoom budget. Accessibility is preserved: the image anchor carries `role="img"` and a localized
`aria-label`. Grids, mobile, TV and the details page keep captions permanently visible.
There is **no `.cardFooter`** on the home page — target `.cardBox > .cardText`.
Beat `.cardTextCentered{text-align:center !important}` if you left-align.

**Landscape treatment** applies to **Continue Watching, Next Up and My Media only** — those pass
`preferThumb:true` + `getBackdropShape()` and already fetch 16:9 art. **Latest Movies / Latest Shows stay
portrait**: `recentlyAdded.ts` passes `preferThumb:null` + `getPortraitShape()` and the server returns a 2:3
Primary poster (live: `fillWidth=223&fillHeight=335`); forcing 56.25 % on `.coveredImage` crops away 62 % of
the image height and decapitates every poster. CSS cannot change the requested `ImageType`.

### 3.6 Card hover overlay (in-tile)

The shipping form of the expanded hover card. The full flyout is a **non-goal** (§6): the card DOM contains
no synopsis, genre or runtime, the row is a JS-transformed flex line, and the card is paint-contained.

Stock already ships `.cardOverlayContainer`, `.cardOverlayFab-primary` and `.cardOverlayButton-br`, fading at
`opacity .2s`. Restyle them:

* Overlay: `--jflix-scrim-tile-b` over the lower 52 % of the plate, `opacity 0 → 1`, `--jflix-dur-fast`,
  delay `calc(var(--jflix-delay-hover-in) + 70ms)`.
* **Play FAB** (`.cardOverlayFab-primary`): 40 px circle (28 px on tiles < 160 px wide), `#FFF` fill, glyph
  `--jflix-icon-md` in `--jflix-text-on-light`, centred on portrait tiles / bottom-left on landscape.
  Hover `rgba(255,255,255,.80)`, active `scale(.94)`, focus ring offset 3.
* **Action group** (`.cardOverlayButton-br`): up to 3 circles, 28 px, `--jflix-overlay-icon`,
  `1.5px solid rgba(255,255,255,.5)`, white glyph `--jflix-icon-sm`, gap 8 px, bottom-right inset 8 px.
  Hover `border-color:#FFF; background: rgba(42,42,42,.9)`. Stock
  `.cardOverlayButtonIcon{background/size/font-size !important}` — match it.
* Written under `@media (hover:hover) and (pointer:fine)` only. On mobile the stock permanently-visible
  overlay buttons stay, restyled to the same circles at 32 px (touch target padded to 44).

### 3.7 Indicators, badges, progress

Put pseudo-elements on **`.cardScalable`** (`position:relative`, `contain: layout style`, no paint
containment). **Never** on `.cardPadder` or `.cardContent` — both are `contain: strict`.

| Element | Selector | Geometry | Colour |
|---|---|---|---|
| Watch progress (legacy) | `.itemProgressBar` / `.itemProgressBarForeground` | track 4 px **opaque** `--jflix-progress-track`, flush to the plate bottom, `border-radius: 0 0 8px 8px` | fill `--jflix-accent` (3.88:1 against the track). **`width` is inline — leave it.** No transition on the fill. |
| Watch progress (React) | `.itemLinearProgress .MuiLinearProgress-bar` | same | needs `background-color: … !important` (the fill colour is an emotion `sx` hash) |
| Unwatched count | `.countIndicator`, `.unplayedItemCount` | `min-width:20px; height:20px`, `--jflix-radius-circle`, top-right, offset 6 px | `--jflix-text-on-accent` on `--jflix-accent` |
| Watched check | `.playedIndicator` | 20 px circle, top-right | `--jflix-success` fill (re-point from `error-light`) |
| Media source | `.mediaSourceIndicator` | as stock | `--jflix-surface-4` — **hard-codes `rgb(51,136,204)`, must be overridden** |
| Certification pill | `.mediaInfoOfficialRating` | `2px 6px`, `--jflix-radius-xs`, `1px solid var(--jflix-line-strong)` | `--jflix-text-secondary` |
| Quality chip (4K/HDR/DV) | `.mediaInfoItem` | `2px 5px`, `--jflix-radius-xs`, bg `rgba(255,255,255,.14)` | `font: var(--jflix-type-micro)` |
| Filter chip | `.emby-button` in filter bars | h 32, `padding: 0 14px`, `--jflix-radius-pill`, `--jflix-surface-4` | selected `#FFF` bg + `--jflix-text-on-light` **plus** a 14 px check |
| Status dot | — | 8 px circle | `--jflix-success`/`-warning`/`-danger` **plus adjacent text** |
| Filter count bubble | `.filterButtonBubble` | as stock (leave `z-index:100000000`) | `--jflix-accent`, hard-codes `#03a9f4` |

State-driven badges are an **enhancement** (`:has()`, own rule each). The card carries real state as
attributes: `data-type="Series"`, `data-played`, `data-isfavorite`, `data-likes`.
Resolution/HD/4K badges, "NEW" and audio-language badges are **not available to CSS** — no attribute exists.

### 3.8 Home "My media" tiles

`.homeLibraryButton` / the My-media section (`libraryTiles.ts`, `getBackdropShape()`, 16:9).

* Landscape tile, `--jflix-radius-tile`, `--jflix-surface-2` plate, `--jflix-tiles-wide` per row.
* The library name is baked into the artwork *and* rendered as `.cardText`. Keep the `.cardText` line
  visible here (unlike Latest rows) — a library tile with no art must still be readable.
* Overlay the name on the art with `--jflix-scrim-tile-b` over the lower 52 %, `font: var(--jflix-type-h3)`,
  `--jflix-text-primary`, `text-shadow: var(--jflix-text-shadow)`, left-aligned at 12 px.
* Hover: `scale(1.06)` (lower than a poster — these are wide and clip sooner), `--jflix-elev-3`.
  Focus-visible: ring, 0 ms. TV-focus: stock scale + ring.
* Stock `.homeLibraryButton` carries `!important` — match it.

### 3.9 Item detail hero

**Two completely different mechanisms — style both.**

*Desktop / TV:* `.backdropContainer` (fixed, 1920×1080, `z-index:-1`, `contain: size layout style`) >
`.backdropImage` (inline `background-image`, `background-size: cover`), seen through `#itemBackdrop`
(1920×432 = 40vh, `background-attachment: fixed`, **no image of its own**), dimmed by
`.backgroundContainer.withBackdrop` (`opacity:.86`, `contain: strict`).

*Mobile:* `#itemBackdrop` itself carries the `background-image`, with `margin-top:-48px !important`. Its
`::before` top fade is already taken — use `::after`.

**Both backdrop *settings* states must be styled.** `.noBackdropTransparency` is added by `index.js:520`
depending on the user's "Backdrops" / "Details banner" preferences and **is present by default on the test
server**. Write `#itemDetailPage.noBackdropTransparency …` **and**
`#itemDetailPage:not(.noBackdropTransparency) …`.

**Gradient regrade.** Replace the flat 86 % dim with a graded scrim, route-scoped because
`.backgroundContainer` is a full-viewport fixed layer on every route:

```
body:has(#itemDetailPage:not(.hide)) .backgroundContainer.withBackdrop {
  opacity: 1; background-color: transparent;
  background-image:
    linear-gradient(180deg, rgba(11,11,11,.15) 0, rgba(11,11,11,.55) 34vh, #0B0B0B 62vh),
    linear-gradient(90deg, rgba(11,11,11,.85) 0, rgba(11,11,11,.25) 48%, transparent 72%);
}
```
It is `position:fixed`, so the gradient stays pinned while content scrolls — consistent with
`#itemBackdrop`'s `background-attachment: fixed`. The left (90deg) layer applies **only ≥ 1000 px**.
**iOS Safari treats `background-attachment: fixed` as `scroll`**, so the iOS parallax differs — do not build
a layout that depends on it.

This is a `:has()` rule and therefore an enhancement. The **fallback** for `:has()`-less browsers is a
non-scoped, gentler regrade of `.backgroundContainer.withBackdrop` to `opacity: .92` — still an improvement
on stock, still legible on every other route.

**Hero height:** `clamp(360px, min(56.25vw, 78vh), 720px)` desktop; `56vh` laptop; `52vh` tablet;
`44vh` mobile; `62vh` TV. `background-position: 50% 22%` (keeps faces out of the scrim).

**Title ribbon.** `.detailRibbon` is stock an opaque band pinned to the bottom of the hero
(`margin-top:-7.2em; height:7.2em; padding-left:32.45vw`). Float the text on the art instead:
`background: transparent; background-image: none; height: auto; padding-left: var(--jflix-gutter);`
and set `--jf-palette-AppBar-gradient: none` so the base rule contributes nothing.

**Logo.** `.detailLogo` measures `{960,156 480×173}` = `top:10vh; right:25vw; width:25vw` — the **right**
side. Move it bottom-left:
```
.detailLogo { right: auto; left: var(--jflix-gutter); top: calc(40vh - 96px);
              width: min(38vw, 620px); height: 20vh;
              background-position: left bottom; background-size: contain;
              filter: drop-shadow(0 2px 12px rgba(0,0,0,.6)); }
```
Max logo height 180 desktop / 150 laptop / 120 tablet / 96 mobile. It is hidden below 68.75em and on
mobile/TV by stock — re-showing it on mobile is one `display:block`, but its coordinates assume a desktop
hero, so re-position before re-showing. Fallback when no logo art exists: item name at
`--jflix-type-display` (desktop) / `--jflix-type-h1` (mobile).

**Metadata row.** `font: var(--jflix-type-body-sm)`, `--jflix-text-secondary`, `gap: 12px`, items separated
by a 4 px `rgba(255,255,255,.4)` dot (`::before` on siblings). Order: rating · year · runtime ·
certification pill · quality chips.

**Synopsis / overview.** `font: var(--jflix-type-body-lg)`, `--jflix-text-secondary`,
`max-width: min(46ch, 620px)`, `text-shadow: var(--jflix-text-shadow)`.
**Do not change `.overview`'s font-size, width or `-webkit-line-clamp`, and do not change
`.detail-clamp-text`'s clamp value.** `.overview-expand`'s visibility is decided **once**, at render, by
`Math.abs(scrollHeight - offsetHeight) > 2`; changing the type metrics makes "Pokaż więcej" show or hide
wrongly and permanently. CSS cannot fix it; only the JS add-on can (§6).

**Buttons** (`.detailButton`, stock `margin:0 !important; padding:.7em !important` — beat both):

| Variant | Rest | Hover | Focus-visible | Active | Disabled | TV-focus |
|---|---|---|---|---|---|---|
| **Primary** (`.btnPlay`) | `#FFF` bg, `--jflix-text-on-light`, height `--jflix-control-h-lg`, `padding-inline: 24px`, `--jflix-radius-sm`, `font: var(--jflix-type-button-lg)`, glyph 24 px + 8 px gap | `rgba(255,255,255,.80)` | ring | `scale(.98)`, `rgba(255,255,255,.72)`, 0 ms | `rgba(255,255,255,.28)` + `--jflix-text-disabled` | ring + `scale(1.06)` |
| **Secondary** | `--jflix-overlay-glass`, `#FFF` | `--jflix-overlay-glass-hover` | ring | `scale(.98)` | `rgba(109,109,110,.30)` | ring + `scale(1.06)` |
| **Icon circle** (`.btnPlaystate`, `.btnUserRating`, `.btnMoreCommands`) | 42×42, `--jflix-overlay-icon`, `2px solid rgba(255,255,255,.5)`, icon `--jflix-icon-md` | border `#FFF`, bg `rgba(42,42,42,.9)` | ring, offset 3 | `scale(.94)` | opacity .4 | ring + `scale(1.08)` |

`.btnPlay` contains only `div.detailButton-content > span.material-icons.play_arrow` — **no text node**.
The label is `::after { content: var(--jflix-label-play) }`, decorative, sitting next to the button's
existing localized `title`. Selected states: `.playstatebutton-icon-played` → `--jflix-success`;
`.ratingbutton-icon-withrating` → `--jflix-accent`.

**Hero under the bar.** Zeroing the spacer so the hero runs under the app bar requires
`height: 0 !important` and **must be route-scoped**, or `/movies` slides under a 96 px two-row bar:
```
body:has(#itemDetailPage:not(.hide)) header.MuiAppBar-root + div[aria-hidden="true"] { height: 0 !important; }
```
`:has()`-only (the page id is a descendant, the spacer an ancestor-sibling). On a `:has()`-less TV browser
the rule is dropped and the hero starts 64 px lower — **acceptable degradation, documented, not a bug.**

**Buttons must never use `min-width`-less fixed widths.** Polish labels run 20–40 % longer
("Odtwarzaj wszystko" vs "Play all") — `min-width`, `white-space: nowrap`, never `width`.

### 3.10 Episode / list rows (`.listItem`, `listview.scss`)

* Row: `min-height: var(--jflix-list-row-h)` (96 large-image / 56 compact), `gap: 16px`, padding-inline
  `--jflix-gutter`, divider `1px solid var(--jflix-line-hairline)` on the bottom, inset by the thumb width.
* Thumb: 160×90 (16:9), `--jflix-radius-tile`, its own 3 px progress bar (opaque `--jflix-progress-track`
  + `--jflix-accent` fill), centred 24 px play glyph +
  `rgba(0,0,0,.4)` wash on hover.
* Index column: 32 px wide, `font: var(--jflix-type-h3)`, `--jflix-text-quaternary`, right-aligned,
  `font-variant-numeric: tabular-nums`.
* Text: primary `--jflix-type-body` white; secondary `--jflix-type-body-sm` `--jflix-text-tertiary`, clamped
  to 2 lines desktop / **3 lines mobile**. **Undo the stock `display:none` on the episode synopsis below
  50em** — hiding it is a regression for a media server.
* Rest transparent · **hover** `--jflix-overlay-hover` + `--jflix-radius-sm` (bleeding ~12 px past the text
  on both sides) + thumb `scale(1.02)`, `--jflix-dur-fast` · **focus-visible** ring inset 2 px (stock
  `.listItem:focus{border-radius:.2em}` and `:focus .secondary{color:inherit !important}` — match) ·
  **active** `--jflix-overlay-press` · **selected / now playing** `--jflix-overlay-selected` + a 3 px
  `--jflix-accent` bar on the leading edge + title weight 700 · **disabled** opacity .45 ·
  **TV-focus** `--jflix-surface-3` fill + `--jflix-focus-ring-tv` + `scale(1.02)`; the **row**, not the
  thumb, is the focus target.
* Season selector (`.emby-select-withcolor`): `--jflix-surface-4`, `1px solid var(--jflix-line-subtle)`,
  `--jflix-radius-sm`, `padding: .4em 2em .4em .8em`. Stock forces
  `:focus{border-color: --jf-palette-secondary-main !important}` and `[disabled]{background:none!important;
  border-color:transparent!important; color:inherit!important}` — match both.
* **Never `text-overflow: ellipsis` a file path.** Wrap it with `overflow-wrap: anywhere` in
  `--jflix-font-num`.

### 3.11 Cast (`.personCard`, `.detailVerticalSection`)

* Circle art (`--jflix-radius-circle`), `--jflix-tiles` + 2 per row (cast tiles are smaller), plate
  `--jflix-surface-2`.
* `.cardText-first` = name, `--jflix-type-body-sm`, `--jflix-text-primary`, 1 line.
  `.cardText-secondary > bdi > span` = role, `--jflix-type-body-sm`, `--jflix-text-tertiary`, 1 line.
  **Captions always visible here** — a circle of a face with no name is useless.
* Hover `scale(1.06)` + `--jflix-elev-3`; focus-visible ring; TV-focus stock scale + ring.
* The person-card radius must be applied to `.cardImageContainer`, `.cardPadder` and `.blurhash-canvas`
  together or the blurhash placeholder shows square corners during load.

### 3.12 Library grid and filter / sort chrome

* Grid (`.itemsContainer.vertical-wrap`): `padding-inline: var(--jflix-gutter)`, same tile widths as rows
  (the non-`overflow` card classes: `.portraitCard`, `.backdropCard`, `.squareCard`).
  `--jflix-zoom-grid: 1.06`, disabled above 60 visible tiles.
* Captions **always visible** in grids.
* Secondary toolbar row (`.headerTabs`, filter/sort/view buttons): height `--jflix-bar-h-2` (48),
  `--jflix-surface-1` when stuck, `--jflix-z-sticky`, bottom rule `1px solid var(--jflix-line-hairline)`.
* Buttons in it are the **Ghost** variant: transparent, `--jflix-text-secondary`, height
  `--jflix-control-h-sm`, `--jflix-radius-sm`. Hover `--jflix-overlay-hover` + `--jflix-text-primary`;
  focus ring; active `--jflix-overlay-press`; **selected** `--jflix-overlay-selected` +
  `--jflix-text-primary` + a 2 px `--jflix-accent` bottom bar.
* **A–Z rail** (`.alphaPicker-fixed-right`): restyle as a thin translucent rail — width 28 px,
  `background: rgba(0,0,0,.35)`, letters `font: var(--jflix-type-label)` at `--jflix-text-tertiary`,
  hover/selected `--jflix-text-primary`, `--jflix-radius-pill`. **Never `display:none` it** — it is real
  navigation in a 5000-item library. Re-set its hard-coded `top` per §3.1.
* Pagination, shuffle and view-mode controls are restyled, never removed.
* Page padding: stock `.libraryPage{padding-top:7em !important}` (and `7.5em` without a secondary nav,
  `4.6em`/`6.7em` at ≥100em). Recompute against `--jflix-bar-h` + `--jflix-bar-h-2` and write with
  `!important`.

### 3.13 Search

* Input (`.searchfields-icon` hard-codes `#aaa` — override to `--jflix-text-tertiary`):
  height `--jflix-control-h` (44 touch), `--jflix-surface-4` **opaque** fill, `--jflix-radius-sm`,
  `1px solid transparent`, padding-inline 12 px with a 36 px leading icon slot,
  `font: var(--jflix-type-body)`.
* Hover → border `--jflix-line-subtle`. Focus-visible → `2px solid var(--jflix-line-invert)` inset (compensate
  padding by 1 px so the box does not shift) **plus** the ring.
* Result rows follow §3.10; result cards follow §3.5 with captions visible.
* Empty state: `--jflix-type-body-lg` at `--jflix-text-tertiary`, centred, 96 px from the top of the results
  area. Never a red or an alarming treatment — an empty search is normal.

### 3.14 Login and the "who's watching" picker

`#loginPage.page.standalonePage.backdropPage` — legacy markup, free to restyle. Stock forces
`padding-top: 4.5em !important` (`librarybrowser.scss:103-105`) and `padding-bottom: 5em !important`
(`site.scss:119-125`); a full-bleed login needs both overridden.

**Background.** Put the art on `.backdropContainer` (or `--jf-palette-background-defaultImage`), and make
`.backgroundContainer` a wash: `rgba(0,0,0,.55)` + `--jflix-scrim-top` + a bottom
`linear-gradient(0deg, rgba(0,0,0,.8), transparent 30%)`. **Never** on `#loginPage::before` — the page is
`contain: style size !important` and cannot be sized by its children.

**Manual form** (`form.manualLoginForm.margin-auto-x`):
* `background: rgba(0,0,0,.75)`, `--jflix-radius-sm`, `padding: 48px 56px 40px`, `max-width: 450px`,
  `margin: 0 auto`. Below 740 px the card background disappears entirely and the form sits on the page.
  Note `form{max-width:54em}` only applies ≥ 50em — set the width yourself on mobile.
* `h1.sectionTitle` "Logowanie": `font: var(--jflix-type-h2)` at 32 px, `--jflix-text-primary`,
  `margin-bottom: 24px`.
* Fields per §3.15. Submit (`.button-submit.block`) is the **white Primary**, full width, height
  `--jflix-control-h-lg`.
* Secondary stack (`.readOnlyContent > .raised.cancel.block`): the **Secondary** variant, full width,
  `--jflix-field-gap` apart. `#loginPage .readOnlyContent` carries an inline `margin:.5em auto 1em` and
  `max-width:54em` ≥50em.
* `.loginDisclaimer`: `font: var(--jflix-type-label)`, `--jflix-text-tertiary`, centred, `margin-top: 24px`.

**"Who's watching" picker** (`.visualLoginForm > #divUsers.itemsContainer.vertical-wrap.centered`):
* Full-viewport `--jflix-surface-0` when no backdrop; content vertically centred.
* Heading `h1`: `clamp(24px, 3.5vw, 56px)`, weight 400 (**not** bold), `--jflix-text-primary`,
  `margin-bottom: 32px`.
* Avatar tile: square `clamp(84px, 10vw, 200px)`, `--jflix-radius-tile`, `3px solid transparent`,
  plate `--jflix-surface-2`. Hover/focus-visible → `border-color: #FFF` + `scale(1.04)`,
  `--jflix-dur-base`. Focus-visible also gets the ring. TV-focus → ring + `scale(1.06)`.
* Name: `margin-top: 12px`, `font: var(--jflix-type-body)`, `--jflix-text-tertiary`,
  hover `--jflix-text-primary`, centred, 1 line ellipsised.
* Grid gap `clamp(16px, 2vw, 32px)`, wraps above 5 users.
* Mode discriminators (enhancement, own rule each):
  `#loginPage:has(.visualLoginForm:not(.hide))` and `#loginPage:has(.manualLoginForm:not(.hide))`.
  The `.hide` class is the app's mode switch — **never write a rule that can resurrect it**.

### 3.15 Forms, dialogs, menus, toasts

Deliberately **not** a clone of the reference — the reference has almost no forms, and a media server is
mostly settings.

**Text / select / textarea** (`.emby-input`, `.emby-select`, `.emby-textarea`, `.MuiFilledInput-root`):
* Height `--jflix-control-h` (44 on `pointer: coarse`, `--jflix-control-h-dense` in compact),
  fill `--jflix-surface-4` (**opaque** — the stock `rgba(255,255,255,.09)` over a backdrop is unreadable),
  `--jflix-radius-sm`, padding-inline 12, `font: var(--jflix-type-body)`, `1px solid transparent`.
  Stock forces `outline:none !important` and `margin-bottom:0 !important` — match both.
* **Label always visible, above the field** (`.inputLabel`, `.selectLabel`, `.MuiInputLabel-root`):
  `font: var(--jflix-type-label)`, `--jflix-text-secondary`, `margin-bottom: 6px`.
  **No floating labels** — they collide with long Polish labels and are lost on autofill. For MUI's filled
  variant this means neutralising the `translate`/`scale` transform on `.MuiInputLabel-filled` and
  removing the field's reserved top padding.
* Helper text: `font: var(--jflix-type-label)`, `--jflix-text-tertiary`, `margin-top: 6px`. MUI forces
  helper text to `1rem` in the base theme — override.
* Hover → border `--jflix-line-subtle`. **Focus-visible** → `2px solid var(--jflix-line-invert)` inset
  (compensate padding by 1 px) + the ring; label → `--jflix-text-primary`. Typing → `--jflix-surface-5`.
* **Error** → `2px solid var(--jflix-danger-text)`, helper text `--jflix-danger-text` prefixed with a 16 px
  warning icon (never colour alone), `aria-invalid` respected via `.Mui-error`.
* **Disabled** → fill `rgba(255,255,255,.04)`, text `--jflix-text-disabled`, no border, `cursor: not-allowed`.
* `.selectArrow` → `--jflix-text-tertiary`; `.emby-select-withcolor > option` → `--jflix-surface-3`.

**Checkbox** (`.checkboxOutline` + `.checkboxIcon`): 20×20 box, `2px solid var(--jflix-line-strong)`,
`--jflix-radius-xs`; **checked = `#FFF` fill + `--jflix-text-on-light` glyph — not red**, or "checked" reads
as "error". `.checkboxIcon{color:#fff}` is hard-coded and must be overridden. Hit area padded to 44×44.
Stock toggles the checked icon with `display:flex !important`.

**Radio**: 20 px circles; `.mdl-radio__focus-circle` hard-codes `#00a4dc` — override to
`--jflix-overlay-press`.

**Toggle** (`.mdl-switch__track` / `__thumb` / `__focus-helper`, **no `--jf-` vars at all**): track 36×20
`--jflix-surface-5`, checked `--jflix-success`; knob 16 px `#FFF`, `translateX(16px)`, 160 ms. Checked state
also carries an on/off text label.

**Slider** (`.mdl-slider*`, **no `--jf-` vars**): track 4 px `rgba(255,255,255,.28)`, fill `#FFF` (accent only
in the player), knob 12 px → 16 px on hover/active, ring around the knob on focus.
`::-webkit-slider-thumb` and `::-moz-range-thumb` **must be two separate rules** — one invalid pseudo kills
the whole selector list. `.mdl-slider-background-lower/-upper` have inline `width`/`left` — colour only.

**Dialog** (`.dialog`, `.MuiDialog-paper`, `.formDialogHeader/Footer`):
`--jflix-surface-3`, `--jflix-radius-md`, `--jflix-elev-4`, `max-width: 560px` (720 px for metadata
editors), padding 24, title `--jflix-type-h2` + 16 px gap, actions right-aligned `gap: 8px` at
`--jflix-control-h-lg`. Backdrop `--jflix-scrim-modal`; `backdrop-filter: var(--jflix-blur)` **only** under
the §2.11 gate. `.formDialogHeader`/`.formDialogFooter`/`.collapseContent` hard-code `#202020` — override.
**Below 600 px a dialog becomes a bottom sheet:** full width, `--jflix-radius-lg` top corners, a
36×4 px `rgba(255,255,255,.3)` grab handle, `max-height: 88vh`, enters with `translateY(16px)`
`--jflix-dur-dialog` `--jflix-ease-enter`.

**Menu / popover** (`.MuiMenu-paper`, `.MuiPopover-paper`, `.actionSheet`):
`--jflix-surface-3`, `--jflix-radius-md`, `--jflix-elev-2`, `1px solid var(--jflix-line-hairline)`,
item height 40 (48 touch, 56 TV), padding-inline 16, `font: var(--jflix-type-body)`.
Hover `--jflix-overlay-hover`; selected `--jflix-overlay-selected` + a leading 16 px check;
**focus-visible = hover state plus the ring** (menus are keyboard-driven; colour alone is not enough).
Remember §2.16: the elevation wash comes from inline `--Paper-overlay` and is killed by
`--jf-overlays-*: none` on `:root`, not by a `.MuiPaper-root` rule.

**Snackbar / toast** (`.toast`, `.MuiSnackbarContent-root`): `--jflix-surface-3`, `--jflix-radius-md`,
`--jflix-elev-2`, min-height 48, padding `12px 16px`, `font: var(--jflix-type-body)`, action label
`--jflix-info`. Never auto-dismiss under 5 s when it carries an action.

**Tooltip**: `--jflix-surface-4`, `--jflix-radius-xs`, `font: var(--jflix-type-body-sm)`, padding `6px 10px`,
delay-in 500 ms / out 0. Suppressed on touch and TV.

**Info banner** (`.infoBanner`): `--jf-palette-Alert-infoFilledBg` → `#1F2A38`, text `#CFE3FF`,
`--jflix-radius-sm`, 3 px `--jflix-info` leading bar.

### 3.16 Player OSD

The whole video OSD is **legacy markup** (plain HTML + `classList` toggles) in every layout — modern and
legacy produce the same `#videoOsdPage`. `AppToolbar` returns `null` on `/video`, but the OSD reuses
`.paper-icon-button-light`, `.material-icons` and `.emby-button` — **never restyle those globally**; scope
global button work under `.skinHeader`, `.mainDrawer`, `.cardOverlay*`, `.detailButton`.

* **Top bar** (`.skinHeader.osdHeader`): `--jflix-scrim-top` 120 px, back button 48×48 icon 24,
  title `font: var(--jflix-type-row)` 16 px from the back button, right-side icons 48×48.
* **Bottom shelf** (`.videoOsdBottom`): replace the stock
  `linear-gradient(0deg, rgba(16,16,16,.75), rgba(16,16,16,0))` with `--jflix-scrim-osd-b`, 180 px tall,
  `padding-bottom: 24px`. `pointer-events:none` on the shelf and `all` on `.osdControls` is stock — keep it.
  Content inset `--jflix-gutter`.
* **Scrubber** (`.osdPositionSlider` + `.mdl-slider-background-*`):
  track `.mdl-slider-background-flex` **4 px idle → 8 px on hover/focus** (`--jflix-dur-base`),
  `--jflix-radius-xs`, **opaque `--jflix-progress-track`** (the OSD sits over video — a translucent track
  makes the red fill unreadable on a bright frame); buffered `.mdl-slider-background-upper`
  `rgba(255,255,255,.45)`; played `.mdl-slider-background-lower` **`--jflix-accent`**.
  Knob: 0 px idle → 14 px on hover → 16 px active, `#FFF`. `.mdl-slider-hoverthumb` exists only when not
  mobile; `.mdl-slider.show-focus` only on TV.
  **Hit area 20 px tall regardless of visual height** — pad with a transparent `::before`.
  `.sliderBubble` (hard-codes `#282828`) → `--jflix-surface-3`, `--jflix-radius-md`, `--jflix-elev-2`;
  `.chapterThumbWrapper` has inline `width`/`height`/`background-position` — **decorate only** (border,
  radius, shadow). `.sliderMarker` chapter ticks: 2×12 px, watched `--jflix-accent`, unwatched
  `rgba(255,255,255,.3)`; `left` is inline.
* **Transport**: 48×48 buttons, icon `--jflix-icon-xl` (28), `gap: 24px` desktop / 16 mobile;
  play/pause 56×56 icon 32. `.osdTimeText` carries `margin-right: auto` and is the flex spacer that pushes
  the right cluster to the edge — **changing it reflows the whole row**.
  Times use `--jflix-font-num` + `tabular-nums` + a fixed width so the layout does not jitter per frame.
  `.osdTitle` is **always empty in 12.1** — `display: none` it.
* **States**: hover → icon `#FFF` + `--jflix-overlay-hover` circle; focus-visible → ring; active
  `scale(.92)` 80 ms; **selected** (e.g. subtitles on) → icon `--jflix-accent` **plus** a 4 px dot beneath;
  disabled → opacity .35.
* **Auto-hide**: `--jflix-dur-osd` (3000 ms) then `opacity → 0` over 200 ms `--jflix-ease-exit`
  (`.videoOsdBottom-hidden`; `.hide` is added on `transitionend`). Suppressed while paused, while a menu is
  open, while the pointer is over the OSD, and **while `:focus-visible` is inside it**.
  Cursor hides with the OSD (`body.mouseIdle` already forces `cursor:none !important`).
* **Responsive**: stock hides parts at 30em (`.btnUserRating`, `.osdMediaInfo`, `.osdPoster`), 43em
  (`.volumeButtons`), 50em (`.btnFastForward`, `.btnRewind`), 75em (`.endsAtText`) — all
  `display:none !important`. Do not fight these; restyle what remains.
* **TV**: transport 64×64, icons 36, track 6 px / knob 20 px, times 24 px, OSD **never auto-hides** while a
  D-pad focus is inside it, focused control gets `--jflix-focus-ring-tv` + `--jflix-surface-3` fill.

### 3.17 Up-next and skip-segment buttons

* **Skip Intro / Outro** (`.skip-button-container > .skip-button`, injected into `document.body`):
  bottom-right, inset `6vh` from the bottom and `--jflix-gutter` from the right, `padding: .6em 1.5em`,
  `font: var(--jflix-type-button-lg)`, `--jflix-radius-sm`, `background: rgba(255,255,255,.9)`,
  `color: var(--jflix-text-on-light)`; hover `#FFF`; focus-visible ring; active `scale(.98)`.
  Enters with `opacity 0→1` + `translateY(8px→0)` over 200 ms `--jflix-ease-enter`.
* **Up next** (`.upNextContainer.upNextDialog`, `.upNextDialog-hidden`): same corner, `--jflix-surface-3`
  at `rgba(35,35,35,.92)`, `--jflix-radius-md`, `--jflix-elev-4`, `max-width: 420px`, padding 16.
  `h2.upNextDialog-nextVideoText` `font: var(--jflix-type-label)` `--jflix-text-tertiary`;
  `h3.upNextDialog-title` `font: var(--jflix-type-h3)` `--jflix-text-primary`;
  `.upNextDialog-mediainfo` `font: var(--jflix-type-body-sm)` `--jflix-text-tertiary`.
  `.btnStartNow` is the white **Primary**; `.btnHide` is **Ghost**.
  A `rgba(255,255,255,.14)` countdown block grows `width: 0 → 100%` behind the label — **only if a duration
  is available in CSS**; otherwise omit it (do not fake a timing the theme cannot know).
  TV auto-focuses `.btnStartNow` — it must show `--jflix-focus-ring-tv`.

### 3.18 Admin dashboard (readable, not gaudy)

Scope everything with **`body:not(.dashboardDocument)`** for the glamour rules and
**`body.dashboardDocument`** for the dense ones — plain classes, (0,2,0)+, works on every TV. Legacy
dashboard pages additionally carry `.type-interior`, which makes `autoThemes` swap to the dashboard theme.

* `--jflix-density: compact` (§2.15): control height 36, list rows 40, body 13 px, gutter
  `clamp(16px,2vw,32px)`, table cells `6px 12px`.
* **Hover-scale disabled entirely.** A zooming settings tile reads as a bug.
* Panels: `--jflix-surface-1` with `1px solid var(--jflix-line-hairline)` rules, `--jflix-radius-sm`,
  `--jflix-elev-0`. `.paperList`, `.visualCardBox` and `.collapseContent` hard-code `#202020` — override.
* Docked drawer stays 240 px, `--jflix-surface-1`.
* Tables: header row `--jflix-surface-1` sticky at `--jflix-z-sticky`, zebra `rgba(255,255,255,.02)`,
  hover `--jflix-overlay-hover`.
* **Buttons:** `.button-submit` is the white Primary everywhere (this is what removes the red/red
  collision); `.button-delete` stays `--jflix-danger` (`#C62828`) filled — the **only** filled red button in
  the product. `.raised.cancel` is Secondary.
* Override the dashboard's own `#00a4dc !important` accents (`styles/dashboard.scss:123`,
  `styles/metadataeditor.scss:49`) to `--jflix-accent`.
* Scrims, hero gradients, tile zoom and the transparent app bar are **not** applied here: the dashboard app
  bar is solid `--jflix-surface-0` from scroll position 0.

---

## 4. Motion and interaction rules

### 4.1 Hover choreography (desktop tile — the signature interaction)

| Phase | Delay | Duration | Easing | Property |
|---|---|---|---|---|
| Hover-in, plate | `--jflix-delay-hover-in` (250 ms) | `--jflix-dur-base` (200 ms) | `--jflix-ease-emphasis` | `transform: scale(var(--jflix-zoom-row))` on `.cardBox` |
| Hover-in, elevation | 250 ms | 200 ms | `--jflix-ease-emphasis` | `box-shadow: var(--jflix-elev-3)` |
| Hover-in, stacking | **0 ms, no transition** | — | — | `z-index: 3` on `.card-hoverable` |
| Hover-in, overlay | 320 ms | `--jflix-dur-fast` (120 ms) | `--jflix-ease-enter` | `opacity 0→1` on scrim + action buttons + `.cardText` |
| Hover-out, all | `--jflix-delay-hover-out` (90 ms) | `--jflix-dur-hover-out` (160 ms) | `--jflix-ease-exit` | reverse |

The asymmetric 250/90 ms delay is what stops a row flickering as the pointer sweeps across it. Without the
in-delay the interaction is unusable at 8–10 tiles/second. **`:focus-visible` reaches the same end-state
with 0 ms delay** — keyboard users must never wait.

### 4.2 Other choreography

* **App bar** transparent → solid: `background-color` `--jflix-dur-nav` `--jflix-ease-exit`; scrim
  `opacity 1 → .35` over the same. The trigger is binary at `scrollTop > 0`; the permanent 35 % scrim hides
  the seam.
* **Row chevron**: `opacity 0→1` + `translateX(0→4px)`, `--jflix-dur-fast`, on section `:hover`/`:focus-within`.
* **Row arrows**: `opacity 0→1` `--jflix-dur-fast`. **Never animate width or position.**
* **Dialog**: `opacity 0→1` + `scale(.97→1)` `--jflix-dur-dialog` `--jflix-ease-enter`; backdrop `opacity`
  200 ms.
* **Menu**: `opacity` + `scale(.98→1)`, `--jflix-dur-base`, origin at the anchor.
* **Progress bar fill**: **no transition** — `width` is set inline by JS and animating it lags the seek bar.
* **Player OSD**: fade out after `--jflix-dur-osd`, 200 ms, per §3.16.
* **Pressed feedback is 0 ms in, animated out.** Press is instant; release eases.
* Colour and border changes use `--jflix-ease-exit`; motion, size and panel changes use `--jflix-ease-enter`.

### 4.3 Focus-visible ring

```
--jflix-focus-ring: 0 0 0 2px var(--jflix-surface-0), 0 0 0 4px #FFFFFF;
```
Applied via `box-shadow` so it follows `border-radius`, with a matching
`outline: 2px solid transparent; outline-offset: 2px` for **Windows High Contrast Mode**, where `box-shadow`
is dropped. Ring radius = element radius + ring width. Stock ships
`.card{outline:none !important}` and `.cardBox{outline:none !important}`, so `box-shadow` is the only
vehicle on cards, and the ring goes on the **card root**, outside the scaled plate.

`:focus-visible` only on pointer platforms. **`html.layout-tv` uses `:focus`** because the app drives focus
programmatically, and `.show-focus` is the stock marker class for "draw a ring here" (54 elements carry it
on the TV home page). `outline: none` without a replacement is banned.

### 4.4 `prefers-reduced-motion`

```
@media (prefers-reduced-motion: reduce) {
  :root { --jflix-zoom-row: 1; --jflix-zoom-grid: 1;
          --jflix-dur-base: 1ms; --jflix-dur-dialog: 1ms; --jflix-dur-hero: 1ms;
          --jflix-dur-nav: 1ms; --jflix-delay-hover-in: 0ms; --jflix-dur-fast: 100ms; }
  * { animation-duration: .01ms !important; animation-iteration-count: 1 !important;
      transition-duration: .01ms !important; }
}
```
Custom properties must be redeclared on a **selector** (`:root`), not in a bare `@media` block.

**Replacement affordance when scale is off** (hover must still be legible): the tile gains
`outline: 2px solid rgba(255,255,255,.9); outline-offset: -2px` and `filter: brightness(1.12)` on hover.
**The focus ring is never suppressed by reduced-motion.** Opacity-only feedback survives, capped at 100 ms.

### 4.5 TV focus states

* `:focus`, not `:focus-visible`. `--jflix-focus-ring-tv` (3 px contour + 7 px white).
* Card: stock `scale(1.07)` is left untouched; we add the ring and `--jflix-elev-tv`
  (`0 0 0 4px surface-0, 0 12px 32px rgba(0,0,0,.8)` — no large blur radii).
* List row: the **row** is the focus target, `--jflix-surface-3` fill + ring + `scale(1.02)`.
* Form field: focus paints the **whole field** `--jflix-surface-3` + 3 px ring — a 2 px border is invisible
  at 3 m.
* Minimum focusable height 48 px, 16 px apart.
* Stock TV behaviour that must survive: `.emby-button.show-focus:focus{transform:scale(1.2)}`,
  `.emby-tabs` TV focus `!important` rules, `.card:focus{position:relative!important; z-index:10!important}`.
  **Test the `tv` profile specifically** — a TV user with no focus ring cannot navigate at all.

---

## 5. Accessibility rules

### 5.1 Contrast targets

| Content | Minimum |
|---|---|
| Body text ≤ 18.5 px, or < 24 px non-bold | **4.5:1** |
| Large text (≥ 24 px, or ≥ 18.66 px bold) | **3:1** |
| UI component boundaries, icons, focus ring, progress bars | **3:1** |
| Text over artwork | **4.5:1 against the scrim composite**, worst-case white art |
| Accent as text | **forbidden on every surface** |

**Exact pairs that must be verified before the theme ships** (compute, do not eyeball):

| # | Foreground | Background | Required | Expected |
|---|---|---|---|---|
| 1 | `--jflix-text-primary` | `--jflix-surface-0` | 4.5 | 19.68 ✓ |
| 2 | `--jflix-text-secondary` | `--jflix-surface-0` | 4.5 | 10.22 ✓ |
| 3 | `--jflix-text-tertiary` | `--jflix-surface-2` | 4.5 | 6.14 ✓ |
| 4 | `--jflix-text-tertiary` | `--jflix-surface-4` (helper text in a field) | 4.5 | 5.53 ✓ — the tightest text pair |
| 5 | `--jflix-text-quaternary` | `--jflix-surface-2` | 3.0 (large only) | 4.31 ✓ · **fails 4.5, so ≥24 px / ≥18.66 px bold only** |
| 6 | `--jflix-text-on-accent` (`#FFF`) | `--jflix-accent` | 4.5 | 4.75 ✓ — **do not darken the accent further** |
| 7 | `--jflix-text-on-light` | `#FFFFFF` (primary button) | 4.5 | 19.68 ✓ |
| 8 | `#FFFFFF` | `--jflix-overlay-glass` over `--jflix-surface-0` | 4.5 | 8.11 ✓ |
| 9 | `--jflix-accent` (component boundary) | `--jflix-surface-2` | 3.0 | 3.58 ✓ |
| 10 | `--jflix-accent` (progress fill) | `--jflix-progress-track` (**opaque** `#141414`) | 3.0 | 3.88 ✓ — with the translucent track both lenses proposed this is **1.42 ✗** |
| 11 | `--jflix-danger-text` | `--jflix-surface-3` | 4.5 | 5.66 ✓ |
| 12 | `--jflix-info` | `--jflix-surface-0` | 4.5 | 7.88 ✓ |
| 13 | `--jflix-success` | `--jflix-surface-0` | 3.0 (icon) | 10.11 ✓ |
| 14 | `--jflix-text-primary` | scrim composite over **pure-white artwork** (0.72 alpha) = `rgb(71,71,71)` | 4.5 | 9.23 ✓ |
| 15 | Focus ring white | `--jflix-surface-0` **and** a bright poster | 3.0 both | ✓ via the two-layer ring |
| 16 | Light: `--jflix-text-secondary` | light `--jflix-surface-0` | 4.5 | 7.88 ✓ |
| 17 | Light: `--jflix-accent` | light `--jflix-surface-0` | 3.0 | 5.79 ✓ |

Rows 5, 6 and 10 are the three that break if a value is nudged "just a little" — treat them as locked.

### 5.2 Hit targets

| Context | Minimum | Spacing |
|---|---|---|
| Touch (`pointer: coarse`) | **44 × 44 px** | 8 px |
| Mouse (`pointer: fine`) | 32 × 32 px (24 × 24 absolute floor) | 4 px |
| TV / D-pad | 48 px tall, full row width where possible | 16 px |

Small icons keep their visual size; the target grows with transparent padding or
`::before { position: absolute; inset: -N }` (write `top/right/bottom/left`, not `inset` — Tizen 2021 lacks
the shorthand). The player scrubber is the canonical case: 4 px visual, 20 px hit.

### 5.3 Other rules

* **Never encode state in hue alone.** Every `selected`, `error`, `success` and `now-playing` state in §3
  carries a second channel — weight, bar, icon, or text.
* `prefers-reduced-transparency`: swap `--jflix-overlay-glass` → `--jflix-surface-4`, kill `backdrop-filter`,
  raise every scrim stop by 0.1 alpha.
* `prefers-contrast: more`: `--jflix-text-secondary` → `.88`, `--jflix-text-tertiary` → `.72`,
  `--jflix-line-hairline` → `.20`, focus ring → 3 px, all scrims +0.12 alpha.
* `forced-colors: active`: drop all gradients and shadows, use `Canvas`/`CanvasText`/`Highlight`, keep layout.
* Minimum body text 13 px; never below 11 px; micro labels are never the only carrier of information and are
  reserved for ASCII-ish tokens (4K, HDR, CC, PL-16).
* Line-height never below 1.4 for running text; paragraph spacing ≥ 0.75 × font-size.
* Text must survive **200 % zoom and 320 px width with no horizontal page scroll**. All containers use
  `max-width`, never fixed `width`. The tile strip is the only intentional horizontal scroller.
* **Do not remove focusable affordances** for visual cleanliness — the A–Z rail, filter/sort/view controls,
  pagination and shuffle are restyled, never hidden.
* Icon-only buttons rely on the markup's existing localized `title`/`aria-label`. A
  `::after { content: "Play" }` label is decorative, exposed to screen readers as content, and is **never**
  the only label source. Every injected string is a `--jflix-label-*` variable (§2.14).
* `body{overflow-y: scroll}` (or `html{scrollbar-gutter: stable}`) — an upstream bug means `.force-scroll` is
  never added to `body`, so the desktop scrollbar appears and disappears between pages and the layout shifts
  ~15 px. Fix it; it is a one-line accessibility win.

---

## 6. Non-goals, impossible-in-CSS, and the optional JS add-on

### 6.1 Impossible with Custom CSS (do not attempt)

| Feature | Why |
|---|---|
| **Home billboard / hero spotlight** | No hero element exists anywhere in `.homeSectionsContainer`. |
| **Expanded hover card with synopsis, genres, runtime** | The text is not in the card DOM; CSS cannot fetch. |
| **Hover trailer / preview playback** | No `<video>` in the card DOM. |
| **"Match %"** | No such concept in Jellyfin; `.starRatingContainer` is the only stand-in. |
| **740 ms slider paging** | JS owns `.scrollSlider`'s `transition` (0.05 s / 0.27 s) and its paging maths reads a cached `offsetWidth`. Touching it desyncs `emby-scrollbuttons`. |
| **Row grows taller on hover, neighbours slide sideways** | Same reason — it fights `lib/scroller`'s cached geometry. |
| **Search icon expanding into an inline field** | It is a route change to `#/search`, not a toggle. |
| **Nav collapsing to a "Browse ▾" menu below 900 px** | Below `md` the nav is **not rendered at all** (`AppToolbar/index.tsx:52`). |
| **Mobile bottom tab bar** | No elements to move; Jellyfin uses a left drawer. |
| **Episode-number circle** ("1. Pilot" → ⑴ Pilot) | The number and title are **one text node**. |
| **Per-row theming by name** ("Trending Now" vs "My List") | CSS cannot match text. Only the slot index (`.section0`…`.section9`, `MAX_SECTIONS = 10`) is addressable. |
| **Resolution / HD / 4K / "NEW" / audio-language badges on cards** | No corresponding attribute exists in the card DOM. |
| **Gradual (non-binary) app-bar scrim ramp on TV** | `animation-timeline: scroll()` is Chromium 115+ / Safari 26+ and exists on **no** TV engine. |
| **Fixing "Pokaż więcej"** | `.overview-expand`'s visibility is decided once at render by a DOM measurement. CSS cannot re-trigger it — hence the §3.9 rule not to touch `.overview`'s type metrics. |

### 6.2 Enhancements (own rule each, must degrade silently)

| Enhancement | Support floor | Degradation |
|---|---|---|
| `:has()` row lift, badge state, hero scoping, spacer zeroing | Chromium 105 / webOS 24 / Tizen 2023 | Rule dropped; layout intact, hero starts 64 px lower, no state badges |
| `animation-timeline: scroll(root block)` gradual scrim, behind `@supports (animation-timeline: scroll())` | Chromium 115 | Binary swap, which ships as the real behaviour |
| `backdrop-filter` on dialogs | gated to `(hover:hover) and (pointer:fine)` + `:not(.layout-tv)` | Solid `--jflix-surface-3` |
| Top-10 outlined numerals (`:nth-child(1..10)` + literal `content`) | universal, but **off by default** | — |

**Never use:** `color-mix()` (effectively no TV — hard-code the mixed value) · CSS nesting · `@container` ·
`@property` for anything load-bearing · flex `gap` (keep the stock `margin-right`) · `aspect-ratio` for
layout (keep `padding-bottom: %`) · the `inset` shorthand · unprefixed `mask-image` without
`-webkit-mask-image` first · `text-wrap: balance` for anything but cosmetics.

`scroll(root block)` **is** the correct timeline here despite `body{overflow: hidden auto}`: `html` computes
`overflow: visible`, so body's value propagates to the viewport and the **document** scrolls — confirmed by
MUI's `useScrollTrigger` (which reads `document.documentElement.scrollTop`) firing the `colorDefault` swap.

### 6.3 Top-10 numerals — ship, but off by default

Use `:nth-child(1..10)` with **literal `content`**, never CSS counters: `.card` and `.cardBox` both carry
`contain: style`, which scopes counters to the subtree, so `counter(rank)` is a coin flip.

```
.homeSectionsContainer > .sectionN .cardScalable::before {
  position: absolute; left: -.34em; bottom: -.06em; z-index: 2;
  font: 900 7.5rem/.78 "Arial Black", var(--jflix-font);
  color: var(--jflix-surface-0); -webkit-text-stroke: 3px var(--jflix-line-strong);
  paint-order: stroke fill;
}
```
**Which row gets numbered has no CSS answer.** Ship it commented out with a documented convention: "put the
row you want numbered in home-section slot N via `#/mypreferenceshome`". Note `.section6` is the Latest-media
host with its `.verticalSection` class removed; address its children as
`.section6 > .verticalSection:nth-of-type(1)`.

### 6.4 The optional JS add-on

There is **no custom-JS hook anywhere in jellyfin-web 12.1** (`grep -rn "CustomJs\|customJs"` → 0 hits). Any
JS must be injected outside the app: a **userscript** (recommended default — per-client, opt-in, survives
upgrades), an nginx `sub_filter`, a bind-mounted patched `index.html` (breaks on every update), or a
file-transformation server plugin.

**The add-on is strictly additive. If it does not load, the CSS theme must still be a complete, coherent
theme. Nothing in §3 may depend on it.**

Ranked by value unlocked per line of JS:

1. **Row tagging (12 lines) — the highest-leverage item.** Write `data-jfx-row` onto every
   `.verticalSection` from its `h2.sectionTitle` text, via a `MutationObserver`. This unlocks per-row CSS
   (`[data-jfx-row^="filmy"]`, `[data-jfx-row="do-obejrzenia"]`) and lets Top-10 numbering target a *named*
   row instead of a slot index. Plain attribute selectors work on every TV back to Chromium 38.
2. **Home billboard / spotlight.** Prepend a `.jfx-hero` element to `.homeSectionsContainer`, built from
   `ApiClient.getItems(...)` with `Fields: 'Overview,Genres,BackdropImageTags,ImageTags'`, containing a
   scrim div, a logo `<img>` (or an `<h1>` fallback), a clamped overview and two action links. **All `.jfx-*`
   styling lives in the same Custom CSS file** — the add-on supplies structure, the theme supplies looks.
   Pair with §3.9's spacer-zeroing rule. Must re-run on `hashchange` because `viewManager` keeps `#indexPage`
   in the DOM with `.hide` and re-fills it.
3. **Metadata onto cards → a CSS-rendered hover panel.** JS writes
   `data-jfx-overview` / `data-jfx-genres` / `data-jfx-runtime`; CSS renders them with `content: attr()`.
   This is the only route to an expanded hover card, and it keeps 100 % of the styling in CSS.
4. **Gradual app-bar ramp with universal support.** `--jflix-scroll: 0…1` written on
   `document.documentElement` from a passive scroll listener; the CSS reads
   `background-color: rgb(11 11 11 / var(--jflix-scroll, 0))` and
   `::before { opacity: calc(1 - var(--jflix-scroll, 0)) }`. Works on webOS 5 (Chromium 68), where
   `animation-timeline` never will.
5. **Smaller items:** splitting the `"1. Pilot"` text node for an episode-number circle · a
   `<video muted playsinline>` trailer in `.cardScalable` (with `prefers-reduced-motion` and data-saver
   guards) · a real "My List" via `/Users/{id}/FavoriteItems` · **re-measuring `.overview-expand`** so the
   theme is free to change `.overview`'s type metrics (5 lines, removes the §3.9 constraint).

---

## 7. Definition of done

A page ships when **every** box below is ticked on **every** profile listed for it. Use
`./tools/shoot.sh --inject dist/jellyflix.css` and compare against `_shots/baseline/`.

### 7.1 Global gates (all pages, all profiles)

- [ ] No `css-*` selector anywhere in the file.
- [ ] No CSS nesting, no `transition: all`, no `will-change`, no unconditional `backdrop-filter`/`filter: blur()`.
- [ ] No shadow on any element at rest.
- [ ] Every `:has()` selector is in its **own** rule, never grouped with a plain selector.
- [ ] No `transform`/`filter`/`contain: layout|paint`/`will-change` on `main`, `.skinBody`, `.page`,
      `.mainAnimatedPage`, `#reactRoot`.
- [ ] `.scrollSlider`'s `transform`/`transition`/`will-change`/`position`/`overflow` are untouched.
- [ ] No rule can resurrect a `.hide`den element; "visible" selections use `:not(.hide)`.
- [ ] `html{font-size}` is unchanged; no type size is declared in `em` or `vw`.
- [ ] Every hard-coded stock literal in §2.16's second table is overridden — **grep the rendered page for
      `#00a4dc`, `rgb(51,136,204)`, `#03a9f4`, `#202020`, `#282828`, `#aaa` and get zero visible hits.**
- [ ] All 17 contrast pairs in §5.1 computed and passing — in particular the progress track is **opaque**,
      not `rgba(255,255,255,.28)`.
- [ ] `prefers-reduced-motion`, `prefers-contrast: more`, `prefers-reduced-transparency` and
      `forced-colors` blocks present and verified.
- [ ] Keyboard tab traversal shows a visible `--jflix-focus-ring` on **every** interactive element, including
      cards, chips, the A–Z rail and OSD controls.
- [ ] 200 % zoom at 320 px width produces no horizontal page scroll.
- [ ] `light` theme renders a complete page (no stock-blue survivors, no unreadable text).
- [ ] The theme is complete and coherent **with the JS add-on absent**.

### 7.2 Per page

**Home** (`modern-desktop`, `modern-laptop`, `modern-tablet`, `modern-mobile`, `legacy-desktop`,
`legacy-mobile`, `tv`)
- [ ] 7 / 6 / 5 / 4 / 3.4 / 2.6 portrait tiles at 1920 / 1600 / 1366 / 1024 / 700 / 390; last tile not clipped
      by a scrollbar.
- [ ] Wordmark, every row title and the first tile of every row share one left edge at `--jflix-gutter`.
- [ ] App bar is transparent at `scrollTop 0` with the top scrim, solid `--jflix-surface-0` after any scroll,
      cross-fading over 400 ms with **no visible flash** (`--scroll 700`).
- [ ] A hovered tile scales 1.12, casts `--jflix-elev-3`, paints **over its neighbours and over the next
      row**, and is not clipped at the top by the row title or at the sides by the viewport.
- [ ] Hover does not trigger when the pointer sweeps across the row at speed; focus reaches the same state
      instantly.
- [ ] Latest Movies / Latest Shows are **still portrait**; Continue Watching / Next Up / My Media are 16:9.
- [ ] Card captions are hidden at rest and visible on hover **and on focus** (desktop home only); visible
      always on mobile/TV.
- [ ] Row arrows sit inside the card strip, appear on row hover only, never animate width or position, and
      are absent on touch.
- [ ] `tv` profile: stock `scale(1.07)` focus still works, ring visible, no hover rules apply.

**Movies / Shows / Favorites grids** (desktop, tablet, mobile, tv)
- [ ] Grid zoom capped at 1.06 and disabled above 60 tiles; captions always visible.
- [ ] Filter / sort / view controls and the A–Z rail are restyled and present, **not hidden**.
- [ ] A–Z rail's `top` re-set for the 64 px bar and aligned with the first row.

**Details — movie / series / season / episode / person** (desktop, tablet, mobile, tv)
- [ ] Hero shows a graded scrim, not a flat 86 % dim; text sits where the scrim is ≥ 0.72 alpha.
- [ ] Logo is bottom-left at `--jflix-gutter`; the no-logo fallback renders the item name at display size.
- [ ] `.detailRibbon` is transparent; no opaque band across the artwork.
- [ ] **Both** `.noBackdropTransparency` and `:not(.noBackdropTransparency)` render correctly.
- [ ] Play button is white with `--jflix-text-on-light` label; no filled red button on the page.
- [ ] `.overview`'s font-size, width and clamp are **unchanged**; "Pokaż więcej" behaves as it does on
      baseline.
- [ ] Episode synopsis is visible on mobile (stock `display:none` below 50em undone).
- [ ] Cast captions visible; person cards circular including the blurhash placeholder.
- [ ] Mobile: `#itemBackdrop`'s `margin-top:-48px` still matches the 48 px mobile bar.

**Search** (desktop, mobile)
- [ ] Field is opaque, focus ring visible, magnifier is not `#aaa`.
- [ ] Empty state is calm and legible.

**Login** (desktop, mobile, tv)
- [ ] Both `.manualLoginForm` and `.visualLoginForm` modes styled; the `.hide` switch still works.
- [ ] Submit is the white Primary; secondary stack is glass/surface-4, not blue.
- [ ] `tv`: every button shows `--jflix-focus-ring-tv`; the picker is D-pad navigable.

**Preferences / Display prefs** (desktop, mobile, tv)
- [ ] Labels above fields, never floating; fields opaque; checkboxes filled **white** when checked.
- [ ] Toggles and sliders carry no `#00a4dc`.
- [ ] `tv`: field height 56, focus paints the whole field.

**Player** (desktop, mobile, tv)
- [ ] Scrubber track 4 → 8 px on hover, fill `--jflix-accent`, hit area 20 px.
- [ ] `.osdTimeText`'s `margin-right: auto` intact — the right cluster still sits at the edge.
- [ ] OSD auto-hides after 3 s and **does not** hide while focus is inside it.
- [ ] Skip-segment and up-next buttons styled, positioned bottom-right, focusable.
- [ ] `.paper-icon-button-light` / `.material-icons` / `.emby-button` were not restyled globally.
- [ ] `tv`: transport 64×64, no auto-hide with D-pad focus inside.

**Dashboard / branding** (desktop, mobile)
- [ ] Compact density applied; no hover-scale; no hero gradient; app bar solid from scroll 0.
- [ ] `.button-delete` is the only filled red button; `.button-submit` is white.
- [ ] Tables, panels and the docked drawer are legible; no `#202020` or `#00a4dc` survivors.
- [ ] The dashboard is not narrowed by `--jflix-gutter` — a 20-row table still fits on one screen.

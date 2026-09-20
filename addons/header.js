// ==UserScript==
// @name         JellyFlix add-on
// @namespace    https://github.com/jellyflix
// @version      __VERSION__
// @description  JavaScript companion for the Jellyfin 12.x web client: a pause info card (logo + synopsis over the paused frame) plus CSS hooks for row names, scroll position and card metadata.
// @match        *://*/web/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/*
 * JellyFlix add-on — standalone. It needs no theme and no server-side CSS; it only needs a
 * Jellyfin 12.x web client.
 *
 * Build __BUILD__ (a content hash of this file; two installs of the same build stand down instead
 * of doubling up, a newer build takes over from an older one — see core/00-namespace.js).
 *
 * ---------------------------------------------------------------------------------------------
 * MODULES IN THIS BUILD  (each can be switched off — see "Configuration" below)
 * ---------------------------------------------------------------------------------------------
 * One of them is a feature you can see; the other three are hooks that put information into the
 * DOM for a stylesheet of your own to render. Without any CSS they are inert and harmless.
 *
 *   pauseInfo     THE FEATURE. When playback is paused, fades in the film or series logo, the
 *                 episode title and the synopsis over the frame. Self-contained: it ships its
 *                 own stylesheet and needs nothing else.                     [on]
 *   rowTags       writes data-jfx-row="<slug of the row title>" on every home row, so CSS can
 *                 style a row by name — [data-jfx-row="do-obejrzenia"] — which is otherwise
 *                 impossible, because CSS cannot match text.                 [on]
 *   scrollVar     writes --jflix-scroll: 0..1 on <html> from a passive scroll listener, so an
 *                 app-bar scrim can ramp smoothly on engines with no scroll-driven animations
 *                 (every TV box). Read it as var(--jflix-scroll, 0).         [on]
 *   cardMeta      writes data-jfx-overview / -genres / -runtime on home cards, so CSS can build
 *                 an expanded hover panel with content: attr().
 *                                                      [OFF — one extra API call per batch]
 *
 * ---------------------------------------------------------------------------------------------
 * CONFIGURATION — three layers, later ones win
 * ---------------------------------------------------------------------------------------------
 *   1. edit the `defaults` of a module in addons/mods/*.js and rebuild;
 *   2. define a global BEFORE this script runs:
 *        window.JELLYFLIX_ADDON_CONFIG = { cardMeta: { enabled: true }, pauseInfo: { delayMs: 800 } };
 *   3. from the browser console, persisted in localStorage:
 *        JellyFlixAddon.setConfig({ pauseInfo: { showOverview: false } });
 *        JellyFlixAddon.setConfig({ debug: true });   // turn on the [JellyFlix] console log
 *        JellyFlixAddon.setConfig(null);              // forget the stored overrides
 *        JellyFlixAddon.stop();                       // shut everything down, leave no trace
 *
 *   Every option, per module:
 *     pauseInfo    delayMs 350 · dim true · showLogo true · showOverview true ·
 *                  showRemaining true · overviewChars 420 · logoMaxWidth 600
 *     scrollVar    rampPx 120
 *     cardMeta     enabled false · batchSize 60 · overviewChars 240
 *     rowTags      (no options)
 *
 * ---------------------------------------------------------------------------------------------
 * HOW TO INSTALL — pick ONE (see addons/README.md for the long version)
 * ---------------------------------------------------------------------------------------------
 *   a) Jellyfin plugin "JavaScript Injector" — server-wide, reaches every browser that talks to
 *      the server, including the ones on TVs. Repo:
 *      https://raw.githubusercontent.com/n00bcodr/jellyfin-plugins/main/12/manifest.json
 *      Paste the whole of dist/jellyflix-addon.user.js; the userscript header above is ignored.
 *      `node tools/apply-addon.mjs` does the same thing over the API.
 *   b) Browser userscript manager (Tampermonkey / Violentmonkey) — per client, opt-in, survives
 *      server upgrades. Open dist/jellyflix-addon.user.js and confirm the install.
 *   c) Reverse proxy sub_filter injecting
 *      <script src="…/jellyflix-addon.user.js"></script> before </body>.
 *
 * It never writes to the server: every request is a GET against the very server you are already
 * logged into, authenticated with the token window.ApiClient already holds.
 */

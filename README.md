# JellyFlix

*[Polski](README.pl.md) · **English***

Three plugins for **Jellyfin 12.x**. Two of them bring a couple of things over from the way Netflix
behaves to the web client; the third makes Filmweb.pl a metadata source. Install them from
Jellyfin's own plugin catalogue; there is nothing to paste anywhere and nothing to edit on the server.

| | |
|---|---|
| **Pause Info Card** | Pause playback and the film or series logo, the episode title and the synopsis fade in over the frame. |
| **Episode Picker** | While a series is playing, a button in the player opens a drawer with the current season's episodes and a season selector. Picking one starts it. |
| **Filmweb** | [Filmweb.pl](https://www.filmweb.pl) as a metadata source for films and series: Polish titles and synopses, genres, the users' and the critics' rating, cast, posters. Searchable from the Identify dialog. |

![The pause info card](docs/img/pause-info-card.png)

![The episode picker](docs/img/episode-picker.png)

## Requirements

* **Jellyfin 12.0 or 12.1** (plugin ABI `12.0.0.0`). Built and tested against `jellyfin/jellyfin:12.1`.
* A browser, or **Jellyfin Desktop 1.11 or newer** — from that version it loads the web client from
  the server, so the plugins reach it too. Older versions render a copy bundled inside the
  application, which no server-side plugin can touch.
* Native clients (Jellyfin for **Android TV**, Kodi, Infuse) run no web code at all — no `index.html`
  to inject into and no CSS — so nothing here can reach them. On an Android TV box there is a way
  round it: see [Android TV](#android-tv).
* **Filmweb** is the exception to the last two points: it runs entirely on the server, so what it
  fetches shows up in every client, native ones included. The server has to be able to reach
  `www.filmweb.pl`.

## Install

1. Dashboard → Plugins → **Repositories** → **+**, and add:

   ```
   https://raw.githubusercontent.com/TerminatorXL/JellyFlix/main/manifest.json
   ```

2. Catalogue → install **Pause Info Card**, **Episode Picker**, **Filmweb**, or any mix of them.
3. **Restart the server.** Jellyfin does not load a plugin until it restarts — before that everything
   looks installed and nothing works.
4. Dashboard → Plugins → the plugin's name for its settings.

They are independent of each other: install any one, or all three. Filmweb needs one more step
before it does anything — see [Filmweb](#filmweb).

![Both plugins in the Jellyfin plugin list](docs/img/plugins-list.png)

## Filmweb

The third plugin is not about the web client at all: it makes [Filmweb.pl](https://www.filmweb.pl) a
metadata source, next to TMDb and OMDb. Installing it is not enough, because Jellyfin asks per
library which sources to use:

1. Dashboard → Libraries → edit the library, and tick **Filmweb** under the metadata downloaders
   (for films or for series) and under the image fetchers.
2. Drag it above the others if it should win. Jellyfin fills each field from the first source that
   has it, so Filmweb at the top means Polish titles, synopses and genres and Filmweb's rating;
   lower down it only fills what the others left empty.
3. **Refresh metadata** on the library, or **Identify** on a single title. In Identify, the *Filmweb*
   field takes the title's id or the address of its page, pasted whole.

What it brings: the Polish title and the original one, synopsis, genres, production countries,
premiere date, the users' average as the community rating and the critics' as the critic rating,
directors and cast with photos, the Polish poster and stills, and a link to the title's page.

Things worth knowing before you point it at a whole library:

* **Matching is strict on purpose.** Filmweb's search always answers with something, so an unattended
  scan only accepts a hit whose year agrees, give or take one — or, for a folder with no year in its
  name, whose title is exactly the same. Anything less is left alone rather than given another film's
  synopsis; Identify is there for those.
* **No character names.** Filmweb does not publish who played whom, so actors come without roles.
  Jellyfin takes an item's people from the first source that has any: if Filmweb is first and you
  want TMDb's cast with roles, switch *Directors and cast* off in the plugin's settings.
* **No seasons or episodes.** Films and series only; the rest stays with whatever fills it now.
* **Stills are at most 900 px wide**, below Jellyfin's default minimum for a backdrop. They are
  offered in the image picker, but not downloaded on their own unless you lower that minimum.
* **The API is unofficial.** It is the one the Filmweb website itself uses, as documented by
  [filmweb-api](https://github.com/b44x/filmweb-api), which this plugin's client is a port of. There
  is no key and no promise that it stays as it is. The plugin keeps answers for an hour, sends at
  most four requests at a time and backs off when told to.

## Android TV

The **Jellyfin for Android TV** app is native Kotlin with its own interface. It loads no web client,
so no server-side plugin can reach it — not these, and not Custom CSS either. That is architectural,
not a gap waiting to be filled.

There is a way round it, because **Jellyfin for Android** — the *mobile* app — is a WebView wrapper
that loads the web client from your server. Sideload it on the box and it runs exactly the same code
a browser does, plugins included.

1. Sideload **Jellyfin for Android** (the mobile app, not the Android TV one) onto the box.
2. In its settings: **Video player → Video player type → Web player**. This matters: *Integrated
   player* hands playback to ExoPlayer and leaves the web client, so the OSD the plugins attach to is
   never on screen.
3. In Jellyfin: **Settings → Display → Layout → TV**, so the client lays itself out for a remote.

Then the remote works the way you would expect: the picker opens from the player's button, Up/Down
walks the episode list, Left/Right changes season on the selector without seeking the video, Enter
starts the episode, Back closes.

Verified with `tools/tv-remote-check.mjs --profile android-webview` — the TV layout under an Android
WebView user agent, driven by the keyboard alone, which is as close as a test rig gets without the box
on the desk. Playback in a WebView is not ExoPlayer, so expect the codec support of the browser rather
than of the native app; that is the trade for having the plugins at all.

## Settings

Each plugin has its own page in the Dashboard. Saving takes effect on the next page load — no restart.

**Pause Info Card** — how long the pause has to last before the card appears (350 ms by default; a
shorter pause is almost always a seek), whether to dim the whole frame, whether to use the logo
image, the synopsis, and how much of the file is left. It also carries three CSS hooks that do
nothing on their own but let a stylesheet of yours do more: `data-jfx-row` names the home rows,
`--jflix-scroll` publishes the scroll position, and `data-jfx-overview`/`-genres`/`-runtime` put card
metadata into the DOM.

**Episode Picker** — thumbnails, synopses and their length.

**Filmweb** — whether an item is named with the Polish title or the original one, whether to bring
in directors and cast and how many actors, the critic rating, and stills as backdrops. Saving takes
effect on the next metadata refresh.

Anything not in the Dashboard can still be changed per browser from the console, and it is remembered:

```js
JellyFlixAddon.setConfig({ pauseInfo: { delayMs: 800 } })
JellyFlixAddon.setConfig({ debug: true })     // [JellyFlix] tracing in the console
JellyFlixAddon.setConfig(null)                // forget the stored overrides
```

## Themes

Both overlays read the [Abyss](https://github.com/AumGupta/abyss-jellyfin) theme's palette when it is
installed — accent, glass tint, corner radius and easing come from its `--abyss-*` variables, so the
drawer looks like the rest of that theme rather than like a stranger dropped on top of it. Each one
falls back to the plugin's own value, so nothing changes without Abyss. The frosted backdrop is the
exception: it is applied *only* when Abyss defines the blur, because it is expensive on a TV and
nobody should pay for it unless they already opted in.

Set your own accent and the drawer follows it — Abyss takes it as R, G, B:

```css
:root { --abyss-accent: 229, 9, 20; }
```

Anything else is ordinary Custom CSS: the plugin stylesheets are injected as the *first* child of
`<head>`, which makes them the weakest sheet on the page, so any `.jfx-pause*` or `.jfx-eps*` rule
you write wins at equal specificity.

## When something does not show up

Each plugin answers a status URL that says whether it is injecting its script and, when it is not, why:

```
https://your-server/PauseInfoCard/status
https://your-server/EpisodePicker/status
```

```json
{"plugin":"Pause Info Card","version":"1.2.2.0","enabled":true,
 "indexRequestsSeen":1,"injected":1,"lastOutcome":"injected"}
```

* **404** — the plugin is not running. Almost always a server that was not restarted after the install.
* **`injected: 0`** — it is seeing the page and declining to touch it; `lastOutcome` says why.
* **`injected` above zero but nothing on screen** — the server side is fine; turn on *Console logging*
  in the plugin's settings and look for `[JellyFlix]` lines in the browser console.

**Filmweb** injects nothing, so it has no status URL. When a title gets nothing from it: check that
Filmweb is ticked for that library and that kind of item; run Identify on the title to see what the
search returns; and look in the server log, which has a `Filmweb:` line for every answer it could
not read.

## How it works

jellyfin-web 12.1 has **no hook for custom JavaScript** — Custom CSS is the only thing the Dashboard
takes. So each of the two web-client plugins is a real Jellyfin plugin that does two things:

* an `IStartupFilter` whose middleware appends one `<script>` tag to `index.html` as it is served.
  Nothing on disk is touched, so a server upgrade cannot undo it and the read-only web root in the
  Docker image is not in the way;
* an API controller that serves the script, with the Dashboard settings prepended to it.

Both plugins carry the same JavaScript core. The second one to load detects the first and registers
only its own modules instead of replacing it, which is what lets them coexist on one page.

There is no telemetry, and those two send nothing anywhere. Every request goes to the Jellyfin server
you are already logged into, authenticated with the token the web client already holds. All of them
are reads except one: picking an episode POSTs a play command to your own session, because that is
the only way an injected script can start playback.

**Filmweb** is the ordinary kind of plugin — metadata and image providers, and a small client for
the REST API behind them — and it is the one that talks to the outside. The server asks
`www.filmweb.pl` about the titles it looks up, which tells Filmweb their names the same way a scan
already tells TMDb, and downloads posters and photos from Filmweb's CDN, `fwcdn.pl`. In the Identify
dialog your browser loads the poster thumbnails from that CDN directly.

## Building it yourself

Node and Docker; nothing else has to be installed. Jellyfin 12.1 targets **net10.0**, which is newer
than most machines' SDK, so the C# compiles in the official container.

```bash
npm run build:bundles                              # the JavaScript, one bundle per plugin
npm run build:plugin -- --plugin pause-info-card --version 1.2.2.0
npm run build:plugin -- --plugin episode-picker  --version 1.0.4.0
npm run build:plugin -- --plugin filmweb         --version 1.0.0.0   # C# only, no bundle needed
```

Each build writes `dist/plugin/<slug>_<version>.zip` and refreshes `manifest.json` with the source
URL and its MD5, so the repository URL above keeps working straight after a push.

Adding another plugin means adding a directory under `plugins/` with a `plugin.json` beside its C#
project — the build script and the manifest already handle any number of them.

### Checks

They drive a real browser against a real Jellyfin, through the Playwright container:

```bash
tools/pw.sh tools/addon-check.mjs --server    # the pause card, as the server delivers it
tools/pw.sh tools/picker-check.mjs            # the drawer: seasons, episodes, switching episode
tools/pw.sh tools/coexist-check.mjs           # both plugins installed at once
```

Filmweb is C# with no browser in it, so it is checked differently — unit tests against responses
captured from the API, and one script that goes through a real Jellyfin to the live API:

```bash
npm run test:plugin                           # the unit tests, in the .NET SDK container
tools/pw.sh tools/filmweb-check.mjs           # Identify, through the server, against live Filmweb
tools/pw.sh tools/filmweb-check.mjs --apply   # …and identify one film and one series for real
```

## Without the plugins

`dist/jellyflix-addon.user.js` is the same code as one file for a userscript manager
(Tampermonkey, Violentmonkey) — per browser, no server changes. `addons/README.md` is the developer
documentation: the module contract, what the core offers, and the reasoning behind the parts that
look odd.

## Licence

MIT. An independent project, inspired by how Netflix behaves; it contains none of Netflix's logos,
fonts or artwork and is not connected with them. Nor with Filmweb: what the Filmweb plugin fetches
comes from Filmweb.pl and belongs to its owners.

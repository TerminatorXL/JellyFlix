**1.2.2.0**

- A plugin icon, shown in the Jellyfin plugin list.

**1.2.0.0**

- Carries only its own modules now (the pause card and the three CSS hooks) instead of the whole
  bundle, so it can be installed alongside **Episode Picker** without the two fighting over the
  shared framework.
- Its settings are merged into the add-on's global configuration rather than assigned over it, for
  the same reason.

**1.1.0.0**

- Renamed from "JellyFlix Add-on" to **Pause Info Card**. JellyFlix is the repository, which now holds more than one plugin; the plugin is named after what it does. The API routes moved with it: `/PauseInfoCard/addon.js` and `/PauseInfoCard/status`.
- Same plugin GUID, so this is an in-place update and settings are kept.

**1.0.4.0**

- Support clients that play outside the DOM. Jellyfin Desktop / Media Player 1.11+ runs this web client but hands playback to libmpv, so no `<video>` element is ever created and the add-on never saw a pause. State now falls back to the OSD itself.
- With no media duration to measure, the resolved item is validated against the title the OSD is showing instead.

**1.0.3.0**

- Drop `If-None-Match` / `If-Modified-Since` for the index.html request; a 304 was handing browsers their pre-install copy of the page forever.
- The injected document is sent `no-store`, without ETag or Last-Modified.

**1.0.2.0**

- Ask for index.html uncompressed. Jellyfin gzips it for anything that sends `Accept-Encoding`, i.e. every browser.

**1.0.1.0**

- Intercept through `IHttpResponseBodyFeature`; never rewrite a compressed or non-HTML response. New status endpoint.

**1.0.0.0** — first release.

/* A tiny playback bus, because jellyfin-web keeps its own `playbackManager` inside the bundle.
 *
 * Everything here is derived from the DOM. Two modes, picked automatically:
 *
 *   'video'  an HTML5 media element is driving playback, which is every browser:
 *              body > .videoPlayerContainer > video.htmlvideoplayer   (htmlVideoPlayer/plugin.js)
 *            Its own events are the source of truth, and its duration validates the resolved item.
 *
 *   'dom'    something else is. Jellyfin Desktop / Media Player 1.11+ runs this very web client but
 *            hands playback to libmpv, so the OSD is ordinary jellyfin-web markup while the picture
 *            is painted by a native layer and NO <video> is ever created. State then comes from the
 *            OSD: it exists only while something plays, and its pause button swaps its glyph class
 *            between `pause` and `play_arrow`.
 *
 * Emitted events — JFX.player.on('pause', fn):
 *     attach   the <video> appeared (playback started); arg = state
 *     detach   it went away (playback stopped)
 *     play     playing again (also fired for the initial play)
 *     pause    paused by the user — NOT fired for buffering (that is 'waiting') nor at the end
 *     seeking / seeked
 *     ended
 *     item     the now-playing item was resolved (or changed, e.g. the next episode)
 */
JFX.player = (function () {
    var handlers = {};
    /* mode: 'video' when an HTML5 media element is driving playback, 'dom' when something else is
     * (Jellyfin Desktop renders through libmpv and never creates a <video>), null when idle. */
    var state = { video: null, src: '', paused: false, item: null, itemId: null, mode: null };
    var domTimer = 0;
    var pending = null;

    var EVENTS = ['pause', 'play', 'playing', 'seeking', 'seeked', 'ended',
        'loadedmetadata', 'durationchange', 'emptied'];
    /* Media routes only — `/Items/{id}/Images/…` must NOT match, or every poster on the page becomes
     * a candidate when we go looking through the resource-timing log. */
    var ID_IN_URL = /\/(?:videos|audio)\/([0-9a-f]{32}|[0-9a-f-]{36})(?=[/?]|$)/i;
    var ID_IN_QUERY = /[?&](?:mediasourceid|itemid)=([0-9a-f]{32}|[0-9a-f-]{36})/i;
    var LOOKUP_TRIES = 6;
    var LOOKUP_WAIT_MS = 600;

    /* ----------------------------------------------------------------- events */

    function on(name, fn) {
        (handlers[name] || (handlers[name] = [])).push(fn);
    }

    function off(name, fn) {
        var list = handlers[name] || [];
        var i = list.indexOf(fn);
        if (i > -1) list.splice(i, 1);
    }

    function emit(name) {
        var list = (handlers[name] || []).slice();
        for (var i = 0; i < list.length; i++) {
            try {
                list[i](state);
            } catch (err) {
                JFX.util.warn(name + ' handler failed', err);
            }
        }
    }

    /* ------------------------------------------------------- item resolution */

    function parseId(url) {
        if (!url || url.indexOf('blob:') === 0) return null;   // hls.js hands us an opaque blob URL
        var m = ID_IN_URL.exec(url) || ID_IN_QUERY.exec(url);
        return m ? m[1] : null;
    }

    function wait(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    function mediaDuration() {
        var video = state.video;
        return video && isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    }

    /* The OSD writes the title of whatever is playing into the app bar, and it gets it from the item
     * itself — so it is an independent second opinion on "is this DdTO the right one", and the only
     * one available when there is no media element to measure. */
    function osdTitleSlug() {
        var node = document.querySelector('.videoOsd-appBar p')
            || document.querySelector('.skinHeader.osdHeader p')
            || document.querySelector('#videoOsdPage:not(.hide) .osdTitle');
        return node ? JFX.util.slugify(node.textContent) : '';
    }

    function matchesOsdTitle(item) {
        var shown = osdTitleSlug();
        if (!shown) return true;                   // nothing to compare against yet
        var names = [];
        if (item.SeriesName) names.push(item.SeriesName);
        if (item.Name) names.push(item.Name);
        for (var i = 0; i < names.length; i++) {
            var candidate = JFX.util.slugify(names[i]);
            if (candidate && shown.indexOf(candidate) > -1) return true;
        }
        return false;
    }

    /* Could this DTO plausibly be what is playing?
     *
     * This is the guard that keeps the wrong title off the screen. Every source of an item id below
     * is a guess of some kind, and the one thing we can check them against for free is how long the
     * media is: a wrong title is wrong by minutes, the right one by well under a second. The
     * tolerance is deliberately loose (5 %, at least 10 s) so a slightly-off runtime in the metadata
     * never costs a correct card.
     *
     * With no duration to measure — dom mode, live TV, metadata not in yet — the OSD's own title is
     * the fallback. That keeps the proven path byte-for-byte unchanged when a duration IS known, and
     * still refuses a stale session answer on a client that plays outside the DOM. */
    function matchesMedia(item) {
        if (!item) return true;
        var duration = mediaDuration();
        if (duration && item.RunTimeTicks) {
            var expected = item.RunTimeTicks / 10000000;
            return Math.abs(expected - duration) <= Math.max(10, duration * 0.05);
        }
        return matchesOsdTitle(item);
    }

    /* hls.js replaces the source with an opaque blob: URL, but the manifest and segment requests it
     * made are still in the resource-timing log, and they carry the item id. Newest first; the buffer
     * may be full of older entries, which is exactly what matchesMedia() is there to catch. */
    function idsFromNetworkLog() {
        var out = [];
        if (!window.performance || !performance.getEntriesByType) return out;
        var entries = performance.getEntriesByType('resource') || [];
        for (var i = entries.length - 1; i >= 0 && out.length < 4; i--) {
            var id = parseId(entries[i].name);
            if (id && out.indexOf(id) === -1) out.push(id);
        }
        return out;
    }

    function verify(id) {
        return JFX.api.getItem(id).then(function (item) {
            return matchesMedia(item) ? item : null;
        }).catch(function () { return null; });
    }

    function firstMatching(ids, index) {
        if (index >= ids.length) return Promise.resolve(null);
        return verify(ids[index]).then(function (item) {
            return item || firstMatching(ids, index + 1);
        });
    }

    /* Direct play puts the item id straight in the media URL and costs nothing to read; transcoded
     * HLS does not, so we fall back to the network log and finally to the server's session.
     *
     * The session gets retried while its answer disagrees with the media element — NOT merely while
     * it is empty. Jellyfin keeps one session row per device and swaps its NowPlayingItem when the
     * client reports playback start, so straight after switching titles it still names the previous
     * one. Believing that first answer is what made the card show the film you watched before. */
    function lookupItem(attempt) {
        var candidates = [];
        var fromUrl = parseId(state.src);
        if (fromUrl) candidates.push(fromUrl);
        idsFromNetworkLog().forEach(function (id) {
            if (candidates.indexOf(id) === -1) candidates.push(id);
        });

        return firstMatching(candidates, 0).then(function (item) {
            if (item) return item;
            return JFX.api.nowPlaying().then(function (playing) {
                if (playing && matchesMedia(playing)) return JFX.api.getItem(playing.Id);
                if (attempt >= LOOKUP_TRIES) {
                    JFX.util.log('giving up on the item', playing ? '(session kept disagreeing)' : '');
                    return null;
                }
                return wait(LOOKUP_WAIT_MS).then(function () { return lookupItem(attempt + 1); });
            });
        });
    }

    function resolveItem() {
        if (state.item) return Promise.resolve(state.item);
        if (pending) return pending;
        pending = lookupItem(0).then(function (item) {
            if (!item) throw new Error('now-playing item not identified');
            state.item = item;
            state.itemId = item.Id;
            JFX.util.log('now playing', item.Type, item.Name);
            emit('item');
            return item;
        }).catch(function (err) {
            pending = null;                       // let the next pause try again
            JFX.util.log('item lookup failed', err.message);
            throw err;
        });
        return pending;
    }

    function forgetItem() {
        state.item = null;
        state.itemId = null;
        pending = null;
    }

    /* ------------------------------------------------- <video> element events */

    function handle(e) {
        var video = state.video;
        if (!video) return;

        switch (e.type) {
            case 'pause':
                // The browser also fires `pause` as the media ends; that is 'ended', not a user pause.
                if (video.ended) return;
                state.paused = true;
                emit('pause');
                return;
            case 'play':
            case 'playing':
                if (!state.paused && e.type === 'playing') return;   // plain buffering recovery
                state.paused = false;
                emit('play');
                return;
            case 'ended':
                state.paused = false;
                emit('ended');
                return;
            case 'durationchange':
                /* A duration we did not have when the item was resolved can now contradict it —
                 * throw the answer away and ask again rather than keep a wrong title on screen. */
                if (state.item && !matchesMedia(state.item)) {
                    JFX.util.log('resolved item contradicts the media duration — re-resolving');
                    forgetItem();
                    resolveItem().catch(function () { /* reported by resolveItem */ });
                }
                return;
            case 'emptied':
            case 'loadedmetadata':
                syncSrc();
                return;
            default:
                emit(e.type);                       // seeking / seeked pass straight through
        }
    }

    /* The same <video> element is reused when playback moves to the next episode, so the source URL
     * is the only signal that the item changed. */
    function syncSrc() {
        var video = state.video;
        var src = (video && (video.currentSrc || video.src)) || '';
        if (src === state.src) return;
        state.src = src;
        forgetItem();
        if (src) resolveItem().catch(function () { /* reported by resolveItem */ });
    }

    function attach(video) {
        state.video = video;
        state.src = '';
        state.paused = !!video.paused;
        for (var i = 0; i < EVENTS.length; i++) video.addEventListener(EVENTS[i], handle);
        JFX.util.log('player attached');
        emit('attach');
        syncSrc();
    }

    function detach() {
        var video = state.video;
        if (!video) return;
        for (var i = 0; i < EVENTS.length; i++) video.removeEventListener(EVENTS[i], handle);
        state.video = null;
        state.src = '';
        state.paused = false;
        forgetItem();
        JFX.util.log('player detached');
        emit('detach');
    }

    /* ---------------------------------------------------------------- dom mode */

    /* Jellyfin Desktop / Media Player 1.11+ runs this very web client, but hands playback to libmpv:
     * the OSD is ordinary jellyfin-web markup while the picture is painted by a native layer, so
     * there is no <video> to listen to. The OSD still tells the whole story — it exists only while
     * something is playing, and its pause button swaps its glyph class between `pause` and
     * `play_arrow` (video/index.js:726-739). That is enough for this add-on. */
    function findOsd() {
        return document.querySelector('#videoOsdPage:not(.hide)');
    }

    function osdPaused() {
        var osd = findOsd();
        if (!osd) return false;
        if (osd.querySelector('.btnPause .play_arrow')) return true;
        if (osd.querySelector('.btnPause .pause')) return false;
        return state.paused;                       // glyph not rendered yet — keep what we had
    }

    function attachDom() {
        state.mode = 'dom';
        state.video = null;
        state.src = '';
        state.paused = osdPaused();
        JFX.util.log('player attached (no <video> — reading the OSD)');
        emit('attach');
        resolveItem().catch(function () { /* reported by resolveItem */ });

        /* The OSD class swap is a DOM mutation, so the registry tick already catches it. The interval
         * is insurance for the case where the swap happens in a batch the observer coalesces away. */
        if (!domTimer) domTimer = setInterval(pollDom, 500);
    }

    function detachDom() {
        if (domTimer) {
            clearInterval(domTimer);
            domTimer = 0;
        }
        state.mode = null;
        state.paused = false;
        forgetItem();
        JFX.util.log('player detached (OSD gone)');
        emit('detach');
    }

    function pollDom() {
        if (state.mode !== 'dom') return;
        if (!findOsd()) {
            detachDom();
            return;
        }
        var paused = osdPaused();
        if (paused === state.paused) return;
        state.paused = paused;
        emit(paused ? 'pause' : 'play');
    }

    /* ------------------------------------------------------------- video mode */

    function findVideo() {
        var container = document.querySelector('.videoPlayerContainer');
        var video = container && container.querySelector('video');
        return video || document.querySelector('video.htmlvideoplayer');
    }

    /** Called from the registry's DOM tick. Cheap: one querySelector when nothing changed. */
    function scan() {
        var video = findVideo();

        if (video) {
            if (state.mode === 'dom') detachDom();
            if (video === state.video) {
                syncSrc();
                return;
            }
            if (state.video) detach();
            attach(video);
            state.mode = 'video';
            return;
        }

        if (state.video) detach();

        // No media element. Either nothing is playing, or the client plays outside the DOM.
        if (findOsd()) {
            if (state.mode !== 'dom') attachDom();
            else pollDom();
        } else if (state.mode === 'dom') {
            detachDom();
        }
    }

    /** Seconds left in the current file, or 0 when it is not knowable (live, unbuffered, dom mode). */
    function remaining() {
        var video = state.video;
        if (!video || !isFinite(video.duration) || !video.duration) return 0;
        return Math.max(0, video.duration - video.currentTime);
    }

    /** Where overlays mount: a positioned box under the OSD and over the picture.
     *
     * In dom mode there is no .videoPlayerContainer, because there is no <video> to wrap. #videoOsdPage
     * is the next best host — it covers the viewport, it exists exactly while something is playing,
     * and it is the parent of the OSD shelf, so an overlay placed FIRST inside it still paints below
     * the controls by DOM order. */
    function surface() {
        return document.querySelector('.videoPlayerContainer') || findOsd();
    }

    return {
        state: state,
        on: on,
        off: off,
        scan: scan,
        resolveItem: resolveItem,
        forget: forgetItem,               // drop the resolved item and look it up again on demand
        matchesMedia: matchesMedia,
        remaining: remaining,
        surface: surface
    };
})();

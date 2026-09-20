/* The bridge to the Jellyfin server — every call against the very server the user is already logged
 * into, authenticated with the token window.ApiClient already holds.
 *
 * Reads only, with ONE exception: command(), which POSTs a remote-control command to this device's
 * own session and exists because playbackManager cannot be called from an injected script. It is
 * only ever reached from a click, and it writes no library data and no settings.
 *
 * Why raw fetch instead of ApiClient's own methods: jellyfin-web 12.x exposes only `window.ApiClient`
 * and `window.Emby.Page` as globals — the module graph (playbackManager, Events, …) is bundled and
 * unreachable from a userscript. ApiClient's getters are stable across 10.x/12.x; its method surface
 * is not, so we only borrow the four getters and speak HTTP ourselves.
 */
JFX.api = (function () {
    var itemCache = {};

    /* Everything here is wrapped, not just null-checked. `window.ApiClient` is the one object in
     * this file we do not own: a future release can rename a getter, and one that is present but
     * throws (called before the client is connected, say) would otherwise take the calling module
     * down with it. A null ctx is a first-class, expected answer — "logged out, or not ready yet" —
     * and every caller already treats it that way. */
    function ctx() {
        try {
            var client = window.ApiClient;
            if (!client || typeof client.serverAddress !== 'function' || typeof client.accessToken !== 'function') {
                return null;
            }
            var address = client.serverAddress();
            var token = client.accessToken();
            var userId = typeof client.getCurrentUserId === 'function' ? client.getCurrentUserId() : null;
            if (!address || !token || !userId) return null;
            return {
                address: address,
                token: token,
                userId: userId,
                deviceId: (typeof client.deviceId === 'function' && client.deviceId()) || ''
            };
        } catch (err) {
            JFX.util.log('ApiClient not usable', err && err.message);
            return null;
        }
    }

    /* The server's base URL WITHOUT needing a session — for the handful of endpoints that are
     * public (Branding/Css.css, item images). ApiClient is preferred when it is there; otherwise
     * the address is derived from the page itself, which also gets the sub-path case right
     * (https://host/jellyfin/web/#/home -> https://host/jellyfin). */
    function base() {
        var c = ctx();
        if (c) return c.address;
        var path = location.pathname || '';
        var cut = path.indexOf('/web/');
        if (cut < 0 && /\/web\/?$/.test(path)) cut = path.lastIndexOf('/web');
        return location.origin + (cut > 0 ? path.slice(0, cut) : '');
    }

    function get(path, params) {
        var c = ctx();
        if (!c) return Promise.reject(new Error('no api client'));
        var query = Object.keys(params || {}).map(function (k) {
            return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
        }).join('&');
        return fetch(c.address + path + (query ? '?' + query : ''), {
            headers: { Authorization: 'MediaBrowser Token="' + c.token + '"' }
        }).then(function (r) {
            if (!r.ok) throw new Error(path + ' -> ' + r.status);
            return r.json();
        });
    }

    /* A PUBLIC GET that returns text and needs no session — /Branding/Css.css is the only caller.
     * Deliberately separate from get(): it uses base() rather than ctx(), so it still works on the
     * login page and before ApiClient has connected, and it sends no Authorization header at all. */
    function text(path) {
        if (typeof fetch !== 'function') return Promise.reject(new Error('no fetch'));
        return fetch(base() + path, { credentials: 'omit' }).then(function (r) {
            if (!r.ok) throw new Error(path + ' -> ' + r.status);
            return r.text();
        });
    }

    /* NO api_key in the query string. `GET /Items/{id}/Images/{type}` is an unauthenticated route
     * in Jellyfin (verified against the test server: 200 with no Authorization header), and <img>
     * cannot carry a header anyway — so putting the session token in an image URL would buy
     * nothing and leak it into history, the referrer and any shared screenshot. `tag` is only a
     * cache key; `maxWidth` lets the server do the downscale. */
    function imageUrl(itemId, type, tag, maxWidth) {
        if (!itemId || !type) return '';
        var query = [];
        if (tag) query.push('tag=' + encodeURIComponent(tag));
        if (maxWidth) query.push('maxWidth=' + encodeURIComponent(maxWidth));
        return base() + '/Items/' + encodeURIComponent(itemId) + '/Images/' + encodeURIComponent(type) + '/0'
            + (query.length ? '?' + query.join('&') : '');
    }

    /* GET /Items/{id}?userId= returns the full DTO (Overview, Genres, Parent*ImageTag, …) — there is
     * no `fields` parameter on this route in 12.x, and /Users/{id}/Items/{id} is gone. */
    function getItem(itemId) {
        if (!itemId) return Promise.reject(new Error('no item id'));
        if (itemCache[itemId]) return itemCache[itemId];
        var c = ctx();
        if (!c) return Promise.reject(new Error('no api client'));
        itemCache[itemId] = get('/Items/' + itemId, { userId: c.userId }).catch(function (err) {
            delete itemCache[itemId];                // a failed lookup must not be cached
            throw err;
        });
        return itemCache[itemId];
    }

    /* What is this device playing right now, according to the server? Needed when the <video>
     * element says nothing useful — HLS hands hls.js a blob: URL that carries no item id.
     *
     * NOT authoritative, and the caller must treat it as a guess: Jellyfin keeps ONE session row per
     * device and swaps its NowPlayingItem when the client reports playback start, so for a second or
     * two after switching titles the row still names the PREVIOUS one. JFX.player checks the answer
     * against the media element before believing it.
     *
     * Returns the NowPlayingItem DTO (it already carries RunTimeTicks, which is what the check needs)
     * from the most recently active session belonging to this user, or null. */
    function nowPlaying() {
        var c = ctx();
        if (!c || !c.deviceId) return Promise.resolve(null);
        return get('/Sessions', { deviceId: c.deviceId }).then(function (sessions) {
            var best = null;
            for (var i = 0; i < (sessions || []).length; i++) {
                var session = sessions[i];
                if (!session.NowPlayingItem || !session.NowPlayingItem.Id) continue;
                if (c.userId && session.UserId && session.UserId !== c.userId) continue;
                // ISO-8601 sorts lexicographically, so no Date parsing needed.
                if (!best || (session.LastActivityDate || '') > (best.LastActivityDate || '')) {
                    best = session;
                }
            }
            return best ? best.NowPlayingItem : null;
        }).catch(function () { return null; });
    }

    /* The session row for this device, or null. Two callers want different halves of it, so this
     * returns the row rather than one field. */
    function session() {
        var c = ctx();
        if (!c || !c.deviceId) return Promise.resolve(null);
        return get('/Sessions', { deviceId: c.deviceId }).then(function (sessions) {
            var best = null;
            for (var i = 0; i < (sessions || []).length; i++) {
                var row = sessions[i];
                if (c.userId && row.UserId && row.UserId !== c.userId) continue;
                if (!best || (row.LastActivityDate || '') > (best.LastActivityDate || '')) best = row;
            }
            return best;
        }).catch(function () { return null; });
    }

    /* The ONE kind of write this add-on makes, and only ever in direct response to a click.
     *
     * playbackManager is inside jellyfin-web's bundle and cannot be called from an injected script,
     * so "play this episode" goes the way the Cast button's commands go: a remote-control command
     * POSTed to this device's OWN session, which the client then picks up on its own websocket.
     * Nothing here writes library data or settings. */
    function command(path, params) {
        var c = ctx();
        if (!c) return Promise.reject(new Error('no api client'));
        var query = Object.keys(params || {}).map(function (k) {
            return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
        }).join('&');
        return fetch(c.address + path + (query ? '?' + query : ''), {
            method: 'POST',
            headers: { Authorization: 'MediaBrowser Token="' + c.token + '"' }
        }).then(function (r) {
            if (!r.ok) throw new Error(path + ' -> ' + r.status);
        });
    }

    function forget() {
        itemCache = {};
    }

    return {
        ctx: ctx,
        base: base,
        get: get,
        text: text,
        imageUrl: imageUrl,
        getItem: getItem,
        nowPlaying: nowPlaying,
        session: session,
        command: command,
        forget: forget
    };
})();

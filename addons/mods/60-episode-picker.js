/* Episode picker — a button in the player that opens the series' episode list, Netflix-style.
 *
 * While an episode is playing, an extra button appears in the OSD control row. It opens a drawer
 * listing the episodes of the current season, with a season selector, thumbnails, how far through
 * each one you already are, and the one you are watching marked. Picking another episode starts it.
 *
 * HOW PLAYBACK IS STARTED
 * jellyfin-web keeps `playbackManager` inside its bundle, so an injected script cannot call it. The
 * way in is the one the Cast button already uses: POST a PlayNow command to THIS device's own
 * session and let the client act on its own websocket message. Verified against a live server —
 * the client switches episode exactly as if the command had come from a phone.
 *
 * WHERE IT MOUNTS
 * The button goes into `.videoOsdBottom .buttons`, borrowing Jellyfin's own button classes so it
 * inherits the OSD styling and the hide/show behaviour. The drawer goes in as the LAST child of
 * #videoOsdPage, which puts it above the control shelf by DOM order alone — no z-index — and keeps
 * it on screen when the shelf auto-hides after three seconds.
 */
JFX.register({
    id: 'episodePicker',
    title: 'Episode picker',
    defaults: {
        enabled: true,
        thumbnails: true,
        showOverview: true,
        overviewChars: 180,
        thumbWidth: 320          // px requested from the server
    },
    css: '@@css:mods/60-episode-picker.css@@',

    init: function (cfg) {
        var self = this;

        JFX.util.addStrings({
            en: { episodes: 'Episodes', season: 'Season %s', specials: 'Specials', close: 'Close',
                noEpisodes: 'No episodes in this season.', loadFailed: 'Could not load the episodes.' },
            pl: { episodes: 'Odcinki', season: 'Sezon %s', specials: 'Dodatki', close: 'Zamknij',
                noEpisodes: 'Brak odcinków w tym sezonie.', loadFailed: 'Nie udało się wczytać odcinków.' },
            de: { episodes: 'Folgen', season: 'Staffel %s', specials: 'Extras', close: 'Schließen',
                noEpisodes: 'Keine Folgen in dieser Staffel.', loadFailed: 'Folgen konnten nicht geladen werden.' },
            es: { episodes: 'Episodios', season: 'Temporada %s', specials: 'Especiales', close: 'Cerrar',
                noEpisodes: 'No hay episodios en esta temporada.', loadFailed: 'No se pudieron cargar los episodios.' },
            fr: { episodes: 'Épisodes', season: 'Saison %s', specials: 'Bonus', close: 'Fermer',
                noEpisodes: 'Aucun épisode dans cette saison.', loadFailed: 'Impossible de charger les épisodes.' }
        });

        this.state = { button: null, panel: null, seriesId: null, seasons: null, bySeason: {}, open: false };

        /* TV/remote navigation, and it has to be a CAPTURE listener on document.
         *
         * In the TV layout jellyfin-web owns the arrow keys while the player is up: Left/Right seek
         * the video (video/index.js, the `layoutManager.tv && !currentVisibleMenu` branch), and the
         * OSD's own focus manager walks the control shelf. Measured before this existed: opening the
         * drawer left focus on the position slider and ArrowDown walked to btnPreviousTrack — the
         * list was simply unreachable with a remote.
         *
         * This listener is registered at page load, before the video view adds its own, so on
         * `document` capture it runs first and can take the keys back while the drawer is open. */
        this.onKey = function (e) {
            if (!self.state.open) return;

            // Escape, and the webOS/Tizen "Back" button, which reports keyCode 461.
            if (e.key === 'Escape' || e.keyCode === 27 || e.keyCode === 461) {
                e.preventDefault();
                e.stopPropagation();
                self.close();
                return;
            }

            var items = self.focusables();
            if (!items.length) return;

            switch (e.key) {
                case 'ArrowDown':
                case 'ArrowUp':
                    e.preventDefault();
                    e.stopPropagation();
                    self.moveFocus(items, e.key === 'ArrowDown' ? 1 : -1);
                    return;
                case 'ArrowLeft':
                case 'ArrowRight':
                    /* Swallowed whatever happens, or the player seeks underneath the open drawer.
                     * On the season selector they do something useful instead. */
                    e.preventDefault();
                    e.stopPropagation();
                    self.nudgeSeason(e.key === 'ArrowRight' ? 1 : -1);
                    return;
                default:
                    // Enter/OK falls through: the rows are <button>, so the browser activates them.
            }
        };
        document.addEventListener('keydown', this.onKey, true);

        /* The OSD focuses its own controls when it is shown — including as a side effect of the very
         * click that opens the drawer. Without this the first keypress went to the slider. */
        this.onFocusIn = function (e) {
            if (!self.state.open || !self.state.panel) return;
            if (self.state.panel.contains(e.target)) return;
            var items = self.focusables();
            if (items.length) items[0].focus();
        };
        document.addEventListener('focusin', this.onFocusIn, true);

        this.onDetach = function () { self.teardown(); };
        JFX.player.on('detach', this.onDetach);
    },

    destroy: function () {
        document.removeEventListener('keydown', this.onKey, true);
        document.removeEventListener('focusin', this.onFocusIn, true);
        JFX.player.off('detach', this.onDetach);
        this.teardown();
    },

    /* --------------------------------------------------------------------- lifecycle */

    tick: function (cfg) {
        var osd = document.querySelector('#videoOsdPage:not(.hide)');
        if (!osd) {
            // tick() runs on every mutation batch in the app, so only pay for a teardown once.
            if (this.state.button || this.state.panel || this.state.seriesId) this.teardown();
            return;
        }

        var item = JFX.player.state.item;
        if (!item) {
            // Nothing resolved yet; resolveItem() is cached and guarded, so asking costs nothing.
            JFX.player.resolveItem().catch(function () { /* reported by resolveItem */ });
            return;
        }

        if (item.Type !== 'Episode' || !item.SeriesId) {
            this.removeButton();
            return;
        }

        if (this.state.seriesId && this.state.seriesId !== item.SeriesId) {
            this.teardown();                       // a different series — drop the cached seasons
        }
        this.state.seriesId = item.SeriesId;
        this.ensureButton(osd, cfg);
    },

    teardown: function () {
        this.close();
        this.removeButton();
        if (this.state.panel && this.state.panel.parentNode) {
            this.state.panel.parentNode.removeChild(this.state.panel);
        }
        this.state = { button: null, panel: null, seriesId: null, seasons: null, bySeason: {}, open: false };
    },

    removeButton: function () {
        var button = this.state.button;
        if (button && button.parentNode) button.parentNode.removeChild(button);
        this.state.button = null;
    },

    /* ------------------------------------------------------------------------ button */

    ensureButton: function (osd, cfg) {
        var self = this;
        var row = osd.querySelector('.videoOsdBottom .buttons');
        if (!row) return;
        if (this.state.button && this.state.button.parentNode === row) return;

        var button = JFX.util.el('button', 'paper-icon-button-light jfx-eps-btn autoSize');
        button.type = 'button';
        button.title = JFX.util.t('episodes');
        button.setAttribute('aria-label', JFX.util.t('episodes'));
        button.innerHTML = '<span class="xlargePaperIconButton material-icons video_library" aria-hidden="true"></span>';
        button.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            self.toggle(cfg);
        });

        /* Beside the other "what am I watching" controls rather than among the transport buttons. */
        var before = row.querySelector('.btnSubtitles') || row.querySelector('.btnVideoOsdSettings');
        if (before) before.parentNode.insertBefore(button, before);
        else row.appendChild(button);

        this.state.button = button;
    },

    /* ------------------------------------------------------------------ focus/remote */

    /** Everything in the drawer a remote can land on, in reading order. */
    focusables: function () {
        if (!this.state.panel) return [];
        return Array.prototype.slice.call(
            this.state.panel.querySelectorAll('.jfx-eps-seasons, .jfx-eps-close, .jfx-eps-item'));
    },

    moveFocus: function (items, step) {
        var at = items.indexOf(document.activeElement);
        var next = at < 0 ? 0 : Math.min(items.length - 1, Math.max(0, at + step));
        items[next].focus();
        if (items[next].scrollIntoView) items[next].scrollIntoView({ block: 'nearest' });
    },

    /** Left/Right on the season selector changes season; everywhere else they just do nothing. */
    nudgeSeason: function (step) {
        var select = this.state.panel && this.state.panel.querySelector('.jfx-eps-seasons');
        if (!select || document.activeElement !== select) return;
        var next = Math.min(select.options.length - 1, Math.max(0, select.selectedIndex + step));
        if (next === select.selectedIndex) return;
        select.selectedIndex = next;
        select.dispatchEvent(new Event('change'));
    },

    /* ------------------------------------------------------------------------- panel */

    toggle: function (cfg) {
        if (this.state.open) this.close();
        else this.open(cfg);
    },

    open: function (cfg) {
        var self = this;
        var osd = document.querySelector('#videoOsdPage:not(.hide)');
        var item = JFX.player.state.item;
        if (!osd || !item || !item.SeriesId) return;

        var panel = this.state.panel || (this.state.panel = this.build(cfg));
        if (panel.parentNode !== osd) osd.appendChild(panel);   // last child: above the shelf

        this.state.open = true;
        panel.querySelector('.jfx-eps-series').textContent = item.SeriesName || '';

        this.loadSeasons().then(function (seasons) {
            self.fillSeasons(seasons, item.SeasonId);
            return self.showSeason(item.SeasonId || (seasons[0] && seasons[0].Id), cfg);
        }).catch(function (err) {
            JFX.util.log('episode picker failed', err && err.message);
            panel.querySelector('.jfx-eps-list').innerHTML = '';
            panel.querySelector('.jfx-eps-list').appendChild(
                JFX.util.el('div', 'jfx-eps-empty', JFX.util.t('loadFailed')));
        });

        var land = function () {
            if (!self.state.open || !self.state.panel) return;
            var current = self.state.panel.querySelector('.jfx-eps-item[data-jfx-current]')
                || self.state.panel.querySelector('.jfx-eps-item');
            if (current) current.focus();
        };

        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                if (!self.state.open || !self.state.panel) return;
                self.state.panel.setAttribute('data-jfx-open', '');
                land();
            });
        });

        /* The OSD focuses its own controls when it is shown, and the click that opened the drawer
         * shows it — so the first attempt above loses the race on a TV. Measured: focus ended up on
         * the position slider. Landing again once that has settled is what puts the remote in the
         * list rather than on the seek bar. */
        setTimeout(land, 300);
    },

    close: function () {
        if (!this.state) return;
        this.state.open = false;
        if (this.state.panel) this.state.panel.removeAttribute('data-jfx-open');
        if (this.state.button) this.state.button.focus();
    },

    build: function (cfg) {
        var self = this;
        var el = JFX.util.el;

        var panel = el('div', 'jfx-eps');
        panel.setAttribute('data-jfx-eps', '');

        /* The drawer is a modal surface over a running player, and jellyfin-web listens for input
         * above and below it:
         *
         *   pointerdown on #videoOsdPage  -> play/pause (video/index.js:1795). It stands down only
         *                                    for .videoOsdBottom and .upNextContainer, and the
         *                                    drawer is a child of that same page, so every press
         *                                    inside it toggled playback. `pointerdown` is the one
         *                                    that matters on any browser with PointerEvent —
         *                                    swallowing `mousedown` alone changes nothing.
         *   wheel on document             -> VOLUME (video/index.js:1683). It only stands down for
         *                                    Jellyfin's own dialogs, which this is not, so scrolling
         *                                    the episode list quietly turned the sound down.
         *
         * So every pointer event that starts inside the panel is stopped at the panel — in the BUBBLE
         * phase, deliberately. The panel's own buttons sit below it and have already run by then;
         * stopping in the capture phase would swallow the event before it ever reached them.
         *
         * keydown is NOT in the list: arrow keys are how a TV remote moves through the list, and
         * Escape is handled separately. */
        ['pointerdown', 'pointerup', 'pointercancel', 'mousedown', 'mouseup',
            'click', 'dblclick', 'wheel', 'contextmenu', 'touchstart', 'touchend']
            .forEach(function (type) {
                panel.addEventListener(type, function (e) { e.stopPropagation(); });
            });

        var scrim = el('div', 'jfx-eps-scrim');
        scrim.addEventListener('click', function () { self.close(); });
        panel.appendChild(scrim);

        var sheet = el('div', 'jfx-eps-sheet');
        sheet.setAttribute('role', 'dialog');
        sheet.setAttribute('aria-label', JFX.util.t('episodes'));

        var head = el('div', 'jfx-eps-head');
        head.appendChild(el('div', 'jfx-eps-series'));

        var seasons = el('select', 'jfx-eps-seasons');
        seasons.setAttribute('aria-label', JFX.util.t('episodes'));
        seasons.addEventListener('change', function () { self.showSeason(seasons.value, cfg); });
        head.appendChild(seasons);

        var close = el('button', 'paper-icon-button-light jfx-eps-close');
        close.type = 'button';
        close.title = JFX.util.t('close');
        close.setAttribute('aria-label', JFX.util.t('close'));
        close.innerHTML = '<span class="material-icons close" aria-hidden="true"></span>';
        close.addEventListener('click', function () { self.close(); });
        head.appendChild(close);

        sheet.appendChild(head);
        sheet.appendChild(el('div', 'jfx-eps-list'));
        panel.appendChild(sheet);
        return panel;
    },

    /* -------------------------------------------------------------------------- data */

    loadSeasons: function () {
        var self = this;
        if (this.state.seasons) return Promise.resolve(this.state.seasons);
        var c = JFX.api.ctx();
        if (!c) return Promise.reject(new Error('no api client'));
        return JFX.api.get('/Shows/' + this.state.seriesId + '/Seasons', { userId: c.userId })
            .then(function (data) {
                self.state.seasons = (data && data.Items) || [];
                return self.state.seasons;
            });
    },

    loadEpisodes: function (seasonId) {
        var self = this;
        if (this.state.bySeason[seasonId]) return Promise.resolve(this.state.bySeason[seasonId]);
        var c = JFX.api.ctx();
        if (!c) return Promise.reject(new Error('no api client'));
        return JFX.api.get('/Shows/' + this.state.seriesId + '/Episodes', {
            userId: c.userId,
            seasonId: seasonId,
            Fields: 'Overview,RunTimeTicks'
        }).then(function (data) {
            self.state.bySeason[seasonId] = (data && data.Items) || [];
            return self.state.bySeason[seasonId];
        });
    },

    fillSeasons: function (seasons, currentSeasonId) {
        var select = this.state.panel.querySelector('.jfx-eps-seasons');
        if (select.options.length === seasons.length && select.value) return;
        select.innerHTML = '';
        for (var i = 0; i < seasons.length; i++) {
            var season = seasons[i];
            var option = document.createElement('option');
            option.value = season.Id;
            option.textContent = season.IndexNumber != null
                ? (season.IndexNumber === 0 ? JFX.util.t('specials') : JFX.util.t('season', season.IndexNumber))
                : (season.Name || '');
            if (season.Id === currentSeasonId) option.selected = true;
            select.appendChild(option);
        }
    },

    /* ---------------------------------------------------------------------- rendering */

    showSeason: function (seasonId, cfg) {
        var self = this;
        if (!seasonId) return Promise.resolve();
        var list = this.state.panel.querySelector('.jfx-eps-list');
        return this.loadEpisodes(seasonId).then(function (episodes) {
            list.innerHTML = '';
            if (!episodes.length) {
                list.appendChild(JFX.util.el('div', 'jfx-eps-empty', JFX.util.t('noEpisodes')));
                return;
            }
            var playingId = JFX.player.state.itemId;
            for (var i = 0; i < episodes.length; i++) {
                list.appendChild(self.row(episodes[i], playingId, cfg));
            }
            var current = list.querySelector('.jfx-eps-item[data-jfx-current]');
            if (current && current.scrollIntoView) current.scrollIntoView({ block: 'nearest' });
        });
    },

    row: function (episode, playingId, cfg) {
        var self = this;
        var el = JFX.util.el;

        var item = el('button', 'jfx-eps-item');
        item.type = 'button';
        if (episode.Id === playingId) item.setAttribute('data-jfx-current', '');

        item.appendChild(el('span', 'jfx-eps-index', episode.IndexNumber != null ? String(episode.IndexNumber) : ''));

        if (cfg.thumbnails) {
            var thumb = el('span', 'jfx-eps-thumb');
            var tag = episode.ImageTags && episode.ImageTags.Primary;
            if (tag) {
                var img = el('img');
                img.alt = '';
                img.loading = 'lazy';
                img.decoding = 'async';
                img.src = JFX.api.imageUrl(episode.Id, 'Primary', tag, cfg.thumbWidth);
                thumb.appendChild(img);
            }
            var data = episode.UserData || {};
            if (data.PlaybackPositionTicks && episode.RunTimeTicks) {
                var pct = Math.min(100, (data.PlaybackPositionTicks / episode.RunTimeTicks) * 100);
                var bar = el('span', 'jfx-eps-progress');
                bar.style.width = pct.toFixed(1) + '%';
                thumb.appendChild(bar);
            } else if (data.Played) {
                var check = el('span', 'jfx-eps-played');
                check.innerHTML = '<span class="material-icons check" aria-hidden="true"></span>';
                thumb.appendChild(check);
            }
            item.appendChild(thumb);
        }

        var text = el('span', 'jfx-eps-text');
        text.appendChild(el('span', 'jfx-eps-title', episode.Name || ''));
        if (episode.RunTimeTicks) {
            text.appendChild(el('span', 'jfx-eps-meta', JFX.util.ticksToMinutes(episode.RunTimeTicks) + ' min'));
        }
        if (cfg.showOverview && episode.Overview) {
            text.appendChild(el('span', 'jfx-eps-overview', JFX.util.clamp(episode.Overview, cfg.overviewChars)));
        }
        item.appendChild(text);

        item.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (episode.Id === JFX.player.state.itemId) {
                self.close();                      // already watching this one
                return;
            }
            self.play(episode.Id);
        });

        return item;
    },

    /* ------------------------------------------------------------------------- action */

    play: function (itemId) {
        var self = this;
        this.close();
        JFX.api.session().then(function (session) {
            if (!session || !session.Id) throw new Error('no session for this device');
            return JFX.api.command('/Sessions/' + session.Id + '/Playing', {
                playCommand: 'PlayNow',
                itemIds: itemId
            });
        }).then(function () {
            /* The client tears the player down and builds a new one; the bus notices on its own. */
            JFX.player.forget();
            JFX.util.log('asked this session to play', itemId);
        }).catch(function (err) {
            JFX.util.warn('could not start the episode', err && err.message);
            self.state.bySeason = {};
        });
    }
});

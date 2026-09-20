/* Pause info card — the film/series logo and the synopsis, over the paused frame.
 *
 * What it does: the moment playback stays paused for `delayMs`, a Netflix-style block fades in over
 * the left of the frame with
 *     · the series logo (for an episode) or the film's logo, falling back to its name as text;
 *     · "S1:E4 · Episode title" for an episode;
 *     · year / age rating / runtime / genres, and how much of the file is left;
 *     · the episode's or film's synopsis.
 * It disappears the instant playback resumes, and while scrubbing.
 *
 * Where the data comes from: JFX.player resolves the now-playing item (item id out of the media URL,
 * or /Sessions when the URL is an hls.js blob), then GET /Items/{id} — one request per item, cached.
 *
 * Where it is mounted: inside .videoPlayerContainer, right after the <video>. That keeps it above the
 * picture but below both the OSD and the subtitle layers, with no z-index anywhere — see the header
 * of 50-pause-info.css. The card is pointer-events:none, so it never eats a click meant for the OSD.
 */
JFX.register({
    id: 'pauseInfo',
    title: 'Pause info card',
    defaults: {
        enabled: true,
        delayMs: 350,          // how long playback must stay paused before the card appears
        dim: true,             // darken the whole frame, not just the left ramp
        showLogo: true,        // false = always use the text title
        showOverview: true,
        showRemaining: true,
        overviewChars: 420,    // the synopsis is also line-clamped in CSS; this is the hard cap
        logoMaxWidth: 600      // px requested from the server
    },
    css: '@@css:mods/50-pause-info.css@@',

    init: function (cfg) {
        var self = this;

        JFX.util.addStrings({
            en: { paused: 'Paused', remaining: '%s min left', episodeCode: 'S%s:E%s' },
            pl: { paused: 'Wstrzymano', remaining: 'Pozostało %s min', episodeCode: 'S%s:O%s' },
            de: { paused: 'Pausiert', remaining: 'Noch %s Min.', episodeCode: 'S%s:F%s' },
            es: { paused: 'En pausa', remaining: 'Quedan %s min', episodeCode: 'T%s:E%s' },
            fr: { paused: 'En pause', remaining: '%s min restantes', episodeCode: 'S%s:É%s' }
        });

        this.node = null;
        this.timer = 0;
        this.open = false;

        /* Kept on the module so destroy() can unsubscribe cleanly. */
        this.on = {
            pause: function () { self.arm(cfg); },
            play: function () { self.close(); },
            seeking: function () { self.close(); },
            seeked: function () { if (JFX.player.state.paused) self.arm(cfg); },
            ended: function () { self.close(); },
            detach: function () { self.close(true); },
            item: function (state) { if (self.open && state.item) self.render(state.item, cfg); }
        };
        for (var name in this.on) {
            if (Object.prototype.hasOwnProperty.call(this.on, name)) JFX.player.on(name, this.on[name]);
        }

        // Enabled mid-playback (or the add-on loaded late) and the player is already sitting paused.
        JFX.player.scan();
        if (JFX.player.state.paused) this.arm(cfg);
    },

    destroy: function () {
        for (var name in this.on) {
            if (Object.prototype.hasOwnProperty.call(this.on, name)) JFX.player.off(name, this.on[name]);
        }
        this.close(true);
        this.node = null;
    },

    /* ------------------------------------------------------------- show/hide */

    /* A pause that lasts less than delayMs is almost always a seek or a frame-step, and a card that
     * blinks on every scrub is worse than no card at all. */
    arm: function (cfg) {
        var self = this;
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(function () {
            self.timer = 0;
            self.show(cfg);
        }, cfg.delayMs);
    },

    /* Nothing is mounted until the item is in hand: resolving it can take a couple of seconds on a
     * transcoded stream, and a card that fades in empty and then fills itself in looks broken. When
     * the item is already cached — every pause after the first — this resolves on a microtask. */
    show: function (cfg) {
        var self = this;
        if (!JFX.player.state.paused) return;
        JFX.player.resolveItem().then(function (item) {
            if (JFX.player.state.paused) self.mount(item, cfg);
        }).catch(function () {
            /* Item not identified — say nothing rather than show an empty card. */
        });
    },

    mount: function (item, cfg) {
        var self = this;
        var surface = JFX.player.surface();
        if (!surface) return;

        var node = this.node || (this.node = this.build());
        if (node.parentNode !== surface) {
            var video = surface.querySelector('video');
            if (video && video.nextSibling) surface.insertBefore(node, video.nextSibling);
            else surface.appendChild(node);
        }
        if (cfg.dim) node.classList.add('jfx-pause-dim');
        else node.classList.remove('jfx-pause-dim');

        this.open = true;
        this.render(item, cfg);

        /* Two frames: one for the browser to lay the freshly inserted node out at opacity 0, one for
         * the style change to become a transition rather than an instant paint. */
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                if (self.open && self.node) self.node.setAttribute('data-jfx-open', '');
            });
        });
    },

    /** close(true) also unmounts; a plain close() leaves the faded-out node in place for reuse. */
    close: function (unmount) {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = 0;
        }
        this.open = false;
        if (!this.node) return;
        this.node.removeAttribute('data-jfx-open');
        if (unmount && this.node.parentNode) this.node.parentNode.removeChild(this.node);
    },

    /* ------------------------------------------------------------- rendering */

    build: function () {
        var el = JFX.util.el;
        var node = el('div', 'jfx-pause');
        node.setAttribute('data-jfx-pause', '');
        node.appendChild(el('div', 'jfx-pause-scrim'));

        var body = el('div', 'jfx-pause-body');
        var eyebrow = el('div', 'jfx-pause-eyebrow');
        eyebrow.appendChild(el('span', 'jfx-pause-glyph'));
        eyebrow.appendChild(el('span', null, JFX.util.t('paused')));
        body.appendChild(eyebrow);

        var logo = el('img', 'jfx-pause-logo');
        logo.alt = '';
        logo.decoding = 'async';
        logo.style.display = 'none';
        body.appendChild(logo);

        body.appendChild(el('div', 'jfx-pause-title'));
        body.appendChild(el('div', 'jfx-pause-subtitle'));
        body.appendChild(el('div', 'jfx-pause-meta'));
        body.appendChild(el('p', 'jfx-pause-overview'));
        node.appendChild(body);
        return node;
    },

    render: function (item, cfg) {
        var self = this;
        var node = this.node;
        if (!node || !item) return;
        var isEpisode = item.Type === 'Episode';
        node.setAttribute('data-jfx-pause-type', item.Type || '');

        /* --- logo, or the name as text ------------------------------------ */
        var headline = (isEpisode ? item.SeriesName : item.Name) || item.Name || '';
        var logo = node.querySelector('.jfx-pause-logo');
        var title = node.querySelector('.jfx-pause-title');
        var logoId = isEpisode ? (item.ParentLogoItemId || item.SeriesId) : item.Id;
        var logoTag = isEpisode ? item.ParentLogoImageTag : (item.ImageTags && item.ImageTags.Logo);

        title.textContent = headline;
        if (cfg.showLogo && logoId && logoTag) {
            logo.src = JFX.api.imageUrl(logoId, 'Logo', logoTag, cfg.logoMaxWidth);
            logo.alt = headline;
            logo.style.display = '';
            title.style.display = 'none';
        } else {
            logo.removeAttribute('src');
            logo.style.display = 'none';
            title.style.display = '';

            /* Some servers do not stamp ParentLogo* onto the episode DTO. Ask the series itself once;
             * the answer is cached, and re-rendering swaps the text headline for the logo. */
            if (cfg.showLogo && isEpisode && !logoTag && item.SeriesId) {
                JFX.api.getItem(item.SeriesId).then(function (series) {
                    var tag = series.ImageTags && series.ImageTags.Logo;
                    if (!tag || !self.open) return;
                    item.ParentLogoItemId = series.Id;
                    item.ParentLogoImageTag = tag;
                    self.render(item, cfg);
                }).catch(function () { /* no logo, the text headline stands */ });
            }
        }

        /* --- "S1:E4 · Episode title" --------------------------------------- */
        var subtitle = node.querySelector('.jfx-pause-subtitle');
        var parts = [];
        if (isEpisode) {
            if (item.ParentIndexNumber != null && item.IndexNumber != null) {
                parts.push(JFX.util.t('episodeCode', item.ParentIndexNumber, item.IndexNumber));
            }
            if (item.Name) parts.push(item.Name);
        }
        subtitle.textContent = parts.join(' · ');
        subtitle.style.display = parts.length ? '' : 'none';

        /* --- year · rating · runtime · genres · time left ------------------- */
        var bits = [];
        if (!isEpisode && item.ProductionYear) bits.push(String(item.ProductionYear));
        if (item.OfficialRating) bits.push(item.OfficialRating);
        if (item.RunTimeTicks) bits.push(JFX.util.ticksToMinutes(item.RunTimeTicks) + ' min');
        if (!isEpisode && item.Genres && item.Genres.length) bits.push(item.Genres.slice(0, 3).join(' • '));
        if (cfg.showRemaining) {
            var left = JFX.player.remaining();
            if (left >= 60) bits.push(JFX.util.t('remaining', Math.round(left / 60)));
        }
        var meta = node.querySelector('.jfx-pause-meta');
        meta.textContent = bits.join('  ·  ');
        meta.style.display = bits.length ? '' : 'none';

        /* --- synopsis ------------------------------------------------------ */
        var overview = node.querySelector('.jfx-pause-overview');
        var text = cfg.showOverview ? JFX.util.clamp(item.Overview || '', cfg.overviewChars) : '';
        overview.textContent = text;
        overview.style.display = text ? '' : 'none';
    }
});

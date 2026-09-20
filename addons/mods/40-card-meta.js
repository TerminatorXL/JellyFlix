/* data-jfx-overview / -genres / -runtime on home cards.
 *
 * The synopsis, the genres and the runtime are simply not in the card DOM, and CSS cannot fetch —
 * so this is the only route to an expanded hover card, and it keeps 100 % of the styling in CSS
 * (content: attr(data-jfx-overview)). Off by default: it costs one /Items request per batch.
 */
JFX.register({
    id: 'cardMeta',
    title: 'Card metadata',
    defaults: { enabled: false, batchSize: 60, overviewChars: 240 },

    tick: function (cfg) {
        var self = this;
        if (this.busy) return;                       // one /Items batch in flight at a time
        var container = JFX.home.container();
        if (!container) return;
        var c = JFX.api.ctx();
        if (!c) return;                              // logged out — nothing to ask, nothing to tag

        var cards = container.querySelectorAll('.card[data-id]:not([data-jfx-meta])');
        var ids = [];
        Array.prototype.forEach.call(cards, function (card) {
            var id = card.getAttribute('data-id');
            if (id && ids.indexOf(id) === -1) ids.push(id);
        });
        if (!ids.length) return;

        this.busy = true;
        JFX.api.get('/Items', {
            userId: c.userId,
            ids: ids.slice(0, cfg.batchSize).join(','),
            Fields: 'Overview,Genres,RunTimeTicks'
        }).then(function (data) {
            self.busy = false;
            var byId = {};
            var got = (data && data.Items) || [];
            for (var i = 0; i < got.length; i++) byId[got[i].Id] = got[i];
            Array.prototype.forEach.call(cards, function (card) {
                var item = byId[card.getAttribute('data-id')];
                if (!item) return;
                /* Marked BEFORE the optional attributes, so an item with no synopsis is still
                 * considered done and never comes back round on the next mutation. */
                card.setAttribute('data-jfx-meta', '1');
                if (item.Overview) {
                    card.setAttribute('data-jfx-overview', JFX.util.clamp(item.Overview, cfg.overviewChars));
                }
                if (item.Genres && item.Genres.length) {
                    card.setAttribute('data-jfx-genres', item.Genres.slice(0, 3).join(' • '));
                }
                if (item.RunTimeTicks) {
                    card.setAttribute('data-jfx-runtime', JFX.util.ticksToMinutes(item.RunTimeTicks) + ' min');
                }
            });
        }).catch(function (err) {
            self.busy = false;
            JFX.util.log('cardMeta failed', err && err.message);
        });
    },

    destroy: function () {
        this.busy = false;
        var tagged = document.querySelectorAll('[data-jfx-meta]');
        Array.prototype.forEach.call(tagged, function (card) {
            card.removeAttribute('data-jfx-meta');
            card.removeAttribute('data-jfx-overview');
            card.removeAttribute('data-jfx-genres');
            card.removeAttribute('data-jfx-runtime');
        });
    }
});

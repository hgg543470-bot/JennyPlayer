// ============================================================================
// 🎬 WORKER_DECK_B.JS — ИЗОЛИРОВАННЫЙ ФОНОВЫЙ ПОТОК ВИДЕОДЕКИ Б (:8082)
// Фоновая прокачка бинарных сегментов реверса и распаковка PCM вне потока экрана
// ============================================================================
'use strict';

var activeControllers = {};

function resolveDeckBUrl(rawUrl) {
    if (!rawUrl) return '';
    if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
    return 'http://127.0.0.1:8082' + (rawUrl.charAt(0) === '/' ? rawUrl : ('/' + rawUrl));
}

self.onmessage = async function(ev) {
    var msg = ev.data || {};
    var id = msg.id;
    var cmd = msg.cmd;

    if (cmd === 'abort_task') {
        var targetId = msg.targetId;
        if (targetId && activeControllers[targetId]) {
            try { activeControllers[targetId].abort(); } catch (e) {}
            delete activeControllers[targetId];
        }
        return;
    }

    if (cmd === 'fetch_rev_blob') {
        var ctrl = new AbortController();
        activeControllers[id] = ctrl;
        var primaryUrl = resolveDeckBUrl(msg.url);
        var fallbackUrl = (msg.origin || 'http://127.0.0.1:8080') + (msg.url.charAt(0) === '/' ? msg.url : ('/' + msg.url));

        try {
            var res = null;
            try {
                res = await fetch(primaryUrl, { signal: ctrl.signal, cache: 'no-store' });
            } catch (netErr) {
                if (ctrl.signal.aborted) throw netErr;
                res = await fetch(fallbackUrl, { signal: ctrl.signal, cache: 'no-store' });
            }
            if (!res || !res.ok) {
                throw new Error('HTTP ' + (res ? res.status : 0));
            }
            var ab = await res.arrayBuffer();
            delete activeControllers[id];
            self.postMessage(
                { id: id, ok: true, buffer: ab, contentType: res.headers.get('Content-Type') || 'video/mp4' },
                [ab]
            );
        } catch (err) {
            delete activeControllers[id];
            self.postMessage({ id: id, ok: false, aborted: Boolean(ctrl.signal.aborted), error: String((err && err.message) || err) });
        }
        return;
    }
};

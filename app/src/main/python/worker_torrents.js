// ============================================================================
// 🧲 WORKER_TORRENTS.JS — ИЗОЛИРОВАННЫЙ ФОНОВЫЙ ПОТОК ТОРРЕНТОВ И P2P-СТАТУСА
// Сетевой опрос и тяжёлый JSON.parse крутятся здесь, не дёргая поток интерфейса
// ============================================================================
'use strict';

var pollTimer = null;
var isPollingNow = false;
var fastMode = false;
var originFallback = 'http://127.0.0.1:8080';

// Взаимно простые интервалы (1153 мс активный / 3571 мс спящий), чтобы никогда не совпадать с Деками А и Б
var ACTIVE_INTERVAL_MS = 1153;
var IDLE_INTERVAL_MS = 3571;

async function fetchJsonWithPort8083Fallback(relPath) {
    var url8083 = 'http://127.0.0.1:8083' + relPath;
    try {
        var r1 = await fetch(url8083, { cache: 'no-store' });
        if (r1 && r1.ok) return await r1.json();
    } catch (e1) {}
    var r2 = await fetch(originFallback + relPath, { cache: 'no-store' });
    if (r2 && r2.ok) return await r2.json();
    return null;
}

async function runSinglePoll(reqId) {
    if (isPollingNow && !reqId) return;
    isPollingNow = true;
    try {
        var results = await Promise.all([
            fetchJsonWithPort8083Fallback('/api/torrent/status').catch(function() { return null; }),
            fetchJsonWithPort8083Fallback('/api/sources/live_badges').catch(function() { return null; })
        ]);

        var statusObj = results[0];
        var badgesObj = results[1];
        var list = (statusObj && Array.isArray(statusObj.torrents)) ? statusObj.torrents : [];

        var hasActiveTransfer = false;
        for (var i = 0; i < list.length; i++) {
            var t = list[i];
            if ((t.speed_kbps || 0) > 0) {
                hasActiveTransfer = true;
                break;
            }
            var files = t.files || [];
            if (!t.paused && files.some(function(f) { return !f.done; })) {
                hasActiveTransfer = true;
                break;
            }
        }

        self.postMessage({
            type: 'torrent_snapshot',
            reqId: reqId || 0,
            ok: Boolean(statusObj),
            statusObj: statusObj,
            badgesObj: badgesObj,
            hasActiveTransfer: hasActiveTransfer,
            ts: Date.now()
        });

        scheduleNextTick(hasActiveTransfer || fastMode);
    } catch (err) {
        self.postMessage({
            type: 'torrent_snapshot',
            reqId: reqId || 0,
            ok: false,
            error: String((err && err.message) || err),
            ts: Date.now()
        });
        scheduleNextTick(fastMode);
    } finally {
        isPollingNow = false;
    }
}

function scheduleNextTick(useFast) {
    if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
    }
    var delay = useFast ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS;
    pollTimer = setTimeout(function() {
        runSinglePoll(0);
    }, delay);
}

self.onmessage = function(ev) {
    var msg = ev.data || {};
    if (msg.origin) originFallback = msg.origin;

    if (msg.cmd === 'start') {
        fastMode = Boolean(msg.fast);
        runSinglePoll(msg.reqId || 0);
        return;
    }
    if (msg.cmd === 'set_mode') {
        var prev = fastMode;
        fastMode = Boolean(msg.fast);
        if (fastMode && !prev) {
            runSinglePoll(0);
        } else {
            scheduleNextTick(fastMode);
        }
        return;
    }
    if (msg.cmd === 'poll_now') {
        runSinglePoll(msg.reqId || 0);
        return;
    }
};

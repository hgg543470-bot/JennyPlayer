// ============================================================================
// 🛡️ ISOLATION_BUS.JS — РАЗВЕДЕНИЕ ПОТОКОВ И АВТОМАТЫ ЗАЩИТЫ (ДЕКА А | ДЕКА Б | ТОРРЕНТЫ)
// Ни одно исключение в одной подсистеме физически не может остановить две другие.
// ============================================================================
(function() {
    'use strict';
    if (window.__jennyIsolationBusInstalled) return;
    window.__jennyIsolationBusInstalled = true;

    var seenErrors = {};
    window._jennyIsolationStats = {
        deckA:    { errors: 0, lastError: '', workerAlive: false },
        deckB:    { errors: 0, lastError: '', workerAlive: false },
        torrents: { errors: 0, lastError: '', workerAlive: false }
    };

    function reportContainedFault(scopeTag, scopeKey, err) {
        var st = window._jennyIsolationStats[scopeKey];
        var msg = (err && err.message) ? err.message : String(err || 'Unknown error');
        if (st) {
            st.errors++;
            st.lastError = msg;
        }
        var dedupKey = scopeKey + '::' + msg;
        var now = Date.now();
        if (seenErrors[dedupKey] && (now - seenErrors[dedupKey] < 15000)) {
            return;
        }
        seenErrors[dedupKey] = now;
        try {
            console.warn('[' + scopeTag + ' изолирован сбой]:', err);
        } catch (e) {}
    }

    // Автоматы защиты для синхронных и асинхронных контуров каждой подсистемы
    window.runIsolatedDeckA = function(fn) {
        try {
            return fn();
        } catch (err) {
            reportContainedFault('Дека А', 'deckA', err);
            return undefined;
        }
    };

    window.runIsolatedDeckB = function(fn) {
        try {
            return fn();
        } catch (err) {
            reportContainedFault('Дека Б', 'deckB', err);
            return undefined;
        }
    };

    window.runIsolatedTorrents = function(fn) {
        try {
            return fn();
        } catch (err) {
            reportContainedFault('Торренты', 'torrents', err);
            return undefined;
        }
    };

    // ------------------------------------------------------------------------
    // 1. Поток #1: Аудиодека А (worker_deck_a.js)
    // ------------------------------------------------------------------------
    var deckAWorker = null;
    var deckASeq = 1;
    var deckAPending = {};

    function ensureDeckAWorker() {
        if (deckAWorker) return deckAWorker;
        if (typeof Worker === 'undefined') return null;
        try {
            deckAWorker = new Worker('/worker_deck_a.js?v=352');
            window._jennyIsolationStats.deckA.workerAlive = true;
            deckAWorker.onmessage = function(ev) {
                var d = ev.data || {};
                var cb = deckAPending[d.id];
                if (cb) {
                    delete deckAPending[d.id];
                    cb(d);
                }
            };
            deckAWorker.onerror = function(err) {
                window._jennyIsolationStats.deckA.workerAlive = false;
                reportContainedFault('Worker Деки А', 'deckA', err);
                try { deckAWorker.terminate(); } catch (e) {}
                deckAWorker = null;
                Object.keys(deckAPending).forEach(function(k) {
                    var fn = deckAPending[k];
                    delete deckAPending[k];
                    try { fn({ ok: false, error: 'worker_restarted' }); } catch (e) {}
                });
            };
        } catch (e) {
            deckAWorker = null;
        }
        return deckAWorker;
    }

    window.reverseAudioBufferInDeckAWorker = function(originalBuffer, audioCtx) {
        return new Promise(function(resolve) {
            if (!originalBuffer || !audioCtx) {
                resolve(null);
                return;
            }
            var w = ensureDeckAWorker();
            if (!w) {
                resolve(null);
                return;
            }
            try {
                var numCh = originalBuffer.numberOfChannels;
                var len = originalBuffer.length;
                var sr = originalBuffer.sampleRate;
                var copies = new Array(numCh);
                var transfers = new Array(numCh);
                for (var c = 0; c < numCh; c++) {
                    var copyArr = new Float32Array(originalBuffer.getChannelData(c));
                    copies[c] = copyArr.buffer;
                    transfers[c] = copyArr.buffer;
                }
                var reqId = deckASeq++;
                deckAPending[reqId] = function(res) {
                    if (!res || !res.ok || !Array.isArray(res.channels)) {
                        resolve(null);
                        return;
                    }
                    try {
                        if (typeof res.rmsDb === 'number' && isFinite(res.rmsDb)) {
                            originalBuffer._lockedRmsDbV72 = res.rmsDb;
                        }
                        var revBuf = audioCtx.createBuffer(numCh, len, sr);
                        for (var ch = 0; ch < numCh; ch++) {
                            revBuf.getChannelData(ch).set(new Float32Array(res.channels[ch]));
                        }
                        if (typeof res.rmsDb === 'number' && isFinite(res.rmsDb)) {
                            revBuf._lockedRmsDbV72 = res.rmsDb;
                        }
                        resolve(revBuf);
                    } catch (err) {
                        reportContainedFault('Дека А Буфер', 'deckA', err);
                        resolve(null);
                    }
                };
                w.postMessage({ id: reqId, cmd: 'reverse_and_rms', channels: copies }, transfers);
            } catch (err) {
                reportContainedFault('Дека А Передача', 'deckA', err);
                resolve(null);
            }
        });
    };

    // ------------------------------------------------------------------------
    // 2. Поток #2: Видеодека Б (worker_deck_b.js)
    // ------------------------------------------------------------------------
    var deckBWorker = null;
    var deckBSeq = 1;
    var deckBPending = {};

    function ensureDeckBWorker() {
        if (deckBWorker) return deckBWorker;
        if (typeof Worker === 'undefined') return null;
        try {
            deckBWorker = new Worker('/worker_deck_b.js?v=352');
            window._jennyIsolationStats.deckB.workerAlive = true;
            deckBWorker.onmessage = function(ev) {
                var d = ev.data || {};
                var cb = deckBPending[d.id];
                if (cb) {
                    delete deckBPending[d.id];
                    cb(d);
                }
            };
            deckBWorker.onerror = function(err) {
                window._jennyIsolationStats.deckB.workerAlive = false;
                reportContainedFault('Worker Деки Б', 'deckB', err);
                try { deckBWorker.terminate(); } catch (e) {}
                deckBWorker = null;
                Object.keys(deckBPending).forEach(function(k) {
                    var fn = deckBPending[k];
                    delete deckBPending[k];
                    try { fn({ ok: false, error: 'worker_restarted' }); } catch (e) {}
                });
            };
        } catch (e) {
            deckBWorker = null;
        }
        return deckBWorker;
    }

    window.fetchRevBlobInDeckBWorker = function(relUrl, abortSignal) {
        return new Promise(function(resolve, reject) {
            var w = ensureDeckBWorker();
            if (!w) {
                reject(new Error('no_deck_b_worker'));
                return;
            }
            var reqId = deckBSeq++;
            var onAbort = function() {
                if (deckBPending[reqId]) {
                    delete deckBPending[reqId];
                    try { w.postMessage({ cmd: 'abort_task', targetId: reqId }); } catch (e) {}
                    reject(new Error('Aborted'));
                }
            };
            if (abortSignal) {
                if (abortSignal.aborted) {
                    reject(new Error('Aborted'));
                    return;
                }
                abortSignal.addEventListener('abort', onAbort, { once: true });
            }
            deckBPending[reqId] = function(res) {
                if (abortSignal) {
                    try { abortSignal.removeEventListener('abort', onAbort); } catch (e) {}
                }
                if (res && res.ok && res.buffer) {
                    resolve(new Blob([res.buffer], { type: res.contentType || 'video/mp4' }));
                } else {
                    reject(new Error((res && res.error) || 'Blob worker failed'));
                }
            };
            w.postMessage({
                id: reqId,
                cmd: 'fetch_rev_blob',
                url: relUrl,
                origin: window.location.origin
            });
        });
    };

    // ------------------------------------------------------------------------
    // 3. Поток #3: Торренты P2P (worker_torrents.js)
    // ------------------------------------------------------------------------
    var torWorker = null;
    var torReqSeq = 1;
    var torWaiters = {};
    window._latestTorWorkerSnap = null;

    function ensureTorrentsWorker() {
        if (torWorker) return torWorker;
        if (typeof Worker === 'undefined') return null;
        try {
            torWorker = new Worker('/worker_torrents.js?v=352');
            window._jennyIsolationStats.torrents.workerAlive = true;
            torWorker.onmessage = function(ev) {
                var d = ev.data || {};
                if (d.type === 'torrent_snapshot') {
                    if (d.ok && d.statusObj) {
                        window._latestTorWorkerSnap = d;
                        if (d.badgesObj && d.badgesObj.torrent_enc) {
                            window._lastTorEncBadgeV212 = d.badgesObj.torrent_enc;
                        }
                    }
                    if (d.reqId && torWaiters[d.reqId]) {
                        var waiter = torWaiters[d.reqId];
                        delete torWaiters[d.reqId];
                        waiter(d);
                    } else if (d.ok && typeof window._onTorWorkerAutoPush === 'function') {
                        window.runIsolatedTorrents(function() {
                            window._onTorWorkerAutoPush(d);
                        });
                    }
                }
            };
            torWorker.onerror = function(err) {
                window._jennyIsolationStats.torrents.workerAlive = false;
                reportContainedFault('Worker Торрентов', 'torrents', err);
                try { torWorker.terminate(); } catch (e) {}
                torWorker = null;
            };
            torWorker.postMessage({ cmd: 'start', fast: false, origin: window.location.origin });
        } catch (e) {
            torWorker = null;
        }
        return torWorker;
    }

    window.requestTorrentWorkerSnapshot = function(maxFreshAgeMs) {
        var ageLimit = typeof maxFreshAgeMs === 'number' ? maxFreshAgeMs : 450;
        var cached = window._latestTorWorkerSnap;
        if (cached && cached.ok && cached.statusObj && (Date.now() - cached.ts) <= ageLimit) {
            return Promise.resolve(cached.statusObj);
        }
        var w = ensureTorrentsWorker();
        if (!w) return Promise.resolve(null);
        return new Promise(function(resolve) {
            var rId = torReqSeq++;
            var timer = setTimeout(function() {
                if (torWaiters[rId]) {
                    delete torWaiters[rId];
                    resolve(cached ? cached.statusObj : null);
                }
            }, 2200);
            torWaiters[rId] = function(snap) {
                clearTimeout(timer);
                resolve((snap && snap.ok && snap.statusObj) ? snap.statusObj : null);
            };
            try {
                w.postMessage({ cmd: 'poll_now', reqId: rId, origin: window.location.origin });
            } catch (e) {
                clearTimeout(timer);
                delete torWaiters[rId];
                resolve(null);
            }
        });
    };

    window.setTorrentWorkerFastMode = function(isFast) {
        var w = ensureTorrentsWorker();
        if (w) {
            try { w.postMessage({ cmd: 'set_mode', fast: Boolean(isFast), origin: window.location.origin }); } catch (e) {}
        }
    };

    // Прогреваем все 3 изолированных потока после старта окна со сдвигом фазы
    setTimeout(function() {
        ensureDeckAWorker();
        setTimeout(ensureDeckBWorker, 37);
        setTimeout(ensureTorrentsWorker, 79);
    }, 120);
})();

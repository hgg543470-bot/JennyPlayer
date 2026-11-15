/* ============================================================================
 * ui_net.js — Сеть: маршрутизатор портов, перехваты fetch/XHR/src/play()
 *
 * Склейка:  /bundle_2_player.js, модуль 14 из 18. Порядок модулей задан в player.py и менять его нельзя:
 *           поздние модули переопределяют и оборачивают функции ранних.
 * Внутри:   stripJennyLocalOriginV238, pickJennyPortForPathV238, routeJennyApiUrlV238, fetch, refreshClusterTelemetryBadgeV238, fetchTorrentEngineLogV238
 * Откуда:   ui_v71.js (коммит 9ae6639), строки 29520…35609 (7 фрагментов, вперемешку с другими темами). Код блоков перенесён без правок.
 * Подробно: FILES.md (карта файлов), REFACTOR_PLAN.md (как резалось и что перекрыто).
 * ============================================================================ */


/* [split] V232: кусок исходного IIFE (ui_v71.js, строки 29055–29548) → ui_net.js */
;(function() {
    if (window._jennyV232Installed__net) return;
    window._jennyV232Installed__net = true;
    window._jennyV232Installed = true;

    if (typeof HTMLMediaElement !== 'undefined' && HTMLMediaElement.prototype && !HTMLMediaElement.prototype._jennyV232PlayHooked) {
        HTMLMediaElement.prototype._jennyV232PlayHooked = true;
        var _origMediaPlayV232 = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function() {
            try {
                var mainPlayer = document.getElementById('audioPlayer');
                var mainVideo = document.getElementById('jennyVideoElV130');
                // Если запускается любой внешний <audio> поток (Радиоэфир, Game OST, SoundCloud, Торрент-предпрослушка, Архивы) —
                // мгновенно и безусловно ставим на паузу основную аудиодеку Деку А!
                if (this && this !== mainPlayer && this !== mainVideo && String(this.tagName || '').toUpperCase() === 'AUDIO') {
                    window.forceStopPauseDeckAAudioV232(false);
                }
            } catch (e) {}
            return _origMediaPlayV232.apply(this, arguments);
        };
    }
})();
/* ================= END JENNY_V237_KILL_SWITCH_ZERO_TWITCH_INSTANT_FOLDERS_DATASYNC_AND_EXT_PAUSE_PATCH ================= */

/* ================= BEGIN JENNY_V238_MULTI_PORT_SMART_ROUTER_AND_JNI_FOLDERS_PATCH ================= */
/* [split] V238: кусок исходного IIFE (ui_v71.js, строки 32554–32910) → ui_net.js */
;(function() {
    if (window._jennyV238MultiPortInstalled__net) return;
    window._jennyV238MultiPortInstalled__net = true;
    window._jennyV238MultiPortInstalled = true;

    // Active local cluster ports (bound synchronously in player.py BEFORE :8080 serves index.html)
    window._jennyClusterPortsV238 = {
        8080: true, // VIP UI / Folders / Config / Metadata
        8081: true, // Deck A Audio / xFLAC / PCM Chunks (+ WebView shouldInterceptRequest Direct Disk!)
        8082: true, // Deck B Video / FFmpeg Live Remux / Reverse Remux / Torrent Video Stream
        8083: true  // Heavy Background: P2P Status/Search/Download, YouTube, OST, SoundCloud, Radio, Export
    };

    window._jennyRouterTelemetryV238 = {
        p8080: 0,
        p8081: 0,
        p8082: 0,
        p8083: 0,
        jniFolders: 0
    };

    // Strip http://127.0.0.1:<port> or http://localhost:<port> back to relative "/api/..."
    window.stripJennyLocalOriginV238 = function(u) {
        if (!u || typeof u !== 'string') return u;
        var m = u.match(/^https?:\/\/(?:127\.0\.0\.1|localhost):\d+(\/.*)$/i);
        return m ? m[1] : u;
    };

    // Choose optimal dedicated port (8080..8083) for a given "/api/..." path
    window.pickJennyPortForPathV238 = function(relPath, mediaTagHint) {
        if (!relPath || typeof relPath !== 'string' || relPath.charAt(0) !== '/') return 8080;

        // Explicit HTMLMediaElement hint (<video> vs <audio>)
        if (mediaTagHint === 'VIDEO') {
            return window._jennyClusterPortsV238[8082] ? 8082 : 8080;
        }
        if (mediaTagHint === 'AUDIO') {
            if (
                relPath.indexOf('/api/radio/') === 0 ||
                relPath.indexOf('/api/soundcloud/') === 0 ||
                relPath.indexOf('/api/khinsider/') === 0 ||
                relPath.indexOf('/api/youtube/') === 0
            ) {
                return window._jennyClusterPortsV238[8083] ? 8083 : 8080;
            }
            return window._jennyClusterPortsV238[8081] ? 8081 : 8080;
        }

        // 1. Deck B Video & Live Remux & VCore .SO & Torrent Video Stream -> :8082
        if (
            relPath.indexOf('/api/video/') === 0 ||
            relPath.indexOf('/api/vcore/') === 0 ||
            relPath.indexOf('/api/torrent/stream/') === 0 ||
            relPath.indexOf('/api/torrent/seek_boost') === 0
        ) {
            return window._jennyClusterPortsV238[8082] ? 8082 : 8080;
        }

        // 2. Deck A Audio & PCM Chunk Engine -> :8081
        // Note: GET /api/media/<local_file> is ALSO intercepted in 0ms by MainActivity.shouldInterceptRequest!
        if (
            relPath.indexOf('/api/media/') === 0 ||
            relPath.indexOf('/api/pcm_meta_v71/') === 0 ||
            relPath.indexOf('/api/pcm_chunk_v71/') === 0 ||
            relPath.indexOf('/api/track_rev_data/') === 0
        ) {
            return window._jennyClusterPortsV238[8081] ? 8081 : 8080;
        }

        // 3. Heavy Background Modules (P2P Torrent polling/search/add, Omni P2P Core, YouTube, OST, SoundCloud, Radio, Export) -> :8083
        if (
            relPath.indexOf('/api/torrent/') === 0 ||
            relPath.indexOf('/api/omni/') === 0 ||
            relPath.indexOf('/api/sources/') === 0 ||
            relPath.indexOf('/api/youtube/') === 0 ||
            relPath.indexOf('/api/khinsider/') === 0 ||
            relPath.indexOf('/api/soundcloud/') === 0 ||
            relPath.indexOf('/api/radio/') === 0 ||
            relPath.indexOf('/api/export') === 0
        ) {
            return window._jennyClusterPortsV238[8083] ? 8083 : 8080;
        }

        // 4. VIP Instant UI (/api/folders_v71, /api/data, /api/config, /api/user_data/*, /api/track_info, /api/threads/config) -> :8080
        return 8080;
    };

    window.routeJennyApiUrlV238 = function(rawUrl, mediaTagHint) {
        if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
        if (rawUrl.indexOf('blob:') === 0 || rawUrl.indexOf('data:') === 0) return rawUrl;
        var rel = window.stripJennyLocalOriginV238(rawUrl);
        if (!rel || rel.indexOf('/api/') !== 0) {
            return rawUrl;
        }
        var targetPort = window.pickJennyPortForPathV238(rel, mediaTagHint);
        var counterKey = 'p' + targetPort;
        if (window._jennyRouterTelemetryV238[counterKey] !== undefined) {
            window._jennyRouterTelemetryV238[counterKey]++;
        }
        // Keep port 8080 requests same-origin when page itself is on 127.0.0.1:8080,
        // and use explicit IPv4 127.0.0.1:<port> for dedicated worker ports (zero DNS/IPv6 ::1 lookup delay!)
        if (targetPort === 8080 && window.location && window.location.port === '8080') {
            return rel;
        }
        return 'http://127.0.0.1:' + targetPort + rel;
    };

    // -------------------------------------------------------------------------
    // 1. TRANSPARENT MULTI-PORT FETCH & XHR ROUTER WITH AUTOMATIC :8080 FALLBACK
    // -------------------------------------------------------------------------
    var _nativeFetchV238 = window.fetch.bind(window);
    window.fetch = function(input, init) {
        if (typeof input === 'string') {
            var rel = window.stripJennyLocalOriginV238(input);
            if (rel && rel.indexOf('/api/') === 0) {
                if (rel.indexOf('/api/folders_v71') === 0 && init && String(init.method || 'GET').toUpperCase() === 'POST') {
                    if (window.AndroidBridge && typeof window.AndroidBridge.invalidatePresetFolderCache === 'function') {
                        try { window.AndroidBridge.invalidatePresetFolderCache(); } catch (e) {}
                    }
                }
                var routedUrl = window.routeJennyApiUrlV238(rel, null);
                var isSecondaryPort = (routedUrl.indexOf('http://127.0.0.1:808') === 0 && routedUrl.indexOf('http://127.0.0.1:8080/') !== 0);
                if (!isSecondaryPort) {
                    return _nativeFetchV238(routedUrl, init);
                }
                return _nativeFetchV238(routedUrl, init).catch(function(err) {
                    if (err && (err.name === 'AbortError' || (init && init.signal && init.signal.aborted))) {
                        throw err;
                    }
                    return _nativeFetchV238('http://127.0.0.1:8080' + rel, init);
                });
            }
        }
        return _nativeFetchV238(input, init);
    };

    if (window.XMLHttpRequest && window.XMLHttpRequest.prototype && window.XMLHttpRequest.prototype.open) {
        var _origXhrOpenV238 = window.XMLHttpRequest.prototype.open;
        window.XMLHttpRequest.prototype.open = function(method, url) {
            if (typeof url === 'string') {
                var rel = window.stripJennyLocalOriginV238(url);
                if (rel && rel.indexOf('/api/') === 0) {
                    var args = Array.prototype.slice.call(arguments);
                    args[1] = window.routeJennyApiUrlV238(rel, null);
                    return _origXhrOpenV238.apply(this, args);
                }
            }
            return _origXhrOpenV238.apply(this, arguments);
        };
    }

    // -------------------------------------------------------------------------
    // 2. HTMLMediaElement (<audio> & <video>) MULTI-PORT ROUTER + CORS SAFETY
    // -------------------------------------------------------------------------
    try {
        var mediaProto = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
        var origSrcDesc = mediaProto ? Object.getOwnPropertyDescriptor(mediaProto, 'src') : null;
        if (origSrcDesc && typeof origSrcDesc.set === 'function' && typeof origSrcDesc.get === 'function') {
            Object.defineProperty(mediaProto, 'src', {
                configurable: true,
                enumerable: origSrcDesc.enumerable,
                get: function() {
                    return origSrcDesc.get.call(this);
                },
                set: function(val) {
                    if (typeof val === 'string' && val.length > 0 && val.indexOf('blob:') !== 0 && val.indexOf('data:') !== 0) {
                        var rel = window.stripJennyLocalOriginV238(val);
                        if (rel && rel.indexOf('/api/') === 0) {
                            if (this.crossOrigin !== 'anonymous') {
                                try { this.crossOrigin = 'anonymous'; } catch (e) {}
                            }
                            var tagHint = (this.tagName === 'VIDEO' || this.id === 'jennyVideoElV130') ? 'VIDEO' : 'AUDIO';
                            var routed = window.routeJennyApiUrlV238(rel, tagHint);
                            return origSrcDesc.set.call(this, routed);
                        }
                    }
                    return origSrcDesc.set.call(this, val);
                }
            });
        }
    } catch (e) {}

    // Verify active cluster ports once on boot via /api/multiport/ping
    setTimeout(function() {
        _nativeFetchV238('/api/multiport/ping').then(function(r) { return r.json(); }).then(function(info) {
            if (info && Array.isArray(info.ports)) {
                [8081, 8082, 8083].forEach(function(p) {
                    window._jennyClusterPortsV238[p] = (info.ports.indexOf(p) !== -1);
                });
            }
        }).catch(function() {});
    }, 800);

    // -------------------------------------------------------------------------
    // 4. LIVE CLUSTER & DIRECT DISK TELEMETRY BADGE INSIDE THREAD SETTINGS
    // -------------------------------------------------------------------------
    window.refreshClusterTelemetryBadgeV238 = function() {
        var el = document.getElementById('jennyClusterStatusBadgeV238');
        if (!el) return;
        var directHits = 0;
        if (window.AndroidBridge && typeof window.AndroidBridge.getDirectEngineStatsJson === 'function') {
            try {
                var st = JSON.parse(window.AndroidBridge.getDirectEngineStatsJson() || '{}');
                directHits = Number(st.direct_hits || 0);
            } catch (e) {}
        }
        var p = window._jennyClusterPortsV238;
        var pill = function(port, label, color) {
            var ok = Boolean(p[port]);
            return '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border-radius:5px;background:#161b22;border:1px solid ' + (ok ? color : '#30363d') + ';color:' + (ok ? color : '#8b949e') + ';font-size:10.5px;font-weight:bold;">' +
                (ok ? '●' : '○') + ' :' + port + ' ' + label +
            '</span>';
        };
        el.innerHTML =
            '<div style="font-weight:bold;color:#3fb950;font-size:11.5px;margin-bottom:5px;">🚀 Движок V238: Прямой диск Java + 4 независимых порта (24 канала без очереди)</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:5px;">' +
                pill(8080, 'VIP UI/Папки', '#39c5cf') +
                pill(8081, 'Дека А', '#58a6ff') +
                pill(8082, 'Дека Б', '#ff7b72') +
                pill(8083, 'Фон/P2P', '#d2a8ff') +
            '</div>' +
            '<div style="font-size:10.5px;color:#8b949e;">⚡ Прямых чтений треков с диска в обход Python/сети: <b style="color:#e6edf3;">' + directHits + '</b> • Мгновенный сканер папок: <b style="color:#3fb950;">JNI Native</b></div>';
    };

    setInterval(function() {
        var sm = document.getElementById('settingsModal');
        if (sm && sm.classList.contains('open')) {
            window.refreshClusterTelemetryBadgeV238();
        }
    }, 2000);
})();

/* [split] V239: кусок исходного IIFE (ui_v71.js, строки 32914–32975) → ui_net.js */
;(function() {

    // 3. Stamp _lastInternalMediaSrcSwitchTsV239 whenever media .src changes so queued HTML5 pause events
    //    from switching tracks/episodes are never mistaken for external audio interruptions
    try {
        var mediaProto = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
        var prevDesc = mediaProto ? Object.getOwnPropertyDescriptor(mediaProto, 'src') : null;
        if (prevDesc && typeof prevDesc.set === 'function' && typeof prevDesc.get === 'function') {
            Object.defineProperty(mediaProto, 'src', {
                configurable: true,
                enumerable: prevDesc.enumerable,
                get: function() {
                    return prevDesc.get.call(this);
                },
                set: function(val) {
                    window._lastInternalMediaSrcSwitchTsV239 = performance.now();
                    return prevDesc.set.call(this, val);
                }
            });
        }
    } catch (e) {}
})();

/* [split] V238: кусок исходного IIFE (ui_v71.js, строки 34882–35221) → ui_net.js */
;(function() {
    if (window._jennyV238P2pInstalled__net) return;
    window._jennyV238P2pInstalled__net = true;
    window._jennyV238P2pInstalled = true;

    // 1. Дедупликатор параллельных опросов /api/torrent/status (освобождает пул HTTP-сокетов WebView)
    var _origFetchV238 = window.fetch.bind(window);
    window.fetch = function(input, init) {
        var urlStr = (typeof input === 'string') ? input : (input && input.url ? String(input.url) : '');
        var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();

        if (method !== 'GET' && urlStr.indexOf('/api/torrent/') !== -1) {
            window._torStatusCacheTsV238 = 0;
        }

        if (method === 'GET' && (urlStr === '/api/torrent/status' || urlStr.slice(-19) === '/api/torrent/status')) {
            var now = Date.now();
            if (window._torStatusCachedTextV238 && (now - window._torStatusCacheTsV238 < 420)) {
                return Promise.resolve(new Response(window._torStatusCachedTextV238, {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                }));
            }
            if (window._torStatusInFlightV238) {
                return window._torStatusInFlightV238.then(function(rawTxt) {
                    return new Response(rawTxt, {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                });
            }
            window._torStatusInFlightV238 = _origFetchV238(input, init)
                .then(function(resp) { return resp.text(); })
                .then(function(rawTxt) {
                    window._torStatusInFlightV238 = null;
                    window._torStatusCachedTextV238 = rawTxt;
                    window._torStatusCacheTsV238 = Date.now();
                    try {
                        var parsed = JSON.parse(rawTxt);
                        if (parsed && parsed.status === 'ok') {
                            window._torDaemonMetaV238 = {
                                version: parsed.version || '',
                                dht_nodes: Number(parsed.dht_nodes || 0),
                                trackers_cached: Number(parsed.trackers_cached || 0),
                                ts: Date.now()
                            };
                        }
                    } catch (e) {}
                    return rawTxt;
                })
                .catch(function(err) {
                    window._torStatusInFlightV238 = null;
                    throw err;
                });

            return window._torStatusInFlightV238.then(function(rawTxt) {
                return new Response(rawTxt, {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            });
        }
        return _origFetchV238(input, init);
    };

    window.fetchTorrentEngineLogV238 = async function() {
        try {
            var r = await _origFetchV238('/api/torrent/engine_log');
            var d = await r.json();
            if (d && d.status === 'ok') {
                window._torEngineLogLinesV238 = d.lines || [];
                window._torEngineLogBinV238 = d.daemon_bin || '';
                if (d.trackers_cached !== undefined) {
                    window._torDaemonMetaV238.trackers_cached = Number(d.trackers_cached || 0);
                }
                if (document.getElementById('jennyTorInspectorModalV128') && window._torHubTabV128 === 'radar') {
                    window.renderTorrentInspectorHubV128();
                }
            }
        } catch (e) {}
    };
})();

/* [split] V243: кусок исходного IIFE (ui_v71.js, строки 35225–35944) → ui_net.js */
;(function() {
    if (window._jennyV243Installed__net) return;
    window._jennyV243Installed__net = true;
    window._jennyV243Installed = true;

    // Отслеживаем старт любого HTMLMediaElement (Дека А, Дека Б, Радио, OST/SC/Торрент-поток)
    var _origMediaPlayV243 = HTMLMediaElement.prototype.play;
    if (_origMediaPlayV243 && !_origMediaPlayV243._v243Wrapped) {
        HTMLMediaElement.prototype.play = function() {
            var self = this;
            try {
                var srcStr = String(self.currentSrc || self.src || '');
                if (self.id === 'audioPlayer') {
                    window._lastActiveMediaSourceV243 = 'deckA';
                } else if (self.id === 'jennyVideoElV130') {
                    window._lastActiveMediaSourceV243 = 'deckB';
                } else {
                    var isRad = Boolean(
                        (window._radioStateV91 && window._radioStateV91.audio === self) ||
                        /radio|icecast|shoutcast|stream_radio|flac_radio/i.test(srcStr) ||
                        (document.getElementById('jennyFlacRadioModalV91') &&
                         getComputedStyle(document.getElementById('jennyFlacRadioModalV91')).display !== 'none' &&
                         srcStr.indexOf('/api/torrent/') === -1 && srcStr.indexOf('soundcloud') === -1)
                    );
                    if (isRad) {
                        if (window._lastRadioAudioElV243 && window._lastRadioAudioElV243 !== self) {
                            window.releaseDetachedAudioSocketV243(window._lastRadioAudioElV243);
                            fetch('/api/radio/abort_stale_v243', { method: 'POST' }).catch(function(){});
                        }
                        if (typeof window.isDeckAActuallyPlayingV232 === 'function' && window.isDeckAActuallyPlayingV232() && typeof window.forceStopPauseDeckAAudioV232 === 'function') {
                            window.forceStopPauseDeckAAudioV232(false);
                        }
                        window._lastRadioAudioElV243 = self;
                        window._lastRadioSrcUrlV243 = srcStr;
                        window._lastActiveMediaSourceV243 = 'radio';
                        window.resolveCurrentRadioTitleV243();

                        if (!self._v243RetryHooked) {
                            self._v243RetryHooked = true;
                            self.addEventListener('playing', function() {
                                self._v243RetriedOnce = false;
                                if (window.syncPermanentForegroundNotificationV212) window.syncPermanentForegroundNotificationV212(true);
                            });
                            self.addEventListener('pause', function() {
                                if (window.syncPermanentForegroundNotificationV212) window.syncPermanentForegroundNotificationV212(true);
                            });
                            self.addEventListener('error', function() {
                                if (!self._v243RetriedOnce && window._lastActiveMediaSourceV243 === 'radio' && window._lastRadioSrcUrlV243) {
                                    self._v243RetriedOnce = true;
                                    var baseU = window._lastRadioSrcUrlV243.replace(/([?&])_r243=\d+/g, '').replace(/[?&]$/, '');
                                    var sep = baseU.indexOf('?') === -1 ? '?' : '&';
                                    setTimeout(function() {
                                        if (window._lastRadioAudioElV243 !== self) return;
                                        self.src = baseU + sep + '_r243=' + Date.now();
                                        _origMediaPlayV243.call(self).catch(function(){});
                                    }, 450);
                                }
                            });
                        }
                    } else if (srcStr) {
                        if (window._lastExternalAudioElV243 && window._lastExternalAudioElV243 !== self) {
                            window.releaseDetachedAudioSocketV243(window._lastExternalAudioElV243);
                        }
                        window._lastExternalAudioElV243 = self;
                        window._lastActiveMediaSourceV243 = 'external';
                        var umpTitle = document.querySelector('.jenny-univ-mini-player-v98 .ump-title, #khMiniTitleV90');
                        if (umpTitle && umpTitle.textContent) {
                            window._lastExternalTitleV243 = umpTitle.textContent.trim();
                        }
                    }
                }
            } catch (e) {}

            var p = _origMediaPlayV243.apply(this, arguments);
            setTimeout(function() {
                if (window.syncPermanentForegroundNotificationV212) window.syncPermanentForegroundNotificationV212(true);
            }, 120);
            return p;
        };
        HTMLMediaElement.prototype.play._v243Wrapped = true;
    }
})();

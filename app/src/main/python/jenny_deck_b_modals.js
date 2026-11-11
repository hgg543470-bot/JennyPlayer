// =========================================================================
// 🎬 JENNY_DECK_B_MODALS.JS — 100% АВТОНОМНЫЙ ПУЛЬТ DSP, EQ И СПЕКТРА ДЕКИ Б
// Не читает и никогда не перезаписывает window.appConfig Аудиодеки А!
// =========================================================================
(function() {
    if (window._jennyDeckBIsolatedModalsV354) return;
    window._jennyDeckBIsolatedModalsV354 = true;

    var EQ_FREQS = [
        { f: 60, lbl: '60 Гц' },
        { f: 230, lbl: '230 Гц' },
        { f: 910, lbl: '910 Гц' },
        { f: 3600, lbl: '3.6 кГц' },
        { f: 14000, lbl: '14 кГц' }
    ];

    var GEARS = [
        { key: 'jbuf-lock',   lbl: '1: J Buf 90° (Тембр 🔒)' },
        { key: 'jbuf-shift',  lbl: '2: J Buf Shift' },
        { key: 'vinyl-shift', lbl: 'R: Винил (Плавн.)' },
        { key: 'native-lock', lbl: 'N: Прямой поток' }
    ];

    var specAnimIdDeckB = null;
    var specSourceModeDeckB = 'post';

    function getDeckBConfig() {
        if (!window.videoDeckV131) return {};
        if (!window.videoDeckV131.config) {
            window.videoDeckV131.config = (typeof window.createDefaultVideoConfigV131 === 'function')
                ? window.createDefaultVideoConfigV131()
                : {};
        }
        return window.videoDeckV131.config;
    }

    function saveAndRebuildDeckB() {
        if (typeof window.initVideoDeckAudioV131 === 'function') {
            window.initVideoDeckAudioV131();
        }
        if (typeof window.saveVideoConfigV131 === 'function') {
            window.saveVideoConfigV131();
        }
        if (typeof window.buildVideoAudioGraphV131 === 'function') {
            window.buildVideoAudioGraphV131();
        }
        if (typeof window.applyVolumeSettingsDeckBV219 === 'function') {
            window.applyVolumeSettingsDeckBV219();
        }
        if (typeof window.syncVideoPlayerButtonsUIV217 === 'function') {
            window.syncVideoPlayerButtonsUIV217();
        }
        if (typeof window.syncPersistentUserDataV218 === 'function') {
            window.syncPersistentUserDataV218(false);
        }
    }

    function ensureDeckBEqModalDOM() {
        var m = document.getElementById('eqModalDeckB');
        if (m) return m;

        m = document.createElement('div');
        m.id = 'eqModalDeckB';
        m.className = 'jdb-modal-backdrop';
        m.onclick = function(ev) {
            if (ev.target === m) window.closeDeckBIsolatedModals();
        };

        var eqRowsHtml = EQ_FREQS.map(function(item) {
            return '<div class="jdb-eq-row">' +
                '<span class="jdb-eq-freq">' + item.lbl + '</span>' +
                '<input type="range" class="jdb-eq-slider" id="jdb_eq_' + item.f + '" min="-12" max="12" step="1" value="0">' +
                '<span class="jdb-eq-val" id="jdb_eq_lbl_' + item.f + '">0 dB</span>' +
            '</div>';
        }).join('');

        var gearBtnsHtml = GEARS.map(function(g) {
            return '<button type="button" class="jdb-gear-btn" data-gear="' + g.key + '" id="jdb_gear_' + g.key + '">' + g.lbl + '</button>';
        }).join('');

        var zonesHtml = '';
        for (var i = 1; i <= 6; i++) {
            zonesHtml += '<div class="jdb-zone-cell">' +
                '<input type="checkbox" id="jdb_z' + i + '_en" checked>' +
                '<input type="number" class="jdb-num-inp" id="jdb_z' + i + '_val" step="0.05" value="1.0">' +
            '</div>';
        }

        m.innerHTML =
            '<div class="jdb-modal-card" id="eqModalDeckBCard">' +
                '<div class="jdb-header">' +
                    '<div>' +
                        '<div class="jdb-title">🎬 Пульт Деки Б (Видео — автономный DSP)</div>' +
                        '<div style="font-size:10px;color:#93c5fd;margin-top:2px;">Отдельный звуковой тракт видео • Аудиодека А не затрагивается</div>' +
                    '</div>' +
                    '<button type="button" class="jdb-close-btn" id="jdbCloseEqBtn">✕</button>' +
                '</div>' +

                '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:10px;">' +
                    '<button type="button" class="jdb-pill-btn" id="jdbCopyFromMusicBtn">📋 Скопировать DSP из Музыки</button>' +
                    '<button type="button" class="jdb-pill-btn" id="jdbResetEqFlatBtn" style="border-color:#60a5fa;color:#93c5fd;background:rgba(37,99,235,0.18);">🔄 Сброс EQ в 0 dB</button>' +
                '</div>' +

                '<div class="jdb-section">' +
                    '<div class="jdb-section-title">' +
                        '<span>🎚️ 5-полосный Эквалайзер Видео</span>' +
                        '<label style="font-size:11px;color:#dbeafe;display:flex;align-items:center;gap:5px;cursor:pointer;">' +
                            '<input type="checkbox" id="jdb_cfg_eqEnabled" style="accent-color:#3b82f6;"> ВКЛ' +
                        '</label>' +
                    '</div>' +
                    eqRowsHtml +
                '</div>' +

                '<div class="jdb-section">' +
                    '<div class="jdb-section-title"><span>⚙️ Режим звукового движка Видео (РКПП)</span></div>' +
                    '<div class="jdb-gear-grid">' + gearBtnsHtml + '</div>' +
                '</div>' +

                '<div class="jdb-section">' +
                    '<div class="jdb-section-title"><span>🎛️ Студийные блоки DSP Деки Б</span></div>' +
                    '<div class="jdb-dsp-row">' +
                        '<label><input type="checkbox" id="jdb_cfg_firEnabled"> ✨ FIR-Сатуратор (Gain)</label>' +
                        '<input type="number" class="jdb-num-inp" id="jdb_cfg_firGain" step="0.1" value="1.5">' +
                    '</div>' +
                    '<div class="jdb-dsp-row">' +
                        '<label><input type="checkbox" id="jdb_cfg_multiBandEnabled"> 🎚️ 3-Band Кроссовер</label>' +
                        '<span style="font-size:10.5px;color:#93c5fd;">НЧ/СЧ/ВЧ</span>' +
                    '</div>' +
                    '<div class="jdb-dsp-row">' +
                        '<label><input type="checkbox" id="jdb_cfg_limiterEnabled"> 🗜️ Soft-Clip Лимитер (Порог dB)</label>' +
                        '<input type="number" class="jdb-num-inp" id="jdb_cfg_limThreshold" step="1" value="-14">' +
                    '</div>' +
                    '<div class="jdb-dsp-row">' +
                        '<label><input type="checkbox" id="jdb_cfg_boosterEnabled"> 🚀 Овердрайв громкости (1–20)</label>' +
                        '<input type="number" class="jdb-num-inp" id="jdb_cfg_boosterPower" min="1" max="20" step="1" value="5">' +
                    '</div>' +
                    '<div class="jdb-dsp-row">' +
                        '<label><input type="checkbox" id="jdb_cfg_opt_autoRms"> ⚡ Авто-RMS выравнивание (dB)</label>' +
                        '<input type="number" class="jdb-num-inp" id="jdb_cfg_val_autoRms" step="0.5" value="-8">' +
                    '</div>' +
                    '<div class="jdb-dsp-row">' +
                        '<label><input type="checkbox" id="jdb_cfg_opt_msWidth"> 🎭 Стерео-ширина (%)</label>' +
                        '<input type="number" class="jdb-num-inp" id="jdb_cfg_val_msWidth" step="5" value="130">' +
                    '</div>' +
                    '<div class="jdb-dsp-row">' +
                        '<label><input type="checkbox" id="jdb_cfg_opt_punch"> 🥁 Панч мид-баса (dB)</label>' +
                        '<input type="number" class="jdb-num-inp" id="jdb_cfg_val_punch" step="0.5" value="0">' +
                    '</div>' +
                '</div>' +

                '<div class="jdb-section" style="margin-bottom:0;">' +
                    '<div class="jdb-section-title"><span>⚡ Радиальные зоны скорости Деки Б</span></div>' +
                    '<div class="jdb-zones-grid">' + zonesHtml + '</div>' +
                '</div>' +
            '</div>';

        document.body.appendChild(m);

        document.getElementById('jdbCloseEqBtn').onclick = function() {
            window.closeDeckBIsolatedModals();
        };
        document.getElementById('jdbCopyFromMusicBtn').onclick = function(ev) {
            if (typeof window.copyMusicDspToVideoV131 === 'function') {
                window.copyMusicDspToVideoV131(ev);
            }
            window.syncDeckBIsolatedEqModalUI();
        };
        document.getElementById('jdbResetEqFlatBtn').onclick = function() {
            var cfg = getDeckBConfig();
            cfg.eq = { b60: 0, b230: 0, b910: 0, b3600: 0, b14000: 0 };
            window._deckBEqV218 = Object.assign({}, cfg.eq);
            try { localStorage.setItem('jenny_eq_deckB_v218', JSON.stringify(window._deckBEqV218)); } catch (e) {}
            if (typeof window.applyBothDecksEQNodesV218 === 'function') window.applyBothDecksEQNodesV218();
            saveAndRebuildDeckB();
            window.syncDeckBIsolatedEqModalUI();
        };

        EQ_FREQS.forEach(function(item) {
            var sl = document.getElementById('jdb_eq_' + item.f);
            if (!sl) return;
            sl.addEventListener('input', function() {
                var val = parseInt(sl.value, 10) || 0;
                var cfg = getDeckBConfig();
                cfg.eq = cfg.eq || {};
                cfg.eq['b' + item.f] = val;
                window._deckBEqV218 = window._deckBEqV218 || {};
                window._deckBEqV218['b' + item.f] = val;
                var lbl = document.getElementById('jdb_eq_lbl_' + item.f);
                if (lbl) lbl.innerText = (val > 0 ? '+' : '') + val + ' dB';
                if (window.videoDeckV131 && window.videoDeckV131.eqNodes && window.videoDeckV131.eqNodes['band' + item.f]) {
                    window.videoDeckV131.eqNodes['band' + item.f].gain.value = val;
                }
                try { localStorage.setItem('jenny_eq_deckB_v218', JSON.stringify(window._deckBEqV218)); } catch (e) {}
                if (typeof window.saveVideoConfigV131 === 'function') window.saveVideoConfigV131();
                if (typeof window.syncPersistentUserDataV218 === 'function') window.syncPersistentUserDataV218(false);
            });
        });

        GEARS.forEach(function(g) {
            var b = document.getElementById('jdb_gear_' + g.key);
            if (!b) return;
            b.onclick = function(ev) {
                var cfg = getDeckBConfig();
                var spec = (window.GEAR_SPECS_V66 && window.GEAR_SPECS_V66[g.key]) || { mode: 'jbuf', pitchLock: true };
                cfg.gearKeyV66 = g.key;
                cfg.engineModeV62 = spec.mode;
                cfg.gearPitchLockV66 = spec.pitchLock;
                cfg.elasticHoseMode = (g.key === 'jbuf-lock');
                cfg.studioMode = (g.key === 'jbuf-lock' || g.key === 'jbuf-shift' || g.key === 'vinyl-shift');
                saveAndRebuildDeckB();
                if (typeof window.syncVideoRamEngineV211 === 'function') window.syncVideoRamEngineV211(false);
                window.syncDeckBIsolatedEqModalUI();
                if (typeof window.showToast === 'function') window.showToast('🎬 РКПП Деки Б: ' + g.lbl, ev);
            };
        });

        var bindChk = function(elId, setter) {
            var el = document.getElementById(elId);
            if (!el) return;
            el.addEventListener('change', function() {
                setter(Boolean(el.checked), getDeckBConfig());
                saveAndRebuildDeckB();
            });
        };
        var bindNum = function(elId, setter) {
            var el = document.getElementById(elId);
            if (!el) return;
            el.addEventListener('input', function() {
                var v = parseFloat(String(el.value).replace(',', '.'));
                if (!isFinite(v)) return;
                setter(v, getDeckBConfig());
                saveAndRebuildDeckB();
            });
        };

        bindChk('jdb_cfg_eqEnabled', function(v, c) { c.eqEnabled = v; });
        bindChk('jdb_cfg_firEnabled', function(v, c) { c.firEnabled = v; });
        bindNum('jdb_cfg_firGain', function(v, c) { c.firSettings = c.firSettings || { gain: 1.5, decay: 1.28 }; c.firSettings.gain = v; });
        bindChk('jdb_cfg_multiBandEnabled', function(v, c) { c.multiBandEnabled = v; });
        bindChk('jdb_cfg_limiterEnabled', function(v, c) { c.limiterEnabled = v; });
        bindNum('jdb_cfg_limThreshold', function(v, c) { c.limiterSettings = c.limiterSettings || { threshold: -14, knee: 30, ratio: 4, attack: 26, release: 60 }; c.limiterSettings.threshold = v; });
        bindChk('jdb_cfg_boosterEnabled', function(v, c) { c.boosterEnabled = v; });
        bindNum('jdb_cfg_boosterPower', function(v, c) { c.boosterPower = Math.max(1, Math.min(20, Math.round(v))); });
        bindChk('jdb_cfg_opt_autoRms', function(v, c) { c.opt_autoRms = v; });
        bindNum('jdb_cfg_val_autoRms', function(v, c) { c.val_autoRms = v; });
        bindChk('jdb_cfg_opt_msWidth', function(v, c) { c.opt_msWidth = v; });
        bindNum('jdb_cfg_val_msWidth', function(v, c) { c.val_msWidth = v; });
        bindChk('jdb_cfg_opt_punch', function(v, c) { c.opt_punch = v; });
        bindNum('jdb_cfg_val_punch', function(v, c) { c.val_punch = v; });

        var saveDeckBZones = function() {
            var cfg = getDeckBConfig();
            if (!Array.isArray(cfg.scrubZones) || cfg.scrubZones.length !== 6) {
                cfg.scrubZones = [1.1, 1.0, 1.05, 0.95, 1.5, 0.9].map(function(v) { return { val: v, en: true }; });
            }
            var activeCnt = 0;
            for (var i = 1; i <= 6; i++) {
                var ce = document.getElementById('jdb_z' + i + '_en');
                if (ce && ce.checked) activeCnt++;
            }
            if (activeCnt === 0) {
                var c1 = document.getElementById('jdb_z1_en');
                if (c1) c1.checked = true;
            }
            for (var j = 1; j <= 6; j++) {
                var enEl = document.getElementById('jdb_z' + j + '_en');
                var valEl = document.getElementById('jdb_z' + j + '_val');
                if (enEl && valEl) {
                    cfg.scrubZones[j - 1] = {
                        en: Boolean(enEl.checked),
                        val: parseFloat(String(valEl.value).replace(',', '.')) || 1.0
                    };
                }
            }
            saveAndRebuildDeckB();
        };
        for (var z = 1; z <= 6; z++) {
            var ze = document.getElementById('jdb_z' + z + '_en');
            var zv = document.getElementById('jdb_z' + z + '_val');
            if (ze) ze.addEventListener('change', saveDeckBZones);
            if (zv) zv.addEventListener('input', saveDeckBZones);
        }

        return m;
    }

    window.syncDeckBIsolatedEqModalUI = function() {
        var m = document.getElementById('eqModalDeckB');
        if (!m) return;
        var cfg = getDeckBConfig();
        var eqObj = window._deckBEqV218 || cfg.eq || { b60: 0, b230: 0, b910: 0, b3600: 0, b14000: 0 };

        EQ_FREQS.forEach(function(item) {
            var v = parseFloat(eqObj['b' + item.f]) || 0;
            var sl = document.getElementById('jdb_eq_' + item.f);
            var lbl = document.getElementById('jdb_eq_lbl_' + item.f);
            if (sl) sl.value = String(v);
            if (lbl) lbl.innerText = (v > 0 ? '+' : '') + v + ' dB';
        });

        var activeGear = cfg.gearKeyV66 || 'jbuf-lock';
        GEARS.forEach(function(g) {
            var b = document.getElementById('jdb_gear_' + g.key);
            if (b) b.classList.toggle('jdb-active', g.key === activeGear);
        });

        var setChk = function(id, val) { var e = document.getElementById(id); if (e) e.checked = Boolean(val); };
        var setVal = function(id, val) { var e = document.getElementById(id); if (e && document.activeElement !== e) e.value = String(val); };

        setChk('jdb_cfg_eqEnabled', cfg.eqEnabled !== false);
        setChk('jdb_cfg_firEnabled', cfg.firEnabled);
        setVal('jdb_cfg_firGain', (cfg.firSettings && cfg.firSettings.gain !== undefined) ? cfg.firSettings.gain : 1.5);
        setChk('jdb_cfg_multiBandEnabled', cfg.multiBandEnabled);
        setChk('jdb_cfg_limiterEnabled', cfg.limiterEnabled);
        setVal('jdb_cfg_limThreshold', (cfg.limiterSettings && cfg.limiterSettings.threshold !== undefined) ? cfg.limiterSettings.threshold : -14);
        setChk('jdb_cfg_boosterEnabled', cfg.boosterEnabled);
        setVal('jdb_cfg_boosterPower', cfg.boosterPower !== undefined ? cfg.boosterPower : 5);
        setChk('jdb_cfg_opt_autoRms', cfg.opt_autoRms);
        setVal('jdb_cfg_val_autoRms', cfg.val_autoRms !== undefined ? cfg.val_autoRms : -8);
        setChk('jdb_cfg_opt_msWidth', cfg.opt_msWidth);
        setVal('jdb_cfg_val_msWidth', cfg.val_msWidth !== undefined ? cfg.val_msWidth : 130);
        setChk('jdb_cfg_opt_punch', cfg.opt_punch);
        setVal('jdb_cfg_val_punch', cfg.val_punch !== undefined ? cfg.val_punch : 0);

        var defZones = [1.1, 1.0, 1.05, 0.95, 1.5, 0.9];
        var zs = (Array.isArray(cfg.scrubZones) && cfg.scrubZones.length === 6)
            ? cfg.scrubZones
            : defZones.map(function(v) { return { val: v, en: true }; });
        for (var i = 0; i < 6; i++) {
            var zItem = zs[i] || { val: defZones[i], en: true };
            setChk('jdb_z' + (i + 1) + '_en', zItem.en !== false);
            setVal('jdb_z' + (i + 1) + '_val', zItem.val);
        }
    };

    function ensureDeckBSpecModalDOM() {
        var m = document.getElementById('specModalDeckB');
        if (m) return m;

        m = document.createElement('div');
        m.id = 'specModalDeckB';
        m.className = 'jdb-modal-backdrop';
        m.onclick = function(ev) {
            if (ev.target === m) window.closeDeckBIsolatedModals();
        };
        m.innerHTML =
            '<div class="jdb-modal-card">' +
                '<div class="jdb-header">' +
                    '<div>' +
                        '<div class="jdb-title">📊 Спектроанализатор Деки Б (Видео)</div>' +
                        '<div style="font-size:10px;color:#93c5fd;margin-top:2px;">Прямой съём с аудиографа videoDeckV131</div>' +
                    '</div>' +
                    '<button type="button" class="jdb-close-btn" id="jdbCloseSpecBtn">✕</button>' +
                '</div>' +
                '<div style="display:flex;gap:6px;margin-bottom:10px;">' +
                    '<button type="button" class="jdb-gear-btn jdb-active" id="jdbSpecPostBtn" style="flex:1;">🔊 ПОСЛЕ DSP</button>' +
                    '<button type="button" class="jdb-gear-btn" id="jdbSpecPreBtn" style="flex:1;">🎙️ ДО DSP (Вход)</button>' +
                '</div>' +
                '<div class="jdb-spec-canvas-wrap">' +
                    '<canvas id="specCanvasDeckB" width="440" height="210"></canvas>' +
                '</div>' +
            '</div>';
        document.body.appendChild(m);

        document.getElementById('jdbCloseSpecBtn').onclick = function() {
            window.closeDeckBIsolatedModals();
        };
        var postBtn = document.getElementById('jdbSpecPostBtn');
        var preBtn = document.getElementById('jdbSpecPreBtn');
        postBtn.onclick = function() {
            specSourceModeDeckB = 'post';
            postBtn.classList.add('jdb-active');
            preBtn.classList.remove('jdb-active');
        };
        preBtn.onclick = function() {
            specSourceModeDeckB = 'pre';
            preBtn.classList.add('jdb-active');
            postBtn.classList.remove('jdb-active');
        };
        return m;
    }

    function stopDeckBSpectrumLoop() {
        if (specAnimIdDeckB) {
            cancelAnimationFrame(specAnimIdDeckB);
            specAnimIdDeckB = null;
        }
    }

    function startDeckBSpectrumLoop() {
        stopDeckBSpectrumLoop();
        var canvas = document.getElementById('specCanvasDeckB');
        if (!canvas) return;
        var ctx2d = canvas.getContext('2d');
        var freqBuf = null;

        var draw = function() {
            var m = document.getElementById('specModalDeckB');
            if (!m || !m.classList.contains('jdb-open')) {
                specAnimIdDeckB = null;
                return;
            }
            specAnimIdDeckB = requestAnimationFrame(draw);

            var w = canvas.width, h = canvas.height;
            ctx2d.fillStyle = '#030712';
            ctx2d.fillRect(0, 0, w, h);

            var vd = window.videoDeckV131;
            var an = vd ? (specSourceModeDeckB === 'pre' ? vd.analyserPre : vd.analyserPost) : null;
            if (!an) {
                ctx2d.fillStyle = '#60a5fa';
                ctx2d.font = 'bold 12px sans-serif';
                ctx2d.textAlign = 'center';
                ctx2d.fillText('Запусти видео в Деке Б для анализа спектра', w / 2, h / 2);
                return;
            }

            if (!freqBuf || freqBuf.length !== an.frequencyBinCount) {
                freqBuf = new Uint8Array(an.frequencyBinCount);
            }
            an.getByteFrequencyData(freqBuf);

            var bars = 48;
            var barW = (w - 16) / bars;
            for (var i = 0; i < bars; i++) {
                var logIdx = Math.min(freqBuf.length - 1, Math.floor(Math.pow(i / bars, 1.85) * (freqBuf.length * 0.72)));
                var val = freqBuf[logIdx] / 255.0;
                var barH = Math.max(2, val * (h - 24));
                var x = 8 + i * barW;
                var y = h - 10 - barH;
                ctx2d.fillStyle = val > 0.82 ? '#93c5fd' : '#3b82f6';
                ctx2d.fillRect(x, y, Math.max(2, barW - 2), barH);
            }
        };
        specAnimIdDeckB = requestAnimationFrame(draw);
    }

    window.closeDeckBIsolatedModals = function() {
        var eqM = document.getElementById('eqModalDeckB');
        var spM = document.getElementById('specModalDeckB');
        if (eqM) eqM.classList.remove('jdb-open');
        if (spM) spM.classList.remove('jdb-open');
        stopDeckBSpectrumLoop();
    };

    window.openDeckBIsolatedEqModal = function(ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        if (typeof window.initVideoDeckAudioV131 === 'function') window.initVideoDeckAudioV131();
        var m = ensureDeckBEqModalDOM();
        var wasOpen = m.classList.contains('jdb-open');
        window.closeDeckBIsolatedModals();
        if (!wasOpen) {
            window.syncDeckBIsolatedEqModalUI();
            m.classList.add('jdb-open');
        }
    };

    window.openDeckBIsolatedSpecModal = function(ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        if (typeof window.initVideoDeckAudioV131 === 'function') window.initVideoDeckAudioV131();
        var m = ensureDeckBSpecModalDOM();
        var wasOpen = m.classList.contains('jdb-open');
        window.closeDeckBIsolatedModals();
        if (!wasOpen) {
            m.classList.add('jdb-open');
            startDeckBSpectrumLoop();
        }
    };
})();

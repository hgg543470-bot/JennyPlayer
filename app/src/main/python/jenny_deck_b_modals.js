// ============================================================================
// 🎬 JENNY_DECK_B_MODALS.JS — ПОЛНАЯ 1:1 КОПИЯ ВСЕХ НАСТРОЕК, ЭКВАЛАЙЗЕРА,
// МЕХАНИЧЕСКОЙ 5-СТУПЕНЧАТОЙ РКПП, АНАЛИЗАТОРА СПЕКТРА И ОСЦИЛЛОГРАФА ДЛЯ ДЕКИ Б
// + ПЕРЕКЛЮЧАТЕЛИ [🎵 А | 🎬 Б] В КАЖДОМ РАЗДЕЛЕ И ТАБЛО 4 БУФЕРОВ RAM!
// ============================================================================
(function() {
    'use strict';
    if (window._jennyDeckBFullClonedModalsV359) return;
    window._jennyDeckBFullClonedModalsV359 = true;

    window._lastActiveSettingsDeckV359 = 'music';

    var ALL_MOD_KEYS_B = ['midPhase', 'midQ', 'deEsser', 'cleanFir', 'masterCeil', 'autoRms', 'monoBass', 'msWidth', 'punch', 'crossfeed'];
    var DSP_DEFAULTS_B = {
        opt_midPhase: true,    val_midPhase: 4.0,
        opt_midQ: true,        val_midQ: 120,
        opt_deEsser: true,     val_deEsser: -2.0,
        opt_cleanFir: true,    val_cleanFir: 3.0,
        opt_masterCeil: true,  val_masterCeil: -1.0,
        opt_autoRms: true,     val_autoRms: -6.0,
        opt_monoBass: true,    val_monoBass: 79,
        opt_msWidth: true,     val_msWidth: 130,
        opt_punch: true,       val_punch: -1.0,
        opt_crossfeed: false,  val_crossfeed: 65
    };

    var trB = function(ru, en) {
        return (typeof window.tr === 'function') ? window.tr(ru, en) : ru;
    };

    function getDeckBConfig() {
        if (!window.videoDeckV131) return {};
        if (!window.videoDeckV131.config) {
            window.videoDeckV131.config = (typeof window.createDefaultVideoConfigV131 === 'function')
                ? window.createDefaultVideoConfigV131()
                : {};
        }
        var cfg = window.videoDeckV131.config;
        if (!cfg._defaultsClonedV359) {
            cfg._defaultsClonedV359 = true;
            if (cfg.studioMode === undefined) cfg.studioMode = true;
            if (cfg.phaseFixEnabled === undefined) cfg.phaseFixEnabled = false;
            if (cfg.leftHandedMode === undefined) cfg.leftHandedMode = false;
            if (cfg.xNormalSpeed === undefined) cfg.xNormalSpeed = false;
            if (cfg.normalPlaybackSpeed === undefined) cfg.normalPlaybackSpeed = 0.97;
            if (cfg.autoSaveBase === undefined) cfg.autoSaveBase = false;
            if (cfg.defaultScrubSpeed === undefined) cfg.defaultScrubSpeed = 1.1;
            if (cfg.autoSaveScrub === undefined) cfg.autoSaveScrub = true;
            if (cfg.hoseTensionPct === undefined) cfg.hoseTensionPct = 100;
            if (cfg.elasticHoseMode === undefined) cfg.elasticHoseMode = true;
            if (!cfg.gearKeyV66) cfg.gearKeyV66 = 'jbuf-lock';
            if (!Array.isArray(cfg.scrubZones) || cfg.scrubZones.length !== 6) {
                cfg.scrubZones = [1.1, 1, 1.05, 0.95, 1.5, 0.9].map(function(v) { return { val: v, en: true }; });
            }
            if (cfg.firEnabled === undefined) cfg.firEnabled = true;
            if (!cfg.firSettings) cfg.firSettings = { gain: 1.5, decay: 1.28 };
            if (cfg.multiBandEnabled === undefined) cfg.multiBandEnabled = true;
            if (!cfg.multiBandSettings) cfg.multiBandSettings = { low: 160, high: 2528 };
            if (cfg.limiterEnabled === undefined) cfg.limiterEnabled = true;
            if (!cfg.limiterSettings) cfg.limiterSettings = { threshold: -18, knee: 128, ratio: 4, attack: 192, release: 352 };
            if (cfg.eqEnabled === undefined) cfg.eqEnabled = true;
            if (!cfg.eq) cfg.eq = { b60: 0, b230: 0, b910: 0, b3600: 0, b14000: 0 };
            if (cfg.boosterEnabled === undefined) cfg.boosterEnabled = true;
            if (cfg.boosterPower === undefined) cfg.boosterPower = 5;
            if (cfg.volSlider === undefined) cfg.volSlider = true;
            ALL_MOD_KEYS_B.forEach(function(k) {
                if (cfg['opt_' + k] === undefined) cfg['opt_' + k] = DSP_DEFAULTS_B['opt_' + k];
                if (cfg['val_' + k] === undefined) cfg['val_' + k] = DSP_DEFAULTS_B['val_' + k];
            });
        }
        return cfg;
    }

    // Расчёт Авто-Потолка и расшифровки специально для Деки Б (1:1 как в Деке А)
    window.computeDeckBCeilingBreakdownV359 = function() {
        var cfg = getDeckBConfig();
        var hotDb = 0.0;
        var parts = [];

        if (cfg.firEnabled && cfg.firSettings) {
            var fg = parseFloat(cfg.firSettings.gain) || 2.0;
            var firHot = 0.0;
            if (fg > 1.0) firHot += 20 * Math.log10(fg) * 0.45;
            if (cfg.opt_cleanFir) {
                var cfDb = parseFloat(cfg.val_cleanFir) || 0;
                if (cfDb > 0) firHot += cfDb * 0.4;
            }
            if (firHot > 0.05) {
                hotDb += firHot;
                parts.push('✨FIR -' + firHot.toFixed(1));
            }
        }
        if (cfg.opt_midPhase) {
            var mpDb = Math.min(15, parseFloat(cfg.val_midPhase) || 0);
            if (mpDb > 0) {
                var vMp = mpDb * 0.45;
                hotDb += vMp;
                parts.push('🎯СЧ -' + vMp.toFixed(1));
            }
        }
        if (cfg.opt_deEsser) {
            var deDb = Math.min(12, parseFloat(cfg.val_deEsser) || 0);
            if (deDb > 0) {
                var vDe = deDb * 0.35;
                hotDb += vDe;
                parts.push('🐍ВЧ -' + vDe.toFixed(1));
            }
        }
        if (cfg.opt_punch) {
            var pDb = Math.min(24, parseFloat(cfg.val_punch) || 0);
            if (pDb > 0) {
                var vP = pDb * 0.18;
                hotDb += vP;
                parts.push('🥁Панч -' + vP.toFixed(1));
            }
        }
        if (cfg.opt_msWidth) {
            var wPct = parseFloat(cfg.val_msWidth);
            if (isNaN(wPct)) wPct = 160;
            if (wPct > 100) {
                var vW = Math.min(18, 20 * Math.log10(1 + (wPct - 100) / 140) * 0.68);
                if (vW > 0.05) {
                    hotDb += vW;
                    parts.push('🎭Стерео -' + vW.toFixed(1));
                }
            }
        }
        if (cfg.opt_crossfeed) {
            var cPct = parseFloat(cfg.val_crossfeed) || 0;
            if (cPct > 80) {
                var vC = Math.min(6, (cPct - 80) * 0.03);
                if (vC > 0.05) {
                    hotDb += vC;
                    parts.push('🎧Бин -' + vC.toFixed(1));
                }
            }
        }
        if (cfg.opt_autoRms) {
            var tRms = parseFloat(cfg.val_autoRms);
            if (isNaN(tRms)) tRms = -10;
            if (tRms > -12) {
                var vR = (tRms + 12) * 0.75;
                if (vR > 0.05) {
                    hotDb += vR;
                    parts.push('⚡RMS -' + vR.toFixed(1));
                }
            }
        }

        var padDb = -Math.max(0.5, hotDb);
        var rounded = Math.round(padDb * 10) / 10;
        var breakdown = parts.length > 0 ? parts.join(' │ ') : trB('Базовый запас -0.5 dB', 'Base Headroom -0.5 dB');
        if (window.videoDeckV131) {
            window.videoDeckV131.lastComputedCeilingDb = rounded;
            window.videoDeckV131.lastCeilingBreakdown = breakdown;
        }
        return { db: rounded, breakdown: breakdown, enabled: Boolean(cfg.opt_masterCeil || cfg.phaseFixEnabled) };
    };

    var _deckBRebuildTimer = null;
    function saveAndRebuildDeckB(immediate) {
        if (typeof window.initVideoDeckAudioV131 === 'function') {
            window.initVideoDeckAudioV131();
        }
        if (typeof window.saveVideoConfigV131 === 'function') {
            window.saveVideoConfigV131();
        }
        var doBuild = function() {
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
            window.updateDeckBAutoCeilMonitorUI();
        };
        if (immediate) {
            doBuild();
        } else {
            clearTimeout(_deckBRebuildTimer);
            _deckBRebuildTimer = setTimeout(doBuild, 70);
        }
    }

    // Создаёт переключатель [🎵 А | 🎬 Б] для заголовка любой секции или строки
    function buildABSectionSwitchHTML(activeDeck, sectionAnchorKey) {
        var isA = (activeDeck === 'music');
        var secArg = sectionAnchorKey ? ("'" + sectionAnchorKey + "'") : "null";
        return '<span class="jenny-ab-sec-switch-v359" onclick="event.stopPropagation();">' +
            '<button type="button" class="jenny-ab-sec-btn-v359 ' + (isA ? 'active-a' : '') + '" onclick="window.switchSettingsCopyABV359(\'music\', ' + secArg + ', event)">🎵 А</button>' +
            '<button type="button" class="jenny-ab-sec-btn-v359 ' + (!isA ? 'active-b' : '') + '" onclick="window.switchSettingsCopyABV359(\'video\', ' + secArg + ', event)">🎬 Б</button>' +
        '</span>';
    }

    // Создаёт верхнюю панель переключения копий Дека А / Дека Б внутри модалок
    function buildTopDeckSwitchBannerHTML(activeDeck, modalKind) {
        var d = window._jennyDualDeckV211 || { deckA: true, deckB: false };
        var isVid = (activeDeck === 'video');
        var statusA = d.deckA ? 'ВКЛ' : 'ВЫКЛ';
        var statusB = d.deckB ? 'ВКЛ' : 'ВЫКЛ';
        return '<div class="jenny-top-ab-banner-v359" style="display:flex;flex-direction:column;gap:6px;padding:8px;background:#05070b;border:1.5px solid ' + (isVid ? '#3b82f6' : '#a855f7') + ';border-radius:14px;margin-bottom:10px;box-shadow:inset 0 1px 4px rgba(0,0,0,0.9);">' +
            '<div style="display:flex;align-items:center;gap:8px;width:100%;">' +
                '<button type="button" onclick="window.switchModalCopyABV359(\'music\', \'' + modalKind + '\', event)" style="flex:1;padding:8px 8px;border-radius:10px;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:space-between;border:1.5px solid ' + (!isVid ? '#c084fc' : '#30363d') + ';background:' + (!isVid ? 'rgba(126,34,206,0.38)' : '#0d1117') + ';color:' + (!isVid ? '#f3e8ff' : '#8b949e') + ';cursor:pointer;">' +
                    '<span>🎵 Дека А: Музыка</span>' +
                    '<span onclick="event.stopPropagation();window.toggleComplementDeckV211(\'music\', event);" style="padding:2px 6px;border-radius:6px;font-size:10px;background:' + (d.deckA ? 'rgba(63,185,80,0.22)' : '#161b22') + ';color:' + (d.deckA ? '#3fb950' : '#8b949e') + ';border:1px solid ' + (d.deckA ? '#3fb950' : '#30363d') + ';">' + statusA + '</span>' +
                '</button>' +
                '<button type="button" onclick="window.switchModalCopyABV359(\'video\', \'' + modalKind + '\', event)" style="flex:1;padding:8px 8px;border-radius:10px;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:space-between;border:1.5px solid ' + (isVid ? '#60a5fa' : '#30363d') + ';background:' + (isVid ? 'rgba(37,99,235,0.42)' : '#0d1117') + ';color:' + (isVid ? '#dbeafe' : '#8b949e') + ';cursor:pointer;">' +
                    '<span>🎬 Дека Б: Видео</span>' +
                    '<span onclick="event.stopPropagation();window.toggleComplementDeckV211(\'video\', event);" style="padding:2px 6px;border-radius:6px;font-size:10px;background:' + (d.deckB ? 'rgba(63,185,80,0.22)' : '#161b22') + ';color:' + (d.deckB ? '#3fb950' : '#8b949e') + ';border:1px solid ' + (d.deckB ? '#3fb950' : '#30363d') + ';">' + statusB + '</span>' +
                '</button>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 4px 0 4px;gap:6px;flex-wrap:wrap;">' +
                (isVid
                    ? '<span style="font-size:10.5px;color:#60a5fa;font-weight:bold;">🎬 Автономная копия настроек Деки Б (Видео)</span>' +
                      '<button type="button" onclick="window.copyMusicDspToVideoV131(event);window.syncAllDeckBClonedModalsUI();" style="padding:4px 9px;font-size:10px;font-weight:bold;border-radius:14px;background:#161b22;border:1px solid #3fb950;color:#3fb950;cursor:pointer;">📋 Скопировать всё из Музыки (А ➔ Б)</button>'
                    : '<span style="font-size:10.5px;color:#c084fc;font-weight:bold;">🎵 Автономная копия настроек Деки А (Музыка)</span>' +
                      '<button type="button" onclick="window.switchModalCopyABV359(\'video\', \'' + modalKind + '\', event)" style="padding:4px 9px;font-size:10px;font-weight:bold;border-radius:14px;background:#0b1836;border:1px solid #60a5fa;color:#93c5fd;cursor:pointer;">🎬 Переключить на копию Деки Б ➔</button>') +
            '</div>' +
        '</div>';
    }

    // Табло реального состояния 4 буферов RAM (2 Аудио + 2 Видео)
    window.renderFourBuffersStatusHTMLV359 = function() {
        var b1 = window.studioBuffer;
        var b2 = window.reversedStudioBuffer;
        var vd = window.videoDeckV131 || {};
        var b3 = vd.studioBuffer;
        var b4 = vd.reversedStudioBuffer;

        var fmtDur = function(buf) {
            if (!buf || !buf.duration) return '';
            var m = Math.floor(buf.duration / 60);
            var s = Math.floor(buf.duration % 60);
            return ' (' + m + ':' + (s < 10 ? '0' + s : s) + ', ' + Math.round((buf.sampleRate || 44100) / 1000) + 'kHz)';
        };

        var st1 = b1 ? ('✅ В ОЗУ' + fmtDur(b1)) : (window._trackActivelyLoadingToRamV237 ? '⏳ Распаковка (играет сжатый)...' : 'Ожидание трека');
        var st2 = b2 ? ('✅ В ОЗУ' + fmtDur(b2)) : (b1 ? '⏳ Разворот в воркере...' : 'Ожидание трека');

        var pLoaded = (b3 && b3._loadedCountV72) || vd._ramPiecesLoadedV359 || 0;
        var pTotal = (b3 && b3._pieceMapV72 && b3._pieceMapV72.length) || vd._ramPiecesTotalV359 || 0;
        var pRatio = pTotal > 0 ? (' [' + pLoaded + '/' + pTotal + ']') : '';

        var st3 = b3
            ? ((b3._allPiecesLoadedV72 ? '✅ Полный в ОЗУ' : '⚡ Активен в ОЗУ' + pRatio) + fmtDur(b3))
            : (vd._isLoadingRamV359 ? '⏳ Фоновая загрузка (играет сжатый)...' : 'Ожидание видео');
        var st4 = b4
            ? ((b4._allPiecesLoadedV72 ? '✅ Полный в ОЗУ' : '⚡ Активен в ОЗУ' + pRatio) + fmtDur(b4))
            : (vd._isLoadingRamV359 ? '⏳ Сборка реверса в фоне...' : 'Ожидание видео');

        return '<div class="jenny-4buf-panel-v359">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;">' +
                '<span style="font-weight:bold;color:#58a6ff;">🧠 Статус 4 буферов звука в RAM (32-bit Float PCM)</span>' +
                '<span style="font-size:10px;color:#3fb950;">Бесшовная подмена</span>' +
            '</div>' +
            '<div class="jenny-4buf-grid-v359">' +
                '<div class="jenny-4buf-cell-v359 ' + (b1 ? 'buf-ready-a' : (window._trackActivelyLoadingToRamV237 ? 'buf-loading' : '')) + '">' +
                    '<span style="color:#c084fc;font-weight:bold;font-size:10.5px;">🎵 #1 Аудио Вперёд (⏩)</span>' +
                    '<span style="color:#e6edf3;font-size:10px;">' + st1 + '</span>' +
                '</div>' +
                '<div class="jenny-4buf-cell-v359 ' + (b2 ? 'buf-ready-a' : (window._trackActivelyLoadingToRamV237 ? 'buf-loading' : '')) + '">' +
                    '<span style="color:#c084fc;font-weight:bold;font-size:10.5px;">🎵 #2 Аудио Реверс (⏪)</span>' +
                    '<span style="color:#e6edf3;font-size:10px;">' + st2 + '</span>' +
                '</div>' +
                '<div class="jenny-4buf-cell-v359 ' + (b3 ? 'buf-ready-b' : (vd._isLoadingRamV359 ? 'buf-loading' : '')) + '">' +
                    '<span style="color:#60a5fa;font-weight:bold;font-size:10.5px;">🎬 #3 Видео Вперёд (⏩)</span>' +
                    '<span style="color:#e6edf3;font-size:10px;">' + st3 + '</span>' +
                '</div>' +
                '<div class="jenny-4buf-cell-v359 ' + (b4 ? 'buf-ready-b' : (vd._isLoadingRamV359 ? 'buf-loading' : '')) + '">' +
                    '<span style="color:#60a5fa;font-weight:bold;font-size:10.5px;">🎬 #4 Видео Реверс (⏪)</span>' +
                    '<span style="color:#e6edf3;font-size:10px;">' + st4 + '</span>' +
                '</div>' +
            '</div>' +
        '</div>';
    };

    window.refreshFourBuffersHudV359 = function() {
        ['jennyFourBuffersHudBarA', 'jennyFourBuffersHudBarB', 'jennyFourBuffersHudEqB'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.innerHTML = window.renderFourBuffersStatusHTMLV359();
        });
    };

    // Обновляет верхнюю строку 🛡️ Авто-Потолок (#topAutoCeilMonitor), когда открыты модалки Деки Б
    window.updateDeckBAutoCeilMonitorUI = function() {
        var info = window.computeDeckBCeilingBreakdownV359();
        var badgeB = document.getElementById('autoCeilStatusBadgeDeckB');
        if (badgeB) {
            var cfg = getDeckBConfig();
            badgeB.innerText = cfg.opt_masterCeil ? (trB('Авто', 'Auto') + ': ' + info.db + ' dB') : trB('ВЫКЛ', 'OFF');
            badgeB.style.color = cfg.opt_masterCeil ? '#3fb950' : '#8b949e';
        }
        var smB = document.getElementById('settingsModalDeckB');
        var eqB = document.getElementById('eqModalDeckB');
        var spB = document.getElementById('specModalDeckB');
        var isDeckBModalOpen = Boolean(
            (smB && smB.classList.contains('open')) ||
            (eqB && eqB.classList.contains('open')) ||
            (spB && spB.classList.contains('open'))
        );
        if (!isDeckBModalOpen) return;

        var searchInput = document.getElementById('trackSearchInput');
        if (!searchInput || !searchInput.parentElement) return;
        var barWrap = searchInput.parentElement;
        var monEl = document.getElementById('topAutoCeilMonitor');
        if (!monEl) {
            monEl = document.createElement('div');
            monEl.id = 'topAutoCeilMonitor';
            monEl.style.cssText = 'display:none;width:100%;box-sizing:border-box;background:#0d1117;border:1px solid #3b82f6;border-radius:8px;padding:8px 11px;font-size:12px;color:#e6edf3;white-space:nowrap;overflow-x:auto;font-family:monospace;box-shadow:0 0 8px rgba(59,130,246,0.35);';
            barWrap.appendChild(monEl);
        }
        searchInput.style.display = 'none';
        if (info.enabled) {
            barWrap.style.display = '';
            barWrap.style.paddingTop = '2px';
            monEl.style.display = 'block';
            monEl.style.borderColor = '#3b82f6';
            monEl.innerHTML = '<span style="color:#60a5fa;font-weight:bold;">🛡️ ' + trB('Авто-Потолок (Дека Б)', 'Auto-Ceiling (Deck B)') + ': ' + info.db + ' dB</span> <span style="color:#8b949e;">│</span> <span style="color:#93c5fd;">' + info.breakdown + '</span>';
        } else {
            monEl.style.display = 'none';
        }
    };

    // ========================================================================
    // 1. ПОЛНАЯ 1:1 КОПИЯ ОКОННОГО 5-ПОЛОСНОГО ЭКВАЛАЙЗЕРА ДЕКИ Б (#eqModalDeckB)
    // ========================================================================
    function ensureDeckBEqModalDOM() {
        var m = document.getElementById('eqModalDeckB');
        if (m) return m;

        m = document.createElement('div');
        m.id = 'eqModalDeckB';
        m.className = 'modal-overlay';

        var eqBands = [
            [60,    trB('60 Гц — Саб-бас (Глубина и бочка)', '60 Hz — Sub-Bass (Depth & Kick)'), 'eq_band_60'],
            [230,   trB('230 Гц — Мид-бас (Теплота / Анти-бубнёж)', '230 Hz — Mid-Bass (Warmth / Mud Cut)'), 'eq_band_230'],
            [910,   trB('910 Гц — Середина (Основа вокала)', '910 Hz — Midrange (Vocal Core)'), 'eq_band_910'],
            [3600,  trB('3600 Гц — Верхняя СЧ (Близость и чёткость)', '3600 Hz — Upper Mid (Clarity & Bite)'), 'eq_band_3600'],
            [14000, trB('14 000 Гц — Воздух (Блеск и тарелки)', '14,000 Hz — Air (Sparkle & Cymbals)'), 'eq_band_14000']
        ];

        var bandsHtml = eqBands.map(function(b) {
            var freq = b[0], title = b[1], hKey = b[2];
            return '<div class="eq-band-hdr" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:-12px;color:#c9d1d9;font-size:12.5px;font-weight:bold;">' +
                '<span style="display:flex;align-items:center;gap:6px;">' + title + ' <b id="eqDeckB_val_' + freq + '" style="color:#60a5fa;font-family:monospace;font-size:11.5px;">0 dB</b></span>' +
                '<span style="display:inline-flex;align-items:center;gap:4px;">' +
                    buildABSectionSwitchHTML('video', 'eq_' + freq) +
                    '<span class="jenny-help-badge" onclick="if(window.showHelpTopic) window.showHelpTopic(\'' + hKey + '\', event)" style="display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11.5px;cursor:pointer;">❓</span>' +
                '</span>' +
            '</div>' +
            '<input type="range" class="hz-slider" id="eqDeckB_' + freq + '" min="-12" max="12" step="1" value="0" oninput="window.onDeckBEqSliderInputV359(' + freq + ', this.value)">';
        }).join('');

        m.innerHTML =
            '<div class="container" id="eqModalDeckBContainer">' +
                '<div id="deckSwitchBarEqDeckB">' + buildTopDeckSwitchBannerHTML('video', 'eq') + '</div>' +
                '<div style="display:flex;gap:8px;margin-bottom:10px;">' +
                    '<button type="button" onclick="window.openDeckBIsolatedSettingsModal(event)" style="flex:1;padding:9px 10px;border-radius:8px;background:#0b1836;border:1px solid #60a5fa;color:#dbeafe;font-weight:bold;font-size:12px;cursor:pointer;">⚙️ Все студийные настройки Деки Б (FIR / PRO / РКПП)</button>' +
                    '<button type="button" onclick="window.resetDeckBEqFlatV359(event)" style="padding:9px 12px;border-radius:8px;background:#161b22;border:1px solid #e3b341;color:#e3b341;font-weight:bold;font-size:12px;cursor:pointer;">🔄 Сброс 0 dB</button>' +
                '</div>' +
                '<div class="setting-row" style="flex-direction:column;align-items:stretch;gap:20px;border:none;padding-top:12px;">' +
                    bandsHtml +
                '</div>' +
            '</div>';

        var refModal = document.getElementById('eqModal') || document.getElementById('settingsModal');
        if (refModal && refModal.parentNode) {
            refModal.parentNode.insertBefore(m, refModal.nextSibling);
        } else {
            document.body.appendChild(m);
        }
        return m;
    }

    window.onDeckBEqSliderInputV359 = function(freq, rawVal) {
        var val = parseInt(rawVal, 10) || 0;
        var cfg = getDeckBConfig();
        cfg.eq = cfg.eq || { b60: 0, b230: 0, b910: 0, b3600: 0, b14000: 0 };
        cfg.eq['b' + freq] = val;
        window._deckBEqV218 = window._deckBEqV218 || {};
        window._deckBEqV218['b' + freq] = val;
        var lbl = document.getElementById('eqDeckB_val_' + freq);
        if (lbl) lbl.innerText = (val > 0 ? '+' : '') + val + ' dB';
        if (window.videoDeckV131 && window.videoDeckV131.eqNodes && window.videoDeckV131.eqNodes['band' + freq]) {
            window.videoDeckV131.eqNodes['band' + freq].gain.value = val;
        }
        try { localStorage.setItem('jenny_eq_deckB_v218', JSON.stringify(window._deckBEqV218)); } catch (e) {}
        if (typeof window.saveVideoConfigV131 === 'function') window.saveVideoConfigV131();
        if (typeof window.syncPersistentUserDataV218 === 'function') window.syncPersistentUserDataV218(false);
    };

    window.resetDeckBEqFlatV359 = function(ev) {
        var cfg = getDeckBConfig();
        cfg.eq = { b60: 0, b230: 0, b910: 0, b3600: 0, b14000: 0 };
        window._deckBEqV218 = Object.assign({}, cfg.eq);
        try { localStorage.setItem('jenny_eq_deckB_v218', JSON.stringify(window._deckBEqV218)); } catch (e) {}
        if (typeof window.applyBothDecksEQNodesV218 === 'function') window.applyBothDecksEQNodesV218();
        saveAndRebuildDeckB(true);
        window.syncDeckBIsolatedEqModalUI();
        if (typeof window.showToast === 'function') window.showToast('🔄 Эквалайзер Деки Б сброшен в 0 dB', ev);
    };

    window.syncDeckBIsolatedEqModalUI = function() {
        var m = document.getElementById('eqModalDeckB');
        if (!m) return;
        var banner = document.getElementById('deckSwitchBarEqDeckB');
        if (banner) banner.innerHTML = buildTopDeckSwitchBannerHTML('video', 'eq');
        var cfg = getDeckBConfig();
        var eqObj = window._deckBEqV218 || cfg.eq || { b60: 0, b230: 0, b910: 0, b3600: 0, b14000: 0 };
        [60, 230, 910, 3600, 14000].forEach(function(f) {
            var v = parseFloat(eqObj['b' + f]) || 0;
            var sl = document.getElementById('eqDeckB_' + f);
            var lbl = document.getElementById('eqDeckB_val_' + f);
            if (sl) sl.value = String(v);
            if (lbl) lbl.innerText = (v > 0 ? '+' : '') + v + ' dB';
        });
        window.updateDeckBAutoCeilMonitorUI();
    };

    // ========================================================================
    // 2. ПОЛНАЯ 1:1 КОПИЯ ВСЕХ НАСТРОЕК ДЕКИ Б (#settingsModalDeckB)
    // ========================================================================
    function ensureDeckBSettingsModalDOM() {
        var sm = document.getElementById('settingsModalDeckB');
        if (sm) return sm;

        sm = document.createElement('div');
        sm.id = 'settingsModalDeckB';
        sm.className = 'modal-overlay';

        var buildDspRowsB = function(rowsArr) {
            return rowsArr.map(function(r) {
                var k = r[0], lbl = r[1], stp = r[2], hKey = r[3];
                if (k === 'masterCeil') {
                    return '<div class="setting-row" style="border:none;padding:6px 0;gap:6px;">' +
                        '<div style="display:flex;align-items:center;flex:1;min-width:0;">' +
                            '<label class="toggle-label" style="color:#e6edf3;font-size:12.5px;margin:0;">' +
                                '<input type="checkbox" id="cfgB_opt_masterCeil" onchange="window.onDeckBDspModChangeV359(\'masterCeil\', event)"> ' +
                                trB('🛡️ Авто-Мастер-Потолок:', '🛡️ Auto-Master Ceiling:') +
                            '</label>' +
                            '<span class="jenny-help-badge" onclick="if(window.showHelpTopic) window.showHelpTopic(\'' + hKey + '\', event)" style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11px;margin-left:5px;cursor:pointer;flex-shrink:0;">❓</span>' +
                        '</div>' +
                        '<span id="autoCeilStatusBadgeDeckB" style="background:#161b22;border:1px solid #30363d;border-radius:6px;padding:4px 10px;font-size:11.5px;font-weight:bold;color:#3fb950;flex-shrink:0;">Авто: -0.5 dB</span>' +
                    '</div>';
                }
                return '<div class="setting-row" style="border:none;padding:4px 0;gap:6px;">' +
                    '<div style="display:flex;align-items:center;flex:1;min-width:0;">' +
                        '<label class="toggle-label" style="color:#e6edf3;font-size:12.5px;margin:0;">' +
                            '<input type="checkbox" id="cfgB_opt_' + k + '" onchange="window.onDeckBDspModChangeV359(\'' + k + '\', event)"> ' + lbl +
                        '</label>' +
                        '<span class="jenny-help-badge" onclick="if(window.showHelpTopic) window.showHelpTopic(\'' + hKey + '\', event)" style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11px;margin-left:5px;cursor:pointer;flex-shrink:0;">❓</span>' +
                    '</div>' +
                    '<div style="display:flex;gap:4px;align-items:center;flex-shrink:0;">' +
                        '<button type="button" class="io-btn" onclick="window.loadDeckBDspModRowV359(\'' + k + '\', this, event)">📥</button>' +
                        '<input type="number" step="' + stp + '" id="cfgB_val_' + k + '" oninput="window.onDeckBDspModChangeV359(\'' + k + '\')" style="width:52px;">' +
                        '<button type="button" class="io-btn" onclick="window.saveDeckBDspModRowV359(\'' + k + '\', this, event)">💾</button>' +
                    '</div>' +
                '</div>';
            }).join('');
        };

        var rowsModB = [
            ['midPhase',   trB('🎯 Фаза СЧ Вокал (dB):', '🎯 Vocal Mid Gain (dB):'), '1', 'mod_midPhase'],
            ['midQ',       trB('📐 Ширина СЧ купола (%):', '📐 Mid Dome Width (%):'), '10', 'mod_midQ'],
            ['deEsser',    trB('🐍 Де-эссер ВЧ (dB):', '🐍 HF De-Esser (dB):'), '1', 'mod_deEsser'],
            ['cleanFir',   trB('✨ Драйв Чистый FIR (dB):', '✨ Clean FIR Drive (dB):'), '1', 'mod_cleanFir'],
            ['masterCeil', trB('🛡️ Мастер-потолок (dB):', '🛡️ Master Ceiling (dB):'), '1', 'mod_masterCeil']
        ];

        var rowsProB = [
            ['autoRms',   trB('⚡ Авто-RMS Цель (dB):', '⚡ Auto-RMS Target (dB):'), '1', 'pro_autoRms'],
            ['monoBass',  trB('🧲 Моно-Саббас (Hz):', '🧲 Mono Sub-Bass (Hz):'), '20', 'pro_monoBass'],
            ['msWidth',   trB('🎭 Стерео-Ширина (%):', '🎭 Stereo Width (%):'), '25', 'pro_msWidth'],
            ['punch',     trB('🥁 Панч-Хлыст (dB):', '🥁 Punch Whip (dB):'), '1', 'pro_punch'],
            ['crossfeed', trB('🎧 Бинаурал-Колонки (%):', '🎧 Binaural Speakers (%):'), '10', 'pro_crossfeed']
        ];

        var zonesGridB = '';
        for (var zi = 1; zi <= 6; zi++) {
            zonesGridB += '<div style="display:flex;align-items:center;justify-content:space-between;background:#0d1117;padding:4px 8px;border-radius:4px;border:1px solid #30363d;">' +
                '<input type="checkbox" id="cfgB_z' + zi + '_en" onchange="window.checkZonesDeckBV359(' + zi + ')">' +
                '<input type="number" id="cfgB_z' + zi + '_val" oninput="window.saveZonesToConfigDeckBV359()" step="0.01" style="width:50px;font-size:12px;padding:2px;text-align:center;background:transparent;color:#58a6ff;border:none;outline:none;">' +
            '</div>';
        }

        sm.innerHTML =
            '<div class="container" id="settingsModalDeckBContainer">' +
                '<div id="deckSwitchBarSettingsDeckB">' + buildTopDeckSwitchBannerHTML('video', 'settings') + '</div>' +
                '<div id="jennyFourBuffersHudBarB">' + window.renderFourBuffersStatusHTMLV359() + '</div>' +

                '<div style="display:flex;gap:8px;margin-bottom:12px;align-items:stretch;">' +
                    '<button type="button" onclick="if(window.showFullHelpGuide) window.showFullHelpGuide(event)" style="flex:1;background:#161b22;border:1px solid #3b82f6;color:#93c5fd;font-weight:bold;padding:11px;border-radius:8px;font-size:12.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">📖 СПРАВОЧНИК НАСТРОЕК (❓)</button>' +
                    '<button type="button" onclick="if(window.openOnboardingGuideV165) window.openOnboardingGuideV165(0, event)" style="background:#161b22;border:1px solid #3fb950;color:#3fb950;font-weight:bold;padding:0 12px;border-radius:8px;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">🧭 Гид</button>' +
                '</div>' +

                '<div style="display:flex;gap:10px;margin-bottom:15px;">' +
                    '<button type="button" onclick="window.loadDeckBConfigFromDiskV359(event)" style="flex:1;background:linear-gradient(180deg,#1f6feb 0%,#11469c 100%);color:#fff;font-weight:bold;border:1px solid #58a6ff;padding:12px;border-radius:8px;cursor:pointer;">📥 ЗАГРУЗИТЬ ВСЁ (Б)</button>' +
                    '<button type="button" onclick="window.saveDeckBConfigToDiskV359(event)" style="flex:1;background:linear-gradient(180deg,#2ea043 0%,#196c2e 100%);color:#fff;font-weight:bold;border:1px solid #3fb950;padding:12px;border-radius:8px;cursor:pointer;">💾 СОХРАНИТЬ ВСЁ (Б)</button>' +
                '</div>' +

                '<!-- 1. СТУДИЙНЫЙ ДВИЖОК (RAM) ДЕКИ Б -->' +
                '<div class="setting-row jenny-deckb-card" data-ab-sec="sec_studio_ram" style="display:flex;align-items:center;justify-content:space-between;">' +
                    '<label class="toggle-label" style="color:#e6edf3;font-weight:bold;flex:1;">' +
                        '<input type="checkbox" id="cfgB_studioMode" onchange="window.updateDeckBSettingsFromDOMV359()"> Студийный движок (RAM)' +
                    '</label>' +
                    buildABSectionSwitchHTML('video', 'sec_studio_ram') +
                    '<span class="jenny-help-badge" onclick="if(window.showHelpTopic) window.showHelpTopic(\'studio_ram\', event)" style="display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11.5px;margin-left:6px;cursor:pointer;">❓</span>' +
                '</div>' +

                '<!-- 2. ФАЗОВЫЙ ФОКУС ДЕКИ Б -->' +
                '<div class="setting-row jenny-deckb-card" data-ab-sec="sec_phase_focus" style="display:flex;align-items:center;justify-content:space-between;">' +
                    '<label class="toggle-label" style="color:#e6edf3;font-weight:bold;flex:1;">' +
                        '<input type="checkbox" id="cfgB_phaseFix" onchange="window.onDeckBPhaseFocusChangeV359(this, event)"> 🎯 Фазовый фокус (Выравнивание вокала и баса)' +
                    '</label>' +
                    buildABSectionSwitchHTML('video', 'sec_phase_focus') +
                    '<span class="jenny-help-badge" onclick="if(window.showHelpTopic) window.showHelpTopic(\'phase_focus\', event)" style="display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11.5px;margin-left:6px;cursor:pointer;">❓</span>' +
                '</div>' +

                '<!-- 3. ТОНКАЯ НАСТРОЙКА ТРАКТА (5 ОПЦИЙ) ДЕКИ Б -->' +
                '<details class="setting-group" open data-ab-sec="sec_dsp_mod">' +
                    '<summary style="display:flex;align-items:center;justify-content:space-between;">' +
                        '<span>🧪 Тонкая настройка тракта (5 опций)</span>' +
                        '<span style="display:inline-flex;align-items:center;gap:4px;">' +
                            buildABSectionSwitchHTML('video', 'sec_dsp_mod') +
                            '<span class="jenny-help-badge" onclick="if(window.showHelpTopic) window.showHelpTopic(\'mod_block\', event)" style="display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11px;cursor:pointer;">❓</span>' +
                        '</span>' +
                    '</summary>' +
                    '<div class="group-content" style="position:relative;">' +
                        '<div id="dspModLockShieldDeckB" onclick="try{navigator.vibrate(40);}catch(e){}; if(window.showToast) window.showToast(\'🔒 Блок управления отключён! Для включения выключите «Фазовый фокус»\', event);" style="display:none;position:absolute;inset:0;z-index:20;cursor:not-allowed;"></div>' +
                        '<div id="dspModBodyWrapDeckB" style="transition:opacity 0.2s ease;">' +
                            '<div class="setting-row" style="border:none;padding:2px 0 8px 0;">' +
                                '<span style="color:#8b949e;font-size:12px;">Модули кроссовера и сатурации:</span>' +
                                '<button type="button" onclick="window.resetDeckBDspGroupV359([\'midPhase\',\'midQ\',\'deEsser\',\'cleanFir\',\'masterCeil\'], \'🔄 5 опций тракта Деки Б сброшены!\', event)" style="font-size:11px;padding:3px 8px;">🔄 Сброс</button>' +
                            '</div>' +
                            buildDspRowsB(rowsModB) +
                        '</div>' +
                    '</div>' +
                '</details>' +

                '<!-- 4. МАСТЕРИНГ-СТУДИЯ PRO (5 СПЕЦ-МОДУЛЕЙ) ДЕКИ Б -->' +
                '<details class="setting-group" open data-ab-sec="sec_dsp_pro">' +
                    '<summary style="display:flex;align-items:center;justify-content:space-between;">' +
                        '<span>🚀 Мастеринг-Студия PRO (5 спец-модулей)</span>' +
                        '<span style="display:inline-flex;align-items:center;gap:4px;">' +
                            buildABSectionSwitchHTML('video', 'sec_dsp_pro') +
                            '<span class="jenny-help-badge" onclick="if(window.showHelpTopic) window.showHelpTopic(\'pro_block\', event)" style="display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11px;cursor:pointer;">❓</span>' +
                        '</span>' +
                    '</summary>' +
                    '<div class="group-content">' +
                        '<div class="setting-row" style="border:none;padding:2px 0 8px 0;">' +
                            '<span style="color:#8b949e;font-size:12px;">Психоакустика и динамика мембран:</span>' +
                            '<button type="button" onclick="window.resetDeckBDspGroupV359([\'autoRms\',\'monoBass\',\'msWidth\',\'punch\',\'crossfeed\'], \'🔄 Модули PRO Studio Деки Б сброшены!\', event)" style="font-size:11px;padding:3px 8px;">🔄 Сброс</button>' +
                        '</div>' +
                        buildDspRowsB(rowsProB) +
                    '</div>' +
                '</details>' +

                '<!-- 5. ИНТЕЛЛЕКТУАЛЬНЫЙ СКРАББИНГ + МЕХАНИЧЕСКАЯ 5-СТУПЕНЧАТАЯ РКПП ДЕКИ Б -->' +
                '<details class="setting-group" open data-ab-sec="sec_scrub">' +
                    '<summary style="display:flex;align-items:center;justify-content:space-between;">' +
                        '<span>⚡ Интеллектуальный Скраббинг</span>' +
                        '<span style="display:inline-flex;align-items:center;gap:4px;">' +
                            buildABSectionSwitchHTML('video', 'sec_scrub') +
                            '<span class="jenny-help-badge" onclick="if(window.showHelpTopic) window.showHelpTopic(\'scrub_group\', event)" style="display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11px;cursor:pointer;">❓</span>' +
                        '</span>' +
                    '</summary>' +
                    '<div class="group-content">' +
                        '<div class="setting-row" style="border:none;padding:5px 0;">' +
                            '<label class="toggle-label" style="color:#e6edf3;">' +
                                '<input type="checkbox" id="cfgB_leftHandedMode" onchange="window.updateDeckBSettingsFromDOMV359()"> 🖐️ Режим "Левша" (Зеркальная дуга)' +
                            '</label>' +
                        '</div>' +

                        '<!-- 5-СТУПЕНЧАТАЯ МЕХАНИЧЕСКАЯ КПП ДЕКИ Б (1:1 КОПИЯ V66) -->' +
                        '<div id="jbufMechanicalGearboxDeckB" class="gearbox-container">' +
                            '<div class="gearbox-knob-plate" id="gearPlateDeckB">' +
                                '<svg class="gearbox-svg-overlay" viewBox="0 0 264 264">' +
                                    '<defs>' +
                                        '<linearGradient id="plGradDeckB" x1="0%" y1="0%" x2="100%" y2="0%">' +
                                            '<stop offset="0%" stop-color="#3fb950"/>' +
                                            '<stop offset="100%" stop-color="#58a6ff"/>' +
                                        '</linearGradient>' +
                                        '<linearGradient id="psGradDeckB" x1="0%" y1="0%" x2="100%" y2="0%">' +
                                            '<stop offset="0%" stop-color="#a371f7"/>' +
                                            '<stop offset="100%" stop-color="#e3b341"/>' +
                                        '</linearGradient>' +
                                    '</defs>' +
                                    '<rect x="64" y="13" width="136" height="20" rx="10" fill="#070a10" stroke="url(#plGradDeckB)" stroke-width="1.5"/>' +
                                    '<text x="132" y="27" fill="#e6edf3" font-family="monospace" font-weight="900" font-size="11.5" text-anchor="middle" letter-spacing="1.8">▲ PITCH LOCK</text>' +
                                    '<rect x="60" y="231" width="144" height="20" rx="10" fill="#070a10" stroke="url(#psGradDeckB)" stroke-width="1.5"/>' +
                                    '<text x="132" y="245" fill="#e6edf3" font-family="monospace" font-weight="900" font-size="11.5" text-anchor="middle" letter-spacing="1.5">▼ PITCH SHIFT</text>' +
                                '</svg>' +
                                '<div id="encB-jbuf" class="gearbox-gate-enclosure" style="left:41px;top:40px;width:46px;height:184px;"></div>' +
                                '<div id="encB-web" class="gearbox-gate-enclosure" style="left:107px;top:40px;width:46px;height:184px;"></div>' +
                                '<div id="encB-vinyl" class="gearbox-gate-enclosure" style="left:173px;top:116px;width:46px;height:108px;"></div>' +
                                '<div class="gearbox-h-line" style="left:52px;top:129px;width:136px;height:6px;"></div>' +
                                '<div class="gearbox-h-line" style="left:52px;top:50px;width:6px;height:164px;"></div>' +
                                '<div class="gearbox-h-line" style="left:118px;top:50px;width:6px;height:164px;"></div>' +
                                '<div class="gearbox-h-line" style="left:184px;top:129px;width:6px;height:85px;"></div>' +
                                '<div class="gearbox-stopper-dot" style="left:51px;top:48px;"></div>' +
                                '<div class="gearbox-stopper-dot" style="left:51px;top:208px;"></div>' +
                                '<div class="gearbox-stopper-dot" style="left:117px;top:48px;"></div>' +
                                '<div class="gearbox-stopper-dot" style="left:117px;top:208px;"></div>' +
                                '<div class="gearbox-stopper-dot" style="left:183px;top:208px;"></div>' +
                                '<div class="gearbox-letter jbuf-mode-color" id="letB-J" style="left:65px;top:72px;">J</div>' +
                                '<div class="gearbox-letter jbuf-mode-color" id="letB-b" style="left:65px;top:148px;">B</div>' +
                                '<div class="gearbox-letter jbuf-mode-color" id="letB-u" style="left:65px;top:170px;">u</div>' +
                                '<div class="gearbox-letter jbuf-mode-color" id="letB-f" style="left:65px;top:192px;">f</div>' +
                                '<div class="gearbox-letter" id="letB-W" style="left:131px;top:52px;">W</div>' +
                                '<div class="gearbox-letter" id="letB-e" style="left:131px;top:74px;">e</div>' +
                                '<div class="gearbox-letter" id="letB-web-b" style="left:131px;top:96px;">b</div>' +
                                '<div class="gearbox-letter" id="letB-a" style="left:131px;top:148px;">A</div>' +
                                '<div class="gearbox-letter" id="letB-p" style="left:131px;top:170px;">P</div>' +
                                '<div class="gearbox-letter" id="letB-i" style="left:131px;top:192px;">I</div>' +
                                '<div class="gearbox-letter vinyl-mode-color" id="letB-v" style="left:197px;top:128px;">В</div>' +
                                '<div class="gearbox-letter vinyl-mode-color" id="letB-i-vin" style="left:197px;top:145px;">И</div>' +
                                '<div class="gearbox-letter vinyl-mode-color" id="letB-n" style="left:197px;top:162px;">Н</div>' +
                                '<div class="gearbox-letter vinyl-mode-color" id="letB-i-vin2" style="left:197px;top:179px;">И</div>' +
                                '<div class="gearbox-letter vinyl-mode-color" id="letB-l" style="left:197px;top:196px;">Л</div>' +
                                '<div class="gearbox-knob-lever" id="gearKnobDeckB">' +
                                    '<span class="gearbox-knob-inner-text" id="gearKnobTextDeckB">J▲</span>' +
                                '</div>' +
                            '</div>' +
                            '<div class="gearbox-status-readout" id="gearStatusTextDeckB">🕹️ 1-я: ⚡ J Buf 90° [PITCH LOCK]</div>' +
                        '</div>' +

                        '<!-- УПРУГОСТЬ ПЕТЕЛЬ 90° И КНОПКА АНАЛИЗАТОРА/ОСЦИЛЛОГРАФА ДЕКИ Б -->' +
                        '<div id="hoseControlBoxDeckB" style="background:rgba(59,130,246,0.07);border:1px solid rgba(59,130,246,0.45);border-radius:10px;padding:8px 10px;margin:6px 0 10px 0;">' +
                            '<div class="setting-row" style="padding:4px 0;border:none;">' +
                                '<span style="font-size:12px;color:#8b949e;">🧲 Упругость петель (Амплитуда ↔ Время %):</span>' +
                                '<div class="val-group"><span class="val-badge" id="val_hoseTensionDeckB">100</span></div>' +
                            '</div>' +
                            '<input type="range" id="rng_hoseTensionDeckB" class="hz-slider" min="20" max="200" step="5" value="100" oninput="window.onDeckBHoseTensionInputV359(this.value)">' +
                            '<button type="button" onclick="window.openDeckBIsolatedSpecModal(event)" style="width:100%;margin-top:8px;padding:8px;background:#0d1117;border:1px solid #3b82f6;color:#58a6ff;border-radius:7px;font-size:11.5px;font-weight:bold;cursor:pointer;">📊 Открыть Анализатор спектра и Осциллограф волны</button>' +
                        '</div>' +

                        '<div class="setting-row" style="border:none;padding:4px 0;">' +
                            '<label class="toggle-label" style="color:#e3b341;">' +
                                '<input type="checkbox" id="cfgB_xNormalSpeed" onchange="window.updateDeckBSettingsFromDOMV359()"> 🚀 Кастомная скорость (Base)' +
                            '</label>' +
                            '<div style="display:flex;gap:4px;align-items:center;">' +
                                '<button type="button" class="io-btn" onclick="window.loadDeckBSingleV359(\'main\', \'normalPlaybackSpeed\', \'cfgB_normalPlaybackSpeed\')">📥</button>' +
                                '<input type="number" id="cfgB_normalPlaybackSpeed" oninput="window.updateDeckBSettingsFromDOMV359()" step="0.01" style="width:50px;" placeholder="0.97">' +
                                '<button type="button" class="io-btn" onclick="window.saveDeckBSingleV359(\'main\', \'normalPlaybackSpeed\', \'cfgB_normalPlaybackSpeed\')">💾</button>' +
                            '</div>' +
                        '</div>' +
                        '<div class="setting-row" style="border:none;padding:0 0 10px 20px;">' +
                            '<label class="toggle-label" style="color:#8b949e;font-size:12px;">' +
                                '<input type="checkbox" id="cfgB_autoSaveBase" onchange="window.toggleDeckBAutoSaveV359(\'base\', event)"> ↳ Писать выбор дуги сюда' +
                            '</label>' +
                        '</div>' +

                        '<div class="setting-row" style="border:none;padding:4px 0;">' +
                            '<span style="color:#8b949e;font-size:13px;">Дефолтная скорость дуги:</span>' +
                            '<div style="display:flex;gap:4px;align-items:center;">' +
                                '<button type="button" class="io-btn" onclick="window.loadDeckBSingleV359(\'main\', \'defaultScrubSpeed\', \'cfgB_defaultScrubSpeed\')">📥</button>' +
                                '<input type="number" id="cfgB_defaultScrubSpeed" oninput="window.updateDeckBSettingsFromDOMV359()" step="0.1" style="width:50px;">' +
                                '<button type="button" class="io-btn" onclick="window.saveDeckBSingleV359(\'main\', \'defaultScrubSpeed\', \'cfgB_defaultScrubSpeed\')">💾</button>' +
                            '</div>' +
                        '</div>' +
                        '<div class="setting-row" style="border:none;padding:0 0 10px 20px;">' +
                            '<label class="toggle-label" style="color:#8b949e;font-size:12px;">' +
                                '<input type="checkbox" id="cfgB_autoSaveScrub" onchange="window.toggleDeckBAutoSaveV359(\'scrub\', event)"> ↳ Писать выбор дуги сюда' +
                            '</label>' +
                        '</div>' +

                        '<div style="border-top:1px solid #30363d;margin-top:10px;padding-top:10px;">' +
                            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
                                '<span style="color:#8b949e;font-size:12px;font-weight:bold;">Кастомные радиальные зоны:</span>' +
                                '<button type="button" onclick="window.resetDeckBScrubZonesV359()" style="font-size:11px;padding:3px 8px;">🔄 Сброс</button>' +
                            '</div>' +
                            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' + zonesGridB + '</div>' +
                        '</div>' +
                    '</div>' +
                '</details>' +

                '<!-- 6. ПОЛЗУНОК ГРОМКОСТИ ДЕКИ Б -->' +
                '<div class="setting-row jenny-deckb-card" data-ab-sec="sec_vol" style="display:flex;align-items:center;justify-content:space-between;">' +
                    '<label class="toggle-label" style="color:#e6edf3;font-weight:bold;flex:1;">' +
                        '<input type="checkbox" id="cfgB_volSlider" onchange="window.updateDeckBSettingsFromDOMV359()"> 🔊 Показывать ползунок громкости' +
                    '</label>' +
                    buildABSectionSwitchHTML('video', 'sec_vol') +
                '</div>' +

                '<!-- 7. FIR-САТУРАТОР (ЛАМПОВЫЙ ОКРАС) ДЕКИ Б -->' +
                '<details class="setting-group" open data-ab-sec="sec_fir">' +
                    '<summary style="display:flex;align-items:center;justify-content:space-between;">' +
                        '<span>✨ FIR-Сатуратор (Ламповый окрас)</span>' +
                        '<span style="display:inline-flex;align-items:center;gap:4px;">' +
                            buildABSectionSwitchHTML('video', 'sec_fir') +
                            '<span class="jenny-help-badge" onclick="if(window.showHelpTopic) window.showHelpTopic(\'fir_group\', event)" style="display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11px;cursor:pointer;">❓</span>' +
                        '</span>' +
                    '</summary>' +
                    '<div class="group-content">' +
                        '<div class="setting-row" style="border:none;padding:5px 0 10px 0;">' +
                            '<label class="toggle-label" style="color:#e6edf3;font-weight:bold;"><input type="checkbox" id="cfgB_firEnabled" onchange="window.updateDeckBSettingsFromDOMV359()"> Включить FIR</label>' +
                            '<button type="button" onclick="window.resetDeckBFIRV359()" style="font-size:11px;padding:3px 8px;">🔄 Сброс</button>' +
                        '</div>' +
                        '<div class="setting-row" style="border:none;padding:4px 0;">' +
                            '<span style="color:#8b949e;font-size:13px;">Усиление (Gain):</span>' +
                            '<div style="display:flex;gap:4px;align-items:center;">' +
                                '<button type="button" class="io-btn" onclick="window.loadDeckBSingleV359(\'firSettings\', \'gain\', \'cfgB_fir_gain\')">📥</button>' +
                                '<input type="number" id="cfgB_fir_gain" oninput="window.updateDeckBSettingsFromDOMV359()" step="0.1" style="width:50px;">' +
                                '<button type="button" class="io-btn" onclick="window.saveDeckBSingleV359(\'firSettings\', \'gain\', \'cfgB_fir_gain\')">💾</button>' +
                            '</div>' +
                        '</div>' +
                        '<div class="setting-row" style="border:none;padding:4px 0;">' +
                            '<span style="color:#8b949e;font-size:13px;">Импульс (ms):</span>' +
                            '<div style="display:flex;gap:4px;align-items:center;">' +
                                '<button type="button" class="io-btn" onclick="window.loadDeckBSingleV359(\'firSettings\', \'decay\', \'cfgB_fir_decay\')">📥</button>' +
                                '<input type="number" id="cfgB_fir_decay" oninput="window.updateDeckBSettingsFromDOMV359()" step="0.01" style="width:50px;">' +
                                '<button type="button" class="io-btn" onclick="window.saveDeckBSingleV359(\'firSettings\', \'decay\', \'cfgB_fir_decay\')">💾</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</details>' +

                '<!-- 8. МНОГОПОЛОСНЫЙ КРОССОВЕР (3-BAND) ДЕКИ Б -->' +
                '<details class="setting-group" open data-ab-sec="sec_mb">' +
                    '<summary style="display:flex;align-items:center;justify-content:space-between;">' +
                        '<span>🎚️ Многополосный кроссовер (3-Band)</span>' +
                        '<span style="display:inline-flex;align-items:center;gap:4px;">' +
                            buildABSectionSwitchHTML('video', 'sec_mb') +
                            '<span class="jenny-help-badge" onclick="if(window.showHelpTopic) window.showHelpTopic(\'mb_group\', event)" style="display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11px;cursor:pointer;">❓</span>' +
                        '</span>' +
                    '</summary>' +
                    '<div class="group-content">' +
                        '<div class="setting-row" style="border:none;padding:5px 0 10px 0;">' +
                            '<label class="toggle-label" style="color:#e6edf3;font-weight:bold;"><input type="checkbox" id="cfgB_multiBandEnabled" onchange="window.updateDeckBSettingsFromDOMV359()"> Разделение частот</label>' +
                            '<button type="button" onclick="window.resetDeckBMultiBandV359()" style="font-size:11px;padding:3px 8px;">🔄 Сброс</button>' +
                        '</div>' +
                        '<div class="setting-row" style="border:none;padding:4px 0;">' +
                            '<span style="color:#8b949e;font-size:13px;">Отсечка Баса (Hz):</span>' +
                            '<div style="display:flex;gap:4px;align-items:center;">' +
                                '<button type="button" class="io-btn" onclick="window.loadDeckBSingleV359(\'multiBandSettings\', \'low\', \'cfgB_mb_low\')">📥</button>' +
                                '<input type="number" id="cfgB_mb_low" oninput="window.updateDeckBSettingsFromDOMV359()" step="10" style="width:50px;">' +
                                '<button type="button" class="io-btn" onclick="window.saveDeckBSingleV359(\'multiBandSettings\', \'low\', \'cfgB_mb_low\')">💾</button>' +
                            '</div>' +
                        '</div>' +
                        '<div class="setting-row" style="border:none;padding:4px 0;">' +
                            '<span style="color:#8b949e;font-size:13px;">Отсечка Верх (Hz):</span>' +
                            '<div style="display:flex;gap:4px;align-items:center;">' +
                                '<button type="button" class="io-btn" onclick="window.loadDeckBSingleV359(\'multiBandSettings\', \'high\', \'cfgB_mb_high\')">📥</button>' +
                                '<input type="number" id="cfgB_mb_high" oninput="window.updateDeckBSettingsFromDOMV359()" step="100" style="width:50px;">' +
                                '<button type="button" class="io-btn" onclick="window.saveDeckBSingleV359(\'multiBandSettings\', \'high\', \'cfgB_mb_high\')">💾</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</details>' +

                '<!-- 9. ЛИМИТЕР (SOFT CLIPPER) ДЕКИ Б -->' +
                '<details class="setting-group" open data-ab-sec="sec_lim">' +
                    '<summary style="display:flex;align-items:center;justify-content:space-between;">' +
                        '<span>🗜️ Лимитер (Soft Clipper)</span>' +
                        '<span style="display:inline-flex;align-items:center;gap:4px;">' +
                            buildABSectionSwitchHTML('video', 'sec_lim') +
                            '<span class="jenny-help-badge" onclick="if(window.showHelpTopic) window.showHelpTopic(\'lim_group\', event)" style="display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11px;cursor:pointer;">❓</span>' +
                        '</span>' +
                    '</summary>' +
                    '<div class="group-content">' +
                        '<div class="setting-row" style="border:none;padding:5px 0 10px 0;">' +
                            '<label class="toggle-label" style="color:#e6edf3;font-weight:bold;"><input type="checkbox" id="cfgB_limiterEnabled" onchange="window.updateDeckBSettingsFromDOMV359()"> Включить лимитер</label>' +
                            '<button type="button" onclick="window.resetDeckBLimiterV359()" style="font-size:11px;padding:3px 8px;">🔄 Сброс</button>' +
                        '</div>' +
                        '<div class="setting-row" style="border:none;padding:4px 0;">' +
                            '<span style="color:#8b949e;font-size:13px;">Порог (dB):</span>' +
                            '<div style="display:flex;gap:4px;align-items:center;">' +
                                '<button type="button" class="io-btn" onclick="window.loadDeckBSingleV359(\'limiterSettings\', \'threshold\', \'cfgB_lim_threshold\')">📥</button>' +
                                '<input type="number" id="cfgB_lim_threshold" oninput="window.updateDeckBSettingsFromDOMV359()" step="1" style="width:50px;">' +
                                '<button type="button" class="io-btn" onclick="window.saveDeckBSingleV359(\'limiterSettings\', \'threshold\', \'cfgB_lim_threshold\')">💾</button>' +
                            '</div>' +
                        '</div>' +
                        '<div class="setting-row" style="border:none;padding:4px 0;">' +
                            '<span style="color:#8b949e;font-size:13px;">Смягчение (Knee):</span>' +
                            '<div style="display:flex;gap:4px;align-items:center;">' +
                                '<button type="button" class="io-btn" onclick="window.loadDeckBSingleV359(\'limiterSettings\', \'knee\', \'cfgB_lim_knee\')">📥</button>' +
                                '<input type="number" id="cfgB_lim_knee" oninput="window.updateDeckBSettingsFromDOMV359()" step="1" style="width:50px;">' +
                                '<button type="button" class="io-btn" onclick="window.saveDeckBSingleV359(\'limiterSettings\', \'knee\', \'cfgB_lim_knee\')">💾</button>' +
                            '</div>' +
                        '</div>' +
                        '<div class="setting-row" style="border:none;padding:4px 0;">' +
                            '<span style="color:#8b949e;font-size:13px;">Сжатие (Ratio):</span>' +
                            '<div style="display:flex;gap:4px;align-items:center;">' +
                                '<button type="button" class="io-btn" onclick="window.loadDeckBSingleV359(\'limiterSettings\', \'ratio\', \'cfgB_lim_ratio\')">📥</button>' +
                                '<input type="number" id="cfgB_lim_ratio" oninput="window.updateDeckBSettingsFromDOMV359()" step="1" style="width:50px;">' +
                                '<button type="button" class="io-btn" onclick="window.saveDeckBSingleV359(\'limiterSettings\', \'ratio\', \'cfgB_lim_ratio\')">💾</button>' +
                            '</div>' +
                        '</div>' +
                        '<div class="setting-row" style="border:none;padding:4px 0;">' +
                            '<span style="color:#8b949e;font-size:13px;">Атака (ms):</span>' +
                            '<div style="display:flex;gap:4px;align-items:center;">' +
                                '<button type="button" class="io-btn" onclick="window.loadDeckBSingleV359(\'limiterSettings\', \'attack\', \'cfgB_lim_attack\')">📥</button>' +
                                '<input type="number" id="cfgB_lim_attack" oninput="window.updateDeckBSettingsFromDOMV359()" step="1" style="width:50px;">' +
                                '<button type="button" class="io-btn" onclick="window.saveDeckBSingleV359(\'limiterSettings\', \'attack\', \'cfgB_lim_attack\')">💾</button>' +
                            '</div>' +
                        '</div>' +
                        '<div class="setting-row" style="border:none;padding:4px 0;">' +
                            '<span style="color:#8b949e;font-size:13px;">Спад (ms):</span>' +
                            '<div style="display:flex;gap:4px;align-items:center;">' +
                                '<button type="button" class="io-btn" onclick="window.loadDeckBSingleV359(\'limiterSettings\', \'release\', \'cfgB_lim_release\')">📥</button>' +
                                '<input type="number" id="cfgB_lim_release" oninput="window.updateDeckBSettingsFromDOMV359()" step="10" style="width:50px;">' +
                                '<button type="button" class="io-btn" onclick="window.saveDeckBSingleV359(\'limiterSettings\', \'release\', \'cfgB_lim_release\')">💾</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</details>' +

                '<!-- 10. ЭКВАЛАЙЗЕР (EQ IIR) ДЕКИ Б -->' +
                '<details class="setting-group" open data-ab-sec="sec_eq">' +
                    '<summary style="display:flex;align-items:center;justify-content:space-between;">' +
                        '<span>🎛️ Эквалайзер (EQ IIR)</span>' +
                        '<span style="display:inline-flex;align-items:center;gap:4px;">' +
                            buildABSectionSwitchHTML('video', 'sec_eq') +
                            '<span class="jenny-help-badge" onclick="if(window.showHelpTopic) window.showHelpTopic(\'eq_group\', event)" style="display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11px;cursor:pointer;">❓</span>' +
                        '</span>' +
                    '</summary>' +
                    '<div class="group-content">' +
                        '<div class="setting-row" style="border:none;padding:5px 0;">' +
                            '<label class="toggle-label" style="color:#e6edf3;font-weight:bold;"><input type="checkbox" id="cfgB_eqEnabled" onchange="window.updateDeckBSettingsFromDOMV359()"> Активировать EQ</label>' +
                            '<button type="button" onclick="window.openDeckBIsolatedEqModal(event)" style="font-size:11px;padding:4px 10px;border:1px solid #58a6ff;color:#58a6ff;background:#0d1117;border-radius:6px;font-weight:bold;">🎚️ Ползунки EQ Деки Б</button>' +
                        '</div>' +
                    '</div>' +
                '</details>' +

                '<!-- 11. УСИЛИТЕЛЬ (ОВЕРДРАЙВ) ДЕКИ Б -->' +
                '<details class="setting-group" open data-ab-sec="sec_boost" style="margin-bottom:24px;">' +
                    '<summary style="display:flex;align-items:center;justify-content:space-between;">' +
                        '<span>🚀 Усилитель (Овердрайв)</span>' +
                        '<span style="display:inline-flex;align-items:center;gap:4px;">' +
                            buildABSectionSwitchHTML('video', 'sec_boost') +
                            '<span class="jenny-help-badge" onclick="if(window.showHelpTopic) window.showHelpTopic(\'boost_group\', event)" style="display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11px;cursor:pointer;">❓</span>' +
                        '</span>' +
                    '</summary>' +
                    '<div class="group-content">' +
                        '<div class="setting-row" style="border:none;padding:5px 0;">' +
                            '<label class="toggle-label" style="color:#e6edf3;font-weight:bold;"><input type="checkbox" id="cfgB_boosterEnabled" onchange="window.updateDeckBSettingsFromDOMV359()"> Активировать Овердрайв</label>' +
                        '</div>' +
                        '<div class="setting-row" style="border:none;padding:4px 0;">' +
                            '<span style="color:#8b949e;font-size:13px;">Мощность (1-20):</span>' +
                            '<div style="display:flex;gap:4px;align-items:center;">' +
                                '<button type="button" class="io-btn" onclick="window.loadDeckBSingleV359(\'main\', \'boosterPower\', \'cfgB_boosterPower\')">📥</button>' +
                                '<input type="number" id="cfgB_boosterPower" oninput="window.updateDeckBSettingsFromDOMV359()" min="1" max="20" style="width:50px;">' +
                                '<button type="button" class="io-btn" onclick="window.saveDeckBSingleV359(\'main\', \'boosterPower\', \'cfgB_boosterPower\')">💾</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</details>' +
            '</div>';

        var refModal = document.getElementById('settingsModal');
        if (refModal && refModal.parentNode) {
            refModal.parentNode.insertBefore(sm, refModal.nextSibling);
        } else {
            document.body.appendChild(sm);
        }

        initGearboxInteractivityDeckBV359();
        return sm;
    }

    // Интерактивная 5-ступенчатая механическая РКПП специально для Деки Б (#gearPlateDeckB)
    function initGearboxInteractivityDeckBV359() {
        var plate = document.getElementById('gearPlateDeckB');
        var knob = document.getElementById('gearKnobDeckB');
        if (!plate || !knob || plate._deckBGearBound) return;
        plate._deckBGearBound = true;

        var COL_X = { left: 35, mid: 101, right: 167 };
        var NEUTRAL_Y = 111, TOP_Y = 44, BOT_Y = 178, END_STOP_TOLERANCE = 14;
        var isDragging = false, dragOffsetX = 0, dragOffsetY = 0;
        var currentX = 35, currentY = 44;

        window.syncGearboxUIDeckBV359 = function() {
            var cfg = getDeckBConfig();
            var gKey = cfg.gearKeyV66 || 'jbuf-lock';
            var specs = window.GEAR_SPECS_V66 || {
                'jbuf-lock':   { x: 35,  y: 44,  col: 'left',  pos: 'up',   mode: 'jbuf',    pitchLock: true,  knob: 'J▲', labelRu: '1-я: ⚡ J Buf 90° [PITCH LOCK]',   labelEn: '1st: ⚡ J Buf 90° [PITCH LOCK]' },
                'jbuf-shift':  { x: 35,  y: 178, col: 'left',  pos: 'down', mode: 'jbuf',    pitchLock: false, knob: 'J▼', labelRu: '2-я: ⚡ J Buf RAM [PITCH SHIFT]',   labelEn: '2nd: ⚡ J Buf RAM [PITCH SHIFT]' },
                'web-lock':    { x: 101, y: 44,  col: 'mid',   pos: 'up',   mode: 'webapi',  pitchLock: true,  knob: 'W▲', labelRu: '3-я: 🌐 Web API [PITCH LOCK]',      labelEn: '3rd: 🌐 Web API [PITCH LOCK]' },
                'web-shift':   { x: 101, y: 178, col: 'mid',   pos: 'down', mode: 'webapi',  pitchLock: false, knob: 'W▼', labelRu: '4-я: 🌐 Web API [PITCH SHIFT]',     labelEn: '4th: 🌐 Web API [PITCH SHIFT]' },
                'vinyl-shift': { x: 167, y: 178, col: 'right', pos: 'down', mode: 'vinyl',   pitchLock: false, knob: 'R💿', labelRu: 'Задняя R: 💿 ВИНИЛ [PITCH SHIFT]', labelEn: 'Rev R: 💿 VINYL [PITCH SHIFT]' },
                'neutral':     { x: 101, y: 111, col: 'mid',   pos: 'mid',  mode: 'neutral', pitchLock: true,  knob: 'N',  labelRu: 'Нейтраль (N): Холостой ход x1.00', labelEn: 'Neutral (N): Idle 1.00x Bypass' }
            };
            var spec = specs[gKey] || specs['jbuf-lock'];
            currentX = spec.x;
            currentY = spec.y;
            knob.style.left = currentX + 'px';
            knob.style.top = currentY + 'px';

            var txt = document.getElementById('gearKnobTextDeckB');
            if (txt) txt.innerText = spec.knob;

            var stTxt = document.getElementById('gearStatusTextDeckB');
            if (stTxt) {
                stTxt.innerText = '🕹️ ' + trB(spec.labelRu, spec.labelEn);
                stTxt.style.color = (gKey === 'neutral') ? '#e3b341' : (spec.mode === 'jbuf' ? '#3fb950' : (spec.mode === 'webapi' ? '#58a6ff' : '#d2a8ff'));
            }

            plate.querySelectorAll('.gearbox-letter').forEach(function(el) { el.classList.remove('active'); });
            plate.querySelectorAll('.gearbox-gate-enclosure').forEach(function(el) {
                el.classList.remove('active-jbuf', 'active-webapi', 'active-vinyl');
            });

            if (gKey === 'jbuf-lock') {
                document.getElementById('encB-jbuf')?.classList.add('active-jbuf');
                document.getElementById('letB-J')?.classList.add('active');
            } else if (gKey === 'jbuf-shift') {
                document.getElementById('encB-jbuf')?.classList.add('active-jbuf');
                ['letB-b', 'letB-u', 'letB-f'].forEach(function(id) { document.getElementById(id)?.classList.add('active'); });
            } else if (gKey === 'web-lock') {
                document.getElementById('encB-web')?.classList.add('active-webapi');
                ['letB-W', 'letB-e', 'letB-web-b'].forEach(function(id) { document.getElementById(id)?.classList.add('active'); });
            } else if (gKey === 'web-shift') {
                document.getElementById('encB-web')?.classList.add('active-webapi');
                ['letB-a', 'letB-p', 'letB-i'].forEach(function(id) { document.getElementById(id)?.classList.add('active'); });
            } else if (gKey === 'vinyl-shift') {
                document.getElementById('encB-vinyl')?.classList.add('active-vinyl');
                ['letB-v', 'letB-i-vin', 'letB-n', 'letB-i-vin2', 'letB-l'].forEach(function(id) { document.getElementById(id)?.classList.add('active'); });
            }
        };

        window.setDeckBGearboxStateV359 = function(gearKey, ev) {
            var specs = window.GEAR_SPECS_V66 || {};
            var spec = specs[gearKey] || { mode: 'jbuf', pitchLock: true, labelRu: gearKey, labelEn: gearKey };
            var cfg = getDeckBConfig();
            cfg.gearKeyV66 = gearKey;
            cfg.engineModeV62 = spec.mode;
            cfg.gearPitchLockV66 = spec.pitchLock;
            cfg.elasticHoseMode = (gearKey === 'jbuf-lock');
            cfg.studioMode = (gearKey === 'jbuf-lock' || gearKey === 'jbuf-shift' || gearKey === 'vinyl-shift');
            var stChk = document.getElementById('cfgB_studioMode');
            if (stChk) stChk.checked = Boolean(cfg.studioMode);
            window.syncGearboxUIDeckBV359();
            saveAndRebuildDeckB(true);
            if (typeof window.syncVideoRamEngineV211 === 'function') window.syncVideoRamEngineV211(false);
            if (typeof window.showToast === 'function' && ev) {
                window.showToast('🎬 РКПП Деки Б: ' + trB(spec.labelRu, spec.labelEn), ev);
            }
        };

        var clamp = function(v, a, b) { return Math.max(a, Math.min(b, v)); };
        var onStart = function(e) {
            var pt = e.touches ? e.touches[0] : e;
            var rect = knob.getBoundingClientRect();
            if (!pt || rect.width <= 0) return;
            var cx = rect.left + rect.width * 0.5, cy = rect.top + rect.height * 0.5;
            if (Math.hypot(pt.clientX - cx, pt.clientY - cy) > rect.width * 0.85) return;
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
            isDragging = true;
            knob.classList.add('dragging');
            dragOffsetX = pt.clientX - currentX;
            dragOffsetY = pt.clientY - currentY;
        };
        var onMove = function(e) {
            if (!isDragging) return;
            if (e.cancelable) e.preventDefault();
            var pt = e.touches ? e.touches[0] : e;
            var wantX = pt.clientX - dragOffsetX, wantY = pt.clientY - dragOffsetY;
            var inNeutral = Math.abs(currentY - NEUTRAL_Y) <= 18 && Math.abs(wantY - NEUTRAL_Y) <= 22;
            if (inNeutral) {
                currentX = clamp(wantX, COL_X.left, COL_X.right);
                if (Math.abs(currentX - COL_X.left) > 10 && Math.abs(currentX - COL_X.mid) > 10 && Math.abs(currentX - COL_X.right) > 10) {
                    currentY = NEUTRAL_Y;
                } else if (Math.abs(currentX - COL_X.right) <= 10) {
                    currentY = clamp(wantY, NEUTRAL_Y, BOT_Y);
                } else {
                    currentY = clamp(wantY, TOP_Y, BOT_Y);
                }
            } else {
                var nearCol = COL_X.left;
                if (Math.abs(currentX - COL_X.mid) < Math.abs(currentX - nearCol)) nearCol = COL_X.mid;
                if (Math.abs(currentX - COL_X.right) < Math.abs(currentX - nearCol)) nearCol = COL_X.right;
                currentX = nearCol;
                currentY = (nearCol === COL_X.right) ? clamp(wantY, NEUTRAL_Y, BOT_Y) : clamp(wantY, TOP_Y, BOT_Y);
            }
            knob.style.left = currentX + 'px';
            knob.style.top = currentY + 'px';
        };
        var onEnd = function(e) {
            if (!isDragging) return;
            isDragging = false;
            knob.classList.remove('dragging');
            var colKey = 'left';
            if (Math.abs(currentX - COL_X.mid) < Math.abs(currentX - COL_X.left)) colKey = 'mid';
            if (Math.abs(currentX - COL_X.right) < Math.abs(currentX - COL_X[colKey])) colKey = 'right';
            var chosen = 'neutral';
            if (colKey === 'left') {
                if (currentY <= TOP_Y + END_STOP_TOLERANCE) chosen = 'jbuf-lock';
                else if (currentY >= BOT_Y - END_STOP_TOLERANCE) chosen = 'jbuf-shift';
            } else if (colKey === 'mid') {
                if (currentY <= TOP_Y + END_STOP_TOLERANCE) chosen = 'web-lock';
                else if (currentY >= BOT_Y - END_STOP_TOLERANCE) chosen = 'web-shift';
            } else if (colKey === 'right') {
                if (currentY >= BOT_Y - END_STOP_TOLERANCE) chosen = 'vinyl-shift';
            }
            window.setDeckBGearboxStateV359(chosen, e);
        };

        plate.addEventListener('touchstart', onStart, { passive: false });
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onEnd);
        plate.addEventListener('mousedown', onStart);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);

        // Тап по шахте КПП Деки Б также мгновенно включает нужную передачу
        plate.addEventListener('click', function(e) {
            if (isDragging) return;
            var r = plate.getBoundingClientRect();
            var x = e.clientX - r.left, y = e.clientY - r.top;
            if (x < 92) {
                window.setDeckBGearboxStateV359(y < 128 ? 'jbuf-lock' : 'jbuf-shift', e);
            } else if (x < 160) {
                if (Math.abs(y - 128) < 22) window.setDeckBGearboxStateV359('neutral', e);
                else window.setDeckBGearboxStateV359(y < 128 ? 'web-lock' : 'web-shift', e);
            } else {
                window.setDeckBGearboxStateV359('vinyl-shift', e);
            }
        });
    }

    // Обработчики всех контролов #settingsModalDeckB
    window.onDeckBPhaseFocusChangeV359 = function(el, ev) {
        var cfg = getDeckBConfig();
        cfg.phaseFixEnabled = Boolean(el && el.checked);
        if (cfg.phaseFixEnabled) {
            cfg.firEnabled = true;
            cfg.limiterEnabled = true;
            cfg.multiBandEnabled = true;
        }
        window.syncDeckBIsolatedSettingsModalUI();
        saveAndRebuildDeckB(false);
        if (typeof window.showToast === 'function') {
            window.showToast(cfg.phaseFixEnabled ? '🔒 Блок управления Деки Б отключён! (Активен Фазовый фокус)' : '🔓 Ручной блок тонкой настройки Деки Б активен!', ev);
        }
    };

    window.onDeckBDspModChangeV359 = function(key, ev) {
        var cfg = getDeckBConfig();
        var chk = document.getElementById('cfgB_opt_' + key);
        var inp = document.getElementById('cfgB_val_' + key);
        if (chk && chk.checked && (key === 'msWidth' || key === 'crossfeed')) {
            var otherKey = (key === 'msWidth') ? 'crossfeed' : 'msWidth';
            var otherChk = document.getElementById('cfgB_opt_' + otherKey);
            if ((otherChk && otherChk.checked) || cfg['opt_' + otherKey]) {
                if (otherChk) otherChk.checked = false;
                cfg['opt_' + otherKey] = false;
                if (typeof window.showToast === 'function') {
                    window.showToast(key === 'msWidth' ? '🎭 Стерео Деки Б ВКЛ (🎧 Бинаурал откл.)' : '🎧 Бинаурал Деки Б ВКЛ (🎭 Стерео откл.)', ev);
                }
            }
        }
        if (chk) {
            cfg['opt_' + key] = Boolean(chk.checked);
            if (chk.checked) {
                if (key === 'cleanFir') cfg.firEnabled = true;
                if (['midPhase', 'midQ', 'deEsser'].indexOf(key) !== -1) {
                    cfg.limiterEnabled = true;
                    cfg.multiBandEnabled = true;
                }
            }
        }
        if (inp) {
            var p = parseFloat(String(inp.value).replace(',', '.'));
            if (!isNaN(p)) cfg['val_' + key] = p;
        }
        saveAndRebuildDeckB(false);
    };

    window.saveDeckBDspModRowV359 = function(key, btnEl, ev) {
        window.onDeckBDspModChangeV359(key, ev);
        saveAndRebuildDeckB(true);
        if (btnEl) {
            var old = btnEl.innerHTML;
            btnEl.innerHTML = '✅';
            setTimeout(function() { btnEl.innerHTML = old; }, 1000);
        }
    };

    window.loadDeckBDspModRowV359 = function(key, btnEl, ev) {
        var cfg = getDeckBConfig();
        try {
            var saved = JSON.parse(localStorage.getItem('ytm_video_deck_config_v131') || '{}');
            if (saved['opt_' + key] !== undefined) cfg['opt_' + key] = Boolean(saved['opt_' + key]);
            if (saved['val_' + key] !== undefined) cfg['val_' + key] = parseFloat(saved['val_' + key]);
        } catch (e) {}
        window.syncDeckBIsolatedSettingsModalUI();
        saveAndRebuildDeckB(true);
        if (btnEl) {
            var old = btnEl.innerHTML;
            btnEl.innerHTML = '✅';
            setTimeout(function() { btnEl.innerHTML = old; }, 1000);
        }
    };

    window.resetDeckBDspGroupV359 = function(keysList, msg, ev) {
        var cfg = getDeckBConfig();
        keysList.forEach(function(k) {
            cfg['opt_' + k] = DSP_DEFAULTS_B['opt_' + k];
            cfg['val_' + k] = DSP_DEFAULTS_B['val_' + k];
        });
        window.syncDeckBIsolatedSettingsModalUI();
        saveAndRebuildDeckB(false);
        if (typeof window.showToast === 'function') window.showToast(msg, ev);
    };

    window.onDeckBHoseTensionInputV359 = function(val) {
        var v = Math.max(20, Math.min(200, parseInt(val, 10) || 100));
        var cfg = getDeckBConfig();
        cfg.hoseTensionPct = v;
        var badge = document.getElementById('val_hoseTensionDeckB');
        if (badge) badge.innerText = String(v);
        saveAndRebuildDeckB(false);
        if (typeof window.syncVideoRamEngineV211 === 'function') window.syncVideoRamEngineV211(false);
    };

    window.updateDeckBSettingsFromDOMV359 = function() {
        var cfg = getDeckBConfig();
        var bools = {
            'cfgB_studioMode': 'studioMode',
            'cfgB_leftHandedMode': 'leftHandedMode',
            'cfgB_xNormalSpeed': 'xNormalSpeed',
            'cfgB_autoSaveBase': 'autoSaveBase',
            'cfgB_autoSaveScrub': 'autoSaveScrub',
            'cfgB_volSlider': 'volSlider',
            'cfgB_firEnabled': 'firEnabled',
            'cfgB_multiBandEnabled': 'multiBandEnabled',
            'cfgB_limiterEnabled': 'limiterEnabled',
            'cfgB_eqEnabled': 'eqEnabled',
            'cfgB_boosterEnabled': 'boosterEnabled'
        };
        Object.keys(bools).forEach(function(id) {
            var el = document.getElementById(id);
            if (el) cfg[bools[id]] = Boolean(el.checked);
        });

        var getNum = function(id, defVal) {
            var el = document.getElementById(id);
            if (!el) return defVal;
            var v = parseFloat(String(el.value).replace(',', '.'));
            return isFinite(v) ? v : defVal;
        };

        cfg.normalPlaybackSpeed = getNum('cfgB_normalPlaybackSpeed', cfg.normalPlaybackSpeed || 0.97);
        cfg.defaultScrubSpeed = getNum('cfgB_defaultScrubSpeed', cfg.defaultScrubSpeed || 1.1);
        cfg.boosterPower = Math.max(1, Math.min(20, Math.round(getNum('cfgB_boosterPower', cfg.boosterPower || 5))));

        cfg.firSettings = cfg.firSettings || { gain: 1.5, decay: 1.28 };
        cfg.firSettings.gain = getNum('cfgB_fir_gain', cfg.firSettings.gain);
        cfg.firSettings.decay = getNum('cfgB_fir_decay', cfg.firSettings.decay);

        cfg.multiBandSettings = cfg.multiBandSettings || { low: 160, high: 2528 };
        cfg.multiBandSettings.low = getNum('cfgB_mb_low', cfg.multiBandSettings.low);
        cfg.multiBandSettings.high = getNum('cfgB_mb_high', cfg.multiBandSettings.high);

        cfg.limiterSettings = cfg.limiterSettings || { threshold: -18, knee: 128, ratio: 4, attack: 192, release: 352 };
        cfg.limiterSettings.threshold = getNum('cfgB_lim_threshold', cfg.limiterSettings.threshold);
        cfg.limiterSettings.knee = getNum('cfgB_lim_knee', cfg.limiterSettings.knee);
        cfg.limiterSettings.ratio = getNum('cfgB_lim_ratio', cfg.limiterSettings.ratio);
        cfg.limiterSettings.attack = getNum('cfgB_lim_attack', cfg.limiterSettings.attack);
        cfg.limiterSettings.release = getNum('cfgB_lim_release', cfg.limiterSettings.release);

        var volWrapB = document.getElementById('volUIWrapperDeckBV216');
        if (volWrapB) volWrapB.style.display = (cfg.volSlider !== false) ? 'inline-flex' : 'none';

        saveAndRebuildDeckB(false);
    };

    window.toggleDeckBAutoSaveV359 = function(source, ev) {
        var elBase = document.getElementById('cfgB_autoSaveBase');
        var elScrub = document.getElementById('cfgB_autoSaveScrub');
        var warn = false;
        if (source === 'base' && elBase && elBase.checked && elScrub && elScrub.checked) {
            elScrub.checked = false;
            warn = true;
        } else if (source === 'scrub' && elScrub && elScrub.checked && elBase && elBase.checked) {
            elBase.checked = false;
            warn = true;
        }
        if (warn && typeof window.showToast === 'function') {
            window.showToast('Что-то одно из двух! 😅', ev);
        }
        window.updateDeckBSettingsFromDOMV359();
    };

    window.saveZonesToConfigDeckBV359 = function() {
        var cfg = getDeckBConfig();
        cfg.scrubZones = cfg.scrubZones || [];
        for (var i = 1; i <= 6; i++) {
            var enEl = document.getElementById('cfgB_z' + i + '_en');
            var valEl = document.getElementById('cfgB_z' + i + '_val');
            if (enEl && valEl) {
                cfg.scrubZones[i - 1] = {
                    en: Boolean(enEl.checked),
                    val: parseFloat(String(valEl.value).replace(',', '.')) || 1.0
                };
            }
        }
        saveAndRebuildDeckB(false);
    };

    window.checkZonesDeckBV359 = function(idx) {
        var activeCnt = 0;
        for (var i = 1; i <= 6; i++) {
            var el = document.getElementById('cfgB_z' + i + '_en');
            if (el && el.checked) activeCnt++;
        }
        if (activeCnt === 0) {
            var t = document.getElementById('cfgB_z' + idx + '_en');
            if (t) t.checked = true;
        }
        window.saveZonesToConfigDeckBV359();
    };

    window.resetDeckBScrubZonesV359 = function() {
        var defs = [1.1, 1, 1.05, 0.95, 1.5, 0.9];
        for (var i = 1; i <= 6; i++) {
            var enEl = document.getElementById('cfgB_z' + i + '_en');
            var valEl = document.getElementById('cfgB_z' + i + '_val');
            if (enEl) enEl.checked = true;
            if (valEl) valEl.value = String(defs[i - 1]);
        }
        window.saveZonesToConfigDeckBV359();
    };

    window.resetDeckBFIRV359 = function() {
        var g = document.getElementById('cfgB_fir_gain');
        var d = document.getElementById('cfgB_fir_decay');
        if (g) g.value = '1.5';
        if (d) d.value = '1.28';
        window.updateDeckBSettingsFromDOMV359();
    };

    window.resetDeckBMultiBandV359 = function() {
        var l = document.getElementById('cfgB_mb_low');
        var h = document.getElementById('cfgB_mb_high');
        if (l) l.value = '160';
        if (h) h.value = '2528';
        window.updateDeckBSettingsFromDOMV359();
    };

    window.resetDeckBLimiterV359 = function() {
        var map = {
            'cfgB_lim_threshold': '-18',
            'cfgB_lim_knee': '128',
            'cfgB_lim_ratio': '4',
            'cfgB_lim_attack': '192',
            'cfgB_lim_release': '352'
        };
        Object.keys(map).forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.value = map[id];
        });
        window.updateDeckBSettingsFromDOMV359();
    };

    window.saveDeckBSingleV359 = function(cat, key, elId) {
        window.updateDeckBSettingsFromDOMV359();
        saveAndRebuildDeckB(true);
        var el = document.getElementById(elId);
        if (el && el.nextElementSibling) {
            var btn = el.nextElementSibling;
            var old = btn.innerHTML;
            btn.innerHTML = '✅';
            setTimeout(function() { btn.innerHTML = old; }, 1000);
        }
    };

    window.loadDeckBSingleV359 = function(cat, key, elId) {
        try {
            var saved = JSON.parse(localStorage.getItem('ytm_video_deck_config_v131') || '{}');
            var val = (cat === 'main') ? saved[key] : (saved[cat] && saved[cat][key]);
            var el = document.getElementById(elId);
            if (el && val !== undefined) {
                el.value = String(val);
                window.updateDeckBSettingsFromDOMV359();
                if (el.previousElementSibling) {
                    var btn = el.previousElementSibling;
                    var old = btn.innerHTML;
                    btn.innerHTML = '✅';
                    setTimeout(function() { btn.innerHTML = old; }, 1000);
                }
            }
        } catch (e) {}
    };

    window.saveDeckBConfigToDiskV359 = function(ev) {
        window.updateDeckBSettingsFromDOMV359();
        saveAndRebuildDeckB(true);
        try {
            localStorage.setItem('ytm_video_deck_config_disk_backup_v359', JSON.stringify(getDeckBConfig()));
        } catch (e) {}
        if (typeof window.showToast === 'function') window.showToast('💾 Все настройки Деки Б (Видео) сохранены!', ev);
    };

    window.loadDeckBConfigFromDiskV359 = function(ev) {
        try {
            var raw = localStorage.getItem('ytm_video_deck_config_disk_backup_v359') || localStorage.getItem('ytm_video_deck_config_v131');
            if (raw) {
                var parsed = JSON.parse(raw);
                Object.assign(getDeckBConfig(), parsed);
                window.syncDeckBIsolatedSettingsModalUI();
                saveAndRebuildDeckB(true);
                if (typeof window.showToast === 'function') window.showToast('📥 Настройки Деки Б (Видео) загружены!', ev);
            }
        } catch (e) {}
    };

    window.syncDeckBIsolatedSettingsModalUI = function() {
        var sm = document.getElementById('settingsModalDeckB');
        if (!sm) return;
        var banner = document.getElementById('deckSwitchBarSettingsDeckB');
        if (banner) banner.innerHTML = buildTopDeckSwitchBannerHTML('video', 'settings');
        window.refreshFourBuffersHudV359();

        var cfg = getDeckBConfig();
        var setChk = function(id, val) { var e = document.getElementById(id); if (e) e.checked = Boolean(val); };
        var setVal = function(id, val) { var e = document.getElementById(id); if (e && document.activeElement !== e) e.value = String(val); };

        setChk('cfgB_studioMode', cfg.studioMode !== false);
        setChk('cfgB_phaseFix', cfg.phaseFixEnabled);
        setChk('cfgB_leftHandedMode', cfg.leftHandedMode);
        setChk('cfgB_xNormalSpeed', cfg.xNormalSpeed);
        setVal('cfgB_normalPlaybackSpeed', cfg.normalPlaybackSpeed !== undefined ? cfg.normalPlaybackSpeed : 0.97);
        setChk('cfgB_autoSaveBase', cfg.autoSaveBase);
        setVal('cfgB_defaultScrubSpeed', cfg.defaultScrubSpeed !== undefined ? cfg.defaultScrubSpeed : 1.1);
        setChk('cfgB_autoSaveScrub', cfg.autoSaveScrub !== false);
        setChk('cfgB_volSlider', cfg.volSlider !== false);

        setVal('rng_hoseTensionDeckB', cfg.hoseTensionPct !== undefined ? cfg.hoseTensionPct : 100);
        var tensBadge = document.getElementById('val_hoseTensionDeckB');
        if (tensBadge) tensBadge.innerText = String(cfg.hoseTensionPct !== undefined ? cfg.hoseTensionPct : 100);

        ALL_MOD_KEYS_B.forEach(function(k) {
            setChk('cfgB_opt_' + k, cfg['opt_' + k]);
            setVal('cfgB_val_' + k, cfg['val_' + k] !== undefined ? cfg['val_' + k] : DSP_DEFAULTS_B['val_' + k]);
        });

        var wrapB = document.getElementById('dspModBodyWrapDeckB');
        var shieldB = document.getElementById('dspModLockShieldDeckB');
        if (wrapB && shieldB) {
            wrapB.style.opacity = cfg.phaseFixEnabled ? '0.32' : '1';
            shieldB.style.display = cfg.phaseFixEnabled ? 'block' : 'none';
        }

        var defs = [1.1, 1, 1.05, 0.95, 1.5, 0.9];
        var zs = (Array.isArray(cfg.scrubZones) && cfg.scrubZones.length === 6) ? cfg.scrubZones : defs.map(function(v) { return { val: v, en: true }; });
        for (var i = 0; i < 6; i++) {
            var z = zs[i] || { val: defs[i], en: true };
            setChk('cfgB_z' + (i + 1) + '_en', z.en !== false);
            setVal('cfgB_z' + (i + 1) + '_val', z.val);
        }

        setChk('cfgB_firEnabled', cfg.firEnabled);
        if (cfg.firSettings) {
            setVal('cfgB_fir_gain', cfg.firSettings.gain !== undefined ? cfg.firSettings.gain : 1.5);
            setVal('cfgB_fir_decay', cfg.firSettings.decay !== undefined ? cfg.firSettings.decay : 1.28);
        }
        setChk('cfgB_multiBandEnabled', cfg.multiBandEnabled);
        if (cfg.multiBandSettings) {
            setVal('cfgB_mb_low', cfg.multiBandSettings.low !== undefined ? cfg.multiBandSettings.low : 160);
            setVal('cfgB_mb_high', cfg.multiBandSettings.high !== undefined ? cfg.multiBandSettings.high : 2528);
        }
        setChk('cfgB_limiterEnabled', cfg.limiterEnabled);
        if (cfg.limiterSettings) {
            setVal('cfgB_lim_threshold', cfg.limiterSettings.threshold !== undefined ? cfg.limiterSettings.threshold : -18);
            setVal('cfgB_lim_knee', cfg.limiterSettings.knee !== undefined ? cfg.limiterSettings.knee : 128);
            setVal('cfgB_lim_ratio', cfg.limiterSettings.ratio !== undefined ? cfg.limiterSettings.ratio : 4);
            setVal('cfgB_lim_attack', cfg.limiterSettings.attack !== undefined ? cfg.limiterSettings.attack : 192);
            setVal('cfgB_lim_release', cfg.limiterSettings.release !== undefined ? cfg.limiterSettings.release : 352);
        }
        setChk('cfgB_eqEnabled', cfg.eqEnabled !== false);
        setChk('cfgB_boosterEnabled', cfg.boosterEnabled);
        setVal('cfgB_boosterPower', cfg.boosterPower !== undefined ? cfg.boosterPower : 5);

        if (typeof window.syncGearboxUIDeckBV359 === 'function') window.syncGearboxUIDeckBV359();
        window.updateDeckBAutoCeilMonitorUI();
    };

    // ========================================================================
    // 3. ПОЛНАЯ 1:1 КОПИЯ АНАЛИЗАТОРА СПЕКТРА И ОСЦИЛЛОГРАФА 90° ШВОВ (#specModalDeckB)
    // ========================================================================
    var specStateDeckB = {
        sourceMode: 'post',
        frozen: false,
        peakHold: new Float32Array(64),
        peakDecay: 0.45,
        rafId: null,
        scopeWindowMs: 6,
        scopeFrozen: false
    };

    function ensureDeckBSpecModalDOM() {
        var sm = document.getElementById('specModalDeckB');
        if (sm) return sm;

        sm = document.createElement('div');
        sm.id = 'specModalDeckB';
        sm.className = 'modal-overlay';
        sm.innerHTML =
            '<div class="container" id="specModalDeckBContainer">' +
                '<div id="deckSwitchBarSpecDeckB">' + buildTopDeckSwitchBannerHTML('video', 'spec') + '</div>' +
                '<div class="jenny-uniform-card" style="background:var(--bg-setting-box);border:1px solid #3b82f6;border-radius:10px;padding:10px;margin-bottom:10px;">' +
                    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px;">' +
                        '<span style="font-size:12.5px;font-weight:bold;color:#58a6ff;">📊 FFT Анализатор Спектра Деки Б (20 Гц – 20 кГц)</span>' +
                        '<div style="display:flex;gap:4px;align-items:center;">' +
                            '<button type="button" id="btnSpecSourceDeckB" onclick="window.toggleSpecSourceModeDeckBV359()" style="font-size:10px;padding:3px 7px;border-radius:5px;border:1px solid #3fb950;background:#161b22;color:#3fb950;">Пост-DSP (Мастер)</button>' +
                            '<button type="button" onclick="window.resetSpecPeaksDeckBV359()" style="font-size:10px;padding:3px 7px;border-radius:5px;border:1px solid #30363d;background:#161b22;color:#e3b341;">Сброс пиков</button>' +
                            '<button type="button" id="btnSpecFreezeDeckB" onclick="window.toggleSpecFreezeDeckBV359(this)" style="font-size:10px;padding:3px 7px;border-radius:5px;border:1px solid #30363d;background:#161b22;color:#c9d1d9;">❄️ Стоп</button>' +
                        '</div>' +
                    '</div>' +
                    '<canvas id="jennyFftCanvasDeckB" width="360" height="145" style="width:100%;height:145px;display:block;background:#05070a;border:1px solid #21262d;border-radius:6px;"></canvas>' +
                    '<div style="display:flex;justify-content:space-between;font-size:10.5px;font-family:monospace;color:#8b949e;margin-top:6px;padding:0 2px;">' +
                        '<span id="fftSubTextDeckB" style="color:#a371f7;">🔊 Бас (20-200Гц): -∞ dB</span>' +
                        '<span id="fftMidTextDeckB" style="color:#3fb950;">🎤 СЧ (200-4кГц): -∞ dB</span>' +
                        '<span id="fftHighTextDeckB" style="color:#58a6ff;">✨ ВЧ (4-20кГц): -∞ dB</span>' +
                    '</div>' +
                '</div>' +

                '<!-- ЖИВОЙ ОСЦИЛЛОГРАФ 90° ВОЛНЫ И ШВОВ ДЕКИ Б -->' +
                '<div class="jenny-uniform-card" style="background:var(--bg-setting-box);border:1px solid #3b82f6;border-radius:10px;padding:10px;margin-bottom:20px;">' +
                    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:4px;">' +
                        '<span style="font-size:11.5px;color:#60a5fa;font-weight:bold;">📊 Реальная Амплитуда Деки Б (Серый=Ориг, Синий=Шланг 90°)</span>' +
                        '<div style="display:flex;gap:4px;align-items:center;">' +
                            '<button type="button" onclick="window.setScopeZoomDeckBV359(2)" style="font-size:10px;padding:2px 6px;border-radius:4px;border:1px solid #30363d;background:#161b22;color:#fff;">2мс</button>' +
                            '<button type="button" onclick="window.setScopeZoomDeckBV359(6)" style="font-size:10px;padding:2px 6px;border-radius:4px;border:1px solid #30363d;background:#1f6feb;color:#fff;">6мс</button>' +
                            '<button type="button" onclick="window.setScopeZoomDeckBV359(15)" style="font-size:10px;padding:2px 6px;border-radius:4px;border:1px solid #30363d;background:#161b22;color:#fff;">15мс</button>' +
                            '<button type="button" onclick="window.setScopeZoomDeckBV359(40)" style="font-size:10px;padding:2px 6px;border-radius:4px;border:1px solid #30363d;background:#161b22;color:#fff;">40мс</button>' +
                            '<button type="button" onclick="window.toggleScopeFreezeDeckBV359(this)" style="font-size:10px;padding:2px 7px;border-radius:4px;border:1px solid #30363d;background:#161b22;color:#c9d1d9;">❄️ Стоп-кадр</button>' +
                        '</div>' +
                    '</div>' +
                    '<canvas id="hoseWaveScopeCanvasDeckB" width="340" height="120" style="width:100%;height:120px;display:block;background:#05070a;border:1px solid #21262d;border-radius:4px;"></canvas>' +
                    '<div id="hoseScopeStatsDeckB" style="font-size:10px;font-family:monospace;color:#58a6ff;margin-top:5px;text-align:center;">Peak: ±0.000 (-∞ dB) | RMS: 0.000 | Буферы #3/#4</div>' +
                '</div>' +
            '</div>';

        var refModal = document.getElementById('specModal') || document.getElementById('eqModal') || document.getElementById('settingsModal');
        if (refModal && refModal.parentNode) {
            refModal.parentNode.insertBefore(sm, refModal.nextSibling);
        } else {
            document.body.appendChild(sm);
        }
        return sm;
    }

    window.toggleSpecSourceModeDeckBV359 = function() {
        specStateDeckB.sourceMode = (specStateDeckB.sourceMode === 'post') ? 'pre' : 'post';
        var btn = document.getElementById('btnSpecSourceDeckB');
        if (btn) {
            btn.innerText = (specStateDeckB.sourceMode === 'post') ? 'Пост-DSP (Мастер)' : 'До-DSP (Вход)';
            btn.style.borderColor = (specStateDeckB.sourceMode === 'post') ? '#3fb950' : '#58a6ff';
            btn.style.color = (specStateDeckB.sourceMode === 'post') ? '#3fb950' : '#58a6ff';
        }
    };

    window.resetSpecPeaksDeckBV359 = function() {
        specStateDeckB.peakHold.fill(0);
    };

    window.toggleSpecFreezeDeckBV359 = function(btn) {
        specStateDeckB.frozen = !specStateDeckB.frozen;
        if (btn) btn.innerText = specStateDeckB.frozen ? '▶️ Пуск' : '❄️ Стоп';
    };

    window.setScopeZoomDeckBV359 = function(ms) {
        specStateDeckB.scopeWindowMs = ms;
    };

    window.toggleScopeFreezeDeckBV359 = function(btn) {
        specStateDeckB.scopeFrozen = !specStateDeckB.scopeFrozen;
        if (btn) btn.innerText = specStateDeckB.scopeFrozen ? '▶️ Пуск' : '❄️ Стоп-кадр';
    };

    function startDeckBSpectrumAndScopeLoop() {
        if (specStateDeckB.rafId) cancelAnimationFrame(specStateDeckB.rafId);
        var freqData = new Uint8Array(1024);
        var timeData = new Uint8Array(1024);
        var numBars = 64;

        var draw = function() {
            var sm = document.getElementById('specModalDeckB');
            if (!sm || !sm.classList.contains('open')) {
                specStateDeckB.rafId = null;
                return;
            }
            var vd = window.videoDeckV131;
            var an = vd ? ((specStateDeckB.sourceMode === 'pre') ? vd.analyserPre : vd.analyserPost) : null;

            // 1) FFT Спектр Деки Б
            var cv = document.getElementById('jennyFftCanvasDeckB');
            if (cv && !specStateDeckB.frozen) {
                var ctx = cv.getContext('2d');
                var W = cv.width, H = cv.height, plotH = H - 18, plotX = 28, plotW = W - plotX - 4;
                ctx.fillStyle = '#05070a';
                ctx.fillRect(0, 0, W, H);
                ctx.strokeStyle = 'rgba(139,148,158,0.14)';
                ctx.fillStyle = '#6e7681';
                ctx.font = '9px monospace';
                [{ db: ' 0dB', y: 8 }, { db: '-20', y: Math.round(plotH * 0.33) }, { db: '-45', y: Math.round(plotH * 0.66) }, { db: '-80', y: plotH }].forEach(function(g) {
                    ctx.beginPath(); ctx.moveTo(plotX, g.y); ctx.lineTo(W - 2, g.y); ctx.stroke();
                    ctx.fillText(g.db, 2, g.y + 3);
                });
                [{ lbl: '60', f: 60 }, { lbl: '230', f: 230 }, { lbl: '910', f: 910 }, { lbl: '3.6k', f: 3600 }, { lbl: '14k', f: 14000 }].forEach(function(m) {
                    var normX = Math.log10(m.f / 20) / Math.log10(20000 / 20);
                    var x = plotX + Math.round(normX * plotW);
                    ctx.strokeStyle = 'rgba(88,166,255,0.12)';
                    ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x, plotH); ctx.stroke();
                    ctx.fillStyle = '#8b949e';
                    ctx.fillText(m.lbl, x - 10, H - 4);
                });
                if (an) {
                    an.getByteFrequencyData(freqData);
                    var sr = (vd && vd.ctx && vd.ctx.sampleRate) ? vd.ctx.sampleRate : 48000;
                    var binCount = an.frequencyBinCount;
                    var subSum = 0, subCnt = 0, midSum = 0, midCnt = 0, highSum = 0, highCnt = 0;
                    var barW = Math.max(2, (plotW / numBars) - 1.2);
                    for (var i = 0; i < numBars; i++) {
                        var fLow = 20 * Math.pow(1000, i / numBars);
                        var fHigh = 20 * Math.pow(1000, (i + 1) / numBars);
                        var b0 = Math.max(1, Math.floor((fLow * binCount * 2) / sr));
                        var b1 = Math.min(binCount - 1, Math.ceil((fHigh * binCount * 2) / sr));
                        if (b1 < b0) b1 = b0;
                        var maxVal = 0;
                        for (var b = b0; b <= b1; b++) {
                            if (freqData[b] > maxVal) maxVal = freqData[b];
                        }
                        var fCenter = 0.5 * (fLow + fHigh);
                        if (fCenter <= 200) { subSum += maxVal; subCnt++; }
                        else if (fCenter <= 4000) { midSum += maxVal; midCnt++; }
                        else { highSum += maxVal; highCnt++; }
                        if (maxVal >= specStateDeckB.peakHold[i]) specStateDeckB.peakHold[i] = maxVal;
                        else specStateDeckB.peakHold[i] = Math.max(0, specStateDeckB.peakHold[i] - specStateDeckB.peakDecay);
                        var hBar = Math.round((maxVal / 255) * (plotH - 6));
                        var hPeak = Math.round((specStateDeckB.peakHold[i] / 255) * (plotH - 6));
                        var xPos = plotX + i * (plotW / numBars);
                        ctx.fillStyle = (fCenter <= 220) ? '#3b82f6' : ((fCenter <= 3800) ? '#3fb950' : '#93c5fd');
                        if (hBar > 0) ctx.fillRect(xPos, plotH - hBar, barW, hBar);
                        if (hPeak > 1) {
                            ctx.fillStyle = '#e3b341';
                            ctx.fillRect(xPos, plotH - hPeak - 2, barW, 2);
                        }
                    }
                    var toDb = function(avg) { return avg < 1 ? '-∞ dB' : (-84 + (avg / 255) * 80).toFixed(1) + ' dB'; };
                    var sEl = document.getElementById('fftSubTextDeckB');
                    var mEl = document.getElementById('fftMidTextDeckB');
                    var hEl = document.getElementById('fftHighTextDeckB');
                    if (sEl) sEl.innerText = '🔊 Бас: ' + toDb(subSum / Math.max(1, subCnt));
                    if (mEl) mEl.innerText = '🎤 СЧ: ' + toDb(midSum / Math.max(1, midCnt));
                    if (hEl) hEl.innerText = '✨ ВЧ: ' + toDb(highSum / Math.max(1, highCnt));
                }
            }

            // 2) Живой осциллограф волны Деки Б
            var wCv = document.getElementById('hoseWaveScopeCanvasDeckB');
            if (wCv && !specStateDeckB.scopeFrozen) {
                var wCtx = wCv.getContext('2d');
                var wW = wCv.width, wH = wCv.height;
                wCtx.fillStyle = '#05070a';
                wCtx.fillRect(0, 0, wW, wH);
                wCtx.strokeStyle = 'rgba(88,166,255,0.18)';
                wCtx.beginPath(); wCtx.moveTo(0, wH / 2); wCtx.lineTo(wW, wH / 2); wCtx.stroke();
                if (an) {
                    an.getByteTimeDomainData(timeData);
                    wCtx.strokeStyle = '#60a5fa';
                    wCtx.lineWidth = 1.6;
                    wCtx.beginPath();
                    var peak = 0, sq = 0;
                    var nPts = Math.min(timeData.length, Math.max(64, specStateDeckB.scopeWindowMs * 24));
                    for (var k = 0; k < nPts; k++) {
                        var norm = (timeData[k] - 128) / 128.0;
                        var absN = Math.abs(norm);
                        if (absN > peak) peak = absN;
                        sq += norm * norm;
                        var px = (k / (nPts - 1)) * wW;
                        var py = (wH * 0.5) - norm * (wH * 0.44);
                        if (k === 0) wCtx.moveTo(px, py);
                        else wCtx.lineTo(px, py);
                    }
                    wCtx.stroke();
                    var rms = Math.sqrt(sq / Math.max(1, nPts));
                    var stEl = document.getElementById('hoseScopeStatsDeckB');
                    var hc = (vd && vd.hoseCache) || {};
                    if (stEl) {
                        stEl.innerText = 'Peak: ±' + peak.toFixed(3) + ' | RMS: ' + rms.toFixed(3) +
                            ' | Швов 90°: ' + ((hc.seamPointsOut && hc.seamPointsOut.length) || 0) +
                            ' | Сборка: ' + (hc.lastBuildMs || 0) + ' мс';
                    }
                }
            }

            specStateDeckB.rafId = requestAnimationFrame(draw);
        };
        specStateDeckB.rafId = requestAnimationFrame(draw);
    }

    // ========================================================================
    // 4. ВСТРАИВАНИЕ ПЕРЕКЛЮЧАТЕЛЕЙ [🎵 А | 🎬 Б] И ТАБЛО 4 БУФЕРОВ В КОПИЮ ДЕКИ А
    //    (БЕЗ МОДИФИКАЦИИ ИСХОДНЫХ ФАЙЛОВ ДЕКИ А!)
    // ========================================================================
    window.decorateDeckAModalsWithABSwitchersV359 = function() {
        var smA = document.getElementById('settingsModal');
        if (smA) {
            var contA = smA.querySelector('.container') || smA;
            var bannerA = document.getElementById('deckSwitchBarSettingsV131');
            if (!bannerA) {
                bannerA = document.createElement('div');
                bannerA.id = 'deckSwitchBarSettingsV131';
                contA.insertBefore(bannerA, contA.firstChild);
            }
            bannerA.innerHTML = buildTopDeckSwitchBannerHTML('music', 'settings');

            var bufHudA = document.getElementById('jennyFourBuffersHudBarA');
            if (!bufHudA) {
                bufHudA = document.createElement('div');
                bufHudA.id = 'jennyFourBuffersHudBarA';
                bannerA.insertAdjacentElement('afterend', bufHudA);
            }
            bufHudA.innerHTML = window.renderFourBuffersStatusHTMLV359();

            // Ставим [🎵 А | 🎬 Б] в каждую карточку и спойлер настроек Деки А (через badge.parentNode, без NotFoundError!)
            var safeInsertBeforeBadgeV362 = function(containerEl, newEl) {
                if (!containerEl || !newEl) return;
                try {
                    var badge = containerEl.querySelector('.jenny-help-badge');
                    if (badge && badge.parentNode) {
                        badge.parentNode.insertBefore(newEl, badge);
                    } else {
                        containerEl.appendChild(newEl);
                    }
                } catch (e) {
                    try { containerEl.appendChild(newEl); } catch (e2) {}
                }
            };
            var attachABToRow = function(inputId, secKey) {
                var inp = document.getElementById(inputId);
                var row = inp ? inp.closest('.setting-row') : null;
                if (!row || row.querySelector('.jenny-ab-sec-switch-v359')) return;
                row.setAttribute('data-ab-sec', secKey);
                var holder = document.createElement('span');
                holder.innerHTML = buildABSectionSwitchHTML('music', secKey);
                safeInsertBeforeBadgeV362(row, holder.firstElementChild);
            };
            attachABToRow('cfg_studioMode', 'sec_studio_ram');
            attachABToRow('cfg_phaseFix', 'sec_phase_focus');
            attachABToRow('cfg_volSlider', 'sec_vol');

            smA.querySelectorAll('details.setting-group > summary').forEach(function(sum) {
                if (sum.querySelector('.jenny-ab-sec-switch-v359')) return;
                var txt = sum.innerText || '';
                var secKey = 'sec_top';
                if (txt.indexOf('Тонкая') !== -1 || txt.indexOf('Fine-Tuning') !== -1) secKey = 'sec_dsp_mod';
                else if (txt.indexOf('PRO') !== -1) secKey = 'sec_dsp_pro';
                else if (txt.indexOf('Скраббинг') !== -1 || txt.indexOf('Scrubbing') !== -1) secKey = 'sec_scrub';
                else if (txt.indexOf('FIR') !== -1) secKey = 'sec_fir';
                else if (txt.indexOf('кроссовер') !== -1 || txt.indexOf('Crossover') !== -1) secKey = 'sec_mb';
                else if (txt.indexOf('Лимитер') !== -1 || txt.indexOf('Limiter') !== -1) secKey = 'sec_lim';
                else if (txt.indexOf('Эквалайзер') !== -1 || txt.indexOf('Equalizer') !== -1) secKey = 'sec_eq';
                else if (txt.indexOf('Усилитель') !== -1 || txt.indexOf('Booster') !== -1) secKey = 'sec_boost';
                else return;
                if (sum.parentElement) sum.parentElement.setAttribute('data-ab-sec', secKey);
                var holder = document.createElement('span');
                holder.innerHTML = buildABSectionSwitchHTML('music', secKey);
                safeInsertBeforeBadgeV362(sum, holder.firstElementChild);
            });
        }

        var eqA = document.getElementById('eqModal');
        if (eqA) {
            var eqContA = eqA.querySelector('.container') || eqA;
            var bannerEqA = document.getElementById('deckSwitchBarEqV131');
            if (!bannerEqA) {
                bannerEqA = document.createElement('div');
                bannerEqA.id = 'deckSwitchBarEqV131';
                eqContA.insertBefore(bannerEqA, eqContA.firstChild);
            }
            bannerEqA.innerHTML = buildTopDeckSwitchBannerHTML('music', 'eq');

            [60, 230, 910, 3600, 14000].forEach(function(f) {
                var sl = document.getElementById('eq_' + f);
                var hdr = sl ? sl.previousElementSibling : null;
                if (hdr && hdr.classList.contains('eq-band-hdr') && !hdr.querySelector('.jenny-ab-sec-switch-v359')) {
                    var holder = document.createElement('span');
                    holder.innerHTML = buildABSectionSwitchHTML('music', 'eq_' + f);
                    try {
                        var badge = hdr.querySelector('.jenny-help-badge');
                        if (badge && badge.parentNode) badge.parentNode.insertBefore(holder.firstElementChild, badge);
                        else hdr.appendChild(holder.firstElementChild);
                    } catch (e) {
                        try { hdr.appendChild(holder.firstElementChild); } catch (e2) {}
                    }
                }
            });
        }

        var spA = document.getElementById('specModal');
        if (spA) {
            var spContA = spA.querySelector('.container') || spA;
            var bannerSpA = document.getElementById('deckSwitchBarSpecV131');
            if (!bannerSpA) {
                bannerSpA = document.createElement('div');
                bannerSpA.id = 'deckSwitchBarSpecV131';
                spContA.insertBefore(bannerSpA, spContA.firstChild);
            }
            bannerSpA.innerHTML = buildTopDeckSwitchBannerHTML('music', 'spec');
        }
    };

    // ========================================================================
    // 5. ПЕРЕКЛЮЧЕНИЕ МЕЖДУ КОПИЯМИ МОДАЛОК ДЕКИ А И ДЕКИ Б С СОХРАНЕНИЕМ СЕКЦИИ
    // ========================================================================
    window.closeDeckBIsolatedModals = function() {
        ['settingsModalDeckB', 'eqModalDeckB', 'specModalDeckB'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.classList.remove('open');
        });
        if (specStateDeckB.rafId) {
            cancelAnimationFrame(specStateDeckB.rafId);
            specStateDeckB.rafId = null;
        }
        if (typeof window.updateTopSearchOrMonitorBar === 'function') {
            window.updateTopSearchOrMonitorBar();
        }
    };

    function closeAllDeckAModals() {
        ['settingsModal', 'favModal', 'eqModal', 'specModal', 'themeModal'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.classList.remove('open');
        });
    }

    function syncDetailsOpenStateBetweenModalsV360(fromModal, toModal, forceOpenSectionKey) {
        if (!fromModal || !toModal) return;
        fromModal.querySelectorAll('details[data-ab-sec]').forEach(function(detFrom) {
            var k = detFrom.getAttribute('data-ab-sec');
            var detTo = k ? toModal.querySelector('details[data-ab-sec="' + k + '"]') : null;
            if (detTo) detTo.open = detFrom.open;
        });
        if (forceOpenSectionKey && forceOpenSectionKey !== 'sec_top') {
            var targetDet = toModal.querySelector('details[data-ab-sec="' + forceOpenSectionKey + '"]');
            if (targetDet) targetDet.open = true;
        }
    }

    function notifyModalLayoutSyncV360() {
        if (typeof window.syncHeaderHeightWithModalsV71 === 'function') window.syncHeaderHeightWithModalsV71();
        if (typeof window.syncEdgeToEdgeLayoutBoundsV242 === 'function') window.syncEdgeToEdgeLayoutBoundsV242();
        if (typeof window.updateTopSearchOrMonitorBar === 'function') window.updateTopSearchOrMonitorBar();
    }

    window.syncDeckBBannersOnlyV360 = function() {
        var bEq = document.getElementById('deckSwitchBarEqDeckB');
        if (bEq) bEq.innerHTML = buildTopDeckSwitchBannerHTML('video', 'eq');
        var bSet = document.getElementById('deckSwitchBarSettingsDeckB');
        if (bSet) bSet.innerHTML = buildTopDeckSwitchBannerHTML('video', 'settings');
        var bSp = document.getElementById('deckSwitchBarSpecDeckB');
        if (bSp) bSp.innerHTML = buildTopDeckSwitchBannerHTML('video', 'spec');
    };

    window.openDeckBIsolatedSettingsModal = function(ev, sectionKey, forceOpen) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        window._lastActiveSettingsDeckV359 = 'video';
        if (typeof window.initVideoDeckAudioV131 === 'function') window.initVideoDeckAudioV131();
        var smA = document.getElementById('settingsModal');
        var smB = ensureDeckBSettingsModalDOM();
        if (typeof window.mountModularLabSettingsV208 === 'function') window.mountModularLabSettingsV208();
        var prevScroll = (smA && smA.classList.contains('open')) ? smA.scrollTop : smB.scrollTop;
        if (smA && smA.classList.contains('open')) {
            syncDetailsOpenStateBetweenModalsV360(smA, smB, sectionKey);
        } else if (sectionKey && sectionKey !== 'sec_top') {
            var tDet = smB.querySelector('details[data-ab-sec="' + sectionKey + '"]');
            if (tDet) tDet.open = true;
        }
        var anyDeckAOpen = Boolean(smA && smA.classList.contains('open'));
        var wasOpen = smB.classList.contains('open') && !sectionKey && !forceOpen && !anyDeckAOpen;
        closeAllDeckAModals();
        window.closeDeckBIsolatedModals();
        if (!wasOpen) {
            window.syncDeckBIsolatedSettingsModalUI();
            smB.classList.add('open');
            var gearBtn = document.getElementById('btn-settingsModal');
            if (gearBtn) gearBtn.classList.add('active');
            window.updateDeckBAutoCeilMonitorUI();
            notifyModalLayoutSyncV360();
            if (sectionKey && sectionKey !== 'sec_top') {
                setTimeout(function() {
                    var secEl = smB.querySelector('[data-ab-sec="' + sectionKey + '"]');
                    if (secEl && secEl.scrollIntoView) secEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 30);
            } else {
                smB.scrollTop = prevScroll || 0;
            }
        } else {
            notifyModalLayoutSyncV360();
        }
    };

    window.openDeckBIsolatedEqModal = function(ev, forceOpen) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        if (typeof window.initVideoDeckAudioV131 === 'function') window.initVideoDeckAudioV131();
        var eqA = document.getElementById('eqModal');
        var smA = document.getElementById('settingsModal');
        var eqB = ensureDeckBEqModalDOM();
        var fromDeckA = Boolean((eqA && eqA.classList.contains('open')) || (smA && smA.classList.contains('open')));
        var wasOpen = eqB.classList.contains('open') && !forceOpen && !fromDeckA;
        closeAllDeckAModals();
        window.closeDeckBIsolatedModals();
        if (!wasOpen) {
            window.syncDeckBIsolatedEqModalUI();
            eqB.classList.add('open');
            window.updateDeckBAutoCeilMonitorUI();
        }
        notifyModalLayoutSyncV360();
    };

    window.openDeckBIsolatedSpecModal = function(ev, forceOpen) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        if (typeof window.initVideoDeckAudioV131 === 'function') window.initVideoDeckAudioV131();
        var spA = document.getElementById('specModal');
        var smA = document.getElementById('settingsModal');
        var spB = ensureDeckBSpecModalDOM();
        var fromDeckA = Boolean((spA && spA.classList.contains('open')) || (smA && smA.classList.contains('open')));
        var wasOpen = spB.classList.contains('open') && !forceOpen && !fromDeckA;
        closeAllDeckAModals();
        window.closeDeckBIsolatedModals();
        if (!wasOpen) {
            var banner = document.getElementById('deckSwitchBarSpecDeckB');
            if (banner) banner.innerHTML = buildTopDeckSwitchBannerHTML('video', 'spec');
            spB.classList.add('open');
            startDeckBSpectrumAndScopeLoop();
            window.updateDeckBAutoCeilMonitorUI();
        }
        notifyModalLayoutSyncV360();
    };

    window.switchSettingsCopyABV359 = function(targetDeck, sectionKey, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        if (sectionKey && sectionKey.indexOf('eq_') === 0) {
            window.switchModalCopyABV359(targetDeck, 'eq', ev);
            return;
        }
        window._lastActiveSettingsDeckV359 = targetDeck;
        if (targetDeck === 'video') {
            window.openDeckBIsolatedSettingsModal(ev, sectionKey || 'sec_top', true);
        } else {
            var smA = document.getElementById('settingsModal');
            var smB = document.getElementById('settingsModalDeckB');
            var prevScroll = (smB && smB.classList.contains('open')) ? smB.scrollTop : (smA ? smA.scrollTop : 0);
            if (smA && smB && smB.classList.contains('open')) {
                syncDetailsOpenStateBetweenModalsV360(smB, smA, sectionKey);
            } else if (smA && sectionKey && sectionKey !== 'sec_top') {
                var tDetA = smA.querySelector('details[data-ab-sec="' + sectionKey + '"]');
                if (tDetA) tDetA.open = true;
            }
            window.closeDeckBIsolatedModals();
            window.decorateDeckAModalsWithABSwitchersV359();
            if (smA && !smA.classList.contains('open')) {
                smA.classList.add('open');
                var gearBtn = document.getElementById('btn-settingsModal');
                if (gearBtn) gearBtn.classList.add('active');
            }
            notifyModalLayoutSyncV360();
            if (smA && sectionKey && sectionKey !== 'sec_top') {
                setTimeout(function() {
                    var secEl = smA.querySelector('[data-ab-sec="' + sectionKey + '"]');
                    if (secEl && secEl.scrollIntoView) secEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 30);
            } else if (smA) {
                smA.scrollTop = prevScroll || 0;
            }
        }
    };

    window.switchModalCopyABV359 = function(targetDeck, modalKind, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        if (modalKind === 'eq') {
            if (targetDeck === 'video') {
                window.openDeckBIsolatedEqModal(ev, true);
            } else {
                window.closeDeckBIsolatedModals();
                window.decorateDeckAModalsWithABSwitchersV359();
                var eqA = document.getElementById('eqModal');
                if (eqA && !eqA.classList.contains('open')) eqA.classList.add('open');
                notifyModalLayoutSyncV360();
            }
            return;
        }
        if (modalKind === 'spec') {
            if (targetDeck === 'video') {
                window.openDeckBIsolatedSpecModal(ev, true);
            } else {
                window.closeDeckBIsolatedModals();
                window.decorateDeckAModalsWithABSwitchersV359();
                var spA = document.getElementById('specModal');
                if (spA && !spA.classList.contains('open')) window.openSpectrumModalV62();
                notifyModalLayoutSyncV360();
            }
            return;
        }
        window.switchSettingsCopyABV359(targetDeck, 'sec_top', ev);
    };

    window.syncAllDeckBClonedModalsUI = function() {
        window.syncDeckBIsolatedEqModalUI();
        window.syncDeckBIsolatedSettingsModalUI();
        window.decorateDeckAModalsWithABSwitchersV359();
    };

    // Интегрируем закрытие модалок Деки Б при открытии любой модалки Деки А через toggleModal
    function hookGlobalToggleModalForDeckBV359() {
        var origToggle = window.toggleModal;
        if (typeof origToggle === 'function' && !origToggle._v359Hooked) {
            var wrapped = function(id) {
                var smB = document.getElementById('settingsModalDeckB');
                if (id === 'settingsModal' && smB && smB.classList.contains('open')) {
                    window.closeDeckBIsolatedModals();
                    return;
                }
                try { window.closeDeckBIsolatedModals(); } catch (e) {}
                try { window.decorateDeckAModalsWithABSwitchersV359(); } catch (e) {}
                return origToggle.apply(this, arguments);
            };
            wrapped._v359Hooked = true;
            window.toggleModal = wrapped;
        }
        // Переопределяем openVideoDeckDspStudioV131 (кнопка «🎛️ Пульт Б» в видеоплеере), чтобы она открывала полную копию #settingsModalDeckB!
        window.openVideoDeckDspStudioV131 = function(ev) {
            if (window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
            if (ev && ev.stopPropagation) ev.stopPropagation();
            if (window._vidStateV130 && !window._vidStateV130.pipMode && typeof window.toggleVideoPipModeV130 === 'function') {
                window.toggleVideoPipModeV130();
            }
            window.openDeckBIsolatedSettingsModal(ev, 'sec_top');
        };
        // Переопределяем renderDeckSwitchBannersV131, чтобы в обеих копиях всегда рисовались актуальные переключатели А/Б
        window.renderDeckSwitchBannersV131 = function() {
            try { window.decorateDeckAModalsWithABSwitchersV359(); } catch (e) {}
            var bEq = document.getElementById('deckSwitchBarEqDeckB');
            if (bEq) bEq.innerHTML = buildTopDeckSwitchBannerHTML('video', 'eq');
            var bSet = document.getElementById('deckSwitchBarSettingsDeckB');
            if (bSet) bSet.innerHTML = buildTopDeckSwitchBannerHTML('video', 'settings');
            var bSp = document.getElementById('deckSwitchBarSpecDeckB');
            if (bSp) bSp.innerHTML = buildTopDeckSwitchBannerHTML('video', 'spec');
        };
    }

    function bindDeckBTransportModalButtons() {
        var eqBtnB = document.getElementById('btnEqDeckBV216');
        if (eqBtnB && !eqBtnB._v359Bound) {
            eqBtnB._v359Bound = true;
            eqBtnB.onclick = function(ev) {
                window.openDeckBIsolatedEqModal(ev);
            };
        }
        var specBtnB = document.getElementById('btnSpecDeckBV216');
        if (specBtnB && !specBtnB._v359Bound) {
            specBtnB._v359Bound = true;
            specBtnB.onclick = function(ev) {
                window.openDeckBIsolatedSpecModal(ev);
            };
        }
    }

    setTimeout(function() {
        ensureDeckBEqModalDOM();
        ensureDeckBSettingsModalDOM();
        ensureDeckBSpecModalDOM();
        hookGlobalToggleModalForDeckBV359();
        window.decorateDeckAModalsWithABSwitchersV359();
        bindDeckBTransportModalButtons();
    }, 380);

    setInterval(function() {
        bindDeckBTransportModalButtons();
        window.refreshFourBuffersHudV359();
    }, 1253);
})();

/* ============================================================================
 * ui_export_modal.js — Окно экспорта (V234)
 *
 * Склейка:  /bundle_2_player.js, модуль 12 из 18. Порядок модулей задан в player.py и менять его нельзя:
 *           поздние модули переопределяют и оборачивают функции ранних.
 * Внутри:   ensureExportDefaultsV234, applyExportSectionsCollapseUIV234, toggleExportSectionCollapseV234, getSampleRateLabelV234, ensureExportModalV69, selectExportSampleRateV86, exportCurrentTrack
 * Откуда:   ui_v71.js (коммит 9ae6639), строки 19879–19879, 29561–29586, 29639–29825. Код блоков перенесён без правок.
 * Подробно: FILES.md (карта файлов), REFACTOR_PLAN.md (как резалось и что перекрыто).
 * ============================================================================ */


/* [split] V216: кусок исходного IIFE (ui_v71.js, строки 19638–21240) → ui_export_modal.js */
;(function() {
    if (window._jennyV216Installed__export_modal) return;
    window._jennyV216Installed__export_modal = true;
    window._jennyV216Installed = true;

    // Новая правильная SVG-иконка ЭКСПОРТА (стрелка вверх/наружу из лотка!)
    window.EXPORT_OUT_SVG_V216 = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
})();
/* ================= END JENNY_V232_AUDIO_STOP_AND_RADIO_EXCLUSIVE_PATCH ================= */

/* ================= JENNY_V234_EXPORT_MODAL_FULLHEIGHT_COLLAPSIBLE_AND_XFLAC15_DEFAULT_PATCH (#329 / V234):
   1) STRETCH #exportModalV69 (.exp-modal-window-v69) TO 96.5vh NEAR TOP/BOTTOM SCREEN EDGES SO DSP CHECKBOXES LIST (#expModalGridV69) GETS MAXIMUM SPACE (71957.mp4)
   2) COLLAPSIBLE MULTI-ROW SECTIONS IN #exportModalV69 ON HEADER CLICK (🧬 Режим сжатия & 🎛️ Частота дискретизации) (71957.mp4)
   3) DEFAULT EXPORT SETTINGS: 🔥 XFLAC 15 (xflac_ultra), Sample Rate: 🎯 Авто (Родная) (orig), Bit Depth: 🎯 Авто (orig), Speed: Тек. (0) (71957.mp4)
================= */
/* [split] V234: кусок исходного IIFE (ui_v71.js, строки 29556–29826) → ui_export_modal.js */
;(function() {
    if (window._jennyV234Installed__export_modal) return;
    window._jennyV234Installed__export_modal = true;
    window._jennyV234Installed = true;

    // 1. One-time migration + default initialization to XFLAC 15 ('xflac_ultra'), 'orig' SR, 'orig' BD, Speed 0
    window.ensureExportDefaultsV234 = function() {
        window.appConfig = window.appConfig || {};
        var migrated = false;
        try {
            migrated = Boolean(localStorage.getItem('jenny_exp_default_v234_ultra'));
        } catch (e) {}

        if (!migrated) {
            window.appConfig.pocketBitrateV77 = 'xflac_ultra';
            window.appConfig.exportSampleRateV86 = 'orig';
            window.appConfig.exportBitDepthV157 = 'orig';
            window._forcedExportSpeedV79 = 0;
            try {
                localStorage.setItem('jenny_exp_default_v234_ultra', '1');
                localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
            } catch (e) {}
        } else {
            if (!window.appConfig.pocketBitrateV77) window.appConfig.pocketBitrateV77 = 'xflac_ultra';
            if (!window.appConfig.exportSampleRateV86) window.appConfig.exportSampleRateV86 = 'orig';
            if (!window.appConfig.exportBitDepthV157) window.appConfig.exportBitDepthV157 = 'orig';
            if (window._forcedExportSpeedV79 === undefined || window._forcedExportSpeedV79 === null) {
                window._forcedExportSpeedV79 = 0;
            }
        }
    };
    window.ensureExportDefaultsV234();

    // 3. State & toggle logic for collapsible multi-row sections in #exportModalV69
    window._expSectionsCollapsedV234 = (function() {
        try {
            var s = JSON.parse(localStorage.getItem('jenny_exp_sec_collapsed_v234') || '{}');
            return {
                br: Boolean(s && s.br),
                sr: Boolean(s && s.sr)
            };
        } catch (e) {
            return { br: false, sr: false };
        }
    })();

    window.applyExportSectionsCollapseUIV234 = function() {
        var st = window._expSectionsCollapsedV234 || { br: false, sr: false };
        var brGrp = document.getElementById('brBtnGroupV79');
        var brIco = document.getElementById('icoExpCollapseBrV234');
        if (brGrp) brGrp.style.display = st.br ? 'none' : 'grid';
        if (brIco) brIco.textContent = st.br ? '▾' : '▴';

        var srGrp = document.getElementById('srBtnGroupV86');
        var srIco = document.getElementById('icoExpCollapseSrV234');
        if (srGrp) srGrp.style.display = st.sr ? 'none' : 'grid';
        if (srIco) srIco.textContent = st.sr ? '▾' : '▴';
    };

    window.toggleExportSectionCollapseV234 = function(secKey, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        window._expSectionsCollapsedV234 = window._expSectionsCollapsedV234 || { br: false, sr: false };
        window._expSectionsCollapsedV234[secKey] = !window._expSectionsCollapsedV234[secKey];
        try {
            localStorage.setItem('jenny_exp_sec_collapsed_v234', JSON.stringify(window._expSectionsCollapsedV234));
        } catch (e) {}
        window.applyExportSectionsCollapseUIV234();
    };

    window.getSampleRateLabelV234 = function(sr) {
        var map = {
            'orig': '🎯 Авто (Родная)',
            '44100': '💿 44.1 kHz',
            '48000': '⚡ 48 kHz',
            '88200': '💎 88.2 kHz',
            '96000': '🔥 96 kHz',
            '176400': '✨ 176.4 kHz',
            '192000': '👑 192 kHz'
        };
        return map[String(sr || 'orig')] || String(sr);
    };

    // 4. Override ensureExportModalV69 with stretched layout, collapsible multi-row headers & XFLAC 15 default
    window.ensureExportModalV69 = function() {
        var existing = document.getElementById('exportModalV69');
        if (existing && existing._v234Upgraded) {
            window.applyExportSectionsCollapseUIV234();
            return existing;
        }
        if (existing) {
            existing.remove();
        }

        var modal = document.createElement('div');
        modal.id = 'exportModalV69';
        modal.className = 'exp-modal-backdrop-v69';
        modal._v234Upgraded = true;
        modal.onclick = function(e) {
            if (e.target === modal) modal.style.display = 'none';
        };

        modal.innerHTML = `
            <div class="exp-modal-window-v69" onclick="event.stopPropagation()">
                <div class="exp-modal-header-v69">
                    <span class="exp-modal-title-v69">💾 НАСТРОЙКИ ЭКСПОРТА DSP</span>
                    <button class="cp-close-btn" onclick="document.getElementById('exportModalV69').style.display='none'">✖</button>
                </div>

                <div class="exp-modal-top-actions-v69">
                    <button type="button" class="exp-top-btn-v69 btn-apply-cur" id="btnExpApplyCurrentV69">Применить все текущие</button>
                    <button type="button" class="exp-top-btn-v69 btn-clear-all" id="btnExpClearAllV69">Снять все</button>
                </div>
                <div id="expParamsPanelV234" style="padding:7px 10px;background:#090d14;border-bottom:1px solid #21262d;display:flex;flex-direction:column;gap:5px;">
                    <div id="expHdrBrV234" class="exp-sec-hdr-collapsible-v234" onclick="window.toggleExportSectionCollapseV234('br', event)" style="background:rgba(63,185,80,0.10);border:1px solid rgba(63,185,80,0.32);" title="Нажми, чтобы свернуть или развернуть режим сжатия">
                        <span style="font-size:11px;color:#3fb950;font-weight:bold;">🧬 Режим сжатия (Трек + Бэкап):</span>
                        <span style="display:inline-flex;align-items:center;gap:5px;">
                            <span id="lblActiveBrV79" style="font-size:10.5px;color:#58a6ff;font-weight:bold;">🔥 XFLAC Ultra (Gate 15 • ~8-9% от WAV)</span>
                            <span id="icoExpCollapseBrV234" style="font-size:12px;color:#3fb950;font-weight:900;">▴</span>
                        </span>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;" id="brBtnGroupV79">
                        <button type="button" data-br="16k" onclick="window.selectExportBitrateV79('16k')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">👻 16k</button>
                        <button type="button" data-br="24k" onclick="window.selectExportBitrateV79('24k')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">🚀 24k</button>
                        <button type="button" data-br="48k" onclick="window.selectExportBitrateV79('48k')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">⚡ 48k</button>
                        <button type="button" data-br="96k" onclick="window.selectExportBitrateV79('96k')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">🎵 96k</button>
                        <button type="button" data-br="128k" onclick="window.selectExportBitrateV79('128k')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">💎 128k</button>
                        <button type="button" data-br="192k" onclick="window.selectExportBitrateV79('192k')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">🔥 192k</button>
                        <button type="button" data-br="256k" onclick="window.selectExportBitrateV79('256k')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">👑 256k</button>
                        <button type="button" data-br="orig" onclick="window.selectExportBitrateV79('orig')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;font-weight:bold;" title="Кодировать в .opus с битрейтом исходника">🎯 OPUS Авто</button>
                        <button type="button" data-br="xflac_ultra" onclick="window.selectExportBitrateV79('xflac_ultra')" style="padding:6px 2px;font-size:9.5px;border-radius:6px;border:1px solid #3fb950;background:rgba(63,185,80,0.28);color:#fff;font-weight:bold;">🔥 XFLAC 15 (~26%)</button>
                        <button type="button" data-br="xflac_psycho" onclick="window.selectExportBitrateV79('xflac_psycho')" style="padding:6px 2px;font-size:9.5px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;font-weight:bold;">🧬 XFLAC 25 (~32%)</button>
                        <button type="button" data-br="xflac_hifi" onclick="window.selectExportBitrateV79('xflac_hifi')" style="padding:6px 2px;font-size:9.5px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#d2a8ff;font-weight:bold;">✨ XFLAC 45 (~38%)</button>
                        <button type="button" data-br="xflac_lossless" onclick="window.selectExportBitrateV79('xflac_lossless')" style="padding:6px 2px;font-size:9.5px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#58a6ff;font-weight:bold;">💎 XFLAC 1:1 (Lossless)</button>
                        <button type="button" data-br="wav_pcm" onclick="window.selectExportBitrateV79('wav_pcm')" style="grid-column:span 4;padding:5px 4px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#e3b341;font-weight:bold;">💿 Распаковать / Сохранить в чистый .WAV (PCM 1:1 без потерь)</button>
                    </div>

                    <div id="expHdrSrV234" class="exp-sec-hdr-collapsible-v234" onclick="window.toggleExportSectionCollapseV234('sr', event)" style="background:rgba(88,166,255,0.10);border:1px solid rgba(88,166,255,0.32);margin-top:1px;" title="Нажми, чтобы свернуть или развернуть частоту дискретизации">
                        <span style="font-size:11px;color:#58a6ff;font-weight:bold;">🎛️ Частота дискретизации (Sample Rate):</span>
                        <span style="display:inline-flex;align-items:center;gap:5px;">
                            <span id="lblActiveSrV234" style="font-size:10.5px;color:#3fb950;font-weight:bold;">🎯 Авто (Родная)</span>
                            <span id="icoExpCollapseSrV234" style="font-size:12px;color:#58a6ff;font-weight:900;">▴</span>
                        </span>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;" id="srBtnGroupV86">
                        <button type="button" data-sr="orig" onclick="window.selectExportSampleRateV86('orig')" style="grid-column:span 2;padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #3fb950;background:rgba(63,185,80,0.24);color:#fff;font-weight:bold;">🎯 Авто (Родная)</button>
                        <button type="button" data-sr="44100" onclick="window.selectExportSampleRateV86('44100')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">💿 44.1 kHz</button>
                        <button type="button" data-sr="48000" onclick="window.selectExportSampleRateV86('48000')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">⚡ 48 kHz</button>
                        <button type="button" data-sr="88200" onclick="window.selectExportSampleRateV86('88200')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">💎 88.2 kHz</button>
                        <button type="button" data-sr="96000" onclick="window.selectExportSampleRateV86('96000')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">🔥 96 kHz</button>
                        <button type="button" data-sr="176400" onclick="window.selectExportSampleRateV86('176400')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">✨ 176.4 kHz</button>
                        <button type="button" data-sr="192000" onclick="window.selectExportSampleRateV86('192000')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">👑 192 kHz</button>
                    </div>

                    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:1px;">
                        <span style="font-size:11px;color:#3fb950;font-weight:bold;">🎚️ Битовая глубина (Bit Depth):</span>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;" id="bdBtnGroupV157">
                        <button type="button" data-bd="orig" onclick="window.selectExportBitDepthV157('orig')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #3fb950;background:rgba(63,185,80,0.24);color:#fff;font-weight:bold;">🎯 Авто</button>
                        <button type="button" data-bd="16" onclick="window.selectExportBitDepthV157('16')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">💿 16-bit</button>
                        <button type="button" data-bd="24" onclick="window.selectExportBitDepthV157('24')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">💎 24-bit</button>
                        <button type="button" data-bd="32" onclick="window.selectExportBitDepthV157('32')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">👑 32-bit</button>
                    </div>

                    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:1px;">
                        <span style="font-size:11px;color:#d2a8ff;font-weight:bold;">⏩ Скорость упаковки:</span>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;" id="spdBtnGroupV79">
                        <button type="button" data-spd="0" onclick="window.selectExportSpeedV79(0)" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #58a6ff;background:rgba(88,166,255,0.18);color:#fff;">Тек.</button>
                        <button type="button" data-spd="1.5" onclick="window.selectExportSpeedV79(1.5)" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">x1.5</button>
                        <button type="button" data-spd="2" onclick="window.selectExportSpeedV79(2)" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">x2.0</button>
                        <button type="button" data-spd="10" onclick="window.selectExportSpeedV79(10)" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">x10</button>
                        <button type="button" data-spd="100" onclick="window.selectExportSpeedV79(100)" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">x100</button>
                    </div>

                    <div style="display:flex;align-items:center;gap:6px;margin-top:1px;">
                        <span style="font-size:11px;color:#e3b341;font-weight:bold;white-space:nowrap;">🔐 Ключ (SHA-512):</span>
                        <input type="text" id="inpPocketKeyV78" placeholder="Пусто = авто-ключ Jenny" style="flex:1;padding:4px 8px;font-size:11px;background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:6px;text-align:left !important;">
                    </div>
                </div>
                <div class="exp-modal-grid-v69" id="expModalGridV69"></div>
                <div class="exp-modal-footer-v69">
                    <button type="button" class="exp-foot-btn-v69" onclick="document.getElementById('exportModalV69').style.display='none'">Отмена</button>
                    <button type="button" class="exp-foot-btn-v69 primary-v69" id="btnExpConfirmRunV69">💾 Экспорт</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        window.applyExportSectionsCollapseUIV234();
        return modal;
    };

    // Update Sample Rate badge in header when Sample Rate changes
    var _origSelectExportSampleRateV86 = window.selectExportSampleRateV86;
    window.selectExportSampleRateV86 = function(sr) {
        var r = (typeof _origSelectExportSampleRateV86 === 'function')
            ? _origSelectExportSampleRateV86.apply(this, arguments)
            : undefined;
        var cleanSr = (window.appConfig && window.appConfig.exportSampleRateV86) || sr || 'orig';
        var lblSr = document.getElementById('lblActiveSrV234');
        if (lblSr) lblSr.textContent = window.getSampleRateLabelV234(cleanSr);
        return r;
    };

    // Wrap exportCurrentTrack so it always initializes with 'xflac_ultra' (XFLAC 15), 'orig' SR, 'orig' BD, Speed 0 by default
    var _origExportCurrentTrackV234 = window.exportCurrentTrack;
    window.exportCurrentTrack = function() {
        window.ensureExportDefaultsV234();
        var r = (typeof _origExportCurrentTrackV234 === 'function')
            ? _origExportCurrentTrackV234.apply(this, arguments)
            : undefined;
        window.applyExportSectionsCollapseUIV234();
        var curBr = (window.appConfig && window.appConfig.pocketBitrateV77) || 'xflac_ultra';
        var curSr = (window.appConfig && window.appConfig.exportSampleRateV86) || 'orig';
        var curBd = (window.appConfig && window.appConfig.exportBitDepthV157) || 'orig';
        var curSpd = (window._forcedExportSpeedV79 !== undefined) ? window._forcedExportSpeedV79 : 0;
        if (typeof window.selectExportBitrateV79 === 'function') window.selectExportBitrateV79(curBr);
        if (typeof window.selectExportSampleRateV86 === 'function') window.selectExportSampleRateV86(curSr);
        if (typeof window.selectExportBitDepthV157 === 'function') window.selectExportBitDepthV157(curBd);
        if (typeof window.selectExportSpeedV79 === 'function') window.selectExportSpeedV79(curSpd);
        return r;
    };
})();

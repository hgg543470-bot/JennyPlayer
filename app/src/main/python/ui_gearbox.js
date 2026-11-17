/* ============================================================================
 * ui_gearbox.js — Коробка передач: тумблер движка (V62), 5-ступенчатая КПП (V66), честная РКПП и реверс (V70), перемотка по RAM (V70.4)
 *
 * Склейка:  /bundle_1_studio.js, модуль 9 из 12. Порядок модулей задан в player.py и менять его нельзя:
 *           поздние модули переопределяют и оборачивают функции ранних.
 * Внутри:   initDefaultEngineModeJbufV62, setAudioEngineModeV62, syncEngineTumblerUIV62, upgradeToThreeWayTumblerV62_OBSOLETE, mountJennyStudioUI, setGearboxStateV66, engageDirectRamPitchShiftV70, getActiveTargetSpeedV59, syncMasterPlaybackEngineV59, upgradeToThreeWayTumblerV62 … (всего функций: 17)
 * Откуда:   ui_help.js (коммит 9ae6639), строки 3993–4010, 4091–4197, 4537–5063, 5418–5776. Код блоков перенесён без правок.
 * Подробно: FILES.md (карта файлов), REFACTOR_PLAN.md (как резалось и что перекрыто).
 * ============================================================================ */



// 🎛️ ПАТЧ V62 (ЭТАП 2): 3-ПОЗИЦИОННЫЙ ТУМБЛЕР (JBUF / VINYL / WEB API GOOGLE) + СКРЫТИЕ СПРАВОК (❓)

window.initDefaultEngineModeJbufV62 = function() {
    window.appConfig = window.appConfig || JSON.parse(localStorage.getItem('ytm_config') || '{}');
    // По умолчанию включаем наш движок JBUF 90° с питчлоком
    if (!window.appConfig._jbufDefaultSetV62) {
        window.appConfig._jbufDefaultSetV62 = true;
        window.appConfig.engineModeV62 = 'jbuf';
        window.appConfig.elasticHoseMode = true;
        window.appConfig.pitchLock = false;
        window.appConfig.studioMode = true;
        localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    }
    if (!window.appConfig.engineModeV62) {
        if (window.appConfig.elasticHoseMode) window.appConfig.engineModeV62 = 'jbuf';
        else if (window.appConfig.pitchLock) window.appConfig.engineModeV62 = 'webapi';
        else window.appConfig.engineModeV62 = 'vinyl';
    }
};
window.initDefaultEngineModeJbufV62();

window.setAudioEngineModeV62 = function(mode, ev) {
    window.appConfig = window.appConfig || {};
    window.appConfig.engineModeV62 = mode;

    const pitchChk = document.getElementById('cfg_pitchLock');
    const hoseChk = document.getElementById('cfg_elasticHoseV44');
    const studioChk = document.getElementById('cfg_studioMode');

    if (mode === 'jbuf') {
        window.appConfig.elasticHoseMode = true;
        window.appConfig.pitchLock = false;
        window.appConfig.studioMode = true;
        if (hoseChk) hoseChk.checked = true;
        if (pitchChk) pitchChk.checked = false;
        if (studioChk) studioChk.checked = true;
    } else if (mode === 'vinyl') {
        window.appConfig.elasticHoseMode = false;
        window.appConfig.pitchLock = false;
        if (hoseChk) hoseChk.checked = false;
        if (pitchChk) pitchChk.checked = false;
    } else if (mode === 'webapi') {
        window.appConfig.elasticHoseMode = false;
        window.appConfig.pitchLock = true;
        if (hoseChk) hoseChk.checked = false;
        if (pitchChk) pitchChk.checked = true;
    }

    window.syncEngineTumblerUIV62();
    if (typeof window.installHosePlayerHooksV46 === 'function') window.installHosePlayerHooksV46();
    if (typeof window.syncMasterPlaybackEngineV59 === 'function') window.syncMasterPlaybackEngineV59(false);

    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    if (typeof window.saveThemeOnlyQuietlyV40 === 'function') window.saveThemeOnlyQuietlyV40();

    if (typeof window.showToast === 'function' && ev) {
        const msgMap = {
            jbuf: window.tr('⚡ Движок: JBUF 90° (Студийный RAM Питчлок)', '⚡ Engine: JBUF 90° (Studio RAM PitchLock)'),
            vinyl: window.tr('💿 Движок: VINYL (Пластинка без питчлока)', '💿 Engine: VINYL (Natural Pitch Shift)'),
            webapi: window.tr('🌐 Движок: Web API Google (Штатный браузерный)', '🌐 Engine: Web API Google (Stock Browser)')
        };
        window.showToast(msgMap[mode] || msgMap.jbuf, ev);
    }
};

window.syncEngineTumblerUIV62 = function() {
    window.initDefaultEngineModeJbufV62();
    const mode = window.appConfig.engineModeV62 || 'jbuf';
    const bJbuf = document.getElementById('tmb_mode_jbuf');
    const bVinyl = document.getElementById('tmb_mode_vinyl');
    const bWeb = document.getElementById('tmb_mode_webapi');

    if (bJbuf) bJbuf.className = 'jbuf-tumbler-btn' + (mode === 'jbuf' ? ' active-jbuf' : '');
    if (bVinyl) bVinyl.className = 'jbuf-tumbler-btn' + (mode === 'vinyl' ? ' active-vinyl' : '');
    if (bWeb) bWeb.className = 'jbuf-tumbler-btn' + (mode === 'webapi' ? ' active-webapi' : '');
};

window.upgradeToThreeWayTumblerV62_OBSOLETE = function() {
    const pitchChk = document.getElementById('cfg_pitchLock');
    const hoseChk = document.getElementById('cfg_elasticHoseV44');
    const hoseBox = document.getElementById('hoseControlBoxV44');
    if (!hoseBox) return;

    // Скрываем старую одиночную строку cfg_pitchLock, так как теперь оба питчлока и винил объединены в 3-позиционный тумблер
    if (pitchChk) {
        const oldRow = pitchChk.closest('.setting-row');
        if (oldRow) oldRow.style.display = 'none';
    }
    if (hoseChk) {
        const oldHoseRow = hoseChk.closest('.setting-row');
        if (oldHoseRow && !document.getElementById('jbufThreeWayBarV62')) {
            const bar = document.createElement('div');
            bar.id = 'jbufThreeWayBarV62';
            bar.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <span style="font-size:12px;font-weight:bold;color:#e6edf3;">🎛️ ${window.tr('Звуковой движок скорости:', 'Speed Audio Engine:')}</span>
                </div>
                <div class="jbuf-tumbler-track">
                    <button type="button" id="tmb_mode_jbuf" class="jbuf-tumbler-btn" onclick="window.setAudioEngineModeV62('jbuf', event)">⚡ JBUF 90°</button>
                    <button type="button" id="tmb_mode_vinyl" class="jbuf-tumbler-btn" onclick="window.setAudioEngineModeV62('vinyl', event)">💿 VINYL</button>
                    <button type="button" id="tmb_mode_webapi" class="jbuf-tumbler-btn" onclick="window.setAudioEngineModeV62('webapi', event)">🌐 Web API Google</button>
                </div>
            `;
            oldHoseRow.insertAdjacentElement('beforebegin', bar);
            // В старой строке оставляем только телеметрию справа, пряча дублирующий чекбокс
            const lbl = oldHoseRow.querySelector('label');
            if (lbl) lbl.style.display = 'none';
            oldHoseRow.style.justifyContent = 'flex-end';
        }
    }
    window.syncEngineTumblerUIV62();
};

const _origMountV62 = window.mountJennyStudioUI;
window.mountJennyStudioUI = function() {
    if (typeof _origMountV62 === 'function') _origMountV62();
    window.injectHideHelpToggleV62();
    setTimeout(() => {
        window.upgradeToThreeWayTumblerV62();
        window.syncMasterPlaybackEngineV59(false);
    }, 80);
};

setTimeout(() => {
    window.injectHideHelpToggleV62();
    window.upgradeToThreeWayTumblerV62();
    window.syncMasterPlaybackEngineV59(false);
}, 550);


// ⚙️ ПАТЧ V66: 5-СТУПЕНЧАТАЯ МЕХАНИЧЕСКАЯ КПП (PITCH LOCK ▲ / PITCH SHIFT ▼ / НЕЙТРАЛЬ N)

window.GEAR_SPECS_V66 = {
    'jbuf-lock':   { x: 35,  y: 44,  col: 'left',  pos: 'up',   mode: 'jbuf',    pitchLock: true,  knob: 'J▲', labelRu: '1-я: ⚡ J Buf 90° [PITCH LOCK]',       labelEn: '1st: ⚡ J Buf 90° [PITCH LOCK]' },
    'jbuf-shift':  { x: 35,  y: 178, col: 'left',  pos: 'down', mode: 'jbuf',    pitchLock: false, knob: 'J▼', labelRu: '2-я: ⚡ J Buf RAM [PITCH SHIFT]',       labelEn: '2nd: ⚡ J Buf RAM [PITCH SHIFT]' },
    'web-lock':    { x: 101, y: 44,  col: 'mid',   pos: 'up',   mode: 'webapi',  pitchLock: true,  knob: 'W▲', labelRu: '3-я: 🌐 Web API [PITCH LOCK]',          labelEn: '3rd: 🌐 Web API [PITCH LOCK]' },
    'web-shift':   { x: 101, y: 178, col: 'mid',   pos: 'down', mode: 'webapi',  pitchLock: false, knob: 'W▼', labelRu: '4-я: 🌐 Web API [PITCH SHIFT]',         labelEn: '4th: 🌐 Web API [PITCH SHIFT]' },
    'vinyl-shift': { x: 167, y: 178, col: 'right', pos: 'down', mode: 'vinyl',   pitchLock: false, knob: 'R💿', labelRu: 'Задняя R: 💿 ВИНИЛ [PITCH SHIFT]',     labelEn: 'Rev R: 💿 VINYL [PITCH SHIFT]' },
    'neutral':     { x: 101, y: 111, col: 'mid',   pos: 'mid',  mode: 'neutral', pitchLock: true,  knob: 'N',  labelRu: 'Нейтраль (N): Холостой ход x1.00',     labelEn: 'Neutral (N): Idle 1.00x Bypass' }
};

window.setGearboxStateV66 = function(gearKey, ev) {
    const spec = window.GEAR_SPECS_V66[gearKey] || window.GEAR_SPECS_V66['jbuf-lock'];
    window.appConfig = window.appConfig || {};

    const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
    if ((gearKey === 'web-lock' || gearKey === 'web-shift') && isRev && !window._bypassGearConflictCheckV70) {
        window.syncEngineTumblerUIV62();
        if (typeof window.showWebApiReverseConflictModalV70 === 'function') {
            window.showWebApiReverseConflictModalV70(gearKey);
        }
        return;
    }

    window.appConfig.gearKeyV66 = gearKey;
    window.appConfig.engineModeV62 = spec.mode;
    window.appConfig.gearPitchLockV66 = spec.pitchLock;

    const pitchChk = document.getElementById('cfg_pitchLock');
    const hoseChk = document.getElementById('cfg_elasticHoseV44');
    const studioChk = document.getElementById('cfg_studioMode');

    if (gearKey === 'jbuf-lock') {
        window.appConfig.elasticHoseMode = true;
        window.appConfig.pitchLock = false;
        window.appConfig.studioMode = true;
        if (hoseChk) hoseChk.checked = true;
        if (pitchChk) pitchChk.checked = false;
        if (studioChk) studioChk.checked = true;
    } else if (gearKey === 'jbuf-shift') {
        window.appConfig.elasticHoseMode = false;
        window.appConfig.pitchLock = false;
        window.appConfig.studioMode = true;
        if (hoseChk) hoseChk.checked = false;
        if (pitchChk) pitchChk.checked = false;
        if (studioChk) studioChk.checked = true;
    } else if (gearKey === 'web-lock') {
        window.appConfig.elasticHoseMode = false;
        window.appConfig.pitchLock = true;
        window.appConfig.studioMode = false;
        if (hoseChk) hoseChk.checked = false;
        if (pitchChk) pitchChk.checked = true;
        if (studioChk) studioChk.checked = false;
    } else if (gearKey === 'web-shift') {
        window.appConfig.elasticHoseMode = false;
        window.appConfig.pitchLock = false;
        window.appConfig.studioMode = false;
        if (hoseChk) hoseChk.checked = false;
        if (pitchChk) pitchChk.checked = false;
        if (studioChk) studioChk.checked = false;
    } else if (gearKey === 'vinyl-shift') {
        window.appConfig.elasticHoseMode = false;
        window.appConfig.pitchLock = false;
        window.appConfig.studioMode = true;
        if (hoseChk) hoseChk.checked = false;
        if (pitchChk) pitchChk.checked = false;
        if (studioChk) studioChk.checked = true;
    } else if (gearKey === 'neutral') {
        window.appConfig.elasticHoseMode = false;
        window.appConfig.pitchLock = true;
        window.appConfig.studioMode = false;
        if (hoseChk) hoseChk.checked = false;
        if (pitchChk) pitchChk.checked = true;
        if (studioChk) studioChk.checked = false;
    }

    window.syncEngineTumblerUIV62();
    if (typeof window.installHosePlayerHooksV46 === 'function') window.installHosePlayerHooksV46();
    if (typeof window.syncMasterPlaybackEngineV59 === 'function') window.syncMasterPlaybackEngineV59(false);

    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    if (typeof window.saveThemeOnlyQuietlyV40 === 'function') window.saveThemeOnlyQuietlyV40();

    if (typeof window.showToast === 'function' && ev) {
        window.showToast('🕹️ ' + window.tr(spec.labelRu, spec.labelEn), ev);
    }
};

window.engageDirectRamPitchShiftV70 = function(gearKey, targetSpd) {
    const player = document.getElementById('audioPlayer');
    if (!player || !window.audioCtx) return false;

    const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
    const hasRev67 = Boolean(
        window.reconstructedMasterBufferV67 &&
        window.currentTrackRevMapV67 &&
        window.currentTrackRevNameV67 === window.currentPlayingTrack
    );

    let rawBuf = null;
    if (hasRev67) {
        rawBuf = isRev
            ? (window.reconstructedReversedBufferV67 || window.reconstructedMasterBufferV67)
            : window.reconstructedMasterBufferV67;
    } else {
        rawBuf = isRev
            ? (window.reversedStudioBuffer || window.studioBuffer)
            : window.studioBuffer;
    }

    // Если RAM-буфер ещё декодируется, временно крутим HTML5 поток со сдвигом тона
    if (!rawBuf) {
        if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 1.0;
        player.preservesPitch = false;
        player.mozPreservesPitch = false;
        player.webkitPreservesPitch = false;
        if (Math.abs(player.playbackRate - targetSpd) > 0.003) {
            try { player.playbackRate = targetSpd; } catch (e) {}
        }
        return false;
    }

    if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 0;
    player.preservesPitch = false;
    if (Math.abs(player.playbackRate - targetSpd) > 0.003) {
        try { player.playbackRate = targetSpd; } catch (e) {}
    }

    const isVinyl = (gearKey === 'vinyl-shift');
    const effSpd = hasRev67
        ? Math.max(0.1, Math.min(100.0, (parseFloat(window.currentTrackRevMapV67.spd) || 1.0) * targetSpd))
        : targetSpd;

    if (!player.paused) {
        const needNewNode = !window.studioSourceNode || !window.isStudioPlaying || window.studioSourceNode.buffer !== rawBuf || window.studioSourceNode._isHoseSpliced;
        if (needNewNode) {
            if (window.studioSourceNode) {
                window.studioSourceNode.onended = null;
                try { window.studioSourceNode.stop(); } catch (e) {}
                try { window.studioSourceNode.disconnect(); } catch (e) {}
            }
            window.studioSourceNode = window.audioCtx.createBufferSource();
            window.studioSourceNode._isHoseSpliced = false;
            window.studioSourceNode.buffer = rawBuf;
            window.studioSourceNode.playbackRate.value = effSpd;
            window.studioSourceNode.connect(window.inputMixer);

            let offset = player.currentTime || 0;
            if (isRev && rawBuf.duration) {
                offset = Math.max(0, rawBuf.duration - offset);
            }
            if (!isFinite(offset) || offset < 0) offset = 0;
            if (offset >= rawBuf.duration) offset = Math.max(0, rawBuf.duration - 0.05);

            window.studioSourceNode.start(0, offset);
            window.isStudioPlaying = true;
        } else if (window.studioSourceNode && window.studioSourceNode.playbackRate) {
            const now = window.audioCtx.currentTime;
            if (isVinyl) {
                window.studioSourceNode.playbackRate.setTargetAtTime(effSpd, now, 0.085);
            } else {
                window.studioSourceNode.playbackRate.setValueAtTime(effSpd, now);
            }
        }
    } else if (window.studioSourceNode) {
        window.studioSourceNode.onended = null;
        try { window.studioSourceNode.stop(); } catch (e) {}
        try { window.studioSourceNode.disconnect(); } catch (e) {}
        window.studioSourceNode = null;
        window.isStudioPlaying = false;
    }

    const badge = document.getElementById('hoseLiveTelemetryV44');
    if (badge) {
        if (isVinyl) {
            badge.style.color = '#d2a8ff';
            badge.innerText = `💿 ВИНИЛ [RAM Platter]: x${effSpd.toFixed(2)} (Инерция 85мс)`;
        } else {
            badge.style.color = '#3fb950';
            badge.innerText = `⚡ J Buf RAM [PITCH SHIFT]: x${effSpd.toFixed(2)} (Прямой 32-bit буфер)`;
        }
    }
    return true;
};

;(function() {
    const origGetSpeed = window.getActiveTargetSpeedV59;
    window.getActiveTargetSpeedV59 = function() {
        const gKey = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
        if (gKey === 'neutral') {
            return 1.0;
        }
        return typeof origGetSpeed === 'function' ? origGetSpeed() : 1.0;
    };

    const origSyncMaster = window.syncMasterPlaybackEngineV59;
    window.syncMasterPlaybackEngineV59 = function(forceRebuild) {
        const gKey = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
        const player = document.getElementById('audioPlayer');
        const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));

        // 2-я передача (J Buf Pitch Shift) и Задняя R (Винил): крутим 32-bit RAM буфер напрямую со сдвигом тона
        if ((gKey === 'jbuf-shift' || gKey === 'vinyl-shift') && player) {
            const targetSpd = window.getActiveTargetSpeedV59();
            window.engageDirectRamPitchShiftV70(gKey, targetSpd);
            return;
        }

        // 3-я и 4-я передачи (Web API): только чистый HTML5 поток без захвата JBUF
        if ((gKey === 'web-lock' || gKey === 'web-shift') && player && !isRev) {
            if (window.studioSourceNode) {
                window.studioSourceNode.onended = null;
                try { window.studioSourceNode.stop(); } catch (e) {}
                try { window.studioSourceNode.disconnect(); } catch (e) {}
                window.studioSourceNode = null;
            }
            window.isStudioPlaying = false;
            if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 1.0;
            const lockPitch = (gKey === 'web-lock');
            player.preservesPitch = lockPitch;
            player.mozPreservesPitch = lockPitch;
            player.webkitPreservesPitch = lockPitch;

            const targetSpd = window.getActiveTargetSpeedV59();
            if (Math.abs(player.playbackRate - targetSpd) > 0.005) {
                try { player.playbackRate = targetSpd; } catch (e) {}
            }
            const badge = document.getElementById('hoseLiveTelemetryV44');
            if (badge) {
                badge.style.color = '#58a6ff';
                badge.innerText = lockPitch
                    ? `🌐 Web API [PITCH LOCK] | x${targetSpd.toFixed(2)}`
                    : `🌐 Web API [PITCH SHIFT] | x${targetSpd.toFixed(2)}`;
            }
            return;
        }

        return typeof origSyncMaster === 'function' ? origSyncMaster(forceRebuild) : undefined;
    };
})();

window.upgradeToThreeWayTumblerV62 = function() {
    if (typeof window.injectElasticHoseControlsV44 === 'function' && !document.getElementById('hoseControlBoxV44')) {
        window.injectElasticHoseControlsV44();
    }
    const pitchChk = document.getElementById('cfg_pitchLock');
    const hoseChk = document.getElementById('cfg_elasticHoseV44');
    const hoseBox = document.getElementById('hoseControlBoxV44');
    if (!hoseBox) return;

    if (pitchChk) {
        const oldRow = pitchChk.closest('.setting-row');
        if (oldRow) oldRow.style.display = 'none';
    }

    ['jbufThreeWayBarV62', 'jbufInteractiveGearboxV65'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });

    if (hoseChk) {
        const oldHoseRow = hoseChk.closest('.setting-row');
        if (oldHoseRow && !document.getElementById('jbufMechanicalGearboxV66')) {
            const wrap = document.createElement('div');
            wrap.id = 'jbufMechanicalGearboxV66';
            wrap.className = 'gearbox-container';
            wrap.innerHTML = `
                <div class="gearbox-knob-plate" id="gearPlateV66">
                    <svg class="gearbox-svg-overlay" viewBox="0 0 264 264">
                        <defs>
                            <linearGradient id="plGradV66" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stop-color="#3fb950"/>
                                <stop offset="100%" stop-color="#58a6ff"/>
                            </linearGradient>
                            <linearGradient id="psGradV66" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stop-color="#a371f7"/>
                                <stop offset="100%" stop-color="#e3b341"/>
                            </linearGradient>
                        </defs>
                        <rect x="64" y="13" width="136" height="20" rx="10" fill="#070a10" stroke="url(#plGradV66)" stroke-width="1.5"/>
                        <text x="132" y="27" fill="#e6edf3" font-family="monospace" font-weight="900" font-size="11.5" text-anchor="middle" letter-spacing="1.8">▲ PITCH LOCK</text>

                        <rect x="60" y="231" width="144" height="20" rx="10" fill="#070a10" stroke="url(#psGradV66)" stroke-width="1.5"/>
                        <text x="132" y="245" fill="#e6edf3" font-family="monospace" font-weight="900" font-size="11.5" text-anchor="middle" letter-spacing="1.5">▼ PITCH SHIFT</text>
                    </svg>

                    <div id="enc-jbuf" class="gearbox-gate-enclosure" style="left:41px; top:40px; width:46px; height:184px;"></div>
                    <div id="enc-web" class="gearbox-gate-enclosure" style="left:107px; top:40px; width:46px; height:184px;"></div>
                    <div id="enc-vinyl" class="gearbox-gate-enclosure" style="left:173px; top:116px; width:46px; height:108px;"></div>

                    <div class="gearbox-h-line" style="left:52px; top:129px; width:136px; height:6px;"></div>
                    <div class="gearbox-h-line" style="left:52px; top:50px; width:6px; height:164px;"></div>
                    <div class="gearbox-h-line" style="left:118px; top:50px; width:6px; height:164px;"></div>
                    <div class="gearbox-h-line" style="left:184px; top:129px; width:6px; height:85px;"></div>

                    <div class="gearbox-stopper-dot" style="left:51px; top:48px;"></div>
                    <div class="gearbox-stopper-dot" style="left:51px; top:208px;"></div>
                    <div class="gearbox-stopper-dot" style="left:117px; top:48px;"></div>
                    <div class="gearbox-stopper-dot" style="left:117px; top:208px;"></div>
                    <div class="gearbox-stopper-dot" style="left:183px; top:208px;"></div>

                    <!-- Левая шахта: J наверху, Buf внизу -->
                    <div class="gearbox-letter jbuf-mode-color" id="let-J" style="left:65px; top:72px;">J</div>
                    <div class="gearbox-letter jbuf-mode-color" id="let-b" style="left:65px; top:148px;">B</div>
                    <div class="gearbox-letter jbuf-mode-color" id="let-u" style="left:65px; top:170px;">u</div>
                    <div class="gearbox-letter jbuf-mode-color" id="let-f" style="left:65px; top:192px;">f</div>

                    <!-- Средняя шахта: Web наверху, API внизу -->
                    <div class="gearbox-letter" id="let-W" style="left:131px; top:52px;">W</div>
                    <div class="gearbox-letter" id="let-e" style="left:131px; top:74px;">e</div>
                    <div class="gearbox-letter" id="let-web-b" style="left:131px; top:96px;">b</div>
                    <div class="gearbox-letter" id="let-a" style="left:131px; top:148px;">A</div>
                    <div class="gearbox-letter" id="let-p" style="left:131px; top:170px;">P</div>
                    <div class="gearbox-letter" id="let-i" style="left:131px; top:192px;">I</div>

                    <!-- Правая шахта: ВИНИЛ (RU) / VINYL (EN) -->
                    <div class="gearbox-letter vinyl-mode-color" id="let-v" style="left:197px; top:128px;">В</div>
                    <div class="gearbox-letter vinyl-mode-color" id="let-i-vin" style="left:197px; top:145px;">И</div>
                    <div class="gearbox-letter vinyl-mode-color" id="let-n" style="left:197px; top:162px;">Н</div>
                    <div class="gearbox-letter vinyl-mode-color" id="let-i-vin2" style="left:197px; top:179px;">И</div>
                    <div class="gearbox-letter vinyl-mode-color" id="let-l" style="left:197px; top:196px;">Л</div>

                    <div class="gearbox-knob-lever" id="gearKnobV66">
                        <span class="gearbox-knob-inner-text" id="gearKnobTextV66">J▲</span>
                    </div>
                </div>
                <div class="gearbox-status-readout" id="gearStatusTextV66">🕹️ 1-я: ⚡ J Buf 90° [PITCH LOCK]</div>
            `;
            oldHoseRow.insertAdjacentElement('beforebegin', wrap);

            const lbl = oldHoseRow.querySelector('label');
            if (lbl) lbl.style.display = 'none';
            oldHoseRow.style.display = 'none';

            window.initGearboxInteractivityV66();
        }
    }
    window.syncEngineTumblerUIV62();
};

window.initGearboxInteractivityV66 = function() {
    const plate = document.getElementById('gearPlateV66');
    const knob = document.getElementById('gearKnobV66');
    if (!plate || !knob) return;

    window.appConfig = window.appConfig || {};
    if (!window.appConfig.gearKeyV66) {
        window.appConfig.gearKeyV66 = 'jbuf-lock';
    }
    if (window.appConfig.gearKeyV66 === 'jbuf-lock') {
        window.appConfig.elasticHoseMode = true;
        window.appConfig.pitchLock = false;
        window.appConfig.studioMode = true;
        const hoseChk = document.getElementById('cfg_elasticHoseV44');
        const pitchChk = document.getElementById('cfg_pitchLock');
        const studioChk = document.getElementById('cfg_studioMode');
        if (hoseChk) hoseChk.checked = true;
        if (pitchChk) pitchChk.checked = false;
        if (studioChk) studioChk.checked = true;
    }

    let isDragging = false;
    let dragOffsetX = 0, dragOffsetY = 0;
    let currentX = 35, currentY = 44;

    const COL_X = { left: 35, mid: 101, right: 167 };
    const NEUTRAL_Y = 111;
    const TOP_Y = 44;
    const BOT_Y = 178;
    const END_STOP_TOLERANCE = 14;

    window.syncEngineTumblerUIV62 = function() {
        const gKey = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
        const spec = window.GEAR_SPECS_V66[gKey] || window.GEAR_SPECS_V66['jbuf-lock'];

        currentX = spec.x;
        currentY = spec.y;
        knob.style.left = currentX + 'px';
        knob.style.top = currentY + 'px';

        const txt = document.getElementById('gearKnobTextV66');
        if (txt) txt.innerText = spec.knob;

        // Переключаем буквы ВИНИЛ <-> VINYL по языку интерфейса
        const isEn = Boolean((typeof window.isTrackUiEnglish === 'function' && window.isTrackUiEnglish()) || (window.appConfig && window.appConfig.lang === 'en'));
        const vChars = isEn ? ['V', 'I', 'N', 'Y', 'L'] : ['В', 'И', 'Н', 'И', 'Л'];
        const vIds = ['let-v', 'let-i-vin', 'let-n', 'let-i-vin2', 'let-l'];
        vIds.forEach((id, idx) => {
            const el = document.getElementById(id);
            if (el) el.innerText = vChars[idx];
        });

        const stTxt = document.getElementById('gearStatusTextV66');
        if (stTxt) {
            stTxt.innerText = '🕹️ ' + window.tr(spec.labelRu, spec.labelEn);
            stTxt.style.color = (gKey === 'neutral') ? '#e3b341' : (spec.mode === 'jbuf' ? '#3fb950' : (spec.mode === 'webapi' ? '#58a6ff' : '#d2a8ff'));
        }

        document.querySelectorAll('#gearPlateV66 .gearbox-letter').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('#gearPlateV66 .gearbox-gate-enclosure').forEach(el => {
            el.classList.remove('active-jbuf', 'active-webapi', 'active-vinyl');
        });

        if (gKey === 'jbuf-lock') {
            document.getElementById('enc-jbuf')?.classList.add('active-jbuf');
            document.getElementById('let-J')?.classList.add('active');
        } else if (gKey === 'jbuf-shift') {
            document.getElementById('enc-jbuf')?.classList.add('active-jbuf');
            document.getElementById('let-b')?.classList.add('active');
            document.getElementById('let-u')?.classList.add('active');
            document.getElementById('let-f')?.classList.add('active');
        } else if (gKey === 'web-lock') {
            document.getElementById('enc-web')?.classList.add('active-webapi');
            document.getElementById('let-W')?.classList.add('active');
            document.getElementById('let-e')?.classList.add('active');
            document.getElementById('let-web-b')?.classList.add('active');
        } else if (gKey === 'web-shift') {
            document.getElementById('enc-web')?.classList.add('active-webapi');
            document.getElementById('let-a')?.classList.add('active');
            document.getElementById('let-p')?.classList.add('active');
            document.getElementById('let-i')?.classList.add('active');
        } else if (gKey === 'vinyl-shift') {
            document.getElementById('enc-vinyl')?.classList.add('active-vinyl');
            ['let-v', 'let-i-vin', 'let-n', 'let-i-vin2', 'let-l'].forEach(id => {
                document.getElementById(id)?.classList.add('active');
            });
        }
    };

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    // Проверка попадания пальца в шарик ползунка + окантовка 3% ширины экрана
    const isPointNearKnob = (clientX, clientY) => {
        const rect = knob.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        const cx = rect.left + rect.width * 0.5;
        const cy = rect.top + rect.height * 0.5;
        const knobRad = Math.max(rect.width, rect.height) * 0.5;
        const marginPx = (window.innerWidth || document.documentElement.clientWidth || 360) * 0.03;
        return Math.hypot(clientX - cx, clientY - cy) <= (knobRad + marginPx);
    };

    const onStart = (e) => {
        const pt = e.touches ? e.touches[0] : e;
        if (!pt || !isPointNearKnob(pt.clientX, pt.clientY)) {
            isDragging = false;
            return;
        }
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        isDragging = true;
        knob.classList.add('dragging');
        dragOffsetX = pt.clientX - currentX;
        dragOffsetY = pt.clientY - currentY;
    };

    const onMove = (e) => {
        if (!isDragging) return;
        if (e.cancelable) e.preventDefault();
        const pt = e.touches ? e.touches[0] : e;
        let wantX = pt.clientX - dragOffsetX;
        let wantY = pt.clientY - dragOffsetY;

        const inNeutralCorridor = Math.abs(currentY - NEUTRAL_Y) <= 18 && Math.abs(wantY - NEUTRAL_Y) <= 22;

        if (inNeutralCorridor) {
            currentX = clamp(wantX, COL_X.left, COL_X.right);
            if (Math.abs(currentX - COL_X.left) > 10 && Math.abs(currentX - COL_X.mid) > 10 && Math.abs(currentX - COL_X.right) > 10) {
                currentY = NEUTRAL_Y;
            } else {
                if (Math.abs(currentX - COL_X.right) <= 10) {
                    currentY = clamp(wantY, NEUTRAL_Y, BOT_Y);
                } else {
                    currentY = clamp(wantY, TOP_Y, BOT_Y);
                }
            }
        } else {
            let lockedColX = COL_X.mid;
            if (Math.abs(currentX - COL_X.left) < 22) lockedColX = COL_X.left;
            else if (Math.abs(currentX - COL_X.right) < 22) lockedColX = COL_X.right;

            currentX = lockedColX;
            if (lockedColX === COL_X.right) {
                currentY = clamp(wantY, NEUTRAL_Y, BOT_Y);
            } else {
                currentY = clamp(wantY, TOP_Y, BOT_Y);
            }
        }

        knob.style.left = currentX + 'px';
        knob.style.top = currentY + 'px';
    };

    const onEnd = (e) => {
        if (!isDragging) return;
        isDragging = false;
        knob.classList.remove('dragging');

        let lockedGearKey = 'neutral';

        const atLeftCol  = Math.abs(currentX - COL_X.left) <= 14;
        const atMidCol   = Math.abs(currentX - COL_X.mid) <= 14;
        const atRightCol = Math.abs(currentX - COL_X.right) <= 14;

        const atTopEnd = (currentY <= TOP_Y + END_STOP_TOLERANCE);
        const atBotEnd = (currentY >= BOT_Y - END_STOP_TOLERANCE);

        if (atLeftCol && atTopEnd) {
            lockedGearKey = 'jbuf-lock';
        } else if (atLeftCol && atBotEnd) {
            lockedGearKey = 'jbuf-shift';
        } else if (atMidCol && atTopEnd) {
            lockedGearKey = 'web-lock';
        } else if (atMidCol && atBotEnd) {
            lockedGearKey = 'web-shift';
        } else if (atRightCol && atBotEnd) {
            lockedGearKey = 'vinyl-shift';
        } else {
            lockedGearKey = 'neutral';
        }

        if (typeof navigator.vibrate === 'function') {
            navigator.vibrate(lockedGearKey === 'neutral' ? [12, 30, 12] : 28);
        }

        window.setGearboxStateV66(lockedGearKey, e);
    };

    plate.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);

    plate.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', onEnd, { passive: true });
};

setTimeout(() => { window.upgradeToThreeWayTumblerV62(); }, 400);
setTimeout(() => { window.upgradeToThreeWayTumblerV62(); }, 800);

// Перехватываем applyElasticHoseBufferLiveV46 / _pureV52ApplyHose так, чтобы при наличии капсулы JENNYV67
// и изменении скорости (targetSpd != 1.0) нарезка шла от чистого восстановленного 1.0x оригинала!
;(function() {
    const origSyncV59 = window.syncMasterPlaybackEngineV59;
    window.syncMasterPlaybackEngineV59 = function(isDraggingArc) {
        const player = document.getElementById('audioPlayer');
        const gKey = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
        const targetSpd = window.getActiveTargetSpeedV59 ? window.getActiveTargetSpeedV59() : 1.0;

        const hasRev = Boolean(
            window.reconstructedMasterBufferV67 &&
            window.currentTrackRevMapV67 &&
            window.currentTrackRevNameV67 === window.currentPlayingTrack
        );

        // Если трек с капсулой JENNYV67 и пользователь изменил скорость (например, 0.5x трек включил на 2.0x)
        if (hasRev && Math.abs(targetSpd - 1.0) > 0.002 && gKey === 'jbuf-lock' && player && window.audioCtx) {
            if (isDraggingArc) {
                if (window._hoseArcDebounceTimerV47) clearTimeout(window._hoseArcDebounceTimerV47);
                window._hoseArcDebounceTimerV47 = setTimeout(() => {
                    window.syncMasterPlaybackEngineV59(false);
                }, 70);
                return;
            }

            const expSpd = parseFloat(window.currentTrackRevMapV67.spd) || 1.0;
            const effectiveSpd = Math.max(0.1, Math.min(100.0, expSpd * targetSpd));
            const tensionPct = (window.appConfig && window.appConfig.hoseTensionPct !== undefined) ? window.appConfig.hoseTensionPct : 100;
            const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
            const cleanBase = isRev ? (window.reconstructedReversedBufferV67 || window.reconstructedMasterBufferV67) : window.reconstructedMasterBufferV67;

            const activeBuf = window.buildElasticHoseBufferV46(cleanBase, effectiveSpd, tensionPct);

            if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 0;
            player.preservesPitch = false;
            if (Math.abs(player.playbackRate - targetSpd) > 0.002) {
                try { player.playbackRate = targetSpd; } catch (e) {}
            }

            const shouldPlayHose = !window._userPausedV75_2 && Boolean(window.isStudioPlaying || window._resumingFromUserPlayV232 || !player.paused);
            if (shouldPlayHose) {
                const curTrueSec = (typeof window.getTruePlaybackTimeV74_2 === 'function')
                    ? window.getTruePlaybackTimeV74_2()
                    : (player.currentTime || 0);
                if (window.studioSourceNode) {
                    window.studioSourceNode.onended = null;
                    try { window.studioSourceNode.stop(); } catch (e) {}
                    try { window.studioSourceNode.disconnect(); } catch (e) {}
                }
                window.studioSourceNode = window.audioCtx.createBufferSource();
                window.studioSourceNode._isHoseSpliced = true;
                window.studioSourceNode.buffer = activeBuf;
                window.studioSourceNode.playbackRate.value = 1.0;
                window.studioSourceNode.connect(window.inputMixer);

                let scaledOffset = curTrueSec / Math.max(0.05, targetSpd);
                if (!isFinite(scaledOffset) || scaledOffset < 0) scaledOffset = 0;
                if (scaledOffset >= activeBuf.duration) scaledOffset = Math.max(0, activeBuf.duration - 0.05);

                window.studioSourceNode.start(0, scaledOffset);
                window.isStudioPlaying = true;
                window._studioClockV74_1 = {
                    active: true,
                    startCtxTime: window.audioCtx.currentTime,
                    startTrackSec: Math.max(0, curTrueSec),
                    lastKnownSec: Math.max(0, curTrueSec),
                    trackName: window.currentPlayingTrack || '',
                    speed: targetSpd
                };
            }

            const badge = document.getElementById('hoseLiveTelemetryV44');
            if (badge) {
                badge.style.color = '#3fb950';
                if (Math.abs(effectiveSpd - 1.0) < 0.005) {
                    badge.innerText = `🧬 REV 1.00x (Чистый оригинал из x${expSpd.toFixed(2)} | 0 швов!)`;
                } else {
                    const c = window._hoseSplicerCacheV46 || {};
                    badge.innerText = `🧬 REV➔V49: x${effectiveSpd.toFixed(2)} (из x${expSpd.toFixed(2)}) | Δy=${((c.avgSeamErrMv || 0) * 100).toFixed(1)}%`;
                }
            }
            return;
        }

        const r = typeof origSyncV59 === 'function' ? origSyncV59(isDraggingArc) : undefined;
        if (hasRev) {
            const badge = document.getElementById('hoseLiveTelemetryV44');
            const expSpd = parseFloat(window.currentTrackRevMapV67.spd) || 1.0;
            if (badge && !badge.innerText.includes('🧬')) {
                badge.innerText = `🧬 [REV x${expSpd.toFixed(2)}] ` + badge.innerText;
            }
        }
        return r;
    };
})();


// ⚙️ ПАТЧ V70: ЧЕСТНАЯ РКПП (ЗАПРЕТ WEB API ВОodРОВАТЬ МЕХАНИЗМ JBUF НА РЕВЕРСЕ + ЧИСТАЯ НЕЙТРАЛКА N + СКРЫТИЕ СТАРЫХ ГАЛОЧЕК)

window.hideLegacyGearCheckboxesV70 = function() {
    const legacyTexts = [
        'упругий шланг 90',
        'elastic hose 90',
        'сохранять темп (pitch lock)',
        'preserve tempo (pitch lock)'
    ];
    document.querySelectorAll('input[type="checkbox"]').forEach(chk => {
        if (chk.closest('#exportModalV69')) return;
        const idLower = (chk.id || '').toLowerCase();
        const row = chk.closest('label, .pro-opt-row, .setting-row, .control-row') || chk.parentElement;
        const txt = row ? (row.textContent || '').toLowerCase() : '';
        if (
            idLower.includes('pitchlock') ||
            idLower.includes('elastichose') ||
            idLower.includes('hosemode') ||
            legacyTexts.some(w => txt.includes(w))
        ) {
            if (row) row.classList.add('legacy-hidden-gear-row-v70');
        }
    });
};

window.ensureWebApiReverseModalV70 = function() {
    let modal = document.getElementById('webApiRevConflictModalV70');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'webApiRevConflictModalV70';
    modal.className = 'webapi-rev-modal-backdrop-v70';
    modal.innerHTML = `
        <div class="webapi-rev-modal-box-v70" onclick="event.stopPropagation()">
            <div class="webapi-rev-title-v70" id="webApiRevTitleV70">⚠️ КОНФЛИКТ РЕЖИМА</div>
            <div class="webapi-rev-desc-v70" id="webApiRevDescV70">Web API не умеет проигрывать задом наперёд</div>
            <div class="webapi-rev-actions-v70">
                <button type="button" class="webapi-rev-btn-v70 btn-use-jbuf" id="btnWebRevToJbufV70">⚡ Вкл JBUF</button>
                <button type="button" class="webapi-rev-btn-v70 btn-use-normal" id="btnWebRevToNormV70">▶ Вкл норм проигрывание</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
};

window.setReverseStateCleanV70 = function(wantReverse) {
    const isNowRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
    if (isNowRev === Boolean(wantReverse)) return;

    if (typeof window.toggleReverse === 'function' && !window._inConflictModalV70) {
        window._inConflictModalV70 = true;
        try {
            window.toggleReverse();
        } finally {
            window._inConflictModalV70 = false;
        }
        return;
    }

    window.isReversed = Boolean(wantReverse);
    if (window.scrubState) window.scrubState.isPhysicallyReversed = Boolean(wantReverse);
    const revBtn = document.getElementById('btnReverse') || document.querySelector('[onclick*="toggleReverse"]');
    if (revBtn) {
        revBtn.classList.toggle('active', Boolean(wantReverse));
    }
};

window.applyGearCleanV70 = function(targetGearKey) {
    if (!window.appConfig) window.appConfig = {};
    window.appConfig.gearKeyV66 = targetGearKey;

    if (typeof window.setGearboxStateV66 === 'function') {
        window._bypassGearConflictCheckV70 = true;
        try { window.setGearboxStateV66(targetGearKey); } finally { window._bypassGearConflictCheckV70 = false; }
    } else if (typeof window.selectGearboxSlotV66 === 'function') {
        window._bypassGearConflictCheckV70 = true;
        try {
            window.selectGearboxSlotV66(targetGearKey);
        } finally {
            window._bypassGearConflictCheckV70 = false;
        }
    } else if (typeof window.setGearV66 === 'function') {
        window._bypassGearConflictCheckV70 = true;
        try {
            window.setGearV66(targetGearKey);
        } finally {
            window._bypassGearConflictCheckV70 = false;
        }
    }

    // Обновляем визуальную кулису РКПП, если есть слоты с data-gear
    document.querySelectorAll('[data-gear]').forEach(el => {
        el.classList.toggle('active-gear', el.getAttribute('data-gear') === targetGearKey);
    });
};

window.showWebApiReverseConflictModalV70 = function(requestedWebGear) {
    const modal = window.ensureWebApiReverseModalV70();
    const isEn = (typeof window.isTrackUiEnglish === 'function') && window.isTrackUiEnglish();

    const titleEl = document.getElementById('webApiRevTitleV70');
    const descEl = document.getElementById('webApiRevDescV70');
    const btnJbuf = document.getElementById('btnWebRevToJbufV70');
    const btnNorm = document.getElementById('btnWebRevToNormV70');

    if (titleEl) titleEl.textContent = isEn ? '⚠️ WEB API LIMITATION' : '⚠️ ОГРАНИЧЕНИЕ WEB API';
    if (descEl) descEl.textContent = isEn
        ? 'Web API cannot play audio backwards.'
        : 'Web API не умеет проигрывать задом наперёд.';
    if (btnJbuf) btnJbuf.textContent = isEn ? '⚡ Enable JBUF' : '⚡ Вкл JBUF';
    if (btnNorm) btnNorm.textContent = isEn ? '▶ Enable normal playback' : '▶ Вкл норм проигрывание';

    const webGear = (requestedWebGear === 'web-shift') ? 'web-shift' : 'web-lock';
    const matchingJbufGear = (webGear === 'web-shift') ? 'jbuf-shift' : 'jbuf-lock';

    btnJbuf.onclick = () => {
        modal.style.display = 'none';
        window.applyGearCleanV70(matchingJbufGear);
        window.setReverseStateCleanV70(true);
        if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
            window.syncMasterPlaybackEngineV59(false);
        }
    };

    btnNorm.onclick = () => {
        modal.style.display = 'none';
        window.setReverseStateCleanV70(false);
        window.applyGearCleanV70(webGear);
        if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
            window.syncMasterPlaybackEngineV59(false);
        }
    };

    modal.style.display = 'flex';
};

;(function initGearboxIntegrityV70() {
    setTimeout(window.hideLegacyGearCheckboxesV70, 150);
    setTimeout(window.hideLegacyGearCheckboxesV70, 800);

    // 1. Перехватываем нажатие кнопки Реверс (toggleReverse)
    if (typeof window.toggleReverse === 'function' && !window._origToggleReverseV70) {
        window._origToggleReverseV70 = window.toggleReverse;
        window.toggleReverse = function() {
            if (window._inConflictModalV70) {
                return window._origToggleReverseV70.apply(this, arguments);
            }
            const gKey = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
            const isWebGear = (gKey === 'web-lock' || gKey === 'web-shift');
            const isCurrentlyRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));

            // Если сейчас включён Web API и пользователь пытается включить Реверс — показываем окно выбора!
            if (isWebGear && !isCurrentlyRev) {
                window.showWebApiReverseConflictModalV70(gKey);
                return;
            }
            return window._origToggleReverseV70.apply(this, arguments);
        };
    }

    // 2. Перехватываем синхронизатор движка syncMasterPlaybackEngineV59
    const prevSync = window.syncMasterPlaybackEngineV59;
    window.syncMasterPlaybackEngineV59 = function(isDraggingArc) {
        window.hideLegacyGearCheckboxesV70();

        const player = document.getElementById('audioPlayer');
        const cfg = window.appConfig || {};
        const gKey = cfg.gearKeyV66 || 'jbuf-lock';
        const isWebGear = (gKey === 'web-lock' || gKey === 'web-shift');
        const isNeutral = (gKey === 'neutral' || gKey === 'n');
        const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));

        // Если активен Реверс и выбрана передача Web API — не даём Web API воровать буфер JBUF, вызываем модалку!
        if (isWebGear && isRev && !window._bypassGearConflictCheckV70) {
            if (window.studioSourceNode) {
                window.studioSourceNode.onended = null;
                try { window.studioSourceNode.stop(); } catch (e) {}
                try { window.studioSourceNode.disconnect(); } catch (e) {}
                window.studioSourceNode = null;
            }
            window.isStudioPlaying = false;
            window.showWebApiReverseConflictModalV70(gKey);
            return;
        }

        // Если включена НЕЙТРАЛКА (N) — сцепление со скоростью разомкнуто, чистый поток 1.00x
        if (isNeutral && player) {
            if (window.studioSourceNode && !isRev) {
                window.studioSourceNode.onended = null;
                try { window.studioSourceNode.stop(); } catch (e) {}
                try { window.studioSourceNode.disconnect(); } catch (e) {}
                window.studioSourceNode = null;
                window.isStudioPlaying = false;
            }
            if (!isRev) {
                if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 1.0;
                player.preservesPitch = true;
                if (Math.abs(player.playbackRate - 1.0) > 0.001) {
                    try { player.playbackRate = 1.0; } catch (e) {}
                }
            }
            const badge = document.getElementById('hoseLiveTelemetryV44');
            if (badge) {
                badge.style.color = '#8b949e';
                badge.innerText = '⚙️ НЕЙТРАЛЬ [N]: x1.00 (Сцепление скорости разомкнуто)';
            }
            return;
        }

        // Если выбрана 3-я или 4-я передача (Web API) — принудительно гасим JBUF studioSourceNode,
        // чтобы играл исключительно нативный HTML5 <audio> поток!
        if (isWebGear && player) {
            if (window.studioSourceNode) {
                window.studioSourceNode.onended = null;
                try { window.studioSourceNode.stop(); } catch (e) {}
                try { window.studioSourceNode.disconnect(); } catch (e) {}
                window.studioSourceNode = null;
            }
            window.isStudioPlaying = false;
            if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 1.0;

            const targetSpd = (typeof window.getActiveTargetSpeedV59 === 'function')
                ? window.getActiveTargetSpeedV59()
                : 1.0;
            const lockPitch = (gKey === 'web-lock');
            player.preservesPitch = lockPitch;
            if ('mozPreservesPitch' in player) player.mozPreservesPitch = lockPitch;
            if ('webkitPreservesPitch' in player) player.webkitPreservesPitch = lockPitch;

            if (Math.abs(player.playbackRate - targetSpd) > 0.002) {
                try { player.playbackRate = targetSpd; } catch (e) {}
            }

            const badge = document.getElementById('hoseLiveTelemetryV44');
            if (badge) {
                badge.style.color = '#58a6ff';
                badge.innerText = lockPitch
                    ? `🌐 Web API [PITCH LOCK]: x${targetSpd.toFixed(2)} (Прямой HTML5 поток)`
                    : `🌐 Web API [PITCH SHIFT]: x${targetSpd.toFixed(2)} (Прямой HTML5 поток)`;
            }
            return;
        }

        return typeof prevSync === 'function' ? prevSync(isDraggingArc) : undefined;
    };
})();


// ⏱️ ПАТЧ V70.4: СИНХРОНИЗАЦИЯ ШТАТНОГО ТАПА ПЕРЕМОТКИ С RAM-БУФЕРОМ (БЕЗ ПЕРЕХВАТА ЖЕСТОВ ТАЙМЛАЙНА)
;(function initRamSeekSyncV70() {
    const bindSeekHook = () => {
        const player = document.getElementById('audioPlayer');
        if (!player || player._hasRamSeekHookV70) return;
        player._hasRamSeekHookV70 = true;

        player.addEventListener('seeked', () => {
            const gKey = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
            if (window.studioSourceNode || gKey === 'jbuf-shift' || gKey === 'vinyl-shift' || gKey === 'jbuf-lock') {
                if (window.studioSourceNode) {
                    window.studioSourceNode.onended = null;
                    try { window.studioSourceNode.stop(); } catch (e) {}
                    try { window.studioSourceNode.disconnect(); } catch (e) {}
                    window.studioSourceNode = null;
                    window.isStudioPlaying = false;
                }
                if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
                    window.syncMasterPlaybackEngineV59(false);
                }
            }
        });
    };

    setTimeout(bindSeekHook, 200);
    setTimeout(bindSeekHook, 1000);
})();

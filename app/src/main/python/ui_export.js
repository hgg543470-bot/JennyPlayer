window.executeTrackExportV69 = async function() {
    if (!window.currentPlayingTrack) {
        if (typeof window.showToast === 'function') window.showToast("⚠️ Сначала выбери трек!");
        return;
    }

    const btn = document.getElementById('btnExport');
    const oldBtnHtml = btn ? btn.innerHTML : "";
    if (btn) btn.innerText = "⏳";
    const _activeBrToast = (window.appConfig && window.appConfig.pocketBitrateV77) || "48k";
    if (typeof window.showToast === 'function') window.showToast(_activeBrToast.startsWith("xflac") ? "⏳ Рендеринг и сжатие в XFLAC..." : (_activeBrToast === "wav_pcm" ? "⏳ Сохранение в чистый WAV..." : "⏳ Рендеринг в OPUS..."));

    try {
        if (typeof window.initAudioBoost === 'function') window.initAudioBoost();

        const player = document.getElementById('audioPlayer');
        const cfg = window.appConfig || {};

        let userSpeed = (typeof window.getActiveTargetSpeedV59 === 'function')
            ? window.getActiveTargetSpeedV59()
            : ((window.scrubState && (window.scrubState.active || window.scrubState.locked))
                ? window.scrubState.speed
                : (player && player.playbackRate ? player.playbackRate : 1.0));

        let isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));

        let gearKey = cfg.gearKeyV66 || 'jbuf-lock';
        let isNeutral = (gearKey === 'neutral' || gearKey === 'n');
        let isJbuf = (gearKey === 'jbuf-lock');
        let isJbufShift = (gearKey === 'jbuf-shift');
        let isWebApiPitch = (gearKey === 'web-lock');
        let isWebApiShift = (gearKey === 'web-shift');
        let pitchLock = (isJbuf || isWebApiPitch);
        let engineMode = (isJbuf || isJbufShift) ? 'jbuf' : ((isWebApiPitch || isWebApiShift) ? 'webapi' : 'vinyl');

        if (isNeutral) {
            userSpeed = 1.0;
        }
        if ((isWebApiPitch || isWebApiShift) && isRev) {
            if (typeof window.showWebApiReverseConflictModalV70 === 'function') {
                window.showWebApiReverseConflictModalV70(gearKey, 'export');
            }
            if (btn) btn.innerHTML = oldBtnHtml || "💾";
            return;
        }

        // Если текущий трек уже содержит восстановленный 1.0x оригинал в RAM и скорость изменена — берём чистый 1.0x исходник!
        const anyDspActive = window.DSP_EXPORT_EFFECTS_V69.some(def => Boolean(cfg[def.key]));
        const forcedSpd = parseFloat(window._forcedExportSpeedV79 || 0);
        if (forcedSpd > 0) userSpeed = forcedSpd;

        let hasRevMaster = Boolean(
            window.reconstructedMasterBufferV67 &&
            window.currentTrackRevMapV67 &&
            window.currentTrackRevNameV67 === window.currentPlayingTrack
        );

        const brModeNow = (cfg.pocketBitrateV77 || 'orig').toLowerCase();
        const srModeNow = (cfg.exportSampleRateV86 || 'orig').toLowerCase();
        const bdModeNow = (cfg.exportBitDepthV157 || 'orig').toLowerCase();

        if (!anyDspActive && Math.abs(userSpeed - 1.0) < 0.002 && !isRev && !hasRevMaster) {
            if (typeof window.showToast === 'function') window.showToast(`⏳ Прямое сжатие оригинала (${brModeNow}, частота: ${srModeNow})...`);
            let formData = new FormData();
            formData.append('audio_data', new Blob([new Uint8Array(44)], {type: 'audio/wav'}), 'direct.wav');
            formData.append('direct_clean_source', 'true');
            formData.append('filename', window.currentPlayingTrack);
            formData.append('speed', '1.0');
            formData.append('is_reversed', 'false');
            formData.append('pitch_lock', 'true');
            formData.append('engine_mode', engineMode);
            formData.append('gear_key', gearKey);
            formData.append('pocket_bitrate', brModeNow);
            formData.append('sample_rate_mode', srModeNow);
            formData.append('bit_depth_mode', bdModeNow);
            let res = await fetch('/api/export', { method: 'POST', body: formData });
            let json = await res.json();
            if (res.ok && json.status === 'ok') {
                if (typeof window.fetchData === 'function') window.fetchData();
                if (typeof window.showToast === 'function') window.showToast("✅ Сохранено 1:1: " + json.new_file);
            } else {
                throw new Error(json.error || "Ошибка прямого экспорта");
            }
            if (btn) btn.innerHTML = oldBtnHtml || "💾";
            return;
        }
        let speed = hasRevMaster
            ? Math.max(0.1, Math.min(100.0, (parseFloat(window.currentTrackRevMapV67.spd) || 1.0) * userSpeed))
            : userSpeed;

        const isStudioBufComplete = Boolean(window.studioBuffer && (!window.studioBuffer._pieceMapV72 || window.studioBuffer._allPiecesLoadedV72));
        let sourceBuffer = hasRevMaster ? window.reconstructedMasterBufferV67 : (isStudioBufComplete ? window.studioBuffer : null);
        if (!sourceBuffer) {
            let res = await fetch('/api/media/' + encodeURIComponent(window.currentPlayingTrack));
            if (!res.ok) {
                let errMsg = await res.text().catch(() => "Не удалось загрузить исходник трека");
                throw new Error(errMsg || "Не удалось загрузить исходник трека");
            }
            let arrayBuffer = await res.arrayBuffer();
            sourceBuffer = await window.audioCtx.decodeAudioData(arrayBuffer);
        }

        if (isRev) {
            if (hasRevMaster) {
                if (!window.reconstructedReversedBufferV67 && typeof window.cloneAndReverseBuffer === 'function') {
                    window.reconstructedReversedBufferV67 = await window.cloneAndReverseBuffer(sourceBuffer);
                }
                if (window.reconstructedReversedBufferV67) sourceBuffer = window.reconstructedReversedBufferV67;
            } else {
                if (!window.reversedStudioBuffer && typeof window.cloneAndReverseBuffer === 'function') {
                    window.reversedStudioBuffer = await window.cloneAndReverseBuffer(sourceBuffer);
                }
                if (window.reversedStudioBuffer) sourceBuffer = window.reversedStudioBuffer;
            }
        }

        let renderSpeed = speed;

        // Для JBUF 90° сначала прогоняем чистый 1.0x буфер через OfflineAudioContext (DSP),
        // а затем нарезаем его и собираем карман обрезков — так громкость и EQ кармана совпадают на 100%!
        if (isJbuf) {
            renderSpeed = 1.0;
        } else if (isWebApiPitch && Math.abs(speed - 1.0) > 0.002 && !isRev) {
            let stretchFormData = new FormData();
            stretchFormData.append('filename', window.currentPlayingTrack);
            stretchFormData.append('speed', speed);

            let stretchRes = await fetch('/api/stretch', { method: 'POST', body: stretchFormData });
            if (!stretchRes.ok) {
                let errJson = await stretchRes.json().catch(() => ({}));
                throw new Error(errJson.error || "Ошибка FFmpeg stretch");
            }
            let stretchedArrayBuffer = await stretchRes.arrayBuffer();
            sourceBuffer = await window.audioCtx.decodeAudioData(stretchedArrayBuffer);
            renderSpeed = 1.0;
        }

        let duration = sourceBuffer.duration / renderSpeed;
        let totalFrames = Math.max(1, Math.ceil(duration * sourceBuffer.sampleRate));

        let offlineCtx = new OfflineAudioContext(sourceBuffer.numberOfChannels, totalFrames, sourceBuffer.sampleRate);
        let offlineBucket = [];

        let sourceNode = offlineCtx.createBufferSource();
        sourceNode.buffer = sourceBuffer;
        sourceNode.playbackRate.value = renderSpeed;

        let currentNode = sourceNode;

        let preAmp = offlineCtx.createGain();
        preAmp.gain.value = anyDspActive ? 0.6 : 1.0;
        currentNode.connect(preAmp);
        currentNode = preAmp;

        if (cfg.firEnabled && cfg.firSettings && typeof window.createFIRImpulse === 'function') {
            let preFirPad = offlineCtx.createGain();
            preFirPad.gain.value = 0.8;
            let firNode = offlineCtx.createConvolver();
            firNode.normalize = false;
            firNode.buffer = window.createFIRImpulse(offlineCtx, cfg.firSettings.decay);
            let firGain = offlineCtx.createGain();
            firGain.value = cfg.firSettings.gain || 1.5;
            firGain.gain.value = cfg.firSettings.gain || 1.5;

            currentNode.connect(preFirPad);
            preFirPad.connect(firNode);
            firNode.connect(firGain);
            currentNode = firGain;
        }

        if (cfg.eqEnabled && window.eqNodes) {
            let freqs = [60, 230, 910, 3600, 14000];
            let types = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];
            let bandKeys = ['band60', 'band230', 'band910', 'band3600', 'band14000'];

            bandKeys.forEach((key, index) => {
                let liveNode = window.eqNodes[key];
                if (liveNode) {
                    let filter = offlineCtx.createBiquadFilter();
                    filter.type = types[index];
                    filter.frequency.value = freqs[index];
                    filter.gain.value = liveNode.gain.value;
                    currentNode.connect(filter);
                    currentNode = filter;
                }
            });
        }

        if (typeof window.insertProStudioPreChain === 'function') {
            currentNode = window.insertProStudioPreChain(offlineCtx, currentNode, cfg, offlineBucket, sourceBuffer);
        }

        let gainNode = offlineCtx.createGain();
        let activeVol = (window.gainNode && window.gainNode.gain) ? window.gainNode.gain.value : ((parseInt(cfg.defaultVolume, 10) || 10) / 10);
        gainNode.gain.value = activeVol;
        currentNode.connect(gainNode);
        currentNode = gainNode;

        if (cfg.limiterEnabled && cfg.limiterSettings) {
            let thresh = cfg.limiterSettings.threshold;
            let knee = cfg.limiterSettings.knee;
            let ratio = cfg.limiterSettings.ratio;

            if (cfg.multiBandEnabled && cfg.multiBandSettings) {
                let lowFreq = Math.max(20, cfg.multiBandSettings.low || 160);
                let highFreq = Math.max(lowFreq + 200, cfg.multiBandSettings.high || 2528);
                let vocalLowAnchor = Math.max(lowFreq, 320);
                let midCenter = Math.sqrt(vocalLowAnchor * highFreq);
                let midQ = Math.max(0.85, midCenter / (highFreq - vocalLowAnchor));

                let splitLow = offlineCtx.createBiquadFilter(); splitLow.type = 'lowpass'; splitLow.frequency.value = lowFreq;
                let splitMid = offlineCtx.createBiquadFilter(); splitMid.type = 'bandpass'; splitMid.frequency.value = midCenter; splitMid.Q.value = midQ;
                let splitHigh = offlineCtx.createBiquadFilter(); splitHigh.type = 'highpass'; splitHigh.frequency.value = highFreq;

                let compLow = offlineCtx.createDynamicsCompressor();
                compLow.threshold.value = thresh; compLow.knee.value = knee; compLow.ratio.value = ratio;
                compLow.attack.value = Math.max(0.015, (cfg.limiterSettings.attack || 26) / 1000);
                compLow.release.value = Math.max(0.04, (cfg.limiterSettings.release || 60) / 1000);

                let compMid = offlineCtx.createDynamicsCompressor();
                compMid.threshold.value = Math.min(-6, thresh + 7);
                compMid.knee.value = Math.max(12, knee);
                compMid.ratio.value = Math.min(3.5, Math.max(1.5, ratio * 0.25));
                compMid.attack.value = Math.max(0.025, (cfg.limiterSettings.attack || 26) / 1000);
                compMid.release.value = 0.16;

                let compHigh = offlineCtx.createDynamicsCompressor();
                compHigh.threshold.value = thresh + 4; compHigh.knee.value = knee; compHigh.ratio.value = Math.min(6.0, ratio);
                compHigh.attack.value = 0.008; compHigh.release.value = 0.08;

                currentNode.connect(splitLow); currentNode.connect(splitMid); currentNode.connect(splitHigh);
                splitLow.connect(compLow); splitMid.connect(compMid); splitHigh.connect(compHigh);

                let postBus = offlineCtx.createGain();
                let midPhaseNode = offlineCtx.createGain();
                let deEssGain = offlineCtx.createGain();

                if (cfg.phaseFixEnabled) {
                    splitMid.Q.value = Math.max(0.25, midQ * 0.65);
                    midPhaseNode.gain.value = -1.22;
                    compLow.connect(postBus);
                    compMid.connect(midPhaseNode); midPhaseNode.connect(postBus);
                    compHigh.connect(postBus);
                } else {
                    let widthPct = parseFloat(cfg.val_midQ); if (isNaN(widthPct) || widthPct < 25) widthPct = 150;
                    let targetQ = cfg.opt_midQ ? Math.max(0.65, Math.min(2.5, midQ / (widthPct / 100.0))) : midQ;
                    splitMid.Q.value = targetQ;

                    let midDb = parseFloat(cfg.val_midPhase); if (isNaN(midDb)) midDb = 1.5;
                    midPhaseNode.gain.value = cfg.opt_midPhase ? window.dbToLinear(Math.max(-15, Math.min(15, midDb))) : 1.0;

                    let deEssDb = parseFloat(cfg.val_deEsser); if (isNaN(deEssDb)) deEssDb = -6.0;
                    if (cfg.opt_deEsser) {
                        compHigh.threshold.value = Math.min(-6, thresh + 10);
                        compHigh.ratio.value = Math.min(4.0, ratio);
                        compHigh.attack.value = 0.0005;
                        compHigh.release.value = 0.09;
                        deEssGain.gain.value = window.dbToLinear(Math.min(12, deEssDb));
                    } else {
                        deEssGain.gain.value = 1.0;
                    }

                    compLow.connect(postBus);
                    compMid.connect(midPhaseNode); midPhaseNode.connect(postBus);
                    compHigh.connect(deEssGain); deEssGain.connect(postBus);
                }
                currentNode = postBus;
            } else {
                let comp = offlineCtx.createDynamicsCompressor();
                comp.threshold.value = thresh; comp.knee.value = knee; comp.ratio.value = ratio;
                comp.attack.value = (cfg.limiterSettings.attack || 26) / 1000;
                comp.release.value = (cfg.limiterSettings.release || 60) / 1000;
                currentNode.connect(comp);
                currentNode = comp;
            }
        }

        if (typeof window.insertProStudioPostChain === 'function') {
            currentNode = window.insertProStudioPostChain(offlineCtx, currentNode, cfg, offlineBucket, sourceBuffer);
        }

        currentNode.connect(offlineCtx.destination);
        sourceNode.start(0);

        let renderedBuffer = await offlineCtx.startRendering();
        let revExportPkg = null;

        let dspDna = (typeof window.captureExportDspDnaV76 === 'function')
            ? window.captureExportDspDnaV76(sourceBuffer, renderedBuffer, cfg)
            : null;
        if (isJbuf && Math.abs(speed - 1.0) > 0.002 && typeof window.buildElasticHoseBufferV46 === 'function') {
            let tensionPct = (cfg.hoseTensionPct !== undefined) ? cfg.hoseTensionPct : 100;
            if (typeof window.buildReversibleExportDataV67 === 'function') {
                revExportPkg = window.buildReversibleExportDataV67(renderedBuffer, speed, tensionPct, gearKey, isRev, dspDna);
            }
            renderedBuffer = window.buildElasticHoseBufferV46(renderedBuffer, speed, tensionPct);
        } else if (typeof window.buildReversibleExportDataV67 === 'function') {
            revExportPkg = window.buildReversibleExportDataV67(renderedBuffer, speed, 100, gearKey, isRev, dspDna);
        }

        let wavBlob = bufferToWav(renderedBuffer, renderedBuffer.length);

        let formData = new FormData();
        formData.append('audio_data', wavBlob, 'export.wav');
        formData.append('filename', window.currentPlayingTrack);
        formData.append('speed', speed);
        formData.append('is_reversed', isRev ? 'true' : 'false');
        formData.append('pitch_lock', pitchLock ? 'true' : 'false');
        formData.append('engine_mode', engineMode);
        formData.append('gear_key', gearKey);
        formData.append('pocket_bitrate', (window.appConfig && window.appConfig.pocketBitrateV77) || '48k');
        formData.append('sample_rate_mode', (window.appConfig && window.appConfig.exportSampleRateV86) || 'orig');
        formData.append('bit_depth_mode', (window.appConfig && window.appConfig.exportBitDepthV157) || 'orig');
        const kInp = document.getElementById('inpPocketKeyV78');
        if (kInp && kInp.value.trim()) formData.append('pocket_key', kInp.value.trim());
        if (revExportPkg && revExportPkg.seamMapJson) {
            formData.append('seam_map_json', revExportPkg.seamMapJson);
        }
        if (revExportPkg && revExportPkg.pocketWavBlob) {
            formData.append('pocket_audio', revExportPkg.pocketWavBlob, 'pocket.wav');
        }

        let res = await fetch('/api/export', { method: 'POST', body: formData });
        let json = await res.json();

        if (res.ok && json.status === 'ok') {
            if (typeof window.fetchData === 'function') window.fetchData();
            if (typeof window.showToast === 'function') {
                window.showToast("✅ Сохранено: " + json.new_file + (json.rev_badge ? " " + json.rev_badge : ""));
            }
        } else {
            throw new Error(json.error || "Ошибка кодирования в OPUS");
        }
    } catch (e) {
        if (typeof window.showToast === 'function') {
            window.showToast("❌ " + (e.message || e));
        }
    }

    if (btn) btn.innerHTML = oldBtnHtml || "💾";
};

function bufferToWav(abuffer, len) {
    let numOfChan = abuffer.numberOfChannels,
        length = len * numOfChan * 2 + 44,
        buffer = new ArrayBuffer(length),
        view = new DataView(buffer),
        channels = [], i, sample,
        offset = 0,
        pos = 0;

    function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
    function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }

    setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157);
    setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan);
    setUint32(abuffer.sampleRate); setUint32(abuffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2); setUint16(16);
    setUint32(0x61746164); setUint32(length - pos - 4);

    for(i = 0; i < abuffer.numberOfChannels; i++) channels.push(abuffer.getChannelData(i));

    while(pos < length) {
        for(i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0;
            view.setInt16(pos, sample, true); pos += 2;
        }
        offset++;
    }
    return new Blob([buffer], {type: "audio/wav"});
}


// 🎛️ ПАТЧ V69.1: СТРОГИЙ СПИСОК ЗВУКОВЫХ DSP-ЭФФЕКТОВ В 2 СТОЛБИКА (БЕЗ ТЕМ И UI-НАСТРОЕК)

window.DSP_EXPORT_EFFECTS_V69 = [
    { key: 'opt_autoCeiling',  domId: 'chk_autoCeiling',  label: '🛡️ Авто-Мастер-Потолок' },
    { key: 'opt_cleanFir',     domId: 'chk_cleanFir',     label: '✨ Драйв Чистый FIR (dB)' },
    { key: 'opt_midPhase',     domId: 'chk_midPhase',     label: '🎯 Фаза СЧ Вокал (dB)' },
    { key: 'opt_midQ',         domId: 'chk_midQ',         label: '📐 Ширина СЧ купола (%)' },
    { key: 'opt_deEsser',      domId: 'chk_deEsser',      label: '🐍 Де-эссер ВЧ (dB)' },
    { key: 'opt_autoRms',      domId: 'chk_autoRms',      label: '⚡ Авто-RMS Цель (dB)' },
    { key: 'opt_subMono',      domId: 'chk_subMono',      label: '🧲 Моно-Саббас (Hz)' },
    { key: 'opt_stereoWidth',  domId: 'chk_stereoWidth',  label: '🎭 Стерео-Ширина (%)' },
    { key: 'opt_punch',        domId: 'chk_punch',        label: '🥁 Панч-Хлыст (dB)' },
    { key: 'opt_binaural',     domId: 'chk_binaural',     label: '🎧 Бинаурал-Колонки (%)' },
    { key: 'firEnabled',       domId: 'firToggle',        label: '✨ FIR Сатуратор (Импульс)' },
    { key: 'eqEnabled',        domId: 'eqToggle',         label: '🎚️ Эквалайзер (5 полос)' },
    { key: 'limiterEnabled',   domId: 'limiterToggle',    label: '🛡️ Лимитер / Компрессор' },
    { key: 'multiBandEnabled', domId: 'multiBandToggle',  label: '🎛️ 3-полосный кроссовер (Разделение частот)' },
    { key: 'phaseFixEnabled',  domId: 'phaseFixToggle',   label: '🎯 Фазовый фокус (Выравнивание вокала 3D)' }
];

window.getGearboxSummaryV69 = function() {
    const cfg = window.appConfig || {};
    const gearKey = cfg.gearKeyV66 || 'jbuf-lock';
    const gearNames = {
        'jbuf-lock':  '1-я: ⚡ JBUF 90° [PITCH LOCK]',
        'jbuf-shift': '2-я: 📐 JBUF [PITCH SHIFT]',
        'web-lock':   '3-я: 🌐 Web API [PITCH LOCK]',
        'web-shift':  '4-я: 🌐 Web API [PITCH SHIFT]',
        'vinyl-shift': 'R: 💿 ВИНИЛ [PITCH SHIFT]'
    };
    const spd = (typeof window.getActiveTargetSpeedV59 === 'function')
        ? window.getActiveTargetSpeedV59()
        : 1.0;
    const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
    return `⚙️ РКПП: ${gearNames[gearKey] || gearKey} | x${Number(spd).toFixed(2)}${isRev ? ' (⏪ REV)' : ''}`;
};

window.collectDspCheckboxesV69 = function() {
    const cfg = window.appConfig || {};
    return window.DSP_EXPORT_EFFECTS_V69.map(def => {
        const el = document.getElementById(def.domId);
        const isLive = el ? Boolean(el.checked) : Boolean(cfg[def.key]);
        return {
            key: def.key,
            el: el,
            label: def.label,
            liveChecked: isLive,
            modalChecked: isLive
        };
    });
};

window.ensureExportModalV69 = function() {
    let modal = document.getElementById('exportModalV69');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'exportModalV69';
    modal.className = 'exp-modal-backdrop-v69';
    modal.onclick = (e) => {
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
            <div style="padding:8px 10px;background:#090d14;border-bottom:1px solid #21262d;display:flex;flex-direction:column;gap:6px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:11px;color:#3fb950;font-weight:bold;">🧬 Режим сжатия (Трек + Бэкап):</span>
                    <span id="lblActiveBrV79" style="font-size:10.5px;color:#58a6ff;font-weight:bold;">48k (Сжатие x2.7)</span>
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
                    <button type="button" data-br="xflac_ultra" onclick="window.selectExportBitrateV79('xflac_ultra')" style="padding:6px 2px;font-size:9.5px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#ff7b72;font-weight:bold;">🔥 XFLAC 15 (~9%)</button>
                    <button type="button" data-br="xflac_psycho" onclick="window.selectExportBitrateV79('xflac_psycho')" style="padding:6px 2px;font-size:9.5px;border-radius:6px;border:1px solid #3fb950;background:rgba(63,185,80,0.24);color:#fff;font-weight:bold;">🧬 XFLAC 25 (~12%)</button>
                    <button type="button" data-br="xflac_hifi" onclick="window.selectExportBitrateV79('xflac_hifi')" style="padding:6px 2px;font-size:9.5px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#d2a8ff;font-weight:bold;">✨ XFLAC 45 (~16%)</button>
                    <button type="button" data-br="xflac_lossless" onclick="window.selectExportBitrateV79('xflac_lossless')" style="padding:6px 2px;font-size:9.5px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#58a6ff;font-weight:bold;">💎 XFLAC 1:1</button>
                    <button type="button" data-br="wav_pcm" onclick="window.selectExportBitrateV79('wav_pcm')" style="grid-column:span 4;padding:5px 4px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#e3b341;font-weight:bold;">💿 Распаковать / Сохранить в чистый .WAV (PCM 1:1 без потерь)</button>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
                    <span style="font-size:11px;color:#58a6ff;font-weight:bold;">🎛️ Частота дискретизации (Sample Rate):</span>
                </div>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;" id="srBtnGroupV86">
                    <button type="button" data-sr="orig" onclick="window.selectExportSampleRateV86('orig')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #3fb950;background:rgba(63,185,80,0.24);color:#fff;font-weight:bold;">🎯 Родная (из файла)</button>
                    <button type="button" data-sr="44100" onclick="window.selectExportSampleRateV86('44100')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">💿 44100 Hz</button>
                    <button type="button" data-sr="48000" onclick="window.selectExportSampleRateV86('48000')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">⚡ 48000 Hz</button>
                    <button type="button" data-sr="88200" onclick="window.selectExportSampleRateV86('88200')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">💎 88200 Hz</button>
                    <button type="button" data-sr="96000" onclick="window.selectExportSampleRateV86('96000')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">🔥 96000 Hz</button>
                    <button type="button" data-sr="192000" onclick="window.selectExportSampleRateV86('192000')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">👑 192000 Hz</button>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
                    <span style="font-size:11px;color:#3fb950;font-weight:bold;">🎚️ Битовая глубина (Bit Depth):</span>
                </div>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;" id="bdBtnGroupV157">
                    <button type="button" data-bd="orig" onclick="window.selectExportBitDepthV157('orig')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #3fb950;background:rgba(63,185,80,0.24);color:#fff;font-weight:bold;">🎯 Родная</button>
                    <button type="button" data-bd="16" onclick="window.selectExportBitDepthV157('16')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">💿 16-bit</button>
                    <button type="button" data-bd="24" onclick="window.selectExportBitDepthV157('24')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">💎 24-bit</button>
                    <button type="button" data-bd="32" onclick="window.selectExportBitDepthV157('32')" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">👑 32-bit</button>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
                    <span style="font-size:11px;color:#d2a8ff;font-weight:bold;">⏩ Скорость упаковки:</span>
                </div>
                <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;" id="spdBtnGroupV79">
                    <button type="button" data-spd="0" onclick="window.selectExportSpeedV79(0)" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #58a6ff;background:rgba(88,166,255,0.18);color:#fff;">Тек.</button>
                    <button type="button" data-spd="1.5" onclick="window.selectExportSpeedV79(1.5)" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">x1.5</button>
                    <button type="button" data-spd="2" onclick="window.selectExportSpeedV79(2)" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">x2.0</button>
                    <button type="button" data-spd="10" onclick="window.selectExportSpeedV79(10)" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">x10</button>
                    <button type="button" data-spd="100" onclick="window.selectExportSpeedV79(100)" style="padding:5px 2px;font-size:10px;border-radius:6px;border:1px solid #30363d;background:#161b22;color:#8b949e;">x100</button>
                </div>
                <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
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
    return modal;
};

window.exportCurrentTrack = function() {
    if (!window.currentPlayingTrack) {
        if (typeof window.showToast === 'function') window.showToast("⚠️ Сначала выбери трек!");
        return;
    }

    const modal = window.ensureExportModalV69();
    const banner = document.getElementById('expGearboxBannerV69');
    

    const grid = document.getElementById('expModalGridV69');
    const confirmBtn = document.getElementById('btnExpConfirmRunV69');
    const applyCurBtn = document.getElementById('btnExpApplyCurrentV69');
    const clearAllBtn = document.getElementById('btnExpClearAllV69');

    const items = window.collectDspCheckboxesV69();

    const renderGrid = () => {
        grid.innerHTML = '';
        let activeCount = 0;
        items.forEach(item => {
            if (item.modalChecked) activeCount++;
            const card = document.createElement('div');
            card.className = 'exp-chk-card-v69' + (item.modalChecked ? ' active-card-v69' : '');

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = item.modalChecked;

            const lbl = document.createElement('span');
            lbl.className = 'exp-chk-label-v69';
            lbl.textContent = item.label;

            card.appendChild(chk);
            card.appendChild(lbl);

            card.onclick = (e) => {
                e.stopPropagation();
                item.modalChecked = !item.modalChecked;
                renderGrid();
            };

            grid.appendChild(card);
        });
        confirmBtn.textContent = `💾 Экспорт (${activeCount})`;
        if (typeof window.updateExportConfirmBtnLabelV79 === 'function') window.updateExportConfirmBtnLabelV79();
    };

    applyCurBtn.onclick = (e) => {
        e.stopPropagation();
        const cfg = window.appConfig || {};
        items.forEach(it => {
            it.liveChecked = it.el ? Boolean(it.el.checked) : Boolean(cfg[it.key]);
            it.modalChecked = it.liveChecked;
        });
        renderGrid();
    };

    clearAllBtn.onclick = (e) => {
        e.stopPropagation();
        items.forEach(it => {
            it.modalChecked = false;
        });
        renderGrid();
    };

    confirmBtn.onclick = async (e) => {
        e.stopPropagation();
        modal.style.display = 'none';

        const cfg = window.appConfig || {};
        const savedCfgValues = {};
        const savedDomStates = [];

        items.forEach(it => {
            if (it.el) {
                savedDomStates.push({ el: it.el, checked: it.el.checked });
                it.el.checked = it.modalChecked;
            }
            savedCfgValues[it.key] = cfg[it.key];
            cfg[it.key] = it.modalChecked;
        });

        try {
            await window.executeTrackExportV69();
        } finally {
            savedDomStates.forEach(s => { s.el.checked = s.checked; });
            Object.keys(savedCfgValues).forEach(k => { cfg[k] = savedCfgValues[k]; });
        }
    };

    renderGrid();
    if (typeof window.selectExportBitrateV79 === 'function') window.selectExportBitrateV79((window.appConfig && window.appConfig.pocketBitrateV77) || 'xflac_psycho');
    if (typeof window.selectExportSampleRateV86 === 'function') window.selectExportSampleRateV86((window.appConfig && window.appConfig.exportSampleRateV86) || 'orig');
    if (typeof window.selectExportBitDepthV157 === 'function') window.selectExportBitDepthV157((window.appConfig && window.appConfig.exportBitDepthV157) || 'orig');
    if (typeof window.selectExportSpeedV79 === 'function') window.selectExportSpeedV79(window._forcedExportSpeedV79 || 0);
    modal.style.display = 'flex';
};


// === V79.1 EXPORT BUTTON HANDLERS ===
window._forcedExportSpeedV79 = window._forcedExportSpeedV79 || 0;

window.updateExportConfirmBtnLabelV79 = function() {
    const confirmBtn = document.getElementById('btnExpConfirmRunV69');
    if (!confirmBtn) return;
    const activeCards = document.querySelectorAll('#expModalGridV69 .exp-chk-card-v69.active-card-v69').length;
    const br = (window.appConfig && window.appConfig.pocketBitrateV77) || '48k';
    const spd = parseFloat(window._forcedExportSpeedV79 || 0);
    const spdTxt = spd > 0 ? `x${spd}` : 'Тек.';
    confirmBtn.textContent = `💾 Экспорт (${activeCards}) • ${br} • ${spdTxt}`;
};

window.selectExportBitrateV79 = function(br) {
    window.appConfig = window.appConfig || {};
    window.appConfig.pocketBitrateV77 = br;
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    const names = {
        '16k': '16k (Фантом x8)',
        '24k': '24k (Сжатие x5.5)',
        '48k': '48k (Сжатие x2.7)',
        '96k': '96k (Hi-Fi Оптимум)',
        '128k': '128k (Студийный)',
        '192k': '192k (Мастер)',
        '256k': '256k (Ультра)',
        'orig': '🎯 OPUS Авто (Сжатие в .opus под битрейт исходника)',
        'xflac_ultra': '🔥 XFLAC Ultra (Gate 15 • ~8-9% от WAV)',
        'xflac_psycho': '🧬 XFLAC Psycho (Gate 25 • ~11-13% от WAV)',
        'xflac_hifi': '✨ XFLAC Hi-Fi (Gate 45 • ~15-16% от WAV)',
        'xflac_lossless': '💎 XFLAC BitPerfect (100% WAV 1:1 без потерь)',
        'wav_pcm': '💿 Чистый WAV (Распаковка XFLAC -> WAV 1:1)'
    };
    const lbl = document.getElementById('lblActiveBrV79');
    if (lbl) lbl.innerText = names[br] || br;
    document.querySelectorAll('#brBtnGroupV79 button').forEach(b => {
        const act = (b.getAttribute('data-br') === br);
        b.style.borderColor = act ? '#3fb950' : '#30363d';
        b.style.background = act ? 'rgba(63, 185, 80, 0.28)' : '#161b22';
        b.style.color = act ? '#ffffff' : '#8b949e';
        b.style.boxShadow = act ? '0 0 10px rgba(63, 185, 80, 0.45)' : 'none';
    });
    window.updateExportConfirmBtnLabelV79();
};

window.selectExportSpeedV79 = function(spd) {
    window._forcedExportSpeedV79 = parseFloat(spd) || 0;
    document.querySelectorAll('#spdBtnGroupV79 button').forEach(b => {
        const act = (Math.abs((parseFloat(b.getAttribute('data-spd')) || 0) - window._forcedExportSpeedV79) < 0.01);
        b.style.borderColor = act ? '#58a6ff' : '#30363d';
        b.style.background = act ? 'rgba(88, 166, 255, 0.28)' : '#161b22';
        b.style.color = act ? '#ffffff' : '#8b949e';
        b.style.boxShadow = act ? '0 0 10px rgba(88, 166, 255, 0.45)' : 'none';
    });
    window.updateExportConfirmBtnLabelV79();
};


window.selectExportSampleRateV86 = function(sr) {
    window.appConfig = window.appConfig || {};
    window.appConfig.exportSampleRateV86 = sr;
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    document.querySelectorAll('#srBtnGroupV86 button').forEach(b => {
        const act = (b.getAttribute('data-sr') === sr);
        b.style.borderColor = act ? '#3fb950' : '#30363d';
        b.style.background = act ? 'rgba(63, 185, 80, 0.24)' : '#161b22';
        b.style.color = act ? '#ffffff' : '#8b949e';
        b.style.fontWeight = act ? 'bold' : 'normal';
    });
};

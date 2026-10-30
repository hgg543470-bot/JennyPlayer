window.exportCurrentTrack = async function() {
    if (!window.currentPlayingTrack) {
        if (typeof window.showToast === 'function') window.showToast("⚠️ Сначала выбери трек!");
        return;
    }

    const btn = document.getElementById('btnExport');
    const oldBtnHtml = btn ? btn.innerHTML : "";
    if (btn) btn.innerText = "⏳";
    if (typeof window.showToast === 'function') window.showToast("⏳ Рендеринг в OPUS...");

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

        let engineMode = cfg.engineModeV62 || (cfg.elasticHoseMode ? 'jbuf' : (cfg.pitchLock ? 'webapi' : 'vinyl'));
        let gearKey = cfg.gearKeyV66 || 'jbuf-lock';
        let isJbuf = (gearKey === 'jbuf-lock');
        let isWebApiPitch = (gearKey === 'web-lock');
        let pitchLock = (isJbuf || isWebApiPitch);

        // Если текущий трек уже содержит восстановленный 1.0x оригинал в RAM и скорость изменена — берём чистый 1.0x исходник!
        let hasRevMaster = Boolean(
            window.reconstructedMasterBufferV67 &&
            window.currentTrackRevMapV67 &&
            window.currentTrackRevNameV67 === window.currentPlayingTrack &&
            Math.abs(userSpeed - 1.0) > 0.002
        );

        let speed = hasRevMaster
            ? Math.max(0.25, Math.min(3.0, (parseFloat(window.currentTrackRevMapV67.spd) || 1.0) * userSpeed))
            : userSpeed;

        let sourceBuffer = hasRevMaster ? window.reconstructedMasterBufferV67 : window.studioBuffer;
        if (!sourceBuffer) {
            let res = await fetch('/api/media/' + encodeURIComponent(window.currentPlayingTrack));
            if (!res.ok) throw new Error("Не удалось загрузить исходник трека");
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
        preAmp.gain.value = 0.6;
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

        if (isJbuf && Math.abs(speed - 1.0) > 0.002 && typeof window.buildElasticHoseBufferV46 === 'function') {
            let tensionPct = (cfg.hoseTensionPct !== undefined) ? cfg.hoseTensionPct : 100;
            if (typeof window.buildReversibleExportDataV67 === 'function') {
                revExportPkg = window.buildReversibleExportDataV67(renderedBuffer, speed, tensionPct, gearKey, isRev);
            }
            renderedBuffer = window.buildElasticHoseBufferV46(renderedBuffer, speed, tensionPct);
        } else if (typeof window.buildReversibleExportDataV67 === 'function' && Math.abs(speed - 1.0) > 0.002) {
            revExportPkg = window.buildReversibleExportDataV67(sourceBuffer, speed, 100, gearKey, isRev);
        }

        let wavBlob = bufferToWav(renderedBuffer, renderedBuffer.length);

        let formData = new FormData();
        formData.append('audio_data', wavBlob, 'export.wav');
        formData.append('filename', window.currentPlayingTrack);
        formData.append('speed', speed);
        formData.append('is_reversed', isRev ? 'true' : 'false');
        formData.append('pitch_lock', pitchLock ? 'true' : 'false');
        formData.append('engine_mode', engineMode);
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

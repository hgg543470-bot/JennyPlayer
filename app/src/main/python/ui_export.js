// =========================================================================
// 💾 UI_EXPORT.JS (ОФФЛАЙН-РЕНДЕРИНГ И ЭКСПОРТ ТРЕКОВ)
// =========================================================================

window.exportCurrentTrack = async function() {
    if (!window.currentPlayingTrack) return;

    const btn = document.getElementById('btnExport');
    if (btn) btn.innerText = "⏳";

    try {
        const player = document.getElementById('audioPlayer');
        let speed = window.scrubState && window.scrubState.active ? window.scrubState.speed : (player.playbackRate || 1.0);
        let isRev = window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed);
        
        let pitchLockCheckbox = document.getElementById('cfg_pitchLock');
        let pitchLock = pitchLockCheckbox ? pitchLockCheckbox.checked : false;

        let sourceBuffer = window.studioBuffer;
        
        if (!sourceBuffer) {
            let res = await fetch('/api/media/' + encodeURIComponent(window.currentPlayingTrack));
            let arrayBuffer = await res.arrayBuffer();
            sourceBuffer = await window.audioCtx.decodeAudioData(arrayBuffer);
        }
        
        if (isRev && !window.reversedStudioBuffer) {
            sourceBuffer = await window.cloneAndReverseBuffer(sourceBuffer);
        } else if (isRev) {
            sourceBuffer = window.reversedStudioBuffer;
        }

        if (pitchLock && speed !== 1.0 && !isRev) {
            let stretchFormData = new FormData();
            stretchFormData.append('filename', window.currentPlayingTrack);
            stretchFormData.append('speed', speed);
            
            let stretchRes = await fetch('/api/stretch', { method: 'POST', body: stretchFormData });
            if (!stretchRes.ok) throw new Error("Питон не смог растянуть трек");
            
            let stretchedArrayBuffer = await stretchRes.arrayBuffer();
            sourceBuffer = await window.audioCtx.decodeAudioData(stretchedArrayBuffer);
        }

        let renderSpeed = (pitchLock && !isRev) ? 1.0 : speed;
        let duration = sourceBuffer.duration / renderSpeed;
        
        let offlineCtx = new OfflineAudioContext(sourceBuffer.numberOfChannels, Math.ceil(duration * sourceBuffer.sampleRate), sourceBuffer.sampleRate);
        let sourceNode = offlineCtx.createBufferSource();
        sourceNode.buffer = sourceBuffer;
        sourceNode.playbackRate.value = renderSpeed;
        
        let currentNode = sourceNode;
        let cfg = window.appConfig || {};

        // 1. PreAmp (как в engine_audio.js)
        let preAmp = offlineCtx.createGain();
        preAmp.gain.value = 0.6;
        currentNode.connect(preAmp);
        currentNode = preAmp;

        // 2. FIR-сатуратор (идет ДО эквалайзера, строго как в живом графе)
        if (cfg.firEnabled && cfg.firSettings) {
            let preFirPad = offlineCtx.createGain();
            preFirPad.gain.value = 0.8;
            currentNode.connect(preFirPad);
            currentNode = preFirPad;

            let firNode = offlineCtx.createConvolver();
            firNode.normalize = false;
            
            let decay = cfg.firSettings.decay;
            let length = Math.floor(offlineCtx.sampleRate * (decay / 1000));
            if(length === 0) length = 1;
            let impulse = offlineCtx.createBuffer(2, length, offlineCtx.sampleRate);
            for (let c = 0; c < 2; c++) {
                let data = impulse.getChannelData(c);
                for (let i = 0; i < length; i++) {
                    data[i] = (i === 0) ? 1.0 : Math.exp(-i / (length/3)) * 0.05; 
                }
            }
            firNode.buffer = impulse;
            
            let firGain = offlineCtx.createGain();
            firGain.gain.value = cfg.firSettings.gain;

            currentNode.connect(firNode);
            firNode.connect(firGain);
            currentNode = firGain;
        }

        // 3. Эквалайзер (EQ IIR)
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

        // 4. Громкость и Бустер (берем реальный гейн из живого графа или конфига)
        let gainNode = offlineCtx.createGain();
        let activeVol = (window.gainNode && window.gainNode.gain) ? window.gainNode.gain.value : ((parseInt(cfg.defaultVolume, 10) || 10) / 10);
        gainNode.gain.value = activeVol;
        currentNode.connect(gainNode);
        currentNode = gainNode;

        // 5. Лимитер и 3-полосный кроссовер
        if (cfg.limiterEnabled && cfg.limiterSettings) {
            let thresh = cfg.limiterSettings.threshold;
            let knee = cfg.limiterSettings.knee;
            let ratio = cfg.limiterSettings.ratio;
            let atk = cfg.limiterSettings.attack / 1000;
            let rel = cfg.limiterSettings.release / 1000;

            if (cfg.multiBandEnabled && cfg.multiBandSettings) {
                let lowFreq = Math.max(20, cfg.multiBandSettings.low || 200);
                let highFreq = Math.max(lowFreq + 100, cfg.multiBandSettings.high || 2500);
                let midCenter = Math.sqrt(lowFreq * highFreq);
                let midQ = midCenter / (highFreq - lowFreq);

                let splitLow = offlineCtx.createBiquadFilter(); splitLow.type = 'lowpass'; splitLow.frequency.value = lowFreq;
                let splitMid = offlineCtx.createBiquadFilter(); splitMid.type = 'bandpass'; splitMid.frequency.value = midCenter; splitMid.Q.value = midQ;
                let splitHigh = offlineCtx.createBiquadFilter(); splitHigh.type = 'highpass'; splitHigh.frequency.value = highFreq;

                let compLow = offlineCtx.createDynamicsCompressor();
                compLow.threshold.value = thresh; compLow.knee.value = knee; compLow.ratio.value = ratio;
                compLow.attack.value = atk; compLow.release.value = rel;

                let compMid = offlineCtx.createDynamicsCompressor();
                compMid.threshold.value = thresh + 2; compMid.knee.value = knee; compMid.ratio.value = ratio;
                compMid.attack.value = 0.002; compMid.release.value = 0.1;

                let compHigh = offlineCtx.createDynamicsCompressor();
                compHigh.threshold.value = thresh + 4; compHigh.knee.value = knee; compHigh.ratio.value = ratio;
                compHigh.attack.value = 0.001; compHigh.release.value = 0.05;

                currentNode.connect(splitLow); currentNode.connect(splitMid); currentNode.connect(splitHigh);
                splitLow.connect(compLow); splitMid.connect(compMid); splitHigh.connect(compHigh);

                compLow.connect(offlineCtx.destination);
                compMid.connect(offlineCtx.destination);
                compHigh.connect(offlineCtx.destination);
            } else {
                let comp = offlineCtx.createDynamicsCompressor();
                comp.threshold.value = thresh; comp.knee.value = knee; comp.ratio.value = ratio;
                comp.attack.value = atk; comp.release.value = rel;
                currentNode.connect(comp);
                comp.connect(offlineCtx.destination);
            }
        } else {
            currentNode.connect(offlineCtx.destination);
        }

        sourceNode.start(0);

        let renderedBuffer = await offlineCtx.startRendering();
        let wavBlob = bufferToWav(renderedBuffer, renderedBuffer.length);

        let formData = new FormData();
        formData.append('audio_data', wavBlob, 'export.wav');
        formData.append('filename', window.currentPlayingTrack);
        formData.append('speed', speed);
        formData.append('is_reversed', isRev ? 'true' : 'false');
        formData.append('pitch_lock', pitchLock ? 'true' : 'false');

        let res = await fetch('/api/export', { method: 'POST', body: formData });
        let json = await res.json();

        if (json.status === 'ok') {
            if (typeof window.fetchData === 'function') window.fetchData(); 
        }
    } catch (e) {}

    if (btn) btn.innerText = "💾";
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
        offset++
    }
    return new Blob([buffer], {type: "audio/wav"});
}

/* ============================================================================
 * ui_revisor.js — Лаборатория: компенсация DSP и ревизор (V76), спектральный слепок и ресинтез (V78)
 *
 * Склейка:  /bundle_1_studio.js, модуль 12 из 12. Порядок модулей задан в player.py и менять его нельзя:
 *           поздние модули переопределяют и оборачивают функции ранних.
 * Внутри:   measureBufferStatsV76, captureExportDspDnaV76, buildFallbackDspDnaFromConfigV76, applyInverseDspCompensationV76, formatDnaCompensationReportV76, runRevisorComparisonV76, playRevisorSliceV76, onToggleAntiDspV76, captureSpectralBlueprintV78, runDeepSpectralResynthesisV78
 * Откуда:   ui_help.js (коммит 9ae6639), строки 5780–6400. Код блоков перенесён без правок.
 * Подробно: FILES.md (карта файлов), REFACTOR_PLAN.md (как резалось и что перекрыто).
 * ============================================================================ */



// === JENNY V76 ANTI-DSP COMPENSATOR & REVISOR LAB ===
window.antiDspEnabledV76 = true;
window.bypassLiveDspOnRev1xV76 = true;

window.measureBufferStatsV76 = function(buf) {
    if (!buf) return { rms: 0.1, peak: 0.5, midRms: 0.1, sideRms: 0.05 };
    const ch0 = buf.getChannelData(0);
    const ch1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : ch0;
    const len = ch0.length;
    const step = Math.max(1, Math.floor(len / 50000));
    let sumSq = 0, midSq = 0, sideSq = 0, peak = 0, cnt = 0;
    for (let i = 0; i < len; i += step) {
        const l = ch0[i], r = ch1[i];
        const a = Math.max(Math.abs(l), Math.abs(r));
        if (a > peak) peak = a;
        if (l === 0 && r === 0) continue;
        const m = 0.5 * (l + r), s = 0.5 * (l - r);
        sumSq += 0.5 * (l * l + r * r);
        midSq += m * m;
        sideSq += s * s;
        cnt++;
    }
    cnt = Math.max(1, cnt);
    return {
        rms: Math.sqrt(sumSq / cnt),
        peak: Math.max(0.001, peak),
        midRms: Math.sqrt(midSq / cnt),
        sideRms: Math.sqrt(sideSq / cnt)
    };
};

window.captureExportDspDnaV76 = function(srcBuf, renderedBuf, cfg) {
    const pre = window.measureBufferStatsV76(srcBuf);
    const post = window.measureBufferStatsV76(renderedBuf);
    const eqGains = [60, 230, 910, 3600, 14000].map(f => {
        const n = window.eqNodes && window.eqNodes['band' + f];
        return n ? parseFloat(n.gain.value) || 0 : 0;
    });
    const activeVol = (window.gainNode && window.gainNode.gain) ? window.gainNode.gain.value : ((parseInt(cfg.defaultVolume, 10) || 10) / 10);
    const padDb = (typeof window.calculateAutoMasterPadDb === 'function') ? window.calculateAutoMasterPadDb(cfg) : -0.5;
    return {
        v: 76,
        origRms: Number(pre.rms.toFixed(6)),
        origPeak: Number(pre.peak.toFixed(6)),
        origMidRms: Number(pre.midRms.toFixed(6)),
        origSideRms: Number(pre.sideRms.toFixed(6)),
        postRms: Number(post.rms.toFixed(6)),
        postPeak: Number(post.peak.toFixed(6)),
        postMidRms: Number(post.midRms.toFixed(6)),
        postSideRms: Number(post.sideRms.toFixed(6)),
        preAmp: 0.6,
        activeVol: Number(activeVol.toFixed(3)),
        firEnabled: Boolean(cfg.firEnabled),
        firGain: parseFloat(cfg.firSettings?.gain) || 1.5,
        firDecay: parseFloat(cfg.firSettings?.decay) || 1.28,
        opt_cleanFir: Boolean(cfg.opt_cleanFir),
        val_cleanFir: parseFloat(cfg.val_cleanFir) || 3.0,
        eqEnabled: Boolean(cfg.eqEnabled),
        eqGains: eqGains,
        opt_autoRms: Boolean(cfg.opt_autoRms),
        val_autoRms: parseFloat(cfg.val_autoRms) || -6.0,
        opt_monoBass: Boolean(cfg.opt_monoBass),
        val_monoBass: parseFloat(cfg.val_monoBass) || 79,
        limiterEnabled: Boolean(cfg.limiterEnabled),
        multiBandEnabled: Boolean(cfg.multiBandEnabled),
        mbLow: parseFloat(cfg.multiBandSettings?.low) || 160,
        mbHigh: parseFloat(cfg.multiBandSettings?.high) || 2528,
        opt_midPhase: Boolean(cfg.opt_midPhase),
        val_midPhase: parseFloat(cfg.val_midPhase) || 4.0,
        opt_deEsser: Boolean(cfg.opt_deEsser),
        val_deEsser: parseFloat(cfg.val_deEsser) || -2.0,
        opt_punch: Boolean(cfg.opt_punch),
        val_punch: parseFloat(cfg.val_punch) || -1.0,
        opt_msWidth: Boolean(cfg.opt_msWidth),
        val_msWidth: parseFloat(cfg.val_msWidth) || 130,
        opt_masterCeil: Boolean(cfg.opt_masterCeil || cfg.phaseFixEnabled),
        padDb: Number(padDb.toFixed(2))
    };
};

window.buildFallbackDspDnaFromConfigV76 = function() {
    const cfg = window.appConfig || {};
    return window.captureExportDspDnaV76(null, null, cfg);
};

window.applyInverseDspCompensationV76 = async function(rawReconstructedBuf, smap, forceFullOffline) {
    if (!rawReconstructedBuf || !window.audioCtx || !window.antiDspEnabledV76) return rawReconstructedBuf;
    const isHugeBuf = (rawReconstructedBuf.duration > 360) && !forceFullOffline;
    const dna = (smap && smap.dspDna) ? smap.dspDna : window.buildFallbackDspDnaFromConfigV76();
    if (!dna) return rawReconstructedBuf;

    const sr = rawReconstructedBuf.sampleRate;
    const numCh = rawReconstructedBuf.numberOfChannels;
    const len = rawReconstructedBuf.length;
    const workBuf = window.audioCtx.createBuffer(numCh, len, sr);

    // 1. Посэмпловая инверсия: обратный софт-клиппер (atanh) + возврат потолка padDb + возврат стерео-базы M/S
    const k = 1.25;
    const tanhK = Math.tanh(k);
    const invPad = dna.opt_masterCeil ? (1.0 / window.dbToLinear(dna.padDb || -0.5)) : 1.0;

    let midRatio = 1.0, sideRatio = 1.0;
    if (dna.origMidRms > 0.0005 && dna.postMidRms > 0.0005 && dna.origSideRms > 0.0001 && dna.postSideRms > 0.0001) {
        const origMS = dna.origSideRms / dna.origMidRms;
        const postMS = dna.postSideRms / dna.postMidRms;
        if (postMS > 0.01) {
            sideRatio = Math.max(0.35, Math.min(2.5, origMS / postMS));
        }
    } else if (dna.opt_msWidth) {
        const w = Math.max(0.1, (parseFloat(dna.val_msWidth) || 130) / 100.0);
        const fMid = (w <= 1.0) ? 1.0 : Math.max(0.72, 1.0 - (w - 1.0) * 0.12);
        const fSide = (w <= 1.0) ? w : (1.0 + (w - 1.0) * 0.85);
        sideRatio = fMid / Math.max(0.1, fSide);
    }

    const ch0In = rawReconstructedBuf.getChannelData(0);
    const ch1In = numCh > 1 ? rawReconstructedBuf.getChannelData(1) : ch0In;
    const ch0Out = workBuf.getChannelData(0);
    const ch1Out = numCh > 1 ? workBuf.getChannelData(1) : ch0Out;

    for (let i = 0; i < len; i++) {
        let l = ch0In[i], r = ch1In[i];
        if (dna.opt_masterCeil) {
            const nl = Math.max(-0.992, Math.min(0.992, (l / 0.98) * tanhK));
            const nr = Math.max(-0.992, Math.min(0.992, (r / 0.98) * tanhK));
            l = (0.5 * Math.log((1 + nl) / (1 - nl)) / k) * invPad;
            r = (0.5 * Math.log((1 + nr) / (1 - nr)) / k) * invPad;
        }
        if (numCh > 1) {
            const m = 0.5 * (l + r);
            const s = 0.5 * (l - r) * sideRatio;
            ch0Out[i] = m + s;
            ch1Out[i] = m - s;
        } else {
            ch0Out[i] = l;
        }
    }

    if (isHugeBuf) {
        const curStats = window.measureBufferStatsV76(workBuf);
        const targetRms = (dna.origRms && dna.origRms > 0.0005) ? dna.origRms : (curStats.rms * 0.75);
        const scale = (curStats.rms > 0.0001) ? Math.max(0.15, Math.min(6.0, targetRms / curStats.rms)) : 1.0;
        for (let c = 0; c < numCh; c++) {
            const d = workBuf.getChannelData(c);
            for (let i = 0; i < d.length; i++) d[i] = Math.max(-0.99, Math.min(0.99, d[i] * scale));
        }
        workBuf._antiDspAppliedV76 = true;
        workBuf._dspDnaV76 = dna;
        return workBuf;
    }
    // 2. Обратные частотные фильтры в OfflineAudioContext (Анти-Панч, Анти-EQ, Анти-СЧ, Анти-ДеЭссер, Анти-FIR)
    const offCtx = new OfflineAudioContext(numCh, len, sr);
    const src = offCtx.createBufferSource();
    src.buffer = workBuf;
    let cur = src;

    const addFilter = (type, freq, q, gainDb) => {
        if (Math.abs(gainDb) < 0.05) return;
        const f = offCtx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        if (q) f.Q.value = q;
        f.gain.value = Math.max(-24, Math.min(24, gainDb));
        cur.connect(f);
        cur = f;
    };

    // Инверсия бокового эксайтера Стерео-Ширины
    if (dna.opt_msWidth && (parseFloat(dna.val_msWidth) || 100) > 100) {
        const w = (parseFloat(dna.val_msWidth) || 130) / 100.0;
        const boostDb = Math.min(10, (w - 1.0) * 4.5);
        addFilter('peaking', 135, 0.9, -boostDb * 0.35);
        addFilter('highshelf', 8500, 0.7, -boostDb * 0.45);
    }

    // Инверсия 3-точечного Панч-Хлыста (ровно противоположные знаки!)
    if (dna.opt_punch) {
        const pDb = Math.max(-24, Math.min(24, parseFloat(dna.val_punch) || 0));
        addFilter('peaking', 85, 1.4, -pDb * 0.75);
        addFilter('peaking', 230, 1.1, +pDb * 0.35);
        addFilter('peaking', 2600, 1.0, -pDb * 0.95);
    }

    // Инверсия СЧ-купола вокала и ВЧ Де-эссера
    if (dna.limiterEnabled && dna.multiBandEnabled) {
        const lowF = Math.max(320, dna.mbLow || 160);
        const highF = Math.max(lowF + 200, dna.mbHigh || 2528);
        const midCenter = Math.sqrt(lowF * highF);
        if (dna.opt_midPhase) {
            addFilter('peaking', midCenter, 0.95, -(parseFloat(dna.val_midPhase) || 0) * 0.85);
        }
        if (dna.opt_deEsser) {
            addFilter('highshelf', highF, 0.7, -(parseFloat(dna.val_deEsser) || 0) * 0.85);
        }
    }

    // Инверсия 5-полосного эквалайзера
    if (dna.eqEnabled && Array.isArray(dna.eqGains)) {
        const freqs = [60, 230, 910, 3600, 14000];
        const types = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];
        freqs.forEach((fr, idx) => {
            addFilter(types[idx], fr, 1.0, -(parseFloat(dna.eqGains[idx]) || 0));
        });
    }

    // Инверсия окраса FIR-сатуратора
    if (dna.firEnabled && dna.opt_cleanFir) {
        const cfDb = parseFloat(dna.val_cleanFir) || 0;
        addFilter('lowshelf', 180, 0.7, -cfDb * 0.35);
    }

    cur.connect(offCtx.destination);
    src.start(0);
    const filteredBuf = await offCtx.startRendering();

    // 3. Точная калибровка итогового RMS под эталон исходника (dna.origRms)
    const curStats = window.measureBufferStatsV76(filteredBuf);
    const targetRms = (dna.origRms && dna.origRms > 0.0005) ? dna.origRms : (curStats.rms * 0.75);
    const scale = (curStats.rms > 0.0001) ? Math.max(0.15, Math.min(6.0, targetRms / curStats.rms)) : 1.0;

    for (let c = 0; c < numCh; c++) {
        const d = filteredBuf.getChannelData(c);
        for (let i = 0; i < d.length; i++) {
            d[i] = Math.max(-0.99, Math.min(0.99, d[i] * scale));
        }
    }
    filteredBuf._antiDspAppliedV76 = true;
    filteredBuf._dspDnaV76 = dna;
    return filteredBuf;
};


window.formatDnaCompensationReportV76 = function(smap) {
    if (!smap) return "Нет капсулы JENNYV67 в текущем треке.";
    const dna = smap.dspDna || window.buildFallbackDspDnaFromConfigV76();
    const spd = parseFloat(smap.spd) || 1.0;
    const invSpd = (1.0 / spd).toFixed(2);
    const lines = [
        `🧬 ПАСПОРТ КАПСУЛЫ JENNYV67 (${window.currentPlayingTrack || 'Трек'}):`,
        `• Скорость экспорта: x${spd.toFixed(2)} (${(smap.seams || []).length} швов) ➔ Встречная для 1.0x: x${invSpd}`,
        `• Статус слепка DSP: ${smap.dspDna ? '✅ Вшит в файл при экспорте (V76)' : '⚙️ Взят из текущего пресета (старый файл)'}`
    ];
    if (dna) {
        if (dna.origRms && dna.postRms) {
            const dRms = (20 * Math.log10(dna.postRms / Math.max(0.0001, dna.origRms))).toFixed(2);
            lines.push(`• Громкость (RMS): было ${(20*Math.log10(dna.origRms)).toFixed(1)} dB ➔ стало ${(20*Math.log10(dna.postRms)).toFixed(1)} dB (Δ ${dRms} dB) ➔ Компенсация: ${(-dRms).toFixed(2)} dB`);
        }
        if (dna.opt_punch) lines.push(`• 🥁 Панч-Хлыст: впечено ${dna.val_punch} dB ➔ Анти-Панч: ${(-dna.val_punch).toFixed(1)} dB (85/230/2600 Гц)`);
        if (dna.opt_msWidth) lines.push(`• 🎭 Стерео-Ширина: впечено ${dna.val_msWidth}% ➔ Инверсия M/S: ${(10000 / Math.max(20, dna.val_msWidth)).toFixed(0)}%`);
        if (dna.opt_midPhase) lines.push(`• 🎯 Фаза СЧ Вокал: впечено +${dna.val_midPhase} dB ➔ Анти-СЧ: -${dna.val_midPhase} dB`);
        if (dna.opt_deEsser) lines.push(`• 🐍 Де-эссер ВЧ: впечено ${dna.val_deEsser} dB ➔ Анти-ВЧ: ${(-dna.val_deEsser).toFixed(1)} dB`);
        if (dna.eqEnabled && dna.eqGains && dna.eqGains.some(g => g !== 0)) {
            lines.push(`• 🎚️ 5-Band EQ: [${dna.eqGains.join(', ')}] dB ➔ Анти-EQ: [${dna.eqGains.map(g => -g).join(', ')}] dB`);
        }
        if (dna.opt_masterCeil) lines.push(`• 🛡️ Мастер-Потолок: ${dna.padDb} dB + tanh ➔ Инверсия: atanh + ${(-dna.padDb).toFixed(2)} dB`);
    }
    return lines.join('\n');
};

window.runRevisorComparisonV76 = async function(saveToMp3Test) {
    const ta = document.getElementById('hoseDebugTextAreaV52');
    if (!window.currentPlayingTrack || !window.studioBuffer) {
        if (typeof window.showToast === 'function') window.showToast('⚠️ Сначала запусти экспортированный трек!');
        return;
    }
    let smap = window.currentTrackRevMapV67;
    if (!smap) {
        try {
            const r = await fetch('/api/rev_info/' + encodeURIComponent(window.currentPlayingTrack));
            const inf = await r.json();
            if (inf && inf.has_rev && inf.seam_map) {
                smap = inf.seam_map;
                window.currentTrackRevMapV67 = smap;
                window.currentTrackRevNameV67 = window.currentPlayingTrack;
                if (!window.reconstructedMasterBufferV67) window.reconstructedMasterBufferV67 = window.studioBuffer;
            }
        } catch (e) {}
    }
    if (!smap || !window.reconstructedMasterBufferV67) {
        if (typeof window.showToast === 'function') window.showToast('⚠️ Сейчас играет оригинал без капсулы! Нажми ▶ на экспортированном треке (_jbuf90).');
        return;
    }

    // Ищем оригинальный файл в списке треков
    const info = window.parseDerivedTrackInfo ? window.parseDerivedTrackInfo(window.currentPlayingTrack) : { baseStem: '' };
    const allTracks = (window.lastData && window.lastData.all_tracks) || [];
    const targetLower = (info.baseStem || '').toLowerCase();
    let origFile = allTracks.find(fn => {
        if (fn === window.currentPlayingTrack) return false;
        const p = window.parseDerivedTrackInfo ? window.parseDerivedTrackInfo(fn) : { origStem: fn, isDerived: false };
        return !p.isDerived && p.origStem.toLowerCase() === targetLower;
    });

    let rep = [window.formatDnaCompensationReportV76(smap)];
    const restBuf = window.reconstructedMasterBufferV67;
    const expBuf = window.studioBuffer;

    const startInp = document.getElementById('v59SliceStartSec');
    const durInp = document.getElementById('v59SliceDurMs');
    const sec = Math.max(0, parseFloat(startInp ? startInp.value : 15.0) || 15.0);
    const durMs = Math.max(100, parseFloat(durInp ? durInp.value : 1500) || 1500);
    const sr = restBuf.sampleRate;
    const sliceFrames = Math.min(restBuf.length - 64, Math.round((durMs / 1000) * sr));
    const startFrame = Math.min(Math.max(0, Math.round(sec * sr)), Math.max(0, restBuf.length - sliceFrames - 1));

    let origSliceBuf = null;
    if (origFile) {
        try {
            const res = await fetch('/api/media/' + encodeURIComponent(origFile));
            const ab = await res.arrayBuffer();
            const fullOrigBuf = await window.audioCtx.decodeAudioData(ab);
            origSliceBuf = window.audioCtx.createBuffer(fullOrigBuf.numberOfChannels, sliceFrames, sr);
            for (let c = 0; c < fullOrigBuf.numberOfChannels; c++) {
                origSliceBuf.getChannelData(c).set(fullOrigBuf.getChannelData(c).subarray(startFrame, startFrame + sliceFrames));
            }
            const rData = restBuf.getChannelData(0);
            const oData = origSliceBuf.getChannelData(0);

            // Авто-поиск сдвига задержки кодека Opus и FIR (-600..+600 сэмплов)
            let bestLag = 0, bestCorr = -1e9;
            for (let lag = -600; lag <= 600; lag += 4) {
                let corr = 0;
                for (let i = 600; i < Math.min(sliceFrames - 600, 12000); i += 8) {
                    corr += oData[i] * (rData[startFrame + i + lag] || 0);
                }
                if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
            }

            // Выравниваем громкость среза и считаем честную разницу RMS именно на этом участке
            let sumO = 0, sumR = 0, cntS = 0;
            for (let i = 600; i < sliceFrames - 600; i++) {
                const vo = oData[i];
                const vr = rData[startFrame + i + bestLag] || 0;
                sumO += vo * vo;
                sumR += vr * vr;
                cntS++;
            }
            const rmsO = Math.sqrt(sumO / Math.max(1, cntS));
            const rmsR = Math.sqrt(sumR / Math.max(1, cntS));
            const fullOrigSt = window.measureBufferStatsV76(fullOrigBuf);
            const fullRestSt = window.measureBufferStatsV76(restBuf);
            const rmsDiffDb = Math.abs(20 * Math.log10(Math.max(0.0001, fullRestSt.rms) / Math.max(0.0001, fullOrigSt.rms)));

            const win = 480;
            let envErrSum = 0, winCnt = 0;
            const normGain = (rmsR > 0.0001) ? (rmsO / rmsR) : 1.0;
            for (let i = 600; i + win < sliceFrames - 600; i += win) {
                let eO = 0, eR = 0;
                for (let j = 0; j < win; j++) {
                    eO += Math.abs(oData[i + j]);
                    eR += Math.abs((rData[startFrame + i + bestLag + j] || 0) * normGain);
                }
                const mx = Math.max(0.001, eO, eR);
                envErrSum += Math.abs(eO - eR) / mx;
                winCnt++;
            }
            const matchPct = Math.max(0, Math.min(100, (1.0 - (envErrSum / Math.max(1, winCnt)) * 0.45) * 100)).toFixed(1);
            const lagMs = (bestLag / sr * 1000).toFixed(2);
            rep.push(`--- 🔬 СРАВНЕНИЕ С ОРИГИНАЛОМ (${origFile}) ---`);
            rep.push(`• Точность огибающей 1.0x: ${matchPct}% | Сдвиг кодека: ${lagMs} мс | Разница RMS: ${rmsDiffDb.toFixed(2)} dB`);
        } catch (e) {
            rep.push(`⚠️ Не удалось декодировать оригинал ${origFile}: ${e.message}`);
        }
    } else {
        rep.push(`ℹ️ Исходный файл «${info.baseStem}» не найден в папке — сравнение по паспорту ДНК.`);
    }

    const restSlice = window.audioCtx.createBuffer(restBuf.numberOfChannels, sliceFrames, sr);
    for (let c = 0; c < restBuf.numberOfChannels; c++) {
        restSlice.getChannelData(c).set(restBuf.getChannelData(c).subarray(startFrame, startFrame + sliceFrames));
    }
    const expSpd = parseFloat(smap.spd) || 1.0;
    const expStart = Math.min(Math.max(0, Math.round((sec / expSpd) * sr)), Math.max(0, expBuf.length - 64));
    const expFrames = Math.min(expBuf.length - expStart, Math.round(sliceFrames / expSpd));
    const expSlice = window.audioCtx.createBuffer(expBuf.numberOfChannels, Math.max(64, expFrames), sr);
    for (let c = 0; c < expBuf.numberOfChannels; c++) {
        expSlice.getChannelData(c).set(expBuf.getChannelData(c).subarray(expStart, expStart + expFrames));
    }

    const blind1xSlice = (typeof window.buildElasticHoseBufferV46 === 'function')
        ? window.buildElasticHoseBufferV46(expSlice, 1.0 / expSpd, 100)
        : expSlice;
    window._revisorSlicesV76 = { orig: origSliceBuf || restSlice, exp: expSlice, rest: restSlice, blind: blind1xSlice };

    const txt = rep.join('\n');
    if (ta) ta.value = txt;
    if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {});

    if (saveToMp3Test && typeof window.encodeAudioBufferToWavB64V59 === 'function') {
        fetch('/api/save_test_slices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                track: 'REV76_' + (window.currentPlayingTrack || 'track'),
                speed_str: `x${expSpd.toFixed(2)}_to_1x`,
                orig_start: startFrame,
                orig_end: startFrame + sliceFrames,
                orig_wav_b64: window.encodeAudioBufferToWavB64V59(origSliceBuf || restSlice),
                hose_wav_b64: window.encodeAudioBufferToWavB64V59(expSlice),
                restored_wav_b64: window.encodeAudioBufferToWavB64V59(restSlice),
                report_txt: txt
            })
        }).then(r => r.json()).then(ans => {
            if (ans.status === 'ok' && typeof window.showToast === 'function') {
                window.showToast(`💾 3 файла (Ориг / Экспорт / Восст. 1x) в /Music/mp3_test!`);
            }
        }).catch(() => {});
    } else if (typeof window.showToast === 'function') {
        window.showToast('🧬 Отчёт Ревизора JENNYV67 готов и скопирован!');
    }
};

window.playRevisorSliceV76 = async function(which) {
    if (!window._revisorSlicesV76) await window.runRevisorComparisonV76(false);
    const s = window._revisorSlicesV76;
    if (!s || !window.audioCtx) return;
    const player = document.getElementById('audioPlayer');
    if (player && !player.paused) player.pause();
    if (window._hoseTestSliceV59 && window._hoseTestSliceV59.activeNode) {
        try { window._hoseTestSliceV59.activeNode.stop(); window._hoseTestSliceV59.activeNode.disconnect(); } catch (e) {}
    }
    const buf = (which === 'orig') ? s.orig : ((which === 'exp') ? s.exp : ((which === 'blind') ? s.blind : s.rest));
    if (!buf) return;
    const node = window.audioCtx.createBufferSource();
    node.buffer = buf;
    // Слушаем напрямую через destination (в обход повторного наложения живого DSP!), чтобы слышать честный звук файла
    node.connect(window.masterAntiClickGain || window.audioCtx.destination);
    if (window._hoseTestSliceV59) window._hoseTestSliceV59.activeNode = node;
    node.start(0);
};

window.onToggleAntiDspV76 = async function(chk) {
    window.antiDspEnabledV76 = Boolean(chk && chk.checked);
    if (window.rawReconstructed1xBufferV76 && window.currentTrackRevMapV67) {
        window.reconstructedMasterBufferV67 = window.antiDspEnabledV76
            ? await window.applyInverseDspCompensationV76(window.rawReconstructed1xBufferV76, window.currentTrackRevMapV67)
            : window.rawReconstructed1xBufferV76;
        if (typeof window.syncMasterPlaybackEngineV59 === 'function') window.syncMasterPlaybackEngineV59(false);
    }
    if (typeof window.showToast === 'function') {
        window.showToast(window.antiDspEnabledV76 ? '🧬 Анти-DSP ВКЛ: впечённые эффекты вычитаются!' : '⚙️ Анти-DSP ВЫКЛ: только склейка швов');
    }
};

setTimeout(() => {
    const sliceBox = document.getElementById('hoseSliceBoxV59');
    if (sliceBox && !document.getElementById('revisorBoxV76')) {
        const revBox = document.createElement('div');
        revBox.id = 'revisorBoxV76';
        revBox.style.cssText = 'margin-top:8px;border-top:1px dashed #3fb950;padding-top:8px;';
        revBox.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                <span style="font-size:10.5px;color:#3fb950;font-weight:bold;">🧬 Ревизор JENNYV67 + Анти-DSP (Возврат к 1.0x):</span>
                <label style="font-size:10px;color:#e6edf3;display:flex;align-items:center;gap:4px;cursor:pointer;">
                    <input type="checkbox" id="chkAntiDspV76" checked onchange="window.onToggleAntiDspV76(this)">
                    ⚡ Вычитать DSP
                </label>
            </div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:5px;">
                <button type="button" onclick="window.runRevisorComparisonV76(false)" style="flex:1;font-size:10px;padding:4px 6px;border-radius:4px;border:1px solid #58a6ff;background:#161b22;color:#58a6ff;">🔬 Паспорт ДНК + Сверка %</button>
                <button type="button" onclick="window.runRevisorComparisonV76(true)" style="flex:1;font-size:10px;padding:4px 6px;border-radius:4px;border:1px solid #3fb950;background:#161b22;color:#3fb950;">💾 3 среза в mp3_test</button>
            </div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;">
                <button type="button" onclick="window.playRevisorSliceV76('orig')" style="flex:1;font-size:10px;padding:4px;border-radius:4px;border:1px solid #8b949e;background:#0d1117;color:#c9d1d9;">▶️ 1. Ориг</button>
                <button type="button" onclick="window.playRevisorSliceV76('exp')" style="flex:1;font-size:10px;padding:4px;border-radius:4px;border:1px solid #e3b341;background:#0d1117;color:#e3b341;">▶️ 2. Экспорт</button>
                <button type="button" onclick="window.playRevisorSliceV76('rest')" style="flex:1.2;font-size:10px;padding:4px;border-radius:4px;border:1px solid #3fb950;background:#0d1117;color:#3fb950;">▶️ 3. Восст. 1x (ДНК)</button>
                <button type="button" onclick="window.playRevisorSliceV76('blind')" style="flex:1.2;font-size:10px;padding:4px;border-radius:4px;border:1px solid #f85149;background:#0d1117;color:#ff7b72;">▶️ 4. Без ДНК (Слепой)</button>
            </div>
        `;
        sliceBox.insertAdjacentElement('afterend', revBox);
    }
}, 750);


// === JENNY V78 DEEP SPECTRAL BLUEPRINT & HEAVY RESYNTHESIS ===
window.captureSpectralBlueprintV78 = function(srcBuf) {
    if (!srcBuf) return null;
    const sr = srcBuf.sampleRate;
    const ch0 = srcBuf.getChannelData(0);
    const ch1 = srcBuf.numberOfChannels > 1 ? srcBuf.getChannelData(1) : ch0;
    const len = ch0.length;
    const win = Math.max(512, Math.round(0.04 * sr)); // окна по 40 мс
    const hfCurve = [];
    const sideCurve = [];
    for (let p = 0; p + win <= len; p += win) {
        let lowE = 0.00001, hfE = 0.00001, midE = 0.00001, sideE = 0.00001;
        for (let i = p + 2; i < p + win; i += 2) {
            const l = ch0[i], r = ch1[i];
            const prevL = ch0[i - 1], prevR = ch1[i - 1];
            const prev2L = ch0[i - 2], prev2R = ch1[i - 2];
            // 2-я разность выделяет ВЧ-гармоники (6..20 кГц)
            const hf = Math.abs((l - 2 * prevL + prev2L) + (r - 2 * prevR + prev2R)) * 0.25;
            const body = (Math.abs(l) + Math.abs(r)) * 0.5;
            hfE += hf;
            lowE += body;
            midE += Math.abs(0.5 * (l + r));
            sideE += Math.abs(0.5 * (l - r));
        }
        // Квантуем отношение ВЧ/Тело и Side/Mid в компактные целые 0..255 для идеального сжатия LZMA
        hfCurve.push(Math.min(255, Math.round((hfE / lowE) * 180)));
        sideCurve.push(Math.min(255, Math.round((sideE / midE) * 120)));
    }
    return { win: win, hf: hfCurve, side: sideCurve };
};

const _origCaptureDnaV76 = window.captureExportDspDnaV76;
window.captureExportDspDnaV76 = function(srcBuf, renderedBuf, cfg) {
    const dna = _origCaptureDnaV76(srcBuf, renderedBuf, cfg);
    if (dna && srcBuf) {
        dna.specBlueprint = window.captureSpectralBlueprintV78(srcBuf);
    }
    return dna;
};

window.runDeepSpectralResynthesisV78 = async function(buf, smap, isShortSlice) {
    if (!buf || !smap || !smap.dspDna || !smap.dspDna.specBlueprint || !window.audioCtx) return buf;
    if (buf.duration > 360 && !isShortSlice) return buf;
    const bp = smap.dspDna.specBlueprint;
    const sr = buf.sampleRate;
    const numCh = buf.numberOfChannels;
    const len = buf.length;

    // 1. Синтезируем гармонический ВЧ-слой через нелинейный эксайтер + фильтр верхних частот 5.5 кГц
    const offCtx = new OfflineAudioContext(numCh, len, sr);
    const src = offCtx.createBufferSource();
    src.buffer = buf;

    const bpFilter = offCtx.createBiquadFilter();
    bpFilter.type = 'bandpass';
    bpFilter.frequency.value = 3800;
    bpFilter.Q.value = 0.7;

    const shaper = offCtx.createWaveShaper();
    const curve = new Float32Array(8193);
    for (let i = 0; i < 8193; i++) {
        const x = (i - 4096) / 4096;
        curve[i] = x - 0.35 * x * x * x + 0.15 * (2 * x * x - 1);
    }
    shaper.curve = curve;

    const hpFilter = offCtx.createBiquadFilter();
    hpFilter.type = 'highpass';
    hpFilter.frequency.value = 5800;
    hpFilter.Q.value = 0.707;

    src.connect(bpFilter);
    bpFilter.connect(shaper);
    shaper.connect(hpFilter);
    hpFilter.connect(offCtx.destination);
    src.start(0);

    const harmonicBuf = await offCtx.startRendering();

    // 2. Покадровая калибровка ВЧ-гармоник и стерео-панорамы строго по чертежу оригинала (с плавной интерполяцией)
    const win = bp.win || Math.max(512, Math.round(0.04 * sr));
    const hfArr = bp.hf || [];
    const sideArr = bp.side || [];

    const c0 = buf.getChannelData(0);
    const c1 = numCh > 1 ? buf.getChannelData(1) : c0;
    const h0 = harmonicBuf.getChannelData(0);
    const h1 = numCh > 1 ? harmonicBuf.getChannelData(1) : h0;

    let prevHfBoost = 0.0;
    let prevSideScale = 1.0;

    for (let wIdx = 0; wIdx < hfArr.length; wIdx++) {
        const p = wIdx * win;
        if (p >= len) break;
        const end = Math.min(len, p + win);

        let curLowE = 0.00001, curHfE = 0.00001, harmE = 0.00001, curMidE = 0.00001, curSideE = 0.00001;
        for (let i = p + 2; i < end; i += 2) {
            const l = c0[i], r = c1[i];
            const hf = Math.abs((l - 2 * c0[i - 1] + c0[i - 2]) + (r - 2 * c1[i - 1] + c1[i - 2])) * 0.25;
            curHfE += hf;
            curLowE += (Math.abs(l) + Math.abs(r)) * 0.5;
            harmE += (Math.abs(h0[i]) + Math.abs(h1[i])) * 0.5;
            curMidE += Math.abs(0.5 * (l + r));
            curSideE += Math.abs(0.5 * (l - r));
        }

        const targetHfRatio = (hfArr[wIdx] || 0) / 180.0;
        const actualHfRatio = curHfE / curLowE;
        const missingHfEnergy = Math.max(0.0, targetHfRatio - actualHfRatio) * curLowE;
        const targetHfBoost = Math.min(1.6, missingHfEnergy / Math.max(0.0001, harmE * 1.4));

        const targetSideRatio = (sideArr[wIdx] || 0) / 120.0;
        const actualSideRatio = curSideE / curMidE;
        const targetSideScale = (actualSideRatio > 0.02)
            ? Math.max(0.6, Math.min(2.2, targetSideRatio / actualSideRatio))
            : 1.0;

        const span = Math.max(1, end - p);
        for (let i = p; i < end; i++) {
            const t = (i - p) / span;
            const hfGain = prevHfBoost * (1.0 - t) + targetHfBoost * t;
            const sScale = prevSideScale * (1.0 - t) + targetSideScale * t;

            const l = c0[i] + h0[i] * hfGain;
            const r = c1[i] + h1[i] * hfGain;
            if (numCh > 1) {
                const m = 0.5 * (l + r);
                const s = 0.5 * (l - r) * sScale;
                c0[i] = Math.max(-0.99, Math.min(0.99, m + s));
                c1[i] = Math.max(-0.99, Math.min(0.99, m - s));
            } else {
                c0[i] = Math.max(-0.99, Math.min(0.99, l));
            }
        }
        prevHfBoost = targetHfBoost;
        prevSideScale = targetSideScale;
    }
    return buf;
};

// Подключаем глубокий ресинтез и запрос пароля (если файл зашифрован своим ключом) при распаковке
const _origApplyInvV76 = window.applyInverseDspCompensationV76;
window.applyInverseDspCompensationV76 = async function(rawReconstructedBuf, smap) {
    const step1 = await _origApplyInvV76(rawReconstructedBuf, smap);
    return await window.runDeepSpectralResynthesisV78(step1, smap);
};

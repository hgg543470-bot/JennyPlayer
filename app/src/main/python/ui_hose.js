/* ============================================================================
 * ui_hose.js — Резак питч-лока («шланг», V44–V61): склейка волны, осциллограф амплитуды, RAM-буфер, сэмпл-резак
 *
 * Склейка:  /bundle_1_studio.js, модуль 7 из 12. Порядок модулей задан в player.py и менять его нельзя:
 *           поздние модули переопределяют и оборачивают функции ранних.
 * Внутри:   buildElasticHoseBufferV46, startHoseWaveScopeV49, toggleHoseScopeFreezeV49, setHoseScopeZoomV49, applyElasticHoseBufferLiveV46, installHosePlayerHooksV46, onHoseTensionInputV44, injectElasticHoseControlsV44, dumpHoseDebugV52, ensureStudioBufferLoadedV61 … (всего функций: 17)
 * Откуда:   ui_help.js (коммит 9ae6639), строки 2772–3800. Код блоков перенесён без правок.
 * Подробно: FILES.md (карта файлов), REFACTOR_PLAN.md (как резалось и что перекрыто).
 * ============================================================================ */













// 🐍 ПАТЧ V49: ЧИСТЫЙ 90° ПРОФИЛЬНЫЙ РЕЗАК (БЕЗ ГУЛА И ХРИПА) + ЭКРАН РЕАЛЬНОЙ АМПЛИТУДЫ ВОЛНЫ

window._hoseSplicerCacheV46 = {
    srcBuffer: null,
    speed: 1.0,
    tension: 1.0,
    splicedBuffer: null,
    lastBuildMs: 0,
    avgSeamErrMv: 0,
    seamPointsOut: []
};

window._hoseScopeStateV49 = {
    frozen: false,
    windowMs: 6,
    rafId: null
};

// Алгоритм V49:
// 1) Сшивает волну по полному профилю дуги (24 точки + басовая фаза) и варьирует шаг (16..22 мс), полностью убивая 83 Гц гул!
// 2) Меняет высоту амплитуды плавной огибающей по целым дугам, НЕ сплющивая верхушки синусоид (0% хрипа на вокале и гитарах!).
window.buildElasticHoseBufferV46 = function(srcBuffer, speed, tensionPct) {
    if (!srcBuffer || !window.audioCtx) return srcBuffer;
    const spd = Math.max(0.1, Math.min(100.0, parseFloat(speed) || 1.0));
    const tension = Math.max(0.2, Math.min(2.0, (parseFloat(tensionPct) || 100) / 100));

    if (Math.abs(spd - 1.0) < 0.002) {
        window._hoseSplicerCacheV46.speed = 1.0;
        window._hoseSplicerCacheV46.srcBuffer = srcBuffer;
        window._hoseSplicerCacheV46.lastBuildMs = 0;
        window._hoseSplicerCacheV46.avgSeamErrMv = 0;
        window._hoseSplicerCacheV46.splicedBuffer = srcBuffer;
        window._hoseSplicerCacheV46.seamPointsOut = [];
        return srcBuffer;
    }

    const cache = window._hoseSplicerCacheV46;
    if (cache.srcBuffer === srcBuffer && Math.abs(cache.speed - spd) < 0.002 && Math.abs(cache.tension - tension) < 0.02 && cache.splicedBuffer) {
        return cache.splicedBuffer;
    }

    const t0 = performance.now();
    const sr = srcBuffer.sampleRate;
    const numCh = srcBuffer.numberOfChannels;
    const inLen = srcBuffer.length;
    const outLen = Math.max(1024, Math.floor(inLen / spd));
    const outBuffer = window.audioCtx.createBuffer(numCh, outLen, sr);

    const chIn = [];
    const chOut = [];
    for (let c = 0; c < numCh; c++) {
        chIn.push(srcBuffer.getChannelData(c));
        chOut.push(outBuffer.getChannelData(c));
    }

    // Упругость петель (20%..200% -> tension 0.2..2.0) управляет шагом петли во времени (26.2 мс при 20% -> 18.5 мс при 100% -> 10.5 мс при 200%)
    const stepSec = Math.max(0.0105, Math.min(0.027, 0.028 - tension * 0.0088));
    const baseStep = Math.max(384, Math.round(stepSec * sr));
    const searchRad = Math.max(256, Math.round(stepSec * 0.65 * sr));
    // Широкое 4.5 мс C2-скругление вдоль склона (216 сэмплов) — полностью убирает любые щелчки и гул на басу
    const filletLen = Math.max(128, Math.round(0.0045 * sr));

    const blendCurve = new Float32Array(filletLen);
    const tangDecay = new Float32Array(filletLen);
    for (let i = 0; i < filletLen; i++) {
        const t = i / filletLen;
        const b = 0.5 * (1.0 - Math.cos(Math.PI * t));
        blendCurve[i] = b;
        const r = 1.0 - b;
        tangDecay[i] = r * r;
    }

    const in0 = chIn[0];
    const in1 = numCh > 1 ? chIn[1] : in0;

    const initCopy = Math.min(baseStep, outLen, inLen);
    for (let c = 0; c < numCh; c++) {
        const inp = chIn[c];
        const out = chOut[c];
        for (let i = 0; i < initCopy; i++) out[i] = inp[i];
    }

    let outPos = initCopy;
    let inCursor = initCopy;
    let seamCount = 0;
    let totalSeamDiff = 0;
    const seamPoints = [];

    const isFast = spd > 1.0;
    const speedDelta = Math.abs(spd - 1.0);
    const vertFactor = Math.min(0.48, Math.max(0.08, speedDelta) * tension * 0.42);
    let smoothGain = 1.0;

    while (outPos + baseStep + filletLen + 256 < outLen) {
        // Слегка варьируем длину шага (±15%), чтобы швы никогда не образовывали гудящую ноту!
        const jitter = ((seamCount * 73) & 127) - 64;
        const stepOut = baseStep + jitter * 2;

        let p1 = Math.round(inCursor);
        const idealP2 = Math.round(outPos * spd);

        if (p1 < 32 || p1 + stepOut + filletLen + 32 >= inLen) break;
        if (idealP2 < 32 || idealP2 + stepOut + filletLen + 32 >= inLen) break;

        // 1. Привязываем первую точку разреза p1 к восходящему переходу через 0 (мембрана в нуле, угол 90° к склону)
        let advK = 0;
        for (let k = 0; k <= 36; k++) {
            if (in0[inCursor + k - 1] <= 0.0 && in0[inCursor + k] >= 0.0) { advK = k; break; }
        }
        for (let k = 0; k < advK && outPos < outLen; k++) {
            for (let c = 0; c < numCh; c++) chOut[c][outPos] = chIn[c][inCursor] * smoothGain;
            outPos++; inCursor++;
        }
        p1 = inCursor;

        const s1L = in0[p1 + 1] - in0[p1 - 1];
        const s1R = in1[p1 + 1] - in1[p1 - 1];
        // Низкочастотный (басовый) вектор наклона за 16 сэмплов
        const bassSlope1L = in0[p1 + 12] - in0[p1 - 12];

        const minP2 = Math.max(32, idealP2 - searchRad);
        const maxP2 = Math.min(inLen - stepOut - filletLen - 32, idealP2 + searchRad);

        let bestP2 = idealP2;
        let bestCost = 1e9;

        // 2. Ищем на соседней дуге точку p2, где совпадает ВЕСЬ профиль волны (и высокая гитара, и длинный бас!)
        for (let cand = minP2; cand <= maxP2; cand += 3) {
            const s2L = in0[cand + 1] - in0[cand - 1];
            const bassSlope2L = in0[cand + 12] - in0[cand - 12];

            // Запрещаем сшивать волны с разным направлением склона или в противофазе баса
            if (s1L * s2L < 0 || bassSlope1L * bassSlope2L < 0) continue;

            // Сравниваем профиль дуги по 8 контрольным точкам вдоль склона
            let profileErr = 0.0;
            for (let w = -12; w <= 36; w += 6) {
                const dL = in0[cand + w] - in0[p1 + w];
                const dR = in1[cand + w] - in1[p1 + w];
                profileErr += dL * dL + dR * dR;
            }

            const slopeDiff = Math.abs(s2L - s1L) + Math.abs((in1[cand + 1] - in1[cand - 1]) - s1R);
            const cost = profileErr * 1.5 + slopeDiff * 2.5;

            if (cost < bestCost) {
                bestCost = cost;
                bestP2 = cand;
            }
        }

        // Посэмпловая доводка вокруг bestP2
        for (let cand = Math.max(minP2, bestP2 - 2); cand <= Math.min(maxP2, bestP2 + 2); cand++) {
            let profileErr = 0.0;
            for (let w = -6; w <= 24; w += 6) {
                const dL = in0[cand + w] - in0[p1 + w];
                const dR = in1[cand + w] - in1[p1 + w];
                profileErr += dL * dL + dR * dR;
            }
            if (profileErr < bestCost) {
                bestCost = profileErr;
                bestP2 = cand;
            }
        }

        totalSeamDiff += Math.abs(in0[bestP2] - in0[p1]);
        seamCount++;
        seamPoints.push(outPos);
        if (!cache.seamLogs || seamCount === 1) cache.seamLogs = [];

        // 3. Оцениваем высоту петли всего участка (чтобы плавно менять громкость целой дуги БЕЗ сплющивания верхушек!)
        let segPeak = 0.0;
        for (let i = 0; i < stepOut; i += 8) {
            const a = Math.max(Math.abs(in0[bestP2 + i]), Math.abs(in1[bestP2 + i]));
            if (a > segPeak) segPeak = a;
        }
        let targetGain = 1.0;
        if (segPeak > 0.16) {
            if (isFast) {
                targetGain = 1.0 - vertFactor * (segPeak - 0.16);
            } else {
                targetGain = 1.0 + vertFactor * 0.75 * (segPeak - 0.16);
            }
        }
        cache.seamLogs.push({
            idx: seamCount,
            outPos: outPos,
            stepOut: stepOut,
            advK: advK,
            p1: p1,
            p2: bestP2,
            shift: bestP2 - p1,
            filletLen: filletLen,
            targetGain: targetGain,
            t: (outPos * spd) / sr,
            dy: Math.abs(in0[bestP2] - in0[p1]),
            sA: s1L,
            sB: in0[bestP2 + 1] - in0[bestP2 - 1]
        });

        for (let c = 0; c < numCh; c++) {
            const inp = chIn[c];
            const out = chOut[c];
            const dy = inp[bestP2] - inp[p1];
            let localGain = smoothGain;

            for (let i = 0; i < stepOut; i++) {
                localGain = localGain * 0.994 + targetGain * 0.006;
                let v = inp[bestP2 + i];

                if (i < filletLen) {
                    const b = blendCurve[i];
                    const contVal = inp[p1 + i];
                    const pulledNew = v;
                    v = contVal * (1.0 - b) + pulledNew * b;
                }

                out[outPos + i] = v * localGain;
            }
            if (c === numCh - 1) smoothGain = localGain;
        }

        outPos += stepOut;
        inCursor = bestP2 + stepOut;
    }

    while (outPos < outLen && Math.round(inCursor) < inLen) {
        const idx = Math.min(inLen - 1, Math.round(inCursor));
        for (let c = 0; c < numCh; c++) {
            chOut[c][outPos] = chIn[c][idx];
        }
        outPos++;
        inCursor += spd;
    }

    cache.srcBuffer = srcBuffer;
    cache.speed = spd;
    cache.tension = tension;
    cache.splicedBuffer = outBuffer;
    cache.lastBuildMs = Math.round(performance.now() - t0);
    cache.avgSeamErrMv = seamCount > 0 ? (totalSeamDiff / seamCount) : 0;
    cache.seamPointsOut = seamPoints;
    return outBuffer;
};

// 📊 ЖИВОЙ ОСЦИЛЛОГРАФ РЕАЛЬНЫХ ЗНАЧЕНИЙ АМПЛИТУДЫ (-1.00 .. +1.00)
window.startHoseWaveScopeV49 = function() {
    const st = window._hoseScopeStateV49;
    if (st.rafId) cancelAnimationFrame(st.rafId);

    const renderFrame = () => {
        const sm = document.getElementById('specModal');
        const cv = document.getElementById('hoseWaveScopeCanvasV49');
        const isBg = (typeof window.isJennyAppBackgroundedV264 === 'function') ? window.isJennyAppBackgroundedV264() : document.hidden;
        const isScopeVisible = Boolean(!isBg && sm && sm.classList.contains('open') && cv && cv.offsetParent !== null);
        if (!isScopeVisible || st.frozen || !window.studioBuffer) {
            st.rafId = setTimeout(renderFrame, 450);
            return;
        }
        const player = document.getElementById('audioPlayer');
        if (cv && player && window.studioBuffer && !st.frozen) {
            const ctx = cv.getContext('2d');
            const W = cv.width;
            const H = cv.height;
            ctx.clearRect(0, 0, W, H);

            // Фон и честная сетка амплитуды (+1.0, +0.5, 0.0, -0.5, -1.0)
            ctx.fillStyle = '#070a0f';
            ctx.fillRect(0, 0, W, H);

            const midY = H / 2;
            const scaleY = (H / 2) - 8;

            ctx.strokeStyle = 'rgba(139,148,158,0.18)';
            ctx.lineWidth = 1;
            [-1.0, -0.5, 0.0, 0.5, 1.0].forEach(val => {
                const y = midY - val * scaleY;
                ctx.beginPath();
                ctx.moveTo(32, y);
                ctx.lineTo(W, y);
                ctx.stroke();
            });

            // Подписи реальных значений амплитуды слева
            ctx.fillStyle = '#8b949e';
            ctx.font = '10px monospace';
            ctx.fillText('+1.0', 2, midY - scaleY + 4);
            ctx.fillText('+0.5', 2, midY - scaleY * 0.5 + 3);
            ctx.fillStyle = '#58a6ff';
            ctx.fillText(' 0.0', 2, midY + 3);
            ctx.fillStyle = '#8b949e';
            ctx.fillText('-0.5', 2, midY + scaleY * 0.5 + 3);
            ctx.fillText('-1.0', 2, midY + scaleY + 2);

            const sr = window.studioBuffer.sampleRate;
            const winSamples = Math.max(64, Math.round((st.windowMs / 1000) * sr));
            const curSec = (typeof window.getTruePlaybackTimeV74_2 === 'function')
                ? window.getTruePlaybackTimeV74_2()
                : (player.currentTime || 0);

            let targetSpd = 1.0;
            if (window.scrubState && (window.scrubState.active || window.scrubState.locked) && window.scrubState.speed) {
                targetSpd = parseFloat(window.scrubState.speed) || 1.0;
            } else if (window.persistedPlaybackSpeed) {
                targetSpd = parseFloat(window.persistedPlaybackSpeed) || 1.0;
            } else if (typeof window.getTargetPlaybackSpeed === 'function') {
                targetSpd = window.getTargetPlaybackSpeed();
            }

            const hasXflacRev = Boolean(
                window.reconstructedMasterBufferV67 &&
                window.currentTrackRevMapV67 &&
                window.currentTrackRevNameV67 === window.currentPlayingTrack
            );

            const gKey = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
            const isHoseMode = Boolean(gKey === 'jbuf-lock' || (window.appConfig && window.appConfig.elasticHoseMode));

            if (isHoseMode && Math.abs(targetSpd - 1.0) > 0.002 && window.studioBuffer) {
                const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
                const baseBuf = isRev ? (window.reversedStudioBuffer || window.studioBuffer) : window.studioBuffer;
                const tensPct = (window.appConfig && window.appConfig.hoseTensionPct !== undefined) ? window.appConfig.hoseTensionPct : 100;
                const cache = window._hoseSplicerCacheV46;
                if (!cache.splicedBuffer || cache.srcBuffer !== baseBuf || Math.abs((cache.speed || 1.0) - targetSpd) > 0.002) {
                    window.buildElasticHoseBufferV46(baseBuf, targetSpd, tensPct);
                }
            }

            const origBufRef = hasXflacRev ? window.reconstructedMasterBufferV67 : window.studioBuffer;
            const origData = origBufRef.getChannelData(0);
            const splicedBuf = (isHoseMode && window._hoseSplicerCacheV46.splicedBuffer && Math.abs(targetSpd - 1.0) > 0.002)
                ? window._hoseSplicerCacheV46.splicedBuffer
                : window.studioBuffer;
            const hoseData = splicedBuf.getChannelData(0);

            let activeSeams = (isHoseMode && window._hoseSplicerCacheV46.seamPointsOut && window._hoseSplicerCacheV46.seamPointsOut.length > 0 && Math.abs(targetSpd - 1.0) > 0.002)
                ? window._hoseSplicerCacheV46.seamPointsOut
                : [];
            if (activeSeams.length === 0 && hasXflacRev && Array.isArray(window.currentTrackRevMapV67.seams)) {
                activeSeams = window.currentTrackRevMapV67.seams.map(cs => cs[0]).filter(n => typeof n === 'number');
            }

            const isHoseActiveNow = Boolean((isHoseMode && window._hoseSplicerCacheV46.splicedBuffer && Math.abs(targetSpd - 1.0) > 0.002) || hasXflacRev);
            const expSpdRatio = hasXflacRev ? (parseFloat(window.currentTrackRevMapV67.spd) || 1.0) : 1.0;

            const origStart = hasXflacRev
                ? Math.min(Math.max(0, Math.floor(curSec * expSpdRatio * sr)), Math.max(0, origData.length - winSamples - 1))
                : Math.min(Math.max(0, Math.floor(curSec * sr)), Math.max(0, origData.length - winSamples - 1));

            const hoseStart = isHoseActiveNow
                ? Math.min(Math.max(0, Math.floor(((Math.abs(targetSpd - 1.0) > 0.002) ? (curSec / targetSpd) : curSec) * sr)), Math.max(0, hoseData.length - winSamples - 1))
                : origStart;

            const plotW = W - 34;

            // 1. Рисуем КОНТРАСТНЫМ СЕРЫМ ПУНКТИРОМ исходную волну (Оригинал 1.0x / Восстановленный из .xFLAC)
            ctx.strokeStyle = 'rgba(180,196,216,0.72)';
            ctx.lineWidth = 1.6;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            for (let x = 0; x < plotW; x++) {
                const idx = origStart + Math.floor((x / plotW) * winSamples);
                const v = origData[idx] || 0;
                const py = midY - v * scaleY;
                if (x === 0) ctx.moveTo(34 + x, py);
                else ctx.lineTo(34 + x, py);
            }
            ctx.stroke();
            ctx.setLineDash([]);

            // 2. Рисуем ЯРКО-ЗЕЛЁНЫМ реальную волну после 90° Резака / .xFLAC + измеряем её истинные параметры
            let peak = 0.0;
            let sumSq = 0.0;
            let maxSlope = 0.0;
            let zeroCrossings = 0;

            ctx.strokeStyle = '#3fb950';
            ctx.lineWidth = 1.9;
            ctx.beginPath();
            for (let x = 0; x < plotW; x++) {
                const idx = hoseStart + Math.floor((x / plotW) * winSamples);
                const v = hoseData[idx] || 0;
                const prev = hoseData[Math.max(0, idx - 1)] || 0;
                const py = midY - v * scaleY;
                if (x === 0) ctx.moveTo(34 + x, py);
                else ctx.lineTo(34 + x, py);

                const av = Math.abs(v);
                if (av > peak) peak = av;
                sumSq += v * v;
                const sl = Math.abs(v - prev);
                if (sl > maxSlope) maxSlope = sl;
                if ((prev <= 0 && v > 0) || (prev >= 0 && v < 0)) zeroCrossings++;
            }
            ctx.stroke();

            // 3. Отмечаем ЯРКИМ ОРАНЖЕВЫМ РАЗДЕЛИТЕЛЕМ (#f0883e) точки 90° разреза (Шланга или капсулы .xFLAC)
            ctx.strokeStyle = '#f0883e';
            ctx.lineWidth = 2.0;
            let drawnSeamsInWin = 0;
            for (let s = 0; s < activeSeams.length; s++) {
                const sp = activeSeams[s];
                if (sp >= hoseStart && sp <= hoseStart + winSamples) {
                    const sx = 34 + ((sp - hoseStart) / winSamples) * plotW;
                    ctx.beginPath();
                    ctx.moveTo(sx, 2);
                    ctx.lineTo(sx, H - 2);
                    ctx.stroke();
                    if (drawnSeamsInWin === 0) {
                        ctx.fillStyle = 'rgba(240,136,62,0.92)';
                        ctx.fillRect(Math.max(36, Math.min(W - 56, sx - 24)), 3, 48, 12);
                        ctx.fillStyle = '#070a0f';
                        ctx.font = 'bold 8.5px monospace';
                        ctx.fillText('90° ШОВ', Math.max(38, Math.min(W - 54, sx - 21)), 12);
                    }
                    drawnSeamsInWin++;
                }
            }

            const rms = Math.sqrt(sumSq / Math.max(1, plotW));
            const dbPeak = peak > 0.0001 ? (20 * Math.log10(peak)).toFixed(1) : '-∞';
            const estArcMs = zeroCrossings >= 2 ? ((st.windowMs * 2) / zeroCrossings).toFixed(2) : st.windowMs.toFixed(1);

            const statsEl = document.getElementById('hoseScopeStatsV49');
            if (statsEl) {
                statsEl.innerText = `Peak: ±${peak.toFixed(3)} (${dbPeak} dB) | RMS: ${rms.toFixed(3)} | Дуга: ~${estArcMs} мс | 90° dy/dt: ${maxSlope.toFixed(3)}`;
            }
        }
        st.rafId = requestAnimationFrame(renderFrame);
    };

    st.rafId = requestAnimationFrame(renderFrame);
};

window.toggleHoseScopeFreezeV49 = function(btn) {
    const st = window._hoseScopeStateV49;
    st.frozen = !st.frozen;
    if (btn) {
        btn.innerText = st.frozen ? '▶️ Пуск' : '❄️ Стоп-кадр';
        btn.style.borderColor = st.frozen ? '#f0883e' : '#30363d';
        btn.style.color = st.frozen ? '#f0883e' : '#c9d1d9';
    }
};

window.setHoseScopeZoomV49 = function(ms, btn) {
    window._hoseScopeStateV49.windowMs = ms;
    const grp = document.querySelectorAll('.hose-zoom-btn-v49');
    grp.forEach(b => {
        b.style.background = (parseInt(b.dataset.ms, 10) === ms) ? '#1f6feb' : '#161b22';
        b.style.color = '#ffffff';
    });
};

window._hoseArcDebounceTimerV47 = null;

window.applyElasticHoseBufferLiveV46 = function(isDraggingArc) {
    const player = document.getElementById('audioPlayer');
    const gKey = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
    const isHose = Boolean(gKey === 'jbuf-lock' || (window.appConfig && window.appConfig.elasticHoseMode));
    const badge = document.getElementById('hoseLiveTelemetryV44');

    if (!isHose) {
        if (badge) badge.innerText = window.tr('Выкл (Штатный WebAPI)', 'OFF (Standard WebAPI)');
        return;
    }

    if (isDraggingArc) {
        if (window._hoseArcDebounceTimerV47) clearTimeout(window._hoseArcDebounceTimerV47);
        window._hoseArcDebounceTimerV47 = setTimeout(() => {
            window.applyElasticHoseBufferLiveV46(false);
        }, 70);
        return;
    }

    if (window.appConfig && !window.appConfig.studioMode) {
        window.appConfig.studioMode = true;
        const stChk = document.getElementById('cfg_studioMode');
        if (stChk) stChk.checked = true;
    }

    if (!window.studioBuffer || !window.audioCtx || !player) {
        if (badge) badge.innerText = '⏳ Ожидание RAM-буфера...';
        return;
    }

    let targetSpd = 1.0;
    if (window.scrubState && (window.scrubState.active || window.scrubState.locked) && window.scrubState.speed) {
        targetSpd = parseFloat(window.scrubState.speed) || 1.0;
    } else if (window.persistedPlaybackSpeed) {
        targetSpd = parseFloat(window.persistedPlaybackSpeed) || 1.0;
    } else if (typeof window.getTargetPlaybackSpeed === 'function') {
        targetSpd = window.getTargetPlaybackSpeed();
    } else if (player.playbackRate && player.playbackRate !== 10.0) {
        targetSpd = player.playbackRate;
    }

    const tensionPct = (window.appConfig && window.appConfig.hoseTensionPct !== undefined)
        ? window.appConfig.hoseTensionPct
        : 100;

    const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));
    const baseBuf = isRev ? (window.reversedStudioBuffer || window.studioBuffer) : window.studioBuffer;

    const activeBuf = window.buildElasticHoseBufferV46(baseBuf, targetSpd, tensionPct);

    if (window.htmlGain && window.htmlGain.gain) {
        window.htmlGain.gain.value = 0;
    }
    player.preservesPitch = false;

    const shouldPlayHose = !window._userPausedV75_2 && Boolean(window.isStudioPlaying || window._resumingFromUserPlayV232 || !player.paused);
    if (shouldPlayHose) {
        const curTrueSec = (typeof window.getTruePlaybackTimeV74_2 === 'function')
            ? window.getTruePlaybackTimeV74_2()
            : (player.currentTime || 0);
        // Не перезапускаем уже играющий studioSourceNode, если буфер и скорость не менялись!
        if (
            window.isStudioPlaying &&
            window.studioSourceNode &&
            window.studioSourceNode.buffer === activeBuf &&
            !window._forceRestartStudioNodeV264 &&
            window._studioClockV74_1 &&
            window._studioClockV74_1.active &&
            Math.abs((window._studioClockV74_1.speed || 1.0) - targetSpd) < 0.003
        ) {
            return;
        }
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

    if (badge) {
        const c = window._hoseSplicerCacheV46;
        badge.innerText = `🐍 V49: Δy=${(c.avgSeamErrMv * 100).toFixed(1)}% | x${targetSpd.toFixed(2)} (${c.lastBuildMs}мс)`;
    }
};

window.installHosePlayerHooksV46 = function() {
    const player = document.getElementById('audioPlayer');
    if (!player || player._hoseHookedV49) return;
    player._hoseHookedV49 = true;

    const wrapEvent = (prop) => {
        const orig = player[prop];
        player[prop] = function(ev) {
            const r = (typeof orig === 'function') ? orig.call(this, ev) : undefined;
            if (window._internalSeekSyncGuardV370 || (window.isStudioPlaying && window.studioSourceNode)) {
                return r;
            }
            const gKey = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
            if (window.appConfig && (gKey === 'jbuf-lock' || window.appConfig.elasticHoseMode) && window.studioBuffer && this.playbackRate !== 10.0) {
                window.applyElasticHoseBufferLiveV46(false);
            }
            return r;
        };
    };

    wrapEvent('onplay');
    wrapEvent('onseeked');
};

var onToggleElasticHoseV44 = window.onToggleElasticHoseV44 = window.onToggleElasticHoseV44 || function(){};

window._hoseSliderDebounceV46 = null;
window.onHoseTensionInputV44 = function(val) {
    const num = parseInt(val, 10) || 100;
    window.appConfig = window.appConfig || {};
    window.appConfig.hoseTensionPct = num;
    const lbl = document.getElementById('val_hoseTensionV44');
    if (lbl) lbl.innerText = num;

    if (window._hoseSliderDebounceV46) clearTimeout(window._hoseSliderDebounceV46);
    window._hoseSliderDebounceV46 = setTimeout(() => {
        const gKey = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
        if (gKey === 'jbuf-lock' || window.appConfig.elasticHoseMode) {
            if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
                window.syncMasterPlaybackEngineV59(false);
            } else {
                window.applyElasticHoseBufferLiveV46(false);
            }
        }
        if (typeof window.saveThemeOnlyQuietlyV40 === 'function') window.saveThemeOnlyQuietlyV40();
    }, 120);
};

window.injectElasticHoseControlsV44 = function() {
    if (document.getElementById('hoseControlBoxV44')) return;
    const pitchChk = document.getElementById('cfg_pitchLock');
    if (!pitchChk) return;
    const pitchRow = pitchChk.closest('.setting-row');
    if (!pitchRow) return;

    const cfg = window.appConfig || {};
    const isEn = Boolean(((cfg.gearKeyV66 || 'jbuf-lock') === 'jbuf-lock') || cfg.elasticHoseMode);
    const tens = cfg.hoseTensionPct !== undefined ? parseInt(cfg.hoseTensionPct, 10) : 100;

    const box = document.createElement('div');
    box.id = 'hoseControlBoxV44';
    box.style.cssText = 'background:rgba(63,185,80,0.06);border:1px solid var(--border-uniform);border-radius:10px;padding:8px 10px;margin:6px 0 10px 0;';
    box.innerHTML = `
        <div class="setting-row" style="padding:4px 0;border:none;">
            <label class="toggle-label" style="color:#3fb950;font-weight:bold;">
                <input type="checkbox" id="cfg_elasticHoseV44" ${isEn ? 'checked' : ''} onchange="window.onToggleElasticHoseV44(this, event)">
                🐍 ${window.tr('Упругий Шланг 90° V49 (Профиль Дуги)', 'Elastic Hose 90° V49 (Full-Arc Profile)')}
            </label>
            <span id="hoseLiveTelemetryV44" style="font-size:11px;font-family:monospace;color:#58a6ff;background:#0d1117;padding:3px 7px;border-radius:6px;border:1px solid #262c36;">
                ${isEn ? '🐍 V49 Активен' : window.tr('Выкл', 'OFF')}
            </span>
        </div>
        <div class="setting-row" style="padding:4px 0;border:none;">
            <span style="font-size:12px;color:#8b949e;">🧲 ${window.tr('Упругость петель (Амплитуда ↔ Время %):', 'Loop Elasticity (Amp ↔ Time %):')}</span>
            <div class="val-group">
                <span class="val-badge" id="val_hoseTensionV44">${tens}</span>
            </div>
        </div>
        <input type="range" id="rng_hoseTensionV44" class="hz-slider" min="20" max="200" step="5" value="${tens}" oninput="window.onHoseTensionInputV44(this.value)">

        <!-- 📊 ЭКРАН РЕАЛЬНОЙ АМПЛИТУДЫ ВОЛНЫ И ШВОВ (-1.00 .. +1.00) -->
        <div style="margin-top:8px;background:#070a0f;border:1px solid #262c36;border-radius:8px;padding:6px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;flex-wrap:wrap;gap:4px;">
                <span style="font-size:11px;color:#3fb950;font-weight:bold;">📊 Реальная Амплитуда (Серый=Ориг, Зел=Шланг, Оранж=Шов 90°)</span>
                <div style="display:flex;gap:4px;align-items:center;">
                    <button type="button" class="hose-zoom-btn-v49" data-ms="2" onclick="window.setHoseScopeZoomV49(2,this)" style="font-size:10px;padding:2px 6px;border-radius:4px;border:1px solid #30363d;background:#161b22;color:#fff;">2мс</button>
                    <button type="button" class="hose-zoom-btn-v49" data-ms="6" onclick="window.setHoseScopeZoomV49(6,this)" style="font-size:10px;padding:2px 6px;border-radius:4px;border:1px solid #30363d;background:#1f6feb;color:#fff;">6мс</button>
                    <button type="button" class="hose-zoom-btn-v49" data-ms="15" onclick="window.setHoseScopeZoomV49(15,this)" style="font-size:10px;padding:2px 6px;border-radius:4px;border:1px solid #30363d;background:#161b22;color:#fff;">15мс</button>
                    <button type="button" class="hose-zoom-btn-v49" data-ms="40" onclick="window.setHoseScopeZoomV49(40,this)" style="font-size:10px;padding:2px 6px;border-radius:4px;border:1px solid #30363d;background:#161b22;color:#fff;">40мс</button>
                    <button type="button" onclick="window.toggleHoseScopeFreezeV49(this)" style="font-size:10px;padding:2px 7px;border-radius:4px;border:1px solid #30363d;background:#161b22;color:#c9d1d9;">❄️ Стоп-кадр</button>
                </div>
            </div>
            <canvas id="hoseWaveScopeCanvasV49" width="340" height="120" style="width:100%;height:120px;display:block;border-radius:4px;"></canvas>
            <div id="hoseScopeStatsV49" style="font-size:10px;font-family:monospace;color:#58a6ff;margin-top:4px;text-align:center;">
                Peak: ±0.000 (-∞ dB) | RMS: 0.000 | Дуга: ~0.0 мс | 90° dy/dt: 0.000
            </div>
        </div>
    `;
    pitchRow.insertAdjacentElement('afterend', box);
    window.installHosePlayerHooksV46();
    window.startHoseWaveScopeV49();
};

setTimeout(() => {
    window.injectElasticHoseControlsV44();
    window.installHosePlayerHooksV46();
    window.startHoseWaveScopeV49();
    if (typeof window.tagUniformResetButtonsV38 === 'function') window.tagUniformResetButtonsV38();
}, 350);


window.dumpHoseDebugV52 = function() {
    const c = window._hoseSplicerCacheV46 || {}, player = document.getElementById('audioPlayer');
    const logs = c.seamLogs || [], cur = player ? (player.currentTime || 0) : 0;
    let out = [
        `=== JENNY V52 SEAM DEBUG (${window.currentPlayingTrack || 'Track'}) ===`,
        `Speed: x${(c.speed||1).toFixed(2)} | Tension: ${Math.round((c.tension||1)*100)}% | Build: ${c.lastBuildMs||0}ms | Seams: ${logs.length} | Avg_dy: ${((c.avgSeamErrMv||0)*100).toFixed(2)}%`
    ];
    const near = [...logs].sort((a,b) => Math.abs(a.t - cur) - Math.abs(b.t - cur)).slice(0, 4).sort((a,b) => a.t - b.t);
    near.forEach(s => out.push(`#${s.idx} @${s.t.toFixed(3)}s | shift:${s.shift} | dy:${s.dy.toFixed(4)} | sA:${s.sA.toFixed(4)} sB:${s.sB.toFixed(4)}`));
    if (near[0] && c.splicedBuffer && c.srcBuffer) {
        const s = near[0], oA = c.splicedBuffer.getChannelData(0), iA = c.srcBuffer.getChannelData(0);
        out.push(`--- SAMPLES @ SEAM #${s.idx} (k | Orig_p1 | Orig_p2 | Hose_Out | Step) ---`);
        for (let k = -4; k <= 8; k++) {
            const vO = oA[s.outPos + k] || 0, vP = oA[s.outPos + k - 1] || 0;
            out.push(`${String(k).padStart(2)} | ${(iA[s.p1+k]||0).toFixed(4)} | ${(iA[s.p2+k]||0).toFixed(4)} | ${vO.toFixed(4)} | ${(vO-vP).toFixed(4)}${k===0?' <--CUT':''}`);
        }
    }
    const txt = out.join('\n');
    const ta = document.getElementById('hoseDebugTextAreaV52');
    if (ta) ta.value = txt;
    if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(()=>{});
    if (typeof window.showToast === 'function') window.showToast('📋 Отчёт швов скопирован в буфер!');
};
setTimeout(() => {
    const stEl = document.getElementById('hoseScopeStatsV49');
    if (stEl && !document.getElementById('hoseDebugTextAreaV52')) {
        const d = document.createElement('div');
        d.style.cssText = 'margin-top:6px;border-top:1px solid #21262d;padding-top:6px;';
        d.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-size:10px;color:#f0883e;font-weight:bold;">📝 Отладчик 90° швов (V52):</span>
            <button type="button" onclick="window.dumpHoseDebugV52()" style="font-size:10px;padding:2px 8px;border-radius:4px;border:1px solid #3fb950;background:#161b22;color:#3fb950;">📋 Замер + Копировать</button>
        </div>
        <textarea id="hoseDebugTextAreaV52" readonly rows="4" style="width:100%;background:#0d1117;color:#8b949e;font-family:monospace;font-size:9px;border:1px solid #21262d;border-radius:4px;padding:4px;"></textarea>`;
        stEl.parentElement.appendChild(d);
    }
}, 500);


// 🐍 ПАТЧ V61: АВТО-ПОДГРУЗКА RAM-БУФЕРА + ЧЕСТНОЕ ВЫКЛЮЧЕНИЕ RAM БЕЗ ЗАВИСАНИЯ ОСЦИЛЛОГРАФА

;(function() {
    const fixDarkCheckboxColor = () => {
        if (window.appConfig && (window.appConfig.checkboxColor === '#000000' || window.appConfig.checkboxColor === '#0d1117')) {
            window.appConfig.checkboxColor = '#3fb950';
            document.documentElement.style.setProperty('--accent-green', '#3fb950');
            localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
        }
    };
    fixDarkCheckboxColor();
    setTimeout(fixDarkCheckboxColor, 400);
})();

// Если по любой причине studioBuffer ещё не декодирован, подгружает его на лету из кэша или сети!
window._loadingStudioBufV61 = false;
window.ensureStudioBufferLoadedV61 = async function() {
    if (window.studioBuffer || window._loadingStudioBufV61 || !window.currentPlayingTrack || window._userPausedV75_2) return;
    if (String(window.currentPlayingTrack || '').indexOf('[YT Поток]') === 0) return;
    if (typeof window.initAudioBoost === 'function') window.initAudioBoost();
    if (!window.audioCtx) return;

    window._loadingStudioBufV61 = true;
    try {
        const trackName = window.currentPlayingTrack;
        let blob = (window._lastTrackBlob && window._lastTrackBlobName === trackName) ? window._lastTrackBlob : null;
        if (!blob) {
            const res = await fetch('/api/media/' + encodeURIComponent(trackName));
            blob = await res.blob();
            window._lastTrackBlob = blob;
            window._lastTrackBlobName = trackName;
        }
        const ab = await blob.arrayBuffer();
        const decoded = await window.audioCtx.decodeAudioData(ab);
        if (window.currentPlayingTrack === trackName) {
            window.studioBuffer = decoded;
            if (window.appConfig && window.appConfig.opt_autoRms && typeof window.computeBufferAutoGain === 'function') {
                window.computeBufferAutoGain(decoded, window.appConfig.val_autoRms);
            }
            if (typeof window.updateAutoRmsGainsSmoothV264 === 'function') {
                window.updateAutoRmsGainsSmoothV264(decoded);
            } else if (typeof window.buildAudioGraph === 'function') {
                window.buildAudioGraph(false);
            }
            if (!window.reversedStudioBuffer && typeof window.cloneAndReverseBuffer === 'function') {
                window.reversedStudioBuffer = await window.cloneAndReverseBuffer(decoded);
            }
            window._loadingStudioBufV61 = false;
            if (!window._userPausedV75_2) {
                window.syncMasterPlaybackEngineV59(false);
            }
            return;
        }
    } catch (e) {}
    window._loadingStudioBufV61 = false;
};

window.getActiveTargetSpeedV59 = function() {
    const player = document.getElementById('audioPlayer');
    if (window.scrubState && (window.scrubState.active || window.scrubState.locked) && window.scrubState.speed) {
        return parseFloat(window.scrubState.speed) || 1.0;
    }
    if (window.persistedPlaybackSpeed && window.persistedPlaybackSpeed !== 10.0) {
        return parseFloat(window.persistedPlaybackSpeed) || 1.0;
    }
    if (typeof window.getTargetPlaybackSpeed === 'function') {
        return parseFloat(window.getTargetPlaybackSpeed()) || 1.0;
    }
    return (player && player.playbackRate && player.playbackRate !== 10.0) ? player.playbackRate : 1.0;
};

const _pureV52ApplyHose = window.applyElasticHoseBufferLiveV46;

window.syncMasterPlaybackEngineV59 = function(isDraggingArc) {
    const player = document.getElementById('audioPlayer');
    if (!player) return;

    const hoseChk = document.getElementById('cfg_elasticHoseV44');
    const pitchChk = document.getElementById('cfg_pitchLock');
    const studioChk = document.getElementById('cfg_studioMode');
    const badge = document.getElementById('hoseLiveTelemetryV44');

    const gKey = (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
    const isStudioRam = Boolean(studioChk ? studioChk.checked : (window.appConfig && window.appConfig.studioMode));
    const isHose = Boolean(gKey === 'jbuf-lock' || (hoseChk ? hoseChk.checked : (window.appConfig && window.appConfig.elasticHoseMode)));
    const isWebApiPitch = Boolean(pitchChk ? pitchChk.checked : (window.appConfig && window.appConfig.pitchLock));
    const targetSpd = window.getActiveTargetSpeedV59();
    const isRev = Boolean(window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed));

    // Если буфера ещё нет в памяти, запускаем фоновую подгрузку, чтобы осциллограф и RAM работали без зависаний
    if (!window.studioBuffer && window.currentPlayingTrack) {
        window.ensureStudioBufferLoadedV61();
    }

    // РЕЖИМ 1: 🐍 НАШ УПРУГИЙ ШЛАНГ V52
    if (isHose) {
        if (badge) badge.style.color = '#58a6ff';
        if (!window.studioBuffer) {
            // Пока буфер декодируется (доли секунды), не глушим звук — пусть играет HTML5, а как декодируется, сам включится V52!
            if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 1.0;
            if (badge) badge.innerText = `⏳ Декодирование в RAM...`;
            return;
        }
        return _pureV52ApplyHose(isDraggingArc);
    }

    // Останавливаем и ОБНУЛЯЕМ studioSourceNode
    if (window.studioSourceNode) {
        window.studioSourceNode.onended = null;
        try { window.studioSourceNode.stop(); } catch (e) {}
        try { window.studioSourceNode.disconnect(); } catch (e) {}
        window.studioSourceNode = null;
    }
    window.isStudioPlaying = false;

    // РЕЖИМ 2: 🌐 ШТАТНЫЙ WEBAPI PITCH LOCK (HTML5 <audio> с preservesPitch = true)
    if (isWebApiPitch && !isRev) {
        if (window.htmlGain && window.htmlGain.gain) {
            window.htmlGain.gain.value = 1.0;
        }
        player.preservesPitch = true;
        player.mozPreservesPitch = true;
        player.webkitPreservesPitch = true;
        if (Math.abs(player.playbackRate - targetSpd) > 0.002) {
            player.playbackRate = targetSpd;
        }
        if (badge) {
            badge.style.color = '#e3b341';
            badge.innerText = `🌐 WebAPI PitchLock | x${targetSpd.toFixed(2)}`;
        }
        return;
    }

    // РЕЖИМ 3: 💿 ЧИСТЫЙ ВИНИЛ (БЕЗ PITCH LOCK — меняется высота тона вместе со скоростью)
    player.preservesPitch = false;
    player.mozPreservesPitch = false;
    player.webkitPreservesPitch = false;
    if (Math.abs(player.playbackRate - targetSpd) > 0.002) {
        player.playbackRate = targetSpd;
    }

    if (isStudioRam && window.studioBuffer && window.audioCtx) {
        if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 0.0;
        if (!player.paused) {
            const rawBuf = isRev ? (window.reversedStudioBuffer || window.studioBuffer) : window.studioBuffer;
            window.studioSourceNode = window.audioCtx.createBufferSource();
            window.studioSourceNode._isHoseSpliced = false;
            window.studioSourceNode.buffer = rawBuf;
            window.studioSourceNode.playbackRate.value = targetSpd;
            window.studioSourceNode.connect(window.inputMixer);
            let pos = player.currentTime || 0;
            if (!isFinite(pos) || pos < 0 || pos >= rawBuf.duration) pos = 0;
            window.studioSourceNode.start(0, pos);
            window.isStudioPlaying = true;
        }
    } else {
        if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 1.0;
    }

    if (badge) {
        badge.style.color = '#8b949e';
        badge.innerText = `💿 Винил (${isRev ? '⏪ Реверс' : 'Без PitchLock'}) | x${targetSpd.toFixed(2)}`;
    }
};

window.applyElasticHoseBufferLiveV46 = function(isDraggingArc) {
    return window.syncMasterPlaybackEngineV59(isDraggingArc);
};

window.onToggleElasticHoseV44 = function(chk, ev) {
    const enabled = Boolean(chk && chk.checked);
    window.appConfig = window.appConfig || {};
    window.appConfig.elasticHoseMode = enabled;

    const pitchChk = document.getElementById('cfg_pitchLock');
    const studioChk = document.getElementById('cfg_studioMode');
    if (enabled) {
        if (pitchChk && pitchChk.checked) {
            pitchChk.checked = false;
            window.appConfig.pitchLock = false;
        }
        // Если включаем наш Шланг, автоматически включаем и тумблер Студийного движка (RAM)
        if (studioChk && !studioChk.checked) {
            studioChk.checked = true;
            window.appConfig.studioMode = true;
        }
    }

    window.installHosePlayerHooksV46();
    window.syncMasterPlaybackEngineV59(false);

    if (typeof window.showToast === 'function' && ev) {
        if (enabled) {
            window.showToast('🐍 Включён наш 90° Профильный Резак V52!', ev);
        } else {
            const isWeb = Boolean(pitchChk && pitchChk.checked);
            window.showToast(isWeb ? '🌐 Включён штатный WebAPI PitchLock!' : '💿 Включён Винил (без PitchLock)!', ev);
        }
    }
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    if (typeof window.saveThemeOnlyQuietlyV40 === 'function') window.saveThemeOnlyQuietlyV40();
};

setTimeout(() => {
    const pitchChk = document.getElementById('cfg_pitchLock');
    const studioChk = document.getElementById('cfg_studioMode');

    if (studioChk && !studioChk._hookedV61) {
        studioChk._hookedV61 = true;
        studioChk.addEventListener('change', (ev) => {
            window.appConfig = window.appConfig || {};
            window.appConfig.studioMode = studioChk.checked;
            const hoseChk = document.getElementById('cfg_elasticHoseV44');
            const titleEl = document.getElementById('nowPlaying');
            if (!studioChk.checked && hoseChk && hoseChk.checked) {
                // Если пользователь вручную выключил RAM, выключаем и галочку Шланга, чтобы плеер честно перешел на HTML5!
                hoseChk.checked = false;
                window.appConfig.elasticHoseMode = false;
                if (typeof window.showToast === 'function') {
                    window.showToast('🎵 RAM выключен: переход на штатный HTML5 поток', ev);
                }
            }
            if (titleEl && window.currentPlayingTrack) {
                titleEl.innerText = (studioChk.checked ? "RAM 🚀: " : "") + window.currentPlayingTrack;
            }
            localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
            window.syncMasterPlaybackEngineV59(false);
        });
    }

    if (pitchChk && !pitchChk._hookedV61) {
        pitchChk._hookedV61 = true;
        if (window.appConfig && window.appConfig.elasticHoseMode && pitchChk.checked) {
            pitchChk.checked = false;
            window.appConfig.pitchLock = false;
        }
        pitchChk.onchange = function(ev) {
            window.appConfig = window.appConfig || {};
            window.appConfig.pitchLock = pitchChk.checked;
            const hChk = document.getElementById('cfg_elasticHoseV44');
            if (pitchChk.checked && hChk && hChk.checked) {
                hChk.checked = false;
                window.appConfig.elasticHoseMode = false;
            }
            if (typeof window.updateSettings === 'function') window.updateSettings();
            window.syncMasterPlaybackEngineV59(false);
            if (typeof window.showToast === 'function') {
                window.showToast(pitchChk.checked ? '🌐 Включён штатный WebAPI PitchLock!' : '💿 Включён Винил (без PitchLock)!', ev);
            }
        };
    }
    window.syncMasterPlaybackEngineV59(false);
}, 500);

// ✂️ СЭМПЛ-РЕЗАК В /storage/emulated/0/Music/mp3_test
window.encodeAudioBufferToWavB64V59 = function(audioBuf) {
    const numCh = audioBuf.numberOfChannels, sr = audioBuf.sampleRate, len = audioBuf.length;
    const blockAlign = numCh * 4, dataSize = len * blockAlign;
    const buf = new ArrayBuffer(44 + dataSize), view = new DataView(buf);
    const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
    writeStr(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); writeStr(8, 'WAVE');
    writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 3, true);
    view.setUint16(22, numCh, true); view.setUint32(24, sr, true);
    view.setUint32(28, sr * blockAlign, true); view.setUint16(32, blockAlign, true); view.setUint16(34, 32, true);
    writeStr(36, 'data'); view.setUint32(40, dataSize, true);
    const chData = [];
    for (let c = 0; c < numCh; c++) chData.push(audioBuf.getChannelData(c));
    let offset = 44;
    for (let i = 0; i < len; i++) {
        for (let c = 0; c < numCh; c++) { view.setFloat32(offset, chData[c][i], true); offset += 4; }
    }
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(binary);
};

window.mapModSampleToOrigV59 = function(modSample, logs, spd, origLen) {
    if (!logs || !logs.length) return Math.min(origLen - 1, Math.max(0, Math.round(modSample * spd)));
    let lastSeam = null;
    for (let i = 0; i < logs.length; i++) {
        if (logs[i].outPos <= modSample) lastSeam = logs[i];
        else break;
    }
    if (!lastSeam) return Math.min(origLen - 1, Math.max(0, modSample));
    return Math.min(origLen - 1, Math.max(0, lastSeam.p2 + (modSample - lastSeam.outPos)));
};

window._hoseTestSliceV59 = { origBuf: null, modBuf: null, activeNode: null };

window.cutAndSaveV52SliceV59 = function(grabTime, saveToDisk) {
    if (!window.studioBuffer || !window.audioCtx) return;
    const player = document.getElementById('audioPlayer');
    const startInp = document.getElementById('v59SliceStartSec');
    const durInp = document.getElementById('v59SliceDurMs');
    if (grabTime && player && startInp) startInp.value = (player.currentTime || 0).toFixed(3);

    const targetSpd = window.getActiveTargetSpeedV59();
    const tensionPct = (window.appConfig && window.appConfig.hoseTensionPct !== undefined) ? window.appConfig.hoseTensionPct : 100;
    const activeModBuf = window.buildElasticHoseBufferV46(window.studioBuffer, targetSpd, tensionPct);

    const cache = window._hoseSplicerCacheV46 || {};
    const sr = window.studioBuffer.sampleRate, numCh = window.studioBuffer.numberOfChannels;
    const origTotal = window.studioBuffer.length, modTotal = activeModBuf.length;

    const trackSec = Math.max(0, parseFloat(startInp ? startInp.value : 15.0) || 15.0);
    const durMs = Math.max(20, parseFloat(durInp ? durInp.value : 500) || 500);

    const modStart = Math.min(modTotal - 64, Math.max(0, Math.round((trackSec / targetSpd) * sr)));
    const modLen = Math.max(64, Math.min(modTotal - modStart, Math.round((durMs / 1000) * sr)));
    const modEnd = modStart + modLen - 1;

    const origStart = window.mapModSampleToOrigV59(modStart, cache.seamLogs, targetSpd, origTotal);
    let origEnd = window.mapModSampleToOrigV59(modEnd, cache.seamLogs, targetSpd, origTotal);
    if (origEnd <= origStart) origEnd = Math.min(origTotal - 1, origStart + modLen);
    const origLen = origEnd - origStart + 1;

    const origBuf = window.audioCtx.createBuffer(numCh, origLen, sr);
    const modBuf = window.audioCtx.createBuffer(numCh, modLen, sr);
    const edgeLock = Math.min(32, Math.floor(modLen / 4));

    for (let c = 0; c < numCh; c++) {
        const oIn = window.studioBuffer.getChannelData(c), mIn = activeModBuf.getChannelData(c);
        const oSl = origBuf.getChannelData(c), mSl = modBuf.getChannelData(c);
        oSl.set(oIn.subarray(origStart, origEnd + 1));
        mSl.set(mIn.subarray(modStart, modEnd + 1));
        const sDiff = oSl[0] - mSl[0], eDiff = oSl[origLen - 1] - mSl[modLen - 1];
        for (let k = 0; k < edgeLock; k++) {
            const w = 1.0 - (k / edgeLock);
            mSl[k] += sDiff * (w * w);
            mSl[modLen - 1 - k] += eDiff * (w * w);
        }
        mSl[0] = oSl[0];
        mSl[modLen - 1] = oSl[origLen - 1];
    }

    window._hoseTestSliceV59.origBuf = origBuf;
    window._hoseTestSliceV59.modBuf = modBuf;

    const o0 = origBuf.getChannelData(0), m0 = modBuf.getChannelData(0);
    const seams = (cache.seamLogs || []).filter(s => s.outPos >= modStart && s.outPos <= modEnd);
    const rep = [
        `=== ✂️ V61 (ЧИСТОЕ ЯДРО V52) СРЕЗ x${targetSpd.toFixed(2)} ===`,
        `Трек: ${window.currentPlayingTrack || 'Track'} | Avg_dy по треку: ${((cache.avgSeamErrMv||0)*100).toFixed(2)}%`,
        `Кусок ШЛАНГА (x${targetSpd.toFixed(2)}): modSample #${modStart}..#${modEnd} (${modLen} сэмплов / ${(modLen/sr*1000).toFixed(1)} мс)`,
        `Кусок ОРИГИНАЛА (x1.00): origSample #${origStart}..#${origEnd} (${origLen} сэмплов / ${(origLen/sr*1000).toFixed(1)} мс)`,
        `СТАРТ (#${origStart}): Ориг[0]=${o0[0].toFixed(6)} | Изм[0]=${m0[0].toFixed(6)} | Diff=${Math.abs(o0[0]-m0[0]).toFixed(6)}`,
        `ФИНИШ (#${origEnd}): Ориг[end]=${o0[origLen-1].toFixed(6)} | Изм[end]=${m0[modLen-1].toFixed(6)} | Diff=${Math.abs(o0[origLen-1]-m0[modLen-1]).toFixed(6)}`,
        `--- ШВЫ ВНУТРИ КУСКА (${seams.length} шт.) ---`,
        ...seams.slice(0, 12).map(s => `#${s.idx} @${s.t.toFixed(3)}s | shift:${s.shift} | dy:${s.dy.toFixed(4)} | sA:${s.sA.toFixed(4)} sB:${s.sB.toFixed(4)}`)
    ].join('\n');

    const ta = document.getElementById('hoseDebugTextAreaV52');
    if (ta) ta.value = rep;
    if (navigator.clipboard) navigator.clipboard.writeText(rep).catch(()=>{});

    if (saveToDisk) {
        fetch('/api/save_test_slices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                track: window.currentPlayingTrack || 'track',
                speed_str: `x${targetSpd.toFixed(2)}`,
                orig_start: origStart,
                orig_end: origEnd,
                orig_wav_b64: window.encodeAudioBufferToWavB64V59(origBuf),
                hose_wav_b64: window.encodeAudioBufferToWavB64V59(modBuf),
                report_txt: rep
            })
        }).then(r => r.json()).then(res => {
            if (res.status === 'ok' && typeof window.showToast === 'function') {
                window.showToast(`💾 Сохранено в /Music/mp3_test: ${res.prefix}`);
            }
        }).catch(()=>{});
    }
};

window.playTestSliceV59 = function(mode) {
    const st = window._hoseTestSliceV59;
    if (!st.origBuf || !st.modBuf) window.cutAndSaveV52SliceV59(false, false);
    if (!st.origBuf || !window.audioCtx) return;
    const player = document.getElementById('audioPlayer');
    if (player && !player.paused) player.pause();
    if (st.activeNode) { try { st.activeNode.stop(); st.activeNode.disconnect(); } catch(e){} }
    const playBuf = (b, next) => {
        const src = window.audioCtx.createBufferSource();
        src.buffer = b;
        src.connect(window.inputMixer || window.audioCtx.destination);
        src.onended = next || null;
        st.activeNode = src;
        src.start(0);
    };
    if (mode === 'mod') playBuf(st.modBuf);
    else if (mode === 'orig') playBuf(st.origBuf);
    else if (mode === 'ab') playBuf(st.modBuf, () => setTimeout(() => playBuf(st.origBuf), 150));
};

setTimeout(() => {
    const ta = document.getElementById('hoseDebugTextAreaV52');
    if (ta && !document.getElementById('hoseSliceBoxV59')) {
        const box = document.createElement('div');
        box.id = 'hoseSliceBoxV59';
        box.style.cssText = 'margin-top:6px;border-top:1px solid #21262d;padding-top:6px;';
        box.innerHTML = `
            <div style="font-size:10px;color:#58a6ff;font-weight:bold;margin-bottom:4px;">✂️ Сэмпл-Резак V61 (Чистое ядро V52 + /Music/mp3_test):</div>
            <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-bottom:5px;">
                <span style="font-size:10px;color:#8b949e;">Поз(с):</span>
                <input type="number" id="v59SliceStartSec" value="15.000" step="0.1" style="width:58px;font-size:10px;background:#0d1117;color:#fff;border:1px solid #30363d;border-radius:4px;padding:2px 4px;">
                <button type="button" onclick="window.cutAndSaveV52SliceV59(true, true)" style="font-size:10px;padding:2px 6px;border-radius:4px;border:1px solid #3fb950;background:#161b22;color:#3fb950;">📍 С плеера + В mp3_test</button>
                <span style="font-size:10px;color:#8b949e;">Мс:</span>
                <input type="number" id="v59SliceDurMs" value="500" step="50" style="width:48px;font-size:10px;background:#0d1117;color:#fff;border:1px solid #30363d;border-radius:4px;padding:2px 4px;">
                <button type="button" onclick="window.cutAndSaveV52SliceV59(false, true)" style="font-size:10px;padding:2px 7px;border-radius:4px;border:1px solid #58a6ff;background:#161b22;color:#58a6ff;">💾 Вырезать в mp3_test</button>
            </div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;">
                <button type="button" onclick="window.playTestSliceV59('mod')" style="flex:1;font-size:10px;padding:3px 6px;border-radius:4px;border:1px solid #3fb950;background:#161b22;color:#3fb950;">▶️ Кусок Шланга</button>
                <button type="button" onclick="window.playTestSliceV59('orig')" style="flex:1;font-size:10px;padding:3px 6px;border-radius:4px;border:1px solid #8b949e;background:#161b22;color:#c9d1d9;">▶️ Кусок Ориг</button>
                <button type="button" onclick="window.playTestSliceV59('ab')" style="flex:1;font-size:10px;padding:3px 6px;border-radius:4px;border:1px solid #f0883e;background:#161b22;color:#f0883e;">🔁 Сравнить Шланг➔Ориг</button>
            </div>
        `;
        ta.parentElement.appendChild(box);
    }
}, 600);

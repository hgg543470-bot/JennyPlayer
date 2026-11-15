/* ============================================================================
 * ui_seams.js — Карта швов и обратная сборка чистой волны для обратимого экспорта (V67)
 *
 * Склейка:  /bundle_1_studio.js, модуль 11 из 12. Порядок модулей задан в player.py и менять его нельзя:
 *           поздние модули переопределяют и оборачивают функции ранних.
 * Внутри:   buildReversibleExportDataV67, reconstructOriginalBufferV67, loadTrackReversibleDataV67
 * Откуда:   ui_help.js (коммит 9ae6639), строки 5068–5414. Код блоков перенесён без правок.
 * Подробно: FILES.md (карта файлов), REFACTOR_PLAN.md (как резалось и что перекрыто).
 * ============================================================================ */



// 🧬 ПАТЧ V67 (ЭТАП 1): СБОРЩИК КАРТЫ ШВОВ И КАРМАНА ОБРЕЗКОВ ДЛЯ ОБРАТИМОГО ЭКСПОРТА

window.buildReversibleExportDataV67 = function(srcBuffer, speed, tensionPct, gearKey, isRev, dspDna) {
    if (!srcBuffer || !window.audioCtx) return null;
    const spd = Math.max(0.1, Math.min(100.0, parseFloat(speed) || 1.0));
    const tension = parseFloat(tensionPct) || 100;
    const gKey = gearKey || (window.appConfig && window.appConfig.gearKeyV66) || 'jbuf-lock';
    const isJbufLock = (gKey === 'jbuf-lock');

    const sr = srcBuffer.sampleRate;
    const numCh = srcBuffer.numberOfChannels;
    const origLen = srcBuffer.length;
    const baseStep = Math.max(512, Math.round(0.018 * sr));
    const filletLen = Math.max(128, Math.round(0.0045 * sr));

    // Для режимов без нарезки (Винил, JBUF Shift, WebAPI) сохраняем паспорт скорости и длины
    if (!isJbufLock || Math.abs(spd - 1.0) <= 0.002) {
        return {
            seamMapJson: JSON.stringify({
                v: 67,
                mode: gKey,
                spd: spd,
                rev: Boolean(isRev),
                sr: sr,
                numCh: numCh,
                origLen: origLen,
                outLen: Math.round(origLen / spd),
                initCopy: Math.min(baseStep, origLen),
                filletLen: filletLen,
                dspDna: dspDna || null,
                seams: []
            }),
            pocketWavBlob: null,
            seamCount: 0,
            pocketSamples: 0
        };
    }

    // Гарантируем, что буфер JBUF 90° и его массив seamLogs свежесобраны под этот srcBuffer
    const splicedBuf = window.buildElasticHoseBufferV46(srcBuffer, spd, tension);
    const cache = window._hoseSplicerCacheV46 || {};
    const logs = cache.seamLogs || [];

    // Считаем суммарную длину вырезанных участков (когда p2 > p1 при ускорении > 1.0x)
    // Сохраняем участок chIn[p1 .. p2 + filletLen], чтобы при восстановлении полностью заменить зону кроссфейда чистым оригиналом!
    const needPocket = (Math.abs(spd - 1.0) > 0.002);
    let totalPocketFrames = 0;
    const compactSeams = [];

    for (let i = 0; i < logs.length; i++) {
        const s = logs[i];
        const sFillet = s.filletLen || filletLen;
        let pckOff = -1;
        let pckLen = 0;

        if (s.p2 > s.p1) {
            const cutStart = s.p1;
            const cutEnd = Math.min(origLen, s.p2 + sFillet);
            pckLen = Math.max(0, cutEnd - cutStart);
            if (pckLen > 0) {
                pckOff = totalPocketFrames;
                totalPocketFrames += pckLen;
            }
        } else if (s.p2 < s.p1 && (s.p1 - s.p2) < sFillet) {
            const cutStart = s.p2;
            const cutEnd = Math.min(origLen, s.p2 + sFillet);
            pckLen = Math.max(0, cutEnd - cutStart);
            if (pckLen > 0) {
                pckOff = totalPocketFrames;
                totalPocketFrames += pckLen;
            }
        }

        // Формат записи шва: [outPos, stepOut, advK, p1, p2, gainInt, pckOff, pckLen]
        compactSeams.push([
            s.outPos,
            s.stepOut || baseStep,
            s.advK || 0,
            s.p1,
            s.p2,
            Math.round((s.targetGain || 1.0) * 10000),
            pckOff,
            pckLen
        ]);
    }
    if (needPocket && logs.length > 0) {
        const lastS = logs[logs.length - 1];
        const tailStartOrig = lastS.p2 + (lastS.stepOut || baseStep);
        const tailOutPos = lastS.outPos + (lastS.stepOut || baseStep);
        if (tailStartOrig < origLen - 16) {
            const tailLen = origLen - tailStartOrig;
            compactSeams.push([
                tailOutPos,
                0,
                0,
                tailStartOrig,
                origLen,
                10000,
                totalPocketFrames,
                tailLen
            ]);
            totalPocketFrames += tailLen;
        }
    }

    let pocketWavBlob = null;
    if (needPocket && totalPocketFrames > 0 && typeof bufferToWav === 'function') {
        const pocketBuf = window.audioCtx.createBuffer(numCh, totalPocketFrames, sr);
        for (let c = 0; c < numCh; c++) {
            const inp = srcBuffer.getChannelData(c);
            const pOut = pocketBuf.getChannelData(c);
            for (let i = 0; i < compactSeams.length; i++) {
                const cs = compactSeams[i];
                const pOff = cs[6];
                const pLen = cs[7];
                const pStart = (cs[4] > cs[3]) ? cs[3] : cs[4];
                if (pOff >= 0 && pLen > 0) {
                    pOut.set(inp.subarray(pStart, pStart + pLen), pOff);
                }
            }
        }
        pocketWavBlob = bufferToWav(pocketBuf, pocketBuf.length);
    }

    const seamMapObj = {
        v: 67,
        mode: gKey,
        spd: spd,
        tension: tension,
        rev: Boolean(isRev),
        sr: sr,
        numCh: numCh,
        origLen: origLen,
        outLen: splicedBuf ? splicedBuf.length : Math.round(origLen / spd),
        initCopy: Math.min(baseStep, origLen),
        filletLen: filletLen,
        dspDna: dspDna || null,
        pocketFrames: totalPocketFrames,
        seams: compactSeams
    };

    return {
        seamMapJson: JSON.stringify(seamMapObj),
        pocketWavBlob: pocketWavBlob,
        seamCount: compactSeams.length,
        pocketSamples: totalPocketFrames
    };
};


// 🧬 ПАТЧ V67 (ЭТАП 2): ОБРАТНЫЙ СБОРЩИК ЧИСТОЙ ВОЛНЫ 1.0x В RAM ПРИ ВОСПРОИЗВЕДЕНИИ

window.reconstructedMasterBufferV67 = null;
window.reconstructedReversedBufferV67 = null;
window.currentTrackRevMapV67 = null;
window.currentTrackRevNameV67 = null;

window.reconstructOriginalBufferV67 = function(exportedBuf, smap, pocketBuf) {
    if (!exportedBuf || !smap || !window.audioCtx) return null;
    const sr = exportedBuf.sampleRate;
    const numCh = exportedBuf.numberOfChannels;
    const expLen = exportedBuf.length;
    const origLen = Math.max(1024, parseInt(smap.origLen, 10) || Math.round(expLen * (parseFloat(smap.spd) || 1.0)));
    const seams = smap.seams || [];

    const origBuf = window.audioCtx.createBuffer(numCh, origLen, sr);

    // 1. Если трек сохранялся в режиме Pitch-Shift (Винил / JBUF Shift / Web Shift) без разрезов —
    // восстанавливаем исходную сетку 1.0x кубической интерполяцией Эрмита
    if (seams.length === 0 && Math.abs((parseFloat(smap.spd) || 1.0) - 1.0) > 0.002) {
        const ratio = expLen / origLen;
        for (let c = 0; c < numCh; c++) {
            const inp = exportedBuf.getChannelData(c);
            const out = origBuf.getChannelData(c);
            for (let i = 0; i < origLen; i++) {
                const pos = i * ratio;
                const idx = Math.floor(pos);
                const frac = pos - idx;
                const y0 = inp[Math.max(0, idx - 1)] || 0;
                const y1 = inp[Math.min(expLen - 1, idx)] || 0;
                const y2 = inp[Math.min(expLen - 1, idx + 1)] || 0;
                const y3 = inp[Math.min(expLen - 1, idx + 2)] || 0;
                const c0 = y1;
                const c1 = 0.5 * (y2 - y0);
                const c2 = y0 - 2.5 * y1 + 2.0 * y2 - 0.5 * y3;
                const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
                out[i] = ((c3 * frac + c2) * frac + c1) * frac + c0;
            }
        }
        return origBuf;
    }

    if (seams.length === 0) return exportedBuf;

    // 2. Пошаговая реконструкция эталонной волны 1.0x по карте швов JBUF 90° и карману обрезков
    const filletLen = smap.filletLen || Math.max(128, Math.round(0.0045 * sr));
    const feather = 24;

    for (let c = 0; c < numCh; c++) {
        const exp = exportedBuf.getChannelData(c);
        const orig = origBuf.getChannelData(c);
        const pck = (pocketBuf && c < pocketBuf.numberOfChannels) ? pocketBuf.getChannelData(c) : null;

        // Копируем стартовый участок до первого шва (0 .. p1_0)
        const s0 = seams[0];
        const initEnd = Math.min(s0[0], s0[3], expLen, origLen);
        for (let i = 0; i < initEnd; i++) {
            orig[i] = exp[i];
        }
        let filledUpTo = initEnd;
        let smoothGain = 1.0;

        for (let k = 0; k < seams.length; k++) {
            const s = seams[k];
            const outPos = s[0];
            const stepOut = s[1];
            const advK = s[2];
            const p1 = s[3];
            const p2 = s[4];
            const targetGain = (s[5] || 10000) / 10000.0;
            const pckOff = s[6];
            const pckLen = s[7];

            const nextOutPos = (k + 1 < seams.length) ? seams[k + 1][0] : expLen;
            const blockLen = Math.max(0, Math.min(expLen - outPos, nextOutPos - outPos));

            // Предварительно просчитываем кривую огибающей localGain на этом шаге, чтобы точно обратить её
            let localGain = smoothGain;

            // СЛУЧАЙ А: Ускорение (p2 > p1) — возвращаем вырезанный участок [p1 .. p2 + filletLen] из кармана pck
            if (p2 > p1 && pck && pckOff >= 0 && pckLen > 0) {
                for (let j = 0; j < pckLen; j++) {
                    const dstIdx = p1 + j;
                    if (dstIdx >= origLen) break;
                    const pv = pck[Math.min(pck.length - 1, pckOff + j)];
                    if (j < feather && dstIdx < filledUpTo) {
                        const w = 0.5 * (1.0 - Math.cos(Math.PI * (j / feather)));
                        orig[dstIdx] = orig[dstIdx] * (1.0 - w) + pv * w;
                    } else {
                        orig[dstIdx] = pv;
                    }
                }
                filledUpTo = Math.max(filledUpTo, Math.min(origLen, p1 + pckLen));
            }

            // Копируем чистый хвост блока из exp[outPos + i] в orig[p2 + i], отсекая клонированные участки и кроссфейды
            for (let i = 0; i < blockLen; i++) {
                if (i < stepOut) {
                    localGain = localGain * 0.997 + targetGain * 0.003;
                }
                const dstIdx = p2 + i;
                if (dstIdx < 0 || dstIdx >= origLen) continue;
                const srcIdx = outPos + i;
                if (srcIdx >= expLen) break;

                const cleanVal = exp[srcIdx] / Math.max(0.25, localGain);

                if (dstIdx < filledUpTo - feather) {
                    // Этот участок уже заполнен чистым оригиналом из предыдущего блока или кармана (пропускаем дубль/шов!)
                    continue;
                } else if (dstIdx < filledUpTo) {
                    // Мягкая 24-сэмпловая сшивка на границе стыка двух идентичных участков
                    const rem = filledUpTo - dstIdx;
                    const w = 0.5 * (1.0 - Math.cos(Math.PI * ((feather - rem) / feather)));
                    orig[dstIdx] = orig[dstIdx] * (1.0 - w) + cleanVal * w;
                } else {
                    orig[dstIdx] = cleanVal;
                }
            }

            smoothGain = localGain;
            filledUpTo = Math.max(filledUpTo, Math.min(origLen, p2 + blockLen));
        }

        // Если в самом конце остались сэмплы хвоста — дописываем их
        const lastSeam = seams[seams.length - 1];
        let tailOut = lastSeam[0] + lastSeam[1];
        let tailOrig = filledUpTo;
        while (tailOrig < origLen && tailOut < expLen) {
            orig[tailOrig++] = exp[tailOut++];
        }
    }

    return origBuf;
};

window.loadTrackReversibleDataV67 = async function(filename, decodedBuffer) {
    window.reconstructedMasterBufferV67 = null;
    window.reconstructedReversedBufferV67 = null;
    window.currentTrackRevMapV67 = null;
    window.currentTrackRevNameV67 = null;

    if (!filename || !decodedBuffer || !window.audioCtx) return;

    try {
        const res = await fetch('/api/rev_info/' + encodeURIComponent(filename));
        if (!res.ok) return;
        const info = await res.json();
        if (!info || !info.has_rev || !info.seam_map) return;
        window.currentTrackRevMapV67 = info.seam_map;
        window.currentTrackRevNameV67 = filename;
        window.reconstructedMasterBufferV67 = decodedBuffer;
        if (typeof window.updateDna1xButtonUIV76 === 'function') window.updateDna1xButtonUIV76();

        let pocketBuf = null;
        if (info.pocket_bytes && info.pocket_bytes > 0) {
            let pRes = await fetch('/api/rev_pocket/' + encodeURIComponent(filename) + '?key=' + encodeURIComponent(window._lastPocketKeyV78 || ''));
            if (pRes.status === 403) {
                const usrKey = prompt('🔐 Этот трек зашифрован паролем. Введи ключ для распаковки оригинала 1.0x:', '');
                if (usrKey !== null) {
                    window._lastPocketKeyV78 = usrKey.trim();
                    pRes = await fetch('/api/rev_pocket/' + encodeURIComponent(filename) + '?key=' + encodeURIComponent(window._lastPocketKeyV78));
                }
            }
            if (pRes.ok) {
                const pAb = await pRes.arrayBuffer();
                pocketBuf = await window.audioCtx.decodeAudioData(pAb);
            }
        }

        if (window.currentPlayingTrack !== filename) return;

        const t0 = performance.now();
        const raw1x = window.reconstructOriginalBufferV67(decodedBuffer, info.seam_map, pocketBuf);
        window.rawReconstructed1xBufferV76 = raw1x;
        window.lastPocketBufferV76 = pocketBuf;
        const master1x = (typeof window.applyInverseDspCompensationV76 === 'function' && window.antiDspEnabledV76)
            ? await window.applyInverseDspCompensationV76(raw1x, info.seam_map)
            : raw1x;
        const buildMs = Math.round(performance.now() - t0);

        if (master1x && window.currentPlayingTrack === filename) {
            window.reconstructedMasterBufferV67 = master1x;
            window.currentTrackRevMapV67 = info.seam_map;
            window.currentTrackRevNameV67 = filename;
            window.currentTrackRevBuildMsV67 = buildMs;

            setTimeout(async () => {
                if (window.currentPlayingTrack === filename && !window.reconstructedReversedBufferV67 && typeof window.cloneAndReverseBuffer === 'function') {
                    window.reconstructedReversedBufferV67 = await window.cloneAndReverseBuffer(master1x);
                }
            }, 40);

            if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
                window.syncMasterPlaybackEngineV59(false);
            }
        }
    } catch (e) {}
};

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os, re

BASE_DIR = "/storage/emulated/0/scripts/JennyPlayer"
if not os.path.exists(BASE_DIR):
    BASE_DIR = os.getcwd()

V204_TUNER_INIT = r"""    window._jennyTunerV190 = window._jennyTunerV190 || {
        dupThresh:    parseFloat(localStorage.getItem('jt190_dupThresh')    || '10'),
        targetFps:    parseFloat(localStorage.getItem('jt190_targetFps')    || '120'),
        interpFrames: parseFloat(localStorage.getItem('jt190_interpFrames') || '0'),
        flowScale:    parseFloat(localStorage.getItem('jt190_flowScale')    || '0.85'),
        ghostGate:    parseFloat(localStorage.getItem('jt190_ghostGate')    || '0.12'),
        detailGuard:  parseFloat(localStorage.getItem('jt190_detailGuard')  || '0.45'),
        bridgeSpread: parseFloat(localStorage.getItem('jt190_bridgeSpread') || '0.35'),
        searchRadius: parseFloat(localStorage.getItem('jt190_searchRadius') || '15.0'),
        inkGuard:     parseFloat(localStorage.getItem('jt190_inkGuard')     || '0.50'),
        pllSmooth:    parseFloat(localStorage.getItem('jt190_pllSmooth')    || '0.85')
    };
    if (isNaN(window._jennyTunerV190.dupThresh)) window._jennyTunerV190.dupThresh = 10;
    if (isNaN(window._jennyTunerV190.targetFps)) window._jennyTunerV190.targetFps = 120;"""

V204_UNLEASHED_LOOP = r"""    var baseFrameMs = 41.667;
    var uniqueSpanMs = 41.667;
    var lastExactDecCountV201 = -1;
    var vsyncStepInCycle = 0;
    var lastMonotonicAlpha = 0.02;

    // ДЕТЕКТОР ДУБЛЕЙ БЕЗ ОГРАНИЧЕНИЯ ПОДРЯД (UNLEASHED A -> C)
    var dupProbeCanvas = null;
    var dupProbeCtx = null;
    var lastUniqueThumbLuma = null;
    var consecutiveSkippedDups = 0;
    var activePairSpanFrames = 1;
    window._jennySkippedDupsTotal = 0;

    function isDuplicateVideoFrame(vid) {
        try {
            const tun = window._jennyTunerV190 || {};
            const tol = Number.isFinite(tun.dupThresh) ? Math.round(tun.dupThresh) : 10;
            if (tol <= 0) {
                consecutiveSkippedDups = 0;
                activePairSpanFrames = 1;
                return false;
            }
            // Сверхлегкая матрица 16x9 (144 точки) — минимум задержки на чтение
            const PW = 16, PH = 9, NPX = PW * PH;
            if (!dupProbeCanvas) {
                dupProbeCanvas = document.createElement('canvas');
                dupProbeCanvas.width = PW;
                dupProbeCanvas.height = PH;
                dupProbeCtx = dupProbeCanvas.getContext('2d', { willReadFrequently: true });
                lastUniqueThumbLuma = new Uint8Array(NPX);
            }
            dupProbeCtx.drawImage(vid, 0, 0, PW, PH);
            const rgba = dupProbeCtx.getImageData(0, 0, PW, PH).data;
            if (!hasValidFramePair) {
                for (let i = 0, p = 0; i < NPX; i++, p += 4) {
                    lastUniqueThumbLuma[i] = (rgba[p] * 77 + rgba[p + 1] * 150 + rgba[p + 2] * 29) >> 8;
                }
                return false;
            }

            let samePixels = 0;
            for (let i = 0, p = 0; i < NPX; i++, p += 4) {
                const y = (rgba[p] * 77 + rgba[p + 1] * 150 + rgba[p + 2] * 29) >> 8;
                if (Math.abs(y - lastUniqueThumbLuma[i]) <= tol) {
                    samePixels++;
                }
            }
            const sameRatio = samePixels / NPX;

            // ЗАЩИТА СНЯТА: отсекаем дубли без лимита подряд, пока >= 95% пикселей лежат в коридоре +-tol!
            if (sameRatio >= 0.95) {
                consecutiveSkippedDups++;
                window._jennySkippedDupsTotal = (window._jennySkippedDupsTotal || 0) + 1;
                return true;
            }

            for (let i = 0, p = 0; i < NPX; i++, p += 4) {
                lastUniqueThumbLuma[i] = (rgba[p] * 77 + rgba[p + 1] * 150 + rgba[p + 2] * 29) >> 8;
            }
            activePairSpanFrames = consecutiveSkippedDups + 1;
            consecutiveSkippedDups = 0;
            return false;
        } catch (e) {
            return false;
        }
    }

    function runMotionVectorPass() {
        if (!gl || !progMV || !fboMV || !hasValidFramePair) return;
        const tun = window._jennyTunerV190 || {};
        const searchRad = Number.isFinite(tun.searchRadius) ? tun.searchRadius : 15.0;
        const tOld = ringTex[slotPrev] || texPrev;
        const tNew = ringTex[slotCurr] || texCurr;

        gl.bindFramebuffer(gl.FRAMEBUFFER, fboMV);
        gl.viewport(0, 0, MV_GRID_W, MV_GRID_H);
        gl.useProgram(progMV);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tOld);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, tNew);

        gl.uniform2f(uMV_TexelLoc, 1.0 / Math.max(1, glCanvas.width), 1.0 / Math.max(1, glCanvas.height));
        gl.uniform1f(uMV_RadiusLoc, searchRad);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iboMV);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    function onNewDecodedVideoFrame(vid, now) {
        if (!ensureLucasKanadeWebGL(vid)) return;

        if (vid && typeof vid.getVideoPlaybackQuality === 'function') {
            const q = vid.getVideoPlaybackQuality();
            if (q && typeof q.totalVideoFrames === 'number' && q.totalVideoFrames > 0) {
                if (q.totalVideoFrames === lastExactDecCountV201 && hasValidFramePair) {
                    return;
                }
                lastExactDecCountV201 = q.totalVideoFrames;
            }
        }

        if (isDuplicateVideoFrame(vid)) {
            return;
        }

        const tun = window._jennyTunerV190 || {};
        const pll = Number.isFinite(tun.pllSmooth) ? Math.max(0.1, Math.min(0.95, tun.pllSmooth)) : 0.85;
        const spd = (vid && vid.playbackRate > 0.01) ? vid.playbackRate : 1.0;
        const rawSpanDt = (now - lastRealFrameTs) * spd;

        if (rawSpanDt > 14.0 && rawSpanDt < 800.0) {
            uniqueSpanMs = uniqueSpanMs * pll + rawSpanDt * (1.0 - pll);
            const singleDt = rawSpanDt / Math.max(1, activePairSpanFrames);
            if (singleDt > 14.0 && singleDt < 68.0) {
                baseFrameMs = baseFrameMs * 0.85 + singleDt * 0.15;
            }
        }

        lastRealFrameTs = now;
        vsyncStepInCycle = 0;
        lastMonotonicAlpha = 0.02;
        rawDecodedTicks++;

        slotPrev = slotCurr;
        slotCurr = slotWrite;
        slotWrite = (slotWrite + 1) & 3;

        texPrev = ringTex[slotPrev];
        texCurr = ringTex[slotCurr];

        gl.bindTexture(gl.TEXTURE_2D, texCurr);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, vid);
        gl.generateMipmap(gl.TEXTURE_2D);

        if (!hasValidFramePair) {
            gl.bindTexture(gl.TEXTURE_2D, texPrev);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, vid);
            gl.generateMipmap(gl.TEXTURE_2D);
            hasValidFramePair = true;
        }

        runMotionVectorPass();
    }

    function render120HzFrame() {
        const vid = document.getElementById('jennyVideoElV130');
        if (!gl || !progWarp || !glCanvas || !hasValidFramePair) return;

        const tun = window._jennyTunerV190 || {};
        const flowScale    = Number.isFinite(tun.flowScale)    ? tun.flowScale    : 0.85;
        const ghostGate    = Number.isFinite(tun.ghostGate)    ? tun.ghostGate    : 0.12;
        const detailGuard  = Number.isFinite(tun.detailGuard)  ? tun.detailGuard  : 0.45;
        const bridgeSpread = Number.isFinite(tun.bridgeSpread) ? tun.bridgeSpread : 0.35;
        const searchRadius = Number.isFinite(tun.searchRadius) ? tun.searchRadius : 15.0;
        const inkGuard     = Number.isFinite(tun.inkGuard)     ? tun.inkGuard     : 0.50;
        const targetFps    = Math.round(Number.isFinite(tun.targetFps) ? tun.targetFps : 120);

        const spd = (vid && vid.playbackRate > 0.01) ? vid.playbackRate : 1.0;
        const elapsedMs = Math.max(0.0, performance.now() - lastRealFrameTs);
        // Ожидаемая длительность текущего уникального перехода A -> C
        const expectedSpanMs = Math.max(baseFrameMs, uniqueSpanMs, (consecutiveSkippedDups + 1) * baseFrameMs) / spd;
        const vsyncIntervalMs = 1000.0 / Math.max(60, window._jv166Metrics.screenHz || 120);

        const effFps = (targetFps > 0) ? targetFps : (window._jv166Metrics.screenHz || 120);
        const totalSteps = Math.max(1, Math.round((expectedSpanMs / 1000.0) * effFps));
        window._jv166Metrics.actualPlusN = Math.max(0, totalSteps - 1);

        vsyncStepInCycle++;
        const rawTimeAlpha = (elapsedMs + vsyncIntervalMs * 0.35) / Math.max(8.33, expectedSpanMs);
        const linearAlpha = Math.min(0.98, Math.max(0.02, rawTimeAlpha));

        let computedAlpha = linearAlpha;
        if (targetFps > 0 && targetFps < 180) {
            computedAlpha = Math.min(0.98, Math.max(0.02, Math.floor(linearAlpha * totalSteps + 0.5) / totalSteps));
        }
        // Монотонный замок: внутри одного уникального кадра alpha никогда не пятится назад!
        const alpha = Math.max(lastMonotonicAlpha, computedAlpha);
        lastMonotonicAlpha = alpha;

        const isSplit = (window._jv166Metrics && window._jv166Metrics.mode === 'split');
        const splitRatio = Math.max(0.05, Math.min(0.95, window._jennySplitRatioV176 || 0.5));
        const splitUniformVal = isSplit ? (window._jennySplitSwappedV176 ? -splitRatio : splitRatio) : 0.0;

        const tOld = ringTex[slotPrev] || texPrev;
        const tNew = ringTex[slotCurr] || texCurr;

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, glCanvas.width, glCanvas.height);
        gl.useProgram(progWarp);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tOld);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, tNew);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, texMV);

        gl.uniform1f(uAlphaLoc, alpha);
        gl.uniform2f(uTexelLoc, 1.0 / Math.max(1, glCanvas.width), 1.0 / Math.max(1, glCanvas.height));
        gl.uniform1f(uFlowScaleLoc, flowScale);
        gl.uniform1f(uGhostGateLoc, ghostGate);
        gl.uniform1f(uDetailGuardLoc, detailGuard);
        gl.uniform1f(uBridgeSpreadLoc, bridgeSpread);
        if (progWarp._uSearchRadLoc === undefined) {
            progWarp._uSearchRadLoc = gl.getUniformLocation(progWarp, 'u_searchRadius');
        }
        if (progWarp._uSearchRadLoc !== null) {
            gl.uniform1f(progWarp._uSearchRadLoc, searchRadius);
        }
        gl.uniform1f(uInkGuardLoc, inkGuard);
        if (uSplitPosLoc !== null) {
            gl.uniform1f(uSplitPosLoc, splitUniformVal);
        }

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function attachHardwareFrameCallback(vid) {}

    function master120HzLoop(now) {
        vsyncTicks++;
        const st = window._vidStateV130;
        const vid = document.getElementById('jennyVideoElV130');
        const m = window._jv166Metrics;

        if (st && st.active && vid && !vid.paused && vid.readyState >= 2) {
            if (m.mode === 'off') {
                if (glCanvas) glCanvas.style.display = 'none';
                if (splitLineEl) splitLineEl.style.display = 'none';
                if (typeof vid.getVideoPlaybackQuality === 'function') {
                    const q = vid.getVideoPlaybackQuality();
                    if (q && q.totalVideoFrames !== lastExactDecCountV201) {
                        lastExactDecCountV201 = q.totalVideoFrames;
                        rawDecodedTicks++;
                        synthOutTicks++;
                    }
                }
            } else {
                if (typeof vid.getVideoPlaybackQuality === 'function') {
                    const q = vid.getVideoPlaybackQuality();
                    if (q && q.totalVideoFrames !== lastExactDecCountV201) {
                        onNewDecodedVideoFrame(vid, now);
                    }
                } else if ((now - lastRealFrameTs) >= (baseFrameMs / Math.max(0.1, vid.playbackRate || 1.0))) {
                    onNewDecodedVideoFrame(vid, now);
                }

                if (hasValidFramePair && ensureLucasKanadeWebGL(vid)) {
                    glCanvas.style.display = 'block';
                    render120HzFrame();
                    synthOutTicks++;
                }
            }
        } else {
            if (glCanvas) glCanvas.style.display = 'none';
            if (splitLineEl) splitLineEl.style.display = 'none';
            hasValidFramePair = false;
        }

        if (now - lastMetricTs >= 1000) {
            const dtSec = (now - lastMetricTs) / 1000.0;
            m.screenHz = Math.round(vsyncTicks / dtSec);
            m.sourceFps = Math.min(120, Math.round(rawDecodedTicks / dtSec));
            const tun = window._jennyTunerV190 || {};
            const targetFps = Math.round(Number.isFinite(tun.targetFps) ? tun.targetFps : 120);
            if (m.mode === 'off') {
                m.outputFps = m.sourceFps;
            } else if (targetFps > 0) {
                m.outputFps = targetFps;
            } else {
                m.outputFps = Math.min(m.screenHz, Math.round(synthOutTicks / dtSec));
            }

            vsyncTicks = 0;
            synthOutTicks = 0;
            rawDecodedTicks = 0;
            lastMetricTs = now;

            const badge = document.getElementById('jv166LiveHzBadge');
            if (badge) {
                badge.textContent = m.screenHz + ' Hz';
                badge.style.color = m.screenHz >= 90 ? '#3fb950' : '#e3b341';
            }
            window.updateVideoHeaderTelemetryV166();
        }

        requestAnimationFrame(master120HzLoop);
    }
    requestAnimationFrame(master120HzLoop);"""

V204_TUNER_SPECS = r"""    var TUNER_SPECS = [
        { key: 'dupThresh',    label: 'Дубль ±Y (0=Выкл)',   min: 0.0, max: 255.0, def: 10.0,  fmt: 0, color: '#ff9100' },
        { key: 'targetFps',    label: 'Целевой FPS (0=Авто)', min: 0.0, max: 180.0, def: 120.0, fmt: 0, color: '#ffea00' },
        { key: 'flowScale',    label: 'Сдвиг (Scale)',        min: 0.0, max: 2.50,  def: 0.85,  fmt: 2, color: '#00ff9d' },
        { key: 'ghostGate',    label: 'Шлейф (Gate)',         min: 0.02, max: 0.45, def: 0.12,  fmt: 2, color: '#ff5252' },
        { key: 'detailGuard',  label: 'Детали (Guard)',       min: 0.0, max: 1.00,  def: 0.45,  fmt: 2, color: '#00e5ff' },
        { key: 'bridgeSpread', label: 'Мост (Bridge)',        min: 0.0, max: 1.00,  def: 0.35,  fmt: 2, color: '#e040fb' },
        { key: 'searchRadius', label: 'Радар (Rad px)',       min: 4.0, max: 48.0,  def: 15.0,  fmt: 1, color: '#ffd740' },
        { key: 'inkGuard',     label: 'Контур (Ink)',         min: 0.0, max: 1.00,  def: 0.50,  fmt: 2, color: '#69f0ae' },
        { key: 'pllSmooth',    label: 'Ритм (PLL)',           min: 0.10, max: 0.95, def: 0.85,  fmt: 2, color: '#40c4ff' }
    ];"""

patched = 0
for root, _, files in os.walk(BASE_DIR):
    if "node_modules" in root or ".git" in root:
        continue
    if "ui_v71.js" in files:
        path = os.path.join(root, "ui_v71.js")
        code = open(path, "r", encoding="utf-8", errors="ignore").read()

        code = re.sub(
            r"window\._jennyTunerV190\s*=\s*window\._jennyTunerV190\s*\|\|\s*\{.*?\};\s*(?:if\s*\(isNaN\(window\._jennyTunerV190\.[a-zA-Z]+\)\).*?\n\s*)+",
            V204_TUNER_INIT + "\n",
            code,
            count=1,
            flags=re.DOTALL
        )

        code = re.sub(
            r"var\s+baseFrameMs\s*=\s*41\.667;.*?requestAnimationFrame\(master120HzLoop\);\s*\}\s*requestAnimationFrame\(master120HzLoop\);",
            V204_UNLEASHED_LOOP,
            code,
            count=1,
            flags=re.DOTALL
        )

        code = re.sub(
            r"var\s+TUNER_SPECS\s*=\s*\[.*?\];",
            V204_TUNER_SPECS,
            code,
            count=1,
            flags=re.DOTALL
        )

        code = re.sub(
            r'"Крутилки V20[0-9]\s*:\s*.*?\+\s*Number\(tun\.flowScale',
            '"Крутилки V204   : Dup±Y=" + Number(tun.dupThresh !== undefined ? tun.dupThresh : 10).toFixed(0) + " | TargetFPS=" + Number(tun.targetFps !== undefined ? tun.targetFps : 120).toFixed(0) + " | Scale=" + Number(tun.flowScale',
            code,
            count=1
        )

        open(path, "w", encoding="utf-8").write(code)
        patched += 1
        print(f"[V204] Снята защита дублей + добавлен ползунок Целевой FPS (0..180) в {path}")

print(f"Готово! Обновлено файлов: {patched}")

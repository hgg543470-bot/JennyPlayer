#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os, re, shutil

BASE_DIR = "/storage/emulated/0/scripts/JennyPlayer"
if not os.path.exists(BASE_DIR):
    BASE_DIR = os.getcwd()

# 1. Убираем дубликаты .so и исходники .c из app/src/main/python, если они уже есть в jniLibs/arm64-v8a
py_dir = os.path.join(BASE_DIR, "app", "src", "main", "python")
arm_dir = os.path.join(BASE_DIR, "app", "src", "main", "jniLibs", "arm64-v8a")
bak_dir = os.path.join(BASE_DIR, "native_src_backup")

if os.path.isdir(py_dir) and os.path.isdir(arm_dir):
    os.makedirs(bak_dir, exist_ok=True)
    for fn in os.listdir(py_dir):
        full_p = os.path.join(py_dir, fn)
        if not os.path.isfile(full_p):
            continue
        if fn.endswith(".so"):
            arm_target = os.path.join(arm_dir, fn)
            if not os.path.isfile(arm_target):
                shutil.copy2(full_p, arm_target)
            shutil.move(full_p, os.path.join(bak_dir, fn))
            print(f"[CLEAN] Убран дубликат {fn} из папки python (оригинал в arm64-v8a)")
        elif fn.endswith((".c", ".cpp", ".h")):
            shutil.move(full_p, os.path.join(bak_dir, fn))
            print(f"[CLEAN] Исходник {fn} перенесен из папки python в native_src_backup")

# 2. Обновляем движок в ui_v71.js до V203 (Кольцевой буфер 4 кадра + Ползунок Дубль 0..255 + Компактные ползунки)
V203_CORE_AND_TUNER = r"""    window._jennyTunerV190 = window._jennyTunerV190 || {
        dupThresh:    parseFloat(localStorage.getItem('jt190_dupThresh')    || '10'),
        interpFrames: parseFloat(localStorage.getItem('jt190_interpFrames') || '0'),
        flowScale:    parseFloat(localStorage.getItem('jt190_flowScale')    || '0.85'),
        ghostGate:    parseFloat(localStorage.getItem('jt190_ghostGate')    || '0.12'),
        detailGuard:  parseFloat(localStorage.getItem('jt190_detailGuard')  || '0.45'),
        bridgeSpread: parseFloat(localStorage.getItem('jt190_bridgeSpread') || '0.35'),
        searchRadius: parseFloat(localStorage.getItem('jt190_searchRadius') || '12.0'),
        inkGuard:     parseFloat(localStorage.getItem('jt190_inkGuard')     || '0.50'),
        pllSmooth:    parseFloat(localStorage.getItem('jt190_pllSmooth')    || '0.85')
    };
    if (isNaN(window._jennyTunerV190.dupThresh)) window._jennyTunerV190.dupThresh = 10;
    if (isNaN(window._jennyTunerV190.interpFrames)) window._jennyTunerV190.interpFrames = 0;"""

V203_RING_ENGINE = r"""    let glCanvas = null;
    let splitLineEl = null;
    let gl = null;
    let progMV = null;
    let progWarp = null;
    // Кольцевой буфер на 4 текстуры (T0..T3) для предчтения и перелета через дубли A -> [B] -> C
    let ringTex = [null, null, null, null];
    let slotPrev = 0;
    let slotCurr = 1;
    let slotWrite = 2;
    let fboMV = null;
    let texMV = null;
    let iboMV = null;
    const MV_GRID_W = 240;
    const MV_GRID_H = 135;
    let frameSlot = 0;"""

V203_CREATE_RING_TEX = r"""            ringTex[0] = createTex(false);
            ringTex[1] = createTex(false);
            ringTex[2] = createTex(false);
            ringTex[3] = createTex(false);
            texPrev = ringTex[0];
            texCurr = ringTex[1];
            texMV   = createTex(true);"""

V203_DUP_AND_UPLOAD = r"""    var baseFrameMs = 41.667;
    var lastExactDecCountV201 = -1;
    var vsyncStepInCycle = 0;

    // ДЕТЕКТОР ДУБЛЕЙ С ПОЛЗУНКОМ ПОХОЖЕСТИ ПИКСЕЛЯ 0..255 (например 100 +- 10 => 90..110 = дубль)
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
            // Если ползунок Дубль стоит на 0 — проверка полностью выключена (0 мс затрат!)
            if (tol <= 0) {
                consecutiveSkippedDups = 0;
                return false;
            }
            const PW = 32, PH = 18, NPX = PW * PH;
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
                // Точное правило ползунка 0..255: если |y - yOld| <= tol (например 100 +- 10 -> 90..110), пиксель считается дублем!
                if (Math.abs(y - lastUniqueThumbLuma[i]) <= tol) {
                    samePixels++;
                }
            }
            const sameRatio = samePixels / NPX;

            // Если >= 96.5% пикселей попали в коридор +-tol и мы пропустили меньше 2 дублей подряд
            if (sameRatio >= 0.965 && consecutiveSkippedDups < 2) {
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
        const searchRad = Number.isFinite(tun.searchRadius) ? tun.searchRadius : 12.0;
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
        const rawDt = (now - lastRealFrameTs) * spd;
        const singleDecodeDt = rawDt / Math.max(1, activePairSpanFrames);
        if (singleDecodeDt > 14.0 && singleDecodeDt < 68.0) {
            baseFrameMs = baseFrameMs * pll + singleDecodeDt * (1.0 - pll);
        }
        lastRealFrameTs = now;
        vsyncStepInCycle = 0;
        rawDecodedTicks++;

        // Кольцевое переключение 4 слотов: старый уникальный слот становится slotPrev, а новый пишется в следующий слот кольца!
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
    }"""

V203_COMPACT_TUNER_SPECS = r"""    var TUNER_SPECS = [
        { key: 'dupThresh',    label: 'Дубль ±Y (0=Выкл)', min: 0.0, max: 255.0, def: 10.0, fmt: 0, color: '#ff9100' },
        { key: 'interpFrames', label: 'Кадры (+N, 0=Авто)', min: 0.0, max: 5.0,  def: 0.0,  fmt: 0, color: '#ffea00' },
        { key: 'flowScale',    label: 'Сдвиг (Scale)',      min: 0.0, max: 2.50, def: 0.85, fmt: 2, color: '#00ff9d' },
        { key: 'ghostGate',    label: 'Шлейф (Gate)',       min: 0.02, max: 0.45, def: 0.12, fmt: 2, color: '#ff5252' },
        { key: 'detailGuard',  label: 'Детали (Guard)',     min: 0.0, max: 1.00, def: 0.45, fmt: 2, color: '#00e5ff' },
        { key: 'bridgeSpread', label: 'Мост (Bridge)',      min: 0.0, max: 1.00, def: 0.35, fmt: 2, color: '#e040fb' },
        { key: 'searchRadius', label: 'Радар (Rad px)',     min: 4.0, max: 48.0, def: 12.0, fmt: 1, color: '#ffd740' },
        { key: 'inkGuard',     label: 'Контур (Ink)',       min: 0.0, max: 1.00, def: 0.50, fmt: 2, color: '#69f0ae' },
        { key: 'pllSmooth',    label: 'Ритм (PLL)',         min: 0.10, max: 0.95, def: 0.85, fmt: 2, color: '#40c4ff' }
    ];"""

V203_COMPACT_OVERLAY_DOM = r"""        var wrap = document.createElement('div');
        wrap.id = 'jennyFenceWrapV173';
        wrap._isV177TwoRow = true;
        wrap._isV200Tuner = true;
        wrap._isV203Compact = true;
        wrap.style.cssText = 'position:absolute;top:' + sy + 'px;left:' + sx + 'px;z-index:99999;display:flex;flex-direction:column;align-items:stretch;gap:2px;border:1px solid #00e5ff;border-radius:7px;padding:4px 6px;pointer-events:auto;touch-action:none;user-select:none;box-shadow:0 4px 14px rgba(0,0,0,0.75);width:222px;box-sizing:border-box;';

        var cv = document.createElement('canvas');
        cv.id = 'jennyFenceCanvasV173';
        cv.width = 210;
        cv.height = 26;
        cv.style.cssText = 'width:210px;height:26px;display:block;border-bottom:1px solid rgba(0,229,255,0.25);padding-bottom:1px;';

        var row2 = document.createElement('div');
        row2.id = 'jennyFenceRow2V177';
        row2.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:3px;';

        var tBtn = document.createElement('button');
        tBtn.id = 'jennyFenceToggleBtn';
        tBtn.style.cssText = 'background:#11222b;color:#00e5ff;font-size:10.5px;font-weight:bold;border:1px solid rgba(0,229,255,0.5);border-radius:4px;padding:2px 6px;';

        var lBtn = document.createElement('button');
        lBtn.id = 'jennyLog120Btn';
        lBtn.textContent = '📋 ЛОГ';
        lBtn.style.cssText = 'background:#00e5ff;color:#000;font-weight:900;font-size:9.5px;border:none;border-radius:4px;padding:2px 5px;white-space:nowrap;flex:1;';

        var tunBtn = document.createElement('button');
        tunBtn.id = 'jennyTunerToggleBtnV190';
        tunBtn.textContent = '🎛️';
        tunBtn.style.cssText = 'background:#00e5ff;color:#000;font-weight:bold;font-size:10.5px;border:1px solid #00e5ff;border-radius:4px;padding:2px 6px;';

        var sBtn = document.createElement('button');
        sBtn.id = 'jennySplitSwapQuickBtn';
        sBtn.textContent = '⇄';
        sBtn.style.cssText = 'background:#1b2b22;color:#00ff9d;font-weight:bold;font-size:10.5px;border:1px solid #00ff9d;border-radius:4px;padding:2px 6px;';

        var dragHint = document.createElement('span');
        dragHint.textContent = '✥';
        dragHint.style.cssText = 'color:rgba(0,229,255,0.8);font-size:13px;padding:0 2px;';

        row2.appendChild(tBtn);
        row2.appendChild(lBtn);
        row2.appendChild(tunBtn);
        row2.appendChild(sBtn);
        row2.appendChild(dragHint);

        var tBox = document.createElement('div');
        tBox.id = 'jennyTunerBoxV190';
        tBox.style.cssText = 'display:flex;flex-direction:column;gap:1px;padding-top:2px;border-top:1px solid rgba(0,229,255,0.3);margin-top:1px;';

        var slidersHtml = '';
        for (var i = 0; i < TUNER_SPECS.length; i++) {
            var sp = TUNER_SPECS[i];
            slidersHtml +=
                '<div class="jt190-slider-row" data-jtkey="' + sp.key + '" style="display:flex;flex-direction:column;gap:1px;padding:1px 0;cursor:pointer;">' +
                    '<div style="display:flex;justify-content:space-between;align-items:center;font-family:monospace;font-size:9px;line-height:1.0;">' +
                        '<span style="color:#e6edf3;font-weight:bold;">' + sp.label + ' <span style="color:#6e7681;font-size:8px;">[' + sp.min + '..' + sp.max + ']</span></span>' +
                        '<span id="jt190Val_' + sp.key + '" style="color:' + sp.color + ';font-weight:900;font-size:9.5px;">' + sp.def.toFixed(sp.fmt) + '</span>' +
                    '</div>' +
                    '<div id="jt190Track_' + sp.key + '" style="width:100%;height:5px;background:#111922;border:1px solid rgba(255,255,255,0.18);border-radius:3px;overflow:hidden;position:relative;">' +
                        '<div id="jt190Fill_' + sp.key + '" style="width:50%;height:100%;background:' + sp.color + ';border-radius:3px;pointer-events:none;"></div>' +
                    '</div>' +
                '</div>';
        }
        slidersHtml +=
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:1px;">' +
                '<span style="color:#8b949e;font-size:8px;font-family:monospace;">Тяни полоску (V203 Ring)</span>' +
                '<button id="jt190ResetBtn" style="background:#21262d;color:#ff7b72;border:1px solid #ff7b72;border-radius:3px;font-size:8.5px;font-weight:bold;padding:1px 6px;">🔄 Сброс</button>' +
            '</div>';
        tBox.innerHTML = slidersHtml;"""

patched_count = 0
for root, _, files in os.walk(BASE_DIR):
    if "node_modules" in root or ".git" in root:
        continue
    if "ui_v71.js" in files:
        path = os.path.join(root, "ui_v71.js")
        code = open(path, "r", encoding="utf-8", errors="ignore").read()

        code = re.sub(
            r"window\._jennyTunerV190\s*=\s*window\._jennyTunerV190\s*\|\|\s*\{.*?\};\s*if\s*\(isNaN\(window\._jennyTunerV190\.interpFrames\)\)\s*window\._jennyTunerV190\.interpFrames\s*=\s*0;",
            V203_CORE_AND_TUNER,
            code,
            count=1,
            flags=re.DOTALL
        )

        code = re.sub(
            r"let\s+glCanvas\s*=\s*null;\s*let\s+splitLineEl\s*=\s*null;\s*let\s+gl\s*=\s*null;\s*let\s+progMV\s*=\s*null;\s*let\s+progWarp\s*=\s*null;\s*let\s+texPrev\s*=\s*null;\s*let\s+texCurr\s*=\s*null;\s*let\s+fboMV\s*=\s*null;\s*let\s+texMV\s*=\s*null;\s*let\s+iboMV\s*=\s*null;\s*const\s+MV_GRID_W\s*=\s*240;\s*const\s+MV_GRID_H\s*=\s*135;\s*let\s+frameSlot\s*=\s*0;",
            V203_RING_ENGINE,
            code,
            count=1,
            flags=re.DOTALL
        )

        code = code.replace(
            "texPrev = createTex(false);\n            texCurr = createTex(false);\n            texMV   = createTex(true);",
            V203_CREATE_RING_TEX
        )

        code = re.sub(
            r"var\s+baseFrameMs\s*=\s*41\.667;.*?runMotionVectorPass\(\);\s*\}",
            V203_DUP_AND_UPLOAD,
            code,
            count=1,
            flags=re.DOTALL
        )

        code = code.replace(
            "const tOld = (frameSlot === 0) ? texPrev : texCurr;\n        const tNew = (frameSlot === 0) ? texCurr : texPrev;",
            "const tOld = ringTex[slotPrev] || texPrev;\n        const tNew = ringTex[slotCurr] || texCurr;"
        )

        code = re.sub(
            r"var\s+TUNER_SPECS\s*=\s*\[.*?\];",
            V203_COMPACT_TUNER_SPECS,
            code,
            count=1,
            flags=re.DOTALL
        )

        code = code.replace("if (oldW && oldW._isV200Tuner)", "if (oldW && oldW._isV203Compact)")
        code = code.replace(
            "\"Крутилки V200   : Interp=+\" + Number(tun.interpFrames || 0).toFixed(0) +",
            "\"Крутилки V203   : Dup±Y=\" + Number(tun.dupThresh !== undefined ? tun.dupThresh : 10).toFixed(0) + \" | Interp=+\" + Number(tun.interpFrames || 0).toFixed(0) +"
        )

        code = re.sub(
            r"var\s+wrap\s*=\s*document\.createElement\('div'\);\s*wrap\.id\s*=\s*'jennyFenceWrapV173';.*?tBox\.innerHTML\s*=\s*slidersHtml;",
            V203_COMPACT_OVERLAY_DOM,
            code,
            count=1,
            flags=re.DOTALL
        )

        open(path, "w", encoding="utf-8").write(code)
        patched_count += 1
        print(f"[V203] Успешно обновлен {path}")

print(f"Готово! Обновлено файлов ui_v71.js: {patched_count}")

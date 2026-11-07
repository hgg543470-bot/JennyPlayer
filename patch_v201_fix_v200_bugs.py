#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os, re

BASE_DIR = "/storage/emulated/0/scripts/JennyPlayer"
if not os.path.exists(BASE_DIR):
    BASE_DIR = os.getcwd()

V172_SAFE_VIEWPORT_HOOK = """/* ================= JENNY V172: CLEAN VIEWPORT & ORIG SPLIT FIX (FBO-SAFE V201) ================= */
(function() {
    if (window._jennyV172ViewportFixed) return;
    window._jennyV172ViewportFixed = true;

    function hookViewportOnly(Proto) {
        if (!Proto || Proto._v172Hooked) return;
        Proto._v172Hooked = true;

        var origDrawArrays = Proto.drawArrays;
        Proto.drawArrays = function(mode, first, count) {
            // Меняем viewport ТОЛЬКО при рендере на экран (когда FBO === null), не ломая 240x135 карту векторов!
            if (this.canvas && this.drawingBufferWidth > 0 && this.drawingBufferHeight > 0) {
                if (!this.getParameter(this.FRAMEBUFFER_BINDING)) {
                    this.viewport(0, 0, this.drawingBufferWidth, this.drawingBufferHeight);
                }
            }
            return origDrawArrays.call(this, mode, first, count);
        };
    }

    if (typeof WebGL2RenderingContext !== 'undefined') hookViewportOnly(WebGL2RenderingContext.prototype);
    if (typeof WebGLRenderingContext !== 'undefined') hookViewportOnly(WebGLRenderingContext.prototype);
})();
/* ================= END JENNY V172 CLEAN FIX ================= */"""

V201_MV_ENGINE_CORE = r"""    let glCanvas = null;
    let splitLineEl = null;
    let gl = null;
    let progMV = null;
    let progWarp = null;
    let texPrev = null;
    let texCurr = null;
    let fboMV = null;
    let texMV = null;
    let iboMV = null;
    const MV_GRID_W = 240;
    const MV_GRID_H = 135;
    let frameSlot = 0;

    let uMV_TexelLoc = null;
    let uMV_RadiusLoc = null;

    let uAlphaLoc = null;
    let uTexelLoc = null;
    let uFlowScaleLoc = null;
    let uGhostGateLoc = null;
    let uDetailGuardLoc = null;
    let uBridgeSpreadLoc = null;
    let uInkGuardLoc = null;
    let uSplitPosLoc = null;

    // Вертексный шейдер для вывода на экран (с переворотом Y под HTMLVideoElement)
    const VS_QUAD = `#version 300 es
    in vec2 a_pos;
    out vec2 v_uv;
    void main() {
        v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
        gl_Position = vec4(a_pos, 0.0, 1.0);
    }`;

    // Вертексный шейдер для FBO карты векторов 240x135 (БЕЗ переворота Y, чтобы UV совпадали 1-в-1 с текстурой видео!)
    const VS_FBO = `#version 300 es
    in vec2 a_pos;
    out vec2 v_uv;
    void main() {
        v_uv = a_pos * 0.5 + 0.5;
        gl_Position = vec4(a_pos, 0.0, 1.0);
    }`;

    // ПРОХОД 1 (240x135, 1 раз на кадр декодера): ИЕРАРХИЧЕСКИЙ ПОИСК ВЕКТОРОВ ДВИЖЕНИЯ ПО МИПМАПАМ
    const FS_MV_PASS = `#version 300 es
    precision highp float;
    in vec2 v_uv;
    uniform sampler2D u_prevTex;
    uniform sampler2D u_currTex;
    uniform vec2 u_texel;
    uniform float u_searchRadius;
    out vec4 outMV;

    float lumaLod(sampler2D t, vec2 uv, float lod) {
        return dot(textureLod(t, clamp(uv, 0.001, 0.999), lod).rgb, vec3(0.299, 0.587, 0.114));
    }

    vec2 estimateLayerFlow(vec2 uv, float lod, float stepScale, vec2 priorFlow) {
        vec2 st = u_texel * stepScale;
        vec2 uvPrev = clamp(uv - priorFlow * 0.5, 0.001, 0.999);
        vec2 uvCurr = clamp(uv + priorFlow * 0.5, 0.001, 0.999);

        float pC = lumaLod(u_prevTex, uvPrev, lod);
        float cC = lumaLod(u_currTex, uvCurr, lod);

        float pR = lumaLod(u_prevTex, uvPrev + vec2(st.x, 0.0), lod);
        float pL = lumaLod(u_prevTex, uvPrev - vec2(st.x, 0.0), lod);
        float pD = lumaLod(u_prevTex, uvPrev + vec2(0.0, st.y), lod);
        float pU = lumaLod(u_prevTex, uvPrev - vec2(0.0, st.y), lod);

        float cR = lumaLod(u_currTex, uvCurr + vec2(st.x, 0.0), lod);
        float cL = lumaLod(u_currTex, uvCurr - vec2(st.x, 0.0), lod);
        float cD = lumaLod(u_currTex, uvCurr + vec2(0.0, st.y), lod);
        float cU = lumaLod(u_currTex, uvCurr - vec2(0.0, st.y), lod);

        float Ix = 0.25 * ((pR - pL) + (cR - cL));
        float Iy = 0.25 * ((pD - pU) + (cD - cU));
        float It = cC - pC;

        float mag2 = Ix * Ix + Iy * Iy + 0.0014;
        vec2 dFlow = clamp((-It / mag2) * vec2(Ix, Iy), -3.5, 3.5) * st;
        return priorFlow + dFlow;
    }

    float blockResidual(vec2 uv, vec2 flow, float lod) {
        vec2 p0 = clamp(uv - flow * 0.5, 0.001, 0.999);
        vec2 p1 = clamp(uv + flow * 0.5, 0.001, 0.999);
        vec3 d0 = abs(textureLod(u_currTex, p1, lod).rgb - textureLod(u_prevTex, p0, lod).rgb);
        float eC = max(d0.r, max(d0.g, d0.b));
        vec2 ox = vec2(u_texel.x * 2.5, 0.0);
        vec2 oy = vec2(0.0, u_texel.y * 2.5);
        float eX = abs(lumaLod(u_currTex, p1 + ox, lod) - lumaLod(u_prevTex, p0 + ox, lod)) +
                   abs(lumaLod(u_currTex, p1 - ox, lod) - lumaLod(u_prevTex, p0 - ox, lod));
        float eY = abs(lumaLod(u_currTex, p1 + oy, lod) - lumaLod(u_prevTex, p0 + oy, lod)) +
                   abs(lumaLod(u_currTex, p1 - oy, lod) - lumaLod(u_prevTex, p0 - oy, lod));
        return eC * 0.55 + (eX + eY) * 0.1125;
    }

    void main() {
        vec2 uv = clamp(v_uv, 0.002, 0.998);
        float maxRad = clamp(u_searchRadius, 4.0, 48.0);

        float zeroErr = blockResidual(uv, vec2(0.0), 1.0);
        float coarseWake = abs(lumaLod(u_currTex, uv, 2.5) - lumaLod(u_prevTex, uv, 2.5));
        if (max(zeroErr, coarseWake * 1.8) < 0.007) {
            outMV = vec4(0.5, 0.5, 0.0, 0.0);
            return;
        }

        vec2 flowCoarse = estimateLayerFlow(uv, 3.0, 6.0, vec2(0.0));
        vec2 flowMid    = estimateLayerFlow(uv, 2.0, 3.0, flowCoarse);
        vec2 flowFine   = estimateLayerFlow(uv, 1.0, 1.5, flowMid);

        vec2 bestFlow = vec2(0.0);
        float bestErr = zeroErr * 0.96;

        float errFine = blockResidual(uv, flowFine, 1.0);
        if (errFine < bestErr) { bestErr = errFine; bestFlow = flowFine; }

        float errMid = blockResidual(uv, flowMid, 1.5);
        if (errMid < bestErr) { bestErr = errMid; bestFlow = flowMid; }

        const vec2 dirs[8] = vec2[8](
            vec2(1.0, 0.0), vec2(-1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, -1.0),
            vec2(0.707, 0.707), vec2(-0.707, 0.707), vec2(0.707, -0.707), vec2(-0.707, -0.707)
        );
        for (int i = 0; i < 8; i++) {
            vec2 candWide = dirs[i] * u_texel * (maxRad * 0.65);
            float eW = blockResidual(uv, candWide, 2.2);
            if (eW < bestErr) { bestErr = eW; bestFlow = candWide; }
        }
        vec2 baseWide = bestFlow;
        for (int i = 0; i < 8; i++) {
            vec2 candMid = baseWide + dirs[i] * u_texel * (maxRad * 0.25);
            float eM = blockResidual(uv, candMid, 1.2);
            if (eM < bestErr) { bestErr = eM; bestFlow = candMid; }
        }

        bestFlow = estimateLayerFlow(uv, 0.8, 1.2, bestFlow);

        vec2 maxUv = u_texel * maxRad;
        vec2 normFlow = clamp(bestFlow / max(maxUv, vec2(1e-5)), -1.0, 1.0);
        float conf = clamp((zeroErr - bestErr) * 6.0 + coarseWake * 2.5, 0.0, 1.0);

        outMV = vec4(normFlow * 0.5 + 0.5, conf, clamp(bestErr * 2.0, 0.0, 1.0));
    }`;

    // ПРОХОД 2 (1080p, 120 Гц): ДВУНАПРАВЛЕННЫЙ СДВИГ БЕЗ ОРЕОЛА (NO LINEAR BLEND GHOST) И С ЗАЩИТОЙ ДЕТАЛЕЙ
    const FS_WARP_PASS = `#version 300 es
    precision highp float;
    in vec2 v_uv;
    uniform sampler2D u_prevTex;
    uniform sampler2D u_currTex;
    uniform sampler2D u_mvTex;
    uniform float u_alpha;
    uniform vec2 u_texel;
    uniform float u_flowScale;
    uniform float u_ghostGate;
    uniform float u_detailGuard;
    uniform float u_bridgeSpread;
    uniform float u_searchRadius;
    uniform float u_inkGuard;
    uniform float u_splitPos;
    out vec4 outColor;

    float luma(vec3 c) {
        return dot(c, vec3(0.299, 0.587, 0.114));
    }

    vec3 readMV(vec2 uv, vec2 maxUv) {
        vec4 m = texture(u_mvTex, clamp(uv, 0.002, 0.998));
        vec2 fl = (m.rg - 0.5) * 2.0 * maxUv;
        return vec3(fl, m.b);
    }

    void main() {
        vec2 uv = clamp(v_uv, vec2(0.001), vec2(0.999));

        if (abs(u_splitPos) > 0.001) {
            float sp = abs(u_splitPos);
            bool isOrigSide = (u_splitPos > 0.0) ? (uv.x < sp) : (uv.x >= sp);
            if (isOrigSide) {
                outColor = (u_alpha < 0.5) ? textureLod(u_prevTex, uv, 0.0) : textureLod(u_currTex, uv, 0.0);
                return;
            }
        }

        vec4 cPrev = textureLod(u_prevTex, uv, 0.0);
        vec4 cCurr = textureLod(u_currTex, uv, 0.0);
        // Четкий фоллбэк без двоения (никакого 50/50 linearBlend, который давал прозрачный шлейф!)
        vec4 sharpFallback = (u_alpha < 0.5) ? cPrev : cCurr;

        vec3 rawDiff = abs(cCurr.rgb - cPrev.rgb);
        float pixelDiff = max(rawDiff.r, max(rawDiff.g, rawDiff.b));

        float maxRad = clamp(u_searchRadius, 4.0, 48.0);
        vec2 maxUv = u_texel * maxRad;
        vec3 mC = readMV(uv, maxUv);

        // Замок статики: если сам пиксель и его клетка не двигаются — выводим 100% четкий оригинал
        if (pixelDiff < 0.007 && mC.z < 0.12) {
            outColor = cCurr;
            return;
        }

        vec2 blockFlow = mC.xy;
        if (u_bridgeSpread > 0.01) {
            vec2 mvStep = vec2(1.0 / 240.0, 1.0 / 135.0) * (0.5 + u_bridgeSpread);
            vec3 mL = readMV(uv - vec2(mvStep.x, 0.0), maxUv);
            vec3 mR = readMV(uv + vec2(mvStep.x, 0.0), maxUv);
            vec3 mU = readMV(uv - vec2(0.0, mvStep.y), maxUv);
            vec3 mD = readMV(uv + vec2(0.0, mvStep.y), maxUv);

            float wC = mC.z * 3.0 + 0.15;
            float wL = mL.z * u_bridgeSpread;
            float wR = mR.z * u_bridgeSpread;
            float wU = mU.z * u_bridgeSpread;
            float wD = mD.z * u_bridgeSpread;
            blockFlow = (mC.xy * wC + mL.xy * wL + mR.xy * wR + mU.xy * wU + mD.xy * wD) / (wC + wL + wR + wU + wD);

            // Протяжка траектории для мелких быстрых объектов (снежинок/звезд) только при включенном Мосте
            if (mC.z < 0.08) {
                vec3 mMax = mL;
                if (mR.z > mMax.z) mMax = mR;
                if (mU.z > mMax.z) mMax = mU;
                if (mD.z > mMax.z) mMax = mD;
                if (mMax.z > 0.22) {
                    blockFlow = mix(blockFlow, mMax.xy, u_bridgeSpread * 0.65);
                }
            }
        }
        blockFlow *= abs(u_flowScale);

        // Попиксельный микро-вектор (радиус 1.5px) для защиты формы мелких деталей (гайки, глаз, пальцев)
        vec2 s1 = u_texel * 1.5;
        float lR = 0.5 * (luma(textureLod(u_currTex, uv + vec2(s1.x, 0.0), 0.0).rgb) + luma(textureLod(u_prevTex, uv + vec2(s1.x, 0.0), 0.0).rgb));
        float lL = 0.5 * (luma(textureLod(u_currTex, uv - vec2(s1.x, 0.0), 0.0).rgb) + luma(textureLod(u_prevTex, uv - vec2(s1.x, 0.0), 0.0).rgb));
        float lD = 0.5 * (luma(textureLod(u_currTex, uv + vec2(0.0, s1.y), 0.0).rgb) + luma(textureLod(u_prevTex, uv + vec2(0.0, s1.y), 0.0).rgb));
        float lU = 0.5 * (luma(textureLod(u_currTex, uv - vec2(0.0, s1.y), 0.0).rgb) + luma(textureLod(u_prevTex, uv - vec2(0.0, s1.y), 0.0).rgb));
        float Ix = (lR - lL) * 0.33;
        float Iy = (lD - lU) * 0.33;
        float It = luma(cCurr.rgb) - luma(cPrev.rgb);
        vec2 microFlow = clamp((-It / (Ix * Ix + Iy * Iy + 0.0018)) * vec2(Ix, Iy) * abs(u_flowScale), -3.5, 3.5) * u_texel;

        vec4 bPrev = textureLod(u_prevTex, clamp(uv - blockFlow * u_alpha, 0.001, 0.999), 0.0);
        vec4 bCurr = textureLod(u_currTex, clamp(uv + blockFlow * (1.0 - u_alpha), 0.001, 0.999), 0.0);
        vec3 bDiff = abs(bCurr.rgb - bPrev.rgb);
        float errBlock = max(bDiff.r, max(bDiff.g, bDiff.b));

        vec4 mPrev = textureLod(u_prevTex, clamp(uv - microFlow * u_alpha, 0.001, 0.999), 0.0);
        vec4 mCurr = textureLod(u_currTex, clamp(uv + microFlow * (1.0 - u_alpha), 0.001, 0.999), 0.0);
        vec3 mDiff = abs(mCurr.rgb - mPrev.rgb);
        float errMicro = max(mDiff.r, max(mDiff.g, mDiff.b));

        // Если блочный вектор 240x135 ломает мелкую деталь (errBlock > errMicro), выбираем точный микро-вектор!
        float preferMicro = clamp((errBlock - errMicro + 0.012) * 8.0, 0.0, 1.0) * u_detailGuard;
        vec4 wPrev = mix(bPrev, mPrev, preferMicro);
        vec4 wCurr = mix(bCurr, mCurr, preferMicro);
        float resW = mix(errBlock, errMicro, preferMicro);

        vec4 warped = mix(wPrev, wCurr, u_alpha);

        float midWindow = 4.0 * u_alpha * (1.0 - u_alpha);
        float lMin = min(luma(wPrev.rgb), luma(wCurr.rgb));
        float inkKeep = (1.0 - smoothstep(0.05, 0.20, lMin)) * clamp(u_inkGuard, 0.0, 0.85) * midWindow;
        warped = mix(warped, min(wPrev, wCurr), inkKeep);

        // Жесткая отсечка ореола по u_ghostGate
        float gate = max(0.02, u_ghostGate * 1.4);
        float trust = 1.0 - smoothstep(gate * 0.55, gate * 1.15, resW);

        outColor = mix(sharpFallback, warped, trust);
    }`;

    function compileProgram(vsSrc, fsSrc) {
        const vs = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vs, vsSrc);
        gl.compileShader(vs);
        if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) return null;

        const fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fs, fsSrc);
        gl.compileShader(fs);
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) return null;

        const p = gl.createProgram();
        gl.attachShader(p, vs);
        gl.attachShader(p, fs);
        gl.linkProgram(p);
        return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
    }

    function createTex(isMV) {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        if (isMV) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        } else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, 0);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, 3);
        }
        return t;
    }

    function ensureLucasKanadeWebGL(vid) {
        const stage = document.getElementById('jennyVideoStageV130');
        if (!stage || !vid) return false;
        const vw = vid.videoWidth || 0;
        const vh = vid.videoHeight || 0;
        if (vw < 32 || vh < 32) return false;

        const oldC = document.getElementById('jv166InterpCanvas');
        if (oldC && !oldC._isV201FixedMV) {
            oldC.remove();
            glCanvas = null;
            gl = null;
        }

        if (!glCanvas || !document.getElementById('jv166InterpCanvas')) {
            glCanvas = document.createElement('canvas');
            glCanvas.id = 'jv166InterpCanvas';
            glCanvas._isLKV169 = true;
            glCanvas._isV200MVEngine = true;
            glCanvas._isV201FixedMV = true;
            glCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;object-fit:contain;display:none;';
            stage.insertBefore(glCanvas, vid.nextSibling);

            if (!document.getElementById('jv168SplitLine')) {
                splitLineEl = document.createElement('div');
                splitLineEl.id = 'jv168SplitLine';
                splitLineEl.style.cssText = 'position:absolute;top:0;bottom:0;left:50%;width:2px;background:#00e5ff;z-index:3;pointer-events:none;display:none;box-shadow:0 0 8px #00e5ff;';
                stage.insertBefore(splitLineEl, glCanvas.nextSibling);
            } else {
                splitLineEl = document.getElementById('jv168SplitLine');
            }

            gl = glCanvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, desynchronized: true, powerPreference: 'high-performance' });
            if (!gl) return false;

            // ВАЖНО: progMV использует VS_FBO (без переворота Y), а progWarp использует VS_QUAD!
            progMV   = compileProgram(VS_FBO, FS_MV_PASS);
            progWarp = compileProgram(VS_QUAD, FS_WARP_PASS);
            if (!progMV || !progWarp) return false;

            const quad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
            const vbo = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
            gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

            iboMV = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iboMV);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 2, 1, 3]), gl.STATIC_DRAW);

            gl.useProgram(progMV);
            const locMV = gl.getAttribLocation(progMV, 'a_pos');
            gl.enableVertexAttribArray(locMV);
            gl.vertexAttribPointer(locMV, 2, gl.FLOAT, false, 0, 0);
            gl.uniform1i(gl.getUniformLocation(progMV, 'u_prevTex'), 0);
            gl.uniform1i(gl.getUniformLocation(progMV, 'u_currTex'), 1);
            uMV_TexelLoc  = gl.getUniformLocation(progMV, 'u_texel');
            uMV_RadiusLoc = gl.getUniformLocation(progMV, 'u_searchRadius');

            gl.useProgram(progWarp);
            const locW = gl.getAttribLocation(progWarp, 'a_pos');
            gl.enableVertexAttribArray(locW);
            gl.vertexAttribPointer(locW, 2, gl.FLOAT, false, 0, 0);
            gl.uniform1i(gl.getUniformLocation(progWarp, 'u_prevTex'), 0);
            gl.uniform1i(gl.getUniformLocation(progWarp, 'u_currTex'), 1);
            gl.uniform1i(gl.getUniformLocation(progWarp, 'u_mvTex'),   2);

            uAlphaLoc        = gl.getUniformLocation(progWarp, 'u_alpha');
            uTexelLoc        = gl.getUniformLocation(progWarp, 'u_texel');
            uFlowScaleLoc    = gl.getUniformLocation(progWarp, 'u_flowScale');
            uGhostGateLoc    = gl.getUniformLocation(progWarp, 'u_ghostGate');
            uDetailGuardLoc  = gl.getUniformLocation(progWarp, 'u_detailGuard');
            uBridgeSpreadLoc = gl.getUniformLocation(progWarp, 'u_bridgeSpread');
            uInkGuardLoc     = gl.getUniformLocation(progWarp, 'u_inkGuard');
            uSplitPosLoc     = gl.getUniformLocation(progWarp, 'u_splitPos');

            texPrev = createTex(false);
            texCurr = createTex(false);
            texMV   = createTex(true);
            gl.bindTexture(gl.TEXTURE_2D, texMV);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, MV_GRID_W, MV_GRID_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

            fboMV = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, fboMV);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texMV, 0);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }

        const fit = vid.style.objectFit || 'contain';
        if (glCanvas.style.objectFit !== fit) glCanvas.style.objectFit = fit;
        if (vid.style.filter && glCanvas.style.filter !== vid.style.filter) glCanvas.style.filter = vid.style.filter;

        const maxDim = Math.max(vw, vh);
        const scale4K = (maxDim > 1920) ? (1920.0 / maxDim) : 1.0;
        const targetW = Math.max(64, Math.round(vw * scale4K));
        const targetH = Math.max(64, Math.round(vh * scale4K));
        if (glCanvas.width !== targetW || glCanvas.height !== targetH) {
            glCanvas.width = targetW;
            glCanvas.height = targetH;
            hasValidFramePair = false;
        }

        const isSplit = (window._jv166Metrics.mode === 'split');
        if (splitLineEl) {
            splitLineEl.style.display = isSplit ? 'block' : 'none';
        }
        return true;
    }

    var baseFrameMs = 33.333;
    var lastExactDecCountV201 = -1;
    var vsyncStepInCycle = 0;

    function runMotionVectorPass() {
        if (!gl || !progMV || !fboMV || !hasValidFramePair) return;
        const tun = window._jennyTunerV190 || {};
        const searchRad = Number.isFinite(tun.searchRadius) ? tun.searchRadius : 16.0;
        const tOld = (frameSlot === 0) ? texPrev : texCurr;
        const tNew = (frameSlot === 0) ? texCurr : texPrev;

        gl.bindFramebuffer(gl.FRAMEBUFFER, fboMV);
        gl.viewport(0, 0, MV_GRID_W, MV_GRID_H);
        gl.useProgram(progMV);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tOld);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, tNew);

        gl.uniform2f(uMV_TexelLoc, 1.0 / Math.max(1, glCanvas.width), 1.0 / Math.max(1, glCanvas.height));
        gl.uniform1f(uMV_RadiusLoc, searchRad);

        // Рендерим карту векторов через drawElements, чтобы не дергать логгер drawArrays!
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iboMV);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    function onNewDecodedVideoFrame(vid, now) {
        if (!ensureLucasKanadeWebGL(vid)) return;

        // Строгая синхронизация 1-в-1 по аппаратному счетчику декодера (totalVideoFrames)
        if (vid && typeof vid.getVideoPlaybackQuality === 'function') {
            const q = vid.getVideoPlaybackQuality();
            if (q && typeof q.totalVideoFrames === 'number' && q.totalVideoFrames > 0) {
                if (q.totalVideoFrames === lastExactDecCountV201 && hasValidFramePair) {
                    return;
                }
                lastExactDecCountV201 = q.totalVideoFrames;
            }
        }

        const tun = window._jennyTunerV190 || {};
        const pll = Number.isFinite(tun.pllSmooth) ? Math.max(0.1, Math.min(0.95, tun.pllSmooth)) : 0.85;
        const spd = (vid && vid.playbackRate > 0.01) ? vid.playbackRate : 1.0;
        const nativeDt = (now - lastRealFrameTs) * spd;
        if (nativeDt > 14.0 && nativeDt < 62.0) {
            baseFrameMs = baseFrameMs * pll + nativeDt * (1.0 - pll);
        }
        lastRealFrameTs = now;
        vsyncStepInCycle = 0;
        rawDecodedTicks++;

        frameSlot = 1 - frameSlot;
        const tOld = (frameSlot === 0) ? texPrev : texCurr;
        const tNew = (frameSlot === 0) ? texCurr : texPrev;

        gl.bindTexture(gl.TEXTURE_2D, tNew);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, vid);
        gl.generateMipmap(gl.TEXTURE_2D);

        if (!hasValidFramePair) {
            gl.bindTexture(gl.TEXTURE_2D, tOld);
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
        const flowScale    = Number.isFinite(tun.flowScale)    ? tun.flowScale    : 1.00;
        const ghostGate    = Number.isFinite(tun.ghostGate)    ? tun.ghostGate    : 0.14;
        const detailGuard  = Number.isFinite(tun.detailGuard)  ? tun.detailGuard  : 0.75;
        const bridgeSpread = Number.isFinite(tun.bridgeSpread) ? tun.bridgeSpread : 0.35;
        const searchRadius = Number.isFinite(tun.searchRadius) ? tun.searchRadius : 16.0;
        const inkGuard     = Number.isFinite(tun.inkGuard)     ? tun.inkGuard     : 0.30;
        const userInterpN  = Math.round(Number.isFinite(tun.interpFrames) ? tun.interpFrames : (window._jv166Metrics.interpFrames || 0));

        const spd = (vid && vid.playbackRate > 0.01) ? vid.playbackRate : 1.0;
        const realFrameDurationMs = Math.max(14.0, baseFrameMs / spd);
        const vsyncIntervalMs = 1000.0 / Math.max(60, window._jv166Metrics.screenHz || 120);

        const autoSteps = Math.max(1, Math.round(realFrameDurationMs / vsyncIntervalMs));
        const totalSteps = (userInterpN > 0) ? (userInterpN + 1) : autoSteps;
        window._jv166Metrics.actualPlusN = Math.max(0, totalSteps - 1);

        vsyncStepInCycle++;
        const rawTimeAlpha = (performance.now() - lastRealFrameTs + vsyncIntervalMs * 0.5) / Math.max(8.33, realFrameDurationMs);
        const linearAlpha = Math.min(0.96, Math.max(0.05, rawTimeAlpha));
        const alpha = (userInterpN > 0)
            ? Math.min(0.96, Math.max(0.05, Math.floor(linearAlpha * totalSteps + 0.5) / totalSteps))
            : linearAlpha;

        const isSplit = (window._jv166Metrics && window._jv166Metrics.mode === 'split');
        const splitRatio = Math.max(0.05, Math.min(0.95, window._jennySplitRatioV176 || 0.5));
        const splitUniformVal = isSplit ? (window._jennySplitSwappedV176 ? -splitRatio : splitRatio) : 0.0;

        const tOld = (frameSlot === 0) ? texPrev : texCurr;
        const tNew = (frameSlot === 0) ? texCurr : texPrev;

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
                // Проверяем смену кадра декодера на каждом 120Hz тике (строго 1-в-1 с decFrm!)
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
        }"""

for root, _, files in os.walk(BASE_DIR):
    if "node_modules" in root or ".git" in root:
        continue
    if "ui_v71.js" in files:
        path = os.path.join(root, "ui_v71.js")
        code = open(path, "r", encoding="utf-8", errors="ignore").read()

        # 1. Чиним V172 в самом верху файла, чтобы он не сбивал viewport 240x135 у FBO
        code, n1 = re.subn(
            r"/\*\s*=================\s*JENNY V172:.*?/\*\s*=================\s*END JENNY V172 CLEAN FIX\s*=================\s*\*/",
            V172_SAFE_VIEWPORT_HOOK,
            code,
            count=1,
            flags=re.DOTALL
        )

        # 2. Заменяем ядро V200 на исправленное V201 (правильная ось Y у карты векторов 240x135, drawElements для FBO, без linearBlend ореола и со строгим синхроном decFrm)
        code, n2 = re.subn(
            r"let\s+glCanvas\s*=\s*null;\s*let\s+splitLineEl\s*=\s*null;.*?if\s*\(\s*glCanvas\s*\)\s*glCanvas\.style\.display\s*=\s*'none';\s*if\s*\(\s*splitLineEl\s*\)\s*splitLineEl\.style\.display\s*=\s*'none';\s*hasValidFramePair\s*=\s*false;\s*\}",
            V201_MV_ENGINE_CORE,
            code,
            count=1,
            flags=re.DOTALL
        )

        # 3. При открытии нового видео сбрасываем счетчик lastExactDecCountV201
        code = code.replace("lastUploadedVideoTime = -1.0;", "lastExactDecCountV201 = -1;")

        open(path, "w", encoding="utf-8").write(code)
        print(f"[V201] Исправлены все 4 бага карты векторов 240x135 в {path} (v172={n1}, v201_core={n2})")

/* ============================================================================
 * ui_framegen.js — 120 Гц: генерация кадров, тюнер, лаборатория, vcore
 *
 * Склейка:  /bundle_2_player.js, модуль 11 из 18. Порядок модулей задан в player.py и менять его нельзя:
 *           поздние модули переопределяют и оборачивают функции ранних.
 * Внутри:   computeExactVideoSplitUvV208, getRealOrigFpsV208, setInterpFramesV200, cycleVideo120HzModeV166, fetchVCoreStatusV166, jv166BindSo, jv166SetMode, openJennyVideoPlayerV130, getExactInterpAlphaV170, saveJennyLabFlagsV208 … (всего функций: 20)
 * Откуда:   ui_v71.js (коммит 9ae6639), строки 2…37325 (22 фрагментов, вперемешку с другими темами). Код блоков перенесён без правок.
 * Подробно: FILES.md (карта файлов), REFACTOR_PLAN.md (как резалось и что перекрыто).
 * ============================================================================ */
/* ================= JENNY V172: CLEAN VIEWPORT & ORIG SPLIT FIX (GATED BY V205 SWITCH) ================= */
window._jennyExp120HzEnabledV205 = (localStorage.getItem('jenny_exp_120hz_v205') === '1');
;(function() {
    if (window._jennyV172ViewportFixed) return;
    window._jennyV172ViewportFixed = true;

    function hookViewportOnly(Proto) {
        if (!Proto || Proto._v172Hooked) return;
        Proto._v172Hooked = true;

        var origDrawArrays = Proto.drawArrays;
        Proto.drawArrays = function(mode, first, count) {
            if (window._jennyExp120HzEnabledV205 && this.canvas && this.drawingBufferWidth > 0 && this.drawingBufferHeight > 0) {
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


// === 🧠🎬 JENNY V200: TRUE 120Hz DENSE MOTION-VECTOR PYRAMID + A->[B IGNORE]->C DEDUPLICATOR (V202) ===
/* [split] V200: кусок исходного IIFE (ui_v71.js, строки 13620–14829) → ui_framegen.js */
;(function initJennyVCoreMatrixV166() {
    window._vcoreStateV166 = null;
    window._vcoreLastProbeV166 = { cipher: 'AV1', bound_so: 'libjenny_vcore.so (NEON-MV-V202)', synth_4frames_ms: 0.24 };

    window._jv166Metrics = {
        screenHz: 120,
        sourceFps: 24,
        outputFps: 120,
        interpFrames: 0, // 0 = Авто 120Hz, 1..5 = Фиксированно +N промежуточных кадров
        actualPlusN: 4,
        mode: '120' // '120' | 'split' | 'off'
    };

            window._jennyTunerV190 = window._jennyTunerV190 || {
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
    if (isNaN(window._jennyTunerV190.targetFps)) window._jennyTunerV190.targetFps = 120;
let vsyncTicks = 0;
    let synthOutTicks = 0;
    let rawDecodedTicks = 0;
    let lastMetricTs = performance.now();

    let lastRealFrameTs = 0;
    let hasValidFramePair = false;

        let glCanvas = null;
    let splitLineEl = null;
    let gl = null;
    let progMVCoarse = null;
    let progMVFine   = null;
    let progMVSmooth = null;
    let progWarp     = null;
    // Кольцевой буфер на 4 текстуры (T0..T3) для предчтения и перелета через дубли A -> [B] -> C
    let ringTex = [null, null, null, null];
    let slotPrev = 0;
    let slotCurr = 1;
    let slotWrite = 2;
    let texPrev = null;
    let texCurr = null;
    let texMVCoarse = null;
    let texMVFine   = null;
    let texMV       = null;
    let fboMVCoarse = null;
    let fboMVFine   = null;
    let fboMV       = null;
    let iboMV = null;
    const MV_COARSE_W = 120;
    const MV_COARSE_H = 68;
    const MV_GRID_W = 240;
    const MV_GRID_H = 135;
    let frameSlot = 0;

    let uMVC_TexelLoc  = null;
    let uMVC_RadiusLoc = null;
    let uMVF_TexelLoc  = null;
    let uMVF_RadiusLoc = null;

    let uAlphaLoc = null;
    let uTexelLoc = null;
    let uFlowScaleLoc = null;
    let uGhostGateLoc = null;
    let uDetailGuardLoc = null;
    let uBridgeSpreadLoc = null;
    let uInkGuardLoc = null;
    let uSplitPosLoc = null;

    const VS_QUAD = `#version 300 es
    in vec2 a_pos;
    out vec2 v_uv;
    void main() {
        v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
        gl_Position = vec4(a_pos, 0.0, 1.0);
    }`;

    const VS_FBO = `#version 300 es
    in vec2 a_pos;
    out vec2 v_uv;
    void main() {
        v_uv = a_pos * 0.5 + 0.5;
        gl_Position = vec4(a_pos, 0.0, 1.0);
    }`;

    // ПРОХОД 1 (120x68, LOD=3.0): ГРУБЫЙ ПОИСК ПО ЦВЕТУ + ЗНАКУ ПРОСТРАНСТВЕННОГО ГРАДИЕНТА (БЕЗ ИНВЕРСИИ ВЕКТОРОВ)
    const FS_MV_COARSE = `#version 300 es
    precision highp float;
    in vec2 v_uv;
    uniform sampler2D u_prevTex;
    uniform sampler2D u_currTex;
    uniform vec2 u_texel;
    uniform float u_searchRadius;
    out vec4 outMV;

    float patchError(vec2 uv, vec2 flow, float lod, vec2 patchStep) {
        vec2 p0 = clamp(uv - flow * 0.5, 0.002, 0.998);
        vec2 p1 = clamp(uv + flow * 0.5, 0.002, 0.998);

        vec3 a0 = textureLod(u_prevTex, p0, lod).rgb;
        vec3 b0 = textureLod(u_currTex, p1, lod).rgb;
        vec3 d0 = abs(b0 - a0);
        float err = (d0.r + d0.g + d0.b) * 0.5;

        const vec2 offs[4] = vec2[4](
            vec2(1.0, 0.0), vec2(0.0, 1.0), vec2(1.0, 1.0), vec2(1.0, -1.0)
        );
        for (int i = 0; i < 4; i++) {
            vec2 d = offs[i] * patchStep;
            vec3 ap = textureLod(u_prevTex, clamp(p0 + d, 0.002, 0.998), lod).rgb;
            vec3 am = textureLod(u_prevTex, clamp(p0 - d, 0.002, 0.998), lod).rgb;
            vec3 bp = textureLod(u_currTex, clamp(p1 + d, 0.002, 0.998), lod).rgb;
            vec3 bm = textureLod(u_currTex, clamp(p1 - d, 0.002, 0.998), lod).rgb;

            vec3 eCol = abs(bp - ap) + abs(bm - am);
            vec3 eGrd = abs((bp - bm) - (ap - am)) * 1.6;
            vec3 tot = eCol + eGrd;
            err += (tot.r + tot.g + tot.b) * 0.3333;
        }
        return err;
    }

    void main() {
        vec2 uv = clamp(v_uv, 0.003, 0.997);
        float maxRad = clamp(u_searchRadius, 8.0, 48.0);
        vec2 maxUv = u_texel * maxRad;
        vec2 pStep = u_texel * 16.0;

        vec2 bestFlow = vec2(0.0);
        float bestErr = patchError(uv, vec2(0.0), 3.0, pStep);
        if (bestErr < 0.025) {
            outMV = vec4(0.5, 0.5, 0.0, 0.0);
            return;
        }

        const vec2 dirs[8] = vec2[8](
            vec2(1.0, 0.0), vec2(-1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, -1.0),
            vec2(0.707, 0.707), vec2(-0.707, 0.707), vec2(0.707, -0.707), vec2(-0.707, -0.707)
        );
        const float scales[3] = float[3](0.55, 0.28, 0.14);

        for (int s = 0; s < 3; s++) {
            vec2 baseFlow = bestFlow;
            vec2 stepUv = maxUv * scales[s];
            for (int i = 0; i < 8; i++) {
                vec2 cand = clamp(baseFlow + dirs[i] * stepUv, -maxUv, maxUv);
                float e = patchError(uv, cand, 3.0, pStep);
                if (e < bestErr * 0.98) {
                    bestErr = e;
                    bestFlow = cand;
                }
            }
        }

        vec2 normFlow = clamp(bestFlow / max(maxUv, vec2(1e-5)), -1.0, 1.0);
        outMV = vec4(normFlow * 0.5 + 0.5, 1.0, 1.0);
    }`;

    // ПРОХОД 2 (240x135, LOD=2.0): УТОЧНЕНИЕ ВЕКТОРА С РЕГУЛЯРИЗАЦИЕЙ К ГРУБОМУ УРОВНЮ И ОЦЕНКОЙ ДОВЕРИЯ
    const FS_MV_FINE = `#version 300 es
    precision highp float;
    in vec2 v_uv;
    uniform sampler2D u_prevTex;
    uniform sampler2D u_currTex;
    uniform sampler2D u_coarseMV;
    uniform vec2 u_texel;
    uniform float u_searchRadius;
    out vec4 outMV;

    vec2 readCoarse(vec2 uv, vec2 maxUv) {
        vec2 cStep = vec2(1.0 / 120.0, 1.0 / 68.0);
        vec2 c0 = texture(u_coarseMV, clamp(uv, 0.003, 0.997)).rg;
        vec2 cL = texture(u_coarseMV, clamp(uv - vec2(cStep.x, 0.0), 0.003, 0.997)).rg;
        vec2 cR = texture(u_coarseMV, clamp(uv + vec2(cStep.x, 0.0), 0.003, 0.997)).rg;
        vec2 cU = texture(u_coarseMV, clamp(uv - vec2(0.0, cStep.y), 0.003, 0.997)).rg;
        vec2 cD = texture(u_coarseMV, clamp(uv + vec2(0.0, cStep.y), 0.003, 0.997)).rg;
        vec2 avg = c0 * 0.40 + (cL + cR + cU + cD) * 0.15;
        return (avg - 0.5) * 2.0 * maxUv;
    }

    float patchErrorFine(vec2 uv, vec2 flow, vec2 priorFlow, vec2 maxUv, vec2 patchStep) {
        vec2 p0 = clamp(uv - flow * 0.5, 0.002, 0.998);
        vec2 p1 = clamp(uv + flow * 0.5, 0.002, 0.998);

        vec3 a0 = textureLod(u_prevTex, p0, 2.0).rgb;
        vec3 b0 = textureLod(u_currTex, p1, 2.0).rgb;
        vec3 d0 = abs(b0 - a0);
        float err = (d0.r + d0.g + d0.b) * 0.5;

        const vec2 offs[4] = vec2[4](
            vec2(1.0, 0.0), vec2(0.0, 1.0), vec2(1.0, 1.0), vec2(1.0, -1.0)
        );
        for (int i = 0; i < 4; i++) {
            vec2 d = offs[i] * patchStep;
            vec3 ap = textureLod(u_prevTex, clamp(p0 + d, 0.002, 0.998), 2.0).rgb;
            vec3 am = textureLod(u_prevTex, clamp(p0 - d, 0.002, 0.998), 2.0).rgb;
            vec3 bp = textureLod(u_currTex, clamp(p1 + d, 0.002, 0.998), 2.0).rgb;
            vec3 bm = textureLod(u_currTex, clamp(p1 - d, 0.002, 0.998), 2.0).rgb;

            vec3 eCol = abs(bp - ap) + abs(bm - am);
            vec3 eGrd = abs((bp - bm) - (ap - am)) * 1.6;
            vec3 tot = eCol + eGrd;
            err += (tot.r + tot.g + tot.b) * 0.3333;
        }
        vec2 dNorm = (flow - priorFlow) / max(maxUv, vec2(1e-5));
        err += length(dNorm) * 0.08;
        return err;
    }

    void main() {
        vec2 uv = clamp(v_uv, 0.003, 0.997);
        float maxRad = clamp(u_searchRadius, 8.0, 48.0);
        vec2 maxUv = u_texel * maxRad;
        vec2 pStep = u_texel * 7.5;

        vec2 priorFlow = readCoarse(uv, maxUv);
        float zeroErr  = patchErrorFine(uv, vec2(0.0), vec2(0.0), maxUv, pStep);
        if (zeroErr < 0.020) {
            outMV = vec4(0.5, 0.5, 0.0, 0.0);
            return;
        }

        vec2 bestFlow = priorFlow;
        float bestErr = patchErrorFine(uv, priorFlow, priorFlow, maxUv, pStep);
        if (zeroErr < bestErr) {
            bestErr = zeroErr;
            bestFlow = vec2(0.0);
        }

        const vec2 dirs[8] = vec2[8](
            vec2(1.0, 0.0), vec2(-1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, -1.0),
            vec2(0.707, 0.707), vec2(-0.707, 0.707), vec2(0.707, -0.707), vec2(-0.707, -0.707)
        );
        const float scales[2] = float[2](0.18, 0.08);

        for (int s = 0; s < 2; s++) {
            vec2 baseFlow = bestFlow;
            vec2 stepUv = maxUv * scales[s];
            for (int i = 0; i < 8; i++) {
                vec2 cand = clamp(baseFlow + dirs[i] * stepUv, -maxUv, maxUv);
                float e = patchErrorFine(uv, cand, priorFlow, maxUv, pStep);
                if (e < bestErr * 0.985) {
                    bestErr = e;
                    bestFlow = cand;
                }
            }
        }

        float relGain = clamp((zeroErr - bestErr * 0.75) / (zeroErr + 0.12), 0.0, 1.0);
        vec2 normFlow = clamp(bestFlow / max(maxUv, vec2(1e-5)), -1.0, 1.0);
        outMV = vec4(normFlow * 0.5 + 0.5, relGain, clamp(bestErr * 0.15, 0.0, 1.0));
    }`;

    // ПРОХОД 3 (240x135): 5x5 ПРОСТРАНСТВЕННАЯ ФИЛЬТРАЦИЯ ВЕКТОРОВ И МАСКИ ДОВЕРИЯ
    const FS_MV_SMOOTH = `#version 300 es
    precision highp float;
    in vec2 v_uv;
    uniform sampler2D u_fineMV;
    out vec4 outMV;

    void main() {
        vec2 stepMV = vec2(1.0 / 240.0, 1.0 / 135.0);

        vec2 sumFlow = vec2(0.0);
        float sumConf = 0.0;
        float sumErr  = 0.0;
        float wTotal  = 0.0;

        for (int dy = -2; dy <= 2; dy++) {
            for (int dx = -2; dx <= 2; dx++) {
                vec2 uvN = clamp(v_uv + vec2(float(dx), float(dy)) * stepMV, 0.002, 0.998);
                vec4 s = texture(u_fineMV, uvN);
                float dist2 = float(dx * dx + dy * dy);
                float wSpatial = exp(-dist2 * 0.35);
                float wConf = 0.25 + s.b * 0.75;
                float w = wSpatial * wConf;
                sumFlow += s.rg * w;
                sumConf += s.b  * wSpatial;
                sumErr  += s.a  * wSpatial;
                wTotal  += w;
            }
        }
        float wSpatialSum = 11.45;
        outMV = vec4(sumFlow / max(wTotal, 1e-4), clamp(sumConf / wSpatialSum, 0.0, 1.0), clamp(sumErr / wSpatialSum, 0.0, 1.0));
    }`;

    // ПРОХОД 4 (1080p, 120 Гц): ЧИСТЫЙ ВАРПИНГ ПО ГЛАДКОМУ ПОЛЮ БЕЗ ЧЁРНЫХ ДЫР (min) И БЕЗ ПИКСЕЛЬНОЙ РВАНИНЫ
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

    void main() {
        vec2 uv = clamp(v_uv, vec2(0.001), vec2(0.999));

        if (abs(u_splitPos) > 0.001) {
            float sp = abs(u_splitPos);
            bool isOrigSide = (u_splitPos > 0.0) ? (uv.x < sp) : (uv.x >= sp);
            if (isOrigSide) {
                outColor = textureLod(u_prevTex, uv, 0.0);
                return;
            }
        }

        if (u_alpha >= 0.995) {
            outColor = textureLod(u_currTex, uv, 0.0);
            return;
        }

        vec4 cPrev = textureLod(u_prevTex, uv, 0.0);
        vec4 cCurr = textureLod(u_currTex, uv, 0.0);
        vec4 smoothFallback = mix(cPrev, cCurr, u_alpha);

        float maxRad = clamp(u_searchRadius, 8.0, 48.0);
        vec2 maxUv = u_texel * maxRad;

        vec4 mvData = texture(u_mvTex, clamp(uv, 0.002, 0.998));
        vec2 rawFlow = (mvData.rg - 0.5) * 2.0 * maxUv * abs(u_flowScale);
        float mvConf = mvData.b;

        vec2 effFlow = rawFlow * (0.35 + 0.65 * mvConf);

        vec2 uvPrev = clamp(uv - effFlow * u_alpha, 0.001, 0.999);
        vec2 uvCurr = clamp(uv + effFlow * (1.0 - u_alpha), 0.001, 0.999);

        vec4 wPrev = textureLod(u_prevTex, uvPrev, 0.0);
        vec4 wCurr = textureLod(u_currTex, uvCurr, 0.0);
        vec4 warped = mix(wPrev, wCurr, u_alpha);

        vec3 wPrevCoarse = textureLod(u_prevTex, uvPrev, 2.0).rgb;
        vec3 wCurrCoarse = textureLod(u_currTex, uvCurr, 2.0).rgb;
        vec3 cPrevCoarse = textureLod(u_prevTex, uv, 2.0).rgb;
        vec3 cCurrCoarse = textureLod(u_currTex, uv, 2.0).rgb;

        vec3 dWarp = abs(wCurrCoarse - wPrevCoarse);
        vec3 dZero = abs(cCurrCoarse - cPrevCoarse);
        float errWarp = (dWarp.r + dWarp.g + dWarp.b) * 0.3333;
        float errZero = (dZero.r + dZero.g + dZero.b) * 0.3333;

        float gateScale = clamp(u_ghostGate / 0.14, 0.4, 2.5);
        float coarseTrust = clamp((errZero * gateScale - errWarp * 0.70) / (errZero + 0.025), 0.0, 1.0);
        float trust = clamp(mvConf * (0.45 + 0.55 * coarseTrust), 0.0, 1.0);

        outColor = mix(smoothFallback, warped, trust);
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
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, 4);
        }
        return t;
    }

    function createFBOForTex(tex, w, h) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return fbo;
    }

    function ensureLucasKanadeWebGL(vid) {
        const stage = document.getElementById('jennyVideoStageV130');
        if (!stage || !vid) return false;
        const vw = vid.videoWidth || 0;
        const vh = vid.videoHeight || 0;
        if (vw < 32 || vh < 32) return false;

        const oldC = document.getElementById('jv166InterpCanvas');
        if (oldC && !oldC._isV203PyramidMV) {
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
            glCanvas._isV202DedupMV = true;
            glCanvas._isV203PyramidMV = true;
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

            progMVCoarse = compileProgram(VS_FBO, FS_MV_COARSE);
            progMVFine   = compileProgram(VS_FBO, FS_MV_FINE);
            progMVSmooth = compileProgram(VS_FBO, FS_MV_SMOOTH);
            progWarp     = compileProgram(VS_QUAD, FS_WARP_PASS);
            if (!progMVCoarse || !progMVFine || !progMVSmooth || !progWarp) return false;

            const quad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
            const vbo = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
            gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

            iboMV = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iboMV);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 2, 1, 3]), gl.STATIC_DRAW);

            [progMVCoarse, progMVFine, progMVSmooth, progWarp].forEach(function(p) {
                gl.useProgram(p);
                const loc = gl.getAttribLocation(p, 'a_pos');
                gl.enableVertexAttribArray(loc);
                gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
            });

            gl.useProgram(progMVCoarse);
            gl.uniform1i(gl.getUniformLocation(progMVCoarse, 'u_prevTex'), 0);
            gl.uniform1i(gl.getUniformLocation(progMVCoarse, 'u_currTex'), 1);
            uMVC_TexelLoc  = gl.getUniformLocation(progMVCoarse, 'u_texel');
            uMVC_RadiusLoc = gl.getUniformLocation(progMVCoarse, 'u_searchRadius');

            gl.useProgram(progMVFine);
            gl.uniform1i(gl.getUniformLocation(progMVFine, 'u_prevTex'),  0);
            gl.uniform1i(gl.getUniformLocation(progMVFine, 'u_currTex'),  1);
            gl.uniform1i(gl.getUniformLocation(progMVFine, 'u_coarseMV'), 2);
            uMVF_TexelLoc  = gl.getUniformLocation(progMVFine, 'u_texel');
            uMVF_RadiusLoc = gl.getUniformLocation(progMVFine, 'u_searchRadius');

            gl.useProgram(progMVSmooth);
            gl.uniform1i(gl.getUniformLocation(progMVSmooth, 'u_fineMV'), 0);

            gl.useProgram(progWarp);
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

            ringTex[0] = createTex(false);
            ringTex[1] = createTex(false);
            ringTex[2] = createTex(false);
            ringTex[3] = createTex(false);
            texPrev = ringTex[0];
            texCurr = ringTex[1];

            texMVCoarse = createTex(true);
            texMVFine   = createTex(true);
            texMV       = createTex(true);

            fboMVCoarse = createFBOForTex(texMVCoarse, MV_COARSE_W, MV_COARSE_H);
            fboMVFine   = createFBOForTex(texMVFine,   MV_GRID_W,   MV_GRID_H);
            fboMV       = createFBOForTex(texMV,       MV_GRID_W,   MV_GRID_H);
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

        const isSplit = Boolean(window._jv166Metrics.mode === 'split' && window._jennyLabFlagsV208 && window._jennyLabFlagsV208.splitTest);
        if (splitLineEl) {
            splitLineEl.style.display = isSplit ? 'block' : 'none';
        }
        return true;
    }

            var baseFrameMs = 41.667;
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
        if (!gl || !progMVCoarse || !progMVFine || !progMVSmooth || !fboMV || !hasValidFramePair) return;
        const tun = window._jennyTunerV190 || {};
        const searchRad = Number.isFinite(tun.searchRadius) ? tun.searchRadius : 24.0;
        const tOld = ringTex[slotPrev] || texPrev;
        const tNew = ringTex[slotCurr] || texCurr;
        const tx = 1.0 / Math.max(1, glCanvas.width);
        const ty = 1.0 / Math.max(1, glCanvas.height);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iboMV);

        gl.bindFramebuffer(gl.FRAMEBUFFER, fboMVCoarse);
        gl.viewport(0, 0, MV_COARSE_W, MV_COARSE_H);
        gl.useProgram(progMVCoarse);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tOld);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, tNew);
        gl.uniform2f(uMVC_TexelLoc, tx, ty);
        gl.uniform1f(uMVC_RadiusLoc, searchRad);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

        gl.bindFramebuffer(gl.FRAMEBUFFER, fboMVFine);
        gl.viewport(0, 0, MV_GRID_W, MV_GRID_H);
        gl.useProgram(progMVFine);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tOld);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, tNew);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, texMVCoarse);
        gl.uniform2f(uMVF_TexelLoc, tx, ty);
        gl.uniform1f(uMVF_RadiusLoc, searchRad);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

        gl.bindFramebuffer(gl.FRAMEBUFFER, fboMV);
        gl.viewport(0, 0, MV_GRID_W, MV_GRID_H);
        gl.useProgram(progMVSmooth);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texMVFine);
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

        gl.activeTexture(gl.TEXTURE0);
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

        // ШАГ 5: СТРОГИЙ ШАГОВЫЙ СЧЁТЧИК VSYNC БЕЗ ДУБЛЕЙ 0.250->0.250 И БЕЗ ПРЫЖКОВ 0.500->0.980
        window.computeExactVideoSplitUvV208 = function(vid, stageRatio) {
        const r = Math.max(0.02, Math.min(0.98, Number(stageRatio) || 0.5));
        if (!vid || !glCanvas) return r;
        const stage = document.getElementById('jennyVideoStageV130') || vid.parentElement;
        if (!stage) return r;

        const stageW = stage.clientWidth || glCanvas.clientWidth || 1;
        const stageH = stage.clientHeight || glCanvas.clientHeight || 1;
        const vw = vid.videoWidth || glCanvas.width || 1;
        const vh = vid.videoHeight || glCanvas.height || 1;
        if (stageW < 16 || stageH < 16 || vw < 16 || vh < 16) return r;

        const fit = (vid.style && vid.style.objectFit) || (window._vidStateV130 && window._vidStateV130.fitMode) || 'contain';
        if (fit === 'fill') return r;

        const stageAspect = stageW / stageH;
        const vidAspect = vw / vh;
        let renderW = stageW;
        let padX = 0.0;

        if (fit === 'contain') {
            if (stageAspect > vidAspect) {
                renderW = stageH * vidAspect;
                padX = (stageW - renderW) * 0.5;
            }
        } else if (fit === 'cover') {
            if (stageAspect < vidAspect) {
                renderW = stageH * vidAspect;
                padX = (stageW - renderW) * 0.5;
            }
        }

        const lineStageX = r * stageW;
        const uvX = (lineStageX - padX) / Math.max(1.0, renderW);
        return Math.max(0.001, Math.min(0.999, uvX));
    };

    window.getRealOrigFpsV208 = function() {
        const m = window._jv166Metrics || {};
        if (m.fileNativeFps && m.fileNativeFps >= 5 && m.fileNativeFps <= 240) return Math.round(m.fileNativeFps);
        if (m.sourceFps && m.sourceFps >= 5 && m.sourceFps <= 240) return Math.round(m.sourceFps);
        return 24;
    };

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
        const expectedSpanMs = Math.max(baseFrameMs, uniqueSpanMs, (consecutiveSkippedDups + 1) * baseFrameMs) / spd;
        const screenHz = Math.max(60, window._jv166Metrics.screenHz || 120);
        const effFps = (targetFps > 0) ? targetFps : screenHz;

        // Точное число тактов VSync на один исходный кадр (4 для 30->120 FPS, 5 для 24->120 FPS)
        const totalSteps = Math.max(2, Math.min(60, Math.round((expectedSpanMs / 1000.0) * effFps)));
        window._jv166Metrics.actualPlusN = Math.max(0, totalSteps - 1);

        // Каждый тик экрана гарантированно сдвигает шаг на +1 (никаких повторов 0.250 -> 0.250!)
        vsyncStepInCycle++;
        const stepAlpha = Math.min(1.000, Math.max(1.0 / totalSteps, vsyncStepInCycle / totalSteps));
        const alpha = Math.max(lastMonotonicAlpha, stepAlpha);
        lastMonotonicAlpha = alpha;
        window._jv207Diag = {
            step: vsyncStepInCycle,
            totalSteps: totalSteps,
            alpha: alpha,
            expectedSpanMs: expectedSpanMs,
            engineDecCount: lastExactDecCountV201
        };

        const isSplit = Boolean(window._jv166Metrics && window._jv166Metrics.mode === 'split' && window._jennyLabFlagsV208 && window._jennyLabFlagsV208.splitTest);
        const rawStageRatio = Math.max(0.05, Math.min(0.95, window._jennySplitRatioV176 || 0.5));
        const exactVideoUvX = window.computeExactVideoSplitUvV208 ? window.computeExactVideoSplitUvV208(vid, rawStageRatio) : rawStageRatio;
        const splitUniformVal = isSplit ? (window._jennySplitSwappedV176 ? -exactVideoUvX : exactVideoUvX) : 0.0;

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
        const st = window._vidStateV130;
        const isBg = (typeof window.isJennyAppBackgroundedV264 === 'function') ? window.isJennyAppBackgroundedV264() : document.hidden;
        if (isBg || !window._jennyExp120HzEnabledV205 || !st || !st.active) {
            if (glCanvas) glCanvas.style.display = 'none';
            if (splitLineEl) splitLineEl.style.display = 'none';
            hasValidFramePair = false;
            setTimeout(function() { requestAnimationFrame(master120HzLoop); }, 450);
            return;
        }
        vsyncTicks++;
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
    requestAnimationFrame(master120HzLoop);

    window.setInterpFramesV200 = async function(numFrames) {
        const n = Math.max(0, Math.min(5, parseInt(numFrames, 10) || 0));
        window._jv166Metrics.interpFrames = n;
        if (window._jennyTunerV190) {
            window._jennyTunerV190.interpFrames = n;
            try { localStorage.setItem('jt190_interpFrames', String(n)); } catch (e) {}
        }
        window.updateVideoHeaderTelemetryV166();
        if (typeof window.showToast === 'function') {
            window.showToast(n === 0
                ? '⚡ Дорисовка кадров: АВТО до 120Hz'
                : ('🎞️ Дорисовка: +' + n + ' промеж. кадра на каждый 1 исходный (x' + (n + 1) + ' FPS)'));
        }
        try {
            const r = await fetch('/api/video/vcore_interp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ interp_frames: n })
            });
            if (r.ok) {
                window._vcoreStateV166 = await r.json();
                window.renderVCoreDeckPanelV166();
            }
        } catch (e) {}
    };

    window.cycleVideo120HzModeV166 = function(ev) {
        if (window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
        if (ev && ev.stopPropagation) ev.stopPropagation();
        const m = window._jv166Metrics;
        const order = ['120', 'split', 'off'];
        m.mode = order[(order.indexOf(m.mode) + 1) % order.length];

        const btn = document.getElementById('v166Btn120Mode');
        if (btn) {
            if (m.mode === '120') {
                btn.innerText = '⚡ 120Hz';
                btn.style.borderColor = '#00ff9d';
                btn.style.color = '#00ff9d';
            } else if (m.mode === 'split') {
                btn.innerText = '🌓 Сплит 24/120';
                btn.style.borderColor = '#00e5ff';
                btn.style.color = '#00e5ff';
            } else {
                btn.innerText = '🎞️ 24/60 Ориг';
                btn.style.borderColor = '#8b949e';
                btn.style.color = '#8b949e';
            }
        }

        const msgMap = {
            '120': '⚡ MV-Interp V202 ВКЛ (Игнор кадров-дубликатов A->[B]->C + Прямой путь 120Hz)',
            'split': '🌓 СПЛИТ: Слева оригинал │ Справа MV-Interp V202 (без дублей B==A)',
            'off': '🎞️ Генератор ВЫКЛ: чистые исходные кадры файла (24/30/60 FPS)'
        };
        if (typeof window.showVideoFeedbackV130 === 'function') {
            window.showVideoFeedbackV130(msgMap[m.mode]);
        }
        window.jv166SetMode('fps_mode', m.mode === 'off' ? 'OFF' : '120_MV_PASSTHROUGH');
        window.updateVideoHeaderTelemetryV166();
        if (typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
    };

    function mount120HzButtonInVideoHud() {
        const oldBtn = document.getElementById('v166Btn120Mode');
        if (oldBtn) oldBtn.remove();
        return;
        if (!window._jennyExp120HzEnabledV205) {
            const bOff = document.getElementById('v166Btn120Mode');
            if (bOff) bOff.style.setProperty('display', 'none', 'important');
            return;
        }
        const dspBtn = document.getElementById('v130BtnDsp');
        if (!dspBtn || !dspBtn.parentElement || document.getElementById('v166Btn120Mode')) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'v166Btn120Mode';
        btn.className = 'v130-btn';
        btn.style.cssText = 'border-color:#00ff9d !important;color:#00ff9d !important;';
        btn.innerText = '⚡ 120Hz';
        btn.onclick = (e) => window.cycleVideo120HzModeV166(e);
        dspBtn.parentElement.insertBefore(btn, dspBtn);
    }

    window.fetchVCoreStatusV166 = async function() {
        try {
            const r = await fetch('/api/video/vcore_status');
            if (r.ok) {
                window._vcoreStateV166 = await r.json();
                if (window._vcoreStateV166 && window._vcoreStateV166.config && typeof window._vcoreStateV166.config.interp_frames === 'number') {
                    window._jv166Metrics.interpFrames = window._vcoreStateV166.config.interp_frames;
                }
                window.renderVCoreDeckPanelV166();
            }
        } catch (e) {}
    };

    window.jv166BindSo = async function(fmt, soName) {
        try {
            const r = await fetch('/api/video/vcore_bind', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ format: fmt, so_name: soName })
            });
            if (r.ok) {
                window._vcoreStateV166 = await r.json();
                if (window._vcoreLastProbeV166 && window._vcoreLastProbeV166.cipher === fmt) {
                    window._vcoreLastProbeV166.bound_so = soName;
                }
                window.renderVCoreDeckPanelV166();
                window.updateVideoHeaderTelemetryV166();
                if (typeof window.showToast === 'function') {
                    window.showToast('🧬 Ядро для ' + fmt + ': ' + soName);
                }
            }
        } catch (e) {}
    };

    window.jv166SetMode = async function(key, val) {
        try {
            const payload = {};
            payload[key] = val;
            const r = await fetch('/api/video/vcore_bind', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (r.ok) {
                window._vcoreStateV166 = await r.json();
                window.renderVCoreDeckPanelV166();
            }
        } catch (e) {}
    };

    const _origOpenVideoV130 = window.openJennyVideoPlayerV130;
    if (typeof _origOpenVideoV130 === 'function') {
        window.openJennyVideoPlayerV130 = function(streamUrl, titleStr, opts) {
            const r = _origOpenVideoV130.apply(this, arguments);
            hasValidFramePair = false;
            lastExactDecCountV201 = -1;
            consecutiveSkippedDups = 0;
            window._jennySkippedDupsTotal = 0;
            mount120HzButtonInVideoHud();
            window.probeVideoCipherV166(streamUrl, titleStr);
            return r;
        };
    }

    setTimeout(() => {
        mount120HzButtonInVideoHud();
        window.fetchVCoreStatusV166();
    }, 450);
})();

/* [split] V170: кусок исходного IIFE (ui_v71.js, строки 14832–15119) → ui_framegen.js */
;(function() {
    if (window._jennyV170Installed__framegen) return;
    window._jennyV170Installed__framegen = true;
    window._jennyV170Installed = true;
    /* [split] копии локальных помощников этого патча (без собственного состояния) */
    function getVideoElV170() {
        return document.getElementById('jennyVideoElV130') || document.querySelector('video');
    }
    function attachExactFrameTrackerV170() {
        var vEl = getVideoElV170();
        if (!vEl || vEl._v170FrameTrackerAttached) return;
        vEl._v170FrameTrackerAttached = true;
        window._v170NewDecodedFrameReady = true;

        if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
            var onDecodedFrame = function(now, metadata) {
                var prevStamp = window._v170LastFrameStamp || now;
                var delta = now - prevStamp;
                if (delta > 8 && delta < 500) {
                    window._v170SourceFrameInterval = delta;
                }
                window._v170LastFrameStamp = now;
                window._v170NewDecodedFrameReady = true;
                vEl.requestVideoFrameCallback(onDecodedFrame);
            };
            vEl.requestVideoFrameCallback(onDecodedFrame);
        }
    }

    // Вычисляем точный фазовый коэффициент alpha (0.0 .. 1.0) между двумя декодированными кадрами
    window.getExactInterpAlphaV170 = function() {
        attachExactFrameTrackerV170();
        var elapsed = performance.now() - (window._v170LastFrameStamp || performance.now());
        var interval = window._v170SourceFrameInterval || (33.33 / (window._jennyVideoSpeedV170 || 1.0));
        return Math.max(0.0, Math.min(1.0, elapsed / Math.max(8.0, interval)));
    };
})();











/* ================= JENNY V210: FIXED AUTO-HIDE (MAIN+PIP), DECK B VIDEO MASTER, FULL LOCAL MOVIES ================= */
/* [split] V210: кусок исходного IIFE (ui_v71.js, строки 15132–16521) → ui_framegen.js */
;(function() {
    if (window._jennyV210Installed__framegen) return;
    window._jennyV210Installed__framegen = true;
    window._jennyV210Installed = true;
    /* [split] копии локальных помощников этого патча (без собственного состояния) */
    function isStageRot90(stageEl) {
        if (stageEl && stageEl.classList && stageEl.classList.contains('rot90-v130')) return true;
        return Boolean(window._vidStateV130 && window._vidStateV130.rotated90);
    }

    var savedFlags = {};
    try { savedFlags = JSON.parse(localStorage.getItem('jenny_lab_flags_v208') || '{}') || {}; } catch (e) {}

    window._jennyLabFlagsV208 = {
        core120:      Boolean(savedFlags.core120),
        splitTest:    Boolean(savedFlags.splitTest),
        logDots:      Boolean(savedFlags.logDots),
        tunerSliders: Boolean(savedFlags.tunerSliders),
        stub1:        savedFlags.stub1 !== undefined ? Boolean(savedFlags.stub1) : true,
        stub2:        savedFlags.stub2 !== undefined ? Boolean(savedFlags.stub2) : true,
        stub3:        Boolean(savedFlags.stub3),
        stub4:        Boolean(savedFlags.stub4),
        stub5:        Boolean(savedFlags.stub5)
    };
    var isLogCollapsed   = true;
    var isTunerCollapsed = true;

    if (window._jv166Metrics) window._jv166Metrics.mode = 'off';
    window._jennyExp120HzEnabledV205 = false;

    window.saveJennyLabFlagsV208 = function() {
        try { localStorage.setItem('jenny_lab_flags_v208', JSON.stringify(window._jennyLabFlagsV208)); } catch (e) {}
    };

    var fullStreamFallbackAppliedSrc = '';
    var fullStreamSeekOffsetSec = 0.0;

    function handleCompleteMoviesAndFullStreamV210() {
        var vd = window.videoDeckV131;
        var st = window._vidStateV130;
        var vEl = document.getElementById('jennyVideoElV130');
        if (!vEl || !st || !st.active) return;

        var rawSrc = st.currentUrl || st.rawPath || st.src || vEl.currentSrc || vEl.src || '';
        var curUrl = String(vEl.currentSrc || vEl.src || '');

        // Никогда не вмешиваемся в активный торрент-стрим или live_remux!
        if (
            (st.torHash && !st.isReadyLocalV212) ||
            st.usingRemux ||
            !window.isLocalFileFullyDownloadedV210(rawSrc) ||
            !window.isLocalFileFullyDownloadedV210(curUrl)
        ) {
            return;
        }

        if (vd && vd.studioBuffer && vd.studioBuffer._pollTimerV72) {
            clearInterval(vd.studioBuffer._pollTimerV72);
            vd.studioBuffer._pollTimerV72 = null;
        }
        var btnPieces = document.getElementById('v130BtnPieces') || document.querySelector('[onclick*="toggleVideoPieces"]');
        if (btnPieces) btnPieces.style.setProperty('display', 'none', 'important');

        if (!rawSrc || rawSrc.indexOf('/api/video/full_stream_v210') !== -1) return;

        var probeDur = (window._vcoreLastProbeV166 && window._vcoreLastProbeV166.duration_sec) || window._jennyFullMovieDurationSecV210 || 0;
        var vidDur = vEl.duration;
        var lowerSrc = rawSrc.toLowerCase();
        var isAvi = (lowerSrc.indexOf('.avi') !== -1);

        if (curUrl.indexOf('blob:') === 0 && window.isLocalFileFullyDownloadedV210(rawSrc)) {
            var directUrl = rawSrc.indexOf('/api/') === 0 ? rawSrc : ('/api/media/' + encodeURIComponent(rawSrc.replace(/^\/+/, '')));
            if (fullStreamFallbackAppliedSrc !== directUrl) {
                fullStreamFallbackAppliedSrc = directUrl;
                vEl.src = directUrl;
                vEl.play().catch(function(){});
            }
            return;
        }

        var isTruncated10s = (Number.isFinite(vidDur) && vidDur > 0.5 && vidDur <= 12.5 && (probeDur > 25.0 || isAvi));
        var hasVideoError = Boolean(vEl.error);

        if ((isTruncated10s || hasVideoError || (isAvi && vEl.readyState === 0 && vEl.networkState === 3)) && fullStreamFallbackAppliedSrc !== rawSrc) {
            fullStreamFallbackAppliedSrc = rawSrc;
            fullStreamSeekOffsetSec = 0.0;
            var cleanPath = rawSrc;
            try {
                if (cleanPath.indexOf('/api/media/') !== -1) {
                    cleanPath = decodeURIComponent(cleanPath.split('/api/media/')[1].split('?')[0]);
                }
            } catch (e) {}
            if (cleanPath.indexOf('http://') === 0 || cleanPath.indexOf('https://') === 0 || cleanPath.indexOf('/api/torrent/') !== -1) {
                return;
            }
            vEl.src = '/api/video/full_stream_v210?src=' + encodeURIComponent(cleanPath) + '&start=0';
            vEl.load();
            vEl.play().catch(function(){});
        }
    }

    // 2. ДЕКА Б (ВИДЕО): АВТОЗАПУСК И ПОЛНАЯ ПРИВЯЗКА НИЖНЕЙ ПАНЕЛИ И ДУГИ СКОРОСТИ
    var lastVideoActiveStateV210 = false;

    window.getEffectiveVideoCurrentTimeV210 = function(vEl) {
        if (!vEl) return 0;
        return fullStreamSeekOffsetSec + (vEl.currentTime || 0);
    };

    window.seekDeckBVideoToSecV210 = function(targetSec) {
        var vEl = document.getElementById('jennyVideoElV130');
        if (!vEl) return;
        var dur = window.getEffectiveVideoDurationV210(vEl);
        if (dur > 0) targetSec = Math.max(0, Math.min(dur - 0.2, targetSec));
        else targetSec = Math.max(0, targetSec);

        var curSrc = vEl.currentSrc || vEl.src || '';
        if (curSrc.indexOf('/api/video/full_stream_v210') !== -1) {
            fullStreamSeekOffsetSec = targetSec;
            var baseUrl = curSrc.split('&start=')[0];
            var wasPaused = vEl.paused;
            vEl.src = baseUrl + '&start=' + targetSec.toFixed(1);
            if (!wasPaused) vEl.play().catch(function(){});
        } else {
            fullStreamSeekOffsetSec = 0.0;
            try { vEl.currentTime = targetSec; } catch (e) {}
        }
    };

    function syncDeckBWithVideoLifecycleV210() {
        var st = window._vidStateV130;
        var vEl = document.getElementById('jennyVideoElV130');
        var isNowActive = Boolean(st && st.active && vEl);

        if (isNowActive && !lastVideoActiveStateV210) {
            lastVideoActiveStateV210 = true;
            fullStreamSeekOffsetSec = 0.0;
            fullStreamFallbackAppliedSrc = '';
            /* #354: старт Видеодеки Б никогда не переключает пульт и window.appConfig Аудиодеки А! */
            window.wakeVideoHudControlsV209();
        } else if (!isNowActive && lastVideoActiveStateV210) {
            lastVideoActiveStateV210 = false;
        }

        if (!isNowActive) return;

        handleCompleteMoviesAndFullStreamV210();

        if (isNowActive) {
            var dualOnNow = Boolean(window._dualDeckModeV131 || (window.videoDeckV131 && window.videoDeckV131.dualMode));
            var audNow = window.audio || document.querySelector('audio');
            /* V211: allow Deck A and Deck B to play simultaneously */

            var curT = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vEl) : window.getEffectiveVideoCurrentTimeV210(vEl);
            var durT = window.getEffectiveVideoDurationV167 ? window.getEffectiveVideoDurationV167(vEl) : window.getEffectiveVideoDurationV210(vEl);

            // V215: НИКОГДА не пишем время видео в #currentTime / #remainingTime Деки А!
            // Обновляем строго внутренний ползунок видеоплеера (#v130SeekSlider, #v130CurTime, #v130DurTime) и верхнюю шкалу Деки Б!
            if (!window._v130UserDraggingSeekV212 && (performance.now() - (window._v130LastDragCommitTsV212 || 0) >= 350)) {
                var vSeek = document.getElementById('v130SeekSlider');
                var vTimeLeft = document.getElementById('v130CurTime') || document.getElementById('v130TimeCur');
                var vTimeRight = document.getElementById('v130DurTime') || document.getElementById('v130TimeDur');
                if (vSeek && durT > 0) {
                    vSeek.max = '1000';
                    vSeek.value = String(Math.min(1000, Math.max(0, Math.round((curT / durT) * 1000))));
                }
                if (vTimeLeft) vTimeLeft.textContent = window.formatVideoTimeV210(curT);
                if (vTimeRight) vTimeRight.textContent = durT > 0 ? window.formatVideoTimeV210(durT) : 'Поток';
                if (typeof window.updateProgressUIDeckB === 'function' && durT > 0) {
                    var isRevB = Boolean(window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed));
                    window.updateProgressUIDeckB(curT, durT, isRevB);
                }
            }
        }
    }

    // 3. ЕДИНЫЙ АВТОСКРЫВАТЕЛЬ UI И ПЛАВАЮЩИХ ТАБЛЕТОК (ОСНОВНОЙ ПЛЕЕР + МИНИ-ПЛЕЕР PiP) V214
    var lastVideoInteractionTsV210 = performance.now();
    window._lastVideoInteractionTsV214 = lastVideoInteractionTsV210;
    var hudCurrentlyHiddenV210 = false;

    function syncFloatingPillsVisibilityV214(shouldHide) {
        var pillIds = [
            'jennyFenceWrapV173',
            'jennyTunerFloatWrapV208',
            'jennySplitPillWrapV209',
            'jenny120PillWrapV209'
        ];
        for (var i = 0; i < pillIds.length; i++) {
            var el = document.getElementById(pillIds[i]);
            if (!el) continue;
            if (shouldHide) {
                el.style.transition = 'opacity 0.18s ease';
                el.style.setProperty('opacity', '0', 'important');
                el.style.setProperty('pointer-events', 'none', 'important');
                el.classList.add('jv210-hidden-node');
            } else {
                el.classList.remove('jv210-hidden-node');
                el.style.removeProperty('opacity');
                el.style.removeProperty('pointer-events');
                el.style.opacity = '1';
                el.style.pointerEvents = 'auto';
            }
        }
    }

    function enforceHudVisibilityStateV210(shouldHide, isPip) {
        var ov = window.getVideoRootElV214();
        var hud = document.getElementById('v130HudOverlay');
        hudCurrentlyHiddenV210 = Boolean(shouldHide);

        var st = window._vidStateV130;
        if (st) {
            if (st.hudTimer) { clearTimeout(st.hudTimer); st.hudTimer = null; }
            if (st.miniHudTimer) { clearTimeout(st.miniHudTimer); st.miniHudTimer = null; }
            st.hudVisible = !shouldHide;
        }

        if (ov) {
            if (shouldHide) ov.classList.add('jv210-controls-hidden');
            else ov.classList.remove('jv210-controls-hidden');
        }

        if (hud) {
            if (shouldHide) {
                hud.classList.add('hud-hidden-v130');
            } else {
                hud.classList.remove('hud-hidden-v130');
            }
        }

        // Плавающие таблетки (Лог, Крутилки, Сплит, 120Hz) скрываются и появляются синхронно с HUD!
        syncFloatingPillsVisibilityV214(shouldHide);
    }

    window.setVideoHudHiddenUnifiedV214 = function(shouldHide, fromTapWake) {
        var st = window._vidStateV130 || {};
        var hud = document.getElementById('v130HudOverlay');
        var ov = window.getVideoRootElV214();
        var isPip = window.isVideoInPipOrMiniModeV210(ov);

        if (st.controlsHideTimer) {
            clearTimeout(st.controlsHideTimer);
            st.controlsHideTimer = null;
        }

        if (!shouldHide && fromTapWake && hud && hud.classList.contains('hud-hidden-v130')) {
            st.hudJustWokeUntil = performance.now() + 380;
        }

        if (shouldHide) {
            lastVideoInteractionTsV210 = -1e9;
            window._lastVideoInteractionTsV214 = -1e9;
            enforceHudVisibilityStateV210(true, isPip);
        } else {
            var now = performance.now();
            lastVideoInteractionTsV210 = now;
            window._lastVideoInteractionTsV214 = now;
            enforceHudVisibilityStateV210(false, isPip);

            var timeoutMs = window.getCustomHudTimeoutMsV210();
            if (timeoutMs < 80000000) {
                st.controlsHideTimer = setTimeout(function() {
                    if (!activeDragMode) {
                        window.setVideoHudHiddenUnifiedV214(true, false);
                    }
                }, timeoutMs);
            }
        }
    };

    // Продлеваем видимость HUD при взаимодействии с кнопками, ползунками и плавающими таблетками
    ;['touchstart', 'touchmove', 'mousedown', 'input'].forEach(function(evName) {
        window.addEventListener(evName, function(e) {
            var ov = window.getVideoRootElV214();
            if (!ov || !ov.classList.contains('active') || !ov.contains(e.target)) return;
            var hud = document.getElementById('v130HudOverlay');
            var isHidden = Boolean(hud && hud.classList.contains('hud-hidden-v130'));
            if (isHidden) return;
            var t = e.target;
            if (t && t.closest && t.closest('.v130-hud-bar, .v130-btn, .v130-center-controls, button, input, #jennyFenceWrapV173, #jennyTunerFloatWrapV208, #jennySplitPillWrapV209, #jenny120PillWrapV209, #jv168SplitLine')) {
                var now = performance.now();
                lastVideoInteractionTsV210 = now;
                window._lastVideoInteractionTsV214 = now;
            }
        }, { capture: true, passive: true });
    });

    function checkAutoHideTickV210() {
        var ov = window.getVideoRootElV214();
        var vEl = document.getElementById('jennyVideoElV130');
        var st = window._vidStateV130;
        if (!ov || !ov.classList.contains('active') || !vEl) {
            hudCurrentlyHiddenV210 = false;
            return;
        }
        var hud = document.getElementById('v130HudOverlay');
        var isPip = window.isVideoInPipOrMiniModeV210(ov);

        // Если экран заблокирован замком или HUD уже скрыт тапом — держим таблетки синхронно скрытыми
        if ((st && st.isLocked) || (hud && hud.classList.contains('hud-hidden-v130'))) {
            enforceHudVisibilityStateV210(true, isPip);
            return;
        }

        if (activeDragMode) {
            var now = performance.now();
            lastVideoInteractionTsV210 = now;
            window._lastVideoInteractionTsV214 = now;
            enforceHudVisibilityStateV210(false, isPip);
            return;
        }

        var fl = window._jennyLabFlagsV208 || {};
        var enabled = isPip ? Boolean(fl.stub2) : Boolean(fl.stub1);
        if (!enabled) {
            enforceHudVisibilityStateV210(false, isPip);
            return;
        }

        var cfg = window._jennyAutoHideSecV209 || { main: 4.0, pip: 2.5 };
        var delaySec = isPip ? (Number(cfg.pip) || 2.5) : (Number(cfg.main) || 4.0);
        var elapsedSec = (performance.now() - lastVideoInteractionTsV210) / 1000.0;

        if (elapsedSec >= delaySec) {
            window.setVideoHudHiddenUnifiedV214(true, false);
        } else {
            enforceHudVisibilityStateV210(false, isPip);
        }
    }

    // 4. СВЕРНУТЫЕ ТАБЛЕТКИ ИНСТРУМЕНТОВ И ЛОГГЕР V210
    window.updateActiveEngineModeV209 = function() {
        var fl = window._jennyLabFlagsV208 || {};
        if (!fl.splitTest) window._jennySplitExpandedV209 = false;
        if (!fl.core120)   window._jenny120ExpandedV209   = false;

        var newMode = 'off';
        if (fl.splitTest && window._jennySplitExpandedV209) newMode = 'split';
        else if (fl.core120 && window._jenny120ExpandedV209) newMode = '120';

        if (window._jv166Metrics) window._jv166Metrics.mode = newMode;
        window._jennyExp120HzEnabledV205 = (newMode !== 'off');

        var glCv = document.getElementById('jv166InterpCanvas');
        if (glCv && newMode === 'off') glCv.style.setProperty('display', 'none', 'important');
        var spLine = document.getElementById('jv168SplitLine');
        if (spLine) {
            if (newMode === 'split') {
                spLine.style.setProperty('display', 'block', 'important');
                if (typeof window.updateSplitLineUI === 'function') window.updateSplitLineUI(spLine);
            } else {
                spLine.style.setProperty('display', 'none', 'important');
            }
        }
        if (typeof window.updateVideoHeaderTelemetryV166 === 'function') window.updateVideoHeaderTelemetryV166();
    };

    window._jennySplitRatioV176 = parseFloat(localStorage.getItem('jenny_split_ratio') || '0.5') || 0.5;
    window._jennySplitSwappedV176 = (localStorage.getItem('jenny_split_swap') === '1');

    var TUNER_SPECS = [
        { key: 'dupThresh',    label: 'Дубль ±Y (0=Выкл)',    min: 0.0, max: 255.0, def: 0.0,   fmt: 0, color: '#ff9100' },
        { key: 'targetFps',    label: 'Целевой FPS (0=Авто)', min: 0.0, max: 180.0, def: 120.0, fmt: 0, color: '#ffea00' },
        { key: 'flowScale',    label: 'Сдвиг (Scale)',        min: 0.0, max: 2.50,  def: 0.85,  fmt: 2, color: '#00ff9d' },
        { key: 'ghostGate',    label: 'Шлейф (Gate)',         min: 0.02, max: 0.45, def: 0.12,  fmt: 2, color: '#ff5252' },
        { key: 'detailGuard',  label: 'Детали (Guard)',       min: 0.0, max: 1.00,  def: 0.45,  fmt: 2, color: '#00e5ff' },
        { key: 'bridgeSpread', label: 'Мост (Bridge)',        min: 0.0, max: 1.00,  def: 0.35,  fmt: 2, color: '#e040fb' },
        { key: 'searchRadius', label: 'Радар (Rad px)',       min: 4.0, max: 48.0,  def: 15.0,  fmt: 1, color: '#ffd740' },
        { key: 'inkGuard',     label: 'Контур (Ink)',         min: 0.0, max: 1.00,  def: 0.50,  fmt: 2, color: '#69f0ae' },
        { key: 'pllSmooth',    label: 'Ритм (PLL)',           min: 0.10, max: 0.95, def: 0.85,  fmt: 2, color: '#40c4ff' }
    ];

    window.updateSplitLineUI = function(lineEl) {
        if (!lineEl) lineEl = document.getElementById('jv168SplitLine');
        if (!lineEl) return;
        var ratio = Math.max(0.05, Math.min(0.95, window._jennySplitRatioV176 || 0.5));
        var sw = !!window._jennySplitSwappedV176;
        lineEl.style.left = (ratio * 100).toFixed(2) + '%';

        var origFps = window.getRealOrigFpsV208 ? window.getRealOrigFpsV208() : 30;
        var m = window._jv166Metrics || {};
        var genFps = m.outputFps || m.screenHz || 120;
        var origTxt = 'ОРИГ ' + origFps + ' FPS';
        var genTxt  = genFps + 'Hz MV';

        var lt = lineEl.querySelector('#jv176LeftTag');
        var rt = lineEl.querySelector('#jv176RightTag');
        if (lt && rt) {
            lt.textContent = sw ? genTxt : origTxt;
            lt.style.color = sw ? '#00ff9d' : '#ffcc00';
            lt.style.borderColor = lt.style.color;
            rt.textContent = sw ? origTxt : genTxt;
            rt.style.color = sw ? '#ffcc00' : '#00ff9d';
            rt.style.borderColor = rt.style.color;
        }
    };

    window.toggleSplitSwapV176 = function(ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        window._jennySplitSwappedV176 = !window._jennySplitSwappedV176;
        try { localStorage.setItem('jenny_split_swap', window._jennySplitSwappedV176 ? '1' : '0'); } catch (e) {}
        window.updateSplitLineUI();
    };

    function upgradeSplitLineV176() {
        var lineEl = document.getElementById('jv168SplitLine');
        if (!lineEl) return;
        var fl = window._jennyLabFlagsV208 || {};
        var isSplit = Boolean(fl.splitTest && window._jennySplitExpandedV209 && window._jv166Metrics && window._jv166Metrics.mode === 'split');
        lineEl.style.setProperty('display', isSplit ? 'block' : 'none', 'important');
        if (lineEl._v210Upgraded) {
            if (isSplit) window.updateSplitLineUI(lineEl);
            return;
        }
        lineEl._v210Upgraded = true;
        lineEl.style.zIndex = '99990';
        lineEl.innerHTML =
            '<div id="jv176SplitHeader" style="position:absolute;top:12px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:4px;background:rgba(0,0,0,0.88);padding:4px 8px;border-radius:6px;border:1px solid #00e5ff;white-space:nowrap;pointer-events:auto;">' +
                '<span id="jv176LeftTag" style="color:#ffcc00;font-family:monospace;font-weight:900;font-size:10px;padding:1px 5px;border-radius:3px;border:1px solid #ffcc00;">ОРИГ 30 FPS</span>' +
                '<span style="color:#00e5ff;font-weight:900;font-size:13px;padding:0 3px;">⇄</span>' +
                '<span id="jv176RightTag" style="color:#00ff9d;font-family:monospace;font-weight:900;font-size:10px;padding:1px 5px;border-radius:3px;border:1px solid #00ff9d;">120Hz MV</span>' +
            '</div>' +
            '<div id="jv176SplitGrip" style="position:absolute;top:64%;left:50%;transform:translate(-50%,-50%);background:rgba(0,18,28,0.92);color:#00e5ff;border:1.5px solid #00e5ff;border-radius:14px;padding:5px 8px;font-size:11px;font-weight:bold;pointer-events:auto;box-shadow:0 0 10px rgba(0,229,255,0.6);">◀┃▶</div>';
        if (isSplit) window.updateSplitLineUI(lineEl);
    }

    var TOTAL_LOG_FRAMES = 360;
    var historyDt = new Float32Array(120);
    var historyAlpha = new Float32Array(120);
    var historyNewFrame = new Uint8Array(120);
    var histIdx = 0;

    var lastTickTime = performance.now();
    var lastCapturedAlpha = 0;
    var uploadedSinceLastDraw = 0;
    var glRendererInfo = "";

    var isLogging = false;
    var logEntries = [];

    var prevTrackDec = -1;
    var prevTrackVTime = -1;
    var lastOrigChangeTs = performance.now();
    var origHoldTicks = 0;
    var lastGeneratorStallTicks = 0;

    function getMediaPassport(vEl, glCtx) {
        if (!vEl) return "Видеоэлемент не найден\n";
        var rawSrc = vEl.currentSrc || vEl.src || "";
        var decPath = rawSrc;
        try { decPath = decodeURIComponent(rawSrc); } catch (e) {}
        var fName = decPath ? decPath.split('/').pop().split('?')[0] : "unknown";
        var totalDec = -1, droppedDec = -1;
        if (typeof vEl.getVideoPlaybackQuality === 'function') {
            var q = vEl.getVideoPlaybackQuality();
            if (q) { totalDec = q.totalVideoFrames; droppedDec = q.droppedVideoFrames; }
        }
        var modeStr = (window._jv166Metrics && window._jv166Metrics.mode) || "off";
        var origFps = window.getRealOrigFpsV208 ? window.getRealOrigFpsV208() : 30;
        var tun = window._jennyTunerV190 || {};
        var effDur = window.getEffectiveVideoDurationV210 ? window.getEffectiveVideoDurationV210(vEl) : vEl.duration;
        return [
            "================ ПАСПОРТ МЕДИАФАЙЛА И ДВИЖКА V210 ================",
            "Файл (Имя)      : " + fName,
            "Разрешение видео: " + (vEl.videoWidth || 0) + "x" + (vEl.videoHeight || 0) + " | Родной FPS: " + origFps + " к/с",
            "Длительность    : " + (Number.isFinite(effDur) && effDur > 0 ? effDur.toFixed(2) + " сек" : "N/A") +
                " | Позиция старта лога: " + (window.getEffectiveVideoCurrentTimeV210 ? window.getEffectiveVideoCurrentTimeV210(vEl) : (vEl.currentTime || 0)).toFixed(3) + " сек",
            "Скорость (Rate) : " + (vEl.playbackRate || 1) + "x | Режим: " + modeStr,
            "Крутилки V210   : Dup±Y=" + Number(tun.dupThresh || 0).toFixed(0) +
                " | TargetFPS=" + Number(tun.targetFps || 120).toFixed(0) +
                " | Scale=" + Number(tun.flowScale || 0).toFixed(2) +
                " | Gate=" + Number(tun.ghostGate || 0).toFixed(2) +
                " | Guard=" + Number(tun.detailGuard || 0).toFixed(2) +
                " | Bridge=" + Number(tun.bridgeSpread || 0).toFixed(2) +
                " | Rad=" + Number(tun.searchRadius || 0).toFixed(1),
            "Декодер (кадры) : всего=" + totalDec + ", пропущено(drop)=" + droppedDec + ", отсечено дублей (B==A)=" + (window._jennySkippedDupsTotal || 0),
            "=================================================================="
        ].join("\n") + "\n";
    }

    function recordComparativeTickV210(glCtx, fromOffMode) {
        var now = performance.now();
        var dt = now - lastTickTime;
        lastTickTime = now;

        var up = fromOffMode ? 0 : uploadedSinceLastDraw;
        if (!fromOffMode) uploadedSinceLastDraw = 0;

        var vEl = document.getElementById('jennyVideoElV130') || document.querySelector('video');
        var dec = (window._jv207Diag && window._jv207Diag.engineDecCount > 0 && !fromOffMode)
            ? window._jv207Diag.engineDecCount
            : -1;
        if (dec < 0 && vEl && typeof vEl.getVideoPlaybackQuality === 'function') {
            var q = vEl.getVideoPlaybackQuality();
            if (q) dec = q.totalVideoFrames;
        }
        var vTime = vEl ? window.getEffectiveVideoCurrentTimeV210(vEl) : 0;
        var spd = (vEl && vEl.playbackRate > 0.01) ? vEl.playbackRate : 1.0;

        var origChanged = false;
        if (dec >= 0 && prevTrackDec >= 0) {
            if (dec < prevTrackDec || (dec - prevTrackDec) > 300) {
                prevTrackDec = dec;
                prevTrackVTime = vTime;
                lastOrigChangeTs = now;
                origHoldTicks = 1;
            } else if (dec > prevTrackDec) {
                origChanged = true;
            }
        } else if (Math.abs(vTime - prevTrackVTime) > 0.002) {
            origChanged = true;
        }
        if (prevTrackDec < 0 && dec >= 0) {
            prevTrackDec = dec;
            prevTrackVTime = vTime;
            lastOrigChangeTs = now;
        }

        var origSpanMs = now - lastOrigChangeTs;
        if (origChanged) {
            prevTrackDec = dec;
            prevTrackVTime = vTime;
            lastOrigChangeTs = now;
            origHoldTicks = 1;
        } else {
            origHoldTicks++;
        }

        var diag = window._jv207Diag || { step: 1, totalSteps: 4, alpha: lastCapturedAlpha, expectedSpanMs: 33.33 };
        var curAlpha = fromOffMode ? 0.0 : lastCapturedAlpha;

        historyDt[histIdx] = dt;
        historyAlpha[histIdx] = curAlpha;
        historyNewFrame[histIdx] = origChanged ? 1 : up;
        histIdx = (histIdx + 1) % 120;

        if (!isLogging) return;

        var totSteps = diag.totalSteps || 4;
        var stepNum = diag.step || Math.max(1, Math.round(curAlpha * totSteps));
        var expMs = diag.expectedSpanMs || (33.33 / spd);

        if (up) lastGeneratorStallTicks = 0;
        else if (curAlpha >= 0.995) lastGeneratorStallTicks++;
        else lastGeneratorStallTicks = 0;

        var modeNow = (window._jv166Metrics && window._jv166Metrics.mode) || 'off';
        var origCol = origChanged
            ? ("dec:" + String(dec).padEnd(6, ' ') + " НОВЫЙ(" + origSpanMs.toFixed(1).padStart(5, ' ') + "ms)")
            : ("dec:" + String(dec).padEnd(6, ' ') + " ждёт " + origSpanMs.toFixed(1).padStart(5, ' ') + "ms #" + String(origHoldTicks).padEnd(2, ' '));
        var genCol = (modeNow === 'off' || fromOffMode)
            ? "OFF (дефолтный плеер)"
            : ((up ? "tex:1" : (origChanged ? "tex:DUP" : "tex:0")).padEnd(7, ' ') + " | " + String(stepNum).padStart(2, '0') + "/" + String(totSteps).padStart(2, '0') + " | a:" + curAlpha.toFixed(3));
        var verdict = (origChanged && up) ? "📸 НОВЫЙ КАДР (ОРИГ -> ГЕН синхронно)" : ((curAlpha >= 0.995 && lastGeneratorStallTicks >= 2) ? "⚠️ Ожидание кадра декодера" : "🟢 ГЕН плавно двигает");

        logEntries.push({
            idx: logEntries.length + 1,
            dt: dt,
            vTime: vTime,
            origChanged: origChanged,
            origSpanMs: origSpanMs,
            texUp: up,
            stalled: (lastGeneratorStallTicks >= 2) ? 1 : 0,
            origCol: origCol,
            genCol: genCol,
            verdict: verdict
        });

        var btn = document.getElementById('jennyLog120Btn');
        if (btn && (logEntries.length % 120 === 1)) {
            btn.textContent = '⏳ ' + (Math.floor(logEntries.length / 120) + 1) + '/3...';
        }

        if (logEntries.length >= TOTAL_LOG_FRAMES) {
            isLogging = false;
            var lines = logEntries.map(function(e) {
                return String(e.idx).padStart(3, ' ') + " | " + e.dt.toFixed(2).padStart(6, ' ') + "ms | " + e.vTime.toFixed(4) + "s | " + e.origCol + " | " + e.genCol + " | " + e.verdict;
            });
            var out = "=== JENNY V210 СРАВНИТЕЛЬНЫЙ ЛОГ (360 ТИКОВ) ===\n" + getMediaPassport(vEl, glCtx) + lines.join("\n");
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(out).catch(function(){});
            window._lastJenny120Log = out;
            if (typeof window.showToast === 'function') window.showToast('✅ Лог V210 скопирован!');
            if (btn) btn.textContent = '📋 360 ОК';
        }
    }

    function attachProbe(Proto) {
        if (!Proto || Proto._v210Probe) return;
        Proto._v210Probe = true;
        var origLoc = Proto.getUniformLocation;
        Proto.getUniformLocation = function(p, n) {
            var l = origLoc.call(this, p, n);
            if (l) l._uName = n;
            return l;
        };
        var origU1f = Proto.uniform1f;
        Proto.uniform1f = function(l, v) {
            if (l && l._uName === 'u_alpha') lastCapturedAlpha = v;
            return origU1f.call(this, l, v);
        };
        var origTex = Proto.texImage2D;
        Proto.texImage2D = function() {
            var a = arguments[arguments.length - 1];
            if (a && a.tagName === 'VIDEO') uploadedSinceLastDraw = 1;
            return origTex.apply(this, arguments);
        };
        var origDraw = Proto.drawArrays;
        Proto.drawArrays = function(m, f, c) {
            if (window._jennyExp120HzEnabledV205 || (window._jennyLabFlagsV208 && window._jennyLabFlagsV208.logDots)) {
                recordComparativeTickV210(this, false);
            }
            return origDraw.call(this, m, f, c);
        };
    }
    if (typeof WebGL2RenderingContext !== 'undefined') attachProbe(WebGL2RenderingContext.prototype);
    if (typeof WebGLRenderingContext !== 'undefined') attachProbe(WebGLRenderingContext.prototype);

    function syncTunerSlidersDOM() {
        var tun = window._jennyTunerV190;
        if (!tun) return;
        for (var i = 0; i < TUNER_SPECS.length; i++) {
            var sp = TUNER_SPECS[i];
            var val = Number(tun[sp.key]);
            if (isNaN(val)) val = sp.def;
            var pct = Math.max(0, Math.min(100, ((val - sp.min) / (sp.max - sp.min)) * 100));
            var fillEl = document.getElementById('jt190Fill_' + sp.key);
            var valEl = document.getElementById('jt190Val_' + sp.key);
            if (fillEl) fillEl.style.width = pct.toFixed(1) + '%';
            if (valEl) valEl.textContent = val.toFixed(sp.fmt);
        }
    }

    function ensureLogDotsWidget(stage) {
        var fl = window._jennyLabFlagsV208 || {};
        var oldW = document.getElementById('jennyFenceWrapV173');
        if (!fl.logDots) { if (oldW) oldW.remove(); return; }
        if (oldW && oldW._isV210LogPill) return;
        if (oldW) oldW.remove();

        var sx = parseFloat(localStorage.getItem('jenny_diag_x') || '10');
        var sy = parseFloat(localStorage.getItem('jenny_diag_y') || '52');
        var wrap = document.createElement('div');
        wrap.id = 'jennyFenceWrapV173';
        wrap._isV210LogPill = true;
        wrap.style.cssText = 'position:absolute;top:' + sy + 'px;left:' + sx + 'px;z-index:99998;display:flex;flex-direction:column;align-items:stretch;gap:3px;background:rgba(4,10,16,0.92);border:1px solid #00e5ff;border-radius:14px;padding:3px 7px;pointer-events:auto;touch-action:none;user-select:none;box-shadow:0 4px 12px rgba(0,0,0,0.75);box-sizing:border-box;width:' + (isLogCollapsed ? 'auto' : '214px') + ';';

        var cv = document.createElement('canvas');
        cv.id = 'jennyFenceCanvasV173';
        cv.width = 200; cv.height = 28;
        cv.style.cssText = 'width:200px;height:28px;display:' + (isLogCollapsed ? 'none' : 'block') + ';border-bottom:1px solid rgba(0,229,255,0.25);padding-bottom:1px;';

        var row2 = document.createElement('div');
        row2.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:5px;';
        row2.innerHTML =
            '<button id="jennyFenceToggleBtn" style="background:#11222b;color:#00e5ff;font-size:10px;font-weight:900;border:1px solid rgba(0,229,255,0.45);border-radius:10px;padding:2px 8px;white-space:nowrap;">' + (isLogCollapsed ? '📊 Лог' : '➖') + '</button>' +
            '<button id="jennyLog120Btn" style="display:' + (isLogCollapsed ? 'none' : 'inline-block') + ';background:#00e5ff;color:#000;font-weight:900;font-size:9.5px;border:none;border-radius:6px;padding:3px 6px;white-space:nowrap;flex:1;">📋 ЛОГ 360</button>' +
            '<span style="color:rgba(0,229,255,0.75);font-size:12px;padding:0 2px;">✥</span>';

        wrap.appendChild(cv);
        wrap.appendChild(row2);
        stage.appendChild(wrap);
    }

    function ensureTunerSlidersWidget(stage) {
        var fl = window._jennyLabFlagsV208 || {};
        var oldT = document.getElementById('jennyTunerFloatWrapV208');
        if (!fl.tunerSliders) { if (oldT) oldT.remove(); return; }
        if (oldT && oldT._isV210TunerPill) { syncTunerSlidersDOM(); return; }
        if (oldT) oldT.remove();

        var tx = parseFloat(localStorage.getItem('jenny_tuner_x') || '102');
        var ty = parseFloat(localStorage.getItem('jenny_tuner_y') || '52');
        var wrap = document.createElement('div');
        wrap.id = 'jennyTunerFloatWrapV208';
        wrap._isV210TunerPill = true;
        wrap.style.cssText = 'position:absolute;top:' + ty + 'px;left:' + tx + 'px;z-index:99999;display:flex;flex-direction:column;align-items:stretch;gap:2px;background:rgba(6,12,20,0.92);border:1px solid #d2a8ff;border-radius:14px;padding:3px 7px;pointer-events:auto;touch-action:none;user-select:none;box-shadow:0 4px 12px rgba(0,0,0,0.8);box-sizing:border-box;width:' + (isTunerCollapsed ? 'auto' : '222px') + ';';

        var hdr = document.createElement('div');
        hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:5px;';
        hdr.innerHTML =
            '<button id="jennyTunerCollapseBtnV208" style="background:#1c162b;color:#d2a8ff;font-size:10px;font-weight:900;border:1px solid rgba(210,168,255,0.45);border-radius:10px;padding:2px 8px;white-space:nowrap;">' + (isTunerCollapsed ? '🎛️ Крутилки' : '➖ Скрыть') + '</button>' +
            '<button id="jt190ResetBtn" style="display:' + (isTunerCollapsed ? 'none' : 'inline-block') + ';background:#21262d;color:#ff7b72;border:1px solid #ff7b72;border-radius:5px;font-size:8.5px;font-weight:bold;padding:2px 6px;">🔄 Сброс</button>' +
            '<span style="color:rgba(210,168,255,0.8);font-size:12px;padding:0 2px;">✥</span>';

        var tBox = document.createElement('div');
        tBox.id = 'jennyTunerBoxV190';
        tBox.style.cssText = 'display:' + (isTunerCollapsed ? 'none' : 'flex') + ';flex-direction:column;gap:1px;padding-top:3px;border-top:1px solid rgba(210,168,255,0.25);margin-top:2px;';
        tBox.innerHTML = TUNER_SPECS.map(function(sp) {
            return '<div class="jt190-slider-row" data-jtkey="' + sp.key + '" style="display:flex;flex-direction:column;gap:1px;padding:1px 0;cursor:pointer;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;font-family:monospace;font-size:9px;line-height:1.0;">' +
                    '<span style="color:#e6edf3;font-weight:bold;">' + sp.label + ' <span style="color:#6e7681;font-size:8px;">[' + sp.min + '..' + sp.max + ']</span></span>' +
                    '<span id="jt190Val_' + sp.key + '" style="color:' + sp.color + ';font-weight:900;font-size:9.5px;">' + sp.def.toFixed(sp.fmt) + '</span>' +
                '</div>' +
                '<div id="jt190Track_' + sp.key + '" style="width:100%;height:5px;background:#111922;border:1px solid rgba(255,255,255,0.18);border-radius:3px;overflow:hidden;position:relative;">' +
                    '<div id="jt190Fill_' + sp.key + '" style="width:50%;height:100%;background:' + sp.color + ';border-radius:3px;pointer-events:none;"></div>' +
                '</div>' +
            '</div>';
        }).join('');

        wrap.appendChild(hdr);
        wrap.appendChild(tBox);
        stage.appendChild(wrap);
        syncTunerSlidersDOM();
    }

    function ensureSplitAnd120Pills(stage) {
        var fl = window._jennyLabFlagsV208 || {};

        var oldSp = document.getElementById('jennySplitPillWrapV209');
        if (!fl.splitTest) { if (oldSp) oldSp.remove(); }
        else {
            if (!oldSp) {
                var spx = parseFloat(localStorage.getItem('jenny_split_pill_x') || '10');
                var spy = parseFloat(localStorage.getItem('jenny_split_pill_y') || '86');
                oldSp = document.createElement('div');
                oldSp.id = 'jennySplitPillWrapV209';
                oldSp.style.cssText = 'position:absolute;top:' + spy + 'px;left:' + spx + 'px;z-index:99997;display:flex;align-items:center;gap:4px;background:rgba(4,12,20,0.92);border:1px solid #00e5ff;border-radius:14px;padding:3px 7px;pointer-events:auto;touch-action:none;user-select:none;box-shadow:0 4px 12px rgba(0,0,0,0.75);';
                oldSp.innerHTML = '<button id="jennySplitPillBtnV209" style="background:#0d212c;color:#00e5ff;font-size:10px;font-weight:900;border:1px solid rgba(0,229,255,0.45);border-radius:10px;padding:2px 8px;white-space:nowrap;">🌓 Сплит</button><span style="color:rgba(0,229,255,0.75);font-size:12px;padding:0 2px;">✥</span>';
                stage.appendChild(oldSp);
            }
            var spBtn = document.getElementById('jennySplitPillBtnV209');
            if (spBtn) {
                var on = Boolean(window._jennySplitExpandedV209);
                spBtn.textContent = on ? '🌓 Сплит: ВКЛ ➖' : '🌓 Сплит';
                spBtn.style.background = on ? '#00e5ff' : '#0d212c';
                spBtn.style.color = on ? '#000' : '#00e5ff';
            }
        }

        var old120 = document.getElementById('jenny120PillWrapV209');
        if (!fl.core120) { if (old120) old120.remove(); }
        else {
            if (!old120) {
                var c120x = parseFloat(localStorage.getItem('jenny_120_pill_x') || '106');
                var c120y = parseFloat(localStorage.getItem('jenny_120_pill_y') || '86');
                old120 = document.createElement('div');
                old120.id = 'jenny120PillWrapV209';
                old120.style.cssText = 'position:absolute;top:' + c120y + 'px;left:' + c120x + 'px;z-index:99997;display:flex;align-items:center;gap:4px;background:rgba(4,16,12,0.92);border:1px solid #00ff9d;border-radius:14px;padding:3px 7px;pointer-events:auto;touch-action:none;user-select:none;box-shadow:0 4px 12px rgba(0,0,0,0.75);';
                old120.innerHTML = '<button id="jenny120PillBtnV209" style="background:#0d281d;color:#00ff9d;font-size:10px;font-weight:900;border:1px solid rgba(0,255,157,0.45);border-radius:10px;padding:2px 8px;white-space:nowrap;">⚡ 120Hz</button><span style="color:rgba(0,255,157,0.75);font-size:12px;padding:0 2px;">✥</span>';
                stage.appendChild(old120);
            }
            var b120 = document.getElementById('jenny120PillBtnV209');
            if (b120) {
                var on120 = Boolean(window._jenny120ExpandedV209);
                b120.textContent = on120 ? '⚡ 120Hz: ВКЛ ➖' : '⚡ 120Hz';
                b120.style.background = on120 ? '#00ff9d' : '#0d281d';
                b120.style.color = on120 ? '#000' : '#00ff9d';
            }
        }
    }

    var activeDragMode = null;
    var activeSliderKey = null;
    var startTouchX = 0, startTouchY = 0;
    var startWidgetLeft = 0, startWidgetTop = 0;
    var maxTouchDelta = 0;
    var touchedElement = null;

    function updateSliderFromTouch(key, tx, ty) {
        var sp = null;
        for (var i = 0; i < TUNER_SPECS.length; i++) {
            if (TUNER_SPECS[i].key === key) { sp = TUNER_SPECS[i]; break; }
        }
        if (!sp) return;
        var trackEl = document.getElementById('jt190Track_' + key);
        if (!trackEl) return;
        var r = trackEl.getBoundingClientRect();
        var wrap = document.getElementById('jennyTunerFloatWrapV208');
        var rot90 = isStageRot90(wrap ? wrap.parentElement : null);

        var ratio = (!rot90 && r.width > 10) ? ((tx - r.left) / r.width) : ((rot90 && r.height > 10) ? ((ty - r.top) / r.height) : 0.5);
        ratio = Math.max(0.0, Math.min(1.0, ratio));
        var newVal = sp.min + ratio * (sp.max - sp.min);
        var factor = Math.pow(10, sp.fmt);
        newVal = Math.round(newVal * factor) / factor;

        if (!window._jennyTunerV190) window._jennyTunerV190 = {};
        window._jennyTunerV190[key] = newVal;
        try { localStorage.setItem('jt190_' + key, String(newVal)); } catch (e) {}
        syncTunerSlidersDOM();
    }

    window.addEventListener('touchstart', function(e) {
        if (!e.touches || !e.touches.length) return;
        var tx = e.touches[0].clientX;
        var ty = e.touches[0].clientY;

        var pillTargets = [
            { id: 'jennyTunerFloatWrapV208', mode: 'tuner_widget' },
            { id: 'jennyFenceWrapV173',      mode: 'log_widget' },
            { id: 'jennySplitPillWrapV209',  mode: 'split_pill' },
            { id: 'jenny120PillWrapV209',    mode: 'c120_pill' }
        ];

        for (var p = 0; p < pillTargets.length; p++) {
            var pt = pillTargets[p];
            var wEl = document.getElementById(pt.id);
            if (wEl && wEl.style.display !== 'none' && wEl.offsetParent !== null && !wEl.classList.contains('jv210-hidden-node')) {
                var rect = wEl.getBoundingClientRect();
                if (tx >= rect.left - 4 && tx <= rect.right + 4 && ty >= rect.top - 4 && ty <= rect.bottom + 4) {
                    var el = document.elementFromPoint(tx, ty) || e.target;
                    touchedElement = el;
                    startTouchX = tx; startTouchY = ty; maxTouchDelta = 0;

                    if (pt.mode === 'tuner_widget') {
                        var sRow = el && el.closest ? el.closest('.jt190-slider-row') : null;
                        if (sRow) {
                            activeDragMode = 'slider';
                            activeSliderKey = sRow.getAttribute('data-jtkey');
                            updateSliderFromTouch(activeSliderKey, tx, ty);
                            e.stopImmediatePropagation();
                            if (e.cancelable) e.preventDefault();
                            return;
                        }
                    }

                    activeDragMode = pt.mode;
                    startWidgetLeft = parseFloat(wEl.style.left) || 10;
                    startWidgetTop = parseFloat(wEl.style.top) || 52;
                    e.stopImmediatePropagation();
                    return;
                }
            }
        }

        var lineEl = document.getElementById('jv168SplitLine');
        if (lineEl && lineEl.style.display !== 'none' && lineEl.offsetParent !== null) {
            var hdr = document.getElementById('jv176SplitHeader');
            var grip = document.getElementById('jv176SplitGrip');
            var sRect = lineEl.getBoundingClientRect();
            var stageEl = lineEl.parentElement;
            var stageRect = stageEl ? stageEl.getBoundingClientRect() : sRect;
            var rot90 = isStageRot90(stageEl);

            var onHdr = false, onGrip = false;
            if (hdr) { var hr = hdr.getBoundingClientRect(); onHdr = (tx >= hr.left - 8 && tx <= hr.right + 8 && ty >= hr.top - 8 && ty <= hr.bottom + 8); }
            if (grip) { var gr = grip.getBoundingClientRect(); onGrip = (tx >= gr.left - 16 && tx <= gr.right + 16 && ty >= gr.top - 16 && ty <= gr.bottom + 16); }
            var nearLine = (!rot90) ? (Math.abs(tx - (sRect.left + sRect.width * 0.5)) <= 26 && ty >= stageRect.top && ty <= (stageRect.bottom - 95))
                                    : (Math.abs(ty - (sRect.top + sRect.height * 0.5)) <= 26 && tx >= (stageRect.left + 95) && tx <= stageRect.right);

            if (onHdr || onGrip || nearLine) {
                activeDragMode = 'split';
                startTouchX = tx; startTouchY = ty; maxTouchDelta = 0;
                touchedElement = onHdr ? hdr : (onGrip ? grip : lineEl);
                e.stopImmediatePropagation();
                if (e.cancelable) e.preventDefault();
                return;
            }
        }
        activeDragMode = null;
    }, { capture: true, passive: false });

    window.addEventListener('touchmove', function(e) {
        if (!activeDragMode || !e.touches || !e.touches.length) return;
        var tx = e.touches[0].clientX;
        var ty = e.touches[0].clientY;
        var dx = tx - startTouchX;
        var dy = ty - startTouchY;
        maxTouchDelta = Math.max(maxTouchDelta, Math.hypot(dx, dy));

        e.stopImmediatePropagation();
        if (e.cancelable) e.preventDefault();

        if (activeDragMode === 'slider' && activeSliderKey) {
            updateSliderFromTouch(activeSliderKey, tx, ty);
            return;
        }

        var mapId = {
            log_widget:   'jennyFenceWrapV173',
            tuner_widget: 'jennyTunerFloatWrapV208',
            split_pill:   'jennySplitPillWrapV209',
            c120_pill:    'jenny120PillWrapV209'
        };
        if (mapId[activeDragMode] && maxTouchDelta > 5) {
            var wrap = document.getElementById(mapId[activeDragMode]);
            if (wrap && wrap.parentElement) {
                var stageEl = wrap.parentElement;
                var rot90 = isStageRot90(stageEl);
                var localDx = rot90 ? dy : dx;
                var localDy = rot90 ? (-dx) : dy;
                var maxL = Math.max(4, stageEl.clientWidth - wrap.offsetWidth - 4);
                var maxT = Math.max(4, stageEl.clientHeight - wrap.offsetHeight - 4);
                wrap.style.left = Math.round(Math.max(4, Math.min(maxL, startWidgetLeft + localDx))) + 'px';
                wrap.style.top = Math.round(Math.max(4, Math.min(maxT, startWidgetTop + localDy))) + 'px';
                wrap.style.bottom = 'auto';
            }
        } else if (activeDragMode === 'split' && maxTouchDelta > 4) {
            var lineEl = document.getElementById('jv168SplitLine');
            if (lineEl && lineEl.parentElement) {
                var stageEl = lineEl.parentElement;
                var sr = stageEl.getBoundingClientRect();
                var rot90 = isStageRot90(stageEl);
                if (!rot90 && sr.width > 20) window._jennySplitRatioV176 = Math.max(0.05, Math.min(0.95, (tx - sr.left) / sr.width));
                else if (rot90 && sr.height > 20) window._jennySplitRatioV176 = Math.max(0.05, Math.min(0.95, (ty - sr.top) / sr.height));
                window.updateSplitLineUI(lineEl);
            }
        }
    }, { capture: true, passive: false });

    window.addEventListener('touchend', function(e) {
        if (!activeDragMode) return;
        var mode = activeDragMode;
        activeDragMode = null;
        activeSliderKey = null;
        e.stopImmediatePropagation();

        if (mode === 'slider') return;

        if (mode === 'log_widget') {
            var lWrap = document.getElementById('jennyFenceWrapV173');
            if (maxTouchDelta > 6) {
                if (lWrap) {
                    try {
                        localStorage.setItem('jenny_diag_x', String(parseFloat(lWrap.style.left) || 10));
                        localStorage.setItem('jenny_diag_y', String(parseFloat(lWrap.style.top) || 52));
                    } catch (err) {}
                }
                return;
            }
            var lBtn = document.getElementById('jennyLog120Btn');
            var tBtn = document.getElementById('jennyFenceToggleBtn');
            var cv = document.getElementById('jennyFenceCanvasV173');
            var tg = touchedElement;
            if (lBtn && !isLogCollapsed && (tg === lBtn || lBtn.contains(tg))) {
                logEntries = []; prevTrackDec = -1; lastOrigChangeTs = performance.now(); origHoldTicks = 0; isLogging = true;
                lBtn.textContent = '⏳ 1/3...';
            } else if (tBtn && (tg === tBtn || tBtn.contains(tg) || isLogCollapsed)) {
                isLogCollapsed = !isLogCollapsed;
                if (cv) cv.style.display = isLogCollapsed ? 'none' : 'block';
                if (lBtn) lBtn.style.display = isLogCollapsed ? 'none' : 'inline-block';
                if (lWrap) lWrap.style.width = isLogCollapsed ? 'auto' : '214px';
                tBtn.textContent = isLogCollapsed ? '📊 Лог' : '➖';
            }
        } else if (mode === 'tuner_widget') {
            var tWrap = document.getElementById('jennyTunerFloatWrapV208');
            if (maxTouchDelta > 6) {
                if (tWrap) {
                    try {
                        localStorage.setItem('jenny_tuner_x', String(parseFloat(tWrap.style.left) || 102));
                        localStorage.setItem('jenny_tuner_y', String(parseFloat(tWrap.style.top) || 52));
                    } catch (err) {}
                }
                return;
            }
            var rBtn = document.getElementById('jt190ResetBtn');
            var cBtn = document.getElementById('jennyTunerCollapseBtnV208');
            var tBox = document.getElementById('jennyTunerBoxV190');
            var tg = touchedElement;
            if (rBtn && !isTunerCollapsed && (tg === rBtn || rBtn.contains(tg))) {
                if (!window._jennyTunerV190) window._jennyTunerV190 = {};
                for (var i = 0; i < TUNER_SPECS.length; i++) {
                    var sp = TUNER_SPECS[i];
                    window._jennyTunerV190[sp.key] = sp.def;
                    try { localStorage.setItem('jt190_' + sp.key, String(sp.def)); } catch (err) {}
                }
                syncTunerSlidersDOM();
                if (typeof window.showToast === 'function') window.showToast('🔄 Крутилки сброшены!');
            } else if (cBtn && (tg === cBtn || cBtn.contains(tg) || isTunerCollapsed)) {
                isTunerCollapsed = !isTunerCollapsed;
                if (tBox) tBox.style.display = isTunerCollapsed ? 'none' : 'flex';
                if (rBtn) rBtn.style.display = isTunerCollapsed ? 'none' : 'inline-block';
                if (tWrap) tWrap.style.width = isTunerCollapsed ? 'auto' : '222px';
                cBtn.textContent = isTunerCollapsed ? '🎛️ Крутилки' : '➖ Скрыть';
            }
        } else if (mode === 'split_pill') {
            var spWrap = document.getElementById('jennySplitPillWrapV209');
            if (maxTouchDelta > 6) {
                if (spWrap) {
                    try {
                        localStorage.setItem('jenny_split_pill_x', String(parseFloat(spWrap.style.left) || 10));
                        localStorage.setItem('jenny_split_pill_y', String(parseFloat(spWrap.style.top) || 86));
                    } catch (err) {}
                }
                return;
            }
            window._jennySplitExpandedV209 = !window._jennySplitExpandedV209;
            window.updateActiveEngineModeV209();
        } else if (mode === 'c120_pill') {
            var cWrap = document.getElementById('jenny120PillWrapV209');
            if (maxTouchDelta > 6) {
                if (cWrap) {
                    try {
                        localStorage.setItem('jenny_120_pill_x', String(parseFloat(cWrap.style.left) || 106));
                        localStorage.setItem('jenny_120_pill_y', String(parseFloat(cWrap.style.top) || 86));
                    } catch (err) {}
                }
                return;
            }
            window._jenny120ExpandedV209 = !window._jenny120ExpandedV209;
            window.updateActiveEngineModeV209();
        } else if (mode === 'split') {
            try { localStorage.setItem('jenny_split_ratio', String(window._jennySplitRatioV176)); } catch (err) {}
            var hdr = document.getElementById('jv176SplitHeader');
            if (maxTouchDelta < 8 && hdr && (touchedElement === hdr || hdr.contains(touchedElement))) {
                window.toggleSplitSwapV176(e);
            }
        }
    }, { capture: true, passive: false });

    function loopFence() {
        var stVidNow = window._vidStateV130;
        var isBg = (typeof window.isJennyAppBackgroundedV264 === 'function') ? window.isJennyAppBackgroundedV264() : document.hidden;
        if (isBg || !stVidNow || !stVidNow.active) {
            setTimeout(loopFence, 450);
            return;
        }
        var fl = window._jennyLabFlagsV208 || {};
        var vEl = document.getElementById('jennyVideoElV130') || document.querySelector('video');
        if (vEl && vEl.parentElement) {
            var stage = vEl.parentElement;
            upgradeSplitLineV176();
            ensureLogDotsWidget(stage);
            ensureTunerSlidersWidget(stage);
            ensureSplitAnd120Pills(stage);

            if (fl.logDots && window._jv166Metrics && window._jv166Metrics.mode === 'off' && !vEl.paused) {
                recordComparativeTickV210(null, true);
            }
        }

        syncDeckBWithVideoLifecycleV210();
        checkAutoHideTickV210();

        if (fl.logDots && !isLogCollapsed) {
            var cv = document.getElementById('jennyFenceCanvasV173');
            if (cv && cv.offsetParent !== null) {
                var ctx = cv.getContext('2d');
                ctx.clearRect(0, 0, cv.width, cv.height);
                var y8 = cv.height - Math.round(8.33 * 1.1);
                ctx.fillStyle = 'rgba(255,255,255,0.25)';
                ctx.fillRect(0, y8, cv.width, 1);
                for (var i = 0; i < 120; i++) {
                    var idx = (histIdx + i) % 120;
                    var dt = historyDt[idx], al = historyAlpha[idx], up = historyNewFrame[idx];
                    var h = Math.min(cv.height - 2, Math.max(2, Math.round(dt * 1.1)));
                    ctx.fillStyle = (dt > 20) ? '#ff1744' : (dt > 13 ? '#ffea00' : '#00e676');
                    ctx.fillRect(Math.round(i * 1.65), cv.height - h, 1, h);
                    ctx.fillStyle = up ? '#ffffff' : '#00e5ff';
                    var yA = Math.round((1 - Math.max(0, Math.min(1, al))) * (cv.height - 5)) + 2;
                    ctx.fillRect(Math.round(i * 1.65), yA, 2, 2);
                }
            }
        }
        requestAnimationFrame(loopFence);
    }
    requestAnimationFrame(loopFence);

    window.toggleLabModuleFlagV208 = function(flagKey, checked, showMsg) {
        var fl = window._jennyLabFlagsV208;
        fl[flagKey] = Boolean(checked);

        if (flagKey === 'splitTest') window._jennySplitExpandedV209 = false;
        if (flagKey === 'core120')   window._jenny120ExpandedV209   = false;
        if (flagKey === 'logDots')      { isLogCollapsed = true;   var lw = document.getElementById('jennyFenceWrapV173');      if (lw) lw.remove(); }
        if (flagKey === 'tunerSliders') { isTunerCollapsed = true; var tw = document.getElementById('jennyTunerFloatWrapV208'); if (tw) tw.remove(); }

        window.saveJennyLabFlagsV208();
        window.updateActiveEngineModeV209();
        window.syncModularLabDOMV208();
        window.wakeVideoHudControlsV209();
    };

    window.syncModularLabDOMV208 = function() {
        var fl = window._jennyLabFlagsV208 || {};
        window.updateActiveEngineModeV209();

        var btn120 = document.getElementById('v166Btn120Mode');
        if (btn120) btn120.remove();

        var vcorePanel = document.getElementById('jv166VCoreDeckPanel');
        if (vcorePanel) {
            var showPanel = Boolean(fl.core120 && window._jennyDualDeckV211 && window._jennyDualDeckV211.deckB);
            vcorePanel.style.setProperty('display', showPanel ? 'block' : 'none', 'important');
        }

        if (!fl.logDots)      { var lw = document.getElementById('jennyFenceWrapV173');      if (lw) lw.remove(); }
        if (!fl.tunerSliders) { var tw = document.getElementById('jennyTunerFloatWrapV208'); if (tw) tw.remove(); }
        if (!fl.splitTest)    { var sw = document.getElementById('jennySplitPillWrapV209');  if (sw) sw.remove(); }
        if (!fl.core120)      { var cw = document.getElementById('jenny120PillWrapV209');    if (cw) cw.remove(); }

        Object.keys(fl).forEach(function(k) {
            var chk = document.getElementById('chkLabV208_' + k);
            if (chk) chk.checked = Boolean(fl[k]);
        });
    };

    window.mountModularLabSettingsV208 = function() {
        var sm = document.getElementById('settingsModal');
        if (!sm) return;
        var oldBox205 = document.getElementById('jennyExp120HzMasterBoxV205');
        if (oldBox205) oldBox205.remove();

        var deckBar = document.getElementById('deckSwitchBarSettingsV131');
        var container = sm.querySelector('.container') || sm;
        var box = document.getElementById('jennyModularLabBoxV208');
        if (!box) {
            box = document.createElement('details');
            box.id = 'jennyModularLabBoxV208';
            box.className = 'setting-group';
            box.style.cssText = 'margin-bottom:10px;border:1.5px solid #30363d;border-radius:10px;background:#090d14;padding:6px 10px;';
            if (deckBar && deckBar.parentNode) deckBar.insertAdjacentElement('afterend', box);
            else container.insertBefore(box, container.firstChild);
        }

        if (box._v210Rendered) {
            window.syncModularLabDOMV208();
            return;
        }
        box._v210Rendered = true;

        var items = [
            { key: 'core120',      icon: '⚡', title: 'Генератор кадров 120Hz & Матрица .SO ядер', desc: 'Свёрнутая кнопка ⚡ 120Hz в плеере и матрица .SO в Деке Б', color: '#00ff9d' },
            { key: 'splitTest',    icon: '🌓', title: 'Режим сравнения (Кнопка Сплит в плеере)', desc: 'Свёрнутая кнопка 🌓 Сплит (по умолчанию играет дефолт)', color: '#00e5ff' },
            { key: 'logDots',      icon: '📊', title: 'Лог с точками (Свёрнутая кнопка 📊 Лог)', desc: 'Свёрнутая кнопка осциллографа VSync и Лога 360', color: '#58a6ff' },
            { key: 'tunerSliders', icon: '🎛️', title: 'Настройки декодера (Свёрнутая кнопка 🎛️ Крутилки)', desc: 'Свёрнутая кнопка 9 ползунков шейдера в плеере', color: '#d2a8ff' },
            { key: 'avSyncRadar',  icon: '⏱️', title: 'Синхро-Радар А/В (Свёрнутая кнопка ⏱️ А/В в плеере)', desc: 'Свёрнутая кнопка диагностики и калибровки звука ⏱️ А/В в плеере', color: '#60a5fa' },
            { key: 'stub1',        icon: '⏱️', title: 'Скрывать управление (Основной плеер)', desc: 'Через сколько секунд без касания прятать кнопки плеера', color: '#ffea00', secKey: 'main' },
            { key: 'stub2',        icon: '❐',  title: 'Скрывать управление (Режим PiP / Мини)', desc: 'Через сколько секунд без касания прятать кнопки в мини-плеере', color: '#ff9100', secKey: 'pip' },
            { key: 'stub3',        icon: '🧩', title: 'Заглушка 3 (Свободный слот модуля)', desc: 'Резервный слот под будущую функцию #3', color: '#8b949e' },
            { key: 'stub4',        icon: '🧩', title: 'Заглушка 4 (Свободный слот модуля)', desc: 'Резервный слот под будущую функцию #4', color: '#8b949e' },
            { key: 'stub5',        icon: '🧩', title: 'Заглушка 5 (Свободный слот модуля)', desc: 'Резервный слот под будущую функцию #5', color: '#8b949e' }
        ];

        var fl = window._jennyLabFlagsV208 || {};
        var rowsHtml = items.map(function(it) {
            var isChk = fl[it.key] ? 'checked' : '';
            var secInputHtml = '';
            if (it.secKey) {
                var secVal = (it.secKey === 'pip') ? window._jennyAutoHideSecV209.pip : window._jennyAutoHideSecV209.main;
                secInputHtml =
                    '<div style="display:flex;align-items:center;gap:4px;margin-right:4px;" onclick="event.stopPropagation();">' +
                        '<input type="number" step="0.1" min="0.5" max="120.0" id="inpAutoHideSecV209_' + it.secKey + '" value="' + Number(secVal).toFixed(1) + '" ' +
                        'onchange="window.updateAutoHideSecV209(\'' + it.secKey + '\', this.value, true); this.value = Number(window._jennyAutoHideSecV209[\'' + it.secKey + '\']).toFixed(1);" ' +
                        'oninput="window.updateAutoHideSecV209(\'' + it.secKey + '\', this.value, false);" ' +
                        'style="width:56px;padding:3px 5px;background:#161b22;color:' + it.color + ';border:1px solid ' + it.color + ';border-radius:6px;font-family:monospace;font-size:11px;font-weight:900;text-align:center;">' +
                        '<span style="font-size:10px;color:#8b949e;font-family:monospace;">с</span>' +
                    '</div>';
            }
            return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 4px;border-bottom:1px solid #161b22;user-select:none;">' +
                '<label style="display:flex;flex-direction:column;gap:1px;flex:1;cursor:pointer;">' +
                    '<span style="font-size:11.5px;font-weight:800;color:' + it.color + ';">' + it.icon + ' ' + it.title + '</span>' +
                    '<span style="font-size:9.5px;color:#8b949e;">' + it.desc + '</span>' +
                '</label>' +
                secInputHtml +
                '<input type="checkbox" id="chkLabV208_' + it.key + '" ' + isChk + ' onchange="window.toggleLabModuleFlagV208(\'' + it.key + '\', this.checked, true)" style="width:17px;height:17px;accent-color:' + it.color + ';cursor:pointer;flex-shrink:0;">' +
            '</div>';
        }).join('');

        box.innerHTML =
            '<summary style="font-size:12px;font-weight:900;color:#00e5ff;cursor:pointer;padding:4px 2px;outline:none;">🧪 Модули плеера: 120Hz, Сплит, Лог и Автоскрытие UI</summary>' +
            '<div style="display:flex;flex-direction:column;gap:2px;margin-top:6px;">' + rowsHtml + '</div>';

        window.syncModularLabDOMV208();
    };

    setInterval(function() {
        window.mountModularLabSettingsV208();
        window.syncModularLabDOMV208();
    }, 600);

    setTimeout(function() {
        window.mountModularLabSettingsV208();
        window.syncModularLabDOMV208();
    }, 150);
})();

/* [split] V217: кусок исходного IIFE (ui_v71.js, строки 21243–22584) → ui_framegen.js */
;(function() {
    if (window._jennyV217Installed__framegen) return;
    window._jennyV217Installed__framegen = true;
    window._jennyV217Installed = true;

    // Переопределяем окно "🎬 Настройки видео" (вместо "🧪 Модули плеера...")
    window.mountModularLabSettingsV208 = function() {
        var sm = document.getElementById('settingsModal');
        if (!sm) return;
        var oldBox205 = document.getElementById('jennyExp120HzMasterBoxV205');
        if (oldBox205) oldBox205.remove();

        var deckBar = document.getElementById('deckSwitchBarSettingsV131');
        var container = sm.querySelector('.container') || sm;
        var box = document.getElementById('jennyModularLabBoxV208');
        if (!box) {
            box = document.createElement('details');
            box.id = 'jennyModularLabBoxV208';
            box.className = 'setting-group';
            box.style.cssText = 'margin-bottom:10px;border:1.5px solid #30363d;border-left:3px solid #3b82f6;border-radius:10px;background:#090d14;padding:6px 10px;';
            if (deckBar && deckBar.parentNode) deckBar.insertAdjacentElement('afterend', box);
            else container.insertBefore(box, container.firstChild);
        }

        if (box._v217Rendered) {
            window.syncModularLabDOMV208();
            return;
        }
        box._v217Rendered = true;

        var items = [
            { key: 'core120',      icon: '⚡', title: 'Генератор кадров 120Hz & Матрица .SO ядер', desc: 'Свёрнутая кнопка ⚡ 120Hz в плеере и матрица .SO в Деке Б', color: '#00ff9d' },
            { key: 'splitTest',    icon: '🌓', title: 'Режим сравнения (Кнопка Сплит в плеере)', desc: 'Свёрнутая кнопка 🌓 Сплит (по умолчанию играет дефолт)', color: '#00e5ff' },
            { key: 'logDots',      icon: '📊', title: 'Лог с точками (Свёрнутая кнопка 📊 Лог)', desc: 'Свёрнутая кнопка осциллографа VSync и Лога 360', color: '#58a6ff' },
            { key: 'tunerSliders', icon: '🎛️', title: 'Настройки декодера (Свёрнутая кнопка 🎛️ Крутилки)', desc: 'Свёрнутая кнопка 9 ползунков шейдера в плеере', color: '#d2a8ff' },
            { key: 'avSyncRadar',  icon: '⏱️', title: 'Синхро-Радар А/В (Свёрнутая кнопка ⏱️ А/В в плеере)', desc: 'Свёрнутая кнопка диагностики и калибровки звука ⏱️ А/В в плеере', color: '#60a5fa' },
            { key: 'stub1',        icon: '⏱️', title: 'Скрывать управление (Основной плеер)', desc: 'Через сколько секунд без касания прятать кнопки плеера', color: '#ffea00', secKey: 'main' },
            { key: 'stub2',        icon: '❐',  title: 'Скрывать управление (Режим PiP / Мини)', desc: 'Через сколько секунд без касания прятать кнопки в мини-плеере', color: '#ff9100', secKey: 'pip' }
        ];

        var fl = window._jennyLabFlagsV208 || {};
        var vc = window._jennyVideoUiCfgV217 || {};

        var rowsHtml = items.map(function(it) {
            var isChk = fl[it.key] ? 'checked' : '';
            var secInputHtml = '';
            if (it.secKey) {
                var secVal = (it.secKey === 'pip') ? window._jennyAutoHideSecV209.pip : window._jennyAutoHideSecV209.main;
                secInputHtml =
                    '<div style="display:flex;align-items:center;gap:4px;margin-right:4px;" onclick="event.stopPropagation();">' +
                        '<input type="number" step="0.1" min="0.5" max="120.0" id="inpAutoHideSecV209_' + it.secKey + '" value="' + Number(secVal).toFixed(1) + '" ' +
                        'onchange="window.updateAutoHideSecV209(\'' + it.secKey + '\', this.value, true); this.value = Number(window._jennyAutoHideSecV209[\'' + it.secKey + '\']).toFixed(1);" ' +
                        'oninput="window.updateAutoHideSecV209(\'' + it.secKey + '\', this.value, false);" ' +
                        'style="width:56px;padding:3px 5px;background:#161b22;color:' + it.color + ';border:1px solid ' + it.color + ';border-radius:6px;font-family:monospace;font-size:11px;font-weight:900;text-align:center;">' +
                        '<span style="font-size:10px;color:#8b949e;font-family:monospace;">с</span>' +
                    '</div>';
            }
            return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 4px;border-bottom:1px solid #161b22;user-select:none;">' +
                '<label style="display:flex;flex-direction:column;gap:1px;flex:1;cursor:pointer;">' +
                    '<span style="font-size:11.5px;font-weight:800;color:' + it.color + ';">' + it.icon + ' ' + it.title + '</span>' +
                    '<span style="font-size:9.5px;color:#8b949e;">' + it.desc + '</span>' +
                '</label>' +
                secInputHtml +
                '<input type="checkbox" id="chkLabV208_' + it.key + '" ' + isChk + ' onchange="window.toggleLabModuleFlagV208(\'' + it.key + '\', this.checked, true)" style="width:17px;height:17px;accent-color:' + it.color + ';cursor:pointer;flex-shrink:0;">' +
            '</div>';
        }).join('');

        var extraVideoBtnsHtml =
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 4px;border-bottom:1px solid #161b22;user-select:none;">' +
                '<label style="display:flex;flex-direction:column;gap:1px;flex:1;cursor:pointer;">' +
                    '<span style="font-size:11.5px;font-weight:800;color:#60a5fa;">🔄 Показывать кнопку поворота (90°)</span>' +
                    '<span style="font-size:9.5px;color:#8b949e;">Если выключено — кнопка «Полный» сама разворачивает видео на 90°</span>' +
                '</label>' +
                '<input type="checkbox" id="chkVidUiV217_showRotateBtn" ' + (vc.showRotateBtn ? 'checked' : '') + ' onchange="window.toggleVideoUiOptionV217(\'showRotateBtn\', this.checked)" style="width:17px;height:17px;accent-color:#3b82f6;cursor:pointer;flex-shrink:0;">' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;padding:6px 4px;border-bottom:1px solid #161b22;user-select:none;">' +
                '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
                    '<label style="display:flex;flex-direction:column;gap:1px;flex:1;cursor:pointer;">' +
                        '<span style="font-size:11.5px;font-weight:800;color:#60a5fa;">📐 Показывать масштаб экрана</span>' +
                        '<span style="font-size:9.5px;color:#8b949e;">Кнопка переключения пропорций кадра внутри видеоплеера</span>' +
                    '</label>' +
                    '<input type="checkbox" id="chkVidUiV217_showFitBtn" ' + (vc.showFitBtn ? 'checked' : '') + ' onchange="window.toggleVideoUiOptionV217(\'showFitBtn\', this.checked)" style="width:17px;height:17px;accent-color:#3b82f6;cursor:pointer;flex-shrink:0;">' +
                '</div>' +
                '<details style="margin-top:6px;background:#0d1117;border:1px solid #21262d;border-radius:8px;padding:5px 8px;">' +
                    '<summary style="font-size:11px;font-weight:bold;color:#93c5fd;cursor:pointer;outline:none;">↳ Выбрать доступные режимы масштаба (Вписать / Заполнить / Растянуть)</summary>' +
                    '<div style="display:flex;flex-direction:column;gap:5px;margin-top:6px;padding-top:4px;border-top:1px solid #161b22;">' +
                        '<label style="display:flex;align-items:center;justify-content:space-between;font-size:11.5px;color:#e6edf3;cursor:pointer;">' +
                            '<span>📐 Вписать (По размеру без обрезки)</span>' +
                            '<input type="checkbox" id="chkVidUiV217_fitContain" ' + (vc.fitContain ? 'checked' : '') + ' onchange="window.toggleVideoUiOptionV217(\'fitContain\', this.checked)" style="width:16px;height:16px;accent-color:#3b82f6;">' +
                        '</label>' +
                        '<label style="display:flex;align-items:center;justify-content:space-between;font-size:11.5px;color:#e6edf3;cursor:pointer;">' +
                            '<span>📐 Заполнить (С обрезкой краёв)</span>' +
                            '<input type="checkbox" id="chkVidUiV217_fitCover" ' + (vc.fitCover ? 'checked' : '') + ' onchange="window.toggleVideoUiOptionV217(\'fitCover\', this.checked)" style="width:16px;height:16px;accent-color:#3b82f6;">' +
                        '</label>' +
                        '<label style="display:flex;align-items:center;justify-content:space-between;font-size:11.5px;color:#e6edf3;cursor:pointer;">' +
                            '<span>📐 Растянуть (Во весь экран)</span>' +
                            '<input type="checkbox" id="chkVidUiV217_fitFill" ' + (vc.fitFill ? 'checked' : '') + ' onchange="window.toggleVideoUiOptionV217(\'fitFill\', this.checked)" style="width:16px;height:16px;accent-color:#3b82f6;">' +
                        '</label>' +
                    '</div>' +
                '</details>' +
            '</div>';

        box.innerHTML =
            '<summary style="font-size:12.5px;font-weight:900;color:#60a5fa;cursor:pointer;padding:4px 2px;outline:none;display:flex;align-items:center;justify-content:space-between;">' +
                '<span>🎬 Настройки видео</span>' +
            '</summary>' +
            '<div style="display:flex;flex-direction:column;gap:2px;margin-top:6px;">' +
                extraVideoBtnsHtml +
                rowsHtml +
            '</div>';

        window.syncModularLabDOMV208();
        window.syncVideoPlayerButtonsUIV217();
    };

    // Форсируем перерисовку блока "🎬 Настройки видео", если он уже был создан старым кодом
    var existingLabBox = document.getElementById('jennyModularLabBoxV208');
    if (existingLabBox) {
        existingLabBox._v210Rendered = false;
        existingLabBox._v217Rendered = false;
    }
})();

/* [split] V218: кусок исходного IIFE (ui_v71.js, строки 22588–24059) → ui_framegen.js */
;(function() {
    if (window._jennyV218Installed__framegen) return;
    window._jennyV218Installed__framegen = true;
    window._jennyV218Installed = true;

    // -------------------------------------------------------------------------
    // 2. ДЕФОЛТ "Дубль ΔY (0=Выкл)" = 0 В КРУТИЛКАХ (ВМЕСТО 123 / 10) И ЗАЩИТА КНОПКИ "🔄 СБРОС"
    // -------------------------------------------------------------------------
    window._jennyTunerV190 = window._jennyTunerV190 || {};
    if (!localStorage.getItem('jt218_dup_zero_migrated')) {
        localStorage.setItem('jt218_dup_zero_migrated', '1');
        localStorage.setItem('jt190_dupThresh', '0');
        window._jennyTunerV190.dupThresh = 0;
    } else if (Number(window._jennyTunerV190.dupThresh) === 10 || Number(window._jennyTunerV190.dupThresh) === 123) {
        window._jennyTunerV190.dupThresh = 0;
        localStorage.setItem('jt190_dupThresh', '0');
    }

    window.resetTunerKnobsToZeroV218 = function(ev) {
        if (ev) {
            if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
            if (ev.stopPropagation) ev.stopPropagation();
            if (ev.preventDefault) ev.preventDefault();
        }
        var defs = {
            dupThresh: 0.0,
            targetFps: 120.0,
            flowScale: 0.85,
            ghostGate: 0.12,
            detailGuard: 0.45,
            bridgeSpread: 0.35,
            searchRadius: 15.0,
            inkGuard: 0.50,
            pllSmooth: 0.85
        };
        var mins = { dupThresh: 0, targetFps: 0, flowScale: 0, ghostGate: 0.02, detailGuard: 0, bridgeSpread: 0, searchRadius: 4, inkGuard: 0, pllSmooth: 0.10 };
        var maxs = { dupThresh: 255, targetFps: 180, flowScale: 2.50, ghostGate: 0.45, detailGuard: 1.0, bridgeSpread: 1.0, searchRadius: 48, inkGuard: 1.0, pllSmooth: 0.95 };
        var fmts = { dupThresh: 0, targetFps: 0, flowScale: 2, ghostGate: 2, detailGuard: 2, bridgeSpread: 2, searchRadius: 1, inkGuard: 2, pllSmooth: 2 };

        window._jennyTunerV190 = window._jennyTunerV190 || {};
        Object.keys(defs).forEach(function(k) {
            var v = defs[k];
            window._jennyTunerV190[k] = v;
            try { localStorage.setItem('jt190_' + k, String(v)); } catch (e) {}
            var fillEl = document.getElementById('jt190Fill_' + k);
            var valEl = document.getElementById('jt190Val_' + k);
            var pct = Math.max(0, Math.min(100, ((v - mins[k]) / (maxs[k] - mins[k])) * 100));
            if (fillEl) fillEl.style.width = pct.toFixed(1) + '%';
            if (valEl) valEl.textContent = v.toFixed(fmts[k]);
        });
        if (typeof window.showToast === 'function') {
            window.showToast('🔄 Крутилки сброшены (Дубль ΔY = 0)!');
        }
    };

    // Перехватываем кнопку #jt190ResetBtn в capture-фазе, чтобы палец никогда не задевал ползунок Дубль ΔY под ней!
    window.addEventListener('touchstart', function(e) {
        var rBtn = document.getElementById('jt190ResetBtn');
        if (!rBtn || rBtn.style.display === 'none' || !e.touches || !e.touches[0]) return;
        var rect = rBtn.getBoundingClientRect();
        var tx = e.touches[0].clientX;
        var ty = e.touches[0].clientY;
        if (tx >= rect.left - 8 && tx <= rect.right + 8 && ty >= rect.top - 8 && ty <= rect.bottom + 6) {
            window.resetTunerKnobsToZeroV218(e);
        }
    }, { capture: true, passive: false });

    // -------------------------------------------------------------------------
    // 3. ПЕРСИСТЕНТНОЕ ХРАНИЛИЩЕ ИЗБРАННОГО, ПЛЕЙЛИСТОВ, ТЕГОВ И ЭКВАЛАЙЗЕРОВ НА ДИСКЕ
    //    (Восстанавливает всё после удаления и переустановки APK!)
    // -------------------------------------------------------------------------
    window._syncUserDataTimerV218 = null;
})();
/* ================= END JENNY_V360_WEBAUDIO_CLOCK_AND_MODAL_SYNC ================= */

/* ================= BEGIN JENNY_V369_SIX_FIXES_RAM_TURBO_REVERSE_STALL_HEAL_AND_UNIFIED_TELEMETRY =================
   1) REMOVES ⏩⏪ AFTER RAM ON #nowPlayingDeckB (`RAM 🚀 (5/29): ...` / `RAM 🚀: ...`).
   2) FIXES #speedLockIndicatorDeckB DIRECTION ICON (`🔒 ⏪` IN REVERSE, `🔒 ⏩` IN FORWARD).
   3) TURBO 4-WORKER BATCHED RAM UNPACKING (`decodeVideoToRamV131`) + INSTANT REVERSE (`⏪`) AT ANY POSITION:
      - Eliminates duplicate `decodeVideoToRamV131` restarts on video open and removes the artificial 1100ms delay.
      - Urgent starter piece (45s around current playback position) decodes in ~150ms and immediately publishes
        both Buffer #3 (Forward `vd.studioBuffer`) and Buffer #4 (Reverse `vd.reversedStudioBuffer`).
      - 4 parallel background workers unpack contiguous 180s (4-piece) batches in a single FFmpeg pass, unpacking
        a 21-minute episode into RAM in ~1.5–2.5 seconds.
      - When Reverse (`⏪`) is activated at any timestamp (including after jumping to 12:44), it auto-unpauses,
        triggers an urgent RAM piece fetch for that timestamp if needed, and plays reversed audio from Buffer #4
        while stepping/streaming reversed video frames smoothly without freezing.
   4) FIXES VIDEO FREEZING (`⏳`) AFTER ~1 MINUTE OR AFTER DESKTOP OVERLAY / HOME SCREEN RETURN:
      - Prevents `bindVideoExtPauseV239` from falsely setting `st.userPaused = true` on internal WebView pauses.
      - Universal Stall & Overlay Auto-Heal Watchdog automatically seamless-reconnects `live_remux` at `curSec`
        (holding the video frame on canvas and keeping RAM Buffer #3 playing) whenever `<video>` stalls for >1.3s.
   5) ADDS CHECKBOX "⏱️ Синхро-Радар А/В (Свёрнутая кнопка ⏱️ А/В в плеере)" IN «🎬 Настройки видео».
   6) UNIFIES ALL 3 TELEMETRY DISPLAYS (`#v130VideoSubTelemetry`, `#nowPlayingDeckB`, AND `⏱️ А/В` DRAWER)
      SO THEY SHOW THE EXACT SAME REAL-TIME TRUTH IN CLEAR RUSSIAN.
================= */
/* [split] V369: кусок исходного IIFE (ui_v71.js, строки 36607–37839) → ui_framegen.js */
;(function() {
    if (window._jennyV369Installed__framegen) return;
    window._jennyV369Installed__framegen = true;
    window._jennyV369Installed = true;

    // 1. Default auto-hide controls in main player (`stub1`) to FALSE, and default `avSyncRadar` to TRUE
    try {
        window._jennyLabFlagsV208 = window._jennyLabFlagsV208 || {};
        if (localStorage.getItem('jenny_autohide_default_off_v368') !== '1') {
            localStorage.setItem('jenny_autohide_default_off_v368', '1');
            window._jennyLabFlagsV208.stub1 = false;
        }
        if (window._jennyLabFlagsV208.avSyncRadar === undefined) {
            window._jennyLabFlagsV208.avSyncRadar = true;
        }
        if (typeof window.saveJennyLabFlagsV208 === 'function') {
            window.saveJennyLabFlagsV208();
        }
    } catch (e) {}

    // 3. Move "🎬 Настройки видео" (#jennyModularLabBoxV208) into Deck B (#settingsModalDeckB)
    //    and wire up `avSyncRadar` checkbox visibility in syncModularLabDOMV208!
    var _origSyncModLabDOMV208 = window.syncModularLabDOMV208;
    window.syncModularLabDOMV208 = function() {
        if (typeof _origSyncModLabDOMV208 === 'function') {
            _origSyncModLabDOMV208.apply(this, arguments);
        }
        var fl = window._jennyLabFlagsV208 || {};
        var showAvPill = (fl.avSyncRadar !== false);
        var avPill = document.getElementById('jennyAvSyncEdgePillV368');
        if (avPill) {
            if (showAvPill) {
                avPill.style.removeProperty('display');
            } else {
                avPill.style.setProperty('display', 'none', 'important');
            }
        }
    };

    var _origMountModLabV208 = window.mountModularLabSettingsV208;
    window.mountModularLabSettingsV208 = function() {
        if (window._jennyLabFlagsV208 && window._jennyLabFlagsV208.avSyncRadar === undefined) {
            window._jennyLabFlagsV208.avSyncRadar = true;
        }
        if (typeof _origMountModLabV208 === 'function') {
            _origMountModLabV208.apply(this, arguments);
        }
        var box = document.getElementById('jennyModularLabBoxV208');
        var smBCont = document.getElementById('settingsModalDeckBContainer') || document.getElementById('settingsModalDeckB');
        if (box && smBCont && !smBCont.contains(box)) {
            var anchor = document.getElementById('jennyDeckBSettingsAvRadarCardV367') || document.getElementById('jennyFourBuffersHudBarB');
            if (anchor && anchor.parentNode === smBCont) {
                anchor.insertAdjacentElement('afterend', box);
            } else {
                smBCont.insertBefore(box, smBCont.firstChild);
            }
        }
        window.syncModularLabDOMV208();
    };

    // 7. Load saved user A/V trim (in seconds; positive = advance audio earlier)
    var savedTrim = 0.0;
    try {
        var rawSaved = localStorage.getItem('jenny_video_av_trim_sec_v367');
        if (rawSaved !== null && rawSaved !== '') {
            var parsed = parseFloat(rawSaved);
            if (isFinite(parsed)) savedTrim = Math.max(-2.5, Math.min(2.5, parsed));
        }
    } catch (e) {}
    window._jennyVideoUserAvTrimSecV367 = savedTrim;
    window._jennyAvSyncEdgeExpandedV368 = false;
})();

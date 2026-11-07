#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os, re

BASE_DIR = "/storage/emulated/0/scripts/JennyPlayer"
if not os.path.exists(BASE_DIR):
    BASE_DIR = os.getcwd()

def find_ui_js():
    found = []
    for root, _, files in os.walk(BASE_DIR):
        if "node_modules" in root or ".git" in root:
            continue
        for f in files:
            if f == "ui_v71.js":
                found.append(os.path.join(root, f))
    return found

V171_WEBGL_HOOK = r"""/* ================= JENNY V171: LOW-LEVEL WEBGL INTERCEPTOR & WIDE-RADIUS 120HZ LK ================= */
(function() {
    if (window._jennyV171WebGLHooked) return;
    window._jennyV171WebGLHooked = true;

    window._v171RealFrameDuration = 33.33;
    window._v171LastNewFrameTime = performance.now();
    window._v171LastDecodedCount = -1;
    window._v171LastMediaTime = -1;
    window._v171AllowTexUploadThisTick = true;
    window._v171UploadsInCurrentFrame = 0;

    // 1. Точный детектор реально нового декодированного кадра видео
    function checkVideoFrameChangedV171(vEl) {
        if (!vEl) return false;
        var now = performance.now();
        var decCount = -1;
        if (typeof vEl.getVideoPlaybackQuality === 'function') {
            var q = vEl.getVideoPlaybackQuality();
            if (q && typeof q.totalVideoFrames === 'number') decCount = q.totalVideoFrames;
        } else if (typeof vEl.webkitDecodedFrameCount === 'number') {
            decCount = vEl.webkitDecodedFrameCount;
        }

        var mediaTime = vEl.currentTime || 0;
        var spd = vEl.playbackRate || window._jennyVideoSpeedV170 || 1.0;
        var minMediaStep = 0.024; // ~1 кадр при 30-40fps в медиа-времени

        var isNew = false;
        if (decCount > 0) {
            if (decCount !== window._v171LastDecodedCount && Math.abs(mediaTime - window._v171LastMediaTime) >= 0.012) {
                isNew = true;
            }
        } else {
            if (Math.abs(mediaTime - window._v171LastMediaTime) >= minMediaStep) {
                isNew = true;
            }
        }

        if (isNew) {
            var dt = now - window._v171LastNewFrameTime;
            if (dt >= 10 && dt <= 600) {
                // Сглаживаем реальный интервал между кадрами (на 0.25x будет ~133 мс)
                window._v171RealFrameDuration = window._v171RealFrameDuration * 0.6 + dt * 0.4;
            } else {
                window._v171RealFrameDuration = 33.33 / Math.max(0.1, spd);
            }
            window._v171LastNewFrameTime = now;
            window._v171LastDecodedCount = decCount;
            window._v171LastMediaTime = mediaTime;
            window._v171UploadsInCurrentFrame = 0;
            return true;
        }
        return false;
    }

    // 2. Вычисление честной фазы u_alpha (0.0 .. 1.0), растянутой на все 16 подкадров при 0.25x
    window.computeTrueAlphaV171 = function() {
        var vEl = document.getElementById('jennyVideoElV130') || document.querySelector('video');
        var spd = (vEl && vEl.playbackRate) ? vEl.playbackRate : (window._jennyVideoSpeedV170 || 1.0);
        var expectedDur = Math.max(window._v171RealFrameDuration, 32.0 / Math.max(0.1, spd));
        var elapsed = performance.now() - window._v171LastNewFrameTime;
        var a = elapsed / Math.max(8.3, expectedDur);
        return Math.max(0.02, Math.min(0.98, a));
    };

    // 3. Широкоугольный фрагментный шейдер 1080p Lucas-Kanade (1px + 4px + 10px) без сброса в ОРИГ
    var V171_FRAGMENT_SHADER_GLSL3 = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_prevTex;
uniform sampler2D u_currTex;
uniform float u_alpha;
uniform int u_mode; // 0=orig, 1=120hz, 2=split
uniform vec2 u_texelSize;

float getLuma(vec3 c) {
    return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
    vec2 uv = clamp(v_uv, vec2(0.001), vec2(0.999));

    // Режим 0 (ОРИГ) или левая половина СПЛИТА (uv.x < 0.5): чистый дискретный кадр без интерполяции
    if (u_mode == 0 || (u_mode == 2 && uv.x < 0.5)) {
        outColor = texture(u_currTex, uv);
        return;
    }

    // Линия разделения в режиме СПЛИТ
    if (u_mode == 2 && abs(uv.x - 0.5) < 0.0018) {
        outColor = vec4(0.0, 0.92, 1.0, 1.0);
        return;
    }

    vec2 tx = max(u_texelSize, vec2(1.0 / 1920.0, 1.0 / 1080.0));

    // Мульти-масштабная оценка градиента (1px + 4px + 10px) для захвата быстрых движений в 1080p
    float lPrev0 = getLuma(texture(u_prevTex, uv).rgb);
    float lCurr0 = getLuma(texture(u_currTex, uv).rgb);
    float It0 = lCurr0 - lPrev0;

    // Крупный масштаб (радиус 8 текселей) + средний (3 текселя)
    vec2 stepCoarse = tx * 8.0;
    vec2 stepMid    = tx * 3.0;

    float gxCoarse = (getLuma(texture(u_prevTex, uv + vec2(stepCoarse.x, 0.0)).rgb) -
                      getLuma(texture(u_prevTex, uv - vec2(stepCoarse.x, 0.0)).rgb) +
                      getLuma(texture(u_currTex, uv + vec2(stepCoarse.x, 0.0)).rgb) -
                      getLuma(texture(u_currTex, uv - vec2(stepCoarse.x, 0.0)).rgb)) * 0.25;

    float gyCoarse = (getLuma(texture(u_prevTex, uv + vec2(0.0, stepCoarse.y)).rgb) -
                      getLuma(texture(u_prevTex, uv - vec2(0.0, stepCoarse.y)).rgb) +
                      getLuma(texture(u_currTex, uv + vec2(0.0, stepCoarse.y)).rgb) -
                      getLuma(texture(u_currTex, uv - vec2(0.0, stepCoarse.y)).rgb)) * 0.25;

    float gxMid = (getLuma(texture(u_prevTex, uv + vec2(stepMid.x, 0.0)).rgb) -
                   getLuma(texture(u_prevTex, uv - vec2(stepMid.x, 0.0)).rgb) +
                   getLuma(texture(u_currTex, uv + vec2(stepMid.x, 0.0)).rgb) -
                   getLuma(texture(u_currTex, uv - vec2(stepMid.x, 0.0)).rgb)) * 0.25;

    float gyMid = (getLuma(texture(u_prevTex, uv + vec2(0.0, stepMid.y)).rgb) -
                   getLuma(texture(u_prevTex, uv - vec2(0.0, stepMid.y)).rgb) +
                   getLuma(texture(u_currTex, uv + vec2(0.0, stepMid.y)).rgb) -
                   getLuma(texture(u_currTex, uv - vec2(0.0, stepMid.y)).rgb)) * 0.25;

    vec2 grad = vec2(gxCoarse * 0.65 + gxMid * 0.35, gyCoarse * 0.65 + gyMid * 0.35);
    float gradMagSq = dot(grad, grad) + 0.0025;

    // Вычисляем вектор сдвига в UV-координатах (разрешаем сдвиг до 28 пикселей для 1080p)
    vec2 rawFlow = (-It0 * grad / gradMagSq) * (tx * 14.0);
    vec2 maxShift = tx * 28.0;
    vec2 flow = clamp(rawFlow, -maxShift, maxShift);

    // Двунаправленный варпинг вдоль вектора движения по честной фазе u_alpha (0.0 -> 1.0)
    vec2 uvPrev = clamp(uv - flow * u_alpha, vec2(0.001), vec2(0.999));
    vec2 uvCurr = clamp(uv + flow * (1.0 - u_alpha), vec2(0.001), vec2(0.999));

    vec4 colPrev = texture(u_prevTex, uvPrev);
    vec4 colCurr = texture(u_currTex, uvCurr);

    // Мягкий анти-гостинг: даже при сверхрезком рывке (смена сцены > 0.45 яркости) сохраняем плавный переход,
    // а на обычных движениях танцора всегда выдаем честную промежуточную фазу между colPrev и colCurr
    float diff = abs(getLuma(colPrev.rgb) - getLuma(colCurr.rgb));
    float sceneCutGate = smoothstep(0.35, 0.65, diff);
    vec4 warpedMix = mix(colPrev, colCurr, u_alpha);
    vec4 linearMix = mix(texture(u_prevTex, uv), texture(u_currTex, uv), u_alpha);

    outColor = mix(warpedMix, linearMix, sceneCutGate * 0.7);
}
`;

    // 4. Перехватываем методы WebGL2 / WebGL1 прототипов
    function hookWebGLProto(Proto) {
        if (!Proto || Proto._v171Hooked) return;
        Proto._v171Hooked = true;

        // Перехват компиляции шейдера: подменяем фрагментный шейдер интерполяции на V171
        var origShaderSource = Proto.shaderSource;
        Proto.shaderSource = function(shader, source) {
            if (typeof source === 'string' && source.indexOf('u_prevTex') !== -1 && source.indexOf('u_currTex') !== -1) {
                if (source.indexOf('#version 300 es') !== -1) {
                    console.log('[Jenny V171] Replaced 120Hz Fragment Shader with Wide-Radius Multi-Scale LK');
                    source = V171_FRAGMENT_SHADER_GLSL3;
                }
            }
            return origShaderSource.call(this, shader, source);
        };

        // Запоминаем локацию u_alpha
        var origGetUniformLocation = Proto.getUniformLocation;
        Proto.getUniformLocation = function(prog, name) {
            var loc = origGetUniformLocation.call(this, prog, name);
            if (loc && typeof name === 'string') {
                loc._v171Name = name;
            }
            return loc;
        };

        // Подменяем u_alpha на честную плавную фазу (0.0 .. 1.0) между декодированными кадрами
        var origUniform1f = Proto.uniform1f;
        Proto.uniform1f = function(loc, val) {
            if (loc && loc._v171Name === 'u_alpha') {
                val = window.computeTrueAlphaV171();
            }
            return origUniform1f.call(this, loc, val);
        };

        // Фиксируем viewport перед отрисовкой, чтобы не двоило картинку сверху/снизу
        var origDrawArrays = Proto.drawArrays;
        Proto.drawArrays = function(mode, first, count) {
            if (this.canvas && this.drawingBufferWidth > 0 && this.drawingBufferHeight > 0) {
                this.viewport(0, 0, this.drawingBufferWidth, this.drawingBufferHeight);
            }
            return origDrawArrays.call(this, mode, first, count);
        };

        // Блокируем перезапись текстур prevTex/currTex, если декодер видео еще не выдал новый кадр!
        var origTexImage2D = Proto.texImage2D;
        Proto.texImage2D = function() {
            var lastArg = arguments[arguments.length - 1];
            if (lastArg && lastArg.tagName === 'VIDEO') {
                if (checkVideoFrameChangedV171(lastArg)) {
                    window._v171AllowTexUploadThisTick = true;
                }
                if (!window._v171AllowTexUploadThisTick && window._v171LastDecodedCount > 2) {
                    return; // Не даем затереть prevTex тем же самым кадром!
                }
                window._v171UploadsInCurrentFrame++;
                if (window._v171UploadsInCurrentFrame >= 1) {
                    window._v171AllowTexUploadThisTick = false;
                }
            }
            return origTexImage2D.apply(this, arguments);
        };

        var origTexSubImage2D = Proto.texSubImage2D;
        if (origTexSubImage2D) {
            Proto.texSubImage2D = function() {
                var lastArg = arguments[arguments.length - 1];
                if (lastArg && lastArg.tagName === 'VIDEO') {
                    if (checkVideoFrameChangedV171(lastArg)) {
                        window._v171AllowTexUploadThisTick = true;
                    }
                    if (!window._v171AllowTexUploadThisTick && window._v171LastDecodedCount > 2) {
                        return;
                    }
                    window._v171UploadsInCurrentFrame++;
                    if (window._v171UploadsInCurrentFrame >= 1) {
                        window._v171AllowTexUploadThisTick = false;
                    }
                }
                return origTexSubImage2D.apply(this, arguments);
            };
        }

        var origCopyTexImage2D = Proto.copyTexImage2D;
        if (origCopyTexImage2D) {
            Proto.copyTexImage2D = function() {
                if (!window._v171AllowTexUploadThisTick && window._v171LastDecodedCount > 2) {
                    return; // Не копируем currTex в prevTex на промежуточных подкадрах 120Hz!
                }
                return origCopyTexImage2D.apply(this, arguments);
            };
        }
    }

    if (typeof WebGL2RenderingContext !== 'undefined') hookWebGLProto(WebGL2RenderingContext.prototype);
    if (typeof WebGLRenderingContext !== 'undefined') hookWebGLProto(WebGLRenderingContext.prototype);
})();
/* ================= END JENNY V171 WEBGL HOOK ================= */
"""

def apply_v171():
    files = find_ui_js()
    if not files:
        print("ОШИБКА: ui_v71.js не найден в", BASE_DIR)
        return

    for path in files:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            code = f.read()

        # Удаляем старый верхний хук V171, если уже ставился
        code = re.sub(
            r"/\* ================= JENNY V171:.*?/\* ================= END JENNY V171 WEBGL HOOK ================= \*/\s*",
            "",
            code,
            flags=re.DOTALL
        )

        # Также пропатчим условие обновления кадра в самом цикле рендера по регулярке,
        # чтобы ping-pong текстур (prevTex <-> currTex) переключался только при разрешении от детектора кадров V171
        patched_count = 0
        def repl_time_check(match):
            nonlocal patched_count
            patched_count += 1
            return "if (window._v171AllowTexUploadThisTick)"

        code_new = re.sub(
            r"if\s*\(\s*vEl\.currentTime\s*!==\s*lastVideoTime\s*\)",
            repl_time_check,
            code
        )

        # Ставим V171_WEBGL_HOOK в самое начало файла (байт 0), чтобы перехватить создание шейдеров и текстур со старта
        final_code = V171_WEBGL_HOOK + "\n" + code_new
        with open(path, "w", encoding="utf-8") as f:
            f.write(final_code)

        print(f"[V171] Успешно пропатчен {path} (замен циклов времени: {patched_count}, WebGL-перехватчик установлен в начало файла)")

if __name__ == "__main__":
    apply_v171()

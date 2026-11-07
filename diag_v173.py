#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os, re

BASE_DIR = "/storage/emulated/0/scripts/JennyPlayer"
if not os.path.exists(BASE_DIR):
    BASE_DIR = os.getcwd()

DIAG_PAYLOAD = r"""
/* ================= JENNY V173: ON-SCREEN FRAMETIME FENCE + 120-FRAME TEXT LOGGER ================= */
(function() {
    if (window._jennyV173DiagInstalled) return;
    window._jennyV173DiagInstalled = true;

    var historyDt = new Float32Array(120);
    var historyAlpha = new Float32Array(120);
    var historyNewFrame = new Uint8Array(120);
    var histIdx = 0;

    var lastTickTime = performance.now();
    var lastCapturedAlpha = 0.0;
    var lastTexUploadTick = -1;
    var tickCounter = 0;

    var isLogging120 = false;
    var logLines = [];

    // Перехватываем только чтение u_alpha и факта загрузки текстуры (без блокировки!)
    function attachReadOnlyProbe(Proto) {
        if (!Proto || Proto._v173Probe) return;
        Proto._v173Probe = true;

        var origGetUniformLocation = Proto.getUniformLocation;
        Proto.getUniformLocation = function(prog, name) {
            var loc = origGetUniformLocation.call(this, prog, name);
            if (loc && typeof name === 'string') loc._uName = name;
            return loc;
        };

        var origUniform1f = Proto.uniform1f;
        Proto.uniform1f = function(loc, val) {
            if (loc && loc._uName === 'u_alpha') {
                lastCapturedAlpha = val;
            }
            return origUniform1f.call(this, loc, val);
        };

        var origTexImage2D = Proto.texImage2D;
        Proto.texImage2D = function() {
            var lastArg = arguments[arguments.length - 1];
            if (lastArg && lastArg.tagName === 'VIDEO') {
                lastTexUploadTick = tickCounter;
            }
            return origTexImage2D.apply(this, arguments);
        };

        var origTexSubImage2D = Proto.texSubImage2D;
        if (origTexSubImage2D) {
            Proto.texSubImage2D = function() {
                var lastArg = arguments[arguments.length - 1];
                if (lastArg && lastArg.tagName === 'VIDEO') {
                    lastTexUploadTick = tickCounter;
                }
                return origTexSubImage2D.apply(this, arguments);
            };
        }

        var origDrawArrays = Proto.drawArrays;
        Proto.drawArrays = function(mode, first, count) {
            var now = performance.now();
            var dt = now - lastTickTime;
            lastTickTime = now;
            tickCounter++;

            var uploadedNow = (lastTexUploadTick === tickCounter) ? 1 : 0;
            historyDt[histIdx] = dt;
            historyAlpha[histIdx] = lastCapturedAlpha;
            historyNewFrame[histIdx] = uploadedNow;
            histIdx = (histIdx + 1) % 120;

            if (isLogging120) {
                var vEl = document.getElementById('jennyVideoElV130') || document.querySelector('video');
                var dec = -1;
                if (vEl && typeof vEl.getVideoPlaybackQuality === 'function') {
                    dec = vEl.getVideoPlaybackQuality().totalVideoFrames;
                } else if (vEl && typeof vEl.webkitDecodedFrameCount === 'number') {
                    dec = vEl.webkitDecodedFrameCount;
                }
                var ct = vEl ? vEl.currentTime.toFixed(4) : "0.0000";
                logLines.push(
                    String(logLines.length + 1).padStart(3, ' ') + " | " +
                    dt.toFixed(2).padStart(6, ' ') + "ms | " +
                    "vTime:" + ct + " | " +
                    "dec:" + dec + " | " +
                    "texUp:" + uploadedNow + " | " +
                    "alpha:" + lastCapturedAlpha.toFixed(3)
                );
                if (logLines.length >= 120) {
                    isLogging120 = false;
                    var finalLog = "=== JENNY 120Hz FRAME LOG ===\n" +
                                   "Idx |   dt_ms  |   vTime     | decFrm | texUp | alpha\n" +
                                   logLines.join("\n");
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(finalLog).catch(function(){});
                    }
                    window._lastJenny120Log = finalLog;
                    console.log(finalLog);
                    if (typeof window.showToast === 'function') {
                        window.showToast('✅ Лог 120 кадров скопирован в буфер обмена!');
                    }
                    var btn = document.getElementById('jennyLog120Btn');
                    if (btn) btn.textContent = '📋 ЛОГ ГОТОВ (В БУФЕРЕ)';
                }
            }
            return origDrawArrays.call(this, mode, first, count);
        };
    }

    if (typeof WebGL2RenderingContext !== 'undefined') attachReadOnlyProbe(WebGL2RenderingContext.prototype);
    if (typeof WebGLRenderingContext !== 'undefined') attachReadOnlyProbe(WebGLRenderingContext.prototype);

    // Создаем панель «Заборчика» и кнопку лога поверх видеоплеера
    function ensureDiagOverlay() {
        if (document.getElementById('jennyFenceCanvasV173')) return;
        var vEl = document.getElementById('jennyVideoElV130') || document.querySelector('video');
        if (!vEl || !vEl.parentElement) return;

        var wrap = document.createElement('div');
        wrap.id = 'jennyFenceWrapV173';
        wrap.style.cssText = 'position:absolute;bottom:54px;left:10px;z-index:99999;display:flex;align-items:center;gap:8px;background:rgba(0,0,0,0.75);border:1px solid #00e5ff;border-radius:6px;padding:4px 8px;pointer-events:auto;';

        var cv = document.createElement('canvas');
        cv.id = 'jennyFenceCanvasV173';
        cv.width = 240;
        cv.height = 46;
        cv.style.cssText = 'width:240px;height:46px;display:block;';

        var btn = document.createElement('button');
        btn.id = 'jennyLog120Btn';
        btn.textContent = '📋 ЛОГ 120';
        btn.style.cssText = 'background:#00e5ff;color:#000;font-weight:bold;font-size:11px;border:none;border-radius:4px;padding:6px 8px;cursor:pointer;';
        btn.onclick = function(e) {
            e.stopPropagation();
            if (window._lastJenny120Log && btn.textContent.indexOf('ГОТОВ') !== -1) {
                prompt('Скопируй лог 120 кадров:', window._lastJenny120Log);
                return;
            }
            logLines = [];
            isLogging120 = true;
            btn.textContent = '⏳ ПИШУ 120...';
        };

        wrap.appendChild(cv);
        wrap.appendChild(btn);
        vEl.parentElement.appendChild(wrap);
    }

    // Отрисовка «Заборчика» (dt_ms + ступеньки alpha + маркеры подгрузки текстур)
    function drawFence() {
        ensureDiagOverlay();
        var cv = document.getElementById('jennyFenceCanvasV173');
        if (cv) {
            var ctx = cv.getContext('2d');
            ctx.clearRect(0, 0, cv.width, cv.height);

            // Горизонтальная линия эталона 8.33 мс (120 Гц)
            var y8ms = cv.height - Math.round(8.33 * 1.6);
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(0, y8ms, cv.width, 1);

            for (var i = 0; i < 120; i++) {
                var idx = (histIdx + i) % 120;
                var dt = historyDt[idx];
                var al = historyAlpha[idx];
                var up = historyNewFrame[idx];

                var h = Math.min(cv.height - 2, Math.max(2, Math.round(dt * 1.6)));
                // Зеленый если ~8.3мс, желтый если >13мс, красный если рывок >20мс
                ctx.fillStyle = (dt > 20.0) ? '#ff1744' : (dt > 13.0 ? '#ffea00' : '#00e676');
                ctx.fillRect(i * 2, cv.height - h, 1, h);

                // Голубая точка сверху показывает фазу u_alpha (пила интерполяции)
                var yAlpha = Math.round((1.0 - Math.max(0, Math.min(1, al))) * (cv.height - 6)) + 3;
                ctx.fillStyle = up ? '#ffffff' : '#00e5ff';
                ctx.fillRect(i * 2, yAlpha, 2, 2);
            }
        }
        requestAnimationFrame(drawFence);
    }
    requestAnimationFrame(drawFence);
})();
/* ================= END JENNY V173 DIAG ================= */
"""

for root, _, files in os.walk(BASE_DIR):
    if "node_modules" in root or ".git" in root:
        continue
    if "ui_v71.js" in files:
        path = os.path.join(root, "ui_v71.js")
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            code = f.read()
        code = re.sub(
            r"/\* ================= JENNY V173:.*?/\* ================= END JENNY V173 DIAG ================= \*/\s*",
            "",
            code,
            flags=re.DOTALL
        )
        with open(path, "w", encoding="utf-8") as f:
            f.write(code + "\n" + DIAG_PAYLOAD + "\n")
        print("Установлен монитор-заборчик и логгер 120 кадров:", path)

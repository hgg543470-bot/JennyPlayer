#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os

BASE_DIR = "/storage/emulated/0/scripts/JennyPlayer"
if not os.path.exists(BASE_DIR):
    BASE_DIR = os.getcwd()

ui_targets = [
    os.path.join(BASE_DIR, "ui_v71.js"),
    os.path.join(BASE_DIR, "app", "src", "main", "python", "ui_v71.js")
]

for path in ui_targets:
    if not os.path.isfile(path):
        continue
    code = open(path, "r", encoding="utf-8", errors="ignore").read()

    # 1. Полностью отключаем создание и показ нижней кнопки #v166Btn120Mode ("24/60 Ориг") в видеоплеере
    code = code.replace(
        "function mount120HzButtonInVideoHud() {",
        """function mount120HzButtonInVideoHud() {
        const oldBtn = document.getElementById('v166Btn120Mode');
        if (oldBtn) oldBtn.remove();
        return;"""
    )
    code = code.replace(
        "btn120.style.setProperty('display', (fl.core120 || fl.splitTest) ? 'inline-flex' : 'none', 'important');",
        "btn120.remove();"
    )

    # 2. Заменяем зашитую надпись '60Hz-Ориг' и 'Уник: 12' в верхней телеметрии на реальный FPS файла
    code = code.replace(
        "const modeTag = (m.mode === 'split') ? ('🌓СПЛИТ (+' + plusN + 'к, -' + skipCnt + 'дуб)') : ((m.mode === '120') ? ('⚡V202 (+' + plusN + 'к, -' + skipCnt + 'дуб)') : '60Hz-Ориг');",
        "const realFps = (window.getRealOrigFpsV208 ? window.getRealOrigFpsV208() : (m.sourceFps || 30));\n        const modeTag = (m.mode === 'split') ? ('🌓СПЛИТ ' + realFps + '->120 (+' + plusN + 'к)') : ((m.mode === '120') ? ('⚡120Hz (+' + plusN + 'к)') : (realFps + 'FPS-Ориг'));"
    )
    code = code.replace(
        "'<span style=\"color:#e3b341;\">🎞️ Уник: ' + (m.sourceFps || 12) + '</span> ➔ '",
        "'<span style=\"color:#e3b341;\">🎞️ Ориг: ' + (window.getRealOrigFpsV208 ? window.getRealOrigFpsV208() : (m.sourceFps || 30)) + ' FPS</span> ➔ '"
    )

    # 3. Передаем точный номер текущего шага и счетчик кадров декодера из render120HzFrame напрямую в логгер (без гонки в 0.5 мс)
    old_diag_block = """        if (window._jv207Diag) {
            window._jv207Diag.step = vsyncStepInCycle;
            window._jv207Diag.totalSteps = totalSteps;
            window._jv207Diag.alpha = alpha;
            window._jv207Diag.expectedSpanMs = expectedSpanMs;
        }"""
    new_diag_block = """        window._jv207Diag = {
            step: vsyncStepInCycle,
            totalSteps: totalSteps,
            alpha: alpha,
            expectedSpanMs: expectedSpanMs,
            engineDecCount: lastExactDecCountV201
        };"""
    if old_diag_block in code:
        code = code.replace(old_diag_block, new_diag_block)
    else:
        code = code.replace(
            "lastMonotonicAlpha = alpha;",
            "lastMonotonicAlpha = alpha;\n" + new_diag_block
        )

    # 4. В логгере берем dec синхронно из движка (чтобы не было ложных tex:DUP за 0.5 мс до загрузки текстуры) и считаем реальный шаг 01/04..04/04
    code = code.replace(
        """        var dec = -1;
        if (vEl && typeof vEl.getVideoPlaybackQuality === 'function') {
            var q = vEl.getVideoPlaybackQuality();
            if (q) dec = q.totalVideoFrames;
        }""",
        """        var dec = (window._jv207Diag && window._jv207Diag.engineDecCount > 0 && !fromOffMode)
            ? window._jv207Diag.engineDecCount
            : -1;
        if (dec < 0 && vEl && typeof vEl.getVideoPlaybackQuality === 'function') {
            var q = vEl.getVideoPlaybackQuality();
            if (q) dec = q.totalVideoFrames;
        }"""
    )
    code = code.replace(
        "var stepNum = diag.step || 1;",
        "var totSteps = diag.totalSteps || 4;\n        var stepNum = diag.step || Math.max(1, Math.round(curAlpha * totSteps));"
    )
    code = code.replace(
        "var totSteps = diag.totalSteps || 4;\n        var expMs =",
        "var expMs ="
    )

    open(path, "w", encoding="utf-8").write(code)
    print(f"[V208.1] Убрана кнопка '24/60 Ориг' и синхронизирован счетчик шагов логгера: {path}")

print("✅ Готово! Можно отправлять папку на сборку.")

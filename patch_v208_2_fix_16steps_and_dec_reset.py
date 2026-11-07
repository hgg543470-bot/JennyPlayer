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

    # 1. Снимаем зажим Math.min(12, ...) -> Math.min(60, ...), чтобы на 0.25x шли все 16/16 шагов без остановки на 12/12
    code = code.replace(
        "Math.max(2, Math.min(12, Math.round((expectedSpanMs / 1000.0) * effFps)))",
        "Math.max(2, Math.min(60, Math.round((expectedSpanMs / 1000.0) * effFps)))"
    )

    # 2. Исправляем детектор смены кадра оригинала в логгере при открытии нового видео или перемотке (когда dec < prevTrackDec)
    old_dec_check = """        var origChanged = false;
        if (dec >= 0 && prevTrackDec >= 0) {
            if (dec > prevTrackDec) origChanged = true;
        } else if (Math.abs(vTime - prevTrackVTime) > 0.002) {
            origChanged = true;
        }"""

    new_dec_check = """        var origChanged = false;
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
        }"""

    code = code.replace(old_dec_check, new_dec_check)

    # При старте записи нового лога (кнопка ЛОГ 360) синхронизируем стартовую точку таймера оригинала
    code = code.replace(
        "logEntries = [];\n                isLogging = true;",
        "logEntries = [];\n                prevTrackDec = -1;\n                lastOrigChangeTs = performance.now();\n                origHoldTicks = 0;\n                isLogging = true;"
    )

    open(path, "w", encoding="utf-8").write(code)
    print(f"[V208.2] Снят лимит 12 шагов (теперь 16/16 на 0.25x) и исправлен сброс dec: {path}")

print("✅ Готово! Отправляй папку на сборку.")

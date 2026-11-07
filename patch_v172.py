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

V172_CLEAN_SPLIT_FIX = r"""/* ================= JENNY V172: CLEAN VIEWPORT & ORIG SPLIT FIX (NO TEX BLOCKING) ================= */
(function() {
    if (window._jennyV172ViewportFixed) return;
    window._jennyV172ViewportFixed = true;

    function hookViewportOnly(Proto) {
        if (!Proto || Proto._v172Hooked) return;
        Proto._v172Hooked = true;

        var origDrawArrays = Proto.drawArrays;
        Proto.drawArrays = function(mode, first, count) {
            if (this.canvas && this.drawingBufferWidth > 0 && this.drawingBufferHeight > 0) {
                this.viewport(0, 0, this.drawingBufferWidth, this.drawingBufferHeight);
            }
            return origDrawArrays.call(this, mode, first, count);
        };
    }

    if (typeof WebGL2RenderingContext !== 'undefined') hookViewportOnly(WebGL2RenderingContext.prototype);
    if (typeof WebGLRenderingContext !== 'undefined') hookViewportOnly(WebGLRenderingContext.prototype);
})();
/* ================= END JENNY V172 CLEAN FIX ================= */
"""

def apply_v172():
    files = find_ui_js()
    if not files:
        print("ОШИБКА: ui_v71.js не найден в", BASE_DIR)
        return

    for path in files:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            code = f.read()

        # 1. Полностью удаляем хук V171 (блокировщик текстур и подмену шейдера)
        code = re.sub(
            r"/\* ================= JENNY V171:.*?/\* ================= END JENNY V171 WEBGL HOOK ================= \*/\s*",
            "",
            code,
            flags=re.DOTALL
        )
        # Удаляем старый V172 если перезапускаем
        code = re.sub(
            r"/\* ================= JENNY V172:.*?/\* ================= END JENNY V172 CLEAN FIX ================= \*/\s*",
            "",
            code,
            flags=re.DOTALL
        )

        # 2. Возвращаем штатную проверку времени кадра, которую V171 заменил на _v171AllowTexUploadThisTick
        code = code.replace(
            "if (window._v171AllowTexUploadThisTick)",
            "if (vEl.currentTime !== lastVideoTime)"
        )

        # 3. Ставим только чистый фикс viewport в начало файла (чтобы ОРИГ в сплите не артефачил)
        final_code = V172_CLEAN_SPLIT_FIX + "\n" + code
        with open(path, "w", encoding="utf-8") as f:
            f.write(final_code)

        print(f"[V172] V171 откачен, оригинальный шейдер 120Hz-LK восстановлен, фикс чистого ОРИГ в сплите сохранен: {path}")

if __name__ == "__main__":
    apply_v172()

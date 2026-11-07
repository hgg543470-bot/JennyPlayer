#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os, re

BASE_DIR = "/storage/emulated/0/scripts/JennyPlayer"
if not os.path.exists(BASE_DIR):
    BASE_DIR = os.getcwd()

V172_GATED_HOOK = """/* ================= JENNY V172: CLEAN VIEWPORT & ORIG SPLIT FIX (GATED BY V205 SWITCH) ================= */
window._jennyExp120HzEnabledV205 = (localStorage.getItem('jenny_exp_120hz_v205') === '1');
(function() {
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
/* ================= END JENNY V172 CLEAN FIX ================= */"""

V205_MASTER_SWITCH_SNIPPET = r"""
// === 🔌 JENNY V205: ЕДИНЫЙ РУБИЛЬНИК ЭКСПЕРИМЕНТАЛЬНОГО 120Hz WEBGL & .SO ЯДЕР (ПО УМОЛЧАНИЮ ВЫКЛ) ===
(function initJennyExp120HzMasterSwitchV205() {
    if (window._jennyExp120HzSwitchInstalledV205) return;
    window._jennyExp120HzSwitchInstalledV205 = true;

    // По умолчанию ВЫКЛ (false), пока пользователь явно не включит галочку
    window._jennyExp120HzEnabledV205 = (localStorage.getItem('jenny_exp_120hz_v205') === '1');

    window.applyExp120HzMasterStateV205 = function(enabled, showMsg) {
        const isOn = Boolean(enabled);
        window._jennyExp120HzEnabledV205 = isOn;
        try {
            localStorage.setItem('jenny_exp_120hz_v205', isOn ? '1' : '0');
        } catch (e) {}

        if (window._jv166Metrics) {
            window._jv166Metrics.mode = isOn ? (window._jv166SavedModeV205 || '120') : 'off';
        }

        const idsToHide = [
            'jennyFenceWrapV173',
            'jv166InterpCanvas',
            'jv168SplitLine',
            'v166Btn120Mode',
            'jv166VCoreDeckPanel'
        ];
        idsToHide.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (!isOn) {
                el.style.setProperty('display', 'none', 'important');
            } else {
                el.style.removeProperty('display');
                if (id === 'v166Btn120Mode') el.style.display = 'inline-flex';
                if (id === 'jv166VCoreDeckPanel' && window._activeUiDeckV131 === 'video') el.style.display = 'block';
                if (id === 'jennyFenceWrapV173') el.style.display = 'flex';
            }
        });

        const chk = document.getElementById('chkExp120HzMasterV205');
        if (chk) chk.checked = isOn;
        const statusSpan = document.getElementById('lblExp120HzStatusV205');
        if (statusSpan) {
            statusSpan.textContent = isOn ? 'ВКЛ (Активно)' : 'ВЫКЛ (Отключено)';
            statusSpan.style.color = isOn ? '#00ff9d' : '#8b949e';
        }

        // Обновляем строку телеметрии в шапке видеоплеера
        const st = window._vidStateV130;
        const vd = window.videoDeckV131 || {};
        const subEl = document.getElementById('v130VideoSubTelemetry');
        if (subEl && st && st.active) {
            if (!isOn) {
                const gKey = (vd.config && vd.config.gearKeyV66) || 'jbuf-lock';
                const ramLoaded = vd.studioBuffer ? (vd.studioBuffer._loadedCountV72 || 0) : 0;
                const ramTot = (vd.studioBuffer && vd.studioBuffer._pieceMapV72) ? vd.studioBuffer._pieceMapV72.length : 0;
                const ramTag = ramTot > 0 ? `RAM ${ramLoaded}/${ramTot}` : 'Поток';
                subEl.textContent = `🧩 ${ramTag} • ⚙️ РКПП: ${gKey} • ⏩ x${vd.speed || 1.0}${vd.isReversed ? ' (⏪REV)' : ''}`;
            } else if (typeof window.updateVideoHeaderTelemetryV166 === 'function') {
                window.updateVideoHeaderTelemetryV166();
            }
        }

        if (isOn && typeof window.renderVCoreDeckPanelV166 === 'function') {
            window.renderVCoreDeckPanelV166();
        }

        if (showMsg && typeof window.showToast === 'function') {
            window.showToast(isOn
                ? '🧪 Лаборатория 120Hz WebGL & Ядра .SO ВКЛЮЧЕНА'
                : '🔌 Все функции 120Hz WebGL, логгер и ядра .SO полностью ВЫКЛЮЧЕНЫ');
        }
    };

    window.mountExp120HzMasterCheckboxV205 = function() {
        const sm = document.getElementById('settingsModal');
        if (!sm) return;
        const deckBar = document.getElementById('deckSwitchBarSettingsV131');
        const container = sm.querySelector('.container') || sm;
        let box = document.getElementById('jennyExp120HzMasterBoxV205');
        const isOn = Boolean(window._jennyExp120HzEnabledV205);

        if (!box) {
            box = document.createElement('div');
            box.id = 'jennyExp120HzMasterBoxV205';
            box.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 12px;margin-bottom:10px;background:#0b1018;border:1.5px solid #30363d;border-radius:10px;';
            if (deckBar && deckBar.parentNode) {
                deckBar.insertAdjacentElement('afterend', box);
            } else {
                container.insertBefore(box, container.firstChild);
            }
        }

        box.style.borderColor = isOn ? '#00e5ff' : '#30363d';
        box.innerHTML = `
            <label style="display:flex;align-items:center;gap:9px;cursor:pointer;flex:1;user-select:none;">
                <input type="checkbox" id="chkExp120HzMasterV205" ${isOn ? 'checked' : ''} onchange="window.applyExp120HzMasterStateV205(this.checked, true)" style="width:18px;height:18px;accent-color:#00e5ff;cursor:pointer;flex-shrink:0;">
                <div style="display:flex;flex-direction:column;gap:2px;">
                    <span style="font-size:12px;font-weight:900;color:#e6edf3;">🧪 Лаборатория 120Hz WebGL & Ядра .SO</span>
                    <span style="font-size:10px;color:#8b949e;">Генератор кадров, сплит, логгер 360 и матрица декодеров</span>
                </div>
            </label>
            <span id="lblExp120HzStatusV205" style="font-size:10.5px;font-weight:900;font-family:monospace;color:${isOn ? '#00ff9d' : '#8b949e'};flex-shrink:0;">
                ${isOn ? 'ВКЛ (Активно)' : 'ВЫКЛ (Отключено)'}
            </span>
        `;
    };

    const origRenderDeckBanners = window.renderDeckSwitchBannersV131;
    if (typeof origRenderDeckBanners === 'function') {
        window.renderDeckSwitchBannersV131 = function() {
            const r = origRenderDeckBanners.apply(this, arguments);
            window.mountExp120HzMasterCheckboxV205();
            window.applyExp120HzMasterStateV205(window._jennyExp120HzEnabledV205, false);
            return r;
        };
    }

    setInterval(() => {
        window.mountExp120HzMasterCheckboxV205();
        if (!window._jennyExp120HzEnabledV205) {
            window.applyExp120HzMasterStateV205(false, false);
        }
    }, 600);

    setTimeout(() => {
        window.mountExp120HzMasterCheckboxV205();
        window.applyExp120HzMasterStateV205(window._jennyExp120HzEnabledV205, false);
    }, 150);
})();
"""

targets = [
    os.path.join(BASE_DIR, "ui_v71.js"),
    os.path.join(BASE_DIR, "app", "src", "main", "python", "ui_v71.js")
]

patched_files = 0
for path in targets:
    if not os.path.isfile(path):
        continue
    code = open(path, "r", encoding="utf-8", errors="ignore").read()

    # 1. Оборачиваем верхний V172 хук проверкой window._jennyExp120HzEnabledV205
    code = re.sub(
        r"/\*\s*=================\s*JENNY V172:.*?/\*\s*=================\s*END JENNY V172 CLEAN FIX\s*=================\s*\*/",
        V172_GATED_HOOK,
        code,
        count=1,
        flags=re.DOTALL
    )

    # 2. В master120HzLoop блокируем работу WebGL, если рубильник ВЫКЛ
    code = code.replace(
        "function master120HzLoop(now) {\n        vsyncTicks++;",
        """function master120HzLoop(now) {
        if (!window._jennyExp120HzEnabledV205) {
            if (glCanvas) glCanvas.style.display = 'none';
            if (splitLineEl) splitLineEl.style.display = 'none';
            hasValidFramePair = false;
            requestAnimationFrame(master120HzLoop);
            return;
        }
        vsyncTicks++;"""
    )

    # 3. В loopFence (Логгер и 9 ползунков V173) блокируем отрисовку и прячем виджет, если рубильник ВЫКЛ
    code = code.replace(
        "function loopFence() {\n        ensureOverlay();",
        """function loopFence() {
        if (!window._jennyExp120HzEnabledV205) {
            var wOff = document.getElementById('jennyFenceWrapV173');
            if (wOff) wOff.style.setProperty('display', 'none', 'important');
            var sOff = document.getElementById('jv168SplitLine');
            if (sOff) sOff.style.setProperty('display', 'none', 'important');
            requestAnimationFrame(loopFence);
            return;
        }
        ensureOverlay();"""
    )

    # 4. В перехватчике drawArrays логгера V173 отключаем сбор метрик, когда рубильник ВЫКЛ
    code = code.replace(
        "Proto.drawArrays = function(m, f, c) {\n            var now = performance.now();",
        """Proto.drawArrays = function(m, f, c) {
            if (!window._jennyExp120HzEnabledV205) return origDraw.call(this, m, f, c);
            var now = performance.now();"""
    )

    # 5. Блокируем показ кнопки 120Hz и панели .SO ядер, когда рубильник ВЫКЛ
    code = code.replace(
        "function mount120HzButtonInVideoHud() {",
        """function mount120HzButtonInVideoHud() {
        if (!window._jennyExp120HzEnabledV205) {
            const bOff = document.getElementById('v166Btn120Mode');
            if (bOff) bOff.style.setProperty('display', 'none', 'important');
            return;
        }"""
    )
    code = code.replace(
        "window.renderVCoreDeckPanelV166 = function() {",
        """window.renderVCoreDeckPanelV166 = function() {
        if (!window._jennyExp120HzEnabledV205) {
            const pOff = document.getElementById('jv166VCoreDeckPanel');
            if (pOff) pOff.style.setProperty('display', 'none', 'important');
            return;
        }"""
    )
    code = code.replace(
        "window.updateVideoHeaderTelemetryV166 = function() {",
        """window.updateVideoHeaderTelemetryV166 = function() {
        if (!window._jennyExp120HzEnabledV205) return;"""
    )

    # 6. Добавляем блок управления единой галочкой V205 в конец файла
    code = re.sub(
        r"// === 🔌 JENNY V205:.*",
        "",
        code,
        flags=re.DOTALL
    )
    code = code.rstrip() + "\n\n" + V205_MASTER_SWITCH_SNIPPET + "\n"

    open(path, "w", encoding="utf-8").write(code)
    patched_files += 1
    print(f"[V205] Рубильник 120Hz/VCore установлен (по умолчанию ВЫКЛ): {path}")

print(f"Готово! Обновлено файлов ui_v71.js: {patched_files}")

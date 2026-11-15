/* ============================================================================
 * ui_themes.js — Редактор тем (V37–V43): пресеты, цвета групп, JSON, файлы тем
 * Вынесено из ui_help.js без изменения кода (см. REFACTOR_PLAN.md). Порядок блоков — исходный.
 * ============================================================================ */



// 🎨 ПАТЧ V37: РЕДАКТОР ТЕМ, ЧЕСТНЫЙ AMOLED #000000 И ЕДИНЫЕ ТОНКИЕ РАМКИ / ГРАДИЕНТЫ
window.THEME_PRESETS_V37 = {
    // Монохромные рамки (solid)
    solid_purple:  { mode: 'solid', rgb: [115, 65, 190], ru: '🟣 Тёмный Аметист (Дефолт)', en: '🟣 Subtle Amethyst (Default)', preview: '#7341be' },
    solid_cyan:    { mode: 'solid', rgb: [88, 166, 255], ru: '🔵 Кибер-Циан',              en: '🔵 Cyber Cyan',               preview: '#58a6ff' },
    solid_emerald: { mode: 'solid', rgb: [63, 185, 80],  ru: '🟢 Изумрудная Матрица',      en: '🟢 Matrix Emerald',           preview: '#3fb950' },
    solid_gold:    { mode: 'solid', rgb: [227, 179, 65], ru: '🟡 Золотой Винил',           en: '🟡 Vinyl Gold',               preview: '#e3b341' },
    solid_ruby:    { mode: 'solid', rgb: [248, 81, 73],  ru: '🔴 Рубиновый Лазер',         en: '🔴 Ruby Laser',               preview: '#f85149' },
    solid_stealth: { mode: 'solid', rgb: [110, 118, 129],ru: '⚪ Стелс-Графит',            en: '⚪ Stealth Graphite',         preview: '#6e7681' },
    // Градиентные рамки (grad)
    grad_synth:    { mode: 'grad', c1: [115, 65, 190], c2: [88, 166, 255],  ru: '🌌 Неоновый Синтвейв (Фиолет ➔ Циан)',   en: '🌌 Neon Synthwave (Purple ➔ Cyan)',   preview: 'linear-gradient(135deg,#7341be,#58a6ff)' },
    grad_sunset:   { mode: 'grad', c1: [163, 113, 247],c2: [227, 179, 65],  ru: '🌅 Кибер-Закат (Фиолет ➔ Золото)',       en: '🌅 Cyber Sunset (Purple ➔ Gold)',     preview: 'linear-gradient(135deg,#a371f7,#e3b341)' },
    grad_matrix:   { mode: 'grad', c1: [63, 185, 80],  c2: [88, 166, 255],  ru: '🧪 Био-Матрица (Изумруд ➔ Циан)',        en: '🧪 Bio-Matrix (Emerald ➔ Cyan)',      preview: 'linear-gradient(135deg,#3fb950,#58a6ff)' },
    grad_plasma:   { mode: 'grad', c1: [248, 81, 73],  c2: [227, 179, 65],  ru: '🔥 Плазменный Овердрайв (Рубин ➔ Золото)',en: '🔥 Plasma Overdrive (Ruby ➔ Gold)',   preview: 'linear-gradient(135deg,#f85149,#e3b341)' },
    grad_cosmos:   { mode: 'grad', c1: [115, 65, 190], c2: [63, 185, 80], c3: [88, 166, 255], ru: '🔮 Глубокий Космос (3-цветный)', en: '🔮 Deep Space (Tri-Color)', preview: 'linear-gradient(135deg,#7341be,#3fb950,#58a6ff)' }
};

window.JENNY_HELP_DB_RU.theme_studio = {
    title: "🎨 Редактор тем и тонких контуров",
    phys: "Переводит все карточки в режим честного <b>#000000 AMOLED</b> (выключенные пиксели) и рисует тонкие 1px рамки выбранного цвета или градиента с заданной прозрачностью.",
    hear: "Глаза не слепит серым свечением в темноте, а все блоки выглядят строго в едином монолитном стиле.",
    tip: "Монохромные цвета и градиенты взаимоисключают друг друга — просто ткни в понравившийся вариант!"
};
window.JENNY_HELP_DB_EN.theme_studio = {
    title: "🎨 Theme & Thin Border Studio",
    phys: "Switches all cards to true <b>#000000 AMOLED</b> black (pixels completely off) and renders uniform 1px solid or gradient borders with adjustable opacity.",
    hear: "Zero gray backlight bleed in the dark with a clean, unified cyber aesthetic.",
    tip: "Solid colors and gradients are mutually exclusive — just tap any style to switch!"
};

window.unifyAllSettingCardsV37 = function() {
    const sm = document.getElementById('settingsModal');
    if (sm) {
        sm.querySelectorAll('.setting-row').forEach(row => {
            if (row.style && (row.style.borderLeft || row.style.background)) {
                row.classList.add('jenny-uniform-card');
                row.style.borderLeft = '';
                row.style.borderTop = '';
                row.style.borderRight = '';
                row.style.borderBottom = '';
                row.style.background = '';
            }
        });
        // Прячем дубликаты AMOLED и Ползунка громкости из общего списка, так как теперь они живут в Редакторе Тем
        ['cfg_amoledMode', 'cfg_volSlider'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const row = el.closest('.setting-row');
                if (row && !row.closest('#themeModal')) row.style.display = 'none';
            }
        });
    }
};

window.applyVisualThemeV37 = function() {
    window.appConfig = window.appConfig || JSON.parse(localStorage.getItem('ytm_config') || '{}');
    const key = window.appConfig.themeBorderKey || 'solid_purple';
    const alphaPct = (window.appConfig.themeBorderAlpha !== undefined) ? parseInt(window.appConfig.themeBorderAlpha, 10) : 38;
    const alpha = Math.max(0.1, Math.min(1.0, alphaPct / 100));

    const preset = window.THEME_PRESETS_V37[key] || window.THEME_PRESETS_V37.solid_purple;
    const root = document.documentElement;

    if (preset.mode === 'solid') {
        document.body.setAttribute('data-border-mode', 'solid');
        const [r, g, b] = preset.rgb;
        root.style.setProperty('--border-uniform', `rgba(${r}, ${g}, ${b}, ${alpha})`);
        root.style.setProperty('--border-main', `rgba(${r}, ${g}, ${b}, ${alpha})`);
        root.style.setProperty('--border-accent', `rgba(${r}, ${g}, ${b}, ${Math.min(1, alpha + 0.15)})`);
    } else {
        document.body.setAttribute('data-border-mode', 'grad');
        const [r1, g1, b1] = preset.c1;
        const [r2, g2, b2] = preset.c2;
        if (preset.c3) {
            const [r3, g3, b3] = preset.c3;
            root.style.setProperty('--border-grad', `linear-gradient(135deg, rgba(${r1},${g1},${b1},${alpha}), rgba(${r2},${g2},${b2},${alpha}), rgba(${r3},${g3},${b3},${alpha}))`);
        } else {
            root.style.setProperty('--border-grad', `linear-gradient(135deg, rgba(${r1},${g1},${b1},${alpha}), rgba(${r2},${g2},${b2},${alpha}))`);
        }
        root.style.setProperty('--border-uniform', `rgba(${r1}, ${g1}, ${b1}, ${alpha * 0.75})`);
        root.style.setProperty('--border-main', `rgba(${r1}, ${g1}, ${b1}, ${alpha * 0.75})`);
    }

    window.unifyAllSettingCardsV37();
    window.syncThemeStudioUIV37();
};

var selectThemeBorderKeyV37 = window.selectThemeBorderKeyV37 = window.selectThemeBorderKeyV37 || function(){};

var onThemeAlphaInputV37 = window.onThemeAlphaInputV37 = window.onThemeAlphaInputV37 || function(){};

var onThemeAmoledToggleV37 = window.onThemeAmoledToggleV37 = window.onThemeAmoledToggleV37 || function(){};

var onThemeVolSliderToggleV37 = window.onThemeVolSliderToggleV37 = window.onThemeVolSliderToggleV37 || function(){};

window.resetVisualThemeV37 = function(ev) {
    window.appConfig = window.appConfig || {};
    window.appConfig.themeBorderKey = 'solid_purple';
    window.appConfig.themeBorderAlpha = 38;
    window.appConfig.amoledMode = true;
    window.appConfig.volSlider = true;
    const origAm = document.getElementById('cfg_amoledMode');
    if (origAm) origAm.checked = true;
    const origVol = document.getElementById('cfg_volSlider');
    if (origVol) origVol.checked = true;
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    if (typeof window.updateSettings === 'function') window.updateSettings();
    if (typeof window.applyTheme === 'function') window.applyTheme();
    window.applyVisualThemeV37();
    if (typeof window.showToast === 'function') {
        window.showToast(window.tr('🎨 Сброшено: Истинный AMOLED + Тёмный Аметист (38%)', '🎨 Reset: True AMOLED + Subtle Amethyst (38%)'), ev);
    }
};

window.syncThemeStudioUIV37 = function() {
    const cfg = window.appConfig || {};
    const activeKey = cfg.themeBorderKey || 'solid_purple';
    const alphaPct = (cfg.themeBorderAlpha !== undefined) ? cfg.themeBorderAlpha : 38;

    Object.keys(window.THEME_PRESETS_V37).forEach(k => {
        const chk = document.getElementById('chk_theme_' + k);
        if (chk) chk.checked = (k === activeKey);
    });

    const slider = document.getElementById('rng_theme_alpha');
    if (slider) slider.value = alphaPct;
    const lbl = document.getElementById('themeAlphaValLabel');
    if (lbl) lbl.innerText = alphaPct + '%';

    const amChk = document.getElementById('chk_theme_amoled');
    if (amChk) amChk.checked = (cfg.amoledMode !== false);
    const volChk = document.getElementById('chk_theme_vol');
    if (volChk) volChk.checked = (cfg.volSlider !== false);
};

window.openThemeStudioModalV37 = function() {
    window.ensureThemeStudioModalV37();
    window.syncThemeStudioUIV37();
    const sm = document.getElementById('settingsModal');
    const tm = document.getElementById('themeModal');
    if (sm) sm.classList.remove('open');
    if (tm) tm.classList.add('open');
    if (typeof window.updateTopSearchOrMonitorBar === 'function') window.updateTopSearchOrMonitorBar();
};

window.closeThemeStudioToSettingsV37 = function() {
    const tm = document.getElementById('themeModal');
    const sm = document.getElementById('settingsModal');
    if (tm) tm.classList.remove('open');
    if (sm) sm.classList.add('open');
    if (typeof window.updateTopSearchOrMonitorBar === 'function') window.updateTopSearchOrMonitorBar();
};

window.ensureThemeStudioModalV37 = function() {
    let tm = document.getElementById('themeModal');
    if (tm) tm.remove();

    tm = document.createElement('div');
    tm.id = 'themeModal';
    tm.className = 'modal-overlay';

    const buildPresetRows = (filterMode) => {
        return Object.entries(window.THEME_PRESETS_V37)
            .filter(([_, p]) => p.mode === filterMode)
            .map(([k, p]) => `
                <div class="setting-row" style="padding:8px 0;">
                    <label class="toggle-label" style="flex:1;display:flex;align-items:center;gap:8px;">
                        <input type="checkbox" id="chk_theme_${k}" onchange="window.selectThemeBorderKeyV37('${k}', event)">
                        <span class="theme-swatch-dot" style="background:${p.preview};"></span>
                        <span>${window.tr(p.ru, p.en)}</span>
                    </label>
                </div>
            `).join('');
    };

    tm.innerHTML = `
        <div class="container">
            <div style="display:flex;gap:8px;margin-bottom:12px;">
                <button type="button" onclick="window.closeThemeStudioToSettingsV37()" style="flex:1;padding:10px;background:#11161d;border:1px solid var(--border-uniform);color:#58a6ff;font-size:13px;">
                    ${window.tr('⬅ Назад в настройки', '⬅ Back to Settings')}
                </button>
                <button type="button" onclick="window.resetVisualThemeV37(event)" style="padding:10px 14px;background:#11161d;border:1px solid var(--border-uniform);color:#e3b341;font-size:12.5px;">
                    ${window.tr('🔄 Сброс', '🔄 Reset')}
                </button>
            </div>

            <div class="setting-row jenny-uniform-card" style="padding:10px 12px;border-radius:8px;margin-bottom:10px;">
                <label class="toggle-label" style="font-weight:bold;color:#e6edf3;">
                    <input type="checkbox" id="chk_theme_amoled" onchange="window.onThemeAmoledToggleV37(this)">
                    ${window.tr('🖤 Истинный AMOLED (#000000 во всех блоках)', '🖤 True AMOLED (100% #000000 Cards)')}
                </label>
            </div>

            <div class="setting-row jenny-uniform-card" style="padding:10px 12px;border-radius:8px;margin-bottom:12px;">
                <label class="toggle-label" style="font-weight:bold;color:#e6edf3;">
                    <input type="checkbox" id="chk_theme_vol" onchange="window.onThemeVolSliderToggleV37(this)">
                    ${window.tr('🔊 Показывать кнопку громкости на панели', '🔊 Show Volume Button on Transport Bar')}
                </label>
            </div>

            <details class="setting-group" open>
                <summary>${window.tr('💡 Тонкость и заметность рамок', '💡 Border Subtlety & Opacity')}</summary>
                <div class="group-content">
                    <div style="display:flex;justify-content:space-between;font-size:12.5px;color:#c9d1d9;margin-bottom:4px;">
                        <span>${window.tr('Яркость контура 1px (15% = еле видно):', '1px Contour Brightness (15% = Ghost):')}</span>
                        <span id="themeAlphaValLabel" style="color:#3fb950;font-weight:bold;">38%</span>
                    </div>
                    <input type="range" id="rng_theme_alpha" class="hz-slider" min="15" max="100" step="1" value="38" oninput="window.onThemeAlphaInputV37(this.value)">
                </div>
            </details>

            <details class="setting-group" open>
                <summary>${window.tr('🟣 Монохромные рамки (Единый цвет)', '🟣 Solid Thin Borders (Single Color)')}</summary>
                <div class="group-content">
                    <div style="font-size:11.5px;color:#8b949e;margin-bottom:6px;">
                        ${window.tr('Строго один стиль рамок для всех элементов плеера:', 'Uniform 1px border color across all player elements:')}
                    </div>
                    ${buildPresetRows('solid')}
                </div>
            </details>

            <details class="setting-group" open>
                <summary>${window.tr('🌌 Градиентные рамки (Взаимоисключающие)', '🌌 Gradient Thin Borders (Mutually Exclusive)')}</summary>
                <div class="group-content">
                    <div style="font-size:11.5px;color:#8b949e;margin-bottom:6px;">
                        ${window.tr('При выборе градиента монохромный цвет автоматически выключается:', 'Selecting a gradient automatically turns off solid colors:')}
                    </div>
                    ${buildPresetRows('grad')}
                </div>
            </details>
        </div>
    `;

    const mainWrap = document.getElementById('settingsModal') ? document.getElementById('settingsModal').parentElement : document.body;
    mainWrap.appendChild(tm);
};

window.mountThemeStudioButtonV37 = function() {
    const sm = document.getElementById('settingsModal');
    if (!sm) return;
    const topBarRow = document.getElementById('jennyTopBarRow');
    let btnRow = document.getElementById('jennyThemeStudioBtnRow');
    if (btnRow) btnRow.remove();

    btnRow = document.createElement('div');
    btnRow.id = 'jennyThemeStudioBtnRow';
    btnRow.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;align-items:center;';

    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.onclick = () => window.openThemeStudioModalV37();
    openBtn.style.cssText = 'flex:1;background:#0a0d12;border:1px solid var(--border-uniform);color:#e3b341;font-weight:bold;padding:11px;border-radius:8px;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;';
    openBtn.innerHTML = window.tr('🎨 РЕДАКТОР ТЕМ И РАМОК (AMOLED / ГРАДИЕНТЫ)', '🎨 THEME & BORDER STUDIO (AMOLED / GRADIENTS)');

    btnRow.appendChild(openBtn);
    btnRow.appendChild(window.makeHelpBadge('theme_studio'));

    if (topBarRow) {
        topBarRow.insertAdjacentElement('afterend', btnRow);
    } else {
        const container = sm.querySelector('.container') || sm;
        container.insertBefore(btnRow, container.firstChild);
    }

    window.ensureThemeStudioModalV37();
    window.applyVisualThemeV37();
};

const _origMountUI_V37 = window.mountJennyStudioUI;
window.mountJennyStudioUI = function() {
    _origMountUI_V37();
    window.mountThemeStudioButtonV37();
};

// Если кто-то открывает другое модальное окно (⚙️, 🄠, ❤️), закрываем themeModal
;(function() {
    const origToggleModal = window.toggleModal;
    if (typeof origToggleModal === 'function' && !window._toggleModalWrappedV37) {
        window._toggleModalWrappedV37 = true;
        window.toggleModal = function(modalId) {
            const tm = document.getElementById('themeModal');
            if (tm && tm.classList.contains('open') && modalId === 'settingsModal') {
                tm.classList.remove('open');
                return;
            }
            if (tm) tm.classList.remove('open');
            return origToggleModal(modalId);
        };
    }
})();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(window.mountThemeStudioButtonV37, 120));
} else {
    setTimeout(window.mountThemeStudioButtonV37, 120);
}


// 🎨 ПАТЧ V38: THEME STUDIO 1.1 (ГРУППИРОВКА ДЕТАЛЕЙ + JSON ИМПОРТ/ЭКСПОРТ)

window.DEFAULT_THEME_CONFIG_V38 = {
    amoledMode: true,
    volSlider: true,
    themeBorderKey: 'solid_purple',
    themeBorderAlpha: 38,
    bgColor: '#000000',
    resetBtnColor: '#e3b341',
    ioBtnColor: '#7341be',
    checkboxColor: '#3fb950',
    sliderColor: '#58a6ff',
    transportColor: '#a371f7'
};

window.FULL_THEME_PACKS_V38 = {
    amethyst_amoled: {
        ru: '🟣 Тёмный Аметист (Эталон AMOLED)', en: '🟣 Subtle Amethyst (Default AMOLED)',
        amoledMode: true, themeBorderKey: 'solid_purple', themeBorderAlpha: 38, bgColor: '#000000',
        resetBtnColor: '#e3b341', ioBtnColor: '#7341be', checkboxColor: '#3fb950', sliderColor: '#58a6ff', transportColor: '#a371f7'
    },
    cyber_matrix: {
        ru: '🟢 Неоновая Матрица (Изумруд + Циан)', en: '🟢 Neon Matrix (Emerald + Cyan)',
        amoledMode: true, themeBorderKey: 'grad_matrix', themeBorderAlpha: 52, bgColor: '#000000',
        resetBtnColor: '#3fb950', ioBtnColor: '#3fb950', checkboxColor: '#58a6ff', sliderColor: '#3fb950', transportColor: '#3fb950'
    },
    synth_sunset: {
        ru: '🌅 Кибер-Закат (Золото + Пурпур)', en: '🌅 Cyber Sunset (Gold + Purple)',
        amoledMode: true, themeBorderKey: 'grad_sunset', themeBorderAlpha: 55, bgColor: '#000000',
        resetBtnColor: '#f85149', ioBtnColor: '#e3b341', checkboxColor: '#e3b341', sliderColor: '#a371f7', transportColor: '#e3b341'
    },
    ruby_stealth: {
        ru: '🔴 Хищный Рубин (Стелс-Контур)', en: '🔴 Predator Ruby (Stealth Contour)',
        amoledMode: true, themeBorderKey: 'solid_ruby', themeBorderAlpha: 42, bgColor: '#000000',
        resetBtnColor: '#f85149', ioBtnColor: '#f85149', checkboxColor: '#f85149', sliderColor: '#f85149', transportColor: '#da3633'
    }
};

window.hexToRgbaV38 = function(hex, alpha) {
    let c = String(hex || '#7341be').replace('#', '').trim();
    if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    const num = parseInt(c, 16);
    if (isNaN(num)) return `rgba(115, 65, 190, ${alpha})`;
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
};

// Автоматически помечает все кнопки "Сброс / Reset" единым классом .jenny-reset-btn
window.tagUniformResetButtonsV38 = function() {
    document.querySelectorAll('button').forEach(btn => {
        const txt = (btn.innerText || '').trim();
        if (txt.includes('Сброс') || txt.includes('Reset')) {
            btn.classList.add('jenny-reset-btn');
        }
    });
};

var getCurrentThemeObjectV38 = window.getCurrentThemeObjectV38 = window.getCurrentThemeObjectV38 || function(){};

var applyGroupColorsV38 = window.applyGroupColorsV38 = window.applyGroupColorsV38 || function(){};

// Перехватываем applyVisualThemeV37, чтобы он всегда применял и групповые цвета V38
const _origApplyThemeV37 = window.applyVisualThemeV37;
window.applyVisualThemeV37 = function() {
    if (typeof _origApplyThemeV37 === 'function') _origApplyThemeV37();
    window.applyGroupColorsV38();
};

var onGroupColorInputV38 = window.onGroupColorInputV38 = window.onGroupColorInputV38 || function(){};

window.applyFullThemePackV38 = function(packKey, ev) {
    const pack = window.FULL_THEME_PACKS_V38[packKey];
    if (!pack) return;
    window.appConfig = window.appConfig || {};
    Object.keys(window.DEFAULT_THEME_CONFIG_V38).forEach(k => {
        if (pack[k] !== undefined) window.appConfig[k] = pack[k];
    });
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    window.applyVisualThemeV37();
    window.syncThemeStudioUIV38();
    if (typeof window.saveConfigToDisk === 'function') window.saveConfigToDisk();
    if (typeof window.showToast === 'function') {
        window.showToast(window.tr('✅ Пакет темы применён!', '✅ Theme pack applied!'), ev);
    }
};

window.applyThemeFromJsonObjV38 = function(obj, ev) {
    if (!obj || typeof obj !== 'object') return false;
    window.appConfig = window.appConfig || {};
    Object.keys(window.DEFAULT_THEME_CONFIG_V38).forEach(k => {
        if (obj[k] !== undefined) window.appConfig[k] = obj[k];
    });
    const origAm = document.getElementById('cfg_amoledMode');
    if (origAm && obj.amoledMode !== undefined) origAm.checked = Boolean(obj.amoledMode);
    const origVol = document.getElementById('cfg_volSlider');
    if (origVol && obj.volSlider !== undefined) origVol.checked = Boolean(obj.volSlider);

    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    if (typeof window.applyTheme === 'function') window.applyTheme();
    window.applyVisualThemeV37();
    window.syncThemeStudioUIV38();
    if (typeof window.saveConfigToDisk === 'function') window.saveConfigToDisk();
    if (typeof window.showToast === 'function') {
        window.showToast(window.tr('🎨 Тема из JSON успешно загружена!', '🎨 JSON Theme successfully loaded!'), ev);
    }
    return true;
};

window.copyThemeJsonToClipboardV38 = async function(ev) {
    const jsonStr = JSON.stringify(window.getCurrentThemeObjectV38(), null, 2);
    const box = document.getElementById('themeJsonTextarea');
    if (box) box.value = jsonStr;
    try {
        await navigator.clipboard.writeText(jsonStr);
        if (typeof window.showToast === 'function') {
            window.showToast(window.tr('📋 JSON темы скопирован в буфер!', '📋 Theme JSON copied to clipboard!'), ev);
        }
    } catch (e) {
        if (box) { box.select(); document.execCommand('copy'); }
        if (typeof window.showToast === 'function') {
            window.showToast(window.tr('📋 JSON выделен и скопирован!', '📋 JSON selected & copied!'), ev);
        }
    }
};

var applyThemeFromTextareaV38 = window.applyThemeFromTextareaV38 = window.applyThemeFromTextareaV38 || function(){};

var downloadThemeJsonFileV38 = window.downloadThemeJsonFileV38 = window.downloadThemeJsonFileV38 || function(){};

window.onThemeJsonFilePickedV38 = function(inputEl, ev) {
    const file = inputEl && inputEl.files && inputEl.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = JSON.parse(String(e.target.result || ''));
            const box = document.getElementById('themeJsonTextarea');
            if (box) box.value = JSON.stringify(parsed);
            window.applyThemeFromJsonObjV38(parsed, ev);
        } catch (err) {
            if (typeof window.showToast === 'function') {
                window.showToast(window.tr('❌ Файл повреждён или не является JSON!', '❌ Corrupted or invalid JSON file!'), ev);
            }
        }
    };
    reader.readAsText(file);
};

window.syncThemeStudioUIV38 = function() {
    if (typeof window.syncThemeStudioUIV37 === 'function') window.syncThemeStudioUIV37();
    const t = window.getCurrentThemeObjectV38();
    const map = {
        'clr_theme_reset': t.resetBtnColor,
        'clr_theme_io': t.ioBtnColor,
        'clr_theme_chk': t.checkboxColor,
        'clr_theme_slider': t.sliderColor,
        'clr_theme_transport': t.transportColor,
        'clr_theme_bg': t.bgColor
    };
    for (const [id, val] of Object.entries(map)) {
        const el = document.getElementById(id);
        if (el) el.value = val;
    }
    const box = document.getElementById('themeJsonTextarea');
    if (box) box.value = JSON.stringify(t);
};

const _origResetThemeV37 = window.resetVisualThemeV37;
window.resetVisualThemeV37 = function(ev) {
    window.appConfig = window.appConfig || {};
    Object.assign(window.appConfig, window.DEFAULT_THEME_CONFIG_V38);
    if (typeof _origResetThemeV37 === 'function') _origResetThemeV37(ev);
    window.syncThemeStudioUIV38();
};

const _origEnsureModalV37 = window.ensureThemeStudioModalV37;
window.ensureThemeStudioModalV37 = function() {
    _origEnsureModalV37();
    const tm = document.getElementById('themeModal');
    if (!tm) return;
    const container = tm.querySelector('.container') || tm;
    if (document.getElementById('themeGroupsSectionV38')) return;

    const extraHTML = document.createElement('div');
    extraHTML.id = 'themeGroupsSectionV38';
    extraHTML.innerHTML = `
        <details class="setting-group" open>
            <summary>${window.tr('🎛️ Единые группы деталей (Синхронный окрас)', '🎛️ Unified Component Groups (Sync Color)')}</summary>
            <div class="group-content">
                <div class="setting-row" style="padding:7px 0;">
                    <span style="font-size:12.5px;color:#e6edf3;">${window.tr('🔄 Все кнопки «Сброс»:', '🔄 All "Reset" Buttons:')}</span>
                    <input type="color" id="clr_theme_reset" class="theme-color-picker" value="#e3b341" oninput="window.onGroupColorInputV38('resetBtnColor', this.value)">
                </div>
                <div class="setting-row" style="padding:7px 0;">
                    <span style="font-size:12.5px;color:#e6edf3;">${window.tr('📥/💾 Кнопки памяти строк:', '📥/💾 Row Memory Buttons:')}</span>
                    <input type="color" id="clr_theme_io" class="theme-color-picker" value="#7341be" oninput="window.onGroupColorInputV38('ioBtnColor', this.value)">
                </div>
                <div class="setting-row" style="padding:7px 0;">
                    <span style="font-size:12.5px;color:#e6edf3;">${window.tr('☑️ Галочки и активные статусы:', '☑️ Checkboxes & Active Badges:')}</span>
                    <input type="color" id="clr_theme_chk" class="theme-color-picker" value="#3fb950" oninput="window.onGroupColorInputV38('checkboxColor', this.value)">
                </div>
                <div class="setting-row" style="padding:7px 0;">
                    <span style="font-size:12.5px;color:#e6edf3;">${window.tr('🎚️ Ползунки и кружки справки ❓:', '🎚️ Sliders & Help Badges ❓:')}</span>
                    <input type="color" id="clr_theme_slider" class="theme-color-picker" value="#58a6ff" oninput="window.onGroupColorInputV38('sliderColor', this.value)">
                </div>
                <div class="setting-row" style="padding:7px 0;">
                    <span style="font-size:12.5px;color:#e6edf3;">${window.tr('▶️ Кнопки Play и Перемотка:', '▶️ Play & Seek Triangles:')}</span>
                    <input type="color" id="clr_theme_transport" class="theme-color-picker" value="#a371f7" oninput="window.onGroupColorInputV38('transportColor', this.value)">
                </div>
                <div class="setting-row" style="padding:7px 0;border:none;">
                    <span style="font-size:12.5px;color:#e6edf3;">${window.tr('🌑 Оттенок фона (если выкл. AMOLED):', '🌑 Custom Background (if AMOLED off):')}</span>
                    <input type="color" id="clr_theme_bg" class="theme-color-picker" value="#000000" oninput="window.onGroupColorInputV38('bgColor', this.value)">
                </div>
            </div>
        </details>

        <details class="setting-group" open>
            <summary>${window.tr('⚡ Готовые сборки тем в 1 клик', '⚡ One-Click Full Theme Packs')}</summary>
            <div class="group-content" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <button type="button" onclick="window.applyFullThemePackV38('amethyst_amoled', event)" style="padding:8px;">🟣 Amethyst</button>
                <button type="button" onclick="window.applyFullThemePackV38('cyber_matrix', event)" style="padding:8px;">🟢 Matrix</button>
                <button type="button" onclick="window.applyFullThemePackV38('synth_sunset', event)" style="padding:8px;">🌅 Sunset</button>
                <button type="button" onclick="window.applyFullThemePackV38('ruby_stealth', event)" style="padding:8px;">🔴 Ruby</button>
            </div>
        </details>

        <details class="setting-group" open>
            <summary>${window.tr('📦 Импорт и Экспорт темы (JSON)', '📦 Theme Import & Export (JSON)')}</summary>
            <div class="group-content">
                <div style="font-size:11.5px;color:#8b949e;margin-bottom:6px;">
                    ${window.tr('Скопируй JSON-код, чтобы поделиться темой, или вставь чужой код сюда:', 'Copy JSON code to share your theme, or paste a JSON string below:')}
                </div>
                <textarea id="themeJsonTextarea" rows="3" style="width:100%;box-sizing:border-box;background:#000;color:#3fb950;border:1px solid var(--border-uniform);border-radius:6px;padding:8px;font-family:monospace;font-size:11px;margin-bottom:8px;resize:vertical;"></textarea>
                <div style="display:flex;gap:6px;margin-bottom:8px;">
                    <button type="button" onclick="window.copyThemeJsonToClipboardV38(event)" style="flex:1;padding:8px;">${window.tr('📋 Копировать JSON', '📋 Copy JSON')}</button>
                    <button type="button" onclick="window.applyThemeFromTextareaV38(event)" style="flex:1;padding:8px;color:#3fb950;">${window.tr('✅ Применить JSON', '✅ Apply JSON')}</button>
                </div>
                <div style="display:flex;gap:6px;">
                    <button type="button" onclick="window.downloadThemeJsonFileV38(event)" style="flex:1;padding:8px;">${window.tr('💾 Скачать .json', '💾 Save .json')}</button>
                    <button type="button" onclick="document.getElementById('themeJsonFileInput').click()" style="flex:1;padding:8px;">${window.tr('📂 Открыть .json', '📂 Load .json')}</button>
                    <input type="file" id="themeJsonFileInput" accept=".json,application/json" style="display:none;" onchange="window.onThemeJsonFilePickedV38(this, event)">
                </div>
            </div>
        </details>
    `;
    container.appendChild(extraHTML);
    window.syncThemeStudioUIV38();
};

setTimeout(() => {
    window.ensureThemeStudioModalV37();
    window.applyVisualThemeV37();
}, 180);


// 🚀 ПАТЧ V39: СТЫКОВКА RU/EN В НАСТРОЙКАХ, НЕПОЛНЫЙ JSON С БЛИЖАЙШИМ ЦВЕТОМ И ЧЕСТНЫЕ ФАЙЛЫ .JSON

window.STANDARD_PALETTE_V39 = [
    { hex: '#7341be', nameRu: 'Тёмный Аметист', nameEn: 'Subtle Amethyst' },
    { hex: '#a371f7', nameRu: 'Неоновый Пурпур', nameEn: 'Neon Purple' },
    { hex: '#58a6ff', nameRu: 'Кибер-Циан',     nameEn: 'Cyber Cyan' },
    { hex: '#3fb950', nameRu: 'Изумруд',        nameEn: 'Matrix Emerald' },
    { hex: '#e3b341', nameRu: 'Золотой Винил',  nameEn: 'Vinyl Gold' },
    { hex: '#f85149', nameRu: 'Рубиновый Лазер',nameEn: 'Ruby Laser' },
    { hex: '#da3633', nameRu: 'Алый Драйв',     nameEn: 'Crimson Drive' },
    { hex: '#6e7681', nameRu: 'Стелс-Графит',   nameEn: 'Stealth Graphite' },
    { hex: '#000000', nameRu: 'Чистый AMOLED',  nameEn: 'Pure AMOLED' },
    { hex: '#0d1117', nameRu: 'Тёмная Полночь', nameEn: 'Dark Midnight' }
];

window.FIELD_LABELS_V39 = {
    amoledMode:       { ru: 'Режим AMOLED',       en: 'AMOLED Mode' },
    volSlider:        { ru: 'Кнопка громкости',   en: 'Volume Button' },
    themeBorderKey:   { ru: 'Стиль рамок',        en: 'Border Style' },
    themeBorderAlpha: { ru: 'Яркость рамок',      en: 'Border Opacity' },
    bgColor:          { ru: 'Оттенок фона',       en: 'Background Color' },
    resetBtnColor:    { ru: 'Кнопки «Сброс»',     en: 'Reset Buttons' },
    ioBtnColor:       { ru: 'Кнопки памяти 📥/💾',en: 'Memory Buttons' },
    checkboxColor:    { ru: 'Галочки',            en: 'Checkboxes' },
    sliderColor:      { ru: 'Ползунки и ❓',       en: 'Sliders & ❓' },
    transportColor:   { ru: 'Кнопки Play/Перемотка', en: 'Play & Triangles' }
};

window.parseHexToRgbV39 = function(hex) {
    let c = String(hex || '').replace('#', '').trim();
    if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    if (!/^[0-9a-fA-F]{6}$/.test(c)) return null;
    const n = parseInt(c, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

var findNearestStandardColorV39 = window.findNearestStandardColorV39 = window.findNearestStandardColorV39 || function(){};

// 2. УМНЫЙ ПАРСЕР НЕПОЛНОГО ИЛИ ОБОРВАННОГО JSON С АВТОПОДБОРОМ БЛИЖАЙШЕГО ЦВЕТА
window.salvagePartialJsonV39 = function(rawText) {
    let txt = String(rawText || '').trim();
    if (!txt) return null;

    // Попытка 1: чистый JSON.parse
    try {
        const obj = JSON.parse(txt);
        if (obj && typeof obj === 'object') return obj;
    } catch (e) {}

    // Попытка 2: чиним оборванный конец (запятые, незакрытые кавычки и фигурную скобку)
    let fixed = txt.replace(/,\s*$/, '');
    if (!fixed.startsWith('{')) fixed = '{' + fixed;
    const quoteCount = (fixed.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) fixed += '"';
    fixed = fixed.replace(/,\s*\}/g, '}');
    if (!fixed.endsWith('}')) fixed += '}';
    try {
        const obj = JSON.parse(fixed);
        if (obj && typeof obj === 'object') return obj;
    } catch (e) {}

    // Попытка 3: Построчное вытаскивание всех распознаваемых пар ключ-значение регулярками
    const extracted = {};
    const kvRegex = /"?([a-zA-Z0-9_]+)"?\s*:\s*("[^"]*"|true|false|-?\d+(?:\.\d+)?|#[0-9a-fA-F]{3,6})/g;
    let m;
    while ((m = kvRegex.exec(txt)) !== null) {
        const k = m[1];
        let v = m[2];
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
        else if (v === 'true') v = true;
        else if (v === 'false') v = false;
        else if (!v.startsWith('#') && !isNaN(Number(v))) v = Number(v);
        extracted[k] = v;
    }
    return Object.keys(extracted).length > 0 ? extracted : null;
};

window.applySmartPartialThemeV39 = function(rawObj, ev) {
    if (!rawObj || typeof rawObj !== 'object') return false;

    const defaults = window.DEFAULT_THEME_CONFIG_V38;
    const colorKeys = ['resetBtnColor', 'ioBtnColor', 'checkboxColor', 'sliderColor', 'transportColor', 'bgColor'];
    const allKeys = ['amoledMode', 'volSlider', 'themeBorderKey', 'themeBorderAlpha', ...colorKeys];

    // Находим любой валидный цвет внутри присланного JSON, чтобы искать ближайший стандартный оттенок к задумке автора
    let referenceHex = null;
    for (const ck of colorKeys) {
        if (rawObj[ck] && window.parseHexToRgbV39(rawObj[ck])) {
            referenceHex = rawObj[ck];
            break;
        }
    }

    const missingRu = [];
    const missingEn = [];
    const finalTheme = { jenny_theme_v: "1.1" };
    let usedNearestNameRu = null;
    let usedNearestNameEn = null;

    allKeys.forEach(k => {
        const isProvided = (rawObj[k] !== undefined && rawObj[k] !== null && rawObj[k] !== '');
        if (isProvided) {
            if (colorKeys.includes(k)) {
                // Если цвет указан криво, подбираем ближайший стандартный
                if (window.parseHexToRgbV39(rawObj[k])) {
                    finalTheme[k] = rawObj[k];
                } else {
                    const near = window.findNearestStandardColorV39(referenceHex, defaults[k]);
                    finalTheme[k] = near.hex;
                }
            } else {
                finalTheme[k] = rawObj[k];
            }
        } else {
            // Поле НЕ дописано в JSON!
            const lbl = window.FIELD_LABELS_V39[k] || { ru: k, en: k };
            missingRu.push(lbl.ru);
            missingEn.push(lbl.en);

            if (colorKeys.includes(k)) {
                const near = window.findNearestStandardColorV39(referenceHex, defaults[k]);
                finalTheme[k] = near.hex;
                if (!usedNearestNameRu) {
                    usedNearestNameRu = near.nameRu + ' (' + near.hex + ')';
                    usedNearestNameEn = near.nameEn + ' (' + near.hex + ')';
                }
            } else {
                finalTheme[k] = defaults[k];
            }
        }
    });

    window.appConfig = window.appConfig || {};
    Object.assign(window.appConfig, finalTheme);

    const origAm = document.getElementById('cfg_amoledMode');
    if (origAm) origAm.checked = Boolean(finalTheme.amoledMode);
    const origVol = document.getElementById('cfg_volSlider');
    if (origVol) origVol.checked = Boolean(finalTheme.volSlider);

    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    if (typeof window.applyTheme === 'function') window.applyTheme();
    window.applyVisualThemeV37();
    window.syncThemeStudioUIV38();
    if (typeof window.saveConfigToDisk === 'function') window.saveConfigToDisk();

    const reportBox = document.getElementById('themeJsonReportBox');
    if (missingRu.length === 0) {
        if (reportBox) {
            reportBox.style.display = 'block';
            reportBox.style.borderColor = '#3fb950';
            reportBox.innerHTML = window.tr('✅ Все параметры JSON распознаны и применены в полном объёме!', '✅ All JSON parameters recognized and applied!');
        }
        if (typeof window.showToast === 'function') {
            window.showToast(window.tr('✅ Полный JSON темы применён!', '✅ Full Theme JSON applied!'), ev);
        }
    } else {
        const msgRu = `⚠️ В JSON не дописаны: <b>${missingRu.join(', ')}</b>.<br>🎨 Применено то, что есть + подставлен ближайший стандартный цвет: <b style="color:#3fb950;">${usedNearestNameRu || 'Тёмный Аметист'}</b>`;
        const msgEn = `⚠️ Missing in JSON: <b>${missingEn.join(', ')}</b>.<br>🎨 Applied provided fields + nearest standard color: <b style="color:#3fb950;">${usedNearestNameEn || 'Subtle Amethyst'}</b>`;
        if (reportBox) {
            reportBox.style.display = 'block';
            reportBox.style.borderColor = '#e3b341';
            reportBox.innerHTML = window.tr(msgRu, msgEn);
        }
        if (typeof window.showToast === 'function') {
            window.showToast(window.tr(`⚠️ Не указано (${missingRu.length}): подставлен ближайший стандартный цвет!`, `⚠️ Missing (${missingEn.length}): nearest standard color applied!`), ev);
        }
    }
    return finalTheme;
};

// Переопределяем кнопку "✅ Применить JSON"
window.applyThemeFromTextareaV38 = function(ev) {
    const box = document.getElementById('themeJsonTextarea');
    const raw = box ? box.value.trim() : '';
    const reportBox = document.getElementById('themeJsonReportBox');

    if (!raw) {
        if (reportBox) {
            reportBox.style.display = 'block';
            reportBox.style.borderColor = '#f85149';
            reportBox.innerHTML = window.tr('⚠️ Поле пустое (0 байт)! Вставь JSON-код темы или нажми «Копировать JSON».', '⚠️ Field is empty (0 bytes)! Paste a JSON theme or tap "Copy JSON".');
        }
        if (typeof window.showToast === 'function') {
            window.showToast(window.tr('⚠️ Поле пустое (0 байт)! Нечего применять.', '⚠️ Field is empty (0 bytes)!'), ev);
        }
        return;
    }

    const salvaged = window.salvagePartialJsonV39(raw);
    if (!salvaged) {
        if (reportBox) {
            reportBox.style.display = 'block';
            reportBox.style.borderColor = '#f85149';
            reportBox.innerHTML = window.tr('❌ В тексте нет ни одного параметра темы (например, "sliderColor": "#58a6ff").', '❌ No recognizable theme fields found in text.');
        }
        if (typeof window.showToast === 'function') {
            window.showToast(window.tr('❌ Не найдено параметров темы в тексте!', '❌ No theme parameters found!'), ev);
        }
        return;
    }

    const fullApplied = window.applySmartPartialThemeV39(salvaged, ev);
    if (box && fullApplied) {
        box.value = JSON.stringify(fullApplied, null, 2);
    }
};

// 3. ЧЕСТНОЕ СОХРАНЕНИЕ И ОТКРЫТИЕ ФАЙЛОВ .JSON ЧЕРЕЗ PYTHON БЭКЕНД
/* [CLEANED: downloadThemeJsonFileV38] */

var openSavedThemesModalV39 = window.openSavedThemesModalV39 = window.openSavedThemesModalV39 || function(){};

window.pickSavedThemeFileByIndexV39 = function(idx, ev) {
    const files = window._loadedThemeFilesCacheV39 || [];
    const item = files[idx];
    if (!item) return;
    const box = document.getElementById('themeJsonTextarea');
    if (box) box.value = item.content;
    const modal = document.getElementById('jennyThemeFilesModal');
    if (modal) modal.remove();
    window.applyThemeFromTextareaV38(ev);
};

// 4. ВСТРОЕННАЯ ПАЛИТРА ЦВЕТА (БЕЗ ЧЁРНОГО ЭКРАНА WEBVIEW)
window.openCustomColorSwatchesV39 = function(propKey, btnEl) {
    let m = document.getElementById('jennyQuickColorModal');
    if (m) m.remove();

    const curHex = (window.appConfig && window.appConfig[propKey]) ? window.appConfig[propKey] : '#7341be';
    m = document.createElement('div');
    m.id = 'jennyQuickColorModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.8);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;';
    m.onclick = (e) => { if (e.target === m) m.remove(); };

    const swatchesHTML = window.STANDARD_PALETTE_V39.map(p => `
        <button type="button" onclick="window.selectCustomSwatchV39('${propKey}', '${p.hex}')" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#0d1117;border:1px solid ${p.hex};border-radius:8px;color:#e6edf3;justify-content:flex-start;">
            <span style="width:16px;height:16px;border-radius:50%;background:${p.hex};display:inline-block;border:1px solid #fff;"></span>
            <span style="font-size:12px;">${window.tr(p.nameRu, p.nameEn)}</span>
        </button>
    `).join('');

    m.innerHTML = `
        <div onclick="event.stopPropagation()" style="background:#05070a;border:1px solid var(--border-uniform);border-radius:14px;max-width:380px;width:100%;padding:14px;box-shadow:0 0 24px rgba(0,0,0,0.95);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <span style="color:#58a6ff;font-weight:bold;font-size:13.5px;">🎨 ${window.tr('Выбери цвет группы', 'Select Group Color')}</span>
                <button type="button" onclick="document.getElementById('jennyQuickColorModal').remove()" style="background:transparent;border:none;color:#8b949e;font-size:16px;">✖</button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:10px;">
                ${swatchesHTML}
            </div>
            <div style="display:flex;gap:6px;align-items:center;">
                <span style="font-size:12px;color:#8b949e;">HEX:</span>
                <input type="text" id="customHexInputV39" value="${curHex}" style="flex:1;padding:6px;" placeholder="#7341be">
                <button type="button" onclick="window.selectCustomSwatchV39('${propKey}', document.getElementById('customHexInputV39').value)" style="padding:6px 12px;color:#3fb950;">OK</button>
            </div>
        </div>
    `;
    document.body.appendChild(m);
};

window.selectCustomSwatchV39 = function(propKey, hexVal) {
    if (!window.parseHexToRgbV39(hexVal)) {
        const near = window.findNearestStandardColorV39(hexVal, '#7341be');
        hexVal = near.hex;
    }
    window.onGroupColorInputV38(propKey, hexVal);
    window.syncThemeStudioUIV38();
    const m = document.getElementById('jennyQuickColorModal');
    if (m) m.remove();
};

// Заменяем глючные <input type="color"> на аккуратные цветные кнопки и обновляем кнопки JSON
window.upgradeThemeModalControlsV39 = function() {
    const colorMap = [
        ['clr_theme_reset', 'resetBtnColor'],
        ['clr_theme_io', 'ioBtnColor'],
        ['clr_theme_chk', 'checkboxColor'],
        ['clr_theme_slider', 'sliderColor'],
        ['clr_theme_transport', 'transportColor'],
        ['clr_theme_bg', 'bgColor']
    ];
    const t = window.getCurrentThemeObjectV38();
    colorMap.forEach(([id, propKey]) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.tagName === 'INPUT') {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = id;
            btn.className = 'jenny-color-btn';
            btn.style.background = t[propKey] || '#7341be';
            btn.onclick = () => window.openCustomColorSwatchesV39(propKey, btn);
            el.replaceWith(btn);
        } else {
            el.style.background = t[propKey] || '#7341be';
        }
    });

    // Добавляем блок отчёта под текстовым полем JSON
    const box = document.getElementById('themeJsonTextarea');
    if (box && !document.getElementById('themeJsonReportBox')) {
        const rep = document.createElement('div');
        rep.id = 'themeJsonReportBox';
        rep.style.cssText = 'display:none;background:#0d1117;border:1px solid #3fb950;border-radius:6px;padding:8px 10px;font-size:11.5px;color:#e6edf3;margin-bottom:8px;line-height:1.4;';
        box.insertAdjacentElement('afterend', rep);
    }

    // Привязываем кнопку "📂 Открыть .json" к нашему менеджеру файлов
    const fileInp = document.getElementById('themeJsonFileInput');
    if (fileInp && fileInp.previousElementSibling) {
        const openBtn = fileInp.previousElementSibling;
        openBtn.onclick = (e) => window.openSavedThemesModalV39(e);
    }
};

const _origSyncUIV38 = window.syncThemeStudioUIV38;
window.syncThemeStudioUIV38 = function() {
    if (typeof _origSyncUIV38 === 'function') _origSyncUIV38();
    window.upgradeThemeModalControlsV39();
};

setTimeout(() => {
    window.syncSettingsLangBtnVisibilityV39(false);
    window.upgradeThemeModalControlsV39();
}, 220);


// 🔇 ПАТЧ V40: ИЗОЛЯЦИЯ ТЕМ ОТ ЗВУКА + ДУБЛИРОВАНИЕ ФАЙЛОВ .JSON В ПАМЯТИ
window._themeSaveDebounceTimer = null;

var saveThemeOnlyQuietlyV40 = window.saveThemeOnlyQuietlyV40 = window.saveThemeOnlyQuietlyV40 || function(){};

// Применение темы меняет ТОЛЬКО CSS-переменные, вообще не трогая аудио-движок
window.applyVisualThemeV37 = function() {
    window.appConfig = window.appConfig || {};
    const key = window.appConfig.themeBorderKey || 'solid_purple';
    const alphaPct = (window.appConfig.themeBorderAlpha !== undefined) ? parseInt(window.appConfig.themeBorderAlpha, 10) : 38;
    const alpha = Math.max(0.1, Math.min(1.0, alphaPct / 100));

    const preset = window.THEME_PRESETS_V37[key] || window.THEME_PRESETS_V37.solid_purple;
    const root = document.documentElement;

    if (preset.mode === 'solid') {
        document.body.setAttribute('data-border-mode', 'solid');
        const [r, g, b] = preset.rgb;
        root.style.setProperty('--border-uniform', `rgba(${r}, ${g}, ${b}, ${alpha})`);
        root.style.setProperty('--border-main', `rgba(${r}, ${g}, ${b}, ${alpha})`);
        root.style.setProperty('--border-accent', `rgba(${r}, ${g}, ${b}, ${Math.min(1, alpha + 0.15)})`);
    } else {
        document.body.setAttribute('data-border-mode', 'grad');
        const [r1, g1, b1] = preset.c1;
        const [r2, g2, b2] = preset.c2;
        if (preset.c3) {
            const [r3, g3, b3] = preset.c3;
            root.style.setProperty('--border-grad', `linear-gradient(135deg, rgba(${r1},${g1},${b1},${alpha}), rgba(${r2},${g2},${b2},${alpha}), rgba(${r3},${g3},${b3},${alpha}))`);
        } else {
            root.style.setProperty('--border-grad', `linear-gradient(135deg, rgba(${r1},${g1},${b1},${alpha}), rgba(${r2},${g2},${b2},${alpha}))`);
        }
        root.style.setProperty('--border-uniform', `rgba(${r1}, ${g1}, ${b1}, ${alpha * 0.75})`);
        root.style.setProperty('--border-main', `rgba(${r1}, ${g1}, ${b1}, ${alpha * 0.75})`);
    }

    if (typeof window.applyGroupColorsV38 === 'function') {
        window.applyGroupColorsV38();
    }
};

/* [CLEANED: applyGroupColorsV38] */

window.onThemeAmoledToggleV37 = function(chk) {
    const isAm = Boolean(chk && chk.checked);
    window.appConfig = window.appConfig || {};
    window.appConfig.amoledMode = isAm;
    const orig = document.getElementById('cfg_amoledMode');
    if (orig) orig.checked = isAm;
    if (isAm) {
        document.body.setAttribute('data-theme', 'amoled');
        document.body.removeAttribute('data-bg-preset');
    } else {
        document.body.removeAttribute('data-theme');
    }
    window.applyVisualThemeV37();
    window.saveThemeOnlyQuietlyV40();
};

window.onThemeVolSliderToggleV37 = function(chk) {
    const showVol = Boolean(chk && chk.checked);
    window.appConfig = window.appConfig || {};
    window.appConfig.volSlider = showVol;
    const orig = document.getElementById('cfg_volSlider');
    if (orig) orig.checked = showVol;
    if (typeof window.applyTheme === 'function') window.applyTheme();
    window.saveThemeOnlyQuietlyV40();
};

window.onThemeAlphaInputV37 = function(val) {
    window.appConfig = window.appConfig || {};
    window.appConfig.themeBorderAlpha = parseInt(val, 10) || 38;
    const lbl = document.getElementById('themeAlphaValLabel');
    if (lbl) lbl.innerText = window.appConfig.themeBorderAlpha + '%';
    window.applyVisualThemeV37();
    window.saveThemeOnlyQuietlyV40();
};

window.selectThemeBorderKeyV37 = function(newKey, ev) {
    window.appConfig = window.appConfig || {};
    window.appConfig.themeBorderKey = newKey;
    window.applyVisualThemeV37();
    window.syncThemeStudioUIV37();
    window.saveThemeOnlyQuietlyV40();
};

window.onGroupColorInputV38 = function(propKey, hexVal) {
    window.appConfig = window.appConfig || {};
    window.appConfig[propKey] = hexVal;
    if (propKey === 'bgColor' && hexVal !== '#000000') {
        window.appConfig.amoledMode = false;
        document.body.removeAttribute('data-theme');
        const amChk = document.getElementById('chk_theme_amoled');
        if (amChk) amChk.checked = false;
    }
    window.applyVisualThemeV37();
    window.saveThemeOnlyQuietlyV40();
};

window.resetVisualThemeV37 = function(ev) {
    window.appConfig = window.appConfig || {};
    Object.assign(window.appConfig, window.DEFAULT_THEME_CONFIG_V38);
    const origAm = document.getElementById('cfg_amoledMode');
    if (origAm) origAm.checked = true;
    const origVol = document.getElementById('cfg_volSlider');
    if (origVol) origVol.checked = true;
    document.body.setAttribute('data-theme', 'amoled');
    document.body.removeAttribute('data-bg-preset');
    window.applyVisualThemeV37();
    window.syncThemeStudioUIV38();
    window.saveThemeOnlyQuietlyV40();
    if (typeof window.showToast === 'function') {
        window.showToast(window.tr('🎨 Сброшено: Истинный AMOLED + Тёмный Аметист (38%)', '🎨 Reset: True AMOLED + Subtle Amethyst (38%)'), ev);
    }
};

// Надёжное сохранение .json (и на диск в Download/JennyThemes, и в локальный реестр)
/* [CLEANED: downloadThemeJsonFileV38] */

// Открытие списка сохранённых .json (объединяет файлы с диска и из памяти)
/* [CLEANED: openSavedThemesModalV39] */

setTimeout(() => {
    window.unifyAllSettingCardsV37();
    window.tagUniformResetButtonsV38();
    window.applyVisualThemeV37();
    window.syncSettingsLangBtnVisibilityV39(false);
    window.upgradeThemeModalControlsV39();
}, 250);


// 🚀 ПАТЧ V41: 0% ЗАИКАНИЙ (RAF + CONTAIN), РЕАЛЬНАЯ ПАПКА JENNYTHEMES, ВВОД ИМЕНИ И АВТОСОХРАНЕНИЕ В ФАЙЛ

// 1. Защита от выбора черного/темного фона (#000000 и #0d1117) для кнопок и галочек в неполном JSON!
window.findNearestStandardColorV39 = function(targetHex, fallbackHex) {
    const isBgTarget = (fallbackHex === '#000000' || fallbackHex === '#0d1117');
    const rgb = window.parseHexToRgbV39(targetHex) || window.parseHexToRgbV39(fallbackHex) || [115, 65, 190];
    let best = window.STANDARD_PALETTE_V39[0];
    let minDist = Infinity;
    window.STANDARD_PALETTE_V39.forEach(item => {
        // Для кнопок, галочек и ползунков НИКОГДА не подставляем чёрный или тёмно-синий фон, чтобы интерфейс не сливался!
        if (!isBgTarget && (item.hex === '#000000' || item.hex === '#0d1117')) return;
        const pRgb = window.parseHexToRgbV39(item.hex);
        if (!pRgb) return;
        const d = Math.pow(rgb[0]-pRgb[0], 2) + Math.pow(rgb[1]-pRgb[1], 2) + Math.pow(rgb[2]-pRgb[2], 2);
        if (d < minDist) {
            minDist = d;
            best = item;
        }
    });
    return best;
};

// 2. Отключаем перерисовку фонового плейлиста, когда открыты настройки или редактор тем (убирает микротычку CPU/GPU)
window.updateModalGpuLockV41 = function() {
    const sm = document.getElementById('settingsModal');
    const tm = document.getElementById('themeModal');
    const eq = document.getElementById('eqModal');
    const isAnyOpen = (sm && sm.classList.contains('open')) || (tm && tm.classList.contains('open')) || (eq && eq.classList.contains('open'));
    if (isAnyOpen) {
        document.body.classList.add('modal-open-gpu-lock');
    } else {
        document.body.classList.remove('modal-open-gpu-lock');
    }
};

;(function() {
    const origOpenTM = window.openThemeStudioModalV37;
    if (typeof origOpenTM === 'function') {
        window.openThemeStudioModalV37 = function() {
            origOpenTM();
            window.updateModalGpuLockV41();
        };
    }
    const origCloseTM = window.closeThemeStudioToSettingsV37;
    if (typeof origCloseTM === 'function') {
        window.closeThemeStudioToSettingsV37 = function() {
            origCloseTM();
            window.updateModalGpuLockV41();
        };
    }
    const origToggleM = window.toggleModal;
    if (typeof origToggleM === 'function' && !window._gpuLockToggleWrappedV41) {
        window._gpuLockToggleWrappedV41 = true;
        window.toggleModal = function(id) {
            const r = origToggleM(id);
            setTimeout(window.updateModalGpuLockV41, 20);
            return r;
        };
    }
})();

// 3. Низкоприоритетный планировщик отрисовки темы (не отбирает кванты времени у звукового потока)
window._themeRafPendingV41 = false;
window._lastThemePaintTimeV41 = 0;

window.scheduleLowPriorityThemePaintV41 = function() {
    if (window._themeRafPendingV41) return;
    window._themeRafPendingV41 = true;

    const doPaint = () => {
        window._themeRafPendingV41 = false;
        window._lastThemePaintTimeV41 = performance.now();
        window.applyVisualThemeImmediateV41();
    };

    const elapsed = performance.now() - window._lastThemePaintTimeV41;
    // Ограничиваем частоту пересчёта стилей при скролле ползунка до ~22 кадров/сек, отдавая приоритет аудио
    if (elapsed < 45) {
        setTimeout(() => requestAnimationFrame(doPaint), 45 - elapsed);
    } else {
        requestAnimationFrame(doPaint);
    }
};

window.applyVisualThemeImmediateV41 = function() {
    window.appConfig = window.appConfig || {};
    const key = window.appConfig.themeBorderKey || 'solid_purple';
    const alphaPct = (window.appConfig.themeBorderAlpha !== undefined) ? parseInt(window.appConfig.themeBorderAlpha, 10) : 38;
    const alpha = Math.max(0.1, Math.min(1.0, alphaPct / 100));

    const preset = window.THEME_PRESETS_V37[key] || window.THEME_PRESETS_V37.solid_purple;
    const root = document.documentElement;

    if (preset.mode === 'solid') {
        if (document.body.getAttribute('data-border-mode') !== 'solid') {
            document.body.setAttribute('data-border-mode', 'solid');
        }
        const [r, g, b] = preset.rgb;
        const cStr = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        root.style.setProperty('--border-uniform', cStr);
        root.style.setProperty('--border-main', cStr);
        root.style.setProperty('--border-accent', `rgba(${r}, ${g}, ${b}, ${Math.min(1, alpha + 0.15)})`);
    } else {
        if (document.body.getAttribute('data-border-mode') !== 'grad') {
            document.body.setAttribute('data-border-mode', 'grad');
        }
        const [r1, g1, b1] = preset.c1;
        const [r2, g2, b2] = preset.c2;
        if (preset.c3) {
            const [r3, g3, b3] = preset.c3;
            root.style.setProperty('--border-grad', `linear-gradient(135deg, rgba(${r1},${g1},${b1},${alpha}), rgba(${r2},${g2},${b2},${alpha}), rgba(${r3},${g3},${b3},${alpha}))`);
        } else {
            root.style.setProperty('--border-grad', `linear-gradient(135deg, rgba(${r1},${g1},${b1},${alpha}), rgba(${r2},${g2},${b2},${alpha}))`);
        }
        const uStr = `rgba(${r1}, ${g1}, ${b1}, ${alpha * 0.75})`;
        root.style.setProperty('--border-uniform', uStr);
        root.style.setProperty('--border-main', uStr);
    }

    if (typeof window.applyGroupColorsV38 === 'function') {
        window.applyGroupColorsV38();
    }
};

window.applyVisualThemeV37 = function() {
    window.scheduleLowPriorityThemePaintV41();
};

// Тихое сохранение + опциональное автосохранение прямо в .json файл
window.saveThemeOnlyQuietlyV40 = function() {
    if (window._themeSaveDebounceTimer) clearTimeout(window._themeSaveDebounceTimer);
    window._themeSaveDebounceTimer = setTimeout(() => {
        try {
            localStorage.setItem('ytm_config', JSON.stringify(window.appConfig || {}));
            if (typeof window.saveConfigToDisk === 'function') window.saveConfigToDisk();
            if (window.appConfig && window.appConfig.themeAutoSaveFile) {
                window.silentAutoSaveThemeToFileV41();
            }
        } catch (e) {}
    }, 450);
};

// 4. УПРАВЛЕНИЕ ИМЕНЕМ ФАЙЛА, АВТО-КОПИЯМИ И АВТОСОХРАНЕНИЕМ В .JSON
window.injectThemeFileOptionsUIV41 = function() {
    const box = document.getElementById('themeJsonTextarea');
    if (!box || document.getElementById('themeFileNamingRowV41')) return;

    const cfg = window.appConfig || {};
    const spawnCopies = cfg.themeSpawnCopies !== undefined ? Boolean(cfg.themeSpawnCopies) : false;
    const autoSaveFile = Boolean(cfg.themeAutoSaveFile);
    const customName = cfg.themeCustomFileName || 'my_jenny_theme';

    const wrap = document.createElement('div');
    wrap.id = 'themeFileNamingRowV41';
    wrap.style.cssText = 'background:#070a0f;border:1px solid var(--border-uniform);border-radius:8px;padding:8px 10px;margin-bottom:8px;display:flex;flex-direction:column;gap:6px;';
    wrap.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:12px;color:#8b949e;white-space:nowrap;">📝 ${window.tr('Имя файла:', 'File name:')}</span>
            <input type="text" id="inp_theme_filename_v41" value="${customName}" placeholder="my_jenny_theme" oninput="window.onThemeFileNamePolicyChangeV41()" style="flex:1;padding:5px 8px;font-size:12px;color:#3fb950;font-family:monospace;">
            <span style="font-size:12px;color:#8b949e;">.json</span>
        </div>
        <label class="toggle-label" style="font-size:11.5px;color:#c9d1d9;">
            <input type="checkbox" id="chk_theme_spawn_copies_v41" ${spawnCopies ? 'checked' : ''} onchange="window.onThemeFileNamePolicyChangeV41()">
            ${window.tr('⚡ Плодить копии (добавлять время к имени файла)', '⚡ Spawn copies (append timestamp to filename)')}
        </label>
        <label class="toggle-label" style="font-size:11.5px;color:#c9d1d9;">
            <input type="checkbox" id="chk_theme_autosave_file_v41" ${autoSaveFile ? 'checked' : ''} onchange="window.onThemeFileNamePolicyChangeV41()">
            ${window.tr('🔄 Автосохранение в этот .json файл при изменениях', '🔄 Auto-save to this .json file on changes')}
        </label>
    `;
    box.insertAdjacentElement('beforebegin', wrap);
};

window.onThemeFileNamePolicyChangeV41 = function() {
    window.appConfig = window.appConfig || {};
    const nameInp = document.getElementById('inp_theme_filename_v41');
    const copyChk = document.getElementById('chk_theme_spawn_copies_v41');
    const autoChk = document.getElementById('chk_theme_autosave_file_v41');

    if (nameInp) window.appConfig.themeCustomFileName = nameInp.value.trim() || 'my_jenny_theme';
    if (copyChk) window.appConfig.themeSpawnCopies = Boolean(copyChk.checked);
    if (autoChk) window.appConfig.themeAutoSaveFile = Boolean(autoChk.checked);
    window.saveThemeOnlyQuietlyV40();
};

window.resolveTargetThemeFileNameV41 = function(completeTheme) {
    const nameInp = document.getElementById('inp_theme_filename_v41');
    const copyChk = document.getElementById('chk_theme_spawn_copies_v41');
    let base = (nameInp && nameInp.value.trim()) ? nameInp.value.trim() : (window.appConfig.themeCustomFileName || `jenny_${completeTheme.themeBorderKey || 'theme'}`);
    base = base.replace(/\.json$/i, '').trim() || 'my_jenny_theme';
    const shouldSpawn = copyChk ? copyChk.checked : Boolean(window.appConfig.themeSpawnCopies);
    if (shouldSpawn) {
        return `${base}_${Math.floor(Date.now()/1000)}.json`;
    }
    return `${base}.json`;
};

var silentAutoSaveThemeToFileV41 = window.silentAutoSaveThemeToFileV41 = window.silentAutoSaveThemeToFileV41 || function(){};

// Честное сохранение .json с выводом ПОЛНОГО ПУТИ в уведомлении (Toast)
/* [CLEANED: downloadThemeJsonFileV38] */

// Открытие списка РЕАЛЬНЫХ файлов с диска + кнопка удаления лишних копий 🗑️
window.openSavedThemesModalV39 = async function(ev) {
    let m = document.getElementById('jennyThemeFilesModal');
    if (m) m.remove();

    m = document.createElement('div');
    m.id = 'jennyThemeFilesModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.85);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:15px;box-sizing:border-box;';
    m.onclick = (e) => { if (e.target === m) m.remove(); };

    m.innerHTML = `
        <div onclick="event.stopPropagation()" style="background:#05070a;border:1px solid var(--border-uniform);border-radius:14px;max-width:420px;width:100%;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 0 25px rgba(0,0,0,0.95);">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#0d1117;border-bottom:1px solid #262c36;">
                <span style="color:#58a6ff;font-weight:bold;font-size:14px;">📂 ${window.tr('Сохранённые файлы .json', 'Saved .json Theme Files')}</span>
                <button type="button" onclick="document.getElementById('jennyThemeFilesModal').remove()" style="background:transparent;border:none;color:#8b949e;font-size:16px;padding:2px 6px;">✖</button>
            </div>
            <div id="jennyThemeFilesList" style="padding:12px 14px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;font-size:12.5px;color:#e6edf3;">
                <div style="color:#8b949e;text-align:center;padding:15px;">⏳ ${window.tr('Читаем папку Download/JennyThemes...', 'Reading Download/JennyThemes...')}</div>
            </div>
        </div>
    `;
    document.body.appendChild(m);
    await window.refreshSavedThemesListV41();
};

var refreshSavedThemesListV41 = window.refreshSavedThemesListV41 = window.refreshSavedThemesListV41 || function(){};

var deleteSavedThemeFileV41 = window.deleteSavedThemeFileV41 = window.deleteSavedThemeFileV41 || function(){};

const _origUpgradeV39 = window.upgradeThemeModalControlsV39;
window.upgradeThemeModalControlsV39 = function() {
    if (typeof _origUpgradeV39 === 'function') _origUpgradeV39();
    window.injectThemeFileOptionsUIV41();
};

setTimeout(() => {
    window.injectThemeFileOptionsUIV41();
    window.applyVisualThemeImmediateV41();
}, 260);


// 🎨 ПАТЧ V42: ОТДЕЛЬНЫЙ ЦВЕТ ЗАГОЛОВКОВ (headerColor) И ОСНОВНОГО ТЕКСТА (textColor)

Object.assign(window.DEFAULT_THEME_CONFIG_V38, {
    headerColor: '#58a6ff',
    textColor: '#e6edf3'
});

if (window.FULL_THEME_PACKS_V38) {
    Object.assign(window.FULL_THEME_PACKS_V38.amethyst_amoled, { headerColor: '#a371f7', textColor: '#e6edf3' });
    Object.assign(window.FULL_THEME_PACKS_V38.cyber_matrix,    { headerColor: '#3fb950', textColor: '#e6edf3' });
    Object.assign(window.FULL_THEME_PACKS_V38.synth_sunset,    { headerColor: '#e3b341', textColor: '#e6edf3' });
    Object.assign(window.FULL_THEME_PACKS_V38.ruby_stealth,    { headerColor: '#f85149', textColor: '#c9d1d9' });
}

// Расширяем стандартную палитру светлыми тонами специально для текста и заголовков
window.STANDARD_PALETTE_V39 = [
    { hex: '#e6edf3', nameRu: 'Кристальный Белый', nameEn: 'Crystal White' },
    { hex: '#c9d1d9', nameRu: 'Серебристый Иней',  nameEn: 'Silver Frost' },
    { hex: '#58a6ff', nameRu: 'Кибер-Циан',        nameEn: 'Cyber Cyan' },
    { hex: '#a371f7', nameRu: 'Неоновый Пурпур',    nameEn: 'Neon Purple' },
    { hex: '#7341be', nameRu: 'Тёмный Аметист',    nameEn: 'Subtle Amethyst' },
    { hex: '#3fb950', nameRu: 'Изумруд',           nameEn: 'Matrix Emerald' },
    { hex: '#e3b341', nameRu: 'Золотой Винил',     nameEn: 'Vinyl Gold' },
    { hex: '#f85149', nameRu: 'Рубиновый Лазер',   nameEn: 'Ruby Laser' },
    { hex: '#da3633', nameRu: 'Алый Драйв',        nameEn: 'Crimson Drive' },
    { hex: '#6e7681', nameRu: 'Стелс-Графит',      nameEn: 'Stealth Graphite' },
    { hex: '#000000', nameRu: 'Чистый AMOLED',     nameEn: 'Pure AMOLED' },
    { hex: '#0d1117', nameRu: 'Тёмная Полночь',    nameEn: 'Dark Midnight' }
];

Object.assign(window.FIELD_LABELS_V39, {
    headerColor: { ru: 'Цвет заголовков', en: 'Headers Color' },
    textColor:   { ru: 'Основной текст',  en: 'Main Text Color' }
});

window.getCurrentThemeObjectV38 = function() {
    const cfg = window.appConfig || {};
    const d = window.DEFAULT_THEME_CONFIG_V38;
    return {
        jenny_theme_v: "1.1",
        amoledMode: cfg.amoledMode !== undefined ? Boolean(cfg.amoledMode) : d.amoledMode,
        volSlider: cfg.volSlider !== undefined ? Boolean(cfg.volSlider) : d.volSlider,
        themeBorderKey: cfg.themeBorderKey || d.themeBorderKey,
        themeBorderAlpha: cfg.themeBorderAlpha !== undefined ? parseInt(cfg.themeBorderAlpha, 10) : d.themeBorderAlpha,
        headerColor: cfg.headerColor || d.headerColor,
        textColor: cfg.textColor || d.textColor,
        resetBtnColor: cfg.resetBtnColor || d.resetBtnColor,
        ioBtnColor: cfg.ioBtnColor || d.ioBtnColor,
        checkboxColor: cfg.checkboxColor || d.checkboxColor,
        sliderColor: cfg.sliderColor || d.sliderColor,
        transportColor: cfg.transportColor || d.transportColor,
        bgColor: cfg.bgColor || d.bgColor
    };
};

// Применяем цвета групп: теперь ползунки (sliderColor) и заголовки (headerColor) полностью независимы!
window.applyGroupColorsV38 = function() {
    const t = window.getCurrentThemeObjectV38();
    const root = document.documentElement;

    root.style.setProperty('--header-fg', t.headerColor);
    root.style.setProperty('--accent-cyan', t.headerColor);
    root.style.setProperty('--text-main-fg', t.textColor);
    root.style.setProperty('--text-main', t.textColor);

    root.style.setProperty('--reset-btn-fg', t.resetBtnColor);
    root.style.setProperty('--reset-btn-border', window.hexToRgbaV38(t.resetBtnColor, 0.48));
    root.style.setProperty('--reset-btn-bg', window.hexToRgbaV38(t.resetBtnColor, 0.08));
    root.style.setProperty('--io-btn-border', window.hexToRgbaV38(t.ioBtnColor, 0.55));
    root.style.setProperty('--accent-green', t.checkboxColor);
    root.style.setProperty('--slider-thumb-fg', t.sliderColor);
    root.style.setProperty('--help-badge-fg', t.sliderColor);
    root.style.setProperty('--transport-accent', t.transportColor);

    if (!t.amoledMode && t.bgColor && t.bgColor !== '#000000') {
        document.body.setAttribute('data-bg-preset', 'custom');
        root.style.setProperty('--custom-bg-color', t.bgColor);
    } else {
        document.body.removeAttribute('data-bg-preset');
    }

    const jsonBox = document.getElementById('themeJsonTextarea');
    if (jsonBox && document.activeElement !== jsonBox) {
        jsonBox.value = JSON.stringify(t);
    }
};

// Встраиваем строки "Заголовки секций" и "Основной текст" в карточку групп Редактора тем
window.injectTextAndHeaderColorRowsV42 = function() {
    const resetEl = document.getElementById('clr_theme_reset');
    if (!resetEl) return;
    const groupContent = resetEl.closest('.group-content');
    if (!groupContent || document.getElementById('clr_theme_header')) return;

    const t = window.getCurrentThemeObjectV38();

    const rowHeader = document.createElement('div');
    rowHeader.className = 'setting-row';
    rowHeader.style.padding = '7px 0';
    rowHeader.innerHTML = `
        <span style="font-size:12.5px;">${window.tr('📑 Заголовки секций и шапок:', '📑 Section Headers & Titles:')}</span>
        <button type="button" id="clr_theme_header" class="jenny-color-btn" style="background:${t.headerColor};" onclick="window.openCustomColorSwatchesV39('headerColor', this)"></button>
    `;

    const rowText = document.createElement('div');
    rowText.className = 'setting-row';
    rowText.style.padding = '7px 0';
    rowText.innerHTML = `
        <span style="font-size:12.5px;">${window.tr('🔤 Основной текст и названия:', '🔤 Main Text & Track Titles:')}</span>
        <button type="button" id="clr_theme_text" class="jenny-color-btn" style="background:${t.textColor};" onclick="window.openCustomColorSwatchesV39('textColor', this)"></button>
    `;

    groupContent.insertBefore(rowText, groupContent.firstChild);
    groupContent.insertBefore(rowHeader, groupContent.firstChild);
};

// Обновляем синхронизацию кнопок цвета в UI
const _origUpgradeV42 = window.upgradeThemeModalControlsV39;
window.upgradeThemeModalControlsV39 = function() {
    window.injectTextAndHeaderColorRowsV42();
    if (typeof _origUpgradeV42 === 'function') _origUpgradeV42();
    const t = window.getCurrentThemeObjectV38();
    const hBtn = document.getElementById('clr_theme_header');
    if (hBtn) hBtn.style.background = t.headerColor;
    const tBtn = document.getElementById('clr_theme_text');
    if (tBtn) tBtn.style.background = t.textColor;
};

// Обновляем умный парсер неполного JSON с поддержкой headerColor и textColor
const _origApplySmartV42 = window.applySmartPartialThemeV39;
window.applySmartPartialThemeV39 = function(rawObj, ev) {
    if (!rawObj || typeof rawObj !== 'object') return false;

    const defaults = window.DEFAULT_THEME_CONFIG_V38;
    const colorKeys = ['headerColor', 'textColor', 'resetBtnColor', 'ioBtnColor', 'checkboxColor', 'sliderColor', 'transportColor', 'bgColor'];
    const allKeys = ['amoledMode', 'volSlider', 'themeBorderKey', 'themeBorderAlpha', ...colorKeys];

    let referenceHex = null;
    for (const ck of colorKeys) {
        if (ck !== 'bgColor' && ck !== 'textColor' && rawObj[ck] && window.parseHexToRgbV39(rawObj[ck])) {
            referenceHex = rawObj[ck];
            break;
        }
    }

    const missingRu = [];
    const missingEn = [];
    const finalTheme = { jenny_theme_v: "1.1" };
    let usedNearestNameRu = null;
    let usedNearestNameEn = null;

    allKeys.forEach(k => {
        const isProvided = (rawObj[k] !== undefined && rawObj[k] !== null && rawObj[k] !== '');
        if (isProvided) {
            if (colorKeys.includes(k)) {
                if (window.parseHexToRgbV39(rawObj[k])) {
                    finalTheme[k] = rawObj[k];
                } else {
                    const near = window.findNearestStandardColorV39(referenceHex, defaults[k]);
                    finalTheme[k] = near.hex;
                }
            } else {
                finalTheme[k] = rawObj[k];
            }
        } else {
            const lbl = window.FIELD_LABELS_V39[k] || { ru: k, en: k };
            missingRu.push(lbl.ru);
            missingEn.push(lbl.en);

            if (k === 'textColor') {
                // Если не указан цвет текста — ставим читаемый Кристальный Белый, чтобы текст всегда оставался контрастным
                finalTheme[k] = defaults.textColor;
            } else if (colorKeys.includes(k)) {
                const near = window.findNearestStandardColorV39(referenceHex, defaults[k]);
                finalTheme[k] = near.hex;
                if (!usedNearestNameRu) {
                    usedNearestNameRu = near.nameRu + ' (' + near.hex + ')';
                    usedNearestNameEn = near.nameEn + ' (' + near.hex + ')';
                }
            } else {
                finalTheme[k] = defaults[k];
            }
        }
    });

    window.appConfig = window.appConfig || {};
    Object.assign(window.appConfig, finalTheme);

    const origAm = document.getElementById('cfg_amoledMode');
    if (origAm) origAm.checked = Boolean(finalTheme.amoledMode);
    const origVol = document.getElementById('cfg_volSlider');
    if (origVol) origVol.checked = Boolean(finalTheme.volSlider);

    window.applyVisualThemeImmediateV41();
    window.syncThemeStudioUIV38();
    window.saveThemeOnlyQuietlyV40();

    const reportBox = document.getElementById('themeJsonReportBox');
    if (missingRu.length === 0) {
        if (reportBox) {
            reportBox.style.display = 'block';
            reportBox.style.borderColor = '#3fb950';
            reportBox.innerHTML = window.tr('✅ Все параметры JSON распознаны и применены в полном объёме!', '✅ All JSON parameters recognized and applied!');
        }
        if (typeof window.showToast === 'function' && ev) {
            window.showToast(window.tr('✅ Полный JSON темы применён!', '✅ Full Theme JSON applied!'), ev);
        }
    } else {
        const msgRu = `⚠️ В JSON не дописаны: <b>${missingRu.join(', ')}</b>.<br>🎨 Применено то, что есть + подставлен ближайший стандартный цвет: <b style="color:#3fb950;">${usedNearestNameRu || 'Кристальный Белый'}</b>`;
        const msgEn = `⚠️ Missing in JSON: <b>${missingEn.join(', ')}</b>.<br>🎨 Applied provided fields + nearest standard color: <b style="color:#3fb950;">${usedNearestNameEn || 'Crystal White'}</b>`;
        if (reportBox) {
            reportBox.style.display = 'block';
            reportBox.style.borderColor = '#e3b341';
            reportBox.innerHTML = window.tr(msgRu, msgEn);
        }
        if (typeof window.showToast === 'function' && ev) {
            window.showToast(window.tr(`⚠️ Не указано (${missingRu.length}): подставлен ближайший стандартный цвет!`, `⚠️ Missing (${missingEn.length}): nearest standard color applied!`), ev);
        }
    }
    return finalTheme;
};

setTimeout(() => {
    window.injectTextAndHeaderColorRowsV42();
    window.upgradeThemeModalControlsV39();
    window.applyVisualThemeImmediateV41();
}, 280);


// 🛰️ ПАТЧ V43: 100% ОФЛАЙН СОХРАНЕНИЕ/ОТКРЫТИЕ ЧЕРЕЗ DO_GET (БЕЗ UNEXPECTED TOKEN '<') + ГАРАНТИРОВАННЫЕ КНОПКИ ЗАГОЛОВКОВ И ТЕКСТА

// Гарантируем, что при каждом открытии окна Редактора Тем в нём сразу появляются строки "Заголовки" и "Основной текст"
const _origOpenTM_V43 = window.openThemeStudioModalV37;
window.openThemeStudioModalV37 = function() {
    if (typeof _origOpenTM_V43 === 'function') _origOpenTM_V43();
    if (typeof window.injectTextAndHeaderColorRowsV42 === 'function') window.injectTextAndHeaderColorRowsV42();
    if (typeof window.injectThemeFileOptionsUIV41 === 'function') window.injectThemeFileOptionsUIV41();
    if (typeof window.upgradeThemeModalControlsV39 === 'function') window.upgradeThemeModalControlsV39();
};

window.silentAutoSaveThemeToFileV41 = async function() {
    const completeTheme = window.getCurrentThemeObjectV38();
    const fileName = window.resolveTargetThemeFileNameV41(completeTheme);
    const dataStr = JSON.stringify(completeTheme);
    try {
        await fetch(`/api/themes/save?name=${encodeURIComponent(fileName)}&data=${encodeURIComponent(dataStr)}`, { method: 'GET' });
    } catch (e) {}
};

// Сохранение .json файла через штатный GET-запрос к локальному Python-движку (работает 100% офлайн в авиарежиме)
window.downloadThemeJsonFileV38 = async function(ev) {
    const box = document.getElementById('themeJsonTextarea');
    let raw = box ? box.value.trim() : '';
    const reportBox = document.getElementById('themeJsonReportBox');

    if (!raw) {
        if (reportBox) {
            reportBox.style.display = 'block';
            reportBox.style.borderColor = '#f85149';
            reportBox.innerHTML = window.tr('⚠️ В поле 0 байт! Сначала нажми «📋 Копировать JSON» или вставь свой код.', '⚠️ 0 bytes in text box! Tap "📋 Copy JSON" first or paste your code.');
        }
        if (typeof window.showToast === 'function') {
            window.showToast(window.tr('⚠️ В поле 0 байт! Нажми «Копировать JSON» перед сохранением.', '⚠️ 0 bytes! Tap "Copy JSON" first.'), ev);
        }
        return;
    }

    const salvaged = window.salvagePartialJsonV39(raw) || window.getCurrentThemeObjectV38();
    const completeTheme = window.applySmartPartialThemeV39(salvaged, null) || window.getCurrentThemeObjectV38();
    const fileName = window.resolveTargetThemeFileNameV41(completeTheme);
    const contentStr = JSON.stringify(completeTheme, null, 2);
    const byteLen = new Blob([contentStr]).size;

    // Сохраняем резервную копию в память плеера
    const localFiles = JSON.parse(localStorage.getItem('jenny_saved_themes_v40') || '[]').filter(x => x.filename !== fileName);
    localFiles.unshift({
        filename: fileName,
        path: `/storage/emulated/0/Download/JennyThemes/${fileName}`,
        bytes: byteLen,
        content: contentStr
    });
    localStorage.setItem('jenny_saved_themes_v40', JSON.stringify(localFiles.slice(0, 40)));

    let finalPath = `/storage/emulated/0/Download/JennyThemes/${fileName}`;
    try {
        const res = await fetch(`/api/themes/save?name=${encodeURIComponent(fileName)}&data=${encodeURIComponent(JSON.stringify(completeTheme))}`, { method: 'GET' });
        const text = await res.text();
        if (text && text.trim().startsWith('{')) {
            const ans = JSON.parse(text);
            if (ans && ans.path) finalPath = ans.path;
        }
    } catch (e) {}

    if (reportBox) {
        reportBox.style.display = 'block';
        reportBox.style.borderColor = '#3fb950';
        reportBox.innerHTML = window.tr(
            `💾 <b>Файл сохранён (${byteLen} байт):</b><br><span style="color:#58a6ff;word-break:break-all;">${finalPath}</span>`,
            `💾 <b>File saved (${byteLen} bytes):</b><br><span style="color:#58a6ff;word-break:break-all;">${finalPath}</span>`
        );
    }
    if (typeof window.showToast === 'function') {
        window.showToast(window.tr(`💾 Путь: ${finalPath}`, `💾 Path: ${finalPath}`), ev);
    }
};

// Чтение списка файлов через GET (объединяет реальную папку Download/JennyThemes и локальный кэш без ошибки '<')
window.refreshSavedThemesListV41 = async function() {
    const listEl = document.getElementById('jennyThemeFilesList');
    if (!listEl) return;

    let files = JSON.parse(localStorage.getItem('jenny_saved_themes_v40') || '[]');
    let dirName = '/storage/emulated/0/Download/JennyThemes';

    try {
        const res = await fetch('/api/themes/list?t=' + Date.now(), { method: 'GET' });
        const text = await res.text();
        if (text && text.trim().startsWith('{')) {
            const ans = JSON.parse(text);
            if (ans && Array.isArray(ans.files) && ans.files.length > 0) {
                dirName = ans.dir || dirName;
                const seen = new Set(ans.files.map(x => x.filename));
                files = [...ans.files, ...files.filter(x => !seen.has(x.filename))];
            }
        }
    } catch (e) {}

    if (files.length === 0) {
        listEl.innerHTML = `<div style="color:#8b949e;text-align:center;padding:15px;">${window.tr('В папке Download/JennyThemes пока нет файлов.<br><br>Нажми «💾 Скачать .json», чтобы создать первый файл!', 'No files in Download/JennyThemes yet.<br><br>Tap "💾 Save .json" first!')}</div>`;
        return;
    }

    window._loadedThemeFilesCacheV39 = files;
    listEl.innerHTML = `<div style="font-size:11px;color:#8b949e;margin-bottom:4px;">📁 ${dirName}</div>` + files.map((f, idx) => `
        <div style="display:flex;justify-content:space-between;align-items:center;background:#0d1117;border:1px solid #262c36;border-radius:8px;padding:8px 10px;gap:6px;">
            <div style="min-width:0;flex:1;">
                <div style="color:#3fb950;font-weight:bold;word-break:break-all;">${f.filename}</div>
                <div style="color:#8b949e;font-size:10.5px;word-break:break-all;">${f.path} (${f.bytes} Б)</div>
            </div>
            <button type="button" onclick="window.pickSavedThemeFileByIndexV39(${idx}, event)" style="padding:6px 10px;color:#58a6ff;border-color:#58a6ff;flex-shrink:0;">
                ${window.tr('Загрузить', 'Load')}
            </button>
            <button type="button" onclick="window.deleteSavedThemeFileV41('${f.filename}', event)" style="padding:6px 8px;color:#f85149;border-color:rgba(248,81,73,0.4);flex-shrink:0;" title="Удалить">
                🗑️
            </button>
        </div>
    `).join('');
};

window.deleteSavedThemeFileV41 = async function(filename, ev) {
    const localFiles = JSON.parse(localStorage.getItem('jenny_saved_themes_v40') || '[]').filter(x => x.filename !== filename);
    localStorage.setItem('jenny_saved_themes_v40', JSON.stringify(localFiles));
    try {
        await fetch(`/api/themes/delete?filename=${encodeURIComponent(filename)}`, { method: 'GET' });
    } catch (e) {}
    await window.refreshSavedThemesListV41();
    if (typeof window.showToast === 'function') {
        window.showToast(window.tr(`🗑️ Удалено: ${filename}`, `🗑️ Deleted: ${filename}`), ev);
    }
};

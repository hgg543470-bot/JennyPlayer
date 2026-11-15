/* ============================================================================
 * ui_lang_button.js — Кнопка RU/EN: побег, «гусеница», стыковка в настройках (V35, V39, V62)
 *
 * Склейка:  /bundle_1_studio.js, модуль 5 из 12. Порядок модулей задан в player.py и менять его нельзя:
 *           поздние модули переопределяют и оборачивают функции ранних.
 * Внутри:   renderDualLangHTML, updateDualLangButtons, applyVideoMasterPresetV35, loadConfigFromDisk, triggerLangBuzz, runAwayLangBadgeToSettings, crawlAwayLangBadgeToSettings, scheduleLangRunawayTimer, toggleLanguage, initV35Enhancements … (всего функций: 12)
 * Откуда:   ui_help.js (коммит 9ae6639), строки 748–1047, 1641–1733, 3928–3988. Код блоков перенесён без правок.
 * Подробно: FILES.md (карта файлов), REFACTOR_PLAN.md (как резалось и что перекрыто).
 * ============================================================================ */


// =========================================================================




// 🦿 ПАТЧ V35: ДВА СЦЕНАРИЯ КНОПКИ RU/EN (БЕГ ДО НАЖАТИЯ / УПОЛЗАНИЕ ВВЕРХ-ВПРАВО ПОСЛЕ НАЖАТИЯ)
window.renderDualLangHTML = function(withGlobe) {
    const isEn = (window.getLang() === 'en');
    const p = withGlobe ? '🌐 ' : '';
    return isEn
        ? `${p}<span style="color:#8b949e;font-weight:normal;">RU / </span><span style="color:#3fb950;font-weight:900;">EN</span>`
        : `${p}<span style="color:#3fb950;font-weight:900;">RU</span><span style="color:#8b949e;font-weight:normal;"> / EN</span>`;
};

window.updateDualLangButtons = function() {
    const mainBtn = document.getElementById('mainLangToggleBtn');
    if (mainBtn) {
        mainBtn.innerHTML = window.renderDualLangHTML(false);
        mainBtn.style.whiteSpace = 'nowrap';
        mainBtn.style.padding = '4px 8px';
        if (window._langTouchedByUser) {
            mainBtn.classList.remove('lang-buzz-active');
        }
    }
    const topRow = document.getElementById('jennyTopBarRow');
    if (topRow && topRow.lastElementChild) {
        topRow.lastElementChild.innerHTML = window.renderDualLangHTML(true);
    }
};

window.applyVideoMasterPresetV35 = function(force) {
    window.appConfig = window.appConfig || JSON.parse(localStorage.getItem('ytm_config') || '{}');
    if (!force && window.appConfig._videoPresetAppliedV35) return;
    Object.assign(window.appConfig, {
        _videoPresetAppliedV35: true, _migratedToRealUnitsV20: true,
        studioMode: true, phaseFixEnabled: false,
        opt_midPhase: true, val_midPhase: 4,
        opt_midQ: true, val_midQ: 120,
        opt_deEsser: true, val_deEsser: -2,
        opt_cleanFir: true, val_cleanFir: 3,
        opt_masterCeil: true, val_masterCeil: -1.0,
        opt_autoRms: true, val_autoRms: -6,
        opt_monoBass: true, val_monoBass: 79,
        opt_msWidth: true, val_msWidth: 130,
        opt_punch: true, val_punch: -1,
        opt_crossfeed: false, val_crossfeed: 65,
        leftHandedMode: false, pitchLock: true, xNormalSpeed: false,
        normalPlaybackSpeed: 0.97, autoSaveBase: false,
        defaultScrubSpeed: 1.1, autoSaveScrub: true,
        scrubZones: [
            { val: 1.1, en: true }, { val: 1, en: true }, { val: 1.05, en: true },
            { val: 0.95, en: true }, { val: 1.5, en: true }, { val: 0.9, en: true }
        ],
        formatSlots: JSON.parse(JSON.stringify(window.DEFAULT_FORMAT_SLOTS)),
        amoledMode: true, volSlider: true,
        firEnabled: true, firSettings: { gain: 1.5, decay: 1.28 },
        multiBandEnabled: true, multiBandSettings: { low: 160, high: 2528 },
        limiterEnabled: true, limiterSettings: { threshold: -18, knee: 128, ratio: 4, attack: 192, release: 352 },
        eqEnabled: true, boosterEnabled: true, boosterPower: 5
    });
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));

    const chkMap = {
        'cfg_studioMode': true, 'cfg_phaseFix': false, 'cfg_leftHandedMode': false,
        'cfg_pitchLock': true, 'cfg_xNormalSpeed': false, 'cfg_autoSaveBase': false,
        'cfg_autoSaveScrub': true, 'cfg_amoledMode': true, 'cfg_volSlider': true,
        'cfg_firEnabled': true, 'cfg_multiBandEnabled': true, 'cfg_limiterEnabled': true,
        'cfg_eqEnabled': true, 'cfg_boosterEnabled': true
    };
    for (const [id, v] of Object.entries(chkMap)) { const el = document.getElementById(id); if (el) el.checked = v; }

    const valMap = {
        'cfg_normalPlaybackSpeed': 0.97, 'cfg_defaultScrubSpeed': 1.1,
        'cfg_fir_gain': 1.5, 'cfg_fir_decay': 1.28,
        'cfg_mb_low': 160, 'cfg_mb_high': 2528,
        'cfg_lim_threshold': -18, 'cfg_lim_knee': 128, 'cfg_lim_ratio': 4,
        'cfg_lim_attack': 192, 'cfg_lim_release': 352, 'cfg_boosterPower': 5
    };
    for (const [id, v] of Object.entries(valMap)) { const el = document.getElementById(id); if (el) el.value = v; }

    if (typeof window.syncDspModUI === 'function') window.syncDspModUI();
    if (typeof window.syncFormatSlotsUI === 'function') window.syncFormatSlotsUI();
    if (typeof window.applyTheme === 'function') window.applyTheme();
    if (typeof window.buildAudioGraph === 'function') window.buildAudioGraph();
    if (typeof window.saveConfigToDisk === 'function') window.saveConfigToDisk();
};

;(function() {
    const origLoad = window.loadConfigFromDisk;
    if (typeof origLoad === 'function' && !window._loadWrappedV35) {
        window._loadWrappedV35 = true;
        window.loadConfigFromDisk = async function() {
            const wasApplied = Boolean(window.appConfig && window.appConfig._videoPresetAppliedV35);
            await origLoad();
            if (!wasApplied) window.applyVideoMasterPresetV35(true);
        };
    }
})();

window._langRunawayTimer = null;
window._langBuzzInterval = null;
window._hasLangRunAway = false;
window._langTouchedByUser = false;

window.triggerLangBuzz = function(ms = 1400) {
    // Дребезжит ТОЛЬКО если пользователь ещё ни разу не трогал кнопку!
    if (window._langTouchedByUser || window._hasLangRunAway) return;
    const btn = document.getElementById('mainLangToggleBtn');
    if (!btn) return;
    btn.classList.add('lang-buzz-active');
    setTimeout(() => { if (btn) btn.classList.remove('lang-buzz-active'); }, ms);
};

// СЦЕНАРИЙ 1: Не трогали 30 сек -> Срывается с места на длинных ногах вправо и прыгает с сальтухой в ⚙️
window.runAwayLangBadgeToSettings = function() {
    const btn = document.getElementById('mainLangToggleBtn');
    const gear = document.getElementById('btn-settingsModal');
    if (!btn || !gear || window._hasLangRunAway || btn.offsetParent === null) return;

    window._hasLangRunAway = true;
    if (window._langBuzzInterval) clearInterval(window._langBuzzInterval);

    const startRect = btn.getBoundingClientRect();
    const gearRect = gear.getBoundingClientRect();
    btn.style.opacity = '0';
    btn.style.pointerEvents = 'none';

    const actor = document.createElement('div');
    actor.className = 'runaway-actor';
    actor.style.left = startRect.left + 'px';
    actor.style.top = startRect.top + 'px';
    actor.innerHTML = `
        <div id="runawayBubble" style="font-size:10px;color:#e3b341;font-weight:bold;margin-bottom:2px;white-space:nowrap;">${window.tr('💨 Адиос!', '💨 Adios!')}</div>
        <div class="jenny-lang-btn" style="white-space:nowrap;padding:4px 8px;border-color:#3fb950;box-shadow:0 0 12px rgba(63,185,80,0.6);">
            ${window.renderDualLangHTML(false)}
        </div>
        <div class="runaway-legs-wrap">
            <div class="runaway-leg left"></div>
            <div class="runaway-leg right"></div>
        </div>
    `;
    document.body.appendChild(actor);
    actor.classList.add('lang-buzz-active');
    try { navigator.vibrate(25); } catch (e) {}

    setTimeout(() => {
        actor.classList.remove('lang-buzz-active');
        const targetRunX = Math.max(startRect.left + 80, gearRect.left - 15);
        actor.style.transition = 'left 1.3s linear, top 1.3s ease-in-out';
        actor.style.left = targetRunX + 'px';
        actor.style.top = (startRect.top - 4) + 'px';
    }, 400);

    setTimeout(() => {
        const b = document.getElementById('runawayBubble');
        if (b) b.innerText = window.tr('🤸 Вжух!', '🤸 Wheee!');
        actor.style.transition = 'left 0.55s ease-in, top 0.55s cubic-bezier(0.2, -0.6, 0.3, 1), transform 0.55s ease-in, opacity 0.55s ease-in';
        actor.style.left = (gearRect.left - 5) + 'px';
        actor.style.top = (gearRect.top - 5) + 'px';
        actor.style.transform = 'rotate(540deg) scale(0.15)';
        actor.style.opacity = '0.2';
    }, 1750);

    setTimeout(() => {
        actor.remove();
        btn.style.display = 'none';
        gear.classList.add('gear-swallow-anim');
        try { navigator.vibrate([20, 40, 30]); } catch (e) {}
        setTimeout(() => gear.classList.remove('gear-swallow-anim'), 650);
    }, 2320);
};

// СЦЕНАРИЙ 2: Язык был выбран (ткнули хотя бы раз) -> Тихо ждёт 30 сек и аккуратно уползает ВВЕРХ, а потом ВПРАВО в ⚙️
window.crawlAwayLangBadgeToSettings = function() {
    const btn = document.getElementById('mainLangToggleBtn');
    const gear = document.getElementById('btn-settingsModal');
    if (!btn || !gear || window._hasLangRunAway || btn.offsetParent === null) return;

    window._hasLangRunAway = true;
    if (window._langBuzzInterval) clearInterval(window._langBuzzInterval);

    const startRect = btn.getBoundingClientRect();
    const gearRect = gear.getBoundingClientRect();
    btn.style.opacity = '0';
    btn.style.pointerEvents = 'none';

    const legsHTML = '<span class="c-leg"></span><span class="c-leg"></span><span class="c-leg"></span><span class="c-leg"></span><span class="c-leg"></span>';

    const crawler = document.createElement('div');
    crawler.className = 'crawler-actor';
    crawler.style.left = startRect.left + 'px';
    crawler.style.top = startRect.top + 'px';
    crawler.innerHTML = `
        <div id="crawlerBubble" style="font-size:10px;color:#58a6ff;font-weight:bold;margin-bottom:8px;white-space:nowrap;">${window.tr('🐛 Ползу в ⚙️...', '🐛 Crawling to ⚙️...')}</div>
        <div id="crawlerRotator" class="crawler-rotator" style="transform: rotate(0deg);">
            <div class="crawler-spine">
                <div class="crawler-legs-row side-a">${legsHTML}</div>
                <div class="jenny-lang-btn" style="white-space:nowrap;padding:3px 7px;border-color:#58a6ff;box-shadow:0 0 10px rgba(88,166,255,0.45);">
                    ${window.renderDualLangHTML(false)}
                </div>
                <div class="crawler-legs-row side-b">${legsHTML}</div>
                <div class="crawler-head-antennae">
                    <span class="c-antenna top"></span>
                    <span class="c-antenna bot"></span>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(crawler);

    const rotator = document.getElementById('crawlerRotator');
    const topLaneY = Math.max(6, gearRect.top - 14);
    const targetRightX = Math.max(startRect.left + 60, gearRect.left - 20);

    // Шаг 1 (0 - 220 мс): Разворачивается на месте узким торцом ("головой") СТРОГО ВВЕРХ (-90°)
    setTimeout(() => {
        if (rotator) rotator.style.transform = 'rotate(-90deg)';
    }, 30);

    // Шаг 2 (220 - 1420 мс): Ползёт узким торцом вперёд вертикально ВВЕРХ, перебирая лапками по бокам
    setTimeout(() => {
        crawler.style.transition = 'top 1.2s linear';
        crawler.style.top = topLaneY + 'px';
    }, 220);

    // Шаг 3 (1380 - 1650 мс): На верхнем углу поворачивает корпус на 90° ВПРАВО (0° — узким торцом к шестерёнке)
    setTimeout(() => {
        if (rotator) rotator.style.transform = 'rotate(0deg)';
    }, 1380);

    // Шаг 4 (1550 - 3200 мс): Ползёт головой вперёд ВПРАВО до шестерёнки ⚙️
    setTimeout(() => {
        crawler.style.transition = 'left 1.65s linear';
        crawler.style.left = targetRightX + 'px';
    }, 1550);

    // Шаг 5 (3200 - 3620 мс): Ныряет головой внутрь шестерёнки ⚙️
    setTimeout(() => {
        const b = document.getElementById('crawlerBubble');
        if (b) b.innerText = window.tr('🫡 На месте!', '🫡 Tucked in!');
        crawler.style.transition = 'left 0.42s ease-in, top 0.42s ease-in, transform 0.42s ease-in, opacity 0.42s ease-in';
        crawler.style.left = (gearRect.left + 2) + 'px';
        crawler.style.top = (gearRect.top + 2) + 'px';
        crawler.style.transform = 'scale(0.12)';
        crawler.style.opacity = '0.1';
    }, 3200);

    // Шаг 6 (3620 мс): Шестерёнка мягко принимает плашку
    setTimeout(() => {
        crawler.remove();
        btn.style.display = 'none';
        gear.classList.add('gear-soft-anim');
        setTimeout(() => gear.classList.remove('gear-soft-anim'), 550);
    }, 3620);
};

window.scheduleLangRunawayTimer = function() {
    if (window._hasLangRunAway) return;
    if (window._langRunawayTimer) clearTimeout(window._langRunawayTimer);
    if (window._langBuzzInterval) clearInterval(window._langBuzzInterval);

    if (!window._langTouchedByUser) {
        // Пока не нажали ни разу — дребезжит со старта и каждые 10 сек, а через 30 сек убегает на ногах
        setTimeout(() => window.triggerLangBuzz(2000), 300);
        window._langBuzzInterval = setInterval(() => window.triggerLangBuzz(900), 10000);
        window._langRunawayTimer = setTimeout(() => window.runAwayLangBadgeToSettings(), 30000);
    } else {
        // После первого нажатия — больше НЕ дребезжит, ждёт 30 сек и аккуратно уползает ВВЕРХ -> ВПРАВО
        const btn = document.getElementById('mainLangToggleBtn');
        if (btn) btn.classList.remove('lang-buzz-active');
        window._langRunawayTimer = setTimeout(() => window.crawlAwayLangBadgeToSettings(), 30000);
    }
};

const _origToggleLangV35 = window.toggleLanguage;
window.toggleLanguage = function(ev) {
    window._langTouchedByUser = true;
    if (window._langBuzzInterval) {
        clearInterval(window._langBuzzInterval);
        window._langBuzzInterval = null;
    }
    const btn = document.getElementById('mainLangToggleBtn');
    if (btn) btn.classList.remove('lang-buzz-active');

    _origToggleLangV35(ev);
    window.updateDualLangButtons();
    window.scheduleLangRunawayTimer();
};

window.initV35Enhancements = function() {
    window.applyVideoMasterPresetV35(false);
    window.updateDualLangButtons();
    window.scheduleLangRunawayTimer();
    const ft = document.getElementById('folderIconTrigger');
    if (ft && ft.parentElement) {
        ft.parentElement.style.width = 'auto';
        ft.parentElement.style.minWidth = '92px';
        ft.parentElement.style.gap = '8px';
    }
};

if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", () => setTimeout(window.initV35Enhancements, 80));
} else {
    setTimeout(window.initV35Enhancements, 80);
}

// 1. УПРАВЛЕНИЕ ВИДИМОСТЬЮ И СТЫКОВКОЙ КНОПКИ RU / EN В НАСТРОЙКАХ
window.syncSettingsLangBtnVisibilityV39 = function(animateDock) {
    const topRow = document.getElementById('jennyTopBarRow');
    if (!topRow) return;
    const langBtnInSettings = document.getElementById('settingsDockedLangBtn') || topRow.lastElementChild;
    if (!langBtnInSettings) return;
    langBtnInSettings.id = 'settingsDockedLangBtn';

    if (!window._hasLangRunAway) {
        // Пока плашка на главном экране — в настройках её НЕТ!
        langBtnInSettings.style.display = 'none';
        langBtnInSettings.classList.remove('lang-docked-appear');
    } else {
        langBtnInSettings.style.display = 'flex';
        langBtnInSettings.innerHTML = window.renderDualLangHTML(true);
        if (animateDock) {
            langBtnInSettings.classList.remove('lang-docked-appear');
            void langBtnInSettings.offsetWidth;
            langBtnInSettings.classList.add('lang-docked-appear');
        }
    }
};

// Эффект перелёта и стыковки из шестерёнки ⚙️ прямо в слот внутри открытых настроек
window.dockLangBadgeIntoOpenSettingsV39 = function() {
    const sm = document.getElementById('settingsModal');
    const gear = document.getElementById('btn-settingsModal');
    const topRow = document.getElementById('jennyTopBarRow');

    if (!sm || !sm.classList.contains('open') || !gear || !topRow || topRow.children.length < 2) {
        window.syncSettingsLangBtnVisibilityV39(true);
        return;
    }

    const langBtnInSettings = topRow.lastElementChild;
    // Показываем кнопку прозрачной, чтобы flex-строка плавно сдвинула "СПРАВОЧНИК НАСТРОЕК" влево и открыла гнездо
    langBtnInSettings.style.display = 'flex';
    langBtnInSettings.style.opacity = '0';
    langBtnInSettings.style.transition = 'none';
    langBtnInSettings.innerHTML = window.renderDualLangHTML(true);

    setTimeout(() => {
        const gearRect = gear.getBoundingClientRect();
        const slotRect = langBtnInSettings.getBoundingClientRect();

        // Создаём капсулу, вылетающую из шестерёнки ⚙️ вниз прямо в открывшееся гнездо настроек
        const flyer = document.createElement('div');
        flyer.style.cssText = `position:fixed;z-index:999999;pointer-events:none;left:${gearRect.left - 10}px;top:${gearRect.top + 6}px;transform:scale(0.35);opacity:0.9;transition:all 0.42s cubic-bezier(0.22, 1.3, 0.36, 1);`;
        flyer.innerHTML = `<div class="jenny-lang-btn" style="padding:8px 12px;border-color:#3fb950;box-shadow:0 0 18px #3fb950;background:#0d1117;">${window.renderDualLangHTML(true)}</div>`;
        document.body.appendChild(flyer);

        requestAnimationFrame(() => {
            flyer.style.left = slotRect.left + 'px';
            flyer.style.top = slotRect.top + 'px';
            flyer.style.transform = 'scale(1)';
        });

        setTimeout(() => {
            flyer.remove();
            langBtnInSettings.style.opacity = '1';
            langBtnInSettings.classList.add('lang-docked-appear');
        }, 420);
    }, 60);
};

// Перехватываем оба сценария побега, чтобы в финале срабатывала стыковка с настройками!
;(function() {
    const wrapRunawayDocking = () => {
        const origRun = window.runAwayLangBadgeToSettings;
        if (typeof origRun === 'function' && !window._runWrappedV39) {
            window._runWrappedV39 = true;
            window.runAwayLangBadgeToSettings = function() {
                origRun();
                setTimeout(() => window.dockLangBadgeIntoOpenSettingsV39(), 2330);
            };
        }
        const origCrawl = window.crawlAwayLangBadgeToSettings;
        if (typeof origCrawl === 'function' && !window._crawlWrappedV39) {
            window._crawlWrappedV39 = true;
            window.crawlAwayLangBadgeToSettings = function() {
                origCrawl();
                setTimeout(() => window.dockLangBadgeIntoOpenSettingsV39(), 3630);
            };
        }
    };
    wrapRunawayDocking();
    setTimeout(wrapRunawayDocking, 200);
})();

const _origUpdateDualV39 = window.updateDualLangButtons;
window.updateDualLangButtons = function() {
    if (typeof _origUpdateDualV39 === 'function') _origUpdateDualV39();
    window.syncSettingsLangBtnVisibilityV39(false);
};

// Пересчитываем маршрут гусеницы RU/EN снизу вверх к шестерёнке ⚙️ (и для правшей, и для левшей!)
window.crawlAwayLangBadgeToSettings = function() {
    const btn = document.getElementById('mainLangToggleBtn');
    const gear = document.getElementById('btn-settingsModal');
    if (!btn || !gear || window._hasLangRunAway || btn.offsetParent === null) return;

    window._hasLangRunAway = true;
    if (window._langBuzzInterval) clearInterval(window._langBuzzInterval);

    const startRect = btn.getBoundingClientRect();
    const gearRect = gear.getBoundingClientRect();
    btn.style.opacity = '0';
    btn.style.pointerEvents = 'none';

    const legsHTML = '<span class="c-leg"></span><span class="c-leg"></span><span class="c-leg"></span><span class="c-leg"></span><span class="c-leg"></span>';
    const crawler = document.createElement('div');
    crawler.className = 'crawler-actor';
    crawler.style.left = startRect.left + 'px';
    crawler.style.top = startRect.top + 'px';
    crawler.innerHTML = `
        <div id="crawlerBubble" style="font-size:10px;color:#58a6ff;font-weight:bold;margin-bottom:8px;white-space:nowrap;">${window.tr('🐛 Ползу в ⚙️...', '🐛 Crawling to ⚙️...')}</div>
        <div id="crawlerRotator" class="crawler-rotator" style="transform: rotate(0deg);">
            <div class="crawler-spine">
                <div class="crawler-legs-row side-a">${legsHTML}</div>
                <div class="jenny-lang-btn" style="white-space:nowrap;padding:3px 7px;border-color:#58a6ff;box-shadow:0 0 10px rgba(88,166,255,0.45);">
                    ${window.renderDualLangHTML(false)}
                </div>
                <div class="crawler-legs-row side-b">${legsHTML}</div>
                <div class="crawler-head-antennae"><span class="c-antenna top"></span><span class="c-antenna bot"></span></div>
            </div>
        </div>
    `;
    document.body.appendChild(crawler);

    const rotator = document.getElementById('crawlerRotator');
    const topLaneY = Math.max(8, gearRect.top + 4);
    const goingRight = gearRect.left >= startRect.left;
    const horizAngle = goingRight ? 'rotate(0deg)' : 'rotate(180deg)';

    setTimeout(() => { if (rotator) rotator.style.transform = 'rotate(-90deg)'; }, 30);
    setTimeout(() => {
        crawler.style.transition = 'top 1.35s linear';
        crawler.style.top = topLaneY + 'px';
    }, 220);
    setTimeout(() => { if (rotator) rotator.style.transform = horizAngle; }, 1550);
    setTimeout(() => {
        crawler.style.transition = 'left 1.45s linear';
        crawler.style.left = gearRect.left + 'px';
    }, 1700);
    setTimeout(() => {
        crawler.style.transition = 'transform 0.4s ease-in, opacity 0.4s ease-in';
        crawler.style.transform = 'scale(0.12)';
        crawler.style.opacity = '0.1';
    }, 3180);
    setTimeout(() => {
        crawler.remove();
        btn.style.display = 'none';
        gear.classList.add('gear-soft-anim');
        setTimeout(() => gear.classList.remove('gear-soft-anim'), 550);
        if (typeof window.dockLangBadgeIntoOpenSettingsV39 === 'function') window.dockLangBadgeIntoOpenSettingsV39();
    }, 3600);
};

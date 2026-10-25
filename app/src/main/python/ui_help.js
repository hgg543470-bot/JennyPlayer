
window.DEFAULT_FORMAT_SLOTS = [
    { en: true, ext: '.mp3' },
    { en: true, ext: '.opus' },
    { en: true, ext: '.m4a' },
    { en: true, ext: '.flac' },
    { en: true, ext: '.wav' },
    { en: true, ext: '.ogg' },
    { en: true, ext: '.mp4' },
    { en: true, ext: '.aac' }
];

window.getFormatSlotsConfig = function() {
    window.appConfig = window.appConfig || {};
    if (!Array.isArray(window.appConfig.formatSlots) || window.appConfig.formatSlots.length !== 8) {
        window.appConfig.formatSlots = JSON.parse(JSON.stringify(window.DEFAULT_FORMAT_SLOTS));
    }
    return window.appConfig.formatSlots;
};

window.syncFormatSlotsUI = function() {
    const slots = window.getFormatSlotsConfig();
    for (let i = 0; i < 8; i++) {
        const chk = document.getElementById(`cfg_fmt_${i+1}_en`);
        const inp = document.getElementById(`cfg_fmt_${i+1}_val`);
        const s = slots[i] || window.DEFAULT_FORMAT_SLOTS[i];
        if (chk) chk.checked = Boolean(s.en);
        if (inp) {
            let cleanExt = String(s.ext || '').trim();
            if (cleanExt && !cleanExt.startsWith('.')) cleanExt = '.' + cleanExt;
            inp.value = cleanExt;
            inp.style.opacity = s.en ? '1' : '0.4';
        }
    }
};

window.isTrackAllowedByFormatSlots = function(filename) {
    if (!filename) return true;
    const slots = window.getFormatSlotsConfig();
    const activeExts = slots
        .filter(s => s && s.en && String(s.ext || '').trim())
        .map(s => '.' + String(s.ext).trim().toLowerCase().replace(/^\.+/, ''));
    if (activeExts.length === 0) return false;
    const lower = String(filename).toLowerCase().trim();
    return activeExts.some(ext => lower.endsWith(ext));
};

window.applyFormatFilterToDOM = function() {
    const uList = document.getElementById('unifiedList');
    if (!uList) return;
    const rows = Array.from(uList.children);
    let visibleCount = 0;
    rows.forEach(row => {
        const txt = (row.innerText || '').trim();
        if (!txt || txt.includes('Загрузка...')) return;
        // Ищем имя файла в тексте карточки или в атрибутах
        const allowed = window.isTrackAllowedByFormatSlots(txt);
        row.style.display = allowed ? '' : 'none';
        if (allowed) visibleCount++;
    });
    const cnt = document.getElementById('tracksCount');
    if (cnt && rows.length > 0) {
        cnt.innerText = visibleCount;
    }
};

window.saveFormatSlotsToConfig = async function(triggerReload) {
    window.appConfig = window.appConfig || {};
    const slots = [];
    for (let i = 0; i < 8; i++) {
        const chk = document.getElementById(`cfg_fmt_${i+1}_en`);
        const inp = document.getElementById(`cfg_fmt_${i+1}_val`);
        let raw = inp ? inp.value.trim().toLowerCase() : window.DEFAULT_FORMAT_SLOTS[i].ext;
        if (raw && !raw.startsWith('.')) raw = '.' + raw;
        let isEn = chk ? Boolean(chk.checked) : true;
        if (inp) inp.style.opacity = isEn ? '1' : '0.4';
        slots.push({ en: isEn, ext: raw || window.DEFAULT_FORMAT_SLOTS[i].ext });
    }
    window.appConfig.formatSlots = slots;
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));

    // Мгновенно прячем/показываем карточки треков прямо в списке на экране!
    window.applyFormatFilterToDOM();

    try {
        await fetch('/api/config/save_single', {
            method: 'POST',
            body: JSON.stringify({ category: 'main', key: 'formatSlots', value: slots })
        });
    } catch (e) {}

    if (triggerReload && typeof window.fetchData === 'function') {
        await window.fetchData();
        window.applyFormatFilterToDOM();
    }
};

window.resetFormatSlots = async function(ev) {
    window.appConfig = window.appConfig || {};
    window.appConfig.formatSlots = JSON.parse(JSON.stringify(window.DEFAULT_FORMAT_SLOTS));
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    window.syncFormatSlotsUI();
    await window.saveFormatSlotsToConfig(true);
    try { navigator.vibrate(35); } catch(e){}
    if (typeof window.showToast === 'function') {
        window.showToast("🔄 Все 8 форматов включены!", ev);
    }
};

// Следим за любыми изменениями внутри #unifiedList (например, после выбора папки или рендера), чтобы фильтр форматов применялся всегда!
window.installFormatAwareFetchData = function() {
    if (window._fmtListObserverInit) return;
    window._fmtListObserverInit = true;
    const uList = document.getElementById('unifiedList');
    if (uList) {
        const obs = new MutationObserver(() => {
            window.applyFormatFilterToDOM();
        });
        obs.observe(uList, { childList: true });
    }
    window.applyFormatFilterToDOM();
};

// =========================================================================
// 💡 UI_HELP.JS (МОНИТОР АВТО-МАСТЕРА В ШАПКЕ + БАЗА ЗНАНИЙ + 10 МОДУЛЕЙ)
// =========================================================================

window._dspInputDebounce = null;
window.ALL_MOD_KEYS = ['midPhase', 'midQ', 'deEsser', 'cleanFir', 'masterCeil', 'autoRms', 'monoBass', 'msWidth', 'punch', 'crossfeed'];

window.updateTopSearchOrMonitorBar = function() {
    const searchInput = document.getElementById('trackSearchInput');
    if (!searchInput) return;
    const barWrap = searchInput.parentElement;
    if (!barWrap) return;

    const sm = document.getElementById('settingsModal');
    const em = document.getElementById('eqModal');
    const isModalOpen = (sm && sm.classList.contains('open')) || (em && em.classList.contains('open'));

    const cfg = window.appConfig || {};
    const ceilOn = Boolean(cfg.opt_masterCeil || cfg.phaseFixEnabled);
    const totalTxt = (typeof window.lastComputedCeilingDb !== 'undefined') ? window.lastComputedCeilingDb : -0.5;
    const detailsTxt = window.lastCeilingBreakdown || 'Базовый запас -0.5 dB';

    let monEl = document.getElementById('topAutoCeilMonitor');
    if (!monEl) {
        monEl = document.createElement('div');
        monEl.id = 'topAutoCeilMonitor';
        monEl.style.cssText = 'display:none;width:100%;box-sizing:border-box;background:#0d1117;border:1px solid #2ea043;border-radius:8px;padding:8px 11px;font-size:12px;color:#e6edf3;white-space:nowrap;overflow-x:auto;font-family:monospace;box-shadow:0 0 8px rgba(46,160,67,0.25);';
        barWrap.appendChild(monEl);
    }

    if (!isModalOpen) {
        barWrap.style.display = '';
        barWrap.style.paddingTop = '15px';
        searchInput.style.display = '';
        monEl.style.display = 'none';
    } else {
        searchInput.style.display = 'none';
        if (ceilOn) {
            barWrap.style.display = '';
            barWrap.style.paddingTop = '12px';
            monEl.style.display = 'block';
            monEl.innerHTML = `<span style="color:#3fb950;font-weight:bold;">🛡️ Авто-Потолок: ${totalTxt} dB</span> <span style="color:#8b949e;">│</span> <span style="color:#58a6ff;">${detailsTxt}</span>`;
        } else {
            monEl.style.display = 'none';
            barWrap.style.display = 'none';
        }
    }
};

window.ensureParentDspBlocks = function(modKey, ev) {
    window.appConfig = window.appConfig || {};
    let changed = false;
    if (modKey === 'cleanFir' || modKey === 'phaseFix') {
        if (!window.appConfig.firEnabled) {
            window.appConfig.firEnabled = true;
            const el = document.getElementById('cfg_firEnabled');
            if (el) el.checked = true;
            changed = true;
        }
    }
    if (['midPhase', 'midQ', 'deEsser', 'phaseFix'].includes(modKey)) {
        if (!window.appConfig.limiterEnabled) {
            window.appConfig.limiterEnabled = true;
            const el = document.getElementById('cfg_limiterEnabled');
            if (el) el.checked = true;
            changed = true;
        }
        if (!window.appConfig.multiBandEnabled) {
            window.appConfig.multiBandEnabled = true;
            const el = document.getElementById('cfg_multiBandEnabled');
            if (el) el.checked = true;
            changed = true;
        }
    }
    if (changed) {
        localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    }
};

window.syncDspModUI = function() {
    window.appConfig = window.appConfig || {};
    const cfg = window.appConfig;

    if (!cfg._migratedToRealUnitsV20) {
        cfg._migratedToRealUnitsV20 = true;
        Object.keys(window.DSP_MOD_DEFAULTS).forEach(k => {
            if (cfg[k] === undefined) cfg[k] = window.DSP_MOD_DEFAULTS[k];
        });
        if (cfg.val_deEsser === -60) cfg.val_deEsser = -6.0;
        if (cfg.val_midQ < 25) cfg.val_midQ = 150;
        cfg.opt_masterCeil = true;
        if (cfg.opt_msWidth && cfg.opt_crossfeed) cfg.opt_crossfeed = false;
        if (cfg.opt_msWidth && cfg.opt_crossfeed) cfg.opt_crossfeed = false;
        localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    }

    const pfEl = document.getElementById('cfg_phaseFix');
    if (pfEl) pfEl.checked = Boolean(cfg.phaseFixEnabled);

    window.ALL_MOD_KEYS.forEach(k => {
        const chk = document.getElementById('cfg_opt_' + k);
        const inp = document.getElementById('cfg_val_' + k);
        if (chk) chk.checked = Boolean(cfg['opt_' + k]);
        if (inp) {
            let v = cfg['val_' + k];
            inp.value = (v !== undefined && v !== null && v !== '') ? v : window.DSP_MOD_DEFAULTS['val_' + k];
        }
    });

    const wrap = document.getElementById('dspModBodyWrap');
    const shield = document.getElementById('dspModLockShield');
    if (wrap && shield) {
        if (cfg.phaseFixEnabled) {
            wrap.style.opacity = '0.32';
            wrap.style.filter = 'grayscale(100%)';
            shield.style.display = 'block';
        } else {
            wrap.style.opacity = '1';
            wrap.style.filter = 'none';
            shield.style.display = 'none';
        }
    }
    if (typeof window.updateTopSearchOrMonitorBar === 'function') {
        window.updateTopSearchOrMonitorBar();
    }
};

if (!window._modalClassObserverInit) {
    window._modalClassObserverInit = true;
    const attachModalObs = () => {
        const obs = new MutationObserver(() => {
            if (typeof window.updateTopSearchOrMonitorBar === 'function') {
                window.updateTopSearchOrMonitorBar();
            }
        });
        ['settingsModal', 'eqModal', 'favModal'].forEach(id => {
            const el = document.getElementById(id);
            if (el) obs.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
        });
        if (typeof window.updateTopSearchOrMonitorBar === 'function') {
            window.updateTopSearchOrMonitorBar();
        }
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachModalObs);
    } else {
        attachModalObs();
    }
}

window.onPhaseFocusChange = function(el, ev) {
    window.appConfig = window.appConfig || {};
    window.appConfig.phaseFixEnabled = Boolean(el.checked);
    if (el.checked) window.ensureParentDspBlocks('phaseFix', ev);
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    if (typeof window.updateTopSearchOrMonitorBar === 'function') window.updateTopSearchOrMonitorBar();
    window.syncDspModUI();
    if (typeof window.buildAudioGraph === 'function') {
        if (window._dspInputDebounce) clearTimeout(window._dspInputDebounce);
        window._dspInputDebounce = setTimeout(() => window.buildAudioGraph(), 90);
    }
    try { navigator.vibrate(40); } catch(e){}
    if (el.checked && typeof window.showToast === 'function') {
        window.showToast("🔒 Блок управления отключён! Для включения выключите «Фазовый фокус»", ev);
    } else if (!el.checked && typeof window.showToast === 'function') {
        window.showToast("🔓 Ручной блок тонкой настройки активен!", ev);
    }
};

window.onDspModChange = function(key, ev) {
    window.appConfig = window.appConfig || {};
    const chk = document.getElementById('cfg_opt_' + key);
    const inp = document.getElementById('cfg_val_' + key);

    // Авто-переключение между "🎭 Стерео-Ширина" и "🎧 Бинаурал-Колонки" с понятным уведомлением
    if (chk && chk.checked && (key === 'msWidth' || key === 'crossfeed')) {
        const otherKey = (key === 'msWidth') ? 'crossfeed' : 'msWidth';
        const otherChk = document.getElementById('cfg_opt_' + otherKey);
        if ((otherChk && otherChk.checked) || window.appConfig['opt_' + otherKey]) {
            if (otherChk) otherChk.checked = false;
            window.appConfig['opt_' + otherKey] = false;
            try { navigator.vibrate(35); } catch(e){}
            if (typeof window.showToast === 'function') {
                const msg = (key === 'msWidth')
                    ? "🎭 Стерео ВКЛ (🎧 Бинаурал откл. — что-то одно из двух)"
                    : "🎧 Бинаурал ВКЛ (🎭 Стерео откл. — что-то одно из двух)";
                window.showToast(msg, ev);
            }
        }
    }

    if (chk) {
        window.appConfig['opt_' + key] = Boolean(chk.checked);
        if (chk.checked) window.ensureParentDspBlocks(key);
    }
    if (inp) {
        let parsed = parseFloat(String(inp.value).replace(',', '.'));
        if (!isNaN(parsed)) window.appConfig['val_' + key] = parsed;
    }
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    if (typeof window.updateTopSearchOrMonitorBar === 'function') window.updateTopSearchOrMonitorBar();
    if (typeof window.buildAudioGraph === 'function') {
        if (window._dspInputDebounce) clearTimeout(window._dspInputDebounce);
        window._dspInputDebounce = setTimeout(() => window.buildAudioGraph(), 90);
    }
};

window.saveDspModRow = async function(key, btnEl, ev) {
    window.onDspModChange(key);
    const val = window.appConfig['val_' + key];
    const opt = Boolean(window.appConfig['opt_' + key]);
    try {
        await fetch('/api/config/save_single', { method: 'POST', body: JSON.stringify({category: 'main', key: 'val_' + key, value: val}) });
        await fetch('/api/config/save_single', { method: 'POST', body: JSON.stringify({category: 'main', key: 'opt_' + key, value: opt}) });
        if (btnEl) {
            let old = btnEl.innerHTML; btnEl.innerHTML = '✅';
            setTimeout(() => btnEl.innerHTML = old, 1000);
        }
    } catch (e) {}
    try { navigator.vibrate(30); } catch(e){}
};

window.loadDspModRow = async function(key, btnEl, ev) {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        window.appConfig = window.appConfig || {};
        window.appConfig['opt_' + key] = (data['opt_' + key] !== undefined) ? Boolean(data['opt_' + key]) : window.DSP_MOD_DEFAULTS['opt_' + key];
        window.appConfig['val_' + key] = (data['val_' + key] !== undefined) ? parseFloat(data['val_' + key]) : window.DSP_MOD_DEFAULTS['val_' + key];
        localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    if (typeof window.updateTopSearchOrMonitorBar === 'function') window.updateTopSearchOrMonitorBar();
        window.syncDspModUI();
        if (typeof window.buildAudioGraph === 'function') {
        if (window._dspInputDebounce) clearTimeout(window._dspInputDebounce);
        window._dspInputDebounce = setTimeout(() => window.buildAudioGraph(), 90);
    }
        if (btnEl) {
            let old = btnEl.innerHTML; btnEl.innerHTML = '✅';
            setTimeout(() => btnEl.innerHTML = old, 1000);
        }
    } catch (e) {}
    try { navigator.vibrate(30); } catch(e){}
};

window.resetDspGroup = function(keysList, msg, ev) {
    window.appConfig = window.appConfig || {};
    keysList.forEach(k => {
        window.appConfig['opt_' + k] = window.DSP_MOD_DEFAULTS['opt_' + k];
        window.appConfig['val_' + k] = window.DSP_MOD_DEFAULTS['val_' + k];
        const chk = document.getElementById('cfg_opt_' + k);
        const inp = document.getElementById('cfg_val_' + k);
        if (chk) chk.checked = Boolean(window.DSP_MOD_DEFAULTS['opt_' + k]);
        if (inp) inp.value = window.DSP_MOD_DEFAULTS['val_' + k];
    });
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    if (typeof window.updateTopSearchOrMonitorBar === 'function') window.updateTopSearchOrMonitorBar();
    if (typeof window.buildAudioGraph === 'function') {
        if (window._dspInputDebounce) clearTimeout(window._dspInputDebounce);
        window._dspInputDebounce = setTimeout(() => window.buildAudioGraph(), 90);
    }
    try { navigator.vibrate(35); } catch(e){}
    if (typeof window.showToast === 'function') window.showToast(msg, ev);
};

// 📚 ПОЛНАЯ БАЗА ЗНАНИЙ ПО ВСЕМ ПАРАМЕТРАМ ПЛЕЕРА (В РЕАЛЬНЫХ ЕДИНИЦАХ dB / % / Hz)
window.JENNY_HELP_DB = {
    format_slots: {
        title: "🎵 Поддерживаемые форматы файлов (8 слотов)",
        phys: "Фильтр расширений сканера папки. Поддерживает любые аудио-файлы (<b>mp3, opus, flac, wav, m4a, ogg, aac</b>) и видео-контейнеры со звуковой дорожкой (<b>mp4, webm, mkv</b>).",
        hear: "Любой включённый формат (даже видео <b>.mp4</b> с нашими тестами!) распаковывается напрямую в 32-bit Float RAM-движок и проходит через весь студийный тракт.",
        tip: "Галочками можно быстро скрыть или показать нужные типы файлов в плейлисте, а в текстовые поля — вписать любое своё расширение!"
    },
    studio_ram: {
        title: "🚀 Студийный движок (RAM)",
        phys: "Трек при открытии целиком распаковывается в оперативную память в студийный формат <b>32-bit Float PCM</b> + сразу создаётся его зеркальный реверс-буфер.",
        hear: "Мгновенная перемотка, скраббинг и разворот трека задом наперёд (тап по левому таймеру) без единой задержки.",
        tip: "Держи включённым всегда (в строке трека горит «RAM 🚀»)."
    },
    phase_focus: {
        title: "🎯 Фазовый фокус (Авто-пресет 3D + Вокал)",
        phys: "Готовый комплексный пресет: включает противофазный стерео-хвост в FIR-сатураторе (левое ухо +, правое −), разворачивает фазу середины с усилением <b>+1.7 dB (1.22x)</b> и включает автоматический мастер-потолок.",
        hear: "<b>ВКЛ:</b> голос выходит вперёд из-под баса, а сцена расширяется вокруг головы.<br><b>ВЫКЛ:</b> разблокирует ручной блок из 5 точечных настроек ниже.",
        tip: "При включении этой галочки ручной блок из 5 опций ниже блокируется и становится серым, чтобы режимы не конфликтовали."
    },
    mod_block: {
        title: "🧪 Тонкая настройка тракта (5 опций)",
        phys: "Ручной конструктор фазы вокала (dB), ширины СЧ купола (%), де-эссера ВЧ (dB), чистого FIR-драйва (dB) и автоматического мастер-потолка.",
        hear: "Работает, когда верхняя галочка «🎯 Фазовый фокус» снята. Позволяет нарулить идеальный баланс между мощным басом и чистым, близким голосом.",
        tip: "Каждую настройку можно сохранить кнопкой 💾 или сбросить к эталону кнопкой «🔄 Сброс»."
    },
    mod_midPhase: {
        title: "🎯 Фаза СЧ Вокал (dB)",
        phys: "Переворачивает волну средней полосы кроссовера на 180°, чтобы на стыке частот бас и вокал толкали мембрану наушника синхронно в одну сторону, и добавляет указанное усиление в децибелах (<b>dB</b>).",
        hear: "<b>ВЫКЛ:</b> глубокий клубный бас, голос чуть позади.<br><b>ВКЛ:</b> вокал сразу делает шаг вперёд прямо к лицу.",
        tip: "По умолчанию <b>+3 dB</b>. Хочешь голос ещё ближе и громче — ставь <b>+5...+8 dB</b>; хочешь мягче — <b>0...+2 dB</b>."
    },
    mod_midQ: {
        title: "📐 Ширина СЧ купола (%)",
        phys: "Управляет шириной полосового фильтра средней трубы кроссовера в процентах (где <b>100%</b> — штатная заводская ширина).",
        hear: "Расширяет охват средних частот, убирая узкий «коробочный» оттенок и делая стыки между басом, голосом и верхами бархатными и плавными.",
        tip: "По умолчанию <b>150%</b> (в полтора раза шире штатного). Для максимально открытой и широкой середины ставь <b>200%–300%</b> (ниже 25% срабатывает защита от «телефонной щели»)."
    },
    mod_deEsser: {
        title: "🐍 Де-эссер ВЧ (dB)",
        phys: "При мощном лимитере (-22 dB / Ratio 22) верхний компрессор вытягивает каждую букву «С/Ш/Ч» на уровень бочки. Де-эссер снижает сжатие верхов до 4:1 и меняет уровень ВЧ-полосы на указанное число <b>dB</b>.",
        hear: "Отрицательные значения (с минусом) убирают режущий свист на буквах «С» и «Ш» без потери мощи баса. Положительные — наоборот, добавляют яркости тарелкам.",
        tip: "По умолчанию <b>-6 dB</b>. Если трек очень резкий и свистит — ставь <b>-9...-12 dB</b>; если хочется поярче — <b>-3 dB</b>."
    },
    mod_cleanFir: {
        title: "✨ Драйв Чистый FIR (dB)",
        phys: "Заменяет однополярный хвост FIR-сатуратора на гладкую биполярную кривую без накопления низкочастотного гула и автоматически компенсирует длину импульса (хоть 4 мс, хоть 400 мс).",
        hear: "Убирает гулкое бубнение в бочке — бас становится сухим, быстрым и упругим, а параметр в <b>dB</b> регулирует насыщенность лампового окраса.",
        tip: "По умолчанию <b>+3 dB</b>. Для мягкого тёплого окраса ставь <b>0...+4 dB</b>, для плотного сатурационного рычания — <b>+6...+10 dB</b>."
    },
    mod_masterCeil: {
        title: "🛡️ Авто-Мастер-Потолок (Умный Анти-Клип)",
        phys: "Стоит в самом конце всего аудио-тракта. Автоматически суммирует разгон громкости от всех включённых тобой модулей (FIR + Вокал + Авто-RMS + Панч + Стерео + Бинаурал), вычисляет точную компенсацию перегруза в <b>dB</b> и пропускает сигнал через мягкий аналоговый софт-клиппер <b>Math.tanh</b>.",
        hear: "Полностью защищает звук от цифрового пердежа, хрипа и аварийного отключения ЦАПа при любых экстремальных комбинациях настроек.",
        tip: "На зелёном индикаторе справа в реальном времени видно, сколько децибел перегруза сейчас компенсирует система (например, <b>Авто: -4.2 dB</b>). Держи включённым всегда!"
    },
    pro_block: {
        title: "🚀 Мастеринг-Студия PRO (5 спец-модулей)",
        phys: "Пять студийных процессоров в реальных физических единицах (<b>dB, Hz, %</b>), работающих напрямую с механикой двух мембран наушников и 32-битным RAM-буфером.",
        hear: "Выравнивают громкость разных песен, собирают саб-бас в кулак по центру, создают 3D-панораму без потери баса, усиливают удар бочки и имитируют акустику комнаты.",
        tip: "Все 5 модулей автоматически учитываются Авто-Мастер-Потолком и впечатываются в файл при экспорте (💾)!"
    },
    pro_autoRms: {
        title: "⚡ Авто-RMS Цель (dB)",
        phys: "При загрузке трека в RAM за 2 мс сканирует массив сэмплов песни, вычисляет её реальную среднюю мощность (RMS в dB) и автоматически подстраивает уровень под твой целевой эталон (65% коррекции до лимитера + 35% после).",
        hear: "Решает проблему «для одной песни настройки те, для другой не те»: и тихие старые записи, и громкие современные треки звучат с одинаковой плотностью и громкостью!",
        tip: "По умолчанию <b>-10 dB</b>. Для более плотной накачки ставь <b>-8...-6 dB</b>; для спокойного динамичного звука — <b>-12...-14 dB</b>."
    },
    pro_monoBass: {
        title: "🧲 Моно-Саббас (Hz)",
        phys: "Через фазокогерентную Mid/Side матрицу убирает боковую разницу каналов ниже указанной частоты <b>Hz</b>, собирая весь саб-бас в идеальный синфазный центр (L = R).",
        hear: "Обе мембраны наушников начинают толкать басовый воздух строго синхронно. Удар бочки бьёт плотным кулаком ровно в центр головы, а вокал и гитары выше этой частоты остаются в широком стерео.",
        tip: "По умолчанию <b>120 Hz</b> (студийный эталон: <b>100 – 150 Hz</b>)."
    },
    pro_msWidth: {
        title: "🎭 Стерео-Ширина (%)",
        phys: "Комбинированный Mid/Side процессор + студийный 3D-Даблер (микро-сдвиг 5.8 мс слева и 8.9 мс справа выше 220 Гц). Центральный канал (Mid — бочка, бас и вокал) всегда сохраняется на 100%!",
        hear: "• <b>0%:</b> чистое Моно (весь звук в одной точке по центру).<br>• <b>100%:</b> оригинальное заводское стерео.<br>• <b>150%–300%:</b> широченный 3D-купол вокруг плеч без провала центрального баса и голоса!",
        tip: "По умолчанию <b>150%</b>. Оптимальная музыкальная зона для жирного объёма: <b>140% – 250%</b>."
    },
    pro_punch: {
        title: "🥁 Панч-Хлыст (dB)",
        phys: "Динамический ударный шейпер после лимитера: фокусирует фундаментальный пинок бочки (<b>72 Гц</b>) и атаку рабочего барабана (<b>2100 Гц</b>) с мягким широким куполом без резкого телефонного визга.",
        hear: "Положительные значения (<b>+4...+10 dB</b>) заставляют бочку физически «пинать» и пробивать микс, отрицательные (<b>-4...-10 dB</b>) делают удар мягким и бархатным.",
        tip: "По умолчанию <b>+6 dB</b>. Весь прирост энергии автоматически контролируется Авто-Мастер-Потолком, не допуская хрипа."
    },
    pro_crossfeed: {
        title: "🎧 Бинаурал-Колонки (%)",
        phys: "Имитирует прослушивание настоящих колонок в комнате: подмешивает в левое ухо копию правого канала (и наоборот) с естественной задержкой огибания головы (<b>0.42 мс</b>) и тёплым фильтром (<b>650 Гц</b>).",
        hear: "Убирает утомляющий «вакуум в голове», добавляет плотный грудной объём и выносит сцену вперёд перед лицом.",
        tip: "По умолчанию <b>75%</b>. Для лёгкого эффекта комнаты ставь <b>40%–60%</b>, для жирного клубного саунда — <b>100%–150%</b>."
    },
    scrub_group: {
        title: "⚡ Интеллектуальный Скраббинг и Таймеры",
        phys: "Система живого управления скоростью, направлением и перемоткой трека одним пальцем.",
        hear: "• <b>Удержание левого/правого края полосы трека + свайп вниз</b> — веер скоростей (слева реверс ⏪, справа вперёд ⏩).<br>• <b>Долгий тап по центру полосы</b> — сброс скорости к нормальной.<br>• <b>Тап по левому таймеру</b> — реверс; <b>по правому таймеру</b> — вперёд.",
        tip: "Долгий тап по кнопке Play/Pause плавно прокручивает список к играющему треку!"
    },
    left_hand: {
        title: "🖐️ Режим «Левша» (Зеркальная дуга)",
        phys: "Переносит опорную точку и веер скоростей под большой палец левой руки.",
        hear: "На звук не влияет — делает свайп дуги удобным для левой руки.",
        tip: "Переключается мгновенно."
    },
    pitch_lock: {
        title: "🎵 Сохранять темп / Тональность (Pitch Lock)",
        phys: "Определяет алгоритм изменения скорости трека.",
        hear: "<b>ВКЛ:</b> меняется только скорость, тембр голоса остаётся родным.<br><b>ВЫКЛ (Vinyl):</b> как виниловая пластинка — при замедлении голос и бит становятся ниже, темнее и жирнее (Slowed).",
        tip: "При сохранении трека (💾) с Pitch Lock работает фильтр FFmpeg atempo."
    },
    base_speed: {
        title: "🚀 Кастомная скорость (Base)",
        phys: "Заменяет стандартную скорость 1.0x на твою постоянную скорость.",
        hear: "Например, <b>0.97x</b> даёт более тяжёлый расслабленный грув на всех треках.",
        tip: "Галочка «↳ Писать выбор дуги сюда» автоматически сохраняет выбранную на дуге скорость как базовую."
    },
    scrub_speed: {
        title: "⏩ Дефолтная скорость дуги",
        phys: "Скорость, которая включается сразу при зажатии края полосы прогресса до свайпа по дуге.",
        hear: "Позволяет в одно касание ускорять или замедлять трек.",
        tip: "Галочка «↳ Писать выбор дуги сюда» обновляет это поле последним выбором на дуге."
    },
    scrub_zones: {
        title: "🎯 Кастомные радиальные зоны (6 слотов)",
        phys: "6 кружков скоростей, вылетающих веером при свайпе вниз.",
        hear: "Настрой свои любимые скорости (например, 0.85, 0.92, 1.15) и отключи лишние.",
        tip: "Кнопка «🔄 Сброс» возвращает стандартный набор."
    },
    amoled_mode: {
        title: "🖤 Режим AMOLED",
        phys: "Чистый чёрный фон (#000000) выключает пиксели AMOLED-матрицы.",
        hear: "Экономит батарею и бережёт глаза в темноте.",
        tip: "Рекомендуется держать включённым."
    },
    vol_slider: {
        title: "🔊 Показывать ползунок громкости",
        phys: "Показывает или скрывает кнопку динамика 🔊 / 🔥 на главном экране.",
        hear: "Управляет предусилителем громкости (до 300% с Овердрайвом).",
        tip: "При громкости выше 100% значок меняется на 🔥."
    },
    fir_group: {
        title: "✨ FIR-Сатуратор (Ламповый окрас)",
        phys: "Свёрточный процессор, накладывающий короткий затухающий импульс для насыщения гармониками (с авто-компенсацией длины хвоста).",
        hear: "Делает цифровую запись густой, тёплой и массивной.",
        tip: "Регулируется Усилением (Gain) и Импульсом (ms)."
    },
    fir_gain: {
        title: "✨ FIR: Усиление (Gain)",
        phys: "Мощность сигнала на выходе FIR-сатуратора.",
        hear: "Чем выше значение (оптимум <b>1.5–2.5</b>), тем плотнее звук вдавливается в лимитер.",
        tip: "Сохраняется кнопкой 💾."
    },
    fir_decay: {
        title: "✨ FIR: Импульс (ms)",
        phys: "Длина микро-хвоста сатурации в миллисекундах.",
        hear: "<b>2–6 ms:</b> плотный собранный удар.<br><b>10–30 ms:</b> жирный клубный объём.",
        tip: "Для чистого упругого баса без гула включай «✨ Драйв Чистый FIR» в верхнем блоке."
    },
    mb_group: {
        title: "🎚️ Многополосный кроссовер (3-Band)",
        phys: "Делит звук на 3 отдельные полосы (Бас, Середина, Верх) со своим независимым лимитером в каждой.",
        hear: "Не даёт мощным ударам баса просаживать громкость высоких частот и вокала.",
        tip: "Работает совместно с Лимитером (Soft Clipper)."
    },
    mb_low: {
        title: "🎚️ Отсечка Баса (Hz)",
        phys: "Граница раздела между басовым и средним компрессорами.",
        hear: "<b>160–280 Hz:</b> бас жмётся отдельно, а голос идёт свободно в средней полосе.<br><b>1200–1600 Hz:</b> слитный клубный памп-эффект.",
        tip: "На низких значениях (160–250 Hz) обязательно включай «🎯 Фаза СЧ Вокал (dB)», чтобы голос звучал близко и мощно."
    },
    mb_high: {
        title: "🎚️ Отсечка Верх (Hz)",
        phys: "Граница раздела между средней полосой и верхним компрессором.",
        hear: "<b>3500–4000 Hz:</b> яркий верх (включай Де-эссер -6 dB от свиста С/Ш).<br><b>7200 Hz:</b> мягкие шипящие, качается только верхний воздух.",
        tip: "Должна быть выше Отсечки Баса."
    },
    lim_group: {
        title: "🗜️ Лимитер (Soft Clipper)",
        phys: "Динамический пресс, сжимающий пики и поднимающий среднюю плотность трека (RMS).",
        hear: "Даёт мощный клубный напор.",
        tip: "Твой проверенный пресет: Порог -22, Knee 19, Ratio 22, Атака 26, Спад 60."
    },
    lim_thresh: {
        title: "🗜️ Лимитер: Порог (dB)",
        phys: "Уровень в dB, выше которого включается сжатие.",
        hear: "Чем ниже число с минусом (<b>-22 dB</b>), тем глубже захват волны и тем плотнее трек.",
        tip: "Рабочий диапазон: от -15 до -26 dB."
    },
    lim_knee: {
        title: "🗜️ Лимитер: Смягчение (Knee)",
        phys: "Плавность изгиба кривой сжатия.",
        hear: "Высокое значение (<b>18–22</b>) делает сжатие мягким и бархатным.",
        tip: "Убирает резкость на пиках."
    },
    lim_ratio: {
        title: "🗜️ Лимитер: Сжатие (Ratio)",
        phys: "Степень подавления пиков выше порога.",
        hear: "Высокие значения (<b>18–22</b>) включают плотное удержание уровня и авто-подъём тихих деталей.",
        tip: "Для максимального кача держи 16–22."
    },
    lim_attack: {
        title: "🗜️ Лимитер: Атака (ms)",
        phys: "Время срабатывания пресса после удара бочки.",
        hear: "<b>20–30 ms</b> пропускают стартовый щелчок ударных, сохраняя атаку.",
        tip: "Твои 26 ms идеально держат удар бочки."
    },
    lim_release: {
        title: "🗜️ Лимитер: Спад (ms)",
        phys: "Время восстановления громкости после удара.",
        hear: "<b>50–70 ms</b> дают упругое дыхание в такт биту.",
        tip: "Оптимум: 60 ms."
    },
    eq_group: {
        title: "🎛️ Эквалайзер (EQ IIR)",
        phys: "Включает или отключает 5-полосный эквалайзер из окна 🄠.",
        hear: "Позволяет в один клик сравнить звук с эквалайзером и без.",
        tip: "Сами ползунки — под иконкой 🄠 в шапке."
    },
    boost_group: {
        title: "🚀 Усилитель (Овердрайв)",
        phys: "Увеличивает максимальный предел ползунка громкости выше 100%.",
        hear: "Разгоняет вход лимитера для экстремальной накачки баса.",
        tip: "Мощность 5 = до 150% громкости, 10 = до 200%, 20 = до 300%."
    },
    eq_band_60: {
        title: "🔊 60 Гц — Саб-бас и Бочка",
        phys: "Низкочастотный шельф (Low Shelf) ниже 60–80 Гц.",
        hear: "Вправо (+) — мощная сабвуферная вибрация; влево (−) — сухой лёгкий низ.",
        tip: "Основа Bass-Boosted звука."
    },
    eq_band_230: {
        title: "🎸 230 Гц — Мид-бас и Теплота",
        phys: "Колокол на нижней середине 230 Гц.",
        hear: "Влево (−) — убирает коробочный бубнёж и очищает бас; вправо (+) — добавляет густоту.",
        tip: "Лёгкий минус делает саб-бас чище."
    },
    eq_band_910: {
        title: "🎤 910 Гц — Центр вокала",
        phys: "Среднечастотный фильтр основы голоса и инструментов.",
        hear: "Вправо (+) — приближает вокал к лицу; влево (−) — утапливает голос вглубь за бас.",
        tip: "Главный руль близости голоса в эквалайзере."
    },
    eq_band_3600: {
        title: "⚡ 3600 Гц — Чёткость и Присутствие",
        phys: "Зона максимальной чувствительности слуха (разборчивость слов и атака ударных).",
        hear: "Вправо (+) — кристальная разборчивость речи; влево (−) — мягкий, не режущий уши звук.",
        tip: "Управляет резкостью микса."
    },
    eq_band_14000: {
        title: "✨ 14 000 Гц — Воздух и Блеск",
        phys: "Высокочастотный шельф (High Shelf) самого верхнего спектра.",
        hear: "Вправо (+) — прозрачный «воздух» и рассыпчатые тарелки без свиста на С/Ш.",
        tip: "Добавляет Hi-Fi прозрачность."
    }
};

window.ensureHelpModal = function() {
    if (document.getElementById('jennyHelpModal')) return;
    const m = document.createElement('div');
    m.id = 'jennyHelpModal';
    m.style.cssText = "display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.8);backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:16px;box-sizing:border-box;";
    m.onclick = (e) => { if (e.target === m) m.style.display = 'none'; };
    m.innerHTML = `
        <div onclick="event.stopPropagation()" style="background:#0d1117;border:1px solid #7341be;border-radius:14px;max-width:440px;width:100%;max-height:82vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.9);overflow:hidden;">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#161b22;border-bottom:1px solid #30363d;">
                <span id="jhTitle" style="color:#58a6ff;font-weight:bold;font-size:15px;">📖 Справка</span>
                <button onclick="document.getElementById('jennyHelpModal').style.display='none'" style="background:transparent;border:none;color:#8b949e;font-size:18px;cursor:pointer;padding:2px 6px;">✖</button>
            </div>
            <div id="jhBody" style="padding:14px 16px;overflow-y:auto;color:#e6edf3;font-size:13.5px;line-height:1.5;display:flex;flex-direction:column;gap:10px;"></div>
            <div style="padding:10px 16px;background:#161b22;border-top:1px solid #30363d;display:flex;justify-content:flex-end;">
                <button onclick="document.getElementById('jennyHelpModal').style.display='none'" style="background:#238636;color:#fff;border:none;border-radius:8px;padding:8px 18px;font-weight:bold;font-size:13px;cursor:pointer;">Понятно 👍</button>
            </div>
        </div>
    `;
    document.body.appendChild(m);
};

window.showHelpTopic = function(key, ev) {
    if (ev) { ev.stopPropagation(); ev.preventDefault(); }
    try { navigator.vibrate(20); } catch(e){}
    window.ensureHelpModal();
    const item = window.JENNY_HELP_DB[key];
    if (!item) return;
    document.getElementById('jhTitle').innerHTML = item.title;
    document.getElementById('jhBody').innerHTML = `
        <div style="background:#161b22;border-left:3px solid #58a6ff;padding:10px 12px;border-radius:6px;">
            <div style="color:#58a6ff;font-size:11px;font-weight:bold;margin-bottom:4px;">🔧 ФИЗИКА НА ПАЛЬЦАХ:</div>
            <div>${item.phys}</div>
        </div>
        <div style="background:#161b22;border-left:3px solid #3fb950;padding:10px 12px;border-radius:6px;">
            <div style="color:#3fb950;font-size:11px;font-weight:bold;margin-bottom:4px;">🎧 ЧТО МЕНЯЕТСЯ НА СЛУХ:</div>
            <div>${item.hear}</div>
        </div>
        <div style="background:#1f1633;border-left:3px solid #a371f7;padding:10px 12px;border-radius:6px;">
            <div style="color:#d2a8ff;font-size:11px;font-weight:bold;margin-bottom:4px;">💡 ШПАРГАЛКА:</div>
            <div>${item.tip}</div>
        </div>
    `;
    document.getElementById('jennyHelpModal').style.display = 'flex';
};

window.showFullHelpGuide = function(ev) {
    if (ev) { ev.stopPropagation(); ev.preventDefault(); }
    try { navigator.vibrate(25); } catch(e){}
    window.ensureHelpModal();
    document.getElementById('jhTitle').innerHTML = "📖 Полный справочник Jenny Player";
    const html = Object.values(window.JENNY_HELP_DB).map(item => `
        <div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:10px 12px;">
            <div style="color:#58a6ff;font-weight:bold;font-size:14px;margin-bottom:6px;">${item.title}</div>
            <div style="margin-bottom:5px;color:#c9d1d9;"><b style="color:#79c0ff;">Физика:</b> ${item.phys}</div>
            <div style="margin-bottom:5px;color:#c9d1d9;"><b style="color:#56d364;">На слух:</b> ${item.hear}</div>
            <div style="color:#d2a8ff;font-size:12.5px;"><b>💡 Совет:</b> ${item.tip}</div>
        </div>
    `).join('');
    document.getElementById('jhBody').innerHTML = html;
    document.getElementById('jennyHelpModal').style.display = 'flex';
};

window.makeHelpBadge = function(topicKey) {
    const b = document.createElement('span');
    b.className = 'jenny-help-badge';
    b.innerHTML = '❓';
    b.style.cssText = "display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11.5px;margin-left:6px;cursor:pointer;flex-shrink:0;user-select:none;";
    b.onclick = (e) => window.showHelpTopic(topicKey, e);
    return b;
};

window.mountJennyStudioUI = function() {
    const sm = document.getElementById('settingsModal');
    if (!sm) return;
    const container = sm.querySelector('.container') || sm;

    // Чистим возможные старые дубли из прошлых версий
    ['phaseFocusMasterCard', 'dspModularSection', 'dspProStudioSection', 'jennyFullGuideBtn', 'dspModularBox'].forEach(oldId => {
        const oldEl = document.getElementById(oldId);
        if (oldEl) oldEl.remove();
    });
    document.querySelectorAll('.jenny-help-badge, .eq-band-hdr').forEach(el => el.remove());

    // 0. Большая кнопка полного справочника в самом верху настроек ⚙️
    const guideBtn = document.createElement('button');
    guideBtn.id = 'jennyFullGuideBtn';
    guideBtn.type = 'button';
    guideBtn.onclick = (e) => window.showFullHelpGuide(e);
    guideBtn.style.cssText = "width:100%;background:#161b22;border:1px solid #7341be;color:#d2a8ff;font-weight:bold;padding:11px;border-radius:8px;margin-bottom:12px;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 0 10px rgba(115,65,190,0.25);";
    guideBtn.innerHTML = "📖 ПОЛНЫЙ СПРАВОЧНИК ПО НАСТРОЙКАМ (❓)";
    container.insertBefore(guideBtn, container.firstChild);

    const studioInput = document.getElementById('cfg_studioMode');
    const ramCard = studioInput ? studioInput.closest('.setting-row') : null;

    // 1. Плашка "🎯 Фазовый фокус" прямо под Студийным движком (RAM)
    const pfCard = document.createElement('div');
    pfCard.id = 'phaseFocusMasterCard';
    pfCard.className = 'setting-row';
    pfCard.style.cssText = "border:none;background:var(--bg-setting-box);padding:10px;border-radius:6px;margin-bottom:12px;border-left:3px solid #8957e5;display:flex;align-items:center;justify-content:space-between;";
    pfCard.innerHTML = `
        <label class="toggle-label" style="color:#e6edf3;font-weight:bold;flex:1;">
            <input type="checkbox" id="cfg_phaseFix" onchange="window.onPhaseFocusChange(this, event)"> 🎯 Фазовый фокус (Выравнивание вокала и баса)
        </label>
    `;
    pfCard.appendChild(window.makeHelpBadge('phase_focus'));

    const buildRowsHTML = (rowsArr) => rowsArr.map(([k, lbl, stp, hKey]) => {
        if (k === 'masterCeil') {
            return `
            <div class="setting-row" style="border:none;padding:6px 0;gap:6px;">
                <div style="display:flex;align-items:center;flex:1;min-width:0;">
                    <label class="toggle-label" style="color:#e6edf3;font-size:12.5px;margin:0;">
                        <input type="checkbox" id="cfg_opt_masterCeil" onchange="window.onDspModChange('masterCeil')"> 🛡️ Авто-Мастер-Потолок:
                    </label>
                    <span class="jenny-help-badge" onclick="window.showHelpTopic('${hKey}', event)" style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11px;margin-left:5px;cursor:pointer;flex-shrink:0;">❓</span>
                </div>
                <span id="autoCeilStatusBadge" style="background:#161b22;border:1px solid #30363d;border-radius:6px;padding:4px 10px;font-size:11.5px;font-weight:bold;color:#3fb950;flex-shrink:0;">Авто: -0.5 dB</span>
            </div>`;
        }
        return `
        <div class="setting-row" style="border:none;padding:4px 0;gap:6px;">
            <div style="display:flex;align-items:center;flex:1;min-width:0;">
                <label class="toggle-label" style="color:#e6edf3;font-size:12.5px;margin:0;">
                    <input type="checkbox" id="cfg_opt_${k}" onchange="window.onDspModChange('${k}', event)"> ${lbl}
                </label>
                <span class="jenny-help-badge" onclick="window.showHelpTopic('${hKey}', event)" style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11px;margin-left:5px;cursor:pointer;flex-shrink:0;">❓</span>
            </div>
            <div style="display:flex;gap:4px;align-items:center;flex-shrink:0;">
                <button type="button" class="io-btn" onclick="window.loadDspModRow('${k}', this, event)">📥</button>
                <input type="number" step="${stp}" id="cfg_val_${k}" oninput="window.onDspModChange('${k}')" style="width:52px;">
                <button type="button" class="io-btn" onclick="window.saveDspModRow('${k}', this, event)">💾</button>
            </div>
        </div>`;
    }).join('');

    // 2. Блок "🧪 Тонкая настройка тракта (5 опций)" — блокируется при включённом Фазовом фокусе
    const rowsMod = [
        ['midPhase',   '🎯 Фаза СЧ Вокал (dB):',  '1',  'mod_midPhase'],
        ['midQ',       '📐 Ширина СЧ купола (%):', '10', 'mod_midQ'],
        ['deEsser',    '🐍 Де-эссер ВЧ (dB):',     '1',  'mod_deEsser'],
        ['cleanFir',   '✨ Драйв Чистый FIR (dB):','1',  'mod_cleanFir'],
        ['masterCeil', '🛡️ Мастер-потолок (dB):',  '1',  'mod_masterCeil']
    ];

    const modSection = document.createElement('details');
    modSection.id = 'dspModularSection';
    modSection.className = 'setting-group';
    modSection.open = true;
    modSection.style.borderLeft = "3px solid #a371f7";
    modSection.innerHTML = `
        <summary style="display:flex;align-items:center;justify-content:space-between;">
            <span>🧪 Тонкая настройка тракта (5 опций)</span>
            <span class="jenny-help-badge" onclick="window.showHelpTopic('mod_block', event)" style="display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11px;cursor:pointer;">❓</span>
        </summary>
        <div class="group-content" style="position:relative;">
            <div id="dspModLockShield" onclick="try{navigator.vibrate(40);}catch(e){}; if(window.showToast) window.showToast('🔒 Блок управления отключён! Для включения выключите «Фазовый фокус»', event);" style="display:none;position:absolute;inset:0;z-index:20;cursor:not-allowed;"></div>
            <div id="dspModBodyWrap" style="transition:opacity 0.2s ease, filter 0.2s ease;">
                <div class="setting-row" style="border:none;padding:2px 0 8px 0;">
                    <span style="color:#8b949e;font-size:12px;">Модули кроссовера и сатурации:</span>
                    <button type="button" onclick="window.resetDspGroup(['midPhase','midQ','deEsser','cleanFir','masterCeil'], '🔄 5 опций тракта сброшены!', event)" style="font-size:11px;padding:3px 8px;">🔄 Сброс</button>
                </div>
                ${buildRowsHTML(rowsMod)}
            </div>
        </div>
    `;

    // 3. Блок "🚀 Мастеринг-Студия PRO (5 спец-модулей)" — работает всегда!
    const rowsPro = [
        ['autoRms',   '⚡ Авто-RMS Цель (dB):',   '1',  'pro_autoRms'],
        ['monoBass',  '🧲 Моно-Саббас (Hz):',     '20', 'pro_monoBass'],
        ['msWidth',   '🎭 Стерео-Ширина (%):',    '25', 'pro_msWidth'],
        ['punch',     '🥁 Панч-Хлыст (dB):',      '1',  'pro_punch'],
        ['crossfeed', '🎧 Бинаурал-Колонки (%):', '10', 'pro_crossfeed']
    ];

    const proSection = document.createElement('details');
    proSection.id = 'dspProStudioSection';
    proSection.className = 'setting-group';
    proSection.open = true;
    proSection.style.borderLeft = "3px solid #3fb950";
    proSection.innerHTML = `
        <summary style="display:flex;align-items:center;justify-content:space-between;">
            <span>🚀 Мастеринг-Студия PRO (5 спец-модулей)</span>
            <span class="jenny-help-badge" onclick="window.showHelpTopic('pro_block', event)" style="display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11px;cursor:pointer;">❓</span>
        </summary>
        <div class="group-content">
            <div class="setting-row" style="border:none;padding:2px 0 8px 0;">
                <span style="color:#8b949e;font-size:12px;">Психоакустика и динамика мембран:</span>
                <button type="button" onclick="window.resetDspGroup(['autoRms','monoBass','msWidth','punch','crossfeed'], '🔄 Модули PRO Studio сброшены!', event)" style="font-size:11px;padding:3px 8px;">🔄 Сброс</button>
            </div>
            ${buildRowsHTML(rowsPro)}
        </div>
    `;

    if (ramCard) {
        ramCard.insertAdjacentElement('afterend', pfCard);
        pfCard.insertAdjacentElement('afterend', modSection);
        modSection.insertAdjacentElement('afterend', proSection);
    } else {
        container.appendChild(pfCard);
        container.appendChild(modSection);
        container.appendChild(proSection);
    }

    // 4. Привязываем значки ❓ ко всем штатным пунктам в settingsModal
    const idMap = [
        ['cfg_studioMode', 'studio_ram'],
        ['cfg_leftHandedMode', 'left_hand'],
        ['cfg_pitchLock', 'pitch_lock'],
        ['cfg_xNormalSpeed', 'base_speed'],
        ['cfg_amoledMode', 'amoled_mode'],
        ['cfg_volSlider', 'vol_slider'],
        ['cfg_firEnabled', 'fir_group'],
        ['cfg_fir_gain', 'fir_gain'],
        ['cfg_fir_decay', 'fir_decay'],
        ['cfg_multiBandEnabled', 'mb_group'],
        ['cfg_mb_low', 'mb_low'],
        ['cfg_mb_high', 'mb_high'],
        ['cfg_limiterEnabled', 'lim_group'],
        ['cfg_lim_threshold', 'lim_thresh'],
        ['cfg_lim_knee', 'lim_knee'],
        ['cfg_lim_ratio', 'lim_ratio'],
        ['cfg_lim_attack', 'lim_attack'],
        ['cfg_lim_release', 'lim_release'],
        ['cfg_eqEnabled', 'eq_group'],
        ['cfg_boosterEnabled', 'boost_group'],
        ['cfg_defaultScrubSpeed', 'scrub_speed'],
        ['cfg_z1_en', 'scrub_zones']
    ];

    idMap.forEach(([id, topic]) => {
        const el = document.getElementById(id);
        if (!el) return;
        const lbl = el.closest('label');
        if (lbl) {
            lbl.appendChild(window.makeHelpBadge(topic));
        } else {
            const row = el.closest('.setting-row');
            if (row && row.firstElementChild) {
                row.firstElementChild.appendChild(window.makeHelpBadge(topic));
            }
        }
    });

    // Значки ❓ на заголовки раскрывающихся секций <summary>
    document.querySelectorAll('#settingsModal summary').forEach(sum => {
        if (sum.querySelector('.jenny-help-badge')) return;
        const txt = sum.innerText || '';
        if (txt.includes('Интеллектуальный Скраббинг')) sum.appendChild(window.makeHelpBadge('scrub_group'));
        else if (txt.includes('FIR-Сатуратор')) sum.appendChild(window.makeHelpBadge('fir_group'));
        else if (txt.includes('Многополосный кроссовер')) sum.appendChild(window.makeHelpBadge('mb_group'));
        else if (txt.includes('Лимитер')) sum.appendChild(window.makeHelpBadge('lim_group'));
        else if (txt.includes('Эквалайзер')) sum.appendChild(window.makeHelpBadge('eq_group'));
        else if (txt.includes('Усилитель')) sum.appendChild(window.makeHelpBadge('boost_group'));
        else if (txt.includes('Форматы файлов')) sum.appendChild(window.makeHelpBadge('format_slots'));
    });

    // 5. Подписи частот и значки ❓ для 5 ползунков в окне Эквалайзера (🄠)
    const eqBands = [
        ['eq_60',    '60 Гц — Саб-бас (Глубина и бочка)',         'eq_band_60'],
        ['eq_230',   '230 Гц — Мид-бас (Теплота / Анти-бубнёж)',  'eq_band_230'],
        ['eq_910',   '910 Гц — Середина (Основа вокала)',         'eq_band_910'],
        ['eq_3600',  '3600 Гц — Верхняя СЧ (Близость и чёткость)', 'eq_band_3600'],
        ['eq_14000', '14 000 Гц — Воздух (Блеск и тарелки)',      'eq_band_14000']
    ];
    eqBands.forEach(([id, title, topic]) => {
        const slider = document.getElementById(id);
        if (slider) {
            const hdr = document.createElement('div');
            hdr.className = 'eq-band-hdr';
            hdr.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:-12px;color:#c9d1d9;font-size:12.5px;font-weight:bold;";
            hdr.innerHTML = `<span>${title}</span>`;
            hdr.appendChild(window.makeHelpBadge(topic));
            slider.parentNode.insertBefore(hdr, slider);
        }
    });

    window.syncDspModUI();
    if (typeof window.syncFormatSlotsUI === 'function') window.syncFormatSlotsUI();
    if (typeof window.installFormatAwareFetchData === 'function') {
        window.installFormatAwareFetchData();
        setTimeout(() => {
            window.installFormatAwareFetchData();
            if (typeof window.fetchData === 'function') window.fetchData();
        }, 100);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", window.mountJennyStudioUI);
} else {
    window.mountJennyStudioUI();
}

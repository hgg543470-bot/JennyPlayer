
window.ensureParentDspBlocks = function(triggerKey, ev) {
    window.appConfig = window.appConfig || {};
    let autoTurned = [];
    if (triggerKey === 'cleanFir' || triggerKey === 'phaseFix') {
        if (!window.appConfig.firEnabled) {
            window.appConfig.firEnabled = true;
            let el = document.getElementById('cfg_firEnabled');
            if (el) el.checked = true;
            autoTurned.push('FIR');
        }
    }
    if (['midPhase', 'midQ', 'deEsser', 'masterCeil', 'phaseFix'].includes(triggerKey)) {
        if (!window.appConfig.limiterEnabled) {
            window.appConfig.limiterEnabled = true;
            let el = document.getElementById('cfg_limiterEnabled');
            if (el) el.checked = true;
            autoTurned.push('Лимитер');
        }
        if (!window.appConfig.multiBandEnabled) {
            window.appConfig.multiBandEnabled = true;
            let el = document.getElementById('cfg_multiBandEnabled');
            if (el) el.checked = true;
            autoTurned.push('3-Band Кроссовер');
        }
    }
    if (autoTurned.length > 0 && typeof window.showToast === 'function') {
        window.showToast("⚡ Авто-включено для работы: " + autoTurned.join(' + '), ev);
    }
};

// =========================================================================
// 📖 UI_HELP.JS (МОДУЛИ ТРАКТА, PRO STUDIO И СПРАВОЧНИК ❓ ПО ВСЕМ ПУНКТАМ)
// =========================================================================

window.ALL_MOD_KEYS = [
    'midPhase', 'midQ', 'deEsser', 'cleanFir', 'masterCeil',
    'autoRms', 'monoBass', 'msWidth', 'punch', 'crossfeed'
];

window.syncDspModUI = function() {
    const cfg = window.appConfig || {};
    // Авто-перевод старых абстрактных цифр в новые dB и %
    if (!cfg._migratedToRealUnitsV9) {
        cfg._migratedToRealUnitsV9 = true;
        Object.keys(window.DSP_MOD_DEFAULTS).forEach(k => {
            if (k.startsWith('val_')) cfg[k] = window.DSP_MOD_DEFAULTS[k];
        });
        localStorage.setItem('ytm_config', JSON.stringify(cfg));
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
};

window.onPhaseFocusChange = function(el, ev) {
    window.appConfig = window.appConfig || {};
    window.appConfig.phaseFixEnabled = Boolean(el.checked);
    if (el.checked) window.ensureParentDspBlocks('phaseFix', ev);
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    window.syncDspModUI();
    if (typeof window.buildAudioGraph === 'function') window.buildAudioGraph();
    try { navigator.vibrate(40); } catch(e){}
    if (el.checked && typeof window.showToast === 'function') {
        window.showToast("🔒 Блок управления отключён! Для включения выключите «Фазовый фокус»", ev);
    } else if (!el.checked && typeof window.showToast === 'function') {
        window.showToast("🔓 Ручной блок тонкой настройки активен!", ev);
    }
};

window.onDspModChange = function(key) {
    window.appConfig = window.appConfig || {};
    const chk = document.getElementById('cfg_opt_' + key);
    const inp = document.getElementById('cfg_val_' + key);
    if (chk) {
        window.appConfig['opt_' + key] = Boolean(chk.checked);
        if (chk.checked) window.ensureParentDspBlocks(key);
    }
    if (inp) {
        let parsed = parseFloat(String(inp.value).replace(',', '.'));
        if (!isNaN(parsed)) window.appConfig['val_' + key] = parsed;
    }
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    if (typeof window.buildAudioGraph === 'function') window.buildAudioGraph();
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
        window.syncDspModUI();
        if (typeof window.buildAudioGraph === 'function') window.buildAudioGraph();
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
    if (typeof window.buildAudioGraph === 'function') window.buildAudioGraph();
    try { navigator.vibrate(35); } catch(e){}
    if (typeof window.showToast === 'function') window.showToast(msg, ev);
};

// 📚 ПОЛНАЯ БАЗА ЗНАНИЙ ПО ВСЕМ ПАРАМЕТРАМ ПЛЕЕРА
window.JENNY_HELP_DB = {
    studio_ram: {
        title: "🚀 Студийный движок (RAM)",
        phys: "Трек при открытии целиком распаковывается в оперативную память в студийный формат <b>32-bit Float PCM</b> + сразу создаётся его реверс-буфер.",
        hear: "Мгновенная перемотка, скраббинг и реверс по левому таймеру без задержек.",
        tip: "Держи включённым всегда (в строке трека горит «RAM 🚀»)."
    },
    phase_focus: {
        title: "🎯 Фазовый фокус (Авто-пресет 3D + Вокал)",
        phys: "Включает противофазный стерео-хвост в FIR-сатураторе (левое ухо +, правое −), разворачивает фазу середины с усилением <b>1.22x</b> и ставит мастер-потолок <b>-1 dB</b>.",
        hear: "<b>ВКЛ:</b> голос выходит вперёд из-под баса, а сцена расширяется вокруг головы.<br><b>ВЫКЛ:</b> разблокирует ручной блок из 5 точечных настроек ниже.",
        tip: "При включении этой галочки ручной блок из 5 опций ниже блокируется и становится серым."
    },
    mod_block: {
        title: "🧪 Тонкая настройка тракта (5 опций)",
        phys: "Ручной конструктор фазы, добротности, де-эссера, биполярного FIR и мастер-потолка.",
        hear: "Работает, когда верхняя галочка «🎯 Фазовый фокус» снята. Если выключить все 5 галочек — работает базовый Bass-Boosted режим.",
        tip: "Каждую цифру можно сохранить в свой пресет кнопкой 💾."
    },
    mod_midPhase: {
        title: "🎯 Инверсия фазы СЧ (Гейн)",
        phys: "Переворачивает волну средней полосы кроссовера на 180°, чтобы на стыке частот бас и вокал толкали мембрану наушника синхронно в одну сторону, а не гасили друг друга.",
        hear: "<b>ВЫКЛ:</b> глубокий клубный бас, голос чуть позади.<br><b>ВКЛ:</b> вокал делает шаг вперёд прямо к лицу.",
        tip: "По умолчанию <b>1.15</b>. Хочешь голос ещё ближе — ставь <b>1.25–1.35</b>."
    },
    mod_midQ: {
        title: "📐 Широкий купол СЧ (Множитель Q)",
        phys: "Расширяет полосовой фильтр средней трубы кроссовера.",
        hear: "Убирает узкий «коробочный» оттенок на середине и делает стыки между басом, голосом и верхами плавными.",
        tip: "По умолчанию <b>0.65</b>. Чем меньше число (например, <b>0.45</b>), тем шире охват середины."
    },
    mod_deEsser: {
        title: "🐍 Де-эссер ВЧ (Анти-свист С/Ш)",
        phys: "При мощном лимитере (-22 dB / Ratio 22) верхний компрессор вытягивает каждую букву «С/Ш/Ч» на уровень бочки. Де-эссер снижает Ratio верхов до 4:1 и приглушает пик сибилянтов.",
        hear: "Убирает режущий свист на буквах «С» и «Ш» без потери мощи баса.",
        tip: "По умолчанию <b>0.66</b> (-3.5 dB). Если ещё подсвистывает — ставь <b>0.50</b>."
    },
    mod_cleanFir: {
        title: "✨ Чистый FIR-импульс (Анти-гул)",
        phys: "Меняет однополярный плюсовой хвост FIR-сатуратора на двустороннюю волну (плюс/минус без накопления постоянной басовой мути).",
        hear: "Убирает гулкое бубнение в бочке — бас становится быстрым, собранным и упругим.",
        tip: "По умолчанию <b>0.03</b>. Меньше (<b>0.015</b>) — суше, больше (<b>0.05</b>) — гуще."
    },
    mod_masterCeil: {
        title: "🛡️ Мастер-потолок (dB)",
        phys: "Финальный защитный лимитер после сложения трёх полос (Бас + Голос + Верх).",
        hear: "Не даёт сумме трёх раскачанных компрессоров пробивать 0 dB и хрипеть при экспорте в файл.",
        tip: "По умолчанию <b>-1.0 dB</b>."
    },
    pro_block: {
        title: "🚀 Мастеринг-Студия PRO (5 спец-модулей)",
        phys: "Пять эксклюзивных студийных процессоров, работающих напрямую с механикой двух мембран наушников и 32-битным RAM-буфером.",
        hear: "Выравнивают громкость разных песен под твой лимитер, собирают саб-бас в кулак по центру, раздвигают стереосцену, усиливают щелчок барабанов и снимают усталость ушей.",
        tip: "Все 5 модулей работают независимо от «Фазового фокуса» и впечатываются в файл при нажатии 💾!"
    },
    pro_autoRms: {
        title: "⚡ Авто-RMS Вход (Умная нормализация под лимитер)",
        phys: "При загрузке трека в RAM за 2 миллисекунды сканирует массив сэмплов песни, вычисляет её реальную среднюю мощность (RMS в dB) и автоматически подстраивает входной гейн (в пределах ±9 dB) под твой эталон.",
        hear: "Решает проблему «для одной песни настройки те, для другой не те»: и тихие старые записи, и громкие современные треки входят в твой лимитер с одинаковой плотностью!",
        tip: "По умолчанию <b>-11.0 dB</b>. Хочешь, чтобы все треки жались ещё плотнее и агрессивнее — ставь <b>-9.0</b>; мягче — <b>-13.0</b>."
    },
    pro_monoBass: {
        title: "🧲 Моно-Саббас (Синхронный поршень < Hz)",
        phys: "Все частоты ниже указанной границы складываются в идеальное моно (L = R), а всё, что выше (голос, гитары, тарелки), остаётся в полном стерео.",
        hear: "Обе мембраны наушников начинают толкать басовый воздух строго синхронно, без перекоса между левым и правым ухом. Удар бочки собирается в плотный кулак ровно в центре головы.",
        tip: "Золотой студийный стандарт: <b>110 – 130 Hz</b>."
    },
    pro_msWidth: {
        title: "🎭 Стерео-Ширина Side (Mid/Side Матрица)",
        phys: "Раскладывает стереосигнал на Центр (Mid = L+R, где сидят вокал и бочка) и Края (Side = L−R, где живут гитары, синты и объём комнаты), умножая ширину краёв на твой коэффициент.",
        hear: "• <b>1.0:</b> стандартное стерео.<br>• <b>1.30–1.50:</b> широкая голографическая панорама вокруг головы без провала центрального вокала.<br>• <b>0.0:</b> режим чистого Моно (удобно для проверки фазы или если один наушник в ухе).",
        tip: "По умолчанию <b>1.35</b> (+35% ширины сцены)."
    },
    pro_punch: {
        title: "🥁 Панч-Хлыст Атаки (Transient Boost dB)",
        phys: "Подчёркивает зону пинка бочки (105 Гц) и щелчка снейра (3100 Гц) через компрессор с медленной атакой (38 мс), который свободно пропускает первые миллисекунды удара барабана.",
        hear: "Даже при экстремальном лимитере или на замедленной скорости (Slowed) барабаны не размазываются в кашу, а хлёстко «щёлкают» и пробивают микс.",
        tip: "По умолчанию <b>4.5 dB</b>. Для жёсткого клубного удара ставь <b>6.0 – 8.0</b>."
    },
    pro_crossfeed: {
        title: "🎧 Бинаурал «Колонки» (Естественный Crossfeed ms)",
        phys: "В реальной жизни звук левой колонки доходит до правого уха через ~0.28 мс, обогнув голову и потеряв высокие частоты (>750 Гц). Этот модуль имитирует акустику комнаты в наушниках.",
        hear: "Убирает утомляющий «вакуум в голове», когда звук заперт раздельно в левом и правом ухе. Сцена выносится вперёд перед лицом, как у настоящих мониторных колонок.",
        tip: "По умолчанию <b>0.28 ms</b> (акустический размер головы человека). Для более широкой комнаты попробуй <b>0.35 – 0.45 ms</b>."
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
        phys: "Свёрточный процессор, накладывающий короткий затухающий импульс для насыщения гармониками.",
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
        hear: "<b>2–4 ms:</b> плотный собранный удар.<br><b>8–15 ms:</b> жирный сабвуферный наплыв.",
        tip: "Если на больших значениях появляется гул — включи «✨ Чистый FIR» выше."
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
        hear: "<b>220–280 Hz:</b> бас отдельно, голос отдельно.<br><b>1400–1600 Hz:</b> фирменный слитный Bass-Boost кач.",
        tip: "На низких значениях (250 Hz) включай «Инверсию фазы СЧ» или «Фазовый фокус»."
    },
    mb_high: {
        title: "🎚️ Отсечка Верх (Hz)",
        phys: "Граница раздела между средней полосой и верхним компрессором.",
        hear: "<b>3500 Hz:</b> яркий верх (включай Де-эссер от свиста С/Ш).<br><b>7200–7600 Hz:</b> мягкие шипящие, качается только верхний воздух.",
        tip: "Должна быть выше Отсечки Баса."
    },
    lim_group: {
        title: "🗜️ Лимитер (Soft Clipper)",
        phys: "Динамический пресс, сжимающий пики и поднимающий среднюю плотность трека (RMS).",
        hear: "Даёт мощный клубный напор без цифрового хрипа.",
        tip: "Твой проверенный пресет: Порог -22, Knee 19, Ratio 22, Атака 26, Спад 60."
    },
    lim_thresh: {
        title: "🗜️ Лимитер: Порог (dB)",
        phys: "Уровень в dB, выше которого включается сжатие.",
        hear: "Чем ниже число с минусом (<b>-22 dB</b>), тем глубже захват волны и тем плотнее и громче трек.",
        tip: "Рабочий диапазон: от -15 до -26 dB."
    },
    lim_knee: {
        title: "🗜️ Лимитер: Смягчение (Knee)",
        phys: "Плавность изгиба кривой сжатия.",
        hear: "Высокое значение (<b>18–22</b>) превращает жёсткий лимитер в мягкий бархатный софт-клиппер.",
        tip: "Убирает треск на пиках."
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
        hear: "<b>20–30 ms</b> пропускают стартовый щелчок (панч) ударных, сохраняя жизнь и динамику.",
        tip: "Если поставить 1 мс — бочка станет плоской."
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
        hear: "Вправо (+) — приближает певицу к лицу; влево (−) — утапливает вокал вглубь за бас.",
        tip: "Главный руль близости голоса."
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
                    <input type="checkbox" id="cfg_opt_${k}" onchange="window.onDspModChange('${k}')"> ${lbl}
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
};

if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", window.mountJennyStudioUI);
} else {
    window.mountJennyStudioUI();
}

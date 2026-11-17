/* ============================================================================
 * ui_help.js — Справка: база подсказок RU/EN, окно справки, значки ❓, сборка интерфейса студии
 *
 * Склейка:  /bundle_1_studio.js, модуль 4 из 12. Порядок модулей задан в player.py и менять его нельзя:
 *           поздние модули переопределяют и оборачивают функции ранних.
 * Внутри:   getHelpDB, ensureHelpModal, showHelpTopic, showFullHelpGuide, makeHelpBadge, mountJennyStudioUI, syncGuideButtonPositionV165, onToggleHideHelpBadgesV62, injectHideHelpToggleV62
 * Откуда:   ui_help.js (коммит 9ae6639), строки 478–740, 4012–4089. Код блоков перенесён без правок.
 * Подробно: FILES.md (карта файлов), REFACTOR_PLAN.md (как резалось и что перекрыто).
 * ============================================================================ */

window.JENNY_HELP_DB_RU = {
    format_slots: { title: "🎵 Поддерживаемые форматы файлов (8 слотов)", phys: "Фильтр расширений сканера папки (<b>mp3, opus, flac, wav, m4a, ogg, aac, mp4</b>).", hear: "Любой включённый формат распаковывается напрямую в 32-bit Float RAM-движок и проходит через весь студийный тракт.", tip: "Галочками можно быстро скрыть или показать нужные типы файлов в плейлисте." },
    studio_ram: { title: "🚀 Студийный движок (RAM)", phys: "Трек целиком распаковывается в RAM в формат <b>32-bit Float PCM</b> + сразу создаётся его реверс-буфер.", hear: "Мгновенная перемотка, скраббинг и реверс без задержек.", tip: "Держи включённым всегда («RAM 🚀»)." },
    phase_focus: { title: "🎯 Фазовый фокус (Авто-пресет 3D + Вокал)", phys: "Включает противофазный стерео-хвост в FIR, разворачивает фазу СЧ (+1.7 dB) и включает авто-потолок.", hear: "Голос выходит вперёд из-под баса, а сцена расширяется вокруг головы.", tip: "При включении ручной блок из 5 опций ниже блокируется." },
    mod_block: { title: "🧪 Тонкая настройка тракта (5 опций)", phys: "Ручной конструктор фазы вокала (dB), ширины СЧ купола (%), де-эссера ВЧ (dB), чистого FIR-драйва (dB) и авто-потолка.", hear: "Работает, когда галочка «🎯 Фазовый фокус» снята.", tip: "Сохраняется кнопкой 💾 или сбрасывается кнопкой «🔄 Сброс»." },
    mod_midPhase: { title: "🎯 Фаза СЧ Вокал (dB)", phys: "Синхронизирует фазу СЧ-полосы с басом и добавляет усиление в <b>dB</b>.", hear: "Вокал сразу делает шаг вперёд прямо к лицу.", tip: "По умолчанию <b>+3 dB</b> (диапазон +2...+8 dB)." },
    mod_midQ: { title: "📐 Ширина СЧ купола (%)", phys: "Управляет шириной полосового фильтра средней полосы кроссовера (100% — штатная).", hear: "Убирает коробочный оттенок и делает стыки полос бархатными.", tip: "По умолчанию <b>150%</b> (для широкой середины ставь 200%–300%)." },
    mod_deEsser: { title: "🐍 Де-эссер ВЧ (dB)", phys: "Снижает сжатие верхов до 4:1 и меняет уровень ВЧ-полосы в <b>dB</b>.", hear: "Убирает режущий свист на буквах «С» и «Ш» без потери баса.", tip: "По умолчанию <b>-6 dB</b>." },
    mod_cleanFir: { title: "✨ Драйв Чистый FIR (dB)", phys: "Гладкая биполярная кривая FIR-сатуратора с окном Хэннинга без накопления гула.", hear: "Бас становится сухим, быстрым и упругим с ламповым рычанием.", tip: "По умолчанию <b>+3 dB</b>." },
    mod_masterCeil: { title: "🛡️ Авто-Мастер-Потолок (Умный Анти-Клип)", phys: "Суммирует разгон от всех модулей, вычисляет компенсацию в <b>dB</b> и включает мягкий софт-клиппер <b>Math.tanh</b>.", hear: "Полностью защищает от цифрового клиппинга и хрипа.", tip: "Держи включённым всегда!" },
    pro_block: { title: "🚀 Мастеринг-Студия PRO (5 спец-модулей)", phys: "Пять студийных процессоров в реальных физических единицах (<b>dB, Hz, %</b>).", hear: "Выравнивают RMS громкость, собирают саб-бас в центр, дают 3D-сцену, панч бочки и бинауральную комнату.", tip: "Учитываются Авто-Потолком и впечатываются при экспорте (💾)!" },
    pro_autoRms: { title: "⚡ Авто-RMS Цель (dB)", phys: "Сканирует сэмплы песни в RAM и автоматически выравнивает среднюю плотность (RMS) под эталон.", hear: "Тихие и громкие треки звучат с одинаковой плотностью и мощью!", tip: "По умолчанию <b>-10 dB</b>." },
    pro_monoBass: { title: "🧲 Моно-Саббас (Hz)", phys: "Через Mid/Side матрицу собирает весь саб-бас ниже указанной частоты <b>Hz</b> в идеальный центр (L = R).", hear: "Бочка бьёт плотным кулаком ровно в центр головы.", tip: "По умолчанию <b>120 Hz</b>." },
    pro_msWidth: { title: "🎭 Стерео-Ширина (%)", phys: "Mid/Side матрица + 2-полосный боковой эксайтер (135 Гц + 8500 Гц) + 90° All-Pass декореллятор.", hear: "Создаёт голографический 3D-купол вокруг плеч без потери баса!", tip: "По умолчанию <b>160%</b>." },
    pro_punch: { title: "🥁 Панч-Хлыст (dB)", phys: "3-точечный шейпер: усиливает пинок бочки (85 Гц), убирает муть (230 Гц) и подчёркивает атаку снейра (2600 Гц).", hear: "Заставляет ударные физически пробивать микс.", tip: "По умолчанию <b>+6 dB</b>." },
    pro_crossfeed: { title: "🎧 Бинаурал-Колонки (%)", phys: "Имитирует акустику колонок в комнате с задержкой огибания головы (0.42 мс) и фильтром (650 Гц).", hear: "Убирает вакуум в голове и выносит сцену перед лицом.", tip: "По умолчанию <b>75%</b>." },
    scrub_group: { title: "⚡ Интеллектуальный Скраббинг и Таймеры", phys: "Управление скоростью, реверсом и перемоткой одним пальцем.", hear: "Удержание края полосы + свайп вниз — веер скоростей; тап по левому таймеру — реверс, по правому — вперёд.", tip: "Долгий тап по Play/Pause прокручивает список к текущему треку!" },
    left_hand: { title: "🖐️ Режим «Левша»", phys: "Зеркально переносит дугу скоростей под левую руку.", hear: "Удобный свайп большим пальцем левой руки.", tip: "Переключается мгновенно." },
    pitch_lock: { title: "🎵 Сохранять темп (Pitch Lock)", phys: "Алгоритм сохранения высоты тона при изменении скорости.", hear: "ВКЛ: родной тембр голоса. ВЫКЛ: виниловый Slowed-эффект.", tip: "Работает и при экспорте трека (💾)." },
    base_speed: { title: "🚀 Кастомная скорость (Base)", phys: "Заменяет стандартную скорость 1.0x на твою постоянную.", hear: "Например, 0.97x даёт расслабленный тяжёлый грув.", tip: "Можно авто-сохранять с дуги." },
    scrub_speed: { title: "⏩ Дефолтная скорость дуги", phys: "Скорость при зажатии края полосы до свайпа по дуге.", hear: "Мгновенное ускорение или замедление в одно касание.", tip: "Обновляется с дуги." },
    scrub_zones: { title: "🎯 Кастомные радиальные зоны", phys: "6 слотов скоростей веера.", hear: "Настрой свои любимые скорости.", tip: "Кнопка «🔄 Сброс» возвращает эталон." },
    amoled_mode: { title: "🖤 Режим AMOLED", phys: "Чистый чёрный фон (#000000).", hear: "Экономит заряд экрана и бережёт глаза.", tip: "Держи включённым." },
    vol_slider: { title: "🔊 Показывать ползунок громкости", phys: "Иконка динамика 🔊 / 🔥 на главном экране.", hear: "Предусилитель громкости до 300%.", tip: "Выше 100% загорается 🔥." },
    fir_group: { title: "✨ FIR-Сатуратор", phys: "Свёрточный ламповый сатуратор гармоник.", hear: "Делает звук густым, тёплым и массивным.", tip: "Настраивается Gain и Impulse (ms)." },
    fir_gain: { title: "✨ FIR: Усиление (Gain)", phys: "Мощность сигнала на выходе FIR.", hear: "Оптимум 1.5–2.5 для плотной накачки.", tip: "Сохраняется кнопкой 💾." },
    fir_decay: { title: "✨ FIR: Импульс (ms)", phys: "Длина хвоста сатурации в мс.", hear: "2–6 ms: чёткий удар; 10–30 ms: клубный объём.", tip: "Включай «Драйв Чистый FIR» против гула." },
    mb_group: { title: "🎚️ Многополосный кроссовер (3-Band)", phys: "Делит спектр на Бас, Середину и Верх с независимой компрессией.", hear: "Мощный бас не просаживает вокал и тарелки.", tip: "Работает в паре с Лимитером." },
    mb_low: { title: "🎚️ Отсечка Баса (Hz)", phys: "Граница между басом и серединой.", hear: "160–320 Hz отделяют саб-бас от голоса; 1600 Hz даёт слитный памп.", tip: "Вокал защищён от басового гула." },
    mb_high: { title: "🎚️ Отсечка Верх (Hz)", phys: "Граница между серединой и верхами.", hear: "3600–7200 Hz определяют зону блеска и тарелок.", tip: "Выше Отсечки Баса." },
    lim_group: { title: "🗜️ Лимитер (Soft Clipper)", phys: "Динамический пресс пиков.", hear: "Даёт плотный студийный напор.", tip: "Эталон: -22, 19, 22, 26, 60." },
    lim_thresh: { title: "🗜️ Порог (dB)", phys: "Уровень включения компрессии.", hear: "-22 dB даёт глубокий захват волны.", tip: "Диапазон -15...-26 dB." },
    lim_knee: { title: "🗜️ Смягчение (Knee)", phys: "Плавность колена компрессии.", hear: "18–22 делает сжатие мягким.", tip: "Убирает резкость." },
    lim_ratio: { title: "🗜️ Сжатие (Ratio)", phys: "Сила удержания пиков.", hear: "18–22 вытягивает тихие детали.", tip: "Держи 16–22." },
    lim_attack: { title: "🗜️ Атака (ms)", phys: "Время пропуска стартового удара бочки.", hear: "26 ms сохраняют хлёсткий удар.", tip: "Оптимум 20–30 ms." },
    lim_release: { title: "🗜️ Спад (ms)", phys: "Время восстановления после пика.", hear: "60 ms дают упругий кач в такт.", tip: "Оптимум 50–70 ms." },
    eq_group: { title: "🎛️ Эквалайзер (EQ IIR)", phys: "Включает 5-полосный эквалайзер 🄠.", hear: "Быстрое сравнение звука с EQ и без.", tip: "Ползунки под кнопкой 🄠." },
    boost_group: { title: "🚀 Усилитель (Овердрайв)", phys: "Разгон громкости выше 100%.", hear: "Экстремальная накачка входа лимитера.", tip: "Мощность 5 = 150%, 20 = 300%." },
    eq_band_60: { title: "🔊 60 Гц — Саб-бас", phys: "Шельф низких частот.", hear: "Глубокая вибрация сабвуфера.", tip: "Основа баса." },
    eq_band_230: { title: "🎸 230 Гц — Мид-бас", phys: "Нижняя середина.", hear: "Минус убирает бубнёж, плюс даёт густоту.", tip: "Чистит микс." },
    eq_band_910: { title: "🎤 910 Гц — Центр вокала", phys: "Основа голоса.", hear: "Плюс приближает вокал к лицу.", tip: "Главный руль голоса." },
    eq_band_3600: { title: "⚡ 3600 Гц — Чёткость", phys: "Разборчивость речи и атака.", hear: "Плюс даёт ясность, минус смягчает резкость.", tip: "Контроль присутствия." },
    eq_band_14000: { title: "✨ 14 000 Гц — Воздух", phys: "Верхний шельф блеска.", hear: "Добавляет прозрачность и рассыпчатые тарелки.", tip: "Hi-Fi воздух." }
};

window.JENNY_HELP_DB_EN = {
    format_slots: { title: "🎵 Supported File Formats (8 Slots)", phys: "Folder scanner filter (<b>mp3, opus, flac, wav, m4a, ogg, aac, mp4</b>).", hear: "Every enabled format decodes straight into the 32-bit Float RAM engine and flows through the full DSP chain.", tip: "Toggle checkboxes to instantly filter file types in your playlist." },
    studio_ram: { title: "🚀 Studio Engine (RAM)", phys: "Unpacks the entire track into RAM as <b>32-bit Float PCM</b> + pre-builds a reverse buffer.", hear: "Zero-latency seeking, live scrubbing, and instant reverse playback.", tip: "Keep enabled at all times ('RAM 🚀')." },
    phase_focus: { title: "🎯 Phase Focus (Auto 3D + Vocal Preset)", phys: "Engages out-of-phase stereo FIR tail, aligns midrange phase (+1.7 dB), and locks Auto-Master Ceiling.", hear: "Vocals step forward out of the bass while the soundstage expands around your head.", tip: "Locks the 5 manual controls below when active." },
    mod_block: { title: "🧪 Signal Path Fine-Tuning (5 Options)", phys: "Manual toolkit for Vocal Mid Gain (dB), Mid Dome Width (%), HF De-Esser (dB), Clean FIR Drive (dB), and Auto-Ceiling.", hear: "Active when '🎯 Phase Focus' is unchecked.", tip: "Save with 💾 or restore defaults with '🔄 Reset'." },
    mod_midPhase: { title: "🎯 Vocal Mid Gain (dB)", phys: "Aligns midrange crossover phase with bass and applies gain in <b>dB</b>.", hear: "Vocals immediately step right up to your face.", tip: "Default is <b>+3 dB</b> (+2...+8 dB range)." },
    mod_midQ: { title: "📐 Mid Dome Width (%)", phys: "Controls midrange crossover filter bandwidth (100% = stock).", hear: "Removes boxy resonances and makes band transitions silky smooth.", tip: "Default is <b>150%</b> (use 200%–300% for wide-open mids)." },
    mod_deEsser: { title: "🐍 HF De-Esser (dB)", phys: "Relaxes high-band ratio to 4:1 and adjusts treble gain in <b>dB</b>.", hear: "Tames harsh 'S' and 'SH' sibilance under heavy limiting without losing bass.", tip: "Default is <b>-6 dB</b>." },
    mod_cleanFir: { title: "✨ Clean FIR Drive (dB)", phys: "Smooth bipolar Hanning-windowed FIR impulse curve with zero low-end mud buildup.", hear: "Tight, fast, punchy bass with warm tube harmonic growl.", tip: "Default is <b>+3 dB</b>." },
    mod_masterCeil: { title: "🛡️ Auto-Master Ceiling (Smart Anti-Clip)", phys: "Sums up gain boosts across all active modules, computes exact attenuation in <b>dB</b>, and feeds an analog <b>Math.tanh</b> soft-clipper.", hear: "Completely prevents digital clipping or distortion under extreme settings.", tip: "Keep enabled at all times!" },
    pro_block: { title: "🚀 Mastering Studio PRO (5 Spec-Modules)", phys: "Five studio processors in true physical units (<b>dB, Hz, %</b>).", hear: "Normalizes RMS loudness, locks sub-bass dead center, builds a 3D stage, adds drum punch, and simulates room monitors.", tip: "Tracked by Auto-Ceiling and baked into exported files (💾)!" },
    pro_autoRms: { title: "⚡ Auto-RMS Target (dB)", phys: "Scans track PCM samples in RAM and matches average loudness (RMS) to your target reference.", hear: "Quiet vintage tracks and loud modern masters play with consistent density!", tip: "Default is <b>-10 dB</b>." },
    pro_monoBass: { title: "🧲 Mono Sub-Bass (Hz)", phys: "Uses a phase-coherent Mid/Side matrix to lock sub-bass below <b>Hz</b> dead center (L = R).", hear: "Kick drums hit like a tight fist right in the center of your head.", tip: "Default is <b>120 Hz</b>." },
    pro_msWidth: { title: "🎭 Stereo Width (%)", phys: "Mid/Side matrix + 2-band Side Exciter (135 Hz + 8500 Hz) + 90° All-Pass phase decorrelator.", hear: "Creates a huge 3D holographic dome around your shoulders with full center bass!", tip: "Default is <b>160%</b>." },
    pro_punch: { title: "🥁 Punch Whip (dB)", phys: "3-point transient shaper: boosts kick body (85 Hz), cuts mud (230 Hz), and snaps snare attack (2600 Hz).", hear: "Makes drums physically kick through the mix.", tip: "Default is <b>+6 dB</b>." },
    pro_crossfeed: { title: "🎧 Binaural Speakers (%)", phys: "Simulates studio monitors in a room with head-shadow delay (0.42 ms) and low-pass filter (650 Hz).", hear: "Eliminates fatiguing in-head isolation and projects the stage in front of you.", tip: "Default is <b>75%</b>." },
    scrub_group: { title: "⚡ Smart Scrubbing & Timers", phys: "One-thumb live speed, direction, and seek control.", hear: "Hold seekbar edge + swipe down for radial speed fan; tap left timer for reverse, right timer for forward.", tip: "Long-press Play/Pause to scroll to the active track!" },
    left_hand: { title: "🖐️ Left-Handed Mode", phys: "Mirrors the radial speed arc to the left side.", hear: "Effortless left-thumb scrubbing.", tip: "Switches instantly." },
    pitch_lock: { title: "🎵 Preserve Pitch (Pitch Lock)", phys: "Time-stretching vs. vinyl pitch algorithm.", hear: "ON: keeps original vocal pitch. OFF: deep vinyl Slowed effect.", tip: "Also applies when exporting tracks (💾)." },
    base_speed: { title: "🚀 Custom Base Speed", phys: "Overrides standard 1.0x speed with your custom default.", hear: "E.g. 0.97x gives a heavier groove.", tip: "Can auto-save from radial arc." },
    scrub_speed: { title: "⏩ Default Arc Speed", phys: "Initial speed when holding the seekbar edge.", hear: "Instant one-touch speed boost or slowdown.", tip: "Updates from radial arc." },
    scrub_zones: { title: "🎯 Custom Radial Zones", phys: "6 speed bubbles fanned out on swipe.", hear: "Customize your favorite speeds.", tip: "Hit '🔄 Reset' for defaults." },
    amoled_mode: { title: "🖤 AMOLED Mode", phys: "Pure black (#000000) background.", hear: "Saves battery and reduces eye strain.", tip: "Keep ON." },
    vol_slider: { title: "🔊 Show Volume Slider", phys: "Speaker icon 🔊 / 🔥 on the main bar.", hear: "Digital preamp gain up to 300%.", tip: "Turns into 🔥 above 100%." },
    fir_group: { title: "✨ FIR Saturator", phys: "Convolver tube harmonic saturator.", hear: "Makes audio thick, warm, and weighty.", tip: "Controlled by Gain and Impulse (ms)." },
    fir_gain: { title: "✨ FIR: Drive (Gain)", phys: "FIR stage output gain.", hear: "Sweet spot 1.5–2.5 for dense saturation.", tip: "Save with 💾." },
    fir_decay: { title: "✨ FIR: Impulse (ms)", phys: "Micro-saturation tail length in ms.", hear: "2–6 ms: tight punch; 10–30 ms: club body.", tip: "Enable 'Clean FIR Drive' for zero mud." },
    mb_group: { title: "🎚️ Multiband Crossover (3-Band)", phys: "Splits audio into Low, Mid, and High bands with independent compression.", hear: "Heavy bass kicks never duck vocals or hi-hats.", tip: "Works with the Limiter." },
    mb_low: { title: "🎚️ Low Crossover (Hz)", phys: "Split between bass and midrange.", hear: "160–320 Hz separates sub-bass from vocals; 1600 Hz gives club pump.", tip: "Vocal band is protected from bass bleed." },
    mb_high: { title: "🎚️ High Crossover (Hz)", phys: "Split between midrange and treble.", hear: "3600–7200 Hz controls top-end air and sparkle.", tip: "Higher than Low Crossover." },
    lim_group: { title: "🗜️ Limiter (Soft Clipper)", phys: "Dynamic peak compressor.", hear: "Delivers hard-hitting club pressure.", tip: "Reference preset: -22, 19, 22, 26, 60." },
    lim_thresh: { title: "🗜️ Threshold (dB)", phys: "Compression engagement level.", hear: "-22 dB grabs deep into the waveform.", tip: "Range: -15 to -26 dB." },
    lim_knee: { title: "🗜️ Soft Knee (dB)", phys: "Compression curve smoothness.", hear: "18–22 makes limiting musical and smooth.", tip: "Removes harshness." },
    lim_ratio: { title: "🗜️ Ratio", phys: "Peak reduction strength.", hear: "18–22 locks levels and lifts quiet details.", tip: "Keep at 16–22." },
    lim_attack: { title: "🗜️ Attack (ms)", phys: "Transient pass-through time.", hear: "26 ms preserves drum snap.", tip: "Sweet spot: 20–30 ms." },
    lim_release: { title: "🗜️ Release (ms)", phys: "Recovery time after peaks.", hear: "60 ms creates a bouncy groove.", tip: "Sweet spot: 50–70 ms." },
    eq_group: { title: "🎛️ Equalizer (5-Band IIR)", phys: "Enables the 5-band EQ in 🄠.", hear: "Instant A/B comparison.", tip: "Sliders are under 🄠." },
    boost_group: { title: "🚀 Preamp Booster (Overdrive)", phys: "Extends volume above 100%.", hear: "Drives the limiter harder.", tip: "Power 5 = 150%, 20 = 300%." },
    eq_band_60: { title: "🔊 60 Hz — Sub-Bass", phys: "Low-shelf filter.", hear: "Deep subwoofer rumble.", tip: "Bass foundation." },
    eq_band_230: { title: "🎸 230 Hz — Mid-Bass", phys: "Lower midrange bell.", hear: "Cut to remove mud, boost for body.", tip: "Cleans up the mix." },
    eq_band_910: { title: "🎤 910 Hz — Vocal Core", phys: "Vocal fundamental zone.", hear: "Boost to bring vocals closer.", tip: "Main vocal fader." },
    eq_band_3600: { title: "⚡ 3600 Hz — Clarity", phys: "Articulation and transient snap.", hear: "Boost for clarity, cut to reduce harshness.", tip: "Presence control." },
    eq_band_14000: { title: "✨ 14,000 Hz — Air", phys: "High-shelf treble filter.", hear: "Adds transparent air and shimmering cymbals.", tip: "Hi-Fi openness." }
};

window.getHelpDB = function() { return window.getLang() === 'en' ? window.JENNY_HELP_DB_EN : window.JENNY_HELP_DB_RU; };
window.JENNY_HELP_DB = window.JENNY_HELP_DB_RU;

window.ensureHelpModal = function() {
    let m = document.getElementById('jennyHelpModal'); if (m) m.remove();
    m = document.createElement('div'); m.id = 'jennyHelpModal';
    m.style.cssText = "display:none;position:fixed;inset:0;z-index:2147483450;background:rgba(0,0,0,0.82);backdrop-filter:blur(5px);align-items:center;justify-content:center;padding:16px;box-sizing:border-box;";
    m.onclick = (e) => { if (e.target === m) m.style.display = 'none'; };
    m.innerHTML = `<div onclick="event.stopPropagation()" style="background:#0d1117;border:1px solid #7341be;border-radius:14px;max-width:440px;width:100%;max-height:82vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.95);overflow:hidden;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#161b22;border-bottom:1px solid #30363d;">
            <span id="jhTitle" style="color:#58a6ff;font-weight:bold;font-size:15px;">📖 ${window.tr('Справка', 'Help Guide')}</span>
            <button onclick="document.getElementById('jennyHelpModal').style.display='none'" style="background:transparent;border:none;color:#8b949e;font-size:18px;cursor:pointer;padding:2px 6px;box-shadow:none;">✖</button>
        </div>
        <div id="jhBody" style="padding:14px 16px;overflow-y:auto;color:#e6edf3;font-size:13.5px;line-height:1.5;display:flex;flex-direction:column;gap:10px;"></div>
        <div style="padding:10px 16px;background:#161b22;border-top:1px solid #30363d;display:flex;justify-content:flex-end;">
            <button onclick="document.getElementById('jennyHelpModal').style.display='none'" style="background:#238636;color:#fff;border:none;border-radius:8px;padding:8px 18px;font-weight:bold;font-size:13px;cursor:pointer;">${window.tr('Понятно 👍', 'Got it 👍')}</button>
        </div></div>`;
    document.body.appendChild(m);
};

window.showHelpTopic = function(key, ev) {
    if (ev) { ev.stopPropagation(); ev.preventDefault(); }
    try { navigator.vibrate(20); } catch(e){}
    window.ensureHelpModal();
    const item = window.getHelpDB()[key] || window.JENNY_HELP_DB_RU[key];
    if (!item) return;
    document.getElementById('jhTitle').innerHTML = item.title;
    document.getElementById('jhBody').innerHTML = `
        <div style="background:#161b22;border-left:3px solid #58a6ff;padding:10px 12px;border-radius:6px;"><div style="color:#58a6ff;font-size:11px;font-weight:bold;margin-bottom:4px;">🔧 ${window.tr('ФИЗИКА НА ПАЛЬЦАХ:', 'HOW IT WORKS:')}</div><div>${item.phys}</div></div>
        <div style="background:#161b22;border-left:3px solid #3fb950;padding:10px 12px;border-radius:6px;"><div style="color:#3fb950;font-size:11px;font-weight:bold;margin-bottom:4px;">🎧 ${window.tr('ЧТО МЕНЯЕТСЯ НА СЛУХ:', 'WHAT YOU HEAR:')}</div><div>${item.hear}</div></div>
        <div style="background:#1f1633;border-left:3px solid #a371f7;padding:10px 12px;border-radius:6px;"><div style="color:#d2a8ff;font-size:11px;font-weight:bold;margin-bottom:4px;">💡 ${window.tr('ШПАРГАЛКА:', 'PRO TIP:')}</div><div>${item.tip}</div></div>`;
    document.getElementById('jennyHelpModal').style.display = 'flex';
};

window.showFullHelpGuide = function(ev) {
    if (ev) { ev.stopPropagation(); ev.preventDefault(); }
    try { navigator.vibrate(25); } catch(e){}
    window.ensureHelpModal();
    document.getElementById('jhTitle').innerHTML = window.tr("📖 Полный справочник Jenny Player", "📖 Jenny Player Full Manual");
    document.getElementById('jhBody').innerHTML = Object.values(window.getHelpDB()).map(item => `
        <div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:10px 12px;">
            <div style="color:#58a6ff;font-weight:bold;font-size:14px;margin-bottom:6px;">${item.title}</div>
            <div style="margin-bottom:5px;color:#c9d1d9;"><b style="color:#79c0ff;">${window.tr('Физика:', 'Physics:')}</b> ${item.phys}</div>
            <div style="margin-bottom:5px;color:#c9d1d9;"><b style="color:#56d364;">${window.tr('На слух:', 'Sound:')}</b> ${item.hear}</div>
            <div style="color:#d2a8ff;font-size:12.5px;"><b>💡 ${window.tr('Совет:', 'Tip:')}</b> ${item.tip}</div>
        </div>`).join('');
    document.getElementById('jennyHelpModal').style.display = 'flex';
};

window.makeHelpBadge = function(topicKey) {
    const b = document.createElement('span'); b.className = 'jenny-help-badge'; b.innerHTML = '❓';
    b.style.cssText = "display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11.5px;margin-left:6px;cursor:pointer;flex-shrink:0;user-select:none;";
    b.onclick = (e) => window.showHelpTopic(topicKey, e);
    return b;
};

window.mountJennyStudioUI = function() {
    window.detectInitialLang();
    window.applyStaticDOMTranslations();
    const sm = document.getElementById('settingsModal'); if (!sm) return;
    const container = sm.querySelector('.container') || sm;
    ['phaseFocusMasterCard', 'dspModularSection', 'dspProStudioSection', 'jennyFullGuideBtn', 'jennyTopBarRow', 'dspModularBox'].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
    document.querySelectorAll('.jenny-help-badge, .eq-band-hdr').forEach(el => el.remove());

    const topBarRow = document.createElement('div'); topBarRow.id = 'jennyTopBarRow';
    topBarRow.style.cssText = "display:flex;gap:8px;margin-bottom:12px;align-items:stretch;";
    const guideBtn = document.createElement('button'); guideBtn.id = 'jennyFullGuideBtn'; guideBtn.type = 'button';
    guideBtn.onclick = (e) => window.showFullHelpGuide(e);
    guideBtn.style.cssText = "flex:1;background:#161b22;border:1px solid #7341be;color:#d2a8ff;font-weight:bold;padding:11px;border-radius:8px;font-size:12.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 0 10px rgba(115,65,190,0.25);";
    guideBtn.innerHTML = window.tr("📖 СПРАВОЧНИК НАСТРОЕК (❓)", "📖 FULL DSP MANUAL (❓)");
    // JENNY_V242_STRICT_SETTINGS_LANG_HIDE
    const langSwitchBtn = document.createElement('button'); langSwitchBtn.type = 'button'; langSwitchBtn.id = 'settingsDockedLangBtn';
    langSwitchBtn.onclick = (e) => window.toggleLanguage(e);
    langSwitchBtn.style.cssText = "background:#161b22;border:1px solid #58a6ff;color:#58a6ff;font-weight:bold;padding:0 14px;border-radius:8px;font-size:12.5px;cursor:pointer;display:" + (window._hasLangRunAway ? "flex" : "none") + ";align-items:center;justify-content:center;flex-shrink:0;";
    langSwitchBtn.innerHTML = window.getLang() === 'en' ? '🌐 EN' : '🌐 RU';
    const onbBtn = document.createElement('button'); onbBtn.type = 'button'; onbBtn.id = 'jennyOpenOnboardingBtnV165';
    onbBtn.onclick = (e) => { if (window.openOnboardingGuideV165) window.openOnboardingGuideV165(0, e); };
    onbBtn.style.cssText = "background:#161b22;border:1px solid #3fb950;color:#3fb950;font-weight:bold;padding:0 12px;border-radius:8px;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;";
    onbBtn.innerHTML = window.tr('🧭 Гид', '🧭 Guide');
    topBarRow.appendChild(guideBtn); topBarRow.appendChild(onbBtn); topBarRow.appendChild(langSwitchBtn);
    container.insertBefore(topBarRow, container.firstChild);

    const studioInput = document.getElementById('cfg_studioMode');
    const ramCard = studioInput ? studioInput.closest('.setting-row') : null;
    const pfCard = document.createElement('div'); pfCard.id = 'phaseFocusMasterCard'; pfCard.className = 'setting-row';
    pfCard.style.cssText = "background:var(--bg-setting-box);padding:10px;border-radius:6px;margin-bottom:12px;border:1px solid #262c36;border-left:3px solid #7341be;display:flex;align-items:center;justify-content:space-between;";
    pfCard.innerHTML = `<label class="toggle-label" style="color:#e6edf3;font-weight:bold;flex:1;"><input type="checkbox" id="cfg_phaseFix" onchange="window.onPhaseFocusChange(this, event)"> ${window.tr('🎯 Фазовый фокус (Выравнивание вокала и баса)', '🎯 Phase Focus (Vocal & Bass Alignment)')}</label>`;
    pfCard.appendChild(window.makeHelpBadge('phase_focus'));

    const buildRowsHTML = (rowsArr) => rowsArr.map(([k, lbl, stp, hKey]) => {
        if (k === 'masterCeil') {
            return `<div class="setting-row" style="border:none;padding:6px 0;gap:6px;"><div style="display:flex;align-items:center;flex:1;min-width:0;"><label class="toggle-label" style="color:#e6edf3;font-size:12.5px;margin:0;"><input type="checkbox" id="cfg_opt_masterCeil" onchange="window.onDspModChange('masterCeil')"> ${window.tr('🛡️ Авто-Мастер-Потолок:', '🛡️ Auto-Master Ceiling:')}</label><span class="jenny-help-badge" onclick="window.showHelpTopic('${hKey}', event)" style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11px;margin-left:5px;cursor:pointer;flex-shrink:0;">❓</span></div><span id="autoCeilStatusBadge" style="background:#161b22;border:1px solid #30363d;border-radius:6px;padding:4px 10px;font-size:11.5px;font-weight:bold;color:#3fb950;flex-shrink:0;">${window.tr('Авто', 'Auto')}: -0.5 dB</span></div>`;
        }
        return `<div class="setting-row" style="border:none;padding:4px 0;gap:6px;"><div style="display:flex;align-items:center;flex:1;min-width:0;"><label class="toggle-label" style="color:#e6edf3;font-size:12.5px;margin:0;"><input type="checkbox" id="cfg_opt_${k}" onchange="window.onDspModChange('${k}', event)"> ${lbl}</label><span class="jenny-help-badge" onclick="window.showHelpTopic('${hKey}', event)" style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11px;margin-left:5px;cursor:pointer;flex-shrink:0;">❓</span></div><div style="display:flex;gap:4px;align-items:center;flex-shrink:0;"><button type="button" class="io-btn" onclick="window.loadDspModRow('${k}', this, event)">📥</button><input type="number" step="${stp}" id="cfg_val_${k}" oninput="window.onDspModChange('${k}')" style="width:52px;"><button type="button" class="io-btn" onclick="window.saveDspModRow('${k}', this, event)">💾</button></div></div>`;
    }).join('');

    const rowsMod = [
        ['midPhase', window.tr('🎯 Фаза СЧ Вокал (dB):', '🎯 Vocal Mid Gain (dB):'), '1', 'mod_midPhase'],
        ['midQ', window.tr('📐 Ширина СЧ купола (%):', '📐 Mid Dome Width (%):'), '10', 'mod_midQ'],
        ['deEsser', window.tr('🐍 Де-эссер ВЧ (dB):', '🐍 HF De-Esser (dB):'), '1', 'mod_deEsser'],
        ['cleanFir', window.tr('✨ Драйв Чистый FIR (dB):', '✨ Clean FIR Drive (dB):'), '1', 'mod_cleanFir'],
        ['masterCeil', window.tr('🛡️ Мастер-потолок (dB):', '🛡️ Master Ceiling (dB):'), '1', 'mod_masterCeil']
    ];
    const modSection = document.createElement('details'); modSection.id = 'dspModularSection'; modSection.className = 'setting-group'; modSection.open = true;
    modSection.innerHTML = `<summary style="display:flex;align-items:center;justify-content:space-between;"><span>${window.tr('🧪 Тонкая настройка тракта (5 опций)', '🧪 Signal Path Fine-Tuning (5 Options)')}</span><span class="jenny-help-badge" onclick="window.showHelpTopic('mod_block', event)" style="display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11px;cursor:pointer;">❓</span></summary><div class="group-content" style="position:relative;"><div id="dspModLockShield" onclick="try{navigator.vibrate(40);}catch(e){}; if(window.showToast) window.showToast('🔒 Блок управления отключён! Для включения выключите «Фазовый фокус»', event);" style="display:none;position:absolute;inset:0;z-index:20;cursor:not-allowed;"></div><div id="dspModBodyWrap" style="transition:opacity 0.2s ease, filter 0.2s ease;"><div class="setting-row" style="border:none;padding:2px 0 8px 0;"><span style="color:#8b949e;font-size:12px;">${window.tr('Модули кроссовера и сатурации:', 'Crossover & saturation modules:')}</span><button type="button" onclick="window.resetDspGroup(['midPhase','midQ','deEsser','cleanFir','masterCeil'], '🔄 5 опций тракта сброшены!', event)" style="font-size:11px;padding:3px 8px;">${window.tr('🔄 Сброс', '🔄 Reset')}</button></div>${buildRowsHTML(rowsMod)}</div></div>`;

    const rowsPro = [
        ['autoRms', window.tr('⚡ Авто-RMS Цель (dB):', '⚡ Auto-RMS Target (dB):'), '1', 'pro_autoRms'],
        ['monoBass', window.tr('🧲 Моно-Саббас (Hz):', '🧲 Mono Sub-Bass (Hz):'), '20', 'pro_monoBass'],
        ['msWidth', window.tr('🎭 Стерео-Ширина (%):', '🎭 Stereo Width (%):'), '25', 'pro_msWidth'],
        ['punch', window.tr('🥁 Панч-Хлыст (dB):', '🥁 Punch Whip (dB):'), '1', 'pro_punch'],
        ['crossfeed', window.tr('🎧 Бинаурал-Колонки (%):', '🎧 Binaural Speakers (%):'), '10', 'pro_crossfeed']
    ];
    const proSection = document.createElement('details'); proSection.id = 'dspProStudioSection'; proSection.className = 'setting-group'; proSection.open = true;
    proSection.innerHTML = `<summary style="display:flex;align-items:center;justify-content:space-between;"><span>${window.tr('🚀 Мастеринг-Студия PRO (5 спец-модулей)', '🚀 Mastering Studio PRO (5 Spec-Modules)')}</span><span class="jenny-help-badge" onclick="window.showHelpTopic('pro_block', event)" style="display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;border-radius:50%;background:#1f242d;border:1px solid #58a6ff;color:#58a6ff;font-size:11px;cursor:pointer;">❓</span></summary><div class="group-content"><div class="setting-row" style="border:none;padding:2px 0 8px 0;"><span style="color:#8b949e;font-size:12px;">${window.tr('Психоакустика и динамика мембран:', 'Psychoacoustics & driver dynamics:')}</span><button type="button" onclick="window.resetDspGroup(['autoRms','monoBass','msWidth','punch','crossfeed'], '🔄 Модули PRO Studio сброшены!', event)" style="font-size:11px;padding:3px 8px;">${window.tr('🔄 Сброс', '🔄 Reset')}</button></div>${buildRowsHTML(rowsPro)}</div>`;

    if (ramCard) { ramCard.insertAdjacentElement('afterend', pfCard); pfCard.insertAdjacentElement('afterend', modSection); modSection.insertAdjacentElement('afterend', proSection); }
    else { container.appendChild(pfCard); container.appendChild(modSection); container.appendChild(proSection); }

    const idMap = [
        ['cfg_studioMode', 'studio_ram'], ['cfg_leftHandedMode', 'left_hand'], ['cfg_pitchLock', 'pitch_lock'], ['cfg_xNormalSpeed', 'base_speed'],
        ['cfg_amoledMode', 'amoled_mode'], ['cfg_volSlider', 'vol_slider'], ['cfg_firEnabled', 'fir_group'], ['cfg_fir_gain', 'fir_gain'],
        ['cfg_fir_decay', 'fir_decay'], ['cfg_multiBandEnabled', 'mb_group'], ['cfg_mb_low', 'mb_low'], ['cfg_mb_high', 'mb_high'],
        ['cfg_limiterEnabled', 'lim_group'], ['cfg_lim_threshold', 'lim_thresh'], ['cfg_lim_knee', 'lim_knee'], ['cfg_lim_ratio', 'lim_ratio'],
        ['cfg_lim_attack', 'lim_attack'], ['cfg_lim_release', 'lim_release'], ['cfg_eqEnabled', 'eq_group'], ['cfg_boosterEnabled', 'boost_group'],
        ['cfg_defaultScrubSpeed', 'scrub_speed'], ['cfg_z1_en', 'scrub_zones']
    ];
    idMap.forEach(([id, topic]) => {
        const el = document.getElementById(id); if (!el) return;
        const lbl = el.closest('label');
        if (lbl) lbl.appendChild(window.makeHelpBadge(topic));
        else { const row = el.closest('.setting-row'); if (row && row.firstElementChild) row.firstElementChild.appendChild(window.makeHelpBadge(topic)); }
    });

    document.querySelectorAll('#settingsModal summary').forEach(sum => {
        if (sum.querySelector('.jenny-help-badge')) return;
        const txt = sum.innerText || '';
        if (txt.includes('Скраббинг') || txt.includes('Scrubbing')) sum.appendChild(window.makeHelpBadge('scrub_group'));
        else if (txt.includes('FIR')) sum.appendChild(window.makeHelpBadge('fir_group'));
        else if (txt.includes('кроссовер') || txt.includes('Crossover')) sum.appendChild(window.makeHelpBadge('mb_group'));
        else if (txt.includes('Лимитер') || txt.includes('Limiter')) sum.appendChild(window.makeHelpBadge('lim_group'));
        else if (txt.includes('Эквалайзер') || txt.includes('Equalizer')) sum.appendChild(window.makeHelpBadge('eq_group'));
        else if (txt.includes('Усилитель') || txt.includes('Booster')) sum.appendChild(window.makeHelpBadge('boost_group'));
        else if (txt.includes('Форматы') || txt.includes('Formats')) sum.appendChild(window.makeHelpBadge('format_slots'));
    });

    const eqBands = [
        ['eq_60', window.tr('60 Гц — Саб-бас (Глубина и бочка)', '60 Hz — Sub-Bass (Depth & Kick)'), 'eq_band_60'],
        ['eq_230', window.tr('230 Гц — Мид-бас (Теплота / Анти-бубнёж)', '230 Hz — Mid-Bass (Warmth / Mud Cut)'), 'eq_band_230'],
        ['eq_910', window.tr('910 Гц — Середина (Основа вокала)', '910 Hz — Midrange (Vocal Core)'), 'eq_band_910'],
        ['eq_3600', window.tr('3600 Гц — Верхняя СЧ (Близость и чёткость)', '3600 Hz — Upper Mid (Clarity & Bite)'), 'eq_band_3600'],
        ['eq_14000', window.tr('14 000 Гц — Воздух (Блеск и тарелки)', '14,000 Hz — Air (Sparkle & Cymbals)'), 'eq_band_14000']
    ];
    eqBands.forEach(([id, title, topic]) => {
        const slider = document.getElementById(id);
        if (slider) {
            const hdr = document.createElement('div'); hdr.className = 'eq-band-hdr';
            hdr.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:-12px;color:#c9d1d9;font-size:12.5px;font-weight:bold;";
            hdr.innerHTML = `<span>${title}</span>`; hdr.appendChild(window.makeHelpBadge(topic));
            slider.parentNode.insertBefore(hdr, slider);
        }
    });

    window.syncDspModUI();
    if (typeof window.syncFormatSlotsUI === 'function') window.syncFormatSlotsUI();
    if (typeof window.installFormatAwareFetchData === 'function') {
        window.installFormatAwareFetchData();
        setTimeout(() => { window.installFormatAwareFetchData(); if (typeof window.fetchData === 'function') window.fetchData(); }, 100);
    }
};

if (document.readyState === 'loading') document.addEventListener("DOMContentLoaded", window.mountJennyStudioUI);
else window.mountJennyStudioUI();

window.syncGuideButtonPositionV165 = function() {
    const hide = Boolean(window.appConfig && window.appConfig.hideHelpBadges);
    document.body.classList.toggle('hide-help-badges', hide);

    const cfgChk = document.getElementById('cfg_hideHelpV62');
    if (cfgChk && cfgChk.checked !== hide) cfgChk.checked = hide;

    const onbChk = document.getElementById('onb_hideHelpChkV165');
    if (onbChk && onbChk.checked !== hide) onbChk.checked = hide;

    const sm = document.getElementById('settingsModal');
    if (!sm) return;
    const container = sm.querySelector('.container') || sm;
    const guideBtn = document.getElementById('jennyFullGuideBtn');
    const topBarRow = document.getElementById('jennyTopBarRow');
    if (!guideBtn || !container) return;

    let bottomSlot = document.getElementById('jennyBottomGuideSlotV165');
    if (!bottomSlot) {
        bottomSlot = document.createElement('div');
        bottomSlot.id = 'jennyBottomGuideSlotV165';
        bottomSlot.style.cssText = 'margin-top:14px;margin-bottom:18px;padding-top:10px;border-top:1px dashed #30363d;display:none;';
        container.appendChild(bottomSlot);
    } else if (bottomSlot.parentElement === container && container.lastElementChild !== bottomSlot) {
        container.appendChild(bottomSlot);
    }

    if (hide) {
        bottomSlot.style.display = 'block';
        guideBtn.style.width = '100%';
        if (guideBtn.parentElement !== bottomSlot) {
            bottomSlot.appendChild(guideBtn);
        }
    } else {
        bottomSlot.style.display = 'none';
        guideBtn.style.width = '';
        if (topBarRow && guideBtn.parentElement !== topBarRow) {
            topBarRow.insertBefore(guideBtn, topBarRow.firstChild);
        }
    }
};

window.onToggleHideHelpBadgesV62 = function(chk, ev) {
    const hide = Boolean(chk && chk.checked);
    window.appConfig = window.appConfig || {};
    window.appConfig.hideHelpBadges = hide;
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    window.syncGuideButtonPositionV165();
    if (typeof window.saveThemeOnlyQuietlyV40 === 'function') window.saveThemeOnlyQuietlyV40();
    if (typeof window.showToast === 'function' && ev) {
        window.showToast(
            hide
                ? window.tr('🙈 Подсказки (❓) скрыты, главный справочник перенесён в самый конец настроек', '🙈 Help badges hidden, main manual moved to the bottom of Settings')
                : window.tr('📖 Все подсказки (❓) включены, справочник возвращён в начало настроек', '📖 Help badges enabled, manual moved to the top of Settings'),
            ev
        );
    }
};

window.injectHideHelpToggleV62 = function() {
    const isHidden = Boolean(window.appConfig && window.appConfig.hideHelpBadges);
    document.body.classList.toggle('hide-help-badges', isHidden);
    const themeRow = document.getElementById('jennyThemeStudioBtnRow');
    if (themeRow && !document.getElementById('hideHelpRowV62')) {
        const row = document.createElement('div');
        row.id = 'hideHelpRowV62';
        row.className = 'setting-row jenny-uniform-card';
        row.style.cssText = 'padding:9px 12px;border-radius:8px;margin-bottom:12px;';
        row.innerHTML = `
            <label class="toggle-label" style="font-weight:bold;color:#e6edf3;width:100%;">
                <input type="checkbox" id="cfg_hideHelpV62" ${isHidden ? 'checked' : ''} onchange="window.onToggleHideHelpBadgesV62(this, event)">
                🙈 ${window.tr('Скрыть все справочные материалы (оставить 1 справочник в конце)', 'Hide all help badges (move main manual to bottom)')}
            </label>
        `;
        themeRow.insertAdjacentElement('afterend', row);
    }
    window.syncGuideButtonPositionV165();
};

# Полная карта архитектуры, слоёв интерфейса, оверлеев и Z-индексов JennyPlayer

Этот документ содержит полный разбор устройства проекта **JennyPlayer**, подробную послойную карту всех элементов интерфейса (от нативных окон Android `WindowManager` до каждого `z-index` внутри WebView) и перечень выявленных архитектурных конфликтов («косяков»).

---

## ЧАСТЬ 1. Как устроен проект (4 уровня архитектуры)

### 1. Нативный Android-каркас (`app/src/main/java/com/jenny/player/`)
* **[MainActivity.java](file:///home/security/claude_test/JennyPlayer/app/src/main/java/com/jenny/player/MainActivity.java)** (2 248 строк):
  * Поднимает полноэкранный `WebView` с аппаратным ускорением и отключает системные отступы.
  * Запускает встроенный Python-движок **Chaquopy** (`player.start_server()`) и загружает интерфейс с локального сервера `http://127.0.0.1:8080`.
  * Предоставляет JS-мост `window.AndroidBridge` (более 30 `@JavascriptInterface` методов: управление системным видео-оверлеем `V132`, чтение/запись папок напрямую в обход медленного HTTP, синхронизация состояния с Островком, проверка разрешений).
  * Управляет системным плавающим окном видеоплеера (`overlayContainerV132`), когда пользователь сворачивает плеер с активным видео в режим «Поверх всех окон».
* **[IslandOverlayController.java](file:///home/security/claude_test/JennyPlayer/app/src/main/java/com/jenny/player/IslandOverlayController.java)** (1 921 строка):
  * Рисует полностью нативный плавающий островок (**Dynamic Island**) через системный `WindowManager` (`TYPE_APPLICATION_OVERLAY`).
  * Имеет два состояния: **свёрнутая мини-капсула** (`collapsedMiniPill`) и **развёрнутая карточка** (`expandedPlateCard`, 4 ряда: переключатель режимов *Музыка / Радио / SoundCloud / YouTube*, бегущая строка названия + левая кнопка действия + правая кнопка избранного, неоновая полоса прогресса `GlowSeekBar`, транспорт `-10с | |◀ | ▶/⏸ | ▶| | +10с`).
  * Поддерживает фоновую отрисовку обложки трека с регулируемой прозрачностью заливки (`0..100%`) и тему-хамелеон:
    * Фиолетовая (`#A371F7`) — локальная музыка (Дека А / Дека Б), левая кнопка: Экспорт в `.xFLAC`.
    * Синяя (`#58A6FF`) — FLAC/MP3 Радио, левая кнопка: Запись эфира `REC`.
    * Оранжевая (`#FF8C42`) — SoundCloud, левая кнопка: Скачать трек в плеер.
    * Красная (`#FF5555`) — YouTube Studio & Music, левая кнопка: Сохранить в `.xFLAC`.
* **[PlaybackService.java](file:///home/security/claude_test/JennyPlayer/app/src/main/java/com/jenny/player/PlaybackService.java)** (551 строка):
  * Foreground-сервис с `MediaSession`, `WakeLock` / `WifiLock` и системным уведомлением (`notification_player.xml`), который удерживает процесс от выгрузки системой Android при выключенном экране.

---

### 2. Нативные бинарные ядра C / C++ / Go (`jniLibs/<abi>/*.so`)
Собираются отдельно под **64-бит (`arm64-v8a`)** и **32-бит (`armeabi-v7a`)** в [.github/workflows/build.yml](file:///home/security/claude_test/JennyPlayer/.github/workflows/build.yml):
1. **`libffmpeg.so`** — нативный бинарник FFmpeg 9.0.2 (вызывается из Python для декодирования PCM-чанков в ОЗУ, ремукса видео, извлечения обложек, конвертации WAV/FLAC/MP3).
2. **`libxflac.so`** ([xflac.hpp](file:///home/security/claude_test/JennyPlayer/app/src/main/jniLibs/xflac.hpp)) — C++ кодек собственного студийного контейнера `.xflac` (`XFC3` + LZMA2 + капсулы `JREV` для реверса и `JCOV` для вшитых обложек).
3. **`libhose_dsp.so`** ([hose_splicer.cpp](file:///home/security/claude_test/JennyPlayer/app/src/main/python/hose_splicer.cpp)) — C++ DSP-ядро для бесшовной склейки аудиоволны («Шланг» / Pitch-Lock).
4. **`libjenny_vcore.so`** ([jenny_vcore.cpp](file:///home/security/claude_test/JennyPlayer/app/src/main/python/jenny_vcore.cpp)) — C++ SIMD/NEON ядро оценки векторов движения и интерполяции кадров для режима 120 Гц в Видео Деке Б.
5. **`libjenny_qjs.so` / `libnode.so` / `libqjs.so`** ([jenny_qjs_bridge.c](file:///home/security/claude_test/JennyPlayer/app/src/main/python/jenny_qjs_bridge.c) + QuickJS) — встроенная нативная среда исполнения JavaScript (с выделенным 32 МБ стеком `pthread`), работающая внутри процесса через `ctypes.CDLL` для мгновенного решения JS-челленджей YouTube (`yt-dlp` + `yt-dlp-ejs`).
6. **`libjtorrent.so`** ([jtorrent_core.go](file:///home/security/claude_test/JennyPlayer/app/src/main/python/jtorrent_core.go)) и **`libomnitorrent.so`** ([omni_torrent_core.go](file:///home/security/claude_test/JennyPlayer/app/src/main/python/omni_torrent_core.go)) — два независимых Go-демона BitTorrent/P2P (локальные порты `127.0.0.1:8891` и `127.0.0.1:8892`) для поиска, потокового воспроизведения и скачивания торрентов.

---

### 3. Серверное ядро Python ([player.py](file:///home/security/claude_test/JennyPlayer/app/src/main/python/player.py), 16 687 строк)
Локальный многопоточный HTTP-сервер на базе `bottle` (`127.0.0.1:8080`), который:
* Склеивает и отдаёт модули интерфейса (`/bundle_1_studio.js` и `/bundle_2_player.js`).
* Индексирует музыкальные и видео-папки, кэширует метаданные и теги (`custom_tags_db_v74`), управляет внешним хабом `/storage/emulated/0/JENNY`.
* Отдаёт аудио- и видеопотоки с поддержкой `HTTP 206 Partial Content` (`Range: bytes=...`), декодирует PCM-куски (`f32le`) для 4 независимых ОЗУ-буферов:
  * **Буфер ОЗУ #1**: Дека А (Аудио Вперёд)
  * **Буфер ОЗУ #2**: Дека А (Аудио Реверс)
  * **Буфер ОЗУ #3**: Дека Б (Видео Звук Вперёд, кусочная подгрузка по 45 с)
  * **Буфер ОЗУ #4**: Дека Б (Видео+Звук Реверс, сегментный реверс-ремукс)
* Обслуживает внешние источники: **Khinsider (Game OST)**, **Archive.org**, **FLAC/MP3 Радио** (с записью эфира в `.xflac`), **SoundCloud**, **Торрент-студию P2P** и **YouTube Studio & Music** (со встроенным 1-клик автообновлением `yt-dlp` + `yt-dlp-ejs` из официальных репозиториев и компиляцией `.py` → `.pyc` прямо на телефоне).

---

### 4. Фронтенд и порядок загрузки JS-модулей ([index.html](file:///home/security/claude_test/JennyPlayer/app/src/main/python/index.html))
Порядок загрузки скриптов строго фиксирован, так как поздние модули оборачивают (monkey-patch) функции ранних:
1. Базовые движки: `engine_audio.js` → `engine_video_deck_b.js` → `engine_heads.js` → `engine_fav.js`
2. Ядро UI Деки А: `ui_init.js` → `ui_config.js` → `ui_render.js` → `ui_playback.js` → `ui_scrub_engine.js` → `ui_touch_arc.js` → `ui_controls.js` → `ui_export.js`
3. **`/bundle_1_studio.js`** (12 модулей): `ui_lang.js`, `ui_formats.js`, `ui_dsp_panel.js`, `ui_help.js`, `ui_lang_button.js`, `ui_themes.js`, `ui_hose.js`, `ui_folders.js`, `ui_gearbox.js`, `ui_spectrum.js`, `ui_seams.js`, `ui_revisor.js`.
4. **`/bundle_2_player.js`** (19 модулей): `ui_styles.js`, `ui_settings.js`, `ui_gestures.js`, `ui_playlist.js`, `ui_transport.js`, `ui_reverse.js`, `ui_sources.js`, `ui_torrent.js`, `ui_video.js`, `ui_video_reverse.js`, `ui_framegen.js`, `ui_export_modal.js`, `ui_shade.js`, `ui_net.js`, `ui_video_decks.js`, `ui_layout.js`, `ui_shade_v243.js`, `ui_deck_a_guard.js`, `ui_island_overlay.js`.
5. Изолированные модалки Деки Б: `jenny_deck_b_modals.js`.

---

## ЧАСТЬ 2. Полная карта всех слоёв, оверлеев и `z-index`

Ниже приведена полная иерархия всех слоёв интерфейса **снизу вверх** (от `z-index: 0` до потолка `2147483647` и нативных системных окон Android).

### ЭШЕЛОН A. Нативные системные оверлеи Android (ПОВЕРХ WebView и всех `z-index`)
Эти слои создаются через системный `android.view.WindowManager` с типом `TYPE_APPLICATION_OVERLAY`. Они находятся **выше самого WebView**, поэтому никакой CSS `z-index` внутри браузера не может их перекрыть:

| Слой / Окно | Где создаётся | Параметры и назначение |
| :--- | :--- | :--- |
| **Нативный Островок (`JennyDynamicIslandOverlayV248`)** | [IslandOverlayController.java:1213-1240](file:///home/security/claude_test/JennyPlayer/app/src/main/java/com/jenny/player/IslandOverlayController.java#L1213-L1240) | Системное окно `TYPE_APPLICATION_OVERLAY` в верхней части экрана (`Gravity.TOP \| CENTER_HORIZONTAL`). В свёрнутом виде — узкая капсула (`collapsedMiniPill`), в развёрнутом — карточка `364x168 u` (`expandedPlateCard`) с `FLAG_WATCH_OUTSIDE_TOUCH` (сворачивается при касании мимо плашки). |
| **Системный видео-оверлей Поверх всех окон (`overlayContainerV132`)** | [MainActivity.java:417-430, 614-619](file:///home/security/claude_test/JennyPlayer/app/src/main/java/com/jenny/player/MainActivity.java#L417-L430) | Системное плавающее окно `TYPE_APPLICATION_OVERLAY`, куда временно пересаживается `WebView` при выходе на рабочий стол телефона с включённым видео Деки Б. |

---

### ЭШЕЛОН B. Внутренние слои виджетов и карточек (`z-index: 0 .. 200`)
Локальные слои внутри отдельных компонентов (строк плейлиста, полос прогресса, коробки передач и сцены видеоплеера):

| `z-index` | ID / селектор | Файл и строка | Что это за слой и зачем нужен |
| ---: | :--- | :--- | :--- |
| **`0`** | `.tor-row-fill-v237` | [ui_styles.js:1127](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_styles.js#L1127) | Фоновая заливка прогресса скачивания внутри строки файла в Торрент-студии. |
| **`1`** | `.tor-row-content-v237` | [ui_styles.js:1132](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_styles.js#L1132) | Текст и кнопки поверх заливки прогресса внутри строки торрента. |
| **`2`** | Текст поверх `#seekZone` (Дека А) и `#seekZoneDeckB` (Дека Б) | [index.html:131, 149](file:///home/security/claude_test/JennyPlayer/app/src/main/python/index.html#L131), [ui_video_decks.js:40](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_video_decks.js#L40) | Прозрачный текстовый слой (`pointer-events: none`) с названием трека/видео и индикатором блокировки скорости поверх цветной полосы прогресса. |
| **`2`** | `.track-row-capsule` | [ui_render.js:490](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_render.js#L490) | Основная капсула строки трека в плейлисте (лежит над выдвижной подстрокой `.track-expand-subline-v68`). |
| **`2`** | `.arc-item.active` | [style.css](file:///home/security/claude_test/JennyPlayer/app/src/main/python/style.css) | Активная подсвеченная кнопка скорости на полукруглой дуге скраббера. |
| **`2`** | `#jv168GlCanvas` (`glCanvas`) | [ui_framegen.js:470](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_framegen.js#L470) | WebGL-холст генератора промежуточных кадров 120 Гц, накладываемый поверх `<video id="jennyVideoElV130">` внутри сцены Деки Б. |
| **`3`** | `#jv168SplitLine` | [ui_framegen.js:476](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_framegen.js#L476) | Голубая вертикальная разделительная линия режима сравнения «До / После 120 Гц» поверх видео Деки Б. |
| **`3`** | `#searchRightSlotV235` | [ui_styles.js:842](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_styles.js#L842) | Правый слот внутри строки поиска (кнопка очистки `✖` и счётчик треков). |
| **`4`** | Холст визуализации жестов | [ui_gestures.js:325](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_gestures.js#L325) | Прозрачный `canvas` поверх зоны касания для отрисовки следа пальца. |
| **`5..200`** | Слои механической РКПП (`.gearbox-*`) | [style.css](file:///home/security/claude_test/JennyPlayer/app/src/main/python/style.css) | Внутренние слои кулисы коробки передач: `z=5` `.gearbox-svg-overlay`, `z=8` `.gearbox-gate-enclosure`, `z=10` `.gearbox-h-line`, `z=12` `.gearbox-stopper-dot`, `z=15` `.gearbox-letter`, `z=200` `.gearbox-knob-lever` (ручка КПП). |
| **`10`** | `#v130HudOverlay` (`.v130-hud-overlay`) | [ui_video.js:504](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_video.js#L504) | Внутренний слой элементов управления (верхняя и нижняя панель кнопок) поверх видеокадра внутри `#jennyVideoStageV130`. |
| **`12`** | `#v243VideoPrevNextRow` | [ui_styles.js:1350](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_styles.js#L1350) | Полупрозрачные кнопки `⏮ Пред.` и `След. ⏭` внутри сцены видеоплеера Деки Б. |
| **`20`** | `#v130CenterFeedback` | [ui_video.js:519](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_video.js#L519) | Центральный индикатор перемотки/скорости по центру видеокадра Деки Б. |
| **`20`** | `#dspModLockShieldDeckB` | [jenny_deck_b_modals.js:543](file:///home/security/claude_test/JennyPlayer/app/src/main/python/jenny_deck_b_modals.js#L543) | Защитная полупрозрачная шторка поверх выключенных модулей DSP в настройках Деки Б. |
| **`20`** | `#torFooterBarV96` | [ui_styles.js:1021](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_styles.js#L1021), [ui_torrent.js:4964](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_torrent.js#L4964) | Нижняя панель кнопок («Скачать выбранные / Выбрать все») внутри окна Торрент-студии. |
| **`25`** | `#v132LockShieldOverlay` | [ui_video.js:1039](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_video.js#L1039) | Защитный экран блокировки касаний (`🔒`) в видеоплеере Деки Б (оставляет активной только кнопку разблокировки). |
| **`30`** | `#v132DesktopResizeHandle` | [ui_video.js:1058](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_video.js#L1058) | Уголок растягивания размера плавающего окна видеоплеера в режиме PiP / оверлея. |
| **`30`** | `#jennySubFilterWrapV71` | [ui_playlist.js:2174](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_playlist.js#L2174) | Подстрока подкатегорий/жанров/папок под основной полосой вкладок плейлиста. |

---

### ЭШЕЛОН C. Базовый каркас главного экрана (`z-index: 2400 .. 6000`)
Основные панели главного окна плеера (шапка, список треков, нижний док с двумя деками, базовое состояние вкладок настроек и скраббер Деки Б):

| `z-index` | ID / селектор | Файл и строка | Что это за слой и как работает |
| ---: | :--- | :--- | :--- |
| **`2400`** | `#jennyVideoStudioRootV130.mode-pip-v130` (при открытой модалке) | [ui_styles.js:1423-1427](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_styles.js#L1423-L1427) | Когда открывается любое окно настроек/эквалайзера (`body.jenny-any-modal-open-v360`), мини-окно видеоплеера (PiP) принудительно опускается на `z-index: 2400` и становится полупрозрачным (`opacity: 0.12`), чтобы не мешать настраивать звук. |
| **`2500`** | `.modal-overlay` (в закрытом состоянии) | [style.css](file:///home/security/claude_test/JennyPlayer/app/src/main/python/style.css) | Базовый класс вкладок-модалок (`#settingsModal`, `#eqModal`, `#specModal`, `#favModal`, `#themeModal` и их копий для Деки Б `#settingsModalDeckB`, `#eqModalDeckB`, `#specModalDeckB`), когда у них **нет** класса `.open`. Располагаются между верхней шапкой (`top: 104px`) и нижним доком (`bottom: 96..156px`). |
| **`3500`** | `.sticky-top` | [style.css](file:///home/security/claude_test/JennyPlayer/app/src/main/python/style.css) | Верхняя фиксированная шапка плеера: иконки быстрых модалок (`🌐 Источники`, `📊 Спектр`, `❤️ Избранное`, `🎛️ Эквалайзер`, `⚙️ Настройки`, `📁 Папки`), строка поиска / монитор лимитера и полоса вкладок плейлиста (`#jennyPlaylistBarWrapV71`). |
| **`3600`** | `.sticky-bottom` / `#bottomPlayerDock` (в обычном режиме) | [style.css](file:///home/security/claude_test/JennyPlayer/app/src/main/python/style.css) | Нижний транспортный док плеера: полоса прогресса Деки Б (`#deckBProgressRow`), полоса прогресса Деки А (`#deckAProgressRow`) и 9 круглых кнопок управления воспроизведением. |
| **`4000` / `5000`** | `.vol-popup` (базовый CSS) | [style.css](file:///home/security/claude_test/JennyPlayer/app/src/main/python/style.css) | Всплывающий вертикальный ползунок громкости (позже в `ui_styles.js:529` поднимается до `2147483640`). |
| **`5998`** | `#debugZoneCanvas` и `#debugZoneCanvasDeckB` | [ui_touch_arc.js:29](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_touch_arc.js#L29), [ui_video_decks.js:5155](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_video_decks.js#L5155) | Отладочный `canvas` зон касания скраббера. |
| **`5999`** | `#scrubOverlayDeckB` | [ui_video.js:4152](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_video.js#L4152), [ui_video_decks.js:5141](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_video_decks.js#L5141) | Полноэкранный прозрачный перехватчик жестов скраббинга и изменения скорости для Деки Б. *(Внимание: у Деки А аналогичный `#scrubOverlay` поднят до `2147483647`, а у Деки Б остался `5999` — см. раздел Косяков ниже!)* |
| **`6000`** | `#speedArcContainerDeckB` | [ui_video.js:4159](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_video.js#L4159), [ui_video_decks.js:5148](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_video_decks.js#L5148) | Контейнер полукруглой дуги выбора скорости для Деки Б. |

---

### ЭШЕЛОН D. Средний уровень модальных окон и плавающих плашек (`z-index: 9999 .. 1000090`)
**⚠️ КРИТИЧЕСКАЯ ЗОНА**: исторически эти окна создавались с расчётом, что `.modal-overlay` имеет `z-index: 2500`. Но после того как в патче `V360` ([ui_styles.js:1419](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_styles.js#L1419)) открытым окнам `.modal-overlay.open` выставили `z-index: 2147483646 !important`, **все перечисленные ниже окна (`z = 9999 .. 1000090`) оказались НИЖЕ открытого окна Настроек/Эквалайзера/Избранного!**

| `z-index` | ID / селектор | Файл и строка | Что это за слой и зачем нужен |
| ---: | :--- | :--- | :--- |
| **`9999`** | `#jennyVideoAudioOnlyBadgeV217` | [ui_video_decks.js:1984](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_video_decks.js#L1984) | Плашка «Режим Только Аудио (Экран выкл.)» для видео Деки Б. |
| **`10005`** | `#webApiRevConflictModalV70` (`.webapi-rev-modal-backdrop-v70`) | [style.css](file:///home/security/claude_test/JennyPlayer/app/src/main/python/style.css), [ui_gearbox.js:787](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_gearbox.js#L787) | Диалоговое окно предупреждения при включении реверса на передаче WebAPI (предлагает переключиться на JBUF или Обычный режим). |
| **`99990`** | `#jennyYoutubeStudioModalV230` | [ui_sources.js:5255](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_sources.js#L5255) | Модальное окно **YouTube Studio & Music** (поиск, переключение Music/Видео, 1-клик обновление ядра `yt-dlp`, кнопки Слушать / `.xFLAC` / В Деку Б / MP4 и встроенный мини-плеер). |
| **`99990`** | `#jv176SplitHeader` | [ui_framegen.js:1564](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_framegen.js#L1564) | Плавающий заголовок разделителя экрана 120 Гц внутри видеоплеера. |
| **`99996`** | `#jennyAvSyncEdgePillV368` | [ui_styles.js:1457](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_styles.js#L1457), [ui_video_decks.js:7205](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_video_decks.js#L7205) | Боковая синяя пилюля радар-телеметрии синхронизации звука и видео (`A/V Sync`) справа на экране Видео Деки Б + выдвижной ящик `#jennyAvSyncEdgeDrawerV368`. |
| **`99997`** | `#jennySplitPillWrapV209` и `#jenny120PillWrapV209` | [ui_framegen.js:1865, 1886](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_framegen.js#L1865) | Перетаскиваемые плавающие кнопки `Split` и `120Hz` поверх видеоплеера Деки Б. |
| **`99998`** | `#jennyFenceWrapV173` | [ui_framegen.js:1793](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_framegen.js#L1793) | Плавающий монитор-осциллограф времени кадра (Frame Pacing Fence) в режиме 120 Гц. |
| **`99999`** | `#jennyTunerFloatWrapV208` | [ui_framegen.js:1824](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_framegen.js#L1824) | Плавающее окно тонкой настройки 120 Гц (`Tuner`) поверх видеоплеера Деки Б. |
| **`99999`** | `#trackInfoModal` (`.coreplayer-modal-backdrop`) | [style.css](file:///home/security/claude_test/JennyPlayer/app/src/main/python/style.css), [ui_render.js:324](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_render.js#L324) | Окно технической инспекции файла (**Core Media Inspector**: битрейт, кодек, контейнер `XFC3`, капсула `JREV`, теги). |
| **`99999`** | `#jennyFolderManagerModal` (ранняя версия) | [ui_folders.js:41](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_folders.js#L41) | Ранняя версия менеджера папок (позже переопределена в `ui_playlist.js:3365` с классом `.jenny-modal-backdrop-v71` и `z=2147483600`). |
| **`99999`** | `#jennyQuickColorModal` и `#jennyThemeFilesModal` | [ui_themes.js:797, 1232](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_themes.js#L797) | Модальные окна выбора цвета и списка сохранённых файлов тем (вызываются из Редактора тем / Настроек). |
| **`99999`** | `#jennyOmniLogViewerV139` | [ui_torrent.js:3615](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_torrent.js#L3615) | Полноэкранное окно живого лога торрент-движка OmniTorrent. |
| **`999998`** | `#jbHudBadge` (красная кнопка `🐞 ERR`) | [index.html:14](file:///home/security/claude_test/JennyPlayer/app/src/main/python/index.html#L14) | Плавающий красный значок бортового самописца ошибок JS в правом нижнем углу (`bottom: 74px; right: 10px`). |
| **`999999`** | `#jbHudModal` (окно лога ошибок JS) | [index.html:18](file:///home/security/claude_test/JennyPlayer/app/src/main/python/index.html#L18) | Модальное окно просмотра и копирования перехваченных ошибок `window.onerror` / `unhandledrejection`. |
| **`999999`** | `.runaway-actor` / `.crawler-actor` / `flyer` | [style.css](file:///home/security/claude_test/JennyPlayer/app/src/main/python/style.css), [ui_lang_button.js:366](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_lang_button.js#L366), [ui_settings.js:1759](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_settings.js#L1759) | Анимированная «убегающая» / «ползущая гусеницей» кнопка переключения языка `RU/EN` при перелёте в окно Настроек. |
| **`1000040`** | `#jennyOnboardingModalV165` | [ui_settings.js:497](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_settings.js#L497) | Модальное окно **Стартового гида и выдачи разрешений Android** (память, уведомления, наложение поверх окон). |
| **`1000090`** | `#jennyHelpModal` | [ui_help.js:107](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_help.js#L107) | Модальное окно **Справки (`❓`)** по каждому модулю DSP, КПП и настройкам плеера. |

---

### ЭШЕЛОН E. Высший уровень (`z-index: 2147483500 .. 2147483647` — предел `INT32_MAX`)
Здесь находятся самые приоритетные окна, выпадающие меню, полноэкранный Видеоплеер Деки Б, окно Экспорта и активные вкладки Настроек:

| `z-index` | ID / селектор | Файл и строка | Что это за слой и что в него входит |
| ---: | :--- | :--- | :--- |
| **`2147483600`** | `.jenny-modal-backdrop-v71` | [style.css](file:///home/security/claude_test/JennyPlayer/app/src/main/python/style.css) | Единый полноэкранный контейнер-затемнение для всех студийных модальных окон V71+:<br>• `#jennyKhinsiderModalV88` — Game OST (Khinsider) и Archive.org ([ui_sources.js:190](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_sources.js#L190))<br>• `#jennyFlacRadioModalV91` — FLAC / MP3 Радио ([ui_sources.js:822](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_sources.js#L822))<br>• `#jennySoundCloudModalV93` — SoundCloud ([ui_sources.js:1492](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_sources.js#L1492))<br>• `#jennyTorrentModalV91` — Торрент-студия P2P ([ui_torrent.js:20](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_torrent.js#L20))<br>• `#jennyFolderManagerModal` — Менеджер папок V237 ([ui_playlist.js:3365](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_playlist.js#L3365))<br>• `#jennyPlEyeModalV71` — Управление видимостью вкладок ([ui_playlist.js:329](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_playlist.js#L329))<br>• `#jennyCreatePlModalV71` — Создание плейлиста ([ui_playlist.js:367](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_playlist.js#L367))<br>• `#jennyImpFolderModalV71` — Импорт папки в плейлист ([ui_playlist.js:407](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_playlist.js#L407))<br>• `#jennyTrackToPlModalV71` — Добавление трека в плейлист ([ui_playlist.js:562](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_playlist.js#L562))<br>• `#jennyMetaEditorModalV71` — Редактор тегов трека ([ui_playlist.js:611](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_playlist.js#L611))<br>• `#jennyAllPlaylistsPopupV73` и `#jennySubItemsPopupV73` — Списки плейлистов и подкатегорий ([ui_playlist.js:987, 1066](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_playlist.js#L987))<br>• `#jennyPlSortModalV71` — Окно сортировки ([ui_playlist.js:1374](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_playlist.js#L1374)) |
| **`2147483640`** | `.custom-toast` | [style.css](file:///home/security/claude_test/JennyPlayer/app/src/main/python/style.css) | Всплывающие уведомления `window.showToast(...)` в нижней части экрана. |
| **`2147483640`** | `#volumePopup`, `.vol-popup` | [ui_styles.js:529](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_styles.js#L529) | Всплывающий блок ползунков громкости Деки А и Деки Б над нижним доком. |
| **`2147483645`** | `#jennySourcesDropMenuV91` | [ui_sources.js:546, 1875, 2838](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_sources.js#L2838) | Выпадающее меню кнопки **«🌐 Источники»** в правом верхнем углу (`top: 48px; right: 12px`), откуда открываются Game OST, Archive.org, Радио, SoundCloud, YouTube Studio и Торрент-студия. |
| **`2147483646`** | `#settingsModal.open`, `#eqModal.open`, `#specModal.open`, `#favModal.open`, `#themeModal.open`, `#settingsModalDeckB.open`, `#eqModalDeckB.open`, `#specModalDeckB.open` | [ui_styles.js:1417-1422](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_styles.js#L1417-L1422) | Открытые основные вкладки плеера (Настройки, Эквалайзер, Спектр/Осциллограф, Избранное, Темы) для Деки А и Деки Б. Занимают центральную часть экрана (`top: 104px`, `bottom: 96..156px`). |
| **`2147483646`** | `#jennyIslandImagePickerModalV250` | [ui_island_overlay.js:743](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_island_overlay.js#L743) | Проводник выбора собственной фоновой картинки для Островка (открывается из Настроек). |
| **`2147483646`** | `#jennyTrackersModalV110` и `#jennyTorInspectorModalV128` | [ui_torrent.js:1614, 3208](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_torrent.js#L1614) | Окно управления трекерами и детальный инспектор кусков/пиров раздачи поверх Торрент-студии. |
| **`2147483647`** | `#jennyVideoStudioRootV130` (в полноэкранном режиме) | [ui_video.js:498](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_video.js#L498) | Главный корневой контейнер **Видеоплеера Деки Б** (сцена видео, HUD, кнопки зума/поворота, радар A/V Sync). В режиме PiP при открытии настроек опускается до `2400`. |
| **`2147483647`** | `#exportModalV69` (`.exp-modal-backdrop-v69`) | [ui_export.js:739, 748](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_export.js#L739) | Модальное окно **Настроек экспорта DSP и упаковки в `.xFLAC`**. |
| **`2147483647`** | `body.jenny-any-modal-open-v360 #bottomPlayerDock` | [style.css](file:///home/security/claude_test/JennyPlayer/app/src/main/python/style.css) | Нижний транспортный док плеера при открытом окне настроек/эквалайзера — поднят на максимальный `z-index`, чтобы кнопки Пуск/Пауза и скраббер всегда оставались под пальцем. |
| **`2147483647`** | `#scrubOverlay`, `#speedArcContainer` и `arcWrap` | [style.css](file:///home/security/claude_test/JennyPlayer/app/src/main/python/style.css), [ui_reverse.js:1335](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_reverse.js#L1335) | Оверлей удержания пальца и полукруглая дуга выбора скорости/реверса при скраббинге с кнопки Play. |

---

## ЧАСТЬ 3. Какие косяки и конфликты видны в проекте на текущий момент

### 1. Конфликты `z-index` (окна открываются «за спиной» других окон)
Из-за того, что в [ui_styles.js:1419](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_styles.js#L1419) открытым окнам `#settingsModal.open`, `#eqModal.open`, `#favModal.open`, `#specModal.open`, `#themeModal.open` выставлен `z-index: 2147483646 !important`, целый ряд дочерних и вспомогательных окон оказался **ниже** них:
1. **Справка (`#jennyHelpModal`, `z = 1000090`) не видна из Настроек и Эквалайзера**:
   Значки `❓` расположены прямо внутри `#settingsModal.open` (`z = 2147483646`). При нажатии на `❓` окно справки (`z = 1000090`) открывается **ПОД** окном Настроек — пользователь видит только полоску затемнения сверху над шапкой, а сам текст справки перекрыт Настройками.
2. **Стартовый гид (`#jennyOnboardingModalV165`, `z = 1000040`) не виден при вызове из Настроек**:
   Кнопка открытия гида находится внутри `#settingsModal.open` (`z = 2147483646`), поэтому гид (`z = 1000040`) также открывается **за спиной** окна Настроек.
3. **Палитра цветов (`#jennyQuickColorModal`, `z = 99999`) и Файлы тем (`#jennyThemeFilesModal`, `z = 99999`)**:
   Вызываются из открытого окна Тем/Настроек (`z = 2147483646`), но имеют `z = 99999`, из-за чего оказываются перекрыты родительским окном.
4. **Окно информации о файле (`#trackInfoModal`, `z = 99999`)**:
   Если открыть свойства трека из открытого окна Избранного (`#favModal.open`, `z = 2147483646`), `#trackInfoModal` (`z = 99999`) откроется **под** окном Избранного.
5. **Окно YouTube Studio (`#jennyYoutubeStudioModalV230`, `z = 99990`)**:
   Имеет `z = 99990`, тогда как остальные источники (`.jenny-modal-backdrop-v71`) имеют `2147483600`, а открытые Настройки/Эквалайзер/Избранное — `2147483646`. Если открыть YouTube Studio через Островок или меню Источников поверх открытых Настроек/Избранного, окно YouTube окажется под ними, а нижний док (`2147483647`) перекроет низ окна YouTube.
6. **Окна Радио / SoundCloud / OST / Торрентов (`.jenny-modal-backdrop-v71`, `z = 2147483600`) против открытых Настроек/Избранного (`z = 2147483646`)**:
   Если у пользователя открыто окно Настроек, Эквалайзера или Избранного (`2147483646`), и он нажимает в шапке «🌐 Источники» (`2147483645`) или переключает режим на Островке, открывшееся окно Радио / SoundCloud / Торрентов (`2147483600`) оказывается **ПОД** открытым окном Настроек (`2147483646`), потому что открытие источника не закрывает `.modal-overlay.open`.
7. **Всплывающие тосты (`.custom-toast`, `z = 2147483640`) прячутся под Настройками (`2147483646`), Видеоплеером Деки Б (`2147483647`) и Окном экспорта (`2147483647`)**:
   У тостов `z-index: 2147483640`, поэтому любые уведомления `showToast(...)`, вызванные при открытом Видеоплеере Деки Б, в Настройках или в Окне экспорта, отрисовываются **позади** этих окон.
8. **Окно предупреждения WebAPI реверса (`#webApiRevConflictModalV70`, `z = 10005`)**:
   Оказывается позади открытого окна Настроек / РКПП (`2147483646`).

---

### 2. Дуга скорости Деки Б (`#scrubOverlayDeckB`, `z = 5999`) при открытых модалках
* Для Деки А `#scrubOverlay` и `#speedArcContainer` подняты в `style.css` до `z-index: 2147483647 !important`.
* Для Деки Б `#scrubOverlayDeckB` (`z = 5999`) и `#speedArcContainerDeckB` (`z = 6000`) в это правило не включены — когда открыта любая модалка и нижний док поднят на `2147483647`, перехватчик скраббера Деки Б (`5999`) оказывается ниже нижнего дока и открытой модалки.

---

### 3. Запрос к несуществующему `/ui_playlists.js?v=372` при каждом старте
* В [index.html:533](file:///home/security/claude_test/JennyPlayer/app/src/main/python/index.html#L533) стоит тег `<script src="/ui_playlists.js?v=372"></script>`.
* Модуль плейлистов называется `ui_playlist.js` (в единственном числе) и уже входит в склейку `/bundle_2_player.js`. Отдельного файла `ui_playlists.js` нет, поэтому при каждой загрузке страницы сервер возвращает на него `404 Not Found`.

---

### 4. Утечка и дублирование фоновых таймеров `setInterval` (60 таймеров)
В клиентском JS одновременно крутится около 60 `setInterval`, среди которых есть прямые дубли:
1. **Утечка таймера в [ui_torrent.js:2083 и 4365](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_torrent.js#L4365)**:
   Переменная `window._torGlobalTimerV112 = setInterval(...)` создаётся на строке 2083, а затем на строке 4365 перезаписывается новым `setInterval` **без вызова `clearInterval(window._torGlobalTimerV112)`**. В результате старый таймер продолжает вечно работать в фоне параллельно с новым.
2. **Двойной таймер синхронизации уведомления и Островка**:
   `window.syncPermanentForegroundNotificationV212(false)` вызывается по таймеру каждые 1500 мс в [ui_shade.js:527](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_shade.js#L527) **и одновременно** каждые 650 мс в [ui_island_overlay.js:1484](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_island_overlay.js#L1484).
3. **Двойной таймер `mountModularLabSettingsV208()`**:
   Вызывается каждые 600 мс в [ui_framegen.js:2299](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_framegen.js#L2299) и одновременно каждые 650 мс в [ui_settings.js:1336](file:///home/security/claude_test/JennyPlayer/app/src/main/python/ui_settings.js#L1336).

---

### 5. Лишние 14.5 МБ старых бинарников в `arm64-v8a` APK
* В папке `app/src/main/jniLibs/arm64-v8a/` лежат два старых неиспользуемых файла: `libomnitorrent_v36ir.so` (7.27 МБ) и `libomnitorrent_v40ir.so` (7.27 МБ), помимо актуальных `libomnitorrent.so` (8.19 МБ) и `libjtorrent.so` (13.04 МБ).
* В [.github/workflows/build.yml:45](file:///home/security/claude_test/JennyPlayer/.github/workflows/build.yml#L45) команда `cp -f app/src/main/jniLibs/arm64-v8a/*.so /tmp/jni_stage/arm64-v8a/` копирует все `*.so` в итоговый 64-битный APK, раздувая его размер почти на 15 МБ мёртвым грузом.

---

## ЧАСТЬ 4. Утверждённая единая шкала `z-index` после исправления (`[FIX-GLOBAL-Z-HIERARCHY-V254]`)

Все пересечения устранены, каждый уровень имеет свой фиксированный эшелон без наложений:

| Эшелон `z-index` | Слои и элементы | Примечание |
| ---: | :--- | :--- |
| **`2147482000`** | `#settingsModal.open`, `#eqModal.open`, `#specModal.open`, `#favModal.open`, `#themeModal.open` (и копии Деки Б `#settingsModalDeckB.open`, `#eqModalDeckB.open`, `#specModalDeckB.open`) | Открытые основные вкладки плеера. |
| **`2147482500`** | `body.jenny-any-modal-open-v360 #bottomPlayerDock` | Нижний док с обеими деками при открытой вкладке настроек (выше вкладок `2147482000`, но строго ниже полноэкранных окон и дуг скоростей). |
| **`2147482600`** | `#volumePopup`, `#volumePopupDeckBV216`, `.vol-popup` | Всплывающие ползунки громкости Деки А и Деки Б (всегда поверх нижнего дока). |
| **`2147483000`** | `.jenny-modal-backdrop-v71` (Радио, SoundCloud, OST, Торренты, Плейлисты, Теги, Менеджер папок) и `#jennyYoutubeStudioModalV230` (YouTube Studio & Music) | Полноэкранные окна внешних источников и менеджеров (всегда поверх открытых Настроек и нижнего дока). |
| **`2147483100`** | `#jennySourcesDropMenuV91` | Выпадающее меню кнопки «🌐 Источники». |
| **`2147483200`** | `#jennyQuickColorModal`, `#jennyThemeFilesModal`, `#trackInfoModal`, `.coreplayer-modal-backdrop`, `#webApiRevConflictModalV70`, `#jennyIslandImagePickerModalV250`, `#jennyTrackersModalV110`, `#jennyTorInspectorModalV128`, `#jennyOmniLogViewerV139`, `#exportModalV69` | Вложенные диалоговые окна 2-го уровня (палитра и файлы тем, инфо о треке, выбор картинки Островка, трекеры/инспектор торрентов, настройки экспорта DSP). |
| **`2147483300`** | `#jennyVideoStudioRootV130:not(.mode-pip-v130)` | Полноэкранный Видеоплеер Деки Б. |
| **`2147483400`** | `#jennyOnboardingModalV165` | Стартовый гид разрешений и полная инструкция. |
| **`2147483450`** | `#jennyHelpModal` | Окно Справки (`❓`) — открывается поверх любых Настроек, Эквалайзера и РКПП. |
| **`2147483480`** | `.runaway-actor`, `.crawler-actor` | Анимация перелёта кнопки языка `RU/EN`. |
| **`2147483550`** | `.custom-toast` | Всплывающие тосты-уведомления `showToast(...)` — видны поверх всех окон и видеоплеера. |
| **`2147483600` / `2147483610`** | `#jbHudBadge` / `#jbHudModal` | Бортовой самописец ошибок JS. |
| **`2147483646` / `2147483647`** | `#scrubOverlay`, `#scrubOverlayDeckB` (`2147483646`) и `#speedArcContainer`, `#speedArcContainerDeckB` (`2147483647`) | **АБСОЛЮТНЫЙ ВЫСШИЙ ПРИОРИТЕТ ВСЕГДА И ВЕЗДЕ:** полукруглые дуги скоростей и скрабберы Деки А и Деки Б (плюс автоматический перенос в самый конец `document.body`). |


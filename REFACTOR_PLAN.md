# План разбиения `ui_v71.js` на модули

> Номера строк `ui_v71.js` и раздел 1 описывают состояние **до** разбиения (коммит `9ae6639`).

Состояние репозитория: коммит `9ae6639`. Все номера строк ниже — по `app/src/main/python/ui_v71.js` на этом коммите (39 279 строк, 2,15 МБ).
Код в рамках этого плана не менялся. `DESIGN.md` учтён: ничего не удаляется и не «упрощается», меняется только то, в каком файле лежит код.

## 0. Коротко

- `ui_v71.js` — это не модуль, а **журнал патчей**: версии V71…V372 дописывались в конец, и каждая переопределяет или оборачивает функции предыдущих. Поэтому важен порядок выполнения, и резать «просто по смыслу» нельзя.
- Сделано 18 файлов `ui_*.js` (14 тем, четыре темы в двух частях). Раскладка посчитана парсером так, чтобы для каждой глобальной функции порядок её определений остался прежним.
- Первые 11 518 строк (версии V71–V142) — плоский код, переносится целыми блоками. Остальные 27 700 строк — патчи V143–V372, почти все в виде больших замыканий `(function(){…})()`. 40 таких патчей и один блок плоской части разрезаны на куски по темам (166 кусков).
- 250 функций определены больше одного раза (804 определения). Для каждой в приложении В указано, какая версия работает. 339 определений перекрыты и по своему имени больше не вызываются; план их **не удаляет**.
- Главные риски: порядок патчей, разрезание замыканий, 97 таймеров и 52 обработчика событий, которые ставятся прямо при загрузке. Рекомендую отдавать модули одним склеенным файлом (раздел 5, вариант Б) — тогда загрузка остаётся атомарной, как сейчас.

## Статус (обновлено после первой нарезки)

Разбиение выполнено целиком, одним шагом, на ветке `refactor/split-ui-v71`; на устройстве ещё не проверялось.

- `ui_v71.js` удалён, вместо него 18 модулей `ui_*.js` в `app/src/main/python/`.
- Подключение — вариант Б: `index.html` не менялся, `player.py` отдаёт по адресу `/ui_v71.js` склейку модулей по списку `JENNY_UI_V71_PARTS`.
- Инструменты лежат в `tools/split_v71/` (`run_all.sh` пересобирает модули из коммита `9ae6639` и запускает все проверки).
- Проверки в Node пройдены: ни один из 1 828 блоков не потерян; порядок определений по 1 175 глобальным именам и 986 чтений при загрузке совпадают с исходником; при загрузке в заглушке браузера старый и новый набор дают одинаковые 1 137 глобальных имён (852 функции), одинаковый порядок обработчиков и вставок `<style>`, одинаковый набор таймеров и одинаковое состояние после их срабатывания.
- Проверки нашли и помогли исправить три ошибки первой раскладки, которых не было видно в исходном анализе: порядок двух обёрток `window.fetch`, место вставки стилей V211 и порядок обработчиков касаний на `window`. Из-за последнего файлов стало 18, а не 17.
- Чего проверки в Node не покрывают: настоящий звук, видео, WebGL, работу с DOM и порядок срабатывания таймеров с одинаковой задержкой (риск Р3).

Разделы 5 и 7 ниже описывают исходный пошаговый замысел; фактически шаги 1–7 сделаны сразу, потому что нарезка и проверка автоматические.

## 1. Как грузится JS сейчас

1. `MainActivity.java:1703/1706` открывает в WebView `http://127.0.0.1:8080`.
2. `player.py:181` (маршрут `/`) отдаёт `index.html` как есть. `player.py:191` отдаёт любой `*.js|css|html|svg|json` из папки `app/src/main/python` с `Cache-Control: no-store`. Списка файлов на сервере нет: новый `.js` в этой папке отдаётся без правок сервера.
3. `index.html:5–46` — встроенный «бортовой самописец» (ловит `error` и `unhandledrejection`, пишет в `window.__jennyErrorLogsV20`).
4. `index.html:518–533` — 16 обычных тегов `<script src>` в конце `<body>`, без `defer`/`async`/`type=module`. Выполняются строго по очереди:

| № | Файл | Строк | Примечание |
|---|---|---|---|
| 1 | `engine_audio.js` | 732 | |
| 2 | `engine_video_deck_b.js` | 631 | |
| 3 | `engine_heads.js` | 394 | |
| 4 | `engine_fav.js` | 15 | |
| 5 | `ui_init.js` | 86 | |
| 6 | `ui_config.js` | 133 | |
| 7 | `ui_render.js` | 553 | |
| 8 | `ui_playback.js` | 610 | |
| 9 | `ui_scrub_engine.js` | 90 | |
| 10 | `ui_touch_arc.js` | 411 | |
| 11 | `ui_controls.js` | 248 | |
| 12 | `ui_export.js` | 759 | |
| 13 | `ui_help.js` | 6400 | тоже журнал патчей (264 блока) |
| 14 | **`ui_v71.js`** | 39 279 | 565 верхнеуровневых блоков |
| 15 | `ui_playlists.js` | — | **файла в репозитории нет**, запрос даёт 404, ничего не выполняется |
| 16 | `jenny_deck_b_modals.js` | 1986 | должен остаться после `ui_v71.js`: доопределяет `toggleModal`, `renderDeckSwitchBannersV131` |

Что из этого следует:

- Все скрипты классические и делят одну глобальную область. Функции связаны через `window.X`, порядок тегов = порядок переопределений.
- `?v=372` в адресах — только метка против кэша, на порядок не влияет.
- В `ui_v71.js` на верхнем уровне 48 `const` и 14 `var` (почти все — сохранённые «старые версии» вида `const _origX = window.X`). Они видны из других файлов, но только после того, как их файл выполнился.
- Сейчас весь `ui_v71.js` выполняется одним куском: пока он не дошёл до конца, не срабатывает ни один таймер и ни одно событие. Это свойство потеряется, если просто заменить один тег на 18 (см. риск Р3).

## 2. Как устроен `ui_v71.js`

| Часть | Строки | Что это |
|---|---|---|
| Плоская | 1–11 518 | 522 блока: `window.X = function…`, `const _orig = window.X`, вызовы `setTimeout/setInterval`, 20 маленьких IIFE. Версии V71–V142, идут почти по темам: плейлисты → RAM-движок/реверс → DNA → источники (OST, радио, SoundCloud) → торрент → видео → поисковое ядро |
| Патчи | 11 521–39 278 | 43 блока V143–V372, из них 41 — IIFE размером от 20 до 1600 строк. Почти каждый патч затрагивает несколько тем сразу (например V216: видео, настройки, плеер, шторка, плейлист, источники, торрент) |

Что выполняется сразу при загрузке файла (не внутри функций, вызываемых позже):

- 66 `setTimeout` (задержки 41–2000 мс) и 31 `setInterval`;
- 52 `addEventListener`, большинство в фазе перехвата на `document`/`window`;
- 21 вставка `<style>` в `<head>`;
- 14 подмен методов прототипов и 3 `Object.defineProperty` (`HTMLMediaElement.prototype.play`, свойство `src`, `XMLHttpRequest.prototype.open`, `drawArrays` у WebGL);
- 3 места, где функции оборачиваются по списку имён (`window[fnName] = …`): строки 15378, 19380, 26566.

## 3. Правила, при которых поведение не меняется

Раскладка в разделе 4 построена по этим правилам, и их же надо проверять после каждого шага.

1. **Блок — неделимая единица.** Переносится целиком и без правок текста. Блок — это верхнеуровневая инструкция плоской части или инструкция верхнего уровня внутри патча-IIFE. Всего 1 826 блоков.
2. **Порядок по имени.** Если два блока при загрузке пишут в одно глобальное имя, или один пишет, а другой при загрузке читает (в том числе `const _orig = window.X`), их взаимный порядок выполнения сохраняется. То же для обработчиков на одной паре «цель + событие + фаза» и для подмен одного метода прототипа.
3. **Внутри файла порядок исходный.** Блоки в новом файле идут в том же порядке, что в `ui_v71.js`.
4. **Обёртки живут с функцией.** Все определения и обёртки одного имени стараемся держать в файле темы-владельца. Так цепочка «база → обёртка → обёртка» читается в одном месте.
5. **Замыкания не рвём.** Блоки одного IIFE, которые делят изменяемую локальную переменную, уходят в один кусок. Проверено: при предложенной раскладке таких разрывов 0.
6. **Кусок IIFE — это новый IIFE.** Формат куска:
   ```js
   /* из ui_v71.js, патч V216, строки 19959–20297 */
   (function() {
       if (window._jennyV216Installed__video_decks) return;   // новый флаг, свой у каждого куска
       window._jennyV216Installed__video_decks = true;
       // копии локальных помощников, если кусок ими пользуется (таблица в приложении А)
       // …блоки без изменений…
   })();
   ```
   Исходный флаг (`window._jennyV216Installed = true`) выставляет первый по порядку загрузки кусок, без проверки. Ни один из 32 флагов не читается нигде, кроме собственного сторожа.
7. **Помощники дублируются, состояние — нет.** В 18 патчах есть локальные функции и константы без собственного состояния (SVG-строки, `isStageRot90()` и т.п.), нужные кускам в разных файлах. Их копируем в каждый такой кусок. Список — в приложении А.
8. **Все `<style>` из загрузки — в одном файле** `ui_styles.js`, в исходном порядке. Тогда порядок правил CSS в `<head>` между ними не меняется.
9. **Ничего не удаляем.** Перекрытые версии функций переезжают вместе со всеми.

## 4. Файлы и порядок загрузки

Новые файлы кладём рядом с остальными, в `app/src/main/python/` (без подпапок). Порядок обязателен, он и есть порядок загрузки; все 18 идут на месте прежнего `ui_v71.js`, то есть после `ui_help.js` и до `jenny_deck_b_modals.js`.

| № | Файл | Тема | Строк кода | Блоков |
|---|---|---|---|---|
| 1 | `ui_styles.js` | CSS-вставки всех патчей | 1 231 | 69 |
| 2 | `ui_settings.js` | Настройки: слоты форматов, потоки, EQ и громкость, язык, стартовый гид, `toggleModal`, высота шапки | 1 842 | 80 |
| 3 | `ui_gestures.js` | Жесты: зажатие 180 мс, монитор касаний, защита полей ввода | 283 | 8 |
| 4 | `ui_playlist.js` | Плейлист: вкладки, сортировка, теги, поиск, очередь, папки, строки треков, `fetchData` | 3 742 | 186 |
| 5 | `ui_transport.js` | Дека А: `playTrack`, play/pause, следующий/предыдущий, кнопка в строке | 1 445 | 52 |
| 6 | `ui_reverse.js` | Реверс и RAM-движок аудио: горизонт 45 с, передачи, часы WebAudio, DNA 1.0x, скраб, дуга скорости | 2 364 | 100 |
| 7 | `ui_sources.js` | Источники: меню, OST/архив, радио, SoundCloud, YouTube, мини-плееры, общий рубильник | 4 042 | 231 |
| 8 | `ui_torrent.js` | Торрент-студия: поиск, magnet/.torrent, очередь, трекеры, карта кусков, поисковое ядро, P2P | 5 514 | 257 |
| 9 | `ui_video.js` | Видео, база (V130–V211): плеер, HUD, PiP/оверлей, RAM-декод, вкладка «Видео» | 4 130 | 189 |
| 10 | `ui_video_reverse.js` | Реверс видео: очередь сегментов в RAM, кнопки реверса Деки Б | 1 044 | 25 |
| 11 | `ui_framegen.js` | 120 Гц: генерация кадров, тюнер, лаборатория, vcore | 2 375 | 180 |
| 12 | `ui_export_modal.js` | Окно экспорта (V234) | 205 | 12 |
| 13 | `ui_shade.js` | Шторка: уведомление Android, MediaSession, фоновый режим | 443 | 26 |
| 14 | `ui_net.js` | Сеть: маршрутизатор портов (V238), перехваты `fetch`, XHR, `src` и `play()` у медиа-элементов | 384 | 19 |
| 15 | `ui_video_decks.js` | Видео, поздняя часть (V211+): Дека Б, две деки, панели кнопок, режимы потока | 7 308 | 311 |
| 16 | `ui_layout.js` | Раскладка экрана: поздние правки шапки и модалок (V242, V360) | 87 | 8 |
| 17 | `ui_shade_v243.js` | Шторка, поздняя часть (V243–V244): итоговое уведомление, отметка касаний, безопасные отступы | 115 | 8 |
| 18 | `ui_deck_a_guard.js` | Дека А: защита паузы V370 | 123 | 5 |

Итого 36 677 строк кода; остальное в исходнике — пустые строки и комментарии-разделители (комментарий перед блоком едет вместе с блоком).

Почему четыре темы в двух частях. Это единственные места, где правило 2 не даёт собрать тему в один файл:

- **Видео** (9 и 15): патч 120 Гц (V200, строка 14805) оборачивает `openJennyVideoPlayerV130` изнутри своего замыкания, а V211 (строка 17811) оборачивает уже эту обёртку. Получается «видео → 120 Гц → видео».
- **Настройки** (2 и 16): обработчик `resize` из V242 (строка 33919) должен встать после такого же обработчика из видео-патча V217 (строка 21334).
- **Шторка** (13 и 17): три обработчика касаний на `window` из V243 (строка 35452) должны встать после таких же обработчиков из видео-патча V224 (строка 26554).
- **Дека А** (5 и 18): `isDeckAActuallyPlayingV232` переопределяется в V370 (строка 37858), а патч шторки V240 вызывает прежнюю версию прямо при загрузке (строка 33039).

Что куда едет построчно — приложение Б.

Тематическая разметка блоков сделана автоматически (по имени определяемой функции, затем по именам, на которые блок ссылается). На поведение она не влияет, но часть блоков могла попасть не в самую удачную тему. Блок можно переложить в другой файл, если после этого проходит проверка из раздела 7.

## 5. Как подключать: два варианта

**Вариант А — 18 тегов `<script>`** на месте одного. Просто и наглядно, самописец показывает настоящее имя файла. Но между файлами браузер может отдать управление таймерам и событиям, чего сейчас внутри `ui_v71.js` не бывает (риск Р3), и ошибка в одном файле больше не останавливает остальные (риск Р6).

**Вариант Б — склейка на сервере (рекомендую).** `index.html` не меняется. В `player.py` перед общим маршрутом статики добавляется маршрут `/ui_v71.js`, который читает 18 файлов по списку и отдаёт их одним ответом, через `\n;\n`. Список файлов и есть порядок загрузки. Загрузка остаётся одним куском, как сейчас. Минус: самописец покажет строку склеенного файла; это решается комментарием-меткой в начале каждой части.

Переход с Б на А возможен позже отдельным шагом, с отдельной проверкой.

## 6. Риски

| № | Риск | Что сделано в плане | Что остаётся |
|---|---|---|---|
| Р1 | **Порядок патчей.** Перестановка меняет, какая версия функции победит или что окажется внутри обёртки | Раскладка посчитана по правилу 2 для всех 1 826 блоков; три вынужденных разреза тем | Анализ статический. Проверка по разделу 7 обязательна после каждого шага |
| Р2 | **Разрезание замыканий.** Кусок потеряет локальную переменную или получит свою копию состояния | Блоки с общим изменяемым состоянием не разделяются (0 разрывов); дублируются только помощники без состояния | 166 кусков — много ручной работы, если резать руками. Резать только скриптом по таблице строк |
| Р3 | **Таймеры при загрузке** (97 штук). В варианте А таймер 41–150 мс из ранней части может сработать, пока поздние части ещё не загружены, и вызвать не ту версию функции | Вариант Б убирает это полностью | В обоих вариантах 37 из 130 пар таймеров с одинаковой задержкой сработают в другом порядке. Сохранить и это можно, но файлов станет около 33 вместо 18 |
| Р4 | **Обработчики в фазе перехвата.** Порядок регистрации = порядок вызова | Учтено для `document`, `window`, `player` | Обработчики на других элементах (найденных через локальную переменную) в расчёт не входили |
| Р5 | **Порядок CSS.** Позже вставленный `<style>` побеждает при равной силе правил | Все 21 вставка из загрузки собраны в `ui_styles.js` в исходном порядке | Стили, которые вставляются позже из функций, не трогались и не проверялись |
| Р6 | **Ошибки при загрузке.** Сейчас исключение на верхнем уровне обрывает весь остаток `ui_v71.js`. В варианте А остальные файлы продолжат работу, и может «ожить» код, который сейчас не выполняется | В варианте Б поведение прежнее | Перед началом убедиться, что самописец пуст сразу после запуска (раздел 7, шаг 0) |
| Р7 | **`const` на верхнем уровне** (48 штук). Обращение до загрузки файла с объявлением даёт `ReferenceError` | Чтения при загрузке учтены правилом 2; объявление едет в файл темы-владельца | — |
| Р8 | **Обёртки по списку имён** (строки 15378, 19380, 26566) не видны обычному поиску по `window.имя =` | Учтены вручную как запись в каждое имя из списка | При любых будущих правках помнить о них |
| Р9 | **Сборка.** `build.yml` и `app/build.gradle` списков JS не содержат, Chaquopy упакует новые файлы из той же папки | Файлы кладём без подпапок | Не проверено, как внешний JennyBuilder (коммиты `build(zip)`) собирает исходники и ставит `?v=` — нужно убедиться, что он подхватит новые файлы и не вернёт старый `ui_v71.js` |
| Р10 | **`ui_playlists.js`** — тег есть, файла нет | Тег не трогаем: это не меняет поведение | Не называть новый модуль этим именем, пока тег не убран осознанно |
| Р11 | **Перекрытый код.** 339 определений не вызываются по своему имени | Не удаляются | «Перекрыто» определено эвристикой: часть версий может быть жива через сохранённую копию в другой функции. Удаление — отдельная задача с отдельной проверкой |
| Р12 | **Проверить на устройстве нечем, кроме рук.** В репозитории нет тестов | Раздел 7: сверка снимка глобальных функций до и после | Звук, реверс, питч-лок и видео проверяются только на телефоне |

## 7. Порядок работ и проверка

Каждый шаг — отдельный коммит, чтобы при поломке откатить один шаг.

**Шаг 0. Инструмент и эталон.**
- Положить в репозиторий (например `tools/split/`) два скрипта на Node с парсером `acorn`: разрезатель по таблице «строки → файл» и проверяльщик. Прототипы, которыми считался этот план, лежат во временной папке `/tmp/jsan` и в репозиторий не входят.
- На телефоне запустить текущую сборку, убедиться, что самописец пуст.
- Снять эталон: после полной загрузки для каждого свойства `window` типа «функция» сохранить имя и хеш `String(fn)`. Это снимок того, какая версия каждой функции победила.

**Шаг 1. Плоская часть (строки 1–11 518).** Разрезатель раскладывает 522 блока по файлам согласно приложению Б. В `ui_v71.js` остаются только патчи V143+; он идёт последним в списке склейки. Замыкания почти не трогаются (режется один блок, строки 3742–3851) — самый дешёвый и самый безопасный шаг.

**Шаги 2–6. Патчи, от старых к новым,** пачками: V143–V170, V200–V212, V215–V221, V223–V237, V238–V372. Патч режется на куски по правилам 5–7, куски дописываются в конец своих файлов. Старшинство обязательно: в остатке `ui_v71.js` всегда должен лежать непрерывный «хвост» исходника.

**Шаг 7.** Остаток `ui_v71.js` пуст — файл удаляется, в списке склейки остаются 18 модулей.

**После каждого шага:**
1. `node --check` для каждого файла.
2. Проверяльщик: (а) каждый исходный блок встречается в новых файлах ровно один раз и побайтно совпадает, кроме сторожей и продублированных помощников; (б) для каждого глобального имени последовательность определений при загрузке та же, что в исходнике; (в) то же для обработчиков по ключу «цель + событие + фаза» и для вставок `<style>`.
3. На телефоне: самописец пуст; снимок глобальных функций совпадает с эталоном по именам и хешам.
4. Ручной прогон по `DESIGN.md`: звук на любой скорости и питч-лок; реверс с текущей позиции и переход на предыдущий трек с конца при достижении нуля; то же для видео; шторка (кнопки, обложка, перемотка); поиск и поток из торрента на обоих поисковых модулях; радио, OST, SoundCloud; экспорт.


## Приложение А. Патчи-IIFE: на какие куски режутся

«Куски» — в какой файл сколько строк уходит. Блоки-сторожа (`if (флаг) return; флаг = true;`) в счёт не входят: каждый кусок получает свой сторож по правилу 6. В последнем столбце `имя()` — локальная функция, имя без скобок — локальная константа.

| Патч | Строки | Флаг-сторож | Куски (файл и строк) | Локальные помощники, которые надо продублировать |
|---|---|---|---|---|
| V83 (DNA-хуки) | 3742–3851 | — | reverse 86, transport 15 | — |
| V143 | 11521–11833 | — | torrent 267, video 12, sources 7 | — |
| V145 | 11870–12008 | — | torrent 74, styles 31, video 17 | `styleId` |
| V147 | 12011–12234 | — | video 137, settings 38, styles 34 | `styleId` |
| V150 | 12237–12748 | — | playlist 191, settings 177, video 64, styles 41 | `pipStyleId` |
| V165 | 12835–13214 | — | settings 365 | — |
| V167 | 13217–13616 | — | video 385 | — |
| V200 | 13620–14829 | — | framegen 1015, video 147 | `mount120HzButtonInVideoHud()` |
| V170 | 14832–15119 | `_jennyV170Installed` | video 228, reverse 24, framegen 6 | `getVideoElV170()`, `isVideoDeckActiveV170()`, `attachExactFrameTrackerV170()` |
| V210 | 15132–16521 | `_jennyV210Installed` | framegen 1103, video 220 | `isStageRot90()` |
| V211 | 16526–17925 | `_jennyV211Installed` | video 1084, video_decks 105, styles 69, video_reverse 61, reverse 17, transport 10 | `injectV211Styles()`, `ensureDualProgressBarsDOMV211()` |
| V212 | 17929–18897 | `_jennyV212Installed` | video_decks 544, torrent 210, shade 163, transport 1 | `bindUnifiedVideoPlayerSeekSliderV212()`, `bindLocalVideoNoBufferGuardV212()` |
| V215 | 18904–19635 | `_jennyV215Installed` | torrent 269, video_decks 202, settings 145, styles 30, playlist 25 | — |
| V216 | 19638–21240 | `_jennyV216Installed` | video_decks 635, settings 309, transport 208, shade 97, playlist 83, sources 71, torrent 61, styles 13, reverse 12, export_modal 1 | `bindCleanSingleCommitVideoSliderV216()` |
| V217 | 21243–22584 | `_jennyV217Installed` | video_decks 828, video_reverse 166, reverse 124, framegen 113, torrent 25, settings 4 | — |
| V218 | 22588–24059 | `_jennyV218Installed` | video_decks 753, playlist 203, sources 143, settings 69, styles 61, torrent 58, framegen 56, gestures 12 | `HEART_OUTLINE_SVG_V218`, `HEART_FILLED_SVG_V218` |
| V219 | 24063–25074 | `_jennyV219Installed` | video_decks 557, video_reverse 157, styles 152, settings 77, transport 6 | `VOL_SPEAKER_ON_SVG_V219`, `VOL_SPEAKER_MUTE_SVG_V219` |
| V221 | 25084–26033 | `_jennyV221Installed` | video_decks 587, video_reverse 149, styles 94, reverse 42, gestures 13 | — |
| V223 | 26037–26373 | `_jennyV223Installed` | video_reverse 305, reverse 13, video_decks 7 | — |
| V224 | 26380–26627 | `_jennyV224Installed` | sources 102, styles 46, video_decks 45, video_reverse 21 | — |
| V227 | 26642–27952 | `_jennyV227Installed` | video_decks 758, transport 400, video_reverse 90, reverse 22 | — |
| V229 | 27956–28395 | `_jennyV229Installed` | video_decks 199, reverse 134, playlist 46, transport 20 | — |
| V230 | 28399–29051 | `_jennyV230Installed` | sources 526, video_decks 92 | — |
| V232 | 29055–29548 | `_jennyV232Installed` | transport 193, video_decks 105, reverse 71, playlist 53, net 16, sources 3 | `PLAY_ICON_SVG_V232`, `PAUSE_ICON_SVG_V232`, `ROW_PLAY_SVG_V232`, `ROW_PAUSE_SVG_V232` |
| V234 | 29556–29826 | `_jennyV234Installed` | export_modal 204, styles 48 | — |
| V235 | 29842–30652 | `_jennyV235Installed` | playlist 260, settings 240, styles 142, transport 78, video_decks 39 | — |
| V236 | 30671–31598 | `_jennyV236Installed` | torrent 363, settings 205, sources 183, styles 103, playlist 15 | `PIN_STORAGE_KEY_V236`, `initV236()` |
| V237 | 31602–32550 | `_jennyV237Installed` | transport 279, torrent 228, sources 136, playlist 96, shade 73, styles 52, reverse 31 | — |
| V238 | 32554–32910 | `_jennyV238MultiPortInstalled` | net 202, playlist 100, settings 21 | — |
| V239 | 32914–32975 | `_jennyV239HotfixInstalled` | video_decks 18, net 17, styles 9, torrent 7 | — |
| V240 | 32979–33429 | `_jennyV240Installed` | sources 251, video_decks 110, shade 59 | — |
| V241 | 33433–33738 | `_jennyV241MiniIsolationInstalled` | sources 286 | — |
| V242 | 33743–34878 | `_jennyV242Installed` | sources 579, playlist 208, styles 83, settings 77, video_decks 67, layout 39 | — |
| V238-P2P | 34882–35221 | `_jennyV238P2pInstalled` | torrent 251, net 74 | — |
| V243 | 35225–35944 | `_jennyV243Installed` | sources 149, shade_v243 109, styles 103, torrent 76, net 75, shade 51, video_decks 35, transport 35, playlist 32, reverse 11, gestures 1 | `onGlobalPointerCaptureV243()` |
| V244 | 35948–35969 | — | styles 13, shade_v243 6 | — |
| V360 | 35973–36584 | `_jennyV360ClockAndModalPatchInstalled` | playlist 305, reverse 135, video_decks 68, layout 48, styles 16 | `setStylePropIfChangedV363()`, `getOpenModalStateV363()` |
| V369 | 36607–37839 | `_jennyV369Installed` | video_decks 977, video_reverse 73, framegen 59, styles 59, reverse 8 | `bindVideoAutoResumeAndStallHealV369()` |
| V370 | 37843–38397 | `_jennyV370DeckAFullTrackPatchInstalled` | reverse 350, deck_a_guard 123, video_decks 19, torrent 15, transport 2 | `PLAY_ICON_SVG_V370`, `PAUSE_ICON_SVG_V370`, `invalidateDeckAHoseCacheV370()` |
| V371 | 38401–38673 | `_jennyV371PatchInstalled` | reverse 130, video_decks 116 | — |
| V372 | 38677–39278 | `_jennyV372CleanArchInstalled` | video_decks 442, reverse 123 | `getEffectiveDeckADurationV372()` |

## Приложение Б. Что куда едет (строки `ui_v71.js`)

После диапазона — глобальные имена, которые блоки определяют (не все, для ориентира). Диапазоны внутри одного патча перечислены в исходном порядке; в этом же порядке они идут в куске.

#### 1. `ui_styles.js` — 69 блоков, ~1231 строк

Целые верхнеуровневые блоки:

- 11836–11867

Куски патчей-IIFE (диапазоны строк внутри исходного IIFE):

- **V145** (31 стр.): 11874–11904
- **V147** (34 стр.): 12014–12047
- **V150** (41 стр.): 12240–12280
- **V211** (69 стр.): 16531–16599
- **V215** (30 стр.): 18911–18940
- **V216** (13 стр.): 19864–19876
- **V218** (61 стр.): 23292–23352
- **V219** (152 стр.): 24071–24222
- **V221** (94 стр.): 25095–25188
- **V224** (46 стр.): 26388–26433
- **V234** (48 стр.): 29589–29636
- **V235** (142 стр.): 29849–29990
- **V236** (103 стр.): 30678–30780
- **V237** (52 стр.): 31609–31660
- **V239** (9 стр.): 32926–32934
- **V242** (83 стр.): 33751–33833
- **V243** (103 стр.): 35242–35344
- **V244** (13 стр.): 35956–35968
- **V360** (16 стр.): 36389–36404
- **V369** (59 стр.): 36627–36685

#### 2. `ui_settings.js` — 80 блоков, ~1842 строк

Целые верхнеуровневые блоки:

- 1066–1108 · `syncHeaderHeightWithModalsV71`, `_toggleModalHeaderHookV71`, `toggleModal`
- 3354–3374 · `syncHeaderHeightWithModalsV71`
- 11262–11315 · `openInlineAddFormatBoxV138`, `prompt`

Куски патчей-IIFE (диапазоны строк внутри исходного IIFE):

- **V147** (38 стр.): 12013, 12185–12221 · `onReturnedFromPermissionScreenV146`
- **V150** (177 стр.): 12283–12305, 12346–12355, 12369–12519 · `DEFAULT_AUDIO_FORMAT_SLOTS_V150`, `DEFAULT_VIDEO_FORMAT_SLOTS_V150`, `KNOWN_VIDEO_EXT_SET_V150` …+6
- **V165** (365 стр.): 12836–13213 · `checkPermStatusV165`, `syncOnboardingPermsV165`, `onOnboardingPermUpdatedV165` …+7
- **V215** (145 стр.): 19156–19279, 19397–19418 · `promptAddFormatSlotV215`, `syncFormatSlotsUI`, `renderOnboardingPageV165`
- **V216** (309 стр.): 19645–19857, 21026–21111, 21218–21239 · `DEFAULT_THREAD_CONFIG_V216`, `loadThreadConfigV216`, `saveThreadConfigV216` …+5
- **V217** (4 стр.): 22574–22577
- **V218** (69 стр.): 22609–22655, 23760–23784 · `renderThreadsSettingsBoxV216`, `resetThreadConfigV216`, `guardAllSettingsInputsFocusV218` …+1
- **V219** (77 стр.): 24738–24808, 24939–24945 · `changeVolume`, `applyVolumeSettings`, `updateSettings`
- **V235** (240 стр.): 30065–30072, 30166–30402 · `applyStaticDOMTranslations`, `runAwayLangBadgeToSettings`, `crawlAwayLangBadgeToSettings` …+1
- **V236** (205 стр.): 31222–31232, 31387–31575, 31589–31597 · `loadConfigFromDisk`, `syncGuideButtonPositionV165`, `onToggleHideHelpBadgesV62` …+2
- **V238** (21 стр.): 32882–32902 · `renderThreadsSettingsBoxV216`
- **V242** (77 стр.): 33836–33918 · `syncLangDockedBodyClassV242`, `syncSettingsLangBtnVisibilityV39`, `dockLangBadgeIntoOpenSettingsV39` …+1

#### 3. `ui_gestures.js` — 8 блоков, ~283 строк

Целые верхнеуровневые блоки:

- 2979–3026 · `_gestureStateV74_5`, `killAllHoldTimersV74_5`, `canTriggerLongPressNowV74_5`
- 3114–3237 · `_globalGestureMonitorV74_5`
- 10532–10619 · `installCleanStageTouchV133`

Куски патчей-IIFE (диапазоны строк внутри исходного IIFE):

- **V218** (12 стр.): 22596–22607 · `isAnySettingsInputFocusedV218`
- **V221** (13 стр.): 25328–25340 · `ensureSeamlessFrameHoldCanvasV220`
- **V243** (1 стр.): 35229

#### 4. `ui_playlist.js` — 186 блоков, ~3742 строк

Целые верхнеуровневые блоки:

- 31–102 · `PLAYLIST_BUILTIN_TABS_V71`, `SORT_METHODS_V71`, `ensurePlaylistStateV71`, `savePlaylistStateQuietlyV71` …+2
- 122–729 · `mountPlaylistStripDOMV71`, `getAllPlaylistTabsV71`, `getTrackCountForTabV71`, `renderPlaylistStripChipsV71` …+24
- 875–891 · `fetchData`
- 1461–1977 · `_suppressNextStripClickV73`, `_subModalSortModeV73`, `closeAllV71Modals`, `attachStripLongPressV73` …+13
- 2012–2027 · `getEffectivePlaybackQueueV73_1`
- 2061–2390 · `normSearchV74`, `getTrackCustomTagsV74`, `collectAllCustomTagGroupsV74`, `getTrackCountForTabV71` …+7
- 2593–2974 · `selectedArtistV71`, `selectedAlbumV71`, `selectedTagV74`, `selectPlaylistTabV71` …+6
- 3029–3111 · `attachStripLongPressV73`, `_inspectorGuardedV74_5`, `openTrackInspector`, `_allPlGuardedV74_5` …+3
- 3242–3352 · `filterTracks`, `ensureSubStripPinnedInHeaderV74_7`
- 3377–3399 · `mountPlaylistStripDOMV71`, `renderActivePlaylistTracksV71`
- 9060–9062
- 9071–9077 · `getTrackCountForTabV71`
- 9090–9113 · `renderActivePlaylistTracksV71`
- 11153–11196 · `getTrackCountForTabV71`, `renderActivePlaylistTracksV71`

Куски патчей-IIFE (диапазоны строк внутри исходного IIFE):

- **V150** (191 стр.): 12535–12740 · `getTrackCountForTabV71`, `updateScopedSearchPlaceholderV73`, `renderActivePlaylistTracksV71` …+6
- **V215** (25 стр.): 19604–19629
- **V216** (83 стр.): 20303–20387 · `fetchData`, `renderActivePlaylistTracksV71`
- **V218** (203 стр.): 22767–22880, 23938–24040 · `syncPersistentUserDataV218`, `loadPersistentUserDataV218`, `toggleFav` …+4
- **V229** (46 стр.): 27979–28010, 28041–28050, 28391–28394 · `installTracksCountAntiBlinkLockV229`, `renderActivePlaylistTracksV71`
- **V232** (53 стр.): 29307–29340, 29449–29467 · `updateTrackListPlayIcons`, `fetchData`
- **V235** (260 стр.): 29995–30062, 30093–30142, 30437–30569, 30638–30651 · `ensureSearchRightSlotAndLangBtnV235`, `updateTopSearchOrMonitorBar`, `relocateRefreshButtonsToSearchSlotAnimatedV235` …+2
- **V236** (15 стр.): 31234–31248 · `loadPersistentUserDataV218`
- **V237** (96 стр.): 32034–32053, 32107–32185 · `fetchData`, `renderFolderManagerRowsHTMLV237`, `openFolderManagerModalV62`
- **V238** (100 стр.): 32749–32849 · `renderFolderManagerRowsHTMLV237`, `openFolderManagerModalV62`
- **V242** (208 стр.): 33924–33954, 33972–34009, 34056–34092, 34116–34207, 34359–34370 · `updateTopSearchOrMonitorBar`, `computeActiveViewCountV242`, `refreshActiveContextListV242` …+4
- **V243** (32 стр.): 35371–35402 · `ensureSearchRowStretchV243`
- **V360** (305 стр.): 36177–36382, 36406–36414, 36487–36583 · `renderFolderManagerRowsHTMLV237`, `toggleFolderActivePoolV71`, `addFolderToPoolV71` …+5

#### 5. `ui_transport.js` — 52 блоков, ~1445 строк

Целые верхнеуровневые блоки:

- 104–120 · `_playStatHookedV71`, `playTrack`
- 1979–2009 · `handleTrackPlayBtn`, `playTrack`
- 2029–2055 · `playNextTrack`, `playPreviousTrack`
- 2404–2404 · `_pendingSeekTargetV75`
- 3404–3506 · `togglePlayV75_2`, `togglePlay`, `togglePlayPause`, `_ppDocCaptureInstalledV75_2`
- 9958–9966 · `handleTrackPlayBtn`
- 11199–11213 · `handleTrackPlayBtn`

Куски патчей-IIFE (диапазоны строк внутри исходного IIFE):

- **V83 (DNA-хуки)** (15 стр.): 3743–3757 · `playTrack`
- **V211** (10 стр.): 17798–17807 · `playTrack`
- **V212** (1 стр.): 17935
- **V216** (208 стр.): 20407–20614 · `playTrack`
- **V219** (6 стр.): 25051–25056
- **V227** (400 стр.): 27545–27944 · `setupSeekZone`
- **V229** (20 стр.): 28275–28295 · `handleTrackPlayBtn`, `playTrack`
- **V232** (193 стр.): 29059–29082, 29218–29304, 29343–29441 · `isDeckAActuallyPlayingV232`, `togglePlayV75_2`, `togglePlay` …+3
- **V235** (78 стр.): 30408–30423, 30572–30635 · `togglePlayV75_2`, `togglePlay`, `togglePlayPause`
- **V237** (279 стр.): 32268–32549 · `playTrack`
- **V243** (35 стр.): 35611–35620, 35710–35734 · `playTrack`, `togglePlay`, `nextTrack`
- **V370** (2 стр.): 37847–37848

#### 6. `ui_reverse.js` — 100 блоков, ~2364 строк

Целые верхнеуровневые блоки:

- 733–872 · `_activeBufferSourcesV71`, `engageDirectRamPitchShiftV70`
- 896–1063 · `_horizonSliceTimerV71`, `extractWindowBufferV71`, `engageInstantHorizonJbufLockV71`, `syncMasterPlaybackEngineV59` …+1
- 1114–1456 · `ensureStudioBufferLoadedV61`, `engageHorizonRamEngineV71_5`, `syncMasterPlaybackEngineV59`, `_revHookV72` …+1
- 2399–2403 · `_studioClockV74_1`
- 2408–2588 · `setExactPlaybackPositionV75`, `getTruePlaybackTimeV74_2`, `_exactRevHookV75`, `toggleReverseMode` …+3
- 3510–3739 · `dnaDirect1xActiveV76`, `dnaCleanGainNodeV76`, `_dnaPlayStartCtxTimeV82`, `_dnaPlayStartOrigSecV82` …+10

Куски патчей-IIFE (диапазоны строк внутри исходного IIFE):

- **V83 (DNA-хуки)** (86 стр.): 3759–3850 · `syncMasterPlaybackEngineV59`, `updateCenterCurrentTime`, `updateProgressUI`
- **V170** (24 стр.): 14978–15002 · `startScrub`, `stopScrub`
- **V211** (17 стр.): 17004–17020 · `decodeHugeTrackToRamV71`
- **V216** (12 стр.): 20393–20405 · `abortPendingAudioRamLoadsV216`
- **V217** (124 стр.): 21843–21966 · `bindInPlayerSpeedArcDragV217`
- **V221** (42 стр.): 25566–25595, 25626–25637 · `triggerReverseTrackBackgroundPrecacheV220`, `stopHardwareReverseTimerV220`
- **V223** (13 стр.): 26064–26076 · `computeAdaptiveReverseWindowSecV223`
- **V227** (22 стр.): 27522–27543 · `getEnabledAudioSpeedZonesV228`
- **V229** (134 стр.): 28065–28199 · `startScrub`, `stopScrub`
- **V232** (71 стр.): 29183–29212, 29469–29509 · `syncMasterPlaybackEngineV59`
- **V237** (31 стр.): 32055–32066, 32246–32264 · `scheduleCoalescedFetchDataV237`, `onExternalAudioInterruptV237`
- **V243** (11 стр.): 35735–35745 · `prevTrack`
- **V360** (135 стр.): 35978–36115 · `syncMasterPlaybackEngineV59`, `applyElasticHoseBufferLiveV46`
- **V369** (8 стр.): 37228, 37249–37250, 37411–37415 · `getEffectiveRamAudioLeadSecV367`
- **V370** (350 стр.): 37865–37914, 38065–38226, 38256–38396 · `getTruePlaybackTimeV74_2`, `setExactPlaybackPositionV75`, `decodeHugeTrackToRamV71` …+2
- **V371** (130 стр.): 38410–38484, 38573–38632 · `updateCenterCurrentTime`, `setExactPlaybackPositionV75`
- **V372** (123 стр.): 38685–38699, 38702–38811 · `toggleReverseMode`, `startScrub`, `stopScrub`

#### 7. `ui_sources.js` — 231 блоков, ~4042 строк

Целые верхнеуровневые блоки:

- 3857–4743 · `_khStateV88`, `getKhPreviewVolumeV90`, `pauseMainPlayerForOstV90`, `stopKhPreviewV88` …+42
- 4770–5045 · `killAllSourceModulesV94`, `_killSwitchHookedV94`, `toggleSourcesDropdownMenuV91`, `_khStateV88` …+12
- 5054–5116 · `selectKhFormatV88`, `previewScTrackV96`, `downloadScTrackV96`, `runScDedicatedSearchV93` …+1
- 5267–5390 · `_scDownloadingLockV97`, `stopAllExternalStreamsV97`, `stopKhPreviewV88`, `previewKhTrackV88` …+1
- 5546–5619 · `ensureModalMiniPlayerV98`, `bindAudioToAllMiniPlayersV98`, `stopAllExternalStreamsV97`, `previewKhTrackV88`
- 5793–5824 · `_sourceBadgesV99`, `applyHeaderIconBadgeV99`, `updateKhHeaderBtnBadgeV89`
- 6202–6227 · `openSoundCloudModalV92`
- 6299–6353 · `_umpUserDraggingSeekV106`, `seekKhMiniPlayerV90`, `seekKhPreviewV90`, `bindAudioToAllMiniPlayersV98`
- 6689–6693 · `bindAudioToAllMiniPlayersV98`
- 6848–6898 · `loadServiceAuthFromDiskV110`, `saveServiceAuthToDiskV110`
- 7111–7197 · `renderSourcesSettingsSectionV91`
- 8587–8602 · `killAllSourceModulesV94`

Куски патчей-IIFE (диапазоны строк внутри исходного IIFE):

- **V143** (7 стр.): 11620–11626 · `stopAllExternalStreamsV97`
- **V216** (71 стр.): 19884–19954 · `renderHeaderSourcesHubV91`
- **V218** (143 стр.): 23786–23933 · `getPinnedSourcesV91`, `togglePinSourceV91`, `toggleSourcesDropdownMenuV91` …+3
- **V224** (102 стр.): 26437–26544 · `renderHeaderSourcesHubV91`, `togglePinSourceV91`, `applyHeaderIconBadgeV99`
- **V230** (526 стр.): 28403–28931, 28980–28993, 29043–29050 · `JENNY_NEON_SVGS_V92`, `SOURCES_CATALOG_V91`, `getPinnedSourcesV91` …+22
- **V232** (3 стр.): 29516–29518 · `pauseMainPlayerForOstV90`
- **V236** (183 стр.): 31166–31219, 31252–31381, 31578–31587 · `readLockedPinnedSourcesV236`, `writeLockedPinnedSourcesV236`, `getPinnedSourcesV91` …+6
- **V237** (136 стр.): 31665–31804 · `computeSourcesActiveStatusLabelV237`, `updateKillAllSourcesButtonStatusV237`, `killAllSourceModulesV94` …+2
- **V240** (251 стр.): 33051–33311 · `fmtRadioRecDurationV240`, `finalizeActiveRadioRecordingV240`, `stopFlacRadioStreamV91` …+4
- **V241** (286 стр.): 33438–33737 · `hideAllStudioMiniPlayersV241`, `ensureKhMiniCloseBtnV241`, `stopAllExternalStreamsV97` …+6
- **V242** (579 стр.): 34212–34357, 34372–34660, 34678–34855 · `stopFlacRadioStreamV91`, `playFlacRadioStationV91`, `refreshJennyHubSummaryV242` …+18
- **V243** (149 стр.): 35230–35234, 35404–35421, 35499–35532, 35622–35707, 35747–35754 · `fixRadioModalHeaderLayoutV243`, `resolveCurrentRadioTitleV243`, `stopFlacRadioStreamV91` …+2

#### 8. `ui_torrent.js` — 257 блоков, ~5514 строк

Целые верхнеуровневые блоки:

- 4745–4768 · `openTorrentHubPreviewModalV91`
- 5048–5051 · `_torStateV96`
- 5118–5266 · `openTorrentHubPreviewModalV91`, `runTorrentActionV96`, `openMagnetInGoEngineV96`, `renderTorrentFilesListV96` …+1
- 5393–5541 · `backToTorrentSearchListV97`, `previewTorrentFileStreamV97`, `renderTorrentFilesListV96`, `startSelectedTorrentDownloadV96`
- 5621–5791 · `previewTorrentFileStreamV97`, `downloadSingleTorrentTrackV98`, `renderTorrentFilesListV96`, `_torImportBusyV98` …+3
- 5827–6199 · `showMainPageEncodingBannerV98`, `toggleTorrentFilterPillV99`, `renderTorrentFilterBarV99`, `openTorrentHubPreviewModalV91` …+9
- 6230–6294 · `openMagnetInGoEngineV96`
- 6356–6686 · `torrentHasLosslessFilesV106`, `renderTorrentFilesListV96`, `runTorrentDownloadQueueV102`, `_torStateV96` …+7
- 6695–6845 · `previewTorrentFileStreamV97`, `openPlayingTorrentFromMiniPlayerV108`, `_trackersStateV110`, `triggerDailyTrackerSyncOnSpiderwebV109` …+1
- 6901–7108 · `updateTrackersCountLabelsV110`, `loadTrackersFromDiskV110`, `toggleAutoSyncTrackersV110`, `saveCustomTrackersListV110` …+4
- 7200–8584 · `_torMapV112`, `_torImportQueueV112`, `_torImportWorkerBusyV112`, `_torGlobalTimerV112` …+36
- 8604–9049 · `downloadSingleTorrentTrackV98`, `paintOpenedTorrentJobProgressV112`, `_torHubTabV128`, `_torHubSelectedHashV128` …+14
- 9063–9069
- 9791–9797 · `openTorHubFromVideoV130`
- 9945–9956 · `previewTorrentFileStreamV97`
- 11100–11123 · `collectClientTorrentVideosV137`
- 11326–11518 · `_omniCoreStateV139`, `syncOmniCoreBackendV139`, `toggleOmniCoreFlagV139`, `openOmniLiveLogModalV139` …+2
- 12750–12828 · `_p2pCompareStateV163`, `addP2pCompareFileToPlayerV162`

Куски патчей-IIFE (диапазоны строк внутри исходного IIFE):

- **V143** (267 стр.): 11523–11617, 11644–11832 · `resetOpenTorrentScreenUI_V143`, `cleanupActiveTorrentStreamV143`, `previewTorrentFileStreamV97` …+8
- **V145** (74 стр.): 11873, 11908–11988 · `cleanupActiveTorrentStreamV143`, `previewTorrentFileStreamV97`, `downloadSingleTorrentTrackV98` …+1
- **V212** (210 стр.): 17933, 18511–18723 · `clearTorMonotonicCacheV214`, `clampTorrentFileMonotonicV212`, `refreshTorrentDaemonSnapV128` …+2
- **V215** (269 стр.): 19297–19395, 19420–19599, 19630–19634 · `paintOpenedTorrentJobProgressV112`, `stopCurrentOpenTorrentV143`, `deleteCurrentOpenTorrentV143` …+10
- **V216** (61 стр.): 20949–21013 · `cleanupActiveTorrentStreamV143`, `openTorHubFromVideoV130`
- **V217** (25 стр.): 22254–22278 · `openTorHubFromVideoV130`
- **V218** (58 стр.): 23703–23755, 24043–24047 · `cleanAndHighlightTorrentFileRowsV218`
- **V236** (363 стр.): 30786–31160 · `isLosslessAudioPathV236`, `computeJobHasLosslessV236`, `ensureTorrentFooterStructureV236` …+6
- **V237** (228 стр.): 31836–32028, 32069–32105 · `renderTorrentFilesListV96`, `cleanAndHighlightTorrentFileRowsV218`, `processNextTorrentImportV112`
- **V239** (7 стр.): 32915–32923 · `previewSingleTorrentTrackV97`
- **V238** (251 стр.): 34886–34896, 34976–35220 · `openMagnetInGoEngineV96`, `refreshTorrentDaemonSnapV128`, `switchTorHubTabV128` …+1
- **V243** (76 стр.): 35235, 35853–35928 · `toggleTorCardDiagV243`, `renderTorrentInspectorHubV128`
- **V370** (15 стр.): 38043–38058 · `prioritizeRamPieceAtCursorV72`

#### 9. `ui_video.js` — 189 блоков, ~4130 строк

Целые верхнеуровневые блоки:

- 9054–9058 · `VIDEO_EXTS_V130`, `isVideoFileNameV130`
- 9079–9088 · `decorateVideoIconsInListV130`
- 9115–9686 · `_musicConfigRefV131`, `_activeUiDeckV131`, `createDefaultVideoConfigV131`, `videoDeckV131` …+17
- 9712–9789 · `toggleVideoDspModeV130`, `toggleVideoRotate90V130`, `cycleVideoFitModeV130`, `cycleVideoSpeedV130` …+4
- 9799–9943 · `saveCurrentVideoToLibraryV130`, `closeVideoPlayerV130`, `openJennyVideoPlayerV130`, `bindVideoStudioEventsV130`
- 9968–10529 · `_vidStateV130`, `syncNativeFullscreenLockV132`, `toggleVideoNativeFullscreenV132`, `toggleVideoLockModeV132` …+15
- 10621–11097 · `openJennyVideoPlayerV130`, `closeVideoPlayerV130`, `syncDiscoveredVideosIntoPlaylistV134`, `decodeVideoToRamV131` …+12
- 11125–11150 · `syncDiscoveredVideosIntoPlaylistV134`
- 11215–11259 · `ensureAllVideoFormatsInConfigV138`
- 11317–11323

Куски патчей-IIFE (диапазоны строк внутри исходного IIFE):

- **V143** (12 стр.): 11629–11640 · `closeVideoPlayerV130`
- **V145** (17 стр.): 11991–12007 · `clampPipVideoInsideScreenV145`
- **V147** (137 стр.): 12049–12182, 12223–12233 · `removeDesktopOverlayButtonsFromHudV147`, `ensureVideoPlayingInOverlayV147`, `saveLiveWorkspaceSnapshotV146` …+2
- **V150** (64 стр.): 12239, 12307–12344, 12357–12366, 12522–12533, 12742–12747 · `ensureDualDeckFormatSlotsV150`, `isVideoFileNameV130`, `isVideoTrackAllowedByFormatSlotsV150` …+2
- **V167** (385 стр.): 13218–13615 · `getEffectiveVideoDurationV167`, `getEffectiveVideoCurrentTimeV167`, `getEffectiveVideoCurrentTimeV210` …+5
- **V200** (147 стр.): 14551–14578, 14688–14802, 14818–14823 · `updateVideoHeaderTelemetryV166`, `probeVideoCipherV166`, `renderVCoreDeckPanelV166` …+1
- **V170** (228 стр.): 14836–14975, 15006–15110 · `setVideoDeckSpeedV170`, `cycleVideoSpeedV130`, `cycleVideoSpeedV131` …+1
- **V210** (220 стр.): 15151–15159, 15171–15187, 15191, 15260–15282, 15309–15328, 15377–15477, 15484–15511, 15603–15605, 16095–16098, 16384–16402 · `isLocalFileFullyDownloadedV210`, `isDeckBVideoControlActiveV210`, `formatVideoTimeV210` …+11
- **V211** (1084 стр.): 16602–17001, 17023–17133, 17135–17207, 17272–17795 · `saveDualDeckStateV211`, `syncDualDeckVisibilityAndAudioV211`, `toggleComplementDeckV211` …+14

#### 10. `ui_video_reverse.js` — 25 блоков, ~1044 строк

Целые верхнеуровневые блоки:

- 9688–9710 · `updateVideoRevBtnUIV131`, `toggleVideoReverseV131`

Куски патчей-IIFE (диапазоны строк внутри исходного IIFE):

- **V211** (61 стр.): 17134, 17210–17269 · `isReversedDeckB`, `toggleReverseModeDeckB`
- **V217** (166 стр.): 21517–21640, 21748–21794 · `startImmediateVideoReverseEngineV217`, `toggleVideoReverseV131`, `toggleReverseModeDeckB`
- **V219** (157 стр.): 24408–24525, 24664–24707 · `startImmediateVideoReverseEngineV217`, `toggleVideoReverseV131`
- **V221** (149 стр.): 25639–25787 · `startImmediateVideoReverseEngineV217`
- **V223** (305 стр.): 26041–26060, 26079–26364 · `cleanupRevBlobQueueV223`, `pumpReverseRamBlobQueueV223`, `startImmediateVideoReverseEngineV217`
- **V224** (21 стр.): 26604–26626 · `bindRevPauseGuardV224`
- **V227** (90 стр.): 26693–26742, 26960–26999 · `startImmediateVideoReverseEngineV217`, `toggleReverseModeDeckB`
- **V369** (73 стр.): 37074–37146 · `startImmediateVideoReverseEngineV217`

#### 11. `ui_framegen.js` — 180 блоков, ~2375 строк

Целые верхнеуровневые блоки:

- 2–24 · `_jennyExp120HzEnabledV205`, `_jennyV172ViewportFixed`

Куски патчей-IIFE (диапазоны строк внутри исходного IIFE):

- **V200** (1015 стр.): 13621–14549, 14580–14686, 14804–14816, 14825–14828 · `computeExactVideoSplitUvV208`, `getRealOrigFpsV208`, `setInterpFramesV200` …+5
- **V170** (6 стр.): 15113–15118 · `getExactInterpAlphaV170`
- **V210** (1103 стр.): 15136–15149, 15160–15168, 15189–15190, 15193–15258, 15284–15307, 15330–15375, 15480–15482, 15513–15601, 15608–16093, 16100–16382, 16404–16520 · `saveJennyLabFlagsV208`, `getEffectiveVideoCurrentTimeV210`, `seekDeckBVideoToSecV210` …+7
- **V217** (113 стр.): 21351–21465 · `mountModularLabSettingsV208`
- **V218** (56 стр.): 22702–22765 · `resetTunerKnobsToZeroV218`
- **V369** (59 стр.): 36612–36624, 36689–36725, 37316–37325 · `syncModularLabDOMV208`, `mountModularLabSettingsV208`

#### 12. `ui_export_modal.js` — 12 блоков, ~205 строк


Куски патчей-IIFE (диапазоны строк внутри исходного IIFE):

- **V216** (1 стр.): 19879 · `EXPORT_OUT_SVG_V216`
- **V234** (204 стр.): 29561–29586, 29639–29825 · `ensureExportDefaultsV234`, `applyExportSectionsCollapseUIV234`, `toggleExportSectionCollapseV234` …+4

#### 13. `ui_shade.js` — 26 блоков, ~443 строк


Куски патчей-IIFE (диапазоны строк внутри исходного IIFE):

- **V212** (163 стр.): 17934, 18726–18896 · `syncPermanentForegroundNotificationV212`, `syncAndroidNotification`, `checkBackgroundUnrestrictedStatusV212` …+3
- **V216** (97 стр.): 21117–21213 · `syncPermanentForegroundNotificationV212`, `syncAndroidNotification`
- **V237** (73 стр.): 31806–31829, 32190–32240 · `onAndroidNotifLockChangedV237`, `toggleAndroidNotifLockFromUIV237`, `syncPermanentForegroundNotificationV212`
- **V240** (59 стр.): 32986–33046 · `explicitMediaSessionPauseV240`, `explicitMediaSessionPlayV240`
- **V243** (51 стр.): 35236, 35346–35369, 35426–35451 · `syncAndroidSafeInsetsV243`

#### 14. `ui_net.js` — 19 блоков, ~384 строк


Куски патчей-IIFE (диапазоны строк внутри исходного IIFE):

- **V232** (16 стр.): 29520–29535
- **V238** (202 стр.): 32559–32744, 32854–32880, 32904–32909 · `stripJennyLocalOriginV238`, `pickJennyPortForPathV238`, `routeJennyApiUrlV238` …+2
- **V239** (17 стр.): 32938–32954
- **V238** (74 стр.): 34899–34973 · `fetch`, `fetchTorrentEngineLogV238`
- **V243** (75 стр.): 35535–35609

#### 15. `ui_video_decks.js` — 311 блоков, ~7308 строк


Куски патчей-IIFE (диапазоны строк внутри исходного IIFE):

- **V211** (105 стр.): 17809–17924 · `openJennyVideoPlayerV130`, `closeVideoPlayerV130`, `isDeckBVideoControlActiveV210`
- **V212** (544 стр.): 17936–18508 · `getEffectiveVideoDurationV167`, `getEffectiveVideoDurationV210`, `resolveReadyLocalVideoInfoV212` …+10
- **V215** (202 стр.): 18945–19154, 19282–19290 · `syncVideoRamEngineV211`, `syncVideoRamEngineV131`, `decodeVideoToRamV131` …+3
- **V216** (635 стр.): 19959–20297, 20620–20944 · `applyDeckBVolumeV216`, `toggleVolumePopupDeckBV216`, `playAdjacentVideoDeckBV216` …+19
- **V217** (828 стр.): 21250–21348, 21470–21516, 21642–21745, 21796–21840, 21971–22251, 22281–22572, 22579–22583 · `VID_SVGS_V217`, `saveVideoUiCfgV217`, `getEnabledVideoFitModesV217` …+23
- **V218** (753 стр.): 22658–22697, 22882–23290, 23354–23698, 24049–24058 · `syncExactRot90DimensionsV217`, `getCurrentDeckTargetFilenameV218`, `syncDeckFavButtonsUIV218` …+21
- **V219** (557 стр.): 24227–24405, 24528–24659, 24709–24735, 24810–24935, 24947–25048, 25058–25073 · `applyCurrentVideoStreamModeV217`, `getNonBaseCustomVideoSpeedZonesV219`, `getEffectiveVideoCurrentTimeV167` …+11
- **V221** (587 стр.): 25193–25321, 25342–25560, 25597–25624, 25789–26032 · `clearRootInlinePipGeometryV221`, `applyInAppPipGeometryV221`, `syncExactRot90DimensionsV217` …+18
- **V223** (7 стр.): 26366–26372 · `restoreNormalVideoPlaybackV217`
- **V224** (45 стр.): 26550–26600 · `openJennyVideoPlayerV130`, `toggleVideoLockModeV132`, `toggleVideoPipModeV130` …+3
- **V227** (758 стр.): 26649–26688, 26746–26955, 27002–27516, 27946–27951 · `getEffectiveVideoCurrentTimeV167`, `getEffectiveVideoCurrentTimeV210`, `restoreNormalVideoPlaybackV217` …+8
- **V229** (199 стр.): 27966–27977, 28012–28039, 28058–28063, 28205–28273, 28297–28389 · `computeAudioAndVideoCountsV229`, `syncDualDeckCountersV216`, `refreshDeckListV216` …+6
- **V230** (92 стр.): 28933–28978, 28995–29041 · `resolveYoutubeVideoLinkV230`, `playYoutubeVideoInDeckBV230`, `downloadYoutubeVideoV230`
- **V232** (105 стр.): 29084–29178, 29538–29547 · `forceStopPauseDeckAAudioV232`, `toggleComplementDeckV211`
- **V235** (39 стр.): 30078–30091, 30145–30158, 30425–30435 · `syncTopDockedRefreshVisibilityV235`, `ensureDual9ButtonBarsDOMV216`, `togglePlayDeckBV216`
- **V239** (18 стр.): 32957–32974
- **V240** (110 стр.): 33316–33428 · `openJennyVideoPlayerV130`, `applyCurrentVideoStreamModeV217`
- **V242** (67 стр.): 34011–34053, 34095–34113, 34856–34863 · `isCurrentViewVideoContextV242`, `syncContextRefreshCounterV242`, `refreshDeckListV216` …+3
- **V243** (35 стр.): 35459–35497 · `ensureVideoPrevNextZonesV243`, `releaseDetachedAudioSocketV243`
- **V360** (68 стр.): 36122–36174, 36416–36434 · `isVideoTrackAllowedByFormatSlotsV150`, `syncDiscoveredVideosIntoPlaylistV134`
- **V369** (977 стр.): 36727–37070, 37152–37227, 37231–37248, 37252–37313, 37328–37409, 37417–37838 · `openVideoDeckDspStudioV131`, `normalizeVideoRamKeyV369`, `decodeVideoToRamV131` …+14
- **V370** (19 стр.): 38059, 38237–38254 · `invalidateDeckAHoseCacheV370`, `forceStopPauseDeckAAudioV232`
- **V371** (116 стр.): 38494–38571, 38635–38672 · `seekDeckAToExactSecondV371`
- **V372** (442 стр.): 38700, 38818–39277 · `getEffectiveDeckADurationV372`, `getEffectiveVideoCurrentTimeV167`, `getEffectiveVideoCurrentTimeV210` …+6

#### 16. `ui_layout.js` — 8 блоков, ~87 строк


Куски патчей-IIFE (диапазоны строк внутри исходного IIFE):

- **V242** (39 стр.): 33919, 33956–33967, 34662–34675, 34866–34877 · `toggleModal`, `updateAllStudioHeaderPillsV242`
- **V360** (48 стр.): 36436–36485 · `syncHeaderHeightWithModalsV71`, `syncEdgeToEdgeLayoutBoundsV242`

#### 17. `ui_shade_v243.js` — 8 блоков, ~115 строк


Куски патчей-IIFE (диапазоны строк внутри исходного IIFE):

- **V243** (109 стр.): 35452–35454, 35756–35848, 35930–35943 · `syncPermanentForegroundNotificationV212`, `syncAndroidNotification`
- **V244** (6 стр.): 35949–35954 · `syncAndroidSafeInsetsV243`

#### 18. `ui_deck_a_guard.js` — 5 блоков, ~123 строк


Куски патчей-IIFE (диапазоны строк внутри исходного IIFE):

- **V370** (123 стр.): 37858–37863, 37921–38037 · `isDeckAActuallyPlayingV232`

## Приложение В. Функции с несколькими определениями: какая версия работает

Охвачены все 15 файлов в порядке загрузки. 250 имён, 804 определения; у 217 имён хотя бы одно определение в `ui_v71.js`.

Как читать:

- `v71` — это `ui_v71.js`, остальные файлы названы без `.js`; после двоеточия номер строки.
- «Опр.» — число определений, которые выполняются при загрузке; `+1` — ещё одно ставится позже, из функции.
- «Что работает» — живая цепочка. Жирным выделена версия, которая лежит в `window` после загрузки. Стрелка означает «вызывает сохранённую предыдущую». «База» — версия, которая никого не вызывает (полная замена). «Заглушка» — пустая функция вида `window.X = window.X || function(){}`.
- «Перекрыто» — версии, до которых по этому имени вызов больше не доходит. Часть из них обойдена не заменой, а тем, что более поздняя обёртка сохранила копию более старой версии (пример: `renderActivePlaylistTracksV71`, версия 9091 обойдена версией 11164).
- «Куда едет» — файлы `ui_*.js`, в которые попадают определения из `ui_v71.js`.

Оговорки:

- Обёртка распознаётся по тексту: рядом есть сохранение `x = window.Имя`, и `x` используется в теле новой функции. Запись «замена под условием» означает, что присваивание стоит внутри `if` и статически не видно, выполняется ли оно; в цепочке такие версии оставлены вместе с предыдущими.
- «Перекрыто» значит только «не достижимо по этому имени». Перед удалением любого такого кода нужно отдельно проверить, не сохранена ли версия в переменной, которой пользуется другая функция.
- В таблицу не попали обёртки по списку имён: строка 15378 (`setPlaybackSpeed`, `applyPlaybackSpeed`, `setSpeed`, `changeSpeed`), строка 19380 (`stopCurrentOpenTorrentV143`, `deleteCurrentOpenTorrentV143`, `nukeAllTorrentsV142`, `cleanupActiveTorrentStreamV143`, `resetOpenTorrentScreenUI_V143`), строка 26566 (`openJennyVideoPlayerV130`, `toggleVideoLockModeV132`, `toggleVideoPipModeV130`, `exitDesktopOverlayModeV132`). Каждая добавляет ещё одно звено в цепочку своих функций.

| Функция | Опр. | Что работает (последняя → … → база) | Перекрыто (не вызывается по этому имени) | Куда едет |
|---|---|---|---|---|
| `_buildAudioGraphCore` | 2 | **ui_help:4245** → engine_audio:582 (база) | — |  |
| `loadConfigFromDisk` | 3 | **v71:31224** → ui_help:833 → engine_heads:96 (база) | — | settings |
| `changeVolume` | 2 | **v71:24738** (база) | engine_heads:220 | settings |
| `applyVolumeSettings` | 2 | **v71:24796** (база) | engine_heads:242 | settings |
| `updateSettings` | 2 | **v71:24940** → engine_heads:253 (база) | — | settings |
| `applyEQSettings` | 2 | **v71:23057** (база) | engine_heads:315 | video_decks |
| `changeEQ` | 2 | **v71:23038** (база) | engine_heads:325 | video_decks |
| `onNativeFolderPicked` | 3 | **v71:12686** (база) | engine_heads:335, ui_help:3912 | playlist |
| `toggleFav` | 2 | **v71:22854** → engine_fav:7 (база) | — | playlist |
| `saveZonesToConfig` | 2 | **v71:23062** (база) | ui_config:5 | video_decks |
| `toggleModal` | 7+1 | **v71:33958** → v71:13195 → v71:1100 → ui_help:4491 (база) | ui_config:46, ui_help:1329, ui_help:2208 · отложенно: deck_b_modals:1933 (function hookGlobalToggleModalForDeckBV359) | settings, layout |
| `filterTracks` | 6 | **v71:34197** → v71:3242 (база) | ui_config:73, v71:1549, v71:2300, v71:2840 | playlist |
| `showToast` | 2 | **ui_help:38** → ui_config:97 (база) | — |  |
| `handleTrackPlayBtn` | 6 | **v71:29343** (база) | ui_render:6, v71:1979, v71:9959, v71:11199, v71:28277 | transport |
| `updateTrackListPlayIcons` | 2 | **v71:29307** (база) | ui_render:16 | playlist |
| `syncRowActionButtons` | 2 | **v71:526** (база) | ui_render:187 | playlist |
| `ensureTrackInfoModal` | 2 | **ui_help:63** → ui_render:314 (база) | — |  |
| `fetchData` | 6 | **v71:32039** → v71:29451 → v71:20308 → v71:876 → v71:330 → ui_render:505 (база) | — | playlist |
| `prioritizeRamPieceAtCursorV72` | 2 | **v71:38044** → ui_playback:34 (база) | — | torrent |
| `decodeHugeTrackToRamV71` | 3 | **v71:38065** (база) | ui_playback:42, v71:17006 | reverse |
| `updateCenterCurrentTime` | 3 | **v71:38464** (база) | ui_playback:224, v71:3834 | reverse |
| `playNextTrack` | 2 | **v71:2029** (база) | ui_playback:250 | transport |
| `playPreviousTrack` | 2 | **v71:2043** (база) | ui_playback:262 | transport |
| `playTrack` | 10 | **v71:35613** → v71:32291 (база) | ui_playback:291, v71:108, v71:1993, v71:3746, v71:17800, v71:20407, v71:28288, v71:29416 | transport |
| `togglePlay` | 5 | **v71:35712** → v71:30421 (алиас на `togglePlayV75_2`, под условием) → v71:29303 (алиас на `togglePlayV75_2`) | ui_playback:466, v71:3466 | transport |
| `updateProgressUI` | 2+1 | **v71:3844** → ui_controls:159 (база) | — · отложенно: ui_playback:480 (document.addEventListener) | reverse |
| `syncAndroidNotification` | 4 | **v71:35756** (база) | ui_playback:570, v71:18812, v71:21213 | shade, shade_v243 |
| `startScrub` | 4 | **v71:38779** → v71:28065 (база) | ui_scrub_engine:4, v71:14979 | reverse |
| `stopScrub` | 4 | **v71:38798** → v71:28132 (база) | ui_scrub_engine:47, v71:14990 | reverse |
| `setupSeekZone` | 2 | **v71:27545** (база) | ui_touch_arc:5 | transport |
| `toggleReverseMode` | 4 | **v71:38702** (база) | ui_controls:5, v71:1305, v71:2447 | reverse |
| `ensureExportModalV69` | 2 | **v71:29688** (база) | ui_export:427 | export_modal |
| `exportCurrentTrack` | 2 | **v71:29810** → ui_export:516 (база) | — | export_modal |
| `selectExportSampleRateV86` | 3 | **v71:29798** → ui_export:676 (база) | ui_export:674 | export_modal |
| `toggleLanguage` | 2 | **ui_help:1017** → ui_help:13 (база) | — |  |
| `applyStaticDOMTranslations` | 2 | **v71:30067** → ui_help:79 (база) | — | settings |
| `syncFormatSlotsUI` | 3 | **v71:19200** (база) | ui_help:219, v71:12378 | settings |
| `addNewFormatSlotV85` | 2 | **v71:12478** (база) | ui_help:231 | settings |
| `isTrackAllowedByFormatSlots` | 2 | **v71:12369** (база) | ui_help:248 | settings |
| `saveFormatSlotsToConfig` | 2 | **v71:12414** (база) | ui_help:275 | settings |
| `resetFormatSlots` | 2 | **v71:12462** (база) | ui_help:295 | settings |
| `updateTopSearchOrMonitorBar` | 5 | **v71:36487** (база) | ui_help:327, v71:340, v71:30054, v71:33925 | playlist |
| `getHelpDB` | 2 | **v71:19726** → ui_help:568 (база) | — | settings |
| `mountJennyStudioUI` | 4 | **v71:21220** → ui_help:4184 → ui_help:1319 → ui_help:624 (база) | — | settings |
| `updateDualLangButtons` | 2 | **ui_help:1730** → ui_help:756 (база) | — |  |
| `runAwayLangBadgeToSettings` | 3 | **v71:30166** (база) | ui_help:856, ui_help:1711 | settings |
| `crawlAwayLangBadgeToSettings` | 4 | **v71:30254** (база) | ui_help:915, ui_help:1719, ui_help:3928 | settings |
| `applyVisualThemeV37` | 4 | **ui_help:2279** (база) | ui_help:1104, ui_help:1410, ui_help:2031 |  |
| `selectThemeBorderKeyV37` | 2 | **ui_help:2102** (база) | ui_help:1137 |  |
| `onThemeAlphaInputV37` | 2 | **ui_help:2093** (база) | ui_help:1139 |  |
| `onThemeAmoledToggleV37` | 2 | **ui_help:2067** (база) | ui_help:1141 |  |
| `onThemeVolSliderToggleV37` | 2 | **ui_help:2083** (база) | ui_help:1143 |  |
| `resetVisualThemeV37` | 3 | **ui_help:2123** (база) | ui_help:1145, ui_help:1515 |  |
| `openThemeStudioModalV37` | 3 | **ui_help:2631** → ui_help:2193 → ui_help:1185 (база) | — |  |
| `closeThemeStudioToSettingsV37` | 2 | **ui_help:2200** → ui_help:1195 (база) | — |  |
| `ensureThemeStudioModalV37` | 2 | **ui_help:1523** → ui_help:1203 (база) | — |  |
| `getCurrentThemeObjectV38` | 2 | **ui_help:2433** (база) | ui_help:1404 |  |
| `applyGroupColorsV38` | 2 | **ui_help:2454** (база) | ui_help:1406 |  |
| `onGroupColorInputV38` | 2 | **ui_help:2110** (база) | ui_help:1415 |  |
| `applyThemeFromTextareaV38` | 2 | **ui_help:1869** (база) | ui_help:1472 |  |
| `downloadThemeJsonFileV38` | 2 | **ui_help:2648** (база) | ui_help:1474 |  |
| `syncThemeStudioUIV38` | 2 | **ui_help:2014** → ui_help:1495 (база) | — |  |
| `findNearestStandardColorV39` | 2 | **ui_help:2158** (база) | ui_help:1638 |  |
| `syncSettingsLangBtnVisibilityV39` | 2 | **v71:33854** → ui_help:1641 (база) | — | settings |
| `dockLangBadgeIntoOpenSettingsV39` | 4 | **v71:33880** → v71:31531 (база) | ui_help:1664, v71:30359 | settings |
| `applySmartPartialThemeV39` | 2 | **ui_help:2528** (база) | ui_help:1774 |  |
| `openSavedThemesModalV39` | 2 | **ui_help:2358** (база) | ui_help:1908 |  |
| `upgradeThemeModalControlsV39` | 3 | **ui_help:2516** → ui_help:2387 → ui_help:1970 (база) | — |  |
| `saveThemeOnlyQuietlyV40` | 2 | **ui_help:2284** (база) | ui_help:2028 |  |
| `silentAutoSaveThemeToFileV41` | 2 | **ui_help:2638** (база) | ui_help:2352 |  |
| `refreshSavedThemesListV41` | 2 | **ui_help:2705** (база) | ui_help:2382 |  |
| `deleteSavedThemeFileV41` | 2 | **ui_help:2747** (база) | ui_help:2384 |  |
| `applyElasticHoseBufferLiveV46` | 4 | **v71:38391** (через локальную `wrappedV370`) → v71:36110 (через локальную `wrappedSync`) → ui_help:3544 (база) | ui_help:3171 | reverse |
| `onToggleElasticHoseV44` | 2 | **ui_help:3548** (база) | ui_help:3271 |  |
| `ensureStudioBufferLoadedV61` | 2 | **v71:1114** (база) | ui_help:3407 | reverse |
| `getActiveTargetSpeedV59` | 2 | **ui_help:4722** → ui_help:3437 (база) | — |  |
| `syncMasterPlaybackEngineV59` | 10 | **v71:38390** (через локальную `wrappedV370`) → v71:36109 (через локальную `wrappedSync`) → v71:29184 → v71:3760 → v71:1232 → v71:1017 → ui_help:5664 → ui_help:5420 → ui_help:4731 → ui_help:3453 (база) | — | reverse |
| `openFolderManagerModalV62` | 4 | **v71:32774** (база) | ui_help:3821, v71:475, v71:32129 | playlist |
| `triggerSystemFolderPickerV62` | 2 | **v71:12681** → ui_help:3900 (база) | — | playlist |
| `syncGuideButtonPositionV165` | 2 | **v71:31387** (база) | ui_help:4012 | settings |
| `onToggleHideHelpBadgesV62` | 2 | **v71:31493** (база) | ui_help:4054 | settings |
| `syncEngineTumblerUIV62` | 1+1 | **ui_help:4135** (база) | — · отложенно: ui_help:4895 (window.initGearboxInteractivityV66=fn) |  |
| `engageDirectRamPitchShiftV70` | 4 | **v71:2495** (база) | ui_help:4623, v71:777, v71:1034 | reverse |
| `captureExportDspDnaV76` | 2 | **ui_help:6285** → ui_help:5810 (база) | — |  |
| `applyInverseDspCompensationV76` | 2 | **ui_help:6397** → ui_help:5864 (база) | — |  |
| `savePlaylistStateQuietlyV71` | 2 | **v71:22869** → v71:68 (база) | — | playlist |
| `closeAllV71Modals` | 3 | **v71:36578** → v71:1467 → v71:73 (база) | — | playlist |
| `mountPlaylistStripDOMV71` | 2 | **v71:3380** → v71:122 (база) | — | playlist |
| `getTrackCountForTabV71` | 5 | **v71:12535** (база) | v71:159, v71:2109, v71:9072, v71:11153 | playlist |
| `renderPlaylistStripChipsV71` | 2 | **v71:1616** → v71:180 (база) | — | playlist |
| `selectPlaylistTabV71` | 3 | **v71:36371** → v71:2599 → v71:211 (база) | — | playlist |
| `sortTrackArrayForTabV71` | 3 | **v71:23948** → v71:2129 → v71:225 (база) | — | playlist |
| `renderActivePlaylistTracksV71` | 13 | **v71:34187** → v71:28043 → v71:23982 → v71:20319 → v71:12584 → v71:11164 → v71:3389 → v71:2695 (база) | v71:250, v71:1632, v71:1906, v71:2233, v71:9091 | playlist |
| `openPlaylistSortModalV71` | 2 | **v71:2165** | v71:376 | playlist |
| `toggleFolderActivePoolV71` | 3 | **v71:36202** (база) | v71:508, v71:12714 | playlist |
| `addFolderToPoolV71` | 2 | **v71:36266** (база) | v71:513 | playlist |
| `removeFolderFromPoolV71` | 3 | **v71:36304** (база) | v71:520, v71:12729 | playlist |
| `syncHeaderHeightWithModalsV71` | 3 | **v71:36436** (база) | v71:1066, v71:3354 | settings, layout |
| `engageHorizonRamEngineV71_5` | 2 | **v71:1317** (база) | v71:1117 | reverse |
| `attachStripLongPressV73` | 2 | **v71:3029** (база) | v71:1476 | playlist |
| `collectActiveSubGroupsV73` | 2 | **v71:2119** → v71:1479 (база) | — | playlist |
| `updateScopedSearchPlaceholderV73` | 4 | **v71:34116** (база) | v71:1495, v71:2630, v71:12569 | playlist |
| `selectSubFilterItemV73` | 2 | **v71:2625** (база) | v71:1629 | playlist |
| `openAllPlaylistsLongPressModalV73` | 3 | **v71:3097** → v71:2368 → v71:1721 (база) | — | playlist |
| `openSubStripLongPressModalV73` | 3 | **v71:3106** → v71:2874 (база) | v71:1788 | playlist |
| `setExactPlaybackPositionV75` | 3 | **v71:38573** (база) | v71:2408, v71:37897 | reverse |
| `getTruePlaybackTimeV74_2` | 2 | **v71:37865** (база) | v71:2421 | reverse |
| `togglePlayV75_2` | 3 | **v71:30413** → v71:29220 (база) | v71:3404 | transport |
| `pauseMainPlayerForOstV90` | 2 | **v71:29516** (база) | v71:3871 | sources |
| `stopKhPreviewV88` | 3 | **v71:33475** (алиас на `stopAllExternalStreamsV97`) | v71:3883, v71:5286 | sources |
| `updateKhHeaderBtnBadgeV89` | 2 | **v71:5815** (база) | v71:3917 | sources |
| `selectKhFormatV88` | 2 | **v71:5055** → v71:3974 (база) | — | sources |
| `toggleKhMiniPlayPauseV90` | 2 | **v71:33717** (база) | v71:3994 | sources |
| `seekKhPreviewV90` | 2 | **v71:6312** (алиас на `seekKhMiniPlayerV90`) | v71:4011 | sources |
| `openKhinsiderModalV88` | 3 | **v71:34703** → v71:4957 → v71:4017 (база) | — | sources |
| `previewKhTrackV88` | 4 | **v71:33649** (база) | v71:4088, v71:5289, v71:5613 | sources |
| `runKhSearchV88` | 2 | **v71:4978** (база) | v71:4139 | sources |
| `downloadSingleKhTrackV88` | 2 | **v71:34711** (база) | v71:4256 | sources |
| `downloadSelectedKhTracksV88` | 3 | **v71:34753** (база) | v71:4284, v71:33239 | sources |
| `getPinnedSourcesV91` | 4 | **v71:31214** (база) | v71:4336, v71:23786, v71:28420 | sources |
| `togglePinSourceV91` | 4 | **v71:31357** (база) | v71:4344, v71:23801, v71:26512 | sources |
| `triggerSourceActionV91` | 2 | **v71:28436** → v71:4361 (база) | — | sources |
| `toggleSourcesDropdownMenuV91` | 5 | **v71:31791** → v71:31332 (база) | v71:4380, v71:4821, v71:23817 | sources |
| `renderHeaderSourcesHubV91` | 5 | **v71:31256** → v71:26437 (база) | v71:4411, v71:19884, v71:23862 | sources |
| `renderSourcesSettingsSectionV91` | 3 | **v71:23917** (база) | v71:4440, v71:7112 | sources |
| `stopFlacRadioStreamV91` | 4 | **v71:35521** → v71:34212 (база) | v71:4469, v71:33102 | sources |
| `playFlacRadioStationV91` | 2 | **v71:34228** (база) | v71:4563 | sources |
| `toggleRadioRecordToXflacV91` | 3 | **v71:34850** → v71:33117 (база) | v71:4595 | sources |
| `openFlacRadioModalV91` | 2 | **v71:34687** → v71:4653 (база) | — | sources |
| `openSoundCloudModalV92` | 4 | **v71:34679** → v71:6202 (база) | v71:4704, v71:5025 | sources |
| `runScDedicatedSearchV93` | 2 | **v71:5075** | v71:4743 | sources |
| `openTorrentHubPreviewModalV91` | 6 | **v71:8676** → v71:7776 → v71:6838 → v71:5902 → v71:5118 (база) | v71:4745 | torrent |
| `killAllSourceModulesV94` | 3 | **v71:31696** (база) | v71:4776, v71:8588 | sources |
| `applyKhModalModeThemeV95` | 3 | **v71:34582** (база) | v71:4925, v71:5104 | sources |
| `previewScTrackV96` | 2 | **v71:33583** (база) | v71:5063 | sources |
| `downloadScTrackV96` | 3 | **v71:34842** → v71:5363 (база) | v71:5073 | sources |
| `runTorrentActionV96` | 7 | **v71:8473** (база) | v71:5151, v71:5907, v71:6114, v71:6578, v71:8142, v71:8271 | torrent |
| `openMagnetInGoEngineV96` | 7 | **v71:34978** → v71:7782 → v71:7286 → v71:6230 → v71:5185 (база) | v71:6164, v71:6637 | torrent |
| `renderTorrentFilesListV96` | 11 | **v71:31836** (база) | v71:5208, v71:5452, v71:5667, v71:5953, v71:6365, v71:7390, v71:8046, v71:11806, v71:11958, v71:30866 | torrent |
| `startSelectedTorrentDownloadV96` | 9 | **v71:31149** → v71:11701 (база) | v71:5224, v71:5482, v71:5701, v71:5971, v71:6186, v71:7426, v71:8076 | torrent |
| `stopAllExternalStreamsV97` | 4 | **v71:33468** → v71:11621 → v71:5607 → v71:5269 (база) | — | sources |
| `backToTorrentSearchListV97` | 4 | **v71:8347** → v71:7855 → v71:7331 → v71:5393 (база) | — | torrent |
| `previewTorrentFileStreamV97` | 7 | **v71:11920** → v71:11645 → v71:9946 → v71:8682 (база) | v71:5419, v71:5621, v71:6696 | torrent |
| `bindAudioToAllMiniPlayersV98` | 4 | **v71:33571** (база) | v71:5574, v71:6315, v71:6690 | sources |
| `downloadSingleTorrentTrackV98` | 8 | **v71:31135** → v71:18680 (база) | v71:5656, v71:6173, v71:7404, v71:8604, v71:11658, v71:11943 | torrent |
| `showMainPageEncodingBannerV98` | 2 | **v71:5869** (база) | v71:5768 | torrent |
| `applyHeaderIconBadgeV99` | 2 | **v71:26524** (база) | v71:5796 | sources |
| `renderTorrentFilterBarV99` | 3 | **v71:19490** (база) | v71:5899, v71:6541 | torrent |
| `selectTorrentFormatTagV101` | 2 | **v71:19547** (база) | v71:6100 | torrent |
| `runTorrentDownloadQueueV102` | 2 | **v71:6381** (база) | v71:6199 | torrent |
| `enqueueTorrentTrackImportV112` | 2 | **v71:11734** → v71:7467 (база) | — | torrent |
| `processNextTorrentImportV112` | 2 | **v71:32069** (база) | v71:7482 | torrent |
| `paintOpenedTorrentJobProgressV112` | 4 | **v71:30885** (база) | v71:7519, v71:8627, v71:19363 | torrent |
| `ensureMultiTorrentWorkerV112` | 2 | **v71:18661** (база) | v71:7627 | torrent |
| `triggerPickTorrentFileV113` | 2 | **v71:7971** (база) | v71:7729 | torrent |
| `ensureTorrentYearInputV125` | 2 | **v71:19459** (база) | v71:8396 | torrent |
| `switchTorHubTabV128` | 2 | **v71:35101** → v71:8791 (база) | — | torrent |
| `controlTorrentJobV128` | 2 | **v71:11785** → v71:8800 (база) | — | torrent |
| `renderTorrentInspectorHubV128` | 3 | **v71:35862** → v71:35109 → v71:8844 (база) | — | torrent |
| `refreshTorrentDaemonSnapV128` | 4 | **v71:35040** → v71:31115 → v71:18569 (база) | v71:9010 | torrent |
| `isVideoFileNameV130` | 2 | **v71:12332** (база) | v71:9055 | video |
| `buildVideoAudioGraphV131` | 2 | **v71:24949** → v71:9192 (база) | — | video, video_decks |
| `renderDeckSwitchBannersV131` | 5+1 | **v71:23164** (база) | v71:9291, v71:14797, v71:16737, v71:19284 · отложенно: deck_b_modals:1945 (function hookGlobalToggleModalForDeckBV359) | video, video_decks |
| `syncAllControlsToActiveDeckV131` | 2 | **v71:23080** → v71:9307 (база) | — | video, video_decks |
| `switchActiveUiDeckV131` | 2 | **v71:12523** → v71:9341 (база) | — | video |
| `copyMusicDspToVideoV131` | 2 | **v71:23227** (база) | v71:9356 | video, video_decks |
| `decodeVideoToRamV131` | 8 | **v71:36759** (база) | v71:9370, v71:10656, v71:13395, v71:16786, v71:18281, v71:19076, v71:23689 | video, video_decks |
| `syncVideoRamEngineV131` | 9 | **v71:39025** (база) | v71:9499, v71:13322, v71:14966, v71:17023, v71:18318, v71:18981, v71:25598, v71:37458 | video, video_decks |
| `wakeVideoHudV130` | 3 | **v71:26596** (база) | v71:9650, v71:10474 | video, video_decks |
| `openVideoDeckDspStudioV131` | 3+1 | **v71:36727** (база) | v71:9652, v71:22227 · отложенно: deck_b_modals:1936 (function hookGlobalToggleModalForDeckBV359) | video, video_decks |
| `cycleDualDeckMixModeV131` | 2 | **v71:22127** (база) | v71:9662 | video, video_decks |
| `toggleVideoReverseV131` | 3 | **v71:24664** (база) | v71:9698, v71:21748 | video_reverse |
| `toggleVideoDspModeV130` | 2 | **v71:22212** (база) | v71:9712 | video, video_decks |
| `toggleVideoRotate90V130` | 2 | **v71:22157** (база) | v71:9723 | video, video_decks |
| `cycleVideoFitModeV130` | 2 | **v71:22141** (база) | v71:9734 | video, video_decks |
| `cycleVideoSpeedV130` | 4 | **v71:24613** (значение) | v71:9744, v71:14940, v71:21707 | video, video_decks |
| `toggleVideoPipModeV130` | 5 | **v71:25308** → v71:22282 → v71:11076 → v71:10506 → v71:9755 (база) | — | video, video_decks |
| `toggleVideoPlayPauseV130` | 4 | **v71:37206** → v71:23576 (база) | v71:9775, v71:10312 | video, video_decks |
| `seekVideoRelativeV130` | 2 | **v71:13306** (база) | v71:9777 | video |
| `switchVideoToFfmpegRemuxV130` | 7 | **v71:37063** → v71:25800 (база) | v71:9789, v71:10291, v71:18348, v71:20661, v71:23488 | video, video_decks |
| `openTorHubFromVideoV130` | 3 | **v71:22254** (база) | v71:9791, v71:20994 | torrent |
| `closeVideoPlayerV130` | 8 | **v71:23257** → v71:22561 → v71:17828 → v71:11630 → v71:11068 → v71:10636 → v71:10260 → v71:9807 (база) | — | video, video_decks |
| `openJennyVideoPlayerV130` | 13 | **v71:33368** → v71:22527 → v71:20890 → v71:18382 → v71:17811 → v71:14806 → v71:13602 → v71:12224 → v71:11003 → v71:10622 → v71:10363 (база) | v71:9826, v71:10252 | video, framegen, video_decks |
| `toggleVideoNativeFullscreenV132` | 3 | **v71:25279** (база) | v71:10016, v71:22178 | video, video_decks |
| `enterDesktopOverlayModeV132` | 2 | **v71:25469** → v71:10067 (база) | — | video, video_decks |
| `exitDesktopOverlayModeV132` | 2 | **v71:25483** → v71:10106 (база) | — | video, video_decks |
| `syncVideoPlayBtnIconV132` | 2 | **v71:22499** (база) | v71:10278 | video, video_decks |
| `onDesktopOverlayStateChangedV133` | 4 | **v71:37232** → v71:25492 → v71:10964 (база) | v71:10481 | video, video_decks |
| `syncDiscoveredVideosIntoPlaylistV134` | 3 | **v71:36138** (база) | v71:10651, v71:11125 | video, video_decks |
| `nukeAllTorrentsV142` | 2 | **v71:11797** → v71:11496 (база) | — | torrent |
| `cleanupActiveTorrentStreamV143` | 3 | **v71:20949** (база) | v71:11586, v71:11911 | torrent |
| `clampPipVideoInsideScreenV145` | 2 | **v71:25418** (база) | v71:11991 | video, video_decks |
| `isVideoTrackAllowedByFormatSlotsV150` | 2 | **v71:36122** (база) | v71:12357 | video, video_decks |
| `onToggleOnboardingHideHelpV165` | 2 | **v71:31510** (база) | v71:12901 | settings |
| `renderOnboardingPageV165` | 2 | **v71:19399** → v71:12990 (база) | — | settings |
| `getEffectiveVideoDurationV167` | 3 | **v71:20620** (значение) | v71:13218, v71:17940 | video, video_decks |
| `getEffectiveVideoCurrentTimeV210` | 7 | **v71:38818** (база) | v71:13229, v71:15284, v71:20644, v71:24529, v71:26649, v71:37153 | video, framegen, video_decks |
| `seekVideoToExactSecondV167` | 4 | **v71:26950** (база) | v71:13246, v71:18160, v71:20809 | video, video_decks |
| `setVideoDeckSpeedV170` | 3 | **v71:37633** → v71:22518 → v71:14860 (база) | — | video, video_decks |
| `cycleVideoSpeedV131` | 3 | **v71:24613** (база) | v71:14940, v71:21707 | video, video_decks |
| `isDeckBVideoControlActiveV210` | 2 | **v71:17841** (база) | v71:15260 | video, video_decks |
| `getEffectiveVideoDurationV210` | 3 | **v71:20620** (база) | v71:15276, v71:17957 | video, video_decks |
| `seekDeckBVideoToSecV210` | 4 | **v71:26953** (база) | v71:15289, v71:18163, v71:20812 | framegen, video_decks |
| `setVideoHudHiddenUnifiedV214` | 2 | **v71:26579** → v71:15567 (база) | — | framegen, video_decks |
| `syncModularLabDOMV208` | 2 | **v71:36690** → v71:16419 (база) | — | framegen |
| `mountModularLabSettingsV208` | 3 | **v71:36707** → v71:21351 (база) | v71:16443 | framegen |
| `syncDualDeckVisibilityAndAudioV211` | 2 | **v71:20291** → v71:16655 (база) | — | video, video_decks |
| `toggleComplementDeckV211` | 3 | **v71:29540** → v71:23116 (база) | v71:16684 | video, video_decks |
| `getBaseSpeedDeckB` | 2 | **v71:21500** (база) | v71:17138 | video, video_decks |
| `updateProgressUIDeckB` | 3 | **v71:26868** (база) | v71:17155, v71:18063 | video, video_decks |
| `toggleReverseModeDeckB` | 3 | **v71:26960** (база) | v71:17210, v71:21787 | video_reverse |
| `startScrubDeckB` | 3 | **v71:27002** (база) | v71:17272, v71:21796 | video, video_decks |
| `stopScrubDeckB` | 2 | **v71:27029** (база) | v71:17307 | video, video_decks |
| `setupTimeBlockControlsDeckB` | 2 | **v71:27052** (база) | v71:17347 | video, video_decks |
| `setupSeekZoneDeckB` | 2 | **v71:27158** (база) | v71:17451 | video, video_decks |
| `seekDeckBAndPlayerSyncedV212` | 6 | **v71:38946** → v71:37178 → v71:25840 → v71:23513 (база) | v71:18069, v71:20725 | video_decks |
| `syncPermanentForegroundNotificationV212` | 4 | **v71:35756** (значение) | v71:18726, v71:21118, v71:32191 | shade, shade_v243 |
| `promptAddFormatSlotV215` | 2 | **v71:21026** (база) | v71:19156 | settings |
| `resetThreadConfigV216` | 2 | **v71:22637** → v71:19705 (база) | — | settings |
| `renderThreadsSettingsBoxV216` | 3 | **v71:32884** → v71:22610 → v71:19796 (база) | — | settings |
| `applyDeckBVolumeV216` | 2 | **v71:24849** (база) | v71:19962 | video_decks |
| `playAdjacentVideoDeckBV216` | 2 | **v71:28310** (база) | v71:20001 | video_decks |
| `togglePlayDeckBV216` | 2 | **v71:30427** → v71:20023 (база) | — | video_decks |
| `openSpectrumForDeckV216` | 2 | **v71:23215** (база) | v71:20075 | video_decks |
| `openEqForDeckV216` | 2 | **v71:23202** (база) | v71:20084 | video_decks |
| `openFavForDeckV216` | 2 | **v71:22925** (база) | v71:20095 | video_decks |
| `refreshDeckListV216` | 3 | **v71:34096** → v71:28029 → v71:20108 (база) | — | video_decks |
| `syncDualDeckCountersV216` | 3 | **v71:34108** → v71:28012 (база) | v71:20136 | video_decks |
| `ensureDual9ButtonBarsDOMV216` | 2 | **v71:30147** → v71:20153 (база) | — | video_decks |
| `syncExactRot90DimensionsV217` | 3 | **v71:25229** (база) | v71:21310, v71:22659 | video_decks |
| `startImmediateVideoReverseEngineV217` | 6 | **v71:37075** → v71:26694 → v71:26161 (база) | v71:21520, v71:24408, v71:25639 | video_reverse |
| `restoreNormalVideoPlaybackV217` | 5 | **v71:26746** (база) | v71:21642, v71:24540, v71:25790, v71:26367 | video_decks |
| `applyCurrentVideoStreamModeV217` | 4 | **v71:33417** → v71:25539 → v71:24227 (база) | v71:22000 | video_decks |
| `syncVideoPlayerButtonsUIV217` | 4 | **v71:25975** → v71:24961 → v71:23358 → v71:22303 (база) | — | video_decks |
| `loadPersistentUserDataV218` | 2 | **v71:31236** → v71:22794 (база) | — | playlist |
| `cleanAndHighlightTorrentFileRowsV218` | 3 | **v71:31883** (база) | v71:23703, v71:31006 | torrent |
| `renderSourcesDropdownMenuContentV218` | 2 | **v71:31320** (база) | v71:23839 | sources |
| `openYoutubeStudioModalV230` | 2 | **v71:34695** → v71:28823 (база) | — | sources |
| `downloadYoutubeVideoV230` | 2 | **v71:34858** → v71:29006 (база) | — | video_decks |
| `isDeckAActuallyPlayingV232` | 2 | **v71:37858** (база) | v71:29073 | transport, deck_a_guard |
| `forceStopPauseDeckAAudioV232` | 2 | **v71:38238** → v71:29084 (база) | — | video_decks |
| `syncTopDockedRefreshVisibilityV235` | 2 | **v71:34103** (база) | v71:30078 | video_decks |
| `buildSourcesDropdownDOMOnceV236` | 2 | **v71:31758** → v71:31270 (база) | — | sources |
| `renderFolderManagerRowsHTMLV237` | 3 | **v71:36177** (база) | v71:32107, v71:32749 | playlist |
| `fetch` | 2 | **v71:34900** → v71:32664 | — | net |
| `refreshKhActiveDownloadBannerV240` | 2 | **v71:34650** → v71:33199 (база) | — | sources |
| `syncEdgeToEdgeLayoutBoundsV242` | 2 | **v71:36481** (база) | v71:33889 | settings, layout |
| `refreshActiveContextListV242` | 2 | **v71:36337** (база) | v71:34056 | playlist |
| `syncAndroidSafeInsetsV243` | 2 | **v71:35949** (база) | v71:35346 | shade, shade_v243 |
| `updateVideoAvSyncRadarUIV367` | 2 | **v71:39259** → v71:37702 (база) | — | video_decks |

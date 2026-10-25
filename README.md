# ⚠️ THE ORIGIN STORY / ИСТОРИЯ СОЗДАНИЯ

> **WARNING:** Proceed at your own risk. Built with pure stubbornness, welding sparks, and AI madness.

---

### 🇬🇧 ENGLISH VERSION

By all laws of logic, physics, and the IT industry, this software should have never seen the light of day. And it sure as hell shouldn't have survived until release.

Why? Because it was built by a welder. A guy who, at the start of this journey, knew absolute fuck-all about audio architecture or programming. Just so you understand the scale of this tragedy: a good half of the development time was spent simply trying to remember how to switch directories in the terminal using `cd` without blowing everything straight to hell.

In a sane world, the story would have ended right there. But two forces of nature collided here: ironclad human stubbornness paired with a sick imagination, and the colossal computing power of Gemini, capable of digesting tons of unhinged prompts 24/7.

Going from absolute zero to a working release took 10 full days of non-stop mindfuck, endless crashes, brain farts, code rewrites, and brutal survival testing. The welder forged the ideas, while the AI devoured prompts like a black hole and hammered them into working code.

The result is this hardcore piece of shit that — against all fucking odds — actually works and can surprise even the people who know their stuff.

The app is alive, and it’s going to grow and get beefier over time. So please: drop your feedback, bang on the rails, wire us all your money, we’ll help everyone... Just kidding! Put your wallets away: everything is 100% free, straight from the heart, with zero fucking ads or bullshit.

Download it, test it, and lose your mind over how far progress has come.

---

### 🇷🇺 РУССКАЯ ВЕРСИЯ

По всем законам логики, физики и IT-индустрии эта программа никогда не должна была появиться на свет. И уж тем более — дожить до релиза.

Почему? Да потому что её создал сварщик. Человек, который на старте вообще нихуя не понимал ни в архитектуре звука, ни в программировании. Чтобы вы понимали масштаб трагедии: добрая половина времени разработки ушла на попытки запомнить, как в терминале перейти в нужную папку через `cd` и не уронить всё к чертям.

В нормальном мире на этом история бы и закончилась. Но здесь сошлись две стихии: железобетонная человеческая упёртость с больной фантазией и колоссальная вычислительная мощь Gemini, способная переваривать тонны безумных промптов в режиме 24/7. 

От полного нуля до рабочего релиза ушли 10 полных суток непрерывного мозгоёбства, бесконечных крашей, тупняков, переписываний кода и жесточайших тестов на выживание. Сварщик варил идеи, нейросеть жрала промпты как не в себя и ковала из этого рабочий код.

В итоге на свет родилась эта жёсткая хуйня, которая — вопреки вообще всему — реально работает и способна удивить даже тех, кто шарит. 

Прога живая, она будет расти и обрастать мясом дальше. Так что, пожалуйста: пишите отзывы, звоните в рельсу, высылайте деньги, мы всем поможем... Шутка! Кошельки можете спрятать: всё абсолютно бесплатно, от души и без всяких реклам-хуям. 

Качайте, тестируйте и охуевайте от того, до чего дошёл прогресс.

---
# 🎧 JENNY'S PLAYER v1.0.0 — Mastering Studio Edition

Автономный аудиофильский DSP-плеер для Android с распаковкой звука в **32-bit Float PCM RAM**, честным режимом **Direct (Bit-Perfect)**, студийным мастеринг-трактом и оффлайн-рендерингом через нативный `libffmpeg.so`.

---

## 🔥 Ключевые возможности v1.0.0

### 🚀 Студийный 32-bit Float RAM-движок и Скраббинг
* **Полная распаковка в ОЗУ:** мгновенный отклик, нулевая задержка при перемотке и зеркальный реверс-буфер в реальном времени (тап по левому/правому таймеру).
* **Интеллектуальная радиальная дуга скоростей:** живое управление скоростью и направлением воспроизведения одним пальцем, режим «Левша», 6 настраиваемых радиальных слотов, независимые режимы **Pitch Lock** и **Vinyl (Slowed/Fast)**.

### 🧪 Тонкая настройка тракта (5 модулей)
* **🎯 Фаза СЧ Вокал (dB):** линейное управление посадкой вокала (`-15...+15 dB`) с чистой вокальной динамикой без перегрузки от саб-баса.
* **📐 Ширина СЧ купола (%):** плавная регулировка добротности средней полосы кроссовера.
* **🐍 Де-эссер ВЧ (dB):** укрощение резких сибилянтов («С/Ш/Ч») на высокой громкости.
* **✨ Драйв Чистый FIR (dB):** биполярная свёрточная сатурация с окном Хэннинга без низкочастотного гула.
* **🛡️ Авто-Мастер-Потолок:** умный анализатор суммарного разгона тракта с живым монитором в шапке и гладким аналоговым софт-клиппером `Math.tanh` (при отключении — 100% прозрачный Direct-тракт).

### 🎛️ Мастеринг-Студия PRO (5 спец-модулей)
* **⚡ Авто-RMS Цель (dB):** двухступенчатое выравнивание средней громкости и плотности разных треков по 32-битному буферу.
* **🧲 Моно-Саббас (Hz):** фазокогерентная Mid/Side фокусировка саб-баса в ударный центр (`L = R`).
* **🎭 Стерео-Ширина (%):** 3D All-Pass + Side-Exciter панорама специально под закрытые наушники.
* **🥁 Панч-Хлыст (dB):** динамический шейпер атаки бочки (`85 Гц`), очистки мид-баса (`230 Гц`) и щелчка снейра (`2600 Гц`).
* **🎧 Бинаурал-Колонки (%):** эмуляция акустики комнаты (Crossfeed `0.42 мс / 650 Гц`) с автоматическим переключением «Что-то одно из двух» со Стерео-Шириной.

### 🎵 Мультиформатность и Встроенный MediaInfo + Экспорт
* **8 настраиваемых слотов расширений:** поддержка `.mp3`, `.opus`, `.m4a`, `.flac`, `.wav`, `.ogg`, `.mp4`, `.aac` (и любых кастомных контейнеров).
* **Встроенный анализатор `/api/track_info`:** детальный разбор контейнера, кодека, битрейта, частоты дискретизации, сэмплов и тегов через `libffmpeg.so`.
* **Оффлайн-экспорт (💾):** сохранение трека со всеми накрученными настройками DSP, скоростью и реверсом в готовый файл `.opus`.

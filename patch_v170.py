#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os, glob

BASE_DIR = "/storage/emulated/0/scripts/JennyPlayer"
if not os.path.exists(BASE_DIR):
    BASE_DIR = os.getcwd()

def find_target_files():
    targets = []
    for root, _, files in os.walk(BASE_DIR):
        if "node_modules" in root or ".git" in root:
            continue
        for f in files:
            if f in ("ui_v71.js", "index.html"):
                targets.append(os.path.join(root, f))
    return targets

V170_PAYLOAD = r"""
/* ================= JENNY V170: TRUE VIDEO DECK SPEED ARC + BOTTOM BAR + EXACT FRAMEGEN SPLIT ================= */
(function() {
    if (window._jennyV170Installed) return;
    window._jennyV170Installed = true;

    window._jennyVideoSpeedV170 = 1.0;
    window._v170LastDecodedFrames = -1;
    window._v170LastFrameStamp = performance.now();
    window._v170SourceFrameInterval = 33.33; // ms (adjusted dynamically by playbackRate)

    function getVideoElV170() {
        return document.getElementById('jennyVideoElV130') || document.querySelector('video');
    }

    function isVideoDeckActiveV170() {
        var vEl = getVideoElV170();
        if (window._activeUiDeckV131 === 'video') return true;
        if (vEl && !vEl.paused && vEl.readyState >= 2 && vEl.offsetParent !== null) return true;
        return false;
    }

    function fmtTimeV170(sec) {
        if (!isFinite(sec) || sec < 0) sec = 0;
        var m = Math.floor(sec / 60);
        var s = Math.floor(sec % 60);
        return m + ":" + (s < 10 ? "0" + s : s);
    }

    // 1. Единая функция реального изменения скорости Видео + отвязанного Аудио (с сохранением Pitch-Lock)
    window.setVideoDeckSpeedV170 = function(rawSpeed, showNotification) {
        var spd = parseFloat(rawSpeed);
        if (!isFinite(spd) || spd <= 0) spd = 1.0;
        spd = Math.max(0.25, Math.min(3.0, Math.round(spd * 100) / 100));
        window._jennyVideoSpeedV170 = spd;

        var vEl = getVideoElV170();
        if (vEl) {
            try {
                vEl.preservesPitch = true;
                vEl.mozPreservesPitch = true;
                vEl.webkitPreservesPitch = true;
                vEl.defaultPlaybackRate = spd;
                vEl.playbackRate = spd;
            } catch (e) {}
        }

        // Обновляем состояние видеодеки и конфиг, чтобы старый цикл не сбрасывал скорость обратно на 0.5x
        if (window.videoDeckV131) {
            window.videoDeckV131.speed = spd;
            if (window.videoDeckV131.config) {
                window.videoDeckV131.config.playbackSpeed = spd;
                window.videoDeckV131.config.normalPlaybackSpeed = spd;
            }
            // Если у видеодеки отдельный буферный источник (RAM / WebAudio)
            if (window.videoDeckV131.sourceNode && window.videoDeckV131.sourceNode.playbackRate) {
                try { window.videoDeckV131.sourceNode.playbackRate.value = spd; } catch (e) {}
            }
            if (window.videoDeckV131.mediaPlayer) {
                try {
                    window.videoDeckV131.mediaPlayer.preservesPitch = true;
                    window.videoDeckV131.mediaPlayer.playbackRate = spd;
                } catch (e) {}
            }
        }

        // Если звук видео сейчас идет через отвязанный аудиоплеер/RAM-движок
        if (isVideoDeckActiveV170()) {
            var aEl = document.getElementById('audioPlayer') || window.player;
            if (aEl && aEl !== vEl) {
                try {
                    aEl.preservesPitch = true;
                    aEl.webkitPreservesPitch = true;
                    aEl.playbackRate = spd;
                } catch (e) {}
            }
            if (window.studioSourceNode && window.studioSourceNode.playbackRate) {
                try { window.studioSourceNode.playbackRate.value = spd; } catch (e) {}
            }
        }

        // Обновляем все кнопки скорости в HUD видео и индикатор внизу
        var hudBtns = document.querySelectorAll('[onclick*="cycleVideoSpeed"], #jennyVideoSpeedBtnV130, .jenny-video-speed-btn');
        hudBtns.forEach(function(btn) {
            btn.innerHTML = '⏩ ' + spd + 'x';
        });
        var allBtns = document.querySelectorAll('button, div');
        for (var i = 0; i < allBtns.length; i++) {
            var txt = (allBtns[i].textContent || '').trim();
            if (/^⏩\s*\d+(\.\d+)?x$/.test(txt)) {
                allBtns[i].textContent = '⏩ ' + spd + 'x';
            }
        }

        var spdInd = document.getElementById('speedLockIndicator');
        if (spdInd && isVideoDeckActiveV170()) {
            spdInd.textContent = 'x' + spd;
        }

        if (showNotification !== false && typeof window.showToast === 'function') {
            window.showToast('🎬 Скорость Видео + Звук (Pitch-Lock): ' + spd + 'x');
        }
        return spd;
    };

    // Перехватываем кнопки цикла скорости в видеоплеере (добавляем 0.25x для наглядной проверки 120Hz)
    var videoSpeedStepsV170 = [0.25, 0.5, 0.75, 0.9, 1.0, 1.1, 1.25, 1.5, 2.0];
    window.cycleVideoSpeedV130 = window.cycleVideoSpeedV131 = function(ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var cur = window._jennyVideoSpeedV170 || 1.0;
        var idx = -1;
        for (var i = 0; i < videoSpeedStepsV170.length; i++) {
            if (Math.abs(videoSpeedStepsV170[i] - cur) < 0.03) { idx = i; break; }
        }
        var nextSpd = videoSpeedStepsV170[(idx + 1) % videoSpeedStepsV170.length];
        return window.setVideoDeckSpeedV170(nextSpd, true);
    };

    // Перехватываем кнопку «Замедлить» в нижнем ряду видеоплеера: переключение 0.25x <-> 0.5x <-> 1.0x
    document.addEventListener('click', function(ev) {
        var t = ev.target;
        if (!t) return;
        var txt = (t.textContent || '').trim();
        if (txt.indexOf('Замедлить') !== -1) {
            ev.stopPropagation();
            var cur = window._jennyVideoSpeedV170 || 1.0;
            var next = (cur > 0.55) ? 0.5 : (cur > 0.3 ? 0.25 : 1.0);
            window.setVideoDeckSpeedV170(next, true);
        }
    }, true);

    // 2. Отключаем принудительный сброс currentTime видео в старом цикле синхронизации (чтобы декодер не лочился на 15 FPS)
    var origSyncV131 = window.syncVideoRamEngineV131;
    window.syncVideoRamEngineV131 = function() {
        var vEl = getVideoElV170();
        if (vEl && Math.abs(vEl.playbackRate - window._jennyVideoSpeedV170) > 0.01) {
            try { vEl.playbackRate = window._jennyVideoSpeedV170; } catch (e) {}
        }
        // Не позволяем старому циклу дергать vEl.currentTime каждый кадр
        if (window.videoDeckV131) {
            window.videoDeckV131.speed = window._jennyVideoSpeedV170;
        }
    };

    // 3. Перехват радиальной дуги скорости («штуки внизу») для управления Декой Б (Видео)
    var origStartScrub = window.startScrub;
    window.startScrub = function(side, speed) {
        if (isVideoDeckActiveV170()) {
            window.setVideoDeckSpeedV170(speed, false);
            return;
        }
        if (typeof origStartScrub === 'function') {
            return origStartScrub.apply(this, arguments);
        }
    };

    var origStopScrub = window.stopScrub;
    window.stopScrub = function() {
        if (isVideoDeckActiveV170()) {
            // При отпускании дуги оставляем выбранную скорость для видеодеки
            var vEl = getVideoElV170();
            if (vEl) {
                try { vEl.playbackRate = window._jennyVideoSpeedV170; } catch (e) {}
            }
            return;
        }
        if (typeof origStopScrub === 'function') {
            return origStopScrub.apply(this, arguments);
        }
    };

    // Долгое нажатие по центру нижней шкалы в режиме Видео сбрасывает скорость видео на 1.0x,
    // а короткий тап/свайп по нижней шкале перематывает само Видео!
    function bindBottomBarToVideoDeckV170() {
        var npEl = document.getElementById('nowPlaying');
        var barContainer = npEl ? npEl.parentElement : null;
        if (!barContainer || barContainer._v170Bound) return;
        barContainer._v170Bound = true;

        var touchStartX = 0;
        var touchStartTime = 0;

        barContainer.addEventListener('touchstart', function(ev) {
            if (!isVideoDeckActiveV170()) return;
            if (ev.touches && ev.touches.length > 0) {
                touchStartX = ev.touches[0].clientX;
                touchStartTime = performance.now();
            }
        }, { passive: true });

        barContainer.addEventListener('touchend', function(ev) {
            if (!isVideoDeckActiveV170()) return;
            var vEl = getVideoElV170();
            if (!vEl || !isFinite(vEl.duration) || vEl.duration <= 0) return;

            var dt = performance.now() - touchStartTime;
            var endX = (ev.changedTouches && ev.changedTouches.length > 0) ? ev.changedTouches[0].clientX : touchStartX;
            var dx = Math.abs(endX - touchStartX);

            // Короткий тап (< 200 мс) по нижней шкале — перемотка видео в точку нажатия
            if (dt < 200 && dx < 15) {
                var rect = barContainer.getBoundingClientRect();
                if (rect.width > 10) {
                    var ratio = Math.max(0.0, Math.min(1.0, (endX - rect.left) / rect.width));
                    vEl.currentTime = ratio * vEl.duration;
                    // Синхронизируем отвязанную аудиодорожку с новой позицией видео
                    var aEl = document.getElementById('audioPlayer') || window.player;
                    if (aEl && aEl !== vEl && isFinite(aEl.duration) && Math.abs(aEl.duration - vEl.duration) < 5) {
                        try { aEl.currentTime = vEl.currentTime; } catch (e) {}
                    }
                }
            } else if (dt >= 180 && dt < 450 && dx < 15) {
                // Удержание по центру сбрасывает скорость видео на 1.0x
                window.setVideoDeckSpeedV170(1.0, true);
            }
        }, { passive: true });
    }

    // 4. Обновление нижней шкалы прогресса для Деки Б + жесткий контроль playbackRate видео
    setInterval(function() {
        bindBottomBarToVideoDeckV170();
        var vEl = getVideoElV170();
        if (!vEl) return;

        // Держим заданную скорость на видеоэлементе, чтобы ни один внешний скрипт ее не сбил
        if (!vEl.paused && Math.abs(vEl.playbackRate - window._jennyVideoSpeedV170) > 0.01) {
            try { vEl.playbackRate = window._jennyVideoSpeedV170; } catch (e) {}
        }

        // Если активна видеодека — выводим прогресс видео в нижнюю шкалу («штуку внизу»)
        if (isVideoDeckActiveV170() && isFinite(vEl.duration) && vEl.duration > 0) {
            var curEl = document.getElementById('currentTime');
            var remEl = document.getElementById('remainingTime');
            var npEl  = document.getElementById('nowPlaying');
            var fillEl = document.getElementById('progressFill');

            var cur = vEl.currentTime || 0;
            var dur = vEl.duration || 1;
            var ratio = Math.max(0.0, Math.min(1.0, cur / dur));

            if (curEl) curEl.textContent = fmtTimeV170(cur);
            if (remEl) remEl.textContent = "-" + fmtTimeV170(Math.max(0, dur - cur));
            if (fillEl) {
                fillEl.style.transformOrigin = "left center";
                fillEl.style.transform = "scaleX(" + ratio.toFixed(4) + ")";
                fillEl.style.width = "100%";
            }
            if (npEl) {
                var rawTitle = (window.videoDeckV131 && window.videoDeckV131.title) ||
                               (vEl.getAttribute('data-title')) ||
                               (vEl.src ? decodeURIComponent(vEl.src.split('/').pop()) : 'Видео Дека Б');
                var shortTitle = rawTitle.length > 26 ? rawTitle.substring(0, 26) + '…' : rawTitle;
                npEl.textContent = "🎬 ДЕКА Б: " + shortTitle + "  x" + window._jennyVideoSpeedV170;
            }
        }
    }, 80);

    // 5. Честный захват кадров строго по декодеру (requestVideoFrameCallback) для 120Hz шейдера
    // Это гарантирует, что prevTex и currTex ВСЕГДА содержат два разных соседних кадра,
    // а левая (ОРИГ) и правая (120Hz LK) половины идут синхронно и без разрыва геометрии
    function attachExactFrameTrackerV170() {
        var vEl = getVideoElV170();
        if (!vEl || vEl._v170FrameTrackerAttached) return;
        vEl._v170FrameTrackerAttached = true;
        window._v170NewDecodedFrameReady = true;

        if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
            var onDecodedFrame = function(now, metadata) {
                var prevStamp = window._v170LastFrameStamp || now;
                var delta = now - prevStamp;
                if (delta > 8 && delta < 500) {
                    window._v170SourceFrameInterval = delta;
                }
                window._v170LastFrameStamp = now;
                window._v170NewDecodedFrameReady = true;
                vEl.requestVideoFrameCallback(onDecodedFrame);
            };
            vEl.requestVideoFrameCallback(onDecodedFrame);
        }
    }

    // Вычисляем точный фазовый коэффициент alpha (0.0 .. 1.0) между двумя декодированными кадрами
    window.getExactInterpAlphaV170 = function() {
        attachExactFrameTrackerV170();
        var elapsed = performance.now() - (window._v170LastFrameStamp || performance.now());
        var interval = window._v170SourceFrameInterval || (33.33 / (window._jennyVideoSpeedV170 || 1.0));
        return Math.max(0.0, Math.min(1.0, elapsed / Math.max(8.0, interval)));
    };
})();
"""

def patch_files():
    files = find_target_files()
    if not files:
        print("Не найдены файлы ui_v71.js или index.html в", BASE_DIR)
        return

    for path in files:
        if not path.endswith("ui_v71.js"):
            continue
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        # Убираем старый V170 блок при повторном запуске
        marker = "/* ================= JENNY V170:"
        if marker in content:
            content = content.split(marker)[0].rstrip()

        # 1. В шейдере сплита выравниваем фазу ОРИГ и 120Hz LK и зажимаем UV-координаты в [0.001, 0.999],
        # чтобы исключить дублирование/плитку на краях экрана при больших векторах движения
        content = content.replace(
            "vec2 uv1 = v_uv - flow * u_alpha;",
            "vec2 uv1 = clamp(v_uv - flow * u_alpha, vec2(0.001), vec2(0.999));"
        ).replace(
            "vec2 uv2 = v_uv + flow * (1.0 - u_alpha);",
            "vec2 uv2 = clamp(v_uv + flow * (1.0 - u_alpha), vec2(0.001), vec2(0.999));"
        )

        # 2. В цикле WebGL обновляем текстуры prevTex/currTex только когда декодер реально выдал новый кадр
        content = content.replace(
            "if (vEl.currentTime !== lastVideoTime)",
            "if (window._v170NewDecodedFrameReady || Math.abs(vEl.currentTime - lastVideoTime) >= (0.028 / (window._jennyVideoSpeedV170 || 1.0)))"
        )

        content = content + "\n\n" + V170_PAYLOAD + "\n"
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print("Успешно обновлен:", path)

if __name__ == "__main__":
    patch_files()

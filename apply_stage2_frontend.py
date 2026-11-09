#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os, re

_orig_sub = re.sub
re.sub = lambda pat, repl, string, *a, **kw: _orig_sub(pat, (repl if callable(repl) else (lambda _: repl)), string, *a, **kw)

BASE_DIR = "/storage/emulated/0/scripts/JennyPlayer"
if not os.path.exists(BASE_DIR):
    BASE_DIR = os.getcwd()

# 1. Точечное исправление автоскрытия HUD (Плеер + PiP) внутри существующего блока V209
NEW_AUTOHIDE_V209 = r"""    // 4. ТАЙМЕР АВТОСКРЫТИЯ УПРАВЛЕНИЯ С ТОЧНОСТЬЮ 0.1 СЕК (ОСНОВНОЙ ПЛЕЕР + РЕЖИМ PiP)
    window.wakeVideoHudV130 = function(fromTapWake) {
        var hud = document.getElementById('v130HudOverlay');
        var st = window._vidStateV130;
        if (!hud || !st) return;
        if (fromTapWake && hud.classList.contains('hud-hidden-v130')) {
            st.hudJustWokeUntil = performance.now() + 380;
        }
        hud.classList.remove('hud-hidden-v130');
        clearTimeout(st.controlsHideTimer);

        var root = document.getElementById('jennyVideoStudioRootV130');
        var isMini = Boolean(st.pipMode || st.desktopOverlay || (root && root.classList.contains('mode-pip-v130')));
        var fl = window._jennyLabFlagsV208 || {};
        var enabled = isMini ? Boolean(fl.stub2) : Boolean(fl.stub1);
        if (!enabled) return;

        var sec = isMini
            ? (window._jennyAutoHideSecV209 && window._jennyAutoHideSecV209.pip  ? window._jennyAutoHideSecV209.pip  : 2.0)
            : (window._jennyAutoHideSecV209 && window._jennyAutoHideSecV209.main ? window._jennyAutoHideSecV209.main : 3.0);
        var delayMs = Math.max(500, Math.round(sec * 1000));

        var vid = document.getElementById('jennyVideoElV130');
        var isPlaying = Boolean(window._vidPlayIntentV132 || (vid && !vid.paused) || (window.videoDeckV131 && window.videoDeckV131.isReversed));
        if (isPlaying) {
            st.controlsHideTimer = setTimeout(function() {
                hud.classList.add('hud-hidden-v130');
            }, delayMs);
        }
    };

    window.wakeVideoHudControlsV209 = function() {
        window.wakeVideoHudV130(false);
    };

    function checkAutoHideTickV209() {
        var hud = document.getElementById('v130HudOverlay');
        var st = window._vidStateV130;
        if (!hud || !st || !st.active) return;
        var hudHidden = hud.classList.contains('hud-hidden-v130');
        var isMini = Boolean(st.pipMode || st.desktopOverlay);
        var ids = ['jennyFenceWrapV173', 'jennyTunerFloatWrapV208', 'jennySplitPillWrapV209', 'jenny120PillWrapV209'];
        for (var i = 0; i < ids.length; i++) {
            var el = document.getElementById(ids[i]);
            if (!el) continue;
            var keepOpen = (!isMini && ((ids[i] === 'jennyFenceWrapV173' && !isLogCollapsed) || (ids[i] === 'jennyTunerFloatWrapV208' && !isTunerCollapsed)));
            if (hudHidden && !keepOpen) {
                el.style.opacity = '0';
                el.style.pointerEvents = 'none';
                el.classList.add('jv209-hud-hidden-item');
            } else if (el.classList.contains('jv209-hud-hidden-item')) {
                el.style.opacity = '';
                el.style.pointerEvents = 'auto';
                el.classList.remove('jv209-hud-hidden-item');
            }
        }
    }"""

DECK_B_TRANSPORT_HOOK = r"""
    // Привязка кнопок нижней панели (#playPauseBtn, #btnPrev, #btnNext, реверс) к Деке Б
    (function bindMainTransportToDeckBV210() {
        var isDeckB = function() {
            return Boolean(window._activeUiDeckV131 === 'video' && window._vidStateV130 && window._vidStateV130.active);
        };
        var oPlay = window.togglePlay;
        if (typeof oPlay === 'function' && !oPlay._v210B) {
            window.togglePlay = function() {
                if (isDeckB() && window.toggleVideoPlayPauseV130) { window.toggleVideoPlayPauseV130(); return; }
                return oPlay.apply(this, arguments);
            };
            window.togglePlay._v210B = true;
        }
        var oPrev = window.playPreviousTrack;
        if (typeof oPrev === 'function' && !oPrev._v210B) {
            window.playPreviousTrack = function() {
                if (isDeckB() && window.seekVideoRelativeV130) { window.seekVideoRelativeV130(-10); return; }
                return oPrev.apply(this, arguments);
            };
            window.playPreviousTrack._v210B = true;
        }
        var oNext = window.playNextTrack;
        if (typeof oNext === 'function' && !oNext._v210B) {
            window.playNextTrack = function() {
                if (isDeckB() && window.seekVideoRelativeV130) { window.seekVideoRelativeV130(10); return; }
                return oNext.apply(this, arguments);
            };
            window.playNextTrack._v210B = true;
        }
        var oRev = window.toggleReverseMode;
        if (typeof oRev === 'function' && !oRev._v210B) {
            window.toggleReverseMode = function(wantRev) {
                if (isDeckB() && window.videoDeckV131) {
                    if (Boolean(wantRev) !== Boolean(window.videoDeckV131.isReversed) && window.toggleVideoReverseV131) window.toggleVideoReverseV131();
                    return;
                }
                return oRev.apply(this, arguments);
            };
            window.toggleReverseMode._v210B = true;
        }
    })();
"""

for upath in [os.path.join(BASE_DIR, "ui_v71.js"), os.path.join(BASE_DIR, "app", "src", "main", "python", "ui_v71.js")]:
    if not os.path.isfile(upath):
        continue
    ucode = open(upath, "r", encoding="utf-8", errors="ignore").read()

    # А. Сохранение конфига музыки при переключении на Деку Б
    ucode = ucode.replace(
        "if (window._activeUiDeckV131 === 'music') window._musicConfigRefV131 = window.appConfig;",
        "if (window.appConfig && window.videoDeckV131 && window.appConfig !== window.videoDeckV131.config) window._musicConfigRefV131 = window.appConfig;"
    )

    # Б. Отключение торрент-режима для полностью скачанных фильмов
    ucode = ucode.replace(
        "const importedName = (jSt && jSt.xflac_file) || (dFile && dFile.xflac_file);\nif (importedName) {\neffectiveUrl = '/api/media/' + encodeURIComponent(importedName);\n}",
        "const isDone100 = Boolean((dFile && dFile.percent >= 100) || (jSt && jSt.percent >= 100) || (dTor && dTor.percent >= 100));\nconst importedName = (jSt && jSt.xflac_file) || (dFile && (dFile.xflac_file || (isDone100 && (dFile.path || dFile.name || '').split('/').pop()))) || (isDone100 ? (titleStr || '').split('/').pop() : '');\nif (importedName) {\neffectiveUrl = '/api/media/' + encodeURIComponent(importedName);\nopts.torHash = '';\nopts.torFileIdx = -1;\n}"
    )

    # В. Автопереключение на Деку Б при старте видео и обратно на Деку А при закрытии
    ucode = ucode.replace(
        "st.active = true;\nst.userPaused = false;",
        "st.active = true;\nst.userPaused = false;\nwindow.videoDeckV131.title = titleStr || 'Видео';\nif (typeof window.switchActiveUiDeckV131 === 'function') window.switchActiveUiDeckV131('video');"
    )
    ucode = ucode.replace(
        "st.active = false; st.rotated90 = false; vd.ramDecodeSession++;",
        "st.active = false; st.rotated90 = false; vd.ramDecodeSession++;\nif (typeof window.switchActiveUiDeckV131 === 'function') window.switchActiveUiDeckV131('music');"
    )

    # Г. Для .mkv при ошибке аудиокодека включаем быстрый ремукс звука (-c:v copy), а не перекодировку видео
    ucode = ucode.replace(
        "vid.addEventListener('error', () => {\nif (window._vidStateV130.active && !window._vidStateV130.usingRemux) {\nwindow.switchVideoToFfmpegRemuxV130(null, true);\n}\n});",
        "vid.addEventListener('error', () => {\nif (window._vidStateV130.active && !window._vidStateV130.usingRemux) {\nwindow.switchVideoToFfmpegRemuxV130(null, /\\.avi$/i.test(window._vidStateV130.currentTitle || ''));\n}\n});"
    )

    # Д. Возвращаем вызов origSyncV131 в блоке V170 и обновляем #durationTime + #playPauseBtn для Деки Б
    ucode = ucode.replace(
        "        if (window.videoDeckV131) {\n            window.videoDeckV131.speed = window._jennyVideoSpeedV170;\n        }\n    };",
        "        if (window.videoDeckV131) {\n            window.videoDeckV131.speed = window._jennyVideoSpeedV170;\n        }\n        if (typeof origSyncV131 === 'function') return origSyncV131.apply(this, arguments);\n    };" + DECK_B_TRANSPORT_HOOK
    )
    ucode = ucode.replace(
        "            var cur = vEl.currentTime || 0;\n            var dur = vEl.duration || 1;",
        "            var cur = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vEl) : (vEl.currentTime || 0);\n            var dur = (window.getEffectiveVideoDurationV167 ? window.getEffectiveVideoDurationV167(vEl) : vEl.duration) || 1;\n            var durTopEl = document.getElementById('durationTime');\n            if (durTopEl) durTopEl.textContent = fmtTimeV170(cur) + ' / ' + fmtTimeV170(dur);\n            var ppBtn = document.getElementById('playPauseBtn');\n            if (ppBtn) ppBtn.innerHTML = (!vEl.paused || (window.videoDeckV131 && window.videoDeckV131.isReversed)) ? '<svg viewBox=\"0 0 24 24\" width=\"28\" height=\"28\" fill=\"currentColor\"><path d=\"M6 19h4V5H6v14zm8-14v14h4V5h-4z\"/></svg>' : '<svg viewBox=\"0 0 24 24\" width=\"28\" height=\"28\" fill=\"currentColor\"><path d=\"M8 5v14l11-7z\"/></svg>';"
    )
    ucode = ucode.replace(
        "vEl.currentTime = ratio * vEl.duration;",
        "if (window.seekVideoToExactSecondV167) window.seekVideoToExactSecondV167(ratio * (window.getEffectiveVideoDurationV167 ? window.getEffectiveVideoDurationV167(vEl) : vEl.duration)); else vEl.currentTime = ratio * vEl.duration;"
    )

    # Е. Заменяем старый блок автоскрытия V209 (искавший несуществующий jennyVideoOverlayV130) на рабочий NEW_AUTOHIDE_V209
    ucode = re.sub(
        r"    // ==============================================================================\n    // 4\. ТАЙМЕР АВТОСКРЫТИЯ УПРАВЛЕНИЯ.*?function loopFence\(\)",
        NEW_AUTOHIDE_V209 + "\n\n    function loopFence()",
        ucode,
        count=1,
        flags=re.DOTALL
    )

    # Ж. Убираем ограничение stage.clientWidth < 210, чтобы таблетки не пропадали в маленьком мини-плеере, когда HUD открыт
    ucode = ucode.replace(" || (stage.clientWidth > 0 && stage.clientWidth < 210)", "")

    open(upath, "w", encoding="utf-8").write(ucode)
    print(f"[Этап 2] Обновлён ui_v71.js: {upath}")

# 2. В ui_touch_arc.js: тап и удержание по центру нижней шкалы работают и для Деки Б
for tpath in [os.path.join(BASE_DIR, "ui_touch_arc.js"), os.path.join(BASE_DIR, "app", "src", "main", "python", "ui_touch_arc.js")]:
    if not os.path.isfile(tpath):
        continue
    tcode = open(tpath, "r", encoding="utf-8", errors="ignore").read()
    tcode = tcode.replace(
        "        const player = document.getElementById('audioPlayer');\n        if (player && isFinite(player.duration) && player.duration > 0) {",
        "        if (window._activeUiDeckV131 === 'video' && window._vidStateV130 && window._vidStateV130.active) {\n            const vid = document.getElementById('jennyVideoElV130');\n            const dur = window.getEffectiveVideoDurationV167 ? window.getEffectiveVideoDurationV167(vid) : (vid ? vid.duration : 0);\n            if (dur > 0 && window.seekVideoToExactSecondV167) window.seekVideoToExactSecondV167(perc * dur);\n            return;\n        }\n        const player = document.getElementById('audioPlayer');\n        if (player && isFinite(player.duration) && player.duration > 0) {"
    )
    open(tpath, "w", encoding="utf-8").write(tcode)
    print(f"[Этап 2] Обновлён ui_touch_arc.js: {tpath}")

print("✅ Этап 2 полностью применён! Можно отправлять на сборку.")

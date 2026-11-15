/* ============================================================================
 * ui_deck_a_guard.js — Дека А: защита паузы (V370)
 * Вынесено из ui_v71.js без изменения кода (см. REFACTOR_PLAN.md). Порядок блоков — исходный.
 * ============================================================================ */


/* [split] V370: кусок исходного IIFE (ui_v71.js, строки 37843–38397) → ui_deck_a_guard.js */
;(function() {
    if (window._jennyV370DeckAFullTrackPatchInstalled__deck_a_guard) return;
    window._jennyV370DeckAFullTrackPatchInstalled__deck_a_guard = true;
    window._jennyV370DeckAFullTrackPatchInstalled = true;
    /* [split] копии локальных помощников этого патча (без собственного состояния) */
    var PLAY_ICON_SVG_V370 = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    var PAUSE_ICON_SVG_V370 = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';

    // -------------------------------------------------------------------------
    // 1. ТОЧНЫЙ ДЕТЕКТОР ИГРАЮЩЕЙ ДЕКИ А И НЕПРЕРЫВНЫЕ ЧАСЫ WEBAUDIO (#370)
    //    - Исправляет ошибку, при которой после остановки studioSourceNode переменная
    //      window.studioSourceNode оставалась не-null, из-за чего иконка паузы (⏸)
    //      зависала на кнопке #playPauseBtn и в строке песни, блокируя повторный запуск!
    //    - Сохраняет точную секунду трека при паузе (lastKnownSec), чтобы шкала
    //      никогда не прыгала с 0:29 обратно в 0:00 (-4:57).
    // -------------------------------------------------------------------------
    window.isDeckAActuallyPlayingV232 = function() {
        var player = document.getElementById('audioPlayer');
        var htmlPlaying = Boolean(player && !player.paused && !player.ended && player.src && (!window.htmlGain || !window.htmlGain.gain || window.htmlGain.gain.value > 0.001));
        var ramPlaying = Boolean(window.isStudioPlaying && window.studioSourceNode);
        return Boolean((htmlPlaying || ramPlaying) && !window._userPausedV75_2);
    };

    // -------------------------------------------------------------------------
    // 2. ЗАЩИТА АКТИВНОГО WEBAUDIO RAM-ДВИЖКА ДЕКИ А ОТ ЛОЖНОГО СОБЫТИЯ player.onpause
    //    НА ~28–30 СЕКУНДЕ (КОГДА <audio id="audioPlayer"> ЗАКРЫВАЕТ СВОЙ СОКЕТ ИЛИ ТАЙМАУТИТ,
    //    ПОКА ЗВУК УЖЕ ИГРАЕТ ИЗ ОЗУ ЧЕРЕЗ window.studioSourceNode!)
    // -------------------------------------------------------------------------
    function installDeckAAudioPlayerPauseShieldV370() {
        var player = document.getElementById('audioPlayer');
        if (!player || player._v370PauseShieldInstalled) return;
        player._v370PauseShieldInstalled = true;

        // Перехватываем событие pause на стадии capture ДО обработчиков engine_audio.js:539 и ui_playback.js:512!
        player.addEventListener('pause', function(ev) {
            // Если сейчас активно играет WebAudio RAM-буфер (window.studioSourceNode) и пользователь НЕ нажимал паузу:
            // это фоновый останов/таймаут беззвучного <audio> элемента (htmlGain = 0).
            // НИКОГДА не глушим inputMixer и НЕ останавливаем studioSourceNode!
            if (window.isStudioPlaying && window.studioSourceNode && !window._userPausedV75_2 && !player.ended) {
                if (ev && typeof ev.stopImmediatePropagation === 'function') {
                    ev.stopImmediatePropagation();
                }
                if (window.audioCtx && window.inputMixer && window.inputMixer.gain) {
                    try {
                        var now = window.audioCtx.currentTime;
                        window.inputMixer.gain.cancelScheduledValues(now);
                        window.inputMixer.gain.setValueAtTime(1.0, now);
                        window.inputMixer.gain.value = 1.0;
                    } catch (e) {}
                }
                if (typeof window.updateTrackListPlayIcons === 'function') {
                    window.updateTrackListPlayIcons();
                }
                return;
            }
        }, true);

        // Также переопределяем player.onpause (из ui_playback.js:512), чтобы он:
        // 1) Никогда не убивал живой studioSourceNode, если _userPausedV75_2 === false
        // 2) При реальной паузе обнулял studioSourceNode = null и очищал _activeBufferSourcesV71
        player.onpause = function() {
            if (window.isStudioPlaying && window.studioSourceNode && !window._userPausedV75_2 && !player.ended) {
                if (window.audioCtx && window.inputMixer && window.inputMixer.gain) {
                    try {
                        var now = window.audioCtx.currentTime;
                        window.inputMixer.gain.cancelScheduledValues(now);
                        window.inputMixer.gain.setValueAtTime(1.0, now);
                        window.inputMixer.gain.value = 1.0;
                    } catch (e) {}
                }
                if (typeof window.updateTrackListPlayIcons === 'function') {
                    window.updateTrackListPlayIcons();
                }
                return;
            }

            if (window._studioClockV74_1 && window.audioCtx) {
                var clk = window._studioClockV74_1;
                if (clk.active) {
                    var spd = clk.speed || 1.0;
                    var curEst = clk.startTrackSec + Math.max(0, window.audioCtx.currentTime - clk.startCtxTime) * spd;
                    clk.lastKnownSec = Math.max(0, curEst);
                    clk.startTrackSec = clk.lastKnownSec;
                    clk.active = false;
                }
            }

            if (window.studioSourceNode) {
                try { window.studioSourceNode.onended = null; } catch (e) {}
                try { window.studioSourceNode.stop(0); } catch (e) {}
                try { window.studioSourceNode.disconnect(); } catch (e) {}
                window.studioSourceNode = null;
            }
            if (window._activeBufferSourcesV71 && typeof window._activeBufferSourcesV71.forEach === 'function') {
                window._activeBufferSourcesV71.forEach(function(n) {
                    if (!n) return;
                    try { n.onended = null; n.stop(0); n.disconnect(); } catch (e) {}
                });
                window._activeBufferSourcesV71.clear();
            }
            window.isStudioPlaying = false;

            var btn = document.getElementById('playPauseBtn');
            if (btn) btn.innerHTML = PLAY_ICON_SVG_V370;
            if ('mediaSession' in navigator) {
                try { navigator.mediaSession.playbackState = 'paused'; } catch (e) {}
            }
            if (typeof window.updateTrackListPlayIcons === 'function') {
                window.updateTrackListPlayIcons();
            }
        };

        // Защищаем player.onplay (из ui_playback.js:488), чтобы поздний старт <audio> не сбивал уже играющий studioSourceNode!
        player.onplay = function() {
            var btn = document.getElementById('playPauseBtn');
            if (btn) btn.innerHTML = PAUSE_ICON_SVG_V370;
            if ('mediaSession' in navigator) {
                try { navigator.mediaSession.playbackState = 'playing'; } catch (e) {}
            }
            if (window.audioCtx && window.inputMixer && window.inputMixer.gain) {
                try {
                    var now = window.audioCtx.currentTime;
                    window.inputMixer.gain.cancelScheduledValues(now);
                    window.inputMixer.gain.setValueAtTime(1.0, now);
                    window.inputMixer.gain.value = 1.0;
                } catch (e) {}
            }
            var targetSpd = typeof window.getTargetPlaybackSpeed === 'function' ? window.getTargetPlaybackSpeed() : 1.0;
            if (Math.abs(player.playbackRate - targetSpd) > 0.001 && player.playbackRate !== 10.0) {
                try { player.playbackRate = targetSpd; } catch (e) {}
            }
            if (window.isStudioPlaying && window.studioSourceNode) {
                if (window.htmlGain && window.htmlGain.gain) window.htmlGain.gain.value = 0.0;
                if (typeof window.updateTrackListPlayIcons === 'function') window.updateTrackListPlayIcons();
                return;
            }
            if (window.studioBuffer && typeof window.syncMasterPlaybackEngineV59 === 'function') {
                window.syncMasterPlaybackEngineV59(false);
            }
            if (typeof window.updateTrackListPlayIcons === 'function') window.updateTrackListPlayIcons();
        };
    }
    installDeckAAudioPlayerPauseShieldV370();
    setTimeout(installDeckAAudioPlayerPauseShieldV370, 150);
    setTimeout(installDeckAAudioPlayerPauseShieldV370, 600);
})();

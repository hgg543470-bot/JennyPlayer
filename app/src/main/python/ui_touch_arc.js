// =========================================================================
// 🎛️ UI_TOUCH_ARC.JS (ВИЗУАЛЬНАЯ ДУГА И ОБРАБОТКА СВАЙПОВ)
// =========================================================================

window.setupSeekZone = function() {
    const zone = document.getElementById('seekZone');
    const arcContainer = document.getElementById('speedArcContainer');
    const overlay = document.getElementById('scrubOverlay');
    if (!zone || !arcContainer || !overlay) return;

    let debugCanvas = document.getElementById('debugZoneCanvas');
    if (!debugCanvas) {
        debugCanvas = document.createElement('canvas');
        debugCanvas.id = 'debugZoneCanvas';
        debugCanvas.style.position = 'absolute';
        debugCanvas.style.top = '0';
        debugCanvas.style.left = '0';
        debugCanvas.style.pointerEvents = 'none'; 
        debugCanvas.style.width = '100%';
        debugCanvas.style.height = '100%';
        debugCanvas.style.zIndex = '5998'; 
        overlay.appendChild(debugCanvas);
    }

    let startY = 0;
    let isPullingDown = false;
    let isScrubbing = false;
    let isSeekingAllowed = true; 
    let scrubSide = null;
    let currentTempSpeed = null;
    let arcItems = [];
    let circleAngles = []; 
    let currentAnchor = {x: 0, y: 0};
    let pressTimer = null;

    function getX(e) {
        if (e.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0].clientX;
        if (e.touches && e.touches.length > 0) return e.touches[0].clientX;
        return e.clientX;
    }
    function getY(e) {
        if (e.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0].clientY;
        if (e.touches && e.touches.length > 0) return e.touches[0].clientY;
        return e.clientY;
    }

    function handleTapSeek(x) {
        if (x === undefined || isNaN(x)) return;
        const rect = zone.getBoundingClientRect();
        let perc = (x - rect.left) / rect.width;
        perc = Math.max(0, Math.min(1, perc));
        const player = document.getElementById('audioPlayer');
        if (player && isFinite(player.duration) && player.duration > 0) {
            let isVisualReverse = window.isReversed || window.scrubState.isPhysicallyReversed;
            if (isVisualReverse) perc = 1.0 - perc; 
            
            player.currentTime = perc * player.duration;
            
            if (typeof window.syncMasterPlaybackEngineV59 === 'function') {
                window.syncMasterPlaybackEngineV59(false);
            }
        }
    }

    function angleDiffSigned(a, b) {
        return ((a - b) % 360 + 540) % 360 - 180;
    }

    function drawDebugWheel(anchorX, anchorY, angles) {
        debugCanvas.width = window.innerWidth;
        debugCanvas.height = window.innerHeight;
        let ctx = debugCanvas.getContext('2d');
        ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);

        // Стильное неоновое ядро в опорной точке
        let coreGrad = ctx.createRadialGradient(anchorX, anchorY, 2, anchorX, anchorY, 24);
        coreGrad.addColorStop(0, 'rgba(227, 179, 65, 0.95)');
        coreGrad.addColorStop(0.5, 'rgba(163, 113, 247, 0.45)');
        coreGrad.addColorStop(1, 'rgba(115, 65, 190, 0)');
        ctx.beginPath();
        ctx.arc(anchorX, anchorY, 24, 0, 2 * Math.PI);
        ctx.fillStyle = coreGrad;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(anchorX, anchorY, 6, 0, 2 * Math.PI);
        ctx.fillStyle = '#e3b341';
        ctx.fill();

        let radius = Math.max(window.innerWidth, window.innerHeight) * 0.95;
        ctx.lineWidth = 1.6;
        ctx.setLineDash([7, 8]);

        for (let i = 0; i < angles.length - 1; i++) {
            let delta = angleDiffSigned(angles[i + 1], angles[i]);
            let midAngle = angles[i] + delta / 2;
            let rad = midAngle * Math.PI / 180;

            let endX = anchorX + radius * Math.cos(rad);
            let endY = anchorY + radius * Math.sin(rad);

            let lineGrad = ctx.createLinearGradient(anchorX, anchorY, endX, endY);
            lineGrad.addColorStop(0, 'rgba(227, 179, 65, 0.65)');
            lineGrad.addColorStop(0.55, 'rgba(163, 113, 247, 0.35)');
            lineGrad.addColorStop(1, 'rgba(88, 166, 255, 0.0)');

            ctx.strokeStyle = lineGrad;
            ctx.beginPath();
            ctx.moveTo(anchorX, anchorY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
        ctx.setLineDash([]);
    }

    function generateArc() {
        arcContainer.innerHTML = '';
        arcItems = [];
        circleAngles = [];

        let activeZones = [];
        for (let i = 1; i <= 6; i++) {
            let en = document.getElementById('cfg_z' + i + '_en');
            let val = document.getElementById('cfg_z' + i + '_val');
            if (en && en.checked && val) {
                activeZones.push(parseFloat(val.value) || 1.0);
            }
        }
        if (activeZones.length === 0) activeZones = [1.0];

        let isLeftHanded = Boolean(window.appConfig && window.appConfig.leftHandedMode);
        const W = window.innerWidth;
        const H = window.innerHeight;

        const eqBtn = document.getElementById('btn-eqModal');
        if (eqBtn) {
            const eqRect = eqBtn.getBoundingClientRect();
            currentAnchor.x = eqRect.left + eqRect.width / 2;
            currentAnchor.y = eqRect.top + eqRect.height / 2;
        } else {
            currentAnchor.y = H - 135;
            currentAnchor.x = isLeftHanded ? 31 : (W - 31);
        }

        // Строим плавную дугу вокруг опорной точки (от середины экрана через край вниз к доку)
        // и параметризуем её по длине дуги, чтобы расстояние между кружками было идеально равным!
        const startDeg = -108; // Верхний кружок (ниже поиска, правее центра)
        const endDeg   = -204; // Нижний кружок (внизу у панели навигации)
        const rTop     = Math.min(W * 0.76, H * 0.35);
        const rMid     = Math.min(W * 0.78, H * 0.36);
        const rBot     = Math.min(W * 0.58, H * 0.26);

        function sampleCurvePoint(u) {
            const deg = startDeg + u * (endDeg - startDeg);
            const rad = deg * Math.PI / 180;
            // Плавный профиль радиуса: широкий изгиб посередине и аккуратный заход вниз
            const r = (1 - u) * (1 - u) * rTop + 2 * (1 - u) * u * rMid + u * u * rBot;
            const dxRH = r * Math.cos(rad);
            const dy = r * Math.sin(rad);
            const x = currentAnchor.x + (isLeftHanded ? -dxRH : dxRH);
            const y = currentAnchor.y + dy;
            return {
                x: Math.max(30, Math.min(W - 30, x)),
                y: Math.max(150, Math.min(H - 32, y))
            };
        }

        const STEPS = 240;
        const samples = [];
        let totalLen = 0;
        for (let k = 0; k <= STEPS; k++) {
            const pt = sampleCurvePoint(k / STEPS);
            if (k > 0) {
                totalLen += Math.hypot(pt.x - samples[k - 1].x, pt.y - samples[k - 1].y);
            }
            samples.push({ x: pt.x, y: pt.y, s: totalLen });
        }

        const count = activeZones.length;
        const positions = [];
        for (let i = 0; i < count; i++) {
            const targetS = count === 1 ? (totalLen * 0.5) : (totalLen * (i / (count - 1)));
            let best = samples[0];
            for (let k = 0; k < samples.length; k++) {
                if (samples[k].s >= targetS) {
                    best = samples[k];
                    break;
                }
            }
            positions.push(best);
        }

        activeZones.forEach((val, index) => {
            if (index >= positions.length) return;

            let el = document.createElement('div');
            el.className = 'arc-item';
            el.innerText = 'x' + (val % 1 === 0 ? val.toFixed(1) : val.toString());
            el.dataset.val = val;

            el.style.left = `${positions[index].x - 24}px`;
            el.style.top = `${positions[index].y - 24}px`;

            let angle = Math.atan2(positions[index].y - currentAnchor.y, positions[index].x - currentAnchor.x) * 180 / Math.PI;
            circleAngles.push(angle);

            arcContainer.appendChild(el);
            arcItems.push(el);
        });

        arcContainer.style.display = 'block';
        setTimeout(() => { arcContainer.style.opacity = '1'; }, 10);

        drawDebugWheel(currentAnchor.x, currentAnchor.y, circleAngles);
    }

    zone.addEventListener('touchstart', (e) => {
        let startX = getX(e);
        startY = getY(e);
        let rect = zone.getBoundingClientRect();
        let perc = (startX - rect.left) / rect.width;

        if (perc < 0.33) scrubSide = 'left';
        else if (perc > 0.66) scrubSide = 'right';
        else scrubSide = 'center';

        isPullingDown = false;
        currentTempSpeed = null;
        isScrubbing = false;
        isSeekingAllowed = true; 

        if (scrubSide === 'center') {
            pressTimer = setTimeout(() => {
                pressTimer = null;
                isSeekingAllowed = false; 
                try { navigator.vibrate(50); } catch(err){}
                
                if (window.isReversed || (window.scrubState && window.scrubState.isPhysicallyReversed)) {
                    if (typeof window.toggleReverseMode === 'function') window.toggleReverseMode(false);
                } else if (window.scrubState.active || window.scrubState.locked) {
                    if (typeof window.stopScrub === 'function') window.stopScrub(false);
                }
                let baseSpd = typeof window.getBaseSpeed === 'function' ? window.getBaseSpeed() : 1.0;
                const player = document.getElementById('audioPlayer');
                if (player) player.playbackRate = baseSpd;
                if (typeof window.syncMasterPlaybackEngineV59 === 'function') window.syncMasterPlaybackEngineV59(false);
                
                // Показываем визуальное подтверждение на 1 секунду
                let lockEl = document.getElementById('speedLockIndicator');
                if (lockEl) {
                    lockEl.style.display = 'block';
                    lockEl.innerText = `✅ Норм: x${baseSpd}`;
                    setTimeout(() => { 
                        if (!window.scrubState.active && !window.scrubState.locked) {
                            lockEl.style.display = 'none'; 
                        }
                    }, 1000);
                }
            }, 160); 
        } else {
            pressTimer = setTimeout(() => {
                pressTimer = null;
                isScrubbing = true;

                if (window.scrubState.locked) {
                    window.scrubState.locked = false;
                    try { navigator.vibrate(50); } catch(err){}
                } else {
                    try { navigator.vibrate(30); } catch(err){}
                }
                
                let defSpeed = parseFloat(window.appConfig.defaultScrubSpeed) || 2.0;
                if (typeof window.startScrub === 'function') window.startScrub(scrubSide, defSpeed);

            }, 250); 
        }

    }, {passive: true});

    function handleTouchMove(e) {
        let curX = getX(e);
        let curY = getY(e);
        let deltaY = curY - startY;

        if (scrubSide === 'center') {
            if (Math.abs(deltaY) > 15 && pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
            return;
        }

        let threshold = window.innerHeight * 0.05; 

        if (Math.abs(deltaY) > threshold || isScrubbing) {
            isSeekingAllowed = false; 
            if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }

            if (!isScrubbing) {
                isScrubbing = true;
                if (window.scrubState.locked) window.scrubState.locked = false;
            }

            if (!isPullingDown) {
                isPullingDown = true;
                overlay.style.display = 'block'; 
                generateArc(); 
                let defSpeed = parseFloat(window.appConfig.defaultScrubSpeed) || 2.0;
                if (typeof window.startScrub === 'function') window.startScrub(scrubSide, defSpeed);
            }
            
            let dx = curX - currentAnchor.x;
            let dy = curY - currentAnchor.y;
            let fingerAngle = Math.atan2(dy, dx) * 180 / Math.PI;

            let minDiff = Infinity;
            let idx = 0;
            
            circleAngles.forEach((ang, i) => {
                let diff = Math.abs(angleDiffSigned(fingerAngle, ang));
                if (diff < minDiff) {
                    minDiff = diff;
                    idx = i;
                }
            });

            if (!arcItems[idx].classList.contains('active')) {
                arcItems.forEach(el => el.classList.remove('active'));
                arcItems[idx].classList.add('active');
                currentTempSpeed = parseFloat(arcItems[idx].dataset.val);
                if (typeof window.startScrub === 'function') window.startScrub(scrubSide, currentTempSpeed);
                try { navigator.vibrate(15); } catch(err){}
            }
        }
    }

    zone.addEventListener('touchmove', handleTouchMove, {passive: true});
    overlay.addEventListener('touchmove', handleTouchMove, {passive: false}); 

    function handleTouchEnd(e) {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
            if (isSeekingAllowed) handleTapSeek(getX(e));
        } else if (isScrubbing) {
            arcContainer.style.opacity = '0';
            setTimeout(() => { arcContainer.style.display = 'none'; }, 150);

            if (isPullingDown) {
                window.scrubState.locked = true;
                if (typeof window.startScrub === 'function') window.startScrub(scrubSide, currentTempSpeed); 
                
                let needsSave = false;
                if (window.appConfig.autoSaveScrub) {
                    window.appConfig.defaultScrubSpeed = currentTempSpeed;
                    let inputEl = document.getElementById('cfg_defaultScrubSpeed');
                    if (inputEl) inputEl.value = currentTempSpeed;
                    needsSave = true;
                }
                if (window.appConfig.autoSaveBase) {
                    window.appConfig.normalPlaybackSpeed = currentTempSpeed;
                    let inputEl = document.getElementById('cfg_normalPlaybackSpeed');
                    if (inputEl) inputEl.value = currentTempSpeed;
                    needsSave = true;
                    
                    let baseCheck = document.getElementById('cfg_xNormalSpeed');
                    if (baseCheck && !baseCheck.checked) {
                        baseCheck.checked = true;
                        window.appConfig.xNormalSpeed = true;
                    }
                }
                if (needsSave) {
                    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
                }
            } else {
                if (!window.scrubState.locked) {
                    if (typeof window.stopScrub === 'function') window.stopScrub();
                }
            }
        }
        
        overlay.style.display = 'none'; 
        isPullingDown = false;
        isScrubbing = false;
        scrubSide = null;
        
        let ctx = debugCanvas.getContext('2d');
        ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
    }

    zone.addEventListener('touchend', handleTouchEnd);
    overlay.addEventListener('touchend', handleTouchEnd);

    function handleTouchCancel() {
        if (pressTimer) clearTimeout(pressTimer);
        arcContainer.style.display = 'none';
        overlay.style.display = 'none';
        if (!window.scrubState.locked) {
            if (typeof window.stopScrub === 'function') window.stopScrub();
        }
        isPullingDown = false;
        isScrubbing = false;
        
        let ctx = debugCanvas.getContext('2d');
        ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
    }

    zone.addEventListener('touchcancel', handleTouchCancel);
    overlay.addEventListener('touchcancel', handleTouchCancel);
};

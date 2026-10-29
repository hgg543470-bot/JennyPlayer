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

    function drawDebugWheel(anchorX, anchorY, angles) {
        debugCanvas.width = window.innerWidth;
        debugCanvas.height = window.innerHeight;
        let ctx = debugCanvas.getContext('2d');
        ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
        
        ctx.beginPath();
        ctx.arc(anchorX, anchorY, 20, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(227, 179, 65, 0.7)';
        ctx.fill();

        let radius = Math.max(window.innerWidth, window.innerHeight);
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        ctx.strokeStyle = 'rgba(227, 179, 65, 0.5)'; 

        for (let i = 0; i < angles.length - 1; i++) {
            let midAngle = (angles[i] + angles[i+1]) / 2;
            let rad = midAngle * Math.PI / 180;
            
            let endX = anchorX + radius * Math.cos(rad);
            let endY = anchorY + radius * Math.sin(rad);
            
            ctx.beginPath();
            ctx.moveTo(anchorX, anchorY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
    }

    function generateArc() {
        arcContainer.innerHTML = '';
        arcItems = [];
        circleAngles = [];
        
        let activeZones = [];
        for(let i=1; i<=6; i++) {
            let en = document.getElementById('cfg_z' + i + '_en');
            let val = document.getElementById('cfg_z' + i + '_val');
            if (en && en.checked && val) {
                activeZones.push(parseFloat(val.value) || 1.0);
            }
        }
        if(activeZones.length === 0) activeZones = [1.0]; 

        let isLeftHanded = window.appConfig.leftHandedMode || false;
        
        const eqBtn = document.getElementById('btn-eqModal');
        if (eqBtn) {
            const eqRect = eqBtn.getBoundingClientRect();
            currentAnchor.x = eqRect.left + eqRect.width / 2;
            currentAnchor.y = eqRect.top + eqRect.height / 2;
        } else {
            currentAnchor.y = window.innerHeight - 135;
            currentAnchor.x = isLeftHanded ? 31 : (window.innerWidth - 31);
        }

        let positionsRH = [
            { x: window.innerWidth * 0.75, y: 35 },  
            { x: window.innerWidth * 0.50, y: 35 },  
            { x: window.innerWidth * 0.25, y: 35 },  
            { x: window.innerWidth * 0.08, y: 90 },  
            { x: window.innerWidth * 0.08, y: 150 }, 
            { x: window.innerWidth * 0.08, y: 220 }  
        ];

        let positionsLH = [
            { x: window.innerWidth * 0.25, y: 35 },
            { x: window.innerWidth * 0.50, y: 35 },
            { x: window.innerWidth * 0.75, y: 35 },
            { x: window.innerWidth * 0.92, y: 90 },
            { x: window.innerWidth * 0.92, y: 150 },
            { x: window.innerWidth * 0.92, y: 220 }
        ];

        let positions = isLeftHanded ? positionsLH : positionsRH;
        
        activeZones.forEach((val, index) => {
            if (index >= positions.length) return; 

            let el = document.createElement('div');
            el.className = 'arc-item';
            el.innerText = 'x' + (val % 1 === 0 ? val.toFixed(1) : val.toString());
            el.dataset.val = val;
            
            el.style.left = `${positions[index].x - 22}px`;
            el.style.top = `${positions[index].y - 22}px`;
            
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
                let diff = Math.abs(fingerAngle - ang);
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

// =========================================================================
// 📜 ENGINE_LOGS.JS (ТЕРМИНАЛ, ОТЛОВ ОШИБОК И ЛОГИКА КОПИРОВАНИЯ)
// =========================================================================

window.addEventListener('error', function(e) { window.remoteLog("🔴 [UI КРАШ]: " + e.message); });
window.addEventListener('unhandledrejection', function(e) { window.remoteLog("🔴 [ПРОМИС КРАШ]: " + (e.reason ? e.reason.message || e.reason : 'Ошибка')); });

window.remoteLog = async function(msg) { 
    try { 
        await fetch('/api/log', { method: 'POST', body: JSON.stringify({msg: msg}) }); 
        const logBox = document.getElementById('logBox');
        if (logBox) {
            const newRow = document.createElement('div');
            newRow.className = 'log-row';
            newRow.setAttribute('data-raw', encodeURIComponent(msg));
            newRow.innerText = msg;
            logBox.appendChild(newRow);
            logBox.scrollTop = logBox.scrollHeight;
        }
    } catch(e) {} 
};

window.isUserTouching = false; 
window.selectedLogs = new Set(); 

document.addEventListener("DOMContentLoaded", () => {
    const logBoxEl = document.getElementById('logBox');
    if(logBoxEl) {
        logBoxEl.addEventListener('touchstart', () => { window.isUserTouching = true; }, {passive: true});
        logBoxEl.addEventListener('touchend', () => { window.isUserTouching = false; });
        
        logBoxEl.addEventListener('click', (e) => {
            const row = e.target.closest('.log-row');
            if (!row) return;
            const rawContent = decodeURIComponent(row.getAttribute('data-raw'));
            if (row.classList.contains('selected')) { 
                row.classList.remove('selected'); 
                window.selectedLogs.delete(rawContent); 
            } else { 
                row.classList.add('selected'); 
                window.selectedLogs.add(rawContent); 
            }
        });

        const copyBtn = document.getElementById('copyBtn');
        const copyMenu = document.getElementById('copyMenu');
        let pressTimer;
        let isLongPress = false; 

        if(copyBtn && copyMenu) {
            copyBtn.addEventListener('touchstart', (e) => {
                isLongPress = false; 
                pressTimer = setTimeout(() => { 
                    isLongPress = true; 
                    if (window.selectedLogs.size > 0) { 
                        copyMenu.style.display = 'flex'; 
                        try { navigator.vibrate(40); } catch(err){} 
                    }
                }, 400); 
            }, {passive: true});
            
            copyBtn.addEventListener('touchend', (e) => { 
                clearTimeout(pressTimer); 
                if (!isLongPress) { 
                    if (window.selectedLogs.size === 0) {
                        copyMenu.style.display = copyMenu.style.display === 'flex' ? 'none' : 'flex';
                    } else {
                        window.copySelectedLogs(); 
                    }
                } 
            });
            
            copyBtn.addEventListener('touchmove', () => clearTimeout(pressTimer), {passive: true});
            copyBtn.addEventListener('click', (e) => e.preventDefault()); 
            
            document.addEventListener('touchstart', (e) => { 
                if (!copyBtn.contains(e.target) && !copyMenu.contains(e.target)) { 
                    copyMenu.style.display = 'none'; 
                } 
            }, {passive: true});

            window.copySelectedLogs = async function() {
                if (window.selectedLogs.size === 0) return;
                const allNodes = Array.from(logBoxEl.querySelectorAll('.log-row'));
                const textToCopy = allNodes
                    .map(node => decodeURIComponent(node.getAttribute('data-raw')))
                    .filter(text => window.selectedLogs.has(text))
                    .join('\n');
                
                try {
                    await navigator.clipboard.writeText(textToCopy);
                    window.selectedLogs.clear();
                    logBoxEl.querySelectorAll('.log-row.selected').forEach(el => el.classList.remove('selected'));
                    const oldHTML = copyBtn.innerHTML; 
                    copyBtn.innerHTML = '✅ ОК'; 
                    setTimeout(() => { copyBtn.innerHTML = oldHTML; }, 500); 
                } catch(e) { window.remoteLog('Ошибка копирования: ' + e); }
            };
        }
    }
});

window.executeCustomCopy = function() {
    const valLast = document.getElementById('inpLast').value;
    const valFirst = document.getElementById('inpFirst').value;
    if (valLast && parseInt(valLast, 10) > 0) { window.copyBulk('last', 'inpLast'); } 
    else if (valFirst && parseInt(valFirst, 10) > 0) { window.copyBulk('first', 'inpFirst'); } 
    else { window.remoteLog('⚠️ Введи количество строк для копирования!'); }
};

window.copyBulk = async function(mode, val) {
    const logBoxEl = document.getElementById('logBox');
    let count = 0;
    if (typeof val === 'string') { count = parseInt(document.getElementById(val).value, 10); if (isNaN(count) || count <= 0) return; } else { count = val; }
    
    const allNodes = Array.from(logBoxEl.querySelectorAll('.log-row'));
    let nodesToCopy = new Set();
    
    allNodes.forEach(node => {
        const raw = decodeURIComponent(node.getAttribute('data-raw'));
        if (window.selectedLogs.has(raw)) nodesToCopy.add(node);
    });
    
    if (mode === 'all') {
        allNodes.forEach(n => nodesToCopy.add(n));
    } else if (mode === 'last') {
        allNodes.slice(-count).forEach(n => nodesToCopy.add(n));
    } else if (mode === 'first') {
        allNodes.slice(0, count).forEach(n => nodesToCopy.add(n));
    }
    
    let resultText = [];
    allNodes.forEach(node => {
        if (nodesToCopy.has(node)) {
            resultText.push(decodeURIComponent(node.getAttribute('data-raw')));
        }
    });
    
    if (resultText.length === 0) return;
    
    try {
        await navigator.clipboard.writeText(resultText.join('\n'));
        document.getElementById('copyMenu').style.display = 'none'; 
        
        window.selectedLogs.clear();
        logBoxEl.querySelectorAll('.log-row.selected').forEach(el => el.classList.remove('selected'));
        if(document.getElementById('inpLast')) document.getElementById('inpLast').value = '';
        if(document.getElementById('inpFirst')) document.getElementById('inpFirst').value = '';
        
        const copyBtn = document.getElementById('copyBtn');
        const oldHTML = copyBtn.innerHTML; 
        copyBtn.innerHTML = '✅ ОК'; 
        setTimeout(() => { copyBtn.innerHTML = oldHTML; }, 500);
    } catch(e) { window.remoteLog('Ошибка: ' + e); }
};

/* ============================================================================
 * ui_folders.js — Менеджер папок (V62)
 * Вынесено из ui_help.js без изменения кода (см. REFACTOR_PLAN.md). Порядок блоков — исходный.
 * ============================================================================ */



// 📂 ПАТЧ V62 (ЭТАП 1): МЕНЕДЖЕР ПАПОК С ГАЛОЧКАМИ И ➕ + ТРАЕКТОРИЯ ГУСЕНИЦЫ СНИЗУ ВВЕРХ В ⚙️

window.getSavedFoldersListV62 = function() {
    window.appConfig = window.appConfig || {};
    if (!Array.isArray(window.appConfig.savedFolders) || window.appConfig.savedFolders.length === 0) {
        window.appConfig.savedFolders = [
            '/storage/emulated/0/Music',
            '/storage/emulated/0/Music/mp3_test',
            '/storage/emulated/0/Download'
        ];
    }
    const cur = (window.lastData && window.lastData.current_folder) ? window.lastData.current_folder.replace(/\/+$/, '') : '/storage/emulated/0/Music';
    const norm = window.appConfig.savedFolders.map(x => String(x).replace(/\/+$/, ''));
    if (cur && !norm.includes(cur)) norm.unshift(cur);
    window.appConfig.savedFolders = norm;
    return norm;
};

window.openFolderManagerModalV62 = function(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    let m = document.getElementById('jennyFolderManagerModal');
    if (m) m.remove();

    const folders = window.getSavedFoldersListV62();
    const curFolder = ((window.lastData && window.lastData.current_folder) ? window.lastData.current_folder : '/storage/emulated/0/Music').replace(/\/+$/, '');

    m = document.createElement('div');
    m.id = 'jennyFolderManagerModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.85);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:15px;box-sizing:border-box;';
    m.onclick = (e) => { if (e.target === m) m.remove(); };

    const rowsHtml = folders.map((p, idx) => {
        const isSel = (p === curFolder);
        const shortName = p.split('/').filter(Boolean).pop() || p;
        return `
            <div onclick="window.selectSavedFolderV62(${idx})" style="display:flex;justify-content:space-between;align-items:center;background:#0d1117;border:1px solid ${isSel ? '#3fb950' : '#262c36'};border-radius:8px;padding:8px 10px;gap:8px;cursor:pointer;">
                <input type="checkbox" ${isSel ? 'checked' : ''} style="pointer-events:none;">
                <div style="min-width:0;flex:1;">
                    <div style="color:${isSel ? '#3fb950' : '#e6edf3'};font-weight:bold;font-size:13px;">📁 ${shortName}</div>
                    <div style="color:#8b949e;font-size:10.5px;word-break:break-all;">${p}</div>
                </div>
                ${folders.length > 1 ? `<button type="button" onclick="event.stopPropagation();window.removeSavedFolderV62(${idx})" style="padding:5px 8px;color:#f85149;border-color:rgba(248,81,73,0.35);">🗑️</button>` : ''}
            </div>
        `;
    }).join('');

    m.innerHTML = `
        <div onclick="event.stopPropagation()" style="background:#05070a;border:1px solid var(--border-uniform);border-radius:14px;max-width:420px;width:100%;max-height:82vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 0 25px rgba(0,0,0,0.95);">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#0d1117;border-bottom:1px solid #262c36;">
                <span style="color:#58a6ff;font-weight:bold;font-size:14px;">📁 ${window.tr('Выбор папки с музыкой', 'Music Folders')}</span>
                <button type="button" onclick="document.getElementById('jennyFolderManagerModal').remove()" style="background:transparent;border:none;color:#8b949e;font-size:16px;padding:2px 6px;">✖</button>
            </div>
            <div style="padding:12px 14px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;">
                ${rowsHtml}
                <div style="border-top:1px solid #21262d;padding-top:10px;margin-top:4px;display:flex;gap:6px;align-items:center;">
                    <input type="text" id="newFolderInputV62" placeholder="/storage/emulated/0/..." style="flex:1;padding:7px 8px;font-size:12px;text-align:left !important;">
                    <button type="button" onclick="window.addNewFolderFromInputV62()" style="padding:7px 12px;color:#3fb950;border-color:#3fb950;">➕</button>
                    <button type="button" onclick="window.triggerSystemFolderPickerV62()" style="padding:7px 10px;color:#58a6ff;border-color:#58a6ff;" title="Проводник">📂</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(m);
};

window.selectSavedFolderV62 = async function(idx) {
    const folders = window.getSavedFoldersListV62();
    const target = folders[idx];
    if (!target) return;
    await window.onNativeFolderPicked(target);
    const m = document.getElementById('jennyFolderManagerModal');
    if (m) m.remove();
};

window.addNewFolderFromInputV62 = async function() {
    const inp = document.getElementById('newFolderInputV62');
    let val = inp ? inp.value.trim() : '';
    if (!val) return;
    if (!val.startsWith('/')) val = '/storage/emulated/0/' + val;
    val = val.replace(/\/+$/, '');
    const folders = window.getSavedFoldersListV62();
    if (!folders.includes(val)) folders.unshift(val);
    window.appConfig.savedFolders = folders;
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    await window.onNativeFolderPicked(val);
    window.openFolderManagerModalV62();
};

window.removeSavedFolderV62 = function(idx) {
    const folders = window.getSavedFoldersListV62();
    if (folders.length <= 1) return;
    folders.splice(idx, 1);
    window.appConfig.savedFolders = folders;
    localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
    window.openFolderManagerModalV62();
};

window.triggerSystemFolderPickerV62 = function() {
    const m = document.getElementById('jennyFolderManagerModal');
    if (m) m.remove();
    const filePicker = document.getElementById('systemFolderPicker');
    if (window.AndroidBridge && typeof window.AndroidBridge.pickFolder === 'function') {
        window.AndroidBridge.pickFolder();
    } else if (filePicker) {
        filePicker.click();
    }
};

const _origNativePickedV62 = window.onNativeFolderPicked;
window.onNativeFolderPicked = async function(folderPath) {
    if (folderPath) {
        let p = String(folderPath).trim();
        if (!p.startsWith('/')) p = '/storage/emulated/0/' + p;
        p = p.replace(/\/+$/, '');
        const folders = window.getSavedFoldersListV62();
        if (!folders.includes(p)) {
            folders.unshift(p);
            window.appConfig.savedFolders = folders;
            localStorage.setItem('ytm_config', JSON.stringify(window.appConfig));
        }
    }
    return _origNativePickedV62(folderPath);
};

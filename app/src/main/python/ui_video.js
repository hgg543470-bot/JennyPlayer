/* ============================================================================
 * ui_video.js — Видео, база (V130–V211): плеер, HUD, PiP/оверлей, RAM-декод, вкладка «Видео»
 *
 * Склейка:  /bundle_2_player.js, модуль 9 из 18. Порядок модулей задан в player.py и менять его нельзя:
 *           поздние модули переопределяют и оборачивают функции ранних.
 * Внутри:   isVideoFileNameV130, decorateVideoIconsInListV130, createDefaultVideoConfigV131, saveVideoConfigV131, initVideoDeckAudioV131, buildVideoAudioGraphV131, renderDeckSwitchBannersV131, syncAllControlsToActiveDeckV131, switchActiveUiDeckV131, copyMusicDspToVideoV131 … (всего функций: 86)
 * Откуда:   ui_v71.js (коммит 9ae6639), строки 9054…17795 (38 фрагментов, вперемешку с другими темами). Код блоков перенесён без правок.
 * Подробно: FILES.md (карта файлов), REFACTOR_PLAN.md (как резалось и что перекрыто).
 * ============================================================================ */


// === 🎬 JENNY V130: FULL-FEATURED VIDEO STUDIO & PIP PLAYER WITH DSP AUDIO BRIDGE ===
// === 🎛️ JENNY V131: DUAL-DECK INDEPENDENT RAM & DSP ENGINE (DECK A: MUSIC | DECK B: VIDEO) ===

window.VIDEO_EXTS_V130 = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v', '.3gp'];
window.isVideoFileNameV130 = function(nameOrPath) {
const s = String(nameOrPath || '').split('?')[0].toLowerCase().trim();
return window.VIDEO_EXTS_V130.some(ext => s.endsWith(ext));
};

window.decorateVideoIconsInListV130 = function() {
document.querySelectorAll('#unifiedList .track-row-capsule, #favList .track-row-capsule').forEach(row => {
const fn = row.getAttribute('data-track') || '';
if (window.isVideoFileNameV130(fn)) {
const zone = row.querySelector('.track-title-zone');
const iconSpan = zone ? zone.querySelector('span') : null;
if (iconSpan && iconSpan.innerText === '♪') { iconSpan.innerText = '🎬'; iconSpan.style.color = '#ff7b72'; }
}
});
};

window._musicConfigRefV131 = window.appConfig;
window._activeUiDeckV131 = 'music';

window.createDefaultVideoConfigV131 = function() {
const saved = localStorage.getItem('ytm_video_config');
if (saved) {
try { const p = JSON.parse(saved); if (p && typeof p === 'object') return p; } catch (e) {}
}
const base = JSON.parse(JSON.stringify(window._musicConfigRefV131 || window.appConfig || {}));
base.defaultVolume = 10; base.gearKeyV66 = 'jbuf-lock'; base.elasticHoseMode = true; base.studioMode = true;
localStorage.setItem('ytm_video_config', JSON.stringify(base));
return base;
};

window.videoDeckV131 = {
ctx: null, config: window.createDefaultVideoConfigV131(), activeSources: new Set(), activeDynamicNodes: [],
inputMixer: null, htmlGain: null, preAmpNode: null, preFirPad: null, firNode: null, firGainNode: null,
eqNodes: {}, splitLow: null, splitMid: null, splitHigh: null, compLow: null, compMid: null, compHigh: null,
compressorNode: null, gainNode: null, midPhaseNode: null, deEssGain: null, masterSafeComp: null,
masterAntiClickGain: null, analyserPre: null, analyserPost: null, mediaElementSource: null, directBypassGain: null,
studioBuffer: null, sourceNode: null, isStudioPlaying: false, isReversed: false, speed: 1.0,
pieceAbortCtrl: null, ramDecodeSession: 0, horizonTimer: null, revFrameTimer: null,
hoseCache: { srcBuffer: null, speed: 1.0, tension: 1.0, splicedBuffer: null, lastBuildMs: 0, avgSeamErrMv: 0, seamPointsOut: [], seamLogs: [] },
mixMode: 'both'
};

window.saveVideoConfigV131 = function() {
try { localStorage.setItem('ytm_video_config', JSON.stringify(window.videoDeckV131.config)); } catch (e) {}
};

window.initVideoDeckAudioV131 = function() {
const vd = window.videoDeckV131;
const vid = document.getElementById('jennyVideoElV130');
if (!vd.ctx) {
const AC = window.AudioContext || window.webkitAudioContext;
vd.ctx = new AC({ latencyHint: 'interactive' });
vd.inputMixer = vd.ctx.createGain();
vd.htmlGain = vd.ctx.createGain(); vd.htmlGain.gain.value = 1.0; vd.htmlGain.connect(vd.inputMixer);
vd.preAmpNode = vd.ctx.createGain(); vd.preAmpNode.gain.value = 0.6;
vd.preFirPad = vd.ctx.createGain(); vd.preFirPad.gain.value = 0.8;
vd.firGainNode = vd.ctx.createGain();
[60, 230, 910, 3600, 14000].forEach((f, idx) => {
const n = vd.ctx.createBiquadFilter();
n.type = idx === 0 ? 'lowshelf' : (idx === 4 ? 'highshelf' : 'peaking');
n.frequency.value = f;
vd.eqNodes['band' + f] = n;
});
vd.splitLow = vd.ctx.createBiquadFilter(); vd.splitLow.type = 'lowpass';
vd.splitMid = vd.ctx.createBiquadFilter(); vd.splitMid.type = 'bandpass';
vd.splitHigh = vd.ctx.createBiquadFilter(); vd.splitHigh.type = 'highpass';
vd.compLow = vd.ctx.createDynamicsCompressor();
vd.compMid = vd.ctx.createDynamicsCompressor();
vd.compHigh = vd.ctx.createDynamicsCompressor();
vd.compressorNode = vd.ctx.createDynamicsCompressor();
vd.gainNode = vd.ctx.createGain();
vd.gainNode.gain.value = (parseInt(vd.config.defaultVolume, 10) || 10) / 10.0;
vd.midPhaseNode = vd.ctx.createGain();
vd.deEssGain = vd.ctx.createGain();
vd.masterSafeComp = vd.ctx.createDynamicsCompressor();
vd.masterAntiClickGain = vd.ctx.createGain(); vd.masterAntiClickGain.gain.value = 1.0;
vd.masterAntiClickGain.connect(vd.ctx.destination);
vd.analyserPre = vd.ctx.createAnalyser(); vd.analyserPre.fftSize = 2048; vd.analyserPre.smoothingTimeConstant = 0.78;
vd.analyserPost = vd.ctx.createAnalyser(); vd.analyserPost.fftSize = 2048; vd.analyserPost.smoothingTimeConstant = 0.78;
}
if (vd.ctx.state === 'suspended') { try { vd.ctx.resume(); } catch (e) {} }
if (vid && !vd.mediaElementSource) {
try {
vd.mediaElementSource = vd.ctx.createMediaElementSource(vid);
vd.directBypassGain = vd.ctx.createGain(); vd.directBypassGain.gain.value = 0.0;
vd.directBypassGain.connect(vd.ctx.destination);
vd.mediaElementSource.connect(vd.htmlGain);
vd.mediaElementSource.connect(vd.directBypassGain);
} catch (e) {}
}
window.buildVideoAudioGraphV131();
};

window.buildVideoAudioGraphV131 = function() {
const vd = window.videoDeckV131;
if (!vd.ctx) return;
while (vd.activeDynamicNodes.length > 0) {
const n = vd.activeDynamicNodes.pop();
try { n.disconnect(); } catch (e) {}
}
[vd.inputMixer, vd.preAmpNode, vd.firNode, vd.preFirPad, vd.firGainNode, vd.gainNode, vd.compressorNode, vd.splitLow, vd.splitMid, vd.splitHigh, vd.compLow, vd.compMid, vd.compHigh, vd.midPhaseNode, vd.deEssGain, vd.masterSafeComp].forEach(n => { if (n) { try { n.disconnect(); } catch (e) {} } });
Object.values(vd.eqNodes).forEach(n => { try { n.disconnect(); } catch (e) {} });

const cfg = vd.config || {};
const eqCfg = cfg.eq || { b60: 0, b230: 0, b910: 0, b3600: 0, b14000: 0 };
[60, 230, 910, 3600, 14000].forEach(fr => {
if (vd.eqNodes['band' + fr]) vd.eqNodes['band' + fr].gain.value = parseFloat(eqCfg['b' + fr]) || 0;
});
const volVal = parseInt(cfg.defaultVolume, 10);
if (vd.gainNode) vd.gainNode.gain.value = (isNaN(volVal) ? 10 : volVal) / 10.0;

let cur = vd.inputMixer;
cur.connect(vd.preAmpNode); cur = vd.preAmpNode;
try { vd.preAmpNode.connect(vd.analyserPre); } catch (e) {}

try {
if (cfg.firEnabled && cfg.firSettings) {
vd.firNode = window.trackNodeDeckB(vd.ctx.createConvolver(), vd.activeDynamicNodes);
vd.firNode.normalize = false;
vd.firNode.buffer = window.createFIRImpulseDeckB(vd.ctx, cfg.firSettings.decay, cfg);
vd.firGainNode.gain.value = parseFloat(cfg.firSettings.gain) || 1.5;
cur.connect(vd.preFirPad); vd.preFirPad.connect(vd.firNode); vd.firNode.connect(vd.firGainNode);
cur = vd.firGainNode;
}
if (cfg.eqEnabled) {
cur.connect(vd.eqNodes.band60); vd.eqNodes.band60.connect(vd.eqNodes.band230); vd.eqNodes.band230.connect(vd.eqNodes.band910);
vd.eqNodes.band910.connect(vd.eqNodes.band3600); vd.eqNodes.band3600.connect(vd.eqNodes.band14000);
cur = vd.eqNodes.band14000;
}
cur = window.insertProStudioPreChainDeckB(vd.ctx, cur, cfg, vd.activeDynamicNodes, vd.studioBuffer);
cur.connect(vd.gainNode); cur = vd.gainNode;

if (cfg.limiterEnabled && cfg.limiterSettings) {
let thresh = cfg.limiterSettings.threshold, knee = cfg.limiterSettings.knee, ratio = cfg.limiterSettings.ratio;
if (cfg.multiBandEnabled && cfg.multiBandSettings) {
let lowFreq = Math.max(20, cfg.multiBandSettings.low || 160);
let highFreq = Math.max(lowFreq + 200, cfg.multiBandSettings.high || 2528);
let vocalLowAnchor = Math.max(lowFreq, 320);
let midCenter = Math.sqrt(vocalLowAnchor * highFreq);
let midQ = Math.max(0.85, midCenter / (highFreq - vocalLowAnchor));
let now = vd.ctx.currentTime;
vd.splitLow.frequency.setTargetAtTime(lowFreq, now, 0.012);
vd.splitMid.frequency.setTargetAtTime(midCenter, now, 0.012);
vd.splitHigh.frequency.setTargetAtTime(highFreq, now, 0.012);
vd.compLow.threshold.value = thresh; vd.compLow.knee.value = knee; vd.compLow.ratio.value = ratio;
vd.compLow.attack.value = Math.max(0.015, (cfg.limiterSettings.attack || 26) / 1000);
vd.compLow.release.value = Math.max(0.04, (cfg.limiterSettings.release || 60) / 1000);
vd.compMid.threshold.value = Math.min(-6, thresh + 7); vd.compMid.knee.value = Math.max(12, knee);
vd.compMid.ratio.value = Math.min(3.5, Math.max(1.5, ratio * 0.25));
vd.compMid.attack.value = Math.max(0.025, (cfg.limiterSettings.attack || 26) / 1000); vd.compMid.release.value = 0.16;
vd.compHigh.threshold.value = thresh + 4; vd.compHigh.knee.value = knee; vd.compHigh.ratio.value = Math.min(6.0, ratio);
vd.compHigh.attack.value = 0.008; vd.compHigh.release.value = 0.08;
cur.connect(vd.splitLow); cur.connect(vd.splitMid); cur.connect(vd.splitHigh);
vd.splitLow.connect(vd.compLow); vd.splitMid.connect(vd.compMid); vd.splitHigh.connect(vd.compHigh);
let postBus = window.trackNodeDeckB(vd.ctx.createGain(), vd.activeDynamicNodes);
if (cfg.phaseFixEnabled) {
vd.splitMid.Q.setTargetAtTime(Math.max(0.25, midQ * 0.65), now, 0.012);
vd.midPhaseNode.gain.value = -1.22;
vd.compLow.connect(postBus); vd.compMid.connect(vd.midPhaseNode); vd.midPhaseNode.connect(postBus); vd.compHigh.connect(postBus);
} else {
let widthPct = parseFloat(cfg.val_midQ); if (isNaN(widthPct) || widthPct < 25) widthPct = 150;
vd.splitMid.Q.setTargetAtTime(cfg.opt_midQ ? Math.max(0.65, Math.min(2.5, midQ / (widthPct / 100.0))) : midQ, now, 0.012);
let midDb = parseFloat(cfg.val_midPhase); if (isNaN(midDb)) midDb = 1.5;
vd.midPhaseNode.gain.value = cfg.opt_midPhase ? window.dbToLinearDeckB(Math.max(-15, Math.min(15, midDb))) : 1.0;
let deEssDb = parseFloat(cfg.val_deEsser); if (isNaN(deEssDb)) deEssDb = -6.0;
if (cfg.opt_deEsser) {
vd.compHigh.threshold.value = Math.min(-6, thresh + 10); vd.compHigh.ratio.value = Math.min(4.0, ratio);
vd.compHigh.attack.value = 0.0005; vd.compHigh.release.value = 0.09;
vd.deEssGain.gain.value = window.dbToLinearDeckB(Math.min(12, deEssDb));
} else { vd.deEssGain.gain.value = 1.0; }
vd.compLow.connect(postBus); vd.compMid.connect(vd.midPhaseNode); vd.midPhaseNode.connect(postBus);
vd.compHigh.connect(vd.deEssGain); vd.deEssGain.connect(postBus);
}
let finalPost = window.insertProStudioPostChainDeckB(vd.ctx, postBus, cfg, vd.activeDynamicNodes, vd.studioBuffer);
finalPost.connect(vd.masterAntiClickGain);
} else {
vd.compressorNode.threshold.value = thresh; vd.compressorNode.knee.value = knee; vd.compressorNode.ratio.value = ratio;
vd.compressorNode.attack.value = (cfg.limiterSettings.attack || 26) / 1000;
vd.compressorNode.release.value = (cfg.limiterSettings.release || 60) / 1000;
cur.connect(vd.compressorNode);
let postOut = window.insertProStudioPostChainDeckB(vd.ctx, vd.compressorNode, cfg, vd.activeDynamicNodes, vd.studioBuffer);
postOut.connect(vd.masterAntiClickGain);
}
} else {
let postOut = window.insertProStudioPostChainDeckB(vd.ctx, cur, cfg, vd.activeDynamicNodes, vd.studioBuffer);
postOut.connect(vd.masterAntiClickGain);
}
try { vd.masterAntiClickGain.connect(vd.analyserPost); } catch (e) {}
} catch (e) {}
window.saveVideoConfigV131();
};

window.renderDeckSwitchBannersV131 = function() {
const isVid = (window._activeUiDeckV131 === 'video');
const barHtml = (barId) => `<div id="${barId}" style="display:flex;align-items:center;gap:6px;padding:6px;background:#070a10;border:1.5px solid ${isVid ? '#ff7b72' : '#58a6ff'};border-radius:10px;margin-bottom:10px;">
<button type="button" onclick="window.switchActiveUiDeckV131('music', event)" style="flex:1;padding:7px 6px;font-size:11.5px;font-weight:900;border-radius:7px;border:1px solid ${!isVid ? '#58a6ff' : 'transparent'};background:${!isVid ? 'linear-gradient(135deg,rgba(88,166,255,0.28),rgba(115,65,190,0.28))' : 'transparent'};color:${!isVid ? '#ffffff' : '#8b949e'};">🎵 Дека А: Музыка</button>
<button type="button" onclick="window.switchActiveUiDeckV131('video', event)" style="flex:1;padding:7px 6px;font-size:11.5px;font-weight:900;border-radius:7px;border:1px solid ${isVid ? '#ff7b72' : 'transparent'};background:${isVid ? 'linear-gradient(135deg,rgba(248,81,73,0.32),rgba(163,113,247,0.32))' : 'transparent'};color:${isVid ? '#ffffff' : '#8b949e'};">🎬 Дека Б: Видео</button>
${isVid ? `<button type="button" onclick="window.copyMusicDspToVideoV131(event)" style="padding:7px 8px;font-size:10.5px;font-weight:bold;border-radius:7px;background:#161b22;border:1px solid #3fb950;color:#3fb950;flex-shrink:0;">📋 Из Музыки</button>` : ''}</div>`;
[['settingsModal', 'deckSwitchBarSettingsV131'], ['eqModal', 'deckSwitchBarEqV131'], ['specModal', 'deckSwitchBarSpecV131']].forEach(([modalId, barId]) => {
const m = document.getElementById(modalId);
if (!m) return;
const cont = m.querySelector('.container') || m;
let ex = document.getElementById(barId);
if (!ex) { ex = document.createElement('div'); cont.insertBefore(ex, cont.firstChild); }
ex.outerHTML = barHtml(barId);
});
};

window.syncAllControlsToActiveDeckV131 = function() {
const cfg = window.appConfig || {};
const bools = { 'cfg_studioMode': 'studioMode', 'cfg_firEnabled': 'firEnabled', 'cfg_multiBandEnabled': 'multiBandEnabled', 'cfg_limiterEnabled': 'limiterEnabled', 'cfg_eqEnabled': 'eqEnabled', 'cfg_boosterEnabled': 'boosterEnabled', 'cfg_pitchLock': 'pitchLock', 'cfg_xNormalSpeed': 'xNormalSpeed', 'cfg_phaseFix': 'phaseFixEnabled' };
for (const [id, key] of Object.entries(bools)) {
const el = document.getElementById(id);
if (el && cfg[key] !== undefined) el.checked = Boolean(cfg[key]);
}
if (document.getElementById('cfg_boosterPower')) document.getElementById('cfg_boosterPower').value = cfg.boosterPower ?? 5;
if (document.getElementById('cfg_defaultScrubSpeed')) document.getElementById('cfg_defaultScrubSpeed').value = cfg.defaultScrubSpeed || 1.1;
if (document.getElementById('cfg_normalPlaybackSpeed')) document.getElementById('cfg_normalPlaybackSpeed').value = cfg.normalPlaybackSpeed || 0.97;
if (cfg.firSettings) {
if (document.getElementById('cfg_fir_gain')) document.getElementById('cfg_fir_gain').value = cfg.firSettings.gain;
if (document.getElementById('cfg_fir_decay')) document.getElementById('cfg_fir_decay').value = cfg.firSettings.decay;
}
if (cfg.multiBandSettings) {
if (document.getElementById('cfg_mb_low')) document.getElementById('cfg_mb_low').value = cfg.multiBandSettings.low;
if (document.getElementById('cfg_mb_high')) document.getElementById('cfg_mb_high').value = cfg.multiBandSettings.high;
}
if (cfg.limiterSettings) {
if (document.getElementById('cfg_lim_threshold')) document.getElementById('cfg_lim_threshold').value = cfg.limiterSettings.threshold;
if (document.getElementById('cfg_lim_knee')) document.getElementById('cfg_lim_knee').value = cfg.limiterSettings.knee;
if (document.getElementById('cfg_lim_ratio')) document.getElementById('cfg_lim_ratio').value = cfg.limiterSettings.ratio;
if (document.getElementById('cfg_lim_attack')) document.getElementById('cfg_lim_attack').value = cfg.limiterSettings.attack;
if (document.getElementById('cfg_lim_release')) document.getElementById('cfg_lim_release').value = cfg.limiterSettings.release;
}
if (cfg.eq) {
[60, 230, 910, 3600, 14000].forEach(fr => { const el = document.getElementById('eq_' + fr); if (el) el.value = cfg.eq['b' + fr] || 0; });
}
if (typeof window.syncDspModUI === 'function') window.syncDspModUI();
if (typeof window.syncEngineTumblerUIV62 === 'function') window.syncEngineTumblerUIV62();
if (typeof window.calculateAutoMasterPadDb === 'function') window.calculateAutoMasterPadDb(cfg);
window.renderDeckSwitchBannersV131();
};

window.switchActiveUiDeckV131 = function(deckName, ev) {
if (ev && ev.stopPropagation) ev.stopPropagation();
// БУНКЕР ДЕКИ А (#354): window.appConfig и штатные модалки навсегда закреплены исключительно за Аудиодекой А!
window._activeUiDeckV131 = 'music';
window._musicConfigRefV131 = window.appConfig;
if (deckName === 'video') {
window.initVideoDeckAudioV131();
if (ev && typeof window.openDeckBIsolatedEqModal === 'function') {
window.openDeckBIsolatedEqModal(ev);
}
return;
}
window.syncAllControlsToActiveDeckV131();
};

window.copyMusicDspToVideoV131 = function(ev) {
if (ev && ev.stopPropagation) ev.stopPropagation();
const mCfg = window.appConfig || {};
['studioMode', 'phaseFixEnabled', 'gearKeyV66', 'engineModeV62', 'elasticHoseMode', 'hoseTensionPct', 'opt_midPhase', 'val_midPhase', 'opt_midQ', 'val_midQ', 'opt_deEsser', 'val_deEsser', 'opt_cleanFir', 'val_cleanFir', 'opt_masterCeil', 'val_masterCeil', 'opt_autoRms', 'val_autoRms', 'opt_monoBass', 'val_monoBass', 'opt_msWidth', 'val_msWidth', 'opt_punch', 'val_punch', 'opt_crossfeed', 'val_crossfeed', 'firEnabled', 'firSettings', 'multiBandEnabled', 'multiBandSettings', 'limiterEnabled', 'limiterSettings', 'eqEnabled', 'eq', 'boosterEnabled', 'boosterPower'].forEach(k => {
if (mCfg[k] !== undefined) window.videoDeckV131.config[k] = JSON.parse(JSON.stringify(mCfg[k]));
});
window.saveVideoConfigV131();
window.buildVideoAudioGraphV131();
window.syncVideoRamEngineV131(false);
if (typeof window.syncDeckBIsolatedEqModalUI === 'function') window.syncDeckBIsolatedEqModalUI();
if (typeof window.showToast === 'function') window.showToast('✅ Все настройки DSP и РКПП скопированы из Музыки в Видео!');
};
// hookDualDeckRoutingV131 удалён (#354): buildAudioGraph, changeEQ, setGearboxStateV66 и ensureSpectrumAnalysersV62 принадлежат на 100% только Аудиодеке А!

window.decodeVideoToRamV131 = async function(streamUrl, titleStr) {
window.initVideoDeckAudioV131();
const vd = window.videoDeckV131;
const mySess = ++vd.ramDecodeSession;
if (vd.pieceAbortCtrl) { try { vd.pieceAbortCtrl.abort(); } catch (e) {} }
vd.studioBuffer = null;

const vid = document.getElementById('jennyVideoElV130');
let dur = 0;
try {
const mr = await fetch(`/api/video/pcm_meta?src=${encodeURIComponent(streamUrl)}`);
if (mr.ok) { const md = await mr.json(); dur = parseFloat(md.duration) || 0; }
} catch (e) {}

if (!dur && vid) {
for (let w = 0; w < 25; w++) {
if (mySess !== vd.ramDecodeSession) return null;
if (isFinite(vid.duration) && vid.duration > 0) { dur = vid.duration; break; }
await new Promise(r => setTimeout(r, 120));
}
}
if (dur <= 0 || mySess !== vd.ramDecodeSession) return null;

const srCandidates = (dur > 3600) ? [24000, 16000] : ((dur > 1200) ? [32000, 24000] : [44100, 32000]);
let sr = srCandidates[0], totalFrames = 0, audioBuf = null;
for (const candSr of srCandidates) {
try { sr = candSr; totalFrames = Math.floor(dur * sr); audioBuf = vd.ctx.createBuffer(2, totalFrames, sr); if (audioBuf) break; } catch (e) {}
}
if (!audioBuf || mySess !== vd.ramDecodeSession) return null;

const chL = audioBuf.getChannelData(0), chR = audioBuf.getChannelData(1);
const PIECE_SEC = 30;
const numPieces = Math.max(1, Math.ceil(dur / PIECE_SEC));
const pieceMap = new Uint8Array(numPieces);
audioBuf._pieceSecV72 = PIECE_SEC; audioBuf._pieceMapV72 = pieceMap;
audioBuf._loadedCountV72 = 0; audioBuf._allPiecesLoadedV72 = false; audioBuf._trueDurationV72 = dur;
vd.studioBuffer = audioBuf;

const fetchVideoPiece = async (pIdx) => {
if (pIdx < 0 || pIdx >= numPieces || pieceMap[pIdx] === 2) return true;
pieceMap[pIdx] = 1;
const stSec = pIdx * PIECE_SEC, dSec = Math.min(PIECE_SEC, dur - stSec);
const ctrl = new AbortController(); vd.pieceAbortCtrl = ctrl;
try {
const u = `/api/video/pcm_chunk?src=${encodeURIComponent(streamUrl)}&start=${stSec}&dur=${dSec}&sr=${sr}`;
const res = await fetch(u, { signal: ctrl.signal });
if (!res.ok) { pieceMap[pIdx] = 0; return false; }
const ab = await res.arrayBuffer();
const frames = Math.floor(ab.byteLength / 8);
if (frames > 0) {
const startFrame = Math.min(totalFrames, Math.floor(stSec * sr));
const maxCopy = Math.min(frames, totalFrames - startFrame);
if (maxCopy > 0) {
const leftArr = new Float32Array(ab, 0, frames);
const rightArr = new Float32Array(ab, frames * 4, frames);
chL.set(leftArr.subarray(0, maxCopy), startFrame);
chR.set(rightArr.subarray(0, maxCopy), startFrame);
}
}
pieceMap[pIdx] = 2; audioBuf._loadedCountV72++;
if (audioBuf._loadedCountV72 === 1 && vd.config && vd.config.opt_autoRms) {
window.computeBufferAutoGainDeckB(audioBuf, vd.config.val_autoRms);
window.buildVideoAudioGraphV131();
}
return true;
} catch (e) { pieceMap[pIdx] = 0; return false; }
};

let failCounts = new Uint8Array(numPieces);
while (audioBuf._loadedCountV72 < numPieces) {
if (mySess !== vd.ramDecodeSession || !window._vidStateV130.active) return null;
const curSec = (vid && isFinite(vid.currentTime)) ? vid.currentTime : 0;
const curPiece = Math.max(0, Math.min(numPieces - 1, Math.floor(curSec / PIECE_SEC)));
const stepDir = vd.isReversed ? -1 : 1;
let nextPiece = -1, urgent = false;
for (let look = 0; look < 3; look++) {
const cand = curPiece + look * stepDir;
if (cand >= 0 && cand < numPieces && pieceMap[cand] !== 2) { nextPiece = cand; if (look <= 1) urgent = true; break; }
}
if (nextPiece === -1) {
for (let offset = 1; offset < numPieces; offset++) {
const cand = curPiece + offset * stepDir;
if (cand >= 0 && cand < numPieces && pieceMap[cand] !== 2) { nextPiece = cand; break; }
}
}
if (nextPiece === -1) {
for (let i = 0; i < numPieces; i++) { if (pieceMap[i] !== 2) { nextPiece = i; break; } }
}
if (nextPiece === -1) break;
const ok = await fetchVideoPiece(nextPiece);
if (mySess !== vd.ramDecodeSession) return null;
if (ok) {
if (urgent) window.syncVideoRamEngineV131(false);
await new Promise(r => setTimeout(r, 15));
} else {
failCounts[nextPiece]++;
if (failCounts[nextPiece] >= 3) break;
await new Promise(r => setTimeout(r, 350));
}
}
audioBuf._allPiecesLoadedV72 = true;
window.syncVideoRamEngineV131(false);
return audioBuf;
};

window.extractVideoWindowBufferV131 = function(srcBuf, curVideoSec, winSec, isRev) {
const vd = window.videoDeckV131;
if (!srcBuf || !vd.ctx) return null;
const sr = srcBuf.sampleRate, numCh = srcBuf.numberOfChannels, totalLen = srcBuf.length, dur = srcBuf.duration;
if (!isRev) {
const cleanStart = Math.max(0, Math.min(dur - 0.05, curVideoSec));
const startFrame = Math.min(totalLen - 256, Math.max(0, Math.floor(cleanStart * sr)));
const frameCount = Math.max(256, Math.min(Math.floor(winSec * sr), totalLen - startFrame));
const subBuf = vd.ctx.createBuffer(numCh, frameCount, sr);
for (let c = 0; c < numCh; c++) subBuf.getChannelData(c).set(srcBuf.getChannelData(c).subarray(startFrame, startFrame + frameCount));
return subBuf;
} else {
const revEndSec = Math.max(0.15, Math.min(dur, curVideoSec));
const revEndFrame = Math.min(totalLen, Math.max(256, Math.floor(revEndSec * sr)));
const frameCount = Math.max(256, Math.min(Math.floor(winSec * sr), revEndFrame));
const subBuf = vd.ctx.createBuffer(numCh, frameCount, sr);
for (let c = 0; c < numCh; c++) {
const inp = srcBuf.getChannelData(c), out = subBuf.getChannelData(c);
for (let i = 0; i < frameCount; i++) out[i] = inp[revEndFrame - 1 - i];
}
return subBuf;
}
};

window.syncVideoRamEngineV131 = function(isDragging) {
const vd = window.videoDeckV131, st = window._vidStateV130, vid = document.getElementById('jennyVideoElV130');
if (!vid || !vd.ctx || !st.active) return;
if (vd.horizonTimer) { clearTimeout(vd.horizonTimer); vd.horizonTimer = null; }
if (vd.revFrameTimer) { clearInterval(vd.revFrameTimer); vd.revFrameTimer = null; }

const gKey = (vd.config && vd.config.gearKeyV66) || 'jbuf-lock';
const targetSpd = (gKey === 'neutral') ? 1.0 : (vd.speed || 1.0);
const isRev = Boolean(vd.isReversed);
const curSec = vid.currentTime || 0;
const pSec = (vd.studioBuffer && vd.studioBuffer._pieceSecV72) || 30;
const curP = vd.studioBuffer ? Math.max(0, Math.min(vd.studioBuffer._pieceMapV72.length - 1, Math.floor((isRev ? Math.max(0, curSec - 1.0) : curSec) / pSec))) : -1;
const isPieceReady = Boolean(vd.studioBuffer && vd.studioBuffer._pieceMapV72 && vd.studioBuffer._pieceMapV72[curP] === 2);
const useRamEngine = isPieceReady && (isRev || gKey === 'jbuf-lock' || gKey === 'jbuf-shift' || gKey === 'vinyl-shift');

if (!useRamEngine) {
if (vd.sourceNode) { vd.sourceNode.onended = null; try { vd.sourceNode.stop(); } catch (e) {} try { vd.sourceNode.disconnect(); } catch (e) {} vd.sourceNode = null; }
vd.isStudioPlaying = false;
if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = st.dspBypass ? 0.0 : 1.0;
if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = st.dspBypass ? 1.0 : 0.0;
const lockPitch = (gKey !== 'web-shift' && gKey !== 'jbuf-shift' && gKey !== 'vinyl-shift');
vid.preservesPitch = lockPitch; vid.mozPreservesPitch = lockPitch; vid.webkitPreservesPitch = lockPitch;
if (Math.abs(vid.playbackRate - targetSpd) > 0.005) { try { vid.playbackRate = targetSpd; } catch (e) {} }
return;
}

if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = 0.0;
if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = 0.0;
const WIN_SEC = Math.max(18.0, Math.min(60.0, targetSpd * 18.0));
const rawWinBuf = window.extractVideoWindowBufferV131(vd.studioBuffer, curSec, WIN_SEC, isRev);
if (!rawWinBuf) return;

let playBuf = rawWinBuf, nodeRate = 1.0;
if (gKey === 'jbuf-lock') {
const tensionPct = (vd.config && vd.config.hoseTensionPct !== undefined) ? vd.config.hoseTensionPct : 100;
playBuf = window.buildElasticHoseBufferDeckB(rawWinBuf, targetSpd, tensionPct);
nodeRate = 1.0;
} else {
playBuf = rawWinBuf; nodeRate = targetSpd;
}

if (vd.sourceNode) { vd.sourceNode.onended = null; try { vd.sourceNode.stop(); } catch (e) {} try { vd.sourceNode.disconnect(); } catch (e) {} vd.sourceNode = null; }

if ((!vid.paused || vd.isReversed) && !st.userPaused) {
vd.sourceNode = vd.ctx.createBufferSource();
vd.sourceNode.buffer = playBuf;
vd.sourceNode.playbackRate.value = nodeRate;
vd.sourceNode.connect(st.dspBypass ? vd.directBypassGain : vd.inputMixer);
if (st.dspBypass && vd.directBypassGain) vd.directBypassGain.gain.value = 1.0;
vd.sourceNode.start(0, 0);
vd.isStudioPlaying = true;

if (isRev) {
if (!vid.paused) { st._internalRevPause = true; vid.pause(); }
const startCtxT = vd.ctx.currentTime, startVidSec = curSec;
vd.revFrameTimer = setInterval(() => {
if (!st.active || st.userPaused || !vd.isReversed) { clearInterval(vd.revFrameTimer); vd.revFrameTimer = null; return; }
const nextSec = Math.max(0, startVidSec - (vd.ctx.currentTime - startCtxT) * targetSpd);
if (Math.abs(vid.currentTime - nextSec) >= 0.04) { try { vid.currentTime = nextSec; } catch (e) {} }
if (nextSec <= 0.05) { vd.isReversed = false; clearInterval(vd.revFrameTimer); vd.revFrameTimer = null; window.updateVideoRevBtnUIV131(); }
}, 45);
} else {
if (Math.abs(vid.playbackRate - targetSpd) > 0.005) { try { vid.playbackRate = targetSpd; } catch (e) {} }
}

const realDurSec = (gKey === 'jbuf-lock') ? playBuf.duration : (playBuf.duration / Math.max(0.25, nodeRate));
vd.horizonTimer = setTimeout(() => { if (st.active && !st.userPaused) window.syncVideoRamEngineV131(false); }, Math.max(400, (realDurSec - 0.9) * 1000));
}
};

window._vidStateV130 = {
active: false, userPaused: false, pipMode: false, rotated90: false, fitMode: 'contain',
dspBypass: false, brightness: 1.0, currentUrl: '', currentTitle: '', torHash: '', torFileIdx: -1,
usingRemux: false, remuxBaseOffset: 0, controlsHideTimer: null, hudJustWokeUntil: 0
};

window.ensureVideoPlayerDOMV130 = function() {
let root = document.getElementById('jennyVideoStudioRootV130');
if (root) return root;
const st = document.createElement('style');
st.id = 'jennyVideoStudioStyleV130';
st.textContent = `
#jennyVideoStudioRootV130 { position:fixed; z-index:2147483300; background:#000; display:none; flex-direction:column; justify-content:center; align-items:center; overflow:hidden; user-select:none; -webkit-user-select:none; touch-action:none; box-shadow:0 18px 50px rgba(0,0,0,0.96); }
#jennyVideoStudioRootV130.mode-full-v130 { inset:0 !important; width:100vw !important; height:100vh !important; border-radius:0 !important; border:none !important; }
#jennyVideoStudioRootV130.mode-pip-v130 { width:280px !important; height:168px !important; border-radius:14px !important; border:1.5px solid #58a6ff !important; box-shadow:0 12px 34px rgba(0,0,0,0.95), 0 0 16px rgba(88,166,255,0.35) !important; }
#jennyVideoStageV130 { position:relative; width:100%; height:100%; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:#000; overflow:hidden; }
#jennyVideoStageV130.rot90-v130 { position:fixed !important; left:50% !important; top:50% !important; width:100vh !important; height:100vw !important; max-width:none !important; max-height:none !important; flex-shrink:0 !important; transform:translate(-50%,-50%) rotate(90deg) !important; transform-origin:center center !important; }
#jennyVideoElV130 { width:100%; height:100%; max-width:100%; max-height:100%; background:#000; outline:none; pointer-events:none; }
.v130-hud-overlay { position:absolute; inset:0; display:flex; flex-direction:column; justify-content:space-between; background:linear-gradient(180deg,rgba(0,0,0,0.84) 0%,rgba(0,0,0,0) 26%,rgba(0,0,0,0) 68%,rgba(0,0,0,0.9) 100%); opacity:1; transition:opacity 0.2s ease; pointer-events:none; z-index:10; }
.v130-hud-overlay.hud-hidden-v130 { opacity:0 !important; visibility:hidden !important; }
.v130-hud-bar { pointer-events:auto; }
.v130-hud-overlay.hud-hidden-v130 .v130-hud-bar, .v130-hud-overlay.hud-hidden-v130 .v130-btn, .v130-hud-overlay.hud-hidden-v130 input { pointer-events:none !important; }
.v130-btn { background:rgba(13,17,23,0.85) !important; border:1px solid rgba(255,255,255,0.25) !important; color:#e6edf3 !important; padding:5px 8px !important; border-radius:8px !important; font-size:11px !important; font-weight:800 !important; display:inline-flex !important; align-items:center !important; justify-content:center !important; gap:4px !important; }
.v130-btn:active { transform:scale(0.94); border-color:#58a6ff !important; }
#jennyVideoStudioRootV130.mode-pip-v130 .v130-hide-in-pip { display:none !important; }
`;
document.head.appendChild(st);

root = document.createElement('div');
root.id = 'jennyVideoStudioRootV130';
root.className = 'mode-full-v130';
root.innerHTML = `<div id="jennyVideoStageV130">
<video id="jennyVideoElV130" playsinline webkit-playsinline preload="auto" crossorigin="anonymous"></video>
<div id="v130CenterFeedback" style="display:none;position:absolute;padding:10px 18px;border-radius:12px;background:rgba(9,13,20,0.92);border:1.5px solid #58a6ff;color:#fff;font-size:14px;font-weight:900;z-index:20;pointer-events:none;box-shadow:0 0 20px rgba(0,0,0,0.9);"></div>
<div id="v130HudOverlay" class="v130-hud-overlay">
<div class="v130-hud-bar" id="v130TopDragBar" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;">
<div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;"><span style="font-size:15px;">🎬</span><div style="min-width:0;flex:1;"><div id="v130VideoTitle" style="color:#fff;font-size:12.5px;font-weight:900;white-space:normal;overflow-wrap:anywhere;word-break:break-word;line-height:1.32;">Видеоплеер</div><div id="v130VideoSubTelemetry" class="v130-hide-in-pip" style="color:#79c0ff;font-size:10px;font-weight:bold;">Дека Б (RAM + DSP)</div></div></div>
<div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
<button type="button" class="v130-btn v130-hide-in-pip" id="v131BtnMixMode" onclick="window.cycleDualDeckMixModeV131(event)" style="border-color:#3fb950 !important;color:#3fb950 !important;">🎚️ А+Б</button>
<button type="button" class="v130-btn v130-hide-in-pip" id="v130BtnTorHub" onclick="window.openTorHubFromVideoV130(event)" style="display:none;border-color:#d2a8ff !important;color:#d2a8ff !important;">🧩 Части</button>
<button type="button" class="v130-btn" id="v130BtnPipToggle" onclick="window.toggleVideoPipModeV130(event)">❐ Мини</button>
<button type="button" class="v130-btn" onclick="window.closeVideoPlayerV130(event)" style="background:rgba(218,54,51,0.9) !important;border-color:#ff7b72 !important;color:#fff !important;">✖</button>
</div></div>
<div class="v130-hud-bar" style="display:flex;align-items:center;justify-content:center;gap:24px;">
<button type="button" class="v130-btn v130-hide-in-pip" onclick="window.seekVideoRelativeV130(-10, event)" style="width:46px;height:46px;border-radius:50% !important;font-size:13px !important;">⏪10</button>
<button type="button" class="v130-btn" id="v130CenterPlayBtn" onclick="window.toggleVideoPlayPauseV130(event)" style="width:54px;height:54px;border-radius:50% !important;font-size:20px !important;background:rgba(115,65,190,0.88) !important;border:2px solid #d2a8ff !important;box-shadow:0 0 18px rgba(163,113,247,0.6);">⏸</button>
<button type="button" class="v130-btn v130-hide-in-pip" onclick="window.seekVideoRelativeV130(10, event)" style="width:46px;height:46px;border-radius:50% !important;font-size:13px !important;">10⏩</button>
</div>
<div class="v130-hud-bar" style="display:flex;flex-direction:column;gap:8px;padding:10px 12px;">
<div style="display:flex;align-items:center;gap:8px;"><span id="v130CurTime" style="color:#58a6ff;font-size:11px;font-family:monospace;font-weight:bold;min-width:36px;">0:00</span><input type="range" id="v130SeekSlider" min="0" max="1000" value="0" style="flex:1;height:6px;accent-color:#a371f7;cursor:pointer;"><span id="v130DurTime" style="color:#e3b341;font-size:11px;font-family:monospace;font-weight:bold;min-width:36px;text-align:right;">0:00</span></div>
<div class="v130-hide-in-pip" style="display:flex;align-items:center;justify-content:space-between;gap:4px;flex-wrap:wrap;">
<button type="button" class="v130-btn" id="v130BtnRotate" onclick="window.toggleVideoRotate90V130(event)">🔄 90°</button>
<button type="button" class="v130-btn" id="v130BtnFit" onclick="window.cycleVideoFitModeV130(event)">📐 Вписать</button>
<button type="button" class="v130-btn" id="v131BtnVideoRev" onclick="window.toggleVideoReverseV131(event)">⏪ REV</button>
<button type="button" class="v130-btn" id="v130BtnSpeed" onclick="window.cycleVideoSpeedV130(event)">⏩ 1.0x</button>
<button type="button" class="v130-btn" id="v131BtnOpenVideoDsp" onclick="window.openVideoDeckDspStudioV131(event)" style="border-color:#ff7b72 !important;color:#ff7b72 !important;">🎛️ Пульт Б</button>
<button type="button" class="v130-btn" id="v130BtnDsp" onclick="window.toggleVideoDspModeV130(event)" style="border-color:#3fb950 !important;color:#3fb950 !important;">🎧 DSP</button>
<button type="button" class="v130-btn" id="v130BtnRemux" onclick="window.switchVideoToFfmpegRemuxV130(event)">🛠️ MKV</button>
<button type="button" class="v130-btn" id="v130BtnSaveVideo" onclick="window.saveCurrentVideoToLibraryV130(event)" style="display:none;border-color:#58a6ff !important;color:#58a6ff !important;">⬇️</button>
</div></div></div></div>`;
document.body.appendChild(root);
window.bindVideoStudioEventsV130();
return root;
};

window.isVideoHudGuardActiveV130 = function(ev) {
if (performance.now() < (window._vidStateV130.hudJustWokeUntil || 0)) {
if (ev && ev.stopPropagation) ev.stopPropagation();
if (ev && ev.preventDefault) ev.preventDefault();
return true;
}
return false;
};

window.showVideoFeedbackV130 = function(text) {
const fb = document.getElementById('v130CenterFeedback');
if (!fb) return;
fb.innerText = text; fb.style.display = 'block';
clearTimeout(fb._hideT); fb._hideT = setTimeout(() => { fb.style.display = 'none'; }, 850);
};

var wakeVideoHudV130 = window.wakeVideoHudV130 = window.wakeVideoHudV130 || function(){};

window.openVideoDeckDspStudioV131 = function(ev) {
if (window.isVideoHudGuardActiveV130(ev)) return;
if (ev && ev.stopPropagation) ev.stopPropagation();
if (!window._vidStateV130.pipMode) window.toggleVideoPipModeV130();
window.switchActiveUiDeckV131('video');
const sm = document.getElementById('settingsModal');
if (sm && !sm.classList.contains('open')) window.toggleModal('settingsModal');
window.renderDeckSwitchBannersV131();
};

window.cycleDualDeckMixModeV131 = function(ev) {
if (window.isVideoHudGuardActiveV130(ev)) return;
if (ev && ev.stopPropagation) ev.stopPropagation();
const vd = window.videoDeckV131;
const modes = ['both', 'video_only', 'music_only'];
vd.mixMode = modes[(modes.indexOf(vd.mixMode || 'both') + 1) % modes.length];
const btn = document.getElementById('v131BtnMixMode');
if (vd.mixMode === 'both') {
if (vd.masterAntiClickGain) vd.masterAntiClickGain.gain.value = 1.0;
if (window.masterAntiClickGain) window.masterAntiClickGain.gain.value = 1.0;
if (btn) { btn.innerText = '🎚️ А+Б'; btn.style.color = '#3fb950'; }
window.showVideoFeedbackV130('🎚️ Микшер: Видео + Музыка вместе');
} else if (vd.mixMode === 'video_only') {
if (vd.masterAntiClickGain) vd.masterAntiClickGain.gain.value = 1.0;
if (window.masterAntiClickGain) window.masterAntiClickGain.gain.value = 0.0;
if (btn) { btn.innerText = '🎬 Видео'; btn.style.color = '#58a6ff'; }
window.showVideoFeedbackV130('🎬 Слышно только Видео (Музыка приглушена)');
} else {
if (vd.masterAntiClickGain) vd.masterAntiClickGain.gain.value = 0.0;
if (window.masterAntiClickGain) window.masterAntiClickGain.gain.value = 1.0;
if (btn) { btn.innerText = '🎵 Музыка'; btn.style.color = '#d2a8ff'; }
window.showVideoFeedbackV130('🎵 Слышна только Музыка (звук Видео приглушён)');
}
window.wakeVideoHudV130(false);
};

window.toggleVideoDspModeV130 = function(ev) {
if (window.isVideoHudGuardActiveV130(ev)) return;
if (ev && ev.stopPropagation) ev.stopPropagation();
const st = window._vidStateV130; st.dspBypass = !st.dspBypass;
window.syncVideoRamEngineV131(false);
const btn = document.getElementById('v130BtnDsp');
if (btn) { btn.innerText = st.dspBypass ? '🎧 ВЫКЛ' : '🎧 DSP'; btn.style.color = st.dspBypass ? '#8b949e' : '#3fb950'; btn.style.borderColor = st.dspBypass ? '#30363d' : '#3fb950'; }
window.showVideoFeedbackV130(st.dspBypass ? '🎧 Прямой звук (DSP ВЫКЛ)' : '🎧 Тракт Деки Б (Jenny DSP ВКЛ)');
window.wakeVideoHudV130(false);
};

window.toggleVideoRotate90V130 = function(ev) {
if (window.isVideoHudGuardActiveV130(ev)) return;
if (ev && ev.stopPropagation) ev.stopPropagation();
const st = window._vidStateV130;
if (st.pipMode) window.toggleVideoPipModeV130();
st.rotated90 = !st.rotated90;
document.getElementById('jennyVideoStageV130')?.classList.toggle('rot90-v130', st.rotated90);
window.showVideoFeedbackV130(st.rotated90 ? '🔄 Горизонтальный разворот 90°' : '📱 Портретный режим');
window.wakeVideoHudV130(false);
};

window.cycleVideoFitModeV130 = function(ev) {
if (window.isVideoHudGuardActiveV130(ev)) return;
if (ev && ev.stopPropagation) ev.stopPropagation();
const st = window._vidStateV130, modes = ['contain', 'cover', 'fill'], labels = { contain: '📐 Вписать', cover: '📐 Заполнить', fill: '📐 Растянуть' };
st.fitMode = modes[(modes.indexOf(st.fitMode) + 1) % modes.length];
const vid = document.getElementById('jennyVideoElV130'); if (vid) vid.style.objectFit = st.fitMode;
const btn = document.getElementById('v130BtnFit'); if (btn) btn.innerText = labels[st.fitMode];
window.showVideoFeedbackV130(labels[st.fitMode]); window.wakeVideoHudV130(false);
};

window.cycleVideoSpeedV130 = function(ev) {
if (window.isVideoHudGuardActiveV130(ev)) return;
if (ev && ev.stopPropagation) ev.stopPropagation();
const vd = window.videoDeckV131, speeds = [0.5, 0.75, 0.9, 1.0, 1.1, 1.25, 1.5, 2.0];
vd.speed = speeds[(speeds.indexOf(vd.speed) + 1) % speeds.length];
const btn = document.getElementById('v130BtnSpeed'); if (btn) btn.innerText = `⏩ ${vd.speed}x`;
window.syncVideoRamEngineV131(false);
window.showVideoFeedbackV130(`⏩ Скорость Видео (Дека Б): ${vd.speed}x`);
window.wakeVideoHudV130(false);
};

window.toggleVideoPipModeV130 = function(ev) {
if (window.isVideoHudGuardActiveV130(ev)) return;
if (ev && ev.stopPropagation) ev.stopPropagation();
const st = window._vidStateV130, root = document.getElementById('jennyVideoStudioRootV130'), stage = document.getElementById('jennyVideoStageV130'), btn = document.getElementById('v130BtnPipToggle');
if (!root) return;
st.pipMode = !st.pipMode;
if (st.pipMode) {
st.rotated90 = false; stage?.classList.remove('rot90-v130');
root.classList.remove('mode-full-v130'); root.classList.add('mode-pip-v130');
if (!root._hasCustomPipPosV130) { root.style.left = Math.max(8, window.innerWidth - 290) + 'px'; root.style.top = '74px'; }
root.style.right = 'auto'; root.style.bottom = 'auto';
if (btn) btn.innerText = '⛶ Развернуть';
} else {
root.classList.remove('mode-pip-v130'); root.classList.add('mode-full-v130');
root.style.left = '0'; root.style.top = '0';
if (btn) btn.innerText = '❐ Мини';
}
window.wakeVideoHudV130(false);
};

var toggleVideoPlayPauseV130 = window.toggleVideoPlayPauseV130 = window.toggleVideoPlayPauseV130 || function(){};

window.seekVideoRelativeV130 = function(deltaSec, ev) {
if (window.isVideoHudGuardActiveV130(ev)) return;
if (ev && ev.stopPropagation) ev.stopPropagation();
const vid = document.getElementById('jennyVideoElV130');
if (!vid) return;
const target = Math.max(0, (vid.currentTime || 0) + deltaSec);
vid.currentTime = isFinite(vid.duration) ? Math.min(vid.duration, target) : target;
window.syncVideoRamEngineV131(false);
window.showVideoFeedbackV130(deltaSec > 0 ? `⏩ +${deltaSec} сек` : `⏪ ${deltaSec} сек`);
window.wakeVideoHudV130(false);
};

var switchVideoToFfmpegRemuxV130 = window.switchVideoToFfmpegRemuxV130 = window.switchVideoToFfmpegRemuxV130 || function(){};

window.saveCurrentVideoToLibraryV130 = async function(ev) {
if (window.isVideoHudGuardActiveV130(ev)) return;
if (ev && ev.stopPropagation) ev.stopPropagation();
const st = window._vidStateV130; if (!st.torHash || st.torFileIdx < 0) return;
await window.controlTorrentJobV128(st.torHash, 'boost_file', st.torFileIdx);
window.showVideoFeedbackV130('⬇️ Видео поставлено первым в очередь закачки!');
};

window.closeVideoPlayerV130 = function(ev) {
if (window.isVideoHudGuardActiveV130(ev)) return;
if (ev && ev.stopPropagation) ev.stopPropagation();
const st = window._vidStateV130, vd = window.videoDeckV131;
st.active = false; st.rotated90 = false; vd.ramDecodeSession++;
if (vd.pieceAbortCtrl) { try { vd.pieceAbortCtrl.abort(); } catch (e) {} }
if (vd.horizonTimer) { clearTimeout(vd.horizonTimer); vd.horizonTimer = null; }
if (vd.revFrameTimer) { clearInterval(vd.revFrameTimer); vd.revFrameTimer = null; }
if (vd.sourceNode) { vd.sourceNode.onended = null; try { vd.sourceNode.stop(); } catch (e) {} try { vd.sourceNode.disconnect(); } catch (e) {} vd.sourceNode = null; }
vd.isStudioPlaying = false; vd.isReversed = false;
if (window.masterAntiClickGain) window.masterAntiClickGain.gain.value = 1.0;
clearTimeout(st.controlsHideTimer);
document.getElementById('jennyVideoStageV130')?.classList.remove('rot90-v130');
const vid = document.getElementById('jennyVideoElV130');
if (vid) { try { vid.pause(); vid.removeAttribute('src'); vid.load(); } catch (e) {} }
const root = document.getElementById('jennyVideoStudioRootV130');
if (root) root.style.display = 'none';
};

window.openJennyVideoPlayerV130 = function(streamUrl, titleStr, opts) {
opts = opts || {};
const root = window.ensureVideoPlayerDOMV130(), vid = document.getElementById('jennyVideoElV130'), st = window._vidStateV130, vd = window.videoDeckV131;
window.stopAllExternalStreamsV97();
st.active = true; st.userPaused = false; st._pausedSeekSecV355 = undefined; st._didSeekWhilePausedV355 = false; st.currentUrl = streamUrl; st.currentTitle = titleStr || 'Видео';
st.torHash = opts.torHash || ''; st.torFileIdx = (opts.torFileIdx !== undefined) ? Number(opts.torFileIdx) : -1;
st.usingRemux = false; st.remuxBaseOffset = 0; vd.isReversed = false;
window.updateVideoRevBtnUIV131();
document.getElementById('v130VideoTitle').innerText = st.currentTitle;
const subEl = document.getElementById('v130VideoSubTelemetry');
if (subEl) subEl.innerText = st.torHash ? '🧲 Прямой P2P видеопоток • Дека Б' : '📁 Локальное видео • Дека Б (RAM + DSP)';
const btnHub = document.getElementById('v130BtnTorHub'), btnSave = document.getElementById('v130BtnSaveVideo');
if (btnHub) btnHub.style.display = st.torHash ? 'inline-flex' : 'none';
if (btnSave) btnSave.style.display = st.torHash ? 'inline-flex' : 'none';
if (st.torHash && st.torFileIdx >= 0) {
fetch('/api/torrent/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hash: st.torHash, action: 'boost_file', file_index: st.torFileIdx }) }).catch(() => {});
}
root.style.display = 'flex';
window.initVideoDeckAudioV131();
vid.src = streamUrl; vid.playbackRate = vd.speed || 1.0;
vid.play().catch(() => {});
window.wakeVideoHudV130(false);
window.decodeVideoToRamV131(streamUrl, titleStr);
};

window.bindVideoStudioEventsV130 = function() {
const root = document.getElementById('jennyVideoStudioRootV130'), stage = document.getElementById('jennyVideoStageV130'), vid = document.getElementById('jennyVideoElV130'), seek = document.getElementById('v130SeekSlider'), playBtn = document.getElementById('v130CenterPlayBtn');
if (!root || !vid) return;
['touchstart', 'touchmove', 'touchend', 'click'].forEach(evName => { root.addEventListener(evName, (e) => { e.stopPropagation(); }, false); });
let userDraggingSeek = false;
seek.addEventListener('touchstart', (e) => { e.stopPropagation(); userDraggingSeek = true; }, { passive: true });
seek.addEventListener('mousedown', (e) => { e.stopPropagation(); userDraggingSeek = true; });
const finishSeek = (e) => {
if (e && e.stopPropagation) e.stopPropagation();
if (!userDraggingSeek) return;
userDraggingSeek = false;
if (isFinite(vid.duration) && vid.duration > 0) { vid.currentTime = (parseFloat(seek.value) / 1000.0) * vid.duration; window.syncVideoRamEngineV131(false); }
window.wakeVideoHudV130(false);
};
seek.addEventListener('touchend', finishSeek, { passive: true });
seek.addEventListener('mouseup', finishSeek);
seek.addEventListener('change', finishSeek);

vid.addEventListener('play', () => { window._vidStateV130.userPaused = false; if (playBtn) playBtn.innerText = '⏸'; window.initVideoDeckAudioV131(); window.syncVideoRamEngineV131(false); window.wakeVideoHudV130(false); });
vid.addEventListener('pause', () => { if (window._vidStateV130._internalRevPause) { window._vidStateV130._internalRevPause = false; return; } if (playBtn) playBtn.innerText = '▶'; window.wakeVideoHudV130(false); });
vid.addEventListener('seeked', () => { if (!userDraggingSeek) window.syncVideoRamEngineV131(false); });
vid.addEventListener('timeupdate', () => {
if (userDraggingSeek || window._v130UserDraggingSeekV212) return;
const cEl = document.getElementById('v130CurTime'), dEl = document.getElementById('v130DurTime');
const cur = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : ((vid.currentTime || 0) + (window._vidStateV130.remuxBaseOffset || 0));
const dur = window.getEffectiveVideoDurationV167 ? window.getEffectiveVideoDurationV167(vid) : (isFinite(vid.duration) ? vid.duration : 0);
if (cEl) cEl.innerText = window.fmtKhSecV90 ? window.fmtKhSecV90(cur) : '0:00';
if (dEl) dEl.innerText = dur > 0 ? (window.fmtKhSecV90 ? window.fmtKhSecV90(dur) : '0:00') : 'Поток';
if (seek && dur > 0) seek.value = String(Math.min(1000, Math.max(0, Math.round((cur / dur) * 1000))));
});

let lastTapTs = 0, startX = 0, startY = 0, initLeft = 0, initTop = 0, gestureMode = '', canStartPipDrag = false;
stage.addEventListener('touchstart', (e) => {
if (!e.touches || e.touches.length !== 1) return;
const t = e.touches[0]; startX = t.clientX; startY = t.clientY; gestureMode = '';
const onInteractive = Boolean(e.target.closest('button') || e.target.closest('input'));
canStartPipDrag = Boolean(window._vidStateV130.pipMode && !onInteractive);
if (canStartPipDrag) { const r = root.getBoundingClientRect(); initLeft = r.left; initTop = r.top; }
}, { passive: true });

stage.addEventListener('touchmove', (e) => {
if (!e.touches || e.touches.length !== 1) return;
const t = e.touches[0], dx = t.clientX - startX, dy = t.clientY - startY, dist = Math.hypot(dx, dy), st = window._vidStateV130, vd = window.videoDeckV131;
if (canStartPipDrag && (gestureMode === 'pip_drag' || dist > 8)) {
gestureMode = 'pip_drag'; root._hasCustomPipPosV130 = true;
root.style.left = Math.max(4, Math.min(window.innerWidth - 284, initLeft + dx)) + 'px';
root.style.top = Math.max(4, Math.min(window.innerHeight - 172, initTop + dy)) + 'px';
return;
}
if (!st.pipMode && !e.target.closest('button') && !e.target.closest('input')) {
const primaryDelta = st.rotated90 ? -dx : dy, secondaryDelta = st.rotated90 ? dy : dx;
if (Math.abs(primaryDelta) > 24 && Math.abs(primaryDelta) > Math.abs(secondaryDelta) * 1.4) {
if (!gestureMode) gestureMode = (st.rotated90 ? (startY < window.innerHeight * 0.5) : (startX < window.innerWidth * 0.5)) ? 'bright' : 'vol';
if (gestureMode === 'bright') {
st.brightness = Math.max(0.35, Math.min(1.6, st.brightness - primaryDelta * 0.003));
startX = t.clientX; startY = t.clientY; vid.style.filter = `brightness(${st.brightness.toFixed(2)})`;
window.showVideoFeedbackV130(`☀️ Яркость: ${Math.round(st.brightness * 100)}%`);
} else if (gestureMode === 'vol') {
const maxV = vd.config.boosterEnabled ? (10 + (parseInt(vd.config.boosterPower, 10) || 5)) : 10;
const curV = parseFloat(vd.config.defaultVolume) || 10;
vd.config.defaultVolume = Math.round(Math.max(0, Math.min(maxV, curV - (primaryDelta > 0 ? 0.45 : -0.45))));
if (vd.gainNode) vd.gainNode.gain.value = vd.config.defaultVolume / 10.0;
window.saveVideoConfigV131(); startX = t.clientX; startY = t.clientY;
window.showVideoFeedbackV130(`🔊 Громкость Видео (Дека Б): ${Math.round(vd.config.defaultVolume * 10)}%`);
}
}
}
}, { passive: true });

stage.addEventListener('touchend', (e) => {
canStartPipDrag = false;
if (gestureMode) { gestureMode = ''; return; }
const hud = document.getElementById('v130HudOverlay');
if (hud && hud.classList.contains('hud-hidden-v130')) { window.wakeVideoHudV130(true); return; }
if (e.target.closest('button') || e.target.closest('input') || e.target.closest('#jennyFenceWrapV173') || e.target.closest('#jennyTunerFloatWrapV208') || e.target.closest('#jennySplitPillWrapV209') || e.target.closest('#jenny120PillWrapV209') || e.target.closest('#jv168SplitLine')) { window.wakeVideoHudV130(false); return; }
const now = Date.now(), st = window._vidStateV130;
if (!st.pipMode && now - lastTapTs < 280) {
const tapClientX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : window.innerWidth / 2;
const tapClientY = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientY : window.innerHeight / 2;
const normPos = st.rotated90 ? (tapClientY / Math.max(1, window.innerHeight)) : (tapClientX / Math.max(1, window.innerWidth));
if (normPos < 0.42) window.seekVideoRelativeV130(-10);
else if (normPos > 0.58) window.seekVideoRelativeV130(10);
else window.toggleVideoPlayPauseV130();
lastTapTs = 0; return;
}
lastTapTs = now;
if (typeof window.setVideoHudHiddenUnifiedV214 === 'function') {
window.setVideoHudHiddenUnifiedV214(true, false);
} else if (hud) {
hud.classList.add('hud-hidden-v130'); clearTimeout(st.controlsHideTimer);
}
}, { passive: true });
};

setInterval(() => {
const st = window._vidStateV130, vd = window.videoDeckV131;
if (!st.active) return;
const subEl = document.getElementById('v130VideoSubTelemetry');
if (!subEl) return;
const gKey = (vd.config && vd.config.gearKeyV66) || 'jbuf-lock';
const ramLoaded = vd.studioBuffer ? (vd.studioBuffer._loadedCountV72 || 0) : 0;
const ramTot = (vd.studioBuffer && vd.studioBuffer._pieceMapV72) ? vd.studioBuffer._pieceMapV72.length : 0;
const ramTag = ramTot > 0 ? `RAM ${ramLoaded}/${ramTot}` : 'Поток';
if (st.torHash) {
const dTor = (window._torLiveDaemonSnapV128 || []).find(t => t.hash === st.torHash);
if (dTor) {
const f = (dTor.files || []).find(x => Number(x.index) === st.torFileIdx);
subEl.innerText = `🧲 ▲${dTor.seeders} • ⚡${dTor.speed_kbps || 0}КБ/с • P2P:${f ? (f.percent || 0) : 0}% • 🧩${ramTag} [${gKey}]`;
}
} else {
if (typeof window.updateVideoHeaderTelemetryV166 === 'function') { window.updateVideoHeaderTelemetryV166(); } else { subEl.innerText = `🧩 ${ramTag} • ⚙️ РКПП: ${gKey} • ⏩ x${vd.speed}${vd.isReversed ? ' (⏪REV)' : ''}`; }
}
}, 1000);

setTimeout(() => { window.decorateVideoIconsInListV130(); window.renderDeckSwitchBannersV131(); }, 400);

// === 📌🔒⛶ JENNY V132: DESKTOP OVERLAY WINDOW, TRUE FULLSCREEN & HARD LOCK ===
window._vidStateV130 = Object.assign(window._vidStateV130 || {}, {
nativeFullscreen: false,
isLocked: false,
desktopOverlay: false
});

window.syncNativeFullscreenLockV132 = function() {
const st = window._vidStateV130;
const wantFs = Boolean(st.active && !st.pipMode && !st.desktopOverlay && (st.nativeFullscreen || st.isLocked));
const wantLock = Boolean(st.active && st.isLocked);
if (window.AndroidBridge && typeof window.AndroidBridge.setVideoFullscreenLock === 'function') {
try { window.AndroidBridge.setVideoFullscreenLock(wantFs, wantLock); } catch (e) {}
}
const fsBtn = document.getElementById('v132BtnFullscreen');
if (fsBtn) {
fsBtn.innerText = st.nativeFullscreen ? '🗗 Обычн.' : '⛶ Полный';
fsBtn.style.borderColor = st.nativeFullscreen ? '#3fb950' : 'rgba(255,255,255,0.25)';
fsBtn.style.color = st.nativeFullscreen ? '#3fb950' : '#e6edf3';
}
const lockBtn = document.getElementById('v132BtnLock');
if (lockBtn) {
lockBtn.style.borderColor = st.isLocked ? '#e3b341' : 'rgba(255,255,255,0.25)';
}
};

window.toggleVideoNativeFullscreenV132 = function(ev) {
if (window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
if (ev && ev.stopPropagation) ev.stopPropagation();
const st = window._vidStateV130;
if (st.desktopOverlay) {
window.exitDesktopOverlayModeV132(true);
}
if (st.pipMode) {
window.toggleVideoPipModeV130();
}
st.nativeFullscreen = !st.nativeFullscreen;
window.syncNativeFullscreenLockV132();
window.showVideoFeedbackV130(
st.nativeFullscreen
? '⛶ Полный экран ВКЛ (системные кнопки скрыты)'
: (st.isLocked ? '🔒 Сними замочек, чтобы вернуть системные кнопки' : '🗗 Обычный экран (системные кнопки включены)')
);
window.wakeVideoHudV130(false);
};

window.toggleVideoLockModeV132 = function(ev) {
if (ev && ev.stopPropagation) ev.stopPropagation();
const st = window._vidStateV130;
st.isLocked = !st.isLocked;
const hud = document.getElementById('v130HudOverlay');
const shield = document.getElementById('v132LockShieldOverlay');
const unlockBtn = document.getElementById('v132FloatingUnlockBtn');

if (st.isLocked) {
if (typeof window.setVideoHudHiddenUnifiedV214 === 'function') window.setVideoHudHiddenUnifiedV214(true, false);
else if (hud) hud.classList.add('hud-hidden-v130');
if (shield) shield.style.display = 'flex';
if (unlockBtn) {
unlockBtn.style.opacity = '1';
clearTimeout(unlockBtn._hideT);
unlockBtn._hideT = setTimeout(() => { unlockBtn.style.opacity = '0'; }, 2200);
}
window.syncNativeFullscreenLockV132();
window.showVideoFeedbackV130('🔒 Управление и системные жесты ЗАБЛОКИРОВАНЫ');
} else {
if (shield) shield.style.display = 'none';
window.syncNativeFullscreenLockV132();
window.wakeVideoHudV130(false);
window.showVideoFeedbackV130(
st.nativeFullscreen
? '🔓 Управление разблокировано (Полный экран активен)'
: '🔓 Разблокировано (системные кнопки возвращены)'
);
}
};

window.enterDesktopOverlayModeV132 = function(ev) {
if (window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
if (ev && ev.stopPropagation) ev.stopPropagation();
if (!window.AndroidBridge || typeof window.AndroidBridge.enterDesktopOverlay !== 'function') {
window.showVideoFeedbackV130('⚠️ Доступно в собранном APK');
return;
}
if (typeof window.AndroidBridge.canDrawOverlays === 'function' && !window.AndroidBridge.canDrawOverlays()) {
window.showVideoFeedbackV130('🔓 Разреши «Поверх других окон» и нажми снова');
window.AndroidBridge.requestOverlayPermission();
return;
}
const st = window._vidStateV130;
const root = document.getElementById('jennyVideoStudioRootV130');
const stage = document.getElementById('jennyVideoStageV130');
if (!root) return;

st.desktopOverlay = true;
st.pipMode = false;
st.rotated90 = false;
stage?.classList.remove('rot90-v130');
root.classList.remove('mode-pip-v130');
root.classList.add('mode-full-v130', 'mode-desktop-v132');
root.style.left = '0';
root.style.top = '0';

const dBtn = document.getElementById('v132BtnDesktop');
if (dBtn) {
dBtn.innerText = '🏠 В плеер';
dBtn.style.borderColor = '#3fb950';
dBtn.style.color = '#3fb950';
}
const resHandle = document.getElementById('v132DesktopResizeHandle');
if (resHandle) resHandle.style.display = 'flex';

window.AndroidBridge.enterDesktopOverlay(310, 195);
window.wakeVideoHudV130(false);
};

window.exitDesktopOverlayModeV132 = function(bringToFront, ev) {
if (ev && ev.stopPropagation) ev.stopPropagation();
const st = window._vidStateV130;
const root = document.getElementById('jennyVideoStudioRootV130');
st.desktopOverlay = false;
if (root) root.classList.remove('mode-desktop-v132');
const dBtn = document.getElementById('v132BtnDesktop');
if (dBtn) {
dBtn.innerText = '📌 На раб. стол';
dBtn.style.borderColor = '#d2a8ff';
dBtn.style.color = '#d2a8ff';
}
const resHandle = document.getElementById('v132DesktopResizeHandle');
if (resHandle) resHandle.style.display = 'none';

if (window.AndroidBridge && typeof window.AndroidBridge.exitDesktopOverlay === 'function') {
try { window.AndroidBridge.exitDesktopOverlay(bringToFront !== false); } catch (e) {}
}
window.syncNativeFullscreenLockV132();
window.wakeVideoHudV130(false);
};

window.toggleDesktopOverlayModeV132 = function(ev) {
if (window._vidStateV130.desktopOverlay) {
window.exitDesktopOverlayModeV132(true, ev);
} else {
window.enterDesktopOverlayModeV132(ev);
}
};

window.upgradeVideoPlayerDOMToV132 = function() {
const root = window.ensureVideoPlayerDOMV130();
const stage = document.getElementById('jennyVideoStageV130');
if (!root || !stage || document.getElementById('v132LockShieldOverlay')) return;

// 1. Добавляем кнопку «📌 На раб. стол» и «⛶ Полный» в верхнюю шапку видеоплеера
const pipBtn = document.getElementById('v130BtnPipToggle');
if (pipBtn && pipBtn.parentElement) {
const deskBtn = document.createElement('button');
deskBtn.type = 'button';
deskBtn.id = 'v132BtnDesktop';
deskBtn.className = 'v130-btn';
deskBtn.style.cssText = 'border-color:#d2a8ff !important;color:#d2a8ff !important;';
deskBtn.innerText = '📌 На раб. стол';
deskBtn.onclick = (e) => window.toggleDesktopOverlayModeV132(e);
pipBtn.parentElement.insertBefore(deskBtn, pipBtn);

const fsBtn = document.createElement('button');
fsBtn.type = 'button';
fsBtn.id = 'v132BtnFullscreen';
fsBtn.className = 'v130-btn v130-hide-in-pip';
fsBtn.innerText = '⛶ Полный';
fsBtn.onclick = (e) => window.toggleVideoNativeFullscreenV132(e);
pipBtn.parentElement.insertBefore(fsBtn, pipBtn);
}

// 2. Добавляем кнопку «🔒 Замок» в нижний ряд управления
const rotBtn = document.getElementById('v130BtnRotate');
if (rotBtn && rotBtn.parentElement) {
const lockBtn = document.createElement('button');
lockBtn.type = 'button';
lockBtn.id = 'v132BtnLock';
lockBtn.className = 'v130-btn';
lockBtn.innerText = '🔒 Замок';
lockBtn.onclick = (e) => window.toggleVideoLockModeV132(e);
rotBtn.parentElement.insertBefore(lockBtn, rotBtn);
}

// 3. Экранный щит Замка (перехватывает все случайные касания и показывает только кнопку разблокировки 🔒)
const shield = document.createElement('div');
shield.id = 'v132LockShieldOverlay';
shield.style.cssText = 'display:none;position:absolute;inset:0;z-index:25;align-items:center;justify-content:flex-end;padding:20px;box-sizing:border-box;background:transparent;';
shield.innerHTML = `<button type="button" id="v132FloatingUnlockBtn" onclick="window.toggleVideoLockModeV132(event)" style="width:52px;height:52px;border-radius:50%;background:rgba(13,17,23,0.9);border:2px solid #e3b341;color:#e3b341;font-size:20px;box-shadow:0 0 20px rgba(0,0,0,0.95);transition:opacity 0.22s ease;opacity:1;">🔒</button>`;
shield.addEventListener('touchend', (e) => {
if (e.target.id === 'v132FloatingUnlockBtn') return;
e.stopPropagation();
const ub = document.getElementById('v132FloatingUnlockBtn');
if (ub) {
ub.style.opacity = (ub.style.opacity === '1') ? '0' : '1';
clearTimeout(ub._hideT);
if (ub.style.opacity === '1') {
ub._hideT = setTimeout(() => { ub.style.opacity = '0'; }, 2400);
}
}
}, { passive: true });
stage.appendChild(shield);

// 4. Уголок изменения размера окна на рабочем столе (↘️)
const resHandle = document.createElement('div');
resHandle.id = 'v132DesktopResizeHandle';
resHandle.style.cssText = 'display:none;position:absolute;right:0;bottom:0;width:32px;height:32px;z-index:30;align-items:flex-end;justify-content:flex-end;padding:4px;font-size:14px;color:#58a6ff;background:linear-gradient(135deg,transparent 50%,rgba(88,166,255,0.35) 50%);cursor:nwse-resize;';
resHandle.innerText = '↘️';
let resizing = false, rsX = 0, rsY = 0, initW = 300, initH = 190;
resHandle.addEventListener('touchstart', (e) => {
if (!e.touches || !e.touches[0]) return;
e.stopPropagation();
resizing = true;
rsX = e.touches[0].screenX;
rsY = e.touches[0].screenY;
initW = window.innerWidth;
initH = window.innerHeight;
}, { passive: true });
resHandle.addEventListener('touchmove', (e) => {
if (!resizing || !e.touches || !e.touches[0]) return;
e.stopPropagation();
const nw = Math.round(initW + (e.touches[0].screenX - rsX));
const nh = Math.round(initH + (e.touches[0].screenY - rsY));
if (window.AndroidBridge && typeof window.AndroidBridge.resizeDesktopOverlay === 'function') {
window.AndroidBridge.resizeDesktopOverlay(nw, nh);
}
}, { passive: true });
resHandle.addEventListener('touchend', (e) => { e.stopPropagation(); resizing = false; }, { passive: true });
stage.appendChild(resHandle);

// 5. Перетаскивание окна по рабочему столу Android пальцем (по screenX/screenY)
let deskDragging = false, lastScrX = 0, lastScrY = 0, deskMovedPx = 0;
stage.addEventListener('touchstart', (e) => {
const st = window._vidStateV130;
if (!st.desktopOverlay || st.isLocked || !e.touches || e.touches.length !== 1) return;
if (e.target.closest('button') || e.target.closest('input') || e.target.id === 'v132DesktopResizeHandle') return;
deskDragging = true;
deskMovedPx = 0;
lastScrX = e.touches[0].screenX;
lastScrY = e.touches[0].screenY;
}, { passive: true });

stage.addEventListener('touchmove', (e) => {
if (!deskDragging || !window._vidStateV130.desktopOverlay || !e.touches || e.touches.length !== 1) return;
const curX = e.touches[0].screenX;
const curY = e.touches[0].screenY;
const dx = Math.round(curX - lastScrX);
const dy = Math.round(curY - lastScrY);
deskMovedPx += Math.hypot(dx, dy);
if (deskMovedPx > 6 && window.AndroidBridge && typeof window.AndroidBridge.moveDesktopOverlay === 'function') {
window.AndroidBridge.moveDesktopOverlay(dx, dy);
lastScrX = curX;
lastScrY = curY;
}
}, { passive: true });

stage.addEventListener('touchend', () => {
deskDragging = false;
}, { passive: true });
};

const _origOpenVidV131 = window.openJennyVideoPlayerV130;
window.openJennyVideoPlayerV130 = function(streamUrl, titleStr, opts) {
window.upgradeVideoPlayerDOMToV132();
const r = _origOpenVidV131.apply(this, arguments);
window.syncNativeFullscreenLockV132();
return r;
};

const _origCloseVidV131 = window.closeVideoPlayerV130;
window.closeVideoPlayerV130 = function(ev) {
if (window._vidStateV130.desktopOverlay) {
window.exitDesktopOverlayModeV132(false);
}
window._vidStateV130.nativeFullscreen = false;
window._vidStateV130.isLocked = false;
const shield = document.getElementById('v132LockShieldOverlay');
if (shield) shield.style.display = 'none';
window.syncNativeFullscreenLockV132();
return _origCloseVidV131.apply(this, arguments);
};

setTimeout(window.upgradeVideoPlayerDOMToV132, 350);

// === 🛠️🎬 JENNY V132.1: AVI AUTO-TRANSCODE, PLAY/PAUSE STATE FIX & DELAYED RAM START ===
window._vidPlayIntentV132 = false;
window._vidIsBufferingV132 = false;

window.syncVideoPlayBtnIconV132 = function() {
const vid = document.getElementById('jennyVideoElV130');
const playBtn = document.getElementById('v130CenterPlayBtn');
if (!playBtn || !vid) return;
const vd = window.videoDeckV131 || {};
if (window._vidIsBufferingV132 && window._vidPlayIntentV132) {
playBtn.innerText = '⏳';
return;
}
const isActuallyPlaying = (!vid.paused && !vid.ended && vid.readyState >= 2) || Boolean(vd.isReversed && vd.isStudioPlaying);
playBtn.innerText = (window._vidPlayIntentV132 && isActuallyPlaying) ? '⏸' : '▶';
};

window.switchVideoToFfmpegRemuxV130 = function(ev, forceTranscodeVideo) {
if (ev && window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
if (ev && ev.stopPropagation) ev.stopPropagation();
const st = window._vidStateV130;
const vid = document.getElementById('jennyVideoElV130');
if (!vid || !st.currentUrl) return;
const curSec = (vid.currentTime || 0) + (st.remuxBaseOffset || 0);
st.usingRemux = true;
st.remuxBaseOffset = curSec;
window._vidPlayIntentV132 = true;
window._vidIsBufferingV132 = true;
window.syncVideoPlayBtnIconV132();

const tcFlag = (forceTranscodeVideo || /\.avi$/i.test(st.currentTitle)) ? '1' : '0';
const remuxUrl = `/api/video/live_remux?src=${encodeURIComponent(st.currentUrl)}&start=${curSec.toFixed(1)}&transcode=${tcFlag}&t=${Date.now()}`;
vid.src = remuxUrl;
vid.play().catch(() => {});
window.showVideoFeedbackV130(tcFlag === '1' ? '🛠️ Потоковый декодер FFmpeg (AVI ➔ MP4)' : '🛠️ Потоковый аудио-декодер FFmpeg (AAC)');
window.wakeVideoHudV130(false);
};

window.toggleVideoPlayPauseV130 = function(ev) {
if (ev && window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
if (ev && ev.stopPropagation) ev.stopPropagation();
const vid = document.getElementById('jennyVideoElV130');
const st = window._vidStateV130;
const vd = window.videoDeckV131;
if (!vid) return;

// Переключаем по нашему флагу намерения _vidPlayIntentV132, чтобы кнопка НИКОГДА не залипала на ⏸!
if (window._vidPlayIntentV132) {
window._vidPlayIntentV132 = false;
window._vidIsBufferingV132 = false;
st.userPaused = true;
if (vd.horizonTimer) { clearTimeout(vd.horizonTimer); vd.horizonTimer = null; }
if (vd.revFrameTimer) { clearInterval(vd.revFrameTimer); vd.revFrameTimer = null; }
if (vd.sourceNode) {
vd.sourceNode.onended = null;
try { vd.sourceNode.stop(); } catch (e) {}
try { vd.sourceNode.disconnect(); } catch (e) {}
vd.sourceNode = null;
}
vd.isStudioPlaying = false;
try { vid.pause(); } catch (e) {}
window.syncVideoPlayBtnIconV132();
window.showVideoFeedbackV130('⏸ Пауза');
} else {
window._vidPlayIntentV132 = true;
window._vidIsBufferingV132 = true;
st.userPaused = false;
window.initVideoDeckAudioV131();
window.syncVideoPlayBtnIconV132();
if (!vd.isReversed) {
const p = vid.play();
if (p && typeof p.catch === 'function') {
p.catch(() => {
// Если браузер не смог запустить .avi/.mkv напрямую — автоматически включаем потоковый FFmpeg!
if (!st.usingRemux) {
window.switchVideoToFfmpegRemuxV130(null, true);
} else {
window._vidPlayIntentV132 = false;
window._vidIsBufferingV132 = false;
window.syncVideoPlayBtnIconV132();
}
});
}
}
window.syncVideoRamEngineV131(false);
}
window.wakeVideoHudV130(false);
};

window.openJennyVideoPlayerV130 = function(streamUrl, titleStr, opts) {
opts = opts || {};
window.upgradeVideoPlayerDOMToV132();
const root = window.ensureVideoPlayerDOMV130();
const vid = document.getElementById('jennyVideoElV130');
const st = window._vidStateV130;
const vd = window.videoDeckV131;

window.stopAllExternalStreamsV97();

// Если этот файл торрента уже на 100% скачан на диск — берем готовый локальный файл для мгновенного старта!
let effectiveUrl = streamUrl;
if (opts.torHash && opts.torFileIdx !== undefined) {
const dTor = (window._torLiveDaemonSnapV128 || []).find(t => t.hash === opts.torHash);
const dFile = dTor && (dTor.files || []).find(f => Number(f.index) === Number(opts.torFileIdx));
const job = window._torMapV112 && window._torMapV112[opts.torHash];
const jSt = job && job.fileStatusMap && job.fileStatusMap[Number(opts.torFileIdx)];
const importedName = (jSt && jSt.xflac_file) || (dFile && dFile.xflac_file);
if (importedName) {
effectiveUrl = '/api/media/' + encodeURIComponent(importedName);
}
}

st.active = true;
st.userPaused = false;
st.currentUrl = effectiveUrl;
st.currentTitle = titleStr || 'Видео';
st.torHash = opts.torHash || '';
st.torFileIdx = (opts.torFileIdx !== undefined) ? Number(opts.torFileIdx) : -1;
st.usingRemux = false;
st.remuxBaseOffset = 0;
vd.isReversed = false;
vd.ramDecodeSession++;
if (vd.pieceAbortCtrl) { try { vd.pieceAbortCtrl.abort(); } catch (e) {} }
vd.studioBuffer = null;
window._vidPlayIntentV132 = true;
window._vidIsBufferingV132 = true;
window.updateVideoRevBtnUIV131();
window.syncVideoPlayBtnIconV132();

document.getElementById('v130VideoTitle').innerText = st.currentTitle;
const subEl = document.getElementById('v130VideoSubTelemetry');
if (subEl) {
subEl.innerText = st.torHash ? '🧲 Буферизация видеопотока...' : '📁 Открытие видеофайла...';
}

const btnHub = document.getElementById('v130BtnTorHub');
const btnSave = document.getElementById('v130BtnSaveVideo');
if (btnHub) btnHub.style.display = st.torHash ? 'inline-flex' : 'none';
if (btnSave) btnSave.style.display = st.torHash ? 'inline-flex' : 'none';

if (st.torHash && st.torFileIdx >= 0) {
fetch('/api/torrent/control', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ hash: st.torHash, action: 'boost_file', file_index: st.torFileIdx })
}).catch(() => {});
}

root.style.display = 'flex';
window.initVideoDeckAudioV131();
window.syncNativeFullscreenLockV132();

// Привязываем однократные слушатели реального старта видео и авто-ремукса при ошибке кодека (.avi / .mkv)
if (!vid._v132EventsHooked) {
vid._v132EventsHooked = true;
vid.addEventListener('playing', () => {
window._vidIsBufferingV132 = false;
window._vidPlayIntentV132 = true;
window.syncVideoPlayBtnIconV132();
window.wakeVideoHudV130(false);
// Запускаем фоновую подкачку RAM-кусков Деки Б ТОЛЬКО через 1.5с после реального старта картинки!
clearTimeout(vid._ramStartDelayT);
vid._ramStartDelayT = setTimeout(() => {
if (window._vidStateV130.active && !window._vidStateV130.userPaused && !window.videoDeckV131.studioBuffer) {
window.decodeVideoToRamV131(window._vidStateV130.currentUrl, window._vidStateV130.currentTitle);
}
}, 1500);
});
vid.addEventListener('waiting', () => {
if (window._vidPlayIntentV132) {
window._vidIsBufferingV132 = true;
window.syncVideoPlayBtnIconV132();
}
});
vid.addEventListener('pause', () => {
if (!window._vidStateV130._internalRevPause) {
window._vidIsBufferingV132 = false;
window.syncVideoPlayBtnIconV132();
}
});
vid.addEventListener('error', () => {
if (window._vidStateV130.active && !window._vidStateV130.usingRemux) {
window.switchVideoToFfmpegRemuxV130(null, true);
}
});
}

// Если файл .avi или это недокачанный .mkv/.webm/.ts торрент-поток — сразу запускаем через потоковый FFmpeg live_remux без двойного старта!
const isTorMkvOrAvi = Boolean(st.torHash && /\.(mkv|avi|webm|ts|m2ts|wmv|flv)(\?|$)/i.test(String(st.currentTitle || '') + ' ' + String(effectiveUrl || '')));
if (/\.avi$/i.test(st.currentTitle) || isTorMkvOrAvi) {
window.switchVideoToFfmpegRemuxV130(null, /\.avi$/i.test(st.currentTitle));
} else {
vid.src = effectiveUrl;
vid.playbackRate = vd.speed || 1.0;
vid.play().catch(() => {});
}
window.wakeVideoHudV130(false);
};

// Единое автоскрытие HUD и плавающих таблеток (основной плеер + мини-плеер PiP) V214
window.wakeVideoHudV130 = function(fromTapWake) {
if (typeof window.setVideoHudHiddenUnifiedV214 === 'function') {
window.setVideoHudHiddenUnifiedV214(false, Boolean(fromTapWake));
}
};

// === 🚀🤏 JENNY V133: AUTO HOME OVERLAY, FREE PINCH-RESIZE ANYWHERE & NO BRIGHT/VOL GESTURES ===
window.onDesktopOverlayStateChangedV133 = function(isOverlay) {
const st = window._vidStateV130;
const root = document.getElementById('jennyVideoStudioRootV130');
const stage = document.getElementById('jennyVideoStageV130');
const pipBtn = document.getElementById('v130BtnPipToggle');
if (!root) return;

st.desktopOverlay = Boolean(isOverlay);
if (isOverlay) {
st.pipMode = false;
st.rotated90 = false;
stage?.classList.remove('rot90-v130');
root.classList.remove('mode-pip-v130');
root.classList.add('mode-full-v130', 'mode-desktop-v132');
root.style.left = '0';
root.style.top = '0';
if (pipBtn) pipBtn.innerText = '⛶ Развернуть';
} else {
root.classList.remove('mode-desktop-v132');
if (pipBtn) pipBtn.innerText = st.pipMode ? '⛶ Развернуть' : '❐ Мини';
}
};

// Если мы на рабочем столе и нажали «⛶ Развернуть» — возвращаемся в полное приложение!
const _origTogglePipV132 = window.toggleVideoPipModeV130;
window.toggleVideoPipModeV130 = function(ev) {
if (window._vidStateV130 && window._vidStateV130.desktopOverlay) {
if (ev && ev.stopPropagation) ev.stopPropagation();
window.exitDesktopOverlayModeV132(true, ev);
return;
}
return _origTogglePipV132.apply(this, arguments);
};

// Убираем ненужную кнопку «📌 На раб. стол» и угловой ползунок ↘️
window.cleanUpDesktopButtonsV133 = function() {
const dBtn = document.getElementById('v132BtnDesktop');
if (dBtn) dBtn.remove();
const rHandle = document.getElementById('v132DesktopResizeHandle');
if (rHandle) rHandle.remove();
if (!document.getElementById('jennyV133OverlayCompactStyle')) {
const st = document.createElement('style');
st.id = 'jennyV133OverlayCompactStyle';
st.textContent = `
#jennyVideoStudioRootV130.mode-desktop-v132 .v130-hide-in-pip { display: none !important; }
`;
document.head.appendChild(st);
}
};

const _origOpenVidV132 = window.openJennyVideoPlayerV130;
window.openJennyVideoPlayerV130 = function(streamUrl, titleStr, opts) {
const r = _origOpenVidV132.apply(this, arguments);
window.cleanUpDesktopButtonsV133();
window.installCleanStageTouchV133();
if (window.AndroidBridge) {
try {
window.AndroidBridge.setVideoActiveState(true);
/* V143: disabled auto overlay permission redirect on video start */
} catch (e) {}
}
return r;
};

const _origCloseVidV132 = window.closeVideoPlayerV130;
window.closeVideoPlayerV130 = function(ev) {
if (window.AndroidBridge && typeof window.AndroidBridge.setVideoActiveState === 'function') {
try { window.AndroidBridge.setVideoActiveState(false); } catch (e) {}
}
return _origCloseVidV132.apply(this, arguments);
};

setTimeout(() => {
window.cleanUpDesktopButtonsV133();
window.installCleanStageTouchV133();
}, 400);

// === 🧠🎬 JENNY V134: FULL VIDEO RAM UNPACK (3X PARALLEL) & AUTO VIDEO LIBRARY SYNC ===

// 1. Автоподхват всех скачанных торрент-видео (включая «Матрицу») прямо во вкладку «🎬 Видео»!
var syncDiscoveredVideosIntoPlaylistV134 = window.syncDiscoveredVideosIntoPlaylistV134 = window.syncDiscoveredVideosIntoPlaylistV134 || function(){};

setTimeout(function() { if (window.runIsolatedDeckB) window.runIsolatedDeckB(function() { window.syncDiscoveredVideosIntoPlaylistV134(false); }); }, 950);

// 2. Полная и агрессивная распаковка ВСЕЙ аудиодорожки видео в RAM (в 3 параллельных потока FFmpeg без пауз!)
window.decodeVideoToRamV131 = async function(streamUrl, titleStr) {
window.initVideoDeckAudioV131();
const vd = window.videoDeckV131;
const mySess = ++vd.ramDecodeSession;
if (vd.pieceAbortCtrl) { try { vd.pieceAbortCtrl.abort(); } catch (e) {} }
vd.studioBuffer = null;

const vid = document.getElementById('jennyVideoElV130');
let dur = 0;
try {
const mr = await fetch(`/api/video/pcm_meta?src=${encodeURIComponent(streamUrl)}`);
if (mr.ok) { const md = await mr.json(); dur = parseFloat(md.duration) || 0; }
} catch (e) {}

if (!dur && vid) {
for (let w = 0; w < 30; w++) {
if (mySess !== vd.ramDecodeSession) return null;
if (isFinite(vid.duration) && vid.duration > 0) { dur = vid.duration; break; }
await new Promise(r => setTimeout(r, 120));
}
}
if (dur <= 0 || mySess !== vd.ramDecodeSession) return null;

// Выбираем максимальную частоту дискретизации, которая целиком помещается в Float32 AudioBuffer
const srCandidates = (dur > 5400) ? [32000, 24000] : [44100, 32000, 24000];
let sr = srCandidates[0], totalFrames = 0, audioBuf = null;
for (const candSr of srCandidates) {
try {
sr = candSr;
totalFrames = Math.floor(dur * sr);
audioBuf = vd.ctx.createBuffer(2, totalFrames, sr);
if (audioBuf) break;
} catch (e) {}
}
if (!audioBuf || mySess !== vd.ramDecodeSession) return null;

const chL = audioBuf.getChannelData(0), chR = audioBuf.getChannelData(1);
const PIECE_SEC = 60; // Крупные 60-секундные блоки для быстрой полной распаковки в ОЗУ
const numPieces = Math.max(1, Math.ceil(dur / PIECE_SEC));
const pieceMap = new Uint8Array(numPieces); // 0 = пусто, 1 = в работе, 2 = готово в RAM
const failCounts = new Uint8Array(numPieces);

audioBuf._pieceSecV72 = PIECE_SEC;
audioBuf._pieceMapV72 = pieceMap;
audioBuf._loadedCountV72 = 0;
audioBuf._allPiecesLoadedV72 = false;
audioBuf._trueDurationV72 = dur;
audioBuf._ramTotalMbV134 = Math.round((totalFrames * 8) / (1024 * 1024));
vd.studioBuffer = audioBuf;

const fetchVideoPiece = async (pIdx) => {
if (pIdx < 0 || pIdx >= numPieces || pieceMap[pIdx] === 2) return true;
pieceMap[pIdx] = 1;
const stSec = pIdx * PIECE_SEC;
const dSec = Math.min(PIECE_SEC, dur - stSec);
try {
const u = `/api/video/pcm_chunk?src=${encodeURIComponent(streamUrl)}&start=${stSec}&dur=${dSec}&sr=${sr}`;
const res = await fetch(u);
if (!res.ok) { pieceMap[pIdx] = 0; return false; }
const ab = await res.arrayBuffer();
const frames = Math.floor(ab.byteLength / 8);
if (frames <= 0) { pieceMap[pIdx] = 0; return false; }
const startFrame = Math.min(totalFrames, Math.floor(stSec * sr));
const maxCopy = Math.min(frames, totalFrames - startFrame);
if (maxCopy > 0) {
const leftArr = new Float32Array(ab, 0, frames);
const rightArr = new Float32Array(ab, frames * 4, frames);
chL.set(leftArr.subarray(0, maxCopy), startFrame);
chR.set(rightArr.subarray(0, maxCopy), startFrame);
}
pieceMap[pIdx] = 2;
audioBuf._loadedCountV72++;
if (audioBuf._loadedCountV72 === 1 && vd.config && vd.config.opt_autoRms) {
window.computeBufferAutoGainDeckB(audioBuf, vd.config.val_autoRms);
window.buildVideoAudioGraphV131();
}
return true;
} catch (e) {
pieceMap[pIdx] = 0;
return false;
}
};

// Выбирает следующий кусок: сначала под курсором воспроизведения, затем подряд весь фильм до 100%
const pickNextPieceIdx = () => {
const curSec = (vid && isFinite(vid.currentTime)) ? vid.currentTime : 0;
const curPiece = Math.max(0, Math.min(numPieces - 1, Math.floor(curSec / PIECE_SEC)));
const stepDir = vd.isReversed ? -1 : 1;
for (let look = 0; look < 3; look++) {
const cand = curPiece + look * stepDir;
if (cand >= 0 && cand < numPieces && pieceMap[cand] === 0 && failCounts[cand] < 4) {
return { idx: cand, urgent: look <= 1 };
}
}
for (let offset = 0; offset < numPieces; offset++) {
const cand = (curPiece + offset) % numPieces;
if (pieceMap[cand] === 0 && failCounts[cand] < 4) {
return { idx: cand, urgent: false };
}
}
return null;
};

// Запускаем 3 параллельных воркера для максимальной скорости распаковки всего фильма в ОЗУ!
const workerLoop = async () => {
while (mySess === vd.ramDecodeSession && window._vidStateV130.active) {
const task = pickNextPieceIdx();
if (!task) break;
const ok = await fetchVideoPiece(task.idx);
if (mySess !== vd.ramDecodeSession) return;
if (ok) {
if (task.urgent) window.syncVideoRamEngineV131(false);
} else {
failCounts[task.idx]++;
await new Promise(r => setTimeout(r, 300));
}
}
};

await Promise.all([workerLoop(), workerLoop(), workerLoop()]);
if (mySess === vd.ramDecodeSession && audioBuf._loadedCountV72 >= numPieces) {
audioBuf._allPiecesLoadedV72 = true;
window.syncVideoRamEngineV131(false);
window.showVideoFeedbackV130(`🧠 Весь звук видео в RAM: 100% (${audioBuf._ramTotalMbV134} МБ) 🚀`);
}
return audioBuf;
};

// === ⏱️🎬 JENNY V135: VIDEO TIME RESUME, MAIN BAR MINI-WINDOW BUTTON & COLLAPSIBLE BOTTOM PANEL ===

window.getVideoResumeKeyV135 = function(titleStr, streamUrl) {
const raw = String(titleStr || streamUrl || '').split('?')[0].trim().toLowerCase();
return raw || 'default_video';
};

window.loadVideoResumeMapV135 = function() {
try {
return JSON.parse(localStorage.getItem('ytm_video_resume_map_v135') || '{}') || {};
} catch (e) {
return {};
}
};

window.saveCurrentVideoProgressV135 = function() {
const st = window._vidStateV130;
const vid = document.getElementById('jennyVideoElV130');
if (!st || !st.currentUrl || !vid) return;
const curSec = (vid.currentTime || 0) + (st.remuxBaseOffset || 0);
const durSec = isFinite(vid.duration) && vid.duration > 0 ? (vid.duration + (st.remuxBaseOffset || 0)) : 0;
const key = window.getVideoResumeKeyV135(st.currentTitle, st.currentUrl);
const map = window.loadVideoResumeMapV135();
const prev = map[key] || {};
const saveSec = curSec > 2.5 ? curSec : (prev.time || 0);

const entry = {
key: key,
time: saveSec,
dur: durSec || prev.dur || 0,
url: st.currentUrl,
title: st.currentTitle || 'Видео',
torHash: st.torHash || '',
torFileIdx: st.torFileIdx !== undefined ? st.torFileIdx : -1,
pipMode: Boolean(st.pipMode),
updatedAt: Date.now()
};
map[key] = entry;
try {
localStorage.setItem('ytm_video_resume_map_v135', JSON.stringify(map));
localStorage.setItem('ytm_last_video_v135', JSON.stringify(entry));
} catch (e) {}
window.updateMainMiniVidBtnUIV135();
};

// 1. Кнопка скрытия/показа нижней панели кнопок внутри окна видеоплеера
window.toggleVideoBottomBarV135 = function(ev) {
if (ev && window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
if (ev && ev.stopPropagation) ev.stopPropagation();
const row = document.getElementById('v135BottomToolsRow');
const btn = document.getElementById('v135BtnToggleBottomBar');
if (!row) return;
const isHidden = row.getAttribute('data-collapsed-v135') === '1';
const nextHidden = !isHidden;
row.setAttribute('data-collapsed-v135', nextHidden ? '1' : '0');
row.style.setProperty('display', nextHidden ? 'none' : 'flex', 'important');
try { localStorage.setItem('ytm_vid_bottom_collapsed_v135', nextHidden ? '1' : '0'); } catch (e) {}
if (btn) {
btn.innerText = nextHidden ? '▴ Опции' : '▾ Скрыть';
btn.style.borderColor = nextHidden ? '#58a6ff' : 'rgba(255,255,255,0.25)';
btn.style.color = nextHidden ? '#58a6ff' : '#e6edf3';
}
window.wakeVideoHudV130(false);
};

// 2. Монтируем кнопку скрытия нижней панели в видеоплеере и кнопку «🎬 Мини» в главном окне над полосой перемотки
window.mountV135VideoControlsAndMainBtn = function() {
const root = window.ensureVideoPlayerDOMV130 ? window.ensureVideoPlayerDOMV130() : null;
if (root) {
const seek = document.getElementById('v130SeekSlider');
const seekRow = seek ? seek.parentElement : null;
const bottomBar = seekRow ? seekRow.parentElement : null;
if (seekRow && bottomBar) {
const toolsRow = bottomBar.children[1];
if (toolsRow && !toolsRow.id) {
toolsRow.id = 'v135BottomToolsRow';
const savedCollapsed = localStorage.getItem('ytm_vid_bottom_collapsed_v135') === '1';
if (savedCollapsed) {
toolsRow.setAttribute('data-collapsed-v135', '1');
toolsRow.style.setProperty('display', 'none', 'important');
}
}
if (!document.getElementById('v135BtnToggleBottomBar')) {
const tBtn = document.createElement('button');
tBtn.type = 'button';
tBtn.id = 'v135BtnToggleBottomBar';
tBtn.className = 'v130-btn v130-hide-in-pip';
const isCol = toolsRow && toolsRow.getAttribute('data-collapsed-v135') === '1';
tBtn.innerText = isCol ? '▴ Опции' : '▾ Скрыть';
tBtn.style.cssText = 'padding:3px 7px !important;font-size:10px !important;margin-left:4px;';
tBtn.onclick = (e) => window.toggleVideoBottomBarV135(e);
seekRow.appendChild(tBtn);
}
}
}

// Кнопка «🎬 Мини» в главном окне плеера (между RU/EN и 🔄 95 над полосой перемотки)
const langBtn = document.getElementById('langBtn');
const topCtrlBar = langBtn ? langBtn.parentElement : null;
if (topCtrlBar && !document.getElementById('jennyMainMiniVidBtnV135')) {
const mBtn = document.createElement('button');
mBtn.type = 'button';
mBtn.id = 'jennyMainMiniVidBtnV135';
mBtn.onclick = (e) => window.toggleMainPlayerMiniVideoV135(e);
mBtn.style.cssText = 'padding:5px 10px;font-size:11.5px;font-weight:900;border-radius:16px;background:linear-gradient(135deg,rgba(163,113,247,0.22),rgba(88,166,255,0.22));border:1.5px solid #a371f7;color:#e6edf3;display:inline-flex;align-items:center;gap:4px;box-shadow:0 0 12px rgba(163,113,247,0.28);margin-right:auto;margin-left:6px;';
mBtn.innerHTML = '🎬 Мини';
if (langBtn.nextSibling) {
topCtrlBar.insertBefore(mBtn, langBtn.nextSibling);
} else {
topCtrlBar.appendChild(mBtn);
}
}
window.updateMainMiniVidBtnUIV135();
};

window.updateMainMiniVidBtnUIV135 = function() {
const btn = document.getElementById('jennyMainMiniVidBtnV135');
if (!btn) return;
const st = window._vidStateV130 || {};
if (st.active && st.pipMode) {
btn.innerHTML = '🎬 Скрыть мини';
btn.style.borderColor = '#3fb950';
btn.style.color = '#3fb950';
} else if (st.active && !st.pipMode) {
btn.innerHTML = '❐ В мини-окно';
btn.style.borderColor = '#58a6ff';
btn.style.color = '#58a6ff';
} else {
btn.innerHTML = '🎬 Мини';
btn.style.borderColor = '#a371f7';
btn.style.color = '#e6edf3';
}
};

// 3. Действие по нажатию на кнопку «🎬 Мини» в главном окне плеера
window.toggleMainPlayerMiniVideoV135 = function(ev) {
if (ev && ev.stopPropagation) ev.stopPropagation();
const st = window._vidStateV130 || {};
const root = document.getElementById('jennyVideoStudioRootV130');

if (st.active && root && root.style.display !== 'none') {
if (!st.pipMode) {
window.toggleVideoPipModeV130();
window.updateMainMiniVidBtnUIV135();
return;
} else {
window.saveCurrentVideoProgressV135();
window.closeVideoPlayerV130();
window.updateMainMiniVidBtnUIV135();
return;
}
}

// Если видео сейчас закрыто — достаем последнее смотревшееся видео (или первое из вкладки Видео) и открываем сразу в режиме ❐ Мини!
let lastVid = null;
try { lastVid = JSON.parse(localStorage.getItem('ytm_last_video_v135') || 'null'); } catch (e) {}

if (!lastVid || !lastVid.url) {
const allTracks = (window.lastData && window.lastData.all_tracks) || [];
const firstVid = allTracks.find(fn => window.isVideoFileNameV130 && window.isVideoFileNameV130(fn));
if (firstVid) {
lastVid = { url: '/api/media/' + encodeURIComponent(firstVid), title: firstVid, torHash: '', torFileIdx: -1 };
}
}

if (!lastVid || !lastVid.url) {
if (typeof window.showToast === 'function') {
window.showToast('🎬 Выбери любое видео во вкладке «Видео» или в Торрентах!');
}
return;
}

window.openJennyVideoPlayerV130(lastVid.url, lastVid.title, {
torHash: lastVid.torHash || '',
torFileIdx: lastVid.torFileIdx !== undefined ? lastVid.torFileIdx : -1,
startInPipV135: true
});
};

// 4. При возврате с рабочего стола в приложение автоматически переводим активное видео в аккуратное внутреннее мини-окно
window.onDesktopOverlayStateChangedV133 = function(isOverlay) {
const st = window._vidStateV130;
const root = document.getElementById('jennyVideoStudioRootV130');
const stage = document.getElementById('jennyVideoStageV130');
const pipBtn = document.getElementById('v130BtnPipToggle');
if (!root || !st) return;

st.desktopOverlay = Boolean(isOverlay);
if (isOverlay) {
st.pipMode = false;
st.rotated90 = false;
stage?.classList.remove('rot90-v130');
root.classList.remove('mode-pip-v130');
root.classList.add('mode-full-v130', 'mode-desktop-v132');
root.style.left = '0';
root.style.top = '0';
if (pipBtn) pipBtn.innerText = '⛶ Развернуть';
} else {
root.classList.remove('mode-desktop-v132');
if (st.active && !st._expandingToFullV135) {
st.pipMode = true;
root.classList.remove('mode-full-v130');
root.classList.add('mode-pip-v130');
if (!root._hasCustomPipPosV130) {
root.style.left = Math.max(8, window.innerWidth - 290) + 'px';
root.style.top = '74px';
}
if (pipBtn) pipBtn.innerText = '⛶ Развернуть';
} else {
st._expandingToFullV135 = false;
if (pipBtn) pipBtn.innerText = st.pipMode ? '⛶ Развернуть' : '❐ Мини';
}
window.syncNativeFullscreenLockV132();
window.updateMainMiniVidBtnUIV135();
}
};

// 5. Обновляем openJennyVideoPlayerV130 и closeVideoPlayerV130 для автосохранения и восстановления секунды!
const _origOpenVidV134 = window.openJennyVideoPlayerV130;
window.openJennyVideoPlayerV130 = function(streamUrl, titleStr, opts) {
opts = opts || {};
window.mountV135VideoControlsAndMainBtn();

const map = window.loadVideoResumeMapV135();
const key = window.getVideoResumeKeyV135(titleStr, streamUrl);
const savedEntry = map[key];
const resumeSec = (savedEntry && savedEntry.time > 3 && (!savedEntry.dur || savedEntry.time < savedEntry.dur - 8))
? Number(savedEntry.time)
: 0;

const r = _origOpenVidV134.apply(this, arguments);
const st = window._vidStateV130;
const vid = document.getElementById('jennyVideoElV130');

if (opts.startInPipV135 && !st.pipMode) {
window.toggleVideoPipModeV130();
}

if (vid && !vid._v135ResumeHooked) {
vid._v135ResumeHooked = true;
let lastSaveTs = 0;
vid.addEventListener('timeupdate', () => {
const now = Date.now();
if (now - lastSaveTs > 1500) {
lastSaveTs = now;
window.saveCurrentVideoProgressV135();
}
});
vid.addEventListener('pause', () => {
window.saveCurrentVideoProgressV135();
});
vid.addEventListener('loadedmetadata', () => {
if (vid._pendingResumeSecV135 && vid._pendingResumeSecV135 > 0 && !window._vidStateV130.usingRemux) {
const target = vid._pendingResumeSecV135;
vid._pendingResumeSecV135 = 0;
try { vid.currentTime = target; } catch (e) {}
window.syncVideoRamEngineV131(false);
}
});
}

if (resumeSec > 0 && vid) {
const fmtTime = window.fmtKhSecV90 ? window.fmtKhSecV90(resumeSec) : `${Math.floor(resumeSec)}с`;
if (st.usingRemux || /\.avi$/i.test(st.currentTitle)) {
st.usingRemux = true;
st.remuxBaseOffset = resumeSec;
const tcFlag = /\.avi$/i.test(st.currentTitle) ? '1' : '0';
vid.src = `/api/video/live_remux?src=${encodeURIComponent(st.currentUrl)}&start=${resumeSec.toFixed(1)}&transcode=${tcFlag}&t=${Date.now()}`;
vid.play().catch(() => {});
} else {
vid._pendingResumeSecV135 = resumeSec;
try { vid.currentTime = resumeSec; } catch (e) {}
}
setTimeout(() => {
window.showVideoFeedbackV130(`⏪ Продолжение с ${fmtTime}`);
}, 350);
}

window.saveCurrentVideoProgressV135();
window.updateMainMiniVidBtnUIV135();
return r;
};

const _origCloseVidV134 = window.closeVideoPlayerV130;
window.closeVideoPlayerV130 = function(ev) {
window.saveCurrentVideoProgressV135();
const r = _origCloseVidV134.apply(this, arguments);
window.updateMainMiniVidBtnUIV135();
return r;
};

const _origPipToggleV134 = window.toggleVideoPipModeV130;
window.toggleVideoPipModeV130 = function(ev) {
if (window._vidStateV130 && window._vidStateV130.desktopOverlay) {
window._vidStateV130._expandingToFullV135 = true;
}
const r = _origPipToggleV134.apply(this, arguments);
window.saveCurrentVideoProgressV135();
window.updateMainMiniVidBtnUIV135();
return r;
};

window.addEventListener('beforeunload', () => {
window.saveCurrentVideoProgressV135();
});

setTimeout(window.mountV135VideoControlsAndMainBtn, 450);
setInterval(window.mountV135VideoControlsAndMainBtn, 3000);

// === 🎬 JENNY V136: PERSISTENT VIDEO LIST MERGE & TAB COUNTER ===
// === 📁 JENNY V137: SEPARATE VIDEO DIRECTORY (/storage/emulated/0/JennyVideo) & CLEAN MUSIC TABS ===
window._dedicatedVideoListV137 = [];
window._dedicatedVideoMetaMapV137 = {};
window._dedicatedVideoDirPathV137 = '/storage/emulated/0/JennyVideo';

window.syncDiscoveredVideosIntoPlaylistV134 = async function(forceScan) {
try {
const res = await fetch('/api/video/discovered_list' + (forceScan ? '?force=1' : ''));
if (res.ok) {
const data = await res.json();
if (data.video_dir) window._dedicatedVideoDirPathV137 = data.video_dir;
const items = data.items || [];
const nextMap = {};
items.forEach(it => { if (it && it.name) nextMap[it.name] = it; });
window._dedicatedVideoMetaMapV137 = nextMap;
}
} catch (e) {}

const mergedItems = window.collectClientTorrentVideosV137();
window._dedicatedVideoListV137 = mergedItems.map(x => x.name).sort();

// Очищаем музыкальный массив all_tracks от видеофайлов, чтобы они НЕ мешались во вкладке «🎵 Все»!
if (window.lastData && Array.isArray(window.lastData.all_tracks)) {
window.lastData.all_tracks = window.lastData.all_tracks.filter(fn => !window.isVideoFileNameV130(fn));
}

if (typeof window.mountPlaylistStripDOMV71 === 'function') window.mountPlaylistStripDOMV71();
if (window.activePlaylistTabV71 === 'videos' && typeof window.renderActivePlaylistTracksV71 === 'function') {
window.renderActivePlaylistTracksV71(false);
}
};

setInterval(function() {
    if (window.runIsolatedDeckB) window.runIsolatedDeckB(function() { window.syncDiscoveredVideosIntoPlaylistV134(false); });
    else window.syncDiscoveredVideosIntoPlaylistV134(false);
}, 5003);
setTimeout(function() {
    if (window.runIsolatedDeckB) window.runIsolatedDeckB(function() { window.syncDiscoveredVideosIntoPlaylistV134(true); });
    else window.syncDiscoveredVideosIntoPlaylistV134(true);
}, 520);

// === ➕🎬 JENNY V138: FIX ADD FORMAT BUTTON (NO WEBVIEW PROMPT) & AUTO VIDEO EXTS ===
window.ensureAllVideoFormatsInConfigV138 = function() {
const requiredExts = ['.mp3', '.opus', '.m4a', '.flac', '.wav', '.ogg', '.mp4', '.mkv', '.avi', '.webm', '.mov', '.aac', '.xflac'];
const patchCfg = (cfg) => {
if (!cfg || typeof cfg !== 'object') return;
for (const k of Object.keys(cfg)) {
if (Array.isArray(cfg[k]) && cfg[k].some(x => typeof x === 'string' && x.startsWith('.'))) {
requiredExts.forEach(ext => {
if (!cfg[k].includes(ext)) cfg[k].push(ext);
});
}
}
};
patchCfg(window.appConfig);
patchCfg(window._musicConfigRefV131);
if (window.videoDeckV131 && window.videoDeckV131.config) patchCfg(window.videoDeckV131.config);

// Также проверяем списки форматов в localStorage
for (let i = 0; i < localStorage.length; i++) {
const lk = localStorage.key(i);
if (!lk) continue;
const raw = localStorage.getItem(lk);
if (raw && (raw.includes('".mp3"') || raw.includes('".xflac"'))) {
try {
const parsed = JSON.parse(raw);
if (Array.isArray(parsed)) {
requiredExts.forEach(ext => { if (!parsed.includes(ext)) parsed.push(ext); });
localStorage.setItem(lk, JSON.stringify(parsed));
} else if (parsed && typeof parsed === 'object') {
patchCfg(parsed);
localStorage.setItem(lk, JSON.stringify(parsed));
}
} catch (e) {}
}
}
};

window.ensureAllVideoFormatsInConfigV138();
setTimeout(() => {
window.ensureAllVideoFormatsInConfigV138();
if (typeof window.syncDiscoveredVideosIntoPlaylistV134 === 'function') {
window.syncDiscoveredVideosIntoPlaylistV134(true);
}
}, 400);

/* [split] V143: кусок исходного IIFE (ui_v71.js, строки 11521–11833) → ui_video.js */
;(function() {

// Перехватываем closeVideoPlayerV130 (закрытие видеоплеера крестиком ✖): если видео смотрелось в потоке ▶ без скачивания ⬇️ — чистим кэш потока!
const _origCloseVidV143 = window.closeVideoPlayerV130;
window.closeVideoPlayerV130 = function(ev) {
    const st = window._vidStateV130 || {};
    const tHash = st.torHash;
    const tIdx = st.torFileIdx;
    const r = _origCloseVidV143.apply(this, arguments);
    if (tHash && tIdx >= 0) {
        window._activeStreamSessionV143 = { hash: tHash, fileIdx: tIdx };
        window.cleanupActiveTorrentStreamV143('video_close');
    }
    return r;
};
})();

/* [split] V145: кусок исходного IIFE (ui_v71.js, строки 11870–12008) → ui_video.js */
;(function() {

// 5. Возвращаем на экран мини-окно видеоплеера (PiP), если его утащили за правый/нижний край экрана (00:29 на видео)
window.clampPipVideoInsideScreenV145 = function() {
    const root = document.getElementById('jennyVideoStudioRootV130');
    const st = window._vidStateV130;
    if (!root || !st || !st.active || !st.pipMode || st.desktopOverlay) return;
    const r = root.getBoundingClientRect();
    const W = window.innerWidth || 360;
    const H = window.innerHeight || 740;
    let curL = r.left;
    let curT = r.top;
    const maxL = Math.max(4, W - Math.min(r.width, 280) - 4);
    const maxT = Math.max(4, H - Math.min(r.height, 170) - 4);
    if (curL < 4 || curL > maxL || curT < 4 || curT > maxT) {
        root.style.left = Math.max(4, Math.min(maxL, curL)) + 'px';
        root.style.top = Math.max(4, Math.min(maxT, curT)) + 'px';
    }
};
setInterval(window.clampPipVideoInsideScreenV145, 800);
})();

/* [split] V147: кусок исходного IIFE (ui_v71.js, строки 12011–12234) → ui_video.js */
;(function() {

window.removeDesktopOverlayButtonsFromHudV147 = function() {
    document.getElementById('v132BtnDesktop')?.remove();
    document.getElementById('v146BtnOverlayPerm')?.remove();
};

// 2. Гарантируем, что при авто-переходе на рабочий стол видео продолжает играть без паузы
window.ensureVideoPlayingInOverlayV147 = function() {
    const st = window._vidStateV130 || {};
    const vid = document.getElementById('jennyVideoElV130');
    if (!st.active || !vid) return;
    if (!st.userPaused) {
        window._vidPlayIntentV132 = true;
        if (vid.paused && !(window.videoDeckV131 && window.videoDeckV131.isReversed)) {
            vid.play().catch(() => {});
        }
        if (typeof window.syncVideoRamEngineV131 === 'function') {
            window.syncVideoRamEngineV131(false);
        }
    }
};

// 3. Сохранение полного слепка рабочего состояния (Музыка + Видео + Открытые окна) на случай перезапуска Activity
window.saveLiveWorkspaceSnapshotV146 = function(isPermRedirect) {
    try {
        const aud = document.getElementById('audioPlayer');
        const vid = document.getElementById('jennyVideoElV130');
        const st = window._vidStateV130 || {};
        const vd = window.videoDeckV131 || {};
        const torModal = document.getElementById('jennyTorrentModalV91');
        const torOpen = Boolean(torModal && torModal.style.display !== 'none' && getComputedStyle(torModal).display !== 'none');

        const snap = {
            ts: Date.now(),
            permRedirect: Boolean(isPermRedirect),
            activeTab: window.activePlaylistTabV71 || 'all',
            music: {
                track: window.currentPlayingTrack || '',
                time: (aud && isFinite(aud.currentTime)) ? aud.currentTime : 0,
                paused: aud ? Boolean(aud.paused && !window.isStudioPlaying) : true,
                speed: (typeof window.getActiveTargetSpeedV59 === 'function') ? window.getActiveTargetSpeedV59() : 1.0,
                rev: Boolean(window.isReversed)
            },
            video: {
                active: Boolean(st.active),
                url: st.currentUrl || '',
                title: st.currentTitle || '',
                time: (vid && isFinite(vid.currentTime)) ? ((vid.currentTime || 0) + (st.remuxBaseOffset || 0)) : 0,
                paused: Boolean(st.userPaused),
                pipMode: Boolean(st.pipMode),
                torHash: st.torHash || '',
                torFileIdx: (st.torFileIdx !== undefined) ? st.torFileIdx : -1,
                speed: vd.speed || 1.0
            },
            torrentModal: {
                open: torOpen,
                query: document.getElementById('torMagnetInpV91') ? document.getElementById('torMagnetInpV91').value : '',
                currentHash: (window._torStateV96 && window._torStateV96.currentHash) || ''
            }
        };
        localStorage.setItem('ytm_live_workspace_v146', JSON.stringify(snap));
    } catch (e) {}
};

setInterval(() => {
    const aud = document.getElementById('audioPlayer');
    const st = window._vidStateV130 || {};
    const musicPlaying = Boolean(window.currentPlayingTrack && aud && (!aud.paused || window.isStudioPlaying));
    if (musicPlaying || st.active) {
        window.saveLiveWorkspaceSnapshotV146(false);
    }
}, 1500);

// 4. Авто-восстановление с той же секунды, если система перезагрузила WebView
window.restoreLiveWorkspaceSnapshotIfNeededV146 = function() {
    try {
        const raw = localStorage.getItem('ytm_live_workspace_v146');
        if (!raw) return;
        const snap = JSON.parse(raw);
        if (!snap || !snap.ts) return;

        const ageMs = Date.now() - snap.ts;
        const shouldRestore = (snap.permRedirect && ageMs < 300000) || (!snap.permRedirect && ageMs < 20000 && (snap.video?.active || !snap.music?.paused));
        if (!shouldRestore) return;

        snap.permRedirect = false;
        localStorage.setItem('ytm_live_workspace_v146', JSON.stringify(snap));

        setTimeout(async () => {
            if (snap.torrentModal && snap.torrentModal.open && typeof window.openTorrentHubPreviewModalV91 === 'function') {
                window.openTorrentHubPreviewModalV91();
                const inp = document.getElementById('torMagnetInpV91');
                if (inp && snap.torrentModal.query) inp.value = snap.torrentModal.query;
            }

            if (snap.music && snap.music.track && !window.currentPlayingTrack && typeof window.playTrack === 'function') {
                await window.playTrack(snap.music.track, 'main');
                const aud = document.getElementById('audioPlayer');
                if (aud && snap.music.time > 1) {
                    const applyAudioSeek = () => {
                        try { aud.currentTime = snap.music.time; } catch (e) {}
                        if (typeof window.setExactPlaybackPositionV75 === 'function') {
                            window.setExactPlaybackPositionV75(snap.music.time);
                        }
                        if (snap.music.paused) {
                            try { aud.pause(); } catch (e) {}
                        }
                    };
                    if (aud.readyState >= 1) applyAudioSeek();
                    else aud.addEventListener('loadedmetadata', applyAudioSeek, { once: true });
                }
            }

            if (snap.video && snap.video.active && snap.video.url && typeof window.openJennyVideoPlayerV130 === 'function') {
                window.openJennyVideoPlayerV130(snap.video.url, snap.video.title || 'Видео', {
                    torHash: snap.video.torHash || '',
                    torFileIdx: snap.video.torFileIdx !== undefined ? snap.video.torFileIdx : -1,
                    startInPipV135: Boolean(snap.video.pipMode)
                });
                const vid = document.getElementById('jennyVideoElV130');
                if (vid && snap.video.time > 1) {
                    const targetSec = Number(snap.video.time);
                    const applyVidSeek = () => {
                        try { vid.currentTime = targetSec; } catch (e) {}
                        if (snap.video.paused && typeof window.toggleVideoPlayPauseV130 === 'function' && window._vidPlayIntentV132) {
                            window.toggleVideoPlayPauseV130();
                        }
                    };
                    if (vid.readyState >= 1) applyVidSeek();
                    else vid.addEventListener('loadedmetadata', applyVidSeek, { once: true });
                }
            }
        }, 650);
    } catch (e) {}
};

const _prevOpenVidV147 = window.openJennyVideoPlayerV130;
window.openJennyVideoPlayerV130 = function(streamUrl, titleStr, opts) {
    const r = _prevOpenVidV147.apply(this, arguments);
    window.removeDesktopOverlayButtonsFromHudV147();
    return r;
};

setTimeout(() => {
    window.removeDesktopOverlayButtonsFromHudV147();
    window.restoreLiveWorkspaceSnapshotIfNeededV146();
}, 400);
})();

// === 🎛️🎬 JENNY V150: SPLIT AUDIO/VIDEO FORMAT SLOTS, SMART REFRESH & CLEAN VIDEO TAB ===
/* [split] V150: кусок исходного IIFE (ui_v71.js, строки 12237–12748) → ui_video.js */
;(function() {
// 1. Исправляем геометрию мини-окна видеоплеера (mode-pip-v130), чтобы кнопка ✖ и правый таймер никогда не вылезали за край
const pipStyleId = 'jennyV150PipAndVideoFixes';

window.ensureDualDeckFormatSlotsV150 = function() {
    const cfg = window._musicConfigRefV131 || window.appConfig || {};
    if (!Array.isArray(cfg.formatSlotsAudioV150) || cfg.formatSlotsAudioV150.length === 0) {
        const oldSlots = Array.isArray(cfg.formatSlots) ? cfg.formatSlots : [];
        const fromOldAudio = oldSlots.filter(s => s && s.ext && !window.KNOWN_VIDEO_EXT_SET_V150.has(String(s.ext).toLowerCase().trim()));
        cfg.formatSlotsAudioV150 = fromOldAudio.length >= 4
            ? JSON.parse(JSON.stringify(fromOldAudio))
            : JSON.parse(JSON.stringify(window.DEFAULT_AUDIO_FORMAT_SLOTS_V150));
        if (!cfg.formatSlotsAudioV150.some(s => String(s.ext).toLowerCase() === '.xflac')) {
            cfg.formatSlotsAudioV150.push({ en: true, ext: '.xflac' });
        }
    }
    if (!Array.isArray(cfg.formatSlotsVideoV150) || cfg.formatSlotsVideoV150.length === 0) {
        cfg.formatSlotsVideoV150 = JSON.parse(JSON.stringify(window.DEFAULT_VIDEO_FORMAT_SLOTS_V150));
    }
    // Синхронизируем объединённый массив formatSlots для бэкенда player.py
    cfg.formatSlots = [...cfg.formatSlotsAudioV150, ...cfg.formatSlotsVideoV150];
    if (window.appConfig && window.appConfig !== cfg) {
        window.appConfig.formatSlotsAudioV150 = cfg.formatSlotsAudioV150;
        window.appConfig.formatSlotsVideoV150 = cfg.formatSlotsVideoV150;
        window.appConfig.formatSlots = cfg.formatSlots;
    }
    return { audioSlots: cfg.formatSlotsAudioV150, videoSlots: cfg.formatSlotsVideoV150 };
};

window.isVideoFileNameV130 = function(nameOrPath) {
    const s = String(nameOrPath || '').split('?')[0].toLowerCase().trim();
    if (!s) return false;
    const { videoSlots } = window.ensureDualDeckFormatSlotsV150();
    for (const slot of videoSlots) {
        const ext = '.' + String(slot.ext || '').toLowerCase().trim().replace(/^\.+/, '');
        if (ext.length > 1 && s.endsWith(ext)) return true;
    }
    for (const ext of window.KNOWN_VIDEO_EXT_SET_V150) {
        if (s.endsWith(ext)) return true;
    }
    return false;
};

window.isVideoTrackAllowedByFormatSlotsV150 = function(filename) {
    if (!filename) return true;
    const { videoSlots } = window.ensureDualDeckFormatSlotsV150();
    const activeExts = videoSlots
        .filter(s => s && s.en && String(s.ext || '').trim())
        .map(s => '.' + String(s.ext).trim().toLowerCase().replace(/^\.+/, ''));
    if (activeExts.length === 0) return false;
    const lower = String(filename).toLowerCase().trim();
    return activeExts.some(ext => lower.endsWith(ext));
};

// При переключении между Декой А и Декой Б сразу переключаем и список форматов!
const _prevSwitchDeckV131 = window.switchActiveUiDeckV131;
window.switchActiveUiDeckV131 = function(deckName, ev) {
    const r = _prevSwitchDeckV131.apply(this, arguments);
    window.syncFormatSlotsUI();
    return r;
};

// 4. Единый фильтр разрешённых видеофайлов и синхронизация вкладки «🎬 Видео» (убираем лишнюю строку папки сверху!)
window.getFilteredVideoItemsV150 = function() {
    const rawItems = window.collectClientTorrentVideosV137 ? window.collectClientTorrentVideosV137() : [];
    return rawItems.filter(it => it && it.name && window.isVideoTrackAllowedByFormatSlotsV150(it.name));
};

setTimeout(() => {
    window.ensureDualDeckFormatSlotsV150();
    window.syncFormatSlotsUI();
    window.bindSmartRefreshBtnV150();
    window.syncDiscoveredVideosIntoPlaylistV134(true);
}, 350);
})();

// === 🚀⏩ JENNY V167: ПОЛНАЯ ДЛИТЕЛЬНОСТЬ НА ТАЙМЛАЙНЕ, 6-ПОТОЧНЫЙ RAM И МГНОВЕННАЯ ПЕРЕМОТКА AVI/MKV/MP4 ===
/* [split] V167: кусок исходного IIFE (ui_v71.js, строки 13217–13616) → ui_video.js */
;(function initJennyVideoFullRamAndSeekV167() {
    window.getEffectiveVideoDurationV167 = function(vid) {
        const st = window._vidStateV130 || {};
        const vd = window.videoDeckV131 || {};
        if (st.trueDuration && st.trueDuration > 1) return st.trueDuration;
        if (vd.studioBuffer && vd.studioBuffer._trueDurationV72 > 1) return vd.studioBuffer._trueDurationV72;
        if (vid && isFinite(vid.duration) && vid.duration > 0) {
            return vid.duration + (st.remuxBaseOffset || 0);
        }
        return 0;
    };

    window.getEffectiveVideoCurrentTimeV167 = window.getEffectiveVideoCurrentTimeV210 = function(vid) {
        if (!vid) vid = document.getElementById('jennyVideoElV130');
        const st = window._vidStateV130 || {};
        if (st._pendingSeekSecV167 !== undefined) {
            const dt = performance.now() - (st._pendingSeekTsV167 || 0);
            if (dt < 2500 || window._vidIsBufferingV132 || !vid || vid.readyState < 2) {
                return st._pendingSeekSecV167;
            }
            if ((vid.currentTime || 0) > 0.15) {
                st._pendingSeekSecV167 = undefined;
            }
        }
        const rawCur = (vid && isFinite(vid.currentTime)) ? vid.currentTime : 0;
        return rawCur + (st.remuxBaseOffset || 0);
    };

    // Точный прыжок в любую точку фильма (и для прямых MP4/MKV, и для потокового ремукса AVI)
    window.seekVideoToExactSecondV167 = function(targetSec) {
        const vid = document.getElementById('jennyVideoElV130');
        const st = window._vidStateV130;
        const vd = window.videoDeckV131;
        if (!vid || !st || !st.active) return;

        const dur = window.getEffectiveVideoDurationV167(vid);
        const cleanSec = dur > 0 ? Math.max(0, Math.min(dur - 0.5, targetSec)) : Math.max(0, targetSec);

        st._pendingSeekSecV167 = cleanSec;
        st._pendingSeekTsV167 = performance.now();

        // Сразу обновляем цифры таймера и ползунок, чтобы он никогда не отпрыгивал назад!
        const cEl = document.getElementById('v130CurTime');
        const dEl = document.getElementById('v130DurTime');
        const seek = document.getElementById('v130SeekSlider');
        if (cEl && window.fmtKhSecV90) cEl.innerText = window.fmtKhSecV90(cleanSec);
        if (dEl && dur > 0 && window.fmtKhSecV90) dEl.innerText = window.fmtKhSecV90(dur);
        if (seek && dur > 0) seek.value = Math.min(1000, Math.round((cleanSec / dur) * 1000));

        // Если кусок RAM в точке перемотки еще не загружен — прерываем текущий чанк, чтобы воркеры мгновенно скачали точку перемотки!
        if (vd && vd.studioBuffer && vd.studioBuffer._pieceMapV72) {
            const pSec = vd.studioBuffer._pieceSecV72 || 45;
            const targetP = Math.max(0, Math.min(vd.studioBuffer._pieceMapV72.length - 1, Math.floor(cleanSec / pSec)));
            if (vd.studioBuffer._pieceMapV72[targetP] !== 2 && vd.pieceAbortCtrl) {
                try { vd.pieceAbortCtrl.abort(); } catch (e) {}
            }
        }

        if (st.usingRemux || /\.avi$/i.test(st.currentTitle || '')) {
            // Проверяем, попадает ли секунда в уже прокачанный локальный буфер браузера
            let inLocalBuf = false;
            const relSec = cleanSec - (st.remuxBaseOffset || 0);
            if (relSec >= 0 && vid.buffered && vid.buffered.length > 0) {
                const bufEnd = vid.buffered.end(vid.buffered.length - 1);
                if (relSec <= bufEnd - 0.4) {
                    inLocalBuf = true;
                }
            }
            if (inLocalBuf) {
                try { vid.currentTime = relSec; } catch (e) {}
            } else {
                st.usingRemux = true;
                st.remuxBaseOffset = cleanSec;
                window._vidPlayIntentV132 = true;
                window._vidIsBufferingV132 = true;
                if (typeof window.syncVideoPlayBtnIconV132 === 'function') window.syncVideoPlayBtnIconV132();
                const tcFlag = /\.avi$/i.test(st.currentTitle || '') ? '1' : '0';
                vid.src = `/api/video/live_remux?src=${encodeURIComponent(st.currentUrl)}&start=${cleanSec.toFixed(2)}&transcode=${tcFlag}&t=${Date.now()}`;
                vid.play().catch(() => {});
            }
        } else {
            st.remuxBaseOffset = 0;
            try { vid.currentTime = cleanSec; } catch (e) {}
        }

        window.syncVideoRamEngineV131(false);
    };

    // Переопределяем кнопки -10 / +10 сек на работу с полной длительностью и точным смещением
    window.seekVideoRelativeV130 = function(deltaSec, ev) {
        if (window.isVideoHudGuardActiveV130 && window.isVideoHudGuardActiveV130(ev)) return;
        if (ev && ev.stopPropagation) ev.stopPropagation();
        const vid = document.getElementById('jennyVideoElV130');
        if (!vid) return;
        const cur = window.getEffectiveVideoCurrentTimeV167(vid);
        const target = Math.max(0, cur + deltaSec);
        window.seekVideoToExactSecondV167(target);
        if (typeof window.showVideoFeedbackV130 === 'function') {
            const fmtT = window.fmtKhSecV90 ? window.fmtKhSecV90(target) : (Math.round(target) + 'с');
            window.showVideoFeedbackV130((deltaSec > 0 ? `⏩ +${deltaSec}с ➔ ` : `⏪ ${deltaSec}с ➔ `) + fmtT);
        }
        if (typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
    };

    // Переопределяем syncVideoRamEngineV131, чтобы RAM-буфер всегда брал точную секунду (с учетом remuxBaseOffset!)
    window.syncVideoRamEngineV131 = function(isDragging) {
        const vd = window.videoDeckV131, st = window._vidStateV130, vid = document.getElementById('jennyVideoElV130');
        if (!vid || !vd || !vd.ctx || !st || !st.active) return;
        if (vd.horizonTimer) { clearTimeout(vd.horizonTimer); vd.horizonTimer = null; }
        if (vd.revFrameTimer) { clearInterval(vd.revFrameTimer); vd.revFrameTimer = null; }

        const gKey = (vd.config && vd.config.gearKeyV66) || 'jbuf-lock';
        const targetSpd = (gKey === 'neutral') ? 1.0 : (vd.speed || 1.0);
        const isRev = Boolean(vd.isReversed);
        const curSec = window.getEffectiveVideoCurrentTimeV167(vid);

        const pSec = (vd.studioBuffer && vd.studioBuffer._pieceSecV72) || 45;
        const curP = (vd.studioBuffer && vd.studioBuffer._pieceMapV72)
            ? Math.max(0, Math.min(vd.studioBuffer._pieceMapV72.length - 1, Math.floor((isRev ? Math.max(0, curSec - 1.0) : curSec) / pSec)))
            : -1;
        const isPieceReady = Boolean(vd.studioBuffer && vd.studioBuffer._pieceMapV72 && vd.studioBuffer._pieceMapV72[curP] === 2);
        const useRamEngine = isPieceReady && (isRev || gKey === 'jbuf-lock' || gKey === 'jbuf-shift' || gKey === 'vinyl-shift');

        if (!useRamEngine) {
            if (vd.sourceNode) {
                vd.sourceNode.onended = null;
                try { vd.sourceNode.stop(); } catch (e) {}
                try { vd.sourceNode.disconnect(); } catch (e) {}
                vd.sourceNode = null;
            }
            vd.isStudioPlaying = false;
            if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = st.dspBypass ? 0.0 : 1.0;
            if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = st.dspBypass ? 1.0 : 0.0;
            const lockPitch = (gKey !== 'web-shift' && gKey !== 'jbuf-shift' && gKey !== 'vinyl-shift');
            vid.preservesPitch = lockPitch; vid.mozPreservesPitch = lockPitch; vid.webkitPreservesPitch = lockPitch;
            if (Math.abs(vid.playbackRate - targetSpd) > 0.005) { try { vid.playbackRate = targetSpd; } catch (e) {} }
            return;
        }

        if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = 0.0;
        if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = 0.0;
        const WIN_SEC = Math.max(18.0, Math.min(60.0, targetSpd * 18.0));
        const rawWinBuf = window.extractVideoWindowBufferV131(vd.studioBuffer, curSec, WIN_SEC, isRev);
        if (!rawWinBuf) return;

        let playBuf = rawWinBuf, nodeRate = 1.0;
        if (gKey === 'jbuf-lock') {
            const tensionPct = (vd.config && vd.config.hoseTensionPct !== undefined) ? vd.config.hoseTensionPct : 100;
            playBuf = window.buildElasticHoseBufferDeckB(rawWinBuf, targetSpd, tensionPct);
            nodeRate = 1.0;
        } else {
            playBuf = rawWinBuf; nodeRate = targetSpd;
        }

        if (vd.sourceNode) {
            vd.sourceNode.onended = null;
            try { vd.sourceNode.stop(); } catch (e) {}
            try { vd.sourceNode.disconnect(); } catch (e) {}
            vd.sourceNode = null;
        }

        if ((!vid.paused || vd.isReversed) && !st.userPaused) {
            vd.sourceNode = vd.ctx.createBufferSource();
            vd.sourceNode.buffer = playBuf;
            vd.sourceNode.playbackRate.value = nodeRate;
            vd.sourceNode.connect(st.dspBypass ? vd.directBypassGain : vd.inputMixer);
            if (st.dspBypass && vd.directBypassGain) vd.directBypassGain.gain.value = 1.0;
            vd.sourceNode.start(0, 0);
            vd.isStudioPlaying = true;

            const realDurSec = (gKey === 'jbuf-lock') ? playBuf.duration : (playBuf.duration / Math.max(0.25, nodeRate));
            vd.horizonTimer = setTimeout(() => {
                if (st.active && !st.userPaused) window.syncVideoRamEngineV131(false);
            }, Math.max(400, (realDurSec - 0.9) * 1000));
        }
    };

    // 6-поточная турбо-распаковка всего фильма в RAM с мгновенным приоритетом точки перемотки
    window.decodeVideoToRamV131 = async function(streamUrl, titleStr) {
        window.initVideoDeckAudioV131();
        const vd = window.videoDeckV131;
        const st = window._vidStateV130 || {};
        const mySess = ++vd.ramDecodeSession;
        if (vd.pieceAbortCtrl) { try { vd.pieceAbortCtrl.abort(); } catch (e) {} }
        vd.studioBuffer = null;

        const vid = document.getElementById('jennyVideoElV130');
        let dur = st.trueDuration || 0;
        if (dur <= 0) {
            try {
                const mr = await fetch(`/api/video/pcm_meta?src=${encodeURIComponent(streamUrl)}`);
                if (mr.ok) {
                    const md = await mr.json();
                    dur = parseFloat(md.duration) || 0;
                    if (dur > 0) st.trueDuration = dur;
                }
            } catch (e) {}
        }
        if (!dur && vid) {
            for (let w = 0; w < 25; w++) {
                if (mySess !== vd.ramDecodeSession) return null;
                if (isFinite(vid.duration) && vid.duration > 1) { dur = vid.duration; st.trueDuration = dur; break; }
                await new Promise(r => setTimeout(r, 100));
            }
        }
        if (dur <= 0 || mySess !== vd.ramDecodeSession) return null;

        const dEl = document.getElementById('v130DurTime');
        if (dEl && window.fmtKhSecV90) dEl.innerText = window.fmtKhSecV90(dur);

        // Оптимальная частота для полного помещения 2-3 часового фильма в ОЗУ без переполнения кучи WebView
        const srCandidates = (dur > 5400) ? [24000, 16000] : ((dur > 2400) ? [32000, 24000] : [44100, 32000]);
        let sr = srCandidates[0], totalFrames = 0, audioBuf = null;
        for (const candSr of srCandidates) {
            try {
                sr = candSr;
                totalFrames = Math.floor(dur * sr);
                audioBuf = vd.ctx.createBuffer(2, totalFrames, sr);
                if (audioBuf) break;
            } catch (e) {}
        }
        if (!audioBuf || mySess !== vd.ramDecodeSession) return null;

        const chL = audioBuf.getChannelData(0), chR = audioBuf.getChannelData(1);
        const PIECE_SEC = 45;
        const numPieces = Math.max(1, Math.ceil(dur / PIECE_SEC));
        const pieceMap = new Uint8Array(numPieces);
        const failCounts = new Uint8Array(numPieces);

        audioBuf._pieceSecV72 = PIECE_SEC;
        audioBuf._pieceMapV72 = pieceMap;
        audioBuf._loadedCountV72 = 0;
        audioBuf._allPiecesLoadedV72 = false;
        audioBuf._trueDurationV72 = dur;
        audioBuf._ramTotalMbV134 = Math.round((totalFrames * 8) / (1024 * 1024));
        vd.studioBuffer = audioBuf;

        const fetchVideoPiece = async (pIdx, isUrgent) => {
            if (pIdx < 0 || pIdx >= numPieces || pieceMap[pIdx] === 2) return true;
            pieceMap[pIdx] = 1;
            const stSec = pIdx * PIECE_SEC;
            const dSec = Math.min(PIECE_SEC, dur - stSec);
            let ctrl = null;
            if (!isUrgent) {
                ctrl = new AbortController();
                vd.pieceAbortCtrl = ctrl;
            }
            try {
                const u = `/api/video/pcm_chunk?src=${encodeURIComponent(streamUrl)}&start=${stSec}&dur=${dSec}&sr=${sr}`;
                const res = await fetch(u, ctrl ? { signal: ctrl.signal } : {});
                if (!res.ok) { pieceMap[pIdx] = 0; return false; }
                const ab = await res.arrayBuffer();
                const frames = Math.floor(ab.byteLength / 8);
                if (frames <= 0) { pieceMap[pIdx] = 0; return false; }
                const startFrame = Math.min(totalFrames, Math.floor(stSec * sr));
                const maxCopy = Math.min(frames, totalFrames - startFrame);
                if (maxCopy > 0) {
                    const leftArr = new Float32Array(ab, 0, frames);
                    const rightArr = new Float32Array(ab, frames * 4, frames);
                    chL.set(leftArr.subarray(0, maxCopy), startFrame);
                    chR.set(rightArr.subarray(0, maxCopy), startFrame);
                }
                pieceMap[pIdx] = 2;
                audioBuf._loadedCountV72++;
                if (audioBuf._loadedCountV72 === 1 && vd.config && vd.config.opt_autoRms) {
                    window.computeBufferAutoGainDeckB(audioBuf, vd.config.val_autoRms);
                    window.buildVideoAudioGraphV131();
                }
                return true;
            } catch (e) {
                pieceMap[pIdx] = 0;
                return false;
            }
        };

        const pickNextPieceIdx = () => {
            const curSec = window.getEffectiveVideoCurrentTimeV167(vid);
            const curPiece = Math.max(0, Math.min(numPieces - 1, Math.floor(curSec / PIECE_SEC)));
            const stepDir = vd.isReversed ? -1 : 1;
            for (let look = 0; look < 3; look++) {
                const cand = curPiece + look * stepDir;
                if (cand >= 0 && cand < numPieces && pieceMap[cand] === 0 && failCounts[cand] < 4) {
                    return { idx: cand, urgent: look <= 1 };
                }
            }
            for (let offset = 0; offset < numPieces; offset++) {
                const cand = (curPiece + offset) % numPieces;
                if (pieceMap[cand] === 0 && failCounts[cand] < 4) {
                    return { idx: cand, urgent: false };
                }
            }
            return null;
        };

        const workerLoop = async () => {
            while (mySess === vd.ramDecodeSession && window._vidStateV130 && window._vidStateV130.active) {
                const task = pickNextPieceIdx();
                if (!task) break;
                const ok = await fetchVideoPiece(task.idx, task.urgent);
                if (mySess !== vd.ramDecodeSession) return;
                if (ok) {
                    if (task.urgent) window.syncVideoRamEngineV131(false);
                } else {
                    failCounts[task.idx]++;
                    await new Promise(r => setTimeout(r, 120));
                }
            }
        };

        // 6 параллельных воркеров распаковки в ОЗУ!
        await Promise.all([workerLoop(), workerLoop()]);
        if (mySess === vd.ramDecodeSession && audioBuf._loadedCountV72 >= numPieces) {
            audioBuf._allPiecesLoadedV72 = true;
            window.syncVideoRamEngineV131(false);
            if (typeof window.showVideoFeedbackV130 === 'function') {
                window.showVideoFeedbackV130(`🧠 Весь звук фильма в RAM: 100% (${audioBuf._ramTotalMbV134} МБ) 🚀`);
            }
        }
        return audioBuf;
    };

    // Перехватываем ползунок перемотки и timeupdate, чтобы они всегда работали по полной длительности фильма (02:16:41)
    function bindFullDurationSeekBarV167() {
        const vid = document.getElementById('jennyVideoElV130');
        const seek = document.getElementById('v130SeekSlider');
        if (!vid || !seek || seek._v167Bound) return;
        seek._v167Bound = true;

        let isDragging = false;

        seek.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            isDragging = true;
        }, { passive: true, capture: true });

        seek.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            isDragging = true;
        }, { capture: true });

        seek.addEventListener('input', (e) => {
            e.stopPropagation();
            isDragging = true;
            const dur = window.getEffectiveVideoDurationV167(vid);
            if (dur > 0) {
                const previewSec = (parseFloat(seek.value) / 1000.0) * dur;
                const cEl = document.getElementById('v130CurTime');
                if (cEl && window.fmtKhSecV90) cEl.innerText = window.fmtKhSecV90(previewSec);
            }
        }, { capture: true });

        const commitSeek = (e) => {
            if (e && e.stopImmediatePropagation) e.stopImmediatePropagation();
            if (e && e.stopPropagation) e.stopPropagation();
            if (!isDragging) return;
            isDragging = false;
            const dur = window.getEffectiveVideoDurationV167(vid);
            if (dur > 0) {
                const targetSec = (parseFloat(seek.value) / 1000.0) * dur;
                window.seekVideoToExactSecondV167(targetSec);
            }
            if (typeof window.wakeVideoHudV130 === 'function') window.wakeVideoHudV130(false);
        };

        seek.addEventListener('touchend', commitSeek, { passive: true, capture: true });
        seek.addEventListener('mouseup', commitSeek, { capture: true });
        seek.addEventListener('change', commitSeek, { capture: true });

        vid.addEventListener('timeupdate', (e) => {
            e.stopImmediatePropagation();
            if (isDragging) return;
            const cEl = document.getElementById('v130CurTime');
            const dEl = document.getElementById('v130DurTime');
            const cur = window.getEffectiveVideoCurrentTimeV167(vid);
            const dur = window.getEffectiveVideoDurationV167(vid);
            if (cEl && window.fmtKhSecV90) cEl.innerText = window.fmtKhSecV90(cur);
            if (dEl) dEl.innerText = dur > 0 ? (window.fmtKhSecV90 ? window.fmtKhSecV90(dur) : '0:00') : 'Поток';
            if (seek && dur > 0) {
                seek.value = Math.min(1000, Math.round((cur / dur) * 1000));
            }
        }, { capture: true });
    }

    const _origOpenVidV167 = window.openJennyVideoPlayerV130;
    if (typeof _origOpenVidV167 === 'function') {
        window.openJennyVideoPlayerV130 = function(streamUrl, titleStr, opts) {
            const st = window._vidStateV130 || {};
            st.trueDuration = 0;
            st._pendingSeekSecV167 = undefined;
            const r = _origOpenVidV167.apply(this, arguments);
            bindFullDurationSeekBarV167();
            // Запускаем 6-поточную распаковку в RAM мгновенно при старте видео (0 мс ожидания)!
            const effUrl = (window._vidStateV130 && window._vidStateV130.currentUrl) || streamUrl;
            window.decodeVideoToRamV131(effUrl, titleStr);
            return r;
        };
    }

    setTimeout(bindFullDurationSeekBarV167, 300);
})();

/* [split] V200: кусок исходного IIFE (ui_v71.js, строки 13620–14829) → ui_video.js */
;(function initJennyVCoreMatrixV166() {
    /* [split] копии локальных помощников этого патча (без собственного состояния) */
    function mount120HzButtonInVideoHud() {
        const oldBtn = document.getElementById('v166Btn120Mode');
        if (oldBtn) oldBtn.remove();
        return;
        if (!window._jennyExp120HzEnabledV205) {
            const bOff = document.getElementById('v166Btn120Mode');
            if (bOff) bOff.style.setProperty('display', 'none', 'important');
            return;
        }
        const dspBtn = document.getElementById('v130BtnDsp');
        if (!dspBtn || !dspBtn.parentElement || document.getElementById('v166Btn120Mode')) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'v166Btn120Mode';
        btn.className = 'v130-btn';
        btn.style.cssText = 'border-color:#00ff9d !important;color:#00ff9d !important;';
        btn.innerText = '⚡ 120Hz';
        btn.onclick = (e) => window.cycleVideo120HzModeV166(e);
        dspBtn.parentElement.insertBefore(btn, dspBtn);
    }

    window.updateVideoHeaderTelemetryV166 = function() {
        if (!window._jennyExp120HzEnabledV205) return;
        const st = window._vidStateV130;
        if (!st || !st.active) return;
        const subEl = document.getElementById('v130VideoSubTelemetry');
        if (!subEl) return;

        const m = window._jv166Metrics;
        const pr = window._vcoreLastProbeV166 || {};
        const vd = window.videoDeckV131 || {};
        const ramLoaded = vd.studioBuffer ? (vd.studioBuffer._loadedCountV72 || 0) : 0;
        const ramTot = (vd.studioBuffer && vd.studioBuffer._pieceMapV72) ? vd.studioBuffer._pieceMapV72.length : 0;
        const ramStr = ramTot > 0 ? ('RAM ' + ramLoaded + '/' + ramTot) : 'RAM';

        const plusN = m.actualPlusN || 4;
        const skipCnt = window._jennySkippedDupsTotal || 0;
        const realFps = (window.getRealOrigFpsV208 ? window.getRealOrigFpsV208() : (m.sourceFps || 30));
        const modeTag = (m.mode === 'split') ? ('🌓СПЛИТ ' + realFps + '->120 (+' + plusN + 'к)') : ((m.mode === '120') ? ('⚡120Hz (+' + plusN + 'к)') : (realFps + 'FPS-Ориг'));
        const cipherStr = pr.cipher || 'H264';
        const msStr = pr.synth_4frames_ms || 0.24;

        subEl.innerHTML =
            '<span style="color:#3fb950;font-weight:900;">📺 ' + m.screenHz + 'Hz</span> • ' +
            '<span style="color:#e3b341;">🎞️ Ориг: ' + (window.getRealOrigFpsV208 ? window.getRealOrigFpsV208() : (m.sourceFps || 30)) + ' FPS</span> ➔ ' +
            '<span style="color:#00ff9d;font-weight:900;">⚡ Выход: ' + (m.outputFps || m.screenHz) + ' FPS</span> • ' +
            '<span style="color:#d2a8ff;">🧬 ' + cipherStr + ' (' + msStr + 'мс)</span> • ' +
            '<span style="color:#79c0ff;">' + modeTag + ' • ' + ramStr + '</span>';
    };

    window.probeVideoCipherV166 = async function(streamUrl, titleStr) {
        mount120HzButtonInVideoHud();
        try {
            const r = await fetch('/api/video/vcore_probe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ src: streamUrl || titleStr || '' })
            });
            if (r.ok) {
                const d = await r.json();
                window._vcoreLastProbeV166 = d;
                if (d && d.native_fps && d.native_fps >= 5) {
                    window._jv166Metrics.fileNativeFps = d.native_fps;
                    if (d.duration_sec && d.duration_sec > 0) window._jennyFullMovieDurationSecV210 = d.duration_sec;
                    window._jv166Metrics.sourceFps = Math.round(d.native_fps);
                }
                if (typeof window.updateSplitLineUI === 'function') window.updateSplitLineUI();
                window.updateVideoHeaderTelemetryV166();
            }
        } catch (e) {}
    };

    window.renderVCoreDeckPanelV166 = function() {
        if (!window._jennyExp120HzEnabledV205) {
            const pOff = document.getElementById('jv166VCoreDeckPanel');
            if (pOff) pOff.style.setProperty('display', 'none', 'important');
            return;
        }
        const sm = document.getElementById('settingsModal');
        const deckBar = document.getElementById('deckSwitchBarSettingsV131');
        if (!sm || !deckBar) return;

        let panel = document.getElementById('jv166VCoreDeckPanel');
        const isVideoDeck = Boolean(window._jennyDualDeckV211 && window._jennyDualDeckV211.deckB);
        if (!isVideoDeck) {
            if (panel) panel.style.display = 'none';
            return;
        }
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'jv166VCoreDeckPanel';
            panel.style.cssText = 'background:linear-gradient(145deg,#090d14,#121824);border:1.5px solid #ff7b72;border-radius:12px;padding:10px 12px;margin-bottom:12px;color:#e6edf3;';
            deckBar.insertAdjacentElement('afterend', panel);
        }
        panel.style.display = 'block';

        const st = window._vcoreStateV166;
        if (!st || !st.ok) {
            panel.innerHTML = '<div style="font-size:12px;color:#8b949e;">⏳ Загрузка матрицы нативных видеоядер .SO...</div>';
            window.fetchVCoreStatusV166();
            return;
        }

        const cfg = st.config || {};
        const binds = cfg.bindings || {};
        const soList = st.available_so || [];
        const m = window._jv166Metrics;
        const curInterp = Math.round(Number.isFinite(window._jennyTunerV190 && window._jennyTunerV190.interpFrames) ? window._jennyTunerV190.interpFrames : (cfg.interp_frames || 0));

        const rowsHtml = ['H264', 'HEVC', 'VP9', 'AV1'].map(fmt => {
            const cur = binds[fmt] || '';
            const opts = soList.map(s => '<option value="' + s + '" ' + (s === cur ? 'selected' : '') + '>' + s + '</option>').join('');
            return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;background:#0d1117;padding:6px 8px;border-radius:8px;border:1px solid #30363d;">' +
                '<span style="font-weight:900;color:#58a6ff;font-size:11.5px;min-width:46px;font-family:monospace;">' + fmt + '</span>' +
                '<select onchange="window.jv166BindSo(\'' + fmt + '\', this.value)" style="flex:1;background:#161b22;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:5px 6px;font-size:11px;font-weight:bold;">' + opts + '</select>' +
            '</div>';
        }).join('');

        const interpBtns = [
            { n: 0, lbl: 'АВТО (120Hz)' },
            { n: 1, lbl: '+1 (x2)' },
            { n: 2, lbl: '+2 (x3)' },
            { n: 3, lbl: '+3 (x4)' },
            { n: 4, lbl: '+4 (x5)' }
        ].map(b => {
            const act = (curInterp === b.n);
            return '<button type="button" onclick="window.setInterpFramesV200(' + b.n + ')" style="flex:1;padding:5px 4px;border-radius:6px;font-size:10.5px;font-weight:900;border:1px solid ' + (act ? '#00ff9d' : '#30363d') + ';background:' + (act ? 'rgba(0,255,157,0.18)' : '#161b22') + ';color:' + (act ? '#00ff9d' : '#c9d1d9') + ';">' + b.lbl + '</button>';
        }).join('');

        panel.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
                '<div style="display:flex;align-items:center;gap:6px;">' +
                    '<span style="background:#00ff9d;color:#000;font-weight:900;font-size:10px;padding:2px 6px;border-radius:5px;">V202 MV</span>' +
                    '<span style="font-weight:900;font-size:12.5px;color:#fff;">МАТРИЦА .SO ЯДЕР & A->[B]->C INTERP</span>' +
                '</div>' +
                '<span id="jv166LiveHzBadge" style="font-size:11px;font-weight:900;color:#3fb950;background:rgba(63,185,80,0.16);border:1px solid #3fb950;padding:2px 8px;border-radius:6px;">' + m.screenHz + ' Hz</span>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding:6px 9px;background:#0d1117;border:1px solid #21262d;border-radius:8px;font-size:11px;">' +
                '<span>C++ База: <b style="color:' + (st.native_loaded ? '#3fb950' : '#e3b341') + ';">' + (st.native_loaded ? 'libjenny_vcore.so 🟢' : 'Python Bridge 🟡') + '</b></span>' +
                '<span>Движок: <b style="color:#58a6ff;">MV 240x135 + Игнор дублей B==A</b></span>' +
            '</div>' +
            '<div style="margin-bottom:8px;padding:7px 8px;background:#0d1117;border:1px solid #30363d;border-radius:8px;">' +
                '<div style="font-size:10.5px;color:#00e5ff;margin-bottom:5px;font-weight:bold;">🎞️ Сколько промежуточных кадров дорисовывать (Python/C++):</div>' +
                '<div style="display:flex;gap:4px;">' + interpBtns + '</div>' +
            '</div>' +
            '<div style="font-size:10.5px;color:#8b949e;margin-bottom:5px;font-weight:bold;">Ручная привязка .SO насадок к видеошифрам:</div>' +
            rowsHtml +
            '<div style="margin-top:8px;padding:8px;background:#0d1117;border:1px solid #21262d;border-radius:8px;display:flex;flex-direction:column;gap:6px;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">' +
                    '<span style="font-size:11.5px;font-weight:bold;color:#d2a8ff;">⚡ Режим в плеере:</span>' +
                    '<button type="button" onclick="window.cycleVideo120HzModeV166()" style="flex:1;background:#161b22;color:#00ff9d;border:1px solid #00ff9d;border-radius:6px;padding:6px;font-size:11px;font-weight:900;">' +
                        (m.mode === '120' ? '⚡ 120 Гц: MV-Interp V202 ВКЛ' : (m.mode === 'split' ? '🌓 Честный Сплит: Слева Ориг / Справа 120' : '🎞️ Выкл (Родные 24/60 FPS)')) +
                    '</button>' +
                '</div>' +
            '</div>';
    };

    const _origRenderBannersV131 = window.renderDeckSwitchBannersV131;
    if (typeof _origRenderBannersV131 === 'function') {
        window.renderDeckSwitchBannersV131 = function() {
            const r = _origRenderBannersV131.apply(this, arguments);
            window.renderVCoreDeckPanelV166();
            return r;
        };
    }

    setInterval(() => {
        mount120HzButtonInVideoHud();
        if (window._vidStateV130 && window._vidStateV130.active) {
            window.updateVideoHeaderTelemetryV166();
        }
    }, 500);
})();

/* ================= JENNY V170: TRUE VIDEO DECK SPEED ARC + BOTTOM BAR + EXACT FRAMEGEN SPLIT ================= */
/* [split] V170: кусок исходного IIFE (ui_v71.js, строки 14832–15119) → ui_video.js */
;(function() {
    if (window._jennyV170Installed__video) return;
    window._jennyV170Installed__video = true;
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

        var gKeyB = (window.videoDeckV131 && window.videoDeckV131.config && window.videoDeckV131.config.gearKeyV66) || 'jbuf-lock';
        var lockPitchB = (gKeyB !== 'web-shift' && gKeyB !== 'jbuf-shift' && gKeyB !== 'vinyl-shift');
        var vEl = getVideoElV170();
        if (vEl) {
            try {
                vEl.preservesPitch = lockPitchB;
                vEl.mozPreservesPitch = lockPitchB;
                vEl.webkitPreservesPitch = lockPitchB;
                vEl.defaultPlaybackRate = spd;
                vEl.playbackRate = spd;
            } catch (e) {}
        }

        // Обновляем состояние видеодеки и конфиг, чтобы старый цикл не сбрасывал скорость обратно на 0.5x
        if (window.videoDeckV131) {
            if (window.videoDeckV131.ctx && window.videoDeckV131.ctx.state === 'suspended') {
                try { window.videoDeckV131.ctx.resume(); } catch (e) {}
            }
            window.videoDeckV131.speed = spd;
            if (window.videoDeckV131.config) {
                window.videoDeckV131.config.playbackSpeed = spd;
                if (window.videoDeckV131.config.autoSaveBase) {
                    window.videoDeckV131.config.normalPlaybackSpeed = spd;
                }
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

        // [V360] Полная изоляция Деки А от Деки Б: скорость видео НИКОГДА не трогает audioPlayer и studioSourceNode Деки А!
        if (window.JennyVideoDeckBEngine && typeof window.JennyVideoDeckBEngine.syncSpeed === 'function') {
            try { window.JennyVideoDeckBEngine.syncSpeed(spd); } catch (e) {}
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

        if (typeof window.syncDeckBSpeedLockIndicatorV227 === 'function') {
            window.syncDeckBSpeedLockIndicatorV227();
        } else {
            var spdIndB = document.getElementById('speedLockIndicatorDeckB');
            if (spdIndB && Math.abs(spd - 1.0) > 0.005) {
                var isRevNowB = Boolean(window.isReversedDeckB || (window.videoDeckV131 && window.videoDeckV131.isReversed) || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed));
                spdIndB.style.display = 'block';
                spdIndB.textContent = '🔒 ' + (isRevNowB ? '⏪' : '⏩') + ' x' + spd;
            }
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

    // Долгое нажатие по центру нижней шкалы в режиме Видео сбрасывает скорость видео на 1.0x,
    // а короткий тап/свайп по нижней шкале перематывает само Видео!
    function bindBottomBarToVideoDeckV170() {
        // [V360] Отключено: фиолетовая шкала #nowPlaying принадлежит строго Аудиодеке А!
        return;

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
        if (false && isVideoDeckActiveV170() && isFinite(vEl.duration) && vEl.duration > 0) {
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
})();

/* [split] V210: кусок исходного IIFE (ui_v71.js, строки 15132–16521) → ui_video.js */
;(function() {
    if (window._jennyV210Installed__video) return;
    window._jennyV210Installed__video = true;
    window._jennyV210Installed = true;

    var rawMainSec = parseFloat(localStorage.getItem('jenny_autohide_main_sec_v209') || '4.0');
    var rawPipSec  = parseFloat(localStorage.getItem('jenny_autohide_pip_sec_v209')  || '2.5');
    window._jennyAutoHideSecV209 = {
        main: Number.isFinite(rawMainSec) ? Math.max(0.5, Math.min(120.0, Math.round(rawMainSec * 10) / 10)) : 4.0,
        pip:  Number.isFinite(rawPipSec)  ? Math.max(0.5, Math.min(120.0, Math.round(rawPipSec  * 10) / 10)) : 2.5
    };

    window._jennySplitExpandedV209 = false;
    window._jenny120ExpandedV209   = false;

    // 1. ПОЛНЫЕ ЛОКАЛЬНЫЕ ФИЛЬМЫ БЕЗ ПЕРЕХВАТА ТОРРЕНТ-СТРИМОВ (V214)
    window.isLocalFileFullyDownloadedV210 = function(src) {
        if (!src) return false;
        var st = window._vidStateV130;
        if (st && (st.torHash || st.isTorrentStream) && !st.isReadyLocalV212) return false;
        var s = String(src).toLowerCase();
        if (
            s.indexOf('.part') !== -1 ||
            s.indexOf('/api/torrent/stream') !== -1 ||
            s.indexOf('/api/video/live_remux') !== -1 ||
            s.indexOf('/api/video/remux') !== -1 ||
            s.indexOf('torrent_stream') !== -1 ||
            s.indexOf('omni_stream') !== -1
        ) {
            return false;
        }
        return true;
    };
    window._jennyFullMovieDurationSecV210 = 0.0;

    window.isDeckBVideoControlActiveV210 = function() {
        var st = window._vidStateV130;
        var vEl = document.getElementById('jennyVideoElV130');
        return Boolean(st && st.active && vEl && window._activeUiDeckV131 === 'video');
    };

    window.formatVideoTimeV210 = function(sec) {
        if (!Number.isFinite(sec) || sec < 0) sec = 0;
        sec = Math.floor(sec);
        var hrs = Math.floor(sec / 3600);
        var mins = Math.floor((sec % 3600) / 60);
        var secs = sec % 60;
        if (hrs > 0) return hrs + ':' + (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
        return mins + ':' + (secs < 10 ? '0' : '') + secs;
    };

    window.getEffectiveVideoDurationV210 = function(vEl) {
        var probeDur = (window._vcoreLastProbeV166 && window._vcoreLastProbeV166.duration_sec) || window._jennyFullMovieDurationSecV210 || 0;
        var vd = vEl ? vEl.duration : 0;
        if (Number.isFinite(vd) && vd > 12.5) return vd;
        if (probeDur > 0) return probeDur;
        return (Number.isFinite(vd) && vd > 0) ? vd : 0;
    };

    window.applyDeckBVideoSpeedV210 = function(newSpeed, showMsg) {
        var spd = parseFloat(newSpeed);
        if (!Number.isFinite(spd) || spd < 0.1 || spd > 8.0) return;
        spd = Math.round(spd * 100) / 100;

        var vEl = document.getElementById('jennyVideoElV130');
        if (vEl) {
            vEl.playbackRate = spd;
            vEl.defaultPlaybackRate = spd;
        }
        if (window.videoDeckV131) window.videoDeckV131.speed = spd;
        if (window._vidStateV130) window._vidStateV130.speed = spd;
        var btnSpd = document.getElementById('v130BtnSpeed');
        if (btnSpd) btnSpd.textContent = '⏩ ' + spd + 'x';
        var speedBadge = document.getElementById('speedBadge') || document.querySelector('.speed-badge');
        if (speedBadge) speedBadge.textContent = (spd === 1 ? '🚀 Норм: x1' : ('⚡ x' + spd));
        if (showMsg && typeof window.showToast === 'function') {
            window.showToast('🎬 Скорость Деки Б: x' + spd);
        }
    };

    function hookSpeedAndDeckBControlsV210() {
        ['setPlaybackSpeed', 'applyPlaybackSpeed', 'setSpeed', 'changeSpeed'].forEach(function(fnName) {
            if (typeof window[fnName] === 'function' && !window[fnName]._v210Hooked) {
                var origFn = window[fnName];
                var wrapped = function(spd) {
                    if (window.isDeckBVideoControlActiveV210()) {
                        window.applyDeckBVideoSpeedV210(spd, true);
                        return;
                    }
                    return origFn.apply(this, arguments);
                };
                wrapped._v210Hooked = true;
                window[fnName] = wrapped;
            }
        });

        var lastAudRate = 1.0;
        setInterval(function() {
            var aud = window.audio || document.querySelector('audio');
            var vEl = document.getElementById('jennyVideoElV130');
            if (aud && vEl && window.isDeckBVideoControlActiveV210()) {
                if (Math.abs(aud.playbackRate - lastAudRate) > 0.01) {
                    lastAudRate = aud.playbackRate;
                    window.applyDeckBVideoSpeedV210(aud.playbackRate, true);
                }
            }
        }, 100);

        document.addEventListener('click', function(e) {
            if (!window.isDeckBVideoControlActiveV210()) return;
            var vEl = document.getElementById('jennyVideoElV130');
            if (!vEl) return;

            var playBtn = document.getElementById('playBtn');
            var prevBtn = document.getElementById('prevBtn');
            var nextBtn = document.getElementById('nextBtn');

            if (playBtn && (e.target === playBtn || playBtn.contains(e.target))) {
                e.stopImmediatePropagation();
                e.preventDefault();
                if (vEl.paused) vEl.play().catch(function(){});
                else vEl.pause();
                var dualOn = Boolean(window._dualDeckModeV131 || (window.videoDeckV131 && window.videoDeckV131.dualMode));
                var aud = window.audio || document.querySelector('audio');
                if (!dualOn && aud && !aud.paused) {
                    try { aud.pause(); } catch (err) {}
                }
                return;
            }
            if (prevBtn && (e.target === prevBtn || prevBtn.contains(e.target))) {
                e.stopImmediatePropagation();
                e.preventDefault();
                window.seekDeckBVideoToSecV210(window.getEffectiveVideoCurrentTimeV210(vEl) - 10);
                return;
            }
            if (nextBtn && (e.target === nextBtn || nextBtn.contains(e.target))) {
                e.stopImmediatePropagation();
                e.preventDefault();
                window.seekDeckBVideoToSecV210(window.getEffectiveVideoCurrentTimeV210(vEl) + 10);
                return;
            }
        }, true);

        var progCont = document.getElementById('progressContainer');
        if (progCont && !progCont._v210ScrubHooked) {
            progCont._v210ScrubHooked = true;
            var handleBarScrub = function(clientX) {
                var vEl = document.getElementById('jennyVideoElV130');
                if (!vEl) return;
                var rect = progCont.getBoundingClientRect();
                if (rect.width <= 10) return;
                var ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                var dur = window.getEffectiveVideoDurationV210(vEl);
                if (dur > 0) window.seekDeckBVideoToSecV210(ratio * dur);
            };
            progCont.addEventListener('touchstart', function(e) {
                if (!window.isDeckBVideoControlActiveV210()) return;
                window._isScrubbingDeckBV210 = true;
                e.stopImmediatePropagation();
                if (e.touches && e.touches[0]) handleBarScrub(e.touches[0].clientX);
            }, { capture: true, passive: false });
            progCont.addEventListener('touchmove', function(e) {
                if (!window.isDeckBVideoControlActiveV210() || !window._isScrubbingDeckBV210) return;
                e.stopImmediatePropagation();
                if (e.cancelable) e.preventDefault();
                if (e.touches && e.touches[0]) handleBarScrub(e.touches[0].clientX);
            }, { capture: true, passive: false });
            progCont.addEventListener('touchend', function(e) {
                if (!window._isScrubbingDeckBV210) return;
                window._isScrubbingDeckBV210 = false;
                if (window.isDeckBVideoControlActiveV210()) e.stopImmediatePropagation();
            }, { capture: true, passive: false });
            progCont.addEventListener('click', function(e) {
                if (!window.isDeckBVideoControlActiveV210()) return;
                e.stopImmediatePropagation();
                e.preventDefault();
                handleBarScrub(e.clientX);
            }, true);
        }
    }
    setTimeout(hookSpeedAndDeckBControlsV210, 250);

    window.getVideoRootElV214 = function() {
        return document.getElementById('jennyVideoStudioRootV130') || document.getElementById('jennyVideoOverlayV130');
    };

    window.isVideoInPipOrMiniModeV210 = function(ov) {
        var st = window._vidStateV130;
        if (st && (st.pipMode || st.desktopOverlay || st.mini || st.isMini || st.pip || st.isPip || st.mode === 'mini')) return true;
        if (!ov) ov = window.getVideoRootElV214();
        if (!ov) return false;
        var cls = (ov.className || '').toLowerCase();
        if (cls.indexOf('mini') !== -1 || cls.indexOf('pip') !== -1 || cls.indexOf('desktop-overlay') !== -1) return true;
        var stage = document.getElementById('jennyVideoStageV130');
        if (stage) {
            var sCls = (stage.className || '').toLowerCase();
            if (sCls.indexOf('pip') !== -1 || sCls.indexOf('mini') !== -1) return true;
        }
        return false;
    };

    window.getCustomHudTimeoutMsV210 = function() {
        var isPip = window.isVideoInPipOrMiniModeV210();
        var fl = window._jennyLabFlagsV208 || {};
        var enabled = isPip ? Boolean(fl.stub2) : Boolean(fl.stub1);
        if (!enabled) return 86400000;
        var cfg = window._jennyAutoHideSecV209 || { main: 4.0, pip: 2.5 };
        var sec = isPip ? (Number(cfg.pip) || 2.5) : (Number(cfg.main) || 4.0);
        return Math.max(300, Math.round(sec * 1000));
    };

    window.wakeVideoHudControlsV209 = function() {
        window.setVideoHudHiddenUnifiedV214(false, false);
    };

    function isStageRot90(stageEl) {
        if (stageEl && stageEl.classList && stageEl.classList.contains('rot90-v130')) return true;
        return Boolean(window._vidStateV130 && window._vidStateV130.rotated90);
    }

    window.updateAutoHideSecV209 = function(which, rawVal, showToastFlag) {
        var num = parseFloat(String(rawVal).replace(',', '.'));
        if (!Number.isFinite(num) || num <= 0) return;
        num = Math.max(0.5, Math.min(120.0, Math.round(num * 10) / 10));
        if (which === 'pip') {
            window._jennyAutoHideSecV209.pip = num;
            try { localStorage.setItem('jenny_autohide_pip_sec_v209', num.toFixed(1)); } catch (e) {}
            if (showToastFlag && typeof window.showToast === 'function') {
                window.showToast('❐ Скрытие UI в мини-плеере: ' + num.toFixed(1) + ' сек');
            }
        } else {
            window._jennyAutoHideSecV209.main = num;
            try { localStorage.setItem('jenny_autohide_main_sec_v209', num.toFixed(1)); } catch (e) {}
            if (showToastFlag && typeof window.showToast === 'function') {
                window.showToast('⏱️ Скрытие UI в плеере: ' + num.toFixed(1) + ' сек');
            }
        }
        window.wakeVideoHudControlsV209();
    };
})();

/* [split] V211: кусок исходного IIFE (ui_v71.js, строки 16526–17925) → ui_video.js */
;(function() {
    if (window._jennyV211Installed__video) return;
    window._jennyV211Installed__video = true;
    window._jennyV211Installed = true;
    /* [split] копии локальных помощников этого патча (без собственного состояния) */
    function injectV211Styles() {
        if (document.getElementById('jennyV211Style')) return;
        var st = document.createElement('style');
        st.id = 'jennyV211Style';
        st.textContent = `
            .sticky-bottom {
                height: auto !important;
                min-height: 156px !important;
                transition: height 0.18s ease !important;
            }
            body.dual-progress-bars-v211 .middle-list-container,
            body.dual-progress-bars-v211 .modal-overlay {
                bottom: 210px !important;
            }
            .jenny-deck-ctrl-btn-v211 {
                flex: 1;
                min-height: 42px;
                padding: 7px 12px !important;
                border-radius: 50px !important;
                background: linear-gradient(145deg, #160d2e, #090514) !important;
                color: var(--transport-accent, #a371f7) !important;
                border: 1.5px solid var(--border-uniform, rgba(115, 65, 190, 0.48)) !important;
                box-shadow: 0px 4px 0px #000000, inset 0px 2px 2px rgba(163, 113, 247, 0.22), 0px 6px 12px rgba(0,0,0,0.85) !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 6px !important;
                font-size: 11.5px !important;
                font-weight: 900 !important;
                cursor: pointer;
                transition: all 0.12s ease-in-out !important;
                user-select: none;
            }
            .jenny-deck-ctrl-btn-v211:active {
                transform: translateY(2px) scale(0.98) !important;
            }
            .jenny-deck-ctrl-btn-v211.deck-on-v211 {
                background: linear-gradient(145deg, #211246, #0d0720) !important;
                color: #ffffff !important;
                border-color: #a371f7 !important;
                box-shadow: 0px 3px 0px #000000, inset 0px 2px 4px rgba(163, 113, 247, 0.42), 0px 0px 14px rgba(163, 113, 247, 0.45) !important;
            }
            .jenny-deck-ctrl-btn-v211.deck-on-v211.deck-focused-v211 {
                border-color: var(--accent-cyan, #58a6ff) !important;
                box-shadow: 0px 3px 0px #000000, inset 0px 2px 4px rgba(88, 166, 255, 0.35), 0px 0px 16px rgba(88, 166, 255, 0.55) !important;
            }
            .jenny-deck-ctrl-btn-v211.deck-off-v211 {
                opacity: 0.62;
                color: #8b949e !important;
                border-color: rgba(115, 65, 190, 0.25) !important;
            }
            .jenny-deck-pill-badge-v211 {
                font-size: 9.5px;
                padding: 2px 6px;
                border-radius: 20px;
                font-family: monospace;
                font-weight: 900;
                background: rgba(0, 0, 0, 0.55);
                border: 1px solid rgba(255, 255, 255, 0.15);
            }
            .jenny-deck-ctrl-btn-v211.deck-on-v211 .jenny-deck-pill-badge-v211 {
                color: #00ff9d;
                border-color: #00ff9d;
                background: rgba(0, 255, 157, 0.14);
            }
        `;
        document.head.appendChild(st);
    }

    // 2. СОСТОЯНИЕ ДВУХ НЕЗАВИСИМЫХ ДЕК (МОЖЕТ РАБОТАТЬ ОДНА, ВТОРАЯ ИЛИ ОБЕ ВМЕСТЕ)
    var savedDecks = {};
    try { savedDecks = JSON.parse(localStorage.getItem('jenny_dual_decks_v211') || '{}') || {}; } catch (e) {}

    window._jennyDualDeckV211 = {
        deckA: savedDecks.deckA !== undefined ? Boolean(savedDecks.deckA) : true,
        deckB: savedDecks.deckB !== undefined ? Boolean(savedDecks.deckB) : false,
        uiFocus: (savedDecks.uiFocus === 'video') ? 'video' : 'music'
    };
    window._dualDeckModeV131 = true;
    if (window.videoDeckV131) window.videoDeckV131.dualMode = true;

    window.saveDualDeckStateV211 = function() {
        try { localStorage.setItem('jenny_dual_decks_v211', JSON.stringify(window._jennyDualDeckV211)); } catch (e) {}
    };

    // Гарантируем наличие разметки двух отдельных шкал в нижнем доке
    function ensureDualProgressBarsDOMV211() {
        var rowA = document.getElementById('deckAProgressRow');
        if (!rowA) {
            var leftA = document.getElementById('leftTimeBlock');
            if (leftA && leftA.parentElement) {
                rowA = leftA.parentElement;
                rowA.id = 'deckAProgressRow';
            }
        }
        if (!rowA) return false;

        var rowB = document.getElementById('deckBProgressRow');
        if (!rowB) {
            rowB = document.createElement('div');
            rowB.id = 'deckBProgressRow';
            rowB.style.cssText = 'display:none;gap:4px;height:48px;margin-bottom:6px;width:100%;';
            rowB.innerHTML =
                '<div id="leftTimeBlockDeckB" style="width:15%;min-width:54px;background:#000;border:1px solid var(--border-uniform);border-radius:50px 6px 6px 50px;display:flex;justify-content:center;align-items:center;cursor:pointer;touch-action:none;">' +
                    '<span id="currentTimeDeckB" class="time-display" style="color:#58a6ff;font-size:12.5px;">0:00</span>' +
                '</div>' +
                '<div id="seekZoneDeckB" style="flex-grow:1;background:#000;border:1px solid var(--border-uniform);border-radius:6px;display:flex;flex-direction:column;justify-content:center;position:relative;overflow:hidden;cursor:pointer;touch-action:none;">' +
                    '<div id="progressFillDeckB" style="position:absolute;left:0;top:0;height:100%;width:0%;background:rgba(115,65,190,0.45);pointer-events:none;transition:width 0.1s linear;"></div>' +
                    '<div style="position:relative;z-index:2;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 12px;">' +
                        '<span id="durationTimeDeckB" class="time-display" style="color:#8b949e;margin-bottom:1px;">0:00</span>' +
                        '<div class="track-title" id="nowPlayingDeckB" style="font-weight:normal;color:#e6edf3;width:100%;font-size:12.5px;">🎬 Дека Б: Выбери видео</div>' +
                        '<div id="speedLockIndicatorDeckB" style="display:none;color:#e3b341;font-size:10.5px;font-weight:bold;margin-top:1px;">🔒 ⏩ x2.0</div>' +
                    '</div>' +
                '</div>' +
                '<div id="rightTimeBlockDeckB" style="width:15%;min-width:54px;background:#000;border:1px solid var(--border-uniform);border-radius:6px 50px 50px 6px;display:flex;justify-content:center;align-items:center;cursor:pointer;touch-action:none;">' +
                    '<span id="remainingTimeDeckB" class="time-display" style="color:#e3b341;font-size:12.5px;">-0:00</span>' +
                '</div>';
            rowA.parentElement.insertBefore(rowB, rowA);
        }
        return true;
    }

    // Синхронизация видимости шкал прогресса Деки А и Деки Б и звуковых выходов
    window.syncDualDeckVisibilityAndAudioV211 = function() {
        ensureDualProgressBarsDOMV211();
        var st = window._jennyDualDeckV211;
        var rowA = document.getElementById('deckAProgressRow');
        var rowB = document.getElementById('deckBProgressRow');

        var showA = Boolean(st.deckA);
        var showB = Boolean(st.deckB);

        if (rowA) rowA.style.display = showA ? 'flex' : 'none';
        if (rowB) rowB.style.display = showB ? 'flex' : 'none';

        if (showA && showB) {
            document.body.classList.add('dual-progress-bars-v211');
        } else {
            document.body.classList.remove('dual-progress-bars-v211');
        }

        // Разрешаем одновременный звук обеих дек, если обе включены!
        var vd = window.videoDeckV131;
        if (vd && vd.masterAntiClickGain && vd.masterAntiClickGain.gain) {
            vd.masterAntiClickGain.gain.value = showB ? 1.0 : 0.0;
        }
        if (window.masterAntiClickGain && window.masterAntiClickGain.gain) {
            window.masterAntiClickGain.gain.value = showA ? 1.0 : 0.0;
        }
    };

    // Переключение состояния Деки А / Деки Б (взаимодополняемые тумблеры в стиле кнопок плеера)
    window.toggleComplementDeckV211 = function(whichDeck, ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        var d = window._jennyDualDeckV211;
        var isVideoBtn = (whichDeck === 'video' || whichDeck === 'B');

        // 1 клик = мгновенное независимое включение/выключение нажатой деки!
        if (isVideoBtn) {
            d.deckB = !d.deckB;
            if (d.deckB) {
                d.uiFocus = 'video';
            } else {
                var vEl = document.getElementById('jennyVideoElV130');
                if (vEl && !vEl.paused) { try { vEl.pause(); } catch (e) {} }
                if (window.videoDeckV131 && window.videoDeckV131.sourceNode) {
                    try { window.videoDeckV131.sourceNode.stop(); } catch (e) {}
                }
                if (d.deckA) d.uiFocus = 'music';
            }
        } else {
            d.deckA = !d.deckA;
            if (d.deckA) {
                d.uiFocus = 'music';
            } else {
                var aEl = document.getElementById('audioPlayer');
                if (aEl && !aEl.paused) { try { aEl.pause(); } catch (e) {} }
                if (window.studioSourceNode) {
                    try { window.studioSourceNode.stop(); } catch (e) {}
                }
                if (d.deckB) d.uiFocus = 'video';
            }
        }

        // БУНКЕР ДЕКИ А (#354): window.appConfig всегда остаётся конфигом Аудиодеки А!
        window._activeUiDeckV131 = 'music';
        window._musicConfigRefV131 = window.appConfig;
        if (d.deckB && typeof window.initVideoDeckAudioV131 === 'function') {
            window.initVideoDeckAudioV131();
        }

        window.saveDualDeckStateV211();
        window.syncDualDeckVisibilityAndAudioV211();
        if (typeof window.syncAllControlsToActiveDeckV131 === 'function') window.syncAllControlsToActiveDeckV131();
        window.renderDeckSwitchBannersV131();

        if (typeof window.showToast === 'function' && ev) {
            var modeStr = (d.deckA && d.deckB)
                ? '🔥 Дека А (Музыка) + Дека Б (Видео) работают ВМЕСТЕ!'
                : (d.deckB ? '🎬 Активна Дека Б: Видео' : (d.deckA ? '🎵 Активна Дека А: Музыка' : '⏸ Обе деки выключены'));
            window.showToast(modeStr);
        }
    };

    // Переопределяем рендер плашки дек в Настройках, Эквалайзере и Спектре (стиль управляющих кнопок плеера)
    window.renderDeckSwitchBannersV131 = function() {
        injectV211Styles();
        var d = window._jennyDualDeckV211 || { deckA: true, deckB: false, uiFocus: 'music' };
        var clsA = 'jenny-deck-ctrl-btn-v211 ' + (d.deckA ? 'deck-on-v211' : 'deck-off-v211') + (d.uiFocus === 'music' ? ' deck-focused-v211' : '');
        var clsB = 'jenny-deck-ctrl-btn-v211 ' + (d.deckB ? 'deck-on-v211' : 'deck-off-v211') + (d.uiFocus === 'video' ? ' deck-focused-v211' : '');

        var statusA = d.deckA ? 'ВКЛ' : 'ВЫКЛ';
        var statusB = d.deckB ? 'ВКЛ' : 'ВЫКЛ';

        var barHtml = function(barId) {
            return '<div id="' + barId + '" style="display:flex;flex-direction:column;gap:6px;padding:8px;background:#05070b;border:1px solid var(--border-uniform, #30363d);border-radius:16px;margin-bottom:10px;box-shadow:inset 0 1px 4px rgba(0,0,0,0.9);">' +
                '<div style="display:flex;align-items:center;gap:8px;width:100%;">' +
                    '<button type="button" class="' + clsA + '" onclick="window.toggleComplementDeckV211(\'music\', event)">' +
                        '<span>🎵 Дека А: Музыка</span>' +
                        '<span class="jenny-deck-pill-badge-v211">' + statusA + '</span>' +
                    '</button>' +
                    '<button type="button" class="' + clsB + '" onclick="window.toggleComplementDeckV211(\'video\', event)">' +
                        '<span>🎬 Дека Б: Видео</span>' +
                        '<span class="jenny-deck-pill-badge-v211">' + statusB + '</span>' +
                    '</button>' +
                '</div>' +
                (d.uiFocus === 'video'
                    ? '<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 4px 0 4px;">' +
                          '<span style="font-size:10px;color:#79c0ff;font-weight:bold;">🎛️ Ползунки ниже настраивают: Деку Б (Видео)</span>' +
                          '<button type="button" onclick="window.copyMusicDspToVideoV131(event)" style="padding:4px 8px;font-size:10px;font-weight:bold;border-radius:20px;background:linear-gradient(145deg,#160d2e,#090514);border:1px solid #3fb950;color:#3fb950;">📋 Скопировать DSP из Музыки</button>' +
                      '</div>'
                    : '<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 4px 0 4px;">' +
                          '<span style="font-size:10px;color:#d2a8ff;font-weight:bold;">🎛️ Ползунки ниже настраивают: Деку А (Музыка)</span>' +
                          '<span style="font-size:9.5px;color:#8b949e;">Можно включить обе деки сразу</span>' +
                      '</div>') +
            '</div>';
        };

        [['settingsModal', 'deckSwitchBarSettingsV131'], ['eqModal', 'deckSwitchBarEqV131'], ['specModal', 'deckSwitchBarSpecV131']].forEach(function(pair) {
            var m = document.getElementById(pair[0]);
            if (!m) return;
            var cont = m.querySelector('.container') || m;
            var ex = document.getElementById(pair[1]);
            if (!ex) {
                ex = document.createElement('div');
                cont.insertBefore(ex, cont.firstChild);
            }
            ex.outerHTML = barHtml(pair[1]);
        });
        if (typeof window.renderVCoreDeckPanelV166 === 'function') window.renderVCoreDeckPanelV166();
    };

    // 3. ЧЕТЫРЕ БУФЕРА ЗВУКА В RAM (2 ВПЕРЁД + 2 НАЗАД: АУДИО FWD, АУДИО REV, ВИДЕО FWD, ВИДЕО REV)
    // Восстанавливаем настоящий 6-поточный декодер видео в RAM и синхронно строим 4-й буфер (vd.reversedStudioBuffer)!
    window.decodeVideoToRamV131 = async function(streamUrl, titleStr) {
        if (typeof window.initVideoDeckAudioV131 === 'function') window.initVideoDeckAudioV131();
        const vd = window.videoDeckV131;
        if (!vd || !vd.ctx) return null;
        const mySess = ++vd.ramDecodeSession;
        if (vd.pieceAbortCtrl) { try { vd.pieceAbortCtrl.abort(); } catch (e) {} }
        vd.studioBuffer = null;
        vd.reversedStudioBuffer = null;

        const vid = document.getElementById('jennyVideoElV130');
        let dur = 0;
        try {
            const mr = await (window.fetchDeckBPcmWithPort8082 ? window.fetchDeckBPcmWithPort8082('/api/video/pcm_meta?src=' + encodeURIComponent(streamUrl)) : fetch('/api/video/pcm_meta?src=' + encodeURIComponent(streamUrl)));
            if (mr.ok) { const md = await mr.json(); dur = parseFloat(md.duration) || 0; }
        } catch (e) {}

        if (!dur && vid) {
            for (let w = 0; w < 25; w++) {
                if (mySess !== vd.ramDecodeSession) return null;
                const dCand = window.getEffectiveVideoDurationV210 ? window.getEffectiveVideoDurationV210(vid) : vid.duration;
                if (isFinite(dCand) && dCand > 0) { dur = dCand; break; }
                await new Promise(r => setTimeout(r, 120));
            }
        }
        if (dur <= 0 || mySess !== vd.ramDecodeSession) return null;
        if (window._vidStateV130) window._vidStateV130.trueDuration = dur;

        const srCandidates = (dur > 5400) ? [24000, 16000] : ((dur > 2400) ? [32000, 24000] : [44100, 32000]);
        let sr = srCandidates[0], totalFrames = 0, audioBuf = null, revAudioBuf = null;
        for (const candSr of srCandidates) {
            try {
                sr = candSr;
                totalFrames = Math.floor(dur * sr);
                audioBuf = vd.ctx.createBuffer(2, totalFrames, sr);
                revAudioBuf = vd.ctx.createBuffer(2, totalFrames, sr);
                if (audioBuf && revAudioBuf) break;
            } catch (e) {
                audioBuf = null;
                revAudioBuf = null;
            }
        }
        if (!audioBuf) {
            // Если фильм огромный и 2 полных буфера на 44.1кГц не влезли, берём на ступень ниже для пары FWD+REV
            for (const candSr of [24000, 16000, 12000]) {
                try {
                    sr = candSr;
                    totalFrames = Math.floor(dur * sr);
                    audioBuf = vd.ctx.createBuffer(2, totalFrames, sr);
                    revAudioBuf = vd.ctx.createBuffer(2, totalFrames, sr);
                    if (audioBuf && revAudioBuf) break;
                } catch (e) {}
            }
        }
        if (!audioBuf || mySess !== vd.ramDecodeSession) return null;

        const chL = audioBuf.getChannelData(0), chR = audioBuf.getChannelData(1);
        const revL = revAudioBuf ? revAudioBuf.getChannelData(0) : null;
        const revR = revAudioBuf ? revAudioBuf.getChannelData(1) : null;

        const PIECE_SEC = 45;
        const numPieces = Math.max(1, Math.ceil(dur / PIECE_SEC));
        const pieceMap = new Uint8Array(numPieces);
        const revPieceMap = new Uint8Array(numPieces);
        const failCounts = new Uint8Array(numPieces);

        audioBuf._pieceSecV72 = PIECE_SEC;
        audioBuf._pieceMapV72 = pieceMap;
        audioBuf._loadedCountV72 = 0;
        audioBuf._allPiecesLoadedV72 = false;
        audioBuf._trueDurationV72 = dur;
        audioBuf._ramTotalMbV134 = Math.round((totalFrames * 8 * (revAudioBuf ? 2 : 1)) / (1024 * 1024));

        if (revAudioBuf) {
            revAudioBuf._pieceSecV72 = PIECE_SEC;
            revAudioBuf._pieceMapV72 = revPieceMap;
            revAudioBuf._loadedCountV72 = 0;
            revAudioBuf._allPiecesLoadedV72 = false;
            revAudioBuf._trueDurationV72 = dur;
        }

        // Индикация "⏳ RAM (пока играет сжатый...): " на шкале Деки Б, пока в фоне собираются Буфер #3 (Вперёд) и Буфер #4 (Назад)
        const cleanTitleB = titleStr || (window._vidStateV130 && window._vidStateV130.currentTitle) || '';
        vd.title = cleanTitleB;
        vd._isLoadingRamV359 = true;
        vd._ramPiecesLoadedV359 = 0;
        vd._ramPiecesTotalV359 = numPieces;
        vd._ramDecodeStartWallMsV359 = performance.now();
        const npBInit = document.getElementById('nowPlayingDeckB');
        if (npBInit && cleanTitleB && (!vd.config || vd.config.studioMode !== false)) {
            npBInit.innerText = '⏳ RAM (пока играет сжатый...): ' + cleanTitleB;
        }
        const subTelInit = document.getElementById('v130VideoSubTelemetry');
        if (subTelInit && (!vd.config || vd.config.studioMode !== false)) {
            subTelInit.innerText = '⏳ Дека Б: распаковка в RAM (пока играет сжатый звук)...';
        }
        if (typeof window.refreshFourBuffersHudV359 === 'function') window.refreshFourBuffersHudV359();

        const fetchVideoPiece = async (pIdx, isUrgent) => {
            if (pIdx < 0 || pIdx >= numPieces || pieceMap[pIdx] === 2) return true;
            pieceMap[pIdx] = 1;
            const stSec = pIdx * PIECE_SEC;
            const dSec = Math.min(PIECE_SEC, dur - stSec);
            let ctrl = null;
            if (!isUrgent) {
                ctrl = new AbortController();
                vd.pieceAbortCtrl = ctrl;
            }
            try {
                const u = '/api/video/pcm_chunk?src=' + encodeURIComponent(streamUrl) + '&start=' + stSec + '&dur=' + dSec + '&sr=' + sr;
                const res = await (window.fetchDeckBPcmWithPort8082 ? window.fetchDeckBPcmWithPort8082(u, ctrl ? ctrl.signal : null) : fetch(u, ctrl ? { signal: ctrl.signal } : {}));
                if (!res.ok) { pieceMap[pIdx] = 0; return false; }
                const ab = await res.arrayBuffer();
                const frames = Math.floor(ab.byteLength / 8);
                if (frames <= 0) { pieceMap[pIdx] = 0; return false; }
                const startFrame = Math.min(totalFrames, Math.floor(stSec * sr));
                const maxCopy = Math.min(frames, totalFrames - startFrame);
                if (maxCopy > 0) {
                    const leftArr = new Float32Array(ab, 0, frames);
                    const rightArr = new Float32Array(ab, frames * 4, frames);
                    // Заполняем Буфер #3 (Видео Вперёд)
                    chL.set(leftArr.subarray(0, maxCopy), startFrame);
                    chR.set(rightArr.subarray(0, maxCopy), startFrame);
                    // Синхронно заполняем Буфер #4 (Видео Назад / Реверс)
                    if (revL && revR) {
                        let dstIdx = totalFrames - 1 - startFrame;
                        for (let i = 0; i < maxCopy; i++, dstIdx--) {
                            revL[dstIdx] = leftArr[i];
                            revR[dstIdx] = rightArr[i];
                        }
                    }
                }
                pieceMap[pIdx] = 2;
                revPieceMap[numPieces - 1 - pIdx] = 2;
                audioBuf._loadedCountV72++;
                if (revAudioBuf) revAudioBuf._loadedCountV72 = audioBuf._loadedCountV72;
                vd._ramPiecesLoadedV359 = audioBuf._loadedCountV72;
                vd._ramPiecesTotalV359 = numPieces;
                if (audioBuf._loadedCountV72 === 1) {
                    const elapsedMs = performance.now() - (vd._ramDecodeStartWallMsV359 || 0);
                    if (elapsedMs < 1100 && mySess === vd.ramDecodeSession) {
                        await new Promise(r => setTimeout(r, 1100 - elapsedMs));
                    }
                    if (mySess !== vd.ramDecodeSession) return false;
                    // Публикуем Буфер #3 (Видео ВПЕРЁД) и Буфер #4 (Видео НАЗАД) для бесшовной подмены!
                    vd.studioBuffer = audioBuf;
                    vd.reversedStudioBuffer = revAudioBuf;
                    if (vd.config && vd.config.opt_autoRms) {
                        window.computeBufferAutoGainDeckB(audioBuf, vd.config.val_autoRms);
                        // Не вызываем buildVideoAudioGraphV131() во время живого воспроизведения видео,
                        // чтобы не разрывать vd.inputMixer.disconnect() и не сбивать буфер WebAudio!
                        if (!window._vidStateV130 || !window._vidStateV130.active) {
                            window.buildVideoAudioGraphV131();
                        }
                    }
                }
                if (typeof window.refreshFourBuffersHudV359 === 'function') window.refreshFourBuffersHudV359();
                return true;
            } catch (e) {
                pieceMap[pIdx] = 0;
                return false;
            }
        };

        const pickNextPieceIdx = () => {
            const curSec = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid ? vid.currentTime : 0);
            const curPiece = Math.max(0, Math.min(numPieces - 1, Math.floor(curSec / PIECE_SEC)));
            const isRev = Boolean(window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed) || vd.isReversed);
            const stepDir = isRev ? -1 : 1;
            for (let look = 0; look < 3; look++) {
                const cand = curPiece + look * stepDir;
                if (cand >= 0 && cand < numPieces && pieceMap[cand] === 0 && failCounts[cand] < 4) {
                    return { idx: cand, urgent: look <= 1 };
                }
            }
            for (let offset = 0; offset < numPieces; offset++) {
                const cand = (curPiece + offset) % numPieces;
                if (pieceMap[cand] === 0 && failCounts[cand] < 4) {
                    return { idx: cand, urgent: false };
                }
            }
            return null;
        };

        const workerLoop = async () => {
            while (mySess === vd.ramDecodeSession && window._vidStateV130 && window._vidStateV130.active) {
                const task = pickNextPieceIdx();
                if (!task) break;
                const ok = await fetchVideoPiece(task.idx, task.urgent);
                if (mySess !== vd.ramDecodeSession) return;
                if (ok) {
                    if (task.urgent) window.syncVideoRamEngineV211(false);
                } else {
                    failCounts[task.idx]++;
                    await new Promise(r => setTimeout(r, 120));
                }
            }
        };

        await Promise.all([workerLoop(), workerLoop()]);
        if (mySess === vd.ramDecodeSession) {
            vd._isLoadingRamV359 = false;
            if (audioBuf._loadedCountV72 >= numPieces) {
                audioBuf._allPiecesLoadedV72 = true;
                if (revAudioBuf) revAudioBuf._allPiecesLoadedV72 = true;
            }
            const subTelDone = document.getElementById('v130VideoSubTelemetry');
            if (subTelDone && vd.studioBuffer) {
                subTelDone.innerText = vd.reversedStudioBuffer
                    ? 'Дека Б: RAM ⏩⏪ 🚀 (Буферы #3 Вперёд и #4 Реверс в ОЗУ)'
                    : 'Дека Б: RAM 🚀 (Буфер #3 в ОЗУ)';
            }
            if (typeof window.refreshFourBuffersHudV359 === 'function') window.refreshFourBuffersHudV359();
            window.syncVideoRamEngineV211(false);
        }
        return audioBuf;
    };

    // Полноценный движок воспроизведения пары буферов Деки Б (Видео Вперёд vd.studioBuffer + Видео Назад vd.reversedStudioBuffer)
    window.syncVideoRamEngineV211 = window.syncVideoRamEngineV131 = function(isDragging) {
        const vd = window.videoDeckV131, st = window._vidStateV130, vid = document.getElementById('jennyVideoElV130');
        if (!vid || !vd || !vd.ctx || !st || !st.active) return;
        if (vd.horizonTimer) { clearTimeout(vd.horizonTimer); vd.horizonTimer = null; }
        if (vd.revFrameTimer) { clearInterval(vd.revFrameTimer); vd.revFrameTimer = null; }

        const gKey = (vd.config && vd.config.gearKeyV66) || 'jbuf-lock';
        const isRev = Boolean(window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed) || vd.isReversed);
        vd.isReversed = isRev;
        const targetSpd = Math.max(0.1, Math.min(16.0, window.getTargetPlaybackSpeedDeckB ? window.getTargetPlaybackSpeedDeckB() : (vd.speed || 1.0)));
        vd.speed = targetSpd;

        const curSec = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid.currentTime || 0);
        const pSec = (vd.studioBuffer && vd.studioBuffer._pieceSecV72) || 45;
        const curP = (vd.studioBuffer && vd.studioBuffer._pieceMapV72 && vd.studioBuffer._pieceMapV72.length > 0)
            ? Math.max(0, Math.min(vd.studioBuffer._pieceMapV72.length - 1, Math.floor((isRev ? Math.max(0, curSec - 1.0) : curSec) / pSec)))
            : -1;
        const isPieceReady = Boolean(vd.studioBuffer && (!vd.studioBuffer._pieceMapV72 || vd.studioBuffer._pieceMapV72.length === 0 || vd.studioBuffer._pieceMapV72[curP] === 2));
        const useRamEngine = isPieceReady && (isRev || gKey === 'jbuf-lock' || gKey === 'jbuf-shift' || gKey === 'vinyl-shift');

        if (!useRamEngine) {
            if (vd.sourceNode) {
                vd.sourceNode.onended = null;
                try { vd.sourceNode.stop(); } catch (e) {}
                try { vd.sourceNode.disconnect(); } catch (e) {}
                vd.sourceNode = null;
            }
            vd.isStudioPlaying = false;
            if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = st.dspBypass ? 0.0 : 1.0;
            if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = st.dspBypass ? 1.0 : 0.0;
            const lockPitch = (gKey !== 'web-shift' && gKey !== 'jbuf-shift' && gKey !== 'vinyl-shift');
            vid.preservesPitch = lockPitch; vid.mozPreservesPitch = lockPitch; vid.webkitPreservesPitch = lockPitch;
            if (Math.abs(vid.playbackRate - targetSpd) > 0.005) { try { vid.playbackRate = targetSpd; } catch (e) {} }
            return;
        }

        if (vd.htmlGain && vd.htmlGain.gain) vd.htmlGain.gain.value = 0.0;
        if (vd.directBypassGain && vd.directBypassGain.gain) vd.directBypassGain.gain.value = 0.0;
        const WIN_SEC = Math.max(18.0, Math.min(60.0, targetSpd * 18.0));

        // Если активен реверс Деки Б и готов Буфер #4 (vd.reversedStudioBuffer) — режем напрямую из обратного буфера!
        let rawWinBuf = null;
        if (isRev && vd.reversedStudioBuffer) {
            const dur = vd.reversedStudioBuffer.duration;
            const revStartSec = Math.max(0, Math.min(dur - 0.05, dur - curSec));
            rawWinBuf = window.extractVideoWindowBufferV131(vd.reversedStudioBuffer, revStartSec, WIN_SEC, false);
        } else {
            rawWinBuf = window.extractVideoWindowBufferV131(vd.studioBuffer, curSec, WIN_SEC, isRev);
        }
        if (!rawWinBuf) return;

        let playBuf = rawWinBuf, nodeRate = 1.0;
        if (gKey === 'jbuf-lock') {
            const tensionPct = (vd.config && vd.config.hoseTensionPct !== undefined) ? vd.config.hoseTensionPct : 100;
            playBuf = window.buildElasticHoseBufferDeckB(rawWinBuf, targetSpd, tensionPct);
            nodeRate = 1.0;
        } else {
            playBuf = rawWinBuf;
            nodeRate = targetSpd;
        }

        if (vd.sourceNode) {
            vd.sourceNode.onended = null;
            try { vd.sourceNode.stop(); } catch (e) {}
            try { vd.sourceNode.disconnect(); } catch (e) {}
            vd.sourceNode = null;
        }

        if ((!vid.paused || isRev) && !st.userPaused && window._jennyDualDeckV211.deckB) {
            vd.sourceNode = vd.ctx.createBufferSource();
            vd.sourceNode.buffer = playBuf;
            vd.sourceNode.playbackRate.value = nodeRate;
            vd.sourceNode.connect(st.dspBypass ? vd.directBypassGain : vd.inputMixer);
            if (st.dspBypass && vd.directBypassGain) vd.directBypassGain.gain.value = 1.0;
            vd.sourceNode.start(0, 0);
            vd.isStudioPlaying = true;

            if (isRev) {
                if (!vid.paused) { st._internalRevPause = true; vid.pause(); }
                const startCtxT = vd.ctx.currentTime, startVidSec = curSec;
                vd.revFrameTimer = setInterval(() => {
                    if (!st.active || st.userPaused || !vd.isReversed) {
                        clearInterval(vd.revFrameTimer);
                        vd.revFrameTimer = null;
                        return;
                    }
                    const nextSec = Math.max(0, startVidSec - (vd.ctx.currentTime - startCtxT) * targetSpd);
                    if (Math.abs(vid.currentTime - nextSec) >= 0.04) { try { vid.currentTime = nextSec; } catch (e) {} }
                    if (nextSec <= 0.05) {
                        window.toggleReverseModeDeckB(false);
                    }
                }, 45);
            } else {
                if (Math.abs(vid.playbackRate - targetSpd) > 0.005) { try { vid.playbackRate = targetSpd; } catch (e) {} }
            }

            const realDurSec = (gKey === 'jbuf-lock') ? playBuf.duration : (playBuf.duration / Math.max(0.25, nodeRate));
            vd.horizonTimer = setTimeout(() => {
                if (st.active && !st.userPaused) window.syncVideoRamEngineV211(false);
            }, Math.max(400, (realDurSec - 0.9) * 1000));
        }
    };

    // 4. ПОЛНОСТЬЮ ИЗОЛИРОВАННЫЕ ФУНКЦИИ И ЖЕСТЫ ВТОРОЙ ШКАЛЫ ПРОГРЕССА (ДЕКА Б: ВИДЕО)
    window.scrubStateDeckB = {
        active: false,
        locked: false,
        side: null,
        speed: 1.0,
        isPhysicallyReversed: false
    };
    window.persistedPlaybackSpeedDeckB = null;
    window.persistedPlaybackSideDeckB = 'right';

    window.getBaseSpeedDeckB = function() {
        var vd = window.videoDeckV131;
        if (vd && vd.config && vd.config.xNormalSpeed && vd.config.normalPlaybackSpeed) {
            return parseFloat(vd.config.normalPlaybackSpeed) || 1.0;
        }
        return 1.0;
    };

    window.getTargetPlaybackSpeedDeckB = function() {
        if (window.scrubStateDeckB && (window.scrubStateDeckB.active || window.scrubStateDeckB.locked) && window.scrubStateDeckB.speed) {
            return window.scrubStateDeckB.speed;
        }
        if (window.persistedPlaybackSpeedDeckB) return window.persistedPlaybackSpeedDeckB;
        return window._jennyVideoSpeedV170 || window.getBaseSpeedDeckB();
    };

    // Обновление UI верхней шкалы прогресса (#deckBProgressRow) строго для Видео (Дека Б)
    window.updateProgressUIDeckB = function(currentTime, duration, isReverseVisual) {
        var pFill = document.getElementById('progressFillDeckB');
        var cTime = document.getElementById('currentTimeDeckB');
        var rTime = document.getElementById('remainingTimeDeckB');
        var dTime = document.getElementById('durationTimeDeckB');
        var npEl  = document.getElementById('nowPlayingDeckB');

        var fmt = window.formatVideoTimeV210 || window.formatTime || function(s) {
            var m = Math.floor(s / 60), sc = Math.floor(s % 60);
            return m + ':' + (sc < 10 ? '0' + sc : sc);
        };

        if (pFill && isFinite(duration) && duration > 0) {
            var perc = Math.max(0, Math.min(100, (currentTime / duration) * 100));
            pFill.style.transform = 'none';
            if (isReverseVisual) {
                pFill.style.left = 'auto';
                pFill.style.right = '0';
                pFill.style.width = (100 - perc) + '%';
            } else {
                pFill.style.right = 'auto';
                pFill.style.left = '0';
                pFill.style.width = perc + '%';
            }
        }

        if (isFinite(duration) && duration > 0) {
            var rem = Math.max(0, duration - currentTime);
            if (isReverseVisual) {
                if (cTime) cTime.innerText = '-' + fmt(rem);
                if (rTime) rTime.innerText = fmt(currentTime);
                if (dTime) dTime.innerText = '⏪ ' + fmt(rem) + ' / ' + fmt(duration);
            } else {
                if (cTime) cTime.innerText = fmt(currentTime);
                if (rTime) rTime.innerText = '-' + fmt(rem);
                if (dTime) dTime.innerText = fmt(currentTime) + ' / ' + fmt(duration);
            }
        }

        if (npEl) {
            var st = window._vidStateV130 || {};
            var vd = window.videoDeckV131 || {};
            var vEl = document.getElementById('jennyVideoElV130');
            var rawTitle = st.currentTitle || vd.title || (vEl && vEl.getAttribute('data-title')) ||
                           (vEl && vEl.src ? decodeURIComponent(vEl.src.split('/').pop().split('?')[0]) : '');
            if (rawTitle) {
                var hasFwd = Boolean(vd.studioBuffer);
                var hasRev = Boolean(vd.reversedStudioBuffer);
                var ramTag = (hasFwd && hasRev) ? 'RAM 🚀: ' : (hasFwd ? 'RAM 🚀: ' : '🎬 ');
                npEl.innerText = ramTag + rawTitle;
            }
        }
    };

    // Скраббинг и замок скорости строго для Деки Б (Видео)
    window.startScrubDeckB = function(side, speed) {
        var vid = document.getElementById('jennyVideoElV130');
        var vd = window.videoDeckV131;
        var st = window._vidStateV130;
        if (!vid || !vd || !st || !st.active) return;

        var wantReverseNow = (side === 'left');
        window.scrubStateDeckB.active = true;
        window.scrubStateDeckB.side = side;
        window.scrubStateDeckB.speed = speed;
        window.scrubStateDeckB.isPhysicallyReversed = wantReverseNow;
        if (!wantReverseNow) {
            window.isReversedDeckB = false;
        }
        vd.isReversed = wantReverseNow;
        window._jennyVideoSpeedV170 = speed;
        vd.speed = speed;

        window.persistedPlaybackSpeedDeckB = speed;
        window.persistedPlaybackSideDeckB = side;

        var lockEl = document.getElementById('speedLockIndicatorDeckB');
        if (lockEl) {
            lockEl.style.display = 'block';
            lockEl.innerText = (window.scrubStateDeckB.locked ? '🔒' : '🔄') + ' ' + (wantReverseNow ? '⏪' : '⏩') + ' x' + speed;
        }

        if (!wantReverseNow && !st.userPaused && vid.paused) {
            st._internalRevPause = false;
            vid.play().catch(function(){});
        }
        if (typeof window.updateVideoRevBtnUIV131 === 'function') window.updateVideoRevBtnUIV131();
        window.syncVideoRamEngineV211(true);
    };

    window.stopScrubDeckB = function(keepLockedSpeed) {
        var vid = document.getElementById('jennyVideoElV130');
        var vd = window.videoDeckV131;
        var st = window._vidStateV130;
        if (!window.scrubStateDeckB.active && !window.scrubStateDeckB.locked && !window.isReversedDeckB) return;

        if (!keepLockedSpeed) {
            window.scrubStateDeckB.active = false;
            window.scrubStateDeckB.locked = false;
            window.scrubStateDeckB.side = null;
            window.scrubStateDeckB.speed = window.getBaseSpeedDeckB();
            window.scrubStateDeckB.isPhysicallyReversed = false;
            window.persistedPlaybackSpeedDeckB = null;
            window.persistedPlaybackSideDeckB = 'right';

            var lockEl = document.getElementById('speedLockIndicatorDeckB');
            if (lockEl) lockEl.style.display = 'none';
        } else {
            window.scrubStateDeckB.active = false;
        }

        var nowReversed = Boolean(window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed));
        var baseSpd = (keepLockedSpeed && window.persistedPlaybackSpeedDeckB)
            ? window.persistedPlaybackSpeedDeckB
            : window.getBaseSpeedDeckB();

        window._jennyVideoSpeedV170 = baseSpd;
        if (vd) {
            vd.isReversed = nowReversed;
            vd.speed = baseSpd;
        }
        if (vid && !nowReversed && st && !st.userPaused && vid.paused) {
            st._internalRevPause = false;
            vid.play().catch(function(){});
        }
        if (typeof window.updateVideoRevBtnUIV131 === 'function') window.updateVideoRevBtnUIV131();
        window.syncVideoRamEngineV211(false);
    };

    // Боковые таймеры верхней шкалы (#leftTimeBlockDeckB и #rightTimeBlockDeckB) — 100% отдельно от Деки А
    window.setupTimeBlockControlsDeckB = function() {
        var leftBlock = document.getElementById('leftTimeBlockDeckB');
        var rightBlock = document.getElementById('rightTimeBlockDeckB');
        if (!leftBlock || !rightBlock || leftBlock._v211Bound) return;
        leftBlock._v211Bound = true;

        var pressTimer = null;
        var isLongPress = false;
        var jumpInterval = null;
        var wasPlayingBeforeJump = false;

        var startSilent10xSeekDeckB = function(dirSign) {
            var vid = document.getElementById('jennyVideoElV130');
            if (!vid) return;
            wasPlayingBeforeJump = !vid.paused;
            vid.pause();
            if (jumpInterval) clearInterval(jumpInterval);
            jumpInterval = setInterval(function() {
                var dur = window.getEffectiveVideoDurationV210 ? window.getEffectiveVideoDurationV210(vid) : (vid.duration || 0);
                var cur = window.getEffectiveVideoCurrentTimeV167 ? window.getEffectiveVideoCurrentTimeV167(vid) : (vid.currentTime || 0);
                if (!isFinite(dur) || dur <= 0) return;
                var isVisualReverse = Boolean(window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed));
                var step = isVisualReverse ? (-dirSign * 1.0) : (dirSign * 1.0);
                var nextSec = Math.max(0, Math.min(dur - 0.05, cur + step));
                if (typeof window.seekVideoToExactSecondV167 === 'function') {
                    window.seekVideoToExactSecondV167(nextSec);
                } else {
                    vid.currentTime = nextSec;
                }
                window.updateProgressUIDeckB(nextSec, dur, isVisualReverse);
            }, 100);
        };

        var stopSilent10xSeekDeckB = function() {
            if (jumpInterval) {
                clearInterval(jumpInterval);
                jumpInterval = null;
            }
            var vid = document.getElementById('jennyVideoElV130');
            if (vid && wasPlayingBeforeJump && !window.isReversedDeckB) {
                vid.play().then(function() {
                    window.syncVideoRamEngineV211(false);
                }).catch(function(){});
            } else {
                window.syncVideoRamEngineV211(false);
            }
        };

        leftBlock.addEventListener('touchstart', function(e) {
            e.stopPropagation();
            isLongPress = false;
            clearTimeout(pressTimer);
            pressTimer = setTimeout(function() {
                isLongPress = true;
                try { navigator.vibrate(30); } catch (err) {}
                startSilent10xSeekDeckB(-1);
            }, 420);
        }, { passive: true });

        leftBlock.addEventListener('touchend', function(e) {
            e.stopPropagation();
            clearTimeout(pressTimer);
            if (isLongPress) {
                stopSilent10xSeekDeckB();
            } else {
                window.toggleReverseModeDeckB(true);
            }
        });

        leftBlock.addEventListener('touchcancel', function(e) {
            e.stopPropagation();
            clearTimeout(pressTimer);
            if (isLongPress) stopSilent10xSeekDeckB();
        });

        rightBlock.addEventListener('touchstart', function(e) {
            e.stopPropagation();
            isLongPress = false;
            clearTimeout(pressTimer);
            pressTimer = setTimeout(function() {
                isLongPress = true;
                try { navigator.vibrate(30); } catch (err) {}
                startSilent10xSeekDeckB(+1);
            }, 420);
        }, { passive: true });

        rightBlock.addEventListener('touchend', function(e) {
            e.stopPropagation();
            clearTimeout(pressTimer);
            if (isLongPress) {
                stopSilent10xSeekDeckB();
            } else {
                window.toggleReverseModeDeckB(false);
            }
        });

        rightBlock.addEventListener('touchcancel', function(e) {
            e.stopPropagation();
            clearTimeout(pressTimer);
            if (isLongPress) stopSilent10xSeekDeckB();
        });
    };

    // Центральная зона и радиальная дуга скорости верхней шкалы (#seekZoneDeckB) — 100% отдельно от Деки А (собственный оверлей и канвас!)
    window.setupSeekZoneDeckB = function() {
        var zone = document.getElementById('seekZoneDeckB');
        if (!zone || zone._v211Bound) return;

        var overlay = document.getElementById('scrubOverlayDeckB');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'scrubOverlayDeckB';
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483646 !important;display:none;touch-action:none;';
            document.body.appendChild(overlay);
        }
        var arcContainer = document.getElementById('speedArcContainerDeckB');
        if (!arcContainer) {
            arcContainer = document.createElement('div');
            arcContainer.id = 'speedArcContainerDeckB';
            arcContainer.style.cssText = 'position:fixed;inset:0;z-index:2147483647 !important;pointer-events:none;transition:opacity 0.1s ease-out;opacity:0;display:none;';
            document.body.appendChild(arcContainer);
        }
        var debugCanvas = document.getElementById('debugZoneCanvasDeckB');
        if (!debugCanvas) {
            debugCanvas = document.createElement('canvas');
            debugCanvas.id = 'debugZoneCanvasDeckB';
            debugCanvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;width:100%;height:100%;z-index:5998;';
            overlay.appendChild(debugCanvas);
        }
        zone._v211Bound = true;

        var startY = 0;
        var isPullingDown = false;
        var isScrubbing = false;
        var isSeekingAllowed = true;
        var scrubSide = null;
        var currentTempSpeed = null;
        var arcItems = [];
        var circleAngles = [];
        var currentAnchor = { x: 0, y: 0 };
        var pressTimer = null;
        var activeTouchDeckB = false;

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
        function angleDiffSigned(a, b) {
            return ((a - b) % 360 + 540) % 360 - 180;
        }

        function handleTapSeekDeckB(x) {
            if (x === undefined || isNaN(x)) return;
            var rect = zone.getBoundingClientRect();
            if (rect.width <= 10) return;
            var perc = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
            var vid = document.getElementById('jennyVideoElV130');
            if (!vid) return;
            var dur = window.getEffectiveVideoDurationV210 ? window.getEffectiveVideoDurationV210(vid) : (vid.duration || 0);
            if (isFinite(dur) && dur > 0) {
                var isVisualReverse = Boolean(window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed));
                if (isVisualReverse) perc = 1.0 - perc;
                var targetSec = perc * dur;
                if (typeof window.seekVideoToExactSecondV167 === 'function') {
                    window.seekVideoToExactSecondV167(targetSec);
                } else {
                    vid.currentTime = targetSec;
                }
                window.syncVideoRamEngineV211(false);
                window.updateProgressUIDeckB(targetSec, dur, isVisualReverse);
            }
        }

        function generateArcDeckB() {
            arcContainer.innerHTML = '';
            arcItems = [];
            circleAngles = [];

            var activeZones = [];
            for (var i = 1; i <= 6; i++) {
                var en = document.getElementById('cfg_z' + i + '_en');
                var val = document.getElementById('cfg_z' + i + '_val');
                if (en && en.checked && val) {
                    activeZones.push(parseFloat(val.value) || 1.0);
                }
            }
            if (activeZones.length === 0) activeZones = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

            var isLeftHanded = Boolean(window.appConfig && window.appConfig.leftHandedMode);
            var W = window.innerWidth;
            var H = window.innerHeight;

            var eqBtn = document.getElementById('btn-eqModal');
            if (eqBtn) {
                var eqRect = eqBtn.getBoundingClientRect();
                currentAnchor.x = eqRect.left + eqRect.width / 2;
                currentAnchor.y = eqRect.top + eqRect.height / 2;
            } else {
                currentAnchor.y = H - 135;
                currentAnchor.x = isLeftHanded ? 31 : (W - 31);
            }

            var startDeg = -108, endDeg = -204;
            var rTop = Math.min(W * 0.76, H * 0.35);
            var rMid = Math.min(W * 0.78, H * 0.36);
            var rBot = Math.min(W * 0.58, H * 0.26);

            function sampleCurvePoint(u) {
                var deg = startDeg + u * (endDeg - startDeg);
                var rad = deg * Math.PI / 180;
                var r = (1 - u) * (1 - u) * rTop + 2 * (1 - u) * u * rMid + u * u * rBot;
                var dxRH = r * Math.cos(rad);
                var dy = r * Math.sin(rad);
                var x = currentAnchor.x + (isLeftHanded ? -dxRH : dxRH);
                var y = currentAnchor.y + dy;
                return { x: Math.max(30, Math.min(W - 30, x)), y: Math.max(150, Math.min(H - 32, y)) };
            }

            var STEPS = 240, samples = [], totalLen = 0;
            for (var k = 0; k <= STEPS; k++) {
                var pt = sampleCurvePoint(k / STEPS);
                if (k > 0) totalLen += Math.hypot(pt.x - samples[k - 1].x, pt.y - samples[k - 1].y);
                samples.push({ x: pt.x, y: pt.y, s: totalLen });
            }

            var count = activeZones.length, positions = [];
            for (var j = 0; j < count; j++) {
                var targetS = count === 1 ? (totalLen * 0.5) : (totalLen * (j / (count - 1)));
                var best = samples[0];
                for (var m = 0; m < samples.length; m++) {
                    if (samples[m].s >= targetS) { best = samples[m]; break; }
                }
                positions.push(best);
            }

            activeZones.forEach(function(val, index) {
                if (index >= positions.length) return;
                var el = document.createElement('div');
                el.className = 'arc-item';
                el.innerText = 'x' + (val % 1 === 0 ? val.toFixed(1) : val.toString());
                el.dataset.val = val;
                el.style.left = (positions[index].x - 24) + 'px';
                el.style.top = (positions[index].y - 24) + 'px';
                var angle = Math.atan2(positions[index].y - currentAnchor.y, positions[index].x - currentAnchor.x) * 180 / Math.PI;
                circleAngles.push(angle);
                arcContainer.appendChild(el);
                arcItems.push(el);
            });

            arcContainer.style.display = 'block';
            setTimeout(function() { arcContainer.style.opacity = '1'; }, 10);

            debugCanvas.width = window.innerWidth;
            debugCanvas.height = window.innerHeight;
            var ctx = debugCanvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
                var coreGrad = ctx.createRadialGradient(currentAnchor.x, currentAnchor.y, 2, currentAnchor.x, currentAnchor.y, 24);
                coreGrad.addColorStop(0, 'rgba(88, 166, 255, 0.95)');
                coreGrad.addColorStop(0.5, 'rgba(163, 113, 247, 0.45)');
                coreGrad.addColorStop(1, 'rgba(115, 65, 190, 0)');
                ctx.beginPath();
                ctx.arc(currentAnchor.x, currentAnchor.y, 24, 0, 2 * Math.PI);
                ctx.fillStyle = coreGrad;
                ctx.fill();
                var radius = Math.max(window.innerWidth, window.innerHeight) * 0.95;
                ctx.lineWidth = 1.6;
                ctx.setLineDash([7, 8]);
                for (var li = 0; li < circleAngles.length - 1; li++) {
                    var delta = angleDiffSigned(circleAngles[li + 1], circleAngles[li]);
                    var midAngle = circleAngles[li] + delta / 2;
                    var rad = midAngle * Math.PI / 180;
                    var endX = currentAnchor.x + radius * Math.cos(rad);
                    var endY = currentAnchor.y + radius * Math.sin(rad);
                    var lineGrad = ctx.createLinearGradient(currentAnchor.x, currentAnchor.y, endX, endY);
                    lineGrad.addColorStop(0, 'rgba(88, 166, 255, 0.65)');
                    lineGrad.addColorStop(0.55, 'rgba(163, 113, 247, 0.35)');
                    lineGrad.addColorStop(1, 'rgba(88, 166, 255, 0.0)');
                    ctx.strokeStyle = lineGrad;
                    ctx.beginPath();
                    ctx.moveTo(currentAnchor.x, currentAnchor.y);
                    ctx.lineTo(endX, endY);
                    ctx.stroke();
                }
                ctx.setLineDash([]);
            }
        }

        zone.addEventListener('touchstart', function(e) {
            e.stopPropagation();
            activeTouchDeckB = true;
            var startX = getX(e);
            startY = getY(e);
            var rect = zone.getBoundingClientRect();
            var perc = (startX - rect.left) / Math.max(1, rect.width);

            if (perc < 0.33) scrubSide = 'left';
            else if (perc > 0.66) scrubSide = 'right';
            else scrubSide = 'center';

            isPullingDown = false;
            currentTempSpeed = null;
            isScrubbing = false;
            isSeekingAllowed = true;

            if (scrubSide === 'center') {
                pressTimer = setTimeout(function() {
                    pressTimer = null;
                    isSeekingAllowed = false;
                    try { navigator.vibrate(50); } catch (err) {}

                    if (window.isReversedDeckB || (window.scrubStateDeckB && window.scrubStateDeckB.isPhysicallyReversed)) {
                        window.toggleReverseModeDeckB(false);
                    } else if (window.scrubStateDeckB.active || window.scrubStateDeckB.locked) {
                        window.stopScrubDeckB(false);
                    }
                    var baseSpd = window.getBaseSpeedDeckB();
                    window._jennyVideoSpeedV170 = baseSpd;
                    if (window.videoDeckV131) window.videoDeckV131.speed = baseSpd;
                    var vid = document.getElementById('jennyVideoElV130');
                    if (vid) { try { vid.playbackRate = baseSpd; } catch (err) {} }
                    window.syncVideoRamEngineV211(false);

                    var lockEl = document.getElementById('speedLockIndicatorDeckB');
                    if (lockEl) {
                        lockEl.style.display = 'block';
                        lockEl.innerText = '✅ Норм: x' + baseSpd;
                        setTimeout(function() {
                            if (!window.scrubStateDeckB.active && !window.scrubStateDeckB.locked) {
                                lockEl.style.display = 'none';
                            }
                        }, 1000);
                    }
                }, 160);
            } else {
                pressTimer = setTimeout(function() {
                    pressTimer = null;
                    isScrubbing = true;
                    if (window.scrubStateDeckB.locked) {
                        window.scrubStateDeckB.locked = false;
                        try { navigator.vibrate(50); } catch (err) {}
                    } else {
                        try { navigator.vibrate(30); } catch (err) {}
                    }
                    var vdCfg = (window.videoDeckV131 && window.videoDeckV131.config) || window.appConfig || {};
                    var defSpeed = parseFloat(vdCfg.defaultScrubSpeed) || 2.0;
                    window.startScrubDeckB(scrubSide, defSpeed);
                }, 250);
            }
        }, { passive: true });

        function handleTouchMoveDeckB(e) {
            if (!activeTouchDeckB) return;
            var curX = getX(e);
            var curY = getY(e);
            var deltaY = curY - startY;

            if (scrubSide === 'center') {
                if (Math.abs(deltaY) > 15 && pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
                return;
            }

            var threshold = window.innerHeight * 0.05;
            if (Math.abs(deltaY) > threshold || isScrubbing) {
                isSeekingAllowed = false;
                if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }

                if (!isScrubbing) {
                    isScrubbing = true;
                    if (window.scrubStateDeckB.locked) window.scrubStateDeckB.locked = false;
                }

                if (!isPullingDown) {
                    isPullingDown = true;
                    overlay.style.display = 'block';
                    generateArcDeckB();
                    var vdCfg = (window.videoDeckV131 && window.videoDeckV131.config) || window.appConfig || {};
                    var defSpeed = parseFloat(vdCfg.defaultScrubSpeed) || 2.0;
                    window.startScrubDeckB(scrubSide, defSpeed);
                }

                var dx = curX - currentAnchor.x;
                var dy = curY - currentAnchor.y;
                var fingerAngle = Math.atan2(dy, dx) * 180 / Math.PI;

                var minDiff = Infinity, idx = 0;
                circleAngles.forEach(function(ang, i) {
                    var diff = Math.abs(angleDiffSigned(fingerAngle, ang));
                    if (diff < minDiff) { minDiff = diff; idx = i; }
                });

                if (arcItems[idx] && !arcItems[idx].classList.contains('active')) {
                    arcItems.forEach(function(el) { el.classList.remove('active'); });
                    arcItems[idx].classList.add('active');
                    currentTempSpeed = parseFloat(arcItems[idx].dataset.val);
                    window.startScrubDeckB(scrubSide, currentTempSpeed);
                    try { navigator.vibrate(15); } catch (err) {}
                }
            }
        }

        function handleTouchEndDeckB(e) {
            if (!activeTouchDeckB) return;
            activeTouchDeckB = false;

            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
                if (isSeekingAllowed) handleTapSeekDeckB(getX(e));
            } else if (isScrubbing) {
                arcContainer.style.opacity = '0';
                setTimeout(function() { arcContainer.style.display = 'none'; }, 150);

                if (isPullingDown && currentTempSpeed) {
                    window.scrubStateDeckB.locked = true;
                    window.startScrubDeckB(scrubSide, currentTempSpeed);
                } else if (!window.scrubStateDeckB.locked) {
                    window.stopScrubDeckB(false);
                }
            }

            overlay.style.display = 'none';
            isPullingDown = false;
            isScrubbing = false;
            scrubSide = null;

            var dbg = document.getElementById('debugZoneCanvasDeckB');
            if (dbg) {
                var ctx = dbg.getContext('2d');
                if (ctx) ctx.clearRect(0, 0, dbg.width, dbg.height);
            }
        }

        zone.addEventListener('touchmove', handleTouchMoveDeckB, { passive: true });
        overlay.addEventListener('touchmove', handleTouchMoveDeckB, { passive: false });
        zone.addEventListener('touchend', handleTouchEndDeckB);
        overlay.addEventListener('touchend', handleTouchEndDeckB);
        zone.addEventListener('touchcancel', handleTouchEndDeckB);
        overlay.addEventListener('touchcancel', handleTouchEndDeckB);
    };
})();

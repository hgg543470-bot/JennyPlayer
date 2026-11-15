// Build atomic units for ui_v71.js and export helpers
const fs = require('fs'), path = require('path');
const dir = __dirname + '/orig';
const o = require('./out2.json');
const F = 'ui_v71.js';
const L = fs.readFileSync(path.join(dir, F), 'utf8').split('\n');
const B = o.files[F].blocks;
const BUILTIN = new Set(['document','localStorage','console','navigator','Math','JSON','Object','Array','Date','String','Number','Boolean','Promise','Error','RegExp','parseInt','parseFloat','isNaN','isFinite','setTimeout','setInterval','clearTimeout','clearInterval','requestAnimationFrame','cancelAnimationFrame','fetch','URL','Blob','AudioContext','webkitAudioContext','HTMLMediaElement','HTMLElement','Element','Node','Event','CustomEvent','MutationObserver','ResizeObserver','IntersectionObserver','performance','location','history','screen','alert','confirm','encodeURIComponent','decodeURIComponent','encodeURI','decodeURI','Float32Array','Uint8Array','Int16Array','Uint32Array','Int32Array','Float64Array','Uint8ClampedArray','ArrayBuffer','DataView','Map','Set','WeakMap','WeakSet','Symbol','NaN','Infinity','AbortController','FileReader','Image','Audio','XMLHttpRequest','WebSocket','Worker','TextDecoder','TextEncoder','crypto','atob','btoa','getComputedStyle','innerWidth','innerHeight','devicePixelRatio','WebGL2RenderingContext','WebGLRenderingContext','OfflineAudioContext','MediaSource','ImageData','VideoFrame','OffscreenCanvas','createImageBitmap','matchMedia','visualViewport','URLSearchParams','Headers','Request','Response','FormData','File','Intl','Reflect','Proxy','BigInt','queueMicrotask','structuredClone','MediaMetadata','HTMLVideoElement','HTMLAudioElement','HTMLCanvasElement','HTMLInputElement','CSS','DOMParser','Range','Selection','TypeError','RangeError','SyntaxError','eval','isSecureContext','origin','top','parent','frames','name','status','event','length','open','close','stop','focus','blur','scrollTo','scrollY','scrollX','pageYOffset','pageXOffset','addEventListener','removeEventListener','dispatchEvent','AndroidBridge']);
const units = [];
for (const b of B) {
  const split = b.iife && b.inner && ((b.i >= 522 && b.inner.length >= 3 && (b.e - b.s) >= 40) || b.i === 146 || b.i === 559);
  if (!split) {
    units.push({ id: 'b' + b.i, b: b.i, u: -1, so: b.so, eo: b.eo, gapS: b.prevEnd, s: b.s, e: b.e, lead: b.lead, refs: b.refs, side: b.side, iife: b.iife });
  } else {
    b.inner.forEach(iu => {
      units.push({ id: 'b' + b.i + '.' + iu.u, b: b.i, u: iu.u, so: iu.so, eo: iu.eo, gapS: iu.u === 0 ? b.bodyS + 1 : iu.pe, s: iu.s, e: iu.e, lead: iu.lead, desc: iu.desc, refs: b.refs.filter(r => r.u === iu.u), side: b.side.filter(x => x.u === iu.u), parent: b });
    });
  }
}
// builtin names that the code itself overrides (window.fetch = ..., etc.) must take part in ordering
const OVERRIDDEN = new Set();
units.forEach(U => U.refs.forEach(r => { if (!r.loc && r.w && BUILTIN.has(r.n)) OVERRIDDEN.add(r.n); }));
OVERRIDDEN.forEach(n => BUILTIN.delete(n));
if (require.main === module) console.log('overridden builtins:', [...OVERRIDDEN].join(','));
units.forEach((U, k) => {
  U.k = k;
  U.W = new Set(), U.R = new Set(), U.LW = new Set(), U.LR = new Set(), U.Wany = new Set(), U.Rany = new Set();
  U.refs.forEach(r => {
    if (r.loc) { (r.w ? U.LW : U.LR).add(r.n); return; }
    if (BUILTIN.has(r.n)) return;
    if (r.w) { U.Wany.add(r.n); if (r.l) U.W.add(r.n); } else { U.Rany.add(r.n); if (r.l) U.R.add(r.n); }
  });
  U.side.forEach(x => { if (x.k === 'ltcall' && !BUILTIN.has(x.t)) U.R.add(x.t); });
  U.side.forEach(x => { if (!x.l) return;
    if (x.k === 'listen' && x.ev !== 'DOMContentLoaded' && /^(document|window|player)(\.body)?$/.test(x.t)) { const ph = (/true/.test(x.cap) ? 'capture' : 'bubble'); if (x.ev === '?') ['touchstart', 'touchmove', 'touchend', 'touchcancel', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'pointermove', 'input', 'click', 'keydown', 'scroll', 'wheel', '?'].forEach(ev => U.W.add('@listen:' + x.t + '/' + ev + '/' + ph)); else U.W.add('@listen:' + x.t + '/' + x.ev + '/' + ph); }
    if (!process.env.NOTIMER && (x.k === 'setTimeout' || x.k === 'setInterval')) U.W.add('@timer:' + x.d);
    if (x.k === 'proto' || x.k === 'defprop') U.W.add('@proto:' + x.t.replace(/\s+/g, ''));
  });
  U.text = L.slice(U.s - 1, U.e).join('\n');
});
// dynamic wrappers window[fnName] = ... (names come from array literals, invisible to static name analysis)
{
  const DYN = [[15378, 15392, ['setPlaybackSpeed', 'applyPlaybackSpeed', 'setSpeed', 'changeSpeed'], 'hookSpeedAndDeckBControlsV210'], [19380, 19396, ['stopCurrentOpenTorrentV143', 'deleteCurrentOpenTorrentV143', 'nukeAllTorrentsV142', 'cleanupActiveTorrentStreamV143', 'resetOpenTorrentScreenUI_V143'], null], [26566, 26572, ['openJennyVideoPlayerV130', 'toggleVideoLockModeV132', 'toggleVideoPipModeV130', 'exitDesktopOverlayModeV132'], null]];
  DYN.forEach(([a, b, names, viaFn]) => units.forEach(U => { const holds = U.s <= a && U.e >= a; const calls = viaFn && U.parent && units.find(X => X.s <= a && X.e >= a).b === U.b && new RegExp('\\b' + viaFn + '\\s*\\(').test(U.text); if (holds || calls) names.forEach(n => { U.W.add(n); U.R.add(n); U.dyn = 1; }); }));
}
// transitive effect of load-time calls to global functions (2 levels): the caller also "reads" everything the callee body references
{
  const fnDef = new Set(); units.forEach(U => U.refs.forEach(r => { if (r.w && !r.loc && r.l && r.vt === 'fn') fnDef.add(U.k + ':' + r.n); }));
  const defUnits = {}; units.forEach(U => U.W.forEach(n => { if (fnDef.has(U.k + ':' + n)) (defUnits[n] = defUnits[n] || []).push(U); }));
  const callsOf = U => U.side.filter(x => x.k === 'ltcall' && !BUILTIN.has(x.t)).map(x => x.t);
  units.forEach(U => {
    let frontier = callsOf(U); const seen = new Set(frontier); U.ltTrans = [];
    for (let lvl = 0; lvl < 2 && frontier.length; lvl++) {
      const next = [];
      frontier.forEach(t => (defUnits[t] || []).forEach(D => { if (D.k > U.k) return; D.Rany.forEach(n => { if (!U.R.has(n)) { U.R.add(n); U.ltTrans.push(n); } if (defUnits[n] && !seen.has(n)) { seen.add(n); next.push(n); } }); }));
      frontier = next;
    }
  });
}
module.exports = { units, B, L, BUILTIN, o };
if (require.main === module) {
  console.log('units', units.length, 'lines covered', units.reduce((a, u) => a + u.e - u.s + 1, 0));
  // union-find of names co-written at load in the same unit
  const par = {}; const find = x => par[x] === undefined || par[x] === x ? (par[x] = x) : (par[x] = find(par[x]));
  units.forEach(U => { const a = [...U.W]; a.forEach(n => find(n)); for (let i = 1; i < a.length; i++) par[find(a[i])] = find(a[0]); });
  const comp = {}; Object.keys(par).forEach(n => (comp[find(n)] = comp[find(n)] || []).push(n));
  const sizes = Object.values(comp).map(c => c.length).sort((a, b) => b - a);
  console.log('name components:', sizes.length, 'largest:', sizes.slice(0, 15).join(','));
  // units writing many names at load
  units.filter(U => U.W.size >= 5).sort((a, b) => b.W.size - a.W.size).slice(0, 25).forEach(U => console.log(U.id, U.s + '-' + U.e, U.W.size, (U.desc || '').slice(0, 50), '|', [...U.W].slice(0, 8).join(',')));
}

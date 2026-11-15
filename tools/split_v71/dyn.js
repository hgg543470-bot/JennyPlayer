// Дифференциальный прогон: грузим старый и новый набор скриптов в vm с заглушкой браузера
// и сравниваем итоговое состояние window, обработчики и таймеры.
// usage: node dyn.js <mode: null|stub>
const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const MODE = process.argv[2] || 'null';
const h = s => crypto.createHash('md5').update(String(s)).digest('hex').slice(0, 10);
const BASE = ['engine_audio.js', 'engine_video_deck_b.js', 'engine_heads.js', 'engine_fav.js', 'ui_init.js', 'ui_config.js', 'ui_render.js', 'ui_playback.js', 'ui_scrub_engine.js', 'ui_touch_arc.js', 'ui_controls.js', 'ui_export.js', 'ui_help.js'];
const OLD = BASE.map(f => ['orig/' + f, f]).concat([['orig/ui_v71.js', 'ui_v71.js'], ['orig/jenny_deck_b_modals.js', 'jenny_deck_b_modals.js']]);
const NEW = BASE.map(f => ['orig/' + f, f]).concat([[process.env.BUNDLE || 'bundle_new.js', 'ui_v71.js'], ['orig/jenny_deck_b_modals.js', 'jenny_deck_b_modals.js']]);

function run(list, extraGlobals) {
  const rec = { timers: [], listeners: {}, errors: [], styles: [] };
  let stubId = 0;
  function mk(name) {
    const store = new Map();
    const t = function () {};
    const p = new Proxy(t, {
      get(_, k) {
        if (k === Symbol.toPrimitive) return hint => hint === 'number' ? 0 : '';
        if (k === 'then' || k === Symbol.iterator || k === Symbol.asyncIterator || k === 'toJSON') return undefined;
        if (k === 'length') return store.has(k) ? store.get(k) : 0;
        if (k === 'prototype') { if (!store.has(k)) store.set(k, {}); return store.get(k); }
        if (k === '__stub') return name;
        if (store.has(k)) return store.get(k);
        if (k === 'addEventListener') return (type, fn, opt) => { addL(name, type, fn, opt); };
        if (k === 'removeEventListener') return () => {};
        if (k === 'getElementById' || k === 'querySelector' || k === 'closest') return (q) => MODE === 'null' ? null : mk(name + '.' + String(k));
        if (k === 'querySelectorAll' || k === 'getElementsByClassName' || k === 'getElementsByTagName' || k === 'children' || k === 'childNodes') { const arr = MODE === 'null' ? [] : [mk(name + '.el')]; return (k === 'children' || k === 'childNodes') ? arr : () => arr; }
        if (k === 'contains' || k === 'matches' || k === 'hasAttribute') return () => false;
        if (k === 'getAttribute') return () => null;
        if (k === 'parentNode' || k === 'parentElement' || k === 'nextSibling' || k === 'previousSibling' || k === 'firstChild' || k === 'lastChild' || k === 'nextElementSibling' || k === 'previousElementSibling' || k === 'offsetParent') return null;
        if (k === 'getBoundingClientRect') return () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });
        if (k === 'createElement') return (tag) => { const e = mk('el<' + tag + '>'); if (tag === 'style') rec.styles.push(e); return e; };
        if (k === 'toString') return () => '';
        if (k === 'valueOf') return () => 0;
        const c = mk(name + '.' + String(k)); store.set(k, c); return c;
      },
      set(_, k, v) { store.set(k, v); return true; },
      has(_, k) { return true; },
      deleteProperty(_, k) { store.delete(k); return true; },
      apply() { return mk(name + '()'); },
      construct() { return mk('new ' + name); },
      ownKeys() { return ['prototype']; },
      getOwnPropertyDescriptor(_, k) { return k === 'prototype' ? Object.getOwnPropertyDescriptor(t, 'prototype') : undefined; },
    });
    return p;
  }
  function addL(target, type, fn, opt) {
    const cap = opt === true || (opt && opt.capture === true) ? 'c' : 'b';
    const k = target + '/' + type + '/' + cap; (rec.listeners[k] = rec.listeners[k] || []).push(typeof fn === 'function' ? h(fn.toString()) : 'nofn');
  }
  const ls = new Map();
  const sb = {};
  sb.window = sb; sb.self = sb; sb.globalThis = sb; sb.top = sb; sb.parent = sb;
  sb.console = { log() {}, warn() {}, error() {}, info() {}, debug() {} };
  sb.localStorage = { getItem: k => ls.has(k) ? ls.get(k) : null, setItem: (k, v) => { ls.set(k, String(v)); }, removeItem: k => { ls.delete(k); }, clear: () => ls.clear() };
  sb.sessionStorage = sb.localStorage;
  let tseq = 0;
  sb.setTimeout = (fn, d) => { rec.timers.push({ kind: 'T', d: +d || 0, fn, seq: tseq++ }); return tseq; };
  sb.setInterval = (fn, d) => { rec.timers.push({ kind: 'I', d: +d || 0, fn, seq: tseq++ }); return tseq; };
  sb.clearTimeout = () => {}; sb.clearInterval = () => {};
  sb.requestAnimationFrame = (fn) => { rec.timers.push({ kind: 'R', d: 16, fn, seq: tseq++ }); return tseq; };
  sb.cancelAnimationFrame = () => {};
  sb.addEventListener = (type, fn, opt) => addL('window', type, fn, opt);
  sb.removeEventListener = () => {};
  sb.dispatchEvent = () => true;
  sb.fetch = () => new Promise(() => {});
  sb.performance = { now: () => 1000 };
  sb.document = mk('document');
  sb.navigator = mk('navigator');
  sb.location = { href: 'http://127.0.0.1:8080/', origin: 'http://127.0.0.1:8080', protocol: 'http:', host: '127.0.0.1:8080', hostname: '127.0.0.1', port: '8080', pathname: '/', search: '', hash: '' };
  sb.innerWidth = 1080; sb.innerHeight = 2400; sb.devicePixelRatio = 3; sb.scrollY = 0; sb.scrollX = 0;
  const classes = ['HTMLMediaElement', 'HTMLElement', 'Element', 'Node', 'HTMLVideoElement', 'HTMLAudioElement', 'HTMLCanvasElement', 'HTMLInputElement', 'XMLHttpRequest', 'WebGLRenderingContext', 'WebGL2RenderingContext', 'EventTarget', 'Event', 'CustomEvent', 'AudioContext', 'webkitAudioContext', 'OfflineAudioContext', 'AudioBufferSourceNode', 'AudioNode', 'AudioParam', 'MediaSource', 'Image', 'Audio', 'FileReader', 'Blob', 'File', 'FormData', 'Headers', 'Request', 'Response', 'AbortController', 'TextDecoder', 'TextEncoder', 'Worker', 'WebSocket', 'MediaMetadata', 'DOMParser', 'ImageData', 'OffscreenCanvas', 'VideoFrame'];
  classes.forEach(c => { const F = function () { return mk('new ' + c); }; F.prototype = { addEventListener() {}, removeEventListener() {}, play() { return new Promise(() => {}); }, pause() {}, open() {}, send() {}, drawArrays() {}, getParameter() { return null; }, viewport() {} }; if (c === 'HTMLMediaElement') { Object.defineProperty(F.prototype, 'src', { configurable: true, enumerable: true, get() { return ''; }, set(v) {} }); Object.defineProperty(F.prototype, 'currentTime', { configurable: true, enumerable: true, get() { return 0; }, set(v) {} }); } sb[c] = F; });
  ['MutationObserver', 'ResizeObserver', 'IntersectionObserver', 'PerformanceObserver'].forEach(c => { sb[c] = function () { return { observe() {}, disconnect() {}, takeRecords() { return []; } }; }; });
  sb.URL = function (u) { return { href: String(u), searchParams: { get: () => null, set() {} }, pathname: String(u), origin: '', toString() { return String(u); } }; }; sb.URL.createObjectURL = () => 'blob:x'; sb.URL.revokeObjectURL = () => {};
  sb.URLSearchParams = function () { return { get: () => null, set() {}, has: () => false, toString: () => '' }; };
  sb.getComputedStyle = () => mk('computedStyle');
  sb.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
  sb.alert = () => {}; sb.confirm = () => false; sb.prompt = () => null;
  sb.atob = s => Buffer.from(String(s), 'base64').toString('binary'); sb.btoa = s => Buffer.from(String(s), 'binary').toString('base64');
  sb.crypto = { getRandomValues: a => a, randomUUID: () => '0' };
  sb.screen = { width: 1080, height: 2400, orientation: { type: 'portrait-primary', addEventListener() {} } };
  sb.visualViewport = { width: 1080, height: 2400, addEventListener() {}, offsetTop: 0 };
  sb.history = { pushState() {}, replaceState() {}, back() {} };
  sb.CSS = { supports: () => false, escape: s => s };
  (extraGlobals || []).forEach(g => { if (!(g in sb)) sb[g] = mk(g); });
  vm.createContext(sb);
  // the inline blackbox from index.html is not needed; emulate window error log
  sb.__jennyErrorLogsV20 = [];
  for (const [p, name] of list) {
    const code = fs.readFileSync(p, 'utf8');
    try { new vm.Script(code, { filename: name }).runInContext(sb, { timeout: 60000 }); }
    catch (e) { const m = /at .*?(ui_\w+\.js|engine_\w+\.js|jenny_\w+\.js):(\d+)/.exec(String(e && e.stack)); rec.errors.push(name + ': ' + (e && e.message) + (m ? ' @' + m[2] : '')); }
  }
  return { sb, rec };
}
function snapshot(sb) {
  const out = {};
  for (const k of Object.keys(sb)) {
    if (/__[a-z_]+$/.test(k) || /Installed|Fixed$/.test(k)) continue; // сторожевые флаги
    let v; try { v = sb[k]; } catch (e) { out[k] = 'ERR'; continue; }
    if (typeof v === 'function') { if (v.__stub) out[k] = 'stub'; else out[k] = 'fn:' + h(Function.prototype.toString.call(v)); }
    else if (v === null || typeof v !== 'object') out[k] = typeof v + ':' + String(v).slice(0, 60);
    else { let s; try { s = JSON.stringify(v, (kk, vv) => typeof vv === 'function' ? 'fn' : vv); } catch (e) { s = 'obj'; } out[k] = 'obj:' + h(s || 'undef'); }
  }
  return out;
}
function diff(a, b, label, limit) {
  let n = 0; const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (a[k] !== b[k]) { n++; if (n <= (limit || 15)) console.log('  ' + label + ' DIFF', k, '| old:', a[k], '| new:', b[k]); }
  return n;
}
function fireTimers(R) {
  // один проход: все таймеры по (delay, seq); новые, поставленные в процессе, — до 3 поколений
  let errs = 0, fired = 0;
  for (let gen = 0; gen < 3; gen++) {
    const batch = R.rec.timers.splice(0).sort((x, y) => x.d - y.d || x.seq - y.seq);
    if (!batch.length) break;
    for (const t of batch) { if (typeof t.fn !== 'function') continue; try { t.fn(); fired++; } catch (e) { errs++; } }
  }
  return { fired, errs };
}
// --- learn missing globals from the OLD run, then use the same set for both
let extra = [];
for (let i = 0; i < 60; i++) {
  const r = run(OLD, extra);
  const miss = r.rec.errors.map(e => (/: (\w+) is not defined/.exec(e) || [])[1]).filter(Boolean);
  if (!miss.length) break;
  extra = extra.concat(miss.filter(m => !extra.includes(m)));
}
console.log('mode =', MODE, '| auto-stubbed globals:', extra.join(',') || '—');
const A = run(OLD, extra), B = run(NEW, extra);
console.log('load errors old:', A.rec.errors.length, A.rec.errors.slice(0, 5).join(' || '));
console.log('load errors new:', B.rec.errors.length, B.rec.errors.slice(0, 5).join(' || '));
const sa = snapshot(A.sb), sbb = snapshot(B.sb);
console.log('window keys old/new:', Object.keys(sa).length, Object.keys(sbb).length, '| functions:', Object.values(sa).filter(v => v.startsWith('fn:')).length);
console.log('state diffs after load:', diff(sa, sbb, 'load'));
// listeners
let ld = 0; const lk = new Set([...Object.keys(A.rec.listeners), ...Object.keys(B.rec.listeners)]);
for (const k of lk) { const x = (A.rec.listeners[k] || []).join(','), y = (B.rec.listeners[k] || []).join(','); if (x !== y) { ld++; if (ld <= 10) console.log('  LISTENER ORDER DIFF', k, (A.rec.listeners[k] || []).length, (B.rec.listeners[k] || []).length, x === y.split(',').sort().join(',') ? '' : (x.split(',').sort().join(',') === y.split(',').sort().join(',') ? '(тот же набор, другой порядок)' : '(разный набор)')); } }
console.log('listener keys:', lk.size, 'total:', Object.values(A.rec.listeners).reduce((a, v) => a + v.length, 0), '/', Object.values(B.rec.listeners).reduce((a, v) => a + v.length, 0), '| order diffs:', ld);
// timers registered at load: multiset
const tm = R => R.rec.timers.map(t => t.kind + t.d + ':' + h(String(t.fn))).sort().join(',');
console.log('timers at load old/new:', A.rec.timers.length, B.rec.timers.length, '| same multiset:', tm(A) === tm(B));
// styles
const st = R => R.rec.styles.map(s => { try { return h(String(s.id) + '|' + String(s.textContent).length + '|' + String(s.textContent).slice(0, 200)); } catch (e) { return 'x'; } }).join(',');
console.log('style elements created old/new:', A.rec.styles.length, B.rec.styles.length, '| same order:', st(A) === st(B));
const fa = fireTimers(A), fb = fireTimers(B);
console.log('timers fired old/new:', fa.fired, fb.fired, '| errors in callbacks:', fa.errs, fb.errs);
console.log('state diffs after timers:', diff(snapshot(A.sb), snapshot(B.sb), 'timers'));

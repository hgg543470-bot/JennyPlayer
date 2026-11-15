const fs = require('fs');
const { units, B, L, BUILTIN, o } = require('./units.js');
const { RULES, themeOfName } = require('./themes.js');
const allw = require('./allwrites.json');
let OVR = {}; try { OVR = require('./overrides.json'); } catch (e) {}
const NAME_OVR = OVR.names || {}, UNIT_OVR = OVR.units || {}, RANGE_OVR = OVR.ranges || [];
// ---------- text theme scoring
const TXT = {
  net: /routeJennyApiUrl|pickJennyPort|ClusterPorts|_nativeFetch|XhrOpen|mediaProto|HTMLMediaElement\.prototype|XMLHttpRequest\.prototype/g,
  video_reverse: /Vid\w*Rev|Video\w*Reverse|Rev\w*Vid|Reverse\w*Video|RevBlob|RevRam|RevQueue|RevSeg|reverse_remux|RevChunk|isReversedDeckB|ReverseModeDeckB|RevPause/g,
  framegen: /Framegen|FrameGen|120Hz|Motion|Interp|Dedup|Pyramid|JennyLab|LabFlags|LabModule|vcore|VCore|jv166|jv207|V170\w*Frame|SplitRatio|SplitSwap|SplitLine|Tuner/g,
  torrent: /[Tt]orrent|_tor[A-Z]|Tor[A-Z]\w+V\d|[Mm]agnet|[Tt]racker|Omni|[Pp]2p|[Pp]iece|[Ss]eed|btih/g,
  video: /[Vv]ideo|_vid[A-Z]|Vid[A-Z]|v130|DeckB|deckB|Pip|Overlay|Fullscreen|Hud\b|HUD|[Rr]emux|Rot90|FitMode/g,
  sources: /Kh[A-Z]\w+|kh[A-Z]\w+|Khinsider|\bOST\b|Ost[A-Z]|[Rr]adio|SoundCloud|\bSc[A-Z]\w+|Yt[A-Z]\w+|YouTube|[Ss]ources?[A-Z_]|MiniPlayer|\bump[A-Z]|Ump[A-Z]|Archive|ExternalStream/g,
  reverse: /Reverse|isReversed|\bRev[A-Z]|Horizon|[Gg]earbox|Ram[A-Z]|\bRAM\b|Dna|dna[A-Z]|Clock|Jbuf|PitchShift|studioBuffer|StudioBuffer|[Ss]crub|Vinyl|TruePlaybackTime|MasterPlaybackEngine|playbackRate|SpeedArc|speedArc|Stall|Watchdog|Turbo/g,
  shade: /Notification|[Mm]ediaSession|Foreground|NotifLock|Notif[A-Z]|BatteryOpt|BgShield|Unrestricted|SafeInset/g,
  export: /[Ee]xport|[Xx]flac|XFLAC|SampleRate/g,
  playlist: /[Pp]laylist|PLAYLIST|TabV71|activePlaylistTab|[Ss]ort[A-Z]|Tag[A-Z]|filterTracks|TrackCount|TrackMeta|[Ff]older|SubFilter|SubStrip|SubGroup|Strip[A-Z]|[Qq]ueue[A-Z]|\bFav|[Ff]av[A-Z]|fetchData|trackList|TrackList|session_tracks|track-row|trackRow/g,
  transport: /playTrack|togglePlay|playNext|playPrev|nextTrack|handleTrackPlay|seekAudio|setupSeekZone|PlayPause|DeckA\b|nowPlaying/g,
  gestures: /Gesture|LongPress|HoldTimer|touchstart|touchend|pointerdown|InputFocus/g,
  settings: /settingsModal|Settings|[Ll]ang[A-Z]|isRu|Theme|FormatSlot|Thread|Onb[A-Z]|Onboard|Help|Guide|Perm[A-Z]|toggleModal|Header[A-Z]|header|Dropdown|PersistentUserData|\bEQ\b|Eq[A-Z]|Volume/g,
};
function scoreText(t) { const s = {}; for (const k in TXT) { const m = t.match(TXT[k]); s[k] = m ? m.length : 0; } return s; }
const W = { net: 8, video_reverse: 6, framegen: 3, torrent: 1.2, video: 0.8, sources: 1.2, reverse: 1.3, shade: 3, export: 2, playlist: 1.2, transport: 1.5, gestures: 1.5, settings: 1 };
function themeOfText(t) { const s = scoreText(t); let best = '', bv = 0; for (const k in s) { const v = s[k] * W[k]; if (v > bv) { bv = v; best = k; } } return best; }
// ---------- name owners
// owner = override || theme of the unit holding the first load-time fn definition in ui_v71 (by text+name), computed iteratively
const nameOwner = {};
function baseTheme(U) {
  // names written at load (window.*) decide first
  const votes = {};
  U.W.forEach(n => { const t = NAME_OVR[n] || themeOfName(n); if (t) votes[t] = (votes[t] || 0) + 1; });
  const v = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  if (v.length) return v[0][0];
  return '';
}
function refTheme(U) { // by owners of referenced global names
  const votes = {}; U.Rany.forEach(n => { const t = nameOwner[n]; if (t && t !== 'misc') votes[t] = (votes[t] || 0) + 1; });
  const v = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  if (v.length && (v.length === 1 || v[0][1] > v[1][1])) return v[0][0];
  return themeOfText((U.lead || '') + '\n' + U.text) || (v.length ? v[0][0] : 'misc');
}
units.forEach(U => { U.theme0 = baseTheme(U); });
// owner of every name: override, else theme of first unit that writes it at load
units.forEach(U => U.W.forEach(n => { if (!(n in nameOwner)) nameOwner[n] = NAME_OVR[n] || themeOfName(n) || U.theme0 || themeOfText((U.lead || '') + '\n' + U.text) || 'misc'; }));
units.forEach(U => { if (!U.theme0) U.theme0 = refTheme(U); });
// unit theme: owner of the "main" written name (fn-valued multi-def names take precedence), else theme0
units.forEach(U => {
  let t = null;
  const ws = [...U.W].filter(n => allw[n] && allw[n].some(e => e.isFn));
  const multi = ws.filter(n => allw[n].length > 1);
  const pick = (multi.length ? multi : ws);
  if (pick.length) { const votes = {}; pick.forEach(n => votes[nameOwner[n]] = (votes[nameOwner[n]] || 0) + 1); t = Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0]; }
  U.theme = t || U.theme0;
  // capture declarations: `var _orig = window.N` -> theme of N's owner
  const isDecl = /^\s*(var|let|const)\s/.test(U.text) && (U.e - U.s) <= 3;
  if (isDecl) { const rn = [...U.R].find(n => nameOwner[n] && allw[n] && allw[n].some(e => e.isFn)); if (rn) { U.theme = nameOwner[rn]; U.capture = rn; } }
  // IIFE header guard units
  if (U.parent && U.u <= 2 && (/^\s*if\s*\(\s*window\.[\w$]+\s*\)\s*return/.test(U.text) || /^\s*window\.(_jenny[\w$]*(Installed|Fixed)|[\w$]*Installed[\w$]*)\s*=\s*true/.test(U.text) || /^\s*['"]use strict['"]/.test(U.text))) U.theme = 'HEADER';
  for (const [a, b, th] of RANGE_OVR) if (U.s >= a && U.e <= b) U.theme = th;
  if (UNIT_OVR[U.id]) U.theme = UNIT_OVR[U.id];
});
// ---------- closure co-location: guard units & shared state locals
// For each split IIFE: locals -> units referencing. state local (non-fn or fn touching state) shared across themes => conflict
const iifeInfo = {};
units.forEach(U => { if (U.parent) (iifeInfo[U.b] = iifeInfo[U.b] || { b: U.parent, units: [] }).units.push(U); });
const localConf = [];
for (const bi in iifeInfo) {
  const I = iifeInfo[bi]; const locals = I.b.locals || [];
  const declUnit = {}; // local -> unit that declares (first write with decl)
  I.b.refs.forEach(r => { if (r.loc && r.decl && !(r.n in declUnit)) declUnit[r.n] = r.u; });
  I.locals = locals; I.declUnit = declUnit;
  I.use = {};
  I.units.forEach(U => { [...U.LW, ...U.LR].forEach(n => (I.use[n] = I.use[n] || new Set()).add(U)); });
  // pure helper: function local whose own unit references no other locals except itself / other pure helpers
  const fnLocals = new Set(locals.filter(l => l.fn).map(l => l.n));
  const pure = new Set();
  let ch = true;
  while (ch) { ch = false; fnLocals.forEach(n => { if (pure.has(n)) return; const du = I.units.find(U => U.u === declUnit[n]); if (!du) return; const others = [...du.LW, ...du.LR].filter(x => x !== n && !pure.has(x)); const declaresOnlyThis = [...du.LW].filter(x => x !== n).length === 0; if (others.length === 0 && declaresOnlyThis) { pure.add(n); ch = true; } }); }
  I.pure = pure;
}

// ---------- closure components inside split IIFEs
const CONST_VT = new Set(['Literal', 'TemplateLiteral', 'BinaryExpression', 'UnaryExpression']);
for (const bi in iifeInfo) {
  const I = iifeInfo[bi];
  // constants: one write (decl) with literal-ish init
  const wr = {}; I.b.refs.forEach(r => { if (r.loc && r.w) (wr[r.n] = wr[r.n] || []).push(r); });
  I.consts = new Set(Object.keys(wr).filter(n => wr[n].length === 1 && wr[n][0].decl && CONST_VT.has(wr[n][0].vt)));
  const par = new Map(); const find = x => { while (par.get(x) !== x) { par.set(x, par.get(par.get(x))); x = par.get(x); } return x; };
  const body = I.units.filter(U => U.theme !== 'HEADER'); body.forEach(U => par.set(U, U));
  I.dupLocals = new Set();
  for (const n in I.use) {
    const us = [...I.use[n]].filter(U => U.theme !== 'HEADER'); if (us.length < 2) continue;
    if (I.pure.has(n) || I.consts.has(n)) { if (new Set(us.map(U => U.theme)).size > 1) I.dupLocals.add(n); continue; }
    for (let k = 1; k < us.length; k++) par.set(find(us[k]), find(us[0]));
  }
  const comps = new Map(); body.forEach(U => { const r = find(U); if (!comps.has(r)) comps.set(r, []); comps.get(r).push(U); });
  I.comps = [...comps.values()];
  I.comps.forEach(c => {
    if (c.length < 2) return;
    const isStyle = c.some(U => U.side.some(x => x.k === 'style' && x.l)) && c.length <= 8 && c.every(U => (U.e - U.s) < 400 && U.W.size === 0);
    const votes = {}; c.forEach(U => { if (U.theme !== 'misc') votes[U.theme] = (votes[U.theme] || 0) + (U.e - U.s + 1); });
    const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
    const th = isStyle ? 'styles' : (best ? best[0] : 'misc');
    c.forEach(U => { U.theme = (UNIT_OVR[U.id] || th); U.comp = c[0].id; U.compSize = c.length; });
  });
}
// bare load-time calls of a local function that injects <style>: the injection happens at the call, keep it with styles
for (const bi in iifeInfo) {
  const I = iifeInfo[bi];
  const styleFns = Object.keys(I.declUnit).filter(n => { const D = I.units.find(U => U.u === I.declUnit[n]); return D && D.side.some(x => x.k === 'style' && x.l) && /^\s*function\s/.test(D.text); });
  styleFns.forEach(n => I.units.forEach(U => { if (new RegExp('^\\s*' + n.replace(/\$/g, '\\$') + '\\(\\s*\\);?\\s*$').test(U.text) && !U.compSize) { U.theme = 'styles'; U.styleCall = n; } }));
}
// standalone load-time style units outside components
units.forEach(U => { if (!U.compSize && U.W.size === 0 && U.side.some(x => x.k === 'style' && x.l) && !UNIT_OVR[U.id]) U.theme = 'styles'; });
// sticky misc: take theme of previous unit (same block for IIFE units)
for (let k = 0; k < units.length; k++) { const U = units[k]; if (U.theme !== 'misc') continue; let j = k - 1; while (j >= 0 && (units[j].theme === 'misc' || units[j].theme === 'HEADER' || units[j].theme === 'styles')) j--; if (j >= 0 && (units[j].b === U.b || !U.parent)) { U.theme = units[j].theme; U.sticky = 1; } else { j = k + 1; while (j < units.length && (units[j].theme === 'misc' || units[j].theme === 'HEADER' || units[j].theme === 'styles')) j++; if (j < units.length) { U.theme = units[j].theme; U.sticky = 1; } } }
// re-propagate inside components after sticky
for (const bi in iifeInfo) iifeInfo[bi].comps.forEach(c => { if (c.length > 1) { const t = c.find(U => U.theme !== 'misc'); } });
// ---------- constraints
function fileOrderCheck(order, verbose) {
  const idx = {}; order.forEach((t, i) => idx[t] = i);
  const viol = [];
  const lastW = {}, readers = {};
  // sweep in original order; for each unit j check deps with earlier units via name maps
  const writersOf = {}, readersOf = {};
  units.forEach(U => {
    const fj = idx[U.theme];
    const chk = (n, arr, kind) => { (arr[n] || []).forEach(P => { if (idx[P.theme] > fj) viol.push({ n, kind, i: P, j: U }); }); };
    U.W.forEach(n => { chk(n, writersOf, 'W/W'); chk(n, readersOf, 'R/W'); });
    U.R.forEach(n => { chk(n, writersOf, 'W/R'); });
    U.W.forEach(n => (writersOf[n] = writersOf[n] || []).push(U));
    U.R.forEach(n => (readersOf[n] = readersOf[n] || []).push(U));
  });
  return viol;
}
// ---------- greedy layering: files are single-theme, appended in creation order
function layer(order) {
  const files = []; // {theme, layer, units:[]}
  const cur = {}; const pos = new Map(); // unit -> file index
  const cnt = {};
  order.forEach(t => { const f = { theme: t, layer: 1, units: [] }; cur[t] = files.length; cnt[t] = 1; files.push(f); });
  const writersOf = {}, readersOf = {}; const why = [];
  units.forEach(U => {
    if (U.theme === 'HEADER') return;
    let need = -1, reason = null;
    const chk = (n, arr, kind) => (arr[n] || []).forEach(P => { const p = pos.get(P); if (p > need) { need = p; reason = { n, kind, P }; } });
    U.W.forEach(n => { chk(n, writersOf, 'W/W'); chk(n, readersOf, 'R/W'); }); U.R.forEach(n => chk(n, writersOf, 'W/R'));
    // closure component must stay in one file: if component already placed, its file is fixed
    if (!(U.theme in cur)) { cur[U.theme] = files.length; cnt[U.theme] = 1; files.push({ theme: U.theme, layer: 1, units: [] }); }
    let fi = cur[U.theme];
    if (need > fi) { cnt[U.theme]++; fi = files.length; files.push({ theme: U.theme, layer: cnt[U.theme], units: [] }); cur[U.theme] = fi; why.push({ file: U.theme + '.' + cnt[U.theme], at: U.id + ' L' + U.s, n: reason.n, kind: reason.kind, after: files[need].theme + '.' + files[need].layer, P: reason.P.id + ' L' + reason.P.s }); }
    files[fi].units.push(U); pos.set(U, fi); U.file = fi;
    U.W.forEach(n => (writersOf[n] = writersOf[n] || []).push(U)); U.R.forEach(n => (readersOf[n] = readersOf[n] || []).push(U));
  });
  return { files: files.filter(f => f.units.length), why };
}
module.exports = { units, nameOwner, iifeInfo, fileOrderCheck, themeOfText, layer, OVR, B, L, o };
if (require.main === module) {
  const cnt = {}, lines = {};
  units.forEach(U => { cnt[U.theme] = (cnt[U.theme] || 0) + 1; lines[U.theme] = (lines[U.theme] || 0) + U.e - U.s + 1; });
  console.log(Object.keys(cnt).map(t => t + ': ' + cnt[t] + ' units, ' + lines[t] + ' lines').join('\n'));
  const themes = Object.keys(cnt);
  // theme precedence graph
  const viol0 = fileOrderCheck(themes.map(t => t));
  const edge = {};
  // count all cross-theme dependent pairs direction
  {
    const writersOf = {}, readersOf = {};
    units.forEach(U => {
      const add = (n, arr, kind) => (arr[n] || []).forEach(P => { if (P.theme !== U.theme) { const k = P.theme + '>' + U.theme; (edge[k] = edge[k] || new Set()).add(P.id + '|' + U.id + '|' + n + '|' + kind); } });
      U.W.forEach(n => { add(n, writersOf, 'WW'); add(n, readersOf, 'RW'); }); U.R.forEach(n => add(n, writersOf, 'WR'));
      U.W.forEach(n => (writersOf[n] = writersOf[n] || []).push(U)); U.R.forEach(n => (readersOf[n] = readersOf[n] || []).push(U));
    });
  }
  // greedy order: minimize backward edges via simple local search
  let order = (OVR.order || themes).filter(t => themes.includes(t)); themes.forEach(t => { if (!order.includes(t)) order.push(t); });
  const cost = ord => { const ix = {}; ord.forEach((t, i) => ix[t] = i); let c = 0; for (const k in edge) { const [a, b] = k.split('>'); if (ix[a] > ix[b]) c += edge[k].size; } return c; };
  if (!OVR.order) { let best = cost(order), imp = true; while (imp) { imp = false; for (let i = 0; i < order.length; i++) for (let j = 0; j < order.length; j++) { if (i === j) continue; const o2 = order.slice(); const [x] = o2.splice(i, 1); o2.splice(j, 0, x); const c = cost(o2); if (c < best) { best = c; order = o2; imp = true; } } } }
  console.log('\norder:', order.join(' < '), ' backward pairs:', cost(order));
  const ix = {}; order.forEach((t, i) => ix[t] = i);
  const back = [];
  for (const k in edge) { const [a, b] = k.split('>'); if (ix[a] > ix[b]) edge[k].forEach(s => back.push(k + ' ' + s)); }
  // group by name
  const byN = {}; back.forEach(s => { const p = s.split(' ')[1].split('|'); (byN[s.split(' ')[0] + ' ' + p[2]] = byN[s.split(' ')[0] + ' ' + p[2]] || []).push(p[0] + '→' + p[1] + ' ' + p[3]); });
  Object.entries(byN).slice(0, 120).forEach(([k, v]) => console.log(k, v.length, v.slice(0, 3).join(' ; ')));
  // local conflicts
  let conf = 0, dup = 0; const confList = [];
  for (const bi in iifeInfo) { const I = iifeInfo[bi]; for (const n in I.use) { const ths = new Set([...I.use[n]].map(U => U.theme).filter(t => t !== 'HEADER')); if (ths.size > 1) { if (I.pure.has(n) || I.consts.has(n)) dup++; else { conf++; confList.push('b' + bi + ' ' + n + ' [' + [...ths].join(',') + '] units=' + I.use[n].size); } } } }
  console.log('\nshared closure locals across themes: state/impure =', conf, ' pure helpers (duplicable) =', dup);
  if (process.argv[2] === 'conf') console.log(confList.join('\n'));
  let ord0 = (OVR.order || order).slice(); themes.forEach(t => { if (!ord0.includes(t) && t !== 'HEADER') ord0.push(t); });
  if (process.env.OPT) { const sc = od => { const r = layer(od); return r.files.length * 100000 + r.files.filter(f => f.layer > 1).reduce((a, f) => a + f.units.reduce((x, U) => x + U.e - U.s + 1, 0), 0); }; let best = sc(ord0), imp = true; while (imp) { imp = false; for (let i = 0; i < ord0.length; i++) for (let j = 0; j < ord0.length; j++) { if (i === j) continue; const o2 = ord0.slice(); const [x] = o2.splice(i, 1); o2.splice(j, 0, x); const c = sc(o2); if (c < best) { best = c; ord0 = o2; imp = true; } } } console.log('OPT order:', JSON.stringify(ord0)); }
  const LY = layer(ord0);
  console.log('\nLAYERED FILES:', LY.files.length);
  LY.files.forEach((f, i) => console.log((i + 1) + '. ' + f.theme + '.' + f.layer + '  units=' + f.units.length + ' lines=' + f.units.reduce((a, U) => a + U.e - U.s + 1, 0) + '  src L' + f.units[0].s + '..L' + f.units[f.units.length - 1].e));
  LY.why.forEach(w => console.log('  new ' + w.file + ' at ' + w.at + ' because ' + w.kind + ' ' + w.n + ' with ' + w.P + ' in ' + w.after));
  fs.writeFileSync(__dirname + '/assign.json', JSON.stringify(units.map(U => ({ id: U.id, s: U.s, e: U.e, t: U.theme, w: [...U.W].slice(0, 4), d: (U.desc || '').slice(0, 60), lead: (U.lead || '').slice(0, 80) }))));
}

const fs = require('fs');
const F = require('./final.json');
const d = require('./dups.json');
const o = require('./out2.json');
const short = f => f.replace(/\.js$/, '').replace(/^ui_v71$/, 'v71').replace(/^jenny_deck_b_modals$/, 'deck_b_modals');
// ---------- unit -> target file lookup by line
const unitFile = []; F.files.forEach(f => f.units.forEach(U => unitFile.push([U.s, U.e, f.name])));
unitFile.sort((a, b) => a[0] - b[0]);
function targetOf(line) { let lo = 0, hi = unitFile.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1; const u = unitFile[m]; if (line < u[0]) hi = m - 1; else if (line > u[1]) lo = m + 1; else return u[2]; } return ''; }
// ---------- duplicates table
const ORDER = Object.keys(o.files);
let rows = [], stat = { names: 0, dead: 0, wrapChains: 0, deferred: 0, multiFileTargets: 0 };
const names = Object.keys(d).sort((a, b) => { const fa = d[a][0], fb = d[b][0]; return ORDER.indexOf(fa.f) - ORDER.indexOf(fb.f) || fa.ln - fb.ln; });
for (const n of names) {
  const all = d[n].slice().sort((a, b) => a.seq - b.seq);
  // collapse "var X = window.X = window.X || fn" double entries on same line
  const defs = []; all.forEach(e => { const p = defs[defs.length - 1]; if (p && p.f === e.f && p.ln === e.ln) { if (e.win) defs[defs.length - 1] = e; return; } defs.push(e); });
  const load = defs.filter(e => e.load), deferred = defs.filter(e => !e.load);
  if (load.length < 2 && !deferred.length) continue;
  // follow the live chain from the last load-time definition backwards
  const live_ = new Set(); const chain = [];
  let cur = load.length - 1;
  while (cur >= 0) {
    const e = load[cur]; let k, pred = -1;
    const prevIdx = (lineLimit) => { for (let j = cur - 1; j >= 0; j--) { const p = load[j]; if (p.f !== e.f || p.ln < lineLimit) return j; } return -1; };
    if (e.wrap === '(self||)') { if (cur === 0) k = 'заглушка'; else { k = null; pred = cur - 1; } }
    else if (e.wrap) { k = 'обёртка'; pred = prevIdx(e.capLine || e.ln); }
    else if (!e.isFn) { if (e.vt === 'Identifier') { k = 'через локальную `' + (e.alias || '?') + '`'; pred = cur - 1; } else { k = (e.alias ? 'алиас на `' + e.alias.replace(/^window\./, '') + '`' : 'значение') + (e.cond ? ', под условием' : ''); pred = e.cond ? cur - 1 : -1; } }
    else if (e.cond) { k = 'замена под условием'; pred = cur - 1; }
    else { k = 'база'; }
    if (k) { chain.push({ e, k }); live_.add(e); }
    cur = pred;
  }
  chain.reverse();
  const dead = load.filter(e => !live_.has(e)).map(e => ({ e }));
  const loc = e => short(e.f) + ':' + e.ln;
  const live = chain.slice().reverse().map((c, i) => (i === 0 ? '**' + loc(c.e) + '**' : loc(c.e)) + (c.k === 'обёртка' ? '' : ' (' + c.k + ')')).join(' → ');
  const deadS = dead.map(x => loc(x.e)).join(', ');
  const defS = deferred.map(e => loc(e) + ' (' + (e.def || 'позже') + ')').join(', ');
  const tg = [...new Set(defs.filter(e => e.f === 'ui_v71.js').map(e => targetOf(e.ln)).filter(Boolean))];
  stat.names++; stat.dead += dead.length; if (chain.length > 1) stat.wrapChains++; if (deferred.length) stat.deferred++; if (tg.length > 1) stat.multiFileTargets++;
  rows.push('| `' + n + '` | ' + load.length + (deferred.length ? '+' + deferred.length : '') + ' | ' + live + ' | ' + (deadS || '—') + (defS ? ' · отложенно: ' + defS : '') + ' | ' + tg.map(t => t.replace('v71_', '').replace('.js', '')).join(', ') + ' |');
}
fs.writeFileSync('dups.md', '| Функция | Опр. | Что работает (последняя → … → база) | Перекрыто (не вызывается по этому имени) | Куда едет |\n|---|---|---|---|---|\n' + rows.join('\n') + '\n');
console.log(stat, 'rows', rows.length);
// ---------- mapping
const blocks = o.files['ui_v71.js'].blocks;
const label = b => { const B = blocks[b]; const segs = (B.lead || '').split(' | '); let m = null; for (let i = segs.length - 1; i >= 0 && !m; i--) { if (/END JENNY/.test(segs[i])) continue; m = /JENNY[_ ]V(\d+(?:[._]\d+)?)/.exec(segs[i]); } return m ? 'V' + m[1].replace('_', '.') : ('b' + b); };
let out = [];
F.files.forEach((f, fi) => {
  const lines = f.units.reduce((a, U) => a + U.e - U.s + 1, 0);
  out.push('\n#### ' + (fi + 1) + '. `' + f.name + '` — ' + f.units.length + ' блоков, ~' + lines + ' строк\n');
  // flat runs
  const flat = f.units.filter(U => !U.par), pat = f.units.filter(U => U.par);
  if (flat.length) {
    const runs = []; flat.forEach(U => { const r = runs[runs.length - 1]; if (r && U.b === r.lb + 1) { r.e = U.e; r.lb = U.b; U.W.forEach(n => r.w.add(n)); } else runs.push({ s: U.s, e: U.e, lb: U.b, w: new Set(U.W) }); });
    out.push('Плоская часть (целые верхнеуровневые блоки):\n');
    runs.forEach(r => { const w = [...r.w].filter(n => !/^_orig|^_prev/.test(n)); out.push('- ' + r.s + '–' + r.e + (w.length ? ' · ' + w.slice(0, 4).map(n => '`' + n + '`').join(', ') + (w.length > 4 ? ' …+' + (w.length - 4) : '') : '')); });
  }
  if (pat.length) {
    out.push('\nКуски патчей-IIFE (диапазоны строк внутри исходного IIFE):\n');
    const byB = {}; pat.forEach(U => (byB[U.b] = byB[U.b] || []).push(U));
    Object.keys(byB).map(Number).sort((a, b) => a - b).forEach(b => {
      const us = byB[b]; const runs = []; us.forEach(U => { const r = runs[runs.length - 1]; if (r && U.u === r.lu + 1) { r.e = U.e; r.lu = U.u; } else runs.push({ s: U.s, e: U.e, lu: U.u }); });
      const w = new Set(); us.forEach(U => U.W.forEach(n => { if (!/Installed|^_/.test(n)) w.add(n); }));
      const ln = us.reduce((a, U) => a + U.e - U.s + 1, 0);
      out.push('- **' + label(b) + '** (' + ln + ' стр.): ' + runs.map(r => r.s === r.e ? r.s : r.s + '–' + r.e).join(', ') + ([...w].length ? ' · ' + [...w].slice(0, 3).map(n => '`' + n + '`').join(', ') + (w.size > 3 ? ' …+' + (w.size - 3) : '') : ''));
    });
  }
});
fs.writeFileSync('map.md', out.join('\n') + '\n');
// ---------- IIFE table
const pi = F.perI.sort((a, b) => a.b - b.b).map(p => '| ' + label(p.b) + ' | ' + p.s + '–' + p.e + ' | ' + (p.guard ? '`' + p.guard.replace(/window\./, '') + '`' : '—') + ' | ' + Object.entries(p.parts).sort((a, b) => b[1].l - a[1].l).map(([k, v]) => k.replace('v71_', '').replace('.js', '') + ' ' + v.l).join(', ') + ' | ' + (p.dup.length ? p.dup.map(x => '`' + x + '`').join(', ') : '—') + ' |');
fs.writeFileSync('iife.md', '| Патч | Строки | Флаг-сторож | Куски (файл и строк) | Локальные помощники, которые надо продублировать |\n|---|---|---|---|---|\n' + pi.join('\n') + '\n');
console.log('map lines', out.length, 'bytes', fs.statSync('map.md').size, fs.statSync('dups.md').size, fs.statSync('iife.md').size);

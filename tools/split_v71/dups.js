const fs = require('fs'), path = require('path');
const dir = __dirname + '/orig';
const o = require('./out2.json');
const ORDER = Object.keys(o.files);
const SRC = {}; ORDER.forEach(f => SRC[f] = fs.readFileSync(path.join(dir, f), 'utf8').split('\n'));
const esc = s => s.replace(/[$]/g, '\\$');
const byName = {};
let seq = 0;
for (const f of ORDER) for (const B of o.files[f].blocks) {
  for (const r of B.refs) {
    if (!r.w || r.loc) continue;
    const L = SRC[f];
    const e = { f, b: B.i, ln: r.ln, end: r.vl || r.ln, load: r.l, op: r.op || (r.fd ? 'fdecl' : (r.decl ? 'decl' : '=')), vt: r.vt || '', cond: r.cond || '', def: r.def || '', win: r.win || 0, seq: seq++ };
    e.isFn = e.vt === 'fn' ? 1 : 0;
    const N = esc(r.n);
    const val = L.slice(r.ln - 1, e.end).join('\n');
    // captured variables: "v = ... N ..." within the preceding 80 lines of the same block
    const from = B.iife ? B.s : 1;
    const caps = new Map();
    const re = new RegExp('([A-Za-z_$][\\w$.]*)\\s*=\\s*[^=;\\n]*?(?:window\\.|self\\.|\\b)' + N + '\\b(?!\\s*=[^=])');
    for (let k = from; k <= r.ln; k++) {
      const line = L[k - 1]; const m = re.exec(line);
      if (m && m[1] !== 'window.' + r.n && m[1] !== r.n) caps.set(m[1].split('.').pop(), k);
    }
    let wrap = '', capLine = 0;
    for (const [v, cl] of [...caps.entries()].sort((a, b) => b[1] - a[1])) { if (new RegExp('(^|[^\\w$])' + esc(v) + '\\b').test(val.replace(new RegExp('^[^\\n]*?=\\s*'), ''))) { wrap = v; capLine = cl; break; } }
    // self reference on RHS e.g. window.X = window.X || function
    const rhs = val.slice(val.indexOf('=') + 1);
    const head = rhs.slice(0, 160);
    if (!wrap && new RegExp('^\\s*(?:\\(?\\s*typeof\\s+)?(?:window\\.)?' + N + '\\b').test(head) && e.isFn === 0 && /\|\||\?/.test(head)) wrap = '(self||)';
    e.wrap = wrap; e.capLine = capLine;
    if (!e.isFn && (e.vt === 'MemberExpression' || e.vt === 'Identifier')) e.alias = rhs.trim().replace(/;[\s\S]*$/, '').slice(0, 50);
    // conditional guard that means "only if absent"
    e.ifAbsent = /^\s*!\s*(window\.)?[\w$]+\s*$/.test(e.cond) && new RegExp(N + '\\b').test(e.cond) || new RegExp("typeof\\s+(window\\.)?" + N + "\\s*[!=]==?\\s*'(undefined|function)'").test(e.cond) && /!==\s*'function'|===\s*'undefined'/.test(e.cond) ? 1 : 0;
    (byName[r.n] = byName[r.n] || []).push(e);
  }
}
const multi = Object.entries(byName).filter(([n, a]) => a.length > 1 && a.some(x => x.isFn));
fs.writeFileSync(__dirname + '/dups.json', JSON.stringify(Object.fromEntries(multi)));
fs.writeFileSync(__dirname + '/allwrites.json', JSON.stringify(byName));
let st = { names: multi.length, defs: 0, load: 0, deferred: 0, wrap: 0, cond: 0 };
multi.forEach(([n, a]) => a.forEach(e => { st.defs++; e.load ? st.load++ : st.deferred++; if (e.wrap) st.wrap++; if (e.cond) st.cond++; }));
console.log(st);
if (process.argv[2]) (byName[process.argv[2]] || []).forEach(e => console.log(JSON.stringify(e)));

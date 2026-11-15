// Deep analysis. usage: node an2.js <dir> -> out2.json
const fs = require('fs'), path = require('path');
const acorn = require('acorn'), walk = require('acorn-walk');
const dir = process.argv[2];
const ORDER = ['engine_audio.js','engine_video_deck_b.js','engine_heads.js','engine_fav.js','ui_init.js','ui_config.js','ui_render.js','ui_playback.js','ui_scrub_engine.js','ui_touch_arc.js','ui_controls.js','ui_export.js','ui_help.js','ui_v71.js','jenny_deck_b_modals.js'];
const WIN = new Set(['window','self','globalThis']);
const SYNC_CB = new Set(['forEach','map','filter','some','every','reduce','sort','find','findIndex','call','apply','replace']);
const isFn = n => n && (n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression' || n.type === 'FunctionDeclaration');
const out = { files: {} };
let fid = 0;
for (const file of ORDER) {
  const src = fs.readFileSync(path.join(dir, file), 'utf8');
  const comments = [];
  const ast = acorn.parse(src, { ecmaVersion: 'latest', locations: true, onComment: comments });
  // ---- scopes
  const scopeDecl = new Map(); // fn node -> Map(name -> {kind, node(init fn?)})
  function declsOf(fnNode) {
    const m = new Map();
    const add = (name, kind, val) => { if (!m.has(name) || kind === 'function') m.set(name, { kind, val, count: (m.get(name) ? m.get(name).count : 0) + 1, lines: ((m.get(name) && m.get(name).lines) || []) }); else m.get(name).count++; };
    function pat(p, kind, val) {
      if (!p) return;
      if (p.type === 'Identifier') add(p.name, kind, val);
      else if (p.type === 'ObjectPattern') p.properties.forEach(q => pat(q.value || q.argument, kind));
      else if (p.type === 'ArrayPattern') p.elements.forEach(q => pat(q, kind));
      else if (p.type === 'AssignmentPattern') pat(p.left, kind);
      else if (p.type === 'RestElement') pat(p.argument, kind);
    }
    if (fnNode.type !== 'Program') { fnNode.params.forEach(p => pat(p, 'param')); if (fnNode.id && fnNode.type === 'FunctionExpression') add(fnNode.id.name, 'fname', fnNode); }
    const body = fnNode.type === 'Program' ? fnNode : fnNode.body;
    (function rec(n) {
      if (!n || typeof n.type !== 'string') return;
      if (n !== body && isFn(n)) { if (n.type === 'FunctionDeclaration') { add(n.id.name, 'function', n); m.get(n.id.name).lines.push(n.loc.start.line); } return; }
      if (n.type === 'VariableDeclaration') n.declarations.forEach(d => pat(d.id, n.kind, d.init));
      if (n.type === 'ClassDeclaration') add(n.id.name, 'class');
      if (n.type === 'CatchClause' && n.param) pat(n.param, 'catch');
      for (const k in n) { const v = n[k]; if (k === 'loc') continue; if (Array.isArray(v)) v.forEach(rec); else if (v && typeof v.type === 'string') rec(v); }
    })(body);
    return m;
  }
  const allFns = [];
  walk.full(ast, n => { if (isFn(n)) allFns.push(n); });
  scopeDecl.set(ast, declsOf(ast));
  allFns.forEach(f => { f._id = ++fid; scopeDecl.set(f, declsOf(f)); });
  const globalsDeclared = [...scopeDecl.get(ast).entries()].map(([k, v]) => [k, v.kind]);
  // duplicate function declarations in same local scope
  const localDupFns = [];
  allFns.forEach(f => { for (const [name, d] of scopeDecl.get(f)) if (d.kind === 'function' && d.lines.length > 1) localDupFns.push({ name, scopeLine: f.loc.start.line, lines: d.lines }); });
  for (const [name, d] of scopeDecl.get(ast)) if (d.kind === 'function' && d.lines.length > 1) localDupFns.push({ name, scopeLine: 0, lines: d.lines });

  function resolve(name, anc) { // -> {global:true} | {fn}
    for (let k = anc.length - 1; k >= 0; k--) { const a = anc[k]; if (isFn(a) && scopeDecl.get(a).has(name)) return a; }
    return null;
  }
  // ---- load-time function set (fixpoint)
  const LT = new Set();
  const refsRaw = []; // collected each pass
  function enclosingFns(anc) { return anc.filter(isFn); }
  function atLoad(anc, self) { return enclosingFns(anc).every(f => f === self || LT.has(f)); }
  let changed = true, guard = 0;
  while (changed && guard++ < 12) {
    changed = false;
    walk.ancestor(ast, {
      CallExpression(n, anc) {
        if (!atLoad(anc.slice(0, -1))) return;
        let c = n.callee; const cand = [];
        if (isFn(c)) cand.push(c);
        if (c.type === 'MemberExpression' && isFn(c.object)) cand.push(c.object);
        if (c.type === 'Identifier') { const sc = resolve(c.name, anc); if (sc) { const d = scopeDecl.get(sc).get(c.name); if (d && isFn(d.val)) cand.push(d.val); } }
        if (c.type === 'MemberExpression' && !c.computed && SYNC_CB.has(c.property.name)) n.arguments.forEach(a => { if (isFn(a)) cand.push(a); else if (a.type === 'Identifier') { const sc = resolve(a.name, anc); if (sc) { const d = scopeDecl.get(sc).get(a.name); if (d && isFn(d.val)) cand.push(d.val); } } });
        cand.forEach(f => { if (!LT.has(f)) { LT.add(f); changed = true; } });
      }
    });
  }
  // ---- per top-level block collection
  const blocks = [];
  ast.body.forEach((st, bi) => {
    let iife = null;
    if (st.type === 'ExpressionStatement') { let e = st.expression; if (e.type === 'UnaryExpression') e = e.argument; if (e.type === 'CallExpression') { const c = e.callee; if (isFn(c)) iife = c; else if (c.type === 'MemberExpression' && isFn(c.object)) iife = c.object; } }
    const prevEnd = bi ? ast.body[bi - 1].end : 0;
    const lead = comments.filter(c => c.start >= prevEnd && c.end <= st.start).map(c => c.value.trim().replace(/\s+/g, ' ')).filter(s => /[A-Za-zА-Яа-я]/.test(s)).join(' | ');
    const B = { i: bi, so: st.start, eo: st.end, prevEnd, bodyS: iife && iife.body.type === 'BlockStatement' ? iife.body.start : -1, bodyE: iife && iife.body.type === 'BlockStatement' ? iife.body.end : -1, nParams: iife ? iife.params.length : 0, nArgs: iife ? (((st.expression.arguments) || (st.expression.argument && st.expression.argument.arguments) || []).length) : 0, s: st.loc.start.line, e: st.loc.end.line, iife: !!iife, lead: lead.slice(0, 300), refs: [], side: [], inner: null };
    // unit index inside IIFE
    let units = null;
    if (iife && iife.body.type === 'BlockStatement') {
      units = iife.body.body;
      B.inner = units.map((u, ui) => {
        const pe = ui ? units[ui - 1].end : iife.body.start;
        const l = comments.filter(c => c.start >= pe && c.end <= u.start).map(c => c.value.trim().replace(/\s+/g, ' ')).filter(s => /[A-Za-zА-Яа-я]/.test(s)).join(' | ');
        let desc = u.type;
        if (u.type === 'FunctionDeclaration') desc = 'function ' + u.id.name;
        else if (u.type === 'VariableDeclaration') desc = u.kind + ' ' + u.declarations.map(d => d.id.name || '{}').join(',');
        else if (u.type === 'ExpressionStatement') desc = src.slice(u.start, Math.min(u.end, u.start + 70)).replace(/\s+/g, ' ');
        else if (u.type === 'IfStatement') desc = 'if (' + src.slice(u.test.start, Math.min(u.test.end, u.test.start + 60)) + ')';
        return { u: ui, so: u.start, eo: u.end, pe, s: u.loc.start.line, e: u.loc.end.line, desc, lead: l.slice(0, 200) };
      });
    }
    const unitOf = node => { if (!units) return -1; for (let k = 0; k < units.length; k++) if (node.start >= units[k].start && node.end <= units[k].end) return k; return -1; };
    function rec(name, node, anc, w, extra) {
      const sc = resolve(name, anc);
      const load = atLoad(anc);
      const r = { n: name, w: w ? 1 : 0, l: load ? 1 : 0, ln: node.loc.start.line, u: unitOf(node) };
      if (sc) { if (sc !== iife) return; r.loc = 1; } // only track locals of the top IIFE (closure-shared) + globals
      if (extra) Object.assign(r, extra);
      B.refs.push(r);
    }
    const anc0 = [ast];
    walk.ancestor(st, {
      Identifier(n, anc) { if (WIN.has(n.name) || n.name === 'undefined' || n.name === 'arguments') return; rec(n.name, n, anc0.concat(anc), false); },
      VariablePattern(n, anc) {
        const full = anc0.concat(anc); const p = full[full.length - 2];
        // declaration without init is not a write; params are not refs
        if (p && isFn(p)) return;
        if (p && p.type === 'VariableDeclarator' && !p.init) return;
        let extra = null;
        if (p && p.type === 'VariableDeclarator' && p.init) extra = { decl: 1, vt: isFn(p.init) ? 'fn' : p.init.type, vl: p.init.loc.end.line };
        if (p && p.type === 'AssignmentExpression' && p.left === n) extra = { op: p.operator, vt: isFn(p.right) ? 'fn' : p.right.type, vl: p.right.loc.end.line };
        rec(n.name, n, full, true, extra);
      },
      FunctionDeclaration(n, anc) { const full = anc0.concat(anc); rec(n.id.name, n, full.slice(0, -1), true, { decl: 1, fd: 1, vt: 'fn', vl: n.loc.end.line }); },
      MemberExpression(n, anc) {
        if (n.object.type === 'Identifier' && WIN.has(n.object.name)) {
          const full = anc0.concat(anc);
          if (resolve(n.object.name, full)) return;
          let name = null;
          if (!n.computed && n.property.type === 'Identifier') name = n.property.name;
          else if (n.computed && n.property.type === 'Literal' && typeof n.property.value === 'string') name = n.property.value;
          if (!name) return;
          const p = full[full.length - 2];
          const w = p && ((p.type === 'AssignmentExpression' && p.left === n) || (p.type === 'UpdateExpression'));
          const load = atLoad(full);
          const r = { n: name, w: w ? 1 : 0, l: load ? 1 : 0, ln: n.loc.start.line, u: unitOf(n), win: 1 };
          if (w && p.type === 'AssignmentExpression') {
            r.op = p.operator; r.vt = isFn(p.right) ? 'fn' : p.right.type; r.vs = p.right.start; r.ve = p.right.end; r.vl = p.right.loc.end.line;
            // conditional context
            let cond = '';
            for (let k = full.length - 2; k >= 0; k--) { const a = full[k]; if (isFn(a) && !LT.has(a)) break; if (a.type === 'IfStatement') { cond = src.slice(a.test.start, Math.min(a.test.end, a.test.start + 70)); break; } }
            r.cond = cond;
            // deferred context descr
            if (!load) { for (let k = full.length - 1; k >= 0; k--) { const a = full[k]; if (isFn(a) && !LT.has(a)) { const pp = full[k - 1]; r.def = pp && pp.type === 'CallExpression' ? src.slice(pp.callee.start, Math.min(pp.callee.end, pp.callee.start + 40)) : (a.id ? 'function ' + a.id.name : (pp && pp.type === 'AssignmentExpression' ? src.slice(pp.left.start, Math.min(pp.left.end, pp.left.start + 40)) + '=fn' : (pp && pp.type === 'VariableDeclarator' ? pp.id.name + '=fn' : 'fn'))); } } }
          }
          B.refs.push(r);
        }
      },
      CallExpression(n, anc) {
        const full = anc0.concat(anc);
        const load = atLoad(full.slice(0, -1).concat([n]));
        const c = n.callee; const cs = src.slice(c.start, Math.min(c.end, c.start + 60));
        const ln = n.loc.start.line, u = unitOf(n);
        if (c.type === 'MemberExpression' && !c.computed) {
          const pn = c.property.name;
          if (pn === 'addEventListener' || pn === 'removeEventListener') { const t = src.slice(c.object.start, Math.min(c.object.end, c.object.start + 40)); const ev = n.arguments[0] && n.arguments[0].type === 'Literal' ? n.arguments[0].value : '?'; const cap = n.arguments[2] ? src.slice(n.arguments[2].start, n.arguments[2].end).replace(/\s+/g, '') : ''; B.side.push({ k: pn === 'addEventListener' ? 'listen' : 'unlisten', t, ev, cap, l: load ? 1 : 0, ln, u }); }
          if (pn === 'defineProperty') B.side.push({ k: 'defprop', t: n.arguments.slice(0, 2).map(a => src.slice(a.start, Math.min(a.end, a.start + 50))).join(','), l: load ? 1 : 0, ln, u });
          if (pn === 'observe') B.side.push({ k: 'observe', t: src.slice(c.object.start, Math.min(c.object.end, c.object.start + 30)), l: load ? 1 : 0, ln, u });
          if (pn === 'then' || pn === 'requestAnimationFrame') B.side.push({ k: pn === 'then' ? 'promise' : 'raf', l: load ? 1 : 0, ln, u });
          if (pn === 'createElement' && n.arguments[0] && n.arguments[0].value === 'style') B.side.push({ k: 'style', l: load ? 1 : 0, ln, u });
          if (pn === 'setItem' && /localStorage/.test(cs)) B.side.push({ k: 'ls', t: n.arguments[0] ? src.slice(n.arguments[0].start, Math.min(n.arguments[0].end, n.arguments[0].start + 40)) : '', l: load ? 1 : 0, ln, u });
        }
        const nm = c.type === 'Identifier' ? c.name : (c.type === 'MemberExpression' && !c.computed && c.object.type === 'Identifier' && WIN.has(c.object.name) ? c.property.name : null);
        if (nm === 'setTimeout' || nm === 'setInterval' || nm === 'requestAnimationFrame' || nm === 'fetch') {
          const d = n.arguments[1] ? src.slice(n.arguments[1].start, Math.min(n.arguments[1].end, n.arguments[1].start + 20)) : '0';
          B.side.push({ k: nm, d: nm === 'fetch' ? (n.arguments[0] ? src.slice(n.arguments[0].start, Math.min(n.arguments[0].end, n.arguments[0].start + 40)) : '') : d, l: load ? 1 : 0, ln, u });
        }
        if (nm && load && !['setTimeout', 'setInterval', 'requestAnimationFrame', 'fetch', 'parseInt', 'parseFloat', 'String', 'Number', 'Boolean', 'isNaN', 'isFinite', 'Array', 'Object', 'Date', 'RegExp', 'Error', 'Promise', 'Symbol'].includes(nm)) {
          if (!(c.type === 'Identifier' && resolve(nm, full))) B.side.push({ k: 'ltcall', t: nm, l: 1, ln, u });
        }
      },
      AssignmentExpression(n, anc) {
        // prototype patches: X.prototype.y = ...
        const full = anc0.concat(anc);
        const L = n.left;
        if (L.type === 'MemberExpression') { const t = src.slice(L.start, L.end); if (/\.prototype\.|Proto\.|proto\./.test(t)) B.side.push({ k: 'proto', t: t.slice(0, 60), l: atLoad(full) ? 1 : 0, ln: n.loc.start.line, u: unitOf(n) }); }
      }
    });
    // IIFE local decls
    if (iife) {
      B.locals = [...scopeDecl.get(iife).entries()].map(([k, v]) => ({ n: k, kind: v.kind, fn: isFn(v.val) ? 1 : 0, ln: v.val && v.val.loc ? v.val.loc.start.line : 0, cnt: v.count }));
      const f0 = iife.body.body && iife.body.body[0];
      if (f0 && f0.type === 'IfStatement') B.guard = src.slice(f0.test.start, Math.min(f0.test.end, f0.test.start + 80));
    }
    B.bytes = st.end - st.start;
    blocks.push(B);
  });
  out.files[file] = { blocks, globalsDeclared, localDupFns };
  console.log(file, blocks.length, 'LT fns', LT.size);
}
fs.writeFileSync(process.argv[3] || __dirname + '/out2.json', JSON.stringify(out));

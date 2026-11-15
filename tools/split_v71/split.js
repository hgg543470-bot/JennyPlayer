// Режет ui_v71.js на тематические файлы по раскладке из partition.js (layer()).
// usage: node split.js <outDir>
process.env.NOTIMER = '1';
const fs = require('fs'), path = require('path');
const P = require('./partition.js');
const { units, iifeInfo } = P;
const F = P.F;
const SRC = fs.readFileSync(__dirname + '/orig/' + F, 'utf8');
const blocks = P.o.files[F].blocks;
const outDir = process.argv[2];
const NAME = { 'styles.1': 'ui_styles.js', 'settings.1': 'ui_settings.js', 'gestures.1': 'ui_gestures.js', 'playlist.1': 'ui_playlist.js', 'transport.1': 'ui_transport.js', 'reverse.1': 'ui_reverse.js', 'sources.1': 'ui_sources.js', 'torrent.1': 'ui_torrent.js', 'video.1': 'ui_video.js', 'video_reverse.1': 'ui_video_reverse.js', 'framegen.1': 'ui_framegen.js', 'export.1': 'ui_export_modal.js', 'shade.1': 'ui_shade.js', 'net.1': 'ui_net.js', 'video.2': 'ui_video_decks.js', 'settings.2': 'ui_layout.js', 'transport.2': 'ui_deck_a_guard.js', 'shade.2': 'ui_shade_v243.js' };
const TITLE = { 'ui_styles.js': 'CSS-вставки всех патчей (порядок как в исходнике)', 'ui_settings.js': 'Настройки: слоты форматов, потоки, EQ/громкость, язык, стартовый гид, toggleModal', 'ui_gestures.js': 'Жесты: зажатие 180 мс, монитор касаний', 'ui_playlist.js': 'Плейлист: вкладки, сортировка, теги, поиск, очередь, папки, строки треков, fetchData', 'ui_transport.js': 'Дека А: playTrack, play/pause, след./пред., кнопка в строке', 'ui_reverse.js': 'Реверс и RAM-движок аудио: горизонт, передачи, часы WebAudio, DNA, скраб, дуга скорости', 'ui_sources.js': 'Источники: меню, OST/архив, радио, SoundCloud, YouTube, мини-плееры, рубильник', 'ui_torrent.js': 'Торрент-студия: поиск, magnet/.torrent, очередь, трекеры, карта кусков, P2P', 'ui_video.js': 'Видео, база (V130–V211): плеер, HUD, PiP/оверлей, RAM-декод, вкладка «Видео»', 'ui_video_reverse.js': 'Реверс видео: очередь сегментов в RAM, реверс Деки Б', 'ui_framegen.js': '120 Гц: генерация кадров, тюнер, лаборатория, vcore', 'ui_export_modal.js': 'Окно экспорта (V234)', 'ui_shade.js': 'Шторка: уведомление Android, MediaSession, фоновый режим', 'ui_net.js': 'Сеть: маршрутизатор портов, перехваты fetch/XHR/src/play()', 'ui_video_decks.js': 'Видео, поздняя часть (V211+): Дека Б, две деки, панели кнопок', 'ui_layout.js': 'Раскладка экрана: поздние правки шапки и модалок (V242, V360)', 'ui_deck_a_guard.js': 'Дека А: защита паузы (V370)', 'ui_shade_v243.js': 'Шторка, поздняя часть (V243–V244): итоговое уведомление, отметка касаний, безопасные отступы' };
if (P.OVR.files) { for (const k in NAME) delete NAME[k]; for (const k in P.OVR.files) { NAME[k] = P.OVR.files[k][0]; TITLE[P.OVR.files[k][0]] = P.OVR.files[k][1]; } }
const LY = P.layer(P.OVR.order);
LY.files.forEach(f => { f.name = NAME[f.theme + '.' + f.layer]; if (!f.name) throw new Error('no name for ' + f.theme + '.' + f.layer); f.units.forEach(U => U.fname = f.name); });
const label = b => { const B = blocks[b]; const segs = (B.lead || '').split(' | '); let m = null; for (let i = segs.length - 1; i >= 0 && !m; i--) { if (/END JENNY/.test(segs[i])) continue; m = /JENNY[_ ]V(\d+(?:[._]\d+)?)/.exec(segs[i]); } return m ? 'V' + m[1].replace('_', '.') : ('блок ' + b); };
const needSemi = t => /^[(\[`+\-\/]/.test(t);
const text = U => SRC.slice(U.so, U.eo);
const gap = U => SRC.slice(U.gapS, U.so);
const emitUnit = (U, noGap) => (noGap ? '' : gap(U)) + (needSemi(text(U)) ? ';' : '') + text(U);
const unitsOfBlock = {}; units.forEach(U => { if (U.parent) (unitsOfBlock[U.b] = unitsOfBlock[U.b] || []).push(U); });
const stats = { pieces: 0, dups: 0, flat: 0 };
const manifest = [];
let lastTopEnd = 0;
LY.files.forEach(f => {
  const BUNDLE = P.OVR.bundle || 'bundle_2_player.js';
  const fnNames = []; f.units.forEach(U => U.refs.forEach(r => { if (r.w && !r.loc && r.l && r.vt === 'fn' && !/^_|Installed|^orig/.test(r.n) && !fnNames.includes(r.n)) fnNames.push(r.n); }));
  const runsL = []; f.units.forEach(U => { const r = runsL[runsL.length - 1]; if (r && U.k === r.lk + 1) { r.e = U.e; r.lk = U.k; } else runsL.push({ s: U.s, e: U.e, lk: U.k }); });
  const origin = runsL.length <= 6 ? runsL.map(r => r.s + '–' + r.e).join(', ') : runsL[0].s + '…' + runsL[runsL.length - 1].e + ' (' + runsL.length + ' фрагментов, вперемешку с другими темами)';
  let out = '/* ============================================================================\n * ' + f.name + ' — ' + TITLE[f.name] + '\n *\n'
    + ' * Склейка:  /' + BUNDLE + ', модуль ' + (LY.files.indexOf(f) + 1) + ' из ' + LY.files.length + '. Порядок модулей задан в player.py и менять его нельзя:\n *           поздние модули переопределяют и оборачивают функции ранних.\n'
    + (fnNames.length ? ' * Внутри:   ' + fnNames.slice(0, 10).join(', ') + (fnNames.length > 10 ? ' … (всего функций: ' + fnNames.length + ')' : '') + '\n' : '')
    + ' * Откуда:   ' + F + ' (коммит 9ae6639), строки ' + origin + '. Код блоков перенесён без правок.\n'
    + ' * Подробно: FILES.md (карта файлов), REFACTOR_PLAN.md (как резалось и что перекрыто).\n'
    + ' * ============================================================================ */\n';
  // group consecutive units of the same split IIFE into one piece (all units of that IIFE in this file)
  const done = new Set();
  f.units.forEach(U => {
    if (!U.parent) { out += emitUnit(U); stats.flat++; return; }
    if (done.has(U.b)) return; done.add(U.b);
    const B = blocks[U.b], I = iifeInfo[U.b];
    const mine = f.units.filter(X => X.b === U.b);
    const mineSet = new Set(mine);
    const all = unitsOfBlock[U.b];
    const headers = all.filter(X => X.theme === 'HEADER');
    // helper duplication (transitive)
    const have = new Set(); mine.forEach(X => { for (const n in I.declUnit) if (I.declUnit[n] === X.u) have.add(n); });
    const dupUnits = new Set(); const queue = [...mine];
    while (queue.length) {
      const X = queue.pop();
      [...X.LR, ...X.LW].forEach(n => {
        if (have.has(n)) return;
        const du = I.declUnit[n];
        if (du === undefined) { const l = (B.locals || []).find(l => l.n === n); if (l && (l.kind === 'fname' || l.kind === 'param' || l.kind === 'catch')) return; throw new Error('no decl unit for local ' + n + ' in b' + U.b); }
        const D = all.find(Y => Y.u === du);
        if (D.theme === 'HEADER') return;
        if (mineSet.has(D)) { have.add(n); return; }
        if (!I.pure.has(n) && !I.consts.has(n)) throw new Error('STATE local ' + n + ' needed across files in b' + U.b + ' unit ' + X.id + ' -> ' + f.name);
        if (!dupUnits.has(D)) { dupUnits.add(D); queue.push(D); }
        for (const m in I.declUnit) if (I.declUnit[m] === du) have.add(m);
      });
    }
    // guard
    let guard = '';
    const tag = f.name.replace(/^ui_|\.js$/g, '');
    if (headers.length) {
      const m = /window\.([\w$]+)/.exec(B.guard || '');
      if (!m) throw new Error('no guard flag b' + U.b);
      const flag = m[1];
      headers.forEach(H => { const t = text(H); if (!t.includes(flag)) throw new Error('header without flag b' + U.b + ': ' + t); guard += '\n    ' + t.split(flag).join(flag + '__' + tag); });
      guard += '\n    window.' + flag + ' = true;';
    }
    const first = all.find(X => X.theme !== 'HEADER');
    const isFirstPiece = mineSet.has(first);
    out += (isFirstPiece ? SRC.slice(B.prevEnd, B.so) : '\n\n');
    out += '/* [split] ' + label(U.b) + ': кусок исходного IIFE (' + F + ', строки ' + B.s + '–' + B.e + ') → ' + f.name + ' */\n';
    out += ';' + SRC.slice(B.so, B.bodyS + 1) + guard;
    const dl = [...dupUnits].sort((a, b) => a.u - b.u);
    if (dl.length) { out += '\n    /* [split] копии локальных помощников этого патча (без собственного состояния) */'; dl.forEach(D => { out += '\n    ' + text(D); stats.dups++; }); }
    mine.forEach(X => { let g = gap(X); if (!/\n/.test(g)) g = '\n    ' + g.replace(/^\s+/, ''); out += g + (needSemi(text(X)) ? ';' : '') + text(X); });
    out += '\n' + SRC.slice(B.bodyE - 1, B.eo);
    stats.pieces++;
  });
  out += '\n';
  fs.writeFileSync(path.join(outDir, f.name), out);
  manifest.push(f.name);
});
fs.writeFileSync(path.join(outDir, '_manifest.json'), JSON.stringify(manifest));
console.log(stats, manifest.join(' '));

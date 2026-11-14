// Main-screen renderers for the ten mini-games. Logical canvas is 1600 x 900.
// Each scene: bg(c, v, S) is painted once per game; draw(c, v, S) every frame.
// S = { t, pt (seconds in current phase), phase, runnerId, who(id) -> {ci, name}, over }
const Scenes = (() => {
  const A = Art, P = A.PAL, TAU = A.TAU;
  const lerp = (a, b, k) => a + (b - a) * k;
  const tag = (c, S, id, x, y, size = 24) => A.txt(c, S.who(id).name, x, y, size, { hand: true, bold: true });
  const ripples = (c, x, y, k, seed) => { for (let i = 0; i < 3; i++) A.ink(c, A.circ(x, y, 18 + k * 60 + i * 16, 14, 7 + k * 20 + i * 6), seed + i, { closed: true, w: 2, alpha: 0.6 * (1 - k), color: P.slate }); };
  const water = (c, pts, seed) => {
    A.wash(c, pts, P.water, seed, { alpha: 0.32, amp: 7 }); A.wash(c, pts, P.teal, seed + 1, { alpha: 0.1, amp: 12, layers: 2 });
    const r = A.rng(seed + 2), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    for (let i = 0; i < 46; i++) { const x = lerp(x0 + 30, x1 - 90, r()), y = lerp(y0 + 20, y1 - 20, r()); A.ink(c, [[x, y], [x + 22, y - 4], [x + 44, y + 2], [x + 66, y - 2]], seed + i, { w: 1.5, alpha: 0.3, color: P.slate }); }
  };
  const fallen = (S, lost) => (S.phase === 'result' && lost ? S.pt : 0);

  // 1 ── Honeycomb Maze ────────────────────────────────────────────────────────────────
  const HS = 60, HC = [800, 485];
  const hx = (q, r) => [HC[0] + HS * Math.sqrt(3) * (q + r / 2), HC[1] + HS * 1.5 * r];
  const hcorner = (p, i) => { const a = ((i * 60 - 30) * Math.PI) / 180; return [p[0] + HS * Math.cos(a), p[1] + HS * Math.sin(a)]; };
  const honeycomb = {
    bg(c, v) {
      const tints = [P.sand, P.ochre, P.stone, P.rose, P.moss];
      v.cells.forEach((cell, n) => {
        const p = hx(cell.q, cell.r), pts = [0, 1, 2, 3, 4, 5].map(i => hcorner(p, i));
        const isExit = cell.q === v.exit.q && cell.r === v.exit.r;
        A.wash(c, pts, isExit ? P.ochre : tints[(cell.q * 7 + cell.r * 13 + 60) % 5], n + 1, { alpha: isExit ? 0.34 : 0.2, amp: 3 });
      });
      v.cells.forEach((cell, n) => {
        const p = hx(cell.q, cell.r);
        for (let d = 0; d < 6; d++) {
          const nb = v.cells.some(o => o.q === cell.q + [1, 1, 0, -1, -1, 0][d] && o.r === cell.r + [0, -1, -1, 0, 1, 1][d]);
          if (d >= 3 && nb) continue;
          const a = hcorner(p, (6 - d) % 6), b = hcorner(p, (7 - d) % 6), m = k => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
          if (cell.d[d]) { A.ink(c, [a, m(0.3)], n * 6 + d, { w: 4.5 }); A.ink(c, [m(0.7), b], n * 6 + d + 300, { w: 4.5 }); }
          else A.ink(c, [a, b], n * 6 + d, { w: 4.5 });
        }
      });
      const s = hx(-3, 0), e = hx(v.exit.q, v.exit.r);
      A.txt(c, 'البداية', s[0] - 95, s[1], 30, { hand: true }); A.ink(c, [[s[0] - 62, s[1]], [s[0] - 50, s[1]]], 4, { w: 2 });
      A.txt(c, 'باب الفانوس', e[0] + 150, e[1], 30, { hand: true });
      A.wrap(c, 'أيها العدّاء — عينك على غرفتك فقط. الوحوش ترى كل شيء.', 170, 150, 24, 250, { hand: true, alpha: 0.75 });
    },
    draw(c, v, S) {
      const e = hx(v.exit.q, v.exit.r), fl = 0.5 + 0.5 * Math.sin(S.t * 9);
      A.wash(c, A.circ(e[0], e[1] - 6, 20 + fl * 5), '#e2a93c', 5, { alpha: 0.35 });
      A.ink(c, [[e[0] - 8, e[1] - 16], [e[0] + 8, e[1] - 16], [e[0] + 6, e[1] + 6], [e[0] - 6, e[1] + 6]], 6, { closed: true, w: 2 });
      const slots = {};
      const at = (q, r) => { const k = q + ',' + r, n = slots[k] = (slots[k] || 0) + 1, p = hx(q, r); return [p[0] + (n - 1) * 16 - 4, p[1] + 26]; };
      v.mons.forEach((m, i) => { const p = at(m.q, m.r); A.stick(c, p[0], p[1], 0.5, { ci: S.who(m.id).ci, emo: 'angry', horns: true, pose: 'cheer', t: S.t + i }); });
      const caught = v.mons.some(m => m.q === v.runner.q && m.r === v.runner.r), p = at(v.runner.q, v.runner.r);
      A.stick(c, p[0], p[1], 0.5, { ci: S.who(S.runnerId).ci, emo: caught ? 'shock' : 'scared', pose: caught ? 'fall' : 'stand', t: S.t });
    },
  };

  // 2 ── Skipping Stones ───────────────────────────────────────────────────────────────
  const sx = i => 370 + i * 215, sy = cidx => 320 + cidx * 170;
  const stones = {
    bg(c) {
      A.wash(c, [[0, 150], [255, 150], [240, 840], [0, 840]], P.moss, 11, { alpha: 0.3, amp: 8 });
      A.wash(c, [[1350, 150], [1600, 150], [1600, 840], [1365, 840]], P.moss, 12, { alpha: 0.3, amp: 8 });
      water(c, [[250, 190], [1355, 190], [1365, 840], [240, 840]], 13);
      A.ink(c, [[252, 190], [240, 840]], 14, { w: 3 }); A.ink(c, [[1352, 190], [1365, 840]], 15, { w: 3 });
      const r = A.rng(16);
      for (let i = 0; i < 26; i++) { const x = r() < 0.5 ? 20 + r() * 200 : 1385 + r() * 190, y = 240 + r() * 580; A.ink(c, [[x, y], [x + 4 * (r() - 0.5), y - 22 - r() * 16]], 20 + i, { w: 1.8, color: P.moss, alpha: 0.8 }); }
      A.wash(c, [[250, 110], [1350, 110], [1350, 190], [250, 190]], P.sand, 17, { alpha: 0.28 });
    },
    draw(c, v, S) {
      for (let i = 0; i < 5; i++) for (let k = 0; k < 3; k++) {
        const x = sx(i), y = sy(k), seed = 40 + i * 3 + k, rev = v.rev[i][k], paper = v.paper && v.paper[i][k];
        if (rev === 1) { ripples(c, x, y, 0.3, seed); A.txt(c, 'ورق!', x, y, 24, { hand: true, color: P.brick }); continue; }
        A.wash(c, A.circ(x, y, 62, 14, 46), paper ? P.cream : P.stone, seed, { alpha: paper ? 0.5 : 0.36, amp: 5 });
        A.ink(c, A.circ(x, y, 62, 14, 46), seed, { closed: true, w: 2.8, amp: 2.5 });
        A.ink(c, [[x - 30, y - 12], [x - 12, y - 22], [x + 8, y - 20]], seed + 90, { w: 1.6, alpha: 0.5 });
        if (paper) A.txt(c, 'ورق', x, y + 4, 26, { hand: true, color: P.brick });
        else if (rev === 2) A.txt(c, '✓', x + 34, y - 26, 26, { color: P.moss });
      }
      if (v.splash) ripples(c, sx(v.splash.row), sy(v.splash.col), Math.min(1, v.splash.t / 1.2), 77);
      const others = [...new Set(v.owner.filter(Boolean))];
      others.forEach((id, i) => {
        const x = 800 + (i - (others.length - 1) / 2) * 190;
        A.stick(c, x, 176, 0.7, { ci: S.who(id).ci, emo: v.phase === 'setup' ? 'smug' : ['smug', 'happy', 'grit', 'shock'][(i + Math.floor(S.t / 3)) % 4], t: S.t + i });
        tag(c, S, id, x + 62, 150, 22);
      });
      const from = v.row === 0 ? [185, 500] : [sx(v.row - 1), sy(v.col) + 12];
      let p = from, pose = 'stand', emo = v.phase === 'setup' ? 'scared' : 'grit', dir = 'right';
      if (v.jump) { const k = v.jump.t, to = [sx(v.row), sy(v.jump.col) + 12]; p = [lerp(from[0], to[0], k), lerp(from[1], to[1], k) - 110 * Math.sin(Math.PI * k)]; pose = 'jump'; emo = 'shock'; }
      else if (v.fin) { const k = Math.min(1, v.fin.t); p = [lerp(from[0], 1440, k), lerp(from[1], 500, k) - 110 * Math.sin(Math.PI * k)]; pose = 'jump'; emo = 'happy'; }
      else if (v.splash) { emo = 'dizzy'; }
      if (S.over) { if (S.over.win) { p = [1440, 500]; pose = 'cheer'; emo = 'happy'; dir = 'front'; } else emo = 'sad'; }
      A.stick(c, p[0], p[1], 0.95, { ci: S.who(S.runnerId).ci, emo, pose, dir, t: S.t });
      A.txt(c, 'الغطسات المتبقية: ' + '● '.repeat(Math.max(0, v.lives)), 130, 880, 26, { hand: true, align: 'left' });
      if (v.phase === 'setup') A.txt(c, 'المخرّبون يبدّلون الأحجار بالورق…', 800, 862, 34, { hand: true });
    },
  };

  // 3 ── Bridge Ball ───────────────────────────────────────────────────────────────────
  const BA = [230, 730], BB = [1370, 270], bp = p => [lerp(BA[0], BB[0], p), lerp(BA[1], BB[1], p)], CAN = { '-1': [330, 838], 1: [1270, 838] };
  const bridge = {
    bg(c) {
      A.wash(c, [[0, 900], [0, 700], [120, 690], [240, 730], [300, 900]], P.umber, 21, { alpha: 0.3, amp: 8 });
      A.wash(c, [[1600, 900], [1600, 230], [1480, 240], [1370, 270], [1330, 520], [1250, 900]], P.umber, 22, { alpha: 0.3, amp: 8 });
      A.wash(c, [[300, 900], [330, 640], [700, 560], [1100, 600], [1330, 520], [1250, 900]], P.slate, 23, { alpha: 0.14, amp: 20 });
      A.ink(c, [[0, 700], [120, 690], [240, 730], [300, 900]], 24, { w: 3 }); A.ink(c, [[1600, 230], [1480, 240], [1370, 270], [1330, 520], [1250, 900]], 25, { w: 3 });
      for (const off of [0, -78]) A.ink(c, Array.from({ length: 9 }, (_, i) => { const p = bp(i / 8); return [p[0], p[1] + off + Math.sin((i / 8) * Math.PI) * 46]; }), 26 + off, { w: off ? 2.4 : 4, color: P.umber });
      for (let i = 0; i <= 30; i++) { const k = i / 30, p = bp(k), s = Math.sin(k * Math.PI) * 46; A.ink(c, [[p[0] - 12, p[1] + s + 5], [p[0] + 12, p[1] + s - 5]], 200 + i, { w: 4, color: P.umber }); if (i % 2 === 0) A.ink(c, [[p[0], p[1] + s], [p[0], p[1] + s - 78]], 240 + i, { w: 1.4, alpha: 0.6 }); }
      for (const k of [-1, 1]) { const [x, y] = CAN[k]; A.wash(c, [[x - 46 * k, y + 16], [x + 44 * k, y - 34], [x + 56 * k, y - 12], [x - 34 * k, y + 36]], P.soot, 30 + k, { alpha: 0.5, amp: 2 }); A.ink(c, [[x - 46 * k, y + 16], [x + 44 * k, y - 34], [x + 56 * k, y - 12], [x - 34 * k, y + 36]], 32 + k, { closed: true, w: 2.6 }); A.wash(c, A.circ(x - 16 * k, y + 34, 24), P.umber, 34 + k, { alpha: 0.4 }); A.ink(c, A.circ(x - 16 * k, y + 34, 24), 36 + k, { closed: true, w: 2.6 }); }
    },
    draw(c, v, S) {
      const sag = p => Math.sin(p * Math.PI) * 46, fell = fallen(S, Math.abs(v.b) >= 1);
      const p = bp(Math.min(1, v.p)), ab = Math.abs(v.b);
      A.stick(c, p[0], p[1] + sag(v.p) + fell * fell * 700, 0.95, { ci: S.who(S.runnerId).ci, dir: 'right', pose: fell ? 'fall' : S.over ? 'cheer' : 'run', emo: fell ? 'shock' : S.over ? 'happy' : ab < 0.3 ? 'grit' : ab < 0.65 ? 'scared' : 'shock', rot: v.b * 0.95 + fell * 3 * Math.sign(v.b), t: S.t });
      for (const b of v.balls) {
        const s = CAN[b.side], e = bp(b.tx), k = Math.min(1, b.t), x = lerp(s[0] + 50 * b.side, e[0], k), y = lerp(s[1] - 26, e[1] + sag(b.tx) - 50, k) - 260 * Math.sin(Math.PI * k) * 0.6;
        if (b.t < 1) { A.wash(c, A.circ(x, y, 22), P.soot, 50, { alpha: 0.6, amp: 2 }); A.ink(c, A.circ(x, y, 22), 51, { closed: true, w: 2 }); }
        else if (b.hit) A.txt(c, 'بوم!', e[0], e[1] + sag(b.tx) - 150, 40, { hand: true, bold: true, color: P.brick, rot: -0.15 });
        else A.txt(c, 'أخطأت', e[0], e[1] + sag(b.tx) - 130, 28, { hand: true, alpha: 0.6 });
      }
      Object.entries(v.side).forEach(([id, sd], i) => { const [x, y] = CAN[sd]; const ox = x - sd * (120 + Math.floor(i / 2) * 85); A.stick(c, ox, y + 50, 0.7, { ci: S.who(id).ci, emo: 'smug', dir: sd < 0 ? 'right' : 'left', t: S.t + i }); tag(c, S, id, ox, y - 36, 20); });
      A.ink(c, Array.from({ length: 13 }, (_, i) => { const a = Math.PI * (1.15 + (i / 12) * 0.7); return [800 + Math.cos(a) * 150, 250 + Math.sin(a) * 150]; }), 60, { w: 3 });
      const a = Math.PI * (1.5 + v.b * 0.35);
      A.ink(c, [[800, 250], [800 + Math.cos(a) * 140, 250 + Math.sin(a) * 140]], 61, { w: 4, color: ab > 0.65 ? P.brick : A.INK });
      A.txt(c, 'التوازن', 800, 276, 26, { hand: true });
    },
  };

  // 4 ── Knock Knock ───────────────────────────────────────────────────────────────────
  const dx = i => 260 + i * 290;
  const knock = {
    bg(c) {
      A.wash(c, [[0, 650], [1600, 650], [1600, 900], [0, 900]], P.sand, 71, { alpha: 0.3, amp: 6 });
      const r = A.rng(72); for (let i = 0; i < 30; i++) { const x = r() * 1500, y = 680 + r() * 200; A.ink(c, [[x, y], [x + 40 + r() * 50, y + 2]], 80 + i, { w: 1.3, alpha: 0.3 }); }
    },
    draw(c, v, S) {
      const w = v.wall, tint = [P.sienna, P.moss, P.slate][w % 3], a = v.anim;
      A.wash(c, A.rect(150, 190, 1300, 470), tint, 90 + w, { alpha: 0.3, amp: 6 }); A.ink(c, A.rect(150, 190, 1300, 470), 91 + w, { closed: true, w: 4 });
      for (let x = 150; x < 1450; x += 130) A.ink(c, [[x, 192], [x + 4, 656]], 100 + x + w, { w: 1.2, alpha: 0.35 });
      A.txt(c, `الجدار ${w + 1} من ${v.n}`, 800, 232, 34, { hand: true, bold: true });
      for (let i = 0; i < 4; i++) {
        const x = dx(i), torn = a && a.res === 'ok' && a.door === i, paper = v.open && v.open[w] === i;
        if (torn) { A.wash(c, A.rect(x + 12, 312, 186, 336), P.soot, 110 + i, { alpha: 0.55, amp: 9 }); for (let k = 0; k < 7; k++) A.ink(c, [[x + 10 + k * 30, 300 + (k % 2) * 330], [x + 30 + k * 26, 340 + (k % 2) * 250]], 120 + k, { w: 2 }); }
        else { A.wash(c, A.rect(x, 300, 210, 350), P.cream, 110 + i, { alpha: 0.55, amp: 3 }); A.ink(c, A.rect(x + 20, 322, 170, 140), 130 + i, { closed: true, w: 1.6, alpha: 0.6 }); A.ink(c, A.rect(x + 20, 482, 170, 146), 134 + i, { closed: true, w: 1.6, alpha: 0.6 }); A.ink(c, A.circ(x + 178, 480, 7), 138 + i, { closed: true, w: 2 }); }
        A.ink(c, A.rect(x, 300, 210, 350), 140 + i, { closed: true, w: 3.4 });
        A.txt(c, String(i + 1), x + 105, 272, 36, { bold: true });
        if (paper && !torn) A.txt(c, 'ورق', x + 105, 560, 34, { hand: true, color: P.brick });
        else if (v.open && !paper) A.txt(c, 'بلّوط', x + 105, 560, 30, { hand: true, alpha: 0.6 });
      }
      const ci = S.who(S.runnerId).ci;
      if (!a) A.stick(c, 800, 870, 1.5, { ci, dir: 'back', emo: 'grit', pose: v.phase === 'setup' ? 'stand' : 'run', t: v.phase === 'setup' ? 0 : S.t * 0.4 });
      else if (a.t < 1) { const k = a.t * a.t; A.stick(c, lerp(800, dx(a.door) + 105, k), lerp(870, 652, k), lerp(1.5, 1, k), { ci, dir: 'back', pose: 'run', t: S.t }); }
      else if (a.res === 'no') { const x = dx(a.door) + 105; A.txt(c, 'طاخ!', x, 420, 70, { hand: true, bold: true, color: P.brick, rot: -0.12 }); A.stick(c, x - 50, 760, 1.2, { ci, emo: 'dizzy', pose: 'fall', rot: Math.PI / 2, t: S.t }); for (let k = 0; k < 3; k++) A.txt(c, '✶', x + Math.cos(S.t * 4 + k * 2.1) * 60, 690 + Math.sin(S.t * 4 + k * 2.1) * 18, 30); }
      else A.txt(c, 'تمزّق!', dx(a.door) + 105, 250, 60, { hand: true, bold: true, color: P.moss, rot: 0.08 });
      v.hist.forEach((ok, i) => A.txt(c, ok ? '✓' : '✗', 1340 + i * 40, 232, 34, { color: ok ? P.moss : P.brick }));
      if (v.phase === 'setup') A.txt(c, 'النجّارون يعملون — تُسمَّر ثلاثة أبواب في كل جدار…', 800, 870, 32, { hand: true });
    },
  };

  // 5 ── Avalanche ─────────────────────────────────────────────────────────────────────
  const VA = [170, 790], VB = [1430, 230], vp = p => [lerp(VA[0], VB[0], p), lerp(VA[1], VB[1], p)], VN = [-0.406, -0.914];
  const avalanche = {
    bg(c, v) {
      A.wash(c, [[0, 900], [0, 800], VA, VB, [1600, 200], [1600, 900]], P.stone, 151, { alpha: 0.3, amp: 8 });
      A.wash(c, [[0, 900], [0, 830], [500, 700], [1100, 480], [1600, 330], [1600, 900]], P.umber, 152, { alpha: 0.15, amp: 14 });
      A.wash(c, [[700, 200], [960, 60], [1130, 150], [1260, 90], [1430, 230]], P.slate, 153, { alpha: 0.16, amp: 10 });
      A.ink(c, [[0, 800], VA, VB, [1600, 200]], 154, { w: 4 });
      const r = A.rng(155); for (let i = 0; i < 40; i++) { const k = r(), p = vp(k), d = 30 + r() * 300; A.ink(c, [[p[0] + d * 0.3, p[1] + d], [p[0] + d * 0.3 + 26, p[1] + d - 10]], 160 + i, { w: 1.4, alpha: 0.35 }); }
      v.gaps.forEach((g, i) => { const p = vp(g); A.wash(c, [[p[0] - 40, p[1] + 14], [p[0] - 34, p[1] - 66], [p[0] + 34, p[1] - 92], [p[0] + 44, p[1] - 20]], P.soot, 170 + i, { alpha: 0.38, amp: 4 }); A.ink(c, [[p[0] - 40, p[1] + 14], [p[0] - 36, p[1] - 66], [p[0] + 34, p[1] - 94], [p[0] + 44, p[1] - 20]], 180 + i, { w: 3 }); A.ink(c, [[p[0] - 48, p[1] - 62], [p[0] + 44, p[1] - 102]], 190 + i, { w: 5, color: P.umber }); });
    },
    draw(c, v, S) {
      const ci = S.who(S.runnerId).ci, crushed = S.over && !S.over.win && v.boul.some(b => Math.abs(b.p - v.p) < 0.06);
      const p = vp(Math.min(1, v.p));
      if (crushed) { A.stick(c, p[0], p[1] - 4, 0.9, { ci, emo: 'dizzy', pose: 'fall', rot: Math.PI / 2, t: S.t }); A.txt(c, 'انسحق!', p[0], p[1] - 120, 50, { hand: true, bold: true, color: P.brick }); }
      else if (v.hid) A.stick(c, p[0], p[1] - 8, 0.75, { ci, emo: 'scared', pose: 'crouch', t: S.t, alpha: 0.85 });
      else A.stick(c, p[0], p[1], 0.9, { ci, dir: 'right', emo: S.over && S.over.win ? 'happy' : v.boul.some(b => b.p > v.p && b.p - v.p < 0.3) ? 'shock' : 'grit', pose: S.over && S.over.win ? 'cheer' : v.run ? 'run' : 'stand', rot: -0.12, t: S.t });
      v.boul.forEach((b, i) => {
        const q = vp(b.p), x = q[0] + VN[0] * 46, y = q[1] + VN[1] * 46;
        A.wash(c, A.circ(x, y, 46, 12), P.stone, 210 + i, { alpha: 0.5, amp: 5 }); A.ink(c, A.circ(x, y, 46, 12), 211 + i, { closed: true, w: 3.2, amp: 3 });
        for (let k = 0; k < 3; k++) { const a = b.rot + k * 2.1; A.ink(c, [[x + Math.cos(a) * 10, y + Math.sin(a) * 10], [x + Math.cos(a + 0.4) * 34, y + Math.sin(a + 0.4) * 34]], 220 + k, { w: 1.8, alpha: 0.6 }); }
      });
      const others = S.others;
      others.forEach((id, i) => { const x = 1456 + i * 31, y = 226 - (x - 1430) * 0.176; A.stick(c, x, y, 0.5, { ci: S.who(id).ci, emo: 'smug', pose: 'cheer', t: S.t + i }); });
    },
  };

  // 6 ── High Rollers ──────────────────────────────────────────────────────────────────
  const rcx = i => 430 + i * 185, RY = 560, RR = 78;
  const rpos = (on, x) => (on < 0 ? [270 + x * 20, 482] : on > 4 ? [1330, 482] : [rcx(on) + x * 70, RY - Math.sqrt(Math.max(0, RR * RR - x * x * 4900))]);
  const rollers = {
    bg(c) {
      water(c, [[0, 720], [1600, 720], [1600, 900], [0, 900]], 231);
      for (const [x0, x1] of [[0, 330], [1270, 1600]]) { A.wash(c, [[x0, 482], [x1, 482], [x1, 760], [x0, 760]], P.umber, 232 + x0, { alpha: 0.32, amp: 5 }); A.ink(c, [[x0, 482], [x1, 482]], 234 + x0, { w: 4 }); A.ink(c, x0 ? [[x0, 482], [x0, 760]] : [[x1, 482], [x1, 760]], 236 + x0, { w: 3 }); for (let y = 520; y < 760; y += 44) A.ink(c, [[x0 + 6, y], [x1 - 6, y + 3]], 240 + y + x0, { w: 1.3, alpha: 0.4 }); }
      for (let i = 0; i < 5; i++) { A.ink(c, [[rcx(i) - 30, 730], [rcx(i), RY], [rcx(i) + 30, 730]], 250 + i, { w: 4, color: P.umber }); }
    },
    draw(c, v, S) {
      for (let i = 0; i < 5; i++) {
        const x = rcx(i);
        A.wash(c, A.circ(x, RY, RR, 18), [P.ochre, P.sienna, P.moss, P.rose, P.slate][i], 260 + i, { alpha: 0.36, amp: 3 }); A.ink(c, A.circ(x, RY, RR, 18), 261 + i, { closed: true, w: 3.4 });
        for (let k = 0; k < 4; k++) { const a = v.rot[i] + (k * Math.PI) / 4; A.ink(c, [[x - Math.cos(a) * RR, RY - Math.sin(a) * RR], [x + Math.cos(a) * RR, RY + Math.sin(a) * RR]], 270 + k, { w: 1.8, alpha: 0.55 }); }
        A.wash(c, A.circ(x, RY, 12), P.soot, 280 + i, { alpha: 0.6, amp: 1 });
        A.txt(c, (v.om[i] > 0 ? '↻' : '↺') + (Math.abs(v.om[i]) > 1.9 ? '!!' : Math.abs(v.om[i]) > 1.3 ? '!' : ''), x, 690, 40, { color: Math.abs(v.om[i]) > 1.9 ? P.brick : A.INK });
        A.txt(c, String(i + 1), x, 760, 28, { hand: true, color: P.cream, alpha: 1 });
      }
      const ci = S.who(S.runnerId).ci, lost = S.over && !S.over.win, fell = fallen(S, lost && v.on >= 0 && Math.abs(v.x) > 1);
      let p = rpos(v.on, v.x), pose = v.mv ? 'run' : 'stand', emo = Math.abs(v.x) > 0.6 ? 'shock' : 'grit', rot = v.x * 0.5 * (v.on >= 0 && v.on < 5 ? 1 : 0);
      if (v.air) { const a = rpos(v.air.on, v.air.x), b = rpos(v.air.on + 1, v.air.on < 0 ? -0.3 : v.air.x * 0.5), k = v.air.t; p = [lerp(a[0], b[0], k), lerp(a[1], b[1], k) - 90 * Math.sin(Math.PI * k)]; pose = 'jump'; emo = 'scared'; rot = 0; }
      if (S.over && S.over.win) { pose = 'cheer'; emo = 'happy'; }
      if (fell) { p = [p[0] + Math.sign(v.x) * fell * 60, p[1] + fell * fell * 500]; pose = 'fall'; rot = fell * 4 * Math.sign(v.x); if (p[1] > 720) { ripples(c, p[0], 740, Math.min(1, fell - 0.6), 290); return; } }
      A.stick(c, p[0], p[1], 0.9, { ci, dir: v.mv < 0 ? 'left' : 'right', pose, emo, rot, t: S.t });
    },
  };

  // 7 ── Dragon Lake ───────────────────────────────────────────────────────────────────
  const dragon = {
    bg(c, v) {
      water(c, [[380, 770], [1600, 770], [1600, 900], [380, 900]], 301);
      A.wash(c, [[0, 372], [440, 372], [420, 560], [450, 900], [0, 900]], P.umber, 302, { alpha: 0.32, amp: 7 }); A.ink(c, [[0, 372], [440, 372], [420, 560], [450, 900]], 303, { w: 3.6 });
      A.wash(c, [[0, 372], [440, 372], [436, 350], [0, 350]], P.moss, 304, { alpha: 0.4, amp: 4 });
      A.ink(c, [[150, 372], [170, 190], [230, 60], [520, 44], [800, 80]], 305, { w: 9, color: P.umber, amp: 3 }); A.ink(c, [[170, 190], [150, 110], [90, 70]], 306, { w: 5, color: P.umber });
      const r = A.rng(307); for (let i = 0; i < 14; i++) { const x = 60 + r() * 520, y = 30 + r() * 70; A.wash(c, A.circ(x, y, 26 + r() * 26, 10, 16 + r() * 10), P.moss, 310 + i, { alpha: 0.24, amp: 5, layers: 2 }); }
      // the dragon, mostly submerged
      for (let i = 0; i < 3; i++) { const x = 700 + i * 110; A.wash(c, [[x - 50, 780], [x - 30, 742 - i * 6], [x + 20, 736 - i * 6], [x + 50, 780]], P.teal, 320 + i, { alpha: 0.4, amp: 4 }); A.ink(c, [[x - 50, 780], [x - 30, 742 - i * 6], [x + 20, 736 - i * 6], [x + 50, 780]], 323 + i, { w: 2.6 }); }
      A.wash(c, [[1010, 780], [1004, 700], [1040, 668], [1090, 690], [1118, 724], [1070, 734], [1060, 780]], P.teal, 327, { alpha: 0.45, amp: 3 }); A.ink(c, [[1010, 780], [1004, 700], [1040, 668], [1090, 690], [1118, 724], [1070, 734], [1060, 780]], 328, { w: 2.8 });
      A.ink(c, A.circ(1056, 696, 5), 329, { closed: true, w: 2 }); A.ink(c, [[1112, 718], [1150, 700], [1168, 716]], 330, { w: 1.6 }); A.ink(c, [[1028, 672], [1014, 646]], 331, { w: 2 }); A.ink(c, [[1046, 668], [1044, 640]], 332, { w: 2 });
      A.wash(c, A.circ(v.pad.x, 778, v.pad.r, 16, 20), P.moss, 333, { alpha: 0.55, amp: 3 }); A.ink(c, A.circ(v.pad.x, 778, v.pad.r, 16, 20), 334, { closed: true, w: 3 }); A.ink(c, [[v.pad.x, 778], [v.pad.x + v.pad.r - 6, 770]], 335, { w: 2 });
      A.txt(c, 'اهبط هنا', v.pad.x, 835, 28, { hand: true });
    },
    draw(c, v, S) {
      const ci = S.who(S.runnerId).ci, onRope = v.phase === 'ready' || v.phase === 'swing';
      const rx = onRope ? v.x : 800 + 420 * Math.sin(Math.sin(S.t * 2) * 0.25), ry = onRope ? v.y : 80 + 420 * Math.cos(Math.sin(S.t * 2) * 0.25);
      A.ink(c, [[800, 80], [(800 + rx) / 2 + 4, (80 + ry) / 2], [rx, ry]], 340, { w: 3.4, color: P.umber });
      if (onRope) A.stick(c, v.x + 100.8 * Math.sin(v.th), v.y + 100.8 * Math.cos(v.th), 0.9, { ci, pose: 'hang', emo: v.phase === 'ready' ? 'scared' : 'grit', dir: 'right', rot: -v.th, t: S.t });
      else if (v.phase === 'fly') A.stick(c, v.x, v.y + 100, 0.9, { ci, pose: 'fall', emo: 'shock', dir: 'right', rot: Math.sin(S.t * 6) * 0.3, t: S.t });
      else if (v.ok) A.stick(c, v.x, 776, 0.9, { ci, pose: 'cheer', emo: 'happy', t: S.t });
      else { ripples(c, v.x, 782, Math.min(1, (S.pt % 1.6) / 1.6), 345); A.txt(c, 'طَشّ', v.x, 700, 40, { hand: true, bold: true, color: P.slate }); }
      v.gusts.forEach((d, i) => { for (let k = 0; k < 4; k++) { const y = v.y - 30 + k * 44 + i * 12, x = v.x - d * (150 - ((S.t * 300 + k * 40) % 120)); A.ink(c, [[x, y], [x + d * 50, y - 8], [x + d * 90, y + 4], [x + d * 76, y + 18], [x + d * 62, y + 8]], 350 + k + i * 9, { w: 2.2, color: P.slate, alpha: 0.75 }); } });
      S.others.forEach((id, i) => { const x = 60 + (i % 3) * 70, y = 372 - Math.floor(i / 3) * 4; A.stick(c, x, y, 0.6, { ci: S.who(id).ci, emo: 'smug', dir: 'right', pose: v.gusts.length ? 'cheer' : 'stand', t: S.t + i }); });
      if (v.phase === 'ready') A.txt(c, 'متى تجرّأت…', 430, 250, 34, { hand: true });
    },
  };

  // 8 ── Mushroom Trip ─────────────────────────────────────────────────────────────────
  const MC = [800, 480];
  const mushroom = {
    bg(c, v) {
      water(c, A.rect(30, 80, 1540, 800), 361);
      const r = A.rng(362); for (let i = 0; i < 16; i++) { const x = 60 + r() * 1480, y = 110 + r() * 740; if (Math.hypot(x - MC[0], y - MC[1]) < 430) continue; A.wash(c, A.circ(x, y, 26 + r() * 20, 10, 16), P.moss, 363 + i, { alpha: 0.4, amp: 3 }); }
      v.plats.forEach((p, i) => { const x = MC[0] + p.x, y = MC[1] + p.y; A.wash(c, A.circ(x, y, p.r, 14), P.sand, 380 + i, { alpha: 0.6, amp: 3 }); A.ink(c, A.circ(x, y, p.r, 14), 382 + i, { closed: true, w: 3.4 }); for (let k = -2; k <= 2; k++) A.ink(c, [[x - Math.sqrt(p.r * p.r - k * k * 400), y + k * 20], [x + Math.sqrt(p.r * p.r - k * k * 400), y + k * 20]], 384 + k + i * 7, { w: 1.4, alpha: 0.5 }); });
    },
    draw(c, v, S) {
      const [cx, cy] = MC;
      A.wash(c, A.circ(cx, cy, 176, 20), P.brick, 391, { alpha: 0.34, amp: 4 }); A.ink(c, A.circ(cx, cy, 176, 20), 392, { closed: true, w: 4 });
      for (let i = 0; i < 7; i++) { const a = v.ang + i * 0.9, d = i === 0 ? 0 : 70 + (i % 3) * 32; A.wash(c, A.circ(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 20 + (i % 3) * 7, 10), P.cream, 393 + i, { alpha: 0.5, amp: 2, layers: 2 }); }
      for (let i = 0; i < 3; i++) { const a = v.ang * 1.0 + i * 2.09; A.ink(c, [[cx + Math.cos(a) * 196, cy + Math.sin(a) * 196], [cx + Math.cos(a + 0.5) * 214, cy + Math.sin(a + 0.5) * 214], [cx + Math.cos(a + 1) * 200, cy + Math.sin(a + 1) * 200]], 400 + i, { w: 2, alpha: 0.5 }); }
      v.ps.forEach((p, i) => {
        const x = cx + p.x, y = cy + p.y, ci = S.who(p.id).ci;
        if (p.st === 'cling') A.stick(c, x + Math.cos(p.a) * 22, y + Math.sin(p.a) * 22, 0.62, { ci, emo: 'dizzy', pose: 'cling', rot: p.a - Math.PI / 2, t: S.t + i });
        else if (p.st === 'fly') A.stick(c, x, y, 0.62, { ci, emo: 'shock', pose: 'fall', rot: p.a - Math.PI / 2 + p.ft * 7, t: S.t });
        else if (p.st === 'safe') A.stick(c, x, y + 24, 0.62, { ci, emo: 'happy', pose: 'cheer', t: S.t + i });
        else ripples(c, x, y, (S.t * 0.6 + i * 0.3) % 1, 410 + i);
        const lx = p.st === 'cling' ? cx + Math.cos(p.a) * 232 : x, ly = p.st === 'cling' ? cy + Math.sin(p.a) * 232 : y + 44;
        tag(c, S, p.id, lx, ly, 22);
      });
    },
  };

  // 9 ── Show of Hands ─────────────────────────────────────────────────────────────────
  const cardX = i => 135 + i * 230;
  const hands = {
    bg(c) {
      A.wash(c, [[0, 430], [1600, 430], [1600, 900], [0, 900]], P.sand, 421, { alpha: 0.26, amp: 8 });
      A.wash(c, A.rect(330, 96, 940, 250), P.soot, 422, { alpha: 0.42, amp: 4 }); A.ink(c, A.rect(330, 96, 940, 250), 423, { closed: true, w: 5, color: P.umber });
      A.ink(c, [[420, 346], [380, 430]], 424, { w: 5, color: P.umber }); A.ink(c, [[1180, 346], [1220, 430]], 425, { w: 5, color: P.umber });
    },
    draw(c, v, S) {
      A.txt(c, v.text, 800, 205, v.text.length > 16 ? 76 : 96, { color: P.cream, alpha: 1, max: 880 });
      A.txt(c, `${v.sub}   ·   الجولة ${v.round} من ${v.rounds}`, 800, 306, 30, { hand: true, color: P.cream, alpha: 0.9 });
      for (let i = 0; i < 6; i++) {
        const x = cardX(i), right = v.answer === i;
        A.wash(c, A.rect(x, 470, 180, 240), right ? P.ochre : P.cream, 430 + i, { alpha: right ? 0.6 : 0.7, amp: 3 }); A.ink(c, A.rect(x, 470, 180, 240), 436 + i, { closed: true, w: 3.4 }); A.ink(c, A.rect(x + 12, 482, 156, 216), 442 + i, { closed: true, w: 1.3, alpha: 0.5 });
        A.txt(c, v.cards[i], x + 90, 592, v.cards[i].length > 2 ? 72 : 96, { color: '♥♦'.includes(v.cards[i]) ? P.brick : A.INK });
      }
      const on = {};
      S.ids.forEach((id, n) => {
        const ci = S.who(id).ci, pk = v.picks[id];
        if (pk === undefined) { const x = 200 + n * 240; A.stick(c, x, 868, 0.85, { ci, emo: v.phase === 'ask' ? 'grit' : 'sad', pose: 'stand', dir: 'back', t: S.t + n }); tag(c, S, id, x + 76, 846, 22); return; }
        const k = on[pk] = (on[pk] || 0) + 1, x = cardX(pk) + 34 + k * 26, y = 672 + k * 32, good = v.winner === id;
        A.stick(c, x - 40, y, 0.85, { ci, emo: good ? 'happy' : 'dizzy', pose: 'dive', rot: Math.PI / 2, t: S.t + n });
        tag(c, S, id, x + 20, y + 26, 22);
        if (!good) A.txt(c, '✗', x + 70, y - 34, 40, { color: P.brick });
      });
      if (v.phase === 'reveal') A.txt(c, v.winner ? `${S.who(v.winner).name} ارتمى عليها!` : 'لم يجدها أحد!', 800, 404, 46, { hand: true, bold: true, color: v.winner ? P.moss : P.brick });
      const tally = S.ids.map(id => `${S.who(id).name} ${v.wins[id] || 0}`).join('   ');
      A.txt(c, tally, 800, 760, 26, { hand: true, alpha: 0.75 });
    },
  };

  // 10 ── Final Showdown ───────────────────────────────────────────────────────────────
  const showdown = {
    bg(c) {
      A.wash(c, A.rect(70, 100, 1460, 740), P.sand, 451, { alpha: 0.34, amp: 8 });
      A.ink(c, A.rect(70, 100, 1460, 740), 452, { closed: true, w: 5, color: P.umber, amp: 3 }); A.ink(c, A.rect(82, 112, 1436, 716), 453, { closed: true, w: 1.6, alpha: 0.5 });
      for (const [x, y] of [[70, 100], [1530, 100], [70, 840], [1530, 840]]) { A.wash(c, A.circ(x, y, 18), P.umber, 454 + x + y, { alpha: 0.6, amp: 2 }); A.ink(c, A.circ(x, y, 18), 455 + x, { closed: true, w: 3 }); }
      const r = A.rng(456); for (let i = 0; i < 40; i++) { const x = 120 + r() * 1360, y = 140 + r() * 660, a = r() * TAU; A.ink(c, [[x, y], [x + Math.cos(a) * 60, y + Math.sin(a) * 60], [x + Math.cos(a + 0.6) * 110, y + Math.sin(a + 0.6) * 110]], 460 + i, { w: 1.3, alpha: 0.16 }); }
    },
    draw(c, v, S) {
      for (const t of v.tanks) {
        const { ci, name } = S.who(t.id), col = A.PCOL[ci] || '#8a8478';
        c.save(); c.translate(t.x, t.y); c.globalAlpha = t.alive ? 1 : 0.4; c.rotate(t.a);
        c.fillStyle = P.soot; for (const [wx, wy] of [[-18, -24], [16, -24], [-18, 17], [16, 17]]) c.fillRect(wx - 7, wy, 16, 7);
        A.wash(c, A.rect(-27, -19, 54, 38), P.umber, 470 + ci, { alpha: 0.5, amp: 1.5 }); A.ink(c, A.rect(-27, -19, 54, 38), 471 + ci + Math.floor(S.t * 6), { closed: true, w: 2.6, amp: 1 });
        A.ink(c, [[14, 0], [46, 0]], 472, { w: 6, color: '#8f7a3e', amp: 0.6 }); A.ink(c, [[40, -5], [40, 5]], 473, { w: 3 });
        c.fillStyle = A.PAL.cream; c.beginPath(); c.arc(-4, 0, 12, 0, TAU); c.fill(); c.globalAlpha *= 0.6; c.fillStyle = col; c.beginPath(); c.arc(-4, 0, 12, 0, TAU); c.fill(); c.globalAlpha /= 0.6;
        c.strokeStyle = A.INK; c.lineWidth = 2.4; c.beginPath(); c.arc(-4, 0, 12, 0, TAU); c.stroke();
        c.fillStyle = A.INK; c.beginPath(); c.arc(2, -4, 1.8, 0, TAU); c.arc(2, 4, 1.8, 0, TAU); c.fill();
        c.restore();
        // paper ring: three segments, one torn away per soaking
        c.save(); c.translate(t.x, t.y); c.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const a0 = S.t * 0.5 + i * (TAU / 3) + 0.14, a1 = a0 + TAU / 3 - 0.28;
          if (i < t.hp) { c.strokeStyle = A.INK; c.lineWidth = 11; c.globalAlpha = 0.85; c.beginPath(); c.arc(0, 0, 44, a0, a1); c.stroke(); c.strokeStyle = t.inv ? '#b9c9cc' : P.cream; c.lineWidth = 7; c.globalAlpha = 1; c.beginPath(); c.arc(0, 0, 44, a0, a1); c.stroke(); }
          else { c.strokeStyle = A.INK; c.lineWidth = 1.2; c.globalAlpha = 0.3; c.setLineDash([4, 7]); c.beginPath(); c.arc(0, 0, 44, a0, a1); c.stroke(); c.setLineDash([]); }
        }
        c.restore();
        A.txt(c, t.alive ? name : name + ' — تبلّل', t.x, t.y + 66, 22, { hand: true, bold: true, alpha: t.alive ? 0.95 : 0.5 });
      }
      v.shots.forEach((s, i) => { A.wash(c, A.circ(s.x, s.y, 10, 8), P.slate, 480 + i + Math.floor(S.t * 10), { alpha: 0.5, amp: 2 }); });
      v.fx.forEach((f, i) => { const k = f.t / 0.5; for (let j = 0; j < 7; j++) { const a = j * 0.9 + i; A.wash(c, A.circ(f.x + Math.cos(a) * k * 46, f.y + Math.sin(a) * k * 46, 7 * (1 - k) + 2, 6), P.slate, 490 + j, { alpha: 0.5 * (1 - k), amp: 1, layers: 2 }); } });
    },
  };

  // 11 ── Tug of War ──────────────────────────────────────────────────────────────────
  const tug = {
    bg(c) {
      A.wash(c, [[0, 600], [730, 600], [745, 900], [0, 900]], P.moss, 501, { alpha: 0.3, amp: 7 });
      A.wash(c, [[870, 600], [1600, 600], [1600, 900], [855, 900]], P.moss, 502, { alpha: 0.3, amp: 7 });
      A.wash(c, [[730, 612], [870, 612], [880, 900], [720, 900]], P.umber, 503, { alpha: 0.5, amp: 6 });
      A.ink(c, [[0, 600], [730, 600], [735, 640]], 504, { w: 3.6 }); A.ink(c, [[1600, 600], [870, 600], [865, 640]], 505, { w: 3.6 });
      for (let i = 0; i < 5; i++) A.ink(c, [[742 + i * 24, 640 + (i % 2) * 14], [760 + i * 24, 634 + (i % 2) * 14], [778 + i * 24, 642 + (i % 2) * 14]], 506 + i, { w: 2, alpha: 0.6 });
      A.txt(c, 'الوحل', 800, 700, 30, { hand: true, color: P.cream, alpha: 0.9 });
      const r = A.rng(507); for (let i = 0; i < 30; i++) { const x = r() < 0.5 ? r() * 700 : 900 + r() * 700, y = 620 + r() * 260; A.ink(c, [[x, y], [x + 3, y - 16 - r() * 12]], 510 + i, { w: 1.6, color: P.moss, alpha: 0.8 }); }
      A.ink(c, [[800, 600], [800, 380]], 540, { w: 3, color: P.umber, alpha: 0.5 });
    },
    draw(c, v, S) {
      const done = v.winner !== undefined && v.winner >= 0, drag = done ? Math.min(1, S.pt * 1.5) * 150 * (v.winner ? 1 : -1) : 0;
      const off = v.pos * 260 + drag, pulling = v.phase === 'pull' && !done, y = 600;
      const xs = [v.teams[0].map((_, i) => 800 - 330 - i * 95 + off), v.teams[1].map((_, i) => 800 + 330 + i * 95 + off)];
      const x0 = Math.min(...xs[0]) - 50, x1 = Math.max(...xs[1]) + 50, wob = pulling ? Math.sin(S.t * 30) * 2 : 0;
      A.ink(c, [[x0, y - 52 + wob], [800 + off, y - 46 - wob], [x1, y - 52 + wob]], 541 + Math.floor(S.t * 8), { w: 6, color: P.umber, amp: 1.2 });
      A.wash(c, [[800 + off, y - 46], [800 + off - 26, y - 20], [800 + off + 26, y - 20]], P.brick, 542, { alpha: 0.7, amp: 1.5 });
      [0, 1].forEach(side => v.teams[side].forEach((id, i) => {
        const x = xs[side][i], lost = done && v.winner !== side, inMud = lost && x > 715 && x < 885, ci = S.who(id).ci;
        if (inMud) { ripples(c, x, 650, (S.t * 0.7 + i * 0.3) % 1, 550 + i); A.stick(c, x, 690, 0.95, { ci, emo: 'dizzy', pose: 'fall', rot: side ? -1.2 : 1.2, t: S.t + i }); }
        else A.stick(c, x, y, 0.95, { ci, dir: side ? 'left' : 'right', emo: lost ? 'shock' : done ? 'happy' : pulling ? 'grit' : 'smug', pose: done && !lost ? 'cheer' : pulling ? 'run' : 'stand', rot: done ? 0 : side ? 0.32 : -0.32, t: S.t * (pulling ? 1.6 : 1) + i });
        tag(c, S, id, x, y + 34, 24);
      }));
      A.txt(c, 'الفريق الأيسر', 250, 190, 36, { bold: true }); A.txt(c, 'الفريق الأيمن', 1350, 190, 36, { bold: true });
      if (v.phase === 'ready') A.txt(c, `استعدّوا… ${Math.ceil(v.t)}`, 800, 300, 80, { bold: true });
      else if (!done) A.txt(c, 'اسحبوا!', 800, 300, 80 + Math.sin(S.t * 12) * 6, { bold: true, color: P.brick });
    },
  };

  // 12 ── Sumo Rings ──────────────────────────────────────────────────────────────────
  const sumo = {
    bg(c) {
      A.wash(c, [[0, 760], [1600, 760], [1600, 900], [0, 900]], P.umber, 561, { alpha: 0.22, amp: 8 });
      A.wash(c, [[400, 640], [1200, 640], [1290, 770], [310, 770]], P.sand, 562, { alpha: 0.5, amp: 5 }); A.ink(c, [[400, 640], [1200, 640], [1290, 770], [310, 770]], 563, { closed: true, w: 3.6 });
      A.ink(c, A.circ(800, 642, 372, 26, 22), 564, { closed: true, w: 7, color: P.ochre, amp: 2 }); A.ink(c, A.circ(800, 642, 372, 26, 22), 565, { closed: true, w: 1.8 });
      A.ink(c, [[770, 648], [770, 658]], 566, { w: 4 }); A.ink(c, [[830, 648], [830, 658]], 567, { w: 4 });
      A.wash(c, [[250, 96], [1350, 96], [1300, 150], [300, 150]], P.plum, 568, { alpha: 0.4, amp: 5 }); A.ink(c, [[250, 96], [1350, 96], [1300, 150], [300, 150]], 569, { closed: true, w: 3 });
      for (let i = 0; i < 4; i++) A.ink(c, [[420 + i * 250, 150], [420 + i * 250, 185]], 570 + i, { w: 3, color: P.brick });
    },
    draw(c, v, S) {
      const A1 = S.who(v.a), B1 = S.who(v.b), end = v.phase === 'end', k = end ? Math.min(1, (3 - v.t) * 1.4) : 0;
      const cx = 800 + v.pos * 310, y = 638, fight = v.phase === 'fight', aLost = end && v.winner !== v.a, bLost = end && v.winner !== v.b;
      const one = (who, x, side, lost, edge) => {
        if (lost) A.stick(c, x + side * k * 190, y + k * k * 150, 1.5, { ci: who.ci, emo: 'shock', pose: 'fall', rot: side * k * 2.2, t: S.t });
        else A.stick(c, x, y, 1.5, { ci: who.ci, dir: side < 0 ? 'right' : 'left', emo: end ? 'happy' : edge ? 'scared' : 'grit', pose: end ? 'cheer' : fight ? 'run' : 'stand', rot: end ? 0 : -side * 0.16, t: S.t * (fight ? 1.5 : 1) });
      };
      one(A1, cx - 62, -1, aLost, v.pos < -0.6); one(B1, cx + 62, 1, bLost, v.pos > 0.6);
      A.txt(c, `النزال ${v.i + 1} من ${v.n}`, 800, 124, 34, { bold: true, color: P.cream, alpha: 1 });
      A.txt(c, B1.name, 1150, 240, 54, { bold: true, color: A.PCOL[B1.ci] || A.INK }); A.txt(c, 'ضد', 800, 240, 34, { hand: true }); A.txt(c, A1.name, 450, 240, 54, { bold: true, color: A.PCOL[A1.ci] || A.INK });
      if (v.phase === 'ready') A.txt(c, `استعدّوا… ${Math.ceil(v.t)}`, 800, 340, 64, { bold: true });
      else if (fight) A.txt(c, 'ادفع!', 800, 340, 70 + Math.sin(S.t * 12) * 5, { bold: true, color: P.brick });
      else A.txt(c, `${S.who(v.winner).name} يفوز بالنزال!`, 800, 340, 60, { bold: true, color: P.moss });
      const crowd = S.ids.filter(id => id !== v.a && id !== v.b);
      crowd.forEach((id, i) => { const x = 800 + (i - (crowd.length - 1) / 2) * 150; A.stick(c, x, 890, 0.8, { ci: S.who(id).ci, dir: 'back', pose: fight || end ? 'cheer' : 'stand', t: S.t + i }); });
    },
  };

  // 13 ── Skittles ────────────────────────────────────────────────────────────────────
  const skittles = {
    bg(c) {
      A.wash(c, A.rect(470, 110, 660, 740), P.sand, 581, { alpha: 0.45, amp: 5 }); A.ink(c, A.rect(470, 110, 660, 740), 582, { closed: true, w: 3.6 });
      for (let x = 536; x < 1130; x += 66) A.ink(c, [[x, 114], [x + 2, 846]], 583 + x, { w: 1.2, alpha: 0.35 });
      A.wash(c, A.rect(432, 110, 38, 740), P.soot, 590, { alpha: 0.45, amp: 3 }); A.wash(c, A.rect(1130, 110, 38, 740), P.soot, 591, { alpha: 0.45, amp: 3 });
      A.ink(c, [[470, 790], [1130, 790]], 592, { w: 3, color: P.brick });
      for (let i = 0; i < 7; i++) A.ink(c, [[560 + i * 80, 700], [560 + i * 80, 730]], 593 + i, { w: 3, alpha: 0.4 });
    },
    draw(c, v, S) {
      const down = v.pins.filter(p => !p.up).length;
      v.pins.forEach((p, i) => {
        const x = 800 + p.x * 300, y = 250, ci = S.who(p.id).ci;
        if (p.up) {
          A.wash(c, A.circ(x, y - 52, 30, 14, 62), P.cream, 600 + i, { alpha: 0.75, amp: 2 }); A.ink(c, A.circ(x, y - 52, 30, 14, 62), 610 + i + Math.floor(S.t * 6), { closed: true, w: 2.6, amp: 1.2 });
          A.ink(c, [[x - 22, y - 88], [x + 22, y - 88]], 620 + i, { w: 4, color: P.brick });
          A.stick(c, x, y, 0.8, { ci, emo: v.phase === 'roll' && Math.abs(p.x - v.ball.x) < 0.45 ? 'shock' : 'scared', pose: 'cling', t: S.t + i });
        } else A.stick(c, x, y + 10, 0.8, { ci, emo: 'dizzy', pose: 'fall', rot: Math.PI / 2, t: S.t + i, alpha: 0.75 });
        tag(c, S, p.id, x, y + 36, 22);
      });
      const bx = 800 + v.ball.x * 300, by = 780 - v.ball.y * 600;
      if (v.ball.y < 1.1) {
        A.wash(c, A.circ(bx, by, 75, 18), P.soot, 630, { alpha: 0.62, amp: 3 }); A.ink(c, A.circ(bx, by, 75, 18), 631 + Math.floor(S.t * 6), { closed: true, w: 3.6, amp: 1.5 });
        for (let k = 0; k < 3; k++) { const a = v.ball.y * 14 + k * 0.7; A.wash(c, A.circ(bx + Math.cos(a) * 34, by + Math.sin(a) * 34, 9, 8), P.cream, 632 + k, { alpha: 0.7, amp: 1 }); }
      }
      A.stick(c, v.phase === 'aim' ? bx : 800, 892, 1.1, { ci: S.who(S.runnerId).ci, dir: 'back', pose: v.phase === 'aim' ? 'stand' : 'cheer', emo: 'grit', t: S.t });
      A.txt(c, 'الكرات: ' + '● '.repeat(v.balls), 60, 200, 30, { hand: true, align: 'left' });
      A.txt(c, `المطلوب إسقاط ${v.need} · سقط ${down}`, 60, 250, 30, { hand: true, align: 'left' });
      if (v.strike && v.phase !== 'aim') A.txt(c, v.pins.every(p => !p.up) ? 'ضربة كاملة!' : `طاخ! سقط ${v.strike}`, 1370, 300, 54, { bold: true, color: P.brick, rot: 0.1 });
      else if (v.phase === 'pause') A.txt(c, 'نجَوا!', 1370, 300, 54, { bold: true, color: P.moss, rot: 0.1 });
    },
  };

  return { honeycomb, stones, bridge, knock, avalanche, rollers, dragon, mushroom, hands, showdown, tug, sumo, skittles };
})();

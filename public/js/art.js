// Shared drawing kit: vintage paper, watercolor washes, loose ink lines and the Stickman cast.
// Everything is drawn procedurally — there are no image assets.
const Art = (() => {
  const INK = '#2b2622';
  const PAL = {
    paper: '#eadfc6', cream: '#f3ead6', ink: INK, ochre: '#c59a4a', sienna: '#a65f3a', moss: '#7c8755', slate: '#6b8290',
    rose: '#b8857a', umber: '#5d4634', teal: '#5c8a80', plum: '#7b5a6c', water: '#7f9aa0', sand: '#d4bc8b', stone: '#9a8f80', brick: '#a2503c', soot: '#3a3430',
  };
  const PCOL = ['#a2503c', '#c59a4a', '#7c8755', '#6b8290', '#7b5a6c', '#5c8a80'];
  const HATCOL = ['#5d4634', '#34302c', '#7a3b34', '#b8857a', '#d9c58f', '#6f6557'];
  const TYPE = "'Cairo','Tajawal','Segoe UI','Tahoma','Arial',sans-serif";
  const HAND = "'Tajawal','Cairo','Segoe UI','Tahoma','Arial',sans-serif";
  const RTL = /[\u0600-\u06FF]/;
  const TAU = Math.PI * 2;

  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // Aged paper: warm base, foxing stains, fibres, speckle and a darkened edge.
  function paper(w, h, seed = 7) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'), r = rng(seed);
    x.fillStyle = PAL.paper; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const cx = r() * w, cy = r() * h, rad = (0.08 + r() * 0.25) * w;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, `rgba(${r() < 0.5 ? '150,110,60' : '255,248,225'},${0.03 + r() * 0.05})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
    }
    x.lineWidth = 1;
    for (let i = 0; i < (w * h) / 2600; i++) {
      const px = r() * w, py = r() * h, a = r() * TAU, l = 4 + r() * 14;
      x.strokeStyle = `rgba(${r() < 0.5 ? '120,95,60' : '255,250,235'},${0.05 + r() * 0.1})`;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
    }
    for (let i = 0; i < (w * h) / 500; i++) { x.fillStyle = `rgba(90,70,45,${r() * 0.09})`; x.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5); }
    const v = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(95,65,30,0.28)');
    x.fillStyle = v; x.fillRect(0, 0, w, h);
    return c;
  }

  const circ = (x, y, r, n = 16, ry = r) => Array.from({ length: n }, (_, i) => [x + Math.cos((i / n) * TAU) * r, y + Math.sin((i / n) * TAU) * ry]);
  const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

  function sub(pts, step, closed) { // subdivide edges so jitter reads as a wobble, not a spike
    const out = [], n = pts.length;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = pts[i], b = pts[(i + 1) % n], k = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
      for (let j = 0; j < k; j++) out.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
    }
    if (!closed) out.push(pts[n - 1]);
    return out;
  }
  const jit = (pts, amp, r) => pts.map(p => [p[0] + (r() - 0.5) * 2 * amp, p[1] + (r() - 0.5) * 2 * amp]);
  function trace(ctx, pts, closed) {
    const n = pts.length;
    ctx.beginPath();
    if (closed) {
      ctx.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
      for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
      ctx.closePath();
    } else {
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n - 1; i++) { const p = pts[i], q = pts[i + 1]; ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
      ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
    }
  }

  // Watercolor wash: a few translucent, slightly mis-registered layers plus a pigment edge.
  function wash(ctx, pts, color, seed = 1, o = {}) {
    const r = rng(seed), layers = o.layers || 3, amp = o.amp ?? 4, a = o.alpha ?? 0.3, base = sub(pts, o.step || 30, true);
    ctx.save(); ctx.fillStyle = color; ctx.strokeStyle = color;
    for (let i = 0; i < layers; i++) { ctx.globalAlpha = a; trace(ctx, jit(base, amp, r), true); ctx.fill(); }
    ctx.globalAlpha = a * 0.7; ctx.lineWidth = 1.5; trace(ctx, jit(base, amp * 0.5, r), true); ctx.stroke();
    ctx.restore();
  }
  // Ink line: drawn twice, a little off, like a quick pen.
  function ink(ctx, pts, seed = 1, o = {}) {
    const r = rng(seed), base = sub(pts, o.step || 24, o.closed), passes = o.passes || 2;
    ctx.save(); ctx.strokeStyle = o.color || INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < passes; i++) {
      ctx.globalAlpha = (o.alpha ?? 0.9) * (i ? 0.45 : 1); ctx.lineWidth = (o.w || 2.5) * (i ? 0.6 : 1);
      trace(ctx, jit(base, o.amp ?? 1.6, r), o.closed); ctx.stroke();
    }
    ctx.restore();
  }
  function txt(ctx, s, x, y, size, o = {}) {
    ctx.save();
    ctx.font = `${o.bold ? '700 ' : ''}${size}px ${o.hand ? HAND : TYPE}`;
    ctx.fillStyle = o.color || INK; ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.base || 'middle'; ctx.globalAlpha = o.alpha ?? 0.92;
    ctx.direction = RTL.test(s) ? 'rtl' : 'ltr'; // numbers and puzzles stay left-to-right
    if (o.rot) { ctx.translate(x, y); ctx.rotate(o.rot); ctx.fillText(s, 0, 0); } else ctx.fillText(s, x, y, o.max);
    ctx.restore();
  }
  function wrap(ctx, s, x, y, size, maxW, o = {}) {
    ctx.save(); ctx.font = `${size}px ${o.hand ? HAND : TYPE}`;
    const lines = []; let line = '';
    for (const w of String(s).split(' ')) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
    lines.push(line); ctx.restore();
    lines.forEach((l, i) => txt(ctx, l, x, y + i * size * 1.25, size, o));
    return lines.length;
  }

  // ---- The Stickman -------------------------------------------------------------------
  // (x, y) is the feet; the figure is ~100 units tall at scale 1.
  // o: ci (player colour/hat), emo, dir (front|left|right|back), pose, t (seconds, drives line boil), rot, horns
  function stick(ctx, x, y, s, o = {}) {
    const ci = o.ci || 0, emo = o.emo || 'happy', pose = o.pose || 'stand', t = o.t || 0, dir = o.dir || 'front';
    const r = rng((ci + 1) * 977 + Math.floor(t * 7) * 131 + 3), j = () => (r() - 0.5) * 2.4;
    const col = PCOL[ci] || '#8a8478', side = dir === 'left' || dir === 'right', back = dir === 'back';
    ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); ctx.scale(s * (dir === 'left' ? -1 : 1), s);
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    let hip = [0, -36], sh = [0, -62], hd = [0, -80], hL = [-15, -36], hR = [15, -36], fL = [-9, 0], fR = [9, 0];
    const sw = Math.sin(t * 11);
    if (pose === 'run') {
      fL = [-16 * sw, sw > 0 ? -6 : 0]; fR = [16 * sw, sw < 0 ? -6 : 0]; hL = [14 * sw, -44]; hR = [-14 * sw, -44];
      if (side) { sh = [5, -61]; hd = [9, -78]; }
    } else if (pose === 'jump') { hL = [-21, -90]; hR = [21, -90]; fL = [-13, -9]; fR = [13, -7]; }
    else if (pose === 'fall') { hL = [-23 + 4 * sw, -92]; hR = [23 - 4 * sw, -90]; fL = [-15, -2 + 4 * sw]; fR = [15, -2 - 4 * sw]; }
    else if (pose === 'hang') { hL = [-3, -112]; hR = [3, -112]; fL = [-7 + 2 * sw, 0]; fR = [7 + 2 * sw, -3]; }
    else if (pose === 'cheer') { hL = [-23, -93 + 3 * sw]; hR = [23, -93 - 3 * sw]; }
    else if (pose === 'dive') { hL = [-6, -110]; hR = [6, -110]; fL = [-6, 0]; fR = [6, 2]; }
    else if (pose === 'cling') { hL = [-27, -70]; hR = [27, -70]; fL = [-15, -2]; fR = [15, -2]; }
    else if (pose === 'crouch') { hip = [0, -20]; sh = [0, -42]; hd = [0, -58]; hL = [-12, -62]; hR = [12, -62]; fL = [-14, 0]; fR = [14, 0]; }
    else if (pose === 'point') { hR = [26, -68]; }
    ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 3.4;
    const limb = (a, b, bx, by) => {
      ctx.beginPath(); ctx.moveTo(a[0], a[1]);
      ctx.quadraticCurveTo((a[0] + b[0]) / 2 + bx + j(), (a[1] + b[1]) / 2 + by + j(), b[0] + j() * 0.5, b[1] + j() * 0.5); ctx.stroke();
    };
    limb(hip, fL, -3, -2); limb(hip, fR, 3, -2); limb(sh, hip, j(), 0);
    limb(sh, hL, -4, 3); limb(sh, hR, 4, 3);
    // neckerchief in the player's colour
    ctx.fillStyle = col; ctx.globalAlpha *= 0.85;
    ctx.beginPath(); ctx.moveTo(sh[0] - 7, sh[1] - 3); ctx.lineTo(sh[0] + 7, sh[1] - 3); ctx.lineTo(sh[0] + j(), sh[1] + 9); ctx.closePath(); ctx.fill();
    ctx.globalAlpha /= 0.85;
    // head: paper base, colour wash, ink outline
    const [hx, hy] = hd;
    ctx.fillStyle = PAL.cream; ctx.beginPath(); ctx.arc(hx, hy, 15, 0, TAU); ctx.fill();
    ctx.save(); ctx.globalAlpha *= 0.5; ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(hx + j(), hy + j(), 15.5, 14.5, 0, 0, TAU); ctx.fill(); ctx.restore();
    ctx.lineWidth = 2.8; ctx.beginPath(); ctx.ellipse(hx + j() * 0.4, hy + j() * 0.4, 15 + j() * 0.3, 15 + j() * 0.3, 0, 0, TAU); ctx.stroke();
    ctx.lineWidth = 2; ctx.fillStyle = INK;
    const line = (a, b, c, d) => { ctx.beginPath(); ctx.moveTo(hx + a, hy + b); ctx.lineTo(hx + c, hy + d); ctx.stroke(); };
    if (back) { for (let i = -2; i <= 2; i++) line(i * 4, -9 + Math.abs(i), i * 4.5 + j(), 3 + j()); }
    else {
      const fx = side ? 6 : 0, sp = side ? 3.5 : 5.5, e1 = fx - sp, e2 = fx + sp, ey = -2, by = -9;
      const eye = (ex, k) => {
        if (k === 'dot') { ctx.beginPath(); ctx.arc(hx + ex, hy + ey, 1.9, 0, TAU); ctx.fill(); }
        else if (k === 'open') { ctx.save(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx + ex, hy + ey, 3.4, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore(); ctx.beginPath(); ctx.arc(hx + ex, hy + ey + 0.5, 1.3, 0, TAU); ctx.fill(); }
        else if (k === 'x') { line(ex - 2.5, ey - 2.5, ex + 2.5, ey + 2.5); line(ex - 2.5, ey + 2.5, ex + 2.5, ey - 2.5); }
        else { line(ex - 3, ey - 1.5, ex + 3, ey - 1.5); ctx.beginPath(); ctx.arc(hx + ex, hy + ey + 0.6, 1.5, 0, TAU); ctx.fill(); }
      };
      const brows = (tl, up = 0) => { line(e1 - 3.5, by - tl - up, e1 + 3.5, by + tl - up); line(e2 - 3.5, by + tl - up, e2 + 3.5, by - tl - up); };
      const arc = (cy, a0, a1) => { ctx.beginPath(); ctx.arc(hx + fx, hy + cy, 5.5, a0 * Math.PI, a1 * Math.PI); ctx.stroke(); };
      const wavy = () => { ctx.beginPath(); ctx.moveTo(hx + fx - 6, hy + 7); for (let i = 1; i <= 4; i++) ctx.lineTo(hx + fx - 6 + i * 3, hy + 7 + (i % 2 ? -2.2 : 2.2)); ctx.stroke(); };
      if (emo === 'happy') { eye(e1, 'dot'); eye(e2, 'dot'); arc(3, 0.15, 0.85); }
      else if (emo === 'scared') { eye(e1, 'open'); eye(e2, 'open'); brows(-2, 1); wavy(); }
      else if (emo === 'angry') { eye(e1, 'dot'); eye(e2, 'dot'); brows(2.2); arc(11, 1.2, 1.8); }
      else if (emo === 'dizzy') { eye(e1, 'x'); eye(e2, 'x'); wavy(); }
      else if (emo === 'sad') { eye(e1, 'dot'); eye(e2, 'dot'); brows(-2); arc(11, 1.2, 1.8); ctx.save(); ctx.fillStyle = PAL.slate; ctx.beginPath(); ctx.ellipse(hx + e2 + 2, hy + 4, 1.6, 2.6, 0, 0, TAU); ctx.fill(); ctx.restore(); }
      else if (emo === 'smug') { eye(e1, 'lid'); eye(e2, 'lid'); ctx.beginPath(); ctx.moveTo(hx + fx - 5, hy + 7); ctx.quadraticCurveTo(hx + fx + 2, hy + 9, hx + fx + 6, hy + 4); ctx.stroke(); }
      else if (emo === 'grit') { eye(e1, 'dot'); eye(e2, 'dot'); brows(0.8, -2); line(fx - 4.5, 7, fx + 4.5, 7); }
      else { eye(e1, 'open'); eye(e2, 'open'); brows(0, 3); ctx.beginPath(); ctx.ellipse(hx + fx, hy + 8, 2.6, 3.4, 0, 0, TAU); ctx.stroke(); }
      if (side) { ctx.beginPath(); ctx.moveTo(hx + 14, hy - 1); ctx.lineTo(hx + 19, hy + 2); ctx.lineTo(hx + 14.5, hy + 4); ctx.stroke(); }
    }
    // headgear — six mid-century hats, or horns for the maze monsters
    ctx.lineWidth = 2.2; ctx.fillStyle = HATCOL[ci % 6];
    const poly = (pts, fill = true) => { ctx.beginPath(); pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](hx + p[0] + j() * 0.3, hy + p[1] + j() * 0.3)); ctx.closePath(); if (fill) { ctx.save(); ctx.globalAlpha *= 0.85; ctx.fill(); ctx.restore(); } ctx.stroke(); };
    const f = side ? 1 : 0;
    if (o.horns) { ctx.fillStyle = PAL.cream; poly([[-12, -10], [-17, -25], [-6, -14]]); poly([[12, -10], [17, -25], [6, -14]]); }
    else switch (ci % 6) {
      case 0: poly([[-15, -7], [-12, -17], [0, -21], [13, -17], [16, -8], [16 + 9 * f + 4, -5], [10, -6]]); break; // flat cap
      case 1: ctx.beginPath(); ctx.ellipse(hx, hy - 12, 12, 11, 0, Math.PI, TAU); ctx.closePath(); ctx.save(); ctx.globalAlpha *= 0.85; ctx.fill(); ctx.restore(); ctx.stroke(); line(-19, -11, 19, -11); break; // bowler
      case 2: ctx.beginPath(); ctx.ellipse(hx - 3, hy - 15, 17, 6.5, -0.2, 0, TAU); ctx.save(); ctx.globalAlpha *= 0.85; ctx.fill(); ctx.restore(); ctx.stroke(); line(-2, -21, 0, -25); break; // beret
      case 3: poly([[-15, -5], [-11, -17], [0, -20], [11, -17], [15, -5], [0, -11]]); line(15, -5, 21, 2); line(15, -5, 19, 6); break; // headscarf
      case 4: poly([[-10, -14], [-10, -24], [10, -24], [10, -14]]); line(-20, -14, 20, -14); ctx.save(); ctx.strokeStyle = PAL.brick; ctx.lineWidth = 3; line(-9, -17, 9, -17); ctx.restore(); break; // boater
      default: poly([[-11, -13], [-9, -25], [-1, -22], [8, -25], [11, -13]]); line(-20, -12, 20, -13); // fedora
    }
    ctx.restore();
  }

  return { INK, PAL, PCOL, TYPE, HAND, TAU, rng, paper, circ, rect, wash, ink, txt, wrap, stick, trace, jit, sub };
})();

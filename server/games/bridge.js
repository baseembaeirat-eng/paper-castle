// 3. Bridge Ball — tilt to balance up the bridge while cannonballs fly in.
const { rnd, clamp, r3 } = require('./util');

module.exports = {
  id: 'bridge', name: 'جسر الكرات الطائرة', kind: 'runner',
  blurb: 'جسر شديد الانحدار يتأرجح، ووابل من القذائف السوداء الطرية.',
  runnerTip: 'أمِل جهازك يميناً ويساراً لتبقى واقفاً (أو اسحب شريط التوازن). كلما ثبتّ صعدت أسرع.',
  othersTip: 'اضغط «أطلق» لترمي قذيفة على العدّاء. اختر التوقيت الذي يُسقطه.',
  create(G) {
    return { p: 0, b: 0, bv: 0, n: 0, tilt: 0, balls: [], cds: {}, side: Object.fromEntries(G.others.map((id, i) => [id, i % 2 ? 1 : -1])), bot: G.others.length ? 0 : 3, time: 60 };
  },
  input(s, pid, m, G) {
    if (pid === G.runnerId) { if (typeof m.tilt === 'number' && isFinite(m.tilt)) s.tilt = clamp(m.tilt, -1, 1); return; }
    if (m.fire && (s.cds[pid] || 0) <= 0) { s.cds[pid] = 2.5; s.balls.push({ side: s.side[pid], tx: s.p + 0.03, t: 0 }); }
  },
  tick(s, dt) {
    s.time -= dt;
    for (const k in s.cds) s.cds[k] -= dt;
    if (s.bot && (s.bot -= dt) <= 0) { s.bot = 2 + rnd() * 2; s.balls.push({ side: rnd() < 0.5 ? -1 : 1, tx: s.p + 0.03, t: 0 }); }
    // Sway builds over the first seconds and gets worse the higher the Runner climbs.
    s.age = (s.age || 0) + dt;
    const ease = Math.min(1, s.age / 4);
    s.n = clamp(s.n + (rnd() - 0.5) * 7 * dt, -0.8, 0.8);
    s.bv += ((0.7 + 1.3 * s.p) * s.b * ease + 4 * s.tilt + s.n * ease) * dt;
    s.bv *= 1 - 1.5 * dt;
    s.b += s.bv * dt;
    s.p += 0.05 * (1 - Math.min(1, Math.abs(s.b))) * dt;
    for (const ball of s.balls) {
      ball.t += dt / 0.9;
      if (ball.t >= 1 && !ball.done) { ball.done = true; if (Math.abs(ball.tx - s.p) < 0.04) { s.bv -= ball.side * 1.0; ball.hit = true; } }
    }
    s.balls = s.balls.filter(b => b.t < 1.3);
    if (Math.abs(s.b) >= 1) s.over = { win: false, text: 'فوق الحبال! العدّاء يأخذ الطريق الطويل إلى الأسفل.' };
    else if (s.p >= 1) s.over = { win: true, text: 'عبر الجسر! العدّاء يضحك على المدافع.' };
    else if (s.time <= 0) s.over = { win: false, text: 'انتهى الوقت — علق في منتصف الجسر.' };
  },
  view(s) {
    return { p: r3(s.p), b: r3(s.b), balls: s.balls.map(b => ({ side: b.side, tx: r3(b.tx), t: r3(b.t), hit: !!b.hit })), side: s.side, time: s.time };
  },
  pview(s, pid, G) {
    if (pid === G.runnerId) return { ui: 'r', b: Math.round(s.b * 20) / 20 };
    return { ui: 'o', rdy: (s.cds[pid] || 0) <= 0 };
  },
};

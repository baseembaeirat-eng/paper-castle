// 7. Dragon Lake — a rope swing, a lily pad, and friends who control the wind.
const { rnd, r3 } = require('./util');
const PX = 800, PY = 80, L = 420, GRAV = 900;

function release(s) {
  s.vx = L * s.w * Math.cos(s.th);
  s.vy = -L * s.w * Math.sin(s.th);
  s.phase = 'fly';
}

module.exports = {
  id: 'dragon', name: 'حبل طرزان', kind: 'runner',
  blurb: 'تأرجح فوق البحيرة واهبط على ورقة زنبق صغيرة. واحذر الريح.',
  runnerTip: 'اضغط مرة لتقفز عن الجرف متعلقاً بالحبل، واضغط ثانية لتُفلته — والزخم يكمل الباقي.',
  othersTip: 'انفخ هبّات ريح يميناً أو يساراً لتحرف العدّاء عن مساره في الهواء.',
  create(G) {
    return { phase: 'ready', th: -1.1, w: 0, x: PX + L * Math.sin(-1.1), y: PY + L * Math.cos(-1.1), vx: 0, vy: 0, gusts: [], cds: {}, pad: { x: Math.round(1150 + rnd() * 300), r: 75 }, time: 12, swingT: 0, bot: !G.others.length };
  },
  input(s, pid, m, G) {
    if (pid === G.runnerId) {
      if (!m.go) return;
      if (s.phase === 'ready') s.phase = 'swing';
      else if (s.phase === 'swing' && s.swingT > 0.25) release(s);
      return;
    }
    const d = m.gust > 0 ? 1 : -1;
    if ('gust' in m && s.phase !== 'ready' && (s.cds[pid] || 0) <= 0) { s.cds[pid] = 2.5; s.gusts.push({ dir: d, t: 0.5 }); }
  },
  tick(s, dt) {
    for (const k in s.cds) s.cds[k] -= dt;
    for (const g of s.gusts) g.t -= dt;
    s.gusts = s.gusts.filter(g => g.t > 0);
    const wind = s.gusts.reduce((a, g) => a + g.dir, 0);
    if (s.phase === 'ready') { s.time -= dt; if (s.time <= 0) s.phase = 'swing'; return; }
    if (s.phase === 'swing') {
      s.swingT += dt;
      s.w += (-(GRAV / L) * Math.sin(s.th) + wind * 0.5) * dt;
      s.w *= 1 - 0.02 * dt;
      s.th += s.w * dt;
      s.x = PX + L * Math.sin(s.th); s.y = PY + L * Math.cos(s.th);
      if (s.swingT > 14) release(s);
      return;
    }
    if (s.bot && rnd() < dt * 1.5 && !s.gusts.length) s.gusts.push({ dir: rnd() < 0.5 ? -1 : 1, t: 0.4 });
    s.vx += wind * 520 * dt; s.vy += GRAV * dt;
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.y >= 690) {
      s.y = 690; s.phase = 'done'; s.ok = Math.abs(s.x - s.pad.x) < s.pad.r;
      s.over = s.ok ? { win: true, text: 'هبوط مثالي على ورقة الزنبق!' } : { win: false, text: 'طَشّ! التنّين استقبل زائراً.' };
    }
  },
  view(s) {
    return { phase: s.phase, th: r3(s.th), x: r3(s.x), y: r3(s.y), pad: s.pad, gusts: s.gusts.map(g => g.dir), ok: !!s.ok, time: s.phase === 'ready' ? s.time : undefined };
  },
  pview(s, pid, G) {
    if (pid === G.runnerId) return { ui: s.phase };
    return { ui: 'o', rdy: s.phase !== 'ready' && (s.cds[pid] || 0) <= 0 };
  },
};

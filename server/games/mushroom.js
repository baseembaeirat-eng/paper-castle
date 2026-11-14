// 8. Mushroom Trip — everyone clings to the spinning cap; one press to let go.
const { rnd, r3 } = require('./util');
const R = 170, D = 330, FLY = 0.8;
const omega = T => 2.2 + 1.2 * Math.sin(T * 0.9) + T * 0.06;

function release(s, p) {
  const a = s.ang + p.off, om = omega(s.T);
  const vr = (D - R) / FLY, vt = om * R * 0.35;
  p.x0 = R * Math.cos(a); p.y0 = R * Math.sin(a);
  p.vx = Math.cos(a) * vr - Math.sin(a) * vt;
  p.vy = Math.sin(a) * vr + Math.cos(a) * vt;
  p.a = a; p.ft = 0; p.st = 'fly'; p.x = p.x0; p.y = p.y0;
}

module.exports = {
  id: 'mushroom', name: 'الفطر الدوار', kind: 'all',
  blurb: 'تشبّث بالفطر الدوّار وأفلِت في اللحظة المناسبة تماماً — وإلّا فاسبح.',
  runnerTip: 'الجميع يركبون معاً. لديك ضغطة واحدة فقط: أفلِت ليقذفك الدوران إلى طوف. ستطير إلى الخارج ومع اتجاه الدوران قليلاً.',
  create(G) {
    const n = G.ids.length, a0 = rnd() * Math.PI * 2, a1 = a0 + 1.7 + rnd() * 1.2;
    return {
      ang: 0, T: 0, time: 20, endT: 0,
      ps: G.ids.map((id, i) => ({ id, off: (Math.PI * 2 * i) / n, st: 'cling', x: 0, y: 0, a: 0 })),
      plats: [a0, a1].map(a => ({ x: Math.round(D * Math.cos(a)), y: Math.round(D * Math.sin(a)), r: 70 })),
    };
  },
  input(s, pid, m) {
    const p = s.ps.find(x => x.id === pid);
    if (p && m.go && p.st === 'cling') release(s, p);
  },
  tick(s, dt, G) {
    s.T += dt; s.time -= dt;
    s.ang += omega(s.T) * dt;
    for (const p of s.ps) {
      if (p.st === 'cling') {
        if (s.time <= 0) release(s, p);
        else { p.a = s.ang + p.off; p.x = R * Math.cos(p.a); p.y = R * Math.sin(p.a); }
      } else if (p.st === 'fly') {
        p.ft += dt / FLY;
        const k = Math.min(1, p.ft) * FLY;
        p.x = p.x0 + p.vx * k; p.y = p.y0 + p.vy * k;
        if (p.ft >= 1) p.st = s.plats.some(q => Math.hypot(q.x - p.x, q.y - p.y) < q.r) ? 'safe' : 'splash';
      }
    }
    if (s.ps.every(p => p.st === 'safe' || p.st === 'splash') && (s.endT += dt) > 1.3) {
      const safe = s.ps.filter(p => p.st === 'safe');
      const names = safe.map(p => G.players.find(x => x.id === p.id).name);
      s.over = { pts: Object.fromEntries(safe.map(p => [p.id, 2])), text: safe.length ? `جافّون ودائخون: ${names.join('، ')}!` : 'الجميع في المستنقع!' };
    }
  },
  view(s) {
    return { ang: r3(s.ang), ps: s.ps.map(p => ({ id: p.id, st: p.st, x: r3(p.x), y: r3(p.y), a: r3(p.a), ft: r3(p.ft || 0) })), plats: s.plats, time: Math.max(0, s.time) };
  },
  pview(s, pid) { return { ui: s.ps.find(p => p.id === pid).st }; },
};

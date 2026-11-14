// 10. Final Showdown — bumper carts, water squirters, and fragile paper rings.
const { rnd, clamp, r1 } = require('./util');
const X0 = 110, X1 = 1490, Y0 = 140, Y1 = 800, HP = 3;

module.exports = {
  id: 'showdown', name: 'حرب الدبابات الورقية', kind: 'all',
  blurb: 'كل عربة لنفسها. بلّلوا الحلقات الورقية، وصاحب آخر حلقة سليمة يفوز بالقلعة.',
  runnerTip: 'اسحب لوحة التوجيه لتقود وتصوّب، واضغط «رُشّ» لتطلق الماء. ثلاث رشّات تمزّق حلقتك الورقية.',
  create(G) {
    const L = (G.level || 1) - 1; // 0 on the first stage, up to 5
    // later stages: barrels in the arena that block carts and water
    const obs = [];
    for (let tries = 0; obs.length < 2 * L && tries < 200; tries++) {
      const o = { x: Math.round(250 + rnd() * 1100), y: Math.round(230 + rnd() * 480), r: 36 };
      const ring = Math.hypot((o.x - 800) / 480, (o.y - 470) / 250);
      if (ring > 0.75 && ring < 1.25) continue; // keep the starting circle clear
      if (obs.every(q => Math.hypot(q.x - o.x, q.y - o.y) > 130)) obs.push(o);
    }
    const ids = G.ids.slice();
    for (let i = 0; ids.length < 3; i++) ids.push('bot' + i);
    return {
      time: 90, shots: [], fx: [], out: [], obs,
      tanks: ids.map((id, i) => {
        const a = (Math.PI * 2 * i) / ids.length;
        return { id, bot: id.startsWith('bot'), x: 800 + 480 * Math.cos(a), y: 470 + 250 * Math.sin(a), a: a + Math.PI, vx: 0, vy: 0, jx: 0, jy: 0, fire: false, cd: 1, hp: HP, alive: true, inv: 0 };
      }),
    };
  },
  input(s, pid, m) {
    const t = s.tanks.find(x => x.id === pid);
    if (!t) return;
    if (typeof m.jx === 'number' && typeof m.jy === 'number' && isFinite(m.jx) && isFinite(m.jy)) { t.jx = clamp(m.jx, -1, 1); t.jy = clamp(m.jy, -1, 1); }
    if ('fire' in m) t.fire = !!m.fire;
  },
  tick(s, dt, G) {
    s.time -= dt;
    const live = s.tanks.filter(t => t.alive);
    for (const t of live) {
      if (t.bot) {
        const foe = live.filter(o => o !== t).sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y))[0];
        if (foe) {
          const dx = foe.x - t.x, dy = foe.y - t.y, d = Math.hypot(dx, dy) || 1;
          if (d > 260) { t.jx = dx / d; t.jy = dy / d; } else { t.jx = (dx / d) * 0.3 - (dy / d) * 0.6; t.jy = (dy / d) * 0.3 + (dx / d) * 0.6; }
          const diff = Math.atan2(Math.sin(Math.atan2(dy, dx) - t.a), Math.cos(Math.atan2(dy, dx) - t.a));
          t.fire = Math.abs(diff) < 0.3 && rnd() < 0.06;
        }
      }
      let { jx, jy } = t;
      const mag = Math.hypot(jx, jy);
      if (mag > 1) { jx /= mag; jy /= mag; }
      const k = Math.min(1, 6 * dt);
      t.vx += (jx * 250 - t.vx) * k; t.vy += (jy * 250 - t.vy) * k;
      if (mag > 0.2) { const want = Math.atan2(jy, jx); t.a += Math.atan2(Math.sin(want - t.a), Math.cos(want - t.a)) * Math.min(1, 10 * dt); }
      t.x = clamp(t.x + t.vx * dt, X0, X1); t.y = clamp(t.y + t.vy * dt, Y0, Y1);
      for (const o of s.obs) { const dx = t.x - o.x, dy = t.y - o.y, d = Math.hypot(dx, dy) || 1, min = o.r + 30; if (d < min) { t.x = o.x + (dx / d) * min; t.y = o.y + (dy / d) * min; } }
      t.cd -= dt; t.inv -= dt;
      if (t.fire && t.cd <= 0) {
        t.cd = 0.5;
        s.shots.push({ x: t.x + Math.cos(t.a) * 42, y: t.y + Math.sin(t.a) * 42, vx: Math.cos(t.a) * 620, vy: Math.sin(t.a) * 620, life: 0.9, own: t.id });
      }
    }
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) { // bumpers
      const a = live[i], b = live[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      if (d < 64) {
        const nx = dx / d, ny = dy / d, push = (64 - d) / 2;
        a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
        a.vx -= nx * 160; a.vy -= ny * 160; b.vx += nx * 160; b.vy += ny * 160;
      }
    }
    for (const sh of s.shots) {
      if (s.obs.some(o => Math.hypot(o.x - sh.x, o.y - sh.y) < o.r + 6)) { sh.life = 0; s.fx.push({ x: r1(sh.x), y: r1(sh.y), t: 0 }); }
      sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.life -= dt;
      if (sh.x < X0 - 40 || sh.x > X1 + 40 || sh.y < Y0 - 40 || sh.y > Y1 + 40) sh.life = 0;
      for (const t of live) {
        if (sh.life <= 0 || !t.alive || t.id === sh.own || Math.hypot(t.x - sh.x, t.y - sh.y) > 38) continue;
        sh.life = 0;
        s.fx.push({ x: r1(sh.x), y: r1(sh.y), t: 0 });
        if (t.inv > 0) continue;
        t.hp--; t.inv = 0.5; t.vx += sh.vx * 0.3; t.vy += sh.vy * 0.3;
        if (t.hp <= 0) { t.alive = false; s.out.push(t.id); }
      }
    }
    s.shots = s.shots.filter(sh => sh.life > 0);
    for (const f of s.fx) f.t += dt;
    s.fx = s.fx.filter(f => f.t < 0.5);

    const left = s.tanks.filter(t => t.alive);
    if (left.length > 1 && s.time > 0) return;
    const best = Math.max(...left.map(t => t.hp), 0);
    const win = left.filter(t => t.hp === best);
    const humans = win.filter(t => !t.bot);
    const name = id => G.players.find(p => p.id === id).name;
    if (!humans.length) s.over = { pts: {}, text: 'حرّاس القلعة احتفظوا بها. حظاً أوفر في المرة القادمة!' };
    else if (win.length === 1) s.over = { pts: { [win[0].id]: 5 }, champion: win[0].id, text: `${name(win[0].id)} صاحب آخر حلقة ورقية — والقلعة له!` };
    else s.over = { pts: Object.fromEntries(humans.map(t => [t.id, 2])), text: `انتهى الوقت! ${humans.map(t => name(t.id)).join(' و')} يتقاسمون الميدان.` };
  },
  view(s) {
    return {
      tanks: s.tanks.map(t => ({ id: t.id, x: r1(t.x), y: r1(t.y), a: r1(t.a * 10) / 10, hp: t.hp, alive: t.alive, inv: t.inv > 0 })),
      shots: s.shots.map(sh => ({ x: r1(sh.x), y: r1(sh.y) })), fx: s.fx, obs: s.obs, time: Math.max(0, s.time),
    };
  },
  pview(s, pid) { const t = s.tanks.find(x => x.id === pid); return { ui: t.alive ? 'a' : 'd', hp: t.hp }; },
};

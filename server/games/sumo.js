// 12. Sumo Rings — quick one-on-one bouts; out-tap your opponent to shove them off the ring.
const { rnd, clamp, r3 } = require('./util');

function bout(s) {
  const [a, b] = s.bouts[s.i];
  Object.assign(s, { a, b, pos: 0, vel: 0, phase: 'ready', t: 2.5, time: 15, winner: null, bot: 0 });
}

module.exports = {
  id: 'sumo', name: 'مصارعة السومو', kind: 'all', tag: 'واحد ضد واحد',
  blurb: 'نزالات سريعة وجهاً لوجه. ادفع خصمك خارج الحلبة قبل أن يدفعك.',
  runnerTip: 'نزالات ثنائية بالدور. حين يأتي دورك اضغط الزر بأسرع ما تستطيع لتدفع خصمك خارج الحلبة.',
  create(G) {
    const ids = G.ids.slice();
    if (ids.length % 2) ids.push('bot0'); // the odd one out wrestles a castle guard
    const s = { bouts: [], i: 0, last: {}, wins: {}, results: [] };
    for (let i = 0; i < ids.length; i += 2) s.bouts.push([ids[i], ids[i + 1]]);
    bout(s);
    return s;
  },
  input(s, pid, m) {
    if (s.phase !== 'fight' || !m.tap || (pid !== s.a && pid !== s.b)) return;
    const now = Date.now();
    if (now - (s.last[pid] || 0) < 45) return;
    s.last[pid] = now;
    s.vel += pid === s.a ? 0.085 : -0.085;
  },
  tick(s, dt, G) {
    s.t -= dt;
    if (s.phase === 'ready') { if (s.t <= 0) s.phase = 'fight'; return; }
    if (s.phase === 'end') {
      if (s.t > 0) return;
      if (++s.i < s.bouts.length) return bout(s);
      const names = Object.keys(s.wins).map(id => G.players.find(p => p.id === id).name);
      s.i = s.bouts.length - 1;
      s.over = { pts: Object.fromEntries(Object.keys(s.wins).map(id => [id, 2])), text: names.length ? `أبطال الحلبة: ${names.join(' و')}!` : 'حرّاس القلعة سيطروا على الحلبة!' };
      return;
    }
    s.time -= dt;
    if (s.b.startsWith('bot') && (s.bot -= dt) <= 0) { s.bot = 0.15 + rnd() * 0.15; s.vel -= 0.085; }
    s.vel *= 1 - 3 * dt;
    s.pos = clamp(s.pos + s.vel * dt, -1, 1);
    if (Math.abs(s.pos) < 1 && s.time > 0) return;
    s.winner = s.pos >= 0 ? s.a : s.b; // pos > 0 means A has pushed B toward B's edge
    if (!s.winner.startsWith('bot')) s.wins[s.winner] = 1;
    s.results.push(s.winner);
    s.phase = 'end'; s.t = 3;
  },
  view(s) { return { i: s.i, n: s.bouts.length, a: s.a, b: s.b, pos: r3(s.pos), phase: s.phase, t: s.t, winner: s.winner, results: s.results, time: s.phase === 'fight' ? Math.max(0, s.time) : undefined }; },
  pview(s, pid) {
    const mine = pid === s.a || pid === s.b;
    return { ui: s.i + s.phase + (mine ? 'm' : 's'), phase: s.phase, mine, won: s.winner === pid };
  },
};

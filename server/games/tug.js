// 11. Tug of War — two teams hammer their buttons; the rope drags the losers into the mud.
const { rnd, clamp, r3 } = require('./util');

module.exports = {
  id: 'tug', name: 'شد الحبل', kind: 'all', tag: 'فريق ضد فريق',
  blurb: 'فريقان وحبل واحد وبركة وحل في المنتصف. اضغطوا بأسرع ما يمكن!',
  runnerTip: 'أنتم فريقان. عند إشارة «اسحبوا!» اضغط الزر بأسرع ما تستطيع. الفريق الذي يُسحب إلى الوحل يخسر.',
  create(G) {
    const teams = [[], []];
    G.ids.forEach((id, i) => teams[i % 2].push(id));
    for (let i = 0; teams[1].length < teams[0].length; i++) teams[1].push('bot' + i); // even out the sides
    return { phase: 'ready', t: 3.5, pos: 0, vel: 0, teams, last: {}, bots: {}, time: 40, pulls: [0, 0] };
  },
  input(s, pid, m) {
    if (s.phase !== 'pull' || !m.tap) return;
    const now = Date.now();
    if (now - (s.last[pid] || 0) < 45) return; // nobody taps 20 times a second by hand
    s.last[pid] = now;
    const side = s.teams[0].includes(pid) ? 0 : 1;
    s.vel += (side ? 1 : -1) * 0.075 / s.teams[side].length;
    s.pulls[side]++;
  },
  tick(s, dt, G) {
    if (s.phase === 'ready') { s.t -= dt; if (s.t <= 0) s.phase = 'pull'; return; }
    s.time -= dt;
    for (const side of [0, 1]) for (const id of s.teams[side]) {
      if (!id.startsWith('bot')) continue;
      s.bots[id] = (s.bots[id] || 0) - dt;
      if (s.bots[id] <= 0) { s.bots[id] = 0.15 + rnd() * 0.15; s.vel += (side ? 1 : -1) * 0.075 / s.teams[side].length; s.pulls[side]++; }
    }
    s.vel *= 1 - 2.5 * dt;
    s.pos = clamp(s.pos + s.vel * dt, -1, 1);
    if (Math.abs(s.pos) < 1 && s.time > 0) return;
    const win = s.pos === 0 ? -1 : s.pos > 0 ? 1 : 0;
    s.winner = win;
    if (win < 0) { s.over = { pts: {}, text: 'تعادل! لم يتزحزح الحبل.' }; return; }
    const humans = s.teams[win].filter(id => !id.startsWith('bot'));
    const names = humans.map(id => G.players.find(p => p.id === id).name);
    s.over = { pts: Object.fromEntries(humans.map(id => [id, 2])), text: names.length ? `${names.join(' و')} سحبوا خصومهم إلى الوحل!` : 'حرّاس القلعة سحبوا الجميع إلى الوحل!' };
  },
  view(s) { return { phase: s.phase, t: s.t, pos: r3(s.pos), teams: s.teams, pulls: s.pulls, winner: s.winner, time: s.phase === 'pull' ? Math.max(0, s.time) : undefined }; },
  pview(s, pid) { return { ui: s.phase, team: s.teams[0].includes(pid) ? 0 : 1 }; },
};

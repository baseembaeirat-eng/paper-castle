// 4. Knock Knock — three of four doors on every wall are solid wood.
const { rnd } = require('./util');
const WALLS = 3, DOORS = 4;

module.exports = {
  id: 'knock', name: 'الأبواب الخادعة', kind: 'runner',
  blurb: 'أربعة أبواب في كل جدار، ثلاثة منها خشب صلب. اندفع بكل قوتك.',
  runnerTip: 'اختر باباً واحداً في كل جدار واندفع. الورق يتمزق، أمّا الخشب فلا.',
  othersTip: 'في كل جدار يخصّك اختر الباب الورقي الوحيد. الثلاثة الباقية مقفلة بإحكام.',
  create(G) {
    const s = { phase: 'setup', t: 20, wall: 0, open: [], owner: [], ready: {}, anim: null, hist: [], time: 45 };
    for (let w = 0; w < WALLS; w++) { s.open.push(Math.floor(rnd() * DOORS)); s.owner.push(G.others.length ? G.others[w % G.others.length] : null); }
    return s;
  },
  input(s, pid, m, G) {
    if (s.phase === 'setup') {
      if (pid === G.runnerId) return;
      if (m.ready) { s.ready[pid] = 1; if (G.others.every(id => s.ready[id])) s.phase = 'run'; return; }
      const w = m.wall | 0, d = m.door | 0;
      if (w >= 0 && w < WALLS && d >= 0 && d < DOORS && s.owner[w] === pid) s.open[w] = d;
    } else if (pid === G.runnerId && !s.anim) {
      const d = m.door | 0;
      if (d >= 0 && d < DOORS) s.anim = { door: d, t: 0, res: null };
    }
  },
  tick(s, dt) {
    if (s.phase === 'setup') { s.t -= dt; if (s.t <= 0) s.phase = 'run'; return; }
    const a = s.anim;
    if (!a) { s.time -= dt; if (s.time <= 0) s.over = { win: false, text: 'خانت العدّاءَ شجاعتُه أمام الأبواب.' }; return; }
    a.t += dt / 1.2;
    if (a.t >= 1 && !a.res) { a.res = a.door === s.open[s.wall] ? 'ok' : 'no'; s.hist.push(a.res === 'ok'); }
    if (a.t >= 2) {
      if (a.res === 'no') s.over = { win: false, text: 'طاخ! بلّوط صلب. العدّاء يرى النجوم.' };
      else { s.wall++; s.anim = null; if (s.wall >= WALLS) s.over = { win: true, text: 'اخترق كل الجدران! يا له من رأس.' }; }
    }
  },
  view(s) {
    return { phase: s.phase, wall: Math.min(s.wall, WALLS - 1), anim: s.anim, hist: s.hist, n: WALLS, time: s.phase === 'run' ? s.time : s.t, owner: s.owner, open: s.over ? s.open : null };
  },
  pview(s, pid, G) {
    if (pid === G.runnerId) return { ui: s.phase, wall: s.wall, busy: !!s.anim };
    return { ui: s.phase, open: s.open, mine: s.owner.map(o => o === pid), ready: !!s.ready[pid], wall: s.wall };
  },
};

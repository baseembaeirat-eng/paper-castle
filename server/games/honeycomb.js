// 1. Honeycomb Maze — the Runner sees one room; the Monsters see everything.
const { rnd, pick } = require('./util');
const R = 3;
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]; // E NE NW W SW SE
const key = (q, r) => q + ',' + r;
const dist = (a, b) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
const STARTS = [[3, -3], [0, 3], [0, -3], [2, 1], [2, -2]];

function step(s, ent, d) {
  const c = s.cells[key(ent.q, ent.r)];
  if (!c.d[d]) return false;
  ent.q += DIRS[d][0]; ent.r += DIRS[d][1];
  return true;
}
function check(s) {
  if (s.over) return;
  if (s.mons.some(m => m.q === s.runner.q && m.r === s.runner.r)) s.over = { win: false, text: 'أُمسك به في الظلام! الوحوش تحتفل.' };
  else if (s.runner.q === s.exit.q && s.runner.r === s.exit.r) s.over = { win: true, text: 'العدّاء وجد باب الفانوس!' };
}
function chase(s, m) { // breadth-first step toward the runner
  const goal = key(s.runner.q, s.runner.r), seen = new Set([key(m.q, m.r)]);
  let frontier = [{ q: m.q, r: m.r, first: -1 }];
  while (frontier.length) {
    const next = [];
    for (const n of frontier) {
      if (key(n.q, n.r) === goal) return n.first;
      const c = s.cells[key(n.q, n.r)];
      for (let d = 0; d < 6; d++) {
        if (!c.d[d]) continue;
        const q = n.q + DIRS[d][0], r = n.r + DIRS[d][1], k = key(q, r);
        if (seen.has(k)) continue;
        seen.add(k); next.push({ q, r, first: n.first < 0 ? d : n.first });
      }
    }
    frontier = next;
  }
  return -1;
}

module.exports = {
  id: 'honeycomb', name: 'متاهة الوحش السداسية', kind: 'runner',
  blurb: 'عدّاء واحد تائه بين الخلايا، والوحوش تعرف كل جدار.',
  runnerTip: 'أنت ترى فقط الغرفة التي تقف فيها. اضغط على فتحة باب لتعبر منها، وابحث عن باب الفانوس في أقصى اليمين.',
  othersTip: 'أنت وحش وترى المتاهة كلها — اضغط باتجاه فتحة باب لتتحرك، وحاصِر العدّاء.',
  create(G) {
    const cells = {};
    for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++)
      if (Math.abs(q + r) <= R) cells[key(q, r)] = { q, r, d: [0, 0, 0, 0, 0, 0] };
    const open = (c, d) => { const n = cells[key(c.q + DIRS[d][0], c.r + DIRS[d][1])]; c.d[d] = 1; n.d[(d + 3) % 6] = 1; return n; };
    const seen = new Set(['0,0']), stack = [cells['0,0']];
    while (stack.length) {
      const c = stack[stack.length - 1];
      const opts = [0, 1, 2, 3, 4, 5].filter(d => { const k = key(c.q + DIRS[d][0], c.r + DIRS[d][1]); return cells[k] && !seen.has(k); });
      if (!opts.length) { stack.pop(); continue; }
      const n = open(c, pick(opts)); seen.add(key(n.q, n.r)); stack.push(n);
    }
    for (const c of Object.values(cells)) for (let d = 0; d < 3; d++)
      if (!c.d[d] && cells[key(c.q + DIRS[d][0], c.r + DIRS[d][1])] && rnd() < 0.4) open(c, d);
    const mons = G.others.map((id, i) => ({ id, q: STARTS[i][0], r: STARTS[i][1], cd: 0 }));
    for (let i = mons.length; i < 2; i++) mons.push({ id: 'bot' + i, bot: true, q: STARTS[i][0], r: STARTS[i][1], cd: 1.5 });
    return { cells, mons, runner: { q: -3, r: 0, cd: 0 }, exit: { q: 3, r: 0 }, time: 90 };
  },
  input(s, pid, m, G) {
    const d = m.d | 0;
    if (d < 0 || d > 5) return;
    const ent = pid === G.runnerId ? s.runner : s.mons.find(x => x.id === pid);
    if (!ent || ent.cd > 0) return;
    if (step(s, ent, d)) { ent.cd = ent === s.runner ? 0.4 : 0.75; check(s); }
  },
  tick(s, dt) {
    s.time -= dt;
    s.runner.cd -= dt;
    for (const m of s.mons) {
      m.cd -= dt;
      if (m.bot && m.cd <= 0) {
        const c = s.cells[key(m.q, m.r)];
        let d = rnd() < 0.65 ? chase(s, m) : -1;
        if (d < 0) d = pick([0, 1, 2, 3, 4, 5].filter(x => c.d[x]));
        step(s, m, d); m.cd = 1.15;
      }
    }
    check(s);
    if (!s.over && s.time <= 0) s.over = { win: false, text: 'انطفأت الفوانيس، وبقي العدّاء حبيس المتاهة.' };
  },
  view(s) {
    return { cells: Object.values(s.cells), runner: { q: s.runner.q, r: s.runner.r }, mons: s.mons.map(m => ({ id: m.id, q: m.q, r: m.r })), exit: s.exit, time: s.time };
  },
  pview(s, pid, G) {
    if (pid === G.runnerId) {
      const c = s.cells[key(s.runner.q, s.runner.r)];
      return { ui: 'r', d: c.d, growl: Math.min(...s.mons.map(m => dist(m, s.runner))), far: dist(s.exit, s.runner) };
    }
    const me = s.mons.find(m => m.id === pid);
    return { ui: 'm', cells: Object.values(s.cells), me: { q: me.q, r: me.r }, runner: { q: s.runner.q, r: s.runner.r }, mons: s.mons.map(m => ({ id: m.id, q: m.q, r: m.r })), exit: s.exit };
  },
};

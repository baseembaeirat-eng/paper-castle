// 9. Show of Hands — a puzzle on the big screen, giant cards on every phone.
const { rnd, pick, shuffle } = require('./util');
const ROUNDS = 5;
const SYMS = ['☀', '☾', '★', '♣', '♥', '♦', '♠', '✿'];
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

function puzzle(L) {
  if (rnd() < 0.4) {
    const [A, B, C] = shuffle(SYMS);
    const [seq, ans] = pick([[[A, B, A, B, A], B], [[A, B, C, A, B], C], [[A, A, B, A, A], B], [[A, B, B, A, B], B], [[A, B, C, C, B], A]]);
    const cards = shuffle([ans, ...shuffle(SYMS.filter(x => x !== ans)).slice(0, 5)]);
    return { text: seq.join('  ') + '  ?', sub: 'ما التالي؟ (اقرأ من اليسار إلى اليمين)', cards, answer: cards.indexOf(ans) };
  }
  const a = ri(3, 12 + 3 * L), b = ri(2, 9), c = ri(1, 15 + 6 * L); // later stages: bigger numbers, less time
  const [text, ans] = pick([[`${a} × ${b} + ${c}`, a * b + c], [`${a * b} ÷ ${b} + ${c}`, a + c], [`${a} × ${b} − ${c}`, a * b - c], [`${a + c} + ${b} × ${b}`, a + c + b * b]]);
  const set = new Set([ans]);
  for (const d of shuffle([1, -1, 2, -2, 10, -10, b, -b, 3])) { if (set.size >= 6) break; set.add(ans + d); }
  const cards = shuffle([...set]).map(String);
  return { text: text + ' = ?', sub: 'ارتمِ على البطاقة الصحيحة!', cards, answer: cards.indexOf(String(ans)) };
}
function next(s, G) {
  const L = (G.level || 1) - 1;
  s.round++; s.phase = 'ask'; s.t = 20 - 2 * L; s.q = puzzle(L); s.picks = {}; s.winner = null;
  s.perm = Object.fromEntries(G.ids.map(id => [id, shuffle([0, 1, 2, 3, 4, 5])]));
}

module.exports = {
  id: 'hands', name: 'البطاقات العملاقة', kind: 'all',
  blurb: 'يظهر لغز، وست بطاقات عملاقة على الأرض. أول من يرتمي على الجواب يكسبها.',
  runnerTip: 'الجميع يلعبون. اقرأ اللغز على الشاشة الكبيرة ثم اضغط البطاقة الصحيحة. الارتماء الخاطئ يُخرجك من الجولة.',
  create(G) { const s = { round: 0, wins: {} }; next(s, G); return s; },
  input(s, pid, m) {
    const c = m.card | 0;
    if (s.phase !== 'ask' || pid in s.picks || c < 0 || c > 5) return;
    s.picks[pid] = c;
    if (c === s.q.answer) { s.winner = pid; s.wins[pid] = (s.wins[pid] || 0) + 1; s.phase = 'reveal'; s.t = 3.5; }
  },
  tick(s, dt, G) {
    s.t -= dt;
    if (s.phase === 'ask') {
      if (s.t <= 0 || G.ids.every(id => id in s.picks)) { s.phase = 'reveal'; s.t = 3.5; }
    } else if (s.t <= 0) {
      if (s.round < ROUNDS) return next(s, G);
      const best = Math.max(0, ...Object.values(s.wins));
      const top = G.players.filter(p => best && s.wins[p.id] === best).map(p => p.name);
      s.over = { pts: { ...s.wins }, text: top.length ? `أسرع الأيدي: ${top.join(' و')} (عدد البطاقات: ${best})` : 'لا أحد عرف الحساب اليوم.' };
    }
  },
  view(s) {
    return { round: s.round, rounds: ROUNDS, phase: s.phase, text: s.q.text, sub: s.q.sub, cards: s.q.cards, picks: s.picks, winner: s.winner, answer: s.phase === 'reveal' ? s.q.answer : -1, wins: s.wins, time: s.phase === 'ask' ? s.t : undefined };
  },
  pview(s, pid) {
    return { ui: 'r' + s.round, cards: s.perm[pid].map(i => ({ i, label: s.q.cards[i] })), pick: pid in s.picks ? s.picks[pid] : -1, phase: s.phase, answer: s.phase === 'reveal' ? s.q.answer : -1, won: s.winner === pid };
  },
};

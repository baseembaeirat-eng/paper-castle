// 2. Skipping Stones — saboteurs swap stones for paper; the Runner reads their faces.
const { rnd, shuffle } = require('./util');
const ROWS = 5, COLS = 3;

function begin(s) {
  for (let r = 0; r < ROWS; r++) {
    if (s.paper[r].some(Boolean)) continue;
    const cols = shuffle([0, 1, 2]);
    s.paper[r][cols[0]] = 1;
    if (rnd() < 0.7) s.paper[r][cols[1]] = 1;
  }
  s.phase = 'run';
}

module.exports = {
  id: 'stones', name: 'صخور النهر الغادرة', kind: 'runner',
  blurb: 'بعض الأحجار حجر حقيقي وبعضها ورق مدهون. الآخرون وحدهم يعرفون.',
  runnerTip: 'اقفز فوق النهر صفّاً صفّاً. ثلاث غطسات وتخرج — راقب وجوه من تسمّيهم أصدقاءك.',
  othersTip: 'اختر سرّاً أي أحجار في صفوفك تكون ورقاً يغرق (اثنان كحدّ أقصى في الصف). ثم حافظ على وجه جامد.',
  create(G) {
    const L = (G.level || 1) - 1; // 0 on the first stage, up to 5
    const s = { phase: 'setup', t: 25, paper: [], rev: [], owner: [], ready: {}, row: 0, col: 1, lives: L >= 4 ? 1 : L >= 2 ? 2 : 3, jump: null, splash: null, fin: null, time: 60 - 6 * L };
    for (let r = 0; r < ROWS; r++) {
      s.paper.push([0, 0, 0]); s.rev.push([0, 0, 0]);
      s.owner.push(G.others.length ? G.others[r % G.others.length] : null);
    }
    return s;
  },
  input(s, pid, m, G) {
    if (s.phase === 'setup') {
      if (pid === G.runnerId) return;
      if (m.ready) { s.ready[pid] = 1; if (G.others.every(id => s.ready[id])) begin(s); return; }
      const r = m.row | 0, c = m.col | 0;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS || s.owner[r] !== pid) return;
      s.paper[r][c] ^= 1;
      if (s.paper[r].filter(Boolean).length > 2) s.paper[r][c] = 0;
    } else if (pid === G.runnerId && !s.jump && !s.fin) {
      const c = m.col | 0;
      if (c < 0 || c >= COLS || s.rev[s.row][c] === 1) return;
      s.jump = { col: c, t: 0 };
    }
  },
  tick(s, dt) {
    if (s.phase === 'setup') { s.t -= dt; if (s.t <= 0) begin(s); return; }
    s.time -= dt;
    if (s.splash && (s.splash.t += dt) > 1.2) s.splash = null;
    if (s.fin) { s.fin.t += dt / 0.7; if (s.fin.t >= 1) s.over = { win: true, text: 'قدمان جافّتان! العدّاء عبر النهر.' }; return; }
    if (s.jump) {
      s.jump.t += dt / 0.7;
      if (s.jump.t >= 1) {
        const c = s.jump.col; s.jump = null;
        if (s.paper[s.row][c]) {
          s.rev[s.row][c] = 1; s.lives--; s.splash = { row: s.row, col: c, t: 0 };
          if (s.lives <= 0) s.over = { win: false, text: 'طَشّ! أحجار الورق أوقعت عدّاءً آخر.' };
        } else {
          s.rev[s.row][c] = 2; s.col = c; s.row++;
          if (s.row >= ROWS) s.fin = { t: 0 };
        }
      }
    }
    if (!s.over && s.time <= 0) s.over = { win: false, text: 'تأخّرت كثيراً — ارتفع النهر فوق الأحجار.' };
  },
  view(s) {
    return { phase: s.phase, t: s.t, row: s.row, col: s.col, lives: s.lives, rev: s.rev, jump: s.jump, splash: s.splash, fin: s.fin, time: s.phase === 'run' ? s.time : s.t, owner: s.owner, paper: s.over ? s.paper : null };
  },
  pview(s, pid, G) {
    if (pid === G.runnerId) return { ui: s.phase, row: s.row, lives: s.lives, rev: s.rev[Math.min(s.row, ROWS - 1)], busy: !!(s.jump || s.fin) };
    return { ui: s.phase, paper: s.paper, mine: s.owner.map(o => o === pid), ready: !!s.ready[pid], row: s.row, rev: s.rev };
  },
};

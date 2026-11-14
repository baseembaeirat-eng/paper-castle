// 6. High Rollers — hop across spinning drums whose speed the others keep changing.
const { rnd, clamp, r3 } = require('./util');
const N = 5;
const spin = () => (rnd() < 0.5 ? -1 : 1) * (0.8 + rnd() * 1.8);

module.exports = {
  id: 'rollers', name: 'القفز على الأسطوانات', kind: 'runner',
  blurb: 'خمسة براميل ضخمة تدور بلا توقف، وليس أبداً كما تتوقع.',
  runnerTip: 'امشِ عكس الدوران بالأسهم لتبقى في الأعلى، ثبّت قدميك، ثم «اقفز» إلى البرميل التالي.',
  othersTip: 'اضغط على برميل لتغيّر سرعته واتجاهه. افعلها لحظة هبوط العدّاء.',
  create(G) {
    return { om: Array.from({ length: N }, spin), rot: Array(N).fill(0), on: -1, x: 0, mv: 0, foot: 0, air: null, cds: {}, bot: G.others.length ? 0 : 2, time: 60 };
  },
  input(s, pid, m, G) {
    if (pid === G.runnerId) {
      if ('mv' in m) s.mv = clamp(m.mv | 0, -1, 1);
      if (m.jump && !s.air && (s.on === -1 || s.foot >= 0.6)) s.air = { t: 0, on: s.on, x: s.x };
      return;
    }
    const i = m.cyl | 0;
    if ('cyl' in m && i >= 0 && i < N && (s.cds[pid] || 0) <= 0) { s.cds[pid] = 1.2; s.om[i] = spin(); }
  },
  tick(s, dt) {
    s.time -= dt;
    for (const k in s.cds) s.cds[k] -= dt;
    if (s.bot && (s.bot -= dt) <= 0) { s.bot = 1 + rnd() * 2; s.om[Math.floor(rnd() * N)] = spin(); }
    for (let i = 0; i < N; i++) s.rot[i] += s.om[i] * dt;
    if (s.air) {
      s.air.t += dt / 0.55;
      if (s.air.t >= 1) {
        s.on = s.air.on + 1;
        s.x = s.air.on < 0 ? -0.3 : clamp(s.air.x * 0.5 + (rnd() - 0.5) * 0.2, -0.8, 0.8);
        s.air = null; s.foot = 0;
        if (s.on >= N) { s.over = { win: true, text: 'خفيف القدمين! العدّاء اجتاز البراميل.' }; return; }
      }
    } else if (s.on >= 0) {
      s.x += (s.om[s.on] * 0.42 + s.mv) * dt;
      s.foot += dt;
      if (Math.abs(s.x) > 1) { s.over = { win: false, text: 'أوبس! طار إلى الماء.' }; return; }
    }
    if (s.time <= 0) s.over = { win: false, text: 'صمدت البراميل أكثر من العدّاء.' };
  },
  view(s) {
    return { om: s.om.map(r3), rot: s.rot.map(r3), on: s.on, x: r3(s.x), mv: s.mv, air: s.air && { t: r3(s.air.t), on: s.air.on, x: r3(s.air.x) }, time: s.time };
  },
  pview(s, pid, G) {
    if (pid === G.runnerId) return { ui: 'r', can: !s.air && (s.on === -1 || s.foot >= 0.6) };
    return { ui: 'o', rdy: (s.cds[pid] || 0) <= 0 };
  },
};

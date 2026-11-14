// 5. Avalanche — run uphill between hiding gaps while the others loose boulders.
const { rnd, r3 } = require('./util');
const GAPS = [0, 1, 2, 3, 4, 5, 6, 7].map(i => i / 8);

module.exports = {
  id: 'avalanche', name: 'وادي الصخور المتدحرجة', kind: 'runner',
  blurb: 'درب جبلي ضيق، بضعة تجاويف للاختباء، وصخور أكثر من اللازم.',
  runnerTip: 'اضغط مطوّلاً «اركض» لتصعد. قرب أي تجويف اضغط مطوّلاً «اختبئ» لتحتمي ريثما تمرّ الصخرة.',
  othersTip: 'اضغط لتُفلت صخرة من القمة، واصطد العدّاء بين التجاويف.',
  create(G) {
    return { p: 0, hid: true, run: false, hide: false, boul: [], cds: {}, gcd: 2, bot: G.others.length ? 0 : 3, time: 75 };
  },
  input(s, pid, m, G) {
    if (pid === G.runnerId) { if ('run' in m) s.run = !!m.run; if ('hide' in m) s.hide = !!m.hide; return; }
    if (m.drop && (s.cds[pid] || 0) <= 0 && s.gcd <= 0) { s.cds[pid] = 5; s.gcd = 1.8; s.boul.push({ p: 1.06, v: 0.22, rot: 0 }); }
  },
  tick(s, dt) {
    s.time -= dt; s.gcd -= dt;
    for (const k in s.cds) s.cds[k] -= dt;
    if (s.bot && (s.bot -= dt) <= 0) { s.bot = 2 + rnd() * 2.5; s.boul.push({ p: 1.06, v: 0.22, rot: 0 }); }
    const gap = GAPS.find(g => Math.abs(g - s.p) < 0.035);
    s.near = gap !== undefined;
    s.hid = s.hide && s.near;
    if (s.hid) s.p = gap;
    else if (s.run) s.p += 0.13 * dt;
    for (const b of s.boul) {
      b.v += 0.3 * dt; b.p -= b.v * dt; b.rot -= b.v * dt * 28;
      if (!s.hid && Math.abs(b.p - s.p) < 0.035) s.over = { win: false, text: 'انسحق! الجبل يفوز دائماً.' };
    }
    s.boul = s.boul.filter(b => b.p > -0.1);
    if (s.over) return;
    if (s.p >= 1) s.over = { win: true, text: 'وصل العدّاء إلى القمة سالماً!' };
    else if (s.time <= 0) s.over = { win: false, text: 'ظلّ مختبئاً حتى انطلقت الصافرة.' };
  },
  view(s) {
    return { p: r3(s.p), hid: s.hid, run: s.run && !s.hid, boul: s.boul.map(b => ({ p: r3(b.p), rot: r3(b.rot) })), gaps: GAPS, time: s.time };
  },
  pview(s, pid, G) {
    if (pid === G.runnerId) return { ui: 'r', near: !!s.near, hid: s.hid };
    return { ui: 'o', rdy: (s.cds[pid] || 0) <= 0 && s.gcd <= 0 };
  },
};

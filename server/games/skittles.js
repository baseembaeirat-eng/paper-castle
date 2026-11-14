// 13. Skittles — one player steers a giant bowling ball; everyone else is a pin, dodging by tilt.
const { rnd, clamp, r3 } = require('./util');
const BALLS = 4, PIN_Y = 0.9;

module.exports = {
  id: 'skittles', name: 'البولينغ البشري', kind: 'runner', tag: 'واحد ضد الجميع', sides: ['صاحب الكرة', 'القناني'],
  blurb: 'لاعب واحد يدحرج كرة عملاقة، والبقية قناني بولينغ تتمايل لتنجو.',
  runnerTip: 'أنت صاحب الكرة. اسحب لتصوّب ثم اضغط «ارمِ»، ووجّه الكرة وهي تتدحرج. أسقط نصف القناني على الأقل بأربع كرات.',
  othersTip: 'أنت قنّينة بولينغ! أمِل جهازك يميناً ويساراً (أو اسحب الشريط) لتهرب من الكرة.',
  create(G) {
    const ids = G.others.length ? G.others.slice() : ['bot0', 'bot1', 'bot2'];
    const n = ids.length, L = (G.level || 1) - 1; // later stages: a narrower ball and more pins to knock down
    return {
      phase: 'aim', t: 8, balls: BALLS, steer: 0, ball: { x: 0, y: 0 }, need: Math.min(n, Math.ceil(n * (0.5 + 0.08 * L))), hit: 0.3 - 0.03 * L, strike: 0,
      pins: ids.map((id, i) => ({ id, bot: id.startsWith('bot'), x: n === 1 ? 0 : -0.7 + (1.4 * i) / (n - 1), tilt: 0, up: true, aim: 0 })),
    };
  },
  input(s, pid, m, G) {
    const tilt = typeof m.tilt === 'number' && isFinite(m.tilt) ? clamp(m.tilt, -1, 1) : null;
    if (pid === G.runnerId) {
      if (tilt !== null) s.steer = tilt;
      if (m.roll && s.phase === 'aim') s.phase = 'roll';
      return;
    }
    const pin = s.pins.find(p => p.id === pid);
    if (pin && tilt !== null) pin.tilt = tilt;
  },
  tick(s, dt) {
    for (const p of s.pins) {
      if (!p.up) continue;
      if (p.bot) { // guards shuffle away from the ball, a little late and a little wrong
        if (rnd() < dt * 3) p.aim = s.phase === 'roll' && Math.abs(p.x - s.ball.x) < 0.5 ? Math.sign(p.x - s.ball.x || rnd() - 0.5) * (rnd() < 0.8 ? 1 : -1) : (rnd() - 0.5) * 1.2;
        p.tilt = p.aim;
      }
      p.x = clamp(p.x + p.tilt * 0.8 * dt, -1, 1);
    }
    const b = s.ball;
    if (s.phase === 'aim') {
      b.y = 0; b.x = clamp(b.x + s.steer * 1.2 * dt, -0.85, 0.85);
      if ((s.t -= dt) <= 0) s.phase = 'roll';
    } else if (s.phase === 'roll') {
      const before = b.y;
      b.y += dt / 1.9; b.x = clamp(b.x + s.steer * 0.5 * dt, -0.9, 0.9);
      if (before < PIN_Y && b.y >= PIN_Y) {
        const hit = s.pins.filter(p => p.up && Math.abs(p.x - b.x) < s.hit);
        hit.forEach(p => { p.up = false; });
        s.strike = hit.length;
      }
      if (b.y >= 1.15) { s.phase = 'pause'; s.t = 1.3; s.balls--; }
    } else if ((s.t -= dt) <= 0) {
      const down = s.pins.filter(p => !p.up).length;
      if (down >= s.need) s.over = { win: true, text: `سقطت ${down} من ${s.pins.length} قناني — صاحب الكرة يفوز!` };
      else if (!s.balls) s.over = { win: false, text: 'القناني صمدت! انتهت الكرات.' };
      else { s.phase = 'aim'; s.t = 8; s.strike = 0; b.y = 0; }
    }
  },
  view(s) { return { phase: s.phase, ball: { x: r3(s.ball.x), y: r3(s.ball.y) }, pins: s.pins.map(p => ({ id: p.id, x: r3(p.x), up: p.up })), balls: s.balls, need: s.need, strike: s.strike, time: s.phase === 'aim' ? s.t : undefined }; },
  pview(s, pid, G) {
    if (pid === G.runnerId) return { ui: 'b', phase: s.phase, balls: s.balls };
    return { ui: s.pins.find(p => p.id === pid).up ? 'up' : 'down' };
  },
};

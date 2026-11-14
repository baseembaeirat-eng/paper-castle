// Main screen shell: lobby, title cards, HUD, results. The scenes themselves live in scenes.js.
(() => {
  const A = Art, P = A.PAL, W = 1600, H = 900;
  const cv = document.getElementById('stage'), c = cv.getContext('2d');
  const paper = A.paper(W, H);
  const socket = io();
  let lobby = null, gs = null, joinUrl = location.host, bg = { seq: -1, cv: null }, hits = [], mouse = [0, 0];
  const t0 = performance.now();

  const connect = () => socket.emit('host:create', { code: lobby ? lobby.code : new URLSearchParams(location.search).get('code') }, res => {
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    joinUrl = (local && res.urls[0] ? res.urls[0] : location.origin).replace(/^https?:\/\//, '');
  });
  socket.on('connect', connect);
  socket.on('lobby', d => { lobby = d; if (d.phase === 'lobby') gs = null; });
  socket.on('state', d => { gs = d; });

  const toLogical = e => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; };
  cv.addEventListener('mousemove', e => { mouse = toLogical(e); });
  cv.addEventListener('click', e => {
    const [x, y] = toLogical(e);
    if (gs) { if (gs.phase === 'intro') socket.emit('skip'); else if (gs.phase === 'result') socket.emit('back'); return; }
    const h = hits.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    if (h) socket.emit('pick', { game: h.id });
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') socket.emit('abort'); if (e.key === 'f') document.documentElement.requestFullscreen?.(); });

  const who = id => { const p = lobby && lobby.players.find(x => x.id === id); return p ? { ci: p.ci, name: p.name } : { ci: 6 + (parseInt(String(id).slice(3)) || 0), name: 'حارس القلعة' }; };
  const mmss = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  function drawLobby(t) {
    A.txt(c, 'قلعة الورق', 1530, 78, 84, { align: 'right', bold: true });
    A.ink(c, [[900, 124], [1530, 120]], 1, { w: 3 });
    A.txt(c, 'بطولة كبرى من السقطات والغطسات والأبواب  ·  منذ 1954', 1528, 152, 34, { align: 'right', hand: true });
    // admission ticket
    A.wash(c, A.rect(50, 34, 540, 150), P.ochre, 2, { alpha: 0.3, amp: 4 }); A.ink(c, A.rect(50, 34, 540, 150), 3, { closed: true, w: 3 }); A.ink(c, A.rect(62, 46, 516, 126), 4, { closed: true, w: 1.2, alpha: 0.5 });
    A.txt(c, 'تذكرة لستة لاعبين — انضمّوا عبر', 320, 68, 24); A.txt(c, joinUrl, 320, 100, 30, { bold: true, max: 500 });
    A.txt(c, 'رمز الغرفة', 440, 146, 28); A.txt(c, lobby.code, 220, 146, 54, { bold: true, color: P.brick });
    // the cast, as model sheets: front / side / back
    for (let i = 0; i < 6; i++) {
      const p = lobby.players[i], x = 60 + i * 250, y = 200;
      A.wash(c, A.rect(x, y, 230, 210), p ? A.PCOL[p.ci] : P.stone, 10 + i, { alpha: p ? 0.2 : 0.08, amp: 4 }); A.ink(c, A.rect(x, y, 230, 210), 20 + i, { closed: true, w: p ? 2.6 : 1.4, alpha: p ? 0.9 : 0.4 });
      if (!p) { A.txt(c, 'بانتظار', x + 115, y + 92, 28, { hand: true, alpha: 0.5 }); A.txt(c, 'متسابق', x + 115, y + 122, 28, { hand: true, alpha: 0.5 }); continue; }
      const emo = ['happy', 'grit', 'smug', 'shock', 'scared', 'angry', 'dizzy', 'sad'][(Math.floor(t / 2.5) + i) % 8];
      A.stick(c, x + 52, y + 150, 0.95, { ci: p.ci, emo, dir: 'front', pose: p.on ? 'stand' : 'crouch', t: t + i, alpha: p.on ? 1 : 0.4 });
      A.stick(c, x + 118, y + 150, 0.95, { ci: p.ci, emo, dir: 'right', t: t + i + 0.3, alpha: p.on ? 1 : 0.4 });
      A.stick(c, x + 182, y + 150, 0.95, { ci: p.ci, dir: 'back', t: t + i + 0.6, alpha: p.on ? 1 : 0.4 });
      A.txt(c, p.name + (p.vip ? ' ★' : ''), x + 14, y + 182, 30, { hand: true, bold: true, align: 'left', max: 150 });
      A.txt(c, p.score + ' نقطة', x + 216, y + 184, 22, { align: 'right' });
      if (lobby.champion === p.id) A.txt(c, 'البطل', x + 115, y + 16, 20, { color: P.brick, bold: true });
    }
    A.txt(c, lobby.players.length ? '★ عريف الحفل يختار اللعبة التالية من جهازه — أو انقر تذكرة هنا.' : 'بانتظار انضمام أول متسابق…', 800, 438, 26, { hand: true });
    // programme of ten games
    hits = [];
    lobby.games.forEach((g, i) => {
      const x = 60 + (i % 5) * 300, y = 468 + Math.floor(i / 5) * 208, w = 280, h = 190;
      const hot = mouse[0] >= x && mouse[0] <= x + w && mouse[1] >= y && mouse[1] <= y + h;
      const tint = [P.sienna, P.slate, P.moss, P.ochre, P.plum, P.teal, P.rose, P.brick, P.sand, P.umber][i];
      A.wash(c, A.rect(x, y, w, h), tint, 40 + i, { alpha: hot ? 0.42 : 0.24, amp: hot ? 6 : 4 }); A.ink(c, A.rect(x, y, w, h), 60 + i, { closed: true, w: hot ? 4 : 2.4 });
      A.txt(c, 'رقم ' + g.num, x + 16, y + 28, 22, { align: 'left' });
      A.txt(c, g.kind === 'runner' ? 'واحد ضد الجميع' : 'الكل ضد الكل', x + w - 14, y + 28, 22, { align: 'right', hand: true });
      A.txt(c, g.name, x + w / 2, y + 70, 31, { bold: true, max: w - 24 });
      A.wrap(c, g.blurb, x + w / 2, y + 108, 21, w - 30, { hand: true, alpha: 0.85 });
      hits.push({ x, y, w, h, id: g.id });
    });
  }

  function drawIntro(t) {
    A.wash(c, A.rect(200, 120, 1200, 660), P.ochre, 71, { alpha: 0.2, amp: 8 }); A.ink(c, A.rect(200, 120, 1200, 660), 72, { closed: true, w: 4 }); A.ink(c, A.rect(216, 136, 1168, 628), 73, { closed: true, w: 1.3, alpha: 0.5 });
    A.txt(c, `اللعبة رقم ${gs.num}`, 800, 190, 34);
    A.txt(c, gs.gname.toUpperCase(), 800, 270, 92, { bold: true, max: 1100 });
    A.wrap(c, gs.blurb, 800, 350, 38, 1000, { hand: true });
    if (gs.runnerId) {
      const r = who(gs.runnerId);
      A.stick(c, 400, 640, 1.8, { ci: r.ci, emo: 'scared', t, pose: 'stand' });
      A.txt(c, 'العدّاء', 400, 680, 26); A.txt(c, r.name, 400, 722, 46, { hand: true, bold: true });
      A.txt(c, 'العدّاء', 1330, 466, 30, { align: 'right', bold: true }); A.wrap(c, gs.runnerTip, 1330, 506, 30, 720, { hand: true, align: 'right' });
      A.txt(c, 'البقية', 1330, 606, 30, { align: 'right', bold: true }); A.wrap(c, gs.othersTip, 1330, 646, 30, 720, { hand: true, align: 'right' });
    } else {
      lobby.players.filter(p => p.on).forEach((p, i, a) => A.stick(c, 800 + (i - (a.length - 1) / 2) * 120, 690, 1.2, { ci: p.ci, emo: 'grit', t: t + i, pose: 'cheer' }));
      A.wrap(c, gs.runnerTip, 800, 470, 30, 1000, { hand: true });
    }
    A.txt(c, `تبدأ بعد ${Math.ceil(gs.left)}…`, 800, 820, 32, { hand: true });
  }

  function drawResult(t) {
    const champ = gs.over.champion && who(gs.over.champion);
    const ps = lobby.players.slice().sort((a, b) => b.score - a.score);
    // A champion gets the full card; otherwise a low banner so the scene's ending stays visible.
    const box = champ ? [300, 110, 1000, 700] : [200, 104, 1200, 250];
    c.fillStyle = champ ? 'rgba(234,223,198,0.7)' : 'rgba(234,223,198,0.25)'; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(243,234,214,0.93)'; c.fillRect(...box);
    A.wash(c, A.rect(...box), P.ochre, 81, { alpha: 0.1, amp: 6 }); A.ink(c, A.rect(...box), 82, { closed: true, w: 4 });
    let y;
    if (champ) {
      A.txt(c, 'بطل القلعة', 800, 180, 54, { bold: true, color: P.brick });
      A.stick(c, 800, 470, 2.2, { ci: champ.ci, emo: 'happy', pose: 'cheer', t });
      A.txt(c, champ.name, 800, 525, 70, { hand: true, bold: true });
      A.wrap(c, gs.over.text, 800, 590, 30, 900, { hand: true });
      y = 740;
    } else { A.wrap(c, gs.over.text, 800, 156, 44, 1100, { hand: true, bold: true }); y = 312; }
    ps.forEach((p, i) => {
      const x = 800 + (i - (ps.length - 1) / 2) * 180, got = gs.awards[p.id];
      A.stick(c, x - 62, y + 22, 0.6, { ci: p.ci, emo: got ? 'happy' : 'sad', pose: got ? 'cheer' : 'stand', t: t + i });
      A.txt(c, p.name, x - 34, y - 14, 28, { hand: true, bold: true, align: 'left', max: 130 });
      A.txt(c, p.score + ' نقطة' + (got ? ` \u2066(+${got})\u2069` : ''), x - 34, y + 14, 19, { align: 'left', color: got ? P.moss : A.INK });
    });
    A.txt(c, 'انقر للعودة إلى الردهة', box[0] + box[2] - 20, box[1] + 22, 20, { hand: true, alpha: 0.6, align: 'right' });
  }

  function frame() {
    const t = (performance.now() - t0) / 1000;
    c.drawImage(paper, 0, 0);
    if (!lobby) A.txt(c, 'نفتح أبواب القلعة…', 800, 450, 48, { hand: true });
    else if (!gs) drawLobby(t);
    else if (gs.phase === 'intro') drawIntro(t);
    else {
      const sc = Scenes[gs.gid];
      const S = { t, pt: gs.t, phase: gs.phase, runnerId: gs.runnerId, who, over: gs.over, ids: gs.ids, others: gs.others };
      if (bg.seq !== gs.seq) {
        bg = { seq: gs.seq, cv: document.createElement('canvas') }; bg.cv.width = W; bg.cv.height = H;
        const b = bg.cv.getContext('2d'); b.drawImage(paper, 0, 0); sc.bg(b, gs.v, S);
      }
      c.drawImage(bg.cv, 0, 0);
      sc.draw(c, gs.v, S);
      A.txt(c, `${gs.num}.  ${gs.gname}`, 40, 46, 34, { align: 'left', bold: true });
      if (gs.runnerId) A.txt(c, 'العدّاء: ' + who(gs.runnerId).name, 42, 86, 30, { align: 'left', hand: true, bold: true });
      if (gs.v.time !== undefined && gs.phase === 'play') { A.ink(c, A.circ(1510, 56, 44, 14, 34), 90, { closed: true, w: 3 }); A.txt(c, mmss(gs.v.time), 1510, 58, 34, { bold: true, color: gs.v.time < 10 ? P.brick : A.INK }); }
      if (gs.phase === 'result') drawResult(t);
    }
    requestAnimationFrame(frame);
  }
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(frame, frame);
})();

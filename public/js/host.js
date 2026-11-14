// Main screen shell: lobby, title cards, HUD, results. The scenes themselves live in scenes.js.
(() => {
  const A = Art, P = A.PAL, W = 1600, H = 900;
  const cv = document.getElementById('stage'), c = cv.getContext('2d');
  const paper = A.paper(W, H);
  const socket = io();
  let lobby = null, gs = null, joinUrl = location.host, bg = { seq: -1, cv: null }, hits = [], mouse = [0, 0];
  const t0 = performance.now();

  // The room code is remembered, so reloading the page returns to the same room and scores.
  const saved = { get: () => { try { return localStorage.getItem('pc_host_code'); } catch (e) { return null; } }, set: v => { try { v ? localStorage.setItem('pc_host_code', v) : localStorage.removeItem('pc_host_code'); } catch (e) {} } };
  const connect = () => socket.emit('host:create', { code: lobby ? lobby.code : new URLSearchParams(location.search).get('code') || saved.get() }, res => {
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    joinUrl = (local && res.urls[0] ? res.urls[0] : location.origin).replace(/^https?:\/\//, '');
    saved.set(res.code);
    try { history.replaceState(null, '', '/host?code=' + res.code); } catch (e) {}
  });

  // Corner buttons: every action that used to need a key or a canvas click.
  const $ = id => document.getElementById(id);
  const stop = fn => e => { e.stopPropagation(); e.currentTarget.blur(); fn(); };
  $('nav-back').addEventListener('click', stop(() => socket.emit(gs && gs.phase === 'result' ? 'back' : 'abort')));
  $('nav-next').addEventListener('click', stop(() => { if (gs) socket.emit(gs.phase === 'teams' ? 'begin' : gs.phase === 'intro' ? 'skip' : gs.phase === 'result' ? 'back' : ''); }));
  $('nav-replay').addEventListener('click', stop(() => socket.emit('replay')));
  $('nav-leave').addEventListener('click', stop(() => { if (confirm('الخروج من هذه الغرفة وفتح غرفة جديدة؟ ستُفقد النقاط.')) { saved.set(null); location.href = '/host'; } }));
  $('nav-mute').addEventListener('click', stop(() => { Sfx.unlock(); $('nav-mute').textContent = Sfx.toggleMute() ? 'تشغيل الصوت' : 'كتم الصوت'; }));
  $('nav-full').addEventListener('click', stop(() => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); }));
  setInterval(() => { $('nav-back').disabled = !gs; $('nav-next').disabled = !gs || gs.phase === 'play'; $('nav-replay').disabled = !gs || gs.phase !== 'result'; }, 250);

  socket.on('connect', connect);
  socket.on('lobby', d => { if (lobby && d.players.length > lobby.players.length) Sfx.play('join'); lobby = d; if (d.phase === 'lobby') gs = null; });
  socket.on('state', d => { hear(gs, d); gs = d; });

  // ---- sound: every effect is derived from how the game state changed since the last update ----
  let lastHop = 0; const S_t = () => performance.now() / 1000;
  const hexd = (a, b) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
  const AMBIENT = { honeycomb: 'cave', stones: 'water', bridge: 'wind', avalanche: 'wind', rollers: 'water', dragon: 'water', mushroom: 'water' };
  const HEAR = {
    honeycomb(a, b, P) {
      if (a.runner.q !== b.runner.q || a.runner.r !== b.runner.r) P('step');
      if (b.mons.some((m, i) => m.q !== a.mons[i].q || m.r !== a.mons[i].r)) P('creep');
      const near = v => v.mons.some(m => hexd(m, v.runner) <= 1);
      if (near(b) && !near(a)) P('growl');
    },
    stones(a, b, P) { if ((b.jump && !a.jump) || (b.fin && !a.fin)) P('jump'); if (b.splash && !a.splash) P('splash'); if (b.row > a.row) P('land'); if (a.phase === 'setup' && b.phase === 'run') P('go'); },
    bridge(a, b, P) {
      const hits = v => v.balls.filter(x => x.hit).length, flying = v => v.balls.filter(x => x.t < 0.2).length;
      if (flying(b) > flying(a)) P('cannon');
      if (hits(b) > hits(a)) P('bonk');
      if (Math.abs(b.b) > 0.65 && Math.abs(a.b) <= 0.65) P('creak');
    },
    knock(a, b, P) { if (b.anim && !a.anim) P('charge'); if (b.anim && b.anim.res && !(a.anim && a.anim.res)) P(b.anim.res === 'ok' ? 'rip' : 'thud'); if (a.phase === 'setup' && b.phase === 'run') P('go'); },
    avalanche(a, b, P) { if (b.boul.length > a.boul.length) P('rumble'); if (b.hid !== a.hid) P('door'); if (b.run && Math.floor(b.time * 4) !== Math.floor(a.time * 4)) P('step'); },
    rollers(a, b, P) { if (b.air && !a.air) P('jump'); if (a.air && !b.air) P('land'); if (b.om.some((o, i) => o !== a.om[i])) P('creak'); },
    dragon(a, b, P) { if (a.phase !== b.phase) P(b.phase === 'done' ? (b.ok ? 'land' : 'splash') : 'whoosh'); if (b.gusts.length > a.gusts.length) P('gust'); },
    mushroom(a, b, P) { b.ps.forEach((p, i) => { if (p.st !== a.ps[i].st) P(p.st === 'fly' ? 'whoosh' : p.st === 'safe' ? 'land' : 'splash'); }); },
    hands(a, b, P) {
      if (b.round !== a.round) P('card');
      if (Object.keys(b.picks).length > Object.keys(a.picks).length) { P('slap'); P(b.winner && !a.winner ? 'correct' : 'wrong'); }
    },
    tug(a, b, P) {
      if (a.phase === 'ready' && b.phase === 'pull') P('go');
      if (Math.floor(b.pos * 8) !== Math.floor(a.pos * 8)) P('creak');
      if (b.pulls[0] + b.pulls[1] > a.pulls[0] + a.pulls[1] && Math.floor(b.time * 5) !== Math.floor(a.time * 5)) P('step');
      if (b.winner >= 0 && a.winner === undefined) { P('splash'); P('cheer'); }
    },
    sumo(a, b, P) {
      if (a.phase !== 'fight' && b.phase === 'fight') P('go');
      if (b.phase === 'fight' && Math.floor(b.pos * 7) !== Math.floor(a.pos * 7)) P('slap');
      if (a.phase === 'fight' && b.phase === 'end') { P('thud'); P('cheer'); }
    },
    skittles(a, b, P) {
      if (a.phase === 'aim' && b.phase === 'roll') P('rumble');
      const down = v => v.pins.filter(p => !p.up).length;
      if (down(b) > down(a)) { P('strike'); if (b.pins.every(p => !p.up)) P('cheer'); }
      else if (a.ball.y < 0.92 && b.ball.y >= 0.92) P('whoosh');
      if (b.pins.some((p, i) => p.up && Math.abs(p.x - a.pins[i].x) > 0.02) && Math.floor(S_t() * 3) !== lastHop) { lastHop = Math.floor(S_t() * 3); P('jump'); }
    },
    showdown(a, b, P) { if (b.shots.length > a.shots.length) P('squirt'); if (b.fx.length > a.fx.length) P('hit'); if (b.tanks.filter(t => t.alive).length < a.tanks.filter(t => t.alive).length) P('rip'); },
  };
  function hear(p, d) {
    if (!p || p.seq !== d.seq) return Sfx.play('fanfare');
    if (p.phase === 'play' && p.v && d.v) {
      if (d.v.time !== undefined && d.v.time < 10 && Math.ceil(d.v.time) !== Math.ceil(p.v.time)) Sfx.play('tick');
      try { HEAR[d.gid](p.v, d.v, Sfx.play); } catch (e) {}
    }
    if (p.phase === d.phase) return;
    if (d.phase === 'play') Sfx.play('go');
    else if (d.phase === 'result') Sfx.play(d.over.champion || d.final ? 'champion' : (d.kind === 'runner' ? d.over.win : Object.keys(d.awards || {}).length) ? 'win' : 'lose');
  }
  // Mandatory start button: browsers keep audio locked until the first click.
  const startEl = document.getElementById('start');
  startEl.querySelector('button').addEventListener('click', e => { e.stopPropagation(); Sfx.unlock(); Sfx.play('fanfare'); startEl.remove(); });

  const toLogical = e => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; };
  cv.addEventListener('mousemove', e => { mouse = toLogical(e); });
  cv.addEventListener('click', e => {
    const [x, y] = toLogical(e);
    const h = hits.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    if (h && h.act) return socket.emit(h.act, h.arg);
    if (gs) { if (gs.phase === 'intro') socket.emit('skip'); return; }
    if (h) socket.emit('pick', { game: h.id });
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') socket.emit('abort'); if (e.key === 'f') document.documentElement.requestFullscreen?.(); if (e.key === 'm' || e.key === 'M' || e.key === 'ة') Sfx.toggleMute(); });

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
      if (lobby.teamMode) A.txt(c, lobby.teamNames[p.team], x + 115, y + 16, 19, { hand: true, bold: true, color: p.team ? P.slate : P.brick, max: 210 });
      else if (lobby.champion === p.id) A.txt(c, 'البطل', x + 115, y + 16, 20, { color: P.brick, bold: true });
    }
    const limit = lobby.target ? `الفوز عند ${lobby.target} نقطة` : 'بدون حد للنقاط';
    const teamsLine = lobby.teamMode ? `   ·   ${lobby.teamNames[0]} ${lobby.teamTotals[0]} — ${lobby.teamTotals[1]} ${lobby.teamNames[1]}` : '';
    A.txt(c, lobby.players.length ? `★ عريف الحفل يختار اللعبة والإعدادات من جهازه   ·   ${limit}${teamsLine}` : 'بانتظار انضمام أول متسابق…', 800, 438, 25, { hand: true, max: 1480 });
    // programme of ten games
    hits = [];
    lobby.games.forEach((g, i) => {
      const x = 60 + (4 - (i % 5)) * 300, y = 462 + Math.floor(i / 5) * 138, w = 280, h = 126; // first ticket on the right
      const hot = mouse[0] >= x && mouse[0] <= x + w && mouse[1] >= y && mouse[1] <= y + h;
      const tint = [P.sienna, P.slate, P.moss, P.ochre, P.plum, P.teal, P.rose, P.brick, P.sand, P.umber, P.moss, P.plum, P.slate][i % 13];
      A.wash(c, A.rect(x, y, w, h), tint, 40 + i, { alpha: hot ? 0.42 : 0.24, amp: hot ? 6 : 4 }); A.ink(c, A.rect(x, y, w, h), 60 + i, { closed: true, w: hot ? 4 : 2.4 });
      A.txt(c, String(g.num), x + w - 16, y + 24, 24, { align: 'right', bold: true });
      if (lobby.levels[g.id] > 1) A.txt(c, 'م' + lobby.levels[g.id], x + w - 50, y + 24, 18, { align: 'right', hand: true, color: P.brick });
      A.txt(c, g.tag || (g.kind === 'runner' ? 'واحد ضد الجميع' : 'الكل ضد الكل'), x + 14, y + 24, 19, { align: 'left', hand: true });
      A.txt(c, g.name, x + w / 2, y + 58, 28, { bold: true, max: w - 24 });
      A.wrap(c, g.blurb, x + w / 2, y + 88, 16, w - 24, { hand: true, alpha: 0.85 });
      hits.push({ x, y, w, h, id: g.id });
    });
  }

  // "Choose your side": the screen splits right / left and fills up as phones pick.
  function drawTeams(t) {
    const ps = lobby.players.filter(p => p.on), sides = gs.sides;
    A.txt(c, gs.gname, 800, 92, 76, { bold: true, max: 1300 });
    A.txt(c, `المرحلة ${gs.level} من ${gs.maxLevel}   ` + '●'.repeat(gs.level) + '○'.repeat(gs.maxLevel - gs.level), 800, 168, 32, { hand: true, color: gs.level > 3 ? P.brick : A.INK });
    const row = (list, cx, y) => list.forEach((p, i) => { const x = cx + (i - (list.length - 1) / 2) * 150; A.stick(c, x, y, 1.35, { ci: p.ci, emo: 'grit', pose: 'cheer', t: t + i }); A.txt(c, p.name, x, y + 34, 30, { hand: true, bold: true, max: 140 }); });
    if (sides) {
      [[820, P.brick, 0], [60, P.slate, 1]].forEach(([x, tint, k]) => {
        A.wash(c, A.rect(x, 215, 720, 500), tint, 300 + k, { alpha: 0.16, amp: 7 }); A.ink(c, A.rect(x, 215, 720, 500), 302 + k, { closed: true, w: 3 });
        A.txt(c, sides[k], x + 360, 275, 58, { bold: true, max: 660 });
        const mine = ps.filter(p => gs.picks[p.id] === k);
        if (mine.length) row(mine, x + 360, 560); else A.txt(c, 'لا أحد بعد', x + 360, 500, 30, { hand: true, alpha: 0.5 });
      });
      A.txt(c, 'ضد', 800, 465, 40, { hand: true, bold: true });
      const idle = ps.filter(p => !(p.id in gs.picks));
      idle.forEach((p, i) => { const x = 800 + (i - (idle.length - 1) / 2) * 110; A.stick(c, x, 800, 0.7, { ci: p.ci, emo: 'scared', t: t + i }); A.txt(c, p.name, x, 822, 20, { hand: true }); });
      if (idle.length) A.txt(c, 'لم يختاروا بعد:', 800 + idle.length * 55 + 90, 780, 24, { hand: true, alpha: 0.7 });
      if (gs.kind === 'runner') A.txt(c, 'إن اختار أكثر من لاعب الجهة اليمنى نختار واحداً بالقرعة، وإن لم يخترها أحد نختار بالدور.', 800, 742, 22, { hand: true, alpha: 0.75 });
    } else { A.txt(c, 'الكل ضد الكل', 800, 300, 58, { bold: true }); row(ps, 800, 580); }
    A.txt(c, `اختاروا من هواتفكم — يبدأ العريف اللعبة، أو تبدأ تلقائياً بعد ${Math.ceil(gs.left)}`, 1540, 866, 26, { hand: true, align: 'right' });
  }

  function drawIntro(t) {
    A.wash(c, A.rect(200, 120, 1200, 660), P.ochre, 71, { alpha: 0.2, amp: 8 }); A.ink(c, A.rect(200, 120, 1200, 660), 72, { closed: true, w: 4 }); A.ink(c, A.rect(216, 136, 1168, 628), 73, { closed: true, w: 1.3, alpha: 0.5 });
    A.txt(c, `اللعبة رقم ${gs.num}   ·   المرحلة ${gs.level} من ${gs.maxLevel}`, 800, 190, 34);
    A.txt(c, gs.gname.toUpperCase(), 800, 270, 92, { bold: true, max: 1100 });
    A.wrap(c, gs.blurb, 800, 350, 38, 1000, { hand: true });
    if (gs.runnerId) {
      const r = who(gs.runnerId);
      A.stick(c, 400, 640, 1.8, { ci: r.ci, emo: 'scared', t, pose: 'stand' });
      A.txt(c, gs.gid === 'skittles' ? 'صاحب الكرة' : 'العدّاء', 400, 680, 26); A.txt(c, r.name, 400, 722, 46, { hand: true, bold: true });
      A.txt(c, 'العدّاء', 1330, 466, 30, { align: 'right', bold: true }); A.wrap(c, gs.runnerTip, 1330, 506, 30, 720, { hand: true, align: 'right' });
      A.txt(c, 'البقية', 1330, 606, 30, { align: 'right', bold: true }); A.wrap(c, gs.othersTip, 1330, 646, 30, 720, { hand: true, align: 'right' });
    } else {
      lobby.players.filter(p => p.on).forEach((p, i, a) => A.stick(c, 800 + (i - (a.length - 1) / 2) * 120, 690, 1.2, { ci: p.ci, emo: 'grit', t: t + i, pose: 'cheer' }));
      A.wrap(c, gs.runnerTip, 800, 470, 30, 1000, { hand: true });
    }
    A.txt(c, `تبدأ بعد ${Math.ceil(gs.left)}…`, 800, 820, 32, { hand: true });
  }

  function drawResult(t) {
    const fin = gs.final, winner = fin && fin.id ? who(fin.id) : null;
    const champ = winner || (gs.over.champion && who(gs.over.champion)), big = champ || fin;
    const ps = lobby.players.slice().sort((a, b) => b.score - a.score);
    // A champion gets the full card; otherwise a low banner so the scene's ending stays visible.
    const box = big ? [300, 110, 1000, 700] : [200, 104, 1200, 250];
    c.fillStyle = big ? 'rgba(234,223,198,0.7)' : 'rgba(234,223,198,0.25)'; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(243,234,214,0.93)'; c.fillRect(...box);
    A.wash(c, A.rect(...box), P.ochre, 81, { alpha: 0.1, amp: 6 }); A.ink(c, A.rect(...box), 82, { closed: true, w: 4 });
    let y;
    if (big) {
      A.txt(c, fin ? `الفائز بالبطولة — بلغ ${fin.score} نقطة` : 'بطل القلعة', 800, 180, 50, { bold: true, color: P.brick });
      if (champ) A.stick(c, 800, 470, 2.2, { ci: champ.ci, emo: 'happy', pose: 'cheer', t });
      else lobby.players.filter(p => p.team === fin.team).forEach((p, i, a) => A.stick(c, 800 + (i - (a.length - 1) / 2) * 130, 460, 1.6, { ci: p.ci, emo: 'happy', pose: 'cheer', t: t + i }));
      A.txt(c, champ ? champ.name : fin.name, 800, 525, 70, { hand: true, bold: true });
      A.wrap(c, gs.over.text, 800, 590, 30, 900, { hand: true });
      y = 720;
    } else { A.wrap(c, gs.over.text, 800, 156, 44, 1100, { hand: true, bold: true }); y = 312; }
    ps.forEach((p, i) => {
      const x = 800 + (i - (ps.length - 1) / 2) * 180, got = gs.awards[p.id];
      A.stick(c, x - 62, y + 22, 0.6, { ci: p.ci, emo: got ? 'happy' : 'sad', pose: got ? 'cheer' : 'stand', t: t + i });
      A.txt(c, p.name, x - 34, y - 14, 28, { hand: true, bold: true, align: 'left', max: 130 });
      A.txt(c, p.score + ' نقطة' + (got ? ` \u2066(+${got})\u2069` : ''), x - 34, y + 14, 19, { align: 'left', color: got ? P.moss : A.INK });
    });
    if (lobby.teamMode) A.txt(c, `${lobby.teamNames[0]} ${lobby.teamTotals[0]} — ${lobby.teamTotals[1]} ${lobby.teamNames[1]}`, box[0] + 20, box[1] + 24, 21, { hand: true, bold: true, align: 'left' });
    // the two choices after every game
    hits = [{ x: 810, y: box[1] + box[3] + 14, w: 330, h: 64, act: 'replay', label: 'إعادة اللعبة ↻' }, { x: 460, y: box[1] + box[3] + 14, w: 330, h: 64, act: 'back', label: 'الصفحة الرئيسية' }];
    if (big) hits.forEach(b => { b.y = box[1] + box[3] - 78; });
    hits.forEach((b, i) => {
      const hot = mouse[0] >= b.x && mouse[0] <= b.x + b.w && mouse[1] >= b.y && mouse[1] <= b.y + b.h;
      c.fillStyle = 'rgba(243,234,214,0.95)'; c.fillRect(b.x, b.y, b.w, b.h);
      A.wash(c, A.rect(b.x, b.y, b.w, b.h), i ? P.slate : P.moss, 85 + i, { alpha: hot ? 0.5 : 0.3, amp: 3 }); A.ink(c, A.rect(b.x, b.y, b.w, b.h), 87 + i, { closed: true, w: hot ? 4 : 2.6 });
      A.txt(c, b.label, b.x + b.w / 2, b.y + b.h / 2, 30, { bold: true });
    });
  }

  function frame() {
    const t = (performance.now() - t0) / 1000;
    c.drawImage(paper, 0, 0);
    Sfx.ambient(gs && gs.phase === 'play' ? AMBIENT[gs.gid] : null);
    Sfx.music(!lobby ? null : !gs ? 'lobby' : gs.phase === 'result' ? null : 'game');
    if (!lobby) A.txt(c, 'نفتح أبواب القلعة…', 800, 450, 48, { hand: true });
    if (gs && gs.phase !== 'result') hits = [];
    if (!lobby) {} else if (!gs) drawLobby(t);
    else if (gs.phase === 'teams') drawTeams(t);
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
      A.txt(c, `${gs.num}.  ${gs.gname}  ·  المرحلة ${gs.level}`, 40, 46, 34, { align: 'left', bold: true });
      if (gs.runnerId) A.txt(c, (gs.gid === 'skittles' ? 'صاحب الكرة: ' : 'العدّاء: ') + who(gs.runnerId).name, 42, 86, 30, { align: 'left', hand: true, bold: true });
      if (gs.v.time !== undefined && gs.phase === 'play') { A.ink(c, A.circ(1510, 56, 44, 14, 34), 90, { closed: true, w: 3 }); A.txt(c, mmss(gs.v.time), 1510, 58, 34, { bold: true, color: gs.v.time < 10 ? P.brick : A.INK }); }
      if (gs.phase === 'result') drawResult(t);
    }
    requestAnimationFrame(frame);
  }
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(frame, frame);
})();

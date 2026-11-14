// Paper Castle — lobby, rooms and the authoritative 30 Hz game loop.
const express = require('express');
const http = require('http');
const os = require('os');
const path = require('path');
const { Server } = require('socket.io');
const GAMES = require('./games');

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 6;
const INTRO_SECONDS = 7;
const RESULT_SECONDS = 120;
const TEAMS_SECONDS = 45;
const MAX_LEVEL = 6; // the base stage plus five harder ones
const TARGETS = [0, 10, 20, 30, 50];
const BY_ID = Object.fromEntries(GAMES.map(g => [g.id, g]));

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Lists the recordings present in public/sounds so clients only request files that exist.
app.get('/sounds/index.json', (req, res) => {
  require('fs').readdir(path.join(__dirname, '..', 'public', 'sounds'), (err, files) =>
    res.json(err ? [] : files.filter(f => /\.(mp3|ogg|wav|m4a)$/i.test(f))));
});
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'play.html')));

const rooms = new Map();

function lanUrls() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces()))
    for (const n of list || [])
      if (n.family === 'IPv4' && !n.internal) out.push(`http://${n.address}:${PORT}`);
  return out;
}

function newRoom() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do code = Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join('');
  while (rooms.has(code));
  const room = {
    code, players: new Map(), game: null, turn: 0, seq: 0, champion: null, idle: 0, hostStr: '',
    target: 0, teamMode: false, teamNames: ['الفريق الأحمر', 'الفريق الأزرق'], levels: {},
  };
  rooms.set(code, room);
  return room;
}

const vipOf = room => [...room.players.values()].find(p => p.on) || null;
const gameList = GAMES.map((g, i) => ({ id: g.id, name: g.name, kind: g.kind, tag: g.tag, blurb: g.blurb, num: i + 1 }));
const online = room => [...room.players.values()].filter(p => p.on);
const teamTotals = room => [0, 1].map(t => [...room.players.values()].filter(p => p.team === t).reduce((a, p) => a + p.score, 0));

// What the two halves of the "choose your side" screen mean for this game (null = no sides).
function sidesOf(room, mod) {
  if (mod.kind === 'runner') return mod.sides || ['الهارب', 'المهاجمون'];
  if (mod.teams) return room.teamMode ? room.teamNames : ['الفريق الأيمن', 'الفريق الأيسر'];
  return null;
}

// Step 1: a game is chosen. Everyone picks a side and the host may change the stage.
function startGame(room, gid) {
  const mod = BY_ID[gid];
  if (!mod || (room.game && room.game.phase !== 'result')) return;
  if (!online(room).length) return;
  room.champion = null;
  const picks = {};
  if (mod.teams && room.teamMode) for (const p of online(room)) picks[p.id] = p.team; // start from the lobby teams
  room.game = { mod, phase: 'teams', t: 0, seq: ++room.seq, picks, level: room.levels[gid] || 1, awards: {}, G: null, s: null };
}

// Step 2: sides are locked in and the game itself is built.
function beginGame(room) {
  const g = room.game, mod = g.mod, ps = online(room);
  if (!ps.length) { room.game = null; return; }
  let runnerId = null;
  if (mod.kind === 'runner') {
    const want = ps.filter(p => g.picks[p.id] === 0), open = ps.filter(p => g.picks[p.id] !== 1);
    if (want.length) runnerId = want[Math.floor(Math.random() * want.length)].id; // several volunteers: draw lots
    else { const pool = open.length ? open : ps; runnerId = pool[room.turn++ % pool.length].id; }
  }
  const G = {
    players: ps.map(p => ({ id: p.id, name: p.name })),
    ids: ps.map(p => p.id),
    runnerId,
    others: ps.filter(p => p.id !== runnerId).map(p => p.id),
    level: g.level,
  };
  if (mod.teams) {
    const teams = [[], []]; // teams[1] plays on the right, like side 0 on the choosing screen
    for (const p of ps) if (g.picks[p.id] === 0 || g.picks[p.id] === 1) teams[g.picks[p.id] === 0 ? 1 : 0].push(p.id);
    for (const p of ps) if (!(p.id in g.picks)) teams[teams[0].length <= teams[1].length ? 0 : 1].push(p.id);
    const names = sidesOf(room, mod);
    G.teams = teams; G.teamNames = [names[1], names[0]];
  }
  g.G = G; g.s = mod.create(G); g.phase = 'intro'; g.t = 0;
}

function finish(room) {
  const g = room.game;
  const over = g.s.over;
  const awards = {};
  if (g.mod.kind === 'runner') {
    if (over.win) awards[g.G.runnerId] = 3;
    else for (const id of g.G.others) awards[id] = 1;
  } else Object.assign(awards, over.pts || {});
  for (const [id, n] of Object.entries(awards)) {
    const p = room.players.get(id);
    if (p) p.score += n;
  }
  if (over.champion && room.players.get(over.champion)) room.champion = over.champion;
  room.levels[g.mod.id] = Math.min(MAX_LEVEL, g.level + 1); // next time this game is one stage harder
  // Optional score limit: the first player (or team) to reach it wins the whole evening.
  g.final = null;
  if (room.target > 0) {
    if (room.teamMode) {
      const tot = teamTotals(room), best = Math.max(...tot);
      if (best >= room.target && tot[0] !== tot[1]) { const t = tot[0] > tot[1] ? 0 : 1; g.final = { name: room.teamNames[t], team: t, score: best }; }
    } else {
      const top = [...room.players.values()].sort((a, b) => b.score - a.score);
      if (top[0] && top[0].score >= room.target && (!top[1] || top[1].score < top[0].score)) { g.final = { name: top[0].name, id: top[0].id, score: top[0].score }; room.champion = top[0].id; }
    }
  }
  g.awards = awards;
  g.phase = 'result';
  g.t = 0;
}

function tickRoom(room, dt) {
  const g = room.game;
  if (g) {
    g.t += dt;
    if (g.phase === 'teams') {
      if (g.t > TEAMS_SECONDS) beginGame(room); // otherwise the host presses «ابدأ»
    } else if (g.phase === 'intro' && g.t > INTRO_SECONDS) { g.phase = 'play'; g.t = 0; }
    else if (g.phase === 'play') {
      try { g.mod.tick(g.s, dt, g.G); } catch (e) { console.error(e); g.s.over = { win: false, pts: {}, text: 'تعطّلت اللعبة.' }; }
      if (g.s.over) finish(room);
    } else if (g.phase === 'result' && g.t > RESULT_SECONDS) room.game = null;
  }
  broadcast(room);
}

function broadcast(room) {
  const g = room.game;
  const vip = vipOf(room);
  const settings = { target: room.target, teamMode: room.teamMode, teamNames: room.teamNames, teamTotals: teamTotals(room) };
  const lobby = {
    code: room.code,
    phase: g ? g.phase : 'lobby',
    champion: room.champion,
    games: gameList, levels: room.levels,
    ...settings,
    players: [...room.players.values()].map(p => ({ id: p.id, name: p.name, ci: p.ci, score: p.score, on: p.on, vip: p === vip, team: p.team })),
  };
  const ls = JSON.stringify(lobby);
  if (ls !== room.hostStr) { room.hostStr = ls; io.to(room.code + ':host').emit('lobby', lobby); }

  const sides = g ? sidesOf(room, g.mod) : null;
  if (g) {
    const common = { seq: g.seq, gid: g.mod.id, gname: g.mod.name, num: GAMES.indexOf(g.mod) + 1, kind: g.mod.kind, blurb: g.mod.blurb, phase: g.phase, t: g.t, level: g.level, maxLevel: MAX_LEVEL };
    if (g.phase === 'teams') io.to(room.code + ':host').emit('state', { ...common, sides, picks: g.picks, left: TEAMS_SECONDS - g.t, v: null });
    else io.to(room.code + ':host').emit('state', {
      ...common, runnerTip: g.mod.runnerTip, othersTip: g.mod.othersTip,
      left: g.phase === 'intro' ? INTRO_SECONDS - g.t : 0,
      runnerId: g.G.runnerId, ids: g.G.ids, others: g.G.others, v: g.mod.view(g.s, g.G),
      over: g.phase === 'result' ? g.s.over : null, awards: g.awards, final: g.final,
    });
  }

  for (const p of room.players.values()) {
    if (!p.sock) continue;
    const me = { name: p.name, ci: p.ci, score: p.score, team: p.team };
    let d;
    if (!g) d = { phase: 'lobby', me, vip: p === vip, n: room.players.size, games: gameList, code: room.code, champion: room.champion === p.id, ...settings, targets: TARGETS };
    else if (g.phase === 'teams') d = { phase: 'teams', gid: g.mod.id, gname: g.mod.name, seq: g.seq, me, vip: p === vip, sides, pick: p.id in g.picks ? g.picks[p.id] : -1, level: g.level, maxLevel: MAX_LEVEL, counts: [0, 1].map(k => Object.values(g.picks).filter(x => x === k).length) };
    else if (!g.G.ids.includes(p.id)) d = { phase: 'wait', me };
    else {
      const role = g.mod.kind === 'all' ? 'all' : p.id === g.G.runnerId ? 'runner' : 'other';
      const base = { phase: g.phase, gid: g.mod.id, gname: g.mod.name, role, seq: g.seq, me, vip: p === vip, level: g.level };
      if (g.phase === 'intro') d = { ...base, tip: role === 'other' ? g.mod.othersTip : g.mod.runnerTip };
      else if (g.phase === 'play') d = { ...base, v: g.mod.pview(g.s, p.id, g.G) };
      else d = { ...base, text: g.s.over.text, got: g.awards[p.id] || 0, champion: room.champion === p.id, final: g.final };
    }
    const s = JSON.stringify(d);
    if (s !== p.last) { p.last = s; p.sock.emit('p', d); }
  }
}

io.on('connection', sock => {
  const ctx = () => {
    const room = rooms.get(sock.data.code);
    if (!room) return {};
    const player = sock.data.pid ? room.players.get(sock.data.pid) : null;
    const boss = sock.data.host || (player && player === vipOf(room));
    return { room, player, boss };
  };

  sock.on('host:create', (m, cb) => {
    const room = (m && m.code && rooms.get(String(m.code).toUpperCase())) || newRoom();
    sock.join(room.code + ':host');
    sock.data.code = room.code;
    sock.data.host = true;
    room.hostStr = '';
    if (typeof cb === 'function') cb({ code: room.code, urls: lanUrls() });
  });

  sock.on('join', (m, cb) => {
    if (typeof cb !== 'function') return;
    const room = rooms.get(String((m && m.code) || '').trim().toUpperCase());
    if (!room) return cb({ error: 'لا توجد غرفة بهذا الرمز. تأكّد من الرمز على الشاشة الكبيرة.' });
    const name = String((m && m.name) || '').trim().slice(0, 12);
    const device = m.device ? String(m.device).slice(0, 40) : null;
    const all = [...room.players.values()];
    // A returning player gets their seat and score back: same room token, same phone,
    // or — if their seat is currently empty — simply the same name.
    let p = (m.token && all.find(x => x.token === m.token)) || (device && all.find(x => x.device === device)) || (name && all.find(x => !x.on && x.name === name));
    if (!p) {
      if (!name) return cb({ error: 'اكتب اسمك من فضلك.' });
      if (room.game) return cb({ error: 'اللعبة جارية الآن — انضمّ عند العودة إلى الردهة.' });
      if (room.players.size >= MAX_PLAYERS) return cb({ error: 'الغرفة ممتلئة (6 لاعبين).' });
      const used = new Set(all.map(x => x.ci));
      let ci = 0; while (used.has(ci)) ci++;
      const id = 'p' + Math.random().toString(36).slice(2, 9);
      const team = all.filter(x => x.team === 0).length <= all.filter(x => x.team === 1).length ? 0 : 1;
      p = { id, name, ci, team, score: 0, token: Math.random().toString(36).slice(2) + Date.now().toString(36), on: true, sock: null, last: '', away: 0 };
      room.players.set(id, p);
    } else if (p.sock && p.sock !== sock) p.sock.disconnect(true);
    p.on = true; p.sock = sock; p.last = ''; p.away = 0; p.left = false;
    if (device) p.device = device;
    sock.data.code = room.code;
    sock.data.pid = p.id;
    cb({ ok: true, id: p.id, token: p.token, code: room.code, name: p.name });
  });

  sock.on('pick', m => { const { room, boss } = ctx(); if (room && boss && m) startGame(room, m.game); });
  sock.on('replay', () => { const { room, boss } = ctx(); if (room && boss && room.game && room.game.phase === 'result') startGame(room, room.game.mod.id); });
  sock.on('begin', () => { const { room, boss } = ctx(); if (room && boss && room.game && room.game.phase === 'teams') beginGame(room); });
  sock.on('level', m => { const { room, boss } = ctx(); const g = room && room.game; if (g && boss && g.phase === 'teams' && m) g.level = Math.max(1, Math.min(MAX_LEVEL, g.level + (m.d > 0 ? 1 : -1))); });
  sock.on('side', m => {
    const { room, player } = ctx(); const g = room && room.game;
    if (!g || !player || g.phase !== 'teams' || !m || !sidesOf(room, g.mod)) return;
    g.picks[player.id] = m.side ? 1 : 0;
    if (g.mod.teams && room.teamMode) player.team = g.picks[player.id];
  });
  // Lobby settings: score limit, team mode, team names, score reset (host or Master of Ceremonies).
  sock.on('set', m => {
    const { room, boss } = ctx();
    if (!room || !boss || room.game || !m || typeof m !== 'object') return;
    if (TARGETS.includes(m.target)) room.target = m.target;
    if (typeof m.teamMode === 'boolean') room.teamMode = m.teamMode;
    if (Array.isArray(m.teamNames)) m.teamNames.slice(0, 2).forEach((n, i) => { n = String(n || '').trim().slice(0, 14); if (n) room.teamNames[i] = n; });
    if (m.reset) { for (const p of room.players.values()) p.score = 0; room.champion = null; room.levels = {}; }
  });
  sock.on('team', m => { const { room, player } = ctx(); if (room && player && !room.game && m) player.team = m.team ? 1 : 0; });
  sock.on('skip', () => { const { room, boss } = ctx(); if (room && boss && room.game && room.game.phase === 'intro') { room.game.phase = 'play'; room.game.t = 0; } });
  sock.on('back', () => { const { room, boss } = ctx(); if (room && boss && room.game && room.game.phase === 'result') room.game = null; });
  // A player walks out for good: forget their seat so the same phone can join afresh.
  sock.on('leave', () => {
    const { room, player } = ctx();
    if (!player) return;
    player.on = false; player.sock = null; player.token = null; player.device = null; player.left = true;
    sock.data.pid = null;
    if (!room.game) room.players.delete(player.id);
  });
  sock.on('abort', () => { const { room, boss } = ctx(); if (room && boss) room.game = null; });

  sock.on('in', m => {
    const { room, player } = ctx();
    const g = room && room.game;
    if (!g || !player || g.phase !== 'play' || !g.G.ids.includes(player.id) || !m || typeof m !== 'object') return;
    try { g.mod.input(g.s, player.id, m, g.G); } catch (e) { console.error(e); }
    if (g.s.over) finish(room);
  });

  sock.on('disconnect', () => {
    const { room, player } = ctx();
    if (player && player.sock === sock) { player.on = false; player.sock = null; }
    if (room) room.hostStr = '';
  });
});

let last = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  for (const room of rooms.values()) {
    // Seats are kept for half an hour so a player who closes the browser can come back to
    // their name and score. Rooms nobody is watching are dropped after ten minutes.
    for (const p of [...room.players.values()]) {
      p.away = p.on ? 0 : p.away + dt;
      if (!room.game && (p.away > 1800 || p.left)) room.players.delete(p.id);
    }
    const hosts = io.sockets.adapter.rooms.get(room.code + ':host');
    const live = (hosts && hosts.size) || [...room.players.values()].some(p => p.on);
    room.idle = live ? 0 : room.idle + dt;
    if (room.idle > 600) { rooms.delete(room.code); continue; }
    tickRoom(room, dt);
  }
}, 1000 / 30);

server.listen(PORT, () => {
  console.log(`Paper Castle is open.\n  Main screen:  http://localhost:${PORT}/host`);
  for (const u of lanUrls()) console.log(`  Players join: ${u}`);
});

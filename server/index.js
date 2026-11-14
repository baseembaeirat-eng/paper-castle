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
const RESULT_SECONDS = 15;
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
  const room = { code, players: new Map(), game: null, turn: 0, seq: 0, champion: null, idle: 0, hostStr: '' };
  rooms.set(code, room);
  return room;
}

const vipOf = room => [...room.players.values()].find(p => p.on) || null;
const gameList = GAMES.map((g, i) => ({ id: g.id, name: g.name, kind: g.kind, tag: g.tag, blurb: g.blurb, num: i + 1 }));

function startGame(room, gid) {
  const mod = BY_ID[gid];
  if (!mod || room.game) return;
  const ps = [...room.players.values()].filter(p => p.on);
  if (!ps.length) return;
  let runnerId = null;
  if (mod.kind === 'runner') runnerId = ps[room.turn++ % ps.length].id;
  const G = {
    players: ps.map(p => ({ id: p.id, name: p.name })),
    ids: ps.map(p => p.id),
    runnerId,
    others: ps.filter(p => p.id !== runnerId).map(p => p.id),
  };
  room.champion = null;
  room.game = { mod, G, s: mod.create(G), phase: 'intro', t: 0, seq: ++room.seq, awards: {} };
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
  g.awards = awards;
  g.phase = 'result';
  g.t = 0;
}

function tickRoom(room, dt) {
  const g = room.game;
  if (g) {
    g.t += dt;
    if (g.phase === 'intro' && g.t > INTRO_SECONDS) { g.phase = 'play'; g.t = 0; }
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
  const lobby = {
    code: room.code,
    phase: g ? g.phase : 'lobby',
    champion: room.champion,
    games: gameList,
    players: [...room.players.values()].map(p => ({ id: p.id, name: p.name, ci: p.ci, score: p.score, on: p.on, vip: p === vip })),
  };
  const ls = JSON.stringify(lobby);
  if (ls !== room.hostStr) { room.hostStr = ls; io.to(room.code + ':host').emit('lobby', lobby); }

  if (g) {
    io.to(room.code + ':host').emit('state', {
      seq: g.seq, gid: g.mod.id, gname: g.mod.name, num: GAMES.indexOf(g.mod) + 1, kind: g.mod.kind,
      blurb: g.mod.blurb, runnerTip: g.mod.runnerTip, othersTip: g.mod.othersTip,
      phase: g.phase, t: g.t, left: g.phase === 'intro' ? INTRO_SECONDS - g.t : 0,
      runnerId: g.G.runnerId, ids: g.G.ids, others: g.G.others, v: g.mod.view(g.s, g.G),
      over: g.phase === 'result' ? g.s.over : null, awards: g.awards,
    });
  }

  for (const p of room.players.values()) {
    if (!p.sock) continue;
    const me = { name: p.name, ci: p.ci, score: p.score };
    let d;
    if (!g) d = { phase: 'lobby', me, vip: p === vip, n: room.players.size, games: gameList, code: room.code, champion: room.champion === p.id };
    else if (!g.G.ids.includes(p.id)) d = { phase: 'wait', me };
    else {
      const role = g.mod.kind === 'all' ? 'all' : p.id === g.G.runnerId ? 'runner' : 'other';
      const base = { phase: g.phase, gid: g.mod.id, gname: g.mod.name, role, seq: g.seq, me, vip: p === vip };
      if (g.phase === 'intro') d = { ...base, tip: role === 'other' ? g.mod.othersTip : g.mod.runnerTip };
      else if (g.phase === 'play') d = { ...base, v: g.mod.pview(g.s, p.id, g.G) };
      else d = { ...base, text: g.s.over.text, got: g.awards[p.id] || 0, champion: room.champion === p.id };
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
    let p = m.token && [...room.players.values()].find(x => x.token === m.token);
    if (!p) {
      if (!name) return cb({ error: 'اكتب اسمك من فضلك.' });
      if (room.game) return cb({ error: 'اللعبة جارية الآن — انضمّ عند العودة إلى الردهة.' });
      if (room.players.size >= MAX_PLAYERS) return cb({ error: 'الغرفة ممتلئة (6 لاعبين).' });
      const used = new Set([...room.players.values()].map(x => x.ci));
      let ci = 0; while (used.has(ci)) ci++;
      const id = 'p' + Math.random().toString(36).slice(2, 9);
      p = { id, name, ci, score: 0, token: Math.random().toString(36).slice(2) + Date.now().toString(36), on: true, sock: null, last: '', away: 0 };
      room.players.set(id, p);
    } else if (p.sock && p.sock !== sock) p.sock.disconnect(true);
    p.on = true; p.sock = sock; p.last = ''; p.away = 0;
    sock.data.code = room.code;
    sock.data.pid = p.id;
    cb({ ok: true, id: p.id, token: p.token, code: room.code });
  });

  sock.on('pick', m => { const { room, boss } = ctx(); if (room && boss && m) startGame(room, m.game); });
  sock.on('skip', () => { const { room, boss } = ctx(); if (room && boss && room.game && room.game.phase === 'intro') { room.game.phase = 'play'; room.game.t = 0; } });
  sock.on('back', () => { const { room, boss } = ctx(); if (room && boss && room.game && room.game.phase === 'result') room.game = null; });
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
    // Drop players who stay disconnected in the lobby, and rooms nobody is watching.
    for (const p of [...room.players.values()]) {
      p.away = p.on ? 0 : p.away + dt;
      if (!room.game && p.away > 90) room.players.delete(p.id);
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

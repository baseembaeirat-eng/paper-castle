// SoundManager — every sound in the game goes through here.
//
// Each sound first looks for a recording in /public/sounds/ (see FILES below). If the file is
// missing or fails to decode, a synthesised stand-in made with the Web Audio API plays instead,
// so the game is never silent and never breaks. Drop an MP3 with the right name into
// /public/sounds/ and it replaces the synthesised version on the next page load.
//
// Browsers only allow sound after a tap or click, so unlock() must be called from a user gesture.
const SoundManager = (() => {
  let ac = null, master = null, musicBus = null, muted = false, noiseBuf = null, amb = null, ambKind = null;
  let musicKind = null, musicNode = null, musicTimer = null;
  const buffers = {};

  // sound name -> file expected in /public/sounds/
  const FILES = {
    tap: 'click.mp3',            // phone button press
    join: 'join.mp3',            // a player enters the lobby
    fanfare: 'fanfare.mp3',      // a game is announced
    go: 'go.mp3',                // play begins
    tick: 'tick.mp3',            // last ten seconds
    jump: 'jump.mp3',            // boing
    land: 'land.mp3',
    splash: 'splash.mp3',        // into the water
    thud: 'crash.mp3',           // wood / solid door
    rip: 'rip.mp3',              // paper tearing
    bonk: 'bonk.mp3',            // cannonball hit
    cannon: 'cannon.mp3',
    rumble: 'rumble.mp3',        // boulder released
    whoosh: 'whoosh.mp3',
    gust: 'gust.mp3',
    creak: 'creak.mp3',
    charge: 'charge.mp3',
    door: 'door.mp3',
    step: 'step.mp3',
    creep: 'creep.mp3',          // monster moving
    growl: 'growl.mp3',
    card: 'card.mp3',
    slap: 'slap.mp3',
    correct: 'correct.mp3',
    wrong: 'wrong.mp3',
    squirt: 'squirt.mp3',
    hit: 'hit.mp3',
    win: 'win.mp3',              // cheering
    lose: 'lose.mp3',            // sad trombone
    champion: 'champion.mp3',
    'bgm-lobby': 'bgm-lobby.mp3', // calm loop
    'bgm-game': 'bgm-game.mp3',   // high-energy loop
  };

  // Load whichever recordings exist. /sounds/index.json lists the folder so missing files
  // are simply skipped; every failure is swallowed and the synthesised sound stays in place.
  async function load(names) {
    let have = [];
    try { have = await (await fetch('/sounds/index.json')).json(); } catch (e) { return; }
    await Promise.all((names || Object.keys(FILES)).filter(n => have.includes(FILES[n])).map(async n => {
      try {
        const data = await (await fetch('/sounds/' + FILES[n])).arrayBuffer();
        buffers[n] = await new Promise((ok, no) => ac.decodeAudioData(data, ok, no));
        if (n === 'bgm-' + musicKind) { const k = musicKind; music(null); music(k); }
      } catch (e) {}
    }));
  }

  let wanted = null, loading = false;
  function unlock(names) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    if (!ac) {
      ac = new C();
      master = ac.createGain(); master.gain.value = 0.7; master.connect(ac.destination);
      musicBus = ac.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
    }
    if (ac.state === 'suspended') ac.resume();
    if (!loading) { loading = true; load(names || wanted); }
  }
  const only = names => { wanted = names; };
  const ready = () => ac && ac.state === 'running' && !muted;
  const on = () => !!ac && ac.state === 'running';

  function tone(f, d, o = {}) {
    const t = ac.currentTime + (o.at || 0), osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.3, t + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + d + 0.05);
  }
  function buffer() {
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }
  function noise(d, o = {}) {
    const t = ac.currentTime + (o.at || 0), src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = buffer(); src.loop = true;
    f.type = o.type || 'lowpass'; f.Q.value = o.q || 0.8;
    f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.3, t + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random()); src.stop(t + d + 0.05);
  }
  const tune = (notes, step, o = {}) => notes.forEach((f, i) => tone(f, o.len || step * 1.6, { type: 'triangle', vol: 0.22, ...o, at: i * step }));

  const SOUNDS = {
    tap: () => tone(620, 0.05, { type: 'triangle', vol: 0.16 }),
    join: () => tune([523, 784], 0.09),
    fanfare: () => tune([392, 523, 659, 784], 0.13),
    go: () => tone(880, 0.3, { type: 'triangle', vol: 0.25 }),
    tick: () => tone(1000, 0.04, { type: 'square', vol: 0.07 }),
    step: () => noise(0.07, { f: 900, vol: 0.28 }),
    creep: () => noise(0.1, { f: 280, vol: 0.22 }),
    growl: () => { tone(72, 0.8, { type: 'sawtooth', to: 44, vol: 0.28, attack: 0.1 }); noise(0.8, { f: 180, vol: 0.25, attack: 0.15 }); },
    jump: () => tone(300, 0.18, { to: 720, vol: 0.22 }),
    land: () => { noise(0.1, { f: 500, vol: 0.38 }); tone(120, 0.1, { vol: 0.3 }); },
    splash: () => noise(0.65, { type: 'bandpass', f: 1900, to: 380, vol: 0.45, attack: 0.02 }),
    cannon: () => { noise(0.45, { f: 420, to: 80, vol: 0.65 }); tone(92, 0.35, { to: 40, vol: 0.5 }); },
    bonk: () => { tone(230, 0.2, { type: 'square', to: 90, vol: 0.25 }); noise(0.08, { f: 700, vol: 0.3 }); },
    creak: () => tone(170, 0.25, { type: 'sawtooth', to: 250, vol: 0.07 }),
    charge: () => noise(1.0, { f: 300, to: 1600, vol: 0.2, attack: 0.6 }),
    rip: () => noise(0.38, { type: 'highpass', f: 2400, vol: 0.36 }),
    thud: () => { tone(115, 0.4, { to: 40, vol: 0.75 }); noise(0.16, { f: 320, vol: 0.5 }); },
    rumble: () => { noise(1.3, { f: 150, vol: 0.55, attack: 0.25 }); tone(52, 1.1, { vol: 0.3, attack: 0.2 }); },
    door: () => noise(0.13, { f: 600, vol: 0.3 }),
    whoosh: () => noise(0.5, { type: 'bandpass', f: 400, to: 2000, q: 2, vol: 0.32, attack: 0.15 }),
    gust: () => noise(0.75, { type: 'bandpass', f: 900, to: 300, q: 1.5, vol: 0.34, attack: 0.2 }),
    card: () => noise(0.08, { type: 'highpass', f: 3000, vol: 0.2 }),
    slap: () => noise(0.11, { f: 1200, vol: 0.42 }),
    correct: () => tune([660, 990], 0.08),
    wrong: () => tone(200, 0.32, { type: 'sawtooth', to: 135, vol: 0.18 }),
    squirt: () => noise(0.16, { type: 'bandpass', f: 2600, to: 1200, q: 2, vol: 0.22 }),
    hit: () => noise(0.22, { type: 'bandpass', f: 1500, to: 500, vol: 0.34 }),
    win: () => tune([523, 659, 784, 1047], 0.12),
    lose: () => tune([392, 330, 262], 0.2, { len: 0.4 }),
    champion: () => tune([523, 523, 659, 784, 659, 784, 1047], 0.15, { len: 0.35 }),
  };
  function play(name) {
    if (!ready()) return;
    try {
      if (buffers[name]) { const src = ac.createBufferSource(); src.buffer = buffers[name]; src.connect(master); src.start(); }
      else if (SOUNDS[name]) SOUNDS[name]();
    } catch (e) {}
  }

  // ---- background music: 'lobby' (calm), 'game' (lively) or null ----------------------
  // Uses bgm-lobby.mp3 / bgm-game.mp3 when present, otherwise a small built-in sequencer.
  const N = { C3: 131, E3: 165, F3: 175, G3: 196, A3: 220, C4: 262, D4: 294, E4: 330, F4: 349, G4: 392, A4: 440, B4: 494, C5: 523, D5: 587, E5: 659, G5: 784 };
  const TUNES = {
    lobby: { step: 0.34, lead: ['C4', 0, 'E4', 0, 'G4', 0, 'A4', 0, 'G4', 0, 'E4', 0, 'D4', 0, 'E4', 0, 'A3', 0, 'C4', 0, 'E4', 0, 'G4', 0, 'E4', 0, 'D4', 0, 'C4', 0, 0, 0], bass: ['C3', 0, 0, 0, 0, 0, 0, 0, 'A3', 0, 0, 0, 0, 0, 0, 0, 'F3', 0, 0, 0, 0, 0, 0, 0, 'G3', 0, 0, 0, 0, 0, 0, 0], wave: 'sine', vol: 0.5 },
    game: { step: 0.15, lead: ['E5', 0, 'G5', 'E5', 'C5', 0, 'D5', 'E5', 0, 'C5', 'A4', 0, 'G4', 'A4', 'C5', 0, 'D5', 0, 'E5', 'D5', 'B4', 0, 'G4', 'B4', 'C5', 0, 'E5', 0, 'C5', 0, 0, 0], bass: ['C3', 0, 'G3', 0, 'C3', 0, 'G3', 0, 'A3', 0, 'E3', 0, 'A3', 0, 'E3', 0, 'G3', 0, 'G3', 0, 'G3', 0, 'G3', 0, 'C3', 0, 'G3', 0, 'C3', 'G3', 'C3', 0], wave: 'square', vol: 0.22 },
  };
  function note(f, t, d, type, vol) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + d + 0.05);
  }
  function music(kind) {
    if (!ready()) kind = null;
    if (kind === musicKind) return;
    if (musicNode) { try { musicNode.stop(); } catch (e) {} musicNode = null; }
    clearInterval(musicTimer); musicTimer = null;
    musicKind = kind;
    if (!kind) return;
    try {
      if (buffers['bgm-' + kind]) { musicNode = ac.createBufferSource(); musicNode.buffer = buffers['bgm-' + kind]; musicNode.loop = true; musicNode.connect(musicBus); musicNode.start(); return; }
      const tune = TUNES[kind];
      let i = 0, next = ac.currentTime + 0.1;
      musicTimer = setInterval(() => {
        while (next < ac.currentTime + 0.4) {
          const l = tune.lead[i % tune.lead.length], b = tune.bass[i % tune.bass.length];
          if (l) note(N[l], next, tune.step * 1.7, tune.wave, tune.vol);
          if (b) note(N[b], next, tune.step * 2.2, 'triangle', 0.5);
          i++; next += tune.step;
        }
      }, 120);
    } catch (e) {}
  }

  // Looping room tone per scene: 'cave', 'water', 'wind', or null for silence.
  const AMB = { cave: { f: 220, vol: 0.09, drone: 55 }, water: { f: 700, type: 'bandpass', vol: 0.07 }, wind: { f: 420, vol: 0.1, sweep: 260 } };
  function ambient(kind) {
    if (!ready()) kind = null;
    if (kind === ambKind) return;
    if (amb) { const old = amb; old.g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.2); setTimeout(() => old.nodes.forEach(n => { try { n.stop(); } catch (e) {} }), 900); amb = null; }
    ambKind = kind;
    const c = AMB[kind];
    if (!c) return;
    const t = ac.currentTime, src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), lfo = ac.createOscillator(), depth = ac.createGain();
    src.buffer = buffer(); src.loop = true; f.type = c.type || 'lowpass'; f.frequency.value = c.f; f.Q.value = 0.6;
    g.gain.setValueAtTime(0.0001, t); g.gain.setTargetAtTime(c.vol, t, 0.6);
    lfo.frequency.value = 0.17;
    if (c.sweep) { depth.gain.value = c.sweep; lfo.connect(depth); depth.connect(f.frequency); } else { depth.gain.value = c.vol * 0.4; lfo.connect(depth); depth.connect(g.gain); }
    src.connect(f); f.connect(g); g.connect(master); src.start(); lfo.start();
    const nodes = [src, lfo];
    if (c.drone) { const o = ac.createOscillator(), og = ac.createGain(); o.frequency.value = c.drone; og.gain.value = 0.9; o.connect(og); og.connect(g); o.start(); nodes.push(o); }
    amb = { g, nodes };
  }
  function toggleMute() { muted = !muted; if (muted) { ambient(null); music(null); } return muted; }
  const buzz = pattern => { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {} };

  return { FILES, unlock, only, play, music, ambient, toggleMute, buzz, on, muted: () => muted };
})();
const Sfx = SoundManager;

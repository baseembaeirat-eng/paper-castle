// Phone controller: join screen, lobby, and one small control surface per mini-game.
(() => {
  const A = Art, app = document.getElementById('app'), socket = io();
  const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  try { document.body.style.backgroundImage = `url(${A.paper(420, 420, 11).toDataURL('image/jpeg', 0.8)})`; } catch (e) {}

  let cur = null, sig = '', view = null, cleanup = null, joined = false;
  const send = m => socket.emit('in', m);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // tiny DOM helpers
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') el.className = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v); }
    for (const k of kids.flat()) if (k != null) el.append(k);
    return el;
  }
  const tap = (label, cls, fn) => { const b = h('button', { class: cls || '' }, label); b.addEventListener('pointerdown', e => { e.preventDefault(); if (!b.disabled) fn(b); }); return b; };
  const hold = (label, cls, fn) => {
    const b = h('button', { class: cls || '' }, label);
    const set = v => { b.classList.toggle('down', v); fn(v); };
    b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (x) {} set(true); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => set(false));
    return b;
  };
  const header = d => h('div', { class: 'bar' }, h('b', {}, d.me ? d.me.name : ''), h('span', {}, d.gname || 'قلعة الورق'), h('span', {}, d.me ? d.me.score + ' نقطة' : ''));
  const text = (s, cls) => h('p', { class: cls || '' }, s);
  const waitScreen = (...lines) => h('div', { class: 'fill' }, lines.map((l, i) => text(l, i ? 'small' : '')));

  // ---- join -------------------------------------------------------------------------
  function showJoin(err) {
    joined = false; sig = '';
    const code = h('input', { id: 'code', maxlength: 4, placeholder: 'الرمز', autocomplete: 'off', autocapitalize: 'characters', value: store.get('pc_code') || '' });
    const name = h('input', { maxlength: 12, placeholder: 'اسمك', autocomplete: 'off', value: store.get('pc_name') || '' });
    const msg = text(err || '', 'err small');
    const go = () => join(code.value, name.value, false, e => { msg.textContent = e; });
    app.replaceChildren(h('h1', {}, 'قلعة الورق'), text('بطولة كبرى من السقطات والغطسات والأبواب'),
      h('div', { class: 'fill' }, code, name, tap('خذ مكانك', 'green', go), msg));
  }
  function join(code, name, silent, onErr) {
    code = String(code || '').trim().toUpperCase();
    socket.emit('join', { code, name, token: store.get('pc_token_' + code) }, res => {
      if (res.error) { if (silent) showJoin(''); else onErr(res.error); return; }
      joined = true; store.set('pc_code', res.code); store.set('pc_name', name || store.get('pc_name') || ''); store.set('pc_token_' + res.code, res.token);
    });
  }
  socket.on('connect', () => { const code = store.get('pc_code'); if (code && store.get('pc_token_' + code)) join(code, store.get('pc_name'), true); else showJoin(''); });
  socket.on('disconnect', () => { if (cleanup) { cleanup(); cleanup = null; } sig = ''; app.replaceChildren(waitScreen('انقطع الاتصال بالقلعة…', 'نعيد الاتصال.')); });

  // ---- screen routing ---------------------------------------------------------------
  socket.on('p', d => {
    if (!joined) return;
    cur = d;
    const s = [d.phase, d.gid, d.role, d.seq, d.vip, d.v && d.v.ui].join('|');
    if (s !== sig) {
      sig = s;
      if (cleanup) { cleanup(); cleanup = null; }
      view = mount(d);
      app.replaceChildren(header(d), ...[].concat(view.el));
    }
    app.firstChild.replaceWith(header(d));
    if (view.update) view.update(d);
  });

  function mount(d) {
    if (d.phase === 'lobby') return lobbyView(d);
    if (d.phase === 'wait') return { el: waitScreen('اللعبة جارية الآن.', 'ستشارك في اللعبة التالية.') };
    if (d.phase === 'intro') return { el: h('div', { class: 'fill' }, h('h1', {}, d.gname), text(d.role === 'runner' ? 'أنت العدّاء' : d.role === 'other' ? 'أنت ضد العدّاء' : 'الجميع يلعبون'), h('div', { class: 'note' }, text(d.tip)), d.vip ? tap('ابدأ الآن', 'green', () => socket.emit('skip')) : null) };
    if (d.phase === 'result') return { el: h('div', { class: 'fill' }, d.champion ? h('h1', {}, 'بطل القلعة!') : null, text(d.text), text(d.got ? `ربحت ${d.got} نقطة` : 'لا نقاط هذه المرة', 'small'), d.vip ? tap('العودة إلى الردهة', 'green', () => socket.emit('back')) : null) };
    return UI[d.gid](d);
  }

  function lobbyView(d) {
    const cv = h('canvas', { width: 520, height: 230 }), c = cv.getContext('2d');
    let raf, t0 = performance.now();
    const draw = () => {
      const t = (performance.now() - t0) / 1000, ci = cur.me.ci;
      c.clearRect(0, 0, 520, 230);
      const emo = ['happy', 'grit', 'smug', 'shock', 'scared', 'angry', 'dizzy', 'sad'][Math.floor(t / 2) % 8];
      A.stick(c, 110, 190, 1.5, { ci, emo, t }); A.stick(c, 260, 190, 1.5, { ci, emo, dir: 'right', t: t + 0.3 }); A.stick(c, 410, 190, 1.5, { ci, dir: 'back', t: t + 0.6 });
      ['أمام', 'جانب', 'خلف'].forEach((s, i) => A.txt(c, s, 110 + i * 150, 214, 22, { hand: true, alpha: 0.7 }));
      raf = requestAnimationFrame(draw);
    };
    draw(); cleanup = () => cancelAnimationFrame(raf);
    const info = text('');
    const menu = d.vip ? h('div', { class: 'grid menu' }, d.games.map(g => tap(`${g.num}. ${g.name}`, g.kind === 'runner' ? '' : 'blue', () => socket.emit('pick', { game: g.id })))) : null;
    return { el: [cv, info, d.vip ? text('أنت عريف الحفل — اختر اللعبة التالية:', 'small') : waitScreen('بانتظار أن يختار عريف الحفل لعبة.'), menu].filter(Boolean), update: x => { info.textContent = `الغرفة ${x.code} · عدد المتسابقين: ${x.n}${x.champion ? ' · أنت البطل الحالي!' : ''}`; } };
  }

  // ---- per-game controls -------------------------------------------------------------
  const cooldown = (label, cls, msg) => { const b = tap(label, 'big ' + cls, () => send(msg)); return { el: h('div', { class: 'col' }, b), update: d => { b.disabled = !d.v.rdy; } }; };
  const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  const UI = {
    honeycomb(d) {
      const cv = h('canvas', { width: 520, height: 520 }), c = cv.getContext('2d'), msg = text('');
      let center = [260, 260];
      cv.addEventListener('pointerdown', e => {
        const r = cv.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * 520 - center[0], y = ((e.clientY - r.top) / r.height) * 520 - center[1];
        if (Math.hypot(x, y) < 14) return;
        send({ d: ((Math.round(-Math.atan2(y, x) / (Math.PI / 3)) % 6) + 6) % 6 });
      });
      const corner = (p, s, i) => { const a = ((i * 60 - 30) * Math.PI) / 180; return [p[0] + s * Math.cos(a), p[1] + s * Math.sin(a)]; };
      const hex = (p, s, doors, seed, tint) => {
        A.wash(c, [0, 1, 2, 3, 4, 5].map(i => corner(p, s, i)), tint, seed, { alpha: 0.22, amp: s / 20 });
        for (let k = 0; k < 6; k++) { const a = corner(p, s, (6 - k) % 6), b = corner(p, s, (7 - k) % 6), m = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; if (doors[k]) { A.ink(c, [a, m(0.22)], seed + k, { w: s / 14 }); A.ink(c, [m(0.78), b], seed + k + 9, { w: s / 14 }); } else A.ink(c, [a, b], seed + k, { w: s / 14 }); }
      };
      return {
        el: [cv, msg], update(x) {
          const v = x.v; c.clearRect(0, 0, 520, 520);
          if (v.ui === 'r') {
            center = [260, 260]; hex(center, 200, v.d, 3, A.PAL.sand);
            v.d.forEach((open, k) => { if (!open) return; const a = (-k * Math.PI) / 3; A.txt(c, '➤', 260 + Math.cos(a) * 205, 260 + Math.sin(a) * 205, 44, { rot: a, color: A.PAL.brick }); });
            A.stick(c, 260, 310, 1.3, { ci: x.me.ci, emo: v.growl <= 1 ? 'shock' : v.growl <= 2 ? 'scared' : 'grit', t: performance.now() / 1000 });
            msg.textContent = (v.growl <= 1 ? 'شيء ما يتنفس في الغرفة المجاورة تماماً!' : v.growl <= 2 ? 'تسمع مخالب على الحجر، قريباً منك…' : 'هدوء. حتى الآن.') + (v.far <= 2 ? ' فانوس يتوهّج جهة اليمين.' : '');
          } else {
            const s = 36, pos = (q, r) => [260 + s * Math.sqrt(3) * (q + r / 2), 260 + s * 1.5 * r];
            v.cells.forEach((cell, n) => hex(pos(cell.q, cell.r), s, cell.d, n * 20 + 1, cell.q === v.exit.q && cell.r === v.exit.r ? A.PAL.ochre : A.PAL.stone));
            v.mons.forEach(m => { const p = pos(m.q, m.r), me = m.q === v.me.q && m.r === v.me.r; A.wash(c, A.circ(p[0], p[1], me ? 15 : 10), me ? A.PCOL[x.me.ci] : A.PAL.soot, 5, { alpha: 0.6, amp: 1 }); if (me) A.ink(c, A.circ(p[0], p[1], 17), 6, { closed: true, w: 3 }); });
            const rp = pos(v.runner.q, v.runner.r); A.txt(c, '✗', rp[0], rp[1], 40, { color: A.PAL.brick, bold: true });
            center = pos(v.me.q, v.me.r);
            msg.textContent = 'أنت النقطة المحاطة بدائرة. اضغط باتجاه فتحة باب لتتحرك. علامة ✗ هي العدّاء.';
          }
        },
      };
    },

    stones(d) {
      const names = ['الحجر العلوي', 'الحجر الأوسط', 'الحجر السفلي'];
      if (d.role === 'runner') {
        if (d.v.ui === 'setup') return { el: waitScreen('إنهم يبدّلون الأحجار بالورق…', 'راقب وجوههم. دائماً هناك من يفضح السر.') };
        const info = text(''), bs = names.map((n, i) => tap(n, 'big', () => send({ col: i })));
        return { el: [info, h('div', { class: 'col' }, bs)], update: x => { info.textContent = `الصف ${Math.min(5, x.v.row + 1)} من 5 · الغطسات المتبقية: ${x.v.lives}`; bs.forEach((b, i) => { b.disabled = x.v.busy || x.v.rev[i] === 1; b.textContent = x.v.rev[i] === 1 ? 'ورق!' : names[i]; }); } };
      }
      const cells = [], grid = h('div', { class: 'grid', style: 'grid-template-columns:repeat(5,1fr)' });
      for (let c = 0; c < 3; c++) for (let r = 0; r < 5; r++) { const b = tap('', '', () => send({ row: r, col: c })); b.style.minHeight = '74px'; b.style.padding = '4px'; b.style.fontSize = '15px'; cells.push({ b, r, c }); grid.append(b); }
      const info = text(''), ready = d.v.ui === 'setup' ? tap('انتهيت من التدبير', 'green', () => send({ ready: 1 })) : null;
      return { el: [text(d.v.ui === 'setup' ? 'اضغط أحجار صفوفك لتجعلها ورقاً (اثنان كحد أقصى في الصف). اليسار هو الضفة القريبة.' : 'وجوه جامدة! العدّاء يقرأ ملامحكم.', 'small'), grid, info, ready].filter(Boolean), update: x => { const v = x.v; cells.forEach(({ b, r, c }) => { b.disabled = v.ui !== 'setup' || !v.mine[r]; b.classList.toggle('on', !!v.paper[r][c]); b.textContent = v.paper[r][c] ? 'ورق' : 'حجر'; b.style.opacity = v.mine[r] || v.ui !== 'setup' ? 1 : 0.35; }); info.textContent = v.ui === 'setup' ? (v.ready ? 'بانتظار بقية المخرّبين…' : '') : `العدّاء عند الصف ${Math.min(5, v.row + 1)}`; if (ready) ready.disabled = v.ready; } };
    },

    bridge(d) {
      if (d.role !== 'runner') return cooldown('أطلق!', 'red', { fire: 1 });
      let tilt = 0, touch = false, gyro = false;
      const mark = h('i'), meter = h('div', { class: 'meter' }, mark), pad = h('div', { class: 'pad' }, h('span', {}, 'لا يوجد ميلان؟ اسحب هنا يميناً ويساراً'), h('i')), knob = pad.lastChild;
      const onOri = e => { if (e.gamma == null) return; gyro = true; if (!touch) tilt = clamp(e.gamma / 30, -1, 1); };
      const enable = tap('فعّل التحكم بالميلان', 'green', b => {
        const D = window.DeviceOrientationEvent;
        if (D && D.requestPermission) D.requestPermission().then(r => { if (r === 'granted') addEventListener('deviceorientation', onOri); b.textContent = r === 'granted' ? 'تم تفعيل الميلان' : 'رُفض الميلان — اسحب في الأسفل'; }).catch(() => { b.textContent = 'الميلان غير متاح — اسحب في الأسفل'; });
        else { addEventListener('deviceorientation', onOri); b.textContent = 'الميلان مفعّل (إن كان جهازك يدعمه)'; }
      });
      addEventListener('deviceorientation', onOri);
      const move = e => { const r = pad.getBoundingClientRect(); tilt = clamp(((e.clientX - r.left) / r.width - 0.5) * 2.4, -1, 1); };
      pad.addEventListener('pointerdown', e => { touch = true; pad.setPointerCapture(e.pointerId); move(e); });
      pad.addEventListener('pointermove', e => { if (touch) move(e); });
      for (const ev of ['pointerup', 'pointercancel']) pad.addEventListener(ev, () => { touch = false; if (!gyro) tilt = 0; });
      const iv = setInterval(() => { send({ tilt }); knob.style.left = 50 + tilt * 40 + '%'; }, 50);
      cleanup = () => { clearInterval(iv); removeEventListener('deviceorientation', onOri); };
      return { el: [text('مِل عكس التأرجح وأبقِ المؤشر في المنطقة الخضراء.', 'small'), meter, enable, pad], update: x => { mark.style.left = 50 + clamp(x.v.b, -1, 1) * 50 + '%'; } };
    },

    knock(d) {
      if (d.role === 'runner') {
        if (d.v.ui === 'setup') return { el: waitScreen('أصوات طَرق من خلف الجدران…', 'تُسمَّر ثلاثة أبواب في كل جدار.') };
        const info = text(''), bs = [0, 1, 2, 3].map(i => tap('الباب ' + (i + 1), 'big', () => send({ door: i })));
        return { el: [info, h('div', { class: 'grid', style: 'grid-template-columns:1fr 1fr;flex:1' }, bs)], update: x => { info.textContent = `الجدار ${Math.min(3, x.v.wall + 1)} من 3 — اختر باباً واندفع`; bs.forEach(b => { b.disabled = x.v.busy; }); } };
      }
      const rows = [0, 1, 2].map(w => ({ w, label: text('', 'small'), bs: [0, 1, 2, 3].map(i => tap(String(i + 1), '', () => send({ wall: w, door: i }))) }));
      const ready = d.v.ui === 'setup' ? tap('انتهيت من التدبير', 'green', () => send({ ready: 1 })) : null;
      return { el: [text(d.v.ui === 'setup' ? 'اختر الباب الورقي الوحيد في كل جدار يخصّك. الباقي بلّوط صلب.' : 'وجوه جامدة! الباب المظلَّل هو الورقي.', 'small'), ...rows.flatMap(r => [r.label, h('div', { class: 'row' }, r.bs)]), ready].filter(Boolean), update: x => { const v = x.v; rows.forEach(r => { r.label.textContent = `الجدار ${r.w + 1}` + (v.mine[r.w] ? ' — لك' : '') + (v.ui === 'run' && v.wall === r.w ? ' ← العدّاء هنا' : ''); r.bs.forEach((b, i) => { b.disabled = v.ui !== 'setup' || !v.mine[r.w]; b.classList.toggle('on', v.open[r.w] === i); b.textContent = v.open[r.w] === i ? 'ورق' : 'بلّوط'; }); }); if (ready) ready.disabled = v.ready; } };
    },

    avalanche(d) {
      if (d.role !== 'runner') return cooldown('أفلِت صخرة', 'red', { drop: 1 });
      const info = text(''), run = hold('اركض', 'big green', v => send({ run: v })), hide = hold('اختبئ', 'big blue', v => send({ hide: v }));
      return { el: [info, h('div', { class: 'col' }, run, hide)], update: x => { info.textContent = x.v.hid ? 'مختبئ في التجويف. بأمان.' : x.v.near ? 'تجويف! اضغط مطوّلاً «اختبئ» لتحتمي.' : 'أنت مكشوف — واصل الحركة!'; hide.style.opacity = x.v.near ? 1 : 0.45; } };
    },

    rollers(d) {
      if (d.role !== 'runner') {
        const bs = [0, 1, 2, 3, 4].map(i => tap('برميل ' + (i + 1), 'big', () => send({ cyl: i })));
        return { el: [text('اضغط على برميل لتغيّر دورانه.', 'small'), h('div', { class: 'col' }, bs)], update: x => bs.forEach(b => { b.disabled = !x.v.rdy; }) };
      }
      let l = 0, r = 0; const mv = () => send({ mv: r - l });
      const jump = tap('اقفز', 'big green', () => send({ jump: 1 }));
      return { el: [text('امشِ عكس الدوران ثم اقفز.', 'small'), h('div', { class: 'col' }, jump, h('div', { class: 'row' }, hold('◀', 'big', v => { l = +v; mv(); }), hold('▶', 'big', v => { r = +v; mv(); })))], update: x => { jump.disabled = !x.v.can; } };
    },

    dragon(d) {
      if (d.role !== 'runner') {
        const bs = [tap('◀ هبّة نحو اليسار', 'big blue', () => send({ gust: -1 })), tap('هبّة نحو اليمين ▶', 'big blue', () => send({ gust: 1 }))];
        return { el: [text('احرف العدّاء عن مساره حالما يبدأ التأرجح.', 'small'), h('div', { class: 'col' }, bs)], update: x => bs.forEach(b => { b.disabled = !x.v.rdy; }) };
      }
      const ui = d.v.ui;
      if (ui === 'fly' || ui === 'done') return { el: waitScreen(ui === 'fly' ? 'وييييي—' : '…', 'لم يبقَ إلا الأمل.') };
      return { el: h('div', { class: 'col' }, tap(ui === 'ready' ? 'اقفز!' : 'أفلِت!', 'big ' + (ui === 'ready' ? 'green' : 'red'), () => send({ go: 1 }))) };
    },

    mushroom(d) {
      const ui = d.v.ui;
      if (ui === 'cling') return { el: [text('ضغطة واحدة. أفلِت أبكر بقليل — فالدوران يحملك إلى الأمام.', 'small'), h('div', { class: 'col' }, tap('أفلِت!', 'big red', () => send({ go: 1 })))] };
      return { el: waitScreen(ui === 'fly' ? 'وييييي—' : ui === 'safe' ? 'هبطت! جافّ ودائخ.' : 'طَشّ. إلى المستنقع.', ui === 'fly' ? '' : 'تابع الآخرين على الشاشة الكبيرة.') };
    },

    hands(d) {
      const info = text(''), bs = d.v.cards.map(cd => { const b = tap(cd.label, 'card', () => send({ card: cd.i })); b.dataset.i = cd.i; if ('♥♦'.includes(cd.label)) b.style.color = '#a2503c'; return b; });
      return { el: [info, h('div', { class: 'grid', style: 'grid-template-columns:1fr 1fr;flex:1' }, bs)], update: x => { const v = x.v; bs.forEach(b => { const i = +b.dataset.i; b.disabled = v.pick >= 0 || v.phase !== 'ask'; b.classList.toggle('right', v.answer === i); b.classList.toggle('wrong', v.pick === i && v.answer >= 0 && v.answer !== i); }); info.textContent = v.won ? 'أصبت!' : v.phase === 'reveal' ? 'اللغز التالي قادم…' : v.pick >= 0 ? 'بطاقة خاطئة — وقعت على وجهك.' : 'اقرأ الشاشة الكبيرة ثم ارتمِ!'; } };
    },

    showdown(d) {
      if (d.v.ui === 'd') return { el: waitScreen('حلقتك الورقية تمزّقت.', 'شجّع أحد الناجين.') };
      let jx = 0, jy = 0, fire = false, on = false;
      const pad = h('div', { class: 'pad' }, h('span', {}, 'اسحب للقيادة والتصويب'), h('i')), knob = pad.lastChild, info = text('');
      const move = e => { const r = pad.getBoundingClientRect(), R = Math.min(r.width, r.height) / 2.4; jx = clamp((e.clientX - r.left - r.width / 2) / R, -1, 1); jy = clamp((e.clientY - r.top - r.height / 2) / R, -1, 1); knob.style.transform = `translate(${jx * R * 0.8}px,${jy * R * 0.8}px)`; };
      pad.addEventListener('pointerdown', e => { on = true; pad.setPointerCapture(e.pointerId); move(e); });
      pad.addEventListener('pointermove', e => { if (on) move(e); });
      for (const ev of ['pointerup', 'pointercancel']) pad.addEventListener(ev, () => { on = false; jx = jy = 0; knob.style.transform = ''; });
      const squirt = hold('رُشّ!', 'big blue', v => { fire = v; send({ jx, jy, fire }); });
      squirt.style.flex = '0 0 130px';
      const iv = setInterval(() => send({ jx, jy, fire }), 50);
      cleanup = () => clearInterval(iv);
      return { el: [info, pad, squirt], update: x => { info.textContent = 'حلقتك الورقية: ' + '◍ '.repeat(x.v.hp); } };
    },
  };
})();

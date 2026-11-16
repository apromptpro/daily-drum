'use strict';
// The Tour: challenges outside the lessons. Seven stops, each with its own look. A stop has three warm-up challenges
// that test one skill each (Echo, Quick sticks, Steady beat), a sight-reading test, and a gig: a long piece with
// tempo changes. Loaded before app.js; everything here runs later.
// Hits come through the same microphone, pad sounds, sensitivity and timing offset as the lessons (see Setup):
// there are no settings of its own in here.

// What opens each stop: a lesson badge or test, and the gig of the stop before it.
const TOUR_NEED = [
  null,
  ['Pass the Level 1 test', () => !!(progress.T0 && progress.T0.pass)],
  ['Badge: 25 in a row', () => !!prof().badges.combo25],
  ['Badge: Beginner graduate', () => !!prof().badges.lv1],
  ['Badge: Ten shining lessons', () => !!prof().badges.stars10],
  ['Badge: Intermediate graduate', () => !!prof().badges.lv2],
  ['Badge: Advanced graduate', () => !!prof().badges.lv3]
];
const TOUR_ICON = ['🛏️', '🚗', '🏫', '🎧', '🎪', '🏟️', '🌌'];
// Each stop has its own colours: a = accent, b = the stage behind the challenge, c = text on the accent.
const TOUR_THEME = [
  { a: '#6a5cf0', b: 'linear-gradient(160deg,#2b3158,#3b4470)', c: '#fff' },
  { a: '#f08a24', b: 'linear-gradient(160deg,#2d3038,#565c6e)', c: '#1d1408' },
  { a: '#d6404c', b: 'linear-gradient(160deg,#3a1f28,#6b3a48)', c: '#fff' },
  { a: '#f06aa8', b: 'linear-gradient(160deg,#120e26,#3a2460)', c: '#1d0a14' },
  { a: '#33a852', b: 'linear-gradient(160deg,#173a66,#2b6a50)', c: '#fff' },
  { a: '#1f9bd1', b: 'linear-gradient(160deg,#0c1c33,#1c3f6e)', c: '#fff' },
  { a: '#ffd84a', b: 'radial-gradient(circle at 70% 20%,#3a2a7a,#0a0a1c 70%)', c: '#1d1408' }
];
const TROPHY = ['No trophy yet', '🥉 Bronze', '🥈 Silver', '🥇 Gold'];
const TOUR_GAMES = [
  { id: 'echo', icon: '👂', name: 'Echo', skill: 'listening and memory', how: 'Your buddy plays a few hits. Play the same hits back, in the same order. Every round adds one more.' },
  { id: 'quick', icon: '⚡', name: 'Quick sticks', skill: 'finding each pad fast', how: 'A pad is called out. Hit it as fast as you can, before the time runs out.' },
  { id: 'steady', icon: '⏱️', name: 'Steady beat', skill: 'keeping time on your own', how: 'Hit any pad on every beat. Sometimes the click goes silent: keep the beat going by yourself.' },
  { id: 'read', icon: '🎼', name: 'Sight reading', skill: 'reading drum music', how: 'New bars you have never seen, on the sheet only. Read them and play them.' }
];
const TOUR_PADS = ['snare', 'kick', 'hihat', 'tom1', 'crash', 'tom2', 'tom3', 'ride'];   // one more pad joins at every stop

// ----- the written music of each stop -----
const F16 = { snare: 'xxxx------------', tom1: '----xxxx--------', tom2: '--------xxxx----', tom3: '------------xxxx' };
const F3 = { snare: 'xxxxxx------', tom1: '------xxx---', tom3: '---------xxx' };
const END2 = { crash: 'x-------', kick: 'x-------' }, END4 = { crash: 'x---------------', kick: 'x---------------' }, END3 = { crash: 'x-----------', kick: 'x-----------' };
const rep = (n, bar) => barsOf(n, bar);
const TOUR_MUSIC = [
  { title: 'Bedroom boogie', div: 1, tempos: [[0, 60], [8, 70], [16, 80]],
    bars: [].concat(rep(2, { snare: 'xxxx' }), rep(2, { kick: 'xxxx' }), rep(4, { kick: 'x-x-', snare: '-x-x' }), [CRASH_Q], rep(6, BEAT_Q), [{ snare: 'xxxx' }], [CRASH_Q], rep(6, BEAT_Q), [{ crash: 'x---', kick: 'x---' }]),
    read: [{ snare: 'xxxx' }, { kick: 'xxxx' }, { kick: 'x-x-', snare: '-x-x' }, { snare: 'x-x-', kick: '-x-x' }, { hihat: 'xxxx' }, { snare: 'xx-x', kick: '--x-' }, { kick: 'x--x', snare: '-xx-' }], readBpm: 60 },
  { title: 'Garage rock', div: 2, tempos: [[0, 70], [8, 80], [16, 90]],
    bars: [].concat([CRASH_ROCK], rep(3, ROCK), rep(3, BUSY), [TOM_FILL], [CRASH_ROCK], rep(2, ROCK), [HALF_FILL], rep(3, DANCE), [TOM_FILL], [CRASH_ROCK], rep(3, BUSY), rep(2, DANCE), [TOM_FILL], [END2]),
    read: [ROCK, BUSY, { hihat: 'xxxxxxxx', snare: '--x---x-', kick: 'x-x-x---' }, { snare: 'x-x-xxx-' }, { kick: 'x-x-x-x-', snare: '-x-x-x-x' }, TOM_FILL, { snare: 'xx-xx-x-', kick: '--x--x--' }], readBpm: 65 },
  { title: 'School show', div: 2, tempos: [[0, 80], [8, 90], [20, 100]],
    bars: [].concat([CRASH_ROCK], rep(3, KICK_A), rep(3, KICK_B), [TOM_FILL], [CRASH_RIDE], rep(3, RIDE), rep(3, KICK_C), [HALF_FILL], [CRASH_ROCK], rep(3, DANCE), rep(2, KICK_A), [KICK_B], [TOM_FILL], [CRASH_RIDE], rep(2, RIDE), [END2]),
    read: [KICK_A, KICK_B, KICK_C, DANCE, HALF_FILL, RIDE, { snare: 'x-xx-xx-', kick: '-x--x--x' }], readBpm: 72 },
  { title: 'Club night', div: 2, tempos: [[0, 95], [8, 105], [16, 85], [24, 112]],
    bars: [].concat([CRASH_ROCK], rep(7, DANCE), [CRASH_RIDE], rep(6, RIDE), [TOM_FILL], rep(7, HALF_TIME), [HALF_FILL], [CRASH_ROCK], rep(3, DANCE), rep(3, KICK_B), [TOM_FILL], [END2]),
    read: [RIDE, CRASH_RIDE, HALF_TIME, DANCE, KICK_B, { ride: 'x-x-x-x-', snare: '--x---x-', kick: 'xx---x--' }, TOM_FILL], readBpm: 80 },
  { title: 'Festival funk', div: 4, tempos: [[0, 72], [8, 82], [20, 92]],
    bars: [].concat(rep(4, ROCK16), rep(3, FUNK_A), [F16], rep(4, FUNK_B), rep(3, SIXTEEN), [F16], rep(4, FUNK_A), rep(3, FUNK_B), [F16], rep(4, SIXTEEN), rep(2, FUNK_B), [F16], [END4]),
    read: [ROCK16, FUNK_A, FUNK_B, SIXTEEN, { snare: 'x-xx-x-xx-x-xx-x' }, { hihat: 'x-x-x-x-x-x-x-x-', snare: '----x--x-x--x---', kick: 'x-x-----x-x-----' }, F16], readBpm: 66 },
  { title: 'Stadium shuffle', div: 3, tempos: [[0, 80], [12, 95], [24, 110]],
    bars: [].concat(rep(4, BLUES), rep(7, SHUF), [F3], rep(4, BLUES), rep(7, SHUF), [F3], rep(11, SHUF), [F3], [END3]),
    read: [BLUES, SHUF, F3, { hihat: 'x-xx-xx-xx-x', kick: 'x-----x--x--', snare: '---x-----x--' }, { ride: 'x-xx-xx-xx-x', snare: '---x-----x--', kick: 'x--x--x-----' }], readBpm: 72 },
  { title: 'Galaxy storm', div: 4, tempos: [[0, 85], [12, 100], [24, 115], [36, 128]],
    bars: [].concat(rep(4, FUNK_B), rep(3, SIXTEEN), [F16],
      rep(3, { hihat: 'x-x-x-x-x-x-x-x-', snare: '----x--x-x--x--x', kick: 'x--x--x---x--x--' }), [F16],
      rep(7, { ride: 'x-x-x-x-x-x-x-x-', snare: '----x-------x-xx', kick: 'x-x---x-x--x----', hhpedal: '--x---x---x---x-' }), [F16],
      rep(3, { snare: 'x--x--x--x--x-x-', kick: '--x--x--x--x---x' }), [F16], rep(7, FUNK_B), [F16],
      rep(6, { hihat: 'x-x-x-x-x-x-x-x-', snare: '----x--x-x--x--x', kick: 'x--x--x---x--x--' }), rep(2, SIXTEEN), rep(2, F16), [END4]),
    read: [FUNK_B, SIXTEEN, F16, { hihat: 'x-x-x-x-x-x-x-x-', snare: '----x--x-x--x--x', kick: 'x--x--x---x--x--' }, { snare: 'x--x--x--x--x-x-', kick: '--x--x--x--x---x' },
      { ride: 'x-x-x-x-x-x-x-x-', snare: '----x-------x-xx', kick: 'x-x---x-x--x----', hhpedal: '--x---x---x---x-' }], readBpm: 78 }
];

const Tour = {
  s: null, game: null, k: 0, running: false, timers: [], raf: 0,
  pro() { return prof().level === 'pro'; },
  saved(stop) { const p = prof(); p.tour = p.tour || {}; return p.tour[stop] || (p.tour[stop] = {}); },
  gigWon(stop) { return !!(prof().tour && prof().tour[stop] && prof().tour[stop].gig); },
  open(stop) { return stop === 0 || (TOUR_NEED[stop][1]() && this.gigWon(stop - 1)); },
  points(stop) { const sv = this.saved(stop); return TOUR_GAMES.reduce((a, g) => a + (sv[g.id] || 0), 0); },
  later(fn, ms) { const t = setTimeout(fn, ms); this.timers.push(t); return t; },
  view(name) { ['tourMap', 'tourPlay', 'tourDone'].forEach(id => $('#' + id).classList.toggle('hidden', id !== name)); window.scrollTo(0, 0); },
  theme() {
    const t = TOUR_THEME[this.k], el = $('#tour');
    el.style.setProperty('--tA', t.a); el.style.setProperty('--tB', t.b); el.style.setProperty('--tC', t.c);
  },
  // How hard each challenge is at this stop. Rookie is slower and kinder; Pro is faster, stricter and gives less help.
  cfg() {
    const k = this.k, pro = this.pro(), pads = TOUR_PADS.slice(0, Math.min(TOUR_PADS.length, 2 + k));
    const run = (pro ? 2 : 1) + Math.floor(k / 2), bars = [1, 1];
    while (bars.length < 8 + 2 * k) { for (let i = 0; i < run; i++) bars.push(0); bars.push(1); }
    return {
      echo: { first: (pro ? 3 : 2) + Math.floor(k / 2), rounds: (pro ? 6 : 5) + Math.floor(k / 2), gap: Math.max(0.3, (pro ? 0.45 : 0.65) - 0.04 * k), pool: pads.slice(0, 2), more: pads.slice(2), show: !pro },
      quick: { n: (pro ? 14 : 10) + 2 * k, ms: Math.max(pro ? 1200 : 2200, (pro ? 2600 : 4500) - (pro ? 200 : 350) * k), pool: TOUR_PADS.slice(0, Math.min(8, (pro ? 5 : 4) + k)), light: !pro },
      steady: { bpm: (pro ? 90 : 70) + (pro ? 10 : 8) * k, bars: bars.slice(0, 8 + 2 * k), tight: pro ? 60 : 90, loose: pro ? 120 : 170 }
    };
  },

  // ----- the map, and the stop that is picked on it -----
  render() {
    this.stop();
    if (!this.open(this.k)) this.k = 0;
    this.view('tourMap');
    this.theme();
    const pro = this.pro();
    document.querySelectorAll('#tourLv button').forEach(b => b.classList.toggle('active', (b.dataset.lv === 'pro') === pro));
    // Each level has a host: the younger brother looks after Rookie, the older one after Pro.
    const host = pro ? 0 : 1;
    $('#tourHostFace').innerHTML = mascotHtml(host, false);
    $('#tourLvTxt').textContent = pro ? 'I\'m the big Beat Brother and I host Pro. It is faster and stricter: the pads are not lit up, and the gig is played from the sheet only.'
      : 'I\'m the little Beat Brother and I host Rookie. It is slower and kinder, with more help. A good place to start!';
    const stops = $('#tourStops');
    stops.innerHTML = '';
    VENUES.forEach((v, k) => {
      const open = this.open(k), d = document.createElement('button');
      d.className = 'stopCard' + (open ? ' open' : '') + (k === this.k ? ' here' : '') + (this.gigWon(k) ? ' won' : '');
      d.style.setProperty('--sA', TOUR_THEME[k].a);
      d.innerHTML = '<span class="stopIcon"></span><span class="stopPic"><i class="stopNo"></i></span><b></b><span class="small"></span>';
      d.firstChild.textContent = open ? TOUR_ICON[k] : '🔒';
      d.querySelector('.stopPic').style.backgroundImage = 'url(art/s' + (k + 1) + 't.jpg)';
      d.querySelector('.stopNo').textContent = k + 1;
      d.querySelector('b').textContent = v;
      d.lastChild.textContent = this.gigWon(k) ? '✔ Gig played' : open ? 'Open' : (TOUR_NEED[k][1]() ? '' : TOUR_NEED[k][0] + '. ') + (this.gigWon(k - 1) ? '' : 'Play the gig at ' + VENUES[k - 1] + '.');
      d.onclick = () => { if (open) { this.k = k; this.render(); } };
      stops.appendChild(d);
    });
    const k = this.k, sv = this.saved(k), box = $('#tourStop');
    box.innerHTML = '<div class="stopBanner"><div class="stopArt"></div><div class="stopTxt"><b></b><span></span></div></div><div class="tourGames"></div>';
    box.querySelector('.stopArt').innerHTML = venueSvg(k, true);
    box.querySelector('.stopTxt b').textContent = TOUR_ICON[k] + ' Stop ' + (k + 1) + ' of ' + VENUES.length + ': ' + VENUES[k];
    box.querySelector('.stopTxt span').textContent = k === VENUES.length - 1 ? 'The last stop. The hardest and fastest music in the whole app.' : 'Four challenges, then the gig: "' + TOUR_MUSIC[k].title + '". Finish the gig to earn this background for your drummer.';
    const grid = box.lastChild;
    const card = (icon, name, skill, level, locked, go, big) => {
      const b = document.createElement('button');
      b.className = 'gameCard' + (level ? ' won' : '') + (locked ? ' locked' : '') + (big ? ' gigCard' : '');
      b.dataset.lv = level || 0;
      b.innerHTML = '<span class="gIcon"></span><b></b><span class="small muted"></span><i class="small"></i>';
      b.firstChild.textContent = locked ? '🔒' : icon;
      b.querySelector('b').textContent = name;
      b.querySelector('span.muted').textContent = skill;
      b.lastChild.textContent = locked || TROPHY[level || 0];
      b.onclick = go;
      grid.appendChild(b);
    };
    TOUR_GAMES.forEach(g => card(g.icon, g.name, 'Tests: ' + g.skill, sv[g.id], '', () => (g.id === 'read' ? this.lesson('read') : this.pick(g.id))));
    const have = this.points(k), need = 4;
    const m = TOUR_MUSIC[k];
    card('🎤', 'The gig: ' + m.title, m.bars.length + ' bars with ' + (m.tempos.length - 1) + ' tempo changes', sv.gig,
      have >= need ? '' : '🔒 Win ' + (need - have) + ' more trophy ' + (need - have === 1 ? 'point' : 'points') + ' first (bronze 1, silver 2, gold 3)', () => { if (have >= need) this.lesson('gig'); }, true);
    if (typeof UI !== 'undefined') UI.tourShown();
  },

  // ----- one warm-up challenge -----
  pick(id) {
    this.stop();
    this.game = TOUR_GAMES.find(g => g.id === id);
    this.view('tourPlay');
    this.theme();
    $('#tourTitle').textContent = this.game.icon + ' ' + this.game.name + ' · ' + VENUES[this.k] + ' (' + (this.pro() ? 'Pro' : 'Rookie') + ')';
    $('#tourGoal').textContent = this.game.how;
    $('#tourStart').textContent = 'Start';
    const host = this.pro() ? 0 : 1;
    $('#tourArea').innerHTML = '<div class="hostBig">' + mascotHtml(host, false) + '</div><div class="tBig small">' + this.game.icon + '</div><div class="tMsg">Your Beat Brother says: press Start when you are ready!</div>';
    this.padReset();
    Buddy.mount(); Buddy.say('Ready when you are!', 0, true);
    this.note(false);
    warmMic();
  },
  note(tried) {
    const msg = !calibrated() ? 'The pad is not set up yet. For now only ' + KEYS_OR_TAP + '. A grown-up can open Setup at the top.'
      : micUserOff && !Ear.listening ? 'The microphone is switched off. Tap "Mic off" to switch it on. Until then only ' + KEYS_OR_TAP + '.'
      : tried && !Ear.listening ? micProblem() + ' Until then only ' + KEYS_OR_TAP + '.' : '';
    $('#tourNote').textContent = msg;
    $('#tourNote').classList.toggle('hidden', !msg);
  },
  async start() {
    if (this.running) { this.stop(); this.pick(this.game.id); return; }
    Ear.ensureCtx();
    if (calibrated() && !micUserOff) await ensureListening();
    if (screen !== 'tour' || this.running || !this.game) return;
    this.note(true);
    this.running = true;
    $('#tourStart').textContent = 'Stop';
    Buddy.mount();
    this[this.game.id + 'Start']();
  },
  stop() {
    this.timers.forEach(clearTimeout); this.timers = [];
    cancelAnimationFrame(this.raf);
    this.running = false; this.s = null;
  },
  // A hit from the microphone: worked out with the pad sounds taught in Setup, exactly as in a lesson.
  audio(h) {
    if (!this.running || !calibrated()) return;
    const want = this.s && this.s.want ? [[this.s.want]] : [];
    const r = Ear.classify(h.feat, { expected: want });
    if (r.click || !r.pads.length) return;
    r.pads.forEach(p => this.hit(p, h.time - settings.offsetMs / 1000));
  },
  hit(pad, time) {
    if (!this.running || !this.s) return;
    this[this.game.id + 'Hit'](pad, time);
  },
  key(e) {
    if (!this.running || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
    const pad = KEY_TO_PAD[e.code];
    if (!pad) return;
    e.preventDefault();
    this.hit(pad, Ear.ctx.currentTime - outLat());
  },
  // The pad picture: light a pad up, or flash it green or red.
  spots(pad) { return SPOTS.filter(x => x.pad === pad).map(x => $('#pt-' + x.key)); },
  padReset() { document.querySelectorAll('#padTour .spot').forEach(g => { g.classList.remove('now', 'hitok', 'hitbad'); g.classList.add('used'); g.style.setProperty('--lvl', 0.25); }); },
  light(pad, on) { this.spots(pad).forEach(g => { g.classList.toggle('now', on); g.style.setProperty('--lvl', on ? 1 : 0.25); }); },
  flash(pad, ok) { this.spots(pad).forEach(g => { g.classList.add(ok ? 'hitok' : 'hitbad'); setTimeout(() => g.classList.remove('hitok', 'hitbad'), 260); }); },
  chip(pad, text) { return '<span class="tChip" style="--c:' + PAD[pad].color + '">' + (text || PAD[pad].name) + '</span>'; },
  known(list, min) { const k = list.filter(p => !calibrated() || Ear.knows(p)); return k.length >= min ? k : list; },

  // A better trophy: remember it and hand out rank points. Returns the points gained.
  win(id, level, each) {
    const sv = this.saved(this.k), old = sv[id] || 0, p = prof();
    if (level <= old) return 0;
    sv[id] = level;
    p.xp += each * (level - old) * (1 + this.k * 0.5);
    p.xp = Math.round(p.xp);
    return Math.round(each * (level - old) * (1 + this.k * 0.5));
  },
  // Save the result of a warm-up challenge and show the result screen.
  finish(level, lines) {
    const id = this.game.id, old = this.saved(this.k)[id] || 0, p = prof(), got = [];
    this.stop();
    const gain = this.win(id, level, 40);
    touchDay();
    if (TOUR_GAMES.every(g => this.saved(this.k)[g.id] === 3)) giveBadge('trophy3', got);
    saveProf();
    this.view('tourDone');
    $('#tdoneFace').innerHTML = faceHtml(p, level > 0);
    $('#tdoneCheer').textContent = level === 3 ? '🥇 Gold trophy' + (p.name ? ', ' + p.name : '') + '!' : level === 2 ? '🥈 Silver trophy!' : level === 1 ? '🥉 Bronze trophy!' : '💪 So close. Try again!';
    const ul = $('#tdoneLines');
    ul.innerHTML = '';
    if (gain) lines.push('New best for ' + this.game.name + ': ' + TROPHY[level] + '. +' + gain + ' rank points.');
    else if (old) lines.push('Your best here is still ' + TROPHY[old] + '.');
    const have = this.points(this.k);
    lines.push(have >= 4 ? '🎤 The gig at ' + VENUES[this.k] + ' is open.' : (4 - have) + ' more trophy ' + (4 - have === 1 ? 'point' : 'points') + ' to open the gig.');
    got.forEach(b => lines.push(b.icon + ' New badge: ' + b.name));
    lines.forEach(t => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
    if (level > 0) { fanfare(level); if (level >= 2 || got.length) confetti(2400); }
  },

  // ----- Echo: listen, then play it back -----
  echoStart() {
    const c = this.cfg().echo;
    this.s = { c, pool: this.known(c.pool, 2), seq: [], round: 0, hearts: 3, pos: 0, phase: 'listen', want: null };
    for (let i = 0; i < c.first; i++) this.echoAdd();
    this.echoPlay();
  },
  echoAdd() {
    const s = this.s;
    // new pads join one at a time as the rounds go on
    const extra = s.c.more.filter(p => !calibrated() || Ear.knows(p))[Math.floor(s.round / 2) - 1];
    if (extra && s.pool.indexOf(extra) < 0) s.pool.push(extra);
    s.seq.push(s.pool[Math.floor(Math.random() * s.pool.length)]);
  },
  echoDraw(lit) {
    const s = this.s, hide = !s.c.show && s.phase !== 'listen';
    $('#tourArea').innerHTML =
      '<div class="tTop"><span>Round ' + Math.min(s.round + 1, s.c.rounds) + ' of ' + s.c.rounds + '</span><span class="tHearts">' + '❤'.repeat(s.hearts) + '♡'.repeat(3 - s.hearts) + '</span></div>' +
      '<div class="tLbl">' + (s.phase === 'listen' ? '👂 Listen…' : 'Your buddy played') + '</div>' +
      '<div class="tRow">' + s.seq.map((p, i) => (s.phase === 'listen' ? i <= lit : !hide) ? this.chip(p).replace('tChip', 'tChip' + (i === lit ? ' lit' : '')) : '<span class="tChip empty">♪</span>').join('') + '</div>' +
      '<div class="tLbl">' + (s.phase === 'play' ? '🥁 Your turn!' : 'Your turn comes next') + '</div>' +
      '<div class="tRow">' + s.seq.map((p, i) => i < s.pos ? this.chip(p, '✔ ' + PAD[p].name) : '<span class="tChip empty">?</span>').join('') + '</div>';
  },
  echoPlay() {
    const s = this.s, ctx = Ear.ctx, t0 = ctx.currentTime + 0.5;
    s.phase = 'listen'; s.pos = 0; s.want = null;
    this.padReset();
    this.echoDraw(-1);
    Buddy.say('Listen first…', 1500, true);
    s.seq.forEach((p, i) => {
      Ear.drum(p, t0 + i * s.c.gap);
      this.later(() => { this.padReset(); this.light(p, true); Buddy.play(); this.echoDraw(i); }, (0.5 + i * s.c.gap) * 1000);
    });
    this.later(() => {
      s.phase = 'play'; s.want = s.seq[0];
      this.padReset(); this.echoDraw(-1);
      Buddy.say('Your turn!', 1500, true);
    }, (0.5 + s.seq.length * s.c.gap) * 1000 + 300);
  },
  echoHit(pad) {
    const s = this.s;
    if (s.phase !== 'play') return;
    if (pad === s.seq[s.pos]) {
      this.flash(pad, true); Buddy.play();
      s.pos++; s.want = s.seq[s.pos] || null;
      if (s.pos < s.seq.length) { this.echoDraw(-1); return; }
      s.round++; s.phase = 'wait';
      this.echoDraw(-1);
      if (s.round >= s.c.rounds) { this.later(() => this.echoEnd(), 700); return; }
      Buddy.mood('cheer', 900); Buddy.say(Buddy.pick(['Yes! One more hit now.', 'Great ears!', 'Spot on! It gets longer.']), 1500, true);
      this.later(() => { this.echoAdd(); this.echoPlay(); }, 1300);
    } else {
      this.flash(pad, false); Buddy.miss(0, true);
      s.hearts--; s.phase = 'wait';
      this.echoDraw(-1);
      if (s.hearts <= 0) { this.later(() => this.echoEnd(), 800); return; }
      Buddy.say('Not quite. Listen again.', 1600, true);
      this.later(() => this.echoPlay(), 1400);
    }
  },
  echoEnd() {
    const s = this.s, r = s.round, n = s.c.rounds;
    const level = r >= n && s.hearts >= 2 ? 3 : r >= n - 1 ? 2 : r >= Math.ceil(n / 2) ? 1 : 0;
    this.finish(level, ['Rounds played back: ' + r + ' of ' + n + '.', 'Longest pattern remembered: ' + (r ? s.c.first + r - 1 : 0) + ' hits.',
      level < 3 ? 'For gold: all ' + n + ' rounds with two hearts left.' : 'A perfect memory for rhythm!']);
  },

  // ----- Quick sticks: hit the pad that is called out -----
  quickStart() {
    const c = this.cfg().quick;
    this.s = { c, pool: this.known(c.pool, 3), i: 0, ok: 0, wrong: 0, times: [], want: null, marks: [] };
    Buddy.say('Eyes open… here they come!', 1600, true);
    this.later(() => this.quickNext(), 900);
  },
  quickDraw(msg) {
    const s = this.s, p = s.want;
    $('#tourArea').innerHTML =
      '<div class="tTop"><span>' + Math.min(s.i + 1, s.c.n) + ' of ' + s.c.n + '</span><span>✔ ' + s.ok + '</span></div>' +
      (p ? '<div class="tLbl">Hit the</div><div class="tCall" style="--c:' + PAD[p].color + '">' + PAD[p].name + '</div><div class="tBar"><i style="animation-duration:' + s.c.ms + 'ms"></i></div>'
        : '<div class="tMsg">' + (msg || '') + '</div>') +
      '<div class="tDots">' + s.marks.map(m => '<span class="' + (m ? 'ok' : 'no') + '"></span>').join('') + '<span class="cur"></span>'.repeat(p ? 1 : 0) + '</div>';
  },
  quickNext() {
    const s = this.s;
    if (s.i >= s.c.n) { this.quickEnd(); return; }
    let p;
    do { p = s.pool[Math.floor(Math.random() * s.pool.length)]; } while (p === s.last);
    s.last = s.want = p; s.t0 = performance.now();
    this.padReset();
    if (s.c.light) this.light(p, true);
    this.quickDraw();
    s.timer = this.later(() => {   // too slow: show where it was, then move on
      s.want = null; s.marks.push(0); s.i++;
      this.padReset(); this.light(p, true);
      Buddy.miss(0, false);
      this.quickDraw('Too slow! It was here: ' + PAD[p].name);
      this.later(() => this.quickNext(), 1100);
    }, s.c.ms);
  },
  quickHit(pad) {
    const s = this.s;
    if (!s.want) return;
    if (pad !== s.want) { s.wrong++; this.flash(pad, false); return; }
    clearTimeout(s.timer);
    s.times.push(performance.now() - s.t0);
    s.ok++; s.marks.push(1); s.i++; s.want = null;
    this.flash(pad, true); Buddy.play();
    if (s.ok % 5 === 0) { Buddy.mood('cheer', 900); Buddy.say(s.ok + ' right! Fast hands!', 1400, true); }
    this.padReset();
    this.quickDraw('✔');
    this.later(() => this.quickNext(), 420);
  },
  quickEnd() {
    const s = this.s, acc = s.ok / s.c.n;
    const avg = s.times.length ? s.times.reduce((a, b) => a + b, 0) / s.times.length / 1000 : 0;
    const level = acc >= 0.95 && s.wrong <= 2 ? 3 : acc >= 0.8 ? 2 : acc >= 0.6 ? 1 : 0;
    this.finish(level, ['Right pads: ' + s.ok + ' of ' + s.c.n + '.', 'Wrong pads hit on the way: ' + s.wrong + '.',
      s.times.length ? 'Your speed: ' + avg.toFixed(1) + ' seconds on average.' : 'No pad was found in time.',
      level < 3 ? 'For gold: nearly every pad right, with at most two wrong hits.' : 'You know your pad by heart!']);
  },

  // ----- Steady beat: keep time while the click goes silent -----
  steadyStart() {
    const c = this.cfg().steady, ctx = Ear.ctx;
    const s = this.s = { c, spb: 60 / c.bpm, t0: ctx.currentTime + 0.4, next: -4, total: c.bars.length * 4, err: {}, want: null, drawn: -99 };
    const bars = c.bars.map((on, i) => '<span class="tBarCell' + (on ? ' on' : '') + '" data-b="' + i + '"></span>').join('');
    $('#tourArea').innerHTML =
      '<div class="tTop"><span id="stBar">Count in…</span><span>' + c.bpm + ' BPM</span></div>' +
      '<div class="tBars">' + bars + '</div><div class="tLbl small">Bright bars have a click. Dark bars are silent: you keep the beat.</div>' +
      '<div class="tBeat"><span></span><span></span><span></span><span></span></div>' +
      '<div class="tGauge"><i class="zone"></i><i id="stNeedle" class="needle"></i></div><div class="tGaugeLbl"><span>Early</span><span>On the beat</span><span>Late</span></div>';
    Buddy.say('Hit any pad on every beat!', 2200, true);
    const loop = () => {
      if (!this.running || this.s !== s) return;
      const now = ctx.currentTime, pos = (now - outLat() - s.t0) / s.spb - 4;   // the beat the player hears right now
      while (s.t0 + (s.next + 4) * s.spb < now + 0.15) {
        const k = s.next++, t = s.t0 + (k + 4) * s.spb;
        if (k < s.total && t >= now && (k < 0 || c.bars[Math.floor(k / 4)])) Ear.click(t, ((k % 4) + 4) % 4 === 0);
      }
      const bi = Math.floor(pos);
      if (bi !== s.drawn) {
        s.drawn = bi;
        const bar = Math.floor(bi / 4);
        document.querySelectorAll('#tourArea .tBeat span').forEach((e, i) => e.classList.toggle('lit', i === ((bi % 4) + 4) % 4));
        document.querySelectorAll('#tourArea .tBarCell').forEach((e, i) => { e.classList.toggle('cur', i === bar); e.classList.toggle('past', i < bar); });
        if (bi >= 0 && bi < s.total) {
          $('#stBar').textContent = 'Bar ' + (bar + 1) + ' of ' + c.bars.length + (c.bars[bar] ? '' : ' · the click is silent');
          if (bi % 4 === 0 && !c.bars[bar] && (bar === 0 || c.bars[bar - 1])) Buddy.say('Silent now. Keep going!', 1800, true);
          Buddy.beat(bi);
        }
      }
      if (pos > s.total + 0.6) { this.steadyEnd(); return; }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  },
  steadyHit(pad, time) {
    const s = this.s, k = Math.round((time - s.t0) / s.spb - 4);
    if (k < 0 || k >= s.total) return;
    const err = (time - (s.t0 + (k + 4) * s.spb)) * 1000;
    if (s.err[k] === undefined || Math.abs(err) < Math.abs(s.err[k])) s.err[k] = err;
    this.flash(pad, Math.abs(err) <= s.c.loose); Buddy.play();
    $('#stNeedle').style.left = (50 + Math.max(-48, Math.min(48, err / 250 * 48))) + '%';
  },
  steadyEnd() {
    const s = this.s, c = s.c;
    let sum = 0, wsum = 0, onBeat = 0, quiet = [], hits = 0;
    for (let k = 0; k < s.total; k++) {
      const silent = !c.bars[Math.floor(k / 4)], w = silent ? 2 : 1, e = s.err[k];
      const a = e === undefined ? Infinity : Math.abs(e);
      if (a < Infinity) hits++;
      if (a <= c.tight) onBeat++;
      if (silent && a < Infinity) quiet.push(a);
      sum += w * (a <= c.tight ? 1 : a <= c.loose ? 0.6 : a < Infinity ? 0.25 : 0);
      wsum += w;
    }
    const score = sum / wsum, level = score >= 0.85 ? 3 : score >= 0.7 ? 2 : score >= 0.5 ? 1 : 0;
    const q = quiet.length ? Math.round(quiet.reduce((a, b) => a + b, 0) / quiet.length) : null;
    this.finish(level, ['Beats you played: ' + hits + ' of ' + s.total + '.', 'Right on the beat: ' + onBeat + ' of ' + s.total + '.',
      q === null ? 'No hits landed in the silent bars.' : 'In the silent bars you were ' + q + ' ms off on average. Lower is better.',
      level < 3 ? 'For gold: stay on the beat through the silent bars too.' : 'A rock-steady inner clock!']);
  },

  // ----- written music on the lesson screen: the sight-reading test and the gig -----
  // Rookie plays slower with the falling notes as help; Pro plays at full tempo from the sheet alone.
  piece(kind) {
    const k = this.k, m = TOUR_MUSIC[k], pro = this.pro(), slow = pro ? 1 : 0.8;
    const five = (bpm) => Math.max(40, Math.round(bpm * slow / 5) * 5);
    if (kind === 'gig') {
      return { id: 'G' + k, title: m.title, div: m.div, reps: 1, bars: m.bars, bpm: five(m.tempos[0][1]), tempos: m.tempos.map(t => [t[0], five(t[1])]),
        goal: m.bars.length + ' bars. Watch out: the tempo changes ' + (m.tempos.length - 1) + ' times.', tip: 'Keep your eyes a little ahead of the red line, and keep going if you slip.' };
    }
    // Sight reading: bars picked fresh every time, so they cannot be learned by heart.
    const pick = () => m.read[Math.floor(Math.random() * m.read.length)], bars = [];
    if (pro) for (let i = 0; i < 8; i++) bars.push(pick());
    else { const a = pick(); let b = pick(); if (b === a) b = pick(); bars.push(a, a, b, b); }
    return { id: 'R' + k, title: 'Sight reading at ' + VENUES[k], div: m.div, reps: 1, bars, bpm: five(m.readBpm + (pro ? 12 : 0)),
      goal: (pro ? 'Eight' : 'Four') + ' new bars. No falling notes: read the sheet.', tip: 'Look at the whole line before you press Start. Count out loud.' };
  },
  lesson(kind) {
    const k = this.k, l = this.piece(kind);
    this.stop();
    G.track = null; G.idx = 0;
    G.gig = { stop: k, kind };
    G.title = (kind === 'gig' ? '🎤 The gig at ' + VENUES[k] + ': ' : '🎼 ') + l.title;
    setLesson(l);
    show('play');
    gigLock(true, kind === 'read' || this.pro(), kind === 'read');
  },
  // Called from the lesson's result screen. Returns the lines to show there.
  lessonDone(stars) {
    const g = G.gig, p = prof(), out = [];
    this.k = g.stop;
    if (g.kind === 'read') {
      const gain = this.win('read', stars, 40);
      out.push(stars ? '🎼 Sight-reading trophy: ' + TROPHY[stars] + (gain ? '. +' + gain + ' rank points' : '') : '🎼 Sight reading needs one star for a trophy. Read it once more!');
    } else {
      const first = stars >= 1 && !this.gigWon(g.stop);
      const gain = this.win('gig', stars, 60);
      out.push(stars ? '🎤 Gig trophy: ' + TROPHY[stars] + (gain ? '. +' + gain + ' rank points' : '') : '🎤 The gig needs one star for a trophy. Play it again!');
      if (first) {   // the stop is done: its scene becomes the drummer's background, straight away
        p.av = avOf(p); p.av.scene = g.stop + 1;
        out.push('🖼️ New background earned: ' + VENUES[g.stop] + '! Your drummer is wearing it now.');
        if (g.stop + 1 < VENUES.length) out.push(TOUR_NEED[g.stop + 1][1]() ? '🚌 Next stop open: ' + VENUES[g.stop + 1] + '!' : '🚌 Next stop: ' + VENUES[g.stop + 1] + '. It also needs: ' + TOUR_NEED[g.stop + 1][0] + '.');
        if (!p.badges.tour1) { giveBadge('tour1'); out.push('🎤 New badge: Room rocker'); }
        if (g.stop === VENUES.length - 1 && !p.badges.galaxy) { giveBadge('galaxy'); out.push('🌌 New badge: Galaxy drummer'); }
      }
    }
    saveProf();
    return out;
  },

  init() {
    buildPadMap('#padTour', 'pt-', false);
    $('#tourStart').onclick = () => this.start();
    $('#tourBack').onclick = () => this.render();
    $('#tdoneBack').onclick = () => this.render();
    $('#tdoneAgain').onclick = () => this.pick(this.game.id);
    document.querySelectorAll('#tourLv button').forEach(b => { b.onclick = () => { prof().level = b.dataset.lv; saveProf(); this.render(); }; });
    $('#padTour').addEventListener('pointerdown', (e) => {
      const g = e.target.closest ? e.target.closest('.spot') : null;
      if (!g || !this.running) return;
      const sp = SPOTS.find(x => 'pt-' + x.key === g.id);
      if (!sp) return;
      e.preventDefault();
      this.hit(sp.pad, Ear.ctx.currentTime - outLat());
    });
  }
};

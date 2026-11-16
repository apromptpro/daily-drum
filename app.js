'use strict';
const $ = (s) => document.querySelector(s);
// Several children can share a device. Stars, rank and history are kept per player; the pad sounds and settings are shared.
// The first player uses the plain names ("dc.progress"), so everything saved before players existed is still theirs.
const PLAYER = (() => { try { return localStorage.getItem('dc.current') || ''; } catch (e) { return ''; } })();
const PER_PLAYER = { progress: 1, profile: 1, history: 1, session: 1 };
const keyOf = (k, id) => { const p = id === undefined ? PLAYER : id; return 'dc.' + (PER_PLAYER[k] && p ? p + '.' : '') + k; };
const store = {
  get(k, d, id) { try { const v = localStorage.getItem(keyOf(k, id)); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) {
    try { localStorage.setItem(keyOf(k), JSON.stringify(v)); } catch (e) {}
    if ((k === 'progress' || k === 'profile' || k === 'history') && typeof Online !== 'undefined') Online.touch();   // logged in: save it online too
  },
  del(k, id) { try { localStorage.removeItem(keyOf(k, id)); } catch (e) {} }
};
const settings = Object.assign({ deviceId: '', sens: 50, monitor: false, offsetMs: 60, clickVol: 50 }, store.get('settings', {}));
const progress = store.get('progress', {});   // lesson or song id -> { best: 0..1, stars: 0..3 }
const saveSettings = () => store.set('settings', settings);
{ // keep only sounds this version knows by name, so a stored set from an older version can never break the app
  const saved = store.get('cal2', {}), ok = {};
  Object.keys(saved).forEach(k => { if (k === '_click' || k.split('+').every(p => PAD[canon(p)])) ok[k] = saved[k]; });
  Ear.importTemplates(ok);
}
Ear.clickVolume = settings.clickVol / 100;

let screen = 'home';
const TOUCH = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);   // a tablet or phone: no mouse, usually no keyboard
const KEYS_OR_TAP = TOUCH ? 'tapping the pad picture works' : 'the keyboard keys and tapping the pad picture work';
let micError = null;
const calibrated = () => Ear.padIds().length > 0;
const starsHtml = (n) => '★★★'.split('').map((s, i) => i < n ? s : '<span class="off">★</span>').join('');
const fmtTime = (s) => Math.floor(s / 60) + ':' + ('0' + Math.floor(s % 60)).slice(-2);
// Sound leaves the speakers or headphones a little after the app plays it (much later over Bluetooth).
// The picture and the keyboard keys are judged against what is heard, not against what was sent.
const outLat = () => {
  const c = Ear.ctx;
  const v = c ? (c.outputLatency || c.baseLatency || 0) : 0;
  return Math.max(0, Math.min(0.3, v));
};

function show(name) {
  if (screen === 'play' && name !== 'play' && name !== 'recap' && G.running) stopRun(false);
  if (Cal.active && name !== 'setup') calPause();
  if (Chk.active && name !== 'setup') chkStop();
  if (Lat.active && name !== 'setup') { clearTimeout(Lat.timer); Lat.active = false; $('#latBtn').disabled = false; $('#latOut').textContent = ''; }
  if (G.test && name !== 'play' && name !== 'testDone') endTest('');   // leaving in the middle of a test ends it
  if (Online.blocked() && name !== 'account') name = 'account';   // nothing opens without an approved account
  document.body.classList.toggle('locked', Online.blocked());
  if (name === 'hub') { renderHub(); Online.renderMsgs(); }
  if (name === 'account') Online.renderAccount();
  if (name === 'friends') Online.renderFriends();
  if (name === 'inbox') Online.renderInbox();
  $('#navFriends').classList.toggle('active', name === 'friends');
  $('#navHub').classList.toggle('active', name === 'hub');
  $('#meMenu').classList.add('hidden');
  if (screen === 'tour' && name !== 'tour') Tour.stop();
  if (G.gig && name !== 'play' && name !== 'recap') { G.gig = null; gigLock(false); }
  Buddy.sfx = name === 'tour' ? 'T' : '';   // the buddy lives on the lesson screen and on the Tour screen
  if (name === 'tour') Tour.render();
  $('#navTour').classList.toggle('active', name === 'tour');
  ['hub', 'account', 'inbox', 'friends', 'tour', 'home', 'songs', 'me', 'learn', 'progress', 'setup', 'play', 'recap', 'testDone', 'cert'].forEach(id => $('#' + id).classList.toggle('hidden', id !== name));
  $('#navSongs').classList.toggle('active', name === 'songs');
  $('#navMe').classList.toggle('active', name === 'me');
  if (name === 'me') renderMe();
  renderHeader();
  if (name !== 'learn' && Lab.on) labStop();
  if (name !== 'learn' && Read.on) readStop();
  if (name !== 'learn' && Quiz.on) quizStop();
  $('#navLearn').classList.toggle('active', name === 'learn');
  $('#navProgress').classList.toggle('active', name === 'progress');
  if (name === 'progress') renderProgress();
  window.scrollTo(0, 0);
  screen = name;
  $('#navHome').classList.toggle('active', name === 'home');
  $('#navSetup').classList.toggle('active', name === 'setup');
  if (name === 'home' || name === 'songs') renderHome();
  if (name === 'setup') { Cal.msg = ''; calUi(); }
  if (name === 'play') { updatePlayNote(false); requestAnimationFrame(draw); warmMic(); }
}

function updateStatus() {
  const el = $('#earStatus');
  el.textContent = Ear.listening ? 'Mic on' : 'Mic off';
  el.title = Ear.listening ? 'The microphone is listening to your pad' : 'The microphone is off. It switches on when you press Start.';
  el.classList.toggle('on', Ear.listening);
}
const floorFromSens = (s) => 0.1 * Math.pow(10, -2 * s / 100);
const meterPos = (rms) => Math.max(0, Math.min(1, (Math.log10(Math.max(rms, 1e-5)) + 3.3) / 3.3));
function applyInputSettings() {
  Ear.setFloor(floorFromSens(settings.sens));
  Ear.setMonitor(false);   // never replay the microphone through the speakers (it would howl)
  $('#meterMark').style.left = (meterPos(floorFromSens(settings.sens)) * 100) + '%';
}
let micPending = null;   // one microphone start at a time: a second click waits for the first instead of opening it twice
function ensureListening() {
  if (Ear.listening) return Promise.resolve(true);
  if (!micPending) {
    micPending = (async () => {
      try {
        await Ear.start(settings.deviceId);
        micError = null;
        applyInputSettings();
        if (!settings.micOk) { settings.micOk = true; saveSettings(); }
        return true;
      } catch (e) {
        micError = e;
        return false;
      } finally {
        micPending = null;
        updateStatus();
      }
    })();
  }
  return micPending;
}
// Get the microphone ready as soon as a lesson or a Tour challenge is opened, so that Start begins at once.
// It is opened ahead of time only where the app has been allowed to listen before; a device that has never been
// asked is asked when Start is pressed, as always.
function warmMic() {
  if (Ear.listening || micPending || !calibrated()) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
  try { Ear.ensureCtx(); Ear.loadModule().catch(() => {}); } catch (e) { return; }
  const go = () => { if (screen === 'play' || screen === 'tour') ensureListening().then(() => { if (screen === 'play') updatePlayNote(false); }); };
  const fallback = () => { if (settings.micOk) go(); };
  try {
    navigator.permissions.query({ name: 'microphone' }).then(s => { if (s.state === 'granted' || (s.state === 'prompt' && settings.micOk)) go(); }, fallback);
  } catch (e) { fallback(); }
}
// Coming back to the app (the tablet was locked, or another app was open): the microphone may have been taken away.
document.addEventListener('visibilitychange', () => {
  if (document.hidden || (screen !== 'play' && screen !== 'tour')) return;
  if (Ear.ctx) Ear.ensureCtx();
  if (screen === 'play' || Tour.game) warmMic();
});
// How long after a note a hit on it can still arrive: the measured sound delay plus the time taken to record the hit.
const hearDelay = () => Math.max(0, settings.offsetMs / 1000, outLat()) + 0.07;
function micProblem() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return 'This page is not allowed to use a microphone. Its address must begin with https:// (or with http://localhost on the laptop, which start.bat gives you).';
  }
  const n = micError && micError.name;
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'No microphone was found on this device.';
  if (n === 'NotReadableError') return 'Another program is using the microphone. Close it and try again.';
  return TOUCH
    ? 'The microphone is blocked. Allow the microphone for this page (on an iPad: Settings, Apps, Safari, Microphone, or the button at the left of the address bar), and try again.'
    : 'The microphone is blocked. Click the icon left of the address bar, allow the microphone for this page, and try again.';
}
Ear.onLost = () => { updateStatus(); if (Cal.active) calPause(micProblem()); if (screen === 'play') updatePlayNote(true); };

// ---------- Lessons list ----------
const openLevels = {};   // levels the user folded or unfolded by hand, for this visit
function renderHome() {
  $('#setupBanner').classList.toggle('hidden', calibrated());
  $('#lessonList').innerHTML = '';
  $('#songList').innerHTML = '';
  renderProfile();
  let nLesson = 0, nSong = 0;
  // Lessons are grouped into levels. Levels up to the one being worked on start open; later ones start folded.
  const done = (l) => !!(progress[l.id] && progress[l.id].stars > 0);
  const levels = [];
  LESSONS.forEach(l => { if (l.song) return; if (l.level) levels.push({ name: l.level[0], note: l.level[1], stage: l.level[2], items: [] }); levels[levels.length - 1].items.push(l); });
  let current = levels.findIndex(v => !v.items.every(done));
  if (current < 0) current = levels.length - 1;
  levels.forEach((v, k) => {
    const d = document.createElement('details');
    d.className = 'level';
    d.open = openLevels[v.name] !== undefined ? openLevels[v.name] : k <= current;
    d.ontoggle = () => { openLevels[v.name] = d.open; };
    const s = document.createElement('summary');
    const n = v.items.filter(done).length;
    s.innerHTML = '<b></b><span class="muted small"></span><span class="cnt small"></span>';
    s.querySelector('b').textContent = v.name;
    s.querySelector('.muted').textContent = v.note;
    s.querySelector('.cnt').textContent = n + ' of ' + v.items.length + ' done';
    if (n === v.items.length) s.querySelector('.cnt').classList.add('all');
    d.appendChild(s);
    if (TEACH[k]) d.appendChild(teachBlock(k));
    const box = document.createElement('div');
    box.className = 'lessons';
    d.appendChild(box);
    v.box = box; v.el = d;
    if (v.stage && (k === 0 || levels[k - 1].stage !== v.stage)) {
      const h = document.createElement('h2');
      h.className = 'stageHead';
      h.textContent = v.stage;
      $('#lessonList').appendChild(h);
    }
    $('#lessonList').appendChild(d);
  });
  let lv = -1;
  LESSONS.forEach((l, i) => {
    if (!l.song && l.level) lv++;
    const list = l.song ? $('#songList') : levels[lv].box;
    const b = document.createElement('button');
    b.className = 'lesson';
    const p = progress[l.id];
    b.innerHTML = '<span class="n">' + (l.song ? '♪' + (++nSong) : ++nLesson) + '</span><span class="t"><b></b><span class="muted small"></span></span>' +
      '<span class="mm small">' + (p && repTier(p.reps) ? '<span title="' + p.reps + ' clean runs">' + repTier(p.reps)[2] + '×' + p.reps + '</span> ' : '') + (!l.song && p && p.bpm ? (mastered(l) ? '👑 ' : '⚡ ') + p.bpm + ' BPM' : '') + '</span>' +
      '<span class="s">' + starsHtml(p ? p.stars : 0) + '</span>';
    b.querySelector('b').textContent = l.title;
    b.querySelector('.t span').textContent = feelOf(l) + '. ' + l.goal;
    b.onclick = () => openLesson(i);
    list.appendChild(b);
  });
  // Every level ends with a test, every stage with an exam. Nothing is locked.
  levels.forEach((v, k) => {
    v.box.appendChild(testRow('level', k));
    if (k === levels.length - 1 || levels[k + 1].stage !== v.stage) v.el.after(testRow('exam', v.stage));
  });
  renderTracks();
}

// ---------- Your own music: the list ----------
const TRACK_ERR = {
  bad: 'This file could not be opened. Use an MP3, M4A or WAV file that is not copy-protected.',
  short: 'That file is shorter than 20 seconds. Pick a whole song.',
  nobeat: 'The app could not find a steady beat in this song. Try a song with clear drums.',
  gone: 'This song is no longer stored in the browser. Add the file again.'
};
const partOf = (rec) => TRACK_PARTS.find(p => p.id === rec.part) || TRACK_PARTS[0];
function renderTracks() {
  const box = $('#trackList');
  box.innerHTML = '';
  Track.list().forEach(rec => {
    const row = document.createElement('div');
    row.className = 'trackRow';
    const b = document.createElement('button');
    b.className = 'lesson';
    const p = progress[rec.id];
    b.innerHTML = '<span class="n">♫</span><span class="t"><b></b><span class="muted small"></span></span><span class="s">' + starsHtml(p ? p.stars : 0) + '</span>';
    b.querySelector('b').textContent = rec.name;
    b.querySelector('.t span').textContent = partOf(rec).name + ', ' + fmtTime(rec.dur);
    b.onclick = () => loadTrack(rec, null);
    const del = document.createElement('button');
    del.textContent = 'Remove';
    del.title = 'Removes the song from this app. The file on your device is not touched.';
    del.onclick = () => {
      if (trackBusy) return;   // a song is being opened right now
      if (!del.dataset.sure) {   // ask once more before removing
        del.dataset.sure = '1'; del.textContent = 'Really remove?';
        setTimeout(() => { delete del.dataset.sure; del.textContent = 'Remove'; }, 3000);
        return;
      }
      delete progress[rec.id];
      store.set('progress', progress);
      if (G.track && G.track.id === rec.id) G.track = null;
      Track.remove(rec.id).then(renderTracks);
    };
    row.appendChild(b); row.appendChild(del);
    box.appendChild(row);
  });
}
let trackBusy = false;
async function loadTrack(rec, file) {
  if (trackBusy) return;
  trackBusy = true;
  const say = (t) => { $('#songMsg').textContent = t; };
  try {
    Ear.ensureCtx();
    if (file) await Track.add(file, say); else await Track.open(rec, say);
    if (Track.totalBeats() < 4) throw new Error('nobeat');
    if (screen !== 'home') {   // the player went somewhere else while the song was opening: do not pull them away
      say('');
    } else {
      say(Track.rec.notStored ? 'The browser could not store this song, so you will have to add it again next time.' : '');
      openTrack(!!file);
    }
  } catch (e) {
    say(TRACK_ERR[e.message] || TRACK_ERR.bad);
    if (e.message === 'gone' && rec) { await Track.remove(rec.id); renderTracks(); }
  }
  trackBusy = false;
}

// ---------- Setup: input ----------
async function fillDevices() {
  const sel = $('#deviceSel');
  const inputs = await Ear.listInputs();
  sel.innerHTML = '<option value="">Default microphone</option>';
  let count = 0;
  inputs.forEach(d => {
    if (!d.deviceId || d.deviceId === 'default' || d.deviceId === 'communications') return;
    const o = document.createElement('option');
    o.value = d.deviceId;
    o.textContent = d.label || 'Microphone';
    sel.appendChild(o);
    count++;
  });
  sel.value = settings.deviceId;
  if (sel.value !== settings.deviceId) sel.value = '';
  sel.classList.toggle('hidden', count < 2);   // only offer a choice when there is more than one microphone
}
async function connect() {
  if (micPending) await micPending;
  settings.deviceId = $('#deviceSel').value;
  saveSettings();
  Ear.stop();
  const ok = await ensureListening();
  if (ok) {
    await fillDevices();
    $('#connectBtn').textContent = 'Microphone is on';
    $('#meterTxt').textContent = 'Hit a pad: the bar should jump past the line.';
  } else {
    $('#connectBtn').textContent = 'Turn on microphone';
    $('#meterTxt').textContent = micProblem();
  }
}
$('#deviceSel').onchange = connect;
Ear.onLevel = (rms) => { if (screen === 'setup') $('#meterBar').style.width = (meterPos(rms) * 100) + '%'; };
Ear.onOnset = (time) => {
  // Instant "I heard that" pulse on the hit line; the pad name and grade follow about 45 ms later.
  if (screen !== 'play' || !G.running) return;
  if (G.demo) return;
  if (Ear.templates._click && G.metroMode === 'sound' && !G.wait) {
    const b = beatAt(time - settings.offsetMs / 1000);
    if (Math.abs(b - Math.round(b)) * beatSec() < 0.04) return;   // probably the metronome click itself
  }
  G.heard = performance.now();
};
Ear.onHit = (h) => {
  if (Lat.active) latHit(h);
  else if (Cal.active) calHit(h);
  else if (Chk.active) chkHit(h);
  else if (screen === 'setup') testHit(h);
  else if (screen === 'play') gameAudioHit(h);
  else if (screen === 'tour') Tour.audio(h);
  else if (screen === 'learn') quizAudio(h);
};

// ---------- Setup: pad map ----------
// The picture is the real roll-up pad seen from the player's seat. Every spot can be clicked to teach just that one.
// "key" is the name its sound is stored under; two spots can be the same instrument (two crashes, kick pedal and Bass Drum pad).
const CAL_NEED = 8;    // hits asked for when a pad is taught
const CAL_KEEP = 32;   // the most hits remembered for one pad
const SPOTS = [
  { key: 'crash',   pad: 'crash',   label: 'Crash',     x: 95,  y: 66,  r: 30, say: 'Hit the LEFT Crash 8 times.' },
  { key: 'crash2',  pad: 'crash',   label: 'Crash',     x: 325, y: 66,  r: 30, say: 'Hit the RIGHT Crash 8 times.' },
  { key: 'hihat',   pad: 'hihat',   label: 'Open Hi-Hat', x: 52, y: 140, r: 34, first: 'hihatopen', say: 'Same pad again: press the other pedal (not the kick) down and keep it down. Hit the pad 8 times. It should sound short.' },
  { key: 'tom1',    pad: 'tom1',    label: 'High Tom',  x: 165, y: 128, r: 38, say: 'Hit the High Tom 8 times.' },
  { key: 'tom2',    pad: 'tom2',    label: 'Low Tom',   x: 255, y: 128, r: 38, say: 'Hit the Low Tom 8 times.' },
  { key: 'ride',    pad: 'ride',    label: 'Ride',      x: 368, y: 140, r: 34, say: 'Hit the Ride 8 times.' },
  { key: 'snare',   pad: 'snare',   label: 'Snare',     x: 100, y: 222, r: 46, say: 'Hit the Snare 8 times.' },
  { key: 'kickpad', pad: 'kick',    label: 'Bass Drum', x: 210, y: 226, r: 40, say: 'Hit the Bass Drum pad with a stick 8 times.' },
  { key: 'tom3',    pad: 'tom3',    label: 'Floor Tom', x: 320, y: 222, r: 46, say: 'Hit the Floor Tom 8 times.' },
  { key: 'kick',    pad: 'kick',    label: 'Kick pedal',   x: 150, y: 310, r: 0, say: 'Try both pedals. One makes a deep "boom" like the example: press that one 8 times.' },
  { key: 'hhpedal', pad: 'hhpedal', label: 'Hi-hat pedal', x: 270, y: 310, r: 0, say: 'Press the other pedal 8 times. It should make a short "tick" like the example. If it makes no sound of its own, skip it.' }
];
const SPOT = {};
SPOTS.forEach(s => { SPOT[s.key] = s; });
// The Open Hi-Hat is one pad with two sounds: ringing with the foot up, short with the hi-hat pedal held down.
// It is taught in two steps on the same spot: foot up first ("hihatopen"), then pedal down ("hihat").
SPOT.hihatopen = { key: 'hihatopen', pad: 'hihat', label: 'Open Hi-Hat', on: 'hihat', next: 'hihat', say: 'Feet off the pedals. Hit the Open Hi-Hat 8 times and let it ring.' };
const keysOf = (s) => s.first ? [s.first, s.key] : [s.key];
const spotEl = (key) => SPOT[key] && SPOT[key].combo ? $('#cb-' + key.replace(/\+/g, '_')) : $('#pm-' + ((SPOT[key] && SPOT[key].on) || key));
// Pads that some lesson asks for at the same moment ("hihat+kick"). Teaching these is optional: the app then knows
// how the two really sound together instead of guessing from the single sounds.
const COMBOS = (() => {
  const seen = {};
  LESSONS.forEach(l => l.bars.forEach(bar => {
    const pads = Object.keys(bar), len = Math.max.apply(null, pads.map(p => bar[p].length));
    for (let i = 0; i < len; i++) {
      const g = pads.filter(p => bar[p][i] === 'x').sort();
      if (g.length > 1 && g.length < 4) seen[g.join('+')] = (seen[g.join('+')] || 0) + 1;
    }
  }));
  return Object.keys(seen).sort((a, b) => seen[b] - seen[a]);
})();
COMBOS.forEach(k => {
  const names = k.split('+').map(p => PAD[p].name);
  SPOT[k] = { key: k, combo: k.split('+'), label: names.join(' + '),
    say: 'Hit ' + names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] + ' at exactly the same moment. Do it 8 times.' };
});
function buildCombos() {
  const box = $('#comboList');
  COMBOS.forEach(k => {
    const b = document.createElement('button');
    b.className = 'combo'; b.id = 'cb-' + k.replace(/\+/g, '_');
    b.innerHTML = '<span></span><i>✓</i>';
    b.firstChild.textContent = SPOT[k].label;
    b.onclick = () => calPick(k, false);
    box.appendChild(b);
  });
}
function buildPadMap(sel, prefix, pick) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = $(sel);
  const mk = (tag, attrs, parent, text) => {
    const el = document.createElementNS(ns, tag);
    Object.keys(attrs).forEach(k => el.setAttribute(k, attrs[k]));
    if (text !== undefined) el.textContent = text;
    (parent || svg).appendChild(el);
    return el;
  };
  mk('rect', { class: 'box', x: 160, y: 4, width: 100, height: 34, rx: 8 });
  mk('rect', { class: 'mat', x: 6, y: 24, width: 408, height: 256, rx: 64 });
  mk('text', { class: 'logo', x: 210, y: 62 }, null, 'DRUMS');
  SPOTS.forEach(s => {
    const g = mk('g', { class: s.r ? 'spot' : 'spot pedal', id: prefix + s.key, tabindex: 0, role: 'button', 'aria-label': 'Teach ' + s.label });
    g.style.setProperty('--c', PAD[s.pad].color);
    if (s.r) {
      mk('circle', { class: 'ring', cx: s.x, cy: s.y, r: s.r + 5 }, g);
      mk('circle', { class: 'pad', cx: s.x, cy: s.y, r: s.r }, g);
    } else {
      mk('rect', { class: 'ring', x: s.x - 55, y: s.y - 23, width: 110, height: 46, rx: 14 }, g);
      mk('rect', { class: 'pad', x: s.x - 50, y: s.y - 18, width: 100, height: 36, rx: 10 }, g);
    }
    const mini = s.r && s.r < 20;   // a small extra spot: the same pad played another way
    if (mini) g.classList.add('mini');
    mk('text', { class: 'lbl', x: s.x, y: s.y + (mini ? -1 : 4) }, g, s.label);
    mk('text', { class: 'cnt', x: s.x, y: s.y + (mini ? 11 : 19) }, g, '');
    const tx = s.x + (s.r ? s.r * 0.72 : 46), ty = s.y - (s.r ? s.r * 0.72 : 16);
    const t = mk('g', { class: 'tick' }, g);
    mk('circle', { cx: tx, cy: ty, r: 9 }, t);
    mk('text', { x: tx, y: ty + 4 }, t, '✓');
    if (pick) {
      const go = typeof pick === 'function' ? () => pick(s) : () => calPick(s.first || s.key, false);   // Setup teaches the pad; the Note quiz answers with it
      if (typeof pick === 'function') g.setAttribute('aria-label', s.label);
      g.onclick = go;
      g.onkeydown = (e) => { if (e.key === 'Enter') go(); };
    } else { g.removeAttribute('tabindex'); g.removeAttribute('role'); g.removeAttribute('aria-label'); }
  });
}
function flashPad(key) {
  const el = spotEl(key);
  if (!el) return;
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 180);
}

// ---------- Setup: calibration ----------
// One pad at a time. Each pad is saved the moment its hits are in, so pausing or leaving never loses work,
// and any single pad can be taught again by clicking it.
const CAL_ORDER = ['snare', 'kick', 'hihatopen', 'hihat', 'kickpad', 'tom1', 'tom2', 'tom3', 'crash', 'crash2', 'ride', 'hhpedal'];
const Cal = { active: false, starting: false, phase: '', key: null, guided: false, got: [], lastT: 0, timer: null, hint: null,
  note: '', msg: '', retries: 0, deafUntil: 0, clicks: [], clickHits: [], clickChecked: false };
const learned = (key) => !!Ear.templates[key];
const learnedCount = () => SPOTS.filter(s => keysOf(s).every(learned)).length;
function setTemplates(change) {
  const T = Object.assign({}, Ear.templates);   // a new object, so the recogniser drops what it had prepared
  change(T);
  Ear.templates = T;
  store.set('cal2', Ear.exportTemplates());
}

function calUi() {
  const pads = Cal.active && Cal.phase === 'pads';
  const n = learnedCount();
  SPOTS.forEach(s => {
    const combo = pads && SPOT[Cal.key].combo;
    const el = $('#pm-' + s.key), target = !!(pads && (keysOf(s).indexOf(Cal.key) >= 0 || (combo && combo.indexOf(s.key) >= 0)));
    el.classList.toggle('done', keysOf(s).every(learned));
    el.classList.toggle('target', target);
    el.querySelector('.cnt').textContent = target ? Cal.got.length + ' / ' + CAL_NEED : '';
  });
  COMBOS.forEach(k => {
    const el = spotEl(k);
    el.classList.toggle('done', learned(k));
    el.classList.toggle('target', pads && Cal.key === k);
    el.disabled = !SPOT[k].combo.every(p => Ear.knows(p));   // the single pads come first
  });
  const start = $('#calStart');
  start.classList.toggle('hidden', Cal.active || n === SPOTS.length);
  start.textContent = n ? 'Teach the remaining pads' : 'Teach all pads';
  $('#calPause').classList.toggle('hidden', !Cal.active);
  $('#calSkip').classList.toggle('hidden', !(pads && Cal.guided));
  $('#calRedo').classList.toggle('hidden', !(pads && Cal.got.length));
  $('#calHear').classList.toggle('hidden', !pads);
  $('#calForget').classList.toggle('hidden', !(pads && learned(Cal.key)));
  $('#calMore').classList.toggle('hidden', !(pads && learned(Cal.key) && !Cal.append));
  $('#calReset').classList.toggle('hidden', Cal.active || !n);
  const dots = $('#calDots');
  dots.innerHTML = '';
  if (pads) {
    $('#calPrompt').textContent = Cal.note || (Cal.append ? 'Adding ' + CAL_NEED + ' more hits to what the app already knows. ' : '') + SPOT[Cal.key].say + (SPOT[Cal.key].combo || Cal.got.length ? '' : ' Play some hits soft and some hard, the way you really play.');
    for (let i = 0; i < CAL_NEED; i++) {
      const s = document.createElement('span');
      if (i < Cal.got.length) s.className = 'on';
      dots.appendChild(s);
    }
  } else if (!Cal.active) {
    $('#calPrompt').textContent = Cal.msg || (n === 0 ? 'Press "Teach all pads", or tap any pad in the picture to teach just that one.'
      : n === SPOTS.length ? 'All pads are learned. Hit any pad and watch it light up. Tap a pad to teach it again.'
      : 'Tap any pad to teach it, or to teach it again. Hit a pad to see whether the app knows it.');
  }
  $('#calResult').textContent = Cal.active ? '' : calSummary();
}
function calSummary() {
  const n = learnedCount();
  if (!n) return '';
  const q = Ear.quality();
  let msg = n + ' of ' + SPOTS.length + ' learned (the ones with a tick).';
  q.confusions.forEach(c => { msg += ' ' + PAD[c[0]].name + ' and ' + PAD[c[1]].name + ' sound very alike and may get mixed up.'; });
  if (Ear.templates._click) msg += ' The microphone can hear the metronome click; the app will try to ignore it. If lessons misread your hits, wear headphones or switch the metronome off.';
  return msg;
}
// Start listening for the chosen pad. If nothing at all is heard for a while, say what to try.
// Play the app's own example of the pad being taught, so the player knows what to listen for (which pedal is which).
// The microphone may hear it too, so hits are ignored for a moment after it.
function calHear() {
  if (!Cal.active || Cal.phase !== 'pads') return;
  const t = Ear.ctx.currentTime + 0.06;
  if (Cal.key === 'hihatopen') Ear._noiseHit(t, 0.9, 7000, 0.25);
  else (SPOT[Cal.key].combo || [SPOT[Cal.key].pad]).forEach(p => Ear.drum(p, t));
  Cal.deafUntil = t + 0.5;
}
function calArm(play) {
  Cal.phase = 'pads'; Cal.got = []; Cal.retries = 0; Cal.note = '';
  if (play === true) calHear();
  clearTimeout(Cal.hint);
  Cal.hint = setTimeout(() => {
    if (!Cal.active || Cal.phase !== 'pads' || Cal.got.length) return;
    Cal.note = 'Nothing heard yet. ' + SPOT[Cal.key].say + ' If it still hears nothing, turn the pad volume up, move it closer to the computer, or raise Sensitivity above.';
    calUi();
  }, 8000);
  calUi();
}
// Teach one pad (clicked in the picture), or with guided = true walk through every pad that is not learned yet.
async function calPick(key, guided) {
  if (Cal.starting || Lat.active || Lat.starting) return;
  if (Cal.active && Cal.phase === 'click') { Cal.key = key; Cal.guided = guided; return; }   // still checking the metronome: remember the choice
  if (!Ear.listening) {
    Cal.starting = true;
    const ok = await ensureListening();
    Cal.starting = false;
    if (screen !== 'setup' || Lat.active) return;
    if (!ok) { Cal.msg = micProblem(); calUi(); return; }
    $('#connectBtn').textContent = 'Microphone is on';
    fillDevices();
  }
  if (Chk.active) chkStop();
  Cal.active = true; Cal.key = key; Cal.guided = guided; Cal.msg = ''; Cal.append = false;
  if (Cal.clickChecked) { calArm(true); return; }
  // Once per visit: play a few clicks to learn what the metronome sounds like through the microphone.
  Cal.phase = 'click';
  $('#calPrompt').textContent = 'Stay quiet for 3 seconds: checking whether the microphone can hear the metronome...';
  calUi();
  const t = Ear.ctx.currentTime + 0.4;
  Cal.clicks = []; Cal.clickHits = [];
  for (let i = 0; i < 6; i++) { Cal.clicks.push(t + i * 0.35); Ear.click(t + i * 0.35, true, 0.3); }
  Cal.timer = setTimeout(() => {
    // The microphone hears our own clicks a fixed moment after they are played: that gap is this computer's delay.
    // Sounds that do not share that gap (a cough, a pad hit) are left out, so they cannot spoil the click's fingerprint.
    const heard = Cal.clickHits.map(h => ({ h, d: clickDelays(Cal.clicks, [h.time], 0, 0.3)[0] })).filter(x => x.d !== undefined);
    const md = median(heard.map(x => x.d));
    const ok = heard.filter(x => Math.abs(x.d - md) < 0.025);
    setTemplates(T => { if (ok.length >= 4) T._click = Ear.makeTemplate(ok.map(x => x.h.feat)); else delete T._click; });
    if (ok.length >= 4 && !settings.offsetChosen) setOffset(md * 1000);   // never overwrite a delay that was measured or adjusted on purpose
    Cal.clickChecked = true;
    calArm(true);
  }, 3000);
}
// Index of a hit that sounds unlike the other four (the wrong pad was hit by accident), or -1.
function oddOneOut(list) {
  // For every hit: how alike is it to a typical one of the others?
  const sh = list.map(shape);
  const sims = sh.map((a, i) => median(sh.filter((b, j) => j !== i).map(b => dot(a, b))));
  let lo = 0;
  sims.forEach((v, i) => { if (v < sims[lo]) lo = i; });
  return sims[lo] < 0.7 && median(sims.filter((v, i) => i !== lo)) > 0.85 ? lo : -1;
}
function calHit(h) {
  if (Cal.phase === 'click') { Cal.clickHits.push(h); return; }
  if (h.time < Cal.deafUntil || h.time - Cal.lastT < 0.15) return;
  Cal.lastT = h.time;
  const key = Cal.key;
  Cal.got.push(h.feat);
  Cal.note = '';
  flashPad(key);
  if (Cal.got.length < CAL_NEED) { calUi(); return; }
  const odd = Cal.retries < 2 && !SPOT[key].combo ? oddOneOut(Cal.got) : -1;   // hits on two pads vary too much to judge this way
  if (odd >= 0) {
    Cal.got.splice(odd, 1); Cal.retries++;
    Cal.note = 'One of those hits sounded different from the others. Once more: ' + SPOT[key].say.replace(' ' + CAL_NEED + ' times', '');
    calUi();
    return;
  }
  // "Add more hits" keeps the hits already taught (up to CAL_KEEP in all); teaching again replaces them.
  const old = Cal.append && Ear.templates[key] ? Ear.templates[key].samples : [];
  const tpl = Ear.makeTemplate(old.concat(Cal.got).slice(-CAL_KEEP));
  Cal.append = false;
  setTemplates(T => { T[key] = tpl; });
  const el = spotEl(key);
  el.classList.add('pop');
  setTimeout(() => el.classList.remove('pop'), 600);
  if (SPOT[key].next) { Cal.key = SPOT[key].next; calArm(true); }   // second step on the same pad
  else if (Cal.guided) calNext(); else calPause('Learned ' + (SPOT[key].combo ? '' : 'the ') + SPOT[key].label + '. Click another pad, or hit pads to test them.');
}
// Guided run: move on to the next pad in the list that has not been learned.
function calNext() {
  const from = CAL_ORDER.indexOf(Cal.key) + 1;
  const next = CAL_ORDER.slice(from).find(k => !learned(k));
  if (!next) { calPause(learnedCount() === SPOTS.length ? '' : 'That was the last pad. Pads without a tick were skipped: click one to teach it.'); return; }
  Cal.key = next;
  calArm(true);
}
function calPause(msg) {
  clearTimeout(Cal.timer); clearTimeout(Cal.hint);
  Cal.active = false;
  Cal.msg = msg === undefined ? 'Paused. Everything learned so far is saved. Tap a pad or press the button to carry on.' : msg;
  calUi();
}

// ---------- Setup: measure this computer's sound delay ----------
const Lat = { active: false, phase: '', clicks: [], heard: [], timer: null };
function setOffset(ms) {
  settings.offsetMs = Math.max(-50, Math.min(400, Math.round(ms)));
  saveSettings();
  syncSettingsUi();
}
// For each heard time, the gap to the nearest click; kept only when inside [lo, hi] seconds.
function clickDelays(clicks, heard, lo, hi) {
  const out = [];
  heard.forEach(t => {
    let best = null;
    clicks.forEach(c => { const d = t - c; if (d >= lo && d <= hi && (best === null || Math.abs(d) < Math.abs(best))) best = d; });
    if (best !== null) out.push(best);
  });
  return out;
}
function latPlay(n, gap) {
  Lat.clicks = []; Lat.heard = [];
  const t = Ear.ctx.currentTime + 0.5;
  for (let i = 0; i < n; i++) { Lat.clicks.push(t + i * gap); Ear.click(t + i * gap, true, 0.3); }
  return (0.5 + n * gap + 0.4) * 1000;
}
async function latStart() {
  const out = $('#latOut');
  if (Lat.active || Lat.starting || Cal.active || Cal.starting) return;
  Lat.starting = true;
  const ok = await ensureListening();
  Lat.starting = false;
  if (screen !== 'setup' || Cal.active) return;
  if (!ok) { out.textContent = micProblem(); return; }
  Lat.active = true; Lat.phase = 'auto';
  $('#latBtn').disabled = true;
  out.textContent = 'Stay quiet for 4 seconds: listening for the metronome through the microphone...';
  Lat.timer = setTimeout(() => {
    const d = clickDelays(Lat.clicks, Lat.heard, 0, 0.3);
    if (d.length >= 4) { latDone(median(d) * 1000, 'measured automatically'); return; }
    // The microphone cannot hear the click (headphones, or volume too low): ask the player to tap along.
    Lat.phase = 'tap';
    out.textContent = 'The microphone cannot hear the metronome. Hit any pad exactly together with each of the next 12 clicks.';
    Lat.timer = setTimeout(() => {
      const t = clickDelays(Lat.clicks, Lat.heard, -0.15, 0.35);
      if (t.length >= 6) latDone(median(t) * 1000, 'measured from your taps');
      else { Lat.active = false; $('#latBtn').disabled = false; out.textContent = 'Not enough hits were heard. Check the microphone level above and try again.'; }
    }, latPlay(12, 0.6));
  }, latPlay(8, 0.4));
}
function latHit(h) { Lat.heard.push(h.time); }
function latDone(ms, how) {
  Lat.active = false;
  $('#latBtn').disabled = false;
  setOffset(ms);
  settings.offsetChosen = true; saveSettings();
  $('#latOut').textContent = 'Delay is ' + settings.offsetMs + ' ms (' + how + '). Saved.';
}

// ---------- Setup: check every pad ----------
// The app asks for each taught pad in turn, three hits each, and keeps score of what it recognised.
const CHK_NEED = 3;
const Chk = { active: false, keys: [], i: 0, got: [], res: {}, lastT: 0 };
function chkStart() {
  if (Cal.active || Cal.starting || Lat.active) return;
  const keys = CAL_ORDER.filter(learned);
  if (!keys.length) { $('#chkPrompt').textContent = 'Teach the app some pads first (step 2).'; return; }
  ensureListening().then(ok => {
    if (!ok || screen !== 'setup' || Cal.active) { if (!ok) $('#chkPrompt').textContent = micProblem(); return; }
    Object.assign(Chk, { active: true, keys, i: 0, got: [], res: {} });
    $('#chkOut').innerHTML = '';
    chkUi();
  });
}
function chkStop(msg) {
  Chk.active = false;
  document.querySelectorAll('#padMap .spot').forEach(e => e.classList.remove('target'));
  $('#chkStart').textContent = 'Check all pads';
  $('#chkPrompt').textContent = msg || '';
}
function chkUi() {
  const key = Chk.keys[Chk.i];
  document.querySelectorAll('#padMap .spot').forEach(e => e.classList.remove('target'));
  spotEl(key).classList.add('target');
  $('#chkStart').textContent = 'Stop the check';
  $('#chkPrompt').textContent = 'Pad ' + (Chk.i + 1) + ' of ' + Chk.keys.length + ': ' + SPOT[key].say.replace(new RegExp(CAL_NEED + ' times', 'g'), CHK_NEED + ' times').replace(/^(Now|Same pad again): ?/i, '') + '  (' + Chk.got.length + ' / ' + CHK_NEED + ')';
}
function chkHit(h) {
  if (h.time - Chk.lastT < 0.15) return;
  Chk.lastT = h.time;
  const key = Chk.keys[Chk.i], r = Ear.classify(h.feat, { allPairs: true });
  if (r.click) return;
  Chk.got.push({ feat: h.feat, keys: r.keys, pads: r.pads, lead: r.lead });
  flashPad(key);
  if (Chk.got.length < CHK_NEED) { chkUi(); return; }
  Chk.res[key] = Chk.got; Chk.got = [];
  Chk.i++;
  if (Chk.i < Chk.keys.length) chkUi(); else chkDone();
}
function chkDone() {
  const keys = Chk.keys;
  chkStop();
  const box = $('#chkOut');
  box.innerHTML = '';
  let right = 0, all = 0;
  keys.forEach(key => {
    const hits = Chk.res[key] || [], want = canon(key);
    const good = hits.filter(x => x.pads.length === 1 && x.pads[0] === want);
    const exact = good.filter(x => x.keys[0] === key).length;
    right += good.length; all += hits.length;
    const wrong = {};
    hits.filter(x => good.indexOf(x) < 0).forEach(x => { const nm = x.pads.length ? x.pads.map(p => PAD[p].name).join(' + ') : 'an unknown sound'; wrong[nm] = (wrong[nm] || 0) + 1; });
    const unsure = good.filter(x => x.lead < 0.03).length;
    const row = document.createElement('div');
    row.className = 'chkRow ' + (good.length === hits.length ? (unsure ? 'warn' : 'ok') : 'bad');
    let txt = good.length + ' / ' + hits.length;
    Object.keys(wrong).forEach(nm => { txt += ', heard as ' + nm + ' ×' + wrong[nm]; });
    if (good.length === hits.length && unsure) txt += ', but only just: it sounds a lot like another pad';
    if ((key === 'hihat' || key === 'hihatopen') && exact < good.length) txt += ' (open and closed were mixed up)';
    row.innerHTML = '<b></b><span></span><span class="muted small"></span>';
    row.children[0].textContent = (good.length === hits.length ? '✓ ' : '✗ ') + SPOT[key].label + (key === 'hihat' ? ' (closed)' : key === 'hihatopen' ? ' (open)' : key === 'crash' ? ' (left)' : key === 'crash2' ? ' (right)' : '');
    row.children[1].textContent = txt;
    row.children[2].textContent = Ear.templates[key].samples.length + ' hits taught';
    if (good.length < hits.length || unsure) {
      const add = document.createElement('button');
      add.textContent = 'Learn from these ' + hits.length + ' hits';
      add.title = 'Only if you really hit the pad that was asked for';
      add.onclick = () => {
        setTemplates(T => { T[key] = Ear.makeTemplate(T[key].samples.concat(hits.map(x => x.feat)).slice(-CAL_KEEP)); });
        add.disabled = true; add.textContent = 'Added. Run the check again.';
        calUi();
      };
      const again = document.createElement('button');
      again.textContent = 'Teach this pad again';
      again.onclick = () => { calPick(key, false); $('#padMap').scrollIntoView({ block: 'center' }); };
      row.appendChild(add); row.appendChild(again);
    }
    box.appendChild(row);
  });
  $('#chkPrompt').textContent = 'Check finished: ' + right + ' of ' + all + ' hits recognised' + (right === all ? '. The app knows your pads.' : '. See the pads marked ✗ below.');
}

// ---------- Setup: live test ----------
function testHit(h) {
  const out = $('#testOut');
  if (!calibrated()) { out.textContent = 'Heard a hit. Calibrate so the app can tell which pad it was.'; return; }
  const r = Ear.classify(h.feat, { allPairs: true });
  if (r.click) { out.textContent = '(metronome)'; return; }
  if (!r.pads.length) { out.innerHTML = 'Unknown sound <small>best match ' + Math.round(Math.max(0, r.score) * 100) + '%</small>'; return; }
  out.innerHTML = r.pads.map(p => PAD[p].name + (p !== 'hihat' ? '' : r.keys.indexOf('hihatopen') >= 0 ? ' (open)' : ' (closed)')).join(' + ') + ' <small>match ' + Math.round(r.score * 100) + '%</small>';
  r.keys.forEach(flashPad);
}

// ---------- Practice ----------
const G = {
  idx: 0, lesson: null, track: null, lanes: [], notes: [], totalBeats: 0, head: 0,
  running: false, demo: false, wait: false, loop: false, metroMode: 'sound', bpm: 60,
  mel: null, music: false, melIdx: 0, melLoop: 0, demoIdx: 0, title: '',
  tStart: 0, beatPos: -1, viewPos: -1, duePos: -1, runId: 0, lastFrame: 0, nextClick: -4,
  stats: null, flash: {}, fx: null, pops: []
};
const LANE_ORDER = PADS.map(p => p.id);

const barBeats = (l) => (l && l.beats) || 4;   // beats in a bar: 4 unless the lesson says otherwise (3/4, 5/4, 6/8)
function buildNotes(lesson, reps) {
  const notes = [], B = barBeats(lesson);
  for (let r = 0; r < reps; r++) {
    lesson.bars.forEach((bar, b) => {
      Object.keys(bar).forEach(pad => {
        const str = bar[pad];
        for (let i = 0; i < str.length; i++) {
          if (str[i] === 'x') notes.push({ t: (r * lesson.bars.length + b) * B + i / lesson.div, pad, bar: b, state: 0, fxT: 0 });
        }
      });
    });
  }
  notes.sort((a, b) => a.t - b.t);
  assignLimbs(notes, lesson);
  return notes;
}
// Which hand or foot plays each note: n.limb = 'RH', 'LH', 'RF' or 'LF'.
// The stronger hand leads on the cymbals and the stronger foot plays the kick. A drum hit together with a cymbal
// goes to the other hand. Notes that follow each other quickly on their own are played with alternating hands.
function assignLimbs(notes, lesson) {
  const lead = settings.lefty ? 'L' : 'R', other = settings.lefty ? 'R' : 'L';
  // A lesson can fix the sticking (rudiments): 'RLRR LRLL', or one string per bar. It restarts in every bar.
  const stick = lesson && lesson.sticking, B = barBeats(lesson);
  let barNo = -1, sn = 0;
  const CYM = { hihat: 1, ride: 1, crash: 1 };
  let prev = null;   // the last note that one hand played on its own: { t, hand, cym }
  for (let i = 0; i < notes.length;) {
    let j = i;
    while (j < notes.length && notes[j].t === notes[i].t) j++;
    const hands = [];
    for (let k = i; k < j; k++) {
      const n = notes[k];
      if (n.pad === 'kick') n.limb = lead + 'F';
      else if (n.pad === 'hhpedal') n.limb = other + 'F';
      else hands.push(n);
    }
    if (hands.length === 1) {
      const n = hands[0], cym = !!CYM[n.pad], gap = prev ? n.t - prev.t : 99;
      const alternate = prev && (gap <= 0.2501 || (!cym && !prev.cym && gap <= 1.0001));
      // A drum hit squeezed between two cymbal hits (off-beat hi-hat): the lead hand stays on the cymbal.
      let between = false;
      if (!alternate && !cym && prev && prev.cym && prev.hand === lead && gap <= 0.5001) {
        let m = j;
        while (m < notes.length && (notes[m].pad === 'kick' || notes[m].pad === 'hhpedal')) m++;
        between = m < notes.length && !!CYM[notes[m].pad] && notes[m].t - n.t <= 0.5001;
      }
      let hand = between ? other : alternate ? (prev.hand === lead ? other : lead) : lead;
      if (stick) {
        const bn = Math.floor(n.t / B + 1e-6);
        if (bn !== barNo) { barNo = bn; sn = 0; }
        const seq = (Array.isArray(stick) ? stick[n.bar % stick.length] : stick).replace(/\s/g, '');
        hand = seq[sn++ % seq.length] === 'R' ? lead : other;
      }
      n.limb = hand + 'H';
      prev = { t: n.t, hand, cym };
    } else if (hands.length > 1) {
      const c = hands.find(n => CYM[n.pad]) || hands[hands.length - 1];
      hands.forEach(n => { n.limb = (n === c ? lead : other) + 'H'; });
      prev = null;
    }
    i = j;
  }
}
const tempoWord = (bpm) => bpm <= 55 ? 'very slow' : bpm <= 75 ? 'slow' : bpm <= 95 ? 'medium' : bpm <= 115 ? 'lively' : 'fast';
// Put a lesson, a song, or one of the player's own songs on the practice screen.
function setLesson(l) {
  G.lesson = l;
  const used = {};
  l.bars.forEach(bar => Object.keys(bar).forEach(p => { used[p] = true; }));
  G.lanes = LANE_ORDER.filter(p => used[p]);
  G.bpm = l.bpm;
  $('#tempo').value = l.bpm; $('#tempoTxt').textContent = l.bpm; $('#tempoWord').textContent = '(' + tempoWord(l.bpm) + ')';
  G.mel = l.melody ? parseMelody(l.melody) : null;
  $('#lessonTitle').textContent = G.title;
  $('#lessonGoal').textContent = feelOf(l) + '. ' + l.goal;
  $('#lessonTip').textContent = 'Tip: ' + l.tip + (l.song ? ' If the app mistakes the tune for drum hits, wear headphones or untick "Play the tune".' : '');
  const own = !!G.track;
  const teach = TEACH[l.lv];
  $('#focusLine').classList.toggle('hidden', !teach || own);
  if (teach) $('#focusLine').textContent = '🎓 Focus: ' + teach.focus;
  showNotation(l);
  const pg = progress[l.id];
  $('#tempoGoal').textContent = own || l.song ? '' : (mastered(l) ? '👑 ' : '') + 'Goal ' + goalBpm(l) + ' BPM' + (pg && pg.bpm ? ', your top ' + pg.bpm : '');
  $('#musicLabel').classList.toggle('hidden', !l.song);
  ['#tempoLabel', '#waitLabel', '#loopLabel', '#sheetOnlyLabel'].forEach(s => $(s).classList.toggle('hidden', own));
  ['#speedLabel', '#partLabel', '#alignBox'].forEach(s => $(s).classList.toggle('hidden', !own));
  $('#climbLabel').classList.toggle('hidden', own || !!l.song);
  $('#backBtn').textContent = backLabel();
  // The notes use the drummer's words; the real pad prints other names on two of its pads.
  const hint = [];
  if (used.hihat) hint.push('Hi-Hat: the pad marked "Open Hi-Hat", with the hi-hat pedal held down.');
  if (used.kick) hint.push('Kick: the kick pedal, or the "Bass Drum" pad.');
  $('#padHint').textContent = hint.join(' ');
  resetRun();
}
// A Tour piece (the gig or the sight-reading test) is played as written: no slowing down, no Wait mode, no repeats.
// sheet = play from the sheet only; noDemo = no "Listen first" (it would give the unseen bars away).
function gigLock(on, sheet, noDemo) {
  ['#tempo', '#waitMode', '#loopMode', '#climbMode', '#sheetOnly'].forEach(s => { $(s).disabled = on; });
  if (on) { ['#waitMode', '#loopMode', '#climbMode'].forEach(s => { $(s).checked = false; }); $('#sheetOnly').checked = !!sheet; }
  else $('#sheetOnly').checked = false;
  $('#demoBtn').classList.toggle('hidden', !!(on && noDemo));
  $('#backBtn').textContent = backLabel();
}
// The tempo a written piece wants in this bar (a gig speeds up and slows down as it goes).
function planTempo(bar) { let want = G.plan[0][1]; G.plan.forEach(x => { if (bar >= x[0]) want = x[1]; }); return want; }
// Where "back" leads: songs go back to the Songs page, lessons to the Lessons page.
const listOf = () => (G.gig ? 'tour' : G.track || (G.lesson && G.lesson.song) ? 'songs' : 'home');
const backLabel = () => (listOf() === 'tour' ? '← Tour' : listOf() === 'songs' ? '← All songs' : '← All lessons');
function openLesson(i) {
  const l = LESSONS[i];
  G.idx = i; G.track = null;
  if (G.gig) { G.gig = null; gigLock(false); }
  G.title = l.song ? 'Song: ' + l.title : (LESSONS.filter(x => !x.song).indexOf(l) + 1) + '. ' + l.title;
  setLesson(l);
  show('play');
}
function resetRun() {
  if (G.track) Track.stop();
  G.running = false; G.demo = false;
  G.notes = buildNotes(G.lesson, G.lesson.reps);
  G.totalBeats = G.lesson.reps * G.lesson.bars.length * barBeats(G.lesson);
  G.beatPos = -1; G.viewPos = -1; G.head = 0; G.flash = {}; G.fx = null; G.pops = [];
  $('#startBtn').textContent = 'Start';
  $('#demoBtn').textContent = 'Listen first';
  $('#demoBtn').disabled = false;
  $('#speed').disabled = false; $('#seek').disabled = false;
  ALIGN_BTNS.forEach(s => { $(s).disabled = false; });
  if (G.track) updateAlignUi();
  Buddy.idle();
}
const ALIGN_BTNS = ['#alEarlier', '#alLater', '#alHalf', '#alDouble', '#alBetween', '#alSwap', '#alTap'];
function newStats() {
  const perPad = {};
  G.lanes.forEach(p => { perPad[p] = { hit: 0, miss: 0 }; });
  return { hit: 0, miss: 0, extra: 0, perfect: 0, good: 0, ok: 0, points: 0, bestCombo: 0, errs: [], audioErrs: [], perPad };
}
// Audio-clock time <-> beat number. Lessons run at one fixed tempo; the player's own songs follow the song's beats.
function beatAt(time) { return G.track ? Track.beatAt(time) : (time - G.tStart) * G.bpm / 60 - preBeats(); }
function timeOfBeat(b) { return G.track ? Track.timeOfBeat(b) : G.tStart + (b + preBeats()) * 60 / G.bpm; }
// Clicks of counting in before a lesson starts: one bar, or two when the bar is shorter than four beats.
function preBeats() { const B = barBeats(G.lesson); return G.track ? 4 : B < 4 ? 2 * B : B; }
const beatSec = () => G.track ? Track.beatSec(G.beatPos) : 60 / G.bpm;   // length of one beat right now, in seconds
const windowBeats = () => Math.min(0.16, 0.45 * beatSec() / G.lesson.div) / beatSec();

// What stands in the way of the app hearing the pad, shown above the notes.
function updatePlayNote(tried) {
  let msg = '';
  const untaught = calibrated() ? G.lanes.filter(p => !Ear.knows(p)) : [];
  if (!calibrated()) msg = 'The pad is not set up yet. For now only ' + KEYS_OR_TAP + '. A grown-up can open Setup at the top.';
  else if (tried && !Ear.listening) msg = micProblem() + ' Until then only ' + KEYS_OR_TAP + '.';
  else if (untaught.length) msg = 'The app was never taught the sound of: ' + untaught.map(p => PAD[p].name).join(', ') + '. Those notes will count as missed. Open Setup and tap those pads in the picture to teach them.';
  $('#playNote').textContent = msg;
  $('#playNote').classList.toggle('hidden', !msg);
}

// demo = true: the app plays the part itself ("Listen first"); nothing is scored.
// fromSong (own songs, demo only): start at this many seconds into the song instead of at the beginning.
async function startRun(demo, fromSong) {
  const ctx = Ear.ensureCtx();
  if (!demo && calibrated()) await ensureListening();
  if (G.running || screen !== 'play') return;   // something else started, or the screen changed, while the microphone was being opened
  if (!demo) updatePlayNote(true);
  // On a small screen the notes sit below the buttons: bring the sheet and the falling notes fully into view.
  const stg = document.querySelector('.stage').getBoundingClientRect();
  if (stg.bottom > window.innerHeight || stg.top < 0) {
    const y = $('#sheet').getBoundingClientRect().top + window.scrollY - document.querySelector('.playTop').offsetHeight - 8;
    window.scrollTo(0, Math.max(0, y));
  }
  const own = !!G.track;
  G.demo = !!demo;
  G.wait = !demo && !own && $('#waitMode').checked;
  G.loop = !demo && !own && $('#loopMode').checked;
  // Speed climb: the pattern repeats, and every clean round makes it 5 BPM faster.
  G.climb = !demo && !own && !G.wait && !G.test && !G.lesson.song && $('#climbMode').checked;
  if (G.climb) G.loop = true;
  G.metroMode = $('#metroMode').value;
  G.sheetOnly = !demo && $('#sheetOnly').checked;   // reading practice: the falling notes are hidden
  G.music = !!G.mel && $('#musicOn').checked && !G.wait;
  const reps = G.loop ? 300 : (demo && !G.lesson.song) ? Math.min(2, G.lesson.reps) : G.lesson.reps;
  G.notes = buildNotes(G.lesson, reps);
  G.totalBeats = reps * G.lesson.bars.length * barBeats(G.lesson);
  G.head = 0; G.flash = {}; G.fx = null; G.pops = [];
  G.melIdx = 0; G.melLoop = 0; G.demoIdx = 0;
  G.stats = newStats();
  G.streak = 0;
  G.plan = !own && G.lesson.tempos ? G.lesson.tempos : null;
  if (G.plan) showTempo(G.plan[0][1]);
  G.minBpm = G.bpm;   // the slowest tempo used during this run
  if (G.climb) {
    const L = G.lesson.bars.length * barBeats(G.lesson);
    G.seg = L * Math.max(1, Math.ceil(8 / L));   // one round: the whole pattern, at least eight beats
    G.segEnd = G.seg; G.segMark = { hit: 0, miss: 0, extra: 0 };
    G.hearts = 3; G.climbStart = G.bpm; G.climbTop = 0; G.climbSegs = 0;
    G.climbCap = Math.min(180, goalBpm(G.lesson) + 30);
  }
  climbHud();
  G.runT0 = demo ? 0 : performance.now();
  if (own) {
    // Four beats of counting in. If the song's first beat comes sooner than that, the count starts in silence.
    const v0 = fromSong != null ? fromSong : Math.min(0, Track.timeOf(-4));
    Track.play(ctx.currentTime + 0.15, v0, +$('#speed').value / 100);
    const b0 = Track.beatOf(v0);
    G.beatPos = G.viewPos = b0;
    G.nextClick = Math.max(-4, Math.ceil(b0 - 1e-6));
    while (G.demoIdx < G.notes.length && G.notes[G.demoIdx].t < b0) G.notes[G.demoIdx++].state = 1;   // already behind us
    $('#speed').disabled = true;
    $('#seek').disabled = !demo;
    ALIGN_BTNS.forEach(s => { $(s).disabled = !demo; });   // no re-aligning in the middle of a scored run
  } else if (G.wait) { G.beatPos = G.viewPos = -1; G.lastFrame = performance.now(); }
  else { G.tStart = ctx.currentTime + 0.15; G.nextClick = -preBeats(); G.beatPos = G.viewPos = -preBeats(); }
  G.running = true;
  const run = ++G.runId;   // lets a frame loop left over from an earlier run notice that it is no longer wanted
  $('#startBtn').textContent = demo ? 'Start' : 'Stop';
  $('#demoBtn').textContent = demo ? 'Stop demo' : 'Listen first';
  $('#demoBtn').disabled = !demo;
  Buddy.start(demo);
  if (document.activeElement && document.activeElement !== $('#alTap')) document.activeElement.blur();
  requestAnimationFrame(() => frame(run));
}
function stopRun(showRecap) {
  const st = G.stats;
  const wasWait = G.wait, wasDemo = G.demo, notes = G.notes.length;
  const climb = G.climb ? { top: G.climbTop, segs: G.climbSegs, start: G.climbStart } : null;
  if (!wasDemo && G.runT0) { addPractice((performance.now() - G.runT0) / 1000, st && st.perPad); G.runT0 = 0; }
  if (climb) { G.climb = false; showTempo(climb.start); climbHud(); }   // the next run starts at the tempo the player chose
  if (G.plan) { showTempo(G.plan[0][1]); G.plan = null; }
  resetRun();
  if (G.test && !wasDemo) { testPartDone(st, showRecap, notes); return; }
  if (showRecap && st && st.hit + st.miss > 0) renderRecap(st, wasWait, climb);
  else if (screen === 'play') draw();
}
function showTempo(bpm) { G.bpm = bpm; $('#tempo').value = bpm; $('#tempoTxt').textContent = bpm; $('#tempoWord').textContent = '(' + tempoWord(bpm) + ')'; }
function climbHud() {
  const el = $('#climbHud');
  el.classList.toggle('hidden', !G.climb);
  if (G.climb) el.textContent = '❤'.repeat(Math.max(0, G.hearts)) + '♡'.repeat(Math.max(0, 3 - G.hearts)) + '  🚀 ' + G.bpm + ' BPM';
}
// The end of a round in Speed climb. A clean round (nine notes in ten) speeds the beat up; a messy one costs a heart.
// Returns true when the last heart is gone and the run has ended.
function climbStep() {
  const st = G.stats, h = st.hit - G.segMark.hit, m = st.miss - G.segMark.miss, x = st.extra - G.segMark.extra, n = h + m;
  G.segMark = { hit: st.hit, miss: st.miss, extra: st.extra };
  G.segEnd += G.seg;
  if (!n) return false;
  G.climbSegs++;
  const live = (bpm) => { const now = Ear.ctx.currentTime; G.tStart = now - (beatAt(now) + preBeats()) * 60 / bpm; showTempo(bpm); };   // same place in the music, new speed
  if (h / n >= 0.9 && x <= 0.25 * n) {
    G.climbTop = Math.max(G.climbTop, G.bpm);
    if (G.bpm < G.climbCap) { live(G.bpm + 5); Buddy.say('Faster! ' + G.bpm + ' BPM 🚀', 2000, true); }
    else Buddy.say('Top speed! Hold on!', 2000, true);
  } else if (h / n < 0.7) {
    G.hearts--;
    if (G.hearts <= 0) { climbHud(); stopRun(true); return true; }
    if (G.bpm > G.climbStart) live(G.bpm - 5);
    Buddy.say('A little slower. ' + G.hearts + (G.hearts === 1 ? ' heart' : ' hearts') + ' left.', 2400, true);
  } else Buddy.say('Steady! Same speed again.', 1800, true);
  climbHud();
  return false;
}

function setFx(text, color) { G.fx = { text, color, t: performance.now() }; }
// A word that floats up from the hit line in the lane of the pad, with a little burst for the best hits.
function pop(pad, text, color, burst) { G.pops.push({ pad, text, color, burst: !!burst, t: performance.now() }); if (G.pops.length > 24) G.pops.shift(); }
// Ten right hits in a row double the points, twenty triple them, thirty or more give four times.
const comboMult = () => 1 + Math.min(3, Math.floor((G.streak || 0) / 10));
function addPoints(st, base) { st.points += Math.round(base * comboMult() * (G.climb ? G.bpm / G.climbStart : 1)); st.bestCombo = Math.max(st.bestCombo, G.streak || 0); }
function flashLane(pad, good) {
  G.flash[pad] = { t: performance.now(), good };
  const was = G.streak || 0;
  G.streak = good ? was + 1 : 0;   // right hits in a row
  flashPadView(pad, good);
  if (G.demo) Buddy.play();   // "Listen first": the buddy plays the part itself
  else if (good) Buddy.hit(G.streak); else Buddy.miss(was, true);
}

function frame(run) {
  if (!G.running || run !== G.runId) return;
  const ctx = Ear.ctx;
  if (G.wait) {
    const now = performance.now();
    let nb = G.beatPos + (now - G.lastFrame) / 1000 * G.bpm / 60;
    G.lastFrame = now;
    const nxt = nextPending();
    if (nxt && nb > nxt.t) nb = nxt.t;
    G.beatPos = G.viewPos = nb;
  } else {
    const nowT = ctx.currentTime, horizon = nowT + 0.15;   // sounds are scheduled a little ahead on the audio clock
    G.beatPos = beatAt(nowT);
    G.viewPos = beatAt(nowT - outLat());                   // what the player is hearing at this instant
    // While a grown-up is lining a song up, the click always sounds: it is the thing being checked.
    const BB = barBeats(G.lesson);
    const clickOn = G.metroMode === 'sound' || (G.track && G.demo && $('#alignBox').open);
    while (timeOfBeat(G.nextClick) < horizon) {
      const b = G.nextClick++;
      if (b < G.totalBeats && clickOn && timeOfBeat(b) >= nowT) Ear.click(timeOfBeat(b), ((b % BB) + BB) % BB === 0);
    }
    if (G.music && G.mel && G.mel.length) {
      for (;;) {
        const ev = G.mel[G.melIdx];
        const t = ev.t + G.melLoop * G.mel.beats;
        if (t >= G.totalBeats || timeOfBeat(t) >= horizon) break;
        if (timeOfBeat(t) >= nowT - 0.02) Ear.tone(ev.f, Math.max(timeOfBeat(t), nowT), ev.d * 60 / G.bpm * 0.92, 0.16);
        if (++G.melIdx >= G.mel.length) { G.melIdx = 0; G.melLoop++; }
      }
    }
    if (G.demo) {
      while (G.demoIdx < G.notes.length && timeOfBeat(G.notes[G.demoIdx].t) < horizon) {
        const n = G.notes[G.demoIdx++];
        const t = timeOfBeat(n.t);
        if (t >= nowT - 0.05) Ear.drum(n.pad, Math.max(t, nowT));   // never play a backlog of old notes in one burst
      }
      for (let i = G.head; i < G.notes.length && G.notes[i].t <= G.viewPos; i++) {
        const n = G.notes[i];
        if (n.state === 0) { n.state = 1; n.fxT = performance.now(); flashLane(n.pad, true); }
      }
    }
    // A note only counts as missed once a hit on it could no longer be on its way through the microphone.
    G.duePos = beatAt(nowT - hearDelay());
    const W = windowBeats();
    for (let i = G.head; i < G.notes.length; i++) {
      const n = G.notes[i];
      if (n.t >= G.duePos - W) break;
      if (n.state === 0) {
        if (G.demo) { n.state = 1; continue; }
        n.state = 2; n.fxT = performance.now();
        Buddy.miss(G.streak || 0, false);
        G.stats.miss++; G.stats.perPad[n.pad].miss++; G.streak = 0;
        pop(n.pad, 'Miss', '#eb5757');
      }
    }
    if (G.climb && G.duePos - W >= G.segEnd && climbStep()) return;
    if (G.plan) {   // a written tempo change: same place in the music, new speed
      const want = planTempo(Math.floor(Math.max(0, G.beatPos + 0.05) / BB));
      if (want !== G.bpm) {
        const faster = want > G.bpm;
        G.tStart = nowT - (beatAt(nowT) + preBeats()) * 60 / want;
        showTempo(want);
        Buddy.say(faster ? 'Faster now! ' + want + ' BPM' : 'Slower now. ' + want + ' BPM', 1800, true);
      }
    }
    if (G.track && !seeking && $('#alignBox').open) {
      const m = Math.max(0, Track.media(nowT));
      $('#seek').value = Math.round(1000 * m / G.track.dur);
      $('#seekTxt').textContent = fmtTime(m);
    }
  }
  const bi = Math.floor(G.viewPos);
  if (bi !== G.buddyBeat) { G.buddyBeat = bi; if (!G.wait) Buddy.beat(bi); }   // the buddy nods on every beat
  while (G.head < G.notes.length && G.notes[G.head].t < G.beatPos - 2) G.head++;
  if ((G.wait ? G.beatPos - 0.3 : G.duePos - 1) >= G.totalBeats) { stopRun(!G.demo); return; }
  draw();
  requestAnimationFrame(() => frame(run));
}
function nextPending() {
  for (let i = G.head; i < G.notes.length; i++) if (G.notes[i].state === 0) return G.notes[i];
  return null;
}

// A hit arrived (from sound or keyboard). time is on the audio clock, already latency-corrected.
function handleHit(pads, time, fromAudio) {
  if (!G.running || G.demo) return;
  const st = G.stats;
  const now = performance.now();
  if (G.wait) {
    const nxt = nextPending();
    const near = nxt && nxt.t - G.beatPos <= 1;
    pads.forEach(pad => {
      let n = null;
      if (near) for (let i = G.head; i < G.notes.length && G.notes[i].t <= nxt.t; i++) {
        const c = G.notes[i];
        if (c.t === nxt.t && c.state === 0 && c.pad === pad) { n = c; break; }
      }
      if (n) {
        n.state = 1; n.fxT = now;
        st.hit++; st.perfect++; if (st.perPad[pad]) st.perPad[pad].hit++;
        flashLane(pad, true); addPoints(st, 50); pop(pad, 'Right!', '#6fcf97', true);
      } else {
        st.extra++; flashLane(pad, false); setFx('Wrong pad: ' + PAD[pad].name, '#eb5757');
      }
    });
    return;
  }
  const hb = beatAt(time);
  const W = windowBeats();
  if (hb < -W || hb > G.totalBeats) return;   // tapping along with the count-in, or after the last note, costs nothing
  pads.forEach(pad => {
    let best = null, bd = 1e9;
    for (let i = G.head; i < G.notes.length; i++) {
      const n = G.notes[i];
      if (n.t > hb + W) break;
      if (n.state !== 0 || n.pad !== pad) continue;
      const d = Math.abs(n.t - hb);
      if (d <= W && d < bd) { best = n; bd = d; }
    }
    if (!best) {
      st.extra++; flashLane(pad, false);
      setFx((G.lanes.indexOf(pad) >= 0 ? 'Extra hit: ' : 'Wrong pad: ') + PAD[pad].name, '#eb5757');
      return;
    }
    const err = (hb - best.t) * beatSec() * 1000;
    best.state = 1; best.fxT = now;
    st.hit++; st.perPad[pad].hit++; st.errs.push(err);
    if (fromAudio) st.audioErrs.push(err);
    const a = Math.abs(err);
    flashLane(pad, true);
    if (a <= 45) { st.perfect++; addPoints(st, 100); pop(pad, 'Perfect!', '#6fcf97', true); }
    else if (a <= 90) { st.good++; addPoints(st, 70); pop(pad, 'Good', '#b7e08f'); }
    else { st.ok++; addPoints(st, 40); pop(pad, err < 0 ? 'Early' : 'Late', '#f2c94c'); }
  });
}
function gameAudioHit(h) {
  if (!G.running || G.demo || !calibrated()) return;
  const time = h.time - settings.offsetMs / 1000;
  // What does the lesson expect around now? Used to give the benefit of the doubt on close calls.
  const expected = [];
  if (G.wait) {
    const nxt = nextPending();
    if (nxt) expected.push(G.notes.filter(n => n.t === nxt.t && n.state === 0).map(n => n.pad));
  } else {
    const hb = beatAt(time), W = windowBeats();
    const byT = {};
    for (let i = G.head; i < G.notes.length; i++) {
      const n = G.notes[i];
      if (n.t > hb + W) break;
      if (n.state === 0 && Math.abs(n.t - hb) <= W) (byT[n.t] = byT[n.t] || []).push(n.pad);
    }
    Object.keys(byT).forEach(k => expected.push(byT[k]));
  }
  const r = Ear.classify(h.feat, { expected });
  if (r.click || !r.pads.length) return;
  if (r.keys.indexOf('hihatopen') >= 0 && G.stats && learned('hihat')) G.stats.openHat = (G.stats.openHat || 0) + 1;   // the hi-hat was left ringing
  handleHit(r.pads, time, true);
}

// ---------- Your own music: the practice screen ----------
function trackLesson(rec) {
  const part = partOf(rec);
  return {
    id: rec.id, title: rec.name, own: true, bpm: Math.round(Track.bpm()), div: part.div, reps: 1,
    goal: part.name + ': ' + part.goal,
    tip: 'Wear headphones plugged into the computer, so the microphone hears the drum pad and not the song. Too hard? Lower the song speed or pick an easier drum part.',
    bars: barsOf(Track.totalBeats() / 4, part.bar)
  };
}
function openTrack(firstTime) {
  const rec = Track.rec;
  G.track = rec; G.idx = -1;
  G.title = 'Your song: ' + rec.name;
  $('#trackPart').value = partOf(rec).id;
  $('#speed').value = rec.speed || 100; $('#speedTxt').textContent = $('#speed').value;
  $('#seek').value = 0; $('#seekTxt').textContent = '0:00';
  $('#tapTxt').textContent = TAP_HELP;
  setLesson(trackLesson(rec));
  updateAlignUi();
  $('#alignBox').open = !!firstTime;   // a new song has to be checked once
  show('play');
}
function updateAlignUi() {
  const rec = G.track;
  if (!rec) return;
  $('#alignInfo').textContent = 'The app counts about ' + Math.round(Track.bpm()) + ' beats per minute in this song.' +
    (rec.steady ? '' : ' Its speed wanders a little, as it does when a band plays without a click; the notes follow it.');
  $('#nudgeTxt').textContent = rec.nudge ? 'moved ' + Math.abs(rec.nudge) + ' ms ' + (rec.nudge < 0 ? 'earlier' : 'later') : '';
  $('#alHalf').disabled = rec.mult === 0.5;
  $('#alDouble').disabled = rec.mult === 2;
}
// Small shift of all notes against the song; takes effect at once, also while it plays.
function nudge(ms) {
  const rec = G.track;
  if (!rec) return;
  rec.nudge = Math.max(-500, Math.min(500, (rec.nudge || 0) + ms));
  Track.save();
  Track.buildMap();
  updateAlignUi();
}
// A change that renumbers the beats: rebuild the notes, and carry on the demo from where the song was.
function restructure(change, reguess) {
  const rec = G.track;
  if (!rec || (G.running && !G.demo)) return;
  const wasDemo = G.running, at = wasDemo ? Track.media(Ear.ctx.currentTime) : 0;
  if (G.running) stopRun(false);
  const old = { beats: rec.beats, steady: rec.steady, mult: rec.mult, half: rec.half, shift: rec.shift };
  let ok = change(rec) !== false;
  if (ok) {
    if (reguess) Track.guessShift();
    Track.buildMap();
    ok = Track.totalBeats() >= 4;
  }
  if (!ok) { Object.assign(rec, old); Track.buildMap(); }
  Track.save();
  setLesson(trackLesson(rec));
  updateAlignUi();
  if (wasDemo) startRun(true, Math.max(0, Math.min(at, rec.dur - 3))); else draw();
  return ok;
}
const TAP_HELP = 'If the click is completely off: tap this button in time with the song, 8 times or more.';
const Tap = { times: [], timer: null };
function tapBeat() {
  const say = (t) => { $('#tapTxt').textContent = t; };
  if (!(G.track && G.running && G.demo)) { say('First press "Listen first", then tap this button in time with the song.'); return; }
  Tap.times.push(Track.media(Ear.ctx.currentTime));
  clearTimeout(Tap.timer);
  say(Tap.times.length < 8 ? 'Keep tapping: ' + Tap.times.length + ' of 8' : Tap.times.length + ' taps. Stop tapping when you are happy.');
  Tap.timer = setTimeout(() => {
    const t = Tap.times;
    Tap.times = [];
    if (!G.track) return;
    if (t.length < 6) { say('Too few taps. Tap at least 8 times in a row.'); return; }
    const gap = median(t.slice(1).map((v, i) => v - t[i]));
    if (!(gap > 0.25 && gap < 1.5)) { say('That was too fast or too slow to be a beat. Try again.'); return; }
    say('Listening to the song again...');
    setTimeout(() => {
      if (!G.track) return;
      const ok = restructure(() => Track.retrack(gap), false);
      say(ok ? 'Done. Listen whether the click fits the song now.' : 'The app could not follow that beat, so nothing was changed.');
    }, 60);
  }, 1800);
}
let seeking = false;

// ---------- Drawing ----------
function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function draw() {
  if (screen !== 'play' || !G.lesson) return;
  updatePadView();
  updateSheet();
  const cv = $('#lane');
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  const lanes = G.lanes, now = performance.now(), pos = G.viewPos;
  const laneW = Math.min(130, (w - 110) / lanes.length);
  const x0 = (w - laneW * lanes.length) / 2;
  const hitY = h - 128;
  const div = G.lesson.div;
  c.textAlign = 'center';
  const B = barBeats(G.lesson), stepsBar = B * div;
  const span = div >= 6 ? 1.5 : div === 4 ? 2 : div === 3 ? 3 : 4;   // beats visible above the hit line (fewer when the notes are packed four to a beat)
  const ppb = (hitY - 16) / span;
  const yOf = (t) => hitY - (t - pos) * ppb;

  lanes.forEach((id, i) => {
    c.fillStyle = i % 2 ? '#111522' : '#151a29';
    c.fillRect(x0 + i * laneW, 0, laneW, h);
    const f = G.flash[id];
    if (f && now - f.t < 220) {
      c.globalAlpha = 0.35 * (1 - (now - f.t) / 220);
      c.fillStyle = f.good ? '#6fcf97' : '#eb5757';
      c.fillRect(x0 + i * laneW, 0, laneW, h);
      c.globalAlpha = 1;
    }
  });
  // Grid lines with the count beside them: "1 2 3 4", "1 & 2 &" or "1 e & a", whichever the lesson uses.
  for (let s = Math.ceil((pos - 0.9) * div); s <= (pos + span + 0.2) * div; s++) {
    const b = s / div, sub = ((s % div) + div) % div;
    if (b < 0 || b > G.totalBeats) continue;
    const y = yOf(b), bar = s % stepsBar === 0;
    c.strokeStyle = bar ? '#44507a' : sub === 0 ? '#262e45' : '#1b2133';
    c.lineWidth = bar ? 2 : 1;
    c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + laneW * lanes.length, y); c.stroke();
    if (b < G.totalBeats && y < hitY + 8) {
      const near = Math.abs(b - pos) < 0.5 / div && G.running;   // the count that is "now" lights up
      c.fillStyle = near ? '#f2c94c' : sub === 0 ? '#c9d1e3' : '#6f7a94';
      c.font = (sub === 0 ? '700 ' : '') + (near ? 20 : sub === 0 ? 16 : 13) + 'px "Segoe UI", sans-serif';
      const inBar = ((s % stepsBar) + stepsBar) % stepsBar;
      c.fillText(G.lesson.count ? G.lesson.count[inBar % G.lesson.count.length] : sub === 0 ? String(Math.floor(inBar / div) + 1) : COUNT[div][sub], x0 - 22, y + 5);
    }
  }
  if (G.heard && now - G.heard < 140) {
    const a = 1 - (now - G.heard) / 140;
    c.fillStyle = 'rgba(232,236,244,' + (0.28 * a).toFixed(3) + ')';
    c.fillRect(x0, hitY - 14, laneW * lanes.length, 28);
  }
  c.strokeStyle = '#e8ecf4'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(x0, hitY); c.lineTo(x0 + laneW * lanes.length, hitY); c.stroke();

  for (let i = G.head; i < G.notes.length; i++) {
    const n = G.notes[i];
    if (n.t - pos > span + 0.3) break;
    const li = lanes.indexOf(n.pad);
    const cx = x0 + (li + 0.5) * laneW;
    const nw = laneW - 28, nh = 24;
    if (n.state === 1) {
      const a = 1 - (now - n.fxT) / 300;
      if (a <= 0) continue;
      c.globalAlpha = a; c.strokeStyle = '#6fcf97'; c.lineWidth = 3;
      c.beginPath(); c.arc(cx, hitY, 16 + (1 - a) * 26, 0, 6.283); c.stroke();
      c.globalAlpha = 1;
      continue;
    }
    const y = yOf(n.t);
    if (y > h + 20) continue;
    if (G.sheetOnly && G.running && n.state === 0) continue;
    c.globalAlpha = n.state === 2 ? 0.3 : 1;
    c.fillStyle = n.state === 2 ? '#7a8296' : PAD[n.pad].color;
    rr(c, cx - nw / 2, y - nh / 2, nw, nh, 8); c.fill();
    if (n.state === 0 && n.limb) {
      // Which hand or foot: a letter in the note, and a white end on the side of that hand.
      const right = n.limb[0] === 'R', foot = n.limb[1] === 'F';
      c.fillStyle = '#ffffff';
      rr(c, right ? cx + nw / 2 - 9 : cx - nw / 2, y - nh / 2, 9, nh, 4); c.fill();
      c.fillStyle = '#0d1017'; c.font = '800 15px "Segoe UI", sans-serif';
      c.fillText((right ? 'R' : 'L') + (foot ? ' foot' : ''), cx, y + 5);
    }
    c.globalAlpha = 1;
  }

  // The drummer's two hands and two feet: each one lights up as its note comes down to the line.
  const glow = {};
  for (let i = G.head; i < G.notes.length; i++) {
    const n = G.notes[i], d = n.t - pos;
    if (d > 0.75) break;
    if (d < -0.12 || n.state === 2 || !n.limb) continue;
    glow[n.limb] = Math.max(glow[n.limb] || 0, d <= 0 ? 1 : 1 - d / 0.75);
  }
  const used = {};
  G.notes.length && G.lanes.forEach(p => { used[p === 'kick' ? (settings.lefty ? 'LF' : 'RF') : p === 'hhpedal' ? (settings.lefty ? 'RF' : 'LF') : 'H'] = true; });
  [['LF', 'Left foot'], ['LH', 'Left hand'], ['RH', 'Right hand'], ['RF', 'Right foot']].forEach((lb, k) => {
    const bw = Math.min(124, (w - 50) / 4), bx = w / 2 + (k - 2) * (bw + 8) + 4, by = h - 42;
    const g = glow[lb[0]] || 0, inUse = used[lb[0]] || (lb[0][1] === 'H' && used.H);
    c.fillStyle = 'rgba(91,140,255,' + (0.1 + 0.9 * g * g).toFixed(3) + ')';
    rr(c, bx, by, bw, 32, 16); c.fill();
    c.strokeStyle = g > 0.95 ? '#ffffff' : '#2f3850'; c.lineWidth = 2;
    rr(c, bx, by, bw, 32, 16); c.stroke();
    c.fillStyle = inUse ? '#e8ecf4' : '#4b556e'; c.font = '600 14px "Segoe UI", sans-serif';
    c.fillText(lb[1], bx + bw / 2, by + 21);
  });
  // How far through, and how many right hits in a row.
  if (G.running && G.totalBeats > 0) {
    c.fillStyle = '#5b8cff';
    c.fillRect(0, 0, w * Math.max(0, Math.min(1, pos / G.totalBeats)), 4);
    if (!G.demo && G.stats) {
      const m = comboMult(), sk = G.streak || 0;
      c.textAlign = 'left'; c.fillStyle = '#ffffff'; c.font = '800 22px "Segoe UI", sans-serif';
      c.fillText(String(G.stats.points), 14, 34);
      c.font = '600 12px "Segoe UI", sans-serif'; c.fillStyle = '#96a0b8';
      c.fillText('points', 14, 50);
      if (sk >= 3) {
        c.textAlign = 'right'; c.fillStyle = m > 1 ? '#f2c94c' : '#e8ecf4'; c.font = '800 20px "Segoe UI", sans-serif';
        c.fillText(sk + ' in a row' + (m > 1 ? '  ×' + m : ''), w - 14, 34);
        if (m < 4) {   // how close the next multiplier is
          c.fillStyle = '#2f3850'; c.fillRect(w - 114, 42, 100, 5);
          c.fillStyle = '#f2c94c'; c.fillRect(w - 114, 42, 100 * ((sk % 10) / 10), 5);
        }
      }
    }
  }

  c.textAlign = 'center';
  // The target on the line fills with colour as its note arrives, then the words and sparks of recent hits.
  const near = {};
  for (let i = G.head; i < G.notes.length; i++) {
    const n = G.notes[i], d = n.t - pos;
    if (d > 0.6) break;
    if (n.state === 0 && d > -0.15) near[n.pad] = Math.max(near[n.pad] || 0, 1 - Math.max(0, d) / 0.6);
  }
  G.pops.forEach(p => {
    const a = (now - p.t) / 650, li = lanes.indexOf(p.pad);
    if (a >= 1 || li < 0) return;
    const cx = x0 + (li + 0.5) * laneW;
    c.globalAlpha = 1 - a; c.fillStyle = p.color; c.font = '800 ' + (p.burst ? 19 : 16) + 'px "Segoe UI", sans-serif';
    c.fillText(p.text, cx, hitY - 26 - 46 * a);
    if (p.burst) for (let k = 0; k < 8; k++) {
      const ang = k * 0.785 + 0.4, r = 18 + 46 * a;
      c.beginPath(); c.arc(cx + Math.cos(ang) * r, hitY + Math.sin(ang) * r, 3.5 * (1 - a) + 1, 0, 6.283); c.fill();
    }
    c.globalAlpha = 1;
  });
  lanes.forEach((id, i) => {
    const cx = x0 + (i + 0.5) * laneW;
    if (near[id] && G.running) {
      c.globalAlpha = 0.2 + 0.6 * near[id]; c.fillStyle = PAD[id].color;
      c.beginPath(); c.arc(cx, hitY, 13 + 7 * near[id], 0, 6.283); c.fill();
      c.globalAlpha = 1;
    }
    c.strokeStyle = PAD[id].color; c.lineWidth = 3;
    c.beginPath(); c.arc(cx, hitY, 15, 0, 6.283); c.stroke();
    c.fillStyle = '#e8ecf4'; c.font = '600 14px "Segoe UI", sans-serif';
    c.fillText(PAD[id].name, cx, hitY + 40);
    c.fillStyle = '#6f7a94'; c.font = '12px "Segoe UI", sans-serif';
    if (!TOUCH) c.fillText('key ' + PAD[id].keyLabel, cx, hitY + 58);
  });

  // Beat lights: a silent metronome. Beat 1 is yellow; the current beat swells and fades.
  if (G.running && !G.wait && G.metroMode !== 'off' && pos > -preBeats() - 0.05) {
    const bi = Math.floor(pos), frac = pos - bi, cur = ((bi % B) + B) % B;
    c.fillStyle = 'rgba(13,16,23,0.85)';
    rr(c, w / 2 - 8 - 21 * B, 8, 16 + 42 * B, 44, 22); c.fill();
    for (let k = 0; k < B; k++) {
      const on = k === cur;
      c.globalAlpha = on ? 1 - 0.5 * frac : 1;
      c.fillStyle = on ? (k === 0 ? '#f2c94c' : '#e8ecf4') : '#2f3850';
      c.beginPath(); c.arc(w / 2 + (k - (B - 1) / 2) * 42, 30, on ? 9 + 8 * (1 - frac) : 8, 0, 6.283); c.fill();
    }
    c.globalAlpha = 1;
  }
  if (G.fx && now - G.fx.t < 700) {
    c.globalAlpha = 1 - (now - G.fx.t) / 700;
    c.fillStyle = G.fx.color; c.font = '700 26px "Segoe UI", sans-serif';
    c.fillText(G.fx.text, w / 2, hitY - 40);
    c.globalAlpha = 1;
  }
  if (G.running && !G.wait && pos < 0 && pos >= -preBeats() - 0.05) {
    c.fillStyle = '#e8ecf4'; c.font = '800 90px "Segoe UI", sans-serif';
    const fb = Math.floor(pos);
    c.fillText(String(((fb % B) + B) % B + 1), w / 2, h / 2);
    c.font = '16px "Segoe UI", sans-serif'; c.fillStyle = '#96a0b8';
    c.fillText('Get ready', w / 2, h / 2 + 34);
  } else if (!G.running) {
    c.font = '16px "Segoe UI", sans-serif';
    const msg = 'Press Start. Hit each note as it reaches the white line.';
    const mw = c.measureText(msg).width + 28;
    c.fillStyle = 'rgba(13,16,23,0.88)';
    rr(c, w / 2 - mw / 2, hitY - 62, mw, 34, 10); c.fill();
    c.fillStyle = '#e8ecf4';
    c.fillText(msg, w / 2, hitY - 40);
  }
}

// ---------- Recap ----------
function median(a) {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}
function renderRecap(st, wasWait, climb) {
  const total = st.hit + st.miss;
  const own = !!G.track;
  let score;
  if (wasWait) score = st.hit / Math.max(1, st.hit + st.extra);
  else score = Math.max(0, (st.perfect + 0.8 * st.good + 0.5 * st.ok - 0.25 * st.extra) / total);
  // Stars are earned by playing (nearly) to the end; a long song of your own counts after 100 notes.
  const need = own ? Math.min(0.9 * G.notes.length, 100) : 0.9 * G.notes.length;
  const enough = climb ? climb.segs >= 2 : total >= need;   // Speed climb has no end: two finished rounds count as a full run
  // Wait mode has no time pressure, so it can earn one star at most: the rest are for playing in time.
  const stars = !enough ? 0 : wasWait ? (score >= 0.8 ? 1 : 0) : score >= 0.92 ? 3 : score >= 0.8 ? 2 : score >= 0.6 ? 1 : 0;
  const id = G.lesson.id;
  const prevStars = progress[id] ? progress[id].stars : 0;
  const pr = progress[id] || (progress[id] = { best: 0, stars: 0 });
  if (enough && (score > pr.best || !pr.tries)) { pr.best = Math.max(pr.best, score); pr.stars = Math.max(pr.stars, stars); }
  pr.tries = (pr.tries || 0) + 1;
  // Clean runs (a star or better, played in time) are counted for ever: repeating a finished lesson earns medals.
  const cleanRun = enough && stars >= 1 && !wasWait;
  const today = dayStr(new Date());
  const revisit = cleanRun && prevStars === 3 && pr.last && pr.last !== today;   // came back to a finished lesson on a later day
  const tierBefore = repTier(pr.reps || 0);
  if (cleanRun) { pr.reps = (pr.reps || 0) + 1; pr.last = today; }
  const runBpm = climb ? (climb.top || climb.start) : (G.minBpm || G.bpm);   // Speed climb: the fastest tempo played cleanly
  const newTop = !wasWait && !own && runBpm > (pr.bpm || 0) && (climb ? climb.top > 0 : enough && stars >= 2);
  const wasMaster = !own && mastered(G.lesson);
  if (newTop) pr.bpm = runBpm;
  store.set('progress', progress);
  recordRun(id, { s: score, st: stars, bpm: runBpm, hit: st.hit, total, med: Math.round(median(st.errs)), w: wasWait ? 1 : 0 });
  // Points, rank and badges, and a little party for a good run.
  const gain = awardRun({ st, score, stars, prevStars, wasWait, own, enough, lesson: G.lesson, bpm: runBpm, revisit });
  const who = prof().name ? ', ' + prof().name : '';
  $('#recapCheer').textContent = stars === 3 ? '🌟 Amazing' + who + '!' : stars === 2 ? '🎉 Great job' + who + '!' : stars === 1 ? '👍 Good work' + who + '!' : enough ? '💪 Nearly there' + who + '. Try again!' : 'Stopped early';
  // The player's own drummer flies in to celebrate; for two stars or more the Beat Brothers cheer along.
  const rf = $('#recapFace');
  rf.innerHTML = faceHtml(prof(), stars >= 1);
  rf.classList.remove('flyIn'); void rf.offsetWidth; rf.classList.add('flyIn');
  $('#recapBros').innerHTML = stars >= 2 ? '<span class="brosSay">' + (stars === 3 ? 'The Beat Brothers say: WOW!' : 'The Beat Brothers say: nice one!') + '</span>' : '';
  // The Beat Brothers stand left and right of the result, in a pose that fits it.
  const poses = stars === 3 ? ['trophy', 'jump'] : stars === 2 ? ['clap', 'cheer'] : stars === 1 ? ['thumb', 'hi5'] : ['ready', 'think'];   // no stars: "let's try again", not a victory pose
  $('#recapBroL').innerHTML = mascotHtml(0, false, poses[0]); $('#recapBroR').innerHTML = mascotHtml(1, false, poses[1]);
  document.getElementById('recap').dataset.stars = stars;
  $('#recapPoints').textContent = st.points;
  $('#recapCombo').textContent = st.bestCombo;
  $('#recapXp').textContent = '+' + gain.xp;
  $('#recapRank').textContent = gain.rankUp ? 'New rank: ' + gain.rankUp.icon + ' ' + gain.rankUp.name + '!' : 'Rank points · ' + gain.rank.icon + ' ' + gain.rank.name;
  const nb = $('#recapBadges');
  nb.innerHTML = '';
  gain.badges.forEach(b => { const e = document.createElement('span'); e.className = 'newBadge'; e.textContent = b.icon + ' New badge: ' + b.name; nb.appendChild(e); });
  const line = (text) => { const e = document.createElement('span'); e.className = 'newBadge'; e.textContent = text; nb.appendChild(e); };
  if (G.gig) Tour.lessonDone(stars).forEach(line);
  if (climb) line(climb.top ? '🚀 Speed climb: you reached ' + climb.top + ' BPM (started at ' + climb.start + ')' : '🚀 Speed climb: no clean round yet. Try a lower tempo.');
  if (gain.rankUp) {
    const gear = Object.keys(GEAR_RANK).filter(k => GEAR_RANK[k] === gain.rankUp.k).map(gearName);
    if (gear.length) line('🎁 New gear for your drummer: ' + gear.join(', '));
  }
  const teach = !own && TEACH[G.lesson.lv];
  $('#recapFocus').classList.toggle('hidden', !teach);
  if (teach) $('#recapFocus').textContent = '🎓 Ask yourself: ' + teach.focus + ' Did you manage it?';
  if (stars >= 1) fanfare(stars);
  if (!own && !wasMaster && mastered(G.lesson)) { const e = document.createElement('span'); e.className = 'newBadge'; e.textContent = '👑 Goal tempo reached: ' + pr.bpm + ' BPM'; nb.appendChild(e); }
  else if (newTop && !own) { const e = document.createElement('span'); e.className = 'newBadge'; e.textContent = '⚡ New top tempo: ' + pr.bpm + ' BPM (goal ' + goalBpm(G.lesson) + ')'; nb.appendChild(e); }
  if (cleanRun) {
    const tier = repTier(pr.reps), next = REP_TIERS.find(t => t[0] > pr.reps);
    const e = document.createElement('span');
    e.className = 'newBadge' + (tier && tier !== tierBefore ? '' : ' plain');
    e.textContent = tier && tier !== tierBefore ? tier[2] + ' ' + tier[1] + ' practice medal: ' + pr.reps + ' clean runs of this lesson!'
      : '🔁 Clean run ' + pr.reps + ' of this lesson.' + (next ? ' ' + (next[0] - pr.reps) + ' more for the ' + next[1].toLowerCase() + ' medal.' : '');
    nb.appendChild(e);
  }
  if (stars >= 2 || gain.rankUp || gain.badges.length || (cleanRun && repTier(pr.reps) !== tierBefore)) confetti(2600);
  $('#recapNote').textContent = enough && wasWait ? 'Wait mode earns one star at most. Play it in time for more.' : enough ? '' : 'Stopped early. Play ' + (own ? 'a little longer' : 'to the end') + ' to earn stars.';

  const med = median(st.errs);
  const mean = st.errs.reduce((a, b) => a + b, 0) / Math.max(1, st.errs.length);
  const spread = Math.sqrt(st.errs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, st.errs.length));
  $('#recapTitle').textContent = G.lesson.title + (wasWait ? ' (Wait mode)' : '');
  $('#nextBtn').textContent = G.lesson.song ? 'Next song' : 'Next lesson';
  $('#homeBtn').textContent = listOf() === 'tour' ? 'Back to the Tour' : listOf() === 'songs' ? 'All songs' : 'All lessons';
  $('#recapStars').innerHTML = [0, 1, 2].map(i => '<span class="st' + (i < stars ? ' on" style="animation-delay:' + (i * 0.25) + 's' : '') + '">★</span>').join('');
  $('#recapScore').textContent = Math.round(score * 100) + '%';
  $('#recapAcc').textContent = st.hit + ' / ' + total;
  $('#recapTiming').textContent = wasWait ? 'not timed' : Math.abs(med) < 10 ? 'on time' : Math.round(Math.abs(med)) + ' ms ' + (med < 0 ? 'early' : 'late');
  $('#recapExtra').textContent = st.extra;

  const padsEl = $('#recapPads');
  padsEl.innerHTML = '';
  let worst = null, worstRate = 0;
  Object.keys(st.perPad).forEach(p => {
    const pp = st.perPad[p], t = pp.hit + pp.miss;
    if (!t) return;
    const rate = pp.miss / t;
    if (rate > worstRate) { worstRate = rate; worst = p; }
    const row = document.createElement('div');
    row.className = 'padRow';
    row.innerHTML = '<span></span><div class="bar"><i style="width:' + Math.round(100 * pp.hit / t) + '%"></i></div><span class="muted small">' + pp.hit + ' / ' + t + '</span>';
    row.firstChild.textContent = PAD[p].name;
    padsEl.appendChild(row);
  });

  const beatWord = own ? 'beat' : 'click';
  const tips = [];
  if (!wasWait && st.errs.length >= 4) {
    if (med > 25) tips.push('You tend to play about ' + Math.round(med) + ' ms late. Aim to land exactly with the ' + beatWord + ', not after you hear it.');
    if (med < -25) tips.push('You tend to rush, about ' + Math.round(-med) + ' ms early. Relax your shoulders and wait for the ' + beatWord + '.');
    if (spread > 60) tips.push('Your timing is uneven from hit to hit. ' + (own ? 'Lower the song speed until it feels steady.' : 'Lower the tempo until it feels steady, then speed up.'));
  }
  if (G.stats && G.stats.openHat >= 3) tips.push('The hi-hat was left ringing on ' + G.stats.openHat + ' hits. Keep the hi-hat pedal pressed down while you play, so each hit is short and clear.');
  if (worst && worstRate > 0.3) tips.push('Most misses were on the ' + PAD[worst].name + '. Practise that part on its own first.');
  if (st.extra > Math.max(3, total * 0.2)) tips.push(own ? 'Many wrong or extra hits. Pick an easier drum part for this song, or check that the headphones are plugged in.' : 'Many wrong or extra hits. Try Wait mode to learn the order without time pressure.');
  if (st.miss > total * 0.4 && !wasWait) tips.push(own ? 'That is too fast for now. Lower the song speed, or pick an easier drum part.' : 'That tempo is too fast for now. Drop the tempo slider by 10 to 20 BPM.');
  if (score >= 0.92) tips.push(own ? 'Excellent. Try a harder drum part, or the next song.' : 'Excellent. Move on to the next lesson, or raise the tempo by 10 BPM.');
  else if (score >= 0.8) tips.push(own ? 'Solid. One more clean run and you are ready for a harder drum part.' : 'Solid. One more clean run and you are ready for the next lesson.');
  if (!tips.length) tips.push('Keep going. Short, regular practice beats one long session.');
  $('#recapTips').innerHTML = '';
  tips.forEach(t => { const li = document.createElement('li'); li.textContent = t; $('#recapTips').appendChild(li); });

  // Hits that are all early or all late by the same amount point at the equipment, not at the player.
  const offer = $('#offsetOffer');
  const am = Math.round(median(st.audioErrs));
  offer.classList.toggle('hidden', !(st.audioErrs.length >= (own ? 16 : 8) && Math.abs(am) > 25));
  if (!offer.classList.contains('hidden')) {
    offer.innerHTML = '<span class="muted small"></span><button id="offsetApply"></button>';
    const sign = (am > 0 ? '+' : '') + am + ' ms';
    if (own) {
      offer.firstChild.textContent = 'If you felt in time, the notes may sit slightly off this song.';
      $('#offsetApply').textContent = 'Move this song\'s notes by ' + sign;
      const songMs = Math.round(am * Track.rate);   // the hits were timed at the speed played; the notes are stored at full speed
      $('#offsetApply').onclick = () => { nudge(songMs); offer.innerHTML = '<span class="muted small">Done. The notes of this song were moved by ' + sign + '.</span>'; };
    } else {
      offer.firstChild.textContent = 'If you felt in time, the delay of your sound card may be the cause.';
      $('#offsetApply').textContent = 'Shift timing offset by ' + sign;
      $('#offsetApply').onclick = () => {
        setOffset(settings.offsetMs + am);
        settings.offsetChosen = true; saveSettings();
        offer.innerHTML = '<span class="muted small">Timing offset is now ' + settings.offsetMs + ' ms.</span>';
      };
    }
  }
  $('#nextBtn').classList.toggle('hidden', own || !!G.gig || G.idx >= LESSONS.length - 1);
  show('recap');
}

// ---------- Wiring ----------
function syncSettingsUi() {
  $('#sens').value = settings.sens;
  $('#offset').value = settings.offsetMs; $('#offsetTxt').textContent = settings.offsetMs + ' ms';
  $('#clickVol').value = settings.clickVol;
  $('#meterMark').style.left = (meterPos(floorFromSens(settings.sens)) * 100) + '%';
}
$('#navHome').onclick = () => show('home');
$('#navLearn').onclick = () => show('learn');
$('#navProgress').onclick = () => show('progress');
$('#weakBtn').onclick = () => { show('progress'); $('#pgWeak').scrollIntoView({ block: 'center' }); };
$('#tdHome').onclick = () => show('home');
$('#tdProgress').onclick = () => show('progress');
$('#certPrint').onclick = () => window.print();
$('#certBack').onclick = () => show('progress');
$('#pgSave').onclick = saveBackup;
$('#pgLoad').onclick = () => $('#pgFile').click();
$('#pgFile').onchange = () => { if ($('#pgFile').files[0]) loadBackup($('#pgFile').files[0]); $('#pgFile').value = ''; };
$('#pgReset').onclick = () => {
  const b = $('#pgReset');
  if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Really erase all progress?'; setTimeout(() => { delete b.dataset.sure; b.textContent = 'Erase all progress'; }, 4000); return; }
  const me = prof(), keep = { name: me.name, av: me.av, photo: me.photo };   // the name and picture stay; stars, ranks and badges go
  ['progress', 'profile', 'history'].forEach(k => store.del(k));
  if (keep.name) store.set('profile', Object.assign({ xp: 0 }, keep));
  location.reload();
};
$('#learnLink').onclick = (e) => { e.preventDefault(); show('learn'); };
$('#learnDone').onclick = () => show('home');
$('#navSetup').onclick = () => show('setup');
$('#bannerSetup').onclick = () => show('setup');
$('#connectBtn').onclick = connect;
$('#sens').oninput = (e) => { settings.sens = +e.target.value; saveSettings(); applyInputSettings(); };
$('#offset').oninput = (e) => { settings.offsetMs = +e.target.value; settings.offsetChosen = true; $('#offsetTxt').textContent = settings.offsetMs + ' ms'; saveSettings(); };
$('#clickVol').oninput = (e) => { settings.clickVol = +e.target.value; Ear.clickVolume = settings.clickVol / 100; saveSettings(); };
$('#latBtn').onclick = latStart;
$('#calStart').onclick = () => { const k = CAL_ORDER.find(x => !learned(x)); if (k) calPick(k, true); };
$('#calSkip').onclick = calNext;
$('#calPause').onclick = () => calPause();
$('#calRedo').onclick = () => calArm(false);
$('#calMore').onclick = () => { Cal.append = true; calArm(false); };
$('#chkStart').onclick = () => (Chk.active ? chkStop('Check stopped.') : chkStart());
$('#calHear').onclick = calHear;
$('#calForget').onclick = () => { setTemplates(T => { delete T[Cal.key]; }); calArm(false); };
$('#calReset').onclick = () => {
  const b = $('#calReset');
  if (!b.dataset.sure) {   // two clicks, so a slip of the mouse does not wipe a minute of work
    b.dataset.sure = '1'; b.textContent = 'Really forget every pad?';
    setTimeout(() => { delete b.dataset.sure; b.textContent = 'Forget all pads'; }, 3000);
    return;
  }
  delete b.dataset.sure; b.textContent = 'Forget all pads';
  Ear.templates = {}; store.set('cal2', {});
  Cal.clickChecked = false; Cal.msg = 'All pads forgotten.';
  calUi();
};
$('#backBtn').onclick = () => show(listOf());
$('#navSongs').onclick = () => show('songs');
$('#navTour').onclick = () => show('tour');
$('#navMe').onclick = () => show('me');
$('#homeFace').onclick = () => show('me');
$('#setupMe').onclick = () => show('me');
$('#appName').value = settings.appName || '';
$('#appName').oninput = (e) => { settings.appName = e.target.value.trim(); saveSettings(); renderHeader(); };
$('#startBtn').onclick = () => {
  if (G.running && G.demo) { stopRun(false); startRun(false); }
  else if (G.running) stopRun(true);
  else startRun(false);
};
$('#demoBtn').onclick = () => { if (G.running) stopRun(false); else startRun(true); };
$('#metroMode').value = settings.metroMode || 'sound';
$('#metroMode').onchange = (e) => { settings.metroMode = e.target.value; saveSettings(); G.metroMode = e.target.value; };
$('#musicOn').onchange = (e) => { G.music = !!G.mel && e.target.checked && !G.wait; };
$('#tempo').oninput = (e) => {
  const bpm = +e.target.value;
  $('#tempoTxt').textContent = bpm; $('#tempoWord').textContent = '(' + tempoWord(bpm) + ')';
  if (G.running && !G.wait && !G.track) {   // keep the exact position, change only the speed
    const now = Ear.ctx.currentTime;
    G.tStart = now - (beatAt(now) + preBeats()) * 60 / bpm;
    G.minBpm = Math.min(G.minBpm || bpm, bpm);
  }
  G.bpm = bpm;
};
$('#againBtn').onclick = () => {
  if (G.track) { openTrack(false); return; }
  const bpm = G.bpm;   // keep the tempo the player had chosen
  if (G.gig) { Tour.k = G.gig.stop; Tour.lesson(G.gig.kind); return; }
  openLesson(G.idx);
  G.bpm = bpm; $('#tempo').value = bpm; $('#tempoTxt').textContent = bpm; $('#tempoWord').textContent = '(' + tempoWord(bpm) + ')';
};
$('#handSel').value = settings.lefty ? 'L' : 'R';
$('#handSel').onchange = (e) => { settings.lefty = e.target.value === 'L'; saveSettings(); };
$('#nextBtn').onclick = () => openLesson(Math.min(LESSONS.length - 1, G.idx + 1));
$('#homeBtn').onclick = () => show(listOf());
window.addEventListener('resize', draw);
// Notes cannot be drawn or scheduled while the tab is hidden, so a run is stopped rather than left to fall apart.
document.addEventListener('visibilitychange', () => { if (document.hidden && G.running) stopRun(false); });

// Your own music
TRACK_PARTS.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name; $('#trackPart').appendChild(o); });
$('#addSong').onclick = () => { $('#songFile').value = ''; $('#songFile').click(); };
$('#songFile').onchange = (e) => { const f = e.target.files[0]; if (f) loadTrack(null, f); };
$('#trackPart').onchange = (e) => {
  const rec = G.track;
  if (!rec) return;
  if (G.running) stopRun(false);
  rec.part = e.target.value;
  Track.save();
  setLesson(trackLesson(rec));
  draw();
};
$('#speed').oninput = (e) => {
  $('#speedTxt').textContent = e.target.value;
  if (G.track) { G.track.speed = +e.target.value; Track.save(); }
};
$('#alEarlier').onclick = () => nudge(-10);
$('#alLater').onclick = () => nudge(10);
$('#alHalf').onclick = () => restructure(r => { r.mult = r.mult === 2 ? 1 : 0.5; r.half = false; }, true);
$('#alDouble').onclick = () => restructure(r => { r.mult = r.mult === 0.5 ? 1 : 2; r.half = false; }, true);
$('#alBetween').onclick = () => restructure(r => { r.half = !r.half; }, true);
$('#alSwap').onclick = () => restructure(r => { r.shift = r.shift ? 0 : 1; }, false);
$('#alTap').onpointerdown = (e) => { e.preventDefault(); tapBeat(); };
$('#seek').oninput = (e) => { seeking = true; if (G.track) $('#seekTxt').textContent = fmtTime(e.target.value / 1000 * G.track.dur); };
$('#seek').addEventListener('pointerup', () => setTimeout(() => { seeking = false; }, 60));   // released where it started: no "change" follows
$('#seek').onchange = (e) => {
  seeking = false;
  if (!G.track || (G.running && !G.demo)) return;
  const at = Math.max(0, Math.min(e.target.value / 1000 * G.track.dur, G.track.dur - 5));
  if (G.running) stopRun(false);
  startRun(true, at);
};

const KEY_TO_PAD = {};
// Keys are matched by their place on the keyboard, so they also work when Windows is set to Arabic or another script.
PADS.forEach(p => { KEY_TO_PAD[p.key === ' ' ? 'Space' : 'Key' + p.key.toUpperCase()] = p.id; });
window.addEventListener('keydown', (e) => {
  if (screen === 'tour') { Tour.key(e); return; }
  if (screen !== 'play' || !G.running || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
  const pad = KEY_TO_PAD[e.code];
  if (!pad) return;
  e.preventDefault();
  handleHit([pad], Ear.ctx.currentTime - outLat(), false);
});
window.addEventListener('keyup', (e) => { if (screen === 'play' && G.running && e.code === 'Space') e.preventDefault(); });
// Tapping a pad in the picture beside the notes plays that pad, for a tablet with no keyboard or a try-out with no drum pad.
$('#padView').addEventListener('pointerdown', (e) => {
  const g = e.target.closest ? e.target.closest('.spot') : null;
  if (!g || screen !== 'play' || !G.running) return;
  const s = SPOTS.find(x => 'pv-' + x.key === g.id);
  if (!s) return;
  e.preventDefault();
  handleHit([s.pad], Ear.ctx.currentTime - outLat(), false);
});
// A tablet pauses the sound engine when the app goes to the background or a call comes in: wake it on return.
document.addEventListener('visibilitychange', () => { if (!document.hidden && Ear.ctx && Ear.ctx.state !== 'running' && Ear.ctx.state !== 'closed') Ear.ctx.resume().catch(() => {}); });
// Ask the browser not to clear stars and pad sounds when the device runs short of space.
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
// Keeps a copy of the app on the device, so it still opens when the internet is down.
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

if (location.protocol === 'file:') $('#fileNote').classList.remove('hidden');
else if (!window.isSecureContext) $('#httpNote').classList.remove('hidden');
document.body.classList.toggle('touch', TOUCH);
buildPadMap('#padMap', 'pm-', true);
buildPadMap('#padView', 'pv-', false);
buildPadMap('#padKit', 'pk-', false);
buildCombos();
buildKit();
buildLab();
buildHow();
buildRead();
buildQuiz();
syncSettingsUi();
calUi();
updateStatus();
buildMe();
fillMascots();
Bros.init();
Tour.init();
$('#brandName').onclick = () => show(prof().name ? 'hub' : 'me');
$('#navHub').onclick = () => show('hub');
$('#hubSongs').onclick = () => show('songs');
$('#hubMe').onclick = () => show('me');
Online.ses = store.get('session', null);
{ // straight after a login the first screen is "This is me today", so the player can dress the drummer
  let justIn = false;
  try { justIn = sessionStorage.getItem('dd.justIn') === '1'; sessionStorage.removeItem('dd.justIn'); } catch (e) {}
  show(Online.blocked() ? 'account' : justIn ? 'me' : Online.home());
}
Online.init();   // the very first visit starts with "Who is drumming?"

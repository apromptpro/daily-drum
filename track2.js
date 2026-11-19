'use strict';
// Tracking and testing: run history, practice time, tempo goals, weak spots, level tests, stage exams,
// the certificate and the Progress page. Loaded after game.js and before app.js; everything here runs later.

// ---------- What is remembered ----------
// dc.history: lessonId -> the last 20 runs [{ d: day, s: score 0..1, st: stars, bpm, hit, total, med: ms, w: wait mode }]
let historyData = null;
function hist() { if (!historyData) historyData = store.get('history', {}); return historyData; }
function recordRun(id, run) {
  const h = hist();
  (h[id] = h[id] || []).push(Object.assign({ d: dayStr(new Date()) }, run));
  if (h[id].length > 20) h[id].shift();
  store.set('history', h);
  const p = prof();
  (p.runs = p.runs || []).push([Math.round(run.s * 100), Math.round(Math.abs(run.med || 0)), run.w ? 1 : 0]);
  if (p.runs.length > 40) p.runs.shift();
}
function addPractice(seconds, perPad) {
  const p = prof(), day = dayStr(new Date());
  p.days = p.days || {};
  p.days[day] = (p.days[day] || 0) + Math.max(0, Math.min(3600, seconds));
  const keys = Object.keys(p.days);
  if (keys.length > 90) delete p.days[keys[0]];
  if (perPad) {
    p.pads = p.pads || {};
    Object.keys(perPad).forEach(k => { const a = p.pads[k] = p.pads[k] || [0, 0]; a[0] += perPad[k].hit; a[1] += perPad[k].miss; });
  }
  saveProf();
}

// ---------- Tempo goals: every lesson has a faster tempo to grow into ----------
// The goal is the speed real songs are played at, not just a little above the slow start: by how many notes fit in a beat.
const SONG_SPEED = { 1: 100, 2: 100, 3: 90, 4: 80, 6: 60 };
const goalBpm = (l) => Math.min(180, Math.max(Math.round(l.bpm * 1.25 / 5) * 5, SONG_SPEED[l.div] || 0));
const mastered = (l) => !!(progress[l.id] && progress[l.id].bpm >= goalBpm(l));

// ---------- Practice medals: playing a lesson again and again, even after it is finished ----------
const REP_TIERS = [[3, 'Bronze', '🟤'], [7, 'Silver', '⚪'], [15, 'Gold', '🟡'], [30, 'Diamond', '💎']];
function repTier(n) { let t = null; REP_TIERS.forEach(x => { if ((n || 0) >= x[0]) t = x; }); return t; }

// ---------- Backup: progress lives in this browser only, so it can be saved to a file and put back ----------
function saveBackup() {
  const data = { app: 'drum-coach', saved: new Date().toISOString() };
  ['progress', 'profile', 'history', 'settings'].forEach(k => { data[k] = store.get(k, null); });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  a.download = 'drum-coach-progress-' + dayStr(new Date()) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  $('#pgMsg').textContent = 'Saved to your Downloads folder as ' + a.download + '.';
}
function loadBackup(file) {
  const rd = new FileReader();
  rd.onload = () => {
    let d = null;
    try { d = JSON.parse(rd.result); } catch (e) {}
    if (!d || d.app !== 'drum-coach' || typeof d.progress !== 'object') { $('#pgMsg').textContent = 'That file is not a backup of this app.'; return; }
    ['progress', 'profile', 'history'].forEach(k => { if (d[k] && typeof d[k] === 'object') store.set(k, d[k]); });
    location.reload();
  };
  rd.readAsText(file);
}

// ---------- Weak spots: what to practise next ----------
function weakSpots() {
  const out = [], lessons = LESSONS.filter(l => !l.song);
  const stars = (l) => (progress[l.id] ? progress[l.id].stars : 0);
  lessons.filter(l => progress[l.id] && progress[l.id].tries && stars(l) < 3)
    .sort((a, b) => progress[a.id].best - progress[b.id].best).slice(0, 3)
    .forEach(l => out.push({ l, why: 'Your best score here is ' + Math.round(progress[l.id].best * 100) + '%.' }));
  // The pad that is missed most often, once there is enough to go on.
  const pads = prof().pads || {};
  let worst = null, rate = 0.15;
  Object.keys(pads).forEach(k => { const a = pads[k], n = a[0] + a[1]; if (n >= 30 && a[1] / n > rate) { rate = a[1] / n; worst = k; } });
  if (worst) {
    const l = lessons.find(x => stars(x) < 3 && !out.some(o => o.l === x) && x.bars.some(b => b[worst]));
    if (l) { if (out.length === 3) out.pop(); out.push({ l, why: 'It uses the ' + PAD[worst].name + ', the pad you miss most (' + Math.round(rate * 100) + '% missed).' }); }
  }
  // Not much played yet: carry on where the course is.
  lessons.filter(l => stars(l) < 2 && !out.some(o => o.l === l)).slice(0, 3 - out.length).forEach(l => out.push({ l, why: 'Next in the course.' }));
  return out;
}

// ---------- Level tests and stage exams ----------
// A test is a handful of lessons played back to back at their own tempo: no Wait mode, no slowing down, no demo.
const TEST_PASS = 0.8, MERIT = 0.88, DISTINCTION = 0.95;
const EXAMS = {
  Beginner: ['r2', 'l9', 'l17', 'l12', 'l28'],
  Intermediate: ['r6', 'l22', 'l43', 'l36', 'l33', 'l48'],
  Advanced: ['r8', 'f2', 'o5', 'a5', 'a3', 'p4']
};
function levelParts(k) {
  const ids = COURSE[k].ids, n = ids.length, m = Math.min(4, n), out = [];
  for (let i = 0; i < m; i++) { const id = ids[Math.round((i + 1) * n / m) - 1]; if (out.indexOf(id) < 0) out.push(id); }
  return out;
}
const testInfo = (kind, key) => kind === 'level'
  ? { id: 'T' + key, title: COURSE[key].name.split(':')[0] + ' test', parts: levelParts(key), kind, key }
  : { id: 'X' + key, title: key + ' exam', parts: EXAMS[key], kind, key };
const gradeWord = (s) => s >= DISTINCTION ? 'Distinction' : s >= MERIT ? 'Merit' : s >= TEST_PASS ? 'Pass' : '';
function testRow(kind, key) {
  const t = testInfo(kind, key), pr = progress[t.id];
  const b = document.createElement('button');
  b.className = 'lesson test' + (kind === 'exam' ? ' exam' : '') + (pr && pr.pass ? ' passed' : '');
  b.innerHTML = '<span class="n"></span><span class="t"><b></b><span class="muted small"></span></span><span class="s"></span>';
  b.querySelector('.n').textContent = pr && pr.pass ? '🏅' : kind === 'exam' ? '🎓' : '📝';
  b.querySelector('b').textContent = t.title;
  b.querySelector('.t span').textContent = t.parts.length + ' pieces in a row at full tempo. No Wait mode, no slowing down. Pass mark ' + Math.round(TEST_PASS * 100) + '%.';
  b.querySelector('.s').textContent = pr ? (pr.pass ? gradeWord(pr.best) + ' ' : 'Best ') + Math.round(pr.best * 100) + '%' : 'Not tried yet';
  b.onclick = () => startTest(kind, key);
  return b;
}
function startTest(kind, key) {
  G.test = Object.assign(testInfo(kind, key), { i: 0, results: [] });
  openTestPart('');
}
function lockForTest(on) {
  ['#tempo', '#waitMode', '#loopMode', '#climbMode'].forEach(s => { $(s).disabled = on; });
  if (on) { $('#waitMode').checked = false; $('#loopMode').checked = false; $('#climbMode').checked = false; }
  $('#demoBtn').classList.toggle('hidden', on);
  $('#tempoTry').classList.toggle('locked', on);
  $('#backBtn').textContent = on ? 'Quit test' : backLabel();
  $('#testBar').classList.toggle('hidden', !on);
}
function openTestPart(note) {
  const t = G.test, l = LESSONS.find(x => x.id === t.parts[t.i]);
  const reps = Math.max(1, Math.min(l.reps0 || l.reps, Math.floor(8 / l.bars.length)));   // about eight bars per piece
  G.idx = LESSONS.indexOf(l); G.track = null;
  G.title = t.title + ', piece ' + (t.i + 1) + ' of ' + t.parts.length + ': ' + l.title;
  setLesson(Object.assign({}, l, { reps }));
  show('play');
  lockForTest(true);
  $('#testBar').textContent = '🏅 ' + (note ? note + ' ' : '') + 'Piece ' + (t.i + 1) + ' of ' + t.parts.length + '. Press Start when you are ready. Stopping or leaving ends the test.';
}
function endTest(msg) {
  G.test = null;
  lockForTest(false);
  if (msg) { $('#playNote').textContent = msg; $('#playNote').classList.remove('hidden'); }
}
// A piece of the test has ended (or the run was stopped). Called in place of the normal recap.
function testPartDone(st, finished, notes) {
  const t = G.test, total = st ? st.hit + st.miss : 0;
  if (!finished || !st || total < 0.9 * notes) {
    endTest('Test stopped. Nothing was saved. You can take it again at any time.');
    if (screen === 'play') { resetTitleAfterTest(); draw(); }
    return;
  }
  const score = Math.max(0, (st.perfect + 0.8 * st.good + 0.5 * st.ok - 0.25 * st.extra) / total);
  t.results.push({ id: t.parts[t.i], score, hit: st.hit, total });
  t.i++;
  if (t.i < t.parts.length) openTestPart('Piece ' + t.i + ' done: ' + Math.round(score * 100) + '%.');
  else finishTest();
}
function resetTitleAfterTest() {
  const l = LESSONS[G.idx];
  G.title = (LESSONS.filter(x => !x.song).indexOf(l) + 1) + '. ' + l.title;
  setLesson(l);
}
function finishTest() {
  const t = G.test, p = prof();
  const avg = t.results.reduce((a, r) => a + r.score, 0) / t.results.length;
  const pass = avg >= TEST_PASS, before = progress[t.id];
  const hits = t.results.reduce((a, r) => a + r.hit, 0);
  touchDay();
  p.hits += hits;
  const xp = hits + (pass && !(before && before.pass) ? (t.kind === 'exam' ? 300 : 100) : 0);
  p.xp += xp;
  if (!before || avg > before.best) progress[t.id] = { best: avg, stars: 0, pass, date: new Date().toLocaleDateString(), parts: t.results.map(r => [r.id, Math.round(r.score * 100)]) };
  store.set('progress', progress);
  saveProf();
  endTest('');
  // The result page
  $('#tdCheer').textContent = pass ? (t.kind === 'exam' ? '🎓 ' : '🏅 ') + t.title + ' passed' + (gradeWord(avg) !== 'Pass' ? ' with ' + gradeWord(avg) : '') + '!' : '💪 Not passed yet';
  $('#tdScore').textContent = Math.round(avg * 100) + '%';
  $('#tdNote').textContent = (pass ? '' : 'The pass mark is ' + Math.round(TEST_PASS * 100) + '%. Practise the pieces marked below, then try again. ') + '+' + xp + ' rank points';
  const box = $('#tdParts');
  box.innerHTML = '';
  t.results.forEach(r => {
    const l = LESSONS.find(x => x.id === r.id), row = document.createElement('div');
    row.className = 'padRow wide';
    row.innerHTML = '<span></span><div class="bar"><i style="width:' + Math.round(r.score * 100) + '%"></i></div><span class="small"></span>';
    row.firstChild.textContent = l.title;
    row.lastChild.textContent = Math.round(r.score * 100) + '%';
    if (r.score < TEST_PASS) {
      row.classList.add('low');
      const b = document.createElement('button');
      b.textContent = 'Practise';
      b.onclick = () => openLesson(LESSONS.indexOf(l));
      row.lastChild.appendChild(b);
    }
    box.appendChild(row);
  });
  $('#tdAgain').onclick = () => startTest(t.kind, t.key);
  $('#tdCert').classList.toggle('hidden', !(pass && t.kind === 'exam'));
  $('#tdCert').onclick = () => showCert(t.key);
  show('testDone');
  if (pass) { fanfare(3); confetti(3200); }
}
function showCert(stage) {
  const pr = progress['X' + stage], p = prof();
  if (!pr || !pr.pass) return;
  $('#certName').value = p.name || '';
  $('#certName').oninput = () => { p.name = $('#certName').value; saveProf(); renderHeader(); };
  $('#certFace').innerHTML = faceHtml(p, true);
  $('#certStage').textContent = stage + ' stage';
  $('#certGrade').textContent = 'passed with ' + (gradeWord(pr.best) === 'Pass' ? 'a Pass' : gradeWord(pr.best)) + ', ' + Math.round(pr.best * 100) + '%';
  $('#certDate').textContent = pr.date || '';
  $('#certParts').textContent = (pr.parts || []).map(x => LESSONS.find(l => l.id === x[0]).title + ' ' + x[1] + '%').join('  ·  ');
  show('cert');
}

// ---------- The Progress page ----------
function spark(runs) {
  if (!runs || !runs.length) return '';
  const pts = runs.slice(-10), w = 90, h = 24, n = pts.length;
  const X = (i) => n === 1 ? w / 2 : 4 + i * (w - 8) / (n - 1), Y = (s) => h - 3 - s * (h - 6);
  return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '"><line x1="0" x2="' + w + '" y1="' + Y(TEST_PASS) + '" y2="' + Y(TEST_PASS) + '"/>' +
    '<polyline points="' + pts.map((r, i) => X(i).toFixed(1) + ',' + Y(r.s).toFixed(1)).join(' ') + '"/>' +
    '<circle cx="' + X(n - 1) + '" cy="' + Y(pts[n - 1].s) + '" r="3"/></svg>';
}
function renderProgress() {
  const p = prof(), h = hist();
  const lessons = LESSONS.filter(l => !l.song);
  const st = (l) => (progress[l.id] ? progress[l.id].stars : 0);
  const mins = (d) => Math.round(((p.days || {})[d] || 0) / 60);
  // headline numbers
  const today = dayStr(new Date());
  let week = 0;
  const days = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push({ d, m: mins(dayStr(d)) }); if (i < 7) week += mins(dayStr(d)); }
  const runs = (p.runs || []).filter(r => !r[2]);
  const avgT = (a) => a.length ? Math.round(a.reduce((x, r) => x + r[1], 0) / a.length) : null;
  const tNow = avgT(runs.slice(-10)), tWas = avgT(runs.slice(-20, -10));
  const cards = [
    [mins(today) + ' min', 'practised today'],
    [week + ' min', 'in the last 7 days'],
    [lessons.filter(l => st(l) > 0).length + ' / ' + lessons.length, 'lessons with a star'],
    ['⭐ ' + LESSONS.reduce((a, l) => a + st(l), 0) + ' / ' + LESSONS.length * 3, 'stars, lessons and songs together'],
    [lessons.filter(mastered).length + ' 👑', 'lessons at goal tempo'],
    [tNow === null ? '-' : tNow + ' ms', 'off the beat on average, last 10 runs' + (tWas !== null ? ' (was ' + tWas + ' ms)' : '')]
  ];
  $('#pgCards').innerHTML = cards.map(c => '<div class="card"><div class="num">' + c[0] + '</div><div class="muted small">' + c[1] + '</div></div>').join('');
  // the player's own records: one child, one device, so the only one to beat is yourself
  const bestDay = Math.round(Math.max.apply(null, Object.keys(p.days || {}).map(d => p.days[d]).concat(0)) / 60);
  const rk = rankOf(p.xp);
  const recs = [
    ['🔗 ' + (p.bestCombo || 0), 'longest run of right hits'],
    ['🔥 ' + Math.max(p.maxStreak || 0, liveStreak()), 'most days in a row'],
    ['⏱ ' + bestDay + ' min', 'longest practice day'],
    ['🥁 ' + (p.hits || 0), 'notes hit so far'],
    ['🎖 ' + Object.keys(p.badges || {}).length + ' / ' + BADGES.length, 'badges'],
    [rk.icon + ' ' + p.xp, 'rank points: ' + rk.name]
  ];
  $('#pgRecords').innerHTML = recs.map(c => '<div class="card"><div class="num">' + c[0] + '</div><div class="muted small">' + c[1] + '</div></div>').join('');
  // minutes per day, last two weeks
  const top = Math.max(10, Math.max.apply(null, days.map(x => x.m)));
  $('#pgDays').innerHTML = days.map(x => '<div class="dayCol" title="' + x.d.toLocaleDateString() + ': ' + x.m + ' min"><i style="height:' + Math.round(100 * x.m / top) + '%"></i><span>' + 'SMTWTFS'[x.d.getDay()] + '</span></div>').join('');
  // weak spots
  const wk = $('#pgWeak');
  wk.innerHTML = '';
  weakSpots().forEach(o => {
    const b = document.createElement('button');
    b.className = 'lesson';
    b.innerHTML = '<span class="n">🎯</span><span class="t"><b></b><span class="muted small"></span></span>';
    b.querySelector('b').textContent = o.l.title;
    b.querySelector('.t span').textContent = o.why;
    b.onclick = () => openLesson(LESSONS.indexOf(o.l));
    wk.appendChild(b);
  });
  // tests and exams
  const tb = $('#pgTests');
  tb.innerHTML = '';
  COURSE.forEach((lv, k) => {
    tb.appendChild(testRow('level', k));
    if (k === COURSE.length - 1 || COURSE[k + 1].stage !== lv.stage) tb.appendChild(testRow('exam', lv.stage));
  });
  // every lesson
  const box = $('#pgLessons');
  box.innerHTML = '';
  COURSE.forEach((lv, k) => {
    const d = document.createElement('details');
    d.className = 'level';
    const mine = lessons.filter(l => l.lv === k);
    d.open = mine.some(l => progress[l.id] && progress[l.id].tries);
    d.innerHTML = '<summary><b></b><span class="muted small"></span><span class="cnt small"></span></summary>' +
      '<div class="tableWrap"><table class="pgTable"><thead><tr><th>Lesson</th><th>Stars</th><th>Best</th><th>Tries</th><th>Clean runs</th><th>Top tempo</th><th>Goal</th><th>Last 10 runs</th></tr></thead><tbody></tbody></table></div>';
    d.querySelector('b').textContent = lv.name;
    d.querySelector('.cnt').textContent = mine.reduce((a, l) => a + st(l), 0) + ' / ' + mine.length * 3 + ' stars';
    mine.forEach(l => {
      const pr = progress[l.id] || {}, tr = document.createElement('tr');
      tr.innerHTML = '<td></td><td class="s">' + starsHtml(pr.stars || 0) + '</td><td>' + (pr.tries ? Math.round((pr.best || 0) * 100) + '%' : '-') + '</td><td>' + (pr.tries || 0) + '</td><td>' + (repTier(pr.reps) ? repTier(pr.reps)[2] + ' ' : '') + (pr.reps || 0) + '</td><td>' +
        (pr.bpm ? pr.bpm + ' BPM' : '-') + '</td><td>' + goalBpm(l) + (mastered(l) ? ' 👑' : '') + '</td><td>' + spark(h[l.id]) + '</td>';
      tr.firstChild.textContent = (LESSONS.indexOf(l) + 1) + '. ' + l.title;
      tr.onclick = () => openLesson(LESSONS.indexOf(l));
      d.querySelector('tbody').appendChild(tr);
    });
    box.appendChild(d);
  });
}

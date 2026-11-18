'use strict';
// The game layer and the "Start here" page: ranks, badges, the pad picture beside the notes, sheet music,
// the clickable drum kit, the rhythm lab and the celebration. Loaded before app.js; everything here runs later.

// ---------- Player profile: experience points, rank, badges, days in a row ----------
const RANKS = [[0, 'Beginner Tapper', '🥁'], [150, 'Beat Keeper', '🎵'], [500, 'Groove Rider', '🎶'], [1200, 'Fill Master', '⚡'],
  [2500, 'Rhythm Pro', '🔥'], [5000, 'Drum Hero', '🌟'], [9000, 'Drum Legend', '👑']];
const BADGES = [
  { id: 'kit', icon: '🧭', name: 'Kit explorer', how: 'Tap every part of the drum kit in "Basics"' },
  { id: 'first', icon: '🎉', name: 'First beat', how: 'Earn a star in any lesson' },
  { id: 'star3', icon: '⭐', name: 'Three stars', how: 'Get three stars in a lesson' },
  { id: 'combo25', icon: '🔗', name: '25 in a row', how: 'Hit 25 notes in a row' },
  { id: 'combo50', icon: '⛓️', name: '50 in a row', how: 'Hit 50 notes in a row' },
  { id: 'combo100', icon: '💯', name: '100 in a row', how: 'Hit 100 notes in a row' },
  { id: 'perfect', icon: '🎯', name: 'Spot on', how: 'Finish a lesson with no missed and no extra hits' },
  { id: 'fast', icon: '🚀', name: 'Speed-up', how: 'Two stars with the tempo 20 BPM above the lesson\'s own' },
  { id: 'stars10', icon: '✨', name: 'Ten shining lessons', how: 'Three stars in 10 lessons' },
  { id: 'song', icon: '🎤', name: 'Band member', how: 'Two stars on a song' },
  { id: 'own', icon: '🎧', name: 'My music', how: 'A star playing along with your own song' },
  { id: 'days3', icon: '📅', name: '3 days running', how: 'Practise three days in a row' },
  { id: 'days7', icon: '🗓️', name: 'A whole week', how: 'Practise seven days in a row' },
  { id: 'days14', icon: '📆', name: 'Two weeks strong', how: 'Practise 14 days in a row' },
  { id: 'days30', icon: '🌙', name: 'A whole month', how: 'Practise 30 days in a row' },
  { id: 'days100', icon: '🏃', name: 'Marathoner', how: 'Practise 100 days in a row' },
  { id: 'hits1000', icon: '🥢', name: '1,000 notes', how: 'Hit 1,000 notes in total' },
  { id: 'rep3', icon: '🔁', name: 'Once more!', how: 'Play the same lesson cleanly 3 times' },
  { id: 'rep10', icon: '♻️', name: 'Ten times round', how: 'Play the same lesson cleanly 10 times' },
  { id: 'rep25', icon: '🏋️', name: 'Practice machine', how: 'Play the same lesson cleanly 25 times' },
  { id: 'gold3', icon: '🏆', name: 'Three golds', how: 'Earn the gold practice medal (15 clean runs) on 3 lessons' },
  { id: 'back5', icon: '🪃', name: 'Keeps coming back', how: 'Replay a finished 3-star lesson on a later day, 5 times' },
  { id: 'tour1', icon: '🎤', name: 'Room rocker', how: 'Play the gig at the first Tour stop' },
  { id: 'galaxy', icon: '🌌', name: 'Galaxy drummer', how: 'Play the gig at the last Tour stop, the Galaxy' },
  { id: 'trophy3', icon: '🏆', name: 'Golden stop', how: 'Win gold in all three challenges at a Tour stop' },
  { id: 'lv1', icon: '🥉', name: 'Beginner graduate', how: 'A star in every Beginner lesson' },
  { id: 'lv2', icon: '🥈', name: 'Intermediate graduate', how: 'A star in every Intermediate lesson' },
  { id: 'lv3', icon: '🥇', name: 'Advanced graduate', how: 'A star in every Advanced lesson' }
];
let profileData = null;
function prof() {
  if (!profileData) {
    const saved = store.get('profile', null);
    profileData = Object.assign({ xp: 0, day: '', streak: 0, badges: {}, hits: 0, bestCombo: 0, kit: {} }, saved || {});
    // Stars earned before ranks existed still count towards the rank.
    if (!saved) profileData.xp = Object.keys(progress).reduce((a, id) => a + 25 * (progress[id].stars || 0), 0);
  }
  return profileData;
}
const saveProf = () => store.set('profile', prof());
function rankOf(xp) {
  let k = 0;
  RANKS.forEach((r, i) => { if (xp >= r[0]) k = i; });
  return { k, name: RANKS[k][1], icon: RANKS[k][2], lo: RANKS[k][0], hi: RANKS[k + 1] ? RANKS[k + 1][0] : null };
}
const dayStr = (d) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
function touchDay() {
  const p = prof(), today = dayStr(new Date());
  if (p.day === today) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  p.streak = p.day === dayStr(y) ? p.streak + 1 : 1;
  p.day = today;
  p.maxStreak = Math.max(p.maxStreak || 0, p.streak);
}
const liveStreak = () => {   // a run of days only counts while it is still alive (practised today or yesterday)
  const p = prof(), y = new Date(); y.setDate(y.getDate() - 1);
  return p.day === dayStr(new Date()) || p.day === dayStr(y) ? p.streak : 0;
};
function giveBadge(id, list) {
  const p = prof();
  if (p.badges[id]) return;
  p.badges[id] = dayStr(new Date());
  if (list) list.push(BADGES.find(b => b.id === id));
}
// Called once after every scored run. Returns what was gained, for the recap screen.
function awardRun(r) {
  const p = prof(), st = r.st, got = [];
  const before = rankOf(p.xp).k;
  touchDay();
  p.hits += st.hit;
  p.bestCombo = Math.max(p.bestCombo, st.bestCombo || 0);
  // Lessons became several times longer; points for hits are scaled back so that the ranks are reached at the same pace as before.
  const longer = r.lesson && r.lesson.reps0 && r.lesson.reps > r.lesson.reps0 && !r.loop ? r.lesson.reps0 / r.lesson.reps : 1;
  const xp = Math.round(st.hit * longer * (r.wasWait ? 0.5 : 1)) + 25 * Math.max(0, r.stars - r.prevStars) + (r.stars === 3 ? 10 : 0);
  p.xp += xp;
  const stars = (id) => (progress[id] ? progress[id].stars : 0);
  if (r.stars >= 1) giveBadge(r.own ? 'own' : 'first', got);
  if (r.stars >= 1 && !r.own) giveBadge('first', got);
  if (r.stars === 3) giveBadge('star3', got);
  [25, 50, 100].forEach(n => { if (p.bestCombo >= n) giveBadge('combo' + n, got); });
  if (!r.wasWait && r.enough && st.miss === 0 && st.extra === 0 && st.hit >= 16) giveBadge('perfect', got);
  if (r.stars >= 2 && !r.own && !r.wasWait && r.bpm >= r.lesson.bpm + 20) giveBadge('fast', got);
  if (r.stars >= 2 && r.lesson.song) giveBadge('song', got);
  if (LESSONS.filter(l => stars(l.id) === 3).length >= 10) giveBadge('stars10', got);
  if (p.streak >= 3) giveBadge('days3', got);
  if (p.streak >= 7) giveBadge('days7', got);
  [14, 30, 100].forEach(n => { if (p.streak >= n) giveBadge('days' + n, got); });
  if (p.hits >= 1000) giveBadge('hits1000', got);
  if (r.revisit) p.revisits = (p.revisits || 0) + 1;
  const reps = Object.keys(progress).map(id => progress[id].reps || 0);
  const most = Math.max.apply(null, reps.concat(0));
  if (most >= 3) giveBadge('rep3', got);
  if (most >= 10) giveBadge('rep10', got);
  if (most >= 25) giveBadge('rep25', got);
  if (reps.filter(n => n >= 15).length >= 3) giveBadge('gold3', got);
  if ((p.revisits || 0) >= 5) giveBadge('back5', got);
  ['Beginner', 'Intermediate', 'Advanced'].forEach((sg, i) => {
    if (COURSE.filter(lv => lv.stage === sg).every(lv => lv.ids.every(id => stars(id) > 0))) giveBadge('lv' + (i + 1), got);
  });
  saveProf();
  const now = rankOf(p.xp);
  return { xp, badges: got, rankUp: now.k > before ? now : null, rank: now };
}
function renderProfile() {
  const p = prof(), rk = rankOf(p.xp);
  $('#rankIcon').textContent = rk.icon;
  $('#rankName').textContent = rk.name;
  $('#homeFace').innerHTML = faceHtml(p, false);
  $('#hello').textContent = p.name ? 'Hi, ' + p.name + '!' : 'Hi, drummer!';
  $('#xpFill').style.width = (rk.hi ? Math.round(100 * (p.xp - rk.lo) / (rk.hi - rk.lo)) : 100) + '%';
  $('#xpTxt').textContent = (rk.hi ? p.xp + ' rank points. ' + (rk.hi - p.xp) + ' more to become ' + RANKS[rk.k + 1][1] : p.xp + ' rank points. Top rank!');
  const total = LESSONS.reduce((a, l) => a + (progress[l.id] ? progress[l.id].stars : 0), 0);
  const ds = liveStreak();
  $('#dayStreak').textContent = '🔥 ' + ds + (ds === 1 ? ' day' : ' days');
  $('#starTotal').textContent = '⭐ ' + total + ' / ' + LESSONS.length * 3;
  $('#comboBest').textContent = '🔗 best run ' + p.bestCombo;
  const box = $('#badges');
  box.innerHTML = '';
  BADGES.forEach(b => {
    const s = document.createElement('span');
    s.className = 'badge' + (p.badges[b.id] ? ' got' : '');
    s.textContent = p.badges[b.id] ? b.icon : '';   // a badge not earned yet shows as a locked "?" (drawn in the style sheet)
    s.title = b.name + ': ' + b.how + (p.badges[b.id] ? ' (earned)' : '');
    box.appendChild(s);
  });
  // "Continue" goes to the first lesson that does not have two stars yet.
  const idx = LESSONS.findIndex(l => !l.song && !(progress[l.id] && progress[l.id].stars >= 2));
  const btn = $('#continueBtn');
  btn.classList.toggle('hidden', idx < 0);
  if (idx >= 0) {
    const started = LESSONS.some(l => progress[l.id]);
    btn.textContent = '▶ ' + (started ? 'Continue' : 'Start') + ': ' + (idx + 1) + '. ' + LESSONS[idx].title;
    btn.onclick = () => openLesson(idx);
  }
}

// ---------- The player: a name and a face (a cartoon drummer built from parts) ----------
// Photos are no longer used: a photo was only ever visible on its own device, while friends saw the drummer.
// Any photo an older version kept on this device is deleted here, once.
try {
  Object.keys(localStorage).filter(k => /^dc\.([^.]+\.)?profile$/.test(k)).forEach(k => {
    const v = JSON.parse(localStorage.getItem(k) || 'null');
    if (v && v.photo) { delete v.photo; localStorage.setItem(k, JSON.stringify(v)); }
  });
} catch (e) {}
const AV = {
  skin: ['#ffe0c2', '#f2c79a', '#d9a273', '#b97a4e', '#8a5633', '#5e3a22'],
  hair: ['short', 'spiky', 'curly', 'side', 'buzz', 'quiff', 'flattop', 'messy', 'undercut', 'afro', 'bob', 'ponytail', 'pigtails', 'braids', 'bun', 'buns', 'flow', 'mohawk', 'long'],
  hairCol: ['#22242e', '#4a2f1d', '#8a5a2b', '#d9a441', '#c2452d', '#9aa0aa', '#3f7fe0', '#1c9d58', '#f06aa8'],
  head: ['none', 'headphones', 'bandana', 'beanie', 'cap', 'capback', 'bucket', 'viking', 'bow', 'flower', 'headband', 'catears', 'crown'],
  eyes: ['dots', 'lashes', 'sparkle', 'happy'],
  face: ['none', 'freckles', 'rosy', 'plaster', 'warpaint', 'starpaint', 'heartpaint', 'boltpaint'],
  ear: ['none', 'studs', 'hoops', 'stars'],
  neck: ['none', 'bowtie', 'tie', 'chain', 'medal', 'necklace', 'scarf'],
  pattern: ['none', 'stripes', 'checks', 'flames', 'camo', 'dots', 'hearts', 'tiedye'],
  glasses: ['none', 'round', 'shades', 'goggles', 'pixel', 'star', 'heart'],
  shirt: ['#25304f', '#e0453c', '#3f7fe0', '#f2a100', '#1c9d58', '#8a5cf0', '#f06aa8', '#22b8c4', '#f4f4f4'],
  logo: ['none', 'star', 'bolt', 'flame', 'note', 'rocket', 'dino', 'ball', 'heart', 'rainbow', 'skull'],
  sticks: ['#d9a55b', '#e0453c', '#3f7fe0', '#7ad14a', '#f2c230', '#b05cf0', '#25304f']
};
const AV_LABEL = { skin: 'Skin', eyes: 'Eyes', face: 'Cheeks', glasses: 'Glasses', hair: 'Hair', hairCol: 'Hair colour', head: 'On my head', ear: 'Earrings', shirt: 'Band shirt', pattern: 'Shirt pattern', logo: 'Shirt badge', neck: 'Round my neck', sticks: 'Drumsticks' };
// The styles are sorted into four tabs, so each tab has room for big buttons.
const AV_TABS = [['face', '🙂', 'Face', ['skin', 'eyes', 'face', 'glasses']], ['hair', '💇', 'Hair', ['hair', 'hairCol']], ['hats', '🧢', 'Hats', ['head', 'ear']], ['clothes', '👕', 'Clothes', ['shirt', 'pattern', 'logo', 'neck']], ['extras', '🥁', 'Extras', ['sticks', 'scene']]];
const AV_TAB_OF = {};
AV_TABS.forEach(t => t[3].forEach(k => { AV_TAB_OF[k] = t[0]; }));
const AV_WORD = {
  short: 'Short', spiky: 'Spiky', curly: 'Curly', side: 'Side', buzz: 'Very short', mohawk: 'Mohawk', long: 'Rocker',
  none: 'None', headphones: 'Headphones', bandana: 'Bandana', beanie: 'Beanie', cap: 'Cap', capback: 'Cap backwards',
  round: 'Round', shades: 'Shades', star: 'Star shades', bolt: 'Lightning', flame: 'Flame', note: 'Music note', skull: 'Smiley skull',
  bob: 'Bob', ponytail: 'Ponytail', pigtails: 'Pigtails', braids: 'Braids', bun: 'Bun', buns: 'Two buns', flow: 'Long', afro: 'Afro',
  bow: 'Bow', flower: 'Flower', headband: 'Headband', catears: 'Cat ears', crown: 'Crown',
  dots: 'Round', lashes: 'Lashes', sparkle: 'Sparkle', happy: 'Smiling',
  freckles: 'Freckles', rosy: 'Rosy', starpaint: 'Star', heartpaint: 'Heart', boltpaint: 'Lightning',
  studs: 'Studs', hoops: 'Hoops', stars: 'Stars', bowtie: 'Bow tie', necklace: 'Necklace', scarf: 'Scarf', tie: 'Tie',
  stripes: 'Stripes', hearts: 'Hearts', tiedye: 'Tie-dye', heart: 'Heart', rainbow: 'Rainbow',
  'glasses.heart': 'Heart shades', 'pattern.dots': 'Dots', 'logo.star': 'Star', 'ear.stars': 'Stars',
  quiff: 'Quiff', flattop: 'Flat top', messy: 'Messy', undercut: 'Undercut', bucket: 'Bucket hat', viking: 'Viking',
  plaster: 'Plaster', warpaint: 'War paint', chain: 'Chain', medal: 'Medal', checks: 'Checks', flames: 'Flames', camo: 'Camo',
  goggles: 'Goggles', pixel: 'Pixel shades', rocket: 'Rocket', dino: 'Dino', ball: 'Football'
};
function avOf(p) {
  const a = Object.assign({ skin: 2, hair: 'short', hairCol: 0, head: 'none', glasses: 'none', shirt: 0, logo: 'star', sticks: 0, scene: 0, eyes: 'dots', face: 'none', ear: 'none', neck: 'none', pattern: 'none' }, p.av || {});
  if (a.hair === 'cap') { a.hair = 'short'; a.head = 'cap'; }                       // choices saved by the first version
  if (typeof a.glasses === 'number') a.glasses = a.glasses ? 'round' : 'none';
  return a;
}
// One drawing holds every mood; the style sheet shows the right mouth and stick position for data-mood:
// happy (smile), wow (open mouth), oops (small round mouth), cheer (open mouth, sticks in the air, stars).
function avatarSvg(a, cheer) {
  const skin = a.skinHex || AV.skin[a.skin] || AV.skin[2], hc = a.hairHex || AV.hairCol[a.hairCol] || AV.hairCol[0], shirt = a.shirtHex || AV.shirt[a.shirt] || AV.shirt[0];
  const stick = AV.sticks[a.sticks] || AV.sticks[0], ink = '#25304f';
  const onShirt = a.shirt === 8 || a.shirt === 3 ? ink : '#fff';
  const hair = {
    short: '<path d="M27 45 Q26 19 50 19 Q74 19 73 45 Q67 30 50 30 Q33 30 27 45Z"/>',
    buzz: '<path opacity=".55" d="M28 43 Q27 21 50 21 Q73 21 72 43 Q66 31 50 31 Q34 31 28 43Z"/>',
    spiky: '<path d="M27 45 L29 24 L36 32 L40 16 L47 29 L53 14 L59 29 L66 18 L68 33 L75 26 L73 45 Q63 31 50 31 Q37 31 27 45Z"/>',
    curly: '<circle cx="31" cy="33" r="8"/><circle cx="40" cy="25" r="8"/><circle cx="50" cy="22" r="8"/><circle cx="60" cy="25" r="8"/><circle cx="69" cy="33" r="8"/><circle cx="28" cy="42" r="6"/><circle cx="72" cy="42" r="6"/>',
    side: '<path d="M27 47 Q25 19 52 18 Q75 19 73 45 Q71 34 61 29 Q46 37 32 32 Q29 38 27 47Z"/>',
    mohawk: '<path opacity=".45" d="M28 43 Q27 21 50 21 Q73 21 72 43 Q66 31 50 31 Q34 31 28 43Z"/><path d="M43 33 L41 12 L46 18 L50 5 L54 18 L59 12 L57 33 Q50 29 43 33Z"/>',
    long: '<path d="M27 46 Q25 18 50 18 Q75 18 73 46 Q68 31 50 30 Q32 31 27 46Z"/>',
    bob: '<path d="M27 45 Q26 19 50 19 Q74 19 73 45 Q72 33 50 32 Q28 33 27 45Z"/>',
    quiff: '<path d="M27 45 Q24 25 39 17 Q52 7 68 12 Q79 17 73 45 Q70 33 62 30 Q48 25 36 32 Q30 37 27 45Z"/>',
    flattop: '<path d="M27 45 L27 21 Q27 16 32 16 H68 Q73 16 73 21 L73 45 Q68 31 50 31 Q32 31 27 45Z"/>',
    messy: '<path d="M27 45 Q25 19 50 18 Q75 19 73 45 L69 35 L64 42 L59 33 L53 41 L47 32 L41 40 L36 33 L31 41Z"/>',
    undercut: '<path opacity=".4" d="M28 43 Q27 21 50 21 Q73 21 72 43 Q66 31 50 31 Q34 31 28 43Z"/><path d="M32 32 Q32 14 54 13 Q73 14 71 31 Q60 23 46 28 Q38 30 32 32Z"/>',
    ponytail: '<path d="M27 47 Q25 19 52 18 Q75 19 73 45 Q71 34 61 29 Q46 37 32 32 Q29 38 27 47Z"/>',
    pigtails: '<path d="M27 45 Q26 19 50 19 Q74 19 73 45 Q70 31 50 26 Q30 31 27 45Z"/><path d="M50 20 V27" fill="none" stroke="' + ink + '" stroke-width=".8" opacity=".5"/>',
    braids: '<path d="M27 46 Q25 18 50 18 Q75 18 73 46 Q68 31 50 30 Q32 31 27 46Z"/><g stroke="' + ink + '" stroke-width=".8"><circle cx="25" cy="53" r="4.6"/><circle cx="24" cy="61" r="4.4"/><circle cx="24" cy="69" r="4.2"/><circle cx="25" cy="76.5" r="3.8"/><circle cx="75" cy="53" r="4.6"/><circle cx="76" cy="61" r="4.4"/><circle cx="76" cy="69" r="4.2"/><circle cx="75" cy="76.5" r="3.8"/></g><circle cx="25" cy="81.5" r="2.4" fill="' + shirt + '" stroke="' + ink + '" stroke-width=".8"/><circle cx="75" cy="81.5" r="2.4" fill="' + shirt + '" stroke="' + ink + '" stroke-width=".8"/>',
    bun: '<path d="M27 45 Q26 19 50 19 Q74 19 73 45 Q67 30 50 30 Q33 30 27 45Z"/>',
    buns: '<path d="M27 45 Q26 19 50 19 Q74 19 73 45 Q67 30 50 30 Q33 30 27 45Z"/>',
    flow: '<path d="M27 47 Q25 19 52 18 Q75 19 73 45 Q71 34 61 29 Q46 37 32 32 Q29 38 27 47Z"/>',
    afro: '<circle cx="31" cy="33" r="8"/><circle cx="40" cy="25" r="8"/><circle cx="50" cy="22" r="8"/><circle cx="60" cy="25" r="8"/><circle cx="69" cy="33" r="8"/>',
    // mascots only: thick hair swept up and across, and a short neat cut with a side parting
    sweep: '<path d="M26 47 Q22 25 42 16 Q58 7 73 14 Q71 18 77 21 Q78 34 74 47 Q72 37 65 31 Q50 26 34 35 Q29 40 26 47Z"/><path d="M40 20 Q56 12 70 18" fill="none" stroke="#3a3a44" stroke-width="1.6" stroke-linecap="round"/>',
    neat: '<path d="M27 45 Q24 21 48 18 Q74 17 74 45 Q71 33 61 30 Q50 26 39 31 Q31 35 27 45Z"/><path d="M41 30 Q44 23 52 21" fill="none" stroke="#3a3a44" stroke-width="1.4" stroke-linecap="round"/>'
  }[a.hair] || '';
  const tieDot = (x, y) => '<circle cx="' + x + '" cy="' + y + '" r="3" fill="' + shirt + '" stroke="' + ink + '" stroke-width="1"/>';
  const hairBack = '<g fill="' + hc + '">' + ({
    long: '<path d="M26 42 Q24 20 50 20 Q76 20 74 42 L79 76 Q71 82 65 74 L66 50 L34 50 L35 74 Q29 82 21 76Z"/>',
    bob: '<path d="M25 44 Q23 17 50 17 Q77 17 75 44 L77 61 Q72 68 66 63 L66 48 L34 48 L34 63 Q28 68 23 61Z"/>',
    ponytail: '<path d="M68 27 Q86 20 90 38 Q92 56 83 68 Q82 54 77 47 Q74 37 66 33Z"/>' + tieDot(74, 28),
    pigtails: '<path d="M28 38 Q9 40 11 60 Q13 72 22 69 Q29 60 29 48Z"/><path d="M72 38 Q91 40 89 60 Q87 72 78 69 Q71 60 71 48Z"/>' + tieDot(24, 40) + tieDot(76, 40),
    bun: '<circle cx="50" cy="14" r="10"/>' + '<path d="M42 21 Q50 25 58 21" fill="none" stroke="' + shirt + '" stroke-width="2.4" stroke-linecap="round"/>',
    buns: '<circle cx="31" cy="19" r="9"/><circle cx="69" cy="19" r="9"/>',
    flow: '<path d="M25 44 Q22 16 50 16 Q78 16 75 44 Q81 58 79 75 Q73 85 64 79 L66 50 L34 50 L36 79 Q27 85 21 75 Q19 58 25 44Z"/>',
    afro: '<circle cx="50" cy="38" r="31"/>'
  }[a.hair] || '') + '</g>';
  const dome = '<path fill="' + shirt + '" stroke="' + ink + '" stroke-width="1.5" d="M27 39 Q27 16 50 16 Q73 16 73 39Z"/>';
  const head = {
    cap: dome + '<path fill="' + shirt + '" stroke="' + ink + '" stroke-width="1.5" d="M26 38 H82 Q88 44 80 44 H26Z"/>',
    capback: dome + '<path d="M41 39 Q50 30 59 39" fill="none" stroke="' + ink + '" stroke-width="1.5"/><path fill="' + shirt + '" stroke="' + ink + '" stroke-width="1.5" d="M27 37 H16 Q12 41 18 43 H27Z"/>',
    beanie: '<circle cx="50" cy="12" r="5.5" fill="#fff" stroke="' + ink + '" stroke-width="1.5"/><path fill="' + shirt + '" stroke="' + ink + '" stroke-width="1.5" d="M26 40 Q26 14 50 14 Q74 14 74 40Z"/><rect x="24" y="34" width="52" height="9" rx="4.5" fill="#fff" stroke="' + ink + '" stroke-width="1.5"/>',
    bandana: '<path fill="#e0453c" stroke="' + ink + '" stroke-width="1.5" d="M27 35 Q50 24 73 35 L73 42 Q50 31 27 42Z"/><path fill="#e0453c" stroke="' + ink + '" stroke-width="1.5" d="M73 37 L84 33 L80 40 L85 46 L73 42Z"/><circle cx="40" cy="33" r="1.3" fill="#fff"/><circle cx="50" cy="31" r="1.3" fill="#fff"/><circle cx="60" cy="33" r="1.3" fill="#fff"/>',
    bucket: '<path fill="' + shirt + '" stroke="' + ink + '" stroke-width="1.5" stroke-linejoin="round" d="M30 31 Q31 12 50 12 Q69 12 70 31Z"/><path fill="' + shirt + '" stroke="' + ink + '" stroke-width="1.5" stroke-linejoin="round" d="M21 37 Q50 23 79 37 Q81 41 76 41 Q50 31 24 41 Q19 41 21 37Z"/>',
    viking: '<g stroke="' + ink + '" stroke-width="1.4" stroke-linejoin="round"><path fill="#fff3d6" d="M29 31 Q15 27 14 10 Q22 19 31 22Z"/><path fill="#fff3d6" d="M71 31 Q85 27 86 10 Q78 19 69 22Z"/><path fill="#aab2c5" d="M27 39 Q27 15 50 15 Q73 15 73 39Z"/><rect x="25" y="34" width="50" height="6.5" rx="3" fill="#8189a0"/><rect x="47.5" y="16" width="5" height="20" rx="2" fill="#8189a0"/></g>',
    bow: '<path fill="#f06aa8" stroke="' + ink + '" stroke-width="1.2" stroke-linejoin="round" d="M63 23 L52 16 V30Z M63 23 L74 16 V30Z"/><circle cx="63" cy="23" r="3" fill="#ff9cc8" stroke="' + ink + '" stroke-width="1.2"/>',
    flower: '<g fill="#ff9cc8" stroke="' + ink + '" stroke-width=".9"><circle cx="66" cy="19.5" r="3.6"/><circle cx="70.6" cy="23" r="3.6"/><circle cx="68.8" cy="28.4" r="3.6"/><circle cx="63.2" cy="28.4" r="3.6"/><circle cx="61.4" cy="23" r="3.6"/></g><circle cx="66" cy="24.5" r="3" fill="#ffd84a" stroke="' + ink + '" stroke-width=".9"/>',
    headband: '<path d="M27 41 Q50 13 73 41" fill="none" stroke="' + ink + '" stroke-width="6.4" stroke-linecap="round"/><path d="M27 41 Q50 13 73 41" fill="none" stroke="' + shirt + '" stroke-width="4" stroke-linecap="round"/>',
    catears: '<g fill="' + hc + '" stroke="' + ink + '" stroke-width="1.3" stroke-linejoin="round"><path d="M29 31 L30 11 L44 22Z"/><path d="M71 31 L70 11 L56 22Z"/></g><path fill="#ff9cc8" d="M32.5 26 L33 16.5 L39.5 22Z M67.5 26 L67 16.5 L60.5 22Z"/>',
    crown: '<path fill="#ffd84a" stroke="' + ink + '" stroke-width="1.3" stroke-linejoin="round" d="M35 24 L37 8 L44 17 L50 5 L56 17 L63 8 L65 24Z"/><circle cx="50" cy="18.5" r="2.2" fill="#e0453c"/><circle cx="41" cy="20" r="1.6" fill="#3f7fe0"/><circle cx="59" cy="20" r="1.6" fill="#1c9d58"/>',
    headphones: '<path d="M25 48 Q25 13 50 13 Q75 13 75 48" fill="none" stroke="' + ink + '" stroke-width="4.5" stroke-linecap="round"/><rect x="19" y="40" width="11" height="18" rx="5" fill="' + stick + '" stroke="' + ink + '" stroke-width="1.5"/><rect x="70" y="40" width="11" height="18" rx="5" fill="' + stick + '" stroke="' + ink + '" stroke-width="1.5"/>'
  }[a.head] || '';
  const starAt = (x, y, s) => '<path transform="translate(' + x + ' ' + y + ') scale(' + s + ')" d="M0 -10 L2.9 -3.1 L10 -3.1 L4.3 1.6 L6.2 9 L0 4.6 L-6.2 9 L-4.3 1.6 L-10 -3.1 L-2.9 -3.1Z"/>';
  const heartAt = (x, y, s) => '<path transform="translate(' + x + ' ' + y + ') scale(' + s + ')" d="M0 6 Q-8.5 -0.5 -6 -4.8 Q-3.4 -8 0 -4.4 Q3.4 -8 6 -4.8 Q8.5 -0.5 0 6Z"/>';
  const glasses = {
    round: '<g fill="rgba(255,255,255,.35)" stroke="' + ink + '" stroke-width="2"><circle cx="41" cy="46" r="7.5"/><circle cx="59" cy="46" r="7.5"/><path d="M48.5 46 H51.5" fill="none"/></g>',
    shades: '<g fill="' + ink + '" stroke="' + ink + '" stroke-width="1.5"><rect x="32" y="40.5" width="16" height="11" rx="4"/><rect x="52" y="40.5" width="16" height="11" rx="4"/><path d="M48 44 H52 M32 44 L28 43 M68 44 L72 43" fill="none"/></g><path d="M35 43 L39 43 M55 43 L59 43" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>',
    star: '<g fill="#ffd84a" stroke="' + ink + '" stroke-width="1.2">' + starAt(41, 46.5, 0.9) + starAt(59, 46.5, 0.9) + '<path d="M47 46 H53" fill="none"/></g>',
    goggles: '<path d="M27 45 H73" stroke="' + ink + '" stroke-width="3.4" stroke-linecap="round"/><g fill="rgba(120,205,255,.6)" stroke="#e0453c" stroke-width="2.6"><circle cx="41" cy="46" r="7.6"/><circle cx="59" cy="46" r="7.6"/></g><path d="M37 43 L40 41 M55 43 L58 41" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>',
    pixel: '<path fill="' + ink + '" d="M30 42 H70 V46 H68 V48 H66 V50 H56 V48 H54 V46 H46 V48 H44 V50 H34 V48 H32 V46 H30Z"/><path fill="#fff" d="M35 44 H37 V46 H35Z M37 46 H39 V48 H37Z M57 44 H59 V46 H57Z M59 46 H61 V48 H59Z"/>',
    heart: '<g fill="#f06aa8" stroke="' + ink + '" stroke-width="1.2" stroke-linejoin="round">' + heartAt(41, 46.5, 1.25) + heartAt(59, 46.5, 1.25) + '<path d="M47.5 45.5 H52.5" fill="none"/></g>'
  }[a.glasses] || '';
  const logo = {
    star: '<g fill="' + onShirt + '">' + starAt(50, 90, 0.62) + '</g>',
    heart: '<g fill="#f06aa8" stroke="' + ink + '" stroke-width="1" stroke-linejoin="round">' + heartAt(50, 90, 1.05) + '</g>',
    rocket: '<path fill="#f4f4f4" stroke="' + ink + '" stroke-width="1" stroke-linejoin="round" d="M50 80.5 Q55.5 86 54 94 H46 Q44.5 86 50 80.5Z"/><path fill="#e0453c" stroke="' + ink + '" stroke-width=".7" stroke-linejoin="round" d="M46 91 L42.5 97 L46.6 95Z M54 91 L57.5 97 L53.4 95Z"/><circle cx="50" cy="87.6" r="1.9" fill="#3f7fe0" stroke="' + ink + '" stroke-width=".6"/><path fill="#f2a100" d="M47.6 94.5 L50 100 L52.4 94.5Z"/>',
    dino: '<path d="M42 92 Q44 85 52 86 Q58 86 60 90 L65 88 L63 92 Q62 96 56 96 L56 99 H54 L53.5 96 H48 L47.5 99 H45.5 L45 95 Q41 95 38 91Z" fill="#7ad14a" stroke="' + ink + '" stroke-width=".8" stroke-linejoin="round"/><path d="M47 86 L48.5 83 L50 86 L51.5 83 L53 86 L54.5 83.5 L56 86.5" fill="#1c9d58" stroke="' + ink + '" stroke-width=".5" stroke-linejoin="round"/><circle cx="61.5" cy="89.5" r=".8" fill="' + ink + '"/>',
    ball: '<circle cx="50" cy="90" r="6.8" fill="#fff" stroke="' + ink + '" stroke-width="1"/><path fill="' + ink + '" d="M50 86.6 L53.2 88.9 L52 92.6 H48 L46.8 88.9Z"/><path d="M50 86.6 V83.4 M53.2 88.9 L56.3 87.9 M52 92.6 L54 95.3 M48 92.6 L46 95.3 M46.8 88.9 L43.7 87.9" stroke="' + ink + '" stroke-width=".9"/>',
    rainbow: '<g fill="none" stroke-width="2.2" stroke-linecap="round"><path stroke="#e0453c" d="M41 95 A9 9 0 0 1 59 95"/><path stroke="#f2c230" d="M43.6 95 A6.4 6.4 0 0 1 56.4 95"/><path stroke="#3f7fe0" d="M46.2 95 A3.8 3.8 0 0 1 53.8 95"/></g>',
    bolt: '<path fill="#ffd84a" stroke="' + ink + '" stroke-width="1" d="M53 81 L45 91 H50 L47 99 L56 88 H51Z"/>',
    flame: '<path fill="#f2a100" stroke="' + ink + '" stroke-width="1" d="M50 81 Q57 88 55 94 Q54 99 50 99 Q46 99 45 94 Q44 90 47 87 Q48 90 50 89 Q49 85 50 81Z"/>',
    note: '<path fill="' + onShirt + '" d="M48 83 L57 81 V92 A3.2 3.2 0 1 1 55 89.2 V85 L50 86 V94 A3.2 3.2 0 1 1 48 91.2Z"/>',
    elevate: '<path fill="#d8f03c" stroke="' + ink + '" stroke-width=".8" stroke-linejoin="round" d="M37 99 L45 90 L50 94 L58 85 L65 99Z"/><path d="M41 96 H62 M44 93 H60 M52 90 H61" stroke="' + shirt + '" stroke-width=".9"/>',
    skull: '<circle cx="50" cy="89" r="6.5" fill="' + onShirt + '"/><rect x="46.5" y="93" width="7" height="4.5" rx="1.5" fill="' + onShirt + '"/><circle cx="47.6" cy="88.5" r="1.6" fill="' + shirt + '"/><circle cx="52.4" cy="88.5" r="1.6" fill="' + shirt + '"/><path d="M47.5 92 Q50 94 52.5 92" fill="none" stroke="' + shirt + '" stroke-width="1"/>'
  }[a.logo] || '';
  // mascots only: the patterns of the shirts in their photos (blue and white tie-dye, red with dinosaurs)
  const pattern = a.pattern === 'tiedye' ? '<g fill="#e4edff" opacity=".8"><circle cx="36" cy="88" r="5"/><circle cx="64" cy="85" r="4.5"/><circle cx="28" cy="97" r="4"/><circle cx="73" cy="96" r="4.5"/><circle cx="50" cy="81" r="3.5"/></g>'
    : a.pattern === 'dino' ? '<g><path d="M42 92 Q44 85 52 86 Q58 86 60 90 L65 88 L63 92 Q62 96 56 96 L56 99 H54 L53.5 96 H48 L47.5 99 H45.5 L45 95 Q41 95 38 91Z" fill="#f6b27a" stroke="' + ink + '" stroke-width=".7" stroke-linejoin="round"/><path d="M47 86 L48.5 83 L50 86 L51.5 83 L53 86 L54.5 83.5 L56 86.5" fill="#4f7fe0" stroke="' + ink + '" stroke-width=".5" stroke-linejoin="round"/><path d="M27 90 L29 87 L31 90 L33 87 M68 97 L70 94 L72 97 L74 94" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round"/><circle cx="61.5" cy="89.5" r=".7" fill="' + ink + '"/></g>' : '';
  const pattern2 = a.pattern === 'stripes' ? '<g stroke="' + onShirt + '" stroke-width="2.6" opacity=".5" stroke-linecap="round"><path d="M27 81 H73 M21 88 H79 M18.5 95 H81.5"/></g>'
    : a.pattern === 'dots' ? '<g fill="' + onShirt + '" opacity=".6"><circle cx="31" cy="85" r="2"/><circle cx="41" cy="80.5" r="2"/><circle cx="59" cy="80.5" r="2"/><circle cx="69" cy="85" r="2"/><circle cx="24" cy="94" r="2"/><circle cx="36" cy="93" r="2"/><circle cx="64" cy="93" r="2"/><circle cx="76" cy="94" r="2"/></g>'
    : a.pattern === 'checks' ? '<g fill="' + onShirt + '" opacity=".32">' + [[81, 28], [86, 23], [91, 20], [96, 18]].map((r, j) => { let s = ''; for (let x = 18 + (j % 2) * 5; x < 82; x += 10) if (x >= r[1] && x + 5 <= 100 - r[1]) s += '<rect x="' + x + '" y="' + r[0] + '" width="5" height="5"/>'; return s; }).join('') + '</g>'
    : a.pattern === 'flames' ? '<g fill="#f2a100" stroke="#e0453c" stroke-width="1" stroke-linejoin="round"><path d="M19 101 Q20 90 26 95 Q27 85 33 92 Q35 83 40 93 Q43 89 45 101Z"/><path d="M55 101 Q57 89 60 93 Q65 83 67 92 Q73 85 74 95 Q80 90 81 101Z"/></g>'
    : a.pattern === 'camo' ? '<g opacity=".45"><g fill="' + ink + '"><ellipse cx="31" cy="87" rx="6" ry="3.4"/><ellipse cx="66" cy="83" rx="5.5" ry="3"/><ellipse cx="72" cy="95" rx="6.5" ry="3.4"/><ellipse cx="42" cy="96" rx="5" ry="2.8"/></g><g fill="#7a8a3a"><ellipse cx="40" cy="82" rx="5" ry="2.8"/><ellipse cx="25" cy="95" rx="5" ry="3"/><ellipse cx="60" cy="91" rx="6" ry="3.2"/><ellipse cx="76" cy="87" rx="4" ry="2.6"/></g></g>'
    : a.pattern === 'hearts' ? '<g fill="#ff9cc8" opacity=".9">' + heartAt(30, 87, 0.5) + heartAt(70, 87, 0.5) + heartAt(38, 96, 0.45) + heartAt(62, 96, 0.45) + heartAt(22, 96, 0.4) + heartAt(78, 96, 0.4) + '</g>' : '';
  // eyes, cheeks, earrings and what goes round the neck
  const eyeR = a.eyes === 'sparkle' ? 4.1 : 3.2;
  const eyes = a.eyes === 'happy'
    ? '<path d="M37.4 47 Q41 42.4 44.6 47 M55.4 47 Q59 42.4 62.6 47" fill="none" stroke="' + ink + '" stroke-width="2.4" stroke-linecap="round"/>'
    : '<circle cx="41" cy="46" r="' + eyeR + '" fill="' + ink + '"/><circle cx="59" cy="46" r="' + eyeR + '" fill="' + ink + '"/><circle cx="42.2" cy="44.8" r="' + (a.eyes === 'sparkle' ? 1.4 : 1) + '" fill="#fff"/><circle cx="60.2" cy="44.8" r="' + (a.eyes === 'sparkle' ? 1.4 : 1) + '" fill="#fff"/>' +
      (a.eyes === 'sparkle' ? '<circle cx="39.6" cy="47.6" r=".7" fill="#fff"/><circle cx="57.6" cy="47.6" r=".7" fill="#fff"/>' : '') +
      (a.eyes === 'lashes' || a.eyes === 'sparkle' ? '<path d="M37.8 44 L35.4 42.4 M38.8 42.7 L37.2 40.4 M62.2 44 L64.6 42.4 M61.2 42.7 L62.8 40.4" fill="none" stroke="' + ink + '" stroke-width="1.2" stroke-linecap="round"/>' : '');
  const cheeks = a.face === 'rosy' ? '<circle cx="35.5" cy="54" r="5" fill="#ff7f9f" opacity=".55"/><circle cx="64.5" cy="54" r="5" fill="#ff7f9f" opacity=".55"/>'
    : '<circle cx="36" cy="54" r="4" fill="#ff8f8f" opacity=".35"/><circle cx="64" cy="54" r="4" fill="#ff8f8f" opacity=".35"/>';
  const facePaint = {
    freckles: '<g fill="#8a4f2e" opacity=".7"><circle cx="34.5" cy="52.5" r=".8"/><circle cx="37.2" cy="54.4" r=".8"/><circle cx="33.4" cy="55.4" r=".8"/><circle cx="65.5" cy="52.5" r=".8"/><circle cx="62.8" cy="54.4" r=".8"/><circle cx="66.6" cy="55.4" r=".8"/></g>',
    plaster: '<g transform="rotate(-22 64.5 55)"><rect x="58.5" y="52.6" width="12" height="4.8" rx="2.4" fill="#f7dcb8" stroke="' + ink + '" stroke-width=".7"/><rect x="62.8" y="52.6" width="3.4" height="4.8" fill="#e6bd8c"/></g>',
    warpaint: '<path d="M31.5 52.4 H39 M32 56 H39.5 M61 52.4 H68.5 M60.5 56 H68" fill="none" stroke="#3f7fe0" stroke-width="2" stroke-linecap="round"/>',
    starpaint: '<g fill="#ffd84a" stroke="' + ink + '" stroke-width="1.2">' + starAt(64.5, 55, 0.4) + '</g>',
    heartpaint: '<g fill="#f06aa8" stroke="' + ink + '" stroke-width="1.4">' + heartAt(64.5, 55, 0.5) + '</g>',
    boltpaint: '<path fill="#e0453c" stroke="' + ink + '" stroke-width=".6" stroke-linejoin="round" d="M66.5 50 L62 55.5 H64.8 L63 60.5 L68 54.5 H65.4Z"/>'
  }[a.face] || '';
  const earring = {
    studs: '<g fill="#ffd84a" stroke="' + ink + '" stroke-width=".6"><circle cx="27" cy="53" r="1.7"/><circle cx="73" cy="53" r="1.7"/></g>',
    hoops: '<g fill="none" stroke="#e0a800" stroke-width="1.5"><circle cx="26.5" cy="55.5" r="3.2"/><circle cx="73.5" cy="55.5" r="3.2"/></g>',
    stars: '<g fill="#ffd84a" stroke="' + ink + '" stroke-width="1.4">' + starAt(26.5, 55.5, 0.33) + starAt(73.5, 55.5, 0.33) + '</g>'
  }[a.ear] || '';
  const neckwear = {
    bowtie: '<path fill="#e0453c" stroke="' + ink + '" stroke-width="1" stroke-linejoin="round" d="M50 79 L42 74.5 V83.5Z M50 79 L58 74.5 V83.5Z"/><circle cx="50" cy="79" r="2" fill="#ff7a70" stroke="' + ink + '" stroke-width="1"/>',
    chain: '<path d="M40.5 76 Q50 91 59.5 76" fill="none" stroke="#e0a800" stroke-width="2.4" stroke-dasharray="2.6 1.3" stroke-linecap="round"/>',
    medal: '<path d="M44.5 76 L50 86 L55.5 76" fill="none" stroke="#e0453c" stroke-width="2.6" stroke-linejoin="round"/><circle cx="50" cy="88.6" r="3.8" fill="#ffd84a" stroke="' + ink + '" stroke-width=".8"/><path d="M50 86.6 V90.6 M48.4 88.6 H51.6" stroke="#b98200" stroke-width=".8"/>',
    necklace: '<path d="M42 76 Q50 86.5 58 76" fill="none" stroke="#e0a800" stroke-width="1.5" stroke-linecap="round"/><circle cx="50" cy="81.6" r="2.2" fill="#22b8c4" stroke="' + ink + '" stroke-width=".6"/>',
    scarf: '<path fill="#f06aa8" stroke="' + ink + '" stroke-width="1.1" stroke-linejoin="round" d="M39 74 Q50 82 61 74 L62.5 79.5 Q50 88 37.5 79.5Z"/><path fill="#f06aa8" stroke="' + ink + '" stroke-width="1.1" stroke-linejoin="round" d="M56 82 L61 95 L54.5 93.5Z"/>',
    tie: '<path fill="#e0453c" stroke="' + ink + '" stroke-width="1" stroke-linejoin="round" d="M47.6 77 H52.4 L51.4 80.5 L53.6 93 L50 97.5 L46.4 93 L48.6 80.5Z"/>'
  }[a.neck] || '';
  const tip = '#f3d9a6';
  const oneStick = (cls, x1, y1, x2, y2) => '<g class="' + cls + '"><path d="M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2 + '" stroke="' + stick + '" stroke-width="4.5" stroke-linecap="round"/><circle cx="' + x2 + '" cy="' + y2 + '" r="3.4" fill="' + tip + '" stroke="' + ink + '" stroke-width=".8"/></g>';
  return '<svg class="av" data-mood="' + (cheer ? 'cheer' : 'happy') + '" viewBox="0 0 100 100" aria-hidden="true">' + (a.bare ? '' : a.scene ? '<g transform="translate(-105 0) scale(1.1905)">' + VENUE_BACK[a.scene - 1] + '</g>' : '<rect width="100" height="100" fill="#cfe8ff"/>') +
    '<g class="avStars" fill="#ffd84a" stroke="#e0b400" stroke-width=".6">' + starAt(16, 14, 0.7) + starAt(84, 14, 0.7) + starAt(50, 7, 0.5) + '</g>' +
    '<path d="M16 101 Q18 75 50 75 Q82 75 84 101Z" fill="' + shirt + '" stroke="' + ink + '" stroke-width="1.5"/>' + pattern + pattern2 + (a.neck === 'tie' || a.neck === 'medal' ? '' : logo) +
    '<rect x="44" y="64" width="12" height="14" rx="4" fill="' + skin + '"/>' + neckwear +
    '<g class="sDown">' + oneStick('stL', 13, 97, 31, 70) + oneStick('stR', 87, 97, 69, 70) + '</g>' +
    '<g class="sUp">' + oneStick('', 17, 62, 8, 28) + oneStick('', 83, 62, 92, 28) + '</g>' +
    '<g class="avHead">' + hairBack +
    '<circle cx="28" cy="48" r="' + (a.ears || 4.5) + '" fill="' + skin + '" stroke="' + ink + '" stroke-width="1.2"/><circle cx="72" cy="48" r="' + (a.ears || 4.5) + '" fill="' + skin + '" stroke="' + ink + '" stroke-width="1.2"/>' +
    '<ellipse cx="50" cy="46" rx="22" ry="24" fill="' + skin + '" stroke="' + ink + '" stroke-width="1.5"/>' +
    earring + '<g fill="' + hc + '">' + hair + '</g>' + head +
    cheeks + facePaint + eyes +
    (a.brows ? '<path d="M35 40 Q41 37 46 40 M54 40 Q59 37 65 40" fill="none" stroke="' + (a.hairHex || ink) + '" stroke-width="2.4" stroke-linecap="round"/>' : '') +
    '<path class="brow" d="M36 39 Q41 35 46 39 M54 39 Q59 35 64 39" fill="none" stroke="' + ink + '" stroke-width="1.8" stroke-linecap="round"/>' +
    glasses +
    '<path class="mSmile" d="M41 56 Q50 64 59 56" fill="none" stroke="#7a2230" stroke-width="2.6" stroke-linecap="round"/>' +
    '<g class="mOpen"><path d="M40 55 Q50 69 60 55Z" fill="#7a2230"/><path d="M44 61 Q50 65 56 61 Q50 58 44 61Z" fill="#f08a8a"/></g>' +
    '<ellipse class="mOops" cx="50" cy="59" rx="3.6" ry="4.4" fill="#7a2230"/>' +
    '</g></svg>';
}
function faceHtml(p, cheer) {
  return avatarSvg(avOf(p), cheer);
}
// ---------- The mascots: the Beat Brothers, the two boys the app was made for ----------
// Each brother is drawn by hand from his photo (face shape, hair, brows, eyes, ears, shirt), in the same frame and
// with the same moving parts as every player's drummer, so the logo and the moods work the same way.
const MASCOTS = [
  { // the big brother: longer face, thick hair swept up and across, strong straight brows, blue tie-dye shirt
    skin: '#b98558', shade: '#9a6a43', lip: '#a85a50', lipLow: '#c57b6c', hairC: '#17171c', hairHi: '#3b3b46',
    face: 'M30 44 Q29 25 50 24.5 Q71 25 70 44 Q70 57 63.5 65.5 Q57 73.5 50 73.5 Q43 73.5 36.5 65.5 Q30 57 30 44Z',
    hairBack: 'M28.5 47 Q25 28 34 20 Q43 11 58 10 Q69 9.5 75 15.5 Q72.5 17.5 77 21.5 Q79 33 72 47 L70 36 Q60 24 42 27 Q32 31 30.5 40Z',
    hair: 'M29 46 Q26.5 30 35 22 Q44 13 58 12 Q68 11 73.5 16.5 Q71.5 18.5 75.5 22 Q77 31 72 44 Q71.5 37 67.5 32.5 Q58 26.5 46 29.5 Q36.5 32.5 32.5 38 Q30 41.5 29 46Z',
    shine: 'M40 21 Q54 13.5 69 17.5 M37 26.5 Q50 19 66 22.5 M44 27.5 Q56 23.5 68 28.5',
    browL: 'M34.6 41.4 Q40.5 38.4 46.8 40.6', browR: 'M53.2 40.6 Q59.5 38.4 65.4 41.4', browW: 2.7,
    eye: [4.5, 3.3, 2.9], eyeY: 47.2, noseW: 2.6, mouthY: 61,
    shirt: '#4a78cf', collar: '#2f5099',
    print: '<g fill="#e6eeff" opacity=".85"><circle cx="35" cy="88" r="5.2"/><circle cx="65" cy="86" r="4.6"/><circle cx="27" cy="97" r="4"/><circle cx="74" cy="96" r="4.6"/><circle cx="46" cy="83" r="3"/><circle cx="57" cy="97" r="3.4"/></g>' +
      '<path fill="#d6ef3a" stroke="#25304f" stroke-width=".7" stroke-linejoin="round" d="M37 99.5 L45 90.5 L50 94.5 L58 85.5 L65 99.5Z"/><path d="M41 96.5 H62.5 M44 93.5 H60.5 M52 90.5 H61 M48 92.5 V99 M54 90 V99 M59 88 V99" stroke="#4a78cf" stroke-width=".7"/>' },
  { // the little brother: rounder face with fuller cheeks, short neat hair with a side parting, big round eyes, red dinosaur shirt
    skin: '#c99468', shade: '#a9774f', lip: '#b0645a', lipLow: '#cf877a', hairC: '#17171c', hairHi: '#3b3b46',
    face: 'M29 46 Q28 26.5 50 26 Q72 26.5 71 46 Q71 60.5 62.5 67.5 Q56 72.5 50 72.5 Q44 72.5 37.5 67.5 Q29 60.5 29 46Z',
    hairBack: 'M27 47 Q23.5 23 46 18 Q64 14.5 73 24 Q77.5 31 73 47 L70.5 35 Q58 25 42 27.5 Q32 31 29.5 40Z',
    hair: 'M27.5 46 Q25 25 46 20 Q62.5 16.5 71.5 25 Q75.5 31 72.5 45 Q71 37 65.5 32.5 Q55 28 43 30.5 Q34 33.5 30.5 40 Q28.5 43 27.5 46Z',
    shine: 'M36 27 Q46 21 58 21.5 M43 30 Q46 24.5 53 22.5 M57 24 Q65 26 69 32',
    browL: 'M35.2 41.6 Q40.8 38.9 46 41.2', browR: 'M54 41.2 Q59.2 38.9 64.8 41.6', browW: 2,
    eye: [5, 4, 3.3], eyeY: 48, noseW: 2.2, mouthY: 61.5,
    shirt: '#e23636', collar: '#c02626',
    print: '<path d="M40 93 Q42 85.5 51 86.5 Q58 86.5 60 90.5 L65.5 88 L63.5 92.5 Q62.5 96.5 56 96.5 L56 99.5 H54 L53.5 96.5 H48 L47.5 99.5 H45.5 L45 95.5 Q41 95.5 37.5 91.5Z" fill="#f6b27a" stroke="#25304f" stroke-width=".7" stroke-linejoin="round"/>' +
      '<path d="M46 86.5 L47.5 83 L49 86.5 L50.5 83 L52 86.5 L53.5 83.5 L55 87" fill="#4f7fe0" stroke="#25304f" stroke-width=".5" stroke-linejoin="round"/><circle cx="61.8" cy="89.8" r=".7" fill="#25304f"/>' +
      '<path d="M24 97 Q26 92 30 93.5 Q33 94 33.5 97 L35 95.5 L34.5 98.5 Q32 100.5 27 100Z" fill="#c9a8f0" stroke="#25304f" stroke-width=".6"/><path d="M26 93.5 L27.2 91.4 L28.4 93.3 L29.6 91.4 L30.8 93.6" fill="#7ad14a" stroke="#25304f" stroke-width=".4"/>' +
      '<path d="M67 96 L69 93 L71 96 L73 93 L75 96 M30 86 L32 84 M34 88 L36 86" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round"/>' }
];
// mood: 'happy' (closed smile, sticks down) or 'cheer' (open smile, sticks in the air). bare = no background square.
function mascotSvg(i, cheer, bare) {
  const m = MASCOTS[i], ink = '#25304f', ey = m.eyeY, e = m.eye;
  const eye = (x) => '<ellipse cx="' + x + '" cy="' + ey + '" rx="' + e[0] + '" ry="' + e[1] + '" fill="#fff"/>' +
    '<circle cx="' + x + '" cy="' + (ey + 0.2) + '" r="' + e[2] + '" fill="#3a2416"/><circle cx="' + x + '" cy="' + (ey + 0.2) + '" r="' + (e[2] * 0.52) + '" fill="#120b08"/>' +
    '<circle cx="' + (x + 1.1) + '" cy="' + (ey - 1) + '" r=".95" fill="#fff"/>' +
    '<path d="M' + (x - e[0] - 0.3) + ' ' + (ey - 0.6) + ' Q' + x + ' ' + (ey - e[1] - 1.6) + ' ' + (x + e[0] + 0.3) + ' ' + (ey - 0.6) + '" fill="none" stroke="#1d1410" stroke-width="1.15" stroke-linecap="round"/>';
  const ear = (x, flip) => '<g transform="rotate(' + (flip ? 8 : -8) + ' ' + x + ' 49)"><ellipse cx="' + x + '" cy="49" rx="4.7" ry="6.4" fill="' + m.skin + '" stroke="' + ink + '" stroke-width="1.2"/>' +
    '<path d="M' + (x + (flip ? -1 : 1)) + ' 45.5 Q' + (x + (flip ? 1.6 : -1.6)) + ' 49 ' + (x + (flip ? -0.6 : 0.6)) + ' 52.5" fill="none" stroke="' + m.shade + '" stroke-width="1.1" stroke-linecap="round"/></g>';
  const stick = (cls, x1, y1, x2, y2) => '<g class="' + cls + '"><path d="M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2 + '" stroke="#d9a55b" stroke-width="4.5" stroke-linecap="round"/><circle cx="' + x2 + '" cy="' + y2 + '" r="3.4" fill="#f3d9a6" stroke="' + ink + '" stroke-width=".8"/></g>';
  const star = (x, y, s) => '<path transform="translate(' + x + ' ' + y + ') scale(' + s + ')" d="M0 -10 L2.9 -3.1 L10 -3.1 L4.3 1.6 L6.2 9 L0 4.6 L-6.2 9 L-4.3 1.6 L-10 -3.1 L-2.9 -3.1Z"/>';
  const my = m.mouthY;
  return '<svg class="av" data-mood="' + (cheer ? 'cheer' : 'happy') + '" viewBox="0 0 100 100" aria-hidden="true">' + (bare ? '' : '<rect width="100" height="100" fill="#cfe8ff"/>') +
    '<g class="avStars" fill="#ffd84a" stroke="#e0b400" stroke-width=".6">' + star(16, 14, 0.7) + star(84, 14, 0.7) + star(50, 7, 0.5) + '</g>' +
    '<path d="M15 101 Q17 76.5 40 75.5 Q50 80 60 75.5 Q83 76.5 85 101Z" fill="' + m.shirt + '" stroke="' + ink + '" stroke-width="1.5" stroke-linejoin="round"/>' + m.print +
    '<path d="M40.5 75.6 Q50 84.5 59.5 75.6" fill="none" stroke="' + m.collar + '" stroke-width="3.2" stroke-linecap="round"/>' +
    '<path d="M43.5 64 H56.5 V75 Q50 80.5 43.5 75Z" fill="' + m.skin + '"/><path d="M43.5 68 Q50 74 56.5 68 V70.5 Q50 76 43.5 70.5Z" fill="' + m.shade + '" opacity=".55"/>' +
    '<g class="sDown">' + stick('stL', 13, 97, 31, 70) + stick('stR', 87, 97, 69, 70) + '</g>' +
    '<g class="sUp">' + stick('', 17, 62, 8, 28) + stick('', 83, 62, 92, 28) + '</g>' +
    '<g class="avHead">' +
    '<path d="' + m.hairBack + '" fill="' + m.hairC + '"/>' + ear(27.2, false) + ear(72.8, true) +
    '<path d="' + m.face + '" fill="' + m.skin + '" stroke="' + ink + '" stroke-width="1.4"/>' +
    '<path d="' + m.hair + '" fill="' + m.hairC + '"/><path d="' + m.shine + '" fill="none" stroke="' + m.hairHi + '" stroke-width="1.3" stroke-linecap="round"/>' +
    '<circle cx="36" cy="56.5" r="4.2" fill="#e8806f" opacity=".22"/><circle cx="64" cy="56.5" r="4.2" fill="#e8806f" opacity=".22"/>' +
    eye(41) + eye(59) +
    '<path d="' + m.browL + ' M' + m.browR.slice(1) + '" fill="none" stroke="' + m.hairC + '" stroke-width="' + m.browW + '" stroke-linecap="round"/>' +
    '<path d="M50 48 Q48.4 52 ' + (50 - m.noseW) + ' 54.6 Q50 57.2 ' + (50 + m.noseW) + ' 54.6" fill="none" stroke="' + m.shade + '" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<g class="mSmile"><path d="M43.6 ' + (my - 0.4) + ' Q47 ' + (my - 2) + ' 50 ' + (my - 1) + ' Q53 ' + (my - 2) + ' 56.4 ' + (my - 0.4) + ' Q50 ' + (my + 1.4) + ' 43.6 ' + (my - 0.4) + 'Z" fill="' + m.lip + '"/>' +
      '<path d="M44.2 ' + my + ' Q50 ' + (my + 4.8) + ' 55.8 ' + my + ' Q50 ' + (my + 1.7) + ' 44.2 ' + my + 'Z" fill="' + m.lipLow + '"/><path d="M42.6 ' + (my - 0.9) + ' Q43.4 ' + (my - 0.2) + ' 44 ' + (my + 0.2) + ' M57.4 ' + (my - 0.9) + ' Q56.6 ' + (my - 0.2) + ' 56 ' + (my + 0.2) + '" fill="none" stroke="' + m.shade + '" stroke-width=".8" stroke-linecap="round"/></g>' +
    '<g class="mOpen"><path d="M42 ' + (my - 2) + ' Q50 ' + (my + 9) + ' 58 ' + (my - 2) + ' Q50 ' + (my + 0.6) + ' 42 ' + (my - 2) + 'Z" fill="#7a2230" stroke="' + m.lip + '" stroke-width=".9" stroke-linejoin="round"/>' +
      '<path d="M44.2 ' + (my - 0.9) + ' Q50 ' + (my + 1.4) + ' 55.8 ' + (my - 0.9) + ' Q50 ' + (my + 2.6) + ' 44.2 ' + (my - 0.9) + 'Z" fill="#fff"/><path d="M46.2 ' + (my + 3.2) + ' Q50 ' + (my + 6.2) + ' 53.8 ' + (my + 3.2) + ' Q50 ' + (my + 2) + ' 46.2 ' + (my + 3.2) + 'Z" fill="#f08a8a"/></g>' +
    '<ellipse class="mOops" cx="50" cy="' + (my + 1) + '" rx="3.2" ry="3.8" fill="#7a2230"/>' +
    '</g></svg>';
}
// The Beat Brothers are pictures now: one file per pose (art/b0-idle.png ...). 0 = the big brother, 1 = the little one.
const broImg = (i, pose) => '<img class="sprImg" alt="" draggable="false" data-b="' + i + '" data-pose="' + pose + '" src="art/b' + i + '-' + pose + '.png">';
const mascotHtml = (i, cheer, pose) => '<span class="mascot spr' + (i ? ' small' : '') + '">' + broImg(i, pose || (cheer ? 'jump' : 'idle')) + '</span>';
// The logo: both brothers behind one drum. It carries its own style rules, so it also works as a picture file.
// square = fill the whole square (for app icons, which the device rounds off itself).
function logoSvg(square) {
  const one = (i, x, y, s) => mascotSvg(i, true, true).replace('<svg class="av"', '<svg x="' + x + '" y="' + y + '" width="' + s + '" height="' + s + '" class="av"');
  const star = (x, y, s) => '<path transform="translate(' + x + ' ' + y + ') scale(' + s + ')" d="M0 -10 L2.9 -3.1 L10 -3.1 L4.3 1.6 L6.2 9 L0 4.6 L-6.2 9 L-4.3 1.6 L-10 -3.1 L-2.9 -3.1Z"/>';
  const gid = 'ddBg' + (logoSvg.n = (logoSvg.n || 0) + 1);   // each copy needs its own colour-fade name, or a hidden copy breaks the others
  return '<svg xmlns="http://www.w3.org/2000/svg" class="ddLogo" viewBox="0 0 512 512" role="img" aria-label="Daily Drum, with the Beat Brothers">' +
    '<style>.ddLogo .av .mSmile,.ddLogo .av .mOops,.ddLogo .av .sDown,.ddLogo .av .avStars{display:none}.ddLogo .av .mOpen,.ddLogo .av .sUp{display:inline}</style>' +
    '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6a5cf0"/><stop offset=".6" stop-color="#b05cf0"/><stop offset="1" stop-color="#f06aa8"/></linearGradient></defs>' +
    '<rect width="512" height="512" rx="' + (square ? 0 : 112) + '" fill="url(#' + gid + ')"/>' +
    '<circle cx="256" cy="236" r="196" fill="#ffd84a" opacity=".28"/><circle cx="256" cy="236" r="150" fill="#fff" opacity=".16"/>' +
    '<g fill="#ffd84a" stroke="#e0b400" stroke-width="2">' + star(96, 84, 2.2) + star(420, 96, 1.8) + star(258, 52, 1.4) + '</g>' +
    one(0, 40, 58, 312) + one(1, 222, 132, 256) +
    '<path d="M112 404 V452 Q112 486 256 486 Q400 486 400 452 V404Z" fill="#ffd84a" stroke="#25304f" stroke-width="8" stroke-linejoin="round"/>' +
    '<path d="M134 430 L170 468 L206 432 L242 472 L278 434 L314 470 L350 430 L384 462" fill="none" stroke="#e0453c" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<ellipse cx="256" cy="404" rx="144" ry="34" fill="#fffdf5" stroke="#25304f" stroke-width="8"/>' +
    '</svg>';
}
function fillMascots() {
  const logo = (cls, file) => '<span class="' + cls + '"><img alt="Daily Drum, by the Beat Brothers" draggable="false" src="art/' + file + '"></span>';
  $('#acMascots').innerHTML = logo('logoBig wide', 'logo-wide.png');
  $('#acHello').textContent = 'Drum along with the Beat Brothers!';
  $('#loadMascots').innerHTML = logo('logoBig wide loadLogo', 'logo-wide.png') + '<span class="loadBros drumming">' + mascotHtml(0, false, 'druma') + mascotHtml(1, false, 'drumb') + '</span>';
  $('#certMascots').innerHTML = logo('logoBig wide certLogo', 'logo-wide.png');   // the wide logo already says "by Beat Brothers"
  $('#brandMark').innerHTML = '<img alt="" draggable="false" src="art/logo-s.png">';
}
// The Beat Brothers pop up in the corner of the Home page, float there, and say something that fits the player today.
// A tap brings the next tip; the cross sends them away until the app is opened again.
const Bros = {
  i: 0, gone: false, list: [],
  tips() {
    const p = prof(), rk = rankOf(p.xp), ds = liveStreak(), out = [];
    const today = p.day === dayStr(new Date());
    out.push(today ? 'Back again' + (p.name ? ', ' + p.name : '') + '? We love it!' : 'Hi' + (p.name ? ' ' + p.name : '') + '! Ready to drum with us today?');
    if (typeof Online !== 'undefined' && Online.msgs.length) out.push('You have ' + Online.msgs.length + ' new message' + (Online.msgs.length === 1 ? '' : 's') + '. Tap Messages!');
    if (typeof Online !== 'undefined' && Online.ok() && Online.ses.has_word === false) out.push('Pick a secret word in My account. Then you can always get back in if you forget your PIN.');
    if (ds >= 2) out.push(ds + ' days in a row! ' + (today ? 'Today is done. See you tomorrow!' : 'Play today to keep it going.'));
    else if (!today) out.push('A little drumming every day beats one long day. Just one lesson?');
    if (rk.hi) out.push('Only ' + (rk.hi - p.xp) + ' more points and you are a ' + RANKS[rk.k + 1][1] + '!');
    const next = LESSONS.find(l => !l.song && !(progress[l.id] && progress[l.id].stars >= 2));
    if (next) out.push('Next up: "' + next.title + '". Press the big button!');
    const stop = VENUES.findIndex((v, k) => Tour.open(k) && !Tour.gigWon(k));
    if (stop >= 0) out.push('Come on Tour with us! The gig at ' + VENUES[stop] + ' is waiting.');
    if (!calibrated()) out.push('Ask a grown-up to do Setup, so we can hear your pad.');
    out.push('Tip: count out loud. "1, 2, 3, 4!"');
    out.push('Tip: slow and steady first. Fast comes later.');
    return out;
  },
  // What they say: a tip that fits the player, then a fact about drums, then a tip again. The facts come in a new order every time.
  build() {
    const tips = this.tips(), facts = (typeof DRUM_FACTS !== 'undefined' ? DRUM_FACTS.slice() : []);
    for (let k = facts.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); const x = facts[k]; facts[k] = facts[j]; facts[j] = x; }
    const out = [{ t: tips[0] }];
    for (let k = 0; k < facts.length; k++) { out.push({ t: tips[1 + (k % (tips.length - 1))] }); out.push({ t: facts[k], fact: true }); }
    return out;
  },
  say(pose) {
    const m = this.list[this.i];
    $('#brosKind').textContent = m.fact ? '💡 Did you know?' : '';
    $('#brosSay').textContent = m.t;
    const bub = document.querySelector('#brosPop .brosBubble');
    bub.classList.toggle('fact', !!m.fact);
    bub.classList.remove('pulse'); void bub.offsetWidth; bub.classList.add('pulse');
    // The brother who talks moves: the big one tells the facts, the little one gives the tips.
    if (typeof UI !== 'undefined') { const who = m.fact ? 0 : 1; UI.act($('#brosFaces').querySelector('[data-b="' + who + '"]'), pose || (m.fact ? 'think' : 'wave'), 1500); }
    // A fact surprises the little brother: this is the one place the "wow" face belongs.
    if (m.fact && typeof UI !== 'undefined') setTimeout(() => { const lil = $('#brosFaces').querySelector('[data-b="1"]'); if (lil && !lil._t && screen === 'hub') UI.act(lil, 'wow', 1200); }, 500);
  },
  show() {
    this.list = this.build(); this.i = 0;
    $('#brosFaces').innerHTML = mascotHtml(0, false) + mascotHtml(1, false);
    this.say('wave');
    const box = $('#brosPop');
    box.classList.remove('popIn'); void box.offsetWidth; box.classList.add('popIn');
    this.auto();
  },
  next() { this.i = (this.i + 1) % this.list.length; this.say(); this.auto(); },
  // On Home they carry on by themselves: a new line every 14 seconds.
  auto() { clearInterval(this.t); this.t = setInterval(() => { if (screen === 'hub' && !document.hidden) { this.i = (this.i + 1) % this.list.length; this.say(); } }, 14000); },
  init() {
    $('#brosFaces').onclick = () => { this.next(); if (typeof UI !== 'undefined') UI.act($('#brosFaces').querySelector('[data-b="' + (this.list[this.i].fact ? 1 : 0) + '"]'), 'jump', 900); };
  }
};
const brandName = () => 'Daily Drum';   // the app has one name; it cannot be changed in Setup
function renderHeader() {
  const p = prof();
  $('#meFace').innerHTML = faceHtml(p, false);
  $('#meName').textContent = p.name || 'Me';
  $('#brandTxt').textContent = brandName();
  $('#certBrand').textContent = brandName();
  document.title = brandName();
}

// ---------- Several players on one device ----------
// The first player has the id '' (see the top of app.js); the others are listed in dc.players.
const otherPlayers = () => [''].concat(store.get('players', [])).filter(id => id !== PLAYER)
  .map(id => ({ id, p: store.get('profile', null, id) })).filter(x => x.p && x.p.name);
function switchPlayer(id) { try { localStorage.setItem('dc.current', id); } catch (e) {} location.reload(); }
function addPlayer() {
  if (PLAYER && !(store.get('profile', null, '') || {}).name) { switchPlayer(''); return; }   // the first place is free again: use it
  const ids = store.get('players', []), id = 'p' + Date.now().toString(36);
  ids.push(id); store.set('players', ids);
  switchPlayer(id);
}
function removePlayer() {
  const next = otherPlayers()[0];
  if (!next) return;
  ['progress', 'profile', 'history', 'session'].forEach(k => store.del(k));
  if (PLAYER) store.set('players', store.get('players', []).filter(id => id !== PLAYER));
  switchPlayer(next.id);
}

function renderMe() {
  const p = prof(), a = avOf(p);
  $('#meTitle').textContent = p.name ? 'This is me today' : 'Who is drumming?';
  $('#mePreview').innerHTML = faceHtml(p, false);
  $('#mePreviewName').textContent = p.name || '';
  if (document.activeElement !== $('#meNameIn')) $('#meNameIn').value = p.name || '';
  document.querySelectorAll('#meOpts .chip').forEach(c => {
    c.classList.toggle('active', String(a[c.dataset.k]) === c.dataset.v);
    const need = GEAR_RANK[c.dataset.k + '.' + c.dataset.v] || 0, isScene = c.dataset.k === 'scene', sc = +c.dataset.v;
    const locked = isScene ? sc > 0 && !Tour.gigWon(sc - 1) : need > rankOf(p.xp).k;
    c.classList.toggle('locked', locked);
    c.title = !locked ? '' : isScene ? 'Play the gig at ' + VENUES[sc - 1] + ' on the Tour to earn this background.' : 'You get this when you become ' + RANKS[need][1] + '.';
  });
  // The other players: one "I'm ..." button each, and a button to add one more.
  const others = otherPlayers(), box = $('#meSwitch');
  box.innerHTML = '';
  others.forEach(o => {
    const b = document.createElement('button');
    b.className = 'whoBtn';
    b.innerHTML = '<span class="face"></span><span></span>';
    b.firstChild.innerHTML = faceHtml(o.p, false);
    b.lastChild.textContent = "I'm " + o.p.name;
    b.onclick = () => switchPlayer(o.id);
    box.appendChild(b);
  });
  // There is no "add a player": every player has an account of their own. Someone else logs in (or asks for an account) after this player logs out.
  const sw = document.createElement('button');
  sw.textContent = '🔁 Someone else is playing';
  sw.title = 'Logs this player out. The next player then logs in, or asks for an account of their own.';
  sw.onclick = () => Online.logout();
  box.appendChild(sw);
  $('#meRemoveRow').classList.toggle('hidden', !others.length);
  renderHeader();
}
function buildMe() {
  const setAv = (k, v) => {
    const p = prof();
    if (gearLocked(k, v)) { $('#meMsg').textContent = '🔒 You get this when you become ' + RANKS[GEAR_RANK[k + '.' + v]][1] + '. Keep practising!'; $('#meMsg').scrollIntoView({ block: 'nearest' }); return; }
    $('#meMsg').textContent = '';
    p.av = avOf(p); p.av[k] = v; delete p.photo; saveProf(); renderMe();
  };
  const box = $('#meOpts');
  Object.keys(AV_LABEL).forEach(k => {
    const row = document.createElement('div');
    row.className = 'row optRow'; row.dataset.tab = AV_TAB_OF[k] || 'extras';
    row.innerHTML = '<span class="optName"></span>';
    row.firstChild.textContent = AV_LABEL[k];
    AV[k].forEach((val, i) => {
      const isColour = val.charAt(0) === '#', v = isColour ? i : val;
      const c = document.createElement('button');
      c.className = 'chip'; c.dataset.k = k; c.dataset.v = String(v);
      if (isColour) { c.classList.add('swatch'); c.style.background = val; c.setAttribute('aria-label', AV_LABEL[k] + ' ' + (i + 1)); }
      else c.textContent = AV_WORD[k + '.' + val] || AV_WORD[val];
      c.onclick = () => setAv(k, v);
      row.appendChild(c);
    });
    box.appendChild(row);
  });
  // Backgrounds are not chosen freely: each one is earned by playing the gig at that Tour stop.
  const bgRow = document.createElement('div');
  bgRow.className = 'row optRow'; bgRow.dataset.tab = 'extras';
  bgRow.innerHTML = '<span class="optName">Background</span>';
  ['Plain'].concat(VENUES).forEach((name, k) => {
    const c = document.createElement('button');
    c.className = 'chip'; c.dataset.k = 'scene'; c.dataset.v = String(k);
    c.textContent = name;
    c.onclick = () => {
      if (k > 0 && !Tour.gigWon(k - 1)) { $('#meMsg').textContent = '🔒 Backgrounds are earned. Play the gig at ' + VENUES[k - 1] + ' on the Tour to get this one.'; $('#meMsg').scrollIntoView({ block: 'nearest' }); return; }
      $('#meMsg').textContent = '';
      const p = prof(); p.av = avOf(p); p.av.scene = k; delete p.photo; saveProf(); renderMe();
    };
    bgRow.appendChild(c);
  });
  box.appendChild(bgRow);
  // the four tabs above the styles
  const tabs = document.createElement('div');
  tabs.className = 'avTabs'; tabs.setAttribute('role', 'tablist');
  const pickTab = (id) => { box.dataset.tab = id; tabs.querySelectorAll('button').forEach(b => { const on = b.dataset.t === id; b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on)); }); };
  AV_TABS.forEach(t => {
    const b = document.createElement('button');
    b.dataset.t = t[0]; b.setAttribute('role', 'tab');
    b.innerHTML = '<span class="ti"></span><span></span>';
    b.firstChild.textContent = t[1]; b.lastChild.textContent = t[2];
    b.onclick = () => pickTab(t[0]);
    tabs.appendChild(b);
  });
  box.parentNode.insertBefore(tabs, box);
  pickTab('face');
  $('#meNameIn').oninput = (e) => { prof().name = e.target.value.trim(); saveProf(); renderMe(); };
  $('#meDone').onclick = () => {
    if (!prof().name) { $('#meMsg').textContent = 'Type your name first.'; $('#meNameIn').focus(); return; }
    $('#meMsg').textContent = '';
    show('hub');
  };
  $('#meRemove').onclick = () => {
    const b = $('#meRemove');
    if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Really remove ' + (prof().name || 'this player') + '?'; setTimeout(() => { delete b.dataset.sure; b.textContent = 'Remove this player'; }, 4000); return; }
    removePlayer();
  };
}

// ---------- Home: the players, and the wall of badges ----------
const BIG_BADGES = { galaxy: 1, days30: 1, days100: 1, trophy3: 1, combo100: 1, stars10: 1, days7: 1, gold3: 1, rep25: 1, lv1: 1, lv2: 1, lv3: 1 };
function renderHub() {
  const p = prof(), rk = rankOf(p.xp);
  renderProfile();   // also works out which lesson comes next
  // The band: the player in front, the other players beside them (a tap switches player).
  const band = $('#hubBand');
  band.innerHTML = '';
  const me = document.createElement('button');
  me.className = 'bandFace me';
  me.innerHTML = '<span class="face"></span><b></b>';
  me.firstChild.innerHTML = faceHtml(p, true);
  me.lastChild.textContent = p.name || 'Me';
  me.title = 'Change my drummer';
  me.onclick = () => show('me');
  band.appendChild(me);
  otherPlayers().forEach(o => {
    const b = document.createElement('button');
    b.className = 'bandFace';
    b.innerHTML = '<span class="face"></span><b></b>';
    b.firstChild.innerHTML = faceHtml(o.p, false);
    b.lastChild.textContent = "I'm " + o.p.name;
    b.title = 'Switch to ' + o.p.name;
    b.onclick = () => switchPlayer(o.id);
    band.appendChild(b);
  });
  Bros.show();
  const scene = avOf(p).scene;
  $('#hubArt').innerHTML = scene ? venueSvg(scene - 1, true) : '';
  document.querySelector('.hubHero').classList.toggle('hasArt', !!scene);
  $('#hubHello').textContent ='Hi, ' + (p.name || 'drummer') + '! Ready to drum?';
  $('#hubRank').textContent = rk.icon + ' ' + rk.name + ' · ' + p.xp + ' rank points · 🔥 ' + liveStreak() + (liveStreak() === 1 ? ' day' : ' days') + ' in a row';
  $('#hubXpFill').style.width = (rk.hi ? Math.max(4, Math.round(100 * (p.xp - rk.lo) / (rk.hi - rk.lo))) : 100) + '%';
  const go = $('#continueBtn');
  $('#hubGo').textContent = go.classList.contains('hidden') ? '🥁 Lessons' : go.textContent;
  $('#hubGo').onclick = () => (go.classList.contains('hidden') ? show('home') : go.click());
  // Every badge, earned or still open, with how to get it.
  const card = (icon, name, how, got, note) => {
    const c = document.createElement('div');
    c.className = 'bCard' + (got ? ' got' : '');
    c.innerHTML = '<span class="bIcon"></span><span class="bTxt"><b></b><span class="small"></span><i class="small"></i></span>';
    c.querySelector('.bIcon').textContent = icon;
    c.querySelector('b').textContent = name;
    c.querySelector('.bTxt span').textContent = how;
    c.querySelector('i').textContent = note;
    return c;
  };
  // The badges the player has come first, so opening the bar shows something won, not a wall of locks.
  $('#hubMine').innerHTML = ''; $('#hubBig').innerHTML = ''; $('#hubRest').innerHTML = '';
  BADGES.forEach(b => {
    const got = !!p.badges[b.id];
    $(got ? '#hubMine' : BIG_BADGES[b.id] ? '#hubBig' : '#hubRest').appendChild(card(b.icon, b.name, b.how, got, got ? '✔ Yours' : '🔒 How to earn it: see above'));
  });
  const n = Object.keys(p.badges).filter(id => BADGES.some(b => b.id === id)).length;
  [['#hubMine', '⭐ Mine'], ['#hubBig', '🏆 Big ones to earn'], ['#hubRest', 'More to earn']].forEach(g => {
    const box = $(g[0]), k = box.children.length;
    box.parentNode.classList.toggle('hidden', !k);
    $(g[0] + 'H').textContent = g[1] + ' (' + k + ')';
  });
  $('#hubCount').textContent = n === 0 ? 'None yet. Your first one is waiting: earn a star in any lesson.'
    : n + ' of ' + BADGES.length + (n === BADGES.length ? '. You collected them all!' : ' collected');
  const reps = Object.keys(progress).map(id => progress[id].reps || 0);
  $('#hubMedals').innerHTML = '';
  REP_TIERS.forEach((t, i) => {
    const hi = REP_TIERS[i + 1] ? REP_TIERS[i + 1][0] : Infinity;
    const cnt = reps.filter(r => r >= t[0] && r < hi).length, ever = reps.filter(r => r >= t[0]).length;
    $('#hubMedals').appendChild(card(t[2], t[1] + ' medal', t[0] + ' clean runs of one lesson', ever > 0, ever ? 'On ' + ever + (ever === 1 ? ' lesson' : ' lessons') : '🔒 Still to collect'));
  });
}

// ---------- Gear that is earned, and the stage that grows ----------
// Some avatar parts open up with the player's rank (0 = the first rank). Everything else is free from the start.
const GEAR_RANK = {
  'hair.mohawk': 1, 'head.bandana': 1, 'glasses.shades': 1, 'logo.bolt': 1, 'sticks.3': 1, 'hairCol.6': 1,
  'hair.long': 2, 'head.capback': 2, 'logo.flame': 2, 'sticks.5': 2, 'hairCol.7': 2,
  'head.headphones': 3, 'glasses.star': 3, 'logo.skull': 3, 'hairCol.8': 3,
  'sticks.4': 4,
  // the newer styles follow the same rule: most are free from the start, the special ones are earned rank by rank
  'hair.buns': 1, 'eyes.sparkle': 1, 'face.starpaint': 1, 'ear.hoops': 1, 'pattern.hearts': 1, 'neck.scarf': 1,
  'head.catears': 2, 'face.heartpaint': 2, 'logo.rainbow': 2, 'ear.stars': 2, 'neck.tie': 2,
  'glasses.heart': 3, 'face.boltpaint': 3, 'pattern.tiedye': 3,
  'head.crown': 4,
  'hair.undercut': 1, 'pattern.flames': 1, 'neck.chain': 1, 'face.plaster': 1,
  'head.viking': 2, 'logo.rocket': 2, 'face.warpaint': 2, 'neck.medal': 2,
  'glasses.pixel': 3, 'pattern.camo': 3, 'logo.dino': 3,
  'glasses.goggles': 4
};
const gearName = (key) => { const k = key.split('.')[0], v = key.split('.')[1]; return AV_WORD[v] ? AV_WORD[v].toLowerCase() + (k === 'logo' ? ' badge' : k === 'hair' ? ' hair' : '') : k === 'hairCol' ? 'a new hair colour' : k === 'sticks' ? 'a new drumstick colour' : 'a new ' + AV_LABEL[k].toLowerCase(); };
const gearLocked = (k, v) => (GEAR_RANK[k + '.' + v] || 0) > rankOf(prof().xp).k;
// Where the drummer plays: one place per rank.
const VENUES = ['My room', 'Garage', 'School hall', 'Club', 'Festival', 'Stadium', 'Galaxy'];
const FANS = 12;
const VENUE_BACK = [
    '<rect width="260" height="84" fill="#3b4470"/><rect x="196" y="8" width="44" height="32" rx="3" fill="#9fd0ff" stroke="#fff" stroke-width="2"/><path d="M218 8 V40 M196 24 H240" stroke="#fff" stroke-width="2"/><rect y="68" width="260" height="16" fill="#6b4a3a"/>',
    '<rect width="260" height="84" fill="#565c6e"/><path d="M0 14 H260 M0 30 H260 M0 46 H260 M0 62 H260" stroke="#6c7386" stroke-width="2"/><rect y="70" width="260" height="14" fill="#3a3f4c"/>',
    '<rect width="260" height="84" fill="#5a3340"/><path d="M0 0 H34 Q30 44 12 84 H0Z M260 0 H226 Q230 44 248 84 H260Z" fill="#b0303c"/><rect y="68" width="260" height="16" fill="#8a5a2b"/>',
    '<rect width="260" height="84" fill="#1d1838"/><path d="M90 0 L50 84 H130Z" fill="rgba(255,216,74,.2)"/><path d="M190 0 L150 84 H230Z" fill="rgba(240,106,168,.22)"/><rect y="72" width="260" height="12" fill="#0f0c20"/>',
    '<rect width="260" height="84" fill="#2b5fa8"/><ellipse cx="130" cy="92" rx="170" ry="30" fill="#2f8a4a"/><path d="M0 4 L10 16 L20 4Z" fill="#ffd84a"/><path d="M40 4 L50 16 L60 4Z" fill="#f06aa8"/><path d="M80 4 L90 16 L100 4Z" fill="#7ad14a"/><path d="M120 4 L130 16 L140 4Z" fill="#ffd84a"/><path d="M160 4 L170 16 L180 4Z" fill="#f06aa8"/><path d="M200 4 L210 16 L220 4Z" fill="#7ad14a"/><path d="M240 4 L250 16 L260 4Z" fill="#ffd84a"/><path d="M0 4 H260" stroke="#fff" stroke-width="1"/>',
    '<rect width="260" height="84" fill="#142a4a"/><ellipse cx="130" cy="20" rx="150" ry="26" fill="none" stroke="#2c4f82" stroke-width="10"/><ellipse cx="130" cy="34" rx="170" ry="30" fill="none" stroke="#3a659f" stroke-width="8"/><circle cx="24" cy="8" r="4" fill="#ffe9a8"/><circle cx="236" cy="8" r="4" fill="#ffe9a8"/><circle cx="130" cy="5" r="4" fill="#ffe9a8"/><rect y="70" width="260" height="14" fill="#1f6b3a"/>',
    '<rect width="260" height="84" fill="#101028"/><circle cx="130" cy="96" r="70" fill="#2b5fa8"/><path d="M96 60 Q120 50 150 58 Q170 64 186 56" fill="none" stroke="#2f8a4a" stroke-width="8" stroke-linecap="round"/><g fill="#ffd84a"><circle cx="30" cy="12" r="1.8"/><circle cx="70" cy="26" r="1.4"/><circle cx="118" cy="10" r="1.8"/><circle cx="170" cy="20" r="1.4"/><circle cx="214" cy="9" r="1.8"/><circle cx="244" cy="30" r="1.4"/></g>'
];
// plain = the picture alone (for banners); otherwise with the crowd and the name, behind the buddy.
function venueSvg(k, plain) {
  const back = VENUE_BACK[k] || '';
  if (plain) return '<svg viewBox="0 0 260 84" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + back + '</svg>';
  const cols = ['#f06aa8', '#56ccf2', '#ffd84a', '#7ad14a', '#b05cf0', '#f2a100'];
  let fans = '';
  for (let i = 0; i < FANS; i++) {
    const x = 104 + i * 13 + (i % 2 ? 2 : 0), y = 70 + (i % 3) * 3;
    fans += '<g class="fan" style="display:none"><path d="M' + (x - 7) + ' 90 Q' + x + ' ' + (y + 2) + ' ' + (x + 7) + ' 90Z" fill="' + cols[i % cols.length] + '"/><circle cx="' + x + '" cy="' + y + '" r="5" fill="' + AV.skin[(i * 2 + 1) % AV.skin.length] + '" stroke="#25304f" stroke-width="1"/></g>';
  }
  return '<svg viewBox="0 0 260 84" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + back + '<g class="crowd">' + fans + '</g>' +
    '<text x="254" y="13" text-anchor="end" font-size="9" font-weight="700" fill="#fff" opacity=".85">' + VENUES[k] + '</text></svg>';
}

// ---------- The buddy: a Beat Brother, alive beside the notes ----------
// (It used to be the player's own drummer; the brothers are the ones who coach, so one of them sits here now.)
// It nods on every beat, plays a stick on every right hit, pulls a face on a miss, cheers at 10, 20, 30... in a row,
// and says a short, kind word now and then, the way a teacher sitting next to you would.
const Buddy = {
  sfx: '', side: 0, missRun: 0, sayT: null, moodT: null, quietUntil: 0,
  calm: !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches),
  box() { return $('#buddyFace' + this.sfx); },
  svg() { return this.box().querySelector('svg'); },
  img() { return this.box().querySelector('img.buddyImg'); },
  // One pose for a moment, then back to standing.
  pose(p, ms) {
    const i = this.img();
    if (!i) return;
    clearTimeout(this.poseT);
    i.src = 'art/b' + i.dataset.b + '-' + p + '.png';
    if (ms) this.poseT = setTimeout(() => { const x = this.img(); if (x) x.src = 'art/b' + x.dataset.b + '-idle.png'; }, ms);
  },
  mount() {
    // lessons: the brothers take turns, lesson by lesson; the Tour: the host of the chosen difficulty
    const who = this.sfx === 'T' ? (Tour.pro() ? 0 : 1) : Math.abs((typeof G !== 'undefined' && G.idx) || 0) % 2;
    this.moodOn = false;
    this.box().innerHTML = '<img class="buddyImg" alt="" draggable="false" data-b="' + who + '" src="art/b' + who + '-idle.png">';
    $('#venue' + this.sfx).innerHTML = venueSvg(Math.max(0, avOf(prof()).scene - 1));
    this.fans(0);
  },
  // The crowd: one more fan for every four right hits in this run. Fans never leave.
  fans(hits) {
    const n = Math.min(FANS, Math.floor(hits / 4));
    if (n === this.nFans && hits) return;
    this.nFans = n;
    document.querySelectorAll('#venue' + this.sfx + ' .fan').forEach((f, i) => { f.style.display = i < n ? 'inline' : 'none'; });
  },
  crowd(frames, ms) { this.move(document.querySelector('#venue' + this.sfx + ' .crowd'), frames, ms); },
  // One stick stroke, left and right in turn.
  play() {
    const s = this.svg();
    this.side = 1 - this.side;
    if (!this.moodOn) this.pose(this.side ? 'druma' : 'drumb', 220);   // he drums along with every right hit
    if (s) this.move(s.querySelector(this.side ? '.stL' : '.stR'), [{ transform: 'rotate(0)' }, { transform: 'rotate(' + (this.side ? 34 : -34) + 'deg)' }, { transform: 'rotate(0)' }], 170);
    else this.move(this.box(), [{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], 170);
  },
  mood(m, ms) {
    const s = this.svg();
    clearTimeout(this.moodT);
    if (this.img()) {
      const p = { cheer: 'cheer', oops: 'think', wow: 'wow' }[m] || 'idle';
      this.moodOn = p !== 'idle';
      this.pose(p, ms);
      if (ms) this.moodT = setTimeout(() => { this.moodOn = false; }, ms);
      return;
    }
    if (!s) return;
    s.dataset.mood = m;
    if (ms) this.moodT = setTimeout(() => { const x = this.svg(); if (x) x.dataset.mood = 'happy'; }, ms);
  },
  move(el, frames, ms) { if (el && el.animate && !this.calm) el.animate(frames, { duration: ms, easing: 'ease-out' }); },
  say(text, ms, force) {
    const now = performance.now();
    if (!force && now < this.quietUntil) return;   // do not chatter: one line at a time
    this.quietUntil = now + (ms || 2200);
    const el = $('#buddySay' + this.sfx);
    el.textContent = text;
    el.classList.toggle('on', !!text);
    clearTimeout(this.sayT);
    if (ms) this.sayT = setTimeout(() => { el.classList.remove('on'); }, ms);
  },
  pick(list) { return list[Math.floor(Math.random() * list.length)]; },
  idle() {
    if (!this.box()) return;
    this.mount(); this.missRun = 0;
    this.say('Ready when you are!', 0, true);
  },
  start(demo) {
    this.mount(); this.missRun = 0;
    const n = prof().name;
    this.say(demo ? 'Watch and listen. Press Start when you are ready.' : this.pick(["Let's go" + (n ? ', ' + n : '') + '!', 'Here we go!', 'Sticks up!']), demo ? 0 : 2200, true);
  },
  beat(bi) {
    const s = this.svg(), d = bi % 2 ? 1 : -1;
    if (s) this.move(s.querySelector('.avHead'), [{ transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(3px) rotate(' + (2.5 * d) + 'deg)' }, { transform: 'translateY(0) rotate(0)' }], 240);
    else this.move(this.box(), [{ transform: 'translateY(0)' }, { transform: 'translateY(3px)' }, { transform: 'translateY(0)' }], 240);
    this.crowd([{ transform: 'translateY(0)' }, { transform: 'translateY(-2px)' }, { transform: 'translateY(0)' }], 240);
  },
  hit(streak) {
    this.missRun = 0;
    this.play();
    this.fans(G.stats ? G.stats.hit : 0);
    if (streak >= 10 && streak % 10 === 0) {
      this.mood('cheer', 1300);
      this.crowd([{ transform: 'translateY(0)' }, { transform: 'translateY(-9px)' }, { transform: 'translateY(0)' }, { transform: 'translateY(-5px)' }, { transform: 'translateY(0)' }], 700);
      this.move(this.box(), [{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-10px) scale(1.12)' }, { transform: 'translateY(0) scale(1)' }], 420);
      this.say(streak === 10 ? '10 in a row! 🔥' : streak === 20 ? '20! You are on fire!' : streak === 30 ? '30! Unstoppable!' : streak + ' in a row! Wow!', 2200, true);
    } else if (streak === 5) this.say(this.pick(['Nice!', 'Good groove!', 'Yes! Keep it up!']), 1600);
  },
  // was: the run of right hits that just ended. wrong: a wrong or extra hit (true) or a note that went by (false).
  miss(was, wrong) {
    this.missRun++;
    this.mood('oops', 650);
    const s = this.svg();
    this.move(s ? s.querySelector('.avHead') : this.box(), [{ transform: 'translateX(0)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }], 300);
    if (was >= 8) this.say(was + ' in a row, great! Go again!', 2400, true);
    else if (this.missRun === 4) this.say(this.pick(['No worries. Listen for the click.', 'Take a breath. You can do it!', 'Slow is fine. Try a lower tempo.']), 2800);
    else if (this.missRun === 1 && was >= 3) this.say(wrong ? 'Oops! Keep going!' : 'Missed one. Keep going!', 1600);
  }
};

// ---------- What the teacher would say: the parts of drumming a microphone cannot check ----------
// One set of notes per level, shown above its lessons, and one "focus" line shown while playing.
const TEACH = [
  { focus: 'Sit tall, shoulders loose, and let the stick bounce.', notes: [
    ['🪑', 'Sit', 'Sit on the front half of the seat with a straight back. Thighs level or sloping slightly down, feet flat on the pedals. Place the pad so your forearms are level when the sticks rest on it.'],
    ['✊', 'Grip', 'Hold the stick a third of the way up, between the pad of the thumb and the first finger. Wrap the other fingers round loosely. Palms face the floor. Tight hands make a thin sound and sore arms.'],
    ['⤴️', 'Stroke', 'Throw the stick at the pad from the wrist and let it bounce back up, like dribbling a ball. Do not press it into the pad.'],
    ['🗣️', 'Count', 'Count out loud, every time: "1, 2, 3, 4". Drummers who count keep time; drummers who do not, guess.']] },
  { focus: 'Count "1 and 2 and" out loud and keep every hi-hat hit the same.', notes: [
    ['🎚️', 'Balance', 'In a band the kick and snare are loud and the hi-hat is quiet. Try to play the hi-hat softer than the snare from the start.'],
    ['🦶', 'Feet', 'Heel down on the pedal for quiet playing, heel up (pushing from the leg) for loud. Start with heel down.'],
    ['🐢', 'Slow first', 'If you cannot play it slowly, you cannot play it fast. Use the tempo slider, and Wait mode for anything new.'],
    ['🔁', 'Fills', 'A fill must end in time. Keep counting through it and land the crash exactly on "1".']] },
  { focus: 'Follow the R and L exactly. Make both hands sound the same.', notes: [
    ['🥢', 'Rudiments', 'Rudiments are to drummers what scales are to pianists: single strokes, double strokes and paradiddles. Five minutes of them is the standard warm-up before every practice.'],
    ['📏', 'Stick height', 'Lift both sticks to the same height. The height of the stick decides the loudness of the note.'],
    ['👂', 'Listen', 'Close your eyes. Can you hear which hand is playing? If you can, the weaker hand needs more practice.'],
    ['🪞', 'Weak hand', 'Start each exercise with the other hand as well. Your weaker hand should lead half of your practice.']] },
  { focus: 'Keep the hands steady while the foot moves. Do not let the hi-hat wobble.', notes: [
    ['🧠', 'Independence', 'The hands play one thing while the foot plays another. Learn the foot alone, then the hands alone, then put them together slowly.'],
    ['🎼', 'Phrases', 'Music is built in groups of 2, 4 and 8 bars. Count the bars as well as the beats, so you know where a fill belongs.'],
    ['🎧', 'Listen to songs', 'Pick a song you like and listen only to the kick drum. Then only to the snare. That is how drummers learn parts.']] },
  { focus: 'Stay relaxed. Speed comes from loose wrists, not from force.', notes: [
    ['🔢', 'Counting 16ths', 'Count "1 e and a, 2 e and a". Say it out loud until it is automatic.'],
    ['🤲', 'Wrists', 'At this speed the movement comes from the wrists and fingers. If your shoulders rise, stop, shake out your arms and slow down.'],
    ['⏱️', 'Metronome', 'Raise the tempo by 5 BPM only after three clean runs. Write the tempo down: it is your progress.']] },
  { focus: 'Add one limb at a time. All four should sound like one player.', notes: [
    ['🦵', 'Hi-hat foot', 'The hi-hat foot keeps time when your hands are busy on the ride. Rock from heel to toe: heel on the beat, toe on the "chick".'],
    ['🧩', 'Building a beat', 'Feet first, then add the lead hand, then the other hand. Never start with all four limbs at once.'],
    ['🎭', 'Feel', 'The same notes can feel heavy (half-time) or light (disco). Listen for how the beat makes you want to move.']] },
  { focus: 'Lean on the first of each three and keep it rolling.', notes: [
    ['🎷', 'Swing', 'Triplets give blues and jazz their lazy, rolling feel. Sing "tri-po-let" along with the click.'],
    ['🪶', 'Touch', 'Jazz is played quietly. Small strokes close to the cymbal, and let the stick dance.'],
    ['📻', 'Listening', 'Listen to a slow blues and a swing tune this week and tap the ride pattern on your knee.']] },
  { focus: 'Even sound from both hands. Low sticks, loose grip.', notes: [
    ['🧱', 'Daily routine', 'Singles, doubles and paradiddles, two minutes each, every day. This is the single most useful habit a drummer has.'],
    ['🔊', 'Accents', 'Teachers add accents next: one loud note in each group, the rest soft. The app cannot hear loudness, so listen for it yourself.'],
    ['🎥', 'Record yourself', 'Record a minute of practice on a phone. You will hear things you cannot hear while you play.']] },
  { focus: 'Play it like music: think in sections, and make the fills lead somewhere.', notes: [
    ['🗺️', 'Song form', 'Songs are built from sections: intro, verse, chorus, bridge, ending. A drummer marks each change with a fill and a crash.'],
    ['🤝', 'Serving the song', 'The best drum part is the one the song needs. Simple and steady beats busy and shaky every time.'],
    ['📖', 'Reading', 'Follow the sheet music above the notes, then tick "Sheet only" and play from the sheet alone. Reading lets you learn any song without hearing it first.']] },
  { focus: 'Make it groove: the quiet notes matter as much as the loud ones.', notes: [
    ['👻', 'Ghost notes', 'Funk drummers play the extra snare notes very softly, from just above the drum. Try it: loud on 2 and 4, a whisper on the rest.'],
    ['🎯', 'The pocket', 'Playing "in the pocket" means every note sits exactly where it belongs. Check your average timing after each run.']] },
  { focus: 'Count the new bar length out loud before you start.', notes: [
    ['🧮', 'Time signatures', 'The top number says how many beats are in a bar: 3/4 has three, 5/4 has five. Count them out loud until the bar feels natural.'],
    ['🌍', 'Styles', 'Each style comes from a place and a dance. Listen to bossa nova and samba from Brazil before you play them.']] },
  { focus: 'Lock one limb into its pattern, then forget it and add the next.', notes: [
    ['🔗', 'Ostinato', 'An ostinato is a pattern one limb repeats without thinking, so that the others are free. It takes weeks. That is normal.'],
    ['🧘', 'Tension', 'Hard coordination makes people hold their breath. Breathe, and keep your shoulders down.']] },
  { focus: 'Perform it: start to finish, no stopping, whatever happens.', notes: [
    ['🎪', 'Performing', 'In a performance you never stop for a mistake. Keep the beat going and rejoin. Practise that on purpose.'],
    ['👂', 'Protect your ears', 'A real drum kit is loud enough to damage hearing. Always wear ear protection on an acoustic kit.'],
    ['🚪', 'What next', 'Find a teacher or a band. Playing with other people is the fastest way to grow from here.']] }
];
const HOW = [
  ['🪑', 'Sit', 'Front half of the seat, back straight, feet flat. The pad sits at a height where your forearms are level.'],
  ['✊', 'Hold', 'Thumb and first finger pinch the stick a third of the way up. The other fingers wrap round loosely. Palms face down.'],
  ['⤴️', 'Hit', 'Flick from the wrist and let the stick bounce back up. Never press it into the pad.'],
  ['🦶', 'Feet', 'One foot on each pedal, heels down. The kick foot taps; the other foot keeps the hi-hat pedal pressed.'],
  ['🗣️', 'Count', 'Count out loud while you play. It feels silly and it is the fastest way to learn.'],
  ['⏰', 'Practise', 'Ten minutes every day beats an hour once a week. Start with something easy, end with something fun.']
];
function buildHow() {
  const box = $('#howCards');
  HOW.forEach(h => {
    const d = document.createElement('div');
    d.className = 'how';
    d.innerHTML = '<div class="howIcon"></div><b></b><span></span>';
    d.children[0].textContent = h[0]; d.children[1].textContent = h[1]; d.children[2].textContent = h[2];
    box.appendChild(d);
  });
}
function teachBlock(k) {
  const t = TEACH[k];
  const d = document.createElement('details');
  d.className = 'teach';
  d.innerHTML = '<summary>🎓 Teacher\'s notes for this level</summary><div class="howCards"></div>';
  t.notes.forEach(h => {
    const c = document.createElement('div');
    c.className = 'how';
    c.innerHTML = '<div class="howIcon"></div><b></b><span></span>';
    c.children[0].textContent = h[0]; c.children[1].textContent = h[1]; c.children[2].textContent = h[2];
    d.lastChild.appendChild(c);
  });
  return d;
}

// ---------- The pad picture beside the falling notes ----------
// Which spots on the picture stand for an instrument: the places the player has taught, or the usual one.
function viewSpots(pad) {
  const mine = SPOTS.filter(s => s.pad === pad && keysOf(s).some(learned));
  return mine.length ? mine : SPOTS.filter(s => s.key === pad);
}
const padViewLast = {};
let nextUpLast = '';
const LIMB_WORD = { RH: 'right hand', LH: 'left hand', RF: 'right foot', LF: 'left foot' };
function updatePadView() {
  const lvl = {};
  let next = null;
  for (let i = G.head; i < G.notes.length; i++) {
    const n = G.notes[i], d = n.t - G.viewPos;
    if (d > 1) break;
    if (n.state !== 0 || d < -0.15) continue;
    if (!next) next = n.t;
    lvl[n.pad] = Math.max(lvl[n.pad] || 0, d <= 0 ? 1 : 1 - d);
  }
  SPOTS.forEach(s => {
    const on = viewSpots(s.pad).indexOf(s) >= 0;
    const v = on && G.running ? Math.round(10 * (lvl[s.pad] || 0)) / 10 : 0;
    const used = on && G.lanes.indexOf(s.pad) >= 0;
    const sig = v + (used ? 'u' : '');
    if (padViewLast[s.key] === sig) return;
    padViewLast[s.key] = sig;
    const el = $('#pv-' + s.key);
    el.style.setProperty('--lvl', v);
    el.classList.toggle('now', v >= 0.9);
    el.classList.toggle('used', used);
  });
  let txt = '';
  if (G.running && next !== null) {
    txt = 'Next: ' + G.notes.filter(n => n.t === next && n.state === 0).map(n => PAD[n.pad].name + (n.limb ? ' (' + LIMB_WORD[n.limb] + ')' : '')).join(' + ');
  }
  if (txt !== nextUpLast) { nextUpLast = txt; $('#nextUp').textContent = txt; }
  // the four hands and feet: the ones that play the next note light up (one, two or three at once)
  const lim = G.running && next !== null ? G.notes.filter(n => n.t === next && n.state === 0 && n.limb).map(n => n.limb).sort().join(',') : '';
  if (lim !== limbLast) {
    limbLast = lim;
    const on = lim ? lim.split(',') : [];
    document.querySelectorAll('#limbPic span').forEach(s => s.classList.toggle('on', on.indexOf(s.dataset.l) >= 0));
  }
}
let limbLast = '';
function flashPadView(pad, good) {
  viewSpots(pad).forEach(s => {
    const el = $('#pv-' + s.key);
    if (!el) return;
    const cls = good ? 'hitok' : 'hitbad';
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 200);
  });
}

// ---------- Sheet music: simplified drum notation that follows the playing ----------
// Cymbals are crosses, drums are dots; hands have stems up, feet have stems down; notes inside a beat are beamed;
// a beat with nothing for the hands gets a rest. staffSvg draws the given bars side by side.
const STAFF_Y = { crash: 6, hihat: 16, ride: 26, tom1: 31, tom2: 36, snare: 41, tom3: 51, kick: 61, hhpedal: 76 };
const STAFF_X0 = 40, STAFF_PAD = 14;
function staffGeom(lesson, nBars, W) {
  const steps = barBeats(lesson) * lesson.div, bw = (W - STAFF_X0 - 6) / nBars, dx = (bw - STAFF_PAD) / steps;
  return { steps, bw, dx, X: (b, i) => STAFF_X0 + b * bw + STAFF_PAD / 2 + (i + 0.5) * dx };
}
function staffSvg(lesson, idxs, W) {
  const div = lesson.div, B = barBeats(lesson), g = staffGeom(lesson, idxs.length, W), steps = g.steps;
  const L = (cls, x1, y1, x2, y2) => '<line class="' + cls + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>';
  let s = '<svg viewBox="0 -8 ' + W + ' 122" role="img" aria-label="Drum notation">';
  for (let k = 0; k < 5; k++) s += L('st', 6, 26 + k * 10, W - 4, 26 + k * 10);
  s += L('st', 6, 26, 6, 66) + L('st b', W - 4, 26, W - 4, 66);
  const six8 = lesson.feel === '6/8 time';
  s += '<text class="ts" x="22" y="45">' + (six8 ? 6 : B) + '</text><text class="ts" x="22" y="65">' + (six8 ? 8 : 4) + '</text>';
  idxs.forEach((bi, b) => {
    const bar = lesson.bars[bi], X = (i) => g.X(b, i);
    if (b > 0) s += L('st', STAFF_X0 + b * g.bw, 26, STAFF_X0 + b * g.bw, 66);
    const hands = [], feet = [];
    for (let i = 0; i < steps; i++) {
      const up = [], down = [];
      Object.keys(bar).forEach(p => { if (bar[p][i] === 'x') (p === 'kick' || p === 'hhpedal' ? down : up).push(p); });
      up.concat(down).forEach(p => {
        const y = STAFF_Y[p], x = X(i);
        if (p === 'crash') s += L('st', x - 7, 6, x + 7, 6);
        if (p === 'hihat' || p === 'ride' || p === 'crash' || p === 'hhpedal') s += '<path class="xh" d="M' + (x - 3.5) + ' ' + (y - 3.5) + 'l7 7m0 -7l-7 7"/>';
        else s += '<ellipse class="nh" cx="' + x + '" cy="' + y + '" rx="4.4" ry="3.3" transform="rotate(-20 ' + x + ' ' + y + ')"/>';
      });
      if (up.length) { hands.push(i); s += L('stem', X(i) + 4, Math.max.apply(null, up.map(p => STAFF_Y[p])), X(i) + 4, -4); }
      if (down.length) { feet.push(i); s += L('stem', X(i) - 4, Math.min.apply(null, down.map(p => STAFF_Y[p])), X(i) - 4, 90); }
    }
    // Beams join the notes that share a beat: one beam for two or three to a beat, two beams for four or six.
    const beam = (list, y, off, dir) => {
      for (let bt = 0; bt < B; bt++) {
        const grp = list.filter(i => Math.floor(i / div) === bt);
        if (!grp.length && dir > 0) {   // nothing for the hands in this beat: a rest
          const x = X(bt * div), y0 = 34;
          s += '<path class="rest" d="M' + (x - 2) + ' ' + y0 + 'l5 7l-5 5l5 7c-6 -3 -9 1 -4 6"/>';
        }
        if (grp.length < 2) continue;
        const xa = X(grp[0]) + off, xb = X(grp[grp.length - 1]) + off;
        s += L('beam', xa, y, xb, y);
        if (div === 4 || div === 6) for (let k = 0; k < grp.length - 1; k++) if (grp[k + 1] - grp[k] === 1) s += L('beam', X(grp[k]) + off, y + dir * 5, X(grp[k + 1]) + off, y + dir * 5);
        if ((div === 3 || div === 6) && !six8) s += '<text class="tup" x="' + (xa + xb) / 2 + '" y="' + (y - dir * 4 + (dir < 0 ? 7 : 0)) + '">' + div + '</text>';
      }
    };
    beam(hands, -4, 4, 1);
    beam(feet, 90, -4, -1);
    for (let i = 0; i < steps; i++) {
      const sub = i % div;
      const lab = lesson.count ? lesson.count[i % lesson.count.length] : sub === 0 ? String(Math.floor(i / div) + 1) : (div === 6 ? '' : COUNT[div][sub]);
      s += '<text class="ct' + (sub === 0 ? ' on' : '') + '" x="' + X(i) + '" y="108">' + (lab === 'trip' ? 'tr' : lab === 'let' ? 'l' : lab) + '</text>';
    }
  });
  return s + '<line class="cur" x1="0" x2="0" y1="-6" y2="100" style="display:none"/></svg>';
}
// The strip above the notes: the bar being played and the one after it, with a line that moves across in time.
const SHEET_W = 900;
const sheetState = { lesson: null, key: '' };
function showNotation(lesson) { sheetState.lesson = null; updateSheet(); }
function updateSheet() {
  const l = G.lesson, box = $('#sheet');
  if (!l || !box) return;
  const B = barBeats(l), n = l.bars.length, pos = G.running ? G.viewPos : -1;
  const barNo = Math.max(0, Math.floor(pos / B + 1e-6)), totalBars = Math.round(G.totalBeats / B);
  const cur = barNo % n, last = barNo >= totalBars - 1 && G.running;
  const idxs = last || (n === 1 && totalBars === 1) ? [cur] : [cur, (cur + 1) % n];
  const key = idxs.join(',');
  if (sheetState.lesson !== l || sheetState.key !== key) {
    sheetState.lesson = l; sheetState.key = key;
    box.innerHTML = staffSvg(l, idxs, idxs.length === 1 ? SHEET_W / 2 : SHEET_W) +
      '<div class="small">Bar ' + (cur + 1) + ' of ' + n + (n === 1 ? ' (it repeats)' : '') + '. Crosses are cymbals, dots are drums. Stems up: hands. Stems down: feet.</div>';
    box.classList.toggle('one', idxs.length === 1);
  }
  const c = box.querySelector('.cur');
  if (G.running && pos >= 0 && pos < G.totalBeats) {
    const g = staffGeom(l, idxs.length, idxs.length === 1 ? SHEET_W / 2 : SHEET_W);
    const x = g.X(0, (pos - barNo * B) * l.div);
    c.style.display = ''; c.setAttribute('x1', x); c.setAttribute('x2', x);
  } else c.style.display = 'none';
}

// ---------- Start here: how to read drum music ----------
const READ_NOTES = [
  ['crash', 'Crash: a cross above the staff, on its own little line.'],
  ['hihat', 'Hi-hat: a cross sitting just above the top line.'],
  ['ride', 'Ride: a cross on the top line.'],
  ['tom1', 'High Tom: a dot in the top space.'],
  ['tom2', 'Low Tom: a dot on the second line from the top.'],
  ['snare', 'Snare: a dot in the space just above the middle line.'],
  ['tom3', 'Floor Tom: a dot in the space just below the middle line.'],
  ['kick', 'Bass drum (kick): a dot in the bottom space. Its stem points down, because a foot plays it.'],
  ['hhpedal', 'Hi-hat pedal: a cross below the staff, stem down.']
];
const READ_STEPS = [
  { title: 'One note on every beat', say: 'No beam: each note lasts a whole beat. Count "1, 2, 3, 4".', l: { div: 1, bars: [{ snare: 'xxxx' }] } },
  { title: 'Two notes on every beat', say: 'One beam joins two notes into a beat. Count "1 and 2 and".', l: { div: 2, bars: [{ snare: 'xxxxxxxx' }] } },
  { title: 'Four notes on every beat', say: 'Two beams: four notes share a beat. Count "1 e and a".', l: { div: 4, bars: [{ snare: 'xxxxxxxxxxxxxxxx' }] } },
  { title: 'Three notes on every beat', say: 'A beam with a small 3: triplets. Count "1 trip let".', l: { div: 3, bars: [{ snare: 'xxxxxxxxxxxx' }] } },
  { title: 'Rests', say: 'The squiggle is a rest: the hands play nothing on that beat.', l: { div: 2, bars: [{ snare: 'xx--xx--', kick: '----x---' }] } },
  { title: 'Hands and feet together', say: 'Notes stacked above each other are played at the same moment. Here: kick with hi-hat on 1 and 3, snare with hi-hat on 2 and 4.', l: { div: 2, bars: [{ hihat: 'xxxxxxxx', snare: '--x---x-', kick: 'x---x---' }] } }
];
const Read = { i: 0, on: false, t0: 0, next: 0, raf: 0 };
function buildRead() {
  // every instrument once, to click
  const l = { div: 1, beats: READ_NOTES.length, count: READ_NOTES.map(() => ''), bars: [{}] };
  READ_NOTES.forEach((r, i) => { l.bars[0][r[0]] = '-'.repeat(i) + 'x' + '-'.repeat(READ_NOTES.length - 1 - i); });
  const box = $('#readKey');
  box.innerHTML = staffSvg(l, [0], 520).replace(/<text class="ts"[^>]*>[^<]*<\/text>/g, '').replace(/<path class="rest"[^>]*\/>/g, '');
  const g = staffGeom(l, 1, 520), svg = box.querySelector('svg');
  READ_NOTES.forEach((r, i) => {
    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    hit.setAttribute('x', g.X(0, i) - g.dx / 2); hit.setAttribute('y', -8); hit.setAttribute('width', g.dx); hit.setAttribute('height', 122);
    hit.setAttribute('class', 'hitbox'); hit.setAttribute('tabindex', 0); hit.setAttribute('role', 'button'); hit.setAttribute('aria-label', PAD[r[0]].name);
    const pick = () => {
      Ear.drum(r[0], Ear.ensureCtx().currentTime + 0.02);
      $('#readInfo').textContent = r[1];
      $('#readInfo').style.color = PAD[r[0]].color;
      svg.querySelectorAll('.hitbox').forEach(e => e.classList.toggle('sel', e === hit));
    };
    hit.onclick = pick;
    hit.onkeydown = (e) => { if (e.key === 'Enter') pick(); };
    svg.appendChild(hit);
  });
  const tabs = $('#readTabs');
  READ_STEPS.forEach((st, i) => {
    const b = document.createElement('button');
    b.className = 'feel' + (i === 0 ? ' active' : '');
    b.textContent = st.title;
    b.onclick = () => { Read.i = i; tabs.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b)); readShow(); if (Read.on) readStart(); };
    tabs.appendChild(b);
  });
  $('#readPlay').onclick = () => (Read.on ? readStop() : readStart());
  readShow();
}
function readShow() {
  const st = READ_STEPS[Read.i];
  $('#readStaff').innerHTML = staffSvg(st.l, [0], 520);
  $('#readSay').textContent = st.say;
}
function readStart() {
  Read.on = true; Read.t0 = Ear.ensureCtx().currentTime + 0.2; Read.next = 0;
  $('#readPlay').textContent = '■ Stop';
  cancelAnimationFrame(Read.raf);
  readFrame();
}
function readStop() {
  Read.on = false;
  cancelAnimationFrame(Read.raf);
  $('#readPlay').textContent = '▶ Play it';
  const c = $('#readStaff .cur');
  if (c) c.style.display = 'none';
}
function readFrame() {
  if (!Read.on) return;
  if (screen !== 'learn') { readStop(); return; }
  const l = READ_STEPS[Read.i].l, ctx = Ear.ctx, bpm = 70, step = 60 / bpm / l.div, steps = 4 * l.div, bar = l.bars[0];
  while (Read.t0 + Read.next * step < ctx.currentTime + 0.15) {
    const k = Read.next++, t = Read.t0 + k * step, i = k % steps;
    if (t < ctx.currentTime) continue;
    if (i % l.div === 0) Ear.click(t, i === 0, 0.2);
    Object.keys(bar).forEach(p => { if (bar[p][i] === 'x') Ear.drum(p, t); });
  }
  const s = (ctx.currentTime - outLat() - Read.t0) / step, c = $('#readStaff .cur');
  if (c && s >= 0) {
    const x = staffGeom(l, 1, 520).X(0, s % steps);
    c.style.display = ''; c.setAttribute('x1', x); c.setAttribute('x2', x);
  }
  Read.raf = requestAnimationFrame(readFrame);
}

// ---------- Start here: the Note quiz ----------
// One written note at a time. The player answers on the pad picture, or on the real pad when it has been taught.
const QUIZ_SETS = [['snare', 'kick', 'hihat'], ['snare', 'kick', 'hihat', 'crash', 'tom1', 'tom3'], READ_NOTES.map(r => r[0])];
const QUIZ_NAMES = ['Easy', 'Medium', 'All 9'];
const QUIZ_LEN = 10;
const Quiz = { on: false, lv: 0, n: 0, score: 0, want: '', tries: 0, last: '', lock: false, timer: 0, deaf: 0, lastT: 0 };
const quizInfo = (pad) => READ_NOTES.find(r => r[0] === pad)[1];
function quizDraw(pad) {
  const l = { div: 1, beats: 3, count: ['', '', ''], bars: [{}] };
  if (pad) l.bars[0][pad] = '-x-';
  $('#quizStaff').innerHTML = staffSvg(l, [0], 260).replace(/<text class="ts"[^>]*>[^<]*<\/text>/g, '').replace(/<path class="rest"[^>]*\/>/g, '');
}
function quizMarks(hint) {
  document.querySelectorAll('#quizPad .spot').forEach(e => e.classList.remove('target'));
  if (hint) SPOTS.filter(s => s.pad === Quiz.want).forEach(s => $('#qz-' + s.key).classList.add('target'));
}
function quizSay(text, color) { const e = $('#quizSay'); e.textContent = text; e.style.color = color || ''; }
function quizScoreUi() {
  $('#quizScore').textContent = Quiz.on || Quiz.n ? '⭐ ' + Quiz.score + ' of ' + Quiz.n : '';
  const best = prof().quiz || [];
  const parts = QUIZ_NAMES.map((nm, i) => best[i] ? nm + ' ' + best[i] + '/' + QUIZ_LEN : '').filter(Boolean);
  $('#quizBest').textContent = parts.length ? 'Your best rounds: ' + parts.join(' · ') : '';
}
function quizAsk() {
  const set = QUIZ_SETS[Quiz.lv];
  let p;
  do { p = set[Math.floor(Math.random() * set.length)]; } while (p === Quiz.last);
  Quiz.want = Quiz.last = p; Quiz.tries = 0; Quiz.lock = false;
  quizDraw(p);
  quizMarks(false);
  quizSay('Note ' + (Quiz.n + 1) + ' of ' + QUIZ_LEN + ': which drum is this?');
}
function quizStart() {
  Quiz.on = true; Quiz.n = 0; Quiz.score = 0; Quiz.last = '';
  $('#quizGo').textContent = '■ Stop';
  Ear.ensureCtx();
  if (calibrated() && !micUserOff) ensureListening();   // the real pad can answer too
  quizScoreUi();
  quizAsk();
}
function quizStop() {
  Quiz.on = false; Quiz.lock = false;
  clearTimeout(Quiz.timer);
  $('#quizGo').textContent = '▶ Start the quiz';
  quizMarks(false);
}
function quizEnd() {
  const s = Quiz.score, stars = s >= QUIZ_LEN ? 3 : s >= 8 ? 2 : s >= 5 ? 1 : 0;
  quizStop();
  const p = prof();
  p.quiz = p.quiz || [];
  if (s > (p.quiz[Quiz.lv] || 0)) { p.quiz[Quiz.lv] = s; saveProf(); }
  quizDraw('');
  quizSay((stars ? '★'.repeat(stars) + ' ' : '') + s + ' of ' + QUIZ_LEN + ' on the first try. ' +
    (stars === 3 ? (Quiz.lv < 2 ? 'Perfect! Try the next level.' : 'Perfect! You can read every drum.') : stars ? 'Well read! Play another round to beat it.' : 'Good start. Tap the drums in the picture to see their notes, then try again.'), stars ? '#1c9d58' : '');
  if (stars === 3) { const t = Ear.ensureCtx().currentTime + 0.05; Ear.drum('crash', t); Ear.drum('kick', t); Quiz.deaf = t + 0.8; }
  quizScoreUi();
}
// pad = the instrument; heard = it came from the real pad (which makes its own sound)
function quizAnswer(pad, heard) {
  const now = Ear.ensureCtx().currentTime;
  if (!heard) { Ear.drum(pad, now + 0.02); Quiz.deaf = now + 0.45; }   // the microphone may hear the app's own drum: ignore it
  if (!Quiz.on) {   // no round running: tapping a drum shows how it is written
    quizDraw(pad);
    quizSay(quizInfo(pad), PAD[pad].color);
    return;
  }
  if (Quiz.lock) return;
  if (pad === Quiz.want) {
    if (Quiz.tries === 0) Quiz.score++;
    Quiz.n++; Quiz.lock = true;
    quizMarks(false);
    SPOTS.filter(s => s.pad === pad).forEach(s => { const e = $('#qz-' + s.key); e.classList.add('flash'); setTimeout(() => e.classList.remove('flash'), 220); });
    quizSay('✓ Yes! ' + quizInfo(pad), '#1c9d58');
    quizScoreUi();
    Quiz.timer = setTimeout(() => (Quiz.n >= QUIZ_LEN ? quizEnd() : quizAsk()), 1400);
  } else {
    Quiz.tries++;
    quizSay('That was the ' + PAD[pad].name + '. Try again!' + (Quiz.tries >= 2 ? ' Look for the pad that glows.' : ''), '#c0392b');
    if (Quiz.tries >= 2) quizMarks(true);
  }
}
function quizAudio(h) {
  if (!Quiz.on || Quiz.lock || !calibrated() || h.time < Quiz.deaf || h.time - Quiz.lastT < 0.2) return;
  Quiz.lastT = h.time;
  const r = Ear.classify(h.feat, { expected: [[Quiz.want]] });
  if (r.click || r.pads.length !== 1) return;
  quizAnswer(r.pads[0], true);
}
function buildQuiz() {
  buildPadMap('#quizPad', 'qz-', (s) => quizAnswer(s.pad, false));
  $('#quizGo').onclick = () => (Quiz.on ? (quizStop(), quizSay('Stopped. Press Start for a new round.')) : quizStart());
  document.querySelectorAll('#quizLevels button').forEach(b => {
    b.onclick = () => {
      Quiz.lv = +b.dataset.lv;
      document.querySelectorAll('#quizLevels button').forEach(x => x.classList.toggle('active', x === b));
      if (Quiz.on) quizStart();
    };
  });
  quizDraw('');
  quizScoreUi();
}

// ---------- Start here: the drum kit you can click ----------
const KIT = {
  crash: ['Crash cymbal', 'A big splash of sound. It marks the start of a new part of the song, usually together with the kick.', 'Lead hand'],
  hihat: ['Hi-hat', 'Two cymbals that close like a clam. It ticks along and keeps the time for the whole band. Foot down: short "tss". Foot up: long "tshhh".', 'Lead hand, with the other foot on its pedal'],
  ride: ['Ride cymbal', 'The big cymbal with a clear "ping". It keeps time like the hi-hat, often in the chorus.', 'Lead hand'],
  snare: ['Snare drum', 'The sharp "crack" in the middle of the kit. In most songs it answers the kick on beats 2 and 4.', 'Other hand in beats, both hands in fills'],
  tom1: ['High tom', 'The smallest tom, with the highest note. The toms are used for fills: runs that join two parts of a song.', 'Both hands, taking turns'],
  tom2: ['Low tom', 'The middle tom. A fill usually travels from high to low: snare, high tom, low tom, floor tom.', 'Both hands, taking turns'],
  tom3: ['Floor tom', 'The deepest tom. It stands on its own legs on the floor, on the right.', 'Both hands, taking turns'],
  kick: ['Bass drum (kick)', 'The deep "boom" you feel in your chest. It is played with a foot pedal and holds the song up from below.', 'Lead foot, on the pedal'],
  hhpedal: ['Hi-hat pedal', 'The pedal under the hi-hat. Pressing it closes the two cymbals with a "chick".', 'Other foot']
};
function buildKit() {
  const P = (id) => PAD[id].color;
  const part = (pad, inner) => '<g class="kpart" data-pad="' + pad + '" tabindex="0" role="button" aria-label="' + KIT[pad][0] + '" style="--c:' + P(pad) + '">' + inner + '</g>';
  const cym = (x, y, rx, tilt) => '<line class="stand" x1="' + x + '" y1="' + y + '" x2="' + x + '" y2="318"/><ellipse class="cym" cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="' + rx * 0.2 + '" transform="rotate(' + tilt + ' ' + x + ' ' + y + ')"/><circle class="bell" cx="' + x + '" cy="' + y + '" r="5"/>';
  const drum = (x, y, rx, h) => '<path class="shell" d="M' + (x - rx) + ' ' + y + 'v' + h + 'a' + rx + ' ' + rx * 0.3 + ' 0 0 0 ' + rx * 2 + ' 0v' + (-h) + '"/><ellipse class="head" cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="' + rx * 0.3 + '"/>';
  $('#kitSvg').innerHTML =
    '<ellipse class="rug" cx="260" cy="316" rx="250" ry="20"/>' +
    part('crash', cym(120, 62, 58, -12)) +
    part('crash', cym(392, 58, 54, 12)) +
    part('ride', cym(466, 132, 62, 16)) +
    part('tom1', '<line class="stand" x1="238" y1="150" x2="250" y2="190"/>' + drum(212, 122, 40, 34)) +
    part('tom2', '<line class="stand" x1="282" y1="150" x2="270" y2="190"/>' + drum(308, 122, 44, 36)) +
    part('kick', '<circle class="head big" cx="260" cy="236" r="74"/><circle class="shell ringo" cx="260" cy="236" r="74"/><rect class="pedal" x="236" y="306" width="48" height="18" rx="5"/>') +
    part('tom3', '<line class="stand" x1="352" y1="262" x2="346" y2="318"/><line class="stand" x1="424" y1="262" x2="430" y2="318"/>' + drum(388, 214, 48, 52)) +
    part('snare', '<line class="stand" x1="150" y1="250" x2="150" y2="318"/>' + drum(150, 214, 46, 26)) +
    part('hihat', '<line class="stand" x1="62" y1="150" x2="62" y2="318"/><ellipse class="cym" cx="62" cy="152" rx="46" ry="8"/><ellipse class="cym" cx="62" cy="161" rx="46" ry="8"/><circle class="bell" cx="62" cy="150" r="4"/>') +
    part('hhpedal', '<rect class="pedal" x="40" y="306" width="46" height="18" rx="5"/>');
  document.querySelectorAll('#kitSvg .kpart').forEach(g => {
    g.onclick = () => kitPick(g.dataset.pad);
    g.onkeydown = (e) => { if (e.key === 'Enter') kitPick(g.dataset.pad); };
  });
}
function kitPick(pad) {
  const ctx = Ear.ensureCtx();
  Ear.drum(pad, ctx.currentTime + 0.02);
  document.querySelectorAll('#kitSvg .kpart').forEach(g => g.classList.toggle('sel', g.dataset.pad === pad));
  $('#kitName').textContent = KIT[pad][0];
  $('#kitName').style.color = PAD[pad].color;
  $('#kitText').textContent = KIT[pad][1];
  const lefty = settings.lefty;
  $('#kitLimb').textContent = '🖐 Played with: ' + KIT[pad][2].replace('Lead hand', lefty ? 'Left hand' : 'Right hand').replace('Other hand', lefty ? 'Right hand' : 'Left hand')
    .replace('Lead foot', lefty ? 'Left foot' : 'Right foot').replace('Other foot', lefty ? 'Right foot' : 'Left foot').replace('the other foot', lefty ? 'the right foot' : 'the left foot');
  SPOTS.forEach(s => {
    const el = $('#pk-' + s.key);
    el.style.setProperty('--lvl', s.pad === pad ? 1 : 0);
    el.classList.toggle('now', s.pad === pad);
    el.classList.toggle('used', s.pad === pad);
  });
  const p = prof();
  p.kit[pad] = 1;
  const seen = Object.keys(KIT).filter(k => p.kit[k]).length, all = Object.keys(KIT).length;
  $('#kitSeen').textContent = seen < all ? 'Explored ' + seen + ' of ' + all + '. Tap them all to earn the Kit explorer badge.' : 'You have explored the whole kit. 🧭 Kit explorer badge earned!';
  if (seen === all) giveBadge('kit');
  saveProf();
}

// ---------- Start here: the rhythm lab ----------
const Lab = { on: false, div: 1, bpm: 80, t0: 0, next: 0, raf: 0 };
const LAB_SAY = {
  1: '4 beat: one hit on every beat. Count "1, 2, 3, 4".',
  2: '8 beat: two hits on every beat. Count "1 and 2 and 3 and 4 and". Most pop and rock songs.',
  3: 'Triplets: three hits on every beat. Count "1 trip let, 2 trip let". Blues and swing.',
  4: '16 beat: four hits on every beat. Count "1 e and a, 2 e and a". Both hands take turns.'
};
function labDots() {
  const box = $('#labDots');
  box.innerHTML = '';
  for (let b = 0; b < 4; b++) {
    const g = document.createElement('div');
    g.className = 'labBeat';
    for (let k = 0; k < Lab.div; k++) {
      const d = document.createElement('span');
      d.className = k === 0 ? 'big' : '';
      d.textContent = k === 0 ? b + 1 : COUNT[Lab.div][k];
      g.appendChild(d);
    }
    box.appendChild(g);
  }
  $('#labSay').textContent = LAB_SAY[Lab.div];
}
function labStart() {
  const ctx = Ear.ensureCtx();
  Lab.on = true; Lab.t0 = ctx.currentTime + 0.15; Lab.next = 0;
  $('#labPlay').textContent = '■ Stop';
  cancelAnimationFrame(Lab.raf);
  labFrame();
}
function labStop() {
  Lab.on = false;
  cancelAnimationFrame(Lab.raf);
  $('#labPlay').textContent = '▶ Play';
  document.querySelectorAll('#labDots span.lit').forEach(e => e.classList.remove('lit'));
}
function labFrame() {
  if (!Lab.on) return;
  if (screen !== 'learn') { labStop(); return; }
  const ctx = Ear.ctx, step = 60 / Lab.bpm / Lab.div;
  while (Lab.t0 + Lab.next * step < ctx.currentTime + 0.15) {
    const k = Lab.next++, t = Lab.t0 + k * step;
    if (t < ctx.currentTime) continue;
    if (k % Lab.div === 0) Ear.click(t, k % (4 * Lab.div) === 0, 0.25);
    Ear.drum('hihat', t);
  }
  const cur = Math.floor((ctx.currentTime - outLat() - Lab.t0) / step);
  const dots = document.querySelectorAll('#labDots span'), n = 4 * Lab.div;
  dots.forEach((e, i) => e.classList.toggle('lit', cur >= 0 && i === ((cur % n) + n) % n));
  Lab.raf = requestAnimationFrame(labFrame);
}
function buildLab() {
  labDots();
  $('#labTempoWord').textContent = '(' + tempoWord(Lab.bpm) + ')';
  $('#labPlay').onclick = () => (Lab.on ? labStop() : labStart());
  $('#labTempo').oninput = () => {
    const was = Lab.on;
    Lab.bpm = +$('#labTempo').value;
    $('#labTempoTxt').textContent = Lab.bpm;
    $('#labTempoWord').textContent = '(' + tempoWord(Lab.bpm) + ')';
    if (was) labStart();
  };
  document.querySelectorAll('#labFeels .feel').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('#labFeels .feel').forEach(x => x.classList.toggle('active', x === b));
      Lab.div = +b.dataset.div;
      labDots();
      if (Lab.on) labStart();
    };
  });
}

// ---------- Basics: the beat maker ----------
// A grid of squares, one row for each drum and one column for each step of the bar. Tap squares to build a beat,
// hear it, and then practise it on the pad like any lesson.
const BEAT_ROWS = ['crash', 'ride', 'hihat', 'tom1', 'tom3', 'snare', 'kick'];
const BEAT_HANDS = { crash: 1, ride: 1, hihat: 1, tom1: 1, tom3: 1, snare: 1 };   // played with a stick: two at most at one moment
const BEAT_READY = {
  'Rock': { div: 2, rows: { hihat: 'xxxxxxxx', snare: '--x---x-', kick: 'x---x---' } },
  'Boom tap': { div: 2, rows: { snare: '--x---x-', kick: 'x---x---' } },
  'Busy kick': { div: 2, rows: { hihat: 'xxxxxxxx', snare: '--x---x-', kick: 'x--xx---' } },
  'Disco': { div: 4, rows: { hihat: '--x---x---x---x-', snare: '----x-------x---', kick: 'x---x---x---x---' } },
  'Tom run': { div: 2, rows: { hihat: 'xxxx----', snare: '--x-----', kick: 'x---x---', tom1: '----xx--', tom3: '------xx' } }
};
const Beat = { on: false, div: 2, bpm: 90, rows: {}, t0: 0, next: 0, raf: 0 };
const beatSteps = () => 4 * Beat.div;
const beatRow = (pad) => { const s = Beat.rows[pad] || ''; return (s + '-'.repeat(beatSteps())).slice(0, beatSteps()); };
function beatSave() { store.set('beat', { div: Beat.div, bpm: Beat.bpm, rows: Beat.rows }); }
function beatLoad(b) {
  Beat.div = b.div === 4 ? 4 : 2;
  if (b.bpm) Beat.bpm = Math.max(50, Math.min(140, b.bpm));
  Beat.rows = {};
  BEAT_ROWS.forEach(p => { if (b.rows && b.rows[p] && b.rows[p].indexOf('x') >= 0) Beat.rows[p] = b.rows[p]; });
}
function beatSay(text) { $('#bmSay').textContent = text || ''; }
function beatGrid() {
  const box = $('#bmGrid'), n = beatSteps();
  box.innerHTML = '';
  box.style.setProperty('--n', n);
  BEAT_ROWS.forEach(pad => {
    const name = document.createElement('span');
    name.className = 'bmName'; name.textContent = PAD[pad].name;
    name.style.setProperty('--c', PAD[pad].color);
    box.appendChild(name);
    const row = beatRow(pad);
    for (let i = 0; i < n; i++) {
      const b = document.createElement('button');
      b.className = 'bmCell' + (row[i] === 'x' ? ' on' : '') + (i % Beat.div === 0 ? ' beat' : '');
      b.dataset.i = i;
      b.style.setProperty('--c', PAD[pad].color);
      b.textContent = i % Beat.div === 0 ? i / Beat.div + 1 : '';
      b.setAttribute('aria-label', PAD[pad].name + ', step ' + (i + 1));
      b.onclick = () => beatTap(pad, i);
      box.appendChild(b);
    }
  });
  $('#bmSteps').textContent = Beat.div === 2 ? '8 squares' : '16 squares';
  $('#bmTempo').value = Beat.bpm; $('#bmTempoTxt').textContent = Beat.bpm;
}
function beatTap(pad, i) {
  const row = beatRow(pad).split(''), on = row[i] !== 'x';
  if (on && BEAT_HANDS[pad]) {
    const hands = BEAT_ROWS.filter(p => p !== pad && BEAT_HANDS[p] && beatRow(p)[i] === 'x').length;
    if (hands >= 2) { beatSay('Two hands can hit only two drums at the same moment. Take one away first.'); return; }
  }
  row[i] = on ? 'x' : '-';
  if (row.indexOf('x') >= 0) Beat.rows[pad] = row.join(''); else delete Beat.rows[pad];
  if (on) Ear.drum(pad, Ear.ensureCtx().currentTime + 0.01);
  beatSay('');
  beatSave(); beatGrid();
}
function beatStart() {
  const ctx = Ear.ensureCtx();
  Beat.on = true; Beat.t0 = ctx.currentTime + 0.12; Beat.next = 0;
  $('#bmPlay').textContent = '■ Stop';
  cancelAnimationFrame(Beat.raf);
  beatFrame();
}
function beatStop() {
  Beat.on = false;
  cancelAnimationFrame(Beat.raf);
  $('#bmPlay').textContent = '▶ Play';
  Beat.col = -2;
  document.querySelectorAll('#bmGrid .now').forEach(e => e.classList.remove('now'));
}
function beatFrame() {
  if (!Beat.on) return;
  if (screen !== 'learn') { beatStop(); return; }
  const ctx = Ear.ctx, step = 60 / Beat.bpm / Beat.div, n = beatSteps();
  while (Beat.t0 + Beat.next * step < ctx.currentTime + 0.15) {
    const k = Beat.next++, t = Beat.t0 + k * step;
    if (t < ctx.currentTime) continue;
    BEAT_ROWS.forEach(p => { if (beatRow(p)[k % n] === 'x') Ear.drum(p, t); });
  }
  const cur = Math.floor((ctx.currentTime - outLat() - Beat.t0) / step);
  const col = cur < 0 ? -1 : cur % n;
  if (col !== Beat.col) {
    Beat.col = col;
    document.querySelectorAll('#bmGrid .bmCell').forEach(e => e.classList.toggle('now', +e.dataset.i === col));
  }
  Beat.raf = requestAnimationFrame(beatFrame);
}
// The beat as a lesson: the same bar again and again, for about a minute.
function beatLesson() {
  const bar = {};
  BEAT_ROWS.forEach(p => { if (Beat.rows[p]) bar[p] = beatRow(p); });
  if (!Object.keys(bar).length) return null;
  const reps = Math.max(8, Math.round(Beat.bpm / 4 / 4) * 4);
  return { id: 'beat', custom: true, title: 'My beat', bpm: Beat.bpm, div: Beat.div, reps, reps0: 8, bars: [bar],
    goal: 'The beat you built in the Beat maker.',
    tip: 'Start slow. If it falls apart, switch on Wait mode and learn the order first. Go back to Basics to change the beat.' };
}
function buildBeat() {
  beatLoad(store.get('beat', null) || Object.assign({ bpm: 90 }, BEAT_READY.Rock));
  beatGrid();
  const ready = $('#bmReady');
  Object.keys(BEAT_READY).forEach(name => {
    const b = document.createElement('button');
    b.textContent = name;
    b.onclick = () => { beatLoad(Object.assign({ bpm: Beat.bpm }, BEAT_READY[name])); beatSay(''); beatSave(); beatGrid(); if (Beat.on) beatStart(); };
    ready.appendChild(b);
  });
  $('#bmPlay').onclick = () => (Beat.on ? beatStop() : beatStart());
  $('#bmTempo').oninput = () => { Beat.bpm = +$('#bmTempo').value; $('#bmTempoTxt').textContent = Beat.bpm; beatSave(); if (Beat.on) beatStart(); };
  $('#bmSteps').onclick = () => {
    // 8 squares <-> 16 squares: the beat stays the same, only the grid gets finer or coarser
    const to = Beat.div === 2 ? 4 : 2;
    Object.keys(Beat.rows).forEach(p => {
      const r = beatRow(p);
      let out = '';
      if (to === 4) for (let i = 0; i < r.length; i++) out += r[i] + '-';
      else for (let i = 0; i < r.length; i += 2) out += r[i] === 'x' || r[i + 1] === 'x' ? 'x' : '-';
      if (out.indexOf('x') >= 0) Beat.rows[p] = out; else delete Beat.rows[p];
    });
    Beat.div = to;
    beatSave(); beatGrid(); if (Beat.on) beatStart();
  };
  $('#bmClear').onclick = () => { Beat.rows = {}; beatSay(''); beatSave(); beatGrid(); };
  $('#bmGo').onclick = () => {
    const l = beatLesson();
    if (!l) { beatSay('Tap some squares first.'); return; }
    beatStop();
    openCustom(l);
  };
}

// ---------- Celebration ----------
function fanfare(stars) {
  const ctx = Ear.ensureCtx(), t = ctx.currentTime + 0.05;
  const notes = stars >= 3 ? [523, 659, 784, 1047] : stars === 2 ? [523, 659, 784] : [523, 659];
  notes.forEach((f, i) => Ear.tone(f, t + i * 0.13, i === notes.length - 1 ? 0.5 : 0.14, 0.2));
}
let confettiRun = 0;
function confetti(ms) {
  const cv = $('#confetti');
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const run = ++confettiRun, w = cv.width = innerWidth, h = cv.height = innerHeight, c = cv.getContext('2d');
  const cols = ['#f2c94c', '#eb5757', '#56ccf2', '#6fcf97', '#bb6bd9', '#f2994a'];
  const bits = [];
  for (let i = 0; i < 140; i++) bits.push({ x: Math.random() * w, y: -20 - Math.random() * h * 0.5, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4, r: 4 + Math.random() * 5, a: Math.random() * 6.28, col: cols[i % cols.length] });
  cv.classList.remove('hidden');
  const t0 = performance.now();
  (function tick() {
    const el = performance.now() - t0;
    if (run !== confettiRun || el > ms) { if (run === confettiRun) cv.classList.add('hidden'); return; }
    c.clearRect(0, 0, w, h);
    c.globalAlpha = Math.min(1, (ms - el) / 500);
    bits.forEach(b => {
      b.x += b.vx; b.y += b.vy; b.a += 0.1;
      c.save(); c.translate(b.x, b.y); c.rotate(b.a); c.fillStyle = b.col; c.fillRect(-b.r, -b.r / 2, b.r * 2, b.r); c.restore();
    });
    requestAnimationFrame(tick);
  })();
}

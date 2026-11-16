'use strict';
// Accounts, saved progress, friends and messages. Loaded before app.js; everything here runs later.
// A player on this device can be joined to one online account (nickname and PIN). Stars, rank and badges are then
// saved online after every change, so another device shows the same. Photos never leave the device.

const Online = {
  // The first screen is always "log in or ask for an account": nothing else opens without an approved account.
  // A device that was logged in keeps working without internet until the account is paused or runs out.
  gate: true,
  ses: null, timer: null, dirty: false, sending: false, fr: null, msgs: [], skipped: false,
  home() { const p = prof(); return p.name && (p.av || p.photo) ? 'hub' : 'me'; },   // a new player builds a drummer first
  ok() { return !!(this.ses && this.ses.status === 'active' && !this.ses.expired && !this.ses.must_change); },
  blocked() { return this.gate && !this.ok(); },
  keep() { store.set('session', this.ses); },
  // The player's name in the app is the nickname they log in with: one name, nothing to mix up.
  syncName() {
    if (!this.ses || !this.ses.nick) return;
    const p = prof();
    if (p.name !== this.ses.nick) { p.name = this.ses.nick; saveProf(); if (typeof renderHeader === 'function') renderHeader(); }
  },
  err(code) {
    return ({ nick: 'A nickname has 3 to 16 small letters or numbers.', pin: 'A PIN has at least 4 numbers or letters.', taken: 'That nickname is taken. Try another one.',
      join: 'That join code is not right. Ask the grown-up who looks after Daily Drum.', full: 'Too many accounts are waiting. Try again later.',
      wrong: 'The nickname or the PIN is not right.', locked: 'Too many wrong tries. Wait ten minutes, or ask the grown-up for a new PIN.',
      code: 'No player has that friend code. Check it and try again.', self: 'That is your own code. Give it to a friend!', many: 'You have a lot of friends already. Remove one first.',
      oldpin: 'That is not the PIN you have now. Check it and try again.', same: 'Pick a new PIN that is different from the old one.',
      word: 'A secret word has 3 to 40 letters.', wrongword: 'The nickname or the secret word is not right. Check both and try again.',
      auth: 'You are logged out. Log in again.' })[code] || 'That did not work. Check the internet and try again.';
  },

  // A clear "please wait" over the whole page, so a slow connection never looks like nothing is happening.
  load(text) { $('#loadingTxt').textContent = text || 'Loading…'; $('#loading').classList.remove('hidden'); },
  unload() { $('#loading').classList.add('hidden'); },
  async init() {
    this.ses = store.get('session', null);
    this.wire();
    if (this.ok()) this.syncName();
    if (this.ses) {
      this.load('Getting your drums ready…');
      await Promise.race([this.refresh(true), new Promise(r => setTimeout(r, 7000))]);   // no internet: do not wait for ever
      this.unload();
    }
  },
  // Ask the server who we are. Also brings messages, and (once, when the app opens) newer saved progress.
  async refresh(first) {
    if (!this.ses) return;
    const wasBlocked = this.blocked();
    let me;
    try { me = await Net.rpc('dd_me', { p_token: this.ses.token }); } catch (e) { return; }   // no internet: carry on with what we knew
    if (!me.ok) {   // the account was removed or paused, or the login is too old
      const wasActive = this.ses.status === 'active';
      this.ses = wasActive ? Object.assign(this.ses, { status: 'out' }) : null;
      if (this.ses) this.keep(); else store.del('session');
      this.after();
      return;
    }
    Object.assign(this.ses, { nick: me.nick, status: me.status, expired: !!me.expired, expires_at: me.expires_at || null, must_change: !!me.must_change, friend_code: me.friend_code || this.ses.friend_code, requests: me.requests || 0, has_word: me.has_word !== false });
    this.keep();
    this.syncName();
    this.msgs = me.messages || [];
    if (this.ok()) {
      if (first && me.data_at && me.data_at !== this.ses.dataAt && !this.dirty) { await this.pull(); return; }
      if (!me.data_at) this.push();
      else if (this.ses.sumV !== 2 && !this.dirty) { this.ses.sumV = 2; this.keep(); this.push(); }   // once: save the fuller summary that the friend card shows
      if (wasBlocked && screen === 'account') { show(Online.home()); return; }   // the grown-up said yes: straight in
    }
    this.after();
  },
  // The screens that depend on the account are drawn again.
  after() {
    this.badge();
    document.body.classList.toggle('locked', this.blocked());
    if (this.blocked() && screen !== 'account') show('account');
    else if (screen === 'account') this.renderAccount();
    else if (screen === 'friends') this.renderFriends();
    else if (screen === 'hub') this.renderMsgs();
  },
  badge() {
    const n = this.ok() ? (this.ses.requests || 0) : 0;
    $('#navFriends .tx').textContent = 'Friends' + (n ? ' (' + n + ')' : '');
  },

  // ----- saving and loading progress -----
  summary() {
    const p = prof(), rk = rankOf(p.xp);
    return { xp: p.xp, rank: rk.name, icon: rk.icon, stars: LESSONS.reduce((a, l) => a + (progress[l.id] ? progress[l.id].stars || 0 : 0), 0),
      badges: Object.keys(p.badges || {}).length, streak: liveStreak(), stops: VENUES.filter((v, k) => Tour.gigWon(k)).length, level: p.level === 'pro' ? 'Pro' : 'Rookie',
      // for the friend card: which badges, how far through the course, the longest run of right notes
      bl: Object.keys(p.badges || {}), done: this.lessonCount(1), three: this.lessonCount(3), of: LESSONS.filter(l => !l.song).length,
      combo: p.bestCombo || 0, best: Math.max(p.maxStreak || 0, liveStreak()), at: this.courseAt() };
  },
  lessonCount(stars) { return LESSONS.filter(l => !l.song && progress[l.id] && (progress[l.id].stars || 0) >= stars).length; },
  // The course level the player is working on: the level of the first lesson without two stars.
  courseAt() {
    const l = LESSONS.find(x => !x.song && !(progress[x.id] && progress[x.id].stars >= 2));
    return l && COURSE[l.lv] ? COURSE[l.lv].name : 'Course finished';
  },
  touch() {   // something was earned: save it online in a moment
    if (!this.ok()) return;
    this.dirty = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.push(), 4000);
  },
  async push() {
    if (!this.ok() || this.sending) return;
    // The stars on this device belong to another account (someone else has just logged in here): never save them into this one.
    if (prof().acct && String(prof().acct).toLowerCase() !== String(this.ses.nick).toLowerCase()) return;
    clearTimeout(this.timer);
    this.sending = true; this.dirty = false;
    const p = Object.assign({}, prof());
    delete p.photo;   // a photo stays on the device
    try {
      const r = await Net.rpc('dd_save', { p_token: this.ses.token, p_data: { progress, profile: p, history: hist() }, p_summary: this.summary(), p_profile: { av: avOf(p) } });
      if (r.ok) { this.ses.dataAt = r.data_at; this.keep(); } else if (r.error === 'auth') this.refresh(false);
    } catch (e) { this.dirty = true; }
    this.sending = false;
  },
  async pull() {
    const r = await Net.rpc('dd_load', { p_token: this.ses.token });
    if (r.ok && r.data) this.apply(r.data, r.data_at);
  },
  // Put progress from the account onto this device, then start the app again with it.
  apply(data, at) {
    const photo = prof().photo, p = Object.assign({}, data.profile || {}, { acct: this.ses.nick });
    if (photo) p.photo = photo;
    if (!p.name) p.name = this.ses.nick;
    try {
      localStorage.setItem(keyOf('progress'), JSON.stringify(data.progress || {}));
      localStorage.setItem(keyOf('profile'), JSON.stringify(p));
      localStorage.setItem(keyOf('history'), JSON.stringify(data.history || {}));
    } catch (e) {}
    this.ses.dataAt = at; this.keep();
    this.load('Loading your stars…');
    location.reload();
  },

  // This device held another account's stars (safely saved online): start this account with a clean slate.
  fresh() {
    try {
      localStorage.removeItem(keyOf('progress')); localStorage.removeItem(keyOf('history'));
      localStorage.setItem(keyOf('profile'), JSON.stringify({ name: this.ses.nick, acct: this.ses.nick }));
    } catch (e) {}
    this.load('Getting your drums ready…');
    location.reload();
  },

  // ----- logging in and out -----
  async login(nick, pin) {
    const r = await Net.rpc('dd_login', { p_nick: nick, p_pin: pin });
    if (!r.ok) return this.err(r.error);
    this.ses = { token: r.token, nick: r.nick, status: r.status, must_change: !!r.must_change };
    this.keep();
    await this.refresh(false);
    if (!this.ok()) return '';
    try { sessionStorage.setItem('dd.justIn', '1'); } catch (e) {}   // every login opens "This is me today"
    const cloud = await Net.rpc('dd_load', { p_token: this.ses.token });
    const mine = String(prof().acct || '').toLowerCase() === String(this.ses.nick || '').toLowerCase(), has = Object.keys(progress).length > 0 || prof().xp > 0;
    // linked: the stars on this device already belong to an account (they were saved there when that player logged out),
    // so another player logging in simply gets their own; nothing is asked and nothing is mixed.
    const linked = !!prof().acct;
    if (cloud.ok && cloud.data) {
      if (has && !mine && !linked && !confirm('This device already has stars for "' + (prof().name || 'this player') + '".\n\nOK = use the stars saved in the account "' + this.ses.nick + '" (the stars on this device are replaced).\nCancel = keep the stars on this device and save them to the account.')) {
        prof().acct = this.ses.nick; saveProf(); await this.push();
      } else { this.apply(cloud.data, cloud.data_at); return ''; }
    } else {
      if (linked && !mine) { this.fresh(); return ''; }   // another player's stars are on this device: this account starts empty
      const p = prof(); p.acct = this.ses.nick; p.name = this.ses.nick;
      saveProf(); await this.push();
    }
    try { sessionStorage.removeItem('dd.justIn'); } catch (e) {}
    show('me');
    return '';
  },
  async signup(nick, pin, join, word) {
    const r = await Net.rpc('dd_signup', { p_nick: nick, p_pin: pin, p_join: join || null, p_word: word || null });
    if (!r.ok) return this.err(r.error);
    this.ses = { token: r.token, nick: r.nick, status: r.status, has_word: !!word };
    this.keep();
    if (prof().acct && String(prof().acct).toLowerCase() !== String(r.nick).toLowerCase()) { this.fresh(); return ''; }   // a new account never inherits another player's stars
    const p = prof(); p.name = r.nick; saveProf();
    this.after();
    return '';
  },
  async logout() {
    const t = this.ses && this.ses.token;
    this.load('Saving your stars and logging out…');
    if (this.ok()) await this.push();
    this.unload();
    this.ses = null; this.msgs = []; this.fr = null;
    store.del('session');
    if (t) Net.rpc('dd_logout', { p_token: t }).catch(() => {});
    this.badge();
    show('account');
  },

  // ----- the account screen -----
  renderAccount() {
    // 'newpin' = the grown-up set a temporary PIN: before anything else the player chooses a PIN of their own.
    const s = this.ses, st = !s ? 'out' : s.status === 'pending' ? 'wait' : this.ok() ? 'in' : (s.status === 'active' && s.must_change && !s.expired) ? 'newpin' : 'stop';
    const pin = st === 'newpin' || (st === 'in' && this.pinOpen);
    $('#acPin').classList.toggle('hidden', !pin);
    if (pin) {
      $('#acPinTitle').textContent = st === 'newpin' ? '🔑 Hi ' + s.nick + '! Choose your own new PIN' : 'Change my PIN';
      $('#acPinTxt').textContent = st === 'newpin' ? 'You logged in with the PIN the grown-up gave you. Now pick a new one that only you know.' : 'Type the PIN you use now, then the new one twice.';
      $('#acPinOldLbl').textContent = st === 'newpin' ? 'The PIN the grown-up gave you' : 'The PIN I use now';
      $('#acPinCancel').classList.toggle('hidden', st === 'newpin');
      $('#acPinOut').classList.toggle('hidden', st !== 'newpin');
    }
    $('#acOut').classList.toggle('hidden', st !== 'out');
    $('#acWait').classList.toggle('hidden', st !== 'wait' && st !== 'stop');
    $('#acIn').classList.toggle('hidden', st !== 'in' || !!this.pinOpen);
    document.body.classList.toggle('locked', this.blocked());
    // A player who has logged in on this device before only types the PIN: the nickname is filled in already.
    const known = st === 'out' ? String(prof().acct || '').toLowerCase() : '';
    if (known && !$('#acNickIn').value) $('#acNickIn').value = known;
    $('#acTitle').textContent = st !== 'out' ? 'Your Daily Drum account' : known ? 'Welcome back, ' + known + '!' : 'Welcome to Daily Drum!';
    if (st === 'wait') {
      $('#acWaitTitle').textContent = '⏳ Hi ' + s.nick + '! Your account is waiting for a grown-up to say yes.';
      $('#acWaitTxt').textContent = 'Ask the grown-up who looks after Daily Drum to approve "' + s.nick + '". Then press "Check again".';
    } else if (st === 'stop') {
      $('#acWaitTitle').textContent = s.expired ? '⌛ The time on the account "' + s.nick + '" has run out.' : s.status === 'out' ? '🔑 You need to log in again.' : '⏸ The account "' + s.nick + '" is paused.';
      $('#acWaitTxt').textContent = s.status === 'out' ? 'Press "Log out", then log in with your nickname and PIN.' : 'Ask the grown-up who looks after Daily Drum to switch it on again. Your stars are safe.';
    } else if (st === 'in') {
      $('#acNick').textContent = s.nick;
      $('#acCode').textContent = s.friend_code || '';
      $('#acFace').innerHTML = faceHtml(prof(), false);
      $('#acValid').textContent = s.expires_at ? 'Works until ' + new Date(s.expires_at).toLocaleDateString() : 'No time limit';
      $('#acSaved').textContent = s.dataAt ? new Date(s.dataAt).toLocaleString() : 'Not yet';
      $('#acMsgs').textContent = '📬 My messages' + (this.msgs.length ? ' (' + this.msgs.length + ' new)' : '');
      const hw = s.has_word !== false;
      $('#acWordState').textContent = hw ? '✅ Set' : '⚠️ Not set yet';
      $('#acWordOpen').textContent = hw ? 'Change it' : 'Set my secret word';
    }
  },
  // All messages, read and unread, on the account screen.
  async renderInbox() {
    const box = $('#acInboxList');
    if (!this.ok()) { box.innerHTML = '<p class="muted">Log in to see your messages.</p>'; return; }
    box.innerHTML = '<p class="muted">Loading…</p>';
    let r;
    try { r = await Net.rpc('dd_inbox', { p_token: this.ses.token }); } catch (e) { box.innerHTML = '<p class="muted">The messages could not be loaded. Check the internet.</p>'; return; }
    if (!r.ok) return;
    box.innerHTML = r.messages.length ? '' : '<p class="muted">No messages yet.</p>';
    r.messages.forEach(m => {
      const d = document.createElement('div');
      d.className = 'frRow inbox' + (m.read ? '' : ' new');
      d.innerHTML = '<span class="who"><b></b><span class="small muted"></span></span>';
      d.querySelector('b').textContent = m.body;
      d.querySelector('.who span').textContent = new Date(m.at).toLocaleString() + ' · ' + (m.all ? 'to everyone' : 'just for you') + (m.read ? '' : ' · new');
      box.appendChild(d);
      if (!m.read) Net.rpc('dd_msg_read', { p_token: this.ses.token, p_id: m.id }).catch(() => {});   // seen here counts as read
    });
    this.msgs = [];
    $('#hubInbox').textContent = '📬 Messages';
  },
  renderMsgs() {
    const box = $('#hubMsgs');
    box.innerHTML = '';
    $('#hubInbox').textContent = '📬 Messages' + (this.ok() && this.msgs.length ? ' (' + this.msgs.length + ' new)' : '');
    if (!this.ok()) return;
    this.msgs.forEach(m => {
      const d = document.createElement('div');
      d.className = 'banner msg';
      d.innerHTML = '<div><strong>📣 Message for ' + (m.all ? 'everyone' : 'you') + ':</strong> <span></span></div><button class="primary">OK</button>';
      d.querySelector('span').textContent = m.body;
      d.querySelector('button').onclick = () => {
        this.msgs = this.msgs.filter(x => x.id !== m.id); d.remove();
        Net.rpc('dd_msg_read', { p_token: this.ses.token, p_id: m.id }).catch(() => {});
      };
      box.appendChild(d);
    });
  },

  // ----- friends -----
  async renderFriends() {
    const on = this.ok();
    $('#frOut').classList.toggle('hidden', on);
    $('#frIn').classList.toggle('hidden', !on);
    if (!on) return;
    $('#frCode').textContent = this.ses.friend_code || '';
    let r;
    try { r = await Net.rpc('dd_friends', { p_token: this.ses.token }); } catch (e) { $('#frMsg').textContent = this.err(); return; }
    if (!r.ok) { this.refresh(false); return; }
    this.fr = r;
    this.ses.requests = r.incoming.length; this.keep(); this.badge();
    const face = (profile) => avatarSvg(avOf({ av: (profile || {}).av }), false);
    const inc = $('#frIncoming');
    inc.innerHTML = '';
    $('#frIncomingBox').classList.toggle('hidden', !r.incoming.length);
    r.incoming.forEach(f => {
      const d = document.createElement('div');
      d.className = 'frRow';
      d.innerHTML = '<span class="face"></span><b></b><span class="muted small">wants to be your friend</span><button class="primary">Yes, friends</button><button>No thanks</button>';
      d.firstChild.innerHTML = face(f.profile);
      d.querySelector('b').textContent = f.nick;
      const btn = d.querySelectorAll('button');
      btn[0].onclick = () => this.answer(f.id, true);
      btn[1].onclick = () => this.answer(f.id, false);
      inc.appendChild(d);
    });
    $('#frOutgoing').textContent = r.outgoing.length ? 'Waiting for an answer from: ' + r.outgoing.map(o => o.nick).join(', ') + '.' : '';
    // The board: me and my friends, most rank points first.
    const rows = r.friends.concat([Object.assign({ me: true }, r.me, { summary: this.summary(), profile: { av: avOf(prof()) } })])
      .sort((a, b) => ((b.summary || {}).xp || 0) - ((a.summary || {}).xp || 0));
    const board = $('#frBoard');
    board.innerHTML = '';
    rows.forEach((f, i) => {
      const s = f.summary || {}, d = document.createElement('div');
      d.className = 'frRow board' + (f.me ? ' me' : '');
      d.innerHTML = '<span class="pos"></span><span class="face"></span><span class="who"><b></b><span class="small muted"></span></span><span class="pts"></span><span class="small stats"></span>';
      d.querySelector('.pos').textContent = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.';
      d.querySelector('.face').innerHTML = face(f.profile);
      d.querySelector('b').textContent = f.nick + (f.me ? ' (you)' : '');
      d.querySelector('.who span').textContent = (s.icon || '🥁') + ' ' + (s.rank || 'Beginner Tapper') + ' · ' + (s.level || 'Rookie');
      d.querySelector('.pts').textContent = (s.xp || 0) + ' points';
      d.querySelector('.stats').textContent = '⭐ ' + (s.stars || 0) + '   🎖 ' + (s.badges || 0) + '   🔥 ' + (s.streak || 0) + '   🚌 ' + (s.stops || 0) + '/7';
      d.setAttribute('role', 'button'); d.setAttribute('tabindex', '0');
      d.title = f.me ? 'Open my card' : 'Open ' + f.nick + '\'s card';
      d.onclick = () => this.friendCard(f, rows.find(q => q.me));
      d.onkeydown = (e) => { if (e.key === 'Enter') d.click(); };
      const more = document.createElement('span');
      more.className = 'frMore'; more.textContent = '›';
      d.appendChild(more);
      if (!f.me) {
        const x = document.createElement('button');
        x.className = 'frX'; x.textContent = '✕'; x.title = 'Stop being friends with ' + f.nick;
        x.onclick = (e) => { e.stopPropagation(); if (!x.dataset.sure) { x.dataset.sure = '1'; x.textContent = 'Remove?'; setTimeout(() => { delete x.dataset.sure; x.textContent = '✕'; }, 3000); return; } this.answer(f.id, false); };
        d.appendChild(x);
      }
      board.appendChild(d);
    });
    $('#frEmpty').classList.toggle('hidden', r.friends.length > 0);
  },
  // ----- the friend card: one friend, a little closer -----
  // Shows only what the summary holds: the drummer, rank, points, stars, badges, days in a row, Tour stops, how far
  // through the course. No practice times, no lesson-by-lesson results, and no way to write to each other.
  friendCard(f, me) {
    const s = f.summary || {}, box = $('#frCard'), mine = (me && me.summary) || {};
    const rk = rankOf(s.xp || 0), num = (v) => (v === undefined || v === null ? '–' : v);
    const seen = (() => {
      if (f.me) return '';
      if (!f.last_seen) return 'Has not played yet';
      const d = Math.floor((Date.now() - new Date(f.last_seen).getTime()) / 86400000);
      return d <= 0 ? 'Played today' : d === 1 ? 'Played yesterday' : d < 14 ? 'Played ' + d + ' days ago' : 'Has not played for a while';
    })();
    const tiles = [['⭐', num(s.stars), 'stars'], ['🎖', num(s.badges), 'badges'], ['🔥', num(s.streak), 'days in a row'], ['🚌', num(s.stops) + '/7', 'Tour stops'],
      ['🎓', s.done === undefined ? '–' : s.done + (s.of ? '/' + s.of : ''), 'lessons played'], ['🌟', num(s.three), 'with 3 stars'], ['🔗', num(s.combo), 'best run of notes'], ['📅', num(s.best), 'longest streak']];
    const badgeList = (s.bl || []).map(id => BADGES.find(b => b.id === id)).filter(Boolean);
    const bar = (label, a, b) => {
      const top = Math.max(1, a || 0, b || 0);
      return '<div class="fcCmp"><span class="fcCmpL">' + label + '</span><div class="fcBars"><div class="fcBar you"><i style="width:' + Math.round(100 * (a || 0) / top) + '%"></i><b>' + (a || 0) + '</b></div><div class="fcBar them"><i style="width:' + Math.round(100 * (b || 0) / top) + '%"></i><b>' + (b || 0) + '</b></div></div></div>';
    };
    box.innerHTML = '<div class="fcIn" role="document">' +
      '<button class="fcClose" aria-label="Close">✕</button>' +
      '<div class="fcLeft"><div class="face big fcFace"></div><div class="fcName"></div><div class="fcRank"></div><div class="fcXp"><i></i></div><div class="fcPts"></div><div class="fcSeen muted small"></div></div>' +
      '<div class="fcRight"><div class="fcAt"></div><div class="fcTiles">' + tiles.map(t => '<div class="fcTile"><span class="fi">' + t[0] + '</span><b>' + t[1] + '</b><span class="fl">' + t[2] + '</span></div>').join('') + '</div>' +
      '<div class="fcBadges"><span class="fcHead"></span><div class="fcBadgeRow hscroll"></div></div>' +
      (f.me ? '' : '<div class="fcVs"><span class="fcHead">You and <span class="fcN2"></span></span><div class="fcLegend"><span class="you">you</span><span class="them fcN3"></span></div>' + bar('Points', mine.xp, s.xp) + bar('Stars', mine.stars, s.stars) + bar('Badges', mine.badges, s.badges) + '</div>') +
      '</div></div>';
    box.querySelector('.fcFace').innerHTML = avatarSvg(avOf({ av: (f.profile || {}).av }), false);
    box.querySelector('.fcName').textContent = f.nick + (f.me ? ' (you)' : '');
    box.querySelector('.fcRank').textContent = (s.icon || rk.icon) + ' ' + (s.rank || rk.name) + ' · ' + (s.level || 'Rookie');
    box.querySelector('.fcXp i').style.width = (rk.hi ? Math.max(4, Math.round(100 * ((s.xp || 0) - rk.lo) / (rk.hi - rk.lo))) : 100) + '%';
    box.querySelector('.fcPts').textContent = (s.xp || 0) + ' points' + (rk.hi ? ' · ' + (rk.hi - (s.xp || 0)) + ' to ' + RANKS[rk.k + 1][1] : '');
    box.querySelector('.fcSeen').textContent = seen;
    box.querySelector('.fcAt').textContent = s.at ? '🎵 Working on: ' + s.at : '';
    box.querySelector('.fcHead').textContent = badgeList.length ? 'Badges earned (' + badgeList.length + ')' : s.bl ? 'No badges yet' : 'Badges: ' + num(s.badges);
    const row = box.querySelector('.fcBadgeRow');
    badgeList.forEach(b => { const e = document.createElement('span'); e.className = 'fcBadge'; e.innerHTML = '<i></i><span></span>'; e.firstChild.textContent = b.icon; e.lastChild.textContent = b.name; e.title = b.how; row.appendChild(e); });
    if (!f.me) { box.querySelector('.fcN2').textContent = f.nick; box.querySelector('.fcN3').textContent = f.nick; }
    const close = () => { box.classList.add('hidden'); box.innerHTML = ''; document.removeEventListener('keydown', esc); };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', esc);
    box.onclick = (e) => { if (e.target === box) close(); };
    box.querySelector('.fcClose').onclick = close;
    box.classList.remove('hidden');
    box.querySelector('.fcClose').focus();
  },
  async answer(id, yes) {
    try { await Net.rpc('dd_friend_answer', { p_token: this.ses.token, p_user: id, p_accept: yes }); } catch (e) {}
    this.renderFriends();
  },
  async addFriend() {
    const code = $('#frAddIn').value.trim(), msg = $('#frMsg');
    if (!code) { msg.textContent = 'Type your friend\'s code first.'; return; }
    msg.textContent = 'Looking…';
    let r;
    try { r = await Net.rpc('dd_friend_add', { p_token: this.ses.token, p_code: code }); } catch (e) { msg.textContent = this.err(); return; }
    msg.textContent = !r.ok ? this.err(r.error) : r.state === 'friends' ? '🎉 You and ' + r.nick + ' are friends now!' : '✉️ Asked ' + r.nick + '. You are friends as soon as ' + r.nick + ' says yes.';
    if (r.ok) $('#frAddIn').value = '';
    this.renderFriends();
  },

  wire() {
    const busy = async (btn, msgEl, fn, wait) => {
      btn.disabled = true; msgEl.textContent = 'One moment…';
      this.load(wait || 'One moment…');
      let m;
      try { m = await fn(); } catch (e) {
        m = /404/.test(String(e && e.message)) ? 'The online part of Daily Drum is not set up yet. A grown-up needs to finish the setup first.' : this.err();
      }
      btn.disabled = false; msgEl.textContent = m || '';
      msgEl.classList.toggle('bad', !!m && m !== 'Saved.');
      this.unload();
    };
    // The player's button at the top opens a small menu: my drummer, my account, my messages, log out.
    const menu = $('#meMenu'), closeMenu = () => { menu.classList.add('hidden'); $('#navMe').setAttribute('aria-expanded', 'false'); };
    $('#navMe').onclick = (e) => {
      e.stopPropagation();
      const open = menu.classList.contains('hidden');
      $('#mmWho').textContent = this.ok() ? 'Logged in as ' + this.ses.nick : 'Not logged in';
      $('#mmMsgs').textContent = '📬 My messages' + (this.msgs.length ? ' (' + this.msgs.length + ' new)' : '');
      menu.classList.toggle('hidden', !open);
      $('#navMe').setAttribute('aria-expanded', String(open));
    };
    document.addEventListener('click', (e) => { if (!menu.contains(e.target)) closeMenu(); });
    $('#mmMe').onclick = () => { closeMenu(); show('me'); };
    $('#mmAcct').onclick = () => { closeMenu(); show('account'); };
    $('#mmMsgs').onclick = () => { closeMenu(); show('inbox'); };
    $('#mmOut').onclick = (e) => {
      e.stopPropagation();
      const b = $('#mmOut');
      if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = '🚪 Tap again to log out'; setTimeout(() => { delete b.dataset.sure; b.textContent = '🚪 Log out'; }, 3500); return; }
      delete b.dataset.sure; b.textContent = '🚪 Log out';
      closeMenu(); this.logout();
    };
    document.querySelectorAll('.showPin input').forEach(c => { c.onchange = () => c.dataset.pins.split(',').forEach(id => { $('#' + id).type = c.checked ? 'text' : 'password'; }); });
    // Nicknames are small letters only: capitals turn into small letters as they are typed.
    ['#acNickIn', '#acNickNew'].forEach(s => {
      const el = $(s);
      el.addEventListener('input', () => { const v = el.value.toLowerCase(); if (v !== el.value) { const a = el.selectionStart, b = el.selectionEnd; el.value = v; try { el.setSelectionRange(a, b); } catch (e) {} } });
    });
    $('#acLoginBtn').onclick = () => busy($('#acLoginBtn'), $('#acMsg'), () => this.login($('#acNickIn').value.trim().toLowerCase(), $('#acPinIn').value), 'Logging in…');
    $('#acPinIn').onkeydown = (e) => { if (e.key === 'Enter') $('#acLoginBtn').click(); };
    $('#acNewBtn').onclick = () => busy($('#acNewBtn'), $('#acMsg2'), async () => {
      if ($('#acPinNew').value !== $('#acPinNew2').value) return 'The two PINs are not the same. Type them again.';
      const w = $('#acWordNew').value.trim();
      if (w.length < 3) return 'Pick a secret word with 3 letters or more. You need it if you forget your PIN.';
      if (w.toLowerCase() === $('#acNickNew').value.trim().toLowerCase()) return 'Pick a secret word that is different from your nickname.';
      return this.signup($('#acNickNew').value.trim().toLowerCase(), $('#acPinNew').value, $('#acJoin').value, w);
    });
    $('#acCheck').onclick = () => busy($('#acCheck'), $('#acWaitMsg'), async () => { await this.refresh(true); if (this.ok()) { show(Online.home()); return ''; } return this.ses && this.ses.status === 'pending' ? 'Not yet. Ask the grown-up, then check again.' : ''; });
    $('#acOutBtn').onclick = () => this.logout();
    $('#acPinOut').onclick = () => this.logout();
    // Forgot my PIN: nothing changes on the account. The grown-up sees the request and hands over a new PIN themselves.
    $('#acForgot').onclick = () => $('#acForgotBox').classList.toggle('hidden');
    // With the secret word the player sets a new PIN on the spot and is logged in. Nobody else has to do anything.
    $('#acResetGo').onclick = () => busy($('#acResetGo'), $('#acResetMsg'), async () => {
      const nick = $('#acNickIn').value.trim().toLowerCase(), a = $('#acFPin').value;
      if (nick.length < 3) return 'Type your nickname in the box above first.';
      if ($('#acFWord').value.trim().length < 3) return 'Type your secret word.';
      if (a !== $('#acFPin2').value) return 'The two new PINs are not the same. Type them again.';
      const r = await Net.rpc('dd_pin_reset', { p_nick: nick, p_word: $('#acFWord').value, p_new: a });
      if (!r.ok) return this.err(r.error);
      ['#acFWord', '#acFPin', '#acFPin2', '#acPinIn'].forEach(i => { $(i).value = ''; });
      $('#acForgotBox').classList.add('hidden');
      return this.login(nick, a);
    }, 'Setting your new PIN…');
    $('#acForgotBoth').onclick = () => $('#acForgotAsk').classList.toggle('hidden');
    $('#acWordOpen').onclick = () => { ['#acWordPin', '#acWordIn'].forEach(i => { $(i).value = ''; }); $('#acWordMsg').textContent = ''; $('#acWordBox').classList.toggle('hidden'); };
    $('#acWordCancel').onclick = () => $('#acWordBox').classList.add('hidden');
    $('#acWordGo').onclick = () => busy($('#acWordGo'), $('#acWordMsg'), async () => {
      const w = $('#acWordIn').value.trim();
      if (w.length < 3) return this.err('word');
      if (w.toLowerCase() === this.ses.nick.toLowerCase()) return 'Pick a secret word that is different from your nickname.';
      const r = await Net.rpc('dd_set_word', { p_token: this.ses.token, p_pin: $('#acWordPin').value, p_word: w });
      if (!r.ok) return this.err(r.error);
      this.ses.has_word = true; this.keep();
      ['#acWordPin', '#acWordIn'].forEach(i => { $(i).value = ''; });
      $('#acWordBox').classList.add('hidden');
      this.renderAccount();
      return '';
    }, 'Saving your secret word…');
    $('#acForgotGo').onclick = () => busy($('#acForgotGo'), $('#acForgotMsg'), async () => {
      const nick = $('#acNickIn').value.trim().toLowerCase();
      if (nick.length < 3) return 'Type your nickname in the box above first.';
      await Net.rpc('dd_pin_help', { p_nick: nick });
      return 'Done. If "' + nick + '" has an account, the grown-up now sees that it needs a new PIN. They will tell you the new PIN themselves.';
    }, 'Asking the grown-up…');
    $('#acPinOpen').onclick = () => { this.pinOpen = true; ['#acPinOld', '#acPinA', '#acPinB'].forEach(i => { $(i).value = ''; }); $('#acPinMsg').textContent = ''; this.renderAccount(); };
    $('#acPinCancel').onclick = () => { this.pinOpen = false; this.renderAccount(); };
    $('#acPinGo').onclick = () => busy($('#acPinGo'), $('#acPinMsg'), async () => {
      const a = $('#acPinA').value;
      if (a !== $('#acPinB').value) return 'The two new PINs are not the same. Type them again.';
      const r = await Net.rpc('dd_change_pin', { p_token: this.ses.token, p_old: $('#acPinOld').value, p_new: a });
      if (!r.ok) return this.err(r.error);
      this.pinOpen = false; this.ses.must_change = false; this.keep();
      ['#acPinOld', '#acPinA', '#acPinB'].forEach(i => { $(i).value = ''; });
      await this.refresh(true);
      if (this.ok() && screen === 'account') show(this.home());
      return '';
    }, 'Saving your new PIN…');
    $('#acOutBtn2').onclick = () => this.logout();
    $('#acSave').onclick = () => busy($('#acSave'), $('#acInMsg'), async () => { await this.push(); this.renderAccount(); return this.dirty ? this.err() : 'Saved.'; });
    $('#frAddBtn').onclick = () => this.addFriend();
    $('#frAddIn').onkeydown = (e) => { if (e.key === 'Enter') this.addFriend(); };
    $('#frLogin').onclick = () => show('account');
    $('#hubAcct').onclick = () => show('account');
    $('#hubInbox').onclick = () => show('inbox');
    $('#acMsgs').onclick = () => show('inbox');
    $('#acDrummer').onclick = () => show('me');
    $('#inboxHome').onclick = () => show('hub');
    $('#navFriends').onclick = () => show('friends');
    // Leaving the app: send what is not saved yet.
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.dirty) this.push(); });
  }
};

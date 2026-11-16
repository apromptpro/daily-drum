'use strict';
// The admin page: one password, checked by the database (see supabase-setup.sql). Nothing on this page works
// without it, because every request carries the admin's login and the database refuses the rest.
const $ = (s) => document.querySelector(s);
const A = { token: null, users: [], sel: null, now: Date.now() };
try { A.token = sessionStorage.getItem('dd.admin'); } catch (e) {}

const call = (fn, args) => Net.rpc(fn, Object.assign({ p_token: A.token }, args || {}));
const view = (id) => { ['vSetup', 'vLogin', 'vMain'].forEach(v => $('#' + v).classList.toggle('hidden', v !== id)); $('#admOut').classList.toggle('hidden', id !== 'vMain'); };
const when = (t) => {
  if (!t) return 'never';
  const d = new Date(t), mins = Math.round((A.now - d.getTime()) / 60000);
  return mins < 2 ? 'just now' : mins < 60 ? mins + ' min ago' : mins < 1440 ? Math.round(mins / 60) + ' h ago' : mins < 20160 ? Math.round(mins / 1440) + ' days ago' : d.toLocaleDateString();
};
const stateOf = (u) => (u.status === 'active' && u.expires_at && new Date(u.expires_at).getTime() <= A.now ? 'expired' : u.status);
const face = (u) => { try { return avatarSvg(avOf({ av: (u.profile || {}).av }), false); } catch (e) { return ''; } };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const sure = (btn, text, fn) => {   // dangerous buttons ask twice
  if (!btn.dataset.sure) { const old = btn.textContent; btn.dataset.sure = '1'; btn.textContent = text; setTimeout(() => { delete btn.dataset.sure; btn.textContent = old; }, 4000); return; }
  fn();
};
function note(msg) { $('#aMsg').textContent = msg || ''; if (msg) setTimeout(() => { if ($('#aMsg').textContent === msg) $('#aMsg').textContent = ''; }, 5000); }
async function act(fn, args, done) {
  let r;
  try { r = await call(fn, args); } catch (e) { note('No answer from the online service. Check the internet.'); return null; }
  if (!r.ok && r.error === 'auth') { logout(true); return null; }
  if (!r.ok) { note('That did not work (' + (r.error || 'unknown') + ').'); return null; }
  if (done) note(done);
  return r;
}

async function start() {
  let st;
  try { st = await Net.rpc('dd_admin_state'); } catch (e) {
    view('vLogin'); $('#liMsg').textContent = 'The online service does not answer. Was supabase-setup.sql run in the Supabase SQL editor?'; return;
  }
  if (!st.setup) { view('vSetup'); return; }
  if (A.token) { const ok = await load(); if (ok) return; }
  view('vLogin');
}
function logout(expired) {
  if (A.token && !expired) Net.rpc('dd_admin_logout', { p_token: A.token }).catch(() => {});
  A.token = null;
  try { sessionStorage.removeItem('dd.admin'); } catch (e) {}
  view('vLogin');
  $('#liMsg').textContent = expired ? 'The admin login has ended. Log in again.' : '';
}

async function load() {
  let r;
  try { r = await call('dd_admin_users'); } catch (e) { return false; }
  if (!r.ok) return false;
  A.users = r.users; A.now = new Date(r.now).getTime();
  $('#sJoin').value = r.join_code || '';
  view('vMain');
  renderUsers();
  return true;
}

function renderUsers() {
  const us = A.users, day = 86400000;
  const n = (f) => us.filter(f).length;
  const cards = [[us.length, 'players'], [n(u => u.status === 'pending'), 'waiting for approval'], [n(u => u.pin_help_at), 'asked for a new PIN'], [n(u => stateOf(u) === 'active'), 'active'],
    [n(u => u.last_seen && A.now - new Date(u.last_seen).getTime() < day), 'played in the last 24 hours'], [n(u => u.status === 'disabled'), 'disabled'], [n(u => stateOf(u) === 'expired'), 'time ran out']];
  $('#aCards').innerHTML = cards.map(c => '<div class="card"><div class="num">' + c[0] + '</div><div class="muted small">' + c[1] + '</div></div>').join('');
  // waiting for approval
  const pend = $('#aPending');
  pend.innerHTML = '';
  us.filter(u => u.status === 'pending').forEach(u => {
    const d = document.createElement('div');
    d.className = 'pendRow';
    d.innerHTML = '<b>' + esc(u.nick) + '</b><span class="muted small">asked for an account ' + when(u.created_at) + '</span><button class="primary">Approve</button><button>Approve for 30 days</button><button class="danger">Refuse and delete</button>';
    const b = d.querySelectorAll('button');
    b[0].onclick = async () => { if (await act('dd_admin_update', { p_user: u.id, p_status: 'active' }, u.nick + ' approved.')) load(); };
    b[1].onclick = async () => { if (await act('dd_admin_update', { p_user: u.id, p_status: 'active', p_expires: new Date(Date.now() + 30 * day).toISOString(), p_set_expiry: true }, u.nick + ' approved for 30 days.')) load(); };
    b[2].onclick = () => sure(b[2], 'Really delete ' + u.nick + '?', async () => { if (await act('dd_admin_delete', { p_user: u.id }, u.nick + ' deleted.')) load(); });
    pend.appendChild(d);
  });
  // asked for a new PIN from the login screen. Anyone can press that button, so the request itself changes nothing:
  // check who is really asking, set a temporary PIN, and tell it to the child (or the parent) yourself.
  us.filter(u => u.pin_help_at).forEach(u => {
    const d = document.createElement('div');
    d.className = 'pendRow help';
    d.innerHTML = '<b>🔑 ' + esc(u.nick) + '</b><span class="muted small">asked for a new PIN ' + when(u.pin_help_at) + (u.note ? ' · ' + esc(u.note) : '') + '</span><button class="primary">Open and set a PIN</button><button>Ignore this request</button>';
    const b = d.querySelectorAll('button');
    b[0].onclick = () => { A.sel = u.id; renderUsers(); detail(u); };
    b[1].onclick = async () => { if (await act('dd_admin_note', { p_user: u.id, p_clear_help: true }, 'Request from ' + u.nick + ' ignored. Nothing was changed.')) load(); };
    pend.appendChild(d);
  });
  // everyone
  const q = $('#aFilter').value.trim().toLowerCase(), body = $('#aRows');
  body.innerHTML = '';
  us.filter(u => !q || u.nick.toLowerCase().indexOf(q) >= 0).forEach(u => {
    const s = u.summary || {}, st = stateOf(u), tr = document.createElement('tr');
    if (A.sel === u.id) tr.className = 'sel';
    tr.innerHTML = '<td><span class="face admFace">' + face(u) + '</span><b>' + esc(u.nick) + '</b>' + (u.locked ? ' 🔒' : '') + (u.pin_help_at ? ' 🔑' : '') + (u.note ? '<br><span class="muted small">' + esc(u.note) + '</span>' : '') + '</td><td><span class="chipS ' + st + '">' + st + '</span></td><td>' +
      (u.expires_at ? new Date(u.expires_at).toLocaleDateString() : 'no limit') + '</td><td>' + when(u.last_seen) + '</td><td>' + esc((s.icon || '') + ' ' + (s.rank || '-')) + '</td><td>' + (s.xp || 0) + '</td><td>' + (s.stars || 0) +
      '</td><td>' + (s.badges || 0) + '</td><td>' + (s.streak || 0) + '</td><td>' + (s.stops || 0) + ' / 7</td><td>' + u.friends + '</td>';
    tr.onclick = () => { A.sel = u.id; renderUsers(); detail(u); };
    body.appendChild(tr);
  });
  if (!body.children.length) body.innerHTML = '<tr><td colspan="11" class="muted">No players' + (q ? ' match that name' : ' yet. They appear here when someone asks for an account in the app') + '.</td></tr>';
  // who a message can go to
  const to = $('#mTo'), cur = to.value;
  to.innerHTML = '<option value="">Everyone</option>' + us.filter(u => u.status !== 'pending').map(u => '<option value="' + u.id + '">' + esc(u.nick) + '</option>').join('');
  to.value = cur;
}

async function detail(u) {
  const box = $('#aDetail');
  box.classList.remove('hidden');
  box.innerHTML = '<h2>' + esc(u.nick) + '</h2><p class="muted">Loading…</p>';
  const r = await act('dd_admin_user', { p_user: u.id });
  if (!r) return;
  const d = r.data || {}, pg = d.progress || {}, pf = d.profile || {}, st = stateOf(u), day = 86400000;
  const stars = (id) => (pg[id] ? pg[id].stars || 0 : 0);
  let html = '<h2><span class="face admFace">' + face(u) + '</span>' + esc(u.nick) + ' <span class="chipS ' + st + '">' + st + '</span></h2>' +
    '<p class="muted small">Friend code ' + esc(u.friend_code) + ' · joined ' + new Date(u.created_at).toLocaleDateString() + ' · last login ' + when(u.last_login) + ' · progress last saved ' + when(u.data_at) + '</p>' +
    '<div class="row">' +
    (u.status === 'active' ? '<button data-a="disable">Disable</button>' : '<button data-a="enable" class="primary">' + (u.status === 'pending' ? 'Approve' : 'Enable') + '</button>') +
    '<label>Valid until <input id="dExp" type="date" class="textIn" value="' + (u.expires_at ? new Date(u.expires_at).toISOString().slice(0, 10) : '') + '"></label>' +
    '<button data-a="exp">Set date</button><button data-a="d30">+30 days</button><button data-a="d90">+90 days</button><button data-a="nolimit">No time limit</button></div>' +
    (u.pin_help_at ? '<div class="note">🔑 <b>' + esc(u.nick) + ' asked for a new PIN ' + when(u.pin_help_at) + '.</b> Anyone can press that button, so first make sure it really was this child. Then set a temporary PIN below and tell it to them yourself. They will be asked to choose their own PIN when they log in.</div>' : '') +
    '<p class="muted small">Secret word: ' + (u.has_word ? 'set. ' + esc(u.nick) + ' can choose a new PIN alone with it, on the login screen under "Forgot my PIN?".' : 'not set. If the PIN is forgotten, only you can give a new one.') + '</p>' +
    (u.must_change ? '<p class="muted small">A temporary PIN is set. ' + esc(u.nick) + ' must choose their own PIN at the next login.</p>' : '') +
    '<div class="row"><input id="dNote" class="textIn" placeholder="Private note: who is this? (only you see it)" maxlength="300" style="flex:1;min-width:220px" value="' + esc(u.note) + '"><button data-a="note">Save note</button></div>' +
    '<div class="row"><input id="dPin" class="textIn" placeholder="Temporary PIN (4 or more)" maxlength="40"><button data-a="pin">Set temporary PIN</button>' +
    '<input id="dMsg" class="textIn" placeholder="Message to ' + esc(u.nick) + '" maxlength="500" style="flex:1;min-width:200px"><button data-a="msg">Send</button></div>' +
    '<div class="row dangerRow"><span class="muted small">Deleting removes the account, its progress and its friendships for good.</span><button data-a="del" class="danger">Delete this player</button></div>';
  // progress, level by level
  html += '<h3>Progress</h3>';
  if (!r.data) html += '<p class="muted">Nothing saved online yet.</p>';
  else {
    COURSE.forEach(lv => {
      const got = lv.ids.reduce((a, id) => a + stars(id), 0), max = lv.ids.length * 3, done = lv.ids.filter(id => stars(id) > 0).length;
      html += '<div class="lvBar"><span>' + esc(lv.name) + '</span><div class="bar"><i style="width:' + Math.round(100 * got / max) + '%"></i></div><span class="small muted">' + done + ' / ' + lv.ids.length + ' lessons</span></div>';
    });
    const days = pf.days || {}, mins = [];
    for (let i = 13; i >= 0; i--) { const x = new Date(A.now - i * day); mins.push(Math.round((days[x.getFullYear() + '-' + (x.getMonth() + 1) + '-' + x.getDate()] || 0) / 60)); }
    const tour = pf.tour || {};
    html += '<p><b>Minutes practised, last 14 days:</b> ' + mins.join(' · ') + ' <span class="muted small">(today is last; total ' + mins.reduce((a, b) => a + b, 0) + ')</span></p>' +
      '<p><b>Badges:</b> ' + (Object.keys(pf.badges || {}).map(id => { const b = BADGES.find(x => x.id === id); return b ? b.icon + ' ' + esc(b.name) : ''; }).filter(Boolean).join(', ') || 'none yet') + '</p>' +
      '<p><b>Tour:</b> ' + (Object.keys(tour).length ? Object.keys(tour).map(k => esc(VENUES[k]) + ' (' + Object.keys(tour[k]).map(g => g + ' ' + tour[k][g]).join(', ') + ')').join('; ') : 'not started') +
      ' · level ' + (pf.level === 'pro' ? 'Pro' : 'Rookie') + '</p>' +
      '<p><b>Notes hit in total:</b> ' + (pf.hits || 0) + ' · <b>longest run of right hits:</b> ' + (pf.bestCombo || 0) + '</p>';
  }
  html += '<h3>Friends</h3><p>' + (r.friends.length ? r.friends.map(f => esc(f.nick) + (f.accepted ? '' : f.asked_by_them ? ' (asked, not answered)' : ' (waiting for their answer)')).join(', ') : 'No friends yet.') + '</p>' +
    '<h3>Recent activity</h3>' + (r.log.length ? r.log.map(l => '<div class="logRow"><span>' + new Date(l.at).toLocaleString() + '</span><span></span><b>' + esc(l.event) + '</b><span>' + esc(l.detail) + '</span></div>').join('') : '<p class="muted">Nothing yet.</p>');
  box.innerHTML = html;
  const upd = async (args, msg) => { if (await act('dd_admin_update', Object.assign({ p_user: u.id }, args), msg)) { await load(); const nu = A.users.find(x => x.id === u.id); if (nu) detail(nu); } };
  const until = (n) => new Date(Math.max(A.now, u.expires_at ? new Date(u.expires_at).getTime() : 0) + n * day).toISOString();
  box.querySelectorAll('button[data-a]').forEach(b => {
    b.onclick = async () => {
      const a = b.dataset.a;
      if (a === 'disable') upd({ p_status: 'disabled' }, u.nick + ' disabled. They are logged out everywhere.');
      else if (a === 'enable') upd({ p_status: 'active' }, u.nick + ' can play.');
      else if (a === 'exp') { const v = $('#dExp').value; if (!v) { note('Pick a date first.'); return; } upd({ p_expires: new Date(v + 'T23:59:59').toISOString(), p_set_expiry: true }, 'Valid until ' + v + '.'); }
      else if (a === 'd30') upd({ p_expires: until(30), p_set_expiry: true }, '30 days added.');
      else if (a === 'd90') upd({ p_expires: until(90), p_set_expiry: true }, '90 days added.');
      else if (a === 'nolimit') upd({ p_expires: null, p_set_expiry: true }, 'Time limit removed.');
      else if (a === 'pin') { if (await act('dd_admin_pin', { p_user: u.id, p_pin: $('#dPin').value }, 'Temporary PIN set for ' + u.nick + '. Tell it to them yourself. They will choose their own at the next login.')) { await load(); const nu = A.users.find(x => x.id === u.id); if (nu) detail(nu); } }
      else if (a === 'note') { if (await act('dd_admin_note', { p_user: u.id, p_note: $('#dNote').value }, 'Note saved.')) load(); }
      else if (a === 'msg') { if (await act('dd_admin_message', { p_user: u.id, p_body: $('#dMsg').value }, 'Message sent to ' + u.nick + '.')) $('#dMsg').value = ''; }
      else if (a === 'del') sure(b, 'Really delete ' + u.nick + ' for good?', async () => { if (await act('dd_admin_delete', { p_user: u.id }, u.nick + ' deleted.')) { A.sel = null; box.classList.add('hidden'); load(); } });
    };
  });
  box.scrollIntoView({ block: 'nearest' });
}

async function renderMsgs(del) {
  const r = await act('dd_admin_messages', del ? { p_delete: del } : {});
  if (!r) return;
  const box = $('#mList');
  box.innerHTML = r.messages.length ? '' : '<p class="muted">No messages sent yet.</p>';
  r.messages.forEach(m => {
    const d = document.createElement('div');
    d.className = 'frRow';
    d.innerHTML = '<span style="flex:1;min-width:200px"><b>To ' + (m.all ? 'everyone' : esc(m.to || 'a deleted player')) + ':</b> ' + esc(m.body) + '<br><span class="muted small">' + new Date(m.at).toLocaleString() + ' · read by ' + m.read + '</span></span><button>Take back</button>';
    d.querySelector('button').onclick = () => renderMsgs(m.id);
    box.appendChild(d);
  });
}
async function renderLog() {
  const r = await act('dd_admin_log', { p_limit: 300 });
  if (!r) return;
  $('#lList').innerHTML = r.log.map(l => '<div class="logRow"><span>' + new Date(l.at).toLocaleString() + '</span><span>' + esc(l.nick || '') + '</span><b>' + esc(l.event) + '</b><span>' + esc(l.detail || '') + '</span></div>').join('') || '<p class="muted">Nothing yet.</p>';
}

// ----- wiring -----
$('#suGo').onclick = async () => {
  const a = $('#suP1').value, b = $('#suP2').value, m = $('#suMsg');
  if (a.length < 10) { m.textContent = 'Use at least 10 characters.'; return; }
  if (a !== b) { m.textContent = 'The two passwords are not the same.'; return; }
  const r = await Net.rpc('dd_admin_setup', { p_password: a }).catch(() => null);
  if (!r || !r.ok) { m.textContent = r && r.error === 'done' ? 'An admin password exists already. Reload the page and log in.' : 'That did not work. Check the internet.'; return; }
  const l = await Net.rpc('dd_admin_login', { p_password: a });
  if (l.ok) { A.token = l.token; try { sessionStorage.setItem('dd.admin', l.token); } catch (e) {} load(); } else view('vLogin');
};
const doLogin = async () => {
  const m = $('#liMsg');
  m.textContent = 'One moment…';
  const r = await Net.rpc('dd_admin_login', { p_password: $('#liP').value }).catch(() => null);
  if (!r) { m.textContent = 'No answer from the online service.'; return; }
  if (!r.ok) { m.textContent = r.error === 'locked' ? 'Too many wrong tries. Wait 15 minutes.' : r.error === 'setup' ? 'No admin password exists yet. Reload this page.' : 'That password is not right.'; return; }
  A.token = r.token; $('#liP').value = ''; m.textContent = '';
  try { sessionStorage.setItem('dd.admin', r.token); } catch (e) {}
  load();
};
$('#liGo').onclick = doLogin;
$('#liP').onkeydown = (e) => { if (e.key === 'Enter') doLogin(); };
$('#admOut').onclick = () => logout(false);
$('#aRefresh').onclick = async () => { await load(); note('Up to date.'); };
$('#aFilter').oninput = renderUsers;
document.querySelectorAll('.admTabs button[data-tab]').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('.admTabs button[data-tab]').forEach(x => { x.classList.toggle('active', x === b); $('#' + x.dataset.tab).classList.toggle('hidden', x !== b); });
    if (b.dataset.tab === 'tMsgs') renderMsgs(); else if (b.dataset.tab === 'tLog') renderLog();
  };
});
$('#mSend').onclick = async () => {
  const to = $('#mTo').value || null;
  if (await act('dd_admin_message', { p_user: to, p_body: $('#mBody').value }, 'Message sent.')) { $('#mBody').value = ''; renderMsgs(); }
};
$('#sJoinSave').onclick = async () => { if (await act('dd_admin_join', { p_code: $('#sJoin').value })) $('#sJoinMsg').textContent = $('#sJoin').value.trim() ? 'Saved. New players need this code.' : 'Saved. No join code is needed.'; };
$('#sPSave').onclick = async () => {
  const a = $('#sP1').value, m = $('#sPMsg');
  if (a.length < 10) { m.textContent = 'Use at least 10 characters.'; return; }
  if (a !== $('#sP2').value) { m.textContent = 'The two passwords are not the same.'; return; }
  if (await act('dd_admin_password', { p_new: a })) { m.textContent = 'Password changed.'; $('#sP1').value = ''; $('#sP2').value = ''; }
};
start();

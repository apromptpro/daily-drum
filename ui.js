'use strict';
// The app look: backdrop pictures, the moving Beat Brothers, sideways strips with arrows,
// and "app mode" (tablets and bigger), where every screen fits the display and nothing scrolls up and down.
// Loaded last. It wraps show() so every screen change passes through here.
const UI = {
  mq: window.matchMedia('(min-width: 700px) and (min-height: 540px)'),
  app: false,
  layer: 0,
  sceneUrl: '',
  // How much of the picture shows through. Home: faded and bright. Tour: dimmed, so the cards stand out.
  // Result page: a darker stage. Screens with a lot to read: a light veil. Only the login screen shows the picture as it is.
  TONE: { hub: 'bright', tour: 'dim', recap: 'stage', play: 'dark' },
  POSES: ['idle', 'blink', 'wave', 'jump', 'druma', 'drumb', 'wow', 'ready', 'cheer', 'walk', 'clap', 'thumb', 'trophy', 'think', 'flex', 'hi5', 'yawn', 'sit'],

  init() {
    const bg = document.createElement('div');
    bg.id = 'sceneBg'; bg.innerHTML = '<i></i><i></i>';
    document.body.insertBefore(bg, document.body.firstChild);
    this.build();
    this.mode();
    this.mq.addEventListener ? this.mq.addEventListener('change', () => this.mode()) : this.mq.addListener(() => this.mode());
    window.addEventListener('resize', () => this.fit());
    // every screen change
    const show0 = show;
    show = function (name) { show0(name); UI.shown(); };   // eslint-disable-line no-global-assign
    const view0 = Tour.view.bind(Tour);
    Tour.view = function (name) { view0(name); document.body.dataset.tour = name; UI.scene(); };
    const home0 = renderHome;
    renderHome = function () { home0(); UI.lessonsShown(); };   // eslint-disable-line no-global-assign
    $('#hubTour').onclick = () => show('tour');
    this.tabs();
    this.options();
    this.animals();
    // Home: the badges are folded away; tapping their bar opens and closes them
    $('#badgeToggle').onclick = () => {
      const dock = $('#badgeDock'), open = dock.classList.toggle('closed') === false;
      $('#badgeToggle').setAttribute('aria-expanded', String(open));
      $('#badgeToggle .bChev').textContent = open ? '▼ hide' : '▲ show';
      this.arrows();
    };
    this.shown();
    setInterval(() => this.blink(), 2700);
    setInterval(() => this.drum(), 250);
    setInterval(() => this.idleAct(), 6500);
    setInterval(() => this.arrows(), 500);
    setInterval(() => this.hud(), 160);
    setTimeout(() => this.preload(), 2500);
    document.addEventListener('wheel', (e) => {   // a mouse wheel moves the sideways strips
      const s = e.target.closest && e.target.closest('.flow, .hscroll');
      if (!s || Math.abs(e.deltaY) <= Math.abs(e.deltaX) || s.scrollWidth <= s.clientWidth + 4) return;
      if (!this.app && s.classList.contains('flow')) return;
      s.scrollLeft += e.deltaY; e.preventDefault();
    }, { passive: false });
  },

  // ----- one-time changes to the page: wrappers for the content that moves sideways -----
  build() {
    const wrap = (id, wide) => {
      const sec = document.getElementById(id), flow = document.createElement('div');
      flow.className = 'flow' + (wide ? ' wideCols' : '');
      Array.from(sec.children).forEach(c => { if (c.tagName !== 'H1') flow.appendChild(c); });
      sec.appendChild(flow);
    };
    ['songs', 'learn', 'friends', 'inbox', 'progress', 'testDone'].forEach(id => wrap(id, id === 'songs' || id === 'progress'));
    $('#tourStops').classList.add('hscroll');
    // My drummer: the picture, the name and "Not you?" sit in a slim panel on the left.
    // All the rest of the page belongs to the drummer's styles.
    const me = $('#me'), body = document.createElement('div');
    body.className = 'meBody';
    const left = me.querySelector('.meLeft'), card = me.querySelector('.meCard'), form = me.querySelector('.meForm'), done = $('#meDone').parentNode;
    const tiny = (text) => { const s = document.createElement('span'); s.className = 'tiny'; s.textContent = text; return s; };
    me.insertBefore(body, card);
    body.appendChild(left); body.appendChild(card);
    const nameIn = $('#meNameIn'), nameRow = nameIn.parentNode;
    nameIn.placeholder = 'My name'; nameIn.setAttribute('aria-label', 'My name');
    form.querySelector('label[for="meNameIn"]').remove();
    left.appendChild(nameIn); nameRow.remove();
    const play = document.createElement('div');
    play.className = 'mePlay';
    form.insertBefore($('#meMsg'), $('#meOpts'));
    Array.from(form.children).forEach(c => { if (c !== $('#meOpts') && c !== $('#meMsg') && c.tagName !== 'H3' && !c.classList.contains('avTabs')) c.remove(); });
    Array.from(form.querySelectorAll('h3')).slice(1).forEach(h => h.remove());
    play.appendChild(tiny('Not you?'));
    play.appendChild($('#meSwitch')); play.appendChild($('#meRemoveRow'));
    play.querySelector('#meRemove').title ='For a grown-up: this erases this player\'s stars and cannot be undone.';
    $('#mePlayers').remove();
    left.appendChild(play); left.appendChild($('#meDone')); done.remove();
  },
  // The login screen shows one form at a time.
  tabs() {
    const out = $('#acOut'), t = document.createElement('div');
    t.className = 'acTabs';
    t.innerHTML = '<button data-t="in">&#128275; I have an account</button><button data-t="new">&#10024; I am new here</button>';
    out.insertBefore(t, out.querySelector('.acGrid'));
    const pick = (k) => { out.dataset.tab = k; t.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.t === k)); };
    t.querySelectorAll('button').forEach(b => { b.onclick = () => pick(b.dataset.t); });
    // the eye in the PIN box shows or hides what was typed
    document.querySelectorAll('button.eyeBtn').forEach(e => {
      e.onclick = () => {
        const on = e.getAttribute('aria-pressed') !== 'true';
        e.setAttribute('aria-pressed', String(on));
        e.dataset.pins.split(',').forEach(id => { $('#' + id).type = on ? 'text' : 'password'; });
      };
    });
    let used = false;
    try { used = !!localStorage.getItem('dc.profile') || !!localStorage.getItem('dc.progress'); } catch (e) {}
    pick(used ? 'in' : 'new');
  },

  // The lesson options are icon buttons. Tapping one says in words what it now does, because an icon alone
  // does not explain itself and a tablet has no mouse to hover with.
  // The picture is always a metronome; the small mark in its corner says what it does: sound, silent flash, or off.
  METRO_SVG: '<svg class="metroPic" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.2 3.5 H14.8 L18 20.5 H6Z" fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M7.2 15.5 H16.8" stroke="currentColor" stroke-width="1.5"/><path d="M12 17.5 L17.6 4.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="15.4" cy="9.6" r="2" fill="currentColor"/></svg>',
  METRO: { sound: ['🔊', 'Metronome', 'Metronome: you hear a click on every beat.'], visual: ['💡', 'Metronome', 'Metronome: a silent flash on every beat. Use it if the click confuses the microphone.'], off: ['✕', 'Metronome', 'Metronome is off.'] },
  options() {
    document.querySelectorAll('#play .controls label.tog').forEach(t => {
      const inp = t.querySelector('input');
      inp.addEventListener('change', () => this.ctlSay(inp.checked ? t.dataset.on : t.dataset.off));
    });
    const sel = $('#metroMode'), btn = $('#metroBtn');
    const paint = () => {
      const m = this.METRO[sel.value] || this.METRO.sound;
      btn.querySelector('.ci').innerHTML = this.METRO_SVG + '<i class="metroMark">' + m[0] + '</i>'; btn.querySelector('.ct').textContent = m[1];
      btn.dataset.m = sel.value;
      btn.classList.toggle('on', sel.value !== 'off');
      btn.setAttribute('aria-label', m[2]);
    };
    btn.onclick = () => {
      const order = ['sound', 'visual', 'off'];
      sel.value = order[(order.indexOf(sel.value) + 1) % order.length];
      sel.dispatchEvent(new Event('change'));
      paint();
      this.ctlSay(this.METRO[sel.value][2]);
    };
    paint();
  },
  // The secret word is "my favourite animal": a row of animals to tap, and the child can still type any other.
  ANIMALS: [['🐶', 'dog'], ['🐱', 'cat'], ['🐯', 'tiger'], ['🦁', 'lion'], ['🐘', 'elephant'], ['🐼', 'panda'], ['🐰', 'rabbit'], ['🐴', 'horse'], ['🐵', 'monkey'], ['🐬', 'dolphin'], ['🐧', 'penguin'], ['🦜', 'parrot']],
  animals() {
    // the same row under every box that asks for the secret word
    [['acFWord', 'My favourite animal'], ['acWordIn', '']].forEach(x => {
      const inp = document.getElementById(x[0]);
      if (!inp || inp.parentNode.querySelector('.animalPick[data-for="' + x[0] + '"]')) return;
      const d = document.createElement('div');
      d.className = 'animalPick'; d.dataset.for = x[0];
      inp.parentNode.insertBefore(d, inp.nextSibling);
    });
    document.querySelectorAll('.animalPick').forEach(box => {
      const inp = document.getElementById(box.dataset.for);
      this.ANIMALS.forEach(a => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'animal'; b.title = a[1];
        b.innerHTML = '<i></i><span></span>';
        b.firstChild.textContent = a[0]; b.lastChild.textContent = a[1];
        b.onclick = () => { inp.value = a[1]; inp.dispatchEvent(new Event('input', { bubbles: true })); box.querySelectorAll('.animal').forEach(q => q.classList.toggle('on', q === b)); };
        box.appendChild(b);
      });
      inp.addEventListener('input', () => box.querySelectorAll('.animal').forEach(q => q.classList.toggle('on', q.title === inp.value.trim().toLowerCase())));
    });
  },
  ctlSay(text) {
    const box = $('#ctlSay');
    clearTimeout(this._say);
    box.textContent = text || '';
    box.classList.toggle('hidden', !text);
    if (text) { box.style.animation = 'none'; void box.offsetWidth; box.style.animation = ''; this._say = setTimeout(() => box.classList.add('hidden'), 3200); }
  },

  mode() {
    this.app = this.mq.matches;
    document.documentElement.classList.toggle('appMode', this.app);
    this.fit();
    if (typeof draw === 'function' && screen === 'play') requestAnimationFrame(draw);
  },

  // ----- after every screen change -----
  shown() {
    const b = document.body;
    b.dataset.screen = screen;
    if (screen !== 'tour') delete b.dataset.tour;
    b.dataset.tone = this.TONE[screen] || (b.classList.contains('locked') ? 'stage' : 'soft');
    this.scene();
    // on the play screen the top bar is gone, so the microphone light moves next to the Start button
    const st = $('#earStatus');
    if (this.app && screen === 'play') $('#play .playTop').insertBefore(st, $('#demoBtn'));
    else if (st.parentNode !== document.querySelector('header')) document.querySelector('header').appendChild(st);
    document.querySelectorAll('.flow, .hscroll').forEach(s => { if (s.offsetParent && s.id !== 'lessonList') s.scrollLeft = 0; });
    this.fit();
    this.arrows();
  },
  // The picture behind the screen. Home shows the stage the player has earned; the Tour shows the stop that is picked.
  scene() {
    let f = 'studio';
    const earned = Math.max(1, Math.min(7, (avOf(prof()).scene || 0) || 1));
    if (document.body.classList.contains('locked')) f = 's3';
    else if (screen === 'hub') f = 's' + earned;
    else if (screen === 'tour') f = 's' + (Tour.k + 1);
    else if (screen === 'play' || screen === 'recap') f = G.gig ? 's' + (G.gig.stop + 1) : screen === 'recap' ? 's' + Math.max(earned, 3) : 'studio';
    const url = 'art/' + f + '.jpg';
    if (url === this.sceneUrl) return;
    this.sceneUrl = url;
    const layers = document.querySelectorAll('#sceneBg i'), next = layers[this.layer = 1 - this.layer], prev = layers[1 - this.layer];
    const im = new Image();
    im.onload = () => { if (this.sceneUrl !== url) return; next.style.backgroundImage = 'url(' + url + ')'; next.classList.add('on'); prev.classList.remove('on'); };
    im.src = url;
  },
  tourShown() {
    const games = document.querySelector('#tourStop .tourGames');
    if (games) games.classList.add('hscroll');
    document.querySelectorAll('#tourStops .stopCard:not(.open)').forEach(c => { c.addEventListener('click', () => { c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); }); });
    const here = document.querySelector('#tourStops .stopCard.here');
    if (here && here.offsetParent) { const s = $('#tourStops'); s.scrollLeft = Math.max(0, here.offsetLeft - (s.clientWidth - here.offsetWidth) / 2); }
    this.scene();
    this.act(document.querySelector('#tourHostFace .sprImg'), 'wave', 1300);
  },
  // The lesson that comes next glows, and the list opens at it.
  lessonsShown() {
    const act = document.querySelector('#lessonList .lvStep.active'), path = act && act.parentElement;
    if (act && act.offsetParent) requestAnimationFrame(() => {
      if (path.scrollHeight > path.clientHeight) path.scrollTop = Math.max(0, act.offsetTop - path.offsetTop - (path.clientHeight - act.offsetHeight) / 2);
      if (path.scrollWidth > path.clientWidth) path.scrollLeft = Math.max(0, act.offsetLeft - path.offsetLeft - 16);
    });
    const next = document.querySelector('#lessonList .lTile.next');
    if (!next || !next.offsetParent) return;
    const s = next.closest('.lvTiles');
    requestAnimationFrame(() => { if (s.scrollWidth > s.clientWidth) s.scrollLeft = Math.max(0, next.offsetLeft - s.offsetLeft - 16); });
  },
  // ----- the scoreboard on the lesson screen: right, missed, in a row, points, and how far through the lesson -----
  hud() {
    const b = document.body, on = screen === 'play' && typeof G !== 'undefined' && G.running && !G.demo && !!G.stats;
    if ((b.dataset.playing === '1') !== on) { if (on) b.dataset.playing = '1'; else delete b.dataset.playing; }
    if (!on) return;
    const st = G.stats, set = (id, v) => { const e = $(id); if (e.textContent !== String(v)) { e.textContent = v; e.parentNode.classList.remove('bump'); void e.offsetWidth; e.parentNode.classList.add('bump'); } };
    set('#hudHit', st.hit); set('#hudMiss', st.miss); set('#hudRun', G.streak || 0); set('#hudPts', st.points);
    const endless = G.loop || G.track, frac = endless || !G.totalBeats ? 0 : Math.max(0, Math.min(1, G.viewPos / G.totalBeats));
    const beat = 60 / (G.bpm || 60), fmt = (s) => Math.floor(s / 60) + ':' + ('0' + Math.floor(s % 60)).slice(-2);
    $('#hudFill').style.width = (frac * 100) + '%';
    $('#hudBro').style.left = (frac * 100) + '%';
    $('#hudTime').textContent = fmt(Math.max(0, G.viewPos) * beat) + (endless ? '' : ' / ' + fmt(G.totalBeats * beat));
  },  // How far one column of a flowing strip is from the next.
  colStep(s) {
    const cs = getComputedStyle(s), gap = parseFloat(cs.columnGap) || 16, want = parseFloat(cs.columnWidth) || 340;
    const inner = s.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const n = Math.max(1, Math.floor((inner + gap) / (want + gap)));
    return (inner + gap) / n;
  },
  // The certificate shrinks until it fits the screen.
  fit() {
    const page = document.querySelector('#cert .certPage');
    if (!page) return;
    page.style.transform = ''; page.style.marginBottom = '';
    if (!this.app || screen !== 'cert') return;
    const sec = $('#cert'), room = sec.clientHeight - 24 - sec.querySelector('.noPrint').offsetHeight - 16, h = page.offsetHeight;
    if (h > room && room > 100) { const k = room / h; page.style.transform = 'scale(' + k + ')'; page.style.marginBottom = (-(1 - k) * h) + 'px'; }
  },

  // ----- arrows on every strip that has more to the side -----
  arrowMap: new WeakMap(),
  arrows() {
    if (this.busy()) return;
    document.querySelectorAll('.flow, .hscroll').forEach(s => {
      let a = this.arrowMap.get(s);
      const isFlow = s.classList.contains('flow');
      const on = !!s.offsetParent && (this.app || !isFlow) && s.scrollWidth > s.clientWidth + 12;
      if (!a) {
        if (!on) return;
        const host = s.parentNode;
        if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
        a = ['l', 'r'].map(d => { const b = document.createElement('button'); b.className = 'scrArrow ' + d + ' hide'; b.textContent = d === 'l' ? '‹' : '›'; b.setAttribute('aria-label', d === 'l' ? 'Back' : 'More'); b.onclick = (e) => {
          e.stopPropagation();
          const dir = d === 'l' ? -1 : 1;
          if (!isFlow) { s.scrollBy({ left: dir * Math.max(240, s.clientWidth * 0.8), behavior: 'smooth' }); return; }
          // a flowing strip turns a whole page, and always stops with a column at the left edge
          const step = UI.colStep(s), page = Math.max(1, Math.round(s.clientWidth / step)) * step;
          s.scrollTo({ left: Math.max(0, Math.round((s.scrollLeft + dir * page) / step) * step), behavior: 'smooth' });
        }; host.appendChild(b); return b; });
        this.arrowMap.set(s, a);
      }
      if (!s.isConnected) { a.forEach(b => b.remove()); this.arrowMap.delete(s); return; }
      const top = s.offsetTop + s.offsetHeight / 2 - 23;
      a[0].style.top = a[1].style.top = top + 'px';
      a[0].style.left = (s.offsetLeft - 6) + 'px';
      a[1].style.left = (s.offsetLeft + s.offsetWidth - 40) + 'px';
      a[0].classList.toggle('hide', !on || s.scrollLeft < 12);
      a[1].classList.toggle('hide', !on || s.scrollLeft + s.clientWidth > s.scrollWidth - 12);
    });
    // strips that were drawn again leave their old arrows behind
    document.querySelectorAll('button.scrArrow').forEach(b => { if (!b.parentNode.querySelector('.flow, .hscroll')) b.remove(); });
  },

  // ----- the Beat Brothers move -----
  src(img, pose) { img.dataset.pose = pose; img.src = 'art/b' + img.dataset.b + '-' + pose + '.png'; },
  base(img) { return img.dataset.base || (img.dataset.base = img.dataset.pose); },
  // one pose for a moment, with a little hop, then back
  act(img, pose, ms) {
    if (!img) return;
    const base = this.base(img);
    clearTimeout(img._t);
    this.src(img, pose);
    img.classList.remove('pop'); void img.offsetWidth; img.classList.add('pop');
    img._t = setTimeout(() => { this.src(img, base); img._t = null; }, ms || 1200);
  },
  visible() { return Array.from(document.querySelectorAll('img.sprImg')).filter(i => i.offsetParent && !i.closest('.drumming')); },
  // While notes are falling nothing else on the page is touched, so the game keeps every bit of the device's speed.
  busy() { return (screen === 'play' && typeof G !== 'undefined' && G.running) || (screen === 'tour' && Tour.running); },
  blink() {
    if (document.hidden || this.busy()) return;
    this.visible().forEach(img => {
      if (img._t || this.base(img) !== 'idle' || Math.random() < 0.35) return;
      this.src(img, 'blink');
      img._t = setTimeout(() => { this.src(img, 'idle'); img._t = null; }, 170);
    });
  },
  drum() {
    document.querySelectorAll('.drumming img.sprImg').forEach(img => { if (img.offsetParent) this.src(img, img.dataset.pose === 'druma' ? 'drumb' : 'druma'); });
  },
  // now and then one of them does something by himself
  idleAct() {
    if (document.hidden || this.busy()) return;
    const free = this.visible().filter(i => !i._t && this.base(i) === 'idle');
    if (!free.length) return;
    const img = free[Math.floor(Math.random() * free.length)], list = ['wave', 'thumb', 'clap', 'hi5', 'flex', 'ready'];   // friendly gestures only: no surprised face without a reason
    this.act(img, list[Math.floor(Math.random() * list.length)], 1500);
  },
  // The other poses are fetched one after another, and never while a lesson is being played.
  preload() {
    const list = [];
    [0, 1].forEach(b => this.POSES.forEach(p => list.push('art/b' + b + '-' + p + '.png')));
    const next = () => {
      if (!list.length) return;
      if (this.busy()) { setTimeout(next, 3000); return; }
      const i = new Image();
      i.onload = i.onerror = () => setTimeout(next, 60);
      i.src = list.shift();
    };
    next();
  },
  // Bring something inside a sideways strip into view (the strip stops with a column at its left edge).
  reveal(el) {
    const s = el && el.closest('.flow');
    if (!s || !this.app) { if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
    const go = () => {
      const step = this.colStep(s);
      s.scrollLeft = Math.max(0, Math.floor((el.getBoundingClientRect().left - s.getBoundingClientRect().left + s.scrollLeft + step * 0.25) / step) * step);
    };
    requestAnimationFrame(go);
    setTimeout(go, 400);   // once more when the screen has finished sliding in
  }
};
UI.init();

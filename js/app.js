/* التنقل بين الشاشات، لوحة الأرقام، الرسم الحي، والرجوع التلقائي.
   لا يُحفظ أي شيء — كل البيانات في الذاكرة وتنمسح مع «زائر جديد». */
(function (N) {
  'use strict';

  const $ = s => document.querySelector(s);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const MIN = 40, MAX = 180;
  const IDLE_MS = 60000;

  const els = {
    readout: $('#readout'), readoutBox: $('.readout'), hint: $('#hint'),
    drawBtn: $('#drawBtn'), liveFrame: $('#liveFrame'),
    status: $('#status'), drawBpm: $('#drawBpm'),
    artFrame: $('#artFrame'), cardBpm: $('#cardBpm'), mood: $('#r-mood'),
    poem: $('#r-poem'), line: $('#r-line'),
    qr: $('#qrCode'), newBtn: $('#newBtn'), idleBar: $('#idleBar')
  };

  let current = 'welcome';
  let entry = '';
  let session = null;      // { bpm, scene, mood, canvas, t0, reduced, ... }
  let raf = 0;
  let lastTouch = Date.now();

  // ---------- التنقل ----------
  function show(id) {
    document.querySelectorAll('.screen').forEach(s => {
      const on = s.id === id;
      s.classList.toggle('active', on);
      s.setAttribute('aria-hidden', String(!on));
      s.inert = !on;
    });
    current = id;
    document.body.dataset.screen = id;
    lastTouch = Date.now();
  }

  function reset() {
    cancelAnimationFrame(raf);
    if (session) { session.canvas.width = 0; session.canvas.height = 0; }
    session = null;
    entry = '';
    renderEntry();
    els.liveFrame.replaceChildren();
    els.artFrame.replaceChildren();
    els.qr.replaceChildren();
    els.liveFrame.classList.remove('alive');
    els.artFrame.classList.remove('alive');
    els.idleBar.style.width = '0%';
    document.documentElement.style.setProperty('--beat', '0.77s');
    show('welcome');
  }

  // ---------- لوحة الأرقام ----------
  function evaluate(str) {
    if (!str) return { valid: false, error: false };
    const n = Number(str);
    const valid = n >= MIN && n <= MAX;
    const error = !valid && (n > MAX || str.length === 3 || (str.length === 2 && n < MIN && n * 10 > MAX));
    return { valid, error, n };
  }

  function renderEntry(shake) {
    const st = evaluate(entry);
    els.readout.textContent = entry || '—';
    els.readoutBox.classList.toggle('valid', st.valid);
    els.readoutBox.classList.toggle('invalid', st.error);
    els.hint.textContent = st.error ? 'الرقم لازم يكون بين 40 و 180' : 'اكتب رقم من 40 إلى 180';
    els.drawBtn.disabled = !st.valid;
    if (st.error && shake && !reduced.matches) {
      els.readoutBox.classList.remove('shake');
      void els.readoutBox.offsetWidth;
      els.readoutBox.classList.add('shake');
    }
  }

  function press(k) {
    if (k === 'del') entry = entry.slice(0, -1);
    else if (k === 'clear') entry = '';
    else {
      if (entry.length >= 3) { renderEntry(true); return; }
      if (entry === '' && k === '0') return;
      entry += k;
    }
    renderEntry(true);
  }

  document.querySelectorAll('.key').forEach(b => b.addEventListener('click', () => press(b.dataset.key)));

  // لوحة مفاتيح فعلية (للتجربة على الكمبيوتر)
  document.addEventListener('keydown', e => {
    if (current !== 'measure') return;
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
    else if (e.key === 'Escape') press('clear');
    else if (e.key === 'Enter' && !els.drawBtn.disabled) startDrawing();
  });

  // ---------- الرسم الحي ----------
  function setStatus(text) {
    if (els.status.textContent === text) return;
    if (reduced.matches) { els.status.textContent = text; return; }
    els.status.classList.add('fade');
    setTimeout(() => { els.status.textContent = text; els.status.classList.remove('fade'); }, 300);
  }

  // الزمن داخل المشهد (مع احترام تقليل الحركة)
  function sceneTime(s, t) {
    if (!s.reduced) return { t, final: false };
    // بدون حركة: خط النبض كامل وثابت، ثم اللوحة النهائية مباشرة
    return t < 2 ? { t: s.scene.ECG_S, final: false } : { t: s.scene.doneAt, final: true };
  }

  function paint(t) {
    const s = session;
    const c = s.canvas;
    const w = c.clientWidth;
    if (!w) return;
    const px = Math.round(w * Math.min(2, window.devicePixelRatio || 1));
    const st = sceneTime(s, t);
    const key = st.final + ':' + px + ':' + s.scene.hasArt();
    if (s.reduced && st.final && s.lastKey === key) return; // صورة ثابتة، لا داعي لإعادة الرسم
    s.lastKey = key;
    if (c.width !== px) { c.width = px; c.height = px; }
    s.scene.render(c.getContext('2d'), px, st.t, st.final);
  }

  function startDrawing() {
    const bpm = evaluate(entry).n;
    if (!(bpm >= MIN && bpm <= MAX)) return;

    const scene = N.Scene.create(bpm);
    const canvas = document.createElement('canvas');
    session = {
      bpm, scene, mood: scene.mood, canvas,
      t0: performance.now(), reduced: reduced.matches,
      lastKey: ''
    };
    document.documentElement.style.setProperty('--beat', (60 / bpm).toFixed(3) + 's');

    els.drawBpm.textContent = bpm;
    els.status.textContent = 'نقرأ إيقاعك…';
    els.liveFrame.classList.remove('alive');
    els.artFrame.classList.remove('alive');
    els.liveFrame.replaceChildren(canvas);
    show('drawing');

    cancelAnimationFrame(raf);
    const tick = now => {
      if (!session || session.canvas !== canvas) return;
      const s = session;
      const t = (now - s.t0) / 1000;
      paint(t);

      if (current === 'drawing') {
        if (t >= scene.ECG_S && t < scene.T_DETAIL - 0.6) setStatus(scene.mood.making);
        else if (t >= scene.T_DETAIL - 0.6) setStatus(`نرسم «${scene.mood.name}»…`);

        if (t >= (s.reduced ? 3.2 : scene.handoff)) showResult();
      }

      if (!s.reduced && t >= scene.doneAt && !els.artFrame.classList.contains('alive')) {
        els.artFrame.classList.add('alive');
        els.liveFrame.classList.add('alive');
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  // ---------- النتيجة ----------
  function showResult() {
    const s = session;
    els.artFrame.replaceChildren(s.canvas);
    els.artFrame.setAttribute('aria-label', `لوحة ${s.mood.name}: جبال الطائف مرسومة من نبض ${s.bpm}`);
    els.cardBpm.textContent = s.bpm;
    els.mood.textContent = s.mood.name;
    els.poem.textContent = s.mood.poem;
    els.line.textContent = s.mood.line;
    renderQR(s);
    els.idleBar.style.width = '0%';
    s.lastKey = '';
    show('result');
  }

  // رابط صفحة الجوال: الرقم والبذرة فقط في الـ# (ما يوصل لأي خادم ولا يُحفظ)
  function shareLink(s) {
    const cfg = window.NABDAK_CONFIG || {};
    const base = cfg.shareUrl || (location.href.split('#')[0].replace(/[^/]*$/, '') + 'p.html');
    return `${base}#${s.bpm}.${s.scene.seed.toString(36)}`;
  }

  function renderQR(s) {
    try {
      els.qr.innerHTML = N.QR.svg(shareLink(s), '#020624', '#f6f9fc');
    } catch (e) {
      els.qr.replaceChildren();
    }
  }

  // ---------- الأزرار ----------
  $('#startBtn').addEventListener('click', () => { entry = ''; renderEntry(); show('measure'); });
  $('#backBtn').addEventListener('click', reset);
  els.drawBtn.addEventListener('click', startDrawing);
  els.newBtn.addEventListener('click', reset);

  // ---------- الرجوع التلقائي بعد 60 ثانية بدون لمس ----------
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
    document.addEventListener(ev, () => { lastTouch = Date.now(); }, { capture: true, passive: true }));

  setInterval(() => {
    if (current !== 'measure' && current !== 'result') return;
    const idle = Date.now() - lastTouch;
    if (current === 'result') els.idleBar.style.width = Math.min(100, idle / IDLE_MS * 100) + '%';
    if (idle >= IDLE_MS) reset();
  }, 250);

  // ---------- سلوك الكشك ----------
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault());

  // العمل بدون إنترنت عند تشغيله من خادم (https أو localhost)
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  N.Scene.preload();
  renderEntry();
})(window.Nabdak);

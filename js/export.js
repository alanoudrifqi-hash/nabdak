/* تصدير البطاقة كصورة PNG للطباعة — 1200×1800 (نسبة 4×6 إنش بدقة 300) */
window.Nabdak = window.Nabdak || {};
(function (N) {
  'use strict';

  const W = 1200, H = 1800;
  const C = {
    ink: '#020624', navy: '#0f1543', plum: '#2f2447', violet: '#4a3b68',
    steel: '#58709c', mist: '#b7cddd', lilac: '#d4dafa', snow: '#f6f9fc'
  };
  const AR = '"Noto Naskh Arabic", "Urbanist", serif';
  const EN = '"Urbanist", "Noto Naskh Arabic", sans-serif';

  let logoPromise = null;
  function loadLogo() {
    // نسخة مضمّنة من assets/brand/logo.png حتى ما تتلوث اللوحة لو فُتحت من ملف محلي
    if (!logoPromise) {
      logoPromise = new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = window.NABDAK_LOGO_DATA || 'assets/brand/logo.png';
      });
    }
    return logoPromise;
  }

  async function ensureFonts() {
    if (!document.fonts || !document.fonts.load) return;
    try {
      await Promise.all([
        document.fonts.load(`700 60px ${AR}`, 'نبضي اليوم'),
        document.fonts.load(`400 40px ${AR}`, 'تجربة'),
        document.fonts.load(`800 140px ${EN}`, '0123456789'),
        document.fonts.load(`600 26px ${EN}`, 'Human & Impact')
      ]);
    } catch (e) { /* يكمل بالخط الاحتياطي */ }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrap(ctx, text, maxW) {
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    words.forEach(w => {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
      else cur = test;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  async function buildCard({ scene, bpm, mood, time }) {
    await ensureFonts();
    if (N.Scene && N.Scene.preload) await N.Scene.preload();
    const logo = await loadLogo();
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');

    // الخلفية
    const g = ctx.createLinearGradient(0, 0, W * 0.3, H);
    g.addColorStop(0, C.plum);
    g.addColorStop(1, C.navy);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // الشعار — بدون أي تعديل
    if (logo) {
      const lh = 66, lw = lh * logo.naturalWidth / logo.naturalHeight;
      ctx.drawImage(logo, (W - lw) / 2, 64, lw, lh);
    }

    // اللوحة — تُرسم من جديد بحالتها المكتملة وبدقة الطباعة
    const ax = 80, ay = 180, as = 1040;
    const art = document.createElement('canvas');
    art.width = art.height = as;
    scene.render(art.getContext('2d'), as, time || 0, true);
    ctx.save();
    roundRect(ctx, ax, ay, as, as, 44);
    ctx.clip();
    ctx.drawImage(art, ax, ay, as, as);
    ctx.restore();

    const cx = W / 2;

    // «نبضي اليوم 78»
    ctx.textBaseline = 'alphabetic';
    const label = 'نبضي اليوم';
    ctx.font = `700 56px ${AR}`;
    const wLabel = ctx.measureText(label).width;
    ctx.font = `800 140px ${EN}`;
    const num = String(bpm);
    const wNum = ctx.measureText(num).width;
    const gap = 26;
    const total = wLabel + gap + wNum;
    const right = cx + total / 2;
    const baseY = 1368;
    ctx.direction = 'rtl'; ctx.textAlign = 'right';
    ctx.font = `700 56px ${AR}`;
    ctx.fillStyle = C.lilac;
    ctx.fillText(label, right, baseY);
    ctx.direction = 'ltr'; ctx.textAlign = 'right';
    ctx.font = `800 140px ${EN}`;
    ctx.fillStyle = C.snow;
    ctx.fillText(num, right - wLabel - gap, baseY);

    // اسم اللوحة
    ctx.direction = 'rtl'; ctx.textAlign = 'center';
    ctx.font = `700 78px ${AR}`;
    ctx.fillStyle = C.snow;
    ctx.fillText(mood.name, cx, 1476);

    // الجملة الشعرية وسطر الشرح (يتغيرون حسب المشهد)
    ctx.font = `400 46px ${AR}`;
    ctx.fillStyle = C.lilac;
    wrap(ctx, mood.poem, 1000).slice(0, 1).forEach(ln => ctx.fillText(ln, cx, 1556));
    ctx.font = `400 34px ${AR}`;
    ctx.fillStyle = C.mist;
    wrap(ctx, mood.line, 1000).slice(0, 2).forEach((ln, i) => ctx.fillText(ln, cx, 1626 + i * 50));

    // التذييل
    ctx.direction = 'rtl'; ctx.textAlign = 'center';
    ctx.font = `400 28px ${AR}`;
    ctx.fillStyle = C.mist;
    ctx.fillText('تجربة توعوية وليست تشخيصًا', cx, H - 60);
    ctx.direction = 'ltr';
    ctx.font = `600 22px ${EN}`;
    ctx.fillStyle = C.steel;
    ctx.fillText('HUMAN & IMPACT', cx, H - 22);

    return cv;
  }

  N.Export = {
    build: buildCard,
    async save(opts) {
      const cv = await buildCard(opts);
      const blob = await new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('blob')), 'image/png'));
      const name = `nabdak-${opts.bpm}.png`;

      // على الآيباد: قائمة المشاركة تعطي «حفظ الصورة» و«طباعة» مباشرة
      const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
      if (coarse && typeof File === 'function' && navigator.canShare) {
        const file = new File([blob], name, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: 'لوحة نبضك' });
            return 'shared';
          } catch (e) {
            if (e && e.name === 'AbortError') return 'cancelled';
          }
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return 'downloaded';
    }
  };
})(window.Nabdak);

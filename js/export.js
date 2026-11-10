/* تصدير البطاقة كصورة PNG للطباعة — 1200×1800 (نسبة 4×6 إنش بدقة 300) */
window.Nabdak = window.Nabdak || {};
(function (N) {
  'use strict';

  const W = 1200, H = 1800;
  // ألوان نقلة الست
  const C = {
    deep: '#01141B', ink: '#012535', blue: '#2F7BAA',
    silver: '#C0C9CE', paper: '#F4F5F4', cyan: '#7ECEEC'
  };
  const AR = '"Thmanyah", Tahoma, sans-serif';
  const EN = '"Thmanyah", Arial, sans-serif';
  const NUM = 'Arial, Helvetica, sans-serif';

  // نسخ مضمّنة من الشعارين (assets/brand/logo-data.js) حتى ما تتلوث اللوحة لو فُتحت من ملف محلي
  const logoPromises = {};
  function loadImg(key, data, file) {
    if (!logoPromises[key]) {
      logoPromises[key] = new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = data || file;
      });
    }
    return logoPromises[key];
  }
  const loadRowad = () => loadImg('rowad', window.NABDAK_LOGO_DATA, 'assets/brand/rowad-white.png');
  const loadNaqla = () => loadImg('naqla', window.NABDAK_NAQLA_DATA, 'assets/brand/naqla-white.png');

  async function ensureFonts() {
    if (!document.fonts || !document.fonts.load) return;
    try {
      await Promise.all([
        document.fonts.load(`500 60px ${AR}`, 'نبضي اليوم'),
        document.fonts.load(`400 40px ${AR}`, 'تجربة'),
        document.fonts.load(`500 26px ${EN}`, 'Human & Impact')
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
    const [rowad, naqla] = await Promise.all([loadRowad(), loadNaqla()]);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');

    // الخلفية: عمق نقلة مع توهج أزرق هادئ
    ctx.fillStyle = C.deep;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W * 0.2, H * 0.12, 0, W * 0.2, H * 0.12, W * 1.1);
    glow.addColorStop(0, 'rgba(47,123,170,0.55)');
    glow.addColorStop(1, 'rgba(47,123,170,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    const low = ctx.createLinearGradient(0, H * 0.55, 0, H);
    low.addColorStop(0, 'rgba(1,37,53,0)');
    low.addColorStop(1, 'rgba(1,37,53,0.9)');
    ctx.fillStyle = low;
    ctx.fillRect(0, 0, W, H);

    // الشعارين — بدون أي تعديل على النسب: نقلة يمين، رواد يسار، وبينهم خط فضي
    {
      const rh = 120, nh = 66, gapL = 48, cy = 98;
      const rw = rowad ? rh * rowad.naturalWidth / rowad.naturalHeight : 0;
      const nw = naqla ? nh * naqla.naturalWidth / naqla.naturalHeight : 0;
      const total = rw + nw + (rowad && naqla ? gapL * 2 : 0);
      let x = (W - total) / 2;
      if (rowad) { ctx.drawImage(rowad, x, cy - rh / 2, rw, rh); x += rw; }
      if (rowad && naqla) {
        ctx.fillStyle = 'rgba(192,201,206,0.45)';
        ctx.fillRect(x + gapL - 1, cy - 34, 2, 68);
        x += gapL * 2;
      }
      if (naqla) ctx.drawImage(naqla, x, cy - nh / 2, nw, nh);
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
    ctx.font = `500 56px ${AR}`;
    const wLabel = ctx.measureText(label).width;
    ctx.font = `400 140px ${NUM}`;
    const num = String(bpm);
    const wNum = ctx.measureText(num).width;
    const gap = 26;
    const total = wLabel + gap + wNum;
    const right = cx + total / 2;
    const baseY = 1368;
    ctx.direction = 'rtl'; ctx.textAlign = 'right';
    ctx.font = `500 56px ${AR}`;
    ctx.fillStyle = C.cyan;
    ctx.fillText(label, right, baseY);
    ctx.direction = 'ltr'; ctx.textAlign = 'right';
    ctx.font = `400 140px ${NUM}`;
    ctx.fillStyle = C.paper;
    ctx.fillText(num, right - wLabel - gap, baseY);

    // اسم اللوحة
    ctx.direction = 'rtl'; ctx.textAlign = 'center';
    ctx.font = `500 78px ${AR}`;
    ctx.fillStyle = C.paper;
    ctx.fillText(mood.name, cx, 1476);

    // الجملة الشعرية وسطر الشرح (يتغيرون حسب المشهد)
    ctx.font = `400 46px ${AR}`;
    ctx.fillStyle = C.cyan;
    wrap(ctx, mood.poem, 1000).slice(0, 1).forEach(ln => ctx.fillText(ln, cx, 1556));
    ctx.font = `400 34px ${AR}`;
    ctx.fillStyle = C.silver;
    wrap(ctx, mood.line, 1000).slice(0, 2).forEach((ln, i) => ctx.fillText(ln, cx, 1626 + i * 50));

    // التذييل
    ctx.direction = 'rtl'; ctx.textAlign = 'center';
    ctx.font = `400 28px ${AR}`;
    ctx.fillStyle = C.silver;
    ctx.fillText('تجربة توعوية وليست تشخيصًا', cx, H - 60);
    ctx.direction = 'ltr';
    ctx.font = `500 22px ${EN}`;
    ctx.fillStyle = C.blue;
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

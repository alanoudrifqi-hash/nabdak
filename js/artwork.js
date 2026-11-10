/* =========================================================
   «لوحة نبضك» — أربع مشاهد من الطائف، كل مشهد يحوّل خط النبض لعنصر مختلف:
     أقل من 65   «ليل الهدا»     → جبال ورقية تحت قمر وضباب
     65–80       «تلفريك الهدا»  → سلك تلفريك بين برجين، وعربات تمشي عليه
     81–95       «ورد الطائف»    → غصن ورد، وعند كل نبضة وردة تتفتح
     فوق 95      «سماء عكاظ»     → خيام تراثية، ومن كل نبضة لعبة نارية
   المشترك: خط نبض يمشي من اليمين لليسار 3 ثواني، يوقف، ثم يتحول.
   كل شيء بإحداثيات نسبية (0–1) عشان يطلع بأي مقاس. ألوان الهوية فقط.
   ========================================================= */
window.Nabdak = window.Nabdak || {};
(function (N) {
  'use strict';

  // ألوان هوية نقلة (نفس أسماء الأدوار القديمة عشان الرسم ما يتغير)
  const P = {
    ink: '#01141B',    // deep
    navy: '#012535',   // ink
    plum: '#062F45',   // ink ↔ blue (درجة وسيطة للتدرجات)
    violet: '#1A587F', // درجة أغمق من الأزرق
    steel: '#2F7BAA',  // blue
    mist: '#C0C9CE',   // silver
    lilac: '#7ECEEC',  // cyan
    snow: '#F4F5F4'    // paper
  };
  const TAU = Math.PI * 2;

  const MOODS = {
    calm: {
      id: 'calm', name: 'ليل الهدا',
      poem: 'قلبك هادي مثل ليل الهدا',
      line: 'قمم هذي الجبال مرسومة من نبضات قلبك',
      making: 'نحوّل نبضاتك إلى قمم جبال…'
    },
    breeze: {
      id: 'breeze', name: 'تلفريك الهدا',
      poem: 'قلبك يمشي بين القمم على مهله',
      line: 'سلك التلفريك مرسوم من نبضات قلبك',
      making: 'نمد سلك التلفريك من نبضاتك…'
    },
    rose: {
      id: 'rose', name: 'ورد الطائف',
      poem: 'في قلبك موسم ورد ما يخلص',
      line: 'كل وردة تفتحت مع نبضة من قلبك',
      making: 'نزرع غصن ورد من نبضاتك…'
    },
    energy: {
      id: 'energy', name: 'سماء عكاظ',
      poem: 'حماسك يضوّي سماء عكاظ',
      line: 'كل لعبة نارية انطلقت مع نبضة من قلبك',
      making: 'نجهّز سماء عكاظ من نبضاتك…'
    }
  };
  function moodFor(b) {
    if (b < 65) return MOODS.calm;
    if (b <= 80) return MOODS.breeze;
    if (b <= 95) return MOODS.rose;
    return MOODS.energy;
  }

  // ---------- خلفيات المزاج (assets/art) ----------
  const ART_DIR = 'assets/art/';
  const ART_EXT = (() => {
    const pref = ((self.NABDAK_CONFIG || {}).artExt || 'png').replace('.', '');
    return [pref].concat(['png', 'jpg', 'webp'].filter(x => x !== pref));
  })();
  const art = {};
  function loadArt(id) {
    return new Promise(resolve => {
      let i = 0;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { art[id] = img; resolve(img); };
      img.onerror = () => { if (++i < ART_EXT.length) img.src = ART_DIR + id + '.' + ART_EXT[i]; else resolve(null); };
      img.src = ART_DIR + id + '.' + ART_EXT[0];
    });
  }
  let preloading = null;
  function preload() {
    if (!preloading) preloading = Promise.all(Object.keys(MOODS).map(loadArt));
    return preloading;
  }

  // ---------- الخط الزمني (بالثواني) ----------
  const ECG_S = 3;                          // خط النبض
  const PAUSE = 0.35;                       // يتوقف
  const MORPH_S = 2.0;                      // يتحول
  const T_MORPH = ECG_S + PAUSE;
  const T_BUILD = T_MORPH + 0.4;            // تظهر الخلفية بهدوء
  const T_DETAIL = T_MORPH + MORPH_S + 0.2; // التفاصيل
  const NPTS = 420;
  const ECG_BASE = 0.52;
  const BAND = 0.66;                        // بداية الثلث السفلي الداكن في الخلفيات

  // ---------- أدوات ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const easeInOut = p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const easeOut = p => 1 - Math.pow(1 - p, 3);
  const easeSoft = p => 1 - Math.pow(1 - p, 4);
  const wrap = (v, min, max) => min + ((((v - min) % (max - min)) + (max - min)) % (max - min));
  const lerp = (a, b, k) => a + (b - a) * k;

  function sessionSalt() {
    try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0]; }
    catch (e) { return Math.floor(Math.random() * 4294967296); }
  }

  // شكل نبضة واحدة (P, QRS, T)
  function ecgWave(tau, T) {
    const s = Math.min(1, T / 0.85);
    const g = (c, w, a) => a * Math.exp(-((tau - c * s) ** 2) / (2 * (w * s) ** 2));
    return g(0.10, 0.030, 0.12) + g(0.21, 0.009, -0.10) + g(0.24, 0.011, 1) +
           g(0.27, 0.010, -0.22) + g(0.46, 0.045, 0.22);
  }

  // قمة ناعمة برأس مدوّر
  function peakAt(u, p, tip) {
    const d = u < p.u ? (p.u - u) / p.wl : (u - p.u) / p.wr;
    if (d >= 1) return 0;
    const tn = Math.sqrt(1 + tip * tip) - tip;
    const ds = (Math.sqrt(d * d + tip * tip) - tip) / tn;
    return ds >= 1 ? 0 : p.h * Math.pow(1 - ds, 1.45);
  }
  // سلسلة جبال بسيطة (للطبقات البعيدة)
  function makeRange(r, base, amp, n, tip) {
    const pk = [];
    for (let k = 0; k < n; k++) pk.push({ u: r() * 1.2 - 0.1, h: amp * (0.55 + 0.6 * r()), wl: 0.12 + 0.16 * r(), wr: 0.12 + 0.16 * r() });
    const pts = [];
    for (let i = 0; i <= 120; i++) {
      const u = i / 120;
      let h = amp * 0.2;
      for (const p of pk) h = Math.max(h, peakAt(u, p, tip));
      pts.push([u, base - h]);
    }
    return pts;
  }

  function pathOf(ctx, pts, i0, i1) {
    ctx.beginPath();
    ctx.moveTo(pts[i0][0], pts[i0][1]);
    for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  }
  function fillRange(ctx, pts, col, a) {
    ctx.globalAlpha = a;
    ctx.fillStyle = col;
    pathOf(ctx, pts, 0, pts.length - 1);
    ctx.lineTo(1.02, 1.02); ctx.lineTo(-0.02, 1.02); ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  function roundRect(ctx, x, y, w, h, rad) {
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }
  function glow(ctx, x, y, rad, col, a) {
    if (a <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, rgba(col, a));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
  }
  function drawCover(ctx, img) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const s = Math.max(1 / iw, 1 / ih);
    const w = iw * s, h = ih * s;
    ctx.drawImage(img, (1 - w) / 2, (1 - h) / 2, w, h);
  }

  // نجوم: نقاط ناعمة متوهجة تلمع ببطء
  function makeStars(r, n, maxV) {
    const stars = [];
    for (let i = 0; i < n; i++) {
      stars.push({ u: r(), v: 0.03 + Math.pow(r(), 1.3) * maxV, rad: 0.0018 + 0.0022 * r(),
                   a: 0.4 + 0.5 * r(), sp: 0.35 + 0.5 * r(), ph: r() * TAU });
    }
    return stars;
  }
  function drawStars(ctx, stars, t, d) {
    for (const st of stars) {
      const a = st.a * (0.6 + 0.4 * Math.sin(t * st.sp + st.ph)) * d;
      const g = ctx.createRadialGradient(st.u, st.v, 0, st.u, st.v, st.rad * 3);
      g.addColorStop(0, rgba(P.snow, a));
      g.addColorStop(0.35, rgba(P.lilac, a * 0.45));
      g.addColorStop(1, rgba(P.lilac, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(st.u, st.v, st.rad * 3, 0, TAU); ctx.fill();
    }
  }

  // ضباب: بقع شفافة عريضة تمشي ببطء
  function makeFog(r, y, n, spread, a0) {
    const fog = [];
    for (let i = 0; i < n; i++) {
      fog.push({ u: i / n + 0.1 * r(), v: y + (r() - 0.5) * spread, w: 0.45 + 0.3 * r(), h: 0.04 + 0.025 * r(),
                 sp: (0.004 + 0.003 * r()) * (r() < 0.3 ? -1 : 1), a: a0 * (0.75 + 0.5 * r()) });
    }
    return fog;
  }
  function drawFog(ctx, fog, t, d) {
    for (const f of fog) {
      const x = wrap(f.u + f.sp * t, -0.45, 1.45);
      ctx.save();
      ctx.translate(x, f.v);
      ctx.scale(f.w, f.h);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, rgba(P.lilac, f.a * d));
      g.addColorStop(0.6, rgba(P.mist, f.a * 0.45 * d));
      g.addColorStop(1, rgba(P.mist, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  // سحب ناعمة: كبسولة وفوقها دوائر
  function makeClouds(r, n, v0, v1) {
    const clouds = [];
    for (let i = 0; i < n; i++) {
      const w = 0.12 + 0.1 * r();
      const bumps = [];
      const nb = 2 + Math.floor(r() * 2);
      for (let k = 0; k < nb; k++) bumps.push({ x: -w * 0.3 + (w * 0.6) * (k + 0.5) / nb + (r() - 0.5) * 0.02, r: w * (0.17 + 0.08 * r()) });
      clouds.push({ u: i / n + 0.15 * r(), v: v0 + (v1 - v0) * r(), w, h: w * 0.24, bumps,
                    sp: 0.005 + 0.006 * r(), col: r() < 0.5 ? P.lilac : P.mist, a: 0.35 + 0.3 * r() });
    }
    return clouds;
  }
  function drawClouds(ctx, clouds, t, d) {
    for (const c of clouds) {
      const x = wrap(c.u + c.sp * t, -0.25, 1.25);
      ctx.fillStyle = rgba(c.col, c.a * d);
      ctx.beginPath();
      ctx.moveTo(x - c.w / 2 + c.h / 2, c.v + c.h / 2);
      ctx.arc(x + c.w / 2 - c.h / 2, c.v, c.h / 2, Math.PI / 2, -Math.PI / 2, true);
      ctx.arc(x - c.w / 2 + c.h / 2, c.v, c.h / 2, -Math.PI / 2, Math.PI / 2, true);
      ctx.fill();
      for (const b of c.bumps) { ctx.beginPath(); ctx.arc(x + b.x, c.v - c.h * 0.2, b.r, Math.PI, 0); ctx.fill(); }
    }
  }

  // خيط الضوء (خط النبض)
  function drawThread(ctx, pts, i0, i1, px, onEcg, beat, a) {
    if (i1 <= i0) return;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.shadowColor = P.snow;
    ctx.shadowBlur = px * (0.008 + 0.012 * onEcg + 0.012 * beat * (1 - onEcg));
    ctx.strokeStyle = rgba(P.snow, (0.7 + 0.3 * beat) * (0.75 + 0.25 * onEcg) * a);
    ctx.lineWidth = 0.0025 + 0.003 * onEcg + 0.0012 * beat * (1 - onEcg);
    pathOf(ctx, pts, i0, i1);
    ctx.stroke();
    ctx.restore();
  }

  // طبقة ورق مرفوعة: تعبئة بظل ناعم فوقها
  function paperFill(ctx, px, col, a, build) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.shadowColor = rgba(P.ink, 0.85);
    ctx.shadowBlur = px * 0.045;
    ctx.shadowOffsetY = -px * 0.008;
    ctx.fillStyle = col;
    build();
    ctx.fill();
    ctx.restore();
  }

  // ---------- وردة طائفية: 3 طبقات بتلات مستديرة متداخلة ----------
  const ROSE_RINGS = [
    { n: 6, dist: 0.56, rad: 0.50, col: P.lilac, off: 0 },
    { n: 5, dist: 0.32, rad: 0.38, col: P.mist,  off: 0.5 },
    { n: 4, dist: 0.14, rad: 0.26, col: P.steel, off: 0.25 }
  ];
  function drawRose(ctx, x, y, R, b, rot) {
    if (b <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    const lb = easeSoft(clamp01(b * 1.6));
    if (lb > 0) {
      ctx.fillStyle = rgba(P.steel, 0.9);
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.rotate(side * 0.95 + rot * 0.15);
        ctx.scale(lb, lb);
        ctx.beginPath(); ctx.ellipse(0, R * 0.95, R * 0.28, R * 0.62, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
    const sb = easeSoft(clamp01(b * 1.4));
    ctx.fillStyle = rgba(P.ink, 0.28 * clamp01(b * 2));
    ctx.beginPath(); ctx.ellipse(0, R * 0.12, R * 1.02 * sb, R * 0.96 * sb, 0, 0, TAU); ctx.fill();
    ctx.rotate(rot);
    ctx.strokeStyle = rgba(P.navy, 0.32);
    ROSE_RINGS.forEach((ring, k) => {
      const p = easeSoft(clamp01((b - k * 0.18) / 0.64));
      if (p <= 0) return;
      const rr = R * ring.rad * (0.35 + 0.65 * p);
      const dd = R * ring.dist * p;
      ctx.lineWidth = R * 0.045;
      ctx.fillStyle = ring.col;
      for (let j = 0; j < ring.n; j++) {
        const a = (j + ring.off) * TAU / ring.n + (1 - p) * 0.6;
        ctx.beginPath(); ctx.arc(Math.cos(a) * dd, Math.sin(a) * dd, rr, 0, TAU);
        ctx.fill(); ctx.stroke();
      }
    });
    const cp = easeSoft(clamp01((b - 0.5) / 0.5));
    if (cp > 0) {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.2);
      g.addColorStop(0, P.plum); g.addColorStop(1, P.violet);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, R * 0.2 * cp, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- سماء احتياطية لكل مشهد (لو ما فيه صورة) ----------
  function makeFallback(mood, r) {
    const sky = {
      calm:   [[0, P.navy], [0.55, P.plum], [0.75, P.violet]],
      breeze: [[0, P.plum], [0.5, P.violet], [0.8, P.steel]],
      rose:   [[0, P.plum], [0.38, P.violet], [0.58, P.steel], [0.7, P.mist]],
      energy: [[0, P.ink], [0.55, P.plum], [0.85, P.violet]]
    }[mood.id];
    const ranges = {
      calm:   [[P.steel, 0.35, makeRange(r, 0.6, 0.11, 4, 0.2)], [P.violet, 0.85, makeRange(r, 0.68, 0.1, 4, 0.2)]],
      breeze: [[P.mist, 0.25, makeRange(r, 0.5, 0.08, 4, 0.25)]],
      rose:   [[P.mist, 0.55, makeRange(r, 0.64, 0.08, 4, 0.3)], [P.steel, 0.5, makeRange(r, 0.72, 0.07, 4, 0.3)]],
      energy: [[P.violet, 0.6, makeRange(r, 0.82, 0.08, 4, 0.25)]]
    }[mood.id];
    const moon = mood.id === 'calm' ? { u: 0.7 + 0.15 * r(), v: 0.15 + 0.05 * r(), R: 0.05 }
      : mood.id === 'breeze' ? { u: 0.25 + 0.5 * r(), v: 0.14, R: 0.03 } : null;
    return function (ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, 1);
      sky.forEach(([o, c]) => g.addColorStop(o, c));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1, 1);
      if (mood.id === 'rose') glow(ctx, 0.5, 0.66, 0.5, P.lilac, 0.55);   // ضوء الفجر
      if (moon) {
        glow(ctx, moon.u, moon.v, moon.R * 3.2, P.lilac, 0.28);
        for (let i = 2; i >= 1; i--) {
          ctx.strokeStyle = rgba(P.lilac, 0.32 - i * 0.08);
          ctx.lineWidth = 0.0018;
          ctx.beginPath(); ctx.arc(moon.u, moon.v, moon.R * (1 + i * 0.5), 0, TAU); ctx.stroke();
        }
        ctx.fillStyle = P.lilac;
        ctx.beginPath(); ctx.arc(moon.u, moon.v, moon.R, 0, TAU); ctx.fill();
      }
      ranges.forEach(([c, a, pts]) => fillRange(ctx, pts, c, a));
      if (mood.id === 'rose') {
        const gg = ctx.createLinearGradient(0, 0.7, 0, 1);
        gg.addColorStop(0, rgba(P.violet, 0)); gg.addColorStop(0.25, P.violet); gg.addColorStop(1, P.plum);
        ctx.fillStyle = gg;
        ctx.fillRect(0, 0.7, 1, 0.3);
      }
    };
  }

  // =========================================================
  // المشاهد. كل مشهد يرجع:
  //   target[i]  — وين تروح كل نقطة من خط النبض
  //   morphAt?   — تحول لكل نقطة (لو المشهد يرسم من جهة لجهة)
  //   back / line / front — طبقات الرسم
  //   doneAt     — متى يكتمل
  // =========================================================

  // ---------- ١. ليل الهدا: جبال ورقية ناعمة ----------
  function sceneCalm(S) {
    const { r, level, T, s, U } = S;
    const A = 0.23 + 0.12 * level;
    const pw = Math.min(0.38, Math.max(0.22, (T / ECG_S) * 1.1));
    const peaks = S.peakUs.map(u => ({ u, h: A * (0.8 + 0.4 * r()), wl: pw * (0.85 + 0.4 * r()), wr: pw * (0.85 + 0.4 * r()) }));
    const hills = peaks.map(p => ({ u: p.u - (0.22 * s) / ECG_S, h: p.h * (0.3 + 0.12 * r()), wl: pw * 0.65, wr: pw * 0.65 }));
    hills.push({ u: 1.04, h: A * (0.35 + 0.25 * r()), wl: 0.24, wr: 0.24 }, { u: -0.04, h: A * (0.35 + 0.25 * r()), wl: 0.24, wr: 0.24 });
    peaks.forEach(p => {
      const side = r() < 0.5 ? -1 : 1;
      hills.push({ u: p.u + side * (p.wr + p.wl) * (0.2 + 0.1 * r()), h: p.h * (0.45 + 0.12 * r()), wl: pw * 0.45, wr: pw * 0.45 });
    });
    const q1 = r() * TAU;
    const K = 0.02, TIP = 0.32;                     // نعومة أكثر
    const ridge = u => {
      let sum = Math.exp(0.03 / K);
      for (const p of peaks) sum += Math.exp(peakAt(u, p, TIP) / K);
      for (const p of hills) sum += Math.exp(peakAt(u, p, TIP) / K);
      return K * Math.log(sum) * (1 + 0.03 * Math.sin(u * 19 + q1));
    };
    const H = U.map(ridge);
    const base = BAND + Math.min(...H);              // أخفض وادي على حافة الثلث الداكن
    const target = H.map(h => base - h);
    const topY = Math.min(...target);
    const stars = makeStars(r, 18, Math.max(0.1, topY - 0.08));
    const fog = makeFog(r, base - A * 0.55, 5, 0.05, 0.13);
    const fogLow = makeFog(r, BAND + 0.02, 3, 0.03, 0.06);

    return {
      target,
      doneAt: T_DETAIL + 1.6,
      back(ctx, t, d) { drawStars(ctx, stars, t, d); drawFog(ctx, fog, t, d); },
      line(ctx, pts, L) {
        if (L.fillA > 0) {
          paperFill(ctx, L.px, P.navy, L.fillA, () => {
            pathOf(ctx, pts, 0, NPTS - 1);
            ctx.lineTo(-0.02, pts[NPTS - 1][1]); ctx.lineTo(-0.02, 1.02); ctx.lineTo(1.02, 1.02); ctx.lineTo(1.02, pts[0][1]);
            ctx.closePath();
          });
          // حافة الورق: ظل داخلي خفيف
          ctx.save();
          ctx.globalAlpha = L.fillA * 0.5;
          pathOf(ctx, pts, 0, NPTS - 1);
          ctx.lineTo(-0.02, 1.02); ctx.lineTo(1.02, 1.02); ctx.closePath();
          ctx.clip();
          ctx.lineJoin = 'round';
          [[0.004, 0.006, 0.5], [0.01, 0.01, 0.25], [0.018, 0.014, 0.12]].forEach(([dy, w, a]) => {
            ctx.strokeStyle = rgba(P.ink, a); ctx.lineWidth = w;
            pathOf(ctx, pts.map(p => [p[0], p[1] + dy]), 0, NPTS - 1);
            ctx.stroke();
          });
          ctx.restore();
          drawFog(ctx, fogLow, L.t, L.d);
        }
        drawThread(ctx, pts, 0, L.head, L.px, L.onEcg, L.beat, 1);
      }
    };
  }

  // ---------- ٢. تلفريك الهدا: سلك بين برجين، وعربات تمشي عليه ----------
  function sceneBreeze(S) {
    const { r, bpm, U } = S;
    const lv = clamp01((bpm - 65) / 15);
    const uL = 0.1 + 0.03 * r(), uR = 0.9 - 0.03 * r();
    const pkL = 0.47 + 0.05 * r(), pkR = 0.42 + 0.05 * r();
    const TOWER = 0.105;
    const q1 = r() * TAU, q2 = r() * TAU;
    // جبل بقمة مدوّرة: سفح هادي للخارج، وسفح حاد ينزل للوادي
    const mountain = (u, uc, pk, outSlope, inSlope, dir, q) => {
      const dd = (u - uc) * dir;                     // موجب = باتجاه الوادي
      const c = 0.035;
      const ds = Math.sqrt(dd * dd + c * c) - c;     // رأس مدوّر
      const drop = dd > 0 ? 0.56 * (1 - Math.exp(-ds / 0.2)) : outSlope * ds;   // ينزل بقوة ثم يهدأ عند قاع الوادي
      return pk + drop + 0.008 * Math.sin(u * 31 + q);
    };
    const yL = u => mountain(u, uL, pkL, 0.35, 0, 1, q1);
    const yR = u => mountain(u, uR, pkR, 0.35, 0, -1, q2);
    const aL = [uL, pkL - TOWER], aR = [uR, pkR - TOWER];
    const sag = 0.08 + 0.1 * lv;                     // ترهّل السلك من رقم النبض
    const cable = u => {
      const x = (u - uL) / (uR - uL);
      return lerp(aL[1], aR[1], x) + sag * 4 * x * (1 - x);
    };
    const target = U.map(u => (u <= uL ? yL(u) : u >= uR ? yR(u) : cable(u)));

    // وادي عميق: طبقات جبال تفتح كل ما بعدت، وبينها ضباب
    const valley = [
      { pts: makeRange(r, 0.64, 0.07, 5, 0.3), col: P.mist, a: 0.32 },
      { pts: makeRange(r, 0.74, 0.08, 5, 0.3), col: P.steel, a: 0.6 },
      { pts: makeRange(r, 0.85, 0.08, 5, 0.3), col: P.violet, a: 0.92 }
    ];
    const fog1 = makeFog(r, 0.66, 4, 0.03, 0.14), fog2 = makeFog(r, 0.78, 4, 0.03, 0.12);
    const clouds = makeClouds(r, 4, 0.1, 0.3);
    const stars = makeStars(r, 10, 0.3);

    const nCars = bpm < 73 ? 3 : 4;
    const cars = [];
    for (let i = 0; i < nCars; i++) cars.push({ p0: i / nCars + 0.04 * r(), ph: r() * TAU });
    const SPEED = 0.016;                              // بطيئة وهادئة

    function tower(ctx, x, top, footY, a) {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = P.steel;
      ctx.lineCap = 'round';
      ctx.lineWidth = 0.004;
      const wb = 0.022, wt = 0.007;
      ctx.beginPath();
      ctx.moveTo(x - wb, footY); ctx.lineTo(x - wt, top);
      ctx.moveTo(x + wb, footY); ctx.lineTo(x + wt, top);
      ctx.stroke();
      ctx.lineWidth = 0.0018;
      ctx.beginPath();
      const n = 4;
      for (let k = 0; k < n; k++) {
        const y0 = lerp(footY, top, k / n), y1 = lerp(footY, top, (k + 1) / n);
        const w0 = lerp(wb, wt, k / n), w1 = lerp(wb, wt, (k + 1) / n);
        ctx.moveTo(x - w0, y0); ctx.lineTo(x + w1, y1);
        ctx.moveTo(x + w0, y0); ctx.lineTo(x - w1, y1);
      }
      ctx.stroke();
      // ذراع البكرة
      ctx.lineWidth = 0.004;
      ctx.beginPath(); ctx.moveTo(x - 0.018, top); ctx.lineTo(x + 0.018, top); ctx.stroke();
      glow(ctx, x, top - 0.006, 0.02, P.lilac, 0.6);
      ctx.fillStyle = P.snow;
      ctx.beginPath(); ctx.arc(x, top - 0.006, 0.0035, 0, TAU); ctx.fill();
      ctx.restore();
    }

    function car(ctx, x, y, ang, a) {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(x, y);
      // البكرة على السلك
      ctx.fillStyle = P.steel;
      roundRect(ctx, -0.009, -0.004, 0.018, 0.008, 0.004); ctx.fill();
      ctx.rotate(ang);
      ctx.strokeStyle = P.steel; ctx.lineWidth = 0.0022;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 0.026); ctx.stroke();
      const w = 0.056, h = 0.04, y0 = 0.026;
      ctx.save();
      ctx.shadowColor = rgba(P.ink, 0.6); ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
      ctx.fillStyle = P.violet;
      roundRect(ctx, -w / 2, y0, w, h, 0.009); ctx.fill();
      ctx.restore();
      ctx.fillStyle = P.steel;
      roundRect(ctx, -w / 2, y0, w, 0.008, 0.004); ctx.fill();
      // نوافذ مضيئة
      const ww = 0.012, wh = 0.015, gap = 0.004;
      for (let k = -1; k <= 1; k++) {
        const wx = k * (ww + gap) - ww / 2, wy = y0 + 0.013;
        glow(ctx, wx + ww / 2, wy + wh / 2, 0.016, P.lilac, 0.35);
        ctx.fillStyle = k === 0 ? P.snow : P.lilac;
        roundRect(ctx, wx, wy, ww, wh, 0.003); ctx.fill();
      }
      ctx.restore();
    }

    return {
      target,
      doneAt: T_DETAIL + 1.8,
      back(ctx, t, d) {
        drawStars(ctx, stars, t, d);
        drawClouds(ctx, clouds, t, d);
        valley.forEach((v, k) => {
          fillRange(ctx, v.pts, v.col, v.a * d);
          if (k === 0) drawFog(ctx, fog1, t, d);
          if (k === 1) drawFog(ctx, fog2, t, d);
        });
      },
      line(ctx, pts, L) {
        if (L.fillA > 0) {
          paperFill(ctx, L.px, P.navy, L.fillA, () => {
            ctx.beginPath();
            ctx.moveTo(-0.02, 1.02);
            for (let u = -0.02; u <= 1.02; u += 0.005) ctx.lineTo(u, Math.min(1.05, yL(u), yR(u)));
            ctx.lineTo(1.02, 1.05); ctx.closePath();
          });
          tower(ctx, uL, aL[1], pkL + 0.012, L.fillA);
          tower(ctx, uR, aR[1], pkR + 0.012, L.fillA);
        }
        drawThread(ctx, pts, 0, L.head, L.px, L.onEcg, L.beat, 1);
      },
      front(ctx, t, d) {
        if (d <= 0) return;
        const since = S.beatSince(t);
        const kick = Math.exp(-since / 0.35) * Math.sin(since * 13);   // هزة خفيفة مع كل نبضة
        for (const c of cars) {
          const p = wrap(c.p0 + SPEED * t, 0, 1);
          const x = uR - p * (uR - uL);
          const fade = clamp01(Math.min(p, 1 - p) / 0.07);
          const ang = 0.07 * kick + 0.015 * Math.sin(t * 0.9 + c.ph);
          car(ctx, x, cable(x), ang, d * fade);
        }
      }
    };
  }

  // ---------- ٣. ورد الطائف: غصن من اليسار لليمين، ووردة عند كل نبضة ----------
  function sceneRose(S) {
    const { r, bpm, U } = S;
    const lv = clamp01((bpm - 81) / 14);
    const SWEEP = 1.9;                               // الغصن ينرسم من اليسار لليمين
    const ph = r() * TAU;
    const baseY = u => 0.64 - 0.05 * u + 0.018 * Math.sin(u * 5.5 + ph);
    const bumps = S.peakUs.map(u => ({ u, h: (0.085 + 0.05 * lv) * (0.85 + 0.3 * r()), w: 0.055 + 0.01 * r() }));
    const branchY = u => {
      let y = baseY(u);
      for (const b of bumps) y -= b.h * Math.exp(-(((u - b.u) / b.w) ** 2));
      return y;
    };
    const target = U.map(branchY);
    const morphAt = (u, t) => easeInOut(clamp01((t - T_MORPH - u * SWEEP) / 0.9));

    const roses = bumps.filter(b => b.u > 0.04 && b.u < 0.96).map(b => ({
      u: b.u, y: branchY(b.u) - 0.012, R: 0.05 + 0.012 * r(), rot: r() * TAU,
      start: T_MORPH + b.u * SWEEP + 0.55
    }));
    const leaves = [];
    let side = 1;
    for (let u = 0.03 + 0.03 * r(); u < 0.98; u += 0.055 + 0.025 * r()) {
      if (roses.some(ro => Math.abs(ro.u - u) < 0.035)) continue;
      const dy = (branchY(u + 0.005) - branchY(u - 0.005)) / 0.01;
      leaves.push({ u, y: branchY(u), ang: Math.atan(dy) + side * (0.75 + 0.3 * r()), L: 0.022 + 0.012 * r(),
                    col: r() < 0.6 ? P.violet : P.steel, start: T_MORPH + u * SWEEP + 0.35 });
      side = -side;
    }
    const fog = makeFog(r, 0.6, 5, 0.04, 0.12);
    const stars = makeStars(r, 8, 0.25);
    const BLOOM = 1.5;
    const lastRose = roses.length ? Math.max(...roses.map(x => x.start)) + BLOOM : 0;

    function leaf(ctx, x, y, ang, L, col, k) {
      if (k <= 0) return;
      ctx.save();
      ctx.translate(x, y); ctx.rotate(ang); ctx.scale(k, k);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(L * 0.55, 0, L * 0.55, L * 0.22, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(P.steel, 0.7); ctx.lineWidth = 0.0012;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L * 0.95, 0); ctx.stroke();
      ctx.restore();
    }

    return {
      target, morphAt,
      doneAt: Math.max(T_DETAIL + 1.6, lastRose, T_MORPH + SWEEP + 1.2),
      back(ctx, t, d) { drawStars(ctx, stars, t, d * 0.6); drawFog(ctx, fog, t, d); },
      line(ctx, pts, L) {
        // الجزء اللي تحوّل يصير غصن، والباقي يبقى خيط نبض
        let split = L.head + 1;
        for (let i = 0; i <= L.head; i++) if (L.mAt(i) >= 0.5) { split = i; break; }
        drawThread(ctx, pts, 0, Math.min(L.head, split), L.px, 1, L.beat, 1);
        if (split <= L.head) {
          ctx.save();
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.shadowColor = rgba(P.ink, 0.45); ctx.shadowBlur = L.px * 0.01; ctx.shadowOffsetY = L.px * 0.003;
          const CH = 14;
          for (let i = split; i < L.head; i += CH) {
            const j = Math.min(L.head, i + CH);
            const uMid = pts[Math.floor((i + j) / 2)][0];
            ctx.strokeStyle = P.violet;
            ctx.lineWidth = lerp(0.012, 0.0055, uMid);   // أعرض جهة البداية (اليسار)
            pathOf(ctx, pts, i, j);
            ctx.stroke();
          }
          ctx.shadowColor = 'transparent';
          ctx.strokeStyle = rgba(P.steel, 0.9);
          ctx.lineWidth = 0.0022;
          pathOf(ctx, pts.map(p => [p[0], p[1] - 0.0025]), split, L.head);
          ctx.stroke();
          ctx.restore();
        }
      },
      front(ctx, t, d, final) {
        for (const lf of leaves) {
          const k = final ? 1 : easeSoft(clamp01((t - lf.start) / 0.9));
          leaf(ctx, lf.u, lf.y, lf.ang, lf.L, lf.col, k);
        }
        for (const ro of roses) {
          const b = final ? 1 : clamp01((t - ro.start) / BLOOM);
          if (b > 0) drawRose(ctx, ro.u, ro.y, ro.R, b, ro.rot);
        }
      }
    };
  }

  // ---------- ٤. سماء عكاظ: خيام، ومن كل نبضة لعبة نارية ----------
  function sceneEnergy(S) {
    const { r, U, ecgY, seed, T } = S;
    const LINE_Y = 0.7, SC = 0.55;
    const target = ecgY.map(y => LINE_Y + (y - ECG_BASE) * SC);
    const peakPts = S.peakUs.map(u => {
      const i = Math.round((1 - u) * (NPTS - 1));
      let best = i;
      for (let k = Math.max(0, i - 6); k <= Math.min(NPTS - 1, i + 6); k++) if (target[k] < target[best]) best = k;
      return [U[best], target[best]];
    });

    // صفين خيام تراثية
    const tents = [];
    const back = 7, front = 6;
    for (let k = 0; k < back; k++) tents.push({ x: (k + 0.2 + 0.6 * r()) / back * 1.1 - 0.05, base: 0.9, w: 0.15 + 0.04 * r(), h: 0.09 + 0.03 * r(), row: 0 });
    for (let k = 0; k < front; k++) tents.push({ x: (k + 0.3 + 0.4 * r()) / front * 1.08 - 0.04, base: 0.975, w: 0.19 + 0.04 * r(), h: 0.12 + 0.03 * r(), row: 1 });
    const stars = makeStars(r, 30, 0.5);

    // ترتيب إطلاق القمم (متفرّق ومو متتالي)
    const order = peakPts.map((_, i) => i).sort(() => r() - 0.5);
    const RISE = 0.9, BURST = 1.8;
    const FIRST = T_DETAIL - 0.4;
    const COLS = [P.lilac, P.mist, P.snow];
    const fw = k => {
      const rk = mulberry32((seed ^ Math.imul(k + 1, 2654435761)) >>> 0);
      const pk = peakPts[order[k % order.length]];         // القمم بالدور: كل قمة تطلق شرارتها
      const n = 36 + Math.floor(rk() * 14);
      const parts = [];
      for (let j = 0; j < n; j++) parts.push({ a: (j / n) * TAU + rk() * 0.2, v: 0.13 + 0.07 * rk() });
      return { x0: pk[0], y0: pk[1], x1: pk[0] + (rk() - 0.5) * 0.08, y1: 0.12 + 0.25 * rk(), parts,
               col: COLS[Math.floor(rk() * 3)], col2: COLS[Math.floor(rk() * 3)] };
    };

    function tent(ctx, tn, a) {
      const { x, base, w, h, row } = tn;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = row ? P.navy : P.violet;
      ctx.beginPath(); ctx.moveTo(x - w / 2, base); ctx.lineTo(x, base - h); ctx.lineTo(x + w / 2, base); ctx.closePath();
      if (row) { ctx.shadowColor = rgba(P.ink, 0.8); ctx.shadowBlur = 14; ctx.shadowOffsetY = -3; }
      ctx.fill();
      ctx.shadowColor = 'transparent';
      // خطوط القماش
      ctx.strokeStyle = rgba(P.steel, row ? 0.7 : 0.45);
      ctx.lineWidth = 0.0018;
      ctx.beginPath();
      for (const f of [-0.32, -0.12, 0.12, 0.32]) { ctx.moveTo(x, base - h); ctx.lineTo(x + f * w, base); }
      ctx.stroke();
      ctx.lineWidth = 0.0026;
      ctx.beginPath(); ctx.moveTo(x - w / 2, base); ctx.lineTo(x, base - h); ctx.lineTo(x + w / 2, base); ctx.stroke();
      // باب مضيء بإضاءة خفيفة
      const dh = h * 0.45, dw = w * 0.16;
      glow(ctx, x, base - dh * 0.35, w * 0.32, P.lilac, row ? 0.35 : 0.2);
      ctx.fillStyle = row ? P.lilac : rgba(P.lilac, 0.7);
      ctx.beginPath(); ctx.moveTo(x - dw, base); ctx.lineTo(x, base - dh); ctx.lineTo(x + dw, base); ctx.closePath(); ctx.fill();
      // راية صغيرة
      ctx.strokeStyle = P.steel; ctx.lineWidth = 0.0018;
      ctx.beginPath(); ctx.moveTo(x, base - h); ctx.lineTo(x, base - h - 0.02); ctx.stroke();
      ctx.restore();
    }

    function firework(ctx, f, tau) {
      if (tau < RISE) {
        const p = easeOut(tau / RISE);
        const x = lerp(f.x0, f.x1, p), y = lerp(f.y0, f.y1, p);
        const pb = easeOut(Math.max(0, tau - 0.12) / RISE);
        const xb = lerp(f.x0, f.x1, pb), yb = lerp(f.y0, f.y1, pb);
        const g = ctx.createLinearGradient(xb, yb, x, y + 0.0001);
        g.addColorStop(0, rgba(P.lilac, 0)); g.addColorStop(1, rgba(P.snow, 0.9));
        ctx.strokeStyle = g; ctx.lineWidth = 0.003; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(xb, yb); ctx.lineTo(x, y); ctx.stroke();
        glow(ctx, x, y, 0.012, P.snow, 0.9);
        return;
      }
      const tb = tau - RISE;
      if (tb > BURST) return;
      const a = Math.pow(1 - tb / BURST, 1.4);
      if (tb < 0.25) glow(ctx, f.x1, f.y1, 0.08 + 0.12 * tb, P.snow, 0.7 * (1 - tb / 0.25));
      const dist = k => 1 - Math.exp(-k * 2.6);
      ctx.lineCap = 'round';
      for (let j = 0; j < f.parts.length; j++) {
        const pt = f.parts[j];
        const tp = Math.max(0, tb - 0.14);
        const rr = pt.v * dist(tb), rp = pt.v * dist(tp);
        const x = f.x1 + Math.cos(pt.a) * rr, y = f.y1 + Math.sin(pt.a) * rr + 0.035 * tb * tb;
        const xp = f.x1 + Math.cos(pt.a) * rp, yp = f.y1 + Math.sin(pt.a) * rp + 0.035 * tp * tp;
        const col = j % 2 ? f.col : f.col2;
        ctx.strokeStyle = rgba(col, a * 0.95);
        ctx.lineWidth = 0.0032;
        ctx.beginPath(); ctx.moveTo(xp, yp); ctx.lineTo(x, y); ctx.stroke();
        glow(ctx, x, y, 0.016, col, a * 0.8);
        ctx.fillStyle = rgba(P.snow, a);
        ctx.beginPath(); ctx.arc(x, y, 0.0032, 0, TAU); ctx.fill();
      }
    }

    return {
      target,
      doneAt: FIRST + 2 * T + RISE + 0.5,
      back(ctx, t, d) { drawStars(ctx, stars, t, d); },
      line(ctx, pts, L) {
        // أرضية وخيام
        if (L.fillA > 0) {
          ctx.save();
          ctx.translate(0, (1 - L.fillA) * 0.06);
          for (const tn of tents) if (tn.row === 0) tent(ctx, tn, L.fillA);
          ctx.globalAlpha = L.fillA;
          ctx.fillStyle = P.navy;
          ctx.fillRect(-0.02, 0.9, 1.04, 0.15);
          ctx.globalAlpha = 1;
          for (const tn of tents) if (tn.row === 1) tent(ctx, tn, L.fillA);
          ctx.restore();
        }
        drawThread(ctx, pts, 0, L.head, L.px, L.onEcg, L.beat, 1);
      },
      front(ctx, t, d) {
        if (d <= 0 || t < FIRST) return;
        const kNow = Math.floor((t - FIRST) / T);
        const kMin = Math.max(0, Math.floor((t - FIRST - RISE - BURST) / T));
        ctx.save();
        ctx.globalAlpha = d;
        for (let k = kMin; k <= kNow; k++) {
          const tau = t - (FIRST + k * T);
          if (tau < 0) continue;
          const f = fw(k);
          if (tau < 0.4) glow(ctx, f.x0, f.y0, 0.03, P.snow, 0.8 * (1 - tau / 0.4));   // القمة تلمع لحظة الانطلاق
          firework(ctx, f, tau);
        }
        ctx.restore();
      }
    };
  }

  const SCENES = { calm: sceneCalm, breeze: sceneBreeze, rose: sceneRose, energy: sceneEnergy };

  // =========================================================
  function create(bpm, seedIn) {
    const mood = moodFor(bpm);
    // البذرة تُعاد في الـQR حتى يرسم الجوال نفس اللوحة بالضبط
    const seed = (seedIn == null ? sessionSalt() : seedIn) >>> 0;
    const r = mulberry32((Math.imul(bpm, 2654435761) ^ seed) >>> 0);
    const T = 60 / bpm;
    const s = Math.min(1, T / 0.85);
    const rPeak = 0.24 * s;
    const level = (bpm - 40) / 140;
    const ecgAmp = 0.24 + 0.08 * level;

    const U = [], ecgY = [];
    for (let i = 0; i < NPTS; i++) {
      const f = i / (NPTS - 1);
      U.push(1 - f);                                  // من اليمين لليسار
      ecgY.push(ECG_BASE - ecgWave((ECG_S * f) % T, T) * ecgAmp);
    }
    const peakUs = [];
    for (let tk = rPeak; tk <= ECG_S; tk += T) peakUs.push(1 - tk / ECG_S);
    const beatSince = t => ((((t - rPeak) % T) + T) % T);
    const beatPulse = t => Math.exp(-beatSince(t) / 0.14);

    const S = { r, bpm, seed, level, T, s, U, ecgY, peakUs, beatSince };
    const fallback = makeFallback(mood, r);
    const sc = SCENES[mood.id](S);
    const target = sc.target;
    const doneAt = sc.doneAt;

    function render(ctx, px, t, final) {
      if (final) t = Math.max(t, doneAt + 0.01);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(px, px);

      // شاشة جهاز النبض
      let g = ctx.createLinearGradient(0, 0, 0.3, 1);
      g.addColorStop(0, P.navy); g.addColorStop(1, P.ink);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1, 1);

      // الخلفية تظهر بهدوء
      const bgA = final ? 1 : easeInOut(clamp01((t - T_BUILD) / 2.0));
      if (bgA > 0) {
        ctx.save();
        ctx.globalAlpha = bgA;
        const img = art[mood.id];
        if (img) drawCover(ctx, img); else fallback(ctx);
        ctx.restore();
      }
      if (bgA < 1) {
        ctx.strokeStyle = rgba(P.steel, 0.22 * (1 - bgA));
        ctx.lineWidth = 0.0015;
        ctx.beginPath();
        for (let x = 1; x > 0; x -= 1 / 16) { ctx.moveTo(x, 0); ctx.lineTo(x, 1); }
        for (let y = 1 / 16; y < 1; y += 1 / 16) { ctx.moveTo(0, y); ctx.lineTo(1, y); }
        ctx.stroke();
      }

      const d = final ? 1 : easeInOut(clamp01((t - T_DETAIL + 0.6) / 2.0));
      if (d > 0 && sc.back) sc.back(ctx, t, d);

      // خط النبض يتحول لعنصر المشهد
      const mG = final ? 1 : easeInOut(clamp01((t - T_MORPH) / MORPH_S));
      const mAt = i => (final ? 1 : sc.morphAt ? sc.morphAt(U[i], t) : mG);
      const head = final ? NPTS - 1 : Math.min(NPTS - 1, Math.floor(clamp01(t / ECG_S) * (NPTS - 1)));
      const pts = new Array(NPTS);
      for (let i = 0; i < NPTS; i++) { const m = mAt(i); pts[i] = [U[i], ecgY[i] + (target[i] - ecgY[i]) * m]; }
      const fillA = final ? 1 : easeInOut(clamp01((t - T_MORPH - MORPH_S * 0.45) / 1.2));
      if (head > 0) {
        sc.line(ctx, pts, { t, d, px, head, fillA, mAt, onEcg: 1 - mG, beat: final ? 0.35 : beatPulse(t) });
        // رأس الخط وقت القراءة
        if (!final && t < T_MORPH) {
          const hp = pts[head];
          ctx.save();
          ctx.fillStyle = P.snow;
          ctx.shadowColor = P.lilac; ctx.shadowBlur = px * 0.03;
          ctx.beginPath(); ctx.arc(hp[0], hp[1], 0.008, 0, TAU); ctx.fill();
          ctx.restore();
        }
      }

      if (sc.front) sc.front(ctx, t, d, final);
      ctx.restore();
    }

    return {
      bpm, seed, mood, render, doneAt,
      period: T, rPeak,
      handoff: T_DETAIL + 0.6,
      ECG_S, T_MORPH, T_DETAIL,
      hasArt: () => !!art[mood.id]
    };
  }

  N.Scene = { create, moodFor, preload, MOODS };
})(window.Nabdak);

/* مولّد QR محلي بالكامل (بدون إنترنت): وضع البايت، تصحيح أخطاء M، الإصدارات 1–10 */
window.Nabdak = window.Nabdak || {};
(function (N) {
  'use strict';

  // تصحيح M: عدد بايتات التصحيح لكل كتلة، وعدد الكتل
  const ECC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  const NUM_BLOCKS    = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
  const MAX_VER = 10;

  function rawModules(v) {
    let r = (16 * v + 128) * v + 64;
    if (v >= 2) {
      const na = Math.floor(v / 7) + 2;
      r -= (25 * na - 10) * na - 55;
      if (v >= 7) r -= 36;
    }
    return r;
  }
  const dataCodewords = v => Math.floor(rawModules(v) / 8) - ECC_PER_BLOCK[v] * NUM_BLOCKS[v];

  function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z & 255;
  }
  function rsDivisor(n) {
    const res = new Array(n).fill(0);
    res[n - 1] = 1;
    let root = 1;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        res[j] = gfMul(res[j], root);
        if (j + 1 < n) res[j] ^= res[j + 1];
      }
      root = gfMul(root, 2);
    }
    return res;
  }
  function rsRemainder(data, div) {
    const res = new Array(div.length).fill(0);
    data.forEach(b => {
      const f = b ^ res.shift();
      res.push(0);
      div.forEach((d, i) => { res[i] ^= gfMul(d, f); });
    });
    return res;
  }

  function alignPositions(v, size) {
    if (v === 1) return [];
    const na = Math.floor(v / 7) + 2;
    const step = Math.ceil((v * 4 + 4) / (na * 2 - 2)) * 2;
    const res = [6];
    for (let pos = size - 7; res.length < na; pos -= step) res.splice(1, 0, pos);
    return res;
  }

  const MASKS = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x, y) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
    (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0,
    (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0
  ];

  function encode(text) {
    const bytes = Array.from(new TextEncoder().encode(text));

    // أصغر إصدار يكفي
    let ver = 1;
    for (; ver <= MAX_VER; ver++) {
      const ccBits = ver <= 9 ? 8 : 16;
      if (4 + ccBits + bytes.length * 8 <= dataCodewords(ver) * 8) break;
    }
    if (ver > MAX_VER) throw new Error('QR: النص طويل');
    const size = ver * 4 + 17;
    const capBits = dataCodewords(ver) * 8;

    // البتات
    const bits = [];
    const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4);
    put(bytes.length, ver <= 9 ? 8 : 16);
    bytes.forEach(b => put(b, 8));
    put(0, Math.min(4, capBits - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    for (let pad = 0xec; bits.length < capBits; pad ^= 0xec ^ 0x11) put(pad, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      data.push(b);
    }

    // تصحيح الأخطاء والتشبيك
    const nb = NUM_BLOCKS[ver], eccLen = ECC_PER_BLOCK[ver];
    const rawCw = Math.floor(rawModules(ver) / 8);
    const nShort = nb - rawCw % nb;
    const shortLen = Math.floor(rawCw / nb);
    const div = rsDivisor(eccLen);
    const blocks = [];
    for (let i = 0, k = 0; i < nb; i++) {
      const dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1));
      k += dat.length;
      const ecc = rsRemainder(dat, div);
      if (i < nShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    const cw = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach((blk, j) => {
        if (i !== shortLen - eccLen || j >= nShort) cw.push(blk[i]);
      });
    }

    // المصفوفة
    const mod = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, on) => { mod[y][x] = on; fn[y][x] = true; };

    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(([cx, cy]) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, d !== 2 && d !== 4);
      }
    });
    const ap = alignPositions(ver, size), last = ap.length - 1;
    ap.forEach((ax, i) => ap.forEach((ay, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
        set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));

    const drawFormat = mask => {
      const d = (0 << 3) | mask;                 // مستوى M = 00
      let rem = d;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const b = ((d << 10) | rem) ^ 0x5412;
      const bit = i => ((b >>> i) & 1) === 1;
      for (let i = 0; i <= 5; i++) set(8, i, bit(i));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
      set(8, size - 8, true);
    };
    drawFormat(0);
    if (ver >= 7) {
      let rem = ver;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const b = (ver << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const on = ((b >>> i) & 1) === 1;
        const a = size - 11 + i % 3, c = Math.floor(i / 3);
        set(a, c, on); set(c, a, on);
      }
    }

    // البيانات بنمط الزقزاق
    let bi = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const up = ((right + 1) & 2) === 0;
          const y = up ? size - 1 - vert : vert;
          if (!fn[y][x] && bi < cw.length * 8) {
            mod[y][x] = ((cw[bi >>> 3] >>> (7 - (bi & 7))) & 1) === 1;
            bi++;
          }
        }
      }
    }

    // نختار القناع الأقل عقوبة
    const apply = m => {
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++)
        if (!fn[y][x] && MASKS[m](x, y)) mod[y][x] = !mod[y][x];
    };
    let best = 0, bestScore = Infinity;
    for (let m = 0; m < 8; m++) {
      apply(m); drawFormat(m);
      const s = penalty(mod, size);
      if (s < bestScore) { bestScore = s; best = m; }
      apply(m);
    }
    apply(best); drawFormat(best);
    return { size, modules: mod };
  }

  function penalty(m, n) {
    let score = 0, dark = 0;
    const line = get => {
      let run = 1;
      const seq = [];
      for (let i = 0; i < n; i++) seq.push(get(i));
      for (let i = 1; i <= n; i++) {
        if (i < n && seq[i] === seq[i - 1]) run++;
        else { if (run >= 5) score += run - 2; run = 1; }
      }
      // أنماط تشبه المربعات الكاشفة
      const s = seq.map(v => (v ? 1 : 0)).join('');
      const re = /(?=(10111010000|00001011101))/g;
      score += ((s.match(re) || []).length) * 40;
    };
    for (let y = 0; y < n; y++) line(i => m[y][i]);
    for (let x = 0; x < n; x++) line(i => m[i][x]);
    for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) {
      const c = m[y][x];
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3;
    }
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m[y][x]) dark++;
    score += Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;
    return score;
  }

  // يرسم الرمز كـ SVG (مع هامش هادئ 4 وحدات)
  function svg(text, dark, light) {
    const { size, modules } = encode(text);
    const q = 4, full = size + q * 2;
    let d = '';
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++)
      if (modules[y][x]) d += `M${x + q} ${y + q}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" shape-rendering="crispEdges">` +
           `<rect width="${full}" height="${full}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
  }

  N.QR = { encode, svg };
})(window.Nabdak);

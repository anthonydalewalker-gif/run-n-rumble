// Run N Rumble - all artwork, drawn with vector shapes (no image files).
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const D = {};

  D.rr = function (c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  };
  D.star = function (c, x, y, r, rot) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (rot || 0) - Math.PI / 2 + i * Math.PI / 5;
      const rr = i % 2 ? r * 0.45 : r;
      c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath();
  };
  function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, Math.max(rx, 0.01), Math.max(ry, 0.01), rot || 0, 0, TAU); }
  function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(r, 0.01), 0, TAU); }
  D.ell = ell; D.circ = circ;

  // ---------- enemies ----------
  D.potato = function (c, x, y, o) {
    // o: {dir (-1 left), t, flat (0..1), seed}
    c.save(); c.translate(x, y);
    const flat = o.flat || 0;
    c.scale(o.dir < 0 ? 1 : -1, 1);
    if (flat) c.scale(1 + flat * 0.4, 1 - flat * 0.7);
    // legs
    if (!flat) {
      c.strokeStyle = '#5a3a1a'; c.lineWidth = 2; c.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const lx = -10 + i * 9, ph = Math.sin(o.t * 16 + i * 2) * 3;
        c.beginPath(); c.moveTo(lx, -6); c.lineTo(lx + ph, 0); c.stroke();
      }
    }
    const g = c.createRadialGradient(-6, -18, 2, 0, -13, 20);
    g.addColorStop(0, '#f2cf8a'); g.addColorStop(0.55, '#c99550'); g.addColorStop(1, '#8a5a2a');
    c.fillStyle = g; ell(c, 0, -13, 19, 12, -0.08); c.fill();
    c.strokeStyle = 'rgba(80,45,15,.5)'; c.lineWidth = 1; c.stroke();
    c.fillStyle = 'rgba(110,70,30,.55)';
    [[6, -19, 1.6], [10, -9, 1.3], [-3, -6, 1.2], [2, -21, 1]].forEach(([a, b, r]) => { circ(c, a, b, r); c.fill(); });
    // antennae
    if (!flat) {
      c.strokeStyle = '#5a3a1a'; c.lineWidth = 1.3;
      const w = Math.sin(o.t * 8) * 2;
      c.beginPath(); c.moveTo(-12, -21); c.quadraticCurveTo(-16, -30, -20 + w, -30); c.stroke();
      c.beginPath(); c.moveTo(-8, -23); c.quadraticCurveTo(-9, -32, -12 + w, -34); c.stroke();
      c.fillStyle = '#5a3a1a'; circ(c, -20 + w, -30, 1.8); c.fill(); circ(c, -12 + w, -34, 1.8); c.fill();
    }
    // face (front = left side)
    if (flat) {
      c.strokeStyle = '#3a2210'; c.lineWidth = 1.5;
      [-12, -5].forEach(ex => { c.beginPath(); c.moveTo(ex - 2, -16); c.lineTo(ex + 2, -12); c.moveTo(ex + 2, -16); c.lineTo(ex - 2, -12); c.stroke(); });
    } else {
      c.fillStyle = '#fff'; ell(c, -12, -15, 3, 3.6); c.fill(); ell(c, -5, -15, 3, 3.6); c.fill();
      c.fillStyle = '#1a1010'; circ(c, -13, -14.5, 1.7); c.fill(); circ(c, -6, -14.5, 1.7); c.fill();
      c.strokeStyle = '#3a2210'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(-16, -21); c.lineTo(-10, -18.5); c.moveTo(-1.5, -21); c.lineTo(-7, -18.5); c.stroke();
      c.lineWidth = 1.3; c.beginPath(); c.arc(-9, -6, 3, Math.PI + 0.4, -0.4); c.stroke();
    }
    c.restore();
  };

  // [light, mid, dark, belly, wing, neck-shine]
  const BIRD_PAL = {
    bird: ['#9fd2ff', '#4a9bf0', '#2a6fd1', '#fff6d8', '#2f7fe0'],
    pigeon: ['#d6dbe6', '#9aa3b5', '#6a7285', '#c9cfdb', '#7d8597', 'rgba(110,200,160,.7)'],
    gull: ['#ffffff', '#eef2f7', '#b8c2d0', '#ffffff', '#9aa6b8']
  };
  D.BIRD_PAL = BIRD_PAL;
  D.bird = function (c, x, y, o) {
    // o: {dir, t, pal}
    const P = o.pal || BIRD_PAL.bird;
    c.save(); c.translate(x, y); c.scale(o.dir < 0 ? 1 : -1, 1);
    // tail
    c.fillStyle = P[2];
    c.beginPath(); c.moveTo(10, -2); c.lineTo(22, -8); c.lineTo(21, 0); c.lineTo(23, 5); c.closePath(); c.fill();
    const g = c.createRadialGradient(-4, -5, 2, 0, 0, 14);
    g.addColorStop(0, P[0]); g.addColorStop(0.6, P[1]); g.addColorStop(1, P[2]);
    c.fillStyle = g; ell(c, 0, 0, 13, 11); c.fill();
    c.fillStyle = P[3]; ell(c, -3, 5, 8, 5); c.fill();
    if (P[5]) { c.fillStyle = P[5]; ell(c, -6, 2, 5, 4); c.fill(); }
    // beak
    c.fillStyle = '#ffb21f';
    c.beginPath(); c.moveTo(-11, -3); c.lineTo(-20, 0); c.lineTo(-11, 3); c.closePath(); c.fill();
    // eye (angry)
    c.fillStyle = '#fff'; circ(c, -6, -4, 3.4); c.fill();
    c.fillStyle = '#111'; circ(c, -7, -3.5, 1.8); c.fill();
    c.strokeStyle = '#123'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-10, -9); c.lineTo(-3, -6.5); c.stroke();
    // wing
    const flap = Math.sin(o.t * 22);
    c.save(); c.translate(2, -3); c.rotate(-0.3 + flap * 0.8);
    c.fillStyle = P[4]; ell(c, 5, -6, 6, 10, 0.3); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1; c.stroke();
    c.restore();
    // feet
    c.strokeStyle = '#ff9a1f'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(-2, 10); c.lineTo(-3, 14); c.moveTo(3, 10); c.lineTo(3, 14); c.stroke();
    c.restore();
  };

  D.snake = function (c, x, y, o) {
    // o: {t, headY (offset, negative), open (0..1), dir}
    c.save(); c.translate(x, y); c.scale(o.dir < 0 ? 1 : -1, 1);
    const body = (cx, cy, rx, ry) => {
      const g = c.createLinearGradient(0, cy - ry, 0, cy + ry);
      g.addColorStop(0, '#8be05a'); g.addColorStop(0.6, '#3fae3a'); g.addColorStop(1, '#2a7a2a');
      c.fillStyle = g; ell(c, cx, cy, rx, ry); c.fill();
      c.strokeStyle = 'rgba(20,70,20,.45)'; c.lineWidth = 1; c.stroke();
      c.fillStyle = 'rgba(250,220,80,.8)';
      for (let i = -2; i <= 2; i++) { ell(c, cx + i * rx * 0.36, cy - ry * 0.1, 2, ry * 0.55); c.fill(); }
    };
    body(4, -8, 22, 8);
    body(6, -20, 17, 7);
    const hy = o.headY;
    // neck
    c.strokeStyle = '#3fae3a'; c.lineWidth = 9; c.lineCap = 'round';
    c.beginPath(); c.moveTo(4, -24); c.quadraticCurveTo(10, (hy - 24) / 2, -4, hy); c.stroke();
    c.strokeStyle = '#8be05a'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(2, -24); c.quadraticCurveTo(7, (hy - 24) / 2, -6, hy); c.stroke();
    // head
    c.save(); c.translate(-8, hy);
    const op = o.open || 0;
    const hg = c.createRadialGradient(-2, -4, 1, 0, 0, 13);
    hg.addColorStop(0, '#a6ef6f'); hg.addColorStop(1, '#2f8f2f');
    c.fillStyle = '#c0283a';
    c.beginPath(); c.moveTo(-2, 0); c.lineTo(-15, -1 - op * 5); c.lineTo(-15, 1 + op * 5); c.closePath(); c.fill();
    c.fillStyle = hg;
    c.save(); c.rotate(-op * 0.25); ell(c, -2, -2, 12, 7); c.fill(); c.restore();
    c.save(); c.rotate(op * 0.25); ell(c, -2, 2, 11, 5); c.fill(); c.restore();
    if (!op) { // tongue flick
      const fl = (Math.sin(o.t * 4) > 0.6);
      if (fl) { c.strokeStyle = '#e0204a'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-13, 1); c.lineTo(-19, 1); c.lineTo(-22, -1); c.moveTo(-19, 1); c.lineTo(-22, 3); c.stroke(); }
    }
    c.fillStyle = '#ffec60'; ell(c, -4, -6, 3.4, 3.8); c.fill();
    c.fillStyle = '#111'; ell(c, -4.6, -6, 1, 3); c.fill();
    c.strokeStyle = '#1a4a1a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-9, -10.5); c.lineTo(-1, -9); c.stroke();
    c.restore();
    c.restore();
  };

  D.fireball = function (c, x, y, t) {
    const g = c.createRadialGradient(x, y, 1, x, y, 13);
    g.addColorStop(0, '#fffbd0'); g.addColorStop(0.35, '#ffd23a'); g.addColorStop(0.7, '#ff6a1a'); g.addColorStop(1, 'rgba(255,60,0,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x - 10, y);
    c.quadraticCurveTo(x - 6, y - 11, x + 6 + Math.sin(t * 40) * 2, y - 8);
    c.quadraticCurveTo(x + 22, y - 4 + Math.sin(t * 30) * 3, x + 26, y);
    c.quadraticCurveTo(x + 22, y + 4 - Math.sin(t * 30) * 3, x + 6, y + 8);
    c.quadraticCurveTo(x - 6, y + 11, x - 10, y);
    c.fill();
    c.fillStyle = '#fff6b0'; circ(c, x - 2, y, 4); c.fill();
  };

  D.rock = function (c, x, y, r, pts, rot) {
    c.save(); c.translate(x, y); c.rotate(rot);
    const g = c.createRadialGradient(-r * 0.3, -r * 0.4, 1, 0, 0, r * 1.1);
    g.addColorStop(0, '#c9c3bc'); g.addColorStop(0.6, '#8d847b'); g.addColorStop(1, '#5a524a');
    c.fillStyle = g; c.beginPath();
    pts.forEach((p, i) => { const a = i / pts.length * TAU; c.lineTo(Math.cos(a) * r * p, Math.sin(a) * r * p); });
    c.closePath(); c.fill();
    c.strokeStyle = '#4a433c'; c.lineWidth = 1.5; c.stroke();
    c.strokeStyle = 'rgba(60,50,40,.6)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-r * 0.2, -r * 0.5); c.lineTo(r * 0.1, -r * 0.1); c.lineTo(-r * 0.05, r * 0.3); c.stroke();
    c.restore();
  };

  const PW = { speed: ['#b65cff', '#7a1fd6'], power: ['#ffe14a', '#e0a400'], shield: ['#4a4a5a', '#111118'],
               highjump: ['#8af05a', '#2f9e3a'], tough: ['#ffb347', '#c46a00'] };
  D.POWER_COLORS = PW;
  D.powerOrb = function (c, x, y, kind, t, r) {
    r = r || 15;
    const cols = PW[kind];
    const gl = c.createRadialGradient(x, y, r * 0.5, x, y, r * 1.8);
    gl.addColorStop(0, 'rgba(255,255,255,.55)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gl; circ(c, x, y, r * 1.8); c.fill();
    const sx = Math.max(0.25, Math.abs(Math.cos(t * 5)));
    c.save(); c.translate(x, y); c.scale(sx, 1);
    const g = c.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#cfd8e6'); g.addColorStop(1, '#8a96aa');
    c.fillStyle = g; circ(c, 0, 0, r); c.fill();
    c.fillStyle = kind === 'shield' ? '#e8e8f0' : '#fff'; circ(c, 0, 0, r * 0.78); c.fill();
    const sg = c.createLinearGradient(0, -r, 0, r); sg.addColorStop(0, cols[0]); sg.addColorStop(1, cols[1]);
    c.fillStyle = sg; D.star(c, 0, 1, r * 0.7, 0); c.fill();
    c.strokeStyle = kind === 'shield' ? '#fff' : 'rgba(0,0,0,.25)'; c.lineWidth = 1; c.stroke();
    c.restore();
  };

  D.tree = function (c, x, y, g, t, ready) {
    // g: growth 0..1; mound always visible
    c.save(); c.translate(x, y);
    // mound
    const mg = c.createLinearGradient(0, -14, 0, 0); mg.addColorStop(0, '#9a6a3a'); mg.addColorStop(1, '#6a4422');
    c.fillStyle = mg; ell(c, 0, 0, 34, 12); c.fill();
    if (g <= 0) {
      // little sprout
      c.strokeStyle = '#3c9a2c'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, -8); c.quadraticCurveTo(2, -16, 0, -22); c.stroke();
      c.fillStyle = '#6fd04a'; ell(c, -5, -21, 5, 2.6, 0.5); c.fill(); ell(c, 5, -23, 5, 2.6, -0.5); c.fill();
    } else {
      const e = 1 - Math.pow(1 - g, 3);
      const h = 30 + 110 * e;
      const tg = c.createLinearGradient(-10, 0, 10, 0); tg.addColorStop(0, '#6a4020'); tg.addColorStop(0.5, '#9a6a3a'); tg.addColorStop(1, '#5a3418');
      c.fillStyle = tg;
      c.beginPath(); c.moveTo(-12 * e - 3, -4); c.quadraticCurveTo(-5, -h * 0.5, -6 * e - 2, -h); c.lineTo(6 * e + 2, -h); c.quadraticCurveTo(5, -h * 0.5, 12 * e + 3, -4); c.fill();
      const cr = 14 + 46 * e;
      const blobs = [[0, -h - cr * 0.3, 1], [-cr * 0.8, -h + cr * 0.15, 0.75], [cr * 0.8, -h + cr * 0.15, 0.75], [-cr * 0.45, -h - cr * 0.75, 0.7], [cr * 0.45, -h - cr * 0.75, 0.7]];
      blobs.forEach(([bx, by, s]) => {
        const lg = c.createRadialGradient(bx - cr * 0.3 * s, by - cr * 0.3 * s, 2, bx, by, cr * s);
        lg.addColorStop(0, '#9ff07a'); lg.addColorStop(0.6, '#3fbf3a'); lg.addColorStop(1, '#238a2a');
        c.fillStyle = lg; circ(c, bx, by, cr * s); c.fill();
      });
      if (g >= 1) {
        // golden fruit + sparkle when ready
        [[-cr * 0.5, -h - cr * 0.2], [cr * 0.4, -h - cr * 0.5], [cr * 0.6, -h + cr * 0.2], [-cr * 0.2, -h - cr * 0.9], [0, -h + cr * 0.1]].forEach(([fx, fy], i) => {
          c.fillStyle = '#ffd23a'; circ(c, fx, fy + Math.sin(t * 3 + i) * 1.5, 5); c.fill();
          c.fillStyle = 'rgba(255,255,255,.7)'; circ(c, fx - 1.5, fy - 1.5 + Math.sin(t * 3 + i) * 1.5, 1.6); c.fill();
        });
        if (ready) {
          c.fillStyle = 'rgba(255,255,200,' + (0.5 + 0.5 * Math.sin(t * 6)) + ')';
          for (let i = 0; i < 6; i++) { const a = t * 1.5 + i * TAU / 6; D.star(c, Math.cos(a) * (cr + 18), -h - cr * 0.2 + Math.sin(a) * (cr + 10), 4, t); c.fill(); }
        }
      }
    }
    c.restore();
  };

  D.sign = function (c, x, y, text) {
    c.save(); c.translate(x, y);
    c.fillStyle = '#7a4a22'; c.fillRect(-2, -34, 4, 34);
    const g = c.createLinearGradient(0, -52, 0, -30); g.addColorStop(0, '#d9a066'); g.addColorStop(1, '#b07a44');
    c.fillStyle = g; D.rr(c, -26, -54, 52, 24, 4); c.fill();
    c.strokeStyle = '#6a3e18'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = '#4a2a10'; c.font = 'bold 10px "Trebuchet MS", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 0, -42);
    c.restore();
  };

  // ---------- text helpers ----------
  D.FONT = '"Arial Rounded MT Bold", "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
  D.text = function (c, str, x, y, size, fill, opts) {
    opts = opts || {};
    c.font = (opts.weight || 'bold') + ' ' + size + 'px ' + D.FONT;
    c.textAlign = opts.align || 'center'; c.textBaseline = opts.base || 'middle';
    if (opts.stroke !== false) {
      c.lineJoin = 'round'; c.strokeStyle = opts.stroke || '#1b2a4a'; c.lineWidth = opts.sw || Math.max(2, size * 0.18);
      c.strokeText(str, x, y);
    }
    c.fillStyle = fill; c.fillText(str, x, y);
  };

  D.logo = function (c, x, y, s, t) {
    c.save(); c.translate(x, y); c.scale(s, s);
    const words = [['RUN', '#ffde3a', '#ff8a00'], ['N', '#ff5fa0', '#d91a5a'], ['RUMBLE', '#8af05a', '#2f9e3a']];
    c.font = '900 46px ' + D.FONT; c.textBaseline = 'middle'; c.textAlign = 'left';
    const widths = words.map(w => c.measureText(w[0]).width);
    const gap = 14, total = widths.reduce((a, b) => a + b, 0) + gap * 2;
    let cx = -total / 2;
    words.forEach((w, i) => {
      const bob = Math.sin(t * 3 + i * 1.2) * 3;
      const rot = Math.sin(t * 2 + i) * 0.03;
      c.save(); c.translate(cx + widths[i] / 2, bob); c.rotate(rot);
      const g = c.createLinearGradient(0, -22, 0, 22); g.addColorStop(0, w[1]); g.addColorStop(1, w[2]);
      c.textAlign = 'center';
      c.lineJoin = 'round';
      c.strokeStyle = '#1b2a4a'; c.lineWidth = 12; c.strokeText(w[0], 0, 4);
      c.strokeStyle = '#fff'; c.lineWidth = 6; c.strokeText(w[0], 0, 0);
      c.fillStyle = g; c.fillText(w[0], 0, 0);
      c.restore();
      cx += widths[i] + gap;
    });
    c.restore();
  };


  // ---------- level 2: clouds ----------
  // style: 'bank' (big solid cloud), 'static', 'drift', 'fade', 'bounce'
  D.cloudPlatform = function (c, x, y, w, h, style, alpha, t, squash) {
    c.save();
    c.globalAlpha = alpha;
    const cols = {
      bank: ['#ffffff', '#d6e4ff'], static: ['#ffffff', '#dbe6ff'], drift: ['#f2f8ff', '#bcd6ff'],
      fade: ['#eef0ff', '#b9b6e8'], bounce: ['#ffe0f0', '#ff9ccc']
    }[style] || ['#fff', '#dde'];
    const sq = squash || 0;
    const top = y + sq * 6, hh = Math.min(h, style === 'bank' ? 400 : h);
    const g = c.createLinearGradient(0, top - 8, 0, top + Math.min(hh, 60));
    g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
    c.fillStyle = g;
    c.beginPath();
    // puffy top edge
    const step = 22;
    const n = Math.max(2, Math.round(w / step));
    const sw = w / n;
    for (let i = 0; i <= n; i++) {
      const px = x + i * sw, bob = Math.sin(t * 1.5 + px * 0.05) * 1.2;
      c.moveTo(px + sw * 0.75, top + 4);
      c.arc(px, top + 4 + bob, sw * 0.75 + (i % 2) * 3, 0, Math.PI * 2);
    }
    c.fill();
    if (style === 'bank') {
      c.fillRect(x, top + 4, w, 400);
      // puffy bottom-ish shading bands
      c.fillStyle = 'rgba(160,180,230,.25)';
      for (let yy = top + 40; yy < 400; yy += 38) for (let xx = x + 15; xx < x + w; xx += 44) { circ(c, xx + (yy % 2) * 20, yy, 14); c.fill(); }
    } else {
      D.rr(c, x, top + 2, w, Math.max(8, hh - 4), (hh - 4) / 2); c.fill();
      // underside puffs
      c.fillStyle = cols[1];
      for (let i = 0; i < n; i++) { circ(c, x + sw * (i + 0.5), top + hh - 4, sw * 0.45); c.fill(); }
    }
    c.fillStyle = 'rgba(255,255,255,.7)';
    for (let i = 0; i < n; i += 2) { ell(c, x + i * sw + 4, top - 2, sw * 0.35, 3); c.fill(); }
    if (style === 'bounce') {
      c.fillStyle = '#ff5fa0';
      for (let i = 0; i < 3; i++) { const cx = x + w * (0.25 + i * 0.25); D.star(c, cx, top + hh * 0.5, 4, t); c.fill(); }
    }
    if (style === 'fade') {
      c.strokeStyle = 'rgba(120,110,200,.5)'; c.setLineDash([4, 4]); c.lineWidth = 1.5;
      D.rr(c, x + 2, top - 2, w - 4, hh, hh / 2); c.stroke(); c.setLineDash([]);
    }
    if (style === 'drift') {
      c.strokeStyle = 'rgba(80,140,230,.55)'; c.lineWidth = 2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x + w / 2 - 12, top + hh / 2 + 2); c.lineTo(x + w / 2 + 12, top + hh / 2 + 2); c.stroke();
    }
    c.restore();
  };

  D.bolt = function (c, x, top, bottom, t, alpha) {
    c.save(); c.globalAlpha = alpha;
    const pts = [[x, top]];
    let yy = top, seed = Math.floor(t * 30);
    while (yy < bottom) { yy += 18; const j = Math.sin(seed * 12.9898 + yy) * 43758.5453; pts.push([x + ((j - Math.floor(j)) - 0.5) * 22, Math.min(yy, bottom)]); }
    for (const [lw, col] of [[14, 'rgba(160,200,255,.35)'], [7, 'rgba(200,230,255,.8)'], [3, '#ffffff']]) {
      c.strokeStyle = col; c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round';
      c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
    }
    c.restore();
  };
  D.stormCloud = function (c, x, y, t, flash) {
    c.save();
    c.fillStyle = flash ? '#8a8fb8' : '#5d6185';
    c.beginPath();
    c.arc(x - 22, y, 16, 0, 7); c.arc(x, y - 10, 21, 0, 7); c.arc(x + 22, y, 16, 0, 7); c.arc(x, y + 6, 18, 0, 7);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,.18)'; circ(c, x - 6, y - 16, 8); c.fill();
    // grumpy face
    c.strokeStyle = '#2a2d45'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x - 12, y - 6); c.lineTo(x - 4, y - 3); c.moveTo(x + 12, y - 6); c.lineTo(x + 4, y - 3); c.stroke();
    c.fillStyle = '#2a2d45'; circ(c, x - 7, y, 2); c.fill(); circ(c, x + 7, y, 2); c.fill();
    c.beginPath(); c.arc(x, y + 9, 5, Math.PI + 0.3, -0.3); c.stroke();
    c.restore();
  };

  D.warnStrip = function (c, x, y, w, t) {
    c.fillStyle = 'rgba(255,60,60,' + (0.25 + 0.25 * Math.sin(t * 20)) + ')';
    c.fillRect(x, y, w, 4);
  };

  window.Draw = D;
})();

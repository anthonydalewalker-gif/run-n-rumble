// Run N Rumble - artwork for the stage-2 levels, bosses and the world map.
(function () {
  'use strict';
  const D = window.Draw, TAU = Math.PI * 2, ell = D.ell, circ = D.circ;

  // dizzy stars circling a stunned boss
  D.dizzy = function (c, x, y, t, r) {
    for (let i = 0; i < 3; i++) { const a = t * 5 + i * TAU / 3; c.fillStyle = '#ffe14a'; D.star(c, x + Math.cos(a) * (r || 26), y + Math.sin(a) * 6, 6, t * 4); c.fill(); }
  };
  D.bat = function (c, x, y, o) {
    c.save(); c.translate(x, y); c.scale(o.dir < 0 ? 1 : -1, 1);
    const flap = Math.sin(o.t * 24);
    c.fillStyle = '#4a3a6a';
    for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(0, -2);
      c.quadraticCurveTo(s * 12, -14 - flap * 8, s * 24, -6 - flap * 10);
      c.lineTo(s * 18, 0 - flap * 4); c.lineTo(s * 13, -2 - flap * 3); c.lineTo(s * 8, 2); c.closePath(); c.fill();
    }
    const g = c.createRadialGradient(-2, -3, 1, 0, 0, 10); g.addColorStop(0, '#8a7ab0'); g.addColorStop(1, '#3a2a5a');
    c.fillStyle = g; ell(c, 0, 0, 9, 8); c.fill();
    c.beginPath(); c.moveTo(-6, -6); c.lineTo(-4, -13); c.lineTo(-1, -7); c.moveTo(1, -7); c.lineTo(4, -13); c.lineTo(6, -6); c.fill();
    c.fillStyle = '#ffe14a'; circ(c, -3.5, -1, 2); c.fill(); circ(c, 3, -1, 2); c.fill();
    c.fillStyle = '#111'; circ(c, -4, -1, 0.9); c.fill(); circ(c, 2.5, -1, 0.9); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-3, 4); c.lineTo(-2, 7); c.lineTo(-1, 4); c.moveTo(1, 4); c.lineTo(2, 7); c.lineTo(3, 4); c.fill();
    c.restore();
  };
  D.crumble = function (c, s, t) {
    const sh = s.standT > 0 ? Math.sin(t * 60) * 1.5 : 0;
    c.save(); c.globalAlpha = s.alpha; c.translate(sh, 0);
    const g = c.createLinearGradient(0, s.y, 0, s.y + s.h); g.addColorStop(0, '#9a8aa8'); g.addColorStop(1, '#5a4a6a');
    c.fillStyle = g; D.rr(c, s.x, s.y, s.w, s.h, 5); c.fill();
    c.strokeStyle = 'rgba(30,20,40,.7)'; c.lineWidth = 1.5; c.beginPath();
    for (let x = s.x + 14; x < s.x + s.w - 8; x += 26) { c.moveTo(x, s.y + 2); c.lineTo(x + 5, s.y + 9); c.lineTo(x - 2, s.y + s.h - 2); }
    c.stroke();
    // dangling pebbles
    c.fillStyle = '#7a6a88';
    for (let x = s.x + 10; x < s.x + s.w; x += 22) { circ(c, x, s.y + s.h + 2 + (s.standT > 0 ? (t * 30 + x) % 8 : 0), 2.5); c.fill(); }
    c.restore();
  };
  D.track = function (c, s, L, R, VH) {
    const bottom = VH + 20;
    c.fillStyle = '#2a2830'; c.fillRect(s.x, s.y, s.w, bottom - s.y);
    const x0 = Math.max(s.x, L - 10), x1 = Math.min(s.x + s.w, R + 10);
    c.fillStyle = '#5a4030';
    for (let x = Math.floor(x0 / 22) * 22; x < x1; x += 22) c.fillRect(x, s.y + 2, 12, 8);   // sleepers
    c.fillStyle = '#b8bcc8'; c.fillRect(x0, s.y, x1 - x0, 3); c.fillRect(x0, s.y + 10, x1 - x0, 2);
    c.fillStyle = 'rgba(255,220,0,.85)';
    c.fillRect(s.x, s.y + 16, 4, bottom - s.y); c.fillRect(s.x + s.w - 4, s.y + 16, 4, bottom - s.y);
  };
  D.walkway = function (c, s) {
    c.fillStyle = '#5a5a6a';
    for (let x = s.x + 20; x < s.x + s.w - 10; x += 90) c.fillRect(x, s.y + s.h, 8, 300 - s.y - s.h);
    const g = c.createLinearGradient(0, s.y, 0, s.y + s.h); g.addColorStop(0, '#c8ccd8'); g.addColorStop(1, '#7a7e8e');
    c.fillStyle = g; c.fillRect(s.x, s.y, s.w, s.h);
    c.fillStyle = '#ffd21f'; c.fillRect(s.x, s.y, s.w, 3);
    c.fillStyle = '#1b1b24'; for (let x = s.x; x < s.x + s.w; x += 16) c.fillRect(x, s.y + 3, 8, 2);
  };
  D.train = function (c, x, y, w, t) {
    // y = rail level; train body 64 tall
    const top = y - 66;
    const g = c.createLinearGradient(0, top, 0, y); g.addColorStop(0, '#e8ecf4'); g.addColorStop(1, '#9aa0b0');
    c.fillStyle = g; D.rr(c, x, top, w, 60, 14); c.fill();
    c.strokeStyle = '#4a4e5e'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#e0306e'; c.fillRect(x + 4, top + 40, w - 8, 7);
    c.fillStyle = '#2a3a5a';
    for (let wx = x + 40; wx < x + w - 40; wx += 46) { D.rr(c, wx, top + 10, 32, 22, 4); c.fill(); }
    c.fillStyle = '#ffeaa0'; D.rr(c, x + 6, top + 10, 22, 22, 6); c.fill();
    c.fillStyle = 'rgba(255,250,200,' + (0.5 + 0.5 * Math.sin(t * 20)) + ')'; circ(c, x + 10, top + 52, 5); c.fill();
    const lg = c.createLinearGradient(x - 120, 0, x, 0); lg.addColorStop(0, 'rgba(255,250,200,0)'); lg.addColorStop(1, 'rgba(255,250,200,.35)');
    c.fillStyle = lg; c.beginPath(); c.moveTo(x, top + 44); c.lineTo(x - 120, top + 20); c.lineTo(x - 120, top + 70); c.lineTo(x, top + 58); c.fill();
    c.fillStyle = '#222';
    for (let wx = x + 30; wx < x + w; wx += 90) { circ(c, wx, y - 4, 6); c.fill(); circ(c, wx + 22, y - 4, 6); c.fill(); }
  };
  D.eelHole = function (c, x, y) {
    c.fillStyle = '#6a5a4a'; ell(c, x + 16, y, 30, 22); c.fill();
    c.fillStyle = '#8a7a64'; ell(c, x + 10, y - 8, 18, 10); c.fill();
    c.fillStyle = '#1a1410'; ell(c, x, y, 11, 10); c.fill();
  };
  D.eel = function (c, x, y, ext, t, warn) {
    // ext 0..1 how far out (to the left); head at x - ext*120
    const len = 20 + ext * 120, hx = x - len + 20;
    c.strokeStyle = '#3a8a5a'; c.lineWidth = 14; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y);
    for (let i = 0; i <= 10; i++) { const k = i / 10; c.lineTo(x - k * (len - 20), y + Math.sin(t * 10 + k * 8) * 5 * k); }
    c.stroke();
    c.strokeStyle = '#ffd21f'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#4aa06a'; ell(c, hx - 4, y, 14, 9); c.fill();
    c.fillStyle = warn ? '#ff3a3a' : '#ffe14a'; circ(c, hx - 8, y - 4, 2.6); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(hx - 17, y + 1); c.lineTo(hx - 14, y + 5); c.lineTo(hx - 11, y + 1); c.fill();
  };
  D.goalFlag = function (c, x, y, t) {
    c.fillStyle = '#d8dce6'; c.fillRect(x - 2, y - 120, 5, 120);
    c.fillStyle = '#ffd21f'; circ(c, x, y - 122, 5); c.fill();
    c.fillStyle = '#5a5a6a'; D.rr(c, x - 10, y - 8, 20, 8, 3); c.fill();
    c.beginPath(); c.moveTo(x + 3, y - 116);
    for (let i = 0; i <= 8; i++) { const k = i / 8; c.lineTo(x + 3 + k * 48, y - 116 + Math.sin(t * 6 - k * 4) * 4 * k); }
    for (let i = 8; i >= 0; i--) { const k = i / 8; c.lineTo(x + 3 + k * 48, y - 84 + Math.sin(t * 6 - k * 4) * 4 * k); }
    c.closePath(); c.fillStyle = '#ff4a6a'; c.fill();
    c.fillStyle = '#fff'; D.star(c, x + 26, y - 100 + Math.sin(t * 6 - 2) * 2, 7, 0); c.fill();
  };

  // ---------- bosses (x = center, y = feet) ----------
  function flick(c, o) { if (o.flash > 0 && Math.floor(o.flash * 20) % 2 === 0) c.globalAlpha *= 0.35; }
  D.potatoKing = function (c, x, y, o) {
    c.save(); flick(c, o); c.translate(x, y);
    const cr = o.crouch || 0; c.scale(1 + cr * 0.15, 1 - cr * 0.2);
    if (o.tele) c.translate(Math.sin(o.t * 50) * 2, 0);
    // cape
    c.fillStyle = '#c8203a'; c.beginPath(); c.moveTo(-40 * o.face, -70); c.quadraticCurveTo(-75 * o.face, -30, -60 * o.face, 0); c.lineTo(20 * o.face, -10); c.closePath(); c.fill();
    c.save(); c.scale(3.6, 3.6); D.potato(c, 0, 0, { dir: o.face, t: o.t, flat: 0 }); c.restore();
    // crown
    c.save(); c.translate(o.face * 18, -92 - Math.abs(Math.sin(o.t * 4)) * 2); c.rotate(o.face * 0.12);
    c.fillStyle = '#ffd21f'; c.beginPath(); c.moveTo(-22, 0); c.lineTo(-22, -16); c.lineTo(-11, -6); c.lineTo(0, -22); c.lineTo(11, -6); c.lineTo(22, -16); c.lineTo(22, 0); c.closePath(); c.fill();
    c.strokeStyle = '#a07a00'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#ff3a5a'; circ(c, 0, -6, 3.5); c.fill(); c.fillStyle = '#3ad0ff'; circ(c, -13, -4, 2.5); c.fill(); circ(c, 13, -4, 2.5); c.fill();
    c.restore();
    // scepter
    const up = o.scepter || 0;
    c.save(); c.translate(-o.face * 50, -40); c.rotate(-o.face * (0.4 + up * 1.2));
    c.fillStyle = '#a07a00'; c.fillRect(-3, -60, 6, 60); c.fillStyle = '#ffd21f'; circ(c, 0, -64, 9); c.fill();
    if (up > 0.5) { c.fillStyle = 'rgba(255,240,120,.6)'; circ(c, 0, -64, 16 + Math.sin(o.t * 20) * 4); c.fill(); }
    c.restore();
    if (o.angry) { c.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 3; i++) { circ(c, o.face * 30 + Math.sin(o.t * 9 + i) * 10, -100 - ((o.t * 60 + i * 20) % 40), 5); c.fill(); } }
    c.restore();
    if (o.dizzy) D.dizzy(c, x, y - 110, o.t, 30);
  };
  D.thunderBird = function (c, x, y, o) {
    c.save(); flick(c, o); c.translate(x, y - 45);
    if (o.tele) { const g = c.createRadialGradient(0, 0, 10, 0, 0, 90); g.addColorStop(0, 'rgba(255,255,150,.5)'); g.addColorStop(1, 'rgba(255,255,150,0)'); c.fillStyle = g; circ(c, 0, 0, 90); c.fill(); }
    c.save(); c.scale(4, 4); D.bird(c, 0, 0, { dir: o.face, t: o.t * (o.ground ? 0.3 : 0.55), pal: ['#ffe680', '#ffb820', '#d07a00', '#fff6d8', '#5a4ad0'] }); c.restore();
    // lightning crest
    c.fillStyle = '#5ae0ff'; c.save(); c.scale(o.face < 0 ? 1 : -1, 1);
    c.beginPath(); c.moveTo(-10, -40); c.lineTo(4, -70); c.lineTo(0, -54); c.lineTo(16, -76); c.lineTo(10, -44); c.closePath(); c.fill();
    c.restore();
    if (o.tele || o.charged) { c.strokeStyle = '#fff6a0'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { const a = o.t * 7 + i * 2; c.beginPath(); c.moveTo(Math.cos(a) * 40, Math.sin(a) * 30); c.lineTo(Math.cos(a) * 60 + 6, Math.sin(a) * 45 - 6); c.lineTo(Math.cos(a) * 75, Math.sin(a) * 55); c.stroke(); } }
    c.restore();
    if (o.dizzy) D.dizzy(c, x, y - 100, o.t, 34);
  };
  D.crane = function (c, towerX, groundY, jibY, jibL, t) {
    c.strokeStyle = '#e0a000'; c.lineWidth = 3;
    // tower lattice
    c.fillStyle = 'rgba(0,0,0,0)';
    for (let y = groundY; y > jibY; y -= 22) {
      c.beginPath(); c.moveTo(towerX - 14, y); c.lineTo(towerX + 14, y - 22); c.moveTo(towerX + 14, y); c.lineTo(towerX - 14, y - 22); c.stroke();
    }
    c.lineWidth = 5; c.beginPath(); c.moveTo(towerX - 14, groundY); c.lineTo(towerX - 14, jibY); c.moveTo(towerX + 14, groundY); c.lineTo(towerX + 14, jibY); c.stroke();
    // jib
    c.fillStyle = '#ffb800'; c.fillRect(jibL, jibY - 8, towerX + 70 - jibL, 12);
    c.strokeStyle = '#a07000'; c.lineWidth = 2;
    for (let x = jibL; x < towerX + 70; x += 20) { c.beginPath(); c.moveTo(x, jibY - 8); c.lineTo(x + 10, jibY + 4); c.stroke(); }
    c.fillStyle = '#5a5a6a'; c.fillRect(towerX + 30, jibY - 4, 40, 26);   // counterweight
    c.fillStyle = '#3a8ae0'; D.rr(c, towerX - 20, jibY + 4, 40, 28, 4); c.fill(); c.fillStyle = '#bfe6ff'; c.fillRect(towerX - 14, jibY + 9, 28, 12);   // cab
  };
  D.pigeonBoss = function (c, x, y, o) {
    c.save(); flick(c, o); c.translate(x, y - 42);
    c.save(); c.scale(3.6, 3.6); D.bird(c, 0, 0, { dir: o.face, t: o.fly ? o.t : 0, pal: D.BIRD_PAL.pigeon }); c.restore();
    // hard hat
    c.save(); c.translate(o.face * 6, -40);
    c.fillStyle = '#ffd21f'; c.beginPath(); c.arc(0, 0, 24, Math.PI, 0); c.fill(); c.fillRect(-30, -2, 60, 6);
    c.fillStyle = '#e0a000'; c.fillRect(-3, -24, 6, 22);
    c.restore();
    if (o.tele) D.text(c, '!!', o.face * 30, -78, 20, '#ff3a3a', { sw: 4 });
    c.restore();
    if (o.dizzy) D.dizzy(c, x, y - 100, o.t, 30);
  };
  D.sunkenShip = function (c, x, y) {
    c.save(); c.globalAlpha = 0.85;
    c.fillStyle = '#4a3a3a'; c.beginPath(); c.moveTo(x - 420, y - 150); c.lineTo(x + 380, y - 190); c.lineTo(x + 330, y); c.lineTo(x - 370, y); c.closePath(); c.fill();
    c.fillStyle = '#3a2a2a'; for (let i = 0; i < 7; i++) c.fillRect(x - 380 + i * 110, y - 160 - i * 5, 12, 160);
    c.fillStyle = '#1a2a4a'; for (let i = 0; i < 6; i++) { circ(c, x - 330 + i * 120, y - 90, 14); c.fill(); }
    c.fillStyle = '#4a3a3a'; c.fillRect(x - 40, y - 330, 14, 160); c.fillStyle = 'rgba(200,200,180,.25)'; c.beginPath(); c.moveTo(x - 26, y - 320); c.lineTo(x + 80, y - 250); c.lineTo(x - 26, y - 200); c.fill();
    c.restore();
  };
  D.giantCrab = function (c, x, y, o) {
    c.save(); flick(c, o); c.translate(x, y);
    if (o.tele) c.translate(Math.sin(o.t * 50) * 2, 0);
    c.save(); c.scale(4.4, 4.4); D.crab(c, 0, 0, { t: o.walk ? o.t : o.t * 0.2, dir: o.face }); c.restore();
    // shell spikes
    c.fillStyle = '#b02a14';
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 18 - 7, -72 + Math.abs(i) * 6); c.lineTo(i * 18, -88 + Math.abs(i) * 6); c.lineTo(i * 18 + 7, -72 + Math.abs(i) * 6); c.fill(); }
    // big slam claw (front)
    const cl = o.claw || { x: o.face * 90, y: -90 };
    c.strokeStyle = '#d0401f'; c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); c.moveTo(o.face * 50, -50); c.quadraticCurveTo((o.face * 50 + cl.x) / 2, Math.min(-60, cl.y) - 30, cl.x, cl.y); c.stroke();
    c.save(); c.translate(cl.x, cl.y); c.rotate(o.face < 0 ? Math.PI : 0);
    c.fillStyle = '#f04a2a'; ell(c, 0, 0, 26, 18); c.fill(); c.fillStyle = '#ffd0c0'; c.beginPath(); c.moveTo(6, 0); c.lineTo(30, -12 - (o.snap || 0) * 10); c.lineTo(28, 4); c.fill();
    c.restore();
    c.restore();
    if (o.dizzy) D.dizzy(c, x, y - 105, o.t, 40);
  };
  D.glitch = function (c, x, y, o) {
    c.save(); if (o.alpha !== undefined) c.globalAlpha = o.alpha; flick(c, o);
    const t = o.t, sz = 10;
    const jit = o.tele ? 4 : 1.5;
    // chromatic split layers
    [['rgba(255,40,80,.55)', -3], ['rgba(40,220,255,.55)', 3], ['#5a2a1a', 0]].forEach(([col, dx], L) => {
      c.fillStyle = col;
      for (let gy = 0; gy < 10; gy++) for (let gx = -4; gx < 4; gx++) {
        const r = Math.hypot(gx + 0.5, (gy - 5) * 0.9);
        if (r > 4.6 + Math.sin(t * 3 + gy) * 0.4) continue;
        const sh = (Math.sin(t * 13 + gy * 7) > 0.85 ? (Math.sin(t * 40 + gy) * 6) : 0) + Math.sin(t * 30 + gx * gy) * jit * (L < 2 ? 1 : 0.3);
        c.fillRect(x + gx * sz + dx + sh, y - 100 + gy * sz, sz - 1, sz - 1);
      }
    });
    // soda-brown fizz highlights + face
    c.fillStyle = 'rgba(255,255,255,.75)';
    for (let i = 0; i < 6; i++) c.fillRect(x - 30 + ((i * 17 + t * 40) % 60), y - 100 + ((i * 29) % 90) - (t * 30 % 20), 3, 3);
    const fx = x + o.face * 10;
    c.fillStyle = o.dizzy ? '#fff' : '#ff3a3a'; c.fillRect(fx - 16, y - 70, 10, 10); c.fillRect(fx + 6, y - 70, 10, 10);
    c.fillStyle = '#111'; c.fillRect(fx - 12 + o.face * 2, y - 66, 4, 4); c.fillRect(fx + 10 + o.face * 2, y - 66, 4, 4);
    c.fillStyle = '#111'; for (let i = 0; i < 5; i++) c.fillRect(fx - 15 + i * 6, y - 48 + (i % 2) * 4, 5, 5);
    c.restore();
    if (o.dizzy) D.dizzy(c, x, y - 112, t, 34);
  };

  // ---------- world map ----------
  D.mapNode = function (c, x, y, o) {
    const r = o.boss ? 17 : 13;
    c.fillStyle = 'rgba(0,0,0,.25)'; ell(c, x, y + r * 0.7, r, r * 0.4); c.fill();
    const g = c.createRadialGradient(x - r * 0.3, y - r * 0.4, 2, x, y, r);
    if (o.done) { g.addColorStop(0, '#fff6b0'); g.addColorStop(1, '#e0a000'); } else { g.addColorStop(0, '#ffffff'); g.addColorStop(1, o.boss ? '#e0306e' : '#4a9bf0'); }
    c.fillStyle = g; circ(c, x, y, r); c.fill();
    c.strokeStyle = o.sel ? '#ffffff' : '#1b2a4a'; c.lineWidth = o.sel ? 4 : 2.5; c.stroke();
    if (o.sel) { c.strokeStyle = 'rgba(255,255,255,' + (0.4 + 0.4 * Math.sin(o.t * 6)) + ')'; c.lineWidth = 2; circ(c, x, y, r + 6); c.stroke(); }
    if (o.boss) { // skull-ish crown icon
      c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x - 9, y + 2); c.lineTo(x - 9, y - 7); c.lineTo(x - 4, y - 2); c.lineTo(x, y - 9); c.lineTo(x + 4, y - 2); c.lineTo(x + 9, y - 7); c.lineTo(x + 9, y + 2); c.fill();
      D.text(c, o.label, x, y + 8, 8, '#fff', { sw: 2 });
    } else D.text(c, o.label, x, y + 1, 10, '#fff', { sw: 3 });
    if (o.stars) for (let i = 0; i < 3; i++) { c.fillStyle = i < o.stars ? '#ffd21f' : 'rgba(255,255,255,.35)'; D.star(c, x - 11 + i * 11, y + r + 9, 5, 0); c.fill(); }
  };
})();

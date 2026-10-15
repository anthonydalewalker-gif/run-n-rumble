// Run N Rumble - Tubby's three friends (Pipple, Lunker, Squib), the living room and the portal home.
(function () {
  'use strict';
  const D = window.Draw, TAU = Math.PI * 2, ell = D.ell, circ = D.circ;

  const FRIENDS = {
    pipple: { name: 'Pipple', glow: '120,240,255', fur: ['#e6fff2', '#a6edc8', '#6cc79a'], hand: '#ffe14a', feet: [['#b65cff', '#7a1fd6'], ['#9af03a', '#5fae1a']] },
    lunker: { name: 'Lunker', glow: '235,240,255', fur: ['#dbe3ec', '#a3b0c2', '#76859c'], hand: '#ff5a2a', feet: [['#ffffff', '#c8d0da'], ['#ffffff', '#c8d0da']], stripe: '#4a6a9a' },
    squib:  { name: 'Squib',  glow: '255,90,200',  fur: ['#ffd0c4', '#ff9a8a', '#e06a5f'], hand: '#1f2f6a', feet: [['#2ac4b4', '#0f8a80'], ['#ff9a1f', '#d06a00']], cream: '#fff0e0' }
  };
  D.FRIENDS = FRIENDS;
  D.FRIEND_ORDER = ['pipple', 'lunker', 'squib'];

  function foot(c, x, y, col, rot, w) {
    c.save(); c.translate(x, y); c.rotate(rot || 0);
    const g = c.createLinearGradient(0, -5, 0, 4); g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
    c.fillStyle = g; ell(c, 1.5, 0, w || 6.5, 4.2); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.15)'; c.lineWidth = 0.8; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.5)'; ell(c, 2.5, -1.8, 2.6, 1.1); c.fill();
    c.restore();
  }
  function hand(c, sx, sy, ang, len, F, w) {
    const ex = sx + Math.cos(ang) * len, ey = sy + Math.sin(ang) * len;
    c.strokeStyle = F.fur[2]; c.lineWidth = w || 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke();
    c.strokeStyle = F.fur[1]; c.lineWidth = (w || 5) - 2; c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke();
    c.fillStyle = F.hand; circ(c, ex, ey, 3); c.fill();
    c.fillStyle = 'rgba(255,255,255,.35)'; circ(c, ex - 0.8, ey - 0.8, 1.1); c.fill();
  }
  function eye(c, x, y, r, o, t, iris) {
    if (o.blink) { c.strokeStyle = '#2a1a14'; c.lineWidth = 1.6; c.beginPath(); c.arc(x, y + 1, r * 0.8, 0.2, Math.PI - 0.2); c.stroke(); return; }
    c.fillStyle = '#fff'; ell(c, x, y, r, r * 1.15); c.fill();
    c.strokeStyle = 'rgba(40,30,30,.3)'; c.lineWidth = 0.8; c.stroke();
    c.fillStyle = iris || '#1a0f0a'; ell(c, x + r * 0.2, y + r * 0.2, r * 0.72, r * 0.85); c.fill();
    c.fillStyle = '#fff'; circ(c, x - r * 0.05, y - r * 0.3, r * 0.34); c.fill(); circ(c, x + r * 0.5, y + r * 0.55, r * 0.16); c.fill();
    c.fillStyle = 'rgba(255,255,255,' + (0.6 + 0.4 * Math.sin(t * 5 + x)) + ')'; D.star(c, x - r * 0.6, y - r * 0.8, r * 0.35, t); c.fill();
  }
  function furBall(c, x, y, rx, ry, F, light) {
    const g = c.createRadialGradient(x - rx * 0.3, y - ry * 0.4, 1, x, y, Math.max(rx, ry) * 1.1);
    g.addColorStop(0, F.fur[0]); g.addColorStop(0.6, F.fur[1]); g.addColorStop(1, F.fur[2]);
    c.fillStyle = g; ell(c, x, y, rx, ry); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 1; c.stroke();
  }
  function glowRing(c, F, cy, r, k) {
    const g = c.createRadialGradient(0, cy, r * 0.4, 0, cy, r);
    g.addColorStop(0, 'rgba(' + F.glow + ',' + 0.35 * k + ')'); g.addColorStop(0.7, 'rgba(' + F.glow + ',' + 0.18 * k + ')'); g.addColorStop(1, 'rgba(' + F.glow + ',0)');
    c.fillStyle = g; circ(c, 0, cy, r); c.fill();
  }

  // origin bottom-centre facing right. o: {face, run, speed, ground, air, t, blink, scale, glow (0..1), alpha, roll}
  D.friend = function (c, kind, x, y, o) {
    const F = FRIENDS[kind], t = o.t || 0, s = o.scale || 1;
    const sp = Math.min(1, o.speed || 0), run = o.run || 0, ground = o.ground !== false && !o.air, air = !!o.air;
    c.save(); c.translate(x, y);
    if (o.alpha !== undefined) c.globalAlpha = o.alpha;
    c.scale((o.face || 1) * s, s);
    const glow = o.glow === undefined ? sp : o.glow;
    if (kind === 'pipple') {
      // hyper bouncy ball: extra hop while running
      const hop = ground ? Math.abs(Math.sin(run * 1.3)) * 6 * sp : 0;
      const sq = ground ? 1 + (hop < 1 && sp > 0.2 ? 0.08 : 0) : 1;
      if (glow > 0.05) glowRing(c, F, -16 - hop, 30, glow);
      c.translate(0, -hop);
      const sw = ground ? Math.sin(run * 1.3) * 4 * sp : 0;
      foot(c, -5 - sw, -3, F.feet[0], air ? 0.4 : 0, 5.5);
      hand(c, -12, -12, air ? -2.4 : Math.PI / 2 + 0.7, 5, F, 4);
      c.save(); c.scale(sq, 1 / sq);
      furBall(c, 0, -17, 15, 14.5, F);
      c.fillStyle = '#ffffff'; ell(c, 2, -9, 9, 6.5); c.fill();                       // white belly
      // fuzzy edge
      c.strokeStyle = F.fur[2]; c.lineWidth = 1.2;
      for (let i = 0; i < 9; i++) { const a = -2.6 + i * 0.3; c.beginPath(); c.moveTo(Math.cos(a) * 14, -17 + Math.sin(a) * 14); c.lineTo(Math.cos(a) * 16.5, -17 + Math.sin(a) * 16.5); c.stroke(); }
      // tiny round wiggling ears
      const wig = Math.sin(t * 12) * 0.25;
      for (const [ex, k] of [[-7, -1], [7, 1]]) { c.save(); c.translate(ex, -30); c.rotate(wig * k); c.fillStyle = F.fur[2]; circ(c, 0, 0, 3.6); c.fill(); c.fillStyle = '#ffd6e6'; circ(c, 0, 0, 1.8); c.fill(); c.restore(); }
      eye(c, -1.5, -20, 4.4, o, t); eye(c, 8, -20, 4.4, o, t);
      c.fillStyle = 'rgba(255,130,160,.45)'; circ(c, -7, -14, 2.4); c.fill(); circ(c, 13.5, -14, 2.2); c.fill();
      c.fillStyle = '#6a1f35'; ell(c, 4, -12.5, 2.4, 2.8); c.fill();                  // surprised-happy "o"
      c.fillStyle = '#ff7f98'; ell(c, 4, -11.5, 1.5, 1.2); c.fill();
      c.strokeStyle = '#6a1f35'; c.lineWidth = 1; c.beginPath(); c.arc(4, -14, 5, 0.4, Math.PI - 0.4); c.stroke();
      c.restore();
      foot(c, 5 + sw, -3, F.feet[1], air ? -0.3 : 0, 5.5);
      hand(c, 12, -12, air ? -0.7 : Math.PI / 2 - 0.7, 5, F, 4);
    } else if (kind === 'lunker') {
      // tall, slow swinging heroic run
      const bob = ground ? Math.abs(Math.sin(run * 0.8)) * 2 * sp : 0;
      if (glow > 0.05) { glowRing(c, F, -30, 44, glow); }
      const sw = ground ? Math.sin(run * 0.8) * 7 * sp : 0;
      c.strokeStyle = F.fur[2]; c.lineWidth = 6; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-5, -14 - bob); c.lineTo(-5 - sw, -4); c.stroke();
      foot(c, -5 - sw, -3, F.feet[0], air ? 0.4 : 0, 7);
      hand(c, -11, -30 - bob, air ? -2.4 : Math.PI / 2 + 0.3 - Math.sin(run * 0.8) * 0.9 * sp, 10, F, 5.5);
      furBall(c, 0, -23 - bob, 12.5, 15, F);                                          // long chubby torso
      c.fillStyle = 'rgba(255,255,255,.55)'; ell(c, 3, -20 - bob, 7.5, 10); c.fill();
      c.strokeStyle = F.stripe; c.lineWidth = 4; c.beginPath(); c.arc(0, -23 - bob, 12, Math.PI * 0.75, Math.PI * 1.3); c.stroke();
      c.strokeStyle = F.fur[2]; c.lineWidth = 6;
      c.beginPath(); c.moveTo(5, -14 - bob); c.lineTo(5 + sw, -4); c.stroke();
      foot(c, 5 + sw, -3, F.feet[1], air ? -0.3 : 0, 7);
      const hy = -52 - bob;
      // ears: one straight, one crooked
      c.fillStyle = F.fur[2]; circ(c, -9, hy - 15, 5); c.fill(); c.fillStyle = '#ffd9d0'; circ(c, -9, hy - 15, 2.6); c.fill();
      c.save(); c.translate(10, hy - 15); c.rotate(0.6); c.fillStyle = F.fur[2]; ell(c, 0, 0, 5.5, 4.2); c.fill(); c.fillStyle = '#ffd9d0'; ell(c, 0, 0, 2.8, 2); c.fill(); c.restore();
      furBall(c, 0, hy, 17, 16.5, F);
      c.strokeStyle = F.stripe; c.lineWidth = 4; c.beginPath(); c.arc(0, hy, 15.5, Math.PI * 0.95, Math.PI * 1.45); c.stroke();
      c.fillStyle = F.fur[1]; c.beginPath(); c.moveTo(-3, hy - 15); c.quadraticCurveTo(-1, hy - 23, 2, hy - 18); c.quadraticCurveTo(4, hy - 24, 5, hy - 15); c.fill();   // tuft
      c.fillStyle = '#eef2f6'; ell(c, 10, hy + 6, 11, 6.5); c.fill();                // longer snout
      c.fillStyle = '#2a2a3a'; ell(c, 19, hy + 3.5, 2.6, 1.9); c.fill();
      eye(c, -1, hy - 4, 4, o, t, '#2a3a5a'); eye(c, 9, hy - 4, 4, o, t, '#2a3a5a');
      c.strokeStyle = '#3a1a2a'; c.lineWidth = 1.6; c.beginPath(); c.arc(11, hy + 6, 5, 0.3, Math.PI - 0.7); c.stroke();   // calm goofy grin
      c.fillStyle = 'rgba(255,140,140,.35)'; circ(c, -7, hy + 5, 2.4); c.fill();
      hand(c, 11, -30 - bob, air ? -0.8 : Math.PI / 2 - 0.3 + Math.sin(run * 0.8) * 0.9 * sp, 10, F, 5.5);
    } else {
      // squib: low wide pillow, rolls more than runs
      if (glow > 0.05) glowRing(c, F, -14, 32, glow);
      const roll = o.roll || 0;
      const bob = ground ? Math.abs(Math.sin(run * 1.1)) * 1.5 * sp : 0;
      c.save(); c.translate(0, -13 - bob); c.rotate(roll); c.translate(0, 13 + bob);
      const sw = ground && !roll ? Math.sin(run * 1.1) * 3 * sp : 0;
      foot(c, -8 - sw, -3, F.feet[0], 0, 6);
      // stubby tail sticking straight out
      c.fillStyle = F.fur[2]; ell(c, -20, -11 - bob, 5, 3.2); c.fill();
      furBall(c, 0, -11 - bob, 18, 10.5, F);                                          // wide pillow body
      c.fillStyle = F.cream; ell(c, 3, -8 - bob, 12, 6); c.fill();
      const hy = -24 - bob;
      c.fillStyle = F.fur[2]; circ(c, -8, hy - 10, 3.4); c.fill(); circ(c, 9, hy - 10, 3.4); c.fill();   // tiny rounded ears
      furBall(c, 1, hy, 15, 12, F);
      c.fillStyle = F.cream; ell(c, 3, hy + 3, 11.5, 7.5); c.fill();
      eye(c, -3, hy - 2.5, 3.6, o, t); eye(c, 7, hy - 2.5, 3.6, o, t);
      // extra-wide smile
      c.fillStyle = '#6a1f35'; c.beginPath(); c.moveTo(-6, hy + 3); c.quadraticCurveTo(3, hy + 5, 13, hy + 3); c.quadraticCurveTo(4, hy + 13, -6, hy + 3); c.fill();
      c.fillStyle = '#ff7f98'; ell(c, 3.5, hy + 7.5, 4, 1.8); c.fill();
      c.fillStyle = 'rgba(255,100,140,.45)'; circ(c, -9, hy + 2, 2.4); c.fill(); circ(c, 15, hy + 1, 2.2); c.fill();
      // tiny arms barely sticking out
      c.fillStyle = F.hand; circ(c, -18, -12 - bob, 2.8); c.fill(); circ(c, 18, -12 - bob + (ground ? Math.sin(run * 1.1) * 1.5 * sp : 0), 2.8); c.fill();
      foot(c, 8 + sw, -3, F.feet[1], 0, 6);
      c.restore();
    }
    c.restore();
  };

  // cage bubble that traps a friend
  D.friendCage = function (c, kind, x, y, t, open) {
    const F = FRIENDS[kind];
    if (open >= 1) return;
    c.save(); c.globalAlpha = 1 - open;
    const cy = y - 34 + Math.sin(t * 2) * 3;
    D.friend(c, kind, x, cy + 22, { t, scale: 0.9, glow: 0.4 + 0.2 * Math.sin(t * 4), face: -1, blink: (t % 3) < 0.1 });
    const g = c.createRadialGradient(x - 10, cy - 12, 4, x, cy, 36);
    g.addColorStop(0, 'rgba(255,255,255,.45)'); g.addColorStop(0.7, 'rgba(' + F.glow + ',.15)'); g.addColorStop(1, 'rgba(' + F.glow + ',.5)');
    c.fillStyle = g; circ(c, x, cy, 34 * (1 + open * 0.4)); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2; c.stroke();
    // cage bars
    c.strokeStyle = 'rgba(90,70,120,.7)'; c.lineWidth = 2.5;
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.ellipse(x, cy, Math.abs(i) === 2 ? 4 : 18 - Math.abs(i) * 6 + 12, 34, 0, 0, TAU); }
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x + i * 12, cy - Math.sqrt(Math.max(0, 34 * 34 - i * i * 144))); c.lineTo(x + i * 12, cy + Math.sqrt(Math.max(0, 34 * 34 - i * i * 144))); c.stroke(); }
    c.fillStyle = '#ffd21f'; D.rr(c, x - 7, cy + 26, 14, 11, 3); c.fill(); c.strokeStyle = '#8a6400'; c.lineWidth = 2; c.beginPath(); c.arc(x, cy + 26, 5, Math.PI, 0); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.7)'; ell(c, x - 13, cy - 16, 7, 3.5, -0.6); c.fill();
    D.text(c, 'HELP!', x, cy - 46 + Math.sin(t * 6) * 2, 12, '#fff', { sw: 3 });
    c.restore();
  };

  // front lip of the seat cushion, drawn over sitters so they sink into the couch
  D.couchFront = function (c, room) {
    const cx = room.couchX;
    const g = c.createLinearGradient(0, 246, 0, 272); g.addColorStop(0, '#7a9af0'); g.addColorStop(1, '#5a7ad0');
    c.fillStyle = g; D.rr(c, cx - 140, 248, 280, 24, 12); c.fill();
    c.strokeStyle = 'rgba(40,60,120,.35)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(cx, 250); c.lineTo(cx, 270); c.stroke();
  };
  // swirling portal back to the TV (Level 5 exit)
  D.portal = function (c, x, y, t) {
    const cy = y - 60;
    // TV frame
    c.fillStyle = '#3a3a4a'; D.rr(c, x - 52, cy - 46, 104, 86, 10); c.fill();
    c.strokeStyle = '#1a1a24'; c.lineWidth = 3; c.stroke();
    c.fillStyle = '#5a5a6a'; c.fillRect(x - 22, cy + 40, 6, 20); c.fillRect(x + 16, cy + 40, 6, 20);
    for (let i = 6; i > 0; i--) {
      c.fillStyle = ['#ffffff', '#c8f0ff', '#8ad0ff', '#b47aff', '#ff6fd0', '#5a2aa0'][i - 1];
      c.save(); c.translate(x, cy - 3); c.rotate(t * (1 + i * 0.3) * (i % 2 ? 1 : -1));
      ell(c, 0, 0, i * 7.2, i * 5.6); c.fill(); c.restore();
    }
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2;
    for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(x, cy - 3, 12 + k * 10, t * 3 + k * 2, t * 3 + k * 2 + 1.5); c.stroke(); }
    const a = 0.4 + 0.3 * Math.sin(t * 4);
    const gg = c.createRadialGradient(x, cy, 10, x, cy, 90); gg.addColorStop(0, 'rgba(200,160,255,' + a + ')'); gg.addColorStop(1, 'rgba(200,160,255,0)');
    c.fillStyle = gg; circ(c, x, cy, 90); c.fill();
    D.text(c, 'HOME', x, cy - 58, 13, '#ffde3a', { sw: 3 });
  };

  // living room scene for the story; k = how "zapped" the TV is (0..1)
  D.livingRoom = function (c, VW, VH, t, o) {
    o = o || {};
    const wg = c.createLinearGradient(0, 0, 0, VH); wg.addColorStop(0, '#ffe6b8'); wg.addColorStop(1, '#ffd08a');
    c.fillStyle = wg; c.fillRect(0, 0, VW, VH);
    c.fillStyle = 'rgba(255,255,255,.18)'; for (let x = 0; x < VW; x += 40) c.fillRect(x, 0, 18, 250);   // wallpaper stripes
    // window
    c.fillStyle = '#8fd8ff'; D.rr(c, 40, 50, 120, 90, 6); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 6; c.stroke();
    c.beginPath(); c.moveTo(100, 50); c.lineTo(100, 140); c.moveTo(40, 95); c.lineTo(160, 95); c.stroke();
    // floor + rug
    c.fillStyle = '#b07a44'; c.fillRect(0, 250, VW, VH - 250);
    c.fillStyle = '#ff7f98'; ell(c, VW * 0.42, 320, 200, 30); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 3; c.setLineDash([8, 6]); ell(c, VW * 0.42, 320, 185, 24); c.stroke(); c.setLineDash([]);
    // TV on a stand (right)
    const tx = o.tvX || VW * 0.78, ty = 150;
    c.fillStyle = '#7a4a22'; D.rr(c, tx - 80, ty + 70, 160, 50, 6); c.fill();
    c.fillStyle = '#2a2a34'; D.rr(c, tx - 74, ty - 50, 148, 112, 10); c.fill();
    const sc = o.screen || 'game';
    c.save(); D.rr(c, tx - 66, ty - 42, 132, 96, 6); c.clip();
    if (sc === 'game') {
      c.fillStyle = '#5ec8ff'; c.fillRect(tx - 66, ty - 42, 132, 96); c.fillStyle = '#5fbf3a'; c.fillRect(tx - 66, ty + 30, 132, 24);
      D.tubby(c, tx - 20 + Math.sin(t * 3) * 20, ty + 30, { t, scale: 0.6, ground: true, run: t * 14, speed: 1 });
    } else if (sc === 'static') {
      for (let i = 0; i < 160; i++) { c.fillStyle = Math.random() > 0.5 ? '#eee' : '#333'; c.fillRect(tx - 66 + Math.random() * 132, ty - 42 + Math.random() * 96, 4, 3); }
    } else {
      for (let i = 8; i > 0; i--) { c.fillStyle = ['#fff', '#c8f0ff', '#8ad0ff', '#b47aff', '#ff6fd0', '#5a2aa0', '#3a1a7a', '#1a0a4a'][i - 1]; c.save(); c.translate(tx, ty + 6); c.rotate(t * (1 + i * 0.4) * (i % 2 ? 1 : -1)); ell(c, 0, 0, i * 11, i * 8); c.fill(); c.restore(); }
    }
    c.restore();
    // couch (left)
    const cx = o.couchX || VW * 0.33;
    c.fillStyle = '#5a7ad0'; D.rr(c, cx - 150, 170, 300, 70, 24); c.fill();
    c.fillStyle = '#6a8ae0'; D.rr(c, cx - 140, 220, 280, 50, 16); c.fill();
    c.fillStyle = '#4a6ac0'; D.rr(c, cx - 175, 200, 45, 90, 18); c.fill(); D.rr(c, cx + 130, 200, 45, 90, 18); c.fill();
    c.fillStyle = '#3a4a80'; c.fillRect(cx - 140, 290, 12, 14); c.fillRect(cx + 128, 290, 12, 14);
    return { tvX: tx, tvY: ty, couchX: cx, seatY: 252 };
  };
})();

// Run N Rumble - artwork for Tubby Dash and the city / water / space worlds (vector shapes, no images).
(function () {
  'use strict';
  const D = window.Draw, TAU = Math.PI * 2;
  const ell = D.ell, circ = D.circ;
  const lerp = (a, b, k) => a + (b - a) * k;

  // ---------------- TUBBY DASH ----------------
  // origin = bottom-centre (feet on the ground), facing right, about 44 units tall.
  // o: {face, sx, sy, run, speed, ground, air, t, blink, hurt, alpha, scale, glow, field: 'shield'|'tough', sprout: 0..1}
  const FUR_LIGHT = '#fff4e0', FUR_MID = '#f2d7ae', FUR_DARK = '#d9b17e', HAND = '#ff9a2a';
  function foot(c, x, y, col, dark, rot) {
    c.save(); c.translate(x, y); c.rotate(rot || 0);
    const g = c.createLinearGradient(0, -5, 0, 4); g.addColorStop(0, col); g.addColorStop(1, dark);
    c.fillStyle = g; ell(c, 1.5, 0, 7, 4.4); c.fill();
    c.fillStyle = 'rgba(255,255,255,.45)'; ell(c, 2.5, -1.8, 3, 1.2); c.fill();
    c.restore();
  }
  function arm(c, sx, sy, ang) {
    const ex = sx + Math.cos(ang) * 7, ey = sy + Math.sin(ang) * 7;
    c.strokeStyle = FUR_DARK; c.lineWidth = 5.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke();
    c.strokeStyle = FUR_MID; c.lineWidth = 3.5; c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke();
    const hg = c.createRadialGradient(ex - 1, ey - 1, 0.5, ex, ey, 3.4); hg.addColorStop(0, '#ffc070'); hg.addColorStop(1, HAND);
    c.fillStyle = hg; circ(c, ex, ey, 3.1); c.fill();
  }
  function sparkleEye(c, x, y, o, t) {
    if (o.hurt) {
      c.strokeStyle = '#3a2418'; c.lineWidth = 1.8; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x - 3, y - 3); c.lineTo(x + 2, y); c.lineTo(x - 3, y + 3); c.stroke();
      return;
    }
    if (o.blink) { c.strokeStyle = '#3a2418'; c.lineWidth = 1.8; c.beginPath(); c.arc(x, y + 1, 3.5, 0.2, Math.PI - 0.2); c.stroke(); return; }
    c.fillStyle = '#fff'; ell(c, x, y, 4.3, 5.2); c.fill();
    c.strokeStyle = 'rgba(80,50,30,.35)'; c.lineWidth = 0.8; c.stroke();
    const pg = c.createRadialGradient(x + 1, y + 1, 0.5, x + 1, y + 1, 3.6); pg.addColorStop(0, '#6a3a1a'); pg.addColorStop(1, '#1a0f0a');
    c.fillStyle = pg; ell(c, x + 1, y + 1, 3.2, 3.8); c.fill();
    c.fillStyle = '#fff'; circ(c, x - 0.2, y - 1.2, 1.5); c.fill(); circ(c, x + 2.2, y + 2.4, 0.7); c.fill();
    // twinkle
    const tw = 0.6 + 0.4 * Math.sin(t * 5 + x);
    c.fillStyle = 'rgba(255,255,255,' + tw + ')'; D.star(c, x - 2.6, y - 3.4, 1.6, t); c.fill();
  }
  function sprout(c, k, t) {
    // leafy plant growing around Tubby's feet (High Jump power)
    const h = 8 + 22 * k;
    for (const side of [-1, 1]) {
      c.strokeStyle = '#2f9e3a'; c.lineWidth = 2.4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(side * 6, 0);
      c.bezierCurveTo(side * 16, -h * 0.3, side * 4, -h * 0.7, side * 13 + Math.sin(t * 4) * 2, -h); c.stroke();
      for (let i = 1; i <= 3; i++) {
        const ly = -h * i / 3.4, lx = side * (8 + Math.sin(i + t * 3) * 3);
        c.save(); c.translate(lx, ly); c.rotate(side * (0.6 + Math.sin(t * 4 + i) * 0.2));
        const g = c.createLinearGradient(0, 0, side * 9, 0); g.addColorStop(0, '#3fae3a'); g.addColorStop(1, '#9ff07a');
        c.fillStyle = g; ell(c, side * 5, 0, 5.5 * k + 1, 2.6 * k + 0.6); c.fill(); c.restore();
      }
    }
    c.fillStyle = '#5fbf3a'; ell(c, 0, 0.5, 13, 3); c.fill();
    c.fillStyle = '#9ff07a'; ell(c, -3, -0.3, 6, 1.2); c.fill();
  }
  D.tubby = function (c, x, y, o) {
    const t = o.t || 0, s = o.scale || 1;
    c.save(); c.translate(x, y);
    if (o.glow) {
      const r = 38 * s, gg = c.createRadialGradient(0, -22 * s, 4, 0, -22 * s, r);
      gg.addColorStop(0, 'rgba(255,240,120,.75)'); gg.addColorStop(1, 'rgba(255,200,0,0)');
      c.fillStyle = gg; circ(c, 0, -22 * s, r); c.fill();
    }
    if (o.sprout) { c.save(); c.scale(s, s); sprout(c, o.sprout, t); c.restore(); }
    c.scale((o.face || 1) * (o.sx || 1) * s, (o.sy || 1) * s);
    if (o.alpha !== undefined) c.globalAlpha = o.alpha;
    const sp = Math.min(1, o.speed || 0), run = o.run || 0;
    const ground = !!o.ground, air = !!o.air;
    const bob = ground ? Math.abs(Math.sin(run)) * 1.6 * sp : 0;
    const breathe = (ground && sp < 0.1) ? Math.sin(t * 3) * 0.7 : 0;
    const swing = ground ? Math.sin(run) * 5 * sp : 0;
    const lift1 = ground ? Math.max(0, Math.sin(run)) * 3 * sp : 0, lift2 = ground ? Math.max(0, -Math.sin(run)) * 3 * sp : 0;
    // back (red) foot + leg
    const bfx = air ? -7 : -5 - swing, bfy = air ? -4 : -3 - lift2;
    c.strokeStyle = FUR_DARK; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-5, -10 - bob); c.lineTo(bfx, bfy - 1); c.stroke();
    foot(c, bfx, bfy, '#ff4a4a', '#c41e2a', air ? 0.4 : 0);
    // back arm
    const armA = air ? -2.5 : Math.PI / 2 + 0.9 + (ground ? -Math.sin(run) * 0.8 * sp : 0);
    arm(c, -11, -15 - bob + breathe * 0.5, armA);
    // body
    const by = -14 - bob;
    const bg = c.createRadialGradient(-4, by - 5, 2, 0, by, 15);
    bg.addColorStop(0, FUR_LIGHT); bg.addColorStop(0.6, FUR_MID); bg.addColorStop(1, FUR_DARK);
    c.fillStyle = bg; ell(c, 0, by, 13.5, 11.5 + breathe * 0.4); c.fill();
    c.strokeStyle = 'rgba(150,100,50,.3)'; c.lineWidth = 1; c.stroke();
    c.fillStyle = '#fffaf0'; ell(c, 2.5, by + 2, 8, 7); c.fill();
    // fur tufts
    c.strokeStyle = FUR_DARK; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-13, by - 2); c.lineTo(-15.5, by); c.lineTo(-13, by + 2); c.stroke();
    // front (blue) foot + leg
    const ffx = air ? 7 : 5 + swing, ffy = air ? -6 : -3 - lift1;
    c.strokeStyle = FUR_DARK; c.lineWidth = 5;
    c.beginPath(); c.moveTo(5, -10 - bob); c.lineTo(ffx, ffy - 1); c.stroke();
    foot(c, ffx, ffy, '#3aa0ff', '#1a5fd0', air ? -0.3 : 0);
    // head
    const hy = -35 - bob + breathe;
    // ears
    for (const ex of [-9, 10]) {
      c.fillStyle = FUR_DARK; circ(c, ex, hy - 13, 5.2); c.fill();
      c.fillStyle = '#ffd9b8'; circ(c, ex, hy - 13, 2.8); c.fill();
    }
    const hg = c.createRadialGradient(-4, hy - 6, 3, 1, hy, 17.5);
    hg.addColorStop(0, FUR_LIGHT); hg.addColorStop(0.65, FUR_MID); hg.addColorStop(1, FUR_DARK);
    c.fillStyle = hg; circ(c, 1, hy, 16); c.fill();
    c.strokeStyle = 'rgba(150,100,50,.3)'; c.lineWidth = 1; c.stroke();
    // hair tuft
    c.fillStyle = FUR_MID;
    c.beginPath(); c.moveTo(-3, hy - 15); c.quadraticCurveTo(-1, hy - 22, 3, hy - 19); c.quadraticCurveTo(5, hy - 23, 7, hy - 15); c.fill();
    // muzzle
    c.fillStyle = '#fffaf2'; ell(c, 5, hy + 6, 8.5, 6); c.fill();
    // eyes
    sparkleEye(c, -2, hy - 3, o, t);
    sparkleEye(c, 9, hy - 3, o, t);
    // nose
    c.fillStyle = '#5a3020'; ell(c, 6, hy + 2.5, 2.4, 1.6); c.fill();
    c.fillStyle = 'rgba(255,255,255,.6)'; circ(c, 5.3, hy + 2, 0.7); c.fill();
    // cheeks
    c.fillStyle = 'rgba(255,120,120,.4)'; circ(c, -6, hy + 5, 2.6); c.fill(); circ(c, 14, hy + 4, 2.3); c.fill();
    // big goofy smile
    if (o.hurt) {
      c.fillStyle = '#7a1f35'; ell(c, 6, hy + 9, 2.6, 3); c.fill();
    } else {
      const open = air ? 1.3 : 1;
      c.fillStyle = '#7a1f35';
      c.beginPath(); c.moveTo(0, hy + 6); c.quadraticCurveTo(6, hy + 7, 12, hy + 5.5);
      c.quadraticCurveTo(11, hy + 6 + 6 * open, 6, hy + 6 + 6.5 * open); c.quadraticCurveTo(1, hy + 6 + 5 * open, 0, hy + 6); c.fill();
      c.fillStyle = '#fff'; c.fillRect(4, hy + 6.2, 4, 1.8);
      c.fillStyle = '#ff7f98'; ell(c, 6.5, hy + 9.8 + 1.5 * (open - 1) * 3, 3, 1.8); c.fill();
    }
    // front arm
    const armB = air ? -0.6 : Math.PI / 2 - 0.9 + (ground ? Math.sin(run) * 0.8 * sp : 0);
    arm(c, 11, -15 - bob + breathe * 0.5, armB);
    c.restore();
    if (o.field) {
      const r = 31 * s, cy = y - 22 * s;
      c.save();
      const sh = o.field === 'shield';
      const sg = c.createRadialGradient(x, cy, r * 0.6, x, cy, r);
      sg.addColorStop(0, sh ? 'rgba(60,60,90,0)' : 'rgba(255,170,60,0)');
      sg.addColorStop(0.85, sh ? 'rgba(70,70,110,.35)' : 'rgba(255,170,60,.28)');
      sg.addColorStop(1, sh ? 'rgba(30,30,50,.8)' : 'rgba(200,110,0,.75)');
      c.fillStyle = sg; circ(c, x, cy, r); c.fill();
      c.strokeStyle = sh ? 'rgba(200,200,255,.8)' : 'rgba(255,230,160,.9)'; c.lineWidth = 1.5;
      if (sh) {
        c.beginPath(); c.arc(x, cy, r - 1, t * 3, t * 3 + 1.4); c.stroke();
        c.beginPath(); c.arc(x, cy, r - 1, t * 3 + Math.PI, t * 3 + Math.PI + 1.4); c.stroke();
      } else {
        // honeycomb-ish dashes for "tough" (half damage)
        c.setLineDash([5, 4]); c.lineDashOffset = -t * 20; c.beginPath(); c.arc(x, cy, r - 2, 0, TAU); c.stroke(); c.setLineDash([]);
      }
      c.restore();
    }
  };

  // ---------------- enemies ----------------
  D.trashcan = function (c, x, y, o) {
    c.save(); c.translate(x, y);
    const flat = o.flat || 0;
    c.scale(o.dir < 0 ? 1 : -1, 1);
    if (flat) c.scale(1 + flat * 0.3, 1 - flat * 0.6);
    const g = c.createLinearGradient(0, -24, 0, 0); g.addColorStop(0, '#c8d0da'); g.addColorStop(0.5, '#8d98a8'); g.addColorStop(1, '#5d6878');
    c.fillStyle = g; D.rr(c, -17, -23, 34, 22, 5); c.fill();
    c.strokeStyle = '#3d4655'; c.lineWidth = 1.5; c.stroke();
    // ridges roll with the can
    c.save(); D.rr(c, -17, -23, 34, 22, 5); c.clip();
    c.strokeStyle = 'rgba(40,50,60,.45)'; c.lineWidth = 2;
    const off = ((o.roll || 0) * 6) % 8;
    for (let yy = -26 + off; yy < 4; yy += 8) { c.beginPath(); c.moveTo(-17, yy); c.lineTo(17, yy); c.stroke(); }
    c.restore();
    // lid end (front)
    c.fillStyle = '#6d7888'; ell(c, -17, -12, 4, 11.5); c.fill(); c.strokeStyle = '#3d4655'; c.stroke();
    c.fillStyle = '#9aa5b5'; ell(c, -18, -12, 1.6, 4); c.fill();
    // garbage peeking out the back
    c.fillStyle = '#ffd21f'; ell(c, 18, -18, 5, 2, 0.6); c.fill();
    c.fillStyle = '#7ad04a'; ell(c, 18, -8, 4, 2.4, -0.4); c.fill();
    // angry face
    if (flat) {
      c.strokeStyle = '#1b2230'; c.lineWidth = 1.5;
      [-8, 0].forEach(ex => { c.beginPath(); c.moveTo(ex - 2, -15); c.lineTo(ex + 2, -11); c.moveTo(ex + 2, -15); c.lineTo(ex - 2, -11); c.stroke(); });
    } else {
      c.fillStyle = '#fff'; ell(c, -8, -14, 3, 3.5); c.fill(); ell(c, 0, -14, 3, 3.5); c.fill();
      c.fillStyle = '#111'; circ(c, -9, -13.5, 1.7); c.fill(); circ(c, -1, -13.5, 1.7); c.fill();
      c.strokeStyle = '#1b2230'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(-12, -19); c.lineTo(-6, -17); c.moveTo(3, -19); c.lineTo(-2, -17); c.stroke();
      c.beginPath(); c.arc(-4, -5, 3, Math.PI + 0.3, -0.3); c.stroke();
    }
    c.restore();
  };
  D.crab = function (c, x, y, o) {
    c.save(); c.translate(x, y);
    const flat = o.flat || 0;
    if (flat) c.scale(1 + flat * 0.3, 1 - flat * 0.6);
    const t = o.t || 0;
    c.strokeStyle = '#c0301a'; c.lineWidth = 2; c.lineCap = 'round';
    if (!flat) for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const ph = Math.sin(t * 18 + i * 2 + (s > 0 ? 1 : 0)) * 2;
      c.beginPath(); c.moveTo(s * (6 + i * 3), -7); c.lineTo(s * (13 + i * 3), -4 + ph); c.lineTo(s * (14 + i * 3), 0); c.stroke();
    }
    const g = c.createRadialGradient(-3, -14, 2, 0, -10, 16); g.addColorStop(0, '#ff9a7a'); g.addColorStop(0.6, '#f04a2a'); g.addColorStop(1, '#b02a14');
    c.fillStyle = g; ell(c, 0, -10, 15, 8); c.fill();
    // claws
    if (!flat) for (const s of [-1, 1]) {
      const snap = Math.abs(Math.sin(t * 6 + s)) * 0.5;
      c.save(); c.translate(s * 16, -18); c.rotate(s * 0.3);
      c.fillStyle = '#f04a2a'; ell(c, 0, 0, 6, 4.5); c.fill();
      c.fillStyle = '#ffd0c0'; c.beginPath(); c.moveTo(s * 2, 0); c.lineTo(s * 7, -2 - snap * 4); c.lineTo(s * 7, 1); c.fill();
      c.restore();
      c.strokeStyle = '#d0401f'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(s * 10, -12); c.lineTo(s * 14, -16); c.stroke();
    }
    // eye stalks
    for (const ex of [-4, 4]) {
      c.strokeStyle = '#d0401f'; c.lineWidth = 2; c.beginPath(); c.moveTo(ex, -16); c.lineTo(ex, -22); c.stroke();
      c.fillStyle = '#fff'; circ(c, ex, -23, 3); c.fill();
      c.fillStyle = '#111'; circ(c, ex + (o.dir < 0 ? -1 : 1), -23, flat ? 0.6 : 1.6); c.fill();
    }
    c.strokeStyle = '#7a1a0a'; c.lineWidth = 1.3; c.beginPath(); c.arc(0, -8, 3, 0.3, Math.PI - 0.3); c.stroke();
    c.restore();
  };
  D.alien = function (c, x, y, o) {
    c.save(); c.translate(x, y);
    const flat = o.flat || 0, t = o.t || 0;
    if (flat) c.scale(1 + flat * 0.4, 1 - flat * 0.65);
    c.strokeStyle = '#2f8a3a'; c.lineWidth = 3; c.lineCap = 'round';
    if (!flat) { const ph = Math.sin(t * 14) * 3; c.beginPath(); c.moveTo(-6, -6); c.lineTo(-7 + ph, 0); c.moveTo(6, -6); c.lineTo(7 - ph, 0); c.stroke(); }
    const g = c.createRadialGradient(-4, -18, 2, 0, -13, 16); g.addColorStop(0, '#c8ff9a'); g.addColorStop(0.6, '#6fd04a'); g.addColorStop(1, '#2f8a3a');
    c.fillStyle = g; c.beginPath(); c.moveTo(-13, -4); c.quadraticCurveTo(-15, -26, 0, -26); c.quadraticCurveTo(15, -26, 13, -4); c.closePath(); c.fill();
    // antenna
    if (!flat) {
      c.strokeStyle = '#2f8a3a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -26); c.quadraticCurveTo(4, -32, 2 + Math.sin(t * 6) * 2, -35); c.stroke();
      const gl = 0.6 + 0.4 * Math.sin(t * 8);
      c.fillStyle = 'rgba(255,90,200,' + gl + ')'; circ(c, 2 + Math.sin(t * 6) * 2, -36, 3); c.fill();
    }
    // big eye
    c.fillStyle = '#fff'; ell(c, -1, -16, 7, flat ? 1.5 : 6.5); c.fill();
    if (!flat) { c.fillStyle = '#3a1060'; circ(c, -3, -15.5, 3.4); c.fill(); c.fillStyle = '#fff'; circ(c, -4, -17, 1.1); c.fill(); }
    c.strokeStyle = '#1f5a2a'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-6, -8); c.quadraticCurveTo(-1, -6, 4, -8); c.stroke();
    c.restore();
  };
  D.ufo = function (c, x, y, o) {
    const t = o.t || 0;
    c.save(); c.translate(x, y);
    if (o.beam) { const bg = c.createLinearGradient(0, 4, 0, 60); bg.addColorStop(0, 'rgba(160,255,160,.45)'); bg.addColorStop(1, 'rgba(160,255,160,0)'); c.fillStyle = bg; c.beginPath(); c.moveTo(-8, 4); c.lineTo(8, 4); c.lineTo(18, 60); c.lineTo(-18, 60); c.fill(); }
    // dome
    const dg = c.createRadialGradient(-3, -9, 1, 0, -5, 11); dg.addColorStop(0, 'rgba(230,255,255,.95)'); dg.addColorStop(1, 'rgba(120,200,255,.6)');
    c.fillStyle = dg; c.beginPath(); c.arc(0, -3, 10, Math.PI, 0); c.fill();
    c.fillStyle = '#6fd04a'; circ(c, 0, -6, 4); c.fill(); c.fillStyle = '#fff'; circ(c, 0, -7, 1.8); c.fill(); c.fillStyle = '#111'; circ(c, -0.5, -7, 0.9); c.fill();
    // saucer
    const sg = c.createLinearGradient(0, -6, 0, 6); sg.addColorStop(0, '#eef2f8'); sg.addColorStop(0.5, '#a6b0c2'); sg.addColorStop(1, '#5d6678');
    c.fillStyle = sg; ell(c, 0, 0, 23, 7); c.fill(); c.strokeStyle = '#3d4655'; c.lineWidth = 1; c.stroke();
    for (let i = 0; i < 6; i++) {
      const on = Math.floor(t * 8 + i) % 3 === 0;
      c.fillStyle = on ? '#ffe14a' : '#ff5fa0'; circ(c, -17 + i * 6.8, 1.5, 1.8); c.fill();
    }
    c.restore();
  };
  D.laser = function (c, x, y, t) {
    const g = c.createRadialGradient(x, y, 1, x, y, 9); g.addColorStop(0, '#f0fff0'); g.addColorStop(0.4, '#7aff7a'); g.addColorStop(1, 'rgba(60,255,60,0)');
    c.fillStyle = g; ell(c, x, y, 5, 9); c.fill();
  };
  D.pot = function (c, x, y, r, rot) {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.fillStyle = '#3fae3a'; ell(c, -5, -r * 0.9, 4, 7, -0.5); c.fill(); ell(c, 5, -r * 0.9, 4, 7, 0.5); c.fill();
    c.fillStyle = '#ff5f7a'; for (let i = 0; i < 5; i++) { const a = i * 1.2566; circ(c, Math.cos(a) * 4, -r * 1.25 + Math.sin(a) * 4, 3); c.fill(); }
    c.fillStyle = '#ffde3a'; circ(c, 0, -r * 1.25, 2.2); c.fill();
    const g = c.createLinearGradient(-r, 0, r, 0); g.addColorStop(0, '#a0441e'); g.addColorStop(0.4, '#e07a3a'); g.addColorStop(1, '#8a3414');
    c.fillStyle = g; c.beginPath(); c.moveTo(-r * 0.8, -r * 0.6); c.lineTo(r * 0.8, -r * 0.6); c.lineTo(r * 0.55, r * 0.8); c.lineTo(-r * 0.55, r * 0.8); c.closePath(); c.fill();
    c.fillStyle = '#c45a28'; D.rr(c, -r * 0.95, -r * 0.8, r * 1.9, r * 0.35, 2); c.fill();
    c.restore();
  };
  D.meteor = function (c, x, y, r, pts, rot, t) {
    // flaming tail above
    const g = c.createLinearGradient(x, y - r * 4, x, y);
    g.addColorStop(0, 'rgba(255,80,0,0)'); g.addColorStop(0.6, 'rgba(255,140,30,.7)'); g.addColorStop(1, 'rgba(255,240,150,.95)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(x - r * 0.9, y); c.quadraticCurveTo(x - r * 0.6 + Math.sin(t * 30) * 3, y - r * 2.5, x + r * 0.3, y - r * 4.2);
    c.quadraticCurveTo(x + r * 0.6, y - r * 2.2, x + r * 0.9, y); c.fill();
    D.rock(c, x, y, r, pts, rot);
    c.fillStyle = 'rgba(255,120,30,.35)'; circ(c, x, y, r * 1.05); c.fill();
  };
  D.fish = function (c, x, y, o) {
    const t = o.t || 0;
    c.save(); c.translate(x, y); c.scale(o.dir < 0 ? 1 : -1, 1);
    const wag = Math.sin(t * 12) * 0.35;
    c.save(); c.translate(13, 0); c.rotate(wag);
    c.fillStyle = '#c42a6a'; c.beginPath(); c.moveTo(0, 0); c.lineTo(11, -8); c.lineTo(9, 0); c.lineTo(11, 8); c.closePath(); c.fill(); c.restore();
    const g = c.createRadialGradient(-4, -4, 1, 0, 0, 16); g.addColorStop(0, '#ffb07a'); g.addColorStop(0.6, '#ff6f50'); g.addColorStop(1, '#d0305a');
    c.fillStyle = g; ell(c, 0, 0, 16, 10.5); c.fill();
    c.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(2 + i * 4, 0, 5, -1, 1); c.lineWidth = 1; c.strokeStyle = 'rgba(160,30,60,.35)'; c.stroke(); }
    c.fillStyle = '#c42a6a'; c.beginPath(); c.moveTo(-2, -9); c.quadraticCurveTo(4, -17, 8, -8); c.fill();
    c.fillStyle = '#fff'; circ(c, -8, -3, 3.4); c.fill(); c.fillStyle = '#111'; circ(c, -9, -2.6, 1.8); c.fill();
    c.strokeStyle = '#5a0a2a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-12, -8); c.lineTo(-5, -6.5); c.stroke();
    c.beginPath(); c.moveTo(-15, 3); c.lineTo(-11, 2); c.stroke();
    c.restore();
  };
  D.jelly = function (c, x, y, o) {
    const t = o.t || 0;
    c.save(); c.translate(x, y);
    c.strokeStyle = 'rgba(255,140,220,.75)'; c.lineWidth = 2; c.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const tx = -9 + i * 4.5;
      c.beginPath(); c.moveTo(tx, 2);
      for (let k = 1; k <= 4; k++) c.lineTo(tx + Math.sin(t * 5 + i + k) * 3, 2 + k * 6);
      c.stroke();
    }
    const pulse = 1 + Math.sin(t * 4) * 0.06;
    const g = c.createRadialGradient(-3, -8, 1, 0, -4, 16); g.addColorStop(0, 'rgba(255,230,250,.95)'); g.addColorStop(0.6, 'rgba(255,130,210,.85)'); g.addColorStop(1, 'rgba(200,70,180,.75)');
    c.fillStyle = g; c.beginPath(); c.ellipse(0, 2, 14 * pulse, 15 / pulse, 0, Math.PI, 0); c.quadraticCurveTo(0, 6, -14 * pulse, 2); c.fill();
    c.fillStyle = '#5a1040'; circ(c, -4, -4, 1.6); c.fill(); circ(c, 4, -4, 1.6); c.fill();
    c.strokeStyle = '#5a1040'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, -1, 2.5, 0.2, Math.PI - 0.2); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.6)'; ell(c, -6, -9, 3, 1.6, -0.5); c.fill();
    c.restore();
  };

  // ---------------- exits ----------------
  D.rainbowExit = function (c, x, y, t) {
    // a rainbow slide that rises off the cloud and curves down out of the level
    const bands = ['#ff4a4a', '#ff9a1f', '#ffe14a', '#5fd04a', '#3aa0ff', '#8a5aff'];
    bands.forEach((col, i) => {
      c.strokeStyle = col; c.lineWidth = 7;
      c.beginPath(); c.arc(x + 110, y + 10, 120 - i * 7, Math.PI, Math.PI * 1.75); c.stroke();
    });
    c.fillStyle = 'rgba(255,255,255,.95)';
    [[x - 12, y - 2, 1.1], [x + 18, y + 2, 0.9]].forEach(([a, b, s]) => { c.beginPath(); c.arc(a, b, 14 * s, 0, TAU); c.arc(a + 14 * s, b - 6 * s, 15 * s, 0, TAU); c.arc(a + 28 * s, b, 12 * s, 0, TAU); c.fill(); });
    c.fillStyle = 'rgba(255,255,220,' + (0.5 + 0.5 * Math.sin(t * 5)) + ')';
    for (let i = 0; i < 5; i++) { const a = Math.PI + i * 0.17 + 0.05; D.star(c, x + 110 + Math.cos(a) * 140, y + 10 + Math.sin(a) * 140, 3.5, t); c.fill(); }
  };
  D.pierExit = function (c, x, y, t) {
    // harbor gate: wooden arch + sign + life ring
    c.fillStyle = '#7a4a22';
    c.fillRect(x - 34, y - 80, 8, 80); c.fillRect(x + 26, y - 80, 8, 80);
    const g = c.createLinearGradient(0, y - 96, 0, y - 74); g.addColorStop(0, '#2f7fe0'); g.addColorStop(1, '#1a5fb0');
    c.fillStyle = g; D.rr(c, x - 44, y - 98, 88, 24, 6); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
    D.text(c, 'HARBOR', x, y - 86, 13, '#fff', { sw: 3, stroke: '#123' });
    c.strokeStyle = '#ff4a4a'; c.lineWidth = 6; c.beginPath(); c.arc(x + 30, y - 52, 9, 0, TAU); c.stroke();
    c.strokeStyle = '#fff'; c.lineWidth = 6; c.setLineDash([7, 7]); c.beginPath(); c.arc(x + 30, y - 52, 9, 0, TAU); c.stroke(); c.setLineDash([]);
    // arrow
    c.fillStyle = 'rgba(255,255,255,' + (0.6 + 0.4 * Math.sin(t * 6)) + ')';
    c.beginPath(); c.moveTo(x - 10, y - 50); c.lineTo(x + 10, y - 40); c.lineTo(x - 10, y - 30); c.fill();
  };
  D.submarine = function (c, x, y, t, tilt) {
    c.save(); c.translate(x, y); c.rotate(tilt || 0);
    // tower + periscope
    c.fillStyle = '#e0a400'; D.rr(c, -12, -42, 26, 16, 5); c.fill();
    c.strokeStyle = '#8a6400'; c.lineWidth = 3; c.beginPath(); c.moveTo(6, -42); c.lineTo(6, -54); c.lineTo(13, -54); c.stroke();
    const g = c.createLinearGradient(0, -30, 0, 0); g.addColorStop(0, '#fff07a'); g.addColorStop(0.5, '#ffd21f'); g.addColorStop(1, '#c48a00');
    c.fillStyle = g; ell(c, 0, -15, 48, 16); c.fill();
    c.strokeStyle = '#8a6400'; c.lineWidth = 1.5; c.stroke();
    for (let i = 0; i < 3; i++) { c.fillStyle = '#4a7ab0'; circ(c, -22 + i * 18, -15, 5.5); c.fill(); c.strokeStyle = '#8a6400'; c.lineWidth = 2; c.stroke(); c.fillStyle = 'rgba(255,255,255,.6)'; circ(c, -24 + i * 18, -17, 1.6); c.fill(); }
    // propeller
    c.save(); c.translate(-50, -15); c.scale(1, Math.cos(t * 20));
    c.fillStyle = '#8a6400'; ell(c, 0, -6, 2.5, 6); c.fill(); ell(c, 0, 6, 2.5, 6); c.fill(); c.restore();
    c.restore();
  };
  D.rocket = function (c, x, y, t, flame) {
    c.save(); c.translate(x, y);
    if (flame) {
      const fl = 30 + Math.sin(t * 40) * 6 + flame * 30;
      const g = c.createLinearGradient(0, 0, 0, fl); g.addColorStop(0, '#fffbd0'); g.addColorStop(0.4, '#ffb21f'); g.addColorStop(1, 'rgba(255,60,0,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(-10, -4); c.quadraticCurveTo(0, fl * 1.1, 10, -4); c.fill();
    }
    // fins
    c.fillStyle = '#e0304a';
    c.beginPath(); c.moveTo(-14, -30); c.lineTo(-28, 0); c.lineTo(-12, -6); c.fill();
    c.beginPath(); c.moveTo(14, -30); c.lineTo(28, 0); c.lineTo(12, -6); c.fill();
    const g = c.createLinearGradient(-16, 0, 16, 0); g.addColorStop(0, '#c8d0da'); g.addColorStop(0.4, '#ffffff'); g.addColorStop(1, '#9aa5b5');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(-15, -4); c.lineTo(-15, -60); c.quadraticCurveTo(-14, -88, 0, -104); c.quadraticCurveTo(14, -88, 15, -60); c.lineTo(15, -4); c.closePath(); c.fill();
    c.strokeStyle = '#5d6678'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = '#e0304a'; c.beginPath(); c.moveTo(-11, -84); c.quadraticCurveTo(0, -96, 11, -84); c.quadraticCurveTo(0, -104, -11, -84); c.fill();
    c.fillStyle = '#3aa0ff'; circ(c, 0, -60, 8); c.fill(); c.strokeStyle = '#5d6678'; c.lineWidth = 2.5; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.6)'; circ(c, -3, -63, 2.5); c.fill();
    c.fillStyle = '#e0304a'; c.fillRect(-15, -30, 30, 6);
    c.fillStyle = '#5d6678'; c.fillRect(-10, -6, 20, 4);
    c.restore();
  };

  // ---------------- world solids ----------------
  const BRICKS = [['#d9776a', '#a8483e'], ['#9a83c4', '#6a5394'], ['#6aa0c4', '#3e6e92'], ['#e0b46a', '#a87e3a'], ['#7ac49a', '#4a8e6a']];
  D.building = function (c, s, L, R, VH, t) {
    const pal = BRICKS[Math.floor(window.hash01(s.x * 0.37) * BRICKS.length)];
    const bottom = VH + 20, x0 = Math.max(s.x, L - 20), x1 = Math.min(s.x + s.w, R + 20);
    const g = c.createLinearGradient(0, s.y, 0, bottom); g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]);
    c.fillStyle = g; c.fillRect(s.x, s.y + 4, s.w, bottom - s.y);
    // windows
    for (let wy = s.y + 26; wy < bottom; wy += 34) {
      for (let wx = Math.floor((x0 - s.x) / 30) * 30 + s.x + 12; wx < x1 - 16; wx += 30) {
        const lit = window.hash01(wx * 0.13 + wy) > 0.55;
        c.fillStyle = lit ? '#fff3a0' : 'rgba(30,40,70,.55)'; D.rr(c, wx, wy, 14, 18, 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(wx + 2, wy + 2, 3, 14);
      }
    }
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(s.x, s.y + 4, 4, bottom - s.y); c.fillRect(s.x + s.w - 4, s.y + 4, 4, bottom - s.y);
    // roof ledge
    c.fillStyle = '#5a5f70'; D.rr(c, s.x - 4, s.y - 2, s.w + 8, 9, 3); c.fill();
    c.fillStyle = '#8a90a2'; c.fillRect(s.x - 4, s.y - 2, s.w + 8, 2.5);
  };
  D.acUnit = function (c, s, by) {
    c.fillStyle = 'rgba(0,0,0,.15)'; D.rr(c, s.x + 3, by + 4, s.w, s.h, 4); c.fill();
    const g = c.createLinearGradient(0, by, 0, by + s.h); g.addColorStop(0, '#e6eaf0'); g.addColorStop(1, '#9aa3b5');
    c.fillStyle = g; D.rr(c, s.x, by, s.w, s.h, 4); c.fill();
    c.strokeStyle = '#5d6678'; c.lineWidth = 1.5; c.stroke();
    c.strokeStyle = 'rgba(60,70,90,.45)'; c.lineWidth = 1;
    for (let x = s.x + 8; x < s.x + s.w - 6; x += 6) { c.beginPath(); c.moveTo(x, by + 5); c.lineTo(x, by + s.h - 4); c.stroke(); }
  };
  D.dock = function (c, s, VH) {
    c.fillStyle = '#6a4020';
    for (let px = s.x + 10; px < s.x + s.w; px += 60) { c.fillRect(px, s.y + 8, 8, VH - s.y); }
    const g = c.createLinearGradient(0, s.y, 0, s.y + 12); g.addColorStop(0, '#c9935a'); g.addColorStop(1, '#8a5a2a');
    c.fillStyle = g; c.fillRect(s.x, s.y, s.w, 12);
    c.strokeStyle = 'rgba(70,40,15,.6)'; c.lineWidth = 1;
    for (let px = s.x + 18; px < s.x + s.w; px += 18) { c.beginPath(); c.moveTo(px, s.y); c.lineTo(px, s.y + 12); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(s.x, s.y, s.w, 2);
  };
  D.log = function (c, s) {
    const g = c.createLinearGradient(0, s.y, 0, s.y + s.h); g.addColorStop(0, '#b07a44'); g.addColorStop(0.5, '#8a5a2a'); g.addColorStop(1, '#5a3a18');
    c.fillStyle = g; D.rr(c, s.x, s.y, s.w, s.h, s.h / 2); c.fill();
    c.strokeStyle = 'rgba(60,30,10,.5)'; c.lineWidth = 1;
    for (let x = s.x + 14; x < s.x + s.w - 10; x += 22) { c.beginPath(); c.moveTo(x, s.y + 4); c.quadraticCurveTo(x + 6, s.y + s.h / 2, x, s.y + s.h - 4); c.stroke(); }
    c.fillStyle = '#d9a066'; ell(c, s.x + s.w - 4, s.y + s.h / 2, 4, s.h / 2 - 1); c.fill();
    c.strokeStyle = '#8a5a2a'; c.beginPath(); c.ellipse(s.x + s.w - 4, s.y + s.h / 2, 2, s.h / 4, 0, 0, TAU); c.stroke();
    c.fillStyle = '#5fbf3a'; ell(c, s.x + s.w * 0.3, s.y + 1, 5, 2); c.fill();
  };
  D.sand = function (c, s, L, R, VH) {
    const x0 = Math.max(s.x, L - 20), x1 = Math.min(s.x + s.w, R + 20);
    const g = c.createLinearGradient(0, s.y, 0, VH); g.addColorStop(0, '#f2dca0'); g.addColorStop(1, '#c9a860');
    c.fillStyle = g; c.fillRect(x0, s.y, x1 - x0, VH - s.y + 20);
    for (let x = Math.floor(x0 / 70) * 70; x < x1; x += 70) {
      const h = window.hash01(x);
      c.fillStyle = h > 0.5 ? '#ff9ab8' : '#fff0d0';
      ell(c, x + h * 40, s.y + 6, 4, 2.5); c.fill();
      if (h > 0.7) { c.strokeStyle = '#3fae3a'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x + 20, s.y); c.quadraticCurveTo(x + 14, s.y - 14, x + 22, s.y - 26); c.stroke(); }
    }
  };
  D.coral = function (c, s, t) {
    const g = c.createLinearGradient(s.x, 0, s.x + s.w, 0); g.addColorStop(0, '#ff6f8a'); g.addColorStop(0.5, '#ff9aa8'); g.addColorStop(1, '#d04a6a');
    c.fillStyle = g; D.rr(c, s.x, s.y, s.w, s.h + 10, 12); c.fill();
    c.fillStyle = 'rgba(160,30,70,.35)';
    for (let yy = s.y + 10; yy < s.y + s.h; yy += 14) for (let xx = s.x + 8; xx < s.x + s.w - 4; xx += 12) { circ(c, xx + (yy % 2) * 4, yy, 2); c.fill(); }
    c.fillStyle = '#ffb0c0';
    for (let i = 0; i < 3; i++) { const bx = s.x + s.w * (0.2 + i * 0.3); c.beginPath(); c.arc(bx, s.y, 6 + Math.sin(t * 2 + i) * 1, Math.PI, 0); c.fill(); }
  };
  D.moonRock = function (c, s, L, R, VH, block) {
    const bottom = block ? s.y + s.h : VH + 20;
    const g = c.createLinearGradient(0, s.y, 0, bottom); g.addColorStop(0, '#c9c3e0'); g.addColorStop(1, '#6a6290');
    c.fillStyle = g;
    if (block) { D.rr(c, s.x, s.y, s.w, s.h, s.h / 2); c.fill(); }
    else c.fillRect(s.x, s.y + 4, s.w, bottom - s.y);
    c.fillStyle = '#e6e1f5'; D.rr(c, s.x - 2, s.y - 1, s.w + 4, 8, 4); c.fill();
    const x0 = Math.max(s.x + 10, L - 20), x1 = Math.min(s.x + s.w - 10, R + 20);
    for (let x = Math.floor(x0 / 46) * 46; x < x1; x += 46) {
      if (x < s.x + 8) continue;
      const h = window.hash01(x * 0.7), cy = s.y + 14 + h * (block ? 2 : 40), r = 3 + h * 6;
      if (block && h > 0.6) continue;
      c.fillStyle = 'rgba(80,70,120,.45)'; ell(c, x, cy, r, r * 0.6); c.fill();
      c.fillStyle = 'rgba(255,255,255,.25)'; ell(c, x + 1, cy + r * 0.25, r * 0.7, r * 0.3); c.fill();
    }
    if (!block) { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(s.x, s.y + 6, 4, bottom - s.y); c.fillRect(s.x + s.w - 4, s.y + 6, 4, bottom - s.y); }
  };
})();

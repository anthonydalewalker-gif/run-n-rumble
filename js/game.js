// Run N Rumble - core game engine.
(function () {
  'use strict';
  const D = window.Draw, Input = window.Input, Sound = window.Sound;
  const VH = 360;              // logical screen height; width adapts to the screen's aspect ratio
  const GRAV = 1700, MAX_FALL = 900;
  const STARS_PER_LIFE = 5, START_LIVES = 5, POWER_TIME = 10, WIND_PUSH = 75;

  const CHARACTERS = {
    radish: { key: 'radish', name: 'Radish', speed: 235, jump: 650, hitsPerStar: 1, w: 22, h: 34, desc: 'Fastest runner', stats: [3, 2, 1] },
    orange: { key: 'orange', name: 'Orange', speed: 200, jump: 760, hitsPerStar: 1, w: 24, h: 32, desc: 'Jumps the highest', stats: [2, 3, 1] },
    pickle: { key: 'pickle', name: 'Pickle', speed: 165, jump: 650, hitsPerStar: 2, w: 22, h: 44, desc: 'Toughest: 2 hits per star', stats: [1, 2, 3] }
  };
  const CHAR_ORDER = ['radish', 'orange', 'pickle'];

  // ---------- canvas / scaling ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let DPR = 1, SCALE = 1, VW = 700, SAFE_L = 0, SAFE_R = 0;
  const safeProbe = document.createElement('div');
  safeProbe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px)';
  document.body.appendChild(safeProbe);
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.round(w * DPR); canvas.height = Math.round(h * DPR);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    SCALE = canvas.height / VH; VW = canvas.width / SCALE;
    const cs = getComputedStyle(safeProbe);
    SAFE_L = (parseFloat(cs.paddingLeft) || 0) * DPR / SCALE;
    SAFE_R = (parseFloat(cs.paddingRight) || 0) * DPR / SCALE;
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  resize();
  Input.toLogical = (cx, cy) => ({ x: cx * DPR / SCALE, y: cy * DPR / SCALE });

  // ---------- save data ----------
  const SAVE_KEY = 'rnr_save_v1';
  let save = { high: 0, unlocked: 1, best: {}, char: 'radish' };
  try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) {}
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

  // ---------- game state ----------
  const G = {
    state: 'title', t: 0, stateT: 0,
    charKey: CHARACTERS[save.char] ? save.char : 'radish',
    levelIdx: 0, score: 0, levelStartScore: 0, lives: START_LIVES,
    message: null, result: null, god: false, rescue: false, rescues: 0, fade: 0
  };
  let W = null;   // current world
  let P = null;   // player

  function setState(s) {
    // Entering gameplay: ignore any finger that was already down (e.g. the one that tapped PLAY/RETRY).
    if ((s === 'intro' || s === 'play') && ['title', 'select', 'levels', 'paused', 'gameover', 'complete', 'victory'].includes(G.state)) Input.ignoreBefore = performance.now();
    G.state = s; G.stateT = 0;
  }
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const approach = (v, target, d) => v < target ? Math.min(v + d, target) : Math.max(v - d, target);

  // ---------- world building ----------
  function buildLevel(idx) {
    const def = window.LEVELS[idx];
    const theme = window.THEMES[def.theme];
    ['blocks', 'clouds', 'bugs', 'birds', 'snakes', 'rocks', 'seeds', 'flytraps', 'vines', 'lightning', 'wind'].forEach(k => { if (!def[k]) def[k] = []; });
    const cloudy = theme.solid === 'cloud';
    const w = {
      def, theme, solids: [], gaps: [], ents: [], parts: [], pops: [], decor: [], streaks: [],
      wind: { phase: 'calm', t: 2.5 }, boltT: 2, flash: 0,
      seeds: 0, time: def.time, camX: 0, shake: 0, t: 0,
      rockT: 2, powerT: def.power.first, birdTriggers: def.birds.map(b => ({ x: b[0], seed: !!b[1], done: false })),
      banner: null, needMsgT: 0, won: false
    };
    def.ground.forEach(([x0, x1, top]) => w.solids.push({ x: x0, y: top, w: x1 - x0, h: 600, kind: cloudy ? 'cloud' : 'ground', style: 'bank', main: true, bump: 0, alpha: 1 }));
    def.blocks.forEach(([x, top, bw]) => w.solids.push({ x, y: top, w: bw, h: 22, kind: cloudy ? 'cloud' : 'block', style: 'static', bump: 0, alpha: 1 }));
    def.clouds.forEach(([x, top, cw, style, o]) => {
      o = o || {};
      w.solids.push({ x, y: top, w: cw, h: 20, kind: 'cloud', style, bx: x, by: top, ax: o.ax || 0, ay: o.ay || 0, period: o.period || 4, bump: 0, alpha: 1, standT: 0, off: false, respawnT: 0, squash: 0, dx: 0, dy: 0 });
    });
    const gs = def.ground.slice().sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < gs.length - 1; i++) if (gs[i + 1][0] > gs[i][1]) w.gaps.push({ x0: gs[i][1], x1: gs[i + 1][0], passed: false });
    W = w;
    def.bugs.forEach(([x, seed]) => w.ents.push(makeBug(x, !!seed)));
    def.snakes.forEach(([x]) => w.ents.push(makeSnake(x)));
    def.seeds.forEach(([x]) => { const s = makeSeed(x, surfaceAt(x) - 16); s.state = 'rest'; w.ents.push(s); });
    def.flytraps.forEach(([x], i) => w.ents.push({ type: 'flytrap', x, y: null, w: 30, h: 26, open: 0, warn: false, phase: window.hash01(i + x) * 3.6, state: 'alive', passed: false, t: 0 }));
    def.vines.forEach(([x, count], i) => w.ents.push({ type: 'vine', x, y: null, count, gap: 26, hs: new Array(count).fill(0), phase: window.hash01(i * 7 + 3) * 3.6, passed: false, t: 0 }));
    w.tree = { x: def.tree, y: surfaceAt(def.tree, true), grow: 0 };
    // decoration
    let k = 0;
    def.ground.forEach(([x0, x1, top]) => {
      for (let x = x0 + 30; x < x1 - 30; x += 40 + window.hash01(k++) * 90) {
        if (Math.abs(x - def.tree) < 80) continue;
        if (def.vines.some(([vx, n]) => x > vx - 20 && x < vx + n * 26 + 10)) continue;
        const r = window.hash01(k++);
        w.decor.push({ x, y: top, kind: r < 0.5 ? 'flower' : (r < 0.8 || cloudy) ? 'bush' : 'mushroom', col: ['#ff6fa8', '#ffffff', '#b47aff', '#ff8a3a'][Math.floor(window.hash01(k++) * 4)] });
      }
    });
    return w;
  }
  function surfaceAt(x, groundOnly) {
    let best = null;
    for (const s of W.solids) {
      if (s.off) continue;
      if (groundOnly && !s.main) continue;
      if (x >= s.x && x <= s.x + s.w && (best === null || s.y < best)) best = s.y;
    }
    return best;
  }

  function makePlayer() {
    const C = CHARACTERS[G.charKey];
    return {
      C, x: 60, y: surfaceAt(60), vx: 0, vy: 0, w: C.w, h: C.h, face: 1, onGround: true,
      stars: STARS_PER_LIFE, hitCount: 0, invuln: 0, sx: 1, sy: 1, run: 0, coyote: 0, jumpBuf: 0, jumping: false,
      pw: { speed: 0, power: 0, shield: 0 }, trail: [], trailT: 0, blinkT: 2, blink: 0, dead: false, prevY: 0, hurtFace: 0, dustT: 0
    };
  }
  function makeBug(x, seed) {
    return { type: 'bug', x, y: null, w: 32, h: 22, vx: 0, vy: 0, dir: -1, speed: rand(55, 85), active: false, state: 'walk', seed, passed: false, t: rand(0, 5), flatT: 0 };
  }
  function makeSnake(x) {
    return { type: 'snake', x, y: null, w: 40, h: 36, dir: -1, cool: 1.0, high: false, headY: -40, open: 0, windup: 0, state: 'alive', passed: false, t: 0 };
  }
  function makeSeed(x, y) { return { type: 'seed', x, y, vx: 0, vy: 0, state: 'fall', t: rand(0, 6) }; }

  function startLevel(idx, fresh) {
    G.levelIdx = idx;
    if (fresh) { G.lives = START_LIVES; G.levelStartScore = G.score; }
    G.score = G.levelStartScore;
    buildLevel(idx);
    W.ents.forEach(e => { if (e.y === null) e.y = surfaceAt(e.x); });
    P = makePlayer();
    W.camX = 0;
    setState('intro');
    Sound.playMusic(W.def.music);
  }

  // ---------- collision ----------
  function overlaps(ax, ay, aw, ah, bx, by, bw, bh) { return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by; }
  function moveBody(b, dt) {
    b.hitWall = 0; b.hitHead = null;
    const wasGround = b.onGround; b.onGround = false;
    const mvx = b.vx + (b.pushVx || 0);
    b.x += mvx * dt;
    for (const s of W.solids) {
      if (s.off) continue;
      if (overlaps(b.x - b.w / 2, b.y - b.h, b.w, b.h, s.x, s.y, s.w, s.h)) {
        if (mvx > 0) { b.x = s.x - b.w / 2 - 0.01; b.hitWall = 1; }
        else if (mvx < 0) { b.x = s.x + s.w + b.w / 2 + 0.01; b.hitWall = -1; }
        else if (b.x < s.x + s.w / 2) { b.x = s.x - b.w / 2 - 0.01; } else { b.x = s.x + s.w + b.w / 2 + 0.01; }
        b.vx = 0;
      }
    }
    b.y += b.vy * dt;
    for (const s of W.solids) {
      if (s.off) continue;
      if (overlaps(b.x - b.w / 2, b.y - b.h, b.w, b.h, s.x, s.y, s.w, s.h)) {
        if (b.vy >= 0) { b.y = s.y; b.vy = 0; b.onGround = true; b.groundS = s; }
        else { b.y = s.y + s.h + b.h; b.vy = 0; b.hitHead = s; }
      }
    }
    // Stay glued when walking over tiny steps downward
    if (!b.onGround && wasGround && b.vy >= 0) {
      for (const s of W.solids) {
        if (s.off) continue;
        if (b.x + b.w / 2 > s.x && b.x - b.w / 2 < s.x + s.w && s.y >= b.y && s.y - b.y < 4) { b.y = s.y; b.onGround = true; b.vy = 0; break; }
      }
    }
  }

  // ---------- fx ----------
  function pop(x, y, text, col, size) { W.pops.push({ x, y, text, col: col || '#fff', t: 0, size: size || 14 }); }
  function burst(x, y, n, kind, col, spd) {
    for (let i = 0; i < n && W.parts.length < 300; i++) {
      const a = rand(0, Math.PI * 2), v = rand(0.3, 1) * (spd || 160);
      W.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (kind === 'feather' ? 40 : 60), life: 0, max: kind === 'feather' ? rand(0.9, 1.5) : rand(0.35, 0.7), kind, col: col || '#fff', size: rand(2, 4.5), rot: rand(0, 6), vr: rand(-8, 8) });
    }
  }
  function addScore(n, x, y, label) {
    G.score = Math.max(0, G.score + n);
    if (x !== undefined) pop(x, y, (label ? label + ' ' : '') + (n > 0 ? '+' : '') + n, n > 0 ? (n >= 1000 ? '#ffe14a' : '#ffffff') : '#ff6a6a', n >= 1000 ? 15 : 13);
  }
  function banner(text, sub, dur) { W.banner = { text, sub, t: 0, dur: dur || 2 }; }

  // ---------- player damage / death ----------
  function hurt(src) {
    if (P.dead || P.invuln > 0 || G.god || W.won) return;
    if (P.pw.shield > 0) {
      P.invuln = 0.6; Sound.play('shield');
      burst(P.x, P.y - P.h / 2, 10, 'spark', '#c8c8ff', 160);
      if (src && src.type === 'bug') src.dir *= -1;
      return;
    }
    Sound.play('hit');
    addScore(-300, P.x, P.y - P.h - 10);
    P.hitCount++;
    if (P.hitCount >= P.C.hitsPerStar) { P.hitCount = 0; P.stars--; }
    P.invuln = 1.6; P.hurtFace = 0.5;
    const away = src && src.x > P.x ? -1 : 1;
    P.vx = away * 220; P.vy = -380; P.onGround = false;
    W.shake = 6;
    burst(P.x, P.y - P.h / 2, 8, 'spark', '#ffd0d0', 140);
    if (P.stars <= 0) die('Out of stars!');
  }
  function die(reason) {
    if (P.dead || W.won) return;
    P.dead = true; P.deadT = 0; P.vy = -520; P.vx = 0;
    G.dieReason = reason;
    Sound.play('lifelost');
    setState('dying');
  }

  // ---------- enemy defeat ----------
  function smash(e, how) {
    if (e.type === 'bug') {
      if (how === 'bump') { e.state = 'bumped'; e.vy = -320; e.vx = (e.x > P.x ? 1 : -1) * 60; Sound.play('bonk'); }
      else { e.state = 'flat'; e.flatT = 0; e.vx = 0; Sound.play('squish'); burst(e.x, e.y - 6, 8, 'dust', '#d9b27a', 90); }
      if (e.seed) { e.seed = false; const s = makeSeed(e.x, e.y - 30); s.vy = -320; s.vx = rand(-30, 30); W.ents.push(s); }
    } else if (e.type === 'bird') {
      e.state = 'dead'; Sound.play('poof');
      burst(e.x, e.y, 16, 'feather', '#cfe6ff', 150); burst(e.x, e.y, 6, 'feather', '#4a9bf0', 120);
      if (e.seed) { e.seed = false; const s = makeSeed(e.x, e.y + 10); s.vy = -150; W.ents.push(s); }
    } else if (e.type === 'snake') {
      e.state = 'dead'; Sound.play('poof');
      burst(e.x, e.y - 20, 18, 'spark', '#8be05a', 180);
    } else if (e.type === 'flytrap') {
      e.state = 'dead'; e.dead = true; Sound.play('poof');
      burst(e.x, e.y - 14, 14, 'feather', '#5fbf3a', 140); burst(e.x, e.y - 14, 6, 'spark', '#ff6f8a', 120);
    } else if (e.type === 'fire') {
      e.dead = true; Sound.play('smash'); burst(e.x, e.y, 10, 'spark', '#ffb03a', 120);
    } else if (e.type === 'rock') {
      e.dead = true; Sound.play('smash'); burst(e.x, e.y, 12, 'chip', '#8d847b', 200);
    }
    e.passed = true;
    if (how === 'power') Sound.play('smash');
    addScore(1000, e.x, (e.y || P.y) - 40);
  }
  function stompBounce() {
    P.vy = Input.jump ? -P.C.jump * 0.95 : -430;
    P.jumping = Input.jump; P.onGround = false;
    P.sx = 1.25; P.sy = 0.8;
  }

  // ---------- player update ----------
  function playerBox() { const s = P.pw.power > 0 ? 1.35 : 1; return { x: P.x - P.w * s / 2 + 2, y: P.y - P.h * s + 2, w: P.w * s - 4, h: P.h * s - 3 }; }

  function updatePlayer(dt) {
    const C = P.C;
    if (P.dead) {
      P.deadT += dt; P.vy += GRAV * 0.8 * dt; P.y += P.vy * dt;
      return;
    }
    for (const k in P.pw) if (P.pw[k] > 0) { P.pw[k] = Math.max(0, P.pw[k] - dt); }
    const fast = P.pw.speed > 0;
    const speed = C.speed * (fast ? 1.55 : 1);
    const dir = (Input.right ? 1 : 0) - (Input.left ? 1 : 0);
    if (dir) {
      const acc = (P.onGround ? 1500 : 1000) * (Math.sign(P.vx) !== dir && P.vx !== 0 ? 1.8 : 1);
      P.vx = approach(P.vx, dir * speed, acc * dt); P.face = dir;
    } else {
      P.vx = approach(P.vx, 0, (P.onGround ? 3200 : 1600) * dt);   // release = stop quickly (no momentum drift)
    }
    if (Input.jumpPressed) P.jumpBuf = 0.13;
    P.jumpBuf -= dt;
    P.coyote = P.onGround ? 0.09 : P.coyote - dt;
    if (P.jumpBuf > 0 && P.coyote > 0) {
      P.vy = -C.jump * (fast ? 1.06 : 1); P.jumpBuf = 0; P.coyote = 0; P.jumping = true; P.onGround = false;
      P.sx = 0.75; P.sy = 1.3; Sound.play('jump');
      burst(P.x, P.y, 5, 'dust', '#e8dcc0', 70);
    }
    if (P.jumping && !Input.jump && P.vy < -260) P.vy = -260;  // short hop when the button is released early
    P.vy = Math.min(P.vy + GRAV * dt, MAX_FALL);
    // ride moving clouds
    if (P.onGround && P.groundS && !P.groundS.off && (P.groundS.dx || P.groundS.dy)) { P.x += P.groundS.dx; P.y += P.groundS.dy; }
    // wind gusts push you back while you're in the air
    P.pushVx = (W.wind.phase === 'gust' && !P.onGround) ? -WIND_PUSH : 0;
    const wasAir = !P.onGround;
    P.prevY = P.y;
    P.prevTop = P.y - P.h;
    moveBody(P, dt);
    if (P.hitHead) bumpBlock(P.hitHead);
    if (P.onGround && P.groundS && P.groundS.style === 'bounce') {
      P.vy = -C.jump * 1.3; P.onGround = false; P.jumping = false; P.coyote = 0;
      P.groundS.squash = 1; P.sx = 0.75; P.sy = 1.3;
      Sound.play('boing');
    } else if (P.onGround && wasAir) {
      P.jumping = false; P.sx = 1.3; P.sy = 0.75;
      burst(P.x, P.y, 4, 'dust', '#e8dcc0', 50);
    }
    P.x = clamp(P.x, 12, W.def.length - 16);
    P.sx += (1 - P.sx) * Math.min(1, dt * 12); P.sy += (1 - P.sy) * Math.min(1, dt * 12);
    P.run += dt * Math.abs(P.vx) * 0.09;
    if (P.invuln > 0) P.invuln -= dt;
    if (P.hurtFace > 0) P.hurtFace -= dt;
    P.blinkT -= dt; if (P.blinkT < 0) { P.blink = 0.12; P.blinkT = rand(2, 4.5); } if (P.blink > 0) P.blink -= dt;
    if (P.onGround && Math.abs(P.vx) > 120) { P.dustT -= dt; if (P.dustT < 0) { P.dustT = 0.12; burst(P.x - P.face * 8, P.y, 1, 'dust', '#e8dcc0', 30); } }
    if (fast) { P.trailT -= dt; if (P.trailT < 0) { P.trailT = 0.045; P.trail.push({ x: P.x, y: P.y, face: P.face, a: 0.5 }); } }
    P.trail.forEach(tr => tr.a -= dt * 2); P.trail = P.trail.filter(tr => tr.a > 0);
    // fell into a gap
    if (P.y > VH + 60) {
      if (G.rescue) { G.rescues++; (G.rescueAt = G.rescueAt || []).push(Math.round(P.x)); let x = P.x; while (surfaceAt(x, true) === null && x < W.def.length) x += 20; P.x = x + 20; P.y = surfaceAt(P.x, true) - 1; P.vy = 0; return; }
      P.stars = 0; die('Fell in a gap!');
    }
    // gap passing bonus
    for (const g of W.gaps) if (!g.passed && P.onGround && P.x > g.x1 + 8 && P.x < g.x1 + 200) { g.passed = true; addScore(500, P.x, P.y - P.h - 14, 'Nice jump!'); }
  }

  function bumpBlock(s) {
    if (s.kind !== 'block') return;
    s.bump = 1; Sound.play('bonk');
    burst(P.x, s.y + s.h, 4, 'dust', '#c9a070', 60);
    for (const e of W.ents) {
      if (e.type === 'bug' && e.state === 'walk' && e.active && Math.abs(e.y - s.y) < 2 && e.x > s.x - 10 && e.x < s.x + s.w + 10 && Math.abs(e.x - P.x) < 50) smash(e, 'bump');
      if (e.type === 'seed' && e.state === 'rest' && e.x > s.x && e.x < s.x + s.w && Math.abs(e.x - P.x) < 40) { e.state = 'fall'; e.vy = -250; }
    }
  }

  // ---------- spawning ----------
  function spawnBird(seed) {
    const tx = P.x + 150 + Math.max(0, P.vx) * 0.4;
    const ground = surfaceAt(tx) || 300;
    W.ents.push({ type: 'bird', x: W.camX + VW + 40, y: 40, targetX: tx, lowY: ground - 17, w: 26, h: 20, seed, state: 'fly', passed: false, t: 0, dir: -1, speed: 215, dropped: false, whistled: false });
  }
  function spawnRock() {
    let tx = P.x + P.vx * 0.75 + rand(-70, 70);
    tx = clamp(tx, W.camX + 30, W.camX + VW - 30);
    const r = rand(13, 18);
    W.ents.push({ type: 'rock', x: tx, y: -40, r, vy: 0, state: 'warn', warn: 0.7, pts: Array.from({ length: 9 }, () => rand(0.8, 1.1)), rot: 0, vr: rand(-4, 4), groundY: surfaceAt(tx), passed: false });
  }
  function spawnPower() {
    const kinds = ['speed', 'power', 'shield'];
    const kind = kinds[Math.floor(Math.random() * 3)];
    const fromRight = Math.random() < 0.7;
    const x = fromRight ? W.camX + VW + 30 : W.camX - 30;
    W.ents.push({ type: 'orb', kind, x, y: 200, vx: fromRight ? -rand(70, 100) : rand(150, 190), t: 0, baseOff: rand(75, 95) });
  }

  // ---------- entity update ----------
  function updateEnts(dt) {
    const pb = playerBox();
    const pCenterX = P.x;
    for (const e of W.ents) {
      e.t = (e.t || 0) + dt;
      switch (e.type) {
        case 'bug': updateBug(e, dt, pb); break;
        case 'bird': updateBird(e, dt, pb); break;
        case 'snake': updateSnake(e, dt, pb); break;
        case 'fire': updateFire(e, dt, pb); break;
        case 'rock': updateRock(e, dt, pb); break;
        case 'seed': updateSeed(e, dt, pb); break;
        case 'orb': updateOrb(e, dt, pb); break;
        case 'flytrap': updateFlytrap(e, dt, pb); break;
        case 'vine': updateVine(e, dt, pb); break;
        case 'bolt': updateBolt(e, dt, pb); break;
      }
      // passing bonus for live enemies
      if (!e.passed && !P.dead && (e.type === 'bug' && e.state === 'walk' && e.active || e.type === 'bird' && e.state === 'fly' || e.type === 'snake' && e.state === 'alive' || e.type === 'flytrap' && e.state === 'alive')) {
        if (pCenterX - e.x > e.w / 2 + P.w / 2 + 6 && pCenterX - e.x < 120) { e.passed = true; addScore(500, e.x, e.y - 34); }
      }
    }
    W.ents = W.ents.filter(e => !e.dead);
  }

  function stompCheck(e, pb, top) {
    // returns 'stomp' | 'bump' | 'hit' | null for a contact between the player and an enemy box
    const ex = e.x - e.w / 2, ey = top, ew = e.w, eh = e.h;
    if (!overlaps(pb.x, pb.y, pb.w, pb.h, ex, ey, ew, eh)) return null;
    if (P.pw.power > 0) return 'power';
    if (P.vy > 0 && P.prevY <= ey + 10) return 'stomp';
    if (P.vy < 0 && P.prevTop >= ey + eh - 8) return 'bump';
    return 'hit';
  }
  function contact(e, res) {
    if (!res || P.dead) return;
    if (res === 'power') smash(e, 'power');
    else if (res === 'stomp') { smash(e, 'stomp'); stompBounce(); }
    else if (res === 'bump') { smash(e, 'bump'); P.vy = 60; }
    else hurt(e);
  }

  function updateBug(e, dt, pb) {
    if (e.state === 'walk') {
      if (!e.active) { if (e.x < W.camX + VW + 60) e.active = true; else return; }
      e.vx = e.dir * e.speed;
      e.vy = Math.min(e.vy + GRAV * dt, MAX_FALL);
      moveBody(e, dt);
      if (e.hitWall) e.dir *= -1;
      if (e.y > VH + 80) { e.dead = true; return; }
      if (e.x < W.camX - 200) { e.dead = true; return; }
      contact(e, stompCheck(e, pb, e.y - e.h));
    } else if (e.state === 'flat') {
      e.flatT += dt;
      if (e.flatT > 0.3) {
        // squashed potatoes skid off the screen
        if (!e.vx) e.vx = (e.x >= P.x ? 1 : -1) * 330;
        e.vy = Math.min(e.vy + GRAV * dt, MAX_FALL);
        e.x += e.vx * dt; e.y += e.vy * dt;
        const s = surfaceAt(e.x);
        if (s !== null && e.y >= s && e.y - s < 30) { e.y = s; e.vy = 0; }
        if (e.x < W.camX - 80 || e.x > W.camX + VW + 80 || e.y > VH + 80) e.dead = true;
      }
    } else if (e.state === 'bumped') {
      e.vy += GRAV * dt; e.x += e.vx * dt; e.y += e.vy * dt;
      if (e.y > VH + 80) e.dead = true;
    }
  }

  function updateBird(e, dt, pb) {
    if (e.state === 'dead') { e.dead = true; return; }
    e.x -= e.speed * dt;
    const d = (e.x - e.targetX) / 300;
    const k = Math.min(1, d * d);
    const highY = d > 0 ? 40 : -60;
    e.y = e.lowY + (highY - e.lowY) * k;
    if (!e.whistled && e.x < W.camX + VW) { e.whistled = true; Sound.play('whistle'); }
    if (e.seed && !e.dropped && e.x < e.targetX + 70) {
      e.dropped = true; e.seed = false;
      const s = makeSeed(e.x, e.y + 16); s.vx = -60; s.vy = 0; W.ents.push(s);
    }
    if (e.x < W.camX - 80 || e.y < -80) { e.dead = true; return; }
    contact(e, stompCheck(e, pb, e.y - e.h / 2));
  }

  function updateSnake(e, dt, pb) {
    if (e.state === 'dead') { e.dead = true; return; }
    const inRange = P.x < e.x - 10 && e.x - P.x < 500 && !P.dead;
    if (e.windup > 0) {
      e.windup -= dt;
      const target = e.high ? -58 : -12;
      e.headY += (target - e.headY) * Math.min(1, dt * 14);
      e.open = Math.min(1, e.open + dt * 4);
      if (e.windup <= 0) {
        const fy = e.y + (e.high ? -58 : -12);
        W.ents.push({ type: 'fire', x: e.x - 26, y: fy, vx: -235, startX: e.x - 26, t: 0, passed: false });
        Sound.play('fire');
        e.cool = 1.55; e.high = !e.high;
      }
    } else {
      e.open = Math.max(0, e.open - dt * 3);
      e.headY += (-40 + Math.sin(e.t * 2) * 3 - e.headY) * Math.min(1, dt * 5);
      if (inRange) { e.cool -= dt; if (e.cool <= 0) e.windup = 0.45; }
    }
    contact(e, stompCheck(e, pb, e.y - e.h));
  }

  function updateFire(e, dt, pb) {
    e.x += e.vx * dt;
    if (W.parts.length < 280 && Math.random() < 0.5) W.parts.push({ x: e.x + 14, y: e.y + rand(-4, 4), vx: rand(20, 60), vy: rand(-30, 10), life: 0, max: 0.3, kind: 'spark', col: '#ffb03a', size: rand(1.5, 3), rot: 0, vr: 0 });
    if (e.startX - e.x > 540 || e.x < W.camX - 60) { e.dead = true; return; }
    for (const s of W.solids) if (e.x > s.x && e.x < s.x + s.w && e.y > s.y && e.y < s.y + s.h) { e.dead = true; burst(e.x, e.y, 6, 'spark', '#ffb03a', 80); return; }
    if (P.dead) return;
    const r = 7;
    if (overlaps(pb.x, pb.y, pb.w, pb.h, e.x - r, e.y - r, r * 2 + 8, r * 2)) {
      if (P.pw.power > 0) smash(e, 'power'); else { hurt(e); e.dead = true; }
      return;
    }
    if (!e.passed && e.x < P.x - 24) { e.passed = true; addScore(500, P.x, P.y - P.h - 14, 'Dodged!'); }
  }

  function updateRock(e, dt, pb) {
    if (e.state === 'warn') {
      e.warn -= dt;
      if (e.warn <= 0) { e.state = 'fall'; e.vy = 200; }
      return;
    }
    e.vy += 1500 * dt; e.y += e.vy * dt; e.rot += e.vr * dt;
    if (!P.dead) {
      const cx = clamp(e.x, pb.x, pb.x + pb.w), cy = clamp(e.y, pb.y, pb.y + pb.h);
      if ((cx - e.x) ** 2 + (cy - e.y) ** 2 < e.r * e.r * 0.8) {
        if (P.pw.power > 0) { smash(e, 'power'); return; }
        hurt(e); e.hitPlayer = true;
      }
    }
    if (e.groundY !== null && e.y + e.r * 0.8 >= e.groundY) {
      e.dead = true;
      Sound.play('thud'); W.shake = Math.max(W.shake, 4);
      burst(e.x, e.groundY - 4, 12, 'chip', '#8d847b', 180);
      burst(e.x, e.groundY, 6, 'dust', '#e8dcc0', 80);
      if (!e.hitPlayer && !P.dead && Math.abs(e.x - P.x) < 100) addScore(500, P.x, P.y - P.h - 14, 'Dodged!');
    } else if (e.y > VH + 60) e.dead = true;
  }

  function updateSeed(e, dt, pb) {
    if (e.state === 'fall') {
      e.vy = Math.min(e.vy + 1000 * dt, 600); e.x += e.vx * dt; e.y += e.vy * dt;
      e.vx *= 0.99;
      for (const s of W.solids) {
        if (e.x > s.x && e.x < s.x + s.w && e.y + 10 > s.y && e.y + 10 - e.vy * dt <= s.y + 1 && e.vy > 0) {
          e.y = s.y - 16;
          if (e.vy > 200) { e.vy = -e.vy * 0.35; } else { e.vy = 0; e.vx = 0; e.state = 'rest'; }
        }
      }
      if (e.y > VH + 50) { e.dead = true; return; }
    }
    if (P.dead) return;
    const dx = e.x - P.x, dy = e.y - (P.y - P.h / 2);
    if (Math.abs(dx) < P.w / 2 + 10 && Math.abs(dy) < P.h / 2 + 12) {
      e.dead = true; W.seeds++;
      Sound.play('seed');
      burst(e.x, e.y, 10, 'spark', '#fff3a0', 120);
      pop(e.x, e.y - 16, 'Seed ' + W.seeds + '/' + W.def.seedsNeeded, '#fff3a0', 13);
      if (W.seeds === W.def.seedsNeeded) {
        banner('The tree is growing!', 'Run to the end to reach it', 2.6);
        Sound.play('grow');
      }
    }
  }

  function updateOrb(e, dt, pb) {
    e.x += e.vx * dt;
    const sY = surfaceAt(e.x);
    const base = (sY === null ? 300 : sY) - e.baseOff;
    e.y += ((base + Math.sin(e.t * 3) * 20) - e.y) * Math.min(1, dt * 4);
    if (e.t < 0.05) e.y = base;
    if ((e.vx < 0 && e.x < W.camX - 60) || (e.vx > 0 && e.x > W.camX + VW + 60)) { e.dead = true; return; }
    if (P.dead) return;
    const cx = clamp(e.x, pb.x, pb.x + pb.w), cy = clamp(e.y, pb.y, pb.y + pb.h);
    if ((cx - e.x) ** 2 + (cy - e.y) ** 2 < 17 * 17) {
      e.dead = true;
      P.pw[e.kind] = POWER_TIME;
      Sound.play('powerup');
      burst(e.x, e.y, 16, 'spark', D.POWER_COLORS[e.kind][0], 180);
      const names = { speed: 'SPEED BOOST!', power: 'POWER UP!', shield: 'SHIELD!' };
      pop(P.x, P.y - P.h - 24, names[e.kind], D.POWER_COLORS[e.kind][e.kind === 'shield' ? 1 : 0], 16);
    }
  }


  // ---------- level 2/3 hazards ----------
  const TRAP_CYCLE = 3.6;
  function updateFlytrap(e, dt, pb) {
    const tt = (W.t + e.phase) % TRAP_CYCLE;
    // 0-1.8 closed, 1.4-1.8 warning wiggle, 1.8-2.05 opening, 2.05-3.35 open, 3.35-3.6 closing
    e.open = tt < 1.8 ? 0 : tt < 2.05 ? (tt - 1.8) / 0.25 : tt < 3.35 ? 1 : 1 - (tt - 3.35) / 0.25;
    e.warn = tt > 1.4 && tt < 1.8;
    if (e.open > 0.95 && !e.chomped) { e.chomped = true; if (Math.abs(e.x - P.x) < VW * 0.6) Sound.play('chomp'); }
    if (e.open < 0.05) e.chomped = false;
    e.h = 26 + e.open * 26;
    const res = stompCheck(e, pb, e.y - e.h);
    if (!res || P.dead) return;
    if (res === 'power') smash(e, 'power');
    else if (res === 'stomp' && e.open < 0.3) { smash(e, 'stomp'); stompBounce(); }
    else { hurt(e); if (res === 'stomp') { P.vy = -380; P.onGround = false; } }
  }
  const VINE_CYCLE = 3.6, VINE_H = 100, VINE_STAGGER = 0.12;
  function vineHeight(e, i, time) {
    const tt = ((time + e.phase - i * VINE_STAGGER) % VINE_CYCLE + VINE_CYCLE) % VINE_CYCLE;
    // 0-1.5 up, 1.5-1.85 lowering, 1.85-3.25 down (safe), 3.25-3.6 rising
    if (tt < 1.5) return VINE_H;
    if (tt < 1.85) return VINE_H * (1 - (tt - 1.5) / 0.35);
    if (tt < 3.25) return 0;
    return VINE_H * (tt - 3.25) / 0.35;
  }
  function updateVine(e, dt, pb) {
    for (let i = 0; i < e.count; i++) {
      const h = vineHeight(e, i, W.t), vx = e.x + i * e.gap;
      if (h > 2 && e.hs[i] <= 2 && Math.abs(vx - P.x) < VW) burst(vx, e.y, 3, 'chip', '#6a4024', 90);
      e.hs[i] = h;
      if (h > 10 && !P.dead && P.pw.power <= 0 && overlaps(pb.x, pb.y, pb.w, pb.h, vx - 6, e.y - h, 12, h)) hurt({ x: vx, type: 'vine' });
    }
    const end = e.x + (e.count - 1) * e.gap;
    if (!e.passed && !P.dead && P.x > end + 20 && P.x < end + 150) { e.passed = true; addScore(500, P.x, P.y - P.h - 14, 'Thorns passed!'); }
  }
  function spawnBolt() {
    let tx = P.x + P.vx * 0.6 + rand(-50, 50);
    tx = clamp(tx, W.camX + 30, W.camX + VW - 30);
    const gy = surfaceAt(tx);
    W.ents.push({ type: 'bolt', x: tx, groundY: gy === null ? VH + 40 : gy, state: 'warn', warn: 0.95, strike: 0, hit: false, t: 0 });
    Sound.play('crackle');
  }
  function updateBolt(e, dt, pb) {
    if (e.state === 'warn') {
      e.warn -= dt;
      if (e.warn <= 0) { e.state = 'strike'; e.strike = 0; Sound.play('zap'); W.flash = 0.35; W.shake = Math.max(W.shake, 5); burst(e.x, e.groundY, 12, 'spark', '#dff0ff', 200); }
      return;
    }
    e.strike += dt;
    if (e.strike < 0.18 && !P.dead && !e.hit && Math.abs(P.x - e.x) < P.w / 2 + 12) {
      e.hit = true;
      if (P.pw.power <= 0) hurt(e);
    }
    if (e.strike > 0.35) {
      e.dead = true;
      if (!e.hit && !P.dead && Math.abs(e.x - P.x) < 110) addScore(500, P.x, P.y - P.h - 14, 'Dodged!');
    }
  }
  function updateSolids(dt) {
    for (const s of W.solids) {
      if (s.kind !== 'cloud' || s.style === 'bank' || s.style === 'static') continue;
      if (s.squash > 0) s.squash = Math.max(0, s.squash - dt * 4);
      if (s.style === 'drift') {
        const k = Math.sin(W.t * Math.PI * 2 / s.period);
        const nx = s.bx + s.ax * k, ny = s.by + s.ay * k;
        s.dx = nx - s.x; s.dy = ny - s.y; s.x = nx; s.y = ny;
      } else if (s.style === 'fade') {
        if (s.off) {
          s.respawnT -= dt;
          if (s.respawnT <= 0 && !(P && overlaps(P.x - P.w / 2, P.y - P.h, P.w, P.h, s.x, s.y, s.w, s.h))) { s.off = false; s.alpha = 1; s.standT = 0; }
        } else {
          if (s.standT === 0 && P.onGround && P.groundS === s) s.standT = 0.0001;   // stepped on: starts fading
          if (s.standT > 0) {
            s.standT += dt;
            if (s.standT > 0.5) s.alpha -= dt * 2.4;
            if (s.alpha <= 0) { s.alpha = 0; s.off = true; s.respawnT = 2.5; Sound.play('poof'); }
          }
        }
      }
    }
  }
  function updateWind(dt) {
    const wd = W.wind;
    const inZone = W.def.wind.some(([a, b]) => P.x > a && P.x < b);
    if (!inZone) { wd.phase = 'calm'; wd.t = Math.min(wd.t, 1.5); return; }
    wd.t -= dt;
    if (wd.t <= 0) {
      if (wd.phase === 'calm') { wd.phase = 'warn'; wd.t = 1.0; }
      else if (wd.phase === 'warn') { wd.phase = 'gust'; wd.t = 2.4; Sound.play('wind'); }
      else { wd.phase = 'calm'; wd.t = 3.0; }
    }
    const rate = wd.phase === 'gust' ? 40 : wd.phase === 'warn' ? 8 : 0;
    if (rate && Math.random() < rate * dt && W.streaks.length < 60) W.streaks.push({ x: VW + rand(0, 60), y: rand(30, VH - 40), len: rand(30, 90), v: rand(500, 800), a: wd.phase === 'gust' ? 0.7 : 0.35 });
  }

  // ---------- world update ----------
  function updateWorld(dt) {
    W.t += dt;
    if (G.state === 'play') {
      W.time -= dt;
      if (W.time <= 0) { W.time = 0; timeUp(); return; }
    }
    updateSolids(dt);
    updateWind(dt);
    for (const st of W.streaks) st.x -= st.v * dt;
    W.streaks = W.streaks.filter(st => st.x + st.len > -20);
    if (W.flash > 0) W.flash = Math.max(0, W.flash - dt * 2);
    updatePlayer(dt);
    // lightning zones
    if (W.def.lightning.some(([a, b]) => P.x > a && P.x < b) && !P.dead) { W.boltT -= dt; if (W.boltT <= 0) { spawnBolt(); W.boltT = rand(1.6, 2.8); } }
    // bird triggers
    for (const b of W.birdTriggers) if (!b.done && P.x >= b.x) { b.done = true; spawnBird(b.seed); }
    // rock zones
    const inRockZone = W.def.rocks.some(([a, b]) => P.x > a && P.x < b);
    if (inRockZone && !P.dead) { W.rockT -= dt; if (W.rockT <= 0) { spawnRock(); W.rockT = rand(1.1, 2.2); } }
    // power-up orbs fly in at random
    W.powerT -= dt;
    if (W.powerT <= 0) {
      if (!W.ents.some(e => e.type === 'orb')) spawnPower();
      W.powerT = rand(W.def.power.min, W.def.power.max);
    }
    updateEnts(dt);
    // tree
    const T = W.tree, need = W.def.seedsNeeded;
    if (W.seeds >= need) T.grow = Math.min(1, T.grow + dt / 2.2);
    if (!P.dead && !W.won && Math.abs(P.x - T.x) < 34) {
      if (T.grow >= 1) win();
      else if (W.seeds < need && W.needMsgT <= 0) {
        const left = need - W.seeds;
        banner('Need ' + left + ' more seed' + (left > 1 ? 's' : '') + '!', 'Go back and find them to grow the tree', 2.2);
        Sound.play('deny');
        W.needMsgT = 4;
      }
    }
    if (W.needMsgT > 0) W.needMsgT -= dt;
    for (const s of W.solids) if (s.bump > 0) s.bump = Math.max(0, s.bump - dt * 5);
    // particles
    for (const p of W.parts) {
      p.life += dt;
      if (p.kind === 'feather') { p.vx *= 0.96; p.vy = p.vy * 0.95 + 40 * dt * 20 * 0.05; p.x += Math.sin(p.life * 6 + p.rot) * 0.6; }
      else if (p.kind === 'confetti') { p.vy += 300 * dt; p.vx *= 0.98; }
      else if (p.kind === 'dust') { p.vx *= 0.9; p.vy *= 0.9; p.vy -= 20 * dt; }
      else { p.vy += 600 * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    W.parts = W.parts.filter(p => p.life < p.max);
    for (const p of W.pops) { p.t += dt; p.y -= 30 * dt; }
    W.pops = W.pops.filter(p => p.t < 1.1);
    if (W.banner) { W.banner.t += dt; if (W.banner.t > W.banner.dur) W.banner = null; }
    if (W.shake > 0) W.shake = Math.max(0, W.shake - dt * 25);
    // camera
    const target = clamp(P.x - VW * 0.38, 0, Math.max(0, W.def.length - VW));
    W.camX += (target - W.camX) * Math.min(1, dt * 7);
  }

  function win() {
    W.won = true;
    Sound.play('complete');
    P.vx = 0; P.vy = -400; P.onGround = false;
    for (let i = 0; i < 60; i++) W.parts.push({ x: W.tree.x + rand(-80, 80), y: rand(40, 140), vx: rand(-60, 60), vy: rand(-120, 20), life: 0, max: rand(1.5, 2.5), kind: 'confetti', col: ['#ff5fa0', '#ffe14a', '#8af05a', '#5ec8ff', '#b65cff'][i % 5], size: rand(3, 5), rot: rand(0, 6), vr: rand(-10, 10) });
    const timeLeft = Math.floor(W.time);
    const levelPts = G.score - G.levelStartScore;
    const bonus = timeLeft * 100;
    G.score += bonus;
    const newHigh = G.score > save.high;
    if (newHigh) save.high = G.score;
    const id = W.def.id;
    save.best[id] = Math.max(save.best[id] || 0, G.score - G.levelStartScore);
    save.unlocked = Math.max(save.unlocked, Math.min(window.LEVELS.length, G.levelIdx + 2));
    persist();
    G.result = { levelPts, timeLeft, bonus, total: G.score, newHigh, seeds: W.seeds };
    setState('winning');
  }
  function timeUp() {
    Sound.play('gameover');
    G.result = { reason: "TIME'S UP!" };
    if (G.score > save.high) { save.high = G.score; persist(); }
    setState('gameover');
  }

  // ---------- UI (immediate mode buttons) ----------
  let uiBtns = [], prevBtns = [];
  function button(id, x, y, w, h, label, opt) {
    opt = opt || {};
    const pressed = false;
    ctx.save();
    const col = opt.disabled ? ['#9aa4b4', '#6a7484'] : opt.col || ['#ffde3a', '#ff9a1f'];
    ctx.fillStyle = 'rgba(20,30,60,.35)'; D.rr(ctx, x, y + 4, w, h, h / 2); ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
    ctx.fillStyle = g; D.rr(ctx, x, y + (pressed ? 2 : 0), w, h, h / 2); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#1b2a4a'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; D.rr(ctx, x + 8, y + 4, w - 16, h * 0.3, h * 0.15); ctx.fill();
    D.text(ctx, label, x + w / 2, y + h / 2 + 1, opt.size || 16, '#fff', { sw: 4 });
    ctx.restore();
    uiBtns.push({ id, x, y, w, h, primary: !!opt.primary, disabled: !!opt.disabled });
  }
  function iconButton(id, x, y, r, drawIcon) {
    ctx.fillStyle = 'rgba(20,30,60,.45)'; D.circ(ctx, x, y, r); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.stroke();
    drawIcon(x, y, r);
    uiBtns.push({ id, x: x - r - 4, y: y - r - 4, w: r * 2 + 8, h: r * 2 + 8 });
  }
  function uiAction() {
    for (const tp of Input.taps) {
      for (const b of prevBtns) if (!b.disabled && tp.x >= b.x && tp.x <= b.x + b.w && tp.y >= b.y && tp.y <= b.y + b.h) { return b.id; }
    }
    for (const k of Input.keyTaps) {
      if (k === 'enter') { const p = prevBtns.find(b => b.primary && !b.disabled); if (p) return p.id; }
      if (k === 'mute') return 'mute';
      if (k === 'pause') return 'pause';
      if (k === 'back') return 'back';
      if (k === 'left') return 'kleft';
      if (k === 'right') return 'kright';
    }
    return null;
  }
  function anyTap() { return Input.taps.length > 0 || Input.keyTaps.includes('enter'); }

  function tryFullscreen() {
    const standalone = window.matchMedia && (window.matchMedia('(display-mode: fullscreen)').matches || window.matchMedia('(display-mode: standalone)').matches);
    if (!Input.touchUsed || standalone || document.fullscreenElement) return;
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return;
    try {
      const p = req.call(el, { navigationUI: 'hide' });
      if (p && p.then) p.then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }).catch(() => {});
    } catch (e) {}
  }

  // ---------- main update ----------
  function update(dt) {
    G.t += dt; G.stateT += dt;
    Input.update();
    // Touch controls positions (logical units)
    Input.buttons = [
      { id: 'left', x: 50 + SAFE_L, y: VH - 52, r: 34 },
      { id: 'right', x: 132 + SAFE_L, y: VH - 52, r: 34 },
      { id: 'jump', x: VW - 66 - SAFE_R, y: VH - 58, r: 42 }
    ];
    const portrait = Input.touchUsed && window.innerHeight > window.innerWidth;
    const act = uiAction();
    if (act === 'mute') { Sound.toggleMute(); }
    switch (G.state) {
      case 'title':
        Sound.playMusic('title');
        if (act === 'play' || (act === null && anyTap() && G.stateT > 0.3 && Input.taps.every(tp => !(tp.x > VW - 60 && tp.y < 60)))) {
          Sound.play('click'); tryFullscreen(); setState('select');
        }
        break;
      case 'select':
        if (act && act.startsWith('char_')) { G.charKey = act.slice(5); Sound.play('click'); save.char = G.charKey; persist(); }
        if (act === 'kleft' || act === 'kright') { const i = CHAR_ORDER.indexOf(G.charKey); G.charKey = CHAR_ORDER[(i + (act === 'kleft' ? 2 : 1)) % 3]; save.char = G.charKey; persist(); Sound.play('click'); }
        if (act === 'next') { Sound.play('click'); setState('levels'); }
        if (act === 'back') { Sound.play('click'); setState('title'); }
        break;
      case 'levels':
        if (act && act.startsWith('level_')) {
          const i = +act.slice(6);
          const L = window.LEVELS[i];
          if (L.comingSoon) { Sound.play('deny'); }
          else { Sound.play('click'); G.score = 0; G.levelStartScore = 0; startLevel(i, true); }
        }
        if (act === 'back') { Sound.play('click'); setState('select'); }
        break;
      case 'intro':
        updateWorld(dt * 0);  // world frozen, just animate camera
        if (G.stateT > 2.0 || (G.stateT > 0.5 && anyTap() && act === null && Input.taps.every(tp => !isControlTap(tp)))) setState('play');
        if (act === 'pause') setState('paused');
        break;
      case 'play':
        if (act === 'pause' || portrait || document.hidden) { setState('paused'); Sound.play('click'); break; }
        stepWorld(dt);
        break;
      case 'paused':
        if (act === 'resume' || (act === 'pause' && G.stateT > 0.1)) { if (!portrait) { Sound.play('click'); setState('play'); } }
        if (act === 'restart') { Sound.play('click'); startLevel(G.levelIdx, true); }
        if (act === 'quit') { Sound.play('click'); setState('title'); }
        break;
      case 'dying':
        stepWorld(dt);
        if (G.stateT > 1.8) {
          G.lives--;
          if (G.lives <= 0) { Sound.play('gameover'); G.result = { reason: 'GAME OVER' }; if (G.score > save.high) { save.high = G.score; persist(); } setState('gameover'); }
          else { setState('lifelost'); }
        }
        break;
      case 'lifelost':
        if (G.stateT > 2.2 || (G.stateT > 0.6 && anyTap())) {
          const lives = G.lives; startLevel(G.levelIdx, false); G.lives = lives;
        }
        break;
      case 'winning':
        stepWorld(dt);
        if (P.onGround && P.vy === 0 && G.stateT > 0.6 && G.stateT < 1.6) { P.vy = -350; P.onGround = false; }
        if (G.stateT > 2.6) setState('complete');
        break;
      case 'complete':
        if (W) { W.t += dt; }
        if (act === 'next') { Sound.play('click'); const n = G.levelIdx + 1; G.levelStartScore = G.score; startLevel(n, true); }
        if (act === 'finish') { Sound.play('complete'); save.beaten = true; persist(); setState('victory'); Sound.playMusic('title'); }
        if (act === 'replay') { Sound.play('click'); G.score = G.levelStartScore; startLevel(G.levelIdx, true); }
        if (act === 'menu') { Sound.play('click'); setState('title'); }
        break;
      case 'victory':
        if (Math.random() < 0.4) victoryConfetti();
        for (const c of G.confetti) { c.vy += 200 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt; }
        G.confetti = G.confetti.filter(c => c.y < VH + 20);
        if (act === 'again') { Sound.play('click'); setState('levels'); }
        if (act === 'menu') { Sound.play('click'); setState('title'); }
        break;
      case 'gameover':
        if (act === 'retry') { Sound.play('click'); startLevel(G.levelIdx, true); }
        if (act === 'menu') { Sound.play('click'); setState('title'); }
        break;
    }
    Input.clearTaps();
  }
  function isControlTap(tp) { return Input.zoneAt(tp.x, tp.y) !== null; }
  function stepWorld(dt) {
    // sub-step for stable collisions
    const n = dt > 1 / 70 ? 2 : 1;
    for (let i = 0; i < n; i++) updateWorld(dt / n);
  }

  // ---------- rendering ----------
  function render() {
    uiBtns = [];
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.imageSmoothingEnabled = true;
    switch (G.state) {
      case 'title': renderTitle(); break;
      case 'select': renderSelect(); break;
      case 'levels': renderLevels(); break;
      case 'victory': renderVictory(); break;
      default: renderWorld(); renderHUD(); renderOverlay(); break;
    }
    prevBtns = uiBtns;
  }

  function menuBackground(scroll) {
    window.THEMES.hills.background(ctx, scroll, VW, VH, G.t);
    // grassy floor
    const g = ctx.createLinearGradient(0, 300, 0, VH); g.addColorStop(0, '#b07a44'); g.addColorStop(1, '#7a4a22');
    ctx.fillStyle = g; ctx.fillRect(0, 312, VW, VH - 312);
    const gg = ctx.createLinearGradient(0, 300, 0, 316); gg.addColorStop(0, '#7ee05a'); gg.addColorStop(1, '#3fae3a');
    ctx.fillStyle = gg; ctx.fillRect(0, 300, VW, 14);
    ctx.fillStyle = '#3fae3a';
    for (let x = -(scroll % 14); x < VW + 14; x += 14) { D.circ(ctx, x, 314, 6); ctx.fill(); }
  }
  function muteIcon(x, y) {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(x - 8, y - 4); ctx.lineTo(x - 4, y - 4); ctx.lineTo(x + 1, y - 9); ctx.lineTo(x + 1, y + 9); ctx.lineTo(x - 4, y + 4); ctx.lineTo(x - 8, y + 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    if (Sound.muted) { ctx.beginPath(); ctx.moveTo(x + 4, y - 5); ctx.lineTo(x + 10, y + 5); ctx.moveTo(x + 10, y - 5); ctx.lineTo(x + 4, y + 5); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(x + 2, y, 6, -0.8, 0.8); ctx.stroke(); ctx.beginPath(); ctx.arc(x + 2, y, 10, -0.8, 0.8); ctx.stroke(); }
  }
  function heroPose(kind, x, y, t, o) {
    D.hero(ctx, kind, x, y, Object.assign({ face: 1, sx: 1, sy: 1, run: t * 14, speed: 1, ground: true, t, blink: (t % 3.3) < 0.12 }, o || {}));
  }

  function renderTitle() {
    const t = G.t;
    menuBackground(t * 60);
    D.logo(ctx, VW / 2, 92, Math.min(1.5, VW / 520), t);
    D.text(ctx, 'A Veggie Adventure', VW / 2, 146, 15, '#fff', { sw: 4 });
    // three heroes running in place
    CHAR_ORDER.forEach((k, i) => {
      const x = VW / 2 - 90 + i * 90;
      const hop = Math.abs(Math.sin(t * 5 + i)) * 10;
      heroPose(k, x, 300 - hop, t + i, { scale: 1.5, ground: hop < 2, run: t * 16 + i });
    });
    const pulse = 1 + Math.sin(t * 5) * 0.06;
    ctx.save(); ctx.translate(VW / 2, 200); ctx.scale(pulse, pulse);
    D.text(ctx, Input.touchUsed ? 'TAP TO PLAY' : 'CLICK OR PRESS ENTER', 0, 0, 24, '#ffde3a', { sw: 6 });
    ctx.restore();
    uiBtns.push({ id: 'play', x: VW / 2 - 140, y: 180, w: 280, h: 44, primary: true });
    if (save.high > 0) D.text(ctx, 'HIGH SCORE ' + save.high, VW / 2, 338, 14, '#fff', { sw: 4 });
    iconButton('mute', VW - 30 - SAFE_R, 28, 17, muteIcon);
  }

  function renderSelect() {
    const t = G.t;
    menuBackground(t * 20);
    ctx.fillStyle = 'rgba(20,40,80,.25)'; ctx.fillRect(0, 0, VW, VH);
    D.text(ctx, 'CHOOSE YOUR HERO', VW / 2, 32, 26, '#ffde3a', { sw: 6 });
    const cw = Math.min(170, (VW - 80) / 3), ch = 230, gap = 14;
    const x0 = VW / 2 - (cw * 3 + gap * 2) / 2;
    CHAR_ORDER.forEach((k, i) => {
      const C = CHARACTERS[k], x = x0 + i * (cw + gap), y = 58, sel = G.charKey === k;
      ctx.fillStyle = 'rgba(20,30,60,.35)'; D.rr(ctx, x, y + 5, cw, ch, 18); ctx.fill();
      const g = ctx.createLinearGradient(0, y, 0, y + ch);
      g.addColorStop(0, sel ? '#fff7c8' : '#ffffff'); g.addColorStop(1, sel ? '#ffd86a' : '#d8ecff');
      ctx.fillStyle = g; D.rr(ctx, x, y, cw, ch, 18); ctx.fill();
      ctx.lineWidth = sel ? 5 : 3; ctx.strokeStyle = sel ? '#ff8a00' : '#1b2a4a'; ctx.stroke();
      const hop = sel ? Math.abs(Math.sin(t * 6)) * 12 : 0;
      ctx.fillStyle = 'rgba(0,0,0,.15)'; D.ell(ctx, x + cw / 2, y + 112, 26, 5); ctx.fill();
      heroPose(k, x + cw / 2, y + 112 - hop, t + i, { scale: 1.9, ground: !sel || hop < 2, run: sel ? t * 16 : 0, speed: sel ? 1 : 0 });
      D.text(ctx, C.name.toUpperCase(), x + cw / 2, y + 134, 19, '#fff', { sw: 5 });
      D.text(ctx, C.desc, x + cw / 2, y + 156, 11, '#1b2a4a', { stroke: false });
      ['SPEED', 'JUMP', 'TOUGH'].forEach((lab, j) => {
        const by = y + 174 + j * 17;
        D.text(ctx, lab, x + 12, by, 10, '#1b2a4a', { stroke: false, align: 'left' });
        for (let s = 0; s < 3; s++) {
          const filled = C.stats[j] > s;
          ctx.fillStyle = filled ? ['#ff5fa0', '#ffb21f', '#5fbf3a'][j] : 'rgba(27,42,74,.15)';
          D.rr(ctx, x + 56 + s * ((cw - 70) / 3), by - 5, (cw - 70) / 3 - 4, 10, 4); ctx.fill();
        }
      });
      uiBtns.push({ id: 'char_' + k, x, y, w: cw, h: ch });
    });
    button('back', 14 + SAFE_L, VH - 50, 90, 38, '◀ BACK', { col: ['#9fd2ff', '#4a9bf0'], size: 14 });
    button('next', VW - 154 - SAFE_R, VH - 52, 140, 42, 'NEXT ▶', { primary: true, size: 18 });
    iconButton('mute', VW - 30 - SAFE_R, 28, 17, muteIcon);
  }

  function renderLevels() {
    const t = G.t;
    menuBackground(t * 20);
    ctx.fillStyle = 'rgba(20,40,80,.25)'; ctx.fillRect(0, 0, VW, VH);
    D.text(ctx, 'PICK A LEVEL', VW / 2, 32, 26, '#ffde3a', { sw: 6 });
    const cw = Math.min(180, (VW - 80) / 3), ch = 210, gap = 14;
    const x0 = VW / 2 - (cw * 3 + gap * 2) / 2;
    window.LEVELS.forEach((L, i) => {
      const x = x0 + i * (cw + gap), y = 60;
      const locked = !!L.comingSoon;
      const th = window.THEMES[L.theme];
      ctx.fillStyle = 'rgba(20,30,60,.35)'; D.rr(ctx, x, y + 5, cw, ch, 18); ctx.fill();
      const g = ctx.createLinearGradient(0, y, 0, y + ch); g.addColorStop(0, th.card[0]); g.addColorStop(1, th.card[1]);
      ctx.fillStyle = g; D.rr(ctx, x, y, cw, ch, 18); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#1b2a4a'; ctx.stroke();
      D.text(ctx, 'LEVEL ' + L.id, x + cw / 2, y + 26, 20, '#fff', { sw: 5 });
      D.text(ctx, L.name, x + cw / 2, y + 52, 15, '#ffde3a', { sw: 4 });
      D.text(ctx, L.subtitle, x + cw / 2, y + 72, 11, '#fff', { sw: 3 });
      D.seed(ctx, x + cw / 2 - 26, y + 110, t, 1.3);
      D.text(ctx, '× ' + L.seedsNeeded, x + cw / 2 + 8, y + 110, 18, '#fff', { sw: 4 });
      if (locked) {
        ctx.fillStyle = 'rgba(20,30,60,.55)'; D.rr(ctx, x, y, cw, ch, 18); ctx.fill();
        // padlock
        const lx = x + cw / 2, ly = y + 150;
        ctx.strokeStyle = '#ffde3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(lx, ly - 8, 9, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = '#ffde3a'; D.rr(ctx, lx - 13, ly - 8, 26, 20, 4); ctx.fill();
        D.text(ctx, L.comingSoon ? 'COMING SOON' : 'LOCKED', x + cw / 2, y + 186, 14, '#fff', { sw: 4 });
      } else {
        const best = save.best[L.id];
        D.text(ctx, best ? 'BEST ' + best : 'NEW!', x + cw / 2, y + 146, 13, '#fff', { sw: 4 });
        button('level_' + i, x + 18, y + 162, cw - 36, 36, 'PLAY', { primary: i === 0, size: 16, col: [['#ffde3a', '#ff9a1f'], ['#c8a8ff', '#7a4ae0'], ['#ff9ab8', '#e0306e']][i % 3] });
      }
      uiBtns.push({ id: 'level_' + i, x, y, w: cw, h: ch, disabled: locked });
    });
    button('back', 14 + SAFE_L, VH - 50, 90, 38, '◀ BACK', { col: ['#9fd2ff', '#4a9bf0'], size: 14 });
    iconButton('mute', VW - 30 - SAFE_R, 28, 17, muteIcon);
  }

  G.confetti = [];
  function victoryConfetti() {
    if (G.confetti.length > 150) return;
    G.confetti.push({ x: rand(0, VW), y: -10, vx: rand(-40, 40), vy: rand(20, 80), rot: rand(0, 6), vr: rand(-8, 8), col: ['#ff5fa0', '#ffe14a', '#8af05a', '#5ec8ff', '#b65cff'][Math.floor(rand(0, 5))] });
  }
  function renderVictory() {
    const t = G.t;
    menuBackground(t * 40);
    ctx.fillStyle = 'rgba(255,240,160,.18)'; ctx.fillRect(0, 0, VW, VH);
    for (const c of G.confetti) { ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot); ctx.fillStyle = c.col; ctx.fillRect(-3, -1.5, 6, 3); ctx.restore(); }
    D.text(ctx, 'YOU WIN!', VW / 2, 52, 44, '#ffde3a', { sw: 9 });
    D.text(ctx, 'All three levels complete!', VW / 2, 92, 16, '#fff', { sw: 4 });
    D.text(ctx, 'FINAL SCORE  ' + G.score, VW / 2, 124, 22, '#8af05a', { sw: 5 });
    D.text(ctx, G.score >= save.high ? '★ NEW HIGH SCORE ★' : 'HIGH SCORE ' + save.high, VW / 2, 150, 13, '#fff', { sw: 3 });
    CHAR_ORDER.forEach((k, i) => {
      const x = VW / 2 - 110 + i * 110, hop = Math.abs(Math.sin(t * 6 + i * 1.3)) * 30;
      heroPose(k, x, 300 - hop, t + i, { scale: 1.7, ground: hop < 2, air: hop > 2, face: i === 2 ? -1 : 1 });
    });
    D.tree(ctx, VW - 70 - SAFE_R, 300, 1, t, true);
    button('again', VW / 2 - 170, VH - 46, 160, 38, 'PLAY AGAIN', { primary: true, size: 15 });
    button('menu', VW / 2 + 10, VH - 46, 160, 38, 'MENU', { col: ['#ff9ab8', '#e0306e'], size: 15 });
  }

  function renderWorld() {
    const t = W.t;
    W.theme.background(ctx, W.camX, VW, VH, t);
    ctx.save();
    const sh = W.shake;
    ctx.translate(-Math.round(W.camX * 10) / 10 + (sh ? rand(-sh, sh) : 0), sh ? rand(-sh, sh) * 0.6 : 0);
    const L = W.camX - 60, R = W.camX + VW + 60;
    // solids
    for (const s of W.solids) {
      if (s.x > R || s.x + s.w < L) continue;
      if (s.kind === 'cloud') { if (!s.off) D.cloudPlatform(ctx, s.x, s.y, s.w, s.h, s.style, s.alpha * (s.style === 'fade' && s.standT > 0 ? (0.6 + 0.4 * Math.abs(Math.sin(t * 25))) : 1), t, s.squash); }
      else if (s.kind === 'ground') drawGround(s); else drawBlock(s);
    }
    for (const d of W.decor) if (d.x > L && d.x < R) W.theme.decor(ctx, d, t);
    // end-of-level tree & sign
    const T = W.tree;
    if (T.x > L - 150 && T.x < R + 150) {
      D.tree(ctx, T.x, T.y, T.grow, t, T.grow >= 1);
      D.sign(ctx, T.x - 80, T.y, W.seeds >= W.def.seedsNeeded ? 'GROWN!' : 'SEEDS ' + W.seeds + '/' + W.def.seedsNeeded);
    }
    // rock shadows (on ground, behind everything)
    for (const e of W.ents) if (e.type === 'rock' && e.groundY !== null) {
      const prog = e.state === 'warn' ? 0.25 * (1 - e.warn / 0.7) : 0.25 + 0.75 * clamp((e.y + 40) / (e.groundY + 40), 0, 1);
      ctx.fillStyle = 'rgba(30,20,10,' + (0.15 + prog * 0.35) + ')';
      D.ell(ctx, e.x, e.groundY - 1, e.r * (0.5 + prog * 0.8), 4 + prog * 2); ctx.fill();
    }
    // entities
    for (const e of W.ents) {
      if (e.x < L - 40 || e.x > R + 40) continue;
      switch (e.type) {
        case 'seed': D.seed(ctx, e.x, e.y, e.t + e.x, 1, e.state === 'fall'); break;
        case 'bug':
          if (!e.active && e.state === 'walk') { D.potato(ctx, e.x, e.y, { dir: e.dir, t: 0, seed: e.seed }); break; }
          if (e.state === 'bumped') { ctx.save(); ctx.translate(e.x, e.y - 11); ctx.scale(1, -1); D.potato(ctx, 0, -11, { dir: e.dir, t: e.t }); ctx.restore(); }
          else D.potato(ctx, e.x, e.y, { dir: e.dir, t: e.t, seed: e.seed, flat: e.state === 'flat' ? Math.min(1, e.flatT * 8) : 0 });
          break;
        case 'snake': D.snake(ctx, e.x, e.y, { t: e.t, headY: e.headY, open: e.open, dir: -1 }); break;
        case 'bird': D.bird(ctx, e.x, e.y, { dir: -1, t: e.t, seed: e.seed }); break;
        case 'orb': D.powerOrb(ctx, e.x, e.y, e.kind, e.t); break;
        case 'flytrap': D.flytrap(ctx, e.x, e.y, e.open, W.t, e.warn); break;
        case 'vine': for (let i = 0; i < e.count; i++) D.vine(ctx, e.x + i * e.gap, e.y, e.hs[i], W.t, i); break;
        case 'bolt':
          if (e.state === 'warn') {
            const k = 1 - e.warn / 0.95;
            ctx.fillStyle = 'rgba(255,255,160,' + (0.08 + 0.18 * k * (0.5 + 0.5 * Math.sin(W.t * 30))) + ')';
            ctx.fillRect(e.x - 14, 60, 28, e.groundY - 60);
            ctx.fillStyle = 'rgba(255,240,120,' + (0.3 + 0.4 * k) + ')'; D.ell(ctx, e.x, e.groundY - 1, 10 + 10 * k, 4); ctx.fill();
            D.stormCloud(ctx, e.x, 46, W.t, Math.sin(W.t * 30) > 0.3);
          } else {
            D.stormCloud(ctx, e.x, 46, W.t, true);
            D.bolt(ctx, e.x, 60, e.groundY, W.t, Math.max(0, 1 - e.strike / 0.35));
          }
          break;
      }
    }
    drawPlayer();
    for (const e of W.ents) {
      if (e.type === 'fire') D.fireball(ctx, e.x, e.y, e.t);
      else if (e.type === 'rock' && e.state === 'fall') D.rock(ctx, e.x, e.y, e.r, e.pts, e.rot);
    }
    // particles
    for (const p of W.parts) {
      const a = 1 - p.life / p.max;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.col;
      if (p.kind === 'feather') { D.ell(ctx, p.x, p.y, p.size * 1.6, p.size * 0.6, p.rot); ctx.fill(); }
      else if (p.kind === 'confetti') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore(); }
      else if (p.kind === 'chip') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); ctx.restore(); }
      else if (p.kind === 'dust') { D.circ(ctx, p.x, p.y, p.size * (1 + p.life / p.max)); ctx.fill(); }
      else { D.circ(ctx, p.x, p.y, p.size * a + 0.5); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    for (const p of W.pops) {
      ctx.globalAlpha = Math.min(1, 2.2 - p.t * 2);
      D.text(ctx, p.text, p.x, p.y, p.size, p.col, { sw: 4 });
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // wind streaks (screen space)
    for (const st of W.streaks) {
      ctx.strokeStyle = 'rgba(255,255,255,' + st.a + ')'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(st.x, st.y); ctx.quadraticCurveTo(st.x + st.len / 2, st.y - 4, st.x + st.len, st.y); ctx.stroke();
    }
    if (W.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.7, W.flash * 2) + ')'; ctx.fillRect(0, 0, VW, VH); }
    // falling-rock warnings at the top of the screen
    for (const e of W.ents) if (e.type === 'rock' && e.state === 'warn') {
      const sx = e.x - W.camX, blink = Math.sin(G.t * 30) > 0;
      ctx.fillStyle = blink ? '#ff3a3a' : '#ffde3a';
      ctx.beginPath(); ctx.moveTo(sx, 52); ctx.lineTo(sx - 11, 72); ctx.lineTo(sx + 11, 72); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#1b2a4a'; ctx.lineWidth = 2; ctx.stroke();
      D.text(ctx, '!', sx, 66, 13, '#1b2a4a', { stroke: false });
    }
  }

  const dirtPatterns = {};
  function getDirtPattern() {
    const base = (W && W.theme.dirtBase) || '#a06c3a';
    if (dirtPatterns[base]) return dirtPatterns[base];
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 22; i++) {
      x.fillStyle = i % 3 ? 'rgba(90,50,20,.35)' : 'rgba(255,220,170,.18)';
      x.beginPath(); x.ellipse(window.hash01(i) * 64, window.hash01(i + 40) * 64, 2 + window.hash01(i + 80) * 3, 1.5 + window.hash01(i + 90) * 2, 0, 0, 6.29); x.fill();
    }
    dirtPatterns[base] = ctx.createPattern(c, 'repeat');
    return dirtPatterns[base];
  }
  function drawGround(s) {
    const bottom = VH + 20;
    ctx.fillStyle = getDirtPattern();
    ctx.fillRect(s.x, s.y + 8, s.w, bottom - s.y);
    const sg = ctx.createLinearGradient(0, s.y, 0, bottom);
    sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(60,30,10,.45)');
    ctx.fillStyle = sg; ctx.fillRect(s.x, s.y + 8, s.w, bottom - s.y);
    // side shading
    ctx.fillStyle = 'rgba(60,30,10,.35)';
    ctx.fillRect(s.x, s.y + 8, 4, bottom - s.y); ctx.fillRect(s.x + s.w - 4, s.y + 8, 4, bottom - s.y);
    // grass
    const gc = W.theme.grass || ['#8af06a', '#3fae3a'];
    const g = ctx.createLinearGradient(0, s.y - 2, 0, s.y + 14);
    g.addColorStop(0, gc[0]); g.addColorStop(1, gc[1]);
    ctx.fillStyle = g; D.rr(ctx, s.x - 3, s.y - 2, s.w + 6, 15, 6); ctx.fill();
    ctx.fillStyle = gc[1];
    const x0 = Math.max(s.x + 4, W.camX - 20), x1 = Math.min(s.x + s.w - 4, W.camX + VW + 20);
    for (let x = Math.floor(x0 / 14) * 14 + 7; x < x1; x += 14) { D.circ(ctx, x, s.y + 12, 5.5); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(s.x, s.y, s.w, 2);
  }
  function drawBlock(s) {
    const by = s.y - Math.sin(s.bump * Math.PI) * 6;
    ctx.fillStyle = 'rgba(0,0,0,.12)'; D.rr(ctx, s.x + 4, by + 6, s.w, s.h, 10); ctx.fill();
    ctx.save(); D.rr(ctx, s.x, by, s.w, s.h, 10); ctx.clip();
    ctx.fillStyle = getDirtPattern(); ctx.fillRect(s.x, by, s.w, s.h);
    const g = ctx.createLinearGradient(0, by, 0, by + 9); g.addColorStop(0, '#8af06a'); g.addColorStop(1, '#3fae3a');
    ctx.fillStyle = g; ctx.fillRect(s.x, by, s.w, 9);
    ctx.fillStyle = '#3fae3a';
    for (let x = s.x + 6; x < s.x + s.w; x += 12) { D.circ(ctx, x, by + 9, 4.5); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(60,30,10,.6)'; ctx.lineWidth = 2; D.rr(ctx, s.x, by, s.w, s.h, 10); ctx.stroke();
  }

  function drawPlayer() {
    const big = P.pw.power > 0;
    const scale = big ? 1.35 + Math.sin(W.t * 20) * 0.02 : 1;
    for (const tr of P.trail) {
      D.hero(ctx, G.charKey, tr.x, tr.y, { face: tr.face, alpha: tr.a * 0.6, t: W.t, run: P.run, ground: true, speed: 1, scale });
    }
    if (P.invuln > 0 && !P.dead && Math.floor(P.invuln * 14) % 2 === 0) return;
    ctx.save();
    if (P.dead) { ctx.translate(P.x, P.y - P.h / 2); ctx.rotate(P.deadT * 8); ctx.translate(-P.x, -(P.y - P.h / 2)); }
    D.hero(ctx, G.charKey, P.x, P.y, {
      face: P.face, sx: P.sx, sy: P.sy, run: P.run, speed: Math.abs(P.vx) / 120, ground: P.onGround, air: !P.onGround,
      t: W.t, blink: P.blink > 0, hurt: P.hurtFace > 0 || P.dead, look: P.face > 0 ? 0.4 : 0.4,
      scale, glow: big, shield: P.pw.shield > 0
    });
    ctx.restore();
  }

  function fmtTime(s) { s = Math.ceil(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function renderHUD() {
    const L = 10 + SAFE_L, R = VW - 10 - SAFE_R;
    // panel: lives + stars
    ctx.fillStyle = 'rgba(20,30,60,.45)'; D.rr(ctx, L, 8, 196, 30, 15); ctx.fill();
    // heart
    const hx = L + 16, hy = 23;
    ctx.fillStyle = '#ff4f6a';
    ctx.beginPath(); ctx.moveTo(hx, hy + 8); ctx.bezierCurveTo(hx - 12, hy, hx - 9, hy - 9, hx, hy - 4); ctx.bezierCurveTo(hx + 9, hy - 9, hx + 12, hy, hx, hy + 8); ctx.fill();
    D.text(ctx, '×' + G.lives, L + 40, 23, 15, '#fff', { sw: 3 });
    for (let i = 0; i < STARS_PER_LIFE; i++) {
      const sx = L + 70 + i * 25, sy = 23;
      const full = i < P.stars;
      const half = i === P.stars - 1 && P.hitCount > 0;
      ctx.fillStyle = full ? '#ffd21f' : 'rgba(255,255,255,.25)';
      D.star(ctx, sx, sy, 10, 0); ctx.fill();
      if (half) { ctx.save(); D.star(ctx, sx, sy, 10, 0); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(sx, sy - 11, 11, 22); ctx.restore(); }
      if (full) { ctx.strokeStyle = '#b07a00'; ctx.lineWidth = 1; D.star(ctx, sx, sy, 10, 0); ctx.stroke(); }
    }
    // seeds
    ctx.fillStyle = 'rgba(20,30,60,.45)'; D.rr(ctx, L + 204, 8, 74, 30, 15); ctx.fill();
    D.seed(ctx, L + 222, 23, W.t, 0.9, true);
    const got = W.seeds >= W.def.seedsNeeded;
    D.text(ctx, W.seeds + '/' + W.def.seedsNeeded, L + 252, 23, 15, got ? '#8af05a' : '#fff', { sw: 3 });
    // timer
    const low = W.time < 30;
    ctx.fillStyle = 'rgba(20,30,60,.45)'; D.rr(ctx, VW / 2 - 6, 8, 70, 30, 15); ctx.fill();
    D.text(ctx, fmtTime(W.time), VW / 2 + 29, 23, 17, low && Math.sin(G.t * 10) > 0 ? '#ff5050' : '#fff', { sw: 3 });
    // score
    D.text(ctx, String(G.score).padStart(6, '0'), R - 92, 23, 18, '#ffde3a', { sw: 4, align: 'right' });
    D.text(ctx, 'SCORE', R - 92, 42, 9, '#fff', { sw: 3, align: 'right' });
    iconButton('mute', R - 60, 23, 15, muteIcon);
    iconButton('pause', R - 18, 23, 15, (x, y) => { ctx.fillStyle = '#fff'; ctx.fillRect(x - 6, y - 7, 4, 14); ctx.fillRect(x + 2, y - 7, 4, 14); });
    // active power-ups
    let px = VW / 2 + 29 - 0;
    const active = Object.keys(P.pw).filter(k => P.pw[k] > 0);
    px -= (active.length - 1) * 22;
    for (const k of active) {
      const frac = P.pw[k] / POWER_TIME;
      ctx.fillStyle = 'rgba(20,30,60,.5)'; D.circ(ctx, px, 58, 17); ctx.fill();
      ctx.strokeStyle = D.POWER_COLORS[k][0]; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(px, 58, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); ctx.stroke();
      ctx.fillStyle = k === 'shield' ? '#111' : D.POWER_COLORS[k][0]; D.star(ctx, px, 59, 9, 0); ctx.fill();
      if (k === 'shield') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); }
      if (P.pw[k] < 2.5 && Math.sin(G.t * 16) > 0) { ctx.fillStyle = 'rgba(255,255,255,.4)'; D.circ(ctx, px, 58, 15); ctx.fill(); }
      px += 44;
    }
    // wind warning
    if (W.wind.phase !== 'calm') {
      const gust = W.wind.phase === 'gust', wx = VW / 2 - 70;
      ctx.fillStyle = gust ? 'rgba(60,90,160,.6)' : 'rgba(20,30,60,.45)'; D.rr(ctx, wx - 40, 46, 80, 24, 12); ctx.fill();
      D.text(ctx, gust ? '◀◀ WIND' : 'WIND!', wx, 58, 12, gust ? '#cfe6ff' : (Math.sin(G.t * 14) > 0 ? '#ffde3a' : '#fff'), { sw: 3 });
    }
    // touch controls
    if (Input.touchUsed && (G.state === 'play' || G.state === 'intro')) {
      for (const b of Input.buttons) {
        const on = Input[b.id];
        ctx.fillStyle = on ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.22)';
        D.circ(ctx, b.x, b.y, b.r); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.9)';
        if (b.id === 'jump') {
          ctx.beginPath(); ctx.moveTo(b.x, b.y - 16); ctx.lineTo(b.x - 15, b.y + 4); ctx.lineTo(b.x - 6, b.y + 4); ctx.lineTo(b.x - 6, b.y + 14); ctx.lineTo(b.x + 6, b.y + 14); ctx.lineTo(b.x + 6, b.y + 4); ctx.lineTo(b.x + 15, b.y + 4); ctx.closePath(); ctx.fill();
        } else {
          const d = b.id === 'left' ? -1 : 1;
          ctx.beginPath(); ctx.moveTo(b.x + d * 14, b.y); ctx.lineTo(b.x - d * 8, b.y - 14); ctx.lineTo(b.x - d * 8, b.y + 14); ctx.closePath(); ctx.fill();
        }
      }
    }
    // banner
    if (W.banner) {
      const b = W.banner, a = Math.min(1, b.t * 5, (b.dur - b.t) * 4);
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = 'rgba(20,30,60,.55)'; D.rr(ctx, VW / 2 - 170, 90, 340, 54, 16); ctx.fill();
      D.text(ctx, b.text, VW / 2, 110, 20, '#ffde3a', { sw: 5 });
      if (b.sub) D.text(ctx, b.sub, VW / 2, 132, 12, '#fff', { sw: 3 });
      ctx.globalAlpha = 1;
    }
  }

  function panel(w, h) {
    ctx.fillStyle = 'rgba(15,25,50,.55)'; ctx.fillRect(0, 0, VW, VH);
    const x = VW / 2 - w / 2, y = VH / 2 - h / 2;
    ctx.fillStyle = 'rgba(20,30,60,.4)'; D.rr(ctx, x, y + 6, w, h, 22); ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#5ec8ff'); g.addColorStop(1, '#2f7fe0');
    ctx.fillStyle = g; D.rr(ctx, x, y, w, h, 22); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#1b2a4a'; ctx.stroke();
    return { x, y };
  }
  function renderOverlay() {
    const s = G.state, L = W.def;
    if (s === 'intro') {
      const a = Math.min(1, G.stateT * 4, (2.0 - G.stateT) * 4);
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = 'rgba(20,30,60,.55)'; D.rr(ctx, VW / 2 - 180, 100, 360, 104, 22); ctx.fill();
      D.text(ctx, 'LEVEL ' + L.id + ': ' + L.name.toUpperCase(), VW / 2, 128, 22, '#ffde3a', { sw: 5 });
      D.text(ctx, 'Collect ' + L.seedsNeeded + ' seeds to grow the tree!', VW / 2, 158, 14, '#fff', { sw: 4 });
      D.text(ctx, G.stateT < 1.3 ? 'READY...' : 'GO!', VW / 2, 186, 18, '#8af05a', { sw: 5 });
      ctx.globalAlpha = 1;
    } else if (s === 'paused') {
      const p = panel(280, 230);
      D.text(ctx, 'PAUSED', VW / 2, p.y + 34, 28, '#ffde3a', { sw: 6 });
      if (Input.touchUsed && window.innerHeight > window.innerWidth) D.text(ctx, 'Rotate your phone to play', VW / 2, p.y + 60, 12, '#fff', { sw: 3 });
      button('resume', VW / 2 - 100, p.y + 70, 200, 42, 'RESUME', { primary: true, size: 18 });
      button('restart', VW / 2 - 100, p.y + 120, 200, 38, 'RESTART LEVEL', { col: ['#9fd2ff', '#4a9bf0'], size: 14 });
      button('quit', VW / 2 - 100, p.y + 166, 200, 38, 'QUIT TO MENU', { col: ['#ff9ab8', '#e0306e'], size: 14 });
    } else if (s === 'lifelost') {
      const p = panel(300, 150);
      D.text(ctx, G.dieReason || 'Ouch!', VW / 2, p.y + 36, 24, '#ffde3a', { sw: 6 });
      D.text(ctx, G.lives + (G.lives === 1 ? ' life' : ' lives') + ' left', VW / 2, p.y + 74, 18, '#fff', { sw: 4 });
      D.text(ctx, 'Restarting the level...', VW / 2, p.y + 110, 13, '#fff', { sw: 3 });
    } else if (s === 'gameover') {
      const p = panel(320, 220);
      D.text(ctx, G.result.reason, VW / 2, p.y + 38, 30, '#ff5f7a', { sw: 7 });
      D.text(ctx, 'SCORE ' + G.score, VW / 2, p.y + 78, 18, '#fff', { sw: 4 });
      D.text(ctx, 'HIGH SCORE ' + save.high, VW / 2, p.y + 102, 13, '#ffde3a', { sw: 3 });
      button('retry', VW / 2 - 110, p.y + 124, 220, 42, 'RETRY LEVEL ' + L.id, { primary: true, size: 17 });
      button('menu', VW / 2 - 110, p.y + 172, 220, 36, 'MENU', { col: ['#9fd2ff', '#4a9bf0'], size: 14 });
    } else if (s === 'complete') {
      const r = G.result;
      const p = panel(360, 300);
      D.text(ctx, 'LEVEL COMPLETE!', VW / 2, p.y + 34, 28, '#ffde3a', { sw: 6 });
      const rows = [['Level points', r.levelPts], ['Time left ' + fmtTime(r.timeLeft) + ' × 100', r.bonus], ['Seeds', r.seeds + '/' + L.seedsNeeded]];
      rows.forEach(([a, b], i) => {
        D.text(ctx, a, p.x + 30, p.y + 72 + i * 24, 14, '#fff', { sw: 3, align: 'left' });
        D.text(ctx, String(b), p.x + 330, p.y + 72 + i * 24, 15, '#fff', { sw: 3, align: 'right' });
      });
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(p.x + 30, p.y + 134, 300, 2);
      D.text(ctx, 'TOTAL', p.x + 30, p.y + 152, 18, '#ffde3a', { sw: 4, align: 'left' });
      D.text(ctx, String(r.total), p.x + 330, p.y + 152, 20, '#ffde3a', { sw: 4, align: 'right' });
      D.text(ctx, r.newHigh ? '★ NEW HIGH SCORE! ★' : 'HIGH SCORE ' + save.high, VW / 2, p.y + 180, 14, r.newHigh ? '#8af05a' : '#fff', { sw: 4 });
      const next = window.LEVELS[G.levelIdx + 1];
      if (next && !next.comingSoon) button('next', VW / 2 - 150, p.y + 200, 300, 40, 'NEXT LEVEL ▶', { primary: true, size: 17 });
      else if (!next) button('finish', VW / 2 - 150, p.y + 200, 300, 40, 'FINISH ★', { primary: true, size: 17, col: ['#8af05a', '#2f9e3a'] });
      else button('none', VW / 2 - 150, p.y + 200, 300, 40, 'LEVEL ' + next.id + ' COMING SOON', { disabled: true, size: 14 });
      button('replay', VW / 2 - 150, p.y + 250, 144, 36, 'REPLAY', { col: ['#9fd2ff', '#4a9bf0'], size: 14 });
      button('menu', VW / 2 + 6, p.y + 250, 144, 36, 'MENU', { col: ['#ff9ab8', '#e0306e'], size: 14 });
    }
  }

  // ---------- loop ----------
  let last = performance.now(), fpsAcc = 0, fpsN = 0;
  G.fps = 60;
  function frame(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 1 / 30) dt = 1 / 30;
    if (dt < 0) dt = 0;
    fpsAcc += dt; fpsN++; if (fpsAcc > 1) { G.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    try { update(dt); render(); } catch (err) { console.error(err); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------- debug / test hooks ----------
  window.RNR = {
    G, CHARACTERS,
    get W() { return W; }, get P() { return P; }, get state() { return G.state; }, get save() { return save; },
    start(charKey, levelIdx) { G.god = false; G.rescue = false; G.rescues = 0; G.rescueAt = []; G.charKey = charKey || G.charKey; G.score = 0; G.levelStartScore = 0; startLevel(levelIdx || 0, true); setState('play'); },
    teleport(x) { P.x = x; P.y = (surfaceAt(x) || 300) - 1; P.vy = 0; W.camX = clamp(x - VW * 0.38, 0, W.def.length - VW); },
    giveSeeds(n) { W.seeds += n; },
    god(on) { G.god = on !== false; },
    rescue(on) { G.rescue = on !== false; },
    surfaceAt(x, g) { return surfaceAt(x, g); },
    vineHeight(e, i, time) { return vineHeight(e, i, time); },
    win() { win(); },
    power(kind) { P.pw[kind] = POWER_TIME; },
    spawn(type) { if (type === 'rock') spawnRock(); if (type === 'bird') spawnBird(true); if (type === 'orb') spawnPower(); },
    hurt() { hurt(null); }
  };
})();

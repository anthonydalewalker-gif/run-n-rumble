// Run N Rumble - core game engine.
(function () {
  'use strict';
  const D = window.Draw, Input = window.Input, Sound = window.Sound;
  const VH = 360;              // logical screen height; width adapts to the screen's aspect ratio
  const GRAV = 1700, MAX_FALL = 900;
  const STARS_PER_LIFE = 5, START_LIVES = 5, POWER_TIME = 10, WIND_PUSH = 75;

  // Tubby Dash: the one and only hero. Balanced stats.
  const HERO = { name: 'Tubby Dash', speed: 210, jump: 680, w: 24, h: 40 };
  const POWER_NAMES = { speed: 'SPEED BOOST!', power: 'POWER UP!', shield: 'SHIELD!', highjump: 'HIGH JUMP!', tough: 'TOUGH! HALF DAMAGE' };
  const EXIT_NAMES = { flag: 'the goal flag', tree: 'the big tree', rainbow: 'the rainbow', pier: 'the harbor gate', submarine: 'the submarine', rocket: 'the rocket', portal: 'the portal home' };
  // Story: each friend is held by a boss (by level index); the 5-3 exit is the portal back to the TV.
  const FRIEND_LEVEL = { pipple: 5, lunker: 8, squib: 11 };
  const BOSS_NAMES = { potato: 'POTATO KING', thunder: 'THUNDER BIRD', pigeon: 'PIGEON BOSS', crab: 'GIANT CRAB', glitch: 'GLITCH MONSTER' };
  const FRIEND_KEYS = ['pipple', 'lunker', 'squib'];
  const STORY_BEATS = [
    'The Thunder Bird carried Pipple up into the clouds!',
    'Pipple is free! A Pigeon Boss grabbed Lunker in the city...',
    'Lunker is back! A Giant Crab took Squib under the sea...',
    'All friends found! The Glitch Monster guards the portal home!',
    'Through the portal... back to the living room!'
  ];
  function friendsBefore(idx) { return FRIEND_KEYS.filter(k => FRIEND_LEVEL[k] < idx); }
  function friendsWith() { return friendsBefore(G.levelIdx).concat(W && W.cage && W.cage.freed ? [W.cage.kind] : []); }

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
  const SAVE_KEY = 'rnr_save_v2';
  let save = { high: 0, best: {}, beaten: false };
  try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) {}
  // ---------- progression lock: a stage unlocks once the one before it is cleared ----------
  let devUnlockAll = false;
  function isDone(i) { const L = window.LEVELS[i]; return !!(L && save.nodes && save.nodes[L.id]); }
  function isUnlocked(i) {
    if (i <= 0 || devUnlockAll) return true;
    if (i >= window.LEVELS.length) return false;
    return isDone(i - 1) || isDone(i) || (save.lastNode | 0) >= i;
  }
  function maxUnlocked() { let m = 0; for (let i = 1; i < window.LEVELS.length; i++) if (isUnlocked(i)) m = i; return m; }
  function nextStage() { const n = window.LEVELS.length; for (let i = 0; i < n; i++) if (isUnlocked(i) && !isDone(i)) return i; return Math.min(save.lastNode | 0, n - 1); }
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

  // ---------- game state ----------
  const G = {
    state: 'title', t: 0, stateT: 0,
    levelIdx: 0, score: 0, levelStartScore: 0, lives: START_LIVES,
    message: null, result: null, god: false, rescue: false, rescues: 0, fade: 0
  };
  let W = null;   // current world
  let P = null;   // player

  function setState(s) {
    // Entering gameplay: ignore any finger that was already down (e.g. the one that tapped PLAY/RETRY).
    if ((s === 'intro' || s === 'play') && ['title', 'levels', 'paused', 'gameover', 'complete', 'victory', 'cutscene', 'runoff', 'story', 'mapwalk'].includes(G.state)) Input.ignoreBefore = performance.now();
    G.state = s; G.stateT = 0;
  }
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const approach = (v, target, d) => v < target ? Math.min(v + d, target) : Math.max(v - d, target);

  // ---------- world building ----------
  function buildLevel(idx) {
    const def = window.LEVELS[idx];
    const theme = window.THEMES[def.theme];
    ['blocks', 'clouds', 'bugs', 'birds', 'snakes', 'rocks', 'lightning', 'wind', 'water', 'logs', 'coral', 'fish', 'jellies', 'crumble', 'walks', 'floaters', 'eels', 'trains'].forEach(k => { if (!def[k]) def[k] = []; });
    const sk = theme.solid;
    const groundKind = { earth: 'ground', cloud: 'cloud', city: 'roof', water: 'dock', moon: 'moon', subway: 'track' }[sk];
    const blockKind = { earth: 'block', cloud: 'cloud', city: 'ac', water: 'block', moon: 'asteroid', subway: 'ac' }[sk];
    const w = {
      def, theme, solids: [], gaps: [], ents: [], parts: [], pops: [], decor: [], streaks: [],
      wind: { phase: 'calm', t: 2.5 }, boltT: 2, flash: 0,
      time: def.time, camX: 0, camY: 0, shake: 0, t: 0,
      g: GRAV * (def.gravity || 1), maxFall: MAX_FALL * (def.gravity ? 0.55 : 1), jumpScale: def.jumpScale || 1,
      rockT: 2, powerT: def.power.first, birdTriggers: def.birds.map(b => ({ x: b[0], skin: b[1] || def.birdSkin || 'bird', done: false })),
      banner: null, won: false, bubbleT: 0, trainT: 2.5, trainWarn: 0
    };
    def.ground.forEach(([x0, x1, top]) => w.solids.push({ x: x0, y: top, w: x1 - x0, h: def.seabed ? seabedAt(x0 + 1, def) - top : 600, kind: groundKind, style: 'bank', main: true, bump: 0, alpha: 1 }));
    def.blocks.forEach(([x, top, bw]) => w.solids.push({ x, y: top, w: bw, h: blockKind === 'ac' ? 30 : 22, kind: blockKind, style: 'static', bump: 0, alpha: 1 }));
    def.clouds.forEach(([x, top, cw, style, o]) => {
      o = o || {};
      w.solids.push({ x, y: top, w: cw, h: 20, kind: 'cloud', style, bx: x, by: top, ax: o.ax || 0, ay: o.ay || 0, period: o.period || 4, bump: 0, alpha: 1, standT: 0, off: false, respawnT: 0, squash: 0, dx: 0, dy: 0 });
    });
    def.crumble.forEach(([x, top, cw]) => w.solids.push({ x, y: top, w: cw, h: 18, kind: 'crumble', style: 'fade', bump: 0, alpha: 1, standT: 0, off: false, respawnT: 0, squash: 0 }));
    def.walks.forEach(([x, top, ww]) => w.solids.push({ x, y: top, w: ww, h: 14, kind: 'walk', style: 'static', bump: 0, alpha: 1 }));
    def.floaters.forEach(([x, top, fw, o]) => { o = o || {}; w.solids.push({ x, y: top, w: fw, h: 22, kind: 'asteroid', style: o.ax || o.ay ? 'drift' : 'static', bx: x, by: top, ax: o.ax || 0, ay: o.ay || 0, period: o.period || 4, bump: 0, alpha: 1, dx: 0, dy: 0, squash: 0 }); });
    def.logs.forEach(([x, top, lw, o]) => { o = o || {}; w.solids.push({ x, y: top, w: lw, h: 16, kind: 'log', style: 'drift', bx: x, by: top, ax: o.ax || 0, ay: 3, period: o.ax ? 5 : 2.6, bump: 0, alpha: 1, dx: 0, dy: 0, squash: 0 }); });
    if (def.seabed) def.seabed.forEach(([x0, x1, y]) => w.solids.push({ x: x0, y, w: x1 - x0, h: 400, kind: 'sand', style: 'bank', main: true, seabed: true, bump: 0, alpha: 1 }));
    def.coral.forEach(([x, top, cw]) => w.solids.push({ x, y: top, w: cw, h: seabedAt(x, def) - top, kind: 'coral', style: 'static', bump: 0, alpha: 1 }));
    if (!def.water.length) {
      const gs = def.ground.slice().sort((a, b) => a[0] - b[0]);
      for (let i = 0; i < gs.length - 1; i++) if (gs[i + 1][0] > gs[i][1]) w.gaps.push({ x0: gs[i][1], x1: gs[i + 1][0], passed: false });
    }
    W = w;
    def.bugs.forEach(([x, skin]) => w.ents.push(makeBug(x, skin || def.bugSkin || 'potato')));
    def.snakes.forEach(([x]) => w.ents.push(makeSnake(x)));
    def.fish.forEach(([x]) => w.ents.push({ type: 'fish', x, y: null, w: 30, h: 18, dir: -1, active: false, state: 'alive', passed: false, t: rand(0, 5), speed: rand(70, 100) }));
    def.jellies.forEach(([x, y]) => w.ents.push({ type: 'jelly', x, y, baseY: y, w: 26, h: 26, state: 'alive', passed: false, t: rand(0, 5) }));
    def.eels.forEach(([x, y]) => w.ents.push({ type: 'eel', x, y, ext: 0, phase: 'hide', timer: rand(0.5, 1.5), state: 'alive', passed: true, t: 0 }));
    const ex = def.exit;
    w.exit = { x: ex.x, kind: ex.kind, y: ex.kind === 'submarine' ? waterY(ex.x) + 14 : surfaceAt(ex.x, true) };
    const fk = FRIEND_KEYS.find(k => FRIEND_LEVEL[k] === idx);
    if (fk) { const cx = ex.x - 250; w.cage = { kind: fk, x: cx, y: surfaceAt(cx, true), open: 0, freed: false, held: !!def.boss }; }
    if (def.boss) { w.boss = makeBoss(def.boss); w.exit.hidden = true; if (def.boss === 'crab') w.camY = Math.max(...def.seabed.map(b => b[2])) + 20 - VH; }
    w.hist = [];
    // decoration
    let k = 0;
    def.ground.forEach(([x0, x1, top]) => {
      for (let x = x0 + 30; x < x1 - 30; x += 40 + window.hash01(k++) * 90) {
        if (Math.abs(x - ex.x) < 90) continue;
        const r = window.hash01(k++);
        w.decor.push({ x, y: top, kind: r < 0.5 ? 'flower' : (r < 0.8 || sk === 'cloud') ? 'bush' : 'mushroom', col: ['#ff6fa8', '#ffffff', '#b47aff', '#ff8a3a'][Math.floor(window.hash01(k++) * 4)] });
      }
    });
    return w;
  }
  function surfaceAt(x, groundOnly) {
    let best = null;
    for (const s of W.solids) {
      if (s.off || s.seabed) continue;
      if (groundOnly && !s.main) continue;
      if (x >= s.x && x <= s.x + s.w && (best === null || s.y < best)) best = s.y;
    }
    return best;
  }
  // water surface height at x (null = no water here). Neighbouring regions blend with a slope.
  function waterY(x) {
    const ws = W.def.water;
    if (!ws.length) return null;
    for (let i = 0; i < ws.length; i++) {
      const [a, b, y] = ws[i];
      if (x >= a && x <= b) return y;
      const n = ws[i + 1];
      if (n && x > b && x < n[0]) { const k = (x - b) / (n[0] - b), e = k * k * (3 - 2 * k); return y + (n[2] - y) * e; }
    }
    return null;
  }
  function seabedAt(x, def) {
    def = def || W.def;
    if (!def.seabed) return VH;
    for (const [a, b, y] of def.seabed) if (x >= a && x < b) return y;
    return VH;
  }
  const isDeep = x => seabedAt(x) > 400;
  function inWater(b) { const wy = waterY(b.x); return wy !== null && b.y - b.h * 0.45 > wy; }

  function makePlayer() {
    return {
      C: HERO, x: 60, y: surfaceAt(60), vx: 0, vy: 0, w: HERO.w, h: HERO.h, face: 1, onGround: true,
      stars: STARS_PER_LIFE, hitCount: 0, invuln: 0, sx: 1, sy: 1, run: 0, coyote: 0, jumpBuf: 0, jumping: false,
      pw: { speed: 0, power: 0, shield: 0, highjump: 0, tough: 0 }, trail: [], trailT: 0, blinkT: 2, blink: 0, dead: false, prevY: 0, hurtFace: 0, dustT: 0,
      swim: false, sprout: 0
    };
  }
  function makeBug(x, skin) {
    const sp = { potato: rand(55, 85), trash: rand(100, 125), crab: rand(45, 65), alien: rand(55, 75) }[skin];
    return { type: 'bug', skin, x, y: null, w: skin === 'trash' ? 30 : 32, h: skin === 'trash' ? 30 : 22, vx: 0, vy: 0, dir: -1, speed: sp, active: false, state: 'walk', passed: false, t: rand(0, 5), flatT: 0, turnT: rand(1.2, 2.2), hopT: rand(0.6, 1.4) };
  }
  function makeSnake(x) {
    return { type: 'snake', x, y: null, w: 40, h: 36, dir: -1, cool: 1.0, high: false, headY: -40, open: 0, windup: 0, state: 'alive', passed: false, t: 0 };
  }

  function startLevel(idx, fresh) {
    G.levelIdx = idx;
    if (fresh) { G.lives = START_LIVES; G.levelStartScore = G.score; G.levelHurt = false; }
    G.score = G.levelStartScore;
    buildLevel(idx);
    W.ents.forEach(e => { if (e.y === null) e.y = e.type === 'fish' ? 250 : (surfaceAt(e.x) || seabedAt(e.x)); });
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
    if (P.pw.tough > 0) { burst(P.x, P.y - P.h / 2, 10, 'spark', '#ffb347', 150); pop(P.x, P.y - P.h - 28, 'HALF DAMAGE', '#ffb347', 12); }
    Sound.play('hit'); G.levelHurt = true;
    addScore(-300, P.x, P.y - P.h - 10);
    P.hitCount++;
    if (P.hitCount >= (P.pw.tough > 0 ? 2 : 1)) { P.hitCount = 0; P.stars--; }
    P.invuln = 1.6; P.hurtFace = 0.5;
    const away = src && src.x > P.x ? -1 : 1;
    P.vx = away * 220; P.vy = -380; P.onGround = false;
    W.shake = 6;
    burst(P.x, P.y - P.h / 2, 8, 'spark', '#ffd0d0', 140);
    if (P.stars <= 0) die('Out of stars!');
  }
  function die(reason) {
    if (P.dead || W.won) return;
    P.dead = true; P.deadT = 0; P.vy = -520; P.vx = 0; G.levelHurt = true;
    G.dieReason = reason;
    Sound.play('lifelost');
    setState('dying');
  }

  // ---------- enemy defeat ----------
  function smash(e, how) {
    if (e.type === 'bug') {
      if (how === 'bump') { e.state = 'bumped'; e.vy = -320; e.vx = (e.x > P.x ? 1 : -1) * 60; Sound.play('bonk'); }
      else { e.state = 'flat'; e.flatT = 0; e.vx = 0; Sound.play('squish'); burst(e.x, e.y - 6, 8, 'dust', e.skin === 'alien' ? '#9af07a' : '#d9b27a', 90); }
    } else if (e.type === 'bird') {
      e.state = 'dead'; Sound.play('poof');
      if (e.skin === 'ufo') { burst(e.x, e.y, 16, 'spark', '#9af0ff', 180); burst(e.x, e.y, 8, 'chip', '#c8d0da', 150); }
      else { const c = { bird: ['#cfe6ff', '#4a9bf0'], pigeon: ['#d8dce6', '#7a8296'], gull: ['#ffffff', '#c8d0da'] }[e.skin] || ['#cfe6ff', '#4a9bf0']; burst(e.x, e.y, 16, 'feather', c[0], 150); burst(e.x, e.y, 6, 'feather', c[1], 120); }
    } else if (e.type === 'snake') {
      e.state = 'dead'; Sound.play('poof');
      burst(e.x, e.y - 20, 18, 'spark', '#8be05a', 180);
    } else if (e.type === 'eel') {
      e.phase = 'back'; e.timer = 0; e.state = 'alive'; Sound.play('poof'); burst(e.x - 60, e.y, 12, 'bubble', '#dff6ff', 120);
      e.phase = 'hide'; e.ext = 0; e.timer = 99; e.dead = true;
    } else if (e.type === 'fish' || e.type === 'jelly') {
      e.state = 'dead'; e.dead = true; Sound.play('poof');
      burst(e.x, e.y, 12, 'bubble', '#dff6ff', 120); burst(e.x, e.y, 8, 'spark', e.type === 'fish' ? '#ff8a5a' : '#ff9ae0', 140);
    } else if (e.type === 'fire') {
      e.dead = true; Sound.play('smash'); burst(e.x, e.y, 10, 'spark', e.laser ? '#9aff9a' : '#ffb03a', 120);
    } else if (e.type === 'rock') {
      e.dead = true; Sound.play('smash'); burst(e.x, e.y, 12, 'chip', e.skin === 'pot' ? '#c45a28' : '#8d847b', 200);
    }
    e.passed = true;
    if (how === 'power') Sound.play('smash');
    addScore(1000, e.x, (e.y || P.y) - 40);
  }
  function jumpVel() { return HERO.jump * W.jumpScale * (P.pw.highjump > 0 ? 1.42 : 1) * (P.pw.speed > 0 ? 1.04 : 1); }
  function stompBounce() {
    P.vy = Input.jump ? -jumpVel() * 0.95 : -430 * Math.sqrt(W.g / GRAV);
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
    P.sprout = P.pw.highjump > 0 ? Math.min(1, P.sprout + dt * 3) : Math.max(0, P.sprout - dt * 3);
    const fast = P.pw.speed > 0;
    const wasSwim = P.swim;
    P.swim = inWater(P);
    if (P.swim && !wasSwim) {   // splash down
      // plunge: keep some momentum from the fall so higher drops sink deeper
      P.vy = Math.min(Math.max(P.vy, 0) * 0.55 + 60, 380); P.jumping = false; P.popped = false;
      const wy = waterY(P.x); Sound.play('squish'); Sound.play('boing'); W.shake = Math.max(W.shake, 2);
      burst(P.x, wy, 14, 'bubble', '#e8fbff', 140);
      for (let i = 0; i < 12; i++) W.parts.push({ x: P.x + rand(-10, 10), y: wy, vx: rand(-110, 110), vy: rand(-320, -140), life: 0, max: rand(0.5, 0.8), kind: 'spark', col: '#dff6ff', size: rand(2, 4), rot: 0, vr: 0 });
    }
    const speed = C.speed * (fast ? 1.55 : 1) * (P.swim ? 0.8 : 1);
    const dir = (Input.right ? 1 : 0) - (Input.left ? 1 : 0);
    if (dir) {
      const acc = (P.onGround ? 1500 : 1000) * (Math.sign(P.vx) !== dir && P.vx !== 0 ? 1.8 : 1);
      P.vx = approach(P.vx, dir * speed, acc * dt); P.face = dir;
    } else {
      P.vx = approach(P.vx, 0, (P.onGround ? 3200 : P.swim ? 900 : 1600) * dt);   // release = stop quickly (no momentum drift)
    }
    if (Input.jumpPressed) P.jumpBuf = 0.13;
    P.jumpBuf -= dt;
    P.coyote = P.onGround ? 0.09 : P.coyote - dt;
    if (P.swim) {
      // swimming: gentle gravity, each jump press is a swim stroke upward; near the surface it leaps out
      if (P.jumpBuf > 0) {
        P.jumpBuf = 0;
        const wy = waterY(P.x);
        if (P.y - P.h < wy + 16) { P.vy = -jumpVel() * 0.92; P.jumping = true; Sound.play('jump'); burst(P.x, wy, 8, 'bubble', '#e8fbff', 110); }
        else { P.vy = Math.min(P.vy, 0) - 300; P.vy = Math.max(P.vy, -340); P.sx = 0.8; P.sy = 1.2; Sound.play('boing'); burst(P.x, P.y - 6, 4, 'bubble', '#e8fbff', 60); }
        P.onGround = false;
      }
      if (Input.jump && P.vy > -120) P.vy -= 260 * dt;     // hold to drift upward
      const wy2 = waterY(P.x), open = !isDeep(P.x);   // open water between docks: buoyancy bobs you back out
      if (open) {
        const depth = P.y - P.h * 0.5 - wy2;
        P.vy -= (depth > 0 ? 900 + depth * 8 : 0) * dt;
        P.vy *= (1 - 1.6 * dt);
        if (!P.popped && P.vy < 0 && P.y - P.h * 0.8 < wy2) {   // breaking the surface: pop out
          P.popped = true; P.vy = -jumpVel() * 0.78; P.jumping = false; P.sx = 0.8; P.sy = 1.25;
          Sound.play('jump'); burst(P.x, wy2, 10, 'bubble', '#e8fbff', 120);
        }
      } else {
        P.vy = Math.min(P.vy + 380 * dt, 110);
        P.vy *= (1 - 0.8 * dt);
      }
      W.bubbleT -= dt; if (W.bubbleT < 0) { W.bubbleT = rand(0.3, 0.7); burst(P.x + P.face * 8, P.y - P.h + 6, 1, 'bubble', '#e8fbff', 20); }
    } else {
      if (P.jumpBuf > 0 && P.coyote > 0) {
        P.vy = -jumpVel(); P.jumpBuf = 0; P.coyote = 0; P.jumping = true; P.onGround = false;
        P.sx = 0.75; P.sy = 1.3; Sound.play(P.pw.highjump > 0 ? 'boing' : 'jump');
        burst(P.x, P.y, 5, 'dust', '#e8dcc0', 70);
        if (P.pw.highjump > 0) burst(P.x, P.y, 8, 'leaf', '#5fd04a', 110);
      }
      const cut = 260 * Math.sqrt(W.g / GRAV);
      if (P.jumping && !Input.jump && P.vy < -cut) P.vy = -cut;  // short hop when the button is released early
      P.vy = Math.min(P.vy + W.g * dt, W.maxFall);
    }
    // ride moving clouds / logs
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
      if (!P.swim) burst(P.x, P.y, 4, 'dust', '#e8dcc0', 50);
    }
    P.x = clamp(P.x, 12, W.def.length - 16);
    if (P.y - P.h < -60) { P.y = P.h - 60; if (P.vy < 0) P.vy = 0; }
    P.sx += (1 - P.sx) * Math.min(1, dt * 12); P.sy += (1 - P.sy) * Math.min(1, dt * 12);
    P.run += dt * Math.abs(P.vx) * 0.09;
    if (P.invuln > 0) P.invuln -= dt;
    if (P.hurtFace > 0) P.hurtFace -= dt;
    P.blinkT -= dt; if (P.blinkT < 0) { P.blink = 0.12; P.blinkT = rand(2, 4.5); } if (P.blink > 0) P.blink -= dt;
    if (P.onGround && !P.swim && Math.abs(P.vx) > 120) { P.dustT -= dt; if (P.dustT < 0) { P.dustT = 0.12; burst(P.x - P.face * 8, P.y, 1, 'dust', '#e8dcc0', 30); } }
    if (fast) { P.trailT -= dt; if (P.trailT < 0) { P.trailT = 0.045; P.trail.push({ x: P.x, y: P.y, face: P.face, a: 0.5 }); } }
    P.trail.forEach(tr => tr.a -= dt * 2); P.trail = P.trail.filter(tr => tr.a > 0);
    W.hist.push({ x: P.x, y: P.y, g: P.onGround && !P.swim, f: P.face, s: Math.abs(P.vx) / 120 }); if (W.hist.length > 120) W.hist.shift();
    // fell into a gap
    if (P.y > (W.def.seabed ? 2000 : VH + 60)) {
      if (G.rescue) { G.rescues++; (G.rescueAt = G.rescueAt || []).push(Math.round(P.x)); let x = P.x; while (surfaceAt(x, true) === null && x < W.def.length) x += 20; P.x = x + 20; P.y = surfaceAt(P.x, true) - 1; P.vy = 0; return; }
      P.stars = 0; die('Fell in a gap!');
    }
    // gap passing bonus
    for (const g of W.gaps) if (!g.passed && P.onGround && P.x > g.x1 + 8 && P.x < g.x1 + 200) { g.passed = true; addScore(500, P.x, P.y - P.h - 14, 'Nice jump!'); }
  }

  function bumpBlock(s) {
    if (s.kind !== 'block' && s.kind !== 'ac' && s.kind !== 'asteroid') return;
    s.bump = 1; Sound.play('bonk');
    burst(P.x, s.y + s.h, 4, 'dust', '#c9a070', 60);
    for (const e of W.ents) {
      if (e.type === 'bug' && e.state === 'walk' && e.active && Math.abs(e.y - s.y) < 2 && e.x > s.x - 10 && e.x < s.x + s.w + 10 && Math.abs(e.x - P.x) < 50) smash(e, 'bump');

    }
  }

  // ---------- spawning ----------
  function spawnBird(skin) {
    const tx = P.x + 150 + Math.max(0, P.vx) * 0.4;
    const ground = surfaceAt(tx) || 300;
    const ufo = skin === 'ufo';
    W.ents.push({ type: 'bird', skin, x: W.camX + VW + 40, y: 40, targetX: tx, lowY: ufo ? ground - 120 : ground - 17, w: ufo ? 36 : 26, h: 20, state: 'fly', passed: false, t: 0, dir: -1, speed: ufo ? 150 : 215, whistled: false, shotT: 0.4 });
  }
  function spawnRock() {
    let tx = P.x + P.vx * 0.75 + rand(-70, 70);
    tx = clamp(tx, W.camX + 30, W.camX + VW - 30);
    const r = rand(13, 18);
    W.ents.push({ type: 'rock', skin: W.def.rockSkin || 'rock', x: tx, y: -40, r, vy: 0, state: 'warn', warn: W.def.rockSkin === 'meteor' ? 0.9 : 0.7, pts: Array.from({ length: 9 }, () => rand(0.8, 1.1)), rot: 0, vr: rand(-4, 4), groundY: surfaceAt(tx), passed: false });
  }
  const POWER_KINDS = ['speed', 'power', 'shield', 'highjump', 'tough'];
  function spawnPower(kind) {
    kind = kind || POWER_KINDS[Math.floor(Math.random() * POWER_KINDS.length)];
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
        case 'orb': updateOrb(e, dt, pb); break;
        case 'fish': updateFish(e, dt, pb); break;
        case 'jelly': updateJelly(e, dt, pb); break;
        case 'bolt': updateBolt(e, dt, pb); break;
        case 'eel': updateEel(e, dt, pb); break;
        case 'train': updateTrain(e, dt, pb); break;
        case 'wave': updateWave(e, dt, pb); break;
      }
      // passing bonus for live enemies
      if (!e.passed && !P.dead && (e.type === 'bug' && e.state === 'walk' && e.active || e.type === 'bird' && e.state === 'fly' || e.type === 'snake' && e.state === 'alive' || (e.type === 'fish' || e.type === 'jelly') && e.state === 'alive')) {
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
      if (e.skin === 'crab') { e.turnT -= dt; if (e.turnT <= 0) { e.dir *= -1; e.turnT = rand(1.2, 2.2); if (e.x > P.x && e.dir > 0 && e.x - P.x < 260) e.dir = -1; } }
      if (e.skin === 'alien' && e.onGround) { e.hopT -= dt; if (e.hopT <= 0) { e.vy = -rand(240, 330); e.hopT = rand(0.9, 1.6); } }
      e.vx = e.dir * e.speed;
      e.vy = Math.min(e.vy + W.g * dt, W.maxFall);
      moveBody(e, dt);
      if (e.hitWall) e.dir *= -1;
      if (e.y > (W.def.seabed ? 2000 : VH + 80)) { e.dead = true; return; }
      if (e.x < W.camX - 200) { e.dead = true; return; }
      contact(e, stompCheck(e, pb, e.y - e.h));
    } else if (e.state === 'flat') {
      e.flatT += dt;
      if (e.flatT > 0.3) {
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
    if (!e.whistled && e.x < W.camX + VW) { e.whistled = true; Sound.play(e.skin === 'ufo' ? 'zap' : 'whistle'); }
    if (e.skin === 'ufo') {
      e.shotT -= dt;
      e.beam = e.shotT < 0.35;
      if (e.shotT <= 0 && e.x < W.camX + VW - 20 && e.x > W.camX + 20 && !P.dead) {
        e.shotT = 1.1;
        W.ents.push({ type: 'fire', laser: true, x: e.x, y: e.y + 10, vx: 0, vy: 260, startX: e.x, t: 0, passed: false });
        Sound.play('zap');
      }
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
    if (e.home) e.vx += clamp(P.x - e.x, -1, 1) * 60 * dt, e.vy += clamp(P.y - 20 - e.y, -1, 1) * 60 * dt;
    if (e.grav) e.vy += e.grav * dt;
    e.x += e.vx * dt; e.y += (e.vy || 0) * dt;
    if (e.skin) {
      if (e.t > e.life || e.x < -40 || e.x > W.def.length + 40 || e.y > VH + 400) { e.dead = true; return; }
      if (e.grav) { const sY = surfaceAt(e.x); if (sY !== null && e.y > sY - 7 && e.vy > 0) { e.y = sY - 7; e.vy = -Math.max(220, e.vy * 0.75); if (--e.bounces < 0) { e.dead = true; burst(e.x, e.y, 6, 'spark', '#ffb03a', 80); return; } } }
      if (P.dead) return;
      if (overlaps(pb.x, pb.y, pb.w, pb.h, e.x - 7, e.y - 7, 14, 14)) { if (P.pw.power > 0) smash(e, 'power'); else { hurt(e); e.dead = true; } }
      return;
    }
    if (!e.laser && W.parts.length < 280 && Math.random() < 0.5) W.parts.push({ x: e.x + 14, y: e.y + rand(-4, 4), vx: rand(20, 60), vy: rand(-30, 10), life: 0, max: 0.3, kind: 'spark', col: '#ffb03a', size: rand(1.5, 3), rot: 0, vr: 0 });
    if (e.startX - e.x > 540 || e.x < W.camX - 60 || e.y > VH + 20) { e.dead = true; return; }
    for (const s of W.solids) if (!s.off && e.x > s.x && e.x < s.x + s.w && e.y > s.y && e.y < s.y + s.h) { e.dead = true; burst(e.x, s.y, 6, 'spark', e.laser ? '#9aff9a' : '#ffb03a', 80); return; }
    if (P.dead) return;
    const r = 7;
    const hb = e.laser ? [e.x - 4, e.y - 10, 8, 20] : [e.x - r, e.y - r, r * 2 + 8, r * 2];
    if (overlaps(pb.x, pb.y, pb.w, pb.h, hb[0], hb[1], hb[2], hb[3])) {
      if (P.pw.power > 0) smash(e, 'power'); else { hurt(e); e.dead = true; }
      return;
    }
    if (!e.passed && (e.laser ? e.y > P.y && Math.abs(e.x - P.x) < 60 : e.x < P.x - 24)) { e.passed = true; addScore(500, P.x, P.y - P.h - 14, 'Dodged!'); }
  }

  function updateRock(e, dt, pb) {
    if (e.state === 'warn') {
      e.warn -= dt;
      if (e.warn <= 0) { e.state = 'fall'; e.vy = 200; }
      return;
    }
    e.vy += (e.skin === 'meteor' ? (W.def.fastMeteors ? 1500 : 900) : 1500) * dt; e.y += e.vy * dt; e.rot += e.vr * dt; if (e.skin === 'meteor') e.x -= (W.def.fastMeteors ? 110 : 60) * dt;
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

  function updateFish(e, dt, pb) {
    if (!e.active) { if (e.x < W.camX + VW + 40) { e.active = true; e.y = clamp(P.y - 20, (waterY(e.x) || 0) + 24, seabedAt(e.x) - 20); } else return; }
    const wy = waterY(e.x);
    e.x -= e.speed * dt;
    // drift toward the player's depth, gently
    const ty = clamp(P.y - P.h / 2, (wy === null ? 0 : wy) + 18, seabedAt(e.x) - 16);
    e.y += clamp(ty - e.y, -40 * dt, 40 * dt) + Math.sin(e.t * 3) * 0.4;
    if (e.x < W.camX - 80) { e.dead = true; return; }
    const res = stompCheck(e, pb, e.y - e.h / 2);
    if (res === 'stomp' && P.swim) { smash(e, 'stomp'); P.vy = -260; } else contact(e, res);
  }
  function updateJelly(e, dt, pb) {
    e.y = e.baseY + Math.sin(e.t * 1.8) * 34;
    const res = stompCheck(e, pb, e.y - e.h / 2);
    if (res === 'stomp') { smash(e, 'stomp'); P.vy = P.swim ? -280 : -430; } else contact(e, res);
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
      const names = POWER_NAMES;
      pop(P.x, P.y - P.h - 24, names[e.kind], D.POWER_COLORS[e.kind][e.kind === 'shield' ? 1 : 0], 16);
    }
  }


  // ---------- level 2 hazards ----------
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
      if ((s.kind !== 'cloud' && s.kind !== 'log' && s.kind !== 'crumble' && s.kind !== 'asteroid') || s.style === 'bank' || s.style === 'static') continue;
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
            if (s.standT > (s.kind === 'crumble' ? 0.75 : 0.5)) s.alpha -= dt * 2.4;
            if (s.alpha <= 0) { s.alpha = 0; s.off = true; s.respawnT = 2.5; Sound.play(s.kind === 'crumble' ? 'smash' : 'poof'); if (s.kind === 'crumble') burst(s.x + s.w / 2, s.y + 8, 14, 'chip', '#8a7a98', 160); }
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

  // ---------- stage-2 hazards: eels, subway trains, shockwaves ----------
  function updateEel(e, dt, pb) {
    if (Math.abs(e.x - P.x) > 520) { e.ext = Math.max(0, e.ext - dt * 3); return; }
    e.timer -= dt;
    if (e.phase === 'hide' && e.timer <= 0) { e.phase = 'warn'; e.timer = 0.7; }
    else if (e.phase === 'warn' && e.timer <= 0) { e.phase = 'out'; e.timer = 0.95; Sound.play('chomp'); }
    else if (e.phase === 'out') { e.ext = Math.min(1, e.ext + dt * 4); if (e.timer <= 0) { e.phase = 'back'; } }
    else if (e.phase === 'back') { e.ext = Math.max(0, e.ext - dt * 2.5); if (e.ext <= 0) { e.phase = 'hide'; e.timer = rand(1.0, 2.0); } }
    if (e.ext < 0.15 || P.dead) return;
    const len = 20 + e.ext * 120, hx = e.x - len + 10;
    const box = { x: (hx + e.x) / 2, w: e.x - hx, h: 20 };
    const res = stompCheck(box, pb, e.y - 10);
    if (!res) return;
    if (res === 'stomp' || res === 'power') { smash(e, res); P.vy = P.swim ? -260 : -430; }
    else hurt(e);
  }
  function updateTrains(dt) {
    const zone = W.def.trains.some(([a, b]) => P.x > a && P.x < b);
    const live = W.ents.some(e => e.type === 'train');
    if (W.trainWarn > 0) {
      W.trainWarn -= dt;
      if (W.trainWarn <= 0) { W.ents.push({ type: 'train', x: W.camX + VW + 40, w: 620, vx: -820, t: 0, hit: false }); Sound.play('wind'); W.shake = 3; }
    } else if (zone && !live && !P.dead) {
      W.trainT -= dt;
      if (W.trainT <= 0) { W.trainWarn = 1.9; W.trainT = rand(4.5, 7); Sound.play('whistle'); }
    }
  }
  function updateTrain(e, dt, pb) {
    e.x += e.vx * dt;
    if (W.parts.length < 280 && Math.random() < 0.4) W.parts.push({ x: e.x + rand(0, e.w), y: 298, vx: rand(-30, 30), vy: rand(-60, -20), life: 0, max: 0.4, kind: 'spark', col: '#ffe08a', size: 2, rot: 0, vr: 0 });
    if (e.x + e.w < W.camX - 60) { e.dead = true; if (!e.hit && !P.dead) addScore(500, P.x, P.y - P.h - 14, 'Dodged!'); return; }
    if (!P.dead && overlaps(pb.x, pb.y, pb.w, pb.h, e.x, 236, e.w, 64)) { if (!e.hit) { e.hit = true; hurt(e); P.vx = -260; } }
  }
  function updateWave(e, dt, pb) {
    e.x += e.dir * e.speed * dt; e.life -= dt;
    if (W.parts.length < 280 && Math.random() < 0.6) burst(e.x, e.y, 1, 'dust', e.col || '#e8dcc0', 60);
    if (e.life <= 0 || e.x < 0 || e.x > W.def.length) { e.dead = true; return; }
    if (!P.dead && P.onGround && Math.abs(P.x - e.x) < 18 && Math.abs(P.y - e.y) < 20) { hurt(e); e.dead = true; }
    else if (!e.passed && !P.dead && !P.onGround && Math.abs(P.x - e.x) < 18) { e.passed = true; addScore(500, P.x, P.y - P.h - 14, 'Dodged!'); }
  }
  function spawnBoltAt(x, glitch) {
    x = clamp(x, 30, W.def.length - 30);
    const gy = surfaceAt(x);
    W.ents.push({ type: 'bolt', x, groundY: gy === null ? VH + 40 : gy, state: 'warn', warn: glitch ? 0.8 : 0.95, strike: 0, hit: false, t: 0, glitch });
  }
  function shoot(x, y, ang, speed, skin, o) {
    W.ents.push(Object.assign({ type: 'fire', skin, x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, startX: x, t: 0, passed: true, life: 5 }, o || {}));
  }

  // ---------- bosses ----------
  const BOSS_DEF = {
    potato: { hp: 3, w: 100, h: 84, cycle: ['charge', 'summon', 'slam'] },
    thunder: { hp: 3, w: 104, h: 74, cycle: ['bolts', 'dive', 'feathers'], fly: true },
    pigeon: { hp: 3, w: 96, h: 74, cycle: ['drop', 'swoop', 'crumbs'], fly: true },
    crab: { hp: 4, w: 150, h: 80, cycle: ['claw', 'bubbles', 'scuttle'] },
    glitch: { hp: 5, w: 84, h: 96, cycle: ['teleport', 'static', 'soda'] }
  };
  function bossGround(x) { const s = surfaceAt(x, true); return W.def.boss === 'crab' ? seabedAt(x) : (s === null ? 300 : s); }
  function makeBoss(kind) {
    const d = BOSS_DEF[kind];
    const B = { kind, x: 1080, y: 0, w: d.w, h: d.h, hp: d.hp, max: d.hp, state: 'enter', st: 0, face: -1, vx: 0, vy: 0, flash: 0, vuln: false, atk: 0, t: 0, alpha: 1, fly: !!d.fly, cycle: d.cycle };
    B.y = d.fly ? 170 : bossGround(700);
    if (kind === 'pigeon') { B.y = 125; B.perch = 125; }
    if (kind === 'crab') { B.x = 700; B.y = bossGround(700) + 90; }
    if (kind === 'glitch') { B.x = 700; B.alpha = 0; }
    return B;
  }
  const bossSpeed = B => 1 + (B.max - B.hp) * 0.3;
  function bossSet(B, s) { B.state = s; B.st = 0; B.tele = false; B.vuln = s === 'stun'; }
  function updateBoss(dt) {
    const B = W.boss; if (!B || B.gone) return;
    B.t += dt; B.st += dt; if (B.flash > 0) B.flash -= dt; if (B.inv > 0) B.inv -= dt;
    const f = bossSpeed(B), g = bossGround(B.x), toP = P.x < B.x ? -1 : 1;
    const L = B.kind === 'crab' ? 230 : 60, R = W.def.length - (B.kind === 'crab' ? 230 : 60);
    switch (B.state) {
      case 'enter':
        if (B.kind === 'crab') { B.y = Math.max(g, B.y - 60 * dt); if (B.st > 1.6) bossSet(B, 'idle'); }
        else if (B.kind === 'glitch') { B.alpha = Math.min(1, B.st / 1.4); B.y = g; if (B.st > 1.6) bossSet(B, 'idle'); }
        else { B.x = Math.max(700, B.x - 240 * dt); if (B.x <= 700 && B.st > 1.4) bossSet(B, 'idle'); }
        if (B.st < dt * 1.5) { banner(BOSS_NAMES[B.kind] + '!', W.def.subtitle, 2.4); Sound.play('thud'); }
        break;
      case 'idle': {
        B.face = toP;
        if (B.kind === 'thunder') { B.x += clamp(P.x + (B.atk % 2 ? 170 : -170) - B.x, -130 * f * dt, 130 * f * dt); B.y = 165 + Math.sin(B.t * 2.5) * 14; }
        else if (B.kind === 'pigeon') { B.x += clamp(P.x - B.x, -110 * f * dt, 110 * f * dt); B.y = B.perch; }
        else if (B.kind === 'crab' || B.kind === 'potato') { if (Math.abs(P.x - B.x) > 160) B.x += toP * 55 * f * dt; B.y = g; }
        else { B.x += toP * 40 * dt; B.y = g - Math.abs(Math.sin(B.t * 3)) * 8; }
        B.x = clamp(B.x, L, R);
        if (B.st > 1.25 / f) { B.next = B.cycle[B.atk % B.cycle.length]; if (B.hp < B.max && Math.random() < 0.3) B.next = B.cycle[Math.floor(Math.random() * 3)]; B.atk++; bossSet(B, B.next); }
        break;
      }
      case 'stun': {
        const dur = B.stunFor || 1.6;
        if (B.fly) B.y = g;
        if (B.st > dur) { B.stunFor = 0; bossSet(B, B.fly ? 'rise' : 'idle'); }
        break;
      }
      case 'rise': {
        const ty = B.kind === 'pigeon' ? B.perch : 165;
        B.y += (ty - B.y) * Math.min(1, dt * 4);
        if (B.kind === 'pigeon') B.x += (Math.min(R, Math.max(L, B.x)) - B.x);
        if (B.st > 0.8) { B.y = ty; bossSet(B, 'idle'); }
        break;
      }
      case 'hurt':
        if (B.fly) { B.y += (Math.min(g, B.y) - 40 - B.y) * dt * 3; }
        B.x = clamp(B.x + B.vx * dt, L, R); B.vx *= 0.92;
        if (B.st > 0.8) bossSet(B, B.fly ? 'rise' : 'idle');
        break;
      case 'die':
        B.y += (B.fly ? 80 : 0) * dt; B.flash = 1;
        if (Math.random() < dt * 12) { burst(B.x + rand(-40, 40), B.y - rand(10, 80), 10, 'spark', ['#ffe14a', '#ff8a5a', '#fff'][Math.floor(rand(0, 3))], 200); Sound.play('poof'); }
        if (B.st > 2.2) bossDefeated(B);
        break;
      // ----- potato king -----
      case 'charge':
        if (B.st < 0.8 / f) { B.tele = true; B.face = toP; if (B.st < dt * 1.5) Sound.play('deny'); }
        else {
          B.tele = false; B.x += B.face * 380 * f * dt;
          if (W.parts.length < 280 && Math.random() < 0.5) burst(B.x - B.face * 40, g, 1, 'dust', '#e8dcc0', 70);
          if (B.x <= L || B.x >= R) { B.x = clamp(B.x, L, R); Sound.play('thud'); W.shake = 10; burst(B.x + B.face * 50, g - 40, 14, 'chip', '#8d847b', 200); B.stunFor = 1.7; bossSet(B, 'stun'); }
        }
        break;
      case 'slam':
        if (B.st < 0.55 / f) { B.tele = true; B.crouch = Math.min(1, B.st * 4); }
        else if (!B.air) { B.tele = false; B.crouch = 0; B.air = true; B.vy = -780; B.vx = clamp((P.x - B.x) / 0.92, -520, 520); Sound.play('jump'); }
        else {
          B.vy += GRAV * dt; B.y += B.vy * dt; B.x = clamp(B.x + B.vx * dt, L, R);
          if (B.vy > 0 && B.y >= g) { B.y = g; B.air = false; Sound.play('thud'); W.shake = 12; burst(B.x, g, 20, 'dust', '#e8dcc0', 160);
            [-1, 1].forEach(d => W.ents.push({ type: 'wave', x: B.x + d * 50, y: g, dir: d, speed: 300 * f, life: 2, t: 0 })); B.stunFor = 1.2; bossSet(B, 'stun'); }
        }
        break;
      case 'summon':
        B.scep = Math.min(1, B.st * 3);
        if (B.st > 0.7 && !B.summoned) {
          B.summoned = true; Sound.play('powerup');
          const n = W.ents.filter(e => e.type === 'bug' && e.state === 'walk').length;
          for (let i = 0; i < Math.min(2, 4 - n); i++) { const b = makeBug(i ? 180 : W.def.length - 180, 'potato'); b.y = -20; b.active = true; b.dir = i ? 1 : -1; W.ents.push(b); burst(b.x, 20, 10, 'spark', '#ffe14a', 120); }
        }
        if (B.st > 1.2) { B.scep = 0; B.summoned = false; bossSet(B, 'idle'); }
        break;
      // ----- thunder bird / pigeon -----
      case 'bolts':
        B.tele = B.st < 0.7 / f; if (B.st < dt * 1.5) Sound.play('crackle');
        if (!B.tele && !B.done) { B.done = true; [-130, 0, 130].forEach(dx => spawnBoltAt(P.x + dx)); Sound.play('crackle'); }
        if (B.st > 1.6) { B.done = false; bossSet(B, 'idle'); }
        break;
      case 'dive': case 'swoop':
        if (B.st < 0.7 / f) { B.tele = true; B.y -= 50 * dt; if (B.st < dt * 1.5) Sound.play('whistle'); B.sx = B.x; B.sy = B.y; B.tx = clamp(P.x, L, R); }
        else {
          B.tele = false;
          const k = Math.min(1, (B.st - 0.7 / f) / (0.65 / f)), e2 = k * k;
          B.x = B.sx + (B.tx - B.sx) * k; B.y = B.sy + (g - B.sy) * e2; B.face = B.tx < B.sx ? -1 : 1;
          if (k >= 1) { B.y = g; Sound.play('thud'); W.shake = 8; burst(B.x, g, 16, 'feather', B.kind === 'pigeon' ? '#d6dbe6' : '#ffe680', 150); B.stunFor = 1.8; bossSet(B, 'stun'); }
        }
        break;
      case 'feathers':
        B.tele = B.st < 0.5 / f;
        if (!B.tele && !B.done) { B.done = true; Sound.play('whistle'); const a = Math.atan2(P.y - 20 - B.y + 45, P.x - B.x); [-0.25, 0, 0.25].forEach(da => shoot(B.x, B.y - 45, a + da, 250 * f, 'feather')); }
        if (B.st > 1.1) { B.done = false; bossSet(B, 'idle'); }
        break;
      case 'drop':
        B.tele = B.st < 0.6 / f;
        if (!B.tele) { const n = Math.floor((B.st - 0.6 / f) / 0.4); if (n < 3 && n >= (B.drops || 0)) { B.drops = n + 1; spawnRock(); Sound.play('whistle'); } }
        if (B.st > 2.2) { B.drops = 0; bossSet(B, 'idle'); }
        break;
      case 'crumbs':
        B.tele = B.st < 0.5 / f;
        if (!B.tele && !B.done) { B.done = true; Sound.play('fire'); [0.55, 0.75, 0.95].forEach(k => shoot(B.x, B.y - 30, Math.atan2(1, toP * 1.4), 160 + k * 120 * f, 'crumb', { grav: 700, bounces: 3 })); }
        if (B.st > 1.3) { B.done = false; bossSet(B, 'idle'); }
        break;
      // ----- giant crab -----
      case 'claw': break;
      case 'bubbles':
        B.tele = B.st < 0.5 / f;
        if (!B.tele && !B.done) { B.done = true; Sound.play('boing'); for (let i = 0; i < 4; i++) shoot(B.x + B.face * 60, B.y - 60, Math.atan2(P.y - B.y, P.x - B.x) + (i - 1.5) * 0.3, 85 * f, 'bubble', { home: 1, life: 4.5 }); }
        if (B.st > 1.3) { B.done = false; bossSet(B, 'idle'); }
        break;
      case 'scuttle':
        if (B.st < 0.6 / f) { B.tele = true; B.face = toP; }
        else { B.tele = false; B.walk = true; B.x += B.face * 300 * f * dt; if (B.x <= L + 20 || B.x >= R - 20) { B.x = clamp(B.x, L + 20, R - 20); B.walk = false; Sound.play('thud'); W.shake = 6; B.stunFor = 2.2; bossSet(B, 'stun'); } }
        break;
      // ----- glitch monster -----
      case 'teleport':
        if (B.st < 0.6 / f) { B.tele = true; B.alpha = Math.sin(B.st * 60) > 0 ? 1 : 0.3; if (B.st < dt * 1.5) Sound.play('crackle'); }
        else if (B.st < 0.9 / f) { B.alpha = 0; B.x = clamp(P.x, L, R); B.y = 40; B.vy = 0; }
        else { B.tele = false; B.alpha = 1; B.vy += 1500 * dt; B.y += B.vy * dt;
          if (B.y >= g) { B.y = g; Sound.play('thud'); Sound.play('zap'); W.shake = 12; burst(B.x, g, 20, 'spark', '#ff3a80', 180);
            [-1, 1].forEach(d => W.ents.push({ type: 'wave', x: B.x + d * 46, y: g, dir: d, speed: 260 * f, life: 2, t: 0, col: '#ff8ac0' })); B.stunFor = 1.4; bossSet(B, 'stun'); } }
        break;
      case 'static':
        B.tele = B.st < 0.6 / f;
        if (!B.tele && !B.done) { B.done = true; Sound.play('zap'); for (let k = -2; k <= 2; k++) spawnBoltAt(P.x + k * 115 + rand(-15, 15), true); }
        if (B.st > 1.5) { B.done = false; bossSet(B, 'idle'); }
        break;
      case 'soda':
        B.tele = B.st < 0.5 / f;
        if (!B.tele && !B.done) { B.done = true; Sound.play('spill'); [0.6, 0.8, 1.0].forEach(k => shoot(B.x + toP * 30, B.y - 60, Math.atan2(-0.6, toP), 150 + k * 110 * f, 'soda', { grav: 420, bounces: 3 })); }
        if (B.st > 1.3) { B.done = false; bossSet(B, 'idle'); }
        break;
    }
    // giant crab claw slam (own sub-state machine using B.state === 'slam')
    if (B.kind === 'crab') updateCrabClaw(B, dt, f, g);
    if (B.kind === 'glitch' && B.state !== 'teleport' && B.state !== 'enter') B.alpha = 1;
    if (B.state !== 'die' && B.state !== 'enter') bossContact(B);
  }
  function updateCrabClaw(B, dt, f, g) {
    const home = { x: B.x + B.face * 90, y: B.y - 95 };
    if (!B.claw) B.claw = { x: home.x, y: home.y };
    if (B.state === 'claw') {
      if (B.st < 0.85 / f) { B.tele = true; B.target = clamp(P.x, 160, W.def.length - 160); B.claw.x += (B.target - B.claw.x) * Math.min(1, dt * 6); B.claw.y += (g - 170 - B.claw.y) * Math.min(1, dt * 6); }
      else if (B.st < 1.0 / f) { B.tele = false; B.claw.y = Math.min(g - 14, B.claw.y + 1600 * dt); if (B.claw.y >= g - 14 && !B.slammed) { B.slammed = true; Sound.play('thud'); W.shake = 10; burst(B.claw.x, g, 18, 'bubble', '#e8fbff', 150); } }
      else { B.slammed = false; B.stunFor = 2.6; bossSet(B, 'stun'); B.clawStuck = true; }
      if (!P.dead && B.st > 0.85 / f && B.st < 1.0 / f && Math.abs(P.x - B.claw.x) < 34 && P.y > B.claw.y - 30 && P.y - P.h < B.claw.y + 20) hurt({ x: B.claw.x });
    } else if (B.clawStuck && B.state === 'stun') { /* claw stays stuck in the sand */ }
    else { B.clawStuck = false; B.claw.x += (home.x - B.claw.x) * Math.min(1, dt * 5); B.claw.y += (home.y - B.claw.y) * Math.min(1, dt * 5); }
  }
  function bossContact(B) {
    if (P.dead || W.won) return;
    const pb = playerBox(), bx = B.x - B.w / 2, by = B.y - B.h;
    if (B.kind === 'glitch' && B.alpha < 0.5) return;
    const lift = P.swim ? 18 : 0;   // underwater: a slightly taller target, and any touch on top of the dazed boss counts
    if (!overlaps(pb.x, pb.y, pb.w, pb.h, bx, by - lift, B.w, B.h + lift)) return;
    if (P.swim && B.vuln && !(B.inv > 0) && P.y - P.h * 0.5 < by + B.h * 0.5) { bossHit(B, 'stomp'); return; }
    const fromTop = P.vy > 0 && P.prevY <= by + 18;
    const fromBelow = P.vy < 0 && P.prevTop >= by + B.h - 12;
    if ((fromTop || fromBelow || P.pw.power > 0) && B.vuln && !(B.inv > 0)) { bossHit(B, fromBelow ? 'bump' : 'stomp'); return; }
    if (fromTop) { stompBounce(); P.vy = Math.min(P.vy, -420 * Math.sqrt(W.g / GRAV)); Sound.play('bonk'); burst(P.x, by, 6, 'spark', '#fff', 100); if (!B.vuln) pop(B.x, by - 20, 'Wait for it...', '#fff', 11); return; }
    if (B.vuln || P.pw.power > 0 || B.inv > 0) { P.x = P.x < B.x ? bx - P.w / 2 - 1 : bx + B.w + P.w / 2 + 1; P.vx = 0; return; }
    hurt(B);
  }
  function bossHit(B, how) {
    B.hp--; B.inv = 0.9; B.flash = 0.9;
    Sound.play('smash'); Sound.play('bonk'); W.shake = 10;
    burst(B.x, B.y - B.h, 18, 'spark', '#ffe14a', 220);
    addScore(2000, B.x, B.y - B.h - 30, how === 'bump' ? 'BONK!' : 'STOMP!');
    if (how === 'bump') P.vy = 100; else { stompBounce(); P.vy = P.swim ? -320 : -jumpVel() * 0.9; }
    B.clawStuck = false; B.tele = false; B.done = false; B.air = false; B.crouch = 0; B.scep = 0;
    if (B.hp <= 0) { bossSet(B, 'die'); Sound.play('lifelost'); banner('KO!', '', 1.6); return; }
    B.vx = (B.x < P.x ? -1 : 1) * 260; bossSet(B, 'hurt');
    pop(B.x, B.y - B.h - 50, B.hp === 1 ? 'ONE MORE HIT!' : B.hp + ' HITS LEFT', '#ff8a5a', 13);
  }
  function bossDefeated(B) {
    B.gone = true; B.state = 'gone';
    Sound.play('powerup'); Sound.play('smash');
    burst(B.x, B.y - B.h / 2, 40, 'confetti', '#ffe14a', 260); burst(B.x, B.y - B.h / 2, 30, 'spark', '#fff', 240);
    addScore(5000, B.x, B.y - B.h - 10, 'BOSS!');
    W.exit.hidden = false; burst(W.exit.x, W.exit.y - 60, 30, 'spark', '#ffe14a', 200);
    W.ents.forEach(e => { if (e.type === 'fire' || e.type === 'bolt' || e.type === 'wave') e.dead = true; if (e.type === 'bug' && e.state === 'walk') smash(e, 'bump'); });
    if (W.cage && W.cage.held) { W.cage.held = false; W.cage.fall = true; W.cage.x = clamp(W.cage.x, 140, W.def.length - 200); W.cage.vy = 0; banner('BOSS DEFEATED!', 'Free ' + D.FRIENDS[W.cage.kind].name + '!', 2.4); }
    else banner('BOSS DEFEATED!', W.def.boss === 'glitch' ? 'The portal home is open!' : 'Head for the exit!', 2.4);
  }
  function drawBoss() {
    const B = W.boss; if (!B || B.gone) return;
    const o = { t: B.t, face: B.face, flash: B.flash, tele: B.tele, dizzy: B.state === 'stun', crouch: B.crouch, scepter: B.scep, angry: B.hp < B.max };
    ctx.save();
    if (B.state === 'die') { ctx.translate(B.x, B.y - B.h / 2); ctx.rotate(Math.sin(B.st * 20) * 0.2); ctx.scale(1 - B.st * 0.2, 1 - B.st * 0.2); ctx.translate(-B.x, -(B.y - B.h / 2)); }
    // telegraph marker on the floor
    if (B.tele) { ctx.fillStyle = 'rgba(255,60,60,' + (0.3 + 0.3 * Math.sin(B.t * 30)) + ')'; D.text(ctx, '!', B.x, B.y - B.h - 34, 26, '#ff3a3a', { sw: 5 }); }
    if (B.kind === 'potato') D.potatoKing(ctx, B.x, B.y, o);
    else if (B.kind === 'thunder') D.thunderBird(ctx, B.x, B.y, Object.assign(o, { ground: B.state === 'stun' }));
    else if (B.kind === 'pigeon') D.pigeonBoss(ctx, B.x, B.y, Object.assign(o, { fly: B.state !== 'idle' && B.state !== 'stun' && B.state !== 'drop' && B.state !== 'crumbs' }));
    else if (B.kind === 'crab') {
      if (B.state === 'claw' && B.tele && B.target) { ctx.fillStyle = 'rgba(255,60,60,.35)'; D.ell(ctx, B.target, bossGround(B.target), 34, 7); ctx.fill(); }
      D.giantCrab(ctx, B.x, B.y, Object.assign(o, { claw: B.claw ? { x: B.claw.x - B.x, y: B.claw.y - B.y } : null, walk: B.walk, snap: B.tele ? Math.abs(Math.sin(B.t * 20)) : 0 }));
    }
    else if (B.kind === 'glitch') D.glitch(ctx, B.x, B.y, Object.assign(o, { alpha: B.alpha }));
    ctx.restore();
  }
  function drawHeldCage(t) {
    const C = W.cage; if (!C || (!C.held && !C.fall)) return false;
    const B = W.boss;
    if (C.held && B) {
      if (B.kind === 'pigeon') { C.x = 250; C.y = 244; ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(250, 130); ctx.lineTo(250, 178); ctx.stroke(); ctx.fillStyle = '#888'; ctx.fillRect(244, 172, 12, 8); }
      else if (B.kind === 'crab') { C.x = B.x - B.face * 70; C.y = B.y - 70; }
      else { C.x = B.x - B.face * 10; C.y = Math.min(B.y + 75, bossGround(B.x) - 2); }
    }
    D.friendCage(ctx, C.kind, C.x, C.y, t, 0);
    return true;
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
    for (const b of W.birdTriggers) if (!b.done && P.x >= b.x) { b.done = true; spawnBird(b.skin); }
    // rock zones
    const inRockZone = W.def.rocks.some(([a, b]) => P.x > a && P.x < b);
    if (inRockZone && !P.dead) { W.rockT -= dt; if (W.rockT <= 0) { spawnRock(); W.rockT = W.def.rockRate ? rand(W.def.rockRate[0], W.def.rockRate[1]) : rand(1.1, 2.2); } }
    // power-up orbs fly in at random
    W.powerT -= dt;
    if (W.powerT <= 0) {
      if (!W.ents.some(e => e.type === 'orb')) spawnPower();
      W.powerT = rand(W.def.power.min, W.def.power.max);
    }
    if (W.def.trains.length) updateTrains(dt);
    updateBoss(dt);
    updateEnts(dt);
    // exit
    const Cg = W.cage;
    if (Cg) {
      if (Cg.fall) { Cg.vy += 900 * dt; Cg.y += Cg.vy * dt; const gy = W.def.boss === 'crab' ? 400 : (surfaceAt(Cg.x, true) || 300); if (Cg.y >= gy) { Cg.y = gy; Cg.fall = false; Sound.play('thud'); burst(Cg.x, gy, 10, 'dust', '#e8dcc0', 90); } }
      const near = W.boss ? (!Cg.held && !Cg.fall && Math.abs(P.x - Cg.x) < 46 && Math.abs(P.y - Cg.y) < 110) : (P.x > Cg.x - 26 && Math.abs(P.y - Cg.y) < 160);
      if (!Cg.freed && !P.dead && near) {
        Cg.freed = true; Sound.play('powerup'); Sound.play('boing');
        const F = D.FRIENDS[Cg.kind];
        burst(Cg.x, Cg.y - 34, 26, 'spark', 'rgb(' + F.glow + ')', 220); burst(Cg.x, Cg.y - 34, 10, 'confetti', '#ffe14a', 160);
        addScore(1000, Cg.x, Cg.y - 80, F.name + ' rescued!');
        banner(F.name.toUpperCase() + ' RESCUED!', 'Your friend will follow you now', 2.4);
      }
      if (Cg.freed) Cg.open = Math.min(1, Cg.open + dt * 2.5);
    }
    const X = W.exit;
    if (!X.hidden && !P.dead && !W.won && Math.abs(P.x - X.x) < (X.kind === 'submarine' ? 50 : 34) && P.y > X.y - 140) win();
    for (const s of W.solids) if (s.bump > 0) s.bump = Math.max(0, s.bump - dt * 5);
    // particles
    for (const p of W.parts) {
      p.life += dt;
      if (p.kind === 'feather' || p.kind === 'leaf') { D.ell(ctx, p.x, p.y, p.size * 1.6, p.size * 0.6, p.rot); ctx.fill(); }
      else if (p.kind === 'bubble') { ctx.strokeStyle = p.col; ctx.lineWidth = 1.2; D.circ(ctx, p.x, p.y, p.size); ctx.stroke(); }
      else if (p.kind === 'confetti') { p.vy += 300 * dt; p.vx *= 0.98; }
      else if (p.kind === 'dust') { p.vx *= 0.9; p.vy *= 0.9; p.vy -= 20 * dt; }
      else if (p.kind === 'bubble') { p.vx *= 0.92; p.vy = p.vy * 0.92 - 40 * dt; p.x += Math.sin(p.life * 8 + p.rot) * 0.4; p.max = Math.max(p.max, 1.1); }
      else if (p.kind === 'leaf') { p.vx *= 0.96; p.vy = p.vy * 0.95 + 6; p.x += Math.sin(p.life * 6 + p.rot) * 0.6; p.max = Math.max(p.max, 0.9); }
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
    // deep water: camera follows Tubby down (never above the normal view)
    const maxY = W.def.seabed ? Math.max(...W.def.seabed.map(b => b[2])) + 20 - VH : 0;
    const ty = W.def.boss === 'crab' ? maxY : clamp(P.y - 230, 0, maxY);
    W.camY += (ty - W.camY) * Math.min(1, dt * 5);
  }

  function win() {
    W.won = true;
    Sound.playMusic('complete');
    P.vx = 0; P.vy = -400; P.onGround = false;
    for (let i = 0; i < 60; i++) W.parts.push({ x: W.exit.x + rand(-80, 80), y: rand(40, 140), vx: rand(-60, 60), vy: rand(-120, 20), life: 0, max: rand(1.5, 2.5), kind: 'confetti', col: ['#ff5fa0', '#ffe14a', '#8af05a', '#5ec8ff', '#b65cff'][i % 5], size: rand(3, 5), rot: rand(0, 6), vr: rand(-10, 10) });
    const timeLeft = Math.floor(W.time);
    const levelPts = G.score - G.levelStartScore;
    const bonus = timeLeft * 100;
    G.score += bonus;
    const newHigh = G.score > save.high;
    if (newHigh) save.high = G.score;
    const id = W.def.id, pts = G.score - G.levelStartScore;
    const stars = 1 + (timeLeft >= (W.def.boss ? 200 : 150) ? 1 : 0) + (G.levelHurt ? 0 : 1);
    save.nodes = save.nodes || {};
    const prev = save.nodes[id] || { stars: 0, best: 0 };
    save.nodes[id] = { stars: Math.max(prev.stars, stars), best: Math.max(prev.best, pts) };
    save.lastNode = Math.min(window.LEVELS.length - 1, G.levelIdx + 1);

    persist();
    G.result = { levelPts, timeLeft, bonus, total: G.score, newHigh, stars };
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
    let act = uiAction();
    if (act === 'mute') { Sound.toggleMute(); }
    switch (G.state) {
      case 'title':
        Sound.playMusic('title');
        if (act === 'play' || (act === null && anyTap() && G.stateT > 0.3 && Input.taps.every(tp => !(tp.x > VW - 60 && tp.y < 60)))) {
          Sound.play('click'); tryFullscreen();
          if (!save.storySeen) { G.storyThen = 'play'; setState('story'); }
          else if (nextStage() > 0) { G.score = 0; G.levelStartScore = 0; G.mapSel = G.mapPos = nextStage(); startLevel(G.mapSel, true); }
          else startRunoff();
        }
        if (act === 'levels') { Sound.play('click'); tryFullscreen(); G.mapSel = G.mapPos = nextStage(); setState('levels'); }
        if (act === 'story') { Sound.play('click'); tryFullscreen(); G.storyThen = 'title'; setState('story'); }
        break;
      case 'story':
        if (G.stateT < 0.05) G.storyLastT = undefined;
        if (G.stateT > STORY_LEN || (G.stateT > 0.4 && anyTap())) {
          save.storySeen = true; persist();
          if (G.storyThen === 'play') startRunoff(); else setState('title');
        }
        break;
      case 'runoff':
        if (W) W.t += dt;
        if (P) { P.run += dt * 210 * 0.09; P.blinkT = 9; }
        if (G.stateT > RUNOFF_LEN || (G.stateT > 0.25 && anyTap())) { P.x = 60; P.y = surfaceAt(60); P.vx = 0; P.run = 0; W.camX = 0; setState('intro'); }
        break;
      case 'levels':
        Sound.playMusic('title');
        if (G.stateT < 0.05 && G.mapSel === undefined) { G.mapSel = nextStage(); G.mapPos = G.mapSel; }
        G.mapPos = approach(G.mapPos, G.mapSel, dt * 6);
        if (act && act.startsWith('node_')) {
          const i = +act.slice(5);
          if (!isUnlocked(i)) { Sound.play('deny'); G.lockMsg = { i, t: 1.8 }; act = null; }
          else { Sound.play('click');
          if (i === G.mapSel && Math.abs(G.mapPos - i) < 0.05) act = 'play'; else G.mapSel = i; }
        }
        if (G.lockMsg && (G.lockMsg.t -= dt) <= 0) G.lockMsg = null;
        if (act === 'kleft') G.mapSel = Math.max(0, G.mapSel - 1);
        if (act === 'kright') G.mapSel = Math.min(maxUnlocked(), G.mapSel + 1);
        if (act === 'play' && isUnlocked(G.mapSel)) { Sound.play('click'); G.score = 0; G.levelStartScore = 0; G.mapPos = G.mapSel; startLevel(G.mapSel, true); }
        if (act === 'back') { Sound.play('click'); setState('title'); }
        break;
      case 'mapwalk':
        G.mapPos = Math.min(G.mapTo, G.mapFrom + Math.max(0, G.stateT - 0.3) / 1.1);
        if (G.stateT > 3.2 || (G.stateT > 0.6 && anyTap() && !(act === 'mute'))) { G.mapSel = G.mapTo; G.mapPos = G.mapTo; G.levelStartScore = G.score; startLevel(G.mapTo, true); }
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
        if (act === 'next' || act === 'finish') { Sound.play('click'); goNext(); }
        if (act === 'replay') { Sound.play('click'); G.score = G.levelStartScore; startLevel(G.levelIdx, true); }
        if (act === 'menu') { Sound.play('click'); setState('title'); }
        break;
      case 'cutscene':
        if (G.stateT > (G.cut >= 5 ? 7 : CUT_LEN) || (G.stateT > 0.5 && (anyTap() || act))) endCutscene();
        break;
      case 'victory':
        if (Math.random() < 0.4) victoryConfetti();
        for (const c of G.confetti) { c.vy += 200 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt; }
        G.confetti = G.confetti.filter(c => c.y < VH + 20);
        if (act === 'again') { Sound.play('click'); G.mapSel = G.mapPos = 0; setState('levels'); }
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
  const CUT_LEN = 4.6;
  function goNext() {
    const LV = window.LEVELS, i = G.levelIdx, n = i + 1;
    if (n >= LV.length || LV[n].world !== LV[i].world) { G.cut = n >= LV.length ? 5 : LV[n].world; setState('cutscene'); Sound.play('powerup'); }
    else { G.mapFrom = i; G.mapTo = n; G.mapPos = i; G.mapSel = n; setState('mapwalk'); Sound.playMusic('title'); }
  }
  function endCutscene() {
    G.mapSel = G.mapPos = Math.min(G.cut * 3, window.LEVELS.length - 1);
    if (G.cut >= 5) { save.beaten = true; persist(); G.confetti = []; setState('victory'); Sound.playMusic('victory'); }
    else { G.levelStartScore = G.score; startLevel(G.cut * 3, true); }
  }
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
      case 'runoff': renderRunoff(); break;
      case 'story': renderStory(); break;
      case 'cutscene': renderCutscene(); break;
      case 'levels': renderMap('select'); break;
      case 'mapwalk': renderMap('walk'); break;
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
  function heroPose(x, y, t, o) {
    D.tubby(ctx, x, y, Object.assign({ face: 1, sx: 1, sy: 1, run: t * 14, speed: 1, ground: true, t, blink: (t % 3.3) < 0.12 }, o || {}));
  }

  function renderTitle() {
    const t = G.t;
    menuBackground(t * 60);
    D.logo(ctx, VW / 2, 92, Math.min(1.5, VW / 520), t);
    D.text(ctx, 'Starring Tubby Dash', VW / 2, 146, 15, '#fff', { sw: 4 });
    const hop = Math.abs(Math.sin(t * 5)) * 16;
    ctx.fillStyle = 'rgba(0,0,0,.15)'; D.ell(ctx, VW / 2, 301, 30 - hop * 0.6, 5); ctx.fill();
    heroPose(VW / 2, 300 - hop, t, { scale: 1.6, ground: hop < 2, air: hop > 2, run: t * 16, sy: hop < 2 ? 0.92 : 1.04, sx: hop < 2 ? 1.08 : 0.97 });
    const pulse = 1 + Math.sin(t * 5) * 0.06;
    ctx.save(); ctx.translate(VW / 2, 200); ctx.scale(pulse, pulse);
    D.text(ctx, Input.touchUsed ? 'TAP TO PLAY' : 'CLICK OR PRESS ENTER', 0, 0, 24, '#ffde3a', { sw: 6 });
    ctx.restore();
    uiBtns.push({ id: 'play', x: VW / 2 - 140, y: 180, w: 280, h: 44, primary: true });
    if (save.high > 0) D.text(ctx, 'HIGH SCORE ' + save.high, VW / 2, 338, 14, '#fff', { sw: 4 });
    D.text(ctx, 'Created by Walker Games', VW / 2, VH - 8, 10, 'rgba(255,255,255,.9)', { sw: 3 });
    button('levels', 14 + SAFE_L, VH - 50, 110, 38, 'MAP', { col: ['#9fd2ff', '#4a9bf0'], size: 14 });
    button('story', VW - 124 - SAFE_R, VH - 50, 110, 38, 'STORY', { col: ['#ff9ab8', '#e0306e'], size: 14 });
    iconButton('mute', VW - 30 - SAFE_R, 28, 17, muteIcon);
  }
  // Seamless start: Tubby dashes off the title, the title slides away and Level 1 fades in under him.
  const RUNOFF_LEN = 1.8;
  function startRunoff() {
    G.score = 0; G.levelStartScore = 0;
    G.titleScroll = G.t * 60;
    startLevel(0, true);           // builds Level 1 + crossfades title music into the L1 theme
    G.state = 'runoff'; G.stateT = 0;
    P.x = -40;
  }
  function renderRunoff() {
    const k = G.stateT, t = G.t, ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
    const out = ease(k / 0.9), fadeIn = ease((k - 0.7) / 0.6);
    G.titleScroll += out * 9;
    const hx = VW / 2 + Math.pow(Math.min(1, k / 0.85), 2) * (VW / 2 + 90);
    if (fadeIn > 0) { P.x = -40 + ease((k - 0.9) / 0.85) * 100; renderWorld(); if (fadeIn >= 1) renderHUD(); }
    if (fadeIn < 1) {
      ctx.save(); ctx.globalAlpha = 1 - fadeIn; menuBackground(G.titleScroll); ctx.restore();
      // title slides up and away
      ctx.save(); ctx.globalAlpha = 1 - out; ctx.translate(0, -out * 220);
      D.logo(ctx, VW / 2, 92, Math.min(1.5, VW / 520), t);
      D.text(ctx, 'Starring Tubby Dash', VW / 2, 146, 15, '#fff', { sw: 4 });
      ctx.restore();
      // Tubby dashes right with dust
      if (k < 0.85) {
        ctx.fillStyle = 'rgba(255,255,255,.6)';
        for (let i = 1; i < 5; i++) { D.circ(ctx, hx - 30 * i - 10, 296 - (i % 2) * 6, 7 - i); ctx.fill(); }
        heroPose(hx, 300, t, { scale: 1.6, run: t * 30, speed: 2, sx: 1.08, sy: 0.95 });
      }
    }
    if (k > 0.25) D.text(ctx, 'TAP TO SKIP ▶', VW / 2, VH - 14, 11, 'rgba(255,255,255,.85)', { sw: 3 });
  }

  // ---------- world map (level select + quick walk between stages) ----------
  function mapPos(i) {
    const x0 = 22 + SAFE_L, x1 = VW - 22 - SAFE_R, rw = (x1 - x0) / 5, w = Math.floor(i / 3), st = i % 3;
    return { x: x0 + w * rw + rw * (0.2 + st * 0.3), y: 186 + Math.sin(i * 1.15 + 0.4) * 52 + (st === 2 ? -6 : 0) };
  }
  function mapLerp(f) {
    const n = window.LEVELS.length - 1; f = clamp(f, 0, n);
    const a = Math.floor(f), b = Math.min(n, a + 1), k = f - a, A = mapPos(a), Bp = mapPos(b);
    return { x: A.x + (Bp.x - A.x) * k, y: A.y + (Bp.y - A.y) * k };
  }
  const nodeInfo = L => (save.nodes && save.nodes[L.id]) || null;
  function renderMap(mode) {
    const t = G.t, LV = window.LEVELS;
    const sky = ctx.createLinearGradient(0, 0, 0, VH); sky.addColorStop(0, '#3f7fd8'); sky.addColorStop(1, '#9fd8ff');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, VW, VH);
    const x0 = 22 + SAFE_L, x1 = VW - 22 - SAFE_R, rw = (x1 - x0) / 5;
    window.WORLDS.forEach((Wd, w) => {
      const th = window.THEMES[Wd.theme], rx = x0 + w * rw + 3, ry = 46, rh = 250;
      const g = ctx.createLinearGradient(0, ry, 0, ry + rh); g.addColorStop(0, th.card[0]); g.addColorStop(1, th.card[1]);
      ctx.fillStyle = 'rgba(20,30,60,.3)'; D.rr(ctx, rx, ry + 4, rw - 6, rh, 16); ctx.fill();
      ctx.fillStyle = g; D.rr(ctx, rx, ry, rw - 6, rh, 16); ctx.fill();
      ctx.save(); D.rr(ctx, rx, ry, rw - 6, rh, 16); ctx.clip();
      const bx = rx, by = ry + rh, cw = rw - 6;
      if (w === 0) { ctx.fillStyle = '#4fb04a'; for (let i = 0; i < 4; i++) { D.circ(ctx, bx + i * cw / 3, by + 6, 34); ctx.fill(); } ctx.fillStyle = '#3a2a3a'; D.ell(ctx, bx + cw * 0.75, by - 30, 18, 14); ctx.fill(); }
      if (w === 1) { ctx.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 5; i++) { D.circ(ctx, bx + i * cw / 4, by - 4 + (i % 2) * 8, 22); ctx.fill(); } ctx.fillStyle = '#7a7aa8'; ctx.beginPath(); ctx.moveTo(bx + cw * 0.2, by - 20); ctx.lineTo(bx + cw * 0.4, by - 80); ctx.lineTo(bx + cw * 0.6, by - 20); ctx.fill(); }
      if (w === 2) { ctx.fillStyle = 'rgba(70,50,110,.7)'; for (let i = 0; i < 6; i++) ctx.fillRect(bx + i * cw / 6, by - 30 - window.hash01(i) * 60, cw / 6 - 4, 100); }
      if (w === 3) { ctx.fillStyle = 'rgba(30,90,180,.7)'; ctx.fillRect(bx, by - 40, cw, 40); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = 0; x <= cw; x += 6) ctx.lineTo(bx + x, by - 40 + Math.sin(x * 0.2 + t * 3) * 3); ctx.stroke(); }
      if (w === 4) { for (let i = 0; i < 18; i++) { ctx.fillStyle = 'rgba(255,255,255,' + (0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i))) + ')'; ctx.fillRect(bx + window.hash01(i + 5) * cw, ry + window.hash01(i + 9) * rh, 2, 2); } ctx.fillStyle = '#c9c3e0'; D.circ(ctx, bx + cw * 0.7, by - 10, 40); ctx.fill(); }
      ctx.restore();
      D.text(ctx, 'WORLD ' + (w + 1), rx + cw / 2, ry + 14, 10, '#ffde3a', { sw: 3 });
      D.text(ctx, Wd.name.toUpperCase(), rx + cw / 2, ry + 29, Math.min(12, cw / 9), '#fff', { sw: 3 });
    });
    // path
    ctx.lineCap = 'round';
    for (let i = 0; i < LV.length - 1; i++) {
      const A = mapPos(i), Bp = mapPos(i + 1), done = !!nodeInfo(LV[i]);
      ctx.strokeStyle = 'rgba(20,30,60,.45)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(Bp.x, Bp.y); ctx.stroke();
      ctx.strokeStyle = done ? '#ffd21f' : '#fff6d8'; ctx.lineWidth = 4; ctx.setLineDash(done ? [] : [6, 6]); ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(Bp.x, Bp.y); ctx.stroke(); ctx.setLineDash([]);
    }
    const sel = mode === 'walk' ? G.mapTo : G.mapSel;
    LV.forEach((L, i) => {
      const p = mapPos(i), info = nodeInfo(L);
      D.mapNode(ctx, p.x, p.y, { label: L.id, boss: !!L.boss, done: !!info, locked: !isUnlocked(i), stars: info ? info.stars : 0, sel: i === sel, t });
      uiBtns.push({ id: 'node_' + i, x: p.x - 22, y: p.y - 22, w: 44, h: 50 });
    });
    // Tubby (and friends) walking along the path
    const pos = mapLerp(G.mapPos), moving = Math.abs(G.mapPos - sel) > 0.01;
    const face = sel >= G.mapPos ? 1 : -1;
    friendsBefore(Math.max(Math.round(G.mapPos), sel)).forEach((k, i) => {
      const q = mapLerp(G.mapPos - face * (0.22 + i * 0.2));
      D.friend(ctx, k, q.x, q.y - 12 - (moving ? Math.abs(Math.sin(t * 12 + i)) * 3 : 0), { t, face, run: t * 14, speed: moving ? 1 : 0, ground: true, scale: 0.42, glow: 0.4 });
    });
    D.tubby(ctx, pos.x, pos.y - 14 - (moving ? Math.abs(Math.sin(t * 12)) * 4 : Math.abs(Math.sin(t * 4)) * 2), { t, face, run: t * 14, speed: moving ? 1 : 0, ground: true, scale: 0.62, blink: (t % 3) < 0.1 });
    D.text(ctx, 'WORLD MAP', VW / 2, 24, 22, '#ffde3a', { sw: 6 });
    iconButton('mute', VW - 30 - SAFE_R, 24, 15, muteIcon);
    // info bar
    const L = LV[sel], info = nodeInfo(L);
    ctx.fillStyle = 'rgba(20,30,60,.6)'; D.rr(ctx, VW / 2 - 190, VH - 54, 380, 44, 14); ctx.fill();
    D.text(ctx, L.id + '  ' + L.name.toUpperCase(), VW / 2 - 70, VH - 40, 14, '#fff', { sw: 3 });
    D.text(ctx, info ? 'BEST ' + info.best : (L.boss ? 'BOSS STAGE' : 'NEW!'), VW / 2 - 70, VH - 22, 11, info ? '#ffde3a' : '#8af05a', { sw: 3 });
    if (G.lockMsg && mode !== 'walk') { const a = Math.min(1, G.lockMsg.t * 3), q = mapPos(G.lockMsg.i); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(20,30,60,.85)'; D.rr(ctx, clamp(q.x - 110, 6, VW - 226), q.y - 58, 220, 28, 10); ctx.fill(); D.text(ctx, 'Beat the previous level first', clamp(q.x, 116, VW - 116), q.y - 44, 12, '#fff', { sw: 3 }); ctx.globalAlpha = 1; }
    for (let i = 0; i < 3; i++) { ctx.fillStyle = info && i < info.stars ? '#ffd21f' : 'rgba(255,255,255,.3)'; D.star(ctx, VW / 2 + 40 + i * 20, VH - 32, 8, 0); ctx.fill(); }
    if (mode === 'walk') {
      const p = 0.5 + 0.5 * Math.sin(t * 6);
      D.text(ctx, G.stateT > 1.4 ? 'TAP TO START!' : 'Walking...', VW / 2 + 130, VH - 32, 13, 'rgba(255,255,255,' + (0.6 + p * 0.4) + ')', { sw: 3 });
    } else {
      button('play', VW / 2 + 106, VH - 52, 80, 40, 'PLAY', { primary: true, size: 16 });
      button('back', 14 + SAFE_L, VH - 50, 90, 38, '◀ BACK', { col: ['#9fd2ff', '#4a9bf0'], size: 14 });
    }
  }
  function exitIcon(kind, x, y, t) {
    ctx.save(); ctx.translate(x, y);
    if (kind === 'tree') { ctx.scale(0.32, 0.32); D.tree(ctx, 0, 70, 1, t, true); }
    else if (kind === 'rainbow') { ctx.scale(0.36, 0.36); D.rainbowExit(ctx, -70, 30, t); }
    else if (kind === 'pier') { ctx.scale(0.5, 0.5); D.pierExit(ctx, 0, 50, t); }
    else if (kind === 'submarine') { ctx.scale(0.62, 0.62); D.submarine(ctx, 0, 24, t, 0); }
    else { ctx.scale(0.42, 0.42); D.portal(ctx, 0, 70, t); }
    ctx.restore();
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
    D.text(ctx, 'Tubby Dash rescued his friends and made it home!', VW / 2, 92, 16, '#fff', { sw: 4 });
    D.text(ctx, 'FINAL SCORE  ' + G.score, VW / 2, 124, 22, '#8af05a', { sw: 5 });
    D.text(ctx, 'Created by Walker Games - thanks for playing!', VW / 2, 172, 11, '#fff', { sw: 3 });
    D.text(ctx, G.score >= save.high ? '★ NEW HIGH SCORE ★' : 'HIGH SCORE ' + save.high, VW / 2, 150, 13, '#fff', { sw: 3 });
    const hop = Math.abs(Math.sin(t * 6)) * 34;
    ctx.fillStyle = 'rgba(0,0,0,.15)'; D.ell(ctx, VW / 2, 301, 34 - hop * 0.5, 5); ctx.fill();
    FRIEND_KEYS.forEach((k, i) => {
      const hx = VW / 2 + [-150, 110, 190][i], hh = Math.abs(Math.sin(t * (k === 'pipple' ? 8 : 5) + i * 1.3)) * (k === 'pipple' ? 40 : 22);
      ctx.fillStyle = 'rgba(0,0,0,.15)'; D.ell(ctx, hx, 301, 24, 4); ctx.fill();
      D.friend(ctx, k, hx, 300 - hh, { t, scale: 1.5, air: hh > 2, ground: hh <= 2, glow: 0.7, face: i === 0 ? 1 : -1, blink: ((t + i) % 3.2) < 0.1 });
    });
    heroPose(VW / 2 - 30, 300 - hop, t, { scale: 1.8, ground: hop < 2, air: hop > 2, sy: hop < 3 ? 0.9 : 1.05, sx: hop < 3 ? 1.1 : 0.97 });
    D.portal(ctx, VW - 70 - SAFE_R, 300, t);
    D.tree(ctx, 80 + SAFE_L, 300, 1, t, true);
    button('again', VW / 2 - 170, VH - 46, 160, 38, 'PLAY AGAIN', { primary: true, size: 15 });
    button('menu', VW / 2 + 10, VH - 46, 160, 38, 'MENU', { col: ['#ff9ab8', '#e0306e'], size: 15 });
  }

  function renderWorld() {
    const t = W.t;
    if (W.camY > 0.5) {   // deep water: scroll the backdrop up with the camera and fill below with deep sea
      ctx.save(); ctx.translate(0, -W.camY); W.theme.background(ctx, W.camX, VW, VH, t); ctx.restore();
      ctx.fillStyle = '#1a5fb0'; ctx.fillRect(0, VH - W.camY - 1, VW, W.camY + 2);
    } else W.theme.background(ctx, W.camX, VW, VH, t);
    ctx.save();
    const sh = W.shake;
    ctx.translate(-Math.round(W.camX * 10) / 10 + (sh ? rand(-sh, sh) : 0), -Math.round(W.camY * 10) / 10 + (sh ? rand(-sh, sh) * 0.6 : 0));
    const L = W.camX - 60, R = W.camX + VW + 60;
    if (W.def.sunken) D.sunkenShip(ctx, 520, 520);
    if (W.def.boss === 'pigeon') D.crane(ctx, 900, 300, 133, 60, t);
    // solids
    for (const s of W.solids) {
      if (s.x > R || s.x + s.w < L) continue;
      switch (s.kind) {
        case 'crumble': if (!s.off) D.crumble(ctx, s, t); break;
        case 'track': D.track(ctx, s, L, R, VH); break;
        case 'cloud': if (!s.off) D.cloudPlatform(ctx, s.x, s.y, s.w, s.h, s.style, s.alpha * (s.style === 'fade' && s.standT > 0 ? (0.6 + 0.4 * Math.abs(Math.sin(t * 25))) : 1), t, s.squash); break;
        case 'ground': drawGround(s); break;
        case 'block': drawBlock(s); break;
        case 'roof': D.building(ctx, s, L, R, VH, t); break;
        case 'ac': D.acUnit(ctx, s, s.y - Math.sin(s.bump * Math.PI) * 6); break;
        case 'dock': D.dock(ctx, s, VH + W.camY); break;
        case 'log': D.log(ctx, s); break;
        case 'sand': D.sand(ctx, s, L, R, VH + W.camY); break;
        case 'coral': D.coral(ctx, s, t); break;
        case 'moon': D.moonRock(ctx, s, L, R, VH, false); break;
        case 'asteroid': { const by = s.y - Math.sin(s.bump * Math.PI) * 6; D.moonRock(ctx, Object.assign({}, s, { y: by }), L, R, VH, true); break; }
      }
    }
    // subway trains pass under the walkways
    for (const e of W.ents) if (e.type === 'train') D.train(ctx, e.x, 300, e.w, t);
    for (const s of W.solids) if (s.kind === 'walk' && s.x < R && s.x + s.w > L) D.walkway(ctx, s);
    for (const d of W.decor) if (d.x > L && d.x < R) W.theme.decor(ctx, d, t);
    // the level exit
    const X = W.exit;
    if (!X.hidden && X.x > L - 200 && X.x < R + 200) drawExit(X, t);
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
        case 'bug': drawBug(e); break;
        case 'snake': D.snake(ctx, e.x, e.y, { t: e.t, headY: e.headY, open: e.open, dir: -1 }); break;
        case 'bird':
          if (e.skin === 'bat') D.bat(ctx, e.x, e.y, { dir: -1, t: e.t });
          else if (e.skin === 'ufo') D.ufo(ctx, e.x, e.y, { t: e.t, beam: e.beam });
          else D.bird(ctx, e.x, e.y, { dir: -1, t: e.t, pal: D.BIRD_PAL[e.skin] });
          break;
        case 'orb': D.powerOrb(ctx, e.x, e.y, e.kind, e.t); break;
        case 'fish': if (e.active) D.fish(ctx, e.x, e.y, { dir: -1, t: e.t }); break;
        case 'jelly': D.jelly(ctx, e.x, e.y, { t: e.t }); break;
        case 'eel': D.eelHole(ctx, e.x, e.y); if (e.ext > 0.02) D.eel(ctx, e.x, e.y, e.ext, e.t, false); else if (e.phase === 'warn') { ctx.fillStyle = '#ff3a3a'; D.circ(ctx, e.x - 3, e.y - 2, 2.2); ctx.fill(); D.circ(ctx, e.x + 3, e.y - 2, 2.2); ctx.fill(); } break;
        case 'wave': {
          const a = Math.min(1, e.life);
          ctx.fillStyle = e.col ? 'rgba(255,120,190,' + a * 0.8 + ')' : 'rgba(230,210,170,' + a * 0.9 + ')';
          ctx.beginPath(); ctx.moveTo(e.x - 16, e.y); ctx.quadraticCurveTo(e.x, e.y - 30, e.x + 16, e.y); ctx.fill();
          break;
        }
        case 'bolt':
          if (e.glitch) {
            if (e.state === 'warn') { const k = 1 - e.warn / 0.8; ctx.fillStyle = 'rgba(255,60,140,' + (0.1 + 0.25 * k * (0.5 + 0.5 * Math.sin(W.t * 30))) + ')'; ctx.fillRect(e.x - 12, 0, 24, e.groundY); }
            else { const a = Math.max(0, 1 - e.strike / 0.35); for (let y = 0; y < e.groundY; y += 10) { ctx.fillStyle = ['rgba(255,40,120,', 'rgba(40,230,255,', 'rgba(255,255,255,'][(y / 10 | 0) % 3] + a + ')'; ctx.fillRect(e.x - 8 + Math.sin(y + W.t * 50) * 5, y, 16, 9); } }
            break;
          }
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
    drawBoss();
    if (W.cage && !drawHeldCage(t) && W.cage.open < 1) D.friendCage(ctx, W.cage.kind, W.cage.x, W.cage.y, t, W.cage.open);
    drawFollowers(t);
    drawPlayer();
    for (const e of W.ents) {
      if (e.type === 'fire') { if (e.skin) drawShot(e); else if (e.laser) D.laser(ctx, e.x, e.y, e.t); else D.fireball(ctx, e.x, e.y, e.t); }
      else if (e.type === 'rock' && e.state === 'fall') {
        if (e.skin === 'pot') D.pot(ctx, e.x, e.y, e.r, e.rot);
        else if (e.skin === 'meteor') D.meteor(ctx, e.x, e.y, e.r, e.pts, e.rot, W.t);
        else D.rock(ctx, e.x, e.y, e.r, e.pts, e.rot);
      }
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
    drawWater(L, R, t);
    ctx.restore();
    // dark caves: only a pool of light around Tubby
    if (W.def.dark) {
      const sx = P.x - W.camX, sy = P.y - 24 - W.camY;
      const g = ctx.createRadialGradient(sx, sy, 70, sx, sy, 300);
      g.addColorStop(0, 'rgba(8,4,16,0)'); g.addColorStop(0.55, 'rgba(8,4,16,.55)'); g.addColorStop(1, 'rgba(8,4,16,.88)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    }
    // subway: incoming-train warning
    if (W.trainWarn > 0) {
      const blink = Math.sin(G.t * 18) > 0, x = VW - 120 - SAFE_R;
      ctx.fillStyle = blink ? 'rgba(255,60,60,.85)' : 'rgba(255,210,30,.85)'; D.rr(ctx, x - 64, 236, 128, 34, 10); ctx.fill();
      ctx.strokeStyle = '#1b2a4a'; ctx.lineWidth = 2; ctx.stroke();
      D.text(ctx, '◀ TRAIN! GET UP!', x, 253, 13, '#fff', { sw: 3 });
    }
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

  function drawShot(e) {
    const k = e.skin;
    if (k === 'feather') { ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(Math.atan2(e.vy, e.vx)); ctx.fillStyle = '#ffe680'; D.ell(ctx, 0, 0, 12, 4); ctx.fill(); ctx.strokeStyle = '#d07a00'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.stroke(); ctx.restore(); }
    else if (k === 'bubble') { ctx.strokeStyle = 'rgba(230,250,255,.95)'; ctx.lineWidth = 2; D.circ(ctx, e.x, e.y, 9 + Math.sin(e.t * 8)); ctx.stroke(); ctx.fillStyle = 'rgba(200,240,255,.35)'; ctx.fill(); ctx.fillStyle = '#fff'; D.circ(ctx, e.x - 3, e.y - 3, 2); ctx.fill(); }
    else if (k === 'crumb') { ctx.fillStyle = '#d8a45a'; ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.t * 8); D.rr(ctx, -7, -5, 14, 10, 3); ctx.fill(); ctx.fillStyle = '#f2cf8a'; ctx.fillRect(-4, -3, 8, 3); ctx.restore(); }
    else if (k === 'soda') { ctx.fillStyle = '#7a3a12'; D.circ(ctx, e.x, e.y, 8); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.8)'; D.circ(ctx, e.x - 3, e.y - 3, 2); ctx.fill(); D.circ(ctx, e.x + 4, e.y - 6, 1.5); ctx.fill(); }
  }
  function drawBug(e) {
    const sk = e.skin, o = { dir: e.dir, t: e.active ? e.t : 0, flat: e.state === 'flat' ? Math.min(1, e.flatT * 8) : 0, roll: e.t * e.speed / 15 * e.dir };
    const fn = sk === 'trash' ? D.trashcan : sk === 'crab' ? D.crab : sk === 'alien' ? D.alien : D.potato;
    if (e.state === 'bumped') { ctx.save(); ctx.translate(e.x, e.y - e.h / 2); ctx.scale(1, -1); fn(ctx, 0, e.h / 2, o); ctx.restore(); }
    else fn(ctx, e.x, e.y, o);
  }
  function drawFollowers(t) {
    const list = friendsWith(), H = W.hist;
    if (!H || !H.length) return;
    list.forEach((k, i) => {
      const h = H[Math.max(0, H.length - 1 - (i + 1) * 9)];
      const just = W.cage && W.cage.kind === k && W.cage.open < 1;
      const x = just ? W.cage.x + (h.x - W.cage.x) * W.cage.open : h.x - h.f * (24 + i * 24);
      const y = just ? W.cage.y - 30 * Math.sin(W.cage.open * Math.PI) : h.y;
      const sp = Math.min(1, h.s);
      D.friend(ctx, k, x, y, { t, face: h.f, run: t * 14, speed: sp, ground: h.g, air: !h.g, glow: 0.25 + sp * 0.75, blink: ((t + i) % 3.1) < 0.1, roll: k === 'squib' && sp > 0.5 && (Math.floor(t * 0.7) % 2 === 0) ? (t * 12 % (Math.PI * 2)) * h.f : 0 });
    });
  }
  function drawExit(X, t) {
    if (X.kind === 'flag') D.goalFlag(ctx, X.x, X.y, t);
    else if (X.kind === 'tree') { D.tree(ctx, X.x, X.y, 1, t, true); D.sign(ctx, X.x - 80, X.y, 'GOAL!'); }
    else if (X.kind === 'rainbow') { D.rainbowExit(ctx, X.x, X.y, t); D.sign(ctx, X.x - 70, X.y, 'GOAL!'); }
    else if (X.kind === 'pier') D.pierExit(ctx, X.x, X.y, t);
    else if (X.kind === 'submarine') D.submarine(ctx, X.x, X.y + Math.sin(t * 2) * 3, t, Math.sin(t * 1.5) * 0.04);
    else if (X.kind === 'portal') { D.portal(ctx, X.x, X.y, t); D.sign(ctx, X.x - 80, X.y, 'HOME!'); }
    else if (X.kind === 'rocket') { D.rocket(ctx, X.x, X.y, t, 0); D.sign(ctx, X.x - 70, X.y, 'GOAL!'); }
    // pulsing marker
    const a = 0.5 + 0.5 * Math.sin(t * 5);
    ctx.fillStyle = 'rgba(255,240,120,' + (0.25 + a * 0.35) + ')';
    D.star(ctx, X.x, X.y - 130 - a * 6, 9, t); ctx.fill();
  }
  function drawWater(L, R, t) {
    if (!W.def.water.length) return;
    const bottom = VH + 20 + W.camY, step = 8;
    const x0 = Math.floor(L / step) * step, x1 = R;
    const wave = x => (waterY(x) ?? bottom) + Math.sin(x * 0.04 + t * 2.2) * 2.5;
    ctx.beginPath(); ctx.moveTo(x0, bottom);
    for (let x = x0; x <= x1 + step; x += step) ctx.lineTo(x, wave(x));
    ctx.lineTo(x1 + step, bottom); ctx.closePath();
    const g = ctx.createLinearGradient(0, 272, 0, 660); g.addColorStop(0, 'rgba(60,170,240,.42)'); g.addColorStop(1, 'rgba(20,70,170,.62)');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(230,250,255,.85)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); let first = true;
    for (let x = x0; x <= x1 + step; x += step) { const y = wave(x); if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y); }
    ctx.stroke();
    // light rays + ambient bubbles in the deep parts
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    for (let k = Math.floor(L / 160); k < R / 160 + 1; k++) {
      const x = k * 160 + 40, wy = waterY(x);
      if (wy === null || !isDeep(x)) continue;
      ctx.beginPath(); ctx.moveTo(x, wy); ctx.lineTo(x + 30, wy); ctx.lineTo(x + 80, seabedAt(x)); ctx.lineTo(x + 40, seabedAt(x)); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1;
    for (let k = Math.floor(L / 90); k < R / 90 + 1; k++) {
      const x = k * 90 + window.hash01(k) * 60, wy = waterY(x);
      if (wy === null || !isDeep(x)) continue;
      const sb = seabedAt(x), y = sb - ((t * 30 + window.hash01(k + 7) * 300) % (sb - wy));
      D.circ(ctx, x + Math.sin(t * 2 + k) * 4, y, 2 + window.hash01(k + 3) * 2); ctx.stroke();
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
      D.tubby(ctx, tr.x, tr.y, { face: tr.face, alpha: tr.a * 0.6, t: W.t, run: P.run, ground: true, speed: 1, scale });
    }
    if (P.invuln > 0 && !P.dead && Math.floor(P.invuln * 14) % 2 === 0) return;
    ctx.save();
    if (P.dead) { ctx.translate(P.x, P.y - P.h / 2); ctx.rotate(P.deadT * 8); ctx.translate(-P.x, -(P.y - P.h / 2)); }
    D.tubby(ctx, P.x, P.y, {
      face: P.face, sx: P.sx, sy: P.sy, run: P.swim ? W.t * 9 : P.run, speed: P.swim ? 0.8 : Math.abs(P.vx) / 120, ground: P.onGround && !P.swim, air: !P.onGround || P.swim,
      t: W.t, blink: P.blink > 0, hurt: P.hurtFace > 0 || P.dead,
      scale, glow: big, field: P.pw.shield > 0 ? 'shield' : P.pw.tough > 0 ? 'tough' : null, sprout: P.sprout
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
    // progress to the exit
    const bx = L + 204, bw = 100;
    ctx.fillStyle = 'rgba(20,30,60,.45)'; D.rr(ctx, bx, 8, bw, 30, 15); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.25)'; D.rr(ctx, bx + 12, 20, bw - 34, 6, 3); ctx.fill();
    const prog = clamp(P.x / W.exit.x, 0, 1);
    ctx.fillStyle = '#8af05a'; D.rr(ctx, bx + 12, 20, Math.max(6, (bw - 34) * prog), 6, 3); ctx.fill();
    ctx.fillStyle = '#ffde3a'; D.star(ctx, bx + bw - 14, 23, 7, 0); ctx.fill();
    D.tubby(ctx, bx + 12 + (bw - 34) * prog, 31, { scale: 0.42, ground: true, t: W.t, speed: 0 });
    // friends rescued
    ctx.fillStyle = 'rgba(20,30,60,.45)'; D.rr(ctx, L, 42, 112, 26, 13); ctx.fill();
    const have = friendsWith();
    FRIEND_KEYS.forEach((k, i) => { const on = have.includes(k); ctx.save(); ctx.globalAlpha = on ? 1 : 0.3; D.friend(ctx, k, L + 18 + i * 26, 66, { t: W.t, scale: k === 'lunker' ? 0.36 : 0.5, glow: on ? 0.5 : 0 }); ctx.restore(); });
    D.text(ctx, have.length + '/3', L + 98, 55, 11, '#fff', { sw: 3 });
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
    // boss health bar (bottom centre, between the touch controls)
    const B = W.boss;
    if (B && !B.gone && B.state !== 'enter') {
      const bw = Math.min(260, VW - 400), bx2 = VW / 2 - bw / 2, by2 = VH - 40;
      ctx.fillStyle = 'rgba(20,30,60,.6)'; D.rr(ctx, bx2 - 8, by2 - 18, bw + 16, 42, 12); ctx.fill();
      D.text(ctx, BOSS_NAMES[B.kind], VW / 2, by2 - 6, 12, '#ffde3a', { sw: 3 });
      ctx.fillStyle = 'rgba(255,255,255,.2)'; D.rr(ctx, bx2, by2 + 4, bw, 12, 6); ctx.fill();
      for (let i = 0; i < B.max; i++) {
        const sw = bw / B.max, on = i < B.hp;
        ctx.fillStyle = on ? (B.hp === 1 ? '#ff4a4a' : '#ff8a3a') : 'rgba(255,255,255,.12)';
        D.rr(ctx, bx2 + i * sw + 1.5, by2 + 5, sw - 3, 10, 5); ctx.fill();
      }
      if (B.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + B.flash * 0.6 + ')'; D.rr(ctx, bx2, by2 + 4, bw, 12, 6); ctx.fill(); }
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
      D.text(ctx, L.id + '  ' + L.name.toUpperCase(), VW / 2, 128, 22, '#ffde3a', { sw: 5 });
      D.text(ctx, L.boss ? 'BOSS: ' + L.subtitle : L.stage === 0 ? L.subtitle + ' - reach ' + EXIT_NAMES[L.exit.kind] + '!' : L.subtitle, VW / 2, 158, 14, L.boss ? '#ff9ab8' : '#fff', { sw: 4 });
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
      const rows = [['Level points', r.levelPts], ['Time left ' + fmtTime(r.timeLeft) + ' × 100', r.bonus], ['Lives left', G.lives]];
      rows.forEach(([a, b], i) => {
        D.text(ctx, a, p.x + 30, p.y + 72 + i * 24, 14, '#fff', { sw: 3, align: 'left' });
        D.text(ctx, String(b), p.x + 330, p.y + 72 + i * 24, 15, '#fff', { sw: 3, align: 'right' });
      });
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(p.x + 30, p.y + 134, 300, 2);
      D.text(ctx, 'TOTAL', p.x + 30, p.y + 152, 18, '#ffde3a', { sw: 4, align: 'left' });
      D.text(ctx, String(r.total), p.x + 330, p.y + 152, 20, '#ffde3a', { sw: 4, align: 'right' });
      for (let i = 0; i < 3; i++) { const on = i < r.stars, pulse = on ? 1 + 0.15 * Math.max(0, Math.sin(G.stateT * 6 - i)) : 1; ctx.fillStyle = on ? '#ffd21f' : 'rgba(255,255,255,.3)'; D.star(ctx, p.x + 40 + i * 26, p.y + 180, 11 * pulse, 0); ctx.fill(); if (on) { ctx.strokeStyle = '#b07a00'; ctx.lineWidth = 1.5; ctx.stroke(); } }
      D.text(ctx, r.newHigh ? '★ NEW HIGH SCORE! ★' : 'HIGH SCORE ' + save.high, p.x + 230, p.y + 180, 13, r.newHigh ? '#8af05a' : '#fff', { sw: 4 });
      const next = window.LEVELS[G.levelIdx + 1];
      if (!next) button('finish', VW / 2 - 150, p.y + 200, 300, 40, 'FINISH ★', { primary: true, size: 17, col: ['#8af05a', '#2f9e3a'] });
      else button('next', VW / 2 - 150, p.y + 200, 300, 40, next.world !== L.world ? 'NEXT WORLD ▶' : 'NEXT: ' + next.id + ' ▶', { primary: true, size: 17 });
      button('replay', VW / 2 - 150, p.y + 250, 144, 36, 'REPLAY', { col: ['#9fd2ff', '#4a9bf0'], size: 14 });
      button('menu', VW / 2 + 6, p.y + 250, 144, 36, 'MENU', { col: ['#ff9ab8', '#e0306e'], size: 14 });
    }
  }

  // ---------- story intro: one continuous animated scene (tap to skip) ----------
  const STORY_LEN = 19;
  const STORY_CAPS = [
    [0, 'One lazy afternoon, Tubby Dash and his friends were gaming on the couch...'],
    [3, 'Squib grabbed a fizzy soda... and set it right on top of the game console!'],
    [6.8, 'The game got SO exciting that everyone started bouncing...'],
    [8.6, 'Uh oh... the soda tipped over and spilled into the console!'],
    [10, 'ZZZAP! Sparks raced up the cable to the screen!'],
    [11.6, 'The screen swirled... and sucked all four of them into the game!'],
    [14.6, 'They got scattered! Tubby must rescue his friends and find the way home!']
  ];
  const STORY_SFX = [[5.15, 'candown'], [5.3, 'fizz'], [7.2, 'boing'], [7.8, 'boing'], [8.3, 'bonk'], [8.75, 'spill'], [10.05, 'zap'], [10.6, 'crackle'], [11.1, 'zap'],
    [11.7, 'whoosh'], [12.0, 'jump'], [12.5, 'jump'], [13.0, 'jump'], [13.5, 'jump'], [14.6, 'poof'], [15.5, 'whistle'], [16.0, 'thud']];
  const CREW = ['pipple', 'tubby', 'lunker', 'squib'];
  const sm = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
  function camAt(t, room) {
    const K = [[0, 1, VW / 2, VH / 2], [3, 1.08, VW * 0.55, 205], [4.6, 1.4, room.tvX - 60, 215], [5.8, 1.4, room.tvX - 60, 215], [6.8, 1.1, VW * 0.5, 205],
      [8.4, 1.6, room.tvX, 220], [9.9, 1.6, room.tvX, 215], [10.6, 1.35, room.tvX - 10, 175], [11.6, 1.0, VW / 2, VH / 2], [15, 1, VW / 2, VH / 2]];
    let i = 0; while (i < K.length - 2 && t > K[i + 1][0]) i++;
    const a = K[i], b = K[i + 1], k = sm((t - a[0]) / (b[0] - a[0]));
    const z = a[1] + (b[1] - a[1]) * k, hw = VW / (2 * z), hh = VH / (2 * z);
    const fx = Math.max(hw, Math.min(VW - hw, a[2] + (b[2] - a[2]) * k)), fy = Math.max(hh, Math.min(VH - hh, a[3] + (b[3] - a[3]) * k));
    return [z, fx, fy];
  }
  function cablePt(room, k) {   // bezier from the console back up to the monitor
    const x0 = room.tvX + 22, y0 = 214, x3 = room.tvX + 58, y3 = room.tvY + 50;
    const x1 = room.tvX + 80, y1 = 250, x2 = room.tvX + 95, y2 = room.tvY + 80;
    const u = 1 - k;
    return [u * u * u * x0 + 3 * u * u * k * x1 + 3 * u * k * k * x2 + k * k * k * x3, u * u * u * y0 + 3 * u * u * k * y1 + 3 * u * k * k * y2 + k * k * k * y3];
  }
  function drawConsole(room, t, shake) {
    const x = room.tvX, y = 220 + 0;
    ctx.save(); ctx.translate(Math.sin(t * 45) * shake, 0);
    ctx.fillStyle = '#2a2a3a'; D.rr(ctx, x - 30, y - 14, 60, 14, 4); ctx.fill();
    ctx.fillStyle = '#3e3e52'; D.rr(ctx, x - 30, y - 14, 60, 5, 3); ctx.fill();
    ctx.fillStyle = (Math.sin(t * 4) > 0) ? '#5fff7a' : '#2a8a3a'; D.circ(ctx, x - 22, y - 6, 1.8); ctx.fill();
    ctx.fillStyle = '#111'; ctx.fillRect(x + 6, y - 8, 6, 4); ctx.fillRect(x + 15, y - 8, 6, 4);   // ports
    ctx.restore();
    // controller cables to the couch + video cable to the monitor + PC tower
    ctx.strokeStyle = '#1a1a24'; ctx.lineWidth = 2.5; ctx.beginPath();
    let p = cablePt(room, 0); ctx.moveTo(p[0], p[1]); for (let k = 0.05; k <= 1.001; k += 0.05) { p = cablePt(room, k); ctx.lineTo(p[0], p[1]); } ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(30,30,40,.7)';
    ctx.beginPath(); ctx.moveTo(x - 28, y - 4); ctx.quadraticCurveTo(x - 90, 300, room.couchX + 110, 268); ctx.stroke();
    ctx.fillStyle = '#d8dce6'; D.rr(ctx, x + 92, 228, 34, 66, 4); ctx.fill(); ctx.strokeStyle = '#8a90a2'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#5ec8ff'; D.circ(ctx, x + 109, 240, 2.5); ctx.fill();
    ctx.strokeStyle = '#1a1a24'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 92, 262); ctx.quadraticCurveTo(x + 50, 280, x + 26, y - 6); ctx.stroke();
  }
  function drawSoda(x, y, tilt, fizzK, t) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
    const g = ctx.createLinearGradient(-6, 0, 6, 0); g.addColorStop(0, '#c41e2a'); g.addColorStop(0.5, '#ff5a5a'); g.addColorStop(1, '#a01020');
    ctx.fillStyle = g; D.rr(ctx, -6, -18, 12, 18, 3); ctx.fill();
    ctx.fillStyle = '#d8dce6'; ctx.fillRect(-6, -19, 12, 3); ctx.fillStyle = '#fff'; ctx.fillRect(-6, -11, 12, 3);
    ctx.restore();
    if (fizzK > 0) for (let i = 0; i < 6; i++) {
      const ph = (t * 1.5 + i / 6) % 1;
      ctx.fillStyle = 'rgba(255,255,255,' + (1 - ph) * fizzK + ')'; D.circ(ctx, x + Math.sin(i * 7 + t * 6) * 4, y - 20 - ph * 18, 1.4); ctx.fill();
    }
  }
  function renderStory() {
    const t = G.stateT;
    // synced sound effects
    const last = G.storyLastT === undefined || G.storyLastT > t ? -1 : G.storyLastT;
    for (const [et, name] of STORY_SFX) if (et > last && et <= t) Sound.play(name);
    G.storyLastT = t;
    let cap = STORY_CAPS[0][1]; for (const c of STORY_CAPS) if (t >= c[0]) cap = c[1];
    ctx.fillStyle = '#1b2a4a'; ctx.fillRect(0, 0, VW, VH);
    const m = 10;
    ctx.save(); D.rr(ctx, m, m, VW - 2 * m, VH - 56, 14); ctx.clip();
    if (t < 14.6) {
      const room0 = { tvX: VW * 0.78, tvY: 150, couchX: VW * 0.33, seatY: 252 };
      const [z, fx, fy] = camAt(t, room0);
      const shakeAll = (t > 10 && t < 11.6) ? 3 : 0;
      ctx.translate(VW / 2 + (shakeAll ? rand(-shakeAll, shakeAll) : 0), VH / 2); ctx.scale(z, z); ctx.translate(-fx, -fy);
      const screen = t < 10.2 ? 'game' : t < 11.6 ? 'static' : 'swirl';
      const room = D.livingRoom(ctx, VW, VH, G.t, { screen });
      const consShake = t > 6.8 && t < 8.7 ? 1.5 + (t - 6.8) : 0;
      drawConsole(room, G.t, consShake);
      // soda states: carried (3-5.15), on console (5.15-8.6 wobbling), tipping/spilled
      const cx = room.tvX - 10, cy = 206;
      // Squib's walk: leaves seat 3.0, reaches console 4.6, places 5.15, back on couch by 6.6
      const seat = i => [room.couchX - 105 + i * 70, room.seatY];
      let sqX, sqY, sqFace = 1, sqAir = false, handUp = 0;
      const [s3x, s3y] = seat(3), floorY = 300, standX = room.tvX - 46;
      if (t < 3 || t > 6.6) { sqX = s3x; sqY = s3y; }
      else if (t < 3.4) { const k = sm((t - 3) / 0.4); sqX = s3x + k * 30; sqY = s3y + (floorY - s3y) * k - Math.sin(k * Math.PI) * 20; sqAir = true; }
      else if (t < 4.6) { const k = (t - 3.4) / 1.2; sqX = s3x + 30 + (standX - s3x - 30) * k; sqY = floorY - Math.abs(Math.sin(k * 14)) * 4; }
      else if (t < 5.6) { sqX = standX; sqY = floorY - sm((t - 4.6) / 0.3) * 16; handUp = sm((t - 4.6) / 0.4) * (1 - sm((t - 5.3) / 0.3)); sqAir = true; }
      else { const k = sm((t - 5.6) / 1.0); sqX = standX + (s3x - standX) * k; sqY = floorY + (s3y - floorY) * k - Math.sin(k * Math.PI) * 40; sqFace = -1; sqAir = k < 1; }
      // crew on the couch
      const excited = t > 6.8 && t < 10 ? 1 : 0, shocked = t > 10 && t < 11.6;
      const pulled = i => t < 11.6 ? 0 : sm((t - 11.8 - i * 0.55) / 1.1);
      CREW.forEach((c, i) => {
        if (c === 'squib' && t > 3 && t < 6.6) return;
        const k = pulled(i); if (k >= 1) return;
        let [x, y] = seat(i);
        const bounce = excited ? Math.abs(Math.sin(G.t * 9 + i * 1.7)) * 12 : Math.abs(Math.sin(G.t * (3 + i) + i)) * 2.5;
        y -= shocked ? 0 : bounce;
        let sx = 1, sy = 1, rot = shocked ? Math.sin(G.t * 40 + i) * 0.05 : 0;
        const tx = room.tvX, ty = room.tvY;
        if (k > 0) {
          const ang = Math.atan2(ty - y, tx - x);
          const px = x + (tx - x) * k, py = y + (ty - y) * k - Math.sin(k * Math.PI) * 30;
          const sc = 1 - 0.85 * k;
          ctx.save(); ctx.translate(px, py); ctx.rotate(ang); ctx.scale((1 + 1.4 * k) * sc, (1 - 0.4 * k) * sc); ctx.rotate(-ang + k * 6);
          if (c === 'tubby') D.tubby(ctx, 0, 0, { t: G.t, scale: 1.3, air: true, hurt: true }); else D.friend(ctx, c, 0, 0, { t: G.t, scale: 1.3, air: true, glow: 1 });
          ctx.restore();
          return;
        }
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
        const air = bounce > 4;
        if (c === 'tubby') D.tubby(ctx, 0, 0, { t: G.t, scale: 1.3, ground: !air, air, hurt: shocked, blink: !shocked && (G.t % 3) < 0.1 });
        else D.friend(ctx, c, 0, 0, { t: G.t, scale: 1.3, ground: !air, air, glow: excited ? 0.4 : 0, blink: !shocked && ((G.t + i) % 3.3) < 0.1 });
        // controller in hand
        const hy = c === 'lunker' ? -40 : -26;
        ctx.fillStyle = '#2a2a34'; D.rr(ctx, 6, hy, 18, 9, 4); ctx.fill(); ctx.fillStyle = '#ff4a4a'; D.circ(ctx, 20, hy + 4, 1.6); ctx.fill();
        ctx.restore();
        if (shocked) D.text(ctx, '!', x + 6, y - (c === 'lunker' ? 100 : 72), 20, '#ff3a3a', { sw: 4 });
        if (excited && Math.sin(G.t * 9 + i * 1.7) > 0.9) D.text(ctx, '♪', x + 22, y - 70, 14, '#fff', { sw: 3 });
      });
      if (t < 11.6 || pulled(3) < 1) D.couchFront(ctx, room);
      // Squib walking with the soda
      if (t >= 3 && t <= 6.6) {
        const sp = (t > 3.4 && t < 4.6) || (t > 5.6) ? 1 : 0;
        D.friend(ctx, 'squib', sqX, sqY, { t: G.t, scale: 1.3, face: sqFace, run: G.t * 14, speed: sp, ground: !sqAir, air: sqAir, glow: 0.2 });
        if (t < 5.15) {   // can in Squib's raised hand, then set down on the console
          const hx = sqX + 22, hy = sqY - 30 - handUp * 26;
          const k = sm((t - 4.7) / 0.45);
          drawSoda(hx + (cx - hx) * k, hy + (cy - hy) * k, 0, 0, G.t);
        }
      }
      // soda on the console: wobble, tip, spill
      if (t >= 5.15) {
        const wob = t > 6.8 ? Math.sin(G.t * 30) * Math.min(0.35, (t - 6.8) * 0.2) : 0;
        const tip = sm((t - 8.5) / 0.35) * 1.75;
        const sx = cx + Math.sin(G.t * 45) * consShake + tip * 6;
        drawSoda(sx, cy - (t > 5.15 && t < 5.25 ? 2 : 0), wob + tip, t < 8.6 ? 1 : 0, G.t);
        if (t > 8.6) {   // liquid flows over the console and drips into the ports/cable
          const fl = sm((t - 8.6) / 1.2);
          ctx.fillStyle = 'rgba(150,80,30,.9)';
          ctx.beginPath(); ctx.ellipse(cx + 10 + fl * 10, 206, 6 + fl * 18, 2 + fl * 1.5, 0, 0, Math.PI * 2); ctx.fill();
          for (let i = 0; i < 5; i++) {
            const dx = cx + 4 + i * 8, len = fl * (10 + (i % 3) * 8);
            ctx.fillRect(dx, 206, 2.5, len);
            const ph = (G.t * 2 + i * 0.3) % 1; D.circ(ctx, dx + 1, 206 + len + ph * 20, 2); ctx.fill();
          }
          if (t > 9.4) { const p = cablePt(room, 0); ctx.fillStyle = 'rgba(150,80,30,.85)'; D.circ(ctx, p[0], p[1] + 2, 4 * fl); ctx.fill(); }
        }
      }
      // sparks race along the cable to the monitor
      if (t > 9.95 && t < 11.8) {
        for (let j = 0; j < 3; j++) {
          const k = ((t - 9.95) * 1.4 + j * 0.33) % 1, p = cablePt(room, k);
          ctx.fillStyle = '#fff6a0'; D.star(ctx, p[0], p[1], 6 + Math.sin(G.t * 40 + j) * 2, G.t * 10); ctx.fill();
          ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p[0], p[1]);
          ctx.lineTo(p[0] + rand(-10, 10), p[1] + rand(-10, 10)); ctx.lineTo(p[0] + rand(-12, 12), p[1] + rand(-12, 12)); ctx.stroke();
        }
        if (Math.sin(G.t * 37) > 0.7) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(room.tvX - 80, room.tvY - 60, 160, 130); }
        D.text(ctx, 'ZZZAP!', room.tvX - 10, room.tvY - 72, 22, '#ffe14a', { sw: 5 });
      }
      if (t > 11.6) {
        ctx.strokeStyle = 'rgba(200,160,255,.6)'; ctx.lineWidth = 3;
        for (let r = 0; r < 5; r++) { ctx.beginPath(); ctx.arc(room.tvX, room.tvY, 80 + r * 45 - (G.t * 90 % 45), G.t * 4 + r, G.t * 4 + r + 2); ctx.stroke(); }
        D.text(ctx, 'WHOOOSH!', room.couchX + 40, 80, 28, '#b47aff', { sw: 6 });
      }
      if (t > 14.1) { ctx.fillStyle = 'rgba(255,255,255,' + sm((t - 14.1) / 0.5) + ')'; ctx.fillRect(-VW, -VH, VW * 3, VH * 3); }
    } else {
      // tumbling into Green Hills and scattering (slow so everyone is visible)
      const pt = t - 14.6;
      window.THEMES.hills.background(ctx, pt * 20, VW, VH, G.t);
      ctx.fillStyle = '#5fbf3a'; ctx.fillRect(0, 300, VW, VH);
      const dirs = [[-0.75, -0.55], [0, 0], [0.85, -1.05], [0.4, 0.2]];
      CREW.forEach((c, i) => {
        const fall = sm(pt / 1.4);
        let x = VW / 2 + (i - 1.5) * 50, y = -60 + fall * 230;
        const q = sm((pt - 1.2) / 3.0);
        x += dirs[i][0] * q * VW * 0.42; y += dirs[i][1] * q * 150;
        let rot = pt * 3 + i;
        if (c === 'tubby') { x = VW / 2 - 40; y = Math.min(300, -60 + sm(pt / 1.5) * 360); rot = y < 300 ? pt * 5 : 0; }
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
        if (c === 'tubby') D.tubby(ctx, 0, 0, { t: G.t, scale: 1.4, air: y < 300, ground: y >= 300, hurt: y < 300, face: Math.sin(G.t * 2) > 0 ? 1 : -1 });
        else D.friend(ctx, c, 0, 0, { t: G.t, scale: 1.2, air: true, glow: 1 });
        ctx.restore();
        if (c !== 'tubby' && pt > 1.5 && pt < 4.2) D.text(ctx, D.FRIENDS[c].name + '!', x, y - 50, 11, '#fff', { sw: 3 });
      });
      if (pt > 1.8) D.text(ctx, 'HELP, TUBBY!', VW / 2 + 150, 74, 22, '#fff', { sw: 5 });
      if (pt < 0.4) { ctx.fillStyle = 'rgba(255,255,255,' + (1 - pt / 0.4) + ')'; ctx.fillRect(0, 0, VW, VH); }
    }
    ctx.restore();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; D.rr(ctx, m, m, VW - 2 * m, VH - 56, 14); ctx.stroke();
    ctx.fillStyle = '#fff6c8'; D.rr(ctx, m, VH - 40, VW - 2 * m, 30, 10); ctx.fill();
    ctx.strokeStyle = '#1b2a4a'; ctx.lineWidth = 3; ctx.stroke();
    D.text(ctx, cap, VW / 2, VH - 25, 13.5, '#1b2a4a', { stroke: false });
    D.text(ctx, 'TAP TO SKIP ▶', VW - 70 - SAFE_R, 26, 11, '#fff', { sw: 3 });
    if (t < 0.3) { ctx.fillStyle = 'rgba(27,42,74,' + (1 - t / 0.3) + ')'; ctx.fillRect(0, 0, VW, VH); }
  }
  function drawCup(x, y, tilt) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
    ctx.fillStyle = '#ff4a4a'; ctx.beginPath(); ctx.moveTo(-10, -30); ctx.lineTo(10, -30); ctx.lineTo(7, 0); ctx.lineTo(-7, 0); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(-9, -20, 17, 5);
    ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(3, -30); ctx.lineTo(8, -44); ctx.stroke();
    ctx.restore();
  }

  // ---------- transition cutscenes (tap to skip) ----------
  const ease = k => k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k);
  function cutHero(x, y, t, o) {
    o = Object.assign({ face: 1, t, run: t * 16, speed: 1, ground: true, scale: 1.4, blink: (t % 3) < 0.1 }, o || {});
    if (o.friends !== false && G.state === 'cutscene') friendsBefore(G.cut * 3).forEach((k, i) => {
      const dx = -(i + 1) * 44 * o.scale / 1.4 * o.face;
      D.friend(ctx, k, x + dx, y + Math.sin(t * 8 + i) * 3, { t, face: o.face, run: t * 14, speed: 1, ground: !o.air, air: o.air, scale: o.scale * 0.95, alpha: o.alpha, glow: 0.8 });
    });
    D.tubby(ctx, x, y, o);
  }
  function renderCutscene() {
    const t = G.stateT, n = G.cut, k = t / (n >= 5 ? 7 : CUT_LEN), TH = window.THEMES;
    let caption = '';
    ctx.save();
    if (n === 1) {          // 1 -> 2: climb the big tree into the clouds
      caption = 'Climbing the big tree...';
      const climb = ease(k / 0.8) * 520;
      TH.clouds.background(ctx, 0, VW, VH, t);
      ctx.save(); ctx.globalAlpha = 1 - ease((k - 0.2) / 0.5); TH.hills.background(ctx, 0, VW, VH, t); ctx.restore();
      const cx = VW / 2;
      // trunk scrolls downward as Tubby climbs up
      const tg = ctx.createLinearGradient(cx - 34, 0, cx + 34, 0); tg.addColorStop(0, '#6a4024'); tg.addColorStop(0.5, '#a8703e'); tg.addColorStop(1, '#5a3418');
      ctx.fillStyle = tg; ctx.fillRect(cx - 34, Math.max(-20, 40 - 600 + climb), 68, VH + 40);
      ctx.strokeStyle = 'rgba(60,30,10,.4)'; ctx.lineWidth = 2;
      for (let y = (climb % 46) - 46; y < VH; y += 46) { ctx.beginPath(); ctx.moveTo(cx - 20, y); ctx.quadraticCurveTo(cx, y + 8, cx + 18, y + 2); ctx.stroke(); }
      for (let i = 0; i < 6; i++) {            // leafy clumps passing by
        const ly = ((i * 140 + climb * 1.2) % 840) - 200, lx = cx + (i % 2 ? 60 : -60);
        ctx.fillStyle = '#3fae3a'; D.circ(ctx, lx, ly, 34); ctx.fill(); ctx.fillStyle = '#6fd04a'; D.circ(ctx, lx - 8, ly - 8, 22); ctx.fill();
      }
      // grass at the start, clouds at the end
      ctx.fillStyle = '#3fae3a'; ctx.fillRect(0, 312 + climb, VW, 60);
      const cl = ease((k - 0.55) / 0.35);
      for (let i = 0; i < 8; i++) { ctx.fillStyle = 'rgba(255,255,255,.95)'; D.circ(ctx, i * VW / 7, VH + 30 - cl * 80 + (i % 2) * 12, 50); ctx.fill(); }
      const hy = k < 0.8 ? 220 + Math.sin(t * 10) * 4 : 220 - ease((k - 0.8) / 0.1) * 40 + ease((k - 0.9) / 0.1) * 60;
      cutHero(cx + Math.sin(t * 10) * 6, hy, t, { air: true, run: t * 20, face: Math.sin(t * 5) > 0 ? 1 : -1 });
    } else if (n === 2) {   // 2 -> 3: slide down the rainbow to a city rooftop
      caption = 'Sliiiding down the rainbow!';
      TH.city.background(ctx, k * 200, VW, VH, t);
      ctx.save(); ctx.globalAlpha = 1 - ease(k / 0.35); TH.clouds.background(ctx, 0, VW, VH, t); ctx.restore();
      const ax = VW * 0.15, ay = VH + 140, R0 = VW * 0.75;
      const bands = ['#ff4a4a', '#ff9a1f', '#ffe14a', '#5fd04a', '#3aa0ff', '#8a5aff'];
      bands.forEach((col, i) => { ctx.strokeStyle = col; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(ax, ay, R0 - i * 12, -Math.PI * 0.62, -Math.PI * 0.04); ctx.stroke(); });
      // rooftop landing
      const roof = { x: VW * 0.72, y: 300, w: VW * 0.4, h: 600 };
      D.building(ctx, roof, 0, VW, VH, t);
      const s = ease(k / 0.8), ang = -Math.PI * 0.6 + s * Math.PI * 0.5;
      let hx = ax + Math.cos(ang) * (R0 - 30), hy = ay + Math.sin(ang) * (R0 - 30) - 6;
      if (k > 0.8) { const q = ease((k - 0.8) / 0.15); hx += q * 30; hy = hy + (300 - hy) * q - Math.sin(q * Math.PI) * 30; }
      for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(255,255,200,' + (0.8 - i * 0.12) + ')'; D.star(ctx, hx - i * 14 - 10, hy - 10 + i * 6, 4, t * 4 + i); ctx.fill(); }
      cutHero(hx, hy, t, { air: k < 0.95, sx: 1.1, sy: 0.9 });
    } else if (n === 3) {   // 3 -> 4: run off the pier and jump into the water
      caption = 'Cannonball!';
      TH.water.background(ctx, 0, VW, VH, t);
      const pierEnd = VW * 0.42;
      D.dock(ctx, { x: -20, y: 290, w: pierEnd + 20, h: 400 }, VH);
      D.pierExit(ctx, pierEnd * 0.35, 290, t);
      let hx, hy, air = false, alpha = 1;
      if (k < 0.35) { hx = 40 + (pierEnd - 60) * (k / 0.35); hy = 290; }
      else { const q = (k - 0.35) / 0.4; hx = pierEnd - 20 + q * 160; hy = 290 - Math.sin(Math.min(1, q) * Math.PI) * 120 + Math.max(0, q - 0.5) * 220; air = true; }
      const wy = 312, splashK = (k - 0.6) / 0.2;
      // water surface
      ctx.fillStyle = 'rgba(40,140,220,.55)'; ctx.fillRect(0, wy, VW, VH);
      if (hy > wy + 10) alpha = Math.max(0, 1 - (hy - wy) / 80);
      ctx.save(); ctx.globalAlpha = alpha; cutHero(hx, hy, t, { air, face: 1 }); ctx.restore();
      if (splashK > 0 && splashK < 1.5) {
        const sx = pierEnd + 140;
        for (let i = 0; i < 12; i++) { const a = -Math.PI * (0.15 + 0.7 * i / 11), r = 20 + splashK * 60; ctx.fillStyle = 'rgba(230,250,255,' + (1 - splashK / 1.5) + ')'; D.circ(ctx, sx + Math.cos(a) * r, wy + Math.sin(a) * r * 1.2 + splashK * splashK * 40, 6 - splashK * 2); ctx.fill(); }
      }
      // dive under: screen turns blue with bubbles
      const deep = ease((k - 0.72) / 0.2);
      if (deep > 0) {
        ctx.fillStyle = 'rgba(20,80,180,' + deep * 0.85 + ')'; ctx.fillRect(0, 0, VW, VH);
        ctx.strokeStyle = 'rgba(255,255,255,' + deep * 0.7 + ')'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 24; i++) { const bx = window.hash01(i) * VW, by = VH - ((t * 80 + window.hash01(i + 9) * VH) % VH); D.circ(ctx, bx, by, 3 + window.hash01(i + 3) * 5); ctx.stroke(); }
        cutHero(VW / 2 + Math.sin(t * 3) * 20, VH * 0.6, t, { air: true, alpha: deep, run: t * 9, speed: 0.8 });
      }
    } else if (n === 4) {   // 4 -> 5: the submarine surfaces and launches as a rocket
      caption = k < 0.45 ? 'All aboard the submarine...' : 'It\'s a ROCKET! Blast off!';
      if (k < 0.45) {
        TH.water.background(ctx, 0, VW, VH, t);
        const rise = ease(k / 0.3), tilt = -ease((k - 0.25) / 0.2) * Math.PI / 2;
        ctx.fillStyle = 'rgba(40,140,220,.55)';
        D.submarine(ctx, VW / 2, 380 - rise * 70 - ease((k - 0.3) / 0.15) * 60, t, tilt);
        ctx.fillRect(0, 312, VW, VH);
        if (k > 0.3) for (let i = 0; i < 10; i++) { ctx.fillStyle = 'rgba(255,255,255,.8)'; D.circ(ctx, VW / 2 + (window.hash01(i) - 0.5) * 80, 312 - window.hash01(i + 4) * 30 * (k - 0.3) * 6, 4); ctx.fill(); }
      } else {
        const q = (k - 0.45) / 0.55;
        if (q < 0.5) { TH.water.background(ctx, 0, VW, VH, t); ctx.save(); ctx.globalAlpha = ease(q / 0.5); TH.space.background(ctx, 0, VW, VH, t); ctx.restore(); }
        else TH.space.background(ctx, 0, VW, VH, t);
        const ry = VH + 20 - ease(q / 0.9) * (VH + 40) + Math.sin(t * 40) * 1.5;
        for (let i = 0; i < 14; i++) { ctx.fillStyle = 'rgba(255,' + (180 + i * 5) + ',120,' + (0.5 - i * 0.03) + ')'; D.circ(ctx, VW / 2 + Math.sin(i * 2 + t * 9) * 8, ry + 30 + i * 16, 12 - i * 0.5); ctx.fill(); }
        D.rocket(ctx, VW / 2, ry, t, 1);
        cutHero(VW / 2, ry - 52, t, { scale: 0.42, ground: true, speed: 0 });
      }
      if (Math.abs(k - 0.45) < 0.04) { ctx.fillStyle = 'rgba(255,255,255,' + (1 - Math.abs(k - 0.45) / 0.04) + ')'; ctx.fillRect(0, 0, VW, VH); }
    } else {                // 5: through the portal and back onto the couch
      if (k < 0.3) {
        TH.space.background(ctx, 0, VW, VH, t);
        const q = ease(k / 0.3);
        D.portal(ctx, VW / 2, 300, t * 2);
        const crew = ['tubby'].concat(FRIEND_KEYS);
        crew.forEach((c, i) => {
          const kk = Math.max(0, Math.min(1, q * 1.6 - i * 0.2)), sx = VW / 2 - 200 + i * 40 + kk * (200 - i * 40), sc = 1.2 * (1 - kk * 0.85);
          if (kk >= 1) return;
          ctx.save(); ctx.translate(sx, 240); ctx.rotate(kk * 6);
          if (c === 'tubby') D.tubby(ctx, 0, 0, { t, scale: sc, air: true }); else D.friend(ctx, c, 0, 0, { t, scale: sc, air: true, glow: 1 });
          ctx.restore();
        });
        if (k > 0.25) { ctx.fillStyle = 'rgba(255,255,255,' + ease((k - 0.25) / 0.05) + ')'; ctx.fillRect(0, 0, VW, VH); }
      } else {
        const q = (k - 0.3) / 0.7;
        const room = D.livingRoom(ctx, VW, VH, t, { screen: q < 0.55 ? 'swirl' : 'game' });
        const crew = ['tubby'].concat(FRIEND_KEYS);
        crew.forEach((c, i) => {
          const st = 0.05 + i * 0.12, kk = ease((q - st) / 0.25);
          if (q < st) return;
          const seatX = room.couchX - 105 + i * 70, seatY = room.seatY + 2;
          const x = room.tvX + (seatX - room.tvX) * kk, y = room.tvY + 10 + (seatY - room.tvY - 10) * kk - Math.sin(kk * Math.PI) * 110;
          const sc = 0.5 + kk * 0.9, done = kk >= 1;
          const hop = done ? Math.abs(Math.sin(t * 6 + i)) * 10 : 0;
          if (c === 'tubby') D.tubby(ctx, x, y - hop, { t, scale: sc, air: !done || hop > 2, ground: done, face: done ? 1 : -1, blink: (t % 3) < 0.1 });
          else D.friend(ctx, c, x, y - hop, { t, scale: sc, air: !done || hop > 2, glow: done ? 0.6 : 1, face: done ? 1 : -1 });
          if (!done && kk > 0) for (let j = 0; j < 4; j++) { ctx.fillStyle = 'rgba(255,255,200,.8)'; D.star(ctx, x + 20 + j * 12, y - 30 + j * 4, 4, t * 5 + j); ctx.fill(); }
        });
        D.couchFront(ctx, room);
        crew.forEach((c, i) => { const st = 0.05 + i * 0.12; if (ease((q - st) / 0.25) < 1) return; });
        if (q > 0.7) for (let i = 0; i < 30; i++) { ctx.fillStyle = ['#ff5fa0', '#ffe14a', '#8af05a', '#5ec8ff'][i % 4]; ctx.fillRect((i * 97 + t * 40) % VW, ((t - 4) * 120 + i * 37) % VH, 5, 3); }
        if (q < 0.05) { ctx.fillStyle = 'rgba(255,255,255,' + (1 - q / 0.05) + ')'; ctx.fillRect(0, 0, VW, VH); }
      }
    }
    ctx.restore();
    // letterbox + caption + skip hint
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, VW, 26); ctx.fillRect(0, VH - 34, VW, 34);
    D.text(ctx, STORY_BEATS[n - 1] || caption, VW / 2, VH - 17, 15, '#fff', { sw: 4 });
    D.text(ctx, 'TAP TO SKIP ▶', VW - 70 - SAFE_R, 13, 11, 'rgba(255,255,255,.85)', { sw: 3 });
    const nx = window.LEVELS[n * 3];
    D.text(ctx, nx ? 'NEXT: WORLD ' + (nx.world + 1) + ' - ' + nx.worldName.toUpperCase() : 'HOME SWEET HOME!', 14 + SAFE_L, 13, 11, '#ffde3a', { sw: 3, align: 'left' });
    if (t < 0.3) { ctx.fillStyle = 'rgba(0,0,0,' + (1 - t / 0.3) + ')'; ctx.fillRect(0, 0, VW, VH); }
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
  // Only exposed when running on a local dev server (localhost / 127.0.0.1); the public build has no cheats.
  const LOCAL_DEV = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if (LOCAL_DEV && /[?&]unlockall\b/.test(location.search)) devUnlockAll = true;
  if (LOCAL_DEV) window.RNR = {
    G, HERO, unlockAll(on) { devUnlockAll = on !== false; }, isUnlocked(i) { return isUnlocked(i); }, nextStage() { return nextStage(); },
    get W() { return W; }, get B() { return W && W.boss; }, mapwalk(a, b) { G.mapFrom = a; G.mapTo = b; G.mapPos = a; G.mapSel = b; setState('mapwalk'); }, map(sel) { G.mapSel = G.mapPos = sel || 0; setState('levels'); }, complete() { win(); }, get P() { return P; }, get state() { return G.state; }, get save() { return save; },
    start(levelIdx) { G.god = false; G.rescue = false; G.rescues = 0; G.rescueAt = []; G.score = 0; G.levelStartScore = 0; startLevel(levelIdx || 0, true); setState('play'); },
    teleport(x) { P.x = x; P.y = (surfaceAt(x) || 300) - 1; P.vy = 0; W.camX = clamp(x - VW * 0.38, 0, W.def.length - VW); },
    god(on) { G.god = on !== false; },
    rescue(on) { G.rescue = on !== false; },
    surfaceAt(x, g) { return surfaceAt(x, g); },
    waterY(x) { return waterY(x); },
    cutscene(n) { G.cut = n; setState('cutscene'); },
    win() { win(); },
    power(kind) { P.pw[kind] = POWER_TIME; },
    spawn(type, kind) { if (type === 'rock') spawnRock(); if (type === 'bird') spawnBird(kind || W.def.birdSkin || 'bird'); if (type === 'orb') spawnPower(kind); },
    hurt() { hurt(null); }
  };
})();

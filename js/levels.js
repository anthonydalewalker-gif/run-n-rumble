// Run N Rumble - level data + level themes.
// To add a level: add an entry to LEVELS (remove comingSoon), and a theme in THEMES.
(function () {
  'use strict';
  const D = window.Draw;

  // Ground segments: [x0, x1, topY]. Anything between segments is a gap.
  // blocks: floating platforms [x, topY, width] (head-bumpable).
  // Ground segments: [x0, x1, topY]. Anything between segments is a gap (or water / open space).
  // blocks: floating platforms [x, topY, width] (head-bumpable).
  // bugs: walkers [x, skin?]   birds: swoopers [triggerX, skin?] (swoop in when you reach triggerX)
  // snakes: [x]   rocks: [x0, x1] zones where things fall (skin = rockSkin)   exit: {x, kind}
  const LEVELS = [
    {
      id: 1, name: 'Green Hills', subtitle: 'On the ground', theme: 'hills', music: 'level1',
      time: 300, length: 9800, exit: { x: 9550, kind: 'tree' },
      ground: [[0, 1100, 300], [1170, 1900, 300], [1900, 2600, 270], [2690, 3600, 300], [3680, 4600, 300],
               [4600, 5400, 270], [5490, 6600, 300], [6690, 7800, 300], [7880, 8700, 270], [8700, 9800, 300]],
      blocks: [[1450, 215, 130], [2150, 190, 120], [3300, 215, 110], [4900, 175, 120], [6900, 215, 130], [8000, 175, 120]],
      bugs: [[900], [1400], [1515], [1750], [2400], [3000], [3420], [3950], [4080], [4250],
             [4960], [5900], [6250], [6960], [7500], [7650], [8150], [8300], [9000], [9100]],
      birds: [[2700], [3150], [4300], [4450], [6100], [7000], [7600], [8500], [9050]],
      snakes: [[5250], [7350], [8450]],
      rocks: [[5550, 6550], [6750, 7750], [8800, 9350]],
      power: { first: 6, min: 9, max: 15 }
    },
    {
      id: 2, name: 'Cloud Kingdom', subtitle: 'In the clouds', theme: 'clouds', music: 'level2',
      time: 300, length: 10400, exit: { x: 10120, kind: 'rainbow' },
      ground: [[0, 900, 290], [960, 1700, 280], [1880, 2600, 290], [2760, 3500, 275], [3560, 4300, 280], [4500, 5300, 290],
               [5380, 6100, 270], [6300, 7000, 280], [7170, 7900, 265], [7960, 8700, 280], [8900, 10400, 290]],
      blocks: [[1300, 200, 100], [3100, 180, 100], [5700, 185, 100], [8200, 190, 100], [9400, 190, 110]],
      clouds: [[1745, 270, 90, 'fade'], [2630, 300, 130, 'bounce'], [4350, 272, 110, 'drift', { ax: 25, period: 4 }],
               [6130, 262, 60, 'fade'], [6215, 250, 60, 'fade'], [7030, 300, 140, 'bounce'], [8745, 270, 110, 'drift', { ay: 25, period: 3 }]],
      bugs: [[500], [1200], [1500], [2200], [2400], [3000], [3300], [4000], [4800], [5000], [5800],
             [6600], [6800], [7500], [8300], [9200], [9600], [9800]],
      birds: [[1000], [1600], [2300], [2900], [3800], [4600], [5500], [6400], [7200], [8100], [8800], [9300], [9700]],
      snakes: [[5150], [8550]],
      rocks: [[6400, 6900]],
      lightning: [[5400, 6100], [7300, 7900], [9000, 9800]],
      wind: [[3300, 4250], [7300, 8650]],
      power: { first: 5, min: 8, max: 14 }
    },
    {
      id: 3, name: 'Rooftop City', subtitle: 'Streets and rooftops', theme: 'city', music: 'level3',
      time: 300, length: 10500, exit: { x: 10250, kind: 'pier' },
      bugSkin: 'trash', birdSkin: 'pigeon', rockSkin: 'pot',
      ground: [[0, 900, 300], [960, 1800, 270], [1870, 2600, 250], [2600, 3300, 280], [3380, 4200, 250], [4280, 5100, 280],
               [5100, 5900, 300], [5985, 6800, 265], [6880, 7700, 240], [7700, 8500, 275], [8590, 9400, 250], [9480, 10500, 290]],
      blocks: [[1300, 190, 110], [2900, 200, 100], [4600, 200, 110], [6300, 185, 110], [7200, 170, 110], [9000, 180, 110]],
      bugs: [[800], [1500], [2200], [2800], [3000, 'potato'], [3700], [4000], [4700], [5400], [5700], [6400], [6600, 'potato'],
             [7100], [7500], [8000], [8300], [9000], [9800], [10000]],
      birds: [[1200], [2000], [2900], [3600], [4500], [5300], [6100], [6900], [7600], [8400], [9200], [9900]],
      snakes: [[5600], [8200]],
      rocks: [[2000, 2600], [4300, 5100], [6000, 6800], [7700, 8500], [9500, 10100]],
      power: { first: 5, min: 8, max: 14 }
    },
    {
      id: 4, name: 'Deep Blue Bay', subtitle: 'Docks and deep water', theme: 'water', music: 'level4',
      time: 300, length: 10500, exit: { x: 10250, kind: 'submarine' },
      bugSkin: 'crab', birdSkin: 'gull',
      // docks over the water (falling in just means swimming)
      ground: [[0, 700, 250], [860, 1400, 250], [1600, 2200, 250], [2400, 3000, 250], [5750, 6500, 250], [6650, 7300, 250],
               [7450, 8000, 250], [9800, 10500, 250]],
      seabed: 350,
      // water: [x0, x1, surfaceY]; neighbouring regions blend with a sloped swell
      water: [[0, 3000, 272], [3150, 5600, 70], [5750, 8000, 272], [8150, 9650, 70], [9800, 10500, 272]],
      logs: [[745, 246, 75], [1450, 246, 100, { ax: 20 }], [2250, 246, 100], [6520, 246, 110, { ax: 25 }], [7320, 246, 110]],
      coral: [[3500, 260, 60], [4100, 200, 50], [4700, 280, 80], [5200, 230, 60], [8500, 250, 60], [9100, 210, 60]],
      bugs: [[500], [1100], [1800], [2600], [3800], [4500], [6000], [6900], [7700], [8600], [10000]],
      birds: [[1000], [2500], [6200], [7600]],
      fish: [[3300], [3700], [4000], [4400], [4900], [5300], [8300], [8700], [9000], [9400]],
      jellies: [[3600, 200], [4300, 150], [4900, 220], [5400, 160], [8400, 180], [8900, 140], [9500, 200]],
      power: { first: 5, min: 8, max: 13 }
    },
    {
      id: 5, name: 'Star Station', subtitle: 'Low gravity space', theme: 'space', music: 'level5',
      time: 300, length: 11000, exit: { x: 10750, kind: 'rocket' },
      gravity: 0.45, jumpScale: 0.72,
      bugSkin: 'alien', birdSkin: 'ufo', rockSkin: 'meteor',
      ground: [[0, 900, 300], [1050, 1800, 290], [1960, 2700, 270], [2880, 3600, 300], [3780, 4500, 260], [4700, 5400, 290],
               [5600, 6300, 270], [6480, 7200, 300], [7370, 8100, 260], [8300, 9000, 290], [9200, 9900, 270], [10080, 11000, 300]],
      blocks: [[1500, 200, 100], [3200, 190, 100], [4560, 230, 90], [6340, 220, 100], [8130, 230, 100], [9560, 180, 100]],
      bugs: [[600], [1400], [2200], [2500], [3200], [3400], [4000], [4300], [5000], [5200], [5800], [6100], [6700], [7000],
             [7600], [7900], [8500], [8800], [9400], [9700], [10300]],
      birds: [[1500], [2600], [3500], [4400], [5300], [6200], [7100], [8000], [8900], [9800]],
      rocks: [[2000, 3600], [4700, 6300], [7400, 9000], [9200, 10500]],
      power: { first: 5, min: 8, max: 13 }
    }
  ];

  // ---------- themes ----------
  function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

  const skyCache = {};
  function sky(c, VW, VH, top, bottom) {
    const key = top + bottom + VH;
    if (!skyCache[key]) {
      const g = c.createLinearGradient(0, 0, 0, VH);
      g.addColorStop(0, top); g.addColorStop(1, bottom);
      skyCache[key] = g;
    }
    c.fillStyle = skyCache[key]; c.fillRect(0, 0, VW, VH);
  }
  function cloud(c, x, y, s, col) {
    c.fillStyle = col || 'rgba(255,255,255,.92)';
    c.beginPath();
    c.arc(x, y, 18 * s, 0, Math.PI * 2); c.arc(x + 20 * s, y - 10 * s, 22 * s, 0, Math.PI * 2);
    c.arc(x + 44 * s, y - 2 * s, 18 * s, 0, Math.PI * 2); c.arc(x + 24 * s, y + 6 * s, 18 * s, 0, Math.PI * 2);
    c.fill();
  }
  function hillLayer(c, camX, VW, VH, par, base, amp, freq, seed, colTop, colBot) {
    const off = camX * par;
    const g = c.createLinearGradient(0, base - amp, 0, VH);
    g.addColorStop(0, colTop); g.addColorStop(1, colBot);
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, VH);
    for (let sx = 0; sx <= VW + 16; sx += 16) {
      const wx = sx + off;
      const y = base - amp * (0.55 * Math.sin(wx * freq + seed) + 0.3 * Math.sin(wx * freq * 2.3 + seed * 2) + 0.15 * Math.sin(wx * freq * 5.1));
      c.lineTo(sx, y);
    }
    c.lineTo(VW + 16, VH); c.closePath(); c.fill();
  }

  const THEMES = {
    hills: {
      solid: 'earth', dirtBase: '#a06c3a',
      grass: ['#7ee05a', '#3fae3a'], dirt: ['#b07a44', '#7a4a22'], dirtDot: 'rgba(90,50,20,.35)',
      card: ['#5ec8ff', '#7ee05a'],
      background(c, camX, VW, VH, t) {
        sky(c, VW, VH, '#3fb6ff', '#c8f0ff');
        // sun
        const sx = VW - 120, sy = 70;
        const sg = c.createRadialGradient(sx, sy, 10, sx, sy, 70);
        sg.addColorStop(0, 'rgba(255,250,200,1)'); sg.addColorStop(0.35, 'rgba(255,235,120,.9)'); sg.addColorStop(1, 'rgba(255,235,120,0)');
        c.fillStyle = sg; c.beginPath(); c.arc(sx, sy, 70, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#fff3a0'; c.beginPath(); c.arc(sx, sy, 24, 0, Math.PI * 2); c.fill();
        // clouds
        const W = 1800;
        for (let i = 0; i < 7; i++) {
          let x = (hash(i) * W - (camX * 0.12 + t * 6)) % W; if (x < -150) x += W;
          cloud(c, x, 40 + hash(i + 9) * 90, 0.7 + hash(i + 3) * 0.6);
        }
        hillLayer(c, camX, VW, VH, 0.18, 235, 60, 0.004, 1, '#9fd9c8', '#b8eadc');
        hillLayer(c, camX, VW, VH, 0.4, 268, 50, 0.007, 4, '#6cc25a', '#4a9e44');
        // little round trees on near hills
        const off = camX * 0.4;
        for (let k = Math.floor(off / 140) - 1; k < (off + VW) / 140 + 1; k++) {
          if (hash(k) < 0.45) continue;
          const wx = k * 140 + hash(k + 1) * 80, sx2 = wx - off;
          const y = 268 - 50 * (0.55 * Math.sin(wx * 0.007 + 4) + 0.3 * Math.sin(wx * 0.007 * 2.3 + 8) + 0.15 * Math.sin(wx * 0.007 * 5.1));
          c.fillStyle = '#5a3a1a'; c.fillRect(sx2 - 2, y - 14, 4, 16);
          c.fillStyle = '#3f9a3a'; c.beginPath(); c.arc(sx2, y - 20, 12, 0, Math.PI * 2); c.fill();
          c.fillStyle = 'rgba(255,255,255,.15)'; c.beginPath(); c.arc(sx2 - 4, y - 24, 5, 0, Math.PI * 2); c.fill();
        }
      },
      decor(c, d, t) {
        if (d.kind === 'flower') {
          c.strokeStyle = '#3c9a2c'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(d.x, d.y); c.lineTo(d.x, d.y - 12); c.stroke();
          c.fillStyle = d.col;
          for (let i = 0; i < 5; i++) { const a = i * 1.2566 + Math.sin(t * 2 + d.x) * 0.2; c.beginPath(); c.arc(d.x + Math.cos(a) * 4, d.y - 12 + Math.sin(a) * 4, 3, 0, 6.29); c.fill(); }
          c.fillStyle = '#ffde3a'; c.beginPath(); c.arc(d.x, d.y - 12, 2.4, 0, 6.29); c.fill();
        } else if (d.kind === 'bush') {
          const g = c.createLinearGradient(0, d.y - 22, 0, d.y); g.addColorStop(0, '#5fd04a'); g.addColorStop(1, '#2f8a2f');
          c.fillStyle = g; c.beginPath();
          c.arc(d.x - 12, d.y - 8, 10, 0, 6.29); c.arc(d.x, d.y - 14, 13, 0, 6.29); c.arc(d.x + 13, d.y - 8, 10, 0, 6.29); c.fill();
          c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(d.x - 4, d.y - 19, 5, 0, 6.29); c.fill();
        } else if (d.kind === 'mushroom') {
          c.fillStyle = '#fff1dc'; c.fillRect(d.x - 2.5, d.y - 9, 5, 9);
          c.fillStyle = '#ff4f5a'; c.beginPath(); c.arc(d.x, d.y - 9, 7, Math.PI, 0); c.fill();
          c.fillStyle = '#fff'; c.beginPath(); c.arc(d.x - 3, d.y - 12, 1.5, 0, 6.29); c.arc(d.x + 3, d.y - 11, 1.2, 0, 6.29); c.fill();
        }
      }
    },
    clouds: {
      solid: 'cloud', card: ['#8fb8ff', '#ffd9f0'],
      background(c, camX, VW, VH, t) {
        sky(c, VW, VH, '#6f9cff', '#ffd9f0');
        // soft sun
        const sg = c.createRadialGradient(VW * 0.78, 60, 5, VW * 0.78, 60, 110);
        sg.addColorStop(0, 'rgba(255,255,230,.95)'); sg.addColorStop(0.3, 'rgba(255,240,200,.5)'); sg.addColorStop(1, 'rgba(255,240,200,0)');
        c.fillStyle = sg; c.fillRect(0, 0, VW, VH);
        // faint rainbow
        const rx = 500 - camX * 0.05;
        [['rgba(255,90,90,.18)', 0], ['rgba(255,200,80,.18)', 8], ['rgba(120,220,120,.18)', 16], ['rgba(100,160,255,.18)', 24]].forEach(([col, o]) => {
          c.strokeStyle = col; c.lineWidth = 8; c.beginPath(); c.arc(rx, 330, 260 - o, Math.PI, 0); c.stroke();
        });
        // far cloud layers
        const layer = (par, y, s, col, gap) => {
          const off = camX * par + t * 4 * par;
          for (let k = Math.floor(off / gap) - 1; k < (off + VW) / gap + 1; k++) {
            const x = k * gap - off + hash(k * 3 + s) * gap * 0.5;
            cloud(c, x, y + hash(k + s) * 40, s, col);
          }
        };
        layer(0.08, 70, 1.4, 'rgba(255,255,255,.55)', 260);
        layer(0.2, 180, 1.8, 'rgba(255,255,255,.65)', 220);
        // floating islands far away
        const off = camX * 0.3;
        for (let k = Math.floor(off / 700) - 1; k < (off + VW) / 700 + 1; k++) {
          if (hash(k + 50) < 0.4) continue;
          const x = k * 700 - off + hash(k) * 300, y = 120 + hash(k + 7) * 60;
          c.fillStyle = 'rgba(120,150,210,.45)';
          c.beginPath(); c.moveTo(x - 40, y); c.lineTo(x + 40, y); c.lineTo(x + 8, y + 40); c.lineTo(x - 6, y + 34); c.closePath(); c.fill();
          c.fillStyle = 'rgba(110,190,140,.55)'; c.fillRect(x - 42, y - 6, 84, 8);
          c.fillStyle = 'rgba(110,190,140,.55)'; c.beginPath(); c.arc(x - 14, y - 14, 10, 0, 7); c.arc(x + 10, y - 18, 13, 0, 7); c.fill();
        }
        layer(0.45, 320, 2.2, 'rgba(255,255,255,.8)', 200);
      },
      decor(c, d, t) {
        if (d.kind === 'flower') { // little star flowers growing on clouds
          c.fillStyle = d.col; Draw.star(c, d.x, d.y - 6 + Math.sin(t * 2 + d.x) * 1.5, 4, t * 0.5); c.fill();
        } else if (d.kind === 'bush') {
          c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(d.x - 8, d.y - 4, 8, 0, 7); c.arc(d.x + 4, d.y - 8, 10, 0, 7); c.arc(d.x + 14, d.y - 3, 7, 0, 7); c.fill();
        }
      }
    },
    city: {
      solid: 'city', card: ['#ffb36a', '#7a6fc4'],
      background(c, camX, VW, VH, t) {
        sky(c, VW, VH, '#ff9a6a', '#ffe0a0');
        const sg = c.createRadialGradient(VW * 0.7, 150, 10, VW * 0.7, 150, 120);
        sg.addColorStop(0, 'rgba(255,250,210,1)'); sg.addColorStop(0.3, 'rgba(255,220,140,.7)'); sg.addColorStop(1, 'rgba(255,200,120,0)');
        c.fillStyle = sg; c.fillRect(0, 0, VW, VH);
        for (let i = 0; i < 5; i++) { let x = (hash(i + 40) * 1700 - (camX * 0.08 + t * 4)) % 1700; if (x < -150) x += 1700; cloud(c, x, 40 + hash(i + 41) * 50, 0.7, 'rgba(255,240,230,.8)'); }
        const skyline = (par, base, col, seed, win) => {
          const off = camX * par;
          c.fillStyle = col;
          for (let k = Math.floor(off / 60) - 1; k < (off + VW) / 60 + 2; k++) {
            const h = 60 + hash(k * 3 + seed) * 120, x = k * 60 - off, w = 50 + hash(k + seed) * 14;
            c.fillRect(x, base - h, w, VH);
            if (hash(k + seed * 2) > 0.7) { c.fillRect(x + w / 2 - 1, base - h - 18, 2, 18); }
            if (win) {
              c.fillStyle = 'rgba(255,240,170,.55)';
              for (let wy = base - h + 10; wy < base - 10; wy += 16) for (let wx = x + 6; wx < x + w - 8; wx += 12) if (hash(wx * 0.3 + wy + k) > 0.6) c.fillRect(wx, wy, 5, 7);
              c.fillStyle = col;
            }
          }
        };
        skyline(0.15, 250, 'rgba(150,110,170,.55)', 1, false);
        skyline(0.35, 290, 'rgba(90,70,130,.8)', 7, true);
      },
      decor(c, d, t) {
        if (d.kind === 'flower') { // chimney / vent
          c.fillStyle = '#7a8090'; c.fillRect(d.x - 4, d.y - 14, 8, 14); c.fillStyle = '#5a5f70'; c.fillRect(d.x - 6, d.y - 16, 12, 3);
          c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(d.x + Math.sin(t + d.x) * 3, d.y - 22 - (t * 10 + d.x) % 14, 3, 0, 7); c.fill();
        } else if (d.kind === 'bush') { // potted plant
          c.fillStyle = '#c45a28'; c.fillRect(d.x - 6, d.y - 9, 12, 9);
          c.fillStyle = '#4fbf3a'; c.beginPath(); c.arc(d.x - 4, d.y - 12, 5, 0, 7); c.arc(d.x + 3, d.y - 14, 6, 0, 7); c.fill();
        } else { // satellite dish
          c.strokeStyle = '#8a90a2'; c.lineWidth = 2; c.beginPath(); c.moveTo(d.x, d.y); c.lineTo(d.x, d.y - 10); c.stroke();
          c.fillStyle = '#e6eaf0'; c.beginPath(); c.ellipse(d.x, d.y - 14, 8, 4, -0.5, 0, 7); c.fill();
        }
      }
    },
    water: {
      solid: 'water', card: ['#6fd0ff', '#1a5fb0'],
      background(c, camX, VW, VH, t) {
        sky(c, VW, VH, '#5ec8ff', '#d8f6ff');
        c.fillStyle = '#fff6b0'; c.beginPath(); c.arc(VW - 110, 60, 24, 0, 7); c.fill();
        for (let i = 0; i < 6; i++) { let x = (hash(i + 60) * 1700 - (camX * 0.1 + t * 6)) % 1700; if (x < -150) x += 1700; cloud(c, x, 40 + hash(i + 61) * 70, 0.7 + hash(i + 62) * 0.4); }
        // far island + lighthouse
        const ix = 300 - (camX * 0.05) % 1400;
        c.fillStyle = '#5fbf7a'; c.beginPath(); c.ellipse(ix, 300, 120, 30, 0, Math.PI, 0); c.fill();
        c.fillStyle = '#fff'; c.fillRect(ix + 30, 236, 12, 40); c.fillStyle = '#ff4a4a'; c.fillRect(ix + 30, 248, 12, 8); c.fillRect(ix + 30, 264, 12, 8);
        // open sea behind
        const g = c.createLinearGradient(0, 290, 0, VH); g.addColorStop(0, '#3aa0e0'); g.addColorStop(1, '#1a5fb0');
        c.fillStyle = g; c.fillRect(0, 292, VW, VH);
      },
      decor(c, d, t) {
        if (d.kind === 'flower') { c.fillStyle = '#c9935a'; c.fillRect(d.x - 3, d.y - 10, 6, 10); c.fillStyle = '#8a5a2a'; c.fillRect(d.x - 4, d.y - 11, 8, 2); }    // bollard
        else if (d.kind === 'bush') { c.fillStyle = '#5a8fb0'; D.rr(c, d.x - 8, d.y - 10, 16, 10, 2); c.fill(); c.strokeStyle = '#3e6e92'; c.lineWidth = 1; c.stroke(); } // crate
        else { c.strokeStyle = '#d9c08a'; c.lineWidth = 2; c.beginPath(); c.arc(d.x, d.y - 4, 5, 0, 7); c.stroke(); }  // rope coil
      }
    },
    space: {
      solid: 'moon', card: ['#3a2a7a', '#0a0a2a'],
      background(c, camX, VW, VH, t) {
        sky(c, VW, VH, '#0b0b2a', '#3a2070');
        for (let i = 0; i < 90; i++) {
          const x = ((hash(i) * 2400 - camX * (0.03 + hash(i + 5) * 0.08)) % 2400 + 2400) % 2400;
          if (x > VW) continue;
          const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (1 + hash(i + 9) * 3) + i));
          c.fillStyle = 'rgba(255,255,255,' + tw + ')'; c.fillRect(x, hash(i + 3) * VH * 0.85, 1.5 + hash(i + 7), 1.5 + hash(i + 7));
        }
        // nebula
        const ng = c.createRadialGradient(VW * 0.3, 120, 10, VW * 0.3, 120, 220);
        ng.addColorStop(0, 'rgba(255,100,200,.18)'); ng.addColorStop(1, 'rgba(255,100,200,0)'); c.fillStyle = ng; c.fillRect(0, 0, VW, VH);
        // earth + ringed planet
        const ex = VW - 140 - (camX * 0.02) % 200;
        const eg = c.createRadialGradient(ex - 10, 70, 4, ex, 80, 36); eg.addColorStop(0, '#9fe0ff'); eg.addColorStop(0.7, '#2f7fe0'); eg.addColorStop(1, '#1a3f8a');
        c.fillStyle = eg; c.beginPath(); c.arc(ex, 80, 34, 0, 7); c.fill();
        c.fillStyle = '#5fbf3a'; c.beginPath(); c.ellipse(ex - 8, 74, 12, 8, 0.5, 0, 7); c.ellipse(ex + 14, 92, 9, 6, -0.3, 0, 7); c.fill();
        const px = 200 - (camX * 0.06) % 1800 + (camX * 0.06 > 1600 ? 1800 : 0);
        c.fillStyle = '#ffb36a'; c.beginPath(); c.arc(px, 180, 26, 0, 7); c.fill();
        c.strokeStyle = 'rgba(255,220,170,.8)'; c.lineWidth = 4; c.beginPath(); c.ellipse(px, 180, 44, 10, -0.3, 0, 7); c.stroke();
      },
      decor(c, d, t) {
        if (d.kind === 'flower') { // crystal
          c.fillStyle = 'rgba(140,220,255,.85)'; c.beginPath(); c.moveTo(d.x, d.y - 14); c.lineTo(d.x + 4, d.y); c.lineTo(d.x - 4, d.y); c.fill();
          c.fillStyle = 'rgba(200,140,255,.85)'; c.beginPath(); c.moveTo(d.x + 5, d.y - 9); c.lineTo(d.x + 8, d.y); c.lineTo(d.x + 2, d.y); c.fill();
        } else if (d.kind === 'bush') { // flag / antenna light
          c.strokeStyle = '#c8d0da'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(d.x, d.y); c.lineTo(d.x, d.y - 18); c.stroke();
          c.fillStyle = Math.sin(t * 4 + d.x) > 0 ? '#ff5f7a' : '#7a2a3a'; c.beginPath(); c.arc(d.x, d.y - 19, 2.5, 0, 7); c.fill();
        } else { c.fillStyle = '#8a82b0'; c.beginPath(); c.arc(d.x, d.y, 6, Math.PI, 0); c.fill(); }
      }
    }
  };

  window.LEVELS = LEVELS;
  window.THEMES = THEMES;
  window.hash01 = hash;
})();

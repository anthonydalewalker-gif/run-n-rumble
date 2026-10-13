// Run N Rumble - level data + level themes.
// To add a level: add an entry to LEVELS (remove comingSoon), and a theme in THEMES.
(function () {
  'use strict';
  const D = window.Draw;

  // Ground segments: [x0, x1, topY]. Anything between segments is a gap.
  // blocks: floating platforms [x, topY, width] (head-bumpable).
  // bugs: [x, carriesSeed]   birds: [triggerX, carriesSeed] (bird swoops in when you reach triggerX)
  // snakes: [x]   rocks: [x0, x1] zones where rocks fall   seeds: [x] loose seeds (placed on top surface)
  const LEVELS = [
    {
      id: 1, name: 'Green Hills', subtitle: 'On the ground', theme: 'hills', music: 'level1',
      seedsNeeded: 5, time: 300, length: 9800, tree: 9550,
      ground: [[0, 1100, 300], [1170, 1900, 300], [1900, 2600, 270], [2690, 3600, 300], [3680, 4600, 300],
               [4600, 5400, 270], [5490, 6600, 300], [6690, 7800, 300], [7880, 8700, 270], [8700, 9800, 300]],
      blocks: [[1450, 215, 130], [2150, 190, 120], [3300, 215, 110], [4900, 175, 120], [6900, 215, 130], [8000, 175, 120]],
      bugs: [[900], [1400], [1515], [1750, true], [2400], [3000], [3420, true], [3950], [4080], [4250],
             [4960], [5900], [6250], [6960], [7500, true], [7650], [8150], [8300], [9000], [9100]],
      birds: [[2700], [3150, true], [4300], [4450, true], [6100], [7000], [7600], [8500], [9050]],
      snakes: [[5250], [7350], [8450]],
      rocks: [[5550, 6550], [6750, 7750], [8800, 9350]],
      seeds: [[700], [2210], [4990], [6300]],
      power: { first: 6, min: 9, max: 16 }
    },
    {
      id: 2, name: 'Cloud Kingdom', subtitle: 'In the clouds', theme: 'clouds', music: 'level2',
      seedsNeeded: 8, time: 300, length: 10400, tree: 10150,
      // cloud banks you can stand on (falling between them costs a life)
      ground: [[0, 900, 290], [960, 1700, 280], [1880, 2600, 290], [2760, 3500, 275], [3560, 4300, 280], [4500, 5300, 290],
               [5380, 6100, 270], [6300, 7000, 280], [7170, 7900, 265], [7960, 8700, 280], [8900, 10400, 290]],
      // small solid clouds
      blocks: [[1300, 200, 100], [3100, 180, 100], [5700, 185, 100], [8200, 190, 100], [9400, 190, 110]],
      // special clouds: [x, topY, width, style, options]
      //   fade = disappears soon after you stand on it, bounce = springs you up high, drift = moves (ax/ay amplitude)
      clouds: [[1745, 270, 90, 'fade'], [2630, 300, 130, 'bounce'], [4350, 272, 110, 'drift', { ax: 25, period: 4 }],
               [6130, 262, 60, 'fade'], [6215, 250, 60, 'fade'], [7030, 300, 140, 'bounce'], [8745, 270, 110, 'drift', { ay: 25, period: 3 }]],
      bugs: [[500], [1200], [1500, true], [2200], [2400, true], [3000], [3300], [4000, true], [4800], [5000], [5800],
             [6600, true], [6800], [7500], [8300, true], [9200], [9600], [9800, true]],
      birds: [[1000], [1600, true], [2300], [2900, true], [3800], [4600, true], [5500], [6400], [7200, true], [8100], [8800], [9300, true], [9700]],
      snakes: [[5150], [8550]],
      rocks: [[6400, 6900]],
      lightning: [[5400, 6100], [7300, 7900], [9000, 9900]],
      wind: [[3300, 4250], [7300, 8650]],
      seeds: [[700], [1350], [3150], [5750], [6600], [8250], [9450]],
      power: { first: 5, min: 8, max: 14 }
    },
    {
      id: 3, name: 'Secret Garden', subtitle: 'Through the garden', theme: 'garden', music: 'level3',
      seedsNeeded: 11, time: 300, length: 11000, tree: 10750,
      ground: [[0, 1000, 300], [1080, 2200, 300], [2200, 3000, 275], [3090, 4200, 300], [4290, 5400, 285], [5400, 6200, 300],
               [6300, 7400, 275], [7490, 8600, 300], [8690, 9800, 285], [9800, 11000, 300]],
      blocks: [[1550, 215, 110], [3150, 200, 100], [4750, 205, 110], [6550, 190, 110], [8000, 215, 110], [9250, 200, 110], [10400, 215, 100]],
      clouds: [],
      flytraps: [[700], [1500], [1900], [2600], [3500], [3800], [4700], [5100], [6000], [6700], [7100], [7900], [8300], [9100], [9500], [10300]],
      // thorny vine groups: [x, count (2 or 4)]
      vines: [[1300, 2], [2450, 2], [3350, 4], [4500, 2], [5600, 4], [6500, 2], [7700, 4], [8900, 4], [10000, 4]],
      bugs: [[900], [1700, true], [2100], [2800, true], [3600], [4000, true], [4900], [5300, true], [5900], [6900, true], [7300],
             [8100, true], [8450], [9300, true], [9700], [10200], [10500, true]],
      birds: [[1200], [2000, true], [2900], [3700, true], [4600], [5500, true], [6400], [7000, true], [7800], [8700, true], [9400], [10100, true]],
      snakes: [[2900], [5250], [7250], [9650]],
      rocks: [[4300, 5400], [6300, 7400], [8700, 9800], [10100, 10600]],
      seeds: [[500], [1600], [3200], [4800], [5800], [6600], [7600], [8050], [9300], [10450]],
      power: { first: 5, min: 8, max: 14 }
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
    garden: {
      solid: 'earth', grass: ['#6fd04a', '#2f8a2f'], dirtBase: '#6a4024', card: ['#ffb8e0', '#5fbf4a'],
      background(c, camX, VW, VH, t) {
        sky(c, VW, VH, '#6fcbff', '#fff2c8');
        const sx = 110, sy = 60;
        const sg = c.createRadialGradient(sx, sy, 8, sx, sy, 60);
        sg.addColorStop(0, 'rgba(255,250,210,1)'); sg.addColorStop(0.4, 'rgba(255,230,140,.8)'); sg.addColorStop(1, 'rgba(255,230,140,0)');
        c.fillStyle = sg; c.beginPath(); c.arc(sx, sy, 60, 0, 7); c.fill();
        const W = 1700;
        for (let i = 0; i < 6; i++) { let x = (hash(i + 20) * W - (camX * 0.1 + t * 5)) % W; if (x < -150) x += W; cloud(c, x, 40 + hash(i + 29) * 60, 0.6 + hash(i + 23) * 0.5); }
        // tall hedge
        hillLayer(c, camX, VW, VH, 0.2, 215, 18, 0.03, 2, '#3f8f3a', '#2f6e2a');
        // giant sunflowers behind the fence
        const off = camX * 0.35;
        for (let k = Math.floor(off / 230) - 1; k < (off + VW) / 230 + 1; k++) {
          if (hash(k + 70) < 0.35) continue;
          const x = k * 230 - off + hash(k + 71) * 90, top = 150 + hash(k + 72) * 50;
          c.strokeStyle = '#3f8f3a'; c.lineWidth = 5; c.beginPath(); c.moveTo(x, 290); c.lineTo(x, top); c.stroke();
          c.fillStyle = '#4fa63a'; c.beginPath(); c.ellipse(x + 10, top + 60, 12, 5, -0.5, 0, 7); c.fill();
          c.fillStyle = '#ffd21f';
          for (let i = 0; i < 12; i++) { const a = i * 0.5236 + t * 0.2; c.beginPath(); c.ellipse(x + Math.cos(a) * 14, top + Math.sin(a) * 14, 8, 4, a, 0, 7); c.fill(); }
          c.fillStyle = '#6a3a14'; c.beginPath(); c.arc(x, top, 10, 0, 7); c.fill();
        }
        // picket fence
        const fo = camX * 0.55;
        c.fillStyle = '#f4ead8';
        for (let x = -(fo % 22); x < VW + 22; x += 22) { c.beginPath(); c.moveTo(x, 300); c.lineTo(x, 238); c.lineTo(x + 7, 230); c.lineTo(x + 14, 238); c.lineTo(x + 14, 300); c.fill(); }
        c.fillRect(0, 248, VW, 7); c.fillRect(0, 276, VW, 7);
        c.fillStyle = 'rgba(120,90,60,.2)'; c.fillRect(0, 254, VW, 2); c.fillRect(0, 282, VW, 2);
      },
      decor(c, d, t) {
        if (d.kind === 'flower') { // tulip
          c.strokeStyle = '#3c9a2c'; c.lineWidth = 2; c.beginPath(); c.moveTo(d.x, d.y); c.lineTo(d.x, d.y - 16); c.stroke();
          c.fillStyle = '#3fae3a'; c.beginPath(); c.ellipse(d.x + 4, d.y - 6, 5, 2, -0.6, 0, 7); c.fill();
          c.fillStyle = d.col; c.beginPath(); c.moveTo(d.x - 5, d.y - 16); c.lineTo(d.x - 5, d.y - 24); c.lineTo(d.x - 2, d.y - 21); c.lineTo(d.x, d.y - 25); c.lineTo(d.x + 2, d.y - 21); c.lineTo(d.x + 5, d.y - 24); c.lineTo(d.x + 5, d.y - 16); c.quadraticCurveTo(d.x, d.y - 11, d.x - 5, d.y - 16); c.fill();
        } else if (d.kind === 'bush') { // carrot tops
          c.fillStyle = '#ff8a1f'; c.beginPath(); c.arc(d.x, d.y + 1, 5, Math.PI, 0); c.fill();
          c.strokeStyle = '#3fae3a'; c.lineWidth = 2;
          for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(d.x, d.y - 3); c.quadraticCurveTo(d.x + i * 6, d.y - 12, d.x + i * 8 + Math.sin(t * 3 + d.x) * 1.5, d.y - 18); c.stroke(); }
        } else {
          window.THEMES.hills.decor(c, d, t);
        }
      }
    }
  };

  window.LEVELS = LEVELS;
  window.THEMES = THEMES;
  window.hash01 = hash;
})();

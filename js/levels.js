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
    { id: 2, name: 'Cloud Kingdom', subtitle: 'In the clouds', theme: 'clouds', music: 'level2', seedsNeeded: 8, time: 300, comingSoon: true },
    { id: 3, name: 'Secret Garden', subtitle: 'Through the garden', theme: 'garden', music: 'level3', seedsNeeded: 11, time: 300, comingSoon: true }
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
    clouds: { card: ['#8fb8ff', '#ffffff'] },   // level 2 - to be built
    garden: { card: ['#ffb8e0', '#5fbf4a'] }    // level 3 - to be built
  };

  window.LEVELS = LEVELS;
  window.THEMES = THEMES;
  window.hash01 = hash;
})();

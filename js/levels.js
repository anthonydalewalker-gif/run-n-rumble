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
  const BASE = [
    {
      id: '1-1', world: 0, stage: 0, name: 'Meadow', subtitle: 'Sunny green hills', theme: 'hills', music: 'level1',
      time: 300, length: 9800, exit: { x: 9550, kind: 'flag' },
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
      id: '2-1', world: 1, stage: 0, name: 'Sky Trails', subtitle: 'Hop across the clouds', theme: 'clouds', music: 'level2',
      time: 300, length: 10400, exit: { x: 10120, kind: 'flag' },
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
      id: '3-1', world: 2, stage: 0, name: 'Streets', subtitle: 'Streets and rooftops', theme: 'city', music: 'level3',
      time: 300, length: 10500, exit: { x: 10250, kind: 'flag' },
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
      id: '4-1', world: 3, stage: 0, name: 'Docks', subtitle: 'Docks and deep water', theme: 'water', music: 'level4',
      time: 300, length: 10500, exit: { x: 10250, kind: 'flag' },
      bugSkin: 'crab', birdSkin: 'gull',
      // docks over the water (falling in just means swimming)
      ground: [[0, 700, 250], [860, 1400, 250], [1600, 2200, 250], [2400, 3000, 250], [5750, 6500, 250], [6650, 7300, 250],
               [7450, 8000, 250], [9800, 10500, 250]],
      // seabed: [x0, x1, y] - deep-dive sections just have a lower seabed. water: one flat surface for the whole level
      seabed: [[-50, 3000, 350], [3000, 5750, 620], [5750, 8000, 350], [8000, 9800, 620], [9800, 10550, 350]],
      water: [[-50, 10550, 272]],
      logs: [[745, 246, 75], [1450, 246, 100, { ax: 20 }], [2250, 246, 100], [6520, 246, 110, { ax: 25 }], [7320, 246, 110]],
      coral: [[3500, 520, 60], [4100, 470, 50], [4700, 540, 80], [5200, 490, 60], [8500, 510, 60], [9100, 470, 60]],
      bugs: [[500], [1100], [1800], [2600], [3800], [4500], [6000], [6900], [7700], [8600], [10000]],
      birds: [[1000], [2500], [6200], [7600]],
      fish: [[3300], [3700], [4000], [4400], [4900], [5300], [8300], [8700], [9000], [9400]],
      jellies: [[3600, 420], [4300, 380], [4900, 460], [5400, 400], [8400, 430], [8900, 390], [9500, 450]],
      power: { first: 5, min: 8, max: 13 }
    },
    {
      id: '5-1', world: 4, stage: 0, name: 'Moon Base', subtitle: 'Low gravity on the moon', theme: 'space', music: 'level5',
      time: 300, length: 11000, exit: { x: 10750, kind: 'flag' },
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

  // ---------- 15-level campaign: 5 worlds x 3 stages (stage 3 = boss) ----------
  const WORLDS = [
    { name: 'Green Hills', theme: 'hills' }, { name: 'Cloud Kingdom', theme: 'clouds' }, { name: 'Rooftop City', theme: 'city' },
    { name: 'Deep Blue Bay', theme: 'water' }, { name: 'Star Station', theme: 'space' }
  ];
  const range = (a, b, step, f) => { const r = []; for (let x = a; x < b; x += step) r.push(f ? f(x) : [x]); return r; };
  const STAGE2 = [
    {
      id: '1-2', world: 0, stage: 1, name: 'Caves & Mines', subtitle: 'Dark tunnels and crumbling ledges', theme: 'cave', music: 'level1b',
      time: 300, length: 9000, exit: { x: 8750, kind: 'flag' }, dark: true, birdSkin: 'bat', rockSkin: 'rock',
      ground: [[0, 900, 300], [1000, 1700, 290], [1900, 2500, 300], [2750, 3400, 280], [3550, 4300, 300], [4600, 5300, 290],
               [5450, 6200, 300], [6500, 7100, 280], [7300, 8000, 300], [8150, 9000, 300]],
      crumble: [[1740, 272, 110], [2560, 262, 130], [4340, 280, 90], [4465, 268, 85], [6250, 272, 95], [6380, 262, 80], [7150, 276, 100]],
      blocks: [[1300, 200, 110], [3000, 195, 100], [5000, 190, 110], [7600, 195, 110]],
      bugs: [[700], [1250], [1500], [2100], [2300], [2950], [3200], [3800], [4100], [4800], [5100], [5700], [6000], [6700], [7500], [7800], [8400]],
      birds: [[1100], [1950], [2800], [3600], [4500], [5300], [6100], [6900], [7700], [8300]],
      snakes: [[3300], [6950]],
      rocks: [[2000, 2500], [5500, 6100], [7400, 7950]],
      power: { first: 6, min: 9, max: 15 }
    },
    {
      id: '2-2', world: 1, stage: 1, name: 'Storm Peaks', subtitle: 'Lightning, wind and mountain tops', theme: 'peaks', music: 'level2b',
      time: 300, length: 10000, exit: { x: 9750, kind: 'flag' },
      ground: [[0, 900, 300], [1050, 1700, 270], [1900, 2500, 250], [2700, 3300, 280], [3500, 4100, 255], [4300, 4900, 240],
               [5100, 5800, 270], [6000, 6600, 250], [6800, 7400, 280], [7600, 8200, 255], [8400, 9000, 270], [9200, 10000, 290]],
      clouds: [[1735, 262, 130, 'drift', { ax: 25, period: 4 }], [2550, 252, 110, 'fade'], [3360, 280, 110, 'bounce'], [4960, 250, 110, 'fade'],
               [5855, 258, 110, 'drift', { ay: 18, period: 3 }], [7450, 265, 110, 'fade'], [8255, 262, 110, 'bounce']],
      blocks: [[1350, 170, 100], [4600, 150, 100], [7900, 160, 100]],
      bugs: [[600], [1300], [2100], [2900], [3100], [3700], [3900], [4500], [5300], [5600], [6200], [6400], [7000], [7800], [8600], [9400], [9600]],
      birds: [[900], [1800], [2600], [3400], [4200], [5000], [5900], [6700], [7500], [8300], [9100]],
      snakes: [[4700], [8900]],
      lightning: [[1000, 2600], [3400, 5000], [6000, 7500], [8400, 9700]],
      wind: [[2600, 4200], [5000, 6800], [7500, 9200]],
      power: { first: 5, min: 8, max: 14 }
    },
    {
      id: '3-2', world: 2, stage: 1, name: 'Subway', subtitle: 'Get up on the platforms when trains come!', theme: 'subway', music: 'level3b',
      time: 300, length: 9600, exit: { x: 9380, kind: 'flag' }, bugSkin: 'trash', birdSkin: 'pigeon',
      ground: [[0, 2620, 300], [2740, 5440, 300], [5560, 7790, 300], [7910, 9600, 300]],
      walks: range(420, 9100, 470, x => [x, 222, 290]),
      trains: [[700, 9100]],
      blocks: [],
      bugs: [[800], [1300], [1900], [2300], [2900], [3400], [3900], [4600], [5000], [5700], [6200], [6700], [7300], [8200], [8800]],
      birds: [[1500], [3000], [4500], [6000], [7500], [8600]],
      snakes: [[6500]],
      power: { first: 5, min: 8, max: 13 }
    },
    {
      id: '4-2', world: 3, stage: 1, name: 'Coral Reef', subtitle: 'Swim through the reef - watch for eels!', theme: 'reef', music: 'level4b',
      time: 300, length: 9200, exit: { x: 9000, kind: 'flag' }, bugSkin: 'crab', birdSkin: 'gull',
      ground: [[0, 600, 250], [8600, 9200, 250]],
      seabed: [[-50, 600, 350], [600, 2600, 600], [2600, 3200, 470], [3200, 5600, 610], [5600, 6100, 480], [6100, 8600, 600], [8600, 9250, 350]],
      water: [[-50, 9250, 272]],
      coral: [[900, 520, 60], [1300, 470, 50], [1800, 530, 70], [2200, 480, 50], [2750, 420, 70], [3500, 500, 60], [3950, 450, 50], [4400, 520, 70],
              [4900, 470, 60], [5300, 530, 50], [5750, 430, 70], [6400, 500, 60], [6900, 460, 50], [7400, 520, 70], [7900, 470, 60], [8300, 520, 50]],
      eels: [[1550, 560], [2400, 560], [3700, 570], [4650, 570], [6650, 560], [7650, 560], [8150, 560]],
      fish: range(800, 8500, 420),
      jellies: [[1100, 420], [1700, 380], [2900, 360], [3300, 430], [4200, 400], [5000, 420], [5900, 380], [6300, 440], [7100, 400], [7800, 430]],
      bugs: [[400], [8800]],
      birds: [[300], [8700]],
      power: { first: 6, min: 9, max: 14 }
    },
    {
      id: '5-2', world: 4, stage: 1, name: 'Asteroid Belt', subtitle: 'Floating rocks and fast meteors', theme: 'asteroids', music: 'level5b',
      time: 300, length: 10000, exit: { x: 9750, kind: 'flag' }, gravity: 0.45, jumpScale: 0.72,
      bugSkin: 'alien', birdSkin: 'ufo', rockSkin: 'meteor', rockRate: [0.6, 1.3], fastMeteors: true,
      ground: [[0, 700, 300], [1300, 1700, 280], [2400, 2800, 290], [3500, 3900, 270], [4600, 5000, 300], [5700, 6100, 280],
               [6800, 7200, 290], [7900, 8300, 270], [9000, 10000, 300]],
      floaters: [[810, 262, 120], [1010, 240, 120, { ax: 40, period: 4 }], [1190, 268, 100],
                 [1810, 255, 120, { ay: 30, period: 3 }], [2020, 232, 110], [2220, 262, 120, { ax: 30, period: 5 }],
                 [2910, 262, 110], [3110, 236, 120, { ay: 25, period: 3.5 }], [3320, 252, 110],
                 [4010, 245, 120], [4220, 222, 110, { ax: 40, period: 4 }], [4430, 262, 110],
                 [5110, 262, 120, { ax: 30, period: 4 }], [5320, 240, 110], [5520, 262, 110, { ay: 25, period: 3 }],
                 [6210, 255, 120], [6420, 232, 110, { ax: 35, period: 4.5 }], [6620, 262, 110],
                 [7310, 262, 120, { ay: 30, period: 3.2 }], [7520, 238, 110], [7720, 252, 110, { ax: 30, period: 4 }],
                 [8410, 248, 120], [8620, 226, 110, { ay: 25, period: 3.6 }], [8820, 262, 120]],
      bugs: [[500], [1500], [2600], [3700], [4800], [5900], [7000], [8100], [9300], [9600]],
      birds: [[1000], [2200], [3300], [4400], [5500], [6600], [7700], [8800]],
      rocks: [[900, 3500], [4000, 6800], [7000, 9500]],
      power: { first: 5, min: 8, max: 13 }
    }
  ];
  const BOSSES = [
    { id: '1-3', world: 0, stage: 2, name: 'Potato King', subtitle: 'Stomp his head 3 times!', theme: 'hills', music: 'boss1', boss: 'potato', exit: { x: 910, kind: 'tree' },
      ground: [[0, 1000, 300]] },
    { id: '2-3', world: 1, stage: 2, name: 'Thunder Bird', subtitle: 'Free Pipple from the storm bird!', theme: 'clouds', music: 'boss2', boss: 'thunder', exit: { x: 910, kind: 'rainbow' },
      ground: [[0, 1000, 290]] },
    { id: '3-3', world: 2, stage: 2, name: 'Pigeon Boss', subtitle: 'Knock the Pigeon Boss off his crane!', theme: 'city', music: 'boss3', boss: 'pigeon', exit: { x: 910, kind: 'pier' },
      bugSkin: 'trash', rockSkin: 'pot', ground: [[0, 1000, 300]] },
    { id: '4-3', world: 3, stage: 2, name: 'Giant Crab', subtitle: 'Free Squib from the sunken ship!', theme: 'water', music: 'boss4', boss: 'crab', exit: { x: 920, kind: 'submarine' },
      bugSkin: 'crab', ground: [[0, 150, 250]], seabed: [[-50, 1050, 520]], water: [[-50, 1050, 272]], sunken: true },
    { id: '5-3', world: 4, stage: 2, name: 'Glitch Monster', subtitle: 'Beat the soda glitch and go home!', theme: 'space', music: 'boss5', boss: 'glitch', exit: { x: 910, kind: 'portal' },
      gravity: 0.45, jumpScale: 0.72, bugSkin: 'alien', rockSkin: 'meteor', ground: [[0, 1000, 300]] }
  ];
  BOSSES.forEach(b => Object.assign(b, { time: 300, length: 1000, power: { first: 7, min: 10, max: 15 } }));
  const LEVELS = [];
  for (let w = 0; w < 5; w++) LEVELS.push(BASE[w], STAGE2[w], BOSSES[w]);
  LEVELS.forEach((L, i) => { L.idx = i; L.worldName = WORLDS[L.world].name; });

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

  // ---------- stage-2 themes ----------
  Object.assign(THEMES, {
    cave: {
      solid: 'earth', dirtBase: '#5a4658', grass: ['#a89ab8', '#6a5a7a'], card: ['#6a5a8a', '#2a2238'],
      background(c, camX, VW, VH, t) {
        sky(c, VW, VH, '#1a1424', '#3a2c3e');
        // far rock wall with glowing crystals
        hillLayer(c, camX, VW, VH, 0.15, 120, 60, 0.006, 3, 'rgba(70,56,86,1)', 'rgba(40,32,52,1)');
        const off = camX * 0.15;
        for (let k = Math.floor(off / 90) - 1; k < (off + VW) / 90 + 1; k++) {
          if (hash(k + 11) < 0.55) continue;
          const x = k * 90 - off + hash(k) * 50, y = 150 + hash(k + 2) * 120, gl = 0.5 + 0.5 * Math.sin(t * 2 + k);
          c.fillStyle = 'rgba(120,220,255,' + (0.25 + gl * 0.35) + ')';
          c.beginPath(); c.moveTo(x, y - 12); c.lineTo(x + 5, y); c.lineTo(x - 5, y); c.fill();
          c.fillStyle = 'rgba(200,120,255,' + (0.2 + gl * 0.3) + ')'; c.beginPath(); c.moveTo(x + 7, y - 8); c.lineTo(x + 10, y); c.lineTo(x + 4, y); c.fill();
        }
        // mine supports
        const o2 = camX * 0.45;
        for (let k = Math.floor(o2 / 260) - 1; k < (o2 + VW) / 260 + 1; k++) {
          const x = k * 260 - o2;
          c.fillStyle = '#4a3420'; c.fillRect(x, 60, 10, 260); c.fillRect(x + 120, 60, 10, 260); c.fillRect(x - 6, 54, 142, 12);
          const lx = x + 65, ly = 82, fl = 0.8 + 0.2 * Math.sin(t * 9 + k * 3);
          const lg = c.createRadialGradient(lx, ly, 2, lx, ly, 60 * fl); lg.addColorStop(0, 'rgba(255,200,100,.45)'); lg.addColorStop(1, 'rgba(255,200,100,0)');
          c.fillStyle = lg; c.fillRect(lx - 60, ly - 60, 120, 120);
          c.fillStyle = '#ffd27a'; c.beginPath(); c.arc(lx, ly, 4, 0, 7); c.fill();
          c.strokeStyle = '#2a1a10'; c.lineWidth = 1; c.beginPath(); c.moveTo(lx, 66); c.lineTo(lx, ly - 4); c.stroke();
        }
        // stalactites along the ceiling
        c.fillStyle = '#2a2034';
        const o3 = camX * 0.6;
        for (let k = Math.floor(o3 / 40) - 1; k < (o3 + VW) / 40 + 1; k++) {
          const x = k * 40 - o3, h = 10 + hash(k + 99) * 40;
          c.beginPath(); c.moveTo(x - 14, 0); c.lineTo(x + 14, 0); c.lineTo(x + 2, h); c.closePath(); c.fill();
        }
      },
      decor(c, d, t) {
        if (d.kind === 'flower') { // glowing crystal
          const gl = 0.6 + 0.4 * Math.sin(t * 3 + d.x);
          c.fillStyle = 'rgba(120,220,255,' + gl + ')'; c.beginPath(); c.moveTo(d.x, d.y - 16); c.lineTo(d.x + 5, d.y); c.lineTo(d.x - 5, d.y); c.fill();
          c.fillStyle = 'rgba(220,150,255,' + gl + ')'; c.beginPath(); c.moveTo(d.x + 6, d.y - 10); c.lineTo(d.x + 9, d.y); c.lineTo(d.x + 3, d.y); c.fill();
        } else if (d.kind === 'bush') { // ore cart
          c.fillStyle = '#6a6a7a'; D.rr(c, d.x - 12, d.y - 14, 24, 10, 2); c.fill();
          c.fillStyle = '#ffd21f'; c.beginPath(); c.arc(d.x - 4, d.y - 14, 3, 0, 7); c.arc(d.x + 3, d.y - 15, 3.5, 0, 7); c.fill();
          c.fillStyle = '#222'; c.beginPath(); c.arc(d.x - 7, d.y - 3, 3, 0, 7); c.arc(d.x + 7, d.y - 3, 3, 0, 7); c.fill();
        } else { c.fillStyle = '#c8b89a'; c.beginPath(); c.arc(d.x, d.y - 4, 4, 0, 7); c.fill(); c.fillStyle = '#7a6a5a'; c.fillRect(d.x - 1, d.y - 4, 2, 4); }
      }
    },
    peaks: {
      solid: 'earth', dirtBase: '#6e7290', grass: ['#ffffff', '#c8d6f0'], card: ['#5a6aa0', '#c8d0f0'],
      background(c, camX, VW, VH, t) {
        sky(c, VW, VH, '#3a3a6a', '#9a90c0');
        // stormy clouds
        for (let i = 0; i < 8; i++) { let x = (hash(i + 70) * 1900 - (camX * 0.1 + t * 14)) % 1900; if (x < -180) x += 1900; cloud(c, x, 30 + hash(i + 71) * 60, 1 + hash(i + 72) * 0.7, 'rgba(90,90,130,.85)'); }
        if (Math.sin(t * 1.3) > 0.985) { c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(0, 0, VW, VH); }
        // far mountains with snow caps
        const mtn = (par, base, h, gap, col, seed) => {
          const off = camX * par;
          for (let k = Math.floor(off / gap) - 1; k < (off + VW) / gap + 2; k++) {
            const x = k * gap - off + hash(k + seed) * gap * 0.3, hh = h * (0.6 + hash(k * 2 + seed) * 0.5);
            c.fillStyle = col; c.beginPath(); c.moveTo(x - gap * 0.7, base); c.lineTo(x, base - hh); c.lineTo(x + gap * 0.7, base); c.fill();
            c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.moveTo(x - hh * 0.18, base - hh * 0.75); c.lineTo(x, base - hh); c.lineTo(x + hh * 0.18, base - hh * 0.75); c.lineTo(x + 4, base - hh * 0.8); c.fill();
          }
        };
        mtn(0.12, 290, 200, 220, '#6a6a9a', 1);
        mtn(0.3, 330, 170, 180, '#4a4a78', 5);
      },
      decor(c, d, t) {
        if (d.kind === 'flower') { c.fillStyle = '#e8f0ff'; D.star(c, d.x, d.y - 5, 4, t * 0.3); c.fill(); }   // ice crystal
        else if (d.kind === 'bush') { c.fillStyle = '#3a6a4a'; c.beginPath(); c.moveTo(d.x, d.y - 22); c.lineTo(d.x + 9, d.y); c.lineTo(d.x - 9, d.y); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(d.x, d.y - 22); c.lineTo(d.x + 4, d.y - 12); c.lineTo(d.x - 4, d.y - 12); c.fill(); }   // snowy pine
        else { c.fillStyle = '#8a8aa8'; c.beginPath(); c.arc(d.x, d.y, 6, Math.PI, 0); c.fill(); }
      }
    },
    subway: {
      solid: 'subway', card: ['#e0a040', '#3a3a4a'],
      background(c, camX, VW, VH, t) {
        sky(c, VW, VH, '#2a2a36', '#4a4a58');
        // tiled tunnel wall
        const off = camX * 0.5;
        c.fillStyle = '#d8d4c8'; c.fillRect(0, 70, VW, 150);
        c.strokeStyle = 'rgba(120,110,100,.35)'; c.lineWidth = 1;
        for (let y = 70; y < 220; y += 12) { c.beginPath(); c.moveTo(0, y); c.lineTo(VW, y); c.stroke(); }
        for (let x = -(off % 24); x < VW; x += 24) { c.beginPath(); c.moveTo(x, 70); c.lineTo(x, 220); c.stroke(); }
        c.fillStyle = '#2f7fe0'; c.fillRect(0, 120, VW, 10);
        for (let k = Math.floor(off / 420) - 1; k < (off + VW) / 420 + 1; k++) {
          const x = k * 420 - off;
          // station sign + poster
          c.fillStyle = '#1b2a4a'; D.rr(c, x + 40, 84, 120, 26, 4); c.fill();
          c.fillStyle = '#fff'; c.font = 'bold 13px ' + D.FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(['RUMBLE ST', 'TUBBY AVE', 'DASH SQ', 'SODA PARK'][((k % 4) + 4) % 4], x + 100, 97);
          c.fillStyle = ['#ff6a8a', '#ffd21f', '#6ad0ff'][((k % 3) + 3) % 3]; c.fillRect(x + 250, 140, 60, 70); c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(x + 258, 150, 44, 10); c.fillRect(x + 258, 168, 30, 6);
          c.fillStyle = '#3a3a48'; c.fillRect(x + 200, 70, 8, 160);
        }
        // ceiling lights
        c.fillStyle = '#3a3a48'; c.fillRect(0, 0, VW, 70);
        for (let k = Math.floor(off / 160) - 1; k < (off + VW) / 160 + 1; k++) {
          const x = k * 160 - off;
          c.fillStyle = '#fff8d0'; c.fillRect(x, 60, 60, 6);
          const lg = c.createLinearGradient(0, 66, 0, 160); lg.addColorStop(0, 'rgba(255,248,200,.25)'); lg.addColorStop(1, 'rgba(255,248,200,0)');
          c.fillStyle = lg; c.beginPath(); c.moveTo(x, 66); c.lineTo(x + 60, 66); c.lineTo(x + 90, 160); c.lineTo(x - 30, 160); c.fill();
        }
        c.fillStyle = '#1e1e28'; c.fillRect(0, 220, VW, VH);
      },
      decor(c, d, t) {
        if (d.kind === 'flower') { c.fillStyle = '#c8a040'; c.fillRect(d.x - 1, d.y - 8, 2, 8); }
        else if (d.kind === 'bush') { c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(d.x - 10, d.y - 2, 20, 2); }
      }
    },
    reef: {
      solid: 'water', card: ['#3ad0c0', '#1a3f8a'],
      background(c, camX, VW, VH, t) {
        THEMES.water.background(c, camX, VW, VH, t);
        c.fillStyle = 'rgba(40,180,200,.25)'; c.fillRect(0, 292, VW, VH);
      },
      decor(c, d, t) { THEMES.water.decor(c, d, t); }
    },
    asteroids: {
      solid: 'moon', card: ['#5a3aa0', '#1a0a3a'],
      background(c, camX, VW, VH, t) {
        THEMES.space.background(c, camX, VW, VH, t);
        // drifting far asteroids
        for (let i = 0; i < 14; i++) {
          const x = ((hash(i + 200) * 2000 - camX * (0.1 + hash(i + 201) * 0.15) - t * 8) % 2000 + 2000) % 2000 - 100;
          if (x > VW + 40) continue;
          const y = 40 + hash(i + 202) * 220, r = 6 + hash(i + 203) * 16;
          c.fillStyle = 'rgba(140,120,180,.55)'; c.beginPath(); c.ellipse(x, y, r, r * 0.8, t * 0.2 + i, 0, 7); c.fill();
          c.fillStyle = 'rgba(60,50,90,.5)'; c.beginPath(); c.arc(x + r * 0.2, y, r * 0.25, 0, 7); c.fill();
        }
      },
      decor(c, d, t) { THEMES.space.decor(c, d, t); }
    }
  });

  window.LEVELS = LEVELS;
  window.WORLDS = WORLDS;
  window.THEMES = THEMES;
  window.hash01 = hash;
})();

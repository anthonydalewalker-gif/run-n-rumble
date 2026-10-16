// Run N Rumble - audio: synthesized sound effects + music.
// Custom MP3s in audio/<track>.mp3 (e.g. audio/level1.mp3) replace the built-in tunes automatically.
(function () {
  'use strict';
  let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem('rnr_muted_v2') === '1'; } catch (e) {}

  // ---------- custom MP3 detection ----------
  const fileTracks = {};      // name -> HTMLAudioElement when it loaded OK
  const probing = {};
  function probe(name) {
    if (probing[name]) return;
    probing[name] = true;
    if (location.protocol === 'file:') return;          // can't check files offline from disk
    fetch('audio/' + name + '.mp3', { method: 'HEAD', cache: 'no-cache' }).then(r => {
      if (!r.ok) return;                                 // no custom track: built-in music keeps playing
      const a = new Audio('audio/' + name + '.mp3');
      a.preload = 'auto'; a.loop = true; a.muted = muted;
      a.setAttribute('playsinline', '');
      fileTracks[name] = a;
      if (currentTrack === name && ctx) { stopSynth(); playFile(name); }
    }).catch(() => {});
  }

  // ---------- core ----------
  // A tiny silent WAV played through an <audio> element. On iPhone this moves the page onto the
  // "media" audio channel so Web Audio is heard even when the ring/silent switch is on silent.
  let silentEl = null;
  function silentWavUrl() {
    const n = 4410, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 44100, true); v.setUint32(28, 88200, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    w(36, 'data'); v.setUint32(40, n * 2, true);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }

  function create() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.16; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    ctx.onstatechange = () => { if (ctx.state === 'running' && pendingTrack) { const t = pendingTrack; pendingTrack = null; currentTrack = null; playMusic(t); } };
  }

  // Must be called synchronously from inside a user gesture (touchstart/touchend/click/keydown).
  function unlock() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    if (!ctx) create();
    if (!ctx) return;
    if (ctx.state !== 'running') {
      const p = ctx.resume(); if (p && p.catch) p.catch(() => {});
      // Play a 1-sample silent buffer: the classic iOS Web Audio unlock.
      try { const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (e) {}
    }
    if (!silentEl) {
      silentEl = new Audio(silentWavUrl());
      silentEl.loop = true; silentEl.setAttribute('playsinline', ''); silentEl.volume = 0.01;
    }
    if (silentEl.paused && !document.hidden) { const p = silentEl.play(); if (p && p.catch) p.catch(() => {}); }
    // Let custom MP3 tracks play later without another gesture.
    Object.keys(fileTracks).forEach(k => {
      const a = fileTracks[k]; if (a._primed) return; a._primed = true;
      if (playingFile === a) return;
      const p = a.play(); if (p && p.then) p.then(() => { if (playingFile !== a) a.pause(); }).catch(() => { a._primed = false; });
    });
    if (pendingTrack) { const t = pendingTrack; pendingTrack = null; playMusic(t); }
    else if (playingFile && playingFile.paused && !document.hidden) { const p = playingFile.play(); if (p && p.catch) p.catch(() => {}); }
  }
  const init = unlock;

  function tone(f0, f1, dur, type, vol, delay, bus) {
    if (!ctx) return;
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, ftype, f0, f1, vol, delay, q) {
    if (!ctx) return;
    const t = ctx.currentTime + (delay || 0);
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = ftype || 'lowpass'; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  const sfx = {
    jump()     { tone(330, 760, 0.16, 'triangle', 0.35); tone(660, 1500, 0.12, 'sine', 0.08); },
    squish()   { noise(0.2, 'lowpass', 900, 150, 0.6); tone(220, 55, 0.22, 'sine', 0.5); },
    poof()     { noise(0.35, 'bandpass', 3500, 900, 0.5, 0, 0.8); tone(900, 1800, 0.08, 'sine', 0.12, 0.02); tone(1200, 2200, 0.08, 'sine', 0.1, 0.08); },
    bonk()     { tone(520, 260, 0.12, 'square', 0.18); noise(0.08, 'lowpass', 1200, 300, 0.3); },
    fire()     { noise(0.4, 'bandpass', 300, 1800, 0.45, 0, 1.5); tone(120, 60, 0.3, 'sawtooth', 0.06); },
    thud()     { tone(140, 35, 0.35, 'sine', 0.7); noise(0.3, 'lowpass', 500, 80, 0.55); },
    whistle()  { tone(1800, 700, 0.45, 'sine', 0.05); },
    powerup()  { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.12, 'triangle', 0.25, i * 0.06)); },
    seed()     { tone(988, 988, 0.08, 'sine', 0.3); tone(1480, 1480, 0.18, 'sine', 0.3, 0.07); },
    hit()      { tone(440, 110, 0.3, 'square', 0.2); tone(300, 80, 0.3, 'sawtooth', 0.12); },
    shield()   { tone(1200, 600, 0.2, 'triangle', 0.25); noise(0.15, 'highpass', 4000, 2000, 0.15); },
    smash()    { noise(0.25, 'lowpass', 2000, 200, 0.6); tone(180, 60, 0.25, 'square', 0.2); },
    lifelost() { [660, 520, 400, 280].forEach((f, i) => tone(f, f * 0.95, 0.18, 'triangle', 0.3, i * 0.14)); },
    gameover() { [523, 466, 392, 330, 262].forEach((f, i) => tone(f, f, 0.3, 'triangle', 0.3, i * 0.22)); },
    complete() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, f, i === 6 ? 0.6 : 0.16, 'triangle', 0.3, i * 0.11)); },
    grow()     { for (let i = 0; i < 8; i++) tone(400 + i * 90, 500 + i * 90, 0.1, 'sine', 0.15, i * 0.07); },
    boing()    { tone(180, 720, 0.25, 'sine', 0.4); tone(360, 1100, 0.2, 'triangle', 0.12, 0.03); },
    zap()      { noise(0.45, 'highpass', 6000, 800, 0.6); tone(90, 40, 0.5, 'sawtooth', 0.25); noise(0.6, 'lowpass', 400, 60, 0.5, 0.05); },
    candown()  { tone(420, 300, 0.06, 'triangle', 0.4); noise(0.05, 'bandpass', 2500, 1500, 0.3, 0, 3); tone(300, 220, 0.05, 'triangle', 0.3, 0.07); },
    fizz()     { for (let i = 0; i < 10; i++) noise(0.05, 'highpass', 7000 + Math.random() * 3000, 9000, 0.08 + Math.random() * 0.06, i * 0.07 + Math.random() * 0.03); },
    spill()    { noise(1.1, 'lowpass', 900, 250, 0.45, 0, 2); for (let i = 0; i < 6; i++) tone(500 + Math.random() * 300, 200, 0.08, 'sine', 0.15, 0.1 + i * 0.15); },
    whoosh()   { noise(0.9, 'bandpass', 300, 3000, 0.5, 0, 2); tone(120, 600, 0.9, 'sine', 0.2); },
    crackle()  { for (let i = 0; i < 5; i++) noise(0.04, 'bandpass', 3000 + i * 400, 2000, 0.12, i * 0.12, 4); },
    wind()     { noise(1.8, 'bandpass', 300, 1400, 0.35, 0, 2.5); noise(1.6, 'bandpass', 700, 2600, 0.15, 0.3, 3); },
    chomp()    { tone(260, 120, 0.08, 'square', 0.12); noise(0.08, 'lowpass', 1500, 300, 0.25); },
    click()    { tone(700, 900, 0.05, 'triangle', 0.2); },
    deny()     { tone(200, 160, 0.15, 'square', 0.12); }
  };

  // ---------- music ----------
  // Simple step sequencer. Notes are MIDI numbers, 0 = rest. 8th-note steps.
  const SONGS = {
    title: {
      bpm: 116,
      lead: [72,0,76,79, 84,0,79,76, 77,0,81,84, 81,0,77,0, 76,0,79,84, 88,0,84,79, 81,79,77,76, 74,0,0,0,
             72,0,76,79, 84,0,79,76, 77,0,81,84, 86,0,84,81, 79,0,76,72, 74,76,77,79, 72,0,0,0, 0,0,0,0],
      bass: [48,0,55,0, 48,0,55,0, 53,0,60,0, 53,0,60,0, 48,0,55,0, 45,0,52,0, 50,0,57,0, 55,0,50,0,
             48,0,55,0, 48,0,55,0, 53,0,60,0, 50,0,57,0, 48,0,55,0, 43,0,50,0, 48,0,43,0, 48,0,0,0]
    },
    level1: {
      bpm: 140,
      lead: [76,0,76,0, 72,76,0,79, 0,0,67,0, 0,0,0,0, 72,0,0,67, 0,0,64,0, 0,69,0,71, 0,70,69,0,
             67,76,79,81, 0,77,79,0, 76,0,72,74, 71,0,0,0, 72,0,0,67, 0,0,64,0, 0,69,0,71, 0,70,69,0],
      bass: [48,0,55,0, 48,0,55,0, 43,0,50,0, 43,0,50,0, 48,0,55,0, 45,0,52,0, 41,0,48,0, 43,0,47,0,
             48,0,55,0, 53,0,60,0, 48,0,55,0, 43,0,50,0, 48,0,55,0, 45,0,52,0, 41,0,48,0, 43,0,47,0]
    }
  };
  // Level 2: floaty, dreamy arpeggios. Level 3: bouncy and a bit more intense.
  SONGS.level2 = {
    bpm: 124,
    lead: [79,0,83,86, 0,83,79,0, 81,0,84,88, 0,84,81,0, 76,0,79,83, 0,79,76,0, 74,76,78,79, 81,0,0,0,
           79,0,83,86, 0,88,86,0, 84,0,81,84, 0,79,76,0, 77,0,81,84, 83,0,79,0, 81,79,78,76, 79,0,0,0],
    bass: [43,0,50,0, 55,0,50,0, 45,0,52,0, 57,0,52,0, 40,0,47,0, 52,0,47,0, 38,0,45,0, 50,0,45,0,
           43,0,50,0, 55,0,50,0, 45,0,52,0, 57,0,52,0, 41,0,48,0, 40,0,47,0, 38,0,45,0, 43,0,0,0]
  };
  SONGS.level3 = {
    bpm: 150,
    lead: [69,0,72,76, 0,74,72,0, 71,0,74,77, 0,76,74,0, 72,0,76,79, 81,0,79,76, 74,0,71,0, 72,74,76,0,
           69,0,72,76, 0,74,72,0, 71,0,74,77, 79,0,77,74, 76,0,72,69, 71,72,74,71, 69,0,0,0, 64,0,0,0],
    bass: [45,0,45,57, 45,0,45,57, 43,0,43,55, 43,0,43,55, 41,0,41,53, 41,0,41,53, 40,0,40,52, 40,0,44,0,
           45,0,45,57, 45,0,45,57, 43,0,43,55, 43,0,43,55, 41,0,41,53, 40,0,40,52, 45,0,40,0, 45,0,0,0]
  };
  // Level 4: wavy, swaying water tune. Level 5: spacey and floaty.
  SONGS.level4 = {
    bpm: 112,
    lead: [74,0,77,81, 0,79,77,0, 76,0,79,83, 0,81,79,0, 77,0,81,84, 0,83,81,0, 79,77,76,74, 76,0,0,0,
           74,0,77,81, 0,84,81,0, 79,0,76,79, 0,77,74,0, 72,0,76,79, 77,0,76,0, 74,76,77,79, 74,0,0,0],
    bass: [50,0,57,0, 62,0,57,0, 48,0,55,0, 60,0,55,0, 46,0,53,0, 58,0,53,0, 45,0,52,0, 57,0,52,0,
           50,0,57,0, 62,0,57,0, 43,0,50,0, 55,0,50,0, 45,0,52,0, 57,0,52,0, 50,0,45,0, 50,0,0,0]
  };
  SONGS.level5 = {
    bpm: 128,
    lead: [84,0,0,79, 0,0,76,0, 83,0,0,79, 0,0,74,0, 81,0,0,77, 0,0,72,0, 79,81,83,86, 88,0,0,0,
           84,0,0,79, 0,0,76,0, 86,0,0,81, 0,0,77,0, 83,0,79,0, 76,0,74,0, 72,74,76,79, 72,0,0,0],
    bass: [36,0,48,0, 36,0,48,0, 41,0,53,0, 41,0,53,0, 38,0,50,0, 38,0,50,0, 43,0,55,0, 43,0,55,0,
           36,0,48,0, 36,0,48,0, 41,0,53,0, 41,0,53,0, 44,0,56,0, 43,0,55,0, 43,0,47,0, 36,0,0,0]
  };


  // ---------- Title theme (composed by the user) ----------
  // Melody C5 E5 G5 A5 | G5 E5 C5 | F5 A5 C6 | B5 G5 D5 over C -> F -> G -> G7, rhythm quarter-eighth-eighth
  // applied cyclically inside each bar (the phrase's last note rings to the end of the bar).
  // 8-bar loop @144 BPM in 16th-note steps: bars 1-4 marimba + rolls + ticks, bars 5-8 add chiptune
  // arpeggios, bass and drums with an opening filter, and bar 8 is a rising "countdown" roll back to the top.
  const TitleSong = (function () {
    const BPM = 144, SD = 60 / BPM / 4, STEPS = 128;
    const PHR = [[72, 76, 79, 81], [79, 76, 72], [77, 81, 84], [83, 79, 74]];
    const CH = [[60, 64, 67], [65, 69, 72], [67, 71, 74], [67, 71, 74, 77]];
    const ROOT = [36, 41, 43, 43];
    const RHY = [4, 2, 2];
    const MEL = PHR.map(ph => {   // [startStep, note, lengthSteps]
      const out = []; let pos = 0;
      ph.forEach((n, k) => { const d = RHY[k % 3]; out.push([pos, n, d]); pos += d; });
      out[out.length - 1][2] = 16 - out[out.length - 1][0];
      return out;
    });
    const hz = n => 440 * Math.pow(2, (n - 69) / 12);
    const noiseCache = new WeakMap();
    function noise(c) {
      let b = noiseCache.get(c);
      if (!b) { b = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; noiseCache.set(c, b); }
      return b;
    }
    function env(c, out, t, vol, dur) {
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.connect(out); return g;
    }
    function osc(c, type, f, t, dur, g) { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + dur + 0.03); }
    function marimba(c, out, n, t, vol, dur) {
      dur = Math.min(dur || 0.5, 0.6);
      const f = hz(n);
      osc(c, 'sine', f, t, dur, env(c, out, t, vol, dur));
      osc(c, 'sine', f * 3.93, t, 0.07, env(c, out, t, vol * 0.35, 0.07));   // woody upper partial
      osc(c, 'triangle', f * 2, t, 0.03, env(c, out, t, vol * 0.25, 0.03));   // mallet click
    }
    function chip(c, out, n, t, vol, dur, cutoff) {
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 4; f.connect(out);
      osc(c, 'square', hz(n), t, dur, env(c, f, t, vol, dur));
    }
    function kick(c, out, t, vol) {
      const o = c.createOscillator(), g = env(c, out, t, vol, 0.22);
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18); o.connect(g); o.start(t); o.stop(t + 0.25);
    }
    function nz(c, out, t, vol, dur, type, fr) {
      const s = c.createBufferSource(); s.buffer = noise(c);
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = fr; f.connect(env(c, out, t, vol, dur));
      s.connect(f); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    }
    // schedule everything that happens on loop step i at time t
    function play(c, out, t, i) {
      const bar = i >> 4, pos = i & 15, ph = bar & 3, B = bar >= 4, chord = CH[ph];
      const lift = B ? (bar - 4) / 3 : bar / 3;          // 0..1 build inside each half
      // melody
      for (const [st, n, d] of MEL[ph]) if (st === pos) {
        marimba(c, out, n, t, 0.5, d * SD * 1.6);
        if (B) chip(c, out, n, t, 0.11, d * SD * 0.9, 2500 + lift * 3000);
      }
      // ascending marimba rolls through the chord tones
      const tones = chord.concat(chord.map(x => x + 12), chord.map(x => x + 24));
      if (!B && pos >= 8) marimba(c, out, tones[(pos - 8) % tones.length] - 12, t, 0.12 + lift * 0.08, 0.25);
      if (B && bar < 7 && (pos >= 8 || bar === 6)) marimba(c, out, tones[pos % tones.length] - 12, t, 0.14 + lift * 0.06, 0.2);
      if (bar === 7) {   // countdown build: 32nd-note roll climbing two octaves + snare roll crescendo
        for (let h = 0; h < 2; h++) { const k = pos * 2 + h; marimba(c, out, tones[Math.min(tones.length - 1, Math.floor(k / 32 * tones.length))] - 12 + (k % 2) * 12, t + h * SD / 2, 0.1 + 0.2 * k / 32, 0.15); }
        if (pos >= 8) nz(c, out, t, 0.08 + 0.2 * (pos - 8) / 8, 0.08, 'bandpass', 1800);
        if (pos >= 12 && pos % 2 === 0) chip(c, out, 84 + (pos - 12) * 2, t, 0.08, SD * 1.8, 6000);   // 3.. 2.. 1..
      }
      // chiptune arpeggios (enter at bar 4 as a preview, full in the second half)
      if (B || bar === 3) {
        const arp = chord.concat([chord[0] + 12]);
        const n = arp[pos % arp.length] + 12;
        chip(c, out, n, t, (B ? 0.05 + lift * 0.04 : 0.035), SD * 0.8, (B ? 900 + lift * 4500 : 700 + pos * 60));
      }
      // bass
      if (pos === 0) marimba(c, out, ROOT[ph] + 12, t, 0.35, 0.5);
      if (B && pos % 4 === 0) osc(c, 'triangle', hz(ROOT[ph] + (pos === 8 ? 7 : 0)), t, SD * 3, env(c, out, t, 0.45, SD * 3.5));
      if (B && pos % 4 === 2) osc(c, 'triangle', hz(ROOT[ph] + 12), t, SD * 1.5, env(c, out, t, 0.3, SD * 2));
      // drums / ticks
      if (!B) { if (pos % 4 === 0 || (bar >= 2 && pos % 2 === 0)) nz(c, out, t, 0.04 + lift * 0.03, 0.03, 'highpass', 7000); if (pos === 0 && bar >= 2) kick(c, out, t, 0.5); }
      else {
        if (pos % 4 === 0) kick(c, out, t, 0.7);
        if (pos % 2 === 0) nz(c, out, t, 0.06, 0.035, 'highpass', 7000);
        if ((pos === 4 || pos === 12) && bar < 7) nz(c, out, t, 0.18, 0.12, 'bandpass', 1500);
        if (bar === 7 && pos === 15) nz(c, out, t, 0.25, 0.4, 'highpass', 3000);   // crash into the loop
      }
    }
    return { BPM, SD, STEPS, play, lib: { hz, env, osc, marimba, chip, kick, nz } };
  })();
  window.RNRTitleSong = TitleSong;
  SONGS.title = { custom: TitleSong };


  // ---------- Level 1 theme (composed by the user): "Running in the Sunshine" ----------
  // Eighth-note grid at 150 BPM; each written group of 4 symbols = 4 eighths = 2 beats, so each phrase
  // (4 groups) is 2 bars and the motif (2 phrases) is 4 bars, played twice over C - G/B - Am - F (one chord per bar)
  // for an 8-bar loop. '.' holds the previous note. Second pass adds a sparkle octave layer + fuller drums.
  const Level1Song = (function () {
    const { hz, env, osc, chip, kick, nz } = TitleSong.lib;
    const BPM = 150, SD = 60 / BPM / 2, STEPS = 64;
    const N = { B4: 71, C5: 72, D5: 74, E5: 76, F5: 77, G5: 79, A5: 81, B5: 83, C6: 84 };
    const GRID = ('C5 . E5 G5 C6 . B5 A5 G5 . E5 C5 D5 . . . ' +
                  'F5 . A5 C6 B5 . A5 G5 E5 . G5 C6 D5 . B4 C5').trim().split(/\s+/);
    const MEL = [];   // [step, midi, lengthSteps]
    GRID.forEach((sym, i) => { if (sym === '.') { if (MEL.length) MEL[MEL.length - 1][2]++; } else MEL.push([i, N[sym], 1]); });
    const CHORDS = [[60, 64, 67], [59, 62, 67], [57, 60, 64], [53, 57, 60]];   // C, G/B, Am, F
    const BASS = [36, 43, 45, 41];                                              // C2, G2, A2, F2 (+ octave jumps)
    function lead(c, out, n, t, dur, vol) {
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(5200, t); f.frequency.exponentialRampToValueAtTime(2200, t + dur); f.Q.value = 2; f.connect(out);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.setValueAtTime(vol * 0.75, t + Math.min(0.08, dur * 0.5)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.connect(f);
      [['sawtooth', 0], ['square', 7]].forEach(([type, det]) => { const o = c.createOscillator(); o.type = type; o.frequency.value = hz(n); o.detune.value = det; o.connect(g); o.start(t); o.stop(t + dur + 0.03); });
    }
    function play(c, out, t, i) {
      const bar = i >> 3, pos = i & 7, ch = bar & 3, second = bar >= 4;
      const m = i % 32;
      for (const [st, n, d] of MEL) if (st === m) {
        lead(c, out, n, t, d * SD * 0.95, 0.16);
        lead(c, out, n, t + SD * 1.5, d * SD * 0.6, 0.04);                 // dotted-eighth echo
        if (second) chip(c, out, n + 12, t, 0.035, d * SD * 0.7, 6000);     // sparkle octave on the repeat
      }
      // offbeat chord stabs
      if (pos % 2 === 1) CHORDS[ch].forEach(n => chip(c, out, n, t, 0.025, SD * 0.5, 2400));
      // bouncy syncopated octave bass: low on 1, high on &1, low on &2, high on 3, low on &3, high on &4
      const B = BASS[ch];
      const pat = { 0: 0, 1: 12, 3: 0, 4: 12, 5: 0, 7: 12 };
      if (pat[pos] !== undefined) { const d = SD * 0.85; osc(c, 'triangle', hz(B + pat[pos]), t, d, env(c, out, t, 0.5, d)); osc(c, 'square', hz(B + pat[pos]) * 2, t, d * 0.5, env(c, out, t, 0.05, d * 0.5)); }
      // light drums
      if (pos === 0 || pos === 4 || (second && pos === 5)) kick(c, out, t, 0.55);
      if (pos === 2 || pos === 6) nz(c, out, t, 0.16, 0.12, 'bandpass', 1700);
      nz(c, out, t, pos % 2 ? 0.03 : 0.05, 0.03, 'highpass', 8000);
      if (second) nz(c, out, t + SD / 2, 0.025, 0.025, 'highpass', 9000);
      if (bar === 7 && pos >= 6) nz(c, out, t + SD / 2, 0.12, 0.08, 'bandpass', 1900);    // little fill into the loop
    }
    return { BPM, SD, STEPS, play };
  })();
  window.RNRLevel1Song = Level1Song;
  SONGS.level1 = { custom: Level1Song };


  // ---------- Level 2-5 variations of the L1 motif + celebration music ----------
  const Vars = (function () {
    const { hz, env, osc, marimba, chip, kick, nz } = TitleSong.lib;
    const N = { B4: 71, C5: 72, D5: 74, E5: 76, F5: 77, G5: 79, A5: 81, B5: 83, C6: 84 };
    const GRID = ('C5 . E5 G5 C6 . B5 A5 G5 . E5 C5 D5 . . . F5 . A5 C6 B5 . A5 G5 E5 . G5 C6 D5 . B4 C5').split(' ');
    const MEL = [];
    GRID.forEach((sym, i) => { if (sym === '.') MEL[MEL.length - 1][2]++; else MEL.push([i, N[sym], 1]); });
    const CHORDS = [[60, 64, 67], [59, 62, 67], [57, 60, 64], [53, 57, 60]];
    const BASS = [36, 43, 45, 41];
    // --- instruments ---
    function filtered(c, out, type, freq, q) { const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1; f.connect(out); return f; }
    function bell(c, out, n, t, vol, dur) {
      const f = hz(n);
      osc(c, 'sine', f, t, dur, env(c, out, t, vol, dur));
      osc(c, 'sine', f * 2.76, t, dur * 0.5, env(c, out, t, vol * 0.4, dur * 0.5));
      osc(c, 'sine', f * 5.4, t, dur * 0.2, env(c, out, t, vol * 0.15, dur * 0.2));
    }
    function pad(c, out, notes, t, dur, vol, cutoff, types) {
      const f = filtered(c, out, 'lowpass', cutoff || 1400, 0.7);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
      g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.connect(f);
      notes.forEach(n => (types || [-8, 8]).forEach(det => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(n); o.detune.value = det; o.connect(g); o.start(t); o.stop(t + dur + 0.05); }));
    }
    function chorus(c, out, n, t, vol, dur) {   // wobbly detuned triangles with a slow vibrato
      const g = env(c, out, t, vol, dur);
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.5; lg.gain.value = 18; lfo.connect(lg); lfo.start(t); lfo.stop(t + dur + 0.05);
      [-12, 12].forEach(det => { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(n); o.detune.value = det; lg.connect(o.detune); o.connect(g); o.start(t); o.stop(t + dur + 0.05); });
    }
    function pluck(c, out, n, t, vol, dur, type, from, to) {   // filter-enveloped pluck (slap bass, brass)
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 5; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur); f.connect(out);
      osc(c, type, hz(n), t, dur, env(c, f, t, vol, dur));
    }
    function lead(c, out, n, t, dur, vol, cutoff) {
      const f = filtered(c, out, 'lowpass', cutoff || 4000, 2);
      const g = env(c, f, t, vol, dur);
      ['sawtooth', 'square'].forEach((ty, k) => { const o = c.createOscillator(); o.type = ty; o.frequency.value = hz(n); o.detune.value = k * 7; o.connect(g); o.start(t); o.stop(t + dur + 0.03); });
    }
    function slideWhistle(c, out, t, up) {
      const o = c.createOscillator(), g = env(c, out, t, 0.18, 0.5); o.type = 'sine';
      o.frequency.setValueAtTime(up ? 500 : 1600, t); o.frequency.exponentialRampToValueAtTime(up ? 1700 : 600, t + 0.45);
      const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 7; lg.gain.value = 25; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + 0.5);
      o.connect(g); o.start(t); o.stop(t + 0.52);
    }
    function coin(c, out, t) { chip(c, out, 83, t, 0.12, 0.08, 8000); chip(c, out, 88, t + 0.07, 0.12, 0.3, 8000); }
    function boing(c, out, t) {
      const o = c.createOscillator(), g = env(c, out, t, 0.25, 0.45); o.type = 'sine';
      o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(520, t + 0.08); o.frequency.exponentialRampToValueAtTime(260, t + 0.2);
      o.frequency.exponentialRampToValueAtTime(420, t + 0.3); o.frequency.exponentialRampToValueAtTime(300, t + 0.42);
      o.connect(g); o.start(t); o.stop(t + 0.46);
    }
    // --- level variations: same motif + C-G/B-Am-F progression, transposed and re-orchestrated ---
    function variation(o) {
      const SD = 60 / o.bpm / 2, STEPS = 64;
      function play(c, out, t, i) {
        const bar = i >> 3, pos = i & 7, ch = bar & 3, second = bar >= 4, m = i % 32, tr = o.tr;
        const sw = (pos % 2 && o.swing) ? SD * o.swing : 0;   // swing the off-beat eighths
        for (const [st, n, d] of MEL) if (st === m) o.lead(c, out, n + tr + (o.leadOct || 0), t + sw, d * SD, second);
        o.backing(c, out, t, sw, pos, bar, CHORDS[ch].map(n => n + tr), BASS[ch] + tr, second, SD);
      }
      return { BPM: o.bpm, SD, STEPS, play };
    }
    const L2 = variation({   // Cloud Kingdom: airy, bells + pads, light drums
      bpm: 132, tr: 5, leadOct: 0,
      lead: (c, out, n, t, dur, second) => { bell(c, out, n, t, 0.2, Math.max(0.5, dur * 1.6)); if (second) bell(c, out, n + 12, t + 0.01, 0.06, 0.6); },
      backing: (c, out, t, sw, pos, bar, chord, root, second, SD) => {
        if (pos === 0) pad(c, out, chord, t, SD * 8.4, 0.05, 1100);
        if (pos % 2 === 1) bell(c, out, chord[(pos >> 1) % 3] + 12, t, 0.04, 0.4);
        if (pos === 0 || pos === 3) osc(c, 'sine', hz(root), t, SD * 2.5, env(c, out, t, 0.45, SD * 2.5));
        if (pos === 4 || pos === 7) osc(c, 'sine', hz(root + 12), t, SD * 1.5, env(c, out, t, 0.25, SD * 1.5));
        if (pos === 0) kick(c, out, t, 0.3);
        if (pos === 4) nz(c, out, t, 0.07, 0.06, 'bandpass', 3000);
        nz(c, out, t, 0.018, 0.04, 'highpass', 9000);
      }
    });
    const L3 = variation({   // Rooftop City: funky - slap bass, brass stabs, swing hats
      bpm: 112, tr: 2, swing: 0.22,
      lead: (c, out, n, t, dur, second) => { pluck(c, out, n, t, 0.14, dur * 0.9, 'square', 4200, 900); if (second) pluck(c, out, n - 12, t, 0.06, dur * 0.9, 'sawtooth', 2500, 600); },
      backing: (c, out, t, sw, pos, bar, chord, root, second, SD) => {
        const slap = { 0: 0, 1: 12, 3: 0, 4: 0, 5: 12, 6: 0, 7: 12 };
        if (slap[pos] !== undefined) pluck(c, out, root + slap[pos], t + sw, slap[pos] ? 0.22 : 0.4, SD * (slap[pos] ? 0.4 : 0.8), 'sawtooth', slap[pos] ? 3000 : 1800, 200);
        if (pos === 3 || pos === 6 || (second && pos === 7)) chord.forEach(n => pluck(c, out, n + 12, t + sw, 0.05, SD * 0.7, 'sawtooth', 3500, 700));   // brass stabs
        if (pos === 0 || pos === 3 || (second && pos === 5)) kick(c, out, t + sw, 0.6);
        if (pos === 2 || pos === 6) nz(c, out, t, 0.2, 0.1, 'bandpass', 1600);
        nz(c, out, t + sw, pos % 2 ? 0.03 : 0.055, pos === 7 ? 0.12 : 0.03, 'highpass', 8000);
      }
    });
    const L4 = variation({   // Deep Blue Bay: watery marimba + wobbly chorus, laid back
      bpm: 116, tr: -2, swing: 0.12,
      lead: (c, out, n, t, dur, second) => { marimba(c, out, n, t, 0.4, dur * 1.5); if (second) chorus(c, out, n - 12, t, 0.06, dur * 0.95); },
      backing: (c, out, t, sw, pos, bar, chord, root, second, SD) => {
        if (pos === 0) chord.forEach(n => chorus(c, out, n, t, 0.03, SD * 7.5));
        if (pos % 2 === 1) marimba(c, out, chord[(pos + bar) % 3] + 12, t + sw, 0.08, 0.25);
        if (pos === 0 || pos === 5) osc(c, 'sine', hz(root), t + sw, SD * 2.5, env(c, out, t + sw, 0.5, SD * 2.5));
        if (pos === 3) osc(c, 'sine', hz(root + 12), t + sw, SD, env(c, out, t + sw, 0.25, SD));
        if (pos === 0) kick(c, out, t, 0.35);
        if (pos === 6) nz(c, out, t, 0.08, 0.05, 'bandpass', 2600);
        nz(c, out, t + sw, 0.02, 0.06, 'bandpass', 6000);   // shaker
      }
    });
    const L5 = variation({   // Star Station: synthwave - arps, big pads, faster
      bpm: 160, tr: 7, leadOct: 0,
      lead: (c, out, n, t, dur, second) => { lead(c, out, n, t, dur * 0.95, 0.12, second ? 5000 : 3000); lead(c, out, n - 12, t, dur * 0.95, 0.05, 1800); },
      backing: (c, out, t, sw, pos, bar, chord, root, second, SD) => {
        if (pos === 0) pad(c, out, chord.concat([chord[0] + 12]), t, SD * 8.3, 0.045, second ? 2600 : 1500, [-12, 0, 12]);
        const arp = chord.concat([chord[0] + 12, chord[1] + 12]);
        for (let h = 0; h < 2; h++) chip(c, out, arp[(pos * 2 + h) % arp.length] + 12, t + h * SD / 2, 0.04, SD * 0.45, 1200 + bar * 500);
        pluck(c, out, root + (pos % 2 ? 12 : 0), t, 0.3, SD * 0.8, 'sawtooth', 1400, 150);
        if (pos % 2 === 0) kick(c, out, t, 0.6);
        if (pos === 2 || pos === 6) nz(c, out, t, 0.2, 0.3, 'bandpass', 1400);
        if (pos % 2 === 1) nz(c, out, t, 0.05, 0.05, 'highpass', 8000);
      }
    });
    // --- celebration: Dm7 -> Em7 -> F -> G (rising) ---
    const CEL = [[62, 65, 69, 72], [64, 67, 71, 74], [65, 69, 72, 77], [67, 71, 74, 79]];
    const CROOT = [38, 40, 41, 43];
    function celebrate(c, out, t, chord, root, pos, SD, big) {
      if (pos % 2 === 0) chord.forEach(n => lead(c, out, n, t, SD * 1.6, 0.035, 3500));
      chip(c, out, chord[pos % 4] + 12, t, 0.08, SD * 0.9, 6000);
      if (pos % 2 === 0) osc(c, 'triangle', hz(root + (pos === 2 ? 12 : 0)), t, SD * 1.8, env(c, out, t, 0.5, SD * 1.8));
      if (pos === 0) kick(c, out, t, 0.6);
      if (big && pos === 2) nz(c, out, t, 0.18, 0.1, 'bandpass', 1700);
      nz(c, out, t, 0.04, 0.03, 'highpass', 8000);
    }
    const Jingle = (function () {   // level complete: ~5 s, plays once
      const SD = 60 / 140 / 2, STEPS = 24;
      function play(c, out, t, i) {
        if (i < 16) {
          const k = i >> 2, pos = i & 3;
          celebrate(c, out, t, CEL[k], CROOT[k], pos, SD, true);
          if (i === 0) slideWhistle(c, out, t, true);
          if (pos === 0 && k > 0 && k < 3) coin(c, out, t);
          if (i === 14) boing(c, out, t);
        } else if (i === 16) {   // landing on a big C major
          [60, 64, 67, 72, 76].forEach(n => lead(c, out, n, t, SD * 7, 0.05, 4500));
          [72, 76, 79, 84].forEach((n, j) => bell(c, out, n, t + j * 0.05, 0.12, 1.4));
          osc(c, 'triangle', hz(36), t, SD * 6, env(c, out, t, 0.6, SD * 6));
          kick(c, out, t, 0.7); nz(c, out, t, 0.3, 1.2, 'highpass', 3000); coin(c, out, t + 0.1);
        }
      }
      return { BPM: 140, SD, STEPS, play, once: true };
    })();
    const Victory = (function () {   // final win: looping, 8 bars (progression twice, second time fuller)
      const SD = 60 / 140 / 2, STEPS = 64;
      function play(c, out, t, i) {
        const bar = i >> 3, pos = i & 7, k = bar & 3, second = bar >= 4;
        const chord = CEL[k];
        if (pos % 2 === 0) chord.forEach(n => lead(c, out, n, t, SD * 1.8, 0.03, second ? 4500 : 2500));
        for (const [st, n, d] of MEL) if (st === (i % 32)) lead(c, out, n + 2 * 0, t, d * SD, 0.1, 4500);   // the main motif returns
        chip(c, out, chord[pos % 4] + 24, t, second ? 0.05 : 0.03, SD * 0.5, 7000);
        osc(c, 'triangle', hz(CROOT[k] + (pos % 2 ? 12 : 0)), t, SD * 0.9, env(c, out, t, 0.45, SD * 0.9));
        if (pos % 4 === 0) kick(c, out, t, 0.6);
        if (pos === 2 || pos === 6) nz(c, out, t, 0.18, 0.12, 'bandpass', 1700);
        nz(c, out, t, pos % 2 ? 0.03 : 0.05, 0.03, 'highpass', 8000);
        if (pos === 0 && k === 0) slideWhistle(c, out, t, true);
        if (pos === 4 && (k === 1 || k === 2)) coin(c, out, t);
        if (pos === 6 && k === 3) boing(c, out, t);
      }
      return { BPM: 140, SD, STEPS, play };
    })();
    // --- stage-2 variants: same world song, a touch faster, plus a countermelody + tambourine ---
    function alt(base, tr, o) {
      const k = o.tempo || 1.06, SD = base.SD / k;
      function play(c, out, t, i) {
        base.play(c, out, t, i);
        const bar = i >> 3, pos = i & 7, chord = CHORDS[bar & 3].map(n => n + tr);
        if (pos === 2 || pos === 5 || pos === 7) o.counter(c, out, chord[(bar + pos) % 3] + 12, t, SD);
        if (pos % 2 === 1) nz(c, out, t, 0.035, 0.08, 'bandpass', 7000);   // tambourine
      }
      return { BPM: base.BPM * k, SD, STEPS: base.STEPS, play };
    }
    // --- boss versions: the motif in C minor over Cm-Ab-Bb-G, driving bass and four-on-the-floor ---
    const MINOR = { 76: 75, 81: 80, 83: 82, 71: 70 };
    const BCH = [[60, 63, 67], [56, 60, 63], [58, 62, 65], [55, 59, 62]], BROOT = [36, 32, 34, 31];
    function boss(tr, o) {
      const bpm = o.bpm || 168, SD = 60 / bpm / 2, STEPS = 64;
      function play(c, out, t, i) {
        const bar = i >> 3, pos = i & 7, k = bar & 3, second = bar >= 4, m = i % 32;
        for (const [st, n, d] of MEL) if (st === m) {
          const nn = (MINOR[n] || n) + tr;
          lead(c, out, nn, t, d * SD * 0.9, 0.11, second ? 4200 : 2600);
          o.layer(c, out, nn, t, d * SD, second);
        }
        const root = BROOT[k] + tr;
        pluck(c, out, root + (pos % 2 ? 12 : 0), t, 0.32, SD * 0.8, 'sawtooth', 1600, 160);
        if (pos === 0) pad(c, out, BCH[k].map(n => n + tr), t, SD * 8.2, 0.035, 1200);
        if (pos % 2 === 0) kick(c, out, t, 0.7);
        if (pos === 2 || pos === 6) nz(c, out, t, 0.24, 0.14, 'bandpass', 1500);
        nz(c, out, t, pos % 2 ? 0.035 : 0.06, 0.03, 'highpass', 8500);
        if (pos === 0 && bar === 0) nz(c, out, t, 0.25, 1.0, 'highpass', 3500);   // crash
        if (bar === 7 && pos >= 4) nz(c, out, t + SD / 2, 0.14, 0.08, 'bandpass', 1800);
      }
      return { BPM: bpm, SD, STEPS, play };
    }
    const B = {
      level1b: alt(window.RNRLevel1Song, 0, { counter: (c, out, n, t, SD) => marimba(c, out, n, t, 0.18, SD * 1.2) }),
      level2b: alt(L2, 5, { counter: (c, out, n, t, SD) => chip(c, out, n + 12, t, 0.035, SD * 0.8, 6000), tempo: 1.08 }),
      level3b: alt(L3, 2, { counter: (c, out, n, t, SD) => bell(c, out, n + 12, t, 0.06, 0.3) }),
      level4b: alt(L4, -2, { counter: (c, out, n, t, SD) => bell(c, out, n + 12, t, 0.07, 0.5), tempo: 1.04 }),
      level5b: alt(L5, 7, { counter: (c, out, n, t, SD) => marimba(c, out, n, t, 0.15, SD) }),
      boss1: boss(0, { bpm: 160, layer: (c, out, n, t, d) => marimba(c, out, n, t, 0.25, d) }),
      boss2: boss(5, { bpm: 168, layer: (c, out, n, t, d, s) => bell(c, out, n + 12, t, 0.08, 0.5) }),
      boss3: boss(2, { bpm: 156, layer: (c, out, n, t, d) => pluck(c, out, n - 12, t, 0.1, d, 'square', 3000, 600) }),
      boss4: boss(-2, { bpm: 150, layer: (c, out, n, t, d) => chorus(c, out, n - 12, t, 0.07, d) }),
      boss5: boss(7, { bpm: 176, layer: (c, out, n, t, d) => chip(c, out, n + 12, t, 0.05, d * 0.6, 7000) })
    };
    return { L2, L3, L4, L5, Jingle, Victory, B };
  })();
  SONGS.level2 = { custom: Vars.L2 }; SONGS.level3 = { custom: Vars.L3 }; SONGS.level4 = { custom: Vars.L4 }; SONGS.level5 = { custom: Vars.L5 };
  for (const k in Vars.B) SONGS[k] = { custom: Vars.B[k] };
  SONGS.complete = { custom: Vars.Jingle }; SONGS.victory = { custom: Vars.Victory };
  window.RNRSongs = SONGS;

  let currentTrack = null, pendingTrack = null, trackOut = null, synthTimer = null, step = 0, nextTime = 0, playingFile = null;
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  function scheduleSynth() {
    const song = SONGS[currentTrack]; if (!song || !ctx) return;
    if (song.custom) {
      while (nextTime < ctx.currentTime + 0.15) {
        if (song.custom.once && step >= song.custom.STEPS) { stopSynth(); return; }
        song.custom.play(ctx, trackOut, nextTime, step % song.custom.STEPS); nextTime += song.custom.SD; step++;
      }
      return;
    }
    const stepDur = 60 / song.bpm / 2;
    while (nextTime < ctx.currentTime + 0.15) {
      const i = step % song.lead.length;
      const ln = song.lead[i], bn = song.bass[i % song.bass.length];
      if (ln) voice(midi(ln), nextTime, stepDur * 0.9, 'square', 0.22);
      if (bn) voice(midi(bn), nextTime, stepDur * 0.95, 'triangle', 0.5);
      if (i % 4 === 0) hat(nextTime, 0.05); else if (i % 2 === 0) hat(nextTime, 0.025);
      nextTime += stepDur; step++;
    }
  }
  function voice(f, t, dur, type, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(trackOut || musicBus); o.start(t); o.stop(t + dur + 0.02);
  }
  function hat(t, vol) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    s.connect(f); f.connect(g); g.connect(trackOut || musicBus); s.start(t, Math.random()); s.stop(t + 0.05);
  }
  function stopSynth() { if (synthTimer) { clearInterval(synthTimer); synthTimer = null; } }
  function playFile(name) {
    const a = fileTracks[name]; if (!a) return false;
    if (playingFile && playingFile !== a) playingFile.pause();
    playingFile = a; a.muted = muted;
    try { a.currentTime = 0; } catch (e) {}
    const p = a.play(); if (p && p.catch) p.catch(() => {});
    return true;
  }
  function playMusic(name) {
    if (!ctx) { pendingTrack = name; return; }
    if (currentTrack === name) return;
    stopMusic();
    currentTrack = name;
    if (playFile(name)) return;
    step = 0; nextTime = ctx.currentTime + 0.05;
    trackOut = ctx.createGain(); trackOut.connect(musicBus);   // per-track gain so tracks crossfade
    trackOut.gain.setValueAtTime(0.0001, ctx.currentTime); trackOut.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.4);
    synthTimer = setInterval(scheduleSynth, 30);
    scheduleSynth();
  }
  function stopMusic() {
    stopSynth();
    if (trackOut && ctx) { const old = trackOut; old.gain.cancelScheduledValues(ctx.currentTime); old.gain.setTargetAtTime(0, ctx.currentTime, 0.12); setTimeout(() => { try { old.disconnect(); } catch (e) {} }, 1200); trackOut = null; }
    if (playingFile) { playingFile.pause(); playingFile = null; }
    currentTrack = null;
  }
  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('rnr_muted_v2', m ? '1' : '0'); } catch (e) {}
    if (master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.02);
    Object.values(fileTracks).forEach(a => { a.muted = m; });
    if (!m) unlock();
  }
  // Pause when the app is hidden (phone locked / switched apps); resume when it comes back.
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) { ctx.suspend(); if (playingFile) playingFile.pause(); if (silentEl) silentEl.pause(); }
    else {
      const p = ctx.resume(); if (p && p.catch) p.catch(() => {});
      if (playingFile) { const q = playingFile.play(); if (q && q.catch) q.catch(() => {}); }
      if (silentEl) { const q = silentEl.play(); if (q && q.catch) q.catch(() => {}); }
    }
  });
  window.addEventListener('pageshow', () => { if (ctx && ctx.state !== 'running') { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } });

  // audio/music.json lists which custom MP3s exist, e.g. {"tracks": ["title", "level1"]}.
  // (Checking a list avoids 404 errors for tracks that haven't been added.)
  if (location.protocol !== 'file:') {
    fetch('audio/music.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : { tracks: [] })
      .then(j => (j.tracks || []).forEach(probe)).catch(() => {});
  }

  window.Sound = {
    init, unlock, sfx, playMusic, stopMusic,
    get state() { return ctx ? ctx.state : 'none'; },
    get musicMode() { return playingFile ? 'file' : (synthTimer ? 'synth' : 'none'); },
    play(name) { if (sfx[name] && ctx && !muted) sfx[name](); },
    get muted() { return muted; }, setMuted, toggleMute() { setMuted(!muted); },
    get ready() { return !!ctx; }
  };
})();

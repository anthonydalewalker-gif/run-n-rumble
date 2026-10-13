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

  let currentTrack = null, pendingTrack = null, synthTimer = null, step = 0, nextTime = 0, playingFile = null;
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  function scheduleSynth() {
    const song = SONGS[currentTrack]; if (!song || !ctx) return;
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
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.02);
  }
  function hat(t, vol) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    s.connect(f); f.connect(g); g.connect(musicBus); s.start(t, Math.random()); s.stop(t + 0.05);
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
    synthTimer = setInterval(scheduleSynth, 30);
    scheduleSynth();
  }
  function stopMusic() {
    stopSynth();
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

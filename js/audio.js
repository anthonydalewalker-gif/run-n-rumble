// Run N Rumble - audio: synthesized sound effects + music.
// Custom MP3s in audio/<track>.mp3 (e.g. audio/level1.mp3) replace the built-in tunes automatically.
(function () {
  'use strict';
  let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem('rnr_muted') === '1'; } catch (e) {}

  // ---------- custom MP3 detection ----------
  const fileTracks = {};      // name -> HTMLAudioElement when it loaded OK
  const probing = {};
  function probe(name) {
    if (probing[name]) return;
    probing[name] = true;
    const a = new Audio();
    a.preload = 'auto';
    a.loop = true;
    a.addEventListener('canplay', () => {
      if (fileTracks[name]) return;
      fileTracks[name] = a;
      a.muted = muted;
      // If this track is currently playing as synth, switch over to the file.
      if (currentTrack === name) { stopSynth(); playFile(name); }
    }, { once: true });
    a.addEventListener('error', () => {}, { once: true });
    a.src = 'audio/' + name + '.mp3';
  }

  // ---------- core ----------
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.16; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (pendingTrack) { const t = pendingTrack; pendingTrack = null; playMusic(t); }
  }

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
  SONGS.level2 = SONGS.level1; SONGS.level3 = SONGS.level1; // placeholders until those levels exist

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
    probe(name);
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
    try { localStorage.setItem('rnr_muted', m ? '1' : '0'); } catch (e) {}
    if (master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.02);
    Object.values(fileTracks).forEach(a => { a.muted = m; });
  }
  // Pause music when the app is hidden (phone locked / switched apps).
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) { ctx.suspend(); if (playingFile) playingFile.pause(); }
    else { ctx.resume(); if (playingFile) { const p = playingFile.play(); if (p && p.catch) p.catch(() => {}); } }
  });

  ['title', 'level1'].forEach(probe);

  window.Sound = {
    init, sfx, playMusic, stopMusic,
    play(name) { if (sfx[name] && ctx && !muted) sfx[name](); },
    get muted() { return muted; }, setMuted, toggleMute() { setMuted(!muted); },
    get ready() { return !!ctx; }
  };
})();

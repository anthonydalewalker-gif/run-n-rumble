// Anonymous, cookie-free play stats via GoatCounter (https://www.goatcounter.com).
// Set GOATCOUNTER_CODE to the site code (e.g. 'runnrumble' for runnrumble.goatcounter.com). Empty = off.
(function () {
  const GOATCOUNTER_CODE = 'adwalkerbuilds';   // https://adwalkerbuilds.goatcounter.com
  const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:';
  const TEST = LOCAL && /[?&]gctest\b/.test(location.search);   // local test mode: real loader, fake code
  const CODE = TEST ? 'rnr-test' : GOATCOUNTER_CODE;
  const enabled = TEST || (!!GOATCOUNTER_CODE && !LOCAL);
  const queue = [], t0 = Date.now();
  let furthest = -1, ended = false;

  function flush() {
    const gc = window.goatcounter;
    if (!gc || typeof gc.count !== 'function') return;
    while (queue.length) { const e = queue.shift(); try { gc.count(e); } catch (err) {} }
  }
  function ev(path, title) {
    if (!enabled) return;
    queue.push({ path: String(path), title: title || String(path), event: true });
    flush();
  }
  if (enabled) {
    window.goatcounter = { no_onload: true, allow_local: TEST };   // no automatic pageview; events only
    const s = document.createElement('script');
    s.async = true; s.src = 'https://gc.zgo.at/count.js';
    s.dataset.goatcounter = 'https://' + CODE + '.goatcounter.com/count';
    s.onload = flush;
    document.head.appendChild(s);
  }
  function bucket(ms) { const m = ms / 60000; return m < 1 ? '0-1m' : m < 5 ? '1-5m' : m < 15 ? '5-15m' : m < 30 ? '15-30m' : '30m+'; }
  function end() {
    if (ended) return; ended = true;
    if (furthest >= 0 && window.LEVELS) ev('furthest/' + window.LEVELS[furthest].id, 'Furthest stage reached');
    ev('time/' + bucket(Date.now() - t0), 'Session length');
  }
  addEventListener('pagehide', end);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') end(); });

  const id = i => (window.LEVELS && window.LEVELS[i] ? window.LEVELS[i].id : String(i));
  window.Stats = {
    enabled,
    sessionStart() { ev('session/start', 'Session start'); },
    stageStart(i) { if (i > furthest) furthest = i; ev('start/' + id(i), 'Stage start ' + id(i)); },
    stageClear(i) { ev('clear/' + id(i), 'Stage clear ' + id(i)); },
    death(i) { ev('death/' + id(i), 'Death ' + id(i)); },
    gameOver(i) { ev('gameover/' + id(i), 'Game over ' + id(i)); },
    bossDefeated(i) { ev('boss/' + id(i), 'Boss defeated ' + id(i)); },
    friendRescued(kind) { ev('rescue/' + kind, 'Friend rescued: ' + kind); },
    victory() { ev('victory', 'Final victory'); }
  };
  window.Stats.sessionStart();
})();

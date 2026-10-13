// Run N Rumble - input: multitouch on-screen buttons + keyboard + mouse.
//
// How touch works (built to never leave a button stuck "held"):
//  * Pointer Events give instant response. Each pointerId is tracked with its CURRENT position, and the
//    held buttons are re-derived from those positions every frame, so sliding a finger from the right
//    button to the left button switches direction, and sliding off a button releases it.
//  * No pointer capture: we release the browser's implicit touch capture, and clear a pointer on
//    pointerup / pointercancel / pointerleave / lostpointercapture.
//  * Safety net: every TouchEvent carries the browser's authoritative list of fingers on the screen
//    (e.touches). On every touch event the touch-pointer table is REBUILT from that list, and when it is
//    empty everything is cleared. A lost pointerup/touchend therefore can't survive the next touch event.
//  * Everything is also cleared on blur / pagehide / visibilitychange / orientationchange.
(function () {
  'use strict';
  const keys = {};
  const pts = new Map();        // key -> {cx, cy, born, touch}
  const Input = {
    left: false, right: false, jump: false,
    jumpPressed: false,
    taps: [], keyTaps: [],
    buttons: [],                // on-screen control buttons {id, x, y, r} (logical units, set by the game)
    touchUsed: ('ontouchstart' in window) || navigator.maxTouchPoints > 0,
    toLogical: null,
    ignoreBefore: 0,            // pointers that began before this time (e.g. the finger that tapped PLAY) are ignored
    _prevJump: false,
    // Which control a logical point is over. Generous zones, much larger than the drawn circles.
    zoneAt(x, y) {
      const L = this.buttons.find(b => b.id === 'left'), R = this.buttons.find(b => b.id === 'right'), J = this.buttons.find(b => b.id === 'jump');
      if (!L || !R || !J) return null;
      if (y >= L.y - L.r * 1.9 && x <= R.x + R.r * 1.7) return x < (L.x + R.x) / 2 ? 'left' : 'right';
      if (y >= J.y - J.r * 2.0 && x >= J.x - J.r * 1.9) return 'jump';
      return null;
    },
    update() {
      let l = !!(keys.ArrowLeft || keys.KeyA), r = !!(keys.ArrowRight || keys.KeyD);
      let j = !!(keys.Space || keys.ArrowUp || keys.KeyW || keys.KeyZ);
      for (const p of pts.values()) {
        if (p.born < this.ignoreBefore) continue;
        const q = this.toLogical(p.cx, p.cy), z = this.zoneAt(q.x, q.y);
        if (z === 'left') l = true; else if (z === 'right') r = true; else if (z === 'jump') j = true;
      }
      if (l && r) l = r = false;       // a thumb across both buttons stands still; never auto-run
      this.left = l; this.right = r;
      this.jumpPressed = j && !this._prevJump;
      this.jump = j; this._prevJump = j;
    },
    activeTouches() { let n = 0; for (const p of pts.values()) if (p.touch) n++; return n; },
    clearAll() { pts.clear(); for (const k in keys) keys[k] = false; this.left = this.right = this.jump = false; this._prevJump = false; },
    clearTaps() { this.taps.length = 0; this.keyTaps.length = 0; }
  };
  const unlockAudio = () => { if (window.Sound) window.Sound.unlock(); };
  const isTouch = e => e.pointerType === 'touch' || e.pointerType === 'pen';

  // ---------- pointer events ----------
  function onPointerDown(e) {
    if (isTouch(e)) Input.touchUsed = true;
    try { if (e.target.hasPointerCapture && e.target.hasPointerCapture(e.pointerId)) e.target.releasePointerCapture(e.pointerId); } catch (err) {}
    pts.set('p' + e.pointerId, { cx: e.clientX, cy: e.clientY, born: performance.now(), touch: isTouch(e) });
    const q = Input.toLogical(e.clientX, e.clientY);
    Input.taps.push({ x: q.x, y: q.y });
    unlockAudio();
    if (e.cancelable) e.preventDefault();
  }
  function onPointerMove(e) {
    const p = pts.get('p' + e.pointerId);
    if (!p) return;
    if (e.pointerType === 'mouse' && !e.buttons) { pts.delete('p' + e.pointerId); return; }
    p.cx = e.clientX; p.cy = e.clientY;
    if (e.cancelable) e.preventDefault();
  }
  function onPointerEnd(e) { pts.delete('p' + e.pointerId); }

  // ---------- touch events: authoritative safety net ----------
  const prevTouchBorn = new Map();   // touch identifier -> time that finger went down
  function syncFromTouches(e) {
    const list = Array.from(e.touches || []);
    const now = performance.now();
    for (const [k, p] of pts) if (p.touch) pts.delete(k);
    const born = new Map();
    for (const t of list) {
      const b = prevTouchBorn.has(t.identifier) ? prevTouchBorn.get(t.identifier) : now;
      born.set(t.identifier, b);
      pts.set('t' + t.identifier, { cx: t.clientX, cy: t.clientY, born: b, touch: true });
    }
    // fingers that are gone are forgotten (identifiers get reused by the browser)
    prevTouchBorn.clear();
    for (const [id, b] of born) prevTouchBorn.set(id, b);
  }
  function onTouch(e) {
    Input.touchUsed = true;
    syncFromTouches(e);
    if (e.type === 'touchend') unlockAudio();     // iOS unlocks audio in touchend
    if (e.type === 'touchstart') unlockAudio();
    if (e.cancelable) e.preventDefault();         // stops scrolling, zoom, and emulated mouse events
  }

  window.addEventListener('load', () => {
    const c = document.getElementById('game');
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', onPointerDown, { passive: false });
    c.addEventListener('pointermove', onPointerMove, { passive: false });
    c.addEventListener('pointerup', onPointerEnd);
    c.addEventListener('pointercancel', onPointerEnd);
    c.addEventListener('pointerleave', onPointerEnd);
    c.addEventListener('lostpointercapture', onPointerEnd);
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
  });
  const opts = { passive: false, capture: true };
  ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(t => document.addEventListener(t, onTouch, opts));
  window.addEventListener('click', unlockAudio);

  window.addEventListener('blur', () => Input.clearAll());
  window.addEventListener('pagehide', () => Input.clearAll());
  window.addEventListener('orientationchange', () => Input.clearAll());
  document.addEventListener('visibilitychange', () => { if (document.hidden) Input.clearAll(); });
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault());
  document.addEventListener('contextmenu', e => e.preventDefault());

  const UI_KEYS = { Enter: 'enter', Escape: 'pause', KeyP: 'pause', KeyM: 'mute', Backspace: 'back', ArrowLeft: 'left', ArrowRight: 'right', Space: 'enter' };
  window.addEventListener('keydown', e => {
    unlockAudio();
    if (!e.repeat && UI_KEYS[e.code]) Input.keyTaps.push(UI_KEYS[e.code]);
    keys[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  window.Input = Input;
})();

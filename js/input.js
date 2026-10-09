// Run N Rumble - input: multitouch on-screen buttons + keyboard.
(function () {
  'use strict';
  const keys = {};
  const pointers = new Map();   // pointerId -> {x, y} in logical game units
  const Input = {
    left: false, right: false, jump: false,
    jumpPressed: false,         // true for one frame when jump goes down
    taps: [],                   // UI taps {x, y} in logical units
    keyTaps: [],                // UI key presses ('enter', 'back', 'pause', 'mute', 'left', 'right')
    buttons: [],                // on-screen control buttons {id, x, y, r} (set by the game)
    touchUsed: ('ontouchstart' in window) || navigator.maxTouchPoints > 0,
    toLogical: null,            // set by the game: (clientX, clientY) -> {x, y}
    _prevJump: false,
    update() {
      let l = !!(keys.ArrowLeft || keys.KeyA), r = !!(keys.ArrowRight || keys.KeyD);
      let j = !!(keys.Space || keys.ArrowUp || keys.KeyW || keys.KeyZ);
      for (const p of pointers.values()) {
        for (const b of this.buttons) {
          const dx = p.x - b.x, dy = p.y - b.y;
          if (dx * dx + dy * dy <= (b.r * 1.3) * (b.r * 1.3)) {
            if (b.id === 'left') l = true; else if (b.id === 'right') r = true; else if (b.id === 'jump') j = true;
          }
        }
      }
      this.left = l; this.right = r;
      this.jumpPressed = j && !this._prevJump;
      this.jump = j; this._prevJump = j;
    },
    isPressed(id) { return this[id]; },
    clearTaps() { this.taps.length = 0; this.keyTaps.length = 0; }
  };

  function onDown(e) {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') Input.touchUsed = true;
    if (window.Sound) window.Sound.init();
    const p = Input.toLogical(e.clientX, e.clientY);
    pointers.set(e.pointerId, p);
    Input.taps.push({ x: p.x, y: p.y });
    e.preventDefault();
  }
  function onMove(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, Input.toLogical(e.clientX, e.clientY));
    e.preventDefault();
  }
  function onUp(e) { pointers.delete(e.pointerId); }

  window.addEventListener('load', () => {
    const c = document.getElementById('game');
    c.addEventListener('pointerdown', onDown, { passive: false });
    c.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    c.addEventListener('lostpointercapture', onUp);
  });
  // Block page scrolling / zooming / long-press menus.
  ['touchstart', 'touchmove', 'touchend'].forEach(t => document.addEventListener(t, e => { if (e.touches && e.touches.length > 1 || t === 'touchmove') e.preventDefault(); }, { passive: false }));
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault());
  document.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('blur', () => { pointers.clear(); for (const k in keys) keys[k] = false; });

  const UI_KEYS = { Enter: 'enter', Escape: 'pause', KeyP: 'pause', KeyM: 'mute', Backspace: 'back', ArrowLeft: 'left', ArrowRight: 'right', Space: 'enter' };
  window.addEventListener('keydown', e => {
    if (window.Sound) window.Sound.init();
    if (!e.repeat && UI_KEYS[e.code]) Input.keyTaps.push(UI_KEYS[e.code]);
    keys[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  window.Input = Input;
})();

# Run N Rumble

Phone-first 2D side-scroller (landscape). Plain HTML5 Canvas + JavaScript, no build step, no external libraries, works offline.

- Play: open `index.html` from any static web host (HTTPS needed for the offline/install features).
- Install: on iPhone, Safari > Share > Add to Home Screen. On Android, Chrome > menu > Add to Home screen / Install app.
- Controls: on-screen left / right (bottom-left) and jump (bottom-right). Keyboard: arrows or A/D, and Space/W/Up to jump. P/Esc pauses, M mutes.
- Your music: drop `title.mp3` / `level1.mp3` into `audio/` (see audio/README.txt).

Code layout: `js/levels.js` (level data + themes; levels 2-3 are stubbed `comingSoon`), `js/game.js` (engine, screens, HUD),
`js/draw.js` (all vector art), `js/audio.js` (Web Audio SFX + music), `js/input.js` (multitouch + keyboard).
Test hooks: `window.RNR` (e.g. `RNR.start('pickle',0)`, `RNR.teleport(9300)`, `RNR.giveSeeds(5)`, `RNR.god()`).

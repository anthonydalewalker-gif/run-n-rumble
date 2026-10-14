# Run N Rumble

Phone-first 2D side-scroller (landscape) starring **Tubby Dash**. Plain HTML5 Canvas + JavaScript, no build step, no external libraries, works offline.

- Play: open `index.html` from any static web host (HTTPS needed for the offline/install features).
- Install: on iPhone, Safari > Share > Add to Home Screen. On Android, Chrome > menu > Add to Home screen / Install app.
- Controls: on-screen left / right (bottom-left) and jump (bottom-right; in water each press is a swim stroke). Keyboard: arrows or A/D, and Space/W/Up to jump. P/Esc pauses, M mutes.
- Five levels: Green Hills, Cloud Kingdom, Rooftop City, Deep Blue Bay (docks + swimming), Star Station (low gravity). Each ends at a themed exit, followed by a skippable transition.
- Power-ups (10 s): purple = speed, yellow = power (grow + smash), black = shield (no damage), green = high jump, amber = tough (half damage).
- Your music: drop `title.mp3` / `level1.mp3` ... `level5.mp3` into `audio/` and list them in `audio/music.json` (see audio/README.txt).

Code layout: `js/levels.js` (level data + backgrounds), `js/game.js` (engine, screens, HUD, cutscenes),
`js/draw.js` + `js/art.js` (all vector art), `js/audio.js` (Web Audio SFX + music), `js/input.js` (multitouch + keyboard).
Test hooks: `window.RNR` (e.g. `RNR.start(3)`, `RNR.teleport(9300)`, `RNR.god()`, `RNR.power('tough')`, `RNR.cutscene(2)`).

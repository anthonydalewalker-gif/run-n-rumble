# Run N Rumble

Tubby Dash and his friends Pipple, Lunker and Squib are trapped inside a video game. Run, jump and swim through 15 levels in 5 worlds, beat the bosses holding your friends prisoner, and escape the game.

**Play:** https://anthonydalewalker-gif.github.io/run-n-rumble/ (made for phones held sideways; works on desktop too, and offline after the first visit)

## How to play
- **Touch:** left/right buttons at the bottom left, jump at the bottom right. In water, each press of jump is a swim stroke.
- **Keyboard:** arrows or A/D to move, Space/W/Up to jump, P/Esc to pause, M to mute.
- **World map:** pick any unlocked stage. Each world has two stages and a boss (Potato King, Thunder Bird, Pigeon Boss, Giant Crab, Glitch Monster). Stomp a boss when it is open to attack.
- **Stars:** 1 for clearing a stage, 1 for finishing fast, and 1 for taking no damage.
- **Power-ups (10 s):** purple = speed, yellow = power, black = shield, green = high jump, amber = tough.
- **Install:** iPhone: Safari > Share > Add to Home Screen. Android: Chrome menu > Install app.

## Tech
Plain HTML5 Canvas and JavaScript. There is no build step and no libraries. A service worker (`sw.js`) caches the game for offline play.
Code is in `js/`: `game.js` (engine, bosses, map, screens), `levels.js` (level data), `draw.js`/`art.js`/`art2.js`/`friends.js` (artwork), `audio.js`, `input.js`.
Debug hooks (`window.RNR`) only exist when the game is served from localhost.

Created by A.D Walker Builds.

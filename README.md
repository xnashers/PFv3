# Pocket Farm v2

Fresh rebuild: cartoon UI, Firebase (Auth + Firestore), generated sprite sheets. No build step.

```
index.html              entry
styles/cartoon.css      design system (glossy gradients, thick outlines, hard drop shadows, sprite animation classes)
src/main.js             boot, login flow, save manager (local + debounced cloud)
src/firebase.js         Auth + Firestore calls     src/firebase-config.js  <- paste your keys
src/game.js             all game rules (no DOM)    src/ui.js  screens     src/sprites.js  sprite helpers
data/                   crops, levels, gear, weather (carried over from v1)
assets/crops.png        17 crops x 8 frames (0-3 growth stages, 4-7 bouncing harvested item)
assets/items.png        coin, star, 3 sprinklers, fertilizer, crate, soil, burst, tab icons (8 frames each)
tools/make_sprites.py   regenerates the sheets (pip install pillow)
firestore.rules, firebase.json   deploy with the Firebase CLI
```

Start: `python3 -m http.server 8080` → <http://localhost:8080> (works as a guest before Firebase is set up).
Firebase: see **FIREBASE_SETUP.md**.

## Using the sprite sheets
Each cell is 128x128. `assets/sprites.json` maps names to rows. In JS:
```js
cropSprite('mais', { size: 72 })                 // bouncing harvested item (frames 4-7)
cropSprite('mais', { size: 72, stage: 2 })       // static growth stage 0..3
itemSprite('coin', { size: 40 })                 // 8-frame loop
icon('trophy', 46)                               // static tab icon
```
Under the hood it's pure CSS: `--col`, `--row`, `--frames` and `steps()` move `background-position`.
Drop-in for any engine too (Phaser, Godot, Unity): the sheets are plain grids.

## Carried over from v1
Plots (4 + 2 per level + bought), seeds with stock and level unlocks, weight roll, fertilizer, sprinklers, weather every 2 min with mutations
and secret combos, planting restrictions (snow/thunderstorm), selling, XP/levels with seed rewards, leaderboard.

## Added in v2.1 (ported from the old version)
Genetics + mastery (`Lab` tab, `data/genetics.js`), achievements + titles (`Awards` tab, `data/achievements.js`), cheats (menu box, or 5 quick taps on the Titles / Achievements sub-tab),
pets (`Pets` tab, `data/pets.js` - new, the old version had none). Login/Firebase is unchanged. Save format is backward compatible (SAVE_EPOCH not bumped).

## Left out for now (data still in your old project)
Research lab, mutation lab, weather center, daily objectives, login rewards, token shop (tokens are earned and shown, nothing to spend them on yet), tutorial.
"# PFv2" 

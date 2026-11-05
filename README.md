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

## Added in v2.2 (retention update)
- **Token Shop** (Shop → 🪙 Token Shop, `data/tokenshop.js`): Auto-Harvester (3 tiers), Mutation Luck (10 levels), 2nd pet slot, weather tickets + weather control, Pet Treats, Legendary Genetics roll, 30-min Event Boost, plot skins and UI frames.
- **Daily / weekly quests + 7-day login streak** (Awards → 📅 Daily, `data/quests.js`). Quests are picked per day/week from a seeded pool (same for everyone), targets scale with level. Finishing all weekly quests unlocks a limited UI frame. Resets at the player's local midnight / Monday.
- **Weekly events** (`data/events.js`): Bagyong Habagat (typhoon), Pista ng Ani (harvest festival), Mutation Madness, Parada ng mga Alaga (pet parade + exclusive Sarimanok). Derived from the calendar, so no server is needed. Edit `EVENTS` to add more; the cycle is one event per week.
- **QoL**: Harvest all, Plant all (pick a seed first), bulk sell filters (plain only / mutated only / by category), Auto-Harvester (only collects crops that have had a mutation roll, so mutations are not lost).
- **Pets**: 2 slots with +15% synergy for different jobs, Pet Treats, evolution at max level (x1.5), Pet Parade doubles bonuses.
- **Leaderboards**: Level, monthly Season, Mutations, Richest, Best single sale.
- **🌍 World Chat** (Ranks → World Chat): live Firestore chat, 140 chars, 3 s cooldown, small word filter. **Re-publish `firestore.rules`** and read the v2.2 section of FIREBASE_SETUP.md.
- Save format is backward compatible (SAVE_EPOCH not bumped); old saves load with defaults.

## Not built yet
Crop hybrids, pet battles, trading/gifting, animated pets on the farm, day/night cycle, Filipino folklore mutations (the new event names are Tagalog; crops/weather names are unchanged). Research lab, mutation lab, weather center and tutorial from v1 are still left out.

// Daily / weekly objectives + 7-day login streak.
// `counter` names are bumped from game.js (harvest, mutated, soldPeso, feed, plant, secret, rareWeather).
export const DAILY_POOL = [
  { id: 'd_harvest', counter: 'harvest', text: 'Harvest {n} crops', emoji: '🌾', base: 12, perLevel: 0.4, reward: { type: 'tokens', amount: 3 } },
  { id: 'd_mutated', counter: 'mutated', text: 'Harvest {n} mutated crops', emoji: '🧬', base: 4, perLevel: 0.1, reward: { type: 'tokens', amount: 4 } },
  { id: 'd_sell', counter: 'soldPeso', text: 'Sell ₱{n} worth of crops', emoji: '💰', base: 300, perLevel: 120, reward: { type: 'tokens', amount: 3 } },
  { id: 'd_feed', counter: 'feed', text: 'Feed your pets {n} times', emoji: '🐾', base: 2, perLevel: 0, reward: { type: 'tokens', amount: 3 } },
  { id: 'd_plant', counter: 'plant', text: 'Plant {n} seeds', emoji: '🌱', base: 15, perLevel: 0.5, reward: { type: 'fertilizer', amount: 5 } },
];
export const WEEKLY_POOL = [
  { id: 'w_harvest', counter: 'harvest', text: 'Harvest {n} crops', emoji: '🌾', base: 120, perLevel: 4, reward: { type: 'tokens', amount: 15 } },
  { id: 'w_mutated', counter: 'mutated', text: 'Harvest {n} mutated crops', emoji: '🧬', base: 35, perLevel: 1, reward: { type: 'premium_seed_pack', amount: 1 } },
  { id: 'w_sell', counter: 'soldPeso', text: 'Sell ₱{n} worth of crops', emoji: '💰', base: 5000, perLevel: 1500, reward: { type: 'tokens', amount: 15 } },
  { id: 'w_secret', counter: 'secret', text: 'Trigger {n} secret mutation', emoji: '🔮', base: 1, perLevel: 0, reward: { type: 'weather_ticket', amount: 3 } },
  { id: 'w_weather', counter: 'rareWeather', text: 'Experience {n} rare weathers', emoji: '🌈', base: 2, perLevel: 0, reward: { type: 'tokens', amount: 12 } },
  { id: 'w_feed', counter: 'feed', text: 'Feed your pets {n} times', emoji: '🐾', base: 10, perLevel: 0, reward: { type: 'tokens', amount: 10 } },
];
export const DAILY_COUNT = 3, WEEKLY_COUNT = 3;
// Bonus when ALL daily / weekly quests of the period are claimed.
export const DAILY_BONUS = { type: 'tokens', amount: 5 };
export const WEEKLY_BONUS = { type: 'cosmetic', id: 'weekly_frame' };   // limited cosmetic UI frame (see tokenshop.js)

// Login streak: day 1..7, then it loops. Missing a day resets to day 1.
export const LOGIN_REWARDS = [
  { rewards: [{ type: 'peso', amount: 250 }] },
  { rewards: [{ type: 'fertilizer', amount: 5 }] },
  { rewards: [{ type: 'tokens', amount: 5 }] },
  { rewards: [{ type: 'sprinkler', tier: 1, amount: 3 }, { type: 'peso', amount: 500 }] },
  { rewards: [{ type: 'tokens', amount: 8 }] },
  { rewards: [{ type: 'weather_ticket', amount: 1 }, { type: 'sprinkler', tier: 2, amount: 2 }] },
  { rewards: [{ type: 'tokens', amount: 20 }, { type: 'premium_seed_pack', amount: 1 }], big: true },
];

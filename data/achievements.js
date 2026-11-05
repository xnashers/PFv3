// Achievements + titles (ported from the old version). `s` = game.stats, `p` = game.player.
const STARTER = ['kangkong', 'pechay', 'mustasa', 'sitaw', 'talong'];
const INTER = ['kamatis', 'kalabasa', 'mais', 'palay', 'ampalaya'];
const ADV = ['sibuyas', 'bawang', 'kamote', 'gabi'];
const PREM = ['mangga', 'calamansi', 'dragonfruit', 'durian', 'mangosteen'];
const all = (ids) => (s) => ids.every((id) => (s.cropsHarvested || {})[id] > 0);

export const ACHIEVEMENTS = [
  // Farming
  { id: 'beginner_farmer', name: 'Beginner Farmer', emoji: '🌱', cat: 'farming', desc: 'Harvest 100 crops', check: (s) => s.harvests >= 100, reward: { type: 'peso', amount: 500 } },
  { id: 'green_thumb', name: 'Green Thumb', emoji: '🌿', cat: 'farming', desc: 'Harvest 1,000 crops', check: (s) => s.harvests >= 1000, reward: { type: 'peso', amount: 5000 } },
  { id: 'harvest_king', name: 'Harvest King', emoji: '👑', cat: 'farming', desc: 'Harvest 10,000 crops', check: (s) => s.harvests >= 10000, reward: { type: 'peso', amount: 50000 } },
  { id: 'pocket_legend', name: 'Pocket Legend', emoji: '🌟', cat: 'farming', desc: 'Harvest 100,000 crops', check: (s) => s.harvests >= 100000, reward: { type: 'tokens', amount: 200 }, title: 'pocket_legend' },
  // Money
  { id: 'first_earnings', name: 'First Earnings', emoji: '💵', cat: 'money', desc: 'Earn ₱1,000 total', check: (s) => s.earned >= 1000, reward: { type: 'fertilizer', amount: 5 } },
  { id: 'rich_farmer', name: 'Rich Farmer', emoji: '💰', cat: 'money', desc: 'Earn ₱100,000 total', check: (s) => s.earned >= 100000, reward: { type: 'sprinkler', tier: 2, amount: 5 } },
  { id: 'millionaire', name: 'Millionaire', emoji: '💎', cat: 'money', desc: 'Earn ₱1,000,000 total', check: (s) => s.earned >= 1000000, reward: { type: 'sprinkler', tier: 3, amount: 10 } },
  { id: 'billionaire', name: 'Billionaire', emoji: '🤑', cat: 'money', desc: 'Earn ₱100,000,000 total', check: (s) => s.earned >= 100000000, reward: { type: 'tokens', amount: 200 }, title: 'millionaire' },
  // Mutations
  { id: 'first_mutation', name: 'First Mutation', emoji: '🧬', cat: 'mutations', desc: 'Obtain 1 mutation', check: (s) => s.mutations >= 1, reward: { type: 'peso', amount: 500 } },
  { id: 'mutation_hunter', name: 'Mutation Hunter', emoji: '🎯', cat: 'mutations', desc: 'Obtain 100 mutations', check: (s) => s.mutations >= 100, reward: { type: 'premium_seed_pack', amount: 1 } },
  { id: 'mutation_master', name: 'Mutation Master', emoji: '🧪', cat: 'mutations', desc: 'Obtain 500 mutations', check: (s) => s.mutations >= 500, reward: { type: 'weather_ticket', amount: 5 } },
  { id: 'mutation_god', name: 'Mutation God', emoji: '🌈', cat: 'mutations', desc: 'Obtain 5,000 mutations', check: (s) => s.mutations >= 5000, reward: { type: 'tokens', amount: 200 }, title: 'mutation_master' },
  // Weather
  { id: 'rain_watcher', name: 'Rain Watcher', emoji: '🌧️', cat: 'weather', desc: 'Experience 20 weather changes', check: (s) => s.weatherChanges >= 20, reward: { type: 'peso', amount: 1000 } },
  { id: 'weather_expert', name: 'Weather Expert', emoji: '🌦️', cat: 'weather', desc: 'Experience every weather type', check: (s) => (s.weatherTypes || []).length >= 15, reward: { type: 'sprinkler', tier: 3, amount: 5 }, title: 'weather_chaser' },
  { id: 'divine_witness', name: 'Divine Witness', emoji: '👑', cat: 'weather', desc: 'Experience Divine Weather', check: (s) => (s.weatherTypes || []).includes('divine'), reward: { type: 'premium_seed_pack', amount: 3 } },
  // Collection
  { id: 'collector', name: 'Collector', emoji: '📚', cat: 'collection', desc: 'Harvest every Starter crop', check: all(STARTER), reward: { type: 'peso', amount: 1000 }, title: 'crop_specialist' },
  { id: 'expert_farmer', name: 'Expert Farmer', emoji: '🌾', cat: 'collection', desc: 'Harvest every Intermediate crop', check: all(INTER), reward: { type: 'peso', amount: 5000 } },
  { id: 'master_farmer', name: 'Master Farmer', emoji: '🌿', cat: 'collection', desc: 'Harvest every Advanced crop', check: all(ADV), reward: { type: 'peso', amount: 15000 } },
  { id: 'legend_farmer', name: 'Legend Farmer', emoji: '💎', cat: 'collection', desc: 'Harvest every Premium crop', check: all(PREM), reward: { type: 'tokens', amount: 150 }, title: 'legend_farmer' },
  // Level
  { id: 'level_10', name: 'Level 10', emoji: '⭐', cat: 'level', desc: 'Reach Level 10', check: (s, p) => p.level >= 10, reward: { type: 'peso', amount: 2000 } },
  { id: 'level_25', name: 'Level 25', emoji: '🌟', cat: 'level', desc: 'Reach Level 25', check: (s, p) => p.level >= 25, reward: { type: 'premium_seed_pack', amount: 1 } },
  { id: 'level_50', name: 'Level 50', emoji: '💫', cat: 'level', desc: 'Reach Level 50', check: (s, p) => p.level >= 50, reward: { type: 'sprinkler', tier: 3, amount: 5 } },
  { id: 'level_100', name: 'Level 100', emoji: '🏆', cat: 'level', desc: 'Reach Level 100', check: (s, p) => p.level >= 100, reward: { type: 'tokens', amount: 200 }, title: 'pocket_farm_legend' },
  // Pets (new)
  { id: 'first_pet', name: 'Best Friend', emoji: '🐾', cat: 'pets', desc: 'Adopt your first pet', check: (s) => (s.petsOwned || 0) >= 1, reward: { type: 'peso', amount: 500 } },
  { id: 'pet_lover', name: 'Pet Lover', emoji: '🐶', cat: 'pets', desc: 'Adopt every pet', check: (s) => (s.petsOwned || 0) >= 6, reward: { type: 'tokens', amount: 100 }, title: 'pet_lover' },
];

export const ACHIEVEMENT_CATEGORIES = [
  { id: 'farming', name: '🌾 Farming' }, { id: 'money', name: '💰 Money' }, { id: 'mutations', name: '🧬 Mutations' },
  { id: 'weather', name: '🌦️ Weather' }, { id: 'collection', name: '📚 Collection' }, { id: 'level', name: '⭐ Level' }, { id: 'pets', name: '🐾 Pets' },
];

export const TITLE_DISPLAY = {
  pocket_legend: { name: 'Pocket Legend', emoji: '🌟' },
  millionaire: { name: 'Millionaire', emoji: '💰' },
  mutation_master: { name: 'Mutation Master', emoji: '🧪' },
  legend_farmer: { name: 'Legend Farmer', emoji: '💎' },
  pocket_farm_legend: { name: 'Pocket Farm Legend', emoji: '🏆' },
  weather_chaser: { name: 'Weather Chaser', emoji: '🌦️' },
  crop_specialist: { name: 'Crop Specialist', emoji: '🌾' },
  pet_lover: { name: 'Pet Lover', emoji: '🐶' },
};

export const rewardLabel = (r) => ({
  peso: `₱${r.amount.toLocaleString('en-US')}`, tokens: `🪙 ${r.amount} tokens`, fertilizer: `💩 ${r.amount} fertilizer`,
  sprinkler: `💦 ${r.amount}× Tier ${r.tier} sprinkler`, premium_seed_pack: `🌟 ${r.amount} premium seed pack${r.amount > 1 ? 's' : ''}`, weather_ticket: `🎫 ${r.amount} weather tickets`,
  cosmetic: '🏮 Limited cosmetic frame',
}[r.type] || r.type);

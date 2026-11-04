const LEVEL_TITLES = [
  'Newbie', 'Seedling', 'Sprout', 'Soil Digger', 'Tiny Farmer',
  'Garden Helper', 'Rookie Grower', 'Field Worker', 'Green Thumb', 'Crop Planter',
  'Young Harvester', 'Farm Apprentice', 'Barn Keeper', 'Seed Collector', 'Soil Master',
  'Irrigator', 'Orchard Worker', 'Crop Tender', 'Farmhand', 'Harvest Rookie',
  'Village Farmer', 'Garden Expert', 'Field Cultivator', 'Harvest Keeper', 'Crop Specialist',
  'Orchard Caretaker', 'Farm Ranger', 'Harvester', 'Barn Manager', 'Farm Guardian',
  'Expert Grower', 'Crop Overseer', 'Farm Steward', 'Golden Farmer', 'Orchard Master',
  'Land Tiller', 'Harvest Champion', 'Crop Veteran', 'Farm Hero', 'Master Cultivator',
  'Elite Farmer', 'Green Guardian', 'Harvest Captain', 'Farm Pioneer', 'Orchard Lord',
  'Seed Master', 'Harvest Specialist', 'Farm Commander', 'Crop Commander', 'Grand Farmer',
  'Agriculture Expert', 'Golden Harvester', 'Land Guardian', 'Farm Baron', 'Harvest Baron',
  'Crop Baron', 'Orchard Baron', 'Farm Noble', 'Green Baron', 'Harvest Noble',
  'Master Agriculturist', 'Grand Cultivator', 'Farm Tycoon', 'Crop Tycoon', 'Orchard Tycoon',
  'Harvest Tycoon', 'Golden Cultivator', 'Farm Mogul', 'Harvest Mogul', 'Land Mogul',
  'Farm Magnate', 'Agriculture Magnate', 'Harvest Magnate', 'Crop Emperor', 'Orchard Emperor',
  'Farm Emperor', 'Green Emperor', 'Harvest Emperor', 'Land Emperor', 'Supreme Farmer',
  'Eternal Grower', 'Legendary Cultivator', 'Mythic Farmer', 'Celestial Grower', 'Divine Harvester',
  "Nature's Chosen", 'Earth Guardian', 'Forest Protector', 'Harvest Legend', 'Golden Legend',
  'Ancient Farmer', 'Spirit of Nature', 'Master of Seasons', 'Keeper of Harvests', 'Lord of Crops',
  'King of Fields', 'Emperor of Harvest', 'Farming Legend', 'Ultimate Farmer', 'God of Agriculture'
];

export const LEVELS = LEVEL_TITLES.map((title, i) => ({
  level: i + 1,
  xpRequired: i === 0 ? 0 : Math.floor(50 * (i + 1) * i / 2),
  title,
}));

// Level-up seed rewards — each level gives specific seeds
// Pattern: cycle through available crops, quantity scales with level
export function getLevelReward(level) {
  if (level <= 0) return null;
  const tier = level <= 10 ? 1 : level <= 25 ? 2 : level <= 50 ? 3 : 4;
  const qty = tier === 1 ? 3 + Math.floor(level / 3) : tier === 2 ? 5 + Math.floor(level / 5) : tier === 3 ? 8 + Math.floor(level / 8) : 10 + Math.floor(level / 10);

  const starterPool = ['kangkong', 'pechay', 'mustasa', 'sitaw', 'talong'];
  const intermediatePool = ['kamatis', 'kalabasa', 'mais', 'palay', 'ampalaya'];
  const advancedPool = ['sibuyas', 'bawang', 'kamote', 'gabi'];
  const premiumPool = ['mangga', 'calamansi', 'dragonfruit', 'durian', 'mangosteen'];

  let pool;
  if (level <= 5) {
    pool = starterPool;
  } else if (level <= 10) {
    pool = [...starterPool, ...starterPool.slice(0, 3)]; // weighted toward starter
  } else if (level <= 15) {
    pool = [...starterPool, ...intermediatePool.slice(0, 3)];
  } else if (level <= 25) {
    pool = intermediatePool;
  } else if (level <= 35) {
    pool = [...intermediatePool.slice(0, 3), ...advancedPool.slice(0, 2)];
  } else if (level <= 50) {
    pool = [...advancedPool, ...intermediatePool.slice(0, 2)];
  } else if (level <= 65) {
    pool = [...advancedPool, ...premiumPool.slice(0, 2)];
  } else if (level <= 80) {
    pool = premiumPool;
  } else {
    pool = [...premiumPool, ...premiumPool]; // double weight on premium
  }

  // Deterministic pick based on level
  const seed = level * 2654435761;
  const idx = Math.abs(seed) % pool.length;
  const cropId = pool[idx];

  return { cropId, quantity: qty };
}

// Level milestone info lines (dummy descriptions for the expanded view)
export const LEVEL_MILESTONES = [
  'Expanded farm territory available',
  'New seeds unlocked in the Shop',
  'Increased crop yield potential',
];

// Seed Genetics + Crop Mastery (ported from the old version's research.js, numbers unchanged)

// Genetics: permanent sell-price multiplier per crop (same crop, better stats)
export const GENETICS_TIERS = [
  { tier: 1, name: 'Improved', emoji: '⬆️', priceMultiplier: 1.5 },
  { tier: 2, name: 'Superior', emoji: '🏅', priceMultiplier: 2.25 },
  { tier: 3, name: 'Elite', emoji: '👑', priceMultiplier: 3.375 },
  { tier: 4, name: 'Legendary', emoji: '🌟', priceMultiplier: 5.0625 },
  { tier: 5, name: 'Mythic', emoji: '✨', priceMultiplier: 7.59375 },
];
// Cost to go from currentTier -> currentTier+1: seedCost * 100 * 5^currentTier
export const getGeneticsCost = (crop, currentTier) => Math.floor(crop.seedCost * 100 * Math.pow(5, currentTier));

// Mastery: per-crop level (max 100), +0.5% weight AND +0.5% sell price per level
export const MASTERY_CONFIG = { maxLevel: 100, weightBonus: 0.005 };
// Cost to reach `level`: seedCost * 20 * 1.08^level * (1 + level*0.05)
export const getMasteryCost = (crop, level) => (level <= 0 ? 0 : Math.floor(crop.seedCost * 20 * Math.pow(1.08, level) * (1 + level * 0.05)));

// Pets (NEW - the old project had no pet system). One pet is active at a time; its bonus grows with level.
// bonus types: growth (% faster growing), weight (% heavier crops), xp (% more XP), mutation (+% mutation chance), price (% sell price)
export const PETS = [
  { id: 'aso', name: 'Aso', emoji: '🐶', desc: 'Loyal farm dog', bonus: 'growth', perLevel: 1.5, cost: 500, unlockLevel: 1 },
  { id: 'pusa', name: 'Pusa', emoji: '🐱', desc: 'Keeps the rats away', bonus: 'price', perLevel: 1.5, cost: 2500, unlockLevel: 3 },
  { id: 'manok', name: 'Manok', emoji: '🐔', desc: 'Scratches up extra growth', bonus: 'weight', perLevel: 1, cost: 10000, unlockLevel: 6 },
  { id: 'kalabaw', name: 'Kalabaw', emoji: '🐃', desc: 'Strong carabao, hard worker', bonus: 'xp', perLevel: 2.5, cost: 50000, unlockLevel: 10 },
  { id: 'loro', name: 'Loro', emoji: '🦜', desc: 'Spots the weather early', bonus: 'mutation', perLevel: 0.75, cost: 250000, unlockLevel: 15 },
  { id: 'dragon', name: 'Dragon', emoji: '🐉', desc: 'Legendary guardian', bonus: 'price', perLevel: 3, cost: 5000000, unlockLevel: 30 },
];
export const PET_MAX_LEVEL = 10;
export const BONUS_LABEL = { growth: 'faster growth', weight: 'crop weight', xp: 'XP', mutation: 'mutation chance', price: 'sell price' };
// Cost to raise a pet FROM `level` to level+1 (level 1 = just adopted)
export const getPetFeedCost = (pet, level) => Math.floor(pet.cost * 0.5 * Math.pow(1.6, level - 1));

export const CROP_CATEGORIES = [
  { id: 'starter', name: '🌱 Starter Crops', unlockLevel: 1 },
  { id: 'intermediate', name: '🌾 Intermediate Crops', unlockLevel: 8 },
  { id: 'advanced', name: '🌿 Advanced Crops', unlockLevel: 25 },
  { id: 'premium', name: '💎 Premium Crops', unlockLevel: 50 },
];

export const CROPS = [
  // 🌱 Starter Crops
  { id: 'kangkong', name: 'Kangkong', emoji: '🥬', category: 'starter', seedCost: 2, growTime: 15, sellPrice: 3, xp: 2, unlockLevel: 1, minWeight: 0.2, maxWeight: 0.8 },
  { id: 'pechay', name: 'Pechay', emoji: '🥦', category: 'starter', seedCost: 3, growTime: 20, sellPrice: 4, xp: 2, unlockLevel: 1, minWeight: 0.3, maxWeight: 1.0 },
  { id: 'mustasa', name: 'Mustasa', emoji: '🌿', category: 'starter', seedCost: 3, growTime: 25, sellPrice: 5, xp: 3, unlockLevel: 2, minWeight: 0.2, maxWeight: 0.7 },
  { id: 'sitaw', name: 'Strawberry', emoji: '🍓', category: 'starter', seedCost: 4, growTime: 30, sellPrice: 6, xp: 3, unlockLevel: 3, minWeight: 0.1, maxWeight: 0.5 },
  { id: 'talong', name: 'Talong', emoji: '🍆', category: 'starter', seedCost: 5, growTime: 40, sellPrice: 8, xp: 4, unlockLevel: 5, minWeight: 0.3, maxWeight: 1.2 },

  // 🌾 Intermediate Crops
  { id: 'kamatis', name: 'Kamatis', emoji: '🍅', category: 'intermediate', seedCost: 8, growTime: 60, sellPrice: 12, xp: 5, unlockLevel: 8, minWeight: 0.2, maxWeight: 0.8 },
  { id: 'kalabasa', name: 'Kalabasa', emoji: '🎃', category: 'intermediate', seedCost: 12, growTime: 90, sellPrice: 20, xp: 8, unlockLevel: 10, minWeight: 2.0, maxWeight: 8.0 },
  { id: 'mais', name: 'Mais', emoji: '🌽', category: 'intermediate', seedCost: 10, growTime: 75, sellPrice: 15, xp: 6, unlockLevel: 12, minWeight: 0.3, maxWeight: 1.0 },
  { id: 'palay', name: 'Palay', emoji: '🌾', category: 'intermediate', seedCost: 15, growTime: 100, sellPrice: 25, xp: 10, unlockLevel: 15, minWeight: 0.5, maxWeight: 2.0 },
  { id: 'ampalaya', name: 'Ampalaya', emoji: '🥒', category: 'intermediate', seedCost: 12, growTime: 80, sellPrice: 18, xp: 7, unlockLevel: 18, minWeight: 0.3, maxWeight: 1.0 },

  // 🌿 Advanced Crops
  { id: 'sibuyas', name: 'Sibuyas', emoji: '🧅', category: 'advanced', seedCost: 20, growTime: 120, sellPrice: 35, xp: 12, unlockLevel: 25, minWeight: 0.2, maxWeight: 0.6 },
  { id: 'bawang', name: 'Bawang', emoji: '🧄', category: 'advanced', seedCost: 25, growTime: 150, sellPrice: 45, xp: 15, unlockLevel: 30, minWeight: 0.1, maxWeight: 0.4 },
  { id: 'kamote', name: 'Kamote', emoji: '🍠', category: 'advanced', seedCost: 22, growTime: 130, sellPrice: 40, xp: 13, unlockLevel: 35, minWeight: 0.5, maxWeight: 2.5 },
  { id: 'gabi', name: 'Gabi', emoji: '🥔', category: 'advanced', seedCost: 28, growTime: 160, sellPrice: 50, xp: 16, unlockLevel: 40, minWeight: 0.5, maxWeight: 3.0 },

  // 💎 Premium Crops
  { id: 'mangga', name: 'Mangga', emoji: '🥭', category: 'premium', seedCost: 40, growTime: 200, sellPrice: 80, xp: 25, unlockLevel: 50, minWeight: 0.3, maxWeight: 1.5 },
  { id: 'calamansi', name: 'Calamansi', emoji: '🍋', category: 'premium', seedCost: 35, growTime: 180, sellPrice: 70, xp: 20, unlockLevel: 55, minWeight: 0.1, maxWeight: 0.3 },
  { id: 'dragonfruit', name: 'Grapes', emoji: '🍇', category: 'premium', seedCost: 60, growTime: 250, sellPrice: 120, xp: 30, unlockLevel: 65, minWeight: 0.3, maxWeight: 1.0 },
  { id: 'durian', name: 'Avocado', emoji: '🥑', category: 'premium', seedCost: 80, growTime: 300, sellPrice: 200, xp: 40, unlockLevel: 80, minWeight: 2.0, maxWeight: 6.0 },
  { id: 'mangosteen', name: 'Pineapple', emoji: '🍍', category: 'premium', seedCost: 100, growTime: 280, sellPrice: 150, xp: 35, unlockLevel: 95, minWeight: 0.2, maxWeight: 0.5 },
];

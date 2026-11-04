export const GEAR_ITEMS = {
  fertilizer: {
    id: 'fertilizer',
    name: 'Fertilizer',
    emoji: '💩',
    description: 'Increase crop weight by 20-50%',
    cost: 5,
    type: 'consumable',
  },
};

// duration: seconds the sprinkler stays active after use
export const SPRINKLERS = [
  {
    tier: 1,
    name: 'Basic Sprinkler',
    emoji: '💧',
    cost: 10,
    speedBonus: 0.10,
    duration: 300,
    description: '+10% crop growth speed · 5 min',
  },
  {
    tier: 2,
    name: 'Advanced Sprinkler',
    emoji: '💦',
    cost: 20,
    speedBonus: 0.25,
    duration: 300,
    description: '+25% crop growth speed · 5 min',
  },
  {
    tier: 3,
    name: 'Golden Sprinkler',
    emoji: '🌈',
    cost: 30,
    speedBonus: 0.50,
    doubleHarvestBonus: 0.10,
    duration: 300,
    description: '+50% speed · +10% double harvest · 5 min',
  },
];

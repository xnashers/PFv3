// Token sinks. `kind`: tier (permanent, multi-level), consumable (adds to a counter), cosmetic (owned once, equip), unlock.
export const AUTO_HARVEST_TIERS = [
  { cost: 40, cats: ['starter'], label: 'Starter crops' },
  { cost: 120, cats: ['starter', 'intermediate'], label: 'Starter + Intermediate' },
  { cost: 300, cats: ['starter', 'intermediate', 'advanced', 'premium'], label: 'All crops' },
];
export const MUTLUCK_MAX = 10;
export const mutLuckCost = (lvl) => Math.round(12 * Math.pow(lvl + 1, 1.5));  // cost to go from lvl -> lvl+1
export const MUTLUCK_PER_LEVEL = 2;            // +2% mutation chance per level
export const BOOST_MS = 30 * 60 * 1000;         // event boost: x2 XP, +25% sell price
export const SLOT2_COST = 60;
export const TICKET_COST = 10, TREAT_COST = 8, LEGEND_COST = 25, BOOST_COST = 20;
export const EVOLVE_TREATS = 3;                 // pet treats needed to evolve a max-level pet

export const COSMETICS = [
  { id: 'plot_sakura', slot: 'plot', name: 'Sakura Plots', emoji: '🌸', cost: 30 },
  { id: 'plot_ginto', slot: 'plot', name: 'Gintong Lupa', emoji: '🥇', cost: 60 },
  { id: 'plot_dagat', slot: 'plot', name: 'Dagat Plots', emoji: '🌊', cost: 45 },
  { id: 'frame_mais', slot: 'frame', name: 'Mais Frame', emoji: '🌽', cost: 35 },
  { id: 'frame_royal', slot: 'frame', name: 'Royal Frame', emoji: '👑', cost: 80 },
  { id: 'weekly_frame', slot: 'frame', name: 'Bayanihan Frame', emoji: '🏮', cost: null, note: 'Weekly quest bonus' },
];
export const getCosmetic = (id) => COSMETICS.find((c) => c.id === id);

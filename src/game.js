// Pocket Farm core logic. No DOM, no Firebase: easy to test and to move to a server later.
import { CROPS } from '../data/crops.js';
import { SPRINKLERS } from '../data/gear.js';
import { LEVELS, getLevelReward } from '../data/levels.js';
import { GENETICS_TIERS, getGeneticsCost, MASTERY_CONFIG, getMasteryCost } from '../data/genetics.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { PETS, PET_MAX_LEVEL, getPetFeedCost } from '../data/pets.js';
import { WEATHER_TYPES, SECRET_MUTATIONS, WEATHER_CHANGE_INTERVAL, MUTATION_CHANCE } from '../data/weather.js';
import { getEvent } from '../data/events.js';
import { DAILY_POOL, WEEKLY_POOL, DAILY_COUNT, WEEKLY_COUNT, DAILY_BONUS, WEEKLY_BONUS, LOGIN_REWARDS } from '../data/quests.js';
import { AUTO_HARVEST_TIERS, MUTLUCK_MAX, mutLuckCost, MUTLUCK_PER_LEVEL, BOOST_MS, SLOT2_COST, TICKET_COST, TREAT_COST, LEGEND_COST, BOOST_COST, EVOLVE_TREATS, COSMETICS, getCosmetic } from '../data/tokenshop.js';

// Bump this number to wipe every player's progress: saves from an older epoch are ignored on login.
export const SAVE_EPOCH = 1;
export const FERTILIZER_COST = 5;
const STOCK = { starter: 5, intermediate: 3, advanced: 1, premium: 1 };
const STOCK_MS = 5 * 60 * 1000;

const emptyPlot = (id) => ({ id, status: 'empty', cropId: null, plantedAt: null, harvestAt: null, mutations: [], fertilized: false, doubleChance: 0, rolled: false });
export const getCrop = (id) => CROPS.find((c) => c.id === id);
export const getPet = (id) => PETS.find((p) => p.id === id);
const CHEAT_CODES = ['hesoyam', 'growall'];
const newStats = () => ({ harvests: 0, sold: 0, earned: 0, mutations: 0, weatherChanges: 0, weatherTypes: [], cropsHarvested: {}, petsOwned: 0, bestSale: 0 });

// ---- calendar helpers (local time, so "daily" resets at the player's own midnight) ----
const dayKey = () => { const d = new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000); };
const weekKey = (dk = dayKey()) => Math.floor((dk + 3) / 7);          // weeks start on Monday
const seasonId = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };  // seasons = calendar months
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const newMeta = () => ({ autoHarvest: 0, mutLuck: 0, slot2: false, treats: 0, boostUntil: 0, skins: { owned: [], plot: null, frame: null } });
const RARE_WEATHER_WEIGHT = 4;

export class Game {
  constructor() { this.handlers = {}; this.reset(); }

  reset() {
    this.player = { peso: 100, xp: 0, level: 1, farmName: '' };
    this.plots = [];
    this.boughtPlots = 0;
    this.seeds = { kangkong: 3, pechay: 3 };          // welcome gift
    this.inventory = {};                               // cropId -> [{ weight, mutations }]
    this.gear = { fertilizer: 0, sprinklers: { 1: 0, 2: 0, 3: 0 } };
    this.weather = null;                               // { id, since }
    this.stock = { seeds: {}, expiresAt: 0 };          // cropId -> remaining
    this.stats = newStats();
    this.cropGenetics = {};                            // cropId -> tier 0..5
    this.cropMastery = {};                             // cropId -> level 0..100
    this.achievements = {};                            // id -> { unlockedAt, claimed }
    this.titles = { owned: [], active: null };
    this.pets = { owned: {}, active: null, active2: null, evolved: {} };   // owned: petId -> level
    this.tokens = 0; this.weatherTickets = 0;
    this.meta = newMeta();                             // token-shop upgrades, boosts, cosmetics
    this.daily = null; this.weekly = null;             // { key, list:[{id,counter,target}], counters, claimed, bonusClaimed }
    this.streak = { count: 0, lastDay: -1, claimedDay: -1 };
    this.season = { id: '', earned: 0, mutations: 0 };
    this.savedAt = 0;
    this.ensurePlots();
  }

  // ---------- events ----------
  on(evt, fn) { (this.handlers[evt] ||= new Set()).add(fn); return () => this.handlers[evt].delete(fn); }
  emit(evt, data) { this.handlers[evt]?.forEach((fn) => fn(data)); }
  changed() { this.checkAchievements(); this.savedAt = Date.now(); this.emit('change'); }

  // ---------- persistence ----------
  snapshot() {
    const { player, plots, boughtPlots, seeds, inventory, gear, weather, stock, stats, savedAt, cropGenetics, cropMastery, achievements, titles, pets, tokens, weatherTickets, meta, daily, weekly, streak, season } = this;
    return JSON.parse(JSON.stringify({ v: 2, epoch: SAVE_EPOCH, player, plots, boughtPlots, seeds, inventory, gear, weather, stock, stats, savedAt, cropGenetics, cropMastery, achievements, titles, pets, tokens, weatherTickets, meta, daily, weekly, streak, season }));
  }
  load(d) {
    if (!d) return;
    this.reset();
    this.player = { ...this.player, ...d.player };
    this.boughtPlots = d.boughtPlots || 0;
    this.plots = d.plots || [];
    this.seeds = d.seeds || {};
    this.inventory = d.inventory || {};
    this.gear = { fertilizer: d.gear?.fertilizer || 0, sprinklers: { 1: 0, 2: 0, 3: 0, ...(d.gear?.sprinklers || {}) } };
    this.weather = d.weather || null;
    this.stock = d.stock || this.stock;
    this.stats = { ...newStats(), ...d.stats };    // older saves lack the new counters -> defaults
    this.cropGenetics = d.cropGenetics || {}; this.cropMastery = d.cropMastery || {};
    this.achievements = d.achievements || {};
    this.titles = { owned: [], active: null, ...(d.titles || {}) };
    this.pets = { owned: {}, active: null, active2: null, evolved: {}, ...(d.pets || {}) };
    this.tokens = d.tokens || 0; this.weatherTickets = d.weatherTickets || 0;
    this.meta = { ...newMeta(), ...(d.meta || {}), skins: { owned: [], plot: null, frame: null, ...(d.meta?.skins || {}) } };
    this.daily = d.daily || null; this.weekly = d.weekly || null;
    this.streak = { ...this.streak, ...(d.streak || {}) }; this.season = { ...this.season, ...(d.season || {}) };
    this.stats.petsOwned = Object.keys(this.pets.owned).filter((id) => !getPet(id)?.eventOnly).length;
    this.savedAt = d.savedAt || 0;
    this.ensurePlots();
    this.tick();
  }
  get leaderboardProfile() {
    const p = this.player;
    return {
      farmName: p.farmName || 'Farm', level: p.level, xp: Math.floor(p.xp), peso: Math.floor(p.peso), score: p.level * 1e7 + Math.min(Math.floor(p.xp), 9999999),
      mutations: Math.floor(this.stats.mutations || 0), harvests: Math.floor(this.stats.harvests || 0), bestSale: Math.floor(this.stats.bestSale || 0),
      seasonId: this.season.id, seasonEarned: Math.floor(this.season.earned || 0),
    };
  }

  // ---------- plots ----------
  get plotCount() { return 4 + (this.player.level - 1) * 2 + this.boughtPlots; }
  get plotPrice() { return 20 * 2 ** this.boughtPlots; }
  ensurePlots() { while (this.plots.length < this.plotCount) this.plots.push(emptyPlot(this.plots.length)); }
  buyPlot() {
    if (this.player.peso < this.plotPrice) return fail('Not enough ₱');
    this.player.peso -= this.plotPrice; this.boughtPlots++; this.ensurePlots(); this.changed(); return ok();
  }
  progress(p) {
    if (p.status === 'ready') return 1;
    if (p.status !== 'growing') return 0;
    return Math.min(1, (Date.now() - p.plantedAt) / (p.harvestAt - p.plantedAt));
  }
  stage(p) { const t = this.progress(p); return p.status === 'ready' ? 3 : t < 0.34 ? 0 : t < 0.67 ? 1 : 2; }

  // ---------- main loop (call once per second) ----------
  tick() {
    const now = Date.now(); let dirty = this.rollPeriods();
    for (const p of this.plots) if (p.status === 'growing' && now >= p.harvestAt) { p.status = 'ready'; dirty = true; }
    if (!this.weather || now - this.weather.since >= this.weatherInterval) { this.changeWeather(); dirty = true; }
    if (now >= this.stock.expiresAt) { this.refreshStock(); dirty = true; }
    const auto = this.autoHarvestTick(); if (auto) { this.emit('auto', auto); dirty = true; }
    if (dirty) this.changed();
    return dirty;
  }

  // ---------- weather & mutations ----------
  get currentWeather() { return WEATHER_TYPES.find((w) => w.id === this.weather?.id) || null; }
  get weatherInterval() { return this.activeEvent.id === 'mutmad' ? WEATHER_CHANGE_INTERVAL / 2 : WEATHER_CHANGE_INTERVAL; }
  get weatherSecondsLeft() { return this.weather ? Math.max(0, Math.ceil((this.weather.since + this.weatherInterval - Date.now()) / 1000)) : 0; }
  get activeEvent() { return getEvent(); }
  pickWeather() {
    const storm = this.activeEvent.id === 'typhoon' ? ['rain', 'windstorm', 'thunderstorm'] : [];
    const wt = (w) => w.weight * (storm.includes(w.id) ? 5 : 1);
    const total = WEATHER_TYPES.reduce((s, w) => s + wt(w), 0);
    let r = Math.random() * total;
    for (const w of WEATHER_TYPES) { r -= wt(w); if (r <= 0) return w; }
    return WEATHER_TYPES[0];
  }
  mutLuckPct() { return this.meta.mutLuck * MUTLUCK_PER_LEVEL; }
  mutationChance(w) {
    const extra = (this.petBonus('mutation') + this.mutLuckPct()) / 100;
    if (['cherry', 'fullmoon', 'aurora', 'divine'].includes(w.id)) return Math.min(0.95, MUTATION_CHANCE + 0.15 + extra);
    if (['rainbow', 'meteor', 'eclipse'].includes(w.id)) return Math.min(0.95, MUTATION_CHANCE + 0.10 + extra);
    return Math.min(0.95, MUTATION_CHANCE + extra);
  }
  changeWeather(forced) {
    const w = forced || this.pickWeather();
    const stormBonus = this.activeEvent.id === 'typhoon' && ['rain', 'windstorm', 'thunderstorm'].includes(w.id) ? 1.5 : 1;
    this.weather = { id: w.id, since: Date.now() };
    this.stats.weatherChanges++; if (!this.stats.weatherTypes.includes(w.id)) this.stats.weatherTypes.push(w.id);
    const chance = this.mutationChance(w);
    if (w.weight <= RARE_WEATHER_WEIGHT) this.bump('rareWeather');
    for (const p of this.plots) {
      if (p.status !== 'ready') continue;
      p.rolled = true;                       // the auto-harvester only collects crops that have had a mutation roll
      if (Math.random() >= chance) continue;
      if (p.mutations.length >= 5 || p.mutations.some((m) => m.weatherId === w.id)) continue;
      p.mutations.push({ weatherId: w.id, name: w.mutation, emoji: w.mutationEmoji, priceBonus: Math.round(w.priceBonus * stormBonus) });
      const have = new Set(p.mutations.map((m) => m.weatherId));
      for (const s of SECRET_MUTATIONS) {
        if (s.requires.every((id) => have.has(id)) && !have.has(s.id))
          { p.mutations.push({ weatherId: s.id, name: s.name, emoji: s.emoji, priceBonus: s.priceBonus, isSecret: true }); this.bump('secret'); }
      }
    }
    this.emit('weather', w);
  }
  plantingBlock(cropId) {
    const w = this.weather?.id, c = getCrop(cropId);
    if (w === 'snow' && ['premium', 'advanced'].includes(c.category)) return `❄️ Too cold for ${c.name} in the snow.`;
    if (w === 'thunderstorm' && c.category === 'premium') return `⛈️ Lightning! No premium crops in a thunderstorm.`;
    return null;
  }

  // ---------- seed shop ----------
  refreshStock() {
    const seeds = {};
    for (const cat of ['starter', 'intermediate', 'advanced', 'premium']) {
      const list = CROPS.filter((c) => c.category === cat);
      const rare = cat === 'advanced' || cat === 'premium';
      const open = new Set(rare ? [...list].sort(() => Math.random() - 0.5).slice(0, Math.max(1, Math.round(list.length * 0.3))).map((c) => c.id) : list.map((c) => c.id));
      for (const c of list) seeds[c.id] = open.has(c.id) ? STOCK[cat] : 0;
    }
    this.stock = { seeds, expiresAt: Date.now() + STOCK_MS };
  }
  stockOf(id) { return this.stock.seeds[id] || 0; }
  isUnlocked(id) { return this.player.level >= getCrop(id).unlockLevel; }
  buySeed(id, qty = 1) {
    const c = getCrop(id);
    if (!this.isUnlocked(id)) return fail(`Unlocks at level ${c.unlockLevel}`);
    const n = Math.min(qty, this.stockOf(id));
    if (n <= 0) return fail('Out of stock - check back soon!');
    const cost = c.seedCost * n;
    if (this.player.peso < cost) return fail('Not enough ₱');
    this.player.peso -= cost; this.stock.seeds[id] -= n; this.seeds[id] = (this.seeds[id] || 0) + n;
    this.changed(); return ok({ n, cost });
  }
  buyFertilizer(qty = 1) {
    const cost = FERTILIZER_COST * qty;
    if (this.player.peso < cost) return fail('Not enough ₱');
    this.player.peso -= cost; this.gear.fertilizer += qty; this.changed(); return ok();
  }
  buySprinkler(tier) {
    const s = SPRINKLERS.find((x) => x.tier === tier);
    if (this.player.peso < s.cost) return fail('Not enough ₱');
    this.player.peso -= s.cost; this.gear.sprinklers[tier]++; this.changed(); return ok();
  }

  // ---------- farming ----------
  plant(i, cropId) {
    const p = this.plots[i];
    if (!p || p.status !== 'empty') return fail('Plot is not empty');
    if (!(this.seeds[cropId] > 0)) return fail('No seeds left');
    const block = this.plantingBlock(cropId); if (block) return fail(block);
    this.seeds[cropId]--; if (this.seeds[cropId] <= 0) delete this.seeds[cropId];
    const now = Date.now();
    Object.assign(p, { status: 'growing', cropId, plantedAt: now, harvestAt: now + getCrop(cropId).growTime * 1000 * (1 - Math.min(0.5, this.petBonus('growth') / 100)), mutations: [], fertilized: false, doubleChance: 0 });
    this.bump('plant'); this.changed(); return ok();
  }
  fertilize(i) {
    const p = this.plots[i];
    if (!p || !p.cropId || p.fertilized) return fail(p?.fertilized ? 'Already fertilized' : 'Plant something first');
    if (this.gear.fertilizer <= 0) return fail('No fertilizer - buy some in the shop');
    this.gear.fertilizer--; p.fertilized = true; this.changed(); return ok();
  }
  // Sprinkler: speeds growth for `duration` seconds -> shaves (duration * speedBonus) off the remaining time.
  sprinkle(i, tier) {
    const p = this.plots[i], s = SPRINKLERS.find((x) => x.tier === tier);
    if (!p || p.status !== 'growing') return fail('Only growing crops can be watered');
    if (!(this.gear.sprinklers[tier] > 0)) return fail('No sprinklers of that type');
    this.gear.sprinklers[tier]--;
    p.harvestAt -= Math.min(p.harvestAt - Date.now(), s.duration * 1000 * s.speedBonus);
    if (s.doubleHarvestBonus) p.doubleChance = Math.max(p.doubleChance, s.doubleHarvestBonus);
    this.tick(); this.changed(); return ok();
  }
  rollWeight(c, fertilized) {
    const r = (Math.random() + Math.random() + Math.random()) / 3;
    let w = c.minWeight + (c.maxWeight - c.minWeight) * r;
    w *= (1 + this.petBonus('weight') / 100) * (1 + this.masteryLevel(c.id) * MASTERY_CONFIG.weightBonus);
    if (fertilized) w *= 1.2 + Math.random() * 0.3;
    return Math.round(w * 100) / 100;
  }
  harvest(i) {
    const p = this.plots[i];
    if (!p || p.status !== 'ready') return fail('Not ready yet');
    const c = getCrop(p.cropId);
    const count = Math.random() < p.doubleChance ? 2 : 1;
    const items = [];
    for (let k = 0; k < count; k++) items.push({ weight: this.rollWeight(c, p.fertilized), mutations: [...p.mutations] });
    (this.inventory[c.id] ||= []).push(...items);
    this.stats.harvests += count;
    this.stats.cropsHarvested[c.id] = (this.stats.cropsHarvested[c.id] || 0) + count;
    const mutated = items.filter((it) => it.mutations.length).length;
    if (mutated) { this.stats.mutations += mutated; this.season.mutations += mutated; }
    this.bump('harvest', count); this.bump('mutated', mutated);
    Object.assign(p, emptyPlot(p.id));
    const levelled = this.addXP(Math.round(c.xp * count * (1 + this.petBonus('xp') / 100) * this.xpMult()));
    this.changed(); return ok({ crop: c, items, levelled });
  }

  // ---------- selling ----------
  itemPrice(cropId, item) {
    const bonus = (item.mutations || []).reduce((s, m) => s + (m.priceBonus || 0), 0);
    const mult = this.geneticsMult(cropId) * (1 + this.masteryLevel(cropId) * MASTERY_CONFIG.weightBonus) * (1 + this.petBonus('price') / 100);
    return Math.max(1, Math.floor(getCrop(cropId).sellPrice * item.weight * mult * this.priceMult()) + bonus);
  }
  /** Pays out `sold` items of one crop and updates stats / quests / season. */
  settle(cropId, sold) {
    const prices = sold.map((it) => this.itemPrice(cropId, it)), total = prices.reduce((a, b) => a + b, 0), best = Math.max(0, ...prices);
    this.player.peso += total; this.stats.sold += sold.length; this.stats.earned += total;
    this.stats.bestSale = Math.max(this.stats.bestSale || 0, best);
    this.season.earned += total; this.bump('soldPeso', total);
    return total;
  }
  sell(cropId, mode = 'all') {
    const list = this.inventory[cropId]; if (!list?.length) return fail('Nothing to sell');
    let sold;
    if (mode === 'heaviest') { const idx = list.reduce((b, it, k) => (this.itemPrice(cropId, it) > this.itemPrice(cropId, list[b]) ? k : b), 0); sold = list.splice(idx, 1); }
    else { sold = list.splice(0, list.length); }
    if (!list.length) delete this.inventory[cropId];
    const total = this.settle(cropId, sold);
    this.changed(); return ok({ total, count: sold.length });
  }
  /** Bulk sell with filters: mutated = true (only mutated) | false (only plain, keeps your mutated crops) | null; category = 'starter'... */
  sellFilter({ mutated = null, category = null } = {}) {
    let total = 0, count = 0;
    for (const id of Object.keys(this.inventory)) {
      if (category && getCrop(id).category !== category) continue;
      const keep = [], sold = [];
      for (const it of this.inventory[id]) ((mutated === null || mutated === it.mutations.length > 0) ? sold : keep).push(it);
      if (!sold.length) continue;
      total += this.settle(id, sold); count += sold.length;
      if (keep.length) this.inventory[id] = keep; else delete this.inventory[id];
    }
    if (!count) return fail('Nothing matches that filter');
    this.changed(); return ok({ total, count });
  }
  sellEverything() {
    let total = 0, count = 0;
    for (const id of Object.keys(this.inventory)) { const r = this.sell(id, 'all'); if (r.ok) { total += r.total; count += r.count; } }
    return count ? ok({ total, count }) : fail('Your basket is empty');
  }
  inventoryValue(cropId) { return (this.inventory[cropId] || []).reduce((s, it) => s + this.itemPrice(cropId, it), 0); }

  // ---------- xp / levels ----------
  get levelTitle() { return LEVELS[this.player.level - 1]?.title || ''; }
  get xpProgress() {
    const cur = LEVELS[this.player.level - 1], next = LEVELS[this.player.level];
    if (!next) return { pct: 1, cur: 0, need: 0 };
    return { pct: (this.player.xp - cur.xpRequired) / (next.xpRequired - cur.xpRequired), cur: Math.floor(this.player.xp - cur.xpRequired), need: next.xpRequired - cur.xpRequired };
  }
  addXP(n) {
    this.player.xp += n; let up = false;
    while (LEVELS[this.player.level] && this.player.xp >= LEVELS[this.player.level].xpRequired) {
      this.player.level++; up = true;
      const r = getLevelReward(this.player.level);
      if (r) this.seeds[r.cropId] = (this.seeds[r.cropId] || 0) + r.quantity;
      this.ensurePlots();
      this.emit('levelup', { level: this.player.level, reward: r });
    }
    return up;
  }
  // ---------- genetics & mastery (ported from v1) ----------
  geneticsTier(id) { return this.cropGenetics[id] || 0; }
  geneticsMult(id) { const t = this.geneticsTier(id); return t > 0 ? GENETICS_TIERS[t - 1].priceMultiplier : 1; }
  geneticsCost(id) { const t = this.geneticsTier(id); return t >= GENETICS_TIERS.length ? null : getGeneticsCost(getCrop(id), t); }
  upgradeGenetics(id) {
    const c = getCrop(id); if (!c) return fail('Unknown crop');
    const cost = this.geneticsCost(id); if (cost === null) return fail('Already at max tier');
    if (this.player.peso < cost) return fail('Not enough ₱');
    this.player.peso -= cost; this.cropGenetics[id] = this.geneticsTier(id) + 1; this.changed();
    return ok({ tier: this.cropGenetics[id], cost });
  }
  masteryLevel(id) { return this.cropMastery[id] || 0; }
  masteryCost(id) { const l = this.masteryLevel(id); return l >= MASTERY_CONFIG.maxLevel ? null : getMasteryCost(getCrop(id), l + 1); }
  upgradeMastery(id) {
    const c = getCrop(id); if (!c) return fail('Unknown crop');
    const cost = this.masteryCost(id); if (cost === null) return fail('Already at max mastery');
    if (this.player.peso < cost) return fail('Not enough ₱');
    this.player.peso -= cost; this.cropMastery[id] = this.masteryLevel(id) + 1; this.changed();
    return ok({ level: this.cropMastery[id], cost });
  }

  // ---------- pets (new) ----------
  petLevel(id) { return this.pets.owned[id] || 0; }
  get activePet() { return this.activePets[0] || null; }
  /** Up to 2 active pets (2nd slot is a token-shop unlock). */
  get activePets() {
    const ids = [this.pets.active, this.meta.slot2 ? this.pets.active2 : null].filter((id, i, a) => id && this.petLevel(id) && a.indexOf(id) === i);
    return ids.map(getPet);
  }
  /** Two active pets with different jobs get a +15% synergy; Pet Parade doubles everything; evolved pets are x1.5. */
  petBonus(type) {
    const list = this.activePets; if (!list.length) return 0;
    const synergy = list.length === 2 && list[0].bonus !== list[1].bonus ? 1.15 : 1;
    const parade = this.activeEvent.id === 'parade' ? 2 : 1;
    return list.filter((p) => p.bonus === type).reduce((s, p) => s + p.perLevel * this.petLevel(p.id) * (this.pets.evolved[p.id] ? 1.5 : 1), 0) * synergy * parade;
  }
  adoptPet(id) {
    const p = getPet(id); if (!p) return fail('Unknown pet');
    if (this.petLevel(id)) return fail('You already have this pet');
    if (p.eventOnly && this.activeEvent.id !== p.eventOnly) return fail('Only available during the Pet Parade event');
    if (this.player.level < p.unlockLevel) return fail(`Unlocks at level ${p.unlockLevel}`);
    if (this.player.peso < p.cost) return fail('Not enough ₱');
    this.player.peso -= p.cost; this.pets.owned[id] = 1; if (!this.pets.active) this.pets.active = id;
    this.stats.petsOwned = Object.keys(this.pets.owned).filter((x) => !getPet(x)?.eventOnly).length; this.changed(); return ok();
  }
  feedPet(id) {
    const p = getPet(id), lvl = this.petLevel(id); if (!p || !lvl) return fail("You don't own this pet");
    if (lvl >= PET_MAX_LEVEL) return fail('Max level');
    const cost = getPetFeedCost(p, lvl); if (this.player.peso < cost) return fail('Not enough ₱');
    this.player.peso -= cost; this.pets.owned[id] = lvl + 1; this.bump('feed'); this.changed(); return ok({ level: lvl + 1 });
  }
  /** Pet Treats (token shop) level a pet up for free. */
  treatPet(id) {
    const lvl = this.petLevel(id); if (!lvl) return fail("You don't own this pet");
    if (lvl >= PET_MAX_LEVEL) return fail('Max level - try evolving it');
    if (this.meta.treats < 1) return fail('No Pet Treats - buy some with tokens');
    this.meta.treats--; this.pets.owned[id] = lvl + 1; this.bump('feed'); this.changed(); return ok({ level: lvl + 1 });
  }
  evolvePet(id) {
    const lvl = this.petLevel(id); if (!lvl) return fail("You don't own this pet");
    if (lvl < PET_MAX_LEVEL) return fail(`Reach level ${PET_MAX_LEVEL} first`);
    if (this.pets.evolved[id]) return fail('Already evolved');
    if (this.meta.treats < EVOLVE_TREATS) return fail(`Needs ${EVOLVE_TREATS} Pet Treats`);
    this.meta.treats -= EVOLVE_TREATS; this.pets.evolved[id] = true; this.changed(); return ok();
  }
  setActivePet(id) {
    if (id && !this.petLevel(id)) return fail("You don't own this pet");
    this.pets.active = id || null; if (id && this.pets.active2 === id) this.pets.active2 = null; this.changed(); return ok();
  }
  setPetSlot2(id) {
    if (!this.meta.slot2) return fail('Unlock the 2nd pet slot in the Token Shop');
    if (id && !this.petLevel(id)) return fail("You don't own this pet");
    if (id && id === this.pets.active) return fail('That pet is already in slot 1');
    this.pets.active2 = id || null; this.changed(); return ok();
  }

  // ---------- achievements & titles (ported from v1) ----------
  checkAchievements() {
    for (const a of ACHIEVEMENTS) {
      if (this.achievements[a.id] || !a.check(this.stats, this.player)) continue;
      this.achievements[a.id] = { unlockedAt: Date.now(), claimed: false };
      queueMicrotask(() => this.emit('achievement', a));
    }
  }
  get unclaimedAchievements() { return ACHIEVEMENTS.filter((a) => this.achievements[a.id] && !this.achievements[a.id].claimed); }
  claimAchievement(id) {
    const e = this.achievements[id], a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!e || !a || e.claimed) return fail('Nothing to claim');
    e.claimed = true;
    if (a.title && !this.titles.owned.includes(a.title)) this.titles.owned.push(a.title);
    this.grantReward(a.reward); this.changed(); return ok({ reward: a.reward });
  }
  claimAllAchievements() {
    const list = this.unclaimedAchievements; if (!list.length) return fail('Nothing to claim');
    for (const a of list) { this.achievements[a.id].claimed = true; if (a.title && !this.titles.owned.includes(a.title)) this.titles.owned.push(a.title); this.grantReward(a.reward); }
    this.changed(); return ok({ count: list.length });
  }
  grantReward(r) {
    switch (r.type) {
      case 'peso': this.player.peso += r.amount; break;
      case 'fertilizer': this.gear.fertilizer += r.amount; break;
      case 'sprinkler': this.gear.sprinklers[r.tier] = (this.gear.sprinklers[r.tier] || 0) + r.amount; break;
      case 'premium_seed_pack': {
        const prem = CROPS.filter((c) => c.category === 'premium');
        for (let i = 0; i < (r.amount || 1) * 3; i++) { const c = prem[Math.floor(Math.random() * prem.length)]; this.seeds[c.id] = (this.seeds[c.id] || 0) + 1; }
        break;
      }
      case 'tokens': this.tokens += r.amount; break;
      case 'weather_ticket': this.weatherTickets += r.amount; break;
      case 'cosmetic': if (!this.meta.skins.owned.includes(r.id)) this.meta.skins.owned.push(r.id); break;
    }
  }
  setActiveTitle(id) {
    if (id && !this.titles.owned.includes(id)) return fail("You don't own this title");
    this.titles.active = id || null; this.changed(); return ok();
  }

  // ---------- boosts / events ----------
  get boostActive() { return this.meta.boostUntil > Date.now(); }
  xpMult() { return (this.activeEvent.id === 'pista' ? 1.5 : 1) * (this.boostActive ? 2 : 1); }
  priceMult() { return (this.activeEvent.id === 'pista' ? 1.25 : 1) * (this.boostActive ? 1.25 : 1); }

  // ---------- QoL: harvest-all, plant-all, auto-harvester ----------
  get readyCount() { return this.plots.filter((p) => p.status === 'ready').length; }
  harvestAll() {
    let n = 0, levelled = false;
    for (let i = 0; i < this.plots.length; i++) if (this.plots[i].status === 'ready') { const r = this.harvest(i); if (r.ok) { n += r.items.length; levelled ||= r.levelled; } }
    return n ? ok({ count: n, levelled }) : fail('Nothing is ready yet');
  }
  plantAll(cropId) {
    if (!(this.seeds[cropId] > 0)) return fail('No seeds left');
    const block = this.plantingBlock(cropId); if (block) return fail(block);
    let n = 0;
    for (let i = 0; i < this.plots.length && this.seeds[cropId] > 0; i++) if (this.plots[i].status === 'empty' && this.plant(i, cropId).ok) n++;
    return n ? ok({ count: n }) : fail('No empty plots');
  }
  get autoCategories() { return this.meta.autoHarvest > 0 ? AUTO_HARVEST_TIERS[this.meta.autoHarvest - 1].cats : []; }
  autoHarvestTick() {
    const cats = this.autoCategories; if (!cats.length) return 0;
    let n = 0;
    for (let i = 0; i < this.plots.length; i++) {
      const p = this.plots[i];
      if (p.status === 'ready' && p.rolled && cats.includes(getCrop(p.cropId).category) && this.harvest(i).ok) n++;
    }
    return n;
  }

  // ---------- token shop (sinks) ----------
  spendTokens(n) { if (this.tokens < n) return false; this.tokens -= n; return true; }
  autoHarvestCost() { return this.meta.autoHarvest >= AUTO_HARVEST_TIERS.length ? null : AUTO_HARVEST_TIERS[this.meta.autoHarvest].cost; }
  buyAutoHarvest() {
    const c = this.autoHarvestCost(); if (c === null) return fail('Already maxed');
    if (!this.spendTokens(c)) return fail('Not enough tokens'); this.meta.autoHarvest++; this.changed(); return ok({ level: this.meta.autoHarvest });
  }
  mutLuckCost() { return this.meta.mutLuck >= MUTLUCK_MAX ? null : mutLuckCost(this.meta.mutLuck); }
  buyMutLuck() {
    const c = this.mutLuckCost(); if (c === null) return fail('Already maxed');
    if (!this.spendTokens(c)) return fail('Not enough tokens'); this.meta.mutLuck++; this.changed(); return ok({ level: this.meta.mutLuck });
  }
  buySlot2() {
    if (this.meta.slot2) return fail('Already unlocked');
    if (!this.spendTokens(SLOT2_COST)) return fail('Not enough tokens'); this.meta.slot2 = true; this.changed(); return ok();
  }
  buyWeatherTicket() { if (!this.spendTokens(TICKET_COST)) return fail('Not enough tokens'); this.weatherTickets++; this.changed(); return ok(); }
  buyTreat() { if (!this.spendTokens(TREAT_COST)) return fail('Not enough tokens'); this.meta.treats++; this.changed(); return ok(); }
  buyBoost() {
    if (!this.spendTokens(BOOST_COST)) return fail('Not enough tokens');
    this.meta.boostUntil = Math.max(Date.now(), this.meta.boostUntil) + BOOST_MS; this.changed(); return ok();
  }
  weatherTicketCost(w) { return w.weight < 5 ? 3 : 1; }
  /** Spend weather tickets to pick the weather yourself (rare weather costs 3). */
  useWeatherTicket(id) {
    const w = WEATHER_TYPES.find((x) => x.id === id); if (!w) return fail('Unknown weather');
    const cost = this.weatherTicketCost(w); if (this.weatherTickets < cost) return fail(`Needs ${cost} weather ticket${cost > 1 ? 's' : ''}`);
    this.weatherTickets -= cost; this.changeWeather(w); this.changed(); return ok({ weather: w });
  }
  /** Legendary genetics roll: usually +1 genetics tier on a random crop, sometimes a pack of premium seeds. */
  legendaryRoll() {
    if (!this.spendTokens(LEGEND_COST)) return fail('Not enough tokens');
    const open = CROPS.filter((c) => this.geneticsTier(c.id) < GENETICS_TIERS.length);
    if (open.length && Math.random() < 0.75) {
      const c = open[Math.floor(Math.random() * open.length)]; this.cropGenetics[c.id] = this.geneticsTier(c.id) + 1;
      this.changed(); return ok({ kind: 'genetics', crop: c, tier: this.cropGenetics[c.id] });
    }
    this.grantReward({ type: 'premium_seed_pack', amount: 2 }); this.changed(); return ok({ kind: 'seeds' });
  }
  ownsCosmetic(id) { return this.meta.skins.owned.includes(id); }
  buyCosmetic(id) {
    const c = getCosmetic(id); if (!c || c.cost == null) return fail('Not for sale');
    if (this.ownsCosmetic(id)) return fail('Already owned');
    if (!this.spendTokens(c.cost)) return fail('Not enough tokens'); this.meta.skins.owned.push(id); this.meta.skins[c.slot] = id; this.changed(); return ok();
  }
  equipCosmetic(id, slot) {
    if (id) { const c = getCosmetic(id); if (!c || !this.ownsCosmetic(id)) return fail("You don't own this"); this.meta.skins[c.slot] = id; }
    else this.meta.skins[slot] = null;
    this.changed(); return ok();
  }

  // ---------- daily / weekly quests + login streak ----------
  bump(counter, n = 1) { if (!n) return; for (const q of [this.daily, this.weekly]) if (q) q.counters[counter] = (q.counters[counter] || 0) + n; }
  makeQuests(pool, count, key) {
    const rng = mulberry32(key * 7919 + 13), arr = [...pool];
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    const lvl = this.player.level;
    const list = arr.slice(0, count).map((d) => {
      let target = Math.max(1, Math.round(d.base + d.perLevel * lvl)); if (d.counter === 'soldPeso') target = Math.round(target / 50) * 50;
      return { id: d.id, counter: d.counter, target };
    });
    return { key, list, counters: {}, claimed: {}, bonusClaimed: false };
  }
  rollPeriods() {
    let changed = false;
    const dk = dayKey(), wk = weekKey(dk), sid = seasonId();
    if (!this.daily || this.daily.key !== dk) { this.daily = this.makeQuests(DAILY_POOL, DAILY_COUNT, dk); changed = true; }
    if (!this.weekly || this.weekly.key !== wk) { this.weekly = this.makeQuests(WEEKLY_POOL, WEEKLY_COUNT, wk + 1000000); changed = true; }
    if (this.season.id !== sid) {
      // New season: everyone's seasonal stats reset. Participants get a small token reward (rank-based prizes need a server).
      const prev = this.season;
      if (prev.id && prev.earned > 0) { this.tokens += 10; queueMicrotask(() => this.emit('season', prev)); }
      this.season = { id: sid, earned: 0, mutations: 0 }; changed = true;
    }
    return changed;
  }
  questDef(period, id) { return (period === 'daily' ? DAILY_POOL : WEEKLY_POOL).find((d) => d.id === id); }
  questProgress(period, q) { return Math.min(q.target, this[period]?.counters[q.counter] || 0); }
  claimQuest(period, id) {
    const set = this[period], q = set?.list.find((x) => x.id === id), def = this.questDef(period, id);
    if (!q || !def) return fail('Unknown quest');
    if (set.claimed[id]) return fail('Already claimed');
    if (this.questProgress(period, q) < q.target) return fail('Not finished yet');
    set.claimed[id] = true; this.grantReward(def.reward); this.changed(); return ok({ reward: def.reward });
  }
  questBonusReady(period) { const s = this[period]; return !!s && !s.bonusClaimed && s.list.every((q) => s.claimed[q.id]); }
  claimQuestBonus(period) {
    if (!this.questBonusReady(period)) return fail('Finish every quest first');
    const reward = period === 'daily' ? DAILY_BONUS : WEEKLY_BONUS;
    this[period].bonusClaimed = true; this.grantReward(reward); this.changed(); return ok({ reward });
  }
  get loginState() {
    const dk = dayKey(), s = this.streak, claimed = s.claimedDay === dk;
    const day = claimed ? ((s.count - 1) % 7) + 1 : s.lastDay === dk - 1 ? (s.count % 7) + 1 : 1;
    return { claimed, day, count: s.count };
  }
  claimLogin() {
    const dk = dayKey(), s = this.streak; if (s.claimedDay === dk) return fail('Already claimed today');
    s.count = s.lastDay === dk - 1 ? s.count + 1 : 1; s.lastDay = dk; s.claimedDay = dk;
    const def = LOGIN_REWARDS[(s.count - 1) % 7]; def.rewards.forEach((r) => this.grantReward(r));
    this.changed(); return ok({ day: ((s.count - 1) % 7) + 1, rewards: def.rewards });
  }
  /** Things waiting for the player (badge on the Awards tab). */
  get claimableCount() {
    let n = this.unclaimedAchievements.length + (this.loginState.claimed ? 0 : 1);
    for (const period of ['daily', 'weekly']) { const s = this[period]; if (!s) continue; n += s.list.filter((q) => !s.claimed[q.id] && this.questProgress(period, q) >= q.target).length + (this.questBonusReady(period) ? 1 : 0); }
    return n;
  }

  // ---------- cheats (ported from v1) ----------
  applyCheatCode(code) {
    const c = String(code || '').trim().toLowerCase();
    if (c === 'hesoyam') {
      this.player.peso += 9999999; this.addXP(9999999); this.changed();
      return ok({ message: '💰 +₱9,999,999 · ⭐ +9,999,999 XP' });
    }
    if (c === 'growall') {
      let n = 0;
      for (const p of this.plots) if (p.status === 'growing' && p.cropId) { p.status = 'ready'; p.harvestAt = Date.now(); n++; }
      this.changed(); return ok({ message: `🌱 ${n} crops instantly grown!` });
    }
    return fail('❌ Invalid cheat code');
  }

  setFarmName(name) {
    const n = (name || '').trim().slice(0, 24);
    if (n.length < 2) return fail('Name needs at least 2 letters');
    this.player.farmName = n; this.changed(); return ok();
  }
}

const ok = (extra = {}) => ({ ok: true, ...extra });
const fail = (error) => ({ ok: false, error });

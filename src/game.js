// Pocket Farm core logic. No DOM, no Firebase: easy to test and to move to a server later.
import { CROPS } from '../data/crops.js';
import { SPRINKLERS } from '../data/gear.js';
import { LEVELS, getLevelReward } from '../data/levels.js';
import { GENETICS_TIERS, getGeneticsCost, MASTERY_CONFIG, getMasteryCost } from '../data/genetics.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { PETS, PET_MAX_LEVEL, getPetFeedCost } from '../data/pets.js';
import { WEATHER_TYPES, SECRET_MUTATIONS, WEATHER_CHANGE_INTERVAL, MUTATION_CHANCE } from '../data/weather.js';

// Bump this number to wipe every player's progress: saves from an older epoch are ignored on login.
export const SAVE_EPOCH = 1;
export const FERTILIZER_COST = 5;
const STOCK = { starter: 5, intermediate: 3, advanced: 1, premium: 1 };
const STOCK_MS = 5 * 60 * 1000;

const emptyPlot = (id) => ({ id, status: 'empty', cropId: null, plantedAt: null, harvestAt: null, mutations: [], fertilized: false, doubleChance: 0 });
export const getCrop = (id) => CROPS.find((c) => c.id === id);
export const getPet = (id) => PETS.find((p) => p.id === id);
const CHEAT_CODES = ['hesoyam', 'growall'];
const newStats = () => ({ harvests: 0, sold: 0, earned: 0, mutations: 0, weatherChanges: 0, weatherTypes: [], cropsHarvested: {}, petsOwned: 0 });

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
    this.pets = { owned: {}, active: null };           // owned: petId -> level
    this.tokens = 0; this.weatherTickets = 0;
    this.savedAt = 0;
    this.ensurePlots();
  }

  // ---------- events ----------
  on(evt, fn) { (this.handlers[evt] ||= new Set()).add(fn); return () => this.handlers[evt].delete(fn); }
  emit(evt, data) { this.handlers[evt]?.forEach((fn) => fn(data)); }
  changed() { this.checkAchievements(); this.savedAt = Date.now(); this.emit('change'); }

  // ---------- persistence ----------
  snapshot() {
    const { player, plots, boughtPlots, seeds, inventory, gear, weather, stock, stats, savedAt, cropGenetics, cropMastery, achievements, titles, pets, tokens, weatherTickets } = this;
    return JSON.parse(JSON.stringify({ v: 2, epoch: SAVE_EPOCH, player, plots, boughtPlots, seeds, inventory, gear, weather, stock, stats, savedAt, cropGenetics, cropMastery, achievements, titles, pets, tokens, weatherTickets }));
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
    this.pets = { owned: {}, active: null, ...(d.pets || {}) };
    this.tokens = d.tokens || 0; this.weatherTickets = d.weatherTickets || 0;
    this.stats.petsOwned = Object.keys(this.pets.owned).length;
    this.savedAt = d.savedAt || 0;
    this.ensurePlots();
    this.tick();
  }
  get leaderboardProfile() {
    const p = this.player;
    return { farmName: p.farmName || 'Farm', level: p.level, xp: Math.floor(p.xp), peso: Math.floor(p.peso), score: p.level * 1e7 + Math.min(Math.floor(p.xp), 9999999) };
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
    const now = Date.now(); let dirty = false;
    for (const p of this.plots) if (p.status === 'growing' && now >= p.harvestAt) { p.status = 'ready'; dirty = true; }
    if (!this.weather || now - this.weather.since >= WEATHER_CHANGE_INTERVAL) { this.changeWeather(); dirty = true; }
    if (now >= this.stock.expiresAt) { this.refreshStock(); dirty = true; }
    if (dirty) this.changed();
    return dirty;
  }

  // ---------- weather & mutations ----------
  get currentWeather() { return WEATHER_TYPES.find((w) => w.id === this.weather?.id) || null; }
  get weatherSecondsLeft() { return this.weather ? Math.max(0, Math.ceil((this.weather.since + WEATHER_CHANGE_INTERVAL - Date.now()) / 1000)) : 0; }
  pickWeather() {
    const total = WEATHER_TYPES.reduce((s, w) => s + w.weight, 0);
    let r = Math.random() * total;
    for (const w of WEATHER_TYPES) { r -= w.weight; if (r <= 0) return w; }
    return WEATHER_TYPES[0];
  }
  mutationChance(w) {
    if (['cherry', 'fullmoon', 'aurora', 'divine'].includes(w.id)) return Math.min(0.95, MUTATION_CHANCE + 0.15 + this.petBonus('mutation') / 100);
    if (['rainbow', 'meteor', 'eclipse'].includes(w.id)) return Math.min(0.95, MUTATION_CHANCE + 0.10 + this.petBonus('mutation') / 100);
    return Math.min(0.95, MUTATION_CHANCE + this.petBonus('mutation') / 100);
  }
  changeWeather() {
    const w = this.pickWeather();
    this.weather = { id: w.id, since: Date.now() };
    this.stats.weatherChanges++; if (!this.stats.weatherTypes.includes(w.id)) this.stats.weatherTypes.push(w.id);
    const chance = this.mutationChance(w);
    for (const p of this.plots) {
      if (p.status !== 'ready' || Math.random() >= chance) continue;
      if (p.mutations.length >= 5 || p.mutations.some((m) => m.weatherId === w.id)) continue;
      p.mutations.push({ weatherId: w.id, name: w.mutation, emoji: w.mutationEmoji, priceBonus: w.priceBonus });
      const have = new Set(p.mutations.map((m) => m.weatherId));
      for (const s of SECRET_MUTATIONS) {
        if (s.requires.every((id) => have.has(id)) && !have.has(s.id))
          p.mutations.push({ weatherId: s.id, name: s.name, emoji: s.emoji, priceBonus: s.priceBonus, isSecret: true });
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
    this.changed(); return ok();
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
    if (items.some((it) => it.mutations.length)) this.stats.mutations += count;
    Object.assign(p, emptyPlot(p.id));
    const levelled = this.addXP(Math.round(c.xp * count * (1 + this.petBonus('xp') / 100)));
    this.changed(); return ok({ crop: c, items, levelled });
  }

  // ---------- selling ----------
  itemPrice(cropId, item) {
    const bonus = (item.mutations || []).reduce((s, m) => s + (m.priceBonus || 0), 0);
    const mult = this.geneticsMult(cropId) * (1 + this.masteryLevel(cropId) * MASTERY_CONFIG.weightBonus) * (1 + this.petBonus('price') / 100);
    return Math.max(1, Math.floor(getCrop(cropId).sellPrice * item.weight * mult) + bonus);
  }
  sell(cropId, mode = 'all') {
    const list = this.inventory[cropId]; if (!list?.length) return fail('Nothing to sell');
    let sold;
    if (mode === 'heaviest') { const idx = list.reduce((b, it, k) => (this.itemPrice(cropId, it) > this.itemPrice(cropId, list[b]) ? k : b), 0); sold = list.splice(idx, 1); }
    else { sold = list.splice(0, list.length); }
    if (!list.length) delete this.inventory[cropId];
    const total = sold.reduce((s, it) => s + this.itemPrice(cropId, it), 0);
    this.player.peso += total; this.stats.sold += sold.length; this.stats.earned += total;
    this.changed(); return ok({ total, count: sold.length });
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
  get activePet() { return this.pets.active ? getPet(this.pets.active) : null; }
  /** Total % bonus of one type from the active pet (0 if none). */
  petBonus(type) { const p = this.activePet; return p && p.bonus === type ? p.perLevel * this.petLevel(p.id) : 0; }
  adoptPet(id) {
    const p = getPet(id); if (!p) return fail('Unknown pet');
    if (this.petLevel(id)) return fail('You already have this pet');
    if (this.player.level < p.unlockLevel) return fail(`Unlocks at level ${p.unlockLevel}`);
    if (this.player.peso < p.cost) return fail('Not enough ₱');
    this.player.peso -= p.cost; this.pets.owned[id] = 1; if (!this.pets.active) this.pets.active = id;
    this.stats.petsOwned = Object.keys(this.pets.owned).length; this.changed(); return ok();
  }
  feedPet(id) {
    const p = getPet(id), lvl = this.petLevel(id); if (!p || !lvl) return fail("You don't own this pet");
    if (lvl >= PET_MAX_LEVEL) return fail('Max level');
    const cost = getPetFeedCost(p, lvl); if (this.player.peso < cost) return fail('Not enough ₱');
    this.player.peso -= cost; this.pets.owned[id] = lvl + 1; this.changed(); return ok({ level: lvl + 1 });
  }
  setActivePet(id) {
    if (id && !this.petLevel(id)) return fail("You don't own this pet");
    this.pets.active = id || null; this.changed(); return ok();
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
    }
  }
  setActiveTitle(id) {
    if (id && !this.titles.owned.includes(id)) return fail("You don't own this title");
    this.titles.active = id || null; this.changed(); return ok();
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

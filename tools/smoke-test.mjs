// Quick logic test: node tools/smoke-test.mjs
import assert from 'node:assert/strict';
import { Game, SAVE_EPOCH, getCrop } from '../src/game.js';
const g = new Game(); g.refreshStock(); g.tick();
assert.equal(g.plots.length, 4);
assert.ok(g.currentWeather, 'weather set');
// plant -> grow -> harvest -> sell
assert.ok(g.plant(0, 'kangkong').ok); assert.equal(g.seeds.kangkong, 2);
assert.equal(g.plant(0, 'kangkong').ok, false, 'occupied');
g.plots[0].harvestAt = Date.now() - 1; g.tick(); assert.equal(g.plots[0].status, 'ready');
const h = g.harvest(0); assert.ok(h.ok); assert.ok(h.items[0].weight >= 0.2);
assert.ok(g.player.xp > 0);
const before = g.player.peso, s = g.sell('kangkong'); assert.ok(s.ok); assert.equal(g.player.peso, before + s.total);
// shop
g.player.peso = 1000; g.stock.seeds.kamatis = 3;
assert.equal(g.buySeed('kamatis').ok, false, 'locked below level 8');
assert.ok(g.buySeed('kangkong', 2).ok); assert.ok(g.buyFertilizer().ok); assert.ok(g.buySprinkler(1).ok);
g.plant(1, 'pechay'); assert.ok(g.fertilize(1).ok); const t0 = g.plots[1].harvestAt; assert.ok(g.sprinkle(1, 1).ok); assert.ok(g.plots[1].harvestAt < t0);
// level up grants plots + seeds
g.addXP(5000); assert.ok(g.player.level > 5); assert.equal(g.plots.length, g.plotCount);
// snapshot round-trip
const g2 = new Game(); g2.load(JSON.parse(JSON.stringify(g.snapshot()))); assert.equal(g2.player.level, g.player.level);
assert.equal(g.snapshot().epoch, SAVE_EPOCH);
console.log('all game logic tests passed ✅ (level', g.player.level + ', plots', g.plots.length + ')');

// ---- v2.1: genetics, mastery, pets, achievements, cheats ----
{
  const g = new Game(); g.refreshStock(); g.tick(); g.player.peso = 1e9;
  const item = { weight: 1, mutations: [] }, base = g.itemPrice('kangkong', item);
  assert.ok(g.upgradeGenetics('kangkong').ok); assert.equal(g.geneticsTier('kangkong'), 1);
  assert.ok(g.itemPrice('kangkong', item) > base, 'genetics raises price');
  for (let i = 0; i < 5; i++) g.upgradeGenetics('kangkong'); assert.equal(g.upgradeGenetics('kangkong').ok, false, 'max tier');
  const b2 = g.itemPrice('pechay', item); assert.ok(g.upgradeMastery('pechay').ok); assert.ok(g.itemPrice('pechay', item) >= b2);
  // pets
  assert.equal(g.adoptPet('dragon').ok, false, 'dragon locked by level');
  assert.ok(g.adoptPet('aso').ok); assert.equal(g.pets.active, 'aso'); assert.equal(g.adoptPet('aso').ok, false);
  const gt = g.petBonus('growth'); assert.ok(gt > 0); assert.ok(g.feedPet('aso').ok); assert.ok(g.petBonus('growth') > gt);
  g.plant(0, 'kangkong'); const dur = g.plots[0].harvestAt - g.plots[0].plantedAt; assert.ok(dur < getCrop('kangkong').growTime * 1000, 'pet speeds growth');
  assert.ok(g.setActivePet(null).ok); assert.equal(g.petBonus('growth'), 0);
  // achievements
  g.stats.harvests = 100; g.checkAchievements(); assert.ok(g.achievements.beginner_farmer);
  const peso = g.player.peso; assert.ok(g.claimAllAchievements().ok); assert.ok(g.player.peso > peso); assert.equal(g.claimAchievement('beginner_farmer').ok, false, 'no double claim');
  g.stats.harvests = 100000; g.checkAchievements(); g.claimAchievement('pocket_legend'); assert.ok(g.titles.owned.includes('pocket_legend')); assert.ok(g.setActiveTitle('pocket_legend').ok);
  // cheats
  const h = new Game(); h.refreshStock(); h.tick(); h.plant(0, 'kangkong');
  assert.ok(h.applyCheatCode('GrowAll').ok); assert.equal(h.plots[0].status, 'ready');
  assert.ok(h.applyCheatCode('hesoyam').ok); assert.ok(h.player.peso > 9e6); assert.equal(h.applyCheatCode('nope').ok, false);
  // save round trip keeps everything; an OLD v2 save (no new fields) still loads
  const g3 = new Game(); g3.load(JSON.parse(JSON.stringify(g.snapshot())));
  assert.equal(g3.geneticsTier('kangkong'), 5); assert.ok(g3.pets.owned.aso >= 2); assert.ok(g3.titles.owned.length);
  const legacy = JSON.parse(JSON.stringify(new Game().snapshot())); for (const k of ['cropGenetics', 'cropMastery', 'achievements', 'titles', 'pets', 'tokens']) delete legacy[k]; legacy.stats = { harvests: 3, sold: 1, earned: 10 };
  const g4 = new Game(); g4.load(legacy); assert.equal(g4.stats.harvests, 3); assert.deepEqual(g4.pets.owned, {});
  console.log('v2.1 tests passed ✅ (genetics, mastery, pets, achievements, titles, cheats, legacy saves)');
}

// ---- v2.2: token shop, quests, login streak, QoL, events, pets, season ----
{
  const { getEvent, EVENTS, EVENT_MS } = await import('../data/events.js');
  const fresh = () => { const g = new Game(); g.refreshStock(); g.tick(); return g; };
  // events rotate weekly and cover every event
  const seen = new Set(); for (let i = 0; i < EVENTS.length; i++) seen.add(getEvent(Date.UTC(2026, 0, 5) + i * EVENT_MS + 1000).id); assert.equal(seen.size, EVENTS.length);

  // token shop
  let g = fresh(); assert.equal(g.buyMutLuck().ok, false, 'needs tokens'); g.tokens = 1000;
  assert.ok(g.buyAutoHarvest().ok); assert.deepEqual(g.autoCategories, ['starter']);
  assert.ok(g.buyMutLuck().ok); assert.equal(g.mutLuckPct(), 2);
  assert.ok(g.buySlot2().ok); assert.equal(g.buySlot2().ok, false);
  assert.ok(g.buyWeatherTicket().ok); assert.ok(g.buyTreat().ok); assert.ok(g.buyBoost().ok); assert.ok(g.boostActive);
  assert.ok(g.buyCosmetic('plot_sakura').ok); assert.equal(g.meta.skins.plot, 'plot_sakura'); assert.equal(g.buyCosmetic('weekly_frame').ok, false);
  const r = g.legendaryRoll(); assert.ok(r.ok);
  // weather tickets: common costs 1, rare costs 3
  g.weatherTickets = 1; assert.ok(g.useWeatherTicket('rain').ok); assert.equal(g.currentWeather.id, 'rain'); assert.equal(g.useWeatherTicket('divine').ok, false);

  // boost raises price + xp
  const g0 = fresh(), item = { weight: 1, mutations: [] }, base = g0.itemPrice('kangkong', item); g0.meta.boostUntil = Date.now() + 1e5;
  assert.ok(g0.itemPrice('kangkong', item) >= base); assert.equal(g0.xpMult() >= 2, true);

  // auto-harvester: only collects crops that had a mutation roll, and only its categories
  g = fresh(); g.tokens = 500; g.buyAutoHarvest(); g.seeds = { kangkong: 5, kamatis: 5 }; g.plant(0, 'kangkong'); g.plots[0].harvestAt = Date.now() - 1; g.tick();
  assert.equal(g.plots[0].status, 'ready', 'not auto-harvested before its first mutation roll');
  g.changeWeather(); g.tick(); assert.equal(g.plots[0].status, 'empty', 'auto-harvested after a roll'); assert.ok(g.inventory.kangkong?.length);

  // harvest all / plant all / bulk sell filters
  g = fresh(); g.seeds = { kangkong: 3 }; assert.equal(g.plantAll('kangkong').count, 3);
  g.plots.slice(0, 3).forEach((p) => { p.harvestAt = Date.now() - 1; }); g.tick(); assert.equal(g.readyCount, 3);
  assert.equal(g.harvestAll().count, 3); assert.equal(g.harvestAll().ok, false);
  g.inventory = { kangkong: [{ weight: 1, mutations: [] }, { weight: 1, mutations: [{ weatherId: 'rain', name: 'Waterlogged', emoji: '💧', priceBonus: 15 }] }] };
  assert.ok(g.sellFilter({ mutated: false }).ok); assert.equal(g.inventory.kangkong.length, 1, 'mutated crop kept'); assert.equal(g.sellFilter({ category: 'premium' }).ok, false);
  assert.ok(g.sellFilter({ mutated: true }).ok); assert.equal(g.inventory.kangkong, undefined);
  assert.ok(g.stats.bestSale > 0 && g.season.earned > 0);

  // quests + counters + bonus
  g = fresh(); assert.equal(g.daily.list.length, 3); assert.equal(g.weekly.list.length, 3);
  const dq = g.daily.list[0]; g.bump(dq.counter, dq.target); assert.ok(g.claimQuest('daily', dq.id).ok); assert.equal(g.claimQuest('daily', dq.id).ok, false, 'no double claim');
  assert.equal(g.claimQuest('daily', g.daily.list[1].id).ok, false, 'unfinished');
  for (const q of g.daily.list) { g.bump(q.counter, q.target); g.claimQuest('daily', q.id); } assert.ok(g.claimQuestBonus('daily').ok); assert.equal(g.claimQuestBonus('daily').ok, false);
  for (const q of g.weekly.list) { g.bump(q.counter, q.target); g.claimQuest('weekly', q.id); } assert.ok(g.claimQuestBonus('weekly').ok); assert.ok(g.ownsCosmetic('weekly_frame'));
  const g5 = new Game(); g5.load(JSON.parse(JSON.stringify(g.snapshot()))); assert.equal(g5.daily.key, g.daily.key); assert.ok(g5.daily.bonusClaimed, 'quest state survives a save');

  // login streak: day 1, no double claim, consecutive days continue, a gap resets
  g = fresh(); assert.equal(g.loginState.day, 1); assert.ok(g.claimLogin().ok); assert.equal(g.claimLogin().ok, false);
  const t = g.streak.claimedDay; g.streak.claimedDay = t - 1; g.streak.lastDay = t - 1; assert.equal(g.loginState.day, 2); assert.ok(g.claimLogin().ok); assert.equal(g.streak.count, 2);
  g.streak.claimedDay = t - 5; g.streak.lastDay = t - 5; assert.ok(g.claimLogin().ok); assert.equal(g.streak.count, 1, 'gap resets the streak');
  g.streak.count = 7; g.streak.lastDay = g.streak.claimedDay - 1; g.streak.claimedDay = -1; assert.ok(g.claimLogin().ok); assert.equal(g.streak.count, 8);

  // pets: 2 slots + synergy, treats, evolution, event-only pet
  g = fresh(); g.player.peso = 1e9; g.player.level = 40; g.adoptPet('aso'); g.adoptPet('pusa');
  assert.equal(g.setPetSlot2('pusa').ok, false, 'slot 2 locked'); g.tokens = 500; g.buySlot2(); assert.ok(g.setPetSlot2('pusa').ok); assert.equal(g.activePets.length, 2);
  const single = g.petBonus('growth'); assert.ok(single > 0 && g.petBonus('price') > 0);
  g.pets.active2 = null; const solo = g.petBonus('growth'); g.pets.active2 = 'pusa'; assert.ok(single > solo, 'synergy bonus');
  g.buyTreat(); assert.ok(g.treatPet('aso').ok); assert.equal(g.pets.owned.aso, 2);
  g.pets.owned.aso = 10; assert.equal(g.evolvePet('aso').ok, false, 'needs treats'); g.meta.treats = 3; assert.ok(g.evolvePet('aso').ok); assert.ok(g.pets.evolved.aso);
  const ev = getEvent().id; assert.equal(g.adoptPet('sarimanok').ok, ev === 'parade');
  // season rolls over and pays participants
  g = fresh(); g.season = { id: '1999-01', earned: 500, mutations: 2 }; const tk = g.tokens; g.tick(); assert.ok(g.tokens > tk); assert.equal(g.season.earned, 0);
  // legacy save without any v2.2 field still loads
  const old = JSON.parse(JSON.stringify(fresh().snapshot())); for (const k of ['meta', 'daily', 'weekly', 'streak', 'season']) delete old[k];
  const g6 = new Game(); g6.load(old); assert.equal(g6.meta.autoHarvest, 0); assert.ok(g6.daily && g6.weekly);
  const prof = fresh().leaderboardProfile; for (const k of ['score', 'mutations', 'harvests', 'bestSale', 'seasonEarned']) assert.ok(Number.isInteger(prof[k]), k);
  console.log('v2.2 tests passed ✅ (token shop, auto-harvest, bulk sell, quests, login streak, events, pets, seasons)');
}

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

// Headless checks for the God Lab simulation. Run: node god-lab/tests/sim.test.js
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'sim.js'), 'utf8');
const S = new Function(src + '; return { createWorld, seedLife, stepWorld, GOD, TPY, G, spById, snapshot, restore, PRESETS, genesFrom, spawnSpecies, B, tileAt, tileTemp, MAX_CREATURES };')();

let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails++; };
const run = (w, grid, years) => { for (let k = 0; k < years * S.TPY; k++) S.stepWorld(w, grid); };
const landPoint = w => { for (let k = 0; k < 5000; k++) { const x = 10 + Math.random() * (w.W - 20), y = 10 + Math.random() * (w.H - 20), b = w.biome[S.tileAt(w, x, y)]; if (b === S.B.GRASS || b === S.B.FOREST) return [x, y]; } return [w.W / 2, w.H / 2]; };

// 1. A seeded world stays alive and within bounds for 15 years
{
  const w = S.createWorld({ seed: 7 }), grid = {};
  S.seedLife(w);
  const t0 = Date.now(); run(w, grid, 15); const ms = (Date.now() - t0) / (15 * S.TPY);
  const living = w.species.filter(s => !s.extinct && s.pop > 0).length;
  ok(w.creatures.length > 150 && w.creatures.length <= S.MAX_CREATURES, `population after 15 years: ${w.creatures.length}`);
  ok(living >= 3, `${living} species alive after 15 years`);
  ok(ms < 3, `speed: ${ms.toFixed(2)} ms per tick`);
  ok(w.species.length > 11, `evolution produced new species (${w.species.length - 11} so far)`);
}
// 2. Natural selection: on a frozen world, the population living in the cold evolves thicker fur
{
  const w = S.createWorld({ seed: 11, type: 'frozen' }), grid = {};
  const p = landPoint(w);
  S.spawnSpecies(w, S.genesFrom(w, { ...S.PRESETS.grazer, fur: .3, fert: .8 }, .3), p[0], p[1], 60, { quiet: true });
  run(w, grid, 25);
  const cold = w.creatures.filter(c => c.g[S.G.aquatic] < .5 && S.tileTemp(w, S.tileAt(w, c.x, c.y)) < .3);
  const warm = w.creatures.filter(c => c.g[S.G.aquatic] < .5 && S.tileTemp(w, S.tileAt(w, c.x, c.y)) > .45);
  const mean = a => a.reduce((t, c) => t + c.g[S.G.fur], 0) / Math.max(1, a.length);
  ok(cold.length > 5 && mean(cold) > .33 && mean(cold) > mean(warm) + .03, `local adaptation: fur ${mean(cold).toFixed(2)} in the cold vs ${mean(warm).toFixed(2)} in the warm (started at 0.30)`);
}
// 3. God powers do what they say
{
  const w = S.createWorld({ seed: 3 }), grid = {};
  S.seedLife(w); run(w, grid, 1);
  const n0 = w.creatures.length, c0 = w.creatures[10];
  S.GOD.meteor(w, c0.x, c0.y, 1.2); run(w, grid, .2);
  ok(w.stats.byCause.meteor > 5, `meteor killed ${w.stats.byCause.meteor} creatures and left a crater`);
  ok(w.climate.dust > .3, `meteor raised dust (${w.climate.dust.toFixed(2)}), cooling the world`);
  const top = w.species.filter(s => !s.extinct).sort((a, b) => b.pop - a.pop)[0];
  const target = w.creatures.find(c => c.sp === top.id);
  const strain = S.GOD.plague(w, target.x, target.y, { lethal: .006, trans: .12 });
  run(w, grid, .5);
  ok(strain && strain.cases > 5, `plague spread to ${strain ? strain.cases : 0} creatures`);
  const victim = w.creatures.find(c => !c.inf);
  const spId = victim.sp; S.GOD.eraseSpecies(w, spId); run(w, grid, .2);
  ok(!w.creatures.some(c => c.sp === spId), 'erase species removed every member');
  const hero = w.creatures[0]; S.GOD.bless(w, hero, 'giant');
  ok(hero.mass > 1 && hero.name, `blessed ${hero.name} became a giant (mass ${hero.mass.toFixed(2)})`);
  const lp = landPoint(w); S.GOD.volcano(w, lp[0], lp[1]); run(w, grid, .3);
  ok(w.lava.some(v => v > 0), 'volcano is pouring lava');
  S.GOD.deluge(w); run(w, grid, 1.5);
  ok(w.climate.sea > .05, `deluge raised the sea by ${w.climate.sea.toFixed(3)}`);
}
// 4. Intelligence: the gift of fire leads to tribes and villages
{
  const w = S.createWorld({ seed: 5 }), grid = {};
  const p = landPoint(w);
  const sp = S.spawnSpecies(w, S.genesFrom(w, { ...S.PRESETS.omnivore, fert: .7, herd: .8 }, .6), p[0], p[1], 40, { quiet: true });
  run(w, grid, 1);
  S.GOD.fireGift(w, sp.id);
  run(w, grid, 8);
  const tribes = w.tribes.filter(t => !t.gone);
  ok(tribes.length > 0, `gift of fire: ${tribes.length} tribes founded`);
  ok(tribes.some(t => t.stage >= 1), `a tribe grew into a village (stages: ${tribes.map(t => t.stage).join(',')})`);
}
// 5. Messengers spread commandments; snapshots rewind time
{
  const w = S.createWorld({ seed: 9 }), grid = {};
  S.seedLife(w); run(w, grid, 1);
  const big = w.species.filter(s => !s.extinct && s.mean[S.G.aquatic] < .5).sort((a, b) => b.pop - a.pop)[0];
  const c = w.creatures.find(x => x.sp === big.id);
  S.GOD.messenger(w, c.x, c.y, c.sp, { type: 'migrate', x: c.x + 20, y: c.y });
  run(w, grid, 1);
  const believers = w.creatures.filter(x => x.belief).length;
  ok(believers > 3, `messenger converted ${believers} creatures`);
  const snap = S.snapshot(w); const tick = w.tick, n = w.creatures.length;
  run(w, grid, 1);
  const back = S.restore(snap);
  ok(back.tick === tick && back.creatures.length === n, 'rewind restores the exact moment');
  run(back, {}, .2);
  ok(back.tick > tick, 'a restored world keeps running');
}
if (fails) { console.log(`\n${fails} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');

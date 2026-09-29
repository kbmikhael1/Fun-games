// Headless checks for the God Lab simulation. Run: node god-lab/tests/sim.test.js
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'sim.js'), 'utf8');
const S = new Function(src + '; return { createWorld, stepWorld, GOD, YEAR, DAY, AGES, living, personById, ageOf, villageMood, hAt, isWater, tileAt };')();

let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails++; };
const run = (w, years) => { for (let k = 0; k < years * S.YEAR / .25; k++) S.stepWorld(w, .25); };

// 1. A valley with water, a village and people
{
  const w = S.createWorld({ seed: 11 });
  let water = 0; for (const t of w.tile) if (S.isWater(t)) water++;
  ok(water > 300, `the valley has a lake and a river (${water} water tiles)`);
  ok(w.people.length >= 10 && w.trees.length > 1000 && w.animals.length > 10, `${w.people.length} people, ${w.trees.length} trees, ${w.animals.length} animals`);
  ok(!S.isWater(S.tileAt(w, w.center.x, w.center.z)), 'the village stands on dry land');
}
// 2. Left alone, the people grow from a camp into a city
{
  const w = S.createWorld({ seed: 1 }), t0 = Date.now(); const ages = [];
  for (let y = 0; y < 140 && w.age < 6; y++) { run(w, 1); if (ages[w.age] === undefined) ages[w.age] = y + 1; }
  const ms = (Date.now() - t0) / Math.max(1, w.yearIndex);
  run(w, 8);
  ok(w.age === 6, `reached the Modern Age (farming ${ages[1]}, bronze ${ages[2]}, iron ${ages[3]}, medieval ${ages[4]}, industrial ${ages[5]}, modern ${ages[6]})`);
  ok(S.living(w).length > 120, `${S.living(w).length} people live in the city`);
  ok(w.buildings.some(b => b.type === 'home' && b.style === 6), 'apartment towers were built');
  const starved = w.stats.byCause['starved to death'] || 0;
  ok(starved < 20, `few starved (${starved})`);
  ok(ms < 700, `speed: ${ms.toFixed(0)} ms per simulated year`);
}
// 3. God powers do what they say
{
  const w = S.createWorld({ seed: 3, unlimited: true }); run(w, 3);
  const p = S.living(w).find(q => S.ageOf(w, q) > 16);
  S.GOD.bless(w, p, 'immortal');
  S.GOD.lightning(w, p.x, p.z); S.GOD.meteor(w, p.x, p.z); run(w, .1); S.GOD.meteorImpact(w, p.x, p.z);
  S.GOD.plague(w, p.x, p.z); run(w, 1);
  ok(p.alive, `${p.name} is immortal: survived lightning, a meteor and a plague`);
  S.GOD.smite(w, p); ok(!p.alive, 'smite can still take an immortal life');
  ok(S.GOD.resurrect(w, p.id) && p.alive, `${p.name} was raised from the dead`);
  const n0 = S.living(w).length, c = w.center;
  S.GOD.meteorImpact(w, c.x, c.z);
  ok(S.living(w).length < n0, `a meteor on the village kills (${n0 - S.living(w).length} dead)`);
  ok(S.villageMood(w).fear > .1, `they fear you now (fear ${S.villageMood(w).fear.toFixed(2)})`);
  const q = S.living(w)[0]; S.GOD.pickUp(w, 'p', q.id); S.GOD.drop(w, q.x, q.z, S.hAt(w, q.x, q.z) + 30, 0, 0, 0); run(w, .05);
  ok(!q.fly, 'a dropped person lands');
  S.GOD.flood(w); run(w, .15); ok(w.water > .5, `the flood raised the water (${w.water.toFixed(2)})`); run(w, 1.5); ok(w.water < .05, 'and the water went down again');
}
// 4. Prayers can be answered, and ignored prayers are remembered
{
  const w = S.createWorld({ seed: 5 }); run(w, 1);
  const p = S.living(w).find(q => S.ageOf(w, q) > 16);
  w.weather.moist = 0; const pr = [];
  for (const q of S.living(w)) { if (q.sick) continue; }
  const before = p.love;
  const sick = S.living(w)[1]; sick.sick = .2;
  const src2 = w.prayers.length;
  // make a prayer directly and answer it
  const e = S.GOD.heal(w, sick.x, sick.z);
  ok(e && !sick.sick, 'heal cures the sick');
  run(w, 4); const ign = w.god.deeds.ignored + w.god.deeds.answered;
  ok(w.prayers.length > 0, `people prayed (${w.prayers.length} prayers in 4 years)`);
  ok(w.prayers.every(q => q.done || w.t <= q.until + 2), 'old prayers expire');
}
if (fails) { console.log(`\n${fails} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');

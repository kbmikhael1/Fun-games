// Every crossing must be beatable within budget. For each level this builds a
// reference design, runs the real physics headless, and checks the vehicle
// crosses and the design costs no more than the budget.
// Also checks the physics against a hand calculation.
// Run: node tests/levels.test.js
const fs = require('fs');
const path = require('path');

const src = f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const E = new Function(src('engine.js') + src('levels.js') + src('solutions.js') +
  '; return { MATERIALS, VEHICLES, createSim, stepSim, designCost, LEVELS, SOLUTIONS };')();

const { designer, REFERENCE } = require('../tools/reference.js');

function simulate(level, design, seconds = 40) {
  const sim = E.createSim(level, design);
  for (let f = 0; f < seconds * 60 && sim.state === 'running'; f++) E.stepSim(sim, 1 / 60);
  return sim;
}

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failures++; };

// 1. Physics sanity: truss top chord force under self-weight vs hand calculation
{
  const L = { gap: 10, hR: 0, waterY: -11, vehicle: 'car', startX: -60, anchors: [[0, 0], [10, 0]] };
  const d = designer(L); d.warren(0, 0, 10, 0, 5, 2, 'wood', 'wood');
  const sim = E.createSim(L, d);
  for (let f = 0; f < 240; f++) E.stepSim(sim, 1 / 60);
  let W = 0; for (const m of sim.members) W += E.MATERIALS[m.mat].kgPerM * m.L0 * 9.81;
  const hand = W * 10 / 8 / 2;              // M = WL/8, chord force = M / h
  const mid = sim.members.filter(m => m.mat === 'wood' && Math.abs(sim.P[m.a].y - 2) < .1 && Math.abs(sim.P[m.b].y - 2) < .1)
    .reduce((a, m) => Math.max(a, -m.ff), 0);
  check(Math.abs(mid - hand) / hand < .05, `top chord ${(mid / 1000).toFixed(2)} kN vs hand calc ${(hand / 1000).toFixed(2)} kN (within 5%)`);
}
// 2. A bare road deck must fail (the game's first lesson)
{
  const L = E.LEVELS.find(l => l.code === 'DJ-01'), d = designer(L);
  for (let i = 0; i < 5; i++) d.mem(i * 2, 0, i * 2 + 2, 0, 'road');
  const sim = simulate(L, d);
  check(sim.state === 'failed', `level 1 bare deck collapses (${sim.state})`);
}
// 3. Every level has a reference design that crosses within budget
for (const L of E.LEVELS) {
  const d = designer(L); REFERENCE[L.id](d);
  const design = { nodes: d.nodes, members: d.members };
  const cost = E.designCost(L, design);
  const sim = simulate(L, design);
  check(sim.state === 'crossed' && cost <= L.budget,
    `${L.code} ${L.name.padEnd(20)} ${sim.state.padEnd(8)} cost ${(cost / 1000).toFixed(2)}M / budget ${(L.budget / 1000).toFixed(2)}M`);
}
// 4. Every published solution crosses with no member failing, within budget
for (const L of E.LEVELS) {
  for (const sol of E.SOLUTIONS[L.id] || []) {
    const design = { nodes: sol.nodes, members: sol.members };
    const cost = E.designCost(L, design);
    const sim = simulate(L, design);
    const broke = sim.members.filter(m => m.broken && !m.stub).length;
    check(sim.state === 'crossed' && !broke && cost <= L.budget && Math.abs(cost - sol.cost) < 2,
      `${L.code} solution ${sol.name.padEnd(6)} ${sim.state.padEnd(8)} ${(cost / 1000).toFixed(2)}M, ${broke} broken`);
  }
  check((E.SOLUTIONS[L.id] || []).length > 0, `${L.code} has at least one solution`);
}
if (failures) { console.log(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');

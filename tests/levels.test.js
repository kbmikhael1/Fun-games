// Every crossing must be beatable within budget. For each level this builds a
// reference design, runs the real physics headless, and checks the vehicle
// crosses and the design costs no more than the budget.
// Also checks the physics against a hand calculation.
// Run: node tests/levels.test.js
const fs = require('fs');
const path = require('path');

const src = f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const E = new Function(src('engine.js') + src('levels.js') +
  '; return { MATERIALS, VEHICLES, createSim, stepSim, designCost, LEVELS };')();

function designer(level) {
  const nodes = [], members = [], A = level.anchors;
  const key = (x, y) => {
    const i = A.findIndex(a => Math.abs(a[0] - x) < 1e-6 && Math.abs(a[1] - y) < 1e-6);
    if (i >= 0) return i;
    let k = nodes.findIndex(n => Math.abs(n[0] - x) < 1e-6 && Math.abs(n[1] - y) < 1e-6);
    if (k < 0) { nodes.push([x, y]); k = nodes.length - 1; }
    return A.length + k;
  };
  const mem = (x1, y1, x2, y2, mat) => members.push([key(x1, y1), key(x2, y2), mat]);
  // Warren truss from (x0,y0) to (x1,y1): n panels, height H (negative = under the deck).
  // web(i, n) picks the web material per panel; lowL/lowR tie the end bottom joints to anchors.
  const warren = (x0, y0, x1, y1, n, H, chord, web, lowL, lowR) => {
    const dx = (x1 - x0) / n, dy = (y1 - y0) / n;
    for (let i = 0; i < n; i++) {
      const ax = x0 + dx * i, ay = y0 + dy * i, bx = ax + dx, by = ay + dy, tx = ax + dx / 2, ty = ay + dy / 2 + H;
      const w = typeof web === 'function' ? web(i, n) : web;
      mem(ax, ay, bx, by, 'road'); mem(ax, ay, tx, ty, w); mem(tx, ty, bx, by, w);
      if (i < n - 1) mem(tx, ty, tx + dx, ty + dy, chord);
    }
    if (lowL) mem(x0 + dx / 2, y0 + dy / 2 + H, lowL[0], lowL[1], 'steel');
    if (lowR) mem(x1 - dx / 2, y1 - dy / 2 + H, lowR[0], lowR[1], 'steel');
  };
  return { nodes, members, mem, warren };
}
const edge = k => (i, n) => (i < k || i >= n - k ? 'steel' : 'wood');

const REFERENCE = {
  1: d => d.warren(0, 0, 10, 0, 5, -2, 'wood', 'wood'),
  2: d => d.warren(0, 0, 14, 0, 7, -2, 'wood', 'wood'),
  3: d => { d.warren(0, 0, 10, 0, 5, -2, 'wood', edge(1)); d.warren(10, 0, 20, 0, 5, -2, 'wood', edge(1)); d.mem(10, 0, 10, -3.5, 'steel'); },
  4: d => d.warren(0, 0, 16, 2, 8, -2, 'wood', 'wood', [0, -3], [16, -1]),
  5: d => { d.warren(0, 0, 22, 0, 11, -1.5, 'wood', 'wood'); for (const x of [4, 8]) d.mem(-2.6, 8, x, 0, 'cable'); for (const x of [14, 18]) d.mem(24.6, 8, x, 0, 'cable'); },
  6: d => { d.warren(0, 0, 9.5, 0, 5, -2, 'wood', edge(1), [0, -3.5], [9.5, -4]); d.warren(9.5, 0, 18.5, 0, 5, -2, 'wood', edge(1), [9.5, -4], [18.5, -4]); d.warren(18.5, 0, 28, 0, 5, -2, 'wood', edge(1), [18.5, -4], [28, -3.5]); },
  7: d => { d.warren(0, 0, 30, 0, 15, 3, 'steel', 'steel'); for (const x of [5, 9, 13]) d.mem(-3, 9, x, 3, 'cable'); for (const x of [17, 21, 25]) d.mem(33, 9, x, 3, 'cable'); },
  8: d => { d.warren(0, 0, 13.5, 0, 7, -2.5, 'steel', 'steel', [0, -4], [13.5, -4.5]); d.warren(13.5, 0, 26.5, 0, 7, -2.5, 'steel', 'steel', [13.5, -4.5], [26.5, -4.5]); d.warren(26.5, 0, 40, 0, 7, -2.5, 'steel', 'steel', [26.5, -4.5], [40, -4]); },
};

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
  const L = E.LEVELS[0], d = designer(L);
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
if (failures) { console.log(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');

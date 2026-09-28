// Search for good bridges for every level with the real game physics, then
// write src/solutions.js with two designs per level:
//   Sturdy: cheapest design found whose peak stress stays <= 65%
//   Lean:   cheapest design found whose peak stress stays <= 90% (the margin
//           keeps it passing even if browsers round floating point differently)
// These are the best found by the search, not proven optima.
// Usage: node tools/solve.js [levelId ...]
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = f => fs.readFileSync(path.join(root, 'src', f), 'utf8');
const E = new Function(src('engine.js') + src('levels.js') +
  '; return { MATERIALS, VEHICLES, createSim, stepSim, designCost, LEVELS };')();

const { designer, REFERENCE } = require('./reference.js');
const LEAN_MAX = 0.90, STURDY_MAX = 0.65;

// ---------------------------------------------------------------- evaluation
// Runs until the vehicle crosses, anything breaks, or the vehicle fails.
function evaluate(level, design) {
  const sim = E.createSim(level, design);
  for (let f = 0; f < 60 * 40; f++) {
    const ev = E.stepSim(sim, 1 / 60);
    if (ev.some(e => e.type === 'break')) return { ok: false, peak: 9 };
    if (sim.state !== 'running') break;
  }
  let peak = 0;
  for (const m of sim.members) if (!m.stub) peak = Math.max(peak, m.peak);
  return { ok: sim.state === 'crossed', peak };
}
const cost = (level, d) => E.designCost(level, d);
const clone = d => ({ nodes: d.nodes.map(n => n.slice()), members: d.members.map(m => m.slice()) });

// ---------------------------------------------------------------- design builder
function builder(level) {
  const A = level.anchors, nodes = [], members = [];
  const r = v => Math.round(v * 1000) / 1000;
  const key = (x, y) => {
    x = r(x); y = r(y);
    const i = A.findIndex(a => Math.abs(a[0] - x) < 1e-6 && Math.abs(a[1] - y) < 1e-6);
    if (i >= 0) return i;
    let k = nodes.findIndex(n => Math.abs(n[0] - x) < 1e-6 && Math.abs(n[1] - y) < 1e-6);
    if (k < 0) { nodes.push([x, y]); k = nodes.length - 1; }
    return A.length + k;
  };
  const pos = i => (i < A.length ? A[i] : nodes[i - A.length]);
  const len = (i, j) => Math.hypot(pos(i)[0] - pos(j)[0], pos(i)[1] - pos(j)[1]);
  const mem = (i, j, mat) => {
    if (i === j) return;
    if (members.some(m => (m[0] === i && m[1] === j) || (m[0] === j && m[1] === i))) return;
    const L = len(i, j); if (L < 0.45) return;
    if (L > E.MATERIALS[mat].maxLen + 1e-6) {
      if (mat === 'wood' && L <= E.MATERIALS.steel.maxLen + 1e-6) mat = 'steel';
      else return;
    }
    members.push([i, j, mat]);
  };
  return { A, nodes, members, key, pos, len, mem };
}

// Candidate topology: trusses on each span between supports, optional ties to
// lower anchors, posts on piers, cables from towers.
function candidate(level, o) {
  const b = builder(level);
  const hR = level.hR || 0;
  const deckY = x => hR * x / level.gap;
  const piers = (level.pillars || []).map(p => p.x);
  const cuts = [0, ...piers, level.gap];
  const deckNodes = [], chordNodes = [];
  for (let s = 0; s < cuts.length - 1; s++) {
    const x0 = cuts[s], x1 = cuts[s + 1], span = x1 - x0;
    const n = Math.max(2, Math.ceil(span / o.panel - 1e-9));
    const dx = span / n;
    for (let i = 0; i < n; i++) {
      const ax = x0 + dx * i, bx = ax + dx;
      const a = b.key(ax, deckY(ax)), c = b.key(bx, deckY(bx));
      b.mem(a, c, 'road');
      deckNodes.push(a, c);
      const tx = ax + dx / 2, t = b.key(tx, deckY(tx) + o.h);
      chordNodes.push(t);
      b.mem(a, t, 'steel'); b.mem(t, c, 'steel');
      if (i < n - 1) b.mem(t, b.key(tx + dx, deckY(tx + dx) + o.h), 'steel');
      if (o.verticals && i > 0) b.mem(a, b.key(ax, deckY(ax) + o.h), 'steel');
    }
  }
  const joints = [...new Set(deckNodes.concat(chordNodes))];
  // ties: each lower/side anchor to its nearest truss joints within steel reach
  if (o.ties) {
    level.anchors.forEach((a, ai) => {
      if (ai < 2) return;                       // deck-edge anchors are already used
      if (a[1] > 1) return;                     // towers are for cables
      const near = joints.map(j => [j, Math.hypot(b.pos(j)[0] - a[0], b.pos(j)[1] - a[1])])
        .filter(([, d]) => d <= E.MATERIALS.steel.maxLen && d > .45).sort((p, q) => p[1] - q[1]).slice(0, o.ties);
      for (const [j] of near) b.mem(ai, j, 'steel');
    });
  }
  // cables from tower anchors to joints, spread along each half
  if (o.cables && level.materials.includes('cable')) {
    level.anchors.forEach((a, ai) => {
      if (a[1] <= 1) return;
      const cand = joints.filter(j => {
        const p = b.pos(j), d = Math.hypot(p[0] - a[0], p[1] - a[1]);
        const sameSide = a[0] < level.gap / 2 ? p[0] < level.gap / 2 : p[0] > level.gap / 2;
        return sameSide && d <= E.MATERIALS.cable.maxLen && p[1] >= deckY(p[0]) - 1e-6 + (o.h > 0 ? o.h - 1e-6 : 0);
      }).sort((p, q) => Math.abs(b.pos(q)[0] - a[0]) - Math.abs(b.pos(p)[0] - a[0]));
      const pick = [];
      for (let k = 0; k < o.cables && cand.length; k++) pick.push(cand[Math.floor(k * cand.length / o.cables)]);
      for (const j of pick) b.mem(ai, j, 'cable');
    });
  }
  if (!level.materials.includes('steel')) for (const m of b.members) if (m[2] === 'steel') m[2] = 'wood';
  for (let i = b.members.length - 1; i >= 0; i--) if (!level.materials.includes(b.members[i][2])) b.members.splice(i, 1);
  // drop members that became illegal (wood too long when steel is locked)
  const members = b.members.filter(m => b.len(m[0], m[1]) <= E.MATERIALS[m[2]].maxLen + 1e-6);
  return { nodes: b.nodes, members };
}

function prune(level, d) {
  const nA = level.anchors.length;
  for (let i = d.nodes.length - 1; i >= 0; i--) {
    const k = nA + i;
    if (d.members.some(m => m[0] === k || m[1] === k)) continue;
    d.nodes.splice(i, 1);
    d.members = d.members.map(m => [m[0] > k ? m[0] - 1 : m[0], m[1] > k ? m[1] - 1 : m[1], m[2]]);
  }
  return d;
}

// Greedy material diet: cheapen or delete members while the bridge still passes.
function diet(level, d, maxPeak) {
  const nodes = level.anchors.concat(d.nodes);
  const L = m => Math.hypot(nodes[m[1]][0] - nodes[m[0]][0], nodes[m[1]][1] - nodes[m[0]][1]);
  let best = clone(d);
  const passes = x => { const r = evaluate(level, x); return r.ok && r.peak <= maxPeak ? r : null; };
  for (let pass = 0; pass < 2; pass++) {
    const order = best.members.map((m, i) => [i, E.MATERIALS[m[2]].cost * L(m)]).filter(([i]) => best.members[i][2] !== 'road').sort((a, b) => b[1] - a[1]).map(p => p[0]);
    for (const i of order) {
      const m = best.members[i]; if (!m) continue;
      if (m[2] === 'steel' && level.materials.includes('wood') && L(m) <= E.MATERIALS.wood.maxLen) {
        const t = clone(best); t.members[i][2] = 'wood';
        if (passes(t)) { best = t; continue; }
      }
      const t = clone(best); t.members.splice(i, 1);
      if (passes(t)) { best = t; }
    }
  }
  // map deleted-index shifts: rebuild order each pass handled by fresh order; prune orphan nodes
  return prune(level, best);
}

function solveLevel(level) {
  const opts = [];
  const hs = [-3, -2.5, -2, -1.5, 1.5, 2, 2.5, 3];
  const panels = [2, 2.5, 1.75];
  for (const h of hs) for (const panel of panels) for (const ties of [0, 1, 2]) for (const verticals of [false, true]) {
    const cabs = level.anchors.some(a => a[1] > 1) && level.materials.includes('cable') ? [0, 2, 3, 4] : [0];
    for (const cables of cabs) opts.push({ h, panel, ties, verticals, cables });
  }
  const results = [];
  for (const o of opts) {
    const d = candidate(level, o);
    if (!d.members.length) continue;
    const r = evaluate(level, d);
    if (r.ok && r.peak <= LEAN_MAX) results.push({ o, d, c: cost(level, d), peak: r.peak });
  }
  // seed with the hand-built reference design
  {
    const d = designer(level); REFERENCE[level.id](d);
    const seed = { nodes: d.nodes, members: d.members }, r = evaluate(level, seed);
    if (r.ok) results.push({ o: 'reference', d: seed, c: cost(level, seed), peak: r.peak, seed: true });
  }
  results.sort((a, b) => a.c - b.c);
  // keep the seed among the designs that get dieted
  const si = results.findIndex(r => r.seed);
  if (si >= 6) results.splice(5, 0, results.splice(si, 1)[0]);
  process.stderr.write(`  ${level.code}: ${opts.length} layouts, ${results.length} pass; dieting the best ${Math.min(6, results.length)}\n`);
  const lean = [];
  let sturdy = [];
  for (const r of results.slice(0, 6)) {
    const dl = diet(level, r.d, LEAN_MAX); const el = evaluate(level, dl);
    if (el.ok) lean.push({ d: dl, c: cost(level, dl), peak: el.peak, o: r.o });
  }
  // Sturdy: the tightest margin that still fits the budget
  for (const thr of [STURDY_MAX, .72, .8]) {
    for (const r of results.slice(0, 6)) {
      const ds = diet(level, r.d, thr); const es = evaluate(level, ds);
      if (es.ok && es.peak <= thr) sturdy.push({ d: ds, c: cost(level, ds), peak: es.peak, o: r.o });
    }
    for (const r of results) if (r.peak <= thr) { sturdy.push({ d: r.d, c: r.c, peak: r.peak, o: r.o }); break; }
    sturdy = sturdy.filter(x => x.c <= level.budget);
    if (sturdy.length) break;
  }
  sturdy.sort((a, b) => a.c - b.c);
  if (sturdy[0]) {
    lean.push(sturdy[0]);                                  // a sturdy design is also a lean one
    const dl = diet(level, sturdy[0].d, LEAN_MAX), el = evaluate(level, dl);
    if (el.ok) lean.push({ d: dl, c: cost(level, dl), peak: el.peak });
  }
  lean.sort((a, b) => a.c - b.c);
  return { lean: lean[0], sturdy: sturdy[0] };
}

// ---------------------------------------------------------------- main
const only = process.argv.slice(2).map(Number);
const outPath = process.env.OUT || path.join(root, 'src', 'solutions.js');
let existing = {};
if (fs.existsSync(outPath)) existing = new Function(fs.readFileSync(outPath, 'utf8') + '; return SOLUTIONS;')();
const out = Object.assign({}, existing);
for (const L of E.LEVELS) {
  if (only.length && !only.includes(L.id)) continue;
  const t0 = Date.now();
  const { lean, sturdy } = solveLevel(L);
  const fmt = (s, name) => s && ({ name, cost: Math.round(s.c), peak: +s.peak.toFixed(3), nodes: s.d.nodes, members: s.d.members });
  out[L.id] = [fmt(sturdy, 'Sturdy'), fmt(lean, 'Lean')].filter(Boolean);
  if (sturdy && lean && lean.c >= sturdy.c - 1) out[L.id] = [Object.assign(fmt(sturdy, 'Best'))];
  const star = c => (c <= L.budget * .7 ? 3 : c <= L.budget * .85 ? 2 : c <= L.budget ? 1 : 0);
  console.log(`${L.code} ${L.name.padEnd(20)} sturdy ${sturdy ? (sturdy.c / 1000).toFixed(2) + 'M ' + Math.round(sturdy.peak * 100) + '% ' + star(sturdy.c) + '*' : '-'}  lean ${lean ? (lean.c / 1000).toFixed(2) + 'M ' + Math.round(lean.peak * 100) + '% ' + star(lean.c) + '*' : '-'}  budget ${(L.budget / 1000).toFixed(1)}M  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
const body = '/*SOLUTIONS-START*/\n// Generated by tools/solve.js: best designs found by search, per level.\n// Sturdy keeps peak stress <= 65%; Lean is the cheapest found with peak <= 90%.\nconst SOLUTIONS = ' +
  JSON.stringify(out).replace(/\],\[/g, '],\n[') + ';\n/*SOLUTIONS-END*/\n';
fs.writeFileSync(outPath, body);

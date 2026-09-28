/*ENGINE-START*/
// ---------------------------------------------------------------------------
// Daraja physics: XPBD ("small steps") truss + rigid vehicle + wheel contact.
// Units: metres, kilograms, seconds, newtons. y is up.
// ---------------------------------------------------------------------------
const G = 9.81;

const MATERIALS = {
  road:  { key: 'road',  name: 'Road deck', short: 'Road',   cost: 190, maxLen: 2.5, EA: 2.2e7, kgPerM: 100, tension: 95e3,  comp: 95e3,  B: 320e3 },
  wood:  { key: 'wood',  name: 'Timber',    short: 'Timber', cost: 110, maxLen: 3.0, EA: 1.2e7, kgPerM: 32,  tension: 70e3,  comp: 70e3,  B: 230e3 },
  steel: { key: 'steel', name: 'Steel',     short: 'Steel',  cost: 300, maxLen: 4.5, EA: 4.0e7, kgPerM: 60,  tension: 220e3, comp: 220e3, B: 950e3 },
  cable: { key: 'cable', name: 'Cable',     short: 'Cable',  cost: 150, maxLen: 12,  EA: 2.6e7, kgPerM: 10,  tension: 170e3, comp: 0,     B: 0 },
};

// Compression capacity: the lesser of crushing and Euler-style buckling B/L².
function compCapacity(mat, L) {
  if (mat.comp === 0) return 0;
  return Math.min(mat.comp, mat.B / (L * L));
}

const VEHICLES = {
  car:    { key: 'car',    name: 'Saloon car',        mass: 1200, wheels: [0, 2.5],        r: 0.34, speed: 5.5, height: 1.25, rear: 0.8, front: 0.8, accel: 5.0 },
  van:    { key: 'van',    name: 'Delivery van',      mass: 2400, wheels: [0, 3.0],        r: 0.38, speed: 5.0, height: 2.0,  rear: 0.7, front: 0.8, accel: 4.5 },
  matatu: { key: 'matatu', name: 'Matatu',            mass: 3200, wheels: [0, 2.9],        r: 0.37, speed: 5.5, height: 2.0,  rear: 0.9, front: 0.7, accel: 4.5 },
  boda:   { key: 'boda',   name: 'Boda boda',         mass: 260,  wheels: [0, 1.35],       r: 0.3,  speed: 5.0, height: 1.55, rear: 0.45, front: 0.35, accel: 4.5 },
  truck:  { key: 'truck',  name: 'Murram tipper',     mass: 6000, wheels: [0, 1.3, 4.6],   r: 0.5,  speed: 4.0, height: 2.6,  rear: 0.9, front: 1.2, accel: 3.5 },
};

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Terrain polygons for a level (world coords). Collision uses every edge.
function buildTerrain(level) {
  const rnd = mulberry32(level.seed || 7);
  const wy = level.waterY, bottom = wy - 6;
  const polys = [];
  // left bank: top surface, then a jagged cliff face down to the water
  const face = (x0, y0, dir) => {
    const pts = [];
    let x = x0, y = y0;
    const steps = 7;
    for (let i = 1; i <= steps; i++) {
      y = y0 + (bottom - y0) * (i / steps);
      x = x0 - dir * (0.2 + rnd() * 0.9 + i * 0.25);
      pts.push([x, y]);
    }
    return pts;
  };
  const L = [[-80, 0], [0, 0], ...face(0, 0, 1), [-80, bottom]];
  const hR = level.hR || 0;
  const R = [[level.gap, hR], [level.gap + 80, hR], [level.gap + 80, bottom], ...face(level.gap, hR, -1).reverse()];
  polys.push({ kind: 'bank', pts: L });
  polys.push({ kind: 'bank', pts: R });
  for (const p of level.pillars || []) {
    const w = p.w || 1.6;
    const pts = [[p.x - w / 2, p.y], [p.x + w / 2, p.y]];
    const n = 5;
    for (let i = 1; i <= n; i++) pts.push([p.x + w / 2 + i * 0.35 + rnd() * 0.4, p.y + (bottom - p.y) * i / n]);
    for (let i = n; i >= 1; i--) pts.push([p.x - w / 2 - i * 0.35 - rnd() * 0.4, p.y + (bottom - p.y) * i / n]);
    polys.push({ kind: 'pillar', pts });
  }
  for (const s of level.spires || []) {
    const w = s.w || 2.2, base = s.base != null ? s.base : 0;
    const pts = [[s.x - w * 0.9, base], [s.x - w * 0.35, s.y - 0.4], [s.x - 0.25, s.y], [s.x + 0.3, s.y - 0.2], [s.x + w * 0.4, s.y - 1.2], [s.x + w * 0.9, base]];
    polys.push({ kind: 'spire', pts });
  }
  const segs = [];
  for (const p of polys) {
    if (p.kind === 'spire') continue; // towers stand beside the road, not on it
    const n = p.pts.length;
    for (let i = 0; i < n; i++) {
      const a = p.pts[i], b = p.pts[(i + 1) % n];
      segs.push([a[0], a[1], b[0], b[1]]);
    }
  }
  return { polys, segs };
}

// Build a simulation from a level and a design.
// design: { nodes: [[x,y],...] (free joints), members: [[i,j,mat],...] }
// Node index i < anchors.length refers to level.anchors[i]; others to design nodes.
function createSim(level, design, opts = {}) {
  const P = [];
  const addP = (x, y, mass, fixed) => {
    const p = { x, y, px: x, py: y, vx: 0, vy: 0, m: mass, w: fixed ? 0 : 1 / mass, fixed: !!fixed };
    P.push(p); return P.length - 1;
  };
  const nA = level.anchors.length;
  const allNodes = level.anchors.map(a => [a[0], a[1], true]).concat(design.nodes.map(n => [n[0], n[1], false]));
  const nodeMass = new Array(allNodes.length).fill(0);
  for (const [i, j, mk] of design.members) {
    const a = allNodes[i], b = allNodes[j];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const m = MATERIALS[mk].kgPerM * L;
    nodeMass[i] += m / 2; nodeMass[j] += m / 2;
  }
  allNodes.forEach((n, k) => addP(n[0], n[1], Math.max(8, nodeMass[k]), n[2]));
  const members = design.members.map(([i, j, mk], id) => {
    const mat = MATERIALS[mk];
    const a = P[i], b = P[j];
    const L0 = Math.hypot(b.x - a.x, b.y - a.y);
    return {
      id, a: i, b: j, mat: mk, L0, alpha: L0 / mat.EA,
      force: 0, ff: 0, util: 0, peak: 0, broken: false, stub: false,
      capT: mat.tension, capC: compCapacity(mat, L0),
    };
  });

  // vehicle: wheels on the chassis line + two roof corners, all rigidly tied
  const V = VEHICLES[level.vehicle];
  const startX = vehicleStartX(level);
  const wheels = [], body = [];
  const xs = V.wheels;
  const wheelMass = V.mass * 0.72 / xs.length;
  for (const dx of xs) wheels.push(addP(startX + dx, V.r + 0.02, wheelMass, false));
  const x0 = xs[0] - V.rear, x1 = xs[xs.length - 1] + V.front;
  body.push(addP(startX + x0, V.height, V.mass * 0.14, false));
  body.push(addP(startX + x1, V.height, V.mass * 0.14, false));
  const vparts = wheels.concat(body);
  const rigid = [];
  // wheel-to-wheel links are rigid; wheel-to-body links are suspension springs (~1.6 Hz)
  const kSusp = V.mass * Math.pow(2 * Math.PI * 1.6, 2) / (2 * xs.length);
  for (let i = 0; i < vparts.length; i++) for (let j = i + 1; j < vparts.length; j++) {
    const a = P[vparts[i]], b = P[vparts[j]];
    const susp = i < xs.length && j >= xs.length;
    rigid.push({ a: vparts[i], b: vparts[j], L0: Math.hypot(b.x - a.x, b.y - a.y), alpha: susp ? 1 / kSusp : 0, damp: susp ? 14 : 0 });
  }
  const terrain = buildTerrain(level);
  return {
    level, P, members, nA, terrain,
    veh: { def: V, wheels, body, rigid, contact: wheels.map(() => false), roll: wheels.map(() => 0), startX },
    t: 0, state: 'running', result: null, stuckT: 0, events: [], firstBreak: null, breaks: 0,
    substeps: opts.substeps || 40, finishX: level.gap + (level.finishPad || 5),
    maxX: startX,
  };
}

// Rear-wheel start position: parked just short of the first abutment.
function vehicleStartX(level) {
  if (level.startX != null) return level.startX;
  const V = VEHICLES[level.vehicle];
  return -(V.wheels[V.wheels.length - 1] + V.front) - 1.2;
}

function closestOnSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const L2 = dx * dx + dy * dy;
  let t = L2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return [ax + dx * t, ay + dy * t, t];
}

function substep(sim, h) {
  const P = sim.P;
  const gs = Math.min(1, sim.t / 0.7);           // ramp gravity in: no dynamic kick at t=0
  const g = -G * gs;
  const damp = Math.exp(-0.25 * h), wet = Math.exp(-2.8 * h), wy = sim.level.waterY;
  for (const p of P) {
    if (p.w === 0) continue;
    p.vy += g * h;
    p.vx *= damp; p.vy *= damp;
    if (p.y < wy) { p.vx *= wet; p.vy = p.vy * wet + G * 0.75 * h; } // water: drag and buoyancy
    p.px = p.x; p.py = p.y;
    p.x += p.vx * h; p.y += p.vy * h;
  }
  const ih2 = 1 / (h * h);
  // truss members
  for (const m of sim.members) {
    if (m.broken) continue;
    const a = P[m.a], b = P[m.b];
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1e-9) continue;
    const C = d - m.L0;
    if (m.mat === 'cable' && C < 0) { m.force = 0; continue; }
    const W = a.w + b.w;
    if (W === 0) { m.force = 0; continue; }
    const at = m.alpha * ih2;
    const dl = -C / (W + at);
    const nx = dx / d, ny = dy / d;
    a.x -= nx * dl * a.w; a.y -= ny * dl * a.w;
    b.x += nx * dl * b.w; b.y += ny * dl * b.w;
    m.force = -dl * ih2;
  }
  // vehicle rigid frame
  for (const c of sim.veh.rigid) {
    const a = P[c.a], b = P[c.b];
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const C = d - c.L0, W = a.w + b.w;
    const dl = -C / (W + (c.alpha || 0) * ih2), nx = dx / d, ny = dy / d;
    a.x -= nx * dl * a.w; a.y -= ny * dl * a.w;
    b.x += nx * dl * b.w; b.y += ny * dl * b.w;
  }
  // contacts
  const V = sim.veh, r = V.def.r;
  const contactInfo = [];
  for (let k = 0; k < V.wheels.length; k++) {
    const p = P[V.wheels[k]];
    let touched = null;
    for (const s of sim.terrain.segs) {
      const [cx, cy] = closestOnSeg(p.x, p.y, s[0], s[1], s[2], s[3]);
      const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy);
      if (d < r && d > 1e-9) {
        const nx = dx / d, ny = dy / d, pen = r - d;
        p.x += nx * pen; p.y += ny * pen;
        if (ny > 0.3) touched = { nx, ny, a: -1, b: -1, t: 0 };
      }
    }
    for (const m of sim.members) {
      if (m.mat !== 'road' || (m.broken && !m.stub)) continue;
      const a = P[m.a], b = P[m.b];
      const [cx, cy, t] = closestOnSeg(p.x, p.y, a.x, a.y, b.x, b.y);
      const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy);
      const rr = r + 0.12; // half deck thickness
      if (d < rr && d > 1e-9) {
        const nx = dx / d, ny = dy / d, pen = rr - d;
        const wa = a.w * (1 - t), wb = b.w * t;
        const s = pen / (p.w + (1 - t) * wa + t * wb);
        p.x += nx * s * p.w; p.y += ny * s * p.w;
        a.x -= nx * s * wa; a.y -= ny * s * wa;
        b.x -= nx * s * wb; b.y -= ny * s * wb;
        if (ny > 0.3) touched = { nx, ny, a: m.a, b: m.b, t };
      }
    }
    contactInfo.push(touched);
  }
  // body corners vs terrain (so a falling vehicle tumbles off cliffs)
  for (const bi of V.body) {
    const p = P[bi];
    for (const s of sim.terrain.segs) {
      const [cx, cy] = closestOnSeg(p.x, p.y, s[0], s[1], s[2], s[3]);
      const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy);
      if (d < 0.15 && d > 1e-9) { p.x += dx / d * (0.15 - d); p.y += dy / d * (0.15 - d); }
    }
  }
  // velocities
  for (const p of P) {
    if (p.w === 0) continue;
    p.vx = (p.x - p.px) / h; p.vy = (p.y - p.py) / h;
  }
  // axial material damping
  for (const m of sim.members) {
    if (m.broken && !m.stub) continue;
    const a = P[m.a], b = P[m.b];
    const W = a.w + b.w; if (W === 0) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d;
    const vrel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    const dv = vrel * Math.min(1, 60 * h);
    a.vx += nx * dv * a.w / W; a.vy += ny * dv * a.w / W;
    b.vx -= nx * dv * b.w / W; b.vy -= ny * dv * b.w / W;
  }
  // suspension dampers
  for (const c of sim.veh.rigid) {
    if (!c.damp) continue;
    const a = P[c.a], b = P[c.b], W = a.w + b.w;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d;
    const dv = ((b.vx - a.vx) * nx + (b.vy - a.vy) * ny) * Math.min(1, c.damp * h);
    a.vx += nx * dv * a.w / W; a.vy += ny * dv * a.w / W;
    b.vx -= nx * dv * b.w / W; b.vy -= ny * dv * b.w / W;
  }
  // traction: drive wheels toward cruising speed relative to the surface
  const driving = sim.t > 0.9 && sim.state === 'running';
  for (let k = 0; k < V.wheels.length; k++) {
    const c = contactInfo[k];
    V.contact[k] = !!c;
    if (!c) continue;
    const p = P[V.wheels[k]];
    const tx = c.ny, ty = -c.nx; // tangent pointing forward (+x) on level ground
    let svx = 0, svy = 0;
    if (c.a >= 0) {
      const a = P[c.a], b = P[c.b];
      svx = a.vx * (1 - c.t) + b.vx * c.t; svy = a.vy * (1 - c.t) + b.vy * c.t;
    }
    const vt = (p.vx - svx) * tx + (p.vy - svy) * ty;
    const target = driving ? V.def.speed : 0;
    const maxDv = (driving ? V.def.accel : 6) * h;
    let dv = target - vt;
    dv = Math.max(-maxDv, Math.min(maxDv, dv));
    p.vx += tx * dv; p.vy += ty * dv;
  }
}

// Advance one frame. Returns events (break, splash, finish, fail).
function stepSim(sim, dt) {
  const n = sim.substeps, h = dt / n;
  const kf = h / (0.035 + h);
  const ev = [];
  for (let i = 0; i < n; i++) {
    sim.t += h;
    substep(sim, h);
    for (const m of sim.members) if (!m.broken) m.ff += (m.force - m.ff) * kf;
  }
  // failures
  for (const m of sim.members) {
    if (m.broken) continue;
    const f = m.ff;
    const cap = f >= 0 ? m.capT : m.capC;
    m.util = cap > 0 ? Math.abs(f) / cap : (f < -1 ? 99 : 0);
    if (m.mat === 'cable' && f < 0) m.util = 0;
    if (sim.t > 0.15 && m.util > m.peak) m.peak = m.util;
    if (m.util >= 1 && sim.t > 0.1) breakMember(sim, m, f >= 0 ? 'tension' : 'buckle', ev);
  }
  // vehicle status
  const V = sim.veh, P = sim.P;
  let minY = Infinity, minX = Infinity, sp = 0;
  for (const k of V.wheels.concat(V.body)) {
    minY = Math.min(minY, P[k].y); minX = Math.min(minX, P[k].x);
    sp = Math.max(sp, Math.hypot(P[k].vx, P[k].vy));
  }
  sim.maxX = Math.max(sim.maxX, minX);
  if (sim.state === 'running') {
    if (minY < sim.level.waterY + 0.2) {
      sim.state = 'failed'; sim.result = { reason: 'water', x: minX, t: sim.t };
      ev.push({ type: 'splash', x: P[V.body[0]].x, y: sim.level.waterY, v: sp });
    } else if (minX > sim.finishX) {
      sim.state = 'crossed'; sim.result = { t: sim.t };
      ev.push({ type: 'finish' });
    } else {
      if (sim.t > 2 && sp < 0.25) sim.stuckT += dt; else sim.stuckT = 0;
      if (sim.stuckT > 3.5) { sim.state = 'failed'; sim.result = { reason: 'stuck', x: minX, t: sim.t }; ev.push({ type: 'stuck' }); }
      else if (sim.t > 45) { sim.state = 'failed'; sim.result = { reason: 'timeout', x: minX, t: sim.t }; ev.push({ type: 'stuck' }); }
    }
  }
  for (let k = 0; k < V.wheels.length; k++) {
    const p = P[V.wheels[k]];
    V.roll[k] -= (p.vx * dt) / V.def.r;
  }
  return ev;
}

// A failed member splits into two stubs, each hinged to one of its joints.
function breakMember(sim, m, mode, ev) {
  m.broken = true;
  const P = sim.P, a = P[m.a], b = P[m.b];
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const mass = MATERIALS[m.mat].kgPerM * m.L0 / 4;
  const mk = (ji, j) => {
    const q = { x: mx, y: my, px: mx, py: my, vx: j.vx + (Math.random() - 0.5) * 2, vy: j.vy + Math.random() * 1.5, m: mass, w: 1 / Math.max(3, mass), fixed: false, debris: true };
    P.push(q);
    const s = {
      id: sim.members.length, a: ji, b: P.length - 1, mat: m.mat, L0: m.L0 / 2 * 0.97, alpha: 0,
      force: 0, ff: 0, util: 0, peak: 0, broken: true, stub: true, capT: 1, capC: 1, parent: m.id,
    };
    sim.members.push(s);
  };
  // the stubs are ordinary rigid rods: solve them with the vehicle constraints
  mk(m.a, a); mk(m.b, b);
  const s1 = sim.members[sim.members.length - 2], s2 = sim.members[sim.members.length - 1];
  sim.veh.rigid.push({ a: s1.a, b: s1.b, L0: s1.L0 }, { a: s2.a, b: s2.b, L0: s2.L0 });
  sim.breaks++;
  if (!sim.firstBreak) sim.firstBreak = { id: m.id, mat: m.mat, mode, L: m.L0, force: m.ff, cap: mode === 'tension' ? m.capT : m.capC, t: sim.t, x: mx, y: my };
  ev.push({ type: 'break', id: m.id, mat: m.mat, mode, x: mx, y: my, vx: (a.vx + b.vx) / 2, vy: (a.vy + b.vy) / 2 });
}

function designCost(level, design) {
  const nodes = level.anchors.concat(design.nodes);
  let c = 0;
  for (const [i, j, mk] of design.members) {
    const a = nodes[i], b = nodes[j];
    c += MATERIALS[mk].cost * Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return c;
}
/*ENGINE-END*/

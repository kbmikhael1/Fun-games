/*SIM-START*/
'use strict';
// ---------------------------------------------------------------------------
// God Lab simulation: one valley, one people, one god (you).
// Pure logic, no browser code. World units: 1 unit = 1 tile, y is up.
// ---------------------------------------------------------------------------
const N = 128, V = N + 1;
const DAY = 48;                 // game seconds per day
const YEAR = DAY * 4;           // one day per season
const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
const TT = { WATER: 0, SHALLOW: 1, SAND: 2, GRASS: 3, JUNGLE: 4, FOREST: 5, ROCK: 6, SNOW: 7 };
const AGES = [
  { name: 'Stone Age', k: 0, pop: 0, life: 52, cloth: 'furs' },
  { name: 'Age of Farming', k: 110, pop: 18, life: 55, cloth: 'woven cloth' },
  { name: 'Bronze Age', k: 420, pop: 28, life: 58, cloth: 'dyed tunics' },
  { name: 'Iron Age', k: 1000, pop: 40, life: 62, cloth: 'robes and armour' },
  { name: 'Middle Ages', k: 2000, pop: 55, life: 64, cloth: 'wool and hats' },
  { name: 'Industrial Age', k: 3800, pop: 75, life: 70, cloth: 'coats and top hats' },
  { name: 'Modern Age', k: 6400, pop: 95, life: 80, cloth: 'jeans and bright shirts' },
];
const LAUNCH_K = 9800;
const MAX_PEOPLE = 230;
const POP_CAP = [34, 55, 80, 110, 140, 180, 230];

// -------------------------------------------------------------- utilities
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
function rnd(w) { let t = (w.rs = (w.rs + 0x6D2B79F5) | 0); t = Math.imul(t ^ (t >>> 15), 1 | t); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const rr = (w, a, b) => a + (b - a) * rnd(w);
const pick = (w, arr) => arr[Math.floor(rnd(w) * arr.length)];
function hash2(s, x, z) { let h = s ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(s, x, z) { const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz); const a = hash2(s, xi, zi), b = hash2(s, xi + 1, zi), c = hash2(s, xi, zi + 1), d = hash2(s, xi + 1, zi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm(s, x, z, o = 4) { let t = 0, a = .5, f = 1; for (let k = 0; k < o; k++) { t += a * vnoise(s + k * 1013, x * f, z * f); a *= .5; f *= 2; } return t / .9375; }
const nid = w => ++w.nextId;

// -------------------------------------------------------------- terrain
function hAt(w, x, z) {
  x = clamp(x, 0, N - .001); z = clamp(z, 0, N - .001);
  const x0 = x | 0, z0 = z | 0, fx = x - x0, fz = z - z0, i = z0 * V + x0, H = w.H;
  return (H[i] * (1 - fx) + H[i + 1] * fx) * (1 - fz) + (H[i + V] * (1 - fx) + H[i + V + 1] * fx) * fz;
}
const tIdx = (x, z) => (x < 0 || z < 0 || x >= N || z >= N) ? -1 : (z | 0) * N + (x | 0);
const tileAt = (w, x, z) => { const i = tIdx(x, z); return i < 0 ? TT.ROCK : w.tile[i]; };
const isWater = t => t === TT.WATER || t === TT.SHALLOW;
const deep = (w, x, z) => { const i = tIdx(x, z); return i < 0 || w.tile[i] === TT.WATER; };
function onLand(w, x, z) { const i = tIdx(x, z); return i >= 0 && !isWater(w.tile[i]); }

function meander(w, a, b, amp, waves) {
  const pts = [], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), px = -dz / L, pz = dx / L, ph = rr(w, 0, 6.28);
  for (let k = 0; k <= 40; k++) { const t = k / 40, o = Math.sin(t * Math.PI * waves + ph) * amp * Math.sin(t * Math.PI); pts.push({ x: a.x + dx * t + px * o, z: a.z + dz * t + pz * o }); }
  return pts;
}
function segDist(x, z, pts) {
  let best = 1e9;
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1], vx = b.x - a.x, vz = b.z - a.z, l2 = vx * vx + vz * vz;
    const t = clamp01(((x - a.x) * vx + (z - a.z) * vz) / l2), d = Math.hypot(x - a.x - vx * t, z - a.z - vz * t);
    if (d < best) best = d;
  }
  return best;
}

function genTerrain(w) {
  const s = w.seed, H = w.H;
  const M = { x: N * rr(w, .72, .84), z: N * rr(w, .14, .24) };
  const L = { x: N * rr(w, .3, .4), z: N * rr(w, .58, .68), r: rr(w, 13, 16) };
  const src = { x: M.x - 18, z: M.z + 20 };
  const inlet = { x: L.x + L.r * .7, z: L.z - L.r * .55 };
  const out = { x: N * rr(w, .5, .62), z: N + 6 };
  const outlet = { x: L.x + L.r * .4, z: L.z + L.r * .8 };
  const river = meander(w, src, inlet, 7, 2.5).concat(meander(w, outlet, out, 6, 2));
  w.layout = { M, L, river };
  for (let z = 0; z <= N; z++) for (let x = 0; x <= N; x++) {
    let h = .5 + fbm(s, x * .04, z * .04) * 2.2;
    const edge = Math.min(x, z, N - x, N - z);
    h += Math.pow(Math.max(0, 16 - edge), 1.55) * .085 * (.55 + fbm(s + 5, x * .07, z * .07));
    const dm = Math.hypot(x - M.x, z - M.z);
    h += 21 * Math.exp(-Math.pow(dm / 16, 2)) * (.8 + .45 * fbm(s + 9, x * .11, z * .11));
    h += 7 * Math.exp(-Math.pow(dm / 30, 2)) * fbm(s + 13, x * .09, z * .09);
    const hill = smooth(.52, .72, fbm(s + 21, x * .028, z * .028));
    h += hill * 5.5 * fbm(s + 33, x * .1, z * .1);
    const dl = Math.hypot(x - L.x, z - L.z) / (L.r * (.82 + .36 * fbm(s + 44, x * .11, z * .11)));
    if (dl < 1.5) h = lerp(-3.4, h, smooth(.45, 1.45, dl));
    const dr = segDist(x, z, river);
    if (dr < 4.5) h = lerp(Math.min(h, -1.05), h, smooth(1.3, 4.5, dr));
    H[z * V + x] = h;
  }
  retile(w, 0, 0, N - 1, N - 1);
}

function retile(w, x0, z0, x1, z1) {
  const s = w.seed;
  x0 = clamp(x0 | 0, 0, N - 1); z0 = clamp(z0 | 0, 0, N - 1); x1 = clamp(x1 | 0, 0, N - 1); z1 = clamp(z1 | 0, 0, N - 1);
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const i = z * N + x, j = z * V + x, H = w.H;
    const a = H[j], b = H[j + 1], c = H[j + V], d = H[j + V + 1];
    const h = (a + b + c + d) / 4, slope = Math.max(a, b, c, d) - Math.min(a, b, c, d), wl = w.water;
    let t;
    if (h < wl) t = wl - h > 1.25 ? TT.WATER : TT.SHALLOW;
    else if (h < wl + .45 && Math.min(a, b, c, d) < wl + .15) t = TT.SAND;
    else if (h > 14.5) t = TT.SNOW;
    else if (h > 9 || slope > 2.4) t = TT.ROCK;
    else {
      const moist = fbm(s + 55, x * .035, z * .035) + x / N * .55 + z / N * .25;
      if (moist > 1.12 && h < 6) t = TT.JUNGLE;
      else if (h > 4.3) t = TT.FOREST;
      else t = TT.GRASS;
    }
    w.tile[i] = t;
    w.fert[i] = t === TT.GRASS ? .6 + .4 * fbm(s + 77, x * .1, z * .1) : t === TT.JUNGLE ? .7 : t === TT.FOREST ? .4 : t === TT.SAND ? .15 : 0;
  }
  w.terrainDirty = true;
}

function computeWaterDist(w) {
  const D = w.dWater; D.fill(999); const q = [];
  for (let i = 0; i < N * N; i++) if (isWater(w.tile[i])) { D[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % N, z = (i / N) | 0, d = D[i] + 1;
    if (x > 0 && D[i - 1] > d) { D[i - 1] = d; q.push(i - 1); }
    if (x < N - 1 && D[i + 1] > d) { D[i + 1] = d; q.push(i + 1); }
    if (z > 0 && D[i - N] > d) { D[i - N] = d; q.push(i - N); }
    if (z < N - 1 && D[i + N] > d) { D[i + N] = d; q.push(i + N); }
  }
}

// -------------------------------------------------------------- flora
const TREE_KINDS = ['broad', 'pine', 'palm', 'jungle', 'bush', 'berry'];
function addTree(w, kind, x, z, size) {
  const t = { id: nid(w), kind, x, z, size: size ?? rr(w, .75, 1.25), grow: 1, wood: kind === 'bush' || kind === 'berry' ? 0 : 3 + (kind === 'jungle' ? 3 : 0), food: kind === 'berry' ? 4 : 0, fell: 0, burnt: 0, rot: rr(w, 0, 6.28), dead: false };
  w.trees.push(t); if (w._tg && !w.treesDirty) w._tg[clamp((z / TG) | 0, 0, TGN - 1) * TGN + clamp((x / TG) | 0, 0, TGN - 1)].push(t); return t;
}
function plantFlora(w) {
  const s = w.seed;
  for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) {
    const t = w.tile[z * N + x], clump = fbm(s + 66, x * .07, z * .07), r = rnd(w);
    const px = x + rr(w, .15, .85), pz = z + rr(w, .15, .85);
    if (t === TT.JUNGLE) { if (r < .5) addTree(w, r < .22 ? 'jungle' : r < .33 ? 'palm' : 'bush', px, pz); }
    else if (t === TT.FOREST) { if (r < .34) addTree(w, r < .27 ? 'pine' : 'broad', px, pz); }
    else if (t === TT.GRASS) {
      if (clump > .6 && r < .32) addTree(w, r < .05 ? 'bush' : 'broad', px, pz);
      else if (r < .012) addTree(w, 'broad', px, pz);
      else if (r < .03) addTree(w, 'berry', px, pz);
      else if (r < .036) addTree(w, 'bush', px, pz);
    } else if (t === TT.SAND && w.dWater[z * N + x] <= 2 && r < .06) addTree(w, 'palm', px, pz);
    else if (t === TT.ROCK && r < .05 && w.H[z * V + x] < 11) addTree(w, 'pine', px, pz, rr(w, .6, .9));
    if ((t === TT.ROCK || t === TT.FOREST) && rnd(w) < .028) addRock(w, px, pz, rnd(w) < .3);
    else if (t === TT.GRASS && rnd(w) < .004) addRock(w, px, pz, false);
  }
}
const TG = 8, TGN = N / TG;
function treeGrid(w) {
  if (w._tg && !w.treesDirty) return w._tg;
  const g = w._tg = Array.from({ length: TGN * TGN }, () => []);
  for (const t of w.trees) if (!t.dead) g[clamp((t.z / TG) | 0, 0, TGN - 1) * TGN + clamp((t.x / TG) | 0, 0, TGN - 1)].push(t);
  w.treesDirty = false; return g;
}
function nearestTree(w, x, z, filter, maxD = 1e9) {
  const g = treeGrid(w), cx = clamp((x / TG) | 0, 0, TGN - 1), cz = clamp((z / TG) | 0, 0, TGN - 1);
  let best = null, bd = maxD;
  for (let r = 0; r < TGN; r++) {
    if ((r - 1) * TG > bd) break;
    for (let j = cz - r; j <= cz + r; j++) for (let i = cx - r; i <= cx + r; i++) {
      if (i < 0 || j < 0 || i >= TGN || j >= TGN || (Math.abs(i - cx) !== r && Math.abs(j - cz) !== r)) continue;
      for (const t of g[j * TGN + i]) { if (t.dead) continue; const d = dist(t.x, t.z, x, z); if (d < bd && (!filter || filter(t))) { bd = d; best = t; } }
    }
  }
  return best;
}
function addRock(w, x, z, ore) { const r = { id: nid(w), x, z, ore, stone: ore ? 14 : 16, size: rr(w, .7, 1.4), rot: rr(w, 0, 6.28), dead: false }; w.rocks.push(r); return r; }

// -------------------------------------------------------------- names
const SYL_A = ['A', 'Ka', 'Mi', 'To', 'Se', 'Lu', 'Da', 'Ri', 'Na', 'Ve', 'Jo', 'Ta', 'Ei', 'Bo', 'Si', 'Ha', 'Or', 'Fe', 'Ly', 'Za', 'Ke', 'Ro', 'In', 'Ul', 'Ya', 'Pe', 'Gi', 'Ma'];
const SYL_B = ['ra', 'ni', 'lo', 'ven', 'ka', 'ri', 'mo', 'sa', 'tan', 'lia', 'do', 'rin', 'na', 'ko', 'vi', 'el', 'um', 'ya', 'shi', 'ta', 'ren', 'bo', 'lin', 'ra', 'mi', 'dan'];
const SYL_F = ['', '', '', 'a', 'e', 'is', 'on', 'a', 'i', 'o', 'ah', 'eth'];
function personName(w, sex) { let n = pick(w, SYL_A) + pick(w, SYL_B); if (rnd(w) < .55) n += sex === 'f' ? pick(w, ['a', 'ia', 'e', 'i', 'ah', 'el']) : pick(w, SYL_F); return n; }
function placeName(w) { return pick(w, ['Ash', 'Stone', 'Oak', 'Reed', 'Lake', 'Sun', 'Mist', 'Elder', 'Fern', 'Hollow', 'River', 'Ember']) + pick(w, ['ford', 'vale', 'haven', 'mere', 'fall', 'hearth', 'wick', 'stead', 'reach', 'brook']); }
const TRAITS = ['brave', 'curious', 'kind', 'lazy', 'pious', 'cheerful', 'stubborn', 'gentle', 'greedy', 'skeptical', 'hardworking', 'lonely'];

// -------------------------------------------------------------- world
function createWorld(opt = {}) {
  const seed = (opt.seed ?? Math.floor(Math.random() * 1e9)) | 0;
  const w = {
    seed, rs: seed ^ 0x5bd1e995, t: YEAR * .02, nextId: 0,
    H: new Float32Array(V * V), tile: new Uint8Array(N * N), fert: new Float32Array(N * N), occ: new Int32Array(N * N), road: new Uint8Array(N * N), dWater: new Uint16Array(N * N),
    water: 0, baseWater: 0, trees: [], rocks: [], people: [], dead: new Map(), animals: [], buildings: [], graves: [], fires: [], fx: [], events: [], log: [], prayers: [],
    res: { food: 60, wood: 25, stone: 0, metal: 0, tools: 0 }, age: 0, knowledge: 0, launched: false, center: null, graveyard: null,
    god: { name: opt.godName || 'Ama', mana: 60, unlimited: !!opt.unlimited, deeds: { good: 0, evil: 0, answered: 0, ignored: 0, miracles: 0, killed: 0 }, alignment: 0, title: '' },
    weather: { rain: 0, rx: 0, rz: 0, rr: 0, storm: 0, drought: 0, moist: .6, clouds: .3, snow: 0, wind: .3, dust: 0 },
    stats: { born: 0, died: 0, peak: 0, byCause: {} }, hand: null, tornadoes: [], quake: null, lava: [], plague: 0, locusts: [], incarnate: null,
    pmap: new Map(), bmap: new Map(), villageName: opt.villageName || null, terrainDirty: true, bldDirty: true, roadDirty: true, dayIndex: -1, yearIndex: 0, raidT: YEAR * 30, lastAgeT: 0, nextFish: 60, fish: 60,
  };
  w.occ.fill(-1);
  genTerrain(w); computeWaterDist(w); plantFlora(w);
  foundVillage(w);
  seedAnimals(w);
  logEvent(w, 'age', `A small band settled by the water at ${w.villageName}. They know nothing yet, not even your name.`);
  return w;
}

function flatnessAt(w, cx, cz, R) {
  const h0 = hAt(w, cx, cz); let worst = 0;
  for (let z = -R; z <= R; z += 2) for (let x = -R; x <= R; x += 2) {
    const i = tIdx(cx + x, cz + z); if (i < 0) return 99;
    const t = w.tile[i]; if (isWater(t) || t === TT.ROCK || t === TT.SNOW) return 99;
    worst = Math.max(worst, Math.abs(hAt(w, cx + x, cz + z) - h0));
  }
  return worst;
}
function foundVillage(w) {
  let best = null, bs = -1e9;
  for (let k = 0; k < 900; k++) {
    const x = rr(w, 18, N - 18), z = rr(w, 18, N - 18), i = tIdx(x, z), t = w.tile[i];
    if (t !== TT.GRASS) continue;
    const dw = w.dWater[i]; if (dw < 7 || dw > 16) continue;
    const f = flatnessAt(w, x, z, 12); if (f > 3) continue;
    const sc = -f * 2 - Math.abs(dw - 10) * .4 - hAt(w, x, z) * .5 + rnd(w);
    if (sc > bs) { bs = sc; best = { x, z }; }
  }
  if (!best) best = { x: N / 2, z: N / 2 };
  best.x = Math.round(best.x) + .5; best.z = Math.round(best.z) + .5;
  w.center = best;
  if (!w.villageName) w.villageName = placeName(w);
  // clear trees in the village core and flatten gently
  for (const t of w.trees) if (dist(t.x, t.z, best.x, best.z) < 9) t.dead = true;
  for (const r of w.rocks) if (dist(r.x, r.z, best.x, best.z) < 9) r.dead = true;
  cleanDead(w);
  flatten(w, best.x, best.z, 7, hAt(w, best.x, best.z));
  // plots grid for the town plan
  w.plots = [];
  for (let j = -14; j <= 14; j++) for (let i = -14; i <= 14; i++) {
    const x = best.x + i * 4, z = best.z + j * 4;
    if (x < 4 || z < 4 || x > N - 4 || z > N - 4) continue;
    w.plots.push({ i, j, x, z, d: Math.hypot(i, j * 1.1) + hash2(w.seed, i, j) * .6 });
  }
  w.plots.sort((a, b) => a.d - b.d);
  const fire = placeBuilding(w, 'fire', best.x, best.z, 0, true);
  const cave = findPlot(w, 'cave'); if (cave) placeBuilding(w, 'cave', cave.x, cave.z, 0, true);
  const tent = findPlot(w, 'home'); if (tent) placeBuilding(w, 'home', tent.x, tent.z, 0, true);
  // founders: three families and two loners
  const fams = [];
  for (let f = 0; f < 3; f++) {
    const skin = rnd(w), hair = rnd(w);
    const m = makePerson(w, { sex: 'm', age: rr(w, 22, 38), skin: clamp01(skin + rr(w, -.1, .1)), hair });
    const fe = makePerson(w, { sex: 'f', age: rr(w, 20, 34), skin: clamp01(skin + rr(w, -.15, .15)), hair: rnd(w) });
    marry(w, m, fe, true);
    const kids = 1 + Math.floor(rnd(w) * 3);
    for (let k = 0; k < kids; k++) { const c = makePerson(w, { sex: rnd(w) < .5 ? 'm' : 'f', age: rr(w, 1, 13), parents: [m, fe] }); }
    fams.push(m);
  }
  makePerson(w, { sex: 'f', age: 58, skin: rnd(w) });
  makePerson(w, { sex: 'm', age: rr(w, 17, 24), skin: rnd(w) });
  for (const p of w.people) { p.x = best.x + rr(w, -4, 4); p.z = best.z + rr(w, -4, 4); p.y = hAt(w, p.x, p.z); }
  assignHomes(w);
}

function flatten(w, cx, cz, R, h0) {
  for (let z = Math.floor(cz - R - 2); z <= cz + R + 2; z++) for (let x = Math.floor(cx - R - 2); x <= cx + R + 2; x++) {
    if (x < 0 || z < 0 || x > N || z > N) continue;
    const d = Math.max(Math.abs(x - cx), Math.abs(z - cz)), k = smooth(R + 2, R - .5, d), j = z * V + x;
    if (w.H[j] > w.water + .3 || h0 > w.water) w.H[j] = lerp(w.H[j], Math.max(h0, w.water + .35), k);
  }
  retile(w, cx - R - 3, cz - R - 3, cx + R + 3, cz + R + 3);
}

// -------------------------------------------------------------- people
function makePerson(w, o) {
  const par = o.parents || null, sex = o.sex || (rnd(w) < .5 ? 'm' : 'f');
  const a = par ? par[0] : null, b = par ? par[1] : null;
  const p = {
    id: nid(w), name: o.name || personName(w, sex), sex, born: w.t - (o.age || 0) * YEAR,
    x: o.x ?? (a ? a.x : w.center.x), z: o.z ?? (a ? a.z : w.center.z), y: 0, dir: rr(w, 0, 6.28), vy: 0, fly: null,
    skin: o.skin ?? (a && b ? clamp01((a.skin + b.skin) / 2 + rr(w, -.08, .08)) : rnd(w)),
    hair: o.hair ?? (a && b ? (rnd(w) < .5 ? a.hair : b.hair) : rnd(w)), hairStyle: Math.floor(rnd(w) * 4), height: rr(w, .92, 1.08), shirt: rnd(w),
    parents: par ? [a.id, b.id] : [], spouse: 0, kids: [], home: 0, fam: a ? a.fam : 0,
    job: 'none', task: null, act: 'idle', actT: 0, carry: null, path: null, think: rnd(w) * 2,
    hunger: 1, health: 1, sick: 0, injured: 0, faith: o.faith ?? (a ? (a.faith + b.faith) / 2 : rr(w, .25, .55)), love: a ? (a.love + b.love) / 2 * .6 : 0, fear: a ? (a.fear + b.fear) / 2 * .5 : 0,
    mood: .7, traits: [], thoughts: [], mem: [], gifts: {}, prophet: false, alive: true, faction: o.faction || 'village', pregnant: 0, say: null, grief: 0, lastKid: -1e9, speedMul: 1, kills: 0, deeds: [],
  };
  const tr = TRAITS.slice(); for (let k = 0; k < 2; k++) p.traits.push(tr.splice(Math.floor(rnd(w) * tr.length), 1)[0]);
  if (!p.fam) p.fam = p.id;
  if (par) { a.kids.push(p.id); b.kids.push(p.id); p.home = a.home || b.home; }
  p.y = hAt(w, p.x, p.z);
  w.pmap.set(p.id, p);
  if (p.faction === 'village') w.people.push(p);
  return p;
}
const ageOf = (w, p) => (w.t - p.born) / YEAR;
const isChild = (w, p) => ageOf(w, p) < 14;
const isElder = (w, p) => ageOf(w, p) >= 58;
const personById = (w, id) => (id && w.pmap.get(id)) || null;
const living = w => w.people.filter(p => p.alive);
function famName(w, p) { if (w.age < 3) return ''; const f = personById(w, p.fam); return f ? f.name : ''; }
function fullName(w, p) { const f = famName(w, p); return f && f !== p.name ? `${p.name} of House ${f}` : p.name; }

function marry(w, a, b, quiet) {
  a.spouse = b.id; b.spouse = a.id;
  const m = a.sex === 'm' ? a : b, f = m === a ? b : a;
  if (!quiet) {
    f.fam = m.fam || m.id;
    think(w, a, `Married ${b.name}`, 3); think(w, b, `Married ${a.name}`, 3);
    logEvent(w, 'life', `${a.name} and ${b.name} were married.`, { x: a.x, z: a.z });
    event(w, 'wedding', { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
    say(w, a, pick(w, [`I will love you until the stars go out, ${b.name}.`, `${w.god.name} brought us together.`, 'Today is the happiest day of my life.']));
  }
  const home = (w.buildings.find(h => h.id === m.home) || w.buildings.find(h => h.id === f.home));
  if (home && occupants(w, home) < capOf(w, home)) { a.home = b.home = home.id; }
  else { a.home = b.home = 0; }
}
function think(w, p, text, v = 1) { p.thoughts.unshift({ text, y: Math.floor(ageOf(w, p)), v }); if (p.thoughts.length > 8) p.thoughts.pop(); }
function remember(w, p, text, v) { p.mem.unshift({ text, year: w.yearIndex, v }); if (p.mem.length > 10) p.mem.pop(); }
function say(w, p, text, dur = 5) { p.say = { text, until: w.t + dur * (w.speedHint || 1) }; }

// -------------------------------------------------------------- buildings
const BT = {
  fire: { size: 3, name: 'Campfire', from: 0 },
  cave: { size: 3, name: 'Cave', from: 0, cap: 8 },
  home: { size: 3, name: 'Home', from: 0 },
  store: { size: 3, name: 'Storehouse', from: 1 },
  shrine: { size: 3, name: 'Shrine', from: 0 },
  temple: { size: 7, name: 'Temple', from: 2 },
  field: { size: 7, name: 'Field', from: 1 },
  pen: { size: 3, name: 'Animal pen', from: 1 },
  workshop: { size: 3, name: 'Workshop', from: 2 },
  market: { size: 7, name: 'Market', from: 2 },
  statue: { size: 3, name: 'Statue of the god', from: 2 },
  school: { size: 3, name: 'School', from: 3 },
  dock: { size: 3, name: 'Dock', from: 3 },
  castle: { size: 7, name: 'Castle', from: 4 },
  mill: { size: 3, name: 'Windmill', from: 4 },
  factory: { size: 7, name: 'Factory', from: 5 },
  clock: { size: 3, name: 'Clock tower', from: 5 },
  hospital: { size: 7, name: 'Hospital', from: 6 },
  stadium: { size: 7, name: 'Stadium', from: 6 },
  park: { size: 3, name: 'Park', from: 6 },
  rocket: { size: 7, name: 'Launch pad', from: 6 },
};
const HOME_CAP = [5, 5, 6, 6, 7, 10, 16];
const COST = {
  home: [[10, 0, 0], [12, 0, 0], [12, 6, 0], [10, 12, 0], [16, 12, 0], [10, 20, 2], [8, 30, 6]],
  store: [[10, 0, 0], [15, 0, 0], [15, 8, 0], [15, 15, 0], [20, 15, 0], [15, 25, 4], [10, 30, 8]],
  shrine: [[6, 4, 0]], temple: [[20, 30, 2], [20, 30, 2], [25, 40, 4], [30, 50, 6], [30, 60, 10], [30, 60, 14], [20, 70, 20]],
  field: [[4, 0, 0]], pen: [[10, 0, 0]], workshop: [[12, 12, 0]], market: [[20, 15, 2]], statue: [[0, 30, 4]], school: [[15, 20, 2]],
  dock: [[20, 4, 0]], castle: [[20, 80, 10]], mill: [[20, 10, 2]], factory: [[20, 40, 20]], clock: [[10, 30, 8]], hospital: [[10, 40, 15]], stadium: [[20, 60, 20]], park: [[6, 0, 0]], rocket: [[10, 40, 60]],
};
function costOf(type, age) { const c = COST[type] || [[10, 0, 0]]; const v = c[Math.min(age, c.length - 1)]; return { wood: v[0], stone: v[1], metal: v[2] }; }
function canAfford(w, c) { return w.res.wood >= c.wood && w.res.stone >= c.stone && w.res.metal >= c.metal; }
function pay(w, c) { w.res.wood -= c.wood; w.res.stone -= c.stone; w.res.metal -= c.metal; }
function capOf(w, b) { if (b.type === 'cave') return 8; if (b.type !== 'home') return 0; return HOME_CAP[b.style] * (b.big ? 2 : 1); }
function occupants(w, b) { let n = 0; for (const p of w.people) if (p.alive && p.home === b.id) n++; return n; }
const bById = (w, id) => (id >= 0 && w.bmap.get(id)) || null;

function plotFree(w, x, z, size) {
  const r = (size - 1) / 2 + .5;
  for (let zz = Math.floor(z - r); zz < z + r; zz++) for (let xx = Math.floor(x - r); xx < x + r; xx++) {
    const i = tIdx(xx, zz); if (i < 0) return false;
    const t = w.tile[i]; if (isWater(t) || t === TT.ROCK || t === TT.SNOW || w.occ[i] >= 0) return false;
  }
  return flatnessAt(w, x, z, Math.ceil(r)) < 3.2;
}
function findPlot(w, type) {
  const size = BT[type].size;
  if (type === 'field') return findFieldSpot(w);
  if (type === 'dock') return findDockSpot(w);
  for (const pl of w.plots) {
    if (pl.used) continue;
    let x = pl.x, z = pl.z;
    if (size === 7) { x += 2; z += 2; const nb = [pl, plotAt(w, pl.i + 1, pl.j), plotAt(w, pl.i, pl.j + 1), plotAt(w, pl.i + 1, pl.j + 1)]; if (nb.some(q => !q || q.used)) continue; }
    if (pl.d < 1.5 && type !== 'fire' && type !== 'cave' && size === 7) continue;
    if (plotFree(w, x, z, size)) return { x, z, plots: size === 7 ? [pl, plotAt(w, pl.i + 1, pl.j), plotAt(w, pl.i, pl.j + 1), plotAt(w, pl.i + 1, pl.j + 1)] : [pl] };
  }
  return null;
}
function plotAt(w, i, j) { return w.plots.find(p => p.i === i && p.j === j) || null; }
function findFieldSpot(w) {
  let best = null, bs = 1e9;
  for (let k = 0; k < 160; k++) {
    const a = rr(w, 0, 6.28), d = rr(w, 16, 34), x = Math.round(w.center.x + Math.cos(a) * d) + .5, z = Math.round(w.center.z + Math.sin(a) * d) + .5;
    if (!plotFree(w, x, z, 7)) continue;
    let ok = true; for (let zz = -3; zz <= 3 && ok; zz++) for (let xx = -3; xx <= 3; xx++) { const t = w.tile[tIdx(x + xx, z + zz)]; if (t !== TT.GRASS && t !== TT.JUNGLE && t !== TT.SAND) { ok = false; break; } }
    if (!ok) continue;
    const sc = d + flatnessAt(w, x, z, 3) * 3;
    if (sc < bs) { bs = sc; best = { x, z, plots: [] }; }
  }
  return best;
}
function findDockSpot(w) {
  let best = null, bs = 1e9;
  for (let k = 0; k < 400; k++) {
    const a = rr(w, 0, 6.28), d = rr(w, 6, 40), x = Math.round(w.center.x + Math.cos(a) * d) + .5, z = Math.round(w.center.z + Math.sin(a) * d) + .5, i = tIdx(x, z);
    if (i < 0 || w.tile[i] !== TT.SAND || w.occ[i] >= 0) continue;
    // needs deep water nearby
    let wx = 0, wz = 0, n = 0; for (let q = 0; q < 12; q++) { const qa = q / 12 * 6.28, qx = x + Math.cos(qa) * 3, qz = z + Math.sin(qa) * 3; if (deep(w, qx, qz)) { wx += Math.cos(qa); wz += Math.sin(qa); n++; } }
    if (n < 2) continue;
    if (d < bs) { bs = d; best = { x, z, rot: Math.atan2(wz, wx), plots: [] }; }
  }
  return best;
}

function placeBuilding(w, type, x, z, rot = 0, instant = false, spot = null) {
  const size = BT[type].size;
  const b = { id: nid(w), type, x, z, rot: spot?.rot ?? rot, size, progress: instant ? 1 : 0, style: w.age, hp: 1, fire: 0, ruin: 0, upg: false, built: instant ? w.t : 0, crop: 0, stock: 0, planted: false, work: 0, align: w.god.alignment, name: '' };
  if (type === 'field') b.rot = 0;
  if (type === 'home' && w.age >= 6) b.big = true;
  if (spot && spot.plots) { for (const pl of spot.plots) if (pl) pl.used = b.id; }
  else { const pl = w.plots.find(q => q.x === x && q.z === z); if (pl) pl.used = b.id; }
  const r = (size - 1) / 2 + .5;
  if (type !== 'dock') flatten(w, x, z, Math.ceil(r), hAt(w, x, z));
  for (let zz = Math.floor(z - r); zz < z + r; zz++) for (let xx = Math.floor(x - r); xx < x + r; xx++) { const i = tIdx(xx, zz); if (i >= 0) w.occ[i] = b.id; }
  for (const t of w.trees) if (!t.dead && Math.abs(t.x - x) < r + .6 && Math.abs(t.z - z) < r + .6) t.dead = true;
  for (const q of w.rocks) if (!q.dead && Math.abs(q.x - x) < r + .6 && Math.abs(q.z - z) < r + .6) q.dead = true;
  cleanDead(w);
  if (type !== 'field' && type !== 'dock' && type !== 'cave') layRoads(w, x, z, r);
  w.buildings.push(b); w.bmap.set(b.id, b); w.bldDirty = true;
  if (type === 'pen') for (let k = 0; k < 4; k++) addAnimal(w, w.age >= 2 && k % 2 ? 'cow' : 'sheep', x + rr(w, -1, 1), z + rr(w, -1, 1), { pen: b.id });
  if (type === 'temple' || type === 'shrine' || type === 'statue') b.align = w.god.alignment;
  return b;
}
function layRoads(w, x, z, r) {
  const z0 = Math.floor(z - r - 1), z1 = Math.floor(z + r), x0 = Math.floor(x - r - 1), x1 = Math.floor(x + r);
  for (let zz = z0; zz <= z1; zz++) for (let xx = x0; xx <= x1; xx++) {
    const onRing = zz === z0 || zz === z1 || xx === x0 || xx === x1;
    if (!onRing) continue; const i = tIdx(xx, zz); if (i < 0 || isWater(w.tile[i]) || w.occ[i] >= 0) continue;
    w.road[i] = 1;
    for (const t of w.trees) if (!t.dead && (t.x | 0) === xx && (t.z | 0) === zz) t.dead = true;
  }
  w.roadDirty = true;
}
function removeBuilding(w, b, cause) {
  const r = (b.size - 1) / 2 + .5;
  for (let zz = Math.floor(b.z - r); zz < b.z + r; zz++) for (let xx = Math.floor(b.x - r); xx < b.x + r; xx++) { const i = tIdx(xx, zz); if (i >= 0 && w.occ[i] === b.id) w.occ[i] = -1; }
  for (const pl of w.plots) if (pl.used === b.id) pl.used = 0;
  w.buildings = w.buildings.filter(q => q !== b); w.bmap.delete(b.id); b.removed = true;
  for (const p of w.people) if (p.home === b.id) p.home = 0;
  for (const a of w.animals) if (a.pen === b.id) a.pen = 0;
  w.bldDirty = true;
}
function damageBuilding(w, b, amt, cause) {
  if (b.ruin || b.type === 'fire' || b.type === 'field') { if (b.type === 'field') { b.crop *= .3; b.stock *= .3; } return; }
  b.hp -= amt;
  if (b.hp <= 0) {
    b.ruin = w.t; b.fire = 0; w.bldDirty = true;
    event(w, 'collapse', { x: b.x, z: b.z, size: b.size });
    logEvent(w, 'destroy', `The ${bName(w, b)} was destroyed by ${cause}.`, { x: b.x, z: b.z });
    for (const p of living(w)) if (dist(p.x, p.z, b.x, b.z) < b.size * .6 && p.act === 'sleep') hurt(w, p, .7, cause === 'fire' ? 'burned in their home' : 'crushed when their home fell');
  }
}
function bName(w, b) {
  const t = b.type;
  if (t === 'home') return ['tent', 'round hut', 'mud-brick house', 'stone house', 'timber house', 'brick house', 'apartment tower'][b.style];
  if (t === 'fire') return ['campfire', 'fire pit', 'town well', 'forum', 'market cross', 'fountain', 'plaza'][b.style];
  if (t === 'temple') return b.align < -.25 ? ['altar', 'dark ziggurat', 'dark ziggurat', 'temple of fear', 'black cathedral', 'black cathedral', 'obsidian spire'][b.style] : ['shrine', 'sun temple', 'ziggurat', 'temple', 'cathedral', 'cathedral', 'glass temple'][b.style];
  if (t === 'store') return ['stockpile', 'granary', 'granary', 'storehouse', 'warehouse', 'warehouse', 'supermarket'][b.style];
  if (t === 'shrine') return b.align < -.25 ? 'bone totem' : 'totem';
  return BT[t].name.toLowerCase();
}

// -------------------------------------------------------------- animals
const AK = {
  deer: { hp: 1, speed: 3.4, food: 6, max: 24, flee: 9, size: 1 },
  boar: { hp: 2, speed: 3.0, food: 6, max: 12, flee: 5, size: .8, fights: true },
  wolf: { hp: 2, speed: 3.9, food: 3, max: 7, size: .8, predator: true },
  mammoth: { hp: 7, speed: 1.9, food: 30, max: 6, flee: 4, size: 2.2, fights: true },
  sheep: { hp: 1, speed: 1.4, food: 4, max: 60, size: .7, domestic: true },
  cow: { hp: 2, speed: 1.2, food: 8, max: 60, size: 1.1, domestic: true },
  dog: { hp: 2, speed: 3.6, food: 0, max: 10, size: .6, domestic: true },
  bird: { hp: 1, speed: 5, food: 0, max: 0, size: .4 },
};
function addAnimal(w, kind, x, z, o = {}) {
  const a = { id: nid(w), kind, x, z, y: hAt(w, x, z), dir: rr(w, 0, 6.28), hp: AK[kind].hp, st: 'wander', t: 0, tx: x, tz: z, born: w.t - rr(w, 1, 5) * YEAR, alive: true, pen: o.pen || 0, owner: o.owner || 0, fly: null, spd: 0, target: 0, herd: o.herd || 0, anim: rnd(w) * 10 };
  w.animals.push(a); return a;
}
function spotFor(w, tiles, near) {
  for (let k = 0; k < 400; k++) {
    const x = near ? near.x + rr(w, -8, 8) : rr(w, 6, N - 6), z = near ? near.z + rr(w, -8, 8) : rr(w, 6, N - 6);
    const t = tileAt(w, x, z);
    if (tiles.includes(t) && dist(x, z, w.center.x, w.center.z) > 22) return { x, z };
  }
  return null;
}
function seedAnimals(w) {
  const herd = (kind, tiles, groups, per) => { for (let g = 0; g < groups; g++) { const c = spotFor(w, tiles); if (!c) continue; const lead = addAnimal(w, kind, c.x, c.z); for (let k = 1; k < per; k++) addAnimal(w, kind, c.x + rr(w, -2, 2), c.z + rr(w, -2, 2), { herd: lead.id }); } };
  herd('deer', [TT.GRASS], 4, 5);
  herd('boar', [TT.JUNGLE, TT.FOREST], 3, 3);
  herd('wolf', [TT.FOREST, TT.ROCK], 2, 3);
  herd('mammoth', [TT.GRASS, TT.FOREST], 1, 4);
  const p = w.people[0]; addAnimal(w, 'dog', p.x + 1, p.z + 1, { owner: p.id });
}

// -------------------------------------------------------------- events & chronicle
function event(w, type, o = {}) { w.events.push({ type, ...o, t: w.t }); if (w.events.length > 400) w.events.shift(); }
function logEvent(w, type, text, o = {}) { w.log.unshift({ year: w.yearIndex, season: seasonOf(w), type, text, ...o }); if (w.log.length > 300) w.log.pop(); event(w, 'log', { kind: type, text, ...o }); }
const seasonOf = w => Math.floor((w.t % YEAR) / DAY);
const hourOf = w => ((w.t % DAY) / DAY) * 24;
const isNight = w => { const h = hourOf(w); return h < 5.5 || h > 20.5; };

// -------------------------------------------------------------- god perception
function witnesses(w, x, z, R) { return living(w).filter(p => dist(p.x, p.z, x, z) < R); }
function feel(w, x, z, R, love, fear, faith, memText) {
  for (const p of witnesses(w, x, z, R)) {
    const k = 1 - dist(p.x, p.z, x, z) / R * .5, pi = p.traits.includes('pious') ? 1.4 : p.traits.includes('skeptical') ? .6 : 1;
    p.love = clamp(p.love + love * k, -1, 1); p.fear = clamp01(p.fear + fear * k); p.faith = clamp01(p.faith + faith * k * pi);
    if (memText && (Math.abs(love) > .04 || fear > .04)) remember(w, p, memText, love - fear);
  }
}
function godDeed(w, good, evil) { w.god.deeds.good += good; w.god.deeds.evil += evil; }
function villageMood(w) {
  const ps = living(w).filter(p => !isChild(w, p)); if (!ps.length) return { love: 0, fear: 0, faith: 0, mood: 0 };
  let l = 0, f = 0, fa = 0, m = 0; for (const p of ps) { l += p.love; f += p.fear; fa += p.faith; m += p.mood; }
  return { love: l / ps.length, fear: f / ps.length, faith: fa / ps.length, mood: m / ps.length };
}
function godTitle(w) {
  const v = villageMood(w), d = w.god.deeds;
  if (v.faith < .12) return 'the Forgotten';
  if (v.love > .45 && v.fear < .3) return d.answered > 8 ? 'the Listener' : 'the Merciful';
  if (v.love > .25 && v.fear > .35) return 'the Stern Parent';
  if (v.fear > .55 && v.love < -.1) return w.stats.byCause.lightning > 4 ? 'the Stormbringer' : 'the Terrible';
  if (v.fear > .4) return 'the Feared';
  if (v.love > .2) return 'the Kind';
  if (v.faith < .3) return 'the Silent';
  return 'the Unknown';
}

// -------------------------------------------------------------- prayers
const PRAYER_TEXT = {
  rain: ['O {G}, the rain has not come and the crops are dying.', 'Send us rain, {G}. The earth is cracking.'],
  food: ['{G}, our children are hungry. Please, give us food.', 'The stores are empty, {G}. Do not let us starve.'],
  heal: ['{G}, {T} is sick. Heal them, I beg you.', 'Please, {G}, take this fever away from {T}.'],
  fire: ['Fire! {G}, put out the fire!', '{G}, send rain before our homes burn!'],
  protect: ['{G}, wolves are circling us! Protect us!', 'Raiders are coming, {G}! Strike them down!'],
  child: ['{G}, we have prayed for a child for so long.', 'Bless us with a baby, {G}. It is all we want.'],
  revive: ['{G}, give me back my {T}. Please.', 'Why did you take {T} from me, {G}?'],
  wisdom: ['{G}, show me how the world works.', 'Grant me wisdom, {G}, so I can teach the others.'],
  sign: ['{G}, show us you are there. Give us a sign.', 'The young ones doubt you, {G}. Show yourself.'],
  love: ['{G}, I am so lonely. Send me someone to love.', 'Is there no one for me, {G}?'],
  mercy: ['{G}, forgive us! We will bring more offerings!', 'Spare us from your anger, {G}!'],
  hunt: ['Send us game, {G}. The deer have fled.', '{G}, guide my spear today.'],
  harvest: ['{G}, bless our fields this year.', 'Let the seeds grow tall, {G}.'],
  winter: ['Winter is coming and the stores are thin, {G}.', '{G}, do not let us go hungry this winter.'],
  safe: ['Watch over my little {T}, {G}.', '{G}, keep {T} safe. They are so small.'],
  family: ['Bless my family, {G}. Keep us together.', '{G}, give my family health and a full belly.', 'Thank you for this day, {G}. Watch over us.', 'Let the children grow strong, {G}.'],
};
const PRAYER_POWER = { rain: 'rain', food: 'harvest', heal: 'heal', fire: 'rain', protect: 'lightning', child: 'fertility', revive: 'resurrect', wisdom: 'inspire', sign: 'sign', love: 'bless', mercy: 'bless', hunt: 'spawn', harvest: 'rain', winter: 'harvest', safe: 'bless', family: 'heal' };
function addPrayer(w, p, kind, o = {}) {
  if (!p || !p.alive || w.prayers.some(q => !q.done && (q.pid === p.id || (q.kind === kind && !['heal', 'revive', 'child', 'love', 'safe', 'wisdom'].includes(kind))))) return null;
  if (w.prayers.filter(q => !q.done).length >= 6) return null;
  const tname = o.tname || '';
  const text = pick(w, PRAYER_TEXT[kind]).replace(/\{G\}/g, w.god.name).replace(/\{T\}/g, tname);
  const pr = { id: nid(w), kind, pid: p.id, text, x: p.x, z: p.z, t0: w.t, until: w.t + (o.dur || DAY * 2), done: false, target: o.target || 0, power: PRAYER_POWER[kind] };
  w.prayers.push(pr);
  say(w, p, text, 8); p.act = 'pray'; p.actT = 3;
  event(w, 'prayer', { id: pr.id, x: p.x, z: p.z, text });
  return pr;
}
function answer(w, kind, x, z, R, targetId) {
  let n = 0;
  for (const pr of w.prayers) {
    if (pr.done || pr.kind !== kind) continue;
    if (targetId && pr.target && pr.target !== targetId) continue;
    const p = personById(w, pr.pid);
    if (!targetId && x != null && p && dist(p.x, p.z, x, z) > R && dist(pr.x, pr.z, x, z) > R) continue;
    pr.done = 'answered'; n++;
    w.god.deeds.answered++; godDeed(w, 1, 0);
    if (p && p.alive) {
      p.love = clamp(p.love + .35, -1, 1); p.faith = clamp01(p.faith + .3); p.fear = clamp01(p.fear - .05);
      remember(w, p, `${w.god.name} answered my prayer`, 1); think(w, p, `${w.god.name} heard me!`, 3);
      say(w, p, pick(w, [`Thank you, ${w.god.name}!`, `${w.god.name} heard me! ${w.god.name} is real!`, `Praise ${w.god.name}!`]));
      feel(w, p.x, p.z, 20, .06, 0, .06);
    }
    logEvent(w, 'bless', `You answered ${p ? p.name : 'a'}'s prayer${pr.kind === 'rain' ? ' for rain' : pr.kind === 'food' ? ' for food' : pr.kind === 'heal' ? ' for healing' : ''}.`, { x: pr.x, z: pr.z });
    event(w, 'answered', { id: pr.id, x: pr.x, z: pr.z });
  }
  return n;
}
function updatePrayers(w) {
  for (const pr of w.prayers) {
    if (pr.done) continue;
    const p = personById(w, pr.pid);
    if (!p || !p.alive) { pr.done = 'gone'; continue; }
    // auto-resolve when the problem went away on its own
    if (pr.kind === 'heal') { const t = personById(w, pr.target); if (!t || !t.alive || (!t.sick && !t.injured)) { pr.done = 'gone'; continue; } }
    if (pr.kind === 'fire' && !w.fires.some(f => dist(f.x, f.z, w.center.x, w.center.z) < 34)) { pr.done = 'gone'; continue; }
    if (pr.kind === 'protect' && !threatNear(w)) { pr.done = 'gone'; continue; }
    if (w.t > pr.until) {
      pr.done = 'ignored'; w.god.deeds.ignored++;
      p.faith = clamp01(p.faith - .12); p.love = clamp(p.love - .08, -1, 1);
      remember(w, p, `${w.god.name} ignored my prayer`, -1); think(w, p, `Does ${w.god.name} even hear us?`, -2);
      if (rnd(w) < .5) say(w, p, pick(w, [`Where were you, ${w.god.name}?`, 'Nobody is listening up there.', 'Maybe there is no god at all.']));
    }
  }
  if (w.prayers.length > 40) w.prayers = w.prayers.filter(q => !q.done || w.t - q.t0 < DAY * 3);
}
function threatNear(w) {
  const c = w.center;
  if ((w.raiders || []).some(r => r.alive && dist(r.x, r.z, c.x, c.z) < 40)) return true;
  return w.animals.some(a => a.alive && a.kind === 'wolf' && a.st === 'hunt' && a.targetKind === 'p' && dist(a.x, a.z, c.x, c.z) < 34);
}

// -------------------------------------------------------------- death & harm
function hurt(w, p, amt, cause, byGod) {
  if (!p.alive) return;
  if (p.gifts.immortal) { if (amt > .3) { p.act = 'fallen'; p.actT = 1.5; say(w, p, pick(w, ['I cannot die!', `${w.god.name} protects me!`, 'Is that all?'])); } return; }
  p.health -= amt * (p.gifts.strong ? .5 : 1);
  if (p.health <= 0) die(w, p, cause, byGod);
  else if (amt > .2) { p.injured = Math.max(p.injured, amt); }
}
function die(w, p, cause, byGod) {
  if (!p.alive) return;
  if (p.gifts.immortal) return;
  p.alive = false; p.died = w.t; p.cause = cause; p.act = 'dead';
  if (p.faction === 'raider') { event(w, 'death', { x: p.x, z: p.z, id: p.id, raider: true }); return; }
  w.stats.died++; const key = byGod || cause; w.stats.byCause[key] = (w.stats.byCause[key] || 0) + 1;
  w.people = w.people.filter(q => q !== p); w.dead.set(p.id, p);
  if (p.task && p.task.b) { /* nothing */ }
  const sp = personById(w, p.spouse); if (sp && sp.alive) { sp.spouse = 0; sp.widow = p.id; sp.grief = 1; think(w, sp, `Mourning ${p.name}`, -3); }
  for (const id of p.parents) { const q = personById(w, id); if (q && q.alive) { q.grief = 1; q.lostKid = { id: p.id, t: w.t }; think(w, q, `Lost my child ${p.name}`, -4); } }
  for (const id of p.kids) { const q = personById(w, id); if (q && q.alive) { q.grief = Math.max(q.grief, .7); think(w, q, `My ${p.sex === 'm' ? 'father' : 'mother'} is gone`, -3); } }
  const age = Math.floor(ageOf(w, p));
  logEvent(w, 'death', `${fullName(w, p)} ${cause} at ${age}.`, { x: p.x, z: p.z, pid: p.id });
  event(w, 'death', { x: p.x, z: p.z, id: p.id });
  if (byGod) { feel(w, p.x, p.z, 26, -.14, .22, .08, `${w.god.name} killed ${p.name}`); godDeed(w, 0, 1.5); w.god.deeds.killed++; }
  if (w.hand && w.hand.kind === 'p' && w.hand.id === p.id) w.hand = null;
  if (w.incarnate === p.id) { w.incarnate = null; event(w, 'incarnDeath', { id: p.id }); }
  if (cause !== 'vanished') makeGrave(w, p);
}
function makeGrave(w, p) {
  if (!w.graveyard) {
    let best = null;
    for (let k = 0; k < 200; k++) { const a = rr(w, 0, 6.28), d = rr(w, 13, 22), x = w.center.x + Math.cos(a) * d, z = w.center.z + Math.sin(a) * d; const i = tIdx(x, z); if (i < 0 || w.tile[i] !== TT.GRASS || w.occ[i] >= 0 || w.road[i]) continue; if (flatnessAt(w, x, z, 3) < 1.2) { best = { x, z }; break; } }
    w.graveyard = best || { x: w.center.x + 14, z: w.center.z + 12 };
  }
  const n = w.graves.length, gx = w.graveyard.x + ((n % 6) - 2.5) * 1.1, gz = w.graveyard.z + (Math.floor(n / 6) % 8 - 3.5) * 1.2;
  w.graves.push({ id: nid(w), pid: p.id, x: gx, z: gz, year: w.yearIndex, name: p.name, age: w.age });
  if (w.graves.length > 48) w.graves.shift();
}

// -------------------------------------------------------------- jobs
const JOB_INFO = {
  none: 'Idle', child: 'Child', elder: 'Elder', gatherer: 'Gatherer', hunter: 'Hunter', woodcutter: 'Woodcutter', builder: 'Builder', farmer: 'Farmer', fisher: 'Fisher',
  stonecutter: 'Stonecutter', miner: 'Miner', priest: 'Priest', scholar: 'Scholar', smith: 'Smith', guard: 'Guard', merchant: 'Merchant', worker: 'Factory worker', doctor: 'Doctor',
};
function assignJobs(w) {
  const ps = living(w);
  const adults = ps.filter(p => !isChild(w, p) && !isElder(w, p) && w.incarnate !== p.id);
  for (const p of ps) { if (isChild(w, p)) p.job = 'child'; else if (isElder(w, p)) p.job = 'elder'; }
  const has = t => w.buildings.filter(b => b.type === t && b.progress >= 1 && !b.ruin).length;
  const sites = w.buildings.filter(b => (b.progress < 1 || b.upg) && !b.ruin).length;
  const pop = ps.length, A = adults.length, want = {};
  want.builder = sites ? Math.min(Math.ceil(A * .22), sites * 3) : 0;
  want.priest = has('temple') ? Math.min(2, has('temple')) : has('shrine') ? 1 : 0;
  want.scholar = w.age >= 3 ? has('school') * 3 : 0;
  want.smith = w.age >= 2 ? Math.min(has('workshop') * 2, Math.ceil(A * .08)) : 0;
  want.guard = w.age >= 3 ? Math.ceil(A * .06) + ((w.raiders || []).some(r => r.alive) ? 3 : 0) : 0;
  want.merchant = has('market');
  want.worker = has('factory') * 4;
  want.doctor = has('hospital') * 2;
  want.woodcutter = Math.ceil(A * (w.age >= 5 ? .1 : .16));
  want.stonecutter = w.age >= 1 ? Math.ceil(A * .1) : 0;
  want.miner = w.age >= 2 ? Math.ceil(A * .08) : 0;
  const fields = has('field');
  want.farmer = fields * 2;
  want.fisher = w.fish > 10 ? Math.min(w.age >= 3 ? 4 : 2, Math.ceil(A * .1)) : 0;
  want.hunter = w.age <= 2 ? Math.min(3, Math.ceil(A * .15)) : 0;
  // food: make sure enough people feed the village
  const producing = w.buildings.filter(b => b.type === 'field' && b.progress >= 1 && (b.planted || b.stock > 0)).length;
  const foodJobs = Math.min(want.farmer, producing * 2) * 1.5 + want.fisher + want.hunter;
  want.gatherer = Math.max(0, Math.ceil(pop * (w.age >= 5 ? .12 : .24) - foodJobs));
  if (w.res.food < pop * 6) want.gatherer += Math.ceil(A * .15);
  const order = ['builder', 'gatherer', 'farmer', 'priest', 'hunter', 'fisher', 'woodcutter', 'stonecutter', 'miner', 'smith', 'guard', 'scholar', 'merchant', 'worker', 'doctor'];
  if (w.res.food < pop * 2.5) { const extra = Math.ceil(A * .3); want.gatherer += extra; want.builder = Math.min(want.builder, 1); want.stonecutter = 0; want.miner = 0; want.scholar = 0; want.hunter += 2; want.fisher += 2; }
  const count = {}; for (const k of order) count[k] = 0;
  for (const p of adults) if (count[p.job] !== undefined && count[p.job] < (want[p.job] || 0)) count[p.job]++; else p.job = 'none';
  for (const p of adults) {
    if (p.job !== 'none') continue;
    let j = order.find(k => count[k] < (want[k] || 0));
    if (!j) j = w.age >= 1 && rnd(w) < .5 ? 'woodcutter' : 'gatherer';
    if (p.prophet) j = 'priest';
    p.job = j; count[j] = (count[j] || 0) + 1; p.task = null;
  }
}

// -------------------------------------------------------------- planner
function planBuildings(w) {
  const ps = living(w), pop = ps.length;
  const active = w.buildings.filter(b => (b.progress < 1 || b.upg) && !b.ruin).length;
  const maxSites = 1 + Math.floor(pop / 25);
  // clear ruins
  for (const b of w.buildings.slice()) if (b.ruin && w.t - b.ruin > DAY * 3) removeBuilding(w, b);
  if (active >= maxSites) return;
  const cnt = t => w.buildings.filter(b => b.type === t && !b.ruin).length;
  const cap = w.buildings.reduce((s, b) => s + (b.ruin ? 0 : capOf(w, b)), 0);
  const tryBuild = type => {
    if (BT[type].from > w.age) return false;
    const c = costOf(type, w.age); if (!canAfford(w, c)) return false;
    const spot = findPlot(w, type); if (!spot) return false;
    pay(w, c); const b = placeBuilding(w, type, spot.x, spot.z, spot.rot || 0, false, spot);
    if (type === 'temple' || type === 'castle' || type === 'stadium' || type === 'statue' || type === 'rocket') logEvent(w, 'build', `The people began building a ${bName(w, b)}${type === 'statue' ? ' in your image' : ''}.`, { x: b.x, z: b.z });
    return true;
  };
  const homeless = ps.filter(p => !p.home).length;
  if (cap < pop + 3 || homeless > 3) { if (tryBuild('home')) return; }
  const v = villageMood(w);
  if (w.age >= 1 && cnt('field') < Math.ceil(pop / 9) && tryBuild('field')) return;
  if (w.age >= 1 && cnt('store') < 1 + Math.floor(pop / 45) && tryBuild('store')) return;
  if (cnt('shrine') < 1 && v.faith > .3 && w.age < 2 && tryBuild('shrine')) return;
  if (w.age >= 2 && cnt('temple') < 1 && tryBuild('temple')) return;
  if (w.age >= 1 && cnt('pen') < 1 + Math.floor(pop / 60) && tryBuild('pen')) return;
  if (w.age >= 2 && cnt('workshop') < 1 + Math.floor(pop / 50) && tryBuild('workshop')) return;
  if (w.age >= 2 && cnt('market') < 1 && pop > 30 && tryBuild('market')) return;
  if (w.age >= 2 && cnt('statue') < 1 && v.faith > .45 && tryBuild('statue')) return;
  if (w.age >= 3 && cnt('school') < 1 + Math.floor(pop / 60) && tryBuild('school')) return;
  if (w.age >= 3 && cnt('dock') < 1 && tryBuild('dock')) return;
  if (w.age >= 4 && cnt('castle') < 1 && tryBuild('castle')) return;
  if (w.age >= 4 && cnt('mill') < Math.ceil(cnt('field') / 3) && tryBuild('mill')) return;
  if (w.age >= 5 && cnt('factory') < 2 && tryBuild('factory')) return;
  if (w.age >= 5 && cnt('clock') < 1 && tryBuild('clock')) return;
  if (w.age >= 6 && cnt('hospital') < 1 && tryBuild('hospital')) return;
  if (w.age >= 6 && cnt('park') < 2 && tryBuild('park')) return;
  if (w.age >= 6 && cnt('stadium') < 1 && pop > 90 && tryBuild('stadium')) return;
  if (w.age >= 6 && cnt('rocket') < 1 && w.knowledge > LAUNCH_K * .75 && tryBuild('rocket')) return;
  if (cap < pop + 8 && tryBuild('home')) return;
  // renovate old buildings into the style of the new age
  if (active < maxSites) {
    const old = w.buildings.filter(b => !b.ruin && !b.upg && b.progress >= 1 && b.style < w.age && b.type !== 'field' && b.type !== 'cave' && b.type !== 'shrine' && b.type !== 'pen').sort((a, b) => dist(a.x, a.z, w.center.x, w.center.z) - dist(b.x, b.z, w.center.x, w.center.z));
    if (old.length) {
      const b = old[0], c = costOf(b.type, w.age), half = { wood: c.wood * .5, stone: c.stone * .5, metal: c.metal * .5 };
      if (canAfford(w, half)) { pay(w, half); b.upg = true; b.progress = .25; b.style = w.age; if (b.type === 'home' && w.age >= 6) b.big = true; if (b.type === 'temple') b.align = w.god.alignment; w.bldDirty = true; }
    }
  }
  // abandon the cave once there are enough homes
  const cave = w.buildings.find(b => b.type === 'cave'); if (cave && w.age >= 2 && cap - 8 > pop + 6) { removeBuilding(w, cave); }
}

// -------------------------------------------------------------- movement
function walkable(w, x, z, targetB) {
  const i = tIdx(x, z); if (i < 0) return false;
  if (w.tile[i] === TT.WATER) return false;
  const o = w.occ[i]; if (o >= 0 && o !== targetB) { const b = bById(w, o); if (b && b.type !== 'field' && b.type !== 'fire' && b.type !== 'park' && b.type !== 'dock' && !b.ruin) return false; }
  return true;
}
function lineBlockedByWater(w, x0, z0, x1, z1) {
  const d = dist(x0, z0, x1, z1), n = Math.ceil(d);
  for (let k = 1; k < n; k++) { const t = k / n; if (deep(w, lerp(x0, x1, t), lerp(z0, z1, t))) return true; }
  return false;
}
// cached A*: undefined = out of budget this tick, null = unreachable
function cachedPath(w, x0, z0, x1, z1) {
  const C = w._pc || (w._pc = new Map());
  const key = ((x0 / 4) | 0) + ',' + ((z0 / 4) | 0) + '>' + ((x1 / 3) | 0) + ',' + ((z1 / 3) | 0);
  if (C.has(key)) return C.get(key);
  if ((w._astar = (w._astar || 0) + 1) > 3) return undefined;
  const path = findPath(w, x0, z0, x1, z1);
  if (C.size > 600) C.clear();
  C.set(key, path); return path;
}
// A* over tiles, used only when water is in the way
function findPath(w, x0, z0, x1, z1) {
  const s = tIdx(x0, z0), g = tIdx(x1, z1); if (s < 0 || g < 0) return null;
  const G = w._g || (w._g = new Float32Array(N * N)), P = w._p || (w._p = new Int32Array(N * N)), C = w._c || (w._c = new Uint8Array(N * N));
  G.fill(1e9); C.fill(0); P.fill(-1);
  const heap = [], hx = x1 | 0, hz = z1 | 0;
  const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const pa = (k - 1) >> 1; if (heap[pa][0] <= heap[k][0]) break; [heap[pa], heap[k]] = [heap[k], heap[pa]]; k = pa; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  G[s] = 0; push(s, 0); let n = 0;
  while (heap.length && n++ < 9000) {
    const [, i] = pop(); if (C[i]) continue; C[i] = 1; if (i === g) break;
    const x = i % N, z = (i / N) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue; const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
      const j = nz * N + nx; if (C[j] || w.tile[j] === TT.WATER) continue;
      const c = (dx && dz ? 1.414 : 1) * (w.tile[j] === TT.SHALLOW ? 3 : w.road[j] ? .7 : 1) + Math.abs(w.H[nz * V + nx] - w.H[z * V + x]) * .8;
      const ng = G[i] + c; if (ng < G[j]) { G[j] = ng; P[j] = i; push(j, ng + Math.hypot(nx - hx, nz - hz) * .7); }
    }
  }
  if (P[g] < 0 && g !== s) return null;
  const path = []; let k = g, guard = 0; while (k !== s && k >= 0 && guard++ < 4000) { path.push({ x: (k % N) + .5, z: ((k / N) | 0) + .5 }); k = P[k]; }
  path.reverse();
  const out = []; for (let q = 0; q < path.length; q += 3) out.push(path[q]); out.push({ x: x1, z: z1 });
  return out;
}
function speedOf(w, p) {
  let s = 2.3; const a = ageOf(w, p);
  if (a < 6) s = 1.3; else if (a < 14) s = 2.0; else if (a > 62) s = 1.5;
  if (p.carry) s *= .85; if (p.gifts.swift) s *= 2.2; if (p.gifts.giant) s *= 1.3; if (p.injured > .3) s *= .6; if (p.sick) s *= .7;
  if (p.running) s *= 1.6;
  if (tileAt(w, p.x, p.z) === TT.SHALLOW) s *= .5;
  if (w.road[tIdx(p.x, p.z)] && w.age >= 1) s *= 1.15;
  return s * p.speedMul;
}
// Move toward (x,z); returns true when within r. Avoids buildings by steering and water with A*.
function moveTo(w, p, x, z, dt, r = .6, targetB = -1) {
  const d = dist(p.x, p.z, x, z); if (d <= r) { p.moving = false; return true; }
  const gk = ((x / 3) | 0) * 1000 + ((z / 3) | 0);
  if (p.pathGoal !== gk) {
    p.path = null;
    if (d > 4 && lineBlockedByWater(w, p.x, p.z, x, z)) { const path = cachedPath(w, p.x, p.z, x, z); if (path === undefined) p.pathGoal = -1; else { p.pathGoal = gk; if (path) { p.path = path.slice(); while (p.path.length > 1 && dist(p.x, p.z, p.path[1].x, p.path[1].z) < dist(p.path[0].x, p.path[0].z, p.path[1].x, p.path[1].z)) p.path.shift(); } } }
    else p.pathGoal = gk;
  }
  let tx = x, tz = z;
  if (p.path && p.path.length) { tx = p.path[0].x; tz = p.path[0].z; if (dist(p.x, p.z, tx, tz) < 1.2) { p.path.shift(); if (!p.path.length) p.path = null; } }
  const sp = speedOf(w, p) * dt, base = Math.atan2(tz - p.z, tx - p.x);
  let moved = false;
  const tries = [0, .6, -.6, 1.2, -1.2, 1.8, -1.8, 2.5, -2.5];
  const side = p.side || 1;
  for (const o of tries) {
    const a = base + o * side, nx = p.x + Math.cos(a) * sp, nz = p.z + Math.sin(a) * sp;
    const lx = p.x + Math.cos(a) * .7, lz = p.z + Math.sin(a) * .7;
    if (walkable(w, lx, lz, targetB) || !walkable(w, p.x, p.z, targetB)) {
      if (deep(w, nx, nz) && !deep(w, p.x, p.z)) continue;
      p.x = nx; p.z = nz; p.dir = a; moved = true; if (o !== 0 && Math.abs(o) > 1) p.side = o > 0 ? side : -side; break;
    }
  }
  if (!moved) { p.stuck = (p.stuck || 0) + dt; if (p.stuck > 2) { p.side = -side; p.stuck = 0; p.x += Math.cos(base) * sp; p.z += Math.sin(base) * sp; } }
  p.x = clamp(p.x, .5, N - .5); p.z = clamp(p.z, .5, N - .5);
  p.moving = true; p.act = p.carry ? 'carry' : 'walk';
  return dist(p.x, p.z, x, z) <= r;
}

// -------------------------------------------------------------- finding things
function nearest(list, x, z, filter, maxD = 1e9) { let best = null, bd = maxD; for (const o of list) { if (o.dead || o.alive === false) continue; if (filter && !filter(o)) continue; const d = dist(o.x, o.z, x, z); if (d < bd) { bd = d; best = o; } } return best; }
function storeFor(w, p) {
  const s = nearest(w.buildings, p.x, p.z, b => (b.type === 'store' || b.type === 'fire') && b.progress >= 1 && !b.ruin);
  return s || w.center;
}
function claimed(w, obj, p) { return obj._by && obj._by !== p.id && w.t - (obj._byT || 0) < 20; }
function claim(w, obj, p) { obj._by = p.id; obj._byT = w.t; }

// -------------------------------------------------------------- tasks
function deliver(w, p, dt) {
  const s = p.task.store || (p.task.store = storeFor(w, p));
  const sb = s.id ? s.id : -1;
  if (moveTo(w, p, s.x + (p.id % 3 - 1), s.z + 1.6, dt, 1, sb)) {
    const c = p.carry; if (c) { const m = p.gifts.strong ? 2 : 1; w.res[c.type] = (w.res[c.type] || 0) + c.amt * m; w.stats['got_' + c.type] = (w.stats['got_' + c.type] || 0) + c.amt; if (c.type === 'food') w.stats['food_' + p.job] = (w.stats['food_' + p.job] || 0) + c.amt; }
    p.carry = null; p.task = null; return true;
  }
  return false;
}
function workBonus(w, p) {
  let k = 1 + w.age * .12 + Math.min(.4, w.res.tools / 200 || 0);
  if (p.gifts.strong) k *= 2; if (p.traits.includes('hardworking')) k *= 1.25; if (p.traits.includes('lazy')) k *= .75;
  const v = w._mood; if (v && v.fear > .5) k *= 1.15; if (p.sick) k *= .5; if (p.gifts.giant) k *= 1.5;
  return k;
}
const TASKS = {
  gather(w, p, dt) {
    const T = p.task;
    if (p.carry) return deliver(w, p, dt);
    let b = T.bush;
    if (!b || b.dead || b.food < 1) { b = nearestTree(w, p.x, p.z, t => t.kind === 'berry' && t.food >= 1 && !t.burnt && !claimed(w, t, p), 45); if (!b) { T.fail = true; return true; } T.bush = b; claim(w, b, p); }
    if (moveTo(w, p, b.x, b.z, dt, 1)) { p.act = 'gather'; T.t = (T.t || 0) + dt * workBonus(w, p); if (T.t > 3) { const a = Math.min(b.food, 3); b.food -= a; p.carry = { type: 'food', amt: a + 1 }; } }
    return false;
  },
  chop(w, p, dt) {
    const T = p.task;
    if (p.carry) return deliver(w, p, dt);
    let t = T.tree;
    if (!t || t.dead || t.fell) { t = nearestTree(w, p.x, p.z, q => q.wood > 0 && !q.fell && !q.burnt && q.grow > .8 && !claimed(w, q, p) && dist(q.x, q.z, w.center.x, w.center.z) > 6, 60); if (!t) { T.fail = true; return true; } T.tree = t; claim(w, t, p); }
    if (moveTo(w, p, t.x - Math.cos(p.dir) * .2, t.z, dt, 1.1)) {
      p.act = 'chop'; p.dir = Math.atan2(t.z - p.z, t.x - p.x); T.t = (T.t || 0) + dt * workBonus(w, p);
      if (T.t > 5) { t.fell = w.t; t.fellDir = p.dir; p.carry = { type: 'wood', amt: t.wood }; t.wood = 0; event(w, 'treefall', { id: t.id }); }
    }
    return false;
  },
  quarry(w, p, dt) {
    const T = p.task;
    if (p.carry) return deliver(w, p, dt);
    const wantOre = T.ore;
    let r = T.rock;
    if (!r || r.dead) { r = nearest(w.rocks, p.x, p.z, q => !!q.ore === !!wantOre && !claimed(w, q, p), 90); if (!r) { T.fail = true; return true; } T.rock = r; claim(w, r, p); }
    if (moveTo(w, p, r.x, r.z, dt, 1.2)) {
      p.act = 'mine'; p.dir = Math.atan2(r.z - p.z, r.x - p.x); T.t = (T.t || 0) + dt * workBonus(w, p);
      if (T.t > 5) { const a = Math.min(r.stone, 3); r.stone -= a; if (r.stone <= 0) { r.dead = true; } p.carry = { type: wantOre ? 'metal' : 'stone', amt: (wantOre ? a : a + 1) * (1 + w.age * .2) }; }
    }
    return false;
  },
  hunt(w, p, dt) {
    const T = p.task;
    if (p.carry) return deliver(w, p, dt);
    let a = T.prey;
    if (!a || (a.eaten)) { a = nearest(w.animals, p.x, p.z, q => q.kind === 'deer' && !q.fly && q.alive && !q.pen, 60) || nearest(w.animals, p.x, p.z, q => (q.kind === 'boar' || (q.kind === 'mammoth' && w.age < 2)) && !q.fly && q.alive, 50); if (!a) { T.fail = true; return true; } T.prey = a; }
    if (!a.alive) { if (moveTo(w, p, a.x, a.z, dt, 1)) { p.carry = { type: 'food', amt: AK[a.kind].food }; a.eaten = true; } return false; }
    const d = dist(p.x, p.z, a.x, a.z);
    p.running = d < 14;
    if (d > 5.5 || T.cool > 0) { moveTo(w, p, a.x, a.z, dt, 5); T.cool = (T.cool || 0) - dt; }
    else { p.act = 'throw'; p.actT = .6; p.dir = Math.atan2(a.z - p.z, a.x - p.x); T.cool = 1.6; event(w, 'spear', { x: p.x, z: p.z, tx: a.x, tz: a.z }); if (rnd(w) < .55 * workBonus(w, p)) hurtAnimal(w, a, 1, p); else if (a.st !== 'flee') { a.st = 'flee'; a.fx = p.x; a.fz = p.z; a.t = 6; } }
    T.time = (T.time || 0) + dt; if (T.time > 60) { p.running = false; return true; }
    return false;
  },
  fish(w, p, dt) {
    const T = p.task;
    if (p.carry) return deliver(w, p, dt);
    if (!T.spot) { const dock = nearest(w.buildings, p.x, p.z, b => b.type === 'dock' && b.progress >= 1); if (dock) T.spot = { x: dock.x + Math.cos(dock.rot) * 2, z: dock.z + Math.sin(dock.rot) * 2, dock: dock.id }; else T.spot = shoreSpot(w, p); if (!T.spot) { T.fail = true; return true; } }
    if (moveTo(w, p, T.spot.x, T.spot.z, dt, .8, T.spot.dock || -1)) {
      p.act = 'fish'; T.t = (T.t || 0) + dt * workBonus(w, p) * (T.spot.dock ? 1.6 : 1);
      if (T.t > 9) { const a = Math.min(w.fish, 4); w.fish -= a; p.carry = { type: 'food', amt: a + 1 }; if (a < 1) T.fail = true; }
    }
    return false;
  },
  farm(w, p, dt) {
    const T = p.task;
    if (p.carry) return deliver(w, p, dt);
    let f = T.field && bById(w, T.field);
    if (!f || f.ruin) { const fs = w.buildings.filter(b => b.type === 'field' && b.progress >= 1 && !b.ruin); f = fs.sort((a, b) => (a.work - b.work) + (dist(a.x, a.z, p.x, p.z) - dist(b.x, b.z, p.x, p.z)) * .05)[0]; if (!f) { T.fail = true; return true; } T.field = f.id; T.px = f.x + rr(w, -2.8, 2.8); T.pz = f.z + rr(w, -2.8, 2.8); }
    const season = seasonOf(w);
    if (season === 3 && f.stock < 1) { T.field = 0; const other = w.buildings.find(b => b.type === 'field' && b.stock >= 1); if (!other) { T.fail = true; return true; } return false; }
    if (moveTo(w, p, T.px, T.pz, dt, .5, f.id)) {
      p.act = season === 2 ? 'harvest' : 'hoe'; T.t = (T.t || 0) + dt * workBonus(w, p);
      if (T.t > 4) {
        T.t = 0; T.px = f.x + rr(w, -2.8, 2.8); T.pz = f.z + rr(w, -2.8, 2.8);
        if (f.stock > 0) { const a = Math.min(f.stock, 6 + w.age * 2); f.stock -= a; p.carry = { type: 'food', amt: a }; }
        else if (season === 0) { f.planted = true; f.work = Math.min(1, f.work + .25); }
        else if (season === 1) f.work = Math.min(1, f.work + .12);
        else if (season === 2) {
          if (f.crop > .3 && f.stock <= 0) { f.stock = f.crop * 60 * (1 + w.age * .25) * (w.buildings.some(b => b.type === 'mill' && !b.ruin) ? 1.3 : 1); f.crop = 0; f.planted = false; }
          if (f.stock > 0) { const a = Math.min(f.stock, 6 + w.age * 2); f.stock -= a; p.carry = { type: 'food', amt: a }; }
          else { T.fail = true; return true; }
        }
      }
    }
    return false;
  },
  build(w, p, dt) {
    const T = p.task; let b = T.b && bById(w, T.b);
    if (!b || b.ruin || (b.progress >= 1 && !b.upg)) { const sites = w.buildings.filter(q => (q.progress < 1 || q.upg) && !q.ruin); b = sites.sort((a, c) => dist(a.x, a.z, p.x, p.z) - dist(c.x, c.z, p.x, p.z))[0]; if (!b) return true; T.b = b.id; T.ox = rr(w, -1, 1); T.oz = b.size / 2 + .5; }
    const side = (p.id % 4) * Math.PI / 2, ex = b.x + Math.cos(side) * (b.size / 2 + .4), ez = b.z + Math.sin(side) * (b.size / 2 + .4);
    if (moveTo(w, p, ex, ez, dt, .8, b.id)) {
      p.act = 'build'; p.dir = Math.atan2(b.z - p.z, b.x - p.x);
      const work = { home: 22, store: 26, temple: 90, field: 10, pen: 14, workshop: 30, market: 40, statue: 50, school: 40, dock: 30, castle: 140, mill: 36, factory: 90, clock: 60, hospital: 90, stadium: 150, park: 12, shrine: 14, fire: 10, cave: 1, rocket: 200 }[b.type] || 30;
      b.progress = Math.min(1, b.progress + dt * workBonus(w, p) / work * (1 + w.age * .15));
      if (b.progress >= 1) {
        if (b.upg) { b.upg = false; } else { b.built = w.t; }
        w.bldDirty = true; event(w, 'built', { id: b.id, x: b.x, z: b.z });
        if (['temple', 'castle', 'stadium', 'statue', 'rocket', 'school', 'market'].includes(b.type)) logEvent(w, 'build', `The ${bName(w, b)} was completed.`, { x: b.x, z: b.z });
        if (b.type === 'home') assignHomes(w);
        return true;
      }
    }
    return false;
  },
  station(w, p, dt) { // priests, scholars, smiths, merchants, doctors, workers: go to their building and work there
    const T = p.task; let b = T.b && bById(w, T.b);
    if (!b || b.ruin) { const type = { priest: ['temple', 'shrine'], scholar: ['school'], smith: ['workshop'], merchant: ['market'], worker: ['factory'], doctor: ['hospital'] }[p.job]; b = nearest(w.buildings, p.x, p.z, q => type.includes(q.type) && q.progress >= 1 && !q.ruin); if (!b) { T.fail = true; return true; } T.b = b.id; T.a = rr(w, 0, 6.28); }
    const ex = b.x + Math.cos(T.a) * (b.size / 2 + .6), ez = b.z + Math.sin(T.a) * (b.size / 2 + .6);
    if (moveTo(w, p, ex, ez, dt, .6, b.id)) {
      p.act = { priest: 'pray', scholar: 'read', smith: 'build', merchant: 'talk', worker: 'build', doctor: 'talk' }[p.job]; p.dir = Math.atan2(b.z - p.z, b.x - p.x);
      T.t = (T.t || 0) + dt;
      if (p.job === 'smith' && w.res.metal > 40) { const a = Math.min(w.res.metal, dt * .06); w.res.metal -= a; w.res.tools = (w.res.tools || 0) + a * 2; }
      if (p.job === 'priest') { w._priestFaith = (w._priestFaith || 0) + dt; }
      if (p.job === 'worker') { w.res.wood += dt * .03; w.res.stone += dt * .04; w.res.metal += dt * .05; }
      if (p.job === 'merchant') { w.res.food += dt * .05; w.res.metal += dt * .02; w.res.stone += dt * .02; }
      if (T.t > 30) return true;
    }
    return false;
  },
  patrol(w, p, dt) {
    const T = p.task; const threat = findThreat(w, p, 30);
    if (threat) { p.task = { k: 'fight', target: threat.id, tk: threat.kind ? 'a' : 'p' }; return false; }
    if (!T.pt) { const a = rr(w, 0, 6.28), d = rr(w, 12, 26); T.pt = { x: w.center.x + Math.cos(a) * d, z: w.center.z + Math.sin(a) * d }; }
    if (moveTo(w, p, T.pt.x, T.pt.z, dt, 1)) { T.pt = null; T.n = (T.n || 0) + 1; if (T.n > 4) return true; }
    return false;
  },
  fight(w, p, dt) {
    const T = p.task; const tgt = T.tk === 'a' ? w.animals.find(a => a.id === T.target) : (w.raiders || []).find(r => r.id === T.target);
    if (!tgt || !tgt.alive) return true;
    const d = dist(p.x, p.z, tgt.x, tgt.z); p.running = true;
    if (d > 1.3) moveTo(w, p, tgt.x, tgt.z, dt, 1.2);
    else { p.act = 'attack'; p.dir = Math.atan2(tgt.z - p.z, tgt.x - p.x); T.cool = (T.cool || 0) - dt; if (T.cool <= 0) { T.cool = 1.1; const dmg = (.35 + w.age * .06) * (p.gifts.strong ? 3 : 1) * (p.job === 'guard' ? 1.6 : 1); if (T.tk === 'a') hurtAnimal(w, tgt, dmg * 2, p); else hurt(w, tgt, dmg, 'fell in battle'); if (!tgt.alive) { p.kills++; think(w, p, `Defeated ${tgt.name || 'a ' + tgt.kind}`, 2); } } }
    T.time = (T.time || 0) + dt; if (T.time > 30) { p.running = false; return true; }
    return false;
  },
  flee(w, p, dt) {
    const T = p.task; p.running = true;
    const a = Math.atan2(p.z - T.fz, p.x - T.fx), tx = p.x + Math.cos(a) * 6, tz = p.z + Math.sin(a) * 6;
    moveTo(w, p, tx, tz, dt, .1); T.t -= dt; if (T.t <= 0) { p.running = false; return true; }
    return false;
  },
  fightFire(w, p, dt) {
    const T = p.task; const f = w.fires.find(q => q.id === T.fire);
    if (!f) { p.carry = null; return true; }
    if (!p.carry) { if (!T.spot) T.spot = shoreSpot(w, p) || { x: p.x, z: p.z }; if (moveTo(w, p, T.spot.x, T.spot.z, dt, 1)) { p.carry = { type: 'water', amt: 1 }; } return false; }
    if (moveTo(w, p, f.x, f.z, dt, 1.8)) { p.act = 'throw'; p.actT = .6; f.str -= .35; p.carry = null; event(w, 'splash', { x: f.x, z: f.z }); if (f.str <= 0) { extinguish(w, f); return true; } }
    return false;
  },
  play(w, p, dt) {
    const T = p.task; if (!T.pt) { const mom = personById(w, p.parents[1]); const c = mom && mom.alive && ageOf(w, p) < 5 ? mom : w.center; T.pt = { x: c.x + rr(w, -5, 5), z: c.z + rr(w, -5, 5) }; }
    p.running = ageOf(w, p) > 4 && rnd(w) < .5;
    if (moveTo(w, p, T.pt.x, T.pt.z, dt, .8)) { p.act = 'idle'; T.t = (T.t || 0) + dt; if (T.t > 3) return true; }
    return false;
  },
  social(w, p, dt) {
    const T = p.task; const c = T.place || w.center;
    if (T.a === undefined) { T.a = rr(w, 0, 6.28); T.r = rr(w, 2.4, 3.6); }
    const ex = c.x + Math.cos(T.a) * T.r, ez = c.z + Math.sin(T.a) * T.r;
    if (moveTo(w, p, ex, ez, dt, .5, c.id || -1)) {
      p.dir = Math.atan2(c.z - p.z, c.x - p.x);
      const festival = !T.worship && w._mood && w._mood.love > .35 && w._mood.mood > .6;
      p.act = T.worship ? 'pray' : festival ? 'dance' : 'sit';
      if (T.worship) p.faith = clamp01(p.faith + dt * .004);
      T.t = (T.t || 0) + dt;
      if (rnd(w) < dt * .02 && !p.say) chatter(w, p);
    }
    return hourOf(w) > 21 || hourOf(w) < 5;
  },
  sleep(w, p, dt) {
    const h = p.home && bById(w, p.home);
    if (h && !h.ruin && h.progress >= .99) { if (moveTo(w, p, h.x, h.z + (h.size / 2 + .3), dt, .8, h.id)) { p.act = 'sleep'; p.inside = true; p.x = h.x; p.z = h.z; } }
    else { const c = w.center; const a = (p.id * 2.4) % 6.28; if (moveTo(w, p, c.x + Math.cos(a) * 3, c.z + Math.sin(a) * 3, dt, .6)) { p.act = 'sleep'; } }
    const hr = hourOf(w); if (hr > 5.5 && hr < 20) { p.inside = false; if (h) { p.x = h.x + rr(w, -.5, .5); p.z = h.z + h.size / 2 + .6; } return true; }
    return false;
  },
  preach(w, p, dt) {
    const T = p.task; if (!T.pt) { const a = rr(w, 0, 6.28), d = rr(w, 0, 14); T.pt = { x: w.center.x + Math.cos(a) * d, z: w.center.z + Math.sin(a) * d }; }
    if (moveTo(w, p, T.pt.x, T.pt.z, dt, .8)) {
      p.act = 'preach'; T.t = (T.t || 0) + dt;
      if (rnd(w) < dt * .1) { say(w, p, pick(w, [`${w.god.name} is watching over us!`, `Listen! ${w.god.name} spoke to me in a vision!`, `Bring your offerings to ${w.god.name}!`, `${w.god.name} loves the faithful.`])); feel(w, p.x, p.z, 8, .01, 0, .03); }
      if (T.t > 20) return true;
    }
    return false;
  },
  offering(w, p, dt) {
    const T = p.task; const t = nearest(w.buildings, p.x, p.z, b => (b.type === 'temple' || b.type === 'shrine') && b.progress >= 1 && !b.ruin);
    if (!t) return true;
    if (!T.got) { if (w.res.food < 4) return true; w.res.food -= 4; p.carry = { type: 'offering', amt: 4 }; T.got = true; }
    if (moveTo(w, p, t.x, t.z + t.size / 2 + .5, dt, .8, t.id)) { p.carry = null; event(w, 'offering', { x: t.x, z: t.z }); w.god.mana += 12; p.fear = clamp01(p.fear - .05); say(w, p, pick(w, [`Accept this, ${w.god.name}, and spare us.`, `For you, ${w.god.name}. Please do not be angry.`])); return true; }
    return false;
  },
  wander(w, p, dt) {
    const T = p.task; if (!T.pt) { const a = rr(w, 0, 6.28), d = rr(w, 2, 10); T.pt = { x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d }; if (!onLand(w, T.pt.x, T.pt.z)) T.pt = { x: w.center.x, z: w.center.z }; }
    if (moveTo(w, p, T.pt.x, T.pt.z, dt, .8)) { p.act = 'idle'; T.t = (T.t || 0) + dt; if (T.t > 4) return true; }
    return false;
  },
  mourn(w, p, dt) {
    const T = p.task; const g = w.graves.find(q => q.pid === T.pid) || w.graveyard; if (!g) return true;
    if (moveTo(w, p, g.x, g.z + .8, dt, .6)) { p.act = 'kneel'; T.t = (T.t || 0) + dt; if (T.t > 12) return true; }
    return false;
  },
};
function shoreSpot(w, p) {
  let best = null, bd = 1e9;
  for (let k = 0; k < 120; k++) { const a = rr(w, 0, 6.28), d = rr(w, 2, 30), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d, i = tIdx(x, z); if (i < 0 || isWater(w.tile[i]) || w.dWater[i] !== 1) continue; if (d < bd) { bd = d; best = { x, z }; } }
  return best;
}
function chatter(w, p) {
  const G = w.god.name, v = w._mood || {};
  const lines = [
    `Did you see the stars last night?`, `My back aches from all this work.`, `The children grow so fast.`,
    v.love > .3 ? `${G} has been good to us.` : v.fear > .4 ? `Do not anger ${G}.` : `I wonder if ${G} is real.`,
    w.res.food < living(w).length * 2 ? `We need more food before winter.` : `We will eat well this winter.`,
    w.age >= 5 ? `The factory smoke gets everywhere.` : w.age >= 3 ? `Have you been to the market?` : `Tell me the old story again, Grandmother.`,
    p.spouse ? `I miss ${personById(w, p.spouse)?.name || 'my love'} when I work.` : `One day I will find someone.`,
  ];
  say(w, p, pick(w, lines), 4);
}

function findThreat(w, p, R) {
  let best = null, bd = R;
  for (const a of w.animals) { if (!a.alive || a.fly) continue; if (a.kind === 'wolf' || (a.kind === 'boar' && a.st === 'charge') || (a.kind === 'mammoth' && a.st === 'charge')) { const d = dist(a.x, a.z, p.x, p.z); if (d < bd) { bd = d; best = a; } } }
  for (const r of w.raiders || []) { if (!r.alive || r.fly) continue; const d = dist(r.x, r.z, p.x, p.z); if (d < bd) { bd = d; best = r; } }
  return best;
}

// -------------------------------------------------------------- person brain
function decide(w, p) {
  const hr = hourOf(w), age = ageOf(w, p), child = age < 14, night = hr < 5.5 || hr >= 20.5;
  p.running = false;
  // danger first
  const th = findThreat(w, p, child ? 14 : 9);
  if (th) {
    const brave = !child && (p.job === 'guard' || p.traits.includes('brave') || p.gifts.strong || (th.faction === 'raider' && age < 55 && rnd(w) < .5));
    if (brave) { p.task = { k: 'fight', target: th.id, tk: th.kind ? 'a' : 'p' }; if (!p.say) say(w, p, pick(w, ['For our families!', 'Stay back!', `${w.god.name}, give me strength!`])); return; }
    p.task = { k: 'flee', fx: th.x, fz: th.z, t: 5 }; if (!p.say && rnd(w) < .4) say(w, p, pick(w, ['Run!', 'Help!', 'Wolves!'])); return;
  }
  // fire nearby: adults fight it (after the stone age), everyone else runs
  const f = nearest(w.fires, p.x, p.z, q => q.kind === 'bld', 18);
  if (f && !child && w.age >= 1 && age < 60 && rnd(w) < .7) { p.task = { k: 'fightFire', fire: f.id }; return; }
  const ff = nearest(w.fires, p.x, p.z, null, 4); if (ff) { p.task = { k: 'flee', fx: ff.x, fz: ff.z, t: 3 }; return; }
  if (night) { p.task = { k: 'sleep' }; return; }
  if (p.grief > .5 && rnd(w) < .3) { const lost = p.lostKid ? p.lostKid.id : p.widow; if (lost) { p.task = { k: 'mourn', pid: lost }; return; } }
  if (hr >= 18) {
    const temple = nearest(w.buildings, p.x, p.z, b => (b.type === 'temple' || b.type === 'shrine') && b.progress >= 1 && !b.ruin);
    const worship = temple && p.faith > .45 && rnd(w) < p.faith * .8;
    if (worship && w.god.alignment < -.3 && p.fear > .5 && rnd(w) < .15) { p.task = { k: 'offering' }; return; }
    const place = worship ? temple : (w.age >= 1 ? nearest(w.buildings, p.x, p.z, b => b.type === 'fire' || b.type === 'park' || b.type === 'market') : null) || w.center;
    p.task = { k: 'social', place, worship }; return;
  }
  if (child) { p.task = age < 3 ? { k: 'play' } : rnd(w) < .8 ? { k: 'play' } : { k: 'wander' }; return; }
  if (p.prophet && rnd(w) < .5) { p.task = { k: 'preach' }; return; }
  if (p.job === 'elder') { p.task = rnd(w) < .5 ? { k: 'social', place: w.center } : { k: 'wander' }; return; }
  if (p.traits.includes('lazy') && rnd(w) < .12) { p.task = { k: 'wander' }; return; }
  const J = p.job;
  if (J === 'builder') p.task = { k: 'build' };
  else if (J === 'gatherer') p.task = { k: 'gather' };
  else if (J === 'woodcutter') p.task = { k: 'chop' };
  else if (J === 'stonecutter') p.task = { k: 'quarry' };
  else if (J === 'miner') p.task = { k: 'quarry', ore: true };
  else if (J === 'hunter') p.task = { k: 'hunt' };
  else if (J === 'fisher') p.task = { k: 'fish' };
  else if (J === 'farmer') p.task = seasonOf(w) === 3 && !w.buildings.some(b => b.type === 'field' && b.stock >= 1) ? { k: 'chop' } : { k: 'farm' };
  else if (J === 'guard') p.task = { k: 'patrol' };
  else if (['priest', 'scholar', 'smith', 'merchant', 'worker', 'doctor'].includes(J)) p.task = { k: 'station' };
  else p.task = { k: 'gather' };
}

function updatePerson(w, p, dt) {
  if (p.fly) return flyStep(w, p, dt);
  if (w.hand && w.hand.kind === 'p' && w.hand.id === p.id) { p.act = 'flail'; return; }
  if (p.actT > 0) { p.actT -= dt; if (p.act === 'fallen' || p.act === 'pray' || p.act === 'cheer' || p.act === 'cower') return; }
  if (w.incarnate === p.id) return controlledStep(w, p, dt);
  p.think -= dt;
  if (!p.task) { decide(w, p); p.think = 1 + rnd(w); }
  else if (p.think <= 0) {
    p.think = 1.2 + rnd(w); const k = p.task.k, hr = hourOf(w);
    const calm = k !== 'fight' && k !== 'flee' && k !== 'fightFire';
    if (calm && k !== 'sleep' && findThreat(w, p, isChild(w, p) ? 12 : 7)) decide(w, p);
    else if (calm && k !== 'sleep' && (hr < 5.5 || hr >= 20.5)) { if (!p.carry) decide(w, p); }
    else if (calm && hr >= 18 && k !== 'social' && k !== 'sleep' && k !== 'offering' && !p.carry) decide(w, p);
  }
  const T = p.task; if (!T) return;
  const fn = TASKS[T.k]; if (!fn) { p.task = null; return; }
  const done = fn(w, p, dt);
  if (done) { if (T.fail && T.k !== 'gather') { p.task = { k: 'wander' }; } else p.task = null; }
  if (p.inside && p.act !== 'sleep') p.inside = false;
}
function controlledStep(w, p, dt) {
  const I = w.input || {}, wx = I.mx || 0, wz = I.mz || 0;
  p.inside = false; if (p.task && p.task.k === 'sleep') p.task = null;
  if (wx || wz) {
    const L = Math.hypot(wx, wz);
    p.running = !!I.run; const sp = speedOf(w, p) * dt * 1.2;
    const nx = p.x + wx / L * sp, nz = p.z + wz / L * sp;
    if (!deep(w, nx, nz) && walkable(w, nx, nz, -1)) { p.x = clamp(nx, .5, N - .5); p.z = clamp(nz, .5, N - .5); }
    p.dir = Math.atan2(wz, wx); p.act = p.carry ? 'carry' : 'walk'; p.moving = true;
  } else if (p.actT <= 0) { p.act = 'idle'; p.moving = false; }
  p.running = false;
}

function flyStep(w, e, dt) {
  const F = e.fly; F.vy -= 22 * dt; e.x += F.vx * dt; e.z += F.vz * dt; e.y += F.vy * dt; F.spin = (F.spin || 0) + dt * 8;
  e.x = clamp(e.x, .5, N - .5); e.z = clamp(e.z, .5, N - .5);
  const g = Math.max(hAt(w, e.x, e.z), w.water - (deep(w, e.x, e.z) ? .3 : 0));
  if (e.y <= g) {
    const v = Math.hypot(F.vx, F.vy, F.vz); e.y = g; e.fly = null;
    const inWater = isWater(tileAt(w, e.x, e.z));
    event(w, inWater ? 'splash' : 'thud', { x: e.x, z: e.z, v });
    const dmg = inWater ? 0 : Math.max(0, (v - 9) * .09);
    if (e.name !== undefined) { if (dmg > 0) hurt(w, e, dmg, 'fell from the sky', F.byGod ? 'thrown' : null); if (e.alive) { e.act = 'fallen'; e.actT = 1.2; if (!inWater) say(w, e, pick(w, ['Ow...', 'What was that?!', `Why, ${w.god.name}?`])); } }
    else if (dmg > 0) hurtAnimal(w, e, dmg * 3);
    if (deep(w, e.x, e.z)) { const s = shoreSpot(w, e); if (s && e.name !== undefined) { e.task = { k: 'wander', pt: s }; } }
  }
}

// -------------------------------------------------------------- animals brain
function hurtAnimal(w, a, amt, by) {
  a.hp -= amt;
  if (a.hp <= 0 && a.alive) { a.alive = false; a.died = w.t; event(w, 'animalDeath', { x: a.x, z: a.z, kind: a.kind }); if (by && by.name) think(w, by, `Hunted a ${a.kind}`, 1); return; }
  if (AK[a.kind].fights && by) { a.st = 'charge'; a.target = by.id; a.targetKind = 'p'; a.t = 8; }
  else { a.st = 'flee'; a.fx = by ? by.x : a.x; a.fz = by ? by.z : a.z; a.t = 6; }
}
function animalMove(w, a, x, z, speed, dt) {
  const d = dist(a.x, a.z, x, z); if (d < .3) { a.spd = 0; return true; }
  let ang = Math.atan2(z - a.z, x - a.x);
  for (const o of [0, .7, -.7, 1.4, -1.4, 2.2, -2.2]) {
    const nx = a.x + Math.cos(ang + o) * speed * dt, nz = a.z + Math.sin(ang + o) * speed * dt;
    const t = tileAt(w, nx, nz); const bi = w.occ[tIdx(nx, nz)];
    const blocked = t === TT.WATER || t === TT.SNOW || (bi >= 0 && (a.pen !== bi)) || (a.pen && bi !== a.pen);
    if (!blocked) { a.x = nx; a.z = nz; a.dir = ang + o; a.spd = speed; return false; }
  }
  a.spd = 0; a.t = 0; return true;
}
function updateAnimal(w, a, dt) {
  if (a.fly) return flyStep(w, a, dt);
  if (!a.alive) return;
  if (w.hand && w.hand.kind === 'a' && w.hand.id === a.id) return;
  const K = AK[a.kind]; a.t -= dt; a.anim += dt * (a.spd || .2);
  if (a.pen) { const pen = bById(w, a.pen); if (!pen) { a.pen = 0; } else { if (a.t <= 0) { a.tx = pen.x + rr(w, -1.1, 1.1); a.tz = pen.z + rr(w, -1.1, 1.1); a.t = rr(w, 3, 8); } animalMove(w, a, a.tx, a.tz, K.speed * .4, dt); return; } }
  if (a.kind === 'dog') {
    const o = personById(w, a.owner);
    if (!o || !o.alive) { const n = nearest(w.people, a.x, a.z, p => p.alive && !isChild(w, p)); a.owner = n ? n.id : 0; return; }
    if (o.inside) { a.spd = 0; return; }
    const d = dist(a.x, a.z, o.x, o.z); if (d > 2.2) animalMove(w, a, o.x - Math.cos(o.dir) * 1.2, o.z - Math.sin(o.dir) * 1.2, Math.min(K.speed, d * 1.2), dt); else a.spd = 0;
    return;
  }
  if (a.st === 'flee') {
    const ang = Math.atan2(a.z - a.fz, a.x - a.fx); animalMove(w, a, a.x + Math.cos(ang) * 4, a.z + Math.sin(ang) * 4, K.speed * 1.3, dt);
    if (a.t <= 0) a.st = 'wander'; return;
  }
  if (a.st === 'charge' || a.st === 'hunt') {
    const tgt = a.targetKind === 'p' ? (personById(w, a.target)) : w.animals.find(q => q.id === a.target);
    if (!tgt || tgt.alive === false || tgt.inside || a.t <= 0 || tgt.fly) { a.st = 'wander'; a.t = 2; return; }
    if (animalMove(w, a, tgt.x, tgt.z, K.speed * (a.st === 'hunt' ? 1.15 : 1.25), dt) || dist(a.x, a.z, tgt.x, tgt.z) < 1) {
      a.bite = (a.bite || 0) - dt;
      if (a.bite <= 0) { a.bite = 1; if (a.targetKind === 'p') { hurt(w, tgt, a.kind === 'mammoth' ? .3 : .16, a.kind === 'wolf' ? 'was killed by wolves' : `was gored by a ${a.kind}`); if (!tgt.alive) { a.st = 'wander'; a.fed = w.t; } }
        else { hurtAnimal(w, tgt, 1, null); if (!tgt.alive) { a.st = 'eat'; a.t = 12; a.fed = w.t; tgt.eaten = true; } } }
    }
    return;
  }
  if (a.st === 'eat') { a.spd = 0; if (a.t <= 0) a.st = 'wander'; return; }
  // wandering: herds follow leader, predators look for prey
  if (a.t <= 0) {
    a.t = rr(w, 3, 9);
    if (K.predator && w.t - (a.fed || 0) > DAY * 1.5) {
      const deer = nearest(w.animals, a.x, a.z, q => q.alive && (q.kind === 'deer' || q.kind === 'sheep') && !q.fly, 30);
      const night = isNight(w);
      const person = w.age < 4 && night && w.t - (a.fed || 0) > DAY * 3 && rnd(w) < .35 ? nearest(w.people, a.x, a.z, p => p.alive && !p.inside && !p.gifts.immortal && dist(p.x, p.z, w.center.x, w.center.z) > 12 + w.age * 4, 18) : null;
      const tgt = person || deer;
      if (tgt) { a.st = 'hunt'; a.target = tgt.id; a.targetKind = person ? 'p' : 'a'; a.t = 25; if (person && rnd(w) < .7) { const v = nearest(w.people, person.x, person.z, p => p.alive && !isChild(w, p) && p.faith > .2); if (v) addPrayer(w, v, 'protect'); } return; }
    }
    const lead = a.herd && w.animals.find(q => q.id === a.herd && q.alive);
    if (lead) { a.tx = lead.x + rr(w, -3, 3); a.tz = lead.z + rr(w, -3, 3); }
    else { a.tx = a.x + rr(w, -10, 10); a.tz = a.z + rr(w, -10, 10); if (dist(a.tx, a.tz, w.center.x, w.center.z) < 16 && !K.predator) { a.tx = a.x + (a.x - w.center.x) * .3; a.tz = a.z + (a.z - w.center.z) * .3; } }
  }
  // skittish animals flee people
  if (K.flee && rnd(w) < dt * 2) { const p = nearest(w.people, a.x, a.z, q => q.alive && !q.inside, K.flee); if (p) { a.st = 'flee'; a.fx = p.x; a.fz = p.z; a.t = 3; return; } }
  animalMove(w, a, a.tx, a.tz, K.speed * .35, dt);
}
function breedAnimals(w) {
  const counts = {}; for (const a of w.animals) if (a.alive) counts[a.kind] = (counts[a.kind] || 0) + 1;
  for (const kind of ['deer', 'boar', 'wolf', 'mammoth']) {
    const n = counts[kind] || 0, max = kind === 'mammoth' && w.age >= 3 ? 0 : AK[kind].max;
    if (n > 0 && n < max && rnd(w) < .5) { const mom = pick(w, w.animals.filter(a => a.alive && a.kind === kind && !a.pen)); if (mom) addAnimal(w, kind, mom.x + rr(w, -1, 1), mom.z + rr(w, -1, 1), { herd: mom.herd || mom.id }); }
    else if (n === 0 && kind !== 'mammoth' && rnd(w) < .15) { const s = spotFor(w, kind === 'deer' ? [TT.GRASS] : [TT.FOREST, TT.JUNGLE]); if (s) { const l = addAnimal(w, kind, s.x, s.z); addAnimal(w, kind, s.x + 1, s.z, { herd: l.id }); } }
  }
  // pens: animals produce food and multiply
  for (const b of w.buildings) if (b.type === 'pen' && b.progress >= 1 && !b.ruin) {
    const inPen = w.animals.filter(a => a.alive && a.pen === b.id); w.res.food += inPen.length * .8;
    if (inPen.length < 5 && rnd(w) < .5) addAnimal(w, w.age >= 2 && rnd(w) < .4 ? 'cow' : 'sheep', b.x, b.z, { pen: b.id });
  }
  w.animals = w.animals.filter(a => a.alive || (w.t - a.died < DAY && !a.eaten));
}

// -------------------------------------------------------------- raiders
function spawnRaid(w, n) {
  w.raiders = w.raiders || [];
  const a = rr(w, 0, 6.28); let sx = w.center.x + Math.cos(a) * 60, sz = w.center.z + Math.sin(a) * 60;
  sx = clamp(sx, 3, N - 3); sz = clamp(sz, 3, N - 3);
  for (let k = 0; k < 6; k++) { if (onLand(w, sx, sz)) break; sx = lerp(sx, w.center.x, .2); sz = lerp(sz, w.center.z, .2); }
  for (let k = 0; k < n; k++) {
    const r = makePerson(w, { sex: rnd(w) < .8 ? 'm' : 'f', age: rr(w, 18, 35), faction: 'raider', x: sx + rr(w, -2, 2), z: sz + rr(w, -2, 2) });
    r.job = 'raider'; r.health = 1 + w.age * .15; r.born2 = w.t; w.raiders.push(r);
  }
  logEvent(w, 'war', `Raiders are coming over the hills towards ${w.villageName}!`, { x: sx, z: sz });
  event(w, 'raid', { x: sx, z: sz });
  const v = nearest(w.people, sx, sz, p => p.alive && !isChild(w, p)); if (v) addPrayer(w, v, 'protect');
}
function updateRaider(w, r, dt) {
  if (r.fly) return flyStep(w, r, dt);
  if (!r.alive) return;
  if (w.hand && w.hand.kind === 'p' && w.hand.id === r.id) { r.act = 'flail'; return; }
  if (r.actT > 0) { r.actT -= dt; if (r.act === 'fallen') return; }
  r.think -= dt; r.running = true;
  if (!r.task || r.think <= 0) {
    r.think = 1.5;
    if (w.t - r.born2 > DAY * 1.2 || r.health < .45) { r.task = { k: 'leave' }; }
    else {
      const v = nearest(w.people, r.x, r.z, p => p.alive && !p.inside && !isChild(w, p), 10);
      if (v) r.task = { k: 'attackP', id: v.id };
      else { const b = nearest(w.buildings, r.x, r.z, q => q.progress >= 1 && !q.ruin && q.type !== 'field' && q.type !== 'fire' && !q.fire); r.task = b ? { k: 'burn', id: b.id } : { k: 'leave' }; }
    }
  }
  const T = r.task;
  if (T.k === 'attackP') {
    const v = personById(w, T.id); if (!v || !v.alive || v.inside) { r.task = null; return; }
    if (moveTo(w, r, v.x, v.z, dt, 1.1)) { r.act = 'attack'; r.cool = (r.cool || 0) - dt; if (r.cool <= 0) { r.cool = 1.4; hurt(w, v, .16, 'was killed by raiders'); } }
  } else if (T.k === 'burn') {
    const b = bById(w, T.id); if (!b || b.ruin || b.fire) { r.task = null; return; }
    if (moveTo(w, r, b.x, b.z + b.size / 2 + .6, dt, 1, b.id)) { r.act = 'throw'; r.actT = .6; ignite(w, b.x, b.z, 'bld', b); r.task = null; }
  } else if (T.k === 'leave') {
    const a = Math.atan2(r.z - w.center.z, r.x - w.center.x);
    moveTo(w, r, r.x + Math.cos(a) * 5, r.z + Math.sin(a) * 5, dt, .1);
    if (r.x < 2 || r.z < 2 || r.x > N - 2 || r.z > N - 2 || dist(r.x, r.z, w.center.x, w.center.z) > 70) { r.alive = false; r.gone = true; }
  }
}

// -------------------------------------------------------------- fire
function ignite(w, x, z, kind, ref) {
  if (kind === 'tree' && (ref.burnt || ref.dead)) return;
  if (kind === 'bld' && (ref.ruin || ref.fire)) return;
  if (w.fires.length > 140) return;
  const f = { id: nid(w), x, z, kind, obj: ref || null, ref: ref ? ref.id : 0, str: 1, life: kind === 'tree' ? rr(w, 6, 12) : kind === 'bld' ? 30 : 5 };
  if (kind === 'bld') ref.fire = f.id; if (kind === 'tree') ref.burning = f.id;
  w.fires.push(f);
  if (kind === 'bld' && dist(x, z, w.center.x, w.center.z) < 40) { const v = nearest(w.people, x, z, p => p.alive && !isChild(w, p) && p.faith > .15, 25); if (v) addPrayer(w, v, 'fire', { dur: DAY }); }
  return f;
}
function extinguish(w, f) {
  w.fires = w.fires.filter(q => q !== f);
  if (f.kind === 'bld') { const b = bById(w, f.ref); if (b) b.fire = 0; }
  if (f.kind === 'tree' && f.obj) f.obj.burning = 0;
}
function updateFires(w, dt) {
  const wet = w.weather.rain > 0 ? 1 : 0, dry = w.weather.drought;
  for (const f of w.fires.slice()) {
    const raining = wet && dist(f.x, f.z, w.weather.rx, w.weather.rz) < w.weather.rr;
    if (raining) f.str -= dt * .5;
    f.life -= dt;
    if (f.kind === 'tree') {
      const t = f.obj;
      if (!t || t.dead || f.life <= 0 || f.str <= 0) { if (t && f.life <= 0) { t.burnt = w.t; t.wood = 0; t.food = 0; } extinguish(w, f); continue; }
    } else if (f.kind === 'bld') {
      const b = bById(w, f.ref);
      if (!b || b.ruin || f.str <= 0) { extinguish(w, f); continue; }
      damageBuilding(w, b, dt * .025 * f.str, 'fire');
      if (b.ruin) { extinguish(w, f); continue; }
    } else if (f.life <= 0 || f.str <= 0) { extinguish(w, f); continue; }
    // spread
    if (rnd(w) < dt * (.25 + dry * .5) * f.str * (raining ? .1 : 1)) {
      const a = rr(w, 0, 6.28), d = rr(w, .5, 2.6), x = f.x + Math.cos(a) * d, z = f.z + Math.sin(a) * d;
      const t = nearestTree(w, x, z, q => !q.burnt && !q.burning, 1.4); if (t) ignite(w, t.x, t.z, 'tree', t);
      const bi = w.occ[tIdx(x, z)]; if (bi >= 0) { const b = bById(w, bi); if (b && !b.fire && !b.ruin && b.type !== 'field' && b.type !== 'fire' && rnd(w) < .4 / (1 + b.style * .3)) ignite(w, b.x, b.z, 'bld', b); if (b && b.type === 'field') { b.crop *= .5; } }
    }
    // burn creatures
    if (rnd(w) < dt * 2) { for (const p of w.people) if (p.alive && !p.inside && dist(p.x, p.z, f.x, f.z) < 1) hurt(w, p, .15, 'burned to death', f.byGod ? 'fire' : null); for (const a of w.animals) if (a.alive && dist(a.x, a.z, f.x, f.z) < 1) hurtAnimal(w, a, .5); }
  }
}

// -------------------------------------------------------------- the world clock
function stepWorld(w, dt) {
  w.t += dt; w._astar = 0;
  const day = Math.floor(w.t / DAY);
  if (day !== w.dayIndex) { w.dayIndex = day; newDay(w); }
  w._mood = w._mood || villageMood(w);
  for (const p of w.people) if (p.alive) updatePerson(w, p, dt); else if (p.fly) flyStep(w, p, dt);
  for (const r of w.raiders || []) updateRaider(w, r, dt);
  for (const a of w.animals) updateAnimal(w, a, dt);
  updateFires(w, dt);
  updateWeather(w, dt);
  updateDisasters(w, dt);
  processPending(w);
  w._pt = (w._pt || 0) - dt; if (w._pt <= 0) { w._pt = 1; updatePrayers(w); }
  w.fish = Math.min(80, w.fish + dt * .06);
  // fields grow in summer
  for (const b of w.buildings) if (b.type === 'field' && b.planted && b.progress >= 1) {
    const s = seasonOf(w); if (s === 0 || s === 1) b.crop = Math.min(1.25, b.crop + dt / DAY * .55 * (.4 + b.work) * (.35 + w.weather.moist * .9) * (b.blessed ? 2 : 1));
    if (s === 3 && b.crop > 0 && b.stock <= 0) b.crop *= Math.pow(.5, dt / DAY * 2);
  }
  // god's power returns with faith
  const v = w._mood, ps = w.people.length;
  if (!w.god.unlimited) { const cap = 120 + ps * 3; w.god.mana = Math.min(cap, w.god.mana + dt * (.35 + v.faith * ps * .03 + (w._priestFaith ? .3 : 0))); w.god.manaMax = cap; }
  else { w.god.mana = w.god.manaMax = 9999; }
  // clean up
  if (w.hand && w.hand.kind === 'p') { const p = personById(w, w.hand.id); if (!p || !p.alive) w.hand = null; }
}

function newDay(w) {
  const season = seasonOf(w), ps = living(w), pop = ps.length;
  w.yearIndex = Math.floor(w.t / YEAR);
  w._mood = villageMood(w);
  w._priestFaith = 0;
  // trade and machines bring food to later ages
  w.res.food += pop * [0, 0, .1, .2, .35, .7, 1.05][w.age];
  // eat
  let need = 0; for (const p of ps) need += isChild(w, p) ? .6 : 1;
  const storeCap = 150 + pop * 4 + w.buildings.filter(b => b.type === 'store' && !b.ruin).length * (150 + w.age * 60);
  if (w.res.food >= need) { w.res.food -= need; for (const p of ps) p.hunger = Math.min(1, p.hunger + .5); }
  else { const frac = w.res.food / Math.max(1, need); w.res.food = 0; for (const p of ps) { p.hunger = Math.max(0, p.hunger - (1 - frac) * .3); if (p.hunger < .05) hurt(w, p, .2, 'starved to death'); } if (pop && frac < .7) { const v = pick(w, ps.filter(p => !isChild(w, p))); if (v) addPrayer(w, v, 'food'); } }
  w.res.food = Math.min(w.res.food, storeCap); w.res.wood = Math.min(w.res.wood, storeCap * 1.2); w.res.stone = Math.min(w.res.stone, storeCap * 1.2);
  w.storeCap = storeCap;
  // knowledge
  let adults = 0, extra = 0; for (const p of ps) { const a = ageOf(w, p); if (a < 14) continue; adults++; if (isElder(w, p)) extra += .1; if (p.job === 'scholar') extra += .35; if (p.traits.includes('curious')) extra += .05; if (p.gifts.wise) extra += 1.5; if (p.prophet) extra += .1; }
  const schools = w.buildings.filter(b => b.type === 'school' && b.progress >= 1).length;
  const k = (.5 + Math.sqrt(adults) * .5 + extra) * (1 + w.age * .2) * (1 + Math.min(.6, schools * .15));
  w.knowledge += k; w.kRate = k * 4;
  const nx = AGES[w.age + 1];
  if (nx && w.knowledge >= nx.k && pop >= nx.pop && w.t - w.lastAgeT > YEAR * 6) ageUp(w);
  if (w.age === 6 && !w.launched && w.knowledge >= LAUNCH_K) { const pad = w.buildings.find(b => b.type === 'rocket' && b.progress >= 1); if (pad) { w.launched = w.t; logEvent(w, 'age', `The people of ${w.villageName} launched a rocket into the sky. They painted your name on its side.`, { x: pad.x, z: pad.z }); event(w, 'launch', { x: pad.x, z: pad.z }); } }
  // health, ageing and death
  for (const p of ps) {
    const a = ageOf(w, p), life = AGES[w.age].life + (p.gifts.wise ? 10 : 0);
    if (p.sick) { p.sick += .12 * (1 - (w.buildings.some(b => b.type === 'hospital' && !b.ruin) ? .6 : 0)); p.health -= rr(w, .02, .1) * (a > 50 || a < 5 ? 1.5 : 1) * (w._godPlague ? 2.2 : 1); if (p.health <= 0) { hurt(w, p, 1, w._godPlague ? 'died of the plague' : 'died of a fever', w._godPlague ? 'plague' : null); continue; } if (rnd(w) < (w._godPlague ? .12 : .3)) { p.sick = 0; p.immune = w.t + YEAR * 4; think(w, p, 'Recovered from the sickness', 1); } }
    if (p.injured) p.injured = Math.max(0, p.injured - .1);
    if (p.health < 1 && !p.sick) p.health = Math.min(1, p.health + .06);
    p.grief = Math.max(0, p.grief - .12);
    if (!p.gifts.immortal && a > life * .8 && rnd(w) < Math.pow((a - life * .8) / (life * .5), 2) * .08) { die(w, p, 'died of old age'); continue; }
    if (a > 2 && a < 3 && !p.named2) { p.named2 = true; }
    // mood
    let m = .55 + (p.hunger - .5) * .4 + (p.home ? .1 : -.1) - p.grief * .35 + (p.spouse ? .08 : 0) + (p.sick ? -.2 : 0) + p.love * .12 - p.fear * .15 + (p.traits.includes('cheerful') ? .1 : 0);
    p.mood = clamp01(lerp(p.mood, m, .5));
    // faith drifts: pulls toward the village mean, fades in later ages
    p.faith = clamp01(p.faith + (w._mood.faith - p.faith) * .03 + ([.42, .42, .38, .34, .3, .2, .12][w.age] - p.faith) * .012 + (p.prophet ? .02 : 0));
    p.fear = clamp01(p.fear - .012); p.love = clamp(p.love * .995, -1, 1);
  }
  // births and marriage
  const cap = w.buildings.reduce((s, b) => s + (b.ruin ? 0 : capOf(w, b)), 0) + (w.age === 0 ? 6 : 0);
  const perCap = w.res.food / Math.max(1, pop);
  for (const p of living(w)) {
    const a = ageOf(w, p);
    if (p.pregnant) { p.pregnant -= DAY; if (p.pregnant <= 0) birth(w, p); continue; }
    if (p.sex === 'f' && p.spouse && a >= 16 && a <= 42) {
      const sp = personById(w, p.spouse); if (!sp || !sp.alive) continue;
      const kidsSmall = p.kids.filter(id => { const k = personById(w, id); return k && k.alive && ageOf(w, k) < 3; }).length;
      let ch = .22 * (perCap > 2 ? 1 : .35) * (pop < cap + 2 ? 1 : .25) * (kidsSmall ? .25 : 1) * (p.gifts.fertile || sp.gifts.fertile ? 3 : 1) * (w._mood.love < -.3 ? .6 : 1);
      if (pop >= Math.min(MAX_PEOPLE, POP_CAP[w.age])) ch = 0;
      if (rnd(w) < ch) { p.pregnant = YEAR * .5; think(w, p, 'Expecting a baby', 3); }
      if (!p.kids.length && a > 22 && rnd(w) < .05 && p.faith > .2) addPrayer(w, p, 'child', { target: p.id });
    }
    if (!p.spouse && a >= 17 && a < 50 && rnd(w) < .22) {
      const m = w.people.find(q => q.alive && !q.spouse && q.sex !== p.sex && ageOf(w, q) >= 17 && Math.abs(ageOf(w, q) - a) < 14 && !related(p, q) && q.faction === 'village');
      if (m) marry(w, p, m); else if (a > 24 && p.traits.includes('lonely') && rnd(w) < .15) addPrayer(w, p, 'love', { target: p.id });
    }
  }
  // newcomers are drawn to a prosperous, happy village
  if (season === 0 && pop && pop < POP_CAP[w.age] - 6 && perCap > 2.5 && cap > pop + 2 && rnd(w) < .25 + w.age * .08 + Math.max(0, w._mood.love) * .3) immigrate(w);
  // prayers from circumstances
  const sickP = ps.filter(p => p.sick && p.alive);
  if (sickP.length && rnd(w) < .6) { const s = pick(w, sickP); const kin = w.people.find(q => q.alive && (q.id === s.spouse || s.parents.includes(q.id) || s.kids.includes(q.id))) || s; addPrayer(w, kin, 'heal', { target: s.id, tname: s.name }); }
  for (const p of ps) if (p.lostKid && w.t - p.lostKid.t < YEAR * 2 && rnd(w) < .12) { const k = personById(w, p.lostKid.id); if (k && !k.alive && w.graves.some(g => g.pid === k.id)) addPrayer(w, p, 'revive', { target: k.id, tname: k.name, dur: DAY * 3 }); }
  if (season === 1 && w.weather.moist < .3 && w.buildings.some(b => b.type === 'field')) { const f = pick(w, ps.filter(p => p.job === 'farmer' || !isChild(w, p))); if (f) addPrayer(w, f, 'rain'); }
  if (rnd(w) < .08) { const s = pick(w, ps.filter(p => p.job === 'elder' || p.job === 'scholar' || p.traits.includes('curious'))); if (s) addPrayer(w, s, 'wisdom', { target: s.id }); }
  const devout = ps.filter(p => !isChild(w, p) && rnd(w) < p.faith * (p.traits.includes('pious') ? 2 : 1));
  if (devout.length && rnd(w) < .55 + w._mood.faith * .4) {
    const p = pick(w, devout), kinds = [];
    if (p.job === 'hunter' && !w.animals.some(a => a.alive && a.kind === 'deer' && dist(a.x, a.z, w.center.x, w.center.z) < 40)) kinds.push('hunt');
    if (p.job === 'farmer' && season === 0) kinds.push('harvest');
    if (season === 2 && w.res.food < pop * 6) kinds.push('winter');
    const baby = p.kids.map(id => personById(w, id)).find(k => k && k.alive && ageOf(w, k) < 2);
    if (baby) kinds.push('safe');
    if (p.traits.includes('lonely') && !p.spouse) kinds.push('love');
    const k = kinds.length ? pick(w, kinds) : rnd(w) < .7 ? 'family' : null;
    if (k === 'safe') addPrayer(w, p, 'safe', { target: baby.id, tname: baby.name, dur: DAY * 2 });
    else if (k === 'love') addPrayer(w, p, 'love', { target: p.id });
    else if (k) addPrayer(w, p, k, { dur: DAY * 1.5 });
  }
  if (rnd(w) < .07 && w._mood.faith < .5) { const s = pick(w, ps.filter(p => p.job === 'priest' || p.traits.includes('pious'))); if (s) addPrayer(w, s, 'sign'); }
  if (w.god.alignment < -.35 && w._mood.fear > .5 && rnd(w) < .15) { const s = pick(w, ps.filter(p => !isChild(w, p))); if (s) addPrayer(w, s, 'mercy'); }
  // natural disease outbreaks, rarer as they grow wiser
  if (pop > 15 && rnd(w) < .008 / (1 + w.age * .3)) { const s = pick(w, ps); if (s) { s.sick = .1; logEvent(w, 'plague', `${s.name} fell ill with a fever.`, { x: s.x, z: s.z }); } }
  // contagion
  for (const p of ps) if (p.sick) for (const q of ps) if (!q.sick && q !== p && !(q.immune > w.t) && dist(p.x, p.z, q.x, q.z) < 2 && rnd(w) < (w._godPlague ? .3 : .08) * (q.gifts.immortal ? 0 : 1)) q.sick = .05;
  if (!ps.some(p => p.sick)) w._godPlague = false;
  // alignment: running balance of good and evil deeds
  const d = w.god.deeds; w.god.alignment = clamp((d.good - d.evil) / (6 + d.good + d.evil) * 1.6, -1, 1);
  w.god.title = godTitle(w);
  // homes, jobs, buildings
  assignHomes(w); assignJobs(w); planBuildings(w);
  if (season === 0) for (const b of w.buildings) if (b.type === 'field') { b.work = 0; b.blessed = false; }
  // animals
  breedAnimals(w);
  // raids start in the bronze age
  if (w.age >= 2 && w.t > w.raidT) { w.raidT = w.t + YEAR * rr(w, 18, 34); spawnRaid(w, 2 + w.age + Math.floor(rnd(w) * 2)); }
  if (w.raiders) { for (const r of w.raiders) if (!r.born2) r.born2 = w.t; w.raiders = w.raiders.filter(r => r.alive || (!r.gone && w.t - r.died < DAY)); }
  if (!w.rockCap) w.rockCap = w.rocks.length;
  if (w.rocks.length < w.rockCap && rnd(w) < .5) { for (let k = 0; k < 20; k++) { const x = rr(w, 4, N - 4), z = rr(w, 4, N - 4), t = tileAt(w, x, z); if ((t === TT.ROCK || t === TT.FOREST) && w.occ[tIdx(x, z)] < 0 && dist(x, z, w.center.x, w.center.z) > 20) { addRock(w, x, z, rnd(w) < .4); break; } } }
  if (season < 3) for (const t of w.trees) if (t.kind === 'berry' && !t.burnt && t.food < 5) t.food = Math.min(5, t.food + 2);
  // forest regrowth
  const alive = w.trees.filter(t => !t.dead && !t.burnt);
  if (!w.treeCap) w.treeCap = alive.length * 1.1;
  for (let k = 0; k < (alive.length < w.treeCap ? 6 : 0); k++) { const t = pick(w, alive); if (!t || t.kind === 'berry') continue; const x = t.x + rr(w, -3, 3), z = t.z + rr(w, -3, 3), i = tIdx(x, z); if (i < 0 || w.occ[i] >= 0 || w.road[i] || isWater(w.tile[i]) || w.tile[i] === TT.SNOW) continue; if (dist(x, z, w.center.x, w.center.z) < 10 + w.age * 4) continue; const n = addTree(w, t.kind, x, z); n.grow = .1; }
  for (const t of w.trees) { if (t.grow < 1) t.grow = Math.min(1, t.grow + .06); if (t.fell && w.t - t.fell > DAY * 2) t.dead = true; if (t.burnt && w.t - t.burnt > DAY * 6) t.dead = true; }
  for (const t of w.trees) if (!t.dead && !t.fell && !t.burnt && t.grow >= 1 && t.wood === 0 && t.kind !== 'bush' && t.kind !== 'berry') t.wood = 3;
  cleanDead(w);
  if (w.stats.peak < pop) w.stats.peak = pop;
  // seasons: winter snow on the ground
  w.weather.snow = season === 3 ? Math.min(1, w.weather.snow + .5) : Math.max(0, w.weather.snow - .6);
  if (season === 0 && rnd(w) < .5) naturalRain(w);
  if (season === 1) { w.weather.moist = Math.max(0, w.weather.moist - rr(w, .1, .3)); if (rnd(w) < .25) naturalRain(w); }
  if (season === 2 && rnd(w) < .4) naturalRain(w);
  if (!pop) { if (!w.extinct) { w.extinct = w.t; logEvent(w, 'death', `The last of the people of ${w.villageName} is gone. The valley is silent.`); event(w, 'extinct'); } }
  if (season === 0 && w.yearIndex > 0) event(w, 'newYear', { year: w.yearIndex });
}
function immigrate(w) {
  const a = rr(w, 0, 6.28); let x = w.center.x + Math.cos(a) * 30, z = w.center.z + Math.sin(a) * 30;
  if (!onLand(w, x, z)) { x = w.center.x + 3; z = w.center.z + 3; }
  const skin = rnd(w), m = makePerson(w, { sex: 'm', age: rr(w, 18, 34), skin, x, z }), f = makePerson(w, { sex: 'f', age: rr(w, 18, 32), skin: clamp01(skin + rr(w, -.2, .2)), x: x + 1, z });
  marry(w, m, f, true); const kids = Math.floor(rnd(w) * 3);
  for (let k = 0; k < kids; k++) makePerson(w, { parents: [m, f], age: rr(w, 1, 10), x, z: z + 1 });
  for (const p of [m, f]) { p.faith = rr(w, .1, .4); p.task = { k: 'wander', pt: { x: w.center.x, z: w.center.z } }; }
  logEvent(w, 'life', `A family of ${2 + kids} wanderers, ${m.name} and ${f.name}, came to live in ${w.villageName}.`, { x, z, pid: m.id });
  event(w, 'arrive', { x, z });
}
function related(a, b) { if (a.parents.includes(b.id) || b.parents.includes(a.id)) return true; return a.parents.length && b.parents.length && a.parents.some(x => b.parents.includes(x)); }
function birth(w, mom) {
  const dad = personById(w, mom.spouse) || mom;
  const c = makePerson(w, { parents: [dad, mom], x: mom.x, z: mom.z });
  c.fam = dad.fam || dad.id; mom.pregnant = 0; mom.lastKid = w.t; w.stats.born++;
  think(w, mom, `Gave birth to ${c.name}`, 4); if (dad !== mom) think(w, dad, `Became a father to ${c.name}`, 4);
  if (w.stats.born < 6 || rnd(w) < .25) logEvent(w, 'life', `${c.name} was born to ${mom.name}${dad !== mom ? ' and ' + dad.name : ''}.`, { x: mom.x, z: mom.z, pid: c.id });
  event(w, 'birth', { x: mom.x, z: mom.z, id: c.id });
  answer(w, 'child', null, null, 0, mom.id);
  return c;
}
function assignHomes(w) {
  const homes = w.buildings.filter(b => (b.type === 'home' || b.type === 'cave') && b.progress >= .99 && !b.ruin);
  const occ = new Map(homes.map(h => [h.id, 0]));
  for (const p of w.people) if (p.alive && p.home) { if (occ.has(p.home)) occ.set(p.home, occ.get(p.home) + 1); else p.home = 0; }
  for (const h of homes) { let n = occ.get(h.id); if (n > capOf(w, h)) { for (const p of w.people) if (p.home === h.id && n > capOf(w, h) && !isChild(w, p) && !p.spouse) { p.home = 0; n--; } occ.set(h.id, n); } }
  for (const p of w.people) {
    if (!p.alive || p.home) continue;
    const sp = p.spouse && personById(w, p.spouse);
    if (sp && sp.home && bById(w, sp.home) && occ.get(sp.home) < capOf(w, bById(w, sp.home))) { p.home = sp.home; occ.set(p.home, occ.get(p.home) + 1); continue; }
    const par = p.parents.map(id => personById(w, id)).find(q => q && q.alive && q.home);
    if (par && isChild(w, p)) { p.home = par.home; occ.set(p.home, (occ.get(p.home) || 0) + 1); continue; }
    const h = homes.filter(h => occ.get(h.id) < capOf(w, h)).sort((a, b) => occ.get(a.id) - occ.get(b.id))[0];
    if (h) { p.home = h.id; occ.set(h.id, occ.get(h.id) + 1); if (sp && !sp.home && occ.get(h.id) < capOf(w, h)) { sp.home = h.id; occ.set(h.id, occ.get(h.id) + 1); } }
  }
}
function ageUp(w) {
  w.age++; w.lastAgeT = w.t;
  const A = AGES[w.age];
  logEvent(w, 'age', `The ${A.name} has begun in ${w.villageName}. They wear ${A.cloth} now.`, { x: w.center.x, z: w.center.z });
  event(w, 'ageUp', { age: w.age });
  for (const p of living(w)) { think(w, p, `The world is changing`, 2); }
  const fire = w.buildings.find(b => b.type === 'fire'); if (fire) { fire.upg = true; fire.progress = .3; fire.style = w.age; }
  if (w.age === 1) { w.res.wood += 20; }
  w.bldDirty = true;
}
function cleanDead(w) { if (w.trees.some(t => t.dead)) w.trees = w.trees.filter(t => !t.dead); if (w.rocks.some(r => r.dead)) w.rocks = w.rocks.filter(r => !r.dead); w.treesDirty = true; }

// -------------------------------------------------------------- weather
function naturalRain(w) { const W = w.weather; W.rain = DAY * rr(w, .3, .7); W.rx = rr(w, 20, N - 20); W.rz = rr(w, 20, N - 20); W.rr = 90; W.natural = true; }
function updateWeather(w, dt) {
  const W = w.weather;
  if (W.rain > 0) { W.rain -= dt; W.moist = Math.min(1, W.moist + dt * .02); if (W.rain <= 0) { W.rr = 0; W.natural = false; } }
  if (W.storm > 0) { W.storm -= dt; if (rnd(w) < dt * 1.2) { const x = w.center.x + rr(w, -40, 40), z = w.center.z + rr(w, -40, 40); strike(w, x, z, false); } }
  W.drought = seasonOf(w) === 1 ? clamp01(1 - W.moist * 1.4) : 0;
  W.dust = Math.max(0, W.dust - dt * .004);
  const tc = W.rain > 0 || W.storm > 0 ? .95 : .25 + .2 * Math.sin(w.t * .01);
  W.clouds = lerp(W.clouds, tc, dt * .1);
}
function updateDisasters(w, dt) {
  // tornadoes wander, pick things up, flatten homes
  for (const tn of w.tornadoes) {
    tn.life -= dt; tn.a += (rnd(w) - .5) * dt * 2; tn.x = clamp(tn.x + Math.cos(tn.a) * dt * 3.2, 2, N - 2); tn.z = clamp(tn.z + Math.sin(tn.a) * dt * 3.2, 2, N - 2);
    const lift = e => { if (e.fly || (w.hand && w.hand.id === e.id)) return; const a = Math.atan2(e.z - tn.z, e.x - tn.x) + 1.4; e.fly = { vx: Math.cos(a) * 12, vz: Math.sin(a) * 12, vy: 14 + rnd(w) * 6, byGod: true }; e.y = hAt(w, e.x, e.z) + .5; };
    for (const p of w.people) if (p.alive && !p.inside && dist(p.x, p.z, tn.x, tn.z) < 2.2 && rnd(w) < dt * 3) { lift(p); say(w, p, 'Aaaaah!'); }
    for (const r of w.raiders || []) if (r.alive && dist(r.x, r.z, tn.x, tn.z) < 2.2) lift(r);
    for (const a of w.animals) if (a.alive && dist(a.x, a.z, tn.x, tn.z) < 2.2 && rnd(w) < dt * 3) lift(a);
    for (const t of w.trees) if (!t.dead && !t.fell && dist(t.x, t.z, tn.x, tn.z) < 2 && rnd(w) < dt * 2) { t.fell = w.t; t.fellDir = tn.a; t.wood = 0; event(w, 'treefall', { id: t.id }); }
    const bi = w.occ[tIdx(tn.x, tn.z)]; if (bi >= 0) { const b = bById(w, bi); if (b) damageBuilding(w, b, dt * .45, 'a tornado'); }
    if (rnd(w) < dt) feel(w, tn.x, tn.z, 30, -.004, .015, .003);
  }
  w.tornadoes = w.tornadoes.filter(t => t.life > 0);
  // earthquake
  if (w.quake) {
    const q = w.quake; q.t -= dt;
    if (rnd(w) < dt * 4) for (const b of w.buildings) { const d = dist(b.x, b.z, q.x, q.z); if (d < q.r) damageBuilding(w, b, rr(w, .05, .16) * (1 - d / q.r) / (1 + (b.style >= 5 ? 1 : 0)), 'an earthquake'); }
    if (rnd(w) < dt * 3) for (const p of w.people) if (p.alive && dist(p.x, p.z, q.x, q.z) < q.r && !p.fly) { p.act = 'fallen'; p.actT = .8; }
    if (q.t <= 0) w.quake = null;
  }
  // lava flows downhill
  for (const L of w.lava) {
    L.t -= dt; if (L.t <= 0) continue;
    for (const hd of L.heads) {
      if (hd.dead) continue;
      let bx = hd.x, bz = hd.z, bh = hAt(w, hd.x, hd.z);
      for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28 + rr(w, -.3, .3), x = hd.x + Math.cos(a) * .9, z = hd.z + Math.sin(a) * .9, h = hAt(w, x, z); if (h < bh) { bh = h; bx = x; bz = z; } }
      if (bx === hd.x && bz === hd.z) { hd.x += rr(w, -.5, .5); hd.z += rr(w, -.5, .5); }
      else { hd.x = lerp(hd.x, bx, dt * 1.6); hd.z = lerp(hd.z, bz, dt * 1.6); }
      L.cells.push({ x: hd.x, z: hd.z, t: w.t });
      if (L.cells.length > 900) L.cells.shift();
      if (isWater(tileAt(w, hd.x, hd.z))) { hd.dead = true; event(w, 'steam', { x: hd.x, z: hd.z }); continue; }
      if (rnd(w) < dt * 3) { const t = nearestTree(w, hd.x, hd.z, q => !q.burnt && !q.burning, 1.5); if (t) ignite(w, t.x, t.z, 'tree', t); }
      const bi = w.occ[tIdx(hd.x, hd.z)]; if (bi >= 0) { const b = bById(w, bi); if (b && !b.ruin) { if (!b.fire) ignite(w, b.x, b.z, 'bld', b); damageBuilding(w, b, dt * .3, 'lava'); } }
      for (const p of w.people) if (p.alive && dist(p.x, p.z, hd.x, hd.z) < 1.2) hurt(w, p, .6, 'was swallowed by lava', 'volcano');
      for (const a of w.animals) if (a.alive && dist(a.x, a.z, hd.x, hd.z) < 1.2) hurtAnimal(w, a, 3);
      if (rnd(w) < dt * .3 && L.heads.length < 7) L.heads.push({ x: hd.x, z: hd.z });
    }
  }
  w.lava = w.lava.filter(L => L.t > -DAY * 3);
  // locusts eat crops and berries
  for (const s of w.locusts) {
    s.life -= dt; const f = nearest(w.buildings, s.x, s.z, b => b.type === 'field' && (b.crop > .05 || b.stock > 0), 80) || nearestTree(w, s.x, s.z, t => t.food > 0, 60);
    if (f) { const a = Math.atan2(f.z - s.z, f.x - s.x); s.x += Math.cos(a) * dt * 5; s.z += Math.sin(a) * dt * 5; if (dist(s.x, s.z, f.x, f.z) < 3) { if (f.crop !== undefined && f.type === 'field') { f.crop = Math.max(0, f.crop - dt * .25); f.stock = Math.max(0, f.stock - dt * 4); } else f.food = 0; } }
    else { s.x += rr(w, -1, 1); s.z += rr(w, -1, 1); }
    if (dist(s.x, s.z, w.center.x, w.center.z) < 35) w.res.food = Math.max(0, w.res.food - dt * .5);
  }
  w.locusts = w.locusts.filter(s => s.life > 0);
  // flood recedes
  if (w.flood) {
    const F = w.flood; F.t -= dt;
    const target = F.t > 0 ? F.level : w.baseWater;
    w.water = lerp(w.water, target, Math.min(1, dt * .15)) + Math.sign(target - w.water) * Math.min(Math.abs(target - w.water), dt * .01);
    if (Math.abs(w.water - (F.tiled ?? 0)) > .04) { F.tiled = w.water; retile(w, 0, 0, N - 1, N - 1); }
    if (F.t <= 0 && Math.abs(w.water - w.baseWater) < .03) { w.water = w.baseWater; retile(w, 0, 0, N - 1, N - 1); computeWaterDist(w); w.flood = null; }
    if (rnd(w) < dt * 2) {
      for (const p of w.people) if (p.alive && isWater(tileAt(w, p.x, p.z)) && w.water - hAt(w, p.x, p.z) > 1.1) { if (rnd(w) < .15) hurt(w, p, .35, 'drowned in the flood', 'flood'); else { const s = shoreSpot(w, p); if (s) { p.task = { k: 'wander', pt: s }; p.running = true; } } }
      for (const b of w.buildings) if (w.water - hAt(w, b.x, b.z) > .3 && b.type !== 'dock') damageBuilding(w, b, .04, 'the flood');
    }
  }
}

// -------------------------------------------------------------- god powers
function spend(w, cost) { if (w.god.unlimited) return true; if (w.god.mana < cost) return false; w.god.mana -= cost; return true; }
const POWER_COST = { lightning: 8, fire: 6, rain: 10, storm: 30, meteor: 55, quake: 40, tornado: 40, flood: 50, plague: 30, locusts: 22, volcano: 65, heal: 10, harvest: 18, bless: 20, resurrect: 35, fertility: 12, inspire: 28, prophet: 25, sign: 12, spawn: 6, raise: 1, lower: 1, forest: 8, hand: 0, raiders: 20, sun: 10, smite: 8 };

function strike(w, x, z, byGod = true) {
  event(w, 'lightning', { x, z });
  let killed = null;
  for (const p of w.people) if (p.alive && !p.inside && dist(p.x, p.z, x, z) < 1.4) { hurt(w, p, 1.2, 'was struck by lightning', byGod ? 'lightning' : null); if (!p.alive) killed = p; }
  for (const r of w.raiders || []) if (r.alive && dist(r.x, r.z, x, z) < 1.8) { hurt(w, r, 2, 'was struck by lightning'); if (!r.alive && byGod) { answer(w, 'protect', x, z, 60); feel(w, x, z, 40, .12, .05, .1, `${w.god.name} struck down a raider`); godDeed(w, 1, 0); } }
  for (const a of w.animals) if (a.alive && dist(a.x, a.z, x, z) < 1.6) { hurtAnimal(w, a, 5); if (!a.alive && a.kind === 'wolf' && byGod) { answer(w, 'protect', x, z, 60); feel(w, x, z, 30, .06, .04, .06, `${w.god.name} killed a wolf`); godDeed(w, .5, 0); } }
  const t = nearestTree(w, x, z, q => !q.burnt, 1.6); if (t && rnd(w) < .8) ignite(w, t.x, t.z, 'tree', t);
  const bi = w.occ[tIdx(x, z)]; if (bi >= 0) { const b = bById(w, bi); if (b && b.type !== 'field' && b.type !== 'fire') { ignite(w, b.x, b.z, 'bld', b); damageBuilding(w, b, .15, 'lightning'); if (byGod) { feel(w, x, z, 30, -.06, .12, .04, `${w.god.name} set fire to the ${bName(w, b)}`); godDeed(w, 0, .5); } } }
  if (byGod && !killed) feel(w, x, z, 22, 0, .05, .03);
  return killed;
}
const GOD = {
  lightning(w, x, z) { if (!spend(w, POWER_COST.lightning)) return false; strike(w, x, z, true); return true; },
  fire(w, x, z) {
    if (!spend(w, POWER_COST.fire)) return false;
    const t = nearestTree(w, x, z, q => !q.burnt, 2.5); if (t) ignite(w, t.x, t.z, 'tree', t);
    const bi = w.occ[tIdx(x, z)]; if (bi >= 0) { const b = bById(w, bi); if (b && b.type !== 'fire') { ignite(w, b.x, b.z, 'bld', b); feel(w, x, z, 30, -.08, .12, .03, `${w.god.name} burned our ${bName(w, b)}`); godDeed(w, 0, 1); } }
    if (!t && bi < 0) { const f = ignite(w, x, z, 'ground'); if (f) f.byGod = true; }
    event(w, 'fireball', { x, z }); return true;
  },
  rain(w, x, z) {
    if (!spend(w, POWER_COST.rain)) return false;
    const W = w.weather; W.rain = DAY * .5; W.rx = x; W.rz = z; W.rr = 18; W.natural = false; W.moist = Math.min(1, W.moist + .45);
    for (const f of w.fires.slice()) if (dist(f.x, f.z, x, z) < 18) f.str -= .6;
    for (const b of w.buildings) if (b.type === 'field' && dist(b.x, b.z, x, z) < 20) b.work = Math.min(1, b.work + .3);
    const a = answer(w, 'rain', x, z, 30) + answer(w, 'fire', x, z, 30) + answer(w, 'harvest', x, z, 40);
    feel(w, x, z, 30, a ? .04 : .01, 0, .03, a ? null : null);
    event(w, 'rain', { x, z }); return true;
  },
  storm(w) { if (!spend(w, POWER_COST.storm)) return false; w.weather.storm = DAY * .5; w.weather.rain = DAY * .5; w.weather.rx = w.center.x; w.weather.rz = w.center.z; w.weather.rr = 90; feel(w, w.center.x, w.center.z, 80, -.03, .15, .05, `${w.god.name} sent a terrible storm`); godDeed(w, 0, .5); logEvent(w, 'destroy', `You sent a great storm over the valley.`); event(w, 'storm'); return true; },
  meteor(w, x, z) {
    if (!spend(w, POWER_COST.meteor)) return false;
    w.fx.push({ type: 'meteor', x, z, t: w.t, land: w.t + 2.2 * (w.speedHint || 1) });
    w.pendingMeteor = (w.pendingMeteor || []).concat({ x, z, at: w.t + 2.2 * (w.speedHint || 1) });
    for (const p of witnesses(w, x, z, 40)) { p.act = 'cower'; p.actT = 1.5; if (rnd(w) < .2) say(w, p, pick(w, ['The sky is falling!', `${w.god.name} is angry!`, 'Look up!'])); }
    return true;
  },
  meteorImpact(w, x, z) {
    const R = 6;
    for (let zz = Math.floor(z - R - 3); zz <= z + R + 3; zz++) for (let xx = Math.floor(x - R - 3); xx <= x + R + 3; xx++) {
      if (xx < 0 || zz < 0 || xx > N || zz > N) continue; const d = Math.hypot(xx - x, zz - z), j = zz * V + xx;
      if (d < R) w.H[j] -= (1 - (d / R) ** 2) * 4.5; else if (d < R + 3) w.H[j] += Math.sin((d - R) / 3 * Math.PI) * 1.2;
    }
    retile(w, x - R - 4, z - R - 4, x + R + 4, z + R + 4); computeWaterDist(w);
    for (const p of w.people.slice()) if (p.alive) { const d = dist(p.x, p.z, x, z); if (d < R + 1) hurt(w, p, 3, 'was killed by a falling star', 'meteor'); else if (d < R + 8 && !p.inside) { const a = Math.atan2(p.z - z, p.x - x); p.fly = { vx: Math.cos(a) * 9, vz: Math.sin(a) * 9, vy: 8, byGod: true }; p.y += .2; } }
    for (const r of w.raiders || []) if (r.alive && dist(r.x, r.z, x, z) < R + 1) hurt(w, r, 5, 'was killed by a falling star');
    for (const a of w.animals) if (a.alive && dist(a.x, a.z, x, z) < R + 1) hurtAnimal(w, a, 10);
    for (const t of w.trees) { const d = dist(t.x, t.z, x, z); if (d < R) t.dead = true; else if (d < R + 6 && rnd(w) < .5) ignite(w, t.x, t.z, 'tree', t); }
    for (const q of w.rocks) if (dist(q.x, q.z, x, z) < R) q.dead = true;
    for (const b of w.buildings.slice()) { const d = dist(b.x, b.z, x, z); if (d < R + 2) { damageBuilding(w, b, 5, 'a falling star'); } else if (d < R + 8) damageBuilding(w, b, .4, 'a falling star'); }
    cleanDead(w);
    addRock(w, x, z, true).stone = 40;
    w.weather.dust = Math.min(1, w.weather.dust + .5);
    feel(w, x, z, 60, -.12, .35, .15, `${w.god.name} threw a star at the earth`); godDeed(w, 0, dist(x, z, w.center.x, w.center.z) < 30 ? 3 : .5);
    logEvent(w, 'destroy', `A falling star struck the valley${dist(x, z, w.center.x, w.center.z) < 30 ? ' beside ' + w.villageName : ''}.`, { x, z });
    event(w, 'impact', { x, z, r: R });
  },
  quake(w, x, z) { if (!spend(w, POWER_COST.quake)) return false; w.quake = { x, z, r: 28, t: 7 }; event(w, 'quake', { x, z }); feel(w, x, z, 50, -.1, .3, .08, `${w.god.name} shook the ground`); godDeed(w, 0, 2); logEvent(w, 'destroy', `You shook the earth.`, { x, z }); return true; },
  tornado(w, x, z) { if (!spend(w, POWER_COST.tornado)) return false; w.tornadoes.push({ id: nid(w), x, z, a: Math.atan2(w.center.z - z, w.center.x - x), life: 20 }); event(w, 'tornado', { x, z }); feel(w, x, z, 50, -.06, .2, .05, `${w.god.name} sent a whirlwind`); godDeed(w, 0, 1.5); logEvent(w, 'destroy', `A whirlwind touched down.`, { x, z }); return true; },
  flood(w) { if (!spend(w, POWER_COST.flood)) return false; w.flood = { level: w.baseWater + 1.4, t: DAY * .8 }; event(w, 'flood'); feel(w, w.center.x, w.center.z, 90, -.08, .25, .08, `${w.god.name} raised the waters`); godDeed(w, 0, 2); logEvent(w, 'destroy', `The lake rose and flooded the lowlands.`); return true; },
  plague(w, x, z) {
    if (!spend(w, POWER_COST.plague)) return false;
    let n = 0; for (const p of w.people) if (p.alive && dist(p.x, p.z, x, z) < 6 && !p.gifts.immortal) { p.sick = .1; p.health = Math.min(p.health, .8); n++; }
    w._godPlague = true; event(w, 'plague', { x, z }); feel(w, x, z, 40, -.1, .2, .04, `${w.god.name} sent a sickness`); godDeed(w, 0, 2);
    logEvent(w, 'plague', n ? `You sent a sickness into ${w.villageName}. ${n} fell ill.` : 'A sickness hung in the air, but found no one.', { x, z }); return true;
  },
  locusts(w, x, z) { if (!spend(w, POWER_COST.locusts)) return false; w.locusts.push({ x, z, life: DAY * .4 }); event(w, 'locusts', { x, z }); feel(w, x, z, 60, -.08, .15, .05, `${w.god.name} sent locusts`); godDeed(w, 0, 1.5); logEvent(w, 'destroy', `A cloud of locusts descended on the fields.`, { x, z }); return true; },
  volcano(w) {
    if (!spend(w, POWER_COST.volcano)) return false;
    const M = w.layout.M; w.lava.push({ x: M.x, z: M.z, t: DAY * .6, heads: [0, 1, 2].map(k => ({ x: M.x + Math.cos(k * 2.1) * 2, z: M.z + Math.sin(k * 2.1) * 2 })), cells: [] });
    w.weather.dust = Math.min(1, w.weather.dust + .6); event(w, 'volcano', { x: M.x, z: M.z }); feel(w, M.x, M.z, 200, -.06, .3, .1, `${w.god.name} woke the mountain`); godDeed(w, 0, 1.5);
    logEvent(w, 'destroy', `The mountain woke and rivers of fire ran down its sides.`, { x: M.x, z: M.z }); return true;
  },
  heal(w, x, z) {
    if (!spend(w, POWER_COST.heal)) return false;
    let n = 0; for (const p of w.people) if (p.alive && dist(p.x, p.z, x, z) < 7) { if (p.sick || p.injured || p.health < 1) { n++; answer(w, 'heal', null, null, 0, p.id); think(w, p, `Healed by ${w.god.name}`, 3); remember(w, p, `${w.god.name} healed me`, 1); p.love = clamp(p.love + .2, -1, 1); } p.sick = 0; p.injured = 0; p.health = 1; }
    answer(w, 'mercy', x, z, 30); answer(w, 'safe', x, z, 10); answer(w, 'family', x, z, 10); event(w, 'heal', { x, z }); feel(w, x, z, 20, n ? .06 : .01, 0, n ? .06 : .01); if (n) { godDeed(w, n * .4, 0); logEvent(w, 'bless', `You healed ${n} ${n === 1 ? 'person' : 'people'}.`, { x, z }); } return true;
  },
  harvest(w, x, z) {
    if (!spend(w, POWER_COST.harvest)) return false;
    let f = 0; for (const b of w.buildings) if (b.type === 'field' && dist(b.x, b.z, x, z) < 16) { b.planted = true; b.crop = 1.25; b.blessed = true; f++; }
    for (const t of w.trees) if (t.kind === 'berry' && dist(t.x, t.z, x, z) < 16) t.food = 8;
    for (let k = 0; k < 6; k++) { const a = rr(w, 0, 6.28), d = rr(w, 2, 10); const tx = x + Math.cos(a) * d, tz = z + Math.sin(a) * d; if (onLand(w, tx, tz) && w.occ[tIdx(tx, tz)] < 0) addTree(w, 'berry', tx, tz).food = 8; }
    const nearV = dist(x, z, w.center.x, w.center.z) < 30; if (nearV) w.res.food += 25 + living(w).length * .5;
    answer(w, 'food', x, z, 40); answer(w, 'mercy', x, z, 60); answer(w, 'winter', x, z, 60); answer(w, 'harvest', x, z, 60); answer(w, 'hunt', x, z, 60); answer(w, 'family', x, z, 25); event(w, 'harvest', { x, z }); feel(w, x, z, 30, .06, 0, .06, `${w.god.name} filled our baskets`); godDeed(w, .8, 0); return true;
  },
  bless(w, p, gift) {
    if (!p || !p.alive) return false; if (!spend(w, POWER_COST.bless)) return false;
    p.gifts[gift] = true;
    if (gift === 'giant') p.height = 1.6; if (gift === 'charm' && !p.spouse) { const m = w.people.find(q => q.alive && !q.spouse && q.sex !== p.sex && ageOf(w, q) >= 16 && !related(p, q)); if (m) marry(w, p, m); answer(w, 'love', null, null, 0, p.id); }
    if (gift === 'fertile') answer(w, 'child', null, null, 0, p.id);
    if (gift === 'wise') answer(w, 'wisdom', null, null, 0, p.id);
    p.health = 1; p.sick = 0;
    answer(w, 'mercy', p.x, p.z, 30); answer(w, 'safe', null, null, 0, p.id); answer(w, 'family', p.x, p.z, 4);
    const txt = { immortal: 'eternal life', strong: 'the strength of ten', swift: 'the speed of the wind', wise: 'great wisdom', giant: 'the size of a giant', fertile: 'many children', charm: 'a charm no one can resist' }[gift];
    think(w, p, `Blessed with ${txt}`, 4); remember(w, p, `${w.god.name} gave me ${txt}`, 1); p.love = clamp(p.love + .4, -1, 1); p.faith = clamp01(p.faith + .4);
    say(w, p, pick(w, [`I feel it! ${w.god.name} chose me!`, `Thank you, ${w.god.name}!`, 'What is happening to me?']));
    feel(w, p.x, p.z, 20, .05, .02, .08); godDeed(w, .6, 0);
    logEvent(w, 'bless', `You gave ${p.name} ${txt}.`, { x: p.x, z: p.z, pid: p.id }); event(w, 'bless', { x: p.x, z: p.z, id: p.id }); return true;
  },
  unbless(w, p) { p.gifts = {}; p.height = rr(w, .92, 1.08); logEvent(w, 'bless', `You took back your gifts from ${p.name}.`, { x: p.x, z: p.z }); event(w, 'bless', { x: p.x, z: p.z, id: p.id }); return true; },
  smite(w, p) { if (!p || !p.alive) return false; if (!spend(w, POWER_COST.smite)) return false; const imm = p.gifts.immortal; p.gifts.immortal = false; strike(w, p.x, p.z, true); if (p.alive) { hurt(w, p, 3, 'was struck down by the god', 'lightning'); } if (imm && !p.alive) logEvent(w, 'destroy', `You took back ${p.name}'s eternal life, and their life with it.`); return true; },
  resurrect(w, pid) {
    const p = w.dead.get(pid); if (!p) return false; if (!spend(w, POWER_COST.resurrect)) return false;
    const g = w.graves.find(q => q.pid === pid);
    p.alive = true; p.health = 1; p.sick = 0; p.injured = 0; p.hunger = 1; p.act = 'fallen'; p.actT = 2; p.task = null; p.fly = null; p.cause = null;
    if (g) { p.x = g.x; p.z = g.z + .8; w.graves = w.graves.filter(q => q !== g); }
    p.y = hAt(w, p.x, p.z);
    w.dead.delete(pid); w.people.push(p); p.home = 0;
    p.faith = 1; p.love = .8; p.prophet = true; remember(w, p, `${w.god.name} brought me back from death`, 2); think(w, p, 'I have seen what lies beyond', 4);
    for (const id of p.parents.concat(p.kids, [p.spouse || 0])) { const q = personById(w, id); if (q && q.alive) { q.grief = 0; q.love = clamp(q.love + .5, -1, 1); q.faith = clamp01(q.faith + .4); if (q.lostKid && q.lostKid.id === pid) q.lostKid = null; } }
    const sp = personById(w, p.spouse); if (sp && (!sp.alive || sp.spouse !== p.id)) p.spouse = 0;
    answer(w, 'revive', null, null, 0, pid);
    feel(w, p.x, p.z, 40, .25, .1, .3, `${w.god.name} raised ${p.name} from the dead`); godDeed(w, 2, 0); w.god.deeds.miracles++;
    logEvent(w, 'bless', `You raised ${p.name} from the dead. The whole village came to see.`, { x: p.x, z: p.z, pid });
    event(w, 'resurrect', { x: p.x, z: p.z, id: pid }); say(w, p, pick(w, [`I saw ${w.god.name}'s light...`, 'I was gone... and now I am here.']), 7);
    return true;
  },
  fertility(w, x, z) {
    if (!spend(w, POWER_COST.fertility)) return false; let n = 0;
    for (const p of w.people) if (p.alive && p.sex === 'f' && p.spouse && !p.pregnant && ageOf(w, p) >= 16 && ageOf(w, p) <= 45 && dist(p.x, p.z, x, z) < 10) { p.pregnant = YEAR * .5; n++; answer(w, 'child', null, null, 0, p.id); think(w, p, 'Blessed with a child', 4); }
    event(w, 'fertility', { x, z }); feel(w, x, z, 20, .05, 0, .05); godDeed(w, n * .3, 0); if (n) logEvent(w, 'bless', `${n} ${n === 1 ? 'woman is' : 'women are'} expecting after your blessing.`, { x, z }); return true;
  },
  inspire(w, p) {
    if (!p || !p.alive) return false; if (!spend(w, POWER_COST.inspire)) return false;
    const nx = AGES[w.age + 1]; const gain = nx ? (nx.k - AGES[w.age].k) * .15 : 200; w.knowledge += gain;
    answer(w, 'wisdom', null, null, 0, p.id); p.gifts.wise = true;
    const idea = ['how to make fire last through the rain', 'the turning of the seasons', 'counting with knots', 'the wheel', 'writing', 'the lever', 'medicine from leaves', 'the stars as a map', 'the printing press', 'steam', 'electricity', 'the computer'][Math.min(11, w.age * 2 + Math.floor(rnd(w) * 2))];
    logEvent(w, 'bless', `You whispered an idea to ${p.name}: ${idea}.`, { x: p.x, z: p.z, pid: p.id }); say(w, p, pick(w, ['I have it! I understand!', `${w.god.name} showed me something wonderful!`, 'Everyone, come and see!']));
    event(w, 'inspire', { x: p.x, z: p.z, id: p.id }); godDeed(w, .5, 0); feel(w, p.x, p.z, 15, .03, 0, .04); return true;
  },
  prophet(w, p) {
    if (!p || !p.alive) return false; if (!spend(w, POWER_COST.prophet)) return false;
    p.prophet = true; p.faith = 1; p.love = Math.max(p.love, .6); think(w, p, `${w.god.name} spoke to me`, 5); remember(w, p, `${w.god.name} gave me a vision`, 2);
    logEvent(w, 'bless', `You sent ${p.name} a vision. They will speak for you now.`, { x: p.x, z: p.z, pid: p.id });
    say(w, p, `I have seen ${w.god.name}! Listen to me, all of you!`, 7); event(w, 'vision', { x: p.x, z: p.z, id: p.id }); return true;
  },
  sign(w) { if (!spend(w, POWER_COST.sign)) return false; answer(w, 'sign', null, null, 0); feel(w, w.center.x, w.center.z, 120, .04, .03, .12, `${w.god.name} painted the sky`); w.god.deeds.miracles++; event(w, 'sign'); logEvent(w, 'bless', `You painted the sky with light. Everyone stopped to look up.`); for (const p of living(w)) if (!p.inside && rnd(w) < .5) { p.act = 'cheer'; p.actT = 2; } return true; },
  sun(w) { if (!spend(w, POWER_COST.sun)) return false; w.weather.rain = 0; w.weather.storm = 0; w.weather.clouds = 0; w.weather.dust = 0; event(w, 'sun'); return true; },
  spawn(w, x, z, kind) {
    if (!spend(w, POWER_COST.spawn)) return false;
    if (!onLand(w, x, z)) { if (kind === 'fish') { w.fish += 30; event(w, 'spawn', { x, z, kind }); return true; } return false; }
    const n = kind === 'mammoth' ? 2 : kind === 'wolf' ? 3 : 4; let lead = null;
    for (let k = 0; k < n; k++) { const a = addAnimal(w, kind, x + rr(w, -1.5, 1.5), z + rr(w, -1.5, 1.5), { herd: lead ? lead.id : 0 }); if (!lead) lead = a; if (kind === 'dog') { const o = nearest(w.people, x, z, p => p.alive); a.owner = o ? o.id : 0; } }
    if (kind === 'deer' || kind === 'boar' || kind === 'mammoth') answer(w, 'hunt', x, z, 60);
    event(w, 'spawn', { x, z, kind }); return true;
  },
  forest(w, x, z) {
    if (!spend(w, POWER_COST.forest)) return false;
    for (let k = 0; k < 18; k++) { const a = rr(w, 0, 6.28), d = Math.sqrt(rnd(w)) * 6, tx = x + Math.cos(a) * d, tz = z + Math.sin(a) * d, i = tIdx(tx, tz); if (i < 0 || isWater(w.tile[i]) || w.occ[i] >= 0 || w.road[i]) continue; const t = w.tile[i]; addTree(w, t === TT.JUNGLE ? pick(w, ['jungle', 'palm']) : t === TT.FOREST || t === TT.ROCK ? 'pine' : pick(w, ['broad', 'broad', 'berry']), tx, tz).grow = .15 + rnd(w) * .3; }
    w.treesDirty = true; event(w, 'forest', { x, z }); return true;
  },
  terraform(w, x, z, dir, dt = .1) {
    if (!spend(w, POWER_COST.raise * dt * 5)) return false;
    const R = 4;
    for (let zz = Math.floor(z - R); zz <= z + R; zz++) for (let xx = Math.floor(x - R); xx <= x + R; xx++) {
      if (xx < 0 || zz < 0 || xx > N || zz > N) continue; const d = Math.hypot(xx - x, zz - z); if (d > R) continue;
      if (w.occ[tIdx(Math.min(xx, N - 1), Math.min(zz, N - 1))] >= 0) continue;
      w.H[zz * V + xx] = clamp(w.H[zz * V + xx] + dir * dt * 5 * (1 - d / R), -5, 26);
    }
    retile(w, x - R - 1, z - R - 1, x + R + 1, z + R + 1);
    for (const t of w.trees) if (dist(t.x, t.z, x, z) < R && isWater(tileAt(w, t.x, t.z))) t.dead = true;
    if (rnd(w) < .1) { cleanDead(w); computeWaterDist(w); }
    return true;
  },
  raiders(w) { if (!spend(w, POWER_COST.raiders)) return false; spawnRaid(w, 4 + w.age); godDeed(w, 0, 1); return true; },
  pickUp(w, kind, id) {
    const e = kind === 'p' ? (personById(w, id)) : w.animals.find(a => a.id === id);
    if (!e || e.alive === false || e.inside) return false;
    w.hand = { kind, id }; e.fly = null; e.task = null;
    if (kind === 'p') { say(w, e, pick(w, ['Put me down!', `${w.god.name}?! Is that you?`, 'I am flying!', 'Aaah!']), 3); feel(w, e.x, e.z, 14, 0, .04, .05); }
    event(w, 'pickup', { x: e.x, z: e.z }); return true;
  },
  drop(w, x, z, y, vx, vz, vy) {
    const H = w.hand; if (!H) return; w.hand = null;
    const e = H.kind === 'p' ? personById(w, H.id) : w.animals.find(a => a.id === H.id); if (!e) return;
    e.x = clamp(x, .5, N - .5); e.z = clamp(z, .5, N - .5); e.y = y; e.fly = { vx, vz, vy, byGod: true };
    const v = Math.hypot(vx, vy, vz); if (v > 14 && H.kind === 'p') { feel(w, e.x, e.z, 25, -.05, .1, .03, `${w.god.name} threw ${e.name}`); godDeed(w, 0, .5); }
  },
  incarnate(w, p) { if (!p || !p.alive) return false; w.incarnate = p.id; p.task = null; p.inside = false; logEvent(w, 'bless', `You took the form of ${p.name} and walked among your people.`, { x: p.x, z: p.z, pid: p.id }); event(w, 'incarnate', { id: p.id }); return true; },
  ascend(w) { const p = personById(w, w.incarnate); w.incarnate = null; if (p) { p.task = null; event(w, 'ascend', { id: p.id }); } },
  // actions while in human form
  act(w, kind) {
    const p = personById(w, w.incarnate); if (!p || !p.alive) return null;
    if (kind === 'use') {
      // talk, chop, gather, attack, whatever is closest
      const a = nearest(w.animals, p.x, p.z, q => q.alive && !q.pen && q.kind !== 'dog', 1.8);
      const r = nearest(w.raiders || [], p.x, p.z, q => q.alive, 1.8);
      if (r || (a && a.kind !== 'dog')) { const tgt = r || a; p.act = 'attack'; p.actT = .5; p.dir = Math.atan2(tgt.z - p.z, tgt.x - p.x); if (r) hurt(w, r, .45, 'fell in battle'); else { hurtAnimal(w, a, 1, p); if (!a.alive) { p.carry = { type: 'food', amt: AK[a.kind].food }; a.eaten = true; } } return r ? 'You strike the raider.' : a.alive ? `You hit the ${a.kind}.` : `You killed the ${a.kind}. Take it home to the store.`; }
      const s = storeFor(w, p); if (p.carry && dist(p.x, p.z, s.x, s.z) < 4) { w.res[p.carry.type] = (w.res[p.carry.type] || 0) + p.carry.amt; const m = `You added ${Math.round(p.carry.amt)} ${p.carry.type} to the stores.`; p.carry = null; return m; }
      const q = nearest(w.people, p.x, p.z, o => o.alive && o !== p && !o.inside, 2.2);
      if (q) { p.dir = Math.atan2(q.z - p.z, q.x - p.x); q.dir = Math.atan2(p.z - q.z, p.x - q.x); q.actT = 2; q.act = 'talk'; const line = q.love > .4 ? `${q.name}: "They say ${w.god.name} walks among us. Do you believe it?"` : q.fear > .4 ? `${q.name}: "Keep your voice down. ${w.god.name} is always watching."` : q.hunger < .4 ? `${q.name}: "I am so hungry."` : pick(w, [`${q.name}: "Good day, ${p.name}."`, `${q.name}: "Have you seen my children?"`, `${q.name}: "The ${JOB_INFO[q.job].toLowerCase()}'s work never ends."`]); say(w, q, line.split(': ')[1].replace(/"/g, ''), 4); q.faith = clamp01(q.faith + .02); return line; }
      const t = nearestTree(w, p.x, p.z, o => !o.burnt && !o.fell, 1.8);
      if (t && !p.carry) { p.act = 'chop'; p.actT = .6; p.dir = Math.atan2(t.z - p.z, t.x - p.x); t.hits = (t.hits || 0) + 1; if (t.kind === 'berry' && t.food > 0) { p.carry = { type: 'food', amt: t.food }; t.food = 0; return 'You picked berries. Bring them to the store.'; } if (t.hits >= 4 && t.wood > 0) { t.fell = w.t; t.fellDir = p.dir; p.carry = { type: 'wood', amt: t.wood }; t.wood = 0; event(w, 'treefall', { id: t.id }); return 'Timber! Carry the wood to the store.'; } return 'You swing your axe.'; }
      return null;
    }
    if (kind === 'preach') { p.act = 'preach'; p.actT = 2; feel(w, p.x, p.z, 8, .05, 0, .06); say(w, p, pick(w, [`${w.god.name} is here, among you!`, 'Believe! The god walks with us!', 'Be kind to each other. That is all the god asks.']), 4); return 'You preach to everyone nearby. Their faith grows.'; }
    return null;
  },
};
function processPending(w) {
  if (w.pendingMeteor) { const now = w.pendingMeteor.filter(m => w.t >= m.at); w.pendingMeteor = w.pendingMeteor.filter(m => w.t < m.at); for (const m of now) GOD.meteorImpact(w, m.x, m.z); }
}
/*SIM-END*/

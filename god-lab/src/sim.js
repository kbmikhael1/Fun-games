/*SIM-START*/
'use strict';
// ===========================================================================
// God Lab simulation. Pure logic, no DOM: runs in the browser and in Node.
// Units: 1 tile = 1 unit of distance. 1 tick = 1/600 of a year.
// ===========================================================================
const TPY = 600;                 // ticks per year
const MAX_CREATURES = 1700;
const CELL = 8;                  // spatial hash cell size (tiles)

// Genes: every value is 0..1
const G = { size: 0, speed: 1, sight: 2, diet: 3, fur: 4, aquatic: 5, aggr: 6, herd: 7, fert: 8, life: 9, resist: 10, intel: 11, hue: 12, pattern: 13, legs: 14 };
const NG = 15;
const GENE_INFO = [
  ['size', 'Size'], ['speed', 'Speed'], ['sight', 'Sight'], ['diet', 'Meat in diet'], ['fur', 'Fur'],
  ['aquatic', 'Aquatic'], ['aggr', 'Aggression'], ['herd', 'Herding'], ['fert', 'Fertility'], ['life', 'Lifespan'],
  ['resist', 'Disease resistance'], ['intel', 'Intelligence'], ['hue', 'Colour'], ['pattern', 'Pattern'], ['legs', 'Legs'],
];
// how much each gene counts toward "is this a different species"
const GENE_W = [1.2, 1, .7, 1.4, 1, 1.4, .7, .6, .6, .6, .5, 1, .45, .5, .5];
// tuning knobs (tests read these too)
const PARAMS = { growth: .0007, specT: .44, kill: .14, mut: .055 };

// Biomes
const B = { DEEP: 0, SHALLOW: 1, BEACH: 2, GRASS: 3, FOREST: 4, JUNGLE: 5, SAVANNA: 6, DESERT: 7, TUNDRA: 8, SNOW: 9, MOUNTAIN: 10, ROCK: 11 };
const BIOME_NAME = ['Deep ocean', 'Shallows', 'Beach', 'Grassland', 'Forest', 'Jungle', 'Savanna', 'Desert', 'Tundra', 'Snow', 'Mountain', 'Volcanic rock'];
const BIOME_CAP = [.3, .6, .15, 1.0, 1.2, 1.5, .6, .12, .35, .04, .15, .03];
const isWater = b => b <= 1;

// Creature states (what they're doing; shown in the inspector)
const ST = { WANDER: 0, GRAZE: 1, HUNT: 2, FLEE: 3, MATE: 4, SEEK: 5, HOME: 6, MIGRATE: 7, FOLLOW: 8, PLAYER: 9, REST: 10, WAR: 11 };
const ST_TEXT = ['Wandering', 'Grazing', 'Hunting', 'Fleeing', 'Looking for a mate', 'Seeking comfort', 'Heading home', 'Migrating', 'Following the leader', 'Guided by you', 'Resting', 'At war'];

// ---------------------------------------------------------------- random
function rng32(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, 1 | t); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
// world-owned RNG whose state is a plain number, so snapshots capture it
function rand(w) {
  w.rs = (w.rs + 0x6D2B79F5) >>> 0; let t = w.rs;
  t = Math.imul(t ^ t >>> 15, 1 | t); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
function gauss(w) { return (rand(w) + rand(w) + rand(w) + rand(w) - 2) * 0.866; }
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// ---------------------------------------------------------------- noise
function hash2(seed, x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise2(seed, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(seed, xi, yi), b = hash2(seed, xi + 1, yi), c = hash2(seed, xi, yi + 1), d = hash2(seed, xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm2(seed, x, y, oct = 5) {
  let s = 0, amp = 1, f = 1, n = 0;
  for (let o = 0; o < oct; o++) { s += amp * vnoise2(seed + o * 101, x * f, y * f); n += amp; amp *= .5; f *= 2.02; }
  return s / n;
}

// ---------------------------------------------------------------- names
const SYL_A = ['ka', 'mo', 'ra', 've', 'lu', 'sa', 'to', 'ni', 'ze', 'qua', 'dro', 'pha', 'ly', 'xe', 'bo', 'ti', 'gal', 'mer', 'os', 'un', 'ar', 'el', 'ith', 'or', 'va', 'syl', 'cor', 'tha'];
const SYL_B = ['x', 'n', 'th', 'r', 's', 'l', 'm', 'rix', 'dor', 'lis', 'nax', 'mus', 'ra', 'ia', 'on', 'eus', 'ax', 'is'];
function wordFrom(r, n = 2) { let s = ''; for (let i = 0; i < n; i++) s += SYL_A[Math.floor(r() * SYL_A.length)]; return s + SYL_B[Math.floor(r() * SYL_B.length)]; }
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
const HUE_NAMES = [[0, 'Crimson'], [20, 'Rust'], [38, 'Amber'], [52, 'Golden'], [75, 'Lime'], [110, 'Moss'], [150, 'Jade'], [175, 'Teal'], [200, 'Azure'], [225, 'Cobalt'], [255, 'Indigo'], [280, 'Violet'], [310, 'Orchid'], [335, 'Rose'], [360, 'Crimson']];
function hueName(h) { let best = HUE_NAMES[0]; for (const e of HUE_NAMES) if (Math.abs(e[0] - h) < Math.abs(best[0] - h)) best = e; return best[1]; }
// The trait that most sets a species apart from its parent gives it its name.
const TRAIT_WORDS = {
  [G.size]: ['Giant', 'Dwarf'], [G.speed]: ['Swift', 'Plodding'], [G.sight]: ['Keen-eyed', 'Blind'], [G.diet]: ['Fanged', 'Gentle'],
  [G.fur]: ['Woolly', 'Naked'], [G.aquatic]: ['Deep', 'Walking'], [G.aggr]: ['Fierce', 'Timid'], [G.herd]: ['Social', 'Lone'],
  [G.fert]: ['Prolific', 'Rare'], [G.life]: ['Ancient', 'Fleeting'], [G.resist]: ['Hardy', 'Frail'], [G.intel]: ['Clever', 'Simple'],
  [G.pattern]: ['Striped', 'Plain'], [G.legs]: ['Many-legged', 'Stub-legged'],
};
function speciesName(w, g, parentMean) {
  const r = rng32((w.rs ^ 0x9e3779b9) + w.species.length * 7919);
  const adj = [];
  if (parentMean) {
    let best = -1, bd = 0;
    for (const k of Object.keys(TRAIT_WORDS)) { const d = g[k] - parentMean[k]; if (Math.abs(d) * GENE_W[k] > Math.abs(bd)) { bd = d * GENE_W[k]; best = +k; } }
    if (best >= 0) adj.push(TRAIT_WORDS[best][bd > 0 ? 0 : 1]);
  } else {
    if (g[G.size] > .72) adj.push('Great'); else if (g[G.size] < .2) adj.push('Pygmy');
    else if (g[G.fur] > .72) adj.push('Woolly');
    else if (g[G.pattern] > .66) adj.push('Striped'); else if (g[G.pattern] > .4) adj.push('Spotted');
  }
  adj.push(hueName(g[G.hue] * 360));
  let noun;
  const aq = g[G.aquatic], diet = g[G.diet];
  if (g[G.size] < .12 && aq > .6) noun = pick(r, ['Mite', 'Spore', 'Drifter', 'Flagellate']);
  else if (aq > .7) noun = diet > .55 ? pick(r, ['Shark', 'Pike', 'Barracuda', 'Reefjaw']) : pick(r, ['Finback', 'Minnow', 'Ray', 'Gulper']);
  else if (aq > .45) noun = diet > .55 ? pick(r, ['Snapper', 'Gator', 'Marshfang']) : pick(r, ['Wader', 'Newt', 'Paddler', 'Mudskipper']);
  else if (diet > .7) noun = pick(r, ['Stalker', 'Prowler', 'Fang', 'Raptor', 'Ripper']);
  else if (diet > .45) noun = pick(r, ['Scavenger', 'Forager', 'Rooter', 'Badger']);
  else if (g[G.size] > .65) noun = pick(r, ['Tusker', 'Behemoth', 'Plodder', 'Hornback']);
  else if (g[G.speed] > .6) noun = pick(r, ['Strider', 'Leaper', 'Dasher', 'Gazelle']);
  else noun = pick(r, ['Grazer', 'Nibbler', 'Burrower', 'Shrewlet', 'Hopper']);
  let name = `${adj.slice(0, 2).join(' ')} ${noun}`;
  const taken = new Set(w.species.map(s => s.name));
  if (taken.has(name)) { const extra = ['Lesser', 'Northern', 'Southern', 'Dusky', 'Pale', 'Horned', 'Long-tailed', 'Crested', 'Bristled', 'Painted', 'Hooded']; for (const e of extra) { if (!taken.has(`${e} ${name}`)) { name = `${e} ${name}`; break; } } }
  const sci = `${cap1(wordFrom(r, 1))} ${wordFrom(r, 1)}`;
  return { name, sci };
}
function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
function personName(w) {
  const r = () => rand(w);
  return cap1(pick(r, ['ka', 'mi', 'ta', 'lo', 'ze', 'ri', 'sa', 'no', 've', 'du', 'ay', 'o', 'e']) + pick(r, ['ra', 'lin', 'mo', 'ko', 'ri', 'sha', 'tu', 'vi', 'la', 'nde', 'x', 'ru']));
}
function plagueName(w) {
  const r = () => rand(w);
  return `The ${pick(r, ['Grey', 'Crimson', 'Weeping', 'Pale', 'Black', 'Burning', 'Silent', 'Green', 'Shivering', 'Hollow'])} ${pick(r, ['Rot', 'Fever', 'Blight', 'Cough', 'Pox', 'Wasting', 'Plague', 'Chill'])}`;
}
function tribeName(w) { const r = () => rand(w); return cap1(wordFrom(r, 1)) + pick(r, ['hold', 'fall', 'reach', 'haven', 'stead', 'mere', 'crest', 'ford']); }
function worldName(r) { return cap1(wordFrom(r, 2)); }

// ---------------------------------------------------------------- world
const WORLD_TYPES = {
  continent: { label: 'Continent', mask: 1, sea: .47, fr: 1, cold: 0, dry: 0 },
  archipelago: { label: 'Archipelago', mask: .7, sea: .53, fr: 1.8, cold: 0, dry: 0 },
  pangaea: { label: 'Pangaea', mask: 1.25, sea: .4, fr: .8, cold: 0, dry: .05 },
  frozen: { label: 'Frozen world', mask: 1, sea: .46, fr: 1, cold: .25, dry: 0 },
  desert: { label: 'Desert world', mask: 1.1, sea: .42, fr: 1, cold: -.08, dry: .3 },
};
function createWorld(opts = {}) {
  const W = opts.W || 240, H = opts.H || 150, N = W * H;
  const seed = (opts.seed >>> 0) || 12345;
  const type = WORLD_TYPES[opts.type] ? opts.type : 'continent';
  const T = WORLD_TYPES[type];
  const r = rng32(seed);
  const w = {
    W, H, seed, type, name: worldName(r), rs: seed ^ 0xa5a5a5,
    tick: 0, nextId: 1, nextSp: 1, nextStrain: 1, nextTribe: 1,
    elev: new Float32Array(N), moist: new Float32Array(N), tbase: new Float32Array(N),
    biome: new Uint8Array(N), food: new Float32Array(N), cap: new Float32Array(N), fert: new Float32Array(N).fill(1),
    fire: new Uint16Array(N), lava: new Uint16Array(N), scar: new Uint16Array(N),
    creatures: [], species: [], strains: [], tribes: [], prophets: [], fx: [], corpses: [], log: [], popHist: [],
    zones: [], // temporary regional effects: rain, rays, abundance
    climate: { temp: 0, target: 0, dust: 0, drought: 0, sea: 0, seaTarget: 0, iceUntil: 0, droughtUntil: 0, delugeUntil: 0 },
    stats: { births: 0, deaths: 0, byCause: {} },
    milestones: {}, player: 0, input: { dx: 0, dy: 0, bite: false, mate: false }, playerLineage: [],
    terrainDirty: true, dirtyRects: [], events: [],
  };
  // elevation: fractal noise shaped by an island mask
  const sx = r() * 1000, sy = r() * 1000;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const nx = x / W - .5, ny = (y / H - .5) * (H / W);
    const d = Math.sqrt(nx * nx * 1.1 + ny * ny * 2.2) * 2;
    let e = fbm2(seed, sx + x / 38 * T.fr, sy + y / 38 * T.fr, 6);
    const ridge = 1 - Math.abs(fbm2(seed + 7, sx + x / 22, sy + y / 22, 4) * 2 - 1);
    e = e * .78 + ridge * .22;
    e = e + (1 - d * d) * .42 * T.mask - .21 * T.mask;
    w.elev[i] = e - T.sea;
    const m = fbm2(seed + 31, sx + x / 30, sy + y / 30, 5);
    w.moist[i] = clamp01(m * 1.25 - .12 - T.dry);
    const lat = Math.abs(y / H - .5) * 2;
    w.tbase[i] = .9 - lat * .78 - T.cold;
  }
  // moisture near water
  for (let i = 0; i < N; i++) if (w.elev[i] < 0) w.moist[i] = 1;
  for (let pass = 0; pass < 2; pass++) for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x; let s = 0;
    s += w.moist[i - 1] + w.moist[i + 1] + w.moist[i - W] + w.moist[i + W];
    w.moist[i] = w.moist[i] * .6 + s / 4 * .4;
  }
  // edges are always ocean
  for (let x = 0; x < W; x++) for (const y of [0, 1, H - 2, H - 1]) w.elev[y * W + x] = Math.min(w.elev[y * W + x], -.3);
  for (let y = 0; y < H; y++) for (const x of [0, 1, W - 2, W - 1]) w.elev[y * W + x] = Math.min(w.elev[y * W + x], -.3);
  classifyAll(w);
  for (let i = 0; i < N; i++) w.food[i] = w.cap[i] * (.4 + .5 * hash2(seed, i, 3));
  return w;
}

function tileTemp(w, i) {
  const season = Math.sin((w.tick % TPY) / TPY * Math.PI * 2) * .06;
  return w.tbase[i] - Math.max(0, w.elev[i] - w.climate.sea) * .7 + w.climate.temp + season;
}
function classify(w, i) {
  const e = w.elev[i] - w.climate.sea;
  if (w.scar[i] > 0) { w.biome[i] = B.ROCK; }
  else if (e < -.12) w.biome[i] = B.DEEP;
  else if (e < 0) w.biome[i] = B.SHALLOW;
  else if (e < .025) w.biome[i] = B.BEACH;
  else {
    const t = w.tbase[i] - e * .7 + w.climate.temp, m = w.moist[i];
    if (e > .42) w.biome[i] = t < .35 ? B.SNOW : B.MOUNTAIN;
    else if (t < .16) w.biome[i] = B.SNOW;
    else if (t < .32) w.biome[i] = B.TUNDRA;
    else if (t > .68 && m < .32) w.biome[i] = B.DESERT;
    else if (t > .58 && m < .46) w.biome[i] = B.SAVANNA;
    else if (m > .62 && t > .6) w.biome[i] = B.JUNGLE;
    else if (m > .5) w.biome[i] = B.FOREST;
    else w.biome[i] = B.GRASS;
  }
  w.cap[i] = BIOME_CAP[w.biome[i]] * (.55 + .8 * w.moist[i]) * w.fert[i];
  if (w.food[i] > w.cap[i] * 1.6) w.food[i] = w.cap[i] * 1.6;
}
function classifyAll(w) { for (let i = 0; i < w.W * w.H; i++) classify(w, i); w.terrainDirty = true; }
function classifyRegion(w, x0, y0, rad) {
  const r = Math.ceil(rad);
  for (let y = Math.max(0, y0 - r); y <= Math.min(w.H - 1, y0 + r); y++) for (let x = Math.max(0, x0 - r); x <= Math.min(w.W - 1, x0 + r); x++) classify(w, y * w.W + x);
  w.dirtyRects.push([x0 - r, y0 - r, r * 2 + 1, r * 2 + 1]);
}
const tileAt = (w, x, y) => { const xi = x | 0, yi = y | 0; if (xi < 0 || yi < 0 || xi >= w.W || yi >= w.H) return -1; return yi * w.W + xi; };

// ---------------------------------------------------------------- creatures
function derive(c) {
  const g = c.g, b = c.bless || 0;
  c.mass = (.35 + 2.4 * Math.pow(g[G.size], 1.4)) * (b & 1 ? 2.2 : 1);
  c.r = .22 + .32 * Math.sqrt(c.mass);
  c.vmax = (.05 + .15 * g[G.speed]) / (.7 + .3 * Math.sqrt(c.mass)) * (b & 2 ? 1.8 : 1);
  c.sightR = 3 + 10 * g[G.sight] + 3 * g[G.intel];
  c.maxE = c.mass;
  c.life = TPY * (2.2 + 9 * g[G.life]) * (.8 + .2 * Math.sqrt(c.mass));
  c.mature = c.life * .14;
  c.herbEff = Math.pow(1 - g[G.diet], 1.3);
  c.meatEff = Math.pow(g[G.diet], 1.1);
  // upkeep per tick: body, eyes, brain, fur, fins
  c.upkeep = .0021 * Math.pow(c.mass, .75) + .0006 * g[G.sight] + .0012 * g[G.intel] + .0004 * g[G.fur] + .0003 * g[G.speed];
}
function newCreature(w, sp, g, x, y, parents) {
  const c = {
    id: w.nextId++, sp, g, x, y, dir: rand(w) * Math.PI * 2, energy: 0, health: 1, age: 0, gen: 1,
    parents: parents || [], kids: 0, kills: 0, st: ST.WANDER, tx: x, ty: y, target: 0,
    think: (rand(w) * 6) | 0, repCd: 0, inf: 0, infT: 0, imm: [], bless: 0, name: '', belief: null, tribe: 0,
    born: w.tick, walk: 0, spd: 0, lonely: 0, chase: 0, dead: false, cause: '',
  };
  derive(c);
  c.energy = c.maxE * .6;
  return c;
}
function makeSpecies(w, g, parent, founder) {
  const par = parent ? spById(w, parent) : null;
  const n = speciesName(w, g, par ? par.mean : null);
  const sp = {
    id: w.nextSp++, name: n.name, sci: n.sci, parent: parent || 0, born: w.tick, extinct: 0,
    hue: g[G.hue] * 360, mean: Float32Array.from(g), pop: 0, peak: 0, total: 0, sapient: false, announced: false,
    founder: founder || '', boost: 0, notes: [],
  };
  w.species.push(sp);
  return sp;
}
const spById = (w, id) => { for (let i = w.species.length - 1; i >= 0; i--) if (w.species[i].id === id) return w.species[i]; return null; };
const crById = (w, id) => { for (const c of w.creatures) if (c.id === id) return c; return null; };

// Design presets used for the starting life and the species designer.
const PRESETS = {
  grazer: { size: .35, speed: .45, sight: .45, diet: .05, fur: .35, aquatic: .08, aggr: .15, herd: .75, fert: .6, life: .35, resist: .4, intel: .1, pattern: .3, legs: .5 },
  giant: { size: .85, speed: .25, sight: .35, diet: .02, fur: .45, aquatic: .1, aggr: .45, herd: .5, fert: .25, life: .6, resist: .5, intel: .12, pattern: .1, legs: .6 },
  hunter: { size: .5, speed: .7, sight: .7, diet: .88, fur: .35, aquatic: .08, aggr: .75, herd: .45, fert: .45, life: .45, resist: .4, intel: .2, pattern: .7, legs: .5 },
  omnivore: { size: .4, speed: .5, sight: .5, diet: .5, fur: .4, aquatic: .15, aggr: .45, herd: .5, fert: .45, life: .4, resist: .45, intel: .25, pattern: .45, legs: .5 },
  swimmer: { size: .3, speed: .55, sight: .45, diet: .1, fur: .05, aquatic: .92, aggr: .15, herd: .8, fert: .65, life: .3, resist: .4, intel: .08, pattern: .5, legs: .1 },
  shark: { size: .6, speed: .7, sight: .6, diet: .9, fur: .05, aquatic: .95, aggr: .8, herd: .1, fert: .25, life: .5, resist: .4, intel: .15, pattern: .2, legs: .1 },
  cell: { size: .08, speed: .3, sight: .2, diet: .1, fur: .1, aquatic: .8, aggr: .1, herd: .3, fert: .9, life: .15, resist: .3, intel: 0, pattern: .5, legs: 0 },
};
function genesFrom(w, preset, hue) {
  const g = new Float32Array(NG);
  for (const [k, i] of Object.entries(G)) g[i] = preset[k] != null ? preset[k] : .5;
  g[G.hue] = hue != null ? hue : rand(w);
  return g;
}
// Spawn a group of a species around (x,y). Returns the species.
function spawnSpecies(w, genes, x, y, n = 10, opts = {}) {
  const sp = makeSpecies(w, genes, 0, opts.founder || 'Created by you');
  sp.announced = true;
  let placed = 0;
  for (let k = 0; k < n * 20 && placed < n; k++) {
    const px = x + gauss(w) * 3, py = y + gauss(w) * 3, i = tileAt(w, px, py);
    if (i < 0) continue;
    const g = Float32Array.from(genes);
    for (let j = 0; j < NG; j++) if (j !== G.hue) g[j] = clamp01(g[j] + gauss(w) * .025);
    const c = newCreature(w, sp.id, g, px, py);
    if (passFactor(c, w.biome[i]) < .2) continue;
    c.age = rand(w) * c.mature * 1.5; c.energy = c.maxE * .75;
    w.creatures.push(c); placed++;
  }
  sp.pop = placed; sp.peak = placed; sp.total = placed;
  if (!opts.quiet) logEvent(w, 'create', `You created the ${sp.name}.`, { sp: sp.id, x, y });
  return sp;
}

// ---------------------------------------------------------------- terrain movement
function passFactor(c, b) {
  const a = c.g[G.aquatic];
  if (b === B.DEEP) return a > .45 ? clamp01((a - .4) * 1.8) : 0;
  if (b === B.SHALLOW) return .35 + .65 * a;
  const land = 1 - clamp01((a - .55) * 2.6) * .96;
  if (b === B.MOUNTAIN || b === B.SNOW) return land * .5;
  return land;
}

// ---------------------------------------------------------------- spatial hash
function buildGrid(w, grid) {
  const gw = Math.ceil(w.W / CELL), gh = Math.ceil(w.H / CELL);
  if (!grid.cells || grid.gw !== gw) { grid.gw = gw; grid.gh = gh; grid.cells = Array.from({ length: gw * gh }, () => []); }
  for (const cell of grid.cells) cell.length = 0;
  for (const c of w.creatures) {
    const gx = clamp((c.x / CELL) | 0, 0, gw - 1), gy = clamp((c.y / CELL) | 0, 0, gh - 1);
    grid.cells[gy * gw + gx].push(c);
  }
}
const NB = [];
function neighbors(w, grid, x, y, r) {
  NB.length = 0;
  const x0 = clamp(((x - r) / CELL) | 0, 0, grid.gw - 1), x1 = clamp(((x + r) / CELL) | 0, 0, grid.gw - 1);
  const y0 = clamp(((y - r) / CELL) | 0, 0, grid.gh - 1), y1 = clamp(((y + r) / CELL) | 0, 0, grid.gh - 1);
  const r2 = r * r;
  for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
    for (const o of grid.cells[gy * grid.gw + gx]) { const dx = o.x - x, dy = o.y - y; if (dx * dx + dy * dy <= r2) NB.push(o); }
  }
  return NB;
}

// ---------------------------------------------------------------- decisions
function isPredatorOf(o, c) {
  if (o.g[G.diet] < .45 || o.dead) return false;
  if (o.belief && o.belief.type === 'peace') return false;
  return o.mass > c.mass * .45 && o.sp !== c.sp;
}
function canEat(c, o) {
  if (o.sp === c.sp || o.dead) return false;
  if (c.belief && c.belief.type === 'peace') return false;
  return o.mass < c.mass * (1.1 + c.g[G.aggr] * 1.1);
}
function bestFood(w, c, samples) {
  let best = -1, bv = -1;
  const here = tileAt(w, c.x, c.y);
  if (here >= 0 && passFactor(c, w.biome[here]) > .2) { best = here; bv = w.food[here] * 1.15; }
  const R = c.sightR * .8;
  for (let k = 0; k < samples; k++) {
    const a = rand(w) * Math.PI * 2, d = 1 + rand(w) * R;
    const i = tileAt(w, c.x + Math.cos(a) * d, c.y + Math.sin(a) * d);
    if (i < 0) continue;
    const pf = passFactor(c, w.biome[i]); if (pf < .25 || w.fire[i] || w.lava[i]) continue;
    const v = w.food[i] * pf * (isWater(w.biome[i]) ? 1 : Math.pow(1 - c.g[G.aquatic], 2)) - d * .01;
    if (v > bv) { bv = v; best = i; }
  }
  return best;
}
function comfortTile(w, c) {
  let best = -1, bv = 1e9;
  for (let k = 0; k < 8; k++) {
    const a = rand(w) * Math.PI * 2, d = 2 + rand(w) * c.sightR;
    const i = tileAt(w, c.x + Math.cos(a) * d, c.y + Math.sin(a) * d);
    if (i < 0 || passFactor(c, w.biome[i]) < .3) continue;
    const v = tempStress(c, tileTemp(w, i)) + d * .002;
    if (v < bv) { bv = v; best = i; }
  }
  return best;
}
// Fur sets how cold a creature can bear, and how much heat it can stand.
function tempStress(c, temp) {
  const fur = c.g[G.fur];
  const cold = .46 - .75 * fur, hot = .92 - .5 * fur + (1 - c.g[G.size]) * .05;
  return temp < cold ? cold - temp : temp > hot ? temp - hot : 0;
}
function ready(w, c) { return c.age > c.mature && c.repCd <= 0 && c.energy > c.maxE * .72 && !c.inf; }

function think(w, grid, c) {
  const nb = neighbors(w, grid, c.x, c.y, c.sightR);
  const sp = spById(w, c.sp);
  let threat = null, tdist = 1e9, prey = null, pscore = -1e9, mate = null, mdist = 1e9;
  let hx = 0, hy = 0, hn = 0, leader = null;
  const belief = c.belief;
  const iAmReady = ready(w, c);
  for (const o of nb) {
    if (o === c || o.dead) continue;
    const dx = o.x - c.x, dy = o.y - c.y, d2 = dx * dx + dy * dy;
    if (o.sp !== c.sp) {
      const alert = 2.5 + 4 * c.g[G.sight] + 2.5 * c.g[G.intel] + (o.st === ST.HUNT && o.target === c.id ? 1.5 : 0);
      if (d2 < alert * alert && isPredatorOf(o, c) && d2 < tdist && !(c.tribe && o.tribe && o.tribe === c.tribe)) { threat = o; tdist = d2; }
      if (c.g[G.diet] > .4 && canEat(c, o)) {
        // pick the nearest easy meal, not the biggest
        const s = -Math.sqrt(d2) - (o.mass / c.mass) * 3 - (o.st === ST.FLEE ? 2 : 0) - (o.bless & 4 ? 50 : 0);
        if (s > pscore) { pscore = s; prey = o; }
      }
      if (belief && belief.type === 'war' && o.sp === belief.sp && d2 < pscore * pscore + 1e9) { prey = o; pscore = 1e9; }
    } else {
      hx += o.x; hy += o.y; hn++;
      if (o.bless & 8) leader = o;
      if (iAmReady && d2 < mdist && ready(w, o)) { mate = o; mdist = d2; }
      // beliefs spread through the herd
      if (o.belief && !belief && rand(w) < .04 + c.g[G.herd] * .12) { c.belief = { ...o.belief }; }
    }
  }
  if (c.id === w.player) { c.st = ST.PLAYER; return; }
  const hunger = c.energy / c.maxE;
  const temp = tileTemp(w, tileAt(w, c.x, c.y) < 0 ? 0 : tileAt(w, c.x, c.y));
  const discomfort = tempStress(c, temp);

  // commandments from a messenger
  if (belief) {
    if (belief.type === 'migrate' && Math.hypot(belief.x - c.x, belief.y - c.y) > 4 && hunger > .3 && !threat) { c.st = ST.MIGRATE; c.tx = belief.x; c.ty = belief.y; return; }
    if (belief.type === 'war' && prey && hunger > .25) { c.st = ST.WAR; c.target = prey.id; c.tx = prey.x; c.ty = prey.y; return; }
  }
  // danger first, unless I'm the bigger one
  if (threat && !(c.g[G.diet] > .5 && c.mass > threat.mass * 1.2)) {
    const d = Math.sqrt(tdist) || 1;
    c.st = ST.FLEE; c.tx = c.x - (threat.x - c.x) / d * 6; c.ty = c.y - (threat.y - c.y) / d * 6; c.target = threat.id; return;
  }
  // follow a blessed alpha
  if (leader && hunger > .4 && Math.hypot(leader.x - c.x, leader.y - c.y) > 3) { c.st = ST.FOLLOW; c.tx = leader.x + gauss(w) * 1.5; c.ty = leader.y + gauss(w) * 1.5; return; }
  // tribes stay near home
  if (c.tribe) {
    const tb = w.tribes.find(t => t.id === c.tribe);
    if (tb && !tb.gone) {
      const home = 8 + tb.stage * 4 + Math.sqrt(tb.members) * 1.5;
      if (Math.hypot(tb.x - c.x, tb.y - c.y) > home && hunger > .3) { c.st = ST.HOME; c.tx = tb.x + gauss(w) * 2; c.ty = tb.y + gauss(w) * 2; return; }
      // share the tribe's food store
      if (hunger < .35 && tb.store > .05 && Math.hypot(tb.x - c.x, tb.y - c.y) < home + 2) { const take = Math.min(tb.store, c.maxE * .3); tb.store -= take; c.energy += take; }
      else if (hunger > .85 && tb.store < tb.storeMax) { const give = c.maxE * .12; tb.store += give; c.energy -= give; }
    } else c.tribe = 0;
  }
  // hungry carnivores with nothing in sight follow the scent of prey further away
  const huntAt = .6 + c.g[G.diet] * .2;
  if (hunger < huntAt && !prey && c.g[G.diet] > .6) {
    let best = null, bd = 1e9;
    for (const o of neighbors(w, grid, c.x, c.y, c.sightR * 2.6)) { if (o.dead || !canEat(c, o)) continue; const d = (o.x - c.x) ** 2 + (o.y - c.y) ** 2; if (d < bd) { bd = d; best = o; } }
    if (best) { c.st = ST.HUNT; c.target = 0; c.tx = best.x; c.ty = best.y; return; }
  }
  // hungry: hunt or graze
  if (hunger < huntAt) {
    const hungryForMeat = c.g[G.diet] > .4 && prey;
    if (hungryForMeat && (c.g[G.diet] > .7 || c.meatEff * prey.mass > c.herbEff * .5)) { c.st = ST.HUNT; c.target = prey.id; c.tx = prey.x; c.ty = prey.y; return; }
    if (c.herbEff > .08) {
      const i = bestFood(w, c, 5 + Math.round(c.g[G.intel] * 8));
      if (i >= 0) { c.st = ST.GRAZE; c.tx = (i % w.W) + .5; c.ty = ((i / w.W) | 0) + .5; return; }
    }
  }
  // breeding
  if (iAmReady) {
    if (mate) { c.st = ST.MATE; c.target = mate.id; c.tx = mate.x; c.ty = mate.y; c.lonely = 0; return; }
    c.lonely++;
    if ((sp && sp.pop < 6) || c.lonely > 6 || c.bless & 16) { reproduce(w, c, null); c.lonely = 0; return; }
  }
  if (discomfort > .02) { const i = comfortTile(w, c); if (i >= 0) { c.st = ST.SEEK; c.tx = (i % w.W) + .5; c.ty = ((i / w.W) | 0) + .5; return; } }
  if (hn > 0 && c.g[G.herd] > .35) {
    const mx = hx / hn, my = hy / hn;
    if (Math.hypot(mx - c.x, my - c.y) > 2 + (1 - c.g[G.herd]) * 5) { c.st = ST.WANDER; c.tx = mx + gauss(w) * 2; c.ty = my + gauss(w) * 2; return; }
  }
  // fed animals rest to save energy; big predators rest most of the day
  if (hunger > .75 && rand(w) < .25 + c.g[G.diet] * .6) { c.st = ST.REST; c.tx = c.x; c.ty = c.y; return; }
  // wander: keep drifting in a direction
  c.st = ST.WANDER;
  if (Math.hypot(c.tx - c.x, c.ty - c.y) < 1 || rand(w) < .15) { const a = c.dir + gauss(w) * 1.2; c.tx = c.x + Math.cos(a) * 6; c.ty = c.y + Math.sin(a) * 6; }
}

// ---------------------------------------------------------------- reproduction
function reproduce(w, a, b) {
  { const s0 = spById(w, a.sp); if (s0 && s0.erased) return; }
  // crowding: as the world fills up, fewer births succeed
  const crowd = w.creatures.length / MAX_CREATURES;
  if (crowd >= 1 || (crowd > .8 && rand(w) < (crowd - .8) * 5)) { a.repCd = 120; return; }
  const sp = spById(w, a.sp);
  let litter = 1 + Math.floor(a.g[G.fert] * 2.2 + (a.bless & 16 ? 2 : 0) + (sp && sp.boost > w.tick ? 1 : 0));
  const each = (.3 + .3 * a.g[G.diet]) * a.maxE * (b ? .6 : 1);
  // never breed yourself to death: litter shrinks to what the parent can afford
  litter = Math.max(1, Math.min(litter, Math.floor((a.energy - a.maxE * .3) / each)));
  const rays = zoneAt(w, 'rays', a.x, a.y);
  const mRate = (w.mutation || 1) * (rays ? 8 : 1);
  for (let k = 0; k < litter; k++) {
    const g = new Float32Array(NG);
    for (let j = 0; j < NG; j++) {
      let v = b ? (rand(w) < .5 ? a.g[j] : b.g[j]) : a.g[j];
      if (b && rand(w) < .3) v = (a.g[j] + b.g[j]) / 2;
      if (rand(w) < .5) v += gauss(w) * PARAMS.mut * mRate;
      if (rand(w) < .015 * mRate) v += gauss(w) * .25;
      g[j] = j === G.hue ? ((v % 1) + 1) % 1 : clamp01(v);
    }
    const ch = newCreature(w, a.sp, g, a.x + gauss(w) * .6, a.y + gauss(w) * .6, b ? [a.id, b.id] : [a.id]);
    ch.gen = Math.max(a.gen, b ? b.gen : 0) + 1;
    ch.energy = ch.maxE * (.45 + .35 * a.g[G.diet]);
    // big settlements don't absorb every child: some grow up to found villages of their own
    const tb0 = a.tribe ? w.tribes.find(t => t.id === a.tribe) : null;
    ch.tribe = tb0 && tb0.members < 28 ? a.tribe : 0;
    if (a.belief && rand(w) < .6) ch.belief = { ...a.belief };
    // gifts pass partly down the bloodline
    if (a.bless & 1 && rand(w) < .5) g[G.size] = clamp01(g[G.size] + .05);
    derive(ch);
    // a new species is born when a child drifts far from its parents' kind
    if (sp) {
      let d = 0; for (let j = 0; j < NG; j++) { let dd = g[j] - sp.mean[j]; if (j === G.hue) dd = Math.min(Math.abs(dd), 1 - Math.abs(dd)); d += GENE_W[j] * dd * dd; }
      if (Math.sqrt(d) > PARAMS.specT && sp.pop > 3) {
        const ns = makeSpecies(w, g, sp.id, `Descended from the ${sp.name}`);
        ch.sp = ns.id; ch.tribe = 0; ns.sapient = false;
      }
    }
    w.creatures.push(ch);
    const csp = spById(w, ch.sp); if (csp) { csp.pop++; csp.total++; }
    w.stats.births++;
    a.kids++; if (b) b.kids++;
    if (w.player && (a.id === w.player || (b && b.id === w.player))) w.playerLineage.push(ch.id);
  }
  const cost = litter * each;
  a.energy -= cost; if (b) b.energy -= cost * .7;
  const cd = TPY * (.55 - a.g[G.fert] * .35) * (a.bless & 16 ? .4 : 1);
  a.repCd = cd; if (b) b.repCd = cd;
}

// ---------------------------------------------------------------- movement and body
function stepCreature(w, grid, c) {
  if (--c.think <= 0) { c.think = 6; think(w, grid, c); }
  const i = tileAt(w, c.x, c.y);
  const b = i >= 0 ? w.biome[i] : B.DEEP;
  let speed = 0;
  let dx = 0, dy = 0;
  if (c.st === ST.PLAYER) {
    dx = w.input.dx; dy = w.input.dy; const m = Math.hypot(dx, dy);
    if (m > 0) { dx /= m; dy /= m; speed = 1; }
  } else {
    if (c.st === ST.HUNT || c.st === ST.WAR || c.st === ST.MATE || c.st === ST.FOLLOW) {
      const t = crById(w, c.target);
      if (t && !t.dead) { c.tx = t.x; c.ty = t.y; } else if (c.st !== ST.FOLLOW) c.think = 0;
    }
    dx = c.tx - c.x; dy = c.ty - c.y;
    const d = Math.hypot(dx, dy);
    if (d > .05) { dx /= d; dy /= d; }
    speed = c.st === ST.FLEE || c.st === ST.HUNT || c.st === ST.WAR ? 1 : c.st === ST.MATE || c.st === ST.MIGRATE || c.st === ST.HOME || c.st === ST.FOLLOW ? .6 : c.st === ST.SEEK ? .5 : c.st === ST.GRAZE ? (d < .6 ? 0 : .5) : c.st === ST.REST ? 0 : .3;
    if (d < .3) speed = 0;
    // predators sprint when prey is close; prey find a burst of speed when chased
    if ((c.st === ST.HUNT || c.st === ST.WAR) && d < 7.5 && c.target) {
      speed = 1.6;
      // a hunter gives up a chase that isn't working and rests instead
      if (++c.chase > 70) { c.chase = 0; c.st = ST.REST; c.tx = c.x; c.ty = c.y; c.think = 45; speed = 0; }
    } else if (c.st === ST.HUNT && !c.target) speed = .55;
    else if (c.st === ST.FLEE) speed = 1.0;
    if (c.st !== ST.HUNT && c.st !== ST.WAR) c.chase = 0;
  }
  if (speed > 0) {
    // steer smoothly
    const want = Math.atan2(dy, dx);
    let da = want - c.dir; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    c.dir += clamp(da, -.35, .35);
    let v = c.vmax * speed * passFactor(c, b);
    const nx = c.x + Math.cos(c.dir) * v, ny = c.y + Math.sin(c.dir) * v;
    const ni = tileAt(w, nx, ny);
    const pn = ni >= 0 ? passFactor(c, w.biome[ni]) : 0, ph = passFactor(c, b);
    if (ni >= 0 && (pn > .12 || pn >= ph)) { c.x = nx; c.y = ny; }
    else { c.dir += (rand(w) < .5 ? 1 : -1) * (.8 + rand(w)); v = 0; if (c.st !== ST.PLAYER) c.think = Math.min(c.think, 2); }
    c.spd = v; c.walk += v * 3;
    c.energy -= .0022 * c.mass * speed * speed * (1 + c.g[G.speed] * .4);
  } else c.spd = 0;
  // eat plants
  if (i >= 0 && c.herbEff > .05 && w.food[i] > .01 && (c.st === ST.GRAZE || c.st === ST.REST || c.st === ST.WANDER || c.st === ST.PLAYER || c.st === ST.HOME) && c.energy < c.maxE) {
    const bite = Math.min(w.food[i], .011 * Math.pow(c.mass, .75));
    w.food[i] -= bite; c.energy += bite * c.herbEff * 1.15;
  }
  // mating
  if (c.st === ST.MATE) {
    const m = crById(w, c.target);
    if (m && !m.dead && Math.hypot(m.x - c.x, m.y - c.y) < c.r + m.r + .4) { if (ready(w, c) && ready(w, m)) reproduce(w, c, m); c.think = 0; }
  }
  if (c.st === ST.PLAYER && w.input.mate && ready(w, c)) {
    let m = null; for (const o of neighbors(w, grid, c.x, c.y, c.r + 2)) if (o !== c && o.sp === c.sp && o.age > o.mature && !o.dead) { m = o; break; }
    if (m) reproduce(w, c, m); else if (!w.input._warned) { w.events.push({ t: w.tick, type: 'hint', text: 'No mate close enough. Get near one of your own kind.' }); w.input._warned = true; }
  }
  // bite prey
  if ((c.st === ST.HUNT || c.st === ST.WAR || (c.st === ST.PLAYER && w.input.bite)) && c.meatEff > .05) {
    let t = c.st === ST.PLAYER ? null : crById(w, c.target);
    if (c.st === ST.PLAYER) { let bd = 9; for (const o of neighbors(w, grid, c.x, c.y, c.r + 1.5)) { if (o === c || o.sp === c.sp) continue; const d = Math.hypot(o.x - c.x, o.y - c.y); if (d < bd) { bd = d; t = o; } } }
    if (t && !t.dead && Math.hypot(t.x - c.x, t.y - c.y) < c.r + t.r + .25) attack(w, c, t);
  }
  // metabolism, temperature, disease, aging
  c.energy -= c.upkeep * (c.bless & 32 ? .7 : 1) * (c.st === ST.REST ? .55 : 1);
  const temp = i >= 0 ? tileTemp(w, i) : .5;
  let stress = tempStress(c, temp) * (isWater(b) ? .35 : 1);
  if (c.tribe) { const tb = w.tribes.find(t => t.id === c.tribe); if (tb && tb.stage > 0 && Math.hypot(tb.x - c.x, tb.y - c.y) < 10) stress *= .3; }
  c.health -= stress * .06;
  const a = c.g[G.aquatic];
  if (b === B.DEEP && a < .45) c.health -= .02;                    // drowning
  if (!isWater(b) && a > .78) c.health -= .006 * (a - .7) * 4;      // gasping on land
  if (i >= 0 && (w.lava[i] || w.fire[i])) { c.health -= w.lava[i] ? .2 : .03; if (c.health <= 0) c.cause = w.lava[i] ? 'lava' : 'fire'; }
  if (c.inf) {
    const s = w.strains[c.inf - 1];
    c.health -= s.lethal * (1 - c.g[G.resist] * .7);
    if (--c.infT <= 0) { c.imm.push(s.id); c.inf = 0; }
  }
  if (c.energy > c.maxE * .5 && c.health < 1) c.health = Math.min(1, c.health + .0008);
  if (c.bless & 4) { c.health = Math.max(c.health, .5); }
  else c.age++;
  if (c.repCd > 0) c.repCd--;
  if (c.energy > c.maxE * 1.25) c.energy = c.maxE * 1.25;
  // death
  if (!c.cause) {
    if (c.energy <= 0) c.cause = 'starvation';
    else if (c.health <= 0) c.cause = c.inf ? 'plague' : b === B.DEEP && a < .45 ? 'drowning' : stress > 0 ? (temp < .5 ? 'cold' : 'heat') : 'injury';
    else if (c.age > c.life) c.cause = 'old age';
  }
  if (c.cause) c.dead = true;
}
function attack(w, c, t) {
  const tools = c.tribe ? (w.tribes.find(x => x.id === c.tribe) || { stage: 0 }).stage : 0;
  const odds = PARAMS.kill * (c.mass / t.mass) * (.5 + c.g[G.aggr]) * (1 + tools * .5) * (1 - (t.bless & 4 ? .9 : 0)) * (1 - t.g[G.aggr] * .3 * (t.mass / c.mass));
  if (rand(w) < odds) {
    t.dead = true; t.cause = `eaten by ${spById(w, c.sp).name.toLowerCase()}`;
    // the carcass: the hunter eats its fill, hungry pack-mates nearby share the rest
    let meat = (t.mass * 1.5 + Math.max(0, t.energy) * .5) * c.meatEff;
    const eat = Math.min(meat, c.maxE * 1.25 - c.energy); c.energy += eat; meat -= eat;
    if (meat > .05 && w._grid) for (const o of neighbors(w, w._grid, t.x, t.y, 5)) {
      if (meat <= .05) break;
      if (o.sp !== c.sp || o === c || o.dead || o.energy > o.maxE * .7) continue;
      const share = Math.min(meat, o.maxE * .8 - o.energy); o.energy += share; meat -= share;
    }
    c.kills++; c.think = 0;
    w.fx.push({ type: 'kill', x: t.x, y: t.y, t: w.tick, dur: 40, hue: spById(w, t.sp).hue });
  } else if (rand(w) < .02 * t.g[G.aggr] * (t.mass / c.mass)) {
    c.health -= .25; // prey fights back
    if (c.health <= 0) { c.dead = true; c.cause = `killed by ${spById(w, t.sp).name.toLowerCase()}`; }
  }
}

// ---------------------------------------------------------------- disease
function spreadDisease(w, grid) {
  for (const c of w.creatures) {
    if (!c.inf || c.dead || (c.think !== 1)) continue;
    const s = w.strains[c.inf - 1];
    for (const o of neighbors(w, grid, c.x, c.y, 1.6)) {
      if (o === c || o.inf || o.dead || o.imm.includes(s.id)) continue;
      const host = s.hosts.includes(o.sp) || s.any;
      let p = s.trans * 6 * (1 - o.g[G.resist] * .8);
      if (!host) { if (rand(w) < s.jump) { s.hosts.push(o.sp); logEvent(w, 'plague', `${s.name} jumped to the ${spById(w, o.sp).name}.`, { sp: o.sp, x: o.x, y: o.y }); } else continue; }
      if (rand(w) < p) { o.inf = s.id; o.infT = s.dur; s.cases++; }
    }
    // the virus mutates as it spreads
    if (rand(w) < .00012) {
      const base = s.base || s.name, fam = w.strains.filter(x => (x.base || x.name) === base).length + 1;
      const ns = { ...s, id: w.strains.length + 1, base, name: `${base} ${['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][fam] || fam}`, gen: fam, hosts: [...s.hosts], cases: 1, lethal: s.lethal * (.7 + rand(w) * .7), trans: s.trans * (.8 + rand(w) * .5) };
      w.strains.push(ns); c.inf = ns.id;
      logEvent(w, 'plague', `${s.name} mutated into a new strain: ${ns.name}.`, { x: c.x, y: c.y });
    }
  }
}

// ---------------------------------------------------------------- plants, fire, lava, climate
function stepTiles(w) {
  const N = w.W * w.H, phase = w.tick % 6, cl = w.climate;
  const drought = cl.drought, rainZones = w.zones.filter(z => z.type === 'rain');
  const season = Math.sin((w.tick % TPY) / TPY * Math.PI * 2);
  for (let i = phase; i < N; i += 6) {
    if (w.lava[i]) {
      w.lava[i]--; w.food[i] = 0;
      if (w.lava[i] === 0) { w.scar[i] = TPY * 6; classify(w, i); w.dirtyRects.push([i % w.W - 1, ((i / w.W) | 0) - 1, 3, 3]); }
      else if (w.lava[i] > 40 && rand(w) < .08) flowLava(w, i);
      continue;
    }
    if (w.scar[i]) { w.scar[i] = Math.max(0, w.scar[i] - 6); if (!w.scar[i]) { w.fert[i] = 1.35; classify(w, i); w.dirtyRects.push([i % w.W - 1, ((i / w.W) | 0) - 1, 3, 3]); } continue; }
    if (w.fire[i]) {
      w.fire[i] = w.fire[i] > 6 ? w.fire[i] - 6 : 0; w.food[i] *= .7;
      const x = i % w.W, y = (i / w.W) | 0;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = (y + oy) * w.W + x + ox; if (j < 0 || j >= N || w.fire[j] || isWater(w.biome[j])) continue;
        const dry = .12 + drought * .5 - w.moist[j] * .15;
        if (rand(w) < (w.food[j] / (w.cap[j] + .01)) * dry * (w.cap[j] > .3 ? 1 : .3)) w.fire[j] = 60 + (rand(w) * 60 | 0);
      }
      continue;
    }
    const cap = w.cap[i];
    if (cap <= 0) continue;
    const t = tileTemp(w, i);
    let g = PARAMS.growth * clamp(1.1 - Math.abs(t - .62) * 1.6, .05, 1) * (1 - drought * .75) * (1 + season * .15);
    for (const z of rainZones) { const dx = (i % w.W) - z.x, dy = ((i / w.W) | 0) - z.y; if (dx * dx + dy * dy < z.r * z.r) { g *= 2.5; w.fire[i] = 0; } }
    const f = w.food[i];
    if (f < cap) w.food[i] = f + g * 6 * cap * (.06 + f / cap) * (1 - f / cap);
    else if (f > cap) w.food[i] = f - (f - cap) * .004 * 6;
  }
}
function flowLava(w, i) {
  const x = i % w.W, y = (i / w.W) | 0;
  let best = -1, be = w.elev[i] + .02;
  for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const j = (y + oy) * w.W + x + ox; if (j < 0 || j >= w.W * w.H) continue;
    if (w.elev[j] < be + rand(w) * .03 && !w.lava[j]) { be = w.elev[j]; best = j; }
  }
  if (best >= 0) {
    if (isWater(w.biome[best])) { w.elev[best] += .03; classify(w, best); w.fx.push({ type: 'steam', x: best % w.W, y: (best / w.W) | 0, t: w.tick, dur: 90 }); w.dirtyRects.push([best % w.W - 1, ((best / w.W) | 0) - 1, 3, 3]); }
    else { w.lava[best] = w.lava[i] - 20; w.fire[best] = 0; }
  }
}
function stepClimate(w) {
  const c = w.climate;
  const iceTarget = w.tick < c.iceUntil ? -.32 : 0;
  c.dust *= .9993;
  const target = iceTarget - c.dust * .4 + (c.heat || 0);
  const prev = c.temp;
  c.temp += (target - c.temp) * .004;
  c.drought = w.tick < c.droughtUntil ? Math.min(1, c.drought + .004) : Math.max(0, c.drought - .002);
  c.seaTarget = w.tick < c.delugeUntil ? .14 : 0;
  const prevSea = c.sea;
  c.sea += clamp(c.seaTarget - c.sea, -.0004, .0004);
  // re-draw biomes as the climate shifts (snow spreads in an ice age, coasts drown in a deluge)
  if (Math.abs(c.temp - (w._lastClassT || 0)) > .03 || Math.abs(c.sea - (w._lastClassS || 0)) > .01) {
    w._lastClassT = c.temp; w._lastClassS = c.sea; classifyAll(w);
  }
  w.zones = w.zones.filter(z => z.until > w.tick);
}
function zoneAt(w, type, x, y) { for (const z of w.zones) if (z.type === type && (z.x - x) ** 2 + (z.y - y) ** 2 < z.r * z.r) return z; return null; }

// ---------------------------------------------------------------- tribes (the intelligence stage)
function stepTribes(w, grid) {
  // a species awakens once it's clever and numerous enough
  if (w.tick % 60 === 0) for (const sp of w.species) {
    if (sp.extinct || sp.sapient) continue;
    if (sp.mean[G.intel] > .55 && sp.pop >= 10) awaken(w, sp, false);
  }
  for (const c of w.creatures) {
    if (c.tribe || c.dead || c.think !== 2) continue;
    const sp = spById(w, c.sp); if (!sp || !sp.sapient || c.g[G.intel] < .35) continue;
    let near = null, nd = 40, count = 0;
    for (const t of w.tribes) { if (t.gone || t.sp !== c.sp) continue; count++; const d = Math.hypot(t.x - c.x, t.y - c.y); if (d < nd && t.members < 40) { nd = d; near = t; } }
    if (near) { c.tribe = near.id; continue; }
    if (count >= TRIBE_CAP) continue;
    let kin = 0; for (const o of neighbors(w, grid, c.x, c.y, 6)) if (o.sp === c.sp && !o.tribe) kin++;
    const i = tileAt(w, c.x, c.y);
    if (kin >= 3 && i >= 0 && (!isWater(w.biome[i]) || c.g[G.aquatic] > .6)) foundTribe(w, c);
  }
  if (w.tick % 30 === 0) {
    for (const t of w.tribes) t.members = 0;
    for (const c of w.creatures) if (c.tribe) { const t = w.tribes.find(x => x.id === c.tribe); if (t) t.members++; }
    for (const t of w.tribes) {
      if (t.gone) continue;
      if (t.members === 0) { if (!t.emptySince) t.emptySince = w.tick; if (w.tick - t.emptySince > TPY) { t.gone = w.tick; logEvent(w, 'tribe', `${t.name} was abandoned. Only ruins remain.`, { x: t.x, y: t.y }); } continue; }
      t.emptySince = 0;
      const age = (w.tick - t.born) / TPY;
      const sp = spById(w, t.sp);
      const firstOf = st => !w.tribes.some(o => o !== t && o.sp === t.sp && o.stage >= st);
      if (t.stage === 0 && t.members >= 7 && age > 1.5) { t.stage = 1; t.storeMax *= 2; (firstOf(1) ? logEvent : (w2, ty, tx, ex) => w2.log.push({ t: w2.tick, type: ty, text: tx, ...ex }))(w, 'tribe', `${t.name} of the ${sp.name} grew into a village. They are farming the land.`, { x: t.x, y: t.y, sp: t.sp }); farmAround(w, t); }
      else if (t.stage === 1 && t.members >= 16 && age > 5) { t.stage = 2; t.storeMax *= 2; (firstOf(2) ? logEvent : (w2, ty, tx, ex) => w2.log.push({ t: w2.tick, type: ty, text: tx, ...ex }))(w, 'tribe', `${t.name} became a town, with walls and a great hall.`, { x: t.x, y: t.y, sp: t.sp }); farmAround(w, t); milestone(w, 'town', 'A town rose.'); }
      // a crowded settlement sends out settlers to found a new village nearby
      if (t.members > 30 && w.tick % 300 === 0 && w.tribes.filter(o => !o.gone && o.sp === t.sp).length < TRIBE_CAP) splitTribe(w, t);
      if (t.faith >= 3 && !t.shrine) { t.shrine = w.tick; logEvent(w, 'faith', `${t.name} raised a shrine to you.`, { x: t.x, y: t.y, sp: t.sp }); milestone(w, 'shrine', 'Mortals built a shrine in your honour.'); }
      t.store = Math.min(t.storeMax, t.store + t.stage * .01);
    }
  }
}
const TRIBE_CAP = 12;
function splitTribe(w, t) {
  const members = w.creatures.filter(c => c.tribe === t.id);
  let spot = null;
  for (let k = 0; k < 30 && !spot; k++) {
    const a = rand(w) * Math.PI * 2, d = 18 + rand(w) * 14, x = t.x + Math.cos(a) * d, y = t.y + Math.sin(a) * d, i = tileAt(w, x, y);
    if (i >= 0 && !isWater(w.biome[i]) && w.cap[i] > .5 && !w.tribes.some(o => !o.gone && Math.hypot(o.x - x, o.y - y) < 14)) spot = [x, y];
  }
  if (!spot) return;
  const nt = { id: w.nextTribe++, sp: t.sp, name: tribeName(w), x: spot[0], y: spot[1], born: w.tick, stage: 0, members: 0, store: 1, storeMax: 3, faith: t.faith * .5, shrine: 0, gone: 0, emptySince: 0 };
  w.tribes.push(nt);
  let moved = 0;
  for (const c of members) { if (moved >= Math.floor(members.length * .4)) break; if (c.id === w.player) continue; c.tribe = nt.id; c.tx = spot[0]; c.ty = spot[1]; c.st = ST.HOME; moved++; }
  if (w.tribes.filter(o => o.sp === t.sp).length <= 4) logEvent(w, 'tribe', `Settlers left ${t.name} and founded ${nt.name}.`, { x: nt.x, y: nt.y, sp: t.sp });
  else w.log.push({ t: w.tick, type: 'tribe', text: `Settlers founded ${nt.name}.`, x: nt.x, y: nt.y, sp: t.sp });
}
function awaken(w, sp, byGod) {
  sp.sapient = true;
  logEvent(w, 'sapience', byGod ? `You gave the ${sp.name} the gift of fire. They awaken, and begin to gather in tribes.` : `The ${sp.name} have become self-aware. They gather around fires and form tribes.`, { sp: sp.id });
  milestone(w, 'sapience', 'A species became intelligent.');
}
function foundTribe(w, c) {
  const t = { id: w.nextTribe++, sp: c.sp, name: tribeName(w), x: c.x, y: c.y, born: w.tick, stage: 0, members: 1, store: .5, storeMax: 3, faith: 0, shrine: 0, gone: 0, emptySince: 0 };
  w.tribes.push(t); c.tribe = t.id;
  if (w.tribes.filter(o => o.sp === c.sp).length <= 2) logEvent(w, 'tribe', `A tribe of ${spById(w, c.sp).name} founded ${t.name}.`, { x: t.x, y: t.y, sp: c.sp });
  else w.log.push({ t: w.tick, type: 'tribe', text: `A tribe founded ${t.name}.`, x: t.x, y: t.y, sp: c.sp });
  milestone(w, 'tribe', 'The first tribe was founded.');
}
function farmAround(w, t) {
  const R = 5 + t.stage * 2;
  for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
    if (x * x + y * y > R * R) continue; const i = tileAt(w, t.x + x, t.y + y); if (i < 0 || isWater(w.biome[i])) continue;
    w.fert[i] = Math.max(w.fert[i], 1.6); classify(w, i);
  }
  w.dirtyRects.push([t.x - R, t.y - R, R * 2, R * 2]);
}
function miracleSeen(w, x, y) { for (const t of w.tribes) if (!t.gone && Math.hypot(t.x - x, t.y - y) < 35) t.faith++; }

// ---------------------------------------------------------------- messengers
function stepProphets(w, grid) {
  for (const p of w.prophets) {
    p.ttl--;
    // walk toward the nearest member of the species who hasn't heard the word
    if (w.tick % 10 === 0) {
      let best = null, bd = 1e9;
      for (const c of w.creatures) { if (c.sp !== p.sp || (c.belief && c.belief.from === p.id)) continue; const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2; if (d < bd) { bd = d; best = c; } }
      if (best) { p.tx = best.x; p.ty = best.y; } else p.ttl = Math.min(p.ttl, 60);
    }
    const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
    if (d > .3) { p.x += dx / d * .16; p.y += dy / d * .16; }
    for (const c of neighbors(w, grid, p.x, p.y, 2.2)) {
      if (c.sp !== p.sp || (c.belief && c.belief.from === p.id)) continue;
      c.belief = { ...p.cmd, from: p.id, until: w.tick + TPY * 4 };
      p.converts++;
    }
  }
  const done = w.prophets.filter(p => p.ttl <= 0);
  for (const p of done) logEvent(w, 'speak', `Your messenger ascended after bringing the word to ${p.converts} of the ${spById(w, p.sp).name}.`, { x: p.x, y: p.y, sp: p.sp });
  w.prophets = w.prophets.filter(p => p.ttl > 0);
  if (w.tick % 60 === 0) for (const c of w.creatures) if (c.belief && c.belief.until < w.tick) c.belief = null;
}

// ---------------------------------------------------------------- the chronicle
function logEvent(w, type, text, extra = {}) {
  w.log.push({ t: w.tick, type, text, ...extra });
  w.events.push({ t: w.tick, type, text, ...extra });
  if (w.log.length > 1500) w.log.splice(0, 300);
}
function milestone(w, id, text) {
  if (w.milestones[id]) return;
  w.milestones[id] = w.tick;
  w.events.push({ t: w.tick, type: 'milestone', text, id });
}
const MILESTONES = [
  ['life', 'Let there be life', 'Life walks your world.'],
  ['speciation', 'Origin of species', 'A new species evolved on its own.'],
  ['five', 'A living tapestry', 'Five species alive at once.'],
  ['ten', 'Garden of Eden', 'Ten species alive at once.'],
  ['extinction', 'Gone forever', 'A species went extinct.'],
  ['massext', 'The Great Dying', 'Half of all species lost within five years.'],
  ['survivor', 'Life finds a way', 'A species survived a mass extinction and recovered.'],
  ['sea', 'Life from the deep', 'A water species evolved to live on land, or a land species took to the sea.'],
  ['apex', 'Apex predator', 'A hunter species reached 60 individuals.'],
  ['thousand', 'A thousand souls', '1,000 creatures alive at once.'],
  ['sapience', 'The spark', 'A species became intelligent.'],
  ['tribe', 'Hearth and kin', 'The first tribe was founded.'],
  ['town', 'Civilisation', 'A town rose.'],
  ['shrine', 'Worshipped', 'Mortals built a shrine in your honour.'],
  ['incarnate', 'Walk among them', 'You lived a mortal life.'],
  ['dynasty', 'Dynasty', 'Your bloodline reached its fifth generation while you walked the world.'],
  ['millennium', 'Deep time', 'Your world is 500 years old.'],
];

// ---------------------------------------------------------------- the main step
function stepWorld(w, grid) {
  w.tick++;
  buildGrid(w, grid);
  w._grid = grid;
  stepClimate(w);
  stepPending(w);
  stepTiles(w);
  for (let k = 0; k < w.creatures.length; k++) { const c = w.creatures[k]; if (!c.dead) stepCreature(w, grid, c); }
  spreadDisease(w, grid);
  stepTribes(w, grid);
  stepProphets(w, grid);
  // bury the dead
  let alive = 0;
  const died = [];
  for (const c of w.creatures) { if (c.dead) died.push(c); else w.creatures[alive++] = c; }
  w.creatures.length = alive;
  w.recentDeaths = died;
  for (const c of died) {
    const sp = spById(w, c.sp); if (sp) sp.pop--;
    w.stats.deaths++; w.stats.byCause[c.cause] = (w.stats.byCause[c.cause] || 0) + 1;
    if (w.corpses.length < 250) w.corpses.push({ x: c.x, y: c.y, r: c.r, hue: sp ? sp.hue : 0, t: w.tick, dir: c.dir });
    if (c.name || c.bless) logEvent(w, 'death', `${c.name || 'A blessed one'} of the ${sp ? sp.name : '?'} died (${c.cause}) at age ${(c.age / TPY).toFixed(1)}.`, { x: c.x, y: c.y, sp: c.sp });
    if (c.id === w.player) w.events.push({ t: w.tick, type: 'playerDied', text: c.cause, id: c.id, age: c.age, x: c.x, y: c.y });
  }
  w.corpses = w.corpses.filter(k => w.tick - k.t < 240);
  w.fx = w.fx.filter(f => w.tick - f.t < f.dur);
  if (w.tick % 60 === 0) speciesBookkeeping(w);
  if (w.tick % 60 === 30) recordHistory(w);
  if (w.tick % TPY === 0) yearly(w);
}
function speciesBookkeeping(w) {
  const sums = new Map();
  for (const c of w.creatures) { let s = sums.get(c.sp); if (!s) { s = { n: 0, g: new Float64Array(NG), hx: 0, hy: 0 }; sums.set(c.sp, s); } s.n++; for (let j = 0; j < NG; j++) s.g[j] += c.g[j]; }
  let living = 0;
  for (const sp of w.species) {
    if (sp.extinct) continue;
    const s = sums.get(sp.id);
    sp.pop = s ? s.n : 0;
    if (s) {
      // hue averages on a circle; everything else is a plain mean
      for (let j = 0; j < NG; j++) sp.mean[j] = j === G.hue ? sp.mean[j] : s.g[j] / s.n;
      living++;
      sp.peak = Math.max(sp.peak, sp.pop);
      if (!sp.announced && sp.pop >= 6) {
        sp.announced = true;
        const par = spById(w, sp.parent);
        logEvent(w, 'species', `A new species emerged: the ${sp.name}${par ? `, descended from the ${par.name}` : ''}.`, { sp: sp.id });
        milestone(w, 'speciation', 'A new species evolved on its own.');
        if (par && (par.mean[G.aquatic] > .6) !== (sp.mean[G.aquatic] > .6)) milestone(w, 'sea', 'Life crossed between water and land.');
      }
      if (sp.mean[G.diet] > .6 && sp.pop >= 60) milestone(w, 'apex', 'A hunter species reached 60 individuals.');
    } else {
      sp.extinct = w.tick;
      if (sp.announced && w.tick > TPY * 1.5) { logEvent(w, 'extinct', `The ${sp.name} went extinct after ${((w.tick - sp.born) / TPY).toFixed(0)} years.`, { sp: sp.id }); milestone(w, 'extinction', 'A species went extinct.'); w.recentExtinct = (w.recentExtinct || []).concat(w.tick); }
    }
  }
  if (w.creatures.length) milestone(w, 'life', 'Life walks your world.');
  const announcedLiving = w.species.filter(s => !s.extinct && s.announced).length;
  if (announcedLiving >= 5) milestone(w, 'five', 'Five species alive at once.');
  if (announcedLiving >= 10) milestone(w, 'ten', 'Ten species alive at once.');
  if (w.creatures.length >= 1000) milestone(w, 'thousand', '1,000 creatures alive at once.');
}
function recordHistory(w) {
  const pops = {};
  for (const sp of w.species) if (!sp.extinct && sp.pop > 0 && sp.announced) pops[sp.id] = sp.pop;
  w.popHist.push({ t: w.tick, p: pops, n: w.creatures.length });
  if (w.popHist.length > 1200) w.popHist = w.popHist.filter((_, i) => i % 2 === 0);
}
function yearly(w) {
  const yr = w.tick / TPY;
  if (yr >= 500) milestone(w, 'millennium', 'Your world is 500 years old.');
  // mass extinction: half the announced species lost within 5 years
  const recent = (w.recentExtinct || []).filter(t => w.tick - t < TPY * 5); w.recentExtinct = recent;
  const living = w.species.filter(s => !s.extinct && s.announced).length;
  if (recent.length >= 3 && recent.length >= living) { if (!w.milestones.massext) { milestone(w, 'massext', 'The Great Dying.'); w.massExtAt = w.tick; } }
  if (w.massExtAt && w.tick - w.massExtAt > TPY * 10 && living >= 3) milestone(w, 'survivor', 'Life found a way.');
  for (const t of w.tribes) if (!t.gone) t.faith = Math.max(0, t.faith - .1);
}

// ---------------------------------------------------------------- god powers
function killCreature(w, c, cause) { if (!c.dead) { c.dead = true; c.cause = cause; } }
const GOD = {
  meteor(w, x, y, size = 1) {
    const R = 7 * size;
    w.fx.push({ type: 'meteor', x, y, r: R, t: w.tick, dur: 70 });
    w.pending = (w.pending || []).concat({ at: w.tick + 45, fn: 'meteorImpact', x, y, R });
    logEvent(w, 'destroy', 'You hurled a meteor from the heavens.', { x, y });
  },
  meteorImpact(w, { x, y, R }) {
    for (const c of w.creatures) { const d = Math.hypot(c.x - x, c.y - y); if (d < R * 1.25) killCreature(w, c, 'meteor'); else if (d < R * 2.2) { c.health -= .5 * (1 - (d - R * 1.25) / R); c.x += (c.x - x) / d * 2; c.y += (c.y - y) / d * 2; } }
    const r = Math.ceil(R * 1.6);
    for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
      const i = tileAt(w, x + xx, y + yy); if (i < 0) continue;
      const d = Math.hypot(xx, yy) / R;
      if (d < 1) { w.elev[i] -= .45 * (1 - d * d); w.food[i] = 0; }
      else if (d < 1.25) w.elev[i] += .08 * (1 - (d - 1) / .25);
      if (d < 2.4 && d > .8 && rand(w) < .35 && !isWater(w.biome[i])) w.fire[i] = 80 + (rand(w) * 100 | 0);
    }
    classifyRegion(w, x | 0, y | 0, r); w.terrainDirty = true;
    w.climate.dust = Math.min(1, w.climate.dust + .55 * R / 7);
    w.fx.push({ type: 'impact', x, y, r: R, t: w.tick, dur: 120 });
    miracleSeen(w, x, y);
  },
  volcano(w, x, y) {
    const R = 5;
    for (let yy = -R * 2; yy <= R * 2; yy++) for (let xx = -R * 2; xx <= R * 2; xx++) {
      const i = tileAt(w, x + xx, y + yy); if (i < 0) continue; const d = Math.hypot(xx, yy) / (R * 2);
      if (d < 1) w.elev[i] = Math.max(w.elev[i], .1) + .5 * Math.pow(1 - d, 1.5);
    }
    classifyRegion(w, x | 0, y | 0, R * 2);
    const i = tileAt(w, x, y); if (i >= 0) w.lava[i] = 700;
    for (let k = 0; k < 6; k++) { const j = tileAt(w, x + gauss(w) * 1.5, y + gauss(w) * 1.5); if (j >= 0) w.lava[j] = 500; }
    w.pending = (w.pending || []).concat({ at: w.tick + 1, fn: 'erupt', x, y, left: 12 });
    w.climate.dust = Math.min(1, w.climate.dust + .2);
    w.fx.push({ type: 'volcano', x, y, t: w.tick, dur: TPY * 2 });
    logEvent(w, 'destroy', 'You raised a volcano. Lava pours down its flanks.', { x, y }); miracleSeen(w, x, y);
  },
  erupt(w, e) {
    for (let k = 0; k < 3; k++) { const j = tileAt(w, e.x + gauss(w) * 1.2, e.y + gauss(w) * 1.2); if (j >= 0) w.lava[j] = 400 + (rand(w) * 300 | 0); }
    if (--e.left > 0) w.pending.push({ ...e, at: w.tick + 40 });
  },
  plague(w, x, y, opts = {}) {
    let best = null, bd = 64;
    for (const c of w.creatures) { const d = (c.x - x) ** 2 + (c.y - y) ** 2; if (d < bd) { bd = d; best = c; } }
    if (!best) return null;
    const s = { id: w.strains.length + 1, name: plagueName(w), lethal: opts.lethal || .0035, trans: opts.trans || .08, dur: TPY * .5, hosts: [best.sp], any: false, jump: .002, cases: 1, gen: 1, t: w.tick };
    w.strains.push(s);
    best.inf = s.id; best.infT = s.dur;
    let n = 0; for (const c of w.creatures) if (c.sp === best.sp && !c.inf && n < 4 && Math.hypot(c.x - best.x, c.y - best.y) < 8) { c.inf = s.id; c.infT = s.dur; n++; }
    w.fx.push({ type: 'plague', x: best.x, y: best.y, t: w.tick, dur: 90 });
    logEvent(w, 'plague', `You unleashed ${s.name} on the ${spById(w, best.sp).name}.`, { x: best.x, y: best.y, sp: best.sp });
    miracleSeen(w, x, y);
    return s;
  },
  wildfire(w, x, y) {
    for (let k = 0; k < 8; k++) { const i = tileAt(w, x + gauss(w) * 1.5, y + gauss(w) * 1.5); if (i >= 0 && !isWater(w.biome[i])) w.fire[i] = 120; }
    w.fx.push({ type: 'ignite', x, y, t: w.tick, dur: 40 });
    logEvent(w, 'destroy', 'You set the land ablaze.', { x, y }); miracleSeen(w, x, y);
  },
  lightning(w, x, y) {
    let best = null, bd = 9;
    for (const c of w.creatures) { const d = (c.x - x) ** 2 + (c.y - y) ** 2; if (d < bd) { bd = d; best = c; } }
    const tx = best ? best.x : x, ty = best ? best.y : y;
    if (best) { killCreature(w, best, 'struck by lightning'); if (best.name) logEvent(w, 'destroy', `You struck down ${best.name}.`, { x: tx, y: ty }); }
    const i = tileAt(w, tx, ty); if (i >= 0 && !isWater(w.biome[i]) && rand(w) < .5) w.fire[i] = 90;
    w.fx.push({ type: 'bolt', x: tx, y: ty, t: w.tick, dur: 24, seed: w.tick });
    miracleSeen(w, x, y);
  },
  deluge(w) { w.climate.delugeUntil = w.tick + TPY * 6; logEvent(w, 'destroy', 'You opened the heavens. The seas are rising.', {}); w.fx.push({ type: 'deluge', t: w.tick, dur: TPY * 6 }); for (const t of w.tribes) t.faith++; },
  drought(w) { w.climate.droughtUntil = w.tick + TPY * 4; logEvent(w, 'destroy', 'You withheld the rain. Drought grips the land.', {}); for (const t of w.tribes) t.faith++; },
  iceAge(w) { w.climate.iceUntil = w.tick + TPY * 10; logEvent(w, 'destroy', 'You breathed winter on the world. An ice age begins.', {}); for (const t of w.tribes) t.faith++; },
  heatwave(w) { w.climate.heat = (w.climate.heat || 0) + .12; w.pending = (w.pending || []).concat({ at: w.tick + TPY * 5, fn: 'cool' }); logEvent(w, 'destroy', 'You set the sun ablaze. The world grows hot.', {}); },
  cool(w) { w.climate.heat = Math.max(0, (w.climate.heat || 0) - .12); },
  eraseSpecies(w, spId) {
    const sp = spById(w, spId); if (!sp) return;
    sp.erased = true;
    let k = 0; for (const c of w.creatures) if (c.sp === spId) { w.pending = (w.pending || []).concat({ at: w.tick + 1 + (k++ % 60), fn: 'fade', id: c.id }); }
    w.pending.push({ at: w.tick + 62, fn: 'sweep', sp: spId });
    w.fx.push({ type: 'erase', sp: spId, t: w.tick, dur: 90 });
    logEvent(w, 'destroy', `You erased the ${sp.name} from existence.`, { sp: spId });
  },
  sweep(w, e) { for (const c of w.creatures) if (c.sp === e.sp) killCreature(w, c, 'erased by god'); },
  fade(w, e) { const c = crById(w, e.id); if (c) { w.fx.push({ type: 'ghost', x: c.x, y: c.y, t: w.tick, dur: 60, hue: spById(w, c.sp).hue }); killCreature(w, c, 'erased by god'); } },
  bless(w, c, gift) {
    const bits = { giant: 1, swift: 2, immortal: 4, alpha: 8, fertile: 16, genius: 32 };
    c.bless |= bits[gift];
    if (gift === 'giant') c.g[G.size] = clamp01(c.g[G.size] + .25);
    if (gift === 'swift') c.g[G.speed] = clamp01(c.g[G.speed] + .25);
    if (gift === 'genius') c.g[G.intel] = clamp01(c.g[G.intel] + .45);
    if (gift === 'alpha') c.g[G.herd] = clamp01(c.g[G.herd] + .2);
    if (gift === 'fertile') c.g[G.fert] = clamp01(c.g[G.fert] + .2);
    if (!c.name) c.name = personName(w);
    derive(c); c.health = 1; c.energy = c.maxE;
    const txt = { giant: 'the size of a giant', swift: 'the speed of the wind', immortal: 'eternal life', alpha: 'the power to lead', fertile: 'the blessing of many children', genius: 'a brilliant mind' }[gift];
    w.fx.push({ type: 'bless', x: c.x, y: c.y, t: w.tick, dur: 100 });
    logEvent(w, 'bless', `You granted ${c.name} of the ${spById(w, c.sp).name} ${txt}.`, { x: c.x, y: c.y, sp: c.sp });
    miracleSeen(w, c.x, c.y);
  },
  abundance(w, x, y, R = 9) {
    for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) { if (xx * xx + yy * yy > R * R) continue; const i = tileAt(w, x + xx, y + yy); if (i >= 0) w.food[i] = Math.max(w.food[i], w.cap[i] * 1.6 + .6); }
    w.fx.push({ type: 'fruit', x, y, r: R, t: w.tick, dur: 150 });
    logEvent(w, 'bless', 'You rained fruit from the sky.', { x, y }); miracleSeen(w, x, y);
  },
  heal(w, x, y, R = 12) {
    let n = 0; for (const c of w.creatures) if (Math.hypot(c.x - x, c.y - y) < R) { if (c.inf) n++; if (c.inf) c.imm.push(c.inf); c.inf = 0; c.health = 1; }
    w.zones.push({ type: 'rain', x, y, r: R, until: w.tick + 200 });
    w.fx.push({ type: 'healrain', x, y, r: R, t: w.tick, dur: 200 });
    logEvent(w, 'bless', n ? `Your healing rain cured ${n} sick creatures.` : 'You sent a healing rain.', { x, y }); miracleSeen(w, x, y);
  },
  rain(w, x, y, R = 14) { w.zones.push({ type: 'rain', x, y, r: R, until: w.tick + TPY }); w.fx.push({ type: 'rain', x, y, r: R, t: w.tick, dur: TPY }); logEvent(w, 'create', 'You summoned rain.', { x, y }); miracleSeen(w, x, y); },
  rays(w, x, y, R = 14) { w.zones.push({ type: 'rays', x, y, r: R, until: w.tick + TPY * 3 }); w.fx.push({ type: 'rays', x, y, r: R, t: w.tick, dur: TPY * 3 }); logEvent(w, 'create', 'Cosmic rays bathe the land. Mutations run wild.', { x, y }); },
  fireGift(w, spId) {
    const sp = spById(w, spId); if (!sp) return;
    for (const c of w.creatures) if (c.sp === spId) { c.g[G.intel] = clamp01(Math.max(c.g[G.intel], .5) + .15); derive(c); }
    sp.mean[G.intel] = Math.max(sp.mean[G.intel], .6);
    if (!sp.sapient) awaken(w, sp, true);
    const any = w.creatures.find(c => c.sp === spId); if (any) w.fx.push({ type: 'bless', x: any.x, y: any.y, t: w.tick, dur: 100 });
  },
  fertility(w, spId) { const sp = spById(w, spId); if (!sp) return; sp.boost = w.tick + TPY * 2; logEvent(w, 'bless', `You blessed the ${sp.name} with fertility.`, { sp: spId }); },
  messenger(w, x, y, spId, cmd) {
    const sp = spById(w, spId); if (!sp) return;
    const p = { id: w.tick * 10 + w.prophets.length, x, y, tx: x, ty: y, sp: spId, cmd, ttl: TPY * 1.5, converts: 0 };
    w.prophets.push(p);
    const txt = { migrate: 'to go forth to a new land', peace: 'to make peace and spare other creatures', multiply: 'to be fruitful and multiply', war: `to wage war on the ${cmd.sp ? spById(w, cmd.sp).name : 'others'}` }[cmd.type];
    logEvent(w, 'speak', `You sent a messenger to command the ${sp.name} ${txt}.`, { x, y, sp: spId });
    if (cmd.type === 'multiply') sp.boost = w.tick + TPY * 2;
  },
  terraform(w, x, y, R, dir) {
    for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) {
      const d = Math.hypot(xx, yy) / R; if (d > 1) continue; const i = tileAt(w, x + xx, y + yy); if (i < 0) continue;
      w.elev[i] += dir * .05 * (1 - d * d);
    }
    classifyRegion(w, x | 0, y | 0, R);
  },
  forest(w, x, y, R) {
    for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) {
      const d = Math.hypot(xx, yy) / R; if (d > 1) continue; const i = tileAt(w, x + xx, y + yy); if (i < 0 || isWater(w.biome[i])) continue;
      w.moist[i] = clamp01(w.moist[i] + .06 * (1 - d)); w.fert[i] = Math.min(1.6, w.fert[i] + .03); w.food[i] = Math.max(w.food[i], w.cap[i]);
    }
    classifyRegion(w, x | 0, y | 0, R);
  },
  soup(w, x, y) {
    const hue = rand(w);
    const sp = spawnSpecies(w, genesFrom(w, PRESETS.cell, hue), x, y, 30, { quiet: true, founder: 'Primordial soup' });
    logEvent(w, 'create', 'You stirred the primordial soup. Tiny cells begin to divide.', { x, y, sp: sp.id });
    w.fx.push({ type: 'bless', x, y, t: w.tick, dur: 100 });
  },
};
function stepPending(w) {
  if (!w.pending || !w.pending.length) return;
  const due = w.pending.filter(p => p.at <= w.tick);
  if (!due.length) return;
  w.pending = w.pending.filter(p => p.at > w.tick);
  for (const p of due) GOD[p.fn](w, p);
}

// Start a world with some life in it.
function seedLife(w, mode) {
  const land = [], sea = [];
  for (let k = 0; k < 4000; k++) {
    const x = 4 + rand(w) * (w.W - 8), y = 4 + rand(w) * (w.H - 8), i = tileAt(w, x, y);
    const b = w.biome[i];
    if (b === B.GRASS || b === B.FOREST || b === B.SAVANNA || b === B.JUNGLE) land.push([x, y]);
    else if (b === B.DEEP && w.elev[i] > -.3) sea.push([x, y]);
  }
  const at = arr => arr[Math.floor(rand(w) * arr.length)] || [w.W / 2, w.H / 2];
  const q = { quiet: true, founder: 'The first life' };
  if (mode === 'soup') { for (let k = 0; k < 3; k++) { const p = at(sea); GOD.soup(w, p[0], p[1]); } return; }
  if (mode === 'empty') return;
  for (let k = 0; k < 3; k++) { const p = at(land); spawnSpecies(w, genesFrom(w, PRESETS.grazer, rand(w)), p[0], p[1], 26, q); }
  { const p = at(land); spawnSpecies(w, genesFrom(w, PRESETS.giant, rand(w)), p[0], p[1], 10, q); }
  { const p = at(land); spawnSpecies(w, genesFrom(w, PRESETS.omnivore, rand(w)), p[0], p[1], 12, q); }
  { const herd = w.creatures[0]; spawnSpecies(w, genesFrom(w, PRESETS.hunter, rand(w)), herd.x + 6, herd.y + 4, 8, q); }
  for (let k = 0; k < 2; k++) { const p = at(sea); spawnSpecies(w, genesFrom(w, PRESETS.swimmer, rand(w)), p[0], p[1], 20, q); }
  { const p = at(sea); spawnSpecies(w, genesFrom(w, { ...PRESETS.shark, size: .45, fert: .5 }, rand(w)), p[0], p[1], 8, q); }
  logEvent(w, 'create', `The world of ${w.name} awakens with ${w.species.length} species.`, {});
}

// Snapshots for rewinding time. Everything in the world is plain data.
function snapshot(w) { const s = structuredClone({ ...w, events: [], _grid: null, recentDeaths: null }); return s; }
function restore(s) { const w = structuredClone(s); w.terrainDirty = true; w.events = []; return w; }
/*SIM-END*/

/*RENDER-START*/
// ---------------------------------------------------------------------------
// God Lab renderer: a low-poly 3D valley in Three.js. Reads the world, never writes it.
// ---------------------------------------------------------------------------
const R = { ready: false, shake: 0, flash: 0, time: 0, night: 0, lightMode: 'cycle' };
const TAU = Math.PI * 2;
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _c2 = new THREE.Color();
let _seedR = 1; const mrand = () => ((_seedR = (_seedR * 16807) % 2147483647) / 2147483647);

// -------------------------------------------------------------- geometry builder (merged, vertex-coloured, flat shaded)
function prismGeo(w, h, d) { // gable roof: ridge along x, width w, depth d, height h, base at y=0
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
  const P = [
    [x0, 0, z0], [x0, h, 0], [x0, 0, z1], [x1, 0, z1], [x1, h, 0], [x1, 0, z0],
    [x0, 0, z1], [x0, h, 0], [x1, h, 0], [x0, 0, z1], [x1, h, 0], [x1, 0, z1],
    [x1, 0, z0], [x1, h, 0], [x0, h, 0], [x1, 0, z0], [x0, h, 0], [x0, 0, z0],
    [x0, 0, z0], [x0, 0, z1], [x1, 0, z1], [x0, 0, z0], [x1, 0, z1], [x1, 0, z0],
  ];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P.flat(), 3)); return g;
}
class GB {
  constructor() { this.p = []; this.c = []; }
  add(geo, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, jit = .07) {
    const g = geo.index ? geo.toNonIndexed() : geo, pos = g.attributes.position;
    _e.set(rx, ry, rz); _q.setFromEuler(_e); _m.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
    _c.set(col);
    for (let i = 0; i < pos.count; i++) { _v.fromBufferAttribute(pos, i).applyMatrix4(_m); this.p.push(_v.x, _v.y, _v.z); }
    for (let i = 0; i < pos.count; i += 3) { const k = 1 + (mrand() - .5) * jit; for (let j = 0; j < 3 && i + j < pos.count; j++) this.c.push(_c.r * k, _c.g * k, _c.b * k); }
    return this;
  }
  box(w, h, d, col, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) { return this.add(new THREE.BoxGeometry(w, h, d), col, x, y + h / 2, z, rx, ry, rz); }
  cyl(rt, rb, h, seg, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), col, x, y + h / 2, z, rx, ry, rz); }
  cone(r, h, seg, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { return this.add(new THREE.ConeGeometry(r, h, seg), col, x, y + h / 2, z, rx, ry, rz); }
  pyr(r, h, col, x = 0, y = 0, z = 0, ry = 0) { return this.add(new THREE.ConeGeometry(r, h, 4), col, x, y + h / 2, z, 0, Math.PI / 4 + ry, 0); }
  sph(r, det, col, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) { return this.add(new THREE.IcosahedronGeometry(r, det), col, x, y, z, 0, 0, 0, sx, sy, sz); }
  gable(w, h, d, col, x = 0, y = 0, z = 0, ry = 0) { return this.add(prismGeo(w, h, d), col, x, y, z, 0, ry, 0); }
  torus(r, t, col, x, y, z, rx = Math.PI / 2) { return this.add(new THREE.TorusGeometry(r, t, 5, 14), col, x, y, z, rx, 0, 0); }
  geo() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c.length ? this.c : new Array(this.p.length).fill(1), 3)); g.computeVertexNormals(); g.computeBoundingSphere(); return g; }
  empty() { return this.p.length === 0; }
}

// -------------------------------------------------------------- palettes
const COL = {
  thatch: 0xc9a45c, mud: 0xb4875a, adobe: 0xd8b98a, wood: 0x7a5230, dark: 0x4a3020, stone: 0xb3ada2, marble: 0xefe9dd, terracotta: 0xb4533a, slate: 0x4f5963,
  brick: 0x9a4634, plaster: 0xeee3cb, concrete: 0xaeb2b7, glass: 0x7fb2d4, hide: 0xa9825a, gold: 0xe6bd4c, red: 0xb33a2e, black: 0x2c2729, white: 0xf3f1ea, green: 0x4f8a3c, bone: 0xe8e0c8, iron: 0x5a5f66,
};
const SKIN = [0xf6d7c0, 0xeec2a0, 0xdca57e, 0xc58a62, 0xa86e48, 0x8a5636, 0x6b4028, 0x4f2e1c].map(h => new THREE.Color(h));
const HAIR = [0x1c1410, 0x2e1d12, 0x4a2c16, 0x6b4423, 0x9a6a38, 0xc99b5c, 0xe0c890, 0x8a2e1a].map(h => new THREE.Color(h));
const CLOTH = [
  [0x8a6440, 0x6e4e30, 0xa07850, 0x5c4028, 0x9a7a55],             // furs
  [0xc7b38a, 0xa89770, 0x8f7c58, 0xd3c6a2, 0x9c8a66],             // undyed weave
  [0xb5653a, 0x3f6a8a, 0xd0a040, 0x6a7a3a, 0xa04040, 0xe0d0b0],   // dyed
  [0xe8e0d0, 0x9c3030, 0x2f4f7a, 0xc0a060, 0x6a4a7a, 0xd8d0c0],   // robes
  [0x6a3a2a, 0x2f5a3a, 0x8a2a2a, 0x3a4a7a, 0xa08040, 0x5a5a5a],   // wool
  [0x2a2a30, 0x3a3228, 0x4a4a55, 0x6a2a2a, 0x2a3a4a, 0x7a6a50],   // coats
  [0xe0452e, 0x2e8ae0, 0xf0c030, 0x3ab87a, 0xe070b0, 0xf2f2f2, 0x7a4ae0, 0x222222], // bright
];
const PANTS = [0x5c4028, 0x7a6a50, 0x6a5a40, 0x5a4a3a, 0x3a3a3a, 0x2a2a2a, 0x2c4a7a];

// -------------------------------------------------------------- building models
function modelHome(style, v, big) {
  const g = new GB(), lit = new GB(), r = () => mrand();
  if (style === 0) {
    g.cone(1.05, 2.1, 7, [0xa9825a, 0x9a7048, 0xb89068][v % 3], 0, 0, 0);
    for (let k = 0; k < 4; k++) g.cyl(.03, .03, .6, 3, COL.dark, Math.cos(k * 1.6) * .12, 1.9, Math.sin(k * 1.6) * .12, (r() - .5) * .5, 0, (r() - .5) * .5);
    g.box(.5, .7, .05, 0x2a1a10, 0, 0, 1.0, 0, -.45);
    g.cyl(.04, .04, 1, 3, COL.dark, 1.1, 0, -.6); g.cyl(.04, .04, 1, 3, COL.dark, 1.1, 0, .4); g.box(.06, .06, 1.1, COL.dark, 1.1, .95, -.1); g.box(.05, .5, .7, 0xc8a070, 1.1, .45, -.1);
    lit.box(.3, .3, .02, 0xffffff, 0, .2, 1.02);
  } else if (style === 1) {
    g.cyl(1.05, 1.1, 1.05, 10, COL.mud, 0, 0, 0);
    g.cone(1.45, 1.35, 10, COL.thatch, 0, 1.0, 0); g.cone(.3, .3, 6, 0xa88a48, 0, 2.2, 0);
    g.box(.45, .75, .12, 0x2a1a10, 0, 0, 1.03);
    g.cyl(.18, .14, .35, 6, 0xb06a40, .9, 0, .75); g.cyl(.14, .12, .28, 6, 0xa05a36, 1.1, 0, .45);
    lit.box(.3, .5, .02, 0xffffff, 0, .05, 1.1);
  } else if (style === 2) {
    const c = [COL.adobe, 0xd0ae7e, 0xe0c49a][v % 3];
    g.box(2.2, 1.5, 2.0, c, 0, 0, 0); g.box(2.3, .12, 2.1, 0xc4a070, 0, 1.5, 0);
    for (const [x, z, w, d] of [[0, -1.02, 2.3, .12], [0, 1.02, 2.3, .12], [-1.12, 0, .12, 2.1], [1.12, 0, .12, 2.1]]) g.box(w, .25, d, c, x, 1.55, z);
    g.box(.5, .9, .08, 0x5a3a20, -.4, 0, 1.01); g.cyl(.2, .15, .4, 6, 0xb86a40, .8, 0, 1.2);
    for (let k = 0; k < 5; k++) g.box(.05, .05, .55, COL.wood, -1.15 + k * .12, 1.2, 1.2);
    lit.box(.28, .28, .02, 0xffffff, .5, .75, 1.01); lit.box(.02, .28, .28, 0xffffff, 1.11, .75, 0); lit.box(.02, .28, .28, 0xffffff, -1.11, .75, .3);
  } else if (style === 3) {
    const c = [COL.plaster, 0xe6dcc4, 0xd8cdb0][v % 3];
    g.box(2.3, 1.4, 1.9, c, 0, 0, 0); g.gable(2.5, .9, 2.2, COL.terracotta, 0, 1.4, 0);
    g.box(1.2, .1, .5, 0xd0c8b8, 0, 0, 1.2); g.cyl(.08, .08, 1.1, 6, COL.marble, -.5, .1, 1.35); g.cyl(.08, .08, 1.1, 6, COL.marble, .5, .1, 1.35); g.box(1.3, .12, .6, COL.terracotta, 0, 1.2, 1.2);
    g.box(.45, .85, .06, 0x5a3a20, 0, 0, .96);
    lit.box(.3, .35, .02, 0xffffff, -.75, .6, .96); lit.box(.3, .35, .02, 0xffffff, .75, .6, .96); lit.box(.02, .35, .3, 0xffffff, 1.16, .6, 0);
    g.cyl(.25, .3, .5, 7, 0x9a5a3a, -1.05, 0, 1.2); g.sph(.28, 0, 0x4f8a3c, -1.05, .75, 1.2);
  } else if (style === 4) {
    const c = [COL.plaster, 0xf0e6d0, 0xe8dcc0][v % 3], beam = 0x3a2616;
    g.box(2.1, 1.15, 1.9, c, 0, 0, 0); g.box(2.35, 1.05, 2.15, c, 0, 1.15, 0);
    for (const x of [-1.05, 0, 1.05]) g.box(.08, 1.15, .08, beam, x, 0, .96);
    for (const x of [-1.17, -.4, .4, 1.17]) g.box(.08, 1.05, .08, beam, x, 1.15, 1.08);
    g.box(2.4, .08, .1, beam, 0, 1.12, 1.08); g.box(2.4, .08, .1, beam, 0, 2.18, 1.08);
    g.box(.08, 1.2, .08, beam, -.8, 1.15, 1.09, 0, 0, .75); g.box(.08, 1.2, .08, beam, .8, 1.15, 1.09, 0, 0, -.75);
    g.gable(2.6, 1.5, 2.5, [0x5a3a2a, 0x4a4a52, 0x6a4028][v % 3], 0, 2.2, 0);
    g.box(.35, 1.1, .35, 0x7a6a60, .7, 2.6, -.5);
    g.box(.5, .85, .06, 0x3a2616, 0, 0, .96);
    lit.box(.35, .35, .02, 0xffffff, -.6, .45, .96); lit.box(.35, .35, .02, 0xffffff, .6, .45, .96); lit.box(.35, .4, .02, 0xffffff, 0, 1.5, 1.09); lit.box(.02, .4, .35, 0xffffff, 1.19, 1.5, 0);
  } else if (style === 5) {
    const c = [COL.brick, 0x8a3e2e, 0xa85a40][v % 3];
    g.box(2.4, 2.6, 2.0, c, 0, 0, 0); g.gable(2.55, .9, 2.2, COL.slate, 0, 2.6, 0);
    g.box(.35, 1.0, .35, c, -.9, 2.8, 0); g.box(.35, 1.0, .35, c, .9, 2.8, 0);
    g.box(.8, .12, .4, 0xb0a8a0, 0, 0, 1.15); g.box(.45, 1.0, .06, 0x2a2a3a, 0, .1, 1.01);
    for (const x of [-.8, .8]) for (const y of [.5, 1.7]) lit.box(.4, .55, .02, 0xffffff, x, y, 1.01);
    lit.box(.4, .55, .02, 0xffffff, 0, 1.7, 1.01); lit.box(.02, .55, .4, 0xffffff, 1.21, 1.7, 0); lit.box(.02, .55, .4, 0xffffff, -1.21, .5, 0);
  } else {
    const H = big ? 7 + (v % 4) * 1.8 : 5, c = [COL.concrete, 0xc8ccd2, 0x9aa0a8, 0xd8d2c8][v % 4];
    g.box(2.6, H, 2.6, c, 0, 0, 0);
    g.box(2.7, .6, 2.7, [0xe0452e, 0x2e8ae0, 0x3ab87a, 0xf0c030][v % 4], 0, .9, 0);
    g.box(.8, .5, .6, 0x707478, .5, H, .4); g.box(.05, 1.4, .05, 0x404040, -.8, H, -.8);
    for (let y = 1.8; y < H - .5; y += 1.0) { lit.box(2.62, .45, 2.62, 0xffffff, 0, y, 0); }
    g.box(2.64, .08, 2.64, 0x303438, 0, H - .05, 0);
    lit.box(1.8, .7, .02, 0xffffff, 0, .1, 1.31);
  }
  return { g, lit };
}
function modelCenter(style) {
  const g = new GB(), lit = new GB();
  if (style <= 1) {
    for (let k = 0; k < 9; k++) g.sph(.16, 0, 0x8a8478, Math.cos(k / 9 * TAU) * .55, .08, Math.sin(k / 9 * TAU) * .55);
    g.cyl(.06, .06, .9, 4, COL.dark, 0, .1, 0, 0, .3, Math.PI / 2); g.cyl(.06, .06, .9, 4, COL.dark, 0, .1, 0, Math.PI / 2, .3, 0);
    for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + .4; g.cyl(.12, .12, 1.1, 6, 0x6a4a2a, Math.cos(a) * 1.3, .12, Math.sin(a) * 1.3, 0, -a, Math.PI / 2); }
    if (style === 1) for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.box(.25, .5, .15, 0x9a948a, Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4, -a); }
  } else if (style === 2) {
    g.cyl(.6, .65, .6, 10, 0x9a8f80, 0, 0, 0); g.cyl(.45, .45, .02, 10, 0x2a5a7a, 0, .55, 0);
    g.box(.08, 1.3, .08, COL.wood, -.55, .5, 0); g.box(.08, 1.3, .08, COL.wood, .55, .5, 0); g.gable(1.4, .45, .9, COL.thatch, 0, 1.75, 0);
    g.cyl(.12, .1, .2, 6, 0x8a6a40, 0, 1.2, 0);
    g.box(3, .04, 3, 0xb8a888, 0, 0, 0);
  } else if (style === 3 || style === 5) {
    g.box(3, .08, 3, 0xd8d0c0, 0, 0, 0); g.cyl(1.0, 1.05, .35, 12, COL.marble, 0, .08, 0); g.cyl(.85, .85, .04, 12, 0x3a7aa0, 0, .38, 0);
    g.cyl(.18, .25, .9, 8, COL.marble, 0, .4, 0); g.cyl(.4, .3, .1, 8, COL.marble, 0, 1.3, 0); g.cyl(.25, .25, .02, 8, 0x3a7aa0, 0, 1.4, 0);
    if (style === 5) for (const [x, z] of [[-1.3, -1.3], [1.3, 1.3], [-1.3, 1.3], [1.3, -1.3]]) { g.cyl(.04, .05, 1.6, 5, 0x2a2a2a, x, 0, z); lit.sph(.12, 0, 0xffffff, x, 1.65, z); }
  } else if (style === 4) {
    g.box(3, .06, 3, 0xa8a090, 0, 0, 0);
    g.box(1.4, .25, 1.4, 0x9a948a, 0, .05, 0); g.box(1.0, .25, 1.0, 0x9a948a, 0, .3, 0); g.box(.2, 2.2, .2, 0xb0aaa0, 0, .55, 0); g.box(.8, .18, .18, 0xb0aaa0, 0, 2.2, 0);
  } else {
    g.box(3, .06, 3, 0xcfcac2, 0, 0, 0); g.cyl(1.1, 1.1, .3, 16, 0xe8e8e8, 0, .06, 0); g.cyl(1.0, 1.0, .02, 16, 0x4aa0d0, 0, .33, 0);
    g.cyl(.08, .1, .9, 6, 0xe0e0e0, 0, .3, 0);
    for (const [x, z] of [[-1.35, -1.35], [1.35, 1.35], [-1.35, 1.35], [1.35, -1.35]]) { g.cyl(.03, .04, 1.8, 5, 0x333333, x, 0, z); lit.sph(.1, 0, 0xffffff, x, 1.85, z); }
    for (let k = 0; k < 3; k++) g.sph(.4, 0, 0x3f8a3a, Math.cos(k * 2.1) * 1.2, .7, Math.sin(k * 2.1) * 1.2);
  }
  return { g, lit };
}
function modelShrine(style, align) {
  const g = new GB(), lit = new GB(), evil = align < -.25;
  if (style >= 1 && !evil) {
    for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; g.box(.3, 1.3 + mrand() * .4, .22, 0x9a958c, Math.cos(a) * 1.15, 0, Math.sin(a) * 1.15, -a); }
    g.box(.9, .35, .6, 0x8a857c, 0, 0, 0); lit.sph(.12, 0, 0xffffff, 0, .5, 0);
    return { g, lit };
  }
  const cols = evil ? [0x3a3033, 0x2a2224, 0x4a3a3a] : [0xb5653a, 0x3f6a8a, 0xd0a040, 0x6a7a3a];
  for (let k = 0; k < 4; k++) { g.cyl(.22, .24, .45, 7, cols[k % cols.length], 0, k * .45, 0); g.box(.08, .06, .04, evil ? 0xd02010 : 0xffffff, -.08, k * .45 + .28, .22); g.box(.08, .06, .04, evil ? 0xd02010 : 0xffffff, .08, k * .45 + .28, .22); }
  if (evil) { g.sph(.22, 0, COL.bone, 0, 2.0, 0); g.cone(.07, .5, 4, COL.bone, -.25, 1.95, 0, 0, 0, .6); g.cone(.07, .5, 4, COL.bone, .25, 1.95, 0, 0, 0, -.6); lit.sph(.05, 0, 0xffffff, -.08, 2.05, .19); lit.sph(.05, 0, 0xffffff, .08, 2.05, .19); for (let k = 0; k < 5; k++) g.sph(.12, 0, COL.bone, Math.cos(k * 1.3) * .7, .1, Math.sin(k * 1.3) * .7); }
  else { g.box(1.3, .12, .25, 0xd0a040, 0, 1.75, 0); g.sph(.2, 0, 0xe0c060, 0, 2.0, 0); for (let k = 0; k < 6; k++) g.sph(.16, 0, 0x8a8478, Math.cos(k) * .7, .08, Math.sin(k) * .7); }
  return { g, lit };
}
function modelTemple(style, align) {
  const g = new GB(), lit = new GB(), evil = align < -.25, good = align > .25;
  const stone = evil ? 0x3a3438 : good ? 0xeee6d2 : 0xc8b490, trim = evil ? 0x8a1a14 : good ? COL.gold : 0x9a7a4a;
  if (style <= 2) {
    g.box(6, .9, 6, stone, 0, 0, 0); g.box(4.6, .9, 4.6, stone, 0, .9, 0); g.box(3.2, .9, 3.2, stone, 0, 1.8, 0);
    g.box(1.2, .06, 3.4, trim, 0, .9, 2.0, 0, -.5); g.box(1.2, 2.8, 1.3, stone, 0, 0, 2.6, 0, 0, 0);
    for (let k = 0; k < 7; k++) g.box(1.2, .12, .35, 0x9a8a70, 0, k * .4, 3.1 - k * .2);
    g.box(1.6, 1.0, 1.6, trim, 0, 2.7, 0); g.pyr(1.25, .8, stone, 0, 3.7, 0);
    lit.box(.5, .7, .02, 0xffffff, 0, 2.8, .81); lit.cyl(.25, .2, .25, 8, 0xffffff, 0, 4.5, 0);
  } else if (style === 3) {
    g.box(6.2, .6, 4.6, stone, 0, 0, 0); for (let k = 0; k < 3; k++) g.box(6.6 - k * .2, .12, 5 - k * .2, stone, 0, k * .12 - .3, 0);
    g.box(4.2, 2.6, 2.8, stone, 0, .6, 0);
    for (let i = 0; i < 7; i++) for (const z of [-2.0, 2.0]) g.cyl(.17, .2, 2.6, 8, stone, -2.7 + i * .9, .6, z);
    for (let i = 1; i < 4; i++) for (const x of [-2.7, 2.7]) g.cyl(.17, .2, 2.6, 8, stone, x, .6, -2 + i);
    g.box(6.2, .35, 4.6, stone, 0, 3.2, 0); g.gable(6.4, 1.1, 4.8, evil ? 0x222024 : COL.terracotta, 0, 3.55, 0, Math.PI / 2 * 0);
    g.box(6.3, .12, .12, trim, 0, 3.5, 2.35); g.sph(.25, 0, trim, 3.2, 4.6, 0); g.sph(.25, 0, trim, -3.2, 4.6, 0);
    lit.box(1.2, 1.8, .02, 0xffffff, 0, .7, 1.41);
    if (evil) for (let k = 0; k < 4; k++) g.cone(.1, .8, 4, 0x2a2224, -2.4 + k * 1.6, 4.4, 0);
  } else if (style <= 5) {
    const roof = evil ? 0x1e1a1e : 0x5a6470;
    g.box(2.8, 3.4, 5.6, stone, 0, 0, -.4); g.gable(5.8, 1.6, 3.0, roof, 0, 3.4, -.4, Math.PI / 2);
    g.box(5.2, 2.8, 1.8, stone, 0, 0, -.8); g.gable(5.4, 1.4, 2.0, roof, 0, 2.8, -.8);
    g.box(1.8, 5.2, 1.8, stone, 0, 0, 2.3); g.pyr(1.35, 3.6, roof, 0, 5.2, 2.3);
    if (style === 5) { g.box(1.3, 4.4, 1.3, stone, -1.8, 0, 2.5); g.box(1.3, 4.4, 1.3, stone, 1.8, 0, 2.5); g.pyr(1, 2.2, roof, -1.8, 4.4, 2.5); g.pyr(1, 2.2, roof, 1.8, 4.4, 2.5); }
    for (let k = 0; k < 4; k++) for (const x of [-1.55, 1.55]) g.box(.3, 2.4, .5, stone, x, 0, -2.6 + k * 1.3);
    g.cyl(.5, .5, .04, 12, 0x333333, 0, 3.3, 3.21, Math.PI / 2); lit.cyl(.42, .42, .02, 12, 0xffffff, 0, 3.3, 3.25, Math.PI / 2);
    for (let k = 0; k < 4; k++) for (const x of [-1.41, 1.41]) lit.box(.02, 1.2, .35, 0xffffff, x, 1.2, -2.6 + k * 1.3 + .6);
    lit.box(.7, 1.3, .02, 0xffffff, 0, .1, 3.21);
    if (evil) { for (let k = 0; k < 6; k++) g.cone(.12, .9, 4, 0x1a1618, 0, 5.0 + 0, -3 + k * .9); g.cone(.15, 1.2, 4, 0x8a1a14, 0, 8.8, 2.3); }
    else { g.box(.1, .8, .1, trim, 0, 8.8, 2.3); g.box(.5, .1, .1, trim, 0, 9.3, 2.3); }
  } else {
    if (evil) { g.box(6, .3, 6, 0x222, 0, 0, 0); g.cone(1.6, 11, 6, 0x151215, 0, .3, 0); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.cone(.4, 4, 4, 0x201c20, Math.cos(a) * 2.2, .3, Math.sin(a) * 2.2); } lit.cone(.3, 1.2, 6, 0xffffff, 0, 10.5, 0); for (let y = 1.5; y < 9; y += 1.5) lit.cyl(1.62 - y * .14, 1.62 - y * .14, .08, 6, 0xffffff, 0, y, 0); }
    else { g.box(6.4, .3, 6.4, 0xe8e8e8, 0, 0, 0); g.cyl(2.9, 2.9, .06, 20, 0x5ab0e0, 0, .3, 0); g.add(new THREE.ConeGeometry(2.4, 5, 4), 0xa8d8f0, 0, .3 + 2.5, 0, 0, Math.PI / 4, 0); lit.add(new THREE.ConeGeometry(2.42, 5.02, 4), 0xffffff, 0, .3 + 2.5, 0, 0, Math.PI / 4, 0, 1, 1, 1); g.cyl(.08, .1, 3, 6, COL.gold, 0, 5.3, 0); lit.sph(.35, 1, 0xffffff, 0, 8.4, 0); }
  }
  return { g, lit };
}
function modelStatue(align) {
  const g = new GB(), lit = new GB(), evil = align < -.25, good = align > .25;
  const c = evil ? 0x2a2426 : good ? COL.gold : 0xb0a898, ped = evil ? 0x3a3234 : 0xd8d0c0;
  g.box(1.6, .5, 1.6, ped, 0, 0, 0); g.box(1.2, .6, 1.2, ped, 0, .5, 0);
  g.cyl(.3, .45, 1.6, 8, c, 0, 1.1, 0); g.sph(.28, 1, c, 0, 3.0, 0); g.cyl(.22, .3, .5, 8, c, 0, 2.6, 0);
  if (evil) { g.box(.2, 1.3, .2, c, -.55, 2.1, 0, 0, 0, .6); g.box(.2, 1.3, .2, c, .55, 2.1, 0, 0, 0, -.6); g.cone(.08, .6, 5, 0x1a1416, -.2, 3.15, 0, 0, 0, .5); g.cone(.08, .6, 5, 0x1a1416, .2, 3.15, 0, 0, 0, -.5); lit.sph(.05, 0, 0xffffff, -.1, 3.05, .25); lit.sph(.05, 0, 0xffffff, .1, 3.05, .25); g.add(prismGeo(.1, 1.2, 1.4), 0x1a1416, -.5, 2.0, -.3, 0, 0, .8); g.add(prismGeo(.1, 1.2, 1.4), 0x1a1416, .5, 2.0, -.3, 0, 0, -.8); }
  else { g.box(.2, 1.4, .2, c, -.75, 2.3, 0, 0, 0, 1.2); g.box(.2, 1.4, .2, c, .75, 2.3, 0, 0, 0, -1.2); if (good) lit.torus(.35, .04, 0xffffff, 0, 3.55, 0); }
  return { g, lit };
}
function modelStore(style) {
  const g = new GB(), lit = new GB();
  if (style === 0) { for (let k = 0; k < 6; k++) g.cyl(.12, .12, 1.6, 6, 0x7a5230, -.4 + (k % 3) * .25, .12 + Math.floor(k / 3) * .22, -.5, 0, 0, Math.PI / 2); for (let k = 0; k < 4; k++) g.cyl(.25, .2, .4, 7, 0xb89060, .7 - (k % 2) * .5, 0, .6 - Math.floor(k / 2) * .5); g.box(1.4, .05, 1, 0xa9825a, 0, .7, .4, 0, .2); }
  else if (style <= 2) { for (const x of [-.6, .6]) { g.cyl(.55, .5, 1.1, 9, COL.mud, x, .35, 0); for (let k = 0; k < 4; k++) g.cyl(.06, .06, .35, 4, COL.dark, x + Math.cos(k * 1.57) * .35, 0, Math.sin(k * 1.57) * .35); g.cone(.75, .8, 9, COL.thatch, x, 1.45, 0); } }
  else if (style === 3) { g.box(2.4, 1.6, 2.0, COL.stone, 0, 0, 0); g.gable(2.6, .8, 2.2, COL.terracotta, 0, 1.6, 0); g.box(.9, 1.1, .06, 0x5a3a20, 0, 0, 1.01); }
  else if (style === 4) { g.box(2.4, 1.7, 2.2, 0xa0302a, 0, 0, 0); g.gable(2.6, 1.1, 2.4, 0x3a3a40, 0, 1.7, 0, Math.PI / 2); g.box(1.0, 1.2, .06, 0xeeeeee, 0, 0, 1.11); g.box(.9, .08, .07, 0xeeeeee, 0, .6, 1.13, 0, 0, .9); lit.box(.4, .3, .02, 0xffffff, 0, 1.9, 1.11); }
  else if (style === 5) { g.box(2.6, 2.2, 2.2, COL.brick, 0, 0, 0); g.gable(2.7, .7, 2.3, COL.slate, 0, 2.2, 0); g.box(1.2, 1.3, .06, 0x3a3a3a, 0, 0, 1.11); for (const x of [-.9, .9]) lit.box(.35, .5, .02, 0xffffff, x, 1.3, 1.11); }
  else { g.box(2.7, 1.6, 2.4, 0xf2f2f2, 0, 0, 0); g.box(2.72, .35, 2.42, 0xd83a2e, 0, 1.3, 0); lit.box(2.2, 1.0, .02, 0xffffff, 0, .1, 1.21); g.box(.5, .08, .5, 0x777777, .8, 1.6, -.4); }
  return { g, lit };
}
function modelMisc(type, style, align) {
  const g = new GB(), lit = new GB(), anim = {};
  const evil = align < -.25;
  if (type === 'cave') {
    g.sph(2.2, 1, 0x8a847a, 0, .2, 0, 1.2, .75, 1); g.sph(1.4, 1, 0x7a746a, 1.2, .5, -.6, 1, .9, 1); g.sph(1.2, 1, 0x948e84, -1.3, .3, .4, 1, .8, 1);
    g.add(new THREE.CircleGeometry(.75, 8, 0, Math.PI), 0x140e0a, 0, 0, 2.05, 0, 0, 0, 1, 1.3, 1);
    lit.add(new THREE.CircleGeometry(.5, 8, 0, Math.PI), 0xffffff, 0, 0, 2.06, 0, 0, 0, 1, 1.2, 1);
  } else if (type === 'pen') {
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; g.cyl(.05, .05, .7, 4, COL.wood, Math.cos(a) * 1.35, 0, Math.sin(a) * 1.35); }
    for (let k = 0; k < 12; k++) { const a = (k + .5) / 12 * TAU; for (const y of [.3, .55]) g.box(.72, .05, .05, 0x8a6238, Math.cos(a) * 1.3, y, Math.sin(a) * 1.3, -a + Math.PI / 2); }
    g.box(.8, .25, .3, COL.wood, .4, 0, -.6); g.cyl(.35, .4, .5, 7, 0xd8b860, -.5, 0, .4);
  } else if (type === 'workshop') {
    g.box(2.0, 1.4, 1.6, style >= 5 ? COL.brick : COL.stone, -.2, 0, -.4); g.gable(2.2, .7, 1.8, style >= 5 ? COL.slate : COL.terracotta, -.2, 1.4, -.4);
    g.box(.4, 2.6, .4, 0x7a6a60, .6, 0, -.8); g.box(.5, .5, .3, 0x333333, .4, 0, .8); g.box(.2, .15, .6, 0x444a50, .4, .5, .8);
    g.cyl(.4, .45, .8, 8, 0x6a5a50, -.8, 0, .7); lit.cyl(.25, .25, .05, 8, 0xffffff, -.8, .78, .7);
    anim.smoke = [[.6, 2.7, -.8]];
  } else if (type === 'market') {
    const cols = [0xd84a3a, 0x3a8ad8, 0xe8c040, 0x5ab85a, 0xd87ad0, 0xffffff];
    for (let k = 0; k < 6; k++) { const x = -2 + (k % 3) * 2, z = k < 3 ? -1.6 : 1.6; g.box(1.3, .8, .7, COL.wood, x, 0, z); for (const [dx, dz] of [[-.6, -.35], [.6, -.35], [-.6, .35], [.6, .35]]) g.cyl(.04, .04, 1.6, 4, COL.dark, x + dx, 0, z + dz); g.box(1.5, .06, 1.0, cols[k], x, 1.6, z, 0, k < 3 ? .25 : -.25); for (let j = 0; j < 3; j++) g.sph(.12, 0, [0xd04030, 0xe0a030, 0x60a040][j], x - .35 + j * .35, .9, z); }
    g.box(6.4, .04, 6.4, style >= 3 ? 0xc8c0b0 : 0xa89070, 0, 0, 0);
    g.cyl(.3, .35, .4, 8, 0x9a948a, 0, 0, 0); g.sph(.9, 0, 0x4f8a3c, 0, 1.6, 0); g.cyl(.12, .15, 1.2, 6, COL.wood, 0, .3, 0);
  } else if (type === 'school') {
    const modern = style >= 6, c = modern ? 0xe8e0d0 : style >= 5 ? COL.brick : style >= 4 ? COL.plaster : COL.marble;
    g.box(2.5, 1.8, 2.0, c, 0, 0, 0); g.gable(2.7, .8, 2.2, modern ? 0x3a5a8a : COL.slate, 0, 1.8, 0);
    g.box(.7, 1.2, .7, c, 0, 2.2, 0); g.pyr(.55, .8, COL.slate, 0, 3.4, 0); g.cyl(.12, .12, .2, 6, COL.gold, 0, 2.8, .36, Math.PI / 2);
    for (const x of [-.8, 0, .8]) lit.box(.4, .6, .02, 0xffffff, x, .8, 1.01); g.box(.5, .9, .05, 0x5a3a20, 0, 0, 1.02);
    g.cyl(.03, .03, 2.4, 4, 0xcccccc, 1.4, 0, 1.1); g.box(.6, .35, .02, 0x3060c0, 1.72, 2.0, 1.1);
  } else if (type === 'dock') {
    g.box(1.1, .12, 5.5, 0x8a6238, 0, .35, 2.2); for (let k = 0; k < 5; k++) for (const x of [-.45, .45]) g.cyl(.06, .06, 1.8, 4, COL.dark, x, -1.3, .2 + k * 1.1);
    g.box(1.5, .9, 1.2, COL.wood, 0, .4, -.6); g.gable(1.7, .5, 1.4, COL.thatch, 0, 1.3, -.6);
    for (let k = 0; k < 3; k++) g.cyl(.15, .15, .3, 6, 0x7a5230, -.3 + k * .3, .47, 3.5);
  } else if (type === 'castle') {
    const c = evil ? 0x3a3438 : 0xa8a298, roof = evil ? 0x1e1a1e : 0x3a4a6a, flag = evil ? 0x8a1a14 : 0x2a5ab0;
    for (const [x, z, w, d] of [[0, -2.9, 5.8, .5], [0, 2.9, 5.8, .5], [-2.9, 0, .5, 5.8], [2.9, 0, .5, 5.8]]) { g.box(w, 1.8, d, c, x, 0, z); for (let k = -2; k <= 2; k++) g.box(w > d ? .35 : .55, .3, w > d ? .55 : .35, c, x + (w > d ? k * 1.2 : 0), 1.8, z + (w > d ? 0 : k * 1.2)); }
    for (const [x, z] of [[-2.9, -2.9], [2.9, -2.9], [-2.9, 2.9], [2.9, 2.9]]) { g.cyl(.75, .8, 2.8, 8, c, x, 0, z); g.cone(.95, 1.4, 8, roof, x, 2.8, z); }
    g.box(2.4, 4.4, 2.4, c, 0, 0, -.4); for (let k = 0; k < 4; k++) g.box(.4, .35, .4, c, -1 + k * .66, 4.4, .6); g.cyl(.03, .03, 1.6, 4, 0x333333, 0, 4.4, -.4); g.box(.9, .5, .03, flag, .45, 5.4, -.4);
    g.box(1.1, 1.3, .6, 0x2a1a10, 0, 0, 2.95);
    for (const x of [-.6, .6]) for (const y of [1.6, 2.9]) lit.box(.25, .4, .02, 0xffffff, x, y, .81);
  } else if (type === 'mill') {
    g.cyl(.75, 1.1, 3.2, 8, 0xe8e0d0, 0, 0, 0); g.cone(.95, 1.1, 8, COL.thatch, 0, 3.2, 0); g.box(.5, .8, .06, 0x5a3a20, 0, 0, 1.08); lit.box(.25, .35, .02, 0xffffff, 0, 1.8, .93);
    const bl = new GB(); for (let k = 0; k < 4; k++) { bl.add(new THREE.BoxGeometry(.12, 2.6, .05), 0x6a4a2a, Math.cos(k * Math.PI / 2 + Math.PI / 2) * 1.3, Math.sin(k * Math.PI / 2 + Math.PI / 2) * 1.3, 0, 0, 0, k * Math.PI / 2); bl.add(new THREE.BoxGeometry(.6, 2.2, .02), 0xf0e8d8, Math.cos(k * Math.PI / 2 + Math.PI / 2) * 1.4 + Math.cos(k * Math.PI / 2) * .3, Math.sin(k * Math.PI / 2 + Math.PI / 2) * 1.4 + Math.sin(k * Math.PI / 2) * .3, .03, 0, 0, k * Math.PI / 2); }
    anim.blades = { geo: bl.geo(), x: 0, y: 3.1, z: 1.05 };
  } else if (type === 'factory') {
    g.box(6.2, 2.6, 4.4, COL.brick, 0, 0, 0);
    for (let k = 0; k < 4; k++) g.add(prismGeo(4.4, 1.0, 1.55), k % 2 ? 0x4a4a52 : 0x5a5a62, -2.3 + k * 1.55, 2.6, 0, 0, Math.PI / 2, 0);
    for (const x of [-2, 1.8]) { g.cyl(.35, .45, 6.5, 8, 0x8a3a2a, x, 0, -1.8); g.cyl(.4, .4, .3, 8, 0x333333, x, 6.5, -1.8); }
    for (let k = 0; k < 5; k++) lit.box(.7, .9, .02, 0xffffff, -2.4 + k * 1.2, .9, 2.21);
    g.box(1.4, 1.6, .06, 0x3a3a3a, 0, 0, 2.22);
    anim.smoke = [[-2, 6.8, -1.8], [1.8, 6.8, -1.8]];
  } else if (type === 'clock') {
    g.box(1.6, 6.5, 1.6, style >= 6 ? 0xc8c0b0 : 0xb8a888, 0, 0, 0); g.box(1.9, .3, 1.9, 0x9a8a78, 0, 6.5, 0); g.pyr(1.2, 2.2, COL.slate, 0, 6.8, 0);
    for (const [x, z, ry] of [[0, .81, 0], [0, -.81, 0], [.81, 0, Math.PI / 2], [-.81, 0, Math.PI / 2]]) lit.add(new THREE.CircleGeometry(.5, 12), 0xffffff, x, 5.5, z, 0, ry, 0);
  } else if (type === 'hospital') {
    g.box(5.6, 3.2, 3.6, 0xf2f2f0, 0, 0, -.8); g.box(2.4, 5.2, 2.4, 0xf2f2f0, -1.4, 0, -1.2);
    g.box(1.2, .35, .1, 0xd83030, 1.2, 2.4, 1.02); g.box(.35, 1.2, .1, 0xd83030, 1.2, 1.97, 1.02);
    for (let y = .8; y < 3; y += 1) lit.box(5.62, .4, 3.62, 0xffffff, 0, y, -.8);
    for (let y = 3.5; y < 5; y += 1) lit.box(2.42, .4, 2.42, 0xffffff, -1.4, y, -1.2);
    g.box(1.6, .05, 1.6, 0x3a3a3a, 1.4, 3.2, -1.4); g.box(.8, .06, .15, 0xffffff, 1.4, 3.21, -1.4);
  } else if (type === 'stadium') {
    for (let k = 0; k < 28; k++) { const a = k / 28 * TAU, x = Math.cos(a) * 2.8, z = Math.sin(a) * 2.2; g.box(.8, 1.5, .9, k % 2 ? 0xd8d8dc : 0xc8c8cc, x, 0, z, -a + Math.PI / 2, -.35); }
    g.add(new THREE.CircleGeometry(2.1, 20), 0x4a9a3a, 0, .06, 0, -Math.PI / 2, 0, 0, 1.2, 1, 1);
    g.box(.05, .02, 2.8, 0xffffff, 0, .07, 0);
    for (const [x, z] of [[-3.1, -2.5], [3.1, 2.5], [-3.1, 2.5], [3.1, -2.5]]) { g.cyl(.06, .08, 4, 5, 0x555555, x, 0, z); lit.box(.6, .3, .1, 0xffffff, x, 4, z); }
  } else if (type === 'park') {
    g.box(3, .05, 3, 0x5aa048, 0, 0, 0); g.cyl(.5, .55, .25, 10, 0xd8d8d8, 0, .05, 0); g.cyl(.42, .42, .02, 10, 0x4aa0d0, 0, .28, 0);
    for (const [x, z] of [[-1, -1], [1, 1], [1, -1]]) { g.cyl(.07, .09, .7, 5, COL.wood, x, 0, z); g.sph(.45, 0, 0x3f8a3a, x, 1.0, z); }
    g.box(.8, .08, .25, COL.wood, -1, .3, 1); g.box(.8, .3, .05, COL.wood, -1, .35, 1.12);
  } else if (type === 'rocket') {
    g.box(6.4, .3, 6.4, 0x8a8a8a, 0, 0, 0); g.box(2.4, .2, 2.4, 0x555555, 0, .3, 0);
    for (let y = .3; y < 8; y += 1.2) { g.box(.1, 1.2, .1, 0xc04020, 1.6, y, -.6); g.box(.1, 1.2, .1, 0xc04020, 1.6, y, .6); g.box(.08, .08, 1.2, 0xc04020, 1.6, y + 1.1, 0); g.box(.08, 1.6, .08, 0xc04020, 1.6, y, 0, 0, .75, 0); }
    const rk = new GB(); rk.cyl(.55, .55, 6, 12, 0xf2f2f2, 0, 0, 0); rk.cone(.55, 1.6, 12, 0xf2f2f2, 0, 6, 0); rk.cyl(.56, .56, .4, 12, 0x222222, 0, 4.2, 0); rk.cyl(.56, .56, .3, 12, 0xd83030, 0, 1.2, 0);
    for (let k = 0; k < 4; k++) rk.add(prismGeo(.06, 1.0, 1.0), 0xd83030, Math.cos(k * Math.PI / 2) * .7, 0, Math.sin(k * Math.PI / 2) * .7, 0, -k * Math.PI / 2, 0);
    anim.rocket = { geo: rk.geo(), x: 0, y: .5, z: 0 };
  }
  return { g, lit, anim };
}
function modelScaffold(size) {
  const g = new GB(), h = size > 3 ? 4 : 2.2, r = size / 2 - .2;
  for (const [x, z] of [[-r, -r], [r, -r], [-r, r], [r, r], [0, -r], [0, r], [-r, 0], [r, 0]]) g.cyl(.05, .05, h, 4, 0x9a7a4a, x, 0, z);
  for (let y = .8; y < h; y += .9) { g.box(size - .4, .05, .08, 0x9a7a4a, 0, y, -r); g.box(size - .4, .05, .08, 0x9a7a4a, 0, y, r); g.box(.08, .05, size - .4, 0x9a7a4a, -r, y, 0); g.box(.08, .05, size - .4, 0x9a7a4a, r, y, 0); }
  for (let k = 0; k < 3; k++) g.box(.5, .25, .3, 0xb8a080, -r + .4 + k * .5, 0, r + .5);
  return g.geo();
}
function modelRuin(size) {
  const g = new GB(), r = size / 2 - .3;
  for (let k = 0; k < (size > 3 ? 16 : 7); k++) g.box(.3 + mrand() * .6, .2 + mrand() * .5, .3 + mrand() * .5, [0x5a534c, 0x3a3430, 0x2a2420, 0x6a625a][k % 4], (mrand() - .5) * 2 * r, 0, (mrand() - .5) * 2 * r, mrand() * 3, (mrand() - .5) * .6);
  for (let k = 0; k < 3; k++) g.box(.12, .12, size * .7, 0x1e1812, (mrand() - .5) * r, .1, (mrand() - .5) * r, mrand() * 3, 0, .3);
  return g.geo();
}
function buildModel(b, w) {
  _seedR = (b.id * 9301 + 49297) % 233280 + 1;
  const v = b.id % 7, st = b.style;
  let m;
  switch (b.type) {
    case 'home': m = modelHome(st, v, b.big); break;
    case 'fire': m = modelCenter(st); break;
    case 'shrine': m = modelShrine(st, b.align); break;
    case 'temple': m = modelTemple(st, b.align); break;
    case 'statue': m = modelStatue(b.align); break;
    case 'store': m = modelStore(st); break;
    case 'field': m = { g: new GB(), lit: new GB() }; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; m.g.cyl(.05, .05, .5, 4, COL.wood, Math.cos(a) * 3.3, 0, Math.sin(a) * 3.3); } break;
    default: m = modelMisc(b.type, st, b.align);
  }
  return m;
}

// -------------------------------------------------------------- tree, rock, grass, crop geometry
function treeGeos() {
  const T = {};
  const mk = (fn) => { const t = new GB(), f = new GB(); fn(t, f); return { trunk: t.geo(), leaf: f.geo() }; };
  _seedR = 7;
  T.broad = mk((t, f) => { t.cyl(.09, .14, 1.3, 5, 0x6a4a30); f.sph(.75, 0, 0xffffff, 0, 1.75, 0, 1, .85, 1); f.sph(.5, 0, 0xffffff, .35, 1.45, .2); f.sph(.48, 0, 0xffffff, -.3, 1.5, -.25); });
  T.pine = mk((t, f) => { t.cyl(.07, .12, .7, 5, 0x5a3a24); f.cone(.75, 1.3, 6, 0xffffff, 0, .55, 0); f.cone(.58, 1.1, 6, 0xffffff, 0, 1.2, 0); f.cone(.38, .9, 6, 0xffffff, 0, 1.8, 0); });
  T.palm = mk((t, f) => { for (let k = 0; k < 5; k++) t.cyl(.08 - k * .007, .09 - k * .007, .45, 5, 0x8a6a44, k * .06, k * .43, 0, 0, 0, -.12); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; f.add(new THREE.BoxGeometry(1.1, .04, .28), 0xffffff, .3 + Math.cos(a) * .5, 2.15, Math.sin(a) * .5, 0, -a, -.35); } });
  T.jungle = mk((t, f) => { t.cyl(.14, .24, 2.6, 6, 0x5a4a34); for (let k = 0; k < 3; k++) t.cyl(.03, .05, .6, 4, 0x5a4a34, Math.cos(k * 2.1) * .2, 0, Math.sin(k * 2.1) * .2, Math.cos(k * 2.1) * .4, 0, Math.sin(k * 2.1) * .4); f.sph(1.1, 0, 0xffffff, 0, 3.0, 0, 1.3, .55, 1.3); f.sph(.7, 0, 0xffffff, .6, 2.6, .3, 1, .6, 1); f.sph(.6, 0, 0xffffff, -.5, 2.7, -.4, 1, .6, 1); });
  T.bush = mk((t, f) => { t.cyl(.03, .04, .1, 4, 0x5a4a30); f.sph(.42, 0, 0xffffff, 0, .3, 0, 1.2, .8, 1.1); f.sph(.3, 0, 0xffffff, .3, .25, .1); });
  T.berry = mk((t, f) => { t.cyl(.03, .04, .1, 4, 0x5a4a30); f.sph(.4, 0, 0xffffff, 0, .32, 0, 1.2, .85, 1.1); f.sph(.28, 0, 0xffffff, .3, .26, .12); });
  return T;
}
const LEAF = {
  broad: [[0x6fb24a, 0x5a9e3c, 0x86c05a], [0x4e8a34, 0x5a9438, 0x46802e], [0xd98a2a, 0xc0502a, 0xe0b040, 0xa8602a], [0x8a7a6a, 0x9a8a7a]],
  pine: [[0x3f6e3a, 0x2f5e30], [0x355e32, 0x2c5430], [0x3a6234, 0x305a30], [0xdce6ea, 0xc8d8dc]],
  palm: [[0x5aa040, 0x4a9038], [0x4a9038, 0x55983c], [0x6a9a3a, 0x7aa040], [0x5a8a40, 0x4a7a38]],
  jungle: [[0x3a8a3a, 0x2f7a34, 0x44944a], [0x2f7a34, 0x2a6e30], [0x3a7a30, 0x4a8a34], [0x2f6a34, 0x3a7038]],
  bush: [[0x5a9a40, 0x4a8a38], [0x4a8034, 0x557a38], [0x9a7a30, 0x8a6a2a], [0x9aa8a0, 0x8a9890]],
  berry: [[0x4a8a3a, 0x3a7a34], [0x3f7a34, 0x4a8438], [0x6a7a34, 0x5a7030], [0x8a9890, 0x7a8880]],
};

// -------------------------------------------------------------- people geometry
function personGeos() {
  const G = {};
  const box = (w, h, d, y) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, y, 0); return g; };
  G.leg = box(.12, .44, .13, -.22);
  G.arm = box(.09, .4, .1, -.19);
  G.torso = (() => { const g = new THREE.CylinderGeometry(.14, .17, .4, 6); g.translate(0, .2, 0); return g; })();
  G.head = new THREE.IcosahedronGeometry(.13, 1);
  G.skirt = (() => { const g = new THREE.CylinderGeometry(.15, .25, .36, 7); g.translate(0, -.14, 0); return g; })();
  G.hair = [
    (() => { const g = new THREE.IcosahedronGeometry(.14, 1); g.scale(1, .7, 1.05); g.translate(0, .05, -.02); return g; })(),
    (() => { const b = new GB(); b.sph(.14, 1, 0xffffff, 0, .04, -.02, 1, .72, 1.05); b.box(.24, .3, .08, 0xffffff, 0, -.26, -.1); return b.geo(); })(),
    (() => { const b = new GB(); b.sph(.14, 1, 0xffffff, 0, .04, -.02, 1, .7, 1.05); b.sph(.08, 0, 0xffffff, 0, .13, -.12); return b.geo(); })(),
    (() => { const g = new THREE.IcosahedronGeometry(.135, 0); g.scale(1, .55, 1); g.translate(0, .07, 0); return g; })(),
  ];
  G.hat = [
    null, null, null,
    (() => { const b = new GB(); b.cyl(.2, .2, .03, 8, 0xffffff, 0, .08, 0); b.cyl(.12, .14, .12, 8, 0xffffff, 0, .1, 0); return b.geo(); })(),
    (() => { const b = new GB(); b.cone(.16, .28, 7, 0xffffff, 0, .08, 0); return b.geo(); })(),
    (() => { const b = new GB(); b.cyl(.2, .2, .02, 10, 0xffffff, 0, .1, 0); b.cyl(.12, .12, .26, 10, 0xffffff, 0, .1, 0); return b.geo(); })(),
    (() => { const b = new GB(); b.sph(.14, 1, 0xffffff, 0, .08, 0, 1, .55, 1); b.box(.16, .02, .12, 0xffffff, 0, .09, .12); return b.geo(); })(),
  ];
  const tb = fn => { const b = new GB(); fn(b); return b.geo(); };
  G.tools = {
    spear: tb(b => { b.cyl(.015, .015, 1.2, 4, 0x7a5230, 0, -.9, 0); b.cone(.035, .14, 4, 0x8a8a8a, 0, .3, 0); }),
    axe: tb(b => { b.cyl(.018, .018, .5, 4, 0x7a5230, 0, -.3, 0); b.box(.02, .12, .14, 0x8a8a90, 0, .12, .06); }),
    pick: tb(b => { b.cyl(.018, .018, .5, 4, 0x7a5230, 0, -.3, 0); b.box(.02, .04, .36, 0x707078, 0, .18, 0); }),
    hoe: tb(b => { b.cyl(.015, .015, .9, 4, 0x7a5230, 0, -.6, 0); b.box(.02, .12, .12, 0x707078, 0, .28, .05); }),
    rod: tb(b => { b.cyl(.01, .015, 1.4, 4, 0x9a7a4a, 0, -.2, 0); }),
    hammer: tb(b => { b.cyl(.018, .018, .35, 4, 0x7a5230, 0, -.2, 0); b.box(.06, .06, .14, 0x606068, 0, .12, 0); }),
    book: tb(b => { b.box(.16, .2, .05, 0x8a3030, 0, -.05, .06); }),
    torch: tb(b => { b.cyl(.02, .025, .5, 4, 0x5a3a20, 0, -.3, 0); b.sph(.06, 0, 0xffa030, 0, .22, 0); }),
    sword: tb(b => { b.box(.03, .6, .01, 0xc8ccd4, 0, .05, 0); b.box(.16, .03, .03, 0x6a4a2a, 0, -.25, 0); }),
    staff: tb(b => { b.cyl(.02, .02, 1.3, 4, 0x6a4a2a, 0, -.7, 0); b.sph(.05, 0, 0xffe080, 0, .6, 0); }),
    rifle: tb(b => { b.box(.03, .7, .05, 0x3a3a3a, 0, -.05, 0); }),
    phone: tb(b => { b.box(.06, .1, .01, 0x222222, 0, -.02, .05); }),
    club: tb(b => { b.cyl(.04, .025, .5, 5, 0x6a4a2a, 0, -.15, 0); }),
  };
  G.bundle = { wood: tb(b => { for (let k = 0; k < 3; k++) b.cyl(.04, .04, .5, 5, 0x7a5230, 0, 0, 0, Math.PI / 2, 0, 0); b.cyl(.04, .04, .5, 5, 0x6a4a2a, .08, 0, .06, Math.PI / 2); b.cyl(.04, .04, .5, 5, 0x6a4a2a, -.08, 0, .06, Math.PI / 2); }), food: tb(b => { b.cyl(.13, .1, .15, 7, 0xb89060); b.sph(.05, 0, 0xd03a2a, .04, .17, 0); b.sph(.05, 0, 0x60a040, -.04, .17, .03); b.sph(.05, 0, 0xe0a030, 0, .17, -.04); }), stone: tb(b => { b.sph(.12, 0, 0x8a8a8a, 0, .08, 0); }), metal: tb(b => { b.box(.18, .08, .1, 0xc07a3a, 0, 0, 0); b.box(.18, .08, .1, 0x8a8a90, 0, .08, 0); }), water: tb(b => { b.cyl(.1, .08, .18, 7, 0x6a4a2a); b.cyl(.09, .09, .01, 7, 0x4a90d0, 0, .17, 0); }), offering: tb(b => { b.cyl(.14, .12, .1, 8, 0xd8b060); b.sph(.08, 0, 0xd04030, 0, .12, 0); }) };
  G.halo = new THREE.TorusGeometry(.16, .025, 4, 12); G.halo.rotateX(Math.PI / 2);
  return G;
}
function animalGeos() {
  const A = {}, mk = fn => { const b = new GB(); fn(b); return b.geo(); };
  A.deer = mk(b => { b.sph(.3, 0, 0x9a6a3a, 0, .62, 0, .8, .75, 1.5); b.cyl(.07, .1, .45, 5, 0x9a6a3a, 0, .7, .38, .7); b.sph(.12, 0, 0x8a5a30, 0, 1.02, .6, .8, .8, 1.3); b.sph(.03, 0, 0x222222, 0, .98, .76); b.sph(.07, 0, 0xf0e8d8, 0, .7, -.42); b.cone(.04, .12, 3, 0x7a4a28, -.07, 1.1, .56, -.3); b.cone(.04, .12, 3, 0x7a4a28, .07, 1.1, .56, -.3); for (const s of [-1, 1]) { b.cyl(.015, .02, .3, 3, 0xd8c8a8, s * .06, 1.08, .56, 0, 0, s * -.5); b.cyl(.012, .015, .15, 3, 0xd8c8a8, s * .14, 1.25, .56, .5, 0, s * -.3); } });
  A.boar = mk(b => { b.sph(.32, 0, 0x4a3a30, 0, .45, 0, .85, .8, 1.35); b.sph(.18, 0, 0x3a2e26, 0, .45, .42, .9, .85, 1.2); b.cyl(.06, .08, .14, 6, 0x6a5048, 0, .38, .6, Math.PI / 2); b.cone(.02, .12, 3, 0xf0e8d8, -.07, .36, .56, -1.2); b.cone(.02, .12, 3, 0xf0e8d8, .07, .36, .56, -1.2); b.box(.04, .1, .5, 0x2a201a, 0, .68, 0); b.cone(.04, .1, 3, 0x3a2e26, -.08, .6, .45); b.cone(.04, .1, 3, 0x3a2e26, .08, .6, .45); });
  A.wolf = mk(b => { b.sph(.24, 0, 0x7a7a80, 0, .55, 0, .8, .8, 1.6); b.sph(.16, 0, 0x8a8a90, 0, .72, .45, .9, .85, 1); b.cone(.07, .22, 4, 0x6a6a70, 0, .68, .64, Math.PI / 2); b.cone(.04, .12, 3, 0x5a5a60, -.07, .88, .42); b.cone(.04, .12, 3, 0x5a5a60, .07, .88, .42); b.cone(.07, .45, 5, 0x6a6a70, 0, .5, -.5, -2.2); b.sph(.025, 0, 0xe0c030, -.05, .76, .56); b.sph(.025, 0, 0xe0c030, .05, .76, .56); });
  A.mammoth = mk(b => { b.sph(.8, 1, 0x6a4028, 0, 1.45, 0, 1, .95, 1.3); b.sph(.5, 1, 0x5a3420, 0, 1.75, .85, 1, 1, .9); b.sph(.35, 0, 0x5a3420, 0, 2.15, .75); for (let k = 0; k < 5; k++) b.cyl(.13 - k * .015, .13 - k * .015, .3, 5, 0x4a2c1a, 0, 1.55 - k * .27, 1.28 + Math.sin(k * .5) * .08, .2 * k); for (const s of [-1, 1]) { b.add(new THREE.TorusGeometry(.45, .05, 4, 8, Math.PI * .8), 0xf2ead8, s * .25, 1.3, 1.2, 0, s * .2 + Math.PI / 2, 0); b.sph(.3, 0, 0x5a3420, s * .5, 1.8, .7, .3, 1, .8); } b.cyl(.04, .04, .4, 3, 0x3a2418, 0, 1.4, -1.0, -2.4); });
  A.sheep = mk(b => { for (let k = 0; k < 7; k++) b.sph(.18, 0, 0xf0ece0, (mrand() - .5) * .3, .5 + (mrand() - .3) * .15, (mrand() - .5) * .5); b.sph(.1, 0, 0x2a2420, 0, .52, .38, .85, 1, 1.2); b.cone(.03, .08, 3, 0x2a2420, -.08, .58, .36, 0, 0, 1.2); b.cone(.03, .08, 3, 0x2a2420, .08, .58, .36, 0, 0, -1.2); });
  A.cow = mk(b => { b.sph(.36, 0, 0xf0ece4, 0, .78, 0, .85, .75, 1.45); b.sph(.2, 0, 0x2a2420, .15, .9, -.2, 1, .6, 1.2); b.sph(.16, 0, 0x2a2420, -.18, .75, .25); b.sph(.17, 0, 0xf0ece4, 0, .85, .55, .9, .9, 1.2); b.box(.18, .1, .1, 0xe8a8a0, 0, .72, .7); b.cone(.03, .14, 3, 0xe8e0c8, -.13, 1.0, .5, 0, 0, 1); b.cone(.03, .14, 3, 0xe8e0c8, .13, 1.0, .5, 0, 0, -1); });
  A.dog = mk(b => { b.sph(.16, 0, 0xb8864a, 0, .38, 0, .8, .8, 1.5); b.sph(.12, 0, 0xc8965a, 0, .52, .28, .9, .9, 1.1); b.cone(.05, .12, 4, 0xb8864a, 0, .5, .42, Math.PI / 2); b.cone(.04, .08, 3, 0x6a4a2a, -.06, .64, .26); b.cone(.04, .08, 3, 0x6a4a2a, .06, .64, .26); b.cone(.03, .22, 4, 0xb8864a, 0, .5, -.28, -.6); });
  A.leg = (() => { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, -.5, 0); return g; })();
  return A;
}
const LEGS = { deer: [.08, .55, .1, .34, .06], boar: [.08, .32, .12, .26, .09], wolf: [.08, .42, .11, .3, .08], mammoth: [.35, 1.0, .4, .62, .26], sheep: [.08, .34, .1, .2, .06], cow: [.1, .5, .14, .36, .1], dog: [.06, .26, .07, .16, .05] };
// [thickness, length, lateral offset, fore/aft offset, (unused)]

// -------------------------------------------------------------- shaders
function waterMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uH: { value: null }, uWater: { value: 0 }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) }, uSky: { value: new THREE.Color(.6, .8, 1) }, uDeep: { value: new THREE.Color(0x0e4a6e) }, uShallow: { value: new THREE.Color(0x3aa6b0) }, uFog: { value: new THREE.Color() }, uFogNear: { value: 100 }, uFogFar: { value: 400 }, uAmb: { value: 1 }, uN: { value: 128 } },
    vertexShader: `uniform float uTime; varying vec3 vW; varying float vFogDepth;
      void main(){ vec3 p = position; vec4 wp = modelMatrix * vec4(p,1.); wp.y += sin(wp.x*.35+uTime*1.2)*.05 + cos(wp.z*.3+uTime)*.05; vW = wp.xyz; vec4 mv = viewMatrix * wp; vFogDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime, uWater, uFogNear, uFogFar, uAmb, uN; uniform sampler2D uH; uniform vec3 uSun, uSunCol, uSky, uDeep, uShallow, uFog; varying vec3 vW; varying float vFogDepth;
      float hsh(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      float nz(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x), mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 uv = (vW.xz + .5) / (uN + 1.);
        float h = texture2D(uH, uv).r * 32. - 8.;
        float depth = uWater - h;
        if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) depth = 3.;
        if (depth < -.02) discard;
        float t = uTime;
        vec3 n = normalize(vec3(sin(vW.x*.9+t*1.3)*.08 + nz(vW.xz*1.3+t*.4)*.12 - .06, 1., cos(vW.z*.8+t*1.1)*.08 + nz(vW.zx*1.1-t*.3)*.12 - .06));
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1. - max(dot(n, V), 0.), 3.);
        vec3 base = mix(uShallow, uDeep, smoothstep(.1, 2.6, depth));
        vec3 col = mix(base * uAmb, uSky, fres * .55);
        vec3 H = normalize(uSun + V); float sp = pow(max(dot(n, H), 0.), 140.) * 1.6;
        col += uSunCol * sp;
        float foam = smoothstep(.45, 0., depth) * (.55 + .45 * nz(vW.xz*3. + t*.6));
        foam += smoothstep(.08, 0., abs(depth - .25 - sin(t*1.4 + vW.x*.2)*.08)) * .35;
        col = mix(col, vec3(.95) * max(uAmb, .25), clamp(foam, 0., .8));
        float a = clamp(.5 + depth * .25 + fres * .2, .45, .9);
        float f = smoothstep(uFogNear, uFogFar, vFogDepth);
        gl_FragColor = vec4(mix(col, uFog, f), a);
      }`,
  });
}
function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color(0x3b7bd0) }, uHor: { value: new THREE.Color(0xbfdcf0) }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, .9, .7) }, uNight: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 uTop, uHor, uSun, uSunCol; uniform float uNight, uTime; varying vec3 vD;
      void main(){ float h = vD.y; vec3 c = mix(uHor, uTop, pow(clamp(h,0.,1.), .5)); c = mix(c, uHor*.85, smoothstep(0., -.3, h));
        float sd = max(dot(vD, uSun), 0.); c += uSunCol * (pow(sd, 900.) * 4. + pow(sd, 10.) * .3) * (1. - uNight*.7);
        if (uNight > .01) { vec3 d = vD * 260.; vec3 cc = floor(d); float n = fract(sin(dot(cc, vec3(12.9898,78.233,37.719)))*43758.5453); float tw = .6 + .4*sin(uTime*2. + n*50.); c += vec3(step(.9978, n) * uNight * smoothstep(0., .25, h) * tw); }
        gl_FragColor = vec4(c, 1.); }`,
  });
}
function particleMaterial(additive) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uScale: { value: 400 } },
    vertexShader: `attribute float aSize; attribute vec4 aCol; varying vec4 vC; uniform float uScale; void main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = aSize * uScale / max(-mv.z, .1); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec4 vC; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .05, d) * vC.a; if (a < .01) discard; gl_FragColor = vec4(vC.rgb, a); }`,
  });
}

// -------------------------------------------------------------- particles
class Particles {
  constructor(scene, cap, additive) {
    this.cap = cap; this.n = 0;
    this.d = new Float32Array(cap * 16); // x y z vx vy vz life max s0 s1 r g b a grav drag
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 4); this.size = new Float32Array(cap);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = particleMaterial(additive); this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = additive ? 3 : 2; scene.add(this.pts); this.g = g;
  }
  add(x, y, z, vx, vy, vz, life, s0, s1, col, a = 1, grav = 0, drag = 0) {
    if (this.n >= this.cap) return; const d = this.d, o = this.n++ * 16;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = vx; d[o + 4] = vy; d[o + 5] = vz; d[o + 6] = life; d[o + 7] = life; d[o + 8] = s0; d[o + 9] = s1;
    _c.set(col); d[o + 10] = _c.r; d[o + 11] = _c.g; d[o + 12] = _c.b; d[o + 13] = a; d[o + 14] = grav; d[o + 15] = drag;
  }
  update(dt) {
    const d = this.d; let j = 0;
    for (let i = 0; i < this.n; i++) {
      const o = i * 16; d[o + 6] -= dt; if (d[o + 6] <= 0) continue;
      const dr = 1 - d[o + 15] * dt; d[o + 3] *= dr; d[o + 4] = d[o + 4] * dr - d[o + 14] * dt; d[o + 5] *= dr;
      d[o] += d[o + 3] * dt; d[o + 1] += d[o + 4] * dt; d[o + 2] += d[o + 5] * dt;
      if (j !== i) for (let k = 0; k < 16; k++) d[j * 16 + k] = d[o + k];
      const q = j * 16, t = 1 - d[q + 6] / d[q + 7];
      this.pos[j * 3] = d[q]; this.pos[j * 3 + 1] = d[q + 1]; this.pos[j * 3 + 2] = d[q + 2];
      this.size[j] = d[q + 8] + (d[q + 9] - d[q + 8]) * t;
      const fade = t < .15 ? t / .15 : 1 - (t - .15) / .85;
      this.col[j * 4] = d[q + 10]; this.col[j * 4 + 1] = d[q + 11]; this.col[j * 4 + 2] = d[q + 12]; this.col[j * 4 + 3] = d[q + 13] * fade;
      j++;
    }
    this.n = j; this.g.setDrawRange(0, j);
    for (const k of ['position', 'aCol', 'aSize']) this.g.attributes[k].needsUpdate = true;
  }
}

// -------------------------------------------------------------- instanced helpers
function inst(geo, mat, cap, shadow = true) {
  const m = new THREE.InstancedMesh(geo, mat, cap); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false; m.castShadow = shadow; m.receiveShadow = true; m.count = 0; return m;
}
function swayMaterial(opts) {
  const m = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, flatShading: true, roughness: .9 }, opts));
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = R.uTime; sh.uniforms.uWind = R.uWind;
    sh.vertexShader = 'uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
        vec3 ip = vec3(0.);
      #endif
      float sw = sin(uTime * 1.7 + ip.x * .37 + ip.z * .23) * uWind * max(0., position.y) * .06;
      transformed.x += sw; transformed.z += sw * .7;`);
  };
  return m;
}

// -------------------------------------------------------------- init
function initRender(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xbfdcf0, 120, 330);
  const camera = new THREE.PerspectiveCamera(42, 1, .3, 900);
  Object.assign(R, { renderer, scene, camera, canvas });
  R.uTime = { value: 0 }; R.uWind = { value: .4 };
  // lights
  R.hemi = new THREE.HemisphereLight(0xcfe6ff, 0x5a4a30, .9); scene.add(R.hemi);
  R.sun = new THREE.DirectionalLight(0xfff0d8, 2.2); R.sun.castShadow = true;
  R.sun.shadow.mapSize.set(2048, 2048); R.sun.shadow.bias = -.0006; R.sun.shadow.normalBias = .04;
  const sc = R.sun.shadow.camera; sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 260;
  scene.add(R.sun); scene.add(R.sun.target);
  R.flashLight = new THREE.PointLight(0xcfe0ff, 0, 60, 1.2); scene.add(R.flashLight);
  R.fireLights = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xff9a40, 0, 22, 1.4); scene.add(l); return l; });
  // sky, sun disc, moon
  R.sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), skyMaterial()); R.sky.renderOrder = -1; scene.add(R.sky);
  R.moon = new THREE.Mesh(new THREE.IcosahedronGeometry(9, 2), new THREE.MeshBasicMaterial({ color: 0xf0f0ff, fog: false })); scene.add(R.moon);
  // materials
  R.mat = {
    terrain: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .95, metalness: 0 }),
    solid: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85 }),
    leaf: swayMaterial({ roughness: .85 }),
    lit: new THREE.MeshBasicMaterial({ color: 0x33404a }),
    glow: new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }),
    lava: new THREE.MeshBasicMaterial({ vertexColors: false, color: 0xffffff }),
    body: new THREE.MeshStandardMaterial({ roughness: .8, flatShading: true }),
    beam: new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    ring: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide }),
  };
  R.mat.lava.color.setRGB(1, 1, 1);
  // particles
  R.pAdd = new Particles(scene, 5000, true);
  R.pNorm = new Particles(scene, 5000, false);
  // shared geometries
  R.treeG = treeGeos(); R.personG = personGeos(); R.animalG = animalGeos();
  R.trees = {};
  for (const k of TREE_KINDS) { R.trees[k] = { trunk: inst(R.treeG[k].trunk, R.mat.solid, 4000), leaf: inst(R.treeG[k].leaf, R.mat.leaf, 4000) }; scene.add(R.trees[k].trunk, R.trees[k].leaf); }
  R.berries = inst(new THREE.IcosahedronGeometry(.07, 0), R.mat.body, 3000, false); scene.add(R.berries);
  const rockG = new THREE.DodecahedronGeometry(.5, 0); rockG.scale(1, .7, 1);
  R.rocks = inst(rockG, R.mat.body, 1500); scene.add(R.rocks);
  // people
  const P = R.personG, cap = 420;
  R.pp = {
    legs: inst(P.leg, R.mat.body, cap * 2), arms: inst(P.arm, R.mat.body, cap * 2), torso: inst(P.torso, R.mat.body, cap), head: inst(P.head, R.mat.body, cap), skirt: inst(P.skirt, R.mat.body, cap),
    hair: P.hair.map(g => inst(g, R.mat.body, cap)), hat: P.hat.map(g => g ? inst(g, R.mat.body, cap) : null),
    tools: Object.fromEntries(Object.entries(P.tools).map(([k, g]) => [k, inst(g, R.mat.solid, cap, false)])),
    bundle: Object.fromEntries(Object.entries(P.bundle).map(([k, g]) => [k, inst(g, R.mat.solid, cap, false)])),
    halo: inst(P.halo, R.mat.glow, cap, false),
  };
  for (const v of Object.values(R.pp)) { if (v instanceof THREE.InstancedMesh) scene.add(v); else if (Array.isArray(v)) v.forEach(m => m && scene.add(m)); else Object.values(v).forEach(m => scene.add(m)); }
  // animals
  R.an = {}; for (const k of Object.keys(R.animalG)) if (k !== 'leg') { R.an[k] = inst(R.animalG[k], R.mat.solid, 160); scene.add(R.an[k]); }
  R.anLegs = inst(R.animalG.leg, R.mat.body, 1400); scene.add(R.anLegs);
  // birds
  const wing = new THREE.BufferGeometry(); wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .12, 0, 0, -.12, .7, 0, 0], 3)); wing.computeVertexNormals();
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x2a2a30, side: THREE.DoubleSide });
  R.birdL = new THREE.InstancedMesh(wing, birdMat, 60); R.birdR = new THREE.InstancedMesh(wing, birdMat, 60); R.birdL.frustumCulled = R.birdR.frustumCulled = false; scene.add(R.birdL, R.birdR);
  R.birds = []; for (let f = 0; f < 3; f++) { const c = { x: 30 + f * 30, z: 40 + f * 20, r: 20 + f * 8, a: f * 2, y: 18 + f * 4, sp: .12 + f * .04 }; for (let k = 0; k < 12; k++) R.birds.push({ f: c, ox: (Math.random() - .5) * 5, oy: (Math.random() - .5) * 2, oz: (Math.random() - .5) * 5, ph: Math.random() * 6 }); }
  // crops, grass, graves, lava, lamps, cars, boats
  const cropG = new GB(); _seedR = 3; cropG.cone(.12, .5, 4, 0xffffff, 0, 0, 0); cropG.cone(.1, .42, 4, 0xffffff, .12, 0, .06); cropG.cone(.1, .4, 4, 0xffffff, -.1, 0, -.06);
  R.crops = inst(cropG.geo(), R.mat.leaf, 4000, false); scene.add(R.crops);
  const grassG = new GB(); grassG.cone(.05, .35, 3, 0xffffff, 0, 0, 0, .2); grassG.cone(.05, .3, 3, 0xffffff, .08, 0, .05, -.25); grassG.cone(.05, .28, 3, 0xffffff, -.07, 0, -.04, 0, 0, .3);
  R.grass = inst(grassG.geo(), R.mat.leaf, 9000, false); scene.add(R.grass);
  R.flowers = inst(new THREE.IcosahedronGeometry(.07, 0), R.mat.body, 2500, false); scene.add(R.flowers);
  const graveG = new GB(); graveG.box(.35, .5, .1, 0xffffff, 0, 0, 0); graveG.box(.4, .04, .7, 0x6a8a4a, 0, 0, .35);
  R.graves = inst(graveG.geo(), R.mat.solid, 60); scene.add(R.graves);
  R.lavaM = inst(new THREE.IcosahedronGeometry(.8, 0), R.mat.lava, 1000, false); R.lavaM.geometry.scale(1, .25, 1); scene.add(R.lavaM);
  const lampG = new GB(); lampG.cyl(.035, .05, 1.8, 5, 0x2a2a2a, 0, 0, 0); lampG.box(.25, .05, .08, 0x2a2a2a, .1, 1.78, 0);
  R.lamps = inst(lampG.geo(), R.mat.solid, 300, false); scene.add(R.lamps);
  R.lampGlow = inst(new THREE.IcosahedronGeometry(.12, 1), R.mat.glow, 300, false); scene.add(R.lampGlow);
  const carG = new GB(); carG.box(.5, .22, .95, 0xffffff, 0, .08, 0); carG.box(.44, .2, .5, 0xffffff, 0, .3, -.05); carG.box(.46, .14, .48, 0x223344, 0, .32, -.05);
  for (const [x, z] of [[-.22, .3], [.22, .3], [-.22, -.3], [.22, -.3]]) carG.cyl(.09, .09, .06, 8, 0x111111, x, .0, z, 0, 0, Math.PI / 2);
  R.cars = inst(carG.geo(), R.mat.solid, 60, true); scene.add(R.cars); R.carList = [];
  const boatG = new GB(); boatG.box(.6, .25, 1.5, 0x7a5230, 0, 0, 0); boatG.cyl(.03, .03, 1.5, 4, 0x5a3a20, 0, .25, 0); boatG.add(prismGeo(.02, 1.1, .7), 0xf2ece0, 0, .45, .1, 0, Math.PI / 2, 0);
  R.boats = inst(boatG.geo(), R.mat.solid, 12); scene.add(R.boats);
  // clouds
  R.clouds = []; const cMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1, transparent: true, opacity: .92, emissive: 0x9aa8b8, emissiveIntensity: .25 });
  R.cloudMat = cMat;
  for (let k = 0; k < 14; k++) { const b = new GB(); _seedR = 100 + k; for (let j = 0; j < 5; j++) b.sph(2 + mrand() * 2, 0, 0xffffff, (mrand() - .5) * 8, (mrand() - .5) * 1.2, (mrand() - .5) * 4, 1, .6, 1); const m = new THREE.Mesh(b.geo(), cMat); m.castShadow = true; m.position.set(Math.random() * 180 - 26, 30 + Math.random() * 10, Math.random() * 180 - 26); scene.add(m); R.clouds.push(m); }
  R.stormCloud = new THREE.Mesh(new THREE.CylinderGeometry(16, 14, 3, 12), new THREE.MeshStandardMaterial({ color: 0x3a4250, transparent: true, opacity: 0, flatShading: true, roughness: 1 })); scene.add(R.stormCloud);
  // rain & snow
  const rainG = new THREE.BufferGeometry(); R.rainPos = new Float32Array(1600 * 6); rainG.setAttribute('position', new THREE.BufferAttribute(R.rainPos, 3).setUsage(THREE.DynamicDrawUsage));
  R.rain = new THREE.LineSegments(rainG, new THREE.LineBasicMaterial({ color: 0xa8c0d8, transparent: true, opacity: .45 })); R.rain.frustumCulled = false; scene.add(R.rain);
  R.rainDrops = Array.from({ length: 1600 }, () => ({ x: 0, y: -99, z: 0 }));
  // selection & cursor rings
  R.selRing = new THREE.Mesh(new THREE.RingGeometry(.55, .7, 24), R.mat.ring.clone()); R.selRing.rotation.x = -Math.PI / 2; R.selRing.visible = false; scene.add(R.selRing);
  R.cursor = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 40), R.mat.ring.clone()); R.cursor.rotation.x = -Math.PI / 2; R.cursor.visible = false; R.cursor.renderOrder = 5; scene.add(R.cursor);
  R.cursorDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .1, depthWrite: false })); R.cursorDisc.rotation.x = -Math.PI / 2; R.cursorDisc.visible = false; scene.add(R.cursorDisc);
  R.handOrb = new THREE.Mesh(new THREE.IcosahedronGeometry(.45, 2), new THREE.MeshBasicMaterial({ color: 0xffe8a0, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false })); R.handOrb.visible = false; scene.add(R.handOrb);
  // effects containers
  R.bolts = []; R.beams = []; R.rings = []; R.meteors = new Map(); R.tornadoMeshes = new Map();
  R.rainbow = (() => { const g = new THREE.TorusGeometry(70, 3.2, 8, 64, Math.PI); const cols = []; const pos = g.attributes.position; const rb = [0xff4040, 0xff9a30, 0xffe040, 0x50d050, 0x40a0ff, 0x7040ff]; for (let i = 0; i < pos.count; i++) { _v.fromBufferAttribute(pos, i); const r = Math.hypot(_v.x, _v.y); const t = clamp01((r - 66.8) / 6.4); _c.set(rb[Math.min(5, Math.floor(t * 6))]); cols.push(_c.r, _c.g, _c.b); } g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); scene.add(m); return m; })();
  R.bld = new Map(); R.scaffoldG = { 3: modelScaffold(3), 7: modelScaffold(7) }; R.ruinG = { 3: modelRuin(3), 7: modelRuin(7) };
  R.ready = true;
  return R;
}

// -------------------------------------------------------------- terrain
const T_COL = {};
function tileColour(w, i, x, z, season, snow, out) {
  const t = w.tile[i], hv = hash2(w.seed + 3, x, z), j = .93 + hv * .14;
  let c;
  const road = w.road[i], occ = w.occ[i];
  if (isWater(t)) { const d = w.water - (w.H[z * V + x] + w.H[z * V + x + 1] + w.H[(z + 1) * V + x] + w.H[(z + 1) * V + x + 1]) / 4; c = _c2.set(0xb8a878).lerp(_c.set(0x2a4a3a), clamp01(d / 3)); }
  else if (t === TT.SAND) c = _c2.set(0xdac594);
  else if (t === TT.ROCK) c = _c2.set(hv > .5 ? 0x8d867a : 0x7c766c);
  else if (t === TT.SNOW) c = _c2.set(0xf0f4f8);
  else if (t === TT.JUNGLE) c = _c2.set([0x3f8a3a, 0x3f8a3a, 0x4a8a38, 0x3a7a3a][season]);
  else if (t === TT.FOREST) c = _c2.set([0x55883e, 0x4f7e3a, 0x6a7a3a, 0x5a6e44][season]);
  else c = _c2.set([0x74b04a, 0x8aac44, 0xa8a048, 0x8a9a5a][season]).lerp(_c.set(0x6aa048), (1 - w.fert[i]) * .2);
  if (occ >= 0) { const b = w.bmap.get(occ); if (b && b.type === 'field') c = _c2.set(((z + (b.id & 1)) % 2) ? 0x6e4b2e : 0x7f5a37); else if (b && b.type !== 'park') c = _c2.set(w.age <= 1 ? 0x8e7350 : w.age <= 3 ? 0xa39478 : 0xa8a298); }
  else if (road) c = _c2.set([0x9c7a55, 0x9c7a55, 0xa48462, 0x9a9080, 0x8a857c, 0x6e6a64, 0x45484c][w.age]);
  if (snow > 0 && !isWater(t) && t !== TT.JUNGLE && occ < 0) c.lerp(_c.set(0xeef2f6), snow * (road ? .4 : .85) * (.75 + hv * .25));
  out.r = c.r * j; out.g = c.g * j; out.b = c.b * j;
}
function buildTerrain(w) {
  const tri = N * N * 2, pos = new Float32Array(tri * 9), col = new Float32Array(tri * 9);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, R.mat.terrain); m.receiveShadow = true; m.castShadow = true; R.scene.add(m);
  // skirt around the edges so the world looks like a diorama
  R.terrain = m; R.tpos = pos; R.tcol = col;
  const skirtG = new THREE.BoxGeometry(N + 400, 2, N + 400); skirtG.translate(N / 2, -6, N / 2);
  R.base = new THREE.Mesh(skirtG, new THREE.MeshStandardMaterial({ color: 0x4a6a3a, roughness: 1 })); R.scene.add(R.base);
  // water
  const hTex = new THREE.DataTexture(new Uint8Array(V * V * 4), V, V, THREE.RGBAFormat); hTex.magFilter = hTex.minFilter = THREE.LinearFilter; hTex.needsUpdate = true;
  R.hTex = hTex;
  const wm = waterMaterial(); wm.uniforms.uH.value = hTex; wm.uniforms.uN.value = N;
  const wg = new THREE.PlaneGeometry(N + 300, N + 300, 1, 1); wg.rotateX(-Math.PI / 2); wg.translate(N / 2, 0, N / 2);
  R.water = new THREE.Mesh(wg, wm); R.water.renderOrder = 1; R.scene.add(R.water);
  updateTerrainPos(w); updateTerrainCol(w);
}
function updateTerrainPos(w) {
  const pos = R.tpos, H = w.H; let o = 0;
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const a = z * V + x, b = a + 1, c = a + V, d = c + 1;
    const flip = (x + z) & 1;
    const quads = flip ? [[x, z, a], [x, z + 1, c], [x + 1, z, b], [x + 1, z, b], [x, z + 1, c], [x + 1, z + 1, d]] : [[x, z, a], [x, z + 1, c], [x + 1, z + 1, d], [x, z, a], [x + 1, z + 1, d], [x + 1, z, b]];
    for (const [vx, vz, vi] of quads) { pos[o++] = vx; pos[o++] = H[vi]; pos[o++] = vz; }
  }
  R.terrain.geometry.attributes.position.needsUpdate = true; R.terrain.geometry.computeVertexNormals(); R.terrain.geometry.computeBoundingSphere();
  const data = R.hTex.image.data; for (let i = 0; i < V * V; i++) { const v = clamp(Math.round((H[i] + 8) / 32 * 255), 0, 255); data[i * 4] = v; data[i * 4 + 3] = 255; } R.hTex.needsUpdate = true;
}
function updateTerrainCol(w) {
  const col = R.tcol, season = seasonOf(w), snow = w.weather.snow; const out = {}; let o = 0;
  const burn = R.burnMap;
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const i = z * N + x; tileColour(w, i, x, z, season, snow, out);
    if (burn && burn[i]) { const k = Math.min(1, burn[i]); out.r = lerp(out.r, .06, k * .8); out.g = lerp(out.g, .05, k * .8); out.b = lerp(out.b, .045, k * .8); }
    for (let t = 0; t < 2; t++) { const k = t ? 1 : .96; for (let v = 0; v < 3; v++) { col[o++] = out.r * k; col[o++] = out.g * k; col[o++] = out.b * k; } }
  }
  R.terrain.geometry.attributes.color.needsUpdate = true;
}

// -------------------------------------------------------------- vegetation & props
function syncTrees(w, force) {
  let sum = w.trees.length; for (const t of w.trees) sum += (t.fell ? 7 : 0) + (t.burnt ? 13 : 0) + t.grow * 3 + (t.burning ? 1 : 0) + (t.kind === 'berry' ? (t.food > 0 ? 1 : 0) : 0);
  const season = seasonOf(w), key = sum + season * 1e7 + (w.weather.snow > .5 ? 1e8 : 0);
  if (!force && key === R.treeKey) return; R.treeKey = key;
  const cnt = {}; for (const k of TREE_KINDS) cnt[k] = 0;
  let nb = 0;
  for (const t of w.trees) {
    if (t.dead) continue;
    const T = R.trees[t.kind], i = cnt[t.kind]++;
    const s = t.size * (.25 + .75 * t.grow) * (t.kind === 'jungle' ? 1.25 : 1);
    const y = hAt(w, t.x, t.z) - .05;
    if (t.fell) { const a = t.fellDir || 0; _q.setFromAxisAngle(_v.set(Math.sin(a), 0, -Math.cos(a)), 1.5); }
    else _q.setFromAxisAngle(_v.set(0, 1, 0), t.rot);
    _m.compose(_v.set(t.x, y, t.z), _q, _s.set(s, s, s));
    T.trunk.setMatrixAt(i, _m); T.trunk.setColorAt(i, t.burnt ? _c.set(0x222018) : _c.set(0xffffff));
    const palette = LEAF[t.kind][season === 3 && w.weather.snow > .3 ? 3 : season];
    if (t.burnt) { _m.makeScale(0, 0, 0); T.leaf.setMatrixAt(i, _m); }
    else {
      if (season === 3 && t.kind === 'broad') _m.compose(_v.set(t.x, y, t.z), _q, _s.set(s * .55, s * .55, s * .55));
      T.leaf.setMatrixAt(i, _m); _c.set(palette[(t.id * 7) % palette.length]); if (t.burning) _c.lerp(_c2.set(0x6a3010), .6); T.leaf.setColorAt(i, _c);
    }
    if (t.kind === 'berry' && t.food > 0 && !t.burnt && !t.fell && nb < 2990) for (let k = 0; k < 5; k++) { const a = k * 1.3 + t.rot; _m.makeTranslation(t.x + Math.cos(a) * .3 * s, y + (.35 + (k % 2) * .12) * s, t.z + Math.sin(a) * .3 * s); R.berries.setMatrixAt(nb, _m); R.berries.setColorAt(nb++, _c.set(k % 2 ? 0xd03040 : 0x8a2aa0)); }
  }
  for (const k of TREE_KINDS) { const T = R.trees[k]; T.trunk.count = T.leaf.count = cnt[k]; T.trunk.instanceMatrix.needsUpdate = T.leaf.instanceMatrix.needsUpdate = true; T.trunk.instanceColor.needsUpdate = T.leaf.instanceColor.needsUpdate = true; }
  R.berries.count = nb; R.berries.instanceMatrix.needsUpdate = true; R.berries.instanceColor.needsUpdate = true;
}
function syncRocks(w) {
  if (R.rockN === w.rocks.length && !R.rockDirty) return; R.rockN = w.rocks.length; R.rockDirty = false;
  let n = 0;
  for (const r of w.rocks) { if (r.dead || n >= 1500) continue; const s = r.size * (.5 + Math.min(1, r.stone / 14) * .5); _q.setFromAxisAngle(_v.set(0, 1, 0), r.rot); _m.compose(_v.set(r.x, hAt(w, r.x, r.z) + .1, r.z), _q, _s.set(s, s, s)); R.rocks.setMatrixAt(n, _m); R.rocks.setColorAt(n++, _c.set(r.ore ? 0x8a6a5a : 0x9a948a)); }
  R.rocks.count = n; R.rocks.instanceMatrix.needsUpdate = true; R.rocks.instanceColor.needsUpdate = true;
}
function syncGrass(w) {
  const season = seasonOf(w), snow = w.weather.snow > .4;
  let n = 0, nf = 0; _seedR = 17;
  const gc = [[0x7abf4a, 0x6aa848, 0x8ac858], [0x8ab844, 0x7aa840, 0x9ab84a], [0xb0a048, 0xa89040, 0xc0b050], [0xa8b0a0, 0x98a090, 0xb8c0b0]][snow ? 3 : season];
  const fc = [0xf2f2f2, 0xf0d040, 0xe070a0, 0xa070e0, 0xf08040];
  for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) {
    const i = z * N + x, t = w.tile[i]; if (w.occ[i] >= 0 || w.road[i]) { mrand(); continue; }
    const r = mrand(), reed = w.dWater[i] === 1 && !isWater(t) && t !== TT.ROCK;
    const dens = t === TT.GRASS ? .5 : t === TT.JUNGLE ? .45 : t === TT.FOREST ? .3 : reed ? .8 : 0;
    if (r > dens) continue;
    const k = reed ? 3 : 1 + (r * 7 | 0) % 2;
    for (let j = 0; j < k && n < 9000; j++) { const px = x + mrand(), pz = z + mrand(), s = reed ? 1.6 + mrand() : .7 + mrand() * .6; _q.setFromAxisAngle(_v.set(0, 1, 0), mrand() * 6); _m.compose(_v.set(px, hAt(w, px, pz), pz), _q, _s.set(s, s * (reed ? 1.6 : 1), s)); R.grass.setMatrixAt(n, _m); R.grass.setColorAt(n++, _c.set(reed ? 0x7a9a4a : gc[(x * 3 + z) % 3])); }
    if (t === TT.GRASS && season < 2 && !snow && mrand() < .08 && nf < 2500) { const px = x + mrand(), pz = z + mrand(); _m.makeTranslation(px, hAt(w, px, pz) + .25, pz); R.flowers.setMatrixAt(nf, _m); R.flowers.setColorAt(nf++, _c.set(fc[(x + z * 7) % fc.length])); }
  }
  R.grass.count = n; R.flowers.count = nf;
  for (const m of [R.grass, R.flowers]) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
}
function syncCrops(w) {
  let n = 0; const season = seasonOf(w);
  for (const b of w.buildings) {
    if (b.type !== 'field' || b.progress < 1 || b.ruin) continue;
    const grown = b.planted ? b.crop : b.stock > 0 ? .9 : 0; if (grown <= .02 && !(b.planted && season === 0)) continue;
    const ripe = clamp01((grown - .6) / .5), wheat = w.age >= 2;
    _c.set(0x5aa040).lerp(_c2.set(wheat ? 0xe0c050 : 0xa8b040), ripe);
    for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) {
      if (n >= 4000) break;
      const x = b.x - 2.6 + i * 1.04, z = b.z - 2.6 + j * 1.04, s = .25 + Math.min(1.1, grown) * .8;
      _q.setFromAxisAngle(_v.set(0, 1, 0), (i * 7 + j * 3) % 6);
      _m.compose(_v.set(x, hAt(w, x, z), z), _q, _s.set(s, s * (wheat ? 1.4 : 1), s)); R.crops.setMatrixAt(n, _m); R.crops.setColorAt(n++, _c);
    }
  }
  R.crops.count = n; R.crops.instanceMatrix.needsUpdate = true; R.crops.instanceColor.needsUpdate = true;
}
function syncGraves(w) {
  let n = 0;
  for (const g of w.graves) { if (n >= 60) break; _q.setFromAxisAngle(_v.set(0, 1, 0), 0); _m.compose(_v.set(g.x, hAt(w, g.x, g.z), g.z), _q, _s.set(1, g.age >= 4 ? 1.2 : .8, 1)); R.graves.setMatrixAt(n, _m); R.graves.setColorAt(n++, _c.set(g.age === 0 ? 0x8a847a : g.age <= 3 ? 0xb0aaa0 : 0xd8d4cc)); }
  R.graves.count = n; R.graves.instanceMatrix.needsUpdate = true; R.graves.instanceColor.needsUpdate = true;
}
function syncLamps(w) {
  let n = 0;
  if (w.age >= 4) for (let z = 0; z < N; z += 1) for (let x = 0; x < N; x += 1) {
    const i = z * N + x; if (!w.road[i] || (x + z) % 5 || n >= 300) continue;
    _m.makeTranslation(x + .5, hAt(w, x + .5, z + .5), z + .5); R.lamps.setMatrixAt(n, _m); _m.makeTranslation(x + .7, hAt(w, x + .5, z + .5) + 1.75, z + .5); R.lampGlow.setMatrixAt(n, _m); n++;
  }
  R.lamps.count = R.lampGlow.count = n; R.lamps.instanceMatrix.needsUpdate = R.lampGlow.instanceMatrix.needsUpdate = true;
  R.roadTiles = []; for (let i = 0; i < N * N; i++) if (w.road[i]) R.roadTiles.push(i);
}

// -------------------------------------------------------------- buildings
function syncBuildings(w) {
  const seen = new Set();
  for (const b of w.buildings) {
    seen.add(b.id);
    let e = R.bld.get(b.id);
    const key = b.type + ':' + b.style + ':' + (b.align < -.25 ? 'e' : b.align > .25 ? 'g' : 'n') + ':' + (b.big ? 1 : 0) + ':' + (b.ruin ? 'r' : '');
    if (!e || e.key !== key) {
      if (e) { R.scene.remove(e.group); }
      const group = new THREE.Group(); group.position.set(b.x, 0, b.z); group.rotation.y = b.type === 'dock' ? Math.PI / 2 - b.rot : ((b.id * 5) % 4) * Math.PI / 2 * (b.type === 'home' || b.type === 'store' ? 1 : 0);
      if (b.type === 'fire' || b.type === 'temple' || b.type === 'castle' || b.type === 'market') group.rotation.y = 0;
      e = { key, group, b };
      if (b.ruin) { const m = new THREE.Mesh(R.ruinG[b.size > 3 ? 7 : 3], R.mat.solid); m.castShadow = m.receiveShadow = true; group.add(m); }
      else {
        const mod = buildModel(b, w);
        if (!mod.g.empty()) { const body = new THREE.Mesh(mod.g.geo(), R.mat.solid); body.castShadow = body.receiveShadow = true; group.add(body); e.body = body; }
        if (!mod.lit.empty()) { const lit = new THREE.Mesh(mod.lit.geo(), R.mat.lit); group.add(lit); e.lit = lit; }
        if (mod.anim?.blades) { const bl = new THREE.Mesh(mod.anim.blades.geo, R.mat.solid); bl.position.set(mod.anim.blades.x, mod.anim.blades.y, mod.anim.blades.z); bl.castShadow = true; group.add(bl); e.blades = bl; }
        if (mod.anim?.rocket) { const rk = new THREE.Mesh(mod.anim.rocket.geo, R.mat.solid); rk.position.set(0, mod.anim.rocket.y, 0); rk.castShadow = true; group.add(rk); e.rocket = rk; }
        e.smoke = mod.anim?.smoke || null;
        const sc = new THREE.Mesh(R.scaffoldG[b.size > 3 ? 7 : 3], R.mat.solid); sc.castShadow = true; sc.visible = false; group.add(sc); e.scaffold = sc;
      }
      R.scene.add(group); R.bld.set(b.id, e);
      if (b.type === 'field' || b.type === 'dock') R.terrainColDirty = true;
    }
    // placement height & construction progress
    const baseY = b.type === 'dock' ? w.water - .15 : hAt(w, b.x, b.z);
    e.group.position.y = baseY;
    const building = !b.ruin && (b.progress < 1);
    const p = building ? Math.max(.05, b.progress) : 1;
    if (e.body) e.body.scale.set(1, p, 1); if (e.lit) { e.lit.scale.set(1, p, 1); e.lit.visible = p >= 1; }
    if (e.scaffold) e.scaffold.visible = building || b.upg;
    if (e.blades) e.blades.visible = p >= 1;
    e.b = b;
  }
  for (const [id, e] of R.bld) if (!seen.has(id)) { R.scene.remove(e.group); R.bld.delete(id); R.terrainColDirty = true; }
}

// -------------------------------------------------------------- people
const ACT_TOOL = { chop: 'axe', mine: 'pick', hoe: 'hoe', harvest: 'hoe', fish: 'rod', build: 'hammer', read: 'book', preach: 'staff', throw: 'spear', attack: 'spear' };
const JOB_TOOL = { hunter: 'spear', woodcutter: 'axe', stonecutter: 'pick', miner: 'pick', farmer: 'hoe', fisher: 'rod', builder: 'hammer', scholar: 'book', smith: 'hammer', guard: 'spear', priest: 'staff', raider: 'torch' };
function toolFor(w, p) {
  let t = ACT_TOOL[p.act] || (p.moving || p.act === 'idle' ? JOB_TOOL[p.job] : null);
  if (!t && p.act === 'walk' && JOB_TOOL[p.job]) t = JOB_TOOL[p.job];
  if (t === 'spear' && p.job === 'guard') t = w.age >= 5 ? 'rifle' : w.age >= 3 ? 'sword' : 'spear';
  if (t === 'spear' && p.faction === 'raider') t = w.age >= 3 ? 'sword' : 'club';
  if (t === 'spear' && w.age === 0 && p.act === 'attack' && p.job !== 'hunter') t = 'club';
  if (p.carry) t = null;
  if (!t && w.age >= 6 && p.act === 'idle' && p.id % 3 === 0) t = 'phone';
  return t;
}
function clothesFor(w, p) {
  const pal = CLOTH[w.age];
  if (p.faction === 'raider') return 0x3a1a1a;
  if (p.job === 'priest') return w.god.alignment < -.25 ? 0x2a1a24 : 0xf0e8d8;
  if (p.prophet) return 0xf2ead0;
  if (p.job === 'guard' && w.age >= 3) return w.age >= 5 ? 0x2a3a5a : 0x8a8a90;
  if (p.job === 'doctor') return 0xf4f4f4;
  return pal[Math.floor(p.shirt * pal.length)];
}
function setPart(mesh, i, base, ox, oy, oz, rx, rz, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, 0, rz); _q.setFromEuler(_e); _m2.compose(_v.set(ox, oy, oz), _q, _s.set(sx, sy, sz)); _m.multiplyMatrices(base, _m2); mesh.setMatrixAt(i, _m);
}
const _base = new THREE.Matrix4();
function drawPeople(w, dt, sel) {
  const P = R.pp; let n = 0, nl = 0, na = 0; const cnt = { hair: [0, 0, 0, 0], hat: [0, 0, 0, 0, 0, 0, 0] }; const tc = {}, bc = {}; let nsk = 0, nh = 0;
  const all = w.people.concat(w.raiders || []);
  const t = R.time;
  for (const p of all) {
    if (!p.alive || p.inside || n >= 420) continue;
    const age = ageOf(w, p), child = age < 14;
    const sc = (child ? .45 + age / 14 * .5 : 1) * p.height * (p.gifts.giant ? 1.6 : 1) * 1.12;
    const held = w.hand && w.hand.kind === 'p' && w.hand.id === p.id;
    // smooth heading and position
    if (p._rx === undefined) { p._rx = p.x; p._rz = p.z; p._ry = p.dir; p._ph = Math.random() * 6; }
    const k = Math.min(1, dt * 12); p._rx += (p.x - p._rx) * k; p._rz += (p.z - p._rz) * k;
    let dd = p.dir - p._ry; while (dd > Math.PI) dd -= TAU; while (dd < -Math.PI) dd += TAU; p._ry += dd * Math.min(1, dt * 10);
    let y = (p.fly || held) ? p.y : hAt(w, p._rx, p._rz);
    const act = held || p.fly ? 'flail' : p.act;
    const moving = act === 'walk' || act === 'carry';
    p._ph += dt * (moving ? (p.running ? 13 : 8) * Math.min(4, R.speed || 1) : 3);
    const ph = p._ph, sw = Math.sin(ph);
    let legL = 0, legR = 0, armL = 0, armR = 0, lift = 0, pitch = 0, spin = 0, bob = 0, armSpread = .08, legSpread = 0;
    switch (act) {
      case 'walk': legL = sw * (p.running ? .9 : .55); legR = -legL; armL = -legL * .8; armR = legL * .8; bob = Math.abs(Math.cos(ph)) * .04; break;
      case 'carry': legL = sw * .5; legR = -legL; armL = armR = -1.2; bob = Math.abs(Math.cos(ph)) * .03; break;
      case 'chop': case 'mine': case 'build': case 'attack': { const s = Math.abs(Math.sin(t * (act === 'attack' ? 9 : 6) + p.id)); armR = -2.6 + s * 2.2; armL = act === 'build' ? -.8 : -.3; pitch = s * .15; break; }
      case 'gather': case 'harvest': case 'hoe': pitch = .55 + Math.sin(t * 4 + p.id) * .1; armL = armR = -1.1 + Math.sin(t * 4 + p.id) * .3; lift = -.05; break;
      case 'pray': lift = -.22; legL = legR = 1.45; armL = armR = -2.7 + Math.sin(t * 2 + p.id) * .15; armSpread = .35; pitch = -.1; break;
      case 'kneel': lift = -.22; legL = legR = 1.45; armL = armR = -.4; pitch = .25; break;
      case 'sit': lift = -.26; legL = legR = -1.45; armL = armR = -.5; break;
      case 'sleep': case 'fallen': pitch = -1.52; lift = -.3; armL = armR = -.2; break;
      case 'dance': bob = Math.abs(Math.sin(t * 7 + p.id)) * .18; armL = -2.8 + Math.sin(t * 7) * .4; armR = -2.8 - Math.sin(t * 7) * .4; legL = Math.sin(t * 7) * .4; legR = -legL; spin = t * 2 + p.id; armSpread = .5; break;
      case 'cheer': bob = Math.abs(Math.sin(t * 8 + p.id)) * .15; armL = armR = -2.9; armSpread = .4; break;
      case 'cower': lift = -.18; pitch = .45; armL = armR = -2.6; legL = legR = -.6; break;
      case 'flail': armL = -2 + Math.sin(t * 18) * 1; armR = -2 - Math.sin(t * 18) * 1; legL = Math.sin(t * 15) * .8; legR = -legL; armSpread = .6; if (p.fly) pitch = (p.fly.spin || 0); break;
      case 'throw': armR = -2.6 + (1 - Math.max(0, p.actT) / .6) * 3; armL = -.4; break;
      case 'preach': armR = -2.9 + Math.sin(t * 3) * .2; armL = -.6; bob = Math.abs(Math.sin(t * 3)) * .03; break;
      case 'talk': armR = -.8 + Math.sin(t * 5 + p.id) * .4; armL = -.3; break;
      case 'fish': armL = armR = -1.0; break;
      case 'read': armL = armR = -1.2; pitch = .15; break;
      default: armL = armR = Math.sin(t * 1.5 + p.id) * .04;
    }
    if (p.carry && moving) { armL = armR = -1.25; }
    _base.makeRotationY(Math.PI / 2 - p._ry + spin);
    _m2.makeRotationX(pitch);
    _base.setPosition(p._rx, y + (.44 + lift) * sc + bob * sc, p._rz);
    _base.multiply(_m2); _m2.makeScale(sc, sc, sc); _base.multiply(_m2);
    // colours
    const skin = SKIN[Math.floor(p.skin * 7.99)], hair = HAIR[Math.floor(p.hair * 7.99)];
    const cloth = _c.set(clothesFor(w, p)); if (p.sick) cloth.lerp(_c2.set(0x6ab040), .35);
    const pants = PANTS[w.age];
    // legs
    setPart(P.legs, nl, _base, -.075 - legSpread, 0, 0, legL, 0); P.legs.setColorAt(nl++, _c2.set(pants));
    setPart(P.legs, nl, _base, .075 + legSpread, 0, 0, legR, 0); P.legs.setColorAt(nl++, _c2.set(pants));
    // torso
    setPart(P.torso, n, _base, 0, -.02, 0, 0, 0, p.sex === 'f' ? .92 : 1.05, 1, 1); P.torso.setColorAt(n, cloth);
    if (p.sex === 'f' && w.age >= 1 && w.age <= 5 && !child) { setPart(P.skirt, nsk, _base, 0, .02, 0, 0, 0); P.skirt.setColorAt(nsk++, cloth); }
    // arms
    setPart(P.arms, na, _base, -.21 - armSpread * .1, .36, 0, armL, -armSpread); P.arms.setColorAt(na++, w.age >= 1 ? cloth : skin);
    setPart(P.arms, na, _base, .21 + armSpread * .1, .36, 0, armR, armSpread); P.arms.setColorAt(na++, w.age >= 1 ? cloth : skin);
    // head, hair, hat
    const hy = .52 + (act === 'read' || act === 'kneel' ? -.02 : 0);
    setPart(P.head, n, _base, 0, hy, 0, 0, 0); P.head.setColorAt(n, skin);
    const hs = p.sex === 'f' ? (p.hairStyle % 2 ? 1 : 2) : (p.hairStyle % 2 ? 0 : 3);
    const hatStyle = !child && ((w.age === 3 && p.job === 'guard') || (w.age === 4 && p.id % 3 === 0) || (w.age === 5 && p.sex === 'm' && p.id % 2 === 0) || (w.age === 6 && p.id % 5 === 0)) ? w.age : 0;
    if (!hatStyle || hs === 1) { const hm = P.hair[hs], j = cnt.hair[hs]++; setPart(hm, j, _base, 0, hy, 0, 0, 0); hm.setColorAt(j, age > 55 ? _c2.set(0xd8d4cc) : hair); }
    if (hatStyle && P.hat[hatStyle]) { const hm = P.hat[hatStyle], j = cnt.hat[hatStyle]++; setPart(hm, j, _base, 0, hy + .04, 0, 0, 0); hm.setColorAt(j, _c2.set(hatStyle === 3 ? 0x9a9aa0 : hatStyle === 5 ? 0x1a1a1a : hatStyle === 6 ? 0x2e6ad0 : 0x6a3a2a)); }
    // tool in right hand
    const tool = child ? null : toolFor(w, p);
    if (tool) { const tm = P.tools[tool], j = tc[tool] = (tc[tool] || 0); tc[tool]++; _m2.makeRotationX(armR); _m2.setPosition(.23, .36, 0); _m.multiplyMatrices(_base, _m2); _m2.makeRotationX(act === 'fish' ? .9 : Math.PI / 2 * (tool === 'book' || tool === 'phone' ? 0 : 1)); _m2.setPosition(0, -.38, .03); _m.multiply(_m2); tm.setMatrixAt(j, _m); }
    // carried bundle
    if (p.carry && P.bundle[p.carry.type]) { const bm = P.bundle[p.carry.type], j = bc[p.carry.type] = (bc[p.carry.type] || 0); bc[p.carry.type]++; setPart(bm, j, _base, 0, p.carry.type === 'wood' ? .5 : .12, p.carry.type === 'wood' ? -.18 : .24, 0, 0); }
    // halo for the blessed
    if (p.gifts.immortal || p.prophet) { setPart(P.halo, nh, _base, 0, hy + .24, 0, 0, 0); P.halo.setColorAt(nh++, _c2.set(p.gifts.immortal ? 0xffd860 : 0xc8b0ff)); }
    p._sx = p._rx; p._sy = y + 1.3 * sc; p._sz = p._rz;
    n++;
  }
  const fin = (m, c) => { m.count = c; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; };
  fin(P.legs, nl); fin(P.arms, na); fin(P.torso, n); fin(P.head, n); fin(P.skirt, nsk); fin(P.halo, nh);
  P.hair.forEach((m, i) => fin(m, cnt.hair[i])); P.hat.forEach((m, i) => m && fin(m, cnt.hat[i]));
  for (const k of Object.keys(P.tools)) fin(P.tools[k], tc[k] || 0);
  for (const k of Object.keys(P.bundle)) fin(P.bundle[k], bc[k] || 0);
}
function drawAnimals(w, dt) {
  const cnt = {}; let nl = 0;
  for (const a of w.animals) {
    const M = R.an[a.kind]; if (!M) continue;
    const i = cnt[a.kind] = (cnt[a.kind] || 0); cnt[a.kind]++;
    if (a._rx === undefined) { a._rx = a.x; a._rz = a.z; a._ry = a.dir; }
    const k = Math.min(1, dt * 10); a._rx += (a.x - a._rx) * k; a._rz += (a.z - a._rz) * k;
    let dd = a.dir - a._ry; while (dd > Math.PI) dd -= TAU; while (dd < -Math.PI) dd += TAU; a._ry += dd * Math.min(1, dt * 6);
    const held = w.hand && w.hand.kind === 'a' && w.hand.id === a.id;
    const y = (a.fly || held) ? a.y : hAt(w, a._rx, a._rz);
    const grow = Math.min(1, .5 + (w.t - a.born) / YEAR * .25), s = grow * (a.kind === 'mammoth' ? 1 : 1);
    _base.makeRotationY(Math.PI / 2 - a._ry);
    if (!a.alive) { _m2.makeRotationZ(Math.PI / 2); _base.multiply(_m2); }
    else if (a.fly || held) { _m2.makeRotationZ(R.time * 6); _base.multiply(_m2); }
    _base.setPosition(a._rx, y + (!a.alive ? .2 : 0), a._rz); _m2.makeScale(s, s, s); _base.multiply(_m2);
    M.setMatrixAt(i, _base); M.setColorAt(i, _c.set(a.kind === 'wolf' && a.st === 'hunt' ? 0xd8c8c8 : 0xffffff));
    const L = LEGS[a.kind]; if (!L) continue;
    const gait = (a.spd || 0) * 3.2; a._ph = (a._ph || 0) + dt * gait * Math.min(4, R.speed || 1);
    const swing = a.alive ? Math.sin(a._ph) * Math.min(.7, (a.spd || 0) * .25) : 0;
    const legCol = a.kind === 'sheep' ? 0x2a2420 : a.kind === 'mammoth' ? 0x4a2c1a : a.kind === 'cow' ? 0xe8e4dc : a.kind === 'deer' ? 0x8a5a30 : a.kind === 'wolf' ? 0x6a6a70 : a.kind === 'dog' ? 0xa87a40 : 0x3a2e26;
    let q = 0;
    for (const [lx, lz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      if (nl >= 1400) break;
      const sgn = (q++ % 3 === 0) ? 1 : -1;
      setPart(R.anLegs, nl, _base, lx * L[2], L[1], lz * L[3], swing * sgn, 0, L[0], L[1], L[0]); R.anLegs.setColorAt(nl++, _c.set(legCol));
    }
  }
  for (const k of Object.keys(R.an)) { const m = R.an[k]; m.count = cnt[k] || 0; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  R.anLegs.count = nl; R.anLegs.instanceMatrix.needsUpdate = true; R.anLegs.instanceColor.needsUpdate = true;
}
function drawBirds(w, dt) {
  let i = 0;
  for (const b of R.birds) {
    const f = b.f; f.a += dt * f.sp * .1; const cx = w.center.x + Math.cos(f.a * 1.3) * f.r + (f.x - 60) * .3, cz = w.center.z + Math.sin(f.a) * f.r + (f.z - 60) * .3;
    const x = cx + b.ox, z = cz + b.oz, y = f.y + b.oy + Math.sin(R.time + b.ph) * .5, dir = f.a * 1.3 + Math.PI / 2;
    const flap = Math.sin(R.time * 9 + b.ph) * .7;
    _base.makeRotationY(-dir); _base.setPosition(x, y, z);
    _m2.makeRotationZ(flap); _m.multiplyMatrices(_base, _m2); R.birdR.setMatrixAt(i, _m);
    _m2.makeRotationZ(Math.PI - flap); _m.multiplyMatrices(_base, _m2); R.birdL.setMatrixAt(i, _m); i++;
  }
  R.birdL.count = R.birdR.count = i; R.birdL.instanceMatrix.needsUpdate = R.birdR.instanceMatrix.needsUpdate = true;
}
function drawVehicles(w, dt) {
  // boats near docks
  let nb = 0;
  for (const b of w.buildings) if (b.type === 'dock' && b.progress >= 1 && !b.ruin && nb < 12) {
    for (let k = 0; k < (w.age >= 5 ? 2 : 1); k++) {
      const a = R.time * .05 + k * 3 + b.id, cx = b.x + Math.cos(b.rot) * 9, cz = b.z + Math.sin(b.rot) * 9;
      const x = cx + Math.cos(a) * 5, z = cz + Math.sin(a) * 5; if (!deep(w, x, z)) continue;
      _q.setFromAxisAngle(_v.set(0, 1, 0), -a); _m.compose(_v.set(x, w.water + Math.sin(R.time * 2 + k) * .05, z), _q, _s.set(1.2, 1.2, 1.2)); R.boats.setMatrixAt(nb, _m); R.boats.setColorAt(nb++, _c.set(0xffffff));
    }
  }
  R.boats.count = nb; R.boats.instanceMatrix.needsUpdate = true; R.boats.instanceColor.needsUpdate = true;
  // cars in the modern age drive along roads
  const want = w.age >= 6 ? Math.min(40, (R.roadTiles || []).length / 8 | 0) : w.age >= 5 ? 4 : 0;
  while (R.carList.length < want && R.roadTiles && R.roadTiles.length) { const i = R.roadTiles[Math.random() * R.roadTiles.length | 0]; R.carList.push({ x: i % N + .5, z: (i / N | 0) + .5, tx: i % N + .5, tz: (i / N | 0) + .5, col: [0xd83a2e, 0x2e6ad0, 0xf2f2f2, 0x222222, 0xf0c030, 0x3ab87a][R.carList.length % 6], d: 0 }); }
  if (R.carList.length > want) R.carList.length = want;
  let n = 0;
  for (const c of R.carList) {
    if (Math.hypot(c.tx - c.x, c.tz - c.z) < .05) {
      const opts = []; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const i = tIdx(c.x + dx, c.z + dz); if (i >= 0 && w.road[i]) opts.push([dx, dz]); }
      const fwd = opts.filter(([dx, dz]) => !(dx === -c.dx && dz === -c.dz)); const o = (fwd.length ? fwd : opts)[Math.random() * (fwd.length || opts.length) | 0];
      if (o) { c.tx = c.x + o[0]; c.tz = c.z + o[1]; c.dx = o[0]; c.dz = o[1]; c.d = Math.atan2(o[1], o[0]); }
    }
    const sp = Math.min(dt * 2.5 * Math.min(R.speed || 1, 4), Math.hypot(c.tx - c.x, c.tz - c.z)), a = Math.atan2(c.tz - c.z, c.tx - c.x);
    c.x += Math.cos(a) * sp; c.z += Math.sin(a) * sp;
    const ox = -Math.sin(c.d) * .22, oz = Math.cos(c.d) * .22;
    _q.setFromAxisAngle(_v.set(0, 1, 0), Math.PI / 2 - c.d); _m.compose(_v.set(c.x + ox, hAt(w, c.x, c.z), c.z + oz), _q, _s.set(.8, .8, .8)); R.cars.setMatrixAt(n, _m); R.cars.setColorAt(n++, _c.set(c.col));
  }
  R.cars.count = n; R.cars.instanceMatrix.needsUpdate = true; R.cars.instanceColor.needsUpdate = true;
}

// -------------------------------------------------------------- effects
function bolt(x, y, z, big) {
  const pts = []; let cx = x + (Math.random() - .5) * 8, cz = z + (Math.random() - .5) * 8; const top = y + 45;
  for (let k = 0; k <= 14; k++) { const t = k / 14; pts.push(new THREE.Vector3(lerp(cx, x, t) + (k && k < 14 ? (Math.random() - .5) * 2.5 : 0), lerp(top, y, t), lerp(cz, z, t) + (k && k < 14 ? (Math.random() - .5) * 2.5 : 0))); }
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xeaf2ff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, fog: false }));
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), 28, big ? .22 : .14, 4), new THREE.MeshBasicMaterial({ color: 0xb8d0ff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  R.scene.add(l, tube); R.bolts.push({ l, tube, life: .45 });
  R.flash = Math.max(R.flash, big ? 1 : .7); R.flashLight.position.set(x, y + 6, z); R.flashLight.intensity = 400;
  for (let k = 0; k < 30; k++) R.pAdd.add(x, y + .2, z, (Math.random() - .5) * 6, Math.random() * 5, (Math.random() - .5) * 6, .5 + Math.random() * .4, .5, .1, 0xcfe0ff, 1, 9);
}
function beam(x, y, z, col, h = 40, r = 1.2, life = 1.6) {
  const g = new THREE.CylinderGeometry(r * .7, r, h, 16, 1, true); g.translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, R.mat.beam.clone()); m.material.color.set(col); m.position.set(x, y, z); R.scene.add(m); R.beams.push({ m, life, max: life });
}
function ring(x, y, z, col, r0, r1, life = 1.2) {
  const m = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y + .2, z); R.scene.add(m); R.rings.push({ m, r0, r1, life, max: life });
}
function burst(sys, x, y, z, n, col, spd, life, s0, s1, grav = 0, up = 0, drag = 0, a = 1) { for (let k = 0; k < n; k++) { const th = Math.random() * TAU, ph = Math.random() * Math.PI, v = spd * (.4 + Math.random() * .6); sys.add(x, y, z, Math.cos(th) * Math.sin(ph) * v, Math.abs(Math.cos(ph)) * v * .6 + up, Math.sin(th) * Math.sin(ph) * v, life * (.6 + Math.random() * .6), s0, s1, col, a, grav, drag); } }
function renderEvent(w, e) {
  if (!R.ready) return;
  const y = e.x != null ? hAt(w, e.x, e.z) : 0;
  switch (e.type) {
    case 'lightning': bolt(e.x, y, e.z, true); R.shake = Math.max(R.shake, .3); break;
    case 'impact': R.shake = 2.2; R.flash = 1.5; ring(e.x, y, e.z, 0xffc070, 1, 26, 1.6); ring(e.x, y, e.z, 0xffffff, 1, 14, .8);
      burst(R.pAdd, e.x, y + 1, e.z, 160, 0xffa040, 18, 1.4, 1.2, .2, 9, 6, .6); burst(R.pNorm, e.x, y + 1, e.z, 140, 0x6a5a4a, 10, 5, 2, 6, -.4, 3, .6, .7); R.terrainPosDirty = true; break;
    case 'heal': beam(e.x, y, e.z, 0xfff0a0, 30, 3, 2); burst(R.pAdd, e.x, y + .5, e.z, 70, 0xffe080, 3, 2.2, .35, .05, -1.5, 1.5, .5); break;
    case 'bless': case 'resurrect': beam(e.x, y, e.z, e.type === 'resurrect' ? 0xffffff : 0xffe07a, 60, .9, 2.4); burst(R.pAdd, e.x, y + .5, e.z, 90, 0xffe7a0, 2.5, 2.4, .35, .05, -1, 1, .5); ring(e.x, y, e.z, 0xffe07a, .3, 5, 1.2); break;
    case 'harvest': burst(R.pAdd, e.x, y + 8, e.z, 160, 0xf2c850, 8, 2.6, .35, .1, 3, 0, .9); ring(e.x, y, e.z, 0xa8e070, 1, 16, 1.5); break;
    case 'rain': break;
    case 'plague': burst(R.pNorm, e.x, y + 1, e.z, 90, 0x7ab040, 4, 4, 1.2, 3, -.2, .6, .8, .5); break;
    case 'fertility': burst(R.pAdd, e.x, y + 1, e.z, 80, 0xff90c0, 5, 2.4, .4, .1, -.8, 1.5, .8); break;
    case 'inspire': burst(R.pAdd, e.x, y + 2.2, e.z, 60, 0xfff6c0, 4, 1.6, .5, .05, 0, 0, 1.2); beam(e.x, y, e.z, 0xfff6c0, 25, .4, 1.4); break;
    case 'vision': burst(R.pAdd, e.x, y + 1.2, e.z, 90, 0xc8a8ff, 3, 2.4, .4, .05, -.5, 1, .6); beam(e.x, y, e.z, 0xc8a8ff, 40, .6, 2); break;
    case 'spawn': burst(R.pAdd, e.x, y + .6, e.z, 60, 0xa0ffe0, 4, 1.4, .4, .05, 0, 1, 1); break;
    case 'forest': burst(R.pAdd, e.x, y + .6, e.z, 80, 0x90ff90, 5, 1.8, .4, .05, -.5, 1, .8); break;
    case 'fireball': burst(R.pAdd, e.x, y + .5, e.z, 60, 0xff8030, 5, 1, .9, .2, -1, 2, 1); break;
    case 'wedding': burst(R.pAdd, e.x, y + 1.5, e.z, 50, 0xffb0d0, 3, 2, .25, .1, 1.2, 1.5, .8); break;
    case 'birth': burst(R.pAdd, e.x, y + 1, e.z, 24, 0xfff0d0, 1.5, 1.6, .25, .05, -.5, .5, .8); break;
    case 'death': if (!e.raider) for (let k = 0; k < 14; k++) R.pAdd.add(e.x + (Math.random() - .5) * .4, y + .8, e.z + (Math.random() - .5) * .4, 0, 1 + Math.random(), 0, 2.4, .35, .1, 0xd8e8ff, .8); break;
    case 'offering': burst(R.pAdd, e.x, y + 1.5, e.z, 50, 0xff6030, 3, 1.4, .8, .2, -2, 2, 1); break;
    case 'sign': R.rainbowT = 10; burst(R.pAdd, w.center.x, 25, w.center.z, 200, 0xfff0ff, 20, 4, .8, .2, 1, 0, .6); break;
    case 'collapse': burst(R.pNorm, e.x, y + 1, e.z, 70, 0x8a7a6a, 4, 3, 1.2, 3, -.3, 1, .8, .7); R.shake = Math.max(R.shake, .3); break;
    case 'treefall': R.treeKey = -1; break;
    case 'splash': burst(R.pNorm, e.x, w.water + .2, e.z, 30, 0xd8ecff, 4, .9, .3, .1, 8, 4, .5); break;
    case 'thud': burst(R.pNorm, e.x, y + .2, e.z, 16, 0x9a8a6a, 2, 1, .4, .8, 0, .5, 1, .6); break;
    case 'volcano': R.shake = 1.4; burst(R.pAdd, e.x, hAt(w, e.x, e.z) + 2, e.z, 200, 0xff6020, 14, 2.2, .9, .3, 8, 10, .3); break;
    case 'quake': R.quakeT = 7; break;
    case 'ageUp': burst(R.pAdd, w.center.x, hAt(w, w.center.x, w.center.z) + 4, w.center.z, 300, 0xffe7a0, 16, 3, .6, .1, -1, 3, .6); ring(w.center.x, hAt(w, w.center.x, w.center.z), w.center.z, 0xffe7a0, 1, 50, 2.5); break;
    case 'answered': burst(R.pAdd, e.x, y + 1.5, e.z, 40, 0xffe7a0, 2, 1.6, .35, .05, -1, 1, .8); break;
    case 'pickup': burst(R.pAdd, e.x, y + .5, e.z, 30, 0xffe7a0, 2, 1, .35, .05, 0, 2, .8); break;
    case 'arrive': burst(R.pAdd, e.x, y + 1, e.z, 20, 0xfff0d0, 2, 1.4, .3, .05, 0, .5, .8); break;
    case 'launch': R.launchT = 0; break;
    case 'spear': break;
  }
}
function updateEffects(w, dt) {
  R.pAdd.update(dt); R.pNorm.update(dt);
  for (const b of R.bolts) { b.life -= dt; b.l.material.opacity = b.tube.material.opacity = Math.max(0, b.life / .45) * (Math.random() < .3 ? .3 : 1); if (b.life <= 0) { R.scene.remove(b.l, b.tube); b.l.geometry.dispose(); b.tube.geometry.dispose(); } }
  R.bolts = R.bolts.filter(b => b.life > 0);
  for (const b of R.beams) { b.life -= dt; const t = b.life / b.max; b.m.material.opacity = Math.sin(t * Math.PI) * .5; b.m.scale.set(.6 + t * .4, 1, .6 + t * .4); if (b.life <= 0) { R.scene.remove(b.m); b.m.geometry.dispose(); } }
  R.beams = R.beams.filter(b => b.life > 0);
  for (const r of R.rings) { r.life -= dt; const t = 1 - r.life / r.max, s = lerp(r.r0, r.r1, 1 - Math.pow(1 - t, 3)); r.m.scale.set(s, s, s); r.m.material.opacity = (1 - t) * .9; if (r.life <= 0) { R.scene.remove(r.m); r.m.geometry.dispose(); } }
  R.rings = R.rings.filter(r => r.life > 0);
  R.flash = Math.max(0, R.flash - dt * 3); R.flashLight.intensity = Math.max(0, R.flashLight.intensity - dt * 1600);
  R.shake = Math.max(0, R.shake - dt * 2.4);
  if (w.quake) R.shake = Math.max(R.shake, .35);
  // rainbow
  if (R.rainbowT > 0) { R.rainbowT -= dt; R.rainbow.position.set(w.center.x, -8, w.center.z - 40); R.rainbow.material.opacity = Math.min(1, R.rainbowT / 2, (10 - R.rainbowT)) * .45; } else R.rainbow.material.opacity = 0;
  const S = R.speedScale || 1, cam = R.camera.position;
  // fire, smoke & special emitters
  for (const f of w.fires) { const y = f.kind === 'bld' ? hAt(w, f.x, f.z) + 1.2 : hAt(w, f.x, f.z) + (f.kind === 'tree' ? 1.2 : .3); if (Math.random() < dt * 30 * f.str) R.pAdd.add(f.x + (Math.random() - .5) * (f.kind === 'bld' ? 2 : .7), y + Math.random(), f.z + (Math.random() - .5) * (f.kind === 'bld' ? 2 : .7), (Math.random() - .5) * .5, 1.5 + Math.random() * 2, (Math.random() - .5) * .5, .7 + Math.random() * .4, f.kind === 'bld' ? 1.6 : 1.1, .2, Math.random() < .5 ? 0xff7020 : 0xffb030, 1); if (Math.random() < dt * 8) R.pNorm.add(f.x, y + 1.5, f.z, (Math.random() - .5) * .6 + R.uWind.value, 1.5 + Math.random(), (Math.random() - .5) * .6, 3, .8, 3, 0x3a3430, .45, -.1, .2); }
  const fireB = w.buildings.find(b => b.type === 'fire'); if (fireB && fireB.style <= 1 && !fireB.ruin) { const y = hAt(w, fireB.x, fireB.z); if (Math.random() < dt * 22) R.pAdd.add(fireB.x + (Math.random() - .5) * .4, y + .25, fireB.z + (Math.random() - .5) * .4, (Math.random() - .5) * .3, 1 + Math.random() * 1.2, (Math.random() - .5) * .3, .6 + Math.random() * .3, .8, .15, Math.random() < .5 ? 0xff7020 : 0xffc040, 1); if (Math.random() < dt * 4) R.pNorm.add(fireB.x, y + 1.3, fireB.z, R.uWind.value * .5, 1.2, 0, 3, .5, 2, 0x7a7068, .3, -.05, .1); }
  for (const [id, e] of R.bld) {
    const b = e.b; if (!b || b.ruin || b.progress < 1) continue;
    if (e.smoke) for (const [sx, sy, sz] of e.smoke) if (Math.random() < dt * 5) { _v.set(sx, sy, sz).applyMatrix4(e.group.matrixWorld); R.pNorm.add(_v.x, _v.y, _v.z, R.uWind.value * .8 + (Math.random() - .5) * .3, 1.2 + Math.random() * .5, (Math.random() - .5) * .3, 4, .8, 3.5, b.type === 'factory' ? 0x4a4642 : 0x8a8480, .5, -.05, .15); }
    if (e.blades) e.blades.rotation.z += dt * (.6 + R.uWind.value * 1.5);
    if (e.rocket && w.launched) { const t = (w.t - w.launched) / (R.speedHint || 1); if (t < 40) { e.rocket.position.y = .5 + Math.max(0, t - 1) ** 2 * .6; const p = _v.set(0, e.rocket.position.y, 0).applyMatrix4(e.group.matrixWorld); if (t > .5) for (let k = 0; k < 3; k++) { R.pAdd.add(p.x, p.y - .2, p.z, (Math.random() - .5) * 2, -6 - Math.random() * 4, (Math.random() - .5) * 2, .6, 1.2, .3, 0xffa040, 1); R.pNorm.add(p.x, p.y - 1, p.z, (Math.random() - .5) * 3, -1, (Math.random() - .5) * 3, 5, 1.5, 5, 0xe0e0e0, .5, 0, .3); } } else e.rocket.visible = false; }
    if (b.type === 'workshop' && R.night > .3 && Math.random() < dt * 2) { _v.set(-.8, 1, .7).applyMatrix4(e.group.matrixWorld); R.pAdd.add(_v.x, _v.y, _v.z, (Math.random() - .5), 2, (Math.random() - .5), .5, .2, .05, 0xffa040, 1, 4); }
  }
  // sick people cough green; the blessed shimmer
  for (const p of w.people) { if (!p.alive || p.inside) continue; if (p.sick && Math.random() < dt * 3) R.pNorm.add(p._sx || p.x, (p._sy || 1) - .3, p._sz || p.z, (Math.random() - .5) * .3, .4, (Math.random() - .5) * .3, 1.6, .3, 1, 0x8ac050, .4); if ((p.gifts.immortal || p.prophet || Object.keys(p.gifts).length) && Math.random() < dt * 4) R.pAdd.add((p._sx || p.x) + (Math.random() - .5) * .6, (p._sy || 1) - Math.random(), (p._sz || p.z) + (Math.random() - .5) * .6, 0, .5, 0, 1, .2, .02, p.prophet ? 0xc8a8ff : 0xffe7a0, 1); }
  // lava
  let nl = 0;
  for (const L of w.lava) for (const c of L.cells) { if (nl >= 1000) break; const age = (w.t - c.t) / (R.speedHint || 1); const k = clamp01(age / 40); _q.identity(); const s = 1 - k * .3; _m.compose(_v.set(c.x, hAt(w, c.x, c.z) + .05, c.z), _q, _s.set(s, 1, s)); R.lavaM.setMatrixAt(nl, _m); R.lavaM.setColorAt(nl++, _c.setRGB(lerp(1.6, .12, k), lerp(.5, .08, k), lerp(.1, .06, k))); if (k < .3 && Math.random() < dt * .3) R.pNorm.add(c.x, hAt(w, c.x, c.z) + .5, c.z, 0, 1, 0, 3, .6, 2.5, 0x3a3230, .4, -.05); }
  R.lavaM.count = nl; R.lavaM.instanceMatrix.needsUpdate = true; if (nl) R.lavaM.instanceColor.needsUpdate = true;
  if (w.lava.some(L => L.t > 0)) { const M = w.layout.M, y = hAt(w, M.x, M.z); for (let k = 0; k < 3; k++) R.pAdd.add(M.x + (Math.random() - .5) * 2, y + 1, M.z + (Math.random() - .5) * 2, (Math.random() - .5) * 6, 8 + Math.random() * 8, (Math.random() - .5) * 6, 1.8, 1, .3, 0xff5010, 1, 9); R.pNorm.add(M.x, y + 3, M.z, (Math.random() - .5) * 2 + 1, 4, (Math.random() - .5) * 2, 8, 3, 9, 0x2a2624, .6, -.1, .1); }
  // meteors
  for (const f of w.fx) if (f.type === 'meteor') {
    const T = (w.t - f.t) / (f.land - f.t); if (T > 1.05) continue;
    let m = R.meteors.get(f); if (!m) { m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), new THREE.MeshBasicMaterial({ color: 0xffd080 })); R.scene.add(m); R.meteors.set(f, m); }
    const y0 = hAt(w, f.x, f.z), t = clamp01(T), sx = f.x - 60 * (1 - t), sy = y0 + 90 * (1 - t), sz = f.z - 35 * (1 - t);
    m.position.set(sx, sy, sz); m.rotation.x += dt * 4;
    for (let k = 0; k < 6; k++) { R.pAdd.add(sx + (Math.random() - .5), sy + (Math.random() - .5), sz + (Math.random() - .5), (Math.random() - .5) * 2, (Math.random() - .5) * 2, (Math.random() - .5) * 2, .8, 2.2, .2, Math.random() < .5 ? 0xffa040 : 0xffe0a0, 1); R.pNorm.add(sx, sy, sz, 0, 0, 0, 3, 1.5, 4, 0x4a4040, .4); }
  }
  for (const [f, m] of R.meteors) if ((w.t - f.t) / (f.land - f.t) > 1.02 || !w.fx.includes(f)) { R.scene.remove(m); R.meteors.delete(f); }
  w.fx = w.fx.filter(f => f.type !== 'meteor' || w.t < f.land + 1);
  // tornadoes
  const tset = new Set();
  for (const tn of w.tornadoes) {
    tset.add(tn.id); let m = R.tornadoMeshes.get(tn.id);
    if (!m) { const g = new THREE.CylinderGeometry(4, .6, 22, 16, 8, true); g.translate(0, 11, 0); const pos = g.attributes.position; for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); const a = y * .25; const x = pos.getX(i), z = pos.getZ(i); pos.setX(i, x * Math.cos(a) - z * Math.sin(a) + Math.sin(y * .3) * .8); pos.setZ(i, x * Math.sin(a) + z * Math.cos(a)); } g.computeVertexNormals(); m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x8a8680, transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false, flatShading: true })); R.scene.add(m); R.tornadoMeshes.set(tn.id, m); }
    m.position.set(tn.x, hAt(w, tn.x, tn.z), tn.z); m.rotation.y += dt * 8;
    for (let k = 0; k < 6; k++) { const a = Math.random() * TAU, r = .5 + Math.random() * 3, h = Math.random() * 16; R.pNorm.add(tn.x + Math.cos(a) * r * (h / 16 + .3), m.position.y + h, tn.z + Math.sin(a) * r * (h / 16 + .3), -Math.sin(a) * 8, 2, Math.cos(a) * 8, .8, .4, .8, Math.random() < .3 ? 0x5a4a3a : 0xa8a49c, .7); }
  }
  for (const [id, m] of R.tornadoMeshes) if (!tset.has(id)) { R.scene.remove(m); R.tornadoMeshes.delete(id); }
  // locusts
  for (const s of w.locusts) for (let k = 0; k < 10; k++) R.pNorm.add(s.x + (Math.random() - .5) * 8, hAt(w, s.x, s.z) + 1 + Math.random() * 3, s.z + (Math.random() - .5) * 8, (Math.random() - .5) * 4, (Math.random() - .5) * 2, (Math.random() - .5) * 4, .5, .18, .18, 0x2a2a14, 1);
  // quake dust
  if (w.quake && Math.random() < dt * 20) { const q = w.quake, a = Math.random() * TAU, r = Math.random() * q.r, x = q.x + Math.cos(a) * r, z = q.z + Math.sin(a) * r; R.pNorm.add(x, hAt(w, x, z) + .2, z, 0, 1.2, 0, 2, .8, 2.5, 0x9a8a70, .5); }
  // rain and snow
  const W = w.weather, raining = W.rain > 0 || W.storm > 0, snowing = seasonOf(w) === 3 && !raining && W.snow > .2;
  const rp = R.rainPos; let ri = 0;
  const rc = raining ? { x: W.rr > 50 ? R.camTarget.x : W.rx, z: W.rr > 50 ? R.camTarget.z : W.rz, r: Math.min(W.rr, 40) } : null;
  for (const d of R.rainDrops) {
    if (rc || snowing) {
      if (d.y < -50 || d.y < hAt(w, d.x, d.z)) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * (rc ? rc.r : 45); d.x = (rc ? rc.x : R.camTarget.x) + Math.cos(a) * r; d.z = (rc ? rc.z : R.camTarget.z) + Math.sin(a) * r; d.y = hAt(w, d.x, d.z) + 8 + Math.random() * 22; }
      d.y -= dt * (rc ? 30 : 3); if (!rc) { d.x += Math.sin(R.time + d.z) * dt * .5; }
      const len = rc ? .8 : .08;
      rp[ri++] = d.x; rp[ri++] = d.y; rp[ri++] = d.z; rp[ri++] = d.x + (rc ? R.uWind.value * .2 : .05); rp[ri++] = d.y + len; rp[ri++] = d.z;
    } else { d.y = -99; }
  }
  R.rain.geometry.setDrawRange(0, ri / 3); R.rain.geometry.attributes.position.needsUpdate = true;
  R.rain.material.color.set(rc ? 0xa8c0d8 : 0xffffff); R.rain.material.opacity = rc ? .45 : .9;
  // local rain cloud
  const sc = R.stormCloud; if (raining && W.rr <= 50) { sc.position.set(W.rx, hAt(w, W.rx, W.rz) + 26, W.rz); sc.material.opacity = Math.min(.85, sc.material.opacity + dt); sc.scale.setScalar(W.rr / 16); } else sc.material.opacity = Math.max(0, sc.material.opacity - dt);
  sc.visible = sc.material.opacity > .01;
}

// -------------------------------------------------------------- lighting & sky
function updateSky(w, dt) {
  const hr = hourOf(w), W = w.weather;
  let dayT;
  if (R.lightMode === 'day') dayT = 15.5; else dayT = hr;
  const ang = (dayT - 6) / 14 * Math.PI;                  // 0 at dawn, PI at dusk
  const day = dayT > 5.5 && dayT < 20.5;
  const sunH = Math.sin(clamp(ang, 0, Math.PI)), dusk = day ? Math.pow(1 - sunH, 3) : 0;
  const night = day ? clamp01(1 - sunH * 6) * (dayT < 7 || dayT > 19 ? 1 : 0) : 1;
  R.night = lerp(R.night, night, Math.min(1, dt * 3));
  const nt = R.night;
  const sx = Math.cos(ang), sy = Math.max(.08, Math.sin(ang)), sz = -.35;
  const sunDir = day ? _v.set(sx, sy, sz).normalize() : _v.set(-.3, .8, .4).normalize();
  const ct = R.camTarget || { x: N / 2, z: N / 2 };
  R.sun.position.set(ct.x + sunDir.x * 120, sunDir.y * 120, ct.z + sunDir.z * 120); R.sun.target.position.set(ct.x, 0, ct.z);
  const storm = clamp01((W.storm > 0 ? 1 : 0) * .8 + (W.rain > 0 && W.rr > 50 ? .5 : 0) + W.dust * .6);
  const sunCol = _c.set(0xfff2dc).lerp(_c2.set(0xffa860), dusk * .8);
  R.sun.color.copy(sunCol).lerp(_c2.set(0x9ab0ff), nt);
  R.sun.intensity = lerp(2.6, .35, nt) * (1 - storm * .6) * (1 + R.flash * .6);
  R.hemi.intensity = lerp(1.0, .28, nt) * (1 - storm * .3) + R.flash * 2.5;
  R.hemi.color.set(0xcfe6ff).lerp(_c2.set(0x5a6aa0), nt);
  const top = _c.set(0x3f86d8).lerp(_c2.set(0x5a6a8a), storm).lerp(_c2.set(0x0a1028), nt).lerp(_c2.set(0x8a4a6a), dusk * .4 * (1 - nt));
  const hor = _c2.set(0xcde6f5).lerp(new THREE.Color(0x8a8e94), storm).lerp(new THREE.Color(0x1a2240), nt).lerp(new THREE.Color(0xffb070), dusk * .7 * (1 - nt));
  if (W.dust > .05) { top.lerp(new THREE.Color(0x6a5040), W.dust * .6); hor.lerp(new THREE.Color(0x8a6a50), W.dust * .6); }
  const sk = R.sky.material.uniforms; sk.uTop.value.copy(top); sk.uHor.value.copy(hor); sk.uSun.value.set(sx, Math.sin(ang), sz).normalize(); sk.uSunCol.value.copy(sunCol); sk.uNight.value = nt; sk.uTime.value = R.time;
  R.sky.position.copy(R.camera.position);
  R.scene.fog.color.copy(hor); R.scene.fog.near = 110 - storm * 40; R.scene.fog.far = 360 - storm * 120;
  R.moon.position.set(R.camera.position.x - sx * 300, 180, R.camera.position.z + 200); R.moon.visible = nt > .2;
  // water
  const wu = R.water.material.uniforms; wu.uTime.value = R.time; wu.uWater.value = w.water; wu.uSun.value.copy(R.sun.position).sub(R.sun.target.position).normalize(); wu.uSunCol.value.copy(R.sun.color).multiplyScalar(R.sun.intensity * .5); wu.uSky.value.copy(hor).lerp(top, .3); wu.uFog.value.copy(hor); wu.uFogNear.value = R.scene.fog.near; wu.uFogFar.value = R.scene.fog.far; wu.uAmb.value = lerp(1, .25, nt) * (1 - storm * .3);
  R.water.position.y = w.water;
  // windows glow at night
  const glow = nt;
  R.mat.lit.color.set(0x3a4654).lerp(_c2.set(0xffc870), glow);
  R.mat.glow.opacity = .15 + glow * .75;
  // wind
  R.uWind.value = lerp(R.uWind.value, .35 + storm * 1.6 + (w.tornadoes.length ? 1 : 0), dt);
  // clouds drift and darken
  const cloudy = W.clouds;
  R.cloudMat.color.set(0xffffff).lerp(_c2.set(0x5a6070), storm).lerp(_c2.set(0x2a3040), nt * .8); R.cloudMat.emissive.set(0x9aa8b8).multiplyScalar(1 - nt); R.cloudMat.opacity = .5 + cloudy * .45;
  R.clouds.forEach((c, i) => { c.position.x += dt * (1 + R.uWind.value * 2) * (.6 + (i % 3) * .2); if (c.position.x > N + 60) c.position.x = -60; c.visible = i < 4 + cloudy * 10; });
  // campfire & fire lights near the camera
  const lights = [];
  for (const [id, e] of R.bld) if (e.b && e.b.type === 'fire' && e.b.style <= 1) lights.push(e.b);
  for (const f of w.fires) lights.push(f);
  lights.sort((a, b) => Math.hypot(a.x - ct.x, a.z - ct.z) - Math.hypot(b.x - ct.x, b.z - ct.z));
  R.fireLights.forEach((l, i) => { const f = lights[i]; if (!f) { l.intensity = 0; return; } l.position.set(f.x, hAt(w, f.x, f.z) + 1.5, f.z); l.intensity = (f.type === 'fire' ? 30 + nt * 60 : 40) * (.85 + Math.random() * .3); });
}

// -------------------------------------------------------------- main frame
function renderFrame(w, dt, cam) {
  if (!R.terrain) buildTerrain(w);
  R.time += dt; R.uTime.value = R.time;
  R.camTarget = cam.target;
  // camera
  const shake = R.shake * .35;
  const cp = Math.cos(cam.pitch), px = cam.target.x + Math.cos(cam.yaw) * cp * cam.dist, pz = cam.target.z + Math.sin(cam.yaw) * cp * cam.dist, py = cam.target.y + Math.sin(cam.pitch) * cam.dist;
  R.camera.position.set(px + (Math.random() - .5) * shake, py + (Math.random() - .5) * shake, pz + (Math.random() - .5) * shake);
  R.camera.lookAt(cam.target.x, cam.target.y, cam.target.z);
  // shadow frustum follows the view
  const ext = clamp(cam.dist * .9, 30, 90), sc = R.sun.shadow.camera; if (sc.right !== ext) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix(); }
  // world sync
  if (w.terrainDirty || R.terrainPosDirty) { w.terrainDirty = false; R.terrainPosDirty = false; updateTerrainPos(w); R.terrainColDirty = true; R.grassDirty = true; R.rockDirty = true; }
  const season = seasonOf(w), snowK = Math.round(w.weather.snow * 4);
  if (R.lastSeason !== season || R.lastSnow !== snowK || w.roadDirty || R.lastAge !== w.age) { R.lastSeason = season; R.lastSnow = snowK; R.lastAge = w.age; R.terrainColDirty = true; R.grassDirty = true; }
  if (w.roadDirty) { w.roadDirty = false; syncLamps(w); R.grassDirty = true; }
  R.syncT = (R.syncT || 0) - dt;
  if (R.syncT <= 0) {
    R.syncT = .25;
    // scorch marks from burnt trees and lava
    if (!R.burnMap) R.burnMap = new Float32Array(N * N);
    let burnChanged = false;
    for (const t of w.trees) if (t.burnt) { const i = tIdx(t.x, t.z); if (i >= 0 && R.burnMap[i] < 1) { R.burnMap[i] = 1; burnChanged = true; } }
    for (const L of w.lava) for (const c of L.cells) { const i = tIdx(c.x, c.z); if (i >= 0 && R.burnMap[i] < 1) { R.burnMap[i] = 1; burnChanged = true; } }
    if (burnChanged) R.terrainColDirty = true;
    syncTrees(w); syncRocks(w); syncCrops(w); syncGraves(w);
    if (R.bldN !== w.buildings.length || w.bldDirty) { R.terrainColDirty = true; R.grassDirty = true; }
    w.bldDirty = false; R.bldN = w.buildings.length;
  }
  syncBuildings(w);
  if (R.terrainColDirty) { R.terrainColDirty = false; updateTerrainCol(w); }
  if (R.grassDirty) { R.grassDirty = false; syncGrass(w); }
  drawPeople(w, dt); drawAnimals(w, dt); drawBirds(w, dt); drawVehicles(w, dt);
  updateSky(w, dt);
  updateEffects(w, dt);
  R.renderer.render(R.scene, R.camera);
}
function resizeRender(wd, ht) { if (!R.ready) return; R.renderer.setSize(wd, ht, false); R.camera.aspect = wd / ht; R.camera.updateProjectionMatrix(); const pr = R.renderer.getPixelRatio(); R.pAdd.mat.uniforms.uScale.value = R.pNorm.mat.uniforms.uScale.value = ht * pr * .6; }
function project(x, y, z) { _v.set(x, y, z).project(R.camera); return { x: (_v.x + 1) / 2 * R.canvas.clientWidth, y: (1 - _v.y) / 2 * R.canvas.clientHeight, vis: _v.z < 1 && _v.z > -1 }; }
function pickGround(w, sx, sy) {
  const ndc = new THREE.Vector2(sx / R.canvas.clientWidth * 2 - 1, -(sy / R.canvas.clientHeight) * 2 + 1);
  const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, R.camera);
  const o = ray.ray.origin, d = ray.ray.direction;
  let prev = null;
  for (let t = 0; t < 700; t += .5) {
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    const inside = x >= 0 && z >= 0 && x <= N && z <= N;
    const gh = inside ? Math.max(hAt(w, x, z), w.water) : w.water;
    if (y <= gh) { if (!inside) return null; let lo = t - .5, hi = t; for (let k = 0; k < 8; k++) { const m = (lo + hi) / 2, yy = o.y + d.y * m, xx = o.x + d.x * m, zz = o.z + d.z * m; if (yy <= Math.max(hAt(w, xx, zz), w.water)) hi = m; else lo = m; } return { x: o.x + d.x * hi, y: o.y + d.y * hi, z: o.z + d.z * hi }; }
  }
  return null;
}
function setCursor(w, pt, radius, col, show) {
  R.cursor.visible = R.cursorDisc.visible = !!(show && pt);
  if (!pt || !show) return;
  const y = Math.max(hAt(w, pt.x, pt.z), w.water) + .25;
  R.cursor.position.set(pt.x, y, pt.z); R.cursor.scale.setScalar(radius); R.cursor.material.color.set(col); R.cursor.material.opacity = .6 + Math.sin(R.time * 5) * .2;
  R.cursorDisc.position.set(pt.x, y - .02, pt.z); R.cursorDisc.scale.setScalar(radius); R.cursorDisc.material.color.set(col);
}
function setSelection(w, sel) {
  if (!sel) { R.selRing.visible = false; return; }
  R.selRing.visible = true; const s = sel.r || 1;
  R.selRing.position.set(sel.x, hAt(w, sel.x, sel.z) + .08, sel.z); R.selRing.scale.setScalar(s * (1 + Math.sin(R.time * 4) * .06)); R.selRing.material.color.set(sel.col || 0xffe7a0);
}
/*RENDER-END*/

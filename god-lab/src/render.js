/*RENDER-START*/
// ===========================================================================
// God Lab renderer: painted terrain, creatures drawn from their genes,
// day and night, weather, tribes, and the effects of your powers.
// ===========================================================================
const PX = 5; // baked terrain pixels per tile
const BIOME_RGB = [
  [22, 58, 96], [44, 121, 158], [226, 211, 160], [128, 172, 82], [66, 122, 60], [38, 104, 58],
  [196, 178, 92], [224, 196, 130], [168, 178, 150], [238, 243, 247], [140, 131, 120], [56, 50, 52],
];
const R = {
  terrain: null, tctx: null, veg: null, vctx: null, vegImg: null,
  sprites: new Map(), particles: [], shake: 0, flash: 0, lastVeg: 0,
};

// ---------------------------------------------------------------- terrain
// Two passes: colour each tile (biome, hill shading, depth), then paint pixels by
// blending the four nearest tiles. Land blends only with land and water with water,
// so interiors are soft and coastlines stay crisp.
const TILE = { r: null, g: null, b: null, n: 0 };
function tileColours(w) {
  const N = w.W * w.H;
  if (TILE.n !== N) { TILE.r = new Float32Array(N); TILE.g = new Float32Array(N); TILE.b = new Float32Array(N); TILE.n = N; }
  const sea = w.climate.sea;
  for (let y = 0; y < w.H; y++) for (let x = 0; x < w.W; x++) {
    const i = y * w.W + x, b = w.biome[i], e = w.elev[i] - sea;
    let [r, g, bl] = BIOME_RGB[b];
    const n = vnoise2(w.seed + 5, x * .35, y * .35);
    if (b <= 1) {
      const depth = clamp(-e / .45, 0, 1);
      r = 72 - depth * 58 + n * 10; g = 152 - depth * 104 + n * 12; bl = 192 - depth * 92 + n * 12;
    } else {
      const ex = w.elev[Math.min(i + 1, N - 1)] - w.elev[Math.max(i - 1, 0)], ey = w.elev[Math.min(i + w.W, N - 1)] - w.elev[Math.max(i - w.W, 0)];
      const shade = clamp(1 - (ex + ey) * 2.4, .6, 1.3);
      const tex = .9 + n * .2;
      r *= shade * tex; g *= shade * tex; bl *= shade * tex;
      if (b === B.SNOW) { r = 232 + n * 18; g = 238 + n * 14; bl = 246 + n * 8; }
      if (e < .03) { r = r * .55 + 226 * .45; g = g * .55 + 211 * .45; bl = bl * .55 + 160 * .45; }
    }
    TILE.r[i] = r; TILE.g[i] = g; TILE.b[i] = bl;
  }
}
function bakeTerrain(w, rect) {
  const TW = w.W * PX, TH = w.H * PX;
  if (!R.terrain || R.terrain.width !== TW) {
    R.terrain = document.createElement('canvas'); R.terrain.width = TW; R.terrain.height = TH;
    R.tctx = R.terrain.getContext('2d'); rect = null;
  }
  tileColours(w);
  let x0 = 0, y0 = 0, x1 = w.W, y1 = w.H;
  if (rect) { x0 = Math.max(0, rect[0] | 0); y0 = Math.max(0, rect[1] | 0); x1 = Math.min(w.W, (rect[0] + rect[2] + 1) | 0); y1 = Math.min(w.H, (rect[1] + rect[3] + 1) | 0); }
  const pw = (x1 - x0) * PX, ph = (y1 - y0) * PX;
  if (pw <= 0 || ph <= 0) return;
  const img = R.tctx.createImageData(pw, ph), d = img.data;
  const sea = w.climate.sea, Wm = w.W - 1, Hm = w.H - 1, TR = TILE.r, TG = TILE.g, TB = TILE.b, EL = w.elev, BI = w.biome, FE = w.fert, SC = w.scar;
  const seed = w.seed;
  for (let py = 0; py < ph; py++) {
    const wy = y0 + (py + .5) / PX - .5;
    const yi = wy < 0 ? 0 : wy >= Hm ? Hm - 1 : wy | 0, fy = clamp(wy - yi, 0, 1);
    for (let px = 0; px < pw; px++) {
      const wx = x0 + (px + .5) / PX - .5;
      const xi = wx < 0 ? 0 : wx >= Wm ? Wm - 1 : wx | 0, fx = clamp(wx - xi, 0, 1);
      const i00 = yi * w.W + xi, i10 = i00 + 1, i01 = i00 + w.W, i11 = i01 + 1;
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      // wobble the coastline a little so it isn't a smooth contour
      const jit = (hash2(seed, xi * 7 + (px & 3), yi * 7 + (py & 3)) - .5) * .018;
      const e = EL[i00] * w00 + EL[i10] * w10 + EL[i01] * w01 + EL[i11] * w11 - sea + jit;
      const water = e < 0;
      let r = 0, g = 0, b = 0, ws = 0;
      const add = (i, wt) => { if ((BI[i] <= 1) !== water || wt <= 0) return; r += TR[i] * wt; g += TG[i] * wt; b += TB[i] * wt; ws += wt; };
      add(i00, w00); add(i10, w10); add(i01, w01); add(i11, w11);
      if (ws < 1e-4) { const ii = fx < .5 ? (fy < .5 ? i00 : i01) : (fy < .5 ? i10 : i11); r = TR[ii]; g = TG[ii]; b = TB[ii]; ws = 1; if (water && BI[ii] > 1) { r = 60; g = 140; b = 180; } else if (!water && BI[ii] <= 1) { r = 222; g = 206; b = 156; } }
      r /= ws; g /= ws; b /= ws;
      const n = hash2(seed, x0 * PX + px, y0 * PX + py);
      if (water) {
        if (e > -.025) { const k = (e + .025) / .025; r += 50 * k; g += 45 * k; b += 25 * k; } // surf
        const t = .985 + n * .03; r *= t; g *= t; b *= t;
      } else {
        const bi = BI[fx < .5 ? (fy < .5 ? i00 : i01) : (fy < .5 ? i10 : i11)];
        let t = .97 + n * .06;
        if (bi === B.FOREST || bi === B.JUNGLE) { const c = vnoise2(seed + 9, wx * 2.6, wy * 2.6); t *= c > .56 ? .8 : c < .3 ? 1.08 : 1; }
        else if (bi === B.GRASS || bi === B.SAVANNA) { const c = vnoise2(seed + 11, wx * 1.4, wy * 1.4); t *= .95 + c * .1; }
        else if (bi === B.MOUNTAIN || bi === B.ROCK) { const c = vnoise2(seed + 13, wx * 3, wy * 3); t *= .85 + c * .3; }
        if (e < .02) { const k = 1 - e / .02; r = r * (1 - k * .5) + 232 * k * .5; g = g * (1 - k * .5) + 214 * k * .5; b = b * (1 - k * .5) + 162 * k * .5; }
        const ti = (wy + .5 | 0) * w.W + (wx + .5 | 0);
        if (ti >= 0 && ti < w.W * w.H && FE[ti] > 1.5 && !SC[ti]) { const row = ((wy * 3) | 0) % 2; t *= row ? .9 : 1.06; }
        r *= t; g *= t; b *= t;
      }
      const o = (py * pw + px) * 4;
      d[o] = r > 255 ? 255 : r; d[o + 1] = g > 255 ? 255 : g; d[o + 2] = b > 255 ? 255 : b; d[o + 3] = 255;
    }
  }
  R.tctx.putImageData(img, x0 * PX, y0 * PX);
}
// grazed or burnt land turns pale and dusty; lush land stays green
function updateVeg(w) {
  if (!R.veg) { R.veg = document.createElement('canvas'); R.veg.width = w.W; R.veg.height = w.H; R.vctx = R.veg.getContext('2d'); R.vegImg = R.vctx.createImageData(w.W, w.H); }
  const d = R.vegImg.data;
  for (let i = 0; i < w.W * w.H; i++) {
    const o = i * 4, b = w.biome[i];
    if (b <= 1) { d[o + 3] = 0; continue; }
    const cap = w.cap[i];
    const lack = cap > .05 ? clamp(1 - w.food[i] / cap, 0, 1) : 0;
    if (w.lava[i]) { const hot = Math.min(1, w.lava[i] / 400); d[o] = 255; d[o + 1] = 70 + hot * 90; d[o + 2] = 20 + hot * 30; d[o + 3] = 220; continue; }
    if (w.scar[i]) { d[o] = 30; d[o + 1] = 26; d[o + 2] = 28; d[o + 3] = 120; continue; }
    if (w.fire[i]) { d[o] = 60; d[o + 1] = 30; d[o + 2] = 20; d[o + 3] = 170; continue; }
    d[o] = 176; d[o + 1] = 150; d[o + 2] = 96; d[o + 3] = lack * lack * 150 * (cap > .5 ? 1 : .5);
  }
  R.vctx.putImageData(R.vegImg, 0, 0);
}

// ---------------------------------------------------------------- creature sprites
function spriteFor(sp) {
  const key = sp.id + ':' + [G.size, G.fur, G.diet, G.aquatic, G.pattern, G.legs, G.intel, G.aggr, G.speed].map(k => Math.round(sp.mean[k] * 8)).join('') + ':' + Math.round(sp.hue / 12);
  let s = R.sprites.get(sp.id);
  if (s && s.key === key) return s;
  s = { key, frames: [], hue: sp.hue, col: `hsl(${sp.hue},55%,52%)` };
  for (let f = 0; f < 4; f++) s.frames.push(drawCreatureSprite(sp.mean, sp.hue, f));
  R.sprites.set(sp.id, s);
  return s;
}
// A top-down creature, facing right, drawn from its genes into a 64x64 canvas.
function drawCreatureSprite(g, hue, frame, size = 64) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const c = cv.getContext('2d');
  c.translate(size / 2, size / 2); c.scale(size / 64, size / 64);
  const aq = g[G.aquatic], fur = g[G.fur], diet = g[G.diet], bulk = .5 + g[G.size] * .35;
  const L = 22, Wd = 11 + bulk * 9 - aq * 3;
  const sat = 45 + diet * 20, lig = 42 + (1 - fur) * 10;
  const body = `hsl(${hue},${sat}%,${lig}%)`, dark = `hsl(${hue},${sat}%,${lig - 18}%)`, light = `hsl(${hue},${sat - 10}%,${lig + 18}%)`;
  const swing = [0, 1, 0, -1][frame];
  c.lineCap = 'round';
  // legs
  if (aq < .55) {
    const pairs = 1 + Math.round(g[G.legs] * 2);
    c.strokeStyle = dark; c.lineWidth = 3.2;
    for (let k = 0; k < pairs; k++) {
      const lx = L * (.45 - k * (.9 / Math.max(1, pairs))) ;
      const sw = swing * (k % 2 ? -1 : 1) * 5;
      c.beginPath(); c.moveTo(lx, -Wd * .6); c.lineTo(lx + sw, -Wd - 5); c.moveTo(lx, Wd * .6); c.lineTo(lx - sw, Wd + 5); c.stroke();
    }
  }
  // tail
  const tailLen = 8 + g[G.speed] * 10;
  c.strokeStyle = dark; c.lineWidth = 3;
  c.beginPath(); c.moveTo(-L * .85, 0); c.quadraticCurveTo(-L - tailLen * .5, swing * 4, -L - tailLen, swing * 7); c.stroke();
  if (aq > .5) { // tail fin and side fins
    c.fillStyle = dark;
    c.beginPath(); c.moveTo(-L - tailLen + 2, swing * 6); c.lineTo(-L - tailLen - 7, swing * 6 - 8); c.lineTo(-L - tailLen - 7, swing * 6 + 8); c.closePath(); c.fill();
    c.beginPath(); c.ellipse(0, -Wd * .9, 7, 3, -.5, 0, Math.PI * 2); c.ellipse(0, Wd * .9, 7, 3, .5, 0, Math.PI * 2); c.fill();
  }
  // fur halo
  if (fur > .45) {
    c.strokeStyle = light; c.lineWidth = 1.4;
    const n = 28;
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, x = Math.cos(a) * L * .95, y = Math.sin(a) * Wd * .95; c.beginPath(); c.moveTo(x, y); c.lineTo(x * (1 + fur * .22), y * (1 + fur * .3)); c.stroke(); }
  }
  // body
  c.fillStyle = body; c.strokeStyle = dark; c.lineWidth = 2;
  c.beginPath(); c.ellipse(0, 0, L, Wd, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  // pattern
  c.save(); c.beginPath(); c.ellipse(0, 0, L - 1, Wd - 1, 0, 0, Math.PI * 2); c.clip();
  if (g[G.pattern] > .66) { c.fillStyle = dark; for (let x = -L; x < L; x += 7) c.fillRect(x, -Wd, 3, Wd * 2); }
  else if (g[G.pattern] > .4) { c.fillStyle = dark; const r = mulberryR(Math.round(hue)); for (let k = 0; k < 9; k++) { c.beginPath(); c.arc((r() - .5) * L * 1.6, (r() - .5) * Wd * 1.5, 2 + r() * 2, 0, Math.PI * 2); c.fill(); } }
  c.fillStyle = light; c.globalAlpha = .35; c.beginPath(); c.ellipse(-2, -Wd * .35, L * .7, Wd * .35, 0, 0, Math.PI * 2); c.fill();
  c.restore();
  // head
  const hr = 6 + g[G.intel] * 5 + bulk * 2, hx = L * .85;
  c.fillStyle = body; c.strokeStyle = dark; c.lineWidth = 2;
  c.beginPath(); c.arc(hx, 0, hr, 0, Math.PI * 2); c.fill(); c.stroke();
  if (diet > .55) { c.fillStyle = '#f4efe6'; c.beginPath(); c.moveTo(hx + hr - 2, -3); c.lineTo(hx + hr + 4, -1.5); c.lineTo(hx + hr - 2, 0); c.moveTo(hx + hr - 2, 3); c.lineTo(hx + hr + 4, 1.5); c.lineTo(hx + hr - 2, 0); c.fill(); }
  if (g[G.aggr] > .55 && diet < .55) { c.fillStyle = '#efe4c8'; c.beginPath(); c.moveTo(hx + 1, -hr + 1); c.lineTo(hx + hr + 5, -hr - 5); c.lineTo(hx + 4, -hr + 3); c.moveTo(hx + 1, hr - 1); c.lineTo(hx + hr + 5, hr + 5); c.lineTo(hx + 4, hr - 3); c.fill(); }
  // eyes
  const es = 2 + g[G.sight] * 2;
  c.fillStyle = '#fff'; c.beginPath(); c.arc(hx + 2, -hr * .55, es, 0, Math.PI * 2); c.arc(hx + 2, hr * .55, es, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#111'; c.beginPath(); c.arc(hx + 3, -hr * .55, es * .55, 0, Math.PI * 2); c.arc(hx + 3, hr * .55, es * .55, 0, Math.PI * 2); c.fill();
  return cv;
}
function mulberryR(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, 1 | t); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- particles
function puff(o) { if (R.particles.length < 2500) R.particles.push(o); }
function updateParticles(dt) {
  for (const p of R.particles) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt; if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; } }
  R.particles = R.particles.filter(p => p.life < p.max);
}

// ---------------------------------------------------------------- the frame
// view: { W, H, cx, cy, zoom, t (seconds), dpr }
function renderWorld(ctx, w, view, ui) {
  const { W, H, zoom } = view;
  const X = x => (x - view.cx) * zoom + W / 2, Y = y => (y - view.cy) * zoom + H / 2;
  const x0 = view.cx - W / 2 / zoom, y0 = view.cy - H / 2 / zoom, x1 = view.cx + W / 2 / zoom, y1 = view.cy + H / 2 / zoom;
  ctx.save();
  if (R.shake > .2) ctx.translate((Math.random() - .5) * R.shake, (Math.random() - .5) * R.shake);
  ctx.fillStyle = '#0a1a2c'; ctx.fillRect(-20, -20, W + 40, H + 40);
  // terrain + vegetation
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(R.terrain, X(-.5), Y(-.5), w.W * zoom, w.H * zoom);
  ctx.drawImage(R.veg, X(-.5), Y(-.5), w.W * zoom, w.H * zoom);
  const t = view.t;
  // water glints
  drawGlints(ctx, w, view, X, Y, x0, y0, x1, y1);
  // heat-map overlay
  if (ui.overlay) drawOverlay(ctx, w, ui.overlay, X, Y, zoom, x0, y0, x1, y1);
  // fire and lava
  drawFires(ctx, w, view, X, Y, x0, y0, x1, y1);
  // tribes: fields, huts, fires, shrines
  drawTribes(ctx, w, view, X, Y);
  // corpses
  for (const k of w.corpses) {
    const a = 1 - (w.tick - k.t) / 240; if (a <= 0) continue;
    ctx.fillStyle = `rgba(40,30,30,${a * .35})`; ctx.beginPath(); ctx.ellipse(X(k.x), Y(k.y), k.r * zoom * 1.1, k.r * zoom * .6, k.dir, 0, Math.PI * 2); ctx.fill();
  }
  // creatures
  drawCreatures(ctx, w, view, ui, X, Y, x0, y0, x1, y1);
  // prophets
  for (const p of w.prophets) {
    const px = X(p.x), py = Y(p.y), s = Math.max(6, zoom * .9);
    const g = ctx.createRadialGradient(px, py, 0, px, py, s * 4);
    g.addColorStop(0, 'rgba(255,250,225,.95)'); g.addColorStop(.3, 'rgba(255,230,160,.35)'); g.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = g; ctx.fillRect(px - s * 4, py - s * 4, s * 8, s * 8);
    ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(px, py, s * .45, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,236,170,.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, py - s * .2, s * .8 + Math.sin(t * 4) * 1.5, 0, Math.PI * 2); ctx.stroke();
    if (Math.random() < .5) puff({ type: 'spark', x: p.x + (Math.random() - .5) * .6, y: p.y + (Math.random() - .5) * .6, vx: 0, vy: -.5, life: 0, max: 1.2, col: '255,236,170' });
  }
  // effects of your powers
  drawFx(ctx, w, view, X, Y);
  // particles
  drawParticles(ctx, view, X, Y);
  // weather and light
  drawSky(ctx, w, view, ui, X, Y);
  ctx.restore();
  if (R.flash > .01) { ctx.fillStyle = `rgba(255,248,230,${Math.min(1, R.flash)})`; ctx.fillRect(0, 0, W, H); }
}

function drawGlints(ctx, w, view, X, Y, x0, y0, x1, y1) {
  if (view.zoom < 3) return;
  const t = view.t;
  ctx.strokeStyle = 'rgba(220,240,255,.35)'; ctx.lineWidth = Math.max(1, view.zoom * .06);
  ctx.beginPath();
  const step = Math.max(1, Math.round(8 / view.zoom * 2));
  for (let ty = Math.max(0, y0 | 0); ty < Math.min(w.H, y1 + 1); ty += step) for (let tx = Math.max(0, x0 | 0); tx < Math.min(w.W, x1 + 1); tx += step) {
    const i = ty * w.W + tx; if (w.biome[i] > 1) continue;
    const h = hash2(7, tx, ty), ph = t * (1 + h) + h * 40, a = Math.sin(ph);
    if (a < .75) continue;
    const px = X(tx + h), py = Y(ty + hash2(8, tx, ty)), l = view.zoom * .45 * (a - .7) * 3;
    ctx.moveTo(px - l, py); ctx.lineTo(px + l, py);
  }
  ctx.stroke();
}
function drawFires(ctx, w, view, X, Y, x0, y0, x1, y1) {
  const z = view.zoom, t = view.t;
  ctx.globalCompositeOperation = 'lighter';
  for (let ty = Math.max(0, y0 | 0); ty < Math.min(w.H, y1 + 1); ty++) for (let tx = Math.max(0, x0 | 0); tx < Math.min(w.W, x1 + 1); tx++) {
    const i = ty * w.W + tx;
    if (w.lava[i]) {
      // lava glows softly and throws up the odd spark
      if (((tx * 7 + ty * 13) & 3) === 0) {
        const f = .75 + .25 * Math.sin(t * 2.2 + tx * .9 + ty * .6);
        const g = ctx.createRadialGradient(X(tx), Y(ty), 0, X(tx), Y(ty), z * 2.2);
        g.addColorStop(0, `rgba(255,170,60,${.32 * f})`); g.addColorStop(1, 'rgba(255,90,20,0)');
        ctx.fillStyle = g; ctx.fillRect(X(tx) - z * 2.2, Y(ty) - z * 2.2, z * 4.4, z * 4.4);
      }
      if (Math.random() < .01) puff({ type: 'ember', x: tx + Math.random() - .5, y: ty, vx: (Math.random() - .5) * .6, vy: -1.2, life: 0, max: 1 });
    } else if (w.fire[i]) {
      const f = .6 + .4 * Math.sin(t * 9 + tx * 3.1 + ty * 1.7);
      const g = ctx.createRadialGradient(X(tx), Y(ty), 0, X(tx), Y(ty), z * 1.3);
      g.addColorStop(0, `rgba(255,190,80,${.7 * f})`); g.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = g; ctx.fillRect(X(tx) - z * 1.3, Y(ty) - z * 1.3, z * 2.6, z * 2.6);
      if (Math.random() < .08) puff({ type: 'smoke', x: tx + Math.random() - .5, y: ty, vx: .3, vy: -.9, life: 0, max: 3, r: .6, grow: .8 });
      if (Math.random() < .12) puff({ type: 'ember', x: tx + Math.random() - .5, y: ty, vx: (Math.random() - .5), vy: -1.5, life: 0, max: .8 });
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}
function drawTribes(ctx, w, view, X, Y) {
  const z = view.zoom, t = view.t;
  for (const tb of w.tribes) {
    const cx = X(tb.x), cy = Y(tb.y);
    if (cx < -200 || cy < -200 || cx > view.W + 200 || cy > view.H + 200) continue;
    const sp = spById(w, tb.sp), hue = sp ? sp.hue : 30;
    if (tb.gone) { // ruins
      ctx.fillStyle = 'rgba(60,55,50,.5)';
      for (let k = 0; k < 5; k++) { const a = k * 1.3, r = 1.8; ctx.fillRect(cx + Math.cos(a) * r * z - z * .2, cy + Math.sin(a) * r * z - z * .2, z * .4, z * .4); }
      continue;
    }
    const huts = Math.min(3 + tb.stage * 6, 2 + Math.ceil(tb.members * .7));
    if (tb.stage >= 2) { // a palisade
      const R0 = (5 + tb.stage) * z;
      ctx.strokeStyle = 'rgba(92,66,40,.9)'; ctx.lineWidth = Math.max(2, z * .35); ctx.setLineDash([Math.max(2, z * .3), Math.max(1, z * .12)]);
      ctx.beginPath(); ctx.arc(cx, cy, R0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    for (let k = 0; k < huts; k++) {
      const a = k * 2.39996, r = (1.5 + Math.sqrt(k) * 1.15) * z;
      const hx = cx + Math.cos(a) * r, hy = cy + Math.sin(a) * r, s = Math.max(2.5, z * (.55 + tb.stage * .1));
      // shadow, thatched roof with a lighter peak, radial thatch lines
      ctx.fillStyle = 'rgba(20,14,10,.35)'; ctx.beginPath(); ctx.ellipse(hx + s * .25, hy + s * .3, s * 1.05, s * .9, 0, 0, Math.PI * 2); ctx.fill();
      const g = ctx.createRadialGradient(hx - s * .25, hy - s * .3, s * .1, hx, hy, s);
      g.addColorStop(0, `hsl(42,55%,${70 + (k % 3) * 3}%)`); g.addColorStop(1, `hsl(32,45%,${38 + (k % 2) * 5}%)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hx, hy, s, 0, Math.PI * 2); ctx.fill();
      if (s > 4) { ctx.strokeStyle = 'rgba(90,60,25,.45)'; ctx.lineWidth = 1; ctx.beginPath(); for (let q = 0; q < 8; q++) { const qa = q / 8 * Math.PI * 2; ctx.moveTo(hx + Math.cos(qa) * s * .25, hy + Math.sin(qa) * s * .25); ctx.lineTo(hx + Math.cos(qa) * s * .95, hy + Math.sin(qa) * s * .95); } ctx.stroke(); }
      ctx.fillStyle = `hsl(${hue},45%,40%)`; ctx.beginPath(); ctx.arc(hx, hy, s * .18, 0, Math.PI * 2); ctx.fill();
    }
    if (tb.stage >= 2) { // the great hall
      ctx.fillStyle = 'rgba(20,14,10,.35)'; ctx.fillRect(cx - z * 1.1, cy - z * .5, z * 2.8, z * 1.8);
      ctx.fillStyle = 'hsl(28,35%,34%)'; ctx.fillRect(cx - z * 1.4, cy - z * .9, z * 2.8, z * 1.8);
      ctx.fillStyle = 'hsl(36,50%,58%)'; ctx.beginPath(); ctx.moveTo(cx - z * 1.5, cy - z * .9); ctx.lineTo(cx, cy - z * 1.6); ctx.lineTo(cx + z * 1.5, cy - z * .9); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `hsl(${hue},55%,50%)`; ctx.fillRect(cx - z * .08, cy - z * 2.4, z * .16, z * .9);
    }
    if (tb.shrine) { // an obelisk that glows
      const sx = cx + z * 3.5, sy = cy - z * 2.5;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, z * 3); g.addColorStop(0, 'rgba(255,230,150,.6)'); g.addColorStop(1, 'rgba(255,230,150,0)');
      ctx.fillStyle = g; ctx.fillRect(sx - z * 3, sy - z * 3, z * 6, z * 6);
      ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.moveTo(sx, sy - z * 1.2); ctx.lineTo(sx + z * .4, sy + z * .6); ctx.lineTo(sx - z * .4, sy + z * .6); ctx.closePath(); ctx.fill();
    }
    // the fire at the heart of every camp
    const f = .75 + .25 * Math.sin(t * 11 + tb.id);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, z * 2.5 * f);
    g.addColorStop(0, 'rgba(255,200,90,.9)'); g.addColorStop(.3, 'rgba(255,130,40,.35)'); g.addColorStop(1, 'rgba(255,100,30,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - z * 3, cy - z * 3, z * 6, z * 6);
    ctx.globalCompositeOperation = 'source-over';
    if (Math.random() < .05) puff({ type: 'smoke', x: tb.x, y: tb.y, vx: .2, vy: -.7, life: 0, max: 3, r: .35, grow: .5 });
    if (z > 7) { ctx.font = '600 12px "Cinzel", Georgia, serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,245,225,.9)'; ctx.fillText(tb.name, cx, cy - (5 + tb.stage) * z - 6); ctx.textAlign = 'left'; }
  }
}
function drawCreatures(ctx, w, view, ui, X, Y, x0, y0, x1, y1) {
  const z = view.zoom, t = view.t;
  const sel = ui.selected, focusSp = ui.focusSp;
  for (const c of w.creatures) {
    if (c.x < x0 - 2 || c.x > x1 + 2 || c.y < y0 - 2 || c.y > y1 + 2) continue;
    const sp = spById(w, c.sp); if (!sp) continue;
    const px = X(c.x), py = Y(c.y), rad = c.r * z * 1.45;
    const dim = focusSp && c.sp !== focusSp;
    if (dim) ctx.globalAlpha = .25;
    if (c.bless) { const g = ctx.createRadialGradient(px, py, 0, px, py, rad * 3); g.addColorStop(0, 'rgba(255,225,130,.55)'); g.addColorStop(1, 'rgba(255,225,130,0)'); ctx.fillStyle = g; ctx.fillRect(px - rad * 3, py - rad * 3, rad * 6, rad * 6); }
    if (rad < 3.2) {
      ctx.fillStyle = `hsl(${sp.hue},60%,${c.g[G.diet] > .6 ? 45 : 60}%)`;
      const s = Math.max(1.6, rad * 1.2); ctx.fillRect(px - s / 2, py - s / 2, s, s);
    } else {
      const spr = spriteFor(sp);
      const f = c.spd > .005 ? (((c.walk * 1.5) | 0) % 4) : 0;
      const s = rad * 2.2;
      ctx.save(); ctx.translate(px, py); ctx.rotate(c.dir);
      ctx.drawImage(spr.frames[f], -s / 2, -s / 2, s, s);
      ctx.restore();
    }
    if (c.inf) { ctx.strokeStyle = `rgba(140,255,110,${.5 + .3 * Math.sin(t * 6 + c.id)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, py, rad * 1.1 + 2, 0, Math.PI * 2); ctx.stroke(); if (Math.random() < .03) puff({ type: 'spark', x: c.x, y: c.y, vx: (Math.random() - .5) * .5, vy: -.4, life: 0, max: 1, col: '150,255,120' }); }
    if (c.belief && z > 5) { ctx.fillStyle = 'rgba(255,245,210,.85)'; ctx.beginPath(); ctx.arc(px, py - rad - 3, Math.max(1.5, z * .12), 0, Math.PI * 2); ctx.fill(); }
    if (dim) ctx.globalAlpha = 1;
    if (c.id === sel || c.id === w.player) {
      ctx.strokeStyle = c.id === w.player ? 'rgba(160,240,255,.95)' : 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.arc(px, py, rad + 5 + Math.sin(t * 3) * 1.5, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    if (c.name && z > 6) { ctx.font = '600 11px "Figtree", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = c.bless ? 'rgba(255,230,160,.95)' : 'rgba(255,255,255,.85)'; ctx.fillText(c.name, px, py - rad - 8); ctx.textAlign = 'left'; }
  }
}
function drawOverlay(ctx, w, kind, X, Y, z, x0, y0, x1, y1) {
  const step = z < 4 ? 2 : 1;
  for (let ty = Math.max(0, y0 | 0); ty < Math.min(w.H, y1 + 1); ty += step) for (let tx = Math.max(0, x0 | 0); tx < Math.min(w.W, x1 + 1); tx += step) {
    const i = ty * w.W + tx; let v, col;
    if (kind === 'temp') { v = clamp(tileTemp(w, i), 0, 1); col = `hsla(${240 - v * 240},80%,50%,.45)`; }
    else if (kind === 'food') { if (w.biome[i] <= 1) continue; v = w.food[i] / 1.6; col = `rgba(90,220,90,${clamp(v, 0, 1) * .6})`; }
    else continue;
    ctx.fillStyle = col; ctx.fillRect(X(tx - .5), Y(ty - .5), z * step + .5, z * step + .5);
  }
  if (kind === 'disease' || kind.startsWith('gene:')) {
    const gi = kind.startsWith('gene:') ? +kind.slice(5) : -1;
    for (const c of w.creatures) {
      let v, col;
      if (gi >= 0) { v = c.g[gi]; col = `hsla(${280 - v * 280},90%,55%,.9)`; }
      else { if (!c.inf) continue; col = 'rgba(140,255,110,.9)'; }
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(c.x), Y(c.y), Math.max(2.5, z * .5), 0, Math.PI * 2); ctx.fill();
    }
  }
}
function drawFx(ctx, w, view, X, Y) {
  const z = view.zoom, t = view.t;
  for (const f of w.fx) {
    const age = w.tick - f.t, k = age / f.dur;
    const px = X(f.x), py = Y(f.y);
    switch (f.type) {
      case 'meteor': {
        if (age > 45) break;
        const p = age / 45, e = p * p;
        const sx = px + (1 - e) * 900, sy = py - (1 - e) * 900;
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 12; i++) { const q = i / 12, tx = sx + q * 120 * (1 - e * .3), ty = sy - q * 120 * (1 - e * .3); ctx.fillStyle = `rgba(255,${160 - i * 8},60,${(1 - q) * .5})`; ctx.beginPath(); ctx.arc(tx, ty, (1 - q) * (8 + f.r * z * .25 * e + 6), 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(sx, sy, 5 + f.r * z * .15 * e, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(0,0,0,${.35 * e})`; ctx.beginPath(); ctx.ellipse(px, py, f.r * z * e, f.r * z * e * .6, 0, 0, Math.PI * 2); ctx.fill();
        if (Math.random() < .8) puff({ type: 'smoke', x: view.cx + (sx - view.W / 2) / z, y: view.cy + (sy - view.H / 2) / z, vx: 0, vy: 0, life: 0, max: 1.4, r: .8, grow: 1.2, dark: true });
        break;
      }
      case 'impact': {
        if (age === 0 || (age < 2 && !f.done)) { f.done = true; R.flash = 1; R.shake = 28; for (let i = 0; i < 90; i++) { const a = Math.random() * Math.PI * 2, s = 4 + Math.random() * 14; puff({ type: 'debris', x: f.x, y: f.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 1.8, life: 0, max: 1.5 + Math.random() }); } for (let i = 0; i < 40; i++) { const a = Math.random() * Math.PI * 2, s = Math.random() * 6; puff({ type: 'smoke', x: f.x, y: f.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: .8, life: 0, max: 6, r: 2, grow: 1.6, dark: true }); } }
        const rr = f.r * z * (1 + k * 4);
        ctx.strokeStyle = `rgba(255,240,210,${(1 - k) * .8})`; ctx.lineWidth = 3 + (1 - k) * 8; ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI * 2); ctx.stroke();
        break;
      }
      case 'bolt': {
        if (age === 0 || !f.done) { f.done = true; R.flash = Math.max(R.flash, .5); R.shake = Math.max(R.shake, 6); }
        const r = mulberryR(f.seed || 3);
        ctx.strokeStyle = `rgba(230,240,255,${1 - k})`; ctx.lineWidth = 3; ctx.shadowColor = 'rgba(160,190,255,.9)'; ctx.shadowBlur = 16;
        ctx.beginPath(); let bx = px + (r() - .5) * 60, by = py - 600; ctx.moveTo(bx, by);
        while (by < py) { by += 30 + r() * 30; bx += (r() - .5) * 40; if (by > py) { by = py; bx = px; } ctx.lineTo(bx, by); }
        ctx.stroke(); ctx.shadowBlur = 0;
        break;
      }
      case 'bless': {
        const a = Math.sin(k * Math.PI);
        const g = ctx.createLinearGradient(px, py - 400, px, py);
        g.addColorStop(0, 'rgba(255,240,190,0)'); g.addColorStop(1, `rgba(255,236,170,${.55 * a})`);
        ctx.fillStyle = g; ctx.fillRect(px - 14 - z, py - 400, 28 + z * 2, 400);
        ctx.strokeStyle = `rgba(255,226,140,${.7 * a})`; ctx.lineWidth = 1.5;
        for (let i = 0; i < 10; i++) { const an = i / 10 * Math.PI * 2 + t; ctx.beginPath(); ctx.moveTo(px + Math.cos(an) * 10, py + Math.sin(an) * 10); ctx.lineTo(px + Math.cos(an) * (30 + z * 2), py + Math.sin(an) * (30 + z * 2)); ctx.stroke(); }
        if (Math.random() < .5) puff({ type: 'spark', x: f.x + (Math.random() - .5) * 3, y: f.y + (Math.random() - .5) * 3, vx: 0, vy: -1, life: 0, max: 1.4, col: '255,230,150' });
        break;
      }
      case 'plague': {
        ctx.fillStyle = `rgba(120,255,100,${(1 - k) * .25})`; ctx.beginPath(); ctx.arc(px, py, (4 + k * 10) * z, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'fruit': {
        if (Math.random() < .9) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * f.r; puff({ type: 'fruit', x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r - 3, vx: 0, vy: 5, life: 0, max: .6, col: ['#e8483a', '#f4b43a', '#b54ad0', '#5fc34a'][Math.random() * 4 | 0] }); }
        break;
      }
      case 'rain': case 'healrain': {
        if (k > .97) break;
        const n = f.type === 'healrain' ? 6 : 4;
        for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * f.r; puff({ type: 'rain', x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r - 2, vx: -.5, vy: 8, life: 0, max: .25, col: f.type === 'healrain' ? '200,255,220' : '190,215,255' }); }
        ctx.fillStyle = f.type === 'healrain' ? 'rgba(150,255,190,.08)' : 'rgba(40,60,90,.14)'; ctx.beginPath(); ctx.arc(px, py, f.r * z, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'rays': {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) {
          const g = ctx.createLinearGradient(px - f.r * z, py, px + f.r * z, py);
          const hue = (t * 40 + i * 70) % 360;
          g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.5, `hsla(${hue},90%,60%,.12)`); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(px, py + Math.sin(t * 1.3 + i) * f.r * z * .3, f.r * z, f.r * z * .18, Math.sin(t * .4 + i) * .4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'ghost': ctx.fillStyle = `rgba(255,255,255,${(1 - k) * .6})`; ctx.beginPath(); ctx.arc(px, py - k * 30, Math.max(3, z * .6) * (1 + k), 0, Math.PI * 2); ctx.fill(); break;
      case 'kill': if (age < 2 && !f.done) { f.done = true; for (let i = 0; i < 8; i++) puff({ type: 'blood', x: f.x, y: f.y, vx: (Math.random() - .5) * 4, vy: (Math.random() - .5) * 4, drag: 4, life: 0, max: .8 }); } break;
      case 'steam': if (Math.random() < .3) puff({ type: 'smoke', x: f.x, y: f.y, vx: 0, vy: -1, life: 0, max: 2, r: .5, grow: .8 }); break;
      case 'volcano': if (Math.random() < .6) puff({ type: 'smoke', x: f.x + (Math.random() - .5), y: f.y, vx: .6, vy: -2.2, life: 0, max: 5, r: 1, grow: 1.4, dark: true }); break;
      case 'ignite': if (age < 2 && !f.done) { f.done = true; R.shake = Math.max(R.shake, 4); } break;
    }
  }
}
function drawParticles(ctx, view, X, Y) {
  const z = view.zoom;
  for (const p of R.particles) {
    const k = p.life / p.max, x = X(p.x), y = Y(p.y);
    switch (p.type) {
      case 'smoke': { const r = (p.r + p.grow * p.life) * z; ctx.fillStyle = p.dark ? `rgba(60,50,48,${(1 - k) * .35})` : `rgba(220,220,225,${(1 - k) * .25})`; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); break; }
      case 'ember': ctx.fillStyle = `rgba(255,${180 - k * 100},60,${1 - k})`; ctx.fillRect(x, y, 2, 2); break;
      case 'debris': ctx.fillStyle = `rgba(90,70,60,${1 - k})`; ctx.fillRect(x - 1.5, y - 1.5, 3, 3); break;
      case 'spark': ctx.fillStyle = `rgba(${p.col},${1 - k})`; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill(); break;
      case 'fruit': ctx.fillStyle = p.col; ctx.globalAlpha = 1 - k * k; ctx.beginPath(); ctx.arc(x, y, Math.max(2, z * .25), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; break;
      case 'rain': ctx.strokeStyle = `rgba(${p.col},.55)`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 10); ctx.stroke(); break;
      case 'blood': ctx.fillStyle = `rgba(170,20,30,${1 - k})`; ctx.fillRect(x - 1, y - 1, 2.5, 2.5); break;
      case 'snow': ctx.fillStyle = `rgba(255,255,255,${(1 - k) * .8})`; ctx.fillRect(x, y, 2, 2); break;
    }
  }
}
// Day and night, dust from impacts, rain, snow, drought haze.
function drawSky(ctx, w, view, ui, X, Y) {
  const { W, H } = view, cl = w.climate;
  // weather particles in screen space around the camera
  const inView = () => ({ x: view.cx + (Math.random() - .5) * W / view.zoom, y: view.cy + (Math.random() - .5) * H / view.zoom - 2 });
  if (cl.seaTarget > 0 && Math.random() < .9) for (let i = 0; i < 4; i++) { const p = inView(); puff({ type: 'rain', x: p.x, y: p.y, vx: -.8, vy: 9, life: 0, max: .3, col: '190,210,240' }); }
  if (cl.temp < -.12 && Math.random() < .8) for (let i = 0; i < 3; i++) { const p = inView(); puff({ type: 'snow', x: p.x, y: p.y, vx: .4, vy: 1.3, life: 0, max: 2.5 }); }
  if (cl.dust > .04) { ctx.fillStyle = `rgba(92,70,55,${Math.min(.45, cl.dust * .5)})`; ctx.fillRect(0, 0, W, H); }
  if (cl.drought > .05) { ctx.fillStyle = `rgba(255,200,90,${cl.drought * .12})`; ctx.fillRect(0, 0, W, H); }
  if (cl.temp < -.1) { ctx.fillStyle = `rgba(190,220,255,${Math.min(.2, -cl.temp * .4)})`; ctx.fillRect(0, 0, W, H); }
  // night falls four times a year; it fades out at high speeds
  if (ui.speed <= 5) {
    const day = (w.tick % 150) / 150, light = .5 + .5 * Math.cos(day * Math.PI * 2);
    const night = clamp((.45 - light) * 1.4, 0, .5);
    if (night > .01) {
      ctx.fillStyle = `rgba(8,14,40,${night})`; ctx.fillRect(0, 0, W, H);
      // at night the world's lights shine: camp fires, blessed ones, messengers
      ctx.globalCompositeOperation = 'lighter';
      for (const tb of w.tribes) { if (tb.gone) continue; const x = X(tb.x), y = Y(tb.y), r = view.zoom * 5; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,170,70,${night * 1.2})`); g.addColorStop(1, 'rgba(255,150,50,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}
/*RENDER-END*/

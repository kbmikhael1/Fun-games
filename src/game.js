'use strict';
// ===========================================================================
// Daraja: game shell, renderer, input, audio.
// Depends on the engine (MATERIALS, VEHICLES, createSim, stepSim, buildTerrain,
// designCost, compCapacity) and LEVELS.
// ===========================================================================
(() => {
const $ = (s, r = document) => r.querySelector(s);
const cv = $('#world');
const ctx = cv.getContext('2d');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COARSE = matchMedia('(pointer: coarse)').matches;
let W = 0, H = 0, DPR = 1;

// ---------------------------------------------------------------- save data
const SAVE_KEY = 'daraja.save.v1';
function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && typeof s === 'object') return s; } catch (e) { /* no storage */ }
  return {};
}
const save = Object.assign({ progress: {}, designs: {}, muted: false, seenHelp: false }, loadSave());
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }

// ---------------------------------------------------------------- helpers
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const mm = L => Math.round(L * 1000).toLocaleString('en-US').replace(/,/g, ' ');
function ugx(k) { // k = thousands of shillings
  if (k >= 1000) return 'UGX ' + (k / 1000).toFixed(2) + 'M';
  return 'UGX ' + Math.round(k) + 'k';
}
const ugxShort = k => (k >= 1000 ? (k / 1000).toFixed(2) + 'M' : Math.round(k) + 'k');
function hash(s, i) {
  let h = Math.imul(i | 0, 374761393) + Math.imul(s | 0, 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(seed, x) {
  const i = Math.floor(x), t = x - i, u = t * t * (3 - 2 * t);
  return lerp(hash(seed, i), hash(seed, i + 1), u);
}
function fbm(seed, x) {
  let y = 0, a = 1, f = 1, n = 0;
  for (let o = 0; o < 4; o++) { y += a * vnoise(seed + o * 31, x * f); n += a; a *= .5; f *= 2.03; }
  return y / n;
}
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(c1, c2, t) {
  const a = hexToRgb(c1), b = hexToRgb(c2);
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
}
function path(c, pts, v) {
  c.beginPath();
  pts.forEach((p, i) => { const x = v ? v.X(p[0]) : p[0], y = v ? v.Y(p[1]) : p[1]; i ? c.lineTo(x, y) : c.moveTo(x, y); });
  c.closePath();
}

// Blueprint and live palettes for each material
const BP = { road: '#eaf3ff', wood: '#ffd79c', steel: '#8fe3ff', cable: '#cdbbff' };
const REAL = { road: '#353b47', wood: '#b9793f', steel: '#6f87a6', cable: '#1b1e25' };
const MAT_ORDER = ['road', 'wood', 'steel', 'cable'];

// ---------------------------------------------------------------- state
const S = {
  screen: 'title', level: null, design: null, tool: 'road', hist: [], redo: [],
  hoverNode: -1, hoverMember: -1, drag: null, pointer: { x: -99, y: -99, inside: false, wx: 0, wy: 0 },
  sim: null, slow: false, forces: false, resultAt: 0, resultShown: false,
  trans: null, particles: [], shake: 0, flashes: [],
  view: null, terrain: null, bgBlue: null, bgReal: null, vig: null, sun: { x: 0, y: 0 },
  demo: null, clearArmed: 0, lastAdded: null, creakT: 0, time: 0,
};

// ---------------------------------------------------------------- view
function levelBounds(L) {
  const V = VEHICLES[L.vehicle];
  let x0 = Math.min(-7, vehicleStartX(L) - V.rear - 1.2), x1 = L.gap + 7, y1 = 4.5;
  for (const a of L.anchors) { x0 = Math.min(x0, a[0] - 3.5); x1 = Math.max(x1, a[0] + 3.5); y1 = Math.max(y1, a[1] + 2.4); }
  y1 = Math.max(y1, (L.hR || 0) + 4.5);
  return { x0, x1, y0: L.waterY - 1.4, y1 };
}
function makeView(c, w, h, L, ins, bounds) {
  const b = bounds || levelBounds(L);
  const aw = Math.max(50, w - ins.left - ins.right), ah = Math.max(50, h - ins.top - ins.bottom);
  const s = Math.min(aw / (b.x1 - b.x0), ah / (b.y1 - b.y0));
  const cx = ins.left + aw / 2, cy = ins.top + ah / 2;
  const mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2;
  return {
    ctx: c, W: w, H: h, s,
    X: x => cx + (x - mx) * s, Y: y => cy - (y - my) * s,
    iX: px => mx + (px - cx) / s, iY: py => my - (py - cy) / s,
  };
}
function insets(screen) {
  if (screen === 'title') {
    const box = $('#title .title-inner').getBoundingClientRect();
    const top = Math.max(box.bottom + 8, H * .42);
    return { top, bottom: 40, left: 16, right: 16 };
  }
  const hud = $('#hud').getBoundingClientRect();
  const tb = $('#toolbar').getBoundingClientRect();
  return { top: hud.bottom + 10, bottom: Math.max(18, H - tb.top + 10), left: 14, right: 14 };
}
function layer() {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(W * DPR)); c.height = Math.max(1, Math.round(H * DPR));
  const x = c.getContext('2d'); x.setTransform(DPR, 0, 0, DPR, 0, 0);
  return { canvas: c, ctx: x };
}
function rebuild() {
  const L = S.level; if (!L) return;
  const title = S.screen === 'title';
  S.view = makeView(ctx, W, H, L, insets(title ? 'title' : 'build'), title ? { x0: -8.5, x1: L.gap + 8.5, y0: L.waterY - 1, y1: 3.2 } : null);
  S.terrain = buildTerrain(L);
  const r = layer(); renderRealBG(Object.assign({}, S.view, { ctx: r.ctx }), L, S.terrain); S.bgReal = r.canvas;
  if (!title) { const b = layer(); renderBlueprintBG(Object.assign({}, S.view, { ctx: b.ctx }), L, S.terrain); S.bgBlue = b.canvas; }
  const vg = layer(); renderVignette(vg.ctx); S.vig = vg.canvas;
}
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  rebuild();
}

// ======================================================================
// BLUEPRINT RENDERING
// ======================================================================
function renderBlueprintBG(v, L, T) {
  const c = v.ctx;
  const g = c.createRadialGradient(v.W * .5, v.H * .42, 0, v.W * .5, v.H * .5, Math.max(v.W, v.H) * .8);
  g.addColorStop(0, '#16406f'); g.addColorStop(.6, '#0f2f57'); g.addColorStop(1, '#081d38');
  c.fillStyle = g; c.fillRect(0, 0, v.W, v.H);
  // paper fibre
  const rnd = mulberry32(99);
  for (let i = 0; i < 2600; i++) {
    c.fillStyle = `rgba(200,225,255,${.015 + rnd() * .035})`;
    c.fillRect(rnd() * v.W, rnd() * v.H, 1 + rnd() * 1.5, 1);
  }
  // grid: 0.5 m minor, 1 m, 5 m major
  const wx0 = v.iX(0), wx1 = v.iX(v.W), wy0 = v.iY(v.H), wy1 = v.iY(0);
  c.lineWidth = 1;
  for (let x = Math.ceil(wx0 * 2) / 2; x <= wx1; x += .5) {
    const k = Math.round(x * 2);
    c.strokeStyle = k % 10 === 0 ? 'rgba(160,205,255,.2)' : k % 2 === 0 ? 'rgba(160,205,255,.1)' : 'rgba(160,205,255,.045)';
    const px = Math.round(v.X(x)) + .5; c.beginPath(); c.moveTo(px, 0); c.lineTo(px, v.H); c.stroke();
  }
  for (let y = Math.ceil(wy0 * 2) / 2; y <= wy1; y += .5) {
    const k = Math.round(y * 2);
    c.strokeStyle = k % 10 === 0 ? 'rgba(160,205,255,.2)' : k % 2 === 0 ? 'rgba(160,205,255,.1)' : 'rgba(160,205,255,.045)';
    const py = Math.round(v.Y(y)) + .5; c.beginPath(); c.moveTo(0, py); c.lineTo(v.W, py); c.stroke();
  }
  // water line (drawn first so the ground section covers it)
  const wy = v.Y(L.waterY);
  c.fillStyle = 'rgba(80,150,230,.10)'; c.fillRect(0, wy, v.W, v.H - wy);
  c.strokeStyle = 'rgba(234,243,255,.55)'; c.lineWidth = 1.2; c.setLineDash([]);
  c.beginPath(); c.moveTo(0, wy); c.lineTo(v.W, wy); c.stroke();
  c.strokeStyle = 'rgba(234,243,255,.28)';
  for (let row = 1; row <= 3; row++) {
    const yy = wy + row * 9;
    for (let x = v.X(-2) + row * 13; x < v.X(L.gap + 2); x += 46) {
      c.beginPath(); c.moveTo(x, yy); c.quadraticCurveTo(x + 5, yy - 4, x + 10, yy); c.quadraticCurveTo(x + 15, yy + 4, x + 20, yy); c.stroke();
    }
  }
  // W.L. symbol
  const wlx = v.X(L.gap * .5) + 60;
  c.fillStyle = BP.road; c.beginPath(); c.moveTo(wlx - 6, wy - 12); c.lineTo(wlx + 6, wy - 12); c.lineTo(wlx, wy - 2); c.closePath(); c.fill();
  c.font = '500 11px "IBM Plex Mono", ui-monospace, monospace'; c.fillText('W.L.', wlx + 10, wy - 4);

  // ground in section: hatched earth
  for (const p of T.polys) {
    c.save();
    path(c, p.pts, v);
    c.fillStyle = p.kind === 'spire' ? 'rgba(10,30,60,.55)' : 'rgba(7,24,48,.72)'; c.fill();
    c.clip();
    c.strokeStyle = 'rgba(160,205,255,.22)'; c.lineWidth = 1;
    const step = p.kind === 'spire' ? 10 : 7;
    for (let k = -v.H; k < v.W; k += step) { c.beginPath(); c.moveTo(k, v.H); c.lineTo(k + v.H, 0); c.stroke(); }
    c.restore();
    path(c, p.pts, v);
    c.strokeStyle = BP.road; c.lineWidth = 1.6;
    if (p.kind === 'spire') c.setLineDash([6, 4]);
    c.stroke(); c.setLineDash([]);
  }
  // span dimension (mm, as on a real drawing)
  const b = levelBounds(L);
  const dimY = v.Y(b.y1 - 1.2);
  const xa = v.X(0), xb = v.X(L.gap);
  c.strokeStyle = 'rgba(234,243,255,.6)'; c.fillStyle = 'rgba(234,243,255,.85)'; c.lineWidth = 1;
  c.beginPath();
  c.moveTo(xa, v.Y(0) - 8); c.lineTo(xa, dimY - 6);
  c.moveTo(xb, v.Y(L.hR || 0) - 8); c.lineTo(xb, dimY - 6);
  c.moveTo(xa - 8, dimY); c.lineTo(xb + 8, dimY);
  c.moveTo(xa - 4, dimY + 4); c.lineTo(xa + 4, dimY - 4);
  c.moveTo(xb - 4, dimY + 4); c.lineTo(xb + 4, dimY - 4);
  c.stroke();
  c.font = '600 12px "IBM Plex Mono", ui-monospace, monospace'; c.textAlign = 'center';
  const lbl = mm(L.gap) + ' CLEAR SPAN';
  const tw = c.measureText(lbl).width + 12;
  c.fillStyle = '#0f2f57'; c.fillRect((xa + xb) / 2 - tw / 2, dimY - 9, tw, 18);
  c.fillStyle = 'rgba(234,243,255,.9)'; c.fillText(lbl, (xa + xb) / 2, dimY + 4);
  if (L.hR) {
    const xr = v.X(L.gap + 2.2);
    c.strokeStyle = 'rgba(234,243,255,.6)';
    c.beginPath(); c.moveTo(v.X(L.gap) + 6, v.Y(0)); c.lineTo(xr + 6, v.Y(0)); c.moveTo(xr, v.Y(0)); c.lineTo(xr, v.Y(L.hR));
    c.moveTo(xr - 4, v.Y(0) + 4); c.lineTo(xr + 4, v.Y(0) - 4); c.moveTo(xr - 4, v.Y(L.hR) + 4); c.lineTo(xr + 4, v.Y(L.hR) - 4); c.stroke();
    c.save(); c.translate(xr - 6, v.Y(L.hR / 2)); c.rotate(-Math.PI / 2); c.fillStyle = 'rgba(234,243,255,.9)'; c.fillText(mm(L.hR), 0, 0); c.restore();
  }
  c.textAlign = 'left';
  // vehicle outline at the start, and the finish marker
  const V = VEHICLES[L.vehicle];
  c.save();
  c.strokeStyle = 'rgba(234,243,255,.5)'; c.setLineDash([5, 4]); c.lineWidth = 1.2;
  const sx = vehicleStartX(L);
  c.translate(v.X(sx), v.Y(V.r + .02)); c.scale(v.s, -v.s);
  vehicleOutline(c, V); c.lineWidth = 1.2 / v.s; c.stroke();
  for (const dx of V.wheels) { c.beginPath(); c.arc(dx, 0, V.r, 0, Math.PI * 2); c.stroke(); }
  c.restore();
  c.font = '500 11px "IBM Plex Mono", ui-monospace, monospace'; c.fillStyle = 'rgba(234,243,255,.7)';
  c.fillText(`${V.name.toUpperCase()} · ${(V.mass / 1000).toFixed(1)} t`, v.X(sx - V.rear), v.Y(V.height + .55));
  const fx = v.X(L.gap + (L.finishPad || 5)), fy = v.Y(L.hR || 0);
  c.strokeStyle = 'rgba(234,243,255,.75)'; c.setLineDash([]); c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx, fy - 34); c.stroke();
  c.fillStyle = 'rgba(255,198,92,.9)'; c.beginPath(); c.moveTo(fx, fy - 34); c.lineTo(fx + 16, fy - 29); c.lineTo(fx, fy - 24); c.closePath(); c.fill();
  c.fillStyle = 'rgba(234,243,255,.75)'; c.fillText('FINISH', fx + 6, fy - 12);
  // general notes
  const ins = insets('build');
  const nx = 18, ny = ins.top + 8;
  if (v.W > 640) {
    c.font = '600 11px "IBM Plex Mono", ui-monospace, monospace'; c.fillStyle = 'rgba(234,243,255,.8)';
    c.fillText('NOTES', nx, ny + 10);
    c.font = '400 11px "IBM Plex Mono", ui-monospace, monospace'; c.fillStyle = 'rgba(234,243,255,.62)';
    let yy = ny + 28;
    L.notes.forEach((n, i) => {
      const lines = wrap(c, `${i + 1}. ${n}`, Math.min(360, v.W * .3));
      lines.forEach((ln, j) => { c.fillText((j ? '   ' : '') + ln, nx, yy); yy += 15; });
      yy += 3;
    });
  }
}
function wrap(c, text, maxW) {
  const words = text.split(' '), out = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line); return out;
}

function drawAnchorsBP(v, L, t) {
  const c = v.ctx;
  const pulse = S.design && S.design.members.length === 0 ? .5 + .5 * Math.sin(t * 4) : 0;
  L.anchors.forEach((a, i) => {
    const x = v.X(a[0]), y = v.Y(a[1]);
    const hov = S.hoverNode === i;
    c.fillStyle = 'rgba(255,198,92,.16)';
    if (pulse) { c.beginPath(); c.arc(x, y, 10 + pulse * 8, 0, Math.PI * 2); c.fillStyle = `rgba(255,198,92,${.25 * (1 - pulse)})`; c.fill(); }
    // pinned support symbol
    c.strokeStyle = '#ffc65c'; c.lineWidth = 1.5; c.fillStyle = 'rgba(255,198,92,.2)';
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - 8, y + 12); c.lineTo(x + 8, y + 12); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x - 12, y + 12); c.lineTo(x + 12, y + 12); c.stroke();
    for (let k = -10; k <= 8; k += 5) { c.beginPath(); c.moveTo(x + k, y + 12); c.lineTo(x + k + 4, y + 17); c.stroke(); }
    c.beginPath(); c.arc(x, y, hov ? 6.5 : 4.5, 0, Math.PI * 2); c.fillStyle = hov ? '#ffc65c' : '#0f2f57'; c.fill(); c.stroke();
  });
}

function nodePos(i) {
  const L = S.level, nA = L.anchors.length;
  return i < nA ? L.anchors[i] : S.design.nodes[i - nA];
}
function memberStrokeBP(c, x1, y1, x2, y2, mat, s, alpha = 1, color) {
  c.globalAlpha = alpha;
  const col = color || BP[mat];
  if (mat === 'road') {
    const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1;
    const hw = Math.max(3, .13 * s), nx = -dy / d * hw, ny = dx / d * hw;
    c.fillStyle = color ? color : 'rgba(234,243,255,.14)';
    if (color) c.globalAlpha = alpha * .35;
    c.beginPath(); c.moveTo(x1 + nx, y1 + ny); c.lineTo(x2 + nx, y2 + ny); c.lineTo(x2 - nx, y2 - ny); c.lineTo(x1 - nx, y1 - ny); c.closePath(); c.fill();
    c.globalAlpha = alpha;
    c.strokeStyle = col; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x1 + nx, y1 + ny); c.lineTo(x2 + nx, y2 + ny); c.moveTo(x1 - nx, y1 - ny); c.lineTo(x2 - nx, y2 - ny); c.stroke();
  } else if (mat === 'steel') {
    c.strokeStyle = col; c.lineWidth = 4.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    c.strokeStyle = '#0f2f57'; c.lineWidth = 1.1;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  } else if (mat === 'wood') {
    c.strokeStyle = col; c.lineWidth = 2.4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  } else {
    c.strokeStyle = col; c.lineWidth = 1.6; c.setLineDash([7, 4]); c.lineCap = 'butt';
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.setLineDash([]);
  }
  c.globalAlpha = 1; c.lineCap = 'butt';
}
function labelBox(c, text, x, y, opts = {}) {
  c.font = opts.font || '600 11px "IBM Plex Mono", ui-monospace, monospace';
  const w = c.measureText(text).width + 12, h = 20;
  let bx = x - w / 2, by = y - h / 2;
  bx = clamp(bx, 6, S.view.W - w - 6); by = clamp(by, 6, S.view.H - h - 6);
  c.fillStyle = opts.bg || 'rgba(8,29,56,.92)'; c.fillRect(bx, by, w, h);
  if (opts.border !== false) { c.strokeStyle = opts.borderColor || 'rgba(234,243,255,.5)'; c.lineWidth = 1; c.strokeRect(bx + .5, by + .5, w - 1, h - 1); }
  c.fillStyle = opts.color || '#eaf3ff'; c.textAlign = 'left'; c.fillText(text, bx + 6, by + 14);
}

function renderBuild(t) {
  const v = S.view, c = v.ctx, L = S.level, D = S.design;
  c.drawImage(S.bgBlue, 0, 0, W, H);
  // members
  D.members.forEach((m, k) => {
    const a = nodePos(m[0]), b = nodePos(m[1]);
    let x1 = v.X(a[0]), y1 = v.Y(a[1]), x2 = v.X(b[0]), y2 = v.Y(b[1]);
    if (S.lastAdded && S.lastAdded.k === k) {
      const p = clamp((t - S.lastAdded.t) / .16, 0, 1);
      x2 = lerp(x1, x2, ease(p)); y2 = lerp(y1, y2, ease(p));
    }
    const hov = S.hoverMember === k && !S.drag;
    const erase = hov && S.tool === 'erase';
    memberStrokeBP(c, x1, y1, x2, y2, m[2], v.s, 1, erase ? '#ff7a6b' : hov ? '#ffffff' : null);
  });
  // joints
  const nA = L.anchors.length;
  D.nodes.forEach((n, i) => {
    const x = v.X(n[0]), y = v.Y(n[1]);
    const hov = S.hoverNode === i + nA;
    c.beginPath(); c.arc(x, y, hov ? 6.5 : 4.2, 0, Math.PI * 2);
    c.fillStyle = hov ? (S.tool === 'erase' ? '#ff7a6b' : '#ffc65c') : '#0f2f57'; c.fill();
    c.strokeStyle = '#eaf3ff'; c.lineWidth = 1.5; c.stroke();
  });
  drawAnchorsBP(v, L, t);
  // drag ghost
  if (S.drag) {
    const a = nodePos(S.drag.from), mat = MATERIALS[S.tool];
    const ax = v.X(a[0]), ay = v.Y(a[1]);
    c.strokeStyle = 'rgba(234,243,255,.22)'; c.setLineDash([3, 5]); c.lineWidth = 1;
    c.beginPath(); c.arc(ax, ay, mat.maxLen * v.s, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    const tgt = S.drag.target;
    if (tgt) {
      const bx = v.X(tgt.x), by = v.Y(tgt.y);
      memberStrokeBP(c, ax, ay, bx, by, S.tool, v.s, tgt.ok ? .95 : .45);
      c.beginPath(); c.arc(bx, by, 5, 0, Math.PI * 2); c.strokeStyle = tgt.ok ? '#ffc65c' : '#ff7a6b'; c.lineWidth = 1.6; c.stroke();
      const len = Math.hypot(tgt.x - a[0], tgt.y - a[1]);
      const cost = MATERIALS[S.tool].cost * len;
      labelBox(c, `${mm(len)} · ${ugxShort(cost)}${tgt.clamped ? ' · MAX' : ''}`, (ax + bx) / 2, (ay + by) / 2 - 18, { borderColor: tgt.ok ? 'rgba(255,198,92,.7)' : 'rgba(255,122,107,.8)' });
    }
  } else if (S.pointer.inside) {
    // hover info
    if (S.hoverMember >= 0) {
      const m = D.members[S.hoverMember], a = nodePos(m[0]), b = nodePos(m[1]);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const mat = MATERIALS[m[2]];
      const txt = S.tool === 'erase' ? `Click to remove ${mat.short.toLowerCase()}` : `${mat.name.toUpperCase()} · ${mm(len)} mm · ${ugxShort(mat.cost * len)}`;
      labelBox(c, txt, S.pointer.x, S.pointer.y - 26);
    } else if (S.tool !== 'erase' && S.hoverNode < 0) {
      // snapped crosshair
      const gx = Math.round(S.pointer.wx * 2) / 2, gy = Math.round(S.pointer.wy * 2) / 2;
      const x = v.X(gx), y = v.Y(gy);
      c.strokeStyle = 'rgba(234,243,255,.35)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x + 6, y); c.moveTo(x, y - 6); c.lineTo(x, y + 6); c.stroke();
    }
  }
}

// ======================================================================
// LIVE (REALITY) RENDERING
// ======================================================================
function renderRealBG(v, L, T) {
  const c = v.ctx, w = v.W, h = v.H;
  const horizon = v.Y(1.4);
  const R = Math.min(w, h);
  const sunX = w * .7, sunY = horizon - R * .06;
  S.sun = { x: sunX, y: sunY, horizon };
  // sky
  let g = c.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, '#171032'); g.addColorStop(.3, '#35194a'); g.addColorStop(.56, '#7e3050');
  g.addColorStop(.78, '#d8674a'); g.addColorStop(.92, '#f4a257'); g.addColorStop(1, '#fbcf88');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // stars in the high, dark sky
  const rnd = mulberry32(L.seed * 7 + 3);
  for (let i = 0; i < 90; i++) {
    const y = rnd() * horizon * .42, x = rnd() * w;
    c.fillStyle = `rgba(255,240,230,${(1 - y / (horizon * .42)) * (.25 + rnd() * .6)})`;
    const s = rnd() < .12 ? 1.6 : 1; c.fillRect(x, y, s, s);
  }
  // sun + glow
  g = c.createRadialGradient(sunX, sunY, 0, sunX, sunY, R * .75);
  g.addColorStop(0, 'rgba(255,226,160,.75)'); g.addColorStop(.12, 'rgba(255,190,120,.4)'); g.addColorStop(.4, 'rgba(240,120,80,.12)'); g.addColorStop(1, 'rgba(240,120,80,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  g = c.createRadialGradient(sunX, sunY - R * .01, 0, sunX, sunY, R * .05);
  g.addColorStop(0, '#fffaf0'); g.addColorStop(.7, '#ffe3a3'); g.addColorStop(1, '#ffc671');
  c.fillStyle = g; c.beginPath(); c.arc(sunX, sunY, R * .05, 0, Math.PI * 2); c.fill();
  // cloud streaks lit from below
  for (let i = 0; i < 9; i++) {
    const cy = horizon - h * (.06 + rnd() * .34), cx = rnd() * w, cw = w * (.12 + rnd() * .28), ch = 2 + rnd() * 6;
    const near = 1 - Math.min(1, Math.abs(cx - sunX) / (w * .6));
    const col = near > .5 ? [255, 196, 150] : [214, 120, 150];
    g = c.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0);
    g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(.5, `rgba(${col},${.25 + near * .35})`); g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g; c.beginPath(); c.ellipse(cx, cy, cw / 2, ch, 0, 0, Math.PI * 2); c.fill();
  }
  // distant hills, three layers of haze
  const layers = [
    { base: horizon + h * .01, amp: h * .11, col: '#b0607a', haze: 'rgba(250,176,128,.55)', sc: 240, trees: 0 },
    { base: horizon + h * .035, amp: h * .075, col: '#7a3761', haze: 'rgba(235,128,104,.38)', sc: 170, trees: 7 },
    { base: horizon + h * .07, amp: h * .05, col: '#4b2148', haze: 'rgba(210,96,96,.26)', sc: 120, trees: 12 },
  ];
  layers.forEach((ly, li) => {
    const seed = L.seed * 13 + li * 101;
    const ridge = x => ly.base - ly.amp * (.35 + fbm(seed, x / ly.sc) * .9);
    c.beginPath(); c.moveTo(0, h);
    for (let x = 0; x <= w + 4; x += 4) c.lineTo(x, ridge(x));
    c.lineTo(w, h); c.closePath();
    c.fillStyle = ly.col; c.fill();
    const hg = c.createLinearGradient(0, ly.base - ly.amp, 0, ly.base + h * .12);
    hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(1, ly.haze);
    c.fillStyle = hg; c.fill();
    for (let i = 0; i < ly.trees; i++) {
      const x = hash(seed, i * 7) * w, s = h * (.012 + li * .006) * (.7 + hash(seed, i * 7 + 1) * .6);
      acacia(c, x, ridge(x) + 2, s, ly.col === '#4b2148' ? '#3a1839' : '#5f2a53', seed + i);
    }
  });
  // far gorge wall between the banks
  const farTop = v.Y(-.6);
  c.beginPath(); c.moveTo(0, h);
  for (let x = 0; x <= w + 4; x += 5) c.lineTo(x, farTop - fbm(L.seed + 5, x / 60) * v.s * 1.2);
  c.lineTo(w, h); c.closePath();
  g = c.createLinearGradient(0, farTop - v.s, 0, v.Y(L.waterY));
  g.addColorStop(0, '#7b3440'); g.addColorStop(1, '#3a1a2c');
  c.fillStyle = g; c.fill();
  c.save(); c.clip();
  c.strokeStyle = 'rgba(40,10,30,.25)'; c.lineWidth = 1;
  for (let y = farTop; y < h; y += Math.max(5, v.s * .55)) {
    c.beginPath(); for (let x = 0; x <= w; x += 8) c.lineTo(x, y + (fbm(L.seed + y, x / 40) - .5) * 5); c.stroke();
  }
  g = c.createLinearGradient(0, farTop, 0, h); g.addColorStop(0, 'rgba(240,140,110,.22)'); g.addColorStop(1, 'rgba(60,30,70,.2)');
  c.fillStyle = g; c.fillRect(0, farTop - v.s * 2, w, h);
  c.restore();

  // terrain: laterite cliffs, rock pillars and spires
  for (const p of T.polys) drawRock(v, L, p);
  // trees and grass on the banks
  const hR = L.hR || 0;
  const trees = [[-6.2, 0, 4.6], [-11.5, 0, 3.6], [-15, 0, 4.2], [L.gap + 6.8, hR, 4.1], [L.gap + 11.8, hR, 4.8]];
  trees.forEach(([x, y, hh], i) => acacia(c, v.X(x), v.Y(y) - v.s * .12, hh * v.s, '#26122a', L.seed + i * 5, true));
  for (let i = 0; i < 60; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side < 0 ? -1 - hash(L.seed, i) * 16 : L.gap + 1 + hash(L.seed, i) * 16;
    const y = side < 0 ? 0 : hR;
    const px = v.X(x), py = v.Y(y) - v.s * .12;
    c.strokeStyle = i % 3 ? '#3a3a1c' : '#5a4a22'; c.lineWidth = 1;
    for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(px + k * 1.5, py); c.lineTo(px + k * 2.6, py - (3 + hash(L.seed, i * 9 + k) * 5)); c.stroke(); }
  }
  // abutments and anchor hardware
  drawAnchorsReal(v, L);
}

function drawRock(v, L, p) {
  const c = v.ctx;
  let top = Infinity, bot = -Infinity, minx = Infinity, maxx = -Infinity;
  for (const q of p.pts) { top = Math.min(top, v.Y(q[1])); bot = Math.max(bot, v.Y(q[1])); minx = Math.min(minx, v.X(q[0])); maxx = Math.max(maxx, v.X(q[0])); }
  minx = Math.max(minx, -10); maxx = Math.min(maxx, v.W + 10);
  path(c, p.pts, v);
  const g = c.createLinearGradient(0, top, 0, bot);
  if (p.kind === 'spire') { g.addColorStop(0, '#8e3a2a'); g.addColorStop(.5, '#5e2320'); g.addColorStop(1, '#331320'); }
  else if (p.kind === 'pillar') { g.addColorStop(0, '#8f3c26'); g.addColorStop(1, '#2e1219'); }
  else { g.addColorStop(0, '#b3522c'); g.addColorStop(.25, '#8e3a22'); g.addColorStop(.7, '#5a2119'); g.addColorStop(1, '#2c0f14'); }
  c.fillStyle = g; c.fill();
  c.save(); c.clip();
  // strata
  const seed = Math.round(minx * 3 + top);
  const step = Math.max(6, v.s * .62);
  for (let y = top + step * .6, i = 0; y < bot; y += step * (.7 + hash(seed, i) * .6), i++) {
    c.beginPath();
    for (let x = minx; x <= maxx; x += 6) c.lineTo(x, y + (fbm(seed + i, x / 50) - .5) * step * .9);
    c.strokeStyle = i % 3 === 0 ? 'rgba(236,140,90,.2)' : 'rgba(45,10,12,.32)';
    c.lineWidth = i % 3 === 0 ? 1.2 : Math.max(1, step * .12); c.stroke();
  }
  // grit
  const rnd = mulberry32(seed);
  for (let i = 0; i < (maxx - minx) * (bot - top) / 260; i++) {
    c.fillStyle = rnd() < .5 ? 'rgba(30,8,10,.28)' : 'rgba(250,170,120,.14)';
    c.fillRect(minx + rnd() * (maxx - minx), top + rnd() * (bot - top), 1 + rnd() * 2, 1 + rnd());
  }
  // the sun sits to the right: faces looking right catch it, faces looking left fall into shadow
  const sunSide = p.pts.reduce((s, q) => s + q[0], 0) / p.pts.length < L.gap / 2;
  const fx = sunSide ? maxx : minx;
  const lg = c.createLinearGradient(fx, 0, fx + (sunSide ? -1 : 1) * v.s * 3.5, 0);
  if (sunSide) { lg.addColorStop(0, 'rgba(255,170,100,.32)'); lg.addColorStop(1, 'rgba(255,170,100,0)'); }
  else { lg.addColorStop(0, 'rgba(25,6,30,.45)'); lg.addColorStop(1, 'rgba(25,6,30,0)'); }
  c.fillStyle = lg; c.fillRect(minx - 10, top - 10, maxx - minx + 20, bot - top + 20);
  // depth: darken toward the water
  const dg = c.createLinearGradient(0, v.Y(L.waterY + 3), 0, v.Y(L.waterY));
  dg.addColorStop(0, 'rgba(20,6,20,0)'); dg.addColorStop(1, 'rgba(20,6,20,.45)');
  c.fillStyle = dg; c.fillRect(minx - 10, v.Y(L.waterY + 3), maxx - minx + 20, v.s * 9);
  c.restore();
  if (p.kind === 'bank') {
    // murram road on top, rim-lit edge
    const tops = p.pts.filter(q => Math.abs(q[1] - (q[0] <= 0 ? 0 : (L.hR || 0))) < 1e-6);
    if (tops.length >= 2) {
      const xa = v.X(Math.min(tops[0][0], tops[1][0])), xb = v.X(Math.max(tops[0][0], tops[1][0])), y = v.Y(tops[0][1]);
      c.fillStyle = '#6f2f1d'; c.fillRect(xa, y, xb - xa, Math.max(3, v.s * .22));
      c.fillStyle = '#c56b3c'; c.fillRect(xa, y, xb - xa, Math.max(2, v.s * .08));
      c.fillStyle = 'rgba(255,214,150,.85)'; c.fillRect(xa, y - 1, xb - xa, 1.5);
    }
  } else {
    // sunlit crest
    c.strokeStyle = 'rgba(255,200,140,.55)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(v.X(p.pts[0][0]), v.Y(p.pts[0][1])); c.lineTo(v.X(p.pts[1][0]), v.Y(p.pts[1][1]));
    if (p.kind === 'spire') { for (let i = 2; i < 4; i++) c.lineTo(v.X(p.pts[i][0]), v.Y(p.pts[i][1])); }
    c.stroke();
  }
}

function acacia(c, x, y, hgt, col, seed, rim) {
  // flat-topped savanna acacia: slim forked trunk, wide layered umbrella canopy
  const r = mulberry32(seed * 977 + 1);
  const lean = (r() - .5) * .25 * hgt;
  c.fillStyle = col; c.strokeStyle = col;
  c.lineCap = 'round';
  const tx = x + lean, ty = y - hgt * .56;
  c.lineWidth = Math.max(1, hgt * .045);
  c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + lean * .2, y - hgt * .3, tx, ty); c.stroke();
  c.lineWidth = Math.max(.8, hgt * .028);
  const branches = [[-.42, -.22], [.38, -.25], [-.12, -.34], [.16, -.3]];
  for (const [bx, by] of branches) {
    c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo(tx + bx * hgt * .4, ty + by * hgt * .3, tx + bx * hgt, ty + by * hgt * .95); c.stroke();
  }
  const cw = hgt * (1.05 + r() * .25), cy = ty - hgt * .3;
  for (let i = 0; i < 7; i++) {
    const ox = (r() - .5) * cw * .9, oy = (r() - .5) * hgt * .08;
    c.beginPath(); c.ellipse(tx + ox, cy + oy, cw * (.22 + r() * .14), hgt * (.06 + r() * .04), 0, 0, Math.PI * 2); c.fill();
  }
  c.beginPath(); c.ellipse(tx, cy + hgt * .02, cw * .5, hgt * .06, 0, 0, Math.PI * 2); c.fill();
  if (rim) {
    c.strokeStyle = 'rgba(255,170,100,.35)'; c.lineWidth = 1;
    c.beginPath(); c.ellipse(tx + cw * .05, cy - hgt * .02, cw * .48, hgt * .07, 0, Math.PI * 1.05, Math.PI * 1.9); c.stroke();
  }
  c.lineCap = 'butt';
}

function drawAnchorsReal(v, L) {
  const c = v.ctx, s = v.s;
  L.anchors.forEach((a, i) => {
    const x = v.X(a[0]), y = v.Y(a[1]);
    const onBankEdge = i < 2;
    const above = a[1] > 1;
    c.save();
    if (onBankEdge) {
      // concrete abutment block under the deck end
      const dir = i === 0 ? -1 : 1;
      const bw = s * 1.3, bh = s * 1.1;
      const bx = dir < 0 ? x - bw + s * .12 : x - s * .12;
      const g = c.createLinearGradient(0, y, 0, y + bh);
      g.addColorStop(0, '#b8b1a6'); g.addColorStop(1, '#6d665f');
      c.fillStyle = g; c.fillRect(bx, y + s * .05, bw, bh);
      c.fillStyle = 'rgba(255,220,170,.5)'; c.fillRect(bx, y + s * .05, bw, 1.5);
      c.strokeStyle = 'rgba(40,30,30,.35)'; c.lineWidth = 1; c.strokeRect(bx + .5, y + s * .05 + .5, bw - 1, bh - 1);
    } else if (above) {
      // steel saddle on a rock tower
      c.fillStyle = '#4b4f58'; c.fillRect(x - s * .35, y - s * .05, s * .7, s * .35);
      c.fillStyle = 'rgba(255,210,150,.6)'; c.fillRect(x - s * .35, y - s * .05, s * .7, 1.5);
    } else {
      // anchor plate bolted into rock
      c.fillStyle = '#8f8a84'; c.fillRect(x - s * .3, y - s * .3, s * .6, s * .6);
      c.fillStyle = '#3d3a38';
      for (const [ox, oy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { c.beginPath(); c.arc(x + ox * s * .19, y + oy * s * .19, Math.max(1, s * .04), 0, Math.PI * 2); c.fill(); }
    }
    c.restore();
  });
}

function renderVignette(c) {
  const g = c.createRadialGradient(W / 2, H * .45, Math.min(W, H) * .35, W / 2, H * .5, Math.max(W, H) * .78);
  g.addColorStop(0, 'rgba(10,4,20,0)'); g.addColorStop(1, 'rgba(10,4,20,.5)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}

function drawWater(v, L, t) {
  const c = v.ctx, yS = v.Y(L.waterY), h = v.H, w = v.W;
  if (yS > h) return;
  let g = c.createLinearGradient(0, yS, 0, h);
  g.addColorStop(0, 'rgba(92,70,104,.93)'); g.addColorStop(.12, 'rgba(44,52,86,.95)'); g.addColorStop(1, 'rgba(12,18,38,.98)');
  c.fillStyle = g; c.fillRect(0, yS, w, h - yS);
  // sky reflection
  g = c.createLinearGradient(0, yS, 0, yS + v.s * 2.4);
  g.addColorStop(0, 'rgba(250,150,100,.35)'); g.addColorStop(1, 'rgba(250,150,100,0)');
  c.fillStyle = g; c.fillRect(0, yS, w, v.s * 2.4);
  // sun glint column
  const sx = S.sun.x;
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 38; i++) {
    const yy = yS + 2 + Math.pow(i, 1.35) * 1.6;
    if (yy > h) break;
    const flick = .5 + .5 * Math.sin(t * 2.3 + i * 1.7) * Math.sin(t * 1.1 + i * .6);
    const ww = (w * .02 + hash(7, i) * w * .06) * (1 - i / 50) * (.5 + flick * .7);
    const off = (hash(3, i) - .5) * w * .04 + Math.sin(t * .8 + i) * 4;
    c.fillStyle = `rgba(255,${190 + i},${130 + i},${.08 + flick * .22 * (1 - i / 40)})`;
    c.fillRect(sx - ww / 2 + off, yy, ww, 1.4 + i * .04);
  }
  c.globalCompositeOperation = 'source-over';
  // ripples
  c.strokeStyle = 'rgba(255,200,170,.13)'; c.lineWidth = 1;
  for (let row = 0; row < 7; row++) {
    const yy = yS + 6 + row * row * 3.2 + row * 4;
    if (yy > h) break;
    const drift = (t * (8 + row * 3)) % 90;
    c.beginPath();
    for (let x = -90 + drift + hash(row, 1) * 60; x < w; x += 70 + row * 12) { c.moveTo(x, yy); c.lineTo(x + 14 + row * 3, yy); }
    c.stroke();
  }
  // surface line + foam where rock meets water
  c.fillStyle = 'rgba(255,215,180,.55)'; c.fillRect(0, yS, w, 1.2);
  for (const p of S.terrain.polys) {
    if (p.kind === 'spire') continue;
    const n = p.pts.length;
    for (let i = 0; i < n; i++) {
      const a = p.pts[i], b = p.pts[(i + 1) % n];
      if ((a[1] - L.waterY) * (b[1] - L.waterY) < 0) {
        const x = a[0] + (b[0] - a[0]) * (L.waterY - a[1]) / (b[1] - a[1]);
        const px = v.X(x);
        for (let k = 0; k < 5; k++) {
          const ph = t * 2 + k * 1.3 + x;
          const fw = v.s * (.3 + .25 * Math.sin(ph));
          c.fillStyle = `rgba(255,240,225,${.28 + .18 * Math.sin(ph * 1.3)})`;
          c.fillRect(px - fw / 2 + Math.sin(ph) * v.s * .3, yS - 1 + k * 2.4, fw, 1.4);
        }
      }
    }
  }
}

function drawBirds(v, t) {
  const c = v.ctx;
  c.strokeStyle = 'rgba(40,16,40,.75)'; c.lineWidth = 1.3; c.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const sp = 14 + hash(11, i) * 16;
    const x = ((hash(5, i) * v.W + t * sp) % (v.W + 120)) - 60;
    const y = S.sun.horizon * (.25 + hash(9, i) * .45) + Math.sin(t * .7 + i) * 6;
    const f = Math.sin(t * 7 + i * 2), sz = 4 + hash(2, i) * 3;
    c.beginPath(); c.moveTo(x - sz, y - f * sz * .6); c.quadraticCurveTo(x - sz * .4, y - sz * .4, x, y); c.quadraticCurveTo(x + sz * .4, y - sz * .4, x + sz, y - f * sz * .6); c.stroke();
  }
  c.lineCap = 'butt';
}

function heatColor(base, u) {
  const k = clamp((u - .4) / .6, 0, 1);
  if (k <= 0) return base;
  if (k < .55) return mix(base, '#ffb347', k / .55);
  return mix('#ffb347', '#ff3d1f', (k - .55) / .45);
}
function forceColor(f, u) {
  const k = clamp(u, 0, 1);
  return f >= 0 ? mix('#8b8f99', '#ff5a4f', .25 + .75 * k) : mix('#8b8f99', '#4fa8ff', .25 + .75 * k);
}

function drawMembersReal(v, sim, t, hoverId) {
  const c = v.ctx, P = sim.P, s = v.s;
  const order = { cable: 0, wood: 1, steel: 2, road: 3 };
  const list = sim.members.filter(m => !m.broken || m.stub).sort((a, b) => order[a.mat] - order[b.mat]);
  c.lineCap = 'round';
  for (const m of list) {
    const a = P[m.a], b = P[m.b];
    const x1 = v.X(a.x), y1 = v.Y(a.y), x2 = v.X(b.x), y2 = v.Y(b.y);
    const u = m.stub ? 0 : m.util;
    let col = m.stub ? mix(REAL[m.mat], '#1a1216', .3) : S.forces ? forceColor(m.ff, u) : heatColor(REAL[m.mat], u);
    const hot = !m.stub && !S.forces && u > .72;
    if (hot) { c.shadowColor = `rgba(255,${Math.round(120 - u * 60)},40,.95)`; c.shadowBlur = (8 + 10 * (u - .72) / .28) * (0.8 + .2 * Math.sin(t * 20 + m.id)); }
    if (m.mat === 'road') {
      c.lineCap = 'butt';
      c.strokeStyle = col; c.lineWidth = Math.max(3, s * .3);
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      c.shadowBlur = 0;
      // top surface line and a guard rail
      const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1;
      const nx = dy / d, ny = -dx / d; // screen normal pointing up for left-to-right members
      const sg = dx >= 0 ? 1 : -1;
      const off = Math.max(1.5, s * .13) * sg;
      c.strokeStyle = S.forces ? 'rgba(255,255,255,.25)' : 'rgba(170,176,190,.8)'; c.lineWidth = Math.max(1, s * .04);
      c.beginPath(); c.moveTo(x1 + nx * off, y1 + ny * off); c.lineTo(x2 + nx * off, y2 + ny * off); c.stroke();
      if (!m.stub) {
        const ro = s * .62 * sg;
        c.strokeStyle = 'rgba(215,205,195,.32)'; c.lineWidth = Math.max(1, s * .03);
        c.beginPath(); c.moveTo(x1 + nx * ro, y1 + ny * ro); c.lineTo(x2 + nx * ro, y2 + ny * ro);
        const posts = Math.max(1, Math.round(d / (s * .7)));
        for (let k = 0; k <= posts; k++) { const px = lerp(x1, x2, k / posts), py = lerp(y1, y2, k / posts); c.moveTo(px + nx * off, py + ny * off); c.lineTo(px + nx * ro, py + ny * ro); }
        c.stroke();
      }
      c.lineCap = 'round';
    } else if (m.mat === 'wood') {
      c.strokeStyle = col; c.lineWidth = Math.max(3, s * .22);
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      c.shadowBlur = 0;
      c.strokeStyle = S.forces ? 'rgba(255,255,255,.18)' : 'rgba(255,215,160,.35)'; c.lineWidth = Math.max(1, s * .05);
      c.beginPath(); c.moveTo(x1, y1 - 1); c.lineTo(x2, y2 - 1); c.stroke();
    } else if (m.mat === 'steel') {
      c.strokeStyle = col; c.lineWidth = Math.max(3.5, s * .26);
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      c.shadowBlur = 0;
      c.strokeStyle = 'rgba(15,20,30,.55)'; c.lineWidth = Math.max(1, s * .08);
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      c.strokeStyle = 'rgba(210,225,245,.45)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x1, y1 - s * .09); c.lineTo(x2, y2 - s * .09); c.stroke();
    } else {
      c.strokeStyle = S.forces || u > .4 ? col : '#1d1f26'; c.lineWidth = Math.max(1.4, s * .05);
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    }
    c.shadowBlur = 0;
    if (m.id === hoverId) {
      c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1; c.setLineDash([4, 3]);
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.setLineDash([]);
    }
  }
  c.lineCap = 'butt';
  // joints: bolted gusset plates
  const used = new Set();
  for (const m of sim.members) if (!m.broken) { used.add(m.a); used.add(m.b); }
  const r = Math.max(2.4, s * .15);
  for (const i of used) {
    if (i < sim.nA) continue;
    const p = P[i], x = v.X(p.x), y = v.Y(p.y);
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = '#c3c7cf'; c.fill();
    c.strokeStyle = '#2d3038'; c.lineWidth = 1; c.stroke();
    c.beginPath(); c.arc(x, y, r * .35, 0, Math.PI * 2); c.fillStyle = '#50545e'; c.fill();
  }
  for (let i = 0; i < sim.nA; i++) {
    const p = P[i], x = v.X(p.x), y = v.Y(p.y);
    c.beginPath(); c.arc(x, y, r * 1.15, 0, Math.PI * 2); c.fillStyle = '#e1a53c'; c.fill();
    c.strokeStyle = '#3b2a12'; c.lineWidth = 1; c.stroke();
  }
}

// ---------------------------------------------------------------- vehicles
function vehicleOutline(c, V) {
  c.beginPath();
  const k = V.key;
  if (k === 'car') {
    c.moveTo(-.8, .02); c.lineTo(-.86, .5); c.quadraticCurveTo(-.84, .66, -.55, .68); c.lineTo(.3, .74);
    c.lineTo(.72, 1.18); c.quadraticCurveTo(.8, 1.24, 1.0, 1.24); c.lineTo(1.78, 1.24); c.quadraticCurveTo(1.92, 1.23, 2.0, 1.15);
    c.lineTo(2.42, .78); c.lineTo(3.12, .66); c.quadraticCurveTo(3.34, .6, 3.32, .36); c.lineTo(3.3, .02); c.closePath();
  } else if (k === 'van') {
    c.moveTo(-.7, .05); c.lineTo(-.72, 1.9); c.quadraticCurveTo(-.7, 2.0, -.55, 2.0); c.lineTo(2.55, 2.0);
    c.quadraticCurveTo(2.7, 2.0, 2.8, 1.88); c.lineTo(3.4, 1.12); c.lineTo(3.78, .95); c.lineTo(3.8, .05); c.closePath();
  } else if (k === 'matatu') {
    c.moveTo(-.9, .05); c.lineTo(-.92, 1.84); c.quadraticCurveTo(-.9, 1.98, -.72, 1.98); c.lineTo(2.78, 1.98);
    c.quadraticCurveTo(2.92, 1.98, 3.0, 1.86); c.lineTo(3.42, 1.18); c.quadraticCurveTo(3.6, 1.08, 3.6, .9); c.lineTo(3.6, .05); c.closePath();
  } else {
    // truck: cab outline plus bed
    c.moveTo(-.9, .35); c.lineTo(-.9, 1.95); c.lineTo(3.85, 1.95); c.lineTo(3.9, 2.62); c.lineTo(5.15, 2.62);
    c.quadraticCurveTo(5.3, 2.6, 5.38, 2.45); c.lineTo(5.78, 1.65); c.lineTo(5.8, .3); c.closePath();
  }
}

function drawVehicle(v, sim, t) {
  const c = v.ctx, V = sim.veh, D = V.def, P = sim.P;
  const w0 = P[V.wheels[0]], w1 = P[V.wheels[V.wheels.length - 1]];
  const ang = Math.atan2(w1.y - w0.y, w1.x - w0.x);
  // body tilt from suspension: use roof corners relative to the axle line
  const b0 = P[V.body[0]], b1 = P[V.body[1]];
  const bang = Math.atan2(b1.y - b0.y, b1.x - b0.x);
  c.save();
  c.translate(v.X(w0.x), v.Y(w0.y));
  c.scale(v.s, -v.s);
  c.rotate(ang);
  // headlight cone (additive)
  const fx = D.wheels[D.wheels.length - 1] + D.front;
  const hy = D.key === 'car' ? .5 : D.key === 'truck' ? .75 : .7;
  c.save();
  c.globalCompositeOperation = 'lighter';
  const cg = c.createLinearGradient(fx, 0, fx + 7, 0);
  cg.addColorStop(0, 'rgba(255,225,160,.34)'); cg.addColorStop(1, 'rgba(255,225,160,0)');
  c.fillStyle = cg; c.beginPath(); c.moveTo(fx, hy + .12); c.lineTo(fx + 7.5, hy + .9); c.lineTo(fx + 7.5, hy - 1.4); c.lineTo(fx, hy - .12); c.closePath(); c.fill();
  c.restore();
  // body, with a touch of suspension pitch around the axle line
  c.save();
  c.rotate(clamp(bang - ang, -.08, .08));
  c.translate(0, .02);
  const k = D.key;
  if (k === 'car') drawCar(c);
  else if (k === 'van') drawVan(c);
  else if (k === 'matatu') drawMatatu(c, t);
  else drawTruck(c);
  // lights
  c.fillStyle = '#fff1c2'; c.beginPath(); c.ellipse(fx - .06, hy, .08, .1, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ff3b2f'; c.fillRect(D.wheels[0] - D.rear - .02, hy - .05, .08, .2);
  c.restore();
  // wheels
  D.wheels.forEach((dx, i) => {
    const wp = P[V.wheels[i]];
    // position each wheel from its own particle (suspension travel)
    const lx = (wp.x - w0.x) * Math.cos(ang) + (wp.y - w0.y) * Math.sin(ang);
    const ly = -(wp.x - w0.x) * Math.sin(ang) + (wp.y - w0.y) * Math.cos(ang);
    wheel(c, lx, ly, D.r, V.roll[i]);
  });
  c.restore();
}
function shade(c, x0, y0, x1, y1, a) { // soft bottom-to-top shading inside the current path
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, `rgba(20,10,20,${a})`); g.addColorStop(.5, 'rgba(20,10,20,0)'); g.addColorStop(1, 'rgba(255,230,200,.12)');
  c.fillStyle = g; c.fill();
}
function drawCar(c) {
  vehicleOutline(c, VEHICLES.car);
  c.fillStyle = '#d9483f'; c.fill(); shade(c, 0, 0, 0, 1.25, .45);
  c.fillStyle = '#26202c';
  c.beginPath(); c.moveTo(.52, .78); c.lineTo(.84, 1.13); c.lineTo(1.3, 1.14); c.lineTo(1.3, .79); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(1.4, .79); c.lineTo(1.4, 1.14); c.lineTo(1.84, 1.13); c.lineTo(2.2, .8); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,200,150,.25)'; c.beginPath(); c.moveTo(1.5, 1.1); c.lineTo(1.7, 1.1); c.lineTo(1.5, .85); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = .025; c.beginPath(); c.moveTo(1.35, .1); c.lineTo(1.35, .76); c.stroke();
  c.fillStyle = 'rgba(255,220,190,.35)'; c.fillRect(-.8, .5, 4.1, .03);
  arches(c, VEHICLES.car);
}
function drawVan(c) {
  vehicleOutline(c, VEHICLES.van);
  c.fillStyle = '#2d8a96'; c.fill(); shade(c, 0, 0, 0, 2, .45);
  c.fillStyle = '#f2e9d8'; c.fillRect(-.7, .78, 3.95, .16);
  c.fillStyle = '#e0a526'; c.fillRect(-.7, .72, 3.95, .05);
  c.fillStyle = '#231d29'; c.beginPath(); c.moveTo(2.72, 1.12); c.lineTo(2.72, 1.8); c.lineTo(2.78, 1.84); c.lineTo(3.3, 1.14); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = .025; c.beginPath(); c.moveTo(2.6, .1); c.lineTo(2.6, 1.95); c.moveTo(1.2, .1); c.lineTo(1.2, 1.95); c.stroke();
  arches(c, VEHICLES.van);
}
function drawMatatu(c, t) {
  const V = VEHICLES.matatu;
  // roof rack with luggage
  c.fillStyle = '#2b2530'; c.fillRect(-.6, 1.98, 3.2, .06);
  const bags = [['#c0392b', -.5, .7, .34], ['#f1c40f', .25, .55, .28], ['#2e86de', .85, .8, .4], ['#27ae60', 1.7, .6, .3], ['#8e44ad', 2.25, .35, .25]];
  for (const [col, x, w, h] of bags) { c.fillStyle = col; c.fillRect(x, 2.04, w, h); c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(x, 2.04, w, .05); }
  c.strokeStyle = '#2b2530'; c.lineWidth = .03; c.beginPath(); c.moveTo(-.6, 2.02); c.lineTo(-.6, 2.4); c.moveTo(2.6, 2.02); c.lineTo(2.6, 2.4); c.stroke();
  vehicleOutline(c, V);
  c.fillStyle = '#f1eee6'; c.fill(); shade(c, 0, 0, 0, 2, .35);
  // side windows
  c.fillStyle = '#28232e';
  const wins = [[-.7, .72], [.1, .72], [.9, .72], [1.7, .5]];
  for (const [x, w] of wins) c.fillRect(x, 1.25, w, .58);
  c.beginPath(); c.moveTo(2.35, 1.25); c.lineTo(2.35, 1.83); c.lineTo(2.9, 1.83); c.lineTo(3.36, 1.2); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,190,140,.18)'; c.fillRect(-.7, 1.62, 2.9, .06);
  // the blue-and-white check band of a Ugandan taxi
  const sq = .13;
  for (let i = 0; i * sq < 4.4; i++) for (let j = 0; j < 2; j++) {
    c.fillStyle = (i + j) % 2 ? '#1f4fb4' : '#f1eee6';
    const x = -.9 + i * sq; if (x + sq > 3.58) continue;
    c.fillRect(x, .86 + j * sq, sq, sq);
  }
  c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = .025; c.beginPath(); c.moveTo(.95, .1); c.lineTo(.95, 1.9); c.stroke();
  arches(c, V);
}
function drawTruck(c) {
  const V = VEHICLES.truck;
  // chassis rail
  c.fillStyle = '#26232a'; c.fillRect(-.9, .3, 6.6, .25);
  // tipper bed with a heap of murram
  c.fillStyle = '#b4532e'; c.beginPath(); c.moveTo(-.75, 1.9); c.quadraticCurveTo(.4, 2.9, 1.5, 2.75); c.quadraticCurveTo(2.7, 2.65, 3.7, 1.9); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,190,130,.25)'; c.beginPath(); c.moveTo(-.4, 2.05); c.quadraticCurveTo(.5, 2.8, 1.4, 2.68); c.lineTo(1.3, 2.6); c.quadraticCurveTo(.5, 2.62, -.4, 2.05); c.fill();
  c.beginPath(); c.moveTo(-.9, .55); c.lineTo(-.9, 1.95); c.lineTo(3.8, 1.95); c.lineTo(3.8, .55); c.closePath();
  c.fillStyle = '#5b4a45'; c.fill(); shade(c, 0, .55, 0, 1.95, .4);
  c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = .04;
  for (let x = -.3; x < 3.8; x += .75) { c.beginPath(); c.moveTo(x, .6); c.lineTo(x, 1.9); c.stroke(); }
  // cab
  c.beginPath(); c.moveTo(3.95, .3); c.lineTo(3.95, 2.62); c.lineTo(5.15, 2.62); c.quadraticCurveTo(5.3, 2.6, 5.38, 2.45); c.lineTo(5.78, 1.65); c.lineTo(5.8, .3); c.closePath();
  c.fillStyle = '#e3a52a'; c.fill(); shade(c, 0, .3, 0, 2.62, .4);
  c.fillStyle = '#231d29'; c.beginPath(); c.moveTo(4.55, 1.7); c.lineTo(4.55, 2.45); c.lineTo(5.12, 2.45); c.lineTo(5.5, 1.7); c.closePath(); c.fill();
  c.fillStyle = '#2b2530'; c.fillRect(5.62, .35, .2, .6);
  arches(c, V);
}
function arches(c, V) {
  c.fillStyle = 'rgba(15,10,15,.85)';
  for (const dx of V.wheels) { c.beginPath(); c.arc(dx, 0, V.r * 1.14, 0, Math.PI); c.fill(); }
}
function wheel(c, x, y, r, roll) {
  c.save(); c.translate(x, y);
  c.fillStyle = '#141318'; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#8f96a0'; c.beginPath(); c.arc(0, 0, r * .56, 0, Math.PI * 2); c.fill();
  c.rotate(roll);
  c.strokeStyle = '#4c515b'; c.lineWidth = r * .1;
  for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * r * .5, Math.sin(a) * r * .5); c.stroke(); }
  c.fillStyle = '#d8dce2'; c.beginPath(); c.arc(0, 0, r * .14, 0, Math.PI * 2); c.fill();
  c.restore();
}

// ---------------------------------------------------------------- particles
function spawn(o) { if (S.particles.length < 900) S.particles.push(o); }
function burst(e) {
  const n = { wood: 16, steel: 22, road: 14, cable: 8 }[e.mat] || 10;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 6;
    const base = { x: e.x, y: e.y, vx: e.vx + Math.cos(a) * sp, vy: e.vy + Math.sin(a) * sp + 2, life: 0, rot: Math.random() * 6, vr: (Math.random() - .5) * 20 };
    if (e.mat === 'steel' || e.mat === 'cable') spawn(Object.assign(base, { type: 'spark', max: .35 + Math.random() * .4, g: 4, vx: base.vx * 1.6, vy: base.vy * 1.6 }));
    else if (e.mat === 'wood') spawn(Object.assign(base, { type: 'chip', max: 1.6 + Math.random(), g: 9.8, col: Math.random() < .5 ? '#c68a4c' : '#8a5a2c', sz: .08 + Math.random() * .14 }));
    else spawn(Object.assign(base, { type: 'chip', max: 1.8, g: 9.8, col: Math.random() < .5 ? '#6b707b' : '#3a3f49', sz: .1 + Math.random() * .18 }));
  }
  for (let i = 0; i < 8; i++) spawn({ type: 'dust', x: e.x, y: e.y, vx: (Math.random() - .5) * 2, vy: Math.random() * 1.2, life: 0, max: 1.4 + Math.random(), g: -.3, sz: .3 + Math.random() * .5 });
  S.flashes.push({ x: e.x, y: e.y, t: 0 });
}
function splash(x, y, v) {
  for (let i = 0; i < 70; i++) {
    const a = Math.PI / 2 + (Math.random() - .5) * 1.6, sp = 3 + Math.random() * (5 + v * .6);
    spawn({ type: 'drop', x: x + (Math.random() - .5) * 3, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 1.4, g: 9.8, sz: .05 + Math.random() * .08 });
  }
  for (let i = 0; i < 10; i++) spawn({ type: 'mist', x: x + (Math.random() - .5) * 4, y: y + .3, vx: (Math.random() - .5), vy: .4 + Math.random() * .6, life: 0, max: 2.4, g: -.1, sz: .8 + Math.random() });
}
function updateParticles(dt) {
  const L = S.level;
  for (const p of S.particles) {
    p.life += dt; p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += (p.vr || 0) * dt;
    if (p.type === 'drop' && p.y < L.waterY && p.vy < 0) p.life = p.max;
    if (p.type === 'chip' && p.y < L.waterY) { p.vx *= .9; p.vy = Math.max(p.vy, -.4); }
  }
  S.particles = S.particles.filter(p => p.life < p.max);
  for (const f of S.flashes) f.t += dt;
  S.flashes = S.flashes.filter(f => f.t < .35);
}
function drawParticles(v) {
  const c = v.ctx;
  for (const p of S.particles) {
    const k = 1 - p.life / p.max, x = v.X(p.x), y = v.Y(p.y);
    if (p.type === 'spark') {
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = `rgba(255,${180 + 60 * k},${90 * k},${k})`; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - p.vx * v.s * .02, y + p.vy * v.s * .02); c.stroke();
      c.globalCompositeOperation = 'source-over';
    } else if (p.type === 'chip') {
      c.save(); c.translate(x, y); c.rotate(p.rot); c.globalAlpha = Math.min(1, k * 2);
      c.fillStyle = p.col; const s = p.sz * v.s; c.fillRect(-s, -s * .3, s * 2, s * .6); c.restore(); c.globalAlpha = 1;
    } else if (p.type === 'drop') {
      c.fillStyle = `rgba(230,236,255,${.8 * k})`; c.beginPath(); c.arc(x, y, Math.max(1, p.sz * v.s), 0, Math.PI * 2); c.fill();
    } else {
      const r = (p.sz + (1 - k) * .55) * v.s;
      c.fillStyle = p.type === 'mist' ? `rgba(240,225,230,${.18 * k})` : `rgba(190,120,90,${.22 * k})`;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
  }
  for (const f of S.flashes) {
    const k = 1 - f.t / .35;
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(v.X(f.x), v.Y(f.y), 0, v.X(f.x), v.Y(f.y), v.s * (1 + f.t * 6));
    g.addColorStop(0, `rgba(255,230,190,${.9 * k})`); g.addColorStop(1, 'rgba(255,160,80,0)');
    c.fillStyle = g; c.fillRect(v.X(f.x) - v.s * 4, v.Y(f.y) - v.s * 4, v.s * 8, v.s * 8);
    c.globalCompositeOperation = 'source-over';
  }
}

function renderLive(t, sim, v) {
  const c = v.ctx;
  c.drawImage(S.bgReal, 0, 0, W, H);
  drawBirds(v, t);
  const hov = S.screen === 'live' && S.pointer.inside ? hitMemberLive(sim, S.pointer.x, S.pointer.y) : -1;
  drawMembersReal(v, sim, t, hov);
  drawVehicle(v, sim, t);
  drawWater(v, S.level, t);
  drawParticles(v);
  c.drawImage(S.vig, 0, 0, W, H);
  if (hov >= 0) {
    const m = sim.members[hov], mat = MATERIALS[m.mat];
    const f = m.ff / 1000;
    const kind = m.mat === 'cable' && f <= 0 ? 'slack' : f >= 0 ? 'tension' : 'compression';
    const cap = (f >= 0 ? m.capT : m.capC) / 1000;
    const txt = kind === 'slack' ? `${mat.short} · slack` : `${mat.short} · ${kind} ${Math.abs(f).toFixed(1)} kN of ${cap.toFixed(1)} kN · ${Math.round(m.util * 100)}%`;
    labelBox(c, txt, S.pointer.x, S.pointer.y - 28, { bg: 'rgba(28,16,38,.9)', borderColor: 'rgba(255,200,150,.5)', color: '#fff1e2' });
  }
}
function hitMemberLive(sim, px, py) {
  const v = S.view; let best = -1, bd = 9;
  for (const m of sim.members) {
    if (m.broken) continue;
    const a = sim.P[m.a], b = sim.P[m.b];
    const [cx, cy] = closestOnSeg(px, py, v.X(a.x), v.Y(a.y), v.X(b.x), v.Y(b.y));
    const d = Math.hypot(px - cx, py - cy); if (d < bd) { bd = d; best = m.id; }
  }
  return best;
}

// ======================================================================
// AUDIO: everything synthesised; nothing to download
// ======================================================================
const Snd = (() => {
  let ac = null, master = null, noiseBuf = null, eng = null;
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = save.muted ? 0 : .8;
      const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
  }
  function env(g, t0, a, peak, dur) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); }
  function tone(f, dur, type = 'sine', peak = .1, delay = 0, slide) {
    if (!ac) return; const t0 = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    env(g, t0, .005, peak, dur); o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + .05);
  }
  function noise(dur, ftype, f, q, peak, delay = 0, fTo) {
    if (!ac) return; const t0 = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = .8 + Math.random() * .4;
    const fl = ac.createBiquadFilter(); fl.type = ftype; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q;
    if (fTo) fl.frequency.exponentialRampToValueAtTime(fTo, t0 + dur);
    const g = ac.createGain(); env(g, t0, .004, peak, dur);
    s.connect(fl); fl.connect(g); g.connect(master); s.start(t0, Math.random()); s.stop(t0 + dur + .05);
  }
  // amadinda-like struck log: fundamental plus a quickly dying overtone
  function marimba(f, delay, peak = .16) { tone(f, .55, 'sine', peak, delay); tone(f * 4, .12, 'sine', peak * .35, delay); tone(f * 2.01, .25, 'triangle', peak * .2, delay); }
  return {
    init,
    setMuted(m) { if (master) master.gain.setTargetAtTime(m ? 0 : .8, ac.currentTime, .02); },
    place(mat) {
      if (mat === 'steel') { tone(620, .18, 'triangle', .07); tone(1240, .1, 'sine', .04); noise(.04, 'highpass', 3000, 1, .05); }
      else if (mat === 'cable') { tone(300, .2, 'sine', .06, 0, 520); noise(.05, 'bandpass', 2500, 2, .05); }
      else if (mat === 'road') { noise(.09, 'lowpass', 900, 1, .16); tone(120, .1, 'sine', .1); }
      else { marimba(330, 0, .09); noise(.05, 'bandpass', 1200, 3, .08); }
    },
    tick() { tone(1500, .03, 'sine', .025); },
    erase() { noise(.12, 'bandpass', 1800, 2, .09, 0, 500); },
    deny() { tone(180, .12, 'square', .03); },
    whoosh(up) { noise(.5, 'bandpass', up ? 300 : 2400, 1.4, .1, 0, up ? 2400 : 300); },
    snap(mat) {
      noise(.35, 'highpass', mat === 'wood' ? 1200 : 2400, .8, .5); tone(90, .3, 'sine', .35, 0, 40);
      if (mat === 'steel' || mat === 'cable') { tone(1480, .9, 'sine', .08); tone(2210, .7, 'sine', .05); tone(3320, .5, 'sine', .03); }
      if (mat === 'wood') noise(.25, 'bandpass', 700, 4, .25, .02);
    },
    creak() { noise(.4, 'bandpass', 380 + Math.random() * 200, 18, .22, 0, 250 + Math.random() * 100); },
    splash() { noise(1.3, 'lowpass', 2600, .7, .5, 0, 300); noise(.3, 'highpass', 4000, 1, .2, .05); tone(70, .5, 'sine', .3, 0, 35); },
    win() { [392, 440, 523, 587, 659, 784, 659, 784].forEach((f, i) => marimba(f, i * .11)); marimba(1046, .95, .2); },
    fail() { [330, 294, 262, 196].forEach((f, i) => marimba(f, i * .18, .12)); },
    engine(on, speed, mass) {
      if (!ac) return;
      if (on && !eng) {
        const o = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
        o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 320; g.gain.value = 0;
        o.connect(f); o2.connect(f); f.connect(g); g.connect(master); o.start(); o2.start();
        eng = { o, o2, g };
      }
      if (!eng) return;
      const base = mass > 4000 ? 38 : 55;
      const tt = ac.currentTime;
      eng.o.frequency.setTargetAtTime(base + speed * 7, tt, .1); eng.o2.frequency.setTargetAtTime((base + speed * 7) * .5, tt, .1);
      eng.g.gain.setTargetAtTime(on ? .045 : 0, tt, .15);
    },
  };
})();

// ======================================================================
// SCREENS
// ======================================================================
function setScreen(name) {
  S.screen = name;
  document.body.className = 'screen-' + name + (name === 'live' ? ' live' : '');
  $('#title').hidden = name !== 'title';
  $('#levels').hidden = name !== 'levels';
  $('#hud').hidden = !(name === 'build' || name === 'live');
  $('#toolbar').hidden = !(name === 'build' || name === 'live');
  $('#tools-build').hidden = name !== 'build';
  $('#tools-live').hidden = name !== 'live';
  $('#hud-mode').textContent = name === 'live' ? 'Live test' : 'Blueprint';
  if (name !== 'live') $('#result').hidden = true;
  if (name !== 'live') Snd.engine(false, 0, 0);
}

// Title: a matatu crossing a steel-and-timber arch truss at dusk, on loop
const DEMO_LEVEL = {
  id: 0, code: 'DJ-00', name: 'Demo', gap: 16, hR: 0, waterY: -8, seed: 31, vehicle: 'matatu', budget: 99999,
  materials: ['road', 'wood', 'steel'], anchors: [[0, 0], [16, 0], [0, -3], [16, -3]], notes: [], startX: -13, finishPad: 30,
};
function demoDesign() {
  const nodes = [], members = [];
  const nA = DEMO_LEVEL.anchors.length;
  const idx = (x, y) => {
    for (let i = 0; i < nA; i++) if (DEMO_LEVEL.anchors[i][0] === x && DEMO_LEVEL.anchors[i][1] === y) return i;
    const k = nodes.findIndex(n => Math.abs(n[0] - x) < 1e-6 && Math.abs(n[1] - y) < 1e-6);
    if (k >= 0) return nA + k; nodes.push([x, y]); return nA + nodes.length - 1;
  };
  const arch = x => +(2.6 * (1 - Math.pow((x - 8) / 8, 2))).toFixed(2);
  for (let x = 0; x < 16; x += 2) members.push([idx(x, 0), idx(x + 2, 0), 'road']);
  for (let x = 2; x <= 14; x += 2) members.push([idx(x, 0), idx(x, arch(x)), 'wood']);
  for (let x = 0; x < 16; x += 2) members.push([idx(x, arch(x)), idx(x + 2, arch(x + 2)), 'steel']);
  for (let x = 2; x < 14; x += 2) members.push([idx(x, 0), idx(x + 2, arch(x + 2)), 'wood']);
  members.push([idx(0, -3), idx(2, 0), 'steel']); members.push([idx(16, -3), idx(14, 0), 'steel']);
  return { nodes, members };
}
function startDemo() {
  S.level = DEMO_LEVEL;
  rebuild();
  S.demo = createSim(DEMO_LEVEL, demoDesign());
  S.demoEnd = 0;
}

function buildLevelGrid() {
  const grid = $('#level-grid'); grid.innerHTML = '';
  let total = 0;
  LEVELS.forEach((L, i) => {
    const prog = save.progress[L.id];
    const unlocked = i === 0 || (save.progress[LEVELS[i - 1].id] && save.progress[LEVELS[i - 1].id].stars > 0);
    const stars = prog ? prog.stars : 0; total += stars;
    const V = VEHICLES[L.vehicle];
    const b = document.createElement('button');
    b.className = 'lvl'; b.disabled = !unlocked;
    b.setAttribute('aria-label', `${L.code} ${L.name}${unlocked ? '' : ' (locked)'}`);
    b.innerHTML = `
      <canvas class="lvl-thumb"></canvas>
      <span class="lvl-stamp ${stars ? '' : unlocked ? 'pending' : 'locked'}">${stars ? 'Approved' : unlocked ? 'Open' : 'Locked'}</span>
      <div class="lvl-meta">
        <div><span class="k">Drg</span><span class="v code">${L.code}</span></div>
        <div><span class="k">${L.place}</span><span class="v">${L.name}</span></div>
        <div><span class="k">Span</span><span class="v">${L.gap} m</span></div>
        <div><span class="k">Vehicle</span><span class="v">${V.name} · ${(V.mass / 1000).toFixed(1)} t</span></div>
        <div class="full"><span><span class="k">Budget</span><span class="v">${ugx(L.budget)}</span></span>
          <span class="lvl-stars" aria-label="${stars} of 3 stars">${[1, 2, 3].map(k => `<span class="${k <= stars ? '' : 'e'}">★</span>`).join('')}</span></div>
      </div>`;
    b.addEventListener('click', () => { Snd.init(); openLevel(L); });
    grid.appendChild(b);
    requestAnimationFrame(() => drawThumb(b.querySelector('canvas'), L));
  });
  $('#levels-sum').textContent = `${total} / ${LEVELS.length * 3} stars`;
}
function drawThumb(canvas, L) {
  const r = canvas.getBoundingClientRect();
  const w = Math.max(10, r.width), h = Math.max(10, r.height), d = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(w * d); canvas.height = Math.round(h * d);
  const c = canvas.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0);
  const v = makeView(c, w, h, L, { top: 8, bottom: 8, left: 8, right: 8 });
  c.fillStyle = '#0c2748'; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(160,205,255,.08)'; c.lineWidth = 1;
  for (let x = Math.ceil(v.iX(0)); x < v.iX(w); x++) { const px = Math.round(v.X(x)) + .5; c.beginPath(); c.moveTo(px, 0); c.lineTo(px, h); c.stroke(); }
  for (let y = Math.ceil(v.iY(h)); y < v.iY(0); y++) { const py = Math.round(v.Y(y)) + .5; c.beginPath(); c.moveTo(0, py); c.lineTo(w, py); c.stroke(); }
  const T = buildTerrain(L);
  c.fillStyle = 'rgba(80,150,230,.12)'; c.fillRect(0, v.Y(L.waterY), w, h);
  for (const p of T.polys) {
    path(c, p.pts, v); c.fillStyle = 'rgba(6,20,42,.8)'; c.fill();
    c.save(); c.clip(); c.strokeStyle = 'rgba(160,205,255,.2)';
    for (let k = -h; k < w; k += 5) { c.beginPath(); c.moveTo(k, h); c.lineTo(k + h, 0); c.stroke(); }
    c.restore(); path(c, p.pts, v); c.strokeStyle = 'rgba(234,243,255,.7)'; c.lineWidth = 1; c.stroke();
  }
  const D = save.designs[L.id];
  if (D) {
    const nodes = L.anchors.concat(D.nodes);
    for (const m of D.members) {
      const a = nodes[m[0]], b = nodes[m[1]]; if (!a || !b) continue;
      c.strokeStyle = BP[m[2]]; c.lineWidth = m[2] === 'road' ? 2.2 : m[2] === 'steel' ? 1.8 : 1.2;
      c.beginPath(); c.moveTo(v.X(a[0]), v.Y(a[1])); c.lineTo(v.X(b[0]), v.Y(b[1])); c.stroke();
    }
  }
  c.fillStyle = '#ffc65c';
  for (const a of L.anchors) { c.beginPath(); c.arc(v.X(a[0]), v.Y(a[1]), 2.5, 0, Math.PI * 2); c.fill(); }
}

function openLevel(L) {
  S.level = L;
  const saved = save.designs[L.id];
  S.design = saved ? JSON.parse(JSON.stringify(saved)) : { nodes: [], members: [] };
  S.hist = []; S.redo = []; S.sim = null; S.drag = null; S.particles = []; S.flashes = [];
  S.tool = L.materials[0];
  setScreen('build');
  buildToolButtons();
  const V = VEHICLES[L.vehicle];
  $('#hud-code').textContent = L.code;
  $('#hud-name').textContent = L.name;
  $('#hud-place').textContent = L.place;
  $('#hud-veh').textContent = `${V.name} ${(V.mass / 1000).toFixed(1)} t`;
  $('#hud-budget').textContent = ugxShort(L.budget);
  requestAnimationFrame(() => { rebuild(); updateCost(); });
  rebuild(); updateCost();
  if (!save.seenHelp) { save.seenHelp = true; persist(); setTimeout(() => showHelp(true), 350); }
  else if (H > W && W < 700) toast('Turn your phone sideways for a bigger drawing.', 4200);
  else toast(L.notes[0]);
}

function buildToolButtons() {
  const box = $('#tools-mat'); box.innerHTML = '';
  S.level.materials.forEach((k, i) => {
    const m = MATERIALS[k];
    const b = document.createElement('button');
    b.className = 'tool'; b.dataset.tool = k;
    b.setAttribute('aria-pressed', S.tool === k ? 'true' : 'false');
    b.innerHTML = `<span class="sw sw-${k}"></span><span class="tool-name">${m.short}</span><span class="k">${m.cost}k/m · ${m.maxLen} m max</span><span class="hot">${i + 1}</span>`;
    b.title = `${m.name}: ${Math.round(m.tension / 1000)} kN tension${m.comp ? `, ${Math.round(m.comp / 1000)} kN compression (less when long)` : ', no compression'}`;
    b.addEventListener('click', () => selectTool(k));
    box.appendChild(b);
  });
  $('#tool-erase').setAttribute('aria-pressed', S.tool === 'erase' ? 'true' : 'false');
}
function selectTool(k) {
  if (S.screen !== 'build') return;
  if (k !== 'erase' && !S.level.materials.includes(k)) return;
  S.tool = k;
  document.querySelectorAll('#tools-build .tool[data-tool]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === k ? 'true' : 'false'));
  Snd.tick();
}

function updateCost() {
  if (!S.level || !S.design) return;
  const cost = designCost(S.level, S.design);
  const B = S.level.budget;
  $('#hud-cost').textContent = ugx(cost);
  const bar = $('#hud-bar');
  bar.style.width = Math.min(100, cost / B * 100) + '%';
  bar.classList.toggle('over', cost > B);
}

let toastT = 0;
function toast(msg, ms = 3200) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
}

function showHelp(first) {
  const box = $('#help-mats'); box.innerHTML = '';
  MAT_ORDER.forEach(k => {
    const m = MATERIALS[k];
    const d = document.createElement('div');
    d.innerHTML = `<b>${m.short}</b>${m.cost}k UGX/m · max ${m.maxLen} m · ${Math.round(m.tension / 1000)} kN ${m.comp ? '' : 'tension only'}`;
    box.appendChild(d);
  });
  $('#help').hidden = false;
  $('#help-close').focus();
}

// ---------------------------------------------------------------- design edits
function snapshot() { S.hist.push(JSON.stringify(S.design)); if (S.hist.length > 200) S.hist.shift(); S.redo = []; }
function undo() { if (!S.hist.length) return; S.redo.push(JSON.stringify(S.design)); S.design = JSON.parse(S.hist.pop()); S.lastAdded = null; changed(); Snd.tick(); }
function redo() { if (!S.redo.length) return; S.hist.push(JSON.stringify(S.design)); S.design = JSON.parse(S.redo.pop()); S.lastAdded = null; changed(); Snd.tick(); }
function changed() { updateCost(); save.designs[S.level.id] = S.design; persist(); }
function nodeIndexAt(x, y) {
  const L = S.level, nA = L.anchors.length;
  for (let i = 0; i < nA; i++) if (Math.hypot(L.anchors[i][0] - x, L.anchors[i][1] - y) < .2) return i;
  for (let i = 0; i < S.design.nodes.length; i++) if (Math.hypot(S.design.nodes[i][0] - x, S.design.nodes[i][1] - y) < .2) return nA + i;
  return -1;
}
function addMember(from, tgt, mat) {
  let to = tgt.node;
  const D = S.design, nA = S.level.anchors.length;
  if (to < 0) { to = nodeIndexAt(tgt.x, tgt.y); }
  if (to === from) return false;
  if (to >= 0 && D.members.some(m => (m[0] === from && m[1] === to) || (m[0] === to && m[1] === from))) { toast('Those joints are already connected.'); return false; }
  snapshot();
  if (to < 0) { D.nodes.push([+tgt.x.toFixed(3), +tgt.y.toFixed(3)]); to = nA + D.nodes.length - 1; }
  D.members.push([from, to, mat]);
  S.lastAdded = { k: D.members.length - 1, t: S.time };
  changed(); Snd.place(mat);
  return true;
}
function removeNode(i) {
  const D = S.design, nA = S.level.anchors.length;
  if (i < nA) return;
  D.members = D.members.filter(m => m[0] !== i && m[1] !== i).map(m => [m[0] > i ? m[0] - 1 : m[0], m[1] > i ? m[1] - 1 : m[1], m[2]]);
  D.nodes.splice(i - nA, 1);
}
function pruneOrphans() {
  const nA = S.level.anchors.length;
  for (let i = S.design.nodes.length - 1; i >= 0; i--) {
    const k = nA + i;
    if (!S.design.members.some(m => m[0] === k || m[1] === k)) removeNode(k);
  }
}
function eraseAt() {
  if (S.hoverNode >= S.level.anchors.length) { snapshot(); removeNode(S.hoverNode); pruneOrphans(); S.hoverNode = -1; changed(); Snd.erase(); return true; }
  if (S.hoverMember >= 0) { snapshot(); S.design.members.splice(S.hoverMember, 1); pruneOrphans(); S.hoverMember = -1; changed(); Snd.erase(); return true; }
  return false;
}
function clearDesign() {
  if (!S.design.members.length) return;
  if (performance.now() - S.clearArmed > 2500) { S.clearArmed = performance.now(); toast('Press Clear again to erase the whole design.'); return; }
  snapshot(); S.design = { nodes: [], members: [] }; S.clearArmed = 0; changed(); Snd.erase(); toast('Drawing cleared. Undo brings it back.');
}

// ---------------------------------------------------------------- hit testing
function hitTest(px, py) {
  const v = S.view, L = S.level, D = S.design, nA = L.anchors.length;
  let node = -1, nd = COARSE ? 26 : 16;
  const all = L.anchors.concat(D.nodes);
  all.forEach((n, i) => { const d = Math.hypot(v.X(n[0]) - px, v.Y(n[1]) - py); if (d < nd) { nd = d; node = i; } });
  let mem = -1;
  if (node < 0) {
    let md = COARSE ? 14 : 8;
    D.members.forEach((m, k) => {
      const a = all[m[0]], b = all[m[1]];
      const [cx, cy] = closestOnSeg(px, py, v.X(a[0]), v.Y(a[1]), v.X(b[0]), v.Y(b[1]));
      const d = Math.hypot(px - cx, py - cy); if (d < md) { md = d; mem = k; }
    });
  }
  return { node, mem };
}
function dragTarget(px, py) {
  const v = S.view, a = nodePos(S.drag.from), mat = MATERIALS[S.tool];
  const h = hitTest(px, py);
  let x, y, node = -1, clamped = false;
  if (h.node >= 0 && h.node !== S.drag.from) { [x, y] = nodePos(h.node); node = h.node; }
  else { x = Math.round(v.iX(px) * 2) / 2; y = Math.round(v.iY(py) * 2) / 2; }
  let len = Math.hypot(x - a[0], y - a[1]);
  if (len > mat.maxLen + 1e-6) {
    if (node >= 0) { node = -1; }
    // free point at max reach along the pointer direction
    const wx = v.iX(px), wy = v.iY(py); const dx = wx - a[0], dy = wy - a[1], d = Math.hypot(dx, dy) || 1;
    x = a[0] + dx / d * mat.maxLen; y = a[1] + dy / d * mat.maxLen;
    // prefer the farthest grid point still within reach, if close to the pointer ray
    let best = null, bd = Infinity;
    for (let gx = Math.floor((x - 1) * 2) / 2; gx <= x + 1; gx += .5) for (let gy = Math.floor((y - 1) * 2) / 2; gy <= y + 1; gy += .5) {
      const L2 = Math.hypot(gx - a[0], gy - a[1]); if (L2 > mat.maxLen + 1e-6 || L2 < .5) continue;
      const dd = Math.hypot(gx - x, gy - y); if (dd < bd) { bd = dd; best = [gx, gy]; }
    }
    if (best && bd < .45) { x = best[0]; y = best[1]; const k = nodeIndexAt(x, y); if (k >= 0 && k !== S.drag.from) node = k; }
    clamped = true; len = Math.hypot(x - a[0], y - a[1]);
  }
  const ok = len >= .45 && node !== S.drag.from;
  return { x, y, node, ok, clamped };
}

// ---------------------------------------------------------------- input
function localPoint(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
cv.addEventListener('pointermove', e => {
  const [x, y] = localPoint(e);
  S.pointer.x = x; S.pointer.y = y; S.pointer.inside = true;
  if (!S.view) return;
  S.pointer.wx = S.view.iX(x); S.pointer.wy = S.view.iY(y);
  if (S.screen !== 'build') return;
  if (S.drag) { const prev = S.drag.target; S.drag.target = dragTarget(x, y); if (!prev || prev.x !== S.drag.target.x || prev.y !== S.drag.target.y) Snd.tick(); return; }
  const h = hitTest(x, y); S.hoverNode = h.node; S.hoverMember = h.mem;
  cv.style.cursor = h.node >= 0 || h.mem >= 0 ? 'pointer' : 'crosshair';
});
cv.addEventListener('pointerleave', () => { S.pointer.inside = false; S.hoverNode = -1; S.hoverMember = -1; });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  Snd.init();
  if (S.screen !== 'build') return;
  const [x, y] = localPoint(e);
  S.pointer.x = x; S.pointer.y = y; S.pointer.inside = true;
  const h = hitTest(x, y); S.hoverNode = h.node; S.hoverMember = h.mem;
  if (e.button === 2 || S.tool === 'erase') { eraseAt(); return; }
  if (e.button !== 0) return;
  if (h.node >= 0) {
    cv.setPointerCapture(e.pointerId);
    S.drag = { from: h.node, target: null, id: e.pointerId };
    S.drag.target = dragTarget(x, y);
  } else if (h.mem >= 0) {
    toast('Drag from a joint (the round ends), not the middle of a member.');
  } else {
    toast('Start from an amber anchor on the banks, or from a joint you have built.'); Snd.deny();
  }
});
function endDrag(e) {
  if (!S.drag) return;
  const d = S.drag; S.drag = null;
  if (e && e.type === 'pointercancel') return;
  const [x, y] = localPoint(e);
  S.drag = d; const tgt = dragTarget(x, y); S.drag = null;
  if (tgt.ok) addMember(d.from, tgt, S.tool);
  else if (Math.hypot(tgt.x - nodePos(d.from)[0], tgt.y - nodePos(d.from)[1]) > .1) { toast('Too short. Members need at least 0.5 m.'); }
  const h = hitTest(x, y); S.hoverNode = h.node; S.hoverMember = h.mem;
}
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);

window.addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (!$('#help').hidden) { if (e.key === 'Escape' || e.key === 'Enter') { $('#help').hidden = true; e.preventDefault(); } return; }
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if (S.screen === 'build') {
    if (mod && k === 'z' && !e.shiftKey) { undo(); e.preventDefault(); return; }
    if ((mod && k === 'y') || (mod && k === 'z' && e.shiftKey)) { redo(); e.preventDefault(); return; }
    if (mod) return;
    if (k >= '1' && k <= '4') { const m = S.level.materials[+k - 1]; if (m) selectTool(m); }
    else if (k === 'e') selectTool('erase');
    else if (k === ' ') { e.preventDefault(); startTest(); }
    else if (k === 'escape') { if (S.drag) S.drag = null; else goLevels(); }
    else if (k === 'h' || k === '?') showHelp();
    else if (k === 'm') toggleMute();
  } else if (S.screen === 'live') {
    if (mod) return;
    if (k === ' ' || k === 'escape') { e.preventDefault(); stopTest(); }
    else if (k === 's') toggleSlow();
    else if (k === 'f') toggleForces();
    else if (k === 'r') replay();
    else if (k === 'm') toggleMute();
    else if (k === 'enter' && !$('#result').hidden) $('#res-next').click();
  } else if (S.screen === 'title' && (k === 'enter' || k === ' ')) { e.preventDefault(); goLevels(); }
  else if (S.screen === 'levels' && k === 'escape') goTitle();
});

// ---------------------------------------------------------------- live test
function startTest() {
  if (S.trans) return;
  const L = S.level, D = S.design;
  if (!D.members.some(m => m[2] === 'road')) { toast('Lay some road deck first. Only road carries wheels.'); Snd.deny(); return; }
  S.sim = createSim(L, D);
  S.particles = []; S.flashes = []; S.resultAt = 0; S.resultShown = false; S.shake = 0; S.acc = 0;
  S.trans = { to: 'live', t0: performance.now(), dur: reduceMotion ? 1 : 750 };
  Snd.whoosh(true);
  setScreen('live');
  $('#btn-slow').setAttribute('aria-pressed', S.slow ? 'true' : 'false');
  $('#btn-forces').setAttribute('aria-pressed', S.forces ? 'true' : 'false');
  $('#legend').classList.toggle('forces', S.forces);
}
function stopTest() {
  if (S.trans) return;
  S.trans = { to: 'build', t0: performance.now(), dur: reduceMotion ? 1 : 650 };
  Snd.whoosh(false); Snd.engine(false, 0, 0);
  setScreen('build');
  const h = hitTest(S.pointer.x, S.pointer.y); S.hoverNode = h.node; S.hoverMember = h.mem;
}
function replay() {
  S.sim = createSim(S.level, S.design); S.particles = []; S.flashes = []; S.resultAt = 0; S.resultShown = false; $('#result').hidden = true;
}
function toggleSlow() { S.slow = !S.slow; $('#btn-slow').setAttribute('aria-pressed', S.slow ? 'true' : 'false'); Snd.tick(); }
function toggleForces() { S.forces = !S.forces; $('#btn-forces').setAttribute('aria-pressed', S.forces ? 'true' : 'false'); $('#legend').classList.toggle('forces', S.forces); Snd.tick(); }
function toggleMute() { save.muted = !save.muted; persist(); Snd.setMuted(save.muted); $('#btn-mute').classList.toggle('off', save.muted); }

function handleEvents(ev, sim, isDemo) {
  for (const e of ev) {
    if (e.type === 'break') {
      burst(e);
      if (!isDemo) { Snd.snap(e.mat); S.shake = Math.max(S.shake, reduceMotion ? 0 : 7); }
    } else if (e.type === 'splash') {
      splash(e.x, e.y, e.v);
      if (!isDemo) { Snd.splash(); S.shake = Math.max(S.shake, reduceMotion ? 0 : 5); }
    } else if (e.type === 'finish' && !isDemo) {
      // wait a moment so the vehicle rolls clear, then show the report
    }
  }
}
function vehicleSpeed(sim) { const p = sim.P[sim.veh.wheels[0]]; return Math.hypot(p.vx, p.vy); }

function stepLive(dt) {
  const sim = S.sim; if (!sim) return;
  const scale = S.slow ? .25 : 1;
  S.acc = (S.acc || 0) + dt * scale;
  let n = 0;
  while (S.acc >= 1 / 60 && n < 3) {
    const ev = stepSim(sim, 1 / 60);
    handleEvents(ev, sim, false);
    S.acc -= 1 / 60; n++;
  }
  if (n === 3) S.acc = 0;
  // creaks when something is near its limit
  let worst = 0, peak = 0;
  for (const m of sim.members) if (!m.broken) { worst = Math.max(worst, m.util); }
  for (const m of sim.members) if (!m.stub) peak = Math.max(peak, m.peak);
  S.creakT -= dt;
  if (worst > .8 && S.creakT <= 0 && sim.state === 'running') { Snd.creak(); S.creakT = .25 + Math.random() * .5; }
  Snd.engine(sim.state !== 'failed' && sim.t > .9, vehicleSpeed(sim), sim.veh.def.mass);
  $('#hud-time').textContent = sim.t.toFixed(1) + ' s';
  $('#hud-peak').textContent = Math.round(Math.min(peak, 9.99) * 100) + '%';
  if (sim.state !== 'running' && !S.resultAt) S.resultAt = performance.now() + (sim.state === 'crossed' ? 1100 : 1900);
  if (S.resultAt && !S.resultShown && performance.now() > S.resultAt) showResult();
  // wheel dust on the murram
  sim.veh.wheels.forEach((k, i) => {
    const p = sim.P[k];
    if (sim.veh.contact[i] && Math.abs(p.vx) > 1 && Math.random() < .3 && (p.x < 0 || p.x > S.level.gap)) {
      spawn({ type: 'dust', x: p.x - .3, y: p.y - sim.veh.def.r * .8, vx: -p.vx * .15, vy: .3 + Math.random() * .4, life: 0, max: 1 + Math.random(), g: -.2, sz: .15 + Math.random() * .2 });
    }
  });
}

function showResult() {
  const sim = S.sim, L = S.level; S.resultShown = true;
  const cost = designCost(L, S.design), B = L.budget;
  let pm = null; for (const m of sim.members) if (!m.stub && (!pm || m.peak > pm.peak)) pm = m;
  const crossed = sim.state === 'crossed';
  const within = cost <= B;
  const stars = crossed && within ? (cost <= B * .7 ? 3 : cost <= B * .85 ? 2 : 1) : 0;
  const V = VEHICLES[L.vehicle];
  const stamp = $('#res-stamp');
  stamp.className = 'stamp' + (crossed ? (within ? '' : ' warn') : ' bad');
  stamp.textContent = crossed ? (within ? 'Approved' : 'Over budget') : 'Rejected';
  $('#res-eyebrow').textContent = `${L.code} · ${L.name} · Test report`;
  $('#res-title').textContent = crossed ? 'Crossed.' : 'Collapsed.';
  const broke = sim.members.filter(m => m.broken && !m.stub).length;
  let line;
  if (crossed && within) line = stars === 3 ? `The ${V.name.toLowerCase()} crossed, and you came in well under budget. Top marks from the council.` : `The ${V.name.toLowerCase()} made it across${broke ? `, though ${broke} member${broke > 1 ? 's' : ''} failed on the way` : ''}. Trim the cost for more stars.`;
  else if (crossed) line = `It held, but it cost ${ugx(cost - B)} more than the budget allows. The council won't sign off.`;
  else if (sim.result && sim.result.reason === 'water') line = `The ${V.name.toLowerCase()} went into the river ${Math.max(0, sim.result.x).toFixed(1)} m along the span. Look for the members that glowed first.`;
  else line = `The ${V.name.toLowerCase()} couldn't get across. Check the road deck runs all the way from bank to bank.`;
  $('#res-line').textContent = line;
  $('#res-stars').innerHTML = [1, 2, 3].map(k => `<span class="${k <= stars ? 'on' : ''}">★</span>`).join('');
  const kind = pm && pm.ff < 0 ? (pm.mat === 'cable' ? 'slack' : 'compression') : 'tension';
  const rows = [
    ['Cost', `${ugx(cost)} of ${ugxShort(B)}`],
    ['Stars at', `${ugxShort(B * .85)} ★★ · ${ugxShort(B * .7)} ★★★`],
    ['Peak stress', pm ? `${Math.round(Math.min(pm.peak, 9.99) * 100)}% · ${MATERIALS[pm.mat].short.toLowerCase()} in ${kind}` : '-'],
    ['Members failed', `${broke} of ${S.design.members.length}`],
    ['Time', crossed ? `${sim.result.t.toFixed(1)} s` : '-'],
  ];
  $('#res-stats').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  const idx = LEVELS.indexOf(L);
  const next = LEVELS[idx + 1];
  const nb = $('#res-next');
  if (stars > 0) {
    const prev = save.progress[L.id];
    if (!prev || stars > prev.stars || (stars === prev.stars && cost < prev.cost)) { save.progress[L.id] = { stars, cost }; persist(); }
    nb.textContent = next ? 'Next crossing ›' : 'All crossings ›';
    nb.onclick = () => { $('#result').hidden = true; next ? openLevel(next) : goLevels(); };
    Snd.win();
  } else {
    nb.textContent = 'Watch again';
    nb.onclick = () => { $('#result').hidden = true; replay(); };
    Snd.fail();
  }
  $('#res-edit').onclick = () => { $('#result').hidden = true; stopTest(); };
  $('#result').hidden = false;
}

// ---------------------------------------------------------------- navigation
function goTitle() { setScreen('title'); startDemo(); }
function goLevels() { setScreen('levels'); buildLevelGrid(); }

$('#btn-start').addEventListener('click', () => { Snd.init(); goLevels(); });
$('#btn-help-title').addEventListener('click', () => { Snd.init(); showHelp(); });
$('#btn-levels-back').addEventListener('click', goTitle);
$('#btn-back').addEventListener('click', () => { if (S.screen === 'live') { S.trans = null; setScreen('build'); } goLevels(); });
$('#btn-test').addEventListener('click', startTest);
$('#btn-stop').addEventListener('click', stopTest);
$('#btn-slow').addEventListener('click', toggleSlow);
$('#btn-forces').addEventListener('click', toggleForces);
$('#btn-restart').addEventListener('click', replay);
$('#btn-undo').addEventListener('click', undo);
$('#btn-redo').addEventListener('click', redo);
$('#btn-clear').addEventListener('click', clearDesign);
$('#tool-erase').addEventListener('click', () => selectTool('erase'));
$('#btn-mute').addEventListener('click', toggleMute);
$('#btn-help').addEventListener('click', () => showHelp());
$('#help-close').addEventListener('click', () => { $('#help').hidden = true; });
$('#help').addEventListener('click', e => { if (e.target.id === 'help') $('#help').hidden = true; });
$('#btn-mute').classList.toggle('off', !!save.muted);

// ---------------------------------------------------------------- main loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  S.time = now / 1000;
  const t = S.time;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (S.screen === 'title' && S.demo) {
    S.demoAcc = (S.demoAcc || 0) + dt;
    for (let k = 0; k < 3 && S.demoAcc >= 1 / 60; k++) { handleEvents(stepSim(S.demo, 1 / 60), S.demo, true); S.demoAcc -= 1 / 60; }
    if (S.demoAcc > .1) S.demoAcc = 0;
    if (S.demo.state !== 'running') { S.demoEnd = S.demoEnd || now; if (now - S.demoEnd > 1500) { S.demo = createSim(DEMO_LEVEL, demoDesign()); S.demoEnd = 0; } }
    renderLive(t, S.demo, S.view);
    updateParticles(dt);
  } else if (S.screen === 'levels') {
    // the register covers the canvas
  } else if (S.level && S.view && S.bgBlue) {
    if (S.screen === 'live' || (S.trans && S.sim)) { stepLive(dt); updateParticles(dt); }
    S.shake *= Math.pow(.02, dt);
    ctx.save();
    if (S.shake > .2) ctx.translate((Math.random() - .5) * S.shake, (Math.random() - .5) * S.shake);
    if (S.trans) {
      const p = clamp((now - S.trans.t0) / S.trans.dur, 0, 1), e = ease(p);
      const cx = W / 2, cy = (insets('build').top + H) / 2, R = Math.hypot(W, H) * .6 * e;
      const drawFrom = () => S.trans.to === 'live' ? renderBuild(t) : renderLive(t, S.sim, S.view);
      const drawTo = () => S.trans.to === 'live' ? renderLive(t, S.sim, S.view) : renderBuild(t);
      drawFrom();
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, Math.max(.1, R), 0, Math.PI * 2); ctx.clip(); drawTo(); ctx.restore();
      ctx.strokeStyle = S.trans.to === 'live' ? 'rgba(255,214,160,.8)' : 'rgba(234,243,255,.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(.1, R), 0, Math.PI * 2); ctx.stroke();
      if (p >= 1) { if (S.trans.to === 'build') S.sim = null; S.trans = null; }
    } else if (S.screen === 'live' && S.sim) renderLive(t, S.sim, S.view);
    else renderBuild(t);
    ctx.restore();
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => { resize(); if (S.screen === 'levels') buildLevelGrid(); });
resize();
const boot = () => { goTitle(); requestAnimationFrame(frame); };
if (document.fonts && document.fonts.ready) Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]).then(() => { boot(); });
else boot();

// hook for automated checks
window.__daraja = { S, openLevel: i => openLevel(LEVELS[i - 1]), setDesign(d) { S.design = d; changed(); }, startTest, goLevels, LEVELS };
})();

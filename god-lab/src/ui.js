'use strict';
// ===========================================================================
// God Lab app: camera, powers, panels, inspector, incarnation, rewind, sound.
// ===========================================================================
(() => {
const $ = (s, r = document) => r.querySelector(s);
const cv = $('#view'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const App = {
  w: null, grid: {}, speed: 5, paused: false, cam: { cx: 120, cy: 75, zoom: 6 }, follow: 0, selected: 0, focusSp: 0,
  power: null, brush: 6, overlay: null, snaps: [], lastSnapYear: -1, t: 0, onTitle: true, panel: true,
  frame: 0, placeGenes: null, placeCount: 12, flow: null, incGen0: 0, sound: true, drag: null, pointer: { x: 0, y: 0, down: false, inside: false },
};
try { const s = JSON.parse(localStorage.getItem('godlab.prefs')); if (s) { App.sound = s.sound !== false; } } catch (e) { /* none */ }
const savePrefs = () => { try { localStorage.setItem('godlab.prefs', JSON.stringify({ sound: App.sound })); } catch (e) { /* none */ } };

// ---------------------------------------------------------------- icons
const I = p => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const ICON = {
  create: I('<path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18"/><circle cx="12" cy="12" r="3"/>'),
  destroy: I('<path d="M13 3 4 14h7l-1 7 9-11h-7z"/>'),
  bless: I('<circle cx="12" cy="13" r="4"/><ellipse cx="12" cy="5" rx="6" ry="2"/><path d="M12 17v4"/>'),
  speak: I('<path d="M4 5h16v10H9l-5 4z"/><path d="M8 9h8M8 12h5"/>'),
  incarnate: I('<circle cx="12" cy="7" r="3.5"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/><path d="M12 1v2M4 4l1.5 1.5M20 4l-1.5 1.5"/>'),
  species: I('<ellipse cx="12" cy="13" rx="7" ry="5"/><circle cx="18" cy="10" r="2.5"/><path d="M5 15l-2 3M9 17l-1 3M15 17l1 3"/>'),
  soup: I('<path d="M4 12h16a8 8 0 0 1-16 0z"/><circle cx="9" cy="8" r="1.2"/><circle cx="14" cy="6" r="1.5"/><circle cx="12" cy="3" r=".8"/>'),
  forest: I('<path d="M12 3 6 12h4l-4 6h12l-4-6h4z"/><path d="M12 18v3"/>'),
  raise: I('<path d="M3 20 10 8l4 6 2-3 5 9z"/><path d="M17 3v5M15 5l2-2 2 2"/>'),
  lower: I('<path d="M3 8c3 0 3 3 6 3s3-3 6-3 3 3 6 3"/><path d="M3 15c3 0 3 3 6 3s3-3 6-3 3 3 6 3"/>'),
  rain: I('<path d="M7 14a4 4 0 0 1 0-8 5 5 0 0 1 9.6 1.5A3.5 3.5 0 0 1 17 14z"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/>'),
  rays: I('<path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5 19 19M19 5l-3.5 3.5M8.5 15.5 5 19"/><circle cx="12" cy="12" r="2"/>'),
  meteor: I('<circle cx="16" cy="16" r="4"/><path d="M13 13 3 3M16 10 8 2M10 16 2 8"/>'),
  volcano: I('<path d="M2 21 9 9h6l7 12z"/><path d="M10 9c0-3 1-5 2-7 1 2 2 4 2 7M8 4l1 2M16 4l-1 2"/>'),
  lightning: I('<path d="M13 2 5 14h6l-2 8 10-13h-6z"/>'),
  wildfire: I('<path d="M12 22c-4 0-7-3-7-7 0-4 4-6 4-11 3 2 5 5 5 8 1-1 2-3 2-4 2 2 3 4 3 7 0 4-3 7-7 7z"/>'),
  plague: I('<circle cx="12" cy="12" r="5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M5 19l2-2"/>'),
  erase: I('<circle cx="12" cy="10" r="7"/><circle cx="9" cy="10" r="1.5"/><circle cx="15" cy="10" r="1.5"/><path d="M9 17v4M12 17v4M15 17v4"/>'),
  drought: I('<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M5 19l2-2"/>'),
  iceage: I('<path d="M12 2v20M3 7l18 10M21 7 3 17M9 3l3 3 3-3M9 21l3-3 3 3"/>'),
  deluge: I('<path d="M2 14c3 0 3-3 6-3s3 3 6 3 3-3 6-3M2 19c3 0 3-3 6-3s3 3 6 3 3-3 6-3"/><path d="M12 2v7M9 6l3 3 3-3"/>'),
  heatwave: I('<path d="M14 14V5a2 2 0 0 0-4 0v9a4 4 0 1 0 4 0z"/><path d="M18 4c1 1 1 2 0 3s-1 2 0 3M21 6c1 1 1 2 0 3"/>'),
  gift: I('<path d="M12 2l2.6 6.2 6.4.6-4.9 4.3 1.5 6.4L12 16l-5.6 3.5 1.5-6.4L3 8.8l6.4-.6z"/>'),
  abundance: I('<circle cx="9" cy="14" r="5"/><circle cx="16" cy="11" r="4"/><path d="M11 9c0-3 2-5 5-6"/>'),
  heal: I('<path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z"/><path d="M12 9v6M9 12h6"/>'),
  fertility: I('<circle cx="8" cy="9" r="4"/><circle cx="16" cy="9" r="4"/><path d="M4 21c0-4 2-6 4-6s4 2 4 6M12 21c0-4 2-6 4-6s4 2 4 6"/>'),
  fire: I('<path d="M12 21c-3 0-5-2-5-5 0-3 3-4 3-8 2 1 4 4 4 6 1-1 1-2 1-3 2 2 2 3 2 5 0 3-2 5-5 5z"/><path d="M4 21h16"/>'),
  messenger: I('<circle cx="12" cy="6" r="3"/><path d="M12 9v7M8 13l4-2 4 2M9 21l3-5 3 5"/><path d="M5 4c1-1 2-1 3 0M16 4c1-1 2-1 3 0"/>'),
};

// ---------------------------------------------------------------- powers
const CATS = [
  { id: 'create', name: 'Create', c: 'var(--create)', list: [
    { id: 'species', name: 'Design a species', desc: 'Craft a creature, then place it', key: 'N', mode: 'designer' },
    { id: 'soup', name: 'Primordial soup', desc: 'Seed tiny cells. Evolve everything', mode: 'point' },
    { id: 'forest', name: 'Grow forest', desc: 'Paint lush, fertile land', mode: 'brush' },
    { id: 'raise', name: 'Raise land', desc: 'Lift hills, mountains and islands', mode: 'brush' },
    { id: 'lower', name: 'Sink land', desc: 'Carve lakes, seas and straits', mode: 'brush' },
    { id: 'rain', name: 'Summon rain', desc: 'Plants flourish under the clouds for a year', mode: 'point' },
    { id: 'rays', name: 'Cosmic rays', desc: 'Mutations run wild here for three years', mode: 'point' },
  ] },
  { id: 'destroy', name: 'Destroy', c: 'var(--destroy)', list: [
    { id: 'meteor', name: 'Meteor', desc: 'Crater, firestorm, and a dust winter', key: 'X', mode: 'point' },
    { id: 'volcano', name: 'Volcano', desc: 'A mountain that pours lava for years', mode: 'point' },
    { id: 'lightning', name: 'Lightning', desc: 'Strike down one creature', key: 'L', mode: 'point' },
    { id: 'wildfire', name: 'Wildfire', desc: 'Set dry land ablaze', mode: 'point' },
    { id: 'plague', name: 'Plague', desc: 'A contagious virus that can mutate and jump species', key: 'P', mode: 'species' },
    { id: 'erase', name: 'Erase a species', desc: 'Wipe a species from existence', mode: 'species' },
    { id: 'drought', name: 'Drought', desc: 'Four years without rain, everywhere', mode: 'global' },
    { id: 'heatwave', name: 'Scorching sun', desc: 'Five years of heat, everywhere', mode: 'global' },
    { id: 'iceage', name: 'Ice age', desc: 'Ten years of cold. Snow spreads from the poles', mode: 'global' },
    { id: 'deluge', name: 'Deluge', desc: 'Six years of rising seas. Lowlands drown', mode: 'global' },
  ] },
  { id: 'bless', name: 'Bless', c: 'var(--bless)', list: [
    { id: 'gift', name: 'Grant a gift', desc: 'Give one creature a superpower', key: 'G', mode: 'creature' },
    { id: 'abundance', name: 'Abundance', desc: 'Rain fruit from the sky', mode: 'point' },
    { id: 'heal', name: 'Healing rain', desc: 'Cure disease, restore health', mode: 'point' },
    { id: 'fertility', name: 'Fertility', desc: 'A species bears more young for two years', mode: 'species' },
    { id: 'fire', name: 'Gift of fire', desc: 'Awaken a species to intelligence', mode: 'species' },
  ] },
  { id: 'speak', name: 'Speak', c: 'var(--speak)', list: [
    { id: 'messenger', name: 'Send a messenger', desc: 'A prophet carries your commandment to a species', key: 'V', mode: 'species' },
  ] },
  { id: 'incarnate', name: 'Incarnate', c: 'var(--incarnate)', list: [
    { id: 'incarnate', name: 'Become a creature', desc: 'Live one mortal life, and then another', key: 'I', mode: 'creature' },
  ] },
];
const POWER = {}; for (const cat of CATS) for (const p of cat.list) POWER[p.id] = { ...p, cat };
const GIFTS = [
  ['giant', 'Giant', 'Double its size. Its children grow larger too'],
  ['swift', 'Swiftness', 'Faster than anything alive'],
  ['immortal', 'Immortality', 'It will never age, and shrugs off wounds'],
  ['alpha', 'Leadership', 'Its kind will follow it anywhere'],
  ['fertile', 'Dynasty', 'Many children, again and again'],
  ['genius', 'Genius', 'A brilliant mind its descendants inherit'],
];
const COMMANDS = [
  ['migrate', 'Go forth', 'Lead them to a land you choose'],
  ['peace', 'Make peace', 'Hunters spare other creatures'],
  ['multiply', 'Be fruitful', 'Bear many young'],
  ['war', 'Wage war', 'Attack another species you choose'],
];

// ---------------------------------------------------------------- audio
const Snd = (() => {
  let ac = null, master = null, noiseBuf = null, amb = null;
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = App.sound ? .7 : 0;
      const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      ambient();
    } catch (e) { ac = null; }
  }
  function env(g, t0, a, peak, dur) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); }
  function tone(f, dur, type = 'sine', peak = .1, delay = 0, slide, attack = .01) {
    if (!ac) return; const t0 = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    env(g, t0, attack, peak, dur); o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + .05);
  }
  function noise(dur, type, f, q, peak, delay = 0, fTo, attack = .005) {
    if (!ac) return; const t0 = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q;
    if (fTo) fl.frequency.exponentialRampToValueAtTime(fTo, t0 + dur);
    const g = ac.createGain(); env(g, t0, attack, peak, dur);
    s.connect(fl); fl.connect(g); g.connect(master); s.start(t0, Math.random()); s.stop(t0 + dur + .05);
  }
  function chord(notes, dur, peak = .05, attack = .25) { notes.forEach((f, i) => { tone(f, dur, 'sine', peak, i * .04, null, attack); tone(f * 1.003, dur, 'triangle', peak * .4, i * .04, null, attack); }); }
  // a slow celestial drone under everything
  function ambient() {
    if (!ac || amb) return;
    const g = ac.createGain(); g.gain.value = .0; g.connect(master);
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; f.connect(g);
    for (const hz of [55, 82.4, 110.2, 164.8]) { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = hz; const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = .05 + Math.random() * .08; lg.gain.value = hz * .004; lfo.connect(lg); lg.connect(o.frequency); lfo.start(); o.connect(f); o.start(); }
    g.gain.setTargetAtTime(.035, ac.currentTime, 3);
    amb = g;
  }
  return {
    init, setOn(on) { if (master) master.gain.setTargetAtTime(on ? .7 : 0, ac.currentTime, .05); },
    click() { tone(1400, .04, 'sine', .03); },
    create() { chord([523, 659, 784, 1047], 1.4, .045, .05); },
    meteorIn() { noise(1.2, 'bandpass', 400, 1, .25, 0, 3000, .6); },
    impact() { noise(2.5, 'lowpass', 900, .7, .9, 0, 60); tone(50, 1.6, 'sine', .6, 0, 28); },
    bolt() { noise(.25, 'highpass', 2500, .8, .5); noise(1.4, 'lowpass', 500, .7, .45, .05, 80); },
    fire() { for (let i = 0; i < 6; i++) noise(.08, 'bandpass', 1500 + Math.random() * 2000, 3, .12, i * .07); },
    volcano() { noise(3, 'lowpass', 200, .7, .6, 0, 50, .3); tone(38, 3, 'sawtooth', .08, 0, 30, .3); },
    plague() { tone(220, 2, 'sine', .06, 0, 207, .4); tone(233, 2, 'sine', .05, .1, 220, .4); tone(311, 2.2, 'triangle', .03, .2, 293, .5); },
    bless() { chord([392, 494, 587, 784, 988], 2.4, .04, .35); },
    rain() { noise(3, 'highpass', 3000, .4, .08, 0, 5000, .6); },
    ice() { chord([1318, 1568, 1760, 2093], 2.5, .018, .5); noise(3, 'bandpass', 900, .5, .06, 0, 400, 1); },
    speak() { chord([294, 440, 587], 2.2, .045, .4); },
    erase() { tone(180, 2.4, 'sine', .15, 0, 60, .02); noise(2, 'lowpass', 500, .5, .15, 0, 60, .1); },
    species() { [880, 1109, 1319, 1760].forEach((f, i) => tone(f, .35, 'triangle', .035, i * .07)); },
    extinct() { tone(146.8, 3.5, 'sine', .12, 0, null, .01); tone(293.6, 3, 'sine', .04, 0, null, .01); tone(440, 2.4, 'sine', .015, 0, null, .01); },
    milestone() { chord([523, 659, 784, 1047, 1319], 3, .04, .1); },
    tribe() { for (let i = 0; i < 3; i++) { tone(90, .25, 'sine', .2, i * .22, 50); noise(.1, 'lowpass', 400, 1, .15, i * .22); } },
    bite() { noise(.08, 'bandpass', 900, 2, .2); },
    birth() { tone(660, .15, 'sine', .04); tone(990, .2, 'sine', .03, .08); },
    death() { tone(196, 2.5, 'sine', .1, 0, 98, .05); },
  };
})();

// ---------------------------------------------------------------- setup and camera
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1); W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
}
function minZoom() { const w = App.w; return w ? Math.min(W / w.W, H / w.H) * .95 : 4; }
function clampCam() {
  const w = App.w, c = App.cam; if (!w) return;
  c.zoom = clamp(c.zoom, minZoom(), 64);
  const hw = W / 2 / c.zoom, hh = H / 2 / c.zoom;
  c.cx = w.W < hw * 2 ? w.W / 2 : clamp(c.cx, hw - .5, w.W - hw - .5);
  c.cy = w.H < hh * 2 ? w.H / 2 : clamp(c.cy, hh - .5, w.H - hh - .5);
}
const toWorld = (px, py) => [(px - W / 2) / App.cam.zoom + App.cam.cx, (py - H / 2) / App.cam.zoom + App.cam.cy];
function flyTo(x, y, zoom) { App.flyTarget = { x, y, zoom: zoom || Math.max(App.cam.zoom, 12) }; }

// ---------------------------------------------------------------- world lifecycle
function newWorld(opts) {
  const w = createWorld({ seed: opts.seed, type: opts.type });
  seedLife(w, opts.life);
  App.w = w; App.grid = {}; App.snaps = []; App.lastSnapYear = -1; App.selected = 0; App.follow = 0; App.focusSp = 0;
  R.sprites.clear(); R.particles = [];
  bakeTerrain(w); updateVeg(w); w.terrainDirty = false; w.dirtyRects = [];
  App.cam.zoom = minZoom(); App.cam.cx = w.W / 2; App.cam.cy = w.H / 2;
  return w;
}
function startGame() {
  const type = $('#opt-world .opt[aria-pressed="true"]').dataset.v, life = $('#opt-life .opt[aria-pressed="true"]').dataset.v;
  const seed = parseInt($('#seed').value, 10) || (Math.random() * 1e9) | 0;
  newWorld({ seed, type, life });
  App.onTitle = false; App.speed = life === 'soup' ? 20 : 5; App.paused = false;
  document.body.classList.remove('on-title');
  $('#title').hidden = true; $('#hud').hidden = false; $('#dock').hidden = false; $('#panel').hidden = !App.panel;
  setSpeedButtons(); Snd.init(); Snd.create();
  toast(life === 'empty' ? 'An empty world. Open Create to make your first species.' : life === 'soup' ? 'Life begins as tiny cells in the shallows. Speed up time and watch them evolve.' : `The world of ${App.w.name}. Click any creature to meet it.`, 5000);
  renderPanel(true);
}
function titleBackdrop() {
  const w = newWorld({ seed: (Math.random() * 1e9) | 0, type: 'continent', life: 'default' });
  for (let k = 0; k < 240; k++) stepWorld(w, App.grid);
  bakeTerrain(w); updateVeg(w);
  App.cam.zoom = minZoom() * 1.6; App.cam.cx = w.W * .45; App.cam.cy = w.H * .5;
  App.speed = 3;
}

// ---------------------------------------------------------------- main loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  App.t += dt; App.frame++;
  const w = App.w;
  if (w) {
    // simulate
    if (!App.paused) {
      const t0 = performance.now();
      const steps = App.speed;
      for (let k = 0; k < steps; k++) {
        stepWorld(w, App.grid);
        if (performance.now() - t0 > 24) break;
      }
    }
    handleEvents(w);
    // yearly snapshots for rewinding
    const year = Math.floor(w.tick / TPY);
    if (!App.onTitle && year !== App.lastSnapYear) {
      App.lastSnapYear = year;
      App.snaps.push({ year, data: snapshot(w) });
      if (App.snaps.length > 40) App.snaps.splice(App.snaps.length > 60 ? 0 : 1, 1);
    }
    // terrain updates
    if (w.terrainDirty) { bakeTerrain(w); w.terrainDirty = false; w.dirtyRects = []; }
    else if (w.dirtyRects.length) { for (const r of w.dirtyRects.splice(0, 6)) bakeTerrain(w, r); }
    if (App.frame % 6 === 0) updateVeg(w);
    // camera: follow a creature, fly to targets, keyboard pan
    camera(dt);
    R.shake *= Math.pow(.02, dt); R.flash *= Math.pow(.01, dt);
    updateParticles(dt);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    renderWorld(ctx, w, { W, H, cx: App.cam.cx, cy: App.cam.cy, zoom: App.cam.zoom, t: App.t }, { selected: App.selected, focusSp: App.focusSp, overlay: App.overlay, speed: App.paused ? 1 : App.speed });
    drawCursor();
    if (!App.onTitle && App.frame % 8 === 0) updateHud();
    if (!App.onTitle && App.frame % 10 === 0) { updateInspector(); updateIncarn(); }
    if (!App.onTitle && App.frame % 45 === 0) renderPanel(false);
  }
  requestAnimationFrame(frame);
}
function camera(dt) {
  const c = App.cam, w = App.w;
  if (App.onTitle) { c.cx += Math.cos(App.t * .05) * dt * 2.5; c.cy += Math.sin(App.t * .07) * dt * 1.2; clampCam(); return; }
  const fid = w.player || App.follow;
  if (fid) {
    const cr = crById(w, fid);
    if (cr) { c.cx += (cr.x - c.cx) * Math.min(1, dt * 4); c.cy += (cr.y - c.cy) * Math.min(1, dt * 4); if (w.player && c.zoom < 20) c.zoom += (22 - c.zoom) * Math.min(1, dt * 2); }
    else if (!w.player) App.follow = 0;
  }
  if (App.flyTarget) {
    const f = App.flyTarget, k = Math.min(1, dt * 3.5);
    c.cx += (f.x - c.cx) * k; c.cy += (f.y - c.cy) * k; c.zoom += (f.zoom - c.zoom) * k;
    if (Math.hypot(f.x - c.cx, f.y - c.cy) < .2 && Math.abs(f.zoom - c.zoom) < .1) App.flyTarget = null;
  }
  // keyboard panning
  if (!w.player) {
    const sp = 420 / c.zoom * dt;
    if (keys.has('arrowleft') || keys.has('a')) c.cx -= sp;
    if (keys.has('arrowright') || keys.has('d')) c.cx += sp;
    if (keys.has('arrowup') || keys.has('w')) c.cy -= sp;
    if (keys.has('arrowdown') || keys.has('s')) c.cy += sp;
  } else {
    let dx = 0, dy = 0;
    if (keys.has('arrowleft') || keys.has('a')) dx--; if (keys.has('arrowright') || keys.has('d')) dx++;
    if (keys.has('arrowup') || keys.has('w')) dy--; if (keys.has('arrowdown') || keys.has('s')) dy++;
    w.input.dx = dx; w.input.dy = dy; w.input.bite = keys.has(' '); w.input.mate = keys.has('e');
    if (!w.input.mate) w.input._warned = false;
  }
  // brush powers paint while the mouse is held
  if (App.power && POWER[App.power].mode === 'brush' && App.pointer.down && App.frame % 3 === 0) {
    const [x, y] = toWorld(App.pointer.x, App.pointer.y);
    if (App.power === 'forest') GOD.forest(w, x, y, App.brush);
    else GOD.terraform(w, x, y, App.brush, App.power === 'raise' ? 1 : -1);
  }
  clampCam();
}
function drawCursor() {
  if (App.onTitle || !App.power || !App.pointer.inside) return;
  const p = POWER[App.power];
  const r = p.mode === 'brush' ? App.brush * App.cam.zoom : p.id === 'meteor' ? 8.4 * App.cam.zoom : p.id === 'abundance' ? 9 * App.cam.zoom : p.id === 'heal' ? 12 * App.cam.zoom : p.id === 'rain' || p.id === 'rays' ? 14 * App.cam.zoom : 14;
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue(p.cat.c.slice(4, -1)) || '#fff';
  ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]);
  ctx.beginPath(); ctx.arc(App.pointer.x, App.pointer.y, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  if (p.mode === 'species' || p.mode === 'creature') {
    const c = nearestCreature(...toWorld(App.pointer.x, App.pointer.y), 22 / App.cam.zoom + 1);
    if (c) { const sx = (c.x - App.cam.cx) * App.cam.zoom + W / 2, sy = (c.y - App.cam.cy) * App.cam.zoom + H / 2; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, c.r * App.cam.zoom * 1.6 + 6, 0, Math.PI * 2); ctx.stroke(); }
  }
}

// ---------------------------------------------------------------- events from the world
const TICK_ICON = { species: '✦', extinct: '✝', milestone: '★', sapience: '☀', tribe: '⌂', faith: '✧', plague: '☣', hint: '•', death: '•' };
function handleEvents(w) {
  if (!w.events.length) return;
  const evs = w.events.splice(0);
  if (App.onTitle) return;
  for (const e of evs) {
    if (e.type === 'milestone') { const m = MILESTONES.find(x => x[0] === e.id); ticker(`Goal reached: ${m ? m[1] : e.text}`, 'milestone'); Snd.milestone(); renderPanel(true); }
    else if (e.type === 'species') { ticker(e.text, 'species'); Snd.species(); }
    else if (e.type === 'extinct') { ticker(e.text, 'extinct'); Snd.extinct(); }
    else if (e.type === 'sapience' || e.type === 'tribe' || e.type === 'faith') { ticker(e.text, e.type); Snd.tribe(); }
    else if (e.type === 'plague' && (/jumped/.test(e.text) || (/mutated/.test(e.text) && / (I|II|III)\.$/.test(e.text)))) { ticker(e.text, 'plague'); }
    else if (e.type === 'hint') toast(e.text);
    else if (e.type === 'playerDied') playerDied(e);
    else if (e.type === 'death' && e.text.includes('blessed') === false && e.text) ticker(e.text, 'death');
  }
}
const recentTicks = new Map();
function ticker(text, type) {
  const box = $('#ticker');
  const now = performance.now(); if (recentTicks.get(text) > now - 12000) return; recentTicks.set(text, now);
  const d = document.createElement('div'); d.className = 'tick t-' + type;
  d.innerHTML = `<i>${TICK_ICON[type] || '•'}</i>`; d.appendChild(document.createTextNode(text));
  box.prepend(d);
  while (box.children.length > 3) box.lastChild.remove();
  setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 400); }, 5200);
}
let toastT = 0;
function toast(msg, ms = 3200) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }

// ---------------------------------------------------------------- HUD
const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
function updateHud() {
  const w = App.w, cl = w.climate;
  $('#hud-name').textContent = w.name;
  $('#hud-year').textContent = `Year ${Math.floor(w.tick / TPY)}`;
  $('#hud-season').textContent = SEASONS[Math.floor((w.tick % TPY) / TPY * 4)];
  let climate = 'Mild';
  if (cl.dust > .15) climate = 'Dust winter'; else if (cl.temp < -.15) climate = 'Ice age'; else if (cl.temp > .08) climate = 'Scorching'; else if (cl.drought > .3) climate = 'Drought'; else if (cl.sea > .03) climate = 'Rising seas';
  $('#hud-climate').textContent = climate;
  $('#hud-pop').textContent = w.creatures.length.toLocaleString();
  $('#hud-spp').textContent = w.species.filter(s => !s.extinct && s.announced).length;
}
function setSpeedButtons() {
  document.querySelectorAll('.spd').forEach(b => b.setAttribute('aria-pressed', !App.paused && +b.dataset.speed === App.speed ? 'true' : 'false'));
  $('#btn-pause').setAttribute('aria-pressed', App.paused ? 'true' : 'false');
  $('#btn-pause').innerHTML = App.paused ? '<svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>';
}

// ---------------------------------------------------------------- powers dock
function buildDock() {
  const dock = $('#dock'); dock.innerHTML = '';
  for (const cat of CATS) {
    const b = document.createElement('button');
    b.className = 'cat'; b.style.setProperty('--c', cat.c); b.dataset.cat = cat.id;
    b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-label', cat.name);
    b.innerHTML = ICON[cat.id] + `<span class="lbl">${cat.name}</span>`;
    b.addEventListener('click', () => { Snd.init(); if (cat.id === 'incarnate') { armPower('incarnate'); closeFlyout(); return; } toggleFlyout(cat, b); });
    dock.appendChild(b);
  }
}
function toggleFlyout(cat, btn) {
  const fly = $('#flyout');
  if (!fly.hidden && fly.dataset.cat === cat.id) { closeFlyout(); return; }
  document.querySelectorAll('.cat').forEach(x => x.setAttribute('aria-expanded', x === btn ? 'true' : 'false'));
  fly.dataset.cat = cat.id; fly.style.setProperty('--c', cat.c);
  fly.innerHTML = `<div class="fly-head">${cat.name}</div>` + cat.list.map(p => `<button class="pw" data-p="${p.id}" aria-pressed="${App.power === p.id}"><span class="ic">${ICON[p.id]}</span><span><b>${p.name}</b><span>${p.desc}</span></span>${p.key ? `<kbd>${p.key}</kbd>` : ''}</button>`).join('');
  fly.querySelectorAll('.pw').forEach(b => b.addEventListener('click', () => { armPower(b.dataset.p); }));
  fly.hidden = false;
  const r = btn.getBoundingClientRect();
  if (window.innerWidth > 900) fly.style.top = Math.max(70, Math.min(r.top - 10, window.innerHeight - fly.offsetHeight - 12)) + 'px';
}
function closeFlyout() { $('#flyout').hidden = true; document.querySelectorAll('.cat').forEach(x => x.setAttribute('aria-expanded', 'false')); }
function armPower(id) {
  const p = POWER[id]; const w = App.w;
  if (w.player && id !== 'incarnate') { toast('You are mortal right now. Ascend (Q) to use your powers.'); return; }
  Snd.click();
  if (p.mode === 'designer') { closeFlyout(); openDesigner(); return; }
  if (p.mode === 'global') { closeFlyout(); castGlobal(id); return; }
  if (App.power === id) { disarm(); return; }
  App.power = id; App.flow = null;
  document.body.classList.add('aiming');
  const hint = $('#power-hint'); hint.style.setProperty('--c', p.cat.c);
  const how = { point: 'Click the world where it should happen.', brush: 'Click and drag to paint. [ and ] change the brush size.', species: 'Click a creature to choose its species.', creature: 'Click a creature.' }[p.mode];
  $('#ph-name').textContent = p.name; $('#ph-text').textContent = how;
  hint.hidden = false;
  if (window.innerWidth <= 900) closeFlyout();
  else document.querySelectorAll('#flyout .pw').forEach(b => b.setAttribute('aria-pressed', b.dataset.p === id ? 'true' : 'false'));
}
function disarm() {
  App.power = null; App.flow = null; App.placeGenes = null;
  document.body.classList.remove('aiming'); $('#power-hint').hidden = true; $('#popover').hidden = true;
  document.querySelectorAll('#flyout .pw').forEach(b => b.setAttribute('aria-pressed', 'false'));
}
function setHint(name, text) { $('#ph-name').textContent = name; $('#ph-text').textContent = text; $('#power-hint').hidden = false; }
function castGlobal(id) {
  const w = App.w;
  if (id === 'drought') { GOD.drought(w); Snd.fire(); toast('Drought. For four years the rain will not come.'); }
  if (id === 'heatwave') { GOD.heatwave(w); Snd.fire(); toast('The sun burns hotter. Creatures without fur will thrive; the woolly ones will suffer.'); }
  if (id === 'iceage') { GOD.iceAge(w); Snd.ice(); toast('An ice age begins. Watch the snow spread, and watch fur grow thicker.'); }
  if (id === 'deluge') { GOD.deluge(w); Snd.rain(); toast('The seas are rising. Coasts and lowlands will drown.'); }
}
function nearestCreature(x, y, maxD) {
  let best = null, bd = maxD * maxD;
  for (const c of App.w.creatures) { const d = (c.x - x) ** 2 + (c.y - y) ** 2; if (d < bd) { bd = d; best = c; } }
  return best;
}
// Carry out the armed power at a point on the world.
function usePower(x, y, sx, sy) {
  const w = App.w, id = App.power, p = POWER[id];
  const pick = () => nearestCreature(x, y, 22 / App.cam.zoom + 1);
  if (App.placeGenes) {
    const i = tileAt(w, x, y); const probe = { g: App.placeGenes };
    if (i < 0 || passFactor(probe, w.biome[i]) < .3) { toast(App.placeGenes[G.aquatic] > .6 ? 'They can only live in water. Place them in the sea.' : 'They need land to live on. Try somewhere else.'); Snd.click(); return; }
    const sp = spawnSpecies(w, Float32Array.from(App.placeGenes), x, y, App.placeCount);
    Snd.create(); for (let k = 0; k < 20; k++) puff({ type: 'spark', x: x + (Math.random() - .5) * 5, y: y + (Math.random() - .5) * 5, vx: 0, vy: -1, life: 0, max: 1.5, col: '120,240,220' });
    focusSpecies(sp.id); disarm(); return;
  }
  // flows that need a second click
  if (App.flow) {
    const f = App.flow;
    if (f.step === 'destination') { GOD.messenger(w, f.x, f.y, f.sp, { type: 'migrate', x, y }); Snd.speak(); disarm(); return; }
    if (f.step === 'enemy') { const c = pick(); if (!c || c.sp === f.sp) { toast('Click a creature of another species to be their enemy.'); return; } GOD.messenger(w, f.x, f.y, f.sp, { type: 'war', sp: c.sp }); Snd.speak(); disarm(); return; }
  }
  switch (id) {
    case 'soup': GOD.soup(w, x, y); Snd.create(); break;
    case 'rain': GOD.rain(w, x, y); Snd.rain(); break;
    case 'rays': GOD.rays(w, x, y); Snd.ice(); break;
    case 'meteor': GOD.meteor(w, x, y, 1.2); Snd.meteorIn(); setTimeout(() => Snd.impact(), 45 / Math.max(1, App.speed) * 16.7 + 150); break;
    case 'volcano': GOD.volcano(w, x, y); Snd.volcano(); break;
    case 'lightning': GOD.lightning(w, x, y); Snd.bolt(); break;
    case 'wildfire': GOD.wildfire(w, x, y); Snd.fire(); break;
    case 'abundance': GOD.abundance(w, x, y); Snd.bless(); break;
    case 'heal': GOD.heal(w, x, y); Snd.bless(); break;
    case 'plague': { const c = pick(); if (!c) { toast('Click a creature: the plague starts with it.'); return; } GOD.plague(w, c.x, c.y); Snd.plague(); break; }
    case 'erase': { const c = pick(); if (!c) { toast('Click a creature of the species to erase.'); return; } const sp = spById(w, c.sp); if (App.eraseArm !== sp.id) { App.eraseArm = sp.id; toast(`Click again to erase the ${sp.name} forever.`); return; } App.eraseArm = 0; GOD.eraseSpecies(w, sp.id); Snd.erase(); break; }
    case 'fertility': { const c = pick(); if (!c) { toast('Click a creature to bless its species.'); return; } GOD.fertility(w, c.sp); Snd.bless(); break; }
    case 'fire': { const c = pick(); if (!c) { toast('Click a creature to awaken its species.'); return; } GOD.fireGift(w, c.sp); Snd.bless(); flyTo(c.x, c.y, 16); break; }
    case 'gift': { const c = pick(); if (!c) { toast('Click a creature to choose who receives your gift.'); return; } openGifts(c, sx, sy); return; }
    case 'messenger': { const c = pick(); if (!c) { toast('Click a creature: your messenger goes to its species.'); return; } openCommands(c, sx, sy); return; }
    case 'incarnate': { const c = pick(); if (!c) { toast('Click the creature you want to become.'); return; } incarnate(c); disarm(); return; }
    case 'forest': case 'raise': case 'lower': return;
  }
  if (p.mode !== 'brush') disarm();
}
function openPopover(html, sx, sy) {
  const pop = $('#popover'); pop.innerHTML = html; pop.hidden = false;
  const r = pop.getBoundingClientRect();
  pop.style.left = clamp(sx + 14, 8, W - r.width - 8) + 'px'; pop.style.top = clamp(sy - 20, 60, H - r.height - 8) + 'px';
  return pop;
}
function openGifts(c, sx, sy) {
  const pop = openPopover(`<div class="fly-head" style="--c:var(--bless)">A gift for ${c.name || 'this ' + spById(App.w, c.sp).name.split(' ').pop().toLowerCase()}</div>` + GIFTS.map(([k, n, d]) => `<button class="pw" data-g="${k}" style="--c:var(--bless)"><span class="ic">${ICON.gift}</span><span><b>${n}</b><span>${d}</span></span></button>`).join(''), sx, sy);
  pop.querySelectorAll('.pw').forEach(b => b.addEventListener('click', () => { GOD.bless(App.w, c, b.dataset.g); Snd.bless(); App.selected = c.id; disarm(); updateInspector(true); }));
}
function openCommands(c, sx, sy) {
  const sp = spById(App.w, c.sp);
  const pop = openPopover(`<div class="fly-head" style="--c:var(--speak)">Command the ${sp.name}</div>` + COMMANDS.map(([k, n, d]) => `<button class="pw" data-k="${k}" style="--c:var(--speak)"><span class="ic">${ICON.messenger}</span><span><b>${n}</b><span>${d}</span></span></button>`).join(''), sx, sy);
  pop.querySelectorAll('.pw').forEach(b => b.addEventListener('click', () => {
    pop.hidden = true;
    const k = b.dataset.k;
    if (k === 'migrate') { App.flow = { step: 'destination', sp: c.sp, x: c.x, y: c.y }; setHint('Go forth', 'Click the land they should journey to.'); return; }
    if (k === 'war') { App.flow = { step: 'enemy', sp: c.sp, x: c.x, y: c.y }; setHint('Wage war', 'Click a creature of the species they should attack.'); return; }
    GOD.messenger(App.w, c.x, c.y, c.sp, { type: k }); Snd.speak(); disarm();
  }));
}

// ---------------------------------------------------------------- incarnation
function incarnate(c) {
  const w = App.w;
  w.player = c.id; w.playerLineage = [];
  if (!c.name) c.name = personName(w);
  App.incGen0 = App.incGen0 && w.playerBloodline ? App.incGen0 : c.gen; w.playerBloodline = true;
  App.selected = 0; App.follow = 0; closeInspector();
  $('#incarn').hidden = false; document.body.classList.add('mortal');
  document.querySelectorAll('.cat').forEach(b => { if (b.dataset.cat !== 'incarnate') b.disabled = true; });
  if (App.speed > 5) { App.speed = 1; setSpeedButtons(); }
  logEvent(w, 'speak', `You were born into the world as ${c.name} of the ${spById(w, c.sp).name}.`, { x: c.x, y: c.y, sp: c.sp });
  milestone(w, 'incarnate', 'You lived a mortal life.');
  Snd.bless(); toast(`You are ${c.name}. Move with W A S D. Eat, survive, find a mate.`, 4500);
}
function ascend() {
  const w = App.w; if (!w.player) return;
  w.player = 0; w.playerBloodline = false; App.incGen0 = 0;
  $('#incarn').hidden = true; $('#death').hidden = true; document.body.classList.remove('mortal');
  document.querySelectorAll('.cat').forEach(b => { b.disabled = false; });
  w.input.dx = w.input.dy = 0;
  Snd.speak(); toast('You return to the heavens.');
}
function playerDied(e) {
  const w = App.w;
  const heirs = w.playerLineage.map(id => crById(w, id)).filter(Boolean).sort((a, b) => b.age - a.age).slice(0, 5);
  $('#death-text').textContent = `You died of ${e.text} at the age of ${(e.age / TPY).toFixed(1)}. ${heirs.length ? `${heirs.length === 1 ? 'One of your children lives on' : `${heirs.length} of your children live on`}.` : 'You leave no children behind.'}`;
  const box = $('#death-heirs'); box.innerHTML = '';
  for (const h of heirs) {
    if (!h.name) h.name = personName(w);
    const b = document.createElement('button');
    b.textContent = `Be reborn as ${h.name}, ${(h.age / TPY).toFixed(1)} years old, generation ${h.gen}`;
    b.addEventListener('click', () => { $('#death').hidden = true; w.player = 0; incarnate(h); if (h.gen - App.incGen0 >= 5) milestone(w, 'dynasty', 'Dynasty.'); });
    box.appendChild(b);
  }
  $('#death').hidden = false; Snd.death();
  App.paused = true; setSpeedButtons();
}
function updateIncarn() {
  const w = App.w; if (!w.player) return;
  const c = crById(w, w.player); if (!c) return;
  const sp = spById(w, c.sp);
  $('#inc-name').textContent = c.name;
  $('#inc-sub').textContent = `${sp.name} · generation ${c.gen} · ${c.kids} children · ${c.kills} kills`;
  $('#inc-energy').style.width = clamp(c.energy / c.maxE * 100, 0, 100) + '%';
  $('#inc-health').style.width = clamp(c.health * 100, 0, 100) + '%';
  $('#inc-age').style.width = clamp(c.age / c.life * 100, 0, 100) + '%';
  $('#inc-energy').style.background = c.energy / c.maxE < .25 ? '#ff7148' : 'var(--create)';
  drawPortrait($('#inc-portrait'), sp);
}

// ---------------------------------------------------------------- inspector
function selectCreature(c) { App.selected = c ? c.id : 0; updateInspector(true); }
function closeInspector() { App.selected = 0; $('#inspector').hidden = true; }
const GENE_SHOW = [G.size, G.speed, G.sight, G.diet, G.fur, G.aquatic, G.aggr, G.herd, G.fert, G.life, G.resist, G.intel];
function geneBars(g) { return GENE_SHOW.map(k => `<div class="gene">${GENE_INFO[k][1]}<i><b style="width:${Math.round(g[k] * 100)}%"></b></i><em>${Math.round(g[k] * 100)}</em></div>`).join(''); }
function roleOf(g) {
  const diet = g[G.diet] > .65 ? 'Hunter' : g[G.diet] > .35 ? 'Omnivore' : 'Plant-eater';
  const home = g[G.aquatic] > .7 ? 'of the sea' : g[G.aquatic] > .45 ? 'of the marshes' : 'of the land';
  return `${diet} ${home}`;
}
function updateInspector(force) {
  const w = App.w, box = $('#inspector');
  if (!App.selected) { box.hidden = true; return; }
  const c = crById(w, App.selected);
  if (!c) { if (force || !box.hidden) { box.querySelector('.ins-status') && (box.querySelector('.ins-status').innerHTML = '<span>This creature has died.</span>'); } return; }
  const sp = spById(w, c.sp);
  if (!c.name) c.name = personName(w);
  const tribe = c.tribe ? w.tribes.find(t => t.id === c.tribe) : null;
  const gifts = GIFTS.filter((g, i) => c.bless & (1 << i)).map(g => g[1]);
  const status = [ST_TEXT[c.st], c.inf ? `<span style="color:#b9ff9c">Sick with ${w.strains[c.inf - 1].name}</span>` : '', c.belief ? `<span style="color:#d6c8ff">Believes: ${({ migrate: 'go forth', peace: 'make peace', multiply: 'be fruitful', war: 'wage war' })[c.belief.type]}</span>` : '', tribe ? `<span style="color:#ffcf9a">Of ${tribe.name}</span>` : '', gifts.length ? `<span style="color:#f7df9d">Gifted: ${gifts.join(', ')}</span>` : ''].filter(Boolean).map(x => x.startsWith('<') ? x : `<span>${x}</span>`).join('');
  if (force || box.hidden || box.dataset.id !== String(c.id)) {
    box.dataset.id = c.id;
    box.innerHTML = `
      <button class="tbtn ins-close" id="ins-close" aria-label="Close">×</button>
      <div class="ins-head"><canvas id="ins-portrait" width="152" height="152"></canvas>
        <div><h3>${c.name}</h3><button class="link" id="ins-sp">${sp.name}</button><p><i>${sp.sci}</i> · ${roleOf(c.g)}</p><p id="ins-life"></p></div></div>
      <div class="ins-status" id="ins-status"></div>
      <div class="bars"><label>Energy<i><em id="ins-e"></em></i></label><label>Health<i><em id="ins-h"></em></i></label><label>Age<i><em id="ins-a" style="background:var(--speak)"></em></i></label></div>
      <details class="ins-genes"><summary class="dim">Genes</summary>${geneBars(c.g)}</details>
      <div class="ins-acts">
        <button class="btn a-inc" id="ins-inc">Incarnate</button>
        <button class="btn" id="ins-follow">${App.follow === c.id ? 'Stop following' : 'Follow'}</button>
        <button class="btn a-bless" id="ins-gift">Grant a gift</button>
        <button class="btn a-destroy" id="ins-smite">Smite</button>
        <button class="btn a-speak" id="ins-msg">Send a messenger</button>
      </div>`;
    drawPortrait($('#ins-portrait'), sp, c);
    $('#ins-close').onclick = closeInspector;
    $('#ins-sp').onclick = () => { App.panel = true; $('#panel').hidden = false; showTab('life'); focusSpecies(sp.id); };
    $('#ins-inc').onclick = () => incarnate(c);
    $('#ins-follow').onclick = () => { App.follow = App.follow === c.id ? 0 : c.id; updateInspector(true); };
    $('#ins-gift').onclick = e => { const r = e.target.getBoundingClientRect(); openGifts(c, r.right, r.top); };
    $('#ins-smite').onclick = () => { GOD.lightning(App.w, c.x, c.y); Snd.bolt(); };
    $('#ins-msg').onclick = e => { const r = e.target.getBoundingClientRect(); openCommands(c, r.right, r.top); };
    box.hidden = false;
  }
  const parents = c.parents.map(id => crById(w, id)).filter(Boolean).map(p => p.name || 'a parent');
  $('#ins-life').textContent = `Generation ${c.gen} · ${(c.age / TPY).toFixed(1)} years old · ${c.kids} children${c.kills ? ` · ${c.kills} kills` : ''}${parents.length ? ` · child of ${parents.join(' & ')}` : ''}`;
  $('#ins-status').innerHTML = status;
  $('#ins-e').style.width = clamp(c.energy / c.maxE * 100, 0, 100) + '%';
  $('#ins-h').style.width = clamp(c.health * 100, 0, 100) + '%';
  $('#ins-a').style.width = clamp(c.age / c.life * 100, 0, 100) + '%';
}
function drawPortrait(canvas, sp, c) {
  const x = canvas.getContext('2d'), s = canvas.width;
  x.clearRect(0, 0, s, s);
  const g = c ? c.g : sp.mean;
  const spr = drawCreatureSprite(g, sp.hue, ((App.t * 4) | 0) % 4, 128);
  x.save(); x.translate(s / 2, s / 2); x.rotate(-Math.PI / 2); x.drawImage(spr, -s / 2, -s / 2, s, s); x.restore();
}

// ---------------------------------------------------------------- side panel
let currentTab = 'life', openSp = 0;
function showTab(id) {
  currentTab = id;
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === id ? 'true' : 'false'));
  document.querySelectorAll('.tab-body').forEach(b => { b.hidden = b.id !== 'tab-' + id; });
  renderPanel(true);
}
function focusSpecies(id) {
  App.focusSp = App.focusSp === id ? 0 : id; openSp = App.focusSp;
  const members = App.w.creatures.filter(c => c.sp === id);
  if (members.length && App.focusSp) { const mx = members.reduce((a, c) => a + c.x, 0) / members.length, my = members.reduce((a, c) => a + c.y, 0) / members.length; flyTo(mx, my, Math.max(App.cam.zoom, 9)); }
  renderPanel(true);
}
function renderPanel(force) {
  if (!App.panel || !App.w || App.onTitle) return;
  const w = App.w;
  if (currentTab === 'life') renderLife(w, force);
  else if (currentTab === 'chron') renderChron(w, force);
  else if (currentTab === 'tree') drawTree(w);
  else if (currentTab === 'graph') drawGraph(w);
  else if (currentTab === 'goals' && force) renderGoals(w);
  else if (currentTab === 'see' && force) renderLenses(w);
}
function renderLife(w, force) {
  const box = $('#tab-life');
  const list = w.species.filter(s => !s.extinct && s.pop > 0 && (s.announced || s.pop >= 3)).sort((a, b) => b.pop - a.pop);
  const sig = list.map(s => s.id + ':' + s.pop).join(',') + '|' + openSp;
  if (!force && box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  if (!list.length) { box.innerHTML = '<p class="tab-note">No life yet. Open <b class="c-create">Create</b> and design a species, or stir the primordial soup.</p>'; return; }
  box.innerHTML = list.map(s => {
    const g = s.mean;
    const traits = [g[G.diet] > .65 ? 'Hunter' : g[G.diet] > .35 ? 'Omnivore' : 'Grazer', g[G.aquatic] > .7 ? 'Sea' : g[G.aquatic] > .45 ? 'Marsh' : 'Land', g[G.fur] > .6 ? 'Woolly' : '', g[G.size] > .7 ? 'Huge' : g[G.size] < .2 ? 'Tiny' : '', s.sapient ? '<span class="sap">Intelligent</span>' : ''].filter(Boolean).map(t => t.startsWith('<') ? t : `<span>${t}</span>`).join('');
    const par = spById(w, s.parent);
    return `<button class="sp-row" data-sp="${s.id}" aria-pressed="${App.focusSp === s.id}"><canvas width="88" height="88"></canvas><span><b>${s.name}</b><em>${s.sci}${s.announced ? '' : ' · emerging'}</em><span class="traits">${traits}</span></span><span class="count">${s.pop}<small>alive</small></span></button>` +
      (openSp === s.id ? `<div class="sp-detail"><p class="tab-note" style="margin:0 0 6px">${s.founder}${par ? '' : ''}. Appeared in year ${Math.floor(s.born / TPY)}, peak ${s.peak}.</p>${geneBars(g)}<div class="acts"><button class="btn btn-small" data-act="follow">Follow one</button><button class="btn btn-small a-bless" data-act="fire">${s.sapient ? 'Already awake' : 'Gift of fire'}</button><button class="btn btn-small a-bless" data-act="fertility">Fertility</button><button class="btn btn-small a-destroy" data-act="plague">Plague</button><button class="btn btn-small a-destroy" data-act="erase">Erase</button></div></div>` : '');
  }).join('');
  box.querySelectorAll('.sp-row').forEach(b => {
    const sp = spById(w, +b.dataset.sp);
    const cvs = b.querySelector('canvas'); const x = cvs.getContext('2d'); const spr = spriteFor(sp);
    x.save(); x.translate(44, 44); x.rotate(-Math.PI / 2); x.drawImage(spr.frames[0], -44, -44, 88, 88); x.restore();
    b.addEventListener('click', () => focusSpecies(sp.id));
  });
  box.querySelectorAll('.sp-detail [data-act]').forEach(b => b.addEventListener('click', () => {
    const sp = spById(w, openSp), one = w.creatures.find(c => c.sp === openSp); if (!sp || !one) return;
    const a = b.dataset.act;
    if (a === 'follow') { App.follow = one.id; selectCreature(one); flyTo(one.x, one.y, 16); }
    if (a === 'fire' && !sp.sapient) { GOD.fireGift(w, sp.id); Snd.bless(); }
    if (a === 'fertility') { GOD.fertility(w, sp.id); Snd.bless(); }
    if (a === 'plague') { GOD.plague(w, one.x, one.y); Snd.plague(); flyTo(one.x, one.y); }
    if (a === 'erase') { if (App.eraseArm !== sp.id) { App.eraseArm = sp.id; b.textContent = 'Click to confirm'; return; } App.eraseArm = 0; GOD.eraseSpecies(w, sp.id); Snd.erase(); }
    renderPanel(true);
  }));
}
function renderChron(w, force) {
  const box = $('#tab-chron');
  if (!force && box.dataset.n === String(w.log.length)) return;
  box.dataset.n = w.log.length;
  const items = w.log.slice(-250).reverse();
  box.innerHTML = '<ul class="chron">' + items.map((e, i) => `<li class="${e.x != null ? 'go' : ''}" data-i="${i}"><time>Yr ${Math.floor(e.t / TPY)}</time><span class="t-${e.type}">${e.text}</span></li>`).join('') + '</ul>';
  box.querySelectorAll('li.go').forEach(li => li.addEventListener('click', () => { const e = items[+li.dataset.i]; flyTo(e.x, e.y, Math.max(App.cam.zoom, 12)); }));
}
function renderGoals(w) {
  $('#tab-goals').innerHTML = MILESTONES.map(([id, name, desc]) => {
    const t = w.milestones[id];
    return `<div class="goal ${t != null ? 'done' : ''}"><span class="mk">${t != null ? '✓' : ''}</span><span><b>${name}</b><span>${desc}</span></span>${t != null ? `<time>Yr ${Math.floor(t / TPY)}</time>` : ''}</div>`;
  }).join('');
}
function renderLenses(w) {
  const lenses = [[null, 'Natural', 'The world as it is'], ['temp', 'Temperature', 'Blue is cold, red is hot'], ['food', 'Food', 'Where the plants are richest'], ['disease', 'Disease', 'Who is sick right now']];
  const genes = [G.size, G.speed, G.diet, G.fur, G.aquatic, G.intel, G.aggr, G.resist];
  $('#tab-see').innerHTML = `<div class="see-h">Lens</div><div class="lens">${lenses.map(([k, n, d]) => `<button data-o="${k}" aria-pressed="${App.overlay === k}">${n}<span>${d}</span></button>`).join('')}</div>
    <div class="see-h">Colour creatures by a gene</div><div class="lens">${genes.map(k => `<button data-o="gene:${k}" aria-pressed="${App.overlay === 'gene:' + k}">${GENE_INFO[k][1]}<span>purple low, red high</span></button>`).join('')}</div>
    <div class="see-h">Laws of nature</div>
    <label class="row-range">Pace of evolution <output id="mut-out">${(w.mutation || 1).toFixed(1)}×</output><input type="range" id="mut" min="0.2" max="4" step="0.1" value="${w.mutation || 1}"></label>`;
  $('#tab-see').querySelectorAll('[data-o]').forEach(b => b.addEventListener('click', () => { const v = b.dataset.o; App.overlay = v === 'null' ? null : v; renderLenses(w); }));
  $('#mut').addEventListener('input', e => { w.mutation = +e.target.value; $('#mut-out').textContent = w.mutation.toFixed(1) + '×'; });
}
function sizeCanvas(c, hCss) { const r = c.getBoundingClientRect(); const wCss = Math.max(200, r.width); c.style.height = hCss + 'px'; c.width = Math.round(wCss * DPR); c.height = Math.round(hCss * DPR); const x = c.getContext('2d'); x.setTransform(DPR, 0, 0, DPR, 0, 0); return [x, wCss, hCss]; }
// The tree of life: time on x, species as lanes, branches from parents.
function drawTree(w) {
  const shown = w.species.filter(s => s.announced || s.peak >= 5);
  const c = $('#tree-canvas');
  const lanes = []; const kids = new Map();
  for (const s of shown) { const p = shown.find(x => x.id === s.parent) ? s.parent : 0; if (!kids.has(p)) kids.set(p, []); kids.get(p).push(s); }
  const walk = p => { for (const s of (kids.get(p) || []).sort((a, b) => a.born - b.born)) { lanes.push(s); walk(s.id); } };
  walk(0);
  const [x, cw, ch] = sizeCanvas(c, Math.max(220, lanes.length * 22 + 30));
  x.clearRect(0, 0, cw, ch);
  const T = Math.max(w.tick, TPY), X = t => 12 + t / T * (cw - 24), Y = i => 16 + i * 22;
  x.font = '500 10px "JetBrains Mono", monospace'; x.fillStyle = 'rgba(236,235,246,.4)';
  for (let yr = 0; yr <= T / TPY; yr += Math.max(1, Math.ceil(T / TPY / 6))) { x.fillText(`${yr}`, X(yr * TPY) - 4, ch - 4); x.fillRect(X(yr * TPY), 8, 1, ch - 22); }
  lanes.forEach((s, i) => {
    const pi = lanes.findIndex(p => p.id === s.parent);
    const end = s.extinct || w.tick, alive = !s.extinct;
    const col = alive ? `hsl(${s.hue},65%,62%)` : 'rgba(180,180,190,.45)';
    if (pi >= 0) { x.strokeStyle = 'rgba(236,235,246,.25)'; x.lineWidth = 1; x.beginPath(); x.moveTo(X(s.born), Y(pi)); x.lineTo(X(s.born), Y(i)); x.stroke(); }
    x.strokeStyle = col; x.lineWidth = alive ? 2 + Math.min(6, Math.sqrt(s.pop) * .4) : 2;
    x.beginPath(); x.moveTo(X(s.born), Y(i)); x.lineTo(Math.max(X(end), X(s.born) + 2), Y(i)); x.stroke();
    x.fillStyle = alive ? 'rgba(236,235,246,.9)' : 'rgba(236,235,246,.4)'; x.font = `600 10.5px "Figtree", sans-serif`;
    const label = s.name + (alive ? ` · ${s.pop}` : ' †');
    const tx = Math.min(X(s.born) + 4, cw - x.measureText(label).width - 4);
    x.fillText(label, tx, Y(i) - 5);
  });
}
// Census: stacked populations over time, with your interventions marked.
function drawGraph(w) {
  const c = $('#graph-canvas'), [x, cw, ch] = sizeCanvas(c, 260);
  x.clearRect(0, 0, cw, ch);
  const hist = w.popHist; if (hist.length < 2) return;
  const ids = [...new Set(hist.flatMap(h => Object.keys(h.p)))].map(Number);
  const maxN = Math.max(...hist.map(h => Object.values(h.p).reduce((a, b) => a + b, 0)), 10);
  const t0 = hist[0].t, t1 = hist[hist.length - 1].t, X = t => 8 + (t - t0) / Math.max(1, t1 - t0) * (cw - 16), Y = n => ch - 22 - n / maxN * (ch - 34);
  let base = hist.map(() => 0);
  const top = ids.map(id => ({ id, peak: Math.max(...hist.map(h => h.p[id] || 0)) })).sort((a, b) => b.peak - a.peak);
  for (const { id } of top) {
    const sp = spById(w, id); if (!sp) continue;
    x.fillStyle = `hsla(${sp.hue},60%,58%,${sp.extinct ? .35 : .8})`;
    x.beginPath();
    hist.forEach((h, i) => { const v = base[i] + (h.p[id] || 0); i ? x.lineTo(X(h.t), Y(v)) : x.moveTo(X(h.t), Y(v)); });
    for (let i = hist.length - 1; i >= 0; i--) x.lineTo(X(hist[i].t), Y(base[i]));
    x.closePath(); x.fill();
    base = base.map((b, i) => b + (hist[i].p[id] || 0));
  }
  x.strokeStyle = 'rgba(236,235,246,.2)'; x.beginPath(); x.moveTo(8, ch - 22); x.lineTo(cw - 8, ch - 22); x.stroke();
  const acts = w.log.filter(e => ['destroy', 'bless', 'create', 'speak'].includes(e.type) && e.t >= t0);
  for (const e of acts) { x.fillStyle = e.type === 'destroy' ? '#ff7148' : e.type === 'bless' ? '#f2cf73' : e.type === 'speak' ? '#b9a2ff' : '#62d8c4'; x.beginPath(); x.moveTo(X(e.t), ch - 20); x.lineTo(X(e.t) - 4, ch - 12); x.lineTo(X(e.t) + 4, ch - 12); x.fill(); }
  x.fillStyle = 'rgba(236,235,246,.5)'; x.font = '500 10px "JetBrains Mono", monospace';
  x.fillText(`Yr ${Math.floor(t0 / TPY)}`, 8, ch - 2); const e = `Yr ${Math.floor(t1 / TPY)}`; x.fillText(e, cw - 8 - x.measureText(e).width, ch - 2);
  x.fillText(`${maxN}`, 10, 14);
  $('#graph-legend').innerHTML = top.slice(0, 10).map(({ id }) => { const sp = spById(w, id); return sp ? `<span style="--c:hsl(${sp.hue},60%,58%)">${sp.name}${sp.extinct ? ' †' : ''}</span>` : ''; }).join('');
}

// ---------------------------------------------------------------- species designer
const DES_GENES = [['size', 'Size', 'Bigger bodies need more food'], ['speed', 'Speed', 'Outrun predators, catch prey'], ['sight', 'Sight', 'See food and danger from afar'], ['diet', 'Diet', 'Plants on the left, meat on the right'], ['fur', 'Fur', 'Warm in the cold, hot in the heat'], ['aquatic', 'Aquatic', 'Land on the left, sea on the right'], ['aggr', 'Aggression', 'Fight back, hunt bigger prey'], ['herd', 'Herding', 'Stay together with its kind'], ['fert', 'Fertility', 'Bigger litters, more often'], ['life', 'Lifespan', 'How long it lives'], ['resist', 'Resistance', 'Shrug off disease'], ['intel', 'Intelligence', 'Smarter, but a hungry brain'], ['hue', 'Colour', ''], ['pattern', 'Pattern', 'Plain, spotted, striped'], ['legs', 'Legs', 'Two, four or six']];
let desGenes = null;
function openDesigner() {
  const w = App.w;
  desGenes = desGenes || genesFrom(w, PRESETS.grazer, Math.random());
  $('#des-presets').innerHTML = [['grazer', 'Grazer'], ['giant', 'Giant'], ['hunter', 'Hunter'], ['omnivore', 'Omnivore'], ['swimmer', 'Fish'], ['shark', 'Sea hunter'], ['cell', 'Microbe']].map(([k, n]) => `<button data-p="${k}">${n}</button>`).join('') + '<button data-p="random">Surprise me</button>';
  $('#des-presets').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.p === 'random') { desGenes = new Float32Array(NG).map(() => Math.random()); }
    else desGenes = genesFrom(w, PRESETS[b.dataset.p], Math.random());
    buildSliders(); Snd.click();
  }));
  buildSliders();
  $('#designer').hidden = false;
}
function buildSliders() {
  $('#des-sliders').innerHTML = DES_GENES.map(([k, n, d]) => `<label class="sl">${n}<output>${Math.round(desGenes[G[k]] * 100)}</output><input type="range" min="0" max="1" step="0.01" value="${desGenes[G[k]]}" data-g="${k}">${d ? `<span>${d}</span>` : ''}</label>`).join('');
  $('#des-sliders').querySelectorAll('input').forEach(inp => inp.addEventListener('input', () => { desGenes[G[inp.dataset.g]] = +inp.value; inp.previousElementSibling.textContent = Math.round(+inp.value * 100); previewDesigner(); }));
  previewDesigner();
}
function previewDesigner() {
  const w = App.w, n = speciesName(w, desGenes);
  $('#des-name').textContent = n.name; $('#des-role').textContent = roleOf(desGenes);
}
function animateDesigner() {
  if ($('#designer').hidden || !desGenes) return;
  const c = $('#des-canvas'), x = c.getContext('2d');
  x.clearRect(0, 0, 220, 220);
  const spr = drawCreatureSprite(desGenes, desGenes[G.hue] * 360, ((App.t * 5) | 0) % 4, 160);
  const s = 110 + desGenes[G.size] * 90;
  x.save(); x.translate(110, 110); x.rotate(-Math.PI / 2 + Math.sin(App.t) * .15); x.drawImage(spr, -s / 2, -s / 2, s, s); x.restore();
}
setInterval(animateDesigner, 90);

// ---------------------------------------------------------------- rewind
function openRewind() {
  const list = $('#rewind-list'); list.innerHTML = '';
  const cur = Math.floor(App.w.tick / TPY);
  for (const s of App.snaps.slice().reverse()) {
    if (s.year >= cur) continue;
    const b = document.createElement('button'); b.textContent = `Yr ${s.year}`;
    b.addEventListener('click', () => rewindTo(s));
    list.appendChild(b);
  }
  if (!list.children.length) list.innerHTML = '<span class="dim">Let a year pass first.</span>';
  $('#rewind').hidden = false;
}
function rewindTo(s) {
  const w = restore(s.data);
  App.w = w; App.grid = {}; App.selected = 0; App.follow = 0;
  App.snaps = App.snaps.filter(x => x.year <= s.year); App.lastSnapYear = s.year;
  bakeTerrain(w); updateVeg(w); R.particles = []; R.sprites.clear();
  if (w.player) ascend();
  $('#rewind').hidden = true; closeInspector();
  R.flash = .6; Snd.speak(); toast(`Time flows backwards. It is year ${s.year} again.`);
  renderPanel(true);
}

// ---------------------------------------------------------------- input
const keys = new Set();
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  const k = e.key.toLowerCase();
  if (App.onTitle) { if (k === 'enter') startGame(); return; }
  keys.add(k);
  const w = App.w;
  if (!$('#designer').hidden || !$('#help').hidden) { if (k === 'escape') { $('#designer').hidden = true; $('#help').hidden = true; } return; }
  if (w.player) {
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    if (k === 'q') ascend();
    return;
  }
  if (k === ' ') { e.preventDefault(); App.paused = !App.paused; setSpeedButtons(); }
  else if (k >= '1' && k <= '4') { App.speed = [1, 5, 20, 60][+k - 1]; App.paused = false; setSpeedButtons(); }
  else if (k === 'escape') { if (App.power) disarm(); else if (!$('#rewind').hidden) $('#rewind').hidden = true; else { closeInspector(); closeFlyout(); App.focusSp = 0; } }
  else if (k === 'r') openRewind();
  else if (k === 'f' && App.selected) { App.follow = App.follow === App.selected ? 0 : App.selected; updateInspector(true); }
  else if (k === '[') App.brush = Math.max(2, App.brush - 1);
  else if (k === ']') App.brush = Math.min(20, App.brush + 1);
  else if (k === 'tab') { e.preventDefault(); togglePanel(); }
  else if (k === 'm') toggleSound();
  else if (k === '?') $('#help').hidden = false;
  else { const p = Object.values(POWER).find(p => p.key && p.key.toLowerCase() === k); if (p) armPower(p.id); }
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  Snd.init();
  if (App.onTitle) return;
  $('#popover').hidden = true; closeFlyout(); $('#rewind').hidden = true;
  App.pointer.down = true; App.pointer.x = e.clientX; App.pointer.y = e.clientY;
  App.drag = { x: e.clientX, y: e.clientY, cx: App.cam.cx, cy: App.cam.cy, moved: false, button: e.button, power: !!App.power && e.button === 0 };
  cv.setPointerCapture(e.pointerId);
  if (App.power && e.button === 0 && POWER[App.power].mode === 'brush') { const [x, y] = toWorld(e.clientX, e.clientY); App.power === 'forest' ? GOD.forest(App.w, x, y, App.brush) : GOD.terraform(App.w, x, y, App.brush, App.power === 'raise' ? 1 : -1); }
});
cv.addEventListener('pointermove', e => {
  App.pointer.x = e.clientX; App.pointer.y = e.clientY; App.pointer.inside = true;
  const d = App.drag; if (!d) return;
  if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) d.moved = true;
  const brush = d.power && POWER[App.power] && POWER[App.power].mode === 'brush';
  if (d.moved && !brush) { App.cam.cx = d.cx - (e.clientX - d.x) / App.cam.zoom; App.cam.cy = d.cy - (e.clientY - d.y) / App.cam.zoom; App.follow = App.w && App.w.player ? App.follow : 0; App.flyTarget = null; cv.style.cursor = 'grabbing'; }
});
cv.addEventListener('pointerleave', () => { App.pointer.inside = false; });
cv.addEventListener('pointerup', e => {
  const d = App.drag; App.drag = null; App.pointer.down = false; cv.style.cursor = '';
  if (!d || d.moved || App.onTitle) return;
  const [x, y] = toWorld(e.clientX, e.clientY);
  if (App.power && d.button === 0) { usePower(x, y, e.clientX, e.clientY); return; }
  if (d.button !== 0) { disarm(); return; }
  const c = nearestCreature(x, y, 16 / App.cam.zoom + .8);
  if (c) { selectCreature(c); Snd.click(); } else closeInspector();
});
cv.addEventListener('wheel', e => {
  e.preventDefault(); if (App.onTitle) return;
  const [wx, wy] = toWorld(e.clientX, e.clientY);
  const f = Math.exp(-e.deltaY * .0015);
  App.cam.zoom = clamp(App.cam.zoom * f, minZoom(), 64);
  App.cam.cx = wx - (e.clientX - W / 2) / App.cam.zoom; App.cam.cy = wy - (e.clientY - H / 2) / App.cam.zoom;
  App.flyTarget = null; clampCam();
}, { passive: false });
// pinch zoom on touch screens
const touches = new Map();
cv.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') touches.set(e.pointerId, [e.clientX, e.clientY]); });
cv.addEventListener('pointermove', e => {
  if (e.pointerType !== 'touch' || !touches.has(e.pointerId)) return;
  const prev = [...touches.values()]; touches.set(e.pointerId, [e.clientX, e.clientY]);
  if (touches.size === 2) { const now = [...touches.values()]; const d0 = Math.hypot(prev[0][0] - prev[1][0], prev[0][1] - prev[1][1]), d1 = Math.hypot(now[0][0] - now[1][0], now[0][1] - now[1][1]); if (d0 > 0) { App.cam.zoom = clamp(App.cam.zoom * d1 / d0, minZoom(), 64); if (App.drag) App.drag.moved = true; } }
});
cv.addEventListener('pointerup', e => touches.delete(e.pointerId));
function togglePanel() { App.panel = !App.panel; $('#panel').hidden = !App.panel; if (App.panel) renderPanel(true); }
function toggleSound() { App.sound = !App.sound; Snd.init(); Snd.setOn(App.sound); savePrefs(); $('#btn-sound').style.opacity = App.sound ? 1 : .4; }

// ---------------------------------------------------------------- wire up DOM
$('#opt-world').innerHTML = Object.entries(WORLD_TYPES).map(([k, t], i) => `<button class="opt" data-v="${k}" aria-pressed="${i === 0}"><b>${t.label}</b><span>${{ continent: 'One great land, many climates', archipelago: 'Scattered islands, isolated evolution', pangaea: 'A single vast supercontinent', frozen: 'A cold world of ice and tundra', desert: 'Hot, dry, and unforgiving' }[k]}</span></button>`).join('');
for (const grp of ['#opt-world', '#opt-life']) $(grp).querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => { $(grp).querySelectorAll('.opt').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); Snd.init(); Snd.click(); }));
$('#seed').value = String((Math.random() * 1e6) | 0);
$('#btn-create').addEventListener('click', startGame);
$('#btn-pause').addEventListener('click', () => { App.paused = !App.paused; setSpeedButtons(); });
document.querySelectorAll('.spd').forEach(b => b.addEventListener('click', () => { App.speed = +b.dataset.speed; App.paused = false; setSpeedButtons(); }));
$('#btn-rewind').addEventListener('click', () => $('#rewind').hidden ? openRewind() : ($('#rewind').hidden = true));
$('#rewind-close').addEventListener('click', () => { $('#rewind').hidden = true; });
$('#btn-sound').addEventListener('click', toggleSound);
$('#btn-help').addEventListener('click', () => { $('#help').hidden = false; });
$('#help-close').addEventListener('click', () => { $('#help').hidden = true; });
$('#btn-panel').addEventListener('click', togglePanel);
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
$('#des-close').addEventListener('click', () => { $('#designer').hidden = true; });
$('#des-count').addEventListener('input', e => { App.placeCount = +e.target.value; $('#des-count-out').textContent = e.target.value; });
$('#des-place').addEventListener('click', () => { $('#designer').hidden = true; App.power = 'species'; App.placeGenes = Float32Array.from(desGenes); document.body.classList.add('aiming'); $('#power-hint').style.setProperty('--c', 'var(--create)'); setHint(`Place the ${speciesName(App.w, desGenes).name}`, 'Click where they should begin.'); });
$('#btn-ascend').addEventListener('click', ascend);
$('#death-ascend').addEventListener('click', () => { $('#death').hidden = true; ascend(); App.paused = false; setSpeedButtons(); });
for (const id of ['#designer', '#help']) $(id).addEventListener('click', e => { if (e.target === $(id)) $(id).hidden = true; });
$('#btn-sound').style.opacity = App.sound ? 1 : .4;

window.addEventListener('resize', () => { resize(); clampCam(); });
resize();
buildDock();
titleBackdrop();
requestAnimationFrame(frame);
window.__god = { App, get w() { return App.w; }, startGame, armPower, usePower, incarnate, openDesigner, rewindTo, showTab };
})();

/*UI-START*/
// ---------------------------------------------------------------------------
// God Lab interface: camera, powers, prayers, inspector, incarnation, sound.
// ---------------------------------------------------------------------------
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CAT = { nature: { name: 'Nature', col: '#7fd37a', hex: 0x7fd37a }, wrath: { name: 'Wrath', col: '#ff6a3d', hex: 0xff6a3d }, grace: { name: 'Grace', col: '#ffe07a', hex: 0xffe07a }, hand: { name: 'Hand', col: '#b9a2ff', hex: 0xb9a2ff } };
const POWERS = [
  { id: 'rain', cat: 'nature', icon: '🌧️', name: 'Rain', r: 18, desc: 'Rain over an area. Waters the crops and puts out fires.' },
  { id: 'harvest', cat: 'nature', icon: '🌾', name: 'Bounty', r: 16, desc: 'Ripen the crops, fill the bushes with berries and the stores with food.' },
  { id: 'forest', cat: 'nature', icon: '🌳', name: 'Grow forest', r: 6, desc: 'Trees spring up where you point.' },
  { id: 'raise', cat: 'nature', icon: '⛰️', name: 'Raise land', r: 4, brush: true, desc: 'Hold and drag to lift the earth into hills.' },
  { id: 'lower', cat: 'nature', icon: '🕳️', name: 'Dig', r: 4, brush: true, desc: 'Hold and drag to carve valleys and lakes.' },
  { id: 'spawn', cat: 'nature', icon: '🦌', name: 'Animals', r: 2, sub: [['deer', '🦌 Deer'], ['boar', '🐗 Boar'], ['wolf', '🐺 Wolves'], ['mammoth', '🦣 Mammoths'], ['sheep', '🐑 Sheep'], ['dog', '🐕 Dogs'], ['fish', '🐟 Fish']], desc: 'Create animals. Deer and boar feed hunters. Wolves hunt.' },
  { id: 'sun', cat: 'nature', icon: '☀️', name: 'Clear skies', global: true, desc: 'Chase away the clouds, the rain and the dust.' },
  { id: 'lightning', cat: 'wrath', icon: '⚡', name: 'Lightning', r: 1.5, desc: 'Strike anything: a person, a tree, a house, a wolf.' },
  { id: 'fire', cat: 'wrath', icon: '🔥', name: 'Fire', r: 2, desc: 'Set a tree or a building alight. Fire spreads in dry weather.' },
  { id: 'meteor', cat: 'wrath', icon: '☄️', name: 'Meteor', r: 7, desc: 'A falling star. Leaves a crater, fire and a sky full of dust.' },
  { id: 'tornado', cat: 'wrath', icon: '🌪️', name: 'Tornado', r: 3, desc: 'A whirlwind that picks up people and animals and tears down homes.' },
  { id: 'quake', cat: 'wrath', icon: '🫨', name: 'Earthquake', r: 28, desc: 'Shake the ground. Old buildings crack and fall.' },
  { id: 'plague', cat: 'wrath', icon: '☣️', name: 'Plague', r: 6, desc: 'A sickness that spreads from person to person.' },
  { id: 'locusts', cat: 'wrath', icon: '🦗', name: 'Locusts', r: 8, desc: 'A swarm that devours the crops.' },
  { id: 'storm', cat: 'wrath', icon: '⛈️', name: 'Storm', global: true, desc: 'A great storm with lightning across the whole valley.' },
  { id: 'flood', cat: 'wrath', icon: '🌊', name: 'Flood', global: true, desc: 'The lake rises and swallows the lowlands for a while.' },
  { id: 'volcano', cat: 'wrath', icon: '🌋', name: 'Volcano', global: true, desc: 'Wake the mountain. Lava runs downhill.' },
  { id: 'raiders', cat: 'wrath', icon: '⚔️', name: 'Raiders', global: true, desc: 'Send a war band over the hills to test them.' },
  { id: 'heal', cat: 'grace', icon: '💚', name: 'Heal', r: 7, desc: 'Cure sickness and wounds in an area.' },
  { id: 'bless', cat: 'grace', icon: '✨', name: 'Bless', target: 'p', sub: [['immortal', '♾️ Immortal'], ['strong', '💪 Strength'], ['swift', '💨 Speed'], ['wise', '📜 Wisdom'], ['giant', '🗿 Giant'], ['fertile', '👶 Children'], ['charm', '💘 Charm']], desc: 'Give one person a gift. Immortal really means immortal.' },
  { id: 'fertility', cat: 'grace', icon: '💞', name: 'Fertility', r: 10, desc: 'Married women nearby will soon have children.' },
  { id: 'inspire', cat: 'grace', icon: '💡', name: 'Inspire', target: 'p', desc: 'Whisper an idea to someone. Their people learn faster.' },
  { id: 'prophet', cat: 'grace', icon: '👁️', name: 'Vision', target: 'p', desc: 'Make someone your prophet. They preach and spread faith.' },
  { id: 'resurrect', cat: 'grace', icon: '🪦', name: 'Raise dead', target: 'g', desc: 'Click a grave to bring the dead back to life.' },
  { id: 'sign', cat: 'grace', icon: '🌈', name: 'Sign', global: true, desc: 'Paint the sky. Everyone looks up, and believes a little more.' },
  { id: 'hand', cat: 'hand', icon: '✋', name: 'Hand of god', desc: 'Press on a person or animal to pick them up. Move and let go to drop them, or fling them.' },
  { id: 'smite', cat: 'hand', icon: '👇', name: 'Smite', target: 'p', desc: 'Strike one person dead. Even the immortal.' },
  { id: 'incarnate', cat: 'hand', icon: '🧍', name: 'Become human', target: 'p', desc: 'Take the body of a person and walk among them.' },
];
const PW = Object.fromEntries(POWERS.map(p => [p.id, p]));
const AGE_DESC = [
  'Fire, spears and a cave. They hunt, gather berries and tell stories.',
  'They plant the first fields and tame sheep. Round huts replace the tents.',
  'Bronze tools, mud-brick houses, a market and a temple in your name. Raiders have noticed them.',
  'Iron and writing. Stone houses with red roofs, schools and a dock on the lake.',
  'Castles, windmills and timber houses. A cathedral rises to the sky.',
  'Factories, brick streets and smoke. Faith begins to fade.',
  'Towers of glass, cars, and lights that never go out. Will they still pray to you?',
];
const LOG_ICON = { age: '🌅', life: '🌱', death: '🕯️', bless: '✨', destroy: '💥', war: '⚔️', plague: '☣️', build: '🏛️' };
const NAMES = ['Ama', 'Tor', 'Ilu', 'Sol', 'Nyx', 'Yara', 'Oru', 'Kael'];

const App = {
  w: null, speed: 1, prevSpeed: 1, acc: 0, onTitle: true, power: null, sub: null, sel: null, follow: false, incarnate: null,
  cam: { target: { x: 64, y: 2, z: 64 }, yaw: -2.3, pitch: .72, dist: 70 }, goal: { target: { x: 64, y: 2, z: 64 }, yaw: -2.3, pitch: .72, dist: 70 },
  mouse: { x: 0, y: 0, in: false }, keys: {}, holding: null, sound: true, mode: 'faith', guideStep: -1, lastHud: 0, lastTick: 0, tick: [],
};

// -------------------------------------------------------------- sound (all synthesised)
const Snd = {
  ctx: null, on: true,
  init() {
    if (this.ctx) return; try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const c = this.ctx; this.master = c.createGain(); this.master.gain.value = .55; this.master.connect(c.destination);
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; this.noise = buf;
    const loop = (freq, q, type) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.master); s.start(); return { g, f }; };
    this.wind = loop(400, .5, 'lowpass'); this.rain = loop(2500, .4, 'bandpass'); this.fire = loop(1200, .8, 'bandpass'); this.crowd = loop(700, 1.2, 'bandpass');
  },
  env(g, t, a, peak, dcy) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + dcy); },
  tone(freq, dur, type = 'sine', vol = .2, delay = 0, slide = 0) { if (!this.ctx || !this.on) return; const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur); this.env(g, t, .01, vol, dur); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + .1); },
  hiss(dur, freq, vol, type = 'lowpass', delay = 0, sweep = 0) { if (!this.ctx || !this.on) return; const c = this.ctx, t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noise; f.type = type; f.frequency.setValueAtTime(freq, t); if (sweep) f.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur); this.env(g, t, .02, vol, dur); s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur + .1); },
  play(k) {
    if (!this.ctx || !this.on) return;
    switch (k) {
      case 'thunder': this.hiss(.15, 3000, .5, 'highpass'); this.hiss(2.8, 300, .7, 'lowpass', .05, .3); this.tone(50, 1.5, 'sine', .4, .05, .5); break;
      case 'boom': this.hiss(3.5, 800, .9, 'lowpass', 0, .1); this.tone(60, 2.2, 'sine', .7, 0, .3); break;
      case 'whoosh': this.hiss(2.2, 400, .35, 'bandpass', 0, 6); break;
      case 'chime': [880, 1320, 1760].forEach((f, i) => this.tone(f, 1.6, 'sine', .08, i * .07)); break;
      case 'choir': [261.6, 329.6, 392, 523.2].forEach((f, i) => { this.tone(f, 2.6, 'triangle', .06, i * .03); this.tone(f * 1.003, 2.6, 'sawtooth', .015, i * .03); }); break;
      case 'fanfare': [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, .9, 'triangle', .12, i * .12)); this.tone(196, 2, 'sawtooth', .04, 0); break;
      case 'bell': this.tone(659, 2.2, 'sine', .08); this.tone(988, 1.6, 'sine', .04, .01); break;
      case 'pop': this.tone(520, .08, 'triangle', .07, 0, 1.6); break;
      case 'splash': this.hiss(.5, 1800, .25, 'highpass'); break;
      case 'quake': this.hiss(6, 120, .9, 'lowpass'); this.tone(35, 6, 'sine', .5); break;
      case 'fire': this.hiss(1.2, 900, .3, 'bandpass', 0, 2); break;
      case 'sad': [220, 261.6, 329.6].forEach((f, i) => this.tone(f, 2.2, 'sine', .05, i * .25)); break;
      case 'birth': [784, 988, 1175].forEach((f, i) => this.tone(f, .5, 'sine', .05, i * .08)); break;
      case 'grab': this.tone(300, .25, 'sine', .1, 0, 2); break;
      case 'drop': this.tone(500, .3, 'sine', .08, 0, .4); break;
      case 'plague': this.tone(110, 2, 'sawtooth', .05, 0, .8); this.hiss(1.5, 400, .1, 'bandpass'); break;
      case 'war': [196, 196, 233, 196].forEach((f, i) => this.tone(f, .3, 'square', .05, i * .22)); this.hiss(.2, 200, .4, 'lowpass', 0); this.hiss(.2, 200, .4, 'lowpass', .44); break;
    }
  },
  ambient(w, dt) {
    if (!this.ctx) return; const on = this.on ? 1 : 0, t = this.ctx.currentTime;
    const W = w.weather, ct = App.cam.target;
    const rainNear = (W.rain > 0 && Math.hypot(W.rx - ct.x, W.rz - ct.z) < W.rr + 20) || W.storm > 0 ? 1 : 0;
    let fire = 0; for (const f of w.fires) fire += Math.max(0, 1 - Math.hypot(f.x - ct.x, f.z - ct.z) / 40); fire = Math.min(1, fire * .3);
    const cf = w.buildings.find(b => b.type === 'fire' && b.style <= 1); if (cf && Math.hypot(cf.x - ct.x, cf.z - ct.z) < 25 && App.cam.dist < 50) fire = Math.max(fire, .12);
    this.wind.g.gain.setTargetAtTime(on * (.05 + R.uWind.value * .1), t, .5);
    this.rain.g.gain.setTargetAtTime(on * rainNear * .16, t, .6);
    this.fire.g.gain.setTargetAtTime(on * fire * .25, t, .3);
    this.crowd.g.gain.setTargetAtTime(on * Math.min(.05, living(w).length / 4000) * (App.cam.dist < 45 ? 1 : .3) * (R.night > .5 ? .3 : 1), t, 1);
    // birds by day, crickets by night
    if (on && App.speed <= 4 && Math.random() < dt * (R.night > .5 ? 3 : 1.2)) { if (R.night > .5) this.tone(4200 + Math.random() * 300, .05, 'sine', .015, 0); else { const f = 2000 + Math.random() * 1500; this.tone(f, .09, 'sine', .02, 0, 1.3); this.tone(f * 1.2, .07, 'sine', .015, .1, .8); } }
  },
};

// -------------------------------------------------------------- setup
function boot() {
  initRender($('#view'));
  resize(); addEventListener('resize', resize);
  const chips = $('#name-chips'); for (const n of NAMES) { const b = document.createElement('button'); b.textContent = n; b.onclick = () => { $('#god-name').value = n; Snd.init(); Snd.play('pop'); }; chips.appendChild(b); }
  document.querySelectorAll('.opt-row .opt').forEach(b => b.onclick = () => { document.querySelectorAll('.opt-row .opt').forEach(x => x.setAttribute('aria-pressed', x === b)); App.mode = b.dataset.v; });
  const seed = Math.floor(Math.random() * 1e6); $('#seed').value = seed;
  newWorld(seed);
  $('#btn-create').onclick = start;
  $('#god-name').addEventListener('keydown', e => { if (e.key === 'Enter') start(); });
  buildDock(); bindInput(); bindHud();
  requestAnimationFrame(frame);
}
function newWorld(seed) {
  if (App.w && R.terrain) { R.scene.remove(R.terrain, R.water, R.base); R.terrain = null; for (const [, e] of R.bld) R.scene.remove(e.group); R.bld.clear(); R.treeKey = -1; R.burnMap = null; R.carList.length = 0; }
  App.w = createWorld({ seed });
  const c = App.w.center; App.cam.target = { x: c.x, y: hAt(App.w, c.x, c.z), z: c.z }; App.goal.target = { ...App.cam.target };
  for (let k = 0; k < 40; k++) stepWorld(App.w, .25);
  App.w.events.length = 0;
}
function start() {
  Snd.init(); Snd.play('choir');
  const name = ($('#god-name').value || 'Ama').trim().slice(0, 14) || 'Ama';
  const seed = parseInt($('#seed').value, 10);
  if (Number.isFinite(seed) && seed !== App.w.seed) newWorld(seed);
  const w = App.w; w.god.name = name; w.god.unlimited = App.mode === 'unlimited';
  if (w.god.unlimited) w.god.mana = 9999;
  w.log[0].text = `A small band settled by the water at ${w.villageName}. They have never heard the name ${name}.`;
  document.body.classList.remove('on-title'); App.onTitle = false;
  for (const id of ['#hud', '#prayers', '#dock', '#side']) $(id).hidden = false;
  showTab('inspect');
  const c = w.center;
  App.cam.dist = 170; App.cam.pitch = 1.25; App.goal.dist = 34; App.goal.pitch = .78; App.goal.yaw = App.cam.yaw + .6;
  App.goal.target = { x: c.x, y: hAt(w, c.x, c.z), z: c.z };
  setSpeed(1);
  setTimeout(() => banner('In the beginning', w.villageName, `${living(w).length} people around a fire. They do not know your name yet.`), 600);
  setTimeout(() => guide(0), 4200);
  renderInspector();
}
function resize() { resizeRender(innerWidth, innerHeight); }

// -------------------------------------------------------------- main loop
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(.1, (now - lastT) / 1000); lastT = now;
  const w = App.w;
  if (w) {
    const sp = App.onTitle ? 1 : App.speed;
    w.speedHint = Math.max(1, sp); R.speed = sp; R.speedHint = w.speedHint; R.lightMode = sp >= 16 ? 'day' : 'cycle';
    const step = sp <= 4 ? .1 : .25;
    App.acc += dt * sp; const t0 = performance.now();
    while (App.acc >= step && performance.now() - t0 < 14) { stepWorld(w, step); App.acc -= step; }
    if (App.acc > step * 8) App.acc = step * 8;
    if (App.onTitle) { App.goal.yaw += dt * .04; App.goal.dist = 78; App.goal.pitch = .62; w.events.length = 0; }
    else handleEvents(w);
    updateCamera(w, dt);
    updateHand(w);
    renderFrame(w, dt, App.cam);
    if (!App.onTitle) { updateBubbles(w); updateCursor(w); if (now - App.lastHud > 250) { App.lastHud = now; updateHud(w); renderPrayers(w); } if (now - (App.lastIns || 0) > (App.sel || App.tab !== 'inspect' ? 400 : 1500)) { App.lastIns = now; refreshSide(); } updateTicker(now); Snd.ambient(w, dt); }
    $('#flash').style.opacity = Math.min(.8, R.flash * .5);
  }
  requestAnimationFrame(frame);
}

// -------------------------------------------------------------- camera
function camVectors() { const y = App.cam.yaw; return { f: { x: -Math.cos(y), z: -Math.sin(y) }, r: { x: Math.sin(y), z: -Math.cos(y) } }; }
function updateCamera(w, dt) {
  const G = App.goal, C = App.cam;
  // keyboard pan
  if (!App.incarnate && !App.onTitle) {
    const { f, r } = camVectors(), k = G.dist * dt * 1.1; let mx = 0, mz = 0;
    if (App.keys.KeyW || App.keys.ArrowUp) { mx += f.x; mz += f.z; } if (App.keys.KeyS || App.keys.ArrowDown) { mx -= f.x; mz -= f.z; }
    if (App.keys.KeyD || App.keys.ArrowRight) { mx += r.x; mz += r.z; } if (App.keys.KeyA || App.keys.ArrowLeft) { mx -= r.x; mz -= r.z; }
    if (mx || mz) { G.target.x += mx * k; G.target.z += mz * k; App.follow = false; }
    if (App.keys.KeyQ) G.yaw -= dt * 1.4; if (App.keys.KeyE) G.yaw += dt * 1.4;
  }
  // follow a person
  let fp = null;
  if (App.incarnate) fp = personById(w, App.incarnate);
  else if (App.follow && App.sel && App.sel.kind === 'p') fp = personById(w, App.sel.id);
  if (fp && fp.alive !== false) { G.target.x = fp._rx ?? fp.x; G.target.z = fp._rz ?? fp.z; }
  if (App.incarnate) {
    const p = personById(w, App.incarnate);
    if (p && p.alive) { const { f, r } = camVectors(); let mx = 0, mz = 0; if (App.keys.KeyW || App.keys.ArrowUp) { mx += f.x; mz += f.z; } if (App.keys.KeyS || App.keys.ArrowDown) { mx -= f.x; mz -= f.z; } if (App.keys.KeyD || App.keys.ArrowRight) { mx += r.x; mz += r.z; } if (App.keys.KeyA || App.keys.ArrowLeft) { mx -= r.x; mz -= r.z; } w.input = { mx, mz, run: !!(App.keys.ShiftLeft || App.keys.ShiftRight) }; }
  }
  G.target.x = clamp(G.target.x, 2, N - 2); G.target.z = clamp(G.target.z, 2, N - 2);
  G.target.y = Math.max(hAt(w, G.target.x, G.target.z), w.water) + .5;
  G.dist = clamp(G.dist, 6, 175); G.pitch = clamp(G.pitch, .22, 1.48);
  const k = Math.min(1, dt * (App.onTitle ? 1.5 : 7)), kd = Math.min(1, dt * (C.dist > 90 ? 1.6 : 6));
  C.target.x = lerp(C.target.x, G.target.x, k); C.target.z = lerp(C.target.z, G.target.z, k); C.target.y = lerp(C.target.y, G.target.y, k);
  let dy = G.yaw - C.yaw; C.yaw += dy * k; C.pitch = lerp(C.pitch, G.pitch, kd); C.dist = lerp(C.dist, G.dist, kd);
  // keep the camera above the ground
  const cp = Math.cos(C.pitch), cx = C.target.x + Math.cos(C.yaw) * cp * C.dist, cz = C.target.z + Math.sin(C.yaw) * cp * C.dist, cy = C.target.y + Math.sin(C.pitch) * C.dist;
  const gh = (cx > 0 && cz > 0 && cx < N && cz < N) ? hAt(w, cx, cz) : 0; if (cy < gh + 2) C.pitch = Math.min(1.48, C.pitch + .02);
}
function lookAt(x, z, dist) { App.goal.target.x = x; App.goal.target.z = z; if (dist) App.goal.dist = dist; App.follow = false; }

// -------------------------------------------------------------- input
function bindInput() {
  const cv = $('#view'); const ptrs = new Map(); let drag = null, pinch = null;
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    Snd.init(); cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (App.onTitle) return;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: App.goal.dist, ang: Math.atan2(b.y - a.y, b.x - a.x), yaw: App.goal.yaw }; drag = null; return; }
    drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, btn: e.button, moved: false, t: performance.now() };
    const P = App.power && PW[App.power];
    if (e.button === 0 && App.power === 'hand') { const hit = pickEntity(e.clientX, e.clientY, true); if (hit && (hit.kind === 'p' || hit.kind === 'a')) { if (GOD.pickUp(App.w, hit.kind, hit.id)) { App.holding = { kind: hit.kind, id: hit.id, hist: [] }; Snd.play('grab'); drag.hand = true; } } }
    if (e.button === 0 && P && P.brush) { drag.brush = true; }
  });
  cv.addEventListener('pointermove', e => {
    App.mouse.x = e.clientX; App.mouse.y = e.clientY; App.mouse.in = true;
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); App.goal.dist = pinch.dist * pinch.d / Math.max(20, d); App.goal.yaw = pinch.yaw - (Math.atan2(b.y - a.y, b.x - a.x) - pinch.ang); return; }
    if (!drag) { hover(e.clientX, e.clientY); return; }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5) drag.moved = true;
    if (drag.hand || drag.brush) return;
    if (drag.btn === 2 || (drag.btn === 0 && e.shiftKey) || drag.btn === 1) { App.goal.yaw += dx * .006; App.goal.pitch += dy * .004; }
    else if (drag.btn === 0 && drag.moved) { const { f, r } = camVectors(), k = App.goal.dist * .0021; App.goal.target.x += (-r.x * dx + f.x * dy) * k; App.goal.target.z += (-r.z * dx + f.z * dy) * k; App.follow = false; document.body.classList.add('dragging'); }
  });
  const up = e => {
    ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
    document.body.classList.remove('dragging');
    if (!drag || App.onTitle) { drag = null; return; }
    if (drag.hand) { releaseHand(); }
    else if (!drag.moved && drag.btn === 0 && !drag.brush) click(e.clientX, e.clientY);
    drag = null;
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { App.mouse.in = false; $('#hover-label').hidden = true; });
  cv.addEventListener('wheel', e => {
    e.preventDefault(); if (App.onTitle) return;
    const f = Math.pow(1.0015, e.deltaY), nd = clamp(App.goal.dist * f, 6, 175);
    const pt = pickGround(App.w, e.clientX, e.clientY);
    if (pt && f < 1 && !App.incarnate) { const k = (1 - nd / App.goal.dist) * .8; App.goal.target.x += (pt.x - App.goal.target.x) * k; App.goal.target.z += (pt.z - App.goal.target.z) * k; App.follow = false; }
    App.goal.dist = nd;
  }, { passive: false });
  App.brushLoop = setInterval(() => { if (drag && drag.brush && App.mouse.in) { const pt = pickGround(App.w, App.mouse.x, App.mouse.y); if (pt) GOD.terraform(App.w, pt.x, pt.z, App.power === 'raise' ? 1 : -1, .06); } }, 30);
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    App.keys[e.code] = true;
    if (App.onTitle) return;
    const inc = !!App.incarnate;
    if (e.code === 'Space') { e.preventDefault(); setSpeed(App.speed ? 0 : (App.prevSpeed || 1)); }
    else if (/^Digit[1-5]$/.test(e.code)) setSpeed([1, 4, 16, 64, 200][+e.code.slice(5) - 1]);
    else if (e.code === 'Escape') { if (!$('#help').hidden) $('#help').hidden = true; else if (App.power) armPower(null); else if (App.sel) select(null); }
    else if (e.code === 'KeyH' && !inc) $('#help').hidden = !$('#help').hidden;
    else if (e.code === 'KeyC' && !inc) { showTab(App.tab === 'chron' ? 'inspect' : 'chron'); }
    else if (e.code === 'KeyM') toggleSound();
    else if (e.code === 'KeyF' && !inc) { if (App.sel && App.sel.kind === 'p') App.follow = !App.follow; }
    else if (inc && e.code === 'KeyE') { const m = GOD.act(App.w, 'use'); if (m) incMsg(m); }
    else if (inc && e.code === 'KeyF') { const m = GOD.act(App.w, 'preach'); if (m) incMsg(m); }
    else if (inc && e.code === 'KeyQ') ascend();
  });
  addEventListener('keyup', e => { App.keys[e.code] = false; });
  addEventListener('blur', () => { App.keys = {}; });
}
function pickEntity(sx, sy, living_ = false) {
  const w = App.w; let best = null, bd = 26;
  for (const p of w.people.concat(w.raiders || [])) { if (!p.alive || p.inside) continue; const s = project(p._rx ?? p.x, (p._sy ?? hAt(w, p.x, p.z) + 1) - .45, p._rz ?? p.z); if (!s.vis) continue; const d = Math.hypot(s.x - sx, s.y - sy); if (d < bd) { bd = d; best = { kind: 'p', id: p.id }; } }
  for (const a of w.animals) { if (!a.alive && living_) continue; const s = project(a._rx ?? a.x, hAt(w, a.x, a.z) + .5, a._rz ?? a.z); if (!s.vis) continue; const d = Math.hypot(s.x - sx, s.y - sy) + 4; if (d < bd) { bd = d; best = { kind: 'a', id: a.id }; } }
  if (best) return best;
  const pt = pickGround(w, sx, sy); if (!pt) return null;
  for (const g of w.graves) if (dist(g.x, g.z, pt.x, pt.z) < 1) return { kind: 'g', id: g.id, pt };
  const i = tIdx(pt.x, pt.z); if (i >= 0 && w.occ[i] >= 0) return { kind: 'b', id: w.occ[i], pt };
  return { kind: 'ground', pt };
}
function hover(sx, sy) {
  if (App.onTitle) return;
  const hit = pickEntity(sx, sy); const lab = $('#hover-label');
  App.hover = hit;
  if (hit && hit.kind === 'p') { const p = personById(App.w, hit.id); if (p) { lab.innerHTML = `${esc(p.name)} <span>${p.faction === 'raider' ? 'raider' : JOB_INFO[p.job] || ''}, ${Math.floor(ageOf(App.w, p))}</span>`; lab.hidden = false; lab.style.left = sx + 'px'; lab.style.top = (sy - 14) + 'px'; return; } }
  if (hit && hit.kind === 'g') { const g = App.w.graves.find(q => q.id === hit.id); if (g) { lab.innerHTML = `Grave of ${esc(g.name)}`; lab.hidden = false; lab.style.left = sx + 'px'; lab.style.top = (sy - 14) + 'px'; return; } }
  lab.hidden = true;
}
function click(sx, sy) {
  const w = App.w, P = App.power && PW[App.power];
  if (App.incarnate) return;
  if (P && !P.global) {
    if (P.target === 'p') {
      const hit = pickEntity(sx, sy, true); const p = hit && hit.kind === 'p' ? personById(w, hit.id) : null;
      if (!p) { toast('Click on a person.'); return; }
      usePersonPower(P.id, p); return;
    }
    if (P.target === 'g') {
      const hit = pickEntity(sx, sy); if (!hit || hit.kind !== 'g') { toast('Click on a grave.'); return; }
      const g = w.graves.find(q => q.id === hit.id); if (g && !GOD.resurrect(w, g.pid)) noPower(); else { Snd.play('choir'); armPower(null); }
      return;
    }
    if (P.id === 'hand') { const hit = pickEntity(sx, sy); if (hit && (hit.kind === 'p' || hit.kind === 'a' || hit.kind === 'b' || hit.kind === 'g')) select(hit); return; }
    if (P.brush) return;
    const pt = pickGround(w, sx, sy); if (!pt) return;
    let ok;
    if (P.id === 'spawn') ok = GOD.spawn(w, pt.x, pt.z, App.sub || 'deer');
    else ok = GOD[P.id](w, pt.x, pt.z);
    if (ok === false) noPower(); else powerSound(P.id);
    return;
  }
  const hit = pickEntity(sx, sy);
  if (hit && hit.kind !== 'ground') { select(hit); Snd.play('pop'); } else select(null);
}
function usePersonPower(id, p) {
  const w = App.w; let ok = true;
  if (id === 'bless') { if (!App.sub) { toast('Choose a gift first.'); return; } ok = GOD.bless(w, p, App.sub); if (ok) Snd.play('choir'); }
  else if (id === 'smite') { ok = GOD.smite(w, p); if (ok) Snd.play('thunder'); }
  else if (id === 'inspire') { ok = GOD.inspire(w, p); if (ok) Snd.play('chime'); }
  else if (id === 'prophet') { ok = GOD.prophet(w, p); if (ok) Snd.play('choir'); }
  else if (id === 'incarnate') { incarnate(p); return; }
  if (ok === false) noPower(); else select({ kind: 'p', id: p.id });
}
function noPower() { toast(App.w.god.unlimited ? 'That did not work there.' : 'Not enough power. It returns as your people believe in you.'); Snd.play('drop'); }
function powerSound(id) { const m = { lightning: 'thunder', meteor: 'whoosh', quake: 'quake', tornado: 'whoosh', plague: 'plague', heal: 'chime', harvest: 'chime', rain: 'splash', fire: 'fire', fertility: 'chime', forest: 'chime', spawn: 'pop', locusts: 'plague' }; Snd.play(m[id] || 'pop'); }

// -------------------------------------------------------------- the hand of god
function updateHand(w) {
  const H = App.holding; R.handOrb.visible = !!H;
  if (!H) return;
  const e = H.kind === 'p' ? personById(w, H.id) : w.animals.find(a => a.id === H.id);
  if (!e || !w.hand) { App.holding = null; return; }
  const pt = pickGround(w, App.mouse.x, App.mouse.y); if (!pt) return;
  const y = Math.max(hAt(w, pt.x, pt.z), w.water) + 3.2;
  e.x = pt.x; e.z = pt.z; e.y = y; e._rx = pt.x; e._rz = pt.z;
  H.hist.push({ x: pt.x, z: pt.z, t: performance.now() }); if (H.hist.length > 8) H.hist.shift();
  R.handOrb.position.set(pt.x, y + 1.4, pt.z); R.handOrb.scale.setScalar(1 + Math.sin(R.time * 6) * .1);
}
function releaseHand() {
  const H = App.holding, w = App.w; if (!H) return; App.holding = null;
  const e = H.kind === 'p' ? personById(w, H.id) : w.animals.find(a => a.id === H.id); if (!e) { w.hand = null; return; }
  let vx = 0, vz = 0; const h = H.hist; if (h.length > 2) { const a = h[0], b = h[h.length - 1], dt = Math.max(.016, (b.t - a.t) / 1000); vx = (b.x - a.x) / dt; vz = (b.z - a.z) / dt; }
  const sp = Math.hypot(vx, vz), cap = 32; if (sp > cap) { vx *= cap / sp; vz *= cap / sp; }
  GOD.drop(w, e.x, e.z, e.y, vx * .9, vz * .9, 3 + Math.min(14, sp * .35));
  Snd.play(sp > 12 ? 'whoosh' : 'drop');
}

// -------------------------------------------------------------- powers dock
function buildDock() {
  const tabs = $('#dock-tabs');
  for (const [k, c] of Object.entries(CAT)) { const b = document.createElement('button'); b.textContent = c.name; b.dataset.cat = k; b.style.setProperty('--c', c.col); b.onclick = () => showCat(k); tabs.appendChild(b); }
  showCat('nature');
}
function showCat(cat) {
  App.cat = cat;
  document.querySelectorAll('#dock-tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.cat === cat));
  const box = $('#dock-powers'); box.innerHTML = '';
  for (const P of POWERS.filter(p => p.cat === cat)) {
    const b = document.createElement('button'); b.className = 'pw'; b.dataset.id = P.id; b.style.setProperty('--c', CAT[cat].col);
    const cost = POWER_COST[P.id] || 0;
    b.innerHTML = `<i>${P.icon}</i><b>${P.name}</b><small>${cost ? cost : ''}</small>`; b.title = P.desc;
    b.setAttribute('aria-pressed', App.power === P.id);
    b.onclick = () => { Snd.init(); Snd.play('pop'); if (App.power === P.id) armPower(null); else armPower(P.id); };
    box.appendChild(b);
  }
}
function armPower(id) {
  const w = App.w, P = id && PW[id];
  $('#subpick').hidden = true;
  if (P && P.global) {
    const ok = GOD[P.id](w); if (ok === false) noPower(); else { ({ storm: () => Snd.play('thunder'), flood: () => Snd.play('splash'), volcano: () => Snd.play('boom'), sign: () => Snd.play('choir'), raiders: () => Snd.play('war'), sun: () => Snd.play('chime') })[P.id]?.(); if (P.id === 'volcano') lookAt(w.layout.M.x, w.layout.M.z, 80); }
    id = null;
  }
  App.power = id; App.sub = null;
  document.querySelectorAll('.pw').forEach(b => b.setAttribute('aria-pressed', b.dataset.id === id));
  document.body.classList.toggle('aiming', !!id);
  const hint = $('#power-hint');
  if (!P || P.global) { hint.hidden = true; return; }
  if (P.sub) {
    const sp = $('#subpick'); sp.innerHTML = ''; sp.hidden = false;
    for (const [k, label] of P.sub) { const b = document.createElement('button'); b.textContent = label; b.onclick = () => { App.sub = k; sp.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); $('#ph-text').textContent = P.target === 'p' ? 'Now click a person.' : 'Now click the world.'; }; sp.appendChild(b); }
    sp.querySelector('button').click();
  }
  hint.hidden = !!P.sub; $('#ph-name').textContent = P.name; $('#ph-text').textContent = P.desc;
  if (P.sub) { setTimeout(() => { hint.hidden = false; hint.style.bottom = '205px'; }, 0); } else hint.style.bottom = '';
}
function updateCursor(w) {
  const P = App.power && PW[App.power];
  if (!P || !App.mouse.in || App.holding) { setCursor(w, null, 0, 0, false); return; }
  const pt = pickGround(w, App.mouse.x, App.mouse.y);
  setCursor(w, pt, P.r || (P.target ? .9 : 1.5), CAT[P.cat].hex, true);
}

// -------------------------------------------------------------- selection & inspector
function select(hit) {
  App.sel = hit && hit.kind !== 'ground' ? hit : null; App.follow = false;
  if (App.sel) showTab('inspect');
  renderInspector();
}
function selObj() {
  const w = App.w, s = App.sel; if (!s) return null;
  if (s.kind === 'p') return personById(w, s.id);
  if (s.kind === 'a') return w.animals.find(a => a.id === s.id) || null;
  if (s.kind === 'b') return bById(w, s.id);
  if (s.kind === 'g') return w.graves.find(g => g.id === s.id) || null;
  return null;
}
function showTab(t) {
  App.tab = t; $('#side').hidden = false;
  document.querySelectorAll('.side-tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
  for (const k of ['inspect', 'chron', 'people', 'ages']) $('#tab-' + k).hidden = k !== t;
  refreshSide(true);
}
function refreshSide(force) {
  if (App.tab === 'inspect') renderInspector();
  else if (App.tab === 'chron') renderChron(force);
  else if (App.tab === 'people') { if (force || !App._pplT || performance.now() - App._pplT > 3000) { App._pplT = performance.now(); renderPeople(); } }
  else if (App.tab === 'ages') renderAges();
}
function bar(label, v, col) { return `<div class="bar2">${label}<div><i style="width:${Math.round(clamp01(v) * 100)}%;background:${col}"></i></div></div>`; }
function plink(w, id) { const p = personById(w, id); if (!p) return ''; return `<a data-p="${id}">${esc(p.name)}</a>${p.alive ? '' : ' †'}`; }
function renderInspector() {
  const w = App.w, box = $('#tab-inspect'), o = selObj(), s = App.sel;
  if (!o) {
    const v = villageMood(w);
    box.innerHTML = `<h3 class="ins-h">${esc(w.villageName)}</h3><p class="ins-sub">${AGES[w.age].name} · ${living(w).length} people · ${w.buildings.filter(b => !b.ruin && b.progress >= 1).length} buildings</p>
      <p class="empty-ins">Click a person, an animal, a building or a grave to look closer.<br><br>${v.love > .3 ? 'The people speak of you with love.' : v.fear > .4 ? 'The people whisper your name in fear.' : v.faith < .2 ? 'Most of them have stopped believing in you.' : 'They are not sure what to make of you yet.'}</p>`;
    return;
  }
  if (s.kind === 'p') {
    const p = o, age = Math.floor(ageOf(w, p)), home = p.home && bById(w, p.home);
    const sp = p.spouse ? plink(w, p.spouse) : '', par = p.parents.map(id => plink(w, id)).filter(Boolean).join(' & '), kids = p.kids.map(id => plink(w, id)).filter(Boolean).join(', ');
    const gifts = Object.keys(p.gifts).filter(k => p.gifts[k]);
    const raider = p.faction === 'raider';
    box.innerHTML = `<h3 class="ins-h">${esc(fullName(w, p))}</h3>
      <p class="ins-sub">${p.alive ? '' : '† '}${p.sex === 'f' ? 'Woman' : 'Man'}, ${age} · ${raider ? 'Raider' : JOB_INFO[p.job] || ''}${home ? ' · lives in a ' + esc(bName(w, home)) : raider ? '' : ' · no home'}${p.alive ? '' : ' · ' + esc(p.cause || '')}</p>
      <div class="chipset">${p.traits.map(t => `<span class="chip">${t}</span>`).join('')}${gifts.map(g => `<span class="chip gold">${g}</span>`).join('')}${p.prophet ? '<span class="chip gold">prophet</span>' : ''}${p.sick ? '<span class="chip bad">sick</span>' : ''}${p.pregnant ? '<span class="chip">expecting</span>' : ''}</div>
      <div class="ins-sec">State</div><div class="bars2">${bar('Health', p.health, '#7fd37a')}${bar('Fed', p.hunger, '#e0a050')}${bar('Mood', p.mood, '#8fd0ff')}${bar('Faith', p.faith, '#a8c8ff')}${bar('Love', Math.max(0, p.love), '#ff8fb1')}${bar('Fear', p.fear, '#ff5a3c')}</div>
      ${raider ? '' : `<div class="ins-sec">Family</div><div class="links">${sp ? 'Married to ' + sp + '<br>' : ''}${par ? 'Child of ' + par + '<br>' : ''}${kids ? 'Children: ' + kids : ''}${!sp && !par && !kids ? 'Alone in the world.' : ''}</div>`}
      <div class="ins-sec">Thoughts</div><ul class="thoughts">${p.say && p.say.until > w.t ? `<li>"${esc(p.say.text)}"</li>` : ''}${p.thoughts.slice(0, 5).map(t => `<li class="${t.v < 0 ? 'neg' : t.v > 1 ? 'pos' : ''}">${esc(t.text)} <small>(age ${t.y})</small></li>`).join('') || '<li><small>Nothing on their mind.</small></li>'}</ul>
      <div class="ins-sec">What they remember of ${esc(w.god.name)}</div><ul class="thoughts">${p.mem.slice(0, 5).map(m => `<li class="${m.v < 0 ? 'neg' : 'pos'}">${esc(m.text)} <small>(year ${m.year})</small></li>`).join('') || '<li><small>Nothing yet. You are a story the elders tell.</small></li>'}</ul>
      ${p.alive ? `<div class="acts2">
        <button data-a="follow"><i>🎥</i>${App.follow ? 'Stop' : 'Follow'}</button><button data-a="bless"><i>✨</i>Bless</button><button data-a="heal"><i>💚</i>Heal</button>
        <button data-a="inspire"><i>💡</i>Inspire</button><button data-a="prophet"><i>👁️</i>Vision</button><button data-a="pick"><i>✋</i>Pick up</button>
        <button data-a="smite"><i>⚡</i>Smite</button>${Object.keys(p.gifts).length ? '<button data-a="unbless"><i>🚫</i>Take gifts</button>' : '<button data-a="lightning"><i>🌩️</i>Warn</button>'}<button data-a="look"><i>🔍</i>Look</button>
        ${raider ? '' : '<button class="big" data-a="incarnate">🧍 Become ' + esc(p.name) + '</button>'}</div>` : (w.graves.some(g => g.pid === p.id) ? `<div class="acts2"><button class="big" data-a="raise">🪦 Raise ${esc(p.name)} from the dead</button></div>` : '')}`;
  } else if (s.kind === 'a') {
    const a = o, name = { deer: 'Deer', boar: 'Wild boar', wolf: 'Wolf', mammoth: 'Mammoth', sheep: 'Sheep', cow: 'Cow', dog: 'Dog' }[a.kind];
    const owner = a.owner && personById(w, a.owner);
    box.innerHTML = `<h3 class="ins-h">${name}</h3><p class="ins-sub">${a.alive ? { wander: 'Wandering', flee: 'Running away', hunt: 'Hunting', charge: 'Charging', eat: 'Eating' }[a.st] || 'Resting' : 'Dead'}${a.pen ? ' · in a pen' : ''}${owner ? ' · follows ' + esc(owner.name) : ''}</p>
      ${a.alive ? `<div class="acts2"><button data-a="pick"><i>✋</i>Pick up</button><button data-a="smiteA"><i>⚡</i>Strike</button><button data-a="look"><i>🔍</i>Look</button></div>` : ''}`;
  } else if (s.kind === 'b') {
    const b = o, occ = w.people.filter(p => p.alive && p.home === b.id);
    const state = b.ruin ? 'In ruins' : b.progress < 1 ? `Being built, ${Math.round(b.progress * 100)}%` : b.upg ? `Being rebuilt for a new age, ${Math.round(b.progress * 100)}%` : b.fire ? 'On fire!' : `Built in the ${AGES[b.style].name}`;
    box.innerHTML = `<h3 class="ins-h">${esc(bName(w, b)).replace(/^./, c => c.toUpperCase())}</h3><p class="ins-sub">${state}${b.type === 'field' ? ` · crop ${Math.round(Math.min(1, b.crop) * 100)}%` : ''}</p>
      ${b.hp < 1 && !b.ruin ? `<div class="bars2">${bar('Condition', b.hp, '#e0a050')}</div>` : ''}
      ${occ.length ? `<div class="ins-sec">Lives here</div><div class="links">${occ.map(p => plink(w, p.id)).join(', ')}</div>` : ''}
      ${b.type === 'temple' || b.type === 'shrine' || b.type === 'statue' ? `<p class="empty-ins">${b.align < -.25 ? 'Built by people who fear you.' : b.align > .25 ? 'Built by people who love you.' : 'Built by people who are not sure about you.'}</p>` : ''}
      <div class="acts2"><button data-a="bfire"><i>🔥</i>Burn</button><button data-a="brain"><i>🌧️</i>Rain</button><button data-a="bstrike"><i>⚡</i>Strike</button></div>`;
  } else if (s.kind === 'g') {
    const g = o, p = w.dead.get(g.pid);
    box.innerHTML = `<h3 class="ins-h">Here lies ${esc(g.name)}</h3><p class="ins-sub">${p ? `${Math.floor(ageOf(w, p) - (w.t - p.died) / YEAR)} years old · ${esc(p.cause || '')} · year ${g.year}` : ''}</p>
      ${p ? `<div class="links">${p.spouse ? 'Married to ' + plink(w, p.spouse) + '<br>' : ''}${p.kids.length ? 'Children: ' + p.kids.map(id => plink(w, id)).join(', ') : ''}</div>` : ''}
      <div class="acts2"><button class="big" data-a="raise">🪦 Raise ${esc(g.name)} from the dead</button></div>`;
  }
  box.querySelectorAll('[data-p]').forEach(a => a.onclick = () => { const p = personById(w, +a.dataset.p); if (p && p.alive) { select({ kind: 'p', id: p.id }); lookAt(p.x, p.z); } else if (p) { const g = w.graves.find(q => q.pid === p.id); if (g) { select({ kind: 'g', id: g.id }); lookAt(g.x, g.z); } } });
  box.querySelectorAll('[data-a]').forEach(b => b.onclick = () => inspectorAction(b.dataset.a));
}
function inspectorAction(a) {
  const w = App.w, o = selObj(), s = App.sel; if (!o) return;
  const P = s.kind === 'p' ? o : null;
  switch (a) {
    case 'follow': App.follow = !App.follow; if (App.follow) App.goal.dist = Math.min(App.goal.dist, 22); break;
    case 'bless': armPower('bless'); break;
    case 'heal': if (!GOD.heal(w, o.x, o.z)) noPower(); else Snd.play('chime'); break;
    case 'inspire': case 'prophet': case 'smite': usePersonPower(a, P); break;
    case 'unbless': GOD.unbless(w, P); break;
    case 'lightning': if (!GOD.lightning(w, o.x + 2.5, o.z + 1.5)) noPower(); else Snd.play('thunder'); break;
    case 'pick': if (GOD.pickUp(w, s.kind, o.id)) { App.holding = { kind: s.kind, id: o.id, hist: [] }; armPower('hand'); Snd.play('grab'); toast('Move the mouse and click to let go.'); App.pickClick = true; } break;
    case 'look': lookAt(o.x, o.z, 14); break;
    case 'incarnate': incarnate(P); break;
    case 'raise': { const pid = s.kind === 'g' ? o.pid : o.id; if (!GOD.resurrect(w, pid)) noPower(); else { Snd.play('choir'); const p = personById(w, pid); if (p) select({ kind: 'p', id: p.id }); } break; }
    case 'smiteA': if (!GOD.lightning(w, o.x, o.z)) noPower(); else Snd.play('thunder'); break;
    case 'bfire': if (!GOD.fire(w, o.x, o.z)) noPower(); else Snd.play('fire'); break;
    case 'brain': if (!GOD.rain(w, o.x, o.z)) noPower(); else Snd.play('splash'); break;
    case 'bstrike': if (!GOD.lightning(w, o.x, o.z)) noPower(); else Snd.play('thunder'); break;
  }
  renderInspector();
}
function renderChron(force) {
  const w = App.w; if (!force && App._chronN === w.log.length && App._chronTop === w.log[0]) return; App._chronN = w.log.length; App._chronTop = w.log[0];
  $('#tab-chron').innerHTML = `<ul class="chron">${w.log.slice(0, 160).map((l, i) => `<li class="${l.type}" data-i="${i}"><span>${LOG_ICON[l.type] || '•'}</span><div>${esc(l.text)}<small>Year ${l.year}, ${SEASONS[l.season]}</small></div></li>`).join('')}</ul>`;
  $('#tab-chron').querySelectorAll('li').forEach(li => li.onclick = () => { const l = w.log[+li.dataset.i]; if (l && l.x != null) lookAt(l.x, l.z, 26); if (l && l.pid) { const p = personById(w, l.pid); if (p && p.alive) select({ kind: 'p', id: p.id }); } });
}
function renderPeople() {
  const w = App.w, fams = new Map();
  for (const p of living(w)) { const k = p.fam; if (!fams.has(k)) fams.set(k, []); fams.get(k).push(p); }
  const rows = [...fams.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, ps]) => { const f = personById(w, k); return `<div class="fam">House of ${esc(f ? f.name : '?')} · ${ps.length}</div>` + ps.sort((a, b) => ageOf(w, b) - ageOf(w, a)).map(p => `<a data-p="${p.id}">${esc(p.name)}${p.gifts.immortal ? ' ♾️' : ''}${p.prophet ? ' 👁️' : ''} <span>${JOB_INFO[p.job] || ''}, ${Math.floor(ageOf(w, p))}</span></a>`).join(''); }).join('');
  $('#tab-people').innerHTML = `<div class="plist">${rows}</div>`;
  $('#tab-people').querySelectorAll('[data-p]').forEach(a => a.onclick = () => { const p = personById(w, +a.dataset.p); if (p) { select({ kind: 'p', id: p.id }); lookAt(p.x, p.z, 18); } });
}
function renderAges() {
  const w = App.w, d = w.god.deeds;
  $('#tab-ages').innerHTML = `<div class="ages">${AGES.map((A, i) => `<div class="agei ${i === w.age ? 'now' : i < w.age ? 'done' : ''}"><b>${i < w.age ? '✓ ' : ''}${A.name}</b><p>${AGE_DESC[i]}${i > w.age ? `<br><small>Needs ${A.pop} people and ${A.k} knowledge.</small>` : ''}</p></div>`).join('')}
    <div class="agei ${w.launched ? 'done' : ''}"><b>${w.launched ? '✓ ' : ''}The stars</b><p>With enough knowledge, a modern people may build a rocket.</p></div></div>
    <div class="ins-sec">Your deeds</div>
    <div class="deeds"><div><b>${d.answered}</b>prayers answered</div><div><b>${d.ignored}</b>prayers ignored</div><div><b>${d.miracles}</b>great miracles</div><div><b>${d.killed}</b>people you killed</div><div><b>${w.stats.born}</b>born in your valley</div><div><b>${w.stats.died}</b>have died</div></div>`;
}

// -------------------------------------------------------------- HUD
function bindHud() {
  document.querySelectorAll('.time-card .tbtn').forEach(b => b.onclick = () => { Snd.init(); setSpeed(+b.dataset.speed); });
  $('#btn-sound').onclick = toggleSound; $('#btn-help').onclick = () => { $('#help').hidden = false; }; $('#help-close').onclick = () => { $('#help').hidden = true; };
  $('#btn-panel').onclick = () => showTab(App.tab === 'chron' ? 'inspect' : 'chron');
  $('#side-close').onclick = () => { $('#side').hidden = true; };
  document.querySelectorAll('.side-tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));
  $('#btn-ascend').onclick = ascend; $('#guide-next').onclick = () => guide(App.guideStep + 1);
  $('#help').addEventListener('click', e => { if (e.target.id === 'help') $('#help').hidden = true; });
  $('#view').addEventListener('pointerup', () => { if (App.pickClick && App.holding) { /* handled by next click */ } });
  document.addEventListener('pointerdown', e => { if (App.pickClick && App.holding && e.target.id === 'view') { App.pickClick = false; setTimeout(releaseHand, 0); } }, true);
}
function setSpeed(s) {
  if (s && App.speed === 0) App.prevSpeed = s; if (!s && App.speed) App.prevSpeed = App.speed;
  App.speed = s; document.querySelectorAll('.time-card .tbtn').forEach(b => b.setAttribute('aria-pressed', +b.dataset.speed === s));
}
function toggleSound() { Snd.init(); Snd.on = !Snd.on; $('#btn-sound').textContent = Snd.on ? '🔊' : '🔇'; }
const fmt = n => n >= 10000 ? Math.round(n / 1000) + 'k' : Math.round(n).toString();
function updateHud(w) {
  const ps = living(w), v = villageMood(w), hr = hourOf(w);
  $('#v-name').textContent = w.villageName; $('#v-age').textContent = AGES[w.age].name;
  $('#v-year').textContent = `Year ${w.yearIndex + 1}`; $('#v-season').textContent = SEASONS[seasonOf(w)];
  $('#v-time').textContent = App.speed >= 16 ? '' : hr < 5 ? 'Night' : hr < 9 ? 'Morning' : hr < 17 ? 'Day' : hr < 21 ? 'Evening' : 'Night';
  const nx = AGES[w.age + 1];
  if (nx) { const k0 = AGES[w.age].k, p = clamp01((w.knowledge - k0) / (nx.k - k0)); $('#v-agebar').style.width = (p * 100) + '%'; $('#v-next').textContent = `Next: ${nx.name} · knowledge ${Math.round(p * 100)}%${ps.length < nx.pop ? ` · needs ${nx.pop} people` : ''}`; }
  else { const p = clamp01(w.knowledge / LAUNCH_K); $('#v-agebar').style.width = (p * 100) + '%'; $('#v-next').textContent = w.launched ? 'They have reached the stars.' : `Next: the stars · knowledge ${Math.round(p * 100)}%`; }
  $('#r-pop').textContent = ps.length; $('#r-food').textContent = fmt(w.res.food); $('#r-wood').textContent = fmt(w.res.wood); $('#r-stone').textContent = fmt(w.res.stone); $('#r-metal').textContent = fmt(w.res.metal);
  $('#r-food').classList.toggle('low', w.res.food < ps.length * 2);
  $('#g-name').textContent = w.god.name; $('#g-title').textContent = godTitle(w);
  $('#g-love').style.width = Math.max(0, v.love) * 100 + '%'; $('#g-fear').style.width = v.fear * 100 + '%'; $('#g-faith').style.width = v.faith * 100 + '%';
  $('#g-mana').style.width = (w.god.unlimited ? 100 : w.god.mana / (w.god.manaMax || 120) * 100) + '%'; $('#g-mana-n').textContent = w.god.unlimited ? '∞' : Math.floor(w.god.mana);
  document.querySelectorAll('.pw').forEach(b => { const c = POWER_COST[b.dataset.id] || 0; b.classList.toggle('poor', !w.god.unlimited && c > w.god.mana); });
  if (App.incarnate) { const p = personById(w, App.incarnate); if (p) { $('#inc-name').textContent = p.name; $('#inc-sub').textContent = `${JOB_INFO[p.job] || ''}, ${Math.floor(ageOf(w, p))} · ${p.carry ? 'carrying ' + p.carry.type : 'empty-handed'}`; $('#inc-health').style.width = p.health * 100 + '%'; $('#inc-hunger').style.width = p.hunger * 100 + '%'; } }
}
function renderPrayers(w) {
  const act = w.prayers.filter(p => !p.done);
  const key = act.map(p => p.id).join(',');
  $('#pr-count').textContent = act.length || ''; $('#pr-empty').hidden = act.length > 0;
  if (key !== App._prKey) {
    App._prKey = key; const list = $('#pr-list'); list.innerHTML = '';
    for (const pr of act.slice().reverse()) {
      const p = personById(w, pr.pid), el = document.createElement('div'); el.className = 'pr'; el.dataset.id = pr.id;
      el.innerHTML = `<div class="who">${esc(p ? p.name : '?')} <span>${pr.kind === 'protect' ? 'in danger' : pr.kind}</span></div><p>"${esc(pr.text)}"</p><div class="acts"><button class="ans">Answer</button><button class="go">Look</button><button class="no" title="Punish them for asking">⚡</button></div><i class="tl"></i>`;
      el.querySelector('.ans').onclick = () => answerPrayer(pr); el.querySelector('.go').onclick = () => { if (p) { lookAt(p.x, p.z, 20); select({ kind: 'p', id: p.id }); } };
      el.querySelector('.no').onclick = () => { if (p && p.alive) { if (GOD.lightning(w, p.x, p.z)) { Snd.play('thunder'); pr.done = 'refused'; } else noPower(); } };
      list.appendChild(el);
    }
  }
  for (const el of document.querySelectorAll('.pr')) { const pr = w.prayers.find(q => q.id === +el.dataset.id); if (!pr) continue; const t = clamp01((pr.until - w.t) / (pr.until - pr.t0)); el.querySelector('.tl').style.width = t * 100 + '%'; el.classList.toggle('fade', t < .2); }
}
function answerPrayer(pr) {
  const w = App.w, p = personById(w, pr.pid); let ok = true;
  switch (pr.kind) {
    case 'rain': ok = GOD.rain(w, pr.x, pr.z); break;
    case 'fire': { const f = nearest(w.fires, pr.x, pr.z) || pr; ok = GOD.rain(w, f.x, f.z); break; }
    case 'food': case 'mercy': ok = GOD.harvest(w, w.center.x, w.center.z); break;
    case 'heal': { const t = personById(w, pr.target) || p; ok = GOD.heal(w, t.x, t.z); break; }
    case 'protect': { const th = findThreat(w, p || w.center, 80); if (th) { ok = GOD.lightning(w, th.x, th.z); lookAt(th.x, th.z); } else ok = GOD.sign(w); break; }
    case 'child': ok = GOD.bless(w, personById(w, pr.target) || p, 'fertile'); break;
    case 'revive': ok = GOD.resurrect(w, pr.target); break;
    case 'wisdom': ok = GOD.inspire(w, personById(w, pr.target) || p); break;
    case 'sign': ok = GOD.sign(w); break;
    case 'love': ok = GOD.bless(w, personById(w, pr.target) || p, 'charm'); break;
    case 'hunt': { let spot = null; for (let k = 0; k < 40 && !spot; k++) { const an = Math.random() * 6.28, x = w.center.x + Math.cos(an) * 22, z = w.center.z + Math.sin(an) * 22; if (tileAt(w, x, z) === TT.GRASS) spot = { x, z }; } spot = spot || { x: w.center.x + 18, z: w.center.z }; ok = GOD.spawn(w, spot.x, spot.z, w.age < 2 && Math.random() < .3 ? 'mammoth' : 'deer'); if (ok) lookAt(spot.x, spot.z); break; }
    case 'harvest': ok = GOD.rain(w, w.center.x, w.center.z); break;
    case 'winter': ok = GOD.harvest(w, w.center.x, w.center.z); break;
    case 'safe': ok = GOD.bless(w, personById(w, pr.target) || p, 'strong'); break;
    case 'family': ok = GOD.heal(w, p.x, p.z); break;
  }
  if (ok === false) noPower(); else { Snd.play('choir'); if (p) lookAt(p.x, p.z); if (!pr.done) { pr.done = 'answered'; w.god.deeds.answered++; if (p) { p.love = clamp(p.love + .3, -1, 1); p.faith = clamp01(p.faith + .25); } } }
}

// -------------------------------------------------------------- events → feedback
function handleEvents(w) {
  const evs = w.events.splice(0);
  for (const e of evs) {
    renderEvent(w, e);
    const near = e.x == null || Math.hypot(e.x - App.cam.target.x, e.z - App.cam.target.z) < App.cam.dist * 1.2;
    switch (e.type) {
      case 'log': tick(e); break;
      case 'ageUp': banner('A new age', AGES[e.age].name, AGE_DESC[e.age]); Snd.play('fanfare'); break;
      case 'prayer': if (near && App.speed <= 16) Snd.play('bell'); break;
      case 'impact': Snd.play('boom'); break;
      case 'lightning': if (near) Snd.play('thunder'); break;
      case 'birth': if (near && App.speed <= 4) Snd.play('birth'); break;
      case 'death': if (near && App.speed <= 4 && !e.raider) Snd.play('sad'); if (App.sel && App.sel.kind === 'p' && App.sel.id === e.id) renderInspector(); break;
      case 'raid': Snd.play('war'); break;
      case 'splash': if (near) Snd.play('splash'); break;
      case 'incarnDeath': incarnDeath(e.id); break;
      case 'launch': banner('Beyond the sky', 'They reached the stars', `The people of ${w.villageName} launched a rocket with your name on its side.`); Snd.play('fanfare'); setTimeout(() => ending(w), 7000); lookAt(e.x, e.z, 50); break;
      case 'extinct': ending(w, true); break;
      case 'answered': break;
    }
  }
}
function tick(e) {
  const imp = { age: 3, war: 3, destroy: 2, bless: 2, plague: 2, build: 1, death: 1, life: 0 }[e.kind] ?? 0;
  if (App.speed >= 64 && imp < 2) return; if (App.speed >= 16 && imp < 1) return;
  App.tick.push({ text: e.text, kind: e.kind, t: performance.now(), x: e.x, z: e.z });
}
function updateTicker(now) {
  const box = $('#ticker');
  if (App.tick.length && now - App.lastTick > 700) {
    const e = App.tick.shift(); App.lastTick = now;
    const el = document.createElement('div'); el.className = 'tk'; el.innerHTML = `<span>${LOG_ICON[e.kind] || '•'}</span><div>${esc(e.text)}</div>`;
    box.prepend(el); setTimeout(() => el.classList.add('out'), 8000); setTimeout(() => el.remove(), 9000);
    while (box.children.length > 5) box.lastChild.remove();
    if (App.tick.length > 6) App.tick.splice(0, App.tick.length - 6);
  }
}
function banner(k, t, s) { const b = $('#banner'); b.hidden = true; void b.offsetWidth; $('#banner-k').textContent = k; $('#banner-t').textContent = t; $('#banner-s').textContent = s || ''; b.hidden = false; clearTimeout(App._bn); App._bn = setTimeout(() => b.hidden = true, 5600); }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(App._tt); App._tt = setTimeout(() => t.classList.remove('show'), 2200); }

// -------------------------------------------------------------- speech bubbles
function updateBubbles(w) {
  const box = $('#bubbles'); if (!App._bub) { App._bub = []; for (let k = 0; k < 8; k++) { const d = document.createElement('div'); d.className = 'bub'; d.hidden = true; d.onclick = () => { if (d._pid) { select({ kind: 'p', id: d._pid }); } }; box.appendChild(d); App._bub.push(d); } }
  const praying = new Map(w.prayers.filter(p => !p.done).map(p => [p.pid, p]));
  const ct = App.cam.target, cand = [];
  if (App.cam.dist < 110) for (const p of w.people.concat(w.raiders || [])) {
    if (!p.alive || p.inside) continue;
    const pr = praying.get(p.id), talking = p.say && p.say.until > w.t;
    if (!pr && !talking) continue;
    const d = Math.hypot(p.x - ct.x, p.z - ct.z); if (d > App.cam.dist * .9) continue;
    cand.push({ p, pr, d: d - (pr ? 30 : 0) });
  }
  cand.sort((a, b) => a.d - b.d);
  App._bub.forEach((el, i) => {
    const c = cand[i]; if (!c) { el.hidden = true; el._pid = 0; return; }
    const p = c.p, s = project(p._rx ?? p.x, (p._sy ?? hAt(w, p.x, p.z) + 1.2) + .35, p._rz ?? p.z);
    if (!s.vis) { el.hidden = true; return; }
    const text = c.pr ? c.pr.text : p.say.text, cls = c.pr ? 'bub pray' : 'bub';
    if (el._t !== text || el.className !== cls) { el._t = text; el.className = cls; el.innerHTML = `<b>${esc(p.name)}</b>${esc(text)}`; }
    el._pid = p.id; el.hidden = false; el.style.left = s.x + 'px'; el.style.top = s.y + 'px';
  });
}

// -------------------------------------------------------------- incarnation
function incarnate(p) {
  const w = App.w; if (!p || !p.alive || p.faction === 'raider') return;
  if (App.incarnate) ascend(true);
  GOD.incarnate(w, p); App.incarnate = p.id; armPower(null); select({ kind: 'p', id: p.id });
  App.goal.dist = 10; App.goal.pitch = .78; setSpeed(1);
  document.body.classList.add('mortal'); $('#incarn').hidden = false; incMsg(`You are ${p.name}. Walk with W A S D.`);
  Snd.play('choir');
}
function ascend(quiet) {
  const w = App.w; if (!App.incarnate) return;
  GOD.ascend(w); App.incarnate = null; w.input = {};
  document.body.classList.remove('mortal'); $('#incarn').hidden = true; App.goal.dist = 34; App.goal.pitch = .78;
  if (!quiet) Snd.play('chime');
}
function incMsg(m) { $('#inc-msg').textContent = m; clearTimeout(App._im); App._im = setTimeout(() => $('#inc-msg').textContent = '', 4000); }
function incarnDeath(id) {
  const w = App.w, p = personById(w, id); App.incarnate = null; w.input = {};
  document.body.classList.remove('mortal'); $('#incarn').hidden = true;
  const heirs = p ? p.kids.concat([p.spouse]).map(k => personById(w, k)).filter(q => q && q.alive).slice(0, 4) : [];
  modal(`${p ? esc(p.name) : 'Your body'} has died`, `<p>${p ? esc(p.name) + ' ' + esc(p.cause || 'died') + '.' : ''} ${heirs.length ? 'You could live on through someone they loved.' : 'There is no one left to carry you.'}</p>`,
    heirs.map(h => [`Become ${h.name}`, () => incarnate(h)]).concat([['Return to the sky', () => { App.goal.dist = 34; }]]));
}
function modal(title, body, buttons) {
  $('#modal-h').innerHTML = title; $('#modal-body').innerHTML = body; const f = $('#modal-foot'); f.innerHTML = '';
  for (const [label, fn] of buttons) { const b = document.createElement('button'); b.className = 'btn' + (f.children.length ? '' : ' btn-gold'); b.textContent = label; b.onclick = () => { $('#modal').hidden = true; fn && fn(); }; f.appendChild(b); }
  $('#modal').hidden = false;
}
function ending(w, extinct) {
  const d = w.god.deeds, v = villageMood(w);
  const verdict = extinct ? `The people of ${esc(w.villageName)} are gone.` : `After ${w.yearIndex} years, the people of ${esc(w.villageName)} reached the stars.`;
  const memory = v.love > .3 ? `They remember you as ${esc(w.god.name)} ${esc(godTitle(w))}, who listened.` : v.fear > .4 ? `They remember you as ${esc(w.god.name)} ${esc(godTitle(w))}, and they still lower their voices when they say it.` : v.faith < .2 ? `Most of them no longer believe you exist.` : `They remember you as ${esc(w.god.name)} ${esc(godTitle(w))}.`;
  modal(extinct ? 'Silence' : 'The end of the beginning', `<p>${verdict} ${memory}</p><div class="stats"><div><b>${w.stats.born + 15}</b>lived</div><div><b>${w.stats.peak}</b>at their peak</div><div><b>${d.answered}</b>prayers answered</div><div><b>${d.ignored}</b>ignored</div><div><b>${d.miracles}</b>miracles</div><div><b>${d.killed}</b>killed by you</div></div>`,
    extinct ? [['Send new settlers', () => { immigrate(w); immigrate(w); w.extinct = 0; }], ['A new valley', () => location.reload()]] : [['Keep watching', null], ['A new valley', () => location.reload()]]);
}

// -------------------------------------------------------------- onboarding
const GUIDE = [
  w => `These are your people: <b>${living(w).length} souls</b> around a fire in ${esc(w.villageName)}. <b>Click anyone</b> to meet them. Drag to look around, scroll to zoom.`,
  w => `When they need something they <b>pray to you</b>. Prayers appear on the left and above their heads. <b>Answer</b> them and they love you. Ignore them and they doubt you.`,
  w => `Your powers are at the bottom: <b>Nature, Wrath, Grace and Hand</b>. Try the <b>Hand of god</b> and pick someone up. Or send a little rain.`,
  w => `Speed up time at the top. At <b>64×</b> the years fly by and you can watch them grow from tents to towers. Press <b>H</b> any time for help.`,
];
function guide(i) {
  App.guideStep = i; const g = $('#guide');
  if (i >= GUIDE.length) { g.hidden = true; return; }
  $('#guide-text').innerHTML = GUIDE[i](App.w); $('#guide-step').textContent = `${i + 1} / ${GUIDE.length}`; $('#guide-next').textContent = i === GUIDE.length - 1 ? 'Begin' : 'Next'; g.hidden = false;
}

// test hook
window.__god = { App, get w() { return App.w; }, start, setSpeed, armPower, select, incarnate, ascend, answerPrayer, showTab, lookAt, R };
boot();
/*UI-END*/

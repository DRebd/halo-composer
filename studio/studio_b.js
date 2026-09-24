
// -------------------------------------------------------------------- state
const LS_KEY = 'halo-studio/v1';
const state = {
  scene: baseScene(),
  zoneNames: ['Keys', 'WASD', 'Halo', 'Zone 4', 'Zone 5', 'Zone 6', 'Zone 7', 'Zone 8'],
  sel: new Set(),
  color: [255, 200, 140],
  zone: 0,
  grad: 0,
  tool: 'select',
  view: 'live',
  tab: 'paint',
  preview: { play: true, typing: false, keys: 255, halo: 5 },
  link: null,
  info: null,
  calib: { idx: 0, placing: false },
};
const HALO_LEVELS = [0, 48, 96, 144, 200, 255];
const keyXY = new Uint8Array(KEY_LEDS * 2);
KEYS.forEach((k) => { keyXY[k.led * 2] = k.px; keyXY[k.led * 2 + 1] = k.py; });
const engine = new HC.HcEngine(keyXY);
const frame = new Uint8Array(LED_COUNT * 3);
const t0 = performance.now();
const nowMs = () => Math.floor(performance.now() - t0) + 1000;

function persistLocal() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(exportProfile('autosave'))); } catch (e) { /* storage unavailable */ }
}
function restoreLocal() {
  try { const j = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if (j) importProfile(j, false); } catch (e) { /* ignore */ }
}

// --------------------------------------------------------------- profiles
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
function exportProfile(name) {
  return { format: 'halo-studio-scene', version: 1, name, created: new Date().toISOString(), zoneNames: state.zoneNames.slice(), scene: b64(HC.sceneToBytes(state.scene)) };
}
// Rejects scene data the firmware (or this editor) can't use, e.g. a hand-edited
// file or one from a newer Studio, before it reaches the editor or the keyboard.
function validateScene(sc) {
  sc.zones.forEach((z, i) => {
    if (z.effect >= FX.COUNT || z.source >= SRC.COUNT || z.axis >= AXIS.COUNT || z.srcAxis >= AXIS.COUNT || z.gradient >= GRADIENTS || (z.reactive & 15) >= RX.COUNT)
      throw new Error(`zone ${i + 1} has settings this version of Halo Studio doesn't know`);
  });
  sc.grad.forEach((g, i) => { if (g.count > GRAD_STOPS) throw new Error(`gradient ${i + 1} has more than ${GRAD_STOPS} stops`); });
}
// Replaces the editor's scene. Halo positions describe this keyboard, not a look,
// so they are kept unless keepGeometry is false (e.g. reading from the keyboard).
function adoptScene(sc, { keepGeometry = true, push = true } = {}) {
  if (keepGeometry) { sc.haloXY.set(state.scene.haloXY); sc.haloRing.set(state.scene.haloRing); }
  state.scene = sc;
  engine.reset();
  if (push) markAll(); else persistLocalSoon();
}
function importProfile(j, push = true) {
  if (!j || j.format !== 'halo-studio-scene') throw new Error('Not a Halo Studio scene file');
  const bytes = unb64(j.scene);
  if (bytes.length !== HC.SCENE_BYTES) throw new Error(`Scene is ${bytes.length} bytes, expected ${HC.SCENE_BYTES}`);
  const sc = HC.sceneFromBytes(bytes);
  validateScene(sc);
  if (Array.isArray(j.zoneNames)) state.zoneNames = j.zoneNames.slice(0, ZONES).concat(state.zoneNames.slice(j.zoneNames.length));
  adoptScene(sc, { keepGeometry: push, push });
}

// ---------------------------------------------------------------- HID link
const CMD = 0xD0;
const SUB = { INFO: 1, ACTIVE: 2, SET_COLORS: 3, GET_COLORS: 4, SET_ZMAP: 5, GET_ZMAP: 6, SET_ZONE: 7, GET_ZONE: 8, SET_GRAD: 9, GET_GRAD: 10, SET_GEOM: 11, GET_GEOM: 12, SET_FLAGS: 13, GET_FLAGS: 14, SAVE: 16, RELOAD: 17, DEFAULTS: 18, IDENTIFY: 19, SIM_KEY: 20, STATS: 21 };
const SUB_NAME = Object.fromEntries(Object.entries(SUB).map(([k, v]) => [v, k]));
// SAVE writes 915 bytes to the keyboard's flash-backed EEPROM; give it room.
const SLOW = new Set([SUB.SAVE, SUB.RELOAD, SUB.DEFAULTS]);
const logLines = [];
function log(msg) { logLines.push(new Date().toLocaleTimeString() + '  ' + msg); if (logLines.length > 80) logLines.shift(); const l = $('#hidlog'); if (l) { l.textContent = logLines.join('\n'); l.scrollTop = l.scrollHeight; } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class NotComposerError extends Error {}

class HidLink {
  constructor(dev) {
    this.dev = dev; this.waiter = null; this.chain = Promise.resolve(); this.closed = false; this.quietUntil = 0;
    this.onReport = (e) => {
      const d = new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength);
      const w = this.waiter;
      if (!w || performance.now() < this.quietUntil) return;
      // VIA answers commands it doesn't know with 0xFF: the firmware has no Composer.
      if (d[0] === 0xFF && w.sub === SUB.INFO) { this.waiter = null; clearTimeout(w.timer); w.reject(new NotComposerError('no Composer firmware')); return; }
      if (d[0] !== CMD || d[1] !== w.sub) return;
      this.waiter = null; clearTimeout(w.timer); w.resolve(Uint8Array.from(d));
    };
    dev.addEventListener('inputreport', this.onReport);
  }
  // One request in flight at a time; responses are matched on [CMD, sub]. Replies
  // don't echo arguments, so after a timeout the channel is ignored briefly to let
  // a late reply drain instead of pairing it with the next request.
  cmd(sub, args = []) {
    const run = async () => {
      if (this.closed) throw new Error('keyboard disconnected');
      const quiet = this.quietUntil - performance.now(); if (quiet > 0) await sleep(quiet);
      const r = await new Promise((resolve, reject) => {
        const buf = new Uint8Array(32); buf[0] = CMD; buf[1] = sub; buf.set(args.slice(0, 30), 2);
        const timer = setTimeout(() => { this.waiter = null; this.quietUntil = performance.now() + 250; reject(new Error(`timeout on ${SUB_NAME[sub] || sub}`)); }, SLOW.has(sub) ? 3000 : 800);
        this.waiter = { sub, resolve, reject, timer };
        this.dev.sendReport(0, buf).catch((err) => { clearTimeout(timer); this.waiter = null; reject(err); });
      });
      if (r[2] !== 0) throw new Error(`${SUB_NAME[sub]} failed with status ${r[2]}`);
      return r;
    };
    const p = this.chain.then(run, run);
    this.chain = p.catch(() => {});
    return p;
  }
  async close() {
    this.closed = true;
    const w = this.waiter; this.waiter = null;
    if (w) { clearTimeout(w.timer); w.reject(new Error('keyboard disconnected')); }
    try { this.dev.removeEventListener('inputreport', this.onReport); await this.dev.close(); } catch (e) { /* ignore */ }
  }
}

function dropLink(reason) {
  const L = state.link; if (!L) return;
  state.link = null; state.info = null;
  clearTimeout(syncTimer); clearDirty();
  L.close();
  if (reason) log(reason);
  updateConn(); renderTab();
}

async function connect() {
  if (window.HALO_STUDIO_HOSTED) { toast('This embedded preview can\'t reach USB devices. Open the full Halo Studio page in Chrome or Edge to connect.'); return; }
  if (!('hid' in navigator)) { toast('This browser can\'t talk to USB keyboards (no WebHID). Use desktop Chrome or Edge.'); return; }
  let link = null;
  try {
    const devs = await navigator.hid.requestDevice({ filters: [{ vendorId: 0x19F5, productId: 0x32F5, usagePage: 0xFF60, usage: 0x61 }, { usagePage: 0xFF60, usage: 0x61 }] });
    const dev = devs[0];
    if (!dev) return;
    if (!dev.opened) await dev.open();
    link = new HidLink(dev);
    const r = await link.cmd(SUB.INFO);
    const info = { proto: r[3], leds: r[4], keys: r[5], halo: r[6], zones: r[7], grads: r[8], stops: r[9], fx: r[10], active: !!r[11], size: r[12] | (r[13] << 8), flags: r[14], magic: r[15], mode: r[16], prev: r[17], name: dev.productName };
    if (info.size !== HC.SCENE_BYTES || info.leds !== LED_COUNT) { await link.close(); toast(`Firmware scene layout (${info.size} bytes) doesn't match this Studio (${HC.SCENE_BYTES}). Update one of them.`); return; }
    state.link = link; state.info = info;
    log(`connected: ${dev.productName} proto v${info.proto}, composer ${info.active ? 'active' : 'inactive'}`);
    updateConn();
    await readScene('connect');
    renderTab();
  } catch (e) {
    if (link && state.link === link) dropLink(); else if (link) link.close();
    if (e instanceof NotComposerError) {
      toast('Your keyboard answered, but it is not running the Halo Composer firmware yet. Flash nuphy_halo75v2_ansi_composer.bin first (see the flashing guide).');
      log('connect: keyboard has no Composer protocol (stock or other firmware)');
    } else {
      toast('Could not connect: ' + e.message + '. Close VIA and any other tab using the keyboard, and use the USB cable in wired mode.');
      log('connect error: ' + e.message);
    }
  }
}
navigator.hid?.addEventListener?.('disconnect', (e) => {
  if (state.link && e.device === state.link.dev) dropLink('keyboard disconnected');
});

const AUTO_BACKUPS = 5;
function backupEditor(label) {
  const lib = loadLibrary();
  const entry = exportProfile(`${label} ${new Date().toLocaleString()}`); entry.auto = true;
  lib.push(entry);
  // keep only the newest few automatic backups
  let autos = lib.filter((p) => p.auto).length;
  for (let i = 0; i < lib.length && autos > AUTO_BACKUPS;) { if (lib[i].auto) { lib.splice(i, 1); autos--; } else i++; }
  saveLibrary(lib);
}

// why: 'connect' | 'read' | 'revert' | 'factory'
async function readScene(why = 'read') {
  const L = state.link; if (!L) return;
  await settleSync();
  if (why !== 'revert') backupEditor({ connect: 'Editor before connecting', read: 'Editor before reading keyboard', factory: 'Editor before factory scene' }[why]);
  const s = HC.blankScene();
  for (let start = 0; start < LED_COUNT; start += 9) {
    const n = Math.min(9, LED_COUNT - start); const r = await L.cmd(SUB.GET_COLORS, [start, n]);
    s.color.set(r.subarray(3, 3 + n * 3), start * 3);
  }
  for (let start = 0; start < LED_COUNT; start += 28) {
    const n = Math.min(28, LED_COUNT - start); const r = await L.cmd(SUB.GET_ZMAP, [start, n]);
    s.zoneOf.set(r.subarray(3, 3 + n), start);
  }
  for (let z = 0; z < ZONES; z++) { const r = await L.cmd(SUB.GET_ZONE, [z]); s.zones[z] = HC.zoneFromBytes(r, 3); }
  for (let g = 0; g < GRADIENTS; g++) { const r = await L.cmd(SUB.GET_GRAD, [g]); s.grad[g] = HC.gradFromBytes(r, 3); }
  for (let start = 0; start < HALO_LEDS; start += 9) {
    const n = Math.min(9, HALO_LEDS - start); const r = await L.cmd(SUB.GET_GEOM, [start, n]);
    for (let i = 0; i < n; i++) { s.haloXY[(start + i) * 2] = r[3 + i * 3]; s.haloXY[(start + i) * 2 + 1] = r[4 + i * 3]; s.haloRing[start + i] = r[5 + i * 3]; }
  }
  const f = await L.cmd(SUB.GET_FLAGS); s.flags = f[3];
  clearDirty();
  adoptScene(s, { keepGeometry: false, push: false });
  persistLocal();
  log('read scene from keyboard');
  if (why === 'connect' || why === 'read') toast('Loaded the scene stored on your keyboard. Your previous editor scene is in Scenes → My scenes.');
}

// dirty tracking + serialized sync (RAM only; Save writes EEPROM)
const dirty = { colors: new Set(), zmap: new Set(), zones: new Set(), grads: new Set(), geom: false, flags: false };
let syncTimer = null, flushing = null;
function markColors(leds) { for (const i of leds) dirty.colors.add(i); scheduleSync(); }
function markZmap(leds) { for (const i of leds) dirty.zmap.add(i); scheduleSync(); }
function markZone(z) { dirty.zones.add(z); scheduleSync(); }
function markGrad(g) { dirty.grads.add(g); scheduleSync(); }
function markGeom() { dirty.geom = true; scheduleSync(); }
function markFlags() { dirty.flags = true; scheduleSync(); }
function dirtyAll() {
  for (let i = 0; i < LED_COUNT; i++) { dirty.colors.add(i); dirty.zmap.add(i); }
  for (let z = 0; z < ZONES; z++) dirty.zones.add(z);
  for (let g = 0; g < GRADIENTS; g++) dirty.grads.add(g);
  dirty.geom = true; dirty.flags = true;
}
function markAll() { dirtyAll(); scheduleSync(); }
function clearDirty() { dirty.colors.clear(); dirty.zmap.clear(); dirty.zones.clear(); dirty.grads.clear(); dirty.geom = false; dirty.flags = false; }
const hasDirty = () => dirty.colors.size || dirty.zmap.size || dirty.zones.size || dirty.grads.size || dirty.geom || dirty.flags;
function scheduleSync() {
  persistLocalSoon();
  if (!state.link || !$('#livePush').checked) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => flush().catch((e) => { log('sync error: ' + e.message); toast('Sync failed: ' + e.message); }), 60);
}
let persistTimer = null;
function persistLocalSoon() { clearTimeout(persistTimer); persistTimer = setTimeout(persistLocal, 400); }
function runs(set, maxLen) {
  const idx = [...set].sort((a, b) => a - b); const out = [];
  for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1] === idx[j] + 1 && j + 1 - i < maxLen) j++; out.push([idx[i], j - i + 1]); i = j + 1; }
  return out;
}
// Waits for any in-flight sync and cancels a pending one (used before reads).
async function settleSync() {
  clearTimeout(syncTimer);
  while (flushing) { try { await flushing; } catch (e) { /* reported by its caller */ } }
}
// Sends everything marked dirty. Always reads the *current* scene at send time, so
// a scene swapped in mid-sync is what ends up on the keyboard. Concurrent callers
// wait for the running pass and then send whatever changed meanwhile. On failure
// everything is marked dirty again so the next sync resends it.
async function flush() {
  while (flushing) { try { await flushing; } catch (e) { /* reported by its caller */ } }
  if (!state.link || !hasDirty()) return;
  flushing = sendDirty();
  try { await flushing; } finally { flushing = null; }
  if (state.link && hasDirty()) await flush();
}
async function sendDirty() {
  const L = state.link;
  try {
    const cRuns = runs(dirty.colors, 9); dirty.colors.clear();
    for (const [start, n] of cRuns) await L.cmd(SUB.SET_COLORS, [start, n, ...state.scene.color.subarray(start * 3, (start + n) * 3)]);
    const zRuns = runs(dirty.zmap, 27); dirty.zmap.clear();
    for (const [start, n] of zRuns) await L.cmd(SUB.SET_ZMAP, [start, n, ...state.scene.zoneOf.subarray(start, start + n)]);
    for (const z of [...dirty.zones]) { dirty.zones.delete(z); const b = new Uint8Array(20); HC.zoneToBytes(state.scene.zones[z], b, 0); await L.cmd(SUB.SET_ZONE, [z, ...b]); }
    for (const g of [...dirty.grads]) { dirty.grads.delete(g); const b = new Uint8Array(HC.GRAD_BYTES); HC.gradToBytes(state.scene.grad[g], b, 0); await L.cmd(SUB.SET_GRAD, [g, ...b]); }
    if (dirty.geom) {
      dirty.geom = false;
      for (let start = 0; start < HALO_LEDS; start += 9) {
        const n = Math.min(9, HALO_LEDS - start); const a = [start, n], s = state.scene;
        for (let i = 0; i < n; i++) a.push(s.haloXY[(start + i) * 2], s.haloXY[(start + i) * 2 + 1], s.haloRing[start + i]);
        await L.cmd(SUB.SET_GEOM, a);
      }
    }
    if (dirty.flags) { dirty.flags = false; await L.cmd(SUB.SET_FLAGS, [state.scene.flags]); }
    const n = cRuns.length + zRuns.length; if (n) log(`pushed ${n} color/zone packet(s)`);
  } catch (e) {
    if (state.link === L) dirtyAll(); // resend everything next time
    throw e;
  }
}
async function saveToKeyboard() {
  if (!state.link) return;
  await flush();
  await state.link.cmd(SUB.SAVE); log('saved to EEPROM'); toast('Saved to the keyboard. It will survive unplugging.');
}
async function revertFromKeyboard() {
  if (!state.link) return;
  await settleSync(); clearDirty();
  await state.link.cmd(SUB.RELOAD); await readScene('revert'); renderTab();
  toast('Back to the scene saved on the keyboard.');
}
async function factoryScene() {
  if (!state.link) return;
  const xy = state.scene.haloXY.slice(), ring = state.scene.haloRing.slice();
  await settleSync(); clearDirty();
  await state.link.cmd(SUB.DEFAULTS); await readScene('factory');
  state.scene.haloXY.set(xy); state.scene.haloRing.set(ring); markGeom(); await flush();
  renderTab(); toast('Factory look loaded (your halo calibration was kept). Save to keep it.');
}
async function setActive(on) {
  if (!state.link) return;
  await state.link.cmd(SUB.ACTIVE, [on ? 1 : 0]);
  const r = await state.link.cmd(SUB.INFO); state.info.active = !!r[11]; state.info.mode = r[16];
  log(`composer ${state.info.active ? 'activated' : 'deactivated'}`); updateConn(); renderTab();
}
function updateConn() {
  const p = $('#connPill'), L = state.link;
  if (L) { p.textContent = state.info.active ? 'Connected · Composer on' : 'Connected · Composer off'; p.className = 'pill ' + (state.info.active ? 'on' : 'warn'); }
  else { p.textContent = 'Preview only'; p.className = 'pill'; }
  $('#btnSave').disabled = !L; $('#btnRevert').disabled = !L;
  $('#btnConnect').textContent = L ? 'Disconnect' : 'Connect keyboard';
}

let toastTimer = null;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 4200); }

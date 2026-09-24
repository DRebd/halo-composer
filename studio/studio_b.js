
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
function importProfile(j, push = true) {
  if (!j || j.format !== 'halo-studio-scene') throw new Error('Not a Halo Studio scene file');
  const bytes = unb64(j.scene);
  if (bytes.length !== HC.SCENE_BYTES) throw new Error(`Scene is ${bytes.length} bytes, expected ${HC.SCENE_BYTES}`);
  state.scene = HC.sceneFromBytes(bytes);
  if (Array.isArray(j.zoneNames)) state.zoneNames = j.zoneNames.slice(0, ZONES).concat(state.zoneNames.slice(j.zoneNames.length));
  engine.reset();
  if (push) markAll();
}

// ---------------------------------------------------------------- HID link
const CMD = 0xD0;
const SUB = { INFO: 1, ACTIVE: 2, SET_COLORS: 3, GET_COLORS: 4, SET_ZMAP: 5, GET_ZMAP: 6, SET_ZONE: 7, GET_ZONE: 8, SET_GRAD: 9, GET_GRAD: 10, SET_GEOM: 11, GET_GEOM: 12, SET_FLAGS: 13, GET_FLAGS: 14, SAVE: 16, RELOAD: 17, DEFAULTS: 18, IDENTIFY: 19, SIM_KEY: 20, STATS: 21 };
const SUB_NAME = Object.fromEntries(Object.entries(SUB).map(([k, v]) => [v, k]));
const logLines = [];
function log(msg) { logLines.push(new Date().toLocaleTimeString() + '  ' + msg); if (logLines.length > 80) logLines.shift(); const l = $('#hidlog'); if (l) { l.textContent = logLines.join('\n'); l.scrollTop = l.scrollHeight; } }

class HidLink {
  constructor(dev) {
    this.dev = dev; this.waiter = null; this.chain = Promise.resolve();
    this.onReport = (e) => {
      const d = new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength);
      if (d[0] !== CMD || !this.waiter || d[1] !== this.waiter.sub) return;
      const w = this.waiter; this.waiter = null; clearTimeout(w.timer); w.resolve(Uint8Array.from(d));
    };
    dev.addEventListener('inputreport', this.onReport);
  }
  // One request in flight at a time; responses are matched on [CMD, sub].
  cmd(sub, args = []) {
    const run = () => new Promise((resolve, reject) => {
      const buf = new Uint8Array(32); buf[0] = CMD; buf[1] = sub; buf.set(args.slice(0, 30), 2);
      const timer = setTimeout(() => { this.waiter = null; reject(new Error(`timeout on ${SUB_NAME[sub] || sub}`)); }, 800);
      this.waiter = { sub, resolve, timer };
      this.dev.sendReport(0, buf).catch((err) => { clearTimeout(timer); this.waiter = null; reject(err); });
    }).then((r) => { if (r[2] !== 0) throw new Error(`${SUB_NAME[sub]} failed with status ${r[2]}`); return r; });
    const p = this.chain.then(run, run);
    this.chain = p.catch(() => {});
    return p;
  }
  async close() { try { this.dev.removeEventListener('inputreport', this.onReport); await this.dev.close(); } catch (e) { /* ignore */ } }
}

async function connect() {
  if (window.HALO_STUDIO_HOSTED) { toast('This hosted copy is preview-only (browsers block USB access here). Run halo-studio.html from http://localhost in Chrome or Edge to connect.'); return; }
  if (!('hid' in navigator)) { toast('This browser has no WebHID. Use Chrome or Edge on desktop, served from http://localhost.'); return; }
  try {
    const devs = await navigator.hid.requestDevice({ filters: [{ vendorId: 0x19F5, productId: 0x32F5, usagePage: 0xFF60, usage: 0x61 }, { usagePage: 0xFF60, usage: 0x61 }] });
    const dev = devs[0];
    if (!dev) return;
    if (!dev.opened) await dev.open();
    const link = new HidLink(dev);
    const r = await link.cmd(SUB.INFO);
    const info = { proto: r[3], leds: r[4], keys: r[5], halo: r[6], zones: r[7], grads: r[8], stops: r[9], fx: r[10], active: !!r[11], size: r[12] | (r[13] << 8), flags: r[14], magic: r[15], mode: r[16], prev: r[17], name: dev.productName };
    if (info.size !== HC.SCENE_BYTES || info.leds !== LED_COUNT) { await link.close(); toast(`Firmware scene layout (${info.size} bytes) doesn't match this Studio (${HC.SCENE_BYTES}). Update one of them.`); return; }
    state.link = link; state.info = info;
    log(`connected: ${dev.productName} proto v${info.proto}, composer ${info.active ? 'active' : 'inactive'}`);
    dev.addEventListener?.('disconnect', () => {});
    updateConn();
    // Keep a copy of whatever was in the editor, then show what the keyboard has.
    const lib = loadLibrary(); lib.push(exportProfile('Editor before connecting ' + new Date().toLocaleString())); saveLibrary(lib);
    await readScene();
    renderTab();
  } catch (e) {
    toast('Could not connect: ' + e.message + '. Close VIA and any other tab using the keyboard, and use the USB cable in wired mode.');
    log('connect error: ' + e.message);
  }
}
navigator.hid?.addEventListener?.('disconnect', (e) => {
  if (state.link && e.device === state.link.dev) { state.link = null; state.info = null; log('keyboard disconnected'); updateConn(); renderTab(); }
});


async function readScene() {
  const L = state.link; if (!L) return;
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
  state.scene = s; engine.reset();
  log('read scene from keyboard');
  toast('Loaded the scene stored on your keyboard. Your previous editor scene is in Scenes → My scenes.');
}

// dirty tracking + batched sync (RAM only; Save writes EEPROM)
const dirty = { colors: new Set(), zmap: new Set(), zones: new Set(), grads: new Set(), geom: false, flags: false };
let syncTimer = null, syncing = false;
function markColors(leds) { for (const i of leds) dirty.colors.add(i); scheduleSync(); }
function markZmap(leds) { for (const i of leds) dirty.zmap.add(i); scheduleSync(); }
function markZone(z) { dirty.zones.add(z); scheduleSync(); }
function markGrad(g) { dirty.grads.add(g); scheduleSync(); }
function markGeom() { dirty.geom = true; scheduleSync(); }
function markFlags() { dirty.flags = true; scheduleSync(); }
function markAll() { markColors(range(0, 127)); markZmap(range(0, 127)); for (let z = 0; z < ZONES; z++) markZone(z); for (let g = 0; g < GRADIENTS; g++) markGrad(g); markGeom(); markFlags(); }
function scheduleSync() {
  persistLocalSoon();
  if (!state.link || !$('#livePush').checked) return;
  clearTimeout(syncTimer); syncTimer = setTimeout(flush, 60);
}
let persistTimer = null;
function persistLocalSoon() { clearTimeout(persistTimer); persistTimer = setTimeout(persistLocal, 400); }
function runs(set, maxLen) {
  const idx = [...set].sort((a, b) => a - b); const out = [];
  for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1] === idx[j] + 1 && j + 1 - i < maxLen) j++; out.push([idx[i], j - i + 1]); i = j + 1; }
  return out;
}
async function flush() {
  const L = state.link; if (!L) return;
  if (syncing) { clearTimeout(syncTimer); syncTimer = setTimeout(flush, 40); return; }
  syncing = true;
  const s = state.scene;
  try {
    const cRuns = runs(dirty.colors, 9); dirty.colors.clear();
    for (const [start, n] of cRuns) await L.cmd(SUB.SET_COLORS, [start, n, ...s.color.subarray(start * 3, (start + n) * 3)]);
    const zRuns = runs(dirty.zmap, 27); dirty.zmap.clear();
    for (const [start, n] of zRuns) await L.cmd(SUB.SET_ZMAP, [start, n, ...s.zoneOf.subarray(start, start + n)]);
    for (const z of [...dirty.zones]) { dirty.zones.delete(z); const b = new Uint8Array(20); HC.zoneToBytes(s.zones[z], b, 0); await L.cmd(SUB.SET_ZONE, [z, ...b]); }
    for (const g of [...dirty.grads]) { dirty.grads.delete(g); const b = new Uint8Array(HC.GRAD_BYTES); HC.gradToBytes(s.grad[g], b, 0); await L.cmd(SUB.SET_GRAD, [g, ...b]); }
    if (dirty.geom) {
      dirty.geom = false;
      for (let start = 0; start < HALO_LEDS; start += 9) {
        const n = Math.min(9, HALO_LEDS - start); const a = [start, n];
        for (let i = 0; i < n; i++) a.push(s.haloXY[(start + i) * 2], s.haloXY[(start + i) * 2 + 1], s.haloRing[start + i]);
        await L.cmd(SUB.SET_GEOM, a);
      }
    }
    if (dirty.flags) { dirty.flags = false; await L.cmd(SUB.SET_FLAGS, [s.flags]); }
    const n = cRuns.length + zRuns.length; if (n) log(`pushed ${n} color/zone packet(s)`);
  } catch (e) { log('sync error: ' + e.message); toast('Sync failed: ' + e.message); }
  finally { syncing = false; }
}
async function saveToKeyboard() {
  if (!state.link) return;
  await flush();
  await state.link.cmd(SUB.SAVE); log('saved to EEPROM'); toast('Saved to the keyboard. It will survive unplugging.');
}
async function revertFromKeyboard() {
  if (!state.link) return;
  await state.link.cmd(SUB.RELOAD); await readScene(); renderTab();
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

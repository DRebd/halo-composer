
// Halo setup ---------------------------------------------------------------
function identify(i) {
  if (!state.link || !state.info?.active) return;
  const led = i < 0 ? 0xFF : KEY_LEDS + i;
  state.link.cmd(SUB.IDENTIFY, [led, 255, 150, 30, 0x60, 0xEA]).catch((e) => log('identify: ' + e.message));
}
function placeHalo(x, y) {
  const [ex, ey] = toEngine(x, y), i = state.calib.idx, s = state.scene;
  s.haloXY[i * 2] = ex; s.haloXY[i * 2 + 1] = ey; markGeom();
}
function advanceCalib() {
  const c = state.calib;
  if (!c.placing) { c.idx = (c.idx + 1) % HALO_LEDS; renderTab(); return; }
  c.idx++;
  if (c.idx >= HALO_LEDS) { c.idx = HALO_LEDS - 1; c.placing = false; identify(-1); recomputeRing(); toast('Calibration done. Ring order recomputed from your positions. Press Save to keep it on the keyboard.'); }
  else identify(c.idx);
  renderTab();
}
function stopWalk() { if (walkTimer) { clearInterval(walkTimer); walkTimer = null; } }
function recomputeRing() {
  const s = state.scene, xs = [], ys = [];
  for (let i = 0; i < HALO_LEDS; i++) { xs.push(s.haloXY[i * 2]); ys.push(s.haloXY[i * 2 + 1]); }
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0), P = 2 * (w + h), cy = (y0 + y1) / 2;
  for (let i = 0; i < HALO_LEDS; i++) {
    const x = xs[i], y = ys[i], d = [x1 - x, y1 - y, x - x0, y - y0]; // right, bottom, left, top
    const e = d.indexOf(Math.min(...d));
    let p;
    if (e === 0) p = y >= cy ? y - cy : P - (cy - y);
    else if (e === 1) p = h / 2 + (x1 - x);
    else if (e === 2) p = h / 2 + w + (y1 - y);
    else p = h / 2 + w + h + (x - x0);
    s.haloRing[i] = Math.floor((p * 256) / P) & 255;
  }
  markGeom();
}
let walkTimer = null;
function walkRing() {
  stopWalk();
  if (state.calib.placing) { state.calib.placing = false; renderTab(); }
  const order = range(0, HALO_LEDS - 1).sort((a, b) => state.scene.haloRing[a] - state.scene.haloRing[b]);
  let k = 0;
  walkTimer = setInterval(() => {
    if (k >= order.length) { stopWalk(); identify(-1); state.calib.idx = 0; renderTab(); return; }
    state.calib.idx = order[k++]; identify(state.calib.idx);
  }, 380);
}
function tabHalo(body) {
  const c = state.calib, g = GEOM.halo[c.idx];
  body.append(
    el('div', { class: 'banner' }, el('b', {}, 'Why calibrate? '), 'NuPhy doesn\'t publish where each of the 45 halo LEDs sits. The starting layout is inferred from their firmware and may be wrong. Five minutes here makes waves, comets and ripples line up with your real keyboard.'),
    el('div', { class: 'sec' }, el('h3', {}, 'Place each halo LED'),
      el('ol', { class: 'hint', style: 'margin:0;padding-left:18px' },
        el('li', {}, 'Connect the keyboard and switch Composer on (Device tab). The keyboard goes dark except one amber halo LED.'),
        el('li', {}, 'Click where that LED is on the diagram. The next one lights up automatically.'),
        el('li', {}, 'Can\'t see it? Press Skip. Without a keyboard you can still drag LEDs around by hand.')),
      el('div', { class: 'kv' }, el('span', {}, 'LED'), el('span', {}, `${c.idx + 1} of ${HALO_LEDS} (index ${KEY_LEDS + c.idx})`), el('span', {}, 'Guessed spot'), el('span', {}, g.group), el('span', {}, 'Position'), el('span', {}, `${state.scene.haloXY[c.idx * 2]}, ${state.scene.haloXY[c.idx * 2 + 1]}`)),
      el('div', { class: 'row' },
        el('button', { class: 'btn primary' + (c.placing ? ' active' : ''), onclick: () => { stopWalk(); c.placing = !c.placing; identify(c.placing ? c.idx : -1); renderTab(); } }, c.placing ? 'Stop placing' : (c.idx ? 'Resume placing' : 'Start placing')),
        el('button', { class: 'btn', onclick: () => { c.idx = (c.idx + HALO_LEDS - 1) % HALO_LEDS; identify(c.placing ? c.idx : -1); renderTab(); } }, 'Prev'),
        el('button', { class: 'btn', onclick: () => advanceCalib() }, 'Skip / next'))),
    el('div', { class: 'sec' }, el('h3', {}, 'Check the order'),
      el('div', { class: 'row' },
        el('button', { class: 'btn', onclick: walkRing }, 'Walk the ring'),
        el('button', { class: 'btn', onclick: () => { recomputeRing(); toast('Ring order recomputed from positions.'); } }, 'Recompute ring order'),
        el('button', { class: 'btn ghost', onclick: () => { GEOM.halo.forEach((h, i) => { state.scene.haloXY[i * 2] = h.x; state.scene.haloXY[i * 2 + 1] = h.y; state.scene.haloRing[i] = h.ring; }); markGeom(); renderTab(); } }, 'Reset to defaults')),
      el('p', { class: 'hint' }, '"Walk the ring" lights the halo one LED at a time in ring order (on the keyboard and in the preview). Comets and the Ring axis follow this order.')),
  );
}

// Device ---------------------------------------------------------------
function tabDevice(body) {
  const L = state.link, i = state.info, s = state.scene;
  if (!('hid' in navigator)) body.append(el('div', { class: 'banner' }, el('b', {}, 'This browser can\'t reach USB keyboards. '), 'Open Halo Studio in desktop Chrome or Edge to connect. The preview and editor still work here without a keyboard.'));
  body.append(
    el('div', { class: 'sec' }, el('h3', {}, 'Connection'),
      L ? el('div', { class: 'kv' },
        el('span', {}, 'Device'), el('span', {}, i.name || 'NuPhy Halo75 V2'), el('span', {}, 'Protocol'), el('span', {}, `v${i.proto}`),
        el('span', {}, 'LEDs'), el('span', {}, `${i.keys} keys + ${i.halo} halo`), el('span', {}, 'Composer'), el('span', {}, i.active ? 'active' : `off (RGB mode ${i.mode})`),
        el('span', {}, 'Scene size'), el('span', {}, `${i.size} bytes`))
        : el('p', { class: 'hint' }, 'Not connected. Close VIA (and any other tab or app using the keyboard), plug in the USB cable, set the switch to wired, then press Connect keyboard.'),
      L ? el('div', { class: 'row' },
        el('button', { class: 'btn primary', onclick: () => setActive(!i.active).catch(fail('Switching Composer')) }, i.active ? 'Switch back to previous effect' : 'Turn Composer on'),
        el('button', { class: 'btn', onclick: () => readScene('read').then(renderTab).catch(fail('Reading the keyboard')) }, 'Read from keyboard'),
        el('button', { class: 'btn', onclick: () => { markAll(); flush().then(() => toast('Editor pushed to the keyboard (RAM). Save to keep it.')).catch(fail('Pushing')); } }, 'Push editor to keyboard'),
        el('button', { class: 'btn ghost', onclick: () => factoryScene().catch(fail('Loading the factory scene')) }, 'Factory scene')) : null),
    el('div', { class: 'sec' }, el('h3', {}, 'Scene options'),
      check('Perceptual brightness (gamma 2.2)', !!(s.flags & SF.GAMMA), (on) => { s.flags = on ? s.flags | SF.GAMMA : s.flags & ~SF.GAMMA; markFlags(); }, 'Makes low brightness steps look even; dims mid tones'),
      check('Halo follows key brightness (Fn+↑/↓) instead of Fn+M+↑/↓', !!(s.flags & SF.HALO_FOLLOWS_KEYS), (on) => { s.flags = on ? s.flags | SF.HALO_FOLLOWS_KEYS : s.flags & ~SF.HALO_FOLLOWS_KEYS; markFlags(); })),
    L ? el('div', { class: 'sec' }, el('h3', {}, 'Diagnostics'), el('div', { class: 'row' }, el('button', { class: 'btn small', onclick: stats }, 'Measure keyboard frame rate'), el('span', { id: 'statOut', class: 'mono muted' }))) : null,
    el('div', { class: 'sec' }, el('h3', {}, 'HID log'), el('div', { class: 'log', id: 'hidlog' }, logLines.join('\n') || '—')),
  );
}
const fail = (what) => (e) => { log(`${what} failed: ${e.message}`); toast(`${what} failed: ${e.message}`); };
async function stats() {
  const out = (msg) => { const o = $('#statOut'); if (o) o.textContent = msg; };
  try {
    out('measuring for 2 s…');
    const a = await state.link.cmd(SUB.STATS); const f0 = a[3] | a[4] << 8 | a[5] << 16 | a[6] << 24; const t = performance.now();
    await sleep(2000);
    if (!state.link) return;
    const b = await state.link.cmd(SUB.STATS); const f1 = b[3] | b[4] << 8 | b[5] << 16 | b[6] << 24;
    const fps = ((f1 - f0) >>> 0) / ((performance.now() - t) / 1000);
    out(`${fps.toFixed(1)} fps${state.info?.active ? '' : ' (Composer is off: 0 is expected)'} · key master ${b[7]} · halo master ${b[8]} (level ${b[9]})`);
    log(`frame rate ${fps.toFixed(1)} fps`);
  } catch (e) { out(''); fail('Measuring')(e); }
}

// ------------------------------------------------------------------ wiring
function syncViewSeg() { for (const b of document.querySelectorAll('#viewSeg button')) b.classList.toggle('on', b.dataset.view === state.view); }
function init() {
  restoreLocal();
  const qs = $('#quickSel');
  for (const name of Object.keys(GROUPS)) qs.append(el('button', { class: 'btn small', onclick: (e) => setSel(GROUPS[name], e.shiftKey ? 'add' : e.altKey ? 'remove' : 'replace') }, name));
  qs.append(el('button', { class: 'btn small', onclick: () => setSel(range(0, 127).filter((l) => !state.sel.has(l))) }, 'Invert'), el('button', { class: 'btn small', onclick: () => setSel([]) }, 'None'));
  for (const b of document.querySelectorAll('#toolSeg button')) b.addEventListener('click', () => setTool(b.dataset.tool));
  for (const b of document.querySelectorAll('#viewSeg button')) b.addEventListener('click', () => { state.view = b.dataset.view; syncViewSeg(); });
  for (const b of document.querySelectorAll('#tabs button')) b.addEventListener('click', () => { state.tab = b.dataset.tab; if (state.tab !== 'halo' && state.calib.placing) { state.calib.placing = false; identify(-1); } renderTab(); });
  $('#pvPlay').addEventListener('change', (e) => { state.preview.play = e.target.checked; });
  $('#pvTyping').addEventListener('change', (e) => { state.preview.typing = e.target.checked; });
  $('#pvKeys').addEventListener('input', (e) => { state.preview.keys = +e.target.value; });
  $('#pvHalo').addEventListener('input', (e) => { state.preview.halo = +e.target.value; });
  $('#btnConnect').addEventListener('click', async () => {
    if (!state.link) { connect(); return; }
    stopWalk();
    if (state.calib.placing) { state.calib.placing = false; await state.link.cmd(SUB.IDENTIFY, [0xFF, 0, 0, 0, 0, 0]).catch(() => {}); }
    await settleSync();
    dropLink('disconnected');
  });
  // Leaving the page mid-calibration would leave the keyboard dark for up to a minute.
  window.addEventListener('pagehide', () => { if (state.link && state.calib.placing) state.link.cmd(SUB.IDENTIFY, [0xFF, 0, 0, 0, 0, 0]).catch(() => {}); });
  $('#btnSave').addEventListener('click', () => saveToKeyboard().catch((e) => toast('Save failed: ' + e.message)));
  $('#btnRevert').addEventListener('click', () => revertFromKeyboard().catch((e) => toast('Revert failed: ' + e.message)));
  $('#livePush').addEventListener('change', (e) => { if (e.target.checked) scheduleSync(); });
  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input,select,textarea')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); setSel(range(0, 127)); }
    else if (e.key === 'Escape') setSel([]);
    else if (state.tool === 'type' && e.key.length === 1) { const i = LABEL.findIndex((l) => l.toLowerCase() === e.key.toLowerCase()); if (i >= 0) simKey(i); }
  });
  window.addEventListener('resize', layout);
  layout(); renderTab(); updateConn(); updateSelInfo(); requestAnimationFrame(tick);
  window.HaloStudio = { state, engine, markAll, flush, importProfile, exportProfile, SCENES };
}
init();
})();

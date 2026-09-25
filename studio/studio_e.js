
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
// Next/previous halo LED that is actually fitted (0-based halo number).
const fittedHalo = (i, step) => { do { i += step; } while (i >= 0 && i < HALO_LEDS && ABSENT.has(KEY_LEDS + i)); return i; };
function advanceCalib() {
  const c = state.calib;
  if (!c.placing) { c.idx = fittedHalo(c.idx, 1); if (c.idx >= HALO_LEDS) c.idx = fittedHalo(-1, 1); renderTab(); return; }
  c.idx = fittedHalo(c.idx, 1);
  if (c.idx >= HALO_LEDS) { c.idx = HALO_LEDS - 1; c.placing = false; identify(-1); recomputeRing(); toast('Calibration done. Ring order recomputed from your positions. Press Save to keep it on the keyboard.'); }
  else identify(c.idx);
  renderTab();
}
function stopWalk() { if (walkTimer) { clearInterval(walkTimer); walkTimer = null; } }
function recomputeRing() {
  // Same maths as ring_from_xy() in tools/gen_geometry.py. Unfitted LEDs don't stretch the outline.
  const s = state.scene, xs = [], ys = [];
  for (let i = 0; i < HALO_LEDS; i++) { xs.push(s.haloXY[i * 2]); ys.push(s.haloXY[i * 2 + 1]); }
  const live = range(0, HALO_LEDS - 1).filter((i) => !ABSENT.has(KEY_LEDS + i)), lx = live.map((i) => xs[i]), ly = live.map((i) => ys[i]);
  const x0 = Math.min(...lx), x1 = Math.max(...lx), y0 = Math.min(...ly), y1 = Math.max(...ly);
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
  const order = range(0, HALO_LEDS - 1).filter((i) => !ABSENT.has(KEY_LEDS + i)).sort((a, b) => state.scene.haloRing[a] - state.scene.haloRing[b]);
  let k = 0;
  walkTimer = setInterval(() => {
    if (k >= order.length) { stopWalk(); identify(-1); state.calib.idx = 0; renderTab(); return; }
    state.calib.idx = order[k++]; identify(state.calib.idx);
  }, 380);
}
function useBuiltInLayout() { GEOM.halo.forEach((h, i) => { state.scene.haloXY[i * 2] = h.x; state.scene.haloXY[i * 2 + 1] = h.y; state.scene.haloRing[i] = h.ring; }); markGeom(); renderTab(); toast('Built-in halo layout applied. Save to keep it on the keyboard.'); }
function tabHalo(body) {
  const c = state.calib, g = GEOM.halo[c.idx];
  // A browser keeps the last editor scene, so an old calibration can outlive a firmware update. Say so.
  const moved = GEOM.halo.filter((h, i) => !h.absent && (state.scene.haloXY[i * 2] !== h.x || state.scene.haloXY[i * 2 + 1] !== h.y)).length;
  body.append(
    moved ? el('div', { class: 'banner' }, el('b', {}, 'Custom layout. '), `${moved} halo LED${moved === 1 ? ' sits' : 's sit'} somewhere other than the built-in layout. That's expected if you calibrated your own keyboard. If you didn't, or this came from an older version, switch back: `,
      el('button', { class: 'btn small', 'data-tip': TIP.builtIn, onclick: useBuiltInLayout }, 'Use built-in layout'))
      : el('p', { class: 'hint' }, 'Using the built-in halo layout.'),
    el('div', { class: 'banner' }, el('b', {}, 'Why calibrate? '), 'NuPhy doesn\'t publish where the halo LEDs sit. The built-in layout was measured on one Halo75 V2 and should fit yours; recalibrate if waves, comets or ripples don\'t line up. LEDs 9, 10 and 45 have no LED fitted, so they are hidden and skipped.'),
    el('div', { class: 'sec' }, h3('Place each halo LED', TIP.placeLeds),
      el('ol', { class: 'hint', style: 'margin:0;padding-left:18px' },
        el('li', {}, 'Connect the keyboard (button at the top right). Composer has to be the running effect: it is unless you changed effects with Fn+←. If not, press Fn+Enter on the keyboard.'),
        el('li', {}, 'Press Start placing. The keyboard goes dark except one amber halo LED. Click where that LED is on the drawing; the next one lights up automatically.'),
        el('li', {}, 'Can\'t see it? Press Skip. Without a keyboard you can still drag LEDs around by hand.')),
      el('div', { class: 'kv' }, el('span', { 'data-tip': TIP.ledNum }, 'LED'), el('span', {}, `${c.idx + 1} of ${HALO_LEDS} (index ${KEY_LEDS + c.idx})`), el('span', { 'data-tip': TIP.area }, 'Area'), el('span', {}, AREA_NAMES[g.group] || g.group), el('span', { 'data-tip': TIP.position }, 'Position'), el('span', {}, `${state.scene.haloXY[c.idx * 2]}, ${state.scene.haloXY[c.idx * 2 + 1]}`)),
      el('div', { class: 'row' },
        el('button', { class: 'btn primary' + (c.placing ? ' active' : ''), 'data-tip': TIP.startPlacing, onclick: () => { stopWalk(); if (ABSENT.has(KEY_LEDS + c.idx)) c.idx = fittedHalo(c.idx, 1) % HALO_LEDS; c.placing = !c.placing; identify(c.placing ? c.idx : -1); renderTab(); } }, c.placing ? 'Stop placing' : (c.idx ? 'Resume placing' : 'Start placing')),
        el('button', { class: 'btn', 'data-tip': TIP.prevLed, onclick: () => { c.idx = fittedHalo(c.idx, -1); if (c.idx < 0) c.idx = fittedHalo(HALO_LEDS, -1); identify(c.placing ? c.idx : -1); renderTab(); } }, 'Prev'),
        el('button', { class: 'btn', 'data-tip': TIP.skipLed, onclick: () => advanceCalib() }, 'Skip / next'))),
    el('div', { class: 'sec' }, h3('Check the order', TIP.checkOrder),
      el('div', { class: 'row' },
        el('button', { class: 'btn', 'data-tip': TIP.walkRing, onclick: walkRing }, 'Walk the ring'),
        el('button', { class: 'btn', 'data-tip': TIP.recompute, onclick: () => { recomputeRing(); toast('Ring order recomputed from positions.'); } }, 'Recompute ring order'),
        el('button', { class: 'btn ghost', 'data-tip': TIP.builtIn, onclick: useBuiltInLayout }, 'Use built-in layout')),
      el('p', { class: 'hint' }, '"Walk the ring" lights the halo one LED at a time in ring order (on the keyboard and in the preview). Comets and the Ring axis follow this order.')),
  );
}

// Device ---------------------------------------------------------------
function tabDevice(body) {
  const L = state.link, i = state.info, s = state.scene;
  if (!('hid' in navigator)) body.append(el('div', { class: 'banner' }, el('b', {}, 'This browser can\'t reach USB keyboards. '), 'Open Halo Studio in desktop Chrome or Edge to connect. The preview and editor still work here without a keyboard.'));
  body.append(
    el('div', { class: 'sec' }, h3('Connection', TIP.connection),
      L ? el('div', { class: 'kv' },
        el('span', {}, 'Device'), el('span', {}, i.name || 'NuPhy Halo75 V2'), el('span', {}, 'Protocol'), el('span', {}, `v${i.proto}`),
        el('span', {}, 'LEDs'), el('span', {}, `${i.keys} keys + ${i.halo} halo`), el('span', {}, 'Composer'), el('span', {}, i.active ? 'active' : `off (RGB mode ${i.mode})`),
        el('span', {}, 'Scene size'), el('span', {}, `${i.size} bytes`))
        : el('p', { class: 'hint' }, 'Not connected. Close VIA (and any other tab or app using the keyboard), plug in the USB cable, set the switch to wired, then press Connect keyboard.'),
      L ? el('div', { class: 'row' },
        el('button', { class: 'btn primary', 'data-tip': TIP.composerOnOff, onclick: () => setActive(!i.active).catch(fail('Switching Composer')) }, i.active ? 'Switch back to previous effect' : 'Turn Composer on'),
        el('button', { class: 'btn', 'data-tip': TIP.readKb, onclick: () => readScene('read').then(renderTab).catch(fail('Reading the keyboard')) }, 'Read from keyboard'),
        el('button', { class: 'btn', 'data-tip': TIP.pushKb, onclick: () => { markAll(); flush().then(() => toast('Editor pushed to the keyboard (RAM). Save to keep it.')).catch(fail('Pushing')); } }, 'Push editor to keyboard'),
        el('button', { class: 'btn ghost', 'data-tip': TIP.factory, onclick: () => factoryScene().catch(fail('Loading the factory scene')) }, 'Factory scene')) : null),
    el('div', { class: 'sec' }, h3('Scene options', TIP.sceneOpts),
      check('Match screen colors (perceptual brightness)', !!(s.flags & SF.GAMMA), (on) => { s.flags = on ? s.flags | SF.GAMMA : s.flags & ~SF.GAMMA; markFlags(); }, TIP.gamma, 'gamma'),
      check('Halo follows key brightness (Fn+↑/↓) instead of Fn+M+↑/↓', !!(s.flags & SF.HALO_FOLLOWS_KEYS), (on) => { s.flags = on ? s.flags | SF.HALO_FOLLOWS_KEYS : s.flags & ~SF.HALO_FOLLOWS_KEYS; markFlags(); }, TIP.haloFollows, 'haloFollows')),
    L ? el('div', { class: 'sec' }, h3('Diagnostics'), el('div', { class: 'row' }, el('button', { class: 'btn small', 'data-tip': TIP.fps, onclick: stats }, 'Measure keyboard frame rate'), el('span', { id: 'statOut', class: 'mono muted' }))) : null,
    el('div', { class: 'sec' }, h3('HID log', TIP.hidLog), el('div', { class: 'log', id: 'hidlog' }, logLines.join('\n') || '—')),
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

// ---------------------------------------------------------------- tooltips
// Anything with data-tip="..." explains itself: on hover after a short pause, or at once
// on keyboard focus (a control inside a .field shows its label's help). One shared bubble
// lives on <body> with position:fixed, so the scrolling side panel can't clip it.
const tipBox = $('#tip');
let tipFor = null, tipTimer = 0, tipHiddenAt = 0, tipDescribed = null;
function showTip(t, focused) {
  clearTimeout(tipTimer);
  if (!t.isConnected || !t.dataset.tip) return;
  tipFor = t; tipBox.textContent = t.dataset.tip;
  tipBox.style.left = '0px'; tipBox.style.top = '0px'; tipBox.hidden = false;
  const r = t.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = window.innerHeight;
  const w = tipBox.offsetWidth, h = tipBox.offsetHeight;
  let y = r.bottom + 8;
  if (y + h > vh - 8 && r.top - h - 8 >= 8) y = r.top - h - 8; // no room below: show it above
  tipBox.style.left = clamp(r.left, 8, Math.max(8, vw - w - 8)) + 'px'; tipBox.style.top = y + 'px';
  if (focused) { tipDescribed = focused; focused.setAttribute('aria-describedby', 'tip'); }
}
function hideTip() {
  clearTimeout(tipTimer);
  if (!tipBox.hidden) tipHiddenAt = performance.now();
  tipBox.hidden = true; tipFor = null;
  if (tipDescribed) { tipDescribed.removeAttribute('aria-describedby'); tipDescribed = null; }
}
function initTips() {
  // Help for the static page (header and stage) lives in TIP too: data-tipkey names the entry.
  for (const e of document.querySelectorAll('[data-tipkey]')) e.dataset.tip = TIP[e.dataset.tipkey];
  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest?.('[data-tip]');
    if (t === tipFor) return;
    hideTip();
    if (!t) return;
    // Right after one tip closes, the next one opens almost at once.
    tipTimer = setTimeout(() => showTip(t), performance.now() - tipHiddenAt < 500 ? 80 : 450);
  });
  document.documentElement.addEventListener('mouseleave', hideTip);
  document.addEventListener('focusin', (e) => {
    const f = e.target, t = f.closest?.('[data-tip]') || f.closest?.('.field')?.querySelector('label[data-tip]');
    if (t && f.matches(':focus-visible')) showTip(t, f);
  });
  document.addEventListener('focusout', () => { if (tipDescribed) hideTip(); });
  document.addEventListener('pointerdown', hideTip, true);
  window.addEventListener('scroll', hideTip, true);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip(); });
}

// ------------------------------------------------------------------ wiring
function syncViewSeg() { for (const b of document.querySelectorAll('#viewSeg button')) b.classList.toggle('on', b.dataset.view === state.view); }
function init() {
  restoreLocal();
  initTips();
  const qs = $('#quickSel');
  for (const name of Object.keys(GROUPS)) qs.append(el('button', { class: 'btn small', 'data-tip': GROUP_TIPS[name], onclick: (e) => setSel(GROUPS[name], e.shiftKey ? 'add' : e.altKey ? 'remove' : 'replace') }, name));
  qs.append(el('button', { class: 'btn small', 'data-tip': 'Selects everything that isn\'t selected, and deselects what is.', onclick: () => setSel(GROUPS['All'].filter((l) => !state.sel.has(l))) }, 'Invert'),
    el('button', { class: 'btn small', 'data-tip': 'Clears the selection (Esc does the same).', onclick: () => setSel([]) }, 'None'));
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
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); setSel(GROUPS['All']); }
    else if (e.key === 'Escape') setSel([]);
    else if (state.tool === 'type' && e.key.length === 1) { const i = LABEL.findIndex((l) => l.toLowerCase() === e.key.toLowerCase()); if (i >= 0) simKey(i); }
  });
  window.addEventListener('resize', () => { hideTip(); layout(); });
  layout(); renderTab(); updateConn(); updateSelInfo(); requestAnimationFrame(tick);
  window.HaloStudio = { state, engine, markAll, flush, importProfile, exportProfile, SCENES };
}
init();
})();

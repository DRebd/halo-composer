
// ----------------------------------------------------------------- canvas
const cv = $('#kb'), ctx = cv.getContext('2d');
const ZONE_TINTS = ['#ffab3d', '#45d3c4', '#ff6bb5', '#8f8bff', '#9be15d', '#ffd84a', '#5ab1ff', '#ff7a59'];
let U = 60, OX = 60, OY = 60;
function layout() {
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth || 1000;
  U = w / 19.0; OX = 1.5 * U; OY = 1.65 * U;
  const h = Math.round(U * 8.3);
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
// engine coordinates -> canvas
const haloPos = (i) => { const s = state.scene; const x = s.haloXY[i * 2], y = s.haloXY[i * 2 + 1]; return [OX + ((x - 16) / 12) * U, OY + ((y - 12) / 8) * U]; };
const toEngine = (cx, cy) => [clamp(Math.round(16 + ((cx - OX) / U) * 12), 0, 255), clamp(Math.round(12 + ((cy - OY) / U) * 8), 0, 255)];
function keyRect(k) { const p = U * 0.06; return [OX + k.x * U + p, OY + k.y * U + p, k.w * U - 2 * p, U - 2 * p]; }
function ledCenter(led) { if (led < KEY_LEDS) { const r = keyRect(KEYS[led]); return [r[0] + r[2] / 2, r[1] + r[3] / 2]; } return haloPos(led - KEY_LEDS); }
function hitTest(x, y) {
  for (let i = 0; i < HALO_LEDS; i++) { const [hx, hy] = haloPos(i); if ((x - hx) ** 2 + (y - hy) ** 2 < (U * 0.32) ** 2) return KEY_LEDS + i; }
  for (const k of KEYS) { const r = keyRect(k); if (x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]) return k.led; }
  return -1;
}
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function ledColor(led) {
  if (state.view === 'base') { const s = state.scene; const z = s.zones[s.zoneOf[led] & 7]; const c = [s.color[led * 3], s.color[led * 3 + 1], s.color[led * 3 + 2]]; return z.source === SRC.ZONE ? z.color : c; }
  return [frame[led * 3], frame[led * 3 + 1], frame[led * 3 + 2]];
}
let marquee = null;
function draw() {
  const W = cv.clientWidth, H = parseFloat(cv.style.height);
  ctx.clearRect(0, 0, W, H);
  // case
  const cx0 = OX - 1.35 * U, cy0 = OY - 1.5 * U, cw = 18.7 * U, ch = 8.05 * U;
  const g = ctx.createLinearGradient(0, cy0, 0, cy0 + ch); g.addColorStop(0, '#23262e'); g.addColorStop(1, '#16181d');
  roundRect(cx0, cy0, cw, ch, U * 0.45); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#30343d'; ctx.lineWidth = 1.5; ctx.stroke();
  roundRect(OX - 0.12 * U, OY - 0.12 * U, 16.24 * U, 6.24 * U, U * 0.18); ctx.fillStyle = '#0c0d10'; ctx.fill();
  // halo LEDs (glow)
  for (let i = 0; i < HALO_LEDS; i++) {
    const led = KEY_LEDS + i, [x, y] = haloPos(i), c = ledColor(led), lum = Math.max(c[0], c[1], c[2]);
    const grp = GEOM.halo[i].group, small = grp === 'status' || grp === 'badge';
    if (lum > 4) { const rg = ctx.createRadialGradient(x, y, 0, x, y, U * (small ? 0.45 : 0.75)); rg.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${0.55 * lum / 255})`); rg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = rg; ctx.fillRect(x - U, y - U, 2 * U, 2 * U); }
    ctx.beginPath(); ctx.arc(x, y, U * (small ? 0.12 : 0.16), 0, Math.PI * 2);
    ctx.fillStyle = lum > 4 ? `rgb(${c[0]},${c[1]},${c[2]})` : '#2a2d34'; ctx.fill();
    if (state.sel.has(led)) { ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); }
    if (state.view === 'zones') drawZoneTag(led, x + U * 0.2, y - U * 0.2, 0.28);
    if (state.tab === 'halo' && state.calib.idx === i) { ctx.beginPath(); ctx.arc(x, y, U * 0.34, 0, Math.PI * 2); ctx.strokeStyle = '#ffab3d'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]); }
  }
  // keys
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const k of KEYS) {
    const [x, y, w, h] = keyRect(k), c = ledColor(k.led), lum = Math.max(c[0], c[1], c[2]);
    roundRect(x, y, w, h, U * 0.12); ctx.fillStyle = '#17191e'; ctx.fill();
    if (lum > 2) {
      const gr = ctx.createRadialGradient(x + w / 2, y + h * 0.35, 0, x + w / 2, y + h * 0.35, Math.max(w, h) * 0.75);
      gr.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${0.95 * Math.min(1, lum / 200)})`); gr.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},${0.18 * lum / 255})`);
      roundRect(x, y, w, h, U * 0.12); ctx.fillStyle = gr; ctx.fill();
    }
    roundRect(x + 0.5, y + 0.5, w - 1, h - 1, U * 0.12); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.stroke();
    const light = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) > 150;
    ctx.fillStyle = light ? 'rgba(20,18,14,.85)' : 'rgba(235,231,223,.78)';
    ctx.font = `500 ${Math.max(9, U * (k.label.length > 3 ? 0.2 : 0.26))}px "IBM Plex Sans", system-ui, sans-serif`;
    ctx.fillText(k.label, x + w / 2, y + h / 2);
    if (state.sel.has(k.led)) { roundRect(x - 1, y - 1, w + 2, h + 2, U * 0.14); ctx.lineWidth = 2.2; ctx.strokeStyle = '#fff'; ctx.stroke(); }
    if (state.view === 'zones') drawZoneTag(k.led, x + w - U * 0.16, y + U * 0.16, 0.24);
  }
  if (marquee) { ctx.fillStyle = 'rgba(255,171,61,.12)'; ctx.strokeStyle = '#ffab3d'; ctx.lineWidth = 1; ctx.fillRect(marquee.x, marquee.y, marquee.w, marquee.h); ctx.strokeRect(marquee.x, marquee.y, marquee.w, marquee.h); }
}
function drawZoneTag(led, x, y, r) {
  const z = state.scene.zoneOf[led] & 7;
  ctx.beginPath(); ctx.arc(x, y, U * r * 0.55, 0, Math.PI * 2); ctx.fillStyle = ZONE_TINTS[z]; ctx.fill();
  ctx.fillStyle = '#111'; ctx.font = `700 ${U * r * 0.7}px "IBM Plex Mono", monospace`; ctx.fillText(String(z + 1), x, y + 0.5);
}

// -------------------------------------------------------------- selection
function setSel(leds, mode = 'replace') {
  if (mode === 'replace') state.sel = new Set(leds);
  else if (mode === 'add') leds.forEach((l) => state.sel.add(l));
  else if (mode === 'remove') leds.forEach((l) => state.sel.delete(l));
  else if (mode === 'toggle') leds.forEach((l) => (state.sel.has(l) ? state.sel.delete(l) : state.sel.add(l)));
  updateSelInfo();
}
function updateSelInfo() {
  const n = state.sel.size, info = $('#selInfo');
  if (!n) { info.textContent = 'Nothing selected. Click an LED, drag a box, or use a quick-select button. Shift adds, Alt removes.'; return; }
  const keys = [...state.sel].filter((l) => l < KEY_LEDS).length, halo = n - keys;
  const zones = [...new Set([...state.sel].map((l) => (state.scene.zoneOf[l] & 7) + 1))].sort();
  info.textContent = `${n} selected (${keys} key${keys === 1 ? '' : 's'}, ${halo} halo) · zone${zones.length > 1 ? 's' : ''} ${zones.join(', ')}`;
}
function paintLeds(leds, rgb) { for (const l of leds) { state.scene.color[l * 3] = rgb[0]; state.scene.color[l * 3 + 1] = rgb[1]; state.scene.color[l * 3 + 2] = rgb[2]; } markColors(leds); }

let drag = null;
function ptr(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
cv.addEventListener('pointerdown', (e) => {
  const [x, y] = ptr(e); const hit = hitTest(x, y);
  cv.setPointerCapture(e.pointerId);
  if (state.tab === 'halo' && state.calib.placing) { placeHalo(x, y); drag = { kind: 'place' }; return; }
  if (state.tool === 'type') { if (hit >= 0) simKey(hit); return; }
  if (state.tool === 'pick') { if (hit >= 0) { const s = state.scene; state.color = [s.color[hit * 3], s.color[hit * 3 + 1], s.color[hit * 3 + 2]]; setTool('paint'); renderTab(); } return; }
  if (state.tool === 'paint') { if (hit >= 0) paintLeds([hit], state.color); drag = { kind: 'paint' }; return; }
  const mode = e.shiftKey ? 'add' : e.altKey ? 'remove' : (e.metaKey || e.ctrlKey) ? 'toggle' : 'replace';
  if (hit >= 0) { setSel([hit], mode); drag = { kind: 'sel', mode }; }
  else drag = { kind: 'box', x0: x, y0: y, mode: mode === 'replace' ? 'replace' : mode };
});
cv.addEventListener('pointermove', (e) => {
  if (!drag) return; const [x, y] = ptr(e);
  if (drag.kind === 'paint') { const h = hitTest(x, y); if (h >= 0) paintLeds([h], state.color); }
  else if (drag.kind === 'place') placeHalo(x, y);
  else if (drag.kind === 'box') marquee = { x: Math.min(drag.x0, x), y: Math.min(drag.y0, y), w: Math.abs(x - drag.x0), h: Math.abs(y - drag.y0) };
  else if (drag.kind === 'sel') { const h = hitTest(x, y); if (h >= 0) setSel([h], drag.mode === 'remove' ? 'remove' : 'add'); }
});
cv.addEventListener('pointerup', () => {
  if (drag?.kind === 'box' && marquee) {
    const inside = []; for (let l = 0; l < LED_COUNT; l++) { const [x, y] = ledCenter(l); if (x >= marquee.x && x <= marquee.x + marquee.w && y >= marquee.y && y <= marquee.y + marquee.h) inside.push(l); }
    setSel(inside, drag.mode);
  } else if (drag?.kind === 'box') setSel([], drag.mode === 'replace' ? 'replace' : 'add');
  if (drag?.kind === 'place') advanceCalib();
  marquee = null; drag = null;
});
function simKey(led) {
  engine.keyHit(state.scene, led, nowMs());
  if (state.link && state.info?.active) state.link.cmd(SUB.SIM_KEY, [led]).catch(() => {});
}
function setTool(t) { state.tool = t; for (const b of document.querySelectorAll('#toolSeg button')) b.classList.toggle('on', b.dataset.tool === t); cv.style.cursor = t === 'paint' ? 'crosshair' : t === 'pick' ? 'copy' : t === 'type' ? 'pointer' : 'default'; }

// ------------------------------------------------------------ render loop
let lastT = 0, fpsCount = 0, fpsT = 0, fps = 0, typingT = 0;
function tick() {
  const t = nowMs();
  if (state.preview.play || t - lastT > 1000) {
    if (state.preview.typing && t - typingT > 110 + Math.random() * 180) { typingT = t; const pool = GROUPS['Letters'].concat([77, 77, 77]); engine.keyHit(state.scene, pool[Math.floor(Math.random() * pool.length)], t); }
    engine.renderFrame(state.scene, state.preview.play ? t : lastT, { keys: state.preview.keys, halo: HALO_LEVELS[state.preview.halo] }, frame);
    if (state.preview.play) lastT = t;
  }
  draw();
  fpsCount++; if (t - fpsT > 1000) { fps = fpsCount; fpsCount = 0; fpsT = t; $('#stats').textContent = `preview ${fps} fps${state.link ? ' · live on keyboard' : ''}`; }
  if (state.tab === 'effects') drawFxPreviews(t);
  requestAnimationFrame(tick);
}

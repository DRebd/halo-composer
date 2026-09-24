
// ------------------------------------------------------------------- tabs
function field(label, input, outText) { return el('div', { class: 'field' }, el('label', {}, label), input, el('output', {}, outText ?? '')); }
function slider(label, value, min, max, onInput, fmt = (v) => v) {
  const out = el('output', {}, fmt(value));
  const inp = el('input', { type: 'range', min, max, value, 'aria-label': label });
  inp.addEventListener('input', () => { out.textContent = fmt(+inp.value); onInput(+inp.value); });
  return el('div', { class: 'field' }, el('label', {}, label), inp, out);
}
function select(label, options, value, onChange) {
  const s = el('select', { 'aria-label': label }, options.map((o, i) => el('option', { value: i, selected: i === value }, o)));
  s.addEventListener('change', () => onChange(+s.value));
  return el('div', { class: 'field' }, el('label', {}, label), s, el('span'));
}
function check(label, on, onChange, title) {
  const i = el('input', { type: 'checkbox', checked: on }); i.addEventListener('change', () => onChange(i.checked));
  return el('label', { class: 'check', title: title || '' }, i, label);
}
function colorInput(rgb, onChange) {
  const c = el('input', { type: 'color', value: rgbHex(rgb) }); c.addEventListener('input', () => onChange(hexRgb(c.value)));
  return c;
}
const pct = (v) => Math.round((v / 255) * 100) + '%';

function renderTab() {
  const root = $('#tabbody'); root.replaceChildren();
  const body = { append: (...kids) => root.append(...kids.flat().filter((k) => k != null && k !== false)) };
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === state.tab);
  ({ paint: tabPaint, zones: tabZones, gradients: tabGradients, effects: tabEffects, scenes: tabScenes, halo: tabHalo, device: tabDevice })[state.tab](body);
}

// Paint -----------------------------------------------------------------
function tabPaint(body) {
  const cur = el('div', { class: 'row' });
  const hsv = HC.util.rgb2hsv(state.color, [0, 0, 0]);
  const hexIn = el('input', { type: 'text', value: rgbHex(state.color), style: 'width:92px', 'aria-label': 'Hex color' });
  const setColor = (rgb, rerender = true) => { state.color = rgb; if (rerender) renderTab(); };
  hexIn.addEventListener('change', () => { const c = hexRgb(hexIn.value); if (c) setColor(c); });
  cur.append(el('span', { class: 'sw', style: `width:46px;background:${rgbHex(state.color)}` }), colorInput(state.color, (c) => setColor(c)), hexIn,
    el('span', { class: 'mono muted' }, `rgb ${state.color.join(' ')}`));
  const hsvRows = [
    slider('Hue', hsv[0], 0, 255, (v) => { hsv[0] = v; setColor(HC.util.hsv2rgb(hsv[0], hsv[1], hsv[2], [0, 0, 0]), false); refreshCur(); }),
    slider('Saturation', hsv[1], 0, 255, (v) => { hsv[1] = v; setColor(HC.util.hsv2rgb(hsv[0], hsv[1], hsv[2], [0, 0, 0]), false); refreshCur(); }, pct),
    slider('Brightness', hsv[2], 0, 255, (v) => { hsv[2] = v; setColor(HC.util.hsv2rgb(hsv[0], hsv[1], hsv[2], [0, 0, 0]), false); refreshCur(); }, pct),
  ];
  function refreshCur() { cur.children[0].style.background = rgbHex(state.color); hexIn.value = rgbHex(state.color); cur.children[1].value = rgbHex(state.color); cur.children[3].textContent = `rgb ${state.color.join(' ')}`; }
  const sel = [...state.sel];
  body.append(
    el('div', { class: 'sec' }, el('h3', {}, 'Color'), cur, ...hsvRows),
    ...COLOR_PRESETS.map(([grp, list]) => el('div', { class: 'sec' }, el('h3', {}, grp), el('div', { class: 'swatches' },
      list.map(([n, rgb]) => el('button', { class: 'sw', title: n, 'aria-label': n, style: `background:${rgbHex(rgb)}`, onclick: () => setColor(rgb.slice()) }))))),
    el('div', { class: 'sec' }, el('h3', {}, 'Apply to selection'),
      el('div', { class: 'row' },
        el('button', { class: 'btn primary', disabled: !sel.length, onclick: () => { paintLeds(sel, state.color); toast(`Painted ${sel.length} LED(s).`); } }, 'Fill selection'),
        el('button', { class: 'btn', disabled: !sel.length, onclick: () => adjustSel(0.85) }, 'Darker'),
        el('button', { class: 'btn', disabled: !sel.length, onclick: () => adjustSel(1.15) }, 'Lighter'),
        el('button', { class: 'btn', onclick: () => setTool('paint') }, 'Paint brush'),
        el('button', { class: 'btn', onclick: () => setTool('pick') }, 'Eyedropper')),
      el('p', { class: 'hint' }, 'Painted colors show wherever a zone uses "Painted colors" as its source. Effects then animate on top of them.')),
    el('div', { class: 'sec' }, el('h3', {}, 'Bake a gradient into the selection'),
      bakeControls(sel)),
    el('div', { class: 'sec' }, el('h3', {}, 'Selection flags'),
      el('div', { class: 'row' },
        el('button', { class: 'btn small', disabled: !sel.length, onclick: () => { for (const l of sel) state.scene.zoneOf[l] |= LF.NO_REACT; markZmap(sel); toast('Selection now ignores keypress overlays.'); } }, 'Ignore keypress overlays'),
        el('button', { class: 'btn small', disabled: !sel.length, onclick: () => { for (const l of sel) state.scene.zoneOf[l] &= ~LF.NO_REACT; markZmap(sel); toast('Selection reacts to keypresses again.'); } }, 'React to keypresses'))),
  );
}
function adjustSel(f) { const s = state.scene; const sel = [...state.sel]; for (const l of sel) for (let k = 0; k < 3; k++) s.color[l * 3 + k] = clamp(Math.round(s.color[l * 3 + k] * f), 0, 255); markColors(sel); }
function bakeControls(sel) {
  let slot = state.grad, axis = AXIS.X;
  const bar = el('div', { class: 'gbar', style: `background:${gradCss(state.scene.grad[slot])}` });
  return el('div', { class: 'sec' },
    select('Gradient', state.scene.grad.map((g, i) => `Slot ${i + 1}`), slot, (v) => { slot = v; bar.style.background = gradCss(state.scene.grad[v]); }),
    bar,
    select('Direction', AXIS_NAMES.slice(0, 7), axis, (v) => { axis = v; }),
    el('div', { class: 'row' }, el('button', { class: 'btn', disabled: !sel.length, onclick: () => {
      const vals = sel.map((l) => engine.axisValue(state.scene, l, axis));
      const lo = Math.min(...vals), hi = Math.max(...vals), out = [0, 0, 0];
      sel.forEach((l, i) => { const p = hi > lo ? Math.round(((vals[i] - lo) * 255) / (hi - lo)) : 0; HC.util.gradSample(state.scene.grad[slot], p, out); paintLeds([l], out); });
      toast('Gradient painted across the selection.');
    } }, 'Paint gradient across selection')),
    el('p', { class: 'hint' }, 'This writes fixed per-LED colors. For a moving or zone-wide gradient, set a zone\'s source to Gradient instead.'));
}

// Zones -----------------------------------------------------------------
function zoneSummary(z) { return `${FX_META[z.effect]?.name || '?'} · ${['map', 'color', 'grad', 'rainbow'][z.source]}`; }
function tabZones(body) {
  const s = state.scene, zi = state.zone, z = s.zones[zi];
  const counts = new Array(ZONES).fill(0); for (let i = 0; i < LED_COUNT; i++) counts[s.zoneOf[i] & 7]++;
  const upd = (fn) => { fn(z); markZone(zi); };
  const updR = (fn) => { upd(fn); renderTab(); };
  const sel = [...state.sel];
  const meta = FX_META[z.effect];
  const params = [];
  for (const key of ['p1', 'p2']) if (meta.p[key]) { const [lab, mn, mx] = meta.p[key]; params.push(slider(lab, clamp(z[key], mn, mx), mn, mx, (v) => upd((q) => { q[key] = v; }))); }
  const usesAccent = [FX.SPARKLE, FX.RAINDROPS, FX.RIPPLE, FX.HEATMAP].includes(z.effect);
  body.append(
    el('div', { class: 'sec' }, el('h3', {}, 'Zones'),
      el('div', { class: 'zones' }, s.zones.map((q, i) => el('button', { class: 'zbtn' + (i === zi ? ' on' : ''), onclick: () => { state.zone = i; renderTab(); } },
        el('b', {}, el('span', { class: 'chip', style: `background:${ZONE_TINTS[i]};margin-right:5px` }), `${i + 1} ${state.zoneNames[i]}`), el('small', {}, `${counts[i]} LEDs · ${zoneSummary(q)}`)))),
      el('div', { class: 'row' },
        el('button', { class: 'btn primary', disabled: !sel.length, onclick: () => { for (const l of sel) s.zoneOf[l] = (s.zoneOf[l] & ~LF.ZONE_MASK) | zi; markZmap(sel); updateSelInfo(); renderTab(); toast(`${sel.length} LED(s) moved to zone ${zi + 1}.`); } }, `Put selection in zone ${zi + 1}`),
        el('button', { class: 'btn', onclick: () => { setSel(range(0, 127).filter((l) => (s.zoneOf[l] & 7) === zi)); } }, 'Select this zone'),
        el('button', { class: 'btn ghost', onclick: () => { state.view = 'zones'; syncViewSeg(); } }, 'Show zone numbers'))),
    el('div', { class: 'sec' }, el('h3', {}, `Zone ${zi + 1}`),
      field('Name', (() => { const i = el('input', { type: 'text', value: state.zoneNames[zi] }); i.addEventListener('change', () => { state.zoneNames[zi] = i.value.slice(0, 18) || `Zone ${zi + 1}`; persistLocalSoon(); renderTab(); }); return i; })()),
      select('Effect', FX_META.map((m) => m.name), z.effect, (v) => updR((q) => { q.effect = v; })),
      el('div', { class: 'desc' }, meta.desc),
      slider('Speed', z.speed, 0, 255, (v) => upd((q) => { q.speed = v; }), (v) => `${(cycleMs(v) / 1000).toFixed(1)} s`),
      slider('Min bright', z.vMin, 0, 255, (v) => upd((q) => { q.vMin = v; }), pct),
      slider('Max bright', z.vMax, 0, 255, (v) => upd((q) => { q.vMax = v; }), pct),
      ...params,
      select('Effect axis', AXIS_NAMES, z.axis, (v) => upd((q) => { q.axis = v; })),
      slider('Spread', z.spread, 0, 64, (v) => upd((q) => { q.spread = v; }), (v) => (v / 16).toFixed(2) + '×'),
      el('div', { class: 'row' },
        check('Reverse', !!(z.flags & ZF.REVERSE), (on) => upd((q) => { q.flags = on ? q.flags | ZF.REVERSE : q.flags & ~ZF.REVERSE; })),
        check('Mirror', !!(z.flags & ZF.MIRROR), (on) => upd((q) => { q.flags = on ? q.flags | ZF.MIRROR : q.flags & ~ZF.MIRROR; }), 'Fold the axis at its middle so patterns run out from (or into) the center'),
        check('Scroll colors too', !!(z.flags & ZF.SRC_SCROLL), (on) => upd((q) => { q.flags = on ? q.flags | ZF.SRC_SCROLL : q.flags & ~ZF.SRC_SCROLL; }), 'Also scroll the gradient/rainbow source at the effect speed'))),
    el('div', { class: 'sec' }, el('h3', {}, 'Colors'),
      select('Source', SRC_NAMES, z.source, (v) => updR((q) => { q.source = v; })),
      z.source === SRC.GRADIENT ? select('Gradient', state.scene.grad.map((g, i) => `Slot ${i + 1}`), z.gradient, (v) => updR((q) => { q.gradient = v; })) : null,
      z.source === SRC.GRADIENT ? el('div', { class: 'gbar', style: `background:${gradCss(s.grad[z.gradient])}` }) : null,
      (z.source === SRC.GRADIENT || z.source === SRC.RAINBOW) ? select('Color axis', AXIS_NAMES, z.srcAxis, (v) => upd((q) => { q.srcAxis = v; })) : null,
      (z.source === SRC.GRADIENT || z.source === SRC.RAINBOW) ? slider('Color scale', z.srcScale, 0, 64, (v) => upd((q) => { q.srcScale = v; }), (v) => (v / 16).toFixed(2) + '×') : null,
      field(z.source === SRC.ZONE ? 'Zone color' : 'Accent color', colorInput(z.color, (c) => upd((q) => { q.color = c; })), usesAccent || z.source === SRC.ZONE ? '' : 'black = own color'),
    ),
    el('div', { class: 'sec' }, el('h3', {}, 'Keypress overlay'),
      select('Reaction', RX_META.map((r) => r[0]), z.reactive & 15, (v) => updR((q) => { q.reactive = (q.reactive & 0xF0) | v; })),
      (z.reactive & 15) ? el('div', { class: 'desc' }, RX_META[z.reactive & 15][1]) : null,
      (z.reactive & 15) ? slider('Fade', z.reactive >> 4, 0, 15, (v) => upd((q) => { q.reactive = (q.reactive & 0x0F) | (v << 4); }), (v) => `${((200 + (15 - v) * 120) / 1000).toFixed(2)} s`) : null,
      (z.reactive & 15) ? field('Reaction color', colorInput(z.rxColor, (c) => upd((q) => { q.rxColor = c; })), 'black = white') : null,
      el('p', { class: 'hint' }, 'Tip: switch the stage tool to "Type" and click keys to try reactions.')),
  );
}

// Gradients ------------------------------------------------------------
function gradCss(g) {
  const n = Math.min(g.count, GRAD_STOPS); if (!n) return '#000';
  const out = [0, 0, 0], stops = [];
  for (let p = 0; p <= 255; p += 15) { HC.util.gradSample(g, p, out); stops.push(`${rgbHex(out)} ${((p / 255) * 100).toFixed(1)}%`); }
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}
function tabGradients(body) {
  const gi = state.grad, g = state.scene.grad[gi];
  const upd = () => { markGrad(gi); renderTab(); };
  const n = Math.min(g.count, GRAD_STOPS);
  const stops = [];
  for (let i = 0; i < n; i++) {
    const st = g.stops[i];
    const pos = el('input', { type: 'range', min: 0, max: 255, value: st.pos, 'aria-label': `Stop ${i + 1} position` });
    pos.addEventListener('change', () => { st.pos = +pos.value; sortStops(g); upd(); });
    stops.push(el('div', { class: 'stop' }, colorInput([st.r, st.g, st.b], (c) => { st.r = c[0]; st.g = c[1]; st.b = c[2]; markGrad(gi); bar.style.background = gradCss(g); }), pos,
      el('span', { class: 'mono muted' }, pct(st.pos)),
      el('button', { class: 'btn small', 'aria-label': 'Remove stop', disabled: n <= 1, onclick: () => { g.stops.splice(i, 1); g.stops.push({ pos: 0, r: 0, g: 0, b: 0 }); g.count = n - 1; upd(); } }, '×')));
  }
  const bar = el('div', { class: 'gbar', style: `height:34px;background:${gradCss(g)}` });
  const presetSel = el('select', { 'aria-label': 'Gradient preset' }, el('option', { value: '' }, 'Load a preset…'), Object.keys(GRAD_PRESETS).map((k) => el('option', { value: k }, k)));
  presetSel.addEventListener('change', () => { if (presetSel.value) { state.scene.grad[gi] = makeGradient(presetSel.value); upd(); } });
  body.append(
    el('div', { class: 'sec' }, el('h3', {}, 'Gradient slots'),
      el('div', { class: 'row' }, state.scene.grad.map((q, i) => el('button', { class: 'btn' + (i === gi ? ' active' : ''), onclick: () => { state.grad = i; renderTab(); } },
        el('span', { class: 'chip', style: `width:44px;background:${gradCss(q)}` }), ` ${i + 1}`)))),
    el('div', { class: 'sec' }, el('h3', {}, `Slot ${gi + 1}`), bar, presetSel,
      el('div', { class: 'stops' }, stops),
      el('div', { class: 'row' },
        el('button', { class: 'btn', disabled: n >= GRAD_STOPS, onclick: () => { const last = g.stops[n - 1] || { pos: 0, r: 255, g: 255, b: 255 }; g.stops[n] = { pos: Math.min(255, last.pos + 40), r: last.r, g: last.g, b: last.b }; g.count = n + 1; sortStops(g); upd(); } }, 'Add stop'),
        check('Loop back to the first color', !!(g.flags & 1), (on) => { g.flags = on ? 1 : 0; upd(); }),
        el('button', { class: 'btn ghost', onclick: () => { const c = g.stops.slice(0, n).reverse().map((s) => ({ ...s, pos: 255 - s.pos })); c.forEach((s, i) => { g.stops[i] = s; }); upd(); } }, 'Reverse')),
      el('p', { class: 'hint' }, `Up to ${GRAD_STOPS} stops. Zones use a gradient when their source is "Gradient"; the Flow effect makes it glide.`)),
  );
}
function sortStops(g) { const n = Math.min(g.count, GRAD_STOPS); const a = g.stops.slice(0, n).sort((x, y) => x.pos - y.pos); a.forEach((s, i) => { g.stops[i] = s; }); }

// Effects gallery --------------------------------------------------------
const fxPreviews = [];
function demoScene(fxId) {
  const s = baseScene(); for (let i = 0; i < LED_COUNT; i++) s.zoneOf[i] = 0;
  s.grad[0] = makeGradient(fxId === FX.FLOW ? 'Aurora' : 'Sunset');
  const z = Z({ effect: fxId, source: SRC.GRADIENT, gradient: 0, srcAxis: AXIS.X, speed: 110, vMin: 50, vMax: 255, axis: AXIS.X, spread: 16, p1: 120, p2: 2, color: [255, 255, 255] });
  if (fxId === FX.BREATHE || fxId === FX.PULSE || fxId === FX.STROBE) { z.axis = AXIS.NONE; z.spread = 0; z.p1 = 90; }
  if (fxId === FX.COMET) { z.axis = AXIS.RING; z.p1 = 70; z.vMin = 10; }
  if (fxId === FX.SPARKLE || fxId === FX.RAINDROPS) { z.p1 = 60; }
  if (fxId === FX.REACT_FADE || fxId === FX.RIPPLE || fxId === FX.HEATMAP) { z.vMin = 25; z.color = [0, 220, 255]; }
  if (fxId === FX.SATWAVE) z.p2 = 230;
  if (fxId === FX.HUE_DRIFT) z.p1 = 60;
  s.zones[0] = z;
  return s;
}
function tabEffects(body) {
  fxPreviews.length = 0;
  body.append(el('p', { class: 'hint' }, 'Every effect animates the colors you choose (painted, zone color, gradient or rainbow) instead of replacing them. Previews use a sunset gradient; reactive ones simulate typing.'));
  const grid = el('div', { class: 'fxgrid' });
  for (const m of FX_META) {
    if (m.id === FX.OFF) continue;
    const c = el('canvas', { width: 300, height: 132 });
    fxPreviews.push({ canvas: c, scene: demoScene(m.id), engine: new HC.HcEngine(keyXY), reactive: [FX.REACT_FADE, FX.RIPPLE, FX.HEATMAP].includes(m.id), lastHit: 0, buf: new Uint8Array(LED_COUNT * 3) });
    grid.append(el('div', { class: 'fxcard' }, c, el('div', {}, el('h4', {}, m.name), el('p', {}, m.desc),
      el('button', { class: 'btn small', onclick: () => { const z = state.scene.zones[state.zone]; z.effect = m.id; markZone(state.zone); state.tab = 'zones'; renderTab(); toast(`Zone ${state.zone + 1} now uses ${m.name}.`); } }, `Use in zone ${state.zone + 1}`))));
  }
  body.append(grid);
}
function drawFxPreviews(t) {
  for (const p of fxPreviews) {
    if (p.reactive && t - p.lastHit > 260) { p.lastHit = t; const pool = GROUPS['Letters']; p.engine.keyHit(p.scene, pool[(Math.random() * pool.length) | 0], t); }
    p.engine.renderFrame(p.scene, t, { keys: 255, halo: 255 }, p.buf);
    const c = p.canvas.getContext('2d'), W = p.canvas.width, H = p.canvas.height, u = W / 19.0, ox = 1.5 * u, oy = 1.65 * u;
    c.fillStyle = '#08090b'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < HALO_LEDS; i++) { const x = p.scene.haloXY[i * 2], y = p.scene.haloXY[i * 2 + 1], led = KEY_LEDS + i; c.fillStyle = `rgb(${p.buf[led * 3]},${p.buf[led * 3 + 1]},${p.buf[led * 3 + 2]})`; c.beginPath(); c.arc(ox + ((x - 16) / 12) * u, oy + ((y - 12) / 8) * u, u * 0.2, 0, 7); c.fill(); }
    for (const k of KEYS) { const l = k.led; c.fillStyle = `rgb(${p.buf[l * 3]},${p.buf[l * 3 + 1]},${p.buf[l * 3 + 2]})`; c.fillRect(ox + k.x * u + 1, oy + k.y * u + 1, k.w * u - 2, u - 2); }
  }
}

// Scenes -----------------------------------------------------------------
function tabScenes(body) {
  const lib = loadLibrary();
  const nameIn = el('input', { type: 'text', placeholder: 'Name this scene', 'aria-label': 'Scene name' });
  const file = el('input', { type: 'file', accept: '.json,application/json', hidden: true });
  file.addEventListener('change', async () => { try { const j = JSON.parse(await file.files[0].text()); importProfile(j); toast(`Imported "${j.name}".`); renderTab(); } catch (e) { toast('Import failed: ' + e.message); } });
  body.append(
    el('div', { class: 'sec' }, el('h3', {}, 'Starter scenes'),
      el('div', { class: 'scenes' }, SCENES.map((sc) => el('button', { class: 'scene', onclick: () => { state.scene = sc.build(); state.zoneNames = sc.names.concat(state.zoneNames.slice(sc.names.length)); engine.reset(); markAll(); updateSelInfo(); toast(`Loaded "${sc.name}". ${state.link ? 'Pushed to the keyboard; Save to keep it.' : ''}`); } },
        el('b', {}, sc.name), el('span', {}, sc.note))))),
    el('div', { class: 'sec' }, el('h3', {}, 'My scenes (this browser)'),
      el('div', { class: 'row' }, nameIn, el('button', { class: 'btn primary', onclick: () => { const n = nameIn.value.trim() || `Scene ${lib.length + 1}`; lib.push(exportProfile(n)); saveLibrary(lib); renderTab(); toast(`Saved "${n}" in this browser.`); } }, 'Save current')),
      lib.length ? el('div', { class: 'sec' }, lib.map((p, i) => el('div', { class: 'row' },
        el('span', { style: 'flex:1' }, p.name), el('span', { class: 'mono muted' }, (p.created || '').slice(0, 10)),
        el('button', { class: 'btn small', onclick: () => { importProfile(p); toast(`Loaded "${p.name}".`); renderTab(); } }, 'Load'),
        el('button', { class: 'btn small', onclick: () => downloadJson(p, p.name) }, 'Export'),
        el('button', { class: 'btn small', onclick: () => { lib.splice(i, 1); saveLibrary(lib); renderTab(); } }, 'Delete')))) : el('p', { class: 'hint' }, 'Nothing saved yet.'),
      el('div', { class: 'row' }, el('button', { class: 'btn', onclick: () => downloadJson(exportProfile(nameIn.value.trim() || 'halo-scene'), nameIn.value.trim() || 'halo-scene') }, 'Export current as file'), el('button', { class: 'btn', onclick: () => file.click() }, 'Import file…'), file)),
    el('p', { class: 'hint' }, 'The keyboard stores one scene (the one you Save). Keep as many as you like here and push any of them.'),
  );
}
function loadLibrary() { try { return JSON.parse(localStorage.getItem(LS_KEY + '/library') || '[]'); } catch (e) { return []; } }
function saveLibrary(l) { try { localStorage.setItem(LS_KEY + '/library', JSON.stringify(l)); } catch (e) { toast('This browser blocked local storage; use Export instead.'); } }
function downloadJson(obj, name) {
  const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })), download: name.replace(/[^\w.-]+/g, '_') + '.halo.json' });
  document.body.append(a); a.click(); a.remove();
}

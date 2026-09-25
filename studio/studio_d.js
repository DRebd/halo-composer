
// ------------------------------------------------------------------- tabs
// `tip` (optional) becomes the label's hover help (data-tip; see the tooltip code in studio_e.js).
function field(label, input, outText, tip) { return el('div', { class: 'field' }, el('label', { 'data-tip': tip }, label), input, el('output', {}, outText ?? '')); }
function slider(label, value, min, max, onInput, fmt = (v) => v, tip) {
  const out = el('output', {}, fmt(value));
  const inp = el('input', { type: 'range', min, max, value, 'aria-label': label });
  inp.addEventListener('input', () => { out.textContent = fmt(+inp.value); onInput(+inp.value); });
  return el('div', { class: 'field' }, el('label', { 'data-tip': tip }, label), inp, out);
}
function select(label, options, value, onChange, tip) {
  const s = el('select', { 'aria-label': label }, options.map((o, i) => el('option', { value: i, selected: i === value }, o)));
  s.addEventListener('change', () => onChange(+s.value));
  return el('div', { class: 'field' }, el('label', { 'data-tip': tip }, label), s, el('span'));
}
// key: a stable data-k hook for code and tests.
function check(label, on, onChange, tip, key) {
  const i = el('input', { type: 'checkbox', checked: on }); i.addEventListener('change', () => onChange(i.checked));
  return el('label', { class: 'check', 'data-tip': tip, 'data-k': key }, i, el('span', {}, label));
}
const h3 = (text, tip) => el('h3', { 'data-tip': tip }, text);
function colorInput(rgb, onChange) {
  const c = el('input', { type: 'color', value: rgbHex(rgb) }); c.addEventListener('input', () => onChange(hexRgb(c.value)));
  return c;
}

function renderTab() {
  hideTip();
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
  // The picker updates everything in place while it is open; rebuilding the tab
  // would destroy the <input> and close the browser's colour dialog.
  const picker = colorInput(state.color, (c) => { setColor(c, false); refreshCur(true); });
  cur.append(el('span', { class: 'sw', style: `width:46px;background:${rgbHex(state.color)}` }), picker, hexIn,
    el('span', { class: 'mono muted' }, `rgb ${state.color.join(' ')}`));
  const hsvRows = [
    slider('Hue', hsv[0], 0, 255, (v) => { hsv[0] = v; setColor(HC.util.hsv2rgb(hsv[0], hsv[1], hsv[2], [0, 0, 0]), false); refreshCur(); }, undefined, TIP.hue),
    slider('Saturation', hsv[1], 0, 255, (v) => { hsv[1] = v; setColor(HC.util.hsv2rgb(hsv[0], hsv[1], hsv[2], [0, 0, 0]), false); refreshCur(); }, pct, TIP.sat),
    slider('Brightness', hsv[2], 0, 255, (v) => { hsv[2] = v; setColor(HC.util.hsv2rgb(hsv[0], hsv[1], hsv[2], [0, 0, 0]), false); refreshCur(); }, pct, TIP.bright),
  ];
  function refreshCur(fromPicker = false) {
    cur.children[0].style.background = rgbHex(state.color); hexIn.value = rgbHex(state.color); cur.children[3].textContent = `rgb ${state.color.join(' ')}`;
    if (!fromPicker) { picker.value = rgbHex(state.color); return; }
    HC.util.rgb2hsv(state.color, hsv);
    hsvRows.forEach((row, k) => { row.querySelector('input').value = hsv[k]; row.querySelector('output').textContent = k ? pct(hsv[k]) : hsv[k]; });
  }
  const none = !state.sel.size;
  body.append(
    el('div', { class: 'sec' }, h3('Color', TIP.color), cur, ...hsvRows),
    ...COLOR_PRESETS.map(([grp, list]) => el('div', { class: 'sec' }, h3(grp, grp === 'Whites' ? TIP.whites : undefined), el('div', { class: 'swatches' },
      list.map(([n, rgb]) => el('button', { class: 'sw', title: n, 'aria-label': n, style: `background:${rgbHex(rgb)}`, onclick: () => setColor(rgb.slice()) }))))),
    el('div', { class: 'sec' }, h3('Apply to selection', TIP.apply),
      el('div', { class: 'row' },
        el('button', { class: 'btn primary', 'data-needs-sel': true, disabled: none, 'data-tip': TIP.fill, onclick: () => { const sel = curSel(); paintLeds(sel, state.color); toast(`Painted ${sel.length} LED(s).`); } }, 'Fill selection'),
        el('button', { class: 'btn', 'data-needs-sel': true, disabled: none, 'data-tip': TIP.darker, onclick: () => adjustSel(0.85) }, 'Darker'),
        el('button', { class: 'btn', 'data-needs-sel': true, disabled: none, 'data-tip': TIP.lighter, onclick: () => adjustSel(1.15) }, 'Lighter'),
        el('button', { class: 'btn', 'data-tip': TIP.brush, onclick: () => setTool('paint') }, 'Paint brush'),
        el('button', { class: 'btn', 'data-tip': TIP.dropper, onclick: () => setTool('pick') }, 'Eyedropper')),
      el('p', { class: 'hint' }, 'Painted colors show wherever a zone uses "Painted colors" as its source. Effects then animate on top of them.')),
    el('div', { class: 'sec' }, h3('Bake a gradient into the selection', TIP.bake),
      bakeControls()),
    el('div', { class: 'sec' }, h3('Selection flags', TIP.selFlags),
      el('div', { class: 'row' },
        el('button', { class: 'btn small', 'data-needs-sel': true, disabled: none, 'data-tip': TIP.noReact, onclick: () => { const sel = curSel(); for (const l of sel) state.scene.zoneOf[l] |= LF.NO_REACT; markZmap(sel); toast('Selection now ignores keypress overlays.'); } }, 'Ignore keypress overlays'),
        el('button', { class: 'btn small', 'data-needs-sel': true, disabled: none, 'data-tip': TIP.react, onclick: () => { const sel = curSel(); for (const l of sel) state.scene.zoneOf[l] &= ~LF.NO_REACT; markZmap(sel); toast('Selection reacts to keypresses again.'); } }, 'React to keypresses'))),
  );
}
function adjustSel(f) { const s = state.scene; const sel = [...state.sel]; for (const l of sel) for (let k = 0; k < 3; k++) s.color[l * 3 + k] = clamp(Math.round(s.color[l * 3 + k] * f), 0, 255); markColors(sel); }
function bakeControls() {
  let slot = state.grad, axis = AXIS.X;
  const bar = el('div', { class: 'gbar', style: `background:${gradCss(state.scene.grad[slot])}` });
  return el('div', { class: 'sec' },
    select('Gradient', state.scene.grad.map((g, i) => `Slot ${i + 1}`), slot, (v) => { slot = v; bar.style.background = gradCss(state.scene.grad[v]); }, TIP.bakeSlot),
    bar,
    select('Direction', AXIS_NAMES.slice(0, 7), axis, (v) => { axis = v; }, TIP.bakeDir),
    el('div', { class: 'row' }, el('button', { class: 'btn', 'data-needs-sel': true, disabled: !state.sel.size, 'data-tip': TIP.bakeBtn, onclick: () => {
      const sel = curSel();
      const vals = sel.map((l) => engine.axisValue(state.scene, l, axis));
      const lo = Math.min(...vals), hi = Math.max(...vals), out = [0, 0, 0];
      sel.forEach((l, i) => { const p = hi > lo ? Math.round(((vals[i] - lo) * 255) / (hi - lo)) : 0; HC.util.gradSample(state.scene.grad[slot], p, out); paintLeds([l], out); });
      toast('Gradient painted across the selection.');
    } }, 'Paint gradient across selection')),
    el('p', { class: 'hint' }, 'This writes fixed per-LED colors. For a moving or zone-wide gradient, set a zone\'s source to Gradient instead.'));
}

// Zones -----------------------------------------------------------------
function zoneSummary(z) { return `${FX_META[z.effect]?.name || '?'} · ${['painted', 'zone color', 'gradient', 'rainbow'][z.source]}`; }
// What Speed means for the zone's effect, with the formulas from hc_engine.js.
// mode 'cycle': the slider is linear in cycle time (see speedPos/posSpeed in studio_a.js);
// 'byte': the raw byte, which is already linear in what it controls; 'none': unused.
function speedSpec(z) {
  const m = FX_META[z.effect], pp = !!(z.flags & PINGPONG) && ppApplies(z);
  const scrollOn = !!(z.flags & ZF.SRC_SCROLL) && z.effect !== FX.FLOW; // Flow's own motion is the scroll
  const scrollNote = (b) => (scrollOn ? ` Colors scroll once every ${fmtMs(cycleExact(b))}${pp ? ' one way' : ''}${z.source === SRC.GRADIENT || z.source === SRC.RAINBOW ? '' : ' (once Source is Gradient or Rainbow)'}.` : '');
  const T = (div) => (b) => fmtMs(cycleExact(b) / div);
  const evenly = 'The slider moves evenly through time. Near the slow end the steps get coarser, because the keyboard stores Speed as a single number from 0 to 255.';
  const cyc = (out, note, tip) => ({ mode: 'cycle', label: 'Speed', out, note: (b) => note(b) + scrollNote(b), tip });
  switch (z.effect) {
    case FX.RIPPLE: // ring radius grows by (16 + speed/2) / 256 units per ms; 12 units = one key
      return { mode: 'byte', label: 'Ring speed', out: (b) => `${fmtKps(b)} keys/s`, note: (b) => `Rings spread about ${fmtKps(b)} keys per second.` + scrollNote(b),
        tip: `How fast rings spread out from a pressed key: about ${fmtKps(0)} keys per second at the far left, ${fmtKps(255)} at the far right.` };
    case FX.REACT_FADE: // 150 + (255 - speed) * 12 ms
      return { mode: 'byte', label: 'Fade speed', out: (b) => fmtMs(reactFadeMs(b)), note: (b) => `A pressed key fades from Max back to Min over ${fmtMs(reactFadeMs(b))}.` + scrollNote(b),
        tip: `How quickly a pressed key fades back to Min: over ${fmtMs(reactFadeMs(0))} at the far left, ${fmtMs(reactFadeMs(255))} at the far right.` };
    case FX.SPARKLE: // one random slot = 2^11 phase steps = 1/32 of a cycle
      return cyc(T(32), (b) => `Each sparkle flashes and fades out over ${T(32)(b)}.`, `How long each sparkle lasts: ${T(32)(0)} at the far left, ${T(32)(255)} at the far right. ${evenly}`);
    case FX.RAINDROPS: // 2^12 phase steps = 1/16 of a cycle
      return cyc(T(16), (b) => `Each drop fades in and back out over ${T(16)(b)}.`, `How long each drop lasts: ${T(16)(0)} at the far left, ${T(16)(255)} at the far right. ${evenly}`);
    case FX.CANDLE: // a new random level every 2^10 phase steps = 1/64 of a cycle
      return cyc(T(64), (b) => `Each LED glides to a new random brightness every ${T(64)(b)}.`, `How fast the flame flickers: a new brightness every ${T(64)(0)} at the far left, every ${T(64)(255)} at the far right. ${evenly}`);
    case FX.STATIC: case FX.HEATMAP: case FX.OFF: {
      const idle = { [FX.STATIC]: 'Static doesn\'t move, so Speed isn\'t used (unless Scroll colors too is on).', [FX.HEATMAP]: 'Heatmap doesn\'t use Speed: a key cools at a fixed pace, from hottest to cold in about 10 s.', [FX.OFF]: 'The zone is dark, so Speed isn\'t used.' }[z.effect];
      if (!scrollOn || z.effect === FX.OFF) return { mode: 'none', label: 'Speed', out: () => 'not used', note: () => idle, tip: idle };
      const lead = z.effect === FX.STATIC ? 'Static doesn\'t move' : 'Keys cool at a fixed pace';
      return cyc(T(1), () => `${lead}; Speed only sets how fast the colors scroll.`, `Sets how fast the colors scroll: once every ${fmtMs(CYCLE_SLOW)} at the far left, ${fmtMs(CYCLE_FAST)} at the far right. ${evenly}`);
    }
    default: { // one full cycle of the effect
      const own = pp && ppOwn(z);
      return cyc(T(1), (b) => `${m.cycle} takes ${T(1)(b)}${own ? ` one way; there and back takes ${fmtMs(2 * cycleExact(b))}` : ''}.`,
        `How fast the effect runs, shown as the time one cycle takes: ${fmtMs(CYCLE_SLOW)} at the far left, ${fmtMs(CYCLE_FAST)} at the far right. ${evenly}${own ? ' Back and forth is on, so the time shown is one way.' : ''}`);
    }
  }
}
// The Speed row. Rendering never writes z.speed: a stored byte stays exactly as it
// was until the slider is moved.
function speedField(z, onSpeed) {
  let spec = speedSpec(z);
  const lab = el('label'), out = el('output'), note = el('p', { class: 'fnote' });
  const inp = el('input', { type: 'range', min: 0, max: spec.mode === 'byte' ? 255 : SPEED_STEPS, 'data-k': 'speed' });
  inp.value = spec.mode === 'byte' ? z.speed : speedPos(z.speed);
  const row = el('div', { class: 'field' }, lab, inp, out);
  const refresh = () => {
    spec = speedSpec(z);
    lab.textContent = spec.label; lab.dataset.tip = spec.tip; inp.setAttribute('aria-label', spec.label);
    inp.disabled = spec.mode === 'none'; row.classList.toggle('off', inp.disabled);
    out.textContent = spec.out(z.speed); note.textContent = spec.note(z.speed);
  };
  inp.addEventListener('input', () => {
    const b = spec.mode === 'byte' ? +inp.value : posSpeed(+inp.value);
    if (b !== z.speed) onSpeed(b);
    refresh();
  });
  const wrap = el('div', { class: 'fgroup' }, row, note);
  wrap.refresh = refresh; refresh();
  return wrap;
}
function tabZones(body) {
  const s = state.scene, zi = state.zone, z = s.zones[zi];
  const counts = new Array(ZONES).fill(0); for (let i = 0; i < LED_COUNT; i++) if (!ABSENT.has(i)) counts[s.zoneOf[i] & 7]++;
  const upd = (fn) => { fn(z); markZone(zi); };
  const updR = (fn) => { upd(fn); renderTab(); };
  const flag = (bit) => (on) => (q) => { q.flags = on ? q.flags | bit : q.flags & ~bit; };
  const meta = FX_META[z.effect], name = meta.name, off = z.effect === FX.OFF;
  const params = [];
  for (const key of ['p1', 'p2']) if (meta.p[key]) { const { label, min, max, fmt, tip } = meta.p[key]; params.push(slider(label, clamp(z[key], min, max), min, max, (v) => upd((q) => { q[key] = v; }), fmt, tip)); }
  const usesAccent = [FX.SPARKLE, FX.RAINDROPS, FX.RIPPLE, FX.HEATMAP].includes(z.effect);
  const gradSrc = z.source === SRC.GRADIENT || z.source === SRC.RAINBOW;
  // hover help that depends on the effect
  const loTip = off ? 'Off: the zone is dark, so this isn\'t used.' : meta.lo ? `The low end of the zone's brightness (0% = off). In ${name} it sets ${meta.lo}` : `The low end of the zone's brightness. ${name} doesn't use it: it runs at Max bright.`;
  const hiTip = off ? 'Off: the zone is dark, so this isn\'t used.' : `The high end of the zone's brightness (100% = the full color). In ${name} it sets ${meta.hi}`;
  const axisTip = TIP.axis + (meta.axis === 'spread' ? ' Spread sets how much of a cycle fits along it.' : meta.axis === 'path' ? ' Comets travel along it; Ring makes them orbit the halo.'
    : z.effect === FX.FLOW ? ' Flow doesn\'t use it: the colors move along the Color axis instead.' : ` ${name} doesn't use it.`);
  const spreadTip = TIP.spread + (meta.axis !== 'spread' ? ` ${name} doesn't use it.` : z.effect === FX.BREATHE ? ' For Breathe, 0 is a plain breath; above 0 it becomes a breathing wave that travels along the axis.' : '');
  const speedRow = speedField(z, (b) => upd((q) => { q.speed = b; }));
  const ppBox = check('Back and forth', !!(z.flags & PINGPONG), (on) => updR(flag(PINGPONG)(on)), '', 'pingpong');
  const refreshPP = () => {
    const ok = ppApplies(z);
    ppBox.querySelector('input').disabled = !ok; ppBox.classList.toggle('off', !ok);
    ppBox.dataset.tip = ok ? `${TIP.pingpong} ${TIP.ppWorks}`
      : z.effect === FX.BREATHE ? `Breathe only runs back and forth as a travelling breathing wave: raise Spread above 0 first (or turn on Scroll colors too). ${TIP.pingpong}`
        : `${name} has no motion to run back and forth, so this does nothing here. ${TIP.ppWorks}`;
  };
  refreshPP();
  body.append(
    el('div', { class: 'sec' }, h3('Zones', TIP.zones),
      el('div', { class: 'zones' }, s.zones.map((q, i) => el('button', { class: 'zbtn' + (i === zi ? ' on' : '') + (counts[i] ? '' : ' empty'), 'data-tip': `Zone ${i + 1} · ${state.zoneNames[i]} · ${counts[i]} LEDs · ${zoneSummary(q)}. Click to edit it.`, onclick: () => { state.zone = i; renderTab(); } },
        el('span', { class: 'znum', style: `background:${ZONE_TINTS[i]}` }, String(i + 1)),
        el('span', { class: 'zmeta' }, el('b', {}, state.zoneNames[i]), el('small', {}, counts[i] ? `${counts[i]} LED${counts[i] === 1 ? '' : 's'}` : 'empty'), el('small', {}, zoneSummary(q)))))),
      el('div', { class: 'row' },
        el('button', { class: 'btn primary', 'data-needs-sel': true, disabled: !state.sel.size, 'data-tip': TIP.putInZone, onclick: () => { const sel = curSel(); for (const l of sel) s.zoneOf[l] = (s.zoneOf[l] & ~LF.ZONE_MASK) | zi; markZmap(sel); updateSelInfo(); renderTab(); toast(`${sel.length} LED(s) moved to zone ${zi + 1}.`); } }, `Put selection in zone ${zi + 1}`),
        el('button', { class: 'btn', 'data-tip': TIP.selZone, onclick: () => { setSel(range(0, 127).filter((l) => (s.zoneOf[l] & 7) === zi)); } }, 'Select this zone'),
        el('button', { class: 'btn ghost', 'data-tip': TIP.showZoneNums, onclick: () => { state.view = 'zones'; syncViewSeg(); } }, 'Show zone numbers'))),
    el('div', { class: 'sec' }, h3(`Zone ${zi + 1}`),
      field('Name', (() => { const i = el('input', { type: 'text', value: state.zoneNames[zi], 'aria-label': 'Zone name' }); i.addEventListener('change', () => { state.zoneNames[zi] = i.value.slice(0, 18) || `Zone ${zi + 1}`; persistLocalSoon(); renderTab(); }); return i; })(), '', TIP.name),
      select('Effect', FX_META.map((m) => m.name), z.effect, (v) => updR((q) => { q.effect = v; }), TIP.effect),
      el('div', { class: 'desc' }, meta.desc),
      speedRow,
      slider('Min bright', z.vMin, 0, 255, (v) => upd((q) => { q.vMin = v; }), pct, loTip),
      slider('Max bright', z.vMax, 0, 255, (v) => upd((q) => { q.vMax = v; }), pct, hiTip),
      ...params,
      select('Effect axis', AXIS_NAMES, z.axis, (v) => upd((q) => { q.axis = v; }), axisTip),
      slider('Spread', z.spread, 0, 64, (v) => { upd((q) => { q.spread = v; }); refreshPP(); speedRow.refresh(); }, (v) => (v / 16).toFixed(2) + '×', spreadTip),
      el('div', { class: 'row checks-row' },
        check('Reverse', !!(z.flags & ZF.REVERSE), (on) => upd(flag(ZF.REVERSE)(on)), TIP.reverse, 'reverse'),
        check('Mirror', !!(z.flags & ZF.MIRROR), (on) => upd(flag(ZF.MIRROR)(on)), TIP.mirror, 'mirror'),
        ppBox,
        check('Scroll colors too', !!(z.flags & ZF.SRC_SCROLL), (on) => updR(flag(ZF.SRC_SCROLL)(on)), TIP.scroll, 'scroll'))),
    el('div', { class: 'sec' }, h3('Colors', TIP.colors),
      select('Source', SRC_NAMES, z.source, (v) => updR((q) => { q.source = v; }), TIP.source),
      z.source === SRC.GRADIENT ? select('Gradient', state.scene.grad.map((g, i) => `Slot ${i + 1}`), z.gradient, (v) => updR((q) => { q.gradient = v; }), TIP.zoneGrad) : null,
      z.source === SRC.GRADIENT ? el('div', { class: 'gbar', style: `background:${gradCss(s.grad[z.gradient])}` }) : null,
      gradSrc ? select('Color axis', AXIS_NAMES, z.srcAxis, (v) => upd((q) => { q.srcAxis = v; }), TIP.srcAxis) : null,
      gradSrc ? slider('Color scale', z.srcScale, 0, 64, (v) => upd((q) => { q.srcScale = v; }), (v) => (v / 16).toFixed(2) + '×', TIP.srcScale) : null,
      z.source === SRC.ZONE
        ? field('Zone color', colorInput(z.color, (c) => upd((q) => { q.color = c; })), '', TIP.zoneColor)
        : field('Accent color', colorInput(z.color, (c) => upd((q) => { q.color = c; })), usesAccent ? 'black = own color' : 'not used', TIP.accent + (usesAccent ? '' : ` ${name} doesn't use it.`)),
    ),
    el('div', { class: 'sec' }, h3('Keypress overlay', TIP.overlay),
      select('Reaction', RX_META.map((r) => r[0]), z.reactive & 15, (v) => updR((q) => { q.reactive = (q.reactive & 0xF0) | v; }), TIP.reaction),
      (z.reactive & 15) ? el('div', { class: 'desc' }, RX_META[z.reactive & 15][1]) : null,
      (z.reactive & 15) ? slider('Fade', z.reactive >> 4, 0, 15, (v) => upd((q) => { q.reactive = (q.reactive & 0x0F) | (v << 4); }), (v) => `${((200 + (15 - v) * 120) / 1000).toFixed(2)} s`, TIP.fade) : null,
      (z.reactive & 15) ? field('Reaction color', colorInput(z.rxColor, (c) => upd((q) => { q.rxColor = c; })), 'black = white', TIP.rxColor) : null,
      el('p', { class: 'hint' }, 'Tip: set Tool to "Type (test reactive)" and click keys to try reactions.')),
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
  const gflag = (bit) => (on) => { g.flags = on ? g.flags | bit : g.flags & ~bit; upd(); };
  const n = Math.min(g.count, GRAD_STOPS);
  const stops = [];
  for (let i = 0; i < n; i++) {
    const st = g.stops[i];
    const pos = el('input', { type: 'range', min: 0, max: 255, value: st.pos, 'aria-label': `Stop ${i + 1} position`, 'data-tip': TIP.stopPos });
    pos.addEventListener('change', () => { st.pos = +pos.value; sortStops(g); upd(); });
    const col = colorInput([st.r, st.g, st.b], (c) => { st.r = c[0]; st.g = c[1]; st.b = c[2]; markGrad(gi); bar.style.background = gradCss(g); });
    col.dataset.tip = TIP.stopColor; col.setAttribute('aria-label', `Stop ${i + 1} color`);
    stops.push(el('div', { class: 'stop' }, col, pos,
      el('span', { class: 'mono muted' }, pct(st.pos)),
      el('button', { class: 'btn small', 'aria-label': 'Remove stop', 'data-tip': 'Removes this stop.', disabled: n <= 1, onclick: () => { g.stops.splice(i, 1); g.stops.push({ pos: 0, r: 0, g: 0, b: 0 }); g.count = n - 1; upd(); } }, '×')));
  }
  const bar = el('div', { class: 'gbar', style: `height:34px;background:${gradCss(g)}` });
  const presetSel = el('select', { 'aria-label': 'Gradient preset', 'data-tip': TIP.gradPreset }, el('option', { value: '' }, 'Load a preset…'), Object.keys(GRAD_PRESETS).map((k) => el('option', { value: k }, k)));
  presetSel.addEventListener('change', () => { if (presetSel.value) { state.scene.grad[gi] = makeGradient(presetSel.value); upd(); } });
  body.append(
    el('div', { class: 'sec' }, h3('Gradient slots', TIP.gradSlots),
      el('div', { class: 'row' }, state.scene.grad.map((q, i) => el('button', { class: 'btn' + (i === gi ? ' active' : ''), 'aria-label': `Gradient slot ${i + 1}`, onclick: () => { state.grad = i; renderTab(); } },
        el('span', { class: 'chip', style: `width:44px;background:${gradCss(q)}` }), ` ${i + 1}`)))),
    el('div', { class: 'sec' }, h3(`Slot ${gi + 1}`), bar, presetSel,
      el('div', { class: 'stops' }, stops),
      el('div', { class: 'row' },
        el('button', { class: 'btn', disabled: n >= GRAD_STOPS, 'data-tip': TIP.addStop, onclick: () => { const last = g.stops[n - 1] || { pos: 0, r: 255, g: 255, b: 255 }; g.stops[n] = { pos: Math.min(255, last.pos + 40), r: last.r, g: last.g, b: last.b }; g.count = n + 1; sortStops(g); upd(); } }, 'Add stop'),
        el('button', { class: 'btn ghost', 'data-tip': TIP.gradReverse, onclick: () => { const c = g.stops.slice(0, n).reverse().map((s) => ({ ...s, pos: 255 - s.pos })); c.forEach((s, i) => { g.stops[i] = s; }); upd(); } }, 'Reverse')),
      el('div', { class: 'checks' },
        check('Loop back through all colors', !!(g.flags & GF.MIRROR), gflag(GF.MIRROR), TIP.gradMirror, 'gmirror'),
        check('Blend the last color into the first', !!(g.flags & GF.WRAP), gflag(GF.WRAP), TIP.gradWrap, 'gwrap')),
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
  if (fxId === FX.RIPPLE) z.p2 = 0; // whole board
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
    const c = el('canvas', { width: 300, height: 136 });
    fxPreviews.push({ canvas: c, scene: demoScene(m.id), engine: new HC.HcEngine(keyXY), reactive: [FX.REACT_FADE, FX.RIPPLE, FX.HEATMAP].includes(m.id), lastHit: 0, buf: new Uint8Array(LED_COUNT * 3) });
    grid.append(el('div', { class: 'fxcard' }, c, el('div', {}, el('h4', {}, m.name), el('p', {}, m.desc),
      el('button', { class: 'btn small', 'data-tip': TIP.useFx, onclick: () => { const z = state.scene.zones[state.zone]; z.effect = m.id; markZone(state.zone); state.tab = 'zones'; renderTab(); toast(`Zone ${state.zone + 1} now uses ${m.name}.`); } }, `Use in zone ${state.zone + 1}`))));
  }
  body.append(grid);
}
function drawFxPreviews(t) {
  for (const p of fxPreviews) {
    if (p.reactive && t - p.lastHit > 260) { p.lastHit = t; const pool = GROUPS['Letters']; p.engine.keyHit(p.scene, pool[(Math.random() * pool.length) | 0], t); }
    p.engine.renderFrame(p.scene, t, { keys: 255, halo: 255 }, p.buf);
    const c = p.canvas.getContext('2d'), W = p.canvas.width, H = p.canvas.height, u = W / (16 + 2 * BEZEL.side + 0.4), ox = (BEZEL.side + 0.2) * u, oy = (BEZEL.top + 0.2) * u;
    const rgb = (l) => `rgb(${DISP[p.buf[l * 3]]},${DISP[p.buf[l * 3 + 1]]},${DISP[p.buf[l * 3 + 2]]})`;
    c.fillStyle = '#08090b'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < HALO_LEDS; i++) { const led = KEY_LEDS + i; if (ABSENT.has(led)) continue; const [ux, uy] = engUnits(p.scene.haloXY[i * 2], p.scene.haloXY[i * 2 + 1]); c.fillStyle = rgb(led); c.beginPath(); c.arc(ox + ux * u, oy + uy * u, u * 0.16, 0, 7); c.fill(); }
    for (const k of KEYS) { c.fillStyle = rgb(k.led); c.fillRect(ox + k.x * u + 1, oy + k.y * u + 1, k.w * u - 2, u - 2); }
  }
}

// Scenes -----------------------------------------------------------------
function tabScenes(body) {
  const lib = loadLibrary();
  const nameIn = el('input', { type: 'text', placeholder: 'Name this scene', 'aria-label': 'Scene name' });
  const file = el('input', { type: 'file', accept: '.json,application/json', hidden: true });
  file.addEventListener('change', async () => { try { const j = JSON.parse(await file.files[0].text()); importProfile(j); toast(`Imported "${j.name}".`); renderTab(); } catch (e) { toast('Import failed: ' + e.message); } });
  body.append(
    el('div', { class: 'sec' }, h3('Starter scenes', TIP.starters),
      el('div', { class: 'scenes' }, SCENES.map((sc) => el('button', { class: 'scene', onclick: () => { adoptScene(sc.build()); state.zoneNames = sc.names.concat(state.zoneNames.slice(sc.names.length)); updateSelInfo(); toast(`Loaded "${sc.name}". ${state.link ? 'Pushed to the keyboard; Save to keep it.' : ''}`); } },
        el('b', {}, sc.name), el('span', {}, sc.note))))),
    el('div', { class: 'sec' }, h3('My scenes (this browser)', TIP.myScenes),
      el('div', { class: 'row' }, nameIn, el('button', { class: 'btn primary', 'data-tip': TIP.saveCurrent, onclick: () => { const n = nameIn.value.trim() || `Scene ${lib.length + 1}`; lib.push(exportProfile(n)); saveLibrary(lib); renderTab(); toast(`Saved "${n}" in this browser.`); } }, 'Save current')),
      lib.length ? el('div', { class: 'sec' }, lib.map((p, i) => el('div', { class: 'row' },
        el('span', { style: 'flex:1' }, p.name), el('span', { class: 'mono muted' }, (p.created || '').slice(0, 10)),
        el('button', { class: 'btn small', 'data-tip': TIP.loadScene, onclick: () => { importProfile(p); toast(`Loaded "${p.name}".`); renderTab(); } }, 'Load'),
        el('button', { class: 'btn small', 'data-tip': TIP.exportScene, onclick: () => downloadJson(p, p.name) }, 'Export'),
        el('button', { class: 'btn small', 'data-tip': TIP.deleteScene, onclick: () => { lib.splice(i, 1); saveLibrary(lib); renderTab(); } }, 'Delete')))) : el('p', { class: 'hint' }, 'Nothing saved yet.'),
      el('div', { class: 'row' }, el('button', { class: 'btn', 'data-tip': TIP.exportCurrent, onclick: () => downloadJson(exportProfile(nameIn.value.trim() || 'halo-scene'), nameIn.value.trim() || 'halo-scene') }, 'Export current as file'), el('button', { class: 'btn', 'data-tip': TIP.importFile, onclick: () => file.click() }, 'Import file…'), file)),
    el('p', { class: 'hint' }, 'The keyboard stores one scene (the one you Save). Warm Desk is the factory look. Keep as many as you like here and push any of them. Scenes here live in this browser only, for this web address: use Export to move them between computers or browsers. Loading a scene never changes your halo calibration.'),
  );
}
function loadLibrary() { try { return JSON.parse(localStorage.getItem(LS_KEY + '/library') || '[]'); } catch (e) { return []; } }
function saveLibrary(l) { try { localStorage.setItem(LS_KEY + '/library', JSON.stringify(l)); } catch (e) { toast('This browser blocked local storage; use Export instead.'); } }
function downloadJson(obj, name) {
  const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })), download: name.replace(/[^\w.-]+/g, '_') + '.halo.json' });
  document.body.append(a); a.click(); a.remove();
}

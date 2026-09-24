// Halo Studio - web GUI for the Halo Composer firmware
// SPDX-License-Identifier: GPL-2.0-or-later
(() => {
'use strict';
const HC = window.HC, GEOM = window.HC_GEOM;
const { FX, SRC, AXIS, RX, ZF, SF, LF, KEY_LEDS, HALO_LEDS, LED_COUNT, ZONES, GRADIENTS, GRAD_STOPS } = HC;
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hex2 = (n) => n.toString(16).padStart(2, '0');
const rgbHex = (c) => '#' + hex2(c[0]) + hex2(c[1]) + hex2(c[2]);
const hexRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h.trim()); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// ------------------------------------------------------------------ metadata
const FX_META = [
  { id: FX.STATIC, name: 'Static', desc: 'Solid and always on at Max brightness. The calm default.', p: {} },
  { id: FX.BREATHE, name: 'Breathe', desc: 'Fades smoothly between Min and Max. Min 50% + Max 100% gives a gentle pulse that never goes dark. Spread above 0 turns it into a breathing wave that travels along the axis.', p: {} },
  { id: FX.PULSE, name: 'Heartbeat', desc: 'Two quick beats, then a rest. Min is the resting glow.', p: {} },
  { id: FX.WAVE, name: 'Wave', desc: 'A soft band of light sweeps along the axis over a dimmer (Min) background.', p: { p1: ['Band width', 0, 255] } },
  { id: FX.SATWAVE, name: 'White wave', desc: 'A band sweeps across and washes each LED toward white as it passes.', p: { p1: ['Band width', 0, 255], p2: ['Whiteness', 0, 255] } },
  { id: FX.HUE_DRIFT, name: 'Hue drift', desc: 'Every LED gently swings a little around its own hue. Subtle "living" color.', p: { p1: ['Swing', 0, 255] } },
  { id: FX.COLOR_CYCLE, name: 'Color cycle', desc: 'Rotates each LED around the color wheel while keeping its saturation and brightness. Add Spread for a rainbow sweep: Angle = pinwheel, Radial = rings, Spiral = spiral.', p: {} },
  { id: FX.FLOW, name: 'Flow', desc: 'Scrolls the color source along its axis, so gradients and rainbows glide across the board. Pair with a gradient source.', p: {} },
  { id: FX.SPARKLE, name: 'Sparkle', desc: 'Random LEDs flash to the accent color, then fade back to the Min glow.', p: { p1: ['Density', 0, 255] } },
  { id: FX.CANDLE, name: 'Candle', desc: 'Each LED flickers smoothly and independently between Min and Max, like a flame.', p: {} },
  { id: FX.RAINDROPS, name: 'Raindrops', desc: 'Random LEDs slowly fade to the accent color and back. With no accent, they shift hue instead.', p: { p1: ['Density', 0, 255], p2: ['Hue shift', 0, 255] } },
  { id: FX.COMET, name: 'Comet', desc: 'Bright heads with fading tails travel along the axis. Use the Ring axis to orbit the halo.', p: { p1: ['Tail length', 1, 255], p2: ['Comets', 1, 8] } },
  { id: FX.STROBE, name: 'Strobe', desc: 'Hard blink between Max and Min. Good for alerts, not for all day.', p: { p1: ['On time (duty)', 0, 255] } },
  { id: FX.REACT_FADE, name: 'Reactive fade', desc: 'Sits at Min until you press a key; that key jumps to Max and fades. Speed sets how long the fade lasts.', p: {} },
  { id: FX.RIPPLE, name: 'Ripple', desc: 'Every keypress sends out a ring of the accent color. Rings roll outward and reach the halo.', p: { p1: ['Ring width', 0, 255] } },
  { id: FX.HEATMAP, name: 'Heatmap', desc: 'Keys you use a lot drift toward the accent color and cool down over about 10 seconds.', p: {} },
  { id: FX.OFF, name: 'Off', desc: 'LEDs in this zone stay dark.', p: {} },
];
const SRC_NAMES = ['Painted colors (per LED)', 'Zone color', 'Gradient', 'Rainbow'];
const AXIS_NAMES = ['Left → right', 'Back → front', 'Center → out', 'Around center', 'Spiral', 'Diagonal', 'Ring (halo order)', 'None (in sync)'];
const RX_META = [
  ['None', ''], ['Flash', 'The pressed key flashes the reactive color and fades.'], ['Glow', 'A soft glow around the pressed key.'],
  ['Ripple', 'A ring expands from the pressed key and rolls into the halo.'], ['Halo echo', 'Halo LEDs closest to the pressed key light up (use on halo zones).'],
];
const cycleMs = (speed) => Math.round((65536 * 4) / (speed + 16));

// ------------------------------------------------------------------- groups
const KEYS = GEOM.keys;
const LABEL = KEYS.map((k) => k.label);
const byLabel = (...ls) => ls.map((l) => LABEL.indexOf(l)).filter((i) => i >= 0);
const HALO_GROUP = (g) => GEOM.halo.filter((h) => h.group === g).map((h) => h.led);
const GROUPS = {
  'All': range(0, 127),
  'Keys': range(0, 82),
  'Halo': range(83, 127),
  'WASD': [33, 47, 48, 49],
  'Arrows': [72, 80, 81, 82],
  'Letters': [...range(32, 41), ...range(47, 55), ...range(61, 67)],
  'Home row': range(47, 55),
  'Numbers': range(16, 28),
  'F-row': range(0, 15),
  'Mods': [29, 31, 44, 46, 58, 60, 71, 74, 75, 76, 78, 79],
  'Nav': [13, 14, 15, 30, 45, 59, 73],
  'Status bar': HALO_GROUP('status'),
  'Badge': HALO_GROUP('badge'),
  'Halo front': HALO_GROUP('front'),
  'Halo back': HALO_GROUP('back'),
  'Halo sides': [...HALO_GROUP('left'), ...HALO_GROUP('right')],
};

// ------------------------------------------------------------------ presets
const K = (k) => { // Kelvin -> rgb (Tanner Helland approximation)
  const t = k / 100; let r, g, b;
  if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307; }
  else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); b = 255; }
  return [r, g, b].map((v) => clamp(Math.round(v), 0, 255));
};
const COLOR_PRESETS = [
  ['Whites', [['Candle 1900K', K(1900)], ['Warm 2700K', K(2700)], ['Soft 3500K', K(3500)], ['Neutral 4500K', K(4500)], ['Daylight 6500K', K(6500)], ['Pure white', [255, 255, 255]]]],
  ['Warm', [['Amber', [255, 110, 16]], ['Honey', [255, 170, 40]], ['Deep WASD tone', [255, 170, 70]], ['Copper', [230, 90, 40]], ['Ember', [255, 55, 0]], ['Crimson', [255, 0, 40]]]],
  ['Cool', [['Ice', [170, 220, 255]], ['Sky', [60, 160, 255]], ['Ocean', [0, 80, 255]], ['Teal', [0, 200, 170]], ['Mint', [80, 255, 160]], ['Violet', [140, 40, 255]]]],
  ['Vivid', [['Magenta', [255, 0, 160]], ['Rose', [255, 80, 120]], ['Lime', [170, 255, 0]], ['Cyan', [0, 255, 255]], ['Gold', [255, 200, 0]], ['Off', [0, 0, 0]]]],
];
const GRAD_PRESETS = {
  'Sunset': [0, [[0, 255, 60, 0], [128, 255, 0, 90], [255, 90, 0, 255]]],
  'Aurora': [1, [[0, 0, 255, 120], [96, 0, 120, 255], [192, 160, 0, 255]]],
  'Ember': [0, [[0, 255, 40, 0], [160, 255, 140, 0], [255, 255, 220, 120]]],
  'Ocean': [1, [[0, 0, 40, 255], [128, 0, 200, 255], [255, 0, 255, 160]]],
  'Warm glow': [0, [[0, 255, 210, 160], [128, 255, 150, 50], [255, 255, 80, 10]]],
  'Fire': [0, [[0, 60, 0, 0], [90, 255, 40, 0], [180, 255, 160, 0], [255, 255, 240, 160]]],
  'Vaporwave': [1, [[0, 255, 0, 200], [110, 120, 0, 255], [200, 0, 200, 255]]],
  'Candy': [1, [[0, 255, 90, 150], [96, 255, 200, 90], [180, 120, 220, 255]]],
  'Forest': [0, [[0, 0, 60, 10], [128, 40, 160, 40], [255, 200, 255, 80]]],
  'Ice': [0, [[0, 200, 240, 255], [128, 80, 160, 255], [255, 20, 40, 160]]],
  'Spectrum': [1, [[0, 255, 0, 0], [43, 255, 255, 0], [85, 0, 255, 0], [128, 0, 255, 255], [171, 0, 0, 255], [213, 255, 0, 255]]],
  'Mono amber': [0, [[0, 40, 12, 0], [255, 255, 110, 20]]],
};
function makeGradient(name) {
  const [flags, stops] = GRAD_PRESETS[name];
  const g = HC.blankGradient(); g.flags = flags; g.count = stops.length;
  stops.forEach((s, i) => { g.stops[i] = { pos: s[0], r: s[1], g: s[2], b: s[3] }; });
  return g;
}

// ------------------------------------------------------------------- scenes
const Z = (over) => Object.assign(HC.blankZone(), over);
function paint(s, leds, rgb) { for (const i of leds) { s.color[i * 3] = rgb[0]; s.color[i * 3 + 1] = rgb[1]; s.color[i * 3 + 2] = rgb[2]; } }
function assign(s, leds, z) { for (const i of leds) s.zoneOf[i] = (s.zoneOf[i] & ~LF.ZONE_MASK) | z; }
function baseScene() { const s = HC.defaultScene(GEOM); return s; }
const SCENES = [
  { name: 'Warm Desk', note: 'Warm white keys, deeper WASD, amber halo breathing 50–100%.', names: ['Keys', 'WASD', 'Halo'], build: () => baseScene() },
  { name: 'Ember Comet', note: 'Soft warm keys; two ember comets orbit the halo; keypresses echo on the halo.', names: ['Keys', 'WASD', 'Halo'], build: () => {
    const s = baseScene(); s.grad[2] = makeGradient('Ember');
    s.zones[0] = Z({ effect: FX.STATIC, vMax: 170 });
    s.zones[2] = Z({ effect: FX.COMET, source: SRC.GRADIENT, gradient: 2, srcAxis: AXIS.RING, axis: AXIS.RING, speed: 70, vMin: 30, vMax: 255, p1: 90, p2: 2, reactive: RX.ECHO | (9 << 4), rxColor: [255, 170, 60] });
    return s; } },
  { name: 'Aurora Drift', note: 'An aurora gradient glides diagonally across keys and around the halo.', names: ['Keys', 'WASD', 'Halo'], build: () => {
    const s = baseScene(); s.grad[1] = makeGradient('Aurora');
    s.zones[0] = Z({ effect: FX.FLOW, source: SRC.GRADIENT, gradient: 1, srcAxis: AXIS.DIAG, srcScale: 16, speed: 8, vMax: 230 });
    s.zones[1] = Z({ effect: FX.BREATHE, source: SRC.ZONE, color: [255, 255, 255], vMin: 140, vMax: 255, speed: 60, axis: AXIS.NONE, spread: 0 });
    s.zones[2] = Z({ effect: FX.FLOW, source: SRC.GRADIENT, gradient: 1, srcAxis: AXIS.RING, srcScale: 16, speed: 14, vMax: 255 });
    return s; } },
  { name: 'Synthwave', note: 'Sunset keys, neon-cyan WASD pulse, vaporwave halo with soft glows on keypress.', names: ['Keys', 'WASD', 'Halo'], build: () => {
    const s = baseScene(); s.grad[0] = makeGradient('Sunset'); s.grad[3] = makeGradient('Vaporwave');
    s.zones[0] = Z({ effect: FX.STATIC, source: SRC.GRADIENT, gradient: 0, srcAxis: AXIS.Y, srcScale: 16, vMax: 220, reactive: RX.GLOW | (8 << 4), rxColor: [0, 255, 255] });
    s.zones[1] = Z({ effect: FX.BREATHE, source: SRC.ZONE, color: [0, 255, 255], vMin: 90, vMax: 255, speed: 90, axis: AXIS.NONE, spread: 0 });
    s.zones[2] = Z({ effect: FX.FLOW, source: SRC.GRADIENT, gradient: 3, srcAxis: AXIS.RING, srcScale: 32, speed: 30, vMax: 255 });
    return s; } },
  { name: 'Candlelight', note: 'Every key flickers like its own little flame; the halo glows like embers.', names: ['Keys', 'WASD', 'Halo'], build: () => {
    const s = baseScene(); paint(s, range(0, 82), [255, 140, 40]);
    s.zones[0] = Z({ effect: FX.CANDLE, vMin: 90, vMax: 230, speed: 150 });
    s.zones[1] = Z({ effect: FX.CANDLE, vMin: 120, vMax: 255, speed: 170 });
    paint(s, [33, 47, 48, 49], [255, 120, 20]);
    s.zones[2] = Z({ effect: FX.CANDLE, source: SRC.ZONE, color: [255, 70, 0], vMin: 70, vMax: 220, speed: 90 });
    return s; } },
  { name: 'Typing Ripples', note: 'Dim cool keys; every press ripples outward and echoes on the halo.', names: ['Keys', 'WASD', 'Halo'], build: () => {
    const s = baseScene(); paint(s, range(0, 82), [120, 170, 255]); assign(s, [33, 47, 48, 49], 0);
    s.zones[0] = Z({ effect: FX.STATIC, vMax: 70, reactive: RX.RIPPLE | (9 << 4), rxColor: [0, 230, 255] });
    s.zones[2] = Z({ effect: FX.WAVE, source: SRC.ZONE, color: [0, 90, 255], axis: AXIS.RING, spread: 16, p1: 140, vMin: 40, vMax: 160, speed: 20, reactive: RX.ECHO | (10 << 4), rxColor: [0, 255, 255] });
    return s; } },
  { name: 'Focus', note: 'Only the home row and arrows glow softly; everything else rests dark.', names: ['Dim keys', 'Guides', 'Halo'], build: () => {
    const s = baseScene(); assign(s, range(0, 82), 0); assign(s, [...GROUPS['Home row'], ...GROUPS['Arrows']], 1);
    paint(s, range(0, 82), K(3500));
    s.zones[0] = Z({ effect: FX.STATIC, vMax: 18 });
    s.zones[1] = Z({ effect: FX.STATIC, vMax: 150 });
    s.zones[2] = Z({ effect: FX.BREATHE, source: SRC.ZONE, color: K(2700), vMin: 20, vMax: 70, speed: 20, axis: AXIS.NONE, spread: 0 });
    return s; } },
  { name: 'Stealth', note: 'Keys stay dark until pressed, then glow and fade; the halo barely breathes.', names: ['Keys', 'WASD', 'Halo'], build: () => {
    const s = baseScene(); assign(s, [33, 47, 48, 49], 0);
    s.zones[0] = Z({ effect: FX.REACT_FADE, vMin: 0, vMax: 255, speed: 120 });
    s.zones[2] = Z({ effect: FX.BREATHE, source: SRC.ZONE, color: [255, 100, 16], vMin: 10, vMax: 90, speed: 16, axis: AXIS.NONE, spread: 0 });
    return s; } },
  { name: 'Rainbow Classic', note: 'The classic scrolling rainbow on keys, orbiting on the halo.', names: ['Keys', 'WASD', 'Halo'], build: () => {
    const s = baseScene(); assign(s, [33, 47, 48, 49], 0);
    s.zones[0] = Z({ effect: FX.FLOW, source: SRC.RAINBOW, srcAxis: AXIS.X, srcScale: 16, speed: 40 });
    s.zones[2] = Z({ effect: FX.FLOW, source: SRC.RAINBOW, srcAxis: AXIS.RING, srcScale: 16, speed: 40 });
    return s; } },
  { name: 'Heatmap', note: 'Keys warm from ice blue to amber the more you type them.', names: ['Keys', 'WASD', 'Halo'], build: () => {
    const s = baseScene(); assign(s, [33, 47, 48, 49], 0); paint(s, range(0, 82), [40, 90, 255]);
    s.zones[0] = Z({ effect: FX.HEATMAP, color: [255, 120, 0], vMin: 90, vMax: 255 });
    s.zones[2] = Z({ effect: FX.BREATHE, source: SRC.ZONE, color: [40, 90, 255], vMin: 40, vMax: 160, speed: 30, axis: AXIS.NONE, spread: 0 });
    return s; } },
  { name: 'Ocean Tide', note: 'A brightness tide rolls front to back through an ocean gradient.', names: ['Keys', 'WASD', 'Halo'], build: () => {
    const s = baseScene(); s.grad[3] = makeGradient('Ocean'); assign(s, [33, 47, 48, 49], 0);
    s.zones[0] = Z({ effect: FX.BREATHE, source: SRC.GRADIENT, gradient: 3, srcAxis: AXIS.X, axis: AXIS.Y, spread: 24, vMin: 70, vMax: 255, speed: 30, flags: ZF.REVERSE });
    s.zones[2] = Z({ effect: FX.FLOW, source: SRC.GRADIENT, gradient: 3, srcAxis: AXIS.RING, srcScale: 16, speed: 12, flags: ZF.REVERSE });
    return s; } },
];

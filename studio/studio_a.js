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
// Flags the engine is gaining; the fallbacks keep the editor working against an older hc_engine.js.
const PINGPONG = ZF.PINGPONG ?? 8;           // zone flag: motion runs forward, then back
const GF = HC.GF || { WRAP: 1, MIRROR: 2 };  // gradient flags: WRAP blends last->first, MIRROR plays the stops there and back
const pct = (v) => Math.round((v / 255) * 100) + '%';
const deg = (hueUnits) => Math.round((hueUnits * 360) / 256) + '°';
// Effect parameter sliders. The readouts and tips follow the maths in hc_engine.js.
const P_BAND = { label: 'Band width', min: 0, max: 255, fmt: (v) => Math.round((((v >> 1) + 1) * 200) / 256) + '%',
  tip: 'How wide the moving band is, as a share of one cycle: a thin line at the far left; at the far right it fills the whole cycle and becomes one smooth rolling wave.' };
const P_DENSITY = { label: 'Density', min: 0, max: 255, fmt: pct,
  tip: 'How busy it is: the chance that each LED fires in each short time slot. At 10%, about one LED in ten is lit up at any moment.' };
// p1/p2: extra sliders. lo/hi: what Min/Max bright do in this effect (null: not used).
// axis: 'spread' = the timing shifts along Effect axis by Spread; 'path' = Comet (travels along the axis); false = no axis.
// cycle: what one Speed cycle is ("... takes 8.7 s"). pp: Back and forth applies to the effect's own motion.
const FX_META = [
  { id: FX.STATIC, name: 'Static', desc: 'Solid and always on at Max brightness. The calm default.', p: {},
    lo: null, hi: 'the zone\'s brightness.', axis: false },
  { id: FX.BREATHE, name: 'Breathe', desc: 'Fades smoothly between Min and Max. Min 50% + Max 100% gives a gentle pulse that never goes dark. Spread above 0 turns it into a breathing wave that travels along the axis.', p: {},
    lo: 'the dimmest point of each breath.', hi: 'the brightest point of each breath.', axis: 'spread', cycle: 'One breath' },
  { id: FX.PULSE, name: 'Heartbeat', desc: 'Two quick beats, then a rest. Min is the resting glow.', p: {},
    lo: 'the resting glow between heartbeats.', hi: 'the peak of the first beat (the second beat reaches about two-thirds of the way up).', axis: 'spread', cycle: 'One heartbeat (two beats and a rest)' },
  { id: FX.WAVE, name: 'Wave', desc: 'A soft band of light sweeps along the axis over a dimmer (Min) background.', p: { p1: P_BAND },
    lo: 'the background outside the band.', hi: 'the brightness at the middle of the band.', axis: 'spread', cycle: 'One sweep of the band', pp: true },
  { id: FX.SATWAVE, name: 'White wave', desc: 'A band sweeps across and washes each LED toward white as it passes.',
    p: { p1: P_BAND, p2: { label: 'Whiteness', min: 0, max: 255, fmt: pct, tip: 'How white the middle of the band gets: 0% leaves the colors as they are, 100% turns them pure white.' } },
    lo: null, hi: 'the zone\'s brightness.', axis: 'spread', cycle: 'One sweep of the band', pp: true },
  { id: FX.HUE_DRIFT, name: 'Hue drift', desc: 'Every LED gently swings a little around its own hue. Subtle "living" color.',
    p: { p1: { label: 'Swing', min: 0, max: 255, fmt: (v) => '±' + deg(Math.trunc((127 * v) / 128)), tip: 'How far each LED\'s hue swings to either side of its own color, in degrees around the color wheel. Small values give a subtle shimmer; the far right swings almost all the way round.' } },
    lo: null, hi: 'the zone\'s brightness.', axis: 'spread', cycle: 'One full swing' },
  { id: FX.COLOR_CYCLE, name: 'Color cycle', desc: 'Rotates each LED around the color wheel while keeping its saturation and brightness. Add Spread for a rainbow sweep: Angle = pinwheel, Radial = rings, Spiral = spiral.', p: {},
    lo: null, hi: 'the zone\'s brightness.', axis: 'spread', cycle: 'One trip around the color wheel', pp: true },
  { id: FX.FLOW, name: 'Flow', desc: 'Scrolls the color source along its axis, so gradients and rainbows glide across the board. Pair with a gradient source.', p: {},
    lo: null, hi: 'the zone\'s brightness.', axis: false, cycle: 'One full scroll of the colors', pp: true },
  { id: FX.SPARKLE, name: 'Sparkle', desc: 'Random LEDs flash to the accent color, then fade back to the Min glow.', p: { p1: P_DENSITY },
    lo: 'the background glow between sparkles.', hi: 'the brightness of each sparkle.', axis: false },
  { id: FX.CANDLE, name: 'Candle', desc: 'Each LED flickers smoothly and independently between Min and Max, like a flame.', p: {},
    lo: 'the dimmest a flicker gets.', hi: 'the brightest a flicker gets.', axis: false },
  { id: FX.RAINDROPS, name: 'Raindrops', desc: 'Random LEDs slowly fade to the accent color and back. With no accent, they shift hue instead.',
    p: { p1: P_DENSITY, p2: { label: 'Hue shift', min: 0, max: 255, fmt: deg, tip: 'Only used when Accent color is black: each drop then turns the LED\'s own color this far around the color wheel, instead of blending to an accent color.' } },
    lo: null, hi: 'the brightness of the zone and of the drops.', axis: false },
  { id: FX.COMET, name: 'Comet', desc: 'Bright heads with fading tails travel along the axis. Use the Ring axis to orbit the halo.',
    p: { p1: { label: 'Tail length', min: 1, max: 255, fmt: pct, tip: 'How long each comet\'s tail is, as a share of the whole trip along the axis. If it is longer than the gap between comets, the tails join up.' },
      p2: { label: 'Comets', min: 1, max: 8, tip: 'How many comets travel at once, evenly spaced (1 to 8).' } },
    lo: 'the background behind the comets.', hi: 'the brightness of each comet\'s head.', axis: 'path', cycle: 'Each comet\'s trip along the axis', pp: true },
  { id: FX.STROBE, name: 'Strobe', desc: 'Hard blink between Max and Min. Good for alerts, not for all day.',
    p: { p1: { label: 'On time (duty)', min: 0, max: 255, fmt: pct, tip: 'The share of each blink spent at Max bright. 50% means on half the time and at Min the other half.' } },
    lo: 'the brightness during the "off" part of each blink.', hi: 'the brightness during the "on" part.', axis: 'spread', cycle: 'One blink' },
  { id: FX.REACT_FADE, name: 'Reactive fade', desc: 'Sits at Min until you press a key; that key jumps to Max and fades. Speed sets how long the fade lasts.', p: {},
    lo: 'the brightness at rest, before a key is pressed.', hi: 'the brightness a key jumps to when pressed.', axis: false },
  { id: FX.RIPPLE, name: 'Ripple', desc: 'Every keypress sends out a ring of the accent color. Min bright is the resting brightness, Max bright the ring. Reach sets how far rings travel before fading (slide fully left for the whole board). Rings reach any halo LEDs in the same zone.',
    p: { p1: { label: 'Ring width', min: 0, max: 255, fmt: (v) => `${(((v >> 3) + 2) / 12).toFixed(1)} keys`, tip: 'How thick each ring is: how far it fades out on either side of its center, from about 0.2 keys (far left) to 2.75 keys (far right).' },
      p2: { label: 'Reach', min: 1, max: 255, fmt: (v) => (v < 2 ? 'whole board' : `${(v / 12).toFixed(1)} keys`), tip: 'How far rings travel before they fade out, in keys. Slide fully left for the whole board: rings then fade out over 1.5 seconds instead.' } },
    lo: 'the resting brightness between keypresses.', hi: 'the brightness of the rings.', axis: false },
  { id: FX.HEATMAP, name: 'Heatmap', desc: 'Keys you use a lot drift toward the accent color and cool down over about 10 seconds.', p: {},
    lo: 'keys you haven\'t pressed lately (their own color).', hi: 'the hottest keys (the accent color).', axis: false },
  { id: FX.OFF, name: 'Off', desc: 'LEDs in this zone stay dark.', p: {}, lo: null, hi: null, axis: false },
];
const SRC_NAMES = ['Painted colors (per LED)', 'Zone color', 'Gradient', 'Rainbow'];
const AXIS_NAMES = ['Left → right', 'Back → front', 'Center → out', 'Around center', 'Spiral', 'Diagonal', 'Ring (halo order)', 'None (in sync)'];
const RX_META = [
  ['None', ''], ['Flash', 'The pressed key itself flashes the reaction color and fades.'], ['Glow', 'A soft glow lights the keys around the pressed one, fading with distance.'],
  ['Ripple', 'A ring expands from the pressed key. It shows on every LED in this zone: give the halo\'s zone a Ripple too to carry it into the halo.'], ['Halo echo', 'Halo LEDs in the direction of the pressed key (seen from the keyboard\'s center) light up. Only halo LEDs react, so use it on halo zones.'],
];

// Speed. Most effects turn the stored byte into a cycle of 262144 / (speed + 16) ms:
// 16.4 s at 0, 1.8 s at 128, 0.97 s at 255 (phase16 in hc_engine.js). Step times of the
// random effects and the Ripple/Reactive fade formulas are further down, in speedSpec().
const cycleExact = (speed) => 262144 / (speed + 16);
const CYCLE_SLOW = cycleExact(0), CYCLE_FAST = cycleExact(255);
// The Speed slider moves linearly through cycle *time*, not through the byte (which would
// spend most of its travel below 2 s). SPEED_STEPS positions from slowest to fastest; each
// is converted to the nearest byte. The byte is coarse at the slow end (0 -> 16.4 s,
// 1 -> 15.4 s, 2 -> 14.6 s: roughly 1 s steps), because the firmware stores a single byte,
// so the time shown (always the byte's real time) jumps there.
const SPEED_STEPS = 1000;
const speedPos = (speed) => Math.round(((CYCLE_SLOW - cycleExact(speed)) / (CYCLE_SLOW - CYCLE_FAST)) * SPEED_STEPS);
const posSpeed = (pos) => clamp(Math.round(262144 / (CYCLE_SLOW - (pos / SPEED_STEPS) * (CYCLE_SLOW - CYCLE_FAST)) - 16), 0, 255);
const fmtMs = (ms) => (Math.round(ms) < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(ms < 9995 ? 2 : 1)} s`);
const reactFadeMs = (speed) => 150 + (255 - speed) * 12;                  // FX_REACT_FADE
const rippleKps = (speed) => ((16 + (speed >> 1)) * 1000) / 256 / 12;      // FX_RIPPLE ring radius growth, keys per second
const fmtKps = (speed) => { const v = rippleKps(speed); return v < 10 ? v.toFixed(1) : String(Math.round(v)); };
// Back and forth works on these motions (plus Breathe with Spread > 0, and any colour scroll).
const ppOwn = (z) => !!FX_META[z.effect]?.pp || (z.effect === FX.BREATHE && z.spread > 0);
const ppApplies = (z) => z.effect !== FX.OFF && (ppOwn(z) || !!(z.flags & ZF.SRC_SCROLL));

// ------------------------------------------------------------ hover help
// Shown on mouse-over / keyboard focus of anything with data-tip (see the tooltip code in studio_e.js).
const TIP = {
  // stage and header
  tool: 'What a click on the drawing does: select LEDs, paint them, pick up a color, or press keys to try keypress effects.',
  toolSelect: 'Click an LED or drag a box to select. Shift adds to the selection, Alt removes, Ctrl (Cmd on a Mac) toggles.',
  toolPaint: 'Click or drag across LEDs to paint them with the current color from the Paint tab.',
  toolPick: 'Click an LED to make its painted color the current color. Studio then switches to Paint.',
  toolType: 'Click keys, or type on your computer\'s keyboard, to fake keypresses and try reactions. When connected with Composer on, the keyboard reacts too.',
  show: 'What the drawing shows. This only changes the view, not the scene.',
  showLive: 'The animated preview, worked out with the same maths as the keyboard.',
  showBase: 'Each LED\'s starting color with no effect or brightness applied: its painted color, or the zone color when the zone\'s Source is Zone color.',
  showZones: 'Prints each LED\'s zone number on it: at the bottom of each key, and inside each halo LED.',
  select: 'Quick ways to select groups of LEDs. Shift-click a button to add to the selection, Alt-click to remove.',
  preview: 'These only change the preview on this screen, never the keyboard.',
  animate: 'Plays or pauses the preview animation.',
  typing: 'Fakes random keypresses in the preview, so you can watch keypress effects without typing.',
  keyBright: 'Stands in for the keyboard\'s key brightness (Fn+↑/↓), which scales every key LED. Preview only.',
  haloLevel: 'Stands in for the halo brightness keys (Fn+M+↑/↓): 6 steps, 0, 19, 38, 56, 78 and 100%. Preview only. With "Halo follows key brightness" on (Device tab), the halo uses Key brightness instead.',
  livePush: 'Sends each change to the keyboard\'s temporary memory (RAM) a moment after you make it, so you see it on the keys. Nothing is permanent until Save to keyboard.',
  connect: 'Connects to the keyboard over the USB cable (desktop Chrome or Edge, switch set to wired). Close VIA first.',
  revert: 'Throws away unsaved changes and reloads the scene saved on the keyboard.',
  save: 'Writes the current scene to the keyboard\'s permanent memory (EEPROM), so it survives unplugging. The keyboard keeps one saved scene.',
  // Paint
  color: 'The current color. Fill selection, the Paint brush and gradient stops start from it.',
  hue: 'Where the color sits on the color wheel: 0 red, about 43 yellow, 85 green, 128 cyan, 171 blue, 213 magenta.',
  sat: 'How colorful: 0% is white or gray, 100% is the pure color.',
  bright: 'How bright the color is. 0% is black, which means off.',
  whites: 'Color temperatures from candlelight (1900K) to daylight (6500K), plus pure white.',
  apply: 'These change the painted colors of the selected LEDs. They show wherever a zone\'s Source is "Painted colors".',
  fill: 'Paints every selected LED with the current color.',
  darker: 'Makes the selected LEDs\' painted colors 15% darker.',
  lighter: 'Makes the selected LEDs\' painted colors 15% brighter (up to full brightness).',
  brush: 'Switches the Tool to Paint: click or drag on the drawing to paint.',
  dropper: 'Switches the Tool to Eyedropper: click an LED to pick up its color.',
  bake: 'Paints a gradient into the selected LEDs as fixed colors, stretched so it starts at one end of the selection and ends at the other.',
  bakeSlot: 'Which of the 4 gradients to paint. Edit them on the Gradients tab.',
  bakeDir: 'The direction the gradient runs across the selection.',
  bakeBtn: 'Writes the colors now. They stay put: for a moving gradient, set a zone\'s Source to Gradient instead.',
  selFlags: 'Per-LED switches for the selected LEDs.',
  noReact: 'The selected LEDs skip their zone\'s keypress overlay (Flash, Glow, Ripple, Halo echo). Effects that react to keys themselves, such as Ripple and Reactive fade, still do.',
  react: 'Undoes "Ignore keypress overlays" for the selected LEDs.',
  // Zones
  zones: 'Every LED belongs to one of 8 zones. Each zone has its own effect, speed, brightness range and colors.',
  putInZone: 'Moves the selected LEDs into this zone, so they take on its effect and colors. An LED is in exactly one zone.',
  selZone: 'Selects every LED in this zone.',
  showZoneNums: 'Switches the drawing to the Zones view, which prints each LED\'s zone number on it.',
  name: 'A label for this zone, shown on its card. Studio keeps it in this browser and in exported scene files; the keyboard doesn\'t store names.',
  effect: 'The animation this zone runs. Most effects only change the brightness or hue of the zone\'s colors (see Source), so your colors show through. Sparkle, Raindrops, Ripple and Heatmap also blend toward the Accent color.',
  axis: 'The direction the effect travels: Left → right, Back → front, Center → out (rings), Around center (a pinwheel), Spiral, Diagonal, Ring (around the halo; keys use their angle from the center) or None (every LED in step).',
  spread: 'How much the timing shifts along the Effect axis. 1.00× puts one full cycle from one end to the other (one wave on the board at a time), 2.00× two, and 0 keeps every LED in step.',
  reverse: 'Runs the motion the other way along its axis, and scrolls colors the other way.',
  mirror: 'Folds the axis at its middle so the pattern is symmetric. On Left → right, a wave then runs in from both sides to the middle (out from the middle with Reverse). It folds the Color axis too.',
  pingpong: 'Instead of jumping back to the start each cycle, the motion runs forward, then backward. The pace doesn\'t change, so there and back takes two cycles.',
  ppWorks: 'It works with Wave, White wave, Color cycle, Flow and Comet, with Breathe when Spread is above 0, and with Scroll colors too.',
  scroll: 'Also slides the gradient or rainbow along the Color axis, one full pass per Speed cycle. Only does something when Source is Gradient or Rainbow. Flow always scrolls.',
  colors: 'Where this zone\'s colors come from. The effect then animates them.',
  source: 'Where the zone\'s colors come from: Painted colors (each LED\'s own color, from the Paint tab), Zone color (one color for the whole zone), Gradient (one of the 4 gradients, laid along the Color axis) or Rainbow (the color wheel along the Color axis).',
  zoneGrad: 'Which of the 4 gradients this zone uses. Edit them on the Gradients tab.',
  srcAxis: 'The direction the gradient or rainbow is laid out across the zone\'s LEDs. Same choices as Effect axis; None gives every LED the gradient\'s first color.',
  srcScale: 'How many times the gradient or rainbow fits along the Color axis: 1.00× once end to end, 2.00× twice (it repeats), 0.50× only the first half shows.',
  zoneColor: 'The one color every LED in this zone uses (Source is Zone color).',
  accent: 'The color Sparkle, Raindrops, Ripple and Heatmap blend toward. Black means each LED uses its own color (Raindrops then shifts the hue instead, by Hue shift).',
  overlay: 'A reaction drawn on top of the effect when you press a key. It works with any effect. Keypresses anywhere on the board count.',
  reaction: 'What happens on a keypress: None, Flash (the pressed key flashes), Glow (keys around it light up), Ripple (a ring spreads out from it) or Halo echo (halo LEDs in its direction light up).',
  fade: 'How long the reaction lasts: 2.0 s at the far left, 0.2 s at the far right.',
  rxColor: 'The color the reaction blends toward. Black means white.',
  // Gradients
  gradSlots: 'The scene stores 4 gradients. A zone whose Source is Gradient picks one of them.',
  gradPreset: 'Loads a ready-made gradient into this slot, replacing its stops.',
  stopColor: 'This stop\'s color. Click to change it.',
  stopPos: 'Where this color sits along the gradient, from 0% (start) to 100% (end). Colors blend smoothly between stops.',
  addStop: 'Adds another color stop after the last one (up to 6).',
  gradMirror: 'Plays the stops forward and then back again across the gradient, so it ends on the color it started with (A→B→C→B→A). Scrolling or orbiting the halo then never jumps.',
  gradWrap: 'The space after the last stop blends back into the first color, so a scrolling gradient loops without a jump. Handy for rainbows. Leave some room after the last stop for the blend.',
  gradReverse: 'Flips the gradient end to end.',
  // Effects, Scenes
  useFx: 'Switches the zone you are editing on the Zones tab to this effect.',
  starters: 'Ready-made looks. Loading one replaces the editor\'s scene (your halo calibration is kept) and, with Live push on, sends it to the keyboard. Save to keyboard keeps it.',
  myScenes: 'Scenes saved in this browser only, for this web address. Use Export to move them to another computer or browser.',
  saveCurrent: 'Saves the editor\'s scene to the list below under the name you typed.',
  loadScene: 'Loads this scene into the editor (and onto the keyboard, with Live push on). Your halo calibration is kept.',
  exportScene: 'Downloads this scene as a .halo.json file.',
  deleteScene: 'Removes this scene from this browser\'s list.',
  exportCurrent: 'Downloads the editor\'s scene as a .halo.json file.',
  importFile: 'Loads a .halo.json scene file into the editor. Your halo calibration is kept.',
  // Halo setup
  placeLeds: 'Tells Studio where each halo LED really is, so waves, comets and ripples line up with the keyboard.',
  ledNum: 'Which halo LED you are placing, counting from the status bar.',
  area: 'The part of the halo this LED belongs to.',
  position: 'Where this LED sits in the keyboard\'s coordinate grid: across from 0 (left) to 224 (right), and from 0 (back) to 64 (front).',
  startPlacing: 'Lights one halo LED at a time on the keyboard. Click where it is on the drawing and the next one lights up.',
  prevLed: 'Goes back to the previous halo LED.',
  skipLed: 'Moves on to the next halo LED without changing this one.',
  checkOrder: 'The ring order is the path around the halo that comets and the Ring axis follow.',
  walkRing: 'Lights the halo one LED at a time in ring order, on the keyboard and in the preview. It should go smoothly round.',
  recompute: 'Works out the ring order again from the LED positions, going round the outline.',
  builtIn: 'Puts every halo LED back at the positions measured on the developer\'s Halo75 V2.',
  // Device
  connection: 'The keyboard Studio is talking to.',
  composerOnOff: 'Does the same as Fn+Enter: switches the keyboard\'s lighting to Composer, or back to the stock effect it was on.',
  readKb: 'Loads the keyboard\'s current scene into the editor. The editor\'s scene is backed up to My scenes first.',
  pushKb: 'Sends the whole editor scene to the keyboard\'s temporary memory. Useful with Live push off. Save to keep it.',
  factory: 'Loads the factory look (Warm Desk) but keeps your halo calibration. Save to keep it.',
  sceneOpts: 'Settings saved with the scene that affect every zone.',
  gamma: 'On: colors and brightness levels look on the keys the way they look on screen (the factory look uses this). Off: raw LED values, which look whiter and brighter than on screen.',
  haloFollows: 'On: the halo follows the key brightness keys (Fn+↑/↓) and ignores Fn+M+↑/↓ while Composer runs.',
  fps: 'Counts how many frames the keyboard draws in 2 seconds. 25 fps or more is normal.',
  hidLog: 'The USB messages between Studio and the keyboard. Useful when reporting a problem.',
};
const GROUP_TIPS = {
  'Halo': 'Every LED around the edge of the keyboard, including the status bar.',
  'Mods': 'Backspace, Tab, \\, Caps Lock, Enter, both Shifts, Ctrl, Opt, both Cmds and Fn.',
  'Nav': 'PrtSc, Del, Ins, Home, End, PgUp and PgDn.',
  'Status bar': 'The 5 small LEDs at the back left. The keyboard\'s own indicators, such as Caps Lock, draw on top of them.',
  'Halo front': 'The halo LEDs along the front edge, plus the short 3-LED strip between the Fn and ← keys.',
  'Halo back': 'The halo LEDs along the back edge.',
  'Halo sides': 'The halo LEDs on the left and right ends.',
};
const AREA_NAMES = { status: 'Status bar', strip: 'Strip between Fn and ←', front: 'Front edge', left: 'Left side', back: 'Back edge', right: 'Right side' };

// ------------------------------------------------------------------- groups
const KEYS = GEOM.keys;
const LABEL = KEYS.map((k) => k.label);
const byLabel = (...ls) => ls.map((l) => LABEL.indexOf(l)).filter((i) => i >= 0);
// Halo LEDs with no LED fitted (geometry.json "absent"): hidden, skipped by calibration and quick-selects.
const ABSENT = new Set(GEOM.halo.filter((h) => h.absent).map((h) => h.led));
const fitted = (leds) => leds.filter((l) => !ABSENT.has(l));
const HALO_GROUP = (g) => fitted(GEOM.halo.filter((h) => h.group === g).map((h) => h.led));
const GROUPS = {
  'All': fitted(range(0, 127)),
  'Keys': range(0, 82),
  'Halo': fitted(range(83, 127)),
  'WASD': [33, 47, 48, 49],
  'Arrows': [72, 80, 81, 82],
  'Letters': [...range(32, 41), ...range(47, 55), ...range(61, 67)],
  'Home row': range(47, 55),
  'Numbers': range(16, 28),
  'F-row': range(0, 15),
  'Mods': [29, 31, 44, 46, 58, 60, 71, 74, 75, 76, 78, 79],
  'Nav': [13, 14, 15, 30, 45, 59, 73],
  'Status bar': HALO_GROUP('status'),
  'Halo front': [...HALO_GROUP('front'), ...HALO_GROUP('strip')],
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
  ['Cool', [['Ice', [170, 220, 255]], ['Sky', [60, 160, 255]], ['Ocean', [0, 80, 255]], ['Teal', [0, 200, 170]], ['Mint', [112, 255, 148]], ['Violet', [140, 40, 255]]]],
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
// Starter scenes build on the original neutral base (warm white keys, WASD zone,
// amber halo, raw LED values) so they look the same as before the default changed.
function baseScene() {
  const s = HC.defaultScene(GEOM); s.flags = 0;
  paint(s, range(0, 82), [255, 200, 140]); paint(s, range(83, 127), [255, 100, 16]); assign(s, range(0, 82), 0);
  paint(s, [33, 47, 48, 49], [255, 170, 70]); assign(s, [33, 47, 48, 49], 1);
  s.zones[1] = Z({ effect: FX.STATIC, vMax: 200 });
  s.zones[2] = Z({ effect: FX.BREATHE, source: SRC.ZONE, color: [255, 100, 16], vMin: 128, vMax: 255, speed: 40, axis: AXIS.NONE, spread: 0 });
  return s;
}
const SCENES = [
  { name: 'Warm Desk', note: 'The factory look: 2700K keys that flash mint and send a short mint ripple when pressed; 2700K halo breathing 30–100%.', names: ['Keys', 'Zone 2', 'Halo'], build: () => HC.defaultScene(GEOM) },
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

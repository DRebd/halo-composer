// Halo Composer - JavaScript twin of hc_engine.c (bit-exact).
// SPDX-License-Identifier: GPL-2.0-or-later
// Used by Halo Studio for the live preview and by tests/parity_test.mjs.
// Every integer operation mirrors the C code; keep both files in sync.
(function (root) {
  'use strict';

  const KEY_LEDS = 83, HALO_LEDS = 45, LED_COUNT = 128;
  const ZONES = 8, GRADIENTS = 4, GRAD_STOPS = 6, MAX_HITS = 8;
  const MAGIC = 0xC7, SCENE_VERSION = 1;
  const CX = 112, CY = 32;
  const ZONE_BYTES = 20, GRAD_BYTES = 2 + GRAD_STOPS * 4;
  const SCENE_BYTES = 4 + LED_COUNT * 3 + LED_COUNT + ZONES * ZONE_BYTES + GRADIENTS * GRAD_BYTES + HALO_LEDS * 2 + HALO_LEDS;

  const FX = { STATIC: 0, BREATHE: 1, PULSE: 2, WAVE: 3, SATWAVE: 4, HUE_DRIFT: 5, COLOR_CYCLE: 6, FLOW: 7, SPARKLE: 8, CANDLE: 9, RAINDROPS: 10, COMET: 11, STROBE: 12, REACT_FADE: 13, RIPPLE: 14, HEATMAP: 15, OFF: 16, COUNT: 17 };
  const SRC = { MAP: 0, ZONE: 1, GRADIENT: 2, RAINBOW: 3, COUNT: 4 };
  const AXIS = { X: 0, Y: 1, RADIAL: 2, ANGLE: 3, SPIRAL: 4, DIAG: 5, RING: 6, NONE: 7, COUNT: 8 };
  const RX = { NONE: 0, FLASH: 1, GLOW: 2, RIPPLE: 3, ECHO: 4, COUNT: 5 };
  const ZF = { REVERSE: 1, SRC_SCROLL: 2, MIRROR: 4, PINGPONG: 8 }; // PINGPONG = "back and forth"
  const GF = { WRAP: 1, MIRROR: 2 }; // gradient.flags
  const SF = { GAMMA: 1, HALO_FOLLOWS_KEYS: 2 };
  const LF = { ZONE_MASK: 7, NO_REACT: 0x80 };

  const GAMMA22 = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,3,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6,7,7,7,8,8,8,9,9,9,10,10,11,11,11,12,12,13,13,13,14,14,15,15,16,16,17,17,18,18,19,19,20,20,21,22,22,23,23,24,25,25,26,26,27,28,28,29,30,30,31,32,33,33,34,35,35,36,37,38,39,39,40,41,42,43,43,44,45,46,47,48,49,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,73,74,75,76,77,78,79,81,82,83,84,85,87,88,89,90,91,93,94,95,97,98,99,100,102,103,105,106,107,109,110,111,113,114,116,117,119,120,121,123,124,126,127,129,130,132,133,135,137,138,140,141,143,145,146,148,149,151,153,154,156,158,159,161,163,165,166,168,170,172,173,175,177,179,181,182,184,186,188,190,192,194,196,197,199,201,203,205,207,209,211,213,215,217,219,221,223,225,227,229,231,234,236,238,240,242,244,246,248,251,253,255];
  const B_M16 = [0, 49, 49, 41, 90, 27, 117, 10];

  // ---------------------------------------------------------------- helpers
  const scale8 = (i, s) => (i * (1 + s)) >> 8;
  const qadd8 = (a, b) => Math.min(255, a + b);
  const qsub8 = (a, b) => (a > b ? a - b : 0);
  const lerp8 = (a, b, f) => (b >= a ? a + scale8(b - a, f) : a - scale8(a - b, f));
  function sin8(theta) {
    theta &= 0xFF;
    let offset = theta;
    if (theta & 0x40) offset = 255 - offset;
    offset &= 0x3F;
    let secoffset = offset & 0x0F;
    if (theta & 0x40) secoffset++;
    const section = offset >> 4;
    const b = B_M16[section * 2], m16 = B_M16[section * 2 + 1];
    const mx = (m16 * secoffset) >> 4;
    let y = mx + b;
    if (theta & 0x80) y = -y;
    return (y + 128) & 0xFF;
  }
  const tri8 = (u) => (u < 128 ? (u * 2) & 0xFF : ((255 - u) * 2) & 0xFF);
  function hash32(x) {
    x = x >>> 0;
    x ^= x >>> 16; x = Math.imul(x, 0x7feb352d) >>> 0;
    x ^= x >>> 15; x = Math.imul(x, 0x846ca68b) >>> 0;
    x ^= x >>> 16;
    return x >>> 0;
  }
  const phase16 = (t, speed) => Math.floor((t * (speed + 16)) / 4) % 65536;
  const phase32 = (t, speed) => Math.floor((t * (speed + 16)) / 4) % 4294967296;
  function atan2_8(dy, dx) {
    if (dx === 0 && dy === 0) return 0;
    const ax = Math.abs(dx), ay = Math.abs(dy);
    let a;
    if (ax >= ay) a = Math.floor((ay * 32) / ax);
    else a = 64 - Math.floor((ax * 32) / ay);
    a &= 0xFF;
    if (dx < 0) a = (128 - a) & 0xFF;
    if (dy < 0) a = (256 - a) & 0xFF;
    return a;
  }
  function isqrt32(n) {
    n = n >>> 0;
    let res = 0, bit = 1 << 30;
    while (bit > n) bit = bit >>> 2;
    while (bit) {
      if (n >= res + bit) { n = n - (res + bit); res = (res >>> 1) + bit; }
      else res = res >>> 1;
      bit = bit >>> 2;
    }
    return res & 0xFFFF;
  }
  function hsv2rgb(h, s, v, out) {
    if (s === 0) { out[0] = out[1] = out[2] = v; return out; }
    const region = Math.floor(h / 43);
    const rem = ((h - region * 43) * 6) & 0xFF;
    const p = (v * (255 - s)) >> 8;
    const q = (v * (255 - ((s * rem) >> 8))) >> 8;
    const t = (v * (255 - ((s * (255 - rem)) >> 8))) >> 8;
    switch (region) {
      case 0: out[0] = v; out[1] = t; out[2] = p; break;
      case 1: out[0] = q; out[1] = v; out[2] = p; break;
      case 2: out[0] = p; out[1] = v; out[2] = t; break;
      case 3: out[0] = p; out[1] = q; out[2] = v; break;
      case 4: out[0] = t; out[1] = p; out[2] = v; break;
      default: out[0] = v; out[1] = p; out[2] = q; break;
    }
    return out;
  }
  function rgb2hsv(c, out) {
    const r = c[0], g = c[1], b = c[2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    out[2] = mx;
    if (mx === 0) { out[0] = 0; out[1] = 0; return out; }
    const d = mx - mn;
    out[1] = Math.floor((255 * d) / mx);
    if (d === 0) { out[0] = 0; return out; }
    let h;
    if (mx === r) h = Math.trunc((43 * (g - b)) / d);
    else if (mx === g) h = 85 + Math.trunc((43 * (b - r)) / d);
    else h = 171 + Math.trunc((43 * (r - g)) / d);
    out[0] = h & 0xFF;
    return out;
  }
  const _hsv = [0, 0, 0];
  function hueShift(c, off) {
    off &= 0xFF;
    if (off === 0) return;
    rgb2hsv(c, _hsv);
    hsv2rgb((_hsv[0] + off) & 0xFF, _hsv[1], _hsv[2], c);
  }
  function scaleRgb(c, v) { c[0] = scale8(c[0], v); c[1] = scale8(c[1], v); c[2] = scale8(c[2], v); }
  function lerpRgb(a, b, f) { a[0] = lerp8(a[0], b[0], f); a[1] = lerp8(a[1], b[1], f); a[2] = lerp8(a[2], b[2], f); }
  const isBlack = (c) => (c[0] | c[1] | c[2]) === 0;

  function gradSample(g, pos, out) {
    // GF.MIRROR: fold the position first (palindrome A B C D C B A); exactly as hc_grad_sample()
    if (g.flags & GF.MIRROR) { const m = pos < 128 ? pos : 255 - pos; pos = (m * 515) >> 8; }
    let n = Math.min(g.count, GRAD_STOPS);
    if (n === 0) { out[0] = out[1] = out[2] = 0; return out; }
    const st = g.stops;
    if (n === 1) { out[0] = st[0].r; out[1] = st[0].g; out[2] = st[0].b; return out; }
    const wrap = (g.flags & GF.WRAP) !== 0;
    let i = 0;
    while (i < n && st[i].pos <= pos) i++;
    let a, b, span, off;
    if (i === 0) {
      if (!wrap) { out[0] = st[0].r; out[1] = st[0].g; out[2] = st[0].b; return out; }
      a = st[n - 1]; b = st[0]; span = 256 - a.pos + b.pos; off = 256 - a.pos + pos;
    } else if (i === n) {
      if (!wrap) { out[0] = st[n - 1].r; out[1] = st[n - 1].g; out[2] = st[n - 1].b; return out; }
      a = st[n - 1]; b = st[0]; span = 256 - a.pos + b.pos; off = pos - a.pos;
    } else {
      a = st[i - 1]; b = st[i]; span = b.pos - a.pos; off = pos - a.pos;
    }
    const f = span ? Math.floor((off * 255) / span) & 0xFF : 0;
    out[0] = lerp8(a.r, b.r, f); out[1] = lerp8(a.g, b.g, f); out[2] = lerp8(a.b, b.b, f);
    return out;
  }

  // effects whose time phase ZF.PINGPONG turns into a triangle (as pingpong_fx() in C)
  function pingpongFx(z) {
    switch (z.effect) {
      case FX.WAVE: case FX.SATWAVE: case FX.COLOR_CYCLE: case FX.FLOW: case FX.COMET: return true;
      case FX.BREATHE: return z.spread !== 0;
      default: return false;
    }
  }

  // ------------------------------------------------------------ scene I/O
  function blankZone() {
    return { effect: 0, speed: 128, vMin: 0, vMax: 255, axis: 0, spread: 16, p1: 96, p2: 1, flags: 0, source: 0, srcAxis: 0, srcScale: 16, gradient: 0, reactive: 0, color: [0, 0, 0], rxColor: [0, 0, 0] };
  }
  function blankGradient() {
    const stops = [];
    for (let i = 0; i < GRAD_STOPS; i++) stops.push({ pos: 0, r: 0, g: 0, b: 0 });
    return { count: 0, flags: 0, stops };
  }
  function blankScene() {
    const zones = [], grad = [];
    for (let i = 0; i < ZONES; i++) zones.push(blankZone());
    for (let i = 0; i < GRADIENTS; i++) grad.push(blankGradient());
    return { magic: MAGIC, version: SCENE_VERSION, flags: 0, reserved: 0, color: new Uint8Array(LED_COUNT * 3), zoneOf: new Uint8Array(LED_COUNT), zones, grad, haloXY: new Uint8Array(HALO_LEDS * 2), haloRing: new Uint8Array(HALO_LEDS) };
  }
  function zoneToBytes(z, b, o) {
    b[o] = z.effect; b[o + 1] = z.speed; b[o + 2] = z.vMin; b[o + 3] = z.vMax; b[o + 4] = z.axis; b[o + 5] = z.spread;
    b[o + 6] = z.p1; b[o + 7] = z.p2; b[o + 8] = z.flags; b[o + 9] = z.source; b[o + 10] = z.srcAxis; b[o + 11] = z.srcScale;
    b[o + 12] = z.gradient; b[o + 13] = z.reactive; b[o + 14] = z.color[0]; b[o + 15] = z.color[1]; b[o + 16] = z.color[2];
    b[o + 17] = z.rxColor[0]; b[o + 18] = z.rxColor[1]; b[o + 19] = z.rxColor[2];
  }
  function zoneFromBytes(b, o) {
    return { effect: b[o], speed: b[o + 1], vMin: b[o + 2], vMax: b[o + 3], axis: b[o + 4], spread: b[o + 5], p1: b[o + 6], p2: b[o + 7], flags: b[o + 8], source: b[o + 9], srcAxis: b[o + 10], srcScale: b[o + 11], gradient: b[o + 12], reactive: b[o + 13], color: [b[o + 14], b[o + 15], b[o + 16]], rxColor: [b[o + 17], b[o + 18], b[o + 19]] };
  }
  function gradToBytes(g, b, o) {
    b[o] = g.count; b[o + 1] = g.flags;
    for (let i = 0; i < GRAD_STOPS; i++) { const s = g.stops[i] || { pos: 0, r: 0, g: 0, b: 0 }; b[o + 2 + i * 4] = s.pos; b[o + 3 + i * 4] = s.r; b[o + 4 + i * 4] = s.g; b[o + 5 + i * 4] = s.b; }
  }
  function gradFromBytes(b, o) {
    const stops = [];
    for (let i = 0; i < GRAD_STOPS; i++) stops.push({ pos: b[o + 2 + i * 4], r: b[o + 3 + i * 4], g: b[o + 4 + i * 4], b: b[o + 5 + i * 4] });
    return { count: b[o], flags: b[o + 1], stops };
  }
  const OFF_COLOR = 4, OFF_ZONEOF = OFF_COLOR + LED_COUNT * 3, OFF_ZONES = OFF_ZONEOF + LED_COUNT,
    OFF_GRAD = OFF_ZONES + ZONES * ZONE_BYTES, OFF_HXY = OFF_GRAD + GRADIENTS * GRAD_BYTES, OFF_HRING = OFF_HXY + HALO_LEDS * 2;
  function sceneToBytes(s) {
    const b = new Uint8Array(SCENE_BYTES);
    b[0] = s.magic; b[1] = s.version; b[2] = s.flags; b[3] = s.reserved || 0;
    b.set(s.color, OFF_COLOR); b.set(s.zoneOf, OFF_ZONEOF);
    for (let i = 0; i < ZONES; i++) zoneToBytes(s.zones[i], b, OFF_ZONES + i * ZONE_BYTES);
    for (let i = 0; i < GRADIENTS; i++) gradToBytes(s.grad[i], b, OFF_GRAD + i * GRAD_BYTES);
    b.set(s.haloXY, OFF_HXY); b.set(s.haloRing, OFF_HRING);
    return b;
  }
  function sceneFromBytes(b) {
    const s = blankScene();
    s.magic = b[0]; s.version = b[1]; s.flags = b[2]; s.reserved = b[3];
    s.color.set(b.subarray(OFF_COLOR, OFF_COLOR + LED_COUNT * 3));
    s.zoneOf.set(b.subarray(OFF_ZONEOF, OFF_ZONEOF + LED_COUNT));
    for (let i = 0; i < ZONES; i++) s.zones[i] = zoneFromBytes(b, OFF_ZONES + i * ZONE_BYTES);
    for (let i = 0; i < GRADIENTS; i++) s.grad[i] = gradFromBytes(b, OFF_GRAD + i * GRAD_BYTES);
    s.haloXY.set(b.subarray(OFF_HXY, OFF_HXY + HALO_LEDS * 2));
    s.haloRing.set(b.subarray(OFF_HRING, OFF_HRING + HALO_LEDS));
    return s;
  }
  function cloneScene(s) { return sceneFromBytes(sceneToBytes(s)); }

  // --------------------------------------------------------------- engine
  class HcEngine {
    constructor(keyXY) {
      this.keyXY = keyXY; // Uint8Array(83*2)
      this.hits = [];
      for (let i = 0; i < MAX_HITS; i++) this.hits.push({ led: 0xFF, x: 0, y: 0, t: 0 });
      this.hitHead = 0;
      this.heat = new Uint8Array(LED_COUNT);
      this.heatT = 0;
      this._c = [0, 0, 0]; this._acc = [0, 0, 0]; this._rc = [0, 0, 0]; this._xy = [0, 0];
    }
    reset() {
      for (const h of this.hits) { h.led = 0xFF; h.x = 0; h.y = 0; h.t = 0; }
      this.hitHead = 0; this.heat.fill(0); this.heatT = 0;
    }
    ledXY(s, led, out) {
      if (led < KEY_LEDS) { out[0] = this.keyXY[led * 2]; out[1] = this.keyXY[led * 2 + 1]; }
      else { const h = led - KEY_LEDS; out[0] = s.haloXY[h * 2]; out[1] = s.haloXY[h * 2 + 1]; }
      return out;
    }
    axisValue(s, led, axis) {
      const xy = this.ledXY(s, led, [0, 0]);
      const x = xy[0], y = xy[1], dx = x - CX, dy = y - CY;
      switch (axis) {
        case AXIS.X: return Math.min(255, Math.floor((x * 255) / 224));
        case AXIS.Y: return Math.min(255, y * 4);
        case AXIS.RADIAL: return Math.min(255, isqrt32(dx * dx + dy * dy) * 2);
        case AXIS.ANGLE: return atan2_8(dy, dx);
        case AXIS.SPIRAL: return (atan2_8(dy, dx) + Math.min(255, isqrt32(dx * dx + dy * dy) * 2)) & 0xFF;
        case AXIS.DIAG: return (Math.min(255, Math.floor((x * 255) / 224)) + Math.min(255, y * 4)) >> 1;
        case AXIS.RING: return led >= KEY_LEDS ? s.haloRing[led - KEY_LEDS] : atan2_8(dy, dx);
        default: return 0;
      }
    }
    zoneAxis(s, z, led, axis) {
      let a = this.axisValue(s, led, axis);
      if (z.flags & ZF.MIRROR) a = tri8(a);
      return a;
    }
    keyHit(s, led, t) {
      if (led >= LED_COUNT) return;
      const h = this.hits[this.hitHead];
      this.hitHead = (this.hitHead + 1) % MAX_HITS;
      h.led = led; const xy = this.ledXY(s, led, [0, 0]); h.x = xy[0]; h.y = xy[1]; h.t = t >>> 0;
      this.heat[led] = qadd8(this.heat[led], 40);
    }
    frameBegin(s, t) {
      const steps = Math.floor(((t - this.heatT) >>> 0) / 40);
      if (steps === 0) return;
      this.heatT = (this.heatT + steps * 40) >>> 0;
      const dec = Math.min(255, steps);
      for (let i = 0; i < LED_COUNT; i++) this.heat[i] = qsub8(this.heat[i], dec);
    }
    randSlot(ph32, led, shift, density) {
      const o = hash32(led + 0x9E37) & 0xFFFF;
      const tt = (ph32 + o) % 4294967296;
      const slot = tt >>> shift;
      const pos = (tt >>> (shift - 8)) & 0xFF;
      const h = hash32((slot ^ (led << 24) ^ 0xA5A5) >>> 0);
      return { fire: (h & 0xFF) < density, pos };
    }
    band8(theta, p1) {
      const w = (p1 >> 1) + 1;
      const d = theta < 128 ? theta : 256 - theta;
      if (d >= w) return 0;
      return sin8((64 + Math.floor((d * 128) / w)) & 0xFF);
    }
    renderLed(s, led, t, out) {
      const zl = s.zoneOf[led];
      const z = s.zones[zl & LF.ZONE_MASK];
      out[0] = out[1] = out[2] = 0;
      if (z.effect === FX.OFF || z.effect >= FX.COUNT) return out;
      // time phase; ZF.PINGPONG: triangle at the same speed (bit 16 of the phase = backward half)
      const ph32 = phase32(t, z.speed), ph8 = (ph32 >>> 8) & 0xFF;
      const pp = (z.flags & ZF.PINGPONG) !== 0, back = pp && (ph32 & 0x10000) !== 0;
      const pp8 = back ? 255 - ph8 : ph8;
      const rev = (z.flags & ZF.REVERSE) !== 0;
      const lo = Math.min(z.vMin, z.vMax), hi = Math.max(z.vMin, z.vMax), rng = hi - lo;
      const c = this._c, acc = this._acc;
      let scroll = (z.effect === FX.FLOW || (z.flags & ZF.SRC_SCROLL)) ? pp8 : 0;
      if (rev) scroll = (0 - scroll) & 0xFF;
      switch (z.source) {
        case SRC.ZONE: c[0] = z.color[0]; c[1] = z.color[1]; c[2] = z.color[2]; break;
        case SRC.GRADIENT: {
          const p = (this.zoneAxis(s, z, led, z.srcAxis) * z.srcScale) >> 4 & 0xFF;
          gradSample(s.grad[z.gradient % GRADIENTS], (p - scroll) & 0xFF, c); break;
        }
        case SRC.RAINBOW: {
          const p = (this.zoneAxis(s, z, led, z.srcAxis) * z.srcScale) >> 4 & 0xFF;
          hsv2rgb((p - scroll) & 0xFF, 255, 255, c); break;
        }
        default: c[0] = s.color[led * 3]; c[1] = s.color[led * 3 + 1]; c[2] = s.color[led * 3 + 2]; break;
      }
      const a = this.zoneAxis(s, z, led, z.axis);
      const sp = ((a * z.spread) >> 4) & 0xFF;
      const tph = pingpongFx(z) ? pp8 : ph8;
      const theta = rev ? (tph + sp) & 0xFF : (tph - sp) & 0xFF;
      const accentOf = () => { if (isBlack(z.color)) { acc[0] = c[0]; acc[1] = c[1]; acc[2] = c[2]; } else { acc[0] = z.color[0]; acc[1] = z.color[1]; acc[2] = z.color[2]; } };
      switch (z.effect) {
        case FX.STATIC: case FX.FLOW: scaleRgb(c, hi); break;
        case FX.BREATHE: scaleRgb(c, lo + scale8(sin8(theta), rng)); break;
        case FX.PULSE: {
          let e;
          if (theta < 32) e = tri8((theta * 8) & 0xFF);
          else if (theta >= 48 && theta < 80) e = scale8(tri8(((theta - 48) * 8) & 0xFF), 170);
          else e = 0;
          scaleRgb(c, lo + scale8(e, rng)); break;
        }
        case FX.WAVE: scaleRgb(c, lo + scale8(this.band8(theta, z.p1), rng)); break;
        case FX.SATWAVE: lerpRgb(c, [255, 255, 255], scale8(this.band8(theta, z.p1), z.p2)); scaleRgb(c, hi); break;
        case FX.HUE_DRIFT: {
          const off = Math.trunc(((sin8(theta) - 128) * z.p1) / 128);
          hueShift(c, off & 0xFF); scaleRgb(c, hi); break;
        }
        case FX.COLOR_CYCLE: hueShift(c, theta); scaleRgb(c, hi); break;
        case FX.SPARKLE: {
          const r = this.randSlot(ph32, led, 11, z.p1);
          accentOf(); scaleRgb(c, lo);
          if (r.fire) { let e = 255 - r.pos; e = scale8(e, e); scaleRgb(acc, hi); lerpRgb(c, acc, e); }
          break;
        }
        case FX.RAINDROPS: {
          const r = this.randSlot(ph32, led, 12, z.p1);
          accentOf(); if (isBlack(z.color)) hueShift(acc, z.p2);
          scaleRgb(c, hi);
          if (r.fire) { scaleRgb(acc, hi); lerpRgb(c, acc, tri8(r.pos)); }
          break;
        }
        case FX.CANDLE: {
          const o = hash32(led + 0x9E37) & 0xFFFF;
          const tt = (ph32 + o) % 4294967296;
          const k = tt >>> 10, f = (tt >>> 2) & 0xFF;
          const n0 = hash32((k ^ (led << 24)) >>> 0) & 0xFF;
          const n1 = hash32(((k + 1) ^ (led << 24)) >>> 0) & 0xFF;
          scaleRgb(c, lo + scale8(lerp8(n0, n1, f), rng)); break;
        }
        case FX.COMET: {
          const n = z.p2 === 0 ? 1 : Math.min(8, z.p2);
          const seg = Math.floor(256 / n), tail = z.p1 === 0 ? 1 : z.p1;
          let dm; // phase steps since a comet head passed this LED
          if (pp) {
            // back and forth: the tail is the path the head really took (see hc_engine.c)
            const u = (rev !== back) ? 255 - a : a;
            dm = ((ph8 - u) & 0xFF) % seg;
            if (dm > ph8) dm = ph8 + (u % seg);
          } else {
            const head = rev ? (0 - ph8) & 0xFF : ph8;
            const d = rev ? (a - head) & 0xFF : (head - a) & 0xFF;
            dm = d % seg;
          }
          let e = 0;
          if (dm < tail) { e = 255 - Math.floor((dm * 255) / tail); e = scale8(e, e); }
          scaleRgb(c, lo + scale8(e, rng)); break;
        }
        case FX.STROBE: scaleRgb(c, theta < z.p1 ? hi : lo); break;
        case FX.REACT_FADE: {
          const dur = 150 + (255 - z.speed) * 12;
          let e = 0;
          for (const h of this.hits) {
            if (h.led !== led) continue;
            const age = (t - h.t) >>> 0;
            if (age >= dur) continue;
            const f = 255 - Math.floor((age * 255) / dur);
            if (f > e) e = f;
          }
          scaleRgb(c, lo + scale8(e, rng)); break;
        }
        case FX.RIPPLE: {
          const life = 1500, xy = this.ledXY(s, led, this._xy), w = (z.p1 >> 3) + 2, reach = z.p2 >= 2 ? z.p2 : 0;
          let e = 0;
          for (const h of this.hits) {
            if (h.led === 0xFF) continue;
            const age = (t - h.t) >>> 0;
            if (age >= life) continue;
            const r = Math.floor((age * (16 + (z.speed >> 1))) / 256);
            let fade;
            if (reach) { if (r >= reach) continue; fade = 255 - Math.floor((r * 255) / reach); } else fade = 255 - Math.floor((age * 255) / life);
            const dx = xy[0] - h.x, dy = xy[1] - h.y; // rows weighted 1.5x, as in the C engine
            const dist = isqrt32(dx * dx + Math.floor((dy * dy * 9) / 4));
            const dd = Math.abs(dist - r);
            if (dd >= w) continue;
            const ring = Math.floor(((w - dd) * 255) / w) & 0xFF;
            const f = scale8(ring, fade);
            if (f > e) e = f;
          }
          accentOf(); scaleRgb(c, lo); scaleRgb(acc, hi); lerpRgb(c, acc, e); break;
        }
        case FX.HEATMAP: accentOf(); scaleRgb(c, lo); scaleRgb(acc, hi); lerpRgb(c, acc, this.heat[led]); break;
        default: break;
      }
      const kind = z.reactive & 0x0F;
      if (kind !== RX.NONE && kind < RX.COUNT && !(zl & LF.NO_REACT)) {
        const dur = 200 + (15 - (z.reactive >> 4)) * 120;
        let e = 0;
        const xy = this.ledXY(s, led, this._xy), x = xy[0], y = xy[1];
        for (const h of this.hits) {
          if (h.led === 0xFF) continue;
          const age = (t - h.t) >>> 0;
          if (age >= dur) continue;
          const fade = 255 - Math.floor((age * 255) / dur);
          let f = 0;
          if (kind === RX.FLASH) { if (h.led === led) f = fade; }
          else if (kind === RX.GLOW) {
            const dx = x - h.x, dy = y - h.y, dist = isqrt32(dx * dx + dy * dy);
            if (dist < 28) f = scale8(fade, 255 - Math.floor((dist * 255) / 28));
          } else if (kind === RX.RIPPLE) {
            const r = Math.floor((age * 3) / 10);
            const dx = x - h.x, dy = y - h.y, dist = isqrt32(dx * dx + dy * dy);
            const dd = Math.abs(dist - r);
            if (dd < 10) f = scale8(fade, (10 - dd) * 25);
          } else if (kind === RX.ECHO) {
            if (led >= KEY_LEDS) {
              const ah = atan2_8(y - CY, x - CX), ak = atan2_8(h.y - CY, h.x - CX);
              let d = (ah - ak) & 0xFF;
              if (d > 128) d = 256 - d;
              if (d < 20) f = scale8(fade, 255 - d * 12);
            }
          }
          if (f > e) e = f;
        }
        if (e) {
          const rc = this._rc;
          if (isBlack(z.rxColor)) { rc[0] = rc[1] = rc[2] = 255; } else { rc[0] = z.rxColor[0]; rc[1] = z.rxColor[1]; rc[2] = z.rxColor[2]; }
          lerpRgb(c, rc, e);
        }
      }
      out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
      return out;
    }
    finish(s, master, c) {
      scaleRgb(c, master);
      if (s.flags & SF.GAMMA) { c[0] = GAMMA22[c[0]]; c[1] = GAMMA22[c[1]]; c[2] = GAMMA22[c[2]]; }
      return c;
    }
    // Renders a full frame into Uint8Array(128*3). masters = {keys, halo}
    renderFrame(s, t, masters, outBuf) {
      this.frameBegin(s, t);
      const px = [0, 0, 0];
      for (let led = 0; led < LED_COUNT; led++) {
        this.renderLed(s, led, t, px);
        const m = led < KEY_LEDS ? masters.keys : ((s.flags & SF.HALO_FOLLOWS_KEYS) ? masters.keys : masters.halo);
        this.finish(s, m, px);
        outBuf[led * 3] = px[0]; outBuf[led * 3 + 1] = px[1]; outBuf[led * 3 + 2] = px[2];
      }
      return outBuf;
    }
  }

  function defaultScene(geom) {
    // Mirrors hc_scene_defaults(): 2700K keys with a 560 ms mint flash + a two-key mint ripple on
    // keypress, 2700K halo breathing 30-100%, gamma on.
    const s = blankScene();
    s.flags = SF.GAMMA;
    for (let i = 0; i < LED_COUNT; i++) { s.color[i * 3] = 255; s.color[i * 3 + 1] = 167; s.color[i * 3 + 2] = 87; s.zoneOf[i] = i < KEY_LEDS ? 0 : 2; }
    const mk = (effect, source, speed, lo, hi) => Object.assign(blankZone(), { effect, source, speed, vMin: lo, vMax: hi });
    s.zones[0] = Object.assign(mk(FX.RIPPLE, SRC.MAP, 56, 255, 255), { p1: 80, p2: 24, reactive: RX.FLASH | (12 << 4), color: [0x70, 0xFF, 0x94], rxColor: [0x70, 0xFF, 0x94] });
    s.zones[1] = mk(FX.STATIC, SRC.MAP, 128, 0, 255);
    s.zones[2] = Object.assign(mk(FX.BREATHE, SRC.ZONE, 40, 77, 255), { axis: AXIS.NONE, spread: 0, color: [255, 167, 87] });
    for (let i = 3; i < ZONES; i++) s.zones[i] = mk(FX.STATIC, SRC.MAP, 128, 0, 255);
    const g = (flags, stops) => { const G = blankGradient(); G.count = stops.length; G.flags = flags; stops.forEach((st, i) => { G.stops[i] = { pos: st[0], r: st[1], g: st[2], b: st[3] }; }); return G; };
    s.grad[0] = g(0, [[0, 255, 60, 0], [128, 255, 0, 90], [255, 90, 0, 255]]);
    s.grad[1] = g(1, [[0, 0, 255, 120], [96, 0, 120, 255], [192, 160, 0, 255]]);
    s.grad[2] = g(0, [[0, 255, 40, 0], [160, 255, 140, 0], [255, 255, 220, 120]]);
    s.grad[3] = g(1, [[0, 0, 40, 255], [128, 0, 200, 255], [255, 0, 255, 160]]);
    if (geom) geom.halo.forEach((h, i) => { s.haloXY[i * 2] = h.x; s.haloXY[i * 2 + 1] = h.y; s.haloRing[i] = h.ring; });
    return s;
  }

  const api = { KEY_LEDS, HALO_LEDS, LED_COUNT, ZONES, GRADIENTS, GRAD_STOPS, MAX_HITS, MAGIC, SCENE_VERSION, SCENE_BYTES, ZONE_BYTES, GRAD_BYTES,
    FX, SRC, AXIS, RX, ZF, GF, SF, LF, HcEngine, blankScene, blankZone, blankGradient, defaultScene, sceneToBytes, sceneFromBytes, cloneScene,
    zoneToBytes, zoneFromBytes, gradToBytes, gradFromBytes, util: { scale8, lerp8, sin8, hash32, phase16, atan2_8, isqrt32, hsv2rgb, rgb2hsv, gradSample } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HC = api;
})(typeof self !== 'undefined' ? self : this);

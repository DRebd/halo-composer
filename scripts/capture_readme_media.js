// Captures the README screenshots and the frames of the README GIFs from Halo Studio (no keyboard needed).
// Runs in the test container:  .\scripts\capture-media.ps1   (writes docs\media\)
//
// Every GIF is a seamless loop. The preview's clock (performance.now) is replaced by a virtual
// one that the script sets for each frame, so frame i shows engine time t0 + i*T/N exactly, and:
//  - every animated zone's cycle divides the loop length T. A cycle is 262144/(speed+16) ms
//    (phase32 in studio/hc_engine.js), so speeds 16/48/112/240 give exactly 8192/4096/2048/1024 ms;
//    "Back and forth" doubles it. Effects driven by random hashing (Sparkle, Candle, Raindrops)
//    never repeat, so they are not used here.
//  - keypresses are planned, not random: each one is injected at its exact planned time with
//    HaloStudio.engine.keyHit(), and every reaction has faded out before the loop point.
// After the N loop frames, frame N (time t0 + T) is rendered too and compared with frame 0:
// the numbers go to loops.json, and the PowerShell script prints them.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const SRC = process.env.STUDIO_HTML || '/src/dist/halo-studio.html';
const OUT = process.env.OUT_DIR || '/out';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean); // e.g. ONLY=comet-orbit,shots to redo a few items
const want = (name) => !ONLY.length || ONLY.includes(name);
const FRAME_MS = 70;   // target spacing of GIF frames: 7/100 s (GIF frame delays are whole hundredths)
const LOOP_START = 20000; // virtual clock at frame 0 of every loop (engine time = this + 1000 ms)

// Keyboard-only GIFs are cut from a 1440x900 window; the hero is the whole window at 1280x800,
// rendered at 2x so the panel text stays sharp after scaling down.
const KB_VIEW = { width: 1440, height: 900, scale: 1 };
const HERO_VIEW = { width: 1280, height: 800, scale: 2 };

async function studio(browser, { width, height, scale }) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  await page.addInitScript(() => {
    let virt = 0;
    window.__clock = (ms) => { virt = ms; };
    window.__advance = (ms) => { virt += ms; };
    performance.now = () => virt;
  });
  await page.goto(pathToFileURL(SRC).href);
  await page.waitForFunction(() => window.HaloStudio && document.fonts.status === 'loaded');
  // Pop-up messages, hover help and the preview fps counter (meaningless on a virtual clock) stay out of the shots.
  await page.addStyleTag({ content: '#toast, #stats, #tip { visibility: hidden !important; }' });
  await page.mouse.move(2, height - 2);
  return page;
}
const frame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
async function advance(page, ms) { await page.evaluate((m) => window.__advance(m), ms); await frame(page); }
async function tab(page, t) { await page.click(`#tabs button[data-tab=${t}]`); await page.mouse.move(2, page.viewportSize().height - 2); await advance(page, 50); }
async function starter(page, name) {
  await page.click('#tabs button[data-tab=scenes]');
  await page.click(`.scene:has-text("${name}")`);
  await advance(page, 50);
}

// ------------------------------------------------------------ showcase scenes
// Built in the page from the engine (window.HC) and Studio's starter scenes (HaloStudio.SCENES),
// then loaded like an imported scene file. Everything here can be set in Studio's own panels.
function installScene(name) {
  const HC = window.HC, GEOM = window.HC_GEOM, { FX, SRC, AXIS, ZF, SF, GF, LF } = HC;
  const H = window.HaloStudio;
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const Z = (o) => Object.assign(HC.blankZone(), o);
  const grad = (flags, stops) => { const g = HC.blankGradient(); g.flags = flags; g.count = stops.length; stops.forEach((s, i) => { g.stops[i] = { pos: s[0], r: s[1], g: s[2], b: s[3] }; }); return g; };
  const assign = (s, leds, z) => { for (const i of leds) s.zoneOf[i] = (s.zoneOf[i] & ~LF.ZONE_MASK) | z; };
  const starterScene = (n) => H.SCENES.find((x) => x.name === n).build();
  const WASD = [33, 47, 48, 49], KEYS = range(0, 82), HALO = range(83, 127);
  const AURORA = grad(GF.WRAP, [[0, 0, 255, 120], [96, 0, 120, 255], [192, 160, 0, 255]]);
  let s, names;
  switch (name) {
    case 'hero': // Aurora gradient flowing diagonally over the keys and round the halo; WASD breathes ice-mint.
      s = HC.defaultScene(GEOM); s.flags = SF.GAMMA; s.grad[1] = AURORA;
      assign(s, KEYS, 0); assign(s, WASD, 1); assign(s, HALO, 2);
      s.zones[0] = Z({ effect: FX.FLOW, source: SRC.GRADIENT, gradient: 1, srcAxis: AXIS.DIAG, srcScale: 16, speed: 48, vMax: 255 });
      s.zones[1] = Z({ effect: FX.BREATHE, source: SRC.ZONE, color: [190, 255, 235], axis: AXIS.NONE, spread: 0, vMin: 110, vMax: 255, speed: 48 });
      s.zones[2] = Z({ effect: FX.FLOW, source: SRC.GRADIENT, gradient: 1, srcAxis: AXIS.RING, srcScale: 16, speed: 48, vMax: 255 });
      names = ['Keys', 'WASD', 'Halo']; break;
    case 'factory': // exactly the factory look (Warm Desk)
      s = HC.defaultScene(GEOM); names = ['Keys', 'Zone 2', 'Halo']; break;
    case 'comet': // Ember Comet, livelier: two ember comets orbit the halo every 4.1 s over ember-lit keys
      s = starterScene('Ember Comet'); s.flags = SF.GAMMA; assign(s, WASD, 0);
      s.zones[0] = Z({ effect: FX.STATIC, source: SRC.GRADIENT, gradient: 2, srcAxis: AXIS.X, srcScale: 16, vMax: 170 });
      s.zones[2].speed = 48;
      names = ['Keys', 'Zone 2', 'Halo']; break;
    case 'glow': // Synthwave: sunset keys glow cyan around each keypress; WASD pulses; vaporwave halo flows
      s = starterScene('Synthwave'); s.flags = SF.GAMMA;
      s.zones[1].speed = 112; s.zones[2].speed = 48;
      names = ['Keys', 'WASD', 'Halo']; break;
    case 'pingpong': // "Back and forth" on a Comet: one scanner sweeps left to right over keys and halo, then back
      // (with Back and forth, the tail trails along the path the head really took). Ocean gradient left to right.
      s = HC.defaultScene(GEOM); s.flags = SF.GAMMA;
      s.grad[3] = grad(0, [[0, 0, 40, 255], [128, 0, 200, 255], [255, 255, 0, 160]]);
      assign(s, [...KEYS, ...HALO], 0);
      s.zones[0] = Z({ effect: FX.COMET, source: SRC.GRADIENT, gradient: 3, srcAxis: AXIS.X, srcScale: 16, axis: AXIS.X, speed: 112, vMin: 70, vMax: 255, p1: 100, p2: 1, flags: ZF.PINGPONG });
      names = ['Scanner']; break;
    default: throw new Error('unknown scene ' + name);
  }
  const zoneNames = names.concat(range(names.length + 1, 8).map((i) => `Zone ${i}`));
  const b64 = btoa(String.fromCharCode(...HC.sceneToBytes(s)));
  H.importProfile({ format: 'halo-studio-scene', version: 1, name, zoneNames, scene: b64 });
  H.state.preview.typing = false;
}
async function scene(page, name, zone = 0) {
  await page.evaluate(installScene, name);
  await page.evaluate((z) => { window.HaloStudio.state.zone = z; }, zone);
}

// Planned keypresses: types `text` starting at `start` ms, one key every `gap` ms, with a small
// fixed rhythm so it doesn't look mechanical. Returns [{ t, led }] (t relative to the loop start).
const LED_OF = { ' ': 77, '\n': 58 };
const RHYTHM = [0, 40, -30, 60, -10, 20, -40, 30];
function typed(text, start, gap, labels) {
  return [...text].map((ch, i) => {
    const led = LED_OF[ch] ?? labels.indexOf(ch.toUpperCase());
    if (led < 0) throw new Error(`no key for "${ch}"`);
    return { t: Math.round(start + i * gap + RHYTHM[i % RHYTHM.length]), led };
  });
}

// ------------------------------------------------------------ loops
const report = [];
// Renders one seamless loop: N frames covering engine time [t0, t0 + T), then frame N at t0 + T
// for the seamlessness check. `clip`: CSS-pixel box to cut, or null for the whole window.
async function loop(page, helper, { name, T, hits = [], clip, still, width, stillWidth = 0, lifeMs = 0, note }) {
  const N = Math.round(T / FRAME_MS);
  for (const h of hits) if (!(h.t > 0 && h.t + lifeMs <= T)) throw new Error(`${name}: keypress at ${h.t} ms is still fading at the loop point`);
  const dir = path.join(OUT, 'frames', name);
  fs.mkdirSync(dir, { recursive: true });
  await page.evaluate(() => window.HaloStudio.engine.reset()); // no reactions left over from earlier captures
  let sent = 0;
  const files = [];
  for (let i = 0; i <= N; i++) {
    const tr = (i * T) / N;
    const due = [];
    while (sent < hits.length && hits[sent].t <= tr) due.push(hits[sent++]);
    await page.evaluate(({ at, base, due }) => {
      window.__clock(at);
      const H = window.HaloStudio;
      for (const h of due) H.engine.keyHit(H.state.scene, h.led, base + h.t);
    }, { at: LOOP_START + tr, base: LOOP_START + 1000, due });
    await frame(page);
    const file = i < N ? path.join(dir, `f${String(i).padStart(4, '0')}.png`) : path.join(OUT, 'frames', `${name}-check.png`);
    await page.screenshot({ path: file, clip: clip || undefined });
    files.push(file);
  }
  const seam = await diff(helper, files[N], files[0]);  // frame N vs frame 0: should be ~0
  const step = await diff(helper, files[1], files[0]);  // an ordinary step between frames, for scale
  fs.copyFileSync(files[still], path.join(OUT, `${name}.png`));
  const r = { name, T, N, frameMs: +(T / N).toFixed(2), fps: +((N * 1000) / T).toFixed(2), width, stillWidth, keypresses: hits.length, still, seam, step, note };
  report.push(r);
  console.log(`loop ${name}: ${N} frames over ${T} ms; frame N vs 0: mean ${seam.mean.toFixed(4)} (max ${seam.max}, ${seam.changedPct.toFixed(3)}% px); normal step: mean ${step.mean.toFixed(3)}`);
}
// Mean absolute difference of two PNGs per color channel (0-255), decoded in a blank page.
async function diff(helper, a, b) {
  return helper.evaluate(async ([a, b]) => {
    const load = async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = new OffscreenCanvas(img.width, img.height), x = c.getContext('2d');
      x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height).data;
    };
    const A = await load(a), B = await load(b);
    if (A.length !== B.length) return { mean: 255, max: 255, changedPct: 100 };
    let sum = 0, max = 0, changed = 0;
    for (let i = 0; i < A.length; i += 4) {
      let any = false;
      for (let k = 0; k < 3; k++) { const d = Math.abs(A[i + k] - B[i + k]); sum += d; if (d > max) max = d; if (d) any = true; }
      if (any) changed++;
    }
    const px = A.length / 4;
    return { mean: sum / (px * 3), max, changedPct: (100 * changed) / px };
  }, [fs.readFileSync(a).toString('base64'), fs.readFileSync(b).toString('base64')]);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const helper = await browser.newPage();

  // Is a downloaded copy usable straight from disk (file://)?
  const probe = await browser.newPage();
  await probe.goto(pathToFileURL(SRC).href);
  await probe.waitForFunction(() => window.HaloStudio);
  console.log('file:// check', JSON.stringify(await probe.evaluate(() => ({
    secureContext: window.isSecureContext, webhid: 'hid' in navigator,
    storage: (() => { try { localStorage.setItem('x', '1'); localStorage.removeItem('x'); return true; } catch (e) { return String(e); } })(),
  }))));
  await probe.close();

  // ---- hero: the whole window, Zones panel open on the Keys zone
  if (want('studio-hero')) {
    const page = await studio(browser, HERO_VIEW);
    await scene(page, 'hero', 0); await tab(page, 'zones');
    await loop(page, helper, { name: 'studio-hero', T: 4096, clip: null, still: 20, width: 1200, stillWidth: 1600,
      note: 'keys Flow (Aurora gradient, diagonal, speed 48 = 4096 ms), WASD Breathe (speed 48), halo Flow (ring, speed 48)' });
    await page.close();
  }

  // ---- keyboard-only loops
  const page = await studio(browser, KB_VIEW);
  const labels = await page.evaluate(() => window.HC_GEOM.keys.map((k) => k.label));
  const kb = await page.locator('#kb').boundingBox();
  const W = 800;
  if (want('factory-look')) {
    // Flash: fade 12 = 200 + 3*120 = 560 ms; the 2-key Ripple is over in about 140 ms.
    // Halo breathes at speed 40: 262144/56 = 4681.1 ms per breath, so the loop is 4681 ms.
    await scene(page, 'factory');
    await loop(page, helper, { name: 'factory-look', T: 4681, hits: typed('hello world', 140, 320, labels), lifeMs: 560, clip: kb, still: 48, width: W,
      note: 'factory look (Warm Desk); halo Breathe speed 40 = 4681.1 ms; mint flash 560 ms' });
  }
  if (want('comet-orbit')) {
    await scene(page, 'comet');
    await loop(page, helper, { name: 'comet-orbit', T: 4096, clip: kb, still: 12, width: W,
      note: 'Ember Comet with the halo Comet at speed 48 = 4096 ms per orbit, 2 comets' });
  }
  if (want('keypress-glow')) {
    // Glow: fade 8 = 200 + 7*120 = 1040 ms.
    await scene(page, 'glow');
    await loop(page, helper, { name: 'keypress-glow', T: 4096, hits: typed('synthwave', 120, 330, labels), lifeMs: 1040, clip: kb, still: 22, width: W,
      note: 'Synthwave; WASD Breathe speed 112 = 2048 ms; halo Flow speed 48 = 4096 ms; cyan Glow 1040 ms' });
  }
  if (want('back-and-forth')) {
    await scene(page, 'pingpong');
    await loop(page, helper, { name: 'back-and-forth', T: 4096, clip: kb, still: 10, width: W,
      note: 'Comet scanner with Back and forth at speed 112: 2048 ms each way, 4096 ms there and back' });
  }

  // ---- screenshots (whole window, 1280x800)
  if (want('shots')) {
    const shot = await studio(browser, { width: 1280, height: 800, scale: 1 });
    const snap = (n) => shot.screenshot({ path: path.join(OUT, n) });
    await scene(shot, 'factory', 2); await tab(shot, 'zones');
    const lab = await shot.evaluate(() => window.HC_GEOM.keys.map((k) => k.label));
    await shot.evaluate(({ hits, base }) => { window.__clock(base); const H = window.HaloStudio; for (const h of hits) H.engine.keyHit(H.state.scene, h.led, base + 1000 + h.t); }, { hits: typed('halo', 0, 90, lab), base: LOOP_START });
    await advance(shot, 330);
    await snap('studio-zones.png');
    await starter(shot, 'Synthwave');
    await tab(shot, 'paint'); await shot.click('#quickSel >> text="WASD"'); await shot.mouse.move(2, 798); await advance(shot, 900);
    await snap('studio-paint.png');
    await shot.click('#quickSel >> text="None"');
    await scene(shot, 'hero'); await shot.evaluate(() => { window.HaloStudio.state.grad = 1; }); await tab(shot, 'gradients'); await advance(shot, 700);
    await snap('studio-gradients.png');
    await tab(shot, 'effects'); await advance(shot, 1200);
    await snap('studio-effects.png');
    await starter(shot, 'Aurora Drift'); await tab(shot, 'halo');
    await shot.click('button:has-text("Start placing")'); await shot.mouse.move(2, 798); await advance(shot, 600);
    await snap('studio-halo-setup.png');
    await shot.click('button:has-text("Stop placing")');
  }

  fs.writeFileSync(path.join(OUT, 'loops.json'), JSON.stringify(report, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });

// Captures the README screenshots and GIF frames of Halo Studio (no keyboard needed).
// Runs in the test container:  .\scripts\capture-media.ps1   (writes docs\media\)
// The preview's clock is replaced by a virtual one and advanced 1/FPS s per frame,
// so animations come out smooth however long each screenshot takes.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const SRC = process.env.STUDIO_HTML || '/src/dist/halo-studio.html';
const OUT = process.env.OUT_DIR || '/out';
const FPS = 15;

async function studio(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => {
    let virt = 0;
    window.__advance = (ms) => { virt += ms; };
    performance.now = () => virt;
  });
  await page.goto(pathToFileURL(SRC).href);
  await page.waitForFunction(() => window.HaloStudio && document.fonts.status === 'loaded');
  // Pop-up messages and the preview fps counter (meaningless on a virtual clock) stay out of the shots.
  await page.addStyleTag({ content: '#toast, #stats { visibility: hidden !important; }' });
  return page;
}
const frame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
async function advance(page, ms) { await page.evaluate((m) => window.__advance(m), ms); await frame(page); }
async function scene(page, name) {
  await page.click('#tabs button[data-tab=scenes]');
  await page.click(`.scene:has-text("${name}")`);
  await advance(page, 50);
}
async function tab(page, t) { await page.click(`#tabs button[data-tab=${t}]`); await advance(page, 50); }
async function typing(page, on) { if ((await page.isChecked('#pvTyping')) !== on) await page.click('#pvTyping'); }

async function gif(page, name, seconds) {
  const dir = path.join(OUT, 'frames', name);
  fs.mkdirSync(dir, { recursive: true });
  const box = await page.locator('#kb').boundingBox();
  for (let i = 0; i < seconds * FPS; i++) {
    await advance(page, 1000 / FPS);
    await page.screenshot({ path: path.join(dir, `f${String(i).padStart(4, '0')}.png`), clip: box });
  }
  console.log(`frames: ${name} (${seconds * FPS} @ ${FPS} fps, ${Math.round(box.width)}x${Math.round(box.height)})`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  // Is a downloaded copy usable straight from disk (file://)?
  const probe = await browser.newPage();
  await probe.goto(pathToFileURL(SRC).href);
  await probe.waitForFunction(() => window.HaloStudio);
  console.log('file:// check', JSON.stringify(await probe.evaluate(() => ({
    secureContext: window.isSecureContext, webhid: 'hid' in navigator,
    storage: (() => { try { localStorage.setItem('x', '1'); localStorage.removeItem('x'); return true; } catch (e) { return String(e); } })(),
  }))));
  await probe.close();

  const page = await studio(browser);
  // Screenshots
  await scene(page, 'Warm Desk'); await typing(page, true);
  await tab(page, 'zones'); await advance(page, 1400);
  await page.screenshot({ path: path.join(OUT, 'studio-zones.png') });
  await scene(page, 'Synthwave'); await typing(page, false);
  await tab(page, 'paint'); await page.click('#quickSel >> text="WASD"'); await advance(page, 900);
  await page.screenshot({ path: path.join(OUT, 'studio-paint.png') });
  await page.click('#quickSel >> text="None"');
  await tab(page, 'effects'); await advance(page, 1200);
  await page.screenshot({ path: path.join(OUT, 'studio-effects.png') });
  await scene(page, 'Aurora Drift'); await tab(page, 'halo');
  await page.click('button:has-text("Start placing")'); await advance(page, 600);
  await page.screenshot({ path: path.join(OUT, 'studio-halo-setup.png') });
  await page.click('button:has-text("Stop placing")');

  // GIFs (keyboard drawing only)
  await tab(page, 'scenes');
  await scene(page, 'Warm Desk'); await typing(page, true); await advance(page, 1500);
  await gif(page, 'warm-desk-typing', 4);
  await typing(page, false);
  await scene(page, 'Aurora Drift'); await advance(page, 500);
  await gif(page, 'aurora-drift', 4);
  await scene(page, 'Ember Comet'); await advance(page, 500);
  await gif(page, 'ember-comet', 4);
  await scene(page, 'Synthwave'); await typing(page, true); await advance(page, 1500);
  await gif(page, 'synthwave-typing', 4);

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });

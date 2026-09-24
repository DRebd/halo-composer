// Run via tests/run_tests.sh (needs Node + Playwright with Chromium).
// End-to-end: Halo Studio (real page) <-> fake WebHID <-> real firmware protocol code (host build)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const { pathToFileURL } = require('url');
const dev = spawn(process.env.HOST_DEVICE || '/tmp/host_device');
let buf = '', waiters = [];
dev.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); const w = waiters.shift(); if (w) w(line); } });
const ask = (line) => new Promise((r) => { waiters.push(r); dev.stdin.write(line + '\n'); });
let packets = 0;
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const newStudioPage = async () => {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.exposeFunction('__hidExchange', async (hex) => { packets++; return ask(hex); });
  await p.addInitScript(() => {
    // ?stock=1 simulates a keyboard without Composer: VIA answers 0xD0 with 0xFF (unhandled).
    const stock = location.search.includes('stock=1');
    class FakeDev extends EventTarget {
      constructor() { super(); this.opened = false; this.productName = 'NuPhy Halo75 V2 (host sim)'; }
      async open() { this.opened = true; }
      async close() { this.opened = false; }
      async sendReport(id, data) {
        const hex = Array.from(data, (x) => x.toString(16).padStart(2, '0')).join('');
        let bytes;
        if (stock) { bytes = Uint8Array.from(data); bytes[0] = 0xFF; } else {
          const resp = await window.__hidExchange(hex);
          bytes = Uint8Array.from(resp.match(/../g).map((x) => parseInt(x, 16)));
        }
        const ev = new Event('inputreport'); ev.data = new DataView(bytes.buffer); ev.device = this; ev.reportId = 0;
        setTimeout(() => this.dispatchEvent(ev), 1);
      }
    }
    const hid = new EventTarget(); const d = new FakeDev();
    hid.requestDevice = async () => [d]; hid.getDevices = async () => [d];
    Object.defineProperty(navigator, 'hid', { value: hid });
  });
  return p;
  };
  const html = pathToFileURL(process.env.STUDIO_HTML || path.join(__dirname, '..', 'dist', 'halo-studio.html')).href;
  const p = await newStudioPage();
  await p.goto(html);
  await p.waitForTimeout(500);
  const sceneHex = () => p.evaluate(() => Array.from(HC.sceneToBytes(HaloStudio.state.scene), (x) => x.toString(16).padStart(2, '0')).join(''));
  const report = [];
  const cmp = async (label, which) => { const a = await sceneHex(); const bb = await ask(which); const ok = a === bb; report.push(`${ok ? 'PASS' : 'FAIL'}  ${label}`); if (!ok) { let i = 0; while (a[i] === bb[i]) i++; report.push(`      first diff at byte ${i >> 1}`); } };

  // 1. connect: GUI reads the keyboard's (default) scene
  await p.click('#btnConnect'); await p.waitForTimeout(1500);
  report.push(`INFO  pill: ${await p.textContent('#connPill')}`);
  await cmp('connect: GUI scene == firmware RAM scene (read back)', 'SCENE');
  // 2. turn composer on via Device tab
  await p.click('#tabs button[data-tab=device]'); await p.click('text=Turn Composer on'); await p.waitForTimeout(600);
  report.push(`INFO  pill after activate: ${await p.textContent('#connPill')}`);
  // 3. load a starter scene -> live push
  await p.click('#tabs button[data-tab=scenes]'); await p.click('text=Synthwave'); await p.waitForTimeout(2500);
  await cmp('Synthwave pushed live: firmware RAM == GUI', 'SCENE');
  // 4. paint a selection + change zone effect via UI
  await p.click('#quickSel >> text=Arrows'); await p.click('#tabs button[data-tab=paint]');
  await p.click('.sw[title="Lime"]'); await p.click('text=Fill selection');
  await p.click('#tabs button[data-tab=zones]'); await p.selectOption('.tabbody select >> nth=0', '11'); await p.waitForTimeout(1500);
  await cmp('paint Arrows lime + zone 1 -> Comet: firmware RAM == GUI', 'SCENE');
  // 5. save -> EEPROM
  await p.click('#btnSave'); await p.waitForTimeout(1200);
  await cmp('Save: firmware EEPROM == GUI', 'EEPROM');
  // 6. change something, then Revert -> GUI == EEPROM again
  await p.click('#tabs button[data-tab=scenes]'); await p.click('text=Candlelight'); await p.waitForTimeout(2000);
  await p.click('#btnRevert'); await p.waitForTimeout(2500);
  await cmp('Revert: GUI == firmware EEPROM', 'EEPROM');
  await cmp('Revert: firmware RAM == EEPROM (reloaded)', 'SCENE');
  // 7. render parity through the real glue (masters: keys 255, halo level 5 -> 255)
  const t = 123456;
  const fw = await ask('FRAME ' + t);
  const gui = await p.evaluate((t) => { const e = new HC.HcEngine(HaloStudio.engine.keyXY); const out = new Uint8Array(384); e.renderFrame(HaloStudio.state.scene, t, { keys: 255, halo: 255 }, out); return Array.from(out, (x) => x.toString(16).padStart(2, '0')).join(''); }, t);
  report.push(`${fw === gui ? 'PASS' : 'FAIL'}  frame at t=${t}: firmware glue render == GUI preview render`);

  // 8. regressions from the Studio review (docs/PLAN.md)
  const ok = (cond, label, detail = '') => report.push(`${cond ? 'PASS' : 'FAIL'}  ${label}${cond || !detail ? '' : '  (' + detail + ')'}`);
  // 8a. buttons act on the current selection even when the panel was drawn before it changed
  await p.click('#tabs button[data-tab=paint]'); await p.click('.sw[title="Cyan"]');
  await p.click('#quickSel >> text=None');
  ok(await p.isDisabled('text=Fill selection'), 'Fill is disabled with nothing selected');
  await p.click('#quickSel >> text=Arrows'); await p.click('#quickSel >> text=WASD');
  await p.click('text=Fill selection'); await p.waitForTimeout(1200);
  const px = await p.evaluate(() => { const c = HaloStudio.state.scene.color; return { w: [c[99], c[100], c[101]].join(), up: [c[216], c[217], c[218]].join() }; });
  ok(px.w === '0,255,255' && px.up !== '0,255,255', 'Fill paints the current selection, not the one the panel was drawn with', JSON.stringify(px));
  await cmp('... and the keyboard got it: firmware RAM == GUI', 'SCENE');
  // 8b. starter scenes keep the halo calibration; two back-to-back loads end consistent
  await p.evaluate(() => { const s = HaloStudio.state.scene; s.haloXY[0] = 99; s.haloXY[1] = 33; s.haloRing[0] = 7; HaloStudio.markAll(); });
  await p.waitForTimeout(1500);
  await p.click('#tabs button[data-tab=scenes]');
  await p.click('text=Aurora Drift'); await p.click('text=Ocean Tide'); await p.waitForTimeout(3000);
  const geo = await p.evaluate(() => { const s = HaloStudio.state.scene; return [s.haloXY[0], s.haloXY[1], s.haloRing[0]].join(); });
  ok(geo === '99,33,7', 'starter scenes keep the halo calibration', geo);
  await cmp('two starter scenes clicked back to back: firmware RAM == GUI', 'SCENE');
  // 8c. Save right after an edit, while an earlier sync is still running
  await p.evaluate(() => { HaloStudio.markAll(); });
  await p.waitForTimeout(90);
  await p.evaluate(() => { const c = HaloStudio.state.scene.color; c[0] = 1; c[1] = 2; c[2] = 3; HaloStudio.markAll(); });
  await p.click('#btnSave'); await p.waitForTimeout(3500);
  await cmp('Save during a running sync includes the latest edit: EEPROM == GUI', 'EEPROM');
  // 8d. a scene file with an unknown effect is rejected, not half-loaded
  const rej = await p.evaluate(() => { const bad = HaloStudio.exportProfile('bad'); const by = Uint8Array.from(atob(bad.scene), (c) => c.charCodeAt(0)); by[516] = 30; bad.scene = btoa(String.fromCharCode(...by)); try { HaloStudio.importProfile(bad); return 'accepted'; } catch (e) { return e.message; } });
  ok(/doesn't know/.test(rej), 'importing a scene with an unknown effect is rejected', rej);
  // 8e. a keyboard without Composer firmware gets a clear message and no connection
  const p2 = await newStudioPage();
  await p2.goto(html + '?stock=1'); await p2.waitForTimeout(400);
  await p2.click('#btnConnect'); await p2.waitForTimeout(800);
  const t2 = await p2.textContent('#toast');
  ok(/not running the Halo Composer firmware/.test(t2), 'stock firmware is recognised with a clear message', t2);
  ok((await p2.textContent('#connPill')) === 'Preview only', '... and Studio stays disconnected');
  console.log(report.join('\n'));
  console.log(`HID packets exchanged: ${packets}`);
  console.log(errs.length ? errs.join('\n') : 'no page errors');
  await b.close(); dev.kill();
  const failed = report.filter((l) => l.startsWith('FAIL')).length;
  if (failed || errs.length) { console.error(`E2E FAILED: ${failed} check(s), ${errs.length} page error(s)`); process.exit(1); }
  console.log('E2E OK');
})().catch((e) => { console.error('E2E crashed:', e); dev.kill(); process.exit(1); });

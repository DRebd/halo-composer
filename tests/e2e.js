// End-to-end test: run tools/run_tests.sh (needs Node + Playwright with Chromium)
// End-to-end: Halo Studio (real page) <-> fake WebHID <-> real firmware protocol code (host build)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const dev = spawn(process.env.HOST_DEVICE || '/tmp/host_device');
let buf = '', waiters = [];
dev.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); const w = waiters.shift(); if (w) w(line); } });
const ask = (line) => new Promise((r) => { waiters.push(r); dev.stdin.write(line + '\n'); });
let packets = 0;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.exposeFunction('__hidExchange', async (hex) => { packets++; return ask(hex); });
  await p.addInitScript(() => {
    class FakeDev extends EventTarget {
      constructor() { super(); this.opened = false; this.productName = 'NuPhy Halo75 V2 (host sim)'; }
      async open() { this.opened = true; }
      async close() { this.opened = false; }
      async sendReport(id, data) {
        const hex = Array.from(data, (x) => x.toString(16).padStart(2, '0')).join('');
        const resp = await window.__hidExchange(hex);
        const bytes = Uint8Array.from(resp.match(/../g).map((x) => parseInt(x, 16)));
        const ev = new Event('inputreport'); ev.data = new DataView(bytes.buffer); ev.device = this; ev.reportId = 0;
        setTimeout(() => this.dispatchEvent(ev), 1);
      }
    }
    const hid = new EventTarget(); const d = new FakeDev();
    hid.requestDevice = async () => [d]; hid.getDevices = async () => [d];
    Object.defineProperty(navigator, 'hid', { value: hid });
  });
  await p.goto('file://' + path.join(__dirname, 'halo-studio.html'));
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
    console.log(report.join('\n'));
  console.log(`HID packets exchanged: ${packets}`);
  console.log(errs.length ? errs.join('\n') : 'no page errors');
  await b.close(); dev.kill();
})();

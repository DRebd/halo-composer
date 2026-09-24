// Replays host_vectors.json through the JS engine and requires byte-identical output.
// Usage: ./host_vectors > vectors.json && node parity_test.mjs vectors.json
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const HC = require('../studio/hc_engine.js');
const geom = JSON.parse(readFileSync(new URL('../studio/geometry.json', import.meta.url)));
const V = JSON.parse(readFileSync(process.argv[2] || 'vectors.json', 'utf8'));
const hexToBytes = (h) => Uint8Array.from(h.match(/../g).map((x) => parseInt(x, 16)));
const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
let fails = 0;
const check = (name, ok, detail) => { if (!ok) { fails++; if (fails < 15) console.error('FAIL', name, detail || ''); } };

check('scene size', V.scene_bytes === HC.SCENE_BYTES, `${V.scene_bytes} vs ${HC.SCENE_BYTES}`);
const U = HC.util;
check('sin8', toHex(Uint8Array.from({ length: 256 }, (_, i) => U.sin8(i))) === V.sin8);
{ const ss = [0, 1, 128, 255], vs = [0, 77, 255]; const out = [];
  for (let h = 0; h < 256; h++) for (const s of ss) for (const v of vs) out.push(...U.hsv2rgb(h, s, v, [0, 0, 0]));
  check('hsv2rgb', toHex(Uint8Array.from(out)) === V.hsv2rgb); }
V.rgb2hsv.forEach((e, i) => { const b = hexToBytes(e); const hsv = U.rgb2hsv([b[0], b[1], b[2]], [0, 0, 0]);
  check('rgb2hsv#' + i, hsv[0] === b[3] && hsv[1] === b[4] && hsv[2] === b[5], `${e} -> ${hsv}`); });
{ const out = []; for (let dy = -120; dy <= 120; dy += 7) for (let dx = -120; dx <= 120; dx += 7) out.push(U.atan2_8(dy, dx));
  check('atan2', toHex(Uint8Array.from(out)) === V.atan2); }
{ let k = 0; for (let n = 0; n < 70000; n += 97, k++) check('isqrt' + n, U.isqrt32(n) === V.isqrt[k], `${U.isqrt32(n)} vs ${V.isqrt[k]}`); }

const keyXY = new Uint8Array(83 * 2); geom.keys.forEach((k) => { keyXY[k.led * 2] = k.px; keyXY[k.led * 2 + 1] = k.py; });
let frames = 0;
V.tests.forEach((T, ti) => {
  const bytes = hexToBytes(T.scene);
  const scene = HC.sceneFromBytes(bytes);
  check('roundtrip#' + ti, toHex(HC.sceneToBytes(scene)) === T.scene);
  const eng = new HC.HcEngine(keyXY);
  const buf = new Uint8Array(128 * 3);
  for (const op of T.ops) {
    if (op[0] === 'h') eng.keyHit(scene, op[1], op[2]);
    else {
      eng.renderFrame(scene, op[1], { keys: T.masters[0], halo: T.masters[1] }, buf);
      frames++;
      const got = toHex(buf);
      if (got !== op[2]) {
        let led = 0; for (; led < 128; led++) if (got.substr(led * 6, 6) !== op[2].substr(led * 6, 6)) break;
        const z = scene.zones[scene.zoneOf[led] & 7];
        check(`test ${ti} t=${op[1]} led ${led}`, false, `js ${got.substr(led * 6, 6)} c ${op[2].substr(led * 6, 6)} zone fx=${z.effect} src=${z.source} axis=${z.axis} rx=${z.reactive}`);
      }
    }
  }
});
console.log(fails ? `PARITY FAILED: ${fails} mismatches` : `PARITY OK: ${V.tests.length} scenes, ${frames} frames x 128 LEDs, unit vectors all match`);
process.exit(fails ? 1 : 0);

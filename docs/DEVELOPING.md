# Developing: build, test, change

For whoever changes the code next, including Claude Code. Commands are for Windows PowerShell from the repo root. Everything that compiles runs in Docker, so the only requirements are **Docker Desktop**, **Git** and **Python 3**. `pip install hidapi` is needed for talking to the real keyboard.

## Build the firmware

```powershell
.\scripts\build-firmware.ps1            # both: via (fallback) + composer
.\scripts\build-firmware.ps1 composer   # just Halo Composer
```

- **Output (`dist\`):** `nuphy_halo75v2_ansi_via.bin`, `nuphy_halo75v2_ansi_composer.bin`, `halo75v2_composer_via3.json` (VIA definition with the Composer effect), `halo75v2_ryodeushii_via3.json`, and `SHA256SUMS.txt`.
- **How it works:** `scripts/build_in_container.sh` runs inside QMK's official build image, pinned by digest in `firmware/base.env`. On first use it fetches ryodeushii's firmware at the pinned commit into a Docker volume, `halo-composer-qmk`, so later builds skip the download. Each build:
  1. resets that tree to the pinned commit;
  2. builds the untouched `via` keymap;
  3. copies `firmware/keymap/` in as `keymaps/composer/`;
  4. applies `firmware/patches/nuphy-shared.diff`;
  5. builds `composer`.
- **Why a Docker volume:** QMK can't build from a folder whose path contains spaces, and builds over a Windows bind mount are very slow (over 10 minutes versus about 1).
- **Memory report:** `scripts/mem_report.sh` (see `HOW_IT_WORKS.md` for current numbers):

```powershell
docker run --rm -v halo-composer-qmk:/qmk -v "${PWD}:/src:ro" <QMK_IMAGE> bash /src/scripts/mem_report.sh via composer
```

## Run the tests

```powershell
.\scripts\test.ps1
```

This builds a small test image (`tests/Dockerfile`: Playwright's Chromium image plus gcc and Python) and runs `tests/run_tests.sh`:

1. The engine compiles with `-Wall -Wextra -Wconversion -Wshadow -Werror`.
2. **Parity:** `tests/host_vectors.c` renders 80 fuzzed scenes and `tests/parity_test.mjs` replays them in the JS engine. They must match byte for byte.
3. **Protocol:** `tests/host_device.c` wraps the *real* `hc_qmk.c` + `hc_engine.c` as a fake keyboard on stdin/stdout, and `tests/protocol_test.py` runs `tools/composer_checks.py` plus boot-guard, IDENTIFY, reactive and default-look checks against it.
4. Build Halo Studio.
5. **End to end:** `tests/e2e.js` drives the real Studio page in headless Chrome with a fake WebHID device connected to that fake keyboard, including regression checks for every bug found in review.

CI (`.github/workflows/ci.yml`) runs the same tests, builds the firmware in the same pinned container, and publishes Studio to GitHub Pages from `main`.

## Talk to the real keyboard

`tools/halo_kb.py`. Close VIA and Studio first, and use the cable in wired mode.

```powershell
python tools\halo_kb.py info                    # any firmware, read-only
python tools\halo_kb.py backup backups\x.json   # any firmware, read-only
python tools\halo_kb.py status                  # Composer: version, on/off, fps
python tools\halo_kb.py selftest                # Composer: protocol checks, RAM only, restores the scene
python tools\halo_kb.py on | off
python tools\halo_kb.py walk --order ring --ms 400
python tools\halo_kb.py scene-backup backups\scene.halo.json
python tools\halo_kb.py scene-restore backups\scene.halo.json --save
```

## Making changes

| If you change... | Also do |
|---|---|
| Lighting math in `firmware/keymap/composer/hc_engine.c` | Make the identical change in `studio/hc_engine.js`, then run the tests (parity will tell you) |
| The scene layout (`hc_scene_t`) | Bump `HC_SCENE_VERSION`; update the size in the `_Static_assert` (`hc_qmk.c`), `SCENE_BYTES`/offsets in `studio/hc_engine.js`, and offsets in `tools/halo_protocol.py`. The boot guard will reset VIA storage on first boot of the new version; that's expected |
| The protocol (`hc_protocol.h`, `hc_qmk.c`) | Update `studio/studio_b.js` (`SUB`, `readScene`, `sendDirty`), `tools/halo_protocol.py`, `tools/composer_checks.py` |
| Key or halo positions | Edit `tools/gen_geometry.py` (`CALIBRATED`, `ABSENT`) and run it (it rewrites `firmware/keymap/composer/hc_board_geometry.c` and `studio/geometry.json`), then update the points in `keymap.c` (`python tools/gen_geometry.py points`). Ring order uses the same maths as Studio's *Recompute ring order* |
| The ryodeushii base commit | Update `QMK_COMMIT` in `firmware/base.env`, rebuild, and check that `nuphy-shared.diff` still applies and that `side_led_show()` still has the same shape. `keymap.c` carries a copy of `keymaps/default/keymap.c`'s layers: re-copy them if upstream changed. `make_via_json.py` fails if ryodeushii's custom keycode list changed, since `HC_TOGGLE` must be the next one |
| The RGB-matrix effect list | The static assert in `keymap.c` requires Composer to be mode 43 (VIA dropdown index). Update `tools/make_via_json.py` together with it |

## Repository conventions

- Line endings: LF everywhere except `.ps1` (CRLF), enforced by `.gitattributes`.
- `build/`, `dist/`, `backups/` and the chat transcript are local-only (`.gitignore`).
- Commits end with a `Co-Authored-By` line when written with Claude.
- License: GPL-2.0-or-later, matching QMK and ryodeushii's firmware.

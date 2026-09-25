# Developing: host, build, test, change

For anyone who wants to host Halo Studio themselves, build the firmware, or change the code. Commands are for Windows PowerShell, run from the repository root. Planned work and known limitations are in [ROADMAP_AND_HISTORY.md](ROADMAP_AND_HISTORY.md). Terms such as QMK and VIA are explained in the README's [plain-English glossary](../README.md#plain-english-glossary).

Everything that compiles runs in **Docker** (a tool that runs programs inside pre-packaged Linux environments called *containers*), so the only requirements are **Docker Desktop**, **Git** (the version-control tool that downloads and tracks the code) and **Python 3**. Talking to a real keyboard from the command line also needs a USB library: `pip install hidapi`.

## Host Halo Studio yourself

Halo Studio doesn't depend on the project's GitHub Pages site (GitHub's free web hosting). It is **one self-contained HTML file**, `halo-studio.html`. To get it:

- download it from a [GitHub release](https://github.com/DRebd/halo-composer/releases), if that release includes it;
- or download the `halo-studio` artifact (a file kept from an automatic build) from any run on the repository's [Actions tab](https://github.com/DRebd/halo-composer/actions) (needs a GitHub sign-in);
- or build it: `python studio/build_studio.py` writes `dist/halo-studio.html`. The same command also writes `halo-studio-preview.html`, a variant for embedding in other pages; it can't connect to a keyboard, so don't host that one.

**Requirements.** Studio reaches the keyboard through **WebHID**, a browser feature that lets a web page talk to a USB device after the user picks it in a pop-up. WebHID needs:

- a Chromium-based desktop browser: **Chrome or Edge**. In other browsers the editor and preview still work, but Studio can't connect.
- a **secure context**: a page served over HTTPS, from `localhost` (this PC), or opened as a local file.

**Scenes saved in the browser are stored per address.** "My scenes" and the autosave live in the browser's storage for that one web address, so each copy of Studio (a local file, `localhost`, your own site) has its own library. Use **Export** / **Import file** (`.halo.json`) in the Scenes tab to move scenes between copies.

| Option | Tested | Result |
|---|---|---|
| 1. Open the downloaded file | Chromium, automated | Secure context, WebHID present, storage works. Keyboard connection not tested |
| 2. Serve it on your own PC | Desktop Chrome | Secure context, WebHID available, loads without errors |
| 3. Your own GitHub Pages copy | Workflow checked, not run from a second account | See below |
| 4. Any static HTTPS host | Not tested | Expected to behave like option 3 (inferred) |

### 1. Open the downloaded file directly

Double-click `halo-studio.html`. It opens in the default browser as a `file://…` address; if that browser isn't Chrome or Edge, right-click the file and choose **Open with**.

- Tested in Chromium with Playwright (a browser-automation tool the tests use): the page is a secure context, WebHID is present, and browser storage works.
- **Not tested:** the keyboard picker and an actual connection, because no keyboard was attached during that test.

### 2. Serve it on your own PC

In the folder that contains `halo-studio.html`:

```powershell
python -m http.server 8000
```

Then open **http://localhost:8000/halo-studio.html** in Chrome or Edge. Press Ctrl+C in the PowerShell window to stop the server.

- Tested in desktop Chrome: secure context true, WebHID available, the page loads without errors.
- Only `localhost` counts as secure. Opening the page from another computer via this PC's network address (for example `http://192.168.1.20:8000`) is plain HTTP, so WebHID won't work there.
- By default this server is reachable from other computers on the network. Add `--bind 127.0.0.1` to keep it to this PC.

### 3. Your own GitHub Pages copy

1. **Fork** the repository on GitHub.
2. Open the fork's **Actions** tab. GitHub normally keeps workflows switched off on a new fork; if it asks, confirm that you want to enable them.
3. In the fork, go to **Settings → Pages**. Under **Build and deployment → Source**, select **GitHub Actions**. (GitHub may then suggest workflow templates; they aren't needed, since the fork already has its workflow.)
4. **Push a commit to `main`** (any small change). The workflow's `pages` job then publishes Studio at `https://<your-user>.github.io/<repo>/`.

Notes:

- The `pages` job runs only for pushes to `main`, and only after the `test` and `firmware` jobs pass. Starting the workflow by hand from the Actions tab builds and tests but doesn't publish.
- `.github/workflows/ci.yml` has nothing tied to the original account; the address comes from the fork's own Pages settings.
- Not tested with a second GitHub account.

### 4. Any static HTTPS host

Upload `halo-studio.html` (optionally renamed to `index.html`) to any static web host. It must be served over **HTTPS**, and as its own page rather than inside another site's frame, because a frame can block USB access. Not tested beyond GitHub Pages.

## Build the firmware

```powershell
.\scripts\build-firmware.ps1            # both: via (fallback) + composer
.\scripts\build-firmware.ps1 composer   # just Halo Composer
```

- **Output (`dist\`):** `nuphy_halo75v2_ansi_via.bin`, `nuphy_halo75v2_ansi_composer.bin`, `halo75v2_composer_via3.json` (VIA definition with the Composer effect), `halo75v2_ryodeushii_via3.json`, and `SHA256SUMS.txt`. To put a `.bin` on the keyboard, see [FLASHING.md](FLASHING.md).
- **How it works:** `scripts/build_in_container.sh` runs inside QMK's official build image, pinned by digest in `firmware/base.env`. On first use it fetches ryodeushii's firmware (about 300 MB) at the pinned commit into a Docker volume, `halo-composer-qmk`, so later builds skip the download and take about a minute. Each build:
  1. resets that tree to the pinned commit;
  2. builds the untouched `via` keymap;
  3. copies `firmware/keymap/` in as `keymaps/composer/`;
  4. applies `firmware/patches/nuphy-shared.diff`;
  5. builds `composer`, then writes the VIA definition with `tools/make_via_json.py`.
- **Why a Docker volume:** QMK can't build from a folder whose path contains spaces, and builds over a Windows folder mount are very slow (over 10 minutes versus about 1).
- **Memory report:** after a build, `scripts/mem_report.sh` prints flash and RAM use (current numbers are in [HOW_IT_WORKS.md](HOW_IT_WORKS.md)). Replace `<QMK_IMAGE>` with the `QMK_IMAGE` value from `firmware/base.env`:

```powershell
docker run --rm -v halo-composer-qmk:/qmk -v "${PWD}:/src:ro" <QMK_IMAGE> bash /src/scripts/mem_report.sh via composer
```

## Run the tests

```powershell
.\scripts\test.ps1
```

This builds a small test image (`tests/Dockerfile`: Playwright's Chromium image plus gcc and Python) and runs `tests/run_tests.sh`:

1. The engine compiles with `-Wall -Wextra -Wconversion -Wshadow -Werror`.
2. **Parity:** `tests/host_vectors.c` renders 88 scenes (80 fuzzed, plus 8 built around Back and forth and mirrored gradients) and runs behavior checks on the C engine; `tests/parity_test.mjs` replays the scenes in the JavaScript engine. They must match byte for byte.
3. **Protocol:** `tests/host_device.c` wraps the *real* `hc_qmk.c` + `hc_engine.c` as a simulated keyboard on stdin/stdout, and `tests/protocol_test.py` runs 49 checks against it: `tools/composer_checks.py` plus boot-guard, IDENTIFY, reactive, default-look and flag-bit checks (the Back and forth and gradient flags survive Save, Reload and a reboot).
4. Build Halo Studio.
5. **End to end:** `tests/e2e.js` drives the real Studio page in headless Chrome (a browser running without a window) with a simulated WebHID device connected to that simulated keyboard, including a regression check for every bug found in review.

On macOS or Linux, `bash tests/run_tests.sh` runs the same steps without Docker if a C compiler, Node.js and Python 3 are installed (`npm ci && npx playwright install chromium` for step 5).

**CI** (continuous integration: GitHub runs these automatically, defined in `.github/workflows/ci.yml`) runs the same tests on every push to `main` and every pull request, builds the firmware in the same pinned container, and publishes Studio to GitHub Pages from `main`. Each run keeps its outputs as downloadable artifacts: `halo-studio` and `firmware-UNTESTED-on-hardware` (so named because an automatic build hasn't been tried on a keyboard).

## Regenerate the README screenshots and GIFs

```powershell
.\scripts\capture-media.ps1
```

Needs Docker and **ffmpeg** (a command-line video tool) on the PATH. No keyboard is needed.

- The script builds Studio into `dist\`, builds the `halo-composer-test` image from `tests/Dockerfile` (the same one `test.ps1` uses), and runs `scripts/capture_readme_media.js` in it with Playwright's Chromium.
- The capture script replaces the preview's clock with a virtual one and steps it frame by frame, so animations come out smooth however long each screenshot takes. Each GIF covers exactly one loop of its scene's animations (keypresses are scripted, and every reaction fades out before the loop point), so the end joins the start invisibly; the script checks this and prints a seam value (0 = perfect).
- Results go to a temporary folder (`%TEMP%\halo-media`). The PowerShell script copies the screenshots into `docs\media\` and turns each set of frames into a GIF with ffmpeg (about 14 fps; each frame shows for 7/100 s).
- Output in `docs\media\`: screenshots `studio-zones.png`, `studio-paint.png`, `studio-effects.png`, `studio-gradients.png`, `studio-halo-setup.png`, and seamless GIFs `studio-hero.gif` (full window), `factory-look.gif`, `comet-orbit.gif`, `keypress-glow.gif`, `back-and-forth.gif`. Each GIF has a still PNG with the same name, which can replace it in the README.
- It also prints a `file:// check` line (secure context, WebHID, storage) for a copy of Studio opened straight from disk.
- The capture script finds things by their labels (tab buttons, starter-scene names, "Start placing"). Renaming those in Studio means updating `capture_readme_media.js` too.

## Talk to the real keyboard

`tools/halo_kb.py` is a command-line tool that talks to the keyboard over USB. Close VIA and Studio first (two programs on the same channel confuse each other), and use the cable in wired mode.

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
| Key or halo positions | Edit `tools/gen_geometry.py` (`CALIBRATED`, with `None` for a halo LED that isn't fitted; `GROUP_RANGES` for the halo areas Studio's quick-selects use) and run it (`python tools/gen_geometry.py`). It rewrites `firmware/keymap/composer/hc_board_geometry.c` and `studio/geometry.json`. Then update the points in `firmware/keymap/keymap.c` with the output of `python tools/gen_geometry.py points`. Ring order uses the same math as Studio's *Recompute ring order* |
| The ryodeushii base commit | Update `QMK_COMMIT` in `firmware/base.env`, rebuild, and check that `nuphy-shared.diff` still applies and that `side_led_show()` still has the same shape. `keymap.c` carries a copy of `keymaps/default/keymap.c`'s layers: re-copy them if upstream changed. `make_via_json.py` fails if ryodeushii's custom keycode list changed, since `HC_TOGGLE` must be the next one |
| The RGB-matrix effect list | The static assert in `keymap.c` requires Composer to be mode 43 (its VIA dropdown index). Update `tools/make_via_json.py` together with it |
| Studio labels used by `scripts/capture_readme_media.js` | Update the capture script, then re-run `capture-media.ps1` |

## Repository conventions

- Line endings: LF everywhere except `.ps1` and `.cmd` (CRLF), enforced by `.gitattributes`.
- `build/`, `dist/`, `backups/` (personal keyboard backups) and local notes folders are ignored by Git (`.gitignore`).
- License: GPL-2.0-or-later, matching QMK and ryodeushii's firmware (see [LICENSE.md](../LICENSE.md)).

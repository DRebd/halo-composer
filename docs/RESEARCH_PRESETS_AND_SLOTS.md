# Research: editable presets and multiple scene slots

Feasibility study, 2026-09-25. Nothing in the firmware was changed, and the keyboard was not contacted. Paths starting `qmk/` mean `build/qmk_firmware/` (ryodeushii @ `9847cb8`).
Labels: **[V]** verified in source or data (path:line or value), **[I]** inferred from verified facts, **[G]** guess or recalled figure (verify it).

## Short answer

1. **"18 presets" does not match the source.** It has **42 key effects** (43 with Composer) and **4 halo modes plus Off**. See section 0.
2. **Route A (make every stock effect editable) is possible but poor value.** Each effect would have to be rewritten, and that clashes with upstream QMK, VIA, the 6-bit mode limit and Studio's preview.
3. **Cheaper:** recreate the stock looks as Composer scenes (about 32 of 42 map directly), plus an optional small hook so each stock effect remembers its own color and speed.
4. **Route B (several scenes on the keyboard) is feasible.** Best option: a small store in unused flash holding **8 full scenes in 10 KB**. It gives VIA its macro space back, and scenes survive the Esc-hold wipe. The quick-and-dirty version fits **2 scenes** in the existing EEPROM block and leaves 570 B for macros.
5. **RAM is not the limit**, because only one scene is ever in RAM. The real limits are stack buffers during a save, safety if power is lost mid-write, and keeping Studio in sync.

**Terms used below:**
- **Flash** is the chip's 128 KB of permanent memory. It holds the program, and it is erased in 2 KB blocks called **pages**.
- **EEPROM** is settings storage. This chip has none, so QMK **emulates** 4 KB of it inside 8 KB of flash. Changes go into a **write log**. When the log is full, all 4 pages are erased and rewritten. That rewrite is called **compaction**.
- **Wear leveling** means spreading erases over many pages, because each page survives only a limited number of erases.
- **RAM** is the 16 KB of working memory, wiped at power-off.
- **Stack** is the part of RAM used for temporary data while code runs.
- **CRC** is a checksum. It tells you whether stored data is intact.

## 0. How many built-in effects are there?

| What | Count | Evidence |
|---|---|---|
| QMK effects enabled for this board | 39 | [V] `qmk/keyboards/nuphy/halo75v2/ansi/keyboard.json:73-113` |
| + Solid Color (always built in) + NuPhy `game_mode`, `position_mode` | 42 | [V] VIA list in `.../keymaps/default/NuPhy Halo75v2 via3.json` (plus "All Off", index 0, which Fn+← never reaches) |
| + Composer | 43 | [V] `firmware/keymap/keymap.c:11` (`RGB_MATRIX_CUSTOM_composer == 43`) |
| Halo modes (NuPhy `side.c`) | Wave, Mix, Static, Breath + Off | [V] `qmk/.../halo75v2/ansi/side.c:33-37`, `319-338` |

- NuPhy's own VIA file (`nuphy-halo75-v2-via.json`, from NuPhy's download page) lists the same 42 [V]. The stock 2.1.5 binary itself was not inspected.
- Fn+← (`RM_NEXT`) steps through all of them [V] `default/keymap.c:25`, and there is no skip list [V: grep].
- Why someone might count about 18 [G]: 12 reactive/splash effects and Typing Heatmap look like a solid color (or dark) until you type, and `game_mode` and `position_mode` light only a few keys.

## 1. Route A: editable presets

**How stock effects are written [V].**
- Each QMK effect is a few lines of math that receive **one** global hue/saturation/value and **one** global speed. See `qmk/quantum/rgb_matrix/animations/runners/effect_runner_i.h:5-14`.
- Those values live in an 8-byte settings record shared by every effect, `rgb_config_t` (`qmk/quantum/rgb_matrix/rgb_matrix_types.h:78-87`).
- Stock effects skip the halo: its LEDs carry flag `NONE` (`firmware/keymap/keymap.c:30-31`). NuPhy's `side.c` draws the halo separately with one color, 5 speeds and 6 brightness steps (`side.c:44-46`). "Mix" is a fixed color table (`side.h`, `flow_rainbow_color_tab`).

**What "editable" could realistically mean [I]:**

| Family | Realistic knobs |
|---|---|
| Solid, gradients, game/position mode | Per-key colors. That is exactly a Composer scene. |
| Breathing, bands, pinwheel/spiral sat/val | Color(s), speed, band width, direction, min/max brightness |
| Cycles, beacons, pinwheels, hue effects | Palette or gradient instead of the full rainbow, speed, direction, saturation |
| Raindrops, jellybean, digital rain | Palette, density, speed |
| Reactive, splash, heatmap | Base color, hit color, fade time, shape |

**Ways to do it:**

- **A-lite (no QMK core edits).**
  - **Per-effect memory [I]:** each stock effect remembers its own hue, saturation and speed. That is a 42 × 3 B = 126 B table, swapped into `rgb_matrix_config` whenever the mode changes.
  - **Palette hook [V]:** QMK's color conversion `rgb_matrix_hsv_to_rgb()` is a replaceable ("weak") function (`qmk/quantum/rgb_matrix/rgb_matrix.c:37`). Every stock effect except Digital Rain passes its color through it; Digital Rain hard-codes green (`digital_rain_anim.h:48-51`). Replacing that function could map the rainbow onto a Studio gradient, per effect, for about 26 B each.
  - **Limit [V]:** the hook doesn't know which LED it is coloring, so there is no per-key editing. An overlay can repaint LEDs afterwards, but it can't read what the effect drew: `drivers/led/issi/is31fl3733.c` has `set_color` and no read-back.
- **A-full.** Copy each effect into our code with extra parameters, then disable the original.

**Concerns with A-full:**
- **Mode limit [V]:** the mode field is 6 bits, so at most 64 modes (`rgb_matrix_types.h:82`). 44 are used today, counting "off". Editable copies can't sit alongside the 39 originals; they must replace them. That changes the VIA effect list (`tools/make_via_json.py`) [I].
- **EEPROM [I]:** about 8-12 B of settings × 42 effects ≈ 340-500 B, taken from macros (1,485 B down to about 1,000 B).
- **Flash:** fine; about 38 KB is free. **RAM:** tiny [I].
- **VIA:** VIA only knows one global color and speed, so the new settings would be Studio-only [I].
- **Upstream:** editing `qmk/quantum/rgb_matrix/animations/*` (QMK core) causes merge conflicts every time ryodeushii syncs with QMK. Forking the effects into our folder avoids the conflicts but stops us receiving upstream fixes [I].
- **Testing:** Studio's preview matches the keyboard byte for byte only for Composer's engine (80 fuzzed scenes, `docs/HOW_IT_WORKS.md:165`) [V]. Every editable stock effect would need a JavaScript twin plus parity tests; without them, users edit blind [I].
- **Halo:** making the halo richer means rewriting `side.c`, which Composer already does. More `side.c` patches also mean more upstream conflicts [I].
- **Battery and CPU:** the QMK main loop runs continuously while the keyboard is awake [I]. Heavier effect math therefore costs frame time more than battery. Battery drain is dominated by LED brightness × how many LEDs are lit [G], and neither route changes that.

**Cheaper alternative: stock looks as Composer scenes [I, from reading both effect sets].**
- **Direct (32):**
  - Solid; Gradient Up/Down and Left/Right; Breathing; Band Sat/Val
  - Pinwheel and Spiral Sat/Val; the 6 Cycles; Dual/Rainbow Beacon; Rainbow Pinwheels
  - the 3 Hue effects; Raindrops; Typing Heatmap
  - Reactive Simple, Reactive, Wide and Multiwide; Solid (Multi)Splash
  - `game_mode` and `position_mode`
  - all 4 halo modes: Wave on the Ring axis, Mix = Color cycle, Static, Breath
- **Approximate (5):** Splash, MultiSplash, Jellybean Raindrops, Rainbow Moving Chevron, Cycle Out/In Dual.
- **Missing (5):** Digital Rain, and Reactive Cross, MultiCross, Nexus and MultiNexus. Covering them needs 2 new engine features (a falling-columns effect and a cross-shaped key-press overlay), written in C and JS, with parity tests.
- This is mostly Studio work (a preset library). It needs no QMK core edits and no extra EEPROM, and the stock modes stay available.

**Verdict:** don't do A-full. Do the Composer-scene library. A-lite is an optional extra.

## 2. Route B: several scenes on the keyboard

**Today's EEPROM layout (Composer build, 4,096 B total).**
- **Driver [V]:** this board uses QMK's *legacy* emulated-flash EEPROM, not the wear-leveling driver.
  - STM32F072xB defaults to it: `qmk/builddefs/common_features.mk:222`, and the build contains `eeprom_legacy_emulated_flash.o`.
  - Size: 4 pages × 2 KB, half data and half write log (`qmk/platforms/chibios/drivers/eeprom/eeprom_legacy_emulated_flash_defs.h:28-33, 108`). So `TOTAL_EEPROM_BYTE_COUNT` = `FEE_DENSITY_BYTES` = 4,096 (`qmk/platforms/eeprom.h:59`).
  - It also keeps a **4 KB copy in RAM** (`eeprom_legacy_emulated_flash.c:58, 153`).
  - "Wear-leveling backing size" (`WEAR_LEVELING_BACKING_SIZE`) does not apply to this board.

| Bytes | Contents | Size | Source |
|---|---|---|---|
| 0-36 | QMK core settings (`eeprom_core_t`) | 37 | [V] `qmk/quantum/nvm/eeprom/nvm_eeprom_eeconfig_internal.h:13-33, 61` |
| 37-40 | VIA magic + layout option | 4 | [V] `nvm_eeprom_via_internal.h:12-22` |
| 41-63 | NuPhy `keyboard_config` | 23 | [V] `common/config/config_size.h:3` |
| 64-978 | Composer scene | 915 | [V] `firmware/keymap/config.h:10`, `hc_qmk.c:14` |
| 979-2610 | VIA keymaps: 8 layers × 6 × 17 × 2 B | 1,632 | [V] `keyboard.json:27`, `nvm_dynamic_keymap.c:41` |
| 2611-4095 | **VIA macros = everything left** | **1,485** | [V] formula `nvm_dynamic_keymap.c:68` |

- Without Composer, ryodeushii's `via` build has **2,400 B** of macros [computed]. The 2,411 B in the docs was measured on NuPhy's stock 2.1.5 (`backups/stock-2.1.5_...json`), which uses a different layout.
- The build fails if fewer than 100 B are left for macros [V] `nvm_dynamic_keymap.c:60`.

### (a) Take more of the macro space

Bytes left for macros ("✗" = doesn't fit or fails the 100 B check). A full scene is 915 B.
- "Shared calibration" stores `halo_xy` + `halo_ring` (135 B) once, so each slot is 780 B.
- "Palette" slots are about 442 B each (option c).
- The default keymap uses layers 0-4, so 5 layers is the minimum. Lowering `DYNAMIC_KEYMAP_LAYER_COUNT` in our `config.h` is [I].

| Slots | 8 layers (today) | 6 layers | 5 layers |
|---|---|---|---|
| 1 full (today) | 1,485 | 1,893 | 2,097 |
| 2 full | **570** | 978 | 1,182 |
| 3 full | ✗ (-345) | ✗ (63) | 267 |
| 2 / 3 shared calibration | 705 / ✗ | 1,113 / 333 | 1,317 / 537 |
| 4 / 5 palette + shared calibration | **497** / ✗ (55) | 905 / 463 | 1,109 / 667 |

- **Growing the emulated EEPROM instead** costs RAM byte for byte, because of the 4 KB RAM copy [V line 58]. Only 1,496 B of RAM is free, so no.
- **Risk [V/I]:** compaction erases **all 4 EEPROM pages and then rewrites them** (`eeprom_legacy_emulated_flash.c:319-340`). A power cut in that window (roughly 0.1-0.2 s [G]) loses keymaps, NuPhy settings and every scene together.
  - A full-scene save uses about 1.8 KB of the 4 KB log (4-byte entries per changed word above address 128). So a compaction happens about every 2nd full save [I].
- **Risk [V/I]:** any change to the block size moves VIA's keymaps. The first-boot guard (`hc_qmk.c:41-56`) only fires when the scene is invalid, so bump `HC_SCENE_VERSION` in the same change.

### (b) Store scenes in unused flash

**Flash map [V/computed]:**

| Address | Contents |
|---|---|
| `0x08000000-0x080144AF` | Program (83,120 B) |
| `0x080144B0-0x0801DFFF` | **Free: 39,760 B, i.e. 19 whole pages (#41-59)** |
| `0x0801E000-0x0801FFFF` | Emulated EEPROM (`..._defs.h:72`) |

The "about 45 KB unused" figure counts the EEPROM's 8 KB as free.

- **Write rules [V/I]:**
  - Erase is per 2 KB page (`..._defs.h:30`); erased cells read `0xFF`.
  - Writes are 16-bit (`legacy_flash_ops.h:37`). Each cell can be written once, then its whole page must be erased before it can change [I, driver line 352 logic].
  - Timing, from ST's datasheet as recalled [G]: page erase about 20-40 ms, 16-bit write about 50 µs. So one save is about 0.1 s.
  - The CPU runs from the same flash, so keys, USB and the wireless link **stall** during an erase: delayed, probably not lost [I].
- **Wear [G/I]:**
  - About 10,000 erases per page (ST datasheet figure, verify).
  - Rotating across 5 pages gives about 50,000 saves, or about 13 years at 10 saves a day.
  - A runaway autosave bug could wear out a page in about 17 minutes. The firmware must skip unchanged saves and rate-limit (e.g. at most one save every 2 s).
- **Power loss [I]:** write the new copy first, with a sequence number and a CRC32, into an erased **spare page**. Erase the old page only after the new copy checks out. At boot, the newest valid copy wins, so the worst case is losing the save in progress.
- **Existing helpers [V]:**
  - QMK's `legacy_flash_ops.c` (unlock, erase page, write half-word) is already compiled into this firmware.
  - QMK ships a test mock for it: `qmk/platforms/test/legacy_flash_ops_mock.c`.
  - ChibiOS has an embedded-flash (EFL) driver for the F0 (`ports/STM32/STM32F0xx/platform.mk:5`), but it isn't enabled in `halconf.h`.
  - QMK's wear-leveling module is a single global instance with its own RAM cache (`qmk/quantum/wear_leveling/wear_leveling.c:163`), so it can't serve as a second store.
  - So we'd write a small custom store, about 200-300 lines [G].
- **Reserving the space [V/I]:** the linker script gives the program all 128 KB (`lib/chibios/.../ld/STM32F072xB.ld:22`), and nothing stops future code from growing into the slots. Add a build check: image ≤ 112,640 B.
- **Proposal:** the top 5 free pages (`0x0801B800-0x0801DFFF`, 10 KB) hold 4 pages × 2 scenes = **8 full slots**, plus 1 spare page. Calibration is stored once, as its own record.
  - That leaves about 28 KB for code growth. Composer itself added 8.8 KB.
  - With the scene moved out of EEPROM, macros go back to **about 2,390 B**.
- **Bonus [V/I]:** the Esc-hold wipe erases only the 4 EEPROM pages (`eeprom_driver_format` → `eeprom_clear`, lines 295-305). QMK Toolbox only erases pages the new image covers [I; verify]. Scenes and calibration would therefore survive re-flashes, which fixes the `docs/PLAN.md` risk "Each Esc-held flash wipes saved settings". The flip side: Studio needs a "wipe slots" command, and slots need a version byte.

### (c) Smaller slots

- **Share calibration and ring order:** saves 135 B per slot (15%). Easy; do it in any option.
- **Palette slots:**
  - Format: a 16-color palette (48 B) plus 1 byte per LED (4-bit color index, 3-bit zone, the no-react flag) = 176 B instead of 512 B. With zones and gradients, a slot is about 442 B (-52%).
  - They are lossy only when a scene paints more than 16 distinct colors; gradient and rainbow sources are computed, not stored [V `hc_engine.h:64-70`].
  - Cost: a JS encoder, a C decoder and tests.
- **"Look variants":** a slot stores only zones, gradients and flags (about 265 B) and reuses another slot's paint. Good for "same colors, different animation".
- **Byte diffs and general compression:** not recommended. Sizes vary, the worst case saves nothing, and diffs silently change meaning when their base scene is edited.

## 3. Other points

- **Fn shortcut [V]:**
  - Fn+1…4 are already taken by Bluetooth 1-3 and 2.4 GHz (`default/keymap.c:21, 37`).
  - The Fn+M layer's number row is empty (`default/keymap.c:43-49`), so use **Fn+M+1…8** for slots and Fn+M+0 for "next". The existing roadmap already says Fn+M+1…4.
  - New keycodes go in QMK's user range starting at `QK_USER_0` = `0x7E40`. NuPhy uses the range from `QK_KB_0` (`keys.h:7`, `qmk/quantum/keycodes.h:91-94`).
  - Handle them in our `process_record_user` (`keymap.c:40-43`), and flash the number key as feedback. This works in wireless mode too.
  - Switching is a copy into `hc_scene` taking microseconds. Remembering the active slot costs 1 EEPROM byte; write it a few seconds late so cycling through slots doesn't cause wear [I].
- **Your preference: Cmd+Fn+1…8 (added 2026-09-25) [V/I].** Yes, this works, with one detail to handle.
  - The key left of Fn is right Cmd on the Mac layer and right Alt on the Windows layer (`KC_RCMD` / `KC_RALT` in `keymap.c`). On both Fn layers it is currently unused (transparent) [V].
  - **Fn first, then Cmd:** map that key on the Fn layers to a new "scenes" layer (`MO(5)`). Holding Fn+Cmd then turns 1…8 into slot keys, and nothing reaches the computer, because on the Fn layer the key is a layer switch, not Cmd [I].
  - **Cmd first, then Fn:** the computer has already been told "Cmd is down", and Fn+1…4 would pick a Bluetooth/2.4 GHz device. Our `process_record_user` would catch number keys while that key and Fn are both held, switch the slot instead, and tap a dummy key before Cmd/Alt is released. The dummy key matters on Windows, where tapping Alt alone opens app menus (QMK's usual trick for this) [I].
  - Cost: about 40 lines on top of the slot store. Test both press orders on Mac and Windows [G].
- **Studio sync [V/I]:**
  - Studio sends only the changed ("dirty") parts (`studio/studio_b.js:202-256`). A keyboard-side switch in the middle of an editing session would leave a **mixed** scene.
  - Fix: add a scene-generation counter and the active slot to `GET_INFO` (protocol v2). Studio re-reads when they change. Optionally, ignore slot keys for about 10 s after the last Studio command.
- **RAM [V/I]:**
  - Only one scene lives in RAM (915 B) in every option. The 4 KB EEPROM copy is a fixed size whatever it holds, and flash can be read directly, so switching needs no extra RAM.
  - Watch-out: `eeprom_update_block` puts a buffer as large as the data on the stack (`qmk/drivers/eeprom/eeprom_driver.c:53`). A 915 B save already uses about 45% of the 2 KB stack the main loop runs on (`platform.mk:9`; `crt0_v6m.S:71-72` selects that stack).
  - So save at most one scene per call, and encode or decode palette slots in pieces.
  - Crossfades between slots would need a second scene in RAM (915 of the 1,496 B free), so no.

## 4. Comparison

| Option | Slots | Macros left | New code | Main risk |
|---|---|---|---|---|
| A-full (editable stock effects) | n/a | about 1,000 B | Large, touches QMK core | Upstream conflicts, no preview, 64-mode cap |
| A-lite (per-effect memory + palette hook) | n/a | about 1,360 B | Small | Global only, no per-key editing |
| Stock looks as Composer scenes | Studio library | unchanged | Studio + 2 engine features | Some looks approximate |
| B(a) 2 full scenes in EEPROM | 2 | 570 B | Very small | Compaction power cut loses everything |
| B(a)+(c) palette, 8 layers | 4 | 497 B | Medium (codec) | Colors capped at 16, same compaction risk |
| **B(b) flash store** | **8** (16 in 18 KB) | **about 2,390 B** | Medium (store) | Flash-code bugs, save stalls, code-growth guard |

## 5. Recommendation

1. **Skip A-full.** Build the stock looks as Composer starter scenes in Studio. Add the Cross overlay and Digital Rain only if you miss them. A-lite is optional.
2. **Route B = B(b):** 8 full-fidelity flash slots in 10 KB, shared calibration, the active scene moved out of EEPROM, **Cmd+Fn+1…8** (your choice; Fn+M+1…8 as a fallback), and protocol v2 with a generation counter. Effort [G]: roughly 300-500 lines of firmware, plus a Studio slot panel and host tests using QMK's flash mock.
3. **Quick fallback:** B(a) with 2 full slots, about 50 lines. Remember to bump `HC_SCENE_VERSION`.
4. The `docs/FLASHING.md` checklist passed on 2026-09-25, so this is unblocked. Nothing has been started.

## 6. What we'd need to verify on the hardware

- ~~The macro size the Composer firmware reports. Expected: 1,485 B.~~ **Confirmed 1,485 B** on the keyboard (2026-09-25).
- How long an `HC_SAVE` freezes the keyboard today, and whether typing, USB or 2.4 GHz glitch during an EEPROM compaction or a flash page erase.
- Stack high-water mark during a save; add a `GET_STATS` field for it.
- That QMK Toolbox re-flashing and the Esc-hold wipe leave a test page in the free flash untouched.
- A power-switch-off in the middle of a save (on battery), then confirm the fallback copy loads.
- Fn+← count on the Composer firmware. Expected: 43 steps.
- Cmd+Fn+number in both press orders sends no stray Cmd/Alt to the computer (Mac and Windows).

## Sources read

- `firmware/keymap/`: `config.h`, `rules.mk`, `keymap.c`, `rgb_matrix_user.inc`, `composer/hc_engine.h`, `hc_qmk.c`, `hc_qmk.h`, `hc_protocol.h`
- `firmware/patches/nuphy-shared.diff`, `firmware/base.env`
- `studio/studio_b.js`; `docs/HOW_IT_WORKS.md`, `PLAN.md`, `BACKGROUND.md`, `FLASHING.md`
- `backups/stock-2.1.5_2026-09-23_2346.json`
- `qmk/keyboards/nuphy/halo75v2/ansi/`: `keyboard.json`, `config.h`, `rules.mk`, `side.c`, `side.h`, `halconf.h`, `keymaps/default/{keymap.c, rgb_matrix_user.inc, NuPhy Halo75v2 via3.json}`, `keymaps/via/*`
- `qmk/keyboards/nuphy/common/`: `config/{config.c, config.h, config_size.h, via.c}`, `core/keys.h`, `rules.mk`
- `qmk/quantum/`: `nvm/eeprom/{nvm_dynamic_keymap.c, nvm_eeprom_via_internal.h, nvm_eeprom_eeconfig_internal.h, nvm_via.c}`, `via.c`, `via.h`, `dynamic_keymap.h`, `keycodes.h`, `eeconfig.h`, `rgb_matrix/{rgb_matrix.c, rgb_matrix_types.h, animations/*.h, runners/*.h}`, `wear_leveling/wear_leveling.c`
- `qmk/platforms/`: `eeprom.h`, `chibios/{platform.mk, mcu_selection.mk, drivers/eeprom/eeprom_legacy_emulated_flash{.c,_defs.h}, drivers/flash/legacy_flash_ops.{c,h}, drivers/wear_leveling/wear_leveling_efl_config.h}`, `test/legacy_flash_ops_mock.c`
- `qmk/drivers/eeprom/eeprom_driver.c`, `qmk/drivers/led/issi/is31fl3733.c`, `qmk/builddefs/common_features.mk`
- `qmk/lib/chibios/.../ld/STM32F072xB.ld`, `.../GCC/crt0_v6m.S`, `.../ports/STM32/STM32F0xx/platform.mk`
- `qmk/.build/obj_nuphy_halo75v2_ansi_via/cflags.txt`
- `nuphy-halo75-v2-via.json` (NuPhy's VIA definition)

# Plan, assessment and status

*Last updated 2026-09-25.* This records what the original claude.ai conversation proposed, what Claude Code checked, what changed and why, what's verified, and what's left.

## TL;DR

- The design from the chat **held up**. Its firmware builds, its lighting math matches the editor exactly, and its protocol works end to end against the real firmware code running as a simulated keyboard.
- Claude Code found and fixed **one serious firmware hazard** (keys could read leftover data after switching firmware) and **12 bugs in the editor**. Three of those could corrupt what gets saved to the keyboard or wipe the halo calibration. Every fix has an automated test that fails on the original code and passes now.
- It's packaged as a public repo with one-command builds and tests, automatic builds on GitHub, and the editor hosted at **https://drebd.github.io/halo-composer/**.
- **Hardware bring-up passed on 2026-09-25** ([results](FLASHING.md#results-2026-09-25)). Only the day-long battery comparison is still open.
- Your notes from that session are in the **2026-09-25 update**: Fn+Enter, magenta Caps Lock, the new default look, the Ripple reach setting and Studio fixes. It passed on the keyboard ([Stage 4](FLASHING.md#stage-4-after-flashing-the-2026-09-25-update)) and is ready to publish as the first release.
- The hardware condition you set for roadmap features is now met. None have been started.

## Where this came from

On 2026-09-23 a claude.ai conversation ("Nuphy Halo75 warning message") went from a VIA warning to a full design:

1. **VIA errors** ("Receiving incorrect response"): caused by two apps talking to the keyboard at once. Fixed by closing the other tab and using wired mode.
2. **Research:** NuPhy's QMK/VIA exposes one backlight color and no halo control. No existing firmware does per-key shades or a halo that breathes 50–100%. See [BACKGROUND.md](BACKGROUND.md).
3. **The build:** *Halo Composer* (a lighting engine inside ryodeushii's firmware) plus *Halo Studio* (a WebHID editor). Everything went into one handoff file, [`chat-handoff/HALO_COMPOSER.md`](../chat-handoff/HALO_COMPOSER.md), with 33 embedded source files and a bring-up plan for Claude Code.

The chat's transcript, its three output files and the lighting cheat-sheet page it published were imported into this folder. The transcript is kept locally only, in `chat-handoff/transcript/`, and is not published.

## Decisions made with you (2026-09-23)

| Question | Decision |
|---|---|
| Repo shape | **Standalone repo** holding only our code. Builds pull ryodeushii's firmware at a pinned commit. |
| Hosting the editor | **GitHub Pages**, so there's nothing to install or run locally. |
| Touching the keyboard overnight | **Read-only backup only.** Nothing was written to it. |
| Scope | Harden and fix what exists. **Roadmap features only after the current features pass on real hardware.** |

## Assessment: what held up, what changed

### Verified as the chat described

| Claim in the handoff | Result here |
|---|---|
| Firmware compiles for `nuphy/halo75v2/ansi:composer` with no warnings | ✅ Reproduced in QMK's official container. The binary is 83,120 bytes vs the chat's 87,264, because this container uses a newer compiler (GCC 15.2 vs 13.2). |
| C engine and JS engine are byte-identical | ✅ 80 fuzzed scenes × 40 frames × 128 LEDs, plus unit vectors |
| Studio passes end to end against the real protocol code | ✅ 7/7 original checks, now 16/16 with the regression checks |
| RAM headroom ≈ 1.5 KB | ✅ 1,496 bytes of free heap. Stacks are fixed (1 KB main, 2 KB process). The stock `via` build has 2,616. |
| Base: ryodeushii `nuphy-keyboards` @ `9847cb8` (2026-07-24) | ✅ Pinned in `firmware/base.env` |

### Changed, and why

| # | Change | Why |
|---|---|---|
| 1 | **Firmware: guard VIA's keymap storage on first boot** (`hc_qmk.c`, `hc_load`) | The 915-byte scene enlarges VIA's settings block, which *moves* where VIA stores keymaps. VIA only checks the build date to decide whether storage is valid, so moving between ryodeushii's `via` build and Composer built the same day, without an Esc-held flash (e.g. via the recovery button), would read leftover bytes as keycodes. The keyboard would type garbage. Now, if no valid scene is found at boot, VIA's storage is reset to the keymap defaults. Tested: first boot, normal reboot, reboot after other firmware, and RELOAD never resets. |
| 2 | **Firmware: hide status-bar indicators during halo calibration** | Caps-lock and OS indicators light halo LEDs 83–87, which would confuse "click the lit LED" in the calibration wizard. |
| 3 | **Firmware: compile-time check that Composer is effect #43** | The VIA definition's Effect dropdown depends on it. |
| 4 | **Editor: 12 bugs from an independent review, plus 3 found directly** | Worst ones: switching scenes mid-sync could leave a mix on the keyboard; Save could run before pending edits were sent; buttons could act on the *previous* selection; any starter scene wiped your halo calibration; a failed connect looked connected; a keyboard without Composer just "timed out". All fixed. 9 new end-to-end checks; 6 of them fail on the original editor, proving they catch the bugs. |
| 5 | **Two-stage flash**: ryodeushii's plain `via` firmware first, then Composer | ryodeushii's July 2026 code has no public release. Checking typing, wireless and sleep on it alone means any problem after the Composer flash is ours, not his. |
| 6 | **No keymap restore needed** (the chat planned a VIA layout backup and restore) | The backup shows your layout is NuPhy's factory default: no custom keys, no macros. Composer ships the equivalent layout. A blind restore would *break* Fn+arrow lighting, because NuPhy's older firmware numbers those keys differently (old `RGB_*` codes now mean `UG_*`, which this board doesn't use). The backup is kept in `backups/` anyway. |
| 7 | **Editor hosted on GitHub Pages** instead of `python -m http.server` | WebHID works on any https page. Nothing to install. |
| 8 | **Docker build with a pinned container and source commit**; `scripts/build-firmware.ps1` | Repeatable builds on Windows with no toolchain install. A build takes about a minute. |
| 9 | **CI on GitHub**: tests, firmware and Pages on every push | Catches regressions; firmware downloads come from the same pinned recipe. |
| 10 | **`tools/halo_kb.py`** | Read-only backup (used overnight), plus `status`, `selftest`, `walk`, and `scene-backup`/`scene-restore` for real-keyboard testing and for keeping your calibration across re-flashes. |
| 11 | **Test runner fixed**: the end-to-end test never reported failure | It printed FAIL but exited "success", so CI would have stayed green on failures. |

### From the chat, but not verifiable without the keyboard

- ~~Where the 45 halo LEDs physically sit~~: **measured 2026-09-25** with the calibration wizard and built into the defaults. LEDs 9, 10 and 45 have no LED fitted.
- ~~Hardware recovery button under the Caps Lock keycap~~: **now confirmed** by ryodeushii's readme and recovery instructions (remove the Caps Lock keycap and hold the small button beside the switch while plugging in). NuPhy's own page only describes Esc-hold.
- **Two unexplained NuPhy keycodes** on Fn+M+R and Fn+M+T in your stock firmware (confirmed in your backup as custom keycodes #23 and #24). They exist in neither NuPhy's nor ryodeushii's source, so they disappear after flashing. NuPhy doesn't document what they do.
- ~~Frame rate on the 48 MHz chip~~: **measured 2026-09-25**. 40 fps (the firmware's ceiling), and 30 fps with ripples under 31 simulated key presses per second.

## Verification

Run everything locally with `.\scripts\test.ps1` (Docker needed). The same tests run on every push in CI.

| Check | Result |
|---|---|
| Engine compiles with `-Wall -Wextra -Wconversion -Wshadow -Werror` | pass |
| C ↔ JS parity: 80 scenes, 3,200 frames × 128 LEDs, sin/hsv/atan2/isqrt vectors | byte-identical |
| Protocol checks vs a simulated keyboard (the real `hc_qmk.c` built for the PC) | 43/43 |
| Studio end to end in headless Chrome vs that simulated keyboard | 18/18 |
| Firmware builds: `via` (fallback) and `composer` | 74,328 and 83,192 bytes |
| RAM headroom (composer) | 1,496 bytes free heap |

**On the physical keyboard:** checklist Stages 1–4 passed on 2026-09-25 (self-test 27/27 on both builds). Stage 4 covered the 2026-09-25 update: [FLASHING.md](FLASHING.md#part-3-bring-up-checklist).

## What's left

1. ~~Hardware session~~: done 2026-09-25 (Stages 1–3).
2. ~~Feed the calibrated halo positions into `tools/gen_geometry.py`~~: done.
3. ~~Flash the 2026-09-25 update and tick Stage 4~~: passed 2026-09-25.
4. Tag a first release on GitHub with the `.bin` files that passed Stage 4 (ready; waiting for your go-ahead).
5. The day-long battery comparison.
6. Roadmap features (below), when you want them.

## Risks and open questions

| Risk | Impact | Mitigation |
|---|---|---|
| Flash fails or the new firmware won't start | Keyboard unusable until re-flashed | Keep NuPhy's 2.1.5 `.bin`. The flashing mode itself (STM32 DFU) is in the chip's read-only memory and can't be overwritten. But *Esc-hold* is detected by the firmware, so if a firmware doesn't start at all, use the hardware recovery button under the Caps Lock keycap (confirmed in ryodeushii's docs). Stage 1 of the flash uses ryodeushii's `via` build, which is widely used, before Composer. |
| Unreleased ryodeushii base misbehaves (wireless, sleep, battery) | Daily annoyance | Stage 1 of the flash tests his code alone. The last public release (ryo-1.1.4, Sep 2024) could be a fallback base: the engine is portable, but the hooks would need adapting. |
| Lighting too slow on the M0 chip with heavy scenes (ripples + 8 recent key presses) | Laggy animation, or in the worst case typing latency | Measure with `halo_kb.py selftest`. Rendering is spread over 32 small slices per frame, and the engine can cache per-LED geometry if needed. |
| Battery life with the halo always lit | Shorter wireless use | Compare against stock over a day (checklist item). |
| Macro space drops from 2,400 to 1,485 bytes | Fewer or shorter VIA macros | You use none today. |
| Each Esc-held flash wipes saved settings, including the Composer scene | Re-setup after each update | The calibration is built into the defaults now, and so is your look. For a custom scene: `halo_kb.py scene-backup` before flashing and `scene-restore --save` after. Studio also keeps your scenes in the browser. A flash-based scene store (roadmap) would survive flashes. |

## Roadmap (unblocked 2026-09-25; nothing started)

Ideas carried over from the chat's research, with feasibility notes, are in [BACKGROUND.md](BACKGROUND.md#roadmap). In the order that seems most useful:

1. **White balance per group** (keys vs halo): the halo diffuser tints light differently from keycaps. Cheap.
2. **Layer-aware lighting**: hold Fn and the active keys glow. Cheap.
3. **Several saved scenes on Cmd+Fn+1…8**: best as a small store in unused flash (8 full scenes). See [RESEARCH_PRESETS_AND_SLOTS.md](RESEARCH_PRESETS_AND_SLOTS.md).
4. **Battery gauge on the function row**: Fn+\ lights Esc…F12 as a bar in the battery's color (your idea).
5. **Host-driven effects** (notifications, screen-edge ambience, audio): the editor or a small tray app streams over USB.

## Timeline

| When (PDT) | What |
|---|---|
| 2026-09-23, 8:54 AM – 3:14 PM | claude.ai conversation designs and builds Halo Composer + Halo Studio (sandbox only) |
| 2026-09-23, ~10:40 PM | Claude Code session: imports the chat, reads the full transcript, asks four setup questions |
| 2026-09-23, 11:46 PM | Read-only keyboard backup |
| 2026-09-24, ~12:15 AM | Session work stopped early (a stopped turn, not the PC sleeping). Done by then: import, Docker builds, host tests, firmware fixes, editor review. |
| 2026-09-24, 12:12 PM | PC crashed or lost power (Windows logged an unexpected shutdown), unrelated to this work |
| 2026-09-24, afternoon | Editor fixes + regression tests, GitHub repo + CI + Pages, keyboard CLI, documentation |
| 2026-09-25, early morning | First flash: Stages 1–3 pass. Studied editable presets and scene slots. Update from your notes: Fn+Enter, magenta Caps Lock, measured halo layout, new default look with a mint flash and ripple, the Ripple reach setting, and Studio fixes |

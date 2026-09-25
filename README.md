# Halo Composer

**Per-LED lighting for the NuPhy Halo75 V2.** A replacement keyboard firmware plus a browser editor, *Halo Studio*, that let you:

- color **every one of the 128 LEDs** individually, including all 45 "halo" LEDs around the base;
- apply **effects that keep your colors** (breathe, wave, candle, comet, ripple, ...) instead of replacing them;
- split the board into **up to 8 zones**, each with its own effect, speed and brightness range. For example, keys that flash on a key press while the halo breathes slowly between 30% and 100%;
- use **multi-color gradients**, keypress reactions, starter scenes, and an animated preview that matches the keyboard exactly.

> [!WARNING]
> **Status (2026-09-25): running on a real Halo75 V2.** The bring-up checklist passed on the author's keyboard; a day-long battery comparison is still open ([results](docs/FLASHING.md#results-2026-09-25)). Each new build is also checked automatically (firmware build, lighting math, protocol, editor end to end). NuPhy's official firmware can always be flashed back.

| I want to... | Go to |
|---|---|
| Open the editor (Chrome or Edge on a desktop) | **https://drebd.github.io/halo-composer/** |
| Put the firmware on the keyboard, or go back to stock | [docs/FLASHING.md](docs/FLASHING.md) |
| Learn the editor and the keyboard shortcuts | [docs/USER_GUIDE.md](docs/USER_GUIDE.md) |
| See what ryodeushii's firmware and Halo Composer each add (one page) | [docs/WHATS_DIFFERENT.md](docs/WHATS_DIFFERENT.md) |
| See the plan, what changed from the original design, and what's verified | [docs/PLAN.md](docs/PLAN.md) |
| Read the study on editable presets and several stored scenes | [docs/RESEARCH_PRESETS_AND_SLOTS.md](docs/RESEARCH_PRESETS_AND_SLOTS.md) |
| Understand how it works (firmware, protocol, data format) | [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) |
| Read why NuPhy's "QMK/VIA" falls short, plus the research and roadmap | [docs/BACKGROUND.md](docs/BACKGROUND.md) |
| Build or test it (developers, Claude Code) | [docs/DEVELOPING.md](docs/DEVELOPING.md) |

## Plain-English glossary

| Term | Meaning |
|---|---|
| **Firmware** | The small program that runs *inside* the keyboard. It reads the keys and drives the lights. |
| **Flashing** | Replacing the keyboard's firmware with a new file (`.bin`). It's reversible: you can always flash NuPhy's original back. |
| **QMK** | The open-source keyboard firmware the Halo75 V2 runs. |
| **VIA** | A website (usevia.app) that remaps keys on QMK keyboards. Still works with this firmware. |
| **ryodeushii firmware** | A community-maintained improved version of NuPhy's QMK firmware. Halo Composer is built on top of it. |
| **Halo** | The light strip around the base, plus the small status bar and badge LEDs: 45 LEDs in total. |
| **Zone** | A group of LEDs that share one effect, speed and brightness range. You choose which LEDs go in which zone. |
| **Scene** | Everything about a look: per-LED colors, zones, gradients and halo layout. The keyboard stores one saved scene. Studio can keep as many as you like. |
| **EEPROM** | The keyboard's small permanent memory. "Save to keyboard" writes the scene there so it survives unplugging. |
| **WebHID** | The browser feature (Chrome/Edge) that lets a web page talk to a USB device after you approve it in a pop-up. |
| **Bootloader / DFU mode** | A special mode for receiving new firmware. On this keyboard you enter it by holding **Esc** while plugging in the cable. |

## How the pieces fit

```
Halo Studio (web page, Chrome/Edge) --USB cable, WebHID--> keyboard firmware
   editor + live preview                                     Halo Composer lighting engine
   (same lighting math as the firmware)                      + ryodeushii's firmware (typing, wireless, sleep)
                                                             + VIA still works for key remapping
```

The editor only talks to the keyboard over the **USB cable in wired mode**. The wireless radio is a separate chip that only carries keystrokes. The lighting runs on the keyboard itself, so a saved scene should look the same in Bluetooth and 2.4 GHz modes. That's on the bring-up checklist.

## What's in this repository

| Folder | Contents |
|---|---|
| `firmware/keymap/` | The Composer keymap: lighting engine (`composer/hc_engine.c`), USB protocol (`composer/hc_qmk.c`), key layout |
| `firmware/patches/` | Two small hooks into ryodeushii's code: one skips NuPhy's halo drawing while Composer is on, the other keeps LED power on |
| `firmware/base.env` | The exact ryodeushii version and build container used (pinned for repeatable builds) |
| `studio/` | Halo Studio source. `build_studio.py` bundles it into one HTML file |
| `tools/` | `halo_kb.py` (keyboard backup, status and self-test from the command line), geometry and VIA-definition generators |
| `tests/` | Engine parity test (C vs JavaScript), protocol tests against a simulated keyboard, browser end-to-end test |
| `scripts/` | `build-firmware.ps1` and `test.ps1`: one-command build and test on Windows (uses Docker) |
| `docs/` | Everything above |
| `chat-handoff/HALO_COMPOSER.md` | The original design document from the claude.ai conversation (historical) |

Firmware files are built automatically on every change and can be downloaded from the latest run on the [Actions tab](https://github.com/DRebd/halo-composer/actions). They're labelled *UNTESTED-on-hardware* because each automatic build is new. Files that passed the checklist on a real keyboard will be attached to tagged releases on the [Releases page](https://github.com/DRebd/halo-composer/releases).

## Credits and license

- [QMK Firmware](https://github.com/qmk/qmk_firmware) (GPL-2.0-or-later).
- [ryodeushii/qmk-firmware](https://github.com/ryodeushii/qmk-firmware): the community NuPhy firmware this builds on (GPL-2.0).
- NuPhy's published source ([nuphy-src/qmk_firmware](https://github.com/nuphy-src/qmk_firmware)).
- Halo Composer and Halo Studio were designed in a claude.ai conversation on 2026-09-23 and hardened in Claude Code on 2026-09-24.

Licensed under the GNU GPL v2 or later (see [LICENSE.md](LICENSE.md)), the same as the firmware it extends. Not affiliated with NuPhy.

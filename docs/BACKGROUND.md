# Background: why this exists, the research behind it, and the roadmap

Research done in the claude.ai conversation on 2026-09-23. Claims carry the sources that conversation cited. Claude Code re-checked the firmware-source claims on 2026-09-24; the others weren't re-checked.

## Why NuPhy's "QMK/VIA" feels hollow

The Halo75 V2 really does run QMK. NuPhy publishes GPL source, and VIA really does remap keys. What's missing is everything that makes QMK/VIA great on other boards:

- **Not in the official projects.** There are no NuPhy boards in `qmk/qmk_firmware`. NuPhy's Air75 V2 pull request (#22751) has been open since Dec 2023, and a QMK reviewer called it unmergeable because it adds its own lighting systems. The board isn't in VIA's keyboard list either, so you load a definition file by hand, which is where the warning you first asked about came from. Sources: https://github.com/qmk/qmk_firmware/pull/22751, https://github.com/the-via/keyboards
- **The halo bypasses QMK's lighting system.** NuPhy's `side.c` draws the 45 halo LEDs in its own loop with 8 preset colors. It isn't in the RGB matrix or in NuPhy's VIA definition, so VIA can't touch it. *(Re-verified in source 2026-09-24.)*
- **Source dumps, not development.** The `halo75_v2` folder has a handful of commits labelled "Fix bugs". Source pushes trail the binary releases (2.1.5 shipped 4 Mar 2025, its source 25 Mar). Your board's 2.1.5 has two custom keycodes (Fn+M+R, Fn+M+T) that aren't in the published source. *(Re-confirmed from your backup: custom keycodes #23 and #24 on layer 4.)* Sources: https://github.com/nuphy-src/qmk_firmware/commits/nuphy-keyboards, https://github.com/zhogov/nuphy-state-of-qmk-firmware
- **Closed wireless.** Bluetooth and 2.4 GHz run on a separate chip with closed firmware (QMK, RF and dongle firmware update separately). VIA and Halo Studio are wired-only. Source: https://nuphy.com/pages/qmk-firmwares
- **The community fixed the basics.** ryodeushii's firmware exists to fix wireless reliability, sleep, debounce and more. Source: https://github.com/ryodeushii/qmk-firmware
- **Direction of travel.** In Oct 2025 NuPhy moved new Halo V2 production to its own closed "NuPhyIO" firmware. Source: https://www.notebookcheck.net/NuPhy-updates-Halo-V2-wireless-mechanical-keyboards-for-up-to-4X-battery-life-improvements-and-there-s-an-option-with-a-num-pad.1135958.0.html
- **Fairness note.** Part of the gap is VIA itself, which has no per-key color editor for *any* keyboard (open request: https://github.com/the-via/app/issues/257). Per-key color on QMK boards always comes from vendor tools (e.g. Keychron Launcher), protocols like Vial/OpenRGB/SignalRGB, or custom firmware like this one.

## Alternatives that were checked (Sep 2026)

| Option | Verdict |
|---|---|
| NuPhy stock 2.1.5 | One color for all keys; halo limited to 8 colors, and Breath fades fully off. Keep it as the recovery file. |
| ryodeushii prebuilt ryo-1.1.4 (Sep 2024) | Adds a VIA halo color menu, but still no per-key shades and Breath still fades to off. |
| ryodeushii source (Jul 2026, unreleased) | **The base used here**: newer QMK, fixes, SignalRGB support. |
| SignalRGB (via ryodeushii's `srgb` build) | Full control, but only while the desktop app is running. |
| NuPhyIO, NuPhy Console, Vial, OpenRGB | Not available for this board (NuPhyIO is for the separate IO-series Halo75 V2). |

## What best-in-class lighting looks like, and what was borrowed

| Product | Standout features | Taken into Halo Composer |
|---|---|---|
| Razer Chroma Studio | Layer stack, selection and paint tools, quick selections, multi-stop gradients | Paint/select tools, quick selections, multi-stop gradients |
| Corsair iCUE | Stacked lighting layers, quick zones, screen/audio "Murals" | Zones + overlay layer; host streaming on the roadmap |
| Logitech G HUB | Freestyle per-key painting, screen sampler, audio visualizer | Per-LED painting; roadmap |
| SteelSeries GameSense | Event-driven meters on key zones | Roadmap: meter effect over USB |
| Wootility | Browser-based, live preview, effect layers | Browser editor whose preview uses the *same math* as the firmware |
| Keychron Launcher + Keychron QMK | WebHID, per-key color in EEPROM, "Mixed RGB" regions, RAM until SAVE | Same RAM-until-Save model; goes further with 8 zones, effects that keep per-LED color, and the halo included |
| ASUS Aura Creator | Timeline of effect "bricks" | Roadmap: playlists / crossfades |
| Mountain Base Camp | Every perimeter LED individually settable | Halo LEDs are first-class LEDs |
| Glorious CORE (counter-example) | Side lights can't take per-key effects | Exactly the limitation removed |

**Protocol prior art:** Keychron uses command `0xA8`; VialRGB rides inside VIA's 0x07–0x09; SignalRGB uses `0x21–0x28` and doesn't coexist well with VIA; OpenRGB-QMK collides with VIA's IDs. Composer uses **`0xD0`**, which is free in all of them and coexists with VIA.

## Roadmap

**On hold until the current features pass the hardware checklist** ([FLASHING.md](FLASHING.md#part-3-bring-up-checklist)).

| Idea | Why | Feasibility on the STM32F072 |
|---|---|---|
| **White balance per group** (key vs halo RGB gains) | The halo diffuser tints light differently from keycaps, so "warm white" should match everywhere | Trivial: 6 bytes and 3 multiplies |
| **Several stored scenes on Fn+M+1…4** | Switch looks without the editor | EEPROM-bound: each extra full scene costs 915 B of macro space. Options: cap VIA layers at 6 (frees 408 B) or a palette-indexed scene (~300 B) |
| **Layer-aware lighting** | Hold Fn and the keys that do something glow while the rest dim | Cheap: read `layer_state` in the overlay |
| **WPM-reactive** | Typing speed drives hue or brightness | QMK `WPM_ENABLE`; cheap |
| **Value meters** | CPU, volume or download progress as a bar on the number row or halo, fed by a tiny host script | New effect + a 1-byte command |
| **Notifications** | Flash a zone N times when a build finishes, a message arrives, etc. | Tiny command; USB only |
| **Screen ambience on the halo** | Halo matches the screen edges | Host-side capture → 45 LEDs = 5 packets per frame. Needs a "stream zone" so painted colors aren't overwritten |
| **Audio visualizer** | Halo and keys move to music | Host-side Web Audio → same streaming path |
| **Playlists with crossfades** | Aura/Keychron-style sequences | Crossfade between zone configs (two full scenes won't fit in RAM) |
| **Time-of-day warmth** | Whites shift warmer at night | No clock on the keyboard: Studio or a tray script pushes updates |
| **Two-layer compositing with blend modes** | Chroma/iCUE-style stacking | ~512 B more RAM; only after freeing RAM |
| **IS31FL3733 hardware auto-breathing** | Idle glow at near-zero CPU during light sleep | Driver work; QMK doesn't expose it |
| **Port to Air75 V2 / Halo96 V2 / Gem80** | Same code base | New geometry file + that board's `side.c` hooks |

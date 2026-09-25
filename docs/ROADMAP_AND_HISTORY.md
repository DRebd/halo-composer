# Roadmap, limitations and background

This page has three parts:

1. [Roadmap](#roadmap): what could come next, why, and roughly what each item costs.
2. [Known limitations and open questions](#known-limitations-and-open-questions).
3. [History and background](#history-and-background): why the project exists, what else was considered, and where the ideas came from.

Terms used below (others, such as QMK and VIA, are in the README's [plain-English glossary](../README.md#plain-english-glossary)):

- **Flash:** the keyboard chip's 128 KB of permanent memory. It holds the firmware and is erased in 2 KB blocks called *pages*.
- **EEPROM:** settings storage. This chip has none, so QMK emulates 4 KB of it inside flash. [HOW_IT_WORKS.md](HOW_IT_WORKS.md#storage-where-the-scene-lives-and-why-theres-only-one) shows what is stored where.
- **RAM:** the chip's 16 KB of working memory, cleared at power-off.
- **Scene:** one complete Composer look (per-LED colors, zones, gradients, halo layout). It takes 915 bytes.
- **Host:** the computer the keyboard is plugged into.

## Roadmap

Nothing below has been started. Effort figures are rough estimates unless marked otherwise. They come from reading the firmware source, not from building the features. Anything that needs the computer (streaming, notifications, meters) works over USB only, because the keyboard's wireless chip carries only keystrokes, mouse and media keys.

### Several stored scenes on the keyboard

**Why:** switch between looks from the keyboard with **Cmd+Fn+1…8**, without opening Halo Studio. Today the keyboard holds one saved scene.

**Recommended design** (worked out from the firmware source):

- **Keep scenes in unused flash**, not in the emulated EEPROM. About 39 KB of flash is unused. The top 5 free pages (10 KB) would hold **8 full scenes** (4 pages × 2 scenes) plus 1 spare page, with the halo calibration stored once. 16 scenes would fit in about 18 KB.
- **Benefits:**
  - The saved scene leaves the EEPROM, so VIA gets its macro space back (about 2,390 bytes, up from 1,485).
  - Scenes should **survive firmware updates**. Holding Esc to flash wipes only the EEPROM pages. Whether QMK Toolbox also leaves the other flash pages alone still has to be confirmed on a keyboard.
- **What it has to handle:**
  - *Power loss:* write each new copy, with a sequence number and a checksum (CRC), into an erased spare page, and erase the old copy only after the new one checks out. At worst, the save in progress is lost.
  - *Wear:* a flash page survives roughly 10,000 erases (ST datasheet figure, not verified here). Rotating over 5 pages gives about 50,000 saves. The firmware must skip unchanged saves and limit how often it saves.
  - *Room to grow:* a build check so future code can't grow into the scene area (firmware image at most 112,640 bytes). That still leaves about 28 KB for new code.
  - *Short pauses:* keys, USB and wireless pause during each page erase (roughly 20–40 ms, estimate). Key presses are probably delayed, not lost (inferred).
- **Effort:** roughly 300–500 lines of firmware, a scene-slot panel in Studio, and host tests using QMK's flash test mock.

**Why not in the EEPROM?** The existing 4 KB fits only **2 full scenes** (leaving 570 bytes for macros); a third doesn't fit with 8 keymap layers. Growing the emulated EEPROM costs the same amount of RAM, and only 1,496 bytes are free. A power cut while the EEPROM rewrites its pages (every second full save or so, inferred) could lose keymaps, settings and every scene at once. A 2-scene EEPROM version (about 50 lines) remains a quick fallback.

**Key-order caveat for Cmd+Fn.** The key left of Fn is right Cmd on the Mac layer and right Alt on the Windows layer. It does nothing on the Fn layers today.

- *Fn first, then Cmd:* on the Fn layers that key becomes a switch to a "scenes" layer, so the number keys select scenes and nothing reaches the computer.
- *Cmd first, then Fn:* the computer has already seen Cmd (or Alt) go down, and Fn+1…4 normally pick a Bluetooth or 2.4 GHz device. The firmware must catch the number keys while both keys are held, and tap a harmless dummy key before Cmd/Alt is released. Otherwise Windows opens the active app's menu after a lone Alt tap.
- About 40 extra lines. Both press orders need testing on macOS and Windows. If this proves unreliable, the fallback is **Fn+M+1…8** (that layer's number row is unused).

**Studio-sync caveat.** Studio sends only the parts of a scene that changed. If a scene is switched on the keyboard while Studio is editing, the keyboard would end up with a mix of both. The fix is protocol version 2: the keyboard reports a scene-change counter and the active slot, and Studio re-reads the scene when either changes. Optionally, the keyboard could ignore slot keys for about 10 seconds after Studio's last command.

**RAM isn't the limit.** Only one scene (915 bytes) is ever in RAM; the others are read straight from flash. For the same reason, crossfading between two stored scenes isn't practical: a second scene in RAM would take 915 of the 1,496 free bytes.

### Battery gauge on the function row

**Why:** a finer, easier-to-read charge display.

**Today** (ryodeushii's firmware, checked in the source): Fn+\ toggles the battery display on the 5-LED status bar, in 20% steps colored red, orange, yellow, light blue and green. Optionally it also shows the exact percentage by lighting two keys: the tens digit on the function row and the ones digit on the number row (VIA setting "Battery indicator show numeric value").

**Idea:** while Fn+\ shows the battery, light **Esc…F12** (13 keys, about 7.7% each) as a bar proportional to the charge, colored by level. For example, 50% lights Esc to about F6 in yellow, and 80% lights Esc to about F10 in green.

**Effort:** small. It's drawn in the indicator overlay (the layer painted on top of the lighting) from the battery reading the firmware already has. The design has to decide how it combines with the numeric option, which also lights a function-row key.

### Stock looks as Composer starter scenes

**Why:** people who like a stock effect can start from that look, then keep their own colors, zones and the halo, which stock effects can't do.

How the 42 stock key effects compare with Composer's effects:

- **About 32 map directly.** They include Solid, the gradients, Breathing, the Band, Pinwheel and Spiral families, most of the Cycle effects, the Beacons, the Hue effects, Raindrops, Typing Heatmap, four of the Reactive effects (Simple, Reactive, Wide, Multiwide), Solid Splash and Solid MultiSplash, and NuPhy's game and position modes. The 4 stock halo modes map too: Wave (on the Ring axis), Mix (Color cycle), Static and Breath.
- **About 5 are approximate:** Splash, MultiSplash, Jellybean Raindrops, Rainbow Moving Chevron and Cycle Out/In Dual.
- **About 5 are missing:** Digital Rain and the four Reactive Cross/Nexus effects. They would need two new engine features, falling columns and a cross-shaped keypress overlay, written in both C and JavaScript with parity tests.

**Effort:** mostly Studio work (a library of starter scenes). The mapped looks need no firmware change and no extra EEPROM, and the stock effects stay available.

**Optional extra:** each stock effect remembers its own color and speed instead of sharing one setting. That needs a 126-byte table (42 effects × 3 bytes), which would reduce macro space to about 1,360 bytes. A related hook could map the stock effects' rainbow onto a Studio gradient, at about 26 bytes per effect; every stock effect except Digital Rain would follow it. Both work per effect, not per key.

### Not planned: fully editable stock effects

Making the stock effects editable means rewriting all 42 with new settings. The copies would have to replace QMK's originals, because QMK allows at most 64 lighting modes and 44 are already used. The new settings would take about 340–500 bytes of EEPROM from macros. Every effect would also need a JavaScript twin so that Studio's preview stays accurate, and each QMK update would bring merge conflicts. Composer scenes already give per-LED control, so the starter-scene library gets most of the benefit for much less work.

### Other ideas

| Idea | Why | Rough cost or feasibility |
|---|---|---|
| **White balance per group** (keys vs halo) | The halo diffuser tints light differently from the keycaps, so "warm white" should match everywhere | Trivial: 6 bytes and 3 multiplications per LED |
| **Layer-aware lighting** | Hold Fn and the keys that do something glow while the rest dim | Cheap: read QMK's active layer in the overlay |
| **Typing-speed (WPM) reactive** | Typing speed drives hue or brightness | Cheap: QMK has a words-per-minute feature |
| **Value meters** | CPU load, volume or download progress as a bar on the number row or halo | A new effect plus a 1-byte command, fed by a small host script |
| **Notifications** | Flash a zone a few times when a build finishes, a message arrives, etc. | Tiny command plus a host script |
| **Screen ambience on the halo** | The halo matches the edges of the screen | Host-side screen capture; 45 LEDs = 5 packets per frame. Needs a "stream zone" so painted colors aren't overwritten |
| **Audio visualizer** | Halo and keys move to music | Host-side audio analysis over the same streaming path |
| **Playlists with crossfades** | Timed sequences of looks | Crossfade between zone settings; two full scenes don't fit in RAM |
| **Time-of-day warmth** | Whites shift warmer at night | The keyboard has no clock, so Studio or a tray script pushes updates |
| **Two-layer compositing with blend modes** | Stack effects, as in Razer Chroma or Corsair iCUE | About 512 bytes more RAM; only after freeing RAM elsewhere |
| **IS31FL3733 hardware breathing** | An idle glow at almost no processor cost during light sleep | Driver work; QMK doesn't expose the LED chip's auto-breathing mode |
| **Ports to other NuPhy boards** (Air75 V2, Halo96 V2, Gem80) | Same code base | A new geometry file plus that board's halo hooks, and someone with the board to test it |

## Known limitations and open questions

- **Editing is USB-only.** Halo Studio and VIA need the USB cable with the keyboard in wired mode, because the wireless chip carries only keystrokes, mouse and media keys. Saved lighting runs in every mode.
- **One saved scene on the keyboard.** Studio keeps any number of scenes in the browser and can export and import them as `.halo.json` files. Several scenes on the keyboard are on the [roadmap](#several-stored-scenes-on-the-keyboard).
- **Flashing with Esc held resets saved settings, including the scene.** The default look and the measured halo layout are built into the firmware, so they come back by themselves. A custom scene has to be exported (or backed up with `tools/halo_kb.py scene-backup`) before flashing and restored afterwards. [FLASHING.md](FLASHING.md) covers this.
- **Less VIA macro space:** 1,485 bytes with Composer (confirmed on a keyboard), against 2,400 in ryodeushii's `via` build. The scene is stored in that space.
- **Less free RAM:** 1,496 bytes against 2,616, which rules out RAM-hungry features such as two-layer compositing for now.
- **Frame rate:** 40 fps, the firmware's fixed ceiling. It drops to about 30 fps with the heaviest reactive starter scene while 31 key presses per second are simulated, 2–3 times the fastest human typing (measured). No typing lag was noticed when typing fast with that scene.
- **Unreleased base firmware.** Halo Composer is built on a snapshot of ryodeushii's firmware that he hasn't published as a release (commit `9847cb8`, July 2026, pinned in `firmware/base.env`). Wireless, sleep and battery behavior come from that code. His last release, ryo-1.1.4 (September 2024), could serve as a fallback base, but the hooks would need adapting.
- **Only the ANSI Halo75 V2, tested on one keyboard.** Other layouts and other NuPhy boards aren't supported. The built-in halo layout was measured on that keyboard. Other units are expected to match (not verified); if they don't, Studio's calibration wizard can re-measure.
- **Two stock shortcuts go away.** NuPhy's 2.1.5 firmware has two undocumented keys on Fn+M+R and Fn+M+T. They aren't in any published source code, so no firmware built from source has them.

**Open questions (not measured yet):**

- Battery life with the halo lit, compared with NuPhy's stock firmware.
- How long a Save to the keyboard pauses it, and whether typing, USB or 2.4 GHz glitch while the emulated EEPROM rewrites its pages.
- Whether Bluetooth pairings survive a flash. They're stored in the separate wireless chip, so they should.

## History and background

*Researched in September 2026. Claims about firmware source code were checked against the code; the rest rely on the linked sources.*

### Why this project exists

The Halo75 V2 ships with QMK firmware and works with VIA, but its lighting control is thin: one backlight color for all keys, and a halo limited to NuPhy's fixed modes and 8 preset colors, whose Breath mode fades fully to off. No existing firmware kept per-key shades on the keyboard itself (SignalRGB can do it only while its desktop app runs), or let the halo breathe between, say, 50% and 100%. Halo Composer adds that on top of ryodeushii's community firmware, and Halo Studio is its editor.

### Why NuPhy's "QMK/VIA" feels hollow

The Halo75 V2 really does run QMK: NuPhy publishes its source under the GPL, and VIA really does remap keys. What's missing is most of what makes QMK and VIA great on other boards:

- **Not in the official projects.** There are no NuPhy boards in `qmk/qmk_firmware`. NuPhy's Air75 V2 pull request (#22751) has been open since December 2023, and a QMK reviewer called it unmergeable because it adds its own lighting systems. The board isn't in VIA's keyboard list either, so users load a definition file into VIA by hand. Sources: https://github.com/qmk/qmk_firmware/pull/22751, https://github.com/the-via/keyboards
- **The halo bypasses QMK's lighting system.** NuPhy's `side.c` draws the 45 halo LEDs in its own loop with 8 preset colors. It isn't part of QMK's RGB matrix or NuPhy's VIA definition, so VIA can't control it (checked in the source).
- **Source dumps, not development.** The `halo75_v2` folder has a handful of commits labeled "Fix bugs". Source pushes trail the binary releases: 2.1.5 shipped on 4 March 2025 and its source followed on 25 March. The 2.1.5 firmware also has two custom keycodes (on Fn+M+R and Fn+M+T) that aren't in the published source; they show up in a VIA backup read from a keyboard running 2.1.5. Sources: https://github.com/nuphy-src/qmk_firmware/commits/nuphy-keyboards, https://github.com/zhogov/nuphy-state-of-qmk-firmware
- **Closed wireless.** Bluetooth and 2.4 GHz run on a separate chip with closed firmware; QMK, radio and dongle firmware update separately. VIA and Halo Studio work over the cable only. Source: https://nuphy.com/pages/qmk-firmwares
- **The community fixed the basics.** ryodeushii's firmware exists to fix wireless reliability, sleep, debounce and more. Source: https://github.com/ryodeushii/qmk-firmware
- **Direction of travel.** In October 2025 NuPhy moved new Halo V2 production to its own closed "NuPhyIO" firmware. Source: https://www.notebookcheck.net/NuPhy-updates-Halo-V2-wireless-mechanical-keyboards-for-up-to-4X-battery-life-improvements-and-there-s-an-option-with-a-num-pad.1135958.0.html
- **To be fair,** part of the gap is VIA itself, which has no per-key color editor for *any* keyboard (open request: https://github.com/the-via/app/issues/257). Per-key color on QMK boards always comes from vendor tools (for example Keychron Launcher), protocols such as Vial, OpenRGB and SignalRGB, or custom firmware like this one.

### Alternatives that were checked (as of September 2026)

| Option | Verdict |
|---|---|
| NuPhy stock 2.1.5 | One color for all keys; the halo is limited to 8 colors, and Breath fades fully off. It remains the way back to factory firmware. |
| ryodeushii prebuilt ryo-1.1.4 (September 2024) | Adds a VIA halo color menu, but still no per-key shades, and Breath still fades to off. |
| ryodeushii source (July 2026, unreleased) | **The base used here:** newer QMK, fixes, SignalRGB support. |
| SignalRGB (with ryodeushii's `srgb` build) | Full control, but only while the desktop app is running. |
| NuPhyIO, NuPhy Console, Vial, OpenRGB | Not available for this board. NuPhyIO is for the separate IO-series Halo75 V2. |

### What best-in-class lighting looks like, and what was borrowed

| Product | Standout features | Taken into Halo Composer |
|---|---|---|
| Razer Chroma Studio | Layer stack, selection and paint tools, quick selections, multi-stop gradients | Paint and select tools, quick selections, multi-stop gradients |
| Corsair iCUE | Stacked lighting layers, quick zones, screen and audio "Murals" | Zones plus an overlay layer; host streaming is on the roadmap |
| Logitech G HUB | Freestyle per-key painting, screen sampler, audio visualizer | Per-LED painting; the rest is on the roadmap |
| SteelSeries GameSense | Event-driven meters on key zones | Roadmap: a meter effect over USB |
| Wootility | Browser-based, live preview, effect layers | A browser editor whose preview uses the *same math* as the firmware |
| Keychron Launcher + Keychron QMK | WebHID, per-key color stored on the keyboard, "Mixed RGB" regions, changes held in RAM until Save | The same RAM-until-Save model, extended with 8 zones, effects that keep per-LED colors, and the halo included |
| ASUS Aura Creator | Timeline of effect "bricks" | Roadmap: playlists and crossfades |
| Mountain Base Camp | Every perimeter LED individually settable | Halo LEDs are first-class LEDs |
| Glorious CORE (counter-example) | Side lights can't take per-key effects | Exactly the limitation removed |

**Protocol prior art.** Keychron uses USB command `0xA8`; VialRGB rides inside VIA's commands 0x07–0x09; SignalRGB uses `0x21–0x28` and doesn't coexist well with VIA; OpenRGB-QMK's command numbers collide with VIA's. Halo Composer uses **`0xD0`**, which is free in all of them and coexists with VIA. The details are in [HOW_IT_WORKS.md](HOW_IT_WORKS.md).

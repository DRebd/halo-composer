# What's different: NuPhy stock → ryodeushii → Halo Composer

*Sources: ryodeushii's [release notes](https://github.com/ryodeushii/qmk-firmware/releases), his commit history, and the readme and VIA definition in his source (pinned commit `9847cb8`, July 2026), plus this repository's code. Both his firmware and Halo Composer have been run on the developer's Halo75 V2 (ANSI). The wireless, battery and latency improvements in section 1 are as ryodeushii describes them; they weren't measured here. Terms such as QMK and VIA are explained in the README's [plain-English glossary](../README.md#plain-english-glossary).*

## 1. What ryodeushii's firmware improves over NuPhy's stock firmware

A community maintainer's rework of NuPhy's own QMK source. It keeps the same keyboard layout, fixes the parts NuPhy left rough, and exposes many hidden settings.

- **Wireless that works properly.** His first Halo75 V2 release notes say Bluetooth and 2.4 GHz "now work correctly in comparison with official firmware", thanks to reworked radio-driver code (credited to @jincao1).
- **Better battery life and sleep.**
  - Deep sleep in wireless modes, which cuts idle drain a lot.
  - Separate on/off switches for sleep, deep sleep and sleep-while-on-USB.
  - An adjustable sleep timeout.
  - July 2026 fixes so the lights come back exactly as they were after waking.
- **Typing fixes.** Adjustable debounce (how long the keyboard waits to confirm a key press or release, 0–30 ms each), which cures chattering or double-typed keys. There's also a faster custom key-scanning routine, and he published latency test results.
- **Far more in VIA.** Stock VIA shows one "Backlight" menu. His VIA definition adds:
  - a **Halo Light** menu: mode, speed, brightness, and any static color from a color picker instead of NuPhy's 8 presets;
  - **Custom Configs**: debounce, sleep and indicator settings.
- **Better indicators.**
  - A color-coded battery display with adjustable brightness, optionally also shown as an exact percentage (the tens digit lights on the F-row, the ones digit on the number row).
  - A choice of where the Caps Lock light shows.
  - The power-on animation can be turned off (Fn+Insert).
  - Holding Fn lights up every key that has a function, color-coded by type.
- **Small fixes to NuPhy's layout:** Insert and Delete were swapped, and the macOS brightness keys were non-standard.
- **Up to date.** Synced with upstream QMK 0.32.7, whereas NuPhy's source updates rarely and trails its releases. It also offers optional support for SignalRGB, a desktop lighting-control app (a separate `srgb` build).
- **Caveat:** the July 2026 code Halo Composer builds on hasn't been packaged as a release. His last release is ryo-1.1.4 from September 2024.

**What it still can't do:** give individual keys their own color, treat the halo as individual LEDs (it still has NuPhy's 4 halo modes plus Off), or breathe without fading fully to off.

## 2. What Halo Composer and Halo Studio add on top of ryodeushii's

**Halo Composer** is the new lighting engine *inside the keyboard's firmware*; **Halo Studio** is the web page on the PC used to design the lighting and send it to Composer over the USB cable.

- **Every LED is individually colorable:** the 83 key LEDs and the 42 halo, status-bar and badge LEDs (the halo has 45 positions, but 3 have no LED fitted). The halo LEDs become ordinary LEDs instead of a fixed-mode light strip.
- **Effects keep the painted colors.** 17 effects, including Off (breathe, heartbeat, wave, candle, comet, ripple, sparkle, heatmap, ...), animate the colors painted on each LED instead of replacing them with one color.
- **Up to 8 zones**, each with its own effect, speed and **brightness floor and ceiling**. "WASD breathes fast while the halo breathes slowly between 50% and 100%" is simply two zones.
- **Gradients and reactions.** Four gradients of up to 6 colors each, plus rainbow sources. Keypress reactions (flash, glow, ripple, or *halo echo*, which lights the halo next to the pressed key) can go on any zone.
- **Default look:** 2700K warm-white keys; a pressed key flashes mint (#70FF94) for about half a second and sends a mint ripple about two keys outward; a 2700K halo breathing between 30% and 100%. It shows right after flashing.
- **Keeps what works.** Fn+↑/↓ still sets key brightness and Fn+M+↑/↓ still sets halo brightness. The battery, Caps Lock and wireless indicators draw on top; Caps Lock is magenta on both the key and the status bar. NuPhy's boot animation still plays. VIA still remaps keys, and every ryodeushii feature above is untouched. The 42 stock effects are one Fn+← away, and **Fn+Enter** jumps between Composer and the last stock effect.
- **Fixes a stock quirk:** turning key brightness to 0 no longer switches the halo off too.
- **Halo Studio** runs in desktop Chrome or Edge with nothing to install (hosted at https://drebd.github.io/halo-composer/; it can also be [self-hosted](DEVELOPING.md#host-halo-studio-yourself)):
  - a live animated preview that uses the *same math* as the keyboard, so animations match exactly (colors are close rather than identical, since screens and LEDs differ);
  - paint, select and eyedropper tools, with one-click selections (WASD, arrows, halo sides, ...);
  - an effects gallery with animated previews, 11 starter scenes, and a scene library with export and import;
  - a **halo calibration wizard** that maps where each halo LED really sits;
  - live push while editing, and Save to keep the result on the keyboard.
- **Built to be safe to change.**
  - A boot-time guard stops leftover data being read as keys after switching firmware.
  - Studio recognizes keyboards without Composer instead of just timing out.
  - A command-line tool does backups, self-tests and scene backup/restore.
  - Automated tests (firmware-vs-preview parity, protocol, browser end to end) run on GitHub for every update to the main branch and every pull request (proposed change).
- **Costs:** VIA macro space drops from 2,400 to 1,485 bytes, and free RAM (the keyboard's working memory) drops from about 2.6 KB to 1.5 KB. Editing works over USB only; saved lighting runs in every mode. The keyboard stores one scene at a time. More in [Known limitations](ROADMAP_AND_HISTORY.md#known-limitations-and-open-questions).

How it all works: [HOW_IT_WORKS.md](HOW_IT_WORKS.md). How to use it: [USER_GUIDE.md](USER_GUIDE.md).

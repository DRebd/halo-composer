# What's different: NuPhy stock → ryodeushii → Halo Composer

*Sources: ryodeushii's [release notes](https://github.com/ryodeushii/qmk-firmware/releases), commit history and the readme and VIA definition in his source (pinned commit `9847cb8`, 2026-07-24), plus this repo's code. None of it is verified on your keyboard yet.*

## 1. What ryodeushii's firmware improves over NuPhy's stock firmware

A community maintainer's rework of NuPhy's own QMK source. It's the same keyboard layout, with the parts NuPhy left rough fixed and many hidden settings exposed.

- **Wireless that works properly.** His first Halo75 V2 release notes say Bluetooth and 2.4 GHz "now work correctly in comparison with official firmware". This came from reworked radio-driver code (credited to @jincao1).
- **Better battery life and sleep.**
  - Deep sleep in wireless modes, which cuts idle drain a lot.
  - Separate on/off switches for sleep, deep sleep and sleep-while-on-USB.
  - An adjustable sleep timeout.
  - July 2026 fixes so the lights come back exactly as they were after waking.
- **Typing fixes.** Adjustable debounce, press and release separately (0–30 ms), which cures chattering or double-typed keys. There's also a faster custom key-scanning routine, and he published latency test results.
- **Far more in VIA.** Stock VIA shows one "Backlight" menu. His VIA definition adds:
  - a **Halo Light** menu: mode, speed, brightness, and any static color from a color picker instead of NuPhy's 8 presets;
  - **Custom Configs**: debounce, sleep, and indicator settings.
- **Better indicators.**
  - Color-coded battery display, optionally shown as an exact percentage on the F-row, with adjustable brightness.
  - A choice of where the Caps Lock light shows.
  - The power-on animation can be turned off (Fn+Insert).
  - Holding Fn lights up every key that has a function, color-coded by type.
- **Small fixes to NuPhy's layout:** Insert and Delete were swapped, and the macOS brightness keys were non-standard.
- **Up to date.** Synced with upstream QMK 0.32.7, whereas NuPhy's source updates rarely and trails its releases. It also adds optional SignalRGB support (a separate `srgb` build).
- **Caveat:** the July 2026 code Halo Composer builds on hasn't been packaged as a release. His last release is ryo-1.1.4 from Sep 2024.

**What it still can't do:** give individual keys their own color, treat the halo as individual LEDs (it's still NuPhy's 5 modes), or breathe without fading fully to off.

## 2. What Halo Composer and Halo Studio add on top of ryodeushii's

**Halo Composer** is the new lighting engine *inside the keyboard's firmware*. **Halo Studio** is the web page on your PC that you use to design the lighting and send it to Composer over the USB cable.

- **Every LED is individually colorable: all 128.** That includes the 45 halo, status-bar and badge LEDs, which become ordinary LEDs instead of a fixed-mode light strip.
- **Effects keep your colors.** 17 effects (breathe, heartbeat, wave, candle, comet, ripple, sparkle, heatmap, ...) animate the colors you painted instead of replacing them with one color.
- **Up to 8 zones**, each with its own effect, speed and **brightness floor and ceiling**. So "WASD breathes fast while the halo breathes slowly between 50% and 100%" is simply two zones.
- **Gradients and reactions.** Four gradients of up to 6 colors each, plus rainbow sources. Keypress reactions (flash, glow, ripple, or *halo echo*, which lights the halo next to the key you pressed) can go on any zone.
- **Your look out of the box:** warm-white keys, deeper-toned WASD, and an amber halo breathing 50–100%. It's the default right after flashing.
- **Keeps what works.** Fn+↑/↓ still sets key brightness and Fn+M+↑/↓ still sets halo brightness. The battery, caps and wireless indicators draw on top. NuPhy's boot animation still plays. VIA still remaps keys, and every ryodeushii feature above is untouched. Stock effects are one Fn+← away.
- **Fixes a stock quirk:** turning key brightness to 0 no longer switches the halo off too.
- **Halo Studio**, at https://drebd.github.io/halo-composer/, with nothing to install:
  - a live animated preview that uses the *same math* as the keyboard, so what you see is what you get;
  - paint, select and eyedropper tools, with one-click selections (WASD, arrows, halo sides, ...);
  - an effects gallery with animated previews, 11 starter scenes, and a scene library with export and import;
  - a **halo calibration wizard** that maps where each halo LED really sits;
  - live push while editing, and Save to keep the result on the keyboard.
- **Built to be safe to change.**
  - A boot-time guard stops leftover data being read as keys after switching firmware.
  - Studio recognizes keyboards without Composer instead of just timing out.
  - A command-line tool does backups, self-tests and scene backup/restore.
  - Automated tests (firmware-vs-preview parity, protocol, browser end to end) run on every change.
- **Costs:** VIA macro space drops from about 2.4 KB to about 1.5 KB (you use none), and free RAM on the keyboard drops from about 2.6 KB to 1.5 KB. Editing works over USB only; saved lighting runs in every mode.

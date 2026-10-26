# Random Reactive RGB

This fork extends Composer's existing keypress overlays on the **NuPhy Halo75 V2 ANSI**. Flash, Glow and Ripple run in the keyboard's C engine, with the same integer math in Studio's JavaScript preview. No browser, host lighting service or USB connection is needed after saving: the normal matrix-event hook runs in wired, Bluetooth and 2.4 GHz modes. Wireless hardware operation has not been tested with a physical keyboard for this build.

## Install and configure

1. Back up your VIA layout and export your Composer scene before flashing. Esc-held DFU entry resets saved settings.
2. Use `dist/nuphy_halo75v2_ansi_composer.bin` from this checkout, **not the original project's release**. Follow [FLASHING.md](FLASHING.md) for QMK Toolbox, cable/wired mode, Esc-held plug-in, selecting the binary and manually clicking Flash. Nothing in the build or tests flashes a keyboard. Only the ANSI Halo75 V2 is supported.
3. Open **this fork's** `dist/halo-studio.html` in desktop Chrome or Edge. The original hosted Studio does not have these controls. Connect the keyboard over USB in wired mode. Close VIA while using Studio.
4. In Scenes choose **Random Reactive RGB** for a dark starter, or keep your existing scene. In Zones choose the zone containing your keys, then **Keypress overlay → Reaction → Random Reactive RGB — Flash / Glow / Ripple**.
5. Set Fade (0.20–2.00 seconds, 0.12-second steps), Reaction brightness (0–100%), Reaction radius for Glow/Ripple (roughly 0.1–18.7 key pitches), and Reaction palette. Full spectrum chooses among 256 saturated hues. Gradient slots 1–4 sample your existing editable gradients, including their interpolation, wrap and mirror settings. Edit these in Gradients; use at least two different colours. A palette that cannot supply a different colour falls back to full spectrum rather than repeating the previous colour for that key.
6. Use **Type (test reactive)** and click keys, or enable the existing simulated typing preview. Flash affects only the pressed key. Glow spreads softly within the radius. Ripple expands to that radius over the fade duration, while the pressed key itself fades. Repeated presses retain their own colours; overlapping contributions add and may saturate toward white.
7. For a fully dark background use **Static**, with **both Min bright and Max bright at 0%**. For static lighting retain Static with your painted/zone colours and desired brightness. Other existing background effects can also remain. The **Off** effect intentionally disables the entire zone, including overlays. Global key/halo brightness, gamma and the Ignore keypress overlays flag still apply.
8. Click **Save to keyboard**, close Studio, then switch to Bluetooth or 2.4 GHz. Confirm typing, the lighting, sleep/wake and reconnection on your actual keyboard. To use VIA, load `dist/halo75v2_composer_via3.json`.

The starter uses Glow, full spectrum, full reaction brightness, a three-key radius, a 1.04-second fade and a dark background. The firmware still starts with the original factory scene until you configure and save the random scene.

## Architecture and compatibility

- Reuses the eight-entry `hc_hit_t` ring and existing Flash/Glow/Ripple envelopes, physical coordinates, frame clock, USB commands and scene persistence. A ninth press replaces the oldest retained hit, even when its fade is still active. This is the existing bounded animation policy.
- A hit captures its RGB and brightness once from its originating key's zone. Other random-overlay zones render that same hit colour, with their own radius/fade. Changing the palette affects future presses; it does not recolour hits already in flight.
- A hash of the key index, event timestamp and a monotonically increasing 32-bit event sequence provides pseudorandom colour selection. Same-tick presses differ. The previous RGB per LED prevents immediate repeats for that same key, even after its animation expires. This is decorative randomness, not a cryptographic RNG. Exact generated sequences in Studio and hardware differ with input timestamps; parity tests replay identical inputs.
- Adds reaction IDs **5/6/7** for Random Flash/Glow/Ripple; IDs 0–4 and every effect ID stay unchanged. The existing `rx_color[3]` stores brightness, radius in coordinate units (12 ≈ one key), and palette (0 = full spectrum; 1–4 = gradient slot) for random reactions. Radius 0 received over the protocol is treated as 1; palette values outside 1–4 use full spectrum.
- The packed scene stays **915 bytes**, version 1; there are no EEPROM offset, VIA keymap, macro-space, USB packet or QMK mode-index changes. Existing saved scenes continue to load. Older Composer firmware/Studio cannot interpret random reaction IDs: export your scene and change reactions back to IDs 0–4 before downgrading, otherwise the old firmware can reject the scene and reset VIA storage.
- No changes to key processing, wireless transport, sleep, stock lighting effects or VIA command routing. Firmware remains GPL-2.0-or-later.

## Build and validation

The pinned base is `9847cb81729fa6540ffed1a583b9acdaaa20607b`. The existing Docker build remains supported: see [DEVELOPING.md](DEVELOPING.md). This delivery was compiled natively with ARM GCC 13.2.1 and QMK CLI 1.2.0 on Linux; it is not claimed to be byte-identical to the pinned container toolchain.

Firmware image: **88,464 bytes** of program/data plus a **16-byte DFU suffix**. RAM: **1,800 bytes data + 10,428 bytes BSS**, **3,072 bytes reserved stacks**, **1,080 bytes free aligned headroom**, within the STM32F072's 16 KiB RAM. Engine state is **612 bytes** (416 bytes more than before). No dynamic allocation is introduced. Each frame still checks at most eight hits per LED; palette rejection scans at most 256 samples only on a keypress, not per frame.

Run `REQUIRE_E2E=1 bash tests/run_tests.sh` after `npm ci && npx playwright install chromium`:

- Strict C compilation with warnings as errors.
- 1,000 identical-timestamp repeats of one key: no immediate colour repeats and broad hue coverage; immutable hit colours, additive overlaps, fade completion, background restoration, zero brightness, radius, ignored LEDs, buffer eviction and degenerate-palette fallback.
- **103 scenes / 5,230 frames × 128 LEDs** match C and JavaScript byte for byte. Dedicated random-mode vectors cover all three modes and all five palette choices, repeated/simultaneous presses, buffer wrap, timer wrap, fade endpoints and extreme radii. Original effect vectors remain included.
- All **49 existing protocol checks** pass.
- Studio end-to-end tests use the actual C protocol implementation behind simulated WebHID: all three random modes and controls reach firmware RAM, save/reboot preserves them, and overlapping matrix presses render the same frames as the browser engine. Existing GUI regression checks remain included.

No physical keyboard was attached or flashed. Hardware testing is still needed for wireless operation, power consumption and stack high-water usage. Link-time RAM headroom does not measure runtime stack peaks. Test outputs, build details and checksums are included alongside the binaries in `dist/`.

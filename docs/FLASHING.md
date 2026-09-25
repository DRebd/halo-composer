# Flashing guide and bring-up checklist

"Flashing" means replacing the program inside the keyboard. This guide does it in two stages and checks each one. It also covers going back to NuPhy's original firmware. **Plan on 20–30 minutes at the keyboard.** Claude Code can run the command-line checks, but a few steps need your hands.

## Before you start

- **Your settings get reset.** Entering flashing mode by holding Esc wipes the keyboard's saved settings: VIA key changes, lighting, and the Composer scene. Your layout is already backed up: `backups/stock-2.1.5_2026-09-23_2346.json`. It's NuPhy's factory layout, so nothing needs restoring. Bluetooth pairings are stored in the separate wireless chip and *should* survive (unverified).
- **Close VIA and Halo Studio** (every tab). Two programs talking to the keyboard at once cause the "incorrect response" errors you saw before.
- **Use the USB-C cable, with the mode switch on the back set to wired.** Flashing and the editor only work over the cable.
- **Hardware recovery button:** remove the **Caps Lock** keycap. There's a small black button next to its switch; hold it while plugging in the cable to force flashing mode even if the firmware won't start. This is documented in ryodeushii's readme and his recovery instructions (`keyboards/nuphy/halo75v2/ansi/readme.md`, `keyboards/nuphy/instructions.md`). It isn't on NuPhy's page.
- The two unexplained NuPhy keys on **Fn+M+R** and **Fn+M+T** won't exist after flashing. They aren't in any published source code.

## Part 1: one-time setup

1. **Install QMK Toolbox**, the free flashing app that NuPhy's own instructions use. Download `qmk_toolbox_install.exe` from https://github.com/qmk/qmk_toolbox/releases (0.3.4 as of 2026-09-24) and run it. It installs USB drivers for flashing mode, which needs one **admin approval** prompt.
2. **Download NuPhy's official firmware** as your way back: [QMK_firmware_nuphy_halo75_v2_ansi_v2.1.5.bin](https://cdn.shopify.com/s/files/1/0268/7297/1373/files/QMK_firmware_nuphy_halo75_v2_ansi_v2.1.5.bin?v=1741067981). It's listed on https://nuphy.com/pages/qmk-firmwares. Keep it somewhere safe.
3. **Get the two files to flash.** Claude Code builds them into this project's `dist\` folder with `.\scripts\build-firmware.ps1`:
   - `nuphy_halo75v2_ansi_via.bin`: ryodeushii's firmware, unmodified (stage 1)
   - `nuphy_halo75v2_ansi_composer.bin`: Halo Composer (stage 2)

   The same files also come from each automatic build on GitHub (Actions tab → latest run → *firmware-UNTESTED-on-hardware*).

## Part 2: how to flash (every time)

These are NuPhy's official steps (https://nuphy.com/pages/update-instructions, updated 2026-09-09) with notes added:

1. Unplug the keyboard and set the switch to **wired**.
2. Open **QMK Toolbox** → **File → Open** → pick the `.bin` file.
3. **Hold Esc**, keep holding it, and plug in the USB cable. Release Esc when **yellow text** appears in the Toolbox window saying a DFU device connected. The keyboard stops typing while it's in this mode; that's expected.
   - No yellow text? Unplug and try again, holding Esc *before* the cable goes in. If the Toolbox shows **(NO DRIVER)**, the flashing driver is missing: press **Ctrl+N** in QMK Toolbox to install it (approve the admin prompt; if nothing happens, run QMK Toolbox as Administrator), then retry. This comes from ryodeushii's flashing instructions.
4. Click **Flash**. Wait for **"Flash complete"**. Don't unplug during flashing.
5. Unplug and re-plug, then type a few characters to check it works.

## Part 3: bring-up checklist

Tick each item. If something fails, stop and note what you saw. Claude Code can compare it against the code.
Lines that start with **Claude Code:** are commands Claude Code runs for you from this project folder; you don't run them yourself.

### Stage 1: ryodeushii's firmware alone (`nuphy_halo75v2_ansi_via.bin`)

This checks the base firmware on your keyboard before any of our code is involved.

- [ ] Flash it (Part 2). Typing works, including Fn layer keys (for example Fn+F1 on Mac mode / media keys).
- [ ] Key lighting responds: Fn+↑/↓ brightness, Fn+← next effect.
- [ ] Halo responds: Fn+M+↑/↓ brightness, Fn+M+← halo mode.
- [ ] Caps Lock indicator and the Win/Mac switch behave as before.
- [ ] Optional: switch to 2.4 GHz or Bluetooth, type a sentence, and switch back to wired.
- [ ] Claude Code: `python tools\halo_kb.py info` shows the protocol version and 8 layers.

### Stage 2: Halo Composer (`nuphy_halo75v2_ansi_composer.bin`)

- [ ] Flash it. Typing works.
- [ ] **Composer starts on by itself** after this flash. If it isn't showing, press **Fn+Enter**, which jumps straight to Composer (builds from 2026-09-25 on), or have Claude Code run `python tools\halo_kb.py on`.
- [ ] **Default look:** 2700K warm-white keys; the key you press flashes mint (#70FF94) for about half a second and sends a mint ripple about two keys outwards; a 2700K halo breathing between 30% and 100% (one breath is about 4.7 s). *(Builds before 2026-09-25 had a warm-white/amber look.)*
- [ ] **Stock effects still work:** Fn+← steps forward through the effect list (Solid Color, ...) and the halo shows NuPhy's own modes again; Fn+Shift+← steps backwards. Composer is the last of 43 entries, so stepping only returns to it after going round. **Fn+Enter** jumps back to Composer from anywhere, and pressing it again returns to the stock effect you were on.
- [ ] **Brightness keys:** Fn+↑/↓ changes the keys, Fn+M+↑/↓ changes the halo (6 steps). Turn the keys all the way down: the halo must **stay lit** (this tests the LED-power patch).
- [ ] **Indicators on top:** Caps Lock turns the Caps key and the status bar **magenta** (Fn+Caps cycles bar / key / both / off), Fn+\ shows the battery, and flipping the Win/Mac switch shows its indicator. None of them flicker, and they disappear cleanly.
- [ ] **Boot animation:** unplug and re-plug. NuPhy's power-on sweep plays around the halo, then Composer takes over without a glitch.
- [ ] Claude Code: `python tools\halo_kb.py status`. The frame rate should be **≥ 25 fps**.
- [ ] Claude Code: `python tools\halo_kb.py selftest`. All checks should pass. It only uses the keyboard's temporary memory and puts everything back.
- [ ] **VIA still works:** in VIA, load `dist\halo75v2_composer_via3.json` as a draft definition in the Design tab, the same way you loaded NuPhy's file before. Key remapping works, and the Effect list ends with "Composer (Halo Studio)". **Close VIA afterwards.**

### Stage 3: Halo Studio with the keyboard

- [ ] Open **https://drebd.github.io/halo-composer/** in Chrome or Edge → **Connect keyboard** → pick the NuPhy entry in the browser's pop-up. The pill at the top reads "Connected · Composer on".
- [ ] **Calibrate the halo** (Halo setup tab → Start placing). One amber LED lights up on the keyboard. Click where it is on the drawing and repeat (Skip any you can't see; LEDs 9, 10 and 45 have no LED fitted and are skipped automatically). Then **Walk the ring**, check the order goes smoothly around, and click **Save to keyboard**. *Since 2026-09-25 the built-in positions are the ones measured on your keyboard, so this is only needed if something looks off.*
- [ ] Claude Code: `python tools\halo_kb.py scene-backup backups\calibrated.halo.json` (nothing for you to do). This keeps the calibration safe across future flashes.
- [ ] Try a few **starter scenes** (Scenes tab). *Typing Ripples* is the heaviest. While it runs, type fast: typing must never lag. Then measure again with Device → *Measure keyboard frame rate*. It should stay ≥ 25 fps.
- [ ] **Persistence:** Save, unplug, re-plug. The saved scene comes back, and VIA key changes (if any) are still there.
- [ ] **Wireless and sleep:** switch to 2.4 GHz / Bluetooth. Lighting keeps running, and Studio can't connect (expected, since it's USB only). Let the keyboard sleep and wake it: the lighting comes back.
- [ ] **Battery (over a day):** compare battery drain with the halo on against what you're used to.

When everything is ticked, tell Claude Code.

### Results (2026-09-25)

Stages 1–3 passed on your keyboard. Only the day-long battery comparison is still open.

- Self-test on the keyboard: 27/27. Frame rate: **40 fps**, which is the firmware's fixed ceiling. It drops to **30 fps** with the heaviest reactive scene while 31 key presses per second are simulated (2–3× the fastest human typing).
- Halo calibration done. LEDs 9, 10 and 45 have no LED fitted. The measured positions are now the built-in defaults.
- Changes made from your notes, all in the 2026-09-25 update:
  - Fn+Enter jumps to Composer;
  - Caps Lock turns magenta on the key and the status bar;
  - a new default look;
  - Studio fixes (color picker, zone cards, bezels, hidden unfitted LEDs, true-to-LED preview).

### Stage 4: after flashing the 2026-09-25 update

- [ ] Flash `nuphy_halo75v2_ansi_composer.bin` with Esc held (Part 2). Typing works.
- [ ] The default look matches Stage 2, and halo effects line up without recalibrating.
- [ ] **Fn+Enter** switches between Composer and the stock effect you were last on (Solid Color right after a flash).
- [ ] **Caps Lock** lights the Caps key and the status bar magenta.
- [ ] In VIA, with the new `dist\halo75v2_composer_via3.json`, the Fn+Enter key shows as "Composer On/Off", and Fn+Ins shows as "Toggle Power On Animation".
- [ ] Claude Code: `python tools\halo_kb.py selftest`.

**Stage 4 result (2026-09-25):** passed. You confirmed the look, Fn+Enter, Caps Lock and VIA. Claude Code read Fn+Enter = `HC_TOGGLE` (0x7E2D) on both Fn layers and 1,485 bytes of macro space from the keyboard; self-test 27/27 at 40 fps. These are the files to publish as the first tagged release.

## Part 4: going back to NuPhy's original firmware

Flash `QMK_firmware_nuphy_halo75_v2_ansi_v2.1.5.bin` using Part 2. Then load NuPhy's VIA definition (`nuphy-halo75-v2-via.json`, in your Downloads) in VIA as before. The halo shortcuts in [USER_GUIDE.md](USER_GUIDE.md#keyboard-shortcuts) that are marked *stock* apply again.

## Part 5: updating Composer later

1. `python tools\halo_kb.py scene-backup backups\before-update.halo.json`
2. Flash the new `nuphy_halo75v2_ansi_composer.bin` (Part 2).
3. `python tools\halo_kb.py on`, then `python tools\halo_kb.py scene-restore backups\before-update.halo.json --save`

Or in Studio: **Scenes → My scenes** keeps everything you saved in that browser, including the auto-backup made each time you connect.

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| No yellow "DFU" text in QMK Toolbox | Esc wasn't held before the cable went in, the switch isn't on wired, or the driver is missing (see Part 2, step 3) |
| Keyboard doesn't type after flashing | Unplug and re-plug. If it's still dead, flash NuPhy's `.bin` (Part 4). If Esc-hold no longer reaches flashing mode (Esc-hold is detected by the firmware itself), use the hardware recovery button: remove the Caps Lock keycap, hold the small black button next to its switch, and plug in. |
| Studio says "not running the Halo Composer firmware" | The keyboard is still on stock or ryodeushii `via` firmware. Flash `...composer.bin` |
| Studio "timeout" or VIA "Receiving incorrect response" | Another tab or app is using the keyboard. Close VIA and other Studio tabs, then reconnect |
| Keys dark but the halo lit, or the reverse | Brightness: Fn+↑ for keys, Fn+M+↑ for the halo. In Studio, check the zone's Min/Max brightness |
| A stock effect is showing instead of your Composer look | Press **Fn+Enter** |
| Composer look gone after unplugging | The scene wasn't saved. In Studio press **Save to keyboard** |
| Everything reset after holding Fn+[ | That's NuPhy's factory reset (hold 3 s). It also resets the Composer scene. Restore with `scene-restore --save` |

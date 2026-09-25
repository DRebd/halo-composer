# Installing Halo Composer

This guide puts the Halo Composer firmware on a NuPhy Halo75 V2, checks that it works, and covers updating to a new release later.

- **Firmware** is the small program that runs inside the keyboard. It reads the keys and drives the lights.
- **Flashing** means replacing that program with a new file (a `.bin`). It's reversible: you can always flash NuPhy's original firmware back.

> [!IMPORTANT]
> **Status:** Halo Composer is a very new project. It works on the developer's Halo75 V2 ANSI but has had little testing beyond that. Only the **ANSI** Halo75 V2 (the US-style layout, with a wide, single-row Enter key) is supported. Don't flash it onto any other model.

## What you need

- A **NuPhy Halo75 V2, ANSI version**.
- Its **USB-C cable**. Flashing only works over the cable.
- A **Windows or macOS computer**.
- **QMK Toolbox**, a free flashing app. QMK is the open-source keyboard firmware the Halo75 V2 runs. [Step 1](#step-1-install-qmk-toolbox) covers installing it.
- These files from the latest release on the project's **[Releases page](https://github.com/DRebd/halo-composer/releases)** (listed under *Assets*):

| File | What it is |
|---|---|
| `nuphy_halo75v2_ansi_composer.bin` | The firmware. This is the file you flash. |
| `halo75v2_composer_via3.json` | The VIA definition. VIA is a web app for remapping keys; you only need this file if you use it (see [step 4](#step-4-check-that-it-worked)). |
| `SHA256SUMS.txt` | Checksums, to confirm the download isn't damaged (optional, below). |

### Optional: check the download

A checksum is a fingerprint of a file. If yours matches the one in `SHA256SUMS.txt`, the file arrived intact.

- **Windows:** open the Start menu, type `cmd`, press Enter, and run:

  ```
  cd Downloads
  certutil -hashfile nuphy_halo75v2_ansi_composer.bin SHA256
  ```

- **macOS:** open Terminal (Applications → Utilities) and run:

  ```
  cd ~/Downloads
  shasum -a 256 nuphy_halo75v2_ansi_composer.bin
  ```

Compare the long string it prints with the one next to `nuphy_halo75v2_ansi_composer.bin` in `SHA256SUMS.txt` (open that file in Notepad or TextEdit). Capital and small letters count as the same. If the two strings differ, download the file again.

## Before you start

- **Flashing resets the keyboard's saved settings.** Holding Esc to enter flashing mode ([step 2](#step-2-put-the-keyboard-in-flashing-mode)) wipes all of them: key changes made in VIA, lighting settings, and the Composer scene (the saved look). A new keyboard has nothing to lose. If you've remapped keys in VIA, note your changes so you can redo them.
- **Bluetooth pairings** are kept in the keyboard's separate wireless chip and should survive, but this hasn't been confirmed. Be ready to pair your devices again.
- **Close VIA and Halo Studio**, including every Studio tab. Two programs talking to the keyboard at once confuse each other.
- **Set the mode switch on the back to wired** and use the USB-C cable.
- **Allow about half an hour** the first time. Later updates take a few minutes.

If anything goes wrong, there's a hardware recovery button under the Caps Lock keycap (see [step 2](#step-2-put-the-keyboard-in-flashing-mode)), and NuPhy's original firmware can always be flashed back (see [Other firmware](#other-firmware)).

## Step 1: Install QMK Toolbox

QMK Toolbox is the free flashing app that NuPhy's own instructions also use. Download it from the *Assets* of the latest release at https://github.com/qmk/qmk_toolbox/releases.

- **Windows** (Windows 10 version 20H1 or later): download and run `qmk_toolbox_install.exe`. The first time QMK Toolbox starts, it asks *"Would you like to install drivers for your devices?"* Click **Yes** and approve the administrator prompt. These drivers let Windows talk to the keyboard in flashing mode.
- **macOS** (macOS 12 Monterey or later): download `QMK.Toolbox.pkg` and open it. If you use Homebrew (a command-line app installer for macOS), `brew install qmk-toolbox` does the same. Macs don't need the driver step.

## Step 2: Put the keyboard in flashing mode

Flashing mode, also called **DFU** (Device Firmware Update) mode, is a special state where the keyboard stops typing and waits for new firmware.

1. Open **QMK Toolbox**.
2. Unplug the keyboard and set its switch to **wired**.
3. **Hold Esc**, keep holding it, and plug in the USB cable.
4. Release Esc when **yellow text** appears in the QMK Toolbox window saying a DFU device connected, for example `STM32 DFU device connected (WinUSB): ...`. On a Mac in light mode the text looks orange. The keyboard doesn't type in this mode; that's expected.

**No yellow text?** Unplug and try again, making sure you're holding Esc *before* the cable goes in.

**Shows `(NO DRIVER)`?** (Windows only.) The flashing driver is missing. In QMK Toolbox choose **Tools → Install Drivers...** (or press **Ctrl+N**) and approve the administrator prompt. If it says it needs administrator rights, close QMK Toolbox, right-click it, choose **Run as administrator**, and try again.

**Fallback: the hardware recovery button.** If holding Esc never works, for example after a failed flash, pull off the **Caps Lock** keycap. Next to its switch is a small black button. Hold it while you plug in the cable. This forces flashing mode even if the firmware won't start. It comes from ryodeushii's flashing instructions; NuPhy doesn't document it.

## Step 3: Flash the firmware

1. In QMK Toolbox, click **Open** and pick `nuphy_halo75v2_ansi_composer.bin`. You can ignore the other settings, such as *MCU (AVR only)*, which is for a different kind of chip.
2. Click **Flash**. Don't unplug the cable until the yellow text says **Flash complete**.
3. Unplug the keyboard, plug it back in, and type a few characters to check that it works.

The keyboard now starts from scratch. Its VIA key changes, lighting settings and Composer scene are all back to their defaults, and Composer's factory look is running.

## Step 4: Check that it worked

- **The factory look shows.** The keys glow warm white (2700K, like a warm incandescent bulb). When you press a key, it flashes mint green for about half a second and a mint ripple spreads about two keys around it. The halo, the light strip around the base, is the same warm white and breathes slowly between 30% and 100%.
- **Fn+Enter** switches between Composer and the keyboard's stock effects. Right after a flash, the stock effect is Solid Color. Press Fn+Enter again to come back.
- **Brightness:** Fn+↑/↓ changes the keys, and Fn+M+↑/↓ changes the halo (hold Fn and M, then press the arrow). Turn the keys all the way down: the halo should stay lit.
- **Caps Lock** lights the Caps key and the status bar magenta.
- **Optional, if you use VIA.** VIA ([usevia.app](https://usevia.app), in Chrome or Edge) is a web app for remapping keys. It needs a *definition* file that describes this firmware:
  1. In VIA, open the **Settings** tab and turn on **Show Design tab**.
  2. Open the **Design** tab. Next to **Load Draft Definition**, click **Load** and pick `halo75v2_composer_via3.json`.
  3. In the **Configure** tab, under **Lighting**, the **Effect** list now ends with **Composer (Halo Studio)**. The Fn+Enter key shows as **Composer On/Off**.
  4. **Close VIA** when you're done. VIA and Halo Studio can't use the keyboard at the same time.

## Next: open Halo Studio

Open **https://drebd.github.io/halo-composer/** in **desktop Chrome or Edge**. These browsers support WebHID, the feature that lets a web page talk to a USB device after you pick it in a pop-up. Click **Connect keyboard** and pick the NuPhy entry. The pill at the top should read **Connected · Composer on**. Then read the [User guide](USER_GUIDE.md) to make the look your own.

The halo layout is built in, so you only need to calibrate if halo effects don't line up (see [Halo setup](USER_GUIDE.md#halo-setup-calibration)).

## Updating to a new release

Flashing resets the keyboard's saved settings, so save your look first.

1. **Export your scene.** Open Halo Studio, click **Connect keyboard**, go to the **Scenes** tab, type a name, and click **Export current as file**. This downloads a `.halo.json` file.
2. **If you've remapped keys in VIA**, save them too: in VIA's **Configure** tab, open **Save + Load** and click **Save** next to **Save Current Layout**.
3. **Close Studio and VIA**, download the new release's files, and flash the new `nuphy_halo75v2_ansi_composer.bin` exactly as in [step 2](#step-2-put-the-keyboard-in-flashing-mode) and [step 3](#step-3-flash-the-firmware).
4. **Bring your look back.** Reload the Halo Studio page so you have its newest version, and connect. On the **Scenes** tab, click **Import file…**, pick your file, then click **Save to keyboard**.
5. **If you use VIA**, load the new release's `halo75v2_composer_via3.json` (as in [step 4](#step-4-check-that-it-worked)). Then use **Save + Load** → **Load Saved Layout** to restore your keys.

Importing a scene in Studio keeps the halo layout that's already in the editor, which after a flash is the built-in one. If you calibrated the halo yourself, calibrate again after importing, or use the command-line tool below, which restores the calibration too.

*Optional, if you're comfortable with Python (a programming language) and the command line:* with a copy of this repository and the USB library installed (`pip install hidapi`), run `python tools/halo_kb.py scene-backup before-update.halo.json` before flashing and `python tools/halo_kb.py scene-restore before-update.halo.json --save` afterwards. See [DEVELOPING.md](DEVELOPING.md).

## Other firmware

**Only want ryodeushii's improvements, without Composer?** Halo Composer is built on [ryodeushii's firmware](https://github.com/ryodeushii/qmk-firmware), a community-improved version of NuPhy's firmware ([what it changes](WHATS_DIFFERENT.md)). On its own, it's a stable base with no Composer. Ready-made files are on [his Releases page](https://github.com/ryodeushii/qmk-firmware/releases). At the time of writing, his newest release is **ryo-1.1.4** from September 2024. It includes a Halo75 V2 build, `halo75v2-via-ryo-1.1.4.bin`, and its VIA definition, `NuPhy.Halo75v2.via3.json`. His code has changed since then, and Halo Composer builds on a newer version, but those newer versions aren't published as ready-made files. Flash his `.bin` the same way as above.

*To return to NuPhy's original firmware, flash NuPhy's official file the same way. See [NuPhy's update instructions](https://nuphy.com/pages/update-instructions), or download [v2.1.5 for the Halo75 V2 ANSI](https://cdn.shopify.com/s/files/1/0268/7297/1373/files/QMK_firmware_nuphy_halo75_v2_ansi_v2.1.5.bin?v=1741067981) directly.*

## Troubleshooting

| What you see | Likely cause and fix |
|---|---|
| No yellow "DFU device connected" text in QMK Toolbox | Esc wasn't held before the cable went in, the switch isn't on wired, or (on Windows) the driver is missing. See [step 2](#step-2-put-the-keyboard-in-flashing-mode). |
| QMK Toolbox shows **(NO DRIVER)** | Windows only. Choose **Tools → Install Drivers...** (Ctrl+N) and approve the prompt. If that fails, run QMK Toolbox as administrator. |
| The keyboard doesn't type after flashing | Unplug it and plug it back in. If it still doesn't type, flash again. If holding Esc no longer reaches flashing mode, use the recovery button under the Caps Lock keycap ([step 2](#step-2-put-the-keyboard-in-flashing-mode)), then flash this firmware or NuPhy's. |
| A stock effect is showing | Press **Fn+Enter**. |
| Keys dark but the halo lit, or the reverse | Brightness: Fn+↑ for the keys, Fn+M+↑ for the halo. In Studio, check the zone's Min bright and Max bright. |
| Your Composer look is gone after unplugging | It wasn't saved. In Studio, click **Save to keyboard**. |
| Everything reset after holding Fn+[ | That's the factory reset (hold about 3 seconds). It resets the Composer scene too. In Studio, import your exported scene and click **Save to keyboard**. |
| Studio says your keyboard "is not running the Halo Composer firmware" | It's still on NuPhy's or ryodeushii's firmware. Flash `nuphy_halo75v2_ansi_composer.bin`. |
| Studio says "Could not connect" or shows a timeout; VIA says "Receiving incorrect response" | Another tab or app is using the keyboard. Close VIA and other Studio tabs, then connect again. |
| Studio says the firmware scene layout "doesn't match this Studio" | The firmware and Studio are from different versions. Flash the latest release and reload the Studio page. |
| Studio can't find the keyboard, or there's no NuPhy entry in the pop-up | Use desktop Chrome or Edge, set the switch to wired, and use the cable. |
| Halo waves, comets or ripples don't line up with the halo | In Studio, open **Halo setup**. If it shows a **Custom layout** notice you didn't expect, click **Use built-in layout**, then **Save to keyboard**. Otherwise, calibrate (see [Halo setup](USER_GUIDE.md#halo-setup-calibration)). |

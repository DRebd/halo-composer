# User guide: Halo Studio and the keyboard

Halo Studio is the editor for the Halo Composer firmware. Open it in **desktop Chrome or Edge**:

**https://drebd.github.io/halo-composer/**

You can design without a keyboard: the animated preview uses the same math as the firmware, so what you see is what the keyboard will show. The preview also converts LED values into how the eye sees them, so whites and dim colors look on screen roughly as they do on the keys. Screens and LEDs differ, so treat it as close rather than exact. Connecting sends your design to the keyboard live.

## Quick start: the look you asked for

The **factory default** of the Composer firmware (the starter scene **Warm Desk**) is the look you picked on 2026-09-25: 2700K warm-white keys; the key you press flashes mint (#70FF94) for about half a second and sends a mint ripple about two keys outwards; a 2700K halo breathing between 30% and 100%. It uses *Match screen colors*, so the keys show colors the way your monitor does. Composer is the effect the keyboard starts with after flashing. If you've switched to a stock effect, press **Fn+Enter** to jump back (press it again to return to the stock effect), or use Device → Turn Composer on. Everything below is for making it your own.

## Connecting

1. Plug in the USB cable and set the switch to **wired**. Close VIA and any other Studio tab.
2. Click **Connect keyboard** and pick the NuPhy entry in the browser pop-up. The browser only lets the page talk to the device you pick.
3. Studio reads the scene stored on the keyboard. Whatever was in the editor before is saved automatically under **Scenes → My scenes**.

The pill at the top shows the state: *Preview only* (not connected), *Connected · Composer off*, or *Connected · Composer on*.

- **Live push** (top bar, on by default) sends every change to the keyboard's temporary memory as you edit.
- **Save to keyboard** writes it permanently, so it survives unplugging.
- **Revert** throws away unsaved changes and reloads what's saved on the keyboard.

## The screen

**Left: the keyboard preview.**

- **Tool:**
  - *Select*: click an LED, drag a box, **Shift** adds, **Alt** removes, **Ctrl** toggles.
  - *Paint*: brush the current color onto LEDs.
  - *Eyedropper*: pick up an LED's color.
  - *Type*: click keys, or type on your real keyboard, to try keypress reactions.
- **Show:** *Live* (animated), *Base colors* (painted colors without effects), or *Zones* (a zone number on every LED).
- **Select buttons:** All, Keys, Halo, WASD, Arrows, Letters, Home row, Numbers, F-row, Mods, Nav, Status bar, Badge, Halo front/back/sides, Invert, None. **Ctrl+A** selects everything; **Esc** clears the selection.
- **Preview sliders** mimic the keyboard's brightness keys. They only affect the preview.

**Right: tabs.**

### Paint

- Pick a color with the color square, hex code, hue/saturation/brightness sliders, or a preset. Presets include whites from candle (1900 K) to daylight (6500 K), plus warm, cool and vivid colors.
- **Fill selection**, **Darker** and **Lighter** apply to the selected LEDs.
- **Bake a gradient**: paints a gradient across the selection in any direction. These become fixed per-LED colors.
- **Selection flags**: make LEDs ignore keypress reactions, for example keep the halo calm while keys ripple.

Painted colors show on any LED whose zone uses **Painted colors** as its source.

### Zones

Every LED belongs to one of 8 zones. Defaults: 1 = Keys, 2 = WASD, 3 = Halo. Select LEDs and click **Put selection in zone N**. Each zone has:

| Setting | What it does |
|---|---|
| **Effect** | The animation (list below) |
| **Speed** | Shown as seconds per cycle, from about 16 s (slowest) to about 1 s (fastest) |
| **Min / Max bright** | How dark and how bright the effect goes. *Breathe* at Min 50% / Max 100% never goes fully dark |
| **Effect axis + Spread** | Direction of travel, and how much of a cycle is spread across it. Axes: left→right, back→front, center→out, around the center, spiral, diagonal, around the halo ring, or none (everything in sync) |
| **Reverse / Mirror / Scroll colors too** | Run backwards; fold the pattern at the middle; also slide the colors |
| **Source** | Where colors come from: *Painted colors* (per LED), *Zone color*, *Gradient*, or *Rainbow* |
| **Accent color** | Used by Sparkle, Raindrops, Ripple and Heatmap. Black means "use each LED's own color" |
| **Keypress overlay** | Flash, Glow, Ripple, or Halo echo (lights the halo LEDs nearest the key you pressed), with fade time and color |

### Effects

Every effect animates *your* colors instead of replacing them. The Effects tab shows a live mini-preview of each one.

| Effect | What it looks like |
|---|---|
| Static | Solid and always on at Max |
| Breathe | Fades smoothly between Min and Max. With Spread, a breathing wave travels along the axis |
| Heartbeat | Two quick beats, then a rest at Min |
| Wave | A soft bright band sweeps across over a dimmer background |
| White wave | A band sweeps across and washes colors toward white |
| Hue drift | Each LED swings a little around its own hue: subtle "living" color |
| Color cycle | Rotates each LED around the color wheel. With Spread: rainbow sweeps, pinwheels, rings, spirals |
| Flow | Slides a gradient or rainbow along its axis |
| Sparkle | Random LEDs flash to the accent color |
| Candle | Each LED flickers smoothly and independently, like a flame |
| Raindrops | Random LEDs slowly fade to the accent color and back |
| Comet | Bright heads with fading tails. Use the Ring axis to orbit the halo |
| Strobe | Hard blink between Max and Min (alerts, not all-day use) |
| Reactive fade | Dark until you press a key; that key lights up and fades |
| Ripple | Each keypress sends out a ring of the accent color, all the way into the halo |
| Heatmap | Keys you use a lot glow toward the accent color and cool down in about 10 s |
| Off | Zone stays dark |

### Gradients

4 gradient slots, each with up to 6 color stops. Drag stops, add or remove them, loop back to the first color, or reverse. There are 12 presets: Sunset, Aurora, Ember, Ocean, Warm glow, Fire, Vaporwave, Candy, Forest, Ice, Spectrum, Mono amber. A zone uses a gradient when its Source is *Gradient*; the *Flow* effect makes it move.

### Scenes

- **Starter scenes:** Warm Desk, Ember Comet, Aurora Drift, Synthwave, Candlelight, Typing Ripples, Focus, Stealth, Rainbow Classic, Heatmap, Ocean Tide. Loading one never changes your halo calibration.
- **My scenes** are stored *in this browser, for this web address only*. Use **Export** / **Import file** (`.halo.json`) to move them between browsers or computers, or to share them. Studio also keeps the last 5 automatic backups it makes when connecting or reading the keyboard.
- The keyboard stores **one** saved scene: the last one you **Save to keyboard**.

### Halo setup (calibration)

NuPhy doesn't publish where the halo LEDs sit. The built-in layout was measured on your Halo75 V2 on 2026-09-25, so you only need this if waves, comets or ripples don't line up. Of the 45 halo channels, LEDs 9, 10 and 45 have no LED fitted: Studio hides them, calibration skips them, and ring effects ignore them.

1. Connect the keyboard. Composer has to be the running effect; if it isn't, press **Fn+Enter**.
2. **Start placing**: the keyboard goes dark except one amber halo LED. Click where it is on the drawing. The next one lights up automatically. **Skip** any you can't see.
3. **Walk the ring** lights them in order. Check it goes smoothly around.
4. **Save to keyboard.**

The calibration is part of the saved scene. To keep it through a firmware update, see [FLASHING.md, Part 5](FLASHING.md#part-5-updating-composer-later).

### Device

- Composer on/off, **Read from keyboard**, **Push editor to keyboard**, and **Factory scene** (loads the default look but keeps your calibration).
- **Match screen colors (perceptual brightness)**: the keys show colors and brightness levels the way your screen does. The factory look uses it. With it off, the LEDs get raw values, which look whiter and brighter than on screen (the reason the first default looked too white).
- **Halo follows key brightness**: use Fn+↑/↓ for everything instead of Fn+M+↑/↓ for the halo.
- **Measure keyboard frame rate** (should be ≥ 25 fps) and a log of USB messages, useful when reporting problems.

## Keyboard shortcuts

These apply to the Composer firmware, which uses ryodeushii's layout (the same keys as NuPhy's, plus a few extras). The **Mac/Win switch** picks the layout. Fn is the key right of the right Cmd/Alt. Holding Fn may tint the keys that have a function, which is ryodeushii's key highlight.

### Lighting

| Keys | Composer on | Stock effects / halo modes |
|---|---|---|
| Fn + Enter | **Jump to Composer**, or back to the stock effect you were on | same |
| Fn + ← (with Shift: backwards) | Next (previous) lighting effect. There are 43; Composer is the **last** | same |
| Fn + ↑ / ↓ | **Key** brightness (Composer's master for keys) | same |
| Fn + → | no effect on Composer | hue of stock effects |
| Fn + , / . | no effect (each zone has its own speed) | speed of stock effects |
| Fn + M + ↑ / ↓ | **Halo** brightness: 6 steps (0, 19, 38, 56, 78, 100%) | same (stock halo) |
| Fn + M + ← / → / , / . | no effect on Composer | halo mode / color / speed |
| Fn + C (hold) | LED test: all LEDs red, green, blue | same |

### Everything else (from ryodeushii's firmware source, not yet tried on your board)

| Keys | Does |
|---|---|
| Fn + 1 / 2 / 3 | Bluetooth device 1–3 (hold about 3 s to pair) |
| Fn + 4 | 2.4 GHz dongle. Wired mode is set by the switch |
| Fn + \ | Show the battery level on the halo (toggle) |
| Fn + ] | Auto-sleep on/off |
| Fn + A / S / D | Sleep timeout shorter / show / longer |
| Fn + O | Deep-sleep on/off · **Fn + P**: sleep while on USB on/off |
| Fn + Y / U / I | Key-press debounce shorter / show / longer (advanced; fixes chatter) |
| Fn + H / J / K | Key-release debounce shorter / show / longer |
| Fn + Caps Lock | Change where the Caps Lock indicator shows: status bar, Caps key, both (the default), or off. It's magenta, so it doesn't look like the red low-battery warning |
| Fn + Insert | Power-on halo animation on/off |
| Fn + [ (hold 3 s) | **Factory reset**: lighting, VIA key changes, pairings, and the Composer scene |
| PrtSc / Fn + PrtSc | Mac: area / full screenshot · Win: Snipping Tool / Print Screen |

For NuPhy's **stock** firmware shortcuts, see the cheat sheet the original conversation produced ("Halo75 V2 Lighting Keys"). On stock, the halo has 8 fixed colors and Breath fades fully off; Composer removes both limits.

## Things to know

- **USB only for editing.** Studio and VIA need the cable in wired mode. Saved lighting runs in every mode.
- **One editor at a time.** VIA and Studio (or two Studio tabs) at once confuse each other. Close one.
- **Macro space** in VIA is 1,485 bytes with Composer (2,400 in ryodeushii's plain build; both computed from the source), because the scene uses that space.
- **Firmware updates** reset saved settings when you enter flashing mode with Esc. Back up the scene first ([FLASHING.md, Part 5](FLASHING.md#part-5-updating-composer-later)).

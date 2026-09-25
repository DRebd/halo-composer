# User guide: Halo Studio and the keyboard

Halo Studio is the editor for the Halo Composer firmware. It runs in your browser. Open it in **desktop Chrome or Edge**:

**https://drebd.github.io/halo-composer/**

Studio talks to the keyboard over the USB cable using **WebHID**, the Chrome and Edge feature that lets a web page talk to a USB device after you pick it in a pop-up. Other browsers can still use the editor and preview, but can't connect to the keyboard. If the firmware isn't on your keyboard yet, start with [FLASHING.md](FLASHING.md).

You can design without a keyboard. The animated preview uses the same lighting math as the firmware, so what you see is what the keyboard will show. The preview also shows LED colors the way the eye sees them: an LED's light rises in step with its value, but a screen's doesn't, so Studio converts each value before drawing it. Whites and dim colors therefore look on screen roughly as they do on the keys. Screens and LEDs still differ, so treat the preview as close rather than exact.

A **scene** is everything about a look: the color of every LED, the zones and their effects, the gradients, and the halo layout.

## Quick start: the factory look

After flashing, the keyboard runs Composer with its factory look, the starter scene **Warm Desk**:

- **Keys:** warm white at 2700K, the color of a warm incandescent bulb (the screen color 255, 167, 87).
- **Pressing a key:** it flashes mint (#70FF94) for about half a second (560 ms), and a mint ripple spreads about two keys around it.
- **Halo:** the same 2700K warm white, breathing slowly between 30% and 100%. One breath takes about 4.7 seconds.

Warm Desk has **Match screen colors (perceptual brightness)** turned on (in the Device tab), so the LEDs show these colors the way a screen does.

If a stock effect is showing instead, press **Fn+Enter** to jump to Composer (press it again to return to the stock effect), or click **Turn Composer on** on the Device tab. To get the factory look back later, load **Warm Desk** on the Scenes tab or click **Factory scene** on the Device tab, then click **Save to keyboard**.

Everything below is for making it your own.

## Connecting

1. Plug in the USB cable and set the switch on the keyboard to **wired**. Close VIA (the key-remapping web app) and any other Studio tab.
2. Click **Connect keyboard** and pick the NuPhy entry in the browser pop-up. The browser only lets the page talk to the device you pick.
3. Studio reads the scene stored on the keyboard. Whatever was in the editor before is saved automatically under **Scenes → My scenes**.

The pill at the top shows the state: *Preview only* (not connected), *Connected · Composer off*, or *Connected · Composer on*. While connected, the Connect button reads **Disconnect**.

- **Live push** (top bar, on by default) sends every change to the keyboard's temporary memory as you edit.
- **Save to keyboard** stores the scene permanently, so it survives unplugging.
- **Revert** throws away unsaved changes and reloads the scene saved on the keyboard.

## The screen

**Left: the keyboard preview.**

- **Tool:**
  - *Select*: click an LED or drag a box. **Shift** adds to the selection, **Alt** removes, **Ctrl** (Cmd on a Mac) toggles.
  - *Paint*: click or drag to brush the current color onto LEDs.
  - *Eyedropper*: click an LED to pick up its color. Studio then switches to Paint.
  - *Type (test reactive)*: click keys, or type on your real keyboard, to try keypress reactions. When connected with Composer on, the keyboard reacts too.
- **Show:** *Live* (animated), *Base colors* (the stored colors without effects), or *Zones* (a zone number on every LED).
- **Select buttons:** All, Keys, Halo, WASD, Arrows, Letters, Home row, Numbers, F-row, Mods, Nav, Status bar, Badge, Halo front, Halo back, Halo sides, Invert, None. Shift-click a button to add to the selection, Alt-click to remove. **Ctrl+A** (Cmd+A) selects everything; **Esc** clears the selection.
- **Preview row:** *Animate* pauses or plays the animation. *Simulated typing* fakes keypresses in the preview. The *Key brightness* and *Halo level (Fn+M+↑/↓)* sliders mimic the keyboard's brightness keys. These only affect the preview.

**Right: the tabs.** Paint, Zones, Gradients, Effects, Scenes, Halo setup and Device, each described below.

### Paint

- **Color:** pick with the color square, a hex code, the Hue / Saturation / Brightness sliders, or a preset. Presets include whites from Candle 1900K to Daylight 6500K plus Pure white, and groups of warm, cool and vivid colors. *Mint*, in the cool group, is the factory flash color.
- **Apply to selection:** **Fill selection**, **Darker** and **Lighter** change the selected LEDs. **Paint brush** and **Eyedropper** switch tools.
- **Bake a gradient into the selection:** choose a gradient slot and a Direction, then click **Paint gradient across selection**. This writes fixed per-LED colors. For a moving or zone-wide gradient, set a zone's Source to *Gradient* instead.
- **Selection flags:** **Ignore keypress overlays** makes the selected LEDs skip their zone's keypress overlay, for example to keep some LEDs steady while the rest of the zone reacts. **React to keypresses** undoes it.

Painted colors show on any LED whose zone uses *Painted colors* as its source. Effects then animate on top of them.

### Zones

Every LED belongs to one of 8 zones, and each zone has its own effect, speed, brightness range and colors. In the factory look, all keys are in zone 1 (*Keys*), the halo is in zone 3 (*Halo*), and zone 2 is empty. Some starter scenes use zone 2 for WASD.

**Zone cards.** The tab opens with one card per zone. Each card shows the zone's number on its color tag (the same color the *Zones* view uses), its name, how many LEDs it holds (or *empty*), and its effect and color source. Click a card to edit that zone.

Under the cards:

- **Put selection in zone N** moves the selected LEDs into the zone you're editing.
- **Select this zone** selects its LEDs. **Show zone numbers** switches the preview to the *Zones* view.

Each zone has these settings:

| Setting | What it does |
|---|---|
| **Name** | A label for the card, up to 18 characters. Names are kept by Studio and in exported scene files, not on the keyboard. |
| **Effect** | The animation (see [Effects](#effects)). A short description appears under it. |
| **Speed** | Shown as seconds per cycle, from about 16 s (slowest) to about 1 s (fastest). |
| **Min bright / Max bright** | How dark and how bright the effect goes. *Breathe* at Min 50% / Max 100% never goes fully dark. |
| **Extra sliders** | Some effects add one or two, such as Ripple's *Ring width* and *Reach* (see the [Effects](#effects) table). |
| **Effect axis + Spread** | The direction of travel, and how much of a cycle is spread across it. Axes: Left → right, Back → front, Center → out, Around center, Spiral, Diagonal, Ring (halo order), or None (in sync). |
| **Reverse / Mirror / Scroll colors too** | Run backwards; fold the pattern at the middle so it runs out from (or into) the center; also slide the gradient or rainbow colors at the effect's speed. |
| **Source** | Where the colors come from: *Painted colors (per LED)*, *Zone color*, *Gradient* (pick one of the 4 slots), or *Rainbow*. For Gradient and Rainbow, *Color axis* sets the direction and *Color scale* stretches or squeezes the colors. |
| **Zone color / Accent color** | With Source set to *Zone color*, this is the zone's single color. Otherwise it's the accent color that Sparkle, Raindrops, Ripple and Heatmap use. Black means "use each LED's own color"; Raindrops then shifts hue instead. |
| **Keypress overlay** | A reaction on top of the effect: *None*, *Flash*, *Glow*, *Ripple* (a ring rolls out from the key into the halo), or *Halo echo* (lights the halo LEDs nearest the pressed key; use it on halo zones). *Fade* sets how long it lasts, from 0.2 s to 2 s. *Reaction color* picks its color (black means white). |

Tip: switch the Tool to *Type (test reactive)* and click keys to try reactions.

### Effects

Every effect animates *your* colors instead of replacing them. The Effects tab shows a live mini-preview of each one, using a sunset gradient (reactive effects simulate typing). **Use in zone N** applies an effect to the zone you're editing.

| Effect | What it looks like | Extra sliders |
|---|---|---|
| Static | Solid and always on at Max | |
| Breathe | Fades smoothly between Min and Max. With Spread above 0, a breathing wave travels along the axis | |
| Heartbeat | Two quick beats, then a rest. Min is the resting glow | |
| Wave | A soft bright band sweeps along the axis over a dimmer (Min) background | Band width |
| White wave | A band sweeps across and washes each LED toward white as it passes | Band width, Whiteness |
| Hue drift | Each LED swings a little around its own hue: subtle "living" color | Swing |
| Color cycle | Rotates each LED around the color wheel. With Spread: rainbow sweeps; Around center gives a pinwheel, Center → out rings, Spiral a spiral | |
| Flow | Slides a gradient or rainbow along its axis. Pair it with a Gradient source | |
| Sparkle | Random LEDs flash to the accent color, then fade back to the Min glow | Density |
| Candle | Each LED flickers smoothly and independently between Min and Max, like a flame | |
| Raindrops | Random LEDs slowly fade to the accent color and back | Density, Hue shift |
| Comet | Bright heads with fading tails. Use the Ring axis to orbit the halo | Tail length, Comets (1–8) |
| Strobe | Hard blink between Max and Min. Good for alerts, not all-day use | On time (duty) |
| Reactive fade | Sits at Min until you press a key; that key jumps to Max and fades. Speed sets how long the fade lasts | |
| Ripple | Each keypress sends out a ring of the accent color. Min bright is the resting brightness, Max bright the ring. **Reach** sets how far rings travel before fading, shown in keys; slide it fully left for the whole board. Rings reach halo LEDs only if they're in the same zone | Ring width, Reach |
| Heatmap | Keys you use a lot drift toward the accent color and cool down over about 10 seconds | |
| Off | The zone stays dark | |

The factory look uses the *Ripple effect* on the keys (Reach 2 keys, mint accent) together with a *Flash* keypress overlay.

### Gradients

There are 4 gradient slots, each with up to 6 color stops. Pick a slot, then for each stop set its color and drag its position slider, or remove it with **×**. **Add stop**, **Loop back to the first color** and **Reverse** change the whole gradient. **Load a preset…** offers 12: Sunset, Aurora, Ember, Ocean, Warm glow, Fire, Vaporwave, Candy, Forest, Ice, Spectrum and Mono amber.

A zone uses a gradient when its Source is *Gradient*. The *Flow* effect makes it glide.

### Scenes

- **Starter scenes:** Warm Desk (the factory look), Ember Comet, Aurora Drift, Synthwave, Candlelight, Typing Ripples, Focus, Stealth, Rainbow Classic, Heatmap and Ocean Tide. Loading one replaces the look in the editor and, with Live push on, sends it to the keyboard. Click **Save to keyboard** to keep it. Loading a scene never changes your halo calibration.
- **My scenes (this browser):** type a name and click **Save current**. Each saved scene has **Load**, **Export** and **Delete** buttons. They're stored *in this browser, for this web address only*. Studio also keeps its last 5 automatic backups, made when you connect, read from the keyboard, or load the factory scene.
- **Export current as file** and **Import file…** (`.halo.json`) move scenes between browsers or computers, or let you share them. Importing keeps the halo layout that's already in the editor.
- The keyboard stores **one** saved scene: the last one you saved with **Save to keyboard**. Keeping several scenes on the keyboard and switching between them from the keyboard is on the roadmap; see [ROADMAP_AND_HISTORY.md](ROADMAP_AND_HISTORY.md).

### Halo setup (calibration)

NuPhy doesn't publish where the halo LEDs sit. Studio has a built-in layout, measured on a Halo75 V2, which should fit yours. You only need this tab if waves, comets or ripples don't line up with the halo.

The top of the tab says which layout the editor is using:

- *Using the built-in halo layout*: nothing to do.
- A **Custom layout** notice, saying how many halo LEDs sit somewhere other than the built-in layout. That's expected if you calibrated your own keyboard. If you didn't (for example, the browser kept a layout from an older version), click **Use built-in layout** in the notice, then **Save to keyboard**.

Of the 45 halo positions, numbers 9, 10 and 45 have no LED fitted, so Studio hides them and calibration skips them.

To calibrate:

1. Connect the keyboard. Composer has to be the running effect; if it isn't, press **Fn+Enter**.
2. Click **Start placing**. The keyboard goes dark except for one amber halo LED. Click where that LED is on the drawing, and the next one lights up automatically. Click **Skip / next** for any you can't see, or **Prev** to go back. After the last LED, Studio works out the ring order from your positions.
3. Click **Walk the ring**. It lights the halo one LED at a time in ring order, on the keyboard and in the preview. Check that it goes smoothly around. Comets and the Ring axis follow this order. **Recompute ring order** rebuilds the order from the positions.
4. Click **Save to keyboard.**

**Use built-in layout**, next to Walk the ring, undoes a calibration. The calibration is part of the saved scene. Flashing new firmware resets it; see [FLASHING.md](FLASHING.md#updating-to-a-new-release).

### Device

- **Connection details:** device name, protocol version, LED count, whether Composer is active, and the scene size.
- **Turn Composer on** / **Switch back to previous effect** does the same as Fn+Enter.
- **Read from keyboard** loads the keyboard's current scene into the editor. The editor's scene is backed up to My scenes first.
- **Push editor to keyboard** sends the whole editor scene to the keyboard's temporary memory, which is useful with Live push off. Save to keep it.
- **Factory scene** loads the factory look but keeps your halo calibration. Save to keep it.
- **Match screen colors (perceptual brightness)**: on, colors and brightness levels look on the keys the way they look on screen. The factory look uses it. Off, the LEDs get raw values, which look whiter and brighter than on screen. The other starter scenes were designed with it off. It's saved as part of the scene.
- **Halo follows key brightness (Fn+↑/↓) instead of Fn+M+↑/↓**: one pair of brightness keys for everything.
- **Measure keyboard frame rate** (while connected) counts how many frames per second the keyboard draws over 2 seconds. It should be 25 fps or more.
- **HID log**: a list of the USB messages between Studio and the keyboard, useful when reporting problems.

## Keyboard shortcuts

These apply to the Composer firmware, which uses ryodeushii's layout: mostly the same keys as NuPhy's, with a few fixes and extras. The **Mac/Win switch** picks the layout. **Fn** is the key to the right of the right Cmd/Alt key. Holding Fn may tint the keys that have a function, which is ryodeushii's key highlight. "Fn + M + ↑" means hold Fn and M, then press ↑.

### Lighting

| Keys | Composer on | Stock effects / halo modes |
|---|---|---|
| Fn + Enter | **Jump to Composer**, or back to the stock effect you were on (Solid Color right after a flash) | same |
| Fn + ← (with Shift: backwards) | Next (previous) lighting effect. There are 43; Composer is the **last** | same |
| Fn + ↑ / ↓ | **Key** brightness (Composer's master for the keys) | same |
| Fn + → | no effect on Composer | hue of stock effects |
| Fn + , / . | no effect (each zone has its own speed) | speed of stock effects |
| Fn + M + ↑ / ↓ | **Halo** brightness: 6 steps (0, 19, 38, 56, 78, 100%) | same (stock halo) |
| Fn + M + ← / → / , / . | no effect on Composer | halo mode / color / speed |
| Fn + C (hold) | LED test: all LEDs red, green, blue | same |
| Caps Lock | Lights the Caps key and the status bar **magenta**, so it doesn't look like the red low-battery warning | same |
| Fn + Caps Lock | Changes where the Caps Lock indicator shows: status bar, Caps key, both (the default), or off | same |

### Everything else (from ryodeushii's firmware; not all re-tested with Composer)

| Keys | Does |
|---|---|
| Fn + 1 / 2 / 3 | Bluetooth device 1–3 (hold about 3 s to pair) |
| Fn + 4 | 2.4 GHz dongle. Wired mode is set by the switch |
| Fn + \ | Show the battery level on the halo (toggle) |
| Fn + ] | Auto-sleep on/off |
| Fn + A / S / D | Sleep timeout shorter / show / longer |
| Fn + O | Deep sleep on/off · **Fn + P**: sleep while on USB on/off |
| Fn + Y / U / I | Key-press debounce shorter / show / longer (advanced; fixes chatter, where one press types twice) |
| Fn + H / J / K | Key-release debounce shorter / show / longer |
| Fn + Insert | Power-on halo animation on/off |
| Fn + [ (hold 3 s) | **Factory reset**: lighting, VIA key changes, pairings, and the Composer scene |
| PrtSc / Fn + PrtSc | Mac: area / full screenshot · Win: Snipping Tool / Print Screen |

For what differs from NuPhy's stock firmware, see [WHATS_DIFFERENT.md](WHATS_DIFFERENT.md).

## Things to know

- **USB only for editing.** Studio and VIA need the cable, with the switch on wired. The saved look keeps running in Bluetooth and 2.4 GHz modes.
- **One editor at a time.** VIA and Studio, or two Studio tabs, confuse each other when open together. Close one.
- **Macro space** in VIA is about 1.5 KB (1,485 bytes) with Composer, instead of about 2.4 KB in ryodeushii's plain firmware, because the saved scene uses part of that space.
- **Firmware updates** reset the keyboard's saved settings, including the scene. Export your scene first; see [FLASHING.md](FLASHING.md#updating-to-a-new-release).

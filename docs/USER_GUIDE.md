# User guide: Halo Studio and the keyboard

Halo Studio is the editor for the Halo Composer firmware. It runs in your browser. Open it in **desktop Chrome or Edge**:

**https://drebd.github.io/halo-composer/**

Studio talks to the keyboard over the USB cable using **WebHID**, the Chrome and Edge feature that lets a web page talk to a USB device after you pick it in a pop-up. Other browsers can still use the editor and preview, but can't connect to the keyboard. If the firmware isn't on your keyboard yet, start with [FLASHING.md](FLASHING.md).

You can design without a keyboard. The animated preview uses the same lighting math as the firmware, so what you see is what the keyboard will show. The preview also shows LED colors the way the eye sees them: an LED's light rises in step with its value, but a screen's doesn't, so Studio converts each value before drawing it. Whites and dim colors therefore look on screen roughly as they do on the keys. Screens and LEDs still differ, so treat the preview as close rather than exact.

A **scene** is everything about a look, and its parts all work at the same time:

- a painted color for every LED, keys and halo alike;
- up to 8 **zones**, each running its own effect, speed and brightness range over those colors, or over a gradient or rainbow;
- **keypress reactions** on top: flash, glow, ripple, or an echo on the halo.

A scene also holds the 4 gradients and the halo layout.

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

**Hover help.** Rest the pointer on a label with a dotted underline, or on most buttons, and a short explanation appears. The same help shows when you reach a control with the Tab key. Some of it follows your choices: for example, the help for *Min bright* says what it does in the zone's current effect.

**Left: the keyboard preview.**

- **The drawing:** each key shows its LED's color, with its label in dark text on a white glow so it reads on any color. The halo LEDs are the dots around the edge, all the same size except the 5 smaller status-bar LEDs at the back left.
- **Tool:**
  - *Select*: click an LED or drag a box. **Shift** adds to the selection, **Alt** removes, **Ctrl** (Cmd on a Mac) toggles.
  - *Paint*: click or drag to brush the current color onto LEDs.
  - *Eyedropper*: click an LED to pick up its color. Studio then switches to Paint.
  - *Type (test reactive)*: click keys, or type on your real keyboard, to try keypress reactions. When connected with Composer on, the keyboard reacts too.
- **Show:** *Live* (animated), *Base colors* (the stored colors without effects), or *Zones* (each LED's zone number in white: at the bottom of each key, and inside each halo dot).
- **Select buttons:** All, Keys, Halo, WASD, Arrows, Letters, Home row, Numbers, F-row, Mods, Nav, Status bar, Halo front, Halo back, Halo sides, Invert, None. *Halo front* includes the short 3-LED strip between the Fn and ← keys. Shift-click a button to add to the selection, Alt-click to remove. **Ctrl+A** (Cmd+A) selects everything; **Esc** clears the selection.
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

**Zone cards.** The tab opens with one card per zone. Each card shows the zone's number, its name, how many LEDs it holds (or *empty*), and its effect and color source. Click a card to edit that zone.

Under the cards:

- **Put selection in zone N** moves the selected LEDs into the zone you're editing.
- **Select this zone** selects its LEDs. **Show zone numbers** switches the preview to the *Zones* view.

Each zone has these settings:

| Setting | What it does |
|---|---|
| **Name** | A label for the card, up to 18 characters. Names are kept by Studio and in exported scene files, not on the keyboard. |
| **Effect** | The animation (see [Effects](#effects)). A short description appears under it. |
| **Speed** | How fast the effect runs; further right is faster. The readout shows the real time of one cycle, from 16.4 s at the far left to under 1 s at the far right, and the slider moves evenly through that time. Near the slow end it jumps in bigger steps, because the keyboard stores Speed as a single number from 0 to 255. A note under the slider says what the time means for the current effect, such as "One breath takes 4.68 s". See [What Speed means](#what-speed-means) for the effects that use it differently. |
| **Min bright / Max bright** | How dark and how bright the effect goes. *Breathe* at Min 50% / Max 100% never goes fully dark. Hover help says what each one does in the current effect. |
| **Extra sliders** | Some effects add one or two, such as Ripple's *Ring width* and *Reach* (see the [Effects](#effects) table). Each shows its value in a unit: a percentage, degrees around the color wheel, keys, or a count. |
| **Effect axis + Spread** | The direction of travel, and how much of a cycle is spread across it. Axes: Left → right, Back → front, Center → out, Around center, Spiral, Diagonal, Ring (halo order), or None (in sync). |
| **Reverse / Mirror / Back and forth / Scroll colors too** | *Reverse* runs the motion the other way. *Mirror* folds the pattern at the middle so it runs out from (or into) the center. *Back and forth* runs the motion forward, then backward (see below). *Scroll colors too* also slides the gradient or rainbow colors, one pass per cycle. |
| **Source** | Where the colors come from: *Painted colors (per LED)*, *Zone color*, *Gradient* (pick one of the 4 slots), or *Rainbow*. For Gradient and Rainbow, *Color axis* sets the direction and *Color scale* stretches or squeezes the colors. |
| **Zone color / Accent color** | With Source set to *Zone color*, this is the zone's single color. Otherwise it's the accent color that Sparkle, Raindrops, Ripple and Heatmap use (other effects mark it *not used*). Black means "use each LED's own color"; Raindrops then shifts hue instead. |
| **Keypress overlay** | A reaction on top of any effect: *None*, *Flash* (the pressed key flashes), *Glow* (the keys around it light up, fading with distance), *Ripple* (a ring spreads out across this zone's LEDs; give the halo's zone a Ripple too to carry it into the halo), or *Halo echo* (the halo LEDs in the pressed key's direction, seen from the keyboard's center, light up; only halo LEDs react, so use it on halo zones). *Fade* sets how long it lasts, from 2 s at the far left to 0.2 s at the far right. *Reaction color* picks its color (black means white). |

Tip: switch the Tool to *Type (test reactive)* and click keys to try reactions.

**Back and forth.** Normally a moving effect jumps back to the start at the end of each cycle. With *Back and forth* on, the motion runs forward for one cycle, then backward for the next, at the same pace: one way takes one cycle, there and back takes two. It works with Wave, White wave, Color cycle, Flow and Comet, with Breathe when Spread is above 0, and on the color scroll of any effect when *Scroll colors too* is on. Comets bounce at the ends, and each tail folds in behind its head at the turn. Where it has nothing to act on, the checkbox is grayed out.

#### What Speed means

For most effects, Speed is the time of one cycle: one breath, one sweep of the band, one trip around the color wheel. With *Back and forth* on, the note gives both the one-way time and the there-and-back time. A few effects use Speed differently, and the slider's label and readout change to match:

| Effect | The slider shows |
|---|---|
| Ripple | **Ring speed**: how fast rings spread, from about 5 keys per second (far left) to about 47 (far right) |
| Reactive fade | **Fade speed**: how long a pressed key takes to fade back to Min, from 3.21 s (far left) to 150 ms (far right) |
| Sparkle, Raindrops, Candle | How long each sparkle or drop lasts, or how often each LED's flicker changes brightness |
| Static, Heatmap, Off | *not used*, and the slider is grayed out. With *Scroll colors too* on, Static and Heatmap use it for the scroll speed |

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
| Comet | Bright heads with fading tails. Use the Ring axis to orbit the halo. With Back and forth, they bounce between the ends of the axis | Tail length, Comets (1–8) |
| Strobe | Hard blink between Max and Min. Good for alerts, not all-day use | On time (duty) |
| Reactive fade | Sits at Min until you press a key; that key jumps to Max and fades. Speed (shown as *Fade speed*) sets how long the fade lasts | |
| Ripple | Each keypress sends out a ring of the accent color. Min bright is the resting brightness, Max bright the ring. **Reach** sets how far rings travel before fading, shown in keys; slide it fully left for the whole board. Speed (shown as *Ring speed*) sets how fast rings spread. Rings reach halo LEDs only if they're in the same zone | Ring width, Reach |
| Heatmap | Keys you use a lot drift toward the accent color and cool down over about 10 seconds. Speed isn't used | |
| Off | The zone stays dark | |

The factory look uses the *Ripple effect* on the keys (Reach 2 keys, mint accent) together with a *Flash* keypress overlay.

### Gradients

There are 4 gradient slots, each with up to 6 color stops. Pick a slot, then for each stop set its color and drag its position slider, or remove it with **×**. **Add stop** adds a stop after the last one, and **Reverse** flips the gradient end to end. **Load a preset…** offers 12: Sunset, Aurora, Ember, Ocean, Warm glow, Fire, Vaporwave, Candy, Forest, Ice, Spectrum and Mono amber.

Two checkboxes change how the gradient ends:

- **Loop back through all colors** plays the stops forward, then back again, so the gradient ends on the color it started with. Stops green, blue, purple, pink play green → blue → purple → pink → purple → blue → green. A gradient that scrolls, or runs around the halo, then has no visible seam.
- **Blend the last color into the first** fills the space after the last stop with a blend back to the first color, so a scrolling gradient loops without a jump. Leave some room after the last stop for the blend.

With both on, the blended loop plays forward, then backward.

A zone uses a gradient when its Source is *Gradient*. The *Flow* effect makes it glide.

### Scenes

- **Starter scenes:** Warm Desk (the factory look), Ember Comet, Aurora Drift, Synthwave, Candlelight, Typing Ripples, Focus, Stealth, Rainbow Classic, Heatmap and Ocean Tide. Loading one replaces the look in the editor and, with Live push on, sends it to the keyboard. Click **Save to keyboard** to keep it. Loading a scene never changes your halo calibration.
- **My scenes (this browser):** type a name and click **Save current**. Each saved scene has **Load**, **Export** and **Delete** buttons. They're stored *in this browser, for this web address only*. Studio also keeps its last 5 automatic backups, made when you connect, read from the keyboard, or load the factory scene.
- **Export current as file** and **Import file…** (`.halo.json`) move scenes between browsers or computers, or let you share them. Importing keeps the halo layout that's already in the editor.
- The keyboard stores **one** saved scene: the last one you saved with **Save to keyboard**. Keeping several scenes on the keyboard and switching between them from the keyboard is on the roadmap; see [ROADMAP_AND_HISTORY.md](ROADMAP_AND_HISTORY.md).

### Halo setup (calibration)

NuPhy doesn't publish where the halo LEDs sit. Studio has a built-in layout, measured on a Halo75 V2 and then lined up along the board's straight edges, which should fit yours. You only need this tab if waves, comets or ripples don't line up with the halo.

The top of the tab says which layout the editor is using:

- *Using the built-in halo layout*: nothing to do.
- A **Custom layout** notice, saying how many halo LEDs sit somewhere other than the built-in layout. That's expected if you calibrated your own keyboard. If you didn't (for example, the browser kept a layout from an older version), click **Use built-in layout** in the notice, then **Save to keyboard**.

Of the 45 halo positions, numbers 9, 10 and 45 have no LED fitted, so Studio hides them and calibration skips them.

To calibrate:

1. Connect the keyboard. Composer has to be the running effect; if it isn't, press **Fn+Enter**.
2. Click **Start placing**. The keyboard goes dark except for one amber halo LED. Click where that LED is on the drawing, and the next one lights up automatically. The tab shows the LED's number, its area (Status bar, Strip between Fn and ←, Front edge, Left side, Back edge or Right side) and its position. Click **Skip / next** for any you can't see, or **Prev** to go back. After the last LED, Studio works out the ring order from your positions.
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

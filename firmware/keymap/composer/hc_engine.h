// Halo Composer - per-LED lighting engine for NuPhy Halo75 V2 (and similar boards)
// Copyright 2026 Halo Composer contributors
// SPDX-License-Identifier: GPL-2.0-or-later
//
// This file is deliberately free of QMK dependencies so it can be compiled
// on a PC for unit tests and mirrored 1:1 by the JavaScript preview engine
// (halo-studio.html -> class HcEngine). Every integer operation here has an
// exact JS twin; if you change the math here, change it there too and rerun
// the parity test (tests/parity_test.mjs, run by tests/run_tests.sh).

#pragma once

#include <stdbool.h>
#include <stdint.h>

#ifndef HC_KEY_LEDS
#    define HC_KEY_LEDS 83 // per-key LEDs (index 0..82)
#endif
#ifndef HC_HALO_LEDS
#    define HC_HALO_LEDS 45 // status bar (5) + halo underglow (40), index 83..127
#endif
#define HC_LED_COUNT (HC_KEY_LEDS + HC_HALO_LEDS)

#define HC_ZONES 8
#define HC_GRADIENTS 4
#define HC_GRAD_STOPS 6
#define HC_MAX_HITS 8

#define HC_MAGIC 0xC7
#define HC_SCENE_VERSION 1

// Coordinate space: QMK convention, x 0..224, y 0..64, center (112, 32).
#define HC_CENTER_X 112
#define HC_CENTER_Y 32

#if defined(_MSC_VER)
#    define HC_PACKED
#else
#    define HC_PACKED __attribute__((packed))
#endif

// ---------------------------------------------------------------- enums ---
typedef enum {
    HC_FX_STATIC = 0,   // solid, brightness = v_max
    HC_FX_BREATHE,      // sine brightness v_min..v_max (spread>0 = breathing wave)
    HC_FX_PULSE,        // heartbeat double-beat
    HC_FX_WAVE,         // narrow bright band sweeping along the axis
    HC_FX_SATWAVE,      // whitening band sweeping along the axis
    HC_FX_HUE_DRIFT,    // hue swings +/- p1 around each LED's own hue
    HC_FX_COLOR_CYCLE,  // hue rotates through the full wheel (keeps sat/val)
    HC_FX_FLOW,         // scrolls the colour source (gradient/rainbow) along the axis
    HC_FX_SPARKLE,      // random LEDs flash to the accent colour
    HC_FX_CANDLE,       // smooth random flicker per LED
    HC_FX_RAINDROPS,    // random LEDs fade to the accent colour and back
    HC_FX_COMET,        // p2 comets with tail p1 travel along the axis (use RING for halo)
    HC_FX_STROBE,       // on/off, duty = p1
    HC_FX_REACT_FADE,   // dark (v_min) until pressed, key glows then fades
    HC_FX_RIPPLE,       // rings expand from each keypress
    HC_FX_HEATMAP,      // keys tint toward accent the more they are used
    HC_FX_OFF,          // LEDs in this zone are black
    HC_FX_COUNT
} hc_effect_t;

typedef enum {
    HC_SRC_MAP = 0,   // per-LED colour painted in the GUI
    HC_SRC_ZONE,      // the zone's colour
    HC_SRC_GRADIENT,  // multi-stop gradient sampled along src_axis
    HC_SRC_RAINBOW,   // hue from position along src_axis
    HC_SRC_COUNT
} hc_source_t;

typedef enum {
    HC_AXIS_X = 0, // left -> right
    HC_AXIS_Y,     // back -> front
    HC_AXIS_RADIAL,// centre -> outwards
    HC_AXIS_ANGLE, // around the centre (pinwheel)
    HC_AXIS_SPIRAL,// angle + radius
    HC_AXIS_DIAG,  // top-left -> bottom-right
    HC_AXIS_RING,  // halo perimeter order (keys fall back to angle)
    HC_AXIS_NONE,  // everything in phase
    HC_AXIS_COUNT
} hc_axis_t;

typedef enum {
    HC_RX_NONE = 0,
    HC_RX_FLASH,  // pressed key flashes the reactive colour then fades
    HC_RX_GLOW,   // soft glow around the pressed key
    HC_RX_RIPPLE, // ring expanding from the pressed key (reaches the halo too)
    HC_RX_ECHO,   // halo LEDs nearest (by angle) to the pressed key light up
    HC_RX_COUNT
} hc_reactive_t;

// zone.flags
#define HC_ZF_REVERSE 0x01    // run the effect the other way along its axis
#define HC_ZF_SRC_SCROLL 0x02 // also scroll the colour source (any effect)
#define HC_ZF_MIRROR 0x04     // mirror the axis around its middle (ping-pong shapes)

// scene.flags
#define HC_SF_GAMMA 0x01          // perceptual gamma 2.2 on output
#define HC_SF_HALO_FOLLOWS_KEYS 0x02 // halo uses the key brightness (Fn+Up/Down) instead of Fn+M+Up/Down

// scene.zone_of[i] flags
#define HC_LF_ZONE_MASK 0x07
#define HC_LF_NO_REACT 0x80 // this LED ignores reactive overlays

// ---------------------------------------------------------------- structs -
typedef struct HC_PACKED {
    uint8_t effect;    // hc_effect_t
    uint8_t speed;     // 0..255 (cycle ~16 s at 0, ~1 s at 255)
    uint8_t v_min;     // brightness floor 0..255
    uint8_t v_max;     // brightness ceiling 0..255
    uint8_t axis;      // hc_axis_t used by the effect
    uint8_t spread;    // effect phase spread across the axis, 16 = one full cycle
    uint8_t p1;        // effect specific (see docs)
    uint8_t p2;        // effect specific (see docs)
    uint8_t flags;     // HC_ZF_*
    uint8_t source;    // hc_source_t
    uint8_t src_axis;  // hc_axis_t used to map the colour source
    uint8_t src_scale; // 16 = gradient/rainbow spans the axis once
    uint8_t gradient;  // gradient slot 0..HC_GRADIENTS-1
    uint8_t reactive;  // low nibble hc_reactive_t, high nibble reactive speed 0..15
    uint8_t color[3];  // zone colour (HC_SRC_ZONE) and accent colour (sparkle etc.)
    uint8_t rx_color[3]; // reactive colour (black = white)
} hc_zone_t; // 20 bytes

typedef struct HC_PACKED {
    uint8_t pos; // 0..255, stops must be sorted ascending
    uint8_t r, g, b;
} hc_stop_t;

typedef struct HC_PACKED {
    uint8_t   count; // 1..HC_GRAD_STOPS
    uint8_t   flags; // bit0 = wrap (last stop blends back into first)
    hc_stop_t stop[HC_GRAD_STOPS];
} hc_gradient_t; // 26 bytes

typedef struct HC_PACKED {
    uint8_t       magic;
    uint8_t       version;
    uint8_t       flags;    // HC_SF_*
    uint8_t       reserved;
    uint8_t       color[HC_LED_COUNT][3]; // per-LED painted colour
    uint8_t       zone_of[HC_LED_COUNT];  // zone index + HC_LF_* flags
    hc_zone_t     zones[HC_ZONES];
    hc_gradient_t grad[HC_GRADIENTS];
    uint8_t       halo_xy[HC_HALO_LEDS][2]; // calibrated halo positions
    uint8_t       halo_ring[HC_HALO_LEDS];  // perimeter coordinate 0..255 per halo LED
} hc_scene_t;

typedef struct HC_PACKED {
    uint8_t  led;
    uint8_t  x, y;
    uint32_t t; // ms timestamp of the press
} hc_hit_t;

typedef struct {
    hc_hit_t hits[HC_MAX_HITS];
    uint8_t  hit_head;
    uint8_t  heat[HC_LED_COUNT];
    uint32_t heat_t;
} hc_state_t;

// Board description supplied by the board/keymap (flash constants).
extern const uint8_t hc_key_xy[HC_KEY_LEDS][2];
extern const uint8_t hc_default_halo_xy[HC_HALO_LEDS][2];
extern const uint8_t hc_default_halo_ring[HC_HALO_LEDS];

// ------------------------------------------------------------------ API ---
void hc_scene_defaults(hc_scene_t *s);
bool hc_scene_valid(const hc_scene_t *s);
void hc_state_init(hc_state_t *st);

void hc_led_xy(const hc_scene_t *s, uint8_t led, uint8_t *x, uint8_t *y);
void hc_key_hit(hc_state_t *st, const hc_scene_t *s, uint8_t led, uint32_t t);
void hc_frame_begin(hc_state_t *st, const hc_scene_t *s, uint32_t t);
// Renders one LED (before master brightness / gamma). out = r,g,b
void hc_render_led(const hc_scene_t *s, const hc_state_t *st, uint8_t led, uint32_t t, uint8_t out[3]);
// Applies master brightness and optional gamma
void hc_finish(const hc_scene_t *s, uint8_t master, uint8_t c[3]);

// helpers exposed for tests / protocol
uint8_t  hc_scale8(uint8_t i, uint8_t s);
uint8_t  hc_sin8(uint8_t theta);
uint8_t  hc_lerp8(uint8_t a, uint8_t b, uint8_t f);
uint32_t hc_hash32(uint32_t x);
uint16_t hc_phase16(uint32_t t, uint8_t speed);
uint8_t  hc_atan2_8(int16_t dy, int16_t dx);
uint16_t hc_isqrt32(uint32_t n);
void     hc_rgb2hsv(const uint8_t rgb[3], uint8_t hsv[3]);
void     hc_hsv2rgb(const uint8_t hsv[3], uint8_t rgb[3]);
void     hc_grad_sample(const hc_gradient_t *g, uint8_t pos, uint8_t out[3]);
uint8_t  hc_axis_value(const hc_scene_t *s, uint8_t led, uint8_t axis);

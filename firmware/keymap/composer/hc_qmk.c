// Halo Composer - QMK glue for NuPhy Halo75 V2 (ryodeushii common code base)
// SPDX-License-Identifier: GPL-2.0-or-later

#include <string.h>
#include "quantum.h"
#include "rgb_matrix.h"
#include "raw_hid.h"
#include "via.h"
#include "common/config.h"
#include "hc_engine.h"
#include "hc_protocol.h"
#include "hc_qmk.h"

#define HC_EEPROM_OFFSET NUPHY_VIA_EEPROM_CUSTOM_CONFIG_SIZE

_Static_assert(sizeof(hc_scene_t) == 915, "hc_scene_t layout changed - bump HC_SCENE_VERSION and update the GUI");
_Static_assert(VIA_EEPROM_CUSTOM_CONFIG_SIZE >= HC_EEPROM_OFFSET + sizeof(hc_scene_t), "VIA_EEPROM_CUSTOM_CONFIG_SIZE too small for the composer scene");
_Static_assert(RGB_MATRIX_LED_COUNT == HC_LED_COUNT, "composer expects 128 LEDs (83 keys + 45 halo)");

static hc_scene_t hc_scene;
static hc_state_t hc_state;
static bool       hc_inited    = false;
static uint8_t    hc_prev_mode = RGB_MATRIX_SOLID_COLOR;
static uint32_t   hc_frames    = 0;

static struct {
    uint8_t  led;
    uint8_t  rgb[3];
    uint32_t until;
} hc_ident = {.led = 0xFF};

// Fn+M+Up/Down still controls the halo: NuPhy's 0..5 level becomes a linear master.
static const uint8_t hc_halo_levels[6] = {0, 48, 96, 144, 200, 255};

static uint8_t halo_master(void) {
    if (hc_scene.flags & HC_SF_HALO_FOLLOWS_KEYS) return rgb_matrix_get_val();
    uint8_t lvl = keyboard_config.lights.side_brightness;
    return hc_halo_levels[lvl > 5 ? 5 : lvl];
}

static void hc_load(bool at_boot) {
    via_read_custom_config(&hc_scene, HC_EEPROM_OFFSET, sizeof(hc_scene));
    if (!hc_scene_valid(&hc_scene)) {
        if (at_boot) {
            // No valid scene means this EEPROM was last written by other firmware
            // (stock, ryodeushii's 'via', or an older scene layout). The scene
            // enlarges VIA's custom-config block, which moves VIA's keymap and
            // macro storage, so VIA may be about to read stale bytes as keycodes
            // (its EEPROM check only compares build dates). Reset them to the
            // keymap.c defaults. After an Esc-held flash this is a harmless repeat.
            eeconfig_init_via();
        }
        hc_scene_defaults(&hc_scene);
        via_update_custom_config(&hc_scene, HC_EEPROM_OFFSET, sizeof(hc_scene));
    }
}

void hc_init(void) {
    if (hc_inited) return;
    hc_state_init(&hc_state);
    hc_load(true);
    hc_inited = true;
}

static bool hc_identify_active(void) {
    return hc_ident.led != 0xFF && (int32_t)(hc_ident.until - g_rgb_timer) > 0;
}

bool hc_is_active(void) {
    return rgb_matrix_is_enabled() && rgb_matrix_get_mode() == RGB_MATRIX_CUSTOM_composer;
}

// Keeps the LED drivers powered when keys are at brightness 0 but the halo is lit
// (NuPhy's led_power_handle() otherwise cuts both IS31FL3733 drivers).
bool nuphy_leds_need_power(void) {
    return hc_is_active() && halo_master() > 0;
}

bool hc_rgb_effect(effect_params_t *params) {
    RGB_MATRIX_USE_LIMITS(led_min, led_max);
    if (!hc_inited) hc_init();

    const uint32_t t = g_rgb_timer;
    if (params->iter == 0) {
        hc_frame_begin(&hc_state, &hc_scene, t);
        hc_frames++;
    }
    const uint8_t mk         = rgb_matrix_get_val();
    const uint8_t mh         = halo_master();
    const bool    ident      = hc_identify_active();
    const bool    power_show = side_power_show_active();

    for (uint8_t i = led_min; i < led_max && i < HC_LED_COUNT; i++) {
        if (i >= HC_KEY_LEDS && power_show) continue; // NuPhy boot sweep owns the halo
        uint8_t c[3] = {0, 0, 0};
        if (ident) {
            if (i == hc_ident.led) memcpy(c, hc_ident.rgb, 3);
        } else {
            hc_render_led(&hc_scene, &hc_state, i, t, c);
            hc_finish(&hc_scene, i < HC_KEY_LEDS ? mk : mh, c);
        }
        rgb_matrix_set_color(i, c[0], c[1], c[2]);
    }
    return rgb_matrix_check_finished_leds(led_max);
}

void hc_process_key(uint8_t row, uint8_t col, bool pressed) {
    if (!pressed || !hc_inited || !hc_is_active()) return;
    if (row >= MATRIX_ROWS || col >= MATRIX_COLS) return;
    uint8_t led = g_led_config.matrix_co[row][col];
    if (led == NO_LED) return;
    hc_key_hit(&hc_state, &hc_scene, led, g_rgb_timer);
}

void hc_indicators(void) {
    // While the calibration wizard lights single LEDs, keep the status-bar
    // indicators (caps lock, OS, wireless) from lighting halo LEDs too.
    if (hc_is_active() && !hc_identify_active()) side_composer_overlay();
}

// ---------------------------------------------------------------- raw HID -
static void set_active(bool on) {
    uint8_t mode = rgb_matrix_get_mode();
    if (on) {
        if (mode != RGB_MATRIX_CUSTOM_composer) hc_prev_mode = mode;
        if (!rgb_matrix_is_enabled()) rgb_matrix_enable();
        rgb_matrix_mode(RGB_MATRIX_CUSTOM_composer);
    } else if (mode == RGB_MATRIX_CUSTOM_composer) {
        rgb_matrix_mode(hc_prev_mode == RGB_MATRIX_CUSTOM_composer ? RGB_MATRIX_SOLID_COLOR : hc_prev_mode);
    }
}

// Fn+Enter (keymap.c): jump to Composer, or back to the effect used before it.
void hc_toggle(void) {
    set_active(!hc_is_active());
}

static void hc_handle_hid(uint8_t *data) {
    uint8_t a[29];
    memcpy(a, &data[2], sizeof(a)); // arguments, before we overwrite data[2] with the status
    uint8_t *status = &data[2];
    uint8_t *out    = &data[3];
    memset(&data[2], 0, 30);
    *status = HC_OK;

    switch (data[1]) {
        case HC_GET_INFO:
            out[0]  = HC_PROTOCOL_VERSION;
            out[1]  = HC_LED_COUNT;
            out[2]  = HC_KEY_LEDS;
            out[3]  = HC_HALO_LEDS;
            out[4]  = HC_ZONES;
            out[5]  = HC_GRADIENTS;
            out[6]  = HC_GRAD_STOPS;
            out[7]  = HC_FX_COUNT;
            out[8]  = hc_is_active();
            out[9]  = (uint8_t)(sizeof(hc_scene_t) & 0xFF);
            out[10] = (uint8_t)(sizeof(hc_scene_t) >> 8);
            out[11] = hc_scene.flags;
            out[12] = HC_MAGIC;
            out[13] = rgb_matrix_get_mode();
            out[14] = hc_prev_mode;
            break;

        case HC_SET_ACTIVE:
            set_active(a[0] != 0);
            break;

        case HC_SET_COLORS: {
            uint8_t start = a[0], n = a[1];
            if (n > 9 || start >= HC_LED_COUNT || start + n > HC_LED_COUNT) { *status = HC_E_ARG; break; }
            memcpy(hc_scene.color[start], &a[2], (size_t)n * 3);
            break;
        }
        case HC_GET_COLORS: {
            uint8_t start = a[0], n = a[1];
            if (n > 9 || start >= HC_LED_COUNT || start + n > HC_LED_COUNT) { *status = HC_E_ARG; break; }
            memcpy(out, hc_scene.color[start], (size_t)n * 3);
            break;
        }
        case HC_SET_ZONE_MAP: {
            uint8_t start = a[0], n = a[1];
            if (n > 27 || start >= HC_LED_COUNT || start + n > HC_LED_COUNT) { *status = HC_E_ARG; break; }
            for (uint8_t i = 0; i < n; i++) hc_scene.zone_of[start + i] = a[2 + i] & (HC_LF_ZONE_MASK | HC_LF_NO_REACT);
            break;
        }
        case HC_GET_ZONE_MAP: {
            uint8_t start = a[0], n = a[1];
            if (n > 28 || start >= HC_LED_COUNT || start + n > HC_LED_COUNT) { *status = HC_E_ARG; break; }
            memcpy(out, &hc_scene.zone_of[start], n);
            break;
        }
        case HC_SET_ZONE: {
            hc_zone_t z;
            if (a[0] >= HC_ZONES) { *status = HC_E_ARG; break; }
            memcpy(&z, &a[1], sizeof(z));
            // z.flags is stored as sent, unknown bits included (HC_ZF_*; see hc_scene_valid)
            if (z.effect >= HC_FX_COUNT || z.source >= HC_SRC_COUNT || z.axis >= HC_AXIS_COUNT || z.src_axis >= HC_AXIS_COUNT || z.gradient >= HC_GRADIENTS) {
                *status = HC_E_ARG;
                break;
            }
            hc_scene.zones[a[0]] = z;
            break;
        }
        case HC_GET_ZONE:
            if (a[0] >= HC_ZONES) { *status = HC_E_ARG; break; }
            memcpy(out, &hc_scene.zones[a[0]], sizeof(hc_zone_t));
            break;

        case HC_SET_GRADIENT: {
            hc_gradient_t g;
            if (a[0] >= HC_GRADIENTS) { *status = HC_E_ARG; break; }
            memcpy(&g, &a[1], sizeof(g));
            // g.flags is stored as sent, unknown bits included (HC_GF_*)
            if (g.count > HC_GRAD_STOPS) { *status = HC_E_ARG; break; }
            hc_scene.grad[a[0]] = g;
            break;
        }
        case HC_GET_GRADIENT:
            if (a[0] >= HC_GRADIENTS) { *status = HC_E_ARG; break; }
            memcpy(out, &hc_scene.grad[a[0]], sizeof(hc_gradient_t));
            break;

        case HC_SET_HALO_GEOM: {
            uint8_t start = a[0], n = a[1];
            if (n > 9 || start >= HC_HALO_LEDS || start + n > HC_HALO_LEDS) { *status = HC_E_ARG; break; }
            for (uint8_t i = 0; i < n; i++) {
                hc_scene.halo_xy[start + i][0] = a[2 + i * 3];
                hc_scene.halo_xy[start + i][1] = a[3 + i * 3];
                hc_scene.halo_ring[start + i]  = a[4 + i * 3];
            }
            break;
        }
        case HC_GET_HALO_GEOM: {
            uint8_t start = a[0], n = a[1];
            if (n > 9 || start >= HC_HALO_LEDS || start + n > HC_HALO_LEDS) { *status = HC_E_ARG; break; }
            for (uint8_t i = 0; i < n; i++) {
                out[i * 3]     = hc_scene.halo_xy[start + i][0];
                out[i * 3 + 1] = hc_scene.halo_xy[start + i][1];
                out[i * 3 + 2] = hc_scene.halo_ring[start + i];
            }
            break;
        }
        case HC_SET_SCENE_FLAGS:
            hc_scene.flags = a[0];
            break;
        case HC_GET_SCENE_FLAGS:
            out[0] = hc_scene.flags;
            break;

        case HC_SAVE:
            via_update_custom_config(&hc_scene, HC_EEPROM_OFFSET, sizeof(hc_scene));
            break;
        case HC_RELOAD:
            hc_load(false);
            break;
        case HC_DEFAULTS:
            hc_scene_defaults(&hc_scene);
            break;

        case HC_IDENTIFY:
            hc_ident.led    = a[0] < HC_LED_COUNT ? a[0] : 0xFF;
            hc_ident.rgb[0] = a[1];
            hc_ident.rgb[1] = a[2];
            hc_ident.rgb[2] = a[3];
            hc_ident.until  = g_rgb_timer + (uint32_t)(a[4] | (a[5] << 8));
            break;

        case HC_SIM_KEY:
            if (a[0] >= HC_LED_COUNT) { *status = HC_E_ARG; break; }
            hc_key_hit(&hc_state, &hc_scene, a[0], g_rgb_timer);
            break;

        case HC_GET_STATS:
            out[0] = (uint8_t)(hc_frames);
            out[1] = (uint8_t)(hc_frames >> 8);
            out[2] = (uint8_t)(hc_frames >> 16);
            out[3] = (uint8_t)(hc_frames >> 24);
            out[4] = rgb_matrix_get_val();
            out[5] = halo_master();
            out[6] = keyboard_config.lights.side_brightness;
            out[7] = side_power_show_active();
            break;

        default:
            *status = HC_E_UNKNOWN;
            break;
    }
}

// VIA calls this first for every raw HID report; anything that is not ours
// falls through to VIA's normal handling.
bool via_command_kb(uint8_t *data, uint8_t length) {
    if (length < 32 || data[0] != HC_HID_CMD) return false;
    if (!hc_inited) hc_init();
    hc_handle_hid(data);
    raw_hid_send(data, length);
    return true;
}

#ifdef HC_HOST_TEST
// Hooks for the PC build in tests/ (host_device.c); not compiled into the firmware.
hc_scene_t *hc_debug_scene(void) {
    return &hc_scene;
}

void hc_debug_reboot(void) {
    hc_inited = false;
    hc_init();
}
#endif

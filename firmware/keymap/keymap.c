// Halo Composer keymap for NuPhy Halo75 V2 (ANSI)
// SPDX-License-Identifier: GPL-2.0-or-later
//
// Same layers as the default keymap plus Fn+Enter (Composer on/off); adds a
// 128-LED g_led_config (keys + halo) and hooks the Composer engine into QMK.

#include "ansi.h"
#include "keycodes.h"
#include QMK_KEYBOARD_H
#include "composer/hc_qmk.h"

// Fn+Enter: jump to the Composer effect, or back to the previous effect.
// It must be the entry right after ryodeushii's last custom keycode, because VIA
// numbers custom keys by position; tools/make_via_json.py checks this.
enum { HC_TOGGLE = TOG_POWER_ON_ANIMATION + 1 };

// Layers copied from keymaps/default/keymap.c (ryodeushii, pinned commit in
// firmware/base.env). Only change: HC_TOGGLE on Fn+Enter in both Fn layers.
// clang-format off
const uint16_t PROGMEM keymaps[][MATRIX_ROWS][MATRIX_COLS] = {
// layer Mac
[0] = LAYOUT_ansi_84(
	KC_ESC, 	KC_BRMD,  	KC_BRMU,  	MAC_TASK, 	MAC_SEARCH, MAC_VOICE,  MAC_DND,   	KC_MPRV,  	KC_MPLY,  	KC_MNXT, 	KC_MUTE, 	KC_VOLD, 	KC_VOLU, 	MAC_PRTA, 	KC_INS,    KC_DEL,
	KC_GRV, 	KC_1,   	KC_2,   	KC_3,  		KC_4,   	KC_5,   	KC_6,   	KC_7,   	KC_8,   	KC_9,  		KC_0,   	KC_MINS,	KC_EQL, 	KC_BSPC,	            KC_HOME,
	KC_TAB, 	KC_Q,   	KC_W,   	KC_E,  		KC_R,   	KC_T,   	KC_Y,   	KC_U,   	KC_I,   	KC_O,  		KC_P,   	KC_LBRC,	KC_RBRC,	KC_BSLS,	            KC_END,
	KC_CAPS,	KC_A,   	KC_S,   	KC_D,  		KC_F,   	KC_G,   	KC_H,   	KC_J,   	KC_K,   	KC_L,  		KC_SCLN,	KC_QUOT, 	KC_ENT,                            KC_PGUP,
	KC_LSFT,				KC_Z,   	KC_X,   	KC_C,  		KC_V,   	KC_B,   	KC_N,   	KC_M,   	KC_COMM,	KC_DOT,		KC_SLSH,	KC_RSFT,	            KC_UP,     KC_PGDN,
	KC_LCTL,	KC_LOPT,	KC_LCMD,								KC_SPC, 								            KC_RCMD,	MO(1),   				KC_LEFT,	KC_DOWN,   KC_RIGHT),
// layer Mac Fn
[1] = LAYOUT_ansi_84(
	_______, 	KC_F1,  	KC_F2,  	KC_F3, 		KC_F4,  	KC_F5,  	KC_F6,  	KC_F7,  	KC_F8,  	KC_F9, 		KC_F10, 	KC_F11, 	KC_F12, 	MAC_PRT,	TOG_POWER_ON_ANIMATION,	_______,
	_______, 	LNK_BLE1,  	LNK_BLE2,  	LNK_BLE3,  	LNK_RF,   	_______,   	_______,   	_______,   	_______,   	_______,  	_______,   	_______,	_______, 	_______,	            _______,
	_______, 	_______,   	_______,   	_______,   	_______,   	_______,   	DEBOUNCE_PRESS_DEC,   	DEBOUNCE_PRESS_SHOW,   	DEBOUNCE_PRESS_INC,   	TOG_DEEP_SLEEP,  	TOG_USB_SLP,   	DEV_RESET,	SLEEP_MODE, BAT_SHOW,	            _______,
	TOG_CAPS_IND,	SLEEP_TIMEOUT_DEC,   	SLEEP_TIMEOUT_SHOW,   	SLEEP_TIMEOUT_INC,  	_______,   	_______,   	DEBOUNCE_RELEASE_DEC,	DEBOUNCE_RELEASE_SHOW,   	DEBOUNCE_RELEASE_INC,   	_______,  	_______,	_______, 	HC_TOGGLE,                            _______,
	_______,				_______,   	_______,   	RGB_TEST,  	_______,   _______ ,   	_______,	MO(4), 		RM_SPDD,	RM_SPDU,	_______,	_______,	            RM_VALU,   _______,
	_______,	_______,	_______,								_______, 								            _______,	MO(1),			            RM_NEXT,   RM_VALD,	RM_HUEU),
// layer win
[2] = LAYOUT_ansi_84(
	KC_ESC, 	KC_F1,  	KC_F2,  	KC_F3, 		KC_F4,  	KC_F5,  	KC_F6,  	KC_F7,  	KC_F8,  	KC_F9, 		KC_F10, 	KC_F11, 	KC_F12, 	WIN_PRTA,  KC_INS,    KC_DEL,
	KC_GRV, 	KC_1,   	KC_2,   	KC_3,  		KC_4,   	KC_5,   	KC_6,   	KC_7,   	KC_8,   	KC_9,  		KC_0,   	KC_MINS,	KC_EQL, 	KC_BSPC,               KC_HOME,
	KC_TAB, 	KC_Q,   	KC_W,   	KC_E,  		KC_R,   	KC_T,   	KC_Y,   	KC_U,   	KC_I,   	KC_O,  		KC_P,   	KC_LBRC,	KC_RBRC,	KC_BSLS,               KC_END,
	KC_CAPS,	KC_A,   	KC_S,   	KC_D,  		KC_F,   	KC_G,   	KC_H,   	KC_J,   	KC_K,   	KC_L,  		KC_SCLN,	KC_QUOT, 	KC_ENT, 	                        KC_PGUP,
	KC_LSFT,				KC_Z,   	KC_X,   	KC_C,  		KC_V,   	KC_B,   	KC_N,   	KC_M,   	KC_COMM,	KC_DOT,		KC_SLSH,	KC_RSFT,               KC_UP,	    KC_PGDN,
	KC_LCTL,	KC_LWIN,	KC_LALT,								KC_SPC, 								            KC_RALT,	MO(3),	                KC_LEFT,   	KC_DOWN,	KC_RIGHT),
// layer win Fn
[3] = LAYOUT_ansi_84(
	_______, 	KC_BRID,  	KC_BRIU,  	_______, 	    _______,  	_______,  	_______,  	KC_MPRV,  	KC_MPLY,  	KC_MNXT, 	KC_MUTE, 	KC_VOLD, 	KC_VOLU, 	KC_PSCR,	TOG_POWER_ON_ANIMATION,	_______,
	_______, 	LNK_BLE1,  	LNK_BLE2,  	LNK_BLE3,  	LNK_RF,   	_______,   	_______,   	_______,   	_______,   	_______,  	_______,   	_______,	_______, 	_______,	            _______,
	_______, 	_______,   	_______,   	_______,   	_______,   	_______,   	DEBOUNCE_PRESS_DEC,   	DEBOUNCE_PRESS_SHOW,   	DEBOUNCE_PRESS_INC,   	TOG_DEEP_SLEEP,  	TOG_USB_SLP,   	DEV_RESET,	SLEEP_MODE, BAT_SHOW,	            _______,
	TOG_CAPS_IND,	SLEEP_TIMEOUT_DEC,   	SLEEP_TIMEOUT_SHOW,   	SLEEP_TIMEOUT_INC,  	_______,   	_______,   	DEBOUNCE_RELEASE_DEC,	DEBOUNCE_RELEASE_SHOW,   	DEBOUNCE_RELEASE_INC,   	_______,  	_______,	_______, 	HC_TOGGLE,                            _______,
	_______,				_______,   	_______,   	RGB_TEST,  	_______,   _______ ,   	_______,	MO(4), 		RM_SPDD,	RM_SPDU,	_______,	_______,	            RM_VALU,   _______,
	_______,	_______,	_______,								_______, 								            _______,	MO(3),					RM_NEXT,   RM_VALD,	RM_HUEU),
// layer 4
[4] = LAYOUT_ansi_84(
	_______, 	_______,  	_______,  	_______, 	_______,  	_______,  	_______,  	_______,  	_______,  	_______, 	_______, 	_______, 	_______, 	_______,	_______,    _______,
	_______, 	_______,   	_______,   	_______,  	_______,   	_______,   	_______,   	_______,   	_______,   	_______,  	_______,   	_______,	_______, 	_______,	            _______,
	_______, 	_______,  	_______,  	_______,  	_______,   	_______,   	_______,   	_______,   	_______,   	_______,  	_______,   	_______,	_______, 	_______,	            _______,
	_______,	_______,   	_______,   	_______,  	_______,   	_______,   	_______,	_______,   	_______,   	_______,  	_______,	_______, 	_______,                            _______,
	_______,				_______,   	_______,   	_______,  	_______,   	_______,   	_______,	MO(4), 	SIDE_SPD,	SIDE_SPI,	AMBIENT_MOD,	_______,	            SIDE_VAI,   _______,
	_______,	_______,	_______,								_______, 								            _______,	MO(4),   	        	            SIDE_MOD, SIDE_VAD,	SIDE_HUI),
};
// clang-format on

// tools/make_via_json.py appends Composer as entry 43 of VIA's Effect dropdown.
_Static_assert(RGB_MATRIX_CUSTOM_composer == 43, "Composer moved in the RGB matrix mode list; update make_via_json.py");

// clang-format off
led_config_t g_led_config = {
    {
        {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 14, NO_LED},
        {16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, NO_LED, 30, NO_LED},
        {31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, NO_LED, 45, NO_LED},
        {46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, NO_LED, 58, NO_LED, 59, NO_LED},
        {60, NO_LED, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, NO_LED, 71, 72, 73, NO_LED},
        {74, 75, 76, NO_LED, NO_LED, NO_LED, 77, NO_LED, NO_LED, 78, 79, NO_LED, NO_LED, 80, 81, 82, NO_LED},
    },
    {
        // generated by tools/gen_geometry.py (keys 0..82, halo 83..127)
        {22, 16}, {34, 16}, {46, 16}, {58, 16}, {70, 16}, {82, 16}, {94, 16}, {106, 16}, {118, 16}, {130, 16}, {142, 16}, {154, 16}, {166, 16}, {178, 16}, {202, 16}, {190, 16}, {22, 24}, {34, 24}, {46, 24}, {58, 24}, {70, 24}, {82, 24}, {94, 24}, {106, 24}, {118, 24}, {130, 24}, {142, 24}, {154, 24}, {166, 24}, {184, 24}, {202, 24}, {25, 32}, {40, 32}, {52, 32}, {64, 32}, {76, 32}, {88, 32}, {100, 32}, {112, 32}, {124, 32}, {136, 32}, {148, 32}, {160, 32}, {172, 32}, {187, 32}, {202, 32}, {26, 40}, {43, 40}, {55, 40}, {67, 40}, {79, 40}, {91, 40}, {103, 40}, {115, 40}, {127, 40}, {139, 40}, {151, 40}, {163, 40}, {182, 40}, {202, 40}, {30, 48}, {49, 48}, {61, 48}, {73, 48}, {85, 48}, {97, 48}, {109, 48}, {121, 48}, {133, 48}, {145, 48}, {157, 48}, {174, 48}, {190, 48}, {202, 48}, {24, 56}, {38, 56}, {54, 56}, {98, 56}, {144, 56}, {158, 56}, {178, 56}, {190, 56}, {202, 56}, {16, 5}, {19, 5}, {22, 5}, {25, 5}, {28, 5}, {169, 53}, {169, 56}, {169, 59}, {169, 59}, {164, 62}, {164, 62}, {149, 62}, {136, 62}, {126, 62}, {112, 62}, {100, 62}, {87, 62}, {74, 62}, {61, 62}, {49, 62}, {35, 62}, {20, 62}, {7, 57}, {7, 48}, {7, 38}, {7, 27}, {7, 20}, {40, 9}, {57, 9}, {76, 9}, {96, 9}, {115, 9}, {134, 9}, {158, 9}, {178, 9}, {196, 9}, {217, 17}, {217, 26}, {217, 36}, {217, 44}, {217, 56}, {196, 62}, {184, 62}, {174, 62}, {174, 62}
    },
    {
        // keys = KEYLIGHT; halo = NONE so stock QMK effects leave it to NuPhy's halo engine.
        // The Composer effect ignores flags and drives all 128 LEDs.
        [0 ... 82]   = LED_FLAG_KEYLIGHT,
        [83 ... 127] = LED_FLAG_NONE,
    },
};
// clang-format on

void keyboard_post_init_user(void) {
    hc_init();
}

bool process_record_user(uint16_t keycode, keyrecord_t *record) {
    if (keycode == HC_TOGGLE) {
        if (record->event.pressed) hc_toggle();
        return false;
    }
    hc_process_key(record->event.key.row, record->event.key.col, record->event.pressed);
    return true;
}

bool rgb_matrix_indicators_user(void) {
    hc_indicators();
    return true;
}

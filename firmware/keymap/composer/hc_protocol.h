// Halo Composer raw-HID protocol (rides on VIA's raw HID interface, 32-byte reports)
// SPDX-License-Identifier: GPL-2.0-or-later
//
// Request : [0]=HC_HID_CMD [1]=sub-command [2..31]=arguments
// Response: [0]=HC_HID_CMD [1]=sub-command [2]=status  [3..31]=payload
//
// 0xD0 does not collide with VIA (0x01-0x15, 0xFE, 0xFF), SignalRGB (0x21-0x28),
// Keychron (0xA0-0xAB) or OpenRGB-QMK (0x01-0x09 are already VIA's anyway).
// All SET_* commands change RAM only; nothing touches EEPROM until HC_SAVE.

#pragma once

#define HC_HID_CMD 0xD0
#define HC_PROTOCOL_VERSION 1

enum hc_status {
    HC_OK        = 0,
    HC_E_ARG     = 1, // argument out of range
    HC_E_UNKNOWN = 2, // unknown sub-command
};

enum hc_subcmd {
    HC_GET_INFO        = 0x01, // -> ver, led_count, key_leds, halo_leds, zones, gradients, stops, fx_count, active, scene_size(lo,hi), scene_flags, magic, mode, prev_mode
    HC_SET_ACTIVE      = 0x02, // [on]         switch RGB mode to/from "Composer"
    HC_SET_COLORS      = 0x03, // [start, n<=9, r,g,b * n]
    HC_GET_COLORS      = 0x04, // [start, n<=9] -> r,g,b * n
    HC_SET_ZONE_MAP    = 0x05, // [start, n<=27, byte * n]   (zone index | HC_LF_* flags)
    HC_GET_ZONE_MAP    = 0x06, // [start, n<=28] -> byte * n
    HC_SET_ZONE        = 0x07, // [zone, 20 bytes hc_zone_t]
    HC_GET_ZONE        = 0x08, // [zone] -> 20 bytes
    HC_SET_GRADIENT    = 0x09, // [slot, 26 bytes hc_gradient_t]
    HC_GET_GRADIENT    = 0x0A, // [slot] -> 26 bytes
    HC_SET_HALO_GEOM   = 0x0B, // [start, n<=9, x,y,ring * n]  (start/n index halo LEDs 0..44)
    HC_GET_HALO_GEOM   = 0x0C, // [start, n<=9] -> x,y,ring * n
    HC_SET_SCENE_FLAGS = 0x0D, // [flags]
    HC_GET_SCENE_FLAGS = 0x0E, // -> flags
    HC_SAVE            = 0x10, // write RAM scene to EEPROM
    HC_RELOAD          = 0x11, // reload scene from EEPROM (defaults if invalid)
    HC_DEFAULTS        = 0x12, // load factory scene into RAM (not saved)
    HC_IDENTIFY        = 0x13, // [led, r, g, b, ms_lo, ms_hi]  light ONE led, others off (calibration); led=0xFF cancels
    HC_SIM_KEY         = 0x14, // [led]  inject a key hit (preview reactive effects from the GUI)
    HC_GET_STATS       = 0x15, // -> frames(u32 LE), rgb_val, halo_master, side_level, power_show
};

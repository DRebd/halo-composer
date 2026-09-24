// Halo Composer keymap config
// SPDX-License-Identifier: GPL-2.0-or-later
#pragma once

#define HALO_COMPOSER_ENABLE

// Scene (915 bytes) lives right after NuPhy's 23-byte keyboard_config in VIA's
// custom-config EEPROM block. This shrinks the VIA macro buffer (~2.4 KB -> ~1.5 KB).
#undef VIA_EEPROM_CUSTOM_CONFIG_SIZE
#define VIA_EEPROM_CUSTOM_CONFIG_SIZE (NUPHY_VIA_EEPROM_CUSTOM_CONFIG_SIZE + 915)

// Composer uses QMK's standard 224x64 coordinate space (keyboard.json uses 0..151)
#undef RGB_MATRIX_CENTER
#define RGB_MATRIX_CENTER {112, 32}

// Remember more simultaneous keypresses for ripples/glows
#undef LED_HITS_TO_REMEMBER
#define LED_HITS_TO_REMEMBER 8

// Start in Composer after a flash (EEPROM wiped) so the default look shows immediately.
// Stock effects remain one Fn+Left / Fn+Shift+Left away.
#undef RGB_MATRIX_DEFAULT_MODE
#define RGB_MATRIX_DEFAULT_MODE RGB_MATRIX_CUSTOM_composer

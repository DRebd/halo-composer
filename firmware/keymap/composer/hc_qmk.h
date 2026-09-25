// Halo Composer - QMK glue API
// SPDX-License-Identifier: GPL-2.0-or-later
#pragma once

#include <stdbool.h>
#include <stdint.h>
#include "rgb_matrix.h"

void hc_init(void);
bool hc_is_active(void);
bool hc_rgb_effect(effect_params_t *params);
void hc_process_key(uint8_t row, uint8_t col, bool pressed);
void hc_indicators(void);
void hc_toggle(void);

// provided by side.c (patched) when HALO_COMPOSER_ENABLE is defined
bool side_power_show_active(void);
void side_composer_overlay(void);

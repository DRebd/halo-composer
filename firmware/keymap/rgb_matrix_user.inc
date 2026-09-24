// Halo Composer: NuPhy's two custom effects + the Composer effect
RGB_MATRIX_EFFECT(game_mode)
RGB_MATRIX_EFFECT(position_mode)
RGB_MATRIX_EFFECT(composer)

#ifdef RGB_MATRIX_CUSTOM_EFFECT_IMPLS

extern rgb_config_t rgb_matrix_config;
bool                hc_rgb_effect(effect_params_t *params);

static bool game_mode(effect_params_t *params) {
    RGB_MATRIX_USE_LIMITS(led_min, led_max);
    for (uint8_t i = led_min; i < led_max; i++) {
        if (i < 83) rgb_matrix_set_color(i, 0x00, 0x00, 0x00);
    }
    rgb_t rgb = hsv_to_rgb(rgb_matrix_config.hsv);
    static const uint8_t lit[] = {0, 33, 47, 48, 49, 72, 80, 81, 82}; // Esc, W A S D, arrows
    for (uint8_t k = 0; k < sizeof(lit); k++) rgb_matrix_set_color(lit[k], rgb.r, rgb.g, rgb.b);
    return rgb_matrix_check_finished_leds(led_max);
}

static bool position_mode(effect_params_t *params) {
    RGB_MATRIX_USE_LIMITS(led_min, led_max);
    for (uint8_t i = led_min; i < led_max; i++) {
        if (i < 83) rgb_matrix_set_color(i, 0x00, 0x00, 0x00);
    }
    rgb_t rgb = hsv_to_rgb(rgb_matrix_config.hsv);
    rgb_matrix_set_color(50, rgb.r, rgb.g, rgb.b); // F
    rgb_matrix_set_color(53, rgb.r, rgb.g, rgb.b); // J
    rgb_matrix_set_color(72, rgb.r, rgb.g, rgb.b); // Up
    return rgb_matrix_check_finished_leds(led_max);
}

static bool composer(effect_params_t *params) {
    return hc_rgb_effect(params);
}

#endif // RGB_MATRIX_CUSTOM_EFFECT_IMPLS

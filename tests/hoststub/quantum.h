// Host stubs so hc_qmk.c (the real protocol/effect glue) compiles on a PC for tests.
#pragma once
#include <stdint.h>
#include <stdbool.h>
#include <string.h>
#define MATRIX_ROWS 6
#define MATRIX_COLS 17
#define NO_LED 255
#define RGB_MATRIX_LED_COUNT 128
#define NUPHY_VIA_EEPROM_CUSTOM_CONFIG_SIZE 23
#define VIA_EEPROM_CUSTOM_CONFIG_SIZE (NUPHY_VIA_EEPROM_CUSTOM_CONFIG_SIZE + 915)
enum { RGB_MATRIX_NONE = 0, RGB_MATRIX_SOLID_COLOR = 1, RGB_MATRIX_CUSTOM_composer = 43 };
typedef struct { uint8_t iter; uint8_t flags; bool init; } effect_params_t;
typedef struct { uint8_t matrix_co[MATRIX_ROWS][MATRIX_COLS]; } led_config_t;
extern led_config_t g_led_config;
extern uint32_t g_rgb_timer;
uint8_t rgb_matrix_get_val(void);
uint8_t rgb_matrix_is_enabled(void);
uint8_t rgb_matrix_get_mode(void);
void rgb_matrix_enable(void);
void rgb_matrix_mode(uint8_t m);
void rgb_matrix_set_color(int i, uint8_t r, uint8_t g, uint8_t b);
static inline bool rgb_matrix_check_finished_leds(uint8_t led_max) { return led_max < RGB_MATRIX_LED_COUNT; }
#define RGB_MATRIX_USE_LIMITS(min, max) uint8_t min = 0, max = RGB_MATRIX_LED_COUNT; (void)params
uint32_t via_read_custom_config(void *buf, uint32_t offset, uint32_t length);
uint32_t via_update_custom_config(const void *buf, uint32_t offset, uint32_t length);
void raw_hid_send(uint8_t *data, uint8_t length);

// A fake Halo75 V2 for end-to-end GUI tests: the REAL hc_qmk.c + hc_engine.c
// behind a line protocol on stdin/stdout.
//   "<64 hex chars>"  -> one 32-byte raw HID report; prints the 32-byte reply as hex
//   "SCENE"           -> prints the RAM scene (915 bytes) as hex
//   "EEPROM"          -> prints the EEPROM copy of the scene as hex
//   "FRAME <t>"       -> renders one frame at time t, prints 384 bytes as hex
//   "KEY <row> <col>" -> key press through hc_process_key
//   "VIARESETS"       -> how many times the firmware reset VIA's keymap storage
//   "REBOOT"          -> re-run the boot-time init (EEPROM kept)
//   "EECORRUPT"       -> clobber the saved scene's magic byte (simulates other firmware's EEPROM)
#include <stdio.h>
#include <stdlib.h>
#include "quantum.h"
#include "common/config.h"
#include "hc_engine.h"
#include "hc_qmk.h"

led_config_t g_led_config = {{
    {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 14, NO_LED},
    {16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, NO_LED, 30, NO_LED},
    {31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, NO_LED, 45, NO_LED},
    {46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, NO_LED, 58, NO_LED, 59, NO_LED},
    {60, NO_LED, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, NO_LED, 71, 72, 73, NO_LED},
    {74, 75, 76, NO_LED, NO_LED, NO_LED, 77, NO_LED, NO_LED, 78, 79, NO_LED, NO_LED, 80, 81, 82, NO_LED},
}};
uint32_t g_rgb_timer = 1000;
keyboard_config_stub_t keyboard_config = {{5}};
static uint8_t mode = RGB_MATRIX_SOLID_COLOR, val = 255;
static uint8_t eeprom[VIA_EEPROM_CUSTOM_CONFIG_SIZE];
static uint8_t fb[RGB_MATRIX_LED_COUNT * 3];
uint8_t rgb_matrix_get_val(void) { return val; }
uint8_t rgb_matrix_is_enabled(void) { return 1; }
uint8_t rgb_matrix_get_mode(void) { return mode; }
void rgb_matrix_enable(void) {}
void rgb_matrix_mode(uint8_t m) { mode = m; }
void rgb_matrix_set_color(int i, uint8_t r, uint8_t g, uint8_t b) { fb[i * 3] = r; fb[i * 3 + 1] = g; fb[i * 3 + 2] = b; }
uint32_t via_read_custom_config(void *buf, uint32_t off, uint32_t len) { memcpy(buf, eeprom + off, len); return len; }
uint32_t via_update_custom_config(const void *buf, uint32_t off, uint32_t len) { memcpy(eeprom + off, buf, len); return len; }
bool side_power_show_active(void) { return false; }
void side_composer_overlay(void) {}
bool via_command_kb(uint8_t *data, uint8_t length);
static void hex(const uint8_t *b, size_t n) { for (size_t i = 0; i < n; i++) printf("%02x", b[i]); printf("\n"); fflush(stdout); }
void raw_hid_send(uint8_t *data, uint8_t length) { hex(data, length); }
static unsigned via_resets = 0;
void eeconfig_init_via(void) { via_resets++; }
extern void hc_debug_reboot(void);
extern hc_scene_t *hc_debug_scene(void);

int main(void) {
    memset(eeprom, 0xFF, sizeof(eeprom)); // blank EEPROM -> firmware writes defaults
    hc_init();
    char line[256];
    while (fgets(line, sizeof line, stdin)) {
        if (!strncmp(line, "SCENE", 5)) { hex((const uint8_t *)hc_debug_scene(), sizeof(hc_scene_t)); continue; }
        if (!strncmp(line, "EEPROM", 6)) { hex(eeprom + NUPHY_VIA_EEPROM_CUSTOM_CONFIG_SIZE, sizeof(hc_scene_t)); continue; }
        if (!strncmp(line, "FRAME", 5)) { g_rgb_timer = (uint32_t)strtoul(line + 6, NULL, 10); effect_params_t p = {0, 0xFF, false}; hc_rgb_effect(&p); hex(fb, sizeof fb); continue; }
        if (!strncmp(line, "VIARESETS", 9)) { printf("%u\n", via_resets); fflush(stdout); continue; }
        if (!strncmp(line, "EECORRUPT", 9)) { eeprom[NUPHY_VIA_EEPROM_CUSTOM_CONFIG_SIZE] = 0x00; printf("ok\n"); fflush(stdout); continue; }
        if (!strncmp(line, "REBOOT", 6)) { hc_debug_reboot(); printf("ok\n"); fflush(stdout); continue; }
        if (!strncmp(line, "KEY", 3)) { unsigned r, c; sscanf(line + 4, "%u %u", &r, &c); hc_process_key((uint8_t)r, (uint8_t)c, true); printf("ok\n"); fflush(stdout); continue; }
        uint8_t pkt[32] = {0};
        for (int i = 0; i < 32; i++) { unsigned v; if (sscanf(line + i * 2, "%2x", &v) != 1) break; pkt[i] = (uint8_t)v; }
        if (!via_command_kb(pkt, 32)) { pkt[0] = 0xFF; hex(pkt, 32); } // what VIA would say: unhandled
    }
    return 0;
}

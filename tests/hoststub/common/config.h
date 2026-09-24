#pragma once
#include <stdint.h>
typedef struct { uint8_t side_brightness; } lights_stub_t;
typedef struct { lights_stub_t lights; } keyboard_config_stub_t;
extern keyboard_config_stub_t keyboard_config;

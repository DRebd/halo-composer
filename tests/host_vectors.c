// Host-side test vector generator for Halo Composer.
// Build: see tests/run_tests.sh (cc -I firmware/keymap/composer host_vectors.c hc_engine.c hc_board_geometry.c)
// Emits JSON consumed by parity_test.mjs, which replays the same inputs through
// the JavaScript engine and requires byte-identical output.
#include <stdio.h>
#include <string.h>
#include <assert.h>
#include "hc_engine.h"

static uint32_t rng_state = 12345;
static uint32_t rnd(void) {
    rng_state = hc_hash32(rng_state + 0x9E3779B9u);
    return rng_state;
}

static void hex(const uint8_t *b, size_t n) {
    for (size_t i = 0; i < n; i++) printf("%02x", b[i]);
}

static void fuzz_scene(hc_scene_t *s) {
    hc_scene_defaults(s);
    s->flags = (uint8_t)(rnd() & 3);
    for (int i = 0; i < HC_LED_COUNT; i++) {
        for (int k = 0; k < 3; k++) s->color[i][k] = (uint8_t)rnd();
        s->zone_of[i] = (uint8_t)((rnd() % 8) | ((rnd() % 10) == 0 ? HC_LF_NO_REACT : 0));
    }
    for (int z = 0; z < HC_ZONES; z++) {
        hc_zone_t *zz = &s->zones[z];
        zz->effect    = (uint8_t)(rnd() % HC_FX_COUNT);
        zz->speed     = (uint8_t)rnd();
        zz->v_min     = (uint8_t)rnd();
        zz->v_max     = (uint8_t)rnd();
        zz->axis      = (uint8_t)(rnd() % HC_AXIS_COUNT);
        zz->spread    = (uint8_t)(rnd() % 64);
        zz->p1        = (uint8_t)rnd();
        zz->p2        = (uint8_t)rnd();
        zz->flags     = (uint8_t)(rnd() & 7);
        zz->source    = (uint8_t)(rnd() % HC_SRC_COUNT);
        zz->src_axis  = (uint8_t)(rnd() % HC_AXIS_COUNT);
        zz->src_scale = (uint8_t)(rnd() % 64);
        zz->gradient  = (uint8_t)(rnd() % HC_GRADIENTS);
        zz->reactive  = (uint8_t)((rnd() % HC_RX_COUNT) | ((rnd() % 16) << 4));
        for (int k = 0; k < 3; k++) {
            zz->color[k]    = (rnd() % 4) == 0 ? 0 : (uint8_t)rnd();
            zz->rx_color[k] = (rnd() % 3) == 0 ? 0 : (uint8_t)rnd();
        }
    }
    for (int g = 0; g < HC_GRADIENTS; g++) {
        hc_gradient_t *gg = &s->grad[g];
        gg->count         = (uint8_t)(rnd() % (HC_GRAD_STOPS + 1));
        gg->flags         = (uint8_t)(rnd() & 1);
        uint8_t pos       = 0;
        for (int i = 0; i < HC_GRAD_STOPS; i++) {
            uint8_t step = (uint8_t)(rnd() % 70);
            pos          = (uint16_t)pos + step > 255 ? 255 : (uint8_t)(pos + step);
            gg->stop[i].pos = pos;
            gg->stop[i].r   = (uint8_t)rnd();
            gg->stop[i].g   = (uint8_t)rnd();
            gg->stop[i].b   = (uint8_t)rnd();
        }
    }
    for (int i = 0; i < HC_HALO_LEDS; i++) {
        s->halo_xy[i][0] = (rnd() % 20) == 0 ? 255 : (uint8_t)(rnd() % 225);
        s->halo_xy[i][1] = (rnd() % 20) == 0 ? 255 : (uint8_t)(rnd() % 65);
        s->halo_ring[i]  = (uint8_t)rnd();
    }
}

static void unit_vectors(void) {
    printf("\"sin8\":\"");
    for (int i = 0; i < 256; i++) { uint8_t v = hc_sin8((uint8_t)i); hex(&v, 1); }
    printf("\",\"hsv2rgb\":\"");
    static const uint8_t ss[] = {0, 1, 128, 255}, vs[] = {0, 77, 255};
    for (int h = 0; h < 256; h++) for (int a = 0; a < 4; a++) for (int b = 0; b < 3; b++) {
        uint8_t hsv[3] = {(uint8_t)h, ss[a], vs[b]}, rgb[3];
        hc_hsv2rgb(hsv, rgb); hex(rgb, 3);
    }
    printf("\",\"rgb2hsv\":[");
    for (int i = 0; i < 2000; i++) {
        uint8_t rgb[3] = {(uint8_t)rnd(), (uint8_t)rnd(), (uint8_t)rnd()}, hsv[3];
        if (i % 7 == 0) rgb[1] = rgb[0];
        hc_rgb2hsv(rgb, hsv);
        printf("%s\"", i ? "," : ""); hex(rgb, 3); hex(hsv, 3); printf("\"");
    }
    printf("],\"atan2\":\"");
    for (int dy = -120; dy <= 120; dy += 7) for (int dx = -120; dx <= 120; dx += 7) { uint8_t v = hc_atan2_8((int16_t)dy, (int16_t)dx); hex(&v, 1); }
    printf("\",\"isqrt\":[");
    for (uint32_t n = 0, k = 0; n < 70000; n += 97, k++) printf("%s%u", k ? "," : "", hc_isqrt32(n));
    printf("]");
}

int main(void) {
    assert(sizeof(hc_zone_t) == 20);
    assert(sizeof(hc_gradient_t) == 26);
    assert(sizeof(hc_scene_t) == 915);
    printf("{\"scene_bytes\":%u,", (unsigned)sizeof(hc_scene_t));
    unit_vectors();
    printf(",\"tests\":[\n");
    const int NT = 80, NF = 40;
    for (int test = 0; test < NT; test++) {
        hc_scene_t s;
        if (test == 0) hc_scene_defaults(&s); else fuzz_scene(&s);
        hc_state_t st;
        hc_state_init(&st);
        uint8_t mk = (uint8_t)(255 - (test * 37) % 200), mh = (uint8_t)(60 + (test * 53) % 196);
        printf("%s{\"scene\":\"", test ? ",\n" : "");
        hex((const uint8_t *)&s, sizeof(s));
        printf("\",\"masters\":[%u,%u],\"ops\":[", mk, mh);
        uint32_t t = 1000u + (uint32_t)test * 12345u + (test == 7 ? 4294000000u : 0u);
        int first = 1;
        for (int f = 0; f < NF; f++) {
            t += 7 + rnd() % 60;
            if (rnd() % 3 == 0) {
                uint8_t led = (uint8_t)((rnd() % 5) == 0 ? rnd() % HC_LED_COUNT : rnd() % HC_KEY_LEDS);
                hc_key_hit(&st, &s, led, t);
                printf("%s[\"h\",%u,%u]", first ? "" : ",", led, t);
                first = 0;
                t += rnd() % 5;
            }
            hc_frame_begin(&st, &s, t);
            uint8_t frame[HC_LED_COUNT * 3];
            for (int i = 0; i < HC_LED_COUNT; i++) {
                uint8_t c[3];
                hc_render_led(&s, &st, (uint8_t)i, t, c);
                uint8_t m = i < HC_KEY_LEDS ? mk : ((s.flags & HC_SF_HALO_FOLLOWS_KEYS) ? mk : mh);
                hc_finish(&s, m, c);
                memcpy(&frame[i * 3], c, 3);
            }
            printf("%s[\"f\",%u,\"", first ? "" : ",", t);
            first = 0;
            hex(frame, sizeof(frame));
            printf("\"]");
        }
        printf("]}");
    }
    printf("\n]}\n");
    return 0;
}

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
        zz->flags     = (uint8_t)(rnd() & 15); // REVERSE, SRC_SCROLL, MIRROR, PINGPONG
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
        gg->flags         = (uint8_t)(rnd() & 3); // WRAP, MIRROR
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

static void set_gradient(hc_gradient_t *g, uint8_t flags, uint8_t n, const uint8_t (*st)[4]) {
    memset(g, 0, sizeof(*g));
    g->count = n;
    g->flags = flags;
    for (uint8_t i = 0; i < n; i++) {
        g->stop[i].pos = st[i][0];
        g->stop[i].r   = st[i][1];
        g->stop[i].g   = st[i][2];
        g->stop[i].b   = st[i][3];
    }
}

// G, B, P, K across the whole range, and three stops that leave both ends open
static const uint8_t GBPK[4][4]    = {{0, 0, 200, 60}, {85, 0, 60, 255}, {170, 160, 0, 255}, {255, 20, 20, 20}};
static const uint8_t PARTIAL[3][4] = {{40, 255, 80, 0}, {120, 0, 255, 120}, {200, 40, 0, 255}};

// ---- deterministic "back and forth" (HC_ZF_PINGPONG) + mirrored-gradient scenes.
// Zone z of scene k runs one of the effects PINGPONG applies to, or one it must leave alone
// (Breathe without spread, Heartbeat), with PINGPONG plus one of none / REVERSE / MIRROR /
// REVERSE|MIRROR (every effect meets every combination over scenes 0-3), and SRC_SCROLL too
// in scenes 4-7. Half the zones run at speed 240, whose phase turns exactly every 1024 ms,
// and the frame times straddle those turns. Gradient slots: MIRROR and MIRROR|WRAP over
// stops that span 0..255 and over stops that leave both ends open.
#define NPP 8
static void pingpong_scene(hc_scene_t *s, int k) {
    static const uint8_t fx[HC_ZONES]       = {HC_FX_WAVE, HC_FX_SATWAVE, HC_FX_COLOR_CYCLE, HC_FX_FLOW,
                                               HC_FX_COMET, HC_FX_BREATHE, HC_FX_BREATHE, HC_FX_PULSE};
    static const uint8_t combo[4]           = {0, HC_ZF_REVERSE, HC_ZF_MIRROR, HC_ZF_REVERSE | HC_ZF_MIRROR};
    static const uint8_t axes[4]            = {HC_AXIS_X, HC_AXIS_RING, HC_AXIS_Y, HC_AXIS_DIAG};
    static const uint8_t comet_count[NPP]   = {1, 2, 3, 5, 8, 1, 2, 4};
    static const uint8_t comet_tail[NPP]    = {60, 30, 90, 20, 10, 255, 128, 1};
    hc_scene_defaults(s);
    s->flags = (uint8_t)((k & 1) ? HC_SF_GAMMA : 0);
    for (int i = 0; i < HC_LED_COUNT; i++) s->zone_of[i] = (uint8_t)((i * 3 + k) % HC_ZONES);
    for (int zi = 0; zi < HC_ZONES; zi++) {
        hc_zone_t *z = &s->zones[zi];
        memset(z, 0, sizeof(*z));
        z->effect    = fx[zi];
        z->speed     = (zi + k) % 2 ? 240 : (uint8_t)(20 + 29 * zi + 7 * k);
        z->v_min     = 16;
        z->v_max     = 255;
        z->axis      = axes[(zi + k) % 4];
        z->spread    = zi == 6 ? 0 : (uint8_t)(16 + (k % 3) * 8); // zone 6: Breathe without spread
        z->p1        = zi == 4 ? comet_tail[k] : (uint8_t)(60 + 20 * k);
        z->p2        = zi == 4 ? comet_count[k] : 200;
        z->flags     = (uint8_t)(HC_ZF_PINGPONG | combo[(zi + k) % 4] | (k >= 4 ? HC_ZF_SRC_SCROLL : 0));
        z->source    = ((zi == 2 || zi == 5) && (k & 1)) ? HC_SRC_RAINBOW : HC_SRC_GRADIENT;
        z->src_axis  = axes[(zi + 2 * k + 1) % 4];
        z->src_scale = (uint8_t)(16 + (zi % 3) * 8);
        z->gradient  = (uint8_t)((zi + k) % HC_GRADIENTS);
        z->reactive  = zi == 3 ? (uint8_t)(HC_RX_GLOW | (8u << 4)) : 0; // one overlay on top of a Flow
    }
    set_gradient(&s->grad[0], HC_GF_MIRROR, 4, GBPK);
    set_gradient(&s->grad[1], HC_GF_MIRROR | HC_GF_WRAP, 4, GBPK);
    set_gradient(&s->grad[2], HC_GF_MIRROR | HC_GF_WRAP, 3, PARTIAL);
    set_gradient(&s->grad[3], HC_GF_MIRROR, 3, PARTIAL);
}

// frame f of a deterministic scene: triples around the first 8 turns of a speed-240 zone
// (1023/1024/1025 ms, 2047/2048/2049 ms, ...), then an even walk through later sweeps
static uint32_t pingpong_time(int f) {
    if (f < 24) return 1024u * (uint32_t)(1 + f / 3) + (uint32_t)(f % 3) - 1u;
    return 9000u + (uint32_t)(f - 24) * 173u;
}

// ---- behaviour checks (C side; parity then holds the JS twin to the same frames)
static int bfails = 0;
static void expect(int ok, const char *what, int a, int b) {
    if (ok) return;
    if (bfails < 20) fprintf(stderr, "BEHAVIOUR FAIL: %s (%d, %d)\n", what, a, b);
    bfails++;
}

static int same_frame(const hc_scene_t *a, uint32_t ta, const hc_scene_t *b, uint32_t tb) {
    hc_state_t st; // no key hits
    hc_state_init(&st);
    for (int i = 0; i < HC_LED_COUNT; i++) {
        uint8_t ca[3], cb[3];
        hc_render_led(a, &st, (uint8_t)i, ta, ca);
        hc_render_led(b, &st, (uint8_t)i, tb, cb);
        if (memcmp(ca, cb, 3) != 0) return 0;
    }
    return 1;
}

// every LED in zone 0 = effect fx at speed 240 (phase 64/ms: one way = 1024 ms), gradient source
static void one_zone_scene(hc_scene_t *s, uint8_t fx, uint8_t flags) {
    hc_scene_defaults(s);
    memset(s->zone_of, 0, sizeof(s->zone_of));
    hc_zone_t *z = &s->zones[0];
    memset(z, 0, sizeof(*z));
    z->effect    = fx;
    z->speed     = 240;
    z->v_min     = 20;
    z->v_max     = 255;
    z->axis      = HC_AXIS_X;
    z->spread    = 16;
    z->p1        = 60;
    z->p2        = fx == HC_FX_COMET ? 1 : 200;
    z->flags     = flags;
    z->source    = HC_SRC_GRADIENT;
    z->src_axis  = HC_AXIS_X;
    z->src_scale = 16;
    z->gradient  = 0;
}

static void behaviour_checks(void) {
    // 1. A mirrored gradient is a palindrome: pos p and 255 - p give the same colour.
    for (int n = 0; n < 400; n++) {
        hc_gradient_t g;
        memset(&g, 0, sizeof(g));
        g.count     = (uint8_t)(rnd() % (HC_GRAD_STOPS + 1));
        g.flags     = (uint8_t)(HC_GF_MIRROR | ((n & 1) ? HC_GF_WRAP : 0));
        uint8_t pos = (uint8_t)(rnd() % 60);
        for (int i = 0; i < HC_GRAD_STOPS; i++) {
            g.stop[i].pos = pos;
            g.stop[i].r   = (uint8_t)rnd();
            g.stop[i].g   = (uint8_t)rnd();
            g.stop[i].b   = (uint8_t)rnd();
            uint8_t step  = (uint8_t)(rnd() % 60);
            pos           = (uint16_t)pos + step > 255 ? 255 : (uint8_t)(pos + step);
        }
        for (int p = 0; p < 256; p++) {
            uint8_t a[3], b[3];
            hc_grad_sample(&g, (uint8_t)p, a);
            hc_grad_sample(&g, (uint8_t)(255 - p), b);
            expect(memcmp(a, b, 3) == 0, "mirrored gradient: pos p and 255-p differ", n, p);
        }
    }
    // G B P K over 0..255 mirrored: G at both ends, exactly K in the middle; WRAP changes
    // nothing when the stops already span 0..255.
    {
        hc_gradient_t m, mw;
        uint8_t       c[3], d[3];
        set_gradient(&m, HC_GF_MIRROR, 4, GBPK);
        set_gradient(&mw, HC_GF_MIRROR | HC_GF_WRAP, 4, GBPK);
        static const uint8_t G[3] = {0, 200, 60}, K[3] = {20, 20, 20};
        hc_grad_sample(&m, 0, c);
        expect(memcmp(c, G, 3) == 0, "mirrored GBPK starts at G", c[0], c[1]);
        hc_grad_sample(&m, 255, c);
        expect(memcmp(c, G, 3) == 0, "mirrored GBPK ends at G", c[0], c[1]);
        hc_grad_sample(&m, 127, c);
        expect(memcmp(c, K, 3) == 0, "mirrored GBPK is K at 127", c[0], c[1]);
        hc_grad_sample(&m, 128, c);
        expect(memcmp(c, K, 3) == 0, "mirrored GBPK is K at 128", c[0], c[1]);
        for (int p = 0; p < 256; p++) {
            hc_grad_sample(&m, (uint8_t)p, c);
            hc_grad_sample(&mw, (uint8_t)p, d);
            expect(memcmp(c, d, 3) == 0, "full-span mirrored gradient: WRAP changed it", p, 0);
        }
    }

    // 2. Back and forth, for every effect it applies to and every REVERSE/MIRROR combination.
    static const uint8_t pp_fx[6] = {HC_FX_WAVE, HC_FX_SATWAVE, HC_FX_COLOR_CYCLE, HC_FX_FLOW, HC_FX_COMET, HC_FX_BREATHE};
    static const uint8_t combo[4] = {0, HC_ZF_REVERSE, HC_ZF_MIRROR, HC_ZF_REVERSE | HC_ZF_MIRROR};
    for (int e = 0; e < 6; e++) {
        for (int c = 0; c < 4; c++) {
            hc_scene_t pp, ref, flip;
            one_zone_scene(&pp, pp_fx[e], (uint8_t)(combo[c] | HC_ZF_PINGPONG));
            one_zone_scene(&ref, pp_fx[e], combo[c]);
            one_zone_scene(&flip, pp_fx[e], (uint8_t)((combo[c] ^ HC_ZF_REVERSE) | HC_ZF_PINGPONG));
            const int id = e * 10 + c;
            // no jump at either turn (phase 65535 -> 65536 and 131071 -> 131072)
            expect(same_frame(&pp, 1023, &pp, 1024), "back and forth jumps at the far turn", id, 1024);
            expect(same_frame(&pp, 2047, &pp, 2048), "back and forth jumps at the near turn", id, 2048);
            // it does change something on the way back
            expect(!same_frame(&pp, 1280, &ref, 1280), "back and forth changes nothing on the way back", id, 1280);
            if (pp_fx[e] == HC_FX_COMET) {
                // on the way back the comet looks exactly like the reversed comet going forward
                for (uint32_t t = 1024; t < 2048; t += 37)
                    expect(same_frame(&pp, t, &flip, t - 1024), "comet on the way back != reversed comet", id, (int)t);
                // mid-sweep (head past the tail length) it is the ordinary one-way comet
                if (!(combo[c] & HC_ZF_REVERSE))
                    for (uint32_t t = 240; t < 1024; t += 41)
                        expect(same_frame(&pp, t, &ref, t), "comet mid-sweep differs from the one-way comet", id, (int)t);
            } else {
                for (uint32_t t = 0; t < 1024; t += 31) {
                    // the forward half is the ordinary one-way motion...
                    expect(same_frame(&pp, t, &ref, t), "forward half differs from one-way", id, (int)t);
                    // ...and the backward half retraces it
                    expect(same_frame(&pp, t, &pp, 2047 - t), "backward half does not retrace the forward half", id, (int)t);
                }
            }
        }
    }

    // 3. Other effects keep their own timing; only their colour-source scroll goes back and forth.
    static const uint8_t other_fx[8] = {HC_FX_STATIC, HC_FX_BREATHE, HC_FX_PULSE, HC_FX_HUE_DRIFT,
                                        HC_FX_SPARKLE, HC_FX_CANDLE, HC_FX_RAINDROPS, HC_FX_STROBE};
    for (int e = 0; e < 8; e++) {
        hc_scene_t pp, ref;
        one_zone_scene(&pp, other_fx[e], HC_ZF_PINGPONG);
        one_zone_scene(&ref, other_fx[e], 0);
        if (other_fx[e] == HC_FX_BREATHE) pp.zones[0].spread = ref.zones[0].spread = 0; // plain breathing
        for (uint32_t t = 100; t < 4200; t += 250)
            expect(same_frame(&pp, t, &ref, t), "back and forth changed an effect it does not apply to", other_fx[e], (int)t);
        pp.zones[0].flags  = HC_ZF_PINGPONG | HC_ZF_SRC_SCROLL;
        ref.zones[0].flags = HC_ZF_SRC_SCROLL;
        expect(same_frame(&pp, 700, &ref, 700), "scrolled source differs on the way out", other_fx[e], 700);
        expect(!same_frame(&pp, 1280, &ref, 1280), "scrolled source does not come back", other_fx[e], 1280);
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

static int first_op;

static void begin_test(int test, const hc_scene_t *s, uint8_t mk, uint8_t mh) {
    printf("%s{\"scene\":\"", test ? ",\n" : "");
    hex((const uint8_t *)s, sizeof(*s));
    printf("\",\"masters\":[%u,%u],\"ops\":[", mk, mh);
    first_op = 1;
}

static void emit_hit(hc_state_t *st, const hc_scene_t *s, uint8_t led, uint32_t t) {
    hc_key_hit(st, s, led, t);
    printf("%s[\"h\",%u,%u]", first_op ? "" : ",", led, t);
    first_op = 0;
}

static void emit_frame(hc_state_t *st, const hc_scene_t *s, uint32_t t, uint8_t mk, uint8_t mh) {
    hc_frame_begin(st, s, t);
    uint8_t frame[HC_LED_COUNT * 3];
    for (int i = 0; i < HC_LED_COUNT; i++) {
        uint8_t c[3];
        hc_render_led(s, st, (uint8_t)i, t, c);
        uint8_t m = i < HC_KEY_LEDS ? mk : ((s->flags & HC_SF_HALO_FOLLOWS_KEYS) ? mk : mh);
        hc_finish(s, m, c);
        memcpy(&frame[i * 3], c, 3);
    }
    printf("%s[\"f\",%u,\"", first_op ? "" : ",", t);
    first_op = 0;
    hex(frame, sizeof(frame));
    printf("\"]");
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
        begin_test(test, &s, mk, mh);
        uint32_t t = 1000u + (uint32_t)test * 12345u + (test == 7 ? 4294000000u : 0u);
        for (int f = 0; f < NF; f++) {
            t += 7 + rnd() % 60;
            if (rnd() % 3 == 0) {
                uint8_t led = (uint8_t)((rnd() % 5) == 0 ? rnd() % HC_LED_COUNT : rnd() % HC_KEY_LEDS);
                emit_hit(&st, &s, led, t);
                t += rnd() % 5;
            }
            emit_frame(&st, &s, t, mk, mh);
        }
        printf("]}");
    }
    for (int k = 0; k < NPP; k++) {
        hc_scene_t s;
        pingpong_scene(&s, k);
        hc_state_t st;
        hc_state_init(&st);
        begin_test(NT + k, &s, 255, 200);
        for (int f = 0; f < NF; f++) {
            if (f == 30) emit_hit(&st, &s, (uint8_t)(17 + k), pingpong_time(f)); // glow over the Flow zone
            emit_frame(&st, &s, pingpong_time(f), 255, 200);
        }
        printf("]}");
    }
    printf("\n]}\n");

    behaviour_checks();
    if (bfails) {
        fprintf(stderr, "BEHAVIOUR CHECKS FAILED: %d\n", bfails);
        return 1;
    }
    fprintf(stderr, "behaviour checks OK: mirrored gradients, back and forth (turns, retrace, other effects untouched)\n");
    return 0;
}

// Halo Composer - per-LED lighting engine
// Copyright 2026 Halo Composer contributors
// SPDX-License-Identifier: GPL-2.0-or-later
//
// Pure integer math, no floats (Cortex-M0 has no FPU), no QMK headers.
// Mirrored exactly by HcEngine in halo-studio.html. Keep them in sync.

#include "hc_engine.h"
#include <string.h>

// ------------------------------------------------------------- helpers ---
uint8_t hc_scale8(uint8_t i, uint8_t s) {
    return (uint8_t)(((uint16_t)i * (1u + (uint16_t)s)) >> 8);
}

static uint8_t qadd8(uint8_t a, uint8_t b) {
    uint16_t r = (uint16_t)a + b;
    return r > 255 ? 255 : (uint8_t)r;
}

static uint8_t qsub8(uint8_t a, uint8_t b) {
    return a > b ? (uint8_t)(a - b) : 0;
}

uint8_t hc_lerp8(uint8_t a, uint8_t b, uint8_t f) {
    if (b >= a) return (uint8_t)(a + hc_scale8((uint8_t)(b - a), f));
    return (uint8_t)(a - hc_scale8((uint8_t)(a - b), f));
}

// FastLED sin8_C: 0..255 in -> 1..255 out, sin8(64) = 255
static const uint8_t b_m16_interleave[8] = {0, 49, 49, 41, 90, 27, 117, 10};

uint8_t hc_sin8(uint8_t theta) {
    uint8_t offset = theta;
    if (theta & 0x40) offset = (uint8_t)(255 - offset);
    offset &= 0x3F;
    uint8_t secoffset = offset & 0x0F;
    if (theta & 0x40) secoffset++;
    uint8_t section = offset >> 4;
    uint8_t b       = b_m16_interleave[section * 2];
    uint8_t m16     = b_m16_interleave[section * 2 + 1];
    uint8_t mx      = (uint8_t)((m16 * secoffset) >> 4);
    int     y       = mx + b;
    if (theta & 0x80) y = -y;
    return (uint8_t)(y + 128);
}

static uint8_t tri8(uint8_t u) {
    return u < 128 ? (uint8_t)(u * 2) : (uint8_t)((255 - u) * 2);
}

uint32_t hc_hash32(uint32_t x) {
    x ^= x >> 16;
    x *= 0x7feb352dU;
    x ^= x >> 15;
    x *= 0x846ca68bU;
    x ^= x >> 16;
    return x;
}

// 16-bit phase: wraps every 65536*4/(speed+16) ms -> 16.4 s @0, 0.97 s @255
uint16_t hc_phase16(uint32_t t, uint8_t speed) {
    return (uint16_t)(((uint64_t)t * (uint32_t)(speed + 16u)) >> 2);
}

// same clock without the 16-bit wrap (wraps at 2^32), for per-LED random slots
static uint32_t phase32(uint32_t t, uint8_t speed) {
    return (uint32_t)(((uint64_t)t * (uint32_t)(speed + 16u)) >> 2);
}

// 0..255 angle, 0 = +x (right), increasing clockwise on screen (y grows downward)
uint8_t hc_atan2_8(int16_t dy, int16_t dx) {
    if (dx == 0 && dy == 0) return 0;
    uint16_t ax = (uint16_t)(dx < 0 ? -dx : dx);
    uint16_t ay = (uint16_t)(dy < 0 ? -dy : dy);
    uint8_t  a;
    if (ax >= ay) {
        a = (uint8_t)(((uint32_t)ay * 32u) / ax);
    } else {
        a = (uint8_t)(64u - ((uint32_t)ax * 32u) / ay);
    }
    if (dx < 0) a = (uint8_t)(128 - a);
    if (dy < 0) a = (uint8_t)(256 - a);
    return a;
}

uint16_t hc_isqrt32(uint32_t n) {
    uint32_t res = 0;
    uint32_t bit = 1UL << 30;
    while (bit > n) bit >>= 2;
    while (bit) {
        if (n >= res + bit) {
            n -= res + bit;
            res = (res >> 1) + bit;
        } else {
            res >>= 1;
        }
        bit >>= 2;
    }
    return (uint16_t)res;
}

void hc_hsv2rgb(const uint8_t hsv[3], uint8_t rgb[3]) {
    uint8_t h = hsv[0], s = hsv[1], v = hsv[2];
    if (s == 0) {
        rgb[0] = rgb[1] = rgb[2] = v;
        return;
    }
    uint8_t region = h / 43;
    uint8_t rem    = (uint8_t)((h - region * 43) * 6);
    uint8_t p      = (uint8_t)((v * (255 - s)) >> 8);
    uint8_t q      = (uint8_t)((v * (255 - ((s * rem) >> 8))) >> 8);
    uint8_t t      = (uint8_t)((v * (255 - ((s * (255 - rem)) >> 8))) >> 8);
    switch (region) {
        case 0: rgb[0] = v; rgb[1] = t; rgb[2] = p; break;
        case 1: rgb[0] = q; rgb[1] = v; rgb[2] = p; break;
        case 2: rgb[0] = p; rgb[1] = v; rgb[2] = t; break;
        case 3: rgb[0] = p; rgb[1] = q; rgb[2] = v; break;
        case 4: rgb[0] = t; rgb[1] = p; rgb[2] = v; break;
        default: rgb[0] = v; rgb[1] = p; rgb[2] = q; break;
    }
}

void hc_rgb2hsv(const uint8_t c[3], uint8_t hsv[3]) {
    int r = c[0], g = c[1], b = c[2];
    int mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
    int mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
    hsv[2] = (uint8_t)mx;
    if (mx == 0) {
        hsv[0] = 0;
        hsv[1] = 0;
        return;
    }
    int d  = mx - mn;
    hsv[1] = (uint8_t)((255 * d) / mx);
    if (d == 0) {
        hsv[0] = 0;
        return;
    }
    int h;
    if (mx == r) {
        h = (43 * (g - b)) / d;
    } else if (mx == g) {
        h = 85 + (43 * (b - r)) / d;
    } else {
        h = 171 + (43 * (r - g)) / d;
    }
    hsv[0] = (uint8_t)(h & 0xFF);
}

static void hue_shift(uint8_t c[3], uint8_t off) {
    if (off == 0) return;
    uint8_t hsv[3];
    hc_rgb2hsv(c, hsv);
    hsv[0] = (uint8_t)(hsv[0] + off);
    hc_hsv2rgb(hsv, c);
}

static void scale_rgb(uint8_t c[3], uint8_t v) {
    c[0] = hc_scale8(c[0], v);
    c[1] = hc_scale8(c[1], v);
    c[2] = hc_scale8(c[2], v);
}

static void lerp_rgb(uint8_t a[3], const uint8_t b[3], uint8_t f) {
    a[0] = hc_lerp8(a[0], b[0], f);
    a[1] = hc_lerp8(a[1], b[1], f);
    a[2] = hc_lerp8(a[2], b[2], f);
}

static void copy_rgb(uint8_t d[3], const uint8_t s[3]) {
    d[0] = s[0];
    d[1] = s[1];
    d[2] = s[2];
}

static bool is_black(const uint8_t c[3]) {
    return (c[0] | c[1] | c[2]) == 0;
}

void hc_grad_sample(const hc_gradient_t *g, uint8_t pos, uint8_t out[3]) {
    uint8_t n = g->count;
    if (n > HC_GRAD_STOPS) n = HC_GRAD_STOPS;
    if (n == 0) {
        out[0] = out[1] = out[2] = 0;
        return;
    }
    const hc_stop_t *st = g->stop;
    if (n == 1) {
        out[0] = st[0].r; out[1] = st[0].g; out[2] = st[0].b;
        return;
    }
    bool    wrap = (g->flags & 1) != 0;
    uint8_t i    = 0;
    while (i < n && st[i].pos <= pos) i++;
    const hc_stop_t *a;
    const hc_stop_t *b;
    uint16_t         span, off;
    if (i == 0) {
        if (!wrap) {
            out[0] = st[0].r; out[1] = st[0].g; out[2] = st[0].b;
            return;
        }
        a    = &st[n - 1];
        b    = &st[0];
        span = (uint16_t)(256 - a->pos + b->pos);
        off  = (uint16_t)(256 - a->pos + pos);
    } else if (i == n) {
        if (!wrap) {
            out[0] = st[n - 1].r; out[1] = st[n - 1].g; out[2] = st[n - 1].b;
            return;
        }
        a    = &st[n - 1];
        b    = &st[0];
        span = (uint16_t)(256 - a->pos + b->pos);
        off  = (uint16_t)(pos - a->pos);
    } else {
        a    = &st[i - 1];
        b    = &st[i];
        span = (uint16_t)(b->pos - a->pos);
        off  = (uint16_t)(pos - a->pos);
    }
    uint8_t f = span ? (uint8_t)(((uint32_t)off * 255u) / span) : 0;
    out[0]    = hc_lerp8(a->r, b->r, f);
    out[1]    = hc_lerp8(a->g, b->g, f);
    out[2]    = hc_lerp8(a->b, b->b, f);
}

// --------------------------------------------------------------- geometry -
void hc_led_xy(const hc_scene_t *s, uint8_t led, uint8_t *x, uint8_t *y) {
    if (led < HC_KEY_LEDS) {
        *x = hc_key_xy[led][0];
        *y = hc_key_xy[led][1];
    } else {
        uint8_t h = (uint8_t)(led - HC_KEY_LEDS);
        *x        = s->halo_xy[h][0];
        *y        = s->halo_xy[h][1];
    }
}

uint8_t hc_axis_value(const hc_scene_t *s, uint8_t led, uint8_t axis) {
    uint8_t x, y;
    hc_led_xy(s, led, &x, &y);
    int16_t dx = (int16_t)x - HC_CENTER_X;
    int16_t dy = (int16_t)y - HC_CENTER_Y;
    switch (axis) {
        case HC_AXIS_X: {
            uint16_t v = (uint16_t)(((uint16_t)x * 255u) / 224u);
            return v > 255 ? 255 : (uint8_t)v;
        }
        case HC_AXIS_Y: {
            uint16_t v = (uint16_t)y * 4u;
            return v > 255 ? 255 : (uint8_t)v;
        }
        case HC_AXIS_RADIAL: {
            uint16_t d = (uint16_t)(hc_isqrt32((uint32_t)(dx * dx + dy * dy)) * 2u);
            return d > 255 ? 255 : (uint8_t)d;
        }
        case HC_AXIS_ANGLE:
            return hc_atan2_8(dy, dx);
        case HC_AXIS_SPIRAL: {
            uint16_t d = (uint16_t)(hc_isqrt32((uint32_t)(dx * dx + dy * dy)) * 2u);
            if (d > 255) d = 255;
            return (uint8_t)(hc_atan2_8(dy, dx) + d);
        }
        case HC_AXIS_DIAG: {
            uint16_t vx = (uint16_t)(((uint16_t)x * 255u) / 224u);
            uint16_t vy = (uint16_t)y * 4u;
            if (vx > 255) vx = 255;
            if (vy > 255) vy = 255;
            return (uint8_t)((vx + vy) / 2u);
        }
        case HC_AXIS_RING:
            if (led >= HC_KEY_LEDS) return s->halo_ring[led - HC_KEY_LEDS];
            return hc_atan2_8(dy, dx);
        case HC_AXIS_NONE:
        default:
            return 0;
    }
}

static uint8_t zone_axis(const hc_scene_t *s, const hc_zone_t *z, uint8_t led, uint8_t axis) {
    uint8_t a = hc_axis_value(s, led, axis);
    if (z->flags & HC_ZF_MIRROR) a = tri8(a);
    return a;
}

// ------------------------------------------------------------ lifecycle ---
void hc_state_init(hc_state_t *st) {
    memset(st, 0, sizeof(*st));
    for (uint8_t i = 0; i < HC_MAX_HITS; i++) st->hits[i].led = 0xFF;
}

void hc_key_hit(hc_state_t *st, const hc_scene_t *s, uint8_t led, uint32_t t) {
    if (led >= HC_LED_COUNT) return;
    hc_hit_t *h  = &st->hits[st->hit_head];
    st->hit_head = (uint8_t)((st->hit_head + 1) % HC_MAX_HITS);
    h->led       = led;
    hc_led_xy(s, led, &h->x, &h->y);
    h->t          = t;
    st->heat[led] = qadd8(st->heat[led], 40);
}

void hc_frame_begin(hc_state_t *st, const hc_scene_t *s, uint32_t t) {
    (void)s;
    uint32_t steps = (uint32_t)(t - st->heat_t) / 40u;
    if (steps == 0) return;
    st->heat_t += steps * 40u;
    uint8_t dec = steps > 255 ? 255 : (uint8_t)steps;
    for (uint8_t i = 0; i < HC_LED_COUNT; i++) st->heat[i] = qsub8(st->heat[i], dec);
}

// ------------------------------------------------------------- effects ---
// accent colour: zone colour, or the LED's base colour when the zone colour is black
static void accent_of(const hc_zone_t *z, const uint8_t base[3], uint8_t out[3]) {
    if (is_black(z->color)) {
        copy_rgb(out, base);
    } else {
        copy_rgb(out, z->color);
    }
}

// random "slot" helper for sparkle/raindrops: returns envelope position 0..255
// inside the LED's current slot and whether this slot fires (density p)
static bool rand_slot(uint32_t ph32, uint8_t led, uint8_t shift, uint8_t density, uint8_t *pos) {
    uint32_t o    = hc_hash32((uint32_t)led + 0x9E37u) & 0xFFFFu;
    uint32_t tt   = ph32 + o;
    uint32_t slot = tt >> shift;
    *pos          = (uint8_t)((tt >> (shift - 8)) & 0xFFu);
    uint32_t h    = hc_hash32(slot ^ ((uint32_t)led << 24) ^ 0xA5A5u);
    return (h & 0xFFu) < density;
}

static uint8_t band8(uint8_t theta, uint8_t p1) {
    uint16_t w = (uint16_t)((p1 >> 1) + 1); // 1..128
    uint16_t d = theta < 128 ? theta : (uint16_t)(256 - theta);
    if (d >= w) return 0;
    return hc_sin8((uint8_t)(64u + (d * 128u) / w));
}

static uint16_t dist_to(uint8_t x0, uint8_t y0, uint8_t x1, uint8_t y1) {
    int32_t dx = (int32_t)x1 - x0;
    int32_t dy = (int32_t)y1 - y0;
    return hc_isqrt32((uint32_t)(dx * dx + dy * dy));
}

void hc_render_led(const hc_scene_t *s, const hc_state_t *st, uint8_t led, uint32_t t, uint8_t out[3]) {
    const uint8_t   zl = s->zone_of[led];
    const hc_zone_t *z = &s->zones[zl & HC_LF_ZONE_MASK];
    out[0] = out[1] = out[2] = 0;
    if (z->effect == HC_FX_OFF || z->effect >= HC_FX_COUNT) return;

    const uint16_t ph16 = hc_phase16(t, z->speed);
    const uint8_t  ph8  = (uint8_t)(ph16 >> 8);
    const bool     rev  = (z->flags & HC_ZF_REVERSE) != 0;
    const uint8_t  lo   = z->v_min < z->v_max ? z->v_min : z->v_max;
    const uint8_t  hi   = z->v_min < z->v_max ? z->v_max : z->v_min;
    const uint8_t  rng  = (uint8_t)(hi - lo);

    // ---- base colour
    uint8_t c[3];
    uint8_t scroll = (z->effect == HC_FX_FLOW || (z->flags & HC_ZF_SRC_SCROLL)) ? ph8 : 0;
    if (rev) scroll = (uint8_t)(0 - scroll);
    switch (z->source) {
        case HC_SRC_ZONE:
            copy_rgb(c, z->color);
            break;
        case HC_SRC_GRADIENT: {
            uint8_t p = (uint8_t)(((uint16_t)zone_axis(s, z, led, z->src_axis) * z->src_scale) >> 4);
            hc_grad_sample(&s->grad[z->gradient % HC_GRADIENTS], (uint8_t)(p - scroll), c);
            break;
        }
        case HC_SRC_RAINBOW: {
            uint8_t p      = (uint8_t)(((uint16_t)zone_axis(s, z, led, z->src_axis) * z->src_scale) >> 4);
            uint8_t hsv[3] = {(uint8_t)(p - scroll), 255, 255};
            hc_hsv2rgb(hsv, c);
            break;
        }
        case HC_SRC_MAP:
        default:
            copy_rgb(c, s->color[led]);
            break;
    }

    // ---- effect
    const uint8_t a     = zone_axis(s, z, led, z->axis);
    const uint8_t sp    = (uint8_t)(((uint16_t)a * z->spread) >> 4);
    const uint8_t theta = rev ? (uint8_t)(ph8 + sp) : (uint8_t)(ph8 - sp);
    uint8_t       acc[3];

    switch (z->effect) {
        case HC_FX_STATIC:
        case HC_FX_FLOW:
            scale_rgb(c, hi);
            break;

        case HC_FX_BREATHE:
            scale_rgb(c, (uint8_t)(lo + hc_scale8(hc_sin8(theta), rng)));
            break;

        case HC_FX_PULSE: {
            uint8_t e;
            if (theta < 32) {
                e = tri8((uint8_t)(theta * 8));
            } else if (theta >= 48 && theta < 80) {
                e = hc_scale8(tri8((uint8_t)((theta - 48) * 8)), 170);
            } else {
                e = 0;
            }
            scale_rgb(c, (uint8_t)(lo + hc_scale8(e, rng)));
            break;
        }

        case HC_FX_WAVE:
            scale_rgb(c, (uint8_t)(lo + hc_scale8(band8(theta, z->p1), rng)));
            break;

        case HC_FX_SATWAVE: {
            static const uint8_t white[3] = {255, 255, 255};
            lerp_rgb(c, white, hc_scale8(band8(theta, z->p1), z->p2));
            scale_rgb(c, hi);
            break;
        }

        case HC_FX_HUE_DRIFT: {
            int off = (((int)hc_sin8(theta) - 128) * (int)z->p1) / 128;
            hue_shift(c, (uint8_t)(off & 0xFF));
            scale_rgb(c, hi);
            break;
        }

        case HC_FX_COLOR_CYCLE:
            hue_shift(c, theta);
            scale_rgb(c, hi);
            break;

        case HC_FX_SPARKLE: {
            uint8_t pos;
            bool    fire = rand_slot(phase32(t, z->speed), led, 11, z->p1, &pos);
            accent_of(z, c, acc);
            scale_rgb(c, lo);
            if (fire) {
                uint8_t e = (uint8_t)(255 - pos);
                e         = hc_scale8(e, e);
                scale_rgb(acc, hi);
                lerp_rgb(c, acc, e);
            }
            break;
        }

        case HC_FX_RAINDROPS: {
            uint8_t pos;
            bool    fire = rand_slot(phase32(t, z->speed), led, 12, z->p1, &pos);
            accent_of(z, c, acc);
            if (is_black(z->color)) hue_shift(acc, z->p2);
            scale_rgb(c, hi);
            if (fire) {
                scale_rgb(acc, hi);
                lerp_rgb(c, acc, tri8(pos));
            }
            break;
        }

        case HC_FX_CANDLE: {
            uint32_t o  = hc_hash32((uint32_t)led + 0x9E37u) & 0xFFFFu;
            uint32_t tt = phase32(t, z->speed) + o;
            uint32_t k  = tt >> 10;
            uint8_t  f  = (uint8_t)((tt >> 2) & 0xFFu);
            uint8_t  n0 = (uint8_t)(hc_hash32(k ^ ((uint32_t)led << 24)) & 0xFFu);
            uint8_t  n1 = (uint8_t)(hc_hash32((k + 1u) ^ ((uint32_t)led << 24)) & 0xFFu);
            scale_rgb(c, (uint8_t)(lo + hc_scale8(hc_lerp8(n0, n1, f), rng)));
            break;
        }

        case HC_FX_COMET: {
            uint8_t  n    = z->p2 == 0 ? 1 : (z->p2 > 8 ? 8 : z->p2);
            uint16_t seg  = (uint16_t)(256u / n);
            uint8_t  tail = z->p1 == 0 ? 1 : z->p1;
            uint8_t  head = rev ? (uint8_t)(0 - ph8) : ph8;
            uint8_t  d    = rev ? (uint8_t)(a - head) : (uint8_t)(head - a);
            uint16_t dm   = (uint16_t)(d % seg);
            uint8_t  e    = 0;
            if (dm < tail) {
                e = (uint8_t)(255u - (dm * 255u) / tail);
                e = hc_scale8(e, e);
            }
            scale_rgb(c, (uint8_t)(lo + hc_scale8(e, rng)));
            break;
        }

        case HC_FX_STROBE:
            scale_rgb(c, theta < z->p1 ? hi : lo);
            break;

        case HC_FX_REACT_FADE: {
            uint32_t dur = 150u + (uint32_t)(255 - z->speed) * 12u;
            uint8_t  e   = 0;
            for (uint8_t i = 0; i < HC_MAX_HITS; i++) {
                const hc_hit_t *h = &st->hits[i];
                if (h->led != led) continue;
                uint32_t age = t - h->t;
                if (age >= dur) continue;
                uint8_t f = (uint8_t)(255u - (age * 255u) / dur);
                if (f > e) e = f;
            }
            scale_rgb(c, (uint8_t)(lo + hc_scale8(e, rng)));
            break;
        }

        case HC_FX_RIPPLE: {
            const uint32_t life = 1500u;
            uint8_t        x, y;
            hc_led_xy(s, led, &x, &y);
            uint16_t w = (uint16_t)(z->p1 / 8u + 2u);
            uint8_t  e = 0;
            for (uint8_t i = 0; i < HC_MAX_HITS; i++) {
                const hc_hit_t *h = &st->hits[i];
                if (h->led == 0xFF) continue;
                uint32_t age = t - h->t;
                if (age >= life) continue;
                uint32_t r    = (age * (16u + z->speed / 2u)) / 256u;
                uint16_t dist = dist_to(h->x, h->y, x, y);
                uint32_t dd   = dist > r ? dist - r : r - dist;
                if (dd >= w) continue;
                uint8_t ring = (uint8_t)(((w - dd) * 255u) / w);
                uint8_t f    = hc_scale8(ring, (uint8_t)(255u - (age * 255u) / life));
                if (f > e) e = f;
            }
            accent_of(z, c, acc);
            scale_rgb(c, lo);
            scale_rgb(acc, hi);
            lerp_rgb(c, acc, e);
            break;
        }

        case HC_FX_HEATMAP:
            accent_of(z, c, acc);
            scale_rgb(c, lo);
            scale_rgb(acc, hi);
            lerp_rgb(c, acc, st->heat[led]);
            break;

        default:
            break;
    }

    // ---- reactive overlay
    uint8_t kind = z->reactive & 0x0F;
    if (kind != HC_RX_NONE && kind < HC_RX_COUNT && !(zl & HC_LF_NO_REACT)) {
        uint32_t dur = 200u + (uint32_t)(15u - (z->reactive >> 4)) * 120u;
        uint8_t  e   = 0;
        uint8_t  x, y;
        hc_led_xy(s, led, &x, &y);
        for (uint8_t i = 0; i < HC_MAX_HITS; i++) {
            const hc_hit_t *h = &st->hits[i];
            if (h->led == 0xFF) continue;
            uint32_t age = t - h->t;
            if (age >= dur) continue;
            uint8_t fade = (uint8_t)(255u - (age * 255u) / dur);
            uint8_t f    = 0;
            switch (kind) {
                case HC_RX_FLASH:
                    if (h->led == led) f = fade;
                    break;
                case HC_RX_GLOW: {
                    uint16_t dist = dist_to(h->x, h->y, x, y);
                    if (dist < 28) f = hc_scale8(fade, (uint8_t)(255u - (dist * 255u) / 28u));
                    break;
                }
                case HC_RX_RIPPLE: {
                    uint32_t r    = (age * 3u) / 10u;
                    uint16_t dist = dist_to(h->x, h->y, x, y);
                    uint32_t dd   = dist > r ? dist - r : r - dist;
                    if (dd < 10) f = hc_scale8(fade, (uint8_t)((10u - dd) * 25u));
                    break;
                }
                case HC_RX_ECHO:
                    if (led >= HC_KEY_LEDS) {
                        uint8_t ah = hc_atan2_8((int16_t)y - HC_CENTER_Y, (int16_t)x - HC_CENTER_X);
                        uint8_t ak = hc_atan2_8((int16_t)h->y - HC_CENTER_Y, (int16_t)h->x - HC_CENTER_X);
                        uint8_t d  = (uint8_t)(ah - ak);
                        if (d > 128) d = (uint8_t)(256 - d);
                        if (d < 20) f = hc_scale8(fade, (uint8_t)(255u - d * 12u));
                    }
                    break;
                default:
                    break;
            }
            if (f > e) e = f;
        }
        if (e) {
            uint8_t rc[3];
            if (is_black(z->rx_color)) {
                rc[0] = rc[1] = rc[2] = 255;
            } else {
                copy_rgb(rc, z->rx_color);
            }
            lerp_rgb(c, rc, e);
        }
    }

    copy_rgb(out, c);
}

static const uint8_t gamma22[256] = {
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,3,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6,7,7,7,8,8,8,9,9,9,10,10,11,11,11,12,12,13,13,13,14,14,15,15,16,16,17,17,18,18,19,19,20,20,21,22,22,23,23,24,25,25,26,26,27,28,28,29,30,30,31,32,33,33,34,35,35,36,37,38,39,39,40,41,42,43,43,44,45,46,47,48,49,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,73,74,75,76,77,78,79,81,82,83,84,85,87,88,89,90,91,93,94,95,97,98,99,100,102,103,105,106,107,109,110,111,113,114,116,117,119,120,121,123,124,126,127,129,130,132,133,135,137,138,140,141,143,145,146,148,149,151,153,154,156,158,159,161,163,165,166,168,170,172,173,175,177,179,181,182,184,186,188,190,192,194,196,197,199,201,203,205,207,209,211,213,215,217,219,221,223,225,227,229,231,234,236,238,240,242,244,246,248,251,253,255,
};

void hc_finish(const hc_scene_t *s, uint8_t master, uint8_t c[3]) {
    scale_rgb(c, master);
    if (s->flags & HC_SF_GAMMA) {
        c[0] = gamma22[c[0]];
        c[1] = gamma22[c[1]];
        c[2] = gamma22[c[2]];
    }
}

// --------------------------------------------------------------- defaults -
static void set_zone(hc_zone_t *z, uint8_t effect, uint8_t source, uint8_t speed, uint8_t lo, uint8_t hi) {
    memset(z, 0, sizeof(*z));
    z->effect    = effect;
    z->source    = source;
    z->speed     = speed;
    z->v_min     = lo;
    z->v_max     = hi;
    z->axis      = HC_AXIS_X;
    z->spread    = 16;
    z->src_axis  = HC_AXIS_X;
    z->src_scale = 16;
    z->p1        = 96;
    z->p2        = 1;
}

static void set_grad(hc_gradient_t *g, uint8_t flags, uint8_t n, const uint8_t (*st)[4]) {
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

void hc_scene_defaults(hc_scene_t *s) {
    memset(s, 0, sizeof(*s));
    s->magic   = HC_MAGIC;
    s->version = HC_SCENE_VERSION;

    // Default look: warm white keys, WASD a slightly deeper warm tone,
    // amber halo breathing between 50% and 100%.
    for (uint8_t i = 0; i < HC_LED_COUNT; i++) {
        s->color[i][0] = 255;
        s->color[i][1] = 200;
        s->color[i][2] = 140;
        s->zone_of[i]  = i < HC_KEY_LEDS ? 0 : 2;
    }
    static const uint8_t wasd[4] = {33, 47, 48, 49};
    for (uint8_t i = 0; i < 4; i++) {
        s->color[wasd[i]][0] = 255;
        s->color[wasd[i]][1] = 170;
        s->color[wasd[i]][2] = 70;
        s->zone_of[wasd[i]]  = 1;
    }
    for (uint8_t i = HC_KEY_LEDS; i < HC_LED_COUNT; i++) {
        s->color[i][0] = 255;
        s->color[i][1] = 100;
        s->color[i][2] = 16;
    }

    set_zone(&s->zones[0], HC_FX_STATIC, HC_SRC_MAP, 128, 0, 255);
    set_zone(&s->zones[1], HC_FX_STATIC, HC_SRC_MAP, 128, 0, 200);
    set_zone(&s->zones[2], HC_FX_BREATHE, HC_SRC_ZONE, 40, 128, 255);
    s->zones[2].axis     = HC_AXIS_NONE;
    s->zones[2].spread   = 0;
    s->zones[2].color[0] = 255;
    s->zones[2].color[1] = 100;
    s->zones[2].color[2] = 16;
    for (uint8_t i = 3; i < HC_ZONES; i++) set_zone(&s->zones[i], HC_FX_STATIC, HC_SRC_MAP, 128, 0, 255);

    static const uint8_t sunset[3][4] = {{0, 255, 60, 0}, {128, 255, 0, 90}, {255, 90, 0, 255}};
    static const uint8_t aurora[3][4] = {{0, 0, 255, 120}, {96, 0, 120, 255}, {192, 160, 0, 255}};
    static const uint8_t ember[3][4]  = {{0, 255, 40, 0}, {160, 255, 140, 0}, {255, 255, 220, 120}};
    static const uint8_t ocean[3][4]  = {{0, 0, 40, 255}, {128, 0, 200, 255}, {255, 0, 255, 160}};
    set_grad(&s->grad[0], 0, 3, sunset);
    set_grad(&s->grad[1], 1, 3, aurora);
    set_grad(&s->grad[2], 0, 3, ember);
    set_grad(&s->grad[3], 1, 3, ocean);

    memcpy(s->halo_xy, hc_default_halo_xy, sizeof(s->halo_xy));
    memcpy(s->halo_ring, hc_default_halo_ring, sizeof(s->halo_ring));
}

bool hc_scene_valid(const hc_scene_t *s) {
    if (s->magic != HC_MAGIC || s->version != HC_SCENE_VERSION) return false;
    for (uint8_t i = 0; i < HC_ZONES; i++) {
        if (s->zones[i].effect >= HC_FX_COUNT) return false;
        if (s->zones[i].source >= HC_SRC_COUNT) return false;
        if (s->zones[i].axis >= HC_AXIS_COUNT || s->zones[i].src_axis >= HC_AXIS_COUNT) return false;
    }
    for (uint8_t i = 0; i < HC_GRADIENTS; i++) {
        if (s->grad[i].count > HC_GRAD_STOPS) return false;
    }
    return true;
}

"""Halo Composer raw-HID protocol client (see firmware/keymap/composer/hc_protocol.h).

Transport-agnostic: anything with ``xfer(report: bytes) -> bytes`` (32 bytes in,
32 bytes out) works. tools/halo_kb.py plugs in the real keyboard (hidapi);
tests/protocol_test.py plugs in the fake keyboard (tests/host_device.c).
"""
import struct

CMD = 0xD0
REPORT = 32

INFO, SET_ACTIVE, SET_COLORS, GET_COLORS = 0x01, 0x02, 0x03, 0x04
SET_ZONE_MAP, GET_ZONE_MAP, SET_ZONE, GET_ZONE = 0x05, 0x06, 0x07, 0x08
SET_GRADIENT, GET_GRADIENT, SET_HALO_GEOM, GET_HALO_GEOM = 0x09, 0x0A, 0x0B, 0x0C
SET_SCENE_FLAGS, GET_SCENE_FLAGS = 0x0D, 0x0E
SAVE, RELOAD, DEFAULTS, IDENTIFY, SIM_KEY, GET_STATS = 0x10, 0x11, 0x12, 0x13, 0x14, 0x15

OK, E_ARG, E_UNKNOWN = 0, 1, 2

LED_COUNT, KEY_LEDS, HALO_LEDS, ZONES, GRADIENTS = 128, 83, 45, 8, 4
ZONE_BYTES, GRAD_BYTES = 20, 26
# hc_scene_t layout (packed, little-endian)
OFF_COLOR, OFF_ZONE_OF, OFF_ZONES, OFF_GRAD, OFF_HALO_XY, OFF_HALO_RING = 4, 388, 516, 676, 780, 870
SCENE_BYTES = 915


class ProtocolError(RuntimeError):
    def __init__(self, sub, status):
        super().__init__(f"sub-command 0x{sub:02X} returned status {status}")
        self.sub, self.status = sub, status


class NotComposer(RuntimeError):
    """The keyboard answered, but not with the Composer protocol (e.g. stock firmware)."""


class Composer:
    def __init__(self, transport):
        self.t = transport

    def raw(self, sub, args=()):
        """Send one request; return (status, payload bytes[3:32])."""
        pkt = bytes([CMD, sub, *args])
        if len(pkt) > REPORT:
            raise ValueError("request longer than 32 bytes")
        r = self.t.xfer(pkt + bytes(REPORT - len(pkt)))
        if r[0] == 0xFF:
            raise NotComposer("keyboard replied 'unhandled' to 0xD0: this firmware has no Halo Composer")
        if r[0] != CMD or r[1] != sub:
            raise RuntimeError(f"mismatched reply {bytes(r[:4]).hex()} to 0x{sub:02X}")
        return r[2], bytes(r[3:])

    def cmd(self, sub, args=()):
        status, payload = self.raw(sub, args)
        if status != OK:
            raise ProtocolError(sub, status)
        return payload

    # ---- high level
    def info(self):
        p = self.cmd(INFO)
        keys = ("proto", "leds", "key_leds", "halo_leds", "zones", "gradients", "stops", "fx_count",
                "active")
        d = dict(zip(keys, p[:9]))
        d["active"] = bool(d["active"])
        d["scene_size"] = p[9] | (p[10] << 8)
        d["scene_flags"], d["magic"], d["mode"], d["prev_mode"] = p[11], p[12], p[13], p[14]
        return d

    def stats(self):
        p = self.cmd(GET_STATS)
        frames = struct.unpack_from("<I", p, 0)[0]
        return {"frames": frames, "key_master": p[4], "halo_master": p[5], "halo_level": p[6],
                "power_on_sweep": bool(p[7])}

    def set_active(self, on):
        self.cmd(SET_ACTIVE, [1 if on else 0])

    def read_scene(self):
        """Read the RAM scene field by field and return it as the 915-byte image."""
        s = bytearray(SCENE_BYTES)
        s[0] = 0xC7
        s[1] = 1
        s[2] = self.cmd(GET_SCENE_FLAGS)[0]
        for start in range(0, LED_COUNT, 9):
            n = min(9, LED_COUNT - start)
            s[OFF_COLOR + start * 3:OFF_COLOR + (start + n) * 3] = self.cmd(GET_COLORS, [start, n])[:n * 3]
        for start in range(0, LED_COUNT, 28):
            n = min(28, LED_COUNT - start)
            s[OFF_ZONE_OF + start:OFF_ZONE_OF + start + n] = self.cmd(GET_ZONE_MAP, [start, n])[:n]
        for z in range(ZONES):
            s[OFF_ZONES + z * ZONE_BYTES:OFF_ZONES + (z + 1) * ZONE_BYTES] = self.cmd(GET_ZONE, [z])[:ZONE_BYTES]
        for g in range(GRADIENTS):
            s[OFF_GRAD + g * GRAD_BYTES:OFF_GRAD + (g + 1) * GRAD_BYTES] = self.cmd(GET_GRADIENT, [g])[:GRAD_BYTES]
        for start in range(0, HALO_LEDS, 9):
            n = min(9, HALO_LEDS - start)
            p = self.cmd(GET_HALO_GEOM, [start, n])
            for i in range(n):
                s[OFF_HALO_XY + (start + i) * 2] = p[i * 3]
                s[OFF_HALO_XY + (start + i) * 2 + 1] = p[i * 3 + 1]
                s[OFF_HALO_RING + start + i] = p[i * 3 + 2]
        return bytes(s)

    def write_scene(self, s):
        """Push a 915-byte scene image into RAM (not saved until save())."""
        assert len(s) == SCENE_BYTES
        for start in range(0, LED_COUNT, 9):
            n = min(9, LED_COUNT - start)
            self.cmd(SET_COLORS, [start, n, *s[OFF_COLOR + start * 3:OFF_COLOR + (start + n) * 3]])
        for start in range(0, LED_COUNT, 27):
            n = min(27, LED_COUNT - start)
            self.cmd(SET_ZONE_MAP, [start, n, *s[OFF_ZONE_OF + start:OFF_ZONE_OF + start + n]])
        for z in range(ZONES):
            self.cmd(SET_ZONE, [z, *s[OFF_ZONES + z * ZONE_BYTES:OFF_ZONES + (z + 1) * ZONE_BYTES]])
        for g in range(GRADIENTS):
            self.cmd(SET_GRADIENT, [g, *s[OFF_GRAD + g * GRAD_BYTES:OFF_GRAD + (g + 1) * GRAD_BYTES]])
        for start in range(0, HALO_LEDS, 9):
            n = min(9, HALO_LEDS - start)
            a = [start, n]
            for i in range(n):
                a += [s[OFF_HALO_XY + (start + i) * 2], s[OFF_HALO_XY + (start + i) * 2 + 1], s[OFF_HALO_RING + start + i]]
            self.cmd(SET_HALO_GEOM, a)
        self.cmd(SET_SCENE_FLAGS, [s[2]])

    def identify(self, led, rgb=(255, 255, 255), ms=1500):
        self.cmd(IDENTIFY, [led, *rgb, ms & 0xFF, ms >> 8])

    def identify_off(self):
        self.cmd(IDENTIFY, [0xFF, 0, 0, 0, 0, 0])

    def save(self):
        self.cmd(SAVE)

    def reload(self):
        self.cmd(RELOAD)

    def defaults(self):
        self.cmd(DEFAULTS)

    def sim_key(self, led):
        self.cmd(SIM_KEY, [led])

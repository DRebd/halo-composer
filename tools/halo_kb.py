#!/usr/bin/env python3
"""halo_kb.py - talk to a NuPhy Halo75 V2 over USB (VIA raw HID) from the command line.

Subcommands
  info      Print firmware/protocol details (read-only).
  backup    Save key layout, macros and lighting settings to a JSON file (read-only).

Only VIA "get" commands are sent by `info` and `backup`. The allow-list in
ReadOnlyVia.READ_ONLY_COMMANDS enforces that; anything else raises before it
reaches the keyboard.

Requires: pip install hidapi   (Windows/macOS/Linux; keyboard must be in wired/USB mode)
Close VIA and Halo Studio first: two programs on the raw-HID channel desync each other.
"""
import argparse
import datetime as _dt
import json
import sys
import time

try:
    import hid  # cython-hidapi
except ImportError:  # pragma: no cover
    sys.exit("hidapi is not installed. Run:  python -m pip install --user hidapi")

VID, PID = 0x19F5, 0x32F5          # NuPhy Halo75 V2 (ANSI, QMK)
RAW_USAGE_PAGE, RAW_USAGE = 0xFF60, 0x61
REPORT = 32
ROWS, COLS = 6, 17                  # matrix from NuPhy's VIA JSON

# VIA protocol command ids (quantum/via.h)
GET_PROTOCOL_VERSION = 0x01
GET_KEYBOARD_VALUE = 0x02
CUSTOM_GET_VALUE = 0x08
MACRO_GET_COUNT = 0x0C
MACRO_GET_BUFFER_SIZE = 0x0D
MACRO_GET_BUFFER = 0x0E
KEYMAP_GET_LAYER_COUNT = 0x11
KEYMAP_GET_BUFFER = 0x12
UNHANDLED = 0xFF

KBV_UPTIME, KBV_LAYOUT_OPTIONS, KBV_FIRMWARE_VERSION = 0x01, 0x02, 0x04
CH_RGBLIGHT, CH_RGB_MATRIX = 2, 3
RGBM_BRIGHTNESS, RGBM_EFFECT, RGBM_SPEED, RGBM_COLOR = 1, 2, 3, 4


class ViaError(RuntimeError):
    pass


def find_raw_hid_path():
    for d in hid.enumerate(VID, PID):
        if d["usage_page"] == RAW_USAGE_PAGE and d["usage"] == RAW_USAGE:
            return d["path"]
    raise ViaError("Halo75 V2 raw-HID interface not found. Is the keyboard plugged in by USB "
                   "with the mode switch on wired?")


class ReadOnlyVia:
    READ_ONLY_COMMANDS = {GET_PROTOCOL_VERSION, GET_KEYBOARD_VALUE, CUSTOM_GET_VALUE,
                          MACRO_GET_COUNT, MACRO_GET_BUFFER_SIZE, MACRO_GET_BUFFER,
                          KEYMAP_GET_LAYER_COUNT, KEYMAP_GET_BUFFER}

    def __init__(self, timeout_ms=500, retries=3):
        self.dev = hid.device()
        self.dev.open_path(find_raw_hid_path())
        self.timeout_ms = timeout_ms
        self.retries = retries

    def close(self):
        self.dev.close()

    def _drain(self):
        while self.dev.read(REPORT, 5):
            pass

    def xfer(self, payload, match=1):
        """Send one 32-byte report and return the matching 32-byte reply.

        `match` = how many leading bytes of the reply must echo the request
        (VIA echoes the command id, and for buffer reads the offset too)."""
        if payload[0] not in self.READ_ONLY_COMMANDS:
            raise ViaError(f"refusing to send non-read command 0x{payload[0]:02X}")
        pkt = bytes(payload) + bytes(REPORT - len(payload))
        for _ in range(self.retries):
            self._drain()
            self.dev.write(b"\x00" + pkt)  # leading 0 = report id
            deadline = time.monotonic() + self.timeout_ms / 1000
            while time.monotonic() < deadline:
                r = self.dev.read(REPORT, self.timeout_ms)
                if not r:
                    break
                if r[0] == UNHANDLED and payload[0] != UNHANDLED:
                    return None
                if list(r[:match]) == list(pkt[:match]):
                    return bytes(r)
                # stale/out-of-order reply (the VIA desync); keep reading
        raise ViaError(f"no matching reply to 0x{payload[0]:02X} (another app using the keyboard?)")

    # ---- VIA getters ----
    def protocol_version(self):
        r = self.xfer([GET_PROTOCOL_VERSION])
        return (r[1] << 8) | r[2]

    def keyboard_value(self, vid, n=4):
        r = self.xfer([GET_KEYBOARD_VALUE, vid], match=2)
        return None if r is None else r[2:2 + n]

    def layer_count(self):
        return self.xfer([KEYMAP_GET_LAYER_COUNT])[1]

    def keymap_bytes(self, layers):
        total = layers * ROWS * COLS * 2
        out = bytearray()
        off = 0
        while off < total:
            n = min(28, total - off)
            r = self.xfer([KEYMAP_GET_BUFFER, off >> 8, off & 0xFF, n], match=3)
            out += r[4:4 + n]
            off += n
        return bytes(out)

    def macro_info(self):
        count = self.xfer([MACRO_GET_COUNT])[1]
        r = self.xfer([MACRO_GET_BUFFER_SIZE])
        return count, (r[1] << 8) | r[2]

    def macro_bytes(self, size):
        out = bytearray()
        off = 0
        while off < size:
            n = min(28, size - off)
            r = self.xfer([MACRO_GET_BUFFER, off >> 8, off & 0xFF, n], match=3)
            out += r[4:4 + n]
            off += n
        return bytes(out)

    def custom_value(self, channel, value_id, n=3):
        r = self.xfer([CUSTOM_GET_VALUE, channel, value_id], match=3)
        return None if r is None else list(r[3:3 + n])


def keycodes_from(buf):
    return [(buf[i] << 8) | buf[i + 1] for i in range(0, len(buf), 2)]


def split_macros(buf, count):
    """VIA stores macros NUL-separated. Return up to `count` raw byte strings (hex)."""
    parts = bytes(buf).split(b"\x00")
    return [p.hex() for p in parts[:count]]


def gather(via):
    info = {"protocol_version": via.protocol_version()}
    up = via.keyboard_value(KBV_UPTIME)
    info["uptime_ms"] = int.from_bytes(up, "big") if up else None
    lo = via.keyboard_value(KBV_LAYOUT_OPTIONS)
    info["layout_options"] = int.from_bytes(lo, "big") if lo else None
    fw = via.keyboard_value(KBV_FIRMWARE_VERSION)
    info["via_firmware_version"] = int.from_bytes(fw, "big") if fw else None
    info["layer_count"] = via.layer_count()
    info["macro_count"], info["macro_buffer_size"] = via.macro_info()
    return info


def cmd_info(args):
    via = ReadOnlyVia()
    try:
        info = gather(via)
    finally:
        via.close()
    for k, v in info.items():
        print(f"{k:22} {v}")


def cmd_backup(args):
    via = ReadOnlyVia()
    try:
        info = gather(via)
        km = via.keymap_bytes(info["layer_count"])
        mb = via.macro_bytes(info["macro_buffer_size"])
        lighting = {}
        for name, vid, n in (("brightness", RGBM_BRIGHTNESS, 1), ("effect", RGBM_EFFECT, 1),
                             ("speed", RGBM_SPEED, 1), ("color_hs", RGBM_COLOR, 2)):
            lighting[name] = via.custom_value(CH_RGB_MATRIX, vid, n)
        # Second pass: re-read the keymap and compare, to catch a desynced/partial read.
        km2 = via.keymap_bytes(info["layer_count"])
    finally:
        via.close()
    if km != km2:
        sys.exit("Keymap changed between two reads - another program is talking to the keyboard. "
                 "Close VIA/Studio and retry.")
    kc = keycodes_from(km)
    per = ROWS * COLS
    doc = {
        "format": "halo-composer-backup/1",
        "created": _dt.datetime.now().astimezone().isoformat(timespec="seconds"),
        "device": {"vid": f"0x{VID:04X}", "pid": f"0x{PID:04X}", "rows": ROWS, "cols": COLS},
        "info": info,
        "rgb_matrix": lighting,
        "keymap_hex": km.hex(),
        "layers": [[f"0x{c:04X}" for c in kc[i * per:(i + 1) * per]] for i in range(info["layer_count"])],
        "macro_buffer_hex": mb.hex(),
        "macros_hex": split_macros(mb, info["macro_count"]),
    }
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=1)
    used = len(mb.rstrip(b"\x00"))
    print(f"Saved {args.out}: protocol {info['protocol_version']}, {info['layer_count']} layers, "
          f"{info['macro_count']} macro slots ({used} of {info['macro_buffer_size']} bytes used), "
          f"lighting {lighting}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("info", help="print firmware/protocol details (read-only)").set_defaults(fn=cmd_info)
    b = sub.add_parser("backup", help="save layout/macros/lighting to JSON (read-only)")
    b.add_argument("out", help="output .json path")
    b.set_defaults(fn=cmd_backup)
    args = ap.parse_args()
    try:
        args.fn(args)
    except ViaError as e:
        sys.exit(f"error: {e}")


if __name__ == "__main__":
    main()

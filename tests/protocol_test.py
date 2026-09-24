#!/usr/bin/env python3
"""Protocol tests for the Composer raw-HID interface.

The shared cases in ``tools/composer_checks.py`` run here against the fake
keyboard (tests/host_device.c = the real hc_qmk.c + hc_engine.c built for the
PC). A few more checks that need the fake's extra hooks (EEPROM image, frame
buffer) live below.

Usage: protocol_test.py <path to host_device binary>
"""
import pathlib
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "tools"))
import composer_checks  # noqa: E402
import halo_protocol as hp  # noqa: E402


class FakeKeyboard:
    """Line protocol to tests/host_device.c (see the comment at its top)."""

    def __init__(self, exe):
        self.p = subprocess.Popen([exe], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, bufsize=1)

    def _ask(self, line):
        self.p.stdin.write(line + "\n")
        self.p.stdin.flush()
        return self.p.stdout.readline().strip()

    def xfer(self, report):
        return bytes.fromhex(self._ask(bytes(report).hex()))

    def scene(self):
        return bytes.fromhex(self._ask("SCENE"))

    def eeprom(self):
        return bytes.fromhex(self._ask("EEPROM"))

    def frame(self, t):
        return bytes.fromhex(self._ask(f"FRAME {t}"))

    def key(self, row, col):
        assert self._ask(f"KEY {row} {col}") == "ok"

    def close(self):
        self.p.stdin.close()
        self.p.wait(5)


def main():
    kb = FakeKeyboard(sys.argv[1])
    c = hp.Composer(kb)
    results = composer_checks.run_all(c, destructive=True)

    def check(name, ok, detail=""):
        results.append((name, bool(ok), detail))

    # ---- checks only the fake can do
    c.defaults()
    check("read_scene() == firmware RAM image", c.read_scene() == kb.scene())
    c.save()
    check("SAVE: EEPROM image == RAM image", kb.eeprom() == kb.scene())

    # Default look: halo (zone 2) breathes amber between 50% and 100%.
    c.defaults()
    c.set_active(True)
    halo_led = 100
    vals = [kb.frame(t)[halo_led * 3] for t in range(0, 6000, 50)]
    check("default halo breathes 50%..100% (red channel 128..255)",
          min(vals) >= 126 and max(vals) >= 250 and min(vals) <= 132, f"min {min(vals)} max {max(vals)}")
    keys = kb.frame(1234)
    check("default keys are warm white (255,200,140)", tuple(keys[0:3]) == (255, 200, 140), keys[0:3].hex())
    check("default WASD is deeper warm (255,170,70) at 78%", tuple(keys[33 * 3:33 * 3 + 3]) == tuple(v * 201 >> 8 for v in (255, 170, 70)),
          keys[33 * 3:33 * 3 + 3].hex())

    # IDENTIFY: exactly one LED lit, everything else black, then it expires.
    kb.frame(1000)  # sets the fake's clock; IDENTIFY's timeout counts from here
    c.cmd(hp.IDENTIFY, [90, 1, 2, 3, 0x10, 0x00])  # 16 ms
    f = kb.frame(1000 + 5)  # host_device's timer starts at 1000
    lit = [i for i in range(128) if f[i * 3:i * 3 + 3] != b"\0\0\0"]
    check("IDENTIFY lights only the requested LED", lit == [90] and f[270:273] == bytes([1, 2, 3]), str(lit))
    f = kb.frame(1000 + 40)
    check("IDENTIFY expires after its duration", sum(1 for i in range(128) if f[i * 3:i * 3 + 3] != b"\0\0\0") > 1)

    # Reactive: a key press drives a flash overlay on that key.
    c.defaults()
    z = bytearray(c.cmd(hp.GET_ZONE, [0])[:hp.ZONE_BYTES])
    z[13] = 0xF1  # flash, slowest fade
    c.cmd(hp.SET_ZONE, [0, *z])
    before = kb.frame(50000)[16 * 3:16 * 3 + 3]
    kb.key(1, 0)  # ` key = LED 16
    after = kb.frame(50000)[16 * 3:16 * 3 + 3]
    check("key press flashes that key toward white", after[2] > before[2], f"{before.hex()} -> {after.hex()}")

    kb.close()
    fails = [r for r in results if not r[1]]
    for name, ok, detail in results:
        print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  ({detail})" if detail and not ok else ""))
    print(f"{len(results) - len(fails)}/{len(results)} protocol checks passed")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()

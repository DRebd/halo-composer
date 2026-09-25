#!/usr/bin/env python3
"""Protocol tests for the Composer raw-HID interface.

The shared cases in ``tools/composer_checks.py`` run here against the fake
keyboard (tests/host_device.c = the real hc_qmk.c + hc_engine.c built for the
PC). A few more checks that need the fake's extra hooks (EEPROM image, frame
buffer) live below.

Usage: protocol_test.py <path to host_device binary>
"""
import pathlib
import re
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "tools"))
import composer_checks  # noqa: E402
import halo_protocol as hp  # noqa: E402

_ENGINE = pathlib.Path(__file__).resolve().parent.parent / "firmware/keymap/composer/hc_engine.c"
GAMMA22 = [int(v) for v in re.search(r"gamma22\[256\] = \{([^}]*)\}", _ENGINE.read_text()).group(1).split(",") if v.strip()]
assert len(GAMMA22) == 256


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

    def via_resets(self):
        return int(self._ask("VIARESETS"))

    def corrupt_saved_scene(self):
        assert self._ask("EECORRUPT") == "ok"

    def reboot(self):
        assert self._ask("REBOOT") == "ok"

    def close(self):
        self.p.stdin.close()
        self.p.wait(5)


def main():
    kb = FakeKeyboard(sys.argv[1])
    c = hp.Composer(kb)
    first_boot_resets = kb.via_resets()
    results = composer_checks.run_all(c, destructive=True)

    def check(name, ok, detail=""):
        results.append((name, bool(ok), detail))

    # ---- EEPROM layout guard (hc_load at boot)
    check("first boot on blank EEPROM resets VIA keymap storage once", first_boot_resets == 1, str(first_boot_resets))
    c.save()
    kb.reboot()
    check("reboot with a valid saved scene keeps VIA keymaps", kb.via_resets() == 1, str(kb.via_resets()))
    kb.corrupt_saved_scene()
    kb.reboot()
    check("reboot after other firmware's EEPROM resets VIA keymaps", kb.via_resets() == 2, str(kb.via_resets()))
    check("...and loads + saves the default scene", kb.eeprom()[0] == 0xC7 and kb.eeprom() == kb.scene())
    c.cmd(hp.SET_COLORS, [0, 1, 1, 2, 3])
    kb.corrupt_saved_scene()
    c.reload()
    check("RELOAD of a bad saved scene never touches VIA keymaps", kb.via_resets() == 2, str(kb.via_resets()))

    # ---- checks only the fake can do
    c.defaults()
    check("read_scene() == firmware RAM image", c.read_scene() == kb.scene())
    c.save()
    check("SAVE: EEPROM image == RAM image", kb.eeprom() == kb.scene())

    # Default look (perceptual gamma on): 2700K keys, 2700K halo breathing 30%..100%.
    g = GAMMA22
    c.defaults()
    c.set_active(True)
    halo_led = 100
    vals = [kb.frame(t)[halo_led * 3] for t in range(0, 6000, 50)]
    check("default halo breathes 30%..100% (red channel gamma(77)..255)",
          g[74] <= min(vals) <= g[80] and max(vals) >= 250, f"min {min(vals)} max {max(vals)}")
    keys = kb.frame(1234)
    want = tuple(g[v] for v in (255, 167, 87))
    check("default keys are 2700K (255,167,87) through gamma", tuple(keys[0:3]) == want and tuple(keys[33 * 3:33 * 3 + 3]) == want,
          keys[0:3].hex() + " " + keys[33 * 3:33 * 3 + 3].hex())

    # IDENTIFY: exactly one LED lit, everything else black, then it expires.
    kb.frame(1000)  # sets the fake's clock; IDENTIFY's timeout counts from here
    c.cmd(hp.IDENTIFY, [90, 1, 2, 3, 0x10, 0x00])  # 16 ms
    f = kb.frame(1000 + 5)  # host_device's timer starts at 1000
    lit = [i for i in range(128) if f[i * 3:i * 3 + 3] != b"\0\0\0"]
    check("IDENTIFY lights only the requested LED", lit == [90] and f[270:273] == bytes([1, 2, 3]), str(lit))
    f = kb.frame(1000 + 40)
    check("IDENTIFY expires after its duration", sum(1 for i in range(128) if f[i * 3:i * 3 + 3] != b"\0\0\0") > 1)

    # Default reaction: the pressed key flashes mint for 560 ms; a mint ring spreads about two keys.
    c.defaults()
    base = kb.frame(50000)
    kb.key(1, 0)  # ` key = LED 16 at (22, 24); the hit is stamped at t = 50000
    f = kb.frame(50050)
    k16 = f[16 * 3:16 * 3 + 3]
    check("key press flashes that key toward mint", k16[0] < base[48] and k16[1] > base[49], f"{base[48:51].hex()} -> {k16.hex()}")
    f = kb.frame(50070)  # ring radius 12 units = the next key (1, LED 17)
    check("the ripple reaches the next key", f[17 * 3 + 1] > base[17 * 3 + 1] and f[17 * 3] < base[17 * 3],
          f"{base[51:54].hex()} -> {f[51:54].hex()}")
    far = [kb.frame(50000 + dt)[20 * 3:20 * 3 + 3] for dt in range(0, 700, 20)]  # 4 key (LED 20) is 4 keys away
    check("the ripple stops after about two keys", all(v == base[60:63] for v in far), "")
    f = kb.frame(50600)
    check("the flash is over after 560 ms", f[16 * 3:16 * 3 + 3] == base[16 * 3:16 * 3 + 3], f[48:51].hex())

    kb.close()
    fails = [r for r in results if not r[1]]
    for name, ok, detail in results:
        print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  ({detail})" if detail and not ok else ""))
    print(f"{len(results) - len(fails)}/{len(results)} protocol checks passed")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()

"""Protocol checks shared by the fake-keyboard tests and the real-keyboard self-test.

run_all(c) exercises every sub-command's happy path and argument checking. It
only changes the keyboard's RAM scene and restores it at the end, so it's safe
to run on real hardware: nothing is written to EEPROM unless destructive=True.
"""
import halo_protocol as hp


def run_all(c, destructive=False):
    results = []

    def check(name, ok, detail=""):
        results.append((name, bool(ok), detail))

    def status(sub, args=()):
        return c.raw(sub, args)[0]

    info = c.info()
    expect = {"proto": 1, "leds": 128, "key_leds": 83, "halo_leds": 45, "zones": 8, "gradients": 4,
              "stops": 6, "fx_count": 17, "scene_size": hp.SCENE_BYTES, "magic": 0xC7}
    bad = {k: (info.get(k), v) for k, v in expect.items() if info.get(k) != v}
    check("INFO reports the expected board/scene layout", not bad, str(bad))

    backup = c.read_scene()
    check("scene read-back has the right size", len(backup) == hp.SCENE_BYTES)
    try:
        check("unknown sub-command -> E_UNKNOWN", status(0x7F) == hp.E_UNKNOWN)

        pattern = bytes(range(1, 25))  # 8 LEDs x RGB
        c.cmd(hp.SET_COLORS, [120, 8, *pattern])
        check("SET/GET_COLORS round trip", c.cmd(hp.GET_COLORS, [120, 8])[:24] == pattern)
        check("SET_COLORS n=10 rejected", status(hp.SET_COLORS, [0, 10] + [0] * 27) == hp.E_ARG)
        check("SET_COLORS past LED 127 rejected", status(hp.SET_COLORS, [127, 2, 1, 2, 3, 4, 5, 6]) == hp.E_ARG)
        check("GET_COLORS start=128 rejected", status(hp.GET_COLORS, [128, 1]) == hp.E_ARG)

        c.cmd(hp.SET_ZONE_MAP, [100, 3, 0xFF, 0x01, 0x80])
        check("SET_ZONE_MAP masks to zone bits + no-react flag",
              c.cmd(hp.GET_ZONE_MAP, [100, 3])[:3] == bytes([0x87, 0x01, 0x80]))
        check("SET_ZONE_MAP n=28 rejected", status(hp.SET_ZONE_MAP, [0, 28] + [0] * 27) == hp.E_ARG)
        check("GET_ZONE_MAP n=28 allowed", status(hp.GET_ZONE_MAP, [100, 28]) == hp.OK)
        check("GET_ZONE_MAP n=29 rejected", status(hp.GET_ZONE_MAP, [0, 29]) == hp.E_ARG)

        z = bytearray(c.cmd(hp.GET_ZONE, [3])[:hp.ZONE_BYTES])
        z2 = bytearray(z)
        z2[0], z2[1], z2[2], z2[3] = 1, 200, 10, 250  # breathe, fast, 4%..98%
        c.cmd(hp.SET_ZONE, [3, *z2])
        check("SET/GET_ZONE round trip", c.cmd(hp.GET_ZONE, [3])[:hp.ZONE_BYTES] == bytes(z2))
        bad_fx = bytearray(z2)
        bad_fx[0] = 17
        check("SET_ZONE with effect 17 rejected", status(hp.SET_ZONE, [3, *bad_fx]) == hp.E_ARG)
        bad_grad = bytearray(z2)
        bad_grad[12] = 4
        check("SET_ZONE with gradient slot 4 rejected", status(hp.SET_ZONE, [3, *bad_grad]) == hp.E_ARG)
        check("rejected SET_ZONE leaves the zone unchanged", c.cmd(hp.GET_ZONE, [3])[:hp.ZONE_BYTES] == bytes(z2))
        check("SET_ZONE zone 8 rejected", status(hp.SET_ZONE, [8, *z2]) == hp.E_ARG)

        g = bytes([3, 1, 0, 255, 0, 0, 128, 0, 255, 0, 255, 0, 0, 255] + [0] * 12)
        c.cmd(hp.SET_GRADIENT, [2, *g])
        check("SET/GET_GRADIENT round trip", c.cmd(hp.GET_GRADIENT, [2])[:hp.GRAD_BYTES] == g)
        check("SET_GRADIENT with 7 stops rejected", status(hp.SET_GRADIENT, [2, 7] + [0] * 25) == hp.E_ARG)
        check("SET_GRADIENT slot 4 rejected", status(hp.SET_GRADIENT, [4, *g]) == hp.E_ARG)

        c.cmd(hp.SET_HALO_GEOM, [44, 1, 11, 22, 33])
        check("SET/GET_HALO_GEOM round trip", c.cmd(hp.GET_HALO_GEOM, [44, 1])[:3] == bytes([11, 22, 33]))
        check("SET_HALO_GEOM past LED 44 rejected", status(hp.SET_HALO_GEOM, [40, 6] + [0] * 18) == hp.E_ARG)

        c.cmd(hp.SET_SCENE_FLAGS, [0x03])
        check("SET/GET_SCENE_FLAGS round trip", c.cmd(hp.GET_SCENE_FLAGS)[0] == 0x03)

        check("SIM_KEY led 128 rejected", status(hp.SIM_KEY, [128]) == hp.E_ARG)
        check("SIM_KEY led 5 accepted", status(hp.SIM_KEY, [5]) == hp.OK)
        check("IDENTIFY cancel accepted", status(hp.IDENTIFY, [0xFF, 0, 0, 0, 0, 0]) == hp.OK)

        if destructive:
            c.defaults()
            d = c.read_scene()
            check("DEFAULTS gives a valid scene (magic, version)", d[0] == 0xC7 and d[1] == 1)
            c.save()
            c.cmd(hp.SET_COLORS, [0, 1, 9, 9, 9])
            c.reload()
            check("SAVE then RELOAD restores the saved scene", c.read_scene() == d)
    finally:
        c.write_scene(backup)
        c.identify_off()
    check("scene restored exactly after the checks", c.read_scene() == backup)
    return results

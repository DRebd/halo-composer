#!/usr/bin/env python3
"""Creates the VIA definition for the Composer firmware.

Takes ryodeushii's VIA definition for the Halo75 V2 and appends
"Composer (Halo Studio)" (RGB matrix mode 43) to the Effect dropdown, so VIA can
switch Composer on and off like any other effect. Also adds the Fn+Enter
"Composer On/Off" key to VIA's custom keys and fixes three mislabelled ones.

Usage: make_via_json.py --qmk <qmk_firmware tree> --out <file.json>
"""
import argparse
import json
import re
import pathlib

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("--qmk", required=True, help="path to the (pinned) qmk_firmware tree")
ap.add_argument("--out", required=True, help="output .json path")
args = ap.parse_args()

src = pathlib.Path(args.qmk) / "keyboards/nuphy/halo75v2/ansi/keymaps/default/NuPhy Halo75v2 via3.json"
d = json.loads(src.read_text(encoding="utf-8"))


def find(o):
    if isinstance(o, dict):
        if o.get("label") == "Effect" and o.get("type") == "dropdown":
            return o
        for v in o.values():
            r = find(v)
            if r:
                return r
    if isinstance(o, list):
        for v in o:
            r = find(v)
            if r:
                return r
    return None


fx = find(d["menus"])
# keymap.c asserts RGB_MATRIX_CUSTOM_composer == 43; the dropdown index must match.
assert fx["options"][-1] == "position_mode" and len(fx["options"]) == 43, "unexpected effect list; recheck mode numbering"
fx["options"].append("Composer (Halo Studio)")

# VIA labels custom keys by position: customKeycodes[i] is keycode QK_KB_0 + i, in
# the order of ryodeushii's enum custom_keycodes (keyboards/nuphy/common/core/keys.h).
keys_h = (pathlib.Path(args.qmk) / "keyboards/nuphy/common/core/keys.h").read_text(encoding="utf-8")
body = re.search(r"enum custom_keycodes\s*\{(.*?)\};", keys_h, re.S).group(1)
names = [re.match(r"\s*(\w+)", e).group(1) for e in re.sub(r"//[^\n]*", "", body).split(",") if e.strip()]
ck = d["customKeycodes"]
assert names[0] == "RF_DFU" and len(names) == len(ck) == 45, (len(names), len(ck))
# Upstream's JSON lists the last three labels in a different order from the enum
# (so VIA shows Fn+Ins as "Print Custom Firmware Version"). Put them in enum order.
by_title = {c["title"]: c for c in ck}
for i, n in enumerate(names):
    want = {"TOG_BAT_IND_NUM": "Toggle indicator numeric visual", "FW_VERSION": "Print Custom Firmware Version",
            "TOG_POWER_ON_ANIMATION": "Toggle Power On Animation"}.get(n)
    if want:
        ck[i] = by_title[want]
# keymap.c: enum { HC_TOGGLE = TOG_POWER_ON_ANIMATION + 1 };
assert names[-1] == "TOG_POWER_ON_ANIMATION", "HC_TOGGLE is no longer right after the last NuPhy keycode"
ck.append({"name": "Composer\nOn/Off", "title": "Jump to the Composer effect, or back to the previous effect"})
d["name"] = "NuPhy Halo75 V2 (Halo Composer)"
out = pathlib.Path(args.out)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(d, indent=2) + "\n", encoding="utf-8")
print("wrote", out)

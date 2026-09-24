#!/usr/bin/env python3
"""Creates the VIA definition for the Composer firmware.

Takes ryodeushii's VIA definition for the Halo75 V2 and appends
"Composer (Halo Studio)" (RGB matrix mode 43) to the Effect dropdown, so VIA can
switch Composer on and off like any other effect.

Usage: make_via_json.py --qmk <qmk_firmware tree> --out <file.json>
"""
import argparse
import json
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
d["name"] = "NuPhy Halo75 V2 (Halo Composer)"
out = pathlib.Path(args.out)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(d, indent=2) + "\n", encoding="utf-8")
print("wrote", out)

#!/usr/bin/env python3
"""Assembles Halo Studio into one self-contained HTML file.

Inlines geometry.json, hc_engine.js and studio_a..e.js into studio.tpl.html.

Usage: build_studio.py [--out DIR]     (default: <repo>/dist)
Writes DIR/halo-studio.html, plus DIR/halo-studio-preview.html, a variant for
hosts that block WebHID (e.g. sandboxed iframes). The preview can't connect.
"""
import argparse
import pathlib
import re

here = pathlib.Path(__file__).resolve().parent
ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("--out", default=str(here.parent / "dist"))
args = ap.parse_args()
out_dir = pathlib.Path(args.out)
out_dir.mkdir(parents=True, exist_ok=True)


def read(name):
    return (here / name).read_text(encoding="utf-8")


tpl = read("studio.tpl.html")
geom = "window.HC_GEOM = " + read("geometry.json").strip() + ";"
engine = read("hc_engine.js")
app = "".join(read(f"studio_{p}.js") for p in "abcde")
for name, val in (("GEOM", geom), ("ENGINE", engine), ("APP", app)):
    marker = f"/*__{name}__*/"
    assert marker in tpl, f"template is missing {marker}"
    tpl = tpl.replace(marker, val.replace("</script", "<\\/script"))
out = out_dir / "halo-studio.html"
out.write_text(tpl, encoding="utf-8", newline="\n")
print(out, len(tpl), "bytes")

# Preview variant: no document wrapper (the host adds its own) and USB disabled.
hosted = tpl
for pat in [r"<!doctype html>\s*", r"<html[^>]*>\s*", r"<head>\s*", r'<meta charset="utf-8">\s*',
            r'<meta name="viewport"[^>]*>\s*', r"</head>\s*", r"<body>\s*", r"</body>\s*", r"</html>\s*"]:
    hosted = re.sub(pat, "", hosted, count=1)
hosted = hosted.replace("<script>window.HC_GEOM", "<script>window.HALO_STUDIO_HOSTED = true;\nwindow.HC_GEOM", 1)
(out_dir / "halo-studio-preview.html").write_text(hosted, encoding="utf-8", newline="\n")
print("preview variant", len(hosted), "bytes")

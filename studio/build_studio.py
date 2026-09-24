#!/usr/bin/env python3
"""Assembles halo-studio.html (single file) from the template, engine, geometry and app sources."""
import pathlib, sys
here = pathlib.Path(__file__).parent
tpl = (here / 'studio.tpl.html').read_text()
geom = 'window.HC_GEOM = ' + (here / 'geometry.json').read_text().strip() + ';'
engine = (here / 'hc_engine.js').read_text()
app = ''.join((here / f'studio_{p}.js').read_text() for p in 'abcde')
for name, val in (('GEOM', geom), ('ENGINE', engine), ('APP', app)):
    assert f'/*__{name}__*/' in tpl
    tpl = tpl.replace(f'/*__{name}__*/', val.replace('</script', '<\\/script'))
out = here / 'halo-studio.html'
out.write_text(tpl)
print(out, len(tpl), 'bytes')

# Hosted preview variant (no document wrapper; the host adds its own skeleton)
import re
hosted = tpl
for pat in [r'<!doctype html>\s*', r'<html[^>]*>\s*', r'<head>\s*', r'<meta charset="utf-8">\s*', r'<meta name="viewport"[^>]*>\s*', r'</head>\s*', r'<body>\s*', r'</body>\s*', r'</html>\s*']:
    hosted = re.sub(pat, '', hosted, count=1)
hosted = hosted.replace('<script>window.HC_GEOM', '<script>window.HALO_STUDIO_HOSTED = true;\nwindow.HC_GEOM', 1)
(here / 'halo-studio-preview.html').write_text(hosted)
print('hosted variant', len(hosted))

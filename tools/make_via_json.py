#!/usr/bin/env python3
"""Creates ../halo75v2_composer_via3.json from ryodeushii's default VIA definition,
adding the "Composer (Halo Studio)" entry (RGB matrix mode 43) to the Effect dropdown."""
import json, pathlib
here = pathlib.Path(__file__).resolve().parent
src = here.parent.parent / 'default' / 'NuPhy Halo75v2 via3.json'
d = json.loads(src.read_text())

def find(o):
    if isinstance(o, dict):
        if o.get('label') == 'Effect' and o.get('type') == 'dropdown':
            return o
        for v in o.values():
            r = find(v)
            if r: return r
    if isinstance(o, list):
        for v in o:
            r = find(v)
            if r: return r

fx = find(d['menus'])
assert fx['options'][-1] == 'position_mode' and len(fx['options']) == 43, 'unexpected effect list; recheck mode numbering'
fx['options'].append('Composer (Halo Studio)')
d['name'] = 'NuPhy Halo75 V2 (Halo Composer)'
out = here.parent / 'halo75v2_composer_via3.json'
out.write_text(json.dumps(d, indent=2) + '\n')
print('wrote', out)

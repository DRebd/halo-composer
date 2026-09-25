#!/usr/bin/env python3
"""Generates Halo75 V2 LED geometry for Halo Composer (firmware C + GUI JSON).

Key positions come from keyboard.json (LAYOUT_ansi_84) mapped into QMK's
224x64 space. Halo positions were measured on a real keyboard with Halo Studio's
calibration wizard; ring order is derived from them (same maths as Studio).
"""
import json, sys, math

KEYS = [(0,'Esc',0,0,1),(1,'F1',1,0,1),(2,'F2',2,0,1),(3,'F3',3,0,1),(4,'F4',4,0,1),(5,'F5',5,0,1),(6,'F6',6,0,1),(7,'F7',7,0,1),(8,'F8',8,0,1),(9,'F9',9,0,1),(10,'F10',10,0,1),(11,'F11',11,0,1),(12,'F12',12,0,1),(13,'PrtSc',13,0,1),(14,'Del',15,0,1),(15,'Ins',14,0,1),
(16,'`',0,1,1),(17,'1',1,1,1),(18,'2',2,1,1),(19,'3',3,1,1),(20,'4',4,1,1),(21,'5',5,1,1),(22,'6',6,1,1),(23,'7',7,1,1),(24,'8',8,1,1),(25,'9',9,1,1),(26,'0',10,1,1),(27,'-',11,1,1),(28,'=',12,1,1),(29,'Bksp',13,1,2),(30,'Home',15,1,1),
(31,'Tab',0,2,1.5),(32,'Q',1.5,2,1),(33,'W',2.5,2,1),(34,'E',3.5,2,1),(35,'R',4.5,2,1),(36,'T',5.5,2,1),(37,'Y',6.5,2,1),(38,'U',7.5,2,1),(39,'I',8.5,2,1),(40,'O',9.5,2,1),(41,'P',10.5,2,1),(42,'[',11.5,2,1),(43,']',12.5,2,1),(44,'\\',13.5,2,1.5),(45,'End',15,2,1),
(46,'Caps',0,3,1.75),(47,'A',1.75,3,1),(48,'S',2.75,3,1),(49,'D',3.75,3,1),(50,'F',4.75,3,1),(51,'G',5.75,3,1),(52,'H',6.75,3,1),(53,'J',7.75,3,1),(54,'K',8.75,3,1),(55,'L',9.75,3,1),(56,';',10.75,3,1),(57,"'",11.75,3,1),(58,'Enter',12.75,3,2.25),(59,'PgUp',15,3,1),
(60,'Shift',0,4,2.25),(61,'Z',2.25,4,1),(62,'X',3.25,4,1),(63,'C',4.25,4,1),(64,'V',5.25,4,1),(65,'B',6.25,4,1),(66,'N',7.25,4,1),(67,'M',8.25,4,1),(68,',',9.25,4,1),(69,'.',10.25,4,1),(70,'/',11.25,4,1),(71,'Shift',12.25,4,1.75),(72,'Up',14,4,1),(73,'PgDn',15,4,1),
(74,'Ctrl',0,5,1.25),(75,'Opt',1.25,5,1.25),(76,'Cmd',2.5,5,1.25),(77,'Space',3.75,5,6.25),(78,'Cmd',10,5,1.25),(79,'Fn',11.25,5,1.25),(80,'Left',13,5,1),(81,'Down',14,5,1),(82,'Right',15,5,1)]
assert len(KEYS) == 83 and all(k[0]==i for i,k in enumerate(KEYS))

def key_xy(k):
    _, _, x, y, w = k
    return (round(16 + (x + w/2) * 12), round(12 + (y + 0.5) * 8))

key_xy_list = [key_xy(k) for k in KEYS]

# --- halo (indices 83..127). Positions MEASURED on a real Halo75 V2 with Halo
# Studio's calibration wizard (2026-09-25; LED 36 corrected by hand). The group
# names are the original inference from NuPhy's side.c and only label areas.
front = [125,126,127,92,91,90,89,88] + list(range(93,104))       # right -> left
left  = list(range(104,111))                                     # front -> back
status= list(range(83,88))                                       # top-left surface bar
back  = list(range(111,118))                                     # left -> right
badge = [118,119]                                                # top-right
right = list(range(120,125))                                     # back -> front
groups = {}
for name, leds in (('front', front), ('left', left), ('right', right), ('back', back), ('status', status), ('badge', badge)):
    for led in leds: groups[led] = name
assert sorted(groups) == list(range(83,128))

CALIBRATED = [  # halo LED 1..45 = index 83..127, engine coordinates (x 0..224, y 0..64)
    (16,5), (19,5), (22,5), (25,5), (28,5),                      # 1-5 status bar
    (169,53), (169,56), (169,59),                                # 6-8 short vertical strip
    None, None,                                                  # 9-10 not fitted
    (164,61), (149,61), (136,61), (126,61), (112,61), (100,61), (87,61), (74,61), (61,61), (49,61), (35,61), (20,61),
    (7,57), (7,48), (7,38), (7,27), (7,20),                      # 23-27 left side
    (40,9), (57,9), (76,9), (96,9), (115,9), (134,9), (150,9), (175,9), (169,9),
    (215,16), (215,26), (215,36), (215,44), (214,56),            # 37-41 right side
    (196,62), (184,62), (174,62),
    None,                                                        # 45 not fitted
]
assert len(CALIBRATED) == 45
# Halo LEDs that light nothing on this board (NuPhy's driver has channels for
# them but no LED is fitted). Studio hides and skips them; ring order ignores them.
ABSENT = [i for i, p in enumerate(CALIBRATED) if p is None]      # 0-based: 8, 9, 44

H = {}
for i, p in enumerate(CALIBRATED):
    if p is None:  # park on the nearest fitted neighbour so nothing looks odd if drawn
        j = next(k for d in range(1, 45) for k in (i - d, i + d) if 0 <= k < 45 and CALIBRATED[k] is not None)
        p = CALIBRATED[j]
    H[83 + i] = p


def ring_from_xy(xy, absent):
    """Perimeter coordinate per halo LED. Same maths as recomputeRing() in studio/studio_e.js."""
    live = [i for i in range(len(xy)) if i not in absent]
    xs = [xy[i][0] for i in live]; ys = [xy[i][1] for i in live]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    w, h = max(1, x1 - x0), max(1, y1 - y0)
    P, cy = 2 * (w + h), (y0 + y1) / 2
    out = [0] * len(xy)
    for i in range(len(xy)):
        x, y = xy[i]
        d = [x1 - x, y1 - y, x - x0, y - y0]  # right, bottom, left, top
        e = d.index(min(d))
        if e == 0: p = y - cy if y >= cy else P - (cy - y)
        elif e == 1: p = h / 2 + (x1 - x)
        elif e == 2: p = h / 2 + w + (y1 - y)
        else: p = h / 2 + w + h + (x - x0)
        out[i] = math.floor((p * 256) / P) & 255
    return out

halo_xy = [H[i] for i in range(83,128)]
halo_ring = ring_from_xy(halo_xy, ABSENT)

def c_arrays():
    out = []
    out.append('// GENERATED by tools/gen_geometry.py - do not edit by hand')
    out.append('#include "hc_engine.h"\n')
    out.append('const uint8_t hc_key_xy[HC_KEY_LEDS][2] = {')
    out.append('    ' + ', '.join('{%d, %d}' % p for p in key_xy_list))
    out.append('};\n')
    out.append('// Halo positions measured with the calibration wizard (see tools/gen_geometry.py).')
    out.append('const uint8_t hc_default_halo_xy[HC_HALO_LEDS][2] = {')
    out.append('    ' + ', '.join('{%d, %d}' % p for p in halo_xy))
    out.append('};\n')
    out.append('const uint8_t hc_default_halo_ring[HC_HALO_LEDS] = {')
    out.append('    ' + ', '.join(str(r) for r in halo_ring))
    out.append('};')
    return '\n'.join(out) + '\n'

def g_led_points():
    pts = key_xy_list + halo_xy
    return ', '.join('{%d, %d}' % p for p in pts)

if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'write'
    if what == 'write':
        here = __import__('pathlib').Path(__file__).resolve().parent
        (here.parent / 'firmware' / 'keymap' / 'composer' / 'hc_board_geometry.c').write_bytes(c_arrays().encode())
        (here.parent / 'studio' / 'geometry.json').write_text(json.dumps({
            'keys': [{'led': k[0], 'label': k[1], 'x': k[2], 'y': k[3], 'w': k[4], 'px': key_xy_list[k[0]][0], 'py': key_xy_list[k[0]][1]} for k in KEYS],
            'halo': [{'led': 83 + i, 'x': halo_xy[i][0], 'y': halo_xy[i][1], 'ring': halo_ring[i], 'group': groups[83+i], **({'absent': True} if i in ABSENT else {})} for i in range(45)],
        }, separators=(',', ':')) + '\n', newline='\n')
        print('wrote firmware/keymap/composer/hc_board_geometry.c and studio/geometry.json (keymap.c points: run with "points")')
    if what == 'c':
        print(c_arrays(), end='')
    elif what == 'points':
        print(g_led_points())
    elif what == 'json':
        print(json.dumps({
            'keys': [{'led': k[0], 'label': k[1], 'x': k[2], 'y': k[3], 'w': k[4], 'px': key_xy_list[k[0]][0], 'py': key_xy_list[k[0]][1]} for k in KEYS],
            'halo': [{'led': 83 + i, 'x': halo_xy[i][0], 'y': halo_xy[i][1], 'ring': halo_ring[i], 'group': groups[83+i], **({'absent': True} if i in ABSENT else {})} for i in range(45)],
        }, separators=(',', ':')))

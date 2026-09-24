#!/usr/bin/env bash
# Host-side verification for Halo Composer. Run from anywhere.
set -euo pipefail
cd "$(dirname "$0")"
OUT="${TMPDIR:-/tmp}/halo-composer-tests"; mkdir -p "$OUT"
echo "== 1. engine vectors (C) + JS parity"
cc -O2 -std=c11 -Wall -Wextra -I../composer host_vectors.c ../composer/hc_engine.c ../composer/hc_board_geometry.c -o "$OUT/host_vectors"
"$OUT/host_vectors" > "$OUT/vectors.json"
node parity_test.mjs "$OUT/vectors.json"
echo "== 2. fake keyboard (real hc_qmk.c protocol code on the host)"
cc -O1 -std=c11 -Wall -Wextra -Ihoststub -I../composer host_device.c ../composer/hc_qmk.c ../composer/hc_engine.c ../composer/hc_board_geometry.c -o "$OUT/host_device"
echo "== 3. build Halo Studio"
python3 ../studio/build_studio.py
if node -e "require('playwright')" 2>/dev/null; then
  echo "== 4. GUI <-> firmware protocol end-to-end"
  HOST_DEVICE="$OUT/host_device" node ../studio/e2e.js
else
  echo "(skipping step 4: npm i -D playwright && npx playwright install chromium)"
fi

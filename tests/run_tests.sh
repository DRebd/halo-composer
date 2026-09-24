#!/usr/bin/env bash
# Host-side verification for Halo Composer (no keyboard needed). Run from anywhere.
# Needs a C compiler (cc), Node.js and Python 3. Step 5 also needs Playwright +
# Chromium (npm ci && npx playwright install chromium); set REQUIRE_E2E=1 to make
# its absence an error instead of a skip.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FW="$ROOT/firmware/keymap/composer"
OUT="${TEST_OUT:-${TMPDIR:-/tmp}/halo-composer-tests}"
mkdir -p "$OUT"
cd "$ROOT/tests"

echo "== 1. engine compiles warning-free with strict flags"
cc -std=c11 -Wall -Wextra -Wconversion -Wshadow -Werror -c "$FW/hc_engine.c" -o "$OUT/hc_engine.o"

echo "== 2. engine vectors (C) + JS parity"
cc -O2 -std=c11 -Wall -Wextra -I"$FW" host_vectors.c "$FW/hc_engine.c" "$FW/hc_board_geometry.c" -o "$OUT/host_vectors"
"$OUT/host_vectors" > "$OUT/vectors.json"
node parity_test.mjs "$OUT/vectors.json"

echo "== 3. fake keyboard (the real hc_qmk.c protocol code, built for this PC)"
cc -O1 -std=c11 -Wall -Wextra -Werror -DHC_HOST_TEST -Ihoststub -I"$FW" host_device.c "$FW/hc_qmk.c" "$FW/hc_engine.c" "$FW/hc_board_geometry.c" -o "$OUT/host_device"
python3 protocol_test.py "$OUT/host_device"

echo "== 4. build Halo Studio"
python3 "$ROOT/studio/build_studio.py" --out "$ROOT/dist"

if (cd "$ROOT" && node -e "require('playwright')") 2>/dev/null; then
    echo "== 5. Studio GUI <-> firmware protocol, end to end"
    (cd "$ROOT" && HOST_DEVICE="$OUT/host_device" STUDIO_HTML="$ROOT/dist/halo-studio.html" node tests/e2e.js)
elif [ "${REQUIRE_E2E:-0}" = "1" ]; then
    echo "Playwright is not installed (npm ci && npx playwright install chromium)" >&2
    exit 1
else
    echo "(skipping step 5: npm ci && npx playwright install chromium)"
fi
echo "ALL HOST TESTS PASSED"

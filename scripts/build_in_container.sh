#!/usr/bin/env bash
# Builds the firmware inside QMK's build container.
#
#   /src  this repo (read-only)
#   /qmk  work area holding the pinned QMK tree (a Docker volume locally, a plain
#         directory in CI) so repeat builds are fast
#   /out  where the .bin files and the VIA JSON are written
#
# Usage: build_in_container.sh [via] [composer]    (default: both)
#   via       ryodeushii's unmodified VIA firmware (the known-good fallback)
#   composer  Halo Composer (our keymap + nuphy-shared.diff)
set -euo pipefail

SRC=${SRC:-/src}
WORK=${WORK:-/qmk}
OUT=${OUT:-/out}
# shellcheck disable=SC1091
source <(tr -d '\r' < "$SRC/firmware/base.env")
TREE="$WORK/qmk_firmware"
KM_DIR="keyboards/$KEYBOARD/keymaps/composer"
TARGETS=("${@:-via composer}")
read -r -a TARGETS <<< "${TARGETS[*]}"

git config --global --add safe.directory '*'
git config --global advice.detachedHead false

if [ ! -d "$TREE/.git" ]; then
    echo "== fetching $QMK_REPO @ $QMK_COMMIT (first run only)"
    git init -q "$TREE"
    git -C "$TREE" remote add origin "$QMK_REPO"
fi
if [ "$(git -C "$TREE" rev-parse -q --verify 'HEAD^{commit}' 2>/dev/null || true)" != "$QMK_COMMIT" ]; then
    git -C "$TREE" fetch -q --depth 1 origin "$QMK_COMMIT"
    git -C "$TREE" checkout -q -f FETCH_HEAD
fi
git -C "$TREE" submodule update -q --init --recursive --depth 1

# Start every build from the pristine pinned tree (keeps .build/ as a cache).
git -C "$TREE" reset -q --hard "$QMK_COMMIT"
git -C "$TREE" clean -q -f -d -e .build -e '*.bin' -e '*.hex'
rm -f "$TREE"/*.bin

mkdir -p "$OUT"
cd "$TREE"
for t in "${TARGETS[@]}"; do
    case "$t" in
        via)
            echo "== building $KEYBOARD:via (unmodified ryodeushii firmware)"
            make -j"$(nproc)" "$KEYBOARD:via"
            ;;
        composer)
            echo "== applying Halo Composer to the tree"
            rm -rf "$KM_DIR"
            cp -r "$SRC/firmware/keymap" "$KM_DIR"
            git apply --whitespace=nowarn "$SRC/firmware/patches/nuphy-shared.diff"
            echo "== building $KEYBOARD:composer"
            make -j"$(nproc)" "$KEYBOARD:composer"
            python3 "$SRC/tools/make_via_json.py" --qmk "$TREE" --out "$OUT/halo75v2_composer_via3.json"
            ;;
        *)
            echo "unknown target: $t" >&2
            exit 2
            ;;
    esac
    bin="${KEYBOARD//\//_}_$t.bin"
    cp "$bin" "$OUT/$bin"
    arm-none-eabi-size ".build/${KEYBOARD//\//_}_$t.elf" | tail -1 | awk -v n="$bin" '{printf "   %s: text+data %d bytes, bss %d bytes\n", n, $1+$2, $3}'
done
cp "$TREE/keyboards/$KEYBOARD/keymaps/default/NuPhy Halo75v2 via3.json" "$OUT/halo75v2_ryodeushii_via3.json"
( cd "$OUT" && sha256sum ./*.bin > SHA256SUMS.txt && cat SHA256SUMS.txt )

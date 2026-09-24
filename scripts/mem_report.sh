#!/usr/bin/env bash
# Prints flash/RAM use of the built firmware (run inside the QMK container after a build).
set -euo pipefail
cd "${WORK:-/qmk}/qmk_firmware/.build"
for k in "$@"; do
    elf="nuphy_halo75v2_ansi_$k.elf"
    [ -f "$elf" ] || continue
    echo "== $k"
    arm-none-eabi-size -A "$elf" | awk '$1 ~ /^\.(vectors|text|rodata|data|bss|ram0_init|ram0|heap|mstack|pstack|ARM\.exidx|init_array|xtors)/ {printf "   %-12s %6d bytes @ 0x%x\n", $1, $2, $3}'
    for s in __main_stack_size__ __process_stack_size__ __heap_base__ __heap_end__ __ram0_end__ __ram0_start__ __bss_end__; do
        v=$(arm-none-eabi-nm "$elf" | awk -v s="$s" '$3==s {print $1}')
        [ -n "$v" ] && printf "   %-24s 0x%s\n" "$s" "$v"
    done
    hb=$(arm-none-eabi-nm "$elf" | awk '$3=="__heap_base__" {print $1}')
    he=$(arm-none-eabi-nm "$elf" | awk '$3=="__heap_end__" {print $1}')
    [ -n "$hb" ] && [ -n "$he" ] && echo "   free heap (never used by QMK, headroom): $((16#$he - 16#$hb)) bytes"
done

#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
ROOT=$(readlink -f "$(dirname "$(readlink -f "$0")")/../../../.."); PROBES=$ROOT/tools/probes/review-1116  # night review 2026-11-16, installed by step 5
# author (night review 2026-11-16, REVIEW-1 item 3): what stock-plus-our-patches Giac does with ln(1/x), sqrt(1/x) for a
# free x and with a constant whose sign Giac knows, once host-cpu is free (checked in the same command). Output: smoke.out.
set -u  # no pipefail (the be hunt's 09:38 breach)
H=$(dirname "$(readlink -f "$0")")
L=$ROOT/tools/devlock.sh
export GIAC_OUT=${GIAC_OUT:-$ROOT/engine/giac/_out/gsl}
S=$PROBES/vg/smoke.mjs  # engine/giac/smoke.mjs reading GIAC_OUT (the vg hunt's copy)
for i in $(seq 1 2400); do
  $L status | grep -q '^host-cpu:' && { sleep 3; continue; } || {
    { echo "== engine $(date -r $GIAC_OUT/giac.wasm), run $(date +%T)"
      timeout 120 node "$S" 'ln(1/x)' 'sqrt(1/x)' 'ln(inv(x))' 'assume(x<0)' 'ln(1/x)' 'sqrt(1/x)' 'purge(x)' \
        'ln(1/(1-sqrt(2)))' 'sqrt(1/(pi-4))' 'is_positive(-(1-sqrt(2)))' 'is_positive(1-sqrt(2))' 'sign(1-sqrt(2))' \
        'sign(cos(2))' 'is_positive(-cos(2))' 'ln(1/2)' 'sqrt(1/4)' 'ln(1/(x^2+1))' 'sqrt(1/(x^2+1))'
      echo "exit $?"; } > "$H/smoke.out" 2>&1
    echo "done $(date +%T)"; exit 0
  }
done
echo "host-cpu held for 2 h: not run" > "$H/smoke.out"

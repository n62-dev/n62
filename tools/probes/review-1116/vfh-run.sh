#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
ROOT=$(readlink -f "$(dirname "$(readlink -f "$0")")/../../.."); PROBES=$ROOT/tools/probes/review-1116  # night review 2026-11-16, installed by step 5
# Night review 2026-11-16, verifier of fh: reruns, each command only when host-cpu is free, checked in the same command
# line right before it (retried every 5 s while held). Output: vfh-run.out beside this file.
set -u
N=$ROOT
R=$ROOT
P=$PROBES
OUT=$P/vfh-run.out
G=$N/engine/giac/_out/gsl
run() { # label, command...
  local label=$1; shift
  while :; do
    if "$N/tools/devlock.sh" status | grep -q '^host-cpu:'; then sleep 5; continue; fi
    { echo "=== $label $(date +%T)"; "$@" 2>&1; echo "=== exit $? $(date +%T)"; } >>"$OUT"
    break
  done
}
: >"$OUT"
echo "engine build: $(date -r $G/giac.wasm)" >>"$OUT"
run index env -C "$R" N62_DL_DIR=$N/engine/giac/_downloads N62_QALC_DL_DIR=$N/engine/qalc/_downloads timeout 120 node tools/find-index/generate.mjs --out "$P/vfh-index.json"
run find env -C "$R/app" timeout 120 npx tsx "$P/fh-find.ts" "$P/vfh-index.json" "kj/kg" "nm3/h" "s/m" "kg/s" "kn/m" "j/kgk" "w/mk" "mach" "m3/h" "btu/h" "w/m2k" "wh/kg" "lb/ft3" "lbm" "nmm" "dbv" "dbu" "mho" "metric horsepower" "standard atmosphere" "atm" "simultaneous equations" "solve numerically" "numerical integration" "trapezoid" "partial fractions" "unit vector" "dms" "degrees minutes seconds" "polar to rectangular" "rectangular to polar" "cylindrical" "spherical" "percent change" "hypotenuse" "linear system" "quadratic" "permutations" "polynomial" "exponential fit" "curve fit" "power fit" "logarithmic fit" "polynomial fit" "regression" "kJ/kg" "m^3/h" "Btu/h"
run apps env -C "$R/app" timeout 120 npx tsx "$P/fh-apps.ts"
run stored env -C "$R/app" GIAC_OUT=$G timeout 120 npx tsx "$P/fh-stored.mts"
run f1 env -C "$R/app" GIAC_OUT=$G timeout 120 npx tsx "$P/vfh-f1.mts"
run engine env -C "$R" GIAC_OUT=$G FACTS=1 timeout 120 node tools/probes/engine.ts 'exponential_regression([1,2,3,4],[2.7,7.4,20.1,54.6])' 'power_regression([1,2,3,4],[1,4.1,8.9,16.2])'
run units env -C "$R" GIAC_OUT=$G FIND_INDEX_JSON=$P/vfh-index.json ALTS=4 timeout 120 node tools/probes/unit-result.ts '500*{lbf}/(0.25*{in^2})'
run units2 env -C "$R" GIAC_OUT=$G FIND_INDEX_JSON=$P/vfh-index.json ALTS=3 timeout 120 node tools/probes/unit-result.ts '2000*{lbf / in^2}'
run units3 env -C "$R" GIAC_OUT=$G FIND_INDEX_JSON=$P/vfh-index.json ALTS=3 timeout 120 node tools/probes/unit-result.ts '100*{mi}/(2*{h})'
run units4 env -C "$R" GIAC_OUT=$G FIND_INDEX_JSON=$P/vfh-index.json ALTS=3 timeout 120 node tools/probes/unit-result.ts '100*{mi / h}'
run oracle $N/tests/golden/.venv/bin/python -I "$P/vfh-oracle.py"
echo "=== done $(date +%T)" >>"$OUT"

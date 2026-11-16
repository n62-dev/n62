#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
ROOT=$(readlink -f "$(dirname "$(readlink -f "$0")")/../../.."); PROBES=$ROOT/tools/probes/review-1116  # night review 2026-11-16, installed by step 5
# Night review 2026-11-16, fh: runs the hunt's probes, each one only while host-cpu is free (checked in the same
# command, right before it). Output: fh-run.out beside this file.
set -u
N=$ROOT
R=$ROOT
P=$PROBES
OUT=$P/fh-run.out
free() { ! "$N/tools/devlock.sh" status | grep -q '^host-cpu:'; }
guarded() { # label, command...
  local label=$1; shift
  until free; do sleep 2; done
  { echo "=== $label $(date +%T)"; "$@" 2>&1; echo "=== exit $? $(date +%T)"; } >>"$OUT"
}
: >"$OUT"
echo "engine build: $(date -r $N/engine/giac/_out/gsl/giac.wasm)" >>"$OUT"
guarded index env -C "$R" N62_DL_DIR=$N/engine/giac/_downloads N62_QALC_DL_DIR=$N/engine/qalc/_downloads timeout 120 node tools/find-index/generate.mjs --out "$P/fh-index.json"
guarded find env -C "$R/app" timeout 120 npx tsx "$P/fh-find.ts" "$P/fh-index.json"
guarded apps env -C "$R/app" timeout 120 npx tsx "$P/fh-apps.ts"
guarded engine env -C "$R" GIAC_OUT=$N/engine/giac/_out/gsl FACTS=1 timeout 120 node tools/probes/engine.ts \
  'round(2.675,2)' 'round(1.005,2)' 'round(-2.5)' 'round(2.5)' 'round(0.125,2)' \
  'exponential_regression([1,2,3,4],[2.7,7.4,20.1,54.6])' 'power_regression([1,2,3,4],[1,4.1,8.9,16.2])'
guarded units env -C "$R" GIAC_OUT=$N/engine/giac/_out/gsl FIND_INDEX_JSON=$P/fh-index.json ALTS=4 timeout 120 node tools/probes/unit-result.ts '500*{lbf}/(0.25*{in^2})'
echo "=== done $(date +%T)" >>"$OUT"

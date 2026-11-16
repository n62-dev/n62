#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
ROOT=$(readlink -f "$(dirname "$(readlink -f "$0")")/../../../.."); PROBES=$ROOT/tools/probes/review-1116  # night review 2026-11-16, installed by step 5
# vg hunter (night review 2026-11-16): CAS marks of vg-2 and Home at 30 digits; host-cpu checked in the same command as the run.
R=$ROOT
export GIAC_OUT=${GIAC_OUT:-$ROOT/engine/giac/_out/gsl}
L=$ROOT/tools/devlock.sh
D=$PROBES/vg
for i in $(seq 1 7200); do
  if $L status | grep -q '^host-cpu:'; then sleep 1; continue; fi
  {
    echo "== build: $(date -r $GIAC_OUT/giac.wasm)  run: $(date)"
    FACTS=1 MODE=cas timeout 240 node $R/tools/probes/engine.ts 'solve(x^3-3*x+2-10^-30=0,x)' 'size(solve(x^3-3*x+2-10^-30=0,x))' 'solve(x^3-3*x+2-10^-40=0,x)'
    DIGITS=30 FACTS=1 timeout 240 node $R/tools/probes/engine.ts 'solve(x^3-3*x+2-10^-30=0,x)' 'size(solve(x^3-3*x+2-10^-30=0,x))' '(1+exp(-100*pi))^(exp(100*pi))'
    FACTS=1 timeout 240 node $R/tools/probes/engine.ts 'size(solve(x^3-3*x+2-10^-30=0,x))' 'solve(x^3-x+10^-30=0,x)' '(1+exp(-50*pi))^(exp(50*pi))' 'exp(100*pi)*(exp(-100*pi)+1-1)'
    echo "== done $(date)"
  } > $D/run4.out 2>&1
  exit 0
done
echo "gave up $(date)" > $D/run4.out

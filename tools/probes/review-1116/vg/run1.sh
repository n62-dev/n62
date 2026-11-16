#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
ROOT=$(readlink -f "$(dirname "$(readlink -f "$0")")/../../../.."); PROBES=$ROOT/tools/probes/review-1116  # night review 2026-11-16, installed by step 5
# vg hunter (night review 2026-11-16): engine probes; each attempt checks host-cpu in the same command as the run.
R=$ROOT
export GIAC_OUT=${GIAC_OUT:-$ROOT/engine/giac/_out/gsl}
L=$ROOT/tools/devlock.sh
D=$PROBES/vg
for i in $(seq 1 7200); do
  if $L status | grep -q '^host-cpu:'; then sleep 1; continue; fi
  {
    echo "== build: $(date -r $GIAC_OUT/giac.wasm)  run: $(date)"
    echo "== Home"
    timeout 240 node $R/tools/probes/engine.ts '(1+exp(-100*pi))^(exp(100*pi))' '(1+exp(-1000*pi))^(exp(1000*pi))' '(1+1/cosh(300))^(cosh(300))' '(1+1/cosh(1000))^(cosh(1000))' 'ln(1+exp(-100*pi))*exp(100*pi)' '(1+exp(-sqrt(2)*100))^(exp(sqrt(2)*100))' '(1+exp(-300))^(exp(300))'
    echo "== raw"
    timeout 240 node $D/smoke.mjs 'simplify(sqrt(acosh(-1/2)^2))' 'solve(x^3-3*x+2-10^-30=0,x)' 'size(solve(x^3-3*x+2-10^-30=0,x))' 'csolve(x^3-3*x+2-10^-30=0,x)' 'solve(x^3-3*x^2+3*x-1-10^-24=0,x)' 'surd(-4,2)' 'surd(-16,4)' 'limit(iPart(x^2),x,-1,1)' 'limit(iPart(-x),x,0,1)' 'variance([[1.1,2],[1.1,3],[1.1,4]])' 'exp(-100*pi)'
    echo "== done $(date)"
  } > $D/run1.out 2>&1
  exit 0
done
echo "gave up $(date)" > $D/run1.out

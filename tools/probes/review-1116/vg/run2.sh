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
    FACTS=1 timeout 240 node $R/tools/probes/engine.ts '(1+exp(-100*pi))^(exp(100*pi))' 'ln(1+exp(-100*pi))*exp(100*pi)' '(1+1/cosh(300))^(cosh(300))' 'solve(x^3-3*x+2-10^-30=0,x)' 'solve(x^3-3*x+2-10^-26=0,x)' 'solve(x^3-3*x+2-10^-22=0,x)'
    DIGITS=30 FACTS=1 timeout 240 node $R/tools/probes/engine.ts 'solve(x^3-3*x+2-10^-30=0,x)' 'solve(x^3-3*x+2-10^-70=0,x)'
    MODE=cas timeout 240 node $R/tools/probes/engine.ts 'solve(x^3-3*x+2-10^-30=0,x)' 'csolve(x^3-3*x+2-10^-30=0,x)'
    timeout 120 node $D/smoke.mjs 'solve(x^3-3*x+2-10^-26=0,x)' 'solve(x^3-3*x+2-10^-25=0,x)' 'Digits:=30' 'solve(x^3-3*x+2-10^-30=0,x)' 'solve(x^3-3*x+2-10^-70=0,x)' 'realroot(x^3-3*x+2-10^-30,10^-15)'
    $ROOT/tests/golden/.venv/bin/python -I -c "from mpmath import mp,mpf,polyroots,exp,pi,log; mp.dps=60; print([polyroots([1,0,-3,2-mpf(10)**-k],maxsteps=200,extraprec=400) for k in (30,26,22)]); mp.dps=400; print((1+exp(-100*pi))**exp(100*pi), log(1+exp(-100*pi))*exp(100*pi))"
    echo "== done $(date)"
  } > $D/run2.out 2>&1
  exit 0
done
echo "gave up $(date)" > $D/run2.out

#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
ROOT=$(readlink -f "$(dirname "$(readlink -f "$0")")/../../../.."); PROBES=$ROOT/tools/probes/review-1116  # night review 2026-11-16, installed by step 5
# vg hunter (night review 2026-11-16): vg-2 beyond cubics (a quintic with two close real roots); host-cpu checked in the same command as the run.
R=$ROOT
export GIAC_OUT=${GIAC_OUT:-$ROOT/engine/giac/_out/gsl}
L=$ROOT/tools/devlock.sh
D=$PROBES/vg
for i in $(seq 1 7200); do
  if $L status | grep -q '^host-cpu:'; then sleep 1; continue; fi
  {
    echo "== build: $(date -r $GIAC_OUT/giac.wasm)  run: $(date)"
    timeout 120 node $D/smoke.mjs 'factor(x^5-5*x+4-10^-30)' 'solve(x^5-5*x+4-10^-30=0,x)' 'size(solve(x^5-5*x+4-10^-30=0,x))' 'solve(x^5-5*x+4-10^-20=0,x)'
    FACTS=1 timeout 120 node $R/tools/probes/engine.ts 'solve(x^5-5*x+4-10^-30=0,x)' 'size(solve(x^5-5*x+4-10^-30=0,x))'
    $ROOT/tests/golden/.venv/bin/python -I -c "from mpmath import mp,mpf,polyroots; mp.dps=60; print([r for r in polyroots([1,0,0,0,-5,4-mpf(10)**-30],maxsteps=400,extraprec=600) if abs(r.imag)<1e-40]); print([r for r in polyroots([1,0,0,0,-5,4-mpf(10)**-20],maxsteps=400,extraprec=600) if abs(r.imag)<1e-40])"
    echo "== done $(date)"
  } > $D/run5.out 2>&1
  exit 0
done
echo "gave up $(date)" > $D/run5.out

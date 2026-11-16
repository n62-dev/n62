#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
ROOT=$(readlink -f "$(dirname "$(readlink -f "$0")")/../../../.."); PROBES=$ROOT/tools/probes/review-1116  # night review 2026-11-16, installed by step 5
# vg hunter (night review 2026-11-16): unit-view probes; each attempt checks host-cpu in the same command as the run.
R=$ROOT
export GIAC_OUT=${GIAC_OUT:-$ROOT/engine/giac/_out/gsl}
export FIND_INDEX_JSON=$ROOT/app/src/find/_gen/find-index.json
L=$ROOT/tools/devlock.sh
D=$PROBES/vg
for i in $(seq 1 7200); do
  if $L status | grep -q '^host-cpu:'; then sleep 1; continue; fi
  {
    echo "== build: $(date -r $GIAC_OUT/giac.wasm)  index: $(date -r $FIND_INDEX_JSON)  run: $(date)"
    for c in '80*{oC}-5*{K}' '80*{oC}+5*{K}' '80*{oC}-20*{oC}' 'surd(-4*{m^2},2)' 'surd(-16*{m^4},4)' 'surd(-8*{m^3},3)' 'surd(pasupm(-4,0.1)*{m^2},2)'; do
      ALTS=0 timeout 120 node $R/tools/probes/unit-result.ts "$c" 2>&1 | head -12
    done
    FACTS=1 timeout 240 node $R/tools/probes/engine.ts 'approx(ln(1-tanh(50)))' '(1+ln(1+sin(1)^5000)^2)^(ln(1+sin(1)^5000)^(-2))' '1/(1-tanh(1000))' '1/(1-tanh(800))' 'ln(1-tanh(800))' '1/(1-tanh(300))'
    MODE=cas timeout 240 node $R/tools/probes/engine.ts 'ln((tanh(100)-1)^2)' 'evalf(ln((tanh(100)-1)^2))'
    $ROOT/tests/golden/.venv/bin/python -I -c "from mpmath import mp,tanh,log,mpf,sin,exp,pi; mp.dps=2000; print(mp.nstr(1/(1-tanh(800)),15), mp.nstr(log(1-tanh(800)),15), mp.nstr(1/(1-tanh(1000)),15), mp.nstr(1/(1-tanh(300)),15)); u=log(1+sin(1)**5000)**2; print(mp.nstr((1+u)**(1/u),15)); print(mp.nstr(log((tanh(100)-1)**2),15))"
    echo "== done $(date)"
  } > $D/run3.out 2>&1
  exit 0
done
echo "gave up $(date)" > $D/run3.out

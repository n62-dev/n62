#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Night review 2026-11-16: one rerun per S1 backlog line (the label as the argument). Prints what the app shows today.
#   tools/probes/review-1116/author/rerun.sh nr1116-be-4|nr1116-be-1|nr1116-vg-1|nr1116-vg-2|nr1116-vg-5|nr1116-bu-1
# GIAC_OUT: a built engine (default engine/giac/_out/gsl of the checkout). N62_ROOT: the checkout (default: four
# folders up, where step 5 installs this file). Heavy work takes no lock here; run it when host-cpu is free.
set -u
H=$(dirname "$(readlink -f "$0")")
ROOT=${N62_ROOT:-$(readlink -f "$H/../../../..")}
export GIAC_OUT=${GIAC_OUT:-$ROOT/engine/giac/_out/gsl}
E="$ROOT/tools/probes/engine.ts"
case ${1:-} in
  nr1116-be-4) # ln, log10, √ of 1/x on the cut; right: + imaginary parts (oracle: review-1116/be/oracle2.out)
    FACTS=1 node "$E" 'ln(1/(1-sqrt(2)))' 'sqrt(1/(pi-4))' 'sqrt(sec(2))' 'ln(sec(2))' 'log10(sec(2))'
    MODE=cas node "$E" 'ln(1/(1-sqrt(2)))' 'sqrt(sec(2))' ;;
  nr1116-be-1) # arg of a negative real; right: pi, 180
    FACTS=1 node "$E" 'arg((i*pi)^2)' 'arg(i*pi*i)' 'arg(ln(-1)^2)'
    ANGLE=deg FACTS=1 node "$E" 'arg(ln(i)^2)/pasdeg'
    MODE=cas node "$E" 'arg((i*pi)^2)' ;;
  nr1116-vg-1) # a tiny constant without an integer literal; right: e, e, e, 1
    FACTS=1 node "$E" '(1+exp(-100*pi))^(exp(100*pi))' '(1+1/cosh(300))^(cosh(300))' '(1+erfc(12))^(1/erfc(12))' 'ln(1+exp(-100*pi))*exp(100*pi)' ;;
  nr1116-vg-2) # two close real roots merged; right: three roots, size 3
    FACTS=1 node "$E" 'solve(x^3-3*x+2-10^-30=0,x)' 'size(solve(x^3-3*x+2-10^-30=0,x))' ;;
  nr1116-vg-5) # G358's left: CAS exact value with 2*pi*i too much, approx refused; right: -398.613705639, -99.3068528194
    MODE=cas node "$E" 'ln((tanh(100)-1)^2)'
    FACTS=1 node "$E" 'approx(ln(1-tanh(50)))' 'ln(1-tanh(800))' ;;
  nr1116-bu-1) # a fresh device's empty backup applied silently over a used device's history; right: offered
    env -C "$ROOT/app" npx vitest run --config "$H/vitest.config.mts" --silent=false silent-fresh ;;
  *) echo "usage: rerun.sh nr1116-be-4|nr1116-be-1|nr1116-vg-1|nr1116-vg-2|nr1116-vg-5|nr1116-bu-1" >&2; exit 2 ;;
esac

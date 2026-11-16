#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
ROOT=$(readlink -f "$(dirname "$(readlink -f "$0")")/../../../.."); PROBES=$ROOT/tools/probes/review-1116  # night review 2026-11-16, installed by step 5
# be hunt (night review 2026-11-16): every Home and unit-view input of the hunt, one engine load per group.
# Waits for host-cpu to be free and runs in the same command (the review's CPU guard). Output: batch-<group>.out here.
#   batch.sh [home|deg|digits30|units|unitsdeg]…  (no argument: all)
set -u  # no pipefail: grep -q closes the pipe early and devlock's SIGPIPE would read as "free" (it did, 09:38-09:40)
H=$(dirname "$(readlink -f "$0")")
L=$ROOT/tools/devlock.sh
run() { # group, then run.sh's arguments
  local g=$1; shift
  until ! $L status | grep -q '^host-cpu:'; do sleep 5; done
  $L status | grep -q '^host-cpu:' && { echo "host-cpu held: $g not run"; return; }
  "$@" > "$H/batch-$g.out" 2>&1; echo "$g done $(date +%T)"
}
HOME_IN=(
  'ln(acosh(-1/2)^2)' 'arg(acosh(-1/2)^2)' 'log10(acosh(-1/2)^2)' '(acosh(-1/2)^2)^(1/3)'
  'asin(acosh(-1/2)^2)' 'acos(acosh(-1/2)^2)' 'acosh(acosh(-1/2)^2)'
  'ln(acosh(1/2)^2)' 'ln(acos(5/4)^2)' 'arg(acos(5/4)^2)' 'sqrt(acos(5/4)^2)' 'sqrt(acosh(1/2)^2)'
  'linterp([0,141421356237309504/100000000000000000,3],[0,0,10^30],sqrt(2))'
  'sqrt(2)<=141421356237309504/100000000000000000'
  '(1-sin(1)^5000)^(sin(1)^(-5000))' '(1+tan(1)^(-5000))^(tan(1)^5000)' '(1+cos(1)^4000)^(cos(1)^(-4000))'
  '(1+sqrt(sin(1)^5000))^(sin(1)^(-2500))' '(1+exp(-1000))^exp(1000)' '(1+sin(1)^5000*pi)^(1/(pi*sin(1)^5000))'
  '1/(1-cos(sin(1)^200))' '(1+erfc(30))^(1/erfc(30))' '(1+exp(-exp(7)))^exp(exp(7))' '(1+1/cosh(1000))^cosh(1000)'
  '(1-cos(erfc(20)))/erfc(20)^2'
  'solve(x^3-3*x+2-10^-80=0,x)' 'solve(x^3-3*x-2+10^-80=0,x)' 'solve(x^3-5*x^2+7*x-3+10^-60=0,x)'
  'solve(x^4-2*x^2+1+10^-80=0,x)' 'solve(x^4-2*x^2+1-10^-80=0,x)'
  'covariance(approx([1/10,1/10,1/10]),approx([1/10,1/10,1/10]))'
  'variance(approx([10^8+1/10,10^8+2/10,10^8+3/10]))' 'stddevp(approx([10^8+1/10,10^8+2/10,10^8+3/10]))'
  'correlation(approx([1/10,2/10,3/10]),approx([1/10,2/10,3/10]))'
)
DEG_IN=('arg(acosh(-1/2)^2)' 'arg(acos(5/4)^2)' 'atan2(0,-1)' 'arg(-1)' 'asin(acosh(-1/2)^2)')
UNITS_IN=(
  '20*{oC}-10*{oC}' '20*{oC}-10*{oC} => K' '20*{oC}-10*{oC} => oF' '(20*{oC})-(10*{oC})'
  '68*{oF}-50*{oF}' '68*{oF}-50*{oF} => K' '-300*{oC}-10*{oC}' '1*{oC}-1*{oC}'
  'pasupm(20,0.5)*{oC}-pasupm(10,0.5)*{oC}' '20*{oC}-10*{K}' '300*{K}-10*{oC}'
  '5*{percent}*200*{m}' '1*{percent}+1' '1+1*{percent}' 'sqrt(4*{percent})' 'sqrt(4*{percent}) => percent'
  '50*{percent} => ppm' '2*{percent}^2' '10*{percent}*{m}/{m}' '5*{percent}/(2*{s})' '100*{ppm}*{percent}'
  'surd(-16*{m^4},4)' 'surd(8*{m^3},-3)' 'surd(27*{m^3},3)+1*{m}' 'surd(pasupm(8,0.1)*{m^3},3)' '(-8*{m^3})^(1/3)'
)
FACTS_IN=(
  'arg(acos(5/4)^2)' 'arg(acos(5/4))' 'arg(acosh(1/2)^2)' 'arg((pi/2+i*ln(2*i))^2)' 'arg(ln(i)^2)' 'arg(acos(3)^2)'
  'arg(asin(2)-pi/2)' 'arg((asin(2)-pi/2)^2)' 'angle(acos(5/4)^2)' 'abs(acos(5/4)^2)+acos(5/4)^2'
  '(1+tan(1)^(-5000))^(tan(1)^5000)' '(1+cos(1)^4000)^(cos(1)^(-4000))' '(1+erfc(30))^(1/erfc(30))'
  '(1+exp(-exp(7)))^exp(exp(7))' '(1+1/cosh(1000))^cosh(1000)' '(1-cos(erfc(20)))/erfc(20)^2'
  '(1-cos(erfc(10)))/erfc(10)^2' '(1+erfc(12))^(1/erfc(12))' '(1+1/cosh(100))^cosh(100)' '(1+1/cosh(60))^cosh(60)'
  'solve(x^3-3*x+2-10^-80=0,x)' 'size(solve(x^3-3*x+2-10^-80=0,x))' 'solve(x^3-3*x+2-10^-20=0,x)' 'size(solve(x^3-3*x+2-10^-20=0,x))'
)
MORE_IN=(
  '(tanh(100)-1)*exp(200)' '(tanh(60)-1)*exp(120)' '(cosh(100)-sinh(100))*exp(100)' '1/(cosh(100)-sinh(100))'
  'ln(1+erfc(12))/erfc(12)' '(exp(erfc(12))-1)/erfc(12)' 'ln(1+erfc(10))/erfc(10)' 'ln(1+1/cosh(200))*cosh(200)'
  'arg(i*ln(i))' 'arg(ln(i)*i)' 'arg(-ln(2)^2)' 'arg(sqrt(-2)^2)'
  'arg(ln(-1)^2)' 'arg(ln(i)^3*i)' 'arg(1/ln(i)^2)' 'arg(conj(ln(i))^2)'
)
want=${*:-home deg units}
for g in $want; do
  case $g in
    home) run home "$H/run.sh" home "${HOME_IN[@]}" ;;
    deg) run deg env ANGLE=deg "$H/run.sh" home "${DEG_IN[@]}" ;;
    facts) run facts env FACTS=1 "$H/run.sh" home "${FACTS_IN[@]}" ;;
    more) run more env FACTS=1 "$H/run.sh" home "${MORE_IN[@]}" ;;
    cas) run cas env MODE=cas FACTS=1 "$H/run.sh" home 'arg(ln(i)^2)' 'arg(acos(5/4)^2)' 'evalf(arg(ln(i)^2))' 'arg(ln(i)^2)-pi' ;;
    pasdeg) run pasdeg env ANGLE=deg FACTS=1 "$H/run.sh" home 'arg(ln(i)^2)/pasdeg' 'arg(-1)/pasdeg' 'arg(acos(5/4)^2)/pasdeg' ;;
    factsdeg) run factsdeg env ANGLE=deg FACTS=1 "$H/run.sh" home "${FACTS_IN[@]:0:10}" ;;
    units) [ -f "$H/find-index.json" ] || run index "$H/run.sh" index; run units "$H/run.sh" unit "${UNITS_IN[@]}" ;;
    atan) run atan env ANGLE=deg FACTS=1 "$H/run.sh" home 'atan2(0,-ln(2)^2)/pasdeg' 'atan2(sin(pi),-1)/pasdeg' 'arg(ln(-1)^2)/pasdeg' 'arg(i*ln(i))/pasdeg' 'linreg(approx([1,2,3]),approx([2,4,6.0000000000001]))' 'angle(ln(-1)^2)/pasdeg' ;;
    raw) run raw env MODE=raw "$H/run.sh" home 'evalf((1+erfc(12))^(1/erfc(12)),40)' 'evalf((1+erfc(12))^(1/erfc(12)),60)' 'evalf((1+erfc(12))^(1/erfc(12)),100)' 'evalf((1+1/cosh(1000))^cosh(1000),60)' 'evalf((1+1/cosh(1000))^cosh(1000),500)' 'arg(ln(-1)^2)' 'smod(pi,2*pi)' 'solve(x^3-3*x+2-10^-80=0,x)' 'proot([1,0,-3,2-10^-80])' ;;
    lninv) run lninv env FACTS=1 "$H/run.sh" home 'ln(1/(pi-4))' 'ln(1/(1-sqrt(2)))' 'ln(1/(1-e))' 'ln(1/ln(1/2))' 'ln(inv(pi-4))' 'ln(-1/(4-pi))' 'log10(1/(1-sqrt(2)))' 'ln(1/(1-sqrt(2)))+ln(1-sqrt(2))'
      run lninvcas env MODE=cas FACTS=1 "$H/run.sh" home 'ln(1/(1-sqrt(2)))' 'ln(1/(pi-4))' ;;
    sqrtinv) run sqrtinv env FACTS=1 "$H/run.sh" home 'sqrt(1/(pi-4))' 'sqrt(1/(1-sqrt(2)))' '(1/(1-sqrt(2)))^(1/3)' 'sqrt(1/ln(1/2))' '1/sqrt(pi-4)' 'atan(1/(sqrt(2)*i))' 'asin(1/(1-sqrt(2))*3)' ;;
    powinv) run powinv env FACTS=1 "$H/run.sh" home '(1/(1-sqrt(2)))^(1/2)' '(1/(1-sqrt(2)))^(3/2)' '(1/(pi-4))^0.5' 'surd(1/(1-sqrt(2)),2)' 'sqrt(-1/(sqrt(2)-1))' ;;
    prodneg) run prodneg env FACTS=1 "$H/run.sh" home 'sqrt((1-sqrt(2))*(1-sqrt(3)))' 'sqrt((pi-4)*(e-3))' 'ln((1-sqrt(2))*(1-sqrt(3)))' 'ln((pi-4)*(e-3))' '((1-sqrt(2))*(1-sqrt(3)))^(1/3)' 'sqrt((1-sqrt(2))/(1-sqrt(3)))' 'ln((1-sqrt(2))/(1-sqrt(3)))' 'sqrt((1-sqrt(2))^3)' 'ln(-(1-sqrt(2)))' 'sqrt(-(pi-4))' ;;
    *) echo "unknown group $g" ;;
  esac
done

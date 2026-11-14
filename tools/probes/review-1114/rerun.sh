#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# The 2026-11-14 review's S1 findings, one rerun each: tools/probes/review-1114/rerun.sh <label>. Run it from anywhere in
# a checkout with engine/giac/_out/gsl built (or GIAC_OUT set) and app/node_modules installed. Home lines go through the
# real EngineHost (vgO-run.mts: H: Home, C: CAS); vr-1 runs EntryController before its field (author/insert-order).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
home() { env -C "$root/app" npx tsx "$here/vgO-run.mts" "$@"; }
case "${1:-}" in
  vg-1) home 'H:[[1,2,3],[4,5,6]]*list[1,2,3]' 'C:[[1,2,3],[4,5,6]]*list[1,2,3]' ;;
  be-2) home 'H:L:=approx([1/10,1/10,1/10])' 'H:linreg(L,[1,2,3])' 'H:stats1(L)' 'H:variance(L)' ;;
  vr-1) env -C "$root/app" npx vitest run -c "$here/author/vitest.config.ts" --silent=false ;;
  be-3) home 'H:(1+sin(1)^5000)^(sin(1)^(-5000))' 'H:(1+ln(2)^500)^(ln(2)^(-500))' ;;
  vg-2) home 'H:solve(x^3-3*x+2+10^-80=0,x)' 'H:solve(x^3-3*x+2+10^-14=0,x)' ;;
  *) echo "usage: rerun.sh vg-1|be-2|vr-1|be-3|vg-2" >&2; exit 2 ;;
esac

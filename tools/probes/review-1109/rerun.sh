#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# The 2026-11-09 review's S1 findings, one rerun each: tools/probes/review-1109/rerun.sh <label>. Run it from the repo root
# with engine/giac/_out/gsl built (or GIAC_OUT set). bu-1 and bu-2 need app/node_modules (vitest with the app's plugins).
# The probes keep their sub-folders under this directory (bu/, be/, vbe/, ...).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
case "${1:-}" in
  bu-1) env -C "$root/app" npx vitest run -c "$here/bu/vitest.config.ts" route-queue ;;
  bu-2) env -C "$root/app" npx vitest run -c "$here/bu/vitest.config.ts" function-trace ;;
  bu-3) env -C "$root" node tools/probes/parse.ts '3{,}\frac{5^{2}}{2}' ;;
  bu-4) env -C "$root" node tools/probes/parse.ts 'g0' ;;
  be-1) env -C "$root" node tools/probes/engine.ts 'surd(sin(10^70),3)' ;;
  be-2) env -C "$root" node tools/probes/engine.ts '(1+1e-15*i)^(1/3)' ;;
  be-3) env -C "$root" node tools/probes/engine.ts '(1+exp(-200))^exp(200)' ;;
  be-4) env -C "$root" node tools/probes/parse.ts '\operatorname{arcsin}\left(0.5\right)'; env -C "$root/app" npx tsx "$here/vbe/libreal.mts" ;;
  be-5) env -C "$root" node tools/probes/engine.ts 'limit(round(x),x,1.5)' ;;
  *) echo "usage: rerun.sh bu-1|bu-2|bu-3|bu-4|be-1|be-2|be-3|be-4|be-5" >&2; exit 2 ;;
esac

#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Probe (G770, F470): Giac's interrupt checks of a nested definite integral in Home, the inner call written as
# int(f,y,0,3) (4 arguments) and as int(f,y=0..3). Home's budget is 518,000 (homeDefaults.ts HOME_BUDGET_STEPS): on an
# engine without patch 0055 the 4-argument form runs past it (1.7 million, 176 million) and Home says "Stopped: it took
# too long"; with it both forms are in the thousands. Each row of step-budget.ts is one input: its largest finished call's
# count, or the count the clock (0.3 s) stopped it at. Run: GIAC_OUT=<engine dir> tools/probes/d1-counts.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
: "${GIAC_OUT:?set GIAC_OUT to an engine directory (giac.mjs, giac.wasm)}"
node tools/probes/step-budget.ts \
  'int(int(x^2+y^2,y,0,3),x,0,2)' 'int(int(x^2+y^2,y=0..3),x,0,2)' \
  'int(int(int(x+y+z,z,0,3),y,0,2),x,0,1)' 'int(int(int(x+y+z,z=0..3),y=0..2),x,0,1)' \
  'int(int(1/(x+y),y,0,1),x,1,2)' 'int(int(1/(x+y),y=0..1),x,1,2)' \
  'int(int(x^2+y^2,y,0,x),x,0,2)' 'int(int(x^2+y^2,y=0..x),x,0,2)' 2>&1 | head -12

#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
ROOT=$(readlink -f "$(dirname "$(readlink -f "$0")")/../../.."); PROBES=$ROOT/tools/probes/review-1116  # night review 2026-11-16, installed by step 5
# Night review 2026-11-16, fh, second round: each probe only while host-cpu is free (checked in the same command,
# right before it). Output: fh-run2.out beside this file.
set -u
N=$ROOT
R=$ROOT
P=$PROBES
OUT=$P/fh-run2.out
free() { ! "$N/tools/devlock.sh" status | grep -q '^host-cpu:'; }
guarded() { # label, command...
  local label=$1; shift
  until free; do sleep 2; done
  { echo "=== $label $(date +%T)"; "$@" 2>&1; echo "=== exit $? $(date +%T)"; } >>"$OUT"
}
: >"$OUT"
echo "engine build: $(date -r $N/engine/giac/_out/gsl/giac.wasm)" >>"$OUT"
guarded stored env -C "$R/app" GIAC_OUT=$N/engine/giac/_out/gsl timeout 120 npx tsx "$P/fh-stored.mts"
guarded parse env -C "$R" timeout 60 node tools/probes/parse.ts 'F1(2.5)' 'F_{1}\left(2.5\right)'
guarded oracle $N/tests/golden/.venv/bin/python -I "$P/fh-fit-oracle.py"
echo "=== done $(date +%T)" >>"$OUT"

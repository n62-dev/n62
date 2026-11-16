#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
ROOT=$(readlink -f "$(dirname "$(readlink -f "$0")")/../../../.."); PROBES=$ROOT/tools/probes/review-1116  # night review 2026-11-16, installed by step 5
# be hunt (night review 2026-11-16): run one batch of inputs through the review worktree's real evaluators.
#   run.sh home  'input' …          Home (engine.ts), RAD; ANGLE=deg, DIGITS=n, MODE=cas pass through
#   run.sh unit  'input' ['end']    the unit view (unit-result.ts), with this hunt's Find index
#   run.sh index                    build the Find index of the review worktree into this folder
# Always behind the host-cpu guard of the review's common rules (the caller checks it in the same command).
set -eu
R=$ROOT
H=$(dirname "$(readlink -f "$0")")
export GIAC_OUT=${GIAC_OUT:-$ROOT/engine/giac/_out/gsl}
export FIND_INDEX_JSON=$H/find-index.json
export N62_DL_DIR=$ROOT/engine/giac/_downloads N62_QALC_DL_DIR=$ROOT/engine/qalc/_downloads
what=$1; shift
case $what in
  home) timeout 300 node "$R/tools/probes/engine.ts" "$@" ;;
  unit) timeout 300 node "$H/units-batch.ts" "$@" ;;
  index) timeout 300 node "$R/tools/find-index/generate.mjs" --out "$FIND_INDEX_JSON" ;;
  *) echo "usage: run.sh home|unit|index …" >&2; exit 2 ;;
esac

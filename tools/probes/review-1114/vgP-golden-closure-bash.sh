#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# vgP (night review 2026-11-14): pure-bash approximation of tools/golden-closure.mjs (no node needed): the relative value imports
# of each engine-stage entry (ENGINE_STAGES in scripts/pipeline-lib.sh) and of golden.ts, walked transitively; prints the modules
# GOLDEN_RE does not select. `import type` lines are skipped; a multi-line import clause is joined first.
# Usage: vgP-golden-closure-bash.sh <repo worktree>
R="$1"
RE="$(sed -n "s/^GOLDEN_RE='\(.*\)'$/\1/p" "$R/scripts/pipeline-lib.sh")"
declare -A seen=()
walk() {  # <repo path>
  local f="$1" d s p c
  [[ -n "${seen[$f]:-}" || ! -f "$R/$f" ]] && return 0
  seen[$f]=1; d="$(dirname "$f")"
  while IFS= read -r s; do
    p="$(realpath -m --relative-to="$R" "$R/$d/$s")"
    for c in "$p" "$p.ts" "$p/index.ts"; do [[ -f "$R/$c" && "$c" =~ \.[a-z]+$ ]] && { [[ "$c" =~ \.(yaml|json|css)$ ]] || walk "$c"; break; }; done
  done < <(tr '\n' ' ' < "$R/$f" | sed 's/;/;\n/g' | grep -E '^\s*(import|export)\b' | grep -vE '^\s*import\s+type\s' \
           | grep -oE "(from|import)\s*\(?\s*[\"'](\.[^\"']+)[\"']" | sed -E "s/.*[\"'](\.[^\"']+)[\"']/\1/")
}
for e in app/scripts/golden.ts app/scripts/sweep.ts app/scripts/seqsweep.ts app/scripts/casback.ts app/scripts/viewsweep.ts app/scripts/findcensus.ts; do walk "$e"; done
for f in "${!seen[@]}"; do grep -qE "$RE" <<<"$f" || echo "$f"; done | sort

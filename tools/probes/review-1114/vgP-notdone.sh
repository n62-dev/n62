#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# vgP (night review 2026-11-14): which worker replies does task_questioned (scripts/pipeline-lib.sh, A64/A131) count as "not done"?
# Usage: vgP-notdone.sh <repo worktree>. Pure bash + grep; sources only the regex lines of pipeline-lib.sh.
R="$1"
eval "$(grep -E '^(TASK_SUBJECT|TASK_GONE|TASK_QUESTION_RE|TASK_NOT_DONE_RE|TASK_NOT_DONE_LIST_RE)=' "$R/scripts/pipeline-lib.sh")"
eval "$(sed -n '/^open_question_lines() {/,/^}/p; /^task_question_line() {/,/^}/p' "$R/scripts/pipeline-lib.sh")"
t=$(mktemp)
while IFS= read -r reply; do
  printf '%s\n' "$reply" | sed 's/\\n/\n/g' > "$t"
  if task_question_line "$t" >/dev/null; then r="NOT DONE (run stops)"; else r="done (checks, audit, merge)"; fi
  printf '%-28s | %s\n' "$r" "$reply"
done <<'CASES'
Last commit abc1234, not done.
Last commit abc1234. Not done, out of time: the measurement data is in .tasks/951/a126-measure (27 of 30 shards).
Last commit abc1234\nNot done, the 4-hour limit: data in .tasks/x
Last commit abc1234\nDone or not done: not done, out of time: data in .tasks/x
Last commit abc1234\nStatus: not done (time): data in .tasks/x
Last commit abc1234\n- Not done, step 2: the rerun needs the owner
CASES
rm -f "$t"

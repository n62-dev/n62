#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# author (night review 2026-11-14, NEW-26): which reply forms the pipeline's two not-done patterns read
# (scripts/pipeline-lib.sh TASK_NOT_DONE_RE and TASK_NOT_DONE_LIST_RE, copied from 1f1a80582). Pure bash.
RE='(^[[:space:]*_-]*|[,;:.][[:space:]*_]*)not done[[:space:]*_]*([^:*a-z[:space:]_]|$)'
LRE='^[[:space:]*_-]*not done,[^:]*:'
for l in 'Last commit abc1234, not done. Data in .tasks/x.' 'Last commit abc1234, not done: data in .tasks/x' 'Not done, the 4-hour limit: data in .tasks/x' '- Not done, step 2: the e2e'; do
  printf 'NOTDONE=%s LIST=%s :: %s\n' "$(printf '%s\n' "$l" | grep -ciE "$RE")" "$(printf '%s\n' "$l" | grep -ciE "$LRE")" "$l"
done

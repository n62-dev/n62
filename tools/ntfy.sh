#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Ping the owner's phone through ntfy (owner, 2026-11-24): the protocol, when and how often, is in .claude/agents/coord.md
# "Calling the owner". The topic is a secret (anyone who knows it can read and post): it lives only in the main checkout's
# gitignored .coord/ntfy-topic (or N62_NTFY_TOPIC), never in the repo.
#   tools/ntfy.sh <decide|approve|stopped|done|info> "<title>" "<one line: what you need and where>"
# Kinds: decide and approve (the owner's word blocks work) and stopped (a lane or run stopped against plan) ring with high
# priority at any hour; done and info stay silent 22:00-07:00 (queued as low priority, no sound). Every ping logs one line
# in .coord/log.md. Exit: 0 sent, 1 not sent (no topic, network), 2 usage.
set -uo pipefail
if (( $# != 3 )); then echo "usage: tools/ntfy.sh <decide|approve|stopped|done|info> \"<title>\" \"<message>\"" >&2; exit 2; fi
kind="$1"; title="$2"; msg="$3"
coord="$(cd "$(dirname "$(git rev-parse --git-common-dir)")" && pwd)/.coord"
topic="${N62_NTFY_TOPIC:-$(cat "$coord/ntfy-topic" 2>/dev/null)}"
[[ -n "$topic" ]] || { echo "ntfy.sh: no topic (.coord/ntfy-topic or N62_NTFY_TOPIC)" >&2; exit 1; }
hour=$((10#$(date +%H)))
case "$kind" in
  decide)  prio=high;    tags=question ;;
  approve) prio=high;    tags=white_check_mark ;;
  stopped) prio=high;    tags=warning ;;
  done)    prio=default; tags=tada ;;
  info)    prio=low;     tags=information_source ;;
  *) echo "ntfy.sh: kind must be decide, approve, stopped, done or info" >&2; exit 2 ;;
esac
if [[ "$kind" == done || "$kind" == info ]] && (( hour >= 22 || hour < 7 )); then prio=min; fi
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -H "Title: N62: $title" -H "Priority: $prio" -H "Tags: $tags" \
  --data-binary "$msg" "https://ntfy.sh/$topic")"
if [[ "$code" == 200 ]]; then
  printf -- '- %s ntfy %s (%s): %s\n' "$(date +%H:%M)" "$kind" "$prio" "$title" >> "$coord/log.md"; exit 0
fi
echo "ntfy.sh: not sent (HTTP $code)" >&2; exit 1

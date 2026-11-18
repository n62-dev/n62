#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# scripts/pipeline-tokens.sh (A259): the helpers for claude -p's JSON replies, sourced by scripts/pipeline.sh and scripts/night.sh.

# A259: every claude -p runs with --output-format json (jq is on the host: tools/README.md). claude_unwrap <reply file> <role> <records file>
# turns the JSON in the reply file into the plain reply text (.result; the JSON moves to <file>.json) and appends one record per model
# to the records file: role, model, tokens in (input + cache read + cache creation), tokens out, cost in USD, tab separated. A reply that
# is not JSON (an old CLI, a crash, an empty file, no jq) stays as it is and gets the record `role<TAB>unknown`; never a failure. Callers
# read the reply file only after this (the limit text of an is_error result is the .result).
claude_unwrap() {
  local f="$1" role="$2" rec="$3"
  if [[ -s "$f" ]] && command -v jq >/dev/null 2>&1 && jq -e 'type == "object" and (has("result") or has("usage"))' "$f" >/dev/null 2>&1; then
    mv "$f" "$f.json"; jq -r '.result // ""' "$f.json" > "$f"
    jq -r --arg role "$role" '
      def n: (. // 0);
      if ((.modelUsage // {}) | length) > 0 then
        .modelUsage | to_entries[] | [$role, (.key | sub("^claude-"; "")), (.value.inputTokens | n) + (.value.cacheReadInputTokens | n) + (.value.cacheCreationInputTokens | n), (.value.outputTokens | n), (.value.costUSD | n)] | @tsv
      else
        [$role, "?", (.usage.input_tokens | n) + (.usage.cache_read_input_tokens | n) + (.usage.cache_creation_input_tokens | n), (.usage.output_tokens | n), (.total_cost_usd | n)] | @tsv
      end' "$f.json" >> "$rec" 2>/dev/null || printf '%s\tunknown\n' "$role" >> "$rec"
  else
    printf '%s\tunknown\n' "$role" >> "$rec"
  fi
  return 0
}
# tokens_summary <records file>: `tokens <in>k in, <out>k out, $<cost> (<role> <model> <k>k, ...)` (k = in + out per role and model, in the
# order of the first call; calls without counts: `, <n> unknown`) or `tokens: unknown` when no call gave counts; nothing without records.
tokens_summary() {
  [[ -s "$1" ]] || return 0
  LC_ALL=C awk -F'\t' '
    function k(x) { return int(x / 1000 + 0.5) }
    $2 == "unknown" { unk++; next }
    { i += $3; o += $4; c += $5; key = $1 " " $2; if (!(key in t)) ord[++m] = key; t[key] += $3 + $4 }
    END {
      if (m == 0) { print "tokens: unknown"; exit }
      s = ""; for (j = 1; j <= m; j++) s = s (j > 1 ? ", " : "") ord[j] " " k(t[ord[j]]) "k"
      if (unk) s = s ", " unk " unknown"
      printf "tokens %dk in, %dk out, $%.2f (%s)\n", k(i), k(o), c, s
    }' "$1"
}

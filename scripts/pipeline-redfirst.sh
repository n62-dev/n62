#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# scripts/pipeline-redfirst.sh: the red-first stage of scripts/pipeline.sh (A36, A67, A71, A150, A265): a package's new tests must fail on
# phase-1's code or on the stock engine build, so it holds red_first and what it needs (the stock engine build, the test-file counting).
# Sourced by scripts/pipeline.sh and scripts/pipeline.test.sh after scripts/pipeline-lib.sh, whose helpers it calls (own_sh, host_cpu_take,
# engine_stamp, engine_why); not by gc.sh, night.sh or the other tests. A274: moved out of pipeline-lib.sh unchanged.

# ---- A36: a regression test must fail on the old code ----
# red_first_wanted <package spec file>: succeeds when the package says its tests fail on phase-1 or on the stock build.
red_first_wanted() {
  grep -qiE '(fail|failing) on (phase-1|the stock (build|engine))' "$1" 2>/dev/null
}
# red_first_stock_wanted <package spec file> (A71): succeeds when the package says its tests fail on the stock build (G125: an earlier merge
# already fixed the bug, so the tests fail only on stock giac_2.1.0-1, not on phase-1). It wins when the file says both.
red_first_stock_wanted() {
  grep -qiE '(fail|failing) on the stock (build|engine)' "$1" 2>/dev/null
}
# ---- A71: the stock engine ----
# stock_engine_ensure <worktree holding the sources> <out root> <log>: <root>/stock-<key> exists with its stamp, built once by
# build-wasm.sh with GIAC_PATCHES=none (no patch applied); <key> comes from `build-wasm.sh stock-key` (the tarball's SHA-256, the
# script's hash and the files of wasm/). A finished build is reused. Sets stock_dir; on failure sets engine_why and returns 1. Main shell only (the build is a
# child session the pipeline owns, under host-cpu: a held lock is kept, like engine_build, A54). The build is 5 minutes and more.
stock_dir=""
stock_engine_ensure() {
  local src="$1" root="$2" log="$3" key dest tmp rc=0 took=0
  stock_dir=""; engine_why=""
  key="$("$src/engine/giac/build-wasm.sh" stock-key 2>/dev/null)" && [[ "$key" =~ ^[0-9a-f]+$ ]] || { engine_why="no stock key from $src/engine/giac/build-wasm.sh (no GIAC_PATCHES=none there?)"; return 1; }
  dest="$root/stock-$key"
  if [[ -f "$dest/giac.wasm" && "$(engine_stamp "$dest")" == "$key" ]]; then stock_dir="$dest"; return 0; fi
  [[ $host_cpu_held -eq 1 ]] || took=1
  host_cpu_take "engine-stock-$key" "stock engine $key:" || { engine_why="host-cpu lock busy"; return 1; }
  if [[ -f "$dest/giac.wasm" && "$(engine_stamp "$dest")" == "$key" ]]; then  # built by another run while this one waited
    [[ $took -eq 0 ]] || host_cpu_drop
    stock_dir="$dest"; return 0
  fi
  tmp="$root/.tmp-stock-$key.$$"; rm -rf "$tmp"; mkdir -p "$tmp"
  own_sh 'GIAC_PATCHES=none GIAC_BUILD_OUT="$1" GIAC_BUILD_DIR="$2" exec timeout -k 60 3600 "$3"' "$tmp" "$root/.build-stock-$key" "$src/engine/giac/build-wasm.sh" > "$log" 2>&1 < /dev/null || rc=1
  if [[ $rc -eq 0 && -f "$tmp/stock-$key/giac.wasm" ]]; then
    echo "$key" > "$tmp/stock-$key/.engine-key"
    rm -rf "$dest"; mv "$tmp/stock-$key" "$dest"
  else rc=1; fi
  rm -rf "$tmp" "$root/.build-stock-$key"
  [[ $took -eq 0 ]] || host_cpu_drop
  [[ $rc -eq 0 ]] || { engine_why="stock build-wasm.sh failed: $(tail -n 2 "$log" | tr '\n' ' ' | cut -c1-160)"; return 1; }
  stock_dir="$dest"
}
# red_first_stage <tests/golden/x.yaml>: the golden stage that reads the file (golden.ts); empty when none does.
red_first_stage() {
  case "$(basename "$1" .yaml)" in
    home|precision|solve|function|bench|units|parser) basename "$1" .yaml;;
  esac
}
# reads_engine <file text> (A71f2): succeeds when a vitest file can see which engine build it runs on: it names GIAC_OUT, or it imports
# nodeGiac (app/src/engine/nodeGiac.ts reads GIAC_OUT; 49 engine test files, host.test.ts among them, load the engine only through it).
reads_engine() {
  grep -qE 'GIAC_OUT|nodeGiac' <<<"$1"
}
# red_first_test_files <worktree> (A67): one "count<TAB>path", "edit<TAB>path" or "drop<TAB>path" line per app/**/*.test.ts the branch
# adds, changes or renames (the new path). count: its diff against phase-1 adds more test lines (it( or test(, .each/.only and the like
# too) or more assertion lines (expect(, expect.soft(, assert) than it takes away. edit: no net gain, but it adds at least one line that
# is not a comment or blank (an assertion edited in place: a tightened expected value, or R112's loosening; a new row of an it.each
# table or a for (const [...] of ...) list, the usual way to add a case here); red_first runs it and lets a red one satisfy the stage,
# and skips with a note when it passes. drop: it adds no such line (lines only removed, a pure rename): never run.
red_first_test_files() {
  git -C "$1" diff -M -U0 --diff-filter=AMR phase-1...HEAD -- '*.test.ts' | awk '
    function flush() { if (f ~ /^app\/.*\.test\.ts$/) print ((nt > 0 || na > 0) ? "count" : (ga > 0 ? "edit" : "drop")) "\t" f }
    /^diff --git / { flush(); f = ""; nt = 0; na = 0; ga = 0; hdr = 1; next }
    hdr && /^rename to / { f = substr($0, 11); next }
    hdr && /^\+\+\+ b\// { f = substr($0, 7); next }
    hdr && /^@@/ { hdr = 0 }
    hdr { next }
    /^[+-]/ {
      d = (substr($0, 1, 1) == "+") ? 1 : -1; l = substr($0, 2)
      if (l ~ /^[[:space:]]*(\/\/|\*|\/\*)/ || l !~ /[^[:space:]]/) next
      if (d > 0) ga++
      if (l ~ /(^|[^A-Za-z0-9_.$])(it|test)(\.[A-Za-z]+)*[[:space:]]*[(`]/) nt += d
      if (l ~ /(^|[^A-Za-z0-9_.$])(expect|assert)(\.[A-Za-z]+)*[[:space:]]*\(/) na += d
    }
    END { flush() }'
}
# red_first <worktree> <spec file> <phase-1 engine dir> <log> [<stock engine dir>]: for a package that says its tests fail on phase-1, runs the vitest files and
# golden cases the branch adds or changes on phase-1's code (a scratch worktree with those files laid over it). Its vitest and golden runs
# both get GIAC_OUT=<phase-1's engine dir> (A150: never the caller's). A package that says its
# tests fail on the stock build (A71) runs the golden cases, and the vitest files that read GIAC_OUT, on phase-1's code with GIAC_OUT
# set to the stock engine dir (stock_engine_ensure); no other vitest file runs, it would test phase-1's code, not the stock engine. The log's first line names the engine. Succeeds when the
# stage is skipped (also when the branch adds no vitest file or golden case) or at least one of them fails there; otherwise prints the reason on stdout and fails. N62_REDFIRST_VITEST
# (default "npx vitest run") is called with the files, N62_REDFIRST_GOLDEN (default "node scripts/golden.ts") with ONLY set.
red_first() {
  local wt="$1" spec="$2" eng="$3" log="$4" stock="${5:-}" f ids="" stages="" scratch rc red=0 ran=0 err="" stage
  local where="phase-1" label="phase-1" vitest_out="$eng"  # where: the words of the reason; vitest_out: GIAC_OUT of the vitest run (the engine of the claim; A150: never the caller's, which for an engine package is the branch's own build)
  red_first_wanted "$spec" || { echo "red-first: skipped (the package does not say its tests fail on phase-1 or on the stock build)" > "$log"; return 0; }
  if red_first_stock_wanted "$spec"; then
    where="the stock build"; label="stock"
    [[ -n "$stock" ]] || { echo "no stock engine (the package says its tests fail on the stock build; stock_engine_ensure gave none)"; return 1; }
    eng="$stock"; vitest_out="$stock"
  fi
  local -a files=() gfiles=()
  local -a dropped=() edits=() e2e=(); local kind
  while IFS=$'\t' read -r kind f; do  # A67: a file that adds no line (removals, a rename) is not run; one that edits in place runs
    case "$kind" in count) files+=("$f");; edit) edits+=("$f");; drop) dropped+=("$f");; esac
  done < <(red_first_test_files "$wt")
  local note=""; [[ ${#dropped[@]} -eq 0 ]] || note="red-first: not counted (adds no line but comments): ${dropped[*]}"
  if [[ $label == stock ]]; then  # only the files that read the engine can see the stock build
    local -a keep=(); for f in "${files[@]}"; do [[ -n "$f" ]] && reads_engine "$(git -C "$wt" show "HEAD:$f")" && keep+=("$f"); done
    files=("${keep[@]}")
    keep=(); for f in "${edits[@]}"; do [[ -n "$f" ]] && reads_engine "$(git -C "$wt" show "HEAD:$f")" && keep+=("$f"); done
    edits=("${keep[@]}")
  fi
  mapfile -t gfiles < <(git -C "$wt" diff --name-only --diff-filter=AMR phase-1...HEAD -- 'tests/golden/*.yaml' || true)
  for f in "${gfiles[@]}"; do
    [[ -n "$f" ]] || continue
    stage="$(red_first_stage "$f")"; [[ -n "$stage" ]] || continue  # corpus, g2, *-known and calls-baseline have no stage of their own
    ids+=" $(git -C "$wt" diff -U0 phase-1...HEAD -- "$f" | grep '^+' | grep -oE '\bid: *"?[A-Za-z0-9_.-]+' | sed -E 's/id: *"?//' | tr '\n' ' ')"
    case ",$stages," in *",$stage,"*) ;; *) stages+="${stages:+,}$stage";; esac
  done
  mapfile -t e2e < <(git -C "$wt" diff --name-only --diff-filter=AMR phase-1...HEAD -- 'app/test/*.spec.ts' tests/core/core.yaml || true)
  [[ ${#e2e[@]} -gt 0 && -n "${e2e[0]}" ]] || e2e=()
  if [[ ${#files[@]} -eq 0 && ${#edits[@]} -eq 0 && -z "${ids// /}" ]]; then
    { if [[ ${#e2e[@]} -gt 0 ]]; then echo "red-first: skipped (no new unit test; the package's red tests are e2e: ${e2e[*]}; e2e is not run on $where)"
      else echo "red-first: skipped (no new or changed golden case$([[ $label == stock ]] && echo ' or vitest file that reads GIAC_OUT' || echo ' or vitest file') that adds a line; e2e is not run on $where)"; fi
      [[ -z "$note" ]] || echo "$note"; } > "$log"
    return 0
  fi
  scratch="$(mktemp -d)"; rmdir "$scratch"
  git -C "$wt" worktree add -q --detach "$scratch" phase-1 >/dev/null 2>&1 || { echo "could not make a scratch worktree of phase-1"; return 1; }
  { echo "red-first: $label engine, GIAC_OUT=$eng (phase-1's code)"; [[ -z "$note" ]] || echo "$note"; } > "$log"
  for f in "${files[@]}" "${edits[@]}" "${gfiles[@]}"; do
    [[ -n "$f" ]] || continue
    mkdir -p "$scratch/$(dirname "$f")"; git -C "$wt" show "HEAD:$f" > "$scratch/$f"
  done
  [[ ! -d "$wt/app/node_modules" ]] || ln -sT "$wt/app/node_modules" "$scratch/app/node_modules"
  [[ ! -d "$wt/app/src/find/_gen" ]] || { mkdir -p "$scratch/app/src/find"; cp -a "$wt/app/src/find/_gen" "$scratch/app/src/find/"; }
  local -a vfiles=("${files[@]}" "${edits[@]}")  # the edited files run beside the counted ones; any red file satisfies the stage
  if [[ ${#vfiles[@]} -gt 0 ]]; then
    ran=1; rc=0
    own_sh 'cd "$1" && { [ -z "$3" ] || export GIAC_OUT="$3"; } && eval "$2"' "$scratch/app" "${N62_REDFIRST_VITEST:-FORCE_COLOR=0 NO_COLOR=1 timeout 600 npx vitest run} $(printf '%q ' "${vfiles[@]#app/}")" "$vitest_out" >> "$log" 2>&1 < /dev/null || rc=$?
    if [[ $rc -eq 0 ]]; then :
    elif [[ $rc -eq 124 ]]; then err="stage error: vitest timed out on $where"
    elif grep -qE '(Test Files|Tests) +[0-9]+ failed' "$log"; then red=1
    else err="stage error: vitest exit $rc on $where without failed tests (no test files, import or environment error?)"; fi
  fi
  if [[ -n "${ids// /}" && $red -eq 0 && -z "$err" ]]; then
    ran=1; rc=0
    own_sh 'cd "$1" && GIAC_OUT="$2" ONLY="$3" eval "$4"' "$scratch/app" "$eng" "$stages" "${N62_REDFIRST_GOLDEN:-timeout 900 node scripts/golden.ts}" >> "$log" 2>&1 < /dev/null || rc=$?
    if [[ $rc -eq 0 ]]; then :
    elif [[ $rc -eq 124 ]]; then err="stage error: golden timed out on $where"
    elif ! grep -q 'GOLDEN GATE FAILED' "$log"; then err="stage error: golden exit $rc on $where without GOLDEN GATE FAILED (engine or environment error?)"
    else  # red only when a detail line (two spaces, the stage, the id, a colon: golden.ts:218) names the id as a whole token; the FAIL summary line names no case
      local re
      for f in $ids; do
        re="$(sed 's/[][\.^$*+?(){}|\/-]/\\&/g' <<<"$f")"
        grep -qE "^  [A-Za-z0-9_-]+ ${re}:" "$log" && grep -q 'GOLDEN GATE FAILED' "$log" && red=1
      done
    fi
  fi
  rm -f "$scratch/app/node_modules"; git -C "$wt" worktree remove --force "$scratch" >/dev/null 2>&1 || rm -rf "$scratch"
  [[ -z "$err" ]] || { echo "$err"; return 1; }
  if [[ $red -eq 0 && ${#files[@]} -eq 0 && -z "${ids// /}" ]]; then  # only in-place edits, all green there (R112's loosening): skipped, named
    { echo "red-first: skipped (no new unit test; edited in place and passing on $where: ${edits[*]}$([[ ${#e2e[@]} -eq 0 ]] || echo "; the package's red tests are e2e: ${e2e[*]}"); e2e is not run on $where)"
      cat "$log"; } > "$log.tmp" && mv "$log.tmp" "$log"
    return 0
  fi
  [[ $red -eq 1 ]] || { echo "every new test passes on $where"; return 1; }
}

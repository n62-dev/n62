#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# scripts/pipeline-lib.sh: small helpers of scripts/pipeline.sh, sourced by it and by scripts/pipeline.test.sh (A17).

# audited_head_check <worktree> <branch> <audited sha>: succeeds when refs/heads/<branch> is the audited commit;
# otherwise prints why on stdout and fails. A worker that detached HEAD and committed there leaves the branch behind
# the commit the audit read (run 59 merged aa1fad5 while its audit had approved ee654cd).
audited_head_check() {
  local wt="$1" br="$2" sha="$3" tip
  tip="$(git -C "$wt" rev-parse -q --verify "refs/heads/$br^{commit}" 2>/dev/null || true)"
  [[ -n "$sha" ]] || { echo "no audited commit recorded"; return 1; }
  [[ -n "$tip" ]] || { echo "branch $br does not exist"; return 1; }
  [[ "$tip" == "$sha" ]] || { echo "branch $br is at ${tip:0:9}, the audit read ${sha:0:9}"; return 1; }
  return 0
}

# from_opus_pass <reply file>: the reply from its last OPUS PASS line on (a line before it breaks the brief's form;
# passes 20, 21, 24 and 27 began with one; pass 91's reply held three blocks, A85). A reply without that line is printed whole.
from_opus_pass() {
  if grep -q '^OPUS PASS' "$1"; then awk 'NR == FNR { if (/^OPUS PASS/) last = FNR; next } FNR >= last' "$1" "$1"; else cat "$1"; fi
}

# A121: what a claude exit at a usage limit says (the words of Claude Code 2.1.319 included); always read only when claude exited
# non-zero. Used by pipeline.sh (agents, pass, report) and night.sh (henri), with grep -iE.
LIMIT_RE='usage limit|rate limit|429|overloaded|You.ve (hit|reached) your|You.re out of (usage|extra)'

# A bare missing module ('vitest', '@capacitor/clipboard') is the machine's; a relative one ('./x.ts') is the worker's own import (A34).
MACHINE_RE="command not found|node_modules (is )?missing|Cannot find module '[^./']"
# machine_failure <check log>: succeeds when the log shows the machine, not the code, failed (A24, A34).
machine_failure() {
  grep -qE "$MACHINE_RE" "$1" 2>/dev/null
}

# node_modules_stale <app dir>: succeeds when node_modules lacks a non-optional package of package-lock.json (A34): the rule is
# that every such package is in node_modules/.package-lock.json.
node_modules_stale() {
  node -e '
    const fs = require("fs"), d = process.argv[1];
    let want, have;
    try { want = JSON.parse(fs.readFileSync(d + "/package-lock.json", "utf8")).packages; have = JSON.parse(fs.readFileSync(d + "/node_modules/.package-lock.json", "utf8")).packages; } catch { process.exit(0); }
    for (const [k, v] of Object.entries(want)) {
      if (!k.startsWith("node_modules/") || v.optional || v.link) continue;
      if (!(k in have)) process.exit(0);
      let got; try { got = JSON.parse(fs.readFileSync(d + "/" + k + "/package.json", "utf8")).version; } catch { process.exit(0); }
      if (v.version && got !== v.version) process.exit(0);
    }
    process.exit(1);' "$1"
}

# integ_clean <phase-1 worktree>: succeeds when nothing is staged or changed in it (untracked files do not count) (A24).
integ_clean() {
  [[ -z "$(git -C "$1" status --porcelain --untracked-files=no)" ]]
}

# merge_failure_reason <phase-1 worktree> <merge log>: "conflict" only when git lists unmerged files, else the log's last line (A24).
merge_failure_reason() {
  if [[ -n "$(git -C "$1" diff --name-only --diff-filter=U)" ]]; then echo conflict
  else echo "merge failed: $(tail -n 1 "$2" | cut -c1-200)"; fi
}

# ---- A124: free fix rounds ----
# docs_size_only <failure file>: succeeds when the file's "## <check> failed" headings are all docs or size, and there is one (a lint,
# typecheck, vitest, e2e, golden, red-first or shell failure in it makes the round an ordinary one).
docs_size_only() {
  local h; h="$(grep -E '^## [a-z0-9]+ failed' "$1" 2>/dev/null | awk '{ print $2 }' | sort -u || true)"
  [[ -n "$h" ]] && ! grep -qvxE 'docs|size' <<<"$h"
}
# round_free <failure file> <audit asked for fixes: 0|1> <free rounds used>: succeeds when this fix round is free: the only failures are
# docs or size, the audit asked for nothing, and fewer than two free rounds were used (a run has at most two; then it counts as any).
round_free() {
  [[ "$2" -eq 0 && "$3" -lt 2 ]] && docs_size_only "$1"
}

# ---- A69: Claude's scratch folders ----
# Claude Code keeps a scratch folder per working directory in <tmp>/claude-<uid>/<the path, / and . written as ->; a gorge run leaves about
# 560 MB in it when its worktree is removed. claude_tmp_dir: the user's own root (N62_CLAUDE_TMP for tests).
claude_tmp_dir() { echo "${N62_CLAUDE_TMP:-/tmp/claude-$(id -u)}"; }
# claude_scratch_name <worktree path>: the folder's name.
claude_scratch_name() { local p="$1"; echo "${p//[\/.]/-}"; }
# claude_scratch_remove <worktree path>: removes the one folder named for that path; an empty or root path removes nothing.
claude_scratch_remove() {
  local name root; name="$(claude_scratch_name "${1:-}")"; root="$(claude_tmp_dir)"
  [[ "$name" =~ [^-] ]] || return 0
  [[ -d "$root/$name" ]] && rm -rf "${root:?}/$name"
  return 0
}

# stray_list <main checkout>: A88: the top level of the main checkout's parent and of its .claude/worktrees/, sorted, one path a
# line, without the worktrees git knows (a run's own are not strays). Never fails.
stray_list() {
  local main="$1" wtd w known="" parent
  wtd="$main/.claude/worktrees"; parent="$(dirname "$main")"
  {
    find "$parent" -mindepth 1 -maxdepth 1 2>/dev/null
    if [[ -d "$wtd" ]]; then
      wtd="$(cd "$wtd" && pwd -P)"
      while IFS= read -r w; do [[ "$(dirname "$w")" != "$wtd" ]] || known+="$w"$'\n'; done < <(git -C "$main" worktree list --porcelain 2>/dev/null | sed -n 's/^worktree //p')
      find "$main/.claude/worktrees" -mindepth 1 -maxdepth 1 2>/dev/null | while IFS= read -r w; do
        grep -qxF "$wtd/$(basename "$w")" <<<"$known" || echo "$w"
      done
    fi
  } | LC_ALL=C sort
  return 0
}

# ---- engine builds (A28) ----
# engine_key <git dir> <rev>: a hash of the engine's inputs at <rev> (build-wasm.sh, patches/ without its README, wasm/), from the
# blob ids in the tree, so it needs no checkout and takes milliseconds.
engine_key() {
  git -C "$1" ls-tree -r "$2" -- engine/giac/build-wasm.sh engine/giac/patches engine/giac/wasm 2>/dev/null | { grep -v 'patches/README.md' || true; } | sha256sum | cut -c1-16
}
# engine_stamp <engine dir>: the key an engine directory was built from (empty when unstamped).
engine_stamp() { cat "$1/.engine-key" 2>/dev/null || true; }
engine_sha() { sha256sum "$1/giac.wasm" 2>/dev/null | cut -c1-16; }
# engine_build <worktree holding the sources> <key> <out root> <log>: builds once per key into <root>/key-<key> under the
# host-cpu lock; a finished build with the right stamp is reused, and the stamp is read again once the lock is held, so two
# runs that want one key build it once (A47a). A54: runs in the main shell (never in $( ): the traps and the registry of own_sh are
# lost there); the build is a child session the pipeline owns, the lock is host_cpu_take/host_cpu_drop (a held host-cpu is kept).
# On failure it sets engine_why (the build log's tail, or the lock text) and returns 1; it prints nothing.
engine_why=""
engine_build() {
  local src="$1" key="$2" root="$3" log="$4" dest tmp rc=0 took=0
  dest="$root/key-$key"; engine_why=""
  if [[ -f "$dest/giac.wasm" && "$(engine_stamp "$dest")" == "$key" ]]; then return 0; fi
  [[ $host_cpu_held -eq 1 ]] || took=1
  host_cpu_take "engine-$key" "engine $key:" || { engine_why="host-cpu lock busy"; return 1; }
  if [[ -f "$dest/giac.wasm" && "$(engine_stamp "$dest")" == "$key" ]]; then  # built by another run while this one waited
    [[ $took -eq 0 ]] || host_cpu_drop
    return 0
  fi
  tmp="$root/.tmp-$key.$$"; rm -rf "$tmp"; mkdir -p "$tmp"
  own_sh 'GIAC_BUILD_OUT="$1" GIAC_BUILD_DIR="$2" exec timeout -k 60 3600 "$3"' "$tmp" "$root/.build-$key" "$src/engine/giac/build-wasm.sh" > "$log" 2>&1 < /dev/null || rc=1
  if [[ $rc -eq 0 && -f "$tmp/gsl/giac.wasm" ]]; then
    echo "$key" > "$tmp/gsl/.engine-key"
    rm -rf "$dest"; mv "$tmp/gsl" "$dest"
  else rc=1; fi
  rm -rf "$tmp" "$root/.build-$key"
  [[ $took -eq 0 ]] || host_cpu_drop
  [[ $rc -eq 0 ]] || { engine_why="build-wasm.sh failed: $(tail -n 2 "$log" | tr '\n' ' ' | cut -c1-160)"; return 1; }
}
# engine_ensure <worktree holding the sources> <key> <out root> <log>: <root>/key-<key> exists with its stamp (A47a: the pipeline's
# GIAC_OUT is always such an immutable directory, never gsl). A gsl stamped with the key is copied (a gsl swapped during the copy is
# noticed by its stamp and the copy dropped); otherwise engine_build builds it (failure text in engine_why; main shell only).
engine_ensure() {
  local src="$1" key="$2" root="$3" log="$4" dest tmp
  dest="$root/key-$key"
  if [[ -f "$dest/giac.wasm" && "$(engine_stamp "$dest")" == "$key" ]]; then return 0; fi
  if [[ -f "$root/gsl/giac.wasm" && "$(engine_stamp "$root/gsl")" == "$key" ]]; then
    tmp="$root/.copy-$key.$$"; rm -rf "$tmp"
    if cp -a "$root/gsl" "$tmp" 2>/dev/null && [[ "$(engine_stamp "$tmp")" == "$key" && "$(engine_stamp "$root/gsl")" == "$key" ]]; then
      if [[ -f "$dest/giac.wasm" && "$(engine_stamp "$dest")" == "$key" ]] || mv -T "$tmp" "$dest" 2>/dev/null; then rm -rf "$tmp"; return 0; fi
    fi
    rm -rf "$tmp"
  fi
  engine_build "$src" "$key" "$root" "$log"
}
# engine_promote <out root> <key>: <root>/gsl (a copy for people and tools outside the pipeline) becomes the build of <key>; the
# old one stays as gsl.prev. Under a flock on <root>/.promote.lock, so two runs never promote at once; a gsl already at <key> is kept.
engine_promote() {
  local root="$1" key="$2"
  (
    flock -w 600 9 || exit 1
    [[ "$(engine_stamp "$root/gsl")" != "$key" || ! -f "$root/gsl/giac.wasm" ]] || exit 0
    rm -rf "$root/gsl.new" && cp -a "$root/key-$key" "$root/gsl.new" || exit 1
    rm -rf "$root/gsl.prev"
    if [[ ! -e "$root/gsl" ]]; then mv -T "$root/gsl.new" "$root/gsl"; exit; fi
    # one atomic exchange (coreutils >= 9.5): $root/gsl never goes missing for a concurrent user of the shared engine
    if mv --exchange "$root/gsl.new" "$root/gsl" 2>/dev/null; then mv -T "$root/gsl.new" "$root/gsl.prev"
    else mv -T "$root/gsl" "$root/gsl.prev" && mv -T "$root/gsl.new" "$root/gsl"; fi
  ) 9>"$root/.promote.lock"
}

# ---- A47a: jobs apart ----
# take_number <tasks dir> [<wanted pass number>]: the next job number from <tasks>/counter, read and written in one flock hold
# (<tasks>/counter.lock), so two jobs started at once never share a number. With a wanted pass number it also takes a pass
# number from <tasks>/pass-counter in the same hold: the wanted one when it is free (above the last taken and no .tasks/pass-<n>),
# else the next free one. Prints "<job>" or "<job> <pass>".
take_number() {
  local tasks="$1" want="${2:-}" fd c n p last
  mkdir -p "$tasks"
  exec {fd}>>"$tasks/counter.lock"
  if ! flock -w 120 "$fd"; then exec {fd}>&-; return 1; fi
  c="$(cat "$tasks/counter" 2>/dev/null || true)"; [[ "$c" =~ ^[0-9]+$ ]] || c=0
  n=$((c + 1)); echo "$n" > "$tasks/counter"
  if [[ -n "$want" ]]; then
    last="$(cat "$tasks/pass-counter" 2>/dev/null || true)"; [[ "$last" =~ ^[0-9]+$ ]] || last=0
    p="$want"; (( p > last )) || p=$((last + 1))
    while [[ -e "$tasks/pass-$p" ]]; do p=$((p + 1)); done
    mkdir -p "$tasks/pass-$p"; echo "$p" > "$tasks/pass-counter"
    echo "$n $p"
  else echo "$n"; fi
  exec {fd}>&-
}
# peek_number <tasks dir>: the number the next job would take (dry runs take none).
peek_number() {
  local c; c="$(cat "$1/counter" 2>/dev/null || true)"; [[ "$c" =~ ^[0-9]+$ ]] || c=0; echo $((c + 1))
}
# job_port <job number>: every kind's dev-server port (runs, passes, censuses, device steps, reports): 5200 + n % 100.
job_port() { echo $((5200 + $1 % 100)); }
# lock_wait <resource> <owner> <log prefix> <wait s> [quiet]: a devlock lock, waiting up to <wait s>; logs (with the caller's log
# function, when it has one) "waiting for <resource> (<holder>)" once, and the wait's length when it ends. With quiet it logs nothing
# (the caller logs one line, A86). Either way it sets lock_was_busy (1 when the first try found the lock held) and lock_waited (s).
lock_was_busy=0; lock_waited=0
lock_wait() {
  local res="$1" owner="$2" pre="$3" wait="$4" t0=$SECONDS holder locks
  lock_was_busy=0; lock_waited=0
  tools/devlock.sh acquire "$res" "$owner" 0 >/dev/null 2>&1 && return 0
  lock_was_busy=1
  local say=_lib_log; [[ "${5:-}" != quiet ]] || say=:
  locks="${coord:-${N62_COORD:-$(cd "$(git rev-parse --git-common-dir)/.." && pwd)/.coord}}/locks"
  holder="$(cat "$locks/$res/owner" 2>/dev/null || echo '?')"
  $say "$pre waiting for $res ($holder)"
  # The wait runs in a session of its own and is waited for as a background job (A54f1): bash runs a trapped TERM, HUP or INT only
  # after a foreground command returns, so a foreground wait of up to 7200 s held the signal back until night.sh's KILL; `wait <pid>`
  # returns at once, the trap runs owned_kill (which ends the waiter before any lock is dropped) and the job exits.
  local pid rc=0
  setsid tools/devlock.sh acquire "$res" "$owner" "$wait" >/dev/null 2>&1 </dev/null &
  pid=$!
  owned_sessions+=("$pid")
  # A58: a wait that passes N62_LOCK_NOTE seconds (600) logs one line with the holder and how long it has held the lock
  local noted=0 since hs
  while kill -0 "$pid" 2>/dev/null; do
    if [[ $noted -eq 0 ]] && (( SECONDS - t0 >= ${N62_LOCK_NOTE:-600} )); then
      noted=1; holder="$(cat "$locks/$res/owner" 2>/dev/null || echo '?')"
      since="$(date -d "$(cat "$locks/$res/since" 2>/dev/null)" +%s 2>/dev/null || true)"
      hs="?"; [[ -z "$since" ]] || hs=$(( $(date +%s) - since ))
      $say "$pre $res held by $holder for $hs s; waited $((SECONDS - t0)) s so far"
    fi
    sleep 2 & wait $! || true
  done
  wait "$pid" || rc=$?
  session_kill "$pid" || true
  owned_forget "$pid"
  lock_waited=$((SECONDS - t0))
  if [[ $rc -eq 0 ]]; then
    $say "$pre $res taken after a wait of $lock_waited s"; return 0
  fi
  $say "$pre $res still busy after a wait of $lock_waited s"; return 1
}
# host_cpu_acquire <owner> <log prefix>: the host-cpu lock, waiting up to 7200 s (N62_CPU_WAIT).
host_cpu_acquire() { lock_wait host-cpu "$1" "$2" "${N62_CPU_WAIT:-7200}"; }
# integ_acquire <owner> <log prefix>: the integ lock (the merge queue, A47b), waiting up to 7200 s (N62_INTEG_WAIT).
# Lock order: integ, then nodemods, then host-cpu; whoever holds a later one never waits for an earlier one.
integ_acquire() { lock_wait integ "$1" "$2" "${N62_INTEG_WAIT:-7200}"; }
# nodemods_acquire <owner> <log prefix>: the nodemods lock (the phase-1 worktree's app/node_modules: a copy out of it, an npm ci in
# it; A47bf1), waiting up to 7200 s (N62_NODEMODS_WAIT). Lock order: integ, then nodemods, then host-cpu.
nodemods_acquire() { lock_wait nodemods "$1" "$2" "${N62_NODEMODS_WAIT:-7200}"; }
# nodemods_take <owner> <log prefix> / nodemods_drop: the job's nodemods lock, held only around a copy or an npm ci (A47bf1).
nodemods_held=0; nodemods_owner=""
nodemods_take() {
  [[ $nodemods_held -eq 0 ]] || return 0
  nodemods_acquire "$1" "$2" || return 1
  nodemods_held=1; nodemods_owner="$1"
}
nodemods_drop() {
  [[ $nodemods_held -eq 1 ]] || return 0
  tools/devlock.sh release nodemods "$nodemods_owner" >/dev/null 2>&1 || true; nodemods_held=0
}
# host_cpu_take <owner> <log prefix> / host_cpu_drop: the job's host-cpu lock, tracked like nodemods so the EXIT trap drops it (A54).
# Lock order: integ, then nodemods, then host-cpu.
host_cpu_held=0; host_cpu_owner=""
host_cpu_take() {
  [[ $host_cpu_held -eq 0 ]] || return 0
  host_cpu_acquire "$1" "$2" || return 1
  host_cpu_held=1; host_cpu_owner="$1"
}
host_cpu_drop() {
  [[ $host_cpu_held -eq 1 ]] || return 0
  tools/devlock.sh release host-cpu "$host_cpu_owner" >/dev/null 2>&1 || true; host_cpu_held=0
}

# ---- A54: the pipeline owns its children ----
# GNU timeout moves itself into a process group of its own, so a signal to the pipeline (night.sh's timeout, a kill) never reached the
# checks, the agents or the device build, and the EXIT traps freed integ, nodemods and host-cpu under them. Every heavy child now runs
# in a session of its own (setsid) that the pipeline registers; the TERM, HUP and INT traps and every EXIT trap call owned_kill first,
# which kills the whole session (timeout's group included) and waits until it is empty, and only then do the traps drop the locks.
# own_sh and owned_kill work in the main shell only: in $( ) or a pipe the registry and the traps are lost.
owned_sessions=()
# session_alive <sid>: succeeds while a process of the session is not a zombie.
session_alive() { ps -o stat= --sid "$1" 2>/dev/null | grep -qv '^Z'; }
# session_kill <sid>: TERM to the whole session, KILL after N62_KILL_GRACE seconds (20), then waits (at most 10 s more) until it is empty.
session_kill() {
  local sid="$1" i grace="${N62_KILL_GRACE:-20}"
  session_alive "$sid" || return 0
  pkill -TERM -s "$sid" 2>/dev/null || true
  for ((i = 0; i < grace * 5; i++)); do session_alive "$sid" || return 0; sleep 0.2; done
  pkill -KILL -s "$sid" 2>/dev/null || true
  for ((i = 0; i < 50; i++)); do session_alive "$sid" || return 0; sleep 0.2; done
  return 1
}
# owned_kill: ends every registered session and reaps its leader; the caller's locks are dropped after it.
owned_kill() {
  local s
  for s in "${owned_sessions[@]}"; do
    if session_kill "$s"; then wait "$s" 2>/dev/null || true; fi
  done
  owned_sessions=()
}
# owned_forget <sid>: takes one session out of the registry.
owned_forget() {
  local s keep=()
  for s in "${owned_sessions[@]}"; do [[ "$s" == "$1" ]] || keep+=("$s"); done
  owned_sessions=("${keep[@]}")
}
# own_traps: a signal ends the child sessions first, then the job (its EXIT trap drops the locks).
own_traps() {
  trap 'owned_kill; exit 143' TERM
  trap 'owned_kill; exit 129' HUP
  trap 'owned_kill; exit 130' INT
}
# own_sh <script> [args...]: runs `bash -c <script> _ args...` in a session of its own and waits for it; stdin, stdout and stderr are the
# caller's (redirect the call). Returns its exit code. What the script left running afterwards is killed.
own_sh() {
  local pid rc=0 s keep=()
  setsid bash -c "$1" _ "${@:2}" <&0 &
  pid=$!
  owned_sessions+=("$pid")
  wait "$pid" || rc=$?
  session_kill "$pid" || true
  for s in "${owned_sessions[@]}"; do [[ "$s" == "$pid" ]] || keep+=("$s"); done
  owned_sessions=("${keep[@]}")
  return $rc
}
# own_bg <script> [args...] (A84): own_sh without the wait: the session starts in the background, registered (owned_kill ends it), its
# pid in own_bg_pid. own_wait <pid> waits for it, ends what it left running and returns its exit code. Main shell only, as own_sh.
own_bg_pid=""
own_bg() {
  setsid bash -c "$1" _ "${@:2}" <&0 &
  own_bg_pid=$!
  owned_sessions+=("$own_bg_pid")
}
own_wait() {
  local rc=0
  wait "$1" || rc=$?
  session_kill "$1" || true
  owned_forget "$1"
  return $rc
}

# device_tree <phase-1 worktree> <sha> <dir> (A56): the device runner's own tree, so nothing it reads moves under it: the files
# tracked at <sha> (git archive) and a hard-link copy of the worktree's app/node_modules; nodemods must be held (the copy reads
# the phase-1 worktree's node_modules, as a worker start does). Prints "<size of the files> in <s> s"; 1 on a failure.
device_tree() {
  local src="$1" sha="$2" d="$3" t0=$SECONDS
  [[ $nodemods_held -eq 1 ]] || { echo "device_tree without the nodemods lock" >&2; return 1; }
  [[ -d "$src/app/node_modules" ]] || { echo "no node_modules in $src/app" >&2; return 1; }
  rm -rf "$d" && mkdir -p "$d" || return 1
  git -C "$src" archive "$sha" | tar -x -C "$d" || return 1
  mkdir -p "$d/app" && cp -al "$src/app/node_modules" "$d/app/node_modules" || return 1
  echo "$(du -sh --exclude=node_modules "$d" | cut -f1) in $((SECONDS - t0)) s"
}
# quiet_wait (A51): before a timing rerun, wait until the 1-minute load average is under half of nproc (a check every 15 s, at most
# 600 s), then return 0 whatever the load: a rerun under the same load that failed it proves nothing. It prints one line per
# event (the caller sends them to the run log). Test hooks: N62_LOADAVG_FILE (read instead of /proc/loadavg), N62_NPROC,
# N62_QUIET_EVERY, N62_QUIET_MAX.
quiet_wait() {
  local f="${N62_LOADAVG_FILE:-/proc/loadavg}" every="${N62_QUIET_EVERY:-15}" max="${N62_QUIET_MAX:-600}"
  local cpus="${N62_NPROC:-$(nproc)}" t0=$SECONDS load="" first=1
  while :; do
    load="$(cut -d' ' -f1 "$f" 2>/dev/null || true)"
    [[ "$load" =~ ^[0-9]+([.][0-9]+)?$ ]] || { echo "quiet wait: no load average in $f: rerunning at once"; return 0; }
    if awk -v l="$load" -v n="$cpus" 'BEGIN { exit !(l < n / 2) }'; then
      if [[ $first -eq 1 ]]; then echo "quiet wait: load $load (under $((cpus / 2)) of $cpus cpus): rerunning"
      else echo "quiet wait: quiet after $((SECONDS - t0)) s (load $load)"; fi
      return 0
    fi
    if (( SECONDS - t0 >= max )); then echo "quiet wait: load $load still not under $((cpus / 2)) after $((SECONDS - t0)) s: rerunning anyway"; return 0; fi
    [[ $first -eq 0 ]] || echo "quiet wait: load $load (not under $((cpus / 2)) of $cpus cpus): waiting, a check every $every s for at most $max s"
    first=0; sleep "$every"
  done
}
# rerun_kind (A129) <check> <log>: prints why the failing check runs once more before a fix round, "timing" (every failing item is a
# wall-clock test, timing_only) or "flake" (e2e only: 1 to 5 failing tests whose specs the branch did not change, no shared test
# helper changed, nothing interrupted, rerunnable in pipeline-logs.ts; `changed` is the branch's diff); 1 for neither.
rerun_kind() {
  if timing_only "$1" "$2"; then echo timing
  elif [[ "$1" == e2e ]] && changed | node "$wt/app/scripts/pipeline-logs.ts" rerunnable e2e "$2"; then echo flake
  else return 1; fi
}
# flake_log (A129) <kind> <log>: after a rerun of kind "flake" that passed, one log line per test that failed first; the failing
# output stays in the log. Always returns 0.
flake_log() {
  [[ "$1" == flake ]] || return 0
  local l; while IFS= read -r l; do _lib_log "pipeline #$n $id: FLAKE $l"; done < <(node "$wt/app/scripts/pipeline-logs.ts" flakelines e2e "$2" | head -n 5)
  return 0
}
_lib_log() { if declare -F log >/dev/null; then log "$*"; fi; }
# The shell tests (A47a): run by `pipeline.sh selftest` and by the check `shell`. N62_SELFTEST_TESTS (absolute paths) overrides.
SELFTESTS=(scripts/pipeline.test.sh scripts/night.test.sh scripts/gc.test.sh tools/devlock.test.sh tools/manifest-backup.test.sh tools/release-gate.test.sh tools/release-guard.test.sh)
# selftest_run <repo dir> <log>: runs each test (clean of the pipeline's own environment); prints "PASSED", or
# "FAILED (<test>: <first failing line>)" and fails.
selftest_run() {
  local dir="$1" log="$2" t rc line
  local -a tests
  if [[ -n "${N62_SELFTEST_TESTS:-}" ]]; then read -ra tests <<<"$N62_SELFTEST_TESTS"
  else tests=("${SELFTESTS[@]/#/$dir/}"); fi
  : > "$log"
  for t in "${tests[@]}"; do
    echo "== $t" >> "$log"; rc=0
    own_sh 'cd "$1" && shift && exec env -u N62_LOCK_PID -u N62_COORD -u GIAC_OUT -u PW_PORT -u N62_SELFTEST_TESTS timeout -k 30 1800 "$@"' "$dir" "$t" > "$log.one" 2>&1 < /dev/null || rc=$?
    cat "$log.one" >> "$log"
    if [[ $rc -ne 0 ]]; then
      line="$(grep -m1 -E '^FAIL' "$log.one" || tail -n 1 "$log.one")"; [[ $rc -ne 124 ]] || line="timed out after 1800 s"
      rm -f "$log.one"; echo "FAILED (${t##*/}: $(cut -c1-200 <<<"${line:-exit $rc}"))"; return 1
    fi
  done
  rm -f "$log.one"; echo PASSED
}
# ---- A55: guards that never fired ----
# package_shaped <id>: succeeds for a package's id (A46, G112, R15c1) and fails for a FIX id (G112f1, R82f2, A47bf1) or free text.
package_shaped() { [[ "$1" =~ ^[A-Z][0-9]+[a-z0-9]*$ && ! "$1" =~ f[0-9]+$ ]]; }
# package_link_strip <file> <its repo path> <package file's repo path> (A75): every Markdown link in <file> whose target (relative to the
# file's folder, an #anchor dropped) is the package file becomes its plain text: `[R156](packages/R156.md) x` → `R156 x`. Succeeds when
# it changed the file.
package_link_strip() {
  perl -e '
    use strict; use warnings;
    my ($file, $path, $target) = @ARGV;
    sub norm { my @o; for (split m{/}, $_[0]) { next if $_ eq "" || $_ eq "."; if ($_ eq "..") { pop @o } else { push @o, $_ } } join "/", @o }
    (my $dir = $path) =~ s{[^/]*$}{};
    open my $in, "<", $file or exit 1; local $/; my $text = <$in>; close $in;
    my $n = 0;
    $text =~ s{\[([^\]\n]*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)}{
      my ($all, $t, $u) = ($&, $1, $2); (my $p = $u) =~ s/#.*$//; $p =~ s/%([0-9A-Fa-f]{2})/chr hex $1/ge;
      ($p ne "" && $u !~ m{^(https?:|mailto:|#)} && norm("$dir$p") eq norm($target)) ? do { $n++; $t } : $all
    }ge;
    exit 1 unless $n;
    open my $out, ">", $file or exit 2; print $out $text; close $out; exit 0;' "$1" "$2" "$3"
}
# task_questioned <worker reply file>: succeeds when the reply says the worker has not done its package: an "Open question" line asks
# for the task again (resend, regenerate the bundle) or says the task itself is missing (run 312 asked for the bundle to be regenerated
# with the A46 block, and was merged), or the reply's done field says "not done" (A64). A remark about the task ("the spec block is
# wrong about the cap; I followed the code", "the package file is missing a test name") is not such a line, nor is a "Needs the user"
# question, a line after "Open questions: none" or a "Not done:" list (A64, vg-5).
TASK_SUBJECT='(my|the) (task( text| block)?|bundle|package( file)?|spec block)'
# a state that ends its clause: "is missing", "is missing (…)", "is missing from the bundle"; never "is missing a test name"
TASK_GONE='(missing|empty|absent|not (found|included|in the bundle))[[:space:]]*($|[.;,:!?()]|from |in (the|my) )'
TASK_QUESTION_RE="((re-?generate|re-?send|re-?build)[^.]*(the bundle|the task|the package file|the spec|[ -]block))|($TASK_SUBJECT (is|are|was|seems( to be)?|looks|appears( to be)?) $TASK_GONE)|($TASK_SUBJECT (lacks|has no) (the |an? )?([A-Z][0-9]+[a-z0-9]* )?(section|block|heading|package|task))|(no (package|task) (file|block|text)([.;,)]|$| in))|(cannot find (the |a )?(package|task)( file| block| text)?[[:space:]]*($|[.;,)]| in))"
# the done field "not done" ("Last commit abc, NOT done.", "Done or not done: not done"); never a "Not done:" heading or list, nor "Not done in full:" (words before the colon, A64f1)
TASK_NOT_DONE_RE='(^[[:space:]*_-]*|[,;:.][[:space:]*_]*)not done[[:space:]*_]*([^:*a-z[:space:]_]|$)'
# open_question_lines <reply file>: every line with "open question(s)" and the lines after it (a heading followed by bullets), up to the
# next blank line or a new field ("Note: …", "Last commit: …"); nothing for "Open questions: none" (A64), one per line.
open_question_lines() {
  awk 'tolower($0) ~ /open questions?/ { on = 1; if (tolower($0) ~ /open questions?[*_]*[[:space:]]*[:=-]?[[:space:]]*[*_]*[[:space:]]*(none|no(ne)?[.;,)]|nothing|n\/a)/) { on = 0; next } print; next }
       /^[[:space:]]*$/ { on = 0; next }
       on && /^[[:space:]*_]*[A-Z][A-Za-z ]{0,30}[*_]*:/ { on = 0; next }
       on { print }' "$1" 2>/dev/null
}
# task_question_line <reply file>: the first line that makes task_questioned succeed (for the RESULT line); fails when there is none.
task_question_line() {
  local l
  l="$(open_question_lines "$1" | grep -viE 'needs the user' | grep -m1 -iE "$TASK_QUESTION_RE")" \
    || l="$(grep -m1 -iE "$TASK_NOT_DONE_RE" "$1" 2>/dev/null)" || return 1
  printf '%s\n' "$l"
}
task_questioned() { task_question_line "$1" >/dev/null; }
# shell_selected: succeeds when a changed file (one per line, on stdin) is a pipeline script or a tool script (A47a).
shell_selected() { grep -qE '^(scripts/|tools/[^/]*\.sh$)'; }

# ---- A83: the cheap checks fail first ----
# preflight_lint <worktree>: the two mechanical audit FIXes, against phase-1: a new engine/giac/patches/NNNN-*.patch needs its row (the
# name in backticks) in engine/giac/patches/README.md; the branch needs a report commit (brief section 2: a body with a Done and a Tests
# line, a leading list mark allowed: `- **Done:** ...`). Prints one "lint: ..." line per finding; exit 1 when there is one.
preflight_lint() {
  local wt="$1" p bad=0 c
  while IFS= read -r p; do
    [[ -n "$p" ]] || continue
    grep -qF "\`$(basename "$p")\`" "$wt/engine/giac/patches/README.md" 2>/dev/null || { echo "lint: $p has no row in engine/giac/patches/README.md"; bad=1; }
  done < <(git -C "$wt" diff --name-only --diff-filter=A phase-1...HEAD -- 'engine/giac/patches/[0-9][0-9][0-9][0-9]-*.patch')
  local found=0
  for c in $(git -C "$wt" rev-list --no-merges phase-1..HEAD); do
    git -C "$wt" log -1 --format=%b "$c" | awk '/^[-#* ]*Done([^A-Za-z]|$)/{d=1} /^[-#* ]*Tests([^A-Za-z]|$)/{t=1} END{exit !(d && t)}' && { found=1; break; }
  done
  [[ $found -eq 1 ]] || { echo "lint: no report commit (brief section 2: end with a commit whose body is the report, with its Done: and Tests: lines)"; bad=1; }
  return $bad
}
# first_failing_line <fail file>: the first line of the excerpt after the "## <check> failed" heading (grep's "N:" or "N-" taken off,
# the "--- tail ---" mark and blank lines skipped), cut to 120 characters, for the log line.
first_failing_line() {
  awk '!h { if (/^## /) h = 1; next } /^--- tail ---$/ || /^--$/ || /^[[:space:]]*$/ { next } { sub(/^[0-9]+[:-]/, ""); sub(/^[[:space:]]+/, ""); print; exit }' "$1" 2>/dev/null | cut -c1-120
}

# A130: what the log says about a failed check. fail_names <check> <check log> <names file> writes pipeline-logs.ts names (line 1 the log line's
# text, line 2 every failing test) there, or nothing for a check with no parsed items (docs, size, typecheck, redfirst; $wt is the run's worktree).
fail_names() { node "$wt/app/scripts/pipeline-logs.ts" names "$1" "$2" > "$3" 2>/dev/null || : > "$3"; }
# fail_line <fail file> [<names file>]: the heading, then ": " and the names file's first line, else the excerpt's first failing line (A83); a
# second line, indented four spaces as an Opus pass reply is, lists every failing test (log() writes both lines in one write).
fail_line() {
  local l; l="$(head -n 1 "${2:-/dev/null}" 2>/dev/null || true)"; [[ -n "$l" ]] || l="$(first_failing_line "$1")"
  echo "$(head -n 1 "$1")${l:+: $l}"
  l="$(sed -n 2p "${2:-/dev/null}" 2>/dev/null || true)"; [[ -z "$l" ]] || printf '    %s\n' "$l"
}
# names_block <names file>: the fix round's input starts with this: every failing test, and a blank line (nothing without a list).
names_block() { local l; l="$(sed -n 2p "$1" 2>/dev/null || true)"; [[ -z "$l" ]] || printf 'Failing tests (every one, once each): %s\n\n' "$l"; }

# A37: the tests that failed in some of <total> runs and passed in others. Reads item files (one "file<TAB>title" per failing item,
# one file per run) and prints "<failed runs>/<total><TAB><item>" for every item that failed in fewer than all runs.
flaky_items() {  # <total> <item file>...
  local total="$1"; shift
  local f; for f in "$@"; do sort -u "$f" 2>/dev/null; done | sort | uniq -c | awk -v t="$total" '$1 < t { c = $1; sub(/^ *[0-9]+ /, ""); print c "/" t "\t" $0 }'
}
# A37: succeeds while <dir>'s HEAD is still <sha> (the census runs on one unchanged commit).
head_is() {  # <dir> <sha>
  [[ "$(git -C "$1" rev-parse HEAD 2>/dev/null)" == "$2" ]]
}

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
# golden cases the branch adds or changes on phase-1's code (a scratch worktree with those files laid over it). A package that says its
# tests fail on the stock build (A71) runs the golden cases, and the vitest files that read GIAC_OUT, on phase-1's code with GIAC_OUT
# set to the stock engine dir (stock_engine_ensure); no other vitest file runs, it would test phase-1's code, not the stock engine. The log's first line names the engine. Succeeds when the
# stage is skipped (also when the branch adds no vitest file or golden case) or at least one of them fails there; otherwise prints the reason on stdout and fails. N62_REDFIRST_VITEST
# (default "npx vitest run") is called with the files, N62_REDFIRST_GOLDEN (default "node scripts/golden.ts") with ONLY set.
red_first() {
  local wt="$1" spec="$2" eng="$3" log="$4" stock="${5:-}" f ids="" stages="" scratch rc red=0 ran=0 err="" stage
  local where="phase-1" label="phase-1" vitest_out=""  # where: the words of the reason; vitest_out: GIAC_OUT of the vitest run ("" = the caller's)
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
  [[ ! -d "$wt/app/node_modules" ]] || ln -s "$wt/app/node_modules" "$scratch/app/node_modules"
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
# A25: the paths whose change plans the golden check: the engine, the parser, units, Find, the golden cases, and every script
# the golden gate or its engine stages run (golden.ts and golden/, golden-*.ts, invariants, calls-budget, behaviour-diff, the sweeps).
GOLDEN_RE='^(engine/|app/src/engine/|app/src/input/|app/src/units/|tests/golden/|find/|tools/find-index/|tools/probes/(giac-check\.mjs|giaccheck/|sweep/|casback/)|tests/engine/|app/scripts/(unit-case\.ts|golden\.ts|golden/.*\.ts|golden-[a-z-]+\.ts|invariants\.ts|calls-budget\.ts|behaviour-diff\.ts|sweep\.ts|seqsweep\.ts|casback\.ts|viewsweep\.ts|findcensus\.ts))'
# golden_selected: succeeds when a changed file (one per line, on stdin) plans the golden check.
golden_selected() { grep -qE "$GOLDEN_RE"; }

# behaviour_selected: succeeds when a changed file (one per line, on stdin) is engine, input or units code (A18).
behaviour_selected() { grep -qE '^(engine/|app/src/engine/|app/src/input/|app/src/units/)'; }
# behaviour_section <integ> <wt> <outfile> [<phase-1 engine dir> <branch engine dir>]: A18, the "## Behaviour changes" section of the
# audit's input: G55's behaviour-diff.ts between the phase-1 worktree and the worker's, once per call, at most 20 minutes, never
# retried. A53: phase-1's tree runs <phase-1 engine dir>/giac.mjs and the branch's tree <branch engine dir>/giac.mjs (GIAC_MJS_A,
# GIAC_MJS_B), so a Giac patch's own effect shows; without them both run $GIAC_OUT's. A tool that exits non-zero (more than half
# the runs of a tree throw) gives "failed to run" with its last lines, never "none". N62_BEHAVIOUR_TOOL overrides the script.
behaviour_section() {
  local integ="$1" wt="$2" out="$3" ea="${4:-}" eb="${5:-}" tool="${N62_BEHAVIOUR_TOOL:-$1/app/scripts/behaviour-diff.ts}" body rc=0
  local -a engines=()
  [[ -z "$ea" ]] || engines+=("GIAC_MJS_A=$ea/giac.mjs")
  [[ -z "$eb" ]] || engines+=("GIAC_MJS_B=$eb/giac.mjs")
  own_sh 'cd "$1" && shift && exec env "$@"' "$wt/app" "${engines[@]}" timeout -k 30 "${N62_BEHAVIOUR_SECONDS:-1200}" node "$tool" "$integ" "$wt" > "$out.tmp" 2>&1 < /dev/null || rc=$?
  body="$(cat "$out.tmp")"; rm -f "$out.tmp"
  {
    echo "## Behaviour changes (behaviour-diff.ts: phase-1 against $(basename "$wt"))"
    if [[ $rc -eq 124 || $rc -eq 137 ]]; then echo "timed out after 20 min (judge the diff without it)"
    elif [[ $rc -ne 0 ]]; then echo "failed to run (exit $rc; judge the diff without it):"; tail -n 10 <<<"$body"
    else printf '%s\n' "$body"; fi
  } > "$out"
}

# The gate's engine stages, run after golden (A25; app/scripts/gate.ts).
ENGINE_STAGES=(sweep seqsweep casback viewsweep findcensus)
# stage_findings <log>: prints the lines naming a NEW, NOW PASSING, CHANGED or GONE entry of a stage and succeeds when there are any.
stage_findings() { grep -E '^ {2}(sweep|seq|casback|viewsweep|findcensus) (NEW|NOW PASSING|CHANGED|GONE)' "$1"; }

# ---- A47c: night lanes ----
# lane_tag: "[A] " or "[B] " when N62_LANE (exported by `night.sh --lane`) names a lane, else nothing; every log line of a lane
# starts with it after the time.
lane_tag() { if [[ "${N62_LANE:-}" =~ ^[AB]$ ]]; then printf '[%s] ' "$N62_LANE"; fi; }
# henri_input <log> <lane> [<n>]: henri's stdin in a lane: the last <n> (80) lines of his lane (its tagged lines with their indented
# continuation lines, untagged lines and headers) and every MERGED, NOT MERGED or SKIPPED line of the other lane since the newest
# night header, in log order.
henri_input() {
  awk -v me="$2" -v keep="${3:-80}" '
    { line[NR] = $0
      if ($0 ~ /^## .* night/) { night = NR; cur = ""; lane[NR] = "" }
      else if ($0 ~ /^#/) { cur = ""; lane[NR] = "" }
      else if ($0 ~ /^- [0-9][0-9]:[0-9][0-9] \[[AB]\] /) { cur = substr($0, 10, 1); lane[NR] = cur }
      else if ($0 ~ /^- /) { cur = ""; lane[NR] = "" }
      else lane[NR] = cur }
    END {
      k = 0; for (i = NR; i >= 1 && k < keep; i--) if (lane[i] == "" || lane[i] == me) { own[i] = 1; k++ }
      for (i = 1; i <= NR; i++)
        if (own[i] || (i > night && lane[i] != "" && lane[i] != me && line[i] ~ /^- / && line[i] ~ /MERGED|SKIPPED/)) print line[i]
    }' "$1"
}
# night_section <log>: the report writer's stdin: from the newest night header on (both lanes' lines), never less than the last 400 lines.
night_section() {
  awk '/^## .* night/ { h = NR } { l[NR] = $0 } END { s = NR - 399; if (h && h < s) s = h; if (s < 1) s = 1; for (i = s; i <= NR; i++) print l[i] }' "$1"
}

# ---- A127: a row waits for its After ----
# after_ids <brief file> <package id>: the ids (one a line) in the After column of the package's row in a lane table of brief 0c
# (the tables under "### Lane A queue", "### Lane B queue", or "### The queue"); a row is the one whose What column starts with the id, bare or as
# a link `[ID](...)`. Plain words in the column ("the v0.1.0 tag") and "–" give none; an id with no row gives none.
after_ids() {
  awk -F'|' -v id="$2" '
    /^###? / { lane = ($0 ~ /^### (Lane [AB] queue|The queue)/); next }
    lane && NF >= 6 {
      w = $3; gsub(/^[ \t]+|[ \t]+$/, "", w)
      if (w ~ ("^\\[?" id "([]) ]|$)")) { a = $(NF - 1); while (match(a, /[AGRS][0-9]+[a-z0-9]*/)) { print substr(a, RSTART, RLENGTH); a = substr(a, RSTART + RLENGTH) } }
    }' "$1"
}
# id_merged <id> <git ref>: succeeds when the id counts as merged on the ref: a merge subject `: <id> (pipeline run` or `: <id>f<k> (pipeline run`,
# or a package-shaped id (no f<k> suffix) with no package file on the ref (merged before the subjects, or its file deleted by A75).
id_merged() {
  local s; s="$(git log "$2" --format=%s 2>/dev/null)"  # captured first: grep -q would SIGPIPE git log under pipefail (a long history)
  ! grep -qE ": $1(f[0-9]+)? \(pipeline run" <<<"$s" || return 0
  package_shaped "$1" && [[ "$(git cat-file -t "$2:docs/shifts/packages/$1.md" 2>/dev/null)" != blob ]]
}
# after_waits <brief file> <package id> <git ref>: prints the After ids of the package's row that are not merged (", " apart) and succeeds
# when there are any.
after_waits() {
  local a w=""
  while IFS= read -r a; do
    [[ -z "$a" ]] || id_merged "$a" "$3" || w+="${w:+, }$a"
  done < <(after_ids "$1" "$2")
  [[ -z "$w" ]] || { echo "$w"; return 0; }
  return 1
}

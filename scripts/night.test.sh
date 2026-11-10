#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Test for scripts/night.sh's lanes (A47c): dry runs, and a sandbox repo whose phase-1 worktree holds a stub scripts/pipeline.sh
# and whose PATH holds a stub henri (claude). No agent, no device, no real pipeline run.
#   scripts/night.test.sh [dir with night.sh, pipeline.sh and pipeline-lib.sh]   (default: the scripts next to this test)
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
dir="$(cd "${1:-$here}" && pwd)"; night="$dir/night.sh"
fails=0
fail() { echo "FAIL: $*" >&2; fails=$((fails + 1)); }
tmp="$(mktemp -d)"; fakes=()
cleanup() { local p; for p in "${fakes[@]}"; do kill "$p" 2>/dev/null; done; rm -rf "$tmp"; }
trap cleanup EXIT
gc() { git -C "$1" -c user.name=t -c user.email=t@t commit -q --allow-empty -m "$2"; }
# fake_night <seconds>: a live process whose command line names night.sh (a running night.sh to the guard); prints its pid
fake_night() { bash -c "exec -a 'scripts/night.sh --lane x' sleep $1" >/dev/null 2>&1 & fakes+=($!); echo $!; }

# ---- 1. dry runs: henri's input and prompt per lane ----
c="$tmp/coord"; mkdir -p "$c"
{
  echo; echo "## 2026-10-29 night, 19:00"
  echo "- 19:10 [B] pipeline #300 G1: MERGED old1 (an earlier night)"
  echo; echo "## 2026-10-30 night, 07:00 (lane A)"
  echo "- 07:00 [A] night.sh started (lane A)"
  echo "- 07:01 [B] night.sh started (lane B)"
  for i in $(seq 1 90); do printf -- '- 07:%02d [A] lane-a-line %d\n' $((i % 60)) "$i"; done
  echo "- 08:00 [B] henri #1: scripts/pipeline.sh annabell \"A48\" --model sonnet --audit-model auto"
  echo "- 08:30 [B] pipeline #401 A48: MERGED b48 (audit opus)"
  echo "- 08:31 [B] Opus pass 9 reply:"
  echo "    VERDICT: A48 ok, MERGED in the lane-b-reply"
  echo "- 08:40 [B] RESULT -: SKIPPED (scripts/pipeline.sh gorge \"G135\": no RESULT line twice); do not repeat it"
  echo "- 08:45 [A] Opus pass 8 reply:"
  echo "    VERDICT: lane-a-reply ok"
  echo "- 08:50 untagged gc applied"
} > "$c/log.md"
out="$(N62_COORD="$c" N62_NIGHT_NOW=07:00 "$night" --lane A --dry-run --max-steps 4 2>&1)"; rc=$?
[[ $rc -eq 0 ]] || fail "--lane A --dry-run: exit $rc: $out"
grep -qF 'you run lane A: your table is `### Lane A queue`' <<<"$out" || fail "--lane A: the henri prompt does not name lane A's table: $out"
inp="$(grep '^  | ' <<<"$out" | sed 's/^  | //')"
grep -q 'lane-a-line 90$' <<<"$inp" && grep -q 'lane-a-reply ok' <<<"$inp" && grep -q 'untagged gc applied' <<<"$inp" || fail "--lane A: henri's input lacks lane A's lines: $inp"
grep -q 'lane-a-line 5$' <<<"$inp" && fail "--lane A: henri's input holds more than lane A's last 80 lines"
[[ "$(grep -cE '^- [0-9:]+ \[A\]|^    |^- [0-9:]+ untagged|^#|^$' <<<"$inp")" -le 80 ]] || fail "--lane A: more than 80 lines of lane A"
grep -q 'pipeline #401 A48: MERGED b48' <<<"$inp" && grep -q 'RESULT -: SKIPPED' <<<"$inp" || fail "--lane A: henri's input lacks lane B's finished steps: $inp"
grep -qE 'henri #1: scripts/pipeline.sh annabell|lane-b-reply|G1: MERGED old1|night.sh started \(lane B\)' <<<"$inp" && fail "--lane A: henri's input holds lane B lines that are not finished steps since the night header: $inp"
grep -q 'night.sh #4 (closing 2 of 2): scripts/pipeline.sh report' <<<"$out" && grep -q 'waits for lane B' <<<"$out" || fail "--lane A: the closing report does not wait for lane B: $out"
out="$(N62_COORD="$c" N62_NIGHT_NOW=07:00 "$night" --lane B --dry-run --max-steps 4 2>&1)"; rc=$?
[[ $rc -eq 0 ]] || fail "--lane B --dry-run: exit $rc: $out"
grep -qF 'you run lane B: your table is `### Lane B queue`' <<<"$out" || fail "--lane B: the henri prompt does not name lane B's table: $out"
inp="$(grep '^  | ' <<<"$out" | sed 's/^  | //')"
grep -q 'henri #1: scripts/pipeline.sh annabell' <<<"$inp" && ! grep -q 'lane-a-line 90' <<<"$inp" || fail "--lane B: henri's input is not lane B's: $inp"
grep -q 'closing 2 of 2' <<<"$out" && ! grep -q 'run: scripts/pipeline.sh report\|(closing 2 of 2): scripts/pipeline.sh report' <<<"$out" || fail "--lane B: the closing runs a report: $out"
out="$(N62_COORD="$c" N62_NIGHT_NOW=07:00 "$night" --dry-run --max-steps 4 2>&1)"
grep -qi 'lane' <<<"$out" && fail "no --lane: the dry run talks of lanes: $out"
"$night" --lane C --dry-run >/dev/null 2>&1 && fail "--lane C is accepted"

# ---- 2. the pipeline starts each log line with the lane ----
pl="$tmp/pl"; mkdir -p "$pl"; git init -q -b main "$pl"; gc "$pl" init
printf '#!/bin/sh\necho ok\n' > "$tmp/ok.sh"; chmod +x "$tmp/ok.sh"
(cd "$pl" && unset N62_COORD && N62_LANE=B N62_SELFTEST_TESTS="$tmp/ok.sh" "$dir/pipeline.sh" selftest >/dev/null 2>&1)
(cd "$pl" && unset N62_COORD N62_LANE && N62_SELFTEST_TESTS="$tmp/ok.sh" "$dir/pipeline.sh" selftest >/dev/null 2>&1)
grep -qE '^- [0-9]{2}:[0-9]{2} \[B\] pipeline selftest: PASSED' "$pl/.coord/log.md" && grep -qE '^- [0-9]{2}:[0-9]{2} pipeline selftest: PASSED' "$pl/.coord/log.md" \
  || fail "pipeline.sh: N62_LANE=B does not start its log line with [B], or no lane adds a tag: $(cat "$pl/.coord/log.md" 2>&1)"
grep -qF 'echo "- $(date +%H:%M) $(lane_tag)Opus pass $n reply:"' "$dir/pipeline.sh" || fail "pipeline.sh: the pass reply line has no lane tag"
# the report reads the night from its header (both lanes), never less than the last 400 lines
printf 'old\n## 2026-10-30 night, 07:00 (lane A)\n- 07:00 [A] a\n- 07:01 [B] b\n' > "$tmp/sec.md"
(source "$dir/pipeline-lib.sh"; night_section "$tmp/sec.md") > "$tmp/sec.out" 2>/dev/null
grep -q '\[A\] a' "$tmp/sec.out" && grep -q '\[B\] b' "$tmp/sec.out" && grep -q '^old$' "$tmp/sec.out" || fail "night_section: $(cat "$tmp/sec.out")"
{ for i in $(seq 1 500); do echo "x$i"; done; echo '## 2026-10-30 night, 07:00'; for i in $(seq 1 600); do echo "- 07:00 [B] y$i"; done; } > "$tmp/sec2.md"
(source "$dir/pipeline-lib.sh"; night_section "$tmp/sec2.md") > "$tmp/sec2.out" 2>/dev/null
grep -q '^## 2026-10-30 night' "$tmp/sec2.out" && ! grep -q '^x500$' "$tmp/sec2.out" || fail "night_section: a long night does not start at its header"
grep -qF 'night_section "$coord/log.md" > "$run/input.txt"' "$dir/pipeline.sh" && grep -qF -- '-n report "$prompt" < "$run/input.txt"' "$dir/pipeline.sh" || fail "pipeline.sh report: the writer does not read the night section"  # A54: a file, not a pipe: the writer runs in an owned session
# night.sh calls `scripts/pipeline.sh selftest` by a relative path: the tests must be the ones next to that script, not the main checkout's
grep -q 'here="$(cd "$self_dir/.." && pwd)"' "$dir/pipeline.sh" && [[ "$(grep -n 'self_dir=' "$dir/pipeline.sh" | head -n1 | cut -d: -f1)" -lt "$(grep -n '^cd "$main"' "$dir/pipeline.sh" | head -n1 | cut -d: -f1)" ]] || fail "pipeline.sh selftest: the script dir is resolved after cd main"

# ---- 3. the sandbox: a repo whose phase-1 holds a stub pipeline.sh, a stub henri on PATH ----
sb="$tmp/sb"; mkdir -p "$sb/bin" "$sb/scripts"; git init -q -b main "$sb"
cat > "$sb/scripts/pipeline.sh" <<'STUB'
#!/bin/sh
echo "lane=${N62_LANE:-} $*" >> "$SBN_CALLS"
# A121: SBN_LIMITS names a file of lines; each call but a device step takes the first: L = a usage limit (exit 75)
if [ "$1" != device ] && [ -s "$SBN_LIMITS" ]; then
  first=$(head -n1 "$SBN_LIMITS"); sed -i 1d "$SBN_LIMITS"
  if [ "$first" = L ]; then echo "You've hit your 5-hour limit"; exit 75; fi
fi
case "$1" in
  pass) echo "OPUS PASS"; echo "RESULT pass $((${2} + 2)): done (exit 0)";;
  device) echo "RESULT device $2: DEVICE SKIPPED (stub)";;
  report) echo "RESULT report: abc1234";;
  *) case "$2" in W*) echo "RESULT #1 $2: WAITS for X9"; exit 2;; esac   # A127: an id starting with W waits
     if [ "$2" = "$SBN_STOP_ON" ]; then "$SBN_NIGHT" --stop "$SBN_STOP_LANE" >> "$SBN_CALLS" 2>&1; sleep 1; echo "finished $2" >> "$SBN_CALLS"; fi
     echo "RESULT #1 $2: MERGED abc";;
esac
STUB
cat > "$sb/bin/claude" <<'STUB'
#!/bin/sh
n=$(echo "$*" | grep -oE 'henri-[0-9]+' | cut -d- -f2)
k=$(( $(wc -l < "$SBN_ASKED") + 1 ))   # A121: a retried step keeps its number, so the reply is keyed on the count of asks
cat > "$SBN_IN.$n"; echo "$k" >> "$SBN_ASKED"
r=$(sed -n "${k}p" "$SBN_REPLIES")
case "$r" in
  LIMIT) echo "You've hit your 5-hour limit"; exit 1;;
  FAIL) echo "boom"; echo "boom" >&2; exit 1;;
esac
echo "${r:-SHIFT DONE}"
STUB
# a fake df (A69): SBN_DF_KB set = that many KB available on every file system
cat > "$sb/bin/df" <<'STUB'
#!/bin/sh
if [ -n "$SBN_DF_KB" ]; then printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/fake 100000000 1 %s 1%% /\n' "$SBN_DF_KB"; else exec /usr/bin/df "$@"; fi
STUB
chmod +x "$sb/scripts/pipeline.sh" "$sb/bin/claude" "$sb/bin/df"; git -C "$sb" add -A; gc "$sb" init; git -C "$sb" branch phase-1
git -C "$sb" worktree add -q "$sb/.claude/worktrees/phase-1" phase-1
# sbnight <case> <night.sh args...>: a real (not dry) night.sh in the sandbox; the case's files are $tmp/<case>.*
sbnight() {
  local k="$1"; shift; : > "$tmp/$k.calls"; : > "$tmp/$k.asked"; [[ -f "$tmp/$k.replies" ]] || : > "$tmp/$k.replies"
  (cd "$sb" && unset N62_COORD N62_LANE && PATH="$sb/bin:$PATH" N62_NIGHT_INHIBITED=1 N62_NIGHT_POLL=1 \
    SBN_CALLS="$tmp/$k.calls" SBN_ASKED="$tmp/$k.asked" SBN_IN="$tmp/$k.in" SBN_REPLIES="$tmp/$k.replies" SBN_NIGHT="$night" \
    SBN_DF_KB="${SBN_DF_KB:-}" SBN_LIMITS="$tmp/$k.limits" SBN_STOP_ON="${SBN_STOP_ON:-}" SBN_STOP_LANE="${SBN_STOP_LANE:-}" timeout -k 5 60 "$night" "$@")
}
lg="$sb/.coord/log.md"
# the guard: a running lane A refuses a second --lane A and a start without --lane, not --lane B
mkdir -p "$sb/.coord"; pa="$(fake_night 60)"; echo "$pa" > "$sb/.coord/night-A.pid"
out="$(sbnight g1 --lane A 2>&1)"; rc=$?
[[ $rc -ne 0 ]] && grep -q "refused.*lane A runs (pid $pa" <<<"$out" || fail "guard: a second --lane A start is not refused (rc $rc): $out"
out="$(sbnight g2 2>&1)"; rc=$?
[[ $rc -ne 0 ]] && grep -q "refused.*lane A runs" <<<"$out" || fail "guard: a start without --lane while lane A runs is not refused (rc $rc): $out"
[[ -s "$tmp/g1.asked" || -s "$tmp/g2.asked" ]] && fail "guard: a refused start asked henri"
[[ "$(cat "$sb/.coord/night-A.pid")" == "$pa" ]] || fail "guard: a refused start touched the running lane's pid file"
h0="$(grep -c '^## .* night' "$lg" 2>/dev/null)"
out="$(sbnight g3 --lane B 2>&1)"; rc=$?
[[ $rc -eq 0 ]] && grep -q '^1$' "$tmp/g3.asked" || fail "guard: --lane B is refused while lane A runs (rc $rc): $out"
[[ ! -e "$sb/.coord/night-B.pid" ]] || fail "guard: lane B left its pid file after SHIFT DONE"
[[ "$(grep -c '^## .* night' "$lg")" -eq "${h0:-0}" ]] || fail "guard: lane B started while lane A runs wrote a new night header"
grep -qE '^- [0-9:]+ \[B\] SHIFT DONE' "$lg" || fail "guard: lane B's log lines have no [B]: $(tail -n 5 "$lg")"
kill "$pa" 2>/dev/null; wait "$pa" 2>/dev/null
# the reverse: a night without lanes refuses both lanes
pall="$(fake_night 60)"; echo "$pall" > "$sb/.coord/night-all.pid"
out="$(sbnight g4 --lane A 2>&1)"; rc=$?; [[ $rc -ne 0 ]] && grep -q 'refused.*night without lanes runs' <<<"$out" || fail "guard: --lane A while a night without lanes runs (rc $rc): $out"
out="$(sbnight g5 --lane B 2>&1)"; rc=$?; [[ $rc -ne 0 ]] && grep -q 'refused' <<<"$out" || fail "guard: --lane B while a night without lanes runs (rc $rc): $out"
kill "$pall" 2>/dev/null; wait "$pall" 2>/dev/null
# a stale pid file is replaced and logged
true & dead=$!; wait "$dead"; echo "$dead" > "$sb/.coord/night-A.pid"
out="$(sbnight g6 --lane A 2>&1)"; rc=$?
[[ $rc -eq 0 ]] && grep -q "stale pid file night-A.pid (pid $dead" "$lg" || fail "guard: a stale pid file is not replaced and logged (rc $rc): $out"
grep -q "^## .* night, .* (lane A)$" "$lg" || fail "guard: lane A started alone wrote no night header"

# --stop A: the line percy reads, the running step finishes, then lane A ends
printf '%s\n' 'scripts/pipeline.sh ron "R1" --model sonnet' 'scripts/pipeline.sh ron "R2" --model sonnet' > "$tmp/s1.replies"
out="$(SBN_STOP_ON=R1 SBN_STOP_LANE=A sbnight s1 --lane A 2>&1)"; rc=$?
[[ $rc -eq 0 ]] || fail "--stop A: lane A did not end cleanly (rc $rc): $out"
grep -qE '^- [0-9:]+ \[A\] STOPPED night.sh \(lane A\): by the owner$' "$lg" || fail "--stop A: no 'STOPPED night.sh (lane A): by the owner' line: $(tail -n 5 "$lg")"
grep -q 'finished R1' "$tmp/s1.calls" || fail "--stop A: the running step did not finish: $(cat "$tmp/s1.calls")"
grep -q 'R2' "$tmp/s1.calls" && fail "--stop A: lane A started another step after the stop: $(cat "$tmp/s1.calls")"
[[ "$(wc -l < "$tmp/s1.asked")" -eq 1 ]] || fail "--stop A: henri was asked again after the stop"
[[ ! -e "$sb/.coord/night-A.pid" && ! -e "$sb/.coord/night-A.stop" ]] || fail "--stop A: the pid or stop file is left"
grep -q 'lane=A ron R1' "$tmp/s1.calls" || fail "the pipeline does not get N62_LANE=A: $(cat "$tmp/s1.calls")"

# A69: under NIGHT_MIN_FREE_GB (default 5) free, the lane stops before asking henri and starts no step; at the limit it runs
printf '%s\n' 'scripts/pipeline.sh ron "R1" --model sonnet' > "$tmp/d1.replies"
out="$(SBN_DF_KB=3145728 sbnight d1 --lane A 2>&1)"; rc=$?
[[ $rc -ne 0 ]] || fail "disk guard: 3 GB free did not end the lane with an error (rc $rc): $out"
grep -qE '^- [0-9:]+ \[A\] STOPPED night.sh \(lane A\): disk 3 GB free$' "$lg" || fail "disk guard: no 'STOPPED night.sh (lane A): disk 3 GB free' line: $(tail -n 4 "$lg")"
[[ ! -s "$tmp/d1.asked" && ! -s "$tmp/d1.calls" ]] || fail "disk guard: henri was asked or a step started with 3 GB free: $(cat "$tmp/d1.calls")"
[[ ! -e "$sb/.coord/night-A.pid" ]] || fail "disk guard: the pid file is left"
out="$(SBN_DF_KB=5242880 sbnight d2 --lane A 2>&1)"; rc=$?
[[ $rc -eq 0 ]] && grep -q '^1$' "$tmp/d2.asked" || fail "disk guard: exactly 5 GB free stopped the lane (rc $rc): $out"
out="$(SBN_DF_KB=3145728 NIGHT_MIN_FREE_GB=2 sbnight d3 --lane A 2>&1)"; rc=$?
[[ $rc -eq 0 ]] && grep -q '^1$' "$tmp/d3.asked" || fail "disk guard: NIGHT_MIN_FREE_GB=2 with 3 GB free stopped the lane (rc $rc): $out"

# the closing: lane B runs its last pass and its device step (number from the pass's RESULT line), and no report
printf '%s\n' 'scripts/pipeline.sh ron "R1" --model sonnet' 'scripts/pipeline.sh pass 7 "R1" "none"' > "$tmp/c1.replies"
out="$(sbnight c1 --lane B --max-steps 3 2>&1)"; rc=$?
[[ $rc -eq 0 ]] || fail "lane B closing: rc $rc: $out"
grep -q 'lane=B pass 7 ' "$tmp/c1.calls" && grep -qx 'lane=B device 9' "$tmp/c1.calls" || fail "lane B closing: no pass, or the device step does not take the pass's RESULT number (9): $(cat "$tmp/c1.calls")"
grep -q ' report' "$tmp/c1.calls" && fail "lane B closing ran the report: $(cat "$tmp/c1.calls")"
# lane A's closing waits for lane B to end, then runs the report
printf '%s\n' 'scripts/pipeline.sh ron "R1" --model sonnet' 'scripts/pipeline.sh pass 7 "R1" "none"' > "$tmp/c2.replies"
pb="$(fake_night 3)"; echo "$pb" > "$sb/.coord/night-B.pid"
out="$(sbnight c2 --lane A --max-steps 3 2>&1)"; rc=$?
[[ $rc -eq 0 ]] && grep -qx 'lane=A report' "$tmp/c2.calls" && grep -qx 'lane=A device 9' "$tmp/c2.calls" || fail "lane A closing: no report or no device 9 (rc $rc): $(cat "$tmp/c2.calls")"
grep -q '\[A\] night.sh: waiting for lane B to end before the report' "$lg" && grep -q '\[A\] night.sh: lane B ended after' "$lg" || fail "lane A closing: no wait for lane B: $(tail -n 8 "$lg")"
# a henri pass line in the middle of the night: the device step takes the RESULT's number too
printf '%s\n' 'scripts/pipeline.sh pass 3 "R1" "none"' > "$tmp/c3.replies"
sbnight c3 >/dev/null 2>&1
grep -qx 'lane= device 5' "$tmp/c3.calls" || fail "a pass in the night: the device step does not take the RESULT's number (5): $(cat "$tmp/c3.calls")"

# A121: usage limits (--limit-wait 1). The retry keeps its step; a limit of henri or of the pipeline waits and costs no step
# newlog: the log lines this case wrote (the sandbox log is shared)
lcase() { l0="$(wc -l < "$lg")"; }
newlog() { tail -n +$((l0 + 1)) "$lg"; }
nwait() { newlog | grep -c 'night.sh: usage limit, waiting'; }
R1='scripts/pipeline.sh ron "R1" --model sonnet'
# henri at a limit twice, then a command: the command runs, two waits, no STOPPED
printf '%s\n' LIMIT LIMIT "$R1" > "$tmp/l1.replies"; lcase
out="$(sbnight l1 --limit-wait 1 2>&1)"; rc=$?
[[ $rc -eq 0 ]] && grep -q 'ron R1' "$tmp/l1.calls" || fail "limits: henri at a limit twice, then a command: the command did not run (rc $rc): $out"
newlog | grep -q 'STOPPED' && fail "limits: henri at a limit twice ended the lane: $(newlog)"
[[ "$(nwait)" -eq 2 ]] || fail "limits: henri at a limit twice: $(nwait) waits, expected 2: $(newlog)"
# henri at a limit in closing step 1, then a pass line: the pass and its device step run
printf '%s\n' "$R1" LIMIT 'scripts/pipeline.sh pass 7 "R1" "none"' > "$tmp/l2.replies"; lcase
out="$(sbnight l2 --limit-wait 1 --max-steps 3 2>&1)"; rc=$?
grep -q ' pass 7 ' "$tmp/l2.calls" && grep -qx 'lane= device 9' "$tmp/l2.calls" || fail "limits: henri at a limit in closing step 1 lost the last pass (rc $rc): $(cat "$tmp/l2.calls")"
newlog | grep -q 'no Opus pass line' && fail "limits: a limit in closing step 1 read as no pass line: $(newlog)"
[[ "$(nwait)" -eq 1 ]] || fail "limits: closing step 1: $(nwait) waits, expected 1"
# henri exits 1 with other text, twice: still the old stop, and no wait
printf '%s\n' FAIL FAIL > "$tmp/l3.replies"; lcase
out="$(sbnight l3 --limit-wait 1 2>&1)"; rc=$?
[[ $rc -ne 0 ]] && newlog | grep -q 'STOPPED night.sh: henri gave no pipeline command twice' || fail "limits: another henri failure twice does not stop the lane (rc $rc): $(newlog)"
[[ "$(nwait)" -eq 0 ]] || fail "limits: another henri failure waited"
# the pipeline at rc 75 eleven times in a row: the stop
for i in $(seq 1 12); do echo "$R1"; done > "$tmp/l4.replies"; printf 'L\n%.0s' $(seq 1 11) > "$tmp/l4.limits"; lcase
out="$(sbnight l4 --limit-wait 1 2>&1)"; rc=$?
[[ $rc -ne 0 ]] && newlog | grep -qx -- '- [0-9:]* STOPPED night.sh: usage limit 10 times' || fail "limits: 11 limits in a row do not stop with 'usage limit 10 times' (rc $rc): $(newlog | tail -n 4)"
# ten, a merged step, ten: no stop (the count is of consecutive limits)
{ for i in $(seq 1 10); do echo "$R1"; done; echo 'scripts/pipeline.sh ron "R2" --model sonnet'; for i in $(seq 1 10); do echo 'scripts/pipeline.sh ron "R3" --model sonnet'; done; } > "$tmp/l5.replies"
{ printf 'L\n%.0s' $(seq 1 10); echo N; printf 'L\n%.0s' $(seq 1 10); } > "$tmp/l5.limits"; lcase
out="$(sbnight l5 --limit-wait 1 2>&1)"; rc=$?
[[ $rc -eq 0 ]] && ! newlog | grep -q 'STOPPED' || fail "limits: ten limits, a merged step, ten limits stopped the lane (rc $rc): $(newlog | tail -n 4)"
grep -q 'ron R2' "$tmp/l5.calls" || fail "limits: the merged step between did not run"
# a small --max-steps: three limits before the merged step do not close the lane early
{ for i in 1 2 3 4; do echo "$R1"; done; echo 'scripts/pipeline.sh ron "R2" --model sonnet'; echo 'scripts/pipeline.sh pass 7 "R1" "none"'; } > "$tmp/l6.replies"; printf 'L\nL\nL\n' > "$tmp/l6.limits"; lcase
out="$(sbnight l6 --limit-wait 1 --max-steps 4 2>&1)"; rc=$?
[[ $rc -eq 0 ]] && grep -q 'ron R2' "$tmp/l6.calls" || fail "limits: three limits ate the steps of --max-steps 4 (rc $rc): $(cat "$tmp/l6.calls")"
# A127: a WAITS result is no finish; a second WAITS of one command with no MERGED since is SKIPPED, in any order (A, B, A, B); a MERGED between resets
W1='scripts/pipeline.sh ron "W1" --model sonnet'; W2='scripts/pipeline.sh ron "W2" --model sonnet'
printf '%s\n' "$W1" "$W2" "$W1" "$W2" > "$tmp/w1.replies"; lcase
out="$(sbnight w1 2>&1)"; rc=$?
[[ "$(grep -c ' W[12] ' "$tmp/w1.calls")" -eq 4 ]] || fail "WAITS: A, B, A, B did not run four steps (rc $rc): $(cat "$tmp/w1.calls")"
[[ "$(newlog | grep -c 'RESULT -: SKIPPED.*"W[12]".*WAITS twice')" -eq 2 ]] || fail "WAITS: A, B, A, B does not end both as SKIPPED: $(newlog)"
newlog | grep 'SKIPPED' | head -n1 | grep -q '"W1"' || fail "WAITS: the first SKIPPED is not the third step (W1): $(newlog)"
printf '%s\n' "$W1" "$W2" "$R1" "$W1" "$W2" > "$tmp/w2.replies"; lcase
out="$(sbnight w2 2>&1)"; rc=$?
newlog | grep -q 'SKIPPED' && fail "WAITS: a MERGED between the two WAITS did not reset the count: $(newlog)"
printf '%s\n' "$W1" "$W1" > "$tmp/w3.replies"; lcase
out="$(sbnight w3 2>&1)"; rc=$?
[[ "$(newlog | grep -c 'SKIPPED.*"W1".*WAITS twice')" -eq 1 ]] || fail "WAITS: the same command twice in a row is not SKIPPED once: $(newlog)"
newlog | grep -q 'NOT MERGED' && fail "WAITS: a wait is logged as NOT MERGED: $(newlog)"
grep -qF 'A step whose log line says WAITS is not finished: take the next row whose After is met and come back to it' "$night" || fail "WAITS: henri's prompt does not say a WAITS step is not finished"
# LIMIT_RE: the CLI's words
for t in "You've hit your 5-hour limit" "You've hit your weekly limit" "You're out of usage credits" "You're out of extra usage" "Claude usage limit reached" "API Error: 429"; do
  (source "$dir/pipeline-lib.sh"; grep -qiE "$LIMIT_RE" <<<"$t") || fail "LIMIT_RE does not match: $t"
done
(source "$dir/pipeline-lib.sh"; grep -qiE "$LIMIT_RE" <<<"Error: exit 1") && fail "LIMIT_RE matches 'Error: exit 1'"

# A89: `unsafe` reads a backslash and the character after it as one unit inside double quotes (an escaped quote does not close them)
eval "$(sed -n '/^unsafe() {/,/^}/p' "$night")"
P='scripts/pipeline.sh ron'
acc() { unsafe "$1" && fail "unsafe refuses a safe line: $1"; return 0; }
ref() { unsafe "$1" || fail "unsafe accepts an unsafe line: $1"; return 0; }
acc "$P \"describe \\\"a & b\\\" here\" --id X1"
acc "$P \"describe \\\"R153: N62 in teal, Black & White, Solarized\\\"\" --id X1"
acc "$P \"a & b; c | d < e > f\" --id X1"
acc "$P \"a\\\\\" --id X1"
ref "$P a; rm x"; ref "$P a & b"; ref "$P a | b"; ref "$P a < b"; ref "$P a > b"
ref "$P \"a\" ; rm x"; ref "$P \"a\" && rm x"
ref "$P \"a \$HOME\""; ref "$P \"a \\\$HOME\""; ref "$P \"a \`id\`\""; ref "$P \"a \\\`id\\\`\""; ref "$P \$HOME"
ref "$P \"a\\\"; rm x"
ref "$P \"a\\\\\" ; rm x \"b\""
ref "$P \"a\\\\\" & rm x \"b\""
# A89f1: a quote the shell does not read as one (escaped, or inside single quotes) opens nothing; the scanner reads the line like the shell
for m in ';' '&' '|'; do
  ref "$P \\\"a $m touch f \" \""
  ref "$P '\"' $m touch f $m '\"'"
done
ref "$P \"a"; ref "$P 'a"
acc "$P 'a \" b' --id X1"; acc "$P \"a 'b' c\" --id X1"
ref "$P 'a ; b'"; ref "$P \\\"a"
# the accepted line, run through the same eval, gives its prompt argument with the literal double quotes
args() { printf '%s\n' "$2"; }
line="args ron \"describe \\\"a & b\\\" here\" --id X1"
[[ "$(eval "$line")" == 'describe "a & b" here' ]] || fail "eval of the accepted line: $(eval "$line")"

[[ $fails -eq 0 ]] || { echo "night.test.sh: $fails failure(s)" >&2; exit 1; }
echo "night.test.sh: ok"

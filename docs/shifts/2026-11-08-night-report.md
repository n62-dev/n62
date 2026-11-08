<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Night report 2026-11-08, the night of 2026-11-07 (17:00 to 11:08)

Pipeline runs 733 to 780 (28 package runs), Opus passes 92 to 102 (11), device runs 92 to 102 (10 ran, device 96 was skipped). Both lanes ran on the Tab One (`ANDROID_SERIAL=HA24BZ2Y`), `night.sh --lane A` and `--lane B`, `--until 09:00`, started 17:00 on the 7th. **24 runs merged** (14 in lane A, 10 in lane B); 4 runs ended NOT MERGED (A66, R155f1, R159, R53) and three of them merged later as follow-ups (A66f1, R155f2, R159f1). Lane B had no rows left after R155f2 and closed at 07:50 (`SHIFT DONE`). Lane A started R159f1 at 08:59, so its last pass and device run ran to 11:08, and then it wrote this report. Nothing was pushed.

**Core list:** desktop CORE 66/66 (known 0, needs 0) at a0e0421f (pass 102; that commit includes the day session's must-have merge, which is not in the log). The device: **CORE DEVICE 65/65 (known 0, new none) at cdea80f1 (device 102, 11:08)**. Device 100 gave 64/65 with c29 new (de659c02); device 101 was 65/65 and no code changed in between, so it is backlog F200 and not a FIX; a second red makes it one. Gates at pass 102 (a0e0421f): typecheck 0; `FIND_INDEX=required npm test` 3916 passed, 1 expected fail; e2e 1771 passed, 12 skipped; golden not run (no engine or parser change; the last GOLDEN GATE PASSED was pass 93 at e7c7e22f, and the pipeline's round-1 run for R155f2 passed too). Start chunk 60.61 kB of 61.00 gzip (R155f2's cut; about 10 B under its pin).

## Merged into phase-1
Lane A (ron):
- R147f1 f98453f5 (a click on a history input keeps the focus in the entry line; 4 red-first e2e).
- R151 29237ce9 (the sheet's model is a lazy part; start chunk 60,915 to 59,441 B; the unit view pin to 66.60 kB).
- R161 4aac2910 (the press look is our own `data-down` flag; the four `:active` rules replaced).
- R162 d0e0733b (key pop: one at a time, gone after the lift and at least 80 ms).
- R152 9358d319 (history rows draw e and i from MathLive's own macros).
- R158 8195f956 (a grouped plain number too wide for its row wraps at its group gaps). One fix round (the audit: a second copy of the sign, exponent and group rules).
- R153 f823bab2 (N62 teal, Black & White, Solarized; N62 Dark's background #092726 also in `index.html` and the manifest).
- R154 ae387297 (the entry ring; 1/0 counts as a result). One fix round (the audit: the error outline did not go away on every edit).
- R155 4cb8e068 (the run dash, 150 ms delay, reduced motion).
- R153f1 910dae40 (the first-frame test writes the look mirror with `addInitScript`, so it no longer races the app's own write).
- R156 4bf4e682 (Key shadows, the fifth look value, on by default; Appearance opens on Theme).
- R163 3ce5a67f (Pops, the sixth look value, on by default). One fix round (e2e; `entryring.spec.ts` now waits for engine ready).
- R160 e6cfc7cd (the inline check needs color-mix, container units and wasm exceptions: Chrome 111). One fix round (size; inline scripts back at 1412 B of 1.53 kB).
- R159f1 157650e0 (carries R159: a unit chip picks on pointerup; a touchend listener stops the stray click; the unit view pin to 66.97 kB; the folder-names Java test gets a 120 s limit). Two fix rounds (docs; e2e).

Lane B (gorge, annabell):
- G185f2 7dd8633a (the Home watchdog starts when a call reaches the head of the worker's queue, not at engine ready).
- G182 64125ad9 (a past-the-cap warn says `pastCap`, not `once`). Two fix rounds (the line baseline of `numeric.ts`; the audit).
- A64 e7c7e22f (a worker's "not done" reply ends the run NOT MERGED before the checks). One fix round (docs budget).
- A64f1 8d59e4c1 (the not-done check no longer fires on "Not done in full: …" headings). One fix round (line baseline).
- A67 9c286fb5 (red-first rule: an edited assertion counts neither way). Two fix rounds (the audit twice).
- A65 58f79dc7 (the sync folder names check, `tools/folder-names.test.sh`). Two fix rounds (the audit: nothing ran the script; e2e).
- A73f1 dfa23e6a (cold-start measurement of Home and CAS; the `device_run.py` regex fix).
- A75 bf8d2f0e (housekeeping: package-file drop, unlink and gc). One fix round (the audit: dangling links).
- A66f1 7a9e113e (carries A66: Key click, off by default; its code in the lazy chunk `input/click.ts`; `setPerformanceMode` only on API 26 and later). One fix round (the audit: the test tapped before the chunk arrived).
- R155f2 e1d9ff8d (carries R155f1: the field box takes the mounted field's height before MathLive mounts, so the dash is visible in Home during a cold start; `resultItem.ts` moved out of the start chunk, 60.61 kB). One fix round (the audit: a chunk that will not load now ends the job as `error.engine`).

Doc commits on phase-1 (not pushed), by pass merge: d9562495 (92), a766f47f (93), bdecbce2 (94), d1aec9b9 (95), 1fa327ee (96), 2c28199a (97), dedd57df (98), 05a1daf7 (99), de659c02 (100), b2d67744 (101), cdea80f1 (102).

## Unmerged
- **R53 `p1/ron-results-fold`, kept at 27468a04** (results mode: the keypad folds by a handle or swipe). Ended NOT MERGED after two fix rounds: round 2 failed the vitest `FolderNames.java accepts and refuses every name`, a 5 s limit around a blocking javac run, which pass 101 reproduced under load (not R53's fault). Round 2's code has had no audit. **FIX R53f1** (ron, Sonnet) is decided and carried over; the night closed before it ran.
- **R159f2 (FIX from pass 102, not started).** R159f1's pick on pointerup drops a near-miss tap: a touch 2 px outside a chip with a 16 px finger radius reaches the chip as pointerdown and pointerup, but the `elementFromPoint` check refuses the pick and the cancelled touchend removes the click that used to pick; km/h stays (b2d67744 picked m/s on all three points). The audit could not see this, as the tests tap only chip centres. Branch `p1/ron-unitnearmiss`, ron, Sonnet.
- NOT MERGED runs that later merged: A66 (kept at aa64669d; size: start chunk 61.20 of 61.00 kB; A66f1 moved the click out), R155f1 (kept at 0a606b14; size at 61.00 kB; R155f2 made room), R159 (kept at a45d8481; unit view 66.81 of 66.60 kB, round 2 never audited; R159f1 raised the pin).

## What went wrong
- **Fix rounds:** 13 of the 24 merges needed one or two. Causes: audits (R158, R154, G182, A67, A65, A75, A66f1, R155f2), docs budgets (A64, A66, R159f1: `decisions.md` at 40.1 and 40.6 kB), line baselines (G182, A64f1), size pins (R160, A66, R155f1, R159) and e2e (R163, A65).
- **Size:** the start chunk stood at 60.90 to 61.00 kB after R151, R161 and R156, so A66 (61.20) and R155f1 (61.00) failed on a few bytes. Pass 97 and 99 decided a cut each time, not an allowance (decisions.md "Start chunk room"); the unit view pin got an allowance (R159).
- **Flakes, timing and load:** R153's first-frame test (fixed by R153f1); in pass 96's full e2e c38, c40 and bksp "Del mirror" lost their page to a navigation at the same moment, cause not found, all green on rerun (CORE 132/132 with repeat-each 2); `isTiming` tests (Working… after 150 ms; the converge case `3*int(1/x,x,-1,1)+1`, F115, fixed by G178, lane A step 495); `presetsMode.spec.ts:208` (types the name before the lazy name prompt is up; one line to fix, no backlog line because the backlog is at 20.0 of 20 kB); the folder-names Java vitest timeout (fixed by R159f1, cost R53 its merge); R155f1's round 0 "20000 random token strings" at 7185 ms and round 1 golden `step-budget-test` (506 checks) under load.
- **Slow runs:** R155f1's round 1 queue took 2735 s (golden); R159 took 04:15 to 06:58 and was NOT MERGED. Merge-queue waits of 10 to 22 minutes were normal (longest 1355 s, G185f2).
- **Device:** device 96 was skipped (lock busy). A73f1's report says the baseline measure APK was still installed on the Tab One at 01:10; devices 97 onward ran after that.
- **night.sh refused** henri's first R153f1 command at 00:57 for shell metacharacters (double quotes in the prompt); the retry with single quotes ran the same minute.
- **Pass 95** repeated the earlier verdicts ("unchanged") and its NOTES say "That notice was my own wait loop ending; nothing new": its verdicts are the A64f1, A67 and A65 lines in the log above it.
- **Lane A ran 1.5 h past 09:00** because R159f1 had started at 08:59 and needed two fix rounds.

## Opus passes (NOTES)
- 92 (R147f1, R151, R161): all ok. CORE 66/66 at 4aac2910; device 65/65. Docs a1ed893b; R151's Tab One start time comes from A73f1.
- 93 (G185f2, G182, A64): G185f2 ok, G182 ok, A64 fix (A64f1). CORE 66/66; GOLDEN GATE PASSED; device 65/65. Docs 048bba12; A64 lo-11 recommended yes, warn only; the owner answers of 10-22 to 10-31 moved to the archive.
- 94 (R162, R152, R158): all ok. CORE 66/66 at 8195f956; device 65/65. Docs f974be41; R152 mounts a hidden MathLive field at the first row (about 24 ms on the desktop; A73's start bar wants a Tab One measurement); the 30-digit e2e checks only a prefix.
- 95 (A64f1, A67, A65): all ok. CORE 66/66; device 65/65. Docs 247cd46f.
- 96 (R153, R154, R155): R153 fix (R153f1), R154 ok, R155 ok. CORE 64/66 in the full e2e, 66/66 on rerun. Docs 8488cd12; defaults: Light Shift #5b2400, the ring keeps 0.12 from `--error` in normal vision only (N62 Dark #529997 is 0.068 away under protanopia); decisions.md moved 19 built entries to the archive.
- 97 (A66, A73f1, A75): A66 fix (A66f1: a cut, plus the API 26 call), A73f1 ok (found the invisible dash, R155f1), A75 ok. CORE 66/66 at bf8d2f0e; device 65/65. Docs b7a4f4d2; a CAS-last cold start is ready at 1507 ms, 7 ms over the 1.5 s bar (A73f2 recommended after v0.1.0).
- 98 (R153f1, R156, R163): all ok. CORE 66/66 at 3ce5a67f; start chunk 60.94 of 61.00 kB; device 65/65. Docs 645bef46; R156's gallery `look-n62-flat` joins the milestone review after R24d.
- 99 (A66f1, R155f1): A66f1 ok, R155f1 fix (R155f2: make room, no allowance). CORE 66/66 at e6cfc7cd; phase-1 60,996 B gzip. Docs a45aa575; A66's device check is a backlog line.
- 100 (R155f2): ok (the pin was set before the fix round; room about 10 B). CORE 66/66 at e1d9ff8d; device 64/65 (c29). Docs 4d060c4a; R155f1's device check is a backlog line.
- 101 (R160, R159, R53): R160 ok, R159 fix (R159f1: an allowance), R53 fix (R53f1). CORE 66/66 at de659c02; device 65/65. Docs 52d8d01e; decided: Counters share a row for Shift and Alpha (seven rows), the key uses is not backed up, the unit view pin rises.
- 102 (R159f1): fix (R159f2, the near-miss). CORE 66/66 at a0e0421f; device 65/65 at cdea80f1. Docs 3a6b6865; F200 (c29).

## What the owner must do
1. **Decide** (decisions.md "Needs the user"): A83 (take `engine/giac/patches/README.md` off the shared-file list, so a patch's worker writes its row; proposed); A73f1 (A73f2 after v0.1.0, recommended); G164's 16 sample sources by the freeze on Thu 11-12; A64 lo-11 (yes, warn only, recommended by pass 93).
2. **Device checks by day** (backlog lines): A66's Key click on the Tab One (system touch sounds on and off, latency against the pulse); R155f1's dash in Home during a cold start; after R53f1, the swipe on a real WebView and TalkBack on the handle and the slice.
3. **Milestone review additions:** the Fairphone fast-typing check for R161, R162's pop and R158's 30-digit row; R156's gallery `look-n62-flat`; R153 to R155's defaults above (decisions.md "R153–R155"); the gallery look at N62, Black & White and Solarized (A82).
4. **Morning check** on the Tab One ([MORNING.md](../../tests/core/MORNING.md)): the device list was 65/65 on cdea80f1; check c29 (5 ▶ A, relaunch, A×2) by hand, and put the normal APK and STAY_ON back if a measure build is on the device.
5. **Push phase-1** when content: this night's 24 merges and 11 doc commits sit on top of earlier unpushed work.
6. **Watch:** F200 (c29); the `isTiming` tests under load; `presetsMode.spec.ts:208` (no backlog line yet; the backlog is full).

## Queue left for the next night
- **First, lane A: FIX R159f2** (ron, Sonnet, `p1/ron-unitnearmiss`), **then FIX R53f1** (ron, Sonnet, `p1/ron-results-fold`). Prompts are in the log under pass 102.
- Lane A, then: 537 R148 (After R53, so after R53f1 merges), 538 R149, 544 R157 (After R149), 554 R164 (After R161, met), then the engine rows 495 to 508 from G178 (G168, G169, G172, G173, G179, G180, G186, G187, G170, G174).
- Lane B: no rows left. The 92 packages of the must-have list (merged in a0e0421f) have no queue rows in the brief yet.
- No package yet: F200 (a second red makes a FIX), the `presetsMode.spec.ts:208` wait, and A73f2 (after v0.1.0).

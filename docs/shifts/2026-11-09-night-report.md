<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Night report 2026-11-09, the night of 2026-11-08 (22:02 to 05:38)

Pipeline runs 785 to 814 (18 package runs), Opus passes 103 to 109 (7), device runs 103 to 109 (7, all ran). Both lanes ran from 22:02 (`night.sh --lane A` and `--lane B`, `--until 05:00`). **12 runs merged** (A: R53f1, R165, R167, R166, A83f1; B: S36, A88, A89, S36f1, A89f1, A120, A123); 6 runs ended NOT MERGED (R159f2, R165, R167, R166, R148, R148f1). Four of those merged later under another run (R159f2 through R166, R165 through a review-only run, R167 and R166 on their own rerun); R148 and R148f1 are still open. Lane B had no row it could run (its only row, A73f2, waits for the v0.1.0 tag) and ended `SHIFT DONE` at 03:53. Lane A ended at 05:07 (`--until 05:00`) with the last pass and this report. Nothing was pushed.

**Core list:** desktop CORE 66/66 (known 0, needs 0) at 3eb5497a (pass 109). **CORE DEVICE 65/65 (known 0, new none) at 9538a943 (device 109, 05:38)**; devices 103 to 108 were 65/65 too, on 74c9b3f7, d7e3679d, bbe6afdf, 662ae7ad, 637a3f27 and 3eb5497a. Gates at pass 109 (3eb5497a): typecheck 0; index 0; `FIND_INDEX=required npm test` 3928 passed, 1 expected fail; e2e exit 0, 1786 passed, 12 skipped; golden not run (no engine or parser change; the last GOLDEN GATE PASSED was pass 107 at 2be73e44). The e2e was red in passes 105 and 106 (1 failed: `clipboard-lock.spec.ts:15` at its 30 s limit; green in 107).

## Merged into phase-1
Lane A (ron, annabell):
- R53f1 16c85e16 (carries R53: results mode, the keypad folds by a handle or swipe). Two fix rounds (the audit: focus lost after keyboard activation at `Fold.svelte:61`; e2e).
- R165 0d2fb275 (waits in `presetsMode.spec.ts` only; no assertion changed). Review-only run #801 on the kept branch of #793, after the first run ended NOT MERGED on tests it does not touch. One fix round (docs).
- R167 8021ec31 (timing only: 20 s on the first Num row in `commanum.spec.ts` and the readout poll in `core-lib.ts`). Ran as a queue row after pass 105; see "What went wrong" for its premise.
- R166 e45e8012 (carries R159f2: a near-miss touch beside a unit chip still picks; the click counts, 0 on the chip and 1 at 2 px below it, show one pick per touch).
- A83f1 5a58de10 (the pipeline's failure excerpt drops passing check-mark lines). One fix round (line baseline).

Lane B (sandra, annabell, gorge):
- S36 91d868b9 (the source check of the materials sample). One fix round (docs index).
- A89 06a896ef (night.sh refuses shell metacharacters outside quotes). A89f1 bfaa4c76 (a bash scanner of the quote states replaces the sed step; pass 103 had reproduced two lines it let through).
- A88 d6a78a26 (a stray file outside a worktree is logged, warn only). Two fix rounds (line baseline; the audit: a rules.md line that the brief leaves to the pass).
- S36f1 d7896454 (the two copper values of `materials.txt` set to the Cu-ETP sheet: E 110 kN/mm², alpha 16.8×10⁻⁶ per K; both lines keep "to verify: owner"). One fix round (e2e).
- A120 524bc7ce (hardening of c29; no app code; c29 not reproduced).
- A123 2be73e44 (the core runner waits for the defs write and prints defs on a red; the start pin rose to 60,720 B, under the 61 kB budget). One fix round (size).

Opus pass merges: 74c9b3f7 (103), d7e3679d (104), bbe6afdf (105), 662ae7ad (106), 637a3f27 (107), 3eb5497a (108), 9538a943 (109). Doc commits on phase-1: 298df01e (104), 85d505ac and 272b404e (105), 6ea71542 (106), 3adc09cb (107), 65902d45 (108), ae23ef7e (109). Not pushed.

## Unmerged
- **R148 / R148f1, branch `p1/ron-room`, kept at 91c84907** (more room: 4 px gaps, short rows below 760 px). R148 ended NOT MERGED at 1f1dcde9: the e2e had 6 failures and the log named one (commanum); 5 were layout failures that pass on phase-1, and the pre-flight docs and size failures had used both fix rounds. R148f1 (pass 108's FIX) fixed the layout. Round 2's checks passed, but the audit said FIX: a wait on `shell.loading` after every view key in `core-lib.ts:151` turns core c46. Pass 109 found that c46 is a real bug on phase-1 (see below) and wrote **FIX R148f2** (ron, Sonnet, same branch); it did not run, as the closing run ended first.
- NOT MERGED runs that later merged: R159f2 (kept at 6e7b481f; the audit was right that the centre-tap test could not see a double pick; R166 fixed that), R165 (kept at 65b20c93; see above), R167 and R166 (first run: `NOT MERGED (no package file for ...)`, A55, because a pass's FIX line may not use a new id; pass 105 wrote the two package files and queue rows).

## What went wrong
- **Fix rounds:** 7 of the 12 merges needed one or two (S36, A88, R53f1, S36f1, A83f1, R165, A123). Causes: audits (R53f1, A88), docs and line baselines (S36, A88, A83f1), size (A123), e2e (R53f1, S36f1, R165). Two runs ended NOT MERGED after two fix rounds (R148, R148f1); R159f2 and R165 too, before they merged by another run.
- **The failure excerpt read every e2e failure as `bksp-array`.** The pattern of `excerpt` in `pipeline.sh` matches the multiplication sign of the passing "2×2 matrix" test, so the log line of a failed e2e named it in most rounds of R159f2, S36f1, R53f1 and R165. Pass 104: bksp-array never failed. The real failures were `commanum.spec.ts:46` (3 rounds), c46 and c47 at `core-lib.ts:252` (2 rounds) and `clipboard-lock` (1 round), all waits at 5 s or 30 s under load. A83f1 fixed the excerpt. A failed check still logs only its first failing test, and an audit APPROVED beside a red e2e reads as nearly done (pass 108: one of six failures was named); no package yet.
- **R167's premise was wrong** (pass 108): the comment at `commanum.spec.ts:46` says the first row waits for the engine, but `FunctionNum.svelte` draws it with no engine call, so a longer wait cannot help when the row is missing. F201 has the same shape (Symb, sin x, Enter, Num says no function is on).
- **c46 is a real bug on phase-1, not a flake** (pass 109): during the Function app's load, a view key (Symb, Plot, Num) overtakes the keys already waiting (`route.ts:378`), so Symb, x²−2, Enter, Plot loses F1. The FIX is a two-line change in `route.ts` with a test that holds the app chunk back; measured by pass 109 on phase-1 3eb5497a: core 3 of 3 runs green against c46 red 3 of 3 without it. F201 is likely the same cause, not rerun red.
- **Not run, read only** (pass 109): a failed app load has no rejection path at `route.ts:318`, so waiting keys stay queued; no package yet.
- **night.sh pass numbers:** henri asked for passes 101 and 102, which were taken; the pipeline moved them to 103 and 104.
- **Waits:** merge-queue waits of 6 to 16 minutes were normal; R165's first run waited 758 s for host-cpu, R53f1 657 s (sofia held it 607 s).
- **A89's check was incomplete** (pass 103): a bare semicolon after an escaped quote, or after a double quote inside single quotes, was accepted and run under eval. A89f1 fixed it (pass 106: 40,000 random lines through real eval ran no second command).
- Pipeline selftest ran 5 times, all PASSED (298 to 335 s). gc ran 4 times (report `.tasks/gc-2026-11-09.md`).

## Opus passes (NOTES)
- 103 (S36, A89, A88): S36 ok, A89 fix (A89f1), A88 ok. CORE 66/66 on desktop at d6a78a26; 3916 unit tests passed, e2e 1771 passed; device 102 65/65. S36: the JRC slide J1 (32 against 33 for E_C30) refused the connection twice, so that row stays on the owner's short list; S36f1 applied the two copper edits.
- 104 (R159f2, R53f1, R165): R159f2 fix (R166), R53f1 ok, R165 ok. CORE 66/66 at d7896454; e2e 1784 passed. bksp-array never failed; R165 differs from green phase-1 only in `presetsMode.spec.ts`. R53's device check is now a backlog line.
- 105 (R167, R166, A83f1, R165): R167 and R166 never ran (no package file); A83f1 ok, R165 ok. CORE 66/66 at 0d2fb275, e2e red on `clipboard-lock` (fixed on R166's branch). A new id is not a FIX line: the pass writes the package file and a queue row; the brief's Opus pass section now says so.
- 106 (S36f1, A89f1, A120): all ok. CORE 66/66 at bbe6afdf, e2e red on `clipboard-lock` again. A120's question decided as a default: new package A123, no `main.ts` pagehide flush (pagehide cannot wait for a promise). `decisions.md` shortened (eight built entries to the archive).
- 107 (A123): ok. CORE 66/66 at 2be73e44; golden PASSED. Small gaps, no package: no test ties `defsStore` to the promise it returns; the pin's comment says 60,672 B + 0.05 kB, which is 60,722, not the 60,720 pinned; the worker saw c46 red once under load, not reproduced.
- 108 (R167, R166, R148): R167 ok (wrong premise), R166 ok, R148 fix (R148f1). CORE 66/66 at 637a3f27. F201 new. Default added: a sheet that cannot fit at its floor scrolls at 360 x 740.
- 109 (R148f1): fix (R148f2, the key queue). CORE 66/66 at 3eb5497a; device 65/65. F201's backlog line gives the cause.

## What the owner must do
1. **Sign G164's sample sources** (decisions.md "Needs the user"; [S36](2026-11-sandra-sample-sources.md)) by the freeze on Thu 11-12: seven clauses to read, including the two copper values and the J1 row. If not signed, the lines stay "to verify".
2. **Device check by day** (backlog line): after R53f1, the swipe on a real WebView and TalkBack on the handle and the slice.
3. **Look at R148's layout** after R148f2 merges: 360 x 740 (the keypad 434 px; the Mode, Settings, Appearance sheet scrolls there by default, overflow at most 17 px).
4. **Push phase-1** when content: this night's merges and doc commits are local.
5. **Watch:** F201 (commanum, after R148f2) and F200 (c29, 135 of 135 green); the `clipboard-lock` e2e at its 30 s limit under load.

## Queue left for the next night
- **First, lane A: FIX R148f2** (ron, Sonnet, `p1/ron-room`; the prompt is in the log under pass 109). Row 537 (R148) stays until it merges; then rows 538 R149, 544 R157 (After R149), 554 R164 (After R161, met), and the engine rows 495 to 508 (G178, G168, G169, G172, G173, G179, G180, G186, G187, G170, G174).
- Lane B: row 559 A73f2, After the v0.1.0 tag; nothing else.
- No package yet: the pipeline's one-of-six failure log; the missing rejection path at `route.ts:318`; the `defsStore` promise test of pass 107.

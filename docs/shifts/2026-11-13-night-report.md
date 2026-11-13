<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Night report 2026-11-13 (lanes A and B, 2026-11-12 19:01 to 2026-11-13 06:34)

Both lanes started at 19:01 (`night.sh --lane A` and `--lane B`, `--until 05:00`). Pipeline runs 1060 to 1091: 20 package runs, 8 Opus passes (158 to 165), 7 device runs (device 158 skipped). **16 runs merged** (A: 8, B: 8); **4 runs ended NOT MERGED** (R278f1, G224, G226 and R281). Three of those four were finished by a follow-up run the same night (R278f2, G224f1, G226f1); **R281 is still open** (FIX R281f1 is ready). Lane B closed at 05:39 (15 steps); lane A closed at 06:34 (15 steps) and started this report. The log shows no push: phase-1 stands at 40b11ad5 (pass 165).

**Core list:** desktop CORE 72/72 (known 0, needs 0) at passes 158 to 161, **73/73 at passes 162 to 165** (c72 and c73 are new; c73 is R280's). **CORE DEVICE 72/72 (known 0, new none) at 40b11ad5 (device 165, 06:34)**; devices 159 to 161 were 71/71 (db187e04, 065150c5, fd7881a3), devices 162 to 164 72/72 (8214eddf, 1898c794, e40d8009). **DEVICE SKIPPED at pass 158 (battery 7 %)**. Gates at pass 165: typecheck 0; `FIND_INDEX=required` vitest 4732/4732 (pass 164); e2e 1971 passed, 12 skipped, 0 failed; GOLDEN GATE PASSED at pass 164 (regress patched 345/345, patch-canary 86 causes, calls-home 9.16 per input against a limit of 9.86). Pass 165 did not run the golden gate (no engine or parser code changed since pass 164).

## Merged into phase-1
Lane A (ron):
- R277 5bfdb4c1 (touch drag scrolls the entry line, a tap places the caret, a hold selects the term; the number rule lives once in `numberRun.ts`). Run #1060 after the review-only rerun that pass 157 asked for.
- R279 6f8bd599 (Select and Deselect walk the box-model chain; start-chunk pin 61,210 to 61,400 B, reason in `size-check.ts`).
- R278 a6b4bbcb (the Copy and Paste keys are gone; the keys and tests match the package). R278f2 1974ad78 (the finished branch `p1/ron-apppaste`: R278f1's Paste item in each app's ☰ menu; `history-first.spec.ts` and `helpers.ts` put back to phase-1's text; core case c71 rewritten so a failed hold or paste gives 4 and a ☰ that does not open gives 8).
- R283 e03ec772 (the fold handle is gone, the swipe stays; R53's tests rewritten to the swipe).
- A139 f38b5378 (touch check; steps 1 to 3 pass on the Tab One, steps 4 and 5 are the owner's).
- R290 e5e55c36 (the six tip cards say K5's four points and name no control that is gone; R171's fit test adds 412 × 915).
- R280 6b7abf36 (Store ▶ on a picked row takes `ClipActions.storeRow`; c73 added).

Lane B (ron, gorge):
- R191f1 a7214c9b (spacing anywhere inside a `0x`, `0b` or `0o` literal is refused with `parse.baseSpace`; `0\,x+1` stays `0*x+1`; parser golden 687/687).
- R192 240df474 (HEX, BIN and OCT as display forms of an exact integer, from the lazy forms chunk). R193 0325e5cb (Shift + − opens a lazy four-row Base menu, dead with text on the line).
- R195 3adeda3c (Find's preview ends with the key that inserts the function, e.g. "· Shift sin").
- G340 390c2af4 (patch 0045: `algnum_convert` rewrites every `rootof`, also one inside a power; 22 Home and 8 CAS values checked against mpmath at 35 digits; shared engine key ed88414b97a21ee0).
- G224f1 53c2443f (G224: PFX drops trailing zeros after rounding, `4.7 k`, 999.96 k at 4 digits gives `1 M`; ENG keeps its zeros, the σ line keeps `9.0 G`; Copy gives the full value; test titles and the e2e text brought up to date).
- G341 1925fc1d (`isOurName` serves the parser, the library reader and the state read; names starting with `pas` are refused with the reason; Find's `median`, `percentile` and `sem` name Giac's word).
- G226f1 780fe625 (G226: patch 0046, an exact integer shift through GMP; F240 named in the census file, the probe and the backlog; shared engine key 9ffdb681df3cda49).

Opus pass merges: 815df931 (158), db187e04 (159), 065150c5 (160), fd7881a3 (161), 8214eddf (162), 1898c794 (163), e40d8009 (164), 40b11ad5 (165). Their doc commits include 18834be3, 58a69e2b, 3ccb17e4, dde4fb10, 16566967, 1bbd596a and 7e1fa323. The day session's docs commit 183c19a7 (21:50) made room in decisions.md, backlog.md and docs/04.

## Unmerged
- **R281** (ron, Opus, lane A, the store sheet). Run #1087 on `p1/ron-storesheet`: round 0 failed vitest (G341's `pas` tests against a branch that predates it), round 1 checks passed and the audit said FIX (`parse.ts:412`, `storeName`), round 2 checks passed and the audit said FIX (letters typed into the store sheet are dropped); **NOT MERGED after two fix rounds at 06:11, the branch kept at 389b6077**. Pass 165 confirmed the finding: `route.ts` `sheetPress`, the case at line 297 closes the sheet and throws away the typed letters, so `7`, Shift + ᴇ, `x`, Shift + ␣, `0`, Enter reads `7▶_0` and errors where phase-1 stores into `x_0`. Pass 165 wrote the FIX R281f1 (same branch, ron, Opus: type the sheet's filter onto the line before it closes; a storeKeys test and a store.spec e2e; `refuseStore` moved in `parseTables.ts`; docs lines removed). The worker's open question (the sheet sits above the keypad, not over rows 3 to 9) is decided: it sits above the keypad.
- Not merged at first, merged later: **R278f1** #1074 (NOT MERGED at 00:12: the round 2 audit objected that it loosened `history-first.spec.ts`, and its `helpers.ts` change blocked the pipeline's one flake rerun, A129; the branch finished as R278f2). **G224** #1068 (NOT MERGED at 21:41 after four rounds; the code was right, its tests and the e2e spec still had the old PFX text; finished as G224f1). **G226** #1080 (NOT MERGED at 03:10 after round 3; the audit asked for F240 to be named in three places; finished as G226f1).

## What went wrong
- **history-first.spec.ts failed four times under load** (pass 159's e2e, R278f1 round 1, a FLAKE line in R283, G224f1 round 1) and never before; it passes alone. G224f1's round 2 had raised its bound from 15 to 20 (da18fc18); it is backlog F236: find the second re-format, the fix sets 15 again. Other load reds: the steps stage stopped G325 and G340 rows at the ×8 clock (G224 round 2, G224f1 round 0, `step-budget-test`); four e2e specs (`decimalcomma`, `fold`, `rows`) timed out after 5 minutes in G224 round 4 and passed alone.
- **Size and docs checks cost free rounds:** R192 (size), G224 (size, then docs/04 70.1 kB), G226 (backlog.md 20.1 kB). The start-chunk pin text failed R279 round 0 and G224 round 1.
- **Audit FIX verdicts:** R278 (docs/04 still named the Copy key), G340 (backlog line gave patch 0045 and 0046 wrongly), G224 (the σ line's second sign, test titles), G226 (the `convert` census class, then F240), R281 (twice, above).
- **Merge-queue waits:** a full merge run held integ about 770 to 1,150 s (a light one 60 to 500 s); host-cpu waits ran to 1,003 s (R279), 909 s (R281), 951 s (R277), 760 s (R281 behind pass 163), 719 s (G226f1). The R277 rerun waited 527 s for integ before its first audit.
- **Workers over 30 min with no reply file:** R279 (alive 30 and 60 min, 43 and 73 min after its last commit; its fix round 2 came at 21:25), G340, R281 (30, 60 min), G341.
- Pass 157's number was taken and became 158, pass 159 the same (it became 160, after 530 s for the pass lock). gc ran three times (19:59, 00:32, 02:10; report `.tasks/gc-2026-11-13.md`).

## Opus passes (NOTES)
- 158 (R191f1, R192, R193): all ok. CORE 72/72; gates pass (4650 vitest, e2e 1943, golden parser 687/687). R192's defaults (not padded to the word, so 10 is 0xA; a value outside the word keeps its notation) are in docs/04 5.4, as decisions.md was full. Copy marks a whole exact integer by the row's notation, so 2^64−1 copies as ≈ while the screen shows `= 0xFF…F` (kept, a backlog line, not a wrong value). In the hex base only, a letter a to f after a space is refused (`0x10 a` is refused, not 16·a). Device skipped, battery 7 %.
- 159 (R277, R279, R278): R277 ok, R279 ok, R278 fix (the apps lost their only paste on a phone; c49 passed even when the hold and the paste did nothing) → R278f1. CORE 72/72; e2e 1964 passed, 12 skipped, 1 failed (`history-first.spec.ts:39`, 20 renders against 15 under load, 3/3 alone). The `enginefail` FLAKE lines date from before R284f2, no backlog line.
- 160 (R195, G224, G340): R195 ok, G340 ok, G224 fix (code right, tests and e2e spec still on the old PFX text; only `fmt.spec.ts` of the round-4 e2e failures came from G224) → G224f1. CORE 72/72; vitest 4676, e2e 1965, GOLDEN GATE PASSED. New backlog line F231: `normal((1+sqrt(1+2^(1/3)))^(1/3))` runs past Giac's clock, so the CAS view waits its full 600 s. `tests/golden/README.md` counts are stale until `trust:refresh`.
- 161 (R278f1, R283, A139): R283 ok, A139 ok, R278f1 fix → R278f2 (restore the two shared test files; c71 rewritten). CORE 72/72; vitest 4678, e2e 1965 passed, 0 failed. F236 (history-first). A139's findings decided: a drag that scrolls a long row to its end no longer slides it on (F237), dead keys get `aria-disabled` (F238). The TalkBack and font-scale 2.0 hand check stays the owner's.
- 162 (R278f2, R290, R280): all ok. CORE 73/73; vitest 4710, e2e 1971 passed, 0 failed. After R197 merges no tip teaches the Help key (R290 leaves that to a later package).
- 163 (G224f1, G226, G341): G224f1 ok (one overreach: the bound in `history-first.spec.ts`, F236 line updated), G341 ok, G226 fix (patch 0046 right; `prog.cc:9345` takes the list subtype of `convert(129,2,1/2)` from a pointer, F240) → G226f1. CORE 73/73; vitest 4731, e2e 1971, GOLDEN GATE PASSED (home 884/884, precision 1365/1365, parser 687/689, 2 known gaps). New lines F239 (a function body with a float `==` test never survives a library export and import) and F240. G341's release-notes line is in A91.
- 164 (G226f1): ok. CORE 73/73; vitest 4732, e2e 1971, GOLDEN GATE PASSED. F241 (new, no package): `rotate(5)` gives 2 and `shift(l,1.5)` shifts by 1, silent wrong answers from Giac's `shiftrotate`, on the backlog's Giac line. The stale trust counts wait for the tag ("fresh at the tag only").
- 165 (R281): fix → R281f1 (above). CORE 73/73 on desktop at e40d8009 (the pass ran on phase-1 without the golden gate). decisions.md is 39.6/40 kB after the old Store (S53) entry left "Needs the user".

## What the owner must do
1. **The Tab One must stay charged:** device 158 was skipped at battery 7 %. The core device runs 159 to 165 all ran.
2. **A139's hand check:** TalkBack and font scale 2.0 (steps 4 and 5); the R41 line in the backlog. Also look at R277's line scroll and the R276 hold and swipe on the Tab One (c71 and c72 passed on the device).
3. **Upstream:** MathLive issue M6 (the scroll position of the hidden content element; text in `../outreach/upstream-reports.md`) is still to file. Patches 0045 (G340) and 0046 (G226) are new and the log shows no sending; F227, F228, F240 and F241 are engine bugs, F240 and F241 in the Giac line under Upstream reports.
4. **Docs room:** decisions.md 39.6/40 kB, backlog.md 20.0/20 kB (pass 163 left about 190 bytes); the next pass that adds lines must first remove done items (backlog.md item 8 shrank by the words "R281 store sheet spot").
5. **Items in "Needs the user"** (backlog.md): S36's list of G164's sample sources by the freeze (11-17); R269 round trip; the UI look on the Tab One. No new owner decision came from this shift: pass 165 decided where the store sheet sits.
6. **At the tag:** `trust:refresh` (the `trust:check` counts in `tests/golden/README.md` and `README.md` are stale). Freeze Tue 11-17, tag Mon 11-23.
7. **Push phase-1** when content: this shift's merges and doc commits are local according to the log.

## Queue left for the next run
The lanes restart by themselves after each close to Tue 11-17 .
- **Lane A:** R281f1 first (a FIX on `p1/ron-storesheet`, kept at 389b6077; row 631 stays until it merges), then R282 (632, after R281), R196, R197, R185, R186, R187, R131, R198, R224, R291, then R188 to R190, R130, R221, R220, R174, R265 and on down the table. Rows 628, 626, 629, 627, 630 and 753 are out (merged).
- **Lane B:** G342 (756), R199 (683), G331 (699), G330 (698), G306 to G309 (610 to 613), S52, R194, R184, then G210 to G217 and the sync and unit rows; A73f2 (559) after the tag. Rows 678, 679, 681, 737, 738, 739 and 755 are out (merged).
- **No package yet:** F231 (a 600 s wait in the CAS view), F236 (history-first, a bound that stays at 20 until its fix), F239, F241, the 2^64−1 Copy mark (≈ on screen `=`), F226 and F215's rest from the last report.

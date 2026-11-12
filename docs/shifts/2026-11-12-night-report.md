<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Night report 2026-11-12, the night of 2026-11-11 (14:21 to 07:17)

The shift ran from 14:21 on 11-11 (`night.sh --lane A` and `--lane B`, `--until 05:00`). Pipeline runs 978 to 1021: 28 package runs, 10 Opus passes (142 to 151), 10 device runs (all ran, none skipped). **26 runs merged** (A: 13, B: 13); **2 runs ended NOT MERGED** (R284 and G235, both lane A, after two fix rounds), and each package merged later under a follow-up run, so no branch is open. 25 fix rounds were used. Lane A closed at 05:21 (`NO PASS`) and waited for lane B; lane B's last package, G325f2, was started at 04:45 and merged at 06:52, then pass 151 (07:05) and device 151 (07:17). Nothing from this night was pushed; phase-1 stands at 71591c9c.

**Core list:** desktop CORE 70/70 (known 0, needs 0) at every pass (pass 151 on e5e2bdec). **CORE DEVICE 69/69 (known 0, new none) at 71591c9c (device 151, 07:17)**; devices 142 to 151 were all 69/69. Gates at pass 151: typecheck 0; `FIND_INDEX=required npm test` 4471/4471; e2e 1922 passed, 12 skipped; GOLDEN GATE PASSED (calls-home 9.23 against its limit 9.86).

## Merged into phase-1
Lane A (ron, gorge):
- R285 1fb90fcb (a note for browsers other than Chrome, a lazy chunk shown once; `TESTED` is blink only). R284f1 130f0f69 (the engine-failed note's words and Reload button in a lazy chunk, the failure kind from the error's class, the submit guard; start pin 61,600 B) and R284f2 40ef8e0e (test-only: the waits after Reload read `window.n62?.`).
- G174 45364e41 (48 argument-store heads cite Giac's source; `gbasis` and `syzygy` leave no `lastgb` or `lastv`; `debug` is refused; start pin 61,400 B). G223 cb9fbe38 (stats in Find) and G223f1 18a1431a (program words are never asked as names; `linreg`, `stats1` and the bit functions are audited ours). G229 bd3f5a38 (word operations: `shl`, `shr`, `rotl`, `rotr`, `bnot`). G235f1 eaff256f (Bits and words, the eleventh Find category, no digit).
- R264 83a731e5 (`giacPrintStart.ts` moved; the start pin went down to 60,790 B gzip). R259 fbff2ff8 (the unit view reads Ans once; an Ans with a unit or a σ is refused). R263 b3ee134e (`lazyOnce` loads nine chunks, a failed load is retried). R262 debc0f4e (To Home sends a Solve or Function answer as a chip with its facts). R266 8c66aac4 (a key press skips the first-start tips for that start).

Lane B (gorge, annabell, ron):
- A144 d55b37b1 (browser checks for Firefox and WebKit) and A144f1 12e55f09 (the Solve Num button is `box-sizing: border-box`; c44 passes in Firefox).
- G319 2b65206b (the unit view refuses what Home refuses). G320 e4413d76 (bench calls baseline re-measured to 477/57). G321 fd679565 (18 libqalculate unit ids get explicit `_US` ids). G329 007ef6ff (the calls stage passes the value's tree on; baseline 498/57 and 6434/718).
- G324 e6d907af and G324f1 b9823992 (a root's Giac noise is dropped from the shown value and from the stored name; the invariants limit is 70 ms per input).
- G325 c29ee6e6 (patch 0044: `asin` and `acos` real part at the cut; engine key cb959d0eb7210be8, was bedf1255832ad92a), G325f1 fefb7553 (the argument is judged real at MPFR precision; `markOf` shows ⚠ 0 for 0 confirmed digits), G325f2 e5e2bdec (each asin, acos and acosh call is checked against MPFR on the float route).
- G231 9cdf5fab (one example with its mark for every tier-0 function). G222 a59f1dbd (five distributions in Find).

Opus pass merges: 76675067 (142), 43cb1a7d (143), baf060ce (144), 141927af (145), 08dbae38 (146), a2b08269 (147), 4358de77 (148), d6f71fe6 (149), 9937f0e6 (150), 71591c9c (151). Their doc commits include 72f818d8, 873352d6, 83a8aab2, 5b646b8e and e608a424.

## Unmerged
Nothing is open. The NOT MERGED runs and what closed each:
- R284 #979: round 2 raised `START_PIN_GZIP` to 61,450 but `size-check.test.ts` still expected 61,400. Closed by R284f1 #990.
- G235 #1003: round 0 the listargs table, round 1 findcensus `GONE bitand`, round 2 13 e2e failures: six were the branch (ten category rows became eleven), seven were one hang of `fold.spec.ts:216` that held the clipboard lock for 360 s. Closed by G235f1 #1006.
- Branches `p1/ron-enginenote` and `p1/gorge-bitsfind` can go once their merges are checked.

## What went wrong
- **`enginefail.spec.ts` flaked six times in five runs** (987, 995 twice, 996, 998, 1000): after Reload the wait read `window.n62.session`, which is undefined during the reload. R284f2 fixed it at 22:56; no FLAKE line has come since.
- **Size pins decided eight rounds:** unit view + shared (G319, G223), the start chunk (R284 three times, G174, G223f1) and the inline-script pin (R285). A124's free round was used by G319, G174, G223 and G223f1.
- **Sofia's FIX verdicts found real bugs:** A144 (SolveNum button covers the value cell), G324 (the name kept Giac's noise), G223 and G229 (a syntax error with garbage bytes from `complexReads` asking `local` as a name), G325 (an imaginary part below the double range read as 0, a false ≈), G325f1 (the float route still wrong). G325f2 needed two fix rounds and ended at 06:52, two hours past the stop time.
- **Waits:** merge-queue waits were 441 s for a light run and 1,000 s for a full one; host-cpu waits ran to 992 s (G325f1) and 986 s (G324f1); pass 144 waited 523 s for integ. The clipboard-lock hang above cost G235's round 2.
- gc ran nine times (reports `.tasks/gc-2026-11-11.md` and `gc-2026-11-12.md`).

## Opus passes (NOTES)
- 142 (A144, G319, G320): A144 fix (the Solve button; A144f1), G319 and G320 ok. Core 70/70; the `int(1/x^2,x,-1,1)` message gap is a test row in the arch review's X14, no id. Legacy wasm exceptions stay (the new encoding needs browsers newer than Chrome 111).
- 143 (R284, R285, G174): R284 fix (test pin; R284f1), R285 and G174 ok. Old logs with `lastgb` or `lastv` get no migration. R285's `gecko` follow-up is in the backlog's A144 line, `webkit` in R225.
- 144 (A144f1, G321, G324): G324 fix (the stored name; G324f1), the others ok. Not checked: `refresh-factors.mjs` against a qalc build (the dev build exited 77 on this host). The (c) copy tie of `1.32471795724` is decided in decisions.md "Home number formats", no id.
- 145 (R284f1, G223, G229): G223 fix (G223f1, covers G229's `bnot` too), R284f1 ok with R284f2 for the test race. Not packaged: typed `shl:=3` then `shl(1,2,8,0)` shows `= 3` (`par:=3` too); G223's proposal to put back only `eval_level` after a refusal's throw is undecided.
- 146 (G223f1, R284f2, G235): G235 fix (six e2e row counts; G235f1), the others ok. One backlog line: stats1 of a stored float list shows `[..]` where a typed list shows `{..}`, and a stored `catch(e)` prints as `catch(exp(1))`.
- 147 (G324f1, G329, G325): G325 fix (G325f1), the others ok. Patch 0044 is listed with 0037 to 0043 as not sent.
- 148 (G235f1, R264, R259): all ok. R259's Ans slot is a plan change: decisions.md and backlog "Needs the user", recommendation: not before v0.1.0.
- 149 (G325f1, G231, G222): all ok; G325f2 for the float route (F224 reopened).
- 150 (R263, R262, R266): all ok. R262's default (the app's line, half-typed text too, does not follow To Home) is in decisions.md with R76. `Session.uses()` keeps a failed load: one backlog line. Three built entries moved to the archive to fit decisions.md.
- 151 (G325f2): ok. Probed asinh, atanh, atan, acot, acoth, ln, arg, sqrt and `^(1/3)` at the cuts: no other function shows the same wrong value under a mark. F225: `evalf(sqrt(-2+i/10^330))` shows ⚠ and a wrong value (flagged, not silent), no package. Nit: the host.ts reason in `tools/line-baseline.yaml` still names `floatsContradict`.

## What the owner must do
1. **Parisse:** patches 0037 to 0044 are not sent; 0044 (asin and acos at the cut) is new; F214 (decompose recursion), F219 and F225 have no patch.
2. **Look in the v0.1.0 UI check:** the volume cell's ↑ legend now reads `gal_US`; a chip's `\mathrm` with an underscore (`gal_US`, `gal_UK`, `s_ton`) may draw as a subscript (pass 144).
3. **Decide R259's Ans slot in the unit view** (recommendation: not before the tag), the R269 round trip, and the Store design (S53); sign S36's list of G164's 16 sample sources by Thu 11-12 (today).
4. **Docs room:** backlog.md and decisions.md are still at their budgets (decisions.md 39,998 of 40,000 B at pass 148).
5. **Push phase-1** when content: this night's merges and doc commits are local. Still open from the earlier reports: the F-Droid Reproducible Builds box, R173's report form look. A136 is a day package for Thu 11-12 and A140 by day before it. v0.1.0 stays on Sun 11-15, the video on Sat 11-14.
6. **If the fold hang comes back** (a test holding the clipboard lock waits out 360 s and six specs fail behind it) it needs a package that gives the lock holder's steps a shorter timeout; there is no backlog line yet.

## Queue left for the next night
The tables of brief 0c at the end of this night:
- **Lane A:** 638 R260 (After G311), 656 R286 (After G319, merged), 657 G327 (After R284, merged), 658 G328 (After G174, merged), then the rows behind the v0.1.0 tag or each other: 624 R276, 625 R277, 628 R279, 626 R278, 629 R283, 627 A139, 630 R280, 631 R281, 632 R282.
- **Lane B:** 587 G227 (After G225), 639 G316, 640 G311, 641 G312, 642 G313, 652 G323, 659 G326 (After G325, merged), 660 S54, 559 A73f2 (After the tag), then 610 G306 to 613 G309 (After the weekly night).
- **No package yet:** F214, F216, F217, F219, F221, F225 (F215, F218 and F222 have G328, R286 and G327); the `shl:=3` overwrite; the stored-list `[..]` and `catch(e)` line; the `eval_level` proposal; the fold-lock hang if it recurs.

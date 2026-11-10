<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Night report 2026-11-10, the night of 2026-11-09 (08:26 to 06:05)

The shift ran around the clock from 08:26 on 11-09 (`night.sh --lane A` and `--lane B`, `--until 05:00`). Pipeline runs 818 to 902: 50 package runs, 17 Opus passes (110 to 126), 17 device runs (14 ran, 3 skipped). **38 runs merged** (A: 17, B: 21; 37 packages, plus a review-only merge of G225f2); **12 runs ended NOT MERGED**, and every package they carried merged later under a follow-up run, so no branch is open. 37 fix rounds were used. Lane B closed at 05:04 (`NO PASS`, 39 steps, `SHIFT DONE`); lane A's last package, G186, merged at 05:39, then pass 126 and this report. Nothing was pushed.

**Core list:** desktop CORE 69/69 (known 0, needs 0) at pass 126 (66/66 in passes 110 and 111, before R170 added c67 to c69). **CORE DEVICE 68/68 (known 0, new none) at ddd51dde (device 126, 06:05)**; devices 110 and 111 were 65/65, 112 to 118 and 122 to 125 were 68/68 (the count pass 112 predicted after R170). **Devices 119 (battery 8 %), 120 and 121 (`device 'HA24BZ2Y' not found`) were skipped.** Gates at pass 126: typecheck 0; `FIND_INDEX=required npm test` 248 files, 4160 passed; e2e 1846 passed; GOLDEN GATE PASSED (pass 125: home 695/695, precision 1277/1277 active, 3 pending).

## Merged into phase-1
Lane A (ron, gorge):
- R148f2 a423070e (the view key waits behind queued typing; c46 green with the replay back as on phase-1). R171 72e872c6 (tips text capped at 18 px; six cards cannot fit 360 x 740 at 32 px). R170 521ae3fe (core cases c67 to c69). R172 16380d5b (bug-form text). R173 c83ccfb4 (report row, second run). R164 ff828327 (press-flag).
- R149f2 6fceb953 (credits sheet; the Array polyfills removed as pass 118 authorised, Chrome 111 minimum). R157f1 d17bebe6 (logo mark; start chunk 60,935 B, pin that plus 0.05 kB).
- G178 8b8fd8bc (divergent shapes inside larger inputs refused). G168f1 703af0e3 (lost-number refusal; the Num table keeps undef as on phase-1). G169 bdd20344. G172 eba7ec10 (lists of doubles, cap of 32). G173 e0580ff6 and G173f1 99cd0c47 (a sequence stored with the arrow becomes a list). G179 0b5adce8 (patch 0039). G180 adaff1bd (float path past 2 kB). G186 8daa29fc (patch 0040: Giac's endless exact-power loop; all 20 F145 rows that hung answer in about 1 s).

Lane B (ron, gorge, annabell):
- R180 d89df4cc (`∡` binds as the owner decided; closes F192, the v0.1.0 bar's phasor point). A90 47b5fe22 (release notes check). A92 9b08ce17 (form field, PRIVACY sentence). A93 35b763ae (trust facts from the files). A94 caae1873 (about facts).
- G200 29ffae0c (`oracle.py` exits 0 on the tree). G202 1c4026ae (oracle counts). G300 782b641c (DEG chain). G201f1 dc27bb1d (four trust rows). G301 cac10d87 (CAS DEG quotient). G220 d2c58a12 (normal cdf oracle rows). G228 6399c018 (base formats). G225 303b3d12 and G225f2 c052dd72 (unequal vector and matrix shapes refused, `lengthsDiffer`, `vectorsOnly`). G303f1 d2560503 (every name our Giac text binds is `pas…_`). G221f2 925bafcb (free names no longer reach the cdf and inverse wrappers).
- A38f1 485dd71f (a modify/delete conflict no longer kills the run). A96 f53c0ec7, A97 69c39a6c, A97f1 6153c7ef, A98 8ef0fc46 (F-Droid pin, build, source scan, submit notes). The shared engine key changed at A96, A97, G169, G179 and G186 (now 3d52ed3bdc10c7c6).

Opus pass merges: 816670e7 (110), efa226bb (111), cbb57e62 (112), 099f0451 (113), 460d9878 (114), 4020183b (115), 4fb97ef7 (116), ee72987a (117), 5b9fcf7f (118), 6e21e326 (119), ec58fc58 (120), aa57eb81 (121), 51a4d240 (122), 4db9dfd2 (123), e947b372 (124), 0a9dfdae (125), ddd51dde (126). Their doc commits include f1ed9f50, 29ebc8f6, 5b2e79f3, 7a7dd6d1, c7a9b8f9, fb189947, c1dfa3ad, 587ccd52, 0e04f889, b98bf7ed, 4e09bd2e and c7c32c95. The owner's day session added 2ab9cf31 (A124 to A132, rows 594 to 602) and af613393 (testing guide). Not pushed.

## Unmerged
Nothing is open. The NOT MERGED runs and what closed each:
- R173 #820 (ran before R172; built nothing) closed by #833. G201 #823 (step 2 needed G202's file) and the review-only #831 (died on a modify/delete conflict) closed by G201f1. R149 #838 and R149f1 #852 (start chunk 61.01 kB against 61.00; a lock change outside the package) closed by R149f2. G168 #853 closed by G168f1. R157 #872 closed by R157f1. G225f1 #871 and G225f2 #881 closed by the review-only run #897. G221 #873 and G221f1 #885 closed by G221f2. G303 #887 closed by G303f1.
- Kept branches that can go: `p1/ron-reportrow` (holds nothing worth keeping), `p1/gorge-trustrows` and the worktree `pl-823-g201` (left mid-merge), and the branches of the runs above once their merges are checked.

## What went wrong
- **A row ran before its After.** Henri ran R173 before R172 (rows 560 and 561 were skipped); the run built nothing and spent three rounds. A127 (row 596) makes a row wait for its After.
- **A modify/delete conflict killed a run** (#831): a grep on a file without markers ended `merge_phase1` under `pipefail`, with no RESULT line. A38f1 fixed it and added a regression test.
- **Packages stopped as "not done" for scope remainders** (G201, G221, G221f1): the worker listed what lies outside the block. Pass 121 wrote the answer rule into G221f1's prompt; A131 (row 599) is the pipeline side.
- **The start chunk budget decided three packages:** R149f1 failed at 61.01 kB against 61.00, R157 at 60,999 B with no margin. Pass 118 removed the dead Array polyfills; pass 120 required a pin with margin (decisions.md Start chunk room). A128 (row 594) raises the budget to 63 kB (owner).
- **Flaky checks:** e2e `showcase.spec.ts:64` (E 72.25 kg × g₀) failed in R149 rounds 0 and 1 and G168f1 round 0 and passed on rerun; `clipboard-lock.spec.ts:15` failed in G301 round 0 (F202 holds the lock, A125); `presetsMode.spec.ts:44` failed 9 of 300 on phase-1 (fixed in R157f1); `fdroid-recipe.test.ts` failed once on a fetch (G220, G225f2). The `this.host.calc.ready is not a function` line is a test stub's log on phase-1 too, not a failure.
- **The device was lost** after pass 118: 119 skipped at 8 % battery, 120 and 121 with the serial not found; 122 ran again.
- **Waits:** merge-queue waits of 6 to 17 minutes were normal; host-cpu waits ran to 961 s (G225f2 round 1) and 946 s (G179's engine build).
- gc ran 15 times (report `.tasks/gc-2026-11-10.md`).

## Opus passes (NOTES)
- 110 (R148f2, R173, R171): R148f2 ok, R173 re-run after R172, R171 ok (18 px stands). CORE 66/66 at 72e872c6; e2e 1795 passed.
- 111 (R180, G200, G201, G202): all ok; G201 as a review-only merge (later replaced). CORE 66/66; GOLDEN PASSED. R180's `10∡30 mod 2` takes the phasor only by pasted LaTeX.
- 112 (R170, R172, R173): all ok. CORE 69/69; vitest 3974. R173's by-hand look is on `tests/core/ONE-TIME.md`.
- 113 (G201, G300, A90): G201 fix (G201f1), G300 ok, A90 ok. Run 831 died on the grep (A38f1). Only a tag with a `-` is a pre-release.
- 114 (G201f1, A38f1, A92): all ok. PRIVACY's "opens the bug form in your browser" holds on Android only after A95; reword it before the tag if A95's first check fails.
- 115 (R149, R164, G178): R149 fix (R149f1; with N stored, the line N62 is a calculation, 5 stored gives 310), R164 ok, G178 ok. F202 filed (clipboard lock has no fair queue).
- 116 (A93, A94, G301): all ok. `trust:check` is stale by design until the tag. G301's CAS DEG quotient has no bound of its own (7 s on a long root sum; F196).
- 117 (A96, A97, A98): A97 fix (A97f1: scan count 7 measured with fdroidserver 2.4.5). F-Droid Reproducible Builds went to "Needs the user".
- 118 (R149f1, G168, G169): R149 fix (R149f2), G168 fix (G168f1), G169 ok. CORE 69/69.
- 119 (A97f1, G225, G220): G225 fix (G225f1: unequal shapes are refused), the rest ok. `1-normald_cdf(0,1,20)` shows a flagged ⚠ 0 as named limit F203; evalf of the normal cdf moved to G221.
- 120 (R149f2, G168f1, R157): R157 fix (R157f1: cut to at most 60,950 B). `presetsMode` flaky on phase-1, not the branch.
- 121 (G225f1, G221, G228): G225 fix (G225f2: a chip counts only when it holds a list), G221 fix (G221f1), G228 ok. New silent loss F205: `k:=5` then `k+1` shows `k+1`; G303 follows.
- 122 (R157f1, G172, G173): G173 fix (G173f1). F206 (floatsAtDigits) and F207 (a matrix inside a set) get ids, no package.
- 123 (G225f2, G221f1, G303): all three fix; the G225f2 failure was not code. G221f2 follows G303f1; the pad rule is in decisions.md.
- 124 (G173f1, G179, G180): all ok. F208 (Home shows `[...]` for a stored list) and F209 (a stored ≈ float read through a user function shows ⚠). Patch 0039 is marked not sent.
- 125 (G303f1, G221f2, G225f2): all ok. F210 (global stores take names a user can type) and F211 (names bound outside G303's form: `v` in `nonsquare.ts`, `a_`, `b_`, `d_` in `emit.ts`); calls-bench 8.28 against 8.37, calls-home 8.53 against 8.94.
- 126 (G186): ok. F212 (Giac's exact asin of `sqrt(-2)-10^1000` loses ln 2; Home shows wrong digits under its mark) and F213 (the sweep writes exp as the letter e, so 262 of 1187 runs are never judged); a small gorge package is recommended for F213. On the 8× device clock, DEG `cos(tanh(acosh(1ᴇ-1000)))` says "No value found" where the desktop says Overflow (a refusal, in `SPEED_KNOWN`).

## What the owner must do
1. **Sign G164's sample sources** (decisions.md "Needs the user"; [S36](2026-11-sandra-sample-sources.md)) by Thu 11-12: seven clauses to read. If not signed, the lines stay "to verify".
2. **F-Droid Reproducible Builds** (new, pass 117; `fdroid/SUBMIT.md`): recommendation: tick the box and ask for them, as without them F-Droid signs with its own key. Before the fdroiddata push, run `fdroid rewritemeta` (SUBMIT.md step 3).
3. **Look at R173's report form** by hand (`tests/core/ONE-TIME.md`), and check the PRIVACY sentence after A95 (pass 114).
4. **Parisse:** patches 0037, 0038 and 0039 are marked not sent; they go in the next batch.
5. **Tab One:** it dropped off after device 118 (three passes skipped). Check that it is plugged in, unlocked and on the charger before the next run (A32, A33).
6. **Push phase-1** when content: this night's merges and doc commits are local. v0.1.0 stays on Sun 11-15, the video on Sat 11-14.

## Queue left for the next night
- **Lane A:** rows 506 G187, 507 G170, 508 G174, 590 G223, 591 G229, 592 G235 (After G229).
- **Lane B:** rows 594 A128, 595 A124 (After A128), 596 A127, 597 A129, 598 A130, 599 A131, 600 A125, 601 A132, 602 A126, then 584 G230, 585 G231, 586 G222 (After G220 and G221f2, both merged), 587 G227 (After G225, merged) and 559 A73f2 (After the v0.1.0 tag).
- **No package yet:** F213 (recommended next), F212, F206, F207, F208, F209, F210, F211 and F203. A130 (row 598, the log names every failing test) is the pipeline package; passes 115 and 118 read the failures from truncated log lines.

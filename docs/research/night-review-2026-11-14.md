<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Night review 2026-11-14

Status: **open** (the owner's answers to section 6 at step 8).
Written 2026-11-14 by Claude (Opus, the coordinator) on `phase-1` `1f1a80582`; ids minted and docs written on `708566f0a`.

Eight independent hunts (sandra, Opus high) over the 249 merges since the 11-09 review (`f9352ae2a`), each report checked by its own verifier (sofia, Opus high); the packages argued by an author (sandra) and a reviewer (sofia), both Opus xhigh, to AGREED in round 3. Evidence: `.tasks/night-review-2026-11-14/` (outside git); probes in `tools/probes/review-1114/`.

## 1. The hunts

| hunt | found | confirmed | refuted | unsure | S1 |
|---|---|---|---|---|---|
| ca codebase | 5 | 5 | 0 | 0 | 0 |
| fh features | 8 | 8 | 0 | 0 | 0 |
| be maths | 7 | 7 | 0 | 0 | 2 |
| bu app | 9 | 8 | 0 | 1 | 0 |
| dc declutter | 16 | 16 | 0 | 0 | 0 |
| vr ron merges | 10 | 10 | 0 | 0 | 1 |
| vg other merges | 11 | 9 | 1 | 1 | 2 |
| lo leftovers | 10 | 9 | 0 | 0 | 0 |

S1 roots: a matrix times a list of another length shows a cut answer with = (G352); statistics of a stored float list of equal values give an imaginary σ under ≈ (G353); an insert before the entry field goes in front of the keys typed (R298); extreme: a tiny power of a constant base below 1 (G363), a cubic's near-double root keeps a noise imaginary part (G364). The refuted one (vg-6) is A145.

## 2. The queue it proposes

Lane A heads (ahead of A145): R298, S58, R299, R300, R301, R302, R303, R304, R305, R306 (after G232f1), R307, R308. Lane B (owner, 2026-11-14): G352, G353 at the head; then lane B's own rows, which must land by the freeze; then G354 to G360 (fixes, allowed after the freeze); then the extreme pair G363, G364 (G364 after G359); then the features G361 (after G356) and G362. With no lane running: A154, A155, A156. After the tag: G365. Every row but R299, G362, S58, G361 is a fix and may run after the freeze. All of them are in brief section 0c (steps 752–776; the extreme pair and the features after the lane B fixes); the no-lane and after-tag ones in its "Not queue rows".

Amendments written into open packages: R267 (ca-3, dc-11, dc-1's `presetsOk`), G315 (ca-5: the cycle has four modules, `PERIODIC` moves too), A133 (vg-11: rewritten against A147's limits), G314 (dc-12: `line-baseline.yaml`'s comments to one clause a line).

## 3. Backlog lines

Written under "Open bugs" (rules section 9; rerun `tools/probes/review-1114/rerun.sh <label>`): nr1114-vg-1 (G352), nr1114-be-2 (G353), nr1114-vr-1 (R298), and the pointer to this note. Room came from rewriting eight stale lines in place (Milestone 6, the pipeline, A144's, R41's, A66's, R59's and the flaky line; F90–F97's tail).

**Backlog lines waiting for room** (the backlog would sit 29 B under its limit with this one):
- `- **nr1114-be-3, nr1114-vg-2 (S1, extreme, `1f1a80582`; G363, G364).** `(1+sin(1)^5000)^(sin(1)^(-5000))` ≈ 1 (right e); `solve(x^3-3*x+2+10^-80=0,x)` ≈ {-2+3.47E-305·i} (right −2). Rerun: `tools/probes/review-1114/rerun.sh be-3`, `vg-2`. Family 3.`
- lo-6's F61 text: "(decisions.md G71)" → "(archive/decisions-2026-10.md G71; no package, after the tag)" (+40 B).

## 4. To verify

- **bu-8:** Vars inserts a variable stored as `e` or `i` as `e_`/`i_` (`find/names.svelte.ts:35-37` keeps the empty subscript; the parser refuses `e_`). One `vars.spec.ts` case (`e:=5`, Vars, the row, Enter, expect 5); a package if red.
- **vg-7:** the F-Droid recipe runs `node scripts/*.ts` on Debian trixie's nodejs (type stripping needs Node ≥ 22.6). `podman run --rm debian:trixie sh -c 'apt-get update -qq && apt-cache policy nodejs'` (annabell, network; A145 measures only `build-wasm.sh`).
- **vr-10's AZERTY part:** Alt+3…6 type their character, Alt+5 presses the bracket key (someone with a French layout).
- **G2 questions** (`tests/golden/g2.yaml`, virtual-calc): the matrix editor's first minus (R300); a hex literal in a signed word (R305); `30°15` in DEG: 30.25°, 450 or refused (`docs/04-architecture.md:333`, from the 11-09 note).
- **From the 11-09 note:** `renameDocument` on a device (A137 step 1); a frozen writer tab and Use here (`state/handOver.ts:22`: a two-tab Playwright run with `Page.setWebLifecycleState frozen`, and whether a browser freezes a tab that holds a Web Lock); `negbinomial_icdf(3,0.0001,0.5)` slow (no backlog line); A40's device path never exercised (every CORE DEVICE line reads `known 0`); vg-2's nine hang inputs (11-09) not rechecked.

## 5. Items to place

- **Engine-made English in info lines** (11-09 lo-4): `engine/analysis.ts:208-231`, `engine/solve.ts:320, 381`, `engine/solve1.ts:255, 277, 375`, shown at `SolveNum.svelte:51`, `FunctionPlot.svelte:215`: the engine returns a code, the view words it. The next Solve or Function package.
- **One IndexedDB open per call** (`state/storage.ts:82-89`): waits for 50 `kvSet` timed on the Tab One.
- **The held list** (docs/03 rule 5): a hardware key for Find, a pasted column as a list, the error's position, split forms ft+in and h+min+s, ° ′ ″ as a result form.
- **The owner's list:** be-9's residual (`max`, `min` of ± values and `mod` in a unit formula refused); worst-case min…max for a ± chain (`docs/03:69`); the 11-08 pipeline audit prompt (`../drafts/2026-11-08-desktop-move/`, no run: a day session after the freeze, or drop); email 7 to Parisse with 0037–0048 (NEXT.md lists 0037–0043).
- **Refs to tidy (lo-7, lo-8):** `git worktree remove .claude/worktrees/pl-1047-r277` and `git branch -D p1/ron-linetouch` (R277 merged from `p1/ron-linetouch2`); the registered `/tmp/…/scratchpad/phone-build` worktree at `5d91e0c4`; `origin/p1/ron-results-fold` (merged); the tag `keep/eve-gestures` (the last ref to `96fcf50b`).
- **For R292's worker** (dc-16): three tests read fixtures from `tools/probes/library/` (`app/src/engine/library.test.ts:23`, `app/src/views/libraryJobs.engine.test.ts:69`, `app/test/library.spec.ts:14`); they can move to `tests/fixtures/library/` with R292's fixture.

## 6. Questions for the owner

Recommendation first; 1 and 2 before the hardware-key tests of 11-16, 3 before the tag.
1. **Letters typed into a unit slot on a hardware keyboard** (fh-2; P14). Yes, on a hardware keyboard only: a letter run in a slot reads as a unit as Find's exact symbols do; the touch pad keeps P14's cells. R303 builds only the Find path. ≈ 1 d, ron, Opus.
2. **`2exp(1)` on a hardware keyboard** (bu-9; decisions "Hardware keys"). At `(`, ᴇ after a number followed by letters that with `e` form a known name becomes the function; a digit after ᴇ keeps ᴇ. Today it is refused, never wrong. ≈ ½ d.
3. **Hex in a signed word, and Copy as shown** (be-5, vr-4). Keep reading `0x…` as a non-negative integer and Copy as shown as docs/04 2.6 defines it; R305 adds the decimal and the word in the work report only. Or: read a based literal in the word when Signed is on; or Copy as shown writes `0xFF (−1, 8-bit signed)`.
4. **A stored name keeps σ and unit** (lo-1's second half, fh-3; G26, R28, docs/04 4.3; X15, R53c). Yes, after the tag: two packages ≈ 1 d each and a data-version step. G355 fixes chips and Ans now.
5. **`%`, `‰`, `ppm`, `ppb` as dimensionless units** (fh-5; G161 kept them out for "G7's reason", which no decision line holds). Yes; `± n %` stays σ. ≈ ½ d, gorge.
6. **A temperature difference** (fh-7; G17). After the tag: exactly `T1 − T2` of one absolute scale gives the difference in K; every other mix stays refused.
7. **Memory deletes without Undo** (fh-8; R4b). After the tag: R98's one-level Undo row.
8. **Desktop-keys help** (vr-10; R131's decision). One line in the help: the chords are for US and UK layouts.
9. **The line and text ratchets** (ca-2; the source-size rule). A file passing 800 lines gets its split package in the same week; a pass lowers stale baselines. This week: 6 → 11 baseline entries, text reads 157 → 163, one split package.
10. **The arch review's drafts outside git** (lo-2). X15's chip half is G355 now; after the tag `hunt-tasks.yaml` (660 rows) goes into git with one gorge package, and X9–X27 are placed in the arch note's order.
11. **Mockups a test cites** (11-09 dc-10, dc-6). `git mv` `top-cluster-r15c.html`, `settings.html`, `n62-teal-2026-11-07.html`, `store-2026-11.html` to `docs/archive/mockups/` with their citers' paths.
12. **Gauge pressure** (fh-4; G161). Keep G161's choice for v0.1.0 (`psig`, `barg` find nothing).

Settled here, no question: the capital base prefix is read as the prefix (R304); New takes I (R307); no Ans first in a grid cell (R300, a logged default).

## 7. Budgets

On `708566f0a` with this review's edits (limits from `tools/docs-check.mjs`): brief 36,508 of 40,000 B; backlog 19,714 of 20,000 (FULL: the extreme line waits above); decisions 39,962 of 40,000 (FULL: one pointer entry here, the questions in section 6); docs/04 69,851 of 70,000 (FULL: dc-14 freed 140 B for the docs/04 clauses of G357, R304 and G365); research notes about 116 of 150 kB with this note (r21, store-design, r20 and the 11-09 note moved to the archive, 42.7 kB).

Options when they fill again: the backlog's Background stream holds lines whose packages are queued (each could become one pointer to its package); decisions.md's "Owner answers" entries could point at archived notes in one line each; docs/04's tables repeat package ids that `git log` holds.

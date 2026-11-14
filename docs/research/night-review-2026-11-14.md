<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Night review 2026-11-14

**Status: open** for sections 4 and 5; section 6 answered by the owner on 2026-11-14.
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

## 6. The owner's answers (2026-11-14)

1. **Letters typed into a unit slot on a hardware keyboard** (fh-2; P14): yes, on a hardware keyboard only; the touch pad keeps P14's cells. R313, after R303, lane A.
2. **`2exp(1)` on a hardware keyboard** (bu-9): yes, at `(` a ᴇ after a number followed by letters that with `e` form a known name becomes the function. R312, lane A.
3. **Hex in a signed word, and Copy as shown** (be-5, vr-4): kept as is; `0x…` is a non-negative integer and Copy as shown follows docs/04 2.6; R305 adds the decimal and the word in the work report only.
4. **A stored name keeps σ and unit** (lo-1, fh-3): yes, after the tag: G371 (the store), then R315 (the unit view). G355 fixes chips and Ans now.
5. **`%`, `‰`, `ppm`, `ppb` as dimensionless units** (fh-5): yes; `± n %` stays σ. G369, lane B, before the freeze.
6. **A temperature difference** (fh-7; G17): yes, before the freeze: exactly `T1 − T2` of one absolute scale; every other mix stays refused. G370, lane B.
7. **Memory deletes without Undo** (fh-8; R4b): yes, before the freeze: a one-level Undo as R98's. R314, lane A.
8. **Desktop-keys help** (vr-10): yes, one line in the help: the chords are for US and UK layouts. In R312.
9. **The line and text ratchets** (ca-2): yes. A file past 800 lines gets its split package the same week, and an Opus pass lowers a stale line (brief section 8). This week's five: R316 (`parse.ts`), R317 (`App.svelte`), G372 (`homeEval.ts`), G373 (`api.cc`), G374 (`export.mjs`), last in their lanes; one not started by the freeze waits for the tag.
10. **The arch review's drafts outside git** (lo-2): in git now, in `docs/archive/arch-review-2026-11-10/` (home paths replaced). X9–X27 are placed after the tag, as the arch note says.
11. **Mockups a test cites** (dc-10, dc-6): moved to `docs/archive/mockups/`, their citers' paths with them.
12. **Gauge pressure** (fh-4; G161): G161's choice kept for v0.1.0.

Each package rewrites its decision line in place when it lands (R312: "Hardware keys"; R313: P14; R314: R4b; G369: G161; G370: G17; G371: G26; R315: R28).

Settled here, no question: the capital base prefix is read as the prefix (R304); New takes I (R307); no Ans first in a grid cell (R300, a logged default).

## 7. Budgets

On `708566f0a` with this review's edits (limits from `tools/docs-check.mjs`): brief 36,508 of 40,000 B; backlog 19,714 of 20,000 (FULL: the extreme line waits above); decisions 39,962 of 40,000 (FULL: one pointer entry here, the questions in section 6); docs/04 69,851 of 70,000 (FULL: dc-14 freed 140 B for the docs/04 clauses of G357, R304 and G365); research notes about 116 of 150 kB with this note (r21, store-design, r20 and the 11-09 note moved to the archive, 42.7 kB).

Options when they fill again: the backlog's Background stream holds lines whose packages are queued (each could become one pointer to its package); decisions.md's "Owner answers" entries could point at archived notes in one line each; docs/04's tables repeat package ids that `git log` holds.

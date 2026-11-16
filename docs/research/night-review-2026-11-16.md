<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Night review 2026-11-16

**Status: open** for sections 4 to 6: K22 waits for G385, the archive moves for G371's merge.
Written 2026-11-16 by Claude (Opus, the coordinator) on `phase-1` `d4bf19bf0`; ids minted and docs written on `aaf687d40`.

Eight hunts, each checked by a verifier; packages agreed by an author and a reviewer in round 3. Evidence outside git: `.tasks/night-review-2026-11-16/`; probes in `tools/probes/review-1116/`.

## 1. The hunts

| hunt | found | confirmed | refuted | unsure | verifier's new |
|---|---|---|---|---|---|
| ca codebase | 8 | 8 | 0 | 0 | 1 |
| fh features | 9 | 9 | 0 | 0 | 1 (S2) |
| be maths | 4 | 4 (S1) | 0 | 0 | 0 |
| bu app | 7 | 6 | 0 | 1 | 0 |
| dc declutter | 13 | 11 | 2 | 0 | 0 |
| vr ron merges | 4 | 4 | 0 | 0 | 0 |
| vg other merges | 6 | 6 | 0 | 0 | 0 |
| lo leftovers | 9 | 8 | 1 | 0 | 1 |

- **S1:** be-4 → G398; be-1 → G399; be-2, vg-1, vg-5's G363 part → G403; be-3, vg-2 → G405; vg-5's G358 part, vg-6 → G404; vr-1 fixed by R128f1. Extreme inputs: vg-1 `(1+exp(-100*pi))^(exp(100*pi))` ≈ 1, right e; vg-2 `size(solve(x^3-3*x+2-10^-30=0,x))` = 2, right 3; vg-5 CAS `ln((tanh(100)-1)^2)` = `2*ln(tanh(100)-1)`, right −398.613705639, real (derived: 2·ln(1−tanh 100); `vg/run3.out`).
- **S2:** vfh-1 → backlog F256 (R354, R355); bu-1 → R363; vr-2, bu-6, bu-5 → R364; bu-3 → G400; fh-3 → R361; fh-2 → R367; bu-2 → section 4.
- **S3:** vca-1, ca-5, vr-3 → R365; bu-4 → R366; fh-4, fh-5 → G401; fh-1 → G402; ca-6, ca-7 → G407; ca-2 → A161; ca-3 → R373; vr-4 → R372; vg-4 → A162; lo-3 → G406; fh-8 → R368, R369; fh-6 → R371; fh-7 → R370; ca-1 → R362; ca-8, dc-2, ca-4 → R267; lo-7 → R292; dc-5, lo-4 → A156; vg-3 (K22) → section 6; vlo-1, dc-3 to dc-12, lo-1, lo-6 → docs edits.
- **Closed:** bu-7 (`5 % 3` = 0.15 kept, owner); fh-9 settled (G25, golden `n03`); refuted dc-1, dc-13, lo-9.

## 2. The queue

All of it is in brief section 0c: lane B steps 833, 834 at the head (G398, G399); lane A 835, 836 after R349 (R361, R362); from the stop 837 to 845 in step order across both tables; the extreme night 846 to 848; by day G406; after the tag R367 to R373 (lane A) and G407 (lane B). G398 and G399 take about 3 h each (engine rebuilds): G390, then R353 and R349, run about 6 h later.

## 3. Backlog lines

Written: nr1116-be-4 and -be-1, and -vg-1, -vg-2, -vg-5 (owner, 2026-11-16: the S1 rule over the 200 B margin), under "Open bugs" (rerun `tools/probes/review-1116/author/rerun.sh <label>`), the pointer here; F181 out; the Giac line's counts; "Needs the user" item 2 to 76.

**Waiting for room** (the backlog keeps 200 B free):
- lo-8: F61's "(decisions.md G71)" → "(archive/decisions-2026-10.md G71)" (+40 B).

## 4. To verify

- **bu-2:** the sync offer opens over typing at start and takes keys: type `12×3` during a start with a newer backup in the folder (annabell, a device run; after R183's rows).
- **be-4's sub-claim:** a chip or Ans of `(1/(pi-4))^0.5` reuses the value or the printed text (one `home.yaml` row with `before:`; G398's round trip covers the text).
- **vr-3's G sub-case:** G's chip basis in the built Find index.
- **vg-1's other forms** (sinh, Gamma, a quotient of calls): a sweep family.
- **G369's ratio units on a fresh index:** `FIND_INDEX_JSON=<new index> node tools/probes/unit-result.ts '2*{m}/(5*{percent})'`.
- **S20:** does the interval build confirm e for `(1+1/cosh(1000))^cosh(1000)` (`tools/probes/mpfi.ts --only` on `WITH_MPFI=1`)?
- **K29 (tell the owner):** the Node check of `release-0.1.0.md` is today's by-day row; its threshold is fixed.

## 5. Items to place

**The owner's answers (2026-11-16):**
1. K1, K2: lane B's head before the freeze, K2 first: G398, G399.
2. K22: checked again after G385, then decided, before the freeze (section 6).
3. Function and Solve open after the tag: R367 (knowns), R368 and R369 (Home rows), R371 (Window), R370 (F1…F0); docs/06's "nothing is lost" fixed now.
4. Doc room: F181 out, docs/04's bare "(built, R…)" out; the moves wait (below).
5. K17, draw a stored value before the freeze: R361 (it rewrites decisions "R258").
6. `5 % 3` = 0.15 kept: bu-7 closed.
7. The patch headers (lo-3): G406, by day after 11-17.
8. K22, K23, K26, K27, K29, K30 sent to the session phase-1-a9; R267 and R292 amended here (not there by `aaf687d40`).

**Defaults taken:** a file past 800 lines before 11-14 (`numeric.ts`, `host.test.ts`, `pipeline.sh`, `pipeline.test.sh`, `session.svelte.ts`) gets its split when a package next grows it (11-14's answer 9 named that week's five); an unaudited input that rests on a decision and climbs is ⚠ "decided" (G358, kept; G404 says so); G363's "an id for the wrong ≈" is G403; R366 refuses a pasted quantity in an app line rather than drop its unit; R361 draws σ at the central value and names it.

**For workers:** R361's `TapCounter` method goes through `tapsFront`'s `load()` (`taps.svelte.ts` is a lazy part, `size-check.ts:218`); a forwarding method on the front grows the start chunk. R356's reason "plots read no user names" turns stale with R361: its refusal holds (a one-letter value is no name token); R361's report gives R356's file that clause.

**The archive moves** (owner answer 4; the 11-14 note, the sample-sources note, the 11-07 to 11-09 night reports, the 11-05 reports, two mockups): one docs commit after G371 merges, with none of G372 to G374 or R314 to R317 running (their files link the 11-14 note).

**Carried from 11-14, open:** vr-10's AZERTY chords; a frozen writer tab and Use here (`state/handOver.ts:15-30`, two-tab Playwright with `Page.setWebLifecycleState frozen`); A40's device path never exercised (every CORE DEVICE line `known 0`); 11-09 vg-2's nine hangs; engine-made English in Solve's and Function's info lines (`engine/analysis.ts:208, 224-232`, `engine/solve.ts:320, 381`, `engine/solve1.ts:255, 277, 375`), for R367's and R371's workers; one IndexedDB open per call (`state/storage.ts:82-89`); the held list (docs/03 rule 5); the owner's list (be-9's residual, min…max for a ± chain, the 11-08 pipeline audit prompt). Closed: `negbinomial_icdf(3,0.0001,0.5)` (26738 in 1.6 ms, the oracle's value), email 7 (sent 11-15), bu-8 (R337).

**The owner's checklist** (after the lanes stop; the `pl-*` worktrees are the pipeline's): `git worktree remove` `pass-197`, `pass-200`, `pl-1315-r265`, `pl-1047-r277` and the `/tmp/…/phone-build` tree; `git branch -D p1/pass-197 p1/pass-200 p1/ron-rowangle p1/ron-linetouch`; drop `origin/p1/ron-results-fold` with the next push; decide on the tag `keep/eve-gestures` (about 1.7 GB); the main checkout is detached at `47d23504`: refresh it by hand.

## 6. Question for the owner

- **K22** (vg-3): `80 °C − 5 K` gets the two-scales refusal, whose words lead to `80 °C − 5 °C` = 75 K. Checked again after G385, then decided, before the freeze: rerun the three unit lines of `tools/probes/review-1116/vg/run3.sh` on phase-1 after G385 merges.

## 7. Budgets

FULL after this review: decisions.md (35 B free), docs/04 (192 B), the backlog (252 B). Options: decisions' "Built, archived" ids as one pointer per archived note; docs/04's tables without the package ids `git log` holds; the backlog's Background lines with queued packages as one pointer each.

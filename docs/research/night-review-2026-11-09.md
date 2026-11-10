<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# The night review of 2026-11-09

**Status (2026-11-09): open.** What to verify, place or decide; it took over the open items of the 11-02 note (`archive/night-review-2026-11-02.md`).

*Written 2026-11-09 by Claude (Opus, the coordinator) on `phase-1` `f9352ae2a`; ids minted and docs written on `e0580ff6b`.* A day run (08:29 to Tue 05:00) beside the lanes. Eight hunts, each checked by a separate verifier; 33 packages argued over five rounds. Evidence: `.tasks/night-review-2026-11-09/` (`reports/`, `verified/`, `knowledge.md`, `packages/`; grep by label); the probes the backlog lines name are in `tools/probes/review-1109/`.

## 1. The hunts

| hunt | found | confirmed | refuted | new by verifier |
|---|---|---|---|---|
| be (maths) | 10 | 9 | 1 | 0 |
| bu (app) | 9 | 9 | 0 | 0 |
| ca (structure) | 9 | 8 | 1 | 0 |
| fh (features) | 14 | 11 | 3 | 2 |
| dc (declutter) | 18 | 17 | 1 | 0 |
| vr (ron merges) | 4 | 4 | 0 | 1 |
| vg (other merges) | 4 | 4 | 0 | 0 |
| lo (leftovers) | 17 | 16 | 1 | 0 |
| **all** | **85** | **78** | **7** | **3** |

Nine S1 root causes: be-1 to be-5, bu-1 to bu-4. Refuted, no package: ca-4, fh-1, fh-6, fh-11, dc-12, lo-15, be-9 (its residual is on the owner's list). Five review rounds; one point stayed open (`packages/OPEN-POINTS.md`; section 6, item 16).

## 2. The queue it proposes (past what fits in the brief)

The brief holds the first rows, steps 603 to 613 (R255, R257, R256, R258 in lane A; G304, G305, G310 and the weekly G306 to G309 in lane B), after the lanes' rows; each Opus pass moves the next rows in from here. Order: importance, then dependencies.

**Before the freeze (Thu 11-12 evening; bar point 3).** Lane A: R255 keys before the field, R257 Function's stale numbers, R256 comma mode and a power, R258 a multi-letter name. Lane B: G304 every Giac spelling of an angle function, G305 a limit at a jump, G310 a zero inside a function.

**Lane A, then:** R264 start chunk room; R259 unit view: Ans and σ; R261 ▲▼ after Esc; R263 lazy doors; R262 To Home; R260 stand-ins (after G311); R266 tips and a typing run.

**Lane B, then:** G316 absolute zero; G311 library round trip; G312 polar digits; G313 sigfig and interpolation in Find.

**Weekly extreme night, Wed 11-11 (lane B):** G306 ∛, atan2, ln, sort; G307 powers of π and e; G308 (1+εi)^p; G309 the weekly fuzz and triage.

**By day, one at a time, no lane running while each merges:** A136 golden trigger, before the freeze; A133 run deadline, A134 lock leak, A135 inhibit on win99, after the tag; S52 chunk spike, after the tag (a build on a quiet machine); A137 folder write, before R128 (device).

**After the tag or at v0.2:** R267 dead exports, R268 tokens and probes, G314 host split, G315 names module (no refactor races the freeze); R265 a row's angle mode (after G211).

Amendments, for the owner first: R199's tests gain `2\tfrac12` → `2 1/2`, `2\tfrac{11}{13}` → `2 11/13`, `1.5\emark-3` → `1.5E-3`, `\log_{16}(256)` → `log_16(256)` (bu-6; item 3). R128's Starts when gains "A137 merged".

## 3. Backlog lines

All nine S1 lines are in `docs/backlog.md`, none waits for room: under "Open bugs" nr1109-bu-1 to bu-4 and be-4, and F182 now with be-5; under "Background stream" be-1, be-2, be-3. The room came from dc-7 and lo-11 (lines already fixed or stale).

## 4. To verify

- bu-1: how often: device timing, `entry.field` set minus `keyboard-ready` (annabell).
- bu-4: an import-to-Vars run in the app (R258's e2e).
- be-2: the cause (G308 step 1, a canary with the controls).
- ca-2: real sizes (a build; R264 step 1). ca-5: the chunk option (S52).
- vg-3: whether `renameDocument` replaces a file, on a device (A137 step 1).
- lo-2: a frozen writer tab and "Use here" (`state/handOver.ts:22`; a two-tab Playwright run with `Page.setWebLifecycleState frozen`; say whether the browser would freeze a tab holding a Web Lock by itself).
- fh-10: "repeats the last result": the result or the input (`spec/mapping/vc-2026-10-11/keys.yaml:55`).
- be-7: what the G2 does with `30°15` (no `source:` value; virtual calc).
- setup-java's SHA against tag v6.1.0: `git ls-remote https://github.com/actions/setup-java v6.1.0` (owner; it came with A8 after the 11-02 pin check).

## 5. Items to place

Taken over from the 11-02 note, with today's state:
- **lo-3, the GUM clauses:** sandra, before any package prints k: JCGM 100:2008 7.2.2 and 7.2.4 in our own words (G270, R130, G273, must-have C8; `units/row.ts:48`'s `± σ` format, R40's `U = 2σ (k = 2)`). σ² by share (`units/evaluate.ts:45, 117, 327-328`) after that.
- **lo-4:** engine-made English in Solve's and Function's info lines (`analysis.ts:176-209`, `solve.ts:319, 380`, `solve1.ts:255, 277, 375`; shown at `SolveNum.svelte:51`, `FunctionPlot.svelte:215`): the engine returns a code, the view words it. The next Solve or Function package.
- **lo-5:** ca-7 of the 11-02 note (one IndexedDB connection per call, `storage.ts:81-88`) waits for 50 `kvSet` measured on the Tab One; it is not this review's ca-7 (G315). The 11-02 ca-1 is R264 now, the 11-02 ca-5 is G314.
- **lo-6:** vg-11 `negbinomial_icdf(3,0.0001,0.5)` = 26738 (oracle) answers ≈ after 1.5 s; the exact form `(3,1/10000,1/2)` ends "Stopped: it took too long" at 4.5 s. A backlog line when there is room (fix: the exact loop only when r(1−p)/p < 10⁴). A40's device path: a known case passing on a device should log `new none`; never run (every CORE DEVICE line reads `known 0`). F61's id: the Opus pass mints it with its package. vg-2's nine hang inputs are not known rows (a known row matches a generated tree's id exactly).
- **lo-7, the held list** (docs/03 rule 5, the admission test): a hardware key for Find; a pasted column as a list (R114's paste doesn't close it); the error's position; split forms ft+in, h+min+s, ° ′ ″ (DMS entry is built, must-have E9; a DMS result form is not).
- **lo-8:** the 11-02 queue is finished but for R128, R131 (v0.2, must-have) and R130 (item 12).
- **dc-10, left in place:** `docs/mockups/top-cluster-r15c.html` and `settings.html` have all their packages merged, but tests and views cite them as the spec. Rule 10 and `docs/README.md:25` read differently here: move them to the archive with their links, or say in rule 10 that a mockup a test cites stays.

The owner's list, one line each (no question): be-9's residual: `max` and `min` of ± values and `mod` in a unit formula are refused with the honest generic line, a feature gap. fh-3: no worst-case min…max for a ± chain (`docs/03:69`, a later add-on). lo-14: the pipeline audit of 11-08 (`../drafts/2026-11-08-desktop-move/VERIFY-pipeline-prompt.md`) has no trace of a run: one day session before the freeze, or drop it. Patch 0037 goes in the next mail to Parisse (must-have:52).

## 6. Questions for the owner

One recommendation each; items 1 and 2 first, as a change needs a package before the freeze.
1. **Copy on a unit row (vfh-2; docs/04 2.6).** Copy writes `20` for 20 m/s. Follow the docs table (`20 m/s`, `39.5±1.2 m^2`): a number without its unit is the worse thing to leave silently.
2. **`200 + 10 %` (fh-9; touches R110).** It is 200.1 `=`. Refuse % right after + or − with a line giving both readings, until the G2's result is checked.
3. **R199's forms (bu-6; must-have B8).** Yes, with `2 1/2` and `E`, so Share stops writing `21/2` for 2½.
4. **`30°15` (be-7).** It is 450 `=`. Refuse a number right after °, ′ or % with the missing mark named, after a virtual-calc check; `2π` and `2x` untouched; decide `!` with it.
5. **Esc in Symb, then Enter (bu-5).** Esc restores the stored text and Enter leaves the slot alone, with a Menu row to clear a slot.
6. **Opening an app with a half-typed Home line (bu-8).** Set it aside and put it back on close, as R89's name prompt does (R34's "follows you between views").
7. **σ after ± (fh-4; R28's literal rule).** Allow a result chip after ±, with its own digits and marks.
8. **Paste with digit groups (fh-12; docs/04 2.6).** Digit groups only and only when unambiguous; `1,234` stays refused.
9. **Rows past 200 (fh-13; the "no backup reminder" decision).** One note row the first time a row is dropped, once per install.
10. **Enter on an empty line (fh-10).** The G2 repeats; settle only which reading, and run the input again except a store.
11. **Enter on a picked row without a result (vr-3; R147).** Leave the line alone and drop the pick when text is on the line; Enter and the second tap must agree, so the question is recall with text on the line.
12. **R130's start condition (lo-9).** The 11-06 answers made the pick (a "step" is a history row): R130 starts on "R53 merged", `must-have.md:108` drops its clause.
13. **The `baseline-8f398cca` worktree (lo-16).** Remove it (861 MB, clean).
14. **Budgets (dc-14).** See section 7.
15. **"Ready to work offline", once per install (fh-14).** No for now: it doesn't pass docs/03 rule 5. An outside round that asks whether the web app works offline would change this.
16. **G310's Done-when on `rule3.mts` (the open point).** Replace it with the reviewer's comparison on the built code: as written it can't fail, because the probe's first branch takes every refusal.

## 7. Budgets

On `e0580ff6b` with this diff: brief 31.1 of 32 kB, backlog 19.4 of 20, decisions 39.9 of 40 (FULL), docs/04 66.6 of 70, research notes under 80 of 150. The recommendation: the trims made here, and S33 (brief 0c against rules section 4) left as it stands by day. decisions.md stays the tight one; the next cheapest full texts to move to the archive are the 2026-11-08 answers, once A73f2 and A123 have run, and R148f1's entry.

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

The brief holds steps 603 to 619. At the head of lane A: R269, R255, R257, R256, R258, then R261, R270 to R273 (the owner's answers). At the head of lane B: G304, G305, G310; the weekly G306 to G309 at its end (owner, 2026-11-10). Each Opus pass moves the next rows in from here. Order: importance, then dependencies.

**Before the freeze (Thu 11-12 evening; bar point 3).** Lane A: R269 Copy with unit, R255 keys before the field, R257 Function's stale numbers, R256 comma mode and a power, R258 a multi-letter name. Lane B: G304 every Giac spelling of an angle function, G305 a limit at a jump, G310 a zero inside a function.

**Lane A, then:** R264 start chunk room; R259 unit view: Ans and σ; R263 lazy doors; R262 To Home; R260 stand-ins (after G311); R266 tips and a typing run.

**Lane B, then:** G316 absolute zero; G311 library round trip; G312 polar digits; G313 sigfig and interpolation in Find.

**Weekly extreme night, Wed 11-11 (lane B):** G306 ∛, atan2, ln, sort; G307 powers of π and e; G308 (1+εi)^p; G309 the weekly fuzz and triage.

**By day, one at a time, no lane running while each merges:** A136 golden trigger, before the freeze; A133 run deadline, A134 lock leak, A135 inhibit on win99, after the tag; S52 chunk spike, after the tag (a build on a quiet machine); A137 folder write, before R128 (device).

**After the tag or at v0.2:** R267 dead exports, R268 tokens and probes, G314 host split, G315 names module (no refactor races the freeze); R265 a row's angle mode (after G211).

Amendments made (owner's yes): R199's tests gain `2\tfrac12` → `2 1/2`, `2\tfrac{11}{13}` → `2 11/13`, `1.5\emark-3` → `1.5E-3`, `\log_{16}(256)` → `log_16(256)` (bu-6; item 3). R128 starts after A137. R130 starts on R53. G310's Done-when is the reviewer's comparison.

## 3. Backlog lines

Six S1 lines are in `docs/backlog.md` under "Open bugs": nr1109-bu-1 to bu-4 and be-4, and F182 now with be-5 (found on `f9352ae2a`; room from dc-7 and lo-11). The weekly night's three wait here for room (the backlog is full after the night's F205–F213); their packages hold the same text:
- **nr1109-be-1 (S1, extreme; G306).** `∛sin(10⁷⁰)` ≈ 0.26454+0.45819·i (right −0.52908); also `atan2`, `ln` of a power, `sort`. Rerun: `tools/probes/review-1109/rerun.sh be-1`. Family 3.
- **nr1109-be-2 (S1, extreme; G308).** `(1+1ᴇ-15·i)^(1/3)` ≈ 1+1E-15·i (right 1+3.33E-16·i). Rerun: `tools/probes/review-1109/rerun.sh be-2`. Family 4.
- **nr1109-be-3 (S1, extreme; G307).** `(1+e⁻²⁰⁰)^(e²⁰⁰)` ≈ 1 (right e). Rerun: `tools/probes/review-1109/rerun.sh be-3`. Family 4.
- For F155: `acosh(1E1000+i)` is the short case of a halved imaginary part.

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

## 6. The owner's answers (2026-11-09 evening, 2026-11-10)

Decided; decisions.md has one line pointing here.
1. **Copy on a unit row (vfh-2):** Copy writes the unit and σ, as docs/04 2.6's table (`20 m/s`, `39.5±1.2 m^2`). R269, before the freeze.
2. **`200 + 10 %` (fh-9):** stays 200.1 `=`: % is /100 and binds before +. R110 unchanged; no package.
3. **R199's forms (bu-6):** yes, with `2 1/2`, `2 11/13`, `1.5E-3`, `log_16(256)` (R199 amended).
4. **`30°15` (be-7):** the product stays (450); written in docs/04 5.5 as a point for discussion, with `2%3`, `5!3`. No refusal package.
5. **Esc in Symb, then Enter (bu-5):** Esc restores the stored text, Enter on an empty line leaves the slot, a Menu row clears a slot (R261, rewritten).
6. **A half-typed Home line when an app opens (bu-8):** set aside and put back on close, as R89 (R270).
7. **σ after ± (fh-4):** a result chip may stand after ±, with its own digits and marks (R271; R28's literal rule changes for a chip only).
8. **Paste with digit groups (fh-12):** all stay refused; docs/04 2.6 unchanged. The owner asked whether offering ambiguous formats on Copy makes this a flaw: no, digit groups are only drawn (R125); Copy, the entry line and stored values stay plain (`apps/grouped.ts:3`).
9. **Rows past 200 (fh-13):** one note row the first time a row is dropped, once per install, pointing to Settings › Backup (later the sync folder too; Syncthing is named in the sync folder's help). R272; ends "no backup reminder" in part.
10. **Enter on an empty line (fh-10):** stays doing nothing (N62 differs from the G2 here). No package.
11. **Enter on a picked row without a result (vr-3):** with text on the line, the line stays and the pick drops; Enter and the second tap alike (R273).
12. **R130's start (lo-9):** the 11-06 answers were the pick (a step is a history row): R130 starts on R53 merged.
13. **`baseline-8f398cca` (lo-16):** removed, with `p1/ron-reportrow`, `p1/gorge-trustrows` and `pl-823-g201`, each after a check.
14. **Budgets (dc-14):** the step-5 trims; S33 stays as it stands.
15. **"Ready to work offline" (fh-14):** not now (docs/03 rule 5).
16. **G310's Done-when:** the reviewer's comparison on the built code (G310 amended).
17. **Queue head (2026-11-10):** the before-freeze packages at the head of both lanes.
18. **R128:** starts after A137 (the folder's write replaces a file whole).
19. **F-Droid Reproducible Builds (pass 117):** asked for (decisions.md).
20. **Cleanup:** item 13.

## 7. Budgets

After phase-1 `53d89cae2` merged in and the answers applied (2026-11-10): brief 30.8 of 32 kB, backlog 20.0 of 20 (FULL: the weekly night's three lines wait in section 3), decisions 39.9 of 40 (FULL), docs/04 67.2 of 70, research notes about 80 of 150. The recommendation: the trims made here, and S33 (brief 0c against rules section 4) left as it stands by day. decisions.md stays the tight one; the next cheapest full texts to move to the archive are the 2026-11-08 answers, once A73f2 and A123 have run, and R148f1's entry.

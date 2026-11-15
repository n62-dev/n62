<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Night report 2026-11-15 (lanes A and B, 2026-11-14 06:37 to 2026-11-15 06:01)

Both lanes started at 06:37 (`night.sh --lane A` and `--lane B`, `--until 05:00 on 11-15`). Pipeline runs 1168 to 1242 (the report is job 1244): 48 package runs, 14 Opus passes (180 to 193), 14 device steps. **47 runs merged** (A: 24, B: 18, stream C: 5); **1 run is not merged: G359** (stream C). Lane A closed at 05:12 (33 steps, it waited for lane B, then started this report); lane B closed at 06:00 (26 steps). The log shows no push: phase-1 stands at 6c7202bd (pass 192's merge); pass 193 changed no file.

**Core list:** desktop CORE 77/77 (known 0, needs 0) at every pass, 180 to 193. **Device: DEVICE SKIPPED at 12 of 14 steps** (`device 'HA24BZ2Y' not found`: devices 180 to 186 and 189 to 193). Only two device runs happened: **CORE DEVICE 76/76 (known 0, new none) on 70d4857d (device 187, 18:47) and on 1f7a6c4b (device 188, 21:15)**. No device run has read the code since pass 188. Gates at pass 192 (on b3638dd6 plus its docs): typecheck 0; `FIND_INDEX=required` vitest 5469/5469 (325 files); e2e 2139 passed, 12 skipped. GOLDEN GATE PASSED at passes 190 and 191 (parser 705/705, 2 known gaps; units 290/290); passes 192 and 193 ran no golden (no engine or parser code changed).

## Merged into phase-1
Lane A (ron, sandra, annabell):
- R189f1 4b1766d5 (finishes R189: a matrix element's kind and exact pair come from the bridge, `numberLatex`, `DECIMAL`, `typedSequence` and `callBefore` are gone from `giacPrint.ts`, back to 17 in the text baseline). R130f1 3e7ab3cb (finishes R130: the work report says the angle mode at export, and a step in another mode, or with none recorded, gets its own Angle line). R190 1f1a8058 (New in the matrix sheet reopens its own sheet and opens the grid of the new matrix).
- R221 c2f1d170 (baselines for tasks t06, t08, t09: 13, 33 and 68 presses). R220 042fcf20 (the uncertainty sheet's mockup). R174 c5a8b211 and R174f1 639c43dc (Settings, Help and about, Why trust it; the caption speaks of lines and traps; one rule, `trapShown`, for the page and the README). S45 bd821416 (the note on Solve with units). S51 9cb898ec (the note on iOS rights and the licences). A145 1f353875 (the F-Droid bits measurement).
- R298 cc6ed23f (an insert made before the entry field is ready waits in the keys' queue and replays in order). R312 84537bb7 (a hardware `e` after a number and before a known function name typed with `(` becomes that function). S58 89615f17 (the chunk cuts note).
- R299 914c0967 (the lock on the lists: Function, Solve, stat, unit and matrix sheets). R300 f35481da (keys in the matrix grid act by their action in the layer pressed). R301 d3c84b9c (Store ▶ on a row with text on the line goes the typed path). R302 da7ed29a (a cell edit keeps the user's line aside). R303 ed30633e (desktop chords in the unit view). R313 42688759 (letters typed into a unit slot read as a unit, hardware keyboard only).
- R304 20da05b4 (`0B101`, `0O17` and `0XFF` read as numbers). R322 08285585 (Mode is on Shift + Deselect, Shift + Fmt is reserved). R323 20b8cb45 (the ∥ and % keys). R305 606ed7f7 (the signed report). R306 b3638dd6 (plain lists in the plain-text export).

Lane B (gorge, ron, annabell):
- R184f1 a3e8f7aa (the stat sheet's rows count as `stat-sheet`). G211 ed068b2e (history rows keep uid, at, giac, angle, digits and word). G232 46b4bbbb and G232f1 a3f23e2b (session export rows; the LaTeX export no longer carries `htmlStyle` or `class`).
- G213 7dd920f4, G213f1 106f9edc and G214 04b1a0f0 (Copy as Python: the translator, then Ans and stored names read only when the kept value equals the line's, then the function table with angles). G212 2ae4f5d2 (Home rows keep the stored values they read).
- G352 9c80055e (a matrix times a list needs one list element per matrix row, either order). G353 60111332 (patch 0049: variance and the sums by column; shared engine key d4ecab4b8ee5bae1).
- A100 66db7042, A137 92dbaa49, A101 145a2b0e (folder append, the staged write with its check, the checked append). G218 1e6765e8, G219 855ccf7c and G219f1 abdc6885 (the sync files and the sync queue; a line sent before a crash is not sent twice). G233 165ad133 and G234 6007a3e1 (stored units: factors, backup and Find).

Stream C (gorge, by day's chain, `.tasks/stream-c/run.sh`; its runs are in the log without a lane tag): G354 80e790eb, G355 b6672b4b, G356 85de9185, G357 1d619255, G358 8a288273.

Opus pass merges: A: 180 bef4b914, 182 e4e63505, 183 708566f0, 185 7fe56215, 187 70d4857d, 188 1f7a6c4b, 190 0fb8e594, 192 6c7202bd. B: 181 4bb085c2, 184 1ddf3d04, 186 ffde9f26, 189 c0015ef4, 191 eacb3ff6. Pass 193 changed no file. Docs commits include ca84f08b, 2e525d5d, 0165c713, 4bd3719d, 44dda0ac, 8d4f9493, d2d8b0a4, 1920e51a, 588f7924, c3603be0, f3bfa0e4, 419aa630. Also in the log: the night review of 11-14 (13:08, 47d23504: 29 packages) and its step 8 (14:40, 2abc9f86), and the stream C merge at 18:17 (71f1bdf6).

## Unmerged
- **G359** (gorge, Opus, stream C; cubic with tiny coefficients, patch 0050 `proot-huge-coefficients`). Run #1233: the worker finished at 04:34, the branch's engine was built (key 714621c2d26b0083), the run waited 2,082 s for host-cpu, checks passed at 05:51 and the audit said **FIX** (the `vecteur.cc` hunks of the patch in `balance` and `in_proot`, `0050-proot-huge-coefficients.patch:101-117`). No fix round is in the log yet. The worker's open point: the two new golden rows expect ⚠, not the bundle's ≈, because Home marks Giac's float solve roots as uncertain.
- No other run ended NOT MERGED. Pass 193 (G219f1) approved and left the audit's verdict standing.

## What went wrong
- **Free rounds lost to size and docs checks:** G211 (size), G213 (decisions.md 40.1 kB, then 40.2 kB: both free rounds), G219 (docs/04 over 70 kB), G355 (size), R189f1 (`import-rules.test.ts`), R298 (the start pin test at 62,180).
- **Fix rounds on real findings:** G213 took five rounds, G211 four, G214, G233, G234, G353, R298, R313, R322 and S51 three each, and R190, R299, R305, R306, G232 and A137 two.
- **Reds that passed on the next round:** G233 round 1 (golden `steps`: a 506-check run at budget 500, rows g186 and g331), R305 round 0 (golden `steps` g325f1), G356 round 0 (`listargsTable.test.ts`) and round 1 (golden `regress`), G358 round 0 (`text-rules.test.ts`) and round 1 (golden `regress`), R298 round 1 (`persist.spec.ts`), G353 round 1 (`rowgestures.spec.ts`). Pass 181's own golden run failed once on `steps` at load about 10 and passed alone at load 1.4.
- **FLAKE lines:** `matrixsize.spec.ts` three times on three different tests (R298, G354, G233), `linetouch.spec.ts` twice (R300, R301), `basemenu.spec.ts` once (R189f1), `matrixgrid.spec.ts` once (G214). No single test reached 3; passes 188 and 190 wrote no backlog line.
- **The first lane B step** was refused (`refused command with shell metacharacters`); henri's second command had the quotes taken out and ran.
- **Waits:** integ and host-cpu queues cost about 1,200 s per run on most runs. The longest host-cpu waits: G359 2,082 s, R302 1,836 s, G358 1,776 s, G233 922 s, G356 1,108 s.
- **Workers over 30 min with no reply file:** G211, A145 (90 min, no commit), G357 (60), G358 (60), G359 (120), G353 and G233 (the last commit 50 min before the check), A137, A101, G213f1.
- **Pass numbers taken:** lane A's pass 186 waited 872 s for the lock and became 187; lane B's pass 192 waited 546 s and became 193. gc ran 16 times (reports `.tasks/gc-2026-11-14.md` and `gc-2026-11-15.md`).

## Opus passes (NOTES)
- 180 (R189f1, R130f1, R190): all ok. vitest 5125, e2e 2083, golden passed. The start pin went 62,110 to 62,180 (R190). Left small: New does nothing and says nothing when all 25 letters are taken; the `matrix.menu` key in `enFind.ts` is indented wrongly.
- 181 (R184f1, G211, G232): R184f1 ok, G211 ok, G232 fix → G232f1 (KaTeX-only macros in the `.tex`). Decided: a row keeps the job's word, 64 bits unsigned when none is set; only a ⚠ row gets a reason in the export. Golden failed once on load, passed alone. R200 waits for G232f1.
- 182 (R221, R220, R174): R174 fix → R174f1. Decided: "es" finds the statC unit first (a shorter prefix ranks first), t06's budget is agreed with the owner when it goes active. R220's key path went to the owner. vitest 5152, e2e 2089.
- 183 (R174f1, S45, S51): all ok. vitest 5179, e2e 2089. S45's design went to the owner. `trust:check` is stale on phase-1 (7 counts and the trust sentences); `release.yml` runs it, so the tag waits on A91's `trust:refresh`.
- 184 (G232f1, G213, G214): G213 fix → G213f1 (Ans and stored names read by position, never by value; R181 waits for it). vitest 5201, e2e 2089. Nobody calls the translator yet, so no user could reach the wrong number.
- 185 (A145, R298, R312): all ok. A145 says FDROID BITS: differ (the recipe is unchanged, setarch refused); the choice is under "Needs the user". The entries' size limit was raised to 62,300 B (R298). R298 read from code only: leaving Home for an app view before the field is ready still empties the queue (`apps/shell.svelte.ts` lines 204 and 218); a backlog line once backlog.md has room.
- 186 (G213f1, G352, G353): all ok. vitest 5241, e2e 2098, golden passed. Probe: Giac's weighted forms still sum x² in one pass, so `variance(L,[1,1,1])` of an approx list shows ⚠ -1E-62 (backlog nr1114-be-2, no package). G353's untraced order dependence is a backlog line.
- 187 (S58, R299, R300): all ok. vitest 5245, e2e 2102. New R320 (lane A, after R308): the press counters load when idle and the lazy check reads the chunks; it should merge before the start pin reaches about 62.8 kB (62.29 kB now, budget 63 kB). G2 item 74 stays open; the default stands.
- 188 (R301, R302, R303): all ok. vitest 5282, e2e 2115. R303's question is answered already (R313). CORE DEVICE 76/76.
- 189 (A100, A137, A101, G212): all ok. vitest 5303, e2e 2115, golden passed. Left: Copy as work report lists no stored values for a Home row; `append` and `tail` do not run write's recovery, so one file name must never be both written and appended.
- 190 (R313, R304, R322): all ok. vitest 5377, e2e 2121, golden passed (parser 705/705). The unit view budget (R313's 39 kB) went to the owner. Nobody has looked at R322's gallery shot.
- 191 (G218, G219, G233, G234): G219 fix → G219f1 (a py batch written again after a crash runs its cells twice). vitest 5464, e2e 2139, golden passed (units 290/290). docs/04 has room again (69,585 B). The budget question for G233 and G234 went to the owner.
- 192 (R323, R305, R306): all ok. vitest 5469, e2e 2139. R305's question 3 was answered by the owner already (G2 item 75 can reopen it); the F180 wording went into A91's known limits.
- 193 (G219f1): ok; three rare cases the worker listed are accepted, and a fourth like them (the cap drops a sent line, the gap mark is written twice with a higher count) needs a stale provider and 400 queued lines, so no package. A tail read over the plugin's 4 MB limit fails and writes again as before. The queue is not wired in yet (R182). No file changed.

## What the owner must do
1. **Items in "Needs the user"** (decisions.md and backlog.md): **R220's key path** (recommended: an Uncertainty item in ☰, beside the settings gear); **S45's design** (the worker's recommendation, or SI numbers with a new residual rule; and Solve leaves P8's units as they are); **the unit view budget** (keep G233's and G234's raise: entries 42 kB, pin 78.55 kB, with R313's 39 kB folded in, or cut); **A145's F-Droid choice** (the bits differ).
2. **Looks:** the gallery shots `home-settings-trust-small` and `-fp6` (R174), and R322's Mode on Shift + Deselect (also R85's one-time phone check now reads Shift, Deselect).
3. **The device:** `HA24BZ2Y` was not found for 12 of 14 steps; no device run has read the code since pass 188 (1f7a6c4b). Plug it in (or give the lane another serial) before the freeze.
4. **Docs room:** decisions.md and backlog.md stay full (each pass moved long entries into the archive); backlog.md is at 20.0 of 20 kB, so R298's shell note and G219f1's fourth case have no line yet.
5. **Upstream:** patches 0049 (G353) and 0050 (G359, unmerged) are new and the log shows no sending.
6. **At the tag:** `trust:refresh` (A91); freeze Tue 11-17, tag Mon 11-23. **Push phase-1** when content: the log shows no push.

## Queue left for the next run
Rows of the merged packages are out (pass 192 deleted rows 793, 760 and 761). The lanes restart by themselves after each close to Tue 11-17.
- **Run first:** G359's FIX (stream C: patch 0050's `balance` and `in_proot` hunks).
- **Lane A:** R307, R308 (their After on R300 is gone), R320 (790), R222, R265, R200, R181 (After – now), R128, R182, R183, R201, R314, R316, R317.
- **Lane B:** G215, G216, G217, G271, G270, G272, G275, G276, G369, G370, G372, G373, G374.
- **Stream C, still to run:** G360, G363, G364, G361, G362 (after G359).
- **No package yet:** the weighted forms of variance and stddev (nr1114-be-2), G353's order dependence, R298's shell reads, the 25-letters New message, R313's remaining budget question.

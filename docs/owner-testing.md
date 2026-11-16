<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Owner testing guide

**Status (2026-11-09): a working guide, not a decision.** The owner asked for it after feeling less connected to what is being built. It says what is coming, how the app is split for testing by hand, and how a finding gets back into the work. Status of each feature stays in [must-have.md](must-have.md), the release bar in [release-0.1.0.md](release-0.1.0.md), the owner's words in [feedback.md](feedback.md). Counts are as of phase-1 `aa57eb81`.

## What is being built

| Stage | What the user gets | Open packages | When |
|---|---|---|---|
| Finish v0.1.0 | Why-trust page, Report a problem on Android, release notes, screenshots | 4 | Tag Sun 11-15 |
| Engine fixes | Stored `k`, lists holding doubles, Giac's raw text on screen, marks kept on stored values, hangs | 10 | Queued now |
| v0.2 Laptop hand-off | Session file, Copy as Python, sync folder, typed names on a hardware keyboard, linear regression, distributions | 23 | From about 11-16 |
| v0.3 Structure | Matrix entry and editor, number bases, Help key, key positions in Find, CSV and LaTeX export | 22 | After v0.2 |
| v0.4 Units, part 2 | Your own units, units inside Solve | 4 and stubs | After v0.3 |
| v0.5 to v1 | Uncertainty budget, formula sets, published benchmark, tablet layout, iPhone web app | 17 and stubs | Later |
| RPN | Stack entry on Home, units and ± kept | 6 | Before the freeze (owner, 2026-11-15); its keys after the Virtual Calculator session of 11-16 |
| Upkeep | Pipeline and device work | 5 | As needed |

Package order and open decisions: [must-have.md](must-have.md). Everything listed through v1 is about 170 packages (92 files, the stubs split, fix rounds added; an estimate).

## The ten segments

Tested in this order: the promise of the app first, then the areas with the thinnest automatic net.

| # | Segment | Core cases | Only a person can judge | Coming work that changes it |
|---|---|---|---|---|
| 1 | Home numbers and marks | 23 | Whether `=`, `≈` and `⚠` deserve belief on real work | Edge-case fixes |
| 2 | Entry and keys | 18 | Speed, flicks, the cursor, the fold handle | Stable until v0.2 |
| 3 | Units and ± | 3 | Real engineering chains, entry speed | Additions only |
| 4 | Stored data | 9 | Trust that nothing is lost | History format in v0.2 |
| 5 | Solve and Function | 4 | Real equations; Plot then Root has broken three times | Plots of user functions |
| 6 | CAS | 8 | Whether a right answer is also usable | Small fixes |
| 7 | Find | few | Finding a thing without thinking | Key positions, Help |
| 8 | History, copy, paste, share | few | Digits survive every route | Export in v0.3 |
| 9 | Look and layout | none | Everything; the review list in [release-0.1.0.md](release-0.1.0.md) | Should be settled |
| 10 | First run and release pages | none | Whether a stranger understands them | Test after the freeze |

Not worth testing yet: number bases (v0.3 builds them). Matrices are tested through Tmpl only; the editor and keys come in v0.2 to v0.3, so an idea for their entry counts as much as a bug.

## Tasks and reporting

**The todo sessions are dropped** (the owner, 2026-11-16: not usable for him). The `+N62` block of S01–S20 left `todo.txt` before that day; T4 ran the sessions itself on 2026-11-16 (feedback.md rows 56–71). A point the owner makes from daily use goes to [feedback.md](feedback.md) in his words with its triage (rule 12 of [03-feature-analysis.md](03-feature-analysis.md)); a `W` or `B` gets a package with the regression test first. Contexts `@n62-01-home` to `@n62-10-release` stay as the segment names of the table above.

## Sign-offs

Only the owner signs. A signed segment is reopened by any later change the owner wants to re-check.

| Segment | Build (date, device) | Verdict |
|---|---|---|
| 1 Home numbers and marks | | |
| 2 Entry and keys | | |
| 3 Units and ± | | |
| 4 Stored data | | |
| 5 Solve and Function | | |
| 6 CAS | | |
| 7 Find | | |
| 8 History, copy, paste, share | | |
| 9 Look and layout | | |
| 10 First run and release pages | | |

## What the history showed (2026-11-09)

Measured from git and `.coord/log.md`.

**Healthy.** 67% of the 526 package merges since 10-13 changed product code. Packages that are fix rounds fell from 31% of a week's merges to 25%. 45 of the 252 runs since 11-01 ended unmerged.

**Where work loops.**
- Look and themes: 27 package merges; the theme set was decided on 11-06 and changed on 11-07.
- Function, Plot, Root: core case c46 failed on 10-26, 10-27 and 11-09, with three different causes.
- Extreme inputs: the weekly fuzz keeps finding inputs nobody would type, with no rule for when it is enough.
- Test timing: several packages adjusted only waits; R167's premise was wrong.

**What the automation does not measure.** Every package is checked against its own text. The checks of the whole app were last used long ago: the hand check on 11-03 (162 package merges before this note); [feedback.md](feedback.md) has no new row since 10-18; the benchmark's `compare` column in `tests/tasks/tasks.yaml` is empty on all ten tasks; the outside rounds of [research/r18-outside-test.md](research/r18-outside-test.md) have not run. F205, a stored `k` lost after Enter, was found by an Opus pass with the core list and the unit tests green.

## Proposals, not decided

1. Keep the v0.2 rows out of the queue until the tag (G223, G229, G235, G230, G231, G222, G227).
2. A finding from the owner goes to the top of the queue.
3. Cap the extreme-input work, for example one weekly night and a fixed number of fixes.
4. Measure three or four benchmark tasks by hand before v0.2 starts.
5. Decide whether laptop hand-off really comes before matrices and Help.

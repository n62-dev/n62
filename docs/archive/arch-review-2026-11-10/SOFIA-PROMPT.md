# sofia: check the eight before-tag package drafts of the architecture review

An outside architecture review of N62 (Fable, 2026-11-10, snapshot `5d91e0c4`) produced 27 package drafts. Before any of them goes into `docs/`, check the eight marked "before the tag": X1 to X8. These are drafts, not merged work, so your job is the package check, not a diff audit. Is each one true, sized right, testable and ordered right?

**Files** (in the main checkout, gitignored, read them in place):
- The drafts: `<main checkout>/.tasks/arch-review-2026-11-10/packages/X1.md` to `X8.md`.
- Context: `REPORT-2.md` in the same folder. Sections 1, 3 and 4 are enough; read section 2 only if a draft cites it. Read `REPORT.md` only where a draft cites a finding (M2, B2 and so on).
- The format they should follow: two or three files in `docs/shifts/packages/`, and `docs/shifts/rules.md` section 4.

**Code:** check against the `phase-1` worktree (`<main checkout>/.claude/worktrees/phase-1`). The drafts cite line numbers as of `5d91e0c4`. If a merge since then touches a cited file, say so.

**Ground rules:** read-only. Edit no tracked file and no draft, make no commit, touch no device, and do not run the gate or e2e (the night lanes are running). A short probe is fine (`tools/probes/engine.ts`, `tools/probes/unit-result.ts`, or one Vitest file), with `GIAC_OUT=<main checkout>/engine/giac/_out/gsl`. Wrap anything longer than a minute in `tools/devlock.sh acquire host-cpu sofia-x 1800 || exit 1`.

**The owner's answers that the drafts rest on (2026-11-10):**
1. `≈` holds within a stated input range.
2. n62.dev is announced for every browser.
3. iOS v1 is the web app only.
4. No outside contributors at launch.
5. Screen readers come in v0.2.
6. Bare unit names mean SI/metric units, with explicit `_US`/`_UK` variants.

New tonight: **the release date is not fixed.** If the bar needs more time, the tag moves; there is no harm in that. So do not cut a package to fit the Thursday freeze. Judge each one on whether it belongs in v0.1.0.

**For each of X1 to X8, check:**
1. **The claim is true.** Reproduce the defect or confirm the gap in the code (`file:line`, a probe output). The drafts' key claims to verify:
   - X2: the restart loop (`engine/workerEngine.ts`, 96 workers in half a second).
   - X5: the unit view shows `= 0 m` for `(1/(1/0))*{m}`, which Home refuses.
   - X6: the F-Droid recipe builds without `setarch -R` (`fdroid/dev.n62.calc.yml`).
   - X7: the 14 bare US ids in `find/factors.yaml`.
   - X1 and X4: the Playwright configs are Chromium only.
2. **The fix is the right one, and the smallest right one.** Does it conflict with a decision in `docs/decisions.md` or a rule in `docs/rules-core.md`? Does it duplicate or clash with an open package (`docs/shifts/brief.md` section 0, `docs/shifts/packages/`), for example A110 or A91?
3. **Red first and the done-check.** Does the test really fail on `phase-1` today, and can the done-check be checked by a machine?
4. **The size.** Is it one concern and about a day or less? Name a split if not.
5. **Internal consistency.** For example, X7 says the old bare words stay search names, but also that a typed bare `gal` is refused. Which is right for the user?
6. **The owner, lane, device and order.** Check them against `.claude/agents/*.md` and REPORT-2's lane order.

**Also answer, briefly:**
- With no fixed date, which of X1 to X8 truly belong before the tag, and does anything from X9 to X27 belong there instead? Look at the list only; you do not need to check those drafts.
- Is anything missing that the release bar (`docs/release-0.1.0.md`) needs and the review did not name?

**Output:** write `<main checkout>/.tasks/arch-review-2026-11-10/SOFIA-CHECK.md`. It should have:
- one section per package: APPROVED, or FIX with the exact edits to the draft (old text, then new text) and the evidence;
- then the two answers above;
- then a proposed final order.

Keep it short and evidence-first. Finish with a 10-line summary as your reply.

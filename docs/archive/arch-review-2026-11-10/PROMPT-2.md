# Second pass: from findings to decisions

Your review (REPORT.md) is good. I want to use the context you have now for a second pass with three parts, in this order. The same ground rules apply: read-only, no commits, no devices, no gate or e2e run, light CPU, `host-cpu` lock for anything that takes more than a minute, no HP material.

**Snapshot.** Recreate the frozen worktree at the same commit, so this pass and the first one cite the same code: `git -C <main checkout> worktree add --detach <main checkout>/.claude/worktrees/arch-review 5d91e0c4`. Then run `git log --oneline 5d91e0c4..phase-1 -- <paths>` for the files you cite. If a merge since then changes a finding, say so. Remove the worktree when you finish.

## My answers to your questions

(Owner, 2026-11-10.)

1. **The `≈` promise holds within a stated range.** Every digit shown under `≈` is right for inputs inside a documented range. Outside it, the result is `⚠` by rule, and the range is stated in the help text. Part A's boundary design must include where this range is defined and enforced. Package 4 ("the envelope") is now in scope.
2. **n62.dev is announced for every browser on 11-15.** The Firefox core run and the WebKit try therefore belong before the tag. In Part B, say plainly whether that fits in five days next to the rest, and what the fallback is if WebKit fails (for example, a start note in browsers that have not passed).
3. **iOS for v1 is the web app only** (this confirms must-have decision 7). WebKit is the iOS product, so rank M2 with that in mind.
4. **No outside contributors at launch.** The agents and the owner stay the only authors for now. B7 (checks on pull requests) and pattern 3 (bare package ids in comments) can go to "later".
5. **Screen readers are in scope for v0.2.** Spoken results with the mark in words, and zoom allowed, belong in the "first two weeks" or "later" group, not before the tag. The v0.1.0 known limits must say that screen readers are not supported yet.
6. **Units use SI/metric names by default.** A bare name means the metric or international unit (ton is the tonne of 1,000 kg; cal is the thermochemical calorie). US and UK variants carry explicit names (`tonUS`, `galUS`, `galUK`). Use this rule to settle package 6's differences. Check what `find/units.yaml` does today, and list every bare name that breaks the rule.

## Part A: go deep where it matters most (about 50%)

M1 is your top finding, but you judged the checking layer from its structure and its churn. Its internals are on your "not reached" list: `host.ts`, `homeEval.ts`, `numeric.ts` and `units/evaluate.ts`. Read them now, in sections, following the path of one Home result, one CAS result, one Solve root and one unit conversion from engine output to the mark.

Answer these questions:
- **Is the 45-fixes-a-week churn converging or not?** Sort the fixes of the last four weeks in these files into kinds: a new case in a known rule, a rule that was wrong, two rules that conflict, or plumbing. A falling share of "rule wrong" and "rules conflict" means it is converging. Give the numbers.
- **Where exactly is the boundary missing?** List the places where a mark is decided or changed outside `markOf`, and the places where trust facts are rebuilt instead of carried along.
- **What should the boundary look like?** Give one design, not options: the module or modules, what goes in and what comes out, which current functions move where, and what a new app (for example Statistics) would have to call. Keep it to what fits this codebase today, and make it achievable in steps of a day each.
- **Check M1's own claims.** Re-verify the numbers you gave (the tripling and the 45 a week) against git, and correct them if they are wrong.

If this reading changes M1's ranking or its recommendation, say so plainly.

## Part B: the launch on 11-15 (about 30%)

The tag is in five days and n62.dev goes public with it, announced for every browser. Use my answers above.
- Put every finding (M1–M4, B1–B7, patterns 1–6) into one of three groups: **before the tag**, **in the first two weeks after**, or **later**. Give a one-line reason for each.
- Look at what you did not reach that a first public visitor or F-Droid would touch: the service worker (update, stale cache, offline first start), the first run in a browser that is not Chromium, the F-Droid recipe (`fdroid/`), and what happens when the engine fails to load. Report only what would hurt on launch day.
- Read `docs/release-0.1.0.md` and `docs/must-have.md` section A. Name anything in the bar that your findings show is not really met, with evidence.

## Part C: packages ready for the queue (about 20%)

For every item in "before the tag" and "first two weeks", draft a package file. Read two or three files in `docs/shifts/packages/` first and copy their format exactly: the owner agent, one concern, about a day or less, a red-first test where it fixes a bug, a clear done-check, and dependencies. Use the placeholder ids X1, X2 and so on. The owner mints the real ids when the packages are committed. Write them to `<main checkout>/.tasks/arch-review-2026-11-10/packages/`, not to `docs/`. At the end, give a proposed order for lane A and lane B (by importance, then by dependencies), and mark which packages need a device.

## Output

Write `<main checkout>/.tasks/arch-review-2026-11-10/REPORT-2.md` with these sections:
1. What changed from REPORT.md (rankings, corrected numbers, findings dropped or added).
2. The checking layer: the convergence numbers, the missing boundary, and the one design.
3. The launch: the three groups and the launch-day risks.
4. The package list and the lane order.

Keep it plain and short: one recommendation per point. When you finish, post a 10-line summary in the chat.

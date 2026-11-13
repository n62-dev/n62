<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Shift brief: after the core freeze, run by the owner

**Every package runs through `scripts/pipeline.sh`** (rules section 4): `scripts/night.sh` runs the queue of section 0c around the clock (P25); a hands-on package the owner starts himself, one at a time (`scripts/pipeline.sh <agent> "<ID>" --model <m>`, the table gives agent and model), and reads the RESULT line. Nobody starts a worker or merges another way (CLAUDE.md). The standing rules in [rules.md](rules.md) apply; where the two differ, this brief wins. Each open package is one file in [packages/](packages/), in the shape the pipeline bundles (section 2). The shape of a package file: the heading `### <agent>, <ID>: <title>, branch \`p1/<agent>-<slug>\``; **Lane** (old words, kept in the files; night = auto: no device, no APK, no eye on the UI; night (the night's device) = auto on the device `night.sh` was started with, only, P23; day = hands-on, but see 0c's rule 10); **Starts when**; **Read** (repo paths get bundled, first 400 lines; the big shared docs by bare name and section); the steps; **Done when** (lines an auditor checks in the diff).

## 0. State and the path
State: the newest night report in this folder. Every merge: `git log --merges --oneline phase-1`; the audits are in the Opus passes' defaults (decisions.md, older ones in [archive/decisions-2026-10.md](../archive/decisions-2026-10.md)).

### The path after the freeze (owner, 2026-10-27; decisions.md "P23")
**The freeze ended** on 2026-10-27. **The net stays:** every merge runs the core list (R74; [tests/core/core.yaml](../../tests/core/core.yaml), 69 cases, all active), night.sh runs the device's core list after each Opus pass when the night has a device (A33, A41), and the owner's [hand check](../../tests/core/MORNING.md) runs before a release tag. A red result is a bug to fix (a FIX of the next Opus pass, or a backlog bug line past a day of work), not a gate. **The pace:** the most important steps first, so a usage limit late costs the least.

**Auto or hands-on, around the clock (owner, 2026-11-08; P25).** win99 runs the queue 24/7; "night" in names and docs (`night.sh`, `/night-review`, this brief) now means auto. A package is hands-on only when it needs the owner's input or a physical act (a decision, an eye on a look, a key, a tag, the phone); automated device lists stay auto, with the Tab One plugged in. v0.1.0 follows the freeze of Tue 11-17 (the order below); the new packages are in the lanes now. The load: about 180 open packages and the owner's estimate of 1,800 more from fixes, new bugs and features, in under 6 months, about 77 a week. The owner moves from Ultra (20× Pro) to Max (5×, 90 CHF a month), a quarter of the usage. The week to 11-08 merged about 165 packages (162 to 170, by which seven days; 28% FIX packages); if that was the week of about 60% of Ultra, Max pays for about 70 a week at that cost, about 1,800 in 26 weeks, so the target needs a package to cost about 10% less, or more time. Both lanes to the v0.1.0 tag; from the move to Max one lane, measured for a week (it needs about 10 h a day at that rate; fewer Opus passes than one per three packages is the first cut). **To build before 24/7** (checked 2026-11-08). Code: a henri call that fails at a usage limit counts as a bad reply and two end the lane; the six waits add up over a whole `night.sh` run; neither has met a real limit since `night.sh` began. Flags today: `--limit-wait 18000` (5 h a wait), `--max-steps 100`, `--until`; a shift a day is the daily stop (rules section 4a). The stop covers planned reboots and Windows updates and writes the queue's rows; a lane lost to an unplanned reboot restarts at the next stop.

**Two lanes** (owner, 2026-10-29; decisions.md P17 and "Owner answers of 2026-10-29"): lane A (ron's UI) and lane B (the release, then the engine) run around the clock, each with its own table in section 0c, merged through one queue (A47b). ron's packages run at night too: the owner's look moves to the milestone reviews ([release-0.1.0.md](../release-0.1.0.md), end), and a package's "owner's eye" item joins the next review. Device steps run in the lanes; the owner's acts (a key, a tag, a phone) wait for the owner (P25). The order:
1. **To Tue 11-17, no freeze** (owner, 2026-11-12 evening: Ultra ends after 11-17, so both lanes build as much as they can until then; this replaces the freeze of Fri 11-13). The order, in both lanes: first what changes how today's calculator is used (keys, gestures, layout, what a key opens), so the first release already has the final handling; then the critical bugs; then new features, in the [must-have list](../must-have.md)'s order. An Opus pass keeps this order and cuts no row for a freeze. v0.1.0 (the APK and the website from one tag) follows the freeze of Tue 11-17: the bar and the days are in [release-0.1.0.md](../release-0.1.0.md), and the tag waits for the bar (owner, 2026-11-10).
2. **Before a release tag, not daily (P25):** the owner's hand check (MORNING.md, on the device of the last automatic run, about 10 minutes). The next session writes each failed step as a backlog bug line on phase-1 and logs one line in `.coord/log.md`: `- HH:MM morning <date>: clean` or `- HH:MM morning <date>: fails <ids>`.

**The weekly extreme night** (owner, 2026-10-29; replaces the nightly fuzz of 2026-10-27): once a week lane B runs the extreme-input packages (G306–G308) and the fuzz (G309), in 10-minute slices (G167: from `app/`, each command as `../tools/devlock.sh slice <name> node scripts/sweep.ts …`; n = 4 for the 5,000 `--edges` trees: a part of 1,250 takes about 2 min at G138's 90 s per 1,000 trees, never more than 5,000 trees a part (8 min): `--nightly --edges --seed <clock> --count 5000 --part i/4` for i = 1..4, then `--shrink <seed>`; a missing part is named and exit 1; a long shrink: `--shrink <seed> --part i/m` for each i, then `--shrink <seed> --join`), with its triage (each week the text of G138, its package file at d1278849, with a new ID); the Opus pass files the backlog lines. Wrong numbers of everyday or medium reach run any time, by reach.

**S20** (the MPFI spike) hands-on. No package yet: the backlog lines that say so.

**The night review** (owner, 2026-11-01; `/night-review`, `.claude/skills/night-review/`): beside the lanes on Mon 11-09 and Sat 11-14 (owner, 2026-11-12: moved from Fri 11-13 to after the weekly reset at 09:00), each ending at a daily stop, and on Tue 11-17 on the frozen code; after the release as the owner sets (on Max each run costs a lot); its packages wait in its open note (`docs/research/night-review-<date>`, section 2), and section 0c takes them a few rows at a time.

**Why this order:** silent wrong numbers by reach first; the units right after the Settings base (owner, 2026-10-29).

### The day's packages (a device or an owner's act; the rest is in section 0c's tables)

| # | Package | Agent, model | Lane | Starts when merged | Size |
|---|---|---|---|---|---|
| [A61](packages/A61.md) | What the WebView answers to `persisted()` | annabell, Sonnet | day (the Fairphone) | R96f1 | ~0.2 d |
| [S33](packages/S33.md) | One place per pipeline rule: brief 0c against rules section 4 | sandra, Opus | day, no lane running | A75 | ~0.5 d |
| [A141](packages/A141.md) | The device step runs beside the lane | annabell, Sonnet | day, no lane running (owner, 11-12: moved from the freeze day) | the v0.1.0 tag | ~0.5 d |
| [A142](packages/A142.md) | The lane queues in a file of their own | annabell, Sonnet | day, no lane running | the v0.1.0 tag | ~0.5 d |
| [A143](packages/A143.md) | night.sh picks the plain step; henri the rest | annabell, Opus | day, no lane running | A142 | ~1 d |
| [A76](packages/A76.md) | The release builds only what ships; the update test from the last release | annabell, Sonnet | day | the v0.1.0 tag | ~0.3 d |
| [A82](packages/A82.md) | Store and README screenshots in the final look | annabell, Sonnet | day, on the release candidate (the Fairphone) | R140, R146, R147, R53, R153–R157 | ~0.2 d |
| [R292](packages/R292.md) | The v0.1.0 data fixtures and the rule they pin | ron, Sonnet | day, the freeze day (Tue 11-17), after the last merge that changes a stored shape | the freeze | ~0.5 d |

**Why these models:** Opus where a slip breaks entry, the unit chain or stored data for every later package, or gives a wrong number (P17: the engine, input and units); sandra and sofia run Opus; Sonnet elsewhere (an existing pattern, pinned by tests); the audit model follows P17.

## 0c. Night shifts: henri's plan (owner, 2026-10-14; queue rewritten 2026-10-27 after P23)
With the lanes, start both from the phase-1 worktree: `cd .claude/worktrees/phase-1 && setsid nohup scripts/night.sh --lane A --until 05:00 >> ../../../.tasks/night-<date>-A.out 2>&1 &` and the same with `--lane B` and `night-<date>-B.out` (`ANDROID_SERIAL=<the night's device>` in front of each when the night has one; night.sh writes `.tasks/night-<date>-<lane>.log`). The owner stops a lane with `scripts/night.sh --stop A` (or `B`; `all` for a night without lanes): it logs `STOPPED night.sh (lane A): by the owner` and the lane ends after its running step. A night without lanes: the same without `--lane` (`night-<date>.out`); `setsid`, as a closed terminal kills night.sh (2026-10-26). `scripts/night.sh` runs it (rules section 4): for every decision it starts a fresh henri (Sonnet, Read-only) who sees this section and the log's tail and replies with one `scripts/pipeline.sh` line; the script runs that line and asks again. **henri executes and decides nothing.** **Use the window** (owner, 2026-10-19): the queue runs until the usage limit or its end; what is not done stays in the queue for the next run (resumed from the log).

### Rules for a night shift (they replace rules section 4's day use)
1. **One pipeline run at a time** in a night without lanes; with the lanes (`night.sh --lane A|B`, A47c) one per lane, merged through one queue (A47b). night.sh refuses a second start of a lane, a lane while a night without lanes runs, and the reverse (`.coord/night-A.pid`, `night-B.pid`, `night-all.pid`); never a worker started any other way. A package is `scripts/pipeline.sh <agent> "<ID>" --model <model from the table> --audit-model auto` (`--audit-model opus` where the queue's model column says "audit Opus"): fresh worker, checks, at most two fix rounds, sofia's audit (P17: the pipeline raises gorge packages, Opus workers and engine, input or units diffs to Opus), merge. A review-only merge is `scripts/pipeline.sh <agent> "<ID>" --no-worker --audit-model auto` (A10): phase-1 merged into the branch, checks, audit, merge; a conflict or a FIX is a fix round for the package's agent. Its RESULT line in the log is the step's state.
2. **Devices:** a night without a device (`ANDROID_SERIAL` unset; owner, 2026-10-27) logs `DEVICE SKIPPED` after each pass and runs no annabell device step. Otherwise only the night's device, plugged in by the owner, and only for a queue step whose lane says "night (the night's device)" (annabell). The night's device is `$ANDROID_SERIAL`, set when `night.sh` starts: the Tab One (`HA24BZ2Y`), or the Fairphone 6 (`4d42e62f`) while APODroid's night has the Tab One (owner, 2026-10-21). APODroid's locks are not ours, so a night on the Fairphone never touches `HA24BZ2Y`; After each Opus pass night.sh itself runs `scripts/pipeline.sh device <n>` (henri is not asked; A41); the next Opus pass reads its `CORE DEVICE` line, and a `new` case is a FIX. The night's device stays unlocked: the owner unlocks it once at plug-in, and its saved settings (`.coord/devices/<serial>.orig`, `STAY_ON=7`) keep the screen on while charging (when it leaves the lanes: `tools/stay-awake.sh <serial> --restore-real` puts back `.orig.real`); never remove a PIN (banking keys; owner, 2026-10-22). Nobody else runs `adb` or `build.sh`. A missing or `unauthorized` tablet is not a failure: the worker says so in its report, the step stays unmerged and runs hands-on.
3. **henri decides nothing.** Anything this section does not settle: the pipeline logs it, and henri hands it to the next Opus pass (at once, if it blocks the queue). **Follow every Opus-pass recommendation as written.** Plan changes go to the owner through `docs/decisions.md` "Needs the user", written by the Opus pass.
4. **Workers tick their own backlog line** and file their "Needs the user" items on their branch (rules section 5); the audit sees them in the diff.
5. **Opus pass:** `scripts/pipeline.sh pass <n> "<IDs with merge commits or unmerged branches>" "<open questions or none>"` after every three finished packages (merged or left unmerged; fix packages from a pass count; in lanes each lane counts its own), and the last pass at the end of the queue. Each FIX line of its reply runs as `scripts/pipeline.sh <agent> "<prompt>" --id <ID>f1 --branch <branch> --model <m> --audit-model auto`, then QUEUE is followed. A prompt never holds a backtick or a `$` (`night.sh` refuses them; two refusals in a row end the night). The last pass's FIX packages get only their audit, then the report: lane A's night.sh writes it after lane B's night.sh has ended (at most 5 h); lane B's night ends after its last pass.
6. **Log:** the pipeline writes one line per step in `.coord/log.md` (time from `date`, step, agent and model, outcome, commit); `night.sh` logs each henri reply. In lanes every line of a lane starts with `[A]` or `[B]` after its time; henri reads his lane's last 80 lines and the other lane's finished steps since the night header. The log is the queue state: henri continues from the first step without its result line (`MERGED`, `NOT MERGED` or `SKIPPED`).
7. **Usage limit:** the pipeline exits 75 and `night.sh` waits 30 minutes and retries, at most ten times in a row, then logs `STOPPED`. No retry loops in agents. The owner resumes with `scripts/night.sh` again. A usage limit in the two closing steps (rule 9) waits and retries that step.
8. **A step that ends without a RESULT line on stdout** (the pipeline died; A10 makes every exit print one): henri runs the same step once more; if the log then shows it twice without a RESULT, he skips it and goes on. **Worker gone without a report** (no commit): the pipeline logs `NOT MERGED (no commits)` and keeps the worktree; henri runs the same step once more (the pipeline resumes the branch). If that fails too, go on.
9. **The end:** after the last pass and its FIX packages, `scripts/pipeline.sh report` writes and commits the shift report; henri then answers `SHIFT DONE`. **On time (A17):** start `scripts/night.sh --until <HH:MM>` (`--dry-run` shows the plan); from that time, or at `--max-steps` minus 2, henri is asked only for the last Opus pass (or `NO PASS`: the answer when the lane finished no package since its last pass), then night.sh runs the report and stops. The pipeline merges only the commit its audit read and stops with `NOT MERGED (the branch is not the audited HEAD)` otherwise.
10. **"Lane: day" (owner, 2026-10-29):** a package whose lane says day runs in the lanes too, unless it needs a device the lane was not given or an owner's act (a key, a tag, the phone); its "owner's eye" item joins the next milestone review (section 0).
11. **Selftest:** a selftest step is `scripts/pipeline.sh selftest` (from A47a); its line `selftest: PASSED` finishes it; `selftest: FAILED` ends the night: henri answers `SHIFT DONE`, and the owner reads the log.
12. **No lanes after a failed selftest:** the owner starts `scripts/night.sh` without `--lane`, and henri runs lane B's rows, then lane A's, as one queue.

### The lanes on the Tab One (owner, 2026-11-07)
`ANDROID_SERIAL=HA24BZ2Y` for both lanes, from the phase-1 worktree. The Tab One stays plugged in and unlocked (`tools/stay-awake.sh HA24BZ2Y --restore`, STAY_ON=7). CORE DEVICE after each pass. A new Giac patch takes the next free number after phase-1 is merged into its branch; a clash is a fix round. In "After", "–" is merged; a step whose "After" is not merged is refused by the pipeline (`RESULT #<n> <ID>: WAITS for <ids>`, exit 2, no worker; A127): henri takes the next row and comes back once the After has merged, and a second WAITS of one command with no MERGED since is SKIPPED. Follow each Opus pass as written (rule 3).

### Lane A queue (ron's UI, with rows from lane B)
The order (owner, 2026-11-12): the rows down to R224 change how today's calculator is used (touch, Store, Help, the matrix keys, the desktop keys, the wide layout); the rows after it are new features. S45, S51 and A145 came from lane B (2026-11-13); the rows that wait on lane B come last, after their After is due there, as a second WAITS with no merge is SKIPPED. A package whose file says day runs here by rule 10.

| Step | What | Agent, model | Branch | After |
|---|---|---|---|---|
| 662 | R197 the Help key: syntax and example of the function at the cursor | ron, Opus | `p1/ron-helpkey` | R196, R278 |
| 663 | R185 Shift + 5: a matrix that grows as you type | ron, Opus | `p1/ron-matgrow` | – |
| 664 | [R186](packages/R186.md) ⌫ takes an empty last row or column back | ron, Sonnet | `p1/ron-matshrink` | R185 |
| 665 | [R187](packages/R187.md) Shift + 4: the matrix sheet and its functions | ron, Sonnet | `p1/ron-matsheet` | – |
| 666 | [R131](packages/R131.md) a full desktop key map, % included | ron, Opus | `p1/ron-deskkeys` | R278, R283, R185, R187, R193, R197 |
| 730 | [R198](packages/R198.md) typed function names on a hardware keyboard | ron, Opus | `p1/ron-typednames` | R131 |
| 731 | [R224](packages/R224.md) the wide layout on a tablet and a desktop | ron, Opus | `p1/ron-widelayout` | – |
| 754 | [R291](packages/R291.md) the layout lock: no live key layer or fixed row moves unnoticed | ron, Sonnet | `p1/ron-layoutlock` | R278, R283, R185, R187, R193, R197, R131 |
| 667 | [R188](packages/R188.md) the matrix grid: a stored matrix in rows and columns | ron, Opus | `p1/ron-matgrid` | R187 |
| 668 | [R189](packages/R189.md) edit a cell of the grid and write it back | ron, Opus | `p1/ron-matedit` | R188 |
| 669 | [R190](packages/R190.md) a new matrix, rows and columns in the grid | ron, Sonnet | `p1/ron-matsize` | R189 |
| 732 | [R130](packages/R130.md) the work as a readable report | ron, Opus | `p1/ron-workreport` | – |
| 671 | [R221](packages/R221.md) t08 and t09 replay what works today | ron, Sonnet | `p1/ron-taskbaselines` | – |
| 672 | [R220](packages/R220.md) the uncertainty sheet's mockup (the owner picks) | ron, Opus | `p1/ron-uncsheetmock` | – |
| 670 | [R174](packages/R174.md) Help and about: Why trust it | ron, Sonnet | `p1/ron-trustpage` | – |
| 694 | [S45](packages/S45.md) units inside Solve: the design note | sandra, Opus | `p1/sandra-solveunits` | – |
| 695 | [S51](packages/S51.md) who holds the rights an App Store build would need | sandra, Opus | `p1/sandra-iosrights` | – |
| 697 | [A145](packages/A145.md) F-Droid's engine build against the release engine (a measurement) | annabell, Sonnet | `p1/annabell-fdroidbits` | – |
| 736 | [R222](packages/R222.md) the published ten tasks replay from their file | ron, Sonnet | `p1/ron-benchmarkfile` | S50, R221 |
| 673 | [R265](packages/R265.md) a history row says when it ran in another angle mode | ron, Sonnet | `p1/ron-rowangle` | G211 |
| 674 | [R200](packages/R200.md) export the session as CSV and LaTeX from the menu | ron, Sonnet | `p1/ron-exportrows` | G232 |
| 733 | [R181](packages/R181.md) Copy as Python on a row and on the session | ron, Sonnet | `p1/ron-pycopy` | G214 |
| 676 | [R128](packages/R128.md) the sync folder's Settings page | ron, Opus | `p1/ron-syncpage` | A137, A100 |
| 734 | [R182](packages/R182.md) each finished result goes to the sync queue | ron, Opus | `p1/ron-synchook` | R128, G219 |
| 735 | [R183](packages/R183.md) the sync page's device name and status line | ron, Sonnet | `p1/ron-syncstatus` | R128, R182 |
| 675 | [R201](packages/R201.md) a sheet to make your own unit | ron, Sonnet | `p1/ron-userunitsheet` | G234 |

### Lane B queue (the release, then the engine)
The order (owner, 2026-11-12): what a key or a result shows (R192 to G224); then the bugs (G340 to G309: wrong numbers first, then this week's extreme night); then S52, for the start chunk's room, and new features in the must-have list's order, with S50 and the sync chain to G219 early because lane A's last rows wait on them (2026-11-13). A package whose file says day runs here by rule 10, the device ones on the Tab One. The night review's queue goes on in [its note](../research/night-review-2026-11-09.md) section 2. A66's device check is a backlog line.

| Step | What | Agent, model | Branch | After |
|---|---|---|---|---|
| 699 | G331 patch 0047: `simplify` gives up on an `ln` that does not convert (F214) | gorge, Opus | `p1/gorge-lnundef` | – |
| 757 | A150 red-first runs an engine-reading vitest file on phase-1's engine | annabell, Sonnet | `p1/annabell-redfirsteng` | – |
| 698 | [G330](packages/G330.md) the Slope shows a cancelled 0 as a number (F227) | gorge, Opus | `p1/gorge-slopezero` | – |
| 610 | [G306](packages/G306.md) ∛, atan2, ln, sort (be-1) | gorge, Opus | `p1/gorge-decideroot` | – |
| 611 | [G307](packages/G307.md) powers of π and e (be-3) | gorge, Opus | `p1/gorge-literalpow` | – |
| 612 | [G308](packages/G308.md) (1+εi)^p (be-2) | gorge, Opus | `p1/gorge-powbase1` | – |
| 613 | [G309](packages/G309.md) the weekly fuzz, week of 11-11 | gorge, Opus | `p1/gorge-nightfuzz-1111` | – |
| 696 | [S52](packages/S52.md) can a chunk option give the start chunk room (1.8 kB left for the UI rows) | sandra, Opus | `p1/sandra-chunkspike` | – |
| 752 | [S50](packages/S50.md) the benchmark's protocol | sandra, Opus | `p1/sandra-benchmarknote` | – |
| 680 | [R194](packages/R194.md) word size and signed, in Settings | ron, Sonnet | `p1/ron-wordsetting` | R192 |
| 682 | [R184](packages/R184.md) a labelled result sheet for linreg and stats1 | ron, Sonnet | `p1/ron-statsheet` | – |
| 684 | [G210](packages/G210.md) one result as one JSON line (session format v0, a preview) | gorge, Opus | `p1/gorge-sessionline` | – |
| 685 | [G211](packages/G211.md) a history row keeps its Giac text, angle and digits | gorge, Opus | `p1/gorge-rowfacts` | G210 |
| 687 | [G232](packages/G232.md) the history as CSV and as LaTeX | gorge, Sonnet | `p1/gorge-exportrows` | G210 |
| 740 | [G213](packages/G213.md) Copy as Python, the core | gorge, Opus | `p1/gorge-pycore` | G210 |
| 741 | [G214](packages/G214.md) Copy as Python: functions and the angle mode | gorge, Opus | `p1/gorge-pyfuncs` | G211, G213 |
| 688 | [A100](packages/A100.md) append to a file in the sync folder (the Tab One) | annabell, Opus | `p1/annabell-folderappend` | – |
| 689 | [A137](packages/A137.md) the sync folder's write replaces a file whole (the Tab One) | annabell, Opus | `p1/annabell-folderwrite` | – |
| 745 | [A101](packages/A101.md) a checked append, never a mode switch (the Tab One) | annabell, Opus | `p1/annabell-appendcheck` | A100 |
| 686 | [G212](packages/G212.md) Home rows list the stored values they read | gorge, Opus | `p1/gorge-homeuses` | G210 |
| 746 | [G218](packages/G218.md) what the sync folder receives | gorge, Opus | `p1/gorge-syncfiles` | G211, G212, G213 |
| 747 | [G219](packages/G219.md) the sync queue: at least once, in order | gorge, Opus | `p1/gorge-syncqueue` | A101, G218 |
| 690 | [G233](packages/G233.md) your own unit: a definition the unit evaluator can read | gorge, Opus | `p1/gorge-userunit` | – |
| 691 | [G234](packages/G234.md) your own units are stored, backed up and found | gorge, Sonnet | `p1/gorge-userunitstore` | G233 |
| 742 | [G215](packages/G215.md) the generated Python runs and agrees with N62 | gorge, Opus | `p1/gorge-pydiff` | G214 |
| 743 | [G216](packages/G216.md) Copy as Python: units through pint | gorge, Opus | `p1/gorge-pyunits` | G215 |
| 744 | [G217](packages/G217.md) Copy as Python: ± through uncertainties | gorge, Opus | `p1/gorge-pysigma` | G216 |
| 692 | [G271](packages/G271.md) σ's terms leave the worker, each naming its input | gorge, Opus | `p1/gorge-uncterms` | – |
| 748 | [G270](packages/G270.md) the short form, the relative σ and U as text | gorge, Sonnet | `p1/gorge-shortform` | – |
| 749 | [G272](packages/G272.md) the uncertainty budget's model | gorge, Opus | `p1/gorge-budgetmodel` | G270, G271 |
| 750 | [G275](packages/G275.md) the formula set's model and its text form | gorge, Opus | `p1/gorge-setmodel` | – |
| 751 | [G276](packages/G276.md) a set's step is one closed expression | gorge, Opus | `p1/gorge-setclosed` | G275, G271 |

**Not queue rows** (henri never starts them; a session moves a row in when its condition is met). The owner said yes to the must-have decisions B2 to B7, B9, C1 to C6 and C8 on 2026-11-12: their rows are in the tables. R225 (the owner's iPhone check); R250 to R254 and G302, RPN (after the tag, with the owner's Virtual Calculator session); R223 (the owner's measurements). After the tag: A73f2, A141 to A143, A76, G314, G315, R267, R268, and G273, G274 (nothing in v0.1.0 reads what they store; after R220's pick). With no lane running (a stop the owner calls): A133 to A135, S33. After the freeze, by day: A91, A82, R292.

### The commands henri replies with (one per decision; `scripts/night.sh` runs it)
- `scripts/pipeline.sh <agent> "<ID>" --model <sonnet|opus> --audit-model auto`: the next queue step not done (the queue's skip rule above); `--audit-model opus` where its row says "audit Opus".
- `scripts/pipeline.sh <agent> "<ID>" --no-worker --audit-model auto`: a review-only merge of a finished branch.
- `scripts/pipeline.sh <agent> "<FIX prompt, verbatim>" --id <IDf1> --branch <branch> --model <m> --audit-model auto`: a FIX line of the last Opus pass, one per call, in order. No backtick and no `$` anywhere in the line.
- `scripts/pipeline.sh pass <n> "<IDs with merge commits or unmerged branches>" "<open questions or none>"`.
- `scripts/pipeline.sh selftest`: a selftest step (rule 11): the shell tests (`SELFTESTS` in `scripts/pipeline-lib.sh`: `scripts/pipeline.test.sh`, `scripts/night.test.sh`, `scripts/gc.test.sh`, `tools/devlock.test.sh`, `tools/manifest-backup.test.sh`, `tools/release-gate.test.sh`, `tools/release-guard.test.sh`); stdout `RESULT selftest: PASSED` or `RESULT selftest: FAILED (<test>: <first failing line>)`; options after it are ignored.
- `scripts/pipeline.sh report`, then `SHIFT DONE`.

### Opus pass (instructions for the Opus agent)
You are the shift's quality gate and its decision-maker; henri executes your reply literally. Work in your own worktree on `p1/pass-<n>`, made from `phase-1` (the pipeline names it); switch no branch; no code changes.
1. For each package: its package file (`git show <merge>^1:docs/shifts/packages/<ID>.md`: the merge deleted it, A75; the branch tip's parent if unmerged), its report (`git log -1 <merge>^2`, or the branch tip if unmerged), its diff (`git diff <merge>^1 <merge>`), and the audit's verdict from `.coord/log.md`.
2. Run once on `phase-1` (from `app/`, with absolute `GIAC_OUT`, `N62_DL_DIR` and `N62_QALC_DL_DIR`): typecheck, `npm run index` then `FIND_INDEX=required npm test`, e2e (its `CORE` line: the core list, R74), and the golden gate when engine or parser code changed. Take `tools/devlock.sh acquire host-cpu opus 1800` around them.
3. Check what an audit tends to miss: wrong or invented expected values (sources), a missing round trip, silent wrong numbers or marks (principle 3), scope, keys that moved, tests that pass for the wrong reason. An engine package gives its Giac calls per Enter before and after (`tools/probes/engine-calls.ts`). **The net (P23):** a core case that fails and is not `known:` is a FIX now; a device run since the last pass (night.sh's `CORE DEVICE` line, A33, A41) with a new failing case is a FIX or, past a day of work, a backlog bug line; a package that adds a feature its file does not name is a fix-or-revert.
4. Decide each "Needs a decision" item of these packages and each open question from the log: a default within the plan goes into `docs/decisions.md` (rules section 9); a plan change goes under "Needs the user" with your recommendation in one sentence. Apply the "For shared files" text of the packages' reports, delete each merged package's row from section 0's table or 0c's queue (the run deleted its file with the merge, A75; a merged FIX package's file, and any `scripts/gc.sh` lists, the pass deletes), and run `node tools/docs-check.mjs`. Commit them on your branch with `git commit -s` and the Opus trailer and leave nothing uncommitted; after your reply the pipeline takes `integ`, merges `phase-1` into your branch, runs the docs check and merges it into `phase-1` (A85), so your FIX and QUEUE lines apply to `phase-1` after that merge; take no lock yourself. After a flake census (`FLAKES <n>` line in the log, file `.tasks/flakes-<date>.md`): write one backlog line per flaky test, named by file and title, and add a wall-clock test to `isTiming` in `app/scripts/pipeline-logs.ts`, the tests the pipeline reruns once (A25). A test with 3 or more `FLAKE` lines in the log since the last census (e2e reruns that passed, A129) gets a backlog line, named by spec and title.
5. Reply in exactly this form, nothing before `OPUS PASS` and nothing after NOTES, and no backtick or `$` in a FIX prompt (`night.sh` refuses the line; name files and code in plain words). Never edit a DECIDED entry of decisions.md on a proposal that is still OPEN; put the change under the proposal. One FIX line per needed fix package; fix IDs are `<ID>f1`, `<ID>f2`, never `<ID>f3` or `<ID>f2f1`: at a chain's second follow-up the next FIX removes the shared cause, as a new id with the family's earlier cases as its tests (not a FIX line: the pipeline refuses a new id without its package file, A55, so the pass writes `packages/<id>.md` and a queue row); more than a day of work goes under "Needs the user" (owner, 2026-10-20):
```
OPUS PASS <n>
VERDICT: <ID> ok | <ID> fix — <one line each>
FIX <ID>f1: agent <ron|gorge>, model <sonnet|opus>, branch <new branch from phase-1>, prompt: <one paragraph with file:line and the fix>
QUEUE: unchanged | <the remaining steps in a new order, or steps to drop>
NOTES: <at most three lines for the shift report; the CORE count first>
```
henri runs each FIX as a package, then continues with QUEUE.

### Shift report (the last step)
`docs/shifts/<date>-night-report.md`, short and plain, from the log (`scripts/pipeline.sh report` starts a fresh writer with the log's night section on stdin): the core list's count on desktop and on the night's device (or DEVICE SKIPPED) first; what was merged (with commits); what is unmerged and why; the Opus passes' NOTES; what the owner must do (items under "Needs the user"); the queue left for the next run. Commit it on `phase-1` with `git commit -s` and the Sonnet trailer. Never push.

## 2. Read before you start (every package)
The pipeline hands you a bundle: your package file (`docs/shifts/packages/<ID>.md`), the first 400 lines of every file the block names by repo path, the report format below and the definition of done of section 8. Read further files by section (`grep -n '^#' <file>`, then the range), never whole files: every file you read is sent again on every later turn. The big shared docs are named in the blocks by bare name on purpose (`decisions.md "R15c"`, `backlog.md item 37`), so they stay out of the bundle: open only the section named.
- Your worktree and branch exist (`p1/<name>-<slug>` from `phase-1`, made by the pipeline); never switch branches in the main checkout. The shared paths and locks of rules section 5 (`GIAC_OUT`, `N62_DL_DIR`, `N62_QALC_DL_DIR`, `tools/devlock.sh` for heavy work) are set by the pipeline.
- [04-architecture.md](../04-architecture.md) sections 0 and 8, and the sections your package names. Where docs/04 and docs/02 differ, docs/04 wins.
- `docs/decisions.md` P23 (the core list is the net: a red case is a bug to fix before new work on the same code), P11, docs/03 section 0 rules 5–13 (they bind every package: one interaction model, keys never move, vertical space, removal tests), `docs/05-ui-plan.md` with its section 7, and `docs/feedback.md`.
- `docs/decisions.md`: P8, P9, P10, P15, P16, P17 and the defaults entry "2026-10-12 Architecture for the engineer core" (archive; docs/04 holds it). These are decided; don't reopen them. If a docs/04 decision turns out wrong in the code, don't change it silently: finish what you can, and put the evidence under "Needs a decision" in your report.
- **"Done when" names no shared doc (owner, 2026-10-24).** Text for a shared file (the list: rules section 5) goes in your report under "For shared files"; the Opus pass applies it, and an audit never sends a package back for it alone. Your package's own files and its backlog tick stay yours.
- **Scope:** only what your package file names: a fix that seems to need a new feature, key, view, setting or command stops and says so under "Needs a decision". Matrices: the Tmpl palette; Shift + 5 and Shift + 4 are R185 to R187.
- **No coordinator to message.** Stay inside the files your package names. Shared files follow rules section 5; devices are annabell's.

### Your report (every package)
End with a commit whose message body is the report. The audit and the Opus pass read it with `git log -1`. It holds:
- **Done:** what was built, item by item against the block's "Done when" lines.
- **Tests:** typecheck, vitest, e2e (with its `CORE` line) and golden counts as run.
  A test that passes on the old code is not a regression test: change it until it fails there, or list it under "Not done".
  Never run `app/scripts/behaviour-diff.ts` yourself: the audit runs it (A18; owner, 2026-10-22, after G76 lost 2 h to it).
- **Numbers:** for example the start chunk size before and after, or timings.
- **For shared files:** exact text for the backlog, decisions, THIRD_PARTY.md, docs/04, this brief. Never cut text you did not write to fit a docs budget: if a file is full, say so here and the Opus pass makes room.
- **Needs a decision:** anything left open.
- **Not done:** what's missing.

Then reply as the pipeline's prompt asks (at most five lines). Nobody is waiting for messages.

## 8. Definition of done
- **Each branch:** typecheck 0; `npm run index` (with `N62_DL_DIR` and `N62_QALC_DL_DIR` pointing at the main checkout's caches, as the pipeline sets them), then `FIND_INDEX=required npm test`, all pass (the Find query test fails rather than skips without the full index); e2e all pass, the core list included: every active case passes except its `known:` ones (the known-flaky `solve.spec.ts` persistence test and the Find 16 ms timing test may be re-run once); the golden gate when engine or parser code changed; by hand, `npm run gate` (from `app/`; `-- --quick` while working) runs all of these, the size test and a docs-size report in one command; SPDX headers; `git commit -s` with the trailer of the model that ran; the report commit; the start chunk size reported for UI packages; every "Done when" line of the block met or listed under "Not done".
- **Source size** (owner, 2026-10-20; `tools/docs-check.mjs` checks it, A22): no file grows past its line in `tools/line-baseline.yaml` and no new source file passes 800 lines, unless the same diff raises the line with a reason (the `calls-baseline.yaml` rule); a split lowers the line.
- **The net (P23):** a merge that turns a core case red is a bug the next Opus pass sends back as a FIX (section 0c, Opus pass step 3).

## 8a. Review and merge
Every review and merge is a pipeline run (rules section 4; CLAUDE.md): the audit by sofia on `git diff -U5 phase-1...<branch>` plus the block's "Done when" lines, then `git merge --no-ff --signoff` into `phase-1`. A finished branch from before the pipeline is merged with `scripts/pipeline.sh <agent> "<ID>" --no-worker` (A10). The Opus pass (section 0c) applies the reports' shared-file text, deletes merged packages' rows (the pipeline deletes their files with the merge, A75), and files proposals under "Needs the user". A package whose bug an earlier merge already fixed (G125) writes that its new tests `fail on the stock build`: red-first then runs its new golden cases, and the vitest files that read `GIAC_OUT`, on phase-1's code with the stock engine (built once by the pipeline), and the branch merges review-only (A71). Never push.

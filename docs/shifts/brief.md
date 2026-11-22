<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Shift brief: after the core freeze, run by the owner

**Every package runs through `scripts/pipeline.sh`** (rules section 4): `scripts/night.sh` runs the queue of section 0c around the clock (P25); a hands-on package the owner starts himself, one at a time (`scripts/pipeline.sh <agent> "<ID>" --model <m>`, the table gives agent and model), and reads the RESULT line. Nobody starts a worker or merges another way (CLAUDE.md). The standing rules in [rules.md](rules.md) apply; where the two differ, this brief wins. Each open package is one file in [packages/](packages/), in the shape the pipeline bundles (section 2). The shape of a package file: the heading `### <agent>, <ID>: <title>, branch \`p1/<agent>-<slug>\``; **Lane** (old words, kept in the files; night = auto: no device, no APK, no eye on the UI; night (the night's device) = auto on the device `night.sh` was started with, only, P23; day = hands-on, but see 0c's rule 10); **Starts when**; **Read** (repo paths get bundled, first 400 lines; the big shared docs by bare name and section); the steps; **Done when** (lines an auditor checks in the diff).

## 0. State and the path
State: the newest night report in this folder. Every merge: `git log --merges --oneline phase-1`; the audits are in the Opus passes' defaults (decisions.md, older ones in [archive/decisions-2026-10.md](../archive/decisions-2026-10.md)).

### The path after the freeze (owner, 2026-10-27; decisions.md "P23")
**The freeze ended** on 2026-10-27. **The net stays:** every merge runs the core list (R74; [tests/core/core.yaml](../../tests/core/core.yaml), every case active), night.sh runs the device's core list after each Opus pass when the night has a device (A33, A41), and the owner's [hand check](../../tests/core/MORNING.md) runs before a release tag. A red result is a bug to fix (a FIX of the next Opus pass, or a backlog bug line past a day of work), not a gate. **The pace:** the most important steps first, so a usage limit late costs the least.

**Auto or hands-on, around the clock (owner, 2026-11-08; P25).** win99 runs the queue 24/7; "night" in names and docs (`night.sh`, `/night-review`, this brief) means auto. A package is hands-on only when it needs the owner's input or a physical act (a decision, an eye on a look, a key, a tag, the phone); automated device lists stay auto, with the Tab One plugged in. **On Pro since Ultra ended (owner, 2026-11-17):** a twentieth of Ultra's usage, about 13 to 20 merges a week; one lane, started only when it has rows. How the lane runs on Pro (owner, 2026-11-17):
- Workers run on the model of their row; `.coord/model-cap` (A262) caps them to Sonnet while it exists (lifted 2026-11-20). `--audit-model auto` gives Opus to gorge packages and to diffs in the engine, input or units. Every package keeps its own audit.
- An Opus pass runs after every six packages (A260).
- No hourly monitor sessions, and no `/night-review` until a Pro week is measured.
- A256 and A257 wait until after the tag.

**The daily stop** (rules section 4a): usage limits are waited out (rule 7); the stop covers planned reboots and Windows updates; a lane lost to an unplanned reboot restarts at the next stop.

**Lanes** (decisions.md P17): night.sh can run lane A (ron's UI) and lane B (the release, then the engine) side by side, merged through one queue (A47b); on Pro one lane runs (above). ron's packages run auto too: a package's "owner's eye" item joins the next milestone review ([release-0.1.0.md](../release-0.1.0.md), end). v0.1.0 (the APK and the website from one tag) waits for its bar in [release-0.1.0.md](../release-0.1.0.md) (owner, 2026-11-10).

**Before a release tag, not daily (P25):** the owner's hand check (MORNING.md, on the device of the last automatic run, about 10 minutes). The next session writes each failed step as a backlog bug line on phase-1 and logs one line in `.coord/log.md`: `- HH:MM morning <date>: clean` or `- HH:MM morning <date>: fails <ids>`.

**The weekly extreme night** (owner, 2026-10-29): paused until after the v0.1.0 tag (one lane; owner, 2026-11-20). Then lane B runs G306–G308 and the fuzz G309 once a week in 10-minute slices (G138's package file at d1278849 holds the slice commands and the triage); the Opus pass files the backlog lines. Wrong numbers of everyday or medium reach run any time, by reach.

**The night review** (owner, 2026-11-01; `/night-review`, `.claude/skills/night-review/`): none on Pro for now (above); its packages wait in its open note (`docs/research/night-review-<date>`, section 2), and section 0c takes them a few rows at a time.

**Why this order:** silent wrong numbers by reach first (owner, 2026-10-29).

### The day's packages (a device or an owner's act; the rest is in section 0c's tables)

Their rows and conditions are in section 0c's "Not queue rows" (A61, S33, A141 to A143, A76, A82, R292); each package file names its model, lane and size.

**Why these models:** Opus where a slip breaks entry, the unit chain or stored data for every later package, or gives a wrong number (P17: the engine, input and units); sandra and sofia run Opus; Sonnet elsewhere (an existing pattern, pinned by tests); the audit model follows P17.

## 0c. Night shifts: henri's plan (owner, 2026-10-14; queue rewritten 2026-10-27 after P23)
Start from the phase-1 worktree: `setsid nohup scripts/night.sh [--lane A|B] [--until HH:MM] >> ../../../.tasks/night-<date>[-<lane>].out 2>&1 &` (`setsid`, as a closed terminal kills night.sh; `ANDROID_SERIAL=<the night's device>` in front when the night has one; on Pro the one lane of "The queue" below). The owner stops a lane with `scripts/night.sh --stop A` (or `B`; `all` for a night without lanes): it logs `STOPPED night.sh (lane A): by the owner` and the lane ends after its running step. `scripts/night.sh` runs it (rules section 4): for every decision it starts a fresh henri (Sonnet, Read-only) who sees this section and the log's tail and replies with one `scripts/pipeline.sh` line; the script runs that line and asks again. **henri executes and decides nothing.** **Use the window** (owner, 2026-10-19): the queue runs until the usage limit or its end; what is not done stays in the queue for the next run (resumed from the log).

### Rules for a night shift (they replace rules section 4's day use)
1. **One pipeline run at a time** in a night without lanes; with the lanes (`night.sh --lane A|B`, A47c) one per lane, merged through one queue (A47b). night.sh refuses a second start of a lane, a lane while a night without lanes runs, and the reverse (`.coord/night-A.pid`, `night-B.pid`, `night-all.pid`); never a worker started any other way. A package is `scripts/pipeline.sh <agent> "<ID>" --model <model from the table> --audit-model auto` (`--audit-model opus` where the queue's model column says "audit Opus"): fresh worker, checks, at most two fix rounds, sofia's audit (P17: the pipeline raises gorge packages, Opus workers and engine, input or units diffs to Opus), merge. A review-only merge is `scripts/pipeline.sh <agent> "<ID>" --no-worker --audit-model auto` (A10): phase-1 merged into the branch, checks, audit, merge; a conflict or a FIX is a fix round for the package's agent. Its RESULT line in the log is the step's state.
2. **Devices:** a night without a device (`ANDROID_SERIAL` unset; owner, 2026-10-27) logs `DEVICE SKIPPED` after each pass and runs no annabell device step. Otherwise only the night's device, plugged in by the owner, and only for a queue step whose lane says "night (the night's device)" (annabell). The night's device is `$ANDROID_SERIAL`, set when `night.sh` starts: the Tab One (`HA24BZ2Y`), or the Fairphone 6 (`4d42e62f`) while APODroid's night has the Tab One (owner, 2026-10-21). APODroid's locks are not ours, so a night on the Fairphone never touches `HA24BZ2Y`; After each Opus pass night.sh itself runs `scripts/pipeline.sh device <n>` (henri is not asked; A41); the next Opus pass reads its `CORE DEVICE` line, and a `new` case is a FIX. The night's device stays unlocked: the owner unlocks it once at plug-in, and its saved settings (`.coord/devices/<serial>.orig`, `STAY_ON=7`) keep the screen on while charging (when it leaves the lanes: `tools/stay-awake.sh <serial> --restore-real` puts back `.orig.real`); never remove a PIN (banking keys; owner, 2026-10-22). Nobody else runs `adb` or `build.sh`. A missing or `unauthorized` tablet is not a failure: the worker says so in its report, the step stays unmerged and runs hands-on.
3. **henri decides nothing.** Anything this section does not settle: the pipeline logs it, and henri hands it to the next Opus pass (at once, if it blocks the queue). **Follow every Opus-pass recommendation as written.** Plan changes go to the owner through `docs/decisions.md` "Needs the user", written by the Opus pass.
4. **Workers tick their own backlog line** and file their "Needs the user" items on their branch (rules section 5); the audit sees them in the diff.
5. **Opus pass:** `scripts/pipeline.sh pass <n> "<IDs with merge commits or unmerged branches>" "<open questions or none>"` after every six finished packages (merged or left unmerged; fix packages from a pass count; in lanes each lane counts its own; `PASS_EVERY` in `night.sh`, A260), and the last pass at the end of the queue. Each FIX line of its reply runs as `scripts/pipeline.sh <agent> "<prompt>" --id <ID>f1 --branch <branch> --model <m> --audit-model auto`, then QUEUE is followed. A prompt never holds a backtick or a `$` (`night.sh` refuses them; two refusals in a row end the night). The last pass's FIX packages get only their audit, then the report: lane A's night.sh writes it after lane B's night.sh has ended (at most 5 h); lane B's night ends after its last pass.
6. **Log:** the pipeline writes one line per step in `.coord/log.md` (time from `date`, step, agent and model, outcome, commit); `night.sh` logs each henri reply. In lanes every line of a lane starts with `[A]` or `[B]` after its time; henri reads his lane's lines since its last Opus pass reply (80 to 400; `henri_input`, A260) and the other lane's finished steps since the night header. The log is the queue state: henri continues from the first step without its result line (`MERGED`, `NOT MERGED` or `SKIPPED`).
7. **Usage limit:** the pipeline exits 75 and `night.sh` waits 15 minutes and retries, with no end (A262; `N62_NIGHT_LIMIT_MAX=N` stops after N waits in a row). One command at a limit 4 times in a row while henri answered is logged `RESULT -: SKIPPED`: do not repeat it. No retry loops in agents. A usage limit in the two closing steps (rule 9) waits and retries that step.
8. **A step that ends without a RESULT line on stdout** (the pipeline died; A10 makes every exit print one): henri runs the same step once more; if the log then shows it twice without a RESULT, he skips it and goes on. **Worker gone without a report** (no commit): the pipeline logs `NOT MERGED (no commits)` and keeps the worktree; henri runs the same step once more (the pipeline resumes the branch). If that fails too, go on.
9. **The end:** after the last pass and its FIX packages, `scripts/pipeline.sh report` writes and commits the shift report; henri then answers `SHIFT DONE`. **On time (A17):** start `scripts/night.sh --until <HH:MM>` (`--dry-run` shows the plan); from that time, or at `--max-steps` minus 2, henri is asked only for the last Opus pass (or `NO PASS`: the answer when the lane finished no package since its last pass), then night.sh runs the report and stops. The pipeline merges only the commit its audit read and stops with `NOT MERGED (the branch is not the audited HEAD)` otherwise.
10. **"Lane: day" (owner, 2026-10-29):** a package whose lane says day runs in the lanes too, unless it needs a device the lane was not given or an owner's act (a key, a tag, the phone); its "owner's eye" item joins the next milestone review (section 0).
11. **Selftest:** a selftest step is `scripts/pipeline.sh selftest` (from A47a); its line `selftest: PASSED` finishes it; `selftest: FAILED` ends the night: henri answers `SHIFT DONE`, and the owner reads the log.
12. **No lanes after a failed selftest:** the owner starts `scripts/night.sh` without `--lane`, and henri runs lane B's rows, then lane A's, as one queue.

### The lanes on the Tab One (owner, 2026-11-07)
`ANDROID_SERIAL=HA24BZ2Y`, from the phase-1 worktree. The Tab One stays plugged in and unlocked (`tools/stay-awake.sh HA24BZ2Y --restore`, STAY_ON=7). CORE DEVICE after each pass. A new Giac patch takes the next free number after phase-1 is merged into its branch; a clash is a fix round. In "After", "–" is merged; a step whose "After" is not merged is refused by the pipeline (`RESULT #<n> <ID>: WAITS for <ids>`, exit 2, no worker; A127): henri takes the next row and comes back once the After has merged, and a second WAITS of one command with no MERGED since is SKIPPED. Follow each Opus pass as written (rule 3).

### The queue (two lanes from 2026-11-22; owner, 2026-11-17 and 2026-11-22)
Two lanes on the Tab One (owner, 2026-11-22: usage has room): `ANDROID_SERIAL=HA24BZ2Y scripts/night.sh --lane A` and `--lane B`, from the phase-1 worktree; lane A runs ron's UI rows, lane B gorge's maths fixes, wrong answers first; an After may name the other lane's row. The order is [release-0.1.0.md](../release-0.1.0.md)'s freeze row: before the tag only what the layout lock pins. The tag has no date (owner, 2026-11-21): it follows the last UI row and S57. On Max (owner, 2026-11-21) each row runs on the model its row names; `.coord/model-cap` holding `sonnet` caps every worker and pass to Sonnet again (A262); `--audit-model auto` as always.

### Lane A queue (v0.1.1 rows; owner, 2026-11-17)
**Released before the tag (owner, 2026-11-21: all UI work first, no time pressure):** henri takes this table's rows in order; a row with an owner condition in its text or After column waits for it. S57 now follows R849. The rest of the freeze row's list and the lanes' other rows still open at the stop (R585, R576, R315, R339, R338, R340, R316, R317, R267, R268, G372 to G374, R363 to R366, G617, G387, A73f2, A161, A162) wait in their package files.

| Step | What | Agent, model | Branch | After |
|---|---|---|---|---|
| 886a | R856 the bar's final look: house on Home, one size in every place, `STD 12 ▾ │ DEG` with no angle icon (owner, 2026-11-22) | ron, Opus | `p1/ron-barfinal` | R703f1 |
| 886b | [R857](packages/R857.md) the bulk resets ask once before they wipe (data loss; owner's list 2026-11-22, as below) | ron, Opus | `p1/ron-resetask` | – |
| 886c | [R858](packages/R858.md) a second tap on a lit input inserts at the caret, as Enter | ron, Opus | `p1/ron-inputtapcaret` | – |
| 886d | [R860](packages/R860.md) the big N62 mark shows whenever the view is empty | ron, Opus | `p1/ron-emptymark` | R856 |
| 886e | [R861](packages/R861.md) the unit view's Find keeps its ▾ | ron, Opus | `p1/ron-unitfindmark` | – |
| 886f | [R838](packages/R838.md) Settings and Mode open over the unit view and close back onto it (U2) | ron, Opus | `p1/ron-unitsettings` | R770 |
| 886g | [R862](packages/R862.md) ☰ in the unit view opens its tools menu | ron, Opus | `p1/ron-unitmenu` | R838 |
| 887 | [R705](packages/R705.md) a tap on an empty user key opens Your keys on its row | ron, Opus | `p1/ron-emptyuserkey` | – |
| 888 | [R376](packages/R376.md) a number right after °, ′, ″, % or ! is refused, if not merged by the stop | ron, Opus | `p1/ron-markthen` | – |
| 888a | [A266](packages/A266.md) Android's status and navigation bars follow the look | annabell, Sonnet | `p1/annabell-barsfollow` | – |
| 888b | [R843](packages/R843.md) N62 Light's Enter in orange A `#c26a00` (owner's pick, 2026-11-22) | ron, Opus | `p1/ron-enterorange` | R842 |
| 888c | [R872](packages/R872.md) one Enter rule; B&W and Solarized Enter colours (Solarized Light orange) | ron, Opus | `p1/ron-enterrule` | R843 |
| 888d | [R873](packages/R873.md) the round pad and the key line stand out in every look | ron, Opus | `p1/ron-padline` | R872 |
| 888e | [R874](packages/R874.md) the empty-history mark takes the hint's colour, faint | ron, Opus | `p1/ron-markhint` | R860, R873 |
| 888f | [R863](packages/R863.md) Settings on the tap (⚙), Help on its Shift | ron, Opus | `p1/ron-settingskey` | R856, R838 |
| 888g | [R866](packages/R866.md) the prefix keys end in a slot line (G_) | ron, Opus | `p1/ron-prefixslot` | – |
| 888h | [R867](packages/R867.md) a pad drag steps by number or name | ron, Opus | `p1/ron-padtoken` | – |
| 888i | [R868](packages/R868.md) a tap on the line brings the keys back (results mode) | ron, Opus | `p1/ron-linetapunfold` | R856 |
| 888j | [R869](packages/R869.md) Help on Find's highlighted row (help sheet or card) | ron, Opus | `p1/ron-helpfind` | – |
| 888k | [R870](packages/R870.md) Help in the unit view | ron, Opus | `p1/ron-unithelp` | R869, R838, R862 |
| 888l | [R871](packages/R871.md) Shift + Fmt opens the Fmt cycle's settings | ron, Opus | `p1/ron-fmtsettings` | G785 |
| 888m | [R881](packages/R881.md) the "rainbow" easter egg | ron, Opus | `p1/ron-rainbow` | A266 |
| 890 | [R742](packages/R742.md) zebra history rows; the picked row's edge | ron, Opus | `p1/ron-zebra` | R832, R743 |
| 891 | [R728](packages/R728.md) the keys say what they do (CAS letters, Alpha colours, docs/06's differences) | ron, Opus | `p1/ron-keyssay` | R723, R726 |
| 892 | [R729](packages/R729.md) the key legends: armed a ring, locked a fill; Shift and Alpha show their layers (K4) | ron, Opus | `p1/ron-keylegends` | R723, R726, R728 |
| 892a | [R864](packages/R864.md) the letter in a template key is italic | ron, Opus | `p1/ron-templateitalic` | R728, R729 |
| 892b | [R865](packages/R865.md) Find stands out: a lens and a foot bar | ron, Opus | `p1/ron-findlook` | R861, R729, R864 |
| 893 | [R701](packages/R701.md) the folder plugin (F380) | annabell, Sonnet | `p1/annabell-folderproxy` | – |
| 894 | [R710](packages/R710.md) Plot draws its axes (F385) | ron, Opus | `p1/ron-plotaxes` | – |
| 895 | [R709](packages/R709.md) every control has a spoken name (F384) | ron, Opus | `p1/ron-spokennames` | – |
| 896 | [A256](packages/A256.md) a sync run is audited by its conflict resolutions | annabell, Sonnet | `p1/annabell-syncaudit` | – |
| 897 | [A257](packages/A257.md) host-cpu goes to the oldest waiter first | annabell, Sonnet | `p1/annabell-fairlock` | A256 |
| 898 | [R781](packages/R781.md) a left-hand layout setting (owner, 2026-11-20) | ron, Opus | `p1/ron-lefthand` | R729 |
| 905 | [R796](packages/R796.md) Alpha + mol is cd in the unit view (K2) | ron, Opus | `p1/ron-candela` | – |
| 906 | [R797](packages/R797.md) a hold copies the unit view's reading, message or result (U7) | ron, Opus | `p1/ron-unitholdcopy` | R790 |
| 907 | [R806](packages/R806.md) a unit slot gets a caret: the model (owner's walk 2026-11-20, C1) | ron, Opus | `p1/ron-unitcaret` | R801 |
| 908 | [R807](packages/R807.md) the slot draws its caret and its marks (C2) | ron, Opus | `p1/ron-unitcaretdraw` | R806 |
| 909 | [R808](packages/R808.md) the caret moves; ⌫ and the powers act at it (C3) | ron, Opus | `p1/ron-unitcaretmove` | R807 |
| 910 | [R314](packages/R314.md) Memory's delete and Clear all have a one-level Undo | ron, Opus | `p1/ron-memoryundo` | – |
| 911 | [R813](packages/R813.md) Memory: a swipe left deletes, with Undo (C6) | ron, Opus | `p1/ron-memswipe` | R314 |
| 912 | [R814](packages/R814.md) Memory: Shift + ⌫ deletes the highlighted name (C6) | ron, Opus | `p1/ron-memdelkey` | R813 |
| 913 | [R815](packages/R815.md) Memory: tap, Enter, hold and Copy copy the full value (C6) | ron, Opus | `p1/ron-memcopy` | R814 |
| 914 | [R816](packages/R816.md) Memory: Paste asks, then replaces a value (C6) | ron, Opus | `p1/ron-mempaste` | R815 |
| 915 | [R818](packages/R818.md) Vars and Memory rows say what a name holds (C7) | ron, Opus | `p1/ron-namekinds` | – |
| 916 | [R819](packages/R819.md) filter chips in Vars and Memory (C7) | ron, Opus | `p1/ron-namechips` | R818 |
| 916a | [R875](packages/R875.md) a sheet title's earlier crumbs are buttons back | ron, Opus | `p1/ron-crumbs` | R856, R819 |
| 916b | [R876](packages/R876.md) setting rows 1: list rows, button rows | ron, Opus | `p1/ron-gotorows` | R875 |
| 916c | [R877](packages/R877.md) setting rows 2: switches, muted read-only rows | ron, Opus | `p1/ron-switchrows` | R876 |
| 916d | [R878](packages/R878.md) setting rows 3: an opening row ends in › | ron, Opus | `p1/ron-openmark` | R877 |
| 916e | [R879](packages/R879.md) ☰ in Home and CAS is the History menu | ron, Opus | `p1/ron-historymenu` | R875 |
| 916f | [R880](packages/R880.md) the gear in ☰'s title row becomes "Settings ›" | ron, Opus | `p1/ron-settingsword` | R879 |
| 919 | [R821](packages/R821.md) user keys: two layers, a switch for Alpha | ron, Opus | `p1/ron-userkeyalpha` | R729 |
| 920 | [R822](packages/R822.md) Store: a tap types the case Alpha types; (owner's rule yes, 2026-11-21) | ron, Opus | `p1/ron-storecase` | R820 |
| 921 | [R834](packages/R834.md) a faint ✕ on each history row deletes it (H1b) | ron, Opus | `p1/ron-rowx` | R832, R742 |
| 921a | [R859](packages/R859.md) input and result take a tap across their line | ron, Opus | `p1/ron-rowbands` | R858, R742, R834 |
| 924 | [R836](packages/R836.md) the row draws and copies the value Ans had: `[5]² = 25` | ron, Opus | `p1/ron-ansvalue` | G642 |
| 926 | [R840](packages/R840.md) every pop-up window: a 2 px edge in the theme's accent (P1) | ron, Opus | `p1/ron-sheetedge` | R770, R872 |
| 929 | [R847](packages/R847.md) Find for a user-key slot: titled "U1 ⇧", Places, Back returns (Y1) | ron, Opus | `p1/ron-slotfind` | R811, R821 |
| 930 | [R848](packages/R848.md) a tap on an empty user key opens its own slot sheet (Y1; reworks R705) | ron, Opus | `p1/ron-keysheet` | R705, R811, R821, R847 |
| 931 | [R849](packages/R849.md) Settings › Your keys as one window: the keys in their places, the picked key's slots below, Clear (owner, 2026-11-22) | ron, Opus | `p1/ron-yourkeyswindow` | R848 |
| 885b | [S57](packages/S57.md) a bug hunt on the everyday maths through the new layout; rows after it (R760–R769, G760–G769) | sandra, Opus | `p1/sandra-hunt-maths` | R849, R843 |

### Lane B queue (owner, 2026-11-22: gorge's maths fixes, wrong answers first)

| Step | What | Agent, model | Branch | After |
|---|---|---|---|---|
| B0 | [G398f1](packages/G398f1.md) G398 merges; its quartile finding moves to G786 (owner, 2026-11-22: first) | gorge, Opus | `p1/gorge-invcut` | – |
| B0a | G786 median and the quartiles of a float list are never 0 above 14 digits | gorge, Opus | `p1/gorge-floatsort` | G398 |
| B1a | [G783](packages/G783.md) a free name's ln(1/x) and √(1/x) keep their form, so a later value gets the principal branch (owner, 2026-11-22) | gorge, Opus | `p1/gorge-invfree` | G398 |
| B2 | [G399](packages/G399.md) arg of a negative real is π, never −π | gorge, Opus | `p1/gorge-argpi` | G398 |
| B2a | [G784](packages/G784.md) Copy writes the names the screen shows, never Giac's stand-ins | gorge, Opus | `p1/gorge-copynames` | – |
| B2b | [G785](packages/G785.md) Fmt skips a step that draws the same; a press that changes nothing is dead | gorge, Opus | `p1/gorge-fmtskip` | – |
| B4 | [G553](packages/G553.md) floor, ceil and round decide at the working precision | gorge, Opus | `p1/gorge-floorepsilon` | – |
| B5 | [G551](packages/G551.md) bitand, bitor and bitxor read a small negative integer as signed | gorge, Opus | `p1/gorge-bitsigned` | – |
| B6 | [G554](packages/G554.md) exp of a float matrix is its series, never the identity | gorge, Opus | `p1/gorge-matexpfloat` | – |
| B7 | [G405](packages/G405.md) solve keeps two real roots that are distinct but close | gorge, Opus | `p1/gorge-closeroots` | – |
| B8 | [G404](packages/G404.md) G358's climb on every path; past its reach is never an overflow | gorge, Opus | `p1/gorge-climball` | – |
| B9 | [G403](packages/G403.md) a tiny constant without an integer literal raises the check's start | gorge, Opus | `p1/gorge-tinyconst` | – |
| B10 | [G385](packages/G385.md) a temperature difference in brackets takes part in arithmetic | gorge, Opus | `p1/gorge-tempdiffarith` | – |
| B11 | [G381](packages/G381.md) a stored float list reads back as a list, never a vector | gorge, Opus | `p1/gorge-storedlist` | – |
| B12 | [G382](packages/G382.md) a decimal inside a string is never rounded | gorge, Opus | `p1/gorge-stringdigits` | – |
| B13 | [G550](packages/G550.md) a Home row whose σ cannot be carried says so | gorge, Opus | `p1/gorge-sigmalost` | – |
| B14 | [G400](packages/G400.md) Export › CSV and LaTeX carry a Home row's σ | gorge, Opus | `p1/gorge-exportsigma` | – |
| B15 | [G640](packages/G640.md) Ans frozen in history, live on the line: the tests, known-fail until G642 and R836 | gorge, Opus | `p1/gorge-anstests` | – |
| B16 | [G642](packages/G642.md) a row that used Ans keeps its snapshot (chip, shown LaTeX, source row) | gorge, Opus | `p1/gorge-anssnapshot` | G640 |
| B17 | [G365](packages/G365.md) the Function app reads a cell's kind from the worker | gorge, Opus | `p1/gorge-cellkind` | – |
| B18 | [G315](packages/G315.md) the one import cycle goes; the Calc port speaks its own errors | gorge, Opus | `p1/gorge-namesmodule` | – |
| B19 | [G314](packages/G314.md) EngineHost's definitions replay and casRun in their own modules | gorge, Opus | `p1/gorge-hostsplit` | – |
| B20 | [G401](packages/G401.md) Find knows the engineers' words for functions it has | gorge, Opus | `p1/gorge-findwords` | – |
| B21 | [G402](packages/G402.md) Find in a unit slot reads a compound unit as the slot does | gorge, Opus | `p1/gorge-findcompound` | G401 |

**Not queue rows** (henri never starts them; a session moves a row in when its condition is met). The Ultra clone `../n62-next` ran the after-tag rows G389 to R351 and R367 to G407 from its own brief and stopped; its phase-1 merges back once after the tag, which ticks those rows here. Waiting for the owner: R225 (the iPhone check), R223 (the measurements), A61 (the Fairphone, Wed 11-18 to Sat 11-21), A82 (the release candidate on the Fairphone); after the tag S90 and S95 (after A230), then A231, then A240 (after R700, R701, R709). By day A91, then G406 (no lane running); R292 on the release candidate. With no lane running (a stop the owner calls): S33. After the tag (0.2; owner, 2026-11-16), formula then units, in this order: G389, G391, R347, then the name rule (owner, 2026-11-16: a defined name of any letters, Greek and digits is one token, through one name registry): R354, R355, G393, G394, G395, R356, R357, R358; then R346, G388, R348, R351. After the tag: R882 (hints; then R706 onto it). After the tag: R254 then R343 (RPN's keys and stack view; owner, 2026-11-16: R250 to R253 ship with no way in, their key and value kept for good), A76, A133 to A135, A141 to A143, A154 to A156. After the tag, the night review of 2026-11-16's R367 to R373 and G407 (n62-next; each file's After).

### The commands henri replies with (one per decision; `scripts/night.sh` runs it)
- `scripts/pipeline.sh <agent> "<ID>" --model <sonnet|opus> --audit-model auto`: the next queue step not done (the queue's skip rule above); `--audit-model opus` where its row says "audit Opus".
- `scripts/pipeline.sh <agent> "<ID>" --no-worker --audit-model auto`: a review-only merge of a finished branch.
- `scripts/pipeline.sh <agent> "<FIX prompt, verbatim>" --id <IDf1> --branch <branch> --model <m> --audit-model auto`: a FIX line of the last Opus pass, one per call, in order. No backtick and no `$` anywhere in the line.
- `scripts/pipeline.sh pass <n> "<IDs with merge commits or unmerged branches>" "<open questions or none>"`.
- `scripts/pipeline.sh selftest`: a selftest step (rule 11): the shell tests (`SELFTESTS` in `scripts/pipeline-lib.sh`); stdout `RESULT selftest: PASSED` or `RESULT selftest: FAILED (<test>: <first failing line>)`; options after it are ignored.
- `scripts/pipeline.sh report`, then `SHIFT DONE`.

### Opus pass (instructions for the Opus agent)
You are the shift's quality gate and its decision-maker; henri executes your reply literally. Work in your own worktree on `p1/pass-<n>`, made from `phase-1` (the pipeline names it); switch no branch; no code changes.
1. For each package: its package file (`git show <merge>^1:docs/shifts/packages/<ID>.md`: the merge deleted it, A75; the branch tip's parent if unmerged), its report (`git log -1 <merge>^2`, or the branch tip if unmerged), its diff (`git diff <merge>^1 <merge>`), and the audit's verdict from `.coord/log.md`.
2. Run once on `phase-1` (from `app/`, with absolute `GIAC_OUT`, `N62_DL_DIR` and `N62_QALC_DL_DIR`): typecheck, `npm run index` then `FIND_INDEX=required npm test`, e2e (its `CORE` line: the core list, R74), and the golden gate when engine or parser code changed. Take `tools/devlock.sh acquire host-cpu opus 1800` around them.
3. Check what an audit tends to miss: wrong or invented expected values (sources), a missing round trip, silent wrong numbers or marks (principle 3), scope, keys that moved, tests that pass for the wrong reason. An engine package gives its Giac calls per Enter before and after (`tools/probes/engine-calls.ts`). **The net (P23):** a core case that fails and is not `known:` is a FIX now; a device run since the last pass (night.sh's `CORE DEVICE` line, A33, A41) with a new failing case is a FIX or, past a day of work, a backlog bug line; a package that adds a feature its file does not name is a fix-or-revert.
4. Decide each "Needs a decision" item of these packages and each open question from the log: a default within the plan goes into `docs/decisions.md` (rules section 9); a plan change goes under "Needs the user" with your recommendation in one sentence. Apply the "For shared files" text of the packages' reports. A report's proposed backlog lines and its "Needs a decision" items go where they belong in this pass, or in NOTES with where they went; a full doc is no reason to drop one: make room, or name the newest review note. Delete each merged package's row from section 0's table or 0c's queue (the run deleted its file with the merge, A75; a merged FIX package's file, and any `scripts/gc.sh` lists, the pass deletes), and run `node tools/docs-check.mjs`. Commit them on your branch with `git commit -s` and the Opus trailer and leave nothing uncommitted; after your reply the pipeline takes `integ`, merges `phase-1` into your branch, runs the docs check and merges it into `phase-1` (A85), so your FIX and QUEUE lines apply to `phase-1` after that merge; take no lock yourself. After a flake census (`FLAKES <n>` line in the log, file `.tasks/flakes-<date>.md`): write one backlog line per flaky test, named by file and title, and add a wall-clock test to `isTiming` in `app/scripts/pipeline-logs.ts`, the tests the pipeline reruns once (A25). A test with 3 or more `FLAKE` lines in the log since the last census (e2e reruns that passed, A129) gets a backlog line, named by spec and title.
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
- **Source size** (owner, 2026-10-20; `tools/docs-check.mjs` checks it, A22): no file grows past its line in `tools/line-baseline.yaml` and no new source file passes 800 lines, unless the same diff raises the line with a reason (the `calls-baseline.yaml` rule); a split lowers the line. A file past 800 lines gets its split package the same week, and an Opus pass lowers a line its file fell below (owner, 2026-11-14).
- **The net (P23):** a merge that turns a core case red is a bug the next Opus pass sends back as a FIX (section 0c, Opus pass step 3).

## 8a. Review and merge
Every review and merge is a pipeline run (rules section 4; CLAUDE.md): the audit by sofia on `git diff -U5 phase-1...<branch>` plus the block's "Done when" lines, then `git merge --no-ff --signoff` into `phase-1`. A finished branch from before the pipeline is merged with `scripts/pipeline.sh <agent> "<ID>" --no-worker` (A10). The Opus pass (section 0c) applies the reports' shared-file text, deletes merged packages' rows (the pipeline deletes their files with the merge, A75), and files proposals under "Needs the user". A package whose bug an earlier merge already fixed (G125) writes that its new tests `fail on the stock build`: red-first then runs its new golden cases, and the vitest files that read `GIAC_OUT`, on phase-1's code with the stock engine (built once by the pipeline), and the branch merges review-only (A71). Never push.

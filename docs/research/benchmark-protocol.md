<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# The published benchmark: tasks, values and rules (S50)

**Status: open** until the owner has measured. What the owner decides: one question in section 7 (how the G2 column is measured), and the stopwatch method in section 4 if the default does not suit. *sandra, 2026-11-13, at `a766ec9c`.*

**Why this note exists.** docs/03 rule 13: each benchmark task records hand-measured presses and time on the G2, on Qalculate! and on a phone calculator, and a feature whose task N62 does not win gets reworked or removed. A comparison that is published needs its tasks, expected values and rules fixed **before** anything is measured, so nobody can choose them after seeing the numbers. N62 can lose some of these tasks; the note is written so that it can.

Words used here: **median**, the middle value of the runs once sorted (half are faster, half slower; one bad run does not move it); **oracle**, a value computed by mpmath at two precisions that agree (`tests/golden/.venv`); **derived**, a value that follows by exact arithmetic. Both are the golden tests' `source:` tags.

## 1. The ten tasks

Ids: the ids of `tests/tasks/tasks.yaml` where the task is the same; t11 to t13 for the new ones (R222 writes them to `tests/tasks/benchmark.yaml`). **Angle** is the mode set before the first press (section 2); "none" means the task has no angle function. The **shown** value is what a 12-digit display reads; a tool that shows fewer digits is right when its digits are the expected value rounded to them (section 3). Every value comes from `tools/probes/benchmark-values.py` (run: `tests/golden/.venv/bin/python tools/probes/benchmark-values.py`), each non-exact one at 50 and 80 digits, agreeing to the 30 printed.

| # | Id | Task | Expected (shown; 30 digits or exact) | Source | Angle |
|---|---|---|---|---|---|
| 1 | t01 | 4.7k ∥ 10k (parallel resistors) | 3197.27891156; = 470000/147 = 3197.27891156462585034013605442 | derived | none |
| 2 | t02 | 72 km/h → m/s | 20 m/s exactly (1 km/h = 5/18 m/s) | derived | none |
| 3 | t04 | 2π · 25 mm, result in m | 0.157079632679 m; 0.157079632679489661923132169164 | oracle | none |
| 4 | t08 | x + y + z = 6, 2x − y + z = 3, x + 2y − z = 2 | x = 1, y = 2, z = 3 (substituted back: 6, 3, 2) | derived | none |
| 5 | t09 | mean and **sample** std dev (n − 1) of 9.81 9.79 9.83 9.80 9.82 9.78 9.84 9.81 9.80 9.82 | mean = 9.81 (981/100, derived); s = 0.0182574185835; 0.0182574185835055371152323260934 | oracle | none |
| 6 | t10 | (12.34 ± 0.05) m × (3.2 ± 0.1) m with σ | 39.488 m² exactly (4936/125); σ = 1.2 m² at two digits (below) | derived | none |
| 7 | t07 | 0xFF AND 0x3C, shown in binary | 111100 (= 60 = 0x3C) | derived | none |
| 8 | t11 | ∫₀^π sin²x dx, **exact** | π/2; as a decimal 1.57079632679489661923132169164 | derived | RAD |
| 9 | t12 | the root of cos x = x | 0.739085133215; 0.739085133215160641655312087674 | oracle | RAD |
| 10 | t13 | 3.2 · sin(25°) / 4.7, then the same with 27° **by editing** | 0.2877400931 (0.287740093100050679957091737632), then 0.309099914716 (0.309099914716287177232618462201) | oracle | DEG |

**t10's σ.** First order (GUM 5.1.2) gives σ = 1.24432953834585153273135059071; with the second-order term of a product of independent inputs (N62's G41, `tasks.yaml` t10) 1.24433958387571999637703178649. Both round to **1.2** at two significant digits, the usual way to state σ, so a tool is right with `39.5 ± 1.2 m²` (or 39.488 ± 1.24…) whichever order it uses; the first differing digit is the sixth, and the note does not judge a tool on it. A result without the unit is right but labelled "no unit".

**t09's spread.** The population value (n) is 0.0173205080756887729352744634151 (oracle). A tool that gives only that one has given the wrong number for this task: it is not "correct", and a route that converts it by hand (× √(10/9)) is labelled "manual formula".

**Out of this set:** t03 (2.2ᴇ-9 × 4.7ᴇ3), t05 (the speed of light by name) and t06 (the nearest E24 value) stay in EN0's file (`tasks.yaml`) for N62's own budgets. They measure N62's own entry or functions, and "cannot do" on another tool says little there.

**N62 today** (checked 2026-11-13 at `a766ec9c`; the shortest sequences are R222's to find and replay):
- t01, t02, t04, t10 are active in `tasks.yaml` (budgets 14, 9, 12, 25).
- t08 through Solve and t09 through Find's `mean` and `stddevp` (sample, n − 1: `app/src/find/rank.test.ts:20`) work; R221 writes their baselines.
- t07 **works today; the package's "not yet built" is stale.** Number bases have landed: entry of `0x…` (R191, R191f1 `a7214c9b`), the base as a display mode (R192 `240df474`), the Base menu on Shift + − (R193 `0325e5cb`). Evidence: `node tools/probes/parse.ts '\operatorname{bitand}\left(0xFF,0x3C\right)'` gives `bitand(255,60)`; `node tools/probes/engine.ts 'bitand(255,60)'` gives `60`, exact. That BIN draws `0b111100` is **(to verify)**: R222's replay reads it.
- t11: CAS gives `1/2*pi` (`MODE=cas node tools/probes/engine.ts 'int(sin(x)^2,x,0,pi)'`); Home gives the decimal 1.57079632679 only, so the exact result needs the CAS view, and the presses to get there count.
- t12: `fsolve(cos(x)=x,x,0.7)` in Home gives 0.739085133215, ≈ (engine probe); the Solve app's route is **(to verify)** by R222.
- t13: in DEG the parser writes `3.2*sin(pasdeg*25)/4.7`, and Home shows 0.2877400931 and, for 27, 0.309099914716 (`ANGLE=deg node tools/probes/engine.ts '3.2*sin(pasdeg*25)/4.7'`). The edit route (recall the row, change 5 to 7) is **(to verify)** by R222.

## 2. The start state (the same for every tool)

Set before the first press and not counted: the tool open on its main calculation screen (N62 Home, the G2's Home, Qalculate!'s main window, the phone calculator's first screen); the entry empty; the history and stored values cleared; every setting at the tool's own default **except the angle**, which is set to the task's column (DEG for t13; RAD for t11 and t12; left alone for "none"). N62's default is RAD (`app/src/state/session.svelte.ts:83`). Anything else the operator needs (a view, an app, a panel, a mode such as exact) is a press inside the task and counts.

## 3. Presses

- **The rule** is docs/04 5.2 for every tool: every press counts 1, Shift and Alpha included, Enter included; a screen tap, a flick or a drag counts 1; nothing is free. A held key that repeats counts 1.
- **Qalculate!** counts **physical key presses** on the laptop's keyboard, no mouse. Shift counts, so the keyboard layout changes the count: it is recorded with the version (`+` is Shift + `=` on a US layout and one key on a German one). Its completion (Tab or Enter on a suggestion) counts 1.
- **The sequence** is the shortest one the operator found, written down per tool and per task so that anyone can replay it; it is published with the counts. It is a short search, not a proof that nothing shorter exists.
- **± in Qalculate! (checked).** libqalculate 5.13.1 (the pinned tarball, `engine/qalc/_downloads/`) reads `±` and `+/-` as the same sign (`Calculator-parse.cc:378`) and a number written with it as a value with an uncertainty (`Number.cc:482-495`); the default propagation is the variance formula (`includes.h:804`). So t10 is typed `(12.34+/-0.05 m)*(3.2+/-0.1 m)` or with `±`, which a keyboard does not have. Evidence: `tests/golden/.venv/bin/python tools/probes/benchmark-values.py --qalc <tarball>`, read-only from the tarball. Not checked: the result Qalculate! shows on the owner's version and its fewest keys; both are the owner's at measuring.
- **The G2's presses** come only from black-box use (section 5); **N62's** from R222's replay, which counts by the same rule, and from the owner's hand runs, which must agree with it.

## 4. Seconds

- **What is timed:** from the first press to the correct result visible (both results for t08, t09 and t13). One human operator, the same for every tool.
- **Runs:** three practice runs per tool and task first, not recorded; then **at least five runs**, the **median** published (rules section 3), with the device, Android and WebView version (N62, phone calculator), the tool's version or firmware, and N62's build.
- **How:** the default is a phone camera at 60 frames per second filming the hands and the screen; seconds = frames from the first touch to the frame the result appears, divided by 60. A stopwatch adds the operator's reaction at both ends (a few tenths of a second, which is the size of the differences measured here). The films stay off the repo (section 5); only the numbers are published. If the owner prefers a stopwatch, every tool is timed by stopwatch and the table says so.
- **N62's seconds are never the replay's.** The replay runs at machine speed and says nothing about a hand.
- **The Virtual Calculator's seconds are not taken:** a mouse on a picture of keys is not comparable with fingers on keys, so that column stays empty ("not comparable", R223). Its presses are comparable.

## 5. Fairness and the clean room

- **Order:** the tools' order rotates each round (round 1: N62, G2, Qalculate!, phone; round 2: G2, Qalculate!, phone, N62; and so on), so no tool always comes first, fresh, or last, tired.
- **Slips are recorded, not hidden:** a run with a slip that the operator corrects stays in and counts toward the median, with the slip noted. A run that ends in a wrong result is recorded as failed, kept in the raw data and left out of the median; the cell shows how many runs failed.
- **Labels:** "cannot do" when the tool has no way; "manual formula" when the operator does part of the work in the head (72 ÷ 3.6 for t02, the root-sum-square of t10 by hand, a population σ converted); "decimal only" for a tool that cannot give t11 exactly; "retyped" for a tool that cannot edit the previous entry in t13; "no unit" for t02, t04 and t10 without the unit. A labelled cell is published with its numbers and never counts as a win.
- **Expected values** come from section 1 only (`oracle` or `derived`), never from a tool's own answer.
- **The operator** is the author of N62, who knows its keys best; the table says so ("measured by the author"). A volunteer's numbers are published as **third-party**, beside the author's, never mixed into them.
- **Published:** this protocol, every sequence, and the raw numbers of every run (R222's file; R223's table in the README).
- **Clean room** (docs/rules-core.md, "Legal / clean room"): the G2 is used as a black box only. A G2 cell is `source: device` (the owner's real G2) or `source: virtual-calc` (the official Virtual Calculator), else "not measured". No key sequence comes from a manual; no screenshot, film or key image of the reference goes into the repo; the G2 stays off the laptop. The reference's name appears only in the README, under the rule the README already follows: a nominative mention together with the disclaimer *"Not affiliated with HP Inc. or Moravia."*
- **Who measures:** the owner. Agents touch no app but N62 on a device (rules section 3) and do not measure.

## 6. What a result means (docs/03 rule 13)

**N62 wins a task** when its median seconds are the lowest among the tools that give the correct, unlabelled result; when another tool's median is within 10 % of N62's, the fewer presses decides; for a G2 cell from the Virtual Calculator (no seconds) presses alone compare. **A task N62 does not win** names its feature for rework or removal (rule 13): t01 Find's `par`; t02, t04 and t10 the unit view; t07 the number bases; t08 Solve; t09 Find's statistics; t11 the CAS view; t12 Solve or the Function app's root; t13 recalling and editing a row. The rework is a package; removal follows rule 11. Correctness comes first: a faster tool whose result is wrong or labelled does not beat N62.

## 7. Open for the owner

**How the G2 column is measured.** Recommended: on your own G2 (`source: device`), presses and seconds both, because it is the real thing, it gives seconds the Virtual Calculator cannot, and black-box use of a device you own raises no licence question. Cost: the G2 in hand for the rounds. Alternatives: the Virtual Calculator, presses only (seconds "not comparable"); whether its licence allows publishing a comparison timed or counted on it is **not verified** and is yours to read before any Virtual Calculator cell is published; nothing here reads an answer into it. Would change if the G2 is not at hand: then the Virtual Calculator's presses, after that check.

**The phone calculator** (a default, no question): the stock calculator of the phone N62 is timed on, so screen and hand are the same; its name and version are recorded.

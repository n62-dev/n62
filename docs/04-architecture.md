<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# N62 architecture for the precision-engineering goal

*sandra, 2026-10-12. **This document supersedes [02-architecture-plan.md](02-architecture-plan.md) wherever the two differ.** docs/02 stays the record of the original plan and of the reasoning that still holds (solver choice in section 4, licence and F-Droid in sections 10–11). Binding inputs: [rules-core.md](rules-core.md) (goal, three principles, hard rules), [03-feature-analysis.md](03-feature-analysis.md) (the owner's design rules), [decisions.md](decisions.md) P8. A claim about the code cites the file or a probe (`tools/probes/`, its README; Appendix A); **(to verify)** marks what was not checked, with who checks it and how (Appendix C).*

Each area: **state** (verified), **decision** (with the reason), **alternatives**, **budgets and gates**, **risks**, **what would change it**. Section 8: the component diagram, the interfaces, the budgets.

## 0. The decisions on one page

1. **One mark on every Home and CAS number:** `=` the decimal shown is the exact value; `≈` rounded, and every digit shown is right; `⚠` fewer reliable digits than asked, or a failed check (2.4).
2. **No digit is shown that the engine has not confirmed:** non-rational values are evaluated at two precisions and only agreeing digits are shown; a float from an unaudited function is `⚠`; inverse functions are substituted back like Solve roots (2.4, 2.5).
3. **Digits up to 30**, working precision `max(30, digits+10)`, value precision `max(40, digits+10)` (2.5).
4. **Results are reused as chips that carry the full value** (2.8).
5. **Copy gives the full value** (all confirmed digits, up to 40); "as shown", "exact" and LaTeX are in the Menu (2.6, 5.1).
6. **CAS floats are marked `≈` and formatted by us.** Typed decimals in CAS become exact (**P9**) (2.9).
7. **Find is one static index generated at build time**, searched by our own ranking code on the main thread (section 3).
8. **Constants and results enter the entry line as atomic MathLive macros**, never as free text (3.6); a unit slot holds R24a's tokens (4.3).
9. **The unit view computes on Giac (P15)**, exactly, in the worker already loaded (section 4).
10. **Keys:** every cell in 5.1, every difference from the G2 and its reason in [06-keypad-vs-g2.md](06-keypad-vs-g2.md). **State:** one IndexedDB store with a schema version, user definitions persisted (6.2). **Gates:** 7.3. **The Find index's constant values and unit factors** are the checked-in numbers of `find/factors.yaml` (P22, 7.1).
11. **Drawing and stack:** results are drawn in 2D from Giac's `latex()` by MathLive, never as raw engine text (one-line entry is a setting); each keyboard template has a parser rule and a round-trip case in the same commit (`app/src/input/roundtrip.test.ts`); the shell is Svelte 5, the keyboard, parser and engine client plain TypeScript (D1); every engine build that ships passes the golden gate (A42, `tools/release-gate.sh`).

The top risks are in section 9. Cut wording: [archive](archive/04-built-2026-11.md) section 10.

---

## 1. The goal as a test

### 1.1 Definitions

**Efficient** means the fewest key presses and no waiting. It is measured by:

| Id | Measure | Budget | Enforced by |
|---|---|---|---|
| E1 | Key presses per task | each active task within its budget; a unit in ≤ 4 presses at the median (rule 2) | `tests/tasks/tasks.yaml` replayed by Playwright (EN0) |
| E2 | Enter → drawn result, Home and CAS | p95 < 150 ms on the Tab One | `?bench=1` on the device (annabell), each release |
| E3 | Find: key → updated list | p95 ≤ 16 ms on the Tab One | `?bench=find` (A4b), milestone 4 gate |
| E4 | Start | keyboard usable < 1 s, engine ready < 1.5 s on the Tab One | device runs (`tools/device_run.py`), each release |
| E5 | First use of a lazy part | Units first result < 1 s; Find open → list ≤ 100 ms warm, ≤ 300 ms cold | device runs |
| E6 | Bytes | budgets in section 8.3 | size test (6.3) on every build |

**Precise** means no digit shown is wrong, and the user can tell an exact value from a rounded one. It is measured by:

| Id | Measure | Budget | Enforced by |
|---|---|---|---|
| P1 | Golden cases, with their mark | 100 % at 12 digits; the precision set also at 20 and 30 | golden gate (`npm run golden`) |
| P2 | Known paths that show a wrong or unmarked number | zero; each one in 2.3 is a regression case first | golden gate, parser and e2e tests |
| P3 | Numeric roots | every root substituted back (existing); a point accepted as noise-limited must also have \|f\| growing on both sides (G524), so a pole of a scaled function is never a root | `solve.yaml`, `function.yaml` |
| P4 | Units | a dimension mismatch is never a number; SI-exact conversions are `=` | `units.yaml` (milestone 5) |
| P5 | Copy | copy → paste gives the same value to every confirmed digit | e2e test per copy action (EN4) |

### 1.2 Every module against the goal
Each module's speed, trust, open points and cost as of 2026-10-18: [research/r12-evidence.md](research/r12-evidence.md) section 5.

---

## 2. Precision chain, end to end

### 2.1 The paths

Every Home and CAS number is marked by 2.4's rules; the agreement check runs on every non-rational value.

| Path | Where | Working precision | Rounding | Mark |
|---|---|---|---|---|
| Home exact, rational (`1/4`, `1/3`) | `homeEval.ts` | exact rational, BigInt division (`format.ts`) | once, half up, to `digits` | `=` when the text shown is the exact value, else `≈` |
| Home exact, irrational (`sqrt(2)`, `sin(10^22)`) | `homeEval.ts` | `evalf` at P = `max(40, digits+10)` and P + 20 | once | `≈`, or `⚠ n` |
| Home "exact" path where Giac's numeric code returns a float (`normald_icdf`, `romberg`, `BesselJ`) | `homeEval.ts` | Giac's routine, re-evaluated on the other side of 14 digits | once | `⚠` unless every function is audited (tier 0) |
| Home exact-big (`2^200`) | `homeEval.ts` | exact; the chip keeps the exact text up to 2 kB | once | `≈` |
| Home float fallback (timeout, error, an exact form past 2 kB whose check ran out of its call's step budget, G180) | `homeEval.ts` | Giac floats at `max(30, digits+10)` | once | by the agreement check |
| Home non-number (lists, matrices, symbols) | `homeEval.ts` `symbolic()`, `render/tidy.ts` | exact | elements by our formatter | the weakest element's; a symbol with a float `⚠` (2.3 #17) |
| Solve, Function analysis | `solve.ts`, `analysis.ts` | `max(30, digits+10)`; residual relative ≤ 1e-15 | once | `⚠` when the residual check fails |
| Function Num, Plot | `analysis.ts` (each cell is Home's), `input/emit-js.ts` | as Home; Plot draws in JS doubles; a stored real value at the engine's value, σ and unit named in a note (R361); user functions are not drawn | as Home | `⚠` only; trace values come from the engine |
| CAS exact; CAS numeric | `host.ts` `cas()` | exact; typed decimals exact (P9) | numbers by our formatter (2.9) | none for exact results; numbers as Home |
| Unit view | section 4 | Giac, exact factors from the Find index (P15) | our formatter | as Home; never `=` with a σ |

### 2.2 Where the facts live

Only the engine knows the path, whether a value is an exact rational, and how many digits are confirmed. Only the app knows the display format the user picked and whether an input was a measured constant. So the engine reports facts and the app's formatter (pure functions in `format.ts`, run on the main thread) turns them into the mark for whatever format is on screen. A settings or Format-key change re-marks the history without the engine, as it re-formats it.

### 2.3 Paths that showed a wrong or unmarked value
Twenty-one paths (#1–#21) showed a wrong or unmarked number; each became a regression case before its fix, all fixed; their lesson is 2.4. The list is [research/r12-evidence.md](research/r12-evidence.md) section 1: "2.3 #n" in the code and the golden files is row n there.

### 2.4 Decision: the mark and the agreement check

**The mark.** Before every numeric result in Home and CAS, small and muted, in the result's colour:
- **`=`** when all of these hold: the engine says the value is an exact rational (exact path, Giac returned `p/q`); the text shown in the current format is exactly `p/q`; no input was inexact (a constant with a CODATA uncertainty, or a result chip whose value is not exact, 2.8). Examples: `1/4` → `= 0.25`; `0.1+0.2` → `= 0.3`; `1e300*1e300` → `= 1E600`; `1/4` in FIX 1 → `≈ 0.3`.
- **`≈`** for every other number, provided every digit shown is confirmed: `1/3`, `sqrt(2)`, `2^200` in STD, the float fallbacks, constants with an uncertainty.
- **`⚠ n`** when fewer than `digits` digits are confirmed: the result is shown with the `n` confirmed digits and the mark says so. Solve and analysis keep their existing ⚠ for a failed residual check.
- No mark for non-numbers (symbolic results), **unless they hold a float**: then `⚠` without a count, since nobody checked its digits (2.3 #17; principle 3: "flagged"). A per-float check that could earn `≈` waits until `⚠` proves noisy in daily use. A list or matrix of numbers gets one mark, the weakest of its elements; our formatter formats each element.

Num tables and the Solve and analysis results show only `⚠` (a mark per cell would be clutter; the view header says "rounded to n digits").

**The agreement check** (engine, `homeEval.ts`, `solve.ts` `numericResult`, `analysis.ts`):
1. An exact rational needs no check: BigInt is exact.
2. Any other value is evaluated at precision P = `max(40, digits+10)` and again at P + 20. The confirmed digits are the largest n where both values, widened by their difference (+ 1 ulp), round alike (stricter at ties than "common digits − 1"). If fewer than `digits` agree, it runs once more at P + 20 against P + 40. If they cover the shown digits, the mark is `≈`; otherwise `⚠ n`. An exact integer of n digits, n + 20 > P, starts both runs and the decision below at n + P; past `MAX_EVAL_DIGITS` the value is `⚠` (P and P + 20 only) and a decision refused. A float from a function that is not audited shows `⚠` without a count: two Giac routines can agree on wrong digits. The exact path runs at P too; a result that rests on a numeric decision (sign, comparison, floor, abs, max, piecewise; int, sum, limit, solve; a stored function; a root of an even power) is decided again at P + 20, and if the texts differ, at P + 20 against P + 40; a decision P + 20 and P + 40 disagree on, or a tie at a cut Giac cannot prove, is refused (`error.undecided`); one that cannot run again (`sto`, `=>`, `[a,b]:=`), or a proven tie with no value to put in its place, is `⚠` without a count.
3. A value that Giac's numeric code returned as a float on the "exact" path (the exact output is a float literal, as `normald_icdf` gives `-1.2815515655446`) is re-evaluated once with `Digits` on the other side of 14 (double ↔ MPFR) and compared the same way. If one side has no value (2.3 #5), the other side's digits are shown, at most 15 for a double. Such a value gets `⚠` unless every function in the input is on the audited list (tier 0, 3.3; 2.3 #2). The four `*_icdf` (normald, student, chisquare, fisher) are polished (icdf.ts) and audited when every call converged at P and P + 20. Two-argument `round` and `trunc` compute in a double: unaudited. asin and acos of a complex sin or cos stay unevaluated (patch 0013): `asin(sin(2*i))` = 2·i shows ≈. A definite integral left as `integrate(…)` (no closed form) is Giac's numeric integration, a double at any Digits: read from the typed input with float bounds, `⚠` without a count, at most a double's digits, why "not audited: int".

A number for something that does not exist (a principal value, an Abel sum) is refused by the cheapest needed check (the term's limit, ∫|f| near a singularity); a check Giac's timeout stops leaves `⚠`. An integral that holds a name besides its variable (an inner integral, or a free name) is checked the same way with each enclosing variable at two generic interior points of its interval (never the midpoint: its divergence at either point refuses) and each free name at four values (1.38 and −2.72, then the same two scaled by 1 + |a| + |b| beyond the interval's ends; a value counts as diverging when either of the two points of the enclosing variables diverges), refused only when all four diverge (G771); a nested integral's two-number answer is `⚠`, never a list. Giac's closed form of a series to ∞ whose term is rational in k, or (−1)^k times one, is checked against the series' own terms (partial sums plus an Euler–Maclaurin or Euler tail at two cuts, G618): a closed form they contradict, or an infinity for such a series, is refused.

Cost: one `evalf` more (about 1 ms, desktop) per irrational or float result.

**Golden cases:** each numeric `home.yaml` case carries its mark (`oracle.py`: `=` exactly when the oracle value equals the expected text); `precision.yaml` holds the 20- and 30-digit cases.

**Alternative, MPFI intervals as a second check** (S20, [r22](research/r22-mpfi.md)): sound on real forms of Giac's interval functions (185 of 185), 2 digits fewer at P; raised past the cap they certify what it leaves ⚠; +6.6 kB brotli. Go recommended; owner decides.
**Risk:** both evaluations wrong in the same way is not caught (2.3 #2; section 9 risk 1): hence an unaudited function's float is `⚠` (rules 2 and 3).
**Would change if:** Tab One timing shows the extra `evalf` costing more than 20 % of Enter p95; then the check runs only above 15 digits and for float-returning inputs.

**Built in G3:** stored floats keep their facts and a result using them inherits the weakest; `evalf(e,n)` shows n digits; a value 0 in every evaluation that is not exactly rational shows `⚠` without a count, never `≈ 0` ([archive](archive/04-built-2026-11.md) section 18).

### 2.5 Decision: digits up to 30

- The setting allows 1–30; stored values from before stay valid (6.2 migration).
- Home's working precision is `max(30, digits+10)` (as Solve's) and the value precision P = `max(40, digits+10)`; `DECIMAL_KEEP` (`format.ts`) follows it, so rounding at 30 digits keeps 10 guard digits.
- `sigfig` and our other Giac definitions load on first use, not at engine start.
- Exact budget: `budgetSteps` checks, not ms: a result must not depend on the device's speed.
- The agreement check (2.4) makes 20 and 30 digits honest: without it, 2.3 #3–#5 would go out unmarked.
- **Latency gate (Tab One):** p95 at 30 digits < 150 ms and ≤ 1.3 × the 12-digit p95; it holds.

**`sigfig(x,n)`** (EN3 d): an engine definition that rounds the exact value to `n` significant digits and returns an exact decimal rational, so `sigfig(1/3,3)` is `= 0.333`. The power of ten is found exactly, in BigInt ([archive](archive/04-built-2026-11.md) section 22).

### 2.6 Decision: copy and paste

| What | Full value (Copy › 1; Shift + Select; a hold on a history row's result) | Copy › As shown | Copy › Exact | Copy › LaTeX |
|---|---|---|---|---|
| Home or CAS number | full value: every confirmed digit up to P (40), trailing zeros dropped, `.` (`,` with the decimal-comma setting), plain for 1E-4 ≤ \|x\| < 1E21, else `d.ddd…E±k` | display text, without the mark | Giac's exact text when it exists (`1/3`, `sqrt(2)`) | the result LaTeX; a row with no confirmed digit (⚠ n 0) copies nothing in Full value, As shown and LaTeX (the notice says "No digit confirmed"), Exact and Python unchanged |
| Complex | `a+b*i`, each part as above | yes | yes | yes |
| List, matrix | `{a,b}`, `[[a,b],[c,d]]`, elements as above; with decimal comma `{1,5;2}`, `[[a;b];[c;d]]` | yes | yes | yes |
| Solve root, analysis value | full value | yes | — | — |
| Num table | CSV (Menu, Export): a header of the function names, full values, `,` between them (`;` with decimal comma) | — | — | — |
| Units result (m5) | `20 m/s`, `39.488 ± 1.2 m²`: the value full, then the row's own ` ± σ unit` as drawn (As shown and Share too; R269); Paste reads it back (R325) | yes | `(1397/3125) m/s` | yes |
| Session (Menu, Share) | text: one line per entry, `input = result` with the mark, full values | — | — | — |

**Names as typed** (G784): the stand-ins e_, i_, beta_ … are copied as their letters (`2*i`, `β*2`) in every copy, Share and the CSV; Copy as Python keeps Giac's names.

**Hold on a history row** (R276, docs/05 3.5): on its input, the entry's plain text as Share session writes it (`sqrt(2)+3`); on its result, Copy's text.

**Paste** (Shift + Deselect; any system paste): the clipboard is read as one number (`-1.5`, `1,5` with decimal comma, `1.5e-3` or `E`, `i` parts) or a list as Copy writes it (`{1,16}`, `{1,5;2,25}`; with decimal comma `{1,5}`, 1,5 or 1 and 5, is refused), or a unit row's Copy text as its chip, σ and unit (R325); a number enters as the keyboard's own LaTeX (`1.5\emark-3`, drawn `1.5ᴇ-3`), so the parser sees only what our keys produce. Anything else, or a unit Find lacks, is refused (`clipboard/strings.ts`). A result copied from N62 pastes back as the same value (P5; with decimal comma not a list of one decimal); a copied name does not (G784, decisions.md): the text a Copy, Copy as shown, Copy exact or a hold last wrote from a row with a name (`2*i` from the name i) is kept across a relaunch, cleared by the next copy without one, and refused by Paste as a name, not a number (G784f1), never read as the constant i; a product of names is refused.
**Session line, Copy as Python, mechanics** (G210, G213, G214, G216, G217): `state/sessionLine.ts`, `clipboard/python.ts`; as they stood: [archive](archive/04-built-2026-11.md) section 7.

### 2.7 Decision: SI prefix display, and prefix entry

- **Display:** a format `PFX` beside ENG: as ENG, the exponent replaced by f p n µ m (none) k M G T P (10⁻¹⁵…10¹⁵); `µ` is U+00B5. Outside it, ENG. Built: the prefix is `\class{pfx}{\mathrm{k}}` in the accent colour; ENG keeps trailing zeros, PFX drops them; the rest as it stood: [archive](archive/04-built-2026-11.md) section 15.
- **FIX:** n decimals; a non-zero value falls back to SCI with n decimals (n + 1 significant digits) when every shown decimal would be 0 (G2 item 60: 4.7ᴇ-6 → 4.7000ᴇ-6) or its integer part is longer than its confirmed digits (G795: `exp(100)` in FIX 4 → `≈ 2.6881E43`).
- **Entry:** none in Home: a prefix is entered in the unit view's prefix cells (P11, docs/05 §7.2), and Enter in Home refuses a prefix picked in Find. Letters typed with Alpha stay variables (`4.7k` parses as `4.7*k`), so a variable `k` and the prefix k never collide.

### 2.8 Decision: reuse through chips and Ans

- **Result chip `\res{n}`:** tapping a history result twice (the first tap picks its row, R147), or Up then Enter, inserts it at the cursor: an exact result drawn as a fraction, root, power or matrix goes on the line as its maths, editable, as one term; every other result as a chip drawn as the number shown (R746: `render/exactMaths.ts`, a vector as `\left[…\right]`, which the parser reads as Giac's vector). One term: a × (`\times`, the × key's) goes between it and a number, a closing bracket or a chip before the cursor, or a number, an opening bracket or a chip after it (`entry/oneTerm.ts`), and a leading minus or a top-level sum is bracketed: `2` then −5/6 is `2\times\left(-\frac{5}{6}\right)`, never 2⅚. Each history item stores `full`: Giac's exact text when the result is exact and ≤ 2 kB, else its confirmed decimal. The parser turns the chip into that text (exact rationals for decimals). In Home a result chip that is not exact goes to the engine by name (`pasr_<k>`, Ans as `pasr_ans`) with its confirmed decimal and facts (`chipFacts.ts`), kept with the history entry, and counts as a stored float (M4-7); a value stored from an inexact input keeps `inexact` facts though it prints exactly, and a result from an inexact chip or constant is never an exact chip. Its facts (exact, confirmed digits, warn) travel through Ans, a chip and Store; an exact chip keeps the result exact, so `1/3` (shown `≈ 0.333333333333`) tapped `×3` is `= 1` (2.3 #8).
- **A unit result's chip (`units/chip.ts`):** Home's chip rule on the number in the unit shown, with `unc` and `unit` (label and the units key's slot, read through `input/chipUnit.ts`); a σ chip is an independent input of σ, as a constant.
- **Ans:** `\ans` is the view's last result, inserted by Shift + `+` (the reference's position). Ans is resolved at Enter from the view's last history result (its chip value), not from Giac's `pasans`/`pcasans`, so it survives a Cancel (worker restart) and a relaunch.
- **Operator on an empty line:** `+ − × ÷ xʸ x² x⁻¹` on an empty entry line insert `\ans` first, as the reference does, except in a matrix grid's cell, where it types itself (R300; G2 item 74). `(−)` stays negation.
- A value that leaves its evaluation (stored, Ans, a chip, an export) is the value shown, independent of the angle mode. Its exact text is radian text, the same in every mode, so it stays exact.
- A stored name takes the facts of what its input read, and a run-once result that rests on a decision is ⚠. Names stored and read come from Giac's state and tree; whether an input stores, from its tree (stores.ts): a target, a state or string head, or a stored program that stores; over-reads only.
- A CAS result without a float that read a stored name, or called a function, with facts takes their mark (`warn`, `why.inherited`); one built from exact names stays unmarked.
- The rule that turns a result into an item's `full`, facts and chip is plain TypeScript (`state/results.ts`), so the session and the golden gate run the same code.

### 2.9 Decision: CAS

- A CAS result that is a number with a float gets its mark from our formatter (`≈`, or `⚠` by 2.4), and a symbolic result with a float gets `⚠` (2.4; 2.3 #17); numbers are drawn by our formatter at the digits setting (`CasResult` gains the numeric value when the result is a number, 8.2); its text and LaTeX come from `numeric`, never Giac's float. Exact CAS results get no mark, unless they read stored facts (2.8). An explicit precision (`evalf(x,50)`) is honoured: that many digits, only the confirmed ones.
- **P9:** typed decimals in CAS become exact rationals before evaluation, as in Home (`toExactLiterals`); `approx()` (Shift + Enter) gives decimals. The visible change: `1.5x` shows as `3/2·x`, where the reference CAS keeps `1.5·x`. The `bench` stage of the golden gate runs in CAS mode, so its decimal inputs are re-checked.

### 2.10 Python
Removed with the app (P11, 2026-10-13).

### 2.11 Risks and what would change it
- Marks add a little text to every line. If the owner finds them noisy on a device, `=` could become the absence of a mark, keeping `≈` and `⚠` (one setting, no architecture change).

### 2.12 Decision: the angle mode (S14, route R)
Giac runs with `angle_radian:=1` in every view and mode, and the degree mode lives in the text our parser emits:
- each angle function the user types takes its argument times `pasdeg` (`sin(pasdeg*(u))`);
- each inverse, and `arg`, returns its result over it (`asin(u)/pasdeg`);
- the polar entry's angle carries it, and the ° template is `u*pi/180/pasdeg`; `polar_coordinates` and `instfreq` answer over it and the one-list `rectangular_coordinates([r,t])` takes its angle times it;
- the host sets `pasdeg` to π/180 in DEG and 1 in RAD when the mode changes, and every name that starts with `pas` (`pasdeg` among them) is reserved (G341: the parser and the library reader refuse it, `ourNames.ts` isOurName). The rule is one table, `app/src/engine/angles.ts`, shared by the emitter and `rewriteAngles`.

Every Giac path sees radians; a typed or library function keeps `pasdeg` in its body and follows the mode at call time, and in DEG the CAS view shows results as the mode reads them (`engine/degrees.ts`). The rest: [archive](archive/04-built-2026-11.md) section 6; evidence: [r14](archive/r14-angle-mode.md).

---

## 3. Find (EN1)

### 3.1 State
- Lists open on the sheet (`app/src/views/Sheet.svelte`; docs/05 3.1).
- Any `\operatorname{name}\left(…\right)` reaches Giac as `name(…)`, so inserting a function needs no new parser rule.

### 3.2 Decision: where it runs
**Main thread** (a worker adds a round trip per key). **Gate:** `?bench=find` replays 50 queries one character at a time, timing key → list rendered; p95 ≤ 16 ms on the Tab One (annabell). Only the hits in view are built, keyed by item; a longer query searches the last one's candidates, first keys are searched when idle (rank.ts).

### 3.3 Decision: the index

**Schema:** one JSON array of `FindItem` (`app/src/find/types.ts`; each field's meaning and which kinds and tiers carry it are its doc comments there); ids are stable and become the token IDs; tier 0 is curated, audited and ranked first, tier 1 documented only.

A tier-1 function has no `insert` in the file; `functionInsert` (rank.ts) fills it in at load. A unit whose qalc factor is uncertain or approximate keeps `dim` and has no `si`; where qalc's number is wrong, its row in `find/factors.yaml` takes our value and keeps qalc's in `qalc`, with the reason in `note`; `tools/find-index/refresh-factors.mjs` shows when qalc changes.

Live items (variables, user functions) have the same shape with `kind: "var" | "userfn"`, built at run time (3.4).

**Format and size:** `find-index.<hash>.json`, a Vite asset outside every chunk. Budget ≤ 400 kB raw, ≤ 100 kB gzip (8.3). **i18n:** English titles and descriptions in the index; another language is an overlay file `find-index.<lang>.json` keyed by id with its own titles and aliases, merged at load. The structure allows it now; only English ships.

**Generation, from source at build time** (gorge; `tools/find-index/generate.mjs`, Node, no network; run by `build.sh` after the engines, and by `npm run index` in development; output gitignored under `app/src/find/_gen/`):
Its sources and steps (Giac's English help and libqalculate's XML, `find/factors.yaml` for the values, our own `find/*.yaml` files) are listed in the header of `generate.mjs` and as they stood in [archive](archive/04-built-2026-11.md) section 4; a unit or constant value comes only from `find/factors.yaml` (P22).

**Tier 0** is the audited set: every tier-0 function has a golden case at 12 digits against the oracle, including the edges of its domain (where 2.3 #2 was found), and, for a function defined on complex numbers, complex arguments in RAD (`tools/probes/complex-audit.ts`; the patches behind the branches: engine/giac/patches/README.md, and as they stood in [archive](archive/04-built-2026-11.md) section 8). Complex arguments in DEG are not audited (S14). Tier 1 is everything else Giac documents, ranked below tier 0 and labelled "not checked" in the preview.

**When it loads:** fetched when the browser is idle after the engine is ready, parsed on the first Find open; if Find opens first, it fetches then. Never in the start chunk (size test).

**Licences:** 7.2 (Giac's English lines under P10); the About screen credits Giac and libqalculate.

### 3.4 Live entries
The engine host reports the name each stateful input defines (`defined: {name, kind}`, from `:=` and ▶). The session keeps `userNames` (name, kind, formatted value preview, view, time), read through `Calc.names()` from the persisted defs log (6.2), so Vars works after a relaunch. Find merges them at query time; a library function brings its one-line `desc` (G33).

### 3.5 Ranking
No usage boost (P11), so the same query always gives the same order (docs/03 rule 8); with an empty query Find shows the G2-style Math menu (fixed categories, fixed order). Our own code (`app/src/find/rank.ts`, built in G4). The order, ties and matching: the header of `rank.ts` ([archive](archive/04-built-2026-11.md) section 9). Nothing is stored.

### 3.6 Insertion and tokens
- MathLive macros on the entry field, all `captureSelection: true, expand: false`, so the cursor cannot enter a chip and `getValue()` keeps the macro (`entry/macros.test.ts`, `app/test/chips.spec.ts`): `\const{ID}`, `\res{n}`, `\ans` (unit slots hold R24a's tokens, not macros: 4.3). The chip macros take a second argument that is only what they show: `\res{k}{shown LaTeX}`, `\const{ID}{symbol LaTeX}`; a macro definition cannot look up a value, so the display travels in the LaTeX and the value in the chip table. A Find item's `insert` for a constant is `\const{ID}{symbol}`, ID being the item id without `const:`.
- **Parser:** `\const{ID}` becomes, in Home and CAS, the constant's exact value as a rational literal (`299792458`, `(667430/10^16)`), and the parser reports `inexact` when the constant has an uncertainty, so the result is `≈` (2.4). In the unit view it is a `pask<j>` placeholder; an inexact constant goes to `home()` as `pasc_<id>` with its σ. **Chips carry their own values:** an inserted `\const` chip copies its value, uncertainty, `basis` and `basisLeaves` from the index into the entry's chip table, which each history item stores beside the entry LaTeX; the parser reads the table, never the index, so parsing stays synchronous and a recalled entry needs no index load, and it shows `G`, not 6.6743E-11.
- **In an app's line a constant goes in as its value; the apps keep no chips** (R747; Solve, Function, every app line whose text is stored without chips): a pick from Find or a user key types the value in plain digits, editable, as one term (bracketed with an exponent or a sign: `\left(6.6743\times10^{-11}\right)`; on Num's number line `6.6743\emark-11`), and a note says so once; a `\const`, `\res` or `\ans` that reaches an app line by any path is refused (`entry/appValue.ts`). Home and CAS keep the chip.
- Functions insert `\operatorname{name}\left(#0\right)` (`#0`: a selection becomes the argument); templates insert their LaTeX, each with a parser rule and round-trip case.

### 3.7 Keys inside Find
Every key types its Alpha letter in lower case (no Alpha press); Shift + key types the key's primary character (digits, `.`); the space key types a space; ⌫ deletes; ▲▼ and the trackpad move the selection; Enter inserts; Esc closes. Vars opens the same sheet on the user's variables and functions (no index needed); Shift + Math, Memory, deletes the highlighted name with Enter and clears all with Enter twice. A digit picks the numbered row while the query is empty and types itself after a letter (`g0`, `log10`, `e24`); in Memory a digit only highlights the row (R800), Enter deletes.
**Keystroke budget:** an item used before: Math, first letter, Enter (3 presses); a new one: Math, the letters, Enter. Benchmark task 5 checks it.

### 3.8 The query test
`tests/tasks/find-queries.yaml` (`query`, `expect` id, `note`), run by Vitest against the generated index and the real ranking (`app/src/find/queries.test.ts`). **Gate:** every phrase in the top 3, at least 90 % first. `newton` and `kb` are ambiguous on purpose. The owner adds a phrase whenever Find misses one.

### 3.9 Budgets, risks, would change
Budgets: 8.3. Risks: alias quality (only the query test and real use show it); the chip look (screenshot test). Would change if the Tab One misses 16 ms after R132 (a worker), or the index outgrows 100 kB gzip (split functions and units into two files).

---

## 4. Units: the unit view (EN2, P3 as amended by P8, P11 and P15)

There is no separate Units app (P11): units are added *after* the formula, in unit slots, in the unit view opened by the units key (decisions.md P11, S1). **P15 (4.1):** Giac does the unit arithmetic in the worker that is already loaded, with the Find index's exact factors.

### 4.1 Evidence: units on Giac (G15)
Exact, median 0.5 ms (`tools/probes/units-giac.mjs`): r12 section 2.

### 4.2 Decision: the unit evaluator on the Giac worker (P15)
The unit view's arithmetic is a `units` request in worker 1, beside `home`, so Cancel works as in Home: terminate, respawn and replay the definitions. The factor table (units' `si` and `dim`, prefixes' powers of ten) comes from the Find index. It loads with the unit view, never in the start chunk.

The evaluator (`app/src/units/`):
- substitutes each slot's tokens by factor × dimension symbols and evaluates exactly with `normal()`;
- checks for one term: each exponent d·∂f/∂d / f must be a number;
- converts to the end slot, where the quotient must be a pure number;
- returns a `Quantity` whose mark comes from Home's facts and `markOf()`. An irrational value goes through the agreement check.
- The input is R24a's tokens per slot and the formula with `pasu<n>` per slot and `pask<n>` per constant; the request is built into Giac text on the main thread, so only text reaches the worker. The dimension symbols are positive (√(m²) = m), and the dimension is checked per term before the numbers go in; a result 0 keeps the unit of its terms.

sin, cos and tan take an angle or a pure number; the angle dimension is dropped inside them. Any other function of a quantity with units is refused. On top of this come G17's rules for temperatures and logarithmic units, and G18's and G41's uncertainty (σ² = Σᵢ (∂f/∂xᵢ)² σᵢ² + Σᵢ Σⱼ [½ (∂²f/∂xᵢ∂xⱼ)² + ∂f/∂xᵢ · ∂³f/∂xᵢ∂xⱼ²] σᵢ² σⱼ², GUM 5.1.2 with its note, Giac's `diff` at the inputs' values; σ carries ⚠ "first order does not hold here" when the second-order part is more than 10 % of σ², "the interval reaches a singular point" when an input's x ± 2σ reaches a point where ∂f/∂x is not defined, and "the interval reaches a jump" when it reaches a step function's jump; no Monte Carlo check (GUM Supplement 1)): the formula writes an uncertain number as `pasupm(value,sigma)` (σ a standard uncertainty in the unit of the slot after it, each an independent input); the builder turns each into a symbol (`UnitJob.unc`), and a result with a σ is never `=`. Constants (Home's σ alike, `constBasis.ts`): those whose bases share a leaf (μ₀, ε₀ and Z₀ share α) enter through their basis, each uncertain leaf one input, so σ is taken over the leaves and μ₀·ε₀·c² is exactly 1 ± 0; any other inexact constant is one input with its curated value.

`± n %` is σ = |value|·n/100, a standard uncertainty; a tolerance limit ± a is not σ (its standard uncertainty is a/√3 for a rectangular distribution) and is not typed this way.

A result chip after ± is the σ too (R271): its whole value in the value's unit (a chip with a unit of the same dimension is converted, another dimension is refused), its confirmed digits and its ⚠; a negative or complex chip is refused, and a chip's own σ is dropped (the uncertainty of an uncertainty is not carried). The result's mark is the worse of the value's and σ's, decided once in the evaluator and stored with the result (R271f1, `units/sigmaFacts.ts`; [archive](archive/04-built-2026-11.md) section 17).

### 4.3 Decision: the unit view (entry, parsing, results)
- **Entry (P11, P14; `spec/unit-pad.yaml`):** the units key opens the formula read-only with one slot after every number and an end slot "→ should be" (→ Check, R349); the unit pad is up while it is open; a slot holds unit ids, never text; built on MathLive's prompts, written only with `setPromptValue` (5.5). The key-by-key behaviour as it stood: [archive](archive/04-built-2026-11.md) section 1.
- **Grammar per slot:** a product of factors with `×`, one `÷` (the rest is the denominator), powers, `x⁻¹`, `√`. The formula comes from the parser's units mode: a prompt after a number is pasu<n> in the order written (`×10ⁿ` or `·10ⁿ` with a whole n is part of the number, as an ᴇ mark is: one prompt after the power, R925; a σ right before it is refused), a constant is pask<j>, `±` after a number is pasupm(value,σ), and `\to` before the last prompt is the end slot. A factor is one symbol from Find's unit list: an exact symbol first, then prefix + symbol. The units mode emits unit and prefix ids from these names only (the generator's round-trip check, 3.3). Rejected: qalc's parser (archive).
- **Live reading:** under the formula, for the active slot, in words (an empty end slot says what it does, R352); a prefixed unit outside Find's common list is marked; a factor that is no symbol is an error naming it with the near symbols. A prefix alone is an error.
- **The evaluator checks:** the formula must give a single term (number × units), else "Units don't match: L vs T" naming the term (P11); an absolute temperature in arithmetic → "Use K or Δ°C for a temperature difference"; an end slot of another dimension names both; W, VA and var meet in no conversion or sum (the power factor); a store is refused (G390).
- **Result:** value (exact fraction or P-digit decimal) through our formatter at the digits setting, the mark by the 2.4 rules from the same engine facts as Home, the unit drawn upright, the dimension as `L·T⁻¹`; a stored name read as a number is noted, in its row too. With an end slot: in that unit. Without: in the units typed when they fit the result's dimension (so a torque stays `N·m`, SI would say `J`), else SI with an SI prefix (2.7); %, ‰, ppm, ppb are dimensionless units (G369), dropped beside another unit (5 %·200 m is in m; after ± `%` is R104's σ); the alternatives (`units/alternatives.ts`, r17 0.2's order: coherent SI, SI with its prefix, the last unit tapped, the cells' units, the typed units) are end slots, and a tap sets one and runs the job (the store `units.targets`: [archive](archive/04-built-2026-11.md) section 20).
- **Temperature:** `°C` and `°F` alone carry their offset; inside a compound unit they are an interval (`J/(kg·°C)`, `°C⁻¹`; 1 °C = 1 K, 1 °F = 5/9 K). Alone they are absolute (`20 °C → °F` = 68, `derived`); T1 − T2 of one absolute scale is K, of two refused (G370); other differences are `K`, `°R`, or the Find aliases `Δ°C` (of K) and `Δ°F` (of °R).
- **Logarithmic units, angles, currency:** `rad` stays in the dimension key and an angle is a quantity both ways: sin, cos and tan take an angle (a bare number in the mode's unit), asin, acos, atan and atan2 give one (in rad, shown without an end slot in the mode's unit). An end slot one rad apart from the result converts with the note "rad = 1 dropped" unless rpm, rev or Hz is on either side (G32's refusal stays); rpm or rev times a dimension other than time keeps its value with the note "rpm counts turns: the speed at radius r is 2π·r·n". dB, bel, Np, dBm and dBW convert by decisions.md G17 (the message is `dB converts only`); currencies are off, with the index test. The narrative as it stood: [archive](archive/04-built-2026-11.md) section 2.
- **The way back (`units/row.ts`):** each result of a unit view visit is one saved Home history row (a later result replaces it), with Home's number and mark, the line with chips and filled slots, and the Quantity summary (unit, dimension, σ, note) with R61's chip; a chip puts the result back on the line with its σ (Ans is that chip), a row with no chip puts Home's number alone. Home does not read the unit: a row computed from the chip, or from a name stored from it (directly or through a function, `HomeResult.unitNames`), says "unit dropped: Home has no units"; a chip in one ratio unit (%, ‰, ppm, ppb) enters Home and CAS as its pure number (G782), with no such line; in the unit view its slot starts with that unit, so its factor is kept and G369 drops it beside another unit (0.42 % × 200 m = 0.84 m), and Store ▶ on it stores the pure number with its σ, while a rev chip's slot still starts empty (G782f1). A name stored from the row, or by Store ▶ in the view, keeps unit and σ (6.2); with no result or a chip lacking them Store ▶ is dead with its reason: Home reads σ, the unit view a number (R315). The drawing and Copy as shown, as they stood: [archive](archive/04-built-2026-11.md) section 3.

### 4.4 Budgets and gates
No engine chunk: the unit view's UI and builder chunks (8.3) and its factor table from the Find index load on the units key's first press, never at start; a Playwright test asserts that a session without it requests neither. First result < 1 s on the Tab One; desktop p95 ≤ 5 ms per evaluation. Also: `units.yaml` in the golden gate; **a unit in ≤ 4 presses at the median** (`tools/probes/unit-presses.mjs`, then the same list as an e2e replay); benchmark tasks 1–4 and 10 within budget (decisions.md "M4-2"); the owner's hand timing (rule 2).

### 4.5 Risks, would change
Risks: a wrong factor that G13's audit against CODATA and the exact definitions missed; a long CAS job delays a conversion until Cancel. Would change if the owner, after using the unit view, wants `5 km + 300 m` in Home (P8: the same worker behind a setting; the token design already supports it).

---

## 5. Keyboard and entry

### 5.1 Decision: every cell P8 touches, and every free cell
Positions use our rows and columns (`spec/keyboard.yaml`); the reference's id is in brackets (`spec/mapping/vc-2026-10-11/keys.yaml`). "Built" names the package; the rest is planned. Rows 0–2 are R3 (decisions.md "R15c", built in R15c2).

| Key | Decided | Source and why |
|---|---|---|
| Math (row 3, col 1) [r4c2] | Find, everything (R4a) | P8 |
| Shift + Math | Memory: Find on variables and user functions, with delete and "clear all" | reference: Mem |
| Vars (row 3, col 0) [r4c1] | Find, filtered to variables; Shift = Chars (R725; Paste there from R329 until R723) | P8 |
| Tmpl (row 3, col 2) [r4c3] | the 6 × 3 template palette, picked by arrows, Enter or a tap (r8 rule M1) | P8, P11 |
| Shift + Tmpl | the unit view (unit slots) | P11; reference: Units |
| The letters A–Z, `#`, `:`, `;` (Alpha layer, flick down) | **stay**: Find's keyboard (3.7), names, CAS symbols, hex digits A–F (5.4); not the unit slots (P14) | decisions.md "The letters stay" |
| Shift key [r9c1], Alpha key [r8c1] | one tap arms for one key, a second locks, a third ends it (Shift's second tap too since R726; with Alpha on, Shift stays one-shot), plus the lock flicks; a tap on the bar's ⇧/α sign ends either; each stays its own key (P7 point 4, owner 2026-10-19; reopens if Alpha taps fall near zero) | P7 |
| a b/c (row 3, col 4) [r4c5] | toggles the last result's form: decimal ↔ fraction, polar ↔ rectangular | G2 item 29, P12 |
| Exponent key (row 6, col 0) [r7c1] | types the mark `ᴇ` (`\emark`, one token); Shift = Sto ▶ | P12 |
| Rows 0–2 | R3 (the pairs R146; R723): U1–U6 in columns 0–1; the round pad (one drag surface, a circle with no drawn hub, no OK) in columns 2–3; Help \| Esc, Undo \| Redo, Select \| Deselect in columns 4–5, with Settings \| Clear, ⇤ \| ⇥, Copy \| Paste on Shift. Apps, Home, CAS, ☰, Mode and the views: the bar on the keypad (R15c1, R722); results mode: the swipe on the entry line or ⌄ at the bar's left end (R786), and the folded bar (R53, R724). The cells at the tag: docs/06 3b | P12, S2, R15c, R146, R723 |
| Shift + 6, Shift + 9 | the G2's palettes: relations and logic; symbols and Greek with `!` and ∞ | P12 |
| Help (row 0, col 4, id `help`) [the G2's Help on this cell] | the syntax and example of the function at the cursor, else Find (R197; Insert replaces the call, R324); Shift = Settings (R146). The ☰ key (id `menu`, R278) retired with R723: ☰ is on the bar | R197, R723; docs/06 3b |
| Esc (row 0, col 5), Undo \| Redo (row 1, cols 4–5) | Esc stops a running job, closes Settings, goes back one sheet level, drops a picked row, else clears the line (also the hardware Escape); Undo and Redo are dead without an entry line; Shift cells: docs/06 3b; [archive](archive/04-built-2026-11.md) section 5 | R15c, R15c2, R146 |
| Select \| Deselect (row 2, cols 4–5, ids `select`, `deselect`) | Select grows the entry line's selection by the box model, Deselect walks it back; Shift + Select = Copy (the line's selection, else what a hold on the picked row's result copies, else the last finished row's; a dead press with none or in an app with nothing selected); Shift + Deselect = Paste (Paste's own path, `paste.ts`). Copy is also the bar's Copy › and a hold on a row's input or result; Paste is any system paste | R279, R723, R727 |
| ☰ on the bar (the G2's Menu key [r3c4]) | app menus; Home/CAS: one numbered list of four (Delete, Share, Clear, Export ›; R830) on the picked row, else the last result (decisions.md S2); Store ▶ and Copy › on the picked row's bar | P8, S2, S9 |
| User keys | U1–U6, all empty, with tap, Shift and Alpha (an empty Alpha slot is the tap; stored slots of U1–U3 and two-layer records stay valid); set in Settings › Your keys from Find, a place or a sheet; a tap on an empty slot (the tap or Shift; Alpha + an empty key is the tap) opens Settings › Your keys on that slot's row, no dead press | R15b, R15c, R705 |
| Shift + `+` [r10c5] | Ans (`\ans`, built, R2) | reference |
| Shift + `−` [r9c5] | the Base menu (5.4) | reference: Base |
| Shift + 5 [r8c3]; Shift + 8 [r7c3] | `[ ]` vector or matrix template (EN5); `{ }` list | reference |
| Shift + 4 [r8c2]; Shift + 7 [r7c2] | the matrix sheet (built, R187–R190: functions 1–8, New 9, stored matrices, grid); the list editor, deferred with Statistics | reference: Matrix, List |
| Unit slots | the unit pad (`spec/unit-pad.yaml`, docs/archive/r9-unit-pad.md): prefix and unit cells over the maths rows, S5's arrangement, 18 user slots; Enter to the next slot, `→` the end slot. | P11, S1, P14 |
| Fmt (row 9, col 0) | a tap cycles the format of the picked row, else the newest finished one (R775; an error or running pick: a dead press); a step that would draw what the row shows is skipped; when none changes it, the press is dead; a b/c on an empty line takes the same row, and a b/c with no other form is a dead press likewise (G785); Shift is reserved (R322; Mode has no key since R723: the bar's STD and 12 chips) | ours; decisions.md "Settings in the Mode sheet, and presets" |
| Shift + `( )` [r6c3]; Shift + 0 [r10c2] | ∥: Find's par() with the cursor inside (task t01); after a value it takes the value in, par(value, □) (R585); % (`\%`, the Shift + 9 palette's cell) | owner, 2026-11-14; docs/06 3b |
| Unassigned Shift cells (a b/c, 7, Fmt; `,` is ± (R71), 1 the σ sheet (R327); the pad: none, P12 point 8) | they get the functions the task benchmark shows are pressed most, not a list made in advance | decisions.md "The letters stay" |


### 5.2 Decision: how key presses are counted (EN0)
Every press counts 1: a key (Shift, Alpha and Enter too), each letter typed in Find, a held ⌫ (once), a trackpad drag, a flick (lock flicks too), a screen tap (history row, Find result, chip, menu item). Nothing is free. Each press also counts per key and layer (R127; names and export: `app/src/state/taps.svelte.ts`). A task stores its sequence as data (`keys:` key ids, `up:`/`down:` flicks, `tap:` targets); the harness replays it and counts.

### 5.3 Decision: matrices and lists (EN5)
- **Entry:** Shift + 5 inserts a 1×1 `pmatrix`, grown by ▶ at the end of the last column and ▼ in the last row (a 3×3 needs only digits, ▶ and ▼) and shrunk by ⌫ in an empty last row or column; Shift + 8 inserts `\{□\}`, a Giac list of comma-separated elements, refused when empty; [archive](archive/04-built-2026-11.md) section 19.
- **Parser:** `pmatrix`, `bmatrix`, `matrix` are read (`parse.ts`); new round-trip cases for grown matrices and for chips inside cells.
- **Stored matrices** are Giac variables (▶ to store); the matrix editor (Shift + 4) writes one back with `name:=[[…]]`, which the definitions log persists (6.2).
- **Display in Home:** every element through our formatter, one mark for the whole (2.4).

### 5.4 Decision: number bases (EN6)
- **A base is a display mode of an integer result** (R192), like the Format key's modes, not a property of the value. Shift + `−` opens the Base menu (HEX, BIN, OCT, DEC for the last result, R193). Word size (8 to 64 bits) and signed are settings (R194, key `word`). Drawn whole, unpadded (`0xA`), marked as a fraction (`=` if exact); a non-integer or a value outside the word (negative, if unsigned) keeps its notation.
- **Entry:** `0x…`, `0b…`, `0o…`, the prefix in either case (R304), are one whole number (R191), written in decimal; hex digits A–F (either case) are the Alpha letters, the run greedy (`0xFFx` is 255·x); a digit outside the base, a point, an ᴇ, spacing inside it (R191f1) or a prefix at the end is refused; `0x+1` stays 0·x+1.
- **Bitwise:** `bitand`, `bitor`, `bitxor` work, on big and negative integers too (two's complement, unbounded; patch 0062, G551); shifts and rotations are EN7 definitions in the word size.

### 5.5 Decision: the entry line, one key path and one box model

**Decision:** one key path: every key goes through `press()`. One owner per key press (`keyboard/route.ts`: an open sheet, Find, a unit slot, a picked history row or the entry line); the unit view's slots change only through R24a's model via press() (UnitPad.route, unitPad.other). One box model, `entry/boxes.ts`, checked by the cursor and ⌫ grids before any MathLive upgrade merges; a new template brings its parser rule, round trip and, for a new LaTeX shape, a recogniser. **Would change if:** a MathLive upgrade breaks the recognisers twice (then a registry).

**The layer contract (owner, 2026-11-23; R916):** a layer over Home (a sheet, the unit view, a name prompt) owns four channels while it is up: keys, taps on the screen, what follows the focus (hardware keys, paste, typing, cut) and back. Taps, focus, paste and back join the key path's owner: on each channel the layer refuses by default (the dead press) and lets through only a short list written in the layer's own code. The line under a layer is lent: it comes back as it was taken. The net is `app/test/layers.spec.ts`: it fires every channel at the unit view (on a typed line and on a picked row) and holds today's leaks in its known list, each with its F id and the package that removes it.

**The term under a hold (R277):** what R17, L8 and L9 take as one (`entry/term.ts`): a number with its ᴇ part, a chip, a fraction, a root, a bracket group (with a function's name) or a letter, each with its power; never an operator, relation or separator. A number is `entry/numberRun.ts`'s, the rule of selectENumber, selectCompound and delete.ts (ᴇ part digits only), so a hold selects what x² raises. Touch is `entry/lineTouch.ts`: a capture `pointerdown` on the host ends every touch before MathLive; tap and hold use public calls; the drag scrolls through `field.ts` `scrollLine`, our one shadow-DOM write (decisions.md "R277's line scroll").

**Select and Deselect (R279):** `selectGrow` takes the term before the cursor (term.ts; else the one after it), then each enclosing operand, tightest first (implicit product, × ÷ ·, + −, relation, AND OR XOR, separator; a sign first), then the box, then the template or bracket owning it, up to the whole line (`entry/grow.ts`, pure over offsets). `selectShrink` walks the chain back to the cursor before the first Select; any other key or a tap ends it. Entry line only.

**The polar sign (R180, F192):** ∡ binds tighter than + × ÷ and looser than a power. Left: one factor (`3+4∡30` is `3+(4∡30)`). Right: one signed factor (a power or a `\frac` counts). `10∡30*2` is `(10∡30)*2`. In a flat line a bare `/` right after the angle or right before the radius is refused with "put the angle in brackets" (Giac reads `2∡π/6` as `(2∡π)/6` = -1/3); a factor written directly after the angle (`10∡2π`, `10∡2x`) is refused the same way (else `(10∡2)·π`). A stacked `\frac` stays fine (`2∡\frac{π}{6}`). The G2 makes `10∡30+5` `10∡(30+5)`; N62 differs on purpose so that `10∡30+5∡-45` adds two phasors (owner).

**A number right after °, ′, ″, %, ‰ (R725: /1000) or ! is refused (R376; be-7; owner, 2026-11-16):** `input/parse.ts` `markThen` throws when a number follows the mark (`30°15`, `1°2′3`, `30°15′36″2`, `2%3`, `5!3`), and the message names the mark it lacks (`parse.numberAfterDegree`: ′ for minutes; `parse.numberAfterPrime`: ″ for seconds; `parse.numberAfterMark`: × for a product), as `parse.oneExponent` does for ᴇ. Minutes and seconds are read only with their marks (the DMS rows). The reason: a product the line shows no × for is a silent wrong answer (principle 3; `30°15` was 450 in DEG), and the G2 reads `30°15` as 30°15′ (G2 checklist row 76). A letter or a bracket after a mark (`5!x`, `30°(1+2)`) stays a product, as Giac reads it; open with the owner (decisions.md "R376, a name after a mark").

---

## 6. Engine, workers and state

### 6.1 Topology and contracts
- **State:** the main thread runs the UI, keyboard, parser and formatter; worker 1 is Giac (started at launch, D2), cancelled by terminate and respawn with the definitions replayed.
- **Decision:** no further worker: the unit view computes on worker 1 (P15) and Find needs none (3.2).
- **Decision (P18): Giac evaluates, our own layer decides** what is shown: the agreement check, decisions at a higher precision, refusals, marks and the facts of stored values (2.4, 2.8). No other engine answers at run time: libqalculate feeds the Find index's data, mpmath and Giac's own parse check at test time. Typed input reaches Giac only through our parser; every other way in (a library, the definitions log, a chip's full value, a backup) is Giac text. Its rules: Giac's flags restored after every input; a fix at the cause, a Giac patch where the cause is local there (P19); a register of our workarounds with canaries.
- **Decision (P20): Giac's tree, not its text.** Besides `giac_eval`, `api.cc` exports a structured bridge (`bridge.ts`), no Giac patch. Names, stores, settings and kinds come from it; only Giac's print is read as text, in one module; new code adds no bracket loop or name regex. Guard that stays: the poly1 check (`polyvec.ts`, one eval for subtype 10); the bridge's kinds (api.cc `kindOf`) have no polynomial, so it moves only when one is added.

### 6.2 Decision: one storage plan
One IndexedDB database `n62`, store `kv` (`state/storage.ts`). Keys:

| Key | Holds |
|---|---|
| `settings` | `schema: 5`: digits ≤ 30, format (`std`, `sci`, `eng`, `pfx`), fixDecimals, fmtCycle (with Fixed), entry, decimalMark (missing or invalid: the point), haptics, look, angle, uncertainty, marks, groupSep, barSlot (`cas` or an app id of the registry; an unknown id: CAS; R782); each field checked (`migrateSettings`, `state/session.svelte.ts`). A newer schema is read, never written back; each schema bump raises `DATA_VERSION` (`SETTINGS_SINCE`, `state/storage.ts`) |
| `view`, `place`, `entry` | the open view and app; the half-typed line |
| `history` | ≤ 200 items per view, with `full` (≤ 2 kB) and the mark facts |
| `defs` | the definitions log (`engine/defs.ts`; `:=`, ▶, `purge`): per name its kind, commands, mark facts, σ, unit, preview, view, time; ≤ 500 lines. **Variables are kept as their value** (`B:=romberg(…)` is stored as `B:=(evalf(<exact>,k))`); functions and `assume` keep their command. `restore()` replays them (`engine/host.ts`, `stores.ts`): functions pending until used (G83), names stored through an argument, Giac's own names, `restart` (G174) |
| `defsStarts` | starts that ran the replay and never got ready (a load failure is not counted, G327); at 2 the engine starts without the log |
| `tipsSeen` | tips shown |
| `historyDropNoted` | the note "older rows are dropped after 200" was said (per install, not backed up) |
| `userKeys`, `unitPadCells`, `taps`, `app.function`, `app.solve` | the user keys, the unit pad cells; the counters (Shift/Alpha, presses, preset applies); per app (`uses` counters) |
| `presets` | `state/presetRecord.ts`: `{ presets: [{ id, name, groups }], active, next }`; groups `mode`, `numbers`, `look`, `vibration`, `keys` (both key records, migrated too); AI format: `views/aiFormat.md` part 2 |
| `units.targets`, `units.own` | the last target per dimension; your units (`units/ownRecord.ts`, as strict at a restore as at the start; ids `@name`, G233) |
| `word` | `{ bits, signed }` (R194) |
| `rpn` | `{ levels: [{ uid, chip, shown, inputs }] }`, level 1 first (R252, `entry/rpnStore.ts`) |
| `uses`, `bar-uses` | the results mode's counts (R53, `state/uses.svelte.ts`) and the bar's angle-chip taps (R722), each with its own since, for decisions.md's removal tests; not backed up |
| `backup.last`, `backup.offered`, `backup.undo`, `sync.queue`, `sync` | not backed up |

**Every value is stamped** with `DATA_VERSION` (`storage.ts`): `{ "@n62": n, value }` (`@pascaline` before R138, read as `@n62`); a value without the stamp is version 0. On read, the key's `MIGRATIONS` steps (`state/migrations.ts`, loaded on demand) run from its version up and the value is written back. A save never overwrites a newer version's record, and each step is safe twice. A failed read is not "nothing stored": the caller keeps its defaults and that key is not written for the session. One writer per browser profile: the tab holding the Web Lock `n62-writer` writes the store; other tabs compute and write nothing, with a note and Use here; without `navigator.locks` every tab writes. Raise the version with a step when a stored shape or the meaning of stored Giac text changes (Φ → `Phi_`). **Replay budget:** 8.3 (`replayMs`, inside the engine-ready bar).

**The backup**: one JSON file of each record as stored, stamped; a restore checks the whole file and refuses at the first fault, then replaces the ticked keys in one transaction and keeps the old ones in `backup.undo` for Undo (the checks as they stood: [archive](archive/04-built-2026-11.md) section 21).

**The library file** writes a body's == or ≠ test as typed (`x!=1/3`); the import rebuilds a body's `A==B`, `A!=B`, `A<>B` into the parser's block. A program, a piecewise condition and a `// test:` line keep Giac's `==` (G377).

### 6.3 Decision: start-up and bytes
- The sizes and budgets are in 8.3. New code for Find, units, copy and the matrix editor lives in lazy chunks, and so do every Settings page, sheet and the first-start tips: the start chunk takes only what draws the first screen, key handlers and marks (the budget: 8.3). `virtual:about` (`vite-plugin-about.ts`): the version, THIRD_PARTY.md's parts and the texts of LICENSES/, 36 kB gzip, loaded when Settings › Help and about › About or Parts is first drawn.
- **The size test**: `app/scripts/size-check.ts` reads Vite's manifest and fails when a chunk passes its budget; `npm run build` and `build.sh` run it.


---

## 7. Build, licences, F-Droid, tests

### 7.1 Decision: build order
`build.sh`: fetch (SHA-256 checked) → Giac (container, P2) → **Find index generator** (Node: Giac's help and libqalculate's XML from their pinned tarballs, the numbers from the checked-in `find/factors.yaml`; no libqalculate build, P22, A21; 3.3) → app build (size test) → Capacitor → Gradle. `--no-units`: an index of functions only. Everything generated stays out of git; F-Droid's recipe mirrors `build.sh` and keeps its libxml2 and libqalculate builds (decisions.md P22). A developer refreshes the numbers from a qalc build (`engine/qalc/build-wasm.sh [dev|release]`, then `tools/find-index/refresh-factors.mjs`); the qalc wasm never ships (P15). **The Giac pin (P21):** Parisse's numbered Debian archive `giac_<version>-<n>.tar.gz`, its SHA-256 from the `.dsc`, his folder, then our mirror (G77).

### 7.2 Licences
Every piece and its licence is in [THIRD_PARTY.md](../THIRD_PARTY.md); all are compatible with GPL-3.0. libqalculate is build time only (P15: its data ships in the Find index, its code not); Giac's English `aide_cas` lines are GPL-3.0-or-later (R5); Find's search is our own code.

### 7.3 Decision: tests and gates

| Gate | What | Blocks |
|---|---|---|
| typecheck, Vitest, e2e | as today | every merge |
| Parser round trips | every new template, chip and token, in the same commit | every merge |
| Golden gate | the stages of `app/scripts/golden.ts` (interrupt, steps, flags, home with marks, precision, solve, function, bench, calls, invariants, units, parser; `tests/golden/README.md`) | every merge that touches engine-side code; every engine build that ships |
| Core list (P23) | `tests/core/core.yaml`: everyday key sequences, value and mark, in e2e and on the night's device (P23) | every merge; nightly on that device |
| Task benchmark | `tests/tasks/tasks.yaml`, active tasks within budget | every merge from milestone 4 on |
| Find query test | `tests/tasks/find-queries.yaml`: all in the top 3, ≥ 90 % first | every merge that touches the index, aliases or ranking |
| Size test | budgets in 8.3 | every build |
| No-lazy-load test | Home, CAS, Function and Solve never request `qalc.*`; the Find index is not requested before the engine is ready and the browser idle | every merge (from the milestone that adds each) |
| Device bars (Tab One) | start, Enter p95 at 12 and 30 digits, Find per key, Units first result, memory | each milestone and release (annabell) |
| Reproducibility | two release builds give the same `giac.wasm` | each release |

The gates per milestone are the backlog's milestone lines.

**What the gates serve: the mark never lies** ([R16](archive/r16-verification.md)). No test proves Giac right, so principle 3 is tested as one property that needs no hand-written expected value: every digit under `=` or `≈` is right, `⚠ n` has n right digits, a number appears only where a value exists, an answer or a refusal comes within the budget. Six checks give each result a second source (the note's section 3). The generators stay in the gate (fixed seed); the full pass repeats at each milestone close, before each outside round and before a release.

---

## 8. Components, interfaces, budgets

### 8.1 Component diagram
The parts and their ports are 8.2's map; the diagram of milestone 5 as it stood: [archive/architecture-2026-11-17.md](archive/architecture-2026-11-17.md) section 1.

Web build: the service worker precaches the whole build; the engine files carry their content hash and the install checks it; a new version waits for the update line's Restart (the only reload); more: [archive](archive/04-built-2026-11.md) section 16.

### 8.2 Interfaces (every async interface)
The types live in the code; this is the map. Views see `Calc` (`app/src/calc/port.ts`), which wraps `MathEngine` (`app/src/engine/types.ts`), which talks to worker 1.
- **`MathEngine`:** `ready`, `home(input, s, consts?)`, `cas`, `solve`, `unknowns`, `analyze`, `table`, `eval` (tools and benchmarks only), `definitions()` (the defs log, 6.2), `defsWritten?()`, `units(job, s)`, `cancel`, `dispose`. The worker's home, cas and eval replies carry `defs: DefChange[]`; `{type: "define", defs}` → `{type: "defined", replayMs}`.
- **`HomeResult`** (`engine/homeEval.ts`) carries the display, the timings and the facts for the mark: `facts` (`ValueFacts`, `engine/types.ts`), `full` (the copy and chip value), `defined`, `items` and `shape`, `digits`; `facts.why` (`PrecisionWhy`) says why a value is `⚠`, and its `pastCap` marks a literal past `MAX_EVAL_DIGITS` (G182; the field list: [archive](archive/04-built-2026-11.md) section 23).
- **`CasResult`:** `numeric` when the result is a number; `approximate`, `warn` and `why` for a non-number; `uses` (the stored variables the input read, not the names it binds).
- **`Calc`:** the same calls with `CalcSettings`, plus `names()` (the user's names, 3.4), `importLibrary`, `exportLibrary` and `units(req, s)` (a lazy chunk; the factor table loads on the first call).
- **Units** (`app/src/units/types.ts`, the fields there): `UnitRequest` → `UnitJob` (built by `units/build.ts`) → `Quantity` or `UnitError` (its kinds and `unitErrorMessage()` in `units/messages.ts`).
- **Find** (main thread): `FindItem` (`app/src/find/types.ts`, the schema of 3.3); `loadIndex()` (`find/finder.ts`) and a synchronous `search(index, query, ctx)` (`find/rank.ts`) within 16 ms.
- **`Kv`** (`state/storage.ts`): `get`, `set`. **`ClipboardPort`** (`app/src/clipboard/port.ts`): `writeText`, `readText`, `share` (false when the platform cannot share; then copy); the Capacitor plugins sit behind it.

### 8.3 Budgets

| Item | Budget | State | Enforced by |
|---|---|---|---|
| Start chunk | ≤ 180 kB raw, ≤ 63 kB gzip, gzip measured with hashed names held fixed (A272); pin `START_PIN_GZIP` | each raise with both sizes: size-check.ts. A package past it raises it to its size after merging phase-1 plus 0.05 kB; no start file holds a `LAZY_PARTS` module (chunk-modules.json; one inside another lazy chunk passes). `tools/probes/start-chunk.mjs` lists bytes per source | size test (`npm run size`) |
| Inline scripts of `index.html` (run before the first paint, outside the start chunk) | pin 1.53 kB gzip (`INLINE_PIN_GZIP`; per script, summed) | 1.53 kB | size test |
| MathLive chunk (after the keypad) | ≤ 830 kB raw | 807.74 kB | size test |
| Find UI chunk | ≤ 30 kB raw | 8.04 kB raw: the chunk that holds `src/find/finder.ts` (dynamic entry or shared chunk); a build without it fails | size test |
| Find index asset | ≤ 400 kB raw, ≤ 100 kB gzip | 325.7 / 67.1 kB | size test |
| Unit view chunks | ≤ 42.6 kB raw (entries); pin 81.79 kB with shared | 42.54; 81.73 kB | size test |
| Precache total | ≤ 18 MB | 12.4 MB | size test |
| Keyboard usable / engine ready (Tab One) | < 1 s / < 1.5 s, with the `defs` replay | Home 790 / 1330 ms, CAS last 795 / 1507 ms (A73f2); with 200 definitions 1489 ms | device runs |
| Enter → result p95 (Tab One) | < 150 ms at 12 digits; at 30 digits ≤ 1.3 × the 12-digit p95 | RAD 147.9 ms at 12, 152.6 at 30 | device runs |
| Find key → list (Tab One) | p95 ≤ 16 ms | 14.1 ms | `?bench=find` (A4b) |
| Find open | ≤ 100 ms warm, ≤ 300 ms cold | max of 50: 244 ms | device runs |
| Units first result (Tab One) | < 1 s | — | device runs |
| Unit evaluation (desktop) | p95 ≤ 5 ms | median 0.91 ms, p95 ≈ 2 ms | the golden units section |
| `defs` replay | ≤ 50 ms at 200 definitions | a 200-program library 96 ms p50 | device runs |
| Key presses | each task within its budget; a unit ≤ 4 at the median | — | task benchmark |
| Find quality | 100 % top 3, ≥ 90 % first | 100/100 first at G4 | query test |

"Start chunk" is the entry's JavaScript plus every chunk it imports statically, as `size-check.ts` measures it. The start graph is one chunk; a Rolldown $initial chunk group keeps it so (archive/r21-chunks.md). Its CSS is not counted (own line past 40 kB).


---

## 9. Top risks to the goal

1. **Correlated numeric errors in Giac** (2.3 #2): the agreement check catches most wrong digits, not all. Mitigation: tier-0 audit with domain-edge golden cases, upstream reports, `⚠` rather than silence.
2. **Find quality** depends on aliases and real queries, not code. Mitigation: the query gate and the owner adding misses.
3. **A wrong unit factor or a missed unit check** (misread names, mismatched sums, offset-unit arithmetic). Mitigation: chips only, the generator's round-trip check, the evaluator's single-term and temperature checks (P15), `units.yaml`.
4. **Tab One budgets** for the unit view's first result are desktop estimates until measured (Appendix C).
5. **Pace on parser- and keyboard-heavy work** (03 risk 5). Mitigation: each token lands with its round-trip case.
6. **The entry's rules drift apart** (5.5). Mitigation: one model in `entry/boxes.ts`, the cursor and ⌫ grids, one key path.

---

## Appendix A: probes
The probes are in `tools/probes/` (its README says how to run each); what they found is in [research/r12-evidence.md](research/r12-evidence.md), and oracle values come from mpmath in `tests/golden/.venv`.

## Appendix C: open items (to verify), who, how

| Item | Who | How | Decides |
|---|---|---|---|
| Units first result on the Tab One | annabell (m5) | device run of the unit view | the lazy-load bar (4.4) |

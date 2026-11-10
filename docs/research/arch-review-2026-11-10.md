<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# The architecture review of 2026-11-10

**Status (2026-11-10): open.** This note holds the findings, the owner's answers and the boundary design for the checking layer. The packages are being placed. Once they all exist, this note is deleted, unless code or a live doc cites it as its spec (rules section 10).

*Written 2026-11-10 by Claude (Opus, the coordinator), from an outside review by Claude Fable 5.2. The review was read-only, on `phase-1` `5d91e0c4`, in three passes: the review, the second pass and a hunt for wrong answers. A check of the before-tag packages by sofia followed.* The evidence is the two reports (about 8,000 words, with `file:line`, counts and probe output) and the package drafts. They are in `.tasks/arch-review-2026-11-10/` in the main checkout (`REPORT.md`, `REPORT-2.md`, `HUNT.md`, `SOFIA-CHECK.md`, `packages/`).

## 1. The verdict

The architecture is sound, and no structural choice has to be undone. These parts are solid and should not be changed carelessly:
- the worker boundary and its restart and replay path;
- one shape for trust (`ValueFacts`) and one function for the mark (`markOf`);
- exact-first evaluation with our own formatter;
- oracle-based expected values and the sweeps;
- storage (migrations on read, one writing tab, the update test);
- a parser that accepts only what the keys type;
- the ratchets, the reproducible release build, the lazy chunks with their budget, Find as a static index, the core list, the app registry, and no network.

## 2. The findings

**Major:**
- **M1. The checking layer has no boundary.** `engine/` grew from 3,649 lines (10-17) to 11,555 (11-10). It had about 60 `fix` commits a week, and the rate is not falling. Of 154 fixes in `homeEval.ts`, `numeric.ts`, `host.ts` and `units/evaluate.ts`:
  - new rules fell week by week (6, 3, 0, 1), so the rule set is nearly complete;
  - "a rule was wrong" plus "two rules clash" stayed at about 49%.
  
  The causes:
  - Home runs about 13 checks in one order (`homeEval.ts:626-782`), CAS twelve of them in another order (`host.ts:983-1057`), and the unit view none.
  - Trust is lowered by five mechanisms in Home.
  - Facts literals are built in about 45 places in 17 files.
  - Five carriers copy facts field by field and drop fields.
  - The mark is worked out again in six places on the main thread.
- **M2. iOS and desktop are this web app, and every test runs Chromium.** The site is announced for every browser.
- **M3. Entry editing depends on MathLive's undocumented cursor numbering**, pinned to one version.
- **M4. Only the engine import rule is enforced;** the rest of the module graph has no declared order.

**New in the second pass:**
- **N1. The unit view shows numbers that Home refuses.** `(1/(1/0))*{m}` gives `= 0 m`.
- **N2. An engine that cannot start is restarted without limit.** 96 workers in half a second, and the screen stays on "Starting the engine…".
- **N3. The F-Droid recipe builds the engine without `setarch -R`**, so its build will probably not match the release bit for bit.
- **N4. 14 bare unit ids are US units** (`gal`, `fl_oz`, `cwt`, `mpg` and others).
- **N5. CAS shows `0` for `1/(1/0)`**, which Home refuses.

**Blind spots:**
- **B1.** What is drawn: `render/tidy.ts` rewrites Giac's LaTeX with no check on its meaning.
- **B2.** 403 of 439 unit factors rest on libqalculate alone.
- **B3.** JavaScript number formatting at the display edge (plot axes, solver lines), a rule kept in prose only.
- **B4.** A backup's definitions and chip values are replayed as Giac text without the library's check.
- **B5.** Screen readers hear LaTeX, and zoom is off.
- **B6.** The 1 GB heap on a small phone, with no `onRenderProcessGone`.
- **B7.** Every gate runs on one machine, and pull requests get no checks.

**Patterns:**
- rules kept in prose with no gate behind them;
- the decimal comma rewritten after formatting;
- 3,830 package ids in code comments;
- the shared docs at their byte budgets;
- one engine method per app;
- the sweeps never run on the release compiler.

## 3. The owner's answers (2026-11-10)

Decided. decisions.md has one line pointing here.
1. **`≈` holds within a stated range of inputs.** Outside the range, a result that is not exact is `⚠` by rule, with the reason "outside the checked range". Nothing is refused, and an exact rational keeps `=`. The range is one set of limits in one module, and the help text reads its numbers from there. The limits are the smallest box a weekly false-mark rate measures with no false mark, rounded down, and never below this floor: literals of 30 digits, powers of ten to 10^±30, nesting depth 4, and 200 nodes. If the measured box is narrower than the floor, the package stops and asks the owner.
2. **n62.dev is announced for every browser.** The core list runs in Firefox, and WebKit is tried, before the tag. A browser that has not passed shows one line at start.
3. **iOS for v1 is the web app only** (must-have C7). WebKit is the iOS product.
4. **No outside contributors at launch.** Pull-request checks (backlog C3) and the ids in comments can wait.
5. **Screen readers come in v0.2:** a result spoken as maths with its mark in words, and zoom allowed. Until then the known limits say so.
6. **Bare unit names mean the metric or international unit.** US and UK variants carry `_US` or `_UK`, the form 15 ids already have. `hp` stays the mechanical horsepower and `bbl` the oil barrel; both say so in their Find title.
7. **For a pure number, CAS refuses what Home refuses.** With a free name, it keeps Giac's algebra.
8. **The release date is not fixed.** "If we need more time, we just release later, no harm." Sun 11-15 is the target; the tag waits for the bar.

## 4. The boundary for the checking layer (the spec of the M1 packages)

Three small engine modules and one main-thread function. Each gathers code that exists today.
- **`engine/trust.ts`** (pure) builds every `ValueFacts`: `exactFacts`, `confirmed(n)`, `unchecked(why)`, `unaudited(names)`, `weaken(a, b)` and `inheritFrom(lent)`. A ratchet in the `rules` stage fails the gate on any facts literal outside it.
- **`engine/rules.ts`** holds one ordered list of checks for Home, CAS and the unit view. Each check returns `refuse(code)`, `cap(why, to)`, `replace(value)` or nothing. The helpers stay in their files.
- **`engine/envelope.ts`** holds the range of answer 1. It is the first entry of the rule list, run on the tree that Home already has.
- **`markFor`** in `state/displayMode.ts` takes the facts, the form drawn and whether σ is shown, and returns the mark. It is the only caller of `markOf` outside the engine.
- **A new app** (for example Statistics) builds Giac text for each number and calls `homeEval`, as the Num table does (`host.ts:1198`). On screen it uses `renderNumeric` and `markFor`. It never builds facts and never calls `evalf` for a number it shows.
- **The steps, one day each:**
  1. the trust module and its ratchet;
  2. one list of caps;
  3. carriers pass facts whole;
  4. one rule list;
  5. one mark function;
  6. the range.
  
  At each step the golden gate must show no changed text or mark.

## 5. The packages

Placed on 2026-11-10 after sofia's check (`SOFIA-CHECK.md`: every claim held, and every draft was corrected).

**Before the tag:**

| Id | From | What |
|---|---|---|
| G318 | X2 | an engine that cannot start stops after two tries; a start failure is classed as load or memory |
| R284 | X3 | the engine-failed note says why and offers Reload |
| A144 | X1 | the core list in Firefox; the WebKit try (replaces A110) |
| R285 | X4 | a browser that has not passed says so at start |
| G319 | X5 | the unit view refuses what Home refuses |
| G320 | X5c | CAS refuses a pure number through an infinity |
| G321 | X7 | 17 bare US unit ids get `_US` |
| G322 | X28 | `solve` keeps the real root of a cubic (H2) |
| A91 | X8 | the release notes' known limits gain screen readers, browsers and the decimal mark of plot axes |

**By day, not holding the tag:** A145 (X6), the F-Droid engine build measured against the release engine.

**Not yet placed (after the tag):** the drafts X9 to X27 in REPORT-2's order, with these changes:
- X15 moves ahead of X13 and X14, because it now fixes H1: a constant's σ is lost when its result is reused.
- X14 gains the rule "a second decision never replaces an answer with fewer solutions".
- X18 and X17 move to the end of their lanes, because units and drawn results were clean in the hunt.
- The small finds H3 to H7 go with X14, X15 and X16. H5, the `x → a·x² ▶ f` arrow store, needs its own package.

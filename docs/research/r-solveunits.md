# Units inside Solve: the design (S45)

**Status: open.** The owner picks the recommendation of section 1 (or an alternative), and with it whether P8's "Solve stays unit-free" gives way for Solve only (Home stays unit-free). Then the cut of section 7 becomes packages.

Base: phase-1 at `639c43dc`. Every claim below is checked in the code (file:line) or by `tools/probes/solve-units.ts` (`GIAC_OUT=<main>/engine/giac/_out/gsl node tools/probes/solve-units.ts`); values are `derived` (exact Giac arithmetic) unless marked (to verify).

## 1. Recommendation

**Solve with units as a layer around today's solver, which does not change.** A job builder turns each equation with units into a plain-number equation *in the units the user typed*, finds each unknown's dimension from the terms' exponents, runs the unit view's checks, and hands the plain equations to `Calc.solve` as today; the answer comes back in the unknown's unit (its slot, else the unit view's rule). Units are typed through the unit view on Solve's lines, never as text.

Why, in plain words:
- **The solver stays as trusted as it is.** The substitute-back check, the agreement check, the known-moved check (G68f1) and Polynomial roots run unchanged on plain numbers. No core case of Solve can turn red from this work.
- **The ⚠ keeps its meaning.** solve1's root test divides the residual by `max(1, |left|, |right|)` (`app/src/engine/solve1.ts:162`): the 1 means "one of the user's units". In SI numbers it would mean one farad or one metre, and the check goes blind for small quantities (section 4). Numbers in the typed units keep the 1 where it is today.
- **One unit grammar, one evaluator.** The slots, the factor table, the dimension check, the temperature and power refusals and the result unit are the unit view's (docs/04 4.2, 4.3); nothing is invented twice.
- **Home stays unit-free (P8).** An answer goes to Home as R61's result chip, with the unit dropped and said (docs/04 4.3, "the way back").

Alternatives, one line each:
- Solve in SI numbers with a scale-free residual (`|Σ terms| / max |term|`): correct too, but it changes solve1, the system path and proot for unit jobs only: two residual rules to keep right.
- Units typed only on the Num rows, never in the equations: simpler entry, but `d = v·t + 5 m` cannot be written; the layer is the same, so this is a cut, not a design (section 7 builds it first).
- Giac's own `_m` units: refused by P15 (docs/04 4.2: the Find index's exact factors only).

## 2. Today (evidence)

- Home mode refuses a unit in an equation: `X=3\unit{unit:m}{m}` → "unexpected token at 'unit'" (probe 1). Units mode reads an equation with slots: `X\cdot2\placeholder[u1]{}=6\placeholder[u2]{}` → `X*(2*pasu1)=6*pasu2`, two slots (probe 1). So the parser needs no change for equations; the slot model is R24a's (`app/src/units/types.ts:21`).
- Solve compiles each equation in Home mode (`compileEquation`, `app/src/apps/solve/app.svelte.ts:61`); a value on a Num row is a plain number (`plainNumber`, `app.svelte.ts:161`). No unit code in `app/src/apps/solve/`.
- Knowns go in as exact literals by `subst` (`knownSubst`, `app/src/engine/solve.ts:104`); a known that is an answer is moved by one unit in its last confirmed digit (`checkByKnowns`, `solve.ts:150`).
- The unit view's result unit: the end slot; else the first typed unit of the result's dimension; else SI with the prefix that puts the number in 1 to 999, mass stopping at kg (`chosenUnit` and `siPrefixed`, `app/src/units/evaluate.ts:441`, `:421`).

## 3. Knowns and the unknown's dimension

**What carries a unit.** A known: its Num row's slot (`X = 3 m`). A number in an equation: its slot (`d = v·t + 5 m`). A constant from Find (c, g₀): its own dimension (`pask<n>`). A row with no unit is a pure number. An unknown being solved: its row's slot if filled (the dimension is then known and checked), else found.

**Finding it.** Each unknown U is written U·pasdimU, a base of its own; the equation's left − right is expanded and each term's exponents are read on the ten bases and on pasdimU (the unit evaluator's d·∂f/∂d / f, `evaluate.ts` `pasue`). Every term of one equation must have one dimension: a linear system in U's exponents, which Giac's `linsolve` answers (probe 2, desktop 2 to 37 ms per case in the probe's one-call-per-term form):
- `v·t = d`: X·(2 s) = 6 m → X is L·T⁻¹; X² = 9 m² → L; X + 3 m = 5 m → L; ½·m·X² = 8 kg·m²/s² → L·T⁻¹ (a half power); the system X·Y = 6 m², X − Y = 1 m → both L.
- **No answer:** X + 3 m = 5 s → "Units don't match in E1: L vs T" (the unit view's words, docs/04 4.3).
- **Not fixed:** 2·X = X (X cancels) → "E1 does not fix the unit of X: give X a unit in its row".
- **Inside a function only:** exp(X) = 2 has no term the reading can use → X is taken as a pure number, and the unit view's function check then decides (exp, ln, … take a pure number; sin, cos, tan an angle too, `evaluate.ts` PURE_FNS, TRIG_FNS); if that check refuses (exp(X/(2 m)) with X pure), the words are "X sits inside exp(): give X a unit in its row".

With every dimension known, the whole equation runs the unit view's check as a job (one term per side, function arguments, absolute temperature "Use K or Δ°C", W/VA/var), so Solve refuses exactly what the unit view refuses, in its words.

## 4. The substitute-back rule with units

solve1 accepts a root only when the relative step is below 1e-20 and `|f| / max(1, |left|, |right|) ≤ 1e-15` (`solve1.ts:10`, `:227`); the system path uses the same floor of 1 for its step and residual (`solve.ts:261`, `:270`). The relative step is free of units; the floor of 1 is not.

Probe 3: Q = C·V with C = 1 pF, Q = 3 pC, at the wrong root V = 3.0003 (true 3):
- in SI numbers the residual is 3·10⁻¹⁶: **it passes as a root**;
- in the typed units (pF, pC) it is 9.999·10⁻⁵: ⚠, caught.

Today's solver still found the right roots in SI numbers on the cases tried (probe 4: X·Y = 6 pm², X + Y = 5 pm gives 2 pm and 3 pm with 29 confirmed digits, as in pm): the polish converges on a relative step, and the agreement check counts the digits. What goes blind is the guard against a converged non-root (a jump, a pole, a touching minimum). No wrong answer found; a sweep is the first package's job (section 7, rsu-1).

**The rule (recommended):** each unknown is solved in its scale unit (its slot; else the first typed unit of its dimension; else the coherent SI unit), and each equation is divided by the scale unit of its dimension (the first typed unit of that dimension, else coherent SI). All dimension symbols are then 1: a plain equation whose 1 means one of the user's units, as it does today when the user keeps the units in their head. Changing the shown unit afterwards multiplies by an exact factor and changes neither the root test nor the confirmed digits.

## 5. The result unit

The answer is a number in U's scale unit with Solve's facts. It is shown:
- in U's slot when the row has one (the end slot of the unit view; an absolute °C or °F converts with its offset; dB, dBm, Np are refused in Solve with the unit view's "dB converts only", `i18n/enUnits.ts:12`);
- else by the unit view's rule: the first typed unit of U's dimension (a torque stays N·m), else SI with a prefix (1 to 999, kg the top of mass).

The row then keeps that unit, so the next guess is typed in it. Copy gives the number and the unit as a unit row does (`units/row.ts`); To Home sends R61's chip, number in the unit shown with its facts, "unit dropped: Home has no units" (docs/04 4.3). The unit view's alternatives (`units/alternatives.ts`) can follow later as the row's ☰ entries.

## 6. The entry (one sketch)

- **Symb (`app/src/apps/SlotList.svelte`):** E1 is typed as today. The units key on E1's line opens the unit view over it, as in Home: a slot after each number, no end slot (an equation has no result). Enter in the last slot stores E1 with its slots; the list draws each unit set apart (smaller, muted, upright), as a Home row draws a unit request. A constant from Find brings its unit.
- **Num:** each row is `X = 3 m`. On a row's line, the number then the units key opens the unit view with one slot after it: that row's unit (≤ 4 presses for a unit at the median, docs/04 4.4). On the selected unknown the slot is the answer's unit; left empty, the answer brings one (section 5). A refusal is said on the report line, never silent (R99).
- **Not in this design:** ± σ on a row (Solve's uncertainty is a later question: refused with "± comes to Solve later"), Ans and chips with a unit in a slot (as R259 decided for the unit view), the Plot app.

## 7. The cut (labels; ids are minted when the packages are written)

Each package is red first: its test fails on phase-1 and passes after.

1. **rsu-1, the job builder (gorge, engine and `app/src/units/`, ≈1 d):** `solveJob(equations with slots, rows with slots, targets)` → plain equations, plain knowns and guesses, each unknown's scale unit and dimension, or a `UnitError`; one worker call for the dimensions (section 3), the unit view's check per equation; the answer's unit by section 5. Tests: the probe's eight cases as vitest (fails today: no `solveJob`); Q = C·V in pF/pC solved through `Calc.solve` gives 3 V; a sweep of the core list's Solve cases each given one unit, the answer equal to the unit-free one times the factor (exact); golden `solve-units.yaml` with oracle values.
2. **rsu-2, Num rows with a unit (ron, `app/src/apps/solve/`, ≈1 d, after rsu-1):** the units key on a Num row's line, the row's slot stored with the values (Stored gains `units`), the answer drawn with its unit, Copy and To Home as a unit row. Tests: e2e "X·T = 6 with T = 2 s, X = 3 m/s on screen" (fails today: the units key does nothing on a Num row); restore after a reload keeps the units.
3. **rsu-3, slots in the equations (ron, ≈1 d, after rsu-2):** the units key on E1's line in Symb, E1 stored with its slots and drawn with them. Tests: e2e "E1: d = v·t + 5 m, v = 2 m/s, t = 3 s → d = 11 m" (fails today: the parser refuses the slot in Home mode).
4. **rsu-4, Polynomial roots with units (gorge, ≈½ d, after rsu-1):** the same transform for `kind: "poly"`; each root in the unknown's unit. Test: X² = 4 m² gives −2 m and 2 m (fails until then: refused as not a number).

(to verify) by rsu-1: the dimension call in one Giac call within 5 ms on the desktop (the probe's form makes one call per term); the Tab One time with the core list's Solve cases.

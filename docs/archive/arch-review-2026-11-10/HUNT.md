# Third pass: the hunt for wrong answers inside the promise

Snapshot `5d91e0c4` (nothing has merged since). Engine: the main checkout's dev build of 2026-11-10 05:18; the patch set is the same (`git log -1 5d91e0c4 -- engine/giac/patches` gives `1e05b9ed`). Read-only; no gate, e2e or device. Every task ran through the app's own code in Node: the parser by `giacOfEntry` (`app/src/input/entry.ts`), `EngineHost`, the history item and chip builders (`state/resultItem.ts`, `state/results.ts`), the display (`renderNumeric`, `markFor`), copy and paste (`clipboard/text.ts`, `paste.ts`), the unit job builder and `shownOf`, and Solve's `compileEquation`, `confirmedText` and `isWarned`. Expected values come from mpmath at 60 to 70 digits or from exact fractions. The scratch scripts are in the session's scratchpad, not in the repo.

**Result in one line:** about 280 tasks, two real finds (one S1, one S2) and five small ones (S3). Units, settings, Solve, Function, uncertainty and everyday Home numbers are clean.

## 1. The range tested against

The floor you agreed for X10: literals of at most 30 digits, powers of ten within 10^±30, nesting depth at most 4, at most 200 nodes. Every task below is inside it. Digits settings 12, 20 and 30; RAD and DEG; the decimal point and the decimal comma.

## 2. The tasks

| Group | Tasks | Result |
|---|---|---|
| 1 Everyday Home | 1.1–1.10: parallel resistors, divider, RC time constant and cut-off, capacitor charge, dB both ways, percentage error, compound growth, loan payment | pass (10) |
| 1 | 1.11–1.17, DEG: sin 30, a surveyor's 125.5·tan 12.25°, atan(3/4), law of cosines, asin 0.5, cos 90, sin²45 | pass (7) |
| 1 | 1.18–1.20: Q factor, reactance, RMS | pass (3) |
| 2 Units | 2.1–2.5 pressure: psi, inHg, mmHg, Torr, atm | pass (5) |
| 2 | 2.6–2.10, 2.27, 2.42 power, energy, torque: hp, PS, Btu, kWh, lbf·ft, ft·lbf, N·m to lbf·in | pass (7) |
| 2 | 2.11–2.13, 2.18, 2.26, 2.41 speed, flow, consumption: mph, knot, gal/min, mpg | pass (6) |
| 2 | 2.15–2.17, 2.19–2.22, 2.31–2.32, 2.34–2.40, 2.44, 2.47 mass, force, area, volume, length (cal, cal_IT, slug, acre, kgf, kip, bbl, oz, ksi, mi, stone, t, short and long ton, dry quart, poundal, point) | pass (20) |
| 2 | 2.23–2.25 temperature (°F, °C, K) | pass (3) |
| 2 | 2.28–2.30 bare US names: `cup`, `cwt`, `fl_oz` | right for the US unit; known (N4, X7) |
| 2 | 2.14, 2.43, 2.45, 2.46 mismatches: mpg to L/km, °C + K, m + s, röntgen to K | refused, as they should be (4) |
| 2 | 2.33, 2.48 `inH2O`, `therm` | not in the table; refused (not reachable by keys) |
| 3 Reuse | 3.1–3.3 an exact result as a chip and as Ans, multiplied back | pass (3) |
| 3 | 3.4–3.6 copy, paste; with the comma; a comma copy pasted in point mode | pass; the last is refused, which is safe (3) |
| 3 | 3.7 eight pasted texts (`1,234`, `1.234,5`, `1 234,5` …) in both modes | none misread as another number (8) |
| 3 | 3.8–3.9 a small number and 2^100 copied and pasted | pass (2) |
| 3 | 3.10 the copied session text | **H6** (S3) |
| 3 | 3.11–3.14 a chip made in DEG, used after a switch to RAD | pass (4) |
| 3 | 3.15–3.18 a value stored in DEG, read and used in RAD and back | pass (4) |
| 4 Settings | 4.1–4.10 at 12, 20 and 30 digits: 1/3+√2, e^(π√163), 1−cos 10⁻⁸, (1+10⁻¹⁶)^(10¹⁶), ln 1.0000001, sin 10²², 0.1+0.2−0.3, √(10³⁰+1)−10¹⁵, tan(π/2−10⁻¹⁰), 100!/98! | pass (30) |
| 4 | the same ten rows entered at 12 digits, redrawn at 30 and 20 | pass; three show `⚠ n` with n right digits, as designed (20) |
| 4 | 4.11–4.13 the decimal comma on a number, a list, a complex number, with their copies | pass (3) |
| 4 | 4.14–4.19 values stored at 12 digits, read and used at 30 | pass (6) |
| 5 Solve | 5.1–5.5 beam length from a deflection, Colebrook, loan rate, IRR, RC time | pass (5) |
| 5 | 5.6a–e nearest root of sin x = 0.5 from five guesses, RAD and DEG | pass (5) |
| 5 | 5.7–5.9, 5.16–5.17 cubic, tan x = x, x·eˣ = 1, x² = 2, ln x + x = 3 | pass (5) |
| 5 | 5.10, 5.11, 5.20 systems of two and three equations | pass (3) |
| 5 | 5.12, 5.18, 5.19 no root, a pole, a discontinuity | no number shown where there is none (3) |
| 5 | 5.13–5.15 a double root; a cubic and Colebrook at 30 digits | pass (3) |
| 5 | 5.21–5.23 polynomial roots, real, complex and close together | pass (3) |
| 6 Function | 6.1–6.3, 6.7, 6.8, 6.15 roots, extrema, an intersection | pass (6) |
| 6 | 6.4, 6.5, 6.9, 6.10, 6.12 areas; 6.6 a slope | pass (6) |
| 6 | 6.11, 6.13, 6.14 a divergent area, a pole, no derivative | refused (3) |
| 6 | 6.16 a Num table with a hole, a pole and a complex value | `undef` and `infinity` as known (F66, F198) |
| 7 Uncertainty | 7.1–7.14 ± through products, quotients, powers, sin, ln, exp, a pendulum, a density, a small difference, and psi to kPa, °C to °F | pass against first-order propagation (14) |
| 7 | 7.15 a ± of zero | **H7** (S3) |
| 7 | 7.16 cos(0 ± 0.1), a stationary point | pass (second-order term, with its ⚠) |
| 7 | 7.17, 7.18 with the comma; at 20 digits | pass (2) |
| 8 CAS | 8.1–8.33 the drawing of 33 results read back through the parser | 30 the same value, 3 not readable (`order_size`, `[]`), none wrong |
| 8 | 8.13 `solve(x^3-2*x-5=0,x)` | **H2** (S1) |
| 8 | 8.40–8.47 CAS numbers | values right; **H3** (S3) |
| 9 Definitions | 9.1–9.6 a function that reads a variable, the variable changed, the function redefined, a parameter named like a stored value | pass (6) |
| 9 | 9.3, 9.4, 9.8 values stored before a change keep their value | as designed (3) |
| 9 | 9.7 a stored symbolic expression read after its variable is set | value right; **H4** (S3) |
| 9 | 9.9 seven reads before and after a relaunch | the same (7) |
| 9 | the arrow form `x → a·x² ▶ f` | **H5** (S3) |
| 10 Weak paths | 10.1 a constant with σ in a formula | pass (value, σ, 4 digits before σ) |
| 10 | 10.2, 10.5 that result as a chip, and stored | **H1** (S2) |
| 10 | 10.3, 10.4 the fraction form and G/G with an inexact input | `≈`, right (2) |
| 10 | 10.6, 10.7 the stored mark of ten values at 12 and 6 digits | consistent with their rows (11) |
| 10 | 10.8–10.11 a CAS number as a chip in Home | pass (4) |
| 10 | 10.20–10.40 rounding edges, a mixed list, complex results, 0⁰, odd roots | pass (21) |
| 10 | 10.41 SCI, ENG and FIX on three rows | marks right (9) |
| 10 | W2 the unit view with a free name | refused, so its "missing mark" path is not reachable |
| 10b The second-decision rule | 15 CAS and 15 Home inputs with solve, integrals of abs, limits, floor, ceil, sign, round | pass, apart from the cubics of H2 (30) |
| 10b | 25 more cubics, quartics and Digits settings around H2 | the edge of H2 |

## 3. The finds

### H2 (S1). `solve` shows no solution for a cubic that has one

**Repro.** CAS: `solve(x^3-2*x-5=0,x)` Enter. Home, with the Tmpl or Find `solve`: the same. Any digits setting.

**Shown.** `[]`, an empty list with no mark, in CAS and in Home.

**Right.** One real root, 2.094551481542326591482 (mpmath, `polyroots([1,0,-2,-5])`).

**More inputs that show `[]`:** `x^3-x-1` (root 1.32471795724), `2*x^3+x-4` (1.12817389836), `x^3+2*x^2+10*x-20` (1.36880810782), `2*x^3-4*x-10`, `x^3-2*x=5`, and the inequality `solve(x^3-2*x-5>0,x)`. `solve(x^3+x+1=0,x)` is refused as "undecided: the value sits on a cut Giac cannot decide" (root −0.682327803828).

**What still works:** cubics with a rational root; cubics with three real roots (shown as `rootof` terms); `x^3+3*x-2` (Home shows `{0.596071637983}`, right); degree 4 and 5 (Giac answers numerically); `evalf(solve(…))`, `fsolve`, `zeros`; the Solve app (it uses `proot`).

**Cause.** Two things meet.
1. Giac's `solve` drops the real root of such a cubic at some `Digits` above 14. Raw Giac on this build, `solve(x^3-2*x-5=0,x)`: right at Digits 12, 14, 15, 20 and 40; `[]` at 30, 50, 60, 80 and 100. `x^3-x-1`: right at 12 and 100; `[]` at 30 to 80. Stock Giac at its default 12 digits is right. The cause inside Giac: not found (15 minutes; the source is in the download cache, which I do not read).
2. N62 runs the exact evaluation at `Digits = P = 40` and then decides again at 60 and 80, because `solve` is on the decision list (`app/src/engine/decisions.ts:19-21`). `decideTwice` keeps the text that P + 20 and P + 40 agree on (`decisions.ts:366-375`; called at `homeEval.ts:527-536` and `host.ts:1021`). Both print `[]`, so the right answer at P is replaced. Its own comment names the risk: "both precisions can agree on a wrong text". For `x^3-x-1` the run at P is already `[]`.

So N62 is worse than stock Giac here, and the checking layer is what makes it so.

**Limit of the evidence.** Seen on the dev engine build (emsdk). The engine that ships has the same Giac source and patches but another compiler; no release build was on disk to repeat it on. X28's first step is to run its rows on both.

**Why no test saw it.** No golden row solves an irreducible cubic. The check-back stage substitutes solutions back, and an empty list has nothing to substitute.

**Golden cases** (`tests/golden/home.yaml`; the first four fail today):
```yaml
  - { id: "hunt-solve-cubic-x3-2x-5", input: "solve(x^3-2*x-5=0,x)", oracle: "Braces(findroot(lambda x: x**3-2*x-5, 2))", expect: "{2.09455148154}", mark: "≈", source: "oracle", note: "showed []: Giac's solve drops the real root at Digits 60 and 80, and the second decision keeps that" }
  - { id: "hunt-solve-cubic-x3-x-1", input: "solve(x^3-x-1=0,x)", oracle: "Braces(findroot(lambda x: x**3-x-1, 1.3))", expect: "{1.32471795724}", mark: "≈", source: "oracle", note: "showed []" }
  - { id: "hunt-solve-cubic-fibonacci", input: "solve(x^3+2*x^2+10*x-20=0,x)", oracle: "Braces(findroot(lambda x: x**3+2*x**2+10*x-20, 1.4))", expect: "{1.36880810782}", mark: "≈", source: "oracle", note: "showed []" }
  - { id: "hunt-solve-cubic-x3+x+1", input: "solve(x^3+x+1=0,x)", oracle: "Braces(findroot(lambda x: x**3+x+1, -0.7))", expect: "{-0.682327803828}", mark: "≈", source: "oracle", note: "refused as undecided" }
  - { id: "hunt-solve-cubic-control", input: "solve(x^3+3*x-2=0,x)", oracle: "Braces(findroot(lambda x: x**3+3*x-2, 0.6))", expect: "{0.596071637983}", mark: "≈", source: "oracle", note: "control: right today" }
```
and for CAS (`tests/golden/precision.yaml`; the gate compares the text):
```yaml
  - { id: "hunt-cas-solve-cubic-size", kind: "cas", input: "size(solve(x^3-2*x-5=0,x))", expect: "1", mark: "=", source: "derived", note: "a real cubic has a real root; showed 0" }
```

### H1 (S2). A result that carries a constant's uncertainty loses it when it is reused

**Repro.** Home, 12 digits. Insert the constant G from Find (6.67430E-11 ± 0.00015E-11) and type `G × 5.972ᴇ24 × 70 ÷ 6371000²` Enter. Tap the result so it goes on the line as a chip, `× 2`, Enter. The same with Ans, and with the result stored in a name.

**Shown.** Row 1: `≈ 687.398139836`, with the facts `uncDigits: 4` and σ = 0.0154488, so the screen mutes the digits after the fourth and a tap shows the σ line. Row 2: `≈ 1374.79627967`, facts `{ exact: false, reliableDigits: 40 }`: twelve bright digits, no σ.

**Right.** 2F = 1374.796279671456 with σ = 0.0308975 (first order, `2*F*u/G` in mpmath): four to five digits are known, as in row 1.

**Path.** `chipOf` builds a Home row's chip from `value`, `exact`, `reliableDigits` and `warn` only (`app/src/state/results.ts:78-84`); `uncSigma` is read by the display alone (`app/src/render/uncMute.ts:36-44`). The engine can take a chip with σ: a unit row's chip has `unc`, and `chipFactsOf` passes it (`results.ts:87-92`; `engine/chipSigma.test.ts`). A stored name loses it too: `host.ts:786-787` keeps `reliableDigits` and `warn`. This is the carrier path of REPORT-2 section 2.2 (c) and of draft X15.

**Not a recorded decision:** R40 says the chip keeps all the digits, not that it drops the σ. `docs/must-have.md` mh-C1 covers the budget and correlations, not this.

**Golden case** (`tests/golden/home.yaml`, in the form of the `g109-seq-…` rows; the field names for a chip step are X15's to settle):
```yaml
  - { id: "hunt-chip-keeps-sigma", steps: [{"latex": "\\const{G}{G}\\times5.972ᴇ24\\times70\\div6371000^2"}, {"latex": "\\ans\\times2"}], oracle: "2*mpf('6.67430e-11')*mpf('5.972e24')*70/mpf(6371000)**2", expect: "1374.79627967", mark: "≈", unc: "0.031", unc_oracle: "2*mpf('0.00015e-11')*mpf('5.972e24')*70/mpf(6371000)**2", source: "oracle", note: "the second row showed no σ and 12 unmuted digits" }
```

### S3: small finds

- **H3. CAS warns where Home confirms.** CAS `evalf(int(exp(-x^2),x,0,1))` shows `⚠ 0.746824132812`; Home `∫₀¹ e^(−x²)` shows `≈ 0.746824132812`. The same for `evalf(sum(1/k^2,k,1,inf))` and `evalf(int(ln(x),x,1,2))`. The values are right (mpmath: 0.74682413281243, 1.64493406684823, 0.38629436111989). A `⚠` on a correct result, and two views that disagree on the mark.
- **H4. A stored symbolic expression gives `≈` for an exact value.** `y²+1 ▶ p`, `3 ▶ y`, `p`: shows `≈ 10` (facts `exact: false, reliableDigits: 38`). Typed directly, `y²+1` shows `= 10`.
- **H5. The arrow form does not store a function.** `x → a·x² ▶ f` parses to `(x)->f:=a*x^2` (`app/src/input/parse.ts:111-122`: the body takes the `▶`) and the row shows the engine error. `f(x):=a·x²` works. No wrong value; the natural key order fails.
- **H6. The copied session writes `=` where the screen has no mark.** `1/0` is copied as `1/0 = infinity` (`app/src/clipboard/text.ts:141`: a missing mark becomes `=`); the screen shows `infinity` unmarked (F198). Also `2^100 ≈ 1267650600228229401496703205376`: the exact integer in full, with the mark of its rounded form.
- **H7. A ± of zero is `≈`.** `(10 ± 0) m` to cm shows `≈ 1000 ± 0` (`app/src/units/result.ts:72`: any σ makes it `≈`).

## 4. What the hunt says about M1

**The finds sit where Part A pointed.**
- H2 is the checking layer overruling a right answer: a rule (decide again at higher precision) meeting a Giac behaviour nobody had seen. It is the "two rules clash" kind, and it is the first case I know where N62 is wrong and stock Giac is right.
- H1 is a carrier that copies facts field by field (section 2.2 c).
- H3 is Home and CAS running their rules apart (2.2 a). H6 and H7 are the mark changed after `markOf` (2.2 d).

**Clean groups change three rankings in REPORT-2.**
- **Units are in better shape than B2 suggested.** 44 conversions matched their definitions exactly, among them more than 30 of the single-source factors (psi, inHg, hp, PS, slug, kip, bbl, acre, dry quart, poundal). X18 can move to the end of its lane.
- **Drawn results too (B1).** 30 of 33 drawings read back to the same value and none was wrong. X17 stays worth doing as a gate, but not early.
- **X15 moves up**, ahead of X13 and X14: it now fixes a loss a user can see.

**Two things to add to the drafts.**
- X14's rule list needs one rule H2 shows is missing: a second decision never replaces an answer by one with fewer solutions.
- The check-back stage needs a case for an empty answer: a real polynomial of odd degree has a real root, so `[]` is provably wrong. That check needs no oracle.

**Everything else held.** Everyday Home numbers, DEG, digits at 12, 20 and 30, redraws after a digits change, the decimal comma, values and chips carried across a mode change, copy and paste, Solve, Function and first-order uncertainty: no wrong digit and no missing mark in about 250 checks.

## 5. Before the tag

- **Must be fixed before 11-15: H2.** It is S1, and `solve` on a cubic is among the first things a CAS user tries. Draft **X28**.
- **Can wait: H1.** It is S2 but not everyday: it needs a constant with an uncertainty and a reuse, and for most constants σ sits near the tenth digit. It lands with X15 in the first two weeks; I added its case to that draft. If you want it named, one line in the known limits (X8): "a result's uncertainty is not carried to the next line".
- **Can wait: H3 to H7.** H3 goes with X14, H6 and H7 with X16, H4 with X15. H5 is a parser change of its own; no draft yet.

## 6. With more time

I would test next: the Function app's trace and Num entry with typed x values; Find's constants beyond G (the ones with a basis and shared leaves); lists and matrices in everyday use (a 3 × 3 solve, a determinant, a mean and a standard deviation); the FIX and PFX formats on reused values; `solve` and `zeros` on quartics with two real roots at 20 and 30 digits; and every other function on the decision list (`int`, `sum`, `limit`, `ifte`) run raw at Digits 12 against Digits 60 and 80, which is the comparison that exposed H2 and takes minutes.

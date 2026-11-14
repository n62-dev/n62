# Fourth pass: is H2 a class?

Snapshot `5d91e0c4` (nothing merged since), the same dev engine as HUNT.md. Read-only; the drafts in `packages/` are untouched. Each input ran raw on a fresh Giac instance per `Digits` (12, 40, 60, 80), and through `EngineHost` Home and CAS at 12 and 30 digits on fresh hosts. Slices stayed under a minute. Values come from mpmath.

**Answer: yes, inside `solve`, and only there.** 261 inputs over the whole decision list. Every wrong answer comes from one line in Giac, which I found. Outside `solve` the second decision never showed a wrong answer; in several cases it corrects Giac.

## 1. What ran

| Group | Inputs | Answer changes with Digits | N62 wrong |
|---|---|---|---|
| `solve` (equations, inequalities, systems; cubics, quintics, quartics, radicals, exp, trig, abs) | 46 | 15 | 15 (one only at its boundary points), and 2 refused |
| `int`, `integrate` | 28 | 1 | 0 |
| `sum` | 14 | 0 | 0 |
| `limit` | 16 | 0 | 0 |
| `floor`, `ceil`, `round`, `trunc`, `frac`, `fPart`, `iPart` | 41 | 2 | 0, and 1 refused |
| `sign`, `Heaviside` | 15 | 3 | 0 |
| `abs`, `max`, `min` | 17 | 0 | 0 |
| `piecewise`, `when`, `ifte` | 13 | 0 | 0 |
| comparisons and the root of an even power (what `decideTwice` also reaches) | 15 | 0 | 0 |
| `arg`, `norm`, `normalize`, `polar`, `polar_coordinates`, `angle` | 19 | 0 | 0 |
| `dfc`, `tri`, `classes`, `Psi`, `instphase` | 10 | 1 | 0 |
| controls for the two rules (double roots, cancelling degrees, no real root) | 27 | 0 | 0 |

Not counted: `eseries` and `sigfig` are ours, not Giac's; my three `eseries` inputs had the arguments in the wrong order and were refused for that.

## 2. Every input whose answer changes in meaning

`r` stands for the real root as a `rootof` term. "N62" is Home and CAS at 12 and at 30 digits; they agreed in every row.

| Input | Digits 12 | 40 | 60 | 80 | N62 shows | Right or wrong |
|---|---|---|---|---|---|---|
| `solve(x^3-2*x-5=0,x)` | `[r]` | `[r]` | `[]` | `[]` | `[]` | **wrong** (2.09455148154); H2 |
| `solve(x^3-x-1=0,x)` | `[r]` | `[]` | `[]` | `[]` | `[]` | **wrong** (1.32471795724); H2 |
| `solve(2*x^3+x-4=0,x)` | `[r]` | `[r]` | `[]` | `[]` | `[]` | **wrong** (1.12817389836); H2 |
| `solve(x^3+2*x^2+10*x-20=0,x)` | `[r]` | `[]` | `[]` | `[]` | `[]` | **wrong** (1.36880810782); H2 |
| `solve(x^3+x^2-1=0,x)` | `[r]` | `[]` | `[]` | `[]` | `[]` | **wrong** (0.754877666247); new |
| `solve(x^5+x+1=0,x)` | `[r]` | `[]` | `[]` | `[]` | `[]` | **wrong** (−0.754877666247); new: a quintic with a cubic factor |
| `solve((x-1)*(x^3-x-1)=0,x)` | `[1,r]` | `[1]` | `[1]` | `[1]` | `{1}` | **wrong**: one of two roots is missing (1.32471795724); new, and the worst kind, because the answer looks complete |
| `solve(x^3-x-1<0,x)` | `[x<r, r]` | `[x]` | `[x]` | `[x]` | `{x}` | **wrong** (right: x < 1.32471795724); new |
| `solve(x^3-2*x-5>0,x)` | `[x>r]` | `[x>r]` | `[]` | `[]` | `[]` | **wrong** (right: x > 2.09455148154); H2 |
| `solve(x^3-3*x+1>0,x)` | `<`, `>` | `<`, `>` | `<=`, `>=` | `<=`, `>=` | the `<=`, `>=` form | **wrong at the three boundary points** (the polynomial is 0 there, not > 0); new, small |
| `solve(x^3-2*x-5=0)`, `solve(x*(x^2-2)=5,x)` | `[r]` | `[r]` | `[]` | `[]` | `[]` | **wrong**; the same equation written differently |
| `solve(x^3-x=1,x)` | `[r]` | `[]` | `[]` | `[]` | `[]` | **wrong**; likewise |
| `solve(x^3-2*x-5.5=0,x)` | 2.138… (floats) | same | same | same | `[]` | **wrong** (2.13826529852); new. Raw Giac solves the float form numerically; N62 reads 5.5 as 11/2 and meets the exact path |
| `solve(x^3-0.5*x-1=0,x)` | 1.165… (floats) | same | same | same | `[]` | **wrong** (1.16537304306); new, likewise |
| `zeros(x^3-x-1,x)` | `[r]` | `[]` | `[]` | `[]` | `[]` | **wrong**; not on the decision list, the same filter |
| `solve(x^3+x+1=0,x)` | `[r]` | `[]` | `[r]` | `[]` | refused: "undecided" | no answer where there is one (−0.682327803828) |
| `solve(x^3-2*x^2-5=0,x)` | `[r]` | `[]` | `[r]` | `[]` | refused: "undecided" | no answer where there is one (2.69064744803) |
| `int(abs(x^3-2*x-5),x,0,3)` | 16.3462820204 | 16.346282020409 | `[-15/4, 16.346284957992]` | same | `⚠ 16.3462820204` | right: 16.346282020399 (mpmath), and under `⚠`. At 60 and 80 Giac no longer finds the root to split at |
| `floor(1000000*sqrt(2)*sqrt(2))` | 1999999 | 2000000 | 2000000 | 2000000 | 2000000 | right: the second decision corrects Giac's double |
| `floor(asin(1)*2/pi)` | 0 | 1 | 0 | 1 | refused: "undecided" | no answer where there is one (1); nothing wrong is shown |
| `sign(1-0.9-0.1)` | 0.0 | −1 | 1 | −1 | 0 | right: N62 reads the decimals exactly |
| `sign(ln(2)-0.6931471805599453)`, `sign(exp(1)-2.718281828459045)` | 0.0 | 1 | 1 | 1 | 1 | right |
| `Psi(2.5)` | 0.703156640645 | unevaluated | unevaluated | unevaluated | 0.703156640645 | right |

Three more where raw Giac is wrong at every Digits and N62 is right, because it reads a typed decimal exactly: `exp(1)>2.718281828459045` (Giac: false; N62: true), `min(exp(1),2.718281828459045)` and `min(ln(2),0.6931471805599453094)`.

**What is in the class:** any polynomial with a cubic factor that has exactly one real root, where that root is not rational. It hits equations, inequalities, products with other factors, `zeros`, and the same equation with decimal coefficients. Cubics with three real roots, rational roots, and degrees 4 and above without such a factor are right.

## 3. The cause inside Giac

**`solve_ckrange`, `src/solve.cc` lines 445 to 448** (the pinned `giac_2.1.0-1.tar.gz`; our patch 0039 touches `solve.cc` only from line 4026, so the numbers hold in our build):

```cpp
      sol=evalf(sol,eval_level(contextptr),contextptr);
      if (!(isolate_mode &1) && ( (sol.type==_CPLX && !is_zero(im(sol,contextptr),contextptr))
				  || (sol.type!=_CPLX && has_i(sol))))
	continue;
```

The cubic branch (`solve.cc:1020-1070`) writes the three roots R1, R2, R3 as `rootof` terms over a degree-6 polynomial and hands them to `solve_ckrange` (`:1096-1097`). That function evaluates each candidate numerically and drops it when its imaginary part is not zero. In doubles the real root's imaginary part comes out as exactly 0. In multi-precision it comes out as rounding noise, which is not zero, so the real root is dropped as if it were complex. Whether the noise happens to be exactly 0 depends on the precision, which is why the answer flips from one `Digits` to the next.

Measured on the raw engine, `im(evalf(r))` for the real root of each cubic:

| Digits | `x^3-2*x-5` | `x^3-x-1` |
|---|---|---|
| 12 | 0 | 0 |
| 40 | 0 | 0.163E-39 |
| 60 | −0.708E-59 | 0.369E-59 |
| 80 | −0.640E-79 | 0.650E-79 |

Every non-zero cell is a `Digits` at which Giac's `solve` returned `[]` for that cubic, and every zero cell one at which it returned the root.

**For the patch to B. Parisse (P19):** the test should compare the imaginary part with the working precision, not with zero: drop the candidate only when `|im(sol)|` is larger than `|sol|` times a few units of 10^(−Digits). Better still for this branch, decide exactly: a cubic with a negative discriminant has one real root, and Giac already computes `discriminant` at `solve.cc:1023`. **Canary, on the raw engine:** `Digits:=60; solve(x^3-2*x-5=0,x)` gives `[]`, and `Digits:=40; solve(x^3-x-1=0,x)` gives `[]`; both must give one element. I did not write or build the patch (read-only).

## 4. The two rules

**Rule A, "a second decision never replaces an answer by one with fewer solutions".**
- It would have fixed 5 of the 16 wrong inputs: the ones where the run at 40 digits is right and 60 and 80 lose the root (`x^3-2*x-5` in its three spellings, `2*x^3+x-4`, the inequality `x^3-2*x-5>0`).
- It does nothing for the other 11, where the run at 40 is already wrong.
- Misfires: none. In the 27 controls and the other 30 solve inputs the count of solutions is the same at all four Digits whenever today's answer is right.

**Rule B, "a real polynomial of odd degree never solves to `[]`".**
- It catches 11 of the 16: every equation that came back empty.
- It misses the two inequalities, the boundary row, `zeros` unless it is included, and the partial answer `{1}`.
- It misfires unless it is scoped. `solve((x^3-1)/(x-1)=0,x)` is rightly empty (the one real root is excluded by the denominator), and `solve(x^3-x^3+1=0,x)` is rightly empty (the degree cancels). An assumption on the unknown can also rightly empty it. So: a polynomial in the unknown after expansion, with rational coefficients, no assumption on the unknown.

**Neither rule catches `{1}` for `(x-1)*(x^3-x-1)=0`, or `{x}` for the inequality.**

**A third rule catches every equation row, including the partial one.** `nops(realroot(p))` is Giac's exact count of distinct real roots. It gave the right count at Digits 12 and at 60 for all seven polynomials I tried: 1 for the three cubics, 1 for `x^5+x+1`, 2 for `(x-1)*(x^3-x-1)`, 3 for `x^3-3*x+1`, 0 for `x^2+x+1`. Rule C: for a polynomial equation with rational coefficients, the number of solutions shown equals `nops(realroot(p))`; if it does not, refuse, never show the shorter list. It costs one Giac call and needs no oracle. I recommend it in X28 and in the check-back stage in place of rule B, with rule A kept in the rule list.

**The order that matters:** the Giac fix removes the cause. Rule C is the net for whatever else that filter drops. X28's own plan (take the list of solutions at Digits 14) would also have fixed every row above, since Giac was right at 12 in all of them.

## 5. Golden rows for the new wrong answers

`tests/golden/home.yaml` (all fail today except the control):
```yaml
  - { id: "hunt2-solve-cubic-x3+x2-1", input: "solve(x^3+x^2-1=0,x)", oracle: "Braces(findroot(lambda x: x**3+x**2-1, 0.75))", expect: "{0.754877666247}", mark: "≈", source: "oracle", note: "showed []" }
  - { id: "hunt2-solve-quintic-cubic-factor", input: "solve(x^5+x+1=0,x)", oracle: "Braces(findroot(lambda x: x**5+x+1, -0.75))", expect: "{-0.754877666247}", mark: "≈", source: "oracle", note: "x^5+x+1 = (x^2+x+1)(x^3-x^2+1); showed []" }
  - { id: "hunt2-solve-product-keeps-both", input: "solve((x-1)*(x^3-x-1)=0,x)", oracle: "Braces(F(1),findroot(lambda x: x**3-x-1, 1.3))", expect: "{1,1.32471795724}", mark: "≈", source: "oracle", note: "showed {1}: the cubic factor's root was dropped" }
  - { id: "hunt2-solve-cubic-decimal-coeff", input: "solve(x^3-2*x-5.5=0,x)", oracle: "Braces(findroot(lambda x: x**3-2*x-mpf('5.5'), 2.1))", expect: "{2.13826529852}", mark: "≈", source: "oracle", note: "showed []" }
  - { id: "hunt2-solve-cubic-half-coeff", input: "solve(x^3-0.5*x-1=0,x)", oracle: "Braces(findroot(lambda x: x**3-mpf('0.5')*x-1, 1.2))", expect: "{1.16537304306}", mark: "≈", source: "oracle", note: "showed []" }
  - { id: "hunt2-solve-cubic-x3-2x2-5", input: "solve(x^3-2*x^2-5=0,x)", oracle: "Braces(findroot(lambda x: x**3-2*x**2-5, 2.7))", expect: "{2.69064744803}", mark: "≈", source: "oracle", note: "refused as undecided" }
  - { id: "hunt2-solve-three-real-control", input: "max(solve(x^3-3*x+1=0,x))", oracle: "findroot(lambda x: x**3-3*x+1, 1.5)", expect: "1.53208888624", mark: "≈", source: "oracle", note: "control: three real roots, right today" }
```
`tests/golden/precision.yaml`, `kind: "cas"` (the count needs no oracle: `nops(realroot(p))`, `source: derived`):
```yaml
  - { id: "hunt2-cas-solve-product-size", kind: "cas", input: "size(solve((x-1)*(x^3-x-1)=0,x))", expect: "2", mark: "=", source: "derived", note: "two distinct real roots (realroot); showed 1" }
  - { id: "hunt2-cas-solve-quintic-size", kind: "cas", input: "size(solve(x^5+x+1=0,x))", expect: "1", mark: "=", source: "derived", note: "showed 0" }
  - { id: "hunt2-cas-zeros-cubic-size", kind: "cas", input: "size(zeros(x^3-x-1,x))", expect: "1", mark: "=", source: "derived", note: "showed 0" }
  - { id: "hunt2-cas-solve-ineq-size", kind: "cas", input: "size(solve(x^3-2*x-5>0,x))", expect: "1", mark: "=", source: "derived", note: "showed 0" }
```

## 6. Limits

Dev engine only, as in HUNT.md: no release build was on disk. About ten inputs per function, chosen by me; the three rarely used statistics and signal functions on the list (`tri`, `classes`, `instphase`) got two or three each. The right text for `solve(x^3-x-1<0,x)` is not pinned in a row: Giac's own answer at 12 digits holds a stray second element (`[x<r, r]`), so the expected form needs a decision in X28; what must not be shown is `{x}`.

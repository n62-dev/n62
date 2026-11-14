<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# R20: why `simplify` recurses without end in `decompose` (F214)

**Status: decided (G331, patch 0047).** The cause is found and a fix is tested on a scratch build. The owner has nothing to decide: P19 already settles it, since the cause is local in Giac's source, so the fix is a patch. Opus pass 156 made the package draft (section 4, label `r20-P1`) package G331, after the tag; the side finding `r20-N1` (a wrong value from `normal`) is backlog F228. Labels `r20-*` belong to this note. Base: `phase-1` `56880204`, dev engine `GIAC_OUT=…/_out/key-28c823f8c6dc9b96`. Giac line numbers are those of the pinned `giac_2.1.0-1.tar.gz` (SHA-256 `cdec2989…`, checked). None of our patches 0001–0044 touches `subst.cc`, and 0033 touches `sym2poly.cc` only in `in_normalize_sqrt` and `sym2rxroot`.

*Written 2026-11-12 by sandra (Opus), S54, pipeline run 1052. Probes: `tools/probes/decompose/` (README row).*

## 1. The smallest inputs (step 1)

The engine runs raw (`giac.eval`), each input in a child process of its own: `node tools/probes/decompose/run.ts --set shrink`, with a 10 s cap per input. There are two outcomes, and both have the one cause of section 2:

| Input (`simplify(…)`) | Dev engine | What it shows |
|---|---|---|
| `(asinh(surd(1/2,3)))^((pi/2+1/1000)^(90001/1000/(pi/2+1/1000000)))` (F214) | stack overflow in about 0.3 s | the recursion in `decompose` (named frames below) |
| `(asinh(surd(1/2,3)))^(pi^pi)` | stack overflow | the same loop, `g = (4^(1/3))^2+4` |
| `(asinh(surd(1/2,3)))^pi`, `asinh(2^(1/3))^pi`, `ln(2^(1/3)+sqrt(2^(2/3)+1))^pi`, `ln(1+sqrt(1+2^(1/3)))^pi` | runs past 10 s (200 s tried) | the endless loop in `expanded_ln` |
| **`sqrt(ln(1+sqrt(1+2^(1/3))))`** (the smallest found); also with `3^(1/3)` or `2^(1/4)` | runs past 10 s | the same |
| `asinh(sqrt(2))^pi`, `sqrt(ln(1+sqrt(1+sqrt(2))))`, `sqrt(ln(sqrt(1+2^(1/3))))`, `sqrt(ln(1+sqrt(2^(1/3))))`, `ln(ln(1+sqrt(1+2^(1/3))))`, `ln(1+sqrt(1+2^(1/3)))^2`, F214 with `asinh(1/2)` or with `x` as base | answers in under 0.4 s | — |

What it takes: a square root over a cube or fourth root's field (`1+sqrt(1+c)`) inside an `ln`, and a non-integer power of that `ln`. `pow2expln` writes the power as `exp(b*ln(ln(…)))`, so `tsimplify_common` sees two nested `ln`s.

- **Digits** do not matter. F214 overflows at Digits 12, 40 and 60, and the smallest input runs on at 40 (`--set digits`).
- **`tsimplify`** runs on in the same way: `simplify` calls `tsimplify_noexpln` (subst.cc:2703), which calls `tsimplify_common` (subst.cc:2118).
- **Giac's own clock** (patch 0002) stops the hanging forms. With `timeout 1` they return their input after 1001 ms, because the loop's gcd calls `control_c`. F214 overflows before the clock fires.
- **Stock Giac** was not built. No decision needs it, and the cause lines are stock. Whether stock reaches them with the same inputs is (to verify) by the package's red-first run on the stock build (`GIAC_PATCHES=none`, `tools/giac-regress`).

**What users meet today** (`tools/probes/engine.ts`):
- Home, typed `simplify` of F214: the engine dies (G183 restarts it). Home stops `simplify(sqrt(ln(1+sqrt(1+2^(1/3)))))` and `simplify(asinh(2^(1/3))^pi)` on its clock at about 260 ms and shows the input's value (0.957920253119 and 1.17886883625; mpmath agrees).
- The CAS view: the same two inputs run past 30 s, because its clock is 600 s (`types.ts:108`). That is a freeze until Cancel; whether Cancel restarts the worker at once is (to verify, ron, by hand in the app).

## 2. The cause (step 2)

I first read the code, then built a scratch engine with trace lines and function names (`trace-decompose.patch`, `trace.ts`; recipe in its header; two slices of host-cpu).

1. **`tsimplify_common` collects every `ln`** (`lop` is recursive, subst.cc:2142) and simplifies each argument (subst.cc:1980). For F214 the arguments are `-ln(2)+ln(R)`, `4^(1/3)*4^(1/3)+4`, `1/2*pi+1/1000` and `R/2`. Here `R` = `rootof([[1,0],[1,0,-12,-32,48,0,-64]])` = 4^(1/3)+√(4^(2/3)+4) ≈ 4.1407991994943 (`--set cause`).
2. **`alg_lvar` loses `ln(R)`** (subst.cc:1986). The trace prints `alg_lvar=[[ln(2),pi]]`, while `lvar` of the same list holds `ln(rootof(…))`. The reason is in sym2poly.cc:391-414: `alg_lvar` replaces every top-level `rootof` of the expression by `alg_lvar_f` (sym2poly.cc:387), the product of the rootof's variables to the power 1/2. For a numeric rootof that product is empty, so it is a plain number (1, by reading the code; the trace shows only the result, that the variable is gone). Because `R` also stands alone in `R/2`, the `subst` at sym2poly.cc:405 also rewrites the `R` inside `ln(R)`, which becomes the `ln` of a number, and the variable is gone. The user command `algvar` takes the other overload (`ckalgvar`, with no substitution) and keeps `ln(R)`, so this step cannot be seen from Giac's prompt. In the smallest input the list is `[227, rootof(…), -ln(227)+ln(rootof(…))]`, and `ln(rootof(…))` is lost in the same way.
3. **`e2r` with a variable list that lacks `ln(R)` gives `undef`** (subst.cc:1988-1989): `e2r(-ln(2)+ln(R),[ln(2),pi])` = `undef` on the dev engine (`--set cause`).
4. **`decompose` puts `undef` into `primeargs`** (subst.cc:1531-1533, when the list is still empty). The next argument then meets it in `simplify3(a, primeargs[i])` (subst.cc:1537). The gcd of a number or polynomial with `undef` is the number itself, `g`, and dividing `undef` by `g` leaves `undef`. `g` is not a unit (`is_unit` knows only ±1 and ±i, subst.cc:1454), so `decompose(g,…,i)` (subst.cc:1554) calls itself with the same pair again. The trace shows this from depth 1 to 6000: `i 0 g=1000 ; p[i]=undef ; a=1`, and for `pi^pi` `g=(4^(1/3))^2+4`. Each call adds a stack frame until the wasm stack overflows. The named stack is `decompose` ← `decompose` … → `simplify3` → `gcd`/`rdiv`.
5. **When nothing else is left to decompose**, the `undef` goes on to `expanded_ln`. Its loop `for (k=0;;++k){ gg=simplify3(a,primeargs[j]); if (is_unit(gg)) break; }` (subst.cc:1641-1646) never reaches a unit and adds no frame. That is the hang: a CPU profile of the run puts 87% of the time in `expanded_ln`, 75% in `simplify3` (`trace.ts` with Giac's clock, `node --cpu-prof`).

**The term that comes back unchanged** is the `primeargs` entry `undef`, together with the gcd `g` that `simplify3` returns against it (1000 for F214). `alg_lvar` sends it there by dropping `ln(rootof(…))`. The comment at subst.cc:1987 ("FIXME alg_lvar for alg ext but requires decompose to work!") marks the same spot.

**Ruled out:** a recursion bounded by the input's size (the pair repeats exactly); Digits; our patches.

## 3. Recommendation (step 3): a Giac patch that gives up on the `ln` step when an argument does not convert

In `tsimplify_common`, right after each argument is converted (subst.cc:1988-1989), return the input `e` when the argument came back `undef`. This is how the function already gives up when an extension's `ln` holds a `rootof` (subst.cc:2003-2005). Text: `tools/probes/decompose/guard-candidate.patch`, 5 lines. Why this one:
- **It is local and stops both loops at their source.** `undef` never reaches `decompose` or `expanded_ln`.
- **Tested on a scratch build** (patches 0001–0044, the trace lines and an equivalent guard):
  - All 17 inputs of `--set shrink` answer, each in 25–231 ms.
  - Each answer agrees with its input at Digits 30, the difference ≤ 7E-29. For F214 both sides are 0 at Digits 30: its value is 2.506E-24702789107 (mpmath), past MPFR's exponent range, so this is the underflow Home already refuses or marks (G84, `underflow-zero`).
  - Giac's own suite: `GIACCHECK PASSED: 686 inputs … 0 new, 0 gone`.
  - `tools/giac-regress`: check 479/479, known 88 failing as required, patched 317/317.
- **Cost:** `simplify` gives such inputs back with their `ln` arguments not combined (`ln((4^(1/3)+sqrt((4^(1/3))^2+4))/2)^pi`), a correct value in a longer form. About a day for gorge.

Alternatives, one line each:
- **Fix `alg_lvar` itself** (sym2poly.cc:405, substitute only the top-level `rootof`s, not those inside an `ln`). It is the deeper fix, but `normal`, `factor` and most of the CAS go through `alg_lvar`, so the risk is far higher than one guard. It belongs in the email to B. Parisse as the cause, not in our patch.
- **A guard on our side** (the host refuses `simplify` and `tsimplify` of a power of an `ln` over nested roots). It is a text pattern that misses other routes in (family 2 of bug-patterns), and the CAS view would still freeze.
- **A `control_c` and a depth cap in `decompose` and `expanded_ln`.** These turn the crash into an interrupt, but they keep the 600 s CAS wait and leave the `undef` in place.

## 4. Package draft `r20-P1` (gorge, Opus; after the tag)

**r20-P1: patch 0047, `tsimplify_common` gives up on an `ln` argument that does not convert (F214).**
1. Write `engine/giac/patches/0047-tsimplify-ln-undef-arg.patch` from `tools/probes/decompose/guard-candidate.patch`, with the header line `# Changed by Pascaline contributors, <date>`. Add its row in `engine/giac/patches/README.md` (status `not sent`) and set "Next" to `0048`.
2. Canary in `tests/engine/patch-canary.ts`: the stock pair at subst.cc:1988-1989, `for (int i=0;i<s;++i)` followed by `argln[i]=e2r(argln[i],vars,contextptr);` with no `is_undef` after it.
3. Regression lines, written in `tools/giac-regress/n62-patched.cas` (on stock they overflow or hang, which counts as failed; the red-first run on stock confirms this, the (to verify) of section 1):
   - `evalf(simplify(sqrt(ln(1+sqrt(1+2^(1/3))))),30)` = 0.957920253118554998403493714904 (oracle);
   - `evalf(simplify(asinh(2^(1/3))^pi),30)` = 1.17886883625147806170303369803 (oracle);
   - `size(string(simplify(F214)))>0` (it answers).
4. Golden cases (precision.yaml, CAS at 30 digits, `source: oracle`): the first two lines as typed in the CAS view. A Home case for F214's typed `simplify`: the value underflows, so the expected answer is Home's refusal or ⚠ under G84 (derived; check what Home shows).
5. `app/src/engine/host.trap.test.ts:76-84` needs another real stack overflow, because F214's input then answers. One candidate: on the raw engine, `ww:=x; for k from 1 to 20000 do ww:=sin(ww); od; subst(ww,x=1)` overflows the stack (from 5,000 deep on), with no Giac bug involved (a deep tree built in a loop skips the parser's "Too many embeddings" guard). But Home's request wraps the input in `pasans:=(…)`, which refuses the `;` sequence, and the CAS view answers it `undef("0")`. So the package finds the request form that reaches it (for example the tree stored by a CAS request, then `subst` in Home) (to verify, gorge). If none reaches it, keep the trapping stand-in case only and say so in the report.
6. Backlog: F214 is fixed by this patch. The "Upstream reports" line moves `decompose`'s recursion from "no patch" to patch 0047, with `alg_lvar` (sym2poly.cc:405) named as its cause for B. Parisse.

`r20-N1` (backlog "Open bugs") is not part of this package. `normal(sqrt(1+sqrt(1+2^(1/3))))` returns `rootof([[1,0],[…]])/227`, ≈ 0.00732288514727, where mpmath gives 1.58218310546: the square root of an algebraic number keeps the new extension's generator and drops the numerator polynomial (`--set forms`). G340 found its cause: `algnum_convert` rewrites only the rootofs `lvar` lists at the top level (sym2poly.cc:4581-4587), so the base of a power is written with the generator's variable (sym2poly.cc:4685), its numerator lost; patch 0045.

## 5. Top risks

1. **Other callers of `alg_lvar` lose a variable in the same way.** The `ln(rootof)` loss is in `alg_lvar` itself, so `normal` and others may compute with a missing variable. `r20-N1` may be one case. Hunt: `normal`/`factor`/`simplify` of inputs that hold both `R` and `ln(R)` for a nested root `R`, each checked against evalf (bug-patterns family 5).
2. **The CAS view's 600 s clock.** Any Giac loop that only `control_c` stops freezes the CAS view for up to 10 minutes. Home's clock caught both hanging forms.
3. **The test input.** Once the patch is in, the real stack-overflow test needs a new input (section 4, item 5); without one, the real-Giac case of G183 is gone.

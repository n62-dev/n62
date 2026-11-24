<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Background stream: extreme inputs (open bug lines)

**Status: open.** The backlog's "Background stream" lines, moved here as they stood on 2026-11-22 (coord, owner's yes: room in backlog.md's 20 kB). Same rules as the backlog's bug lines: each names its package or "no package"; a fix edits or removes its line here.

- **F231, no package (G340's reach, pass 160).** `normal((1+sqrt(1+2^(1/3)))^(1/3))` runs past Giac's clock, stock and patched: Home stops it, the CAS view waits its 600 s clock (r20 risk 2).
- **F195, G220 to G221f2 built.** Left (honest): a non-integer ν in Home `chisquare_cdf`, CAS `student_cdf` (error).
- **F210, fixed by G341 (run 1088).** Left: an e2e of `pasx` typed in R281's store sheet. Family 9.
- **F211, no package (pass 125).** Bound names outside G303's form, no capture (probed): `v` in nonsquare.ts shapeCodes, `a_`, `b_`, `d_` in emit.ts equalityTest; statenames.test.ts parses neither. Family 8.
- **F203 (G220; named limit).** `1-normald_cdf(0,1,20)` is ⚠ 0 (right 2.75E-89): the typed `1-` cancels.
- **F167's rest, no package (G160).** Not checked: patch 0018's double test for a base past 1E308. Family 3.
- **F90–F97 (G110's census; rerun `node tools/probes/find-census.ts <name>`).** Find's tier-1 functions on Giac's own examples, in Home and CAS. F93 is G168; F96 and F97 are G174. Family 5.
- **F96.** G174 built (run 983). Left: `GF(2,8)`'s K and g hold for the session only (after the tag: log the three-argument `GF`, quater.cc:336–374); a pre-G174 log may keep `lastgb`, `lastv`; `interactive_plotode` throws (not in Find, G111).
- **Flaky under load.** Golden `interrupt` (F128: runs 307, 909; due in `isTiming`); `units` (p95 7.93 ms, limit 5; reruns once, A51) and `invariants` (87.9 s in run 909, limit 60; in `isTiming`) beside the other lane; `steps` at ×8: G331's and G340's 2^(1/4) rows are in SPEED_KNOWN (G331f2); G325's row is still due in `isTiming`.
- **F61.** Two-argument `round`/`trunc` work in a double: patch pending (decisions.md G71). Family 4.
- **F214, fixed by G331 (patch 0047, [r20](../archive/r20-decompose.md)).** Left: `alg_lvar` drops `ln(rootof)` (sym2poly.cc:405, r20 risk 1); `simplify` gives such an input back uncombined.
- **F243, no package (pass 168; run 1106).** Home `normal(sqrt(2^(1/3)+3^(2/3)))` and its `simplify`: one Giac call of 171–225 ms on the desktop (patch 0045's degree-18 rootof), about 8× that on the Tab One, past Home's 1.5 s clock (Stopped, or the input back). In golden-speed.ts SPEED_KNOWN.
- **F245, no package (G308; pass 171).** CAS `evalf(1+i/10^15)*x` shows `1.0+1e-15*i*x`: Giac drops a complex double factor's brackets (`(1.0+i)*x` keeps them), no mark; `evalf((1+i/10^15)^x)` too.
- **F246, no package (G308).** Digits 40 `ln(evalf(1+i/10^15))`: real part 5E-31, 10 right digits (Home's check catches it; CAS ⚠).
- **F187 (G188's view sweep, seed 20752).** Area's `romberg((e_/x^x),x,exact(0),exact(1))` at Digits 30 throws a C++ exception at a 525 MB heap (2 calls); the app's engine dies (G183 restarts it).
- **F188 (same run).** Area gives no answer in 45 s for e^(π^x), (e^x)^√x, √x^(e+x), x^x−e², e^(x^x).
- **F138 (G177).** CAS DEG `evalf(cos(atan(2*i)))` shows -1.37121078136E-60-0.57735026919·i after earlier golden cases (right -0.57735026919·i, as a fresh engine gives): state leaks between cases. Row `g177-cas-deg-evalf-cos-atan-2i` (pending). Family 2.
- **F240, fixed by G803 (patch 0067; G226's census).** Find's `convert(129,2,1/2)` was `pnt[129,1/2]` or `[129,1/2]` by what ran before (prog.cc:9345 took the subtype from the fraction's pointer bits); now `convert` refuses a subtype that is not an integer with Bad Argument Value, as B. Parisse answered on 2026-11-24 ("it should probably error"). Family 2.
- **F161, fixed by G154 (left, no package).** An underflow whose size Giac cannot state (`exp(-10^30)+exp(-10^31)`: no finite re(lnexpand(ln(e))), e^(10^-1000) is 0) shows ⚠ 0 again, as before G84; was "Underflow". Family 3.
- **F225, no package (pass 151).** `evalf(sqrt(-2+i/10^330))`, Home and CAS, is ⚠ 0 2E-126+3E-205·i (right 3.53553390593E-331+1.41421356237·i): Giac's evalf of its exact sqrt text cancels as in F224, past the double range. Flagged (the two precisions differ); likely fix: sqrt in contradictedCall (G325f2). Family 4.
- **F226, no package (pass 152).** At the steps stage's ×8 clock (run 1032) `evalf(acos(sqrt(-2)*10^-330-2))` showed ⚠ 3.14159265359-728.156455628·i (right imaginary part -1.31695789692), not a stop. Family 5.
- **F248, no package (G309).** Five wrong values (≈, ⚠ n), a pending golden `g309-*` row each (causes: G309's report).
- **F155, G141 (G137, G138).** Past `MAX_EVAL_DIGITS` (S20 the cure): `tan(1ᴇ1000)` ⚠ 1 with a wrong digit, right -0.863036686363. 14 nightly rows (8 from G309): `ln`, `√`, a power of 0.99…9, an `(e^{0.5+10^-k}-e^{0.5})·10^k` term, `tan(1ᴇ1000)`, a 10^-k term beside 1ᴇ±1000.
- **F145, G183 (G120, G137, G138).** Nightly sweep hangs. Left: G138's 9 (mostly (√(a+10^-k)-√a)·10^k+b), 4 wasm traps in arctan, arccos; G309's DEG `tan(cosh(tan(…)))`; the sweep oracle drops a part of mpmath's acosh and acos of a tiny complex (G137's 2 rows).
- **The hardening without a bug line:** r16's end mark (a 50,000-input sweep with no new false mark) is not met (pass 82); `tests/golden/sweep-nightly-known.yaml` (A44) holds the nightly sweep's open rows (F145, F155); the gate never reads it.

<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# R22: MPFI intervals as a second check of the mark (S20, sandra)

**Status (2026-11-15): open.** The owner decides: intervals for real values whose every function Giac can take as an interval (recommended: go), as section 1 says; decisions.md "Needs the user".

*Spike S20 on `p1/sandra-mpfi` from `phase-1` at c7481f98. Engine: `WITH_MPFI=1 engine/giac/build-wasm.sh` (MPFI 1.5.4, all patches to 0052, GSL) against the same sources without MPFI. Probe: `tools/probes/mpfi.ts` with `mpfi-oracle.py` (rows in `tools/probes/_out/mpfi/`). Values: `tests/golden/oracle.py` (source: oracle), mpmath at the interval's precision + 40 and at least 1200 digits. Desktop, Linux on WSL2, 32 cores; the times are one run per call, three probe processes at once, outside the host-cpu lock while other runs' checks held it: read the ratios, not the milliseconds.*

## 1. Recommendation

**Go, narrow:** Giac's MPFI intervals as a second check, and as the way past `MAX_EVAL_DIGITS`, for a **real** value whose exact form holds only `+ − × ÷`, powers, `sqrt`, `abs`, `exp`, `ln`, the six trigonometric and six hyperbolic functions and their inverses, `Gamma`, `pi`, `euler_gamma` (gen.h:399–495, usual.cc:8581), no float literal and no `rootof`, evaluated from the start the agreement check uses (P raised past the longest integer + 20, G141).

Why, in plain words:
- **It never lied on that class.** 185 real allowlisted cases of `home.yaml` and `precision.yaml`: the interval holds the oracle value in all 185. An interval is a proof, not an agreement: it closes 2.4's risk "both evaluations wrong in the same way" for those functions.
- **It cures what the agreement check cannot do.** Raised 2P, 4P …, the interval gives certified digits where today shows ⚠ or a wrong digit: `tan(10^1000)` (today 0.5 with ⚠) is −0.863036686363 at 2042 digits in 8 ms; `(1-cos(10^-600))*10^1200+1` (today 1 with ⚠, G141's price) is 1.5 at 2500 digits in 9 ms; `floor((1+10^-100)^(10^100))`, which Home shows as **= 1** (right 2, section 4), is 2 as `floor` of the interval at 250 digits. All 36 counted cases short at P reach the shown digits once raised, none misses.
- **Parisse's "too pessimistic" is small and fixable.** At the same P the interval confirms a median of 2 digits fewer than today's check (80 % of cases fewer, 11 % more); that matters only when the shown digits are near P: 11 of 183 allowlisted ≈ cases at 30 digits (sin, asin, acos of 10^20 to 10^100), all confirmed after one to three raises (82 to 242 digits).
- **It is cheap.** +29,527 bytes of wasm raw, +10,456 gzip, **+6,587 brotli** (9,857,246 against 9,827,719). One call costs about 2.2 evalf calls at P (median 0.24 against 0.11 ms, p95 1.47 against 0.40 ms); a raise median 1.6 ms, the worst 400 ms (2500 digits).

Cost of the go: an engine package (MPFI in the default and release builds, the F-Droid recipe's prebuild fetch, the `THIRD_PARTY.md` row; Giac patches for D1 and D2 below, or the allowlist and the literal start that avoid them), and a gorge package that sends a qualifying exact form to `convert(…,interval,P)` beside today's two evaluations, raises when short, and lets a holding interval decide the mark and the decisions (floor, sign, comparison) of that class. Would change it: a Tab One time above 20 % of Enter p95 (2.4's own bar), or a containment miss on the allowlisted class.

Alternatives, one line each:
- **No-go:** keep the two-precision check; past the cap stays ⚠ unchecked (G141, decisions "G307 past the cap"), F155's rows stay open, `floor` keeps its wrong `=` until a decision fix of its own.
- **Intervals for complex values too:** not now: 5 complex misses (D4); after Giac fixes its complex interval functions.
- **Intervals as the only check:** no: two thirds of the cases only (erf, Bessel, the distributions, Zeta, rootof, floats, lists take none).

## 2. What was measured

908 Home cases with an `input` and an `oracle`, mark ≈ or ⚠ (no `before`, no status), plus G141's rows, the intermediate case of G141's report (`(1+exp(-300))^exp(300)`) and F155's `tan(10^1000)`. What goes in: the host's exact form when Home took the exact path (the form the agreement check evaluates), else the typed input quoted with its decimals as fractions. Bounds are printed decimals of binary bounds, so each is moved out by one unit of its last printed digit; confirmed digits are the largest n at which both bounds round alike (2.4's rule); a part whose interval holds 0 and is 10^(P−5) times smaller than the other, P before any raise, is zero (as `markOf` skips a zero part).

| Group | Cases | An interval | Misses | Meaning |
|---|---|---|---|---|
| counted: exact form, radians, no float | 629 | 419 (real 214, complex 205) | 23 | the comparison |
| of it, real and allowlisted | 185 | 185 | **0** | the go class |
| float literal in the form | 66 | 45 | 28 | the interval certifies the float, not the value: never a check |
| typed (no exact path) | 136 | 29 | 6 | D3: functions without interval support |
| DEG | 36 | 25 | 7 | the host's form is in degrees, Giac's interval functions read radians: needs our degree translation first |
| exact rational | 34 | – | – | BigInt already exact (2.4 rule 1) |

No interval (338): Giac leaves the name (`student_cdf` 16, `BesselJ` 13 as a Giac error, `UTPC` 12, `chisquare_icdf` 7, `fisher_icdf` 5, `Zeta`, `Psi`, `igamma`, `Airy_Ai`) or returns a plain MPFR number (`erf`, `LambertW`: `convert(erf(1/2),interval,40)` is 0.5204998778130465376827466538919645287365, not an interval).

## 3. Giac defects (for B. Parisse; nothing sent)

- **D1, `rootof` gives the wrong root.** `r:=rootof([[1,0],[-1,0,6,0,-12,0,12,0,6,0,0,0,-6]])`: `evalf(r,40)` is 1.939903200958…, `convert(r,interval,40)` is [−1.9399032009583…] with an imaginary part around 0. All 18 rootof rows miss (G340's nested radicals, `max(solve(x^3-3*x+1=0,x))`). Cause (to verify, gorge, by reading prog.cc:8726–8760): `in_select_root` with the `reel` flag picks another root than evalf's rule.
- **D2, an integer or float becomes a point after rounding.** prog.cc:8773–8775 turns an integer or a `_REAL` into [f, f] with f = `accurate_evalf(g, nbits)`, not an outward interval: `convert(10^100+1,interval,40)` is [0.99…97E100 .. 0.99…98E100], below 10^100; `convert(sin(10^39+1),interval,40)` is [−0.476 .. 0.843], the value −0.679034559142… (Giac's own evalf at 80 digits) outside. Fix: `mpfi_set_z` (and `mpfi_set_fr` with outward rounding for a float). The literal start avoids it for literals; computed integers stay intervals.
- **D3, a function without interval support takes intervals silently.** Quoted `shift(2^70,1)` gives 2^70 as a narrow interval; quoted `int(x^x,x,0,1)` gives [0.7834395189673322346…] (right 0.7834305107121…): wrong at the 5th digit with 37 digits of claimed width; `erf`, `Si` and `Zeta` return a non-interval number that the sum around them takes as exact (29 counted real rows held only because that MPFR value is good, not proven). Hence the allowlist on the form, not a check of the answer's type.
- **D4, complex intervals are Giac's own formulas.** At a branch cut it takes one side: `asin(cosh(3*sqrt(-pi))+1/2)` gives +0.36869i (right −0.36869i, today's value); far out it drops a tiny shift: `acos(-10^20-10^-400*i)` at 441 digits holds π to 426 digits, the value is π − 10^−420·…; `asin(tan(2)-10^5040)` likewise.

## 4. A wrong `=` found on the way

Home `floor((1+10^-100)^(10^100))` shows **= 1**; right 2 (the base lies in (2, 3): e·(1 − 10^−100/2 + …), source: derived). G141's report named it; G156 raised the decisions' start but this form still decides 1. Probe: `FACTS=1 node tools/probes/engine.ts 'floor((1+10^-100)^(10^100))'` (`exact: true`). The backlog line waits for room (backlog.md is full; the report holds the text).

## 5. To verify

- The time on the Tab One (annabell, `?bench=1` with an interval build): the 2.4 bar of 20 % of Enter p95.
- The release build (P2, Debian's Emscripten in the trixie container) with MPFI, and the F-Droid recipe's `--fetch-only` with `WITH_MPFI=1` (annabell, in the engine package).
- D1's cause (gorge, prog.cc:8726–8760) before a patch.

## 6. Risks

- A containment miss on the go class would make a ⚠ or a decision wrong with a proof's authority: the allowlist must be enforced on the form, and the gate keeps `mpfi.ts`'s counted group at 0 misses (a golden stage in the engine package).
- MPFI 1.5.4 is the 2022-04-01 snapshot (pinned by SHA-256, its SHA-512 the one Gentoo's Manifest gives); upstream is quiet (the release page offers 1.5.4; 1.5.5 is a tag on gitlab.inria.fr/mpfi, without a release tarball).

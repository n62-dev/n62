<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Status and backlog

Where we are and what is left, one or two lines per open item. Architecture: [04-architecture.md](04-architecture.md); decisions: [decisions.md](decisions.md); package order: [shifts/brief.md](shifts/brief.md) section 0, each package's cause, steps and tests in [shifts/packages/](shifts/packages/). Done items leave this file (the [archive](archive/backlog-2026-11.md) and git keep them).

## Where we are

| Stage | State |
|---|---|
| Milestones 1–3 (2026-10-11), 4a, 4, 5, 6 | Built (the lists, and the core freeze P23: [archive](archive/backlog-2026-11.md)). Open: the trust features' gate (Find per key on the Tab One: p95 14.1 ms ≤ 16, A74, E3 met), the unit gate (Next, below) |

Work continues on `phase-1`; `master` follows it from 2026-11-03 (decisions.md, the release path).

## Needs the user
0. **The core list (P23):** cut or extend [tests/core/core.yaml](../tests/core/core.yaml); do the [hand check](../tests/core/MORNING.md) before a release tag (P25; about 10 minutes, 15 cases; tell the next session what failed); keep the automatic runs' device plugged in, unlocked and on the charger (A32, A33). The one-time checks: [ONE-TIME.md](../tests/core/ONE-TIME.md).
1. Your outreach steps: none open.
2. **G2 questions:** item 77 open in `tests/golden/G2-CHECKLIST.md` (R726: Shift twice, Alpha twice on the Virtual Calculator; no code waits on it) (2026-11-19; the G2 answers keys and flow only, decisions.md P5); spot checks of keys and flow (SPOT-CHECK.md items 1–3; maths follows Giac, P5).
3. **From daily use:** the key sequence that left ⌫ stuck "at log" (F39); feel R112 (one pulse per touch, merged) on the next build; more points into [feedback.md](feedback.md).
4. **The new application id** (`dev.n62.calc`, A77): N62 installs as a new app beside the old app Pascaline; on a phone of your own copy what you need, then uninstall Pascaline (the test devices hold only N62, A77). Android's own backup is off (A23).
5. **Tap "Allow USB debugging"** on a device when it shows `unauthorized`.
6. **v0.1.0** (the days: [release-0.1.0.md](release-0.1.0.md)): now your look at the UI on the Tab One (R224's wide layout turned sideways; N62, Black & White, Solarized in Dark, Light, High contrast and Plain keys; the round pad, italic letters, ▾, ⚙; a selected and a matrix chip, R748 (no eye on its shots yet); A82's list); the video on the release candidate; after the push, the issue forms on GitHub's New issue page (A81).
7. **T1's hands-on items (2026-11-16):** A202 (the key click with the system touch sounds off, the Tab One); A210's feel after it merges (30 % against 90 % on the Fairphone); G9 waits on item 2.
8. **Later:** the outside rounds (two 30-minute rounds after R4b and R24c, [r18](research/r18-outside-test.md)); at milestone 5, time ten tasks by hand (E-notation against units).
9. **G369, a % chip in Home:** its pure number (0.0042) or the number shown (0.42)? See decisions.md.
10. **R128, R780, R779** (decisions.md): the backup offer; paging past row 12; the line's drag on the Fairphone.

### Upstream reports (owner; drafts in `../outreach/upstream-reports.md`)
- **MathLive**, filed 2026-10-19: [#3122](https://github.com/arnog/mathlive/issues/3122) (⌫ at `\left…\right`), [#3123](https://github.com/arnog/mathlive/issues/3123) (touch caret), [#3124](https://github.com/arnog/mathlive/issues/3124) (focus restore); [#3125](https://github.com/arnog/mathlive/issues/3125) (Redo after ⌫, 2026-10-20); M5, M7 (`isImplicitArg` takes no matrix, F68, nor i or e, F184) drafted by R75, R334; M6 (no public sideways scroll; text in `../outreach/upstream-reports.md`) drafted by R277.
- **Giac**, not filed yet. Regression files: `tools/giac-regress/` (G89; `n62-patched.cas`: fails on stock giac_2.1.0-1, passes with our patches; in the golden gate since G108). 0003–0051 sent (email 7, 2026-11-15), 0052 not yet (patches/README.md); the rest as four forum threads; new since: `decompose`'s recursion (F214, patch 0047), `normal` of a nested root (F228: `algnum_convert` skips a rootof inside a power, sym2poly.cc:4581, 4685; patch 0045), `shift` (F193, patch 0046, G226: ti89.cc `shiftrotate` shifts an `_INT_` by C `>>`/`<<` mod 32, a `_ZINT` never; open, F241: `rotate(5)` = 2, `shift(l,1.5)` by 1; `convert(n,b,x)`'s subtype, F240), `proot` leaving epsilon at 10^-Digits (F219; host.ts restores it), `simplify`'s assume leak (G92: subst.cc:2419, 2802), `restart(1)` clearing nothing (G93: VARS(1) lists equations, usual.cc:251), a typed string ending in a backslash refused inside brackets (G105f1), stock `int(ceil(x),x,1/2,3/2)` = [1,1.5] (right 3/2; intg.cc's falling floor split, patch 0029 part 2).

## Tasks

### Open bugs (everyday reach; order: brief section 0; family n: [bug-patterns.md](research/bug-patterns.md) section 3; each line names its package, which holds the evidence)
- **F236 (ron, R338).** history-first.spec.ts "engine not ready: the newest five rows" counts 20 renders against 15 under load: 4 failures on 11-12/13, none before. Find the extra re-format; a looser bound is no fix. G224f1 raised it to 20 (da18fc18): the fix sets 15 again.
- **F238 (A139; R340).** Shift + Fmt, dead, has no `aria-disabled`: TalkBack does not say it does nothing.
- **Flaky e2e (reruns pass; find the wait, not a longer timeout):** linetouch.spec.ts "a tap puts the caret at the touched term, on a scrolled line too" (4); enginefail.spec.ts "the wasm does not load: the note says so, with Reload…" (4); store.spec.ts "the row bar's Store ▶ opens it for the picked row…" (3); matrixsize.spec.ts "2 adds a column of zeros at the end…" (3); benchmark.spec.ts "t07 … in binary" (2, showed 60).
- **F183, no package (G171's report).** `p(A)^2` (`A:=[[1,2,3]]`, `p(M):={local t; t:=M; return t;}`) is ⚠ 14, not refused: a program with a local has no known body. Fix: a `pure(name)` in Bodies (writesThrough false) so its call is evaluated.
- **F85, no package (G102's Not done; cost only).** A Home input with chips is parsed twice per Enter (G100); the parse is its own bridge-2 call, so G102 could not fold it.
- **F73 (lists, strings: G172).** A list or matrix element only a double values shows its number with ⚠ (longer than 32 elements: Giac's text). Left: `hasFloat` reads `1..3` as a float. Families 5, 6.
- **F206, G382 (G172's report; id: Opus pass 122).** Numbers rounded inside a string: when a non-number also holds a real float, `floatsAtDigits` (numeric.ts) rounds a string's decimals: `list[x,"0.1234567890123456789",evalf(1/3)]` shows the string as `"0.123456789012"`, Home and CAS. Family 1.
- **F207, no package (G173's Not done).** A matrix inside a set, a coefficient vector or an equation keeps Giac's word (`set[matrix…]`, `poly1[matrix…]`, `matrix[[1,0],[0,1]]=x`). Family 1.
- **F208, G381 (Opus pass 124).** A stored float list read back shows vector brackets: `J:=list[evalf(1/3),evalf(2/3)]` shows `{…}`, then `J` and `J*J` show `[…]` (copy text `list[…]`); the read's rebuild (facts.ts `inherited`) drops Giac's list type. Family 1.
- **F215, no package (G328's rest, run 1033).** A name set beside the result keeps the line's ⚠ after a decision or inexact chip: `(A:=5)*floor(sin(10^100)*10^12)`. Family 1.
- **F221 (G322; pass 141).** An inequality's bound shows as Giac's rootof: `solve(x^3-x-1<0,x)` is `{x<(-rootof(…)/54)}`, not x<1.32471795724. After the tag.
- **F209, no package (G179's Not done).** A stored ≈ float through a user function is ⚠: `H:=evalf(sqrt(2))`, `f(t):=t`, `f(H)` (why: f unaudited). A rule needs care: such a line can still rest on an unaudited decision (`when`). Family 1.
- **F256 (night review K7, 2026-11-16; R354, R355).** With F stored, `F1(2.5)` reads `F*1*(2.5)` and shows `= 25` unmarked; the line looks like a call of F1. Copy gives "Δ T" for both the product and the name ΔT.
- **F172, A73f2.** Stored history costs nothing, the rows drawn at start do (bar 1.5 s): a CAS-last cold start is 1507 ms against Home's 1323; A73f2 says where.
- **F196, G301 built.** CAS DEG reduces a constant's `pi/180` quotient; a free name or Home keeps it, 5+ `sqrt` are slow (open).
- **F198, no package (named limit).** `1/0`, `tan(90°)` show `infinity` unmarked; `0/0` is refused (G168).
- **F66.** At a hole (x/x at x = 0) Home refuses (G168), Num and CAS show the value of Giac's simplified form, the plot evaluator has NaN; 6 rows in `viewsweep-known.yaml`.
- **nr1114-be-2, fixed by G353 (patch 0049).** Left: Giac's weighted forms (misc.cc stddevmean) still sum x² in one pass: stored `L:=approx([1/10,1/10,1/10])`, `variance(L,[1,1,1])` is ⚠ -1E-62, `stddev(L,[1,1,1])` ⚠ 1E-31·i. Family 6.
- **G353's trace (no package).** Before G353 `stats1(L)` of stored floats was ⚠ alone, ≈ after `linreg(L,…)` (facts.ts inherited's check); cause not traced. Family 2.
- **F252, no package (S20).** Home `floor((1+10^-100)^(10^100))` shows **= 1**, right 2 (source: derived: the power lies in (2, 3)); G156's raised start misses the loss. An MPFI interval decides 2 ([r22](research/r22-mpfi.md) 4). Family 3.
- **nr1116-be-4, -be-1 (S1, `d4bf19bf0`; G398, G399).** `sqrt(sec(2))` ≈ -1.55016062449·i (right +), `arg((i*pi)^2)` ≈ -3.14159265359 (right π). Rerun: `tools/probes/review-1116/author/rerun.sh nr1116-be-4` (`-be-1`). Families 4, 5.
- **nr1116-vg-1, -vg-2, -vg-5 (S1 extreme, `d4bf19bf0`; G403, G405, G404).** A false ≈ 1, a false `=` count, a CAS +2πi. Rerun: `tools/probes/review-1116/author/rerun.sh nr1116-vg-1` (`-vg-2`, `-vg-5`). Family 3.
- **Night review 2026-11-16:** [the rest](research/night-review-2026-11-16.md).
- **F300–F321 (T2's hunt, 2026-11-16; evidence `../drafts/2026-11-16-ultra/t2-bughunt/findings.md`).** F304 G553; F302 G551; F305 G554; F301 G550 (before the freeze); F306 G555; F307, F308 G556; F318 G558; F321 G560; F313 R551 (before the tag); F312 G559; F314, F315 R552; F300 R550 (after the tag).
- **F460 (G557's report).** `normal((i*sqrt(-2))^(1/3))` is a rootof worth 1.12246204831·i, stock too (right 0.561231024155+0.972080648620·i). Family 5.
- **F461 (pass 213, code read).** A CAS row that reads a name stored with a unit (G371) has no unit-dropped note; G392's is Home's. Family 12.
- **F462 (G576's report).** Home `sin(3^(1e6))` ≈ -0.920699462879 (4.3 s), `sin(2^(1e6))` ≈ -0.9 (right -0.0887753640826, 0.650909333380; mpmath): a huge float argument confirms digits it cannot hold. Family 4.
- **F309, no package (T2; owner: after the tag).** Home σ is first order only: a chip at a stationary point loses σ, near a pole it is too small, never ⚠.
- **F310, F316, F317, F319, no package (T2, low).** linterp refuses an x inside the table when the end check needs > 40 digits; Ans and the last chip are two σ inputs; `floor(evalf(pi,3)*1000)` = 3139 with `=`; weights summing to 0 give `infinity` unmarked.
- **F350–F365 (T4's sessions, 2026-11-16; evidence in each package).** F350 G575, F353 R576, F354 G577, F355 R577, F356 R578, F358 R579, F359 R580, F360 G578, F361 R581, F363 R583, F364 R584.
- **F400–F414, F425–F442 (T6's hunts, 2026-11-16; evidence in each package and `../drafts/2026-11-16-ultra/t6a/`, `t6b/`).** T6a: G600–G608, R600; T6b: G613–G624; unpackaged: F409, F410, F413, F430, F438, F439, F442; F440 stays Giac's (owner).
- **F357, no package (T4, S14).** Function Symb: Enter keeps the line on F1 (the owner's G2 check).

### Background stream (extreme inputs; at night, by reach)
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
- **F214, fixed by G331 (patch 0047, [r20](archive/r20-decompose.md)).** Left: `alg_lvar` drops `ln(rootof)` (sym2poly.cc:405, r20 risk 1); `simplify` gives such an input back uncombined.
- **F243, no package (pass 168; run 1106).** Home `normal(sqrt(2^(1/3)+3^(2/3)))` and its `simplify`: one Giac call of 171–225 ms on the desktop (patch 0045's degree-18 rootof), about 8× that on the Tab One, past Home's 1.5 s clock (Stopped, or the input back). In golden-speed.ts SPEED_KNOWN.
- **F245, no package (G308; pass 171).** CAS `evalf(1+i/10^15)*x` shows `1.0+1e-15*i*x`: Giac drops a complex double factor's brackets (`(1.0+i)*x` keeps them), no mark; `evalf((1+i/10^15)^x)` too.
- **F246, no package (G308).** Digits 40 `ln(evalf(1+i/10^15))`: real part 5E-31, 10 right digits (Home's check catches it; CAS ⚠).
- **F187 (G188's view sweep, seed 20752).** Area's `romberg((e_/x^x),x,exact(0),exact(1))` at Digits 30 throws a C++ exception at a 525 MB heap (2 calls); the app's engine dies (G183 restarts it).
- **F188 (same run).** Area gives no answer in 45 s for e^(π^x), (e^x)^√x, √x^(e+x), x^x−e², e^(x^x).
- **F138 (G177).** CAS DEG `evalf(cos(atan(2*i)))` shows -1.37121078136E-60-0.57735026919·i after earlier golden cases (right -0.57735026919·i, as a fresh engine gives): state leaks between cases. Row `g177-cas-deg-evalf-cos-atan-2i` (pending). Family 2.
- **F240, no package (G226's census).** Find's `convert(129,2,1/2)` is `pnt[129,1/2]` or `[129,1/2]` by what ran before: prog.cc:9345 takes the subtype from the fraction's pointer bits. Family 2.
- **F161, fixed by G154 (left, no package).** An underflow whose size Giac cannot state (`exp(-10^30)+exp(-10^31)`: no finite re(lnexpand(ln(e))), e^(10^-1000) is 0) shows ⚠ 0 again, as before G84; was "Underflow". Family 3.
- **F225, no package (pass 151).** `evalf(sqrt(-2+i/10^330))`, Home and CAS, is ⚠ 0 2E-126+3E-205·i (right 3.53553390593E-331+1.41421356237·i): Giac's evalf of its exact sqrt text cancels as in F224, past the double range. Flagged (the two precisions differ); likely fix: sqrt in contradictedCall (G325f2). Family 4.
- **F226, no package (pass 152).** At the steps stage's ×8 clock (run 1032) `evalf(acos(sqrt(-2)*10^-330-2))` showed ⚠ 3.14159265359-728.156455628·i (right imaginary part -1.31695789692), not a stop. Family 5.
- **F248, no package (G309).** Five wrong values (≈, ⚠ n), a pending golden `g309-*` row each (causes: G309's report).
- **F155, G141 (G137, G138).** Past `MAX_EVAL_DIGITS` (S20 the cure): `tan(1ᴇ1000)` ⚠ 1 with a wrong digit, right -0.863036686363. 14 nightly rows (8 from G309): `ln`, `√`, a power of 0.99…9, an `(e^{0.5+10^-k}-e^{0.5})·10^k` term, `tan(1ᴇ1000)`, a 10^-k term beside 1ᴇ±1000.
- **F145, G183 (G120, G137, G138).** Nightly sweep hangs. Left: G138's 9 (mostly (√(a+10^-k)-√a)·10^k+b), 4 wasm traps in arctan, arccos; G309's DEG `tan(cosh(tan(…)))`; the sweep oracle drops a part of mpmath's acosh and acos of a tiny complex (G137's 2 rows).
- **The hardening without a bug line:** r16's end mark (a 50,000-input sweep with no new false mark) is not met (pass 82); `tests/golden/sweep-nightly-known.yaml` (A44) holds the nightly sweep's open rows (F145, F155); the gate never reads it.

### Next (packages and order: brief section 0)
- **Units (milestone 5; docs/04 section 4):** the first unit result on the Tab One and the Fairphone 6 (< 1 s). Gate: tasks 1–4 and 10; a unit in ≤ 4 presses at the median; `units.yaml`; the owner's hand timing.
- **Milestone 6, Structure:** built (the archive); not packaged: EN7 everyday functions, EN4 one element of a list or matrix (`L(2)` from the keys indexes, R630).

### Without a package yet
- **R41's device check** (the owner's hand; A139 left it, rules section 3): TalkBack on the keypad, a sheet, ☰ Delete and the six wing keys; the status line at font scale 2.0 (DOM names: A139's report); R53's slice under TalkBack (R283). R720's history row: TalkBack offers no extra actions on it (the Tab One). R722: RAD mis-taps on the bar; R723's names (Help, Settings, Copy, Paste, no Shift layer on Vars); R724: ⌄ under TalkBack and the folded bar against the gesture bar (the Fairphone); R726: TalkBack reads the bar's ⇧/α button ("Shift on. Double-tap to turn it off") and a double-tap ends a lock (the Tab One). R743 (annabell, the Fairphone, gesture navigation): 20 swipes left that start on the last digit of a right-aligned result, how many became Android Back; whether TalkBack offers any action on a row. R832 (annabell, Fairphone): a double tap on a row's uses line picks it.
- **R58b** Alpha letters are always names in CAS (G2 item 62 can reverse it).
- **G9. Number formats against the G2** (item 15): decide in the settings and help pass.
- **R183f1's gaps (pass 211):** a name typed with no folder chosen is kept; a folder chosen later that holds another device of that name is written over (sync/device.ts deviceName returns a kept name unchecked): the first write in a folder needs to tell this device's own files from another's (a record of what it wrote, sync/record.ts). A refused rename to a prefix of this device's own name says "Another device" (syncRows.svelte.ts rename1).
- **R201's leftovers (pass 211):** Delete does not say which pad cells or slots hold the unit; Made of and the list show Find's ids (ownUnitsText.ts ofText), only kg, m, s tested back.
- **G223f1's finds (pass 146):** stats1 of a stored float list shows [..], of a typed one {..} (G381); a stored catch(e) prints as catch(exp(1)).
- **Flaky (R255f2, pass 137; R339):** persist.spec.ts "R255: a kept 5, then + 3 Enter before the field" gave 3 in 1 of 64 runs at 16 workers; likely the kept-line read outlasts `EntryController.load`'s 1 s cap (`entry/controller.ts:80`).
- **The pipeline (A201 takes red-first's ids and the audit model):** the size test skips CSS; red-first runs vitest on the branch's engine and counts a vitest file by its added test or assertion lines (A67).
- **C3. CI** (needs your OK);

### MVP release (docs/02 section 8)
- **R1. v0.1.0, the APK and the website from one tag** (A8 done: `.github/workflows/release.yml`, the checklist [release.md](release.md); left: `v0.1.0`; the bar: [release-0.1.0.md](release-0.1.0.md)). **R2. Play testing track:** never published without your OK. **R3. Screenshots and store graphics.** **R4. The help pass** (About: R87; one APK hash from two `./build.sh --unsigned` runs: annabell, A7).

### v1 and later
In docs/02 section 8; P8 defers most of v1 behind the engineer core. v1: Statistics, Inference, Parametric/Polar/Sequence, Finance, Linear/Triangle solvers (RPN: v0.1.0). v2: Advanced Graphing, Explorers. Spreadsheet, 3D: on their triggers; Geometry not planned (must-have E).

<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Status and backlog

The one place for "where are we and what's left", one or two lines per open item. The architecture is [04-architecture.md](04-architecture.md) (it supersedes [02-architecture-plan.md](02-architecture-plan.md) where they differ; 02 section 12 keeps the milestone history); decisions are in [decisions.md](decisions.md); the order of the packages is [shifts/brief.md](shifts/brief.md) section 0, and each package's cause, steps and tests are in its file in [shifts/packages/](shifts/packages/). Done items leave this file (git history and `archive/backlog-2026-10.md` at `87a8c468` keep them).

## Where we are

| Stage | State |
|---|---|
| Phase 0 spike; MVP milestones 1 (Home, CAS), 2 (Function, Solve), 3 (Python, removed by P11) | **Done** 2026-10-11 |
| **The core freeze (P23)** | **Ended 2026-10-27** (owner). Its net stays: [tests/core/](../tests/core/README.md) (69 everyday tasks, all active) runs on every merge and on the night's device; a red case is a bug to fix. |
| Milestone 4a: feel (P11) | Built: the entry work, sheets, flicks, Settings in the Mode sheet (R49, R87), history-row actions, R15b–R15c4, the mockups and the visual pass (R12a, R12b), press feedback only (R12c), TalkBack names and font scale 2.0 (R41), σ on tap (R40), the mark style (R124), the digit-group separator (R125), the palettes (R140, R150), Key shadows (R156), results mode (R53). Waiting: the trust features |
| Milestone 4: Find and trust | Engine side done (marks, 30 digits, chips, copy, defs, the Find index, the size test, A4a); Find's UI: R4a, R4b built; Find per key on the Tab One: A4b 31.9 ms, after R132 (A74, 11-05) p95 14.1 ms ≤ 16, E3 met; the gate is not complete |
| Milestone 5: Units | Built: the evaluator on Giac (P15), the pad, the entry and Find in a slot (R24a–R24d), the result's alternatives and view (R60–R63), ± (R71), menu Constants and Tools (R92) |
| Milestone 6: Structure | Not started (EN5–EN7, Help) |
| MVP release | v0.1.0, the APK and the website from one tag, on Sun 11-15 if the bar is met: [release-0.1.0.md](release-0.1.0.md) |

Work continues on `phase-1`; `master` follows it from 2026-11-03 (decisions.md, the release path).

## Needs the user
0. **The core list (P23):** cut or extend [tests/core/core.yaml](../tests/core/core.yaml) (69 cases; tell a session what to drop or add); do the [hand check](../tests/core/MORNING.md) before a release tag (P25; about 10 minutes, 15 cases; tell the next session what failed); keep the automatic runs' device plugged in, unlocked and on the charger (A32, A33). The one-time checks: [ONE-TIME.md](../tests/core/ONE-TIME.md).
1. **Your outreach steps** (decisions.md P18–P22): mirror G77's pin (`gh` logged in; the command is in `engine/giac/README.md`).
2. **G2 questions:** the unanswered items of `tests/golden/G2-CHECKLIST.md` (41, 42, 52, 56, 63–71; each package built a default, named in decisions.md; 63–65 can reverse S14's route R); the optional real-G2 spot checks (`spec/mapping/vc-2026-10-11/SPOT-CHECK.md`).
3. **From daily use:** the key sequence that left ⌫ stuck "at log" (F39); feel R112 (one pulse per touch, merged) on the next build; more points into [feedback.md](feedback.md).
4. **The new application id** (`dev.n62.calc`, A77): N62 installs as a new app beside the old app Pascaline; on a phone of your own copy what you need, then uninstall Pascaline (the test devices hold only N62, A77). Android's own backup is off (A23).
5. **Tap "Allow USB debugging"** on a device when it shows `unauthorized`.
6. **v0.1.0** (the days: [release-0.1.0.md](release-0.1.0.md)): on Sun 11-15. Now: your look at the UI on the Tab One (N62, Black & White, Solarized in Dark, Light, High contrast and Plain keys; the round pad, italic letters, ▾, ⚙; A82's list); Sat 11-14 the showcase video; after the push, the issue forms on GitHub's New issue page (A81).
7. **Later:** the outside rounds (two 30-minute rounds after R4b and R24c, [r18](research/r18-outside-test.md)); at milestone 5, time ten tasks by hand (E-notation against units).
8. **decisions.md "Needs the user":** sign S36's list of G164's 16 sample sources by Thu 11-12; R269 round trip.

### Upstream reports (owner; drafts in `../outreach/upstream-reports.md`)
- **MathLive**, filed 2026-10-19: [#3122](https://github.com/arnog/mathlive/issues/3122) (⌫ at `\left…\right`), [#3123](https://github.com/arnog/mathlive/issues/3123) (touch caret), [#3124](https://github.com/arnog/mathlive/issues/3124) (focus restore); [#3125](https://github.com/arnog/mathlive/issues/3125) (Redo after ⌫, 2026-10-20); M5 (`isImplicitArg` takes no matrix, F68) drafted by R75.
- **Giac**, not filed yet. Regression files: `tools/giac-regress/` (G89; `n62-patched.cas`: fails on stock giac_2.1.0-1, passes with our patches; in the golden gate since G108). 0003–0036 in his archive (email 14, 2026-11-08); the rest as four forum threads; new since: `simplify`'s assume leak (G92: subst.cc:2419, 2802), `restart(1)` clearing nothing (G93: VARS(1) lists equations, usual.cc:251), a typed string ending in a backslash refused inside brackets (G105f1), the laplace VARS() garbage (F89), stock `int(ceil(x),x,1/2,3/2)` = [1,1.5] (right 3/2; intg.cc's falling floor split, patch 0029 part 2).

## Tasks

### Open bugs (everyday reach; order: brief section 0; family n: [bug-patterns.md](research/bug-patterns.md) section 3; each line names its package, which holds the evidence)
- **nr1109-bu-2 (S1; R257).** Function: after F1 or the angle unit changes, Plot's y and Num keep the old values (Copy too). Rerun: `tools/probes/review-1109/rerun.sh bu-2`. Family 2.
- **nr1109-bu-3 (S1; R256).** Comma mode: `3,5 x² ÷ 2` is 37.5 (right 6.125). Rerun: `node tools/probes/parse.ts '3{,}\frac{5^{2}}{2}'`. Family 7.
- **nr1109-bu-4 (S1; R258).** Vars on a library's `g0`, `rate`: loose letters, `g*0` = 0 (right 9.80665). Rerun: `node tools/probes/parse.ts 'g0'`. Family 7.
- **store-bu-1 (S53; sd-1).** Vars shows a stored 1/3 as `A = 0.333333333333`, no ≈ (`find/names.svelte.ts:33`). Rerun: [store-design.md](research/store-design.md) 1. Family 1.
- **F183, no package (G171's report).** `p(A)^2` (`A:=[[1,2,3]]`, `p(M):={local t; t:=M; return t;}`) is ⚠ 14, not refused: a program with a local has no known body. Fix: a `pure(name)` in Bodies (writesThrough false) so its call is evaluated.
- **F180, package R199 (sandra, 2026-11-05).** Share session writes template LaTeX half-read (`\sum_{k=1}^{10}k` → `\sum_k=1^10k`).
- **F85, no package (G102's Not done; cost only).** A Home input with chips is parsed twice per Enter (G100); the parse is its own bridge-2 call, so G102 could not fold it.
- **F73 (lists, strings: G172).** A list or matrix element only a double values shows its number with ⚠ (longer than 32 elements: Giac's text). Left: `hasFloat` reads `1..3` as a float. Families 5, 6.
- **F206, no package (G172's report; id: Opus pass 122).** Numbers rounded inside a string: when a non-number also holds a real float, `floatsAtDigits` (numeric.ts) rounds a string's decimals: `list[x,"0.1234567890123456789",evalf(1/3)]` shows the string as `"0.123456789012"`, Home and CAS. Family 1.
- **F207, no package (G173's Not done).** A matrix inside a set, a coefficient vector or an equation keeps Giac's word (`set[matrix…]`, `poly1[matrix…]`, `matrix[[1,0],[0,1]]=x`). Family 1.
- **F208, no package (Opus pass 124).** A stored float list read back shows vector brackets: `J:=list[evalf(1/3),evalf(2/3)]` shows `{…}`, then `J` and `J*J` show `[…]` (copy text `list[…]`); the read's rebuild (facts.ts `inherited`) drops Giac's list type. Family 1.
- **F209, no package (G179's Not done).** A stored ≈ float through a user function is ⚠: `H:=evalf(sqrt(2))`, `f(t):=t`, `f(H)` (why: f unaudited). A rule needs care: such a line can still rest on an unaudited decision (`when`). Family 1.
- **F184, no package (owner, 2026-11-06).** `iⁱ` cannot be typed: xʸ (`#@^{#?}`, spec/keyboard.yaml:147) right after Shift+2's `\imaginaryI` does not give i a power. Cause not checked.
- **F191, package R164 (owner, 2026-11-07).** Fast typing on a phone: the press look stuck (Chrome's touch `:active`). R161 to R164 built (own `data-down` flag, key pop, Appearance › Key pop-ups; R164: the status line, the sheets' ◀ ▶ and value buttons and the update note use the same flag through `input/pressFlag.ts`, no `:active` left in `app/src`).
- **F172, A73 measured.** Stored history costs nothing; the rows drawn at start do (bar 1.5 s; R133 draws 5 rows until engine ready). A CAS-last cold start is 1507 ms against Home's 1323; A73f2 after the tag says where.
- **F196, G301 built.** CAS DEG reduces a constant's `pi/180` quotient; a free name or Home keeps it, 5+ `sqrt` are slow (open).
- **F198, no package (named limit).** `1/0`, `tan(90°)` show `infinity` unmarked; `0/0` is refused (G168).
- **F199, packages R131, R198 (named limit).** Hardware keyboard: typed `sin(1)` is `s*i_*n*(1)`, no error.
- **F66.** At a hole (x/x at x = 0) Home refuses (G168), Num and CAS show the value of Giac's simplified form, the plot evaluator has NaN; 6 rows in `viewsweep-known.yaml`.
- **Night review 2026-11-09:** the rest in [research/night-review-2026-11-09.md](research/night-review-2026-11-09.md).

### Background stream (extreme inputs; at night, by reach)
- **F193, package G226.** `shift` is wrong on negative counts and big integers, exact, no ⚠.
- **F195, G220 to G221f2 built.** Left (honest): a non-integer ν in Home `chisquare_cdf`, CAS `student_cdf` (error).
- **F210, no package (G303f1; pass 125).** Our global stores take typable names (only `pasdeg` is refused): a free `pasx` in Solve reads solve1.ts's `pasx` (raw Giac: `subst` gives -1.0). Fix: refuse a typed `pas`. Family 9.
- **F211, no package (pass 125).** Bound names outside G303's form, no capture (probed): `v` in nonsquare.ts shapeCodes, `a_`, `b_`, `d_` in emit.ts equalityTest; statenames.test.ts parses neither. Family 8.
- **F203 (G220; named limit).** `1-normald_cdf(0,1,20)` is ⚠ 0 (right 2.75E-89): the typed `1-` cancels.
- **F167's rest, no package (G160).** Not checked: patch 0018's double test for a base past 1E308. Family 3.
- **F87, package G174 (G93's report).** CAS `restart(0)`, `restart_vars(0)`, `restart(1)` and Home `restart(1)` show "pcasans: recursive definition" (pasans in Home): the answer lists our Ans slot's own name. The command took effect. Our name on screen (family 9); not reachable by keys until Find.
- **F89, package G170 (G92's report).** Giac's `laplace` and `ilaplace` on tanh(sqrt(x)) leave VARS() entries that are no names (bytes, empty, error texts), then garbage after every command: freed memory in Giac's variable list. The put-back skips them. Not reachable by keys (laplace needs Find); an upstream candidate. Also `ilaplace(1/(x^2+1)^2)` (G110's census).
- **F90–F97 (G110's census; rerun `node tools/probes/find-census.ts <name>`; `findcensus-known.yaml`).** Find's tier-1 functions on Giac's own examples, in Home and CAS. F93 is G168; F96 and F97 are G174 (the rest: G111, G113, G113f1, R80f1). Family 5.
- **F96.** Names left that the definitions log does not hold (not in Vars, gone after a relaunch): `gbasis` (lastgb), `syzygy` (lastv), `GF(2,8)` (K, g), `wz_certificate` (k, n), and the name arguments of `QR`, `LU`, `Fill`, `CopyVar`, `point3d`, `is_hamiltonian`; `debug(…)` turns on Giac's debugger, after which every program call, our helpers too, throws `prompt is not defined`; `interactive_plotode` throws the same (both left out of Find, G111).
- **F97.** CAS has no answer within 6 s (600 s hard timeout): `ellipse(-1,1,point(1+i))`, `hyperbola(…)`, `ecm_factor` of a 73-digit number; Home refuses them after 2 s.
- **F200 (A120).** Core c29 red once (device 100). A123 makes the runner await the `defs` write and log it on a red; a second red is a FIX.
- **F202, package A125.** e2e clipboard lock: waiters poll, no queue; run 838 timed out at 120 s, `fold.spec.ts:203`. Wanted: a fair queue.
- **Flaky under load.** Golden `interrupt` (F128, run 307: `expand((x+y+z+1)^40)` at timeout 0.2 s took 406 ms of 400; pass 10: a second sighting puts it into `isTiming`); golden `units` (p95 5.82, 7.93 ms, limit 5; reruns once, A51) and `invariants` (65.5 s, limit 60; no rerun) beside the other lane (passes 32, 34, run 415).
- **F61.** Two-argument `round`/`trunc` work in a double: patch pending (decisions.md G71). Family 4.
- **F122, package G187 (G116); G183: the engine restarts and says so.** Home `(atan(ln(-π)+9007199254740993))^(sin(10^-300)-10^300)` kills the engine (stack overflow inside Giac's wasm); also `(asinh(∛0.5))^((π/2+10^-3)^((90+10^-3)/(π/2+10^-6)))` (G120). G94's kind (a wasm trap by heap layout, patch 0037).
- **F187 (G188's view sweep, seed 20752).** Area's `romberg((e_/x^x),x,exact(0),exact(1))` at Digits 30 throws a C++ exception at a 525 MB heap (2 calls); the app's engine dies (G183 restarts it).
- **F188 (same run).** Area gives no answer in 45 s for e^(π^x), (e^x)^√x, √x^(e+x), x^x−e², e^(x^x).
- **F181 (G175's probe).** Home `simplify(sqrt(acosh(-1/2)^2))` ≈ -2.09439510239·i, right +2.09439510239·i (CAS right): `sym2poly.cc` sym2rxrootnum picks the root by the arg of evalf(z²), which lies on the cut with a rounding imaginary part. Family 3.
- **F138 (G177).** CAS DEG `evalf(cos(atan(2*i)))` shows -1.37121078136E-60-0.57735026919·i in the golden precision stage after earlier cases (right -0.57735026919·i; a fresh engine is right since patch 0019): state leaks between cases. Row `g177-cas-deg-evalf-cos-atan-2i` (pending). Family 2.
- **F161, fixed by G154 (left, no package).** An underflow whose size Giac cannot state (`exp(-10^30)+exp(-10^31)`: no finite re(lnexpand(ln(e))), e^(10^-1000) is 0) shows ⚠ 0 again, as before G84; was "Underflow". Family 3.
- **F155, G141 (G137, G138).** Past `MAX_EVAL_DIGITS` (S20 the cure): `tan(1ᴇ1000)` ⚠ 1 with a wrong digit, right -0.863036686363. Its nightly rows: 685 of 699 passed on the engine of 2026-11-06 and were dropped (G189); 14 stay, 9 with an `(e^{0.5+10^-k}-e^{0.5})·10^k` term, the others `ln`, `√` and a power of 0.99…9, and the `tan(1ᴇ1000)` one.
- **F145, G183 (G120, G137, G138).** Nightly sweep hangs. G186 fixed G120's 20 and G137's 6; left: `(1ᴇ1000)^asin(√-2-1ᴇ1000)` (F212), G138's 9 (mostly (√(a+10^-k)-√a)·10^k+b) and 4 wasm "unreachable" traps in arctan, arccos. The sweep oracle (`tools/probes/sweep/oracle.py`) drops a part of mpmath's acosh and acos of a tiny complex (G137's 2 oracle rows).
- **F212, no package (G186; id: pass 126).** Giac's exact `asin(sqrt(-2)-10^1000)` loses ln 2 from its imaginary part (2302.585…, mpmath 2303.278…): Home `(1ᴇ1000)^asin(√-2-1ᴇ1000)` shows ⚠ 14 (RAD 30), ⚠ 12 (DEG 30) with wrong digits (mpmath -5.71306543428E-1572+1.49276491197E-1571·i); its 2 nightly known rows sit under F145. Family 4.
- **F213, no package (G186; id: pass 126).** The sweep writes exp as `e^{…}` and the constant as `e` (`tools/probes/sweep/gen.ts` 63, 90, 119–123; `edges.ts` 68, 219), which the parser reads as the name `e_` since R67: such trees are not numbers and never judged (262 of 1187 runs of the gate's seed). Fix: `\exponentialE`, then triage what it unmasks. Family 14.
- **F159, fixed by G180 (G149f1).** DEG `sqrt(asinh(asin(3.7)))` showed ⚠ on the desktop, ≈ on the 8× clock: the 83 kB exact form's check ran out of its call's step budget; now the float path's ≈ on both; golden `g149-deg-sqrt-asinh-asin-3.7-*`.
- **The hardening without a bug line:** r16's end mark, a 50,000-input sweep with no new false mark, is not met (Opus pass 82); A44: `tests/golden/sweep-nightly-known.yaml` holds the nightly sweep's open rows (F122, F145, F155); the gate never reads it.

### Next (packages and order: brief section 0)
- **Units (milestone 5; docs/04 section 4):** the first unit result on the Tab One and the Fairphone 6 (< 1 s). Gate: tasks 1–4 and 10; a unit in ≤ 4 presses at the median; `units.yaml`; the owner's hand timing.
- **Milestone 6, Structure** (not packaged): EN5 matrices with Shift + 5 and the editor on Shift + 4 (§5.3; the Tmpl matrices work today), EN6 number bases, EN7 everyday functions, Help as context help; EN4, copying one element of a list or matrix.

### Without a package yet
- **A66's device check** (annabell, by day, the Tab One): the click with the system's touch sounds on and off, sounding only when Key click is on, and its latency against the pulse from a screen recording. Removal test: nobody (owner or an outside tester) turns it on in the four weeks after it ships, and the switch and its code go.
- **R155f1's device check** (annabell, by day, the Tab One): the run dash in Home on a cold start is above 0 px high.
- **R41's device check** (annabell, the next device run): TalkBack for a minute on the keypad and a sheet, and the status line at font scale 2.0 (decisions.md "R41"). Same run, R53: the swipe on a real WebView, TalkBack on the handle and slice.
- Plots of user functions after v0.1.0 (owner, 2026-11-02; R56b covers Solve); **R58b** Alpha letters are always names in CAS (G2 item 62 can reverse it).
- **G9. Number formats against the G2** (item 15): decide in the settings and help pass. **K1:** a pending one-shot Shift is used up by the first drag step. **K5:** the gestures in the help texts.
- **docs/05 section 5's five UI tasks** are not in `tests/tasks/tasks.yaml` (budget 2 presses or 1 tap, docs/05 section 2 rule 5).
- **R59's follow-up (owner, 2026-11-07):** an imported function is listed in the Math key's Find too, not only in Vars' Find; a small package after v0.1.0.
- **A9's leftover:** the strength slider does nothing on a motor without amplitude control (Fairphone 6); a composition of ticks would give it (owner, 2026-11-02: a package later).
- **R92's leftover:** UPART (the result's unit alone) is not built; its Tools row is off.
- **R107's leftover (pass 35):** a dead hardware key on the unit view's field (`units/open.ts`, `c.dead()`) counts no press (docs/04 5.2); its keys go through the counted `onKey`.
- **Flaky:** `scripts/fdroid-recipe.test.ts` "giac: downloads, then stops" failed once (run 881: no usable gmp with the fake curl). Cause unknown. Golden `interrupt` (`tests/engine/interrupt-test.mjs`, 0.2 s clock plus 200 ms slack) failed once at 417 ms in run 909 round 2, the quiet rerun after an `invariants` miss (87.9 s against 60; 56.2 s on the same code in round 1): load, and neither is the package's (pass 128). `isTiming` has invariants but not interrupt; add it after a second failure.
- **The pipeline:** `resolve_audit_model` is tested only by dry-run echo lines; the size test skips CSS. Red-first (`pipeline-lib.sh`) runs vitest on the branch's engine (G133f1's engine test passes there) and reads ids as `[A-Za-z0-9_.-]` (ids with `/` or `^` are invisible). It counts a changed vitest file on a net added `it(`/`test(` or `expect(`/`assert` line, and runs one that adds any other line (an assertion edited in place, a new `it.each` row) beside them (A67).
- **C3. CI** (needs your OK);

### MVP release (docs/02 section 8)
- **R1. v0.1.0, the APK and the website from one tag** (A8 done: `.github/workflows/release.yml`, the checklist [release.md](release.md); left: `v0.1.0`; the bar: [release-0.1.0.md](release-0.1.0.md)). **R2. Play testing track:** never published without your OK. **R3. Screenshots and store graphics.** **R4. The help pass** (About: R87; one APK hash from two `./build.sh --unsigned` runs: annabell, A7).

### v1 and later
In docs/02 section 8; P8 defers most of v1 behind the engineer core. v1: Statistics, Inference, Parametric/Polar/Sequence, Spreadsheet, Finance, Linear/Triangle solvers, RPN. v2: Geometry, Advanced Graphing, 3D, Explorers.

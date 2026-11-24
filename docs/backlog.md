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
9. **R779** (decisions.md): the line's drag on the Fairphone.
10. **A266's device step:** plug the Tab One (HA24BZ2Y) in; `adb devices` from WSL must list it (the adb server restarts itself after `adb kill-server`, a gap of about 6 s). Then A266f1 runs by day (does the WebView run under the bars, the five looks with shots); no gate compiles N62BarsPlugin.java until then.
11. **G784** (decisions.md): should Paste read a copied name back? (G784f1 refuses one N62 copied; a product of names is refused).
12. **On the Fairphone at the next APK (pass 234):** R843's orange Enter in N62 Light; R866's slot line on the unit pad's prefix keys; R863's ⚙ draws as text, not a colour emoji (else R863f1: an inline SVG); R867's drag feel per number or name (decisions.md); R872's Enters in Black & White and Solarized (rest, Shift armed, Alpha locked); R874's faint mark on an empty history in B&W Dark and N62 Dark, now in the hint's colour at 1.25:1 (pass 235).
13. **R872, keep N62 Light's Enter in High contrast at 2.79:1** from the keypad (recommended; decisions.md, Needs the user, "R872"): 3:1 and a 7:1 black label cannot both hold there (fill luminance ≤ 0.277 against ≥ 0.30); the other way, a dark brown Enter with a white label, comes near Shift.
14. **R873, Solarized's pad arrows at 4.03 and 4.28:1** (recommended; decisions.md, Needs the user, "R873"): a round pad 1.25:1 from the keypad leaves the 70 % arrows short of 4.5:1 in Solarized Dark and Light. After the merge, on your phone: B&W Dark and Solarized, the round pad and the key line.
15. **R918, keep the unit view's entries budget at 42.6 kB** (recommended; decisions.md, Needs the user, "R918"): the history-tap guard costs 0.59 kB; else a cut of that size in the view's chunk.

### Upstream reports (owner; drafts in `../outreach/upstream-reports.md`)
- **MathLive**, filed 2026-10-19: [#3122](https://github.com/arnog/mathlive/issues/3122) (⌫ at `\left…\right`), [#3123](https://github.com/arnog/mathlive/issues/3123) (touch caret), [#3124](https://github.com/arnog/mathlive/issues/3124) (focus restore); [#3125](https://github.com/arnog/mathlive/issues/3125) (Redo after ⌫, 2026-10-20); M5, M7 (`isImplicitArg` takes no matrix, F68, nor i or e, F184) drafted by R75, R334; M6 (no public sideways scroll; text in `../outreach/upstream-reports.md`) drafted by R277.
- **Giac** (B. Parisse, by email; the thread: `../outreach/README.md`). 0001–0051 are in his re-published 2026-11-22 tarball (0043 and 0045 without their G364 and G340f1 deltas; `../drafts/2026-11-22-parisse-tarball/REPORT.md`; the Status column of `engine/giac/patches/README.md` says so since G787); email 8 (draft; G783 merged) sends those deltas and 0052–0059; the pin stays giac_2.1.0-1 until a numbered archive (P21; G788). His open points from email 7: `rotate` on an integer (Q34, F241, "probably a bug"), `timeout` without `ckevery` (Q36, unknown); Q30's lower median is intended. Regression files: `tools/giac-regress/` (G89; in the golden gate since G108). `convert(n,b,x)`'s subtype (F240) goes in email 8.

## Tasks

### Open bugs (everyday reach; order: brief section 0; family n: [bug-patterns.md](research/bug-patterns.md) section 3; each line names its package, which holds the evidence)
- **F378, F379 (owner's bug list 4, 2026-11-23; `../drafts/2026-11-23-owner-bugs4/`).** F378: one Android back in Function or Solve leaves N62 (R926, then A271's double back). F379 ✓ (R925).
- **F366–F377 (layers study 2026-11-23, sandra + sofia; `../drafts/2026-11-23-layers-study/`).** Input leaks through a layer over Home. F368 F376 F377 ✓ (R915); F366 F367 F370 F371 F375 ✓ (R917–R919); F372 F373 R922; F374 R898. F369 (⌄ folds the keys under the view): no package, nothing is lost. The net: `layers.spec.ts`, its known list per F id (R916 ✓).
- **F236 (ron, R338).** history-first.spec.ts "engine not ready: the newest five rows" counts 20 renders against 15 under load: 4 failures on 11-12/13, none before. Find the extra re-format; a looser bound is no fix. G224f1 raised it to 20 (da18fc18): the fix sets 15 again.
- **F238 (A139; R340).** Shift + Fmt, dead, has no `aria-disabled`: TalkBack does not say it does nothing.
- **Flaky e2e (reruns pass; find the wait, not a longer timeout):** linetouch.spec.ts "a tap puts the caret at the touched term, on a scrolled line too" (4); enginefail.spec.ts "the wasm does not load: the note says so, with Reload…" (4); store.spec.ts "the row bar's Store ▶ opens it for the picked row…" (3); matrixsize.spec.ts "2 adds a column of zeros at the end…" (3); tips.spec.ts "a key press only closes the tips…" (3); benchmark.spec.ts "t07 … in binary" (3, showed 60; run 1465).
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
- **nr1116-vg-1, -vg-2, -vg-5 (S1 extreme, `d4bf19bf0`; G403, G405, G404).** A false ≈ 1, a false `=` count, a CAS +2πi. Rerun: `tools/probes/review-1116/author/rerun.sh nr1116-vg-1` (`-vg-2`, `-vg-5`). Family 3.
- **Night review 2026-11-16:** [the rest](research/night-review-2026-11-16.md).
- **F300–F321 (T2's hunt, 2026-11-16; evidence `../drafts/2026-11-16-ultra/t2-bughunt/findings.md`).** F304 fixed by G553 (patch 0061); F302 fixed by G551 (patch 0062); F305 fixed by G554 (patch 0063); F301 G550 (before the freeze); F306 G555; F307, F308 G556; F318 G558; F321 G560; F313 R551 (before the tag); F312 G559; F314, F315 R552; F300 R550 (after the tag).
- **F460 (G557's report).** `normal((i*sqrt(-2))^(1/3))` is a rootof worth 1.12246204831·i, stock too (right 0.561231024155+0.972080648620·i). Family 5.
- **F461 (pass 213, code read).** A CAS row that reads a name stored with a unit (G371) has no unit-dropped note; G392's is Home's. Family 12.
- **F462 (G576's report).** Home `sin(3^(1e6))` ≈ -0.920699462879 (4.3 s), `sin(2^(1e6))` ≈ -0.9 (right -0.0887753640826, 0.650909333380; mpmath): a huge float argument confirms digits it cannot hold. Family 4.
- **F475, fixed by G790 (patch 0064; G554's report; pass 233).** At Digits > 14 a matrix product whose left factor had only floats within 1e-12 of 0 was the exact zero matrix: Home `approx([[10^-13,0],[0,10^-13]])*[[1,2],[3,4]]` showed [[0,0],[0,0]], not ≈. Family 3.
- **F476, G791 (G551's report; pass 233).** `hamdist(-1,2^40)` = 33, `hamdist(-2^40,2^40)` = 4294967295 (raw, typed): a negative small integer beside a big one, and opposite signs, give a count. Family 3.
- **F477, no package (G553's and G554's reports, low).** Giac's `_floor` still truncates a positive MPFR value at rounding noise below an integer (`floor(sin(1)^2+cos(1)^2)` = 0 raw and in CAS at Digits 40; Home 1 by onCut); a float matrix with float zeros (`exp(approx([[-30,0],[0,-30]]))`) shows ⚠, as Home cannot confirm a float zero. Family 3.
- **F478, no package (G790's fix round 1; raw engine, stock and patched).** `normal(sqrt(1+sqrt(1+2^(1/3))))` leaves `epsilon` at 1e-180 and `epsilon:=1e-12` does not reset Giac's context0 one: every later `is_zero(…,context0)` changes. At Digits 40 `det(approx([[10^-13,0],[0,10^-13]]))` is 1E-13 in a fresh engine, 1E-26 after that line; on stock the G790 product turned right (it hid F475 in giac-regress). Family 2.
- **F479, no package (G790's fix round 1; raw engine, stock and patched).** `det(approx([[10^-13,0],[0,10^-13]]))` is 0.0 at Digits 12 and 1E-13 at Digits 40 (right 1E-26, derived: the diagonal's product): det's pivot test takes floats within 1e-12 as zero. Family 3.
- **F309, no package (T2; owner: after the tag).** Home σ is first order only: a chip at a stationary point loses σ, near a pole it is too small, never ⚠.
- **F310, F316, F317, F319, no package (T2, low).** linterp refuses an x inside the table when the end check needs > 40 digits; Ans and the last chip are two σ inputs; `floor(evalf(pi,3)*1000)` = 3139 with `=`; weights summing to 0 give `infinity` unmarked.
- **F350–F365 (T4's sessions, 2026-11-16; evidence in each package).** F350 G575, F353 R576, F354 G577, F355 R577, F356 R578, F358 R579, F359 R580, F360 G578, F361 R581, F363 R583, F364 R584.
- **F400–F414, F425–F442 (T6's hunts, 2026-11-16; evidence in each package and `../drafts/2026-11-16-ultra/t6a/`, `t6b/`).** T6a: G600–G608, R600; T6b: G613–G624; unpackaged: F409, F410, F413, F430, F438, F439, F442; F440 stays Giac's (owner).
- **Copy wrote stand-ins (sofia, 2026-11-22), fixed by G784.** `2i` (hardware i) copied as `2*i_`, `rainbow` as `r*a*i_*n*b*o*w`; Copy, Copy as shown, Copy exact, Share and the CSV now write the letters. `2*i` copied from the name i no longer pastes as the constant i: Paste refuses it, named (G784f1 ✓); whether Paste reads names: decisions, Needs the user. Family 9.
- **F357, no package (T4, S14).** Function Symb: Enter keeps the line on F1 (the owner's G2 check).

### Background stream (extreme inputs; at night, by reach)
Its lines: [research/background-stream.md](research/background-stream.md) (moved 2026-11-22 for the budget; one place, edited there).

### Next (packages and order: brief section 0)
- **Units (milestone 5; docs/04 section 4):** the first unit result on the Tab One and the Fairphone 6 (< 1 s). Gate: tasks 1–4 and 10; a unit in ≤ 4 presses at the median; `units.yaml`; the owner's hand timing.
- **Milestone 6, Structure:** built (the archive); not packaged: EN7 everyday functions, EN4 one element of a list or matrix (`L(2)` from the keys indexes, R630).

### Without a package yet
- **R41's device check** (the owner's hand; A139 left it, rules section 3): TalkBack on the keypad, a sheet, ☰ Delete and the six wing keys; the status line at font scale 2.0 (DOM names: A139's report); R53's slice under TalkBack (R283). R720's history row: TalkBack offers no extra actions on it (the Tab One). R722: RAD mis-taps on the bar; R723's names (Help, Settings, Copy, Paste, no Shift layer on Vars); R724: ⌄ under TalkBack and the folded bar against the gesture bar (the Fairphone); R726: TalkBack reads the bar's ⇧/α button ("Shift on. Double-tap to turn it off") and a double-tap ends a lock (the Tab One). R743 (annabell, the Fairphone, gesture navigation): 20 swipes left that start on the last digit of a right-aligned result, how many became Android Back; whether TalkBack offers any action on a row. R832 (annabell, Fairphone): a double tap on a row's uses line picks it. R853 (the Tab One): the unit view's ← → take taps in 44 px, not the bar's. R855: Tab One's Choose folder offers the Fairphone's backup.
- **R58b** Alpha letters are always names in CAS (G2 item 62 can reverse it).
- **G9. Number formats against the G2** (item 15): decide in the settings and help pass.
- **R183f1's gaps (pass 211):** a name typed with no folder chosen is kept; a folder chosen later that holds another device of that name is written over (sync/device.ts deviceName returns a kept name unchecked): the first write in a folder needs to tell this device's own files from another's (a record of what it wrote, sync/record.ts). A refused rename to a prefix of this device's own name says "Another device" (syncRows.svelte.ts rename1).
- **R201's leftovers (pass 211):** Delete does not say which pad cells or slots hold the unit; Made of and the list show Find's ids (ownUnitsText.ts ofText), only kg, m, s tested back.
- **G223f1's finds (pass 146):** stats1 of a stored float list shows [..], of a typed one {..} (G381); a stored catch(e) prints as catch(exp(1)).
- **Flaky (R255f2, pass 137; R339):** persist.spec.ts "R255: a kept 5, then + 3 Enter before the field" gave 3 in 1 of 64 runs at 16 workers; likely the kept-line read outlasts `EntryController.load`'s 1 s cap (`entry/controller.ts:80`).
- **The pipeline (A201 takes red-first's ids and the audit model):** the size test skips CSS; red-first runs vitest on the branch's engine and counts a vitest file by its added test or assertion lines (A67).
- **Load in the gates (pass 231; G782f1, G783):** the golden steps stage's ×8 clock rows `g331-simplify-f214-12`, `g325f1-acos-…`, `g618-sum-…` went into `SPEED_KNOWN` (golden-speed.ts) because other runs' checks loaded the host, so a real slowdown there is no longer seen; numeric.ts's other lone fallbacks (agreed's `once`, doubleFallback) still show a clock-stopped read's partner alone (G783 fix round 1 only retried floatFactsOf's). Family 4.
- **Flaky (pass 231):** fold.spec.ts "folded: a tap picks, the second inserts and unfolds; …" has 3 FLAKE lines (R700 twice, G399) and failed in pass 231's e2e at load 24: its `rows` helper (fold.spec.ts:50) saw 2 of 3 rows done in 5 s; alone it passes (5.7 s). Ten fold.spec FLAKE lines since run 1260 share that helper.
- **A digit on a disabled sheet row (R862; pass 232, decisions.md):** runs nothing with no feedback (`Sheet.activate`); docs/05 rule 4 wants the dead press's short haptic "no", in every sheet (the unit view's ☰ Number into Home and Store in with no result; Tools, Store, Settings rows). Family 7.
- **C3. CI** (needs your OK);

### MVP release (docs/02 section 8)
- **R1. v0.1.0, the APK and the website from one tag** (A8 done: `.github/workflows/release.yml`, the checklist [release.md](release.md); left: `v0.1.0`; the bar: [release-0.1.0.md](release-0.1.0.md)). **R2. Play testing track:** never published without your OK. **R3. Screenshots and store graphics.** **R4. The help pass** (About: R87; one APK hash from two `./build.sh --unsigned` runs: annabell, A7).

### v1 and later
In docs/02 section 8; P8 defers most of v1 behind the engineer core. v1: Statistics, Inference, Parametric/Polar/Sequence, Finance, Linear/Triangle solvers (RPN: v0.1.0). v2: Advanced Graphing, Explorers. Spreadsheet, 3D: on their triggers; Geometry not planned (must-have E).

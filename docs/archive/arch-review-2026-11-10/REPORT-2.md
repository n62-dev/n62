# Second pass: from findings to decisions

Snapshot: `5d91e0c4`, the same commit as REPORT.md. `git log 5d91e0c4..phase-1` is empty: nothing has merged since, so no finding is changed by a merge. Read-only; no gate, e2e or device run. A few short probes ran on the main checkout's dev engine with the snapshot's code (each under a minute); the restart probe used a fake worker and no engine. The package drafts are in `packages/` beside this file (X1 to X27).

## 1. What changed from REPORT.md

**Corrected numbers.**
- "About 45 engine fixes a week" understated it. By calendar week (Wed to Tue, ending 11-10), `fix` commits on `app/src/engine` without tests were 77, 52, 40 and 72: a mean of 60. The first report's 12, 99, 43, 48 and 41 are right for its Saturday windows. Either way the rate is not falling.
- "Tripled in four weeks" holds: 3,649 lines on 10-17, 11,555 at the snapshot.
- A fix commit is not a bug. Of the 154 fixes in the four core files, 31 name a fix round or an audit in their subject, and the 154 belong to 105 packages.

**Rankings.**
- **M1 stays first, with a different recommendation.** The first report said: measure, set the range, run S20. The reading says: build the boundary first (one rule list and one place where trust facts are made), with the rate and the range beside it. S20 stays, behind them. The reasons are in section 2.
- **M2 moves to "before the tag"**, by your answers 2 and 3.
- **B5 (screen readers) moves to v0.2** with a known-limit line now. **B7 and pattern 3 move to "later"**, by your answer 4.

**New findings.**
- **N1. The unit view shows numbers that Home refuses.** `(1/(1/0)) m` shows `= 0 m`; a divergent series shows `≈ 0.5 m`. This touches release bar point 3.
- **N2. An engine that cannot start is restarted without limit**, and the screen stays on "Starting the engine…" for ever.
- **N3. F-Droid's build will probably not match the release bit for bit.** The release engine is built with ASLR off because the compiler is not deterministic otherwise; the recipe does not do that.
- **N4. Fourteen bare unit names are US units today**, against your rule of answer 6.
- **N5. CAS shows `0` for `1/(1/0)`** where Home refuses. Decided (section 4): CAS refuses it too.

**Nothing dropped.** B6 (memory on a small phone) is still unverified, and N2 makes it worse: a memory failure at start is exactly the case that loops.

## 2. The checking layer

I read `homeEval.ts`, `numeric.ts`, `host.ts` (the Home, CAS and stored-name parts) and `units/evaluate.ts` in sections, and followed one result on each of four paths.

### 2.1 Is the churn converging?

Not in the sense you asked. I sorted the 154 `fix` commits of the last four weeks in the four files by their messages into five kinds. "New rule" is a failure class no rule covered; I added it because it is the honest fifth kind.

| Week | Fixes | New rule | New case in a known rule | Rule was wrong | Two rules clash | Plumbing | Wrong + clash |
|---|---|---|---|---|---|---|---|
| 10-14 to 10-20 | 59 | 6 | 14 | 18 | 11 | 10 | 49% |
| 10-21 to 10-27 | 29 | 3 | 5 | 5 | 7 | 9 | 41% |
| 10-28 to 11-03 | 25 | 0 | 4 | 10 | 4 | 7 | 56% |
| 11-04 to 11-10 | 41 | 1 | 9 | 6 | 14 | 11 | 49% |
| All | 154 | 10 | 32 | 39 | 36 | 37 | 49% |

- **What is converging:** new rules. 6, 3, 0, 1. The set of rules is nearly complete.
- **What is not:** the share of "wrong" plus "clash" is flat at about half. Clashes were the largest kind last week (14 of 41).
- A clash looks like this: the guard for long literals stamped "unchecked" over the agreement check's "no digit confirmed" (G141f1); the double fallback overrode a value that depends on precision (G153); the name our state read bound shadowed the user's `k` (G303).

Limits of this count: one reader, from commit messages; week 4 holds the batch a night review filed.

### 2.2 Where the boundary is missing

`markOf` and `ValueFacts` are sound. The boundary fails around them, in four ways.

**(a) The rules are called by hand, in two orders, and not at all in a third place.**
- Home runs about 13 checks in a fixed order inside one 340-line function (`homeEval.ts:626-782`): list-as-arguments, non-square power, no limit, list plus number, divergence, the refused cut, the empty sequence, Giac's pair, range, through-infinity, numeric integral, underflow.
- CAS runs twelve of the same helpers in another order (`host.ts:983-1057`). For example Home asks list-as-arguments before divergence; CAS asks divergence first.
- The unit view runs none of them. That is N1, probed: `(1/(1/0))*{m}` gives `= 0 m`, `sum(cos(k),k,0,inf)*{m}` gives `≈ 0.5 m`; Home refuses both. The keys can type the first.
- Solve and the plot's analysis have their own short checks. The Num table goes through Home, so it is covered.

**(b) Trust is lowered by five different mechanisms in Home.** A flag patched in at the end (`unverified`, `homeEval.ts:563`), two flags that rewrite the finished result (`undecided`, `unsquared`, `:569`), a map over the facts (`differ`, `:793`), an added warn (`:795`), and `why` worked out again from the text (`whyOf`, five calls). Their order of application is whatever the code's order happens to be.

**(c) Trust facts are built by hand in about 45 places in 17 files.** `numeric.ts` 13, `homeEval.ts` 8, `host.ts` 7, `solve.ts` 3, and so on. Five carriers copy the facts field by field and drop what they do not name, against the rule in `engine/types.ts:14-17`: `state/results.ts:83` and `:90` (chips), `state/resultItem.ts:80`, `host.ts:786-787` (stored names), `engine/chipFacts.ts:74`. `apps/solve/app.svelte.ts:120` builds facts on the main thread from the digits shown. Two fields say the same thing: `inexact` in the facts and `inexactInput` on the history row.

**(d) The mark is changed after `markOf` in six places.** A fraction's own test for `=` and two downgrades (`state/displayMode.ts:242-247`); `units/result.ts:72` (a missing mark becomes `≈`); `clipboard/text.ts:141` (a missing mark is copied as `=`); a stored name's mark worked out apart, and stored as a mark (`find/names.svelte.ts:43`, `engine/defs.ts:19`); the "uses" line's literal `=` (`views/History.svelte:126`).

### 2.3 The one design

Three small engine modules and one caller on the main thread. No new concept: each one gathers what exists.

| Module | Takes | Gives | What moves in |
|---|---|---|---|
| `engine/trust.ts` (pure) | values, digit counts, reasons | `ValueFacts` | every facts literal: `exactFacts()`, `confirmed(n)`, `unchecked(why)`, `unaudited(names)`, `weaken(a, b)`, `inheritFrom(lent)` |
| `engine/rules.ts` | one context: the engine, the input and its tree, the exact output and value, `once`, the clock, the view | `refuse(code)`, `cap(why, to)`, `replace(value)` or nothing | the calls at `homeEval.ts:626-782` and `host.ts:983-1057`, as one ordered array; the helpers stay in their files |
| `engine/envelope.ts` | the parsed tree | inside or outside the range, and which limit | `MAX_EVAL_DIGITS` and the five other limits now in six files; `uncheckedPastCap` |
| `markFor` in `state/displayMode.ts` | facts, the form drawn, σ shown or not | the mark | the six places of (d); it is the only caller of `markOf` outside the engine |

**Where the range is defined and enforced** (your answer 1): defined as one constant in `envelope.ts` (longest literal in digits, largest power-of-ten exponent, nesting depth, node count). Enforced as the first entry of the rule list, on the tree Home already has. Outside the range the input is evaluated as now, and a result that is not exact gets `⚠` with the reason "outside the checked range". Nothing is refused, and an exact rational keeps `=`. The help text reads its four numbers from the same constant. The four values come from data, not from a guess: X9 records the shape of every false mark, and the range is the smallest box that holds none.

**What a new app calls**, for example Statistics: on the engine side, its method builds Giac text for each number and calls `homeEval` for it, as the Num table does today (`host.ts:1198`); the rule list, the range and the facts come with that call. On the screen, `renderNumeric` and `markFor`. It never calls `evalf` for a number it shows, and it never builds facts. A ratchet in the `rules` stage counts facts literals outside `trust.ts`, so a new one fails the gate.

**In steps of a day each**, each proven by the golden gate showing no changed text or mark: X12 (the trust module and the ratchet), X13 (one list of caps in Home and CAS), X15 (carriers pass facts whole), X14 (one rule list for Home, CAS and the unit view), X16 (one mark function), then X10 (the range). X5 fixes N1 before the tag with three direct calls; X14 replaces them.

### 2.4 Does this change M1?

The ranking: no. The recommendation: yes. The churn is not driven by missing rules any more. It is driven by rules meeting each other in an order nobody wrote down, in two copies. A boundary fixes that; a better numerical check (S20) would not. So: boundary first, the rate and the range with it, S20 after.

## 3. The launch

### 3.1 Every finding in a group

| Finding | Group | Why |
|---|---|---|
| M2 other browsers | before the tag | the site is announced for every browser; X1, X4 |
| N2 engine restart loop | before the tag | it is what a browser that cannot run the engine would show; X2, X3 |
| N1 unit view refusals | before the tag | an unmarked wrong value, bar point 3; X5 |
| N3 F-Droid bits | before the tag | the recipe builds the tag, so a fix must be in it; X6 |
| N4 unit names | before the tag if merged by Thu, else two weeks | ids are stored with user data; later needs a migration; X7 |
| B5 screen readers | known limit now, fix in two weeks | your answer 5; X8, X22 |
| M1 the checking layer | first two weeks | X9, X10, X12 to X16, and S20 |
| B1 what is drawn | first two weeks | X17 |
| B2 unit factors | first two weeks | after X7's ids; X18 |
| B3 number formatting | first two weeks | three small leaks; named as a limit now; X19 |
| B4 files from elsewhere | first two weeks | bounded harm; X20, X21 |
| B6 memory on a small phone | first two weeks | needs a device; X23 |
| M3 MathLive | first two weeks | WebKit is the iOS product; X24 |
| M4 module layers | first two weeks, last | a ratchet only; X26 |
| Pattern 1 prose rules | first two weeks | X19, X25; the i18n check waits for a second language |
| Pattern 6 two compilers | first two weeks | X27 |
| Pattern 2 decimal comma | later | the leaks go with X19; moving the comma into the formatter can wait |
| Pattern 5 engine API per app | later | X14 gives the pattern; do it with the first v1 app |
| Pattern 4 docs at budget | later | your process, not the app |
| B7 checks on pull requests, pattern 3 ids | later | your answer 4 |

### 3.2 Does it fit in five days?

The freeze is Thursday evening, so there are two lane days. My answer: the first six fit, the seventh may not.
- **Fits:** X1 changes no app code and runs by day on Wednesday. X2 and X3 are small. X5 is one day and is a bar item. X6 is two engine builds by day. X8 rides with A91 on Friday.
- **Depends:** X4 waits for X1's result.
- **At risk:** X7. If it is not merged by Thursday, ship with the limit named and take the migration later.
- **To make room:** move lane B's rows for extreme inputs behind these; none of them is a bar item.

**If WebKit fails or cannot run here:** do not move the tag. X4 shows one line at start in that browser, the release notes say the same, and the iPhone check (R225) stays the real gate. The same holds for Firefox.

### 3.3 What would hurt on launch day

- **The restart loop (N2), probed.** With a worker that fails every start by a memory error or a script error, the client created 96 workers in half a second and `ready()` never settled (`engine/workerEngine.ts:306-314`, `:337-339`). Three ways to get there: a browser that cannot give the wasm its memory; a stale page after a deploy asking for a worker file that is gone (likely around a v0.1.1 on 11-16); a browser without module workers. Each turn compiles 9.75 MB again.
- **The failed-engine note has no way on.** "The engine failed to start." with no cause and no Reload, and Enter still queues rows (`App.svelte:433`). No test covers it.
- **The service worker reads as sound.** No takeover under a typing user, engine files checked against their hash, a kill switch. One thing to watch: every first visit stores the whole build, 12.4 MB uncompressed. GitHub Pages has a soft limit of 100 GB a month (from memory), which is between about 8,000 and 30,000 first visits depending on compression. I did not measure what Pages compresses.
- **A browser that is not Chromium:** not run by me (ground rule). From the code, the needs are a module worker with dynamic `import()`, wasm exceptions and a 1 GB memory maximum. X1 is the answer.
- **F-Droid (N3)** is not a launch-day risk; acceptance takes weeks. `engine/giac/build-wasm-release.sh:8-9` says the compiler's output differs under address randomisation, so the release runs under `setarch -R`. The recipe calls `build-wasm.sh` without it (`fdroid/dev.n62.calc.yml:60`). With the Reproducible Builds box ticked, a mismatch means no publication.

### 3.4 The bar, where it is not really met

- **Point 3, "no known silent wrong number at everyday reach".** N1 is an unmarked wrong value the keys can type. Its reach is small (who types `1/(1/0)` with a unit), so you may name it as a limit instead; it should not stay unknown. Must-have A's first line ("No known silent wrong number [have]") is true only after X5 or with that limit named.
- **Point 2, "the net is green".** The net is Chromium. The bar has no line for the browsers the site is announced for. X1 adds one.
- **Point 6, "the words".** The known limits miss four lines: screen readers, browsers, the plot's axis labels, and the US unit names if X7 misses the tag. X8.
- **Point 7, "the frozen-for-good names".** Unit ids are stored with user data and are not on the list. After the tag a rename needs a migration step.
- **Now met:** "units and ± in the core list". The list has 70 cases and a `units` area (R170).

## 4. The packages and the lane order

All 27 drafts follow the format of `docs/shifts/packages/`. Ids X1 to X27 are placeholders. Line numbers are as of `5d91e0c4`.

**Before the tag**

| # | Agent | Package | After | Device |
|---|---|---|---|---|
| X1 | annabell | The core list in Firefox; the WebKit try moved up (replaces A110) | – | no |
| X2 | gorge | An engine that cannot start stops after two tries | – | no |
| X3 | ron | The engine-failed note says why and offers Reload | X2 | no |
| X4 | ron | A browser that has not passed says so at start | X1 | no |
| X5 | gorge | The unit view refuses what Home refuses | – | no |
| X6 | annabell | F-Droid's engine build matches the release engine | – | no (two builds under `host-cpu`) |
| X7 | gorge | A bare unit name is the metric or international unit | – | no |
| X8 | annabell | The known limits name what the review found | A91, X1, X7 | no |
| X28 | gorge | `solve` keeps the real root of a cubic (HUNT.md H2, S1) | – | no |

**First two weeks**

| # | Agent | Package | After | Device |
|---|---|---|---|---|
| X9 | gorge | A weekly false-mark rate, with the shape of every miss | – | no |
| X12 | gorge | Trust facts are built in one module | – | no |
| X13 | gorge | Home's vetoes go through one list of caps | X12 | no |
| X15 | gorge | Facts are carried whole to the chip, the store and back | X12 | no |
| X14 | gorge | One ordered rule list for Home, CAS and the unit view | X13, X5 | no |
| X10 | gorge | The range of `≈`: limits in one module, `⚠` by rule outside | X9, S20 | no |
| X11 | ron | The range in the help text and the why-line | X10 | no |
| X16 | ron | One function for the mark as drawn | X15 | no |
| X17 | gorge | What is drawn means what the engine answered | – | no |
| X18 | gorge | A second source for the unit factors | X7 | no |
| X19 | ron | No JavaScript number formatting; a check holds the rule | – | no |
| X20 | gorge | A backup's definitions and chips pass the library's check | – | no |
| X21 | annabell | A Content-Security-Policy | – | yes, the night's device for the core list |
| X22 | ron | A result is spoken as maths with its mark; zoom allowed | – | TalkBack look by day |
| X23 | annabell | The engine's memory limit on a small phone | X2 | yes, the Fairphone and an emulator |
| X24 | ron | MathLive's numbering as one test; a trial upgrade | X1 | no |
| X25 | annabell | The workaround register and its canaries are compared | – | no |
| X26 | annabell | A layer order for `app/src`, held by a ratchet | the tag | no |
| X27 | annabell | The sweeps also run on the engine that ships | the tag | no |

S20 exists already (`docs/shifts/packages/S20.md`) and needs only a day and a start.

**Proposed order** (importance first, then dependencies).
- **Lane B, to the freeze:** X28 (added by the third pass: an S1), X2, X5, X7.
- **By day, to the freeze:** X1 (Wednesday), X6; on Friday X8 with A91.
- **Lane A, to the freeze:** X3 (after X2), X4 (after X1).
- **Lane B, after the tag:** X9, X12, X13, X15, X14, X10, X17, X20, X18, X25, X21, X27, X26. S20 by day in the first week, since X10 waits for it.
- **Lane A, after the tag:** X19, X16 (after X15), X22, X11 (after X10), X24.
- **By day with a device:** X23.

**Decided (owner, 2026-11-10: "pick the recommended decisions").** The drafts carry these.
1. **CAS and `1/(1/0)`:** for a pure number (no free name) CAS refuses what Home refuses; with a free name it keeps Giac's algebra. The same typed number must not be "Division by zero" in one view and `0` in the other, and an exact CAS result has no mark to warn with. CAS already refuses a divergent integral and an underflow. In X14.
2. **Unit ids:** the explicit form stays `gal_US`, `gal_UK` (15 ids already have it, so the rule costs 14 renames and changes no explicit id). `hp` stays the mechanical horsepower and `bbl` the oil barrel; both say so in their Find title. In X7.
3. **The range's four limits:** the smallest box X9 measures with no false mark, rounded down to round numbers, and never below a floor: literals of 30 digits (the largest digits setting), powers of ten to 10^±30 (the SI prefixes' span), nesting depth 4, 200 nodes. If the measured box is narrower than the floor, X10 stops and asks you. In X10.

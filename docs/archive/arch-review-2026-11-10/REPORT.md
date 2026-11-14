# Architecture review of N62: major mistakes and blind spots

Snapshot: `phase-1` at `5d91e0c48c1698e75104701a8293fc9fdd533ff0` (2026-11-10 20:30), reviewed in a detached worktree. Read-only: no tracked file edited, no gate, build or device run. Every `file:line` below is at that commit. Counts come from `git log`, `grep` and two small scratch scripts. Four search agents gathered leads; each lead cited here was checked in the code by me, and the few things I could not check are marked "not verified".

## 1. Verdict

The architecture is sound for where N62 is going. I found no structural choice that has to be undone. The engine boundary, the worker and its restart path, the one shape for a value's trust facts, the storage layer and the oracle-based tests are better than most projects have after a year, and this one is a month old.

What I found are four structural costs that grow each week, and seven areas nothing watches. Act on these three first, in this order:

1. **Give the checking layer a written boundary and a trend number.** The code that decides the marks has tripled in four weeks and is still fixed about 45 times a week. Nobody measures whether that work is converging.
2. **Run the web app in Firefox and WebKit before it goes public.** iOS and desktop are planned as this web app, and every test runs Chromium only. The site goes live with the v0.1.0 tag.
3. **Check what is drawn and what is looked up, not only what is computed.** Symbolic results are redrawn by regex with no check on their meaning, and 403 of 439 unit factors rest on one source and are shown as exact.

## 2. Major issues

### M1. The checking layer has no boundary and no measure of convergence

**Claim.** The TypeScript code in `app/src/engine` that decides what Giac's answers are worth (I call it the checking layer) grows by one special case per finding, and nothing says when it is done.

**Evidence.**
- Size of `app/src/engine` without tests: 3,649 lines in 14 files on 10-17, 8,249 in 31 on 10-24, 9,994 in 44 on 10-31, 10,689 in 52 on 11-07, 11,555 in 57 at the snapshot.
- `fix` commits that touch that code, per week: 12, 99, 43, 48, and 41 in the four days from 11-07 to 11-10. The rate is not falling. `host.ts` and `homeEval.ts` each appear in 83 fix commits, `numeric.ts` in 54.
- Of 217 merged engine packages (ids starting with G), 80 are follow-ups (`f1`, `f2`): 37%. For the UI packages it is 55 of 191.
- Giac patches: 2 on 10-24, 19 on 10-31, 35 on 11-07, 40 now. They add 1,464 lines of C++, mostly in `usual.cc` (19 patches) and `gen.cc` (11).
- The layer talks to Giac mostly as text: 187 `.eval(` call sites plus 134 `ev(` calls in `solve.ts`, `solve1.ts` and `analysis.ts`, against 28 lines that use the structured bridge (`bridge.ts`). About 30 kB of programs written in Giac's own language sit inside TypeScript strings (`icdf.ts:51`, `units/evaluate.ts:87`, `homeEval.ts:147`).
- The check itself has a known hole. Two evaluations at P and P + 20 digits can lose the same term, so they agree on a wrong value. `tests/golden/sweep-nightly-known.yaml` says so in its own comment: "P and P+20 share the lost 10^-k term … (S20 the cure)".
- The project's own end mark is unmet: "a 50,000-input sweep with no new false mark, is not met" (`docs/backlog.md:81`).
- S20, the interval-arithmetic spike that would test a principled check, could start once G85 had reported. G85 merged on 2026-10-22 (`8861b6dc`). S20 is still "hands-on. No package yet" (`docs/shifts/brief.md:20`).

So the answer to "do the TypeScript workarounds form a second engine" is yes, in size. It is not hidden: decision P18 names it. What is missing is a risk line and a budget for it.

**Consequence and when.** Three things, all already visible.
- Cost now. About four in ten merged packages are engine packages, and the brief plans 1,800 more packages on a quarter of the usage. Without a boundary, extreme inputs can absorb any amount of that.
- Latency now. One Enter makes about 8 Giac calls (`tests/golden/calls-baseline.yaml`: 2,640 calls for 325 inputs). `docs/04-architecture.md:442` records 147.9 ms on the Tab One against a 150 ms budget at 12 digits. Each new check spends from a budget with 2 ms left.
- Growth later. Every v1 app (Statistics, Finance, Inference) brings function families that need the same audit, decision lists and patches. A Giac upgrade must re-prove every place that reads Giac's printed text. The golden gate would catch breaks, so an upgrade is safe, but it is a project of days.

**Fix now or later.** Now it costs a measurement, one spike and one decision: about three days. Later the same decision comes after hundreds more special cases, each with tests pinned to its exact behaviour.

**Recommendation.** Write down what `≈` promises and measure against it every week. In practice:
1. One number per week: false marks per 10,000 generated inputs on a fresh seed, split into everyday-shaped and extreme-shaped inputs. If the everyday number is zero for three weeks and the extreme number is flat, the patching is not converging and the design has to change.
2. A stated envelope: the input sizes inside which `≈` is guaranteed (digits of a literal, size of an exponent, nesting depth). Outside it the result is `⚠` by rule, with no further case-by-case work. G141 already did this for literals past `MAX_EVAL_DIGITS`; make it the general rule.
3. Run S20 this week. Its report says whether intervals can replace the agreement check where a function supports them.

**Confidence.** High on the growth figures. Medium on whether intervals pay off; S20 exists to answer that.

**New or known.** Known in parts (S20; `docs/04` section 9 risk 1). I think it is mis-prioritised: it is treated as a research item while it is the largest single consumer of the project's effort.

### M2. iOS and desktop are planned as the web app, which has only ever run in Chromium

**Claim.** The route to iPhone and desktop is the PWA, and no test, device run or plan line has put it in WebKit or Firefox.

**Evidence.**
- All three Playwright configs have one project, Chromium with the Pixel 7 profile: `app/playwright.config.ts:19`, `app/playwright.pwa.config.ts:18`, `app/playwright.gallery.config.ts:19`. Device runs use Android's WebView, also Chromium.
- `docs/must-have.md:150` says it plainly: "web app on iPhone unverified, Chromium only". The work (S51, A110, R225) is ordered for v0.5 to v1. Decision 7 there recommends iOS as the web app only.
- Firefox appears in no package, and not in the backlog, the must-have list or the release bar.
- `.github/workflows/pages.yml:22` deploys the site on every `v*` tag. So n62.dev becomes public with v0.1.0 on Sun 11-15.
- The entry workarounds were found and tuned on Chromium. `docs/research/r6-pipelines.md` section 7 lists them: the 60 ms focus timer, the second caret placement on touch, the delete behaviour per template. Each is a statement about one browser engine.
- `engine/giac/build-wasm.sh:245` sets `MAXIMUM_MEMORY=1GB`. Whether iOS Safari reserves that at start is not verified.
- The too-old notice tells every browser to update "Android System WebView / Chrome" (`app/index.html:52`).
- On a laptop the first thing a visitor does is type. Typed `sin(1)` becomes `s*i_*n*(1)` with no error (`docs/backlog.md:51`, F199, a named limit).

**Consequence and when.** At v0.1.0: the post invites the HP crowd, many of them on iPhones and on Firefox, to a page that has never been opened there. A failure is public and looks like a broken app. At iOS and desktop: each week adds code that assumes Chromium, and each one is found later, one by one, on a platform with no automated run.

**Fix now or later.** Now: half a day for a Firefox project that runs the core list, plus the time-boxed WebKit try that A110 already describes. Later: the same work plus the triage of everything written in between.

**Recommendation.** Before the tag, run the core list in Firefox and do A110. For any browser that has not passed, show one honest line at start ("tested on Chrome and Android; other browsers may misbehave") rather than nothing.

**Confidence.** High that nothing covers it. Unknown how much breaks; that is the point.

**New or known.** Known for iOS (mh-C7, A110), new for Firefox. Mis-timed: the public site makes it a v0.1.0 matter.

### M3. Entry editing depends on MathLive's undocumented cursor numbering, pinned to one version

**Claim.** About 2,000 lines of entry code rebuild MathLive's internal structure from offsets and serialised strings, so a MathLive upgrade is a project rather than a version bump.

**Evidence.**
- `app/src/entry/boxes.ts:6` says "Public MathLive API only: offsets and `getElementInfo`". Lines 8 to 11 then describe how MathLive numbers a line (an atom's parts come before the atom, one level deeper, each branch starts with an empty sentinel). That numbering is not a documented contract.
- Calls that depend on it: 164 (`boxes.ts` 82, `delete.ts` 49, `field.ts` 16, `stops.ts` 8, `hwkeys.ts` 7, `numberRun.ts` 2).
- Comments cite line numbers in MathLive's bundle (`app/src/entry/delete.ts:97`: "`onDelete`, mathlive.mjs 31863").
- `app/src/entry/namemarks.ts:18` and `:42` read MathLive's CSS class names inside its shadow DOM. `app/src/render/macros.ts:1-6` mounts a throw-away field to read MathLive's default macro table, because 0.111.1 exports none.
- The pin is exact: `app/package.json:36`, `"mathlive": "0.111.1"`. Four upstream issues are open (#3122 to #3125, `docs/backlog.md:32`).

**Consequence and when.** Nothing breaks today. The pin and two good tests hold it: `bksp-grid.spec.ts` and `cursor-grid.spec.ts` drive real MathLive over every template. The cost comes when an upgrade is needed: for a WebKit fix on the way to iOS (M2), for a security fix, or when one of the four issues is fixed upstream and a workaround starts to fight the fix. The grids would turn red in many places at once and would not say which assumption moved.

**Fix now or later.** A one-day spike now sizes the gap while the workarounds are few and fresh. After a year of further workarounds the same upgrade is weeks.

**Recommendation.** Treat MathLive as a vendored part with a contract test. Write one small test that states the numbering assumptions directly (the offsets of a fixed line, the sentinel, the serialised forms the code matches), in the manner of `tests/engine/patch-canary.ts`. Then try the current MathLive release once, on a branch that never merges, and record what fails.

**Confidence.** High on the coupling. Medium on the cost of an upgrade, which the spike would measure.

**New or known.** New. `docs/04` section 9 risk 6 covers the entry rules drifting apart, not the version lock.

### M4. Only the engine boundary is enforced; the rest of the module graph is unruled

**Claim.** One dependency rule exists and holds (engine code imports no UI). Between the other directories there are 16 two-way dependencies and no rule.

**Evidence.**
- `app/scripts/import-rules.ts` checks three things, all about the engine and the start chunk. It is a good rule and it passes.
- My import graph of `app/src` (value imports, tests left out) finds 16 pairs of directories that import each other (18 with the top-level files), among them `state`/`views`, `state`/`render`, `render`/`entry`, `clipboard`/`state`, `keyboard`/`state`, `units`/`state`, `units`/`find` and `engine`/`units`.
- Examples: state code imports a Svelte view (`app/src/state/handOver.ts:8`). The LaTeX tidy module re-exports from state and from clipboard (`app/src/render/tidy.ts:8`, `:11`). State formats through render (`app/src/state/displayMode.ts:25`). The unit evaluator lives in `units/` but runs in the engine worker, by a listed exception (`ENGINE_EXCEPTIONS` in `import-rules.ts`).
- `units/` imports from eleven other directories and is imported by seven.
- A symptom: `app/scripts/size-check.ts` has changed in 109 commits, and the line that pins the start chunk in about 67. The pin stands at 61,100 bytes gzip against a 63 kB budget. With no layers, any import can pull code into the start chunk, so the pin is negotiated package by package.

**Consequence and when.** Today it costs pin churn and makes every package slightly riskier. It bites at the second shell: a tablet or desktop layout (R224) wants the state and logic without the phone views, and they cannot be separated cleanly. It also bites when a human contributor tries to change one area.

**Fix now or later.** Now: one day for a declared layer order and a baseline of today's violations that may only go down. That is the pattern the project already uses for text matches, call counts and sizes. Later: untangling by hand before the desktop layout can start.

**Recommendation.** Extend `import-rules.ts` with a layer order and a ratchet. Do not refactor now. Let each package that touches a violation remove it.

**Confidence.** High on the graph. Medium on how soon it hurts.

**New or known.** New.

## 3. Blind spots

**B1. What is drawn for a symbolic result.** *Why blind:* every CAS result and every symbolic Home result is Giac's `latex()` output rewritten by about twelve regex passes (`app/src/render/tidy.ts:190-206`). One pass removes product signs (`tidy.ts:127-132`). Its tests are frozen strings "printed in the engine build of 2026-10-11" (`app/src/render/render.test.ts:2`) and 6 live cases (`casProducts.test.ts`). No gate stage looks at the drawn form: none of the sweeps imports the tidy step. *What could go wrong:* a right answer drawn as a different expression. That is a wrong answer to the user, and no layer would see it. It is also reused: a result too long for a chip (over 2,048 characters, `state/results.ts:14`) goes back on the line "as drawn" (`app/src/App.svelte:201`). My probe of 35 CAS results found no wrong drawing. It did show how thin the margin is: the name `ab` and the product `a·b` draw as `\mathrm{ab}+ab`, told apart only by upright against italic type. *Smallest step:* a gate stage that takes the corpus and the sweep's trees, draws each result, reads the drawing back through the parser and compares values; what the parser cannot read is counted as its own class. New.

**B2. Unit factors rest on one source and show `=`.** *Why blind:* `find/factors.yaml` tags each row's source. Of 439 unit rows, 36 are "exact definition" and audited by the `checks:` list in `find/units.yaml`. The other 403 say "libqalculate 5.13.1", which means qalc's own number; 186 of those are not a plain power of ten. Spot probes have already found three data errors in that source (libqalculate #1043 to #1045). *What could go wrong:* a conversion with a wrong or surprising factor, shown with the strongest mark. Example of the surprising kind: `tsp` is 1/200000 m³, the 5 mL metric teaspoon; the US teaspoon is 4.92892 mL. That is a naming choice nobody signed. *Smallest step:* a dev-time script that compares the 186 factors with a second database (GNU Units' definitions file, or the NIST SP 811 tables) and lists every difference for the owner. Partly known (`docs/04` section 9 risk 3); the audit of the remainder is not planned.

**B3. The display edge.** *Why blind:* "Use engine formatting, never JS `Number.toString()`, for anything shown to users" (`docs/rules-core.md:38`) lives in prose only. The `rules` stage counts regex lines in `src/engine` and `src/units` (`app/scripts/text-rules.ts`), nothing about number formatting, and the repo has no linter. *What exists today:* three leaks. Plot axis labels come from JSXGraph's own formatting of doubles (`apps/function/FunctionPlot.svelte:69-83`). Solver bracket points go through `String(x)` at a fixed 12 digits (`engine/solve1.ts:75-77`, used at `:350`). A residual is printed with `toExponential` (`engine/solve.ts:299`). Also the history's "uses" line prints a stored value after a literal `=` (`views/History.svelte:126`), while Find works out `≈` or `⚠` for the same value (`find/names.svelte.ts:43-56`). None is a wrong number. All show the rule is unenforced, and none follows the decimal comma. *Smallest step:* a check in the `rules` stage with an allow-list, and the four fixes. New.

**B4. Files from elsewhere.** *Why blind:* two import doors have different locks. A library file is parsed and refused if it holds a state-changing or string-evaluating command (`engine/stores.ts:21-34`). A backup file's definitions are checked for shape only (`state/backup.ts:221`, `engine/defs.ts:103-131`) and their commands are replayed as Giac text at every start. A chip's value is passed to Giac in brackets unless it holds `;` or `:=` (`input/chip-giac.ts:32-46`). The replay has no watchdog (`engine/workerEngine.ts:138`; the watchdog is armed only for Home and unit calls, `:370`). There is no Content-Security-Policy anywhere, and the page injects MathLive markup built from stored LaTeX (`render/Math.svelte:36`). *What could go wrong:* Giac in wasm has no file system and no network, so the harm is bounded: a crafted or damaged backup can redefine the user's functions, purge names, or hang each start until two kills trigger the safe start. On the web build an injected script could reach the network. On Android the app's own manifest asks for no INTERNET permission (the merged manifest was not checked). *Smallest step:* run the library's check over a backup's `defs` and chip values, and add a CSP meta tag that allows only the app's own origin and wasm. The CSP also turns "nothing is sent" from a promise into something a browser enforces. New.

**B5. Screen readers.** *Why blind:* no automated accessibility check exists, and the TalkBack look is a pending manual item (`docs/backlog.md:91`). *What exists today:* the spoken name of every input and result is its LaTeX source (`render/Math.svelte:35`, `aria-label={note || label || latex}`; History passes no label). The mark is a separate element whose meaning is only in a `title` (`views/History.svelte:238`). Zoom is switched off (`app/index.html:6`, `user-scalable=no`). The keys themselves are named well. *Smallest step:* build the label from MathLive's speakable text plus the mark in words, and decide about zoom. Partly known (R41's device check).

**B6. Memory on a small phone.** *Why blind:* the heap cap is 1 GB and never shrinks until the worker restarts (`build-wasm.sh:245`). The cap was checked once, by hand, on the tablet (`tests/core/ONE-TIME.md:8`); the automated test runs in Node (`tests/engine/memcap-test.mjs`). *What could go wrong:* on a phone with little RAM, Android may kill the WebView's renderer before the wasm cap is reached. Our Android code has no handler for that (no `onRenderProcessGone` under `android/app/src/main`); what Capacitor does by default is not verified. The engine's clean "Out of memory" path would then never run. *Smallest step:* the ONE-TIME check repeated on the Fairphone and on one low-RAM device or emulator, with the outcome written down. Confidence: low to medium.

**B7. One machine.** *Why blind:* GitHub runs only the release and Pages workflows, on tags. Every gate runs on one desktop. *What could go wrong:* after the launch an outside pull request gets no check at all, and a dead machine stops every gate. *Smallest step:* a workflow on pull requests with typecheck, the quick Vitest run and the docs check. Known (C3, `docs/backlog.md:101`, waiting for the owner's OK); the public launch raises its value.

## 4. Systemic minor patterns

1. **Rules that live in prose.** The project's strongest habit is the ratchet (text matches, calls per Enter, chunk sizes). Several rules have none. Number formatting (B3). "User-facing strings go through the i18n table": 29 `LibError` messages in `engine/library.ts` and about 20 solver and analysis messages are English literals shown to users. "Every workaround has a canary": the register has 21 rows and `tests/engine/canaries.mjs` has 20; `cdf-double` has none, and nothing compares the two lists. "The UI never builds Giac text": `state/session.svelte.ts:308` and `state/cycleForms.ts:52-55` do. "Raise `DATA_VERSION` when the meaning of stored Giac text changes" (`state/storage.ts:26-31`): nothing detects a change.
2. **The decimal comma is applied by rewriting text after formatting** (`commaResult` in `state/displayMode.ts`), at each place that shows a number. Places that miss it: plot axes, solver info lines, the uncertainty in the why-line (`clipboard/whyLine.ts:24`), the "uses" line, Find's constant preview (`find/finder.ts:106`).
3. **Reasons are kept as ids.** Non-test source holds 3,830 references to 451 package ids (`R18f1`, `G49`). Package files are deleted at merge, and some ids match no merge subject. An agent with a bundle copes; a human contributor after the launch cannot follow a comment to its reason.
4. **Shared docs sit at their byte budgets.** `docs/decisions.md` is 39,999 of 40,000 bytes. In a month `backlog.md` changed in 783 commits, `decisions.md` in 541, `brief.md` in 520. The must-have list says an answer "stays here until a trim makes room". Decisions end up where there is space, which is how docs and code drift apart.
5. **The engine interface grows one method per app.** `solve`, `analyze`, `table` and `units` each run through `types.ts`, `protocol.ts`, `host.ts`, `workerEngine.ts`, `calc/port.ts` and `calc/engine.ts`. `host.ts` is 1,313 lines with 138 commits. The v1 apps would each add more.
6. **Two compilers.** Development and all five sweep stages use emsdk 6.0.12. The shipped engine is built with Debian's Emscripten 3.1.69. `tools/release-gate.sh` runs golden, the canaries and the core list on the shipped build, which is the important part. The sweeps, which find the false marks, never run on it.

## 5. What is solid

- **The worker boundary.** All maths goes through `MathEngine`; Cancel terminates and replays the definitions log; a crash takes the same path; two failed starts lead to a safe start; Home and unit calls have a watchdog (`engine/workerEngine.ts`). I found no hole in the restart logic.
- **One shape for trust.** `ValueFacts` is carried whole (`engine/types.ts:19-49`), and one function decides the mark (`markOf`, `engine/format.ts:411`). A float from a function nobody audited is `⚠` by default. That default is the right way round.
- **Exact first, own formatter.** Decimals become rationals, and numbers are formatted from BigInt digits, never from doubles.
- **Independent expected values.** mpmath as oracle, the generated sweeps, the check-back of CAS answers, one value across all views, the census of Find's functions, and canaries for every patch.
- **Storage.** Stamped values, migrations on read, no write after a failed read, no write over a newer version, one writing tab, a backup with Undo, and an update test from a real old snapshot (`app/test/update.spec.ts`).
- **The parser accepts only what the keys type** and refuses the rest; every template must have a sample that parses (`keyboard.test.ts`).
- **The engine import rule and the ratchets** (text matches, calls per Enter, chunk sizes).
- **The build.** Pinned container, checksummed tarballs, a mirrored Giac pin, bit-reproducible wasm, and patches sent upstream and being merged there.
- **Lazy loading with a size budget**, and Find as a static index built from data, with libqalculate kept at build time.
- **The core list** on every merge and on a device.
- **The app registry** (`apps/registry.ts`, `AppHost`): a new app has a clear place to go.
- **No network.** The only `fetch` calls are same-origin, and the app's Android manifest asks for one permission, VIBRATE.

## 6. Candidate packages

Ordered by importance. Each is one concern and about a day or less. These are proposals only.

| # | Package | Done when | Depends on |
|---|---|---|---|
| 1 | **Core list in Firefox; the WebKit try (A110) now** | A `firefox-phone` project runs `core.spec.ts` and its result is in the report; A110's first line is one of its three; a start note shows in any browser that has not passed | none; before the tag |
| 2 | **A weekly false-mark rate** | One line per week in a tracked file: seed, trees, false marks, split everyday and extreme; the first two weeks are recorded | none |
| 3 | **S20 as written** | Its own done-check (containment, share of cases, size, time, go or no-go) | none since 10-22 |
| 4 | **The envelope of `≈`** | The limits are constants in one module; an input outside them is `⚠` by rule; the limits are stated in the help text; open extreme-input rows outside the envelope are closed as "by rule" | owner's answer to question 1; packages 2 and 3 |
| 5 | **Draw-back check** | A gate stage draws each result of the corpus and the sweep's seed, reads it back through the parser and compares values; unreadable drawings are counted in a known list that may only shrink | none |
| 6 | **Second source for unit factors** | A dev-time script lists every one of the 186 non-trivial libqalculate-only factors that differs from the second database; the owner signs the list of naming choices (teaspoon, ton, gallon, calorie) | none |
| 7 | **Number formatting in the `rules` stage** | `toFixed`, `toExponential`, `toPrecision` and `String(number)` fail outside an allow-list; the three leaks and the literal `=` are fixed; red first | none |
| 8 | **Layer order with a ratchet** | `import-rules.ts` holds a declared order and a baseline of today's violations; a new violation fails the gate | none |
| 9 | **MathLive contract test and a trial upgrade** | One test states the numbering assumptions; a report lists what the current MathLive release breaks; nothing merges but the test | none |
| 10 | **One check for every file that brings Giac text** | A backup's `defs` and chip values pass the library's check or the restore is refused; a test with a crafted file | none |
| 11 | **Content-Security-Policy** | A CSP meta tag allows the app's origin and wasm only; the PWA tests pass; a test proves an inline script is blocked | none |
| 12 | **Spoken results** | A result's label is its spoken form plus the mark in words; `keylabels.spec.ts` gains a case for a history row | owner's answer to question 5 |
| 13 | **Register against canaries** | A test fails when a README register row has no canary row; `cdf-double` gets one | none |
| 14 | **Checks on pull requests** | A workflow runs typecheck, quick Vitest and the docs check on a pull request | owner's OK (C3) |

## 7. Questions for the owner

1. **Does `≈` promise every digit for anything the keys can type, or within a stated range of inputs?** If the first, M1 needs S20 or something like it to succeed. If the second, the envelope (package 4) ends most of the extreme-input work.
2. **Is n62.dev announced on 11-15 for every browser, or for Chrome and Android?** If for every browser, package 1 belongs before the tag. If not, the start note is enough for now.
3. **Is iOS the web app for certain** (must-have decision 7)? If yes, WebKit is the iOS product and M2 moves up; if a native shell is still possible, it can wait for that decision.
4. **Will the launch invite outside contributors?** If yes, the ids in comments (pattern 3) and the missing pull-request checks (B7) matter now. If the agents stay the only authors, both can wait.
5. **Is a screen-reader user in scope before v1?** If yes, package 12 and the zoom setting belong in v0.2. If no, say so in the known limits.
6. **Which convention do ambiguous unit names follow** (US or metric teaspoon, long or short ton)? The answer decides how package 6's differences are settled.

## 8. Coverage

**Read in full:** `docs/rules-core.md`; `docs/04-architecture.md` sections 0, 6, 7, 8 and 9; `docs/research/r6-pipelines.md`; `docs/backlog.md`; the agent files; `engine/types.ts`, `engine/workerEngine.ts`, `state/storage.ts`, `state/migrations.ts`, `calc/shown.ts`; the gate's stage list (`app/scripts/gate.ts`); `import-rules.ts` and `text-rules.ts` (the rule parts); `tools/release-gate.sh`.

**Read in part:** `engine/format.ts` (the mark and the confirmed-digit code), `state/displayMode.ts`, `render/tidy.ts`, `render/Math.svelte`, `views/History.svelte` (the result row), `keyboard/route.ts` (header), `apps/types.ts`, `apps/registry.ts`, `calc/port.ts`, `state/backup.ts` (validators), `engine/defs.ts` (`validDefs`), `input/chip-giac.ts`, `find/factors.yaml` and `find/units.yaml` (headers and counts), `docs/must-have.md` (the head and section A), `docs/shifts/brief.md` (section 0), the golden files' headers.

**Measured:** line counts and the import graph of `app/src`; churn, fix commits and follow-up ids from `git log`; engine size and patch count per week; who merges into each directory. One scratch probe put 35 CAS inputs through the tidy step, on the main checkout's dev engine, whose patch level against this snapshot I did not check.

**Through search agents, then checked by me where cited:** number formatting outside the engine; Giac knowledge outside the engine and the patch register; MathLive use and the round-trip tests; accessibility, i18n, paste, import and Android settings.

**Not reached:** the content of the 40 Giac patches (names and sizes only); the internals of `host.ts`, `homeEval.ts`, `numeric.ts` and `units/evaluate.ts` beyond their structure; the Find ranking code; the service worker; the two Java plugins; the theme system; the F-Droid recipe; `docs/02`, `docs/03`, `docs/05`. The pipeline scripts were out of scope by the prompt. I ran no gate, no e2e suite and no device, so every statement about test behaviour comes from reading the tests, not from running them.

**Lenses with nothing major:** state and persistence (lens 4) is sound. Cancellation and worker death (part of lens 2) are sound. Build and release (lens 8) is sound apart from pattern 6 and B7. Performance (lens 7) is watched by budgets; the one unwatched part is B6.

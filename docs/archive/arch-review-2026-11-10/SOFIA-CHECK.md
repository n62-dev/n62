# sofia: check of X1 to X8 (2026-11-10)

Read-only. `phase-1` is still `5d91e0c4`, so every cited line number holds; no merge touches a cited file. Ran: `tools/probes/unit-result.ts` and `tools/probes/engine.ts` (dev engine, `GIAC_OUT=…/engine/giac/_out/gsl`), two scratch Node probes (WorkerEngine with a fake worker; `giac.mjs` with a missing wasm, through `deadEngine`), and `podman run --pull=never` of the release image's digest running `setarch -R true`. Not run: gate, e2e, Vitest, golden, any engine build, any device.

| | Verdict | One line |
|---|---|---|
| X1 | FIX | Its own config file, not a project in the default one: four callers would pick Firefox up. |
| X2 | FIX | The claim holds (440 workers in 500 ms here). But the start failure is classed wrong: a missing wasm comes out as "memory" and Chrome's real memory error as plain. |
| X3 | FIX | The route glob misses the dev server's `giac.wasm`, and the "invalid wasm" memory test would pass for the wrong reason. |
| X4 | FIX | Linux WebKit passing must not hide the note on iOS. The user-agent tests must set both sources. Also the inline-script size pin. |
| X5 | FIX (small) | The claim holds. Use Home's order of the three calls, and run it ahead of G316, which changes the same function. |
| X6 | FIX | `setarch -R` is refused under a default seccomp profile, so the draft's fallback can break F-Droid's CI. The draft also conflicts with a decisions.md line. |
| X7 | FIX | Three more bare US ids (`gpm`, `gph`, `gal/s`). The "typed bare gal" row tests a path no user has. The shown symbol is not covered. |
| X8 | FIX | Fold it into A91 (same branch, same file, same test). As a package, its red test fails on a file that does not exist yet. |

## X1: FIX

**Claim true.** `app/playwright.config.ts:19`, `playwright.pwa.config.ts:18` and `playwright.gallery.config.ts:19` each have one Pixel 7 project. No plan line names Firefox. Pages deploys on `v*` (`.github/workflows/pages.yml:21-22`).

**Problem.** A second project in `playwright.config.ts` is picked up by every bare `playwright test`. The draft fixes only `package.json` and `gate.ts`. It misses `scripts/pipeline.sh:706` (the red-first e2e run, `npx playwright test "$@"`), `scripts/pipeline.sh:379`/`:765` (via `test:e2e`) and `tools/release-gate.sh:57` (via `test:core`). Firefox would enter every red-first run and the release gate. A separate config file avoids all of that, and A110 already does the same for WebKit.

**Host note.** The host is now Ubuntu 24.04 under WSL2, not the EL10 of A110's text, so Playwright's WebKit is supported there. `install-deps` still needs root.

Edits:
- Old: `1. **Firefox:** \`npx playwright install firefox\`. A project \`firefox-phone\` in \`app/playwright.config.ts\`: \`browserName: "firefox"\`, the Pixel 7 viewport and \`hasTouch: true\` (Firefox takes no \`isMobile\`, so the device preset cannot be spread whole). It is not in the default run: \`npm run test:e2e\` and the gate keep Chromium only (\`--project=chromium-phone\` in \`package.json\` and \`app/scripts/gate.ts\`), and a new script \`test:core:firefox\` runs \`test/core.spec.ts\` with \`--project=firefox-phone\`.`
  New: `1. **Firefox:** \`npx playwright install firefox\`. A new \`app/playwright.firefox.config.ts\` imports \`playwright.config.ts\` and replaces \`projects\` with one project \`firefox-phone\`: \`browserName: "firefox"\`, the Pixel 7 viewport and \`hasTouch: true\` (Firefox takes no \`isMobile\`, so the device preset cannot be spread whole). \`app/playwright.config.ts\` does not change, so every caller of \`playwright test\` stays Chromium only (the gate, \`test:e2e\`, \`test:core\`, \`tools/release-gate.sh\`, the red-first run at \`scripts/pipeline.sh:706\`). A new script \`test:core:firefox\` runs \`test/core.spec.ts\` with \`-c playwright.firefox.config.ts\`.`
- Old: `(the host first, then once the official Playwright container)`
  New: `(the host first, then once the official Playwright container; the host is now Ubuntu 24.04 under WSL2, not A110's EL10, but \`npx playwright install-deps\` needs root, so without the libraries the container is the try)`
- Old: `the Chromium runs and the gate are unchanged (\`npm run gate -- --quick\` passes; the e2e stage's command names its project);`
  New: `the Chromium runs and the gate are unchanged (\`npm run gate -- --quick\` passes; \`app/playwright.config.ts\` has no diff); \`docs/release-0.1.0.md\` point 2 gains one sentence with the two lines (a browser that did not pass is named in the known limits, A91);`

## X2: FIX

**Claim true, reproduced.** A scratch probe ran `WorkerEngine` with a fake worker for 500 ms:

| Fake worker's answer | Workers started | `ready()` |
|---|---|---|
| `fatal` with `dead: "memory"` | 440 | pending |
| `fatal` with `dead: "crash"` | 447 | pending |
| `onerror` | 445 | pending |
| plain `fatal` | 1 | rejected |

The cause is as cited: `restartAfterCrash` (`workerEngine.ts:308-314`) always calls `start()`. The G19 cap needs `this.log.length` (`:311`), and `ready()` waits for the replacing start (`:220-229`).

**Missing: the start failure is classed by `deadEngine`, which was written for a running engine.** Two measured cases:
- `giac.mjs` with a missing wasm throws `RuntimeError: Aborted(Error: ENOENT … giac.wasm)`, and `deadEngine` gives **`memory`**, because of the `^Aborted` rule (`dead.ts:28`). A browser fetch failure is also an `Aborted(…)`.
- Chrome's real memory failure, `RangeError: WebAssembly.Memory(): could not allocate memory` (wording from memory), gives **`null`**: a plain error, so the start counts as a load failure.

`onerror` is always wrapped in `EngineMemoryError` (`:338`), so a stale worker script after a deploy also reads as "memory". After X2 as drafted, X3 would tell a visitor with a network failure "not enough memory", and a phone that really is short of memory "check the connection".

Edits:
- After the bullet `- \`dead: "crash"\`: rejects with \`EngineCrashError\`;` add:
  `- the kind of a failure before \`ready\` comes from when it happened, not from \`deadEngine\` alone (\`dead.ts\` classes a running engine). A failed \`init\` or an \`onerror\` before \`ready\` is a new \`EngineLoadError\`, unless its message names memory (\`out of memory\`, \`cannot enlarge memory\`, \`could not allocate memory\`); then it is \`EngineMemoryError\`. Cases with real texts: \`Aborted(Error: ENOENT: no such file or directory, open '…/giac.wasm')\` (measured on 2026-11-10 with the dev engine; today \`deadEngine\` says \`memory\`) → load; \`Aborted(both async and sync fetching of the wasm failed)\` → load; \`RangeError: WebAssembly.Memory(): could not allocate memory\` (Chrome, from memory; today \`null\`) → memory; an \`onerror\` with an empty message (a worker script that is gone) → load. \`deadEngine\`'s cases for a running engine stay unchanged;`
- Old: `reject \`readyPromise\` and every later call with the failure.`
  New: `reject \`readyPromise\` and every later call with the failure, as \`EngineLoadError\`, \`EngineMemoryError\` or \`EngineCrashError\` (\`types.ts:245-262\` gains the first). X3 reads the class.`

Size: under a day, one concern, Opus, lane B. Owner (gorge, engine client) is right.

## X3: FIX

**Claim true.** The note is `en.ts:75`, drawn at `App.svelte:433`. `engineState = "failed"` is set at `session.svelte.ts:270-272`. `submit` (`:440`) never looks at `engineState`. No spec in `app/test` or `app/test-pwa` hits `engine.error` or `engine-note`.

**Problems.**
1. The e2e server is Vite's dev server (`playwright.config.ts:12`), which serves the plain `giac.wasm` (`vite.config.ts:12`). The glob `**/engine/giac.*.wasm` never matches it, so the test is red before and after the fix.
2. No spec yet routes a request made inside the worker; every `page.route` in `app/test` targets the page's own modules. The test must prove the route is hit.
3. "A tiny invalid wasm" fails as `Aborted(CompileError …)`. Today that reads as memory (see X2), so the memory test would pass for the wrong reason.

Edits:
- Old: `the route \`**/engine/giac.*.wasm\` is aborted:`
  New: `the route \`**/engine/giac*.wasm\` is aborted (the e2e server serves the plain \`giac.wasm\`; the test first asserts that the route was hit, since no spec has yet routed a request made in the worker; if Playwright does not see it, a \`page.addInitScript\` stub of \`Worker\` fires \`error\`, as \`oldwebview.spec.ts\` stubs features):`
- Old: `the worker answers with a memory failure (a route that serves a tiny invalid wasm, or \`window.n62\` driven as the unit test does):`
  New: `the worker answers its \`init\` with a memory failure (an \`addInitScript\` stub of \`Worker\` that posts \`{ type: "fatal", dead: "memory", message: "out of memory" }\`; not an invalid wasm, which is a load failure):`
- Old: `\`Session\` keeps the failure's kind (\`load\`, \`memory\`, \`crash\`) beside \`engineState\`;`
  New: `\`Session\` keeps the failure's kind (\`load\`, \`memory\`, \`crash\`) beside \`engineState\`, from X2's error class, never from the message text;`

Size: under a day. Order: after X2 is right.

## X4: FIX

**Claim true.** `index.html:52` tells every browser to update "Android System WebView / Chrome".

**Problems.**
1. If Linux WebKit passes in X1, the constant would list WebKit, and an iPhone visitor would see no note even though iOS is unverified. The owner's iPhone check, R225, is the real gate, as A110 and X1 both say.
2. The draft reads the engine from `userAgentData` and from the user-agent string. A Chromium test with a spoofed user agent keeps whatever Chromium reports in `userAgentData`, so the result depends on which one wins.
3. The text change lands in an inline script, and inline scripts are pinned at 1.53 kB gzip (`size-check.test.ts:54-55`).

Edits:
- Old: `holds the list of passed engines as one constant with the commit X1 measured it on;`
  New: `holds the list of passed engines as one constant with the commit X1 measured it on; WebKit counts as passed only after the owner's iPhone check (R225), since X1's WebKit is Linux WebKit, not iOS Safari; the tests set both the user-agent string and \`navigator.userAgentData\` (\`addInitScript\`), so the result never rests on what Chromium reports under a spoofed user agent;`
- Old: `\`npm run size\` passes with the start chunk unchanged.`
  New: `\`npm run size\` passes with the start chunk unchanged and the inline-script pin (\`INLINE_PIN_GZIP\`) unchanged.`

Size: about a day, one concern. If X1 passes Firefox, the note shows only on WebKit until R225.

## X5: FIX (small)

**Claim true, reproduced** with `unit-result.ts` against Home through `engine.ts`:

| Input | Unit view | Home |
|---|---|---|
| `(1/(1/0))*{m}` | `= 0 m` (exact 0) | "Division by zero" |
| `exp(ln(0))*{m}` | `= 0 m` | "Division by zero" |
| `(1/(1/0))*{m}` → `mm` | `= 0 mm` | (refused, as above) |
| `sum(cos(k),k,0,inf)*{m}` | `≈ 0.5 m` | "The series does not converge" |
| `int(1/x,x,-1,1)*{m}` | refused, `[engine]` | "The integral does not converge" |
| `limit(sin(x),x,inf)*{m}` | refused, `[engine]` | "No limit" |

The controls pass today:

| Control | Unit view |
|---|---|
| `(1/4)*{m}` | `= 0.25 m` |
| `int(x,x,0,2)*{m}` | `= 2 m` |
| `2*{Np}` | "Np converts only" (l13) |
| `0*{K}` → `oC` | `= -273.15 °C` (t14) |

`unitEval` (`units/evaluate.ts:443`) calls none of the refusals; Home calls them at `homeEval.ts:626-725`.

Problems:
1. The draft's order is not Home's order. In Home, `refusalOf` runs at `:646`, `lostNumber` at `:672` and `throughInfinity` at `:725`.
2. G316 (lane B, row 639) also changes `unitEval`.
3. The extra Giac calls count against the units stage's p95 of 5 ms or less (`app/scripts/golden.ts:55-56`).

Edits:
- Old: `\`refusalOf\`, then \`throughInfinity\` and \`lostNumber\`, under the unit view's time limit;`
  New: `\`refusalOf\`, then \`lostNumber\`, then \`throughInfinity\` (Home's order, \`homeEval.ts:646\`, \`:672\`, \`:725\`), under the unit view's time limit;`
- Old (Lane line): `**Starts when:** –. Before the tag (release bar point 3).`
  New: `**Starts when:** –; ahead of G316 (lane B row 639, also in \`unitEval\`), which rebases on it. Before the tag (release bar point 3).`
- Old: `\`GOLDEN GATE PASSED\` with the units stage's p95 within its limit;`
  New: `\`GOLDEN GATE PASSED\` with the units stage's p95 within its 5 ms (the report gives it before and after);`

## X6: FIX

**Claim true.** The recipe's engine line has no `setarch` (`fdroid/dev.n62.calc.yml:60`). The release build runs under it (`build-wasm-release.sh:50`) and needs `seccomp=unconfined` to do so (`:9-10`, `:46`).

**The draft's fallback can break F-Droid's CI.** Measured on 2026-11-10 in the pinned image `debian@sha256:913f6706…`:

| Seccomp profile | `setarch x86_64 -R true` | Exit code |
|---|---|---|
| default | "failed to set personality to x86_64: Function not implemented" | 1 |
| `seccomp=unconfined` | runs | 0 |

fdroiddata's CI job runs `fdroid build` in a container image (`buildserver-trixie`, `fdroid/SUBMIT.md`). With the recipe's `bash -e`, a `setarch` line would then fail the build outright.

**Other problems.**
- **Decisions conflict.** decisions.md:20 says "no package tests it before (Opus pass 130)", and this package is such a test. The owner's OK and a rewrite of that line are needed.
- **The qalc measurement is moot.** `fdroid/README.md:10` says nothing of qalc's code goes into the APK.
- **The test presumes the outcome.** Step 3's test assumes the measurement will show `setarch` is the fix.
- **Tag timing.** The recipe is copied into fdroiddata at the merge request, after the tag, and this package changes no build script, so the tag does not need to wait for it.

Edits:
- Old: `once as the recipe runs it and once under \`setarch "$(uname -m)" -R\`.`
  New: `once as the recipe runs it, once under \`setarch "$(uname -m)" -R\` with \`--security-opt seccomp=unconfined\`, and \`setarch -R true\` alone with the default seccomp profile (on 2026-11-10 that failed: "failed to set personality to x86_64: Function not implemented"; fdroiddata's CI runs \`fdroid build\` in a container).`
- Delete: `The same pair for \`engine/qalc/build-wasm.sh dev\` only if \`refresh-factors.mjs\` reads more than numbers from it.` (README:10: no qalc code in the APK.)
- Old: `if only the \`setarch\` build matches, the recipe's \`build:\` lines run under \`setarch "$(uname -m)" -R\` and \`fdroid/README.md\` says why.`
  New: `if only the \`setarch\` build matches and \`setarch\` runs under the default seccomp profile, the recipe's engine line runs under \`setarch "$(uname -m)" -R\` and \`fdroid/README.md\` says why; if \`setarch\` is refused there, the recipe does not change: the report names the objects that differ, and the owner chooses in decisions.md "Needs the user" (recommendation first) between a deterministic compile without ASLR off (its own package) and leaving the Reproducible Builds box unticked.`
- Old: `3. \`app/scripts/fdroid-recipe.test.ts\` gains a case: the recipe's engine lines carry what \`build-wasm-release.sh\` runs the build under.`
  New: `3. Only when step 2 changes the recipe: \`app/scripts/fdroid-recipe.test.ts\` gains a case that the recipe's engine line carries what \`build-wasm-release.sh\` runs the build under (red on phase-1). Otherwise this package is a measurement and adds no test.`
- Old (Starts when): `Before the tag: the recipe builds \`commit: v0.1.0\`, so a fix to a build script must be in the tagged tree.`
  New: `Before the F-Droid merge request (A98); best before the tag, but the tag does not wait for it: the recipe is copied into fdroiddata at the merge request, and a cure that changes a build script goes into the first tag submitted.`
- Add to Done when: `decisions.md "F-Droid Reproducible Builds" no longer says "no package tests it before"; it says what was measured; the report says the APK as a whole (Vite bundle, Gradle output) is still uncompared.`

## X7: FIX

**Claim true for the 14 named ids** (`factors.yaml:117`, `:240`, `:247`, `:258-268`; `cup` is `3/12500` m³, which is 240 mL). Three more bare ids are US units that the draft misses: `gpm` (`:282`), `gph` (`:283`) and `gal/s` (`:284`). A probe shows `1*{gpm}` → `L / min` = 3.785411784 L/min. Already right, as the draft says: `hp` (745.699871582 W, u10), `acre` (316160658/78125, the international acre), `ch` and `fur`.

**Internal consistency** ("search name" against "typed bare gal is refused"). For the user, the search side is right. The unit slot holds Find ids and is never typed as text (`units/slot.ts:2-4`). So a bare `gal` reaches the evaluator only through old stored data or a test's `{gal}`, and today an unknown id is refused as "The unit view could not evaluate this" (`[engine]`, probe `1*{zzgal}`), not as an unknown unit. What the user meets is Find, plus the symbol a result shows. The probe shows a result in `gal_UK` as `0.219969248299 gal_UK`, so the shown symbol must be checked too.

Edits:
- Old: `and 14 bare ids are US units today:`
  New: `and 17 bare ids are US units today:`
- Old: `- consumption: \`mpg\` with the US gallon (\`:240\`).`
  New: `- consumption: \`mpg\` with the US gallon (\`:240\`);\n- flow, with the US gallon: \`gpm\` (\`:282\`), \`gph\` (\`:283\`), \`gal/s\` (\`:284\`).`
- Old: `a list \`usOnly\` of ids whose factor is a US customary one, and the rule that each carries \`_US\` in its id; the rule fails today for the 14 ids above.`
  New: `the rule read from the factor, not from a hand list: every unit whose \`si\` numerator holds \`473176473\`, \`157725491\` or \`220244188543\` (US liquid and dry measure), and \`cwt\` and \`mpg\`, carries \`_US\` in its id, with \`bbl\` the one exception; it fails today for the 17 ids above.`
- Old: `and a typed bare \`gal\` is refused as an unknown unit.`
  New: `each row with its \`unit:\` (\`gal_US\`, \`gal_UK\`, \`cwt_US\`): the shown symbol is the explicit one, not qalc's \`1 gal\`. No golden row for a bare \`gal\`: no user types an id (\`app/src/units/slot.ts:2-4\`); instead \`tests/tasks/find-queries.yaml\` checks that \`gal\` finds \`gal_US\` and \`gal_UK\`, each with its country in the title, and that no item has the id \`gal\`.`
- Old: `\`spec/unit-pad.yaml\` and the Find query test follow.`
  New: `\`spec/unit-pad.yaml:85\` \`up: gal\` becomes \`up: gal_US\`, and the Find query test follows.`
- Old: `**Starts when:** –. Before the tag if it merges by the freeze of Thu 11-12; else after it with a migration step (step 4), and X8 names the limit.`
  New: `**Starts when:** –; after X5 (both add rows to \`tests/golden/units.yaml\`). Before the tag: the date is not fixed (owner, 2026-11-10), so the tag waits for it and no migration step is needed.`
- Delete step 4 (`4. **Only if this merges after the tag:** …`).
- Add to Done when: `\`docs/release-0.1.0.md\` point 7 lists the unit ids among the names frozen after the tag.`

Size: about a day (17 renames, one hand-written row, the generator's map, refresh-factors, the pad, two titles, tests). Split only if the report runs long: X7a for the ids and tests, X7b for the `hp` and `bbl` titles.

## X8: FIX (fold into A91)

**Claims true.**
- `Math.svelte:35` uses `aria-label={note || label || latex}`.
- The mark is its own span (`History.svelte:238`).
- `index.html:6` has `user-scalable=no`.
- The JSXGraph axes keep their default labels (`FunctionPlot.svelte:69-83`).
- `solve.ts:299` uses `toExponential`.

**Problems.**
1. `app/scripts/release.test.ts` does not exist on phase-1; A91 creates it. As its own package, X8's red test fails because the file is missing, not because a line is missing.
2. X8 runs on A91's branch, on A91's file, with A91's test, so it is A91's scope.
3. A91 says 500 *bytes* and X8 says 500 *characters*.
4. The unit-name line goes away once X7 is before the tag.

Edits, all to `docs/shifts/packages/A91.md`; then drop X8:
- Old: `Say none is a silent wrong number. Add what the test nights leave open.`
  New: `Say none is a silent wrong number. Also, in plain words without ids (arch review 2026-11-10): screen readers are not supported yet (a result is read as its LaTeX source, without its mark, and zoom is off; v0.2); tested on Chrome and Android's WebView, with what X1 found for Firefox and Safari; plot axis labels and the solver's info lines show a point as the decimal mark whatever the setting. Add what the test nights leave open.`
- Old: `a line naming a known limit by F number matches an open backlog line.`
  New: `a line naming a known limit by F number matches an open backlog line; \`## Known limits\` holds a line with "screen reader" and one with "Chrome".`
- Old: `**Starts when:** the freeze has passed, and A90 and A93 are merged.`
  New: `**Starts when:** the freeze has passed, A90 and A93 are merged, and X1's report is in.`

## With no fixed date: what belongs before the tag

- **Yes:**
  - **X2 and X3:** the launch-day failure mode, and both are small.
  - **X5:** bar point 3.
  - **X7:** ids are stored with user data; done now, it needs no migration.
  - **X1:** coverage for the browsers the site is announced to; by day, no app code.
- **Yes, conditionally: X4.** It runs after X1, and its WebKit part stays until R225.
- **Not gating: X6.** Run the measurement by day before the tag if there is room, but the tag does not wait for it (see X6).
- **Not a package: X8.** It becomes three lines in A91.
- **From X9 to X27 (the list only):** one piece belongs before the tag, by the same reasoning as X5. N5, CAS showing `0` for a pure number Home refuses, is decided (REPORT-2 section 4, decision 1) but placed in X14, two weeks out. Probes:

  | Input | CAS today | Home |
  |---|---|---|
  | `1/(1/0)` | `0`, ok | refused |
  | `exp(ln(0))` | `0`, ok | refused |

  An exact CAS result has no mark to warn with, so this is the same unmarked wrong value as X5, at the same reach. Recommendation: split it from X14 as **X5c** (gorge, Opus, lane B after X5): for a CAS input with no free name, `throughInfinity` as in Home, plus golden rows. Otherwise, name it in A91's known limits. Nothing else on the list is a bar item: X22 (owner, v0.2), X23 (a device; after X2 a memory failure is shown, not looped), and the rest are hardening.

## What the release bar needs that the review did not name

1. **The owner's six answers of 2026-11-10 and the three "Decided" items** (REPORT-2 section 4) are not in `docs/decisions.md`; a search finds none. They must be written there before any X package enters `docs/`: the drafts cite them as decided.
2. **Bar point 6 and A91 contradict the app.** They say "no Function plots" / "Missing: Function plots". The README advertises "Graphs. Plot functions" (`README.md:37`), and the Function app ships (`apps/types.ts:10`, `FunctionPlot.svelte`). As written, the release notes would state something false. The owner should say which is meant.
3. **Bar point 2's counts are stale.** It says CORE 69/69, but `tests/core/core.yaml` has 70 cases (c70).
4. **Bar point 7** should list the unit ids (X7's Done-when edit above). **Bar point 2** should have a browser line (X1's Done-when edit above).
5. **Not a bar item, but it bears on the date.** `docs/release-0.1.0.md` gives 2026-11-17 (the end of Max) as "the only rush". A tag after 11-17 changes the lanes' capacity (decisions.md P25, "Would change if: Max cannot carry the queue"). The owner should say whether the tag may pass 11-17.

## Proposed final order

1. **Now:** write the owner's answers and the three decisions into `docs/decisions.md`, then add the X files with the edits above (X8 as an edit to A91).
2. **Lane B (gorge), at the head:**

   | Order | Package | Runs after |
   |---|---|---|
   | 1 | X2 | – |
   | 2 | X5 | – |
   | 3 | X5c, if the owner agrees | X5 |
   | 4 | X7 | X5 |
   | 5 | G316 | X5, then the rest of the queue as it stands |

3. **By day (annabell):** X1 first (Wednesday), then the X6 measurement when there is a free slot.
4. **Lane A (ron), at the head:** X3 after X2 merges, then X4 after X1's report.
5. **Friday, by day:** A91 with X8's lines, after X1's report and the freeze.
6. **After the tag:** X9 to X27 in REPORT-2's order, with X14 losing the CAS part if X5c runs.

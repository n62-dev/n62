<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# The start chunk's cut list, measured (S58)

**Status: reference.** The ranked cuts for the first package that would take the start chunk over its 63 kB budget, where the owner's rule is a cut, never an allowance (decisions.md "Start chunk room"; the rule is not reopened here). Measured by sandra on `7fe56215` (phase-1, 2026-11-14), win99.

## Where it stands
- Budget 63,000 B gzip (`app/scripts/size-check.ts:156`, `KB = 1000` at `:16`); pin 62,300 B (`:475`, R298 fix 2, which measured 62,244 B, `:472-474`).
- This build: **62,229 B gzip, 175,348 B raw, one JS file** (`start-cuts.mjs`, base). Room to the budget: **771 B** (derived).
- The pin rose about 600 B a day over the last 55 h (night review ca-1, [its note](../archive/night-review-2026-11-14.md)). At that rate the room lasts about a day and a third (derived).
- Where the bytes are (`start-chunk.mjs --top=40`, raw per source from the source map; that build carries a source-map comment and reads 62.27 kB): Svelte's runtime 41.9 kB, `App.svelte` 12.6, `state/session.svelte.ts` 12.3, `keyboard/route.ts` 7.6, `Keypad.svelte` 7.3, `spec/keyboard.yaml` 6.8, `keyboard/keyboard.ts` 6.3, `History.svelte` 6.2, `apps/shell.svelte.ts` 6.2, `engine/format.ts` 6.0, `engine/workerEngine.ts` 5.6.

## How it was measured
`tools/probes/start-cuts.mjs` builds the app once as it is and once per candidate. In a candidate's build, every import of the module resolves to a stub. The stub reads each export from a global (so the minifier keeps the call sites as they are) and holds one `import()` of the real module, so the real code becomes a lazy chunk with its preload list, as a cut would make it. The tree is not touched: a resolve-and-load plugin in a probe config does it.

"Saves" is the start chunk's loss: the module's code leaves, one `import()` site comes in. It is the gain of moving the **whole** module. A real cut also adds its own glue (a queue, an `await`), tens of bytes. Where no build would change the ranking, the number is the night review's source estimate (`tools/probes/review-1114/ca-start-reach.pl app --sub=<module>`: stripped source, each file gzipped alone), marked as such.

Rerun (one slice, about 15 s for the seven builds):
```bash
cd app && npm run engine:copy && npm run index && cd ..   # once per checkout
tools/devlock.sh slice <name> node tools/probes/start-cuts.mjs
```

## The ranked list
Ranked by measured bytes. "Realistic" is what a cut that keeps the app working can take. It is (to verify) by the cut package's own build.

1. **`apps/shell.svelte.ts`: 1,797 B gzip (5,948 B raw) for the whole module.** That is an upper bound. `main.ts` builds `AppShell` at start, and `route.ts`, `App.svelte` and `StatusLine.svelte` read it on every key, so the module cannot go whole. The cut is its app-opening part: `host()`, `load`, `open`/`doOpen`, `setView`, `showView`, `setAside`, `toHome`, `pointer` (`shell.svelte.ts:132-222, 240-247, 278-297`). That part is 27 % of the stripped source and 1,203 of 3,672 B gzipped alone (source estimate), so it should save **about 0.5-0.6 kB** (to verify).
   - It loads with the first app key. That key already waits for the app's chunk (`shell.load`), so the two fetch in parallel through the preload list.
   - It also loads at start when an app was open at the last exit (`restorePlace`, `:417`).
   - Risk to the first key: none for Home's keys.
   - **Done by R362** with cut 4: the part is `apps/shellOpen.ts`, which `AppShell.open` loads before the app's code. Measured with cut 4 below.
2. **`state/taps.svelte.ts` with `state/pressCount.ts`: 544 B gzip (2,013 B raw).** Both leave; nothing else at start reaches them. They are the press counters (R70, R127): `TapCounter` is built in the session (`session.svelte.ts:275`), and every key, tap and hardware key calls it (`App.svelte:24, 76-113, 566`; `Keypad.svelte:325`).
   - Cut: until the chunk is in, `session.taps.press(name)` is a queue, replayed when the chunk loads. The chunk loads when the browser is idle, as the key names do (R41). Keypad hands over the raw touch with its Shift and Alpha state, and the chunk names it.
   - `TapCounter` already merges presses made before the stored counts arrive (`taps.svelte.ts:45-61`), so the replay follows a path that exists. `firstTips` reads `pressedThisStart` (`App.svelte:63`), and the queue can answer that itself.
   - Risk to the first key: none (a push onto an array). The risk is a lost count, which a test of presses made before the load covers.
   - **Done by R320:** the front is `state/tapsFront.svelte.ts`; measured **−366 B gzip** (phase-1 `c6fe6992` 62,415 B, the branch 62,049 B); pin 62,100 B.
3. **`input/backLayer.ts`: 195 B gzip (467 B raw).** It is Android back's history layers. It is used when a sheet opens (`App.svelte:313`) and when results mode folds (`:403`).
   - Cut: it rides with the sheet's model (`views/sheet.svelte.ts`, already lazy: a sheet waits for it anyway) and with the fold.
   - Risk: back pressed in the first instant of a fold, before the chunk is in (to verify by the package). No key waits.
   - **Done by R782:** the front is `input/backLayerFront.ts` (idle load by `main.ts`; one load for every waiting layer). Verified by `backLayerFront.test.ts`: a layer opened before the code is in is pushed once it is, in the order opened; one released before is never pushed; and the first such layer puts one guard entry on the history at once, so back before the push pops that and does not leave the app.
4. **The update line: `state/updateOffer.svelte.ts` with `views/icons.ts`: 147 B gzip (124 B raw).**
   - The icons are drawn only in an open app's view tabs (`StatusLine.svelte:77-90`, `shell.app !== null`), so they can ride with cut 1.
   - `updateOffer` is a four-line state the status line reads at start (95 B gzipped alone, source estimate). It is not worth a cut alone.
   - Take this with cut 1: about 0.15 kB.
   - **Done by R362** (the icons only; `updateOffer` stays at start, since an update can wait before any app opens): `views/icons.ts` rides with `apps/shellOpen.ts`. Cuts 1 and 4 together measured **−693 B gzip** (phase-1 `d9b130d8` 62,879 B, the branch 62,186 B), against the estimate of 0.65-0.75 kB; pin 62,240 B.
5. **`views/edgeFade.ts`: 136 B gzip (374 B raw).** It draws the fade on a cut-off input or result in the first screen's rows (R12b).
   - Lazy, the first rows would show cut text without its sign until the chunk is in, against docs/05 3.5 ("never cut without a sign").
   - Do it last, if at all.
6. **`views/rowGestures.ts`: 135 B gzip (374 B raw).** It is already the idle loader of `views/rowGesturesCode.ts` (R276), so a cut puts a loader in front of a loader.
   - At best about 0.1 kB, by folding its `import()` into another idle load.
7. **`appLoaders.ts`: no build; 785 B gzipped alone from 2,178 B of stripped source (source estimate).** It is the table of the lazy chunks' `import()` sites (`createLoaders`), so it cannot itself load later. Realistic: 0.
8. **`calc/fake.ts`: 0 B.** It is not in the built start chunk: it sits behind `import.meta.env.DEV` (`calc/index.ts:10-12`), and the base run's lazy check finds it in no chunk. The source graph lists it (with `engine/homeDefaults.ts`, which the build puts in a lazy chunk) only because `ca-start-reach.pl` does not drop DEV-only code.

**What the list buys:** about 1.4 kB in all (cuts 1-6 realistic, derived; each to verify). That is two to two and a half days of the current growth. **The list buys days, not weeks.**

The next room is structural, and these are leads, not measures:
- `engine/format.ts` with `state/displayMode.ts`: 6.0 + 2.7 kB raw in the chunk; `--sub=state/displayMode.ts`: 2 modules, 6,670 B gzipped alone. The start draws the stored history's numbers through them, so how much the first paint needs is the question (to verify: `start-cuts.mjs state/displayMode.ts`, then a look at which exports the first paint calls).
- The part of `session.svelte.ts` and `route.ts` that no first-screen key uses.

## `LAZY_PARTS`: the five modules
**Done by R320:** `lazyFailures` reads `chunk-modules.json` (a module no start file holds passes; the name rule stays for a fake dist), and all five are in `LAZY_PARTS`. What follows is the state before it.

`views/statSheet.ts`, `views/matrixGrid.svelte.ts`, `views/helpSheet.ts`, `entry/cursorFn.ts` and `engine/decimalLatex.ts` are all outside the start chunk in this build (`start-cuts.mjs` base, lazy check).

Only two of them can go into `LAZY_PARTS` (`size-check.ts:192`) as it is. `lazyFailures` (`:519-529`) finds a part only through `lazyChunk` (`:512-516`): a dynamic entry with that source, or a shared chunk named after the file. Three of the modules are neither:
- `matrixGrid.svelte.ts` sits in matrixSheet's chunk.
- `cursorFn.ts` sits in helpSheet's chunk.
- `decimalLatex.ts` sits in solve's chunk.

Listed, these three would fail the gate with "is not a dynamic chunk: it is in the start chunk" though they are lazy. `statSheet.ts` and `helpSheet.ts` are chunks of their own and pass.

**For the first cut package:**
- Add `statSheet.ts`, `helpSheet.ts` and its own module.
- Make `lazyFailures` read `chunk-modules.json` when the build has it (G163, `readChunkModules`, `:65`): a module that no start file holds passes. Keep the name rule for a fake dist.
- Add a `size-check.test.ts` case for a module inside another lazy chunk.
- Then add the other three.

## Order
Cut 2 first (done, R320). Then cut 1 with cut 4 (done, R362), then cut 3. Write the first one before the next row that would take the pin past about 62.8 kB, so it is not done under time pressure at the wall.

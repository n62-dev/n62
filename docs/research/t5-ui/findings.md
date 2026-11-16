<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# T5 findings F380–F399 (the walk and the probes, 2026-11-16)

Each finding: steps, expected, got, screenshot, and the cause at `file:line` (phase-1 at `e93dec77`). Found on the emulators of [SUMMARY.md](SUMMARY.md) with the test build; "real input" means Android's own `adb shell input tap` and `input keyevent 4`, not CDP. The packages that fix them are in `docs/shifts/packages/` (R700–R711, A240, A241) and ranked in [ui-analysis.md](ui-analysis.md). The screenshots are in `tests/ui-walk/shots/`.

## F380: Sync folder does nothing on Android, and its checks throw on start and on leaving
- **Steps:** a fresh install; Shift + ☰ (Settings) › 5 Data › 4 Sync folder › 1 Choose folder.
- **Expected:** Android's folder picker opens (docs/05 3.4 "Data › Sync folder", R128).
- **Got:** the sheet closes and nothing opens; the app stays in front. The console gets `Error: "N62Files.then()" is not implemented on android` twice. The same two errors come when the app is left (Back on the first-start tips, edge p001 → p002 of the map) and in the first seconds after a start (a probe that attached after the start and stored a value saw them; a plain `2 + 3` Enter afterwards added none, since no folder is chosen). Screenshot: [probe/choose.jpg](../../../tests/ui-walk/probe/choose.jpg).
- **Cause:** `app/src/clipboard/folder.ts:53-61`. The `async function plugin()` returns the plugin object from `registerPlugin`. That object is a Capacitor proxy, and resolving a Promise with it calls the proxy's `then(resolve, reject)`. The proxy turns every property into a native call, so `then` goes to the native side. That call rejects unhandled with UNIMPLEMENTED (the console line), and it never calls `resolve` or `reject`. So `await plugin()` stays pending for good, for every caller: `pickFolder` (`:65`), `folderName` (`:78`), `folderWrite`, `folderAppend`, `folderTail`, `appendChecked`, `folderModel`, `folderRead` and `folderList`. The `try` around the `return` cannot catch any of this.
- **Why no test saw it:** `app/test-device/folder.rec.ts:103` calls the native method through `Capacitor.nativePromise("N62Files", …)`, around `folder.ts`. The e2e tests run in a browser, where `plugin()` returns `undefined` before it gets that far.
- **Fix:** never hand the proxy to a Promise. Return it wrapped (`{ p: registerPlugin(…) }`), or register it once, synchronously, at module level. Add a device test that goes through `pickFolder()` and `folderList()` themselves. `files.ts:64` is safe (it calls `.save` on the proxy directly).

## F381: Android Back leaves the app from four states that Esc undoes
- **Steps (real input):**
  1. Home, `2 + 3` Enter, ▲ (a row picked: the row bar shows Store ▶ and Copy as ›), Back.
  2. Shift + Tmpl (the unit view), Back.
  3. Shift (armed), Back. The same holds for Alpha, and for both locks.
- **Expected:** Back undoes the layer on top, as it does for a sheet (one level), Settings and the folded keypad (docs/05 3.4 and 3.5, R21b). Esc does exactly that here: it drops the pick and closes the unit view (`app/src/keyboard/route.ts:84-90`).
- **Got:** the app goes to the background, and the launcher is in front. For the unit view, the page with the slots typed so far is still there when the app is opened again, but nothing on screen said so. In the map these are the edges p012, p014, p018, p023, p024 → p013 (the launcher). Screenshots: [probe/picked-row-on-an-empty-line.jpg](../../../tests/ui-walk/probe/picked-row-on-an-empty-line.jpg) and [probe/unit-view.jpg](../../../tests/ui-walk/probe/unit-view.jpg).
- **Cause:** only three layers register with `openLayer` (`app/src/input/backLayer.ts`): pick sheets (`app/src/App.svelte:311-317`), the fold (`App.svelte:405-406`) and the tips (`app/src/views/tipsHost.ts`). A picked row, the unit view (`app/src/units/open.ts:65`) and an armed Shift or Alpha have none, so `canGoBack()` is false and `MainActivity.java:49-61` lets Android leave.

## F382: Store ▶ on an empty line with no result opens "Store in", and storing gives a raw LaTeX error
- **Steps:** a fresh install, Home with an empty history; Shift + ᴇ (Store ▶), then tap A.
- **Expected:** with nothing to store, a dead press (the double pulse, docs/05 3.7), as Base (Shift + −) is without a result (`app/src/views/baseSheet.ts:57`). Store's own rule starts `Ans ▶` only after a result (decisions.md "R15c Store").
- **Got:** "Store in" opens over a bare `▶` (map state p019). The tap on A makes the error row `▶A` with the text "unsupported command \blacktriangleright". That is the parser's internal command name, not a message that names the problem and the fix (docs/05 3.8). Screenshot: [probe/store-empty-after-A.jpg](../../../tests/ui-walk/probe/store-empty-after-A.jpg).
- **Cause:** `app/src/keyboard/route.ts:542-546`. `ans` is false (no result), but `entry.run(action)` still inserts `STORE_ARROW` and `c.openStore(undefined)` opens the sheet. The message comes from `app/src/i18n/enParser.ts:47` (`parse.unsupportedCommand`), which gets the raw command name.

## F383: The keypad's text overflows its keys at Android font scale 1.5 and 2.0 (real WebView), while the e2e test passes
- **Steps:** the system font size set to 1.5 (`settings put system font_scale 1.5`), then to 2.0; start N62.
- **Expected:** R41: "at the Android font scale 1.5 and 2.0 the keypad's text still fits" (`app/test/fontscale.spec.ts:1-4`). decisions.md "R41 at font scale 2.0" would change "if the device clips Mode or ☰".
- **Got:**
  - **At 1.5:** "Deselect" runs past the screen edge (x 335..417 of 412), "Select" shows as "Selec" and "Settings" as "Setting", and Math and Tmpl run into their ▾ ([probe/font1.5-home.jpg](../../../tests/ui-walk/probe/font1.5-home.jpg)).
  - **At 2.0:**
    - the faces of the cluster and of row 3 overlap their neighbours;
    - the Settings legend shows as "Settir";
    - the status line is cut at its top;
    - Mode's row labels are cut to "Nu…" and "Significan…";
    - the first-start tips put "Got it" below the screen (the card list scrolls, 1332 px of content in 766, with no sign that it does).

  Screenshots: [probe/font2.0-mode.jpg](../../../tests/ui-walk/probe/font2.0-mode.jpg) and [probe/font2.0-tips.jpg](../../../tests/ui-walk/probe/font2.0-tips.jpg). At 1.3 everything fits.
- **Cause:**
  - **The test:** `app/test/helpers.ts:397-409` (`setFontScale`) multiplies only the app's `--fs-*` tokens. Android's WebView applies the system font scale as its text zoom to all text, after the app's own sizes, so the e2e emulation does not see what the device draws.
  - **The app:** the fit pass (`app/src/keyboard/fit.ts`) does not bring the faces back inside their keys under that zoom.

## F384: The format and digits chips are read as "STD" and "12"
- **Steps:** any view; read the status line's controls with a screen reader (Chrome's accessibility tree, as TalkBack gets it, `Accessibility.getFullAXTree`).
- **Expected:** each chip says what it is and what a tap does, as the angle chip does: "Angle unit: Radians. Tap to switch." (`status.angle`). The i18n table already has `status.format`: "Number format and digits: {format}. Tap to change."
- **Got:** the format chip is a button named "STD" (then "SCI", "ENG" or "PFX"), and the digits chip a button named "12" (or another number), in every state of both profiles ([checks.md](checks.md), "Names": "SCI", "ENG", "PFX", "10" and "20" are the same chips after a change). Mode's own buttons are named in full ("Standard", "Engineering", "Radians").
- **Cause:** `app/src/views/StatusLine.svelte:112-114`. The label sits on the `span.pill`, a generic element with no role, so Chrome ignores it. The two buttons inside have no `aria-label` of their own.
- **Fix:** move the label onto each button: "Number format: Standard. Tap to choose." and "Significant digits: 12. Tap to choose." A test fails on any control named by an abbreviation or a bare number (R709).

## F385: Plot's axes, tick numbers and trace dot are black on the dark board (contrast about 1.3 : 1)
- **Steps:** N62 · Dark (the default on Android); Function, F1 = x² − 2, Plot.
- **Expected:** the axes and their numbers in `--muted` (#abccca in N62 · Dark, about 9 : 1 on the board), and the trace dot in `--text` (#ebf6f6). That is what `FunctionPlot.svelte` asks for. docs/05 3.7: text at least 4.5 : 1.
- **Got:** the canvas has the curve (orange) and, for everything else, black pixels (`0,0,0,α`). The board is rgb(9, 39, 38), so the axes and the numbers −8 … 8 are close to invisible, and the trace dot is a black disc (the tablet: [probe/plot-dark-axes.jpg](../../../tests/ui-walk/probe/plot-dark-axes.jpg); the phone: [probe/plot-dark-axes-phone.jpg](../../../tests/ui-walk/probe/plot-dark-axes-phone.jpg)). The walk's own Plot shots show an empty board for another reason: they were taken before JSXGraph's lazy chunk had drawn.
- **Cause:** `app/src/apps/function/FunctionPlot.svelte:81-82` and `:112`. The board uses the canvas renderer (`:75`), and it is handed `"var(--muted)"`, `"var(--line)"` and `"var(--text)"` as colours. A canvas cannot resolve CSS custom properties, so each of those strokes and fills keeps the default black. The curves are right because `curveColors()` returns literal colours (`app/src/apps/function/app.svelte.ts:29`).
- **Fix:** read the tokens with `getComputedStyle(document.documentElement)` when the board is made and when the theme changes (as the curves follow `curveColors()`), and pass literal colours. Add a test that reads the canvas's pixels on the axis line and checks the contrast against the board in all three families, Light and Dark.

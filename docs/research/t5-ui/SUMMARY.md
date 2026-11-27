<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# T5: the UI map, the walk and the UI analysis (running summary)

**Status (2026-11-16): decided.** The owner answered every point the same day (below). The packages are in `docs/shifts/packages/`, and the fixes are in release-0.1.0.md's fix lane.

Ultra terminal T5 on lin99, branch `p1/t5-ui` from `origin/phase-1` at `e93dec77` (2026-11-16). It covers the interface only (menus, sheets, keys, settings, gestures), not results. The research budget is ignored on purpose; a later session trims it.

## What is here
- [ui-analysis.md](ui-analysis.md): the problems ranked by reach and frequency, each with one recommendation. **Read this first.**
- [findings.md](findings.md): F380–F385, each with its steps, expected, got, screenshot and cause at `file:line`.
- `docs/shifts/packages/`: the packages R700–R711, A240 and A241 (moved there with the owner's answers).
- [ui-map.md](ui-map.md): a tree per root (every state, every action out of it, where Back and × lead, the time), the keys of each view in every layer, and the fewest actions to each state.
- `tests/ui-walk/`: the data the pages are made from (out of `docs/`, owner 2026-11-16).
  - `ui-map.json`: the states and edges (from, action, to) of both profiles; the walk replays it.
  - `walk-phone.json`: the replay's results.
  - `shots/phone/`, `shots/tablet/`: one screenshot per state, made by each run of the walk and kept out of git (`.gitignore`; 37 MB, owner 2026-11-16).
  - `probe/`: the hand probes' screenshots, and three state screenshots the findings and packages cite (the first start, the unit view, the tablet's Home menu).
- [checks.md](checks.md): every failed check of the run, generated: Back and ×, console errors, clean timings, overflow, targets, names.

## The run in numbers
- **The map:**
  - Phone: 387 states and 2,333 edges, over 11 roots (tips, home, home-rows, home-line, cas, function, function-plot, function-num, solve, units, and part of folded).
  - Tablet: 95 states and 650 edges (tips, home, and part of function-plot), in the wide layout.
  - Every edge ran every check: the state reached, Back and ×, console errors, overflow, 48 dp targets, spoken names, and the time from lift to the last change.
- **The replay (`--mode walk --sample 5`):** every fifth edge, plus every edge that the map had marked (an error, a note, or a Back that led elsewhere). That came to 661 edges on two phone emulators. **660 of 661 reached exactly the mapped state.**
  - The one difference (☰ › 0 Export on the history-rows root) is a walker flake. Export is the tenth row, below the sheet's fold, and the map run's tap missed it after the scroll.
  - The replay also reproduced F380's console error.
  - The row's hold, checked again, copies ("Copied"). The row's swipe was not in the sample. The map records it working: a swipe left or right deleted a row (the count fell by one), with "Row deleted · Undo".
- **Time:** keys and gestures settle in a median of 6 ms (p90 83 ms) in the map and 15 ms (p90 167 ms) in the replay, on emulators that shared 16 cores. The sheets with real input are under "How it was made".
- **Overflow:** none at 412 × 815, at 1280 × 716, or at the tablet held upright (800 × 1148). Font scale 1.5 and 2.0 are F383.
- **What the map leaves out, on purpose:**
  - inside Find's categories, the content (functions, units), with one category opened and the rest recorded;
  - a second walk of the shared sheets (Mode, Settings, Apps, Find, the palettes) from every root, done once from Home;
  - the same Settings reached again through ☰ ⚙;
  - the tablet's other roots, which are the phone's states in a wider frame.

## How it was made (repeatable)
- **Build:** `./build.sh --dev --test`. Not `--unsigned`: Android refuses to install an unsigned APK, and `--test` turns on the WebView's remote debugging that the walk needs. The APK is signed with the throwaway key and went on emulators only.
- **Emulators:** API 34 x86_64 (`system-images;android-34;default;x86_64`), KVM, `-gpu swangle_indirect` (swiftshader crashed the emulator headless).
  - `n62-t5-phone`, `n62-t5-phone2` and `n62-t5-probe`: the Pixel 7 profile, 1080 × 2400 at 420 dpi; 412 × 915 dp, of which the page gets 412 × 815 CSS px.
  - `n62-t5-tablet`: the Pixel Tablet profile, 2560 × 1600 at 320 dpi; 1280 × 800 dp, landscape, so the wide layout.
  - The tablet held upright was checked by a probe (`wm size 1600x2560`).
- **The map:** from `app/`, `ANDROID_SERIAL=<serial> node test-device/uiwalk.ts --profile phone` (the data goes to `tests/ui-walk/`).
  - The roots: tips, home, home-rows, home-line, cas, function, function-plot, function-num, solve.
  - To run them in parallel, give each emulator its own `--roots` and `--out`, then `node test-device/uiwalk-merge.ts --profile phone --out ../tests/ui-walk <other out dirs>`.
  - Then `--mode walk` replays every edge against the map, and `node test-device/uiwalk-report.ts` writes `ui-map.md` and `checks.md` here, from `tests/ui-walk/`.
- **Why Playwright over CDP and not uiautomator:** the app is one WebView, so uiautomator sees only Chrome's accessibility tree: no sheet path, no Shift or Alpha state, no console and no layout boxes. Over CDP (the A32 route of `test-device/core.device.spec.ts`) one channel gives all of it:
  - the state (`window.n62`) and the console errors;
  - the boxes for the overflow and 48 dp checks;
  - Chrome's own accessible names, which are what TalkBack is handed;
  - the touch itself (`Input.dispatchTouchEvent`, the WebView's real input path), so flicks, holds and swipes run the app's own gesture code.

  Android's Back is the one system input; it is sent as `adb shell input keyevent 4`.
- **Two limits of CDP, and how they were handled:**
  - A control that acts on `click` gets CDP's click synthesis on top (about 250 ms here), so the report times only keys and gestures. The status line and the sheets were timed with real input (`adb shell input tap`) on the probe emulator: 26–144 ms, and 221–266 ms for a sheet's first open (its lazy chunk).
  - The emulators shared 16 cores, four at a time (load around 40), so every time here is a ceiling.

## Queue rows proposed
In the brief's table form. The steps are left for the owner to number. "Fix" rows may run in the test nights before the v0.1.0 tag; the others wait for the tag or for the owner's yes.

| Step | What | Agent, model | Branch | After |
|---|---|---|---|---|
| – | [R701](../../shifts/packages/R701.md) the folder plugin is never handed to a Promise: Sync folder works on Android (fix, F380) | annabell, Sonnet | `p1/annabell-folderproxy` | – |
| – | R710 Plot draws its axes, numbers and trace dot in the theme's colours (fix, F385) | ron, Sonnet | `p1/ron-plotaxes` | – |
| – | R700 Android Back undoes a picked row, the unit view and an armed Shift or Alpha (fix, F381) | ron, Sonnet | `p1/ron-backlayers` | – |
| – | [R709](../../shifts/packages/R709.md) every control has a spoken name that says what it is (fix, F384) | ron, Sonnet | `p1/ron-spokennames` | – |
| – | R702 Store ▶ with nothing to store is a dead press; a lone ▶ says what it needs (fix, F382) | ron, Sonnet | `p1/ron-storeempty` | – |
| – | R703 the keypad, the status line and Mode fit at font scale 1.5 and 2.0 on a real WebView (fix, F383) | ron, Opus | `p1/ron-textzoom` | R700 |
| – | [R708](../../shifts/packages/R708.md) the small controls get 48 dp touch boxes without changing their look | ron, Sonnet | `p1/ron-touchboxes` | – |
| – | R705 a tap on an empty user key opens Your keys on its row | ron, Sonnet | `p1/ron-emptyuserkey` | – |
| – | [R707](../../shifts/packages/R707.md) the status line names the unit view while it is open | ron, Sonnet | `p1/ron-unitplace` | R700 |
| – | [R704](../../shifts/packages/R704.md) a sheet opened at a deep level closes on Back and Esc (the owner's yes) | ron, Sonnet | `p1/ron-deepback` | R700 |
| – | [R706](../../shifts/packages/R706.md) the first start shows two tips; five come at their moment (the owner's yes; after the tag) | ron, Opus | `p1/ron-tipsinplace` | – |
| – | [A241](../../shifts/packages/A241.md) count the likely mis-taps for R15b's and R21's "would change if" (after the tag) | ron, Sonnet | `p1/ron-mistaps` | – |
| – | [A240](../../shifts/packages/A240.md) the UI walk as a weekly device test (after the tag) | annabell, Sonnet | `p1/annabell-uiwalk` | R700, R701, R709 |
| – | [R711](../../shifts/packages/R711.md) a setting for where menus sit: over the keys, or above them with the keypad free (the owner's idea; after the tag) | ron, Opus | `p1/ron-menuplace` | R700, R704 |

## The owner's answers (2026-11-16)
1. **The fixes before the tag:** all six (R701, R710, R700, R709, R702, R703) go into the fix lane after T6's (release-0.1.0.md, the freeze row).
2. **R704:** yes. A sheet opened at a deep level closes on Back and Esc; R86's "Mode under it" stays for the title's path and its ‹.
3. **R706:** yes, after the tag: two tips at the first start, and the other five each at their moment.
4. **docs-check and the repo's size:** the walk's data moved to `tests/ui-walk/` (no rule changed), and `node tools/docs-check.mjs` passes. The 485 per-state screenshots (37 MB) stay out of git (`.gitignore`). Each run makes them anew. Only the eleven cited ones are kept, in `tests/ui-walk/probe/`. The branch merged is `p1/t5-ui-slim`, one commit; `p1/t5-ui` with the screenshots in its history is not merged.
5. **Push:** yes, `p1/t5-ui`.
6. **R711 (the owner's own idea, answered the same evening):** a setting for where menus sit.
   - "Over the keys" (today, the phone's default) or "above the keys", with the keypad free and the digit keys picking rows; the wide layout's default is "above".
   - After the tag, with a removal test.
   - It changes R144 in "above" only (a digit's tap picks).

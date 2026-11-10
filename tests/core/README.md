<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# The core list (P23)

**What it is.** `core.yaml` is the definition of "the core holds" (decisions.md "P23", owner, 2026-10-21): about fifty everyday tasks on Home, CAS, the matrix templates, Solve and Function, each as the keys a user presses and what the screen must show. While the core freeze lasts, no new feature is built; the work is this list, the bugs it finds and the bridge (docs/shifts/brief.md section 0).

**After the freeze** (it ended on 2026-10-27, before its count; decisions.md "P23"): the list is the net. It runs in the desktop e2e suite on every merge (R74) and on the lanes' device after each Opus pass when the run has one (A33, A41; `CORE DEVICE` lines in `.coord/log.md`), and the owner's hand check ([MORNING.md](MORNING.md)) runs on that device before a release tag. A case that fails is a bug to fix, not a gate.

## Rules
- **Expected values** are `derived` or `oracle` (mpmath 1.3.0 in `tests/golden/.venv`), as in a golden case; never from memory of another calculator, never from what the app shows today. The shown text follows docs/04 2.4 and 2.6: 12 digits, `E` for large and small numbers, `=` exact, `≈` rounded with every digit right. A CAS result built from exact names carries no mark (docs/04 2.9, G51): those cases say `mark: none`.
- **`known: <bug>`** marks a case that fails today for an open bug line of `docs/backlog.md`. The harness expects it to fail; when it passes, the harness fails until the `known:` goes (a ratchet, like `tests/golden/viewsweep-known.yaml`). A new failure without `known:` fails the check.
- **`needs: <package>`** marks a case that cannot be keyed today. The harness skips it and prints why; the package named rewrites its keys as its own route.
- **The list changes with the owner.** A case is added when the owner asks, or as the regression case of a bug the list missed; a case leaves only with the owner's word. Keys are ids of `spec/keyboard.yaml` and the status-line controls of `app/test/helpers.ts` (`@cas`, `@mode`, …).
- **`hand: true`** puts a case on the hand check's list. MORNING.md lists exactly those ids (R74 checks it).

## How it runs
- **Desktop:** `app/test/core.spec.ts` (R74) replays every case in Playwright on the real engine, one fresh page per case, in parallel; a reporter prints `CORE <passed>/<active> (known <n>, needs <n>)` once at the end. It is part of `npm run test:e2e`, so every pipeline run checks it.
- **Device:** the same cases through the night's device's WebView (A32): a test build with WebView debugging, Playwright attached over adb, the same replay code. The pipeline's device step runs it after each Opus pass (A33; docs/shifts/rules.md section 6).
- **By hand:** MORNING.md, the owner, about ten minutes before a release tag, on the APK the last automatic run checked (decisions.md P25).

## State on 2026-11-09 (desktop)
70 cases, all active (`CORE 70/70`). c70 (S53f1): Vars shows a stored 1 ÷ 3 with ≈. c67–c69 (R170, owner's yes on mh-A2) are the first with a unit and a ±: 5 kg in lb, 500 m in 40 ± 1 s, and 1 m + 1 s refused. The device run skips c53 (desktop-only), so it prints `CORE DEVICE 69/69`. c61–c66 were added with the owner on 2026-10-26.

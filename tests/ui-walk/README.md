<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# The UI walk's data (T5)

What `app/test-device/uiwalk.ts` maps and replays on an emulator or a device, over adb to the WebView of the test build. It was moved out of `docs/` (owner, 2026-11-16).
- `ui-map.json`: every state and edge per profile (phone, tablet).
- `walk-phone.json`: the last replay.
- `shots/phone/`, `shots/tablet/`: one screenshot per state, made by each run and never committed (`.gitignore`).
- `probe/`: the hand probes' screenshots and the three state screenshots that the findings cite (in git).

The pages made from it, the findings and the analysis are in [docs/research/t5-ui/](../../docs/research/t5-ui/SUMMARY.md). Regenerate the pages with `cd app && node test-device/uiwalk-report.ts`.

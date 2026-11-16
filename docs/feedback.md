<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Owner feedback inbox

The one place for the owner's points from using the app (docs/03 section 0, rule 12). Oldest first, one dated section per round, numbered on from the last row (the next is 65). Each point is kept in the owner's words (shortened) and gets one triage:

- **bug**: fixed now, regression test first;
- **feel**: goes into the next package for the look or the entry (brief section 0);
- **idea**: waits a week, then must pass rule 5 (G2 flow, a G2 friction removed, or more trust) before it gets a task;
- **decided**: became a decision (the id says where).

Rows 1–55 (2026-10-13 to 2026-10-18) are triaged; their text is in git at `6550cc93`. The rows below stay because live files cite them by number (`tools/probes/unit-presses.mjs`, docs/06 section 2, `tests/golden/G2-CHECKLIST.md`).

| # | Date | Owner's point | Triage |
|---|---|---|---|
| 8 | 2026-10-13 | Units in other calculators are conversion tables, which is useless. Wanted: a normal entry line whose keys make unit entry easy (nanometres, fractions too), Enter gives the result, and "this should equal … unit" with an error when it does not match. | idea, input for milestone 5; built as the unit view (P11, P14, R24a–R24d) |
| 17 | 2026-10-13 | The MCP server could be good. But more important: anyone who wants to change parts of the calculator or add their own scripts needs a real connection point, not a Python terminal nobody uses. | idea (discussion: a plain-text function library, edited on a laptop, imported on the phone, found in Find, assignable to a user key). Shape and why written 2026-10-14: `archive/backlog-2026-10.md` at `87a8c468` "Parked ideas"; done as S4 ([archive/r10-connector.md](archive/r10-connector.md)) |
| 40 | 2026-10-14 | The calculator no longer comes with Python; a connector will let the user program it from a laptop instead of typing through the Alpha keyboard. So many keys are free: (1) remove Alpha entirely (one key gained), or (2) remove the letters and put many new functions there (new to a G2 user, but a big gain)? Or other ideas? Then, after the analysis: "I see the need for the alpha keys, so then we keep them." | decided: decisions.md "The letters stay" (2026-10-14). Dropping the Alpha key stays P7 point 4, read on the tap counter around 2026-10-20 (freed cell: U4). Raised in the analysis: a lower-case CAS letter costs 3 presses (flick down types the capital); G2 item 45 asks what the G2's CAS does |

### 2026-11-16: T4's own run of the open sessions (found by T4, not the owner)

The owner's `todo.txt` held no `+N62` line on 2026-11-16, so no owner report was processed. T4 ran the sessions itself (Playwright at phone size, real engine, phase-1 e93dec77); the words are T4's, kept here so the owner can confirm or drop each.

| # | Date | Point (T4's words) | Triage |
|---|---|---|---|
| 56 | 2026-11-16 | S16: CAS ∫₋₂²√(4−x²)dx shows 16π/8, ∫₀¹√(1−x²)dx shows √π/2 √π/2. Right, but not how anyone writes it (F350). | bug, G575 |
| 57 | 2026-11-16 | S05: `sin` Enter, `2 xʸ` Enter, `4 ÷` Enter say "unsupported command \placeholder"; `2 × × 3` says "unsupported command \times"; `3 +` Enter says "unexpected end of input at end of input" (F351). | bug, R575 |
| 58 | 2026-11-16 | S05: `2^1000000` and `10^(10^6)` say "The calculation failed", though `2^(1ᴇ7)` has a number (F352). | bug, G576 (background) |
| 59 | 2026-11-16 | S07, S16: the ≈ on Enter, pressed after typing a sum, puts approx(□) behind it and the next Enter fails (F353). | feel, R576 (owner's yes) |
| 60 | 2026-11-16 | S09: 20 °C + 5 K is refused with "Use K or Δ°C for a temperature difference"; the 5 is already in K (F354). | feel, G577 (part 2: owner's yes) |
| 61 | 2026-11-16 | S09, S10: on a long formula the unit view's end slot is off the right edge; the target unit is typed blind (F355). | bug, R577 |
| 62 | 2026-11-16 | S11: Home shows A⁻¹ as [[0,0,1],[−2,1,3],[3,−1,−5]] and a linear system's answer as [[3],[9],[−14]]; the line and CAS draw grids (F356). | feel, R578 (after the tag) |
| 63 | 2026-11-16 | S14: in Function's Symb view, Enter keeps the line on F1, so typing the next function extends F1; only ▼ moves on (F357). | feel; the G2's way first (Needs the owner) |
| 64 | 2026-11-16 | S15: Solve says "Giac Newton … hybridsj: polish failed" and "(Giac proot)", and draws complex roots as -1.047…-1.135…*i (F358). | feel, R579 |

<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# docs/backlog.md's closed lines, 2026-11-17 (S55, archived to make room)

Moved here as they stood, each in full and once (links adjusted to this folder): status text of finished work that the backlog's size budget (18 kB target) no longer holds. History only: the open lines stay in [../backlog.md](../backlog.md), word for word. Every package named here is merged (`git log --merges`); where a line kept its open part, the moved line is the whole old line and the backlog keeps a shortened form.

## 1. "Where we are", the stage table (S55 kept the milestones' open part in one row)

| Stage | State |
|---|---|
| Phase 0 spike; MVP milestones 1 (Home, CAS), 2 (Function, Solve), 3 (Python, removed by P11) | **Done** 2026-10-11 |
| **The core freeze (P23)** | **Ended 2026-10-27** (owner). Its net stays: [tests/core/](../../tests/core/README.md) runs on every merge and on the night's device; a red case is a bug to fix. |
| Milestone 4a: feel (P11) | Built (the entry work, sheets, flicks, Settings, history-row actions, the visual pass, themes, results mode; the list: git). Waiting: the trust features |
| Milestone 4: Find and trust | Engine side done (marks, 30 digits, chips, copy, defs, the Find index, the size test, A4a); Find's UI: R4a, R4b built; Find per key on the Tab One: p95 14.1 ms ≤ 16 (A74), E3 met; the gate is not complete |
| Milestone 5: Units | Built: the evaluator on Giac (P15), the pad, the entry and Find in a slot (R24a–R24d), the result's alternatives and view (R60–R63), ± (R71), a result chip as σ (R271), menu Constants and Tools (R92) |
| Milestone 6: Structure | Built: R185, R187–R194, R197 |
| MVP release | v0.1.0, the APK and the website from one tag, after the 11-17 freeze, at the bar: [release-0.1.0.md](../release-0.1.0.md) |

## 2. "Next", the Milestone 6 line (the built list; the not-packaged part stays in the backlog)

- **Milestone 6, Structure:** built: matrices (R185, R187–R190), number bases (R191–R194), Help (R197); not packaged: EN7 everyday functions, EN4 one element of a list or matrix (`L(2)` from the keys indexes, R630).

## 3. "Open bugs", the T6 line (G524, R601 and G618 merged; the rest stays)

- **F400–F414, F425–F442 (T6's hunts, 2026-11-16; evidence in each package and `../drafts/2026-11-16-ultra/t6a/`, `t6b/`).** T6a: G524 (F403, DEG; merged), R601 (merged), G600–G608, R600; T6b: G613–G624 (G618 merged); unpackaged: F409, F410, F413, F430, F438, F439, F442; F440 stays Giac's (owner).

## 4. "Open bugs", the T4 line (R585 merged; the rest stays)

- **F350–F365 (T4's sessions, 2026-11-16; evidence in each package).** F350 G575, F353 R576, F354 G577, F355 R577, F356 R578, F358 R579, F359 R580, F360 G578, F361 R581, F363 R583, F364 R584, F365 R585.

## 5. "Needs the user" item 1 (none open)

1. **Your outreach steps** (decisions.md P18–P22): none open; G77's mirror is up (2026-11-16).

## 6. The intro line

The one place for "where are we and what's left", one or two lines per open item. The architecture is [04-architecture.md](../04-architecture.md) (it supersedes [02-architecture-plan.md](../02-architecture-plan.md) where they differ; 02 section 12 keeps the milestone history); decisions are in [decisions.md](../decisions.md); the order of the packages is [shifts/brief.md](../shifts/brief.md) section 0, and each package's cause, steps and tests are in its file in [shifts/packages/](../shifts/packages/). Done items leave this file (git history keeps them).

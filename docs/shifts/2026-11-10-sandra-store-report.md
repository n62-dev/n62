<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# S53 report: Store, designed (sandra, 2026-11-10)

Base `phase-1` at `510a098b`, branch `p1/sandra-storedesign`. Docs, a mockup and a probe only; no file under `app/src/` changed.

## What I verified
- Store ▶ today, in the code: Shift + ᴇ (`spec/keyboard.yaml:258`) with Ans first on an empty line (`app/src/entry/ans.ts:13`, `app/src/keyboard/route.ts:441`); the row bar's Store ▶ (`app/src/clipboard/actions.svelte.ts:267-271`); a key on a picked row other than ▲ ▼ Enter Esc Copy ☰ units drops the pick (`route.ts:192-213`), so ▲ ▲ ▲ then Shift + ᴇ stores Ans, not the picked row (visible as `Ans ▶`).
- Vars and Memory (`app/src/find/names.svelte.ts`): names newest first with values; no free letters; Vars dead without an entry line (`App.svelte:251`).
- All 52 one-letter names store, read back and overwrite, in Home and CAS: `node tools/probes/store-letters.ts`, `MODE=cas …` (52/52 each; e and i go to `e_`, `i_`).
- **store-bu-1:** a stored 1/3 or √2 is drawn in Vars without its mark (`A = 0.333333333333`), though the name's facts are kept (`engine/defs.ts:133`; `FACTS=1 node tools/probes/engine.ts 'A:=1/3'` shows display `0.333333333333`, facts exact). Written to backlog Open bugs.
- The mockup opens in headless Chromium without errors; both phones are 839 px with no overflow of the sheet.

## What I changed
- New: `docs/research/store-design.md` (open), `docs/mockups/store-2026-11.html`, `tools/probes/store-letters.ts` (+ its row in `tools/probes/README.md`), this report.
- `docs/README.md`: the note and the mockup linked (the task asks for it; the index check needs it).
- `docs/backlog.md` Open bugs: the store-bu-1 line. `docs/decisions.md` Needs the user: "Store (S53)".

## Still (to verify)
- On the G2 (owner): how a picked history row gets onto the entry line, what Sto▸ does with a row picked, and what Vars › Home Vars › Real shows. Proposed checklist items in the commit report.

## Top risks
1. A sheet on every Store ▶ could feel in the way of a typed name: the typed presses stay the same, but the owner's hand test decides (the fallback: open it only from the row bar and ☰ 4).
2. Digits in a typed name collide with the sheets' digit-picks-a-row rule (`route.ts:253`); sd-3 must type them into the name.
3. store-bu-1 is a mark that tells less than the history does; sd-1 should run before v0.1.0 if the owner wants it in the release.

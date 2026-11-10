<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Store, designed: from a result to a name and back (S53)

**Status (sandra, 2026-11-10): open.** The owner picks a design (recommended: the store sheet, section 4) and, with R278, whether Store ▶ gets a tap cell. Labels `sd-1` to `sd-4` are this note's; ids are minted when the packages are written. Base: `phase-1` at `510a098b`. Mockup: [mockups/store-2026-11.html](../mockups/store-2026-11.html).

Words used here. **Store ▶**: the store arrow; `value ▶ A` puts the value into the name A. **Ans**: the view's last result, as a chip on the line. **Chip**: a result put on the line as one unit that carries its full value. **Facts and marks**: what the engine knows about a value (exact, how many digits are sure, a warning), drawn as `=`, `≈` or `⚠ n` before a number (docs/04 2.4). A stored name keeps the facts of what was stored, and a result that reads it inherits them (docs/04 2.8). **Press**: every key, flick, drag or screen tap counts 1 (docs/04 5.2).

## 1. Today, counted

What the code does, checked:
- **Store ▶ on the keys** is Shift + ᴇ (`spec/keyboard.yaml:258`, `\blacktriangleright`). On an empty line after a result it puts `Ans ▶` first (`app/src/entry/ans.ts:13`, `app/src/keyboard/route.ts:441`), as on the G2 (G2 item 58, device). The name is then typed with Alpha: Alpha + Vars types A (`spec/keyboard.yaml:118`); a flick down on Vars types A in one press.
- **Store ▶ on a picked row** (the row bar's fourth button, or ☰ 4) puts that row's chip and ▶ on the line and waits for the name (`app/src/clipboard/actions.svelte.ts:267-271`). The stored name gets the row's facts, because the chip carries them.
- **A key on a picked row:** ▲ ▼, Enter, Esc, Copy, ☰ and the units key act on the row; **every other key drops the pick and does its normal job** (`route.ts:192-213`). So ▲ ▲ ▲ then Shift + ᴇ stores **Ans, the newest result, not the picked row**: the line shows `Ans ▶`, so it is not silent, but the picked row is ignored.
- **Vars** (r4c1) opens a sheet of the user's names, newest first, each with its value; a tap or Enter inserts the name (`app/src/find/names.svelte.ts:40-89`). It is dead without an entry line (`app/src/App.svelte:251`). Memory (Shift + Math) is the same list and deletes. Neither shows which letters are free.
- **Overwrite:** storing into a filled name replaces it without a word; there is no Undo for a store.
- **Every letter can be a name:** A–Z and a–z all store and read back, in Home and in CAS, overwrite included (`node tools/probes/store-letters.ts`, `MODE=cas …`: 52/52 each). The parser renames e and i to `e_`, `i_` (they are constants), which reads back right.
- **Found on the way (backlog Open bugs, `store-bu-1`):** Vars shows a stored value **without its mark**. `1/3 ▶ A` then Vars shows `A = 0.333333333333`; the history shows the same number as `≈ 0.333333333333`. The name's facts are in the list (`app/src/engine/defs.ts:133`) but the row draws the bare display text (`names.svelte.ts:33`, `:59`). Rerun: `FACTS=1 node tools/probes/engine.ts 'A:=1/3'` (display `0.333333333333`, facts exact) and open Vars after `1 ÷ 3 ▶ A`. Family 1 (a carried value loses its facts).

The four tasks. T2's row is three rows up and on screen; T3 counts only getting A on the line (the rest of the line is the same in every design).

| Task | G2 (our records) | N62 today: taps | with flicks |
|---|---|---|---|
| T1 store the last result as A | 5: Shift, EEX (`Ans ▶`), Alpha, A, Enter | 5: Shift, ᴇ, Alpha, A, Enter (core c28's keys) | 3: ↑ᴇ, ↓A, Enter |
| T2 store an earlier row as A | ≥ 9 (to verify): ▲ ▲ ▲, the row onto the line, Shift, EEX, Alpha, A, Enter | 5: tap the row, Store ▶, Alpha, A, Enter; by keys 9 (▲ ▲ ▲, Enter, Shift, ᴇ, Alpha, A, Enter) | 4; by keys 7 |
| T3 use A in a new line | 2: Alpha, A | 2: Alpha, A (or Vars, tap A) | 1: ↓A |
| T4 see what A, B, … hold | ≥ 2 (to verify): Vars opens Home Vars (Real, Complex, …); what the Real list shows is not recorded | 1: Vars (names only, values without marks, no free letters) | 1 |

The G2 column comes from `spec/mapping/vc-2026-10-11/keys.yaml` (r4c1 Vars, r7c1 Sto▸, the pad's ▲ selects the last row) and `tests/golden/g2.yaml` item 58. How a picked row gets onto the G2's line, and what the Real list of Home Vars shows, are not recorded: (to verify) by the owner on the G2, two new checklist questions (report, "For shared files"). The G2's store is the same as ours in presses; what N62 adds today is that the facts travel with the value into the name and out again (docs/04 2.8).

**Where the presses go:** T1 and T2 spend 3 of their 5 presses on naming (Alpha, a letter, Enter), and the user must remember which key holds which letter and which letters are free. T2 by keys is the worst: 9 presses, and the shorter-looking key path stores the wrong row.

## 2. Three designs

All three keep the G2's typed path exactly: Store ▶, then Alpha and the letters, then Enter, gives the same store as today (docs/rules-core.md: on top of the G2 way, never instead).

### Design A: a store sheet (recommended)
Store ▶, from the key, the row bar or ☰ 4, puts `value ▶` on the line as today **and** opens a sheet "Store in" over the keypad (rows 3–9, as every sheet). Its title shows what is stored with its mark (`Store ≈ 0.333333333333 in`). Below: the letters A–Z as a grid, a filled letter with its value and mark under it, a free one plain; then the user's longer names, newest first, with their values.
- **One tap on a free letter stores**: the name is typed after the ▶ and Enter runs, so the store goes through the same parser and engine path as a typed one (one path; the facts flow as in docs/04 2.8) and leaves the same history row.
- **A tap on a filled letter asks first:** the cell arms (`5 · again?`) and the line under the grid says `A holds 5. Tap A again to replace it`; a second tap on it stores, any other press disarms (Memory's Clear all arms the same way, `names.svelte.ts:37`).
- **Typing still works:** Alpha and letters go into the sheet's filter, Enter stores the typed name (a new name too); digits after a letter belong to the name (in other sheets a digit picks a row, `route.ts:253`). Esc closes the sheet and leaves `value ▶` on the line, the G2's state.
- **Store ▶ on a picked row** stores that row (sd-2), so the key and the row bar agree.
- **Vars** gets the same look (grid, then names, values with marks) and keeps its verb: a tap inserts.

| | taps | with flicks |
|---|---|---|
| T1 | 3: Shift, ᴇ, tap A (4 when A is filled) | 2: ↑ᴇ, tap A (3) |
| T2 | 3: tap the row, Store ▶, tap A (4); by keys 6: ▲ ▲ ▲, Shift, ᴇ, tap A | by keys 5 |
| T3 | 2 (or Vars, tap A) | 1 |
| T4 | 1: Vars, or seen on every Store ▶ | 1 |

**Keypad:** needs no move. Store ▶ stays on Shift + ᴇ, the G2's cell. If R278 gives Store ▶ a tap cell (r2c4 or r2c5), T1 drops to 2 presses and T2 by keys to 5; that is the owner's choice with R278, not this note's.

### Design B: Vars stores too
No new sheet: each row of Vars, and a new A–Z part, gets a second button ▶ that stores "the line, else the picked row, else Ans" into that name; a tap on the name inserts, as now.
- T1 2 (Vars, ▶ on A; 3 when filled), T2 3 (tap the row, Vars, ▶ on A), T3 2, T4 1.
- **Against:** two targets per row, one that inserts and one that overwrites, 44 px apart; a mis-tap destroys a value where the user meant to read it. What gets stored is decided out of sight. Every other list row in N62 has one verb; two on one row strains docs/03 rule 7 (one interaction model). The key path stays at 5 presses.
- **Keypad:** none; Store ▶ keeps only the typed path.

### Design C: names on the row bar
Store ▶ on the row bar turns the bar's five buttons into the four most recently stored names and "A–Z…" (which opens design A's sheet).
- T1 3 when A is among the four (4 otherwise), T2 3 (4), T3 2, T4 1 (Vars as today).
- **Against:** helps only the row path; the key path stays at 5; a strip of four names with no values gives no overview and no overwrite question; a second place to look for names.
- **Keypad:** none.

## 3. What the mockup shows
[mockups/store-2026-11.html](../mockups/store-2026-11.html): design A at phone width (412 px) in the N62 theme (dark tokens of `app/src/theme/n62.css`): the history with a picked row, the row bar, the store sheet with filled and free letters, the armed cell, the user's names, and Vars in the same look.

## 4. Recommendation: design A, the store sheet

**Why:**
1. **Fewest presses without moving a key:** T1 from 5 to 3, T2 from 5 to 3 (9 to 6 by keys), and every G2 press sequence still does what it did.
2. **No new way to be wrong:** a tap types the name and presses Enter; the store runs through the parser and engine as a typed one, so the facts and marks through Store stay as docs/04 2.8 says, and the history keeps a row of every store.
3. **It protects a value:** the only design that shows the old value and asks before it is replaced.
4. **It answers T4 on the way:** the free letters and the current values are in front of the user every time they store.
5. **Small to build:** the sheet, its grid variant (Tmpl's palette) and the names with their facts (`session.userNames`) exist; nothing in the engine changes.

**Other designs, one line each:** B is 1 press less for T1 but makes Vars a place where a tap can destroy a value, and hides what is stored; C helps only the row bar and gives no overview.

**What would change it:** the owner's hand test finds that a sheet on every Store ▶ gets in the way of typing a name (then the sheet opens only from the row bar and ☰ 4, and the key keeps the plain typed path); mis-taps on the grid turn out rare in use (then the overwrite question goes, 1 press less on a filled letter); R278 gives Store ▶ a tap cell (then T1 is 2 presses, nothing else changes).

## 5. Proposed packages (after the v0.1.0 tag; ron, one concern each)
- **sd-1, Vars marks its values (FIX of `store-bu-1`; ron, ≤ 0.5 d; before the rest; runs as S53f1, Opus pass 131).** Vars and Memory draw a stored value with the mark the history would give it (the name's facts, `defs.ts:133`), not a bare `=`. Regression test first (a stored 1/3 shows `≈`); a core case: 1 ÷ 3 ▶ A, Vars, the row reads ≈.
- **sd-2, Store ▶ acts on the picked row (ron, ≤ 0.5 d).** With a row picked, Shift + ᴇ (and its flick) does what the row bar's Store ▶ does: the row's chip and ▶, not Ans (`route.ts:192`). Unit test of the route; a core case: 3 results, ▲ ▲ ▲, Shift + ᴇ, Alpha, A, Enter stores the first. The G2's behaviour here is (to verify); the pick is visible, so acting on it is what the user sees.
- **sd-3, the store sheet (ron, ≈ 1 d; after sd-2).** Store ▶ from the key, the row bar or ☰ 4 opens "Store in" (the A–Z grid with values and marks, then the user's names): a tap on a free letter stores, a tap on a filled one arms then stores, typed letters filter and Enter stores the typed name (digits included), Esc leaves `value ▶` on the line. Core cases: c28, c29, c58 still pass unchanged (the typed path); new: 7, Shift + ᴇ, tap A, then A + 1 is 8; a filled A needs the second tap.
- **sd-4, Vars in the store sheet's look (ron, ≤ 0.5 d; after sd-3).** The same grid and list, its tap inserts; dead without an entry line as now. Core case: 7 ▶ A, Vars shows A with 7.
- **With R278 (the owner's choice, not a package here):** whether Store ▶ also gets the tap of a freed cell (r2c4 or r2c5).

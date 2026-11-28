<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Decision log

Phase 0 (D1–D9, P1, P2): [the archive](archive/phase-0-decisions.md). This file holds what binds from Phase 1 on: the choice and its Would change if; "Rule:" names where it is stated in full. "Archived": the full text is in [archive/decisions-2026-10.md](archive/decisions-2026-10.md), found by the entry's name or id (a "Built, archived" line names its section there); read it when a decision is questioned. A decision changes in place (rules section 9).

## Needs the user

The owner's other open items are in [backlog.md](backlog.md), "Needs the user". Once decided, an entry moves to "Decided proposals".

- **docs/06 line 30, user keys (R821):** Recommended: yes, as built (pass 260): "(tap, Shift, Alpha)" → "(tap, Shift; Alpha with a switch, R821)". docs/06 is unchanged until then.
- **R781, Hand = Left:** every key column mirrors, so the digits read 9 8 7 and Redo stands left of Undo (the pad's ◀ ▶ kept); the bar turns, its track and modes read as before; Appearance has 8 rows. Recommended (pass 254): keep the mirror but keep the reading order inside a run (the digits 7 8 9, Undo then Redo, ⇤ then ⇥), a follow-up R781f1 of about half a day, and confirm the lock and docs/06 3b line.
- **G784, Paste of a copied name:** Copy writes letters (`2*i`, `β*2`); Paste reads one number, so `2*i` copied from the name i came back as the constant i (principle 3); G784f1 refuses a text copied from a row with a stand-in. Recommended: keep Paste a number reader; reading expressions is its own package (the letter i against the constant i needs a rule first).
- **The release bar's week (A273, G799; pass 241):** Recommended: a night counts when every `NIGHTLY` finding falls under a package or bug line the pass names (no new cause), as the clock seed never repeats a known row. Night 1 (11-25): all 118 named (G802, G804, G805, G622f2, F145, F480, F487).
- **R779, the drag after the arrow keys, on the Fairphone:** not reproduced in Chromium touch emulation (linetouch.spec.ts R779 cases); lineTouch.ts now ends a stale touch. Does the drag work on the Fairphone 6? If not, record `adb` pointer events for the sequence.
- **K22 after G385:** `80 °C − 5 K` (a temperature less an interval) keeps today's refusal and words, "Use K or Δ°C for a temperature difference"; G385 adds words only for an unbracketed `T1 − T2` in a longer formula. Recommended: keep; 75 °C needs a rule of its own (a point plus an interval), a package if wanted.
- **G315, the import cycle left:** the engine one is gone; the probes (`tools/probes/review-1109/vca-scc.py`, `review-1114/ca-scc.pl`) still find `apps/shellSheets.ts` ↔ `views/sheet.svelte.ts` (R930's re-export at `sheet.svelte.ts:11`, c9074acb, after the package's walk), in ron's files. Recommended: a small ron package that lets the shell take the sheets' rows from the sheet chunk without `shellSheets.ts` importing `Sheet` back (a builder passed in), start chunk and openSheet's wait unchanged.
- **A278, e2e on a built app (measured 2026-11-26):** Recommended: after the tag, and only if A281f1's clipboard per test leaves the e2e round over 450 s: a `vite build --mode e2e` served by `vite preview` is 26–34 % faster per test, but 73 of 207 spec files import `/src/` and need changes (about 1.5 days).

## Decided proposals

### Pipeline and process
- **Decided by Opus passes, rule in code or docs (A64, G125, S2, G133f1, G138, R261, G557, G78, R376):** the nine entries as they stood: [archive/decisions-2026-11.md](archive/decisions-2026-11.md).
- **v0.1.0 (owner, 2026-11-12 and 2026-11-17):** the beta after the layout rows and R744, the release candidate Mon 11-23, the tag Tue 11-24, no history rewrite; before the tag only what the layout lock pins, the rest in v0.1.1; the bar and what v0.1.0 keeps for good (point 7): [release-0.1.0.md](release-0.1.0.md).
- **Owner answers of the night and architecture reviews:** section 6 of the archived [11-09/10](archive/night-review-2026-11-09.md) and [11-14](archive/night-review-2026-11-14.md) reviews; [11-10's arch review](research/arch-review-2026-11-10.md) section 3; [11-16's](research/night-review-2026-11-16.md) section 5 (Function and Solve open after the tag; `5 % 3` kept). Each package rewrites its line here when it lands. Would change if: the G2 or an outside round reads one otherwise.
- **Owner answers of 2026-11-15 (Needs the user), still binding:** the unit view's raise (entries 42 kB, pin 78.55 kB; the first unit result < 1 s on the Tab One), G164's sources "to verify" at v0.1.0, S45 (units in Solve, [the note](research/r-solveunits.md)) and R330 after the tag, S50's G2 column from the owner's G2 (`source: device`), Shift + a b/c and Fmt reserved. Archived.
- **Owner answers of 2026-11-15, evening:** RPN (mh-D1) before the freeze, with units and ± on the stack; Geometry and a second keypad not planned; the test nights one lane, fixes only: [must-have.md](must-have.md) sections A, D and E, [release-0.1.0.md](release-0.1.0.md).
- **F-Droid Reproducible Builds (owner, 2026-11-15):** unticked at v0.1.0 (A158). Archived. Would change if: a deterministic engine build exists before the F-Droid request (the box cannot be ticked later).
- **P25 (owner, 2026-11-08): auto or hands-on, around the clock; on Max since 2026-11-20 (Pro 11-19 to 11-20, A262).** Rule and numbers: brief section 0; the daily stop (05:00, 07:00) and the day's budget: rules section 4a. Would change if: the plan cannot carry the queue.
- **The name N62 (owner, 2026-11-05):** id `dev.n62.calc`, never changed after the v0.1.0 tag; the web `https://n62.dev/` from a release tag (A45); repo `n62-dev/n62`; spelling: docs/rules-core.md. Archived. Would change if: TMview finds N62 in class 9; the domain lapses.
- **P23 (2026-10-21, ended 2026-10-27, owner): the core freeze's net stays;** the list changes only with the owner. Rule: brief section 0, `tests/core/README.md`. Archived.
- **The docs budgets stay (owner, 2026-10-20):** brief 40 kB (2026-11-10), backlog 20, decisions 40; when decisions.md has under 1 kB left, the Opus pass moves the full texts of built entries to the archive and keeps a short line.
  - **S55's targets:** brief, decisions and docs/04 at 90 % of their budgets; the backlog at 19 kB (its open lines stay word for word, S55 rule 1). Would change if: the backlog fails a package's docs check twice in a week.
- **P17 (2026-10-18; two lanes 2026-10-29, owner): the pipeline is the only path** (`scripts/pipeline.sh`, brief 0c; two lanes, one merge queue, A47b). Archived. Would change if: the queue's waits cost more than the second lane gains.
- **Small packages (2026-10-14, the owner's rule).** One concern each, about a day or less, with its own reading list; placed by importance, then dependencies.

### Feel, keys and screen (milestone 4a)
- **The rainbow egg (owner, 2026-11-22, point 18; R881):** rainbow then Enter, for the session only (never stored); typed again, a theme pick or a restart ends it; a stored one-letter name among its letters keeps it a calculation; its turning keypad is an exception to docs/05 rule 6, still under reduced motion. The key texts are grey while it is on (pass 248: the one way found that keeps 4.5:1 at every turn). Rule: docs/05 "Rainbow". Would change if: the owner's look on the phone.
- **Help explains the highlight (owner, 2026-11-22):** cursor, Find's row, then the unit view; cards from the index only (R869, R870).
- **Key legends (owner, 2026-11-17, R729):** nothing on a key moves: the face is the tap, the corners their layers; armed a ring, locked a fill on keys and bar; the rest dims (docs/05 3.7, 3.10; [the mockup](mockups/key-legends.html)). Would change if: the 11 px lit legends misread in daily use.
- **Template letters italic (owner, 2026-11-22, R864):** R142 also covers the letter that stands for the operand (x², xʸ, ⁿ√, |x|, x⁻¹, eˣ, 10ˣ, the unit pad's powers) and the Alpha key's a and A; a b/c stays upright (docs/05 3.10). Would change if: a legend becomes hard to read at 360 px.
- **Enter's rule (owner, 2026-11-22, R872):** docs/05 3.10; values: theme-gen.test.ts. Would change if: his phone.
- **Round pad and key line floors (owner, 2026-11-22, R873):** docs/05 3.10; values: theme-gen.test.ts. Would change if: his phone.
- **Super mode dropped (owner, 2026-11-22):** no super mode; Select then ⌫ deletes a block; the unit view's slot buttons (R853), Your keys one window (R849, R848), N62 Light's Enter (R843). Built; full text: [archive/decisions-2026-11.md](archive/decisions-2026-11.md).
- **Owner answers of 2026-11-21, night:** R128: another device's newer backup is offered as soon as the folder is chosen (the same one offer; R855). R770: a sheet under 120 px drops its margins, as built. R780: `.` and the space bar pick rows 11 and 12; longer lists number 1–10 and take letters, as built. G369: a % chip in Home is its pure number (0.42 % is 0.0042; G782).
- **Touch, keys and Store (owner, 2026-11-10; the keys 2026-11-12):** as built (docs/05 3.5; docs/04 5.5); the keys: [06-keypad-vs-g2.md](06-keypad-vs-g2.md) section 3b. Archived. Would change if: A139 shows the gestures clash on a real WebView.
- **Built, archived ("2026-11-17, the fix lane"):** R140's colour-vision floors (owner, 2026-11-07); R50 (owner 2026-11-07): three themes; Redo after ⌫ (R15c2).
- **Owner answers of 2026-11-02 (vision; interview with sandra).** A working engineer, phone first; units and constants first; no AI in the app; marks, σ and digit groups each a setting. Archived. Would change if: an outside round shows another first user.
- **Owner answers of 2026-11-02.** Stored names (R33) get a colour token per theme; the app's switch alone decides key vibration (A9, R112); the splash Dark (A59); the bars follow the look (owner, 2026-11-22, A266). Archived. Would change if: users want the system switch to mute the keys.
- **Bulk resets ask once (owner, 2026-11-22, R857); one-slot clears do not.** Archived. Rule: docs/05 3.4.
- **R4b's four defaults, as built:** Memory's tap, Enter or hold copies a name's full value (R815); deleting is its swipe or Shift + ⌫ (R813, R814), without asking (Clear all asks once), with a one-level Undo (R314); a Find pick for a slot closes the sheets; a key's constant keeps its value and σ; Vars is dead without an entry line. Archived.
- **R15c Store (owner, 2026-10-19; G2 item 58, device):** Shift + ᴇ (Store ▶) on an empty line after a result starts `Ans ▶`, as + − × ÷ do; built in R15c2.
- **The bar on the keypad (R722, R783, R785, R856) and P16's fold (R53, R283, R724, R786, R782, R868, R928):** built; rules docs/05 3.2, docs/03 rule 9; full text and the Would change if: archived ("Moved 2026-11-26").
- **Keys of 2026-11-17 (owner, R723):** row 0, col 4 is Settings (⚙), Shift Help since R863; Shift + Select is Copy, Shift + Deselect Paste, Shift + Vars Chars (R725); Mode has no key (`STD 12 ▾`, an app's ☰ › Mode, a user key, Alt + Shift + O). Rule: docs/06 3b, docs/05 3.2. Would change if: Shift + Select is pressed fewer than 10 times in four weeks (`select:shift` and `select:up`); then that cell is reserved.
- **Modifier locks (owner, 2026-11-17, R726; 2026-11-20, R783):** a Shift tap arms, a second locks, a third ends it, as Alpha's; with Alpha on, Shift stays one-shot; the sign's tap is a screen press (docs/04 5.2). Rule: docs/05 3.2, 3.10; docs/06 section 2, 3b. Would change if: the owner, after two weeks of daily use, misses the one-tap undo of a stray Shift.
- **Settings on the tap of row 0, col 4, Help on Shift (owner, 2026-11-22, R863):** the face is ⚙ (U+2699 U+FE0E, text style; the word fits the key at 360 px only at 10.7 px), the legend Help; the id stays `help`; F1 stays Help, Alt + Shift + M Settings. Two moves in spec/layout-lock.yaml (v0.1.1). Rule: docs/06 3b, docs/05 3.2. Would change if: people reach for Help by the tap, or the ⚙ draws as a colour emoji on the Fairphone (R863f1: an inline SVG).
- **Fmt names its notation only on request: Shift + Fmt opens the cycle's page, its switch Say the format (off) (owner, 2026-11-22, R871).** The notice's words are short (Std, Sci, Eng, Pfx, Fix; Exact for a CAS row; pass 248). Rule: docs/05 3.4.
- **Chars on Shift + Vars (owner, 2026-11-17, R725):** a sheet of Greek letters and an engineer's symbols over the view, the digit keys uncovered (docs/05 3.1); a cell the parser refuses (≈, Å; µ on a maths line) types nothing and the notice gives the parser's message; in a name prompt every cell types. Would change if: under 10 picks in four weeks (`vars:shift`; the sheet goes and the cell is reserved again).
  - **Its questions:** the unit view's pad keeps yd on Shift + Vars (a typed µ is the prefix there, Ω the ohm); ± from the sheet in an app inserts and the parser says why. Would change if: the owner wants Chars on the pad.
- **R15b (2026-10-17): cluster rows 36 px; APP▾ 36 × 28, every bar target at least 28 × 28 px** (R82f2; owner, 2026-11-20, R782). Archived. Would change if: 36 px keys are mis-tapped on the phone.
  - **⌄'s place (R724's question):** owner, 2026-11-20: ⌄ on the bar, a 28 px target, so the entry line keeps its full width and a tap on the first term is the line's. Would change if: annabell's Fairphone check finds ⌄ hard to hit.
  - **Store ▶ keeps the fold (owner, 2026-11-17, R740):** the sheet "Store in" opens over the history with the keys down; a folded sheet ends with New name…, which brings them up. Would change if `store.new` is over half of folded stores in four weeks (then Store ▶ unfolds again).
- **R21 (2026-10-14), changed by R770 (owner, 2026-11-19: every window in the viewport): every sheet rises in the viewport over the history, Settings too, never over the keys;** a sheet taller than the viewport scrolls inside its box. Archived.
- **Find stands out, way A (owner, 2026-11-22, R865):** a lens in the Find key's top-right corner and a 4 px foot bar, in `--ring`, in every view; no fill (Enter's) and no ring (armed). Rule: docs/05 3.10. Would change if: the bar is read as "armed".
- **The pad's sideways drag steps per number or name (owner, 2026-11-22, R867):** a token is a digit run, the ᴇ mark with its sign, or a letter run; boxes, chips, names and operators as before; taps, the hardware arrows and a tap on the line stay one character; Ctrl+← → the same as a drag. Changes P7 (1). Would change if: the owner finds the overshoot worse than the gain on the Fairphone.
- **Find's query takes a hardware / * ^ (pass 259, G402; R946):** in both views a hardware `/`, `*` or `^` types itself, never its key's Alpha letter (`kj/kg` read `kjtkg`); touch keeps docs/04 3.7. Would change if: the owner wants the pad key's letter.
- **The letters stay on the keys (2026-10-14).** Rule: docs/04 5.1 (the letters; the unassigned Shift cells). Would change if: Alpha taps near zero (P7 point 4); a function in the benchmark needs a key and no cell is free.
- **The Ultra terminals' answers (owner, 2026-11-16; T1 to T6):** [the archive](archive/owner-answers-2026-11-16.md); each package file and the brief's rows state the answer they build.
- **The release key (owner, 2026-11-16):** alias `n62` (`android/release-cert.sha256`) replaces the Pascaline one before any release; the four secrets keep their names.
- **Home/CAS ☰ of four rows (owner, 2026-11-20, R830):** Delete, Share session, Clear history, Export ›; built. Rule: docs/05 3.3, 3.5. Archived ("Moved 2026-11-23"). Would change if: the counters show keys-only users missing Copy or Paste on ☰.
- **User keys: two layers, a switch for the third (owner, 2026-11-20, R821):** U1–U6 have tap and Shift; Alpha (a flick down, its legend bottom left) is Settings › Your keys › Third layer (Alpha), off first, on once when an Alpha slot is stored; a stored slot is kept while off. Rule: docs/05 3.4. Would change if: users set Alpha slots often.

### Precision, engine and parser
- **G141: a literal past `MAX_EVAL_DIGITS` makes the value ⚠ unchecked,** a power of ten too; G126's and G153's rows turn ⚠ until S20.
- **P7, P11, engine defaults, R15c1 menus, M4-2 (2026-10-12 to 10-20):** rules in docs/03 rules 5–13, docs/05 (the trackpad, a sheet scrolls), P5 below and `tests/tasks/benchmark.yaml`; the entries: [archive](archive/decisions-2026-10.md) ("Moved 2026-11-28").
- **P19 (2026-10-20): a Giac bug is fixed at its cause** (patch, canary, link to Parisse; a TypeScript workaround only for a cause that is not local, registered in S17). Rule: `docs/rules-core.md`. Archived.
- **P20 (2026-10-20; narrowed by G85's GO, 2026-10-22): Giac's tree, not its text.** Names, stores, bound names, settings and a value's kind come from the bridge (`bridge.ts`); only Giac's print is read as text, in one module (G105); new code adds no bracket loop or name regex (the text baseline, G88). Would change if: a question the bridge cannot answer.
- **P24 (2026-11-08): commercial reuse of our Giac fixes** is permitted to B. Parisse (email 13). Archived. Would change if: a contributor other than the owner writes a Giac fix.
- **R58b (2026-10-19; built by R67): a letter typed with Alpha is always a name,** in CAS too; e and i come only from their keys. Archived.
- **An undecided decision is refused (owner, 2026-10-19; built by G57):** a sign, comparison, floor or branch on a cut Giac cannot decide is refused as undecided, never a guess. Would change if: refusals turn up in everyday work where a ⚠ value served better.
- **Built, archived (Opus passes 259, 260):** F29 (G21), Stored definitions (G3), research to the docs, the pipeline merges what it audited, the start chunk pin in archive/decisions-2026-10.md; rules in code, rules-core, docs/04 6.2 and 8.3.
- **R29: the parser's messages, and a space between two numbers (2026-10-17).** The messages are i18n keys (R52); a space between two numbers is an error ("put × between two numbers", R51), though the G2 gives 6. Archived.
- **R18f1, R18f2 (2026-10-14): tests.** An exact true/false carries no mark; a test with a float side runs again at 14 and at P digits (true ≈, false ≈, or as typed). Archived. Would change if: a function is audited.
- **P9 (2026-10-12): typed decimals in the CAS view become exact, as in Home;** `approx()` gives marked decimals.
- **P10 (2026-10-12): Giac's English help lines in Find.** Confirmed by B. Parisse (email, 2026-10-19): `aide_cas` is entirely GPL; the non-GPL French documentation means R. De Graeve's LaTeX/PDF manuals.
- **G783:** a free name keeps ln(1/x) and sqrt(1/x); the rewrite needs a proven positive argument (owner, 2026-11-22).
- **P5 (2026-10-11; owner, 2026-11-16): behaviour against the reference.** The maths is Giac's wherever possible; it departs only where Giac gives a silent wrong answer. The G2 guides the keys and the flow, not the maths: its Home is HP's own engine, so a G2 result alone never changes a result, and no G2 question asks about maths. Home keeps Giac's principal root (complex `sqrt(-4)`, `asin(2)`), the ∛ template, Function and Solve the real odd root (R39). Archived.
- **P8 (2026-10-12): the engineer core:** milestones 4, 5, 6, each with benchmark tasks; fewer features done well beat G2 parity.
- **P4 (2026-10-11): the reference's logical key layout, our own look;** ▲ on an empty line picks the last history row.

### Units (milestone 5)
- **Ans in history (owner, 2026-11-20, G642/R836):** frozen in the history row, live on the entry line, a recalled row comes back live. Rejected: literal digits (1/3 ×3 gives 0.999999999999 or ≈1, σ and unit lost), Giac text (radians, no text over 2 kB), numbered ans1/ans2 (numbers shift when rows are deleted). Would change if: the G2 re-resolves a recalled Ans differently (tests/golden/g2.yaml question) or daily use asks.
- **Ans in the unit view (R259; owner, 2026-11-12):** no slot before v0.1.0; an Ans with a unit or σ is refused, naming its row's chip. Would change if: daily use asks (≈0.5 d).
- **Prefix entry (owner, 2026-10-31; night review fh-8):** Home has none; a prefix goes in the unit view's prefix cells (P11, docs/05 §7.2), and docs/04 2.7's prefix chip is dropped.
- **U1–U6 over the unit pad (R838; pass 230):** while the pad is up they are its cells (R24d), so a user key that holds Settings or Mode does not open it there; Shift + Help, the bar's chip and Alt + Shift + O do. Would change if: the owner wants his user keys over the pad.
- **Formula, then units (owner, 2026-11-16):** letters get unit slots; → Check turns the end slot on (R349); Store ▶ in the view (R353); SI names, no J or Hz (G389).

## Defaults

The defaults that bind code and tests, one line each. A default changes when its "would change if" happens or the owner says so.

**Entry and keys**
- **Built, archived ("2026-11-16, Ultra"):** Shift + 5's matrix (R185, R186); R194's word; The matrix grid (R188, R189, R300); R277's line scroll; R279's Select; R116, the entry's highlights; View keys and the load queue.
- **A digit on a disabled sheet row (R862; pass 232, docs/05 rule 4):** a dead press: the short haptic "no" in every sheet (`Sheet.activate` runs nothing today, silently); backlog "Without a package yet". Would change if: the owner wants disabled rows silent.
- **R299's lock:** `UNPINNED_LISTS` stands; Plot's and Solve Num's ☰ are pinned with their last rows. Would change if: one of those lists gets a fixed row.
- **R130's tenth ☰ row:** it keeps the 36 px floor and scrolls; rows 1–9 stay, key 0 opens Export › (docs/06 3b rule 2). Would change if: the owner's look on a phone.
- **⌫ and Del keep a template whole** (R23–R26h, R47): never half a template or a lost box. Archived. Would change if: G2 items 44, 46, 49 or 51 differ (the G2 way wins unless it leaves half a template).
- **The cursor stops only at a box** (R27b) **and goes where the user aims** (R42, R43). Archived. Would change if: G2 items 50 or 57 differ.
- **Store ▶ on a picked row (R280):** every key holding ▶ stores as the row bar's Store ▶; no result: the double haptic. Archived. Would change if: the G2 differs (store-design.md 1).
- **Row gestures (R276):** a hold copies at 500 ms, a swipe goes at 40 % of the row; delete from the right only, behind a red strip; right is reserved (owner, 2026-11-17, R743); would change if over 10 % of row swipes in four weeks go right (R70's counters `swipe.right`, `swipe.left`). Archived.
- **History pick by part (owner, 2026-11-20, R832):** a tap lights the input or result it hits, else the whole row; the keys take what is lit, Delete and Share the row; the notice names the copy's start, with a digit count only for one plain real (R904). Rule: docs/05 3.5 (R858). Would change if: keys-only users cannot light an input (then ◀ ▶ switch a pick's part).
- **R903's line hold (pass 243):** it copies the line (or the selection it had) and still lights the term under the finger (R277). Would change if: on the device the lit term reads as all that was copied.
- **Find words with no function (G401; pass 258):** `cylindrical`, `spherical` and `percent change` stay out of Find: Giac has no command for them. Would change if: EN7 brings the functions.
- **R198's typed names:** a typed FUNCS or Find function name before `(` is the function, drawn by name; Giac's program words stay letters (R198f1). Archived.
- **R224's wide layout:** the keypad in a 42 % column of 400–560 px (`--keys-wide`). Archived. Would change if: the owner's look on the Tab One.
- **Nothing takes focus while the app is away** (R25a–c) and **Focus on return:** MathLive's own restore is off (R22). Would change if: a desktop browser loses the caret after switching windows.
- **Flicks** (R9): arm at 20 px, cancel within 12 px; **Alpha lock:** Alpha twice locks capitals, Shift Alpha Alpha lower case. Archived.
- **R58: in the CAS view Alpha types lower case.** Archived.
- **A selection is the argument of the key** (R17); **powers bracket a compound term before the cursor** (L8). Archived.
- **The exponent mark** (R14): `\emark` drawn `ᴇ`, one number literal; `1ᴇ` on an empty line, after an operator, a bracket or a comma, and at a box's start (G2 item 40); a non-integer exponent is an error.
- **Tmpl and a b/c** (R10): one toggle per result type; ° and DMS mean degrees in every angle mode. Archived.
- **Enter during a job:** starts nothing, the line stays (`session.submit`). Would change if: the owner wants it queued.
- **Sheets** (R7, R8, R21a): the last pick per sheet in memory only; Settings opens on its first row. Archived.
- **User keys** (R15b): a slot is `{ label, action }` in keyboard.yaml's action form, null empties it, the user's choice wins over a default.
- **Keypad legends** (R6): a key is dimmed when its layer gives nothing; 4.5:1 contrast. Shift + 4 reads Mat (R187, pass 170). Archived.
- **The kept line** (R34): `{ view, latex, chips }` under `entry`, written on hide once settled, restored only into its view.
- **An app's line stays with the app** (R76, R76f1, R262): cleared on the way back to Home or CAS. Archived.
- **Working… after 150 ms** (F8): the busy line and Cancel are drawn late; Cancel works from 0 ms.
- **One-line mode:** `^` is literal and the exponent is the next signed factor. **Results are insertable**, bracketed when a sum. **Default angle mode: radians.**
- **R112: a key drawn dead, or a press the route's one rule finds dead (route.ts deadPress), gives the double pulse alone, no look, pop or click; every other key gives one pulse at finger-down.** The unit pad's dead presses keep three (the touch's, then the double; docs/05 3.7), as does a sheet's Paste of no name (R900, a late clipboard read).
- **R144, R146, changed by R770 (owner, 2026-11-19: every window in the viewport):** the keys stay live below an open sheet and drive it; a key it does not use is dead and the sheet stays. Rule: docs/05 3.1. Archived.
- **R157, the mark:** `--mark-faint` is the hint's colour at 1.25:1, ≤ 1.3:1; Home's glyph is a house (R874, R856: owner, 2026-11-22), 16 × 16 on the bar and in the Apps sheet; shown whenever the view is empty (R860); no tap (owner, 2026-11-23, R924). Archived. Would change if: the owner's look on his phone (B&W Dark, N62 Dark).
- **R933's key fills:** against the keypad's `--panel`, where the keys sit, and darker in Solarized Dark and Light and B&W Light (the owner's "a touch darker"); High contrast unmoved. Would change if: the owner's look (backlog Needs the user 12).
- **N62 Light's Enter orange (owner, 2026-11-20, R843):** #c26a00 with a black label (his pick A from R842's page, 2026-11-22); Dark keeps #529997. The family's `edge` (#529997) keeps the unit pad's prefix cells teal (and R840's window edge). Would change if: users press Shift for Enter (or the reverse) in Light.
- **R795, Plain keys (owner K3, 2026-11-20):** the keys keep their family's fills (Black & White its two neutral tones, unchanged); only the legends' colour coding goes (it reverses R50's "one neutral tone"). Would change if: the owner's look on his phone.
- **The tips' text stops at 17 px** (R171, R722): seven cards (R352) fit 360 × 740 at scale 2.0 with a 6 px gap, 8 px padding. Would change if: the owner wants them to scroll.
- **A sheet that cannot fit at its floor scrolls, at 360 × 740 too** (R148f1; docs/05 3.1). Archived.
  - **Under 1000 px tall with R722's 43 px rows too (R722's question):** Plot's ☰ after a Root, Mode › Digits, Numbers and Appearance scroll at their floor at 412 × 915 and on the Fairphone 6. Would change if: the owner's look at the beta wants them whole (a 32 px floor, measured by R722, brings back Plot's ☰ and Digits).

**Engine, precision and formats**
- **kindOf on a vector led by undef (G365; pass 258):** api.cc `kindOf` calls `[undef,1]` undef (Giac's `is_undef` reads v[0]); bridge.ts `noValueOf` tells it apart by shape or tree, so nothing shows wrong. api.cc changes (is_undef on a non-vector only, with the golden gate) in the next package that rebuilds the engine for api.cc. Would change if: code reads `kind` without `noValueOf`.
- **Honest precision** (G2): rule: docs/04 2.4 rules 2–3; assignments evaluated once. **G44, G23:** the inverse distributions are solved against our MPFR forward functions, every fallback keeps ⚠. Archived. Would change if: a G2 user types Giac's aliases.
- **Built, archived ("2026-11-16, Ultra"):** G154; G148, G148f1, G148f2; The session line (G210, G211); Copy as Python (G213, G214); A stored name's mark in Vars (S53f1); R258: a stored value of more than one letter is `\operatorname{name}`. The Plot draws a stored real value (owner, 2026-11-16; R361); user functions are not drawn.
- **G307 past the cap:** a huge `pi^n` or `exp(n)` past `MAX_EVAL_DIGITS` counts for the value only in a small value or an argument read modulo 2π (G348); then ⚠; a decision always counts it. Archived. Would change if: S20.
- **Built, archived ("2026-11-17, the fix lane"):** G22, G26, G371; G92, G93; The angle mode, route R (S14, R64, G46); R18; Home number formats; Solve and Plot; Function app; Parser (L6); Discrete distributions (G113, G113f1); G140; R55; R36f1; t06 and Find (R221); G158; Unequal shapes are refused.
- **Home and CAS share one Giac context, each with its own Ans** (`pasans`, `pcasans`). Would change if: G2 item 52 shows separate variables.
- **R39 (Function, Solve; S12):** a literal fraction exponent is reduced first (`(-8)^(2/6)` = −2); the root template stays the real root in every view.
- **G5:** a list's mark: docs/04 2.4. **Chips and Ans** (R2): rule: docs/04 2.8; a chip has two arguments (key, shown); an operator on an empty line starts with Ans only when the view has a result.
- **Time limits:** CAS 10 s soft budget, Giac's 600 s net; Solve and analysis 30 s; Home and units a 4 s watchdog from engine-ready (G185); Cancel replays the definitions only. Archived.

- **The deep check of 2026-10-19 (G38, G57, G48, G39).** Rule: docs/04 2.4. Archived. **G328 (pass 153):** a name set beside the result takes the facts of what sets it; after a decision on the line, the line's (G48).
- **`full` of a result that is not exact (G302):** the rpn stage compares it by value, an exact one as text. Archived. Would change if: a user sees the two forms differ.
- **A complex element in median and the quartiles (pass 229, principle 3):** refused, never sorted as 0 (`median([1+i,2+i,3+i])` was 0); built by G786f1 (patch 0058). Would change if: the owner wants an order on complex data.
- **arg(0) and atan2(0, 0) (G362):** both are 0, as Giac gives them and as C's atan2 and Python's cmath.phase do; Find's lines say so. Would change if: the owner wants the angle of 0 refused.
- **G806's float pivots (pass 249):** det or rank of a float matrix is ⚠ without a count when patch 0071 warns, a singular typed one too: `rank(approx([[0.1,0.3],[0.2,0.6]]))` is ⚠ 1 (its doubles are exactly singular, 0.2 = 2·0.1, 0.6 = 2·0.3, but equal inexact products look like a coincidence; the golden row's note is wrong there); `rank(approx([[1,1],[1,1]]))` stays =. Would change if: the patch proves a product pair equal.
- **G404's climb (pass 249):** its top level is CLIMB_TOP = 980 (the check's second run at MAX_EVAL_DIGITS); infinite at every level is ⚠ past the cap when its stated size is within MPFR's range, else an overflow; CAS approx and evalf climb as Home's; a list element past reach leaves Giac's text. Would change if: a value finite only from 981 digits.
- **Built, archived (Opus pass 253):** G19, R87, G116 in archive/decisions-2026-10.md, G212, G232 in archive/decisions-2026-11.md; their rules stand in code.
- **Archived (Opus pass 254; rules in docs, P19, P20):** S1, S4, S6, S8, S13, S14, P12, G58, G59, G34's check in [archive/decisions-2026-10.md](archive/decisions-2026-10.md), R98 in [archive/decisions-2026-11.md](archive/decisions-2026-11.md).

**Units**
- **Built, archived ("2026-11-17, the fix lane"):** G17; G13, G7; R24a, R24af1; R61; R63; R92; The deep check of 2026-10-19 (G41).
- **G18:** ± is `pasupm(value,sigma)`, each an independent standard uncertainty in the slot's unit; ± inside sin, cos, tan works. **G25:** a typed product is kept when at most one token carries a prefix or its factor is 1 (N·m, kW·h), else SI with a prefix.
- **R28:** rule: docs/04 4.3 (slot order, the end slot, there only after → Check, R349; a formula with no number keeps it and hides the button: Enter has no other slot); a slot only right after a number literal; σ is a number literal, `n %` of the value (R104) or a result chip (R271, R271f1; both docs/04 4.2); a product with a slot keeps its brackets.
- **Built, archived ("2026-11-16, Ultra"):** G161; G143: σ through a step function.
- **R60:** the alternatives row (units/alternatives.ts) takes a temperature's three units (absolute K, °C, °F; interval K, Δ°C, Δ°F) and no target; Δ°C is K's Find alias, so its tap shows K. Would change if: R62 labels the alias.
- **G392's note:** "unit dropped" rides in the row, never in Copy as shown (R325). Archived.
- **R201, R353:** Made of is typed text; a unit is not renamed; Store ▶'s title keeps the mark. Archived. Would change if: the owner, after his try on the phone.
- **G370's shape (G385):** a bracketed `(T1 − T2)` of one absolute scale takes part in arithmetic, nested too (owner, 2026-11-16): an interval in K, each side checked against 0 K; unbracketed in a longer formula it is refused, the words asking for brackets; a side is a number with no × or ÷ outside brackets times its unit (`2*80 °C − 20 °C` is no difference, was 140 K). Rule: docs/04 4.3.
- **A constant's own unit (G801; pass 244):** NIST's CODATA unit column as Find ids (`find/units.yaml` ownUnit), except h and N_A·h in J·s (owner), c_1L in W·m² (no sr in the dimension key), G_F in J⁻² (GeV⁻² is not coherent), k_e in N·m²/C²; a product of constants' units only when it has fewer symbols than the base form (R·T/p in m³/mol). Would change if: an engineer reads one otherwise.

- **σ's digits, one rule (R883, R885; pass 248):** every σ (a constant's, a typed ±, a name or chip) mutes the value's digits from σ's first digit's place on (`2.5 ± 0.1` mutes its 5); σ is drawn at 2 significant digits, PFX too (`4.70 k ± 0.10 k`), the value at least to σ's last digit and in σ's form; the unit view's second line writes σ at 2 digits (the full σ: the σ sheet, Copy). Rule: docs/04 2.6 (R885). Would change if: the owner wants σ at one digit.
- **A value with σ (R884):** muted digits by default; Rounded to σ is a setting (owner, 2026-11-23).
- **R807's look (pass 257):** the caret a 1.5 px `--text` bar; armed `--key-on`, rare `--warn`, empty □ muted. Would change if: the owner's look.
- **A ratio chip (G369, G782; pass 229):** its pure number wherever it goes, the unit view's slot and Store ▶ too. Built, archived.
- **The check of 2026-10-19:** a zero term keeps its dimension for the unit check (G35). Would change if: the per-term check costs more than the 5 ms p95 bar.


**Library, release and process**
- **Built, archived ("2026-11-17, the fix lane"):** R59, R59f1; R89; R40, R124, R125 (owner, 2026-11-04); R156; A66; G218, G219, G233, G234.
- **The release path (A7, A8, A45, A48):** APK and website from one tag; golden on the release engine before signing; the web names frozen; `master` follows phase-1. Archived.
- **Releases:** the engine built in the pinned container (P2), `setarch -R`, bit-reproducible. **Minimum WebView:** Chrome 111 (R160; minSdk 24). Archived.
- **Tests:** the golden gate as docs/04 7.3; values `derived` or `oracle`; timing tests skip their assertion under load; a DOM count is a Playwright test (R132). Archived.
- **Built, archived ("2026-11-16, Ultra"):** A47b; A45; R38b, R88; G119; G172; A101.
- **G798, what a law's side claims:** `=` its exact value, `≈` every shown digit, `⚠ n` n digits (as the sweep's judge reads it), a bare `⚠` or `⚠ 0` nothing; so G622's inverse with ⚠ 14 on a wrong matrix fails its law. Would change if: the owner reads "with ⚠ on either side it passes" as every ⚠.
- **G798's det rows (pass 239):** F479's rows join G622; patch 0068 fixed them (seed 20781: 3 → 0). Would change if: they return.
- **Start chunk room (owner, 2026-11-09):** a package over the pin raises it as docs/04 8.3 says; one over the 63 kB budget gets a cut, never an allowance. Would change if: the owner moves the budget.
- **R918, the unit view's entries budget (owner, 2026-11-24):** 42.6 kB, for the history-tap guard (0.59 kB). Would change if: the owner wants it cut.
- **R872, R873 contrast (owner, 2026-11-24):** N62 Light HC Enter stays 2.79:1 (its label 7:1); Solarized's pad arrows stay 4.03 and 4.28:1. Would change if: the owner's look on the phone says otherwise.
- **R892's strip, no (owner, 2026-11-24):** the fill button goes to the title row and Chars has none (R931); Find full by default is a setting, off (R932). Would change if: his look on the phone says otherwise.
- **R163, Key pop-ups (ron, run 763):** one switch for both bubbles over the keypad; a look stored before R163 has it on. Would change if: the owner wants the pop and the flick bubble apart.
- **R53, R159:** Counters: Shift and Alpha share a row (seven rows); `uses` is not backed up. Would change if: the owner wants the counts apart.
- **G618 (run 1361):** Σ to ∞ is checked against its terms only for a term rational in k, or (−1)^k times one, poles left of start + 100. Archived. Would change if: the owner wants every term estimated.
- **R361f1:** the names a Plot slot reads are Giac's tree of its text (a bound k or t is none); a call of a function with no definition (`f(x)`) notes "F1 uses f: not drawn, it holds no value"; a stored user function stays silent. Would change if: user functions are drawn (after the tag).
- **G576:** a power past Home's power limit is ≈ even when the input makes it exact (`10^(10^6)` ≈ 1E1000000): the float path proves no exactness and ≈ is never false (principle 3); no package. Would change if: the exact path can state such a power.
- **A280 (pass 246):** docs/backlog.md and find/ plan no e2e (no core case has a `known:` id). Would change if: one gets one.
- **A257's queue (pass 254):** a try without a wait (`devlock.sh acquire … 0`) takes only a lock nobody waits for, a free one too, so a poller never jumps the queue; `lock_wait` then waits in it, its log line naming the holder `?`. Would change if: a caller needs a free lock at once.
- **G524:** after a rejected pole the search goes on, so a real root found may not be the nearest; "no root found" only when no bracket holds one. Archived. Would change if: the owner wants the nearest root.

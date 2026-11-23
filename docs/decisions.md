<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Decision log

Phase 0 (D1–D9, P1, P2): [the archive](archive/phase-0-decisions.md). This file holds what binds from Phase 1 on: the choice and its Would change if; "Rule:" names where it is stated in full. "Archived": the full text is in [archive/decisions-2026-10.md](archive/decisions-2026-10.md), found by the entry's name or id (a "Built, archived" line names its section there); read it when a decision is questioned. A decision changes in place (rules section 9).

## Needs the user

The owner's other open items are in [backlog.md](backlog.md), "Needs the user". Once decided, an entry moves to "Decided proposals".

- **G784, Paste of a copied name:** Copy writes the letters (`2*i`, `r*a*i*n*b*o*w`, `β*2`); Paste reads one number, so a product of names is refused, and `2*i` copied from the name i came back as the constant i, another value (principle 3): G784f1 (pass 231) refuses a text N62 copied from a row with a stand-in. Recommended: keep Paste a number reader, so a copied name does not paste back; reading expressions is its own package (the letter i against the constant i needs a rule first).
- **R779, the drag after the arrow keys, on the Fairphone:** Chromium touch emulation could not reproduce "drag, arrow keys, drag" (linetouch.spec.ts, R779 cases, green on phase-1 too); lineTouch.ts now ends a stale touch (a new first finger, a lift off the line). Does the drag work on the Fairphone 6 after it? If not, record `adb` pointer events (down/move/up/cancel with ids) for the sequence.

## Decided proposals

### Pipeline and process
- **Decided by Opus passes, rule in code or docs (A64, G125, S2, G133f1, G138, R261, G557, G78):** the eight entries as they stood: [archive/decisions-2026-11.md](archive/decisions-2026-11.md).
- **v0.1.0 (owner, 2026-11-12 and 2026-11-17):** the beta after the layout rows and R744, the release candidate Mon 11-23, the tag Tue 11-24, no history rewrite; before the tag only what the layout lock pins, the rest in v0.1.1; the bar and what v0.1.0 keeps for good (point 7): [release-0.1.0.md](release-0.1.0.md).
- **Owner answers of the night and architecture reviews:** section 6 of the archived [11-09/10](archive/night-review-2026-11-09.md) and [11-14](archive/night-review-2026-11-14.md) reviews; [11-10's arch review](research/arch-review-2026-11-10.md) section 3; [11-16's](research/night-review-2026-11-16.md) section 5 (Function and Solve open after the tag; `5 % 3` kept). Each package rewrites its line here when it lands. Would change if: the G2 or an outside round reads one otherwise.
- **Owner answers of 2026-11-15 (Needs the user), still binding:** the unit view's raise (entries 42 kB, pin 78.55 kB; the first unit result < 1 s on the Tab One), G164's sources "to verify" at v0.1.0, S45 (units in Solve, [the note](research/r-solveunits.md)) and R330 after the tag, S50's G2 column from the owner's G2 (`source: device`), Shift + a b/c and Fmt reserved. Archived.
- **Owner answers of 2026-11-15, evening:** RPN (mh-D1) before the freeze, with units and ± on the stack; Geometry and a second keypad not planned; the test nights one lane, fixes only: [must-have.md](must-have.md) sections A, D and E, [release-0.1.0.md](release-0.1.0.md).
- **F-Droid Reproducible Builds (owner, 2026-11-15):** unticked at v0.1.0 (A158). Archived. Would change if: a deterministic engine build exists before the F-Droid request (the box cannot be ticked later).
- **P25 (owner, 2026-11-08): auto or hands-on, around the clock; on Max since 2026-11-20 (Pro 11-19 to 11-20, A262).** Rule and numbers: brief section 0; the daily stop (05:00, 07:00) and the day's budget: rules section 4a. Would change if: the plan cannot carry the queue.
- **Owner answers of 2026-10-25 and 2026-11-02 to 11-08 (pipeline):** built; a 1507 ms CAS-last cold start does not hold v0.1.0. Archived.
- **The name N62 (owner, 2026-11-05):** id `dev.n62.calc`, never changed after the v0.1.0 tag; the web `https://n62.dev/` from a release tag (A45); repo `n62-dev/n62`; spelling: docs/rules-core.md. Archived. Would change if: TMview finds N62 in class 9; the domain lapses.
- **The declutter (owner, 2026-11-05 evening): history lives in git.** Rule: rules section 10. Archived. Would change if: a deleted file is needed back twice a month.
- **P23 (2026-10-21, ended 2026-10-27, owner): the core freeze's net stays;** the list changes only with the owner. Rule: brief section 0, `tests/core/README.md`. Archived.
- **The docs budgets stay (owner, 2026-10-20):** brief 40 kB (2026-11-10), backlog 20, decisions 40; when decisions.md has under 1 kB left, the Opus pass moves the full texts of built entries to the archive and keeps a short line.
  - **S55's targets:** brief, decisions and docs/04 at 90 % of their budgets; the backlog at 19 kB (its open lines stay word for word, S55 rule 1). Would change if: the backlog fails a package's docs check twice in a week.
- **How research reaches the docs (owner, 2026-10-20):** rules sections 9 and 10; KhiCAS only after a per-file licence check (E5). Archived. Would change if: the line baseline blocks a fix two nights running.
- **The pipeline merges what it audited, the night ends on time, the audit sees a behaviour diff (owner, 2026-10-19):** A17, G55, A18. Would change if: the diff stage adds over ten minutes to a run. Archived.
- **P17 (2026-10-18; two lanes 2026-10-29, owner): the pipeline is the only path** (`scripts/pipeline.sh`, brief 0c; two lanes, one merge queue, A47b). Archived. Would change if: the queue's waits cost more than the second lane gains.
- **Small packages (2026-10-14, the owner's rule).** One concern each, about a day or less, with its own reading list; placed by importance, then dependencies.

### Feel, keys and screen (milestone 4a)
- **Super mode dropped (owner, 2026-11-22):** no super mode, no Super + ⌫ or Super + ◀ ▶, no green (R810, R811, R850 and R845's mock-up deleted; the 2026-11-21 yes on docs/06's lines withdrawn, the lines stay). Select then ⌫ deletes a block; a key held any length gives the same output as its tap (no hold on a user key); setup input never mixes with maths input (no Find + Store ▶ onto a key). The unit view moves slot to slot by two buttons beside → Check (R853); with nothing shown above their row their 44 px touch area takes the field's blank bottom (about 8 px, no slot's box), and R852's 40 px stands (pass 228). Settings › Your keys is one window: U1–U6 in their keypad places, the picked key's slots below, Clear makes a key "+" again; a tap on an empty "+" opens only its small sheet, the same rows (R849, R848; mock-up yourkeys-onewindow.html, outside the repo). N62 Light's Enter: orange A `#c26a00` (R843). The unit view's reading beside → Check (R852); the field's top may still rise 0.64 px on the first unit (MathLive's filled slot; its bottom and → Check stay), no package (pass 228).
- **Owner answers of 2026-11-21, night:** R128: another device's newer backup is offered as soon as the folder is chosen (the same one offer; R855). R770: a sheet under 120 px drops its margins, as built. R780: `.` and the space bar pick rows 11 and 12; longer lists number 1–10 and take letters, as built. G369: a % chip in Home is its pure number (0.42 % is 0.0042; G782).
- **Touch, keys and Store (owner, 2026-11-10; the keys 2026-11-12):** as built (docs/05 3.5; docs/04 5.5); the keys: [06-keypad-vs-g2.md](06-keypad-vs-g2.md) section 3b. Archived. Would change if: A139 shows the gestures clash on a real WebView.
- **Built, archived ("2026-11-12, evening"):** A73f1; R140–R150, R53; R95, R100, R94, R110; S12 (R66–R68, G45); R34, R43, R7, A4a points 3 and 4.
- **R41 at font scale 2.0, as built by R703 (2026-11-22):** faces, legends, the bar's text and sheet rows shrink to their floors, then end in … with the whole text kept for the screen reader; no `setTextZoom(100)`; a place tab that does not fit shows its glyph (R856). Archived ("Moved 2026-11-22"; pass 231). Would change if: a face is ellipsed at 1.5, or text still cut at 2.0.
- **Built, archived ("2026-11-17, the fix lane"):** R140's colour-vision floors (owner, 2026-11-07); R50 (owner 2026-11-07): three themes; Redo after ⌫ (R15c2).
- **Owner answers of 2026-11-02 (vision; interview with sandra).** A working engineer, phone first; units and constants first; no AI in the app; marks, σ and digit groups each a setting. Archived. Would change if: an outside round shows another first user.
- **Owner answers of 2026-11-02.** Stored names (R33) get a colour token per theme; the app's switch alone decides key vibration (A9, R112); the splash Dark (A59); the bars follow the look (owner, 2026-11-22, A266). Archived. Would change if: users want the system switch to mute the keys.
- **Bulk resets ask once (owner, 2026-11-22, R857); one-slot clears do not.** Reset all your keys, Reset the unit pad cells and the three Reset the counter rows arm on the first pick (R281's ask: the armed label, the row in `--error`, a note naming what goes); Empty this slot and Back to the default clear at once. A digit key arms the reset and never runs it (R281's rule: every key but Enter disarms first; pass 230); Enter or a second tap runs it. Rule: docs/05 3.4.
- **R4b's four defaults, as built:** Memory deletes a name without asking (Clear all asks once); a Find pick for a slot closes the sheets; a key's constant keeps its value and σ; Vars is dead without an entry line. Archived.
- **Settings in the Mode sheet, and presets (owner, 2026-10-27; built by R49, R85–R89).** Settings is a level of the pick sheet; a preset snapshots any user settings. Rule: docs/05 3.4. Archived. Would change if: presets are switched under 5 times in 4 weeks (they go).
- **R15c1 menus (owner, 2026-10-20): a long menu scrolls** in the viewport (docs/05 3.1); the ⚙ in its title opens Settings (R145). Would change if: the scroll feels slow on the APK.
- **M4-2 (owner, 2026-10-20):** the task budgets (t02 9 presses, t04 12, t10 25, t05 4), t09's two deviations, ± on Shift + `,` (R71), the unit result as its mockup (R62). Archived. Your hand timing stays the gate.
- **S8 (owner, 2026-10-20):** every press is counted (R70); Android's backup is off (A23). Archived.
- **S6 (owner, 2026-10-20; A11, R38a, R38b): the backup** leaves by Android's "Save to" screen and returns by a file picker; restore checks the whole file. Archived. Would change if: a supported WebView has no Save-to screen.
- **R15c Store (owner, 2026-10-19; G2 item 58, device):** Shift + ᴇ (Store ▶) on an empty line after a result starts `Ans ▶`, as + − × ÷ do; built in R15c2.
- **R15c (2026-10-17): the top cluster becomes R3; Apps, Menu and the views sit in the status line** (the bar on the keypad since R722, below). Rule: docs/04 5.1, docs/05 3.2. Archived.
- **The bar on the keypad (owner, 2026-11-17, R722; 2026-11-20, R783, R785; 2026-11-22, R856):** the status line is the keypad's top edge (28 px; the lock's `bar:`), Home and slot 2 one tap each (owner, 2026-11-20, R782: Home fixed, slot 2 CAS until a second tap on it opens the Apps sheet "Slot 2"; APP▾ outside the track opens the apps; `Settings.barSlot`). Rule: docs/05 3.2, docs/03 rule 9. The angle is a word in one group with the format, never an icon (owner, 2026-11-22, R856). Would change if: over 2 % of angle-word taps are undone within 3 s in four weeks (`bar.angle.undo` against `bar.angle`, under their own key `bar-uses`; Settings › Counters › Removal tests › Angle chip).
- **Keys of 2026-11-17 (owner, R723):** row 0, col 4 is Help, Shift Settings; Shift + Select is Copy, Shift + Deselect Paste, Shift + Vars Chars (R725); Mode has no key (`STD 12 ▾`, an app's ☰ › Mode, a user key, Alt + Shift + O). Rule: docs/06 3b, docs/05 3.2. Would change if: Shift + Select is pressed fewer than 10 times in four weeks (`select:shift` and `select:up`); then that cell is reserved.
- **Modifier locks (owner, 2026-11-17, R726; 2026-11-20, R783):** a Shift tap arms, a second locks, a third ends it, as Alpha's; with Alpha on, Shift stays one-shot; the sign's tap is a screen press (docs/04 5.2). Rule: docs/05 3.2, 3.10; docs/06 section 2, 3b. Would change if: the owner, after two weeks of daily use, misses the one-tap undo of a stray Shift.
- **Chars on Shift + Vars (owner, 2026-11-17, R725):** a sheet of Greek letters and an engineer's symbols over the view, the digit keys uncovered (docs/05 3.1); a cell the parser refuses (≈, Å; µ on a maths line) types nothing and the notice gives the parser's message; in a name prompt every cell types. Would change if: under 10 picks in four weeks (`vars:shift`; the sheet goes and the cell is reserved again).
  - **Its questions:** the unit view's pad keeps yd on Shift + Vars (a typed µ is the prefix there, Ω the ohm); ± from the sheet in an app inserts and the parser says why. Would change if: the owner wants Chars on the pad.
- **R15b (2026-10-17): cluster rows 36 px; APP▾ 36 × 28, every bar target at least 28 × 28 px** (R82f2; owner, 2026-11-20, R782). Archived. Would change if: 36 px keys are mis-tapped on the phone.
- **P16 (2026-10-18, 2026-11-06): results mode folds the keypad** by a swipe down on the entry line (R53, R283), ⌄ and the folded bar (owner, 2026-11-17, R724; owner, 2026-11-20: ⌄ on the bar, a 28 px target, R786; owner, 2026-11-20, R782: the folded bar shows ⌃, Home and slot 2 at the open bar's x). Would change if: under 14 folds or 10 actions while folded in 14 days; ⌄ makes under 5 % of folds in four weeks (`fold.tap`; then ⌄ goes, the bar stays). Archived.
  - **⌄'s place (R724's question):** owner, 2026-11-20: ⌄ on the bar, a 28 px target, so the entry line keeps its full width and a tap on the first term is the line's. Would change if: annabell's Fairphone check finds ⌄ hard to hit.
  - **Store ▶ keeps the fold (owner, 2026-11-17, R740):** the sheet "Store in" opens over the history with the keys down; a folded sheet ends with New name…, which brings them up. Would change if `store.new` is over half of folded stores in four weeks (then Store ▶ unfolds again).
- **R21 (2026-10-14), changed by R770 (owner, 2026-11-19: every window in the viewport): every sheet rises in the viewport over the history, Settings too, never over the keys;** a sheet taller than the viewport scrolls inside its box. Archived.
- **Engine defaults, not G2 copies (owner, 2026-10-19):** a G2 special case stays only for a silent wrong number or a saved keystroke. Archived.
- **P12 (2026-10-13): the keypad against the G2.** Rule: docs/04 5.1 and [06-keypad-vs-g2.md](06-keypad-vs-g2.md). Archived.
- **P11 (2026-10-13): back to the G2's flow; milestone 4a before the rest of milestone 4.** Departures sit on top of the G2 way, never instead of it (docs/03 rules 5–13). Archived.
- **P7 (2026-10-12, revised by P11): keypad gestures.** The arrow keys are one trackpad; flicks on every key. Archived.
- **The letters stay on the keys (2026-10-14).** Rule: docs/04 5.1 (the letters; the unassigned Shift cells). Would change if: Alpha taps near zero (P7 point 4); a function in the benchmark needs a key and no cell is free.
- **Start chunk: 180 kB raw, 63 kB gzip (owner, 2026-10-27; raised 2026-11-09), pinned** (size-check.ts). Rule: docs/04 8.3. Archived. Would change if: the Tab One's keyboard-usable time passes 738 ms.
- **The Ultra terminals' answers (owner, 2026-11-16; T1 to T6):** [the archive](archive/owner-answers-2026-11-16.md); each package file and the brief's rows state the answer they build.
- **The release key (owner, 2026-11-16):** alias `n62` (`android/release-cert.sha256`) replaces the Pascaline one before any release; the four secrets keep their names.
- **Home/CAS ☰ of four rows (owner, 2026-11-20, R830):** Delete, Share session, Clear history, Export ›; built. Rule: docs/05 3.3, 3.5. Archived ("Moved 2026-11-23"). Would change if: the counters show keys-only users missing Copy or Paste on ☰.

### Precision, engine and parser
- **G141: a literal past `MAX_EVAL_DIGITS` makes the value ⚠ unchecked,** a power of ten too; G126's and G153's rows turn ⚠ until S20.
- **Built, archived ("2026-11-12, evening"):** G78f1, G68, G84, G70, G71, G67, G65; A20 (G82); A12 and A62 (G83); A16 after G53; F50, F51 (G78); G33 and R56; A4a point 1 (G52); G20 (G28).
- **G58, G59:** a Giac call deaf to its interrupt gets a `control_c()` patch at its cause (P19); when the exact and numeric answers disagree Home shows ⚠. Archived.
- **S13, G57 (owner, 2026-10-20; built by G65): names from Giac's state;** an undecided run-once store is refused as `a:=` is. Archived. Would change if: A16's RAD Enter p95 > 150 ms.
- **P18 (2026-10-20): Giac evaluates, our layer decides** what is shown; no other engine answers at run time. Rule: docs/04 6.1. Archived. Would change if: a feature needs a second engine at run time; the checks push the Tab One's Enter p95 past 150 ms.
- **P19 (2026-10-20): a Giac bug is fixed at its cause** (patch, canary, link to Parisse; a TypeScript workaround only for a cause that is not local, registered in S17). Rule: `docs/rules-core.md`. Archived.
- **P20 (2026-10-20; narrowed by G85's GO, 2026-10-22): Giac's tree, not its text.** Names, stores, bound names, settings and a value's kind come from the bridge (`bridge.ts`); only Giac's print is read as text, in one module (G105); new code adds no bracket loop or name regex (the text baseline, G88). Would change if: a question the bridge cannot answer.
- **P21 (2026-10-20): Giac is pinned to Parisse's numbered Debian archive** (SHA-256 from its `.dsc`); a re-pin passes the golden gate. Archived. Would change if: a fix we need is only in a snapshot.
- **P24 (2026-11-08): commercial reuse of our Giac fixes** is permitted to B. Parisse (email 13). Archived. Would change if: a contributor other than the owner writes a Giac fix.
- **R58b (2026-10-19; built by R67): a letter typed with Alpha is always a name,** in CAS too; e and i come only from their keys. Archived.
- **S14: the angle mode, route R (owner, 2026-10-19; built by R64 and G46).** Giac runs in radians in every mode, our parser carries `pasdeg`; rule: docs/04 2.12. Archived.
- **An undecided decision is refused (owner, 2026-10-19; built by G57):** a sign, comparison, floor or branch on a cut Giac cannot decide is refused as undecided, never a guess. Would change if: refusals turn up in everyday work where a ⚠ value served better.
- **F29 (2026-10-18, G2 item 54): `exp` ignores the angle mode,** as on the G2 (`e^(i·90)` is −0.4481+0.8940·i in both modes); built by G21. Would change if: a Giac patch (G21b) replaces the rewrite.
- **R29: the parser's messages, and a space between two numbers (2026-10-17).** The messages are i18n keys (R52); a space between two numbers is an error ("put × between two numbers", R51), though the G2 gives 6. Archived.
- **G19 (2026-10-17): after a safe start, the next launch tries the stored definitions again.** Would change if: crashing definitions cost too many restarts in use.
- **R18f1, R18f2 (2026-10-14): tests.** An exact true/false carries no mark; a test with a float side runs again at 14 and at P digits (true ≈, false ≈, or as typed). Archived. Would change if: a function is audited.
- **P9 (2026-10-12): typed decimals in the CAS view become exact, as in Home;** `approx()` gives marked decimals.
- **P10 (2026-10-12): Giac's English help lines in Find.** Confirmed by B. Parisse (email, 2026-10-19): `aide_cas` is entirely GPL; the non-GPL French documentation means R. De Graeve's LaTeX/PDF manuals.
- **G783:** a free name keeps ln(1/x) and sqrt(1/x); the rewrite needs a proven positive argument (owner, 2026-11-22).
- **K22 (owner, 2026-11-17):** the unit view's refusal of `80 °C − 5 K` and its words wait for G385, after the tag.
- **P5 (2026-10-11; owner, 2026-11-16): behaviour against the reference.** The maths is Giac's wherever possible; it departs only where Giac gives a silent wrong answer. The G2 guides the keys and the flow, not the maths: its Home is HP's own engine, so a G2 result alone never changes a result, and no G2 question asks about maths. Home keeps Giac's principal root (complex `sqrt(-4)`, `asin(2)`), the ∛ template, Function and Solve the real odd root (R39). Archived.
- **P8 (2026-10-12): the engineer core:** milestones 4, 5, 6, each with benchmark tasks; fewer features done well beat G2 parity.
- **P4 (2026-10-11): the reference's logical key layout, our own look;** ▲ on an empty line picks the last history row.

### Units (milestone 5)
- **Ans in history (owner, 2026-11-20, G642/R836):** frozen in the history row, live on the entry line, a recalled row comes back live. Rejected: literal digits (1/3 ×3 gives 0.999999999999 or ≈1, σ and unit lost), Giac text (radians, no text over 2 kB), numbered ans1/ans2 (numbers shift when rows are deleted). Would change if: the G2 re-resolves a recalled Ans differently (tests/golden/g2.yaml question) or daily use asks.
- **Ans in the unit view (R259; owner, 2026-11-12):** no slot before v0.1.0; an Ans with a unit or σ is refused, naming its row's chip. Would change if: daily use asks (≈0.5 d).
- **Prefix entry (owner, 2026-10-31; night review fh-8):** Home has none; a prefix goes in the unit view's prefix cells (P11, docs/05 §7.2), and docs/04 2.7's prefix chip is dropped.
- **Built, archived ("2026-11-12, evening"):** G81, R24d, R24b and R24c, G37, G15 and G25, the units menu ([spec/units-menu.yaml](../spec/units-menu.yaml)).
- **P22 (2026-10-20): libqalculate leaves the build;** its numbers are checked in (`find/factors.yaml`), refreshed by a developer tool (A21, A60). Archived. Would change if: the unit view needs qalc at run time.
- **Angles in the unit view (owner, 2026-10-19; built by G40):** an angle is a quantity both ways; the rad drop and the 2π·r·n note as built. Archived. Would change if: G2 item 68 shows the G2 refusing both.
- **P15 (2026-10-14): the unit view computes on Giac** with the Find index's exact SI factors; libqalculate never runs in the app (P22). Archived. Would change if: a unit need has no clean exact form; the unit view feels slow on the Tab One.
- **P14 (2026-10-14) and the P14 arrangement (2026-10-18, S5): the unit pad.** Rule: [archive/r9-unit-pad.md](archive/r9-unit-pad.md), `spec/unit-pad.yaml`; a hardware keyboard types a unit symbol in a slot (R313). Archived. Would change if: the owner's units take ≥ 3 presses; R24b's reach costs.
- **S1 (2026-10-13): the unit slots.** The number comes before the units key; digits in a slot are only exponents; a live reading under the slot. Archived.
- **S4 (2026-10-18): a library file carries definitions only;** settings and key slots go only in the backup. Archived. Would change if: keyboard set-ups are shared (a `// key:` line).
- **U1–U6 over the unit pad (R838; pass 230):** while the pad is up they are its cells (R24d), so a user key that holds Settings or Mode does not open it there; Shift + Help, the bar's chip and Alt + Shift + O do. Would change if: the owner wants his user keys over the pad.
- **Formula, then units (owner, 2026-11-16):** letters get unit slots; → Check turns the end slot on (R349); Store ▶ in the view (R353); SI names, no J or Hz (G389).

## Defaults

The defaults that bind code and tests, one line each. A default changes when its "would change if" happens or the owner says so.

**Entry and keys**
- **Built, archived ("2026-11-16, Ultra"):** Shift + 5's matrix (R185, R186); R194's word; The matrix grid (R188, R189, R300); R277's line scroll; R279's Select; R116, the entry's highlights; View keys and the load queue.
- **R746's exact maths on the line (run 1400):** a result goes as its maths only when its drawing is its exact value (rule: docs/04 2.8, `render/exactMaths.ts`); `\left[…\right]` reads as Giac's vector, a typed bare `[` stays refused. Would change if: the owner wants `\cdot`, or a result kind that should go plain stays a chip.
- **R376, a letter or bracket after a mark (pass 232, P5):** stays a product as Giac reads it (`5!x` = 120·x, `2%x`, `30°(1+2)`), as `2x` and `2(1+2)` do; only a digit, which runs into the mark, is refused (`parse.ts` `markThen`). Would change if: a user reads `30°(15)` as minutes.
- **A digit on a disabled sheet row (R862; pass 232, docs/05 rule 4):** a dead press: the short haptic "no" in every sheet (`Sheet.activate` runs nothing today, silently); backlog "Without a package yet". Would change if: the owner wants disabled rows silent.
- **R299's lock:** `UNPINNED_LISTS` stands; Plot's and Solve Num's ☰ are pinned with their last rows. Would change if: one of those lists gets a fixed row.
- **R130's tenth ☰ row:** it keeps the 36 px floor and scrolls; rows 1–9 stay, key 0 opens Export › (docs/06 3b rule 2). Would change if: the owner's look on a phone.
- **⌫ and Del keep a template whole** (R23–R26h, R47): never half a template or a lost box. Archived. Would change if: G2 items 44, 46, 49 or 51 differ (the G2 way wins unless it leaves half a template).
- **The cursor stops only at a box** (R27b) **and goes where the user aims** (R42, R43). Archived. Would change if: G2 items 50 or 57 differ.
- **Store ▶ on a picked row (R280):** every key holding ▶ stores as the row bar's Store ▶; no result: the double haptic. Archived. Would change if: the G2 differs (store-design.md 1).
- **Row gestures (R276):** a hold copies at 500 ms, a swipe goes at 40 % of the row; delete from the right only, behind a red strip; right is reserved (owner, 2026-11-17, R743); would change if over 10 % of row swipes in four weeks go right (`swipe.right` against `swipe.left`, R70's counters; `swipe.left` comes with R832 (R741 folded in), as the `delete` count is kept only folded). Archived.
- **History pick by part (owner, 2026-11-20, R832):** a tap on a row's input lights the input, on its result the result, elsewhere the whole row; Copy, Store ▶, Shift + Select and Enter act on what is lit, Delete and Share on the row (docs/05 3.5); with text on the line, Enter, Store ▶ or the second tap on a lit input puts it at the caret (pass 225; R858, owner 2026-11-22). Would change if: keys-only users cannot light an input (then ◀ ▶ on a pick switch the part).
- **R198's typed names:** a typed FUNCS or Find function name before `(` is the function, drawn by name; Giac's program words stay letters (R198f1). Archived.
- **R224's wide layout:** the keypad in a 42 % column of 400–560 px (`--keys-wide`). Archived. Would change if: the owner's look on the Tab One.
- **A phone held sideways (R860; pass 230):** no layout of its own (mh-C decision 5: the wide layout is for tablets and desktops); at 915 × 412 the history is 16 px, the mark is left out and the hint's line sits mostly out of sight. Would change if: the owner uses a phone sideways.
- **Nothing takes focus while the app is away** (R25a–c) and **Focus on return:** MathLive's own restore is off (R22). Would change if: a desktop browser loses the caret after switching windows.
- **Flicks** (R9): arm at 20 px, cancel within 12 px; **Alpha lock:** Alpha twice locks capitals, Shift Alpha Alpha lower case. Archived.
- **R58: in the CAS view Alpha types lower case.** Archived.
- **A selection is the argument of the key** (R17); **powers bracket a compound term before the cursor** (L8). Archived.
- **The exponent mark** (R14): `\emark` drawn `ᴇ`, one number literal; `1ᴇ` on an empty line, after an operator, a bracket or a comma, and at a box's start (G2 item 40); a non-integer exponent is an error.
- **Tmpl and a b/c** (R10): one toggle per result type; ° and DMS mean degrees in every angle mode. Archived.
- **Enter during a job:** starts nothing, the line stays (`session.submit`). Would change if: the owner wants it queued.
- **Sheets** (R7, R8, R21a): the last pick per sheet in memory only; Mode and Settings open on their first row. Archived.
- **User keys** (R15b): a slot is `{ label, action }` in keyboard.yaml's action form, null empties it, the user's choice wins over a default.
- **Keypad legends** (R6): a key is dimmed when its layer gives nothing; 4.5:1 contrast. Shift + 4 reads Mat (R187, pass 170). Archived.
- **The kept line** (R34): `{ view, latex, chips }` under `entry`, written on hide once settled, restored only into its view.
- **An app's line stays with the app** (R76, R76f1, R262): cleared on the way back to Home or CAS. Archived.
- **Working… after 150 ms** (F8): the busy line and Cancel are drawn late; Cancel works from 0 ms.
- **One-line mode:** `^` is literal and the exponent is the next signed factor. **Results are insertable**, bracketed when a sum. **Default angle mode: radians.**
- **R98, Clear and Delete:** rule: docs/05 3.5 (cancelled and note rows too; one Undo copy per view; a backup never holds it). Archived.
- **R112: a key drawn dead, or a press the route's one rule finds dead (route.ts deadPress), gives the double pulse alone, no look, pop or click; every other key gives one pulse at finger-down.** The unit pad's dead presses keep three (the touch's, then the double; docs/05 3.7).
- **R144, R146, changed by R770 (owner, 2026-11-19: every window in the viewport):** the keys stay live below an open sheet and drive it; a key it does not use is dead and the sheet stays. Rule: docs/05 3.1. Archived.
- **R157, the mark:** `--mark-faint` keeps the mark at most 1.3:1 on `bg`; Home's glyph is a house (owner, 2026-11-22, R856), 16 × 16 on the bar and in the Apps sheet; shown whenever the view is empty (R860). Archived. Would change if: the mark cannot be seen on a device.
- **R153–R155:** the generator's moves stand. Archived. Would change if: the owner's look after R24d.
- **N62 Light's Enter orange (owner, 2026-11-20, R843):** #c26a00 with a black label (his pick A from R842's page, 2026-11-22); Dark keeps #529997. The family's `edge` (#529997) keeps the unit pad's prefix cells teal (and R840's window edge). Would change if: users press Shift for Enter (or the reverse) in Light.
- **R795, Plain keys (owner K3, 2026-11-20):** the keys keep their family's fills (Black & White its two neutral tones, unchanged); only the legends' colour coding goes (it reverses R50's "one neutral tone"). Would change if: the owner's look on his phone.
- **The tips' text stops at 17 px** (R171, R722): seven cards (R352) fit 360 × 740 at scale 2.0 with a 6 px gap, 8 px padding. Would change if: the owner wants them to scroll.
- **A sheet that cannot fit at its floor scrolls, at 360 × 740 too** (R148f1; docs/05 3.1). Archived.
  - **Under 1000 px tall with R722's 43 px rows too (R722's question):** Plot's ☰ after a Root, Mode › Digits, Numbers and Appearance scroll at their floor at 412 × 915 and on the Fairphone 6. Would change if: the owner's look at the beta wants them whole (a 32 px floor, measured by R722, brings back Plot's ☰ and Digits).

**Engine, precision and formats**
- **Honest precision** (G2): rule: docs/04 2.4 rules 2–3; assignments evaluated once. **G44, G23:** the inverse distributions are solved against our MPFR forward functions, every fallback keeps ⚠. Archived. Would change if: a G2 user types Giac's aliases.
- **Stored definitions** (G3): rule: docs/04 6.2 `defs` and 2.4 "Built in G3"; k ≥ 15 in `evalf(<exact>,k)`; the defs load times out after 3 s and a timed-out store is never saved over.
- **Built, archived ("2026-11-16, Ultra"):** G154; G148, G148f1, G148f2; The session line (G210, G211); Copy as Python (G213, G214); A stored name's mark in Vars (S53f1); R258: a stored value of more than one letter is `\operatorname{name}`. The Plot draws a stored real value (owner, 2026-11-16; R361); user functions are not drawn.
- **G307 past the cap:** a huge `pi^n` or `exp(n)` past `MAX_EVAL_DIGITS` counts for the value only in a small value or an argument read modulo 2π (G348); then ⚠; a decision always counts it. Archived. Would change if: S20.
- **G212:** a Home row keeps its stored values as `defsUsed` (the session line's `defs`), not drawn; +10 B at start accepted. Would change if: the owner wants them drawn.
- **The LaTeX export (G232):** only a ⚠ row gets its reason (whyLine) after the result; `\approx` and `=` stand alone, as the CSV's mark column. Would change if: the owner wants the rounding reason in a document.
- **Built, archived ("2026-11-17, the fix lane"):** G22, G26, G371; G92, G93; The angle mode, route R (S14, R64, G46); R18; Home number formats; Solve and Plot; Function app; Parser (L6); Discrete distributions (G113, G113f1); G140; R55; R36f1; t06 and Find (R221); G158; Unequal shapes are refused.
- **Home and CAS share one Giac context, each with its own Ans** (`pasans`, `pcasans`). Would change if: G2 item 52 shows separate variables.
- **R39 (Function, Solve; S12):** a literal fraction exponent is reduced first (`(-8)^(2/6)` = −2); the root template stays the real root in every view.
- **G5:** a list's mark: docs/04 2.4. **Chips and Ans** (R2): rule: docs/04 2.8; a chip has two arguments (key, shown); an operator on an empty line starts with Ans only when the view has a result.
- **Time limits:** CAS 10 s soft budget, Giac's 600 s net; Solve and analysis 30 s; Home and units a 4 s watchdog from engine-ready (G185); Cancel replays the definitions only. Archived.

- **The deep check of 2026-10-19 (G38, G57, G48, G39).** Rule: docs/04 2.4. Archived. **G328 (pass 153):** a name set beside the result takes the facts of what sets it; after a decision on the line, the line's (G48).
- **`full` of a result that is not exact (G302):** the rpn stage compares it by value, an exact one as text. Archived. Would change if: a user sees the two forms differ.
- **A complex element in median and the quartiles (pass 229, principle 3):** refused, never sorted as 0 (`median([1+i,2+i,3+i])` was 0); built by G786f1 (patch 0058). Would change if: the owner wants an order on complex data.
- **arg(0) and atan2(0, 0) (G362):** both are 0, as Giac gives them and as C's atan2 and Python's cmath.phase do; Find's lines say so. Would change if: the owner wants the angle of 0 refused.

**Units**
- **Built, archived ("2026-11-17, the fix lane"):** G17; G13, G7; R24a, R24af1; R61; R63; R92; The deep check of 2026-10-19 (G41).
- **G18:** ± is `pasupm(value,sigma)`, each an independent standard uncertainty in the slot's unit; ± inside sin, cos, tan works. **G25:** a typed product is kept when at most one token carries a prefix or its factor is 1 (N·m, kW·h), else SI with a prefix.
- **R28:** rule: docs/04 4.3 (slot order, the end slot, there only after → Check, R349; a formula with no number keeps it and hides the button: Enter has no other slot); a slot only right after a number literal; σ is a number literal, `n %` of the value (R104) or a result chip (R271, R271f1; both docs/04 4.2); a product with a slot keeps its brackets.
- **Built, archived ("2026-11-16, Ultra"):** G161; G143: σ through a step function.
- **R60:** the alternatives row (units/alternatives.ts) takes a temperature's three units (absolute K, °C, °F; interval K, Δ°C, Δ°F) and no target; Δ°C is K's Find alias, so its tap shows K. Would change if: R62 labels the alias.
- **G392's note:** "unit dropped" rides in the row, never in Copy as shown (R325). Archived.
- **R201, R353:** Made of is typed text; a unit is not renamed; Store ▶'s title keeps the mark. Archived. Would change if: the owner, after his try on the phone.
- **G370's shape:** `T1 − T2` is the whole formula; a bracketed difference inside a longer one stays refused. Archived. Would change if: G385.

- **A ratio chip (G369, G782; pass 229):** a chip in one ratio unit (%, ‰, ppm, ppb) is its pure number wherever it goes: Home and CAS (G782); in the unit view its slot holds the ratio (`chip × 200 m` with 0.42 % is 0.84 m, not 84 m) and Store ▶ stores the pure number with its σ (G782f1). Built. A pure number in another unit (rev) keeps "unit dropped" in Home; Ans of a % or rev result is refused in the unit view (R259). Would change if: the owner wants the ratio dropped there.
- **The check of 2026-10-19:** a zero term keeps its dimension for the unit check (G35). Would change if: the per-term check costs more than the 5 ms p95 bar.


**Library, release and process**
- **The check of 2026-10-19:** a Home value that leaves its evaluation is the value shown in any later angle mode (G34). Archived.
- **Built, archived ("2026-11-17, the fix lane"):** R59, R59f1; R89; R40, R124, R125 (owner, 2026-11-04); R156; A66; G218, G219, G233, G234.
- **The release path (A7, A8, A45, A48):** APK and website from one tag; golden on the release engine before signing; the web names frozen; `master` follows phase-1. Archived.
- **Releases:** the engine built in the pinned container (P2), `setarch -R`, bit-reproducible. **Minimum WebView:** Chrome 111 (R160; minSdk 24). Archived.
- **Tests:** the golden gate as docs/04 7.3; values `derived` or `oracle`; timing tests skip their assertion under load; a DOM count is a Playwright test (R132). Archived.
- **Built, archived ("2026-11-16, Ultra"):** A47b; A45; R38b, R88; G119; G172; A101.
- **R87:** no ISC or UIUC text in `LICENSES/`: yaml is build-time only, Emscripten's runtime ships under MIT (THIRD_PARTY.md). Would change if: a shipped part needs another licence's text.
- **G116, the sweep oracle:** on atanh's cut it takes Giac's side (+π/2·i for a real x > 1), and an argument on a cut within noise is a skip. Would change if: a case shows Giac off the textbook side.
- **Start chunk room (owner, 2026-11-09):** a package over the pin raises it as docs/04 8.3 says; one over the 63 kB budget gets a cut, never an allowance. Would change if: the owner moves the budget.
- **R163, Key pop-ups (ron, run 763):** one switch for both bubbles over the keypad; a look stored before R163 has it on. Would change if: the owner wants the pop and the flick bubble apart.
- **R53, R159:** Counters: Shift and Alpha share a row (seven rows); `uses` is not backed up. Would change if: the owner wants the counts apart.
- **G618 (run 1361):** Σ to ∞ is checked against its terms only for a term rational in k, or (−1)^k times one, poles left of start + 100. Archived. Would change if: the owner wants every term estimated.
- **R361f1:** the names a Plot slot reads are Giac's tree of its text (a bound k or t is none); a call of a function with no definition (`f(x)`) notes "F1 uses f: not drawn, it holds no value"; a stored user function stays silent. Would change if: user functions are drawn (after the tag).
- **G576:** a power past Home's power limit is ≈ even when the input makes it exact (`10^(10^6)` ≈ 1E1000000): the float path proves no exactness and ≈ is never false (principle 3); no package. Would change if: the exact path can state such a power.
- **G524:** after a rejected pole the search goes on, so a real root found may not be the nearest; "no root found" only when no bracket holds one. Archived. Would change if: the owner wants the nearest root.

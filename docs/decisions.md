<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Decision log

Phase 0 decisions (D1–D9, P1, P2): [the archive](archive/phase-0-decisions.md). This file holds what binds from Phase 1 on, as Choice and Would change if; "Rule:" names where a rule is stated in full. "Archived" means the full text (why, evidence, costs, alternatives) is in [archive/decisions-2026-10.md](archive/decisions-2026-10.md) under the same name, or under the section named after it: read it only when a decision is questioned. A decision changes in place (rules section 9).

## Needs the user

The owner's other open items are in [backlog.md](backlog.md), "Needs the user". Once decided, an entry moves to "Decided proposals".

**G164's sample sources** (`app/public/samples/materials.txt`): sign [S36](shifts/2026-11-sandra-sample-sources.md)'s short list by the freeze (11-12); S36f1 set the two copper values to the sheet's (pass 103 re-read it). Cost: seven clauses to read. If not signed, the lines stay "to verify".

**R269 round trip** (paste back a unit row's Copy): recommended, a package (≈1 d, Opus) where Paste reads `value ± σ unit` as R61's result chip, its unit matched back to Find ids, so the units key fills the slot as a picked row does. Why: Copy on a unit row now writes `39.488 ± 1.2 m²` (the writer of Copy as shown and Share), but Paste reads one number, so that text gives "Paste: not a number" (paste.test.ts checks the refusal), and the unit view takes no paste (`units/open.ts` stops it). Until then the refusal is said, never silent. Would change if the owner wants the value ± σ pasted with the unit left out and said.

## Decided proposals

### Pipeline and process
- **Owner answers of 2026-11-09/10 (night review):** one line each in [the note](research/night-review-2026-11-09.md) section 6. New: R261, R269–R273 (R272 ends "no backup reminder" in part). Kept: `200 + 10 %` = 200.1, `30°15` = 450 (docs/04 5.5), digit-group paste refused. Would change if: the G2 or an outside round reads one otherwise.
- **F-Droid Reproducible Builds (owner, 2026-11-10):** asked for: one signing key everywhere (`fdroid/SUBMIT.md`). Would change if: the first build cannot be made bit-identical.
- **P25 (owner, 2026-11-08): auto or hands-on, around the clock, on Max.** Rule and numbers: brief section 0; the daily stop (05:00, 07:00) and the day's budget: rules section 4a. Would change if: Max cannot carry the queue.
- **Owner answers of 2026-11-08:** a Giac patch's worker writes its own patches README row (A83); a stray file outside a worktree is logged, warn only (A64 lo-11; A88); a CAS-last cold start of 1507 ms does not hold v0.1.0; the c29 red (F200, A123). Archived, "Opus pass 117". Would change if: a stray file does harm before anyone reads the log.
- **A64: a reply that says not done ends the run before the checks (Opus pass 93),** only as the done field (A64f1). Archived, "Opus pass 97". Would change if: a finished package ends NOT MERGED on it.
- **The name N62 (owner, 2026-11-05):** id `dev.n62.calc`, never changed after the v0.1.0 tag; the web `https://n62.dev/` from a release tag (A45); repo `n62-dev/n62`; spelling: docs/rules-core.md. Archived, "Opus pass 96". Would change if: TMview finds N62 in class 9; the domain lapses.
- **The declutter (owner, 2026-11-05 evening): history lives in git.** Rule: rules section 10. Archived, "Opus pass 106". Would change if: a deleted file is needed back twice a month.
- **Owner answers of 2026-11-05 (morning).** The weekly fuzz runs in 10-minute slices from Wed 11-11 (G167, Opus pass 69); red-first may test the stock engine for a G125 package (A71). Archived, "Opus pass 96". Would change if: the fuzz count is cut to fit one slice.
- **Owner answers of 2026-11-02, evening:** red-first counts only added or tightened tests (A67). Archived, "Opus pass 96". Would change if: a fix needs a test loosened.
- **Owner answers of 2026-10-22 to 2026-10-31 and Opus passes 55–78:** built; the list of packages: [archive](archive/decisions-2026-10.md), "Shortened 2026-11-07 (Opus pass 93)".
- **G125 (Opus pass 5): a bug an earlier merge already fixed** keeps its tests as regression tests that fail on the stock build, and merges review-only. Rule: brief section 8a (A71). Would change if: a test passes on stock too.
- **Owner answers of 2026-10-25, afternoon (verification check).** A wall-clock test that fails only under load is a timing case, not a bug (`isTiming`); the gate gets the pipeline's retry list (A39). Would change if: a timing case fails without load. Archived.
- **P23 (2026-10-21, ended 2026-10-27, owner): the core freeze's net stays;** the list changes only with the owner. Rule: brief section 0, `tests/core/README.md`. Archived.
- **The docs budgets stay (owner, 2026-10-20):** brief 32 kB (2026-11-05), backlog 20, decisions 40; when decisions.md has under 1 kB left, the Opus pass moves the full texts of built entries to the archive and keeps a short line.
- **How research reaches the docs (owner, 2026-10-20; H7 and the consolidation).** Rule: rules sections 9 and 10; brief 0c step 5 and section 8; KhiCAS only for a named need, after a per-file licence check (E5). Archived. Would change if: the line baseline blocks a fix two nights running.
- **The pipeline merges what it audited, the night ends on time, the audit sees a behaviour diff (owner, 2026-10-19):** A17, G55, A18. Would change if: the diff stage adds over ten minutes to a run. Archived.
- **P17 (2026-10-18; two lanes 2026-10-29, owner): the pipeline is the only path** (`scripts/pipeline.sh`, brief 0c; two lanes, one merge queue, A47b). Archived. Would change if: the queue's waits cost more than the second lane gains.
- **Small packages (2026-10-14, the owner's rule).** One concern each, about a day or less, with its own reading list; placed by importance, then dependencies.

### Feel, keys and screen (milestone 4a)
- **Touch and reuse (owner, 2026-11-10):** one rule per gesture: on a history row a tap picks, a second tap puts it on the line, a hold copies, a swipe deletes (Undo note); on the entry line a drag scrolls, a tap places the caret, a hold selects the term (touch only, no drag selection). The row bar keeps Store ▶ and Copy as ›. The Copy and Paste keys leave the keypad (a key move, the owner's choice; what takes r2c4 and r2c5 is open); ⇤□ and □⇥ go before the freeze. Store gets a design round (S53). Packages R274–R278, S53, A139. Would change if: A139 shows the gestures clash on a real WebView.
- **R151's start time comes from A73f1 (Opus pass 92),** no measurement package. Archived, "Opus pass 96". Would change if: either is over its before by more than 50 ms.
- **Owner answers of 2026-11-06 (UI, before v0.1.0):** R140–R150 and R53 as written (families: R50); a colour-blindness test, no picker (R140). Archived, "Opus pass 96".
- **R41's status line at font scale 2.0 waits for a device (Opus pass 61):** annabell's next device run checks it with TalkBack. Archived, "Opus pass 96". Would change if: the device clips Mode or ☰.
- **Owner answers of 2026-11-02 (vision; interview with sandra).** A working engineer, phone first; units and constants first; no AI in the app; marks, σ and digit groups each a setting. Archived. Would change if: an outside round shows another first user.
- **Owner answers of 2026-10-31 and 2026-11-01 (stored data, the comma, `%`):** built (R95, R100, R94, R110). Archived. Would change if: two tabs side by side are wanted on purpose.
- **Owner answers of 2026-11-02.** Stored names (R33) get a colour token per theme; the app's switch alone decides key vibration (A9, R112); Android's splash and bars Dark (A59). Archived. Would change if: users want the system switch to mute the keys.
- **R4b's four defaults, as built (Opus pass 18):** Memory deletes a name without asking (Clear all asks once); a Find pick for a slot closes the sheets; a key's constant keeps its value and σ; Vars is dead without an entry line. Archived.
- **Settings in the Mode sheet, and presets (owner, 2026-10-27; built by R49, R85–R89).** Settings is a level of the pick sheet; a preset snapshots any user settings. Rule: docs/05 3.4. Archived. Would change if: presets are switched under 5 times in 4 weeks (they go).
- **R15c1 menus (owner, 2026-10-20): a long menu scrolls** over the keypad (docs/05 3.1); the ⚙ in its title opens Settings (R145). Would change if: the scroll feels slow on the APK.
- **R140's colour-vision floors (owner, 2026-11-07):** Shift and Alpha 0.12 apart, ⚠ 0.08 from Shift (High contrast 0.10, 0.06). Archived, "Opus pass 97". Would change if: a colour-vision test fails.
- **M4-2 (owner, 2026-10-20):** the task budgets (t02 9 presses, t04 12, t10 25, t05 4), t09's two deviations, ± on Shift + `,` (R71), the unit result as its mockup (R62). Archived. Your hand timing stays the gate.
- **S8 (owner, 2026-10-20):** every press is counted (R70); Android's backup is off (A23). Archived, "Opus pass 96".
- **S6 (owner, 2026-10-20; A11, R38a, R38b): the backup** leaves by Android's "Save to" screen and returns by a file picker; restore checks the whole file. Archived. Would change if: a supported WebView has no Save-to screen.
- **R50 (2026-10-18; owner 2026-11-07): themes N62 (teal, #529997's hue), Black & White (the old N62), Solarized**; entry outline, busy dash, key shadows, Home logo (R153–R157; `docs/mockups/n62-teal-2026-11-07.html`). Rule: docs/05 3.10. Would change if: a family goes unused for 4 weeks.
- **Redo after ⌫ (Opus pass 44; R15c2):** Redo does not delete again (MathLive [#3125](https://github.com/arnog/mathlive/issues/3125)); no workaround of ours. Archived.
- **R15c Store (owner, 2026-10-19; G2 item 58, device):** Shift + ᴇ (Store ▶) on an empty line after a result starts `Ans ▶`, as + − × ÷ do; built in R15c2.
- **R15c (2026-10-17): the top cluster becomes R3; Apps, Menu and the views sit in the status line.** Rule: docs/04 5.1, docs/05 3.2. Archived.
- **R15b (2026-10-17): cluster rows 36 px; the place target at least 48 × 28 px** (R82f2). Archived, "Opus pass 96". Would change if: 36 px keys are mis-tapped on the phone.
- **P16 (2026-10-18, 2026-11-06): results mode folds the keypad** by its handle or a swipe down on the line (R53; Home and CAS). Would change if: under 14 folds or 10 actions while folded in 14 days. Archived.
- **R21 (2026-10-14): pick sheets rise over the keypad's rows 3–9, Settings too;** 36 px rows, 44 px cells, then scroll. Archived.
- **S2: one menu system (2026-10-13).** Rule: [archive/r8-menus.md](archive/r8-menus.md) sections 5–6 (M1–M7). Archived, "Opus pass 96". Would change if: a G2 answer contradicts a rule.
- **Engine defaults, not G2 copies (owner, 2026-10-19):** a G2 special case stays only for a silent wrong number or a saved keystroke, never for the match alone; of two equal readings, less code wins. Archived. Would change if: a removal costs muscle memory.
- **S12 (owner, 2026-10-19; built by R66, R67, R68, G45):** dropped R39's power form in Home, the half-even option and G42's wait for items 66–67; kept `mod` Euclidean. Archived.
- **P12 (2026-10-13): the keypad against the G2.** Rule: docs/04 5.1 and [06-keypad-vs-g2.md](06-keypad-vs-g2.md). Archived, "Opus pass 96".
- **P11 (2026-10-13): back to the G2's flow; milestone 4a before the rest of milestone 4.** Departures sit on top of the G2 way, never instead of it (docs/03 rules 5–13). Archived.
- **P7 (2026-10-12, revised by P11): keypad gestures.** The arrow keys are one trackpad; flicks up (Shift) and down (letter) on every key. Thresholds: Defaults "Flicks". Archived. Would change if: the owner finds a threshold wrong on the phone.
- **The letters stay on the keys (2026-10-14).** Rule: docs/04 5.1 (the letters; the unassigned Shift cells). Would change if: Alpha taps near zero (P7 point 4); a function in the benchmark needs a key and no cell is free.
- **Stored data carries a version; one signing key (2026-10-14).** Rule: docs/04 6.2 (the stamp); the throwaway key lives in `~/.cache/n62/keys/` for every worktree, so an install over the last keeps its data.
- **Start chunk: 175 kB raw, 61 kB gzip (owner, 2026-10-27, kept 2026-10-31), pinned** (size-check.ts; the inline scripts 1.53 kB gzip). Rule: docs/04 8.3. Archived. Would change if: the Tab One's keyboard-usable time passes 738 ms.
- **Owner answers of 2026-10-19 (feel).** R34: one shared entry line, as on the G2 (an unentered line follows you between views; after Enter it clears); R43, R7's defaults and A4a points 3 and 4 as built. Archived.

### Precision, engine and parser
- **G141 (Opus pass 68): a literal past `MAX_EVAL_DIGITS` makes the value ⚠ unchecked,** a power of ten too (`(1-cos(10^-600))*10^1200+1` showed ≈ 1, right 1.5); G126's and G153's rows turn ⚠ until S20.
- **G138 (Opus pass 69): a nightly known row names one tree, not a shape:** a shape would hide a new cause that shrinks to it (F175: ∛ of F151's leaf); G141 removes F151's families. Would change if: one cause fills two weekly reports.
- **G133f1 (Opus pass 24):** Home's "Underflow" for an exact 0 it cannot prove (`re(asin(i/10))`) is a bug line, F139 (wrong reason, no wrong number), not a plan change.
- **G78 (Opus pass 45; F50, F51):** `√(asinh(asin 3.7))` stays refused at Home's budget; a series or limit at ±∞ keeps Giac's infinity. Archived, "Opus pass 106". Would change if: the owner wants these refused or computed.
- **G78f1, G68, G84, G70, G71, G67, G65 (Opus passes 46–49):** an underflow is refused with its reason; Solve confirms only the digits every solve agrees on; Area applies Home's refusals. Archived.
- **G58, G59 (Opus pass 45):** a Giac call deaf to its interrupt gets a `control_c()` patch at its cause (P19); when the exact and numeric answers disagree Home shows ⚠. Archived, "Opus pass 96".
- **A20 (owner, 2026-10-20): Home's budget counts steps, not milliseconds** (G82); CAS and Solve keep clocks. Archived.
- **A12 (2026-10-20): the user's functions load on first use (G83) before R59; A62 (owner, 2026-11-05): R59 goes ahead.** Archived.
- **A16 after G53 (owner, 2026-10-20): Enter p95 on the Tab One is under the 150 ms bar** (145–147 ms, 2026-10-27). Archived; [archive/shifts/A16-enter-p95.md](archive/shifts/A16-enter-p95.md).
- **S13, G57 (owner, 2026-10-20; built by G65): names from Giac's state;** an undecided run-once store is refused as `a:=` is. Archived, "Opus pass 106". Would change if: A16's RAD Enter p95 > 150 ms.
- **P18 (2026-10-20): Giac evaluates, our layer decides** what is shown; no other engine answers at run time. Rule: docs/04 6.1. Archived. Would change if: a feature needs a second engine at run time; the checks push the Tab One's Enter p95 past 150 ms.
- **P19 (2026-10-20): a Giac bug is fixed at its cause** (patch, canary, link to Parisse; a TypeScript workaround only for a cause that is not local, registered in S17). Rule: `docs/rules-core.md`. Archived.
- **P20 (2026-10-20; narrowed by G85's GO, 2026-10-22): Giac's tree, not its text.** Names, stores, bound names, settings and a value's kind come from the bridge (`bridge.ts`; G99–G103); only Giac's print is read as text, in one module (G105, before R59); new code adds no bracket loop or name regex (the text baseline, G88). Would change if: a question the bridge cannot answer.
- **P21 (2026-10-20): Giac is pinned to Parisse's numbered Debian archive** (SHA-256 from its `.dsc`); a re-pin passes the golden gate. Archived, "Opus pass 96". Would change if: a fix we need is only in a snapshot.
- **P24 (2026-11-08): commercial reuse of our Giac fixes.** Written permission to B. Parisse (email 13) for patches 0001–0037, later fixes and the regression `.cas` files, not revocable; N62 stays GPL-3.0-or-later; a fix from outside code or another contributor is flagged before it is sent. Archived, "Opus pass 106". Would change if: a contributor other than the owner writes a Giac fix.
- **F50, F51 (2026-10-20, owner; built by G78):** a value through a division by zero, an overflow or a lost answer is refused with its reason, never Giac's text. Archived.
- **G33 and R56 (owner, 2026-10-19; built by A12, G83, R56b):** lazy definitions before R59; Solve knows the user's functions; plots of user functions wait for the owner. Archived.
- **R58b (2026-10-19; built by R67): a letter typed with Alpha is always a name,** in CAS too; e and i come only from their keys. Archived.
- **S14: the angle mode, route R (owner, 2026-10-19; built by R64 and G46).** Giac runs in radians in every mode, our parser carries `pasdeg`; rule: docs/04 2.12. Archived.
- **An undecided decision is refused (owner, 2026-10-19; built by G57):** a sign, comparison, floor or branch on a cut Giac cannot decide is refused as undecided, never a guess. Would change if: refusals turn up in everyday work where a ⚠ value served better.
- **A4a point 1, the cost of Enter (2026-10-19; G53):** keep the agreement check and G38's second decision at 1.35× of `36cfbd9`; G52 counts Giac calls per Enter in the gate; the Tab One decides ("A16 after G53"). Archived.
- **F29 (2026-10-18, G2 item 54): `exp` ignores the angle mode,** as on the G2 (`e^(i·90)` is −0.4481+0.8940·i in both modes); built by G21. Would change if: a Giac patch (G21b) replaces the rewrite.
- **R29: the parser's messages, and a space between two numbers (2026-10-17).** The messages are i18n keys (R52); a space between two numbers is an error ("put × between two numbers", R51), though the G2 gives 6. Archived.
- **G19 (2026-10-17): after a safe start, the next launch tries the stored definitions again.** Would change if: crashing definitions cost too many restarts in use.
- **G20 (2026-10-16): a CAS result lists the stored values it used, not the names the input binds** (G28; `tools/probes/bound.ts`). Archived, "Opus pass 96".
- **The architecture check (2026-10-15): G27, R44, R45.** Rule: docs/04 2.4 (a non-number that holds a float is `⚠`, with its would change if), 2.8 (`full`; a chip whose value is not exact), 5.5 point 1 (one key path).
- **F22 (2026-10-15): 10ˣ after a digit or a point inserts `×10^□`** (`5 10ˣ 2` = 500); DMS takes the number before it as its degrees. G2 item 48 agrees.
- **R18f1, R18f2 (2026-10-14): tests.** An exact true/false carries no mark; a test with a float side runs again at 14 and at P digits (true ≈, false ≈, or as typed). Archived. Would change if: a function is audited.
- **P9 (2026-10-12): typed decimals in the CAS view become exact, as in Home;** `approx()` gives marked decimals.
- **The marks (M4-1, M4-4 to M4-8, G3; 2026-10-12 and -13):** the rules are docs/04 2.4 and 2.8.
- **P10 (2026-10-12): Giac's English help lines in Find.** Confirmed by B. Parisse (email, 2026-10-19): `aide_cas` is entirely GPL; the non-GPL French documentation means R. De Graeve's LaTeX/PDF manuals.
- **P5 (2026-10-11; revised 2026-10-14 and by S12, 2026-10-19): behaviour against the reference.** Complex `sqrt(-4)` and `asin(2)`; Home keeps Giac's principal root, the ∛ template, Function and Solve the real odd root (R39). Archived.
- **P8 (2026-10-12): the engineer core:** milestones 4, 5, 6, each with benchmark tasks; fewer features done well beat G2 parity.
- **P4 (2026-10-11): the reference's logical key layout, our own look;** ▲ on an empty line picks the last history row.
- **User requests (2026-10-11):** the Format key, ∡ polar entry, key vibration, a tap places the cursor, E-notation formats.

### Units (milestone 5)
- **Prefix entry (owner, 2026-10-31; night review fh-8):** Home has none; a prefix goes in the unit view's prefix cells (P11, docs/05 §7.2), and docs/04 2.7's prefix chip is dropped.
- **G81 (Opus pass 24):** a result whose every leaf cancels (`μ₀·ε₀·c²` = 1, σ 0) keeps `≈`. Archived, "Opus pass 96". Would change if: the owner wants `=` for a σ of exactly 0.
- **R24d (Opus pass 23):** an empty user cell's Find pick sets that leg and lands in the slot (one trip does both); the six off-pad units and the units menu's Tools and Const tabs: archive.
- **R24b and R24c (Opus pass 22): the unit pad and the unit view's entry, as built.** Archived, "Opus pass 106". Would change if: the Tab One's first unit result passes 1 s.
- **P22 (2026-10-20): libqalculate leaves the build;** its numbers are checked in (`find/factors.yaml`), refreshed by a developer tool (A21, A60). Archived, "Opus pass 96". Would change if: the unit view needs qalc at run time.
- **Angles in the unit view (owner, 2026-10-19; built by G40):** an angle is a quantity both ways; the rad drop and the 2π·r·n note as built. Archived. Would change if: G2 item 68 shows the G2 refusing both.
- **G37 (owner, 2026-10-19; built): °C and °F inside a compound unit are a temperature interval** (1 °C = 1 K); alone they keep their offset. Archived.
- **P15 (2026-10-14): the unit view computes on Giac** with the Find index's exact SI factors; libqalculate never runs in the app (P22). Archived. Would change if: a unit need has no clean exact form; the unit view feels slow on the Tab One.
- **P14 (2026-10-14) and the P14 arrangement (2026-10-18, S5): the unit pad.** Rule: [archive/r9-unit-pad.md](archive/r9-unit-pad.md), `spec/unit-pad.yaml`. Archived. Would change if: the owner's units take ≥ 3 presses; R24b's reach costs; the owner misses letters in a slot.
- **S1 (2026-10-13): the unit slots.** The number comes before the units key; digits in a slot are only exponents; a live reading under the slot. Archived, "Opus pass 96".
- **G15 and G25 (2026-10-18): rpm and rev.** `rpm` counts turns (1/60 Hz); `rpm → rad/s` is refused (G32). Archived, "Opus pass 96". Would change if: a user needs angular speed from rpm in one step.
- **The units menu (2026-10-13): the G2's flow, our data** ([spec/units-menu.yaml](../spec/units-menu.yaml)); the grids from the Find index by dimension. Archived, "Opus pass 96". Would change if: the owner misses a G2 unit in a grid.
- **S4 (2026-10-18): a library file carries definitions only;** settings and key slots go only in the backup. Archived, "Opus pass 85". Would change if: keyboard set-ups are shared (a `// key:` line).

## Defaults

The defaults that bind code and tests, one line each. A default changes when its "would change if" happens or the owner says so.

**Entry and keys**
- **⌫ and Del keep a template whole** (R23–R26h, R47): never half a template or a lost box. Archived. Would change if: G2 items 44, 46, 49 or 51 differ (the G2 way wins unless it leaves half a template).
- **The cursor stops only at a box** (R27b) **and goes where the user aims** (R42, R43). Archived, "Opus pass 122". Would change if: G2 items 50 or 57 differ.
- **R71 (Opus pass 30):** ± types on the Home and CAS line for the units key to read, and is dimmed in an app; rule: docs/06 section 2.
- **Hardware keys** (R31, R45): docs/04 5.5 point 1; `e` after digits is ᴇ; characters no key types do nothing.
- **Nothing takes focus while the app is away** (R25a–c) and **Focus on return:** MathLive's own restore is off (R22). Would change if: a desktop browser loses the caret after switching windows.
- **Flicks** (R9): arm at 20 px, cancel within 12 px, a cancelled touch stays cancelled; one lock at a time. **⌫ auto-repeat:** archive. **Alpha lock:** Alpha twice locks capitals, Shift Alpha Alpha lower case. Would change if: the owner's hands say otherwise.
- **R58 (Opus pass 18): in the CAS view Alpha types lower case and Shift + Alpha the capital;** the lock flicks swap with it; Home, the apps, Find and the unit slots keep Alpha = capital. Would change if: the rest of G2 item 45 differs.
- **A selection is the argument of the key** (R17); **powers bracket a compound term before the cursor** (L8). Archived, "Opus pass 122".
- **The exponent mark** (R14): `\emark` drawn `ᴇ`, one number literal; `1ᴇ` on an empty line, after an operator, a bracket or a comma, and at a box's start (G2 item 40); a non-integer exponent is an error.
- **Tmpl and a b/c** (R10): one toggle per result type; ▶ jumps to the next empty box while one is ahead; ° and DMS mean degrees in every angle mode. **Mixed numbers** are a Tmpl template, `\tfrac` after anything but a whole number is an error.
- **Enter during a job (Opus pass 120):** starts nothing, the line stays (`session.submit`). Would change if: the owner wants it queued.
- **Sheets** (R7, R8, R21a): the last pick per sheet in memory only; the letter filter on lists over 10 items; Mode and Settings open on their first row; a sheet's place is fixed when it opens; the viewport is not dimmed under a pick sheet.
- **User keys** (R15b): a slot is `{ label, action }` in keyboard.yaml's action form, null empties it, the user's choice wins over a default.
- **Keypad legends** (R6): a key is dimmed when its layer gives nothing; faces and legends fitted in JS (9 px face, 8 px legend minimum); 4.5:1 contrast.
- **The kept line** (R34): `{ view, latex, chips }` under `entry`, written on hide once settled, restored only into its view.
- **An app's line stays with the app** (R76, Opus pass 60; R76f1): it is cleared when you go back to Home or CAS, only your own typing follows (R34); Enter in Solve's Num view empties the line. Archived.
- **Working… after 150 ms** (F8): the busy line and Cancel are drawn late; Cancel works from 0 ms.
- **One-line mode:** `^` is literal and the exponent is the next signed factor. **Results are insertable**, bracketed when a sum. **Default angle mode: radians.**
- **R98, Clear and Delete (Opus pass 50):** rule: docs/05 3.5 (cancelled and note rows too; one Undo copy per view; a backup never holds it). Archived.
- **R112 (Opus pass 50): a dead key gives three pulses,** the touch's at finger-down, then its double (docs/05 3.7).
- **R116, the entry's highlights (Opus pass 51):** the caret is --alpha; the bracket box and the selection are --pick with --text on them. Archived. Would change if: the owner wants the text floor in the box.
- **R144, R146 (Opus pass 85):** keys beside a pick sheet stay dimmed (a tap only closes it); Shift + Help reads "Settings", its face shrunk to fit. Would change if: the owner's look on 11-07.
- **R157, the mark (Opus pass 122):** `--mark-faint` keeps the mark at most 1.3:1 on `bg`; Home's tile is a mask. Archived, "Opus pass 123". Would change if: the mark cannot be seen on a device.
- **R153–R155 (Opus pass 96):** the generator's moves stand; N62 Dark's first frame is #092726 everywhere; the ring keeps 0.12 from --error in normal vision only; the error outline follows a row whose status is error. Archived, "Opus pass 97". Would change if: the owner's look after R24d.
- **View keys and the load queue** (Opus pass 109, R148f2): behind waiting keys Symb, Plot and Num wait in order (c46). Archived, "Opus pass 122". Would change if: a view key feels dead during a load on the Tab One.
- **The tips' text stops at 18 px** (Opus pass 110, R171): six cards at scale 2.0 cannot fit 360 × 740 at 32 px. Would change if: the owner wants them to follow the scale and scroll.
- **A sheet that cannot fit at its floor scrolls, at 360 × 740 too** (Opus pass 108, R148f1; docs/05 3.1): Settings › Appearance scrolls; no key row or floor gives way. Archived, "Opus pass 117". Would change if: the owner's look at 360 × 740 says otherwise.

**Engine, precision and formats**
- **Honest precision** (G2): rule: docs/04 2.4 rules 2–3; assignments evaluated once. **G44, G23:** the inverse distributions are solved against our MPFR forward functions, every fallback keeps ⚠. Archived, "Shortened 2026-10-21 (P23)". Would change if: a G2 user types Giac's aliases.
- **Stored definitions** (G3): rule: docs/04 6.2 `defs` and 2.4 "Built in G3"; k ≥ 15 in `evalf(<exact>,k)`; the defs load times out after 3 s and a timed-out store is never saved over.
- **G154 (Opus pass 42): no size, no underflow.** A value that is MPFR's 0 at every precision is refused "Underflow" only when Giac states its size; otherwise it shows ⚠ 0 (backlog F161). Archived. Would change if: Giac can size such a sum.
- **G148, G148f1, G148f2 (Opus passes 62, 63, 65):** approx or evalf past MPFR's range is refused as the bare input is, inside a larger input and per call too. Archived. Would change if: a cheaper test tells exp(-10^20) from 0.
- **G22, G26:** `once` for a value evaluated once; `uncDigits` counts on the value as shown. Archived, "Opus pass 97".
- **Home and CAS share one Giac context, each with its own Ans** (`pasans`, `pcasans`). Would change if: G2 item 52 shows separate variables.
- **G92, G93 (Opus pass 73): what Giac changes behind the host** is put back after each input (`assumed.ts`, a probed list); `restart(1)` keeps Giac's meaning. Archived.
- **The angle mode, route R (S14, R64, G46; Opus pass 31):** docs/04 2.12 (the ° template, the coordinate commands). `sinc` takes no factor (a function of a number, F29): sin(x)/x in radians in both modes; `polar_point`'s angle takes the factor (R64f2). Would change if: the G2 reads sinc in degrees.
- **R39 (Function, Solve; S12):** a literal fraction exponent is reduced first (`(-8)^(2/6)` = −2); the root template stays the real root in every view.
- **R18:** Greek names with Giac stand-ins; `&` refused until G2 item 41; `==` never answers on undecidable sides; Home draws a non-number from `latex()` (R18f3). Archived, "Opus pass 97".
- **R52:** `SerializeError` carries the English text plus key and values; `parseError(key, vars)` in `app/src/i18n/enParser.ts`.
- **Home number formats:** `digits` are significant digits; STD plain for 1E-4 ≤ |x| < 10^digits; rounding half away from zero (the G2 rounds ties half to even, item 8; one rule, no option). **G31:** Fixed turns to scientific with the same decimals when a nonzero value would show only zeros, with confirmed digits only (in each complex part too, G36).
- **G5:** a list's mark: docs/04 2.4. **Chips and Ans** (R2): rule: docs/04 2.8; a chip has two arguments (key, shown); an operator on an empty line starts with Ans only when the view has a result.
- **Time limits:** CAS 10 s soft budget (Cancel prominent), Giac's 600 s net; Solve and analysis 30 s; Cancel replays the definitions only (not Ans). Home and units (passes 86, 91; G185; owner, 2026-11-07): a 4 s watchdog from engine-ready restarts the engine; a Σ Giac sums term by term is stopped, no closed form (G184), CAS keeps it.
- **Solve and Plot:** a root is accepted at relative residual ≤ 1e-15 at 30 digits, else ⚠ (systems: < 1e-6 with ⚠); Plot searches only the visible window; the signed area by Romberg, `int`, then `gaussquad` with ⚠. Archived.
- **Function app:** window x ∈ [-10, 10] square; trace step 0.1 (1-2-5 rule); Num from 0 by 0.1, `NaN` at a pole; a refused Num value gets a notice (R99). Archived.
- **Parser (L6):** odd root templates are real roots; `{…}` is a list; the decimal comma is MathLive's `3{,}5` in either mode, and `{,}5` is 0.5 as `.5` is (R99); a bare comma, like `;`, separates arguments (R57); `p(x):=…` makes p a function (R56).
- **Discrete distributions (G113, G113f1; patches 0009, 0010):** off the integers or below the support a pmf is an exact 0 and a cdf takes floor(k). Archived.
- **G140 (Opus pass 34): a value Giac holds only as a double** is an unaudited double: ⚠, at most 14 digits, never ≈. Archived. Would change if: Giac gets an MPFR path for them.
- **R55: digit groups** in a drawn Home or CAS numeric result: the mantissa in threes from the point with a thin space, on a side of five or more digits; not in the entry line, a chip, Copy or the status line. Archived.

- **The deep check of 2026-10-19 (G38, G57, G48, G39).** Rule: docs/04 2.4. Archived, "Opus pass 122".
- **R36f1 (Opus pass 50): `1.0` is an exact decimal in Home,** so `√2·1.0` stored to B stays exact and B+1's line says "≈ rounded", not "uses B"; `why.rounded` names a stored float (`evalf(√2)`), never one of our names.
- **G158 (Opus pass 52):** `sem` and `median` take one list only ("needs one list of values"). Archived, "Opus pass 97".
- **Unequal shapes are refused (pass 119):** `+`, `-`, `*`, `dot`, `cross`; Giac pads. A result with no list and no dimension error is not walked (pass 123): `col(idn(2),0)*col(zeros(3,3),0)` stays 0 with ⚠. Would change if: the owner says.
- **Our Giac text binds only `pas…_` names (pass 123; G303, F205):** no user can type one; a free name in a cdf or icdf call gives no number, the inverse ones too (G221f1). Would change if: the parser takes a trailing `_`.

**Units**
- **G17:** dB is a field-ratio level, dBm and dBW to 1 mW and 1 W; offsets and levels alone convert, impossible levels and temperatures are refused (G16's zero: G35, below). Archived.
- **G18:** ± is `pasupm(value,sigma)`, each an independent standard uncertainty in the slot's unit; ± inside sin, cos, tan works. **G25:** a typed product is kept when at most one token carries a prefix or its factor is 1 (N·m, kW·h), else SI with a prefix.
- **G13, G7:** the CODATA overrides and hp, mmHg, inHg stay in `find/factors.yaml` until qalc agrees (P22); `rev` is a count. Archived, "Opus pass 97".
- **R28:** rule: docs/04 4.3 (`pasu<n>` in the order written, the end slot after `\to`); a slot only right after a number literal; σ is a number literal, or `n %` of the value (R104, docs/04 4.2); a product with a slot keeps its brackets.
- **R24a, R24af1:** ⁻¹ turns the power's sign, ², ³, ⁴ set its size; √ arms like a prefix; a unit without an exact factor never pairs. Archived, "Opus pass 96".
- **G161 (Opus passes 60, 62):** W, VA and var are three kinds; a conversion or a sum between kinds is refused, a product is not. Archived. Would change if: a power-triangle rule is packaged.
- **R60:** the alternatives row (units/alternatives.ts) takes a temperature's three units (absolute K, °C, °F; interval K, Δ°C, Δ°F) and no target; Δ°C is K's Find alias, so its tap shows K. Would change if: R62 labels the alias.
- **R61 (Opus pass 28):** a unit result's σ chip is an independent input of σ. Archived, "Opus pass 122". Would change if: a chip keeps its inputs' basis (G81).
- **R63:** in the unit view a result chip is a number with a slot and its σ (R115). Archived, "Opus pass 97". Would change if: the owner wants a chip's σ dropped there.
- **R92, the units menu's Constants and Tools (Opus pass 51):** the last two rows, after the categories; a constant goes on Home's line at its cursor; UPART's row is disabled until built. Archived.

- **The check of 2026-10-19:** a zero term keeps its dimension for the unit check (G35 rewrites G16's "an exact 0 loses its dimension" and the known gap of cancelling terms). Would change if: the per-term check costs more than the 5 ms p95 bar.

- **The deep check of 2026-10-19 (G41):** σ includes the GUM's second-order term, ⚠ when it passes 10 % of σ² or x ± 2σ reaches a singular point. Archived.
- **G143 (Opus pass 36): σ through a step function** stays the GUM σ, with ⚠ "the interval reaches a jump" when an input's x ± 2σ reaches one. Archived. Would change if: S16's sweep finds a missed jump.

**Library, release and process**
- **The check of 2026-10-19:** a Home value that leaves its evaluation (stored, Ans, a `\res` chip, an export) is the value shown, whatever the angle mode is later; a CAS value stays symbolic (G34). Would change if: the G2 is found to re-read a stored Home value in the new mode.
- **G33:** a definition's description is the comment line above it; G30's E-series tables are checked against round(10^(2+k/n)) with the one published exception (9.20 at E192).
- **R59, R59f1 (Opus passes 72, 73):** the clash sheet stays; the library stays out of the start chunk. Archived, "Opus pass 97".
- **The release path (A7, A8, A45, A48; 2026-10-15, owner 2026-10-29 and 2026-11-03):** v0.1.0, APK and website from one tag (A48); golden on the release engine before signing; the web names (`sw.js`, IndexedDB, manifest `id`) frozen. The test tag is `vX.Y.Z-test`; `master` follows phase-1 from 2026-11-03 (owner). Archived.
- **Releases:** the engine is built in the pinned container (P2), under `setarch -R` so `giac.wasm` is bit-reproducible. **Minimum WebView:** Chrome 111 (owner, 2026-11-07; `color-mix`), with an inline "update" notice below it (R160; minSdk 24).
- **Tests:** the golden gate as docs/04 7.3; a pending task's budget is its planned press count, values `derived` or `oracle`; timing tests skip their assertion when the load average exceeds the cores; Vitest has no DOM, a DOM count is a Playwright test (R132, Opus pass 72). Archived.
- **A47b, a start does not wait for the queue (Opus pass 13):** a run's start copies node_modules under its own `nodemods` lock, not under `integ`. Archived. Would change if: a copy is ever seen half-refreshed.
- **A45, a criterion on a shared file (Opus pass 19):** its exact text under "For shared files" meets it; the audit does not FIX the file, the next Opus pass applies it. Archived. Would change if: the owner lets workers edit `THIRD_PARTY.md`.
- **R87 (Opus pass 15):** no ISC or UIUC text in `LICENSES/`: yaml is build-time only, Emscripten's runtime ships under MIT (THIRD_PARTY.md). Would change if: a shipped part needs another licence's text.
- **G116, the sweep oracle:** on atanh's cut it takes Giac's side (+π/2·i for a real x > 1), and an argument on a cut within noise is a skip. Would change if: a case shows Giac off the textbook side.
- **R38b, R88, the restore's checks and presets (Opus pass 29):** `state/backup.ts` repeats the start readers' rules, each guarded by a test on the same values; no pin in `vite.config.ts`. Archived. Would change if: a guard misses a drift.
- **R89, presets in Mode (Opus pass 47):** no built-in Default; Delete acts at once; names typed as maths. Archived, "Opus pass 97". Would change if: the review after R24d.
- **R40, R124, R125, Settings › Numbers (Opus passes 64, 65; owner 2026-11-04).** Archived, "Opus pass 122" and "Opus pass 66". Would change if: the milestone review.
- **G119, Giac's sequence answers in Home (Opus pass 6):** each shows its value (one element) or a list in braces, so Ans and a stored name (`=>` too, G173f1) read back a value or a list; CAS too since G173 (owner, 11-05). Archived.
- **G172, the double fallback per element stops at 32 elements** (`MAX_DOUBLE_ELEMENTS`; Opus pass 122); a longer list shows Giac's text. Archived, "Opus pass 123". Would change if: the per-element calls are batched.
- **R156, Key shadows (ron, run 762):** a look stored before R156 has them on; Appearance opens on Theme. Archived, "Opus pass 97". Would change if: the owner wants an older look flat.
- **A66, the key click (Opus pass 97):** with the system's touch sounds off the plugin plays its own click: the app's switch alone decides (R112). Archived, "Opus pass 106". Would change if: its device check, or the owner wants the system's setting to win.
- **Start chunk room (Opus pass 99):** a package that fails the 61 kB pin on a chunk hash alone gets a cut in its fix (no change of behaviour), never an allowance; the pin is then the measure plus 0.05 kB. Archived, "Opus pass 106". Would change if: the owner raises the 61 kB budget.
- **R163, Key pop-ups (ron, run 763):** one switch for both bubbles over the keypad; a look stored before R163 has it on. Would change if: the owner wants the pop and the flick bubble apart.
- **R53, R159 (Opus pass 101):** Counters: Shift and Alpha share a row (seven rows); `uses` is not backed up. Would change if: the owner wants the counts apart.

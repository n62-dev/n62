# Names: one token only when entered as a name, through one registry (design note)

**Status: decided** (the registry) (the owner, 2026-11-16 about 11:00 and 11:30; design by sandra; sofia's re-check 3, T1 to T8, folded in). Base: phase-1 `a6a6c254`. Probes under 1 s, no lock: `parse.ts`, `engine.ts`, `smoke.mjs`, `mathlive/ssr`, scratch calls, a 1,798-name scan.

## 1. The rule

**A defined name** is a composite, written as one token:
- **First:** a Latin letter or a Greek letter. Never a digit, so `2x` stays 2·x. Never π, which is the constant, and never ο, υ or ς, which `GREEK_NAMES` marks `-` (`engine/standIns.ts:11-12`).
- **Then:** letters (Latin or Greek) and digits, plus one optional subscript at the end, such as `ΔT_1`. No operators and no spaces.
- **How it is entered:** through the Store sheet, Vars (its typed row) or an Alpha-lock word. Each puts `\operatorname{…}` on the line, and `\omega_{n}` on the line is a name too.

**Everything else is a product.** Letters typed apart stay a product and are drawn with a dot (R354, R355). This fixes K7: `F1(2.5)` is F·1·(2.5), so with F = 10 it shows 25 (engine probe). One existing rule stays: a letter with a typed subscript (`T_{1}`) is one name.

## 2. Today (evidence)

- **Vars (R258)** inserts `\operatorname{name}` (`find/names.svelte.ts:38-41`). **The Store sheet (R281)** inserts `\operatorname{typed}` (`views/storeSheet.svelte.ts:51-55`).
  - The sheet takes no Greek: Shift+9 closes it (`views/sheetKeys.ts:105-115`, `keyboard/route.ts:325-331`).
- **The parser** reads `\operatorname{X}` only when X is stored, and refuses it otherwise (`input/parse.ts:775`, `:795`).
  - `groupText` joins the tokens: `\operatorname{\sigma max}` becomes `sigmamax`, the same as a typed "sigmamax".
  - `\omega_{n}` is refused ("unexpected token").
- **Alpha lock** types each letter alone (`route.ts:494`); **Copy** gives "Δ T" for both `\Delta T` and `\operatorname{\Delta T}` (`plaintext.ts:189`).
- **Every name reader is ASCII** (`engine/giacPrintStart.ts:78`, `engine/library.ts:191`, `clipboard/python.ts:625`). In Giac a bare `Δ` is symmetric difference and a bare `Σ` gives `undef`.
- **Giac's own names read as values when not stored (T1):** `PI`/`Pi` π, `DIGITS` 12, `epsilon` 1e-12, `inf` ∞, `MAX`/`SIN`/`ABS`/`SIZE` undef, `mean` `'mean'`, `euler_gamma` 0.5772 under evalf.
- **A free name is exactly one that passes this test:** `[X,evalf(X),type(X)]` prints `[X,X,identifier]`. `rate`, `DeltaT`, `omega_n`, `Deltax_`, `psia` and `catalan` pass; all of the above fail (smoke).

## 3. The registry (`app/src/engine/nameRegistry.ts`, one module)

**It holds each defined name as a pair:** the display (`ΔT`, `σmax`, `T_1`, `ΔT2`, `rate`) and the engine name, an ASCII Giac identifier (`DeltaT`, `sigmamax`, `T_1`, `DeltaT2`, `rate`). Every multi-character name is in it, plain ones too (as `rate`↔`rate`), so it knows every name in use.

**Built-in pairs,** fixed and never stored, are the single letters as today:
- the Greek ones (`θ`↔`theta`, `β`↔`beta_`) from `GREEK_NAMES`;
- `e`↔`e_` and `i`↔`i_`.

These stand-ins are kept for good (release point 7). One old rule stays: the spelling of one Greek letter typed in the sheet ("theta") is that letter. It is the same engine name since v0.1.0 and cannot mislead.

**Who reads it.** The parser, the renderers (rows, Vars, Find, the store sheet, the uses line, the unit notes), Copy, Copy as Python, the library, the backup and the unit view's slots all read names through it. `typedName`, `isStandIn` and both `nameLatex` functions become thin calls into it.

**Stays as is:** the parser's single-letter Greek map (`parseTables.ts` `GREEK`), the `e`/`i` rule, `refuseStore` and `refuseOurs` (the registry calls them).

**Only pairs are drawn specially.** An unregistered or plain name is drawn exactly as stored. So `alphabet`, `psia`, `mus`, `taux`, `nux`, `rhoa`, `chi2` and `Deltax_` never turn Greek (T2, T4). This drops G393's earlier spelling rule.

**Engine names: one allocation, a bijection.**
- **Candidates for a new display:** its transliteration (each Greek letter as its spelling without `_`, the subscript kept), then that with `_`, `__`, `___`, and so on (never `_` followed by letters or digits, which is a subscripted name's spelling).
- **The first free candidate wins.** Skipped: another pair's or stored name's engine name, a stand-in, `pas…` (G341), our tables, a failed Giac free test.
- **A display that is itself Giac's own** (`PI`, `DIGITS`, `mean`) is refused with "PI is Giac's own name", never renamed (T1).
- **Examples:** `βd` → `betad_` (`betad` is Giac's), `μl` → `mul_`; a typed "DeltaT" after ΔT took `DeltaT` → `DeltaT_`, so a typed ASCII name is never silently ΔT's variable.
- **The scan:** 29 spellings × 62 rests = 1,798 names. Only `betad`, `gammad` and `mul` are taken (T5, T6, `type(betad)` = func).
- **Giac's free test runs** at allocation and once per start for every unstored pair, so a later engine that adds a command is caught.

**Drawing.** A pair's LaTeX is `\operatorname{\Delta T}_{1}`, and MathLive draws it upright as one atom. The parser builds the same display key back from the group: Greek commands become their letters, so `\operatorname{\sigma max}` is "σmax", not "sigmamax".

## 4. Stored data

**A new key, `names`.** It is a list of `{display, engine}`, capped at 1,000 pairs whose display differs from their engine name (a new one past it is refused, never aliased). Its validator checks the grammar, the bijection, ASCII engine names and no `pas`. It comes with a `DATA_VERSION` step, the next number when it merges, and a `BACKUP_KEYS` part.

**The step seeds, it does not start empty.** It reads every name old data can reach, with no rewrite:
- each multi-character name in `defs`;
- each `\operatorname{…}` and each letter with a subscript in the stored LaTeX (`history`, `entry`, `app.function`, `app.solve`, `userKeys`, `presets`), the user names in stored chips' Giac text, and for a group with a Greek command its display (ΔT) on the same engine name.

It registers each with the engine name v0.1.0 gave it. So an old row keeps its meaning, and a deleted name an old row still reads can never be given to a new display.
- **One exception:** old LaTeX holding both `\operatorname{\Delta T}` (pasted) and a plain `DeltaT`. Both meant `DeltaT`, so one becomes a read-only alias. Test it.

**The library format is additive.** An optional block of `// name ΔT DeltaT` lines goes after the stamp, ending in a blank line. Today's reader takes a comment followed by a blank line as nothing (`engine/library.ts:144-164`).
- **Old files:** a v0.1.0 file loads (its names plain).
- **New files:** they carry the new stamp, so v0.1.0 refuses them as "made by a newer N62" (`library.ts:135`), as with any `DATA_VERSION` step.
- **A name clash** between the file and the registry refuses the import with both names. It is never renamed and never aliased.

**Copy as Python** writes engine names, with `# ΔT` when the display differs.

**Backups:** a backup without the part restores through the seeding step, and v0.1.0 refuses a newer backup, as today.

**Old rows and defs keep their LaTeX and Giac text.** No rewrite.

## 5. Packages (in `packages/`; all after the v0.1.0 tag, 0.2, before R346)

| Id | Owner | What | Size | After |
|---|---|---|---|---|
| R354 | ron | the dot in rows and Copy | 0.75 d | – |
| R355 | ron | the dot on the entry line | 0.75 d | R354 |
| G393 | gorge | the registry core, and the drawers through it | 1 d | R337 |
| G394 | gorge | the stored key, the seeding step, backup, Giac's free test | 1 d | G393 |
| G395 | gorge | the library's name block, the import clash, Python | 0.75 d | G394 |
| R356 | ron | the parser reads names through the registry; T1 refusals | 1 d | G394 |
| R357 | ron | the name field takes any composite | 1 d | R356 |
| R358 | ron | an Alpha-lock word is one name (CAS too) | 1 d | R356 |

**R346 (T7):** its Starts when gains R355, R356 and R357, and its slot rule becomes one slot per name token, read through the registry. The exact replacement lines are at the end of [R356](../shifts/packages/R356.md).

**Owner questions:** none change a package. Alpha-lock words in CAS: yes, answered.

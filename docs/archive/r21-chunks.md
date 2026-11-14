<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# R21: one chunk group keeps the start graph whole (S52)

**Status: decided.** Built by R294 (merged `ef2d3c77`, Opus pass 176): the group is in `app/vite.config.ts` and the hand copies are gone; item 4 of section 3 stays for the package that touches `units/open.ts`. Labels `r21-*` belong to this note. Base: `phase-1` `c3085825`, Vite 8.3.4 with Rolldown 1.2.13 (`app/package.json:43`), engine `_out/key-571fc1b085cff204`, win99. Rerun: `tools/probes/chunk-groups.mjs` (section 5).

## 1. The option and what it does

The option is `build.rolldownOptions.output.codeSplitting` (Rolldown 1.2.13's name; `advancedChunks` and `manualChunks` are its deprecated older names, and `codeSplitting` wins when both are set). Its `groups` put modules into named chunks; a group's `tags: ["$initial"]` takes every module Rolldown tags `$initial`, that is, every module an entry imports statically, directly or through others (rolldown.rs, `CodeSplittingGroup`, read 2026-11-13). The probe's group is `{ name: "start", tags: ["$initial"], priority: 100 }`.

Why the hand copies existed: when a lazy chunk imports a value from a module of the start graph, Rolldown (without a group) cuts that module, and others on the same path, out of the entry into small shared chunks. The start still loads them all, as separate files, and each pays its own import and export glue and its own gzip header. The group forbids that cut: a start module stays in the start chunk, and the lazy chunk imports it from there.

## 2. The numbers (`npm run size`'s start chunk: the entry plus its static imports, gzip at zlib's default)

| Build | Start files | Raw | Gzip | Size test |
|---|---|---|---|---|
| phase-1 as is (`base`) | 1 | 174,706 B | 61,892 B | passes |
| + the group (`group`) | 1 | 174,706 B | 61,892 B | byte-identical output (same entry hash), passes |
| the copies put back, no group (`restore`) | 7 | 175,409 B | 63,146 B | **fails**: over the 63 kB budget; unit view 38.31 kB over its 38 kB |
| only `calc/library.ts` back (`restore:lib`) | 1 | 174,727 B | 61,923 B | passes; the same bytes with the group |
| only `units/row.ts` back (`restore:row`) | 7 | 175,395 B | 63,152 B | fails |
| only `state/backup.ts` back (`restore:backup`) | 8 | 175,473 B | 63,228 B | fails |
| the copies put back, with the group (`group+restore`) | 1 | 174,742 B | 61,921 B | start passes (+29 B); unit view 38.01 kB, 30 B of it the probe's own marker in `row.ts` (section 6) |

The split files are `engine/format.ts`, `engine/giacPrintStart.ts`, `engine/standIns.ts`, `state/writer.ts`, `engine/types.ts`, the preload helper and, for `backup.ts`, `lazyOnce.ts`: start modules that the session's graph and the lazy chunks share. A check variant (a group on two lazy i18n tables) makes a chunk of its own, so the option does reach Rolldown; with the `$initial` group nothing moves today because nothing is split today.

**The start count does not grow** with the group: the output is byte for byte the same, since the hand copies already keep the start graph in one chunk. The group cannot pull a lazy module into the start either: a module only lazy chunks import has no `$initial` tag.

## 3. Recommendation

Add the group to `app/vite.config.ts` and remove the copies one package at a time. The group changes no byte of today's build (same hash), so it carries no behaviour risk now. With it, putting all three copies back costs +29 B gzip at start instead of +1,254 B in six extra files; without it a single put-back breaks the 63 kB budget. Add a size-test rule with it, "the start is one JS file", so any later split fails at once by name instead of showing up as +1.3 kB nobody can explain. Order of removal:

1. **`calc/library.ts:14-15, 36-38`, the errors matched by name**: not bundler-forced today (`restore:lib`: one file, +31 B gzip, the same with or without the group; the start stays one file, so `engine/types.ts` stays in the start chunk and the lazy chunk takes the classes from there; the old note's "+0.23 kB" no longer holds). It can go first, with no option; G315 touches the same line (`calc/library.ts:38`).
2. **`state/backup.ts:144-148`, the copied rules** (`HISTORY_ROWS`, `KEY_LAYERS`, `SETTING_RULES`' `MAX_DIGITS` and `HAPTIC_MS_RANGE`): forced today (+1,336 B, 8 files); free with the group. `restore.test.ts`'s comparison of the two copies goes with it.
3. **`units/row.ts:13-14`, the type-only import of the session**: forced today (+1,260 B, 7 files); free with the group. Nothing is copied there, so removing it means only deleting the warning comment. What is gained is that later unit code may import session values.
4. **`units/open.ts:11-13`, `units/pad.ts` held in the unit view's chunk**: **(to verify)**: not measured, because putting it back means rewriting the pad's dynamic import, not a text swap. By mechanism the group covers it: Svelte's runtime is `$initial`, so the group keeps it in the start chunk. The package that touches `open.ts` checks it with a new restore set in the probe.
5. **`scripts/size-check.ts`'s `engine/giacPrint.ts` in a chunk of its own**: no hand copy. Since R264, `giacPrint.ts` is lazy only (its start part is `giacPrintStart.ts`), and it is a shared lazy chunk with and without the group. Nothing to remove.

Not forced and needing no option: `state/backup.ts:172-175`'s `presetsOk` (a strict copy of `presetRecord.ts` `readPresets`). `backup.ts` imports `presetRecord.ts` already (`backup.ts:11`), so the next package that touches `backup.ts` replaces the copy with the import and drops the comparison in `presets.test.ts`.

Alternatives, one line each: no option and keep the copies (each new lazy feature that needs a start value pays a copy or about 1.3 kB). `codeSplitting: false` (all lazy chunks inlined into the start: MathLive alone is 808 kB, far over the 180 kB budget). A group per shared module (brittle: it names files and breaks when they move).

## 4. Package draft `r21-P1` (for the Opus pass to place; the owner of `app/vite.config.ts` and `scripts/size-check.ts` does it)

Add the `$initial` group to `vite.config.ts` `build` (one line, with a comment naming this note), and to `size-check.ts` a check that `startFiles` is one JS file (a failure names the extra files), with its unit test. Then put back the library.ts and backup.ts lines 144-148 imports (items 1 and 2), delete their copies and the tests that compare them, and the row.ts comment (item 3). Done when: `npm run size` shows one start file, the start chunk within +0.05 kB of phase-1's, the gate passes. Under a day; no device.

## 5. Rerun

```bash
cd app && npm run engine:copy && npm run index && cd ..
tools/devlock.sh slice <name> node tools/probes/chunk-groups.mjs base group check restore restore:lib restore:row restore:backup group+restore
node app/scripts/size-check.ts tools/probes/_out/chunk-groups/group-restore    # the size test on one variant's build
```

The probe writes each build to `tools/probes/_out/chunk-groups/<variant>/` with a generated config beside it. The restores are applied in memory by a transform plugin (the tree is not touched), and a restore that no longer matches stops the build. The nine builds take about 45 s on win99.

## 6. Limits

- The `restore:row` set adds a 30 B marker (`globalThis.probeRow`) so the value import is not tree-shaken away; that, not the group, is the unit view's 38.01 kB. The unit view chunk has only 20 B of room at phase-1 (37.98 of 38.00 kB, `base`), which is a risk for any unit package regardless of this note.
- One machine, one build per variant. Rolldown's output is deterministic for the same tree (`base` and `group` gave the same hash in two separate runs), so medians would add nothing.
- The group's effect on execution order: Rolldown warns that manual groups can run a module's side effects earlier. Here the group moves nothing that is not already in the one start chunk, so the order is today's. A Rolldown upgrade reruns the probe.

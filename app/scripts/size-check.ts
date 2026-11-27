// SPDX-License-Identifier: GPL-3.0-or-later
// The size test (docs/04 section 8.3): reads Vite's manifest (dist/.vite/manifest.json, `build.manifest: true`) and the
// build output, and exits 1 when a chunk is over its budget. Run by `npm run build` (so by build.sh) and as `npm run size`.
//   node scripts/size-check.ts [distDir]        # default: app/dist
// The Start chunk is the entry plus every chunk it imports statically (manifest `imports`, transitively), because all of it loads at start.
// It must be one JS file, the entry (R294).
// Units are Vite's: 1 kB = 1000 B, 1 MB = 1,000,000 B (so today's 142.62 kB start chunk is 142,626 B). Gzip is zlib's
// default level, which is what `vite build` reports. Budgets for chunks that don't exist yet (Find, Units, qalc) apply
// as soon as they appear in the build; until then they print as "not built". To change a budget, change docs/04 8.3 too.
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { precacheFiles } from "../vite-plugin-pwa-lite.ts";

const KB = 1000;
const MB = 1_000_000;

interface ManifestChunk {
  file: string;
  src?: string;
  /** Rollup's name of the chunk: a shared chunk has no `src`, only a name (the file's base name, e.g. "finder"). */
  name?: string;
  isEntry?: boolean;
  isDynamicEntry?: boolean;
  /** Manifest keys of the chunks this one imports statically (loaded with it). `dynamicImports` load later and are not listed here. */
  imports?: string[];
}

/** One budgeted thing: the files it covers (paths relative to dist) and its limits in bytes. */
interface Subject {
  rule: string;
  files: string[];
  rawMax?: number;
  gzipMax?: number;
  brotliMax?: number;
}

export interface Row {
  rule: string;
  files: string[];
  raw: number;
  gzip: number;
  brotli: number;
  rawMax: number | undefined;
  gzipMax: number | undefined;
  brotliMax: number | undefined;
  failures: string[];
}

export interface Report {
  rows: Row[];
  /** Rules whose chunk is not in this build (yet). */
  notBuilt: string[];
  failures: string[];
}

/** Vite writes sources relative to the project root, so a path in node_modules can start with "../../": strip those. */
function normalSrc(src: string | undefined): string {
  return (src ?? "").replace(/^(\.\.\/)+/, "");
}

/** G163: the app modules (paths from app/, e.g. `src/units/row.ts`) each emitted chunk holds, by chunk file, written by
 *  vite-plugin-chunk-modules.ts to dist/.vite/chunk-modules.json; the manifest lists no modules. Absent in a fake dist. */
export const CHUNK_MODULES = ".vite/chunk-modules.json";
function readChunkModules(dist: string): Record<string, string[]> | null {
  const path = join(dist, CHUNK_MODULES);
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Record<string, string[]>) : null;
}

/** G163: the shared chunks (no src, not loaded at start) that hold a module under `prefix`: Rollup hoists a module that
 *  two lazy chunks import into a chunk of its own, and the entry-only sum would not see it. */
export function sharedChunksHolding(manifest: Record<string, ManifestChunk>, modules: Record<string, string[]> | null, prefix: string): string[] {
  if (modules === null) return [];
  const start = new Set(startFiles(manifest));
  return Object.values(manifest)
    .filter((c) => !c.isEntry && !c.isDynamicEntry && c.src === undefined && !start.has(c.file) && (modules[c.file] ?? []).some((m) => m.startsWith(prefix)))
    .map((c) => c.file);
}

/** A272: a file's text with every hashed name held fixed. Vite names its files `<name>-<8 characters>.<ext>` (and the Find index
 *  the same), the engine `giac.<16 hex digits>.<ext>`; the start chunk lists them, and a new hash gzips a few bytes differently with
 *  no source change. Each hash becomes the same number of `~`, so the length and everything else stay. Gzip and brotli measure this. */
export function hashFree(buf: Buffer): Buffer {
  const text = buf.toString("latin1").replace(/([-.])[\w-]{8}(?=\.(?:m?js|css|json|wasm|html|svg|png|woff2?)\b)|(\.)[0-9a-f]{16}(?=\.(?:m?js|wasm)\b)/g, (m, a?: string) => (a === undefined ? "." : a) + "~".repeat(m.length - 1));
  return Buffer.from(text, "latin1");
}
/** Files whose text names other files: only these go through hashFree (a wasm's bytes are measured as they are). */
const NAMING = /\.(?:m?js|css|json|html)$/;

function readManifest(dist: string): Record<string, ManifestChunk> {
  const path = join(dist, ".vite/manifest.json");
  if (!existsSync(path)) throw new Error(`size-check: no ${path}; build with build.manifest: true (vite.config.ts)`);
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, ManifestChunk>;
}

/** The files loaded at start: every entry chunk plus every chunk it imports, transitively (the manifest's `imports`, not `dynamicImports`). Each file once. */
export function startFiles(manifest: Record<string, ManifestChunk>): string[] {
  const files = new Set<string>();
  const seen = new Set<string>();
  const visit = (key: string): void => {
    if (seen.has(key)) return;
    seen.add(key);
    const chunk = manifest[key];
    if (chunk === undefined) throw new Error(`size-check: the manifest imports "${key}", which it does not list`);
    files.add(chunk.file);
    for (const dep of chunk.imports ?? []) visit(dep);
  };
  for (const [key, chunk] of Object.entries(manifest)) if (chunk.isEntry) visit(key);
  return [...files];
}

/** R294 (archive/r21-chunks.md): the start is one JS file, the entry. Another JS file in `startFiles` means Rolldown cut a start
 *  module out of the entry (a lazy chunk imports a value from it); vite.config.ts's `$initial` group forbids that cut. Returns the extra files. */
export function extraStartFiles(manifest: Record<string, ManifestChunk>): string[] {
  const entries = new Set(Object.values(manifest).filter((c) => c.isEntry).map((c) => c.file));
  return startFiles(manifest).filter((f) => /\.m?js$/.test(f) && !entries.has(f));
}

/** G163: the unit view's entries plus the shared chunks that hold its modules, raw: 66.26 kB measured (open 26.91, find 9.05,
 *  calc 0.43, userCells 4.64, factors 15.00, slot 10.23; entries alone 36.39 kB), a pin at 66.5 kB so it cannot grow unseen
 *  (decisions.md R24b and R24c: G163, Opus pass 62); raised only with its reason in a report, as START_PIN_GZIP is.
 *  66.50 → 66.55 kB (R125): the branch measures 66,504 B (open 27,148 B, +238 B; the others as above): the separator
 *  in the unit view's groups (groupText's three separators, the rule for a comma under the decimal comma) and the sheet's
 *  view loaded with Find on units (R125 fix round 1: More… under load opened a Find nobody drew). 66,504 B + 0.05 kB.
 *  66.55 → 66.60 kB (R151): the branch measures 66,553 B (+36 B over phase-1's 66,517 B, all in open): the sheet's model is a lazy
 *  chunk now, so the unit view's load of the sheet's view names one more file in its preload list.
 *  66.60 → 66.97 kB (R159, R159f1; Opus pass 101: an allowance, the unit view is not the start chunk): the branch measures 66,917 B
 *  (calc 429, find 9,141, open 27,474, factors 14,999, slot 10,234, userCells 4,640): the chips pick on pointerup, as the keypad
 *  does (a tap Chromium gave no click for was lost; round 2 measured 66.81 kB), and a touchend listener on each chip cancels the
 *  click the browser still makes, which landed on the Find sheet More… had just opened. 66,917 B + 0.05 kB.
 *  66.97 → 67.09 kB (R258): phase-1 bc527dcd measures 66.96 kB, the branch 67.04 kB (unit view chunk 37.09 → 37.16 kB): the
 *  unit view reads a stored value of more than one letter (`\operatorname{rate}`) as Home does, so its host passes the
 *  session's stored values to the parser at each request (open.ts `values`, view.ts request). 67.04 kB + 0.05 kB.
 *  67.09 → 69.21 kB (R271): phase-1 5ce86572 measures 66,972 B, the branch 69,155 B (open 27,530 → 28,142, factors
 *  14,998 → 16,424, slot 10,234 → 10,379): a result chip after ± is the σ, so the builder links it to its value's slot,
 *  checks its dimension and converts its unit (build.ts sigmaIn, slotDim, slotFactor), the request carries its facts
 *  (chipUnit.ts sigmaChipOf) and the shown mark takes σ's (result.ts). 69,155 B + 0.05 kB.
 *  69.21 → 69.47 kB (R271f1): the branch before the fix measures 69.15 kB, after it 69.41 kB (unit view chunk 37.71 → 37.88 kB):
 *  σ's mark is decided once (evaluate.ts, in the worker), and the row and the chip store σ's facts, the view reads them where the
 *  ⚠ sits (result.ts), and a chip with them limits σ again when it goes in (chipUnit.ts uncChipsIn, build.ts sigmaFacts checks
 *  them). 69.41 kB + 0.06 kB.
 *  69.47 → 69.84 kB (G319): phase-1 d55b37b1 measures 69,410 B, the branch 69,790 B (factors 16,512 → 16,840, open 28,313 →
 *  28,361): the builder writes the formula's number part beside it (build.ts numberDims, UnitJob.number: each slot and
 *  constant as its factor), which the worker asks Home's refusals of (a text read of the job in the worker is what the
 *  text-rules ratchet counts), and messages.ts words Home's refusal with the app's table (t, not enEngine: that import made
 *  enEngine a chunk of its own, +0.14 kB gzip at start). 69,790 B + 0.05 kB.
 *  69.84 → 69.95 kB (R264, no unit code changed): phase-1 eaff256f measures 69,820 B, the branch 69,894 B (open 28,361 →
 *  28,398, factors 16,840 → 16,877): giacPrint.ts left the start chunk for a shared lazy chunk of its own (its start part
 *  is giacPrintStart.ts), so the unit view's two chunks that read it import that chunk by name. 69,894 B + 0.05 kB,
 *  rounded up to the next 0.01 kB.
 *  69.95 → 72.55 kB (R313): phase-1 145a2b0e measures 69,559 B, the branch 72,496 B (open 28,026 → 29,312, slot 10,379 →
 *  12,030): letters typed on a hardware keyboard into a slot read as a unit (slot.ts readSymbol, isLetters and the slot's
 *  letter run, with the catalogue's names; typed.ts, the view's typing keys and `^2`; view.ts, the run's glue). 72,496 B +
 *  0.05 kB, rounded up to the next 0.01 kB.
 *  72.55 → 76.05 kB (G233): phase-1 0d8a7e48 measures 72,465 B, the branch 76,000 B (calc 429 → 3,191 with userUnits.ts,
 *  slot 12,004 → 12,671 with the units.own.* words in the i18n table and exactFactor exported, factors 16,900 → 16,975 with
 *  build.ts's slotDim, slotFactor and rulesById exported; fix round 1, +31 B: OWN_PREFIX in factors.ts and build.ts's cycle
 *  check skipping own ids): a unit of your own built from Find's units. 76,000 B + 0.05 kB, rounded up to the next 0.01 kB.
 *  76.05 → 78.30 kB (G234): phase-1 165ad133 measures 76.00 kB, the branch 78.24 kB (+2.24 kB; the entries 41.66 → 41.96
 *  kB, under their 42 kB): the stored units, ownRecord.ts (the record's shape check, which a restore runs too, in a shared
 *  chunk of its own, 1.8 kB with decimal() and goodName() moved out of userUnits.ts), the store ownUnits.ts that
 *  calc.ts reads, the refusal of a unit with no definition (build.ts, messages.ts) and its words. A cut was tried: the
 *  store as a rune class cost +0.1 kB more; findClash and ownUnitItem are not in these chunks. 78.24 kB + 0.05 kB, rounded
 *  up to the next 0.01 kB.
 *  78.30 → 78.55 kB (G234 fix round 2): the branch measured 78.27 kB, 78.48 kB with the fix (+0.21 kB: a unit slot that
 *  holds a deleted own unit draws and reads its name without OWN_PREFIX, slot.ts; replace refuses a taken name and the
 *  start reads the first definition of a name, ownUnits.ts and ownRecord.ts). Cuts tried: a method in the slot model
 *  instead of a function, +0.04 kB; one `free` check for add and replace, nothing. 78.48 kB + 0.05 kB.
 *  78.55 → 78.80 kB (R801): phase-1 measures 78.48 kB, the branch 78,743 B (+0.26 kB: open.ts's tap handler and slotAt, which
 *  reads MathLive's prompt boxes under the point and gives the focus back to the view; view.ts's goTo, sharing #move's
 *  draw and read). 78,743 B + 0.05 kB, rounded up to the next 0.01 kB.
 *  78.80 → 78.97 kB (R801 fix round 3): the branch measures 78.91 kB (+0.17 kB: slotAt finds a box's slot by the model,
 *  getOffsetFromPoint and getPromptRange, not by the order of the boxes, which a fraction draws bottom to top). Cut tried:
 *  one reduce over the ids instead of a loop, −0.03 kB. 78.91 kB + 0.05 kB.
 *  78.97 → 79.10 kB (R804f1): phase-1 71292ca4 measures 78.92 kB, the branch 79,046 B (+0.13 kB, all in the Find chunk that
 *  holds the store sheet, 15.84 → 15.96 kB): the typed-name line asks the parser's own rule (storeRefusal) before it says
 *  a name is free, and words the refusal with the parser's table (parseText). 79,046 B + 0.05 kB, rounded up to the next
 *  0.01 kB.
 *  79.10 → 79.57 kB (R853): phase-1 3c5f2ac5 measures 79.08 kB, the branch 79.52 kB (+0.44 kB, all in the unit view's
 *  entry: the panel's ← and → buttons with their state and names, view.ts's step and four i18n strings). Cut made: the
 *  press gives the focus back through open.ts's tap handler, not its own call, −0.03 kB. 79.52 kB + 0.05 kB.
 *  79.57 → 79.64 kB (G782f1): the branch's base 3d6a5b97 measures 79.53 kB, the branch 79.59 kB (+0.06 kB: view.ts starts a
 *  ratio chip's slot with its ratio unit, chipUnit.ts chipSlot; storeChip stores its pure number, ratioChip.ts pureChip).
 *  Cuts made: storeChip returns pureChip(chip) for every chip (any other comes back as it is), chipSlot takes the slot
 *  ratioSlotPower checked, not a second validSlot copy, −0.02 kB. 79.59 kB + 0.05 kB.
 *  79.64 → 80.28 kB (R838): phase-1 c1eca577 measures 79,562 B, the branch 80,168 B (+606 B, all in open: 30,314 → 30,920 B):
 *  Settings and Mode open over the view, which watches the sheet close (padView watchSheet) to take the focus back and draw a
 *  changed setting again with no request (view.ts redraw, 177 B) or recompute after an angle change. Cuts made: the watcher
 *  sees only the close, the angle is read with the result, the redraw keeps its state in a tuple, −182 B. Merged with phase-1
 *  0f5ce229 (G782f1) the branch measures 80,228 B; 80,228 B + 0.05 kB, rounded up to the next 0.01 kB.
 *  80.28 → 80.59 kB (R862): phase-1 ebef0cb2 measures 80,222 B, the branch 80,535 B (+313 B: open 30,974 → 31,125 B, ☰'s case in
 *  the view's key handler and the Tools rows' builder shared with Find on units; find 9,373 → 9,535 B, showUnitMenu and
 *  menu.ts's unitViewMenu, the one list of Tools and Constants both menus show). 80,535 B + 0.05 kB, rounded up to the next 0.01 kB.
 *  80.59 → 80.91 kB (R915): phase-1 109317e5 80,535 B, the branch 80,860 B (+325 B, open: the angle and digits watcher, the row's angle tag, Store's row-gone note); + 0.05 kB. 80.91 → 81.20 kB (R917): phase-1 27453760 80,822 B, the branch 81,146 B (+324 B, open: one visit ended in one close, the lent line given back, the focus on the line, the reopen through lazy); + 0.05 kB, rounded up. 81.20 → 81.79 kB (R918): phase-1 ef5141f9 81.15 kB, the branch 81.73 kB (+0.58 kB, open: a tap on the screen outside the view's box is the dead press with its short list, a hold's click swallowed with no pulse, the lent line's row writes refused, a pick from the load dropped); + 0.05 kB, rounded up. 81.79 → 82.00 kB (R929): phase-1 d2e9cd25 81.77 kB, the branch 81.95 kB (+0.18 kB, open 42.16 → 42.34 kB: a constant's own unit drawn after its chip in the field, unitFormula.ts constLabels, view.ts fieldLatex, open.ts constUnit); + 0.05 kB. 82.00 → 82.18 kB (R885): phase-1 ad4f5b2d 81.96 kB, the branch 82,130 B (+0.17 kB, open 42.34 → 42.51 kB: the second line's σ at 2 significant digits in the format's form, units/result.ts sigmaText through render/sigmaForm.ts sigmaAlone); + 0.05 kB. 82.18 → 82.35 kB (R885 fix round 2): round 1 82,130 B, round 2 82.29 kB (+0.16 kB, open 42.51 → 42.67 kB: the view's headline drawn through sigmaDrawn as Home's row, cut at σ's last digit; sigmaAlone's E form for a σ above the units place; a compact headline split measured 42.74 → 42.67 kB); + 0.05 kB, rounded up. 82.35 → 82.86 kB (G385): phase-1 c2bd9d52 82.32 kB (entries 42.70), the branch 82.81 kB (+0.49 kB, build 0.73 kB more: each bracketed T1 − T2 a group, tempDifference's walk over the brackets and the call for brackets; entries 42.70 → 42.48 kB, the refusals without a value one case in messages.ts); + 0.05 kB. */
export const UNIT_VIEW_PIN_RAW = 82_860;

/** The budgets of docs/04 section 8.3 that apply to files of the build; the device bars are not here. */
function subjects(manifest: Record<string, ManifestChunk>, all: string[], modules: Record<string, string[]> | null): { present: Subject[]; absent: string[]; missing: string[] } {
  const chunks = Object.values(manifest);
  const present: Subject[] = [];
  const absent: string[] = [];
  const missing: string[] = [];
  const add = (rule: string, files: string[], limits: Omit<Subject, "rule" | "files">, required = false): void => {
    if (files.length > 0) present.push({ rule, files, ...limits });
    else (required ? missing : absent).push(rule);
  };
  const dynamic = (prefix: string): string[] => chunks.filter((c) => c.isDynamicEntry && normalSrc(c.src).startsWith(prefix)).map((c) => c.file);

  add("Start chunk", startFiles(manifest), { rawMax: 180 * KB, gzipMax: 63 * KB });
  add("MathLive chunk", chunks.filter((c) => /(^|\/)mathlive\/mathlive\.min\.m?js$/.test(normalSrc(c.src))).map((c) => c.file), { rawMax: 830 * KB });
  // The chunk that holds src/find/finder.ts, whether it is a dynamic entry (src in the manifest) or a shared chunk
  // (units/find.ts and units/menu.ts import it statically, so Rollup names it "finder" and the manifest has no src).
  // Required: a build without it is a failure, not "not built yet" (the rule once matched nothing for weeks).
  add("Find UI chunk", [...new Set(chunks.filter((c) => normalSrc(c.src) === "src/find/finder.ts" || c.name === "finder").map((c) => c.file))], { rawMax: 30 * KB }, true);
  // The unit view (G16, R24c): one rule over src/units/, so it covers the UI chunk (units/open.ts, 23.33 kB raw) and the
  // builder that Calc.units() loads with the factor table on its first call (units/calc.ts, 9.72 kB): 34 kB (Opus pass 22);
  // 38 kB (Opus pass 24): G81's correlated constants measure 34.04 kB, and R24d and R60–R63 still add; the bar that counts
  // is the first unit result < 1 s on the Tab One (decisions.md, Units: G81, R24b and R24c). 39 kB (R313; docs/04 8.3):
  // phase-1 145a2b0e measures 37.64 kB, the branch 38.92 kB: the hardware keyboard's letters in a slot (typed.ts and the
  // view's glue in open's chunk, +1.28 kB; the slot's own part is in the shared row below). Why a raise: the night
  // report of 2026-11-14 says "the next unit package must raise the pin or cut". The owner kept the raise (2026-11-14):
  // no split of the typing code, which is +1.28 kB in a lazy chunk, outside the start chunk. 42 kB (G233): phase-1
  // 0d8a7e48 measures 38.92 kB, the branch 41.66 kB: a unit of your own as a row of the factor table (units/userUnits.ts
  // mergedTable in the builder's chunk, +2.74 kB: the exact factor of its `of` and the checks a stored definition needs;
  // validateDef, findNames and factorText are not in it). A cut was tried: nothing of it can wait for a later chunk, since
  // the builder reads every own unit of a request. 42.6 kB (R918): phase-1 ef5141f9 41.95 kB, the branch 42.54 kB (open: a tap outside the view's box is the dead press, the lent line refuses a row). 42.7 kB (R885 fix round 2): the branch's round 1 42.51 kB, round 2 42.67 kB (open: the view's headline drawn by Home's row's σ rule, render/sigmaForm.ts sigmaDrawn, and σ's E form above the units place).
  add("Unit view chunk", dynamic("src/units/"), { rawMax: 42.7 * KB });
  // G163: Rollup hoists the units modules that two lazy chunks import (factors.ts with the builder, slot.ts, the cells'
  // store) into shared chunks, which the row above does not see (as finder.ts once was for Find). This row is the unit
  // view's whole code: its entries plus every shared chunk that holds a src/units/ module. Its bar is a pin at today's
  // measure, not the 39 kB (decisions.md R24b and R24c: G163, Opus pass 62); a package that grows the unit code raises it with a reason.
  const unitEntries = dynamic("src/units/");
  add("Unit view + shared", unitEntries.length > 0 ? [...unitEntries, ...sharedChunksHolding(manifest, modules, "src/units/")] : [], { rawMax: UNIT_VIEW_PIN_RAW });
  // The index and qalc have no fixed place yet (G4 and A2 decide); these match by location and name, so they apply wherever they land.
  add("Find index asset", all.filter((f) => f.startsWith("find/") || /(^|\/)find-index[^/]*$/.test(f)), { rawMax: 400 * KB, gzipMax: 100 * KB });
  add("qalc wasm + glue", all.filter((f) => /(^|\/)qalc[^/]*\.(wasm|mjs|js)$/.test(f)), { brotliMax: 1 * MB });
  present.push({ rule: "Precache total", files: all, rawMax: 18 * MB });
  return { present, absent, missing };
}

/** Views that only draw an open sheet stay out of the start chunk (R46): each must be its own dynamic chunk, not in `startFiles`. */
export const LAZY_VIEWS = ["src/views/Sheet.svelte"];

/** R91: code that only runs after a key press or once a result is in stays out of the start chunk too: the sheet's keys
 *  and the palette cells (loaded with the sheet's view), the result tidy-up, the palettes with their names. R70f1: how a
 *  key acts on the entry line's field, and the field's set-up (entry/field.ts, loaded with MathLive). R97: the update
 *  note's button and style (views/UpdateNote.svelte), which show only when an update waits. R103: the stored data's
 *  migration steps (state/migrations.ts, with the angle rewrite), loaded only for a record that has a step to run. R151:
 *  the sheet's model (views/sheet.svelte.ts), loaded with the sheet's view or by the first sheet that opens before it. A66f1: the key click's code (input/click.ts), loaded only
 *  when the Key click setting is on. R264: the stored rows' reader (state/storedItem.ts), loaded beside the history's start
 *  read, and engine/giacPrint.ts, a shared lazy chunk (the start reads its part engine/giacPrintStart.ts). R276: a history
 *  row's swipe and hold (views/rowGesturesCode.ts: rowSwipe.ts, apps/longpress.ts), fetched when idle (views/rowGestures.ts).
 *  R320: the press counters (state/taps.svelte.ts with state/pressCount.ts), fetched when idle behind the session's front
 *  (state/tapsFront.svelte.ts); and S58's five, of which three sit inside another lazy chunk (lazyFailures reads
 *  chunk-modules.json): views/statSheet.ts, views/helpSheet.ts, views/matrixGrid.svelte.ts (the matrix sheet's chunk),
 *  entry/cursorFn.ts (helpSheet's), engine/decimalLatex.ts (solve's). R362 (S58 cuts 1 and 4): the shell's app-opening part
 *  (apps/shellOpen.ts) with the view tabs' icons (views/icons.ts), loaded by the first app key. R782 (S58 cut 3 and the bar's
 *  left side): Android back's layers (input/backLayer.ts, behind input/backLayerFront.ts, loaded when idle); the bay's view
 *  icons (views/AppViews.svelte, drawn only in an open app, so it rides in the shell's app-opening chunk); the stored log's
 *  load check (engine/defsCheck.ts, split from defs.ts: the engine reads the stored log in parallel with the store, the
 *  start chunk keeps only the log's own functions). R791 (fix round 1): the renderer's macro table (render/macros.ts with
 *  entry/macroTable.ts), loaded with MathLive (render/mathlive.svelte.ts). R930: a job's call and result (state/jobRun.ts, with the
 *  item chunk), the field's set-up (entry/fieldUp.ts, with MathLive), the Apps and ☰ rows (apps/shellSheets.ts, with the sheet's
 *  model) and the port's pass of a result (calc/portKeys.ts, with the word store).
 *  G792: Fmt's cycle and FIX setters (state/modeSets.ts). */
export const LAZY_PARTS = ["src/views/sheetKeys.ts", "src/views/tmplSheet.ts", "src/render/tidy.ts", "src/keyboard/shiftPalettes.ts", "src/units/open.ts", "src/entry/field.ts", "src/state/handOver.ts", "src/views/UpdateNote.svelte", "src/views/tipsHost.ts", "src/state/migrations.ts", "src/keyboard/keyNames.ts", "src/views/sheet.svelte.ts", "src/input/click.ts", "src/state/resultItem.ts", "src/state/storedItem.ts", "src/engine/giacPrint.ts", "src/views/rowGesturesCode.ts", "src/apps/longpress.ts", "src/state/taps.svelte.ts", "src/state/pressCount.ts", "src/views/statSheet.ts", "src/views/helpSheet.ts", "src/views/matrixGrid.svelte.ts", "src/entry/cursorFn.ts", "src/engine/decimalLatex.ts", "src/apps/shellOpen.ts", "src/views/icons.ts", "src/input/backLayer.ts", "src/views/AppViews.svelte", "src/engine/defsCheck.ts", "src/engine/rational.ts", "src/engine/readFacts.ts", "src/render/longInsert.ts", "src/render/macros.ts", "src/entry/macroTable.ts", "src/state/jobRun.ts", "src/entry/fieldUp.ts", "src/apps/shellSheets.ts", "src/calc/portKeys.ts", "src/state/modeSets.ts"];

/** R91's pin: the start chunk is at most this many bytes gzip, under the budget of 63 kB (the pin kept its value when the
 *  budget was raised from 61 kB, 2026-11-09). A package that needs more raises the pin with a reason, here and in docs/04 8.3.
 *  60.97 → 58.96 kB (R70f1, Opus pass 23): phase-1 60.96 kB gzip (172.46 kB raw), the branch 58.95 kB (166.61 kB raw;
 *  −2.01 kB): the entry line's work on the field (its set-up and listeners, ⌫ and Del at a template, ᴇ, 10ˣ, a power's
 *  base, the stops) runs only once MathLive is up, so it is entry/field.ts, loaded beside MathLive; keys pressed before
 *  it is there are queued as before. The room is for R24d, R38a, R71, R15c4 and R88 under the 61 kB budget.
 *  58.96 → 58.97 kB (G81): phase-1 58.95 kB, the branch 58.963 kB (166.66 kB raw, +0.05 kB): a stored constant chip keeps
 *  its basis and leaves (validChips, read back at start); their check is in basisOf, in the lazy chunks.
 *  58.97 → 59.05 kB (R24d, R24df1): phase-1 58.963 kB (G81), the branch 59.035 kB without G81 (59,035 B, rounded up to the next 0.01 kB; 166.82 kB raw); the sum is 59.05 kB. Four lines of start-chunk source
 *  changed (`Sheet.right()` runs a row's second job); the rest is the start chunk's own map of lazy chunks: the cells' store,
 *  Find in a slot and the units menu are three new lazy files (units/userCells.svelte.ts, find.ts, menu.ts), each named in the
 *  preload list of the dynamic imports that reach it.
 *  59.05 → 59.11 kB (R24df2, Opus pass 26): the branch merged with phase-1 3718a40 (G81) measures 59.06 kB gzip (59,059 B,
 *  166.87 kB raw), 0.01 kB over the pin; the new pin is that rounded up to the next 0.01 kB (59.06) plus 0.05 kB for build
 *  noise and merges in flight (decisions.md, Start chunk). Under the budget of 61 kB.
 *  59.11 → 59.21 kB (R61): phase-1 dc0f77e measures 59.10 kB gzip (166.97 kB raw), the branch merged with it 59.16 kB
 *  (167.12 kB raw, +0.06 kB): a stored result chip keeps its unit and σ (validChips, read back at start: the unit kept
 *  as stored, a value with σ never exact) and a σ chip passes its σ to Home (chipFactsOf); the unit's check (chipUnit)
 *  is in input/chipUnit.ts, off the start chunk (it alone measured +0.21 kB there). The pin is 59.16 + 0.05 kB.
 *  59.21 → 59.30 kB (R71): the branch merged with phase-1 2ddd358 measures 59.24 kB gzip (59,243 B, 167.37 kB raw): Shift + `,`
 *  is the ± key (a keyboard.yaml layer, its dimming rule in keyboard.ts and route.ts, one legend). The pin is 59.25 + 0.05 kB.
 *  59.30 → 59.38 kB (R93): phase-1 3499958 measures 59.25 kB gzip (167.40 kB raw), the branch 59.33 kB (167.60 kB raw,
 *  +0.08 kB): the store's read tells a value, nothing stored and a failed read apart (kvGet), and idbKv drops the writes
 *  of a key whose read failed, so a transient fault never lets defaults replace the user's record; it is read at start,
 *  so it cannot load later. The pin is 59.33 + 0.05 kB.
 *  59.38 → 59.47 kB (R94): phase-1 2fcb7bc measures 59.33 kB gzip (167.60 kB raw), the branch 59.42 kB (167.85 kB raw,
 *  +0.09 kB): a settings record from a newer schema is read and never written back, with a one-time note through i18n
 *  (owner, vg-8); it is the start's own read of the settings, so it cannot load later. The pin is 59.42 + 0.05 kB.
 *  59.47 → 59.81 kB (R95): phase-1 1032dfb measures 59.42 kB gzip (167.85 kB raw), the branch 59.76 kB (168.70 kB raw,
 *  +0.34 kB): one writer per browser profile (state/writer.ts): the Web Lock is asked for before the first store write
 *  and every write asks its answer, so it cannot load later; the note, its words and the hand-over are a lazy chunk
 *  (state/handOver.ts). The pin is 59.76 + 0.05 kB.
 *  59.81 → 59.87 kB (R99): phase-1 d578f5b measures 59.80 kB gzip (168.85 kB raw), the branch merged with it 59.82 kB
 *  (168.87 kB raw, +0.02 kB): `{,}` before a digit starts a number in the tokenizer (Home's parser) and the apps' host
 *  gets `notice` (AppHost, shell.svelte.ts); the words of the refusal are a lazy table (i18n/enNum.ts, loaded with
 *  Solve and Function; in en.ts they measured 59.84 kB). The pin is 59.82 + 0.05 kB.
 *  59.87 → 60.00 kB (R100): phase-1 8f294fc measures 59.81 kB gzip (168.87 kB raw), the branch 59.95 kB (169.12 kB raw,
 *  +0.14 kB): in comma mode a history row's input is drawn, and recalled, with `;` for its argument commas (owner,
 *  2026-10-31): the rewrite (entry/commaInput.ts), Session.input and History's input prop are on the start's own drawing
 *  of the stored history, so they cannot load later. The pin is 59.95 + 0.05 kB.
 *  60.00 → 60.25 kB (R97): phase-1 1deea7f measures 59.95 kB gzip (169.12 kB raw), the branch 60.20 kB (169.78 kB raw,
 *  +0.25 kB): App.svelte's status line is a component (views/StatusLine.svelte: the compiled component wrapper, its
 *  props read through $$props, the dynamic child) and the lazy loaders are a module (appLoaders.ts); the update note's
 *  button and style went out (views/UpdateNote.svelte, a lazy chunk) but do not pay for that. The pin is 60.20 + 0.05 kB.
 *  60.25 → 60.36 kB (R102): the branch measures 60.31 kB gzip (170.08 kB raw), +0.06 kB over the old pin: the busy
 *  state's visually hidden `role="status"` line in StatusLine.svelte (markup and its few CSS rules; a screen reader
 *  hears the job) and `error.ansTooLong`, the Ans error's text moved from session.svelte.ts into the table. Both are on
 *  the start's own path (the status line is drawn at start; Session.submit runs before any lazy chunk), so neither can
 *  load later. The pin is 60.31 + 0.05 kB.
 *  60.36 → 60.59 kB (R63): phase-1 355153b measures 60.34 kB gzip (170.29 kB raw), the branch 60.54 kB (170.89 kB raw,
 *  +0.20 kB): a unit-view result is a Home row, so the start's own drawing of the stored history draws its number with
 *  ± σ and the unit set apart (Session.display), its request with its units (History's drawnInput) and "unit dropped"
 *  under a row computed from its chip (the flag at Enter, one line in History, its words in en.ts), and its chip is the
 *  stored one checked by validChips (Session.chipFor, also Ans at Enter). The row's builder, its slots' check and the
 *  units key's prefill are in the unit view's chunk; it imports the session as types only (a value import of
 *  session.svelte.ts from that chunk made Rolldown split shared modules out of the start chunk: 61.36 kB). The pin is
 *  60.54 + 0.05 kB.
 *  60.59 → 60.94 kB (R15c4): phase-1 6747238 measures 60.58 kB gzip (171.04 kB raw), the branch 60.89 kB (171.52 kB raw,
 *  +0.31 kB): the first-start tips' decision (state/tips.ts: the flag read at start and the `tips=off` check), the
 *  lazy import of the overlay with its preload entries, and the Settings row's callback in App.svelte. The overlay
 *  (views/tipsHost.ts, tips.css, i18n/enTips.ts) is a lazy chunk in plain DOM, so none of Svelte's runtime goes into
 *  the start chunk for it (a component did: +0.47 kB). The pin is 60.89 + 0.05 kB.
 *  60.94 → 60.99 kB (R55): the branch measures 60.97 kB gzip (171.69 kB raw): the digit-group function (render/home.ts
 *  groupDigits, one regex) and the `grouped` flag from the History row through session.display and renderNumeric. The
 *  pin is 60.97 + 0.02 kB, the most that keeps it under the 61.00 kB budget with room for the test below.
 *  60.99 → 58.44 kB (R103): phase-1 d075b9c measures 60.97 kB gzip (171.69 kB raw), the branch 58.39 kB (165.75 kB raw,
 *  −2.58 kB): the stored data's migration steps load only for a record that has one to run (state/migrations.ts, with
 *  engine/angleMigration.ts), the session reads PASDEG from engine/pasdeg.ts, and the start reads Home's defaults from
 *  engine/homeDefaults.ts, so engine/homeEval.ts's graph (engine/angles.ts, engine/flags.ts, icdf.ts, stores.ts), which
 *  the entry held for the lazy chunks, left the start chunk. The pin is 58.39 + 0.05 kB.
 *  58.44 → 58.49 kB (R89): phase-1 ea6112b's start files measure 58,389 B gzip (165,819 B raw), the branch 58,444 B
 *  (166,009 B raw, +55 B): the presets' name prompt, the part that must be at start: AppShell.prompt (a reactive field
 *  the entry label reads), route.ts handing it each key first, the history row's tap ending it, and shell and entry
 *  passed to Settings. Its watch for a tap elsewhere (a sheet, an app, a view) is in the Mode chunk
 *  (views/presetsView.svelte.ts), not a setter on AppShell.sheet (−20 B). The pin was 58.44 + 0.05 kB.
 *  R33 (names marked on the entry line): +20 B for EntryController.setNames and the lazy import of
 *  entry/namemarks.ts (the observer, the paint and the name test are in that lazy chunk); the pin is 58.51 + 0.05 kB.
 *  R36 (a picked row says why): ~+10 B for the line's element and its style in App.svelte; the words and the reasons are
 *  in the clipboard chunk (clipboard/whyLine.ts, strings.ts). R36f1 measured it after merging phase-1: phase-1 0dd6086's
 *  start files are 58,507 B gzip (166,290 B raw), the branch 58,568 B (166,509 B raw, +61 B): the line's element and
 *  style in App.svelte and the stored-facts check's `rounded` key (engine/types.ts); no clipboard source is in the start
 *  chunk (tools/probes/start-chunk.mjs). The pin is 58,568 B + 0.05 kB.
 *  R98 (Clear spares a running job; Undo of Clear and Delete): phase-1 fb75a497 is 58.56 kB gzip (166.51 kB raw), the
 *  branch 59,019 B (167,878 B raw, +0.46 kB): the note row in History.svelte with its two strings, the Undo key's test
 *  in route.ts, and the session's glue (the copy's field, Clear and Delete waiting for the code, Undo, the stored copy's
 *  read and write). The copy's code is its own lazy chunk (state/removedRows.ts, 0.51 kB gzip, fetched when idle). With
 *  it Rolldown puts engine/giacPrint.ts in a chunk of its own beside the entry (its gzip is counted here); a static
 *  import measured 59.33 kB. The pin is 59,019 B + 0.05 kB.
 *  R98 fix round 2 (audit points 2, 3): 59,108 B (168,152 B raw, +89 B on 92a419e7): Clear and Delete pick their rows by
 *  id at the press and resolve false with a note ("history.notRemoved") when the Undo code does not load. The pin is
 *  59,108 B + 0.05 kB.
 *  59.16 → 59.24 kB (R96f1): phase-1 a461f046 measures 59,108 B gzip (168,152 B raw); the branch merged with it 59,185 B
 *  (168,255 B raw, +77 B): R96's store health in storage.ts (a set of the keys whose last write did not land, and kvPut
 *  settling on abort; the line itself is in the Mode sheet's chunk). R96 before its fix measured 59,167 B. The pin is
 *  59,185 B + 0.05 kB.
 *  59.24 → 59.31 kB (R115f1): phase-1 c28862a6 measures 59,235 B gzip (168,431 B raw); the branch merged with it 59,255 B
 *  (168,471 B raw, +20 B): R115's chip key in units mode, one result chip used twice is one σ input. The parser writes a
 *  σ chip as pasupm with the chip's name as third argument (input/parse.ts resultChip and the minus rule of negate,
 *  input/chip-giac.ts CHIP_ANS), and these lines stay in the start chunk with the parser's entry; the builder's check
 *  (units/build.ts uncertainValues, isChipName in engine/ourNames.ts) is in the unit view's chunk. The pin is
 *  59,255 B + 0.05 kB.
 *  59.31 → 59.38 kB (R121, R121f1): phase-1 424f3fae holds R115f1's 59,255 B gzip (168,471 B raw); the branch merged with
 *  it measures 59,330 B (168,704 B raw, +75 B): the Home row's line naming the stored values a unit result read as pure
 *  numbers, in History.svelte (the text is the row's, written by the lazy units/row.ts; no unit code is in the start
 *  chunk). The pin is 59,330 B + 0.05 kB.
 *  59.38 → 59.65 kB (R12b): phase-1 8637b0d3 measures 59,370 B gzip (168,784 B raw); the branch merged with it 59,600 B
 *  (169,363 B raw, +230 B), and merged with 534183c1 (G159, whose lazy unit chunk's hash moved the pin to 59,434 B)
 *  59,593 B (169,363 B raw): views/edgeFade.ts, the action that marks a history input or result scrolled past an edge so
 *  the row's CSS fades that edge (docs/05 3.5: never cut without a sign), on every row of the first screen. The tokens
 *  themselves are CSS, not counted here. The pin is 59,600 B + 0.05 kB.
 *  59.65 → 59.96 kB (R41): phase-1 d7a745d1 measures 59,600 B gzip (169,363 B raw); the branch 59,910 B (170,306 B raw, +310 B):
 *  the Keypad's effects that load the key names (keyboard/keyNamesLoader.svelte.ts) and name the buttons once they are in,
 *  and fit.ts's height pass (a face stays between its legend lines, a legend in its own, at a larger system font). The
 *  names and the code that sets them are keyboard/keyNames.ts, a chunk of its own (1.45 kB gzip, loaded when the browser
 *  is idle). The pin is 59,910 B + 0.05 kB.
 *  59.96 → 60.23 kB (R40, inside its 0.3 kB bar): phase-1 b94c8613 measures 59,910 B gzip (170,306 B raw); the branch
 *  60,183 B (171,077 B raw, +273 B): the Uncertainty setting (its default, read back), the σ fact read back
 *  (readValueFacts), the parts of the row that ask for σ (the mute hook, the tap that shows the line) and the hook that
 *  hears the tidy chunk load. The cut that mutes the digits (render/uncMute.ts) and the σ line (state/sigmaLine.ts) ride
 *  in the tidy chunk (render/tidy.ts), the R40 texts in i18n/enUnc.ts: a row is drawn unmuted until it is in. The pin
 *  is 60,183 B + 0.05 kB.
 *  60.23 → 60.56 kB (R124): phase-1 722a9b45 measures 60,208 B gzip (171,077 B raw); the branch 60,510 B (171,814 B raw,
 *  +302 B): the Marks setting (its default, read back), the row's reason line with its kept place and its tap, the
 *  history's style attribute. The line's words (clipboard/whyLine.ts with its strings) ride in the tidy chunk, the
 *  setting's row and texts in the Mode sheet's chunk (i18n/enUnc.ts). The pin is 60,510 B + 0.05 kB.
 *  60.56 → 60.67 kB (R125): phase-1 405b7271 measures 60,516 B gzip (171,814 B raw); the branch 60,616 B (172,095 B raw,
 *  +281 B): the digit-group separator (its field, default and reader, the separators' LaTeX, the rule that draws a
 *  comma under the decimal comma as the thin space) and the sheet's check of a disabled value button. The row and its
 *  texts ride in the Mode sheet's chunk, the unit view's separators in its own. The pin is 60,616 B + 0.05 kB.
 *  60.67 → 60.72 kB (R125f1): the branch 60,673 B (172,163 B raw, +57 B over that pin's measure): groupDigits' flag for the
 *  thin space's both sides, passed from part() (the apostrophe and the comma group only before the point). The pin is
 *  60,673 B + 0.05 kB.
 *  60.72 → 60.99 kB (R127): the branch measures 60,970 B (172.99 kB raw, +0.25 kB over the pin): the per-key press counts,
 *  which run on every press and so ride in the start chunk (TapCounts.keys and its stored reader, the key and layer a
 *  touch names in pressCount.ts, a hardware key's and a screen tap's name, the call sites in Keypad and App); the
 *  export, its file and its row ride in the Mode sheet's chunk.
 *  60.99 → 61.00 kB (R127 fix round 2): after the review fix (a held ⌫ keeps the repeat layer; the hardware kinds are named
 *  hw:<kind>) the branch measures 60,992 B (173,080 B raw), 2 B over the pin. The pin is now the budget of 61 kB itself, so
 *  nothing is left to grow: the next package that touches the start chunk must split something out first.
 *  R151 (owner, 2026-11-07: the 61 kB stays, this makes room under it): phase-1 f98453f5 measures 60,915 B gzip (172,082 B
 *  raw); the branch 59,441 B (167,625 B raw, -1,474 B): the sheet's model (views/sheet.svelte.ts) is a lazy part. The pin
 *  stays the budget, so about 1.5 kB is free for the next UI packages.
 *  R53: the merge base 05a1daf7 measures 61.00 kB gzip (171.91 kB raw); results mode's state, Esc and back in App.svelte
 *  and the lazy counter's hook (+1.19 kB gzip with the controls in, +0.59 kB with them in their own chunk,
 *  keyboard/Fold.svelte) are paid for by moving the apps' and the Mode sheet's texts out of en.ts (i18n/enNum.ts,
 *  i18n/enMode.ts): the first measure was 60.96 kB gzip (171.76 kB raw); after fix round 2 and the merge of phase-1 the
 *  branch measures 60.64 kB gzip (170.71 kB raw), under the pin of 60.65 kB.
 *  61,000 → 60,621 B (R155f2, no allowance, decisions.md Start chunk room): phase-1 e6cfc7cd measures 60,996 B gzip (171.91 kB
 *  raw), the branch merged with it 61,001 B (171,905 B raw, 1 B over the pin: the R155f1 field box and a chunk hash); the cut
 *  is 430 B gzip (−1,247 B raw) to 60,571 B (170,658 B raw): what a history item keeps of a result (factsFrom, homeItem,
 *  casItem; state/resultItem.ts) runs once the engine has answered, so it is a lazy chunk loaded beside the first job
 *  (state/itemLoad.ts) and the decimal code of engine/format.ts it reads left the start chunk. The pin is 60,571 B + 0.05 kB.
 *  60,621 → 60,650 B (A87, the move to the desktop; no code change): phase-1 1c6af195 measures 60,619 B gzip on the laptop
 *  and 60,623 B on win99, both 170,880 B raw (the entry's name differs, index-8z3XHpW_ and index-Bbpwr7Ub), so a pin 2 B
 *  over the measure failed on the difference between machines.
 *  60,650 → 60,720 B (A123): WorkerEngine.defsWritten and the write's promise kept beside the store call (the core runner's
 *  relaunch waits for the `defs` write; 22 B over the old pin, 60,672 B gzip, 170,829 B raw): 60,672 B + 0.05 kB.
 *  60,720 B stays (R148): the keypad's 4 px gap and padding in the trackpad's width formula and the short rows' query
 *  (Keypad.svelte) add 0.02 kB gzip (measured 60.67 kB, 170.78 kB raw, on the base before A123); the merge with A123 is
 *  measured by the gate against this pin.
 *  60,720 → 60,780 B (R148f2): the view keys' wait behind queued keys during a load (route.ts runsAtOnce) measures 60,729 B
 *  gzip (170,988 B raw, +9 B over the pin): 60,729 B + 0.05 kB.
 *  60,780 → 60,950 B (R164): the shared press flag (input/pressFlag.ts: R161's keypad code moved there, and a 4-line action
 *  for the status line's two buttons; the sheets' and the update note's use of it are lazy chunks) measures 60.89 kB gzip
 *  (171.40 kB raw), +0.13 kB over the phase-1 build (60.76 kB, 171.02 kB raw): 60.89 kB + 0.05 kB, rounded up.
 *  60,950 → 60,953 B (R149f2, Opus pass 118: the budget of 61 kB stays): R149's credits check (the line's N62 then Enter, the guard for a
 *  stored N) measured 61,011 B with the Array polyfills; the polyfills are out (src/polyfills.ts: the minimum WebView is Chrome 111, which has
 *  toSorted, toReversed, findLast and findLastIndex, and index.html's check stops older ones), and the branch merged with phase-1 5b9fcf7f
 *  measures 60,903 B gzip (171,148 B raw): 60,903 B + 0.05 kB.
 *  60,953 → 60,985 B (R157f1, the budget of 61 kB stays): R157's mark on Home's tile (the span its mask is drawn on) and on an empty
 *  history (the faint div and its tap, App's openCredits shared with N62 then Enter) measured 60,999 B gzip (171,442 B raw) on the branch merged
 *  with phase-1 ec58fc58; the home icon's markup is drawn only by the lazy Sheet.svelte (its title icon and row glyph), so it moved out of
 *  icons.ts (read at start) into that chunk, as the gear did (R145f1): 60,935 B gzip (171,361 B raw, -64 B). The path itself is the lazy
 *  public/n62-mark.svg, not in the chunk. The pin is 60,935 B + 0.05 kB.
 *  60,985 B stays (G225f1, decisions.md "Start chunk room": a cut, no allowance): the two refusal texts of enEngine.ts (the app's table
 *  holds them too) are shortened; the branch merged with phase-1 aa57eb81 measures 60,964 B gzip (171,402 B raw), inside this pin.
 *  60,985 → 61,100 B (R270, the budget of 63 kB stays): Home's line set aside while an app is open (AppShell.aside, setAside and its
 *  put-back in close; main.ts reads the kept line into it when an app was open at the last exit) measures 61,048 B gzip
 *  (172,275 B raw), +63 B over the phase-1 pin: 61,048 B + 0.05 kB, rounded up.
 *  61,100 → 61,200 B (R272): the call that hands a dropped history row to the lazy state/dropNote.ts (the words, the flag and the
 *  once-per-install rule are in that chunk; the start chunk holds the trim's call and the import) measures 61,131 B gzip
 *  (172,479 B raw), +82 B over phase-1 (61,049 B): 61,131 B + 0.05 kB, rounded up.
 *  61,200 → 61,300 B (G322, no app source changed): the chunk holds the engine worker's hashed file name, and that hash follows
 *  the engine build (vite.config.ts __GIAC_MJS__), so a branch with a new Giac patch moves the gzip size with the same raw size:
 *  phase-1 a7b802ec measures 172,709 B raw, 61,193 B gzip with phase-1's engine and 61,202 B gzip with G322's (patch 0043):
 *  61,202 B + 0.05 kB, rounded up.
 *  61,400 → 61,600 B (R284, R284f1): the engine-failed note's way on is in the start chunk and its words and look are not: the
 *  kind of the failure (Session.engineFailure, from the error's class), the guard in submit, the Reload button (its markup, its
 *  `engine.reload` string, one rule; it must not depend on a chunk fetched over a network that may be down), and the idle import
 *  of the lazy views/EngineFailed.svelte (the effect, its state, the preload entry); the words (i18n/enFail.ts) and the button's
 *  look stay in the lazy chunk. phase-1 43cb1a7d (G174 and R285) is 61,303 B gzip (172,954 B raw) at its last pin measure; the
 *  branch merged with it measures 61,537 B gzip (173,844 B raw): 61,537 B + 0.05 kB, rounded up to the next 50 B.
 *  61,600 → 60,790 B (R264, a cut that buys room for the queue): phase-1 eaff256f measures 61,535 B gzip (173,894 B raw), the
 *  branch 60,733 B (171,507 B raw, −802 B): the part of engine/giacPrint.ts the start reads (the string skip, the walk, the
 *  name pattern, balanced, isName, names, mapNames, RATIONAL) is engine/giacPrintStart.ts, and the rest, which the lazy
 *  chunks' imports kept in the entry, is a shared lazy chunk (−514 B); the stored rows' reader (state/storedItem.ts) loads
 *  beside the history's start read (state/storedLoad.ts, −288 B). 60,733 B + 0.05 kB, rounded up to the next 0.01 kB.
 *  60,790 → 60,850 B (G327): phase-1 424c410b measures 60,766 B gzip (171,731 B raw), the branch 60,794 B (171,806 B raw,
 *  +28 B; bbbb4c8b's G227 changes no start-chunk file): a load failure never counts against the stored definitions, so
 *  the client keeps G19's stored count (workerEngine.ts logFails) beside G318's count of every failed start (attempts),
 *  two numbers one cannot hold, and the gate counts no replay once two starts failed before the store answered.
 *  60,794 B + 0.05 kB, rounded up to the next 0.01 kB.
 *  60,850 → 60,980 B (R260): a stored name is shown as typed (render/home.ts typedName: β for beta_, e for e_; the Greek
 *  names in Unicode's order, so one table gives both the LaTeX and the letter), in the history's uses line; and the letter
 *  stand-ins e_, i_ as user functions (parse.ts, latex-to-giac.ts). phase-1 3b8ab8e7 measures 60,843 B gzip (171,945 B raw),
 *  the branch merged with it 60,922 B (172,108 B raw, +79 B): 60,922 B + 0.05 kB, rounded up to the next 0.01 kB.
 *  60,980 → 61,210 B (R276): a history row's hold copies and its swipe deletes. Their code (views/rowSwipe.ts and
 *  apps/longpress.ts, +1.22 kB gzip in the start chunk) is a lazy chunk fetched when idle (views/rowGesturesCode.ts); what
 *  stays is the loader (views/rowGestures.ts), the row's touch-action and App's delete on a swipe. phase-1 f2e29dd6
 *  measures 60.92 kB gzip (172.11 kB raw), the branch 61,155 B (172,810 B raw, +0.23 kB): 61,155 B + 0.05 kB, rounded up
 *  to the next 0.01 kB.
 *  61,210 → 61,400 B (R279): Select and Deselect. The chain itself (entry/grow.ts, SelectChain) rides in the field's lazy
 *  chunk; what stays is the two specials' names, their case in route.ts special(), the guards that keep them off a picked row
 *  and a sheet, the end of the chain on any other key (route.ts run, EntryController.run) and the controller's two
 *  one-line methods. The merge base 5bfdb4c1 measures 61.18 kB gzip (172.85 kB raw), the branch 61.34 kB (173.25 kB raw,
 *  +0.16 kB; 61.44 kB before the step code moved into the lazy chunk; 61.35 kB after merging phase-1 31b97787): 61.35 kB
 *  + 0.05 kB.
 *  61,460 → 61,700 B (R281): the store sheet. Its model, view, words and key reading ride in lazy chunks (views/storeSheet.svelte.ts
 *  in Vars' chunk, SheetCells.svelte with the sheet's view, sheetKeys.ts storeKey, i18n/enStore.ts); what stays is Store ▶
 *  opening it (route.ts run, App.svelte openStore and the row actions' `stored`), the sheet's disarm on a key, the store
 *  sheet's case in sheetPress (a key that types no name goes on to the line, ⌫ on an empty name) and the keypad drawing no
 *  key dead under it. The merge base 8214eddf measures 61.40 kB gzip (173.25 kB raw), the branch 61.65 kB (174.03 kB raw;
 *  much of it the minifier's longer names): 61.65 kB + 0.05 kB.
 *  61,700 → 61,810 B (R197): the Help key. Its sheet, its words, the cursor's offset (entry/cursorAt.ts) and R196's scan
 *  ride in a chunk of their own, loaded from Find's (views/helpSheet.ts; the scan takes the parser's tables and the box
 *  model's infix words from the chunks that hold them, so no chunk splits off and no preload list grows); what stays is
 *  the key's route (route.ts `help`, App.svelte openHelp and findNow, shared with openFind) and `help` in the keyboard's
 *  lists. The merge base d66f7f94 measures 61.69 kB gzip (174.15 kB raw), the branch 61.76 kB (174.36 kB raw):
 *  61.76 kB + 0.05 kB.
 *  61,810 → 61,900 B (R185): Shift + 5's growing matrix. The growth (entry/matgrow.ts) rides with MathLive; what stays is
 *  the key itself in spec/keyboard.yaml (alone 61.81 kB, the pin's edge), the Keypad marking a drag step's action
 *  (`drag`, so a drag never grows the matrix) and the entry holding the field chunk's `Grown` (made with the field,
 *  passed to runOnField, cleared when a line is set). The merge base 68e296cf measures 61.77 kB gzip (174.36 kB raw), the
 *  branch 61.85 kB (174.55 kB raw): 61.85 kB + 0.05 kB.
 *  61,970 → 62,040 B (R224): the wide layout. Its look is CSS (App.svelte's `@media` block, outside the JS); what stays in
 *  the chunk is the condition (views/wide.ts), its matchMedia in App.svelte's onMount and `canFold` reading it (no results
 *  mode side by side). svelte/reactivity's MediaQuery cost 0.17 kB more, so a plain matchMedia. The merge base 4ee33b66
 *  measures 61.89 kB gzip (174.71 kB raw), the branch 61.99 kB (174.87 kB raw): 61.99 kB + 0.05 kB.
 *  62,040 → 62,110 B (R184): linreg's and stats1's labelled result sheet. What stays in the chunk is the test in insertResult
 *  (a regexp on the row's input and the call into the clipboard chunk, which loads views/statSheet.ts on demand); its rows,
 *  words and chips are lazy, and a second import() site in the start chunk cost 0.1 kB more. The merge base measures
 *  62.01 kB gzip (174.91 kB raw), the branch 62.06 kB (175.01 kB raw): 62.06 kB + 0.05 kB.
 *  62,110 → 62,180 B (R190): the start chunk got smaller (175,254 B raw on phase-1, 175,249 B on the branch: the matrix
 *  sheet's call takes the route's context, one argument in place of three); what moved is the gzip of its text, since the
 *  grid's and the sheet's lazy chunks carry new hashed names (62,110 B on phase-1, 62,123 B measured): 62,123 B + 0.05 kB.
 *  62,180 → 62,240 B (R298): an insert before the field waits in the entry's key queue (controller.ts `put`, its replay),
 *  and the store sheet's Enter waits for the field as a pressed Enter does (route.ts enterLine). The merge base 1f353875
 *  measures 62,114 B gzip (175,074 B raw), the branch 62,188 B (175,269 B raw): 62,188 B + 0.05 kB.
 *  62,240 → 62,300 B (R298 fix 2): Enter and the units key wait for the field whatever they first waited for (route.ts
 *  forLine, readsLine). The branch before it measures 62,208 B (175,292 B raw, phase-1 merged in), after it 62,244 B
 *  (175,348 B raw): 62,244 B + 0.05 kB.
 *  62,300 → 62,380 B (G355): a Home row's chip and Ans carry its σ (state/results.ts chipOf sets R61's `unc` from the
 *  row's uncSigma, and a row with σ never gives an exact chip). With phase-1 d3c84b9c merged in, the branch before it
 *  measures 62,301 B (175,648 B raw), after it 62,321 B (175,669 B raw): 62,321 B + 0.05 kB, rounded up to 0.01 kB.
 *  62,380 → 62,390 B (R302): a matrix cell's edit sets the user's line aside where a hide keeps it (apps/shell.svelte.ts
 *  `editAside`, read by main.ts's onClear and flush). Phase-1 d3c84b9c measures 62,297 B gzip (175,648 B raw), the branch
 *  62,306 B (175,685 B raw); with G355 merged in, 62,332 B (175,706 B raw): 62,332 B + 0.05 kB, rounded up.
 *  62,390 → 62,470 B (G234 fix round 1): units/open.ts imports the store of your units (ownUnits.ts, and with it ownRecord.ts)
 *  to add them to Find's items in the unit view, so the start chunk's list of the files the unit view loads holds two more
 *  names (no code of it is in the start chunk). The branch before the round measures 62.38 kB gzip (175.87 kB raw), after it
 *  62.41 kB (175.92 kB raw). Tried: the store read from find.ts and from calc.ts (the start chunk +0.03 and +0.04 kB, and the
 *  unit view's entries over their budget). 62.41 kB + 0.05 kB, rounded up to the next 0.01 kB.
 *  62,470 → 62,100 B (R320, a cut, S58's item 2): the press counters (state/taps.svelte.ts, state/pressCount.ts) are a lazy
 *  chunk fetched when idle; the start holds their front (state/tapsFront.svelte.ts: the queue, the screen-tap listener and
 *  the hardware keys' `counted`), and Keypad hands each touch over raw. phase-1 c6fe6992 measures 62,415 B gzip (175,965 B
 *  raw), the branch 62,049 B (174,622 B raw, −366 B): 62,049 B + 0.05 kB, rounded up to the next 0.01 kB.
 *  G216f1: no start-chunk code changed. Copy as Python and the unit view share input/unitFormula.ts,
 *  which vite.config.ts now puts in chipUnit.ts's chunk (no extra name in the preload lists, which had cost 31 B raw).
 *  The lazy chunks' new hashed names gzip differently: phase-1 fd0a9c24 measures 62,090 B gzip (174,728 B raw), the branch
 *  62,101 B (174,728 B raw); with R329 merged in, 62.13 kB (174.87 kB raw), inside R329's pin.
 *  62,100 → 62,190 B (R329): Shift + Vars is Paste, the key's legend and action in the shipped spec, `key.paste` in the
 *  i18n table and its case in route.ts (it reuses pasteText). Phase-1 fd0a9c24 measures 62.09 kB gzip (174.73 kB raw),
 *  the branch 62,140 B (174,872 B raw): 62,140 B + 0.05 kB, rounded up to the next 0.01 kB.
 *  62,190 → 62,500 B (R265): phase-1 c77461e0 measures 62,139 B gzip (174,888 B raw), the branch merged with it 62,445 B
 *  (175,881 B raw, +306 B gzip, +993 B raw): a history row typed in the other angle mode shows its DEG or RAD tag and, on
 *  a recall that changes nothing, a note (History.svelte, the history.angleNote string in en.ts), the recall's record
 *  (entry/controller.ts recalledIn, dropped by any edit; App.svelte reads it), readsAngle (set where the row's job is kept) and typedIn, the mode the row was typed in (session.svelte.ts, storedItem.ts reads it back); all of it is on the
 *  start's own drawing of the stored history. A cut was looked for: folding History's muted lines into one list saved raw
 *  bytes but cost gzip. Under the budget of 63 kB (decisions.md Start chunk room). 62,445 B + 0.05 kB, rounded up to
 *  the next 10 B.
 *  62,500 → 62,600 B (R327): Shift + 1 is the uncertainty sheet, a reserved cell filled: the key's legend and action in the
 *  shipped spec, "uncertainty" among the sheet keys, its case and the picked row's in route.ts. The sheet, its σ check and
 *  its import are in the sheet's chunk (tmplSheet.ts, as Base) and a chunk of their own; the units key's loader is shared
 *  (route.ts lazy). Phase-1 12fe787b measures 62.45 kB gzip (175.88 kB raw), the branch 62,544 B (176,133 B raw):
 *  62,544 B + 0.05 kB, rounded up to the next 10 B.
 *  62,600 → 62,790 B (R327f1): a Home row with σ is ⚠ when its "value ± σ" shows more digits than the value has confirmed
 *  (principle 3), so markFor counts that text's digits in start (state/sigmaDigits.ts, text only: the BigInt arithmetic of
 *  units/uncertainty.ts stays in the unit view's chunk, importing it cost 0.65 kB). Phase-1 b9bda425 measures 62,544 B
 *  gzip (176,133 B raw), the branch 62,735 B (176,700 B raw): 62,735 B + 0.05 kB, rounded up to the next 10 B.
 *  62,790 → 62,880 B (G371): a stored name keeps its value's unit, so the stored log's load check (validDefs, engine/defs.ts)
 *  reads `unit` back, and DATA_VERSION steps to 5 (storage.ts). validDefs runs when the stored log loads, before the first
 *  call, so it stays in start; a shorter form of the read cost gzip (62,828 B). Phase-1 d4bf19bf measures 62,786 B gzip
 *  (176,852 B raw), the branch 62,821 B (176,928 B raw): 62,821 B + 0.05 kB, rounded up to the next 10 B.
 *  62,880 → 62,940 B (G392f1): a stored name with a unit read shows "unit dropped" in its Home row (host.ts and nameSigma.ts
 *  carry the names, session.svelte.ts sets the flag, R63), all in start with the row's result path. Phase-1 b80c3d10 measures
 *  62,862 B gzip (176,988 B raw), the branch 62,882 B (177,051 B raw): 62,882 B + 0.05 kB, rounded up to the next 10 B.
 *  62,940 → 62,240 B (R362, a cut: S58's cuts 1 and 4, docs/research/start-chunk-cuts.md): the shell's app-opening part
 *  (apps/shellOpen.ts: the app's host, load, open, showView, setAside, toHome, the Menu's pointer row) loads with the first
 *  app key, and the view tabs' icons (views/icons.ts) with it. Phase-1 d9b130d8 measures 62,879 B gzip (177,051 B raw),
 *  the branch 62,186 B (175,370 B raw; −693 B): 62,186 B + 0.05 kB, rounded up to the next 10 B.
 *  62,240 → 62,300 B (G618 fix round 1): phase-1 8f1c84df measures 62,244 B gzip (175,530 B raw), past the pin by the
 *  merges since R362; the branch's start chunk is the same file, byte for byte (G618's words are in the worker's table
 *  and the unit view's chunk, i18n/sumWords.ts): 62,244 B + 0.05 kB, rounded up to the next 10 B.
 *  62,300 → 62,420 B (R700 fix round 1): the branch on phase-1 0d58866a measures 62,363 B gzip (175,872 B raw): the three Android
 *  back layers (App.svelte: the picked row, Shift or Alpha armed; units/open.ts: the unit view's, 12 lines) and the layer's
 *  release in Session; 62,363 B + 0.05 kB, rounded up to the next 10 B.
 *  62,420 → 62,970 B (R722, fix round 1): the bar on the keypad (views/StatusLine.svelte: the Home and CAS tabs with their
 *  tiles, the angle undo count, the guard that lets a control act only on a pointer that went down on it). Phase-1 e8c6fdd3
 *  measures 62,393 B gzip (175,989 B raw); the branch first measured 63,079 B, over the budget, so it was cut: the controls'
 *  `data-item` became static names (barItems.ts left the start chunk) and the guard one capture-phase click handler on the
 *  bar instead of a wrapped handler per control (−159 B). The branch 62,920 B (177,881 B raw): + 0.05 kB, rounded up.
 *  62,970 → 62,990 B (R723): the Copy key's routing in route.ts (Shift + Select: the `copy` special, its case and the picked
 *  row's branch; the rule itself is ClipActions.keyCopy, in the clipboard chunk). Phase-1 49652b92 measures 62,961 B gzip
 *  (178,051 B raw), the branch 62,978 B (178,097 B raw; it first measured 62,999 B, cut by moving the rule out). The usual
 *  + 0.05 kB would pass the 63.00 kB budget, so the pin keeps 10 B under it; the next start-chunk growth needs a split.
 *  62,990 → 63,000 B (R727, fix round 2): Shift + Select copies the line's selection first, and Copy keeps the Select chain
 *  (route.ts: `isSelect` takes the `copy` special, so the one test in `run` and the one in `historyKey` carry it; the
 *  rule itself is ClipActions.keyCopy, in the clipboard chunk). Phase-1 3ea24712 measures 62.98 kB gzip (177.77 kB raw), the
 *  branch 62,995 B (177.77 kB raw): the first build measured 63.05 kB, over the budget, cut by folding the Copy tests into
 *  `isSelect` and dropping the controller's getter. The pin is the budget itself: nothing is left under it.
 *  63,000 → 62,800 B (R791 fix round 1, a cut): the entry line's `\AA` macro (an upright Å) is in the macro table, and the
 *  table (entry/macroTable.ts, split from entry/macros.ts) with the renderer's options (render/macros.ts) now loads with
 *  MathLive (render/mathlive.svelte.ts); Math.svelte draws plain text until then, as before. The branch first measured
 *  63,019 B (177,128 B raw), over the budget; split, 62,742 B (176,235 B raw; −277 B): + 0.05 kB, rounded up to the next 10 B.
 *  62,800 → 62,920 B (R794 fix round 2): the round pad draws its four arrows itself, one inline SVG in Keypad.svelte's
 *  trackpad template (the zones keep their faces, hidden; the press dot's points are in keyNames.ts, out of start). Phase-1
 *  13bd8c47 measures 62,774 B gzip (176,318 B raw), the branch 62,869 B (176,479 B raw; +95 B, the SVG's markup alone):
 *  62,869 B + 0.05 kB, rounded up to the next 10 B.
 *  62,920 → 63,000 B (R703): under Android's font scale the WebView zooms every text after the CSS sizes, the sizes the fit
 *  writes too (F383): fitLegends reads the zoom off the body's 16 px, writes through it, and loads keyboard/zoomFit.ts (the
 *  second pass, the bar's fit and the ellipsis) only under a zoom. It first measured 63.88 kB with the bar's fit in
 *  StatusLine.svelte, then cut to the zoom read, the write and the import (62,998 B on phase-1 464bd957). R703f1: phase-1
 *  95028148 measures 62.91 kB gzip (62,914 B, 176,716 B raw, in a bare vite build), the branch 62,973 B (176,861 B raw, npm
 *  run build): cut from 63,017 B (bare) by loading zoomFit.ts as a plain dynamic import (no other chunk imports from it, so
 *  no namespace object is built at run time, −36 B) and the floor inline in the write (−16 B). The usual + 0.05 kB would pass
 *  the 63.00 kB budget (docs/04 8.3), so the pin is the budget itself, 27 B over the measure; the next start-chunk growth
 *  needs a split.
 *  R862 (a cut; the pin stays the budget): the unit view's ☰ adds no start-chunk source, but the lazy chunks' new hashed names in
 *  the entry's preload list took phase-1 ebef0cb2's 62,997 B gzip (176,865 B raw) to 63,004 B, over the budget. The update
 *  pill's words and the too-long-to-insert note left the start table (en.ts) for tables their lazy readers import
 *  (i18n/enUpdate.ts, i18n/enInsert.ts): 62,964 B (176,738 B raw). One table for both measured 62,980 B (its own chunk, one
 *  more name in the preload list).
 *  G399 (fix round 2, a cut; the pin stays the budget): Giac patch 0059 adds no app source, but its new engine hash took the start
 *  chunk to 63,001 B gzip (176,880 B raw). The Menu's "in view" row and the view tabs' group name left the start table (en.ts)
 *  for i18n/enShell.ts, which only the shell's app-opening chunk reads (apps/shellOpen.ts, views/AppViews.svelte): 62,976 B
 *  (176,822 B raw).
 *  G785 (a cut; the pin stays the budget): Fmt skips a step that draws what the row shows (deadPress asks Session.formRow).
 *  Phase-1 5c518933 measures 62,986 B gzip, the change 63,015 B; Memory's purge (Session.forget, read only by the lazy
 *  find/names.svelte.ts) moved there: 62,967 B (176,789 B raw). Lazy-only en.ts strings to lazy tables gave −1 B only.
 *  63,000 → 61,880 B (R930, a cut; the budget stays 63 kB, so a later package raises the pin with its reason): phase-1 b55cbb1a
 *  measures 62,996 B gzip (176,799 B raw), the branch 61,874 B (172,987 B raw; −1,122 B): code that ran only after a job, the
 *  field's load, a sheet's open or a key on an open sheet rides in the chunk that path already waited for (state/jobRun.ts −310 B,
 *  entry/fieldUp.ts −140 B, apps/shellSheets.ts −281 B, sheetKeys.ts sheetPress and sheetLetter −202 B, calc/portKeys.ts −189 B).
 *  G792 (fix round 1, a cut; the pin stays): patch 0066's engine hash took the chunk past the pin; Session.setFmtMode and
 *  setFixDecimals, which only the lazy Mode sheet calls, moved to state/modeSets.ts (−60 B gzip before the merge with R930).
 *  61,880 → 60,670 B (A272, the measure changed, not the code): gzip and brotli hold the hashed file names fixed (hashFree), so a new
 *  lazy-chunk, Find-index or engine hash no longer moves the pin (the hash-only notes above, G313f1, G341, G308, are in git log -L).
 *  Phase-1 5812dc91's start files: 61,798 B gzip real, 60,612 B held (172.71 kB raw). 60,612 B + 0.05 kB, rounded up to 10 B.
 *  60,670 → 60,680 B (R901, Settings and Mode keep the picked row; the budget stays): phase-1 a1b3b033 holds 60,666 B, the branch
 *  60,672 B (route.ts run lets settings and mode past historyKey as it lets fmt, +9 B; App.svelte drops two pick resets, −3 B).
 *  A check inside historyKey measured 60,675 B, a regex or three compares 60,674-60,675 B, openSettings folded into openMode
 *  60,675 B. Rounded up to 10 B.
 *  60,680 → 60,740 B (G795, FIX's SCI fallback for an integer part past its confirmed digits, a fix in engine/format.ts): phase-1
 *  8fa7bc3d holds 60,680 B, the branch 60,738 B (172,915 B raw; first 60,762 B, trimmed in weakest and markOf). Up to 10 B. 60,740 → 60,750 B (R921f1, a tap outside a name prompt's line is the dead press with R918's guard): phase-1 223dcef6 holds 60,738 B, the branch 60,750 B (172,957 B raw); the guard (input/tapGuard.ts), shared by the unit view's chunk and the Mode sheet's, is a lazy chunk whose name joins two preload lists (+10 B), App.svelte hands askName its dead press (+2 B); grouped into the start chunk it measured 60,741 B with its code loaded at every start. 60,750 → 60,820 B (R902, a line whose units were dropped says so when entered in Home): phase-1 5e41a779 holds 60,750 B, the branch 60,815 B (173,112 B raw); Home's Enter must know synchronously whether the line is the one the unit view left with slots, unchanged, so units/kept.ts (the record) is in the start chunk and the entry drops it on every edit and clear (clear, set, insert, a key that changes the line, MathLive's input event). The fix round's first take kept the slot map itself there too (the gate read 60.82 kB); asking the map alone (60,770 B) gave the note to every later line with the same text. Up to 10 B. 60,820 → 60,840 B (R903, a hold on the entry line copies it): phase-1 28ee534b holds 60,815 B, the branch 60,833 B (173,151 B raw); App.svelte hands the entry its hold (`entry.onHold`, +18 B) through withClip, which loads the clipboard code first when it is not in yet, as a hold on a row does (the hook is declared on EntryController, no initializer); reaching `shell.clip` from fieldUp.ts alone costs no byte but copies nothing before the clipboard code's idle load. Up to 10 B. 60,840 → 60,870 B (R905, the flick bubble clamped inside the screen as the key pop is): phase-1 holds 60,833 B, the branch 60,868 B (173,208 B raw); one clamp helper for both, run by an effect each, and the bubble's node bound (`bind:this`, as the pop's is). Measured too: an attachment (`{@attach}`, no node state) 60,88x B, the node found by querySelector 60,878 B, the width read with getBoundingClientRect 60,882 B. Up to 10 B. 60,870 → 60,900 B (G796, Copy of a row nobody checked writes its shown digits): phase-1 8539a7cc holds 60,868 B, the branch 60,893 B (173,272 B raw); clipboard/text.ts is in the start chunk (state/sessionLine.ts imports it), and copyDigits now cuts a warned row, a warned list per element, from its kept value. Up to 10 B. 60,900 → 60,930 B (R912, Store on Shift + ᴇ ends in ▾): phase-1 61f64f72 holds 60,900 B, the branch 60,923 B (173,338 B raw); the spec's `opens: true` on the ᴇ key's Shift action, its parse in keyboard.ts and its read in opens.ts. Measured too: a regex for parseBody's key filter and a ternary in opensSheet (60,923 B), the insert's three flags as one list (60,940 B). Up to 10 B. 60,930 → 60,990 B (R885, a unit row's value and σ drawn by one rule): phase-1 ad4f5b2d holds 60.93 kB (173.36 kB raw), the branch 60,987 B (173,469 B raw). The rule itself rides in the tidy chunk (render/sigmaForm.ts); start keeps the hook: renderPoint asks DisplayContext.sigma and passes its σ on, Session.display takes the tidy chunk's withSigma over withUnit. Drawing the σ text in renderPoint and splicing it in withUnit measured 61.17 kB. Up to 10 B. 60,990 → 61,030 B (R728, the keys say what they do: the letter line in the view's case, data-fallback on a key with no Alpha action, the flick bubble's data-tap and their colour rules, all in the keypad drawn at start): phase-1 121ea201 holds 60,989 B (173,344 B raw), the branch 61,026 B (173,523 B raw; folding the bubble's rule into the key pop's changed nothing). Up to 10 B. 61,030 → 61,040 B (R709, the format chip's name in words, "Number format: Standard. Significant digits: 12. Tap to choose."): phase-1 c2bd9d52 holds 61,027 B (173,530 B raw), the branch 61,036 B (173,529 B raw); the one string in en.ts (the start chunk's i18n table) is all of it, the key names' words ride in their own chunk. Up to 10 B. 61,040 → 61,260 B (R729, the key legends: the face is the tap, armed a ring and locked a fill on the legends, the Shift and Alpha keys and the bar's sign, the rest dimmed; the layer colours as variables for Enter and Plain keys, the K4 lock signs, the key pop's layer text and colour, the lock bubble's fill; all of it the keypad drawn at start): phase-1 eb3ff386 holds 61,027 B (173,530 B raw), the branch 61,239 B (174,164 B raw); merged with phase-1 at R709 (61,036 B), the branch 61,255 B (174,197 B raw). Up to 10 B. 61,260 → 60,830 B (R864, a cut; the budget stays): a template's letter and the Alpha key's corners in the variable face (variable.ts parts, the keypad's runs attachment, +207 B gzip) took phase-1 e68856b6's 61,255 B to 61,462 B. Cut: keyboard.ts's checks that only a wrong spec fails run in the tests and the dev server, not in the built app (SPEC, −580 B), and the shipped keyboard leaves out every label that is the character its layer types (shipped.ts, −49 B): 60,825 B (172,467 B raw). Up to 10 B. 60,830 → 60,850 B (R781, Settings › Appearance › Hand): phase-1 9eab8bdf holds 60,825 B, the branch 60,847 B (172,516 B raw): the stored field in theme/look.ts, its default and reader, as R932's findFull (+22 B; `o.hand === "left" ? o.hand : …` measured 60,846 B). The keypad's mirror is CSS only (a per-key zone style measured +40 B). Rounded up to 10 B. 60,850 → 60,890 B (G550, a σ input whose σ is not carried makes the row ⚠): phase-1 c75dd946 holds 60,851 B (the branch with format.ts as before, 172,528 B raw), the branch 60,885 B (172,617 B raw): markOf's one rule that why.sigmaLost is ⚠ (engine/format.ts; the mark lives there, the reasons and the σ work are in lazy and worker chunks). Rounded up to 10 B. */
export const START_PIN_GZIP = 60_890;

/** R103 (vr-4): the classic inline scripts of index.html run before the first paint, outside every chunk: the stored look
 *  (R50e) and the too-old WebView check. Their gzip sizes, each script alone and summed (as the start chunk sums its
 *  files), are pinned here. 1.53 kB (R103): the build of phase-1 d075b9c measures 1528 B (the look 858 B, the check
 *  670 B; 2993 B raw), rounded up to the next 0.01 kB, since the look's map of hashed theme files moves a byte or two.
 *  A package that grows them raises the pin with a reason, here and in docs/04 8.3. */
export const INLINE_PIN_GZIP = 1_530;

/** The text of each classic inline script (a `<script>` without `src`, not a module) in an HTML page, in order. */
export function inlineScripts(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1] ?? "";
    if (!/\bsrc\s*=/i.test(attrs) && !/\btype\s*=\s*["']?module/i.test(attrs)) out.push(m[2] ?? "");
  }
  return out;
}

/** The row of index.html's inline scripts, or null when the build has no index.html. */
function inlineRow(dist: string): Row | null {
  const index = join(dist, "index.html");
  if (!existsSync(index)) return null;
  const scripts = inlineScripts(readFileSync(index, "utf8")).map((t) => Buffer.from(t));
  const raw = scripts.reduce((n, b) => n + b.length, 0);
  const gzip = scripts.reduce((n, b) => n + gzipSync(hashFree(b)).length, 0);
  const failures = gzip > INLINE_PIN_GZIP ? [`Inline scripts: index.html's inline scripts are pinned at ${kB(INLINE_PIN_GZIP)} gzip (R103), now ${kB(gzip)}: they run before the first paint; move work into the bundle, or raise INLINE_PIN_GZIP in size-check.ts with a reason`] : [];
  return { rule: "Inline scripts", files: ["index.html"], raw, gzip, brotli: 0, rawMax: undefined, gzipMax: INLINE_PIN_GZIP, brotliMax: undefined, failures };
}

/** Failures for the start chunk's row when it is over the pin. */
export function checkStartPin(row: Row): string[] {
  return row.gzip > START_PIN_GZIP ? [`${row.rule} is pinned at ${kB(START_PIN_GZIP)} gzip (R91), now ${kB(row.gzip)}: split more out of it, or raise START_PIN_GZIP in size-check.ts with a reason (it stays under the budget of ${kB(row.gzipMax ?? 0)})`] : [];
}

/** The chunk of `src` when it is loaded on demand: a dynamic entry (src in the manifest), or a shared chunk Rollup named
 *  after it (no src: a lazy chunk imports it statically too, as state/backup.ts does state/migrations.ts, R103). */
function lazyChunk(manifest: Record<string, ManifestChunk>, src: string): ManifestChunk | undefined {
  const name = src.replace(/^.*\//, "").replace(/\.[^.]+$/, "");
  const chunks = Object.values(manifest);
  return chunks.find((c) => c.isDynamicEntry && normalSrc(c.src) === src) ?? chunks.find((c) => c.src === undefined && c.name === name);
}

/** Failures for `srcs` that are loaded at start, or (R320, S58) in no chunk of the build. With chunk-modules.json (a real
 *  build), a module passes when no start file holds it, so a module inside another lazy chunk (views/matrixGrid.svelte.ts
 *  in the matrix sheet's) passes; without it (a fake dist), by name: a dynamic chunk of its own, or a shared one named after it. */
export function lazyFailures(dist: string, srcs: readonly string[]): string[] {
  const manifest = readManifest(dist);
  const start = new Set(startFiles(manifest));
  const modules = readChunkModules(dist);
  const failures: string[] = [];
  for (const src of srcs) {
    if (modules !== null) {
      const held = Object.keys(modules).filter((file) => modules[file]?.includes(src));
      const atStart = held.find((file) => start.has(file));
      if (held.length === 0) failures.push(`${src} is in no chunk of this build`);
      else if (atStart !== undefined) failures.push(`${src} (${atStart}) is loaded at start`);
      continue;
    }
    const chunk = lazyChunk(manifest, src);
    if (chunk === undefined) failures.push(`${src} is not a dynamic chunk: it is in the start chunk (import it with import())`);
    else if (start.has(chunk.file)) failures.push(`${src} (${chunk.file}) is loaded at start`);
  }
  return failures;
}

/** Failures for lazy views that are missing as a dynamic chunk, or that are loaded at start. */
export const checkSplits = (dist: string): string[] => lazyFailures(dist, LAZY_VIEWS);

/** Failures for the R91 parts, likewise. */
export const checkLazyParts = (dist: string): string[] => lazyFailures(dist, LAZY_PARTS);

/** The newest modification time (ms) of any file under `dir`; 0 when it does not exist. */
function newestMtime(dir: string): number {
  if (!existsSync(dir)) return 0;
  let newest = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    newest = Math.max(newest, e.isDirectory() ? newestMtime(p) : statSync(p).mtimeMs);
  }
  return newest;
}

/** A message when `dist/index.html` is older than the newest file under app/src/ or spec/ (a stale build measures old code); else null. */
export function staleMessage(dist: string): string | null {
  const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
  const index = join(dist, "index.html");
  if (!existsSync(index)) return null;
  const built = statSync(index).mtimeMs;
  const newest = Math.max(newestMtime(join(root, "app/src")), newestMtime(join(root, "spec")));
  return built < newest ? `size-check: ${index} is older than the newest file under app/src/ or spec/; run npm run build first` : null;
}

const kB = (n: number): string => `${(n / KB).toFixed(2)} kB`;

/** Measure `dist` against the budgets. Pure apart from reading files; the CLI prints and sets the exit code. */
export function checkSizes(dist: string): Report {
  const all = precacheFiles(dist);
  const { present, absent, missing } = subjects(readManifest(dist), all, readChunkModules(dist));
  const rows: Row[] = [];
  for (const s of present) {
    let raw = 0;
    let gzip = 0;
    let brotli = 0;
    const isTotal = s.rule === "Precache total";
    for (const f of s.files) {
      const buf = readFileSync(join(dist, f));
      raw += buf.length;
      // The precache total is a raw sum only; compressing 13 MB of wasm for a number nobody budgets would just slow the build.
      const held = isTotal || !NAMING.test(f) ? buf : hashFree(buf); // A272
      if (!isTotal && s.gzipMax !== undefined) gzip += gzipSync(held).length;
      if (!isTotal && s.brotliMax !== undefined) brotli += brotliCompressSync(held, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: held.length } }).length;
    }
    const failures: string[] = [];
    if (s.rawMax !== undefined && raw > s.rawMax) failures.push(`${s.rule}: ${kB(raw)} raw is over the budget of ${kB(s.rawMax)} (${s.files.join(", ")})`);
    if (s.gzipMax !== undefined && gzip > s.gzipMax) failures.push(`${s.rule}: ${kB(gzip)} gzip is over the budget of ${kB(s.gzipMax)} (${s.files.join(", ")})`);
    if (s.brotliMax !== undefined && brotli > s.brotliMax) failures.push(`${s.rule}: ${kB(brotli)} brotli is over the budget of ${kB(s.brotliMax)} (${s.files.join(", ")})`);
    rows.push({ rule: s.rule, files: s.files, raw, gzip, brotli, rawMax: s.rawMax, gzipMax: s.gzipMax, brotliMax: s.brotliMax, failures });
  }
  const inline = inlineRow(dist);
  if (inline !== null) rows.splice(1, 0, inline);
  else absent.unshift("Inline scripts");
  const extra = extraStartFiles(readManifest(dist));
  const startRow = rows.find((r) => r.rule === "Start chunk");
  if (startRow !== undefined && extra.length > 0) startRow.failures.push(`Start chunk: the start is one JS file, but the build splits it: ${extra.join(", ")} (a lazy chunk imports a value from a start module; the $initial group in vite.config.ts should prevent that, archive/r21-chunks.md)`);
  const missingFailures = missing.map((rule) => `${rule}: no chunk holds src/find/finder.ts (neither a dynamic entry nor a shared chunk named "finder"); the rule measures nothing`);
  return { rows, notBuilt: absent, failures: [...rows.flatMap((r) => r.failures), ...missingFailures] };
}

function format(report: Report): string {
  const cell = (value: number, max: number | undefined, label: string): string => (max === undefined ? "" : `${label} ${kB(value)} / ${kB(max)}`);
  const lines = report.rows.map((r) => {
    const parts = [cell(r.raw, r.rawMax, "raw"), cell(r.gzip, r.gzipMax, "gzip"), cell(r.brotli, r.brotliMax, "brotli")].filter(Boolean);
    return `  ${r.failures.length > 0 ? "FAIL" : "ok  "}  ${r.rule.padEnd(19)} ${parts.join("   ")}`;
  });
  lines.unshift("  gzip (hashes held): hashed file names are fixed before gzip and brotli (A272); raw is the real file");
  if (report.notBuilt.length > 0) lines.push(`  (not built yet: ${report.notBuilt.join(", ")})`);
  return lines.join("\n");
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), "../dist"));
  if (!existsSync(dist) || !statSync(dist).isDirectory()) {
    console.error(`size-check: ${dist} is not a folder; run vite build first`);
    process.exit(2);
  }
  const stale = staleMessage(dist);
  if (stale !== null) {
    console.error(stale);
    process.exit(1);
  }
  try {
    const report = checkSizes(dist);
    report.failures.push(...checkSplits(dist), ...checkLazyParts(dist));
    if (!existsSync(join(dist, CHUNK_MODULES))) report.failures.push(`${CHUNK_MODULES} is missing: the unit view's rule cannot see src/units/ modules in shared chunks (vite-plugin-chunk-modules.ts writes it; build with npm run build)`);
    const start = report.rows.find((r) => r.rule === "Start chunk");
    if (start !== undefined) report.failures.push(...checkStartPin(start));
    console.log(`size-check: ${dist}\n${format(report)}`);
    if (report.failures.length > 0) {
      console.error(`\nsize-check FAILED:\n${report.failures.map((f) => `  ${f}`).join("\n")}\nA budget changes only together with docs/04-architecture.md section 8.3.`);
      process.exit(1);
    }
    console.log("size-check passed");
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(2);
  }
}

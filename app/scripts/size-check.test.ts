// SPDX-License-Identifier: GPL-3.0-or-later
// The size test must itself fail when it should: fake build folders with chunks under and over each budget.
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { readSources, startReach } from "./import-rules.ts";
import { checkLazyParts, checkSizes, checkSplits, checkStartPin, hashFree, INLINE_PIN_GZIP, inlineScripts, LAZY_PARTS, lazyFailures, START_PIN_GZIP, startFiles, UNIT_VIEW_PIN_RAW } from "./size-check.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A size in bytes. A plain number compresses well (20 kB of random bytes, then zeros); `{ random }` is incompressible. */
type Size = number | { random: number };

/** A fake dist: `files` maps a path to its size. */
function fakeDist(manifest: Record<string, object>, files: Record<string, Size>, texts: Record<string, string> = {}): string {
  const dist = mkdtempSync(join(tmpdir(), "size-check-"));
  dirs.push(dist);
  mkdirSync(join(dist, ".vite"));
  writeFileSync(join(dist, ".vite/manifest.json"), JSON.stringify(manifest));
  for (const [path, size] of Object.entries(files)) {
    mkdirSync(join(dist, path, ".."), { recursive: true });
    const content = typeof size === "number" ? Buffer.concat([randomBytes(Math.min(size, 20_000)), Buffer.alloc(Math.max(0, size - 20_000))]) : randomBytes(size.random);
    writeFileSync(join(dist, path), content);
  }
  for (const [path, text] of Object.entries(texts)) {
    mkdirSync(join(dist, path, ".."), { recursive: true });
    writeFileSync(join(dist, path), text);
  }
  return dist;
}

/** The Find UI chunk as a shared chunk (Rollup's "finder", no src): a build must hold src/find/finder.ts somewhere. */
const FINDER = { "_finder.js": { file: "assets/finder.js", name: "finder" } };
const FINDER_FILE = { "assets/finder.js": 8000 };

const base = (startBytes: number) => ({
  manifest: {
    ...FINDER,
    "index.html": { file: "assets/index.js", src: "index.html", isEntry: true },
    "../../../../app/node_modules/mathlive/mathlive.min.mjs": { file: "assets/mathlive.js", src: "../../../../app/node_modules/mathlive/mathlive.min.mjs", isDynamicEntry: true },
  },
  files: { ...FINDER_FILE, "assets/index.js": startBytes, "assets/mathlive.js": 800_000 },
});

describe("size-check", () => {
  it("passes a build inside the budgets and lists the chunks that are not built yet", () => {
    const { manifest, files } = base(140_000);
    const r = checkSizes(fakeDist(manifest, files));
    expect(r.failures).toEqual([]);
    expect(r.rows.map((x) => x.rule)).toEqual(["Start chunk", "MathLive chunk", "Find UI chunk", "Precache total"]);
    expect(r.notBuilt).toEqual(["Inline scripts", "Unit view chunk", "Unit view + shared", "Find index asset", "qalc wasm + glue"]);
  });

  it("pins index.html's inline scripts at 1.53 kB gzip, each script alone and summed, not the module script (R103, vr-4)", () => {
    expect(INLINE_PIN_GZIP).toBe(1_530);
    const page = (a: string, b: string): string =>
      `<html><head><script>${a}</script></head><body><div id="app"></div><script>\n${b}</script><script type="module" crossorigin src="./assets/index.js"></script><script type="module">import "x";</script></body></html>`;
    expect(inlineScripts(page("var a = 1;", "var b = 2;")).map((t) => t.trim())).toEqual(["var a = 1;", "var b = 2;"]);
    const { manifest, files } = base(1000);
    const withPage = (html: string): string => {
      const dist = fakeDist(manifest, files);
      writeFileSync(join(dist, "index.html"), html);
      return dist;
    };
    // base64 of random bytes gzips to about 0.81 of its length: 900 B twice sits under the pin, 1000 B twice over it
    const text = (n: number): string => randomBytes(n).toString("base64").slice(0, n);
    const inside = checkSizes(withPage(page(text(900), text(900))));
    const row = inside.rows.find((x) => x.rule === "Inline scripts")!;
    expect(row.raw).toBe(1801); // the second script starts with a newline
    expect(row.gzip).toBeLessThanOrEqual(INLINE_PIN_GZIP);
    expect(inside.failures).toEqual([]);
    const over = checkSizes(withPage(page(text(1000), text(1000))));
    expect(over.rows.find((x) => x.rule === "Inline scripts")!.gzip).toBeGreaterThan(INLINE_PIN_GZIP);
    expect(over.failures.map((f) => f.split(":")[0])).toEqual(["Inline scripts"]);
  });

  it("fails a start chunk over 180 kB raw", () => {
    const { manifest, files } = base(180_001);
    const r = checkSizes(fakeDist(manifest, files));
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toContain("Start chunk");
    expect(r.failures[0]).toContain("raw");
  });

  it("counts the entry plus every chunk it imports, transitively, once each, and not dynamic imports", () => {
    const manifest = {
      ...FINDER,
      "index.html": { file: "assets/index.js", src: "index.html", isEntry: true, imports: ["_a.js", "_b.js"], dynamicImports: ["lazy.js"] },
      "_a.js": { file: "assets/a.js", imports: ["_c.js"] },
      "_b.js": { file: "assets/b.js", imports: ["_c.js"] }, // diamond: _c is reached twice
      "_c.js": { file: "assets/c.js" },
      "lazy.js": { file: "assets/lazy.js", isDynamicEntry: true, src: "lazy.js" },
    };
    expect(startFiles(manifest).sort()).toEqual(["assets/a.js", "assets/b.js", "assets/c.js", "assets/index.js"]);
    // Each file is 50 kB: the entry alone is under 180 kB, the four together (200 kB) are over. lazy.js (1 MB) must not count.
    const files = { ...FINDER_FILE, "assets/index.js": 50_000, "assets/a.js": 50_000, "assets/b.js": 50_000, "assets/c.js": 50_000, "assets/lazy.js": 1_000_000 };
    const r = checkSizes(fakeDist(manifest, files));
    const start = r.rows.find((x) => x.rule === "Start chunk");
    expect(start?.raw).toBe(200_000);
    expect(start?.files.sort()).toEqual(["assets/a.js", "assets/b.js", "assets/c.js", "assets/index.js"]);
    // Over both the raw budget (200 kB > 180 kB) and the gzip one (80 kB of random bytes > 63 kB); nothing else fails.
    expect(r.failures.every((f) => f.startsWith("Start chunk"))).toBe(true);
    expect(r.failures.some((f) => f.includes("raw"))).toBe(true);
  });

  it("fails a start of two JS files, even inside the budgets, and names the extra file (R294, r21)", () => {
    const manifest = {
      ...FINDER,
      "index.html": { file: "assets/index.js", src: "index.html", isEntry: true, imports: ["_a.js"] },
      "_a.js": { file: "assets/a.js", name: "a" },
    };
    const r = checkSizes(fakeDist(manifest, { ...FINDER_FILE, "assets/index.js": 70_000, "assets/a.js": 10_000 }));
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toContain("Start chunk");
    expect(r.failures[0]).toContain("one JS file");
    expect(r.failures[0]).toContain("assets/a.js");
    expect(r.failures[0]).not.toContain("assets/index.js");
  });

  it("passes a start of one JS file", () => {
    const manifest = { ...FINDER, "index.html": { file: "assets/index.js", src: "index.html", isEntry: true } };
    expect(checkSizes(fakeDist(manifest, { ...FINDER_FILE, "assets/index.js": 70_000 })).failures).toEqual([]);
  });

  it("reports an import the manifest does not list instead of ignoring it", () => {
    const manifest = { "index.html": { file: "assets/index.js", isEntry: true, imports: ["_missing.js"] } };
    expect(() => startFiles(manifest)).toThrow(/_missing\.js/);
  });

  it("fails a start chunk over 63 kB gzip even when it is under 180 kB raw", () => {
    const { manifest } = base(0);
    // Random bytes do not compress, so 64 kB raw is over 63 kB gzip and well under 180 kB raw.
    const r = checkSizes(fakeDist(manifest, { ...FINDER_FILE, "assets/index.js": { random: 64_000 }, "assets/mathlive.js": 1000 }));
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toContain("gzip");
  });

  it("fails the MathLive chunk over 830 kB, found by its source path under node_modules", () => {
    const { manifest } = base(1000);
    const r = checkSizes(fakeDist(manifest, { ...FINDER_FILE, "assets/index.js": 1000, "assets/mathlive.js": 830_001 }));
    expect(r.failures.map((f) => f.split(":")[0])).toEqual(["MathLive chunk"]);
  });

  it("applies the Find, Units, index and qalc budgets as soon as the chunks exist", () => {
    const { manifest, files } = base(1000);
    const { "_finder.js": _shared, ...noFinder } = manifest;
    const dist = fakeDist(
      {
        ...noFinder,
        "src/find/finder.ts": { file: "assets/find.js", src: "src/find/finder.ts", isDynamicEntry: true },
        "src/units/calc.ts": { file: "assets/units.js", src: "src/units/calc.ts", isDynamicEntry: true },
        "src/units/open.ts": { file: "assets/open.js", src: "src/units/open.ts", isDynamicEntry: true },
      },
      { ...files, "assets/find.js": 30_001, "assets/units.js": 10_000, "assets/open.js": 34_220, "find/index.json": { random: 400_001 }, "qalc/qalc.wasm": { random: 1_000_001 }, "qalc/qalc.mjs": 1000, "index.html": 100 },
    );
    const r = checkSizes(dist);
    expect(r.notBuilt).toEqual([]);
    const failed = r.failures.map((f) => f.split(":")[0]);
    expect(failed).toContain("Find UI chunk");
    expect(failed).not.toContain("Unit view chunk"); // the UI chunk and the builder together, exactly at 45.13 kB, are allowed
    expect(failed).toContain("Find index asset");
    expect(failed).toContain("qalc wasm + glue");
  });

  it("budgets the unit view's UI chunk and builder as one, at 45.13 kB raw (R24c; Opus pass 24, G81; R313; G233; R918; R885; R797; R807; R808; R808f1; R896)", () => {
    const { manifest, files } = base(1000);
    const units = {
      ...manifest,
      "src/units/calc.ts": { file: "assets/units.js", src: "src/units/calc.ts", isDynamicEntry: true },
      "src/units/open.ts": { file: "assets/open.js", src: "src/units/open.ts", isDynamicEntry: true },
    };
    const r = checkSizes(fakeDist(units, { ...files, "assets/units.js": 10_000, "assets/open.js": 35_131 }));
    expect(r.failures.map((f) => f.split(":")[0])).toEqual(["Unit view chunk"]);
    expect(r.rows.find((x) => x.rule === "Unit view chunk")?.files.sort()).toEqual(["assets/open.js", "assets/units.js"]);
  });

  it("counts a src/units/ module that sits in a shared chunk against the unit view, pinned as a whole (G163)", () => {
    const { manifest, files } = base(1000);
    const units = {
      ...manifest,
      "src/units/calc.ts": { file: "assets/units.js", src: "src/units/calc.ts", isDynamicEntry: true, imports: ["_shared.js"] },
      "src/units/open.ts": { file: "assets/open.js", src: "src/units/open.ts", isDynamicEntry: true, imports: ["_shared.js"] },
      "_shared.js": { file: "assets/shared.js", name: "shared" },
      "_other.js": { file: "assets/other.js", name: "other" },
    };
    const modules = { "assets/shared.js": ["src/units/dims.ts", "src/engine/format.ts"], "assets/other.js": ["src/engine/format.ts"] };
    const run = (sharedBytes: number) => {
      const dist = fakeDist(units, { ...files, "assets/units.js": 10_000, "assets/open.js": 20_000, "assets/shared.js": sharedBytes, "assets/other.js": 5_000 });
      writeFileSync(join(dist, ".vite/chunk-modules.json"), JSON.stringify(modules));
      return checkSizes(dist);
    };
    const ok = run(UNIT_VIEW_PIN_RAW - 30_000);
    expect(ok.failures).toEqual([]);
    expect(ok.rows.find((x) => x.rule === "Unit view chunk")?.raw).toBe(30_000); // the entries alone, as before
    const all = ok.rows.find((x) => x.rule === "Unit view + shared");
    expect(all?.files.sort()).toEqual(["assets/open.js", "assets/shared.js", "assets/units.js"]);
    expect(all?.raw).toBe(UNIT_VIEW_PIN_RAW);
    const over = run(UNIT_VIEW_PIN_RAW - 30_000 + 1);
    expect(over.failures.map((f) => f.split(":")[0])).toEqual(["Unit view + shared"]);
  });

  it("does not count a shared chunk without a src/units/ module, nor a start-chunk file that holds a src/units/ module (G163)", () => {
    const { manifest, files } = base(1000);
    const units = {
      ...manifest,
      "src/units/open.ts": { file: "assets/open.js", src: "src/units/open.ts", isDynamicEntry: true, imports: ["_other.js"] },
      "_other.js": { file: "assets/other.js", name: "other" },
      // reached from the entry, so loaded at start (the start chunk's row counts it), and it holds a src/units/ module
      "_atstart.js": { file: "assets/atstart.js", name: "atstart" },
      "index.html": { ...manifest["index.html"], imports: ["_atstart.js"] },
    };
    const dist = fakeDist(units, { ...files, "assets/open.js": 30_000, "assets/other.js": 9_000, "assets/atstart.js": 7_000 });
    writeFileSync(join(dist, ".vite/chunk-modules.json"), JSON.stringify({ "assets/other.js": ["src/engine/format.ts"], "assets/atstart.js": ["src/units/types.ts"] }));
    const r = checkSizes(dist);
    expect(r.failures).toHaveLength(1); // the shared chunk at start is a second start file (R294); nothing else fails
    expect(r.failures[0]).toContain("assets/atstart.js");
    expect(r.rows.find((x) => x.rule === "Unit view chunk")?.files).toEqual(["assets/open.js"]);
    expect(r.rows.find((x) => x.rule === "Unit view + shared")?.files).toEqual(["assets/open.js"]);
    expect(r.rows.find((x) => x.rule === "Start chunk")?.files).toContain("assets/atstart.js");
  });

  it("measures the Find UI chunk when src/find/finder.ts is a dynamic entry, at 30 kB raw", () => {
    const { manifest, files } = base(1000);
    const { "_finder.js": _shared, ...noFinder } = manifest;
    const entry = { ...noFinder, "src/find/finder.ts": { file: "assets/finder-e.js", name: "finder", src: "src/find/finder.ts", isDynamicEntry: true } };
    const ok = checkSizes(fakeDist(entry, { ...files, "assets/finder-e.js": 30_000 }));
    expect(ok.failures).toEqual([]);
    expect(ok.rows.find((x) => x.rule === "Find UI chunk")?.files).toEqual(["assets/finder-e.js"]);
    const over = checkSizes(fakeDist(entry, { ...files, "assets/finder-e.js": 30_001 }));
    expect(over.failures.map((f) => f.split(":")[0])).toEqual(["Find UI chunk"]);
  });

  it("measures the Find UI chunk when finder.ts is a shared chunk named finder (no src), at 30 kB raw", () => {
    const { manifest, files } = base(1000);
    const shared = { ...manifest, "_finder.js": { file: "assets/finder-s.js", name: "finder", imports: ["_enFind.js"] }, "_enFind.js": { file: "assets/enFind.js", name: "enFind" } };
    const ok = checkSizes(fakeDist(shared, { ...files, "assets/finder-s.js": 8000, "assets/enFind.js": 90_000 }));
    expect(ok.failures).toEqual([]);
    expect(ok.rows.find((x) => x.rule === "Find UI chunk")?.files).toEqual(["assets/finder-s.js"]);
    const over = checkSizes(fakeDist(shared, { ...files, "assets/finder-s.js": 30_001, "assets/enFind.js": 90_000 }));
    expect(over.failures.map((f) => f.split(":")[0])).toEqual(["Find UI chunk"]);
  });

  it("fails when no chunk holds src/find/finder.ts, instead of listing the rule as not built yet", () => {
    const { manifest, files } = base(1000);
    const { "_finder.js": _shared, ...noFinder } = manifest;
    const r = checkSizes(fakeDist(noFinder, { "assets/index.js": 1000, "assets/mathlive.js": 1000 }));
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toContain("Find UI chunk");
    expect(r.failures[0]).toContain("src/find/finder.ts");
    expect(r.notBuilt).not.toContain("Find UI chunk");
    void files;
  });

  it("fails a precache total over 18 MB, not counting source maps, sw.js or .vite/", () => {
    const { manifest, files } = base(1000);
    const ok = checkSizes(fakeDist(manifest, { ...files, "assets/x.js.map": 20_000_000, "sw.js": 20_000_000 }));
    expect(ok.failures).toEqual([]);
    const over = checkSizes(fakeDist(manifest, { ...files, "engine/giac.wasm": 17_300_000 }));
    expect(over.failures.map((f) => f.split(":")[0])).toEqual(["Precache total"]);
  });

  it("reports a missing manifest instead of passing", () => {
    const dist = mkdtempSync(join(tmpdir(), "size-check-"));
    dirs.push(dist);
    expect(() => checkSizes(dist)).toThrow(/manifest/);
  });

  it("fails when the sheet's view is not its own chunk, or is loaded at start (R46)", () => {
    const { manifest, files } = base(1000);
    expect(checkSplits(fakeDist(manifest, files))[0]).toContain("src/views/Sheet.svelte");
    const lazy = { "src/views/Sheet.svelte": { file: "assets/sheet.js", src: "src/views/Sheet.svelte", isDynamicEntry: true } };
    expect(checkSplits(fakeDist({ ...manifest, ...lazy }, { ...files, "assets/sheet.js": 1000 }))).toEqual([]);
    const atStart = { ...manifest, "index.html": { ...manifest["index.html"], imports: ["src/views/Sheet.svelte"] }, ...lazy };
    expect(checkSplits(fakeDist(atStart, { ...files, "assets/sheet.js": 1000 }))[0]).toContain("loaded at start");
  });

  it("pins the start chunk at 61,020 B gzip with hashed names held fixed, under the budget of 63 kB (R815, a name's copy in Memory, on phase-1's 61,001 B; R813, a swipe left on a Memory row, on G315's 61,000 B; G315, the Calc port's CalcFailure: 60,998 B on phase-1 1d78671a's 60,926 B; the earlier pins are in size-check.ts)", () => {
    expect(START_PIN_GZIP).toBe(61_020);
    const { manifest } = base(0);
    const at = checkSizes(fakeDist(manifest, { ...FINDER_FILE, "assets/index.js": { random: 60_570 }, "assets/mathlive.js": 1000 }));
    expect(at.failures).toEqual([]); // inside the budget of 63 kB ...
    expect(checkStartPin(at.rows[0]!)).toEqual([]); // ... and inside the pin
    const room = checkSizes(fakeDist(manifest, { ...FINDER_FILE, "assets/index.js": { random: 62_200 }, "assets/mathlive.js": 1000 }));
    expect(room.failures).toEqual([]); // R930: inside the budget, so a package that grows the chunk raises the pin with a reason ...
    expect(checkStartPin(room.rows[0]!)[0]).toContain("pinned"); // ... and the pin says so
    const over = checkSizes(fakeDist(manifest, { ...FINDER_FILE, "assets/index.js": { random: 63_200 }, "assets/mathlive.js": 1000 }));
    expect(over.rows[0]!.gzip).toBeGreaterThan(63_000);
    expect(checkStartPin(over.rows[0]!)[0]).toContain("pinned"); // over both
    const inside = checkSizes(fakeDist(manifest, { ...FINDER_FILE, "assets/index.js": { random: 58_000 }, "assets/mathlive.js": 1000 }));
    expect(checkStartPin(inside.rows[0]!)).toEqual([]);
  });

  it("fails when a part that only runs after a key press or a result is loaded at start, or is not its own chunk (R91)", () => {
    const { manifest, files } = base(1000);
    expect(checkLazyParts(fakeDist(manifest, files)).map((f) => f.split(" ")[0])).toEqual(LAZY_PARTS);
    const lazy = Object.fromEntries(LAZY_PARTS.map((src, n) => [src, { file: `assets/p${n}.js`, src, isDynamicEntry: true }]));
    const sizes = Object.fromEntries(LAZY_PARTS.map((_, n) => [`assets/p${n}.js`, 1000]));
    expect(checkLazyParts(fakeDist({ ...manifest, ...lazy }, { ...files, ...sizes }))).toEqual([]);
    const atStart = { ...manifest, "index.html": { ...manifest["index.html"], imports: [LAZY_PARTS[0]] }, ...lazy };
    expect(checkLazyParts(fakeDist(atStart, { ...files, ...sizes }))[0]).toContain("loaded at start");
  });

  it("takes a lazy part that Rollup made a shared chunk named after it (no src), and fails it at start (R103: state/migrations.ts)", () => {
    const { manifest, files } = base(1000);
    const others = LAZY_PARTS.filter((src) => src !== "src/state/migrations.ts");
    const lazy = Object.fromEntries(others.map((src, n) => [src, { file: `assets/p${n}.js`, src, isDynamicEntry: true }]));
    const sizes = Object.fromEntries(others.map((_, n) => [`assets/p${n}.js`, 1000]));
    const shared = { "_migrations-x.js": { file: "assets/migrations-x.js", name: "migrations", imports: ["index.html"] } };
    const all = { ...files, ...sizes, "assets/migrations-x.js": 1000 };
    expect(checkLazyParts(fakeDist({ ...manifest, ...lazy, ...shared }, all))).toEqual([]);
    const atStart = { ...manifest, "index.html": { ...manifest["index.html"], imports: ["_migrations-x.js"] }, ...lazy, ...shared };
    expect(checkLazyParts(fakeDist(atStart, all))).toEqual(["src/state/migrations.ts (assets/migrations-x.js) is loaded at start"]);
    expect(checkLazyParts(fakeDist({ ...manifest, ...lazy }, all))[0]).toContain("src/state/migrations.ts is not a dynamic chunk");
  });

  it("reads chunk-modules.json when the build has it: a module inside another lazy chunk passes, one a start file holds fails (R320, S58)", () => {
    const { manifest, files } = base(1000);
    const sheet = { ...manifest, "src/views/matrixSheet.ts": { file: "assets/ms.js", src: "src/views/matrixSheet.ts", isDynamicEntry: true } };
    const grid = "src/views/matrixGrid.svelte.ts";
    const run = (modules: Record<string, string[]> | null): string[] => {
      const dist = fakeDist(sheet, { ...files, "assets/ms.js": 1000 });
      if (modules !== null) writeFileSync(join(dist, ".vite/chunk-modules.json"), JSON.stringify(modules));
      return lazyFailures(dist, [grid]);
    };
    expect(run({ "assets/index.js": ["src/main.ts"], "assets/ms.js": [grid, "src/views/matrixSheet.ts"] })).toEqual([]);
    expect(run({ "assets/index.js": ["src/main.ts", grid], "assets/ms.js": ["src/views/matrixSheet.ts"] })).toEqual([`${grid} (assets/index.js) is loaded at start`]);
    expect(run({ "assets/index.js": ["src/main.ts"], "assets/ms.js": ["src/views/matrixSheet.ts"] })).toEqual([`${grid} is in no chunk of this build`]);
    expect(run(null)[0]).toContain(`${grid} is not a dynamic chunk`); // a fake dist without the file: the name rule
  });

  it("holds the press counters and S58's five modules among the lazy parts (R320)", () => {
    for (const src of ["src/state/taps.svelte.ts", "src/state/pressCount.ts", "src/views/statSheet.ts", "src/views/helpSheet.ts", "src/views/matrixGrid.svelte.ts", "src/entry/cursorFn.ts", "src/engine/decimalLatex.ts"]) expect(LAZY_PARTS).toContain(src);
  });

  it("holds the shell's app-opening part and the view tabs' icons among the lazy parts, and no static import from main.ts reaches them (R362, S58 cuts 1 and 4)", () => {
    const parts = ["src/apps/shellOpen.ts", "src/views/icons.ts"];
    for (const src of parts) expect(LAZY_PARTS).toContain(src);
    const reach = startReach(readSources(join(import.meta.dirname, "..")));
    expect(reach.has("src/apps/shell.svelte.ts")).toBe(true); // the walk sees the start: the shell's start part stays
    expect(parts.filter((src) => reach.has(src))).toEqual([]);
  });

  // A272: the start chunk names the lazy chunks, the Find index and the engine by their hashed file names; a new hash gzips a few
  // bytes differently with no source change, so the gzip and brotli columns hold the hashes fixed. Raw stays the real file's.
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  const hashOf = (seed: number, i: number): string => {
    let x = (seed * 7919 + i * 104729 + 13) >>> 0;
    return Array.from({ length: 8 }, () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0), ALPHABET[(x >>> 24) % 64])).join("");
  };
  const hexOf = (seed: number, i: number): string => (Math.imul(seed * 7919 + i, 2654435761) >>> 0).toString(16).padStart(8, "0");
  const startText = (seed: number, tail = ""): string => {
    const names = Array.from({ length: 200 }, (_, i) => `import("./assets/chunk${i}-${hashOf(seed, i)}.js");`);
    return `${names.join("\n")}\nfetch("./assets/find-index-${hashOf(seed, 1000)}.json");\nnew Worker("./engine/giac.${hexOf(seed, 1001)}${hexOf(seed, 1002)}.mjs");\n${tail}`;
  };
  const startDist = (text: string): string => {
    const { manifest } = base(0);
    return fakeDist(manifest, { ...FINDER_FILE, "assets/mathlive.js": 800_000 }, { "assets/index.js": text });
  };
  const startRow = (text: string) => checkSizes(startDist(text)).rows.find((x) => x.rule === "Start chunk")!;

  it("measures the same gzip for two start chunks that differ only in the hash part of the file names they name (A272)", () => {
    const a = startText(1);
    const b = startText(2);
    expect(a).not.toBe(b);
    expect(gzipSync(Buffer.from(a)).length).not.toBe(gzipSync(Buffer.from(b)).length); // the real files do gzip differently
    const ra = startRow(a);
    const rb = startRow(b);
    expect(ra.gzip).toBe(rb.gzip);
    expect(ra.raw).toBe(Buffer.byteLength(a)); // raw is the real file's
    expect(ra.raw).toBe(rb.raw);
  });

  it("still measures a start chunk whose code changes by one character differently (A272)", () => {
    const base1 = startText(1, "var answer = 41;\n" + randomBytes(300).toString("base64"));
    const changed = base1.replace("var answer = 41;", "var answer = 42;");
    const other = base1.replace("var answer = 41;", "var anSwer = 41;");
    expect(changed.length).toBe(base1.length);
    expect(hashFree(Buffer.from(changed)).equals(hashFree(Buffer.from(base1)))).toBe(false);
    expect(hashFree(Buffer.from(other)).equals(hashFree(Buffer.from(base1)))).toBe(false);
  });

  it("hashFree turns Vite's 8-character hashes and the engine's 16 hex digits into a placeholder of the same length, and touches nothing else (A272)", () => {
    const text = 'a("./index-AbCdEf12.js"),b("./find-index-Zz9Yy8Xx.json"),c("./giac.0123456789abcdef.mjs"),d("./x.0123456789abcdef.wasm"),e("./a-b-q_-0Z9aB.css"),k = "index-short.js", u = "Qq7Rr6Ss.js"';
    const out = hashFree(Buffer.from(text)).toString();
    expect(out.length).toBe(text.length);
    expect(out).not.toMatch(/AbCdEf12|Zz9Yy8Xx|0123456789abcdef|q_-0Z9aB/);
    expect(out).toContain("./index-");
    expect(out).toContain("./find-index-");
    expect(out).toContain("./giac.");
    expect(out).toContain('index-short.js", u = "Qq7Rr6Ss.js"'); // too short, or no separator before the 8 characters: not a hash
    expect(hashFree(Buffer.from(text.replace(/AbCdEf12|Zz9Yy8Xx/g, "Qq1Ww2Ee"))).equals(hashFree(Buffer.from(text.replace(/AbCdEf12|Zz9Yy8Xx/g, "Mm3Nn4Oo"))))).toBe(true);
  });

  it("holds the hashes fixed for the brotli column too (A272)", () => {
    const mk = (seed: number) => {
      const { manifest, files } = base(1000);
      const dist = fakeDist(manifest, files, { "assets/qalc.js": startText(seed) });
      return checkSizes(dist).rows.find((x) => x.rule === "qalc wasm + glue")!.brotli;
    };
    expect(mk(3)).toBe(mk(4));
  });
});

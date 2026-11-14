// SPDX-License-Identifier: GPL-3.0-or-later
// S58: what each candidate cut saves in the start chunk, measured. Builds app/ once as it is (`base`) and once per variant
// into tools/probes/_out/start-cuts/<variant>/, and prints the start chunk (the entry plus its static imports, summed as
// app/scripts/size-check.ts sums them: raw, zlib-default gzip) and its change against base.
//   node tools/probes/start-cuts.mjs [variant …] [--no-build]
// A variant names modules under app/src joined by `+` (e.g. `state/taps.svelte.ts+state/pressCount.ts`). In that build every
// import of such a module from outside it resolves to a stub: each export the module declares becomes a property read
// (`globalThis.__probe.<name>`, opaque to the minifier, so the call sites stay as they are), and the stub carries one
// `import()` of the real module, so the real code becomes a lazy chunk with its preload list, as a cut would make it.
// The stub drops the module's top-level side effects and writes no `await` at the call sites: the number is the cut's
// gain less one import() site, a real cut adds its own glue (tens of bytes; R184's second import() site cost 0.1 kB).
// The tree is not touched (a resolveId/load plugin in a probe config); a build takes a few seconds on win99; run the probe
// under `tools/devlock.sh slice <name> …` all the same. Needs app/public/engine (cd app && npm run engine:copy) and the
// Find index (npm run index). Default variants: the six candidates of docs/research/start-chunk-cuts.md.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const app = join(root, "app");
const outRoot = join(root, "tools/probes/_out/start-cuts");
const build = !process.argv.includes("--no-build");
const named = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const DEFAULT = [
  "state/taps.svelte.ts+state/pressCount.ts",
  "apps/shell.svelte.ts",
  "input/backLayer.ts",
  "views/edgeFade.ts",
  "views/rowGestures.ts",
  "state/updateOffer.svelte.ts+views/icons.ts",
];
const variants = ["base", ...(named.length > 0 ? named : DEFAULT)];
const LAZY_CHECK = ["src/views/statSheet.ts", "src/views/matrixGrid.svelte.ts", "src/views/helpSheet.ts", "src/entry/cursorFn.ts", "src/engine/decimalLatex.ts", "src/calc/fake.ts"];

function configText(targets) {
  return `import base from ${JSON.stringify(join(app, "vite.config.ts"))};
import { readFileSync } from "node:fs";
const TARGETS = ${JSON.stringify(targets.map((t) => join(app, "src", t)))};
const STUB = "\\0probe-stub-";
const stubbed = new Set();
/** The names a module exports, read from its source (comments stripped): declarations, export lists, default. */
function exportNames(file) {
  const t = readFileSync(file, "utf8").replace(/\\/\\*[\\s\\S]*?\\*\\//g, "").replace(/(^|[^:"'\`\\\\])\\/\\/[^\\n]*/g, "$1");
  if (/^\\s*export\\s*\\*/m.test(t)) throw new Error("probe-stub: export * in " + file);
  const names = new Set();
  for (const m of t.matchAll(/^\\s*export\\s+(?:declare\\s+)?(?:async\\s+)?(?:function\\*?|const|let|var|class|abstract\\s+class|interface|type|enum)\\s+([A-Za-z_$][\\w$]*)/gm)) names.add(m[1]);
  for (const m of t.matchAll(/^\\s*export\\s+(?:type\\s+)?\\{([^}]*)\\}/gm))
    for (const part of m[1].split(",")) { const n = part.trim().replace(/^type\\s+/, "").split(/\\s+as\\s+/).pop(); if (n) names.add(n); }
  if (/^\\s*export\\s+default\\b/m.test(t)) names.add("default");
  return [...names];
}
export default (env) => {
  const c = base(env);
  c.plugins = [{
    name: "probe-stub",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (importer === undefined || importer.startsWith(STUB)) return null;
      const r = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (r === null) return null;
      const i = TARGETS.indexOf(r.id.split("?")[0]);
      return i < 0 ? null : STUB + i + ".js";
    },
    load(id) {
      if (!id.startsWith(STUB)) return null;
      const i = Number(id.slice(STUB.length, -3));
      const file = TARGETS[i];
      stubbed.add(file);
      const lines = ["const p = (globalThis.__probe ??= {});"];
      for (const n of exportNames(file)) lines.push(n === "default" ? "export default p.default;" : "export const " + n + " = p[" + JSON.stringify(n) + "];");
      lines.push("globalThis.__probeLoad" + i + " = () => import(" + JSON.stringify(file) + ");");
      return { code: lines.join("\\n"), moduleType: "js" };
    },
    buildEnd() {
      const missed = TARGETS.filter((t) => !stubbed.has(t));
      if (missed.length > 0) throw new Error("probe-stub: no import reached " + missed.join(", "));
    },
  }, ...c.plugins];
  return c;
};
`;
}

const startFiles = (manifest) => {
  const files = new Set();
  const seen = new Set();
  const visit = (k) => {
    if (seen.has(k)) return;
    seen.add(k);
    files.add(manifest[k].file);
    for (const d of manifest[k].imports ?? []) visit(d);
  };
  for (const [k, c] of Object.entries(manifest)) if (c.isEntry) visit(k);
  return [...files];
};

let baseGz = null;
let baseRaw = null;
let baseMods = null;
mkdirSync(outRoot, { recursive: true });
for (const v of variants) {
  const targets = v === "base" ? [] : v.split("+");
  const name = v.replace(/[^\w.-]+/g, "_");
  const dir = join(outRoot, name);
  const cfg = join(outRoot, `vite.${name}.config.mts`);
  writeFileSync(cfg, configText(targets));
  if (build) execFileSync("npx", ["vite", "build", "--config", cfg, "--outDir", dir, "--emptyOutDir", "--logLevel", "error"], { cwd: app, stdio: ["ignore", "ignore", "inherit"] });
  const manifest = JSON.parse(readFileSync(join(dir, ".vite/manifest.json"), "utf8"));
  const modules = JSON.parse(readFileSync(join(dir, ".vite/chunk-modules.json"), "utf8"));
  const start = startFiles(manifest);
  let raw = 0;
  let gz = 0;
  const mods = new Set();
  for (const f of start) {
    const b = readFileSync(join(dir, f));
    raw += b.length;
    gz += gzipSync(b).length;
    for (const m of modules[f] ?? []) mods.add(m);
  }
  const js = start.filter((f) => /\.m?js$/.test(f)).length;
  if (v === "base") {
    baseGz = gz;
    baseRaw = raw;
    baseMods = mods;
    console.log(`base: start ${js} JS file(s), ${raw} B raw, ${gz} B gzip, ${mods.size} app modules`);
    // The five modules S58 found missing from LAZY_PARTS: where each sits, and whether size-check.ts's lazyChunk (a dynamic
    // entry with that src, or a shared chunk named after the file) finds a chunk for it; "no" means checkLazyParts would fail.
    const chunks = Object.values(manifest);
    for (const src of LAZY_CHECK) {
      const name = src.replace(/^.*\//, "").replace(/\.[^.]+$/, "");
      const own = chunks.find((c) => c.isDynamicEntry && (c.src ?? "").replace(/^(\.\.\/)+/, "") === src) ?? chunks.find((c) => c.src === undefined && c.name === name);
      const holder = Object.keys(modules).filter((f) => (modules[f] ?? []).includes(src));
      console.log(`  lazy-check ${src}: ${mods.has(src) ? "IN START" : "not in start"}, held by ${holder.join(",") || "-"}, size-check finds a chunk: ${own ? "yes" : "no"}`);
    }
    continue;
  }
  const gone = baseMods === null ? [] : [...baseMods].filter((m) => !mods.has(m));
  const delta = baseGz === null ? "" : `, saves ${baseGz - gz} B gzip (${baseRaw - raw} B raw)`;
  console.log(`${v}: start ${js} JS file(s), ${raw} B raw, ${gz} B gzip${delta}; out of start: ${gone.join(" ") || "-"}`);
}

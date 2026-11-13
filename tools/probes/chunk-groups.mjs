// SPDX-License-Identifier: GPL-3.0-or-later
// S52: does a Rolldown chunk group end the hand copies the start chunk forced? Builds app/ once per variant into
// tools/probes/_out/chunk-groups/<variant>/ and prints, per variant, the start chunk (the entry plus its static imports,
// as size-check.ts sums them: files, raw, gzip) and the chunks that hold a start module's code elsewhere.
//   node tools/probes/chunk-groups.mjs [variant …] [--no-build] [--list]
// --no-build reads the last build of each variant from _out; --list also lists the shared chunks outside the start.
// Default variants: base group restore group+restore. A variant is `base`, `check`, or `group` and/or `restore[:sets]`
// joined by `+` (e.g. `group+restore:lib`):
//   base     the app's own vite.config.ts
//   group    + build.rolldownOptions.output.codeSplitting.groups: one group of every module Rolldown tags `$initial`
//            (statically imported by an entry, transitively), so the start graph stays one chunk
//   check    a group on two lazy i18n tables only (`probecheck`): shows the option reaches Rolldown (a probecheck chunk appears)
//   restore  the hand copies put back as the value imports they replaced, in memory by a transform (the tree is not
//            touched); sets, comma-separated, default all: `lib` calc/library.ts imports the error classes of
//            engine/types.ts and tests them with instanceof; `row` units/row.ts imports a value of state/session.svelte.ts;
//            `backup` state/backup.ts reads MAX_DIGITS and HAPTIC_MS_RANGE from state/session.svelte.ts and KEY_LAYERS
//            from keyboard/userKeys.svelte.ts. A restore that matches nothing stops the build.
// A build takes a few seconds on win99; run the probe under `tools/devlock.sh slice <name> …` all the same.
// Needs app/public/engine (cd app && npm run engine:copy) and the Find index (npm run index). Read-only against the repo;
// writes only to _out/. The size test on a variant's build: node app/scripts/size-check.ts tools/probes/_out/chunk-groups/<dir>.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const app = join(root, "app");
const outRoot = join(root, "tools/probes/_out/chunk-groups");
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const build = !process.argv.includes("--no-build");
const list = process.argv.includes("--list");
const variants = args.length > 0 ? args : ["base", "group", "restore", "group+restore"];

/** In-memory restores: [set, file under app/src, text in the file, replacement]. Each must match once, or the build stops. */
const RESTORES = [
  ["lib", "calc/library.ts", 'import type { MathEngine } from "../engine/types.ts";', 'import { type MathEngine, EngineCancelled, EngineMemoryError, EngineCrashError } from "../engine/types.ts";'],
  ["lib", "calc/library.ts", 'if (name !== "EngineCancelled" && name !== "EngineMemoryError" && name !== "EngineCrashError") await worker.cancel();', "void name; if (!(e instanceof EngineCancelled || e instanceof EngineMemoryError || e instanceof EngineCrashError)) await worker.cancel();"],
  ["row", "units/row.ts", 'import type { HistoryItem, Session } from "../state/session.svelte.ts";', 'import { type HistoryItem, type Session, MAX_DIGITS as PROBE_MAX } from "../state/session.svelte.ts";\n(globalThis as Record<string, unknown>)["probeRow"] = PROBE_MAX;'],
  ["backup", "state/backup.ts", 'import { MIGRATIONS } from "./migrations.ts";', 'import { MIGRATIONS } from "./migrations.ts";\nimport { HAPTIC_MS_RANGE, MAX_DIGITS } from "./session.svelte.ts";\nimport { USER_LAYERS } from "../keyboard/userKeys.svelte.ts";'],
  ["backup", "state/backup.ts", 'export const KEY_LAYERS: readonly string[] = ["primary", "shift", "alpha"];', "export const KEY_LAYERS: readonly string[] = USER_LAYERS;"],
  ["backup", "state/backup.ts", "digits: (x) => whole(x, 1, 30), // MAX_DIGITS", "digits: (x) => whole(x, 1, MAX_DIGITS),"],
  ["backup", "state/backup.ts", "ms: (v) => whole(v, 5, 100), click: bool }), // HAPTIC_MS_RANGE", "ms: (v) => whole(v, HAPTIC_MS_RANGE.min, HAPTIC_MS_RANGE.max), click: bool }),"],
];

function configText(group, restores) {
  return `import base from ${JSON.stringify(join(app, "vite.config.ts"))};
const RESTORES = ${JSON.stringify(restores.map((r) => r.slice(1)))};
const applied = new Set();
export default (env) => {
  const c = base(env);
  const groups = ${JSON.stringify(group)};
  if (groups !== null) c.build = { ...c.build, rolldownOptions: { output: { codeSplitting: { groups: groups.map((g) => ({ ...g, test: g.test === undefined ? undefined : new RegExp(g.test) })) } } } };
  c.plugins = [{
    name: "probe-restore",
    enforce: "pre",
    transform(code, id) {
      let out = code;
      for (const [file, from, to] of RESTORES) {
        if (!id.split("?")[0].endsWith("/src/" + file)) continue;
        if (out.split(from).length !== 2) throw new Error("probe-restore: no single match in " + file + ": " + from);
        out = out.replace(from, () => to);
        applied.add(from);
      }
      return out === code ? null : { code: out, map: null };
    },
    buildEnd() {
      const missed = RESTORES.filter(([, from]) => !applied.has(from));
      if (missed.length > 0) throw new Error("probe-restore: not applied: " + missed.map(([f]) => f).join(", "));
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

for (const v of variants) {
  const group = v.includes("group") ? [{ name: "start", tags: ["$initial"], priority: 100 }] : v === "check" ? [{ name: "probecheck", test: "[\\\\/]src[\\\\/]i18n[\\\\/]en(Data|Find)\\.ts$" }] : null;
  const sets = /restore(?::([a-z,]+))?/.exec(v);
  const restores = sets === null ? [] : RESTORES.filter(([set]) => sets[1] === undefined || sets[1].split(",").includes(set));
  const name = v.replace(/[+:,]/g, "-");
  const dir = join(outRoot, name);
  mkdirSync(outRoot, { recursive: true });
  const cfg = join(outRoot, `vite.${name}.config.mts`);
  writeFileSync(cfg, configText(group, restores));
  if (build) execFileSync("npx", ["vite", "build", "--config", cfg, "--outDir", dir, "--emptyOutDir", "--logLevel", "warn"], { cwd: app, stdio: ["ignore", "ignore", "inherit"] });
  const manifest = JSON.parse(readFileSync(join(dir, ".vite/manifest.json"), "utf8"));
  const modules = JSON.parse(readFileSync(join(dir, ".vite/chunk-modules.json"), "utf8"));
  const start = startFiles(manifest);
  let raw = 0;
  let gz = 0;
  for (const f of start) {
    const b = readFileSync(join(dir, f));
    raw += b.length;
    gz += gzipSync(b).length;
  }
  const chunks = Object.values(manifest).filter((c) => c.file.endsWith(".js"));
  console.log(`${v}: start ${start.length} files, ${raw} B raw, ${gz} B gzip; ${chunks.length} JS chunks in all`);
  for (const f of start) console.log(`  start  ${f}  ${(modules[f] ?? []).length} app modules${(modules[f] ?? []).length === 1 ? ": " + modules[f][0] : ""}`);
  // the lazy chunks that hold an app module the start chunk also needs would show as shared files in `start`; list
  // the shared (no src) chunks outside the start, with their first modules, so a split of the start graph shows
  if (list) for (const c of chunks.filter((c) => c.src === undefined && !start.includes(c.file))) console.log(`  shared ${c.file}  ${(modules[c.file] ?? []).slice(0, 4).join(" ")}`);
}

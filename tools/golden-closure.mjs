#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// tools/golden-closure.mjs (A136): the modules the golden gate runs, one repo-relative path per line: the value-import closure
// of the golden gate's scripts (A277, below; or the entries given), walked over `import … from "./x"`, `export … from "./x"`, `import "./x"` and
// `import("./x")`. A type-only import (`import type`, or a clause of only `type` names) loads nothing and is skipped; so are data
// files (.yaml, .json, .css). Run from anywhere; scripts/pipeline.test.sh checks every path against GOLDEN_RE (pipeline-lib.sh).
// A277: golden_selected plans golden for a file of app/src/input/ or app/src/units/ only when it is in this list, so a walk that misses a
// file would skip a golden round silently. The walk follows relative paths only; a module that imports an app/src file by an alias
// (`@/x`, `~/x`, `#x`, `$x`, `/x`) or a bare path (`src/x`, `app/src/x`, `input/x`) makes it exit 1 with the file and the import named.
// The default entries are every script the golden gate and its engine stages run (the golden gate, the five stages, the behaviour diff),
// and the probe libraries they import are walked with them; entries given on the command line replace them.
//   node tools/golden-closure.mjs [<entry>...]     (GOLDEN_CLOSURE_ROOT: the tree to walk, for the tests)
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.env.GOLDEN_CLOSURE_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRIES = ["golden", "casback", "sweep", "seqsweep", "viewsweep", "findcensus", "behaviour-diff"].map((n) => `app/scripts/${n}.ts`);
const entries = process.argv.length > 2 ? process.argv.slice(2) : ENTRIES;
const FROM = /^\s*(?:import|export)\s+([^;"']*?)\s*from\s*["']([^"']+)["']/gm;
const BARE = /^\s*import\s*["']([^"']+)["']/gm;
const DYNAMIC = /import\(\s*["']([^"']+)["']\s*\)/g;
const srcNames = existsSync(join(root, "app/src")) ? readdirSync(join(root, "app/src")).map((n) => n.replace(/\.[a-z]+$/, "")) : [];

/** Whether a non-relative specifier names a file of app/src (an alias or a bare path) and not a package or `node:`. */
function intoSrc(spec) {
  if (spec.startsWith(".") || spec.startsWith("node:")) return false;
  if (/^(@\/|~|#|\$|\/)/.test(spec)) return true;
  const first = spec.split("/")[0];
  return first === "src" || first === "app" || srcNames.includes(first);
}

/** Whether an import clause loads the module: not `type X`, and not `{ type A, type B }` only. */
function isValue(clause) {
  const c = clause.trim();
  if (/^type\s/.test(c)) return false;
  const m = /^([^{]*)\{([^}]*)\}\s*$/s.exec(c);
  if (m && m[1].replace(/,/g, "").trim() === "") {
    const names = m[2].split(",").map((s) => s.trim()).filter(Boolean);
    if (names.length > 0 && names.every((n) => /^type\s/.test(n))) return false;
  }
  return true;
}
const code = (file, text) => (file.endsWith(".svelte") ? [...text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n") : text);
function resolveSpec(from, spec) {
  const p = normalize(join(dirname(from), spec));
  return [p, `${p}.ts`, `${p}/index.ts`].find((c) => existsSync(join(root, c)) && /\.[a-z]+$/.test(c) && !c.endsWith("/")) ?? null;
}

for (const entry of entries) {
  if (!existsSync(join(root, entry))) {
    console.error(`golden-closure: entry ${entry} not found under ${root}`);
    process.exit(1);
  }
}
const seen = new Set();
const stack = [...entries];
while (stack.length > 0) {
  const f = stack.pop();
  if (seen.has(f) || !existsSync(join(root, f))) continue;
  seen.add(f);
  const text = code(f, readFileSync(join(root, f), "utf8"));
  const specs = [...text.matchAll(FROM)].filter((m) => isValue(m[1])).map((m) => m[2]);
  specs.push(...[...text.matchAll(BARE)].map((m) => m[1]), ...[...text.matchAll(DYNAMIC)].map((m) => m[1]));
  for (const s of specs) {
    if (intoSrc(s)) {
      console.error(`golden-closure: ${f} imports "${s}", an alias or bare path into app/src: the walk follows relative paths only`);
      process.exit(1);
    }
    if (!s.startsWith(".")) continue;
    const r = resolveSpec(f, s);
    if (r && !/\.(yaml|json|css)$/.test(r)) stack.push(relative(".", r));
  }
}
console.log([...seen].sort().join("\n"));

#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// tools/golden-closure.mjs (A136): the modules the golden gate runs, one repo-relative path per line: the value-import closure
// of app/scripts/golden.ts (or the entry given), walked over `import … from "./x"`, `export … from "./x"`, `import "./x"` and
// `import("./x")`. A type-only import (`import type`, or a clause of only `type` names) loads nothing and is skipped; so are data
// files (.yaml, .json, .css). Run from anywhere; scripts/pipeline.test.sh checks every path against GOLDEN_RE (pipeline-lib.sh).
//   node tools/golden-closure.mjs [<entry>]
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.env.GOLDEN_CLOSURE_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entry = process.argv[2] ?? "app/scripts/golden.ts";
const FROM = /^\s*(?:import|export)\s+([^;"']*?)\s*from\s*["'](\.[^"']+)["']/gm;
const BARE = /^\s*import\s*["'](\.[^"']+)["']/gm;
const DYNAMIC = /import\(\s*["'](\.[^"']+)["']\s*\)/g;

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

const seen = new Set();
const stack = [entry];
while (stack.length > 0) {
  const f = stack.pop();
  if (seen.has(f) || !existsSync(join(root, f))) continue;
  seen.add(f);
  const text = code(f, readFileSync(join(root, f), "utf8"));
  const specs = [...text.matchAll(FROM)].filter((m) => isValue(m[1])).map((m) => m[2]);
  specs.push(...[...text.matchAll(BARE)].map((m) => m[1]), ...[...text.matchAll(DYNAMIC)].map((m) => m[1]));
  for (const s of specs) {
    const r = resolveSpec(f, s);
    if (r && !/\.(yaml|json|css)$/.test(r)) stack.push(relative(".", r));
  }
}
console.log([...seen].sort().join("\n"));

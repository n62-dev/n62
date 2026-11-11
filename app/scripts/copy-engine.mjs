// SPDX-License-Identifier: GPL-3.0-or-later
// Copy the Giac engine build into app/public/engine/ (gitignored), where giac.worker.ts loads it.
// Source: $GIAC_OUT (e.g. the main checkout's build when working in a git worktree), else
// engine/giac/_out/$GIAC_VARIANT (default gsl) in this checkout. Build it with engine/giac/build-wasm.sh.
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ENGINE_FILES = ["giac.mjs", "giac.wasm"];

/**
 * Copies giac.mjs and giac.wasm from `src` to `dest`, each one whose bytes differ (so `npm run dev` stays instant when
 * nothing changed). By content, not size and time: two builds give a giac.mjs of the same size (only the EM_ASM
 * addresses move), and a copy is newer than a build made before it, so a size-and-time test kept one build's giac.mjs
 * beside another's giac.wasm ("ASM_CONSTS[code] is not a function" at init; G318 run 966, every e2e test red).
 * Returns the names copied; throws when a file is missing from `src`.
 */
export function copyEngine(src, dest) {
  for (const f of ENGINE_FILES) {
    if (!existsSync(join(src, f))) throw new Error(`engine:copy: missing ${join(src, f)}; run engine/giac/build-wasm.sh or set GIAC_OUT`);
  }
  mkdirSync(dest, { recursive: true });
  const copied = [];
  for (const f of ENGINE_FILES) {
    const from = join(src, f);
    const to = join(dest, f);
    if (existsSync(to) && statSync(to).size === statSync(from).size && readFileSync(to).equals(readFileSync(from))) continue;
    copyFileSync(from, to);
    copied.push(f);
  }
  return copied;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = join(dirname(fileURLToPath(import.meta.url)), "..");
  const src = process.env.GIAC_OUT ?? join(app, "..", "engine/giac/_out", process.env.GIAC_VARIANT ?? "gsl");
  try {
    copyEngine(src, join(app, "public/engine"));
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
  console.log(`engine:copy: ${src} -> public/engine/`);
}

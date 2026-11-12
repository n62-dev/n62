// SPDX-License-Identifier: GPL-3.0-or-later
// G323 (F223): tools/giac-regress/run.mjs gives every file its own fresh engine, so a file's result never depends on the files before it.
//   node tests/engine/regress-order-test.mjs      # engine: GIAC_MJS, GIAC_OUT or engine/giac/_out/gsl (nodeGiac)
// 1. Two scratch files: the first leaves Digits at 40, the second requires Digits 12 (the engine's start value). On one shared engine
//    the second fails; on a fresh engine it passes. Digits is the state the real patched file leaves (40 after its last line; fresh: 12).
// 2. The real files: n62-known.cas has the same counts alone and after n62-patched.cas (the erf lines of F223 fail in both orders).
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const run = new URL("../../tools/giac-regress/run.mjs", import.meta.url).pathname;
const exec = (...files) => spawnSync(process.execPath, [run, ...files], { encoding: "utf8", timeout: 300_000, env: process.env });
const lineOf = (out, f) => out.split("\n").find((l) => l.startsWith(`${f}: `) && /passed/.test(l))?.replace(/, [\d.]+ s/, "") ?? `(no line for ${f})`;
const bad = [];

const pcDef = `pc(id,v,e,tol):={ local d,g,ok; pasn:=pasn+1; ok:=0; try { g:=eval(v); d:=abs(evalf(g-e)); if (d<=tol) { ok:=1; } } catch (err) { ok:=0; } if (ok==0) { pasfail:=pasfail+1; print("FAIL "+id); return 0; } return 1; }:;`;
const dir = mkdtempSync(join(tmpdir(), "regress-order-"));
try {
  const a = join(dir, "ord-a-check.cas");
  const b = join(dir, "ord-b-check.cas");
  writeFileSync(a, `pasn:=0:; pasfail:=0:;\n${pcDef}\nDigits:=40:;\npc("a-one",'(1)',1,1/10);\n`);
  writeFileSync(b, `pasn:=0:; pasfail:=0:;\n${pcDef}\npc("b-digits-fresh",'(Digits)',12,1/10);\n`);
  const r = exec(a, b);
  const out = `${r.stdout}${r.stderr}`;
  const la = lineOf(out, a);
  const lb = lineOf(out, b);
  if (!la.includes("1 passed, 0 failed")) bad.push(`scratch file A: ${la}`);
  if (!lb.includes("1 passed, 0 failed")) bad.push(`scratch file B after A (Digits leaked from A): ${lb}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const known = "n62-known.cas";
const alone = lineOf(`${exec(known).stdout}`, known);
const after = lineOf(`${exec("n62-patched.cas", known).stdout}`, known);
if (alone !== after) bad.push(`${known} alone: ${alone}; after n62-patched.cas: ${after}`);
if (!alone.includes("0 passed")) bad.push(`${known} alone: ${alone} (every line must fail)`);

if (bad.length) {
  for (const x of bad) console.log(`FAIL regress-order-test: ${x}`);
  process.exit(1);
}
console.log(`PASS regress-order-test: fresh engine per file; ${known} ${alone}`);

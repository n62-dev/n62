// SPDX-License-Identifier: GPL-3.0-or-later
// S54 (F214): which inputs overflow the stack in Giac's subst.cc decompose. Each input runs on the raw engine (plain giac.eval,
// as MODE=raw tools/probes/engine.ts) in a child process of its own, since a stack overflow leaves the module unusable:
//   node tools/probes/decompose/run.ts 'simplify(...)' ...           # one line per input: OVERFLOW, TIMEOUT or the answer
//   PRE='Digits:=40' node tools/probes/decompose/run.ts ...           # PRE: inputs evaluated first in the same child (';'-separated)
//   node tools/probes/decompose/run.ts --set shrink|digits|forms     # the sets the note's tables come from (sets.ts)
// Engine: $GIAC_MJS, else $GIAC_OUT/giac.mjs, else engine/giac/_out/gsl (app/src/engine/nodeGiac.ts).
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { SETS } from "./sets.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const T = Number(process.env.TIMEOUT_S ?? 60);

if (process.argv[2] === "--child") {
  const { loadNodeGiac } = await import("../../../app/src/engine/nodeGiac.ts");
  const { giac } = await loadNodeGiac();
  const pre = (process.env.PRE ?? "").split(";").filter((s) => s.trim() !== "");
  for (const p of pre) giac.eval(p);
  const t0 = performance.now();
  const out = giac.eval(process.argv[3]);
  process.stdout.write(JSON.stringify({ out, ms: Math.round(performance.now() - t0) }));
  process.exit(0);
}

/** One input in a fresh child: its answer, OVERFLOW (V8's stack overflow inside the wasm), TIMEOUT, or ERROR with the first line. */
export function classify(input: string, pre = process.env.PRE ?? ""): string {
  const r = spawnSync(process.execPath, [`${here}run.ts`, "--child", input], {
    env: { ...process.env, PRE: pre }, encoding: "utf8", timeout: T * 1000, maxBuffer: 64 << 20,
  });
  if (r.error && (r.error as NodeJS.ErrnoException).code === "ETIMEDOUT") return `TIMEOUT (${T} s)`;
  if (r.status === 0) {
    const { out, ms } = JSON.parse(r.stdout) as { out: string; ms: number };
    return `${out.length > 160 ? `${out.slice(0, 160)}… (${out.length} chars)` : out}  [${ms} ms]`;
  }
  if (/Maximum call stack size exceeded/.test(r.stderr)) return "OVERFLOW";
  return `ERROR ${r.stderr.split("\n").find((l) => /Error/.test(l)) ?? r.stderr.slice(0, 200)}`;
}

const args = process.argv.slice(2);
const rows: [string, string][] = args[0] === "--set" ? SETS[args[1]] ?? [] : args.map((a) => [a, process.env.PRE ?? ""]);
if (args[0] === "--set" && rows.length === 0) throw new Error(`no set ${args[1]}: ${Object.keys(SETS).join(", ")}`);
for (const [input, pre] of rows) console.log(`${pre ? `[${pre}] ` : ""}${input}\n    => ${classify(input, pre)}`);

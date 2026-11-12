// SPDX-License-Identifier: GPL-3.0-or-later
// S54: one input on a traced engine, with Giac's stderr (nodeGiac.ts drops it). The traced engine is a scratch build with
// trace-decompose.patch (beside this file) added after patches 0001-0044, linked with function names:
//   cp -r engine/giac/{build-wasm.sh,patches,wasm} /tmp/eng && cp tools/probes/decompose/trace-decompose.patch /tmp/eng/patches/9999-trace.patch
//   ln -s <main checkout>/engine/giac/_build/prefix /tmp/build/prefix     # GMP, MPFR, GSL as built there
//   EMCC_CFLAGS=--profiling-funcs GIAC_BUILD_DIR=/tmp/build GIAC_BUILD_OUT=/tmp/out tools/devlock.sh slice <name> /tmp/eng/build-wasm.sh giac
//   (the same with `link`; with guard-candidate.patch added too, the same inputs answer), then: GIAC_MJS=/tmp/out/gsl/giac.mjs node tools/probes/decompose/trace.ts '<input>' [max lines]
// Prints the patch's N62 lines (tsimplify_common's ln arguments, each decompose call to depth 8 and every 1000th level) and,
// on a stack overflow, the named frames that are not decompose.
import { writeSync } from "node:fs";
import { setGiacHostGlobals } from "../../../app/src/engine/host.ts";

const say = (s: string): void => void writeSync(1, `${s}\n`); // synchronous: a killed run keeps its lines
const mjs = process.env.GIAC_MJS ?? `${process.env.GIAC_OUT}/giac.mjs`;
const max = Number(process.argv[3] ?? 200);
let n = 0;
setGiacHostGlobals(); // as nodeGiac.ts loadNodeGiac does
const { default: create } = (await import(mjs)) as { default: (o: object) => Promise<{ cwrap: (...a: unknown[]) => (...a: unknown[]) => unknown }> };
const M = await create({ print: () => {}, printErr: (s: string) => { if (n++ < max) say(s); } });
M.cwrap("giac_init", "number", [])();
const ev = M.cwrap("giac_eval", "string", ["string"]) as (s: string) => string;
for (const p of (process.env.PRE ?? "").split(";").filter((x) => x.trim() !== "")) ev(p); // e.g. PRE='timeout 4;ckevery 10': the clock ends a hang
try {
  say(`=> ${ev(process.argv[2])}`);
} catch (e) {
  const st = e instanceof Error ? e.stack ?? "" : String(e);
  say(String(e).split("\n")[0]);
  say(st.split("\n").filter((l) => /giac::/.test(l) && !/giac::decompose\(/.test(l)).slice(0, 12).map((l) => l.replace(/\(wasm:.*$/, "")).join("\n"));
  say(`decompose frames in the stack trace: ${st.split("\n").filter((l) => /giac::decompose\(/.test(l)).length}`);
}
say(`stderr lines: ${n}`);

// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (t3-research, S90/S95): the engine's footprint for a new platform (iOS WKWebView, a desktop shell).
// What it answers, in Node on this machine (a desktop CPU, not a phone):
//   - giac.wasm and giac.mjs bytes: raw, gzip -9, brotli q11 (what a download or an app bundle carries);
//   - WebAssembly.compile time of the wasm alone, and the full load (instantiate + giac_init) as the app's worker does it;
//   - the wasm memory (linear heap) after init and after each workload; it only grows, so the last line is the peak;
//   - the process RSS beside it (Node's own share included, so an upper bound for the engine's).
// Run: GIAC_OUT=<abs dir> node tools/probes/platform-footprint.ts [--runs N] [--heavy] [--grow]
//   --heavy adds the stress inputs (big factorisations, 2000-digit evalf, a 60x60 determinant); without it, the
//   everyday inputs of the core list's kind only. Heavy CPU: run it under tools/devlock.sh slice.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gzipSync, brotliCompressSync, constants } from "node:zlib";
import { loadNodeGiac, giacMjsPath } from "../../app/src/engine/nodeGiac.ts";
import { EngineHost } from "../../app/src/engine/host.ts";
import { defaultHomeSettings } from "../../app/src/engine/homeEval.ts";
import { defaultCasSettings } from "../../app/src/engine/types.ts";

const args = process.argv.slice(2);
const runs = Number(args[args.indexOf("--runs") + 1] || 0) || 3;
const heavy = args.includes("--heavy");
const MB = (n: number): string => (n / 1048576).toFixed(1);
const kB = (n: number): string => (n / 1024).toFixed(0);

const mjs = giacMjsPath();
const dir = dirname(mjs);
for (const f of ["giac.wasm", "giac.mjs"]) {
  const b = readFileSync(join(dir, f));
  const gz = gzipSync(b, { level: 9 }).length;
  const br = brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
  console.log(`${f}: raw ${kB(b.length)} kB, gzip ${kB(gz)} kB, brotli ${kB(br)} kB`);
}

const wasm = readFileSync(join(dir, "giac.wasm"));
const compiles: number[] = [];
for (let i = 0; i < runs; i++) {
  const t = performance.now();
  await WebAssembly.compile(wasm);
  compiles.push(performance.now() - t);
}
console.log(`WebAssembly.compile: ${compiles.map((x) => x.toFixed(0)).join(", ")} ms (runs ${runs})`);

const rss0 = process.memoryUsage().rss;
const L = await loadNodeGiac(mjs);
console.log(`load (import + instantiate + giac_init): ${L.instantiateMs.toFixed(0)} ms`);
console.log(`after init: wasm heap ${MB(L.heapBytes())} MB, RSS +${MB(process.memoryUsage().rss - rss0)} MB`);

const host = new EngineHost(L.giac, L.bridge);
const home = { ...defaultHomeSettings, digits: 12, workDigits: 30 };
const cas = { ...defaultCasSettings, digits: 12 };
type Job = [label: string, run: () => unknown];
const everyday: Job[] = [
  ["home sin(1)", () => host.home("sin(1)", home)],
  ["home 2^100/3", () => host.home("2^100/3", home)],
  ["home sqrt(2)*pi", () => host.home("sqrt(2)*pi", home)],
  ["home 30 digits exp(1)", () => host.home("exp(1)", { ...home, digits: 30, workDigits: 40 })],
  ["cas factor(x^4-1)", () => host.cas("factor(x^4-1)", cas)],
  ["cas int(x*sin(x),x)", () => host.cas("int(x*sin(x),x)", cas)],
  ["cas solve(x^3-2x+1=0,x)", () => host.cas("solve(x^3-2*x+1=0,x)", cas)],
  ["cas inverse 6x6 hilbert", () => host.cas("inv(hilbert(6))", cas)],
];
const stress: Job[] = [
  ["raw evalf(pi,2000)", () => L.giac.eval("evalf(pi,2000)")],
  ["raw factor(x^120-1)", () => L.giac.eval("factor(x^120-1)")],
  ["raw ifactor(2^128+1)", () => L.giac.eval("ifactor(2^128+1)")],
  ["raw det(ranm(60,60))", () => L.giac.eval("det(ranm(60,60))")],
  ["raw 200!", () => L.giac.eval("200!")],
  ["raw int(1/(x^8+1),x)", () => L.giac.eval("int(1/(x^8+1),x)")],
  ["raw plotfunc points 2000", () => L.giac.eval("seq(evalf(sin(k/100.)*exp(-k/1000.)),k,0,2000)")],
];
// --grow: inputs past any everyday use, to see where the heap leaves its initial 64 MB (what a phone's cap must hold).
const grow: Job[] = [
  ["raw evalf(pi,100000)", () => L.giac.eval("evalf(pi,100000)")],
  ["raw 20000!", () => L.giac.eval("length(string(20000!))")],
  ["raw factor(x^720-1)", () => L.giac.eval("factor(x^720-1)")],
  ["raw det(ranm(150,150))", () => L.giac.eval("det(ranm(150,150))")],
  ["raw expand((x+y+z+1)^40)", () => L.giac.eval("size(expand((x+y+z+1)^40))")],
  ["raw expand((x+y+z+w+1)^30)", () => L.giac.eval("size(expand((x+y+z+w+1)^30))")],
  ["raw evalf(pi,1000000)", () => L.giac.eval("size(string(evalf(pi,1000000)))")],
];
const jobs = [...everyday, ...(heavy ? stress : []), ...(args.includes("--grow") ? grow : [])];
for (const [label, run] of jobs) {
  const t = performance.now();
  run();
  console.log(`${label.padEnd(28)} ${(performance.now() - t).toFixed(1).padStart(8)} ms  heap ${MB(L.heapBytes())} MB  RSS +${MB(process.memoryUsage().rss - rss0)} MB`);
}
console.log(`peak wasm heap (it never shrinks): ${MB(L.heapBytes())} MB; build cap -sMAXIMUM_MEMORY=1GB, initial 64MB (engine/giac/build-wasm.sh:267)`);

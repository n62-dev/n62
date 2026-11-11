// SPDX-License-Identifier: GPL-3.0-or-later
// G170 regression test for patch 0042 (backlog F89), on the raw engine. Stock `ilaplace` calls `ilaplace2`
// (signalprocessing.cc), which stores an assumption on a local name ` n` with `sto`; the variable table keys the entry
// by the name's character pointer (usual.cc `sto`, `(*symtabptr)[name]=aa`) and nothing purges it, so when the local
// name dies the table keeps an entry whose name is freed memory: VARS() after ilaplace(1/(x^2+1)) printed `[^A,pasdeg]`,
// whose bytes changed after every later call. With 0042 the assumption lives only around the sum that reads it and is
// purged on the way out (an error too), so VARS() is what it was. Needs the engine build (GIAC_OUT or GIAC_MJS, as
// nodeGiac.ts).
//   GIAC_OUT=<abs dir> node tests/engine/ilaplace-vars-test.ts
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";

// [input, Giac's text] (source: derived): the Laplace pairs L{sin t} = 1/(s²+1), L{(sin t - t cos t)/2} = 1/(s²+1)²,
// the shift L{f(t-1)H(t-1)} = e^-s F(s), and Σ_{k≥0} L{H(t-k)} = 1/(s(1-e^-s)), whose sum is floor(t)+1 for t ≥ 0 (the
// path that reads the assumption on ` n`; Giac's text is the stock build's, which the patch must keep).
const CASES: [string, string][] = [
  ["ilaplace(1/(x^2+1))", "sin(x)"],
  ["ilaplace(1/(s^2+1),s,t)", "sin(t)"],
  ["ilaplace(1/(x^2+1)^2)", "-x/2*cos(x)+1/2*sin(x)"],
  ["ilaplace(exp(-s)/(s^2+1),s,t)", "sin(t-1)*Heaviside(t-1)"],
  ["ilaplace(1/(s*(1-exp(-s))),s,t)", "1+floor(t)*Heaviside(t-1)"],
];
// guard: laplace purges its own temporary name (desolve.cc `purgenoassume(t)`); passes on the stock build too
const GUARD: [string, string] = ["laplace(sin(t),t,s)", "1/(s^2+1)"];

const { giac } = await loadNodeGiac();
const failures: string[] = [];
const names = (): string => giac.eval("VARS()");
// each entry: [is it a name, its text]; a name's text is printable and not empty
const entries = (): string => giac.eval("map(VARS(),k->[type(k)==DOM_IDENT,string(k)])");
const broken = (list: string): string | null => {
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f-\u009f�]/.test(list)) return "an entry holds bytes that are not text";
  const items = [...list.matchAll(/\[(true|false),"([^"]*)"\]/g)];
  if (items.some((m) => m[1] !== "true")) return "an entry is not a name";
  if (items.some((m) => m[2] === "" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(m[2]!))) return "an entry's name is empty or not a plain name";
  return null;
};

giac.eval("purge(aa)");
giac.eval("aa:=5"); // a user's name, kept through every case
const before = names();
if (!/^\[(.*,)?aa(,.*)?\]$/.test(before)) failures.push(`VARS() before = ${before}, expected the user's aa in it`);
// the guard first, on the clean engine: it passes on the stock build
for (const [input, want] of [GUARD, ...CASES]) {
  const got = giac.eval(input);
  if (got !== want) failures.push(`${input} = ${got}, expected ${want}`);
  for (const when of ["after", "after 1+1 after"]) {
    if (when !== "after") giac.eval("1+1");
    const now = names();
    if (now !== before) failures.push(`VARS() ${when} ${input} = ${JSON.stringify(now)}, expected ${before}`);
    const why = broken(entries());
    if (why) failures.push(`VARS() ${when} ${input}: ${why}`);
  }
}
giac.eval("purge(aa)");
if (failures.length) {
  console.log(`FAIL ilaplace-vars-test ${failures.length}\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`PASS ilaplace-vars-test: ${CASES.length} ilaplace inputs and laplace leave VARS() as it was, every entry a name`);

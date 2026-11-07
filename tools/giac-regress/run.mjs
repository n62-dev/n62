// SPDX-License-Identifier: GPL-3.0-or-later
// G89: runs n62-check.cas, n62-known.cas and n62-patched.cas line by line on a Giac build (nodeGiac) and counts.
//   GIAC_OUT=<dir> node tools/giac-regress/run.mjs [file.cas …]     exit 1 when a check line fails, a known line passes, or a patched line fails on the patched build
// (on a stock build a patched line is expected to fail; one that passes there is reported: patches 0003/0005/0006/0007/0009/0010/0011/0012/0013/0014/0015/0016/0017/0018/0019/0020/0021/0022/0023/0024/0025/0026/0027/0028/0029/0030/0031/0032/0033/0034/0035/0036/0037 may no longer be needed)
// A line passes when pc() returns 1; a line that errors (or is stopped by the timeout) counts as failed. A line that traps the engine
// (stock Giac on the g188-int-* lines, G188f2) counts as failed and the run goes on in a fresh engine with the file's preamble (lines.mjs);
// in the whole-file pass a trap is "trapped (stock)" for the patched file on a stock build (expected) and a failure otherwise.
import { readFileSync } from "node:fs";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import { runLines, runWhole } from "./lines.mjs";

const load = async () => {
  const { giac: g } = await loadNodeGiac();
  g.eval("timeout 120");
  return g;
};
let giac = await load();
const stockOf = {}; // file -> true when it is the patched file and the build is stock (its lines are expected to fail, a trap too)
const counts = {}; // file -> [pass, fail] of the line-by-line run
const files = process.argv.slice(2).length ? process.argv.slice(2) : ["n62-check.cas", "n62-known.cas", "n62-patched.cas"];
let bad = 0;
let isPatched = true;
for (const f of files) {
  const known = f.includes("known");
  const patchedFile = f.includes("patched");
  if (patchedFile) {
    // Canaries of patches 0005 (tests/engine/mpfr-pi-test.ts) and 0003 (tanh-test.ts): the imaginary part of ln(-pi) is pi to 30
    // digits, and tanh(1+i) has the real part 1.0839…; stock Giac prints a double pi and coth.
    giac.eval("Digits:=30");
    const lnPi = giac.eval("im(evalf(ln(-pi)))").trim();
    const tanh = giac.eval("re(evalf(tanh(1+i)))").trim();
    giac.eval("Digits:=12");
    const reim = giac.eval("subst(im(2*sqrt(x)),x,-1)").trim(); // patch 0006: 2 (stock Giac: 0)
    const support = giac.eval("exponential(2,-1)").trim(); // patch 0007: 0 (stock Giac: 2*exp(2))
    const icdf = giac.eval("negbinomial_icdf(3,1/2,1/5)").trim(); // patch 0009: 1 (stock Giac: 0)
    isPatched = lnPi.startsWith("3.14159265358979323846264338328") && tanh.startsWith("1.0839233273386945434757520612") && reim === "2" && support === "0" && icdf === "1";
    console.log(isPatched ? `${f}: these lines fail on stock giac_2.1.0-1; this build is the patched one (our patches 0003, 0005, 0006, 0007, 0009, 0010, 0011, 0012, 0013, 0014, 0015, 0016, 0017, 0018, 0019, 0020, 0021, 0022, 0023, 0024, 0025, 0026, 0027, 0028, 0029, 0030, 0031, 0032, 0033, 0034, 0035, 0036, 0037), every line must pass` : `${f}: stock build: patched lines expected to fail (ln(-pi) im ${lnPi}, tanh(1+i) re ${tanh})`);
  }
  const t0 = performance.now();
  let pass = 0;
  let fail = 0;
  const wrong = [];
  stockOf[f] = patchedFile && !isPatched;
  const run = await runLines(readFileSync(new URL(f, import.meta.url), "utf8"), giac, load);
  giac = run.engine;
  const trapped = run.results.filter((r) => r.trapped).length;
  for (const { id, ok, out } of run.results) {
    if (ok) pass++;
    else fail++;
    if (patchedFile && !isPatched) {
      if (ok) wrong.push(`${id}: passes on stock, patches 0003/0005/0006/0007/0009/0010/0011/0012/0013/0014/0015/0016/0017/0018/0019/0020/0021/0022/0023/0024/0025/0026/0027/0028/0029/0030/0031/0032/0033/0034/0035/0036/0037 may no longer be needed`);
    } else if (ok === known || (!ok && !known)) wrong.push(`${id}: ${out.slice(0, 120)}`);
  }
  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  console.log(`${f}: ${pass} passed, ${fail} failed${trapped ? ` (${trapped} trapped the engine, run on in a fresh one)` : ""}, ${secs} s${known ? " (every line must fail)" : ""}`);
  counts[f] = [pass, fail];
  for (const w of wrong) console.log(`  ${known || (patchedFile && !isPatched) ? "PASSES" : "FAILS"} ${w}`);
  bad += wrong.length;
}

// Whole file: each file as one text in a fresh Giac, the way icas reads a file; pasn and pasfail must equal the line counts.
for (const f of files) {
  const t0 = performance.now();
  const whole = await runWhole(readFileSync(new URL(f, import.meta.url), "utf8"), load);
  const secsWhole = ((performance.now() - t0) / 1000).toFixed(1);
  if ("trapped" in whole) {
    // stock Giac traps on the g188-int-* lines; on the patched build, or in another file, a trap is a failure
    console.log(`${f} as one text: ${stockOf[f] ? "trapped (stock)" : "TRAPPED"}: ${whole.trapped}, ${secsWhole} s`);
    if (!stockOf[f]) bad++;
    continue;
  }
  const { n, failed } = whole;
  const [pass, fail] = counts[f];
  const same = n === pass + fail && failed === fail;
  console.log(`${f} as one text: pasn ${n}, pasfail ${failed}, ${secsWhole} s${same ? "" : ` DIFFERS from line by line (${pass + fail}, ${fail})`}`);
  if (!same) bad++;
}
process.exit(bad ? 1 : 0);

// SPDX-License-Identifier: GPL-3.0-or-later
// G340 (F228): which commands give a wrong value for a square root over a field Giac writes as a rootof. For each input x and
// command c (normal, simplify, factor, ratnormal, expand, and the input alone), c(x) is compared with x at Digits 30:
//   raw   plain giac.eval of evalf(c(x),30) against evalf(x,30) (Giac's own clock: 10 s per input, so a hang reads TIMEOUT)
//   home  Home's Enter (host.home, 12 digits): its value against evalf(x,30) to 10 digits, and its mark (⚠ when warned)
//   cas   the CAS view's Enter (host.cas, its clock at 10 s for the probe): evalf of its text at Digits 30 against evalf(x,30)
// A row prints `ok` or `WRONG` per column, and Home's display. Engine: $GIAC_MJS, else $GIAC_OUT/giac.mjs (nodeGiac.ts).
//   node tools/probes/decompose/reach.ts                 # the set below
//   node tools/probes/decompose/reach.ts 'sqrt(1+sqrt(1+2^(1/3)))' …
import { EngineHost } from "../../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings } from "../../../app/src/engine/homeEval.ts";
import { defaultCasSettings } from "../../../app/src/engine/types.ts";
import type { DecimalValue } from "../../../app/src/engine/format.ts";

const R = "sqrt(1+sqrt(1+2^(1/3)))";
const INPUTS = [
  R, "sqrt(1+sqrt(1+3^(1/3)))", "sqrt(1+sqrt(1+2^(1/4)))", "sqrt(2+sqrt(1+2^(1/3)))", "sqrt(2*sqrt(1+2^(1/3)))",
  "sqrt(1+2^(1/3)+sqrt(1+2^(1/3)))", "sqrt(2^(1/3)+3^(2/3))", "(1+sqrt(1+2^(1/3)))^(1/3)",
  // r20 risk 1: a nested root R and ln(R) in one input
  `${R}+ln(${R})`, `ln(${R})/${R}`, `${R}*ln(1+${R})`, `ln(1+sqrt(1+2^(1/3)))+sqrt(1+2^(1/3))`,
  // guards
  "sqrt(1+sqrt(2))", "sqrt(1+2^(1/3))", "1+sqrt(1+2^(1/3))", "sqrt(1+sqrt(1+sqrt(2)))",
];
const COMMANDS = ["", "normal", "simplify", "factor", "ratnormal", "expand"];

const { giac, bridge } = await loadNodeGiac();
const host = new EngineHost(giac, bridge);
const raw = (s: string): string => {
  giac.eval("Digits:=30");
  giac.eval("timeout 10");
  const r = giac.eval(s).trim();
  giac.eval("Digits:=12");
  return r;
};
const close = (a: string, b: string, tol: string): boolean => raw(`evalf(abs((${a})-(${b}))<${tol}*(1+abs(${b})))`) === "true";
const dec = (v: DecimalValue): string => (v.digits === "" ? "0" : `${v.neg ? "-" : ""}0.${v.digits}e${v.exp + 1}`);

const inputs = process.argv.slice(2).length ? process.argv.slice(2) : INPUTS;
console.log("command(input) | raw | home | cas | Home shows");
for (const x of inputs) {
  const ref = raw(`evalf(${x},30)`);
  for (const c of COMMANDS) {
    const call = c ? `${c}(${x})` : x;
    const r = raw(`evalf(${call},30)`);
    const rawOk = /^GIAC_ERROR|timeout|Timeout/.test(r) ? "TIMEOUT" : close(r, ref, "10^-25") ? "ok" : "WRONG";
    const h = host.home(call, { ...defaultHomeSettings, digits: 12, workDigits: 30 }).result;
    const hv = h.value ? `(${dec(h.value.re)})+(${dec(h.value.im)})*i` : "";
    const warned = h.facts?.warn !== undefined;
    const homeOk = !h.ok ? `refused` : hv && close(hv, ref, "10^-10") ? "ok" : warned ? "differs ⚠" : "WRONG";
    const cr = host.cas(call, { ...defaultCasSettings, digits: 12, hardTimeoutS: 10 }).result;
    const cv = cr.ok && cr.text ? raw(`evalf(${cr.text},30)`) : "";
    const casOk = !cr.ok ? "refused" : cv && close(cv, ref, "10^-25") ? "ok" : "WRONG";
    console.log(`${call} | ${rawOk} | ${homeOk} | ${casOk} | ${warned ? "⚠ " : h.facts?.exact ? "= " : "≈ "}${h.display ?? h.error ?? ""}`);
  }
}

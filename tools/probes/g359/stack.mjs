// SPDX-License-Identifier: GPL-3.0-or-later
// G359: the wasm stack of a trapping input (a build linked with --profiling-funcs names the functions).
//   GIAC_OUT=<dir> node tools/probes/g359/stack.mjs 'proot([1,0,10^400,1])'
const { default: create } = await import(`${process.env.GIAC_OUT}/giac.mjs`);
globalThis.UI = { add_evalf: 0, js_bigint: 0, disable3d: -1, Datestart: Date.now() };
const M = await create({ print: () => {}, printErr: () => {} });
M.cwrap("giac_init", "number", [])();
const ev = M.cwrap("giac_eval", "string", ["string"]);
Error.stackTraceLimit = 80;
try { for (const s of process.argv.slice(2)) console.log(ev(s)); } catch (e) { console.log(String(e.stack)); }

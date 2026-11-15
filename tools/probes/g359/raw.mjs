// SPDX-License-Identifier: GPL-3.0-or-later
// G359: each argument in a fresh raw engine (plain giac_eval), so a trap of one input does not hide the next.
//   GIAC_OUT=<dir> node tools/probes/g359/raw.mjs 'Digits:=12;solve(...)' ...   (';;' separates inputs evaluated in the same engine)
const out = process.env.GIAC_OUT;
for (const arg of process.argv.slice(2)) {
  const { default: create } = await import(`${out}/giac.mjs?${Math.random()}`);
  globalThis.UI = { add_evalf: 0, js_bigint: 0, disable3d: -1, Datestart: Date.now() };
  const M = await create({ print: () => {}, printErr: (s) => { if (process.env.ALLERR || String(s).includes("G359")) console.log(s); } });
  M.cwrap("giac_init", "number", [])();
  const ev = M.cwrap("giac_eval", "string", ["string"]);
  for (const s of arg.split(";;")) {
    try { console.log(`${s} => ${ev(s).slice(0, 400)}`); }
    catch (e) { console.log(`${s} => TRAP ${String(e).split("\n")[0]}`); break; }
  }
}

// SPDX-License-Identifier: GPL-3.0-or-later
// vg hunter: smoke.mjs copy that loads GIAC_OUT (default main checkout _out/gsl). Usage: node smoke.mjs '<expr>' ...
const dir = process.env.GIAC_OUT ?? new URL("../../../../engine/giac/_out/gsl", import.meta.url).pathname;
const { default: createGiacModule } = await import(`${dir}/giac.mjs`);
globalThis.UI = { add_evalf: 0, js_bigint: 0, disable3d: -1, Datestart: Date.now() };
const M = await createGiacModule({ print: () => {}, printErr: () => {} });
M.cwrap("giac_init", "number", [])();
const evalS = M.cwrap("giac_eval", "string", ["string"]);
for (const s of process.argv.slice(2)) {
  let r; try { r = evalS(s); } catch (e) { r = "THROW " + e; }
  console.log(JSON.stringify(s), "=>", r);
}

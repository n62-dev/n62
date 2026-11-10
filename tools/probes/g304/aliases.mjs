// SPDX-License-Identifier: GPL-3.0-or-later
// G304: which Giac spellings of an angle function the engine reads, and what each gives (raw Giac, in radians).
//   GIAC_OUT=<dir with giac.mjs> node tools/probes/g304/aliases.mjs
const { default: createGiacModule } = await import(`${process.env.GIAC_OUT}/giac.mjs`);
globalThis.UI = { add_evalf: 0, js_bigint: 0, disable3d: -1, Datestart: Date.now() };
const M = await createGiacModule({ print: () => {}, printErr: () => {} });
M.cwrap("giac_init", "number", [])();
const ev = M.cwrap("giac_eval", "string", ["string"]);
const G = ""; // the lexer's sin<U+F005> (input_lexer.ll:671-673), TI's inverse glyph
const cases = [
  "arcsin(0.5)", "arccos(0.5)", "arctan(1.)", "arcsec(2.)", "arccsc(2.)", "arccot(1.)",
  "ASIN(0.5)", "ACOS(0.5)", "ATAN(1.)", "ASEC(2.)", "ACSC(2.)", "ACOT(1.)", "ARG(1.+i)",
  "SIN(0.5)", "COS(0.5)", "TAN(0.5)", "SEC(0.5)", "CSC(0.5)", "COT(0.5)",
  `sin${G}(0.5)`, `cos${G}(0.5)`, `tan${G}(1.)`,
  "quote(arcsin(x))", "quote(arccot(x))", "quote(ASIN(x))", "quote(SIN(x))", "quote(ARG(x))", `quote(sin${G}(x))`,
  "asin(0.5)", "acos(0.5)", "atan(1.)", "asec(2.)", "acsc(2.)", "acot(1.)", "arg(1.+i)", "sin(0.5)", "sec(0.5)",
];
for (const c of cases) console.log(JSON.stringify(c), "=>", ev(c));

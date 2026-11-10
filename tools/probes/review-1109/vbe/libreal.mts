// SPDX-License-Identifier: GPL-3.0-or-later
// sofia, verify be-4: a real library import (parseLibrary, importLibrary), then the function called in DEG on Home.
const W = new URL("../../../../app/src", import.meta.url).pathname;
const { nodeHost } = await import(`${W}/engine/nodeGiac.ts`);
const { importLibrary, parseLibrary } = await import(`${W}/engine/library.ts`);
const { LIBRARY_FORMAT } = await import(`${W}/state/libraryFormat.ts`);
const { defaultHomeSettings } = await import(`${W}/engine/homeEval.ts`);
const text = [`// n62 library ${LIBRARY_FORMAT.version}`, "", "// arcsin via the Giac alias", "fa(x):=arcsin(x)", "// test: abs(fa(1/2)-pi/6)<1e-9", "", "// control", "fb(x):=asin(x)", "// test: abs(fb(1/2)-pi/6)<1e-9", "", "// atan alias", "fc(x):=arctan(x)", ""].join("\n");
const h = await nodeHost();
let lib;
try { lib = parseLibrary(text, h.parse, LIBRARY_FORMAT); } catch (e) { console.log("parse refused:", (e as Error).message); process.exit(0); }
const imp = importLibrary(h, lib, []);
console.log("import ok:", imp.ok, imp.ok ? "" : imp.error);
for (const [c, ang] of [["fa(0.5)", "deg"], ["fb(0.5)", "deg"], ["fc(1)", "deg"], ["fa(0.5)", "rad"]] as const) {
  const r = h.home(c, { ...defaultHomeSettings, digits: 12, angle: ang, workDigits: 30 }).result;
  console.log(ang, c, "=>", r.ok ? r.display : "ERR " + r.error);
}

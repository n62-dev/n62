// SPDX-License-Identifier: GPL-3.0-or-later
// be hunt: what a library file's angle names become (asGiac) and what they give in DEG
import { asGiac } from "../../../../app/src/engine/library.ts";
import { EngineHost } from "../../../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings } from "../../../../app/src/engine/homeEval.ts";
const { giac, bridge } = await loadNodeGiac();
const host = new EngineHost(giac, bridge);
const inputs = ["asin(0.5)", "arcsin(0.5)", "arccos(0.5)", "arctan(1)", "acos(0.5)", "atan(1)", "arccot(1)", "acotan(1)", "cotan(45)", "cot(45)", "sin(30)"];
for (const t of inputs) {
  const g = asGiac(t);
  const r = host.home(g, { ...defaultHomeSettings, digits: 12, angle: "deg", workDigits: 30 }).result;
  console.log(t, "=> asGiac:", g, "=> DEG:", r.ok ? r.display : "ERR " + r.display);
}

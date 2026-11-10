// SPDX-License-Identifier: GPL-3.0-or-later
// be hunt: plain giac.eval of the lines of a file, Digits 40 as Home's exact step
import { readFileSync } from "node:fs";
import { loadNodeGiac } from "../../../../app/src/engine/nodeGiac.ts";
const { giac } = await loadNodeGiac();
giac.eval("Digits:=40");
for (const l of readFileSync(process.argv[2]!, "utf8").split("\n")) { if (l.trim()) console.log(l, "=>", giac.eval(l).slice(0, 200)); }

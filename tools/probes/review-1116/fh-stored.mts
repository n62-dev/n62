// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (night review 2026-11-16, fh-1, fh-2): with A stored in Home, what the Function app's engine paths answer for
// F1(x) = A·x² − 12 (Root near 1, the Plot menu's path), and what Solve answers for E1: V = I·R with R stored in Home
// and the knowns the Solve app would send (R's Num value is "0" unless typed: apps/solve/app.svelte.ts:121-123).
// Expected (derived): root of 3x² − 12 near 1 is 2; V = 2·4700 = 9400 when R's stored value were used.
//   env -C <review>/app GIAC_OUT=… npx tsx <this>
import { EngineHost } from "../../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings } from "../../../app/src/engine/homeEval.ts";

const { giac, bridge } = await loadNodeGiac();
const host = new EngineHost(giac, bridge);
const s = { ...defaultHomeSettings };
console.log("Home A:=3 ->", host.home("A:=3", s).result.display);
const root = host.analyze({ kind: "root", f: "A*x^2-12", x0: "1" }, s);
console.log("Function root of A*x^2-12 near 1 ->", root.ok, root.x?.display, root.error ?? "");
console.log("Home R:=4700 ->", host.home("R:=4700", s).result.display);
console.log("Solve unknowns of V=I*R ->", host.unknowns(["V=I*R"]));
const asApp = host.solve({ kind: "equations", equations: ["V=I*R"], unknowns: ["V"], guesses: ["0"], knowns: [{ name: "I", value: "2" }, { name: "R", value: "0" }] } as never, s);
console.log("Solve V with I=2 and R's Num value 0 (as the app sends) ->", JSON.stringify(asApp).slice(0, 300));
console.log("Home R still ->", host.home("R", s).result.display);

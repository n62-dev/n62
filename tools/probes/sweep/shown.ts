// SPDX-License-Identifier: GPL-3.0-or-later
// G61/G797: what Home showed for a result, in the sweep judge's shape: the value and markOf's mark at the setting digits, and for a
// list or matrix its entries, each with its own value and mark (the matrix grid marks each cell). The sweep's worker thread and
// casback's laws (G798) read results through it.
import { precisionFacts, type HomeResult } from "../../../app/src/engine/homeEval.ts";
import { markOf } from "../../../app/src/engine/format.ts";
import type { Shown } from "./judge.ts";

function markOfIt(x: HomeResult, digits: number): Pick<Shown, "mark" | "n"> {
  const m = x.ok && x.value ? markOf(precisionFacts(x), { format: "STD", digits }) : null;
  return m ? { mark: m.mark, ...(m.n !== undefined ? { n: m.n } : {}) } : {};
}

export function shownOf(r: HomeResult, digits: number): Shown {
  const items = r.ok && r.items ? r.items.map((it): Shown => ({ ok: it.ok, display: it.display, ...(it.value ? { value: it.value } : {}), ...markOfIt(it, digits) })) : undefined;
  return { ok: r.ok, display: r.display, ...(r.error ? { error: r.error } : {}), ...(r.value && !r.items ? { value: r.value } : {}), ...markOfIt(r, digits), ...(items ? { items, ...(r.shape ? { shape: r.shape } : {}) } : {}) };
}

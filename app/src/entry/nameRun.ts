// SPDX-License-Identifier: GPL-3.0-or-later
// R198: the name typed right before the cursor (a hardware keyboard's letters, then `(`): a run of letters, then digits
// (`log10`), each an atom of its own at the cursor's depth. hwkeys.ts reads it to choose the function; field.ts reads it
// again when the key reaches the line (a key that waited for a load meets the line as it is then) and replaces it.
import type { MathfieldElement } from "mathlive";

type Field = Pick<MathfieldElement, "getElementInfo" | "position" | "selectionIsCollapsed">;

/** The name before the cursor and the offset where it starts; none with a selection or with no letter there. */
export function nameBefore(mf: Field): { start: number; name: string } | undefined {
  if (!mf.selectionIsCollapsed) return undefined;
  const end = mf.position;
  const d = mf.getElementInfo(end)?.depth ?? 0;
  const at = (o: number): string => (o > 0 && (mf.getElementInfo(o)?.depth ?? 0) === d ? (mf.getElementInfo(o)?.latex ?? "") : "");
  let k = end;
  while (/^\d$/.test(at(k))) k--;
  const digits = k;
  while (/^[A-Za-z]$/.test(at(k))) k--;
  if (k === digits) return undefined;
  let name = "";
  for (let o = k + 1; o <= end; o++) name += at(o);
  return { start: k, name };
}

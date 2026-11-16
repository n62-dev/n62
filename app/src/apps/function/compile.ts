// SPDX-License-Identifier: GPL-3.0-or-later
// A Function-app definition, parsed once by our parser (P1) into the Giac text the engine evaluates and
// the JS evaluator Plot draws with (D7: drawing only; every number shown comes from the engine).
// The variable is x, the key on the keyboard; X (shift + alpha) means the same. R361: a stored name it reads (`A·x²`)
// is drawn at the value the engine gave for it (`values`, apps/function/stored.ts); without one there is no evaluator.
import { mathJsonToGiac, type Json } from "../../input/emit.ts";
import { parseFailText } from "../../input/errors.ts";
import { freeNames, jsonToJs, type NameValues } from "../../input/emit-js.ts";
import { parseLatex } from "../../input/parse.ts";

export interface Compiled {
  /** Giac text in x, or "" when the definition does not parse. */
  giac: string;
  /** Drawing evaluator; undefined when the expression cannot be drawn (a stored name with no value given, a user function). */
  fn?: (x: number) => number;
  /** Why it does not parse (empty when it does). Plot problems are not errors: the engine can still tabulate. */
  error: string;
  /** The angle mode the drawing evaluator was built for. */
  angle: "rad" | "deg";
  /** R361: the names it reads besides x and the constants (the stored names the Plot asks the engine for); absent: none. */
  uses?: readonly string[];
}

function renameX(e: Json): Json {
  if (e === "X") return "x";
  if (Array.isArray(e)) return e.map((a, i) => (i === 0 ? a : renameX(a)));
  return e;
}

/** `values` (R361): each stored name's value to draw with, a finite real; a name it reads without one: no `fn`. */
export function compileDefinition(latex: string, angle: "rad" | "deg" = "rad", values?: NameValues): Compiled {
  if (latex.trim() === "") return { giac: "", error: "", angle };
  let json: Json;
  let giac: string;
  try {
    json = renameX(parseLatex(latex));
    giac = mathJsonToGiac(json, { realOddRoots: true }); // P5 (b), R39
  } catch (e) {
    return { giac: "", error: parseFailText(e), angle };
  }
  if (Array.isArray(json) && typeof json[0] === "string" && /^(Equal|Less|Greater|LessEqual|GreaterEqual|NotEqual)$/.test(json[0]))
    return { giac: "", error: "not a function of x", angle };
  const names = freeNames(json);
  const uses = names.length ? { uses: names } : {};
  try {
    const fn = new Function("x", `return ${jsonToJs(json, ["x"], angle === "deg", values)};`) as (x: number) => number;
    return { giac, fn, error: "", angle, ...uses };
  } catch {
    return { giac, error: "", angle, ...uses };
  }
}

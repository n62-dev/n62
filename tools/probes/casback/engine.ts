// SPDX-License-Identifier: GPL-3.0-or-later
// G805: casback's two readers of Giac (app/scripts/casback.ts uses them; casback-engine.test.ts runs them on the real engine).
// `realAt`: the number an expression has at x, Giac's evalf at 12 digits (bridge-3), null when it is not a real number there.
// `phaseReader`: the largest |argument| of sin, cos, tan, sec, csc or cot in an expression at x, for check.ts's rule (header): the value's
// tree (bridge-3, treeOf) finds each such node, and its argument is read as Giac's own part of the expression, `(expr)[i]…[j][1]`. The
// two must index alike: a tree child i (from 0) is Giac's part i+1, as op() splits it; the engine test checks it on sums, products, a
// quotient (inv), a negation (neg) and a nested call.
import type { GiacBridge, ParseNode } from "../../../app/src/engine/bridge.ts";
import type { At, Phase } from "./check.ts";

const REAL: ReadonlySet<string> = new Set(["integer", "rational", "float", "symbolic"]);
const PERIODIC: ReadonlySet<string> = new Set(["sin", "cos", "tan", "sec", "csc", "cot"]);

export function realAt(bridge: GiacBridge): At {
  return (expr, x) => {
    const v = bridge.value(`subs(${expr},x=${x})`, [12]);
    const p = v.at?.["12"];
    if (!REAL.has(v.kind) || !p || p.length !== 1) return null;
    const [re, im] = p[0]!;
    const r = Number(re);
    return Number(im) === 0 && Number.isFinite(r) ? r : null;
  };
}

/** 0 when the expression holds no periodic function (or none with a real argument at x); null when its tree is not readable. */
export function phaseReader(bridge: GiacBridge, at: At): Phase {
  return (expr, x) => {
    const tree = bridge.value(expr, [], true).tree;
    if (!tree) return null;
    let top = 0;
    const walk = (n: ParseNode, path: string): void => {
      if (n[0] !== 1) return;
      if (PERIODIC.has(n[1]) && n[3].length === 1) {
        const v = at(`(${expr})${path}[1]`, x);
        if (v !== null) top = Math.max(top, Math.abs(v));
      }
      n[3].forEach((k, i) => walk(k, `${path}[${i + 1}]`));
    };
    walk(tree, "");
    return top;
  };
}

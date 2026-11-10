// SPDX-License-Identifier: GPL-3.0-or-later
// G303: every definition we give Giac binds only names no user can type. Pure text, no engine.
import { describe, expect, it } from "vitest";
import { boundIn, ownBound } from "./ourNames.ts";
import { ENGINE_DEFINITIONS } from "./homeEval.ts";
import { COMPLEX_DEFINITIONS } from "./complex.ts";
import { ICDF_DEFINITIONS } from "./icdf.ts";
import { eseriesDefinition } from "./eseries.ts";
import { UNIT_DEFINITIONS } from "../units/evaluate.ts";

const ALL = [...Object.values(ENGINE_DEFINITIONS), ...Object.values(COMPLEX_DEFINITIONS), ...Object.values(ICDF_DEFINITIONS), eseriesDefinition(), ...UNIT_DEFINITIONS];

describe("ownBound", () => {
  it("renames parameters, locals and arrow parameters, and nothing else", () => {
    expect(ownBound("f(a,b):={local c; c:=a+g(b); return map(L,k->k+c); }")).toBe("f(a_,b_):={local c_; c_:=a_+g(b_); return map(L,k_->k_+c_); }");
    expect(ownBound("f(x):=zip((x,y)->x^y,S,x)")).toBe("f(x_):=zip((x_,y_)->x_^y_,S,x_)");
  });

  it("leaves a word inside a string, and a name that is already ours", () => {
    expect(ownBound('f(a):={ throw("a needs a value"); return map(a,pasrow->pasrow); }')).toBe('f(a_):={ throw("a needs a value"); return map(a_,pasrow->pasrow); }');
    expect(ownBound("assume(pasdimL>0)")).toBe("assume(pasdimL>0)");
  });

  it("reads both programs of one text", () => {
    expect([...boundIn("f(n,x):={ local t; }; g(m):={ local b; }")].sort()).toEqual(["b", "m", "n", "t", "x"]);
  });

  it("every definition, once renamed, binds only our names, and every loop variable is bound", () => {
    expect(ALL.length).toBeGreaterThan(30);
    for (const def of ALL) {
      const text = ownBound(def);
      for (const n of boundIn(text)) expect(n.startsWith("pas") || n.endsWith("_"), `${n} in ${text.slice(0, 40)}`).toBe(true);
      const bound = boundIn(text);
      for (const m of text.matchAll(/\bfor\s*\(\s*(\w+)\s*:=/g)) expect(bound.has(m[1]!), `loop variable ${m[1]} in ${text.slice(0, 40)}`).toBe(true);
    }
  });
});

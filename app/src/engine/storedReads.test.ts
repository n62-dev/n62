// SPDX-License-Identifier: GPL-3.0-or-later
// G213f1: a Home or CAS result keeps each stored name its input read with its value before it ran (`reads`), so Copy as
// Python compares it with the line that set the name (clipboard/python.ts). The values are the ones typed (5, 7, 1/3)
// and their sums by hand (source: derived); for a float only whether it is exact is checked, never its digits.
import { beforeAll, describe, expect, it } from "vitest";
import type { EngineHost } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { giacAvailable, nodeHost } from "./nodeGiac.ts";
import { casItem, homeItem } from "../state/resultItem.ts";
import type { HistoryItem } from "../state/session.svelte.ts";
import { sessionLine } from "../state/sessionLine.ts";
import { translateRows, type PyRow } from "../clipboard/python.ts";
import type { HomeResult } from "./homeEval.ts";

/** A finished Home row as the session keeps it (homeItem's rule), and its session line read back. */
const line = (latex: string, r: HomeResult): PyRow => {
  const item: HistoryItem = { id: 1, view: "home", latex, status: r.ok ? "done" : "error", resultLatex: "", text: r.display, startedAt: 0, ...homeItem(r, false) };
  return JSON.parse(sessionLine(item, { t: new Date(0), app: "0.1.0" }) ?? "null") as PyRow;
};

describe.skipIf(!giacAvailable())("G213f1: the stored values an input read", () => {
  let host: EngineHost;
  const home = (input: string) => host.home(input, defaultHomeSettings).result;
  const cas = (input: string) => host.cas(input, defaultCasSettings).result;
  beforeAll(async () => {
    host = await nodeHost();
  });

  it("Home a:=5, CAS a:=7 (one shared context), Home a+1: the row read 7, which is the CAS row's full value", () => {
    const h = home("a:=5");
    expect(homeItem(h, false).full).toBe("5");
    const c = cas("a:=7");
    expect(casItem(c, false).full).toBe("7");
    const r = home("a+1");
    expect(r.display).toBe("8");
    expect(r.reads).toEqual([{ name: "a", value: "7", exact: true }]);
    expect(homeItem(r, false).reads).toEqual([{ name: "a", value: "7", exact: true }]);
  });

  it("an exact fraction is Giac's text, as the storing row's full; CAS keeps them too; none read is []", () => {
    const s = home("b:=1/3");
    expect(homeItem(s, false).full).toBe("1/3");
    expect(cas("b*3").reads).toEqual([{ name: "b", value: "1/3", exact: true }]);
    expect(home("2+3").reads).toEqual([]);
    expect(cas("2+3").reads).toEqual([]);
  });

  it("a float is not exact (Home's sqrt(2.0) is exact sqrt(2)); a name the store sets is no read, its old value in x:=x+1 is", () => {
    home("e2:=sqrt(2.0)");
    expect(home("e2*2").reads).toEqual([{ name: "e2", value: "sqrt(2)", exact: true }]);
    cas("f:=evalf(sqrt(2))");
    const r = home("f*2").reads;
    expect(r?.map((d) => [d.name, d.exact])).toEqual([["f", false]]);
    expect(home("g:=9").reads).toEqual([]);
    expect(cas("g:=g+1").reads).toEqual([{ name: "g", value: "9", exact: true }]);
  });

  it("end to end: Home 5▶a, CAS 7▶a, Home a+1 = 8: the Home view's Python reads no a = 5 for it; without the CAS store it does", () => {
    const five = line("5\\blacktriangleright h", home("h:=5"));
    cas("h:=7");
    const out = translateRows([five, line("h+1", home("h+1"))], { app: "0.1.0" }).split("\n");
    expect(out[1]).toBe("h = 5  # N62: = 5");
    expect(out[2]).toBe("# N62 NOT TRANSLATED (h held another value when this line ran): h+1");
    expect(out[3]).toBe("# N62: = 8");
    const again = line("5\\blacktriangleright k", home("k:=5"));
    const ok = translateRows([again, line("k+1", home("k+1"))], { app: "0.1.0" }).split("\n");
    expect(ok[2]).toBe("_2 = k + 1  # N62: = 6");
  });

  it("an error row keeps none", () => {
    expect(home("b+)").reads).toBeUndefined();
    expect(cas("b+)").reads).toBeUndefined();
  });
});

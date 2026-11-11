// SPDX-License-Identifier: GPL-3.0-or-later
// G229: shl, shr, rotl, rotr and bnot (wordOps.ts) respect the word size and sign, and refuse in words in Home and CAS.
// Expected values: the golden cases g229-* in home.yaml (source oracle, Python ints with masks); the ones here are those
// rows again: shl(1,7,8,1) = -128 (bit 7 of a signed byte), bnot(5,8,0) = 255 - 5 = 250, shl(1,63) = 2^63.
import { beforeAll, describe, expect, it } from "vitest";
import type { EngineHost } from "./host.ts";
import { defaultHomeSettings, definitionsUsedBy } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { giacAvailable, nodeHost } from "./nodeGiac.ts";
import { errorRefusal } from "./converge.ts";
import { WORD_REFUSALS, wordRefusal } from "./wordOps.ts";
import { enEngine } from "../i18n/enEngine.ts";
import { hasMessage } from "../i18n/index.ts";

describe("G229 wordRefusal", () => {
  it("reads the code a definition threw from Giac's error text, through errorRefusal too", () => {
    expect(wordRefusal('GIAC_ERROR: "n62refusal:wordValue" Error: Bad Argument Value')).toBe("wordValue");
    expect(errorRefusal("shl(1,-1,8,0)", 'GIAC_ERROR: "n62refusal:wordCount" Error: Bad Argument Value')).toBe("wordCount");
  });

  it("reads nothing else: a stats code, an unknown code, a plain error", () => {
    expect(wordRefusal('GIAC_ERROR: "n62refusal:xAllEqual" Error: Bad Argument Value')).toBeNull();
    expect(wordRefusal('GIAC_ERROR: "n62refusal:wordNoSuch" Error: Bad Argument Value')).toBeNull();
    expect(wordRefusal("GIAC_ERROR: Invalid dimension")).toBeNull();
  });

  it("loads the definitions only for an input that names them", () => {
    expect(definitionsUsedBy("shl(1,2)+bnot(3)")).toEqual(expect.arrayContaining(["shl", "bnot"]));
    expect(definitionsUsedBy("bitand(1,2)")).not.toContain("shl");
  });
});

describe("G229 the words stay with the worker", () => {
  it("are in the worker's table, not the app's (start chunk)", () => {
    for (const code of WORD_REFUSALS) {
      expect(enEngine[`error.${code}`], code).toBeTruthy();
      expect(hasMessage(`error.${code}`), code).toBe(false);
    }
  });
});

describe.skipIf(!giacAvailable())("G229 word operations in the engine", () => {
  let host: EngineHost;
  const home = (input: string) => host.home(input, defaultHomeSettings).result;
  const cas = (input: string) => host.cas(input, defaultCasSettings).result;
  beforeAll(async () => {
    host = await nodeHost();
  });

  it("answers exactly in CAS", () => {
    expect(cas("shl(1,7,8,1)")).toMatchObject({ ok: true, text: "-128" });
    expect(cas("bnot(5,8,0)")).toMatchObject({ ok: true, text: "250" });
    expect(cas("shl(1,63)")).toMatchObject({ ok: true, text: "9223372036854775808" });
  });

  it("refuses in CAS with the words Home has, and an assignment stores nothing", () => {
    expect(cas("shl(256,1,8,0)")).toMatchObject({ ok: false, error: "wordValue", text: "The value must be an integer that fits the word" });
    expect(cas("W229:=shl(1,-1)")).toMatchObject({ ok: false, error: "wordCount" });
    expect(cas("W229")).toMatchObject({ ok: true, text: "W229" });
  });

  it("refuses through a stored function", () => {
    expect(home("g229(a):=shl(a,1,8,1)")).toMatchObject({ ok: true });
    expect(home("g229(127)")).toMatchObject({ ok: true, display: "-2" });
    expect(home("g229(128)")).toMatchObject({ ok: false, error: "wordValue" });
  });
});

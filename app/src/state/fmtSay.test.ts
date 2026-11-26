// SPDX-License-Identifier: GPL-3.0-or-later
// R871 (owner, 2026-11-22): Say the format on each Fmt press is one stamped record of its own under `fmtSay` (a boolean, off
// when absent), a backup part whose validator takes only a boolean, and the text a changed Fmt row says: its notation, short.
import { describe, expect, it } from "vitest";
import { BACKUP_KEYS, checkBackup, VALIDATORS, type CheckedBackup } from "./backup.ts";
import { fmtSaid } from "./cycleForms.ts";
import { fakeKv } from "./fakeKv.ts";
import { FMT_SAY_KEY, FmtSayStore } from "./fmtSay.svelte.ts";
import type { HistoryItem } from "./session.svelte.ts";
import { DATA_VERSION } from "./storage.ts";

const file = (v: unknown): Uint8Array =>
  new TextEncoder().encode(JSON.stringify({ "n62-backup": 1, dataVersion: DATA_VERSION, made: "2026-11-26T12:00:00.000Z", parts: { fmtSay: { "@n62": DATA_VERSION, value: v } } }));

describe("the key `fmtSay` (R871)", () => {
  it("is a backup part whose validator takes true and false only", () => {
    expect(FMT_SAY_KEY).toBe("fmtSay");
    expect(BACKUP_KEYS).toContain("fmtSay");
    for (const v of [true, false]) {
      const r = checkBackup(file(v)) as CheckedBackup;
      expect(r.ok, String(v)).toBe(true);
      expect(r.parts["fmtSay"]).toBe(v);
    }
    for (const bad of [1, 0, "true", null, {}, []]) expect(VALIDATORS["fmtSay"]?.(bad), JSON.stringify(bad)).toBe(false);
  });

  it("is off with no record and with anything but true; a stored true reads on", async () => {
    for (const [stored, on] of [[undefined, false], [true, true], [false, false], ["yes", false], [1, false]] as const) {
      const s = new FmtSayStore(fakeKv(stored === undefined ? [] : [["fmtSay", stored]]));
      expect(s.on).toBe(false); // nothing read yet
      await s.restore();
      expect(s.on, String(stored)).toBe(on);
    }
  });

  it("set writes the record, and a read that ends after it does not undo it", async () => {
    const kv = fakeKv([["fmtSay", false]]);
    const s = new FmtSayStore(kv);
    s.set(true);
    await s.restore();
    expect(s.on).toBe(true);
    await Promise.resolve();
    expect(kv.data.get("fmtSay")).toBe(true);
  });
});

describe("fmtSaid (R871): the notice of a Fmt press that changed the row", () => {
  const row = (fmt: HistoryItem["fmt"]): HistoryItem => ({ fmt }) as HistoryItem;
  it("names the row's notation now, in its short word", () => {
    expect(fmtSaid(row("sci"))).toBe("Sci · this result");
    expect([row("std"), row("eng"), row("pfx"), row("fix")].map(fmtSaid)).toEqual(["Std · this result", "Eng · this result", "Pfx · this result", "Fix · this result"]);
  });
  it("a CAS row back at its exact form says Exact", () => {
    expect(fmtSaid(row(undefined))).toBe("Exact · this result");
  });
});

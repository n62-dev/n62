// SPDX-License-Identifier: GPL-3.0-or-later
// R193: the Base menu's rows (views/baseSheet.ts). Expected texts are derived (255 = 0xFF; 2^64 does not fit a 64-bit word).
import { describe, expect, it } from "vitest";
import { decimalFromRational } from "../engine/format.ts";
import type { HistoryItem, Session } from "../state/session.svelte.ts";
import { baseItems } from "./baseSheet.ts";

const real = (n: bigint, d = 1n) => ({ re: decimalFromRational(n, d), im: decimalFromRational(0n, 1n) });
const item = (n: bigint, d = 1n, more: Partial<HistoryItem> = {}): HistoryItem =>
  ({ status: "done", value: real(n, d), rational: { n: String(n), d: String(d) }, ...more }) as unknown as HistoryItem;
const saved: number[] = [];
const session = { saveHistory: () => saved.push(1) } as unknown as Session;
const row = (rows: ReturnType<typeof baseItems>, id: string) => rows.find((r) => r.id === id);

describe("baseItems", () => {
  it("an integer: four rows in the order HEX BIN OCT DEC, all enabled, DEC the current one", () => {
    const rows = baseItems(session, item(255n));
    expect(rows.map((r) => r.label)).toEqual(["HEX", "BIN", "OCT", "DEC"]);
    expect(rows.every((r) => !r.disabled)).toBe(true);
    expect(rows.map((r) => r.selected)).toEqual([false, false, false, true]);
  });
  it("a pick sets the result's fmt, DEC removes it, and any form chosen with a b/c goes; each saves the history", () => {
    const it1 = item(255n, 1n, { form: "dec" });
    row(baseItems(session, it1), "hex")?.run?.();
    expect([it1.fmt, it1.form]).toEqual(["hex", undefined]);
    expect(row(baseItems(session, it1), "hex")?.selected).toBe(true);
    row(baseItems(session, it1), "oct")?.run?.();
    expect(it1.fmt).toBe("oct");
    row(baseItems(session, it1), "dec")?.run?.();
    expect(it1.fmt).toBeUndefined();
    expect(saved.length).toBe(3);
  });
  it("a non-integer: every row dimmed with the reason", () => {
    for (const r of baseItems(session, item(3n, 2n))) {
      expect(r.disabled, r.label).toBe(true);
      expect(r.reason).toMatch(/only integers/i);
    }
  });
  it("an integer outside the word (none set: 64 bits, unsigned): the bases are dimmed with the word named, DEC is not", () => {
    const rows = baseItems(session, item(2n ** 64n));
    for (const id of ["hex", "bin", "oct"]) expect(row(rows, id)?.disabled, id).toBe(true);
    expect(row(rows, "hex")?.reason).toBe("Does not fit the 64-bit unsigned word");
    expect(row(rows, "dec")?.disabled).toBeUndefined();
  });
  // R305 (vr-6): the reason names the word in force (R194), and a negative in an unsigned word says it needs Signed
  it("names the word that is set: 300 in 8 bits unsigned, 255 in 8 bits signed", () => {
    expect(row(baseItems(session, item(300n), { bits: 8, signed: false }), "hex")?.reason).toBe("Does not fit the 8-bit unsigned word");
    expect(row(baseItems(session, item(255n), { bits: 8, signed: true }), "bin")?.reason).toBe("Does not fit the 8-bit signed word");
    expect(row(baseItems(session, item(-129n), { bits: 8, signed: true }), "oct")?.reason).toBe("Does not fit the 8-bit signed word");
    expect(baseItems(session, item(-1n), { bits: 8, signed: true }).every((r) => !r.disabled)).toBe(true);
  });
  it("a negative in an unsigned word: its own reason, which sends to Signed", () => {
    for (const word of [undefined, { bits: 16, signed: false } as const]) {
      const rows = baseItems(session, item(-1n), word);
      for (const id of ["hex", "bin", "oct"]) expect(row(rows, id)?.reason, id).toBe("A negative number needs a signed word: Settings › Numbers › Word");
      expect(row(rows, "dec")?.disabled).toBeUndefined();
    }
  });
});

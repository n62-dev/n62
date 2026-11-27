// SPDX-License-Identifier: GPL-3.0-or-later
// G640 (owner, 2026-11-20 night, H3): a row that used Ans keeps what Ans was (frozen in history). The store's side, without
// the engine: what restoredItem keeps of a row's `ans`, its size check, and the text of a row with no `ans`. The pins pass
// today and stay green; the cases G642 (the snapshot: the whole chip, `shown`, `from`) makes pass are in KNOWN_FAIL
// (`it.fails`: a known-fail that passes fails the run), and G642 deletes each line as it turns green. The rows are made up
// here (their numbers are shapes, not results); the engine's side is ansFrozen.engine.test.ts.
import { describe, expect, it } from "vitest";
import { sessionLatex, sessionText } from "../clipboard/text.ts";
import type { DisplayContext } from "./displayMode.ts";
import { FULL_LIMIT } from "./results.ts";
import type { HistoryItem } from "./session.svelte.ts";
import { restoredItem } from "./storedItem.ts";

const CTX: DisplayContext = { format: "std", digits: 12, fixDecimals: 4, angle: "rad" };
const FROM = "mwzf4p23-1"; // a uid as rowUid writes it (G211)

/** The row `Ans²` = 25 as the store holds it (JSON), with `ans` as given (absent: a row stored before G213f1). */
function stored(ans?: Record<string, unknown>): HistoryItem {
  const row = { id: 2, uid: "mwzf4p23-2", view: "home", latex: "\\ans^{2}", status: "done", resultLatex: "25", text: "25", approximate: false, full: "25", fullExact: true, ...(ans ? { ans } : {}) };
  return JSON.parse(JSON.stringify(row)) as HistoryItem;
}
const back = (ans?: Record<string, unknown>): Record<string, unknown> | undefined => restoredItem(stored(ans), 2).ans as Record<string, unknown> | undefined;

/** The snapshot G642 keeps: the chip Ans resolved to (here a unit result's, with σ and its facts), the LaTeX the source row
 *  drew, the source row's uid. */
const SNAPSHOT = {
  value: "5",
  exact: false,
  reliableDigits: 12,
  unc: "0.1",
  uncFacts: { reliableDigits: null },
  unit: { text: "km/h", dim: "m1s-1", slot: { tokens: [{ unit: "km" }, { unit: "h", power: "-1" }] } },
  shown: "5",
  from: FROM,
};

// ---- cases that fail today, each with the package that makes it pass (that package deletes its line) ------------------
const KNOWN_FAIL = new Map<string, string>([
  ["roundtrip-whole", "G642"],
  ["size-counts-snapshot", "G642"],
]);
const known = (id: string, what: string, fn: () => void): void => {
  const pkg = KNOWN_FAIL.get(id);
  (pkg ? it.fails : it)(`${pkg ? `${pkg} (known-fail) ` : ""}${what}`, fn);
};

describe("G640: a row's Ans through the store", () => {
  // ---- pins: green today, kept green ----
  it("a store round trip keeps ans.value and ans.exact", () => {
    expect(back({ value: "5", exact: true })).toEqual({ value: "5", exact: true });
    expect(back({ value: "1/3", exact: true })).toEqual({ value: "1/3", exact: true });
    expect(back({ value: "sin(1)", exact: false })).toEqual({ value: "sin(1)", exact: false });
  });

  it("a row stored before G213f1 (no `ans`) loads without one, and its text and .tex say the word Ans, as now", () => {
    const row = restoredItem(stored(), 2);
    expect(row.ans).toBeUndefined();
    expect(sessionText([row], {}, CTX).split(" ")[0]).toBe("Ans^2");
    expect(sessionLatex([row], {}, CTX, "0.0.0")).toContain("\\mathrm{Ans}^{2}");
  });

  it("a value past FULL_LIMIT is left out by the size check: no `ans`, and the row's text falls back to the word Ans", () => {
    const row = restoredItem(stored({ ...SNAPSHOT, value: "1".repeat(FULL_LIMIT + 1), exact: true }), 2);
    expect(row.ans).toBeUndefined();
    expect(sessionText([row], {}, CTX).split(" ")[0]).toBe("Ans^2");
  });

  // ---- known-fail until G642 ----
  known("roundtrip-whole", "the stored snapshot survives a round trip whole: σ (`unc`, `uncFacts`), `unit`, `reliableDigits`, `shown`, `from`", () => {
    expect(back(SNAPSHOT)).toEqual(SNAPSHOT);
  });

  known("size-counts-snapshot", "the size check counts the snapshot: a 2 kB exact value (FULL_LIMIT) keeps it whole; a `shown` past FULL_LIMIT is dropped alone", () => {
    const value = "1".repeat(FULL_LIMIT);
    expect(back({ value, exact: true, shown: "1", from: FROM })).toEqual({ value, exact: true, shown: "1", from: FROM });
    expect(back({ value: "5", exact: true, shown: "5".repeat(FULL_LIMIT + 1), from: FROM })).toEqual({ value: "5", exact: true, from: FROM });
  });
});

// SPDX-License-Identifier: GPL-3.0-or-later
// R290: the seven first-start tips teach the final handling (K5): the gestures that nothing on screen shows, and ☰.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { enTips, tipsText } from "./enTips.ts";

// The cards tipsHost.ts draws: every "tips.*" key it names, but the dialog's title and Got it.
const host = readFileSync(join(import.meta.dirname, "..", "views", "tipsHost.ts"), "utf8");
const drawn = [...new Set([...host.matchAll(/"(tips\.\w+)"/g)].map((m) => m[1]!))].filter((k) => k !== "tips.title" && k !== "tips.gotIt");
const cards = drawn.map((k) => tipsText(k as keyof typeof enTips));
const all = cards.join("\n");
const card = (re: RegExp): string => {
  const hit = cards.filter((c) => re.test(c));
  expect(hit.length, `a card matching ${re}`).toBeGreaterThan(0);
  return hit.join("\n");
};

describe("the first-start tips (R290)", () => {
  it("are seven cards, and every message of the table but the title and Got it is one of them", () => {
    expect(drawn.length).toBe(7);
    expect(Object.keys(enTips).filter((k) => k !== "tips.title" && k !== "tips.gotIt").sort()).toEqual([...drawn].sort());
  });
  it("keep the two ringed cards (⊞▾ and the bar's ☰, R722) and the marks card", () => {
    expect(cards[0]).toMatch(/⊞▾.*Home.*second tap on CAS/); // R782
    expect(cards[1]).toMatch(/☰/);
    card(/= exact\. ≈ rounded.*⚠/);
  });
  it("say that on a history row a tap on the input or the result picks it, a hold copies and a swipe deletes (R832)", () => {
    expect(card(/a row's input/i)).toMatch(/tap.*input or result.*pick.*hold.*cop(y|ies).*swipe.*delet/i);
  });
  it("say that a tap on ⌄ on the bar or a swipe down on the line folds the keypad (R724, R786)", () => {
    expect(card(/⌄/)).toMatch(/tap ⌄ on the bar or swipe down on the line to fold the keypad/i);
  });
  it("say that on the line a drag scrolls and a hold selects, and Select and Deselect grow and shrink it", () => {
    const c = card(/\bselect\b/i);
    expect(c).toMatch(/drag.*scroll/i);
    expect(c).toMatch(/hold.*select/i);
    expect(c).toMatch(/Select and Deselect grow and shrink/);
  });
  it("name what ☰ holds: Delete, Share and Export, and ⚙ for Settings (R830)", () => {
    expect(card(/☰/)).toBe("Tap ☰ for Delete, Share and Export; ⚙ for Settings");
  });
  it("name the units key and → Check, the end slot of the unit view (R352, R349)", () => {
    expect(card(/Units/)).toBe("Units: type the numbers, then Shift + Units (Tmpl). A unit after each number; → Check checks the result against a unit");
  });
  it("name no control that is gone: a Copy or Paste key, the fold handle or fold bar; nor a dimmed Help (R722: the bar on the keys is there)", () => {
    expect(all).not.toMatch(/\b(copy|paste) key|key.*\b(copy|paste)\b.*key|handle|fold(ing)? bar|\bhelp\b/i);
  });
});

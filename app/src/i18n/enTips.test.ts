// SPDX-License-Identifier: GPL-3.0-or-later
// R290: the six first-start tips teach the final handling (K5): the gestures that nothing on screen shows, and ☰.
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
  it("are six cards, and every message of the table but the title and Got it is one of them", () => {
    expect(drawn.length).toBe(6);
    expect(Object.keys(enTips).filter((k) => k !== "tips.title" && k !== "tips.gotIt").sort()).toEqual([...drawn].sort());
  });
  it("keep the two ringed cards (the place name, the status line's ☰) and the marks card", () => {
    expect(cards[0]).toMatch(/name/);
    expect(cards[1]).toMatch(/☰/);
    card(/= exact\. ≈ rounded.*⚠/);
  });
  it("say that on a history row a hold copies and a swipe deletes", () => {
    expect(card(/history row/i)).toMatch(/hold.*cop(y|ies).*swipe.*delet/i);
  });
  it("say that a swipe down on the entry line folds the keypad and a swipe up brings it back", () => {
    expect(card(/entry line/i)).toMatch(/swipe down.*fold.*keypad.*(swipe )?up.*back/i);
  });
  it("say that on the line a drag scrolls and a hold selects, and Select and Deselect grow and shrink it", () => {
    const c = card(/\bselect\b/i);
    expect(c).toMatch(/drag.*scroll/i);
    expect(c).toMatch(/hold.*select/i);
    expect(c).toMatch(/Select and Deselect grow and shrink/);
  });
  it("say that ☰, on the keys and on the status line, holds Paste and each app's menu", () => {
    const c = card(/☰/);
    expect(c).toMatch(/keys/);
    expect(c).toMatch(/status line/);
    expect(c).toMatch(/Paste/);
    expect(c).toMatch(/each app's menu/);
  });
  it("name no control that is gone: a Copy or Paste key, the fold handle; nor a dimmed Help", () => {
    expect(all).not.toMatch(/\b(copy|paste) key|key.*\b(copy|paste)\b.*key|handle|\bbar\b|\bhelp\b/i);
  });
});

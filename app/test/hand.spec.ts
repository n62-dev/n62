// SPDX-License-Identifier: GPL-3.0-or-later
// R781 (owner, 2026-11-20, "left/right-hand switch: yes, after the release"; docs/05 3.4 and 3.10, docs/06 3b): Settings › Appearance ›
// Hand, Right or Left. Left mirrors the keypad's columns (Enter, ⌫ and Esc to the left edge, the round pad's ◀ and ▶ zones still on
// their own sides) and the bar's order (⌄ at the right end, ☰ at the left), open and folded; the entry line and the history stay.
// Right is the default and today's layout. Expected values come from the rule: a mirrored box is the old one reflected about the
// keypad's (or the bar's) vertical centre line. The fake engine, at 360 × 740.
import { expect, test, type Page } from "@playwright/test";
import { open, sheet, tap } from "./helpers.ts";

const W = 360;
const H = 740;
type Box = { x: number; y: number; w: number; h: number };
type Boxes = Record<string, Box>;
const row = (page: Page, id: string) => sheet(page).locator(`[role="menuitem"][data-id="${id}"]`);
const hand = (page: Page) => page.evaluate(() => (window.n62.session.settings.look as unknown as { hand?: unknown }).hand);

/** Every key, the round pad, the bar's controls (or the folded row's), the entry line and the history, by a name. */
const boxes = (page: Page): Promise<Boxes> =>
  page.evaluate(() => {
    const out: Record<string, { x: number; y: number; w: number; h: number }> = {};
    const put = (name: string, el: Element | null): void => {
      const r = el?.getBoundingClientRect();
      if (r && r.width > 0) out[name] = { x: r.x, y: r.y, w: r.width, h: r.height };
    };
    for (const el of document.querySelectorAll("[data-key]")) put(`key:${el.getAttribute("data-key")}`, el);
    put("pad", document.querySelector(".pad"));
    put("trackpad", document.querySelector(".trackpad"));
    const bar = document.querySelector('[data-testid="folded-bar"]') ?? document.querySelector('[data-testid="bar"]');
    put("bar", bar);
    for (const el of bar?.querySelectorAll("button[data-item], [data-testid='bar-modes'], [data-testid='mod-slot']") ?? [])
      put(`bar:${el.getAttribute("data-item") ?? el.getAttribute("data-testid")}`, el);
    put("entry", document.querySelector('[data-testid="entry"]'));
    put("history", document.querySelector(".stage"));
    return out;
  });

/** The box reflected about the vertical line through `mid` (twice the centre's x). */
const mirror = (b: Box, twiceMid: number): Box => ({ ...b, x: twiceMid - b.x - b.w });
const near = (a: Box, b: Box): boolean => Math.abs(a.x - b.x) < 0.6 && Math.abs(a.y - b.y) < 0.6 && Math.abs(a.w - b.w) < 0.6 && Math.abs(a.h - b.h) < 0.6;

/** What does not hold of `left` as the mirror of `right` (none is the rule). */
function mirrored(right: Boxes, left: Boxes): string[] {
  const bad: string[] = [];
  const pad = right["pad"];
  const bar = right["bar"];
  if (!pad || !bar) return ["no keypad or bar"];
  for (const [name, r] of Object.entries(right)) {
    const l = left[name];
    if (!l) {
      bad.push(`${name}: gone`);
      continue;
    }
    // the round pad's ◀ ▶ zones point where they point: they keep their side of the (centred) pad
    const stays = name === "entry" || name === "history" || name === "pad" || name === "bar" || name === "key:left" || name === "key:right";
    const want = stays ? r : name.startsWith("bar:") ? mirror(r, 2 * bar.x + bar.w) : mirror(r, 2 * pad.x + pad.w);
    if (!near(l, want)) bad.push(`${name}: at ${Math.round(l.x)}, want ${Math.round(want.x)}`);
  }
  return bad;
}

/** Settings › Appearance › Hand stepped by its ▶ (or ◀) button, then the sheet closed again. */
async function stepHand(page: Page, dir: "step-up" | "step-down"): Promise<void> {
  await tap(page, ["help", "d2"]);
  await row(page, "hand").getByTestId(dir).tap();
  for (let i = 0; i < 4 && (await sheet(page).count()) > 0; i++) await tap(page, ["esc"]);
  await expect(sheet(page)).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: W, height: H });
  await open(page);
});

test("R781: Appearance ends with Hand, Right at a first start; Left and back to Right are value steps", async ({ page }) => {
  expect(await hand(page)).toBe("right");
  await tap(page, ["help", "d2"]);
  const ids = await sheet(page).getByRole("menuitem").evaluateAll((els) => els.map((e) => e.getAttribute("data-id")));
  expect(ids.at(-1)).toBe("hand");
  await expect(row(page, "hand").locator(".label")).toHaveText("Hand");
  await expect(row(page, "hand").getByTestId("sheet-value")).toHaveText("Right");
  await row(page, "hand").getByTestId("step-up").tap();
  await expect(row(page, "hand").getByTestId("sheet-value")).toHaveText("Left");
  expect(await hand(page)).toBe("left");
  await expect(page.locator("html")).toHaveAttribute("data-hand", "left");
  await row(page, "hand").getByTestId("step-down").tap();
  await expect(row(page, "hand").getByTestId("sheet-value")).toHaveText("Right");
  await expect(page.locator("html")).not.toHaveAttribute("data-hand", /./);
});

test("R781: Left mirrors the keys and the bar (Enter at the mirrored x, ⌄ at the right end), the line and history stay; Right is today's boxes", async ({ page }) => {
  const right = await boxes(page);
  expect(Object.keys(right).filter((k) => k.startsWith("key:")).length).toBeGreaterThan(40);
  await stepHand(page, "step-up");
  const left = await boxes(page);
  expect(mirrored(right, left)).toEqual([]);
  // the rule's own words: Enter at the mirrored x, now at the keypad's left edge; ⌄ at the bar's right end, ☰ at its left
  const pad = right["pad"]!;
  expect(left["key:enter"]!.x).toBeCloseTo(2 * pad.x + pad.w - right["key:enter"]!.x - right["key:enter"]!.w, 0);
  expect(left["key:enter"]!.x).toBeLessThan(W / 2);
  expect(left["bar:fold"]!.x).toBeGreaterThan(left["bar:menu"]!.x);
  expect(left["bar:fold"]!.x + left["bar:fold"]!.w).toBeCloseTo(right["bar"]!.x + right["bar"]!.w, 0);
  // a mirrored key still types itself, and the pad's ◀ still steps left
  await tap(page, ["d7", "d8", "left", "d9"]);
  expect(await page.evaluate(() => window.n62.entry.value)).toBe("798");
  await stepHand(page, "step-down");
  expect(await boxes(page)).toEqual(right);
});

test("R781: Left survives a reload, the first frame already mirrored", async ({ page }) => {
  const right = await boxes(page);
  await stepHand(page, "step-up");
  const left = await boxes(page);
  await page.waitForTimeout(300); // the store writes behind the change
  await page.reload();
  // before the app's code runs: the inline script set the attribute from the look's mirror
  expect(await page.evaluate(() => document.documentElement.getAttribute("data-hand"))).toBe("left");
  await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.n62 !== undefined);
  await page.evaluate(() => window.n62.entry.ready);
  await page.waitForTimeout(150);
  expect(await hand(page)).toBe("left");
  expect(mirrored(right, await boxes(page))).toEqual([]);
  expect(Object.keys(await boxes(page)).sort()).toEqual(Object.keys(left).sort());
});

test("R781: folded, Left mirrors the folded bar: ⌃ at the right end, ☰ at the left; ⌃ unfolds", async ({ page }) => {
  await page.getByTestId("fold-chevron").tap();
  await expect(page.getByTestId("folded-bar")).toBeVisible();
  const right = await boxes(page);
  await page.getByTestId("fold-slice").tap();
  await stepHand(page, "step-up");
  await page.getByTestId("fold-chevron").tap();
  await expect(page.getByTestId("folded-bar")).toBeVisible();
  const left = await boxes(page);
  const bad = mirrored(right, left).filter((b) => b.startsWith("bar:"));
  expect(bad).toEqual([]);
  expect(Object.keys(left).filter((k) => k.startsWith("bar:")).sort()).toEqual(Object.keys(right).filter((k) => k.startsWith("bar:")).sort());
  expect(left["bar:unfold"]!.x).toBeGreaterThan(left["bar:menu"]!.x);
  await page.getByTestId("fold-slice").tap();
  await expect(page.getByTestId("folded-bar")).toHaveCount(0);
});

// The shots (the package's Done when): both hands in the three themes, keys up, in test-results/ (not kept in the repo).
test("R781: shots of both hands in N62, Black & White and Solarized", async ({ page }) => {
  for (const family of ["n62", "bw", "solarized"]) {
    for (const h of ["right", "left"]) {
      await page.evaluate(
        ([f, hd]) => {
          const s = window.n62.session;
          s.settings.look = { ...s.settings.look, family: f, hand: hd } as typeof s.settings.look;
          s.onLook?.({ ...s.settings.look });
        },
        [family, h],
      );
      await expect(page.locator("html")).toHaveAttribute("data-family", family);
      await page.waitForTimeout(200);
      await page.screenshot({ path: `test-results/r781-${family}-${h}.png` });
    }
  }
});

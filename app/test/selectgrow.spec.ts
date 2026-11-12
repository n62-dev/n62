// SPDX-License-Identifier: GPL-3.0-or-later
// R279: Select grows the entry line's selection by the box model, Deselect walks it back (entry/grow.ts). R278 puts the
// two actions on r2c4 and r2c5; until then a free key holds them (U1 Select, U2 Deselect), through the same route.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

const GROW = ["u1"];
const SHRINK = ["u2"];

test.beforeEach(async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    window.n62.userKeys.set("u1", "primary", { label: "Select", action: { special: "selectGrow" } });
    window.n62.userKeys.set("u2", "primary", { label: "Deselect", action: { special: "selectShrink" } });
  });
});

/** The line `latex` with the cursor at offset `at` (the end when undefined). */
async function line(page: Page, latex: string, at?: number): Promise<void> {
  await page.evaluate(
    ([l, o]) => {
      const mf = window.n62.entry.field;
      if (!mf) throw new Error("no field");
      mf.value = l as string;
      mf.focus();
      mf.position = o === undefined ? mf.lastOffset : (o as number);
    },
    [latex, at] as const,
  );
}

/** The selection: its range and its LaTeX ("" when collapsed). */
const selected = (page: Page): Promise<{ range: number[]; latex: string }> =>
  page.evaluate(() => {
    const mf = window.n62.entry.field;
    if (!mf) throw new Error("no field");
    const r = mf.selection.ranges[0] ?? [mf.position, mf.position];
    return { range: [Math.min(...r), Math.max(...r)], latex: mf.selectionIsCollapsed ? "" : mf.getValue(mf.selection, "latex") };
  });

test("typed 2+3×4: Select twice takes 3×4, x² raises it in brackets: 2+(3×4)²", async ({ page }) => {
  await tap(page, ["d2", "add", "d3", "mul", "d4"]);
  await tap(page, GROW);
  expect((await selected(page)).latex).toBe("4");
  await tap(page, GROW);
  expect((await selected(page)).latex).toBe("3\\times4");
  await tap(page, ["sq"]);
  expect(await entryValue(page)).toBe("2+\\left(3\\times4\\right)^2");
});

test("Select, Deselect, Deselect: no selection, the cursor where it was; the second Deselect is a dead key", async ({ page }) => {
  await tap(page, ["d2", "add", "d3", "mul", "d4", "left", "left"]); // the cursor after the 3
  const before = await selected(page);
  await tap(page, GROW);
  expect((await selected(page)).latex).toBe("3");
  await tap(page, SHRINK);
  expect(await selected(page)).toEqual(before);
  await tap(page, SHRINK);
  expect(await selected(page)).toEqual(before);
  expect(await entryValue(page)).toBe("2+3\\times4");
});

test("Select up to the line, where it stays; Deselect walks each step back", async ({ page }) => {
  await tap(page, ["d2", "add", "d3", "mul", "d4"]);
  const steps: string[] = [];
  for (let i = 0; i < 4; i++) {
    await tap(page, GROW);
    steps.push((await selected(page)).latex);
  }
  expect(steps).toEqual(["4", "3\\times4", "2+3\\times4", "2+3\\times4"]);
  const back: string[] = [];
  for (let i = 0; i < 3; i++) {
    await tap(page, SHRINK);
    back.push((await selected(page)).latex);
  }
  expect(back).toEqual(["3\\times4", "4", ""]);
});

test("◀ and ▶ put the cursor at that edge of the selection and end the chain", async ({ page }) => {
  await tap(page, ["d2", "add", "d3", "mul", "d4"]);
  await tap(page, [...GROW, ...GROW]);
  const { range } = await selected(page);
  await tap(page, ["left"]);
  expect(await selected(page)).toEqual({ range: [range[0], range[0]], latex: "" });
  await tap(page, SHRINK);
  expect(await selected(page)).toEqual({ range: [range[0], range[0]], latex: "" }); // no chain: nothing happens
  await tap(page, [...GROW, ...GROW]);
  await tap(page, ["right"]);
  expect((await selected(page)).range).toEqual([5, 5]);
});

test("any other key ends the chain: Select, x², Deselect leaves the line as x² made it", async ({ page }) => {
  await tap(page, ["d2", "add", "d3"]);
  await tap(page, GROW);
  await tap(page, ["sq"]);
  const after = await entryValue(page);
  await tap(page, SHRINK);
  expect(await entryValue(page)).toBe(after);
});

// The steps on the real field, from the cursor at an offset: the same lines and offsets as grow.test.ts
const CHAINS: [string, number | undefined, string[]][] = [
  ["2+3\\cdot4", undefined, ["4", "3\\cdot4", "2+3\\cdot4"]],
  ["\\frac{1+2}{3}", 4, ["2", "1+2", "\\frac{1+2}{3}"]],
  ["\\sqrt{x^2+1}", 5, ["x^2", "x^2+1", "\\sqrt{x^2+1}"]],
  ["\\sqrt{x^2+1}", 4, ["2", "x^2", "x^2+1", "\\sqrt{x^2+1}"]],
  ["\\sin\\left(2x\\right)+1", 4, ["x", "2x", "\\sin\\left(2x\\right)", "\\sin\\left(2x\\right)+1"]],
  ["2\\times1.5\\emark-3", undefined, ["1.5\\emark-3", "2\\times1.5\\emark-3"]],
];
for (const [latex, at, want] of CHAINS)
  test(`${latex} from offset ${at ?? "end"}: ${want.join(" → ")}`, async ({ page }) => {
    await line(page, latex, at);
    const got: string[] = [];
    for (let i = 0; i <= want.length; i++) {
      await tap(page, GROW);
      got.push((await selected(page)).latex);
    }
    expect(got).toEqual([...want, want[want.length - 1]]); // at the whole line it stays
  });

test("a chip is one term: 2+Ans×3, from after the chip: the chip, chip×3, the line", async ({ page }) => {
  await tap(page, ["d2", "add", "shift", "add", "mul", "d3", "left", "left"]);
  const got: string[] = [];
  for (let i = 0; i < 3; i++) {
    await tap(page, GROW);
    got.push((await selected(page)).latex);
  }
  expect(got).toEqual(["\\ans", "\\ans\\times3", "2+\\ans\\times3"]);
});

test("on a picked row Select does nothing: the pick stays, the line has no selection", async ({ page }) => {
  await tap(page, ["d2", "add", "d3", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await tap(page, ["up"]); // picks the row (P4)
  await expect(page.locator('[data-selected="true"]')).toHaveCount(1);
  await tap(page, GROW);
  await expect(page.locator('[data-selected="true"]')).toHaveCount(1);
  expect(await selected(page)).toEqual({ range: [0, 0], latex: "" });
});

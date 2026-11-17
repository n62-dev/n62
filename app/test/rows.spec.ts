// SPDX-License-Identifier: GPL-3.0-or-later
// R11: the actions of a history row (Home and CAS), from keys and from touch. One list of seven on ☰ (S2 rules M1, M2; R720: Insert and
// Recall went, Copy and Copy as became Copy ›), acting on the picked row, else the last result (Delete: the last row); the picked row's
// buttons are Store ▶ and Copy › (R276: a hold copies, a swipe deletes, rowgestures.spec.ts); ◀ on a pick recalls it. Expected values are derived: 1/3 and 2/3 as 12 shown digits.
import { expect, test, type Page } from "@playwright/test";
import { COPY, entryValue, open, tap, useClipboardLock } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
test.describe.configure({ mode: "serial" });

useClipboardLock(); // R74f1: first hook, so the lock is held before the page opens

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

const clipboard = (page: Page): Promise<string> => page.evaluate(() => navigator.clipboard.readText());
const done = (page: Page, n: number) => expect(page.locator('[data-status="done"]')).toHaveCount(n);
const bar = (page: Page) => page.getByTestId("row-actions");
const item = (page: Page, name: RegExp) => page.getByTestId("menu").getByRole("menuitem", { name });

/** 1÷3, 2÷3 and 1÷4, each finished. */
async function three(page: Page): Promise<void> {
  for (const keys of [["d1", "div", "d3"], ["d2", "div", "d3"], ["d1", "div", "d4"]]) {
    await tap(page, [...keys, "enter"]);
  }
  await done(page, 3);
}

test("Up on an empty line shows the row buttons; typing hides them", async ({ page }) => {
  await three(page);
  await expect(bar(page)).toHaveCount(0);
  await tap(page, ["up"]);
  await expect(bar(page).getByRole("button")).toHaveText(["Store ▶", "Copy ›"]);
  await tap(page, ["d5"]);
  await expect(bar(page)).toHaveCount(0);
  expect(await entryValue(page)).toBe("5");
});

test("the row buttons and ☰ act on the picked row (touch)", async ({ page }) => {
  await three(page);
  await tap(page, ["up", "up"]); // 2/3
  await bar(page).getByRole("button", { name: "Copy ›" }).tap();
  await item(page, /Exact/).tap();
  await expect.poll(() => clipboard(page)).toBe("2/3");
  await expect(bar(page)).toHaveCount(0); // an action ends the pick
  await tap(page, ["up", "up", ...COPY]); // ☰ 2 › 1 Copy › Full value on a pick (R278: the Copy key is gone)
  await expect.poll(() => clipboard(page)).toBe("0." + "6".repeat(39) + "7");
  await tap(page, ["up", "up", "enter"]); // Enter on the pick inserts the result (R720: ☰ has no Insert)
  expect(await entryValue(page)).toContain("\\res");
});

test("◀ on a pick with an empty line puts its entry back on the line and drops the pick (R720)", async ({ page }) => {
  await tap(page, ["d1", "add", "d2", "enter", "d3", "mul", "d4", "enter"]);
  await done(page, 2);
  await tap(page, ["up", "up", "left"]);
  expect(await entryValue(page)).toBe("1+2");
  await expect(bar(page)).toHaveCount(0);
});

test("the hardware ArrowLeft does the same (R720)", async ({ page }) => {
  await tap(page, ["d1", "add", "d2", "enter", "d3", "mul", "d4", "enter"]);
  await done(page, 2);
  await tap(page, ["up", "up"]);
  await page.keyboard.press("ArrowLeft");
  expect(await entryValue(page)).toBe("1+2");
  await expect(bar(page)).toHaveCount(0);
});

test("◀ on a picked error row gives its input back (R720)", async ({ page }) => {
  await tap(page, ["d1", "emark", "d2", "dot", "d5", "enter"]); // 1ᴇ2.5
  await expect(page.locator('[data-status="error"]')).toHaveCount(1);
  await tap(page, ["up", "left"]);
  expect(await entryValue(page)).not.toBe("");
  await expect(bar(page)).toHaveCount(0);
});

test("controls: tap a row, type 5, ◀ moves the caret and the line stays 5", async ({ page }) => {
  await three(page);
  await tap(page, ["up", "d5", "left"]);
  expect(await entryValue(page)).toBe("5");
  await expect(bar(page)).toHaveCount(0);
});

test("controls: ▲ Enter inserts the result chip, two taps on the input recall it and two on the result insert it", async ({ page }) => {
  await three(page);
  await tap(page, ["up", "enter"]);
  expect(await entryValue(page)).toContain("\\res");
  await tap(page, ["esc"]);
  await page.locator('[data-testid="result"] .result').last().tap();
  await page.locator('[data-testid="result"] .result').last().tap();
  expect(await entryValue(page)).toContain("\\res");
  await tap(page, ["esc"]);
  await page.locator('[data-testid="result"] button.in').last().tap();
  await page.locator('[data-testid="result"] button.in').last().tap();
  expect(await entryValue(page)).toBe("\\frac14");
});

test("controls: Shift + ᴇ on a pick opens Store in; Shift + Esc clears the history of the line", async ({ page }) => {
  await three(page);
  await tap(page, ["up", "shift", "emark"]);
  await expect(page.getByTestId("sheet-title")).toContainText("Store");
  await tap(page, ["esc", "esc"]);
  await tap(page, ["d5", "shift", "esc"]);
  expect(await entryValue(page)).toBe("");
});

test("Store ▶ puts the result and the store arrow on the line, ready for the name", async ({ page }) => {
  await three(page);
  await tap(page, ["up"]);
  await bar(page).getByRole("button", { name: "Store ▶" }).tap();
  const v = await entryValue(page);
  expect(v).toContain("\\res");
  expect(v.endsWith("\\blacktriangleright")).toBe(true);
  await tap(page, ["alpha", "vars", "enter"]); // 1/4 ▶ A
  await done(page, 4);
  await tap(page, ["alpha", "vars", "enter"]);
  await expect(page.locator('[data-testid="result"] .result').last()).toHaveAttribute("data-text", "0.25");
});

test("Menu is one list of seven, Export › the seventh (R145: Settings is the ⚙, not a row; R720), the same with or without a picked row", async ({ page }) => {
  await three(page);
  const names = ["Store ▶", "Copy›", "Delete", "Paste", "Share session", "Clear history", "Export›"];
  await tap(page, ["@menu"]);
  await expect(page.getByTestId("menu").getByRole("menuitem")).toHaveText(names.map((n, i) => `${i + 1}${n}`));
  await tap(page, ["esc", "up", "@menu"]);
  await expect(page.getByTestId("menu").getByRole("menuitem")).toHaveText(names.map((n, i) => `${i + 1}${n}`));
  // 8, 9 and 0 are blank: the sheet stays open and nothing runs
  await tap(page, ["d8", "d9", "d0"]);
  await expect(page.getByTestId("menu")).toBeVisible();
  await expect(page.getByTestId("menu").getByRole("menuitem")).toHaveCount(7);
  expect(await entryValue(page)).toBe("");
  await done(page, 3);
});

test("Menu 3 deletes the last row when none is picked", async ({ page }) => {
  await three(page);
  await tap(page, ["@menu", "d3"]);
  await done(page, 2);
});

test("Menu 3 on a picked row deletes that row, not the last", async ({ page }) => {
  await three(page);
  // the middle of three: the keys' Delete on a pick (R276: the bar has none; TalkBack cannot swipe)
  await tap(page, ["up", "up", "@menu", "d3"]);
  await done(page, 2);
  const texts = await page.locator('[data-testid="result"] .result').evaluateAll((els) => els.map((e) => e.getAttribute("data-text")));
  expect(texts).toEqual(["0.333333333333", "0.25"]);
});

test("Menu 2 opens Copy: full value, as shown, exact, LaTeX, Python; 2 1 writes what a hold does (R720)", async ({ page }) => {
  await tap(page, ["d1", "div", "d3", "enter"]);
  await done(page, 1);
  await tap(page, ["@menu", "d2"]);
  await expect(page.getByTestId("sheet-title")).toHaveText(/Copy$/);
  await expect(page.getByTestId("menu").getByRole("menuitem")).toHaveText(["1Full value", "2As shown", "3Exact", "4LaTeX", "5Python"]);
  await tap(page, ["d3"]);
  await expect.poll(() => clipboard(page)).toBe("1/3");
  await tap(page, ["@menu", "d2", "d1"]);
  await expect.poll(() => clipboard(page)).toBe("0." + "3".repeat(40));
  const held = page.locator('[data-testid="result"] .result').first();
  const box = await held.boundingBox();
  if (!box) throw new Error("no result row");
  await page.evaluate(() => navigator.clipboard.writeText("x"));
  await page.mouse.move(box.x + 4, box.y + 4);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect.poll(() => clipboard(page)).toBe("0." + "3".repeat(40));
});

test("a long press (a mouse held) copies that row's result and opens no menu (R276)", async ({ page }) => {
  await three(page);
  const first = page.locator('[data-testid="result"] .result').first();
  const box = await first.boundingBox();
  if (!box) throw new Error("no result row");
  await page.mouse.move(box.x + 4, box.y + 4);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect.poll(() => clipboard(page)).toBe("0." + "3".repeat(40));
  await page.waitForTimeout(200);
  await expect(page.getByTestId("menu")).toHaveCount(0);
  await expect(bar(page)).toHaveCount(0); // the click after the lift picks nothing
  await done(page, 3);
});

test("with an empty history the actions are disabled; with only an error row they say why", async ({ page }) => {
  await tap(page, ["@menu"]);
  await expect(item(page, /^1 ?Store/)).toBeDisabled();
  await expect(item(page, /^3 ?Delete/)).toBeDisabled();
  await expect(item(page, /^6 ?Clear history/)).toBeDisabled();
  await tap(page, ["esc", "d1", "emark", "d2", "dot", "d5", "enter"]); // 1ᴇ2.5: an error row: there are rows, but no result
  await expect(page.locator('[data-status="error"]')).toHaveCount(1);
  await tap(page, ["@menu"]);
  await expect(item(page, /^1 ?Store/)).toBeDisabled();
  await expect(page.getByTestId("menu")).toContainText("No result yet");
  await expect(item(page, /^2 ?Copy/)).toBeDisabled();
});

test("the row buttons cost no viewport: on an empty line no history pixel and no key moves (R3, R147)", async ({ page }) => {
  await three(page);
  const top = () => page.locator('[data-key="d5"]').evaluate((e) => e.getBoundingClientRect().top);
  const rows = () => page.locator("article.item").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
  const scroll = () => page.locator("section.history").evaluate((e) => [e.scrollTop, e.getBoundingClientRect().height]);
  const [before, rowsBefore, scrollBefore] = [await top(), await rows(), await scroll()];
  await tap(page, ["up"]);
  await expect(bar(page)).toBeVisible();
  expect(await top()).toBe(before);
  expect(await rows()).toEqual(rowsBefore);
  expect(await scroll()).toEqual(scrollBefore);
  await tap(page, ["up"]); // walking the rows moves nothing either
  expect(await rows()).toEqual(rowsBefore);
});

test("CAS has the same buttons and its own rows", async ({ page }) => {
  await tap(page, ["d1", "d2", "enter"]);
  await done(page, 1);
  await tap(page, ["@cas", "d3", "d4", "enter"]);
  await done(page, 1); // the CAS history is separate
  await tap(page, ["up"]);
  await expect(bar(page).getByRole("button")).toHaveText(["Store ▶", "Copy ›"]);
  await tap(page, ["@menu", "d3"]); // ☰ 3 Delete on the pick
  await expect(page.locator('[data-status="done"]')).toHaveCount(0);
  await tap(page, ["@home"]);
  await done(page, 1); // Home still has its row
  await tap(page, ["@menu"]);
  await expect(page.getByTestId("menu").getByRole("menuitem")).toHaveCount(7); // the seven (R720)
});

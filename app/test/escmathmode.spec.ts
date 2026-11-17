// SPDX-License-Identifier: GPL-3.0-or-later
// R582 (F362): a physical Escape is the Esc key (it clears the line, R45) and leaves the field typing maths. Before,
// MathLive's own keydown handler, inside the field's shadow root, took Escape first and switched the field to its LaTeX
// mode: every key typed after it went into MathLive's blue LaTeX buffer and the line stayed empty until a second
// Escape threw the buffer away. Key sequences on the real engine; expected values are derived (7 + 1 = 8, 4 = 4).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, lastResult, open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  await page.evaluate(() => window.n62.entry.focus());
});

const mode = (page: Page): Promise<string | undefined> => page.evaluate(() => window.n62.entry.field?.mode);
const resultIs = async (page: Page, text: string, count: number): Promise<void> => {
  await expect(page.locator('[data-status="done"]')).toHaveCount(count, { timeout: 15_000 });
  await expect(lastResult(page)).toHaveAttribute("data-text", text);
};

test.describe("R582: a physical Escape leaves the field in maths", () => {
  test("Home: Escape on a fresh line, then 7 + 1 Enter on the keypad gives 8 (the keys went into LaTeX mode)", async ({ page }) => {
    expect(await mode(page)).toBe("math");
    await page.keyboard.press("Escape");
    expect(await mode(page)).toBe("math");
    await tap(page, ["d7", "add", "d1"]);
    expect(await entryValue(page)).toBe("7+1");
    await tap(page, ["enter"]);
    await resultIs(page, "8", 1);
  });

  test("Home, desktop: 2+3 typed, Escape clears the line, 4 typed and Enter gives 4 (the 4 was lost)", async ({ page }) => {
    await page.keyboard.type("2+3");
    expect(await entryValue(page)).toBe("2+3");
    await page.keyboard.press("Escape");
    expect(await entryValue(page)).toBe("");
    expect(await mode(page)).toBe("math");
    await page.keyboard.type("4");
    expect(await entryValue(page)).toBe("4");
    await page.keyboard.press("Enter");
    await resultIs(page, "4", 1);
  });

  test("CAS: Escape, then 7 + 1 Enter on the keypad gives 8", async ({ page }) => {
    await page.evaluate(() => window.n62.session.setView("cas"));
    await page.evaluate(() => window.n62.entry.focus());
    await page.keyboard.press("Escape");
    expect(await mode(page)).toBe("math");
    await tap(page, ["d7", "add", "d1", "enter"]);
    await resultIs(page, "8", 1);
  });

  test("Function Symb: x typed, Escape clears the line, 2x typed reaches the line", async ({ page }) => {
    await tap(page, ["@symb"]);
    await page.waitForFunction(() => window.n62.shell.app === "function" && window.n62.shell.loading === null);
    await expect(page.getByTestId("entry-label")).toHaveText("F1(x)=");
    await page.evaluate(() => window.n62.entry.focus());
    await page.keyboard.type("x");
    await expect.poll(() => entryValue(page)).toBe("x");
    await page.keyboard.press("Escape");
    expect(await mode(page)).toBe("math");
    await page.keyboard.type("2x");
    await expect.poll(() => entryValue(page)).toBe("2x");
  });

  test("control: a physical Enter keeps the field in maths, 2+3 Enter gives 5", async ({ page }) => {
    await page.keyboard.type("2+3");
    await page.keyboard.press("Enter");
    await resultIs(page, "5", 1);
    expect(await mode(page)).toBe("math");
  });

  test("control: the on-screen Esc key clears the line and the next keys reach it", async ({ page }) => {
    await tap(page, ["d2", "add", "d3", "esc"]);
    expect(await entryValue(page)).toBe("");
    expect(await mode(page)).toBe("math");
    await tap(page, ["d4", "enter"]);
    await resultIs(page, "4", 1);
  });
});

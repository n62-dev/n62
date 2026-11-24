// SPDX-License-Identifier: GPL-3.0-or-later
// R898: a change of the line's owner is an undo boundary. Home and CAS share one entry line; a switch between them, and a
// name prompt's start and end, start the line's own undo afresh, so Undo never brings back another view's line or, in a
// name prompt, the line it set aside (h2 #10, F374). The fake engine; expected values are derived.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

const view = (page: Page) => page.evaluate(() => window.n62.session.view);
const label = (page: Page) => page.getByTestId("entry-label");

test("Home 1 Enter, 2 Enter; CAS; Undo: the CAS line stays empty, and Home's line is as it was", async ({ page }) => {
  await open(page);
  await tap(page, ["d1", "enter", "d2", "enter"]);
  await expect(page.locator('[data-testid="result"]')).toHaveCount(2);
  expect(await entryValue(page)).toBe("");
  await page.getByTestId("tab-slot").tap();
  expect(await view(page)).toBe("cas");
  await tap(page, ["undo"]);
  expect(await entryValue(page)).toBe(""); // (phase-1: `2`, Home's last input)
  await tap(page, ["undo"]);
  expect(await entryValue(page)).toBe("");
  await page.getByTestId("tab-home").tap();
  expect(await view(page)).toBe("home");
  expect(await entryValue(page)).toBe("");
});

test("Home's half-typed line: CAS and back; Undo there leaves it as it was", async ({ page }) => {
  await open(page);
  await tap(page, ["d4", "add", "d5"]);
  await page.getByTestId("tab-slot").tap();
  await tap(page, ["undo"]);
  expect(await entryValue(page)).toBe("4+5"); // (phase-1: `4+`, Home's typing undone in CAS)
  await page.getByTestId("tab-home").tap();
  await tap(page, ["undo"]);
  expect(await entryValue(page)).toBe("4+5");
});

test("Undo within one view after a switch takes back that view's own typing, and stops at the switch", async ({ page }) => {
  await open(page);
  await tap(page, ["d1", "enter"]);
  await page.getByTestId("tab-slot").tap();
  await tap(page, ["d3", "add", "d6"]);
  await tap(page, ["undo"]);
  expect(await entryValue(page)).toBe("3+");
  await tap(page, ["undo", "undo"]);
  expect(await entryValue(page)).toBe("");
  await tap(page, ["undo"]);
  expect(await entryValue(page)).toBe(""); // (the history stops at the switch)
  await tap(page, ["redo"]);
  expect(await entryValue(page)).toBe("3");
});

test("Presets › Save: Undo in the name prompt stops at the empty name; Esc gives Home's line back as it was (F374)", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page);
  await tap(page, ["d7", "add", "d1"]);
  await tap(page, ["@mode", "d5", "d1"]);
  await expect(label(page)).toHaveText("Preset name");
  expect(await entryValue(page)).toBe("");
  await tap(page, ["d2"]); // z (the prompt starts in Alpha, lower case)
  expect(await entryValue(page)).toBe("z");
  await tap(page, ["undo"]);
  expect(await entryValue(page)).toBe("");
  await tap(page, ["undo", "undo"]);
  expect(await entryValue(page)).toBe(""); // (phase-1: `7+`, Home's line under "Preset name")
  await expect(label(page)).toHaveText("Preset name");
  await tap(page, ["esc"]);
  await expect(label(page)).toHaveCount(0);
  expect(await entryValue(page)).toBe("7+1");
  await tap(page, ["undo"]);
  expect(await entryValue(page)).toBe("7+1"); // (the prompt's end is a boundary too: its name is not brought back)
});

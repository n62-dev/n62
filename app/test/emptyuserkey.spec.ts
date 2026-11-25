// SPDX-License-Identifier: GPL-3.0-or-later
// R705 (docs/05 3.4 "Your keys", docs/04 5.1): a tap on an empty free key (U1–U6) is no dead press: it opens Settings › Your
// keys on that slot's row (its tap row, or with Shift its Shift row), so the "＋" face does what it invites. A set key keeps
// its job, the press is counted under its key and layer as before (R127), and a free key inside Your keys still goes to its row.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, flick, open, tap } from "./helpers.ts";

const menu = (page: Page) => page.getByTestId("menu");
const find = (page: Page) => page.getByTestId("find");
const title = (page: Page) => page.getByTestId("sheet-title");
const mactive = (page: Page) => menu(page).locator('[role="menuitem"][data-active="true"]');
const factive = (page: Page) => find(page).locator('[role="menuitem"][data-active="true"]');
const count = (page: Page, name: string) => page.evaluate((n) => window.n62.session.taps.counts.keys[n] ?? 0, name);

test.beforeEach(async ({ page }) => {
  await open(page); // a fresh profile: every free key is empty
});

test("(a) a tap on an empty U3 opens Settings › Your keys on U3's tap row; Esc goes back a level", async ({ page }) => {
  await expect(page.locator('[data-key="u3"]')).toHaveAttribute("data-user", "empty");
  await expect(page.locator('[data-key="u3"]')).not.toHaveAttribute("data-dead", "true"); // drawn live: a tap does something
  await tap(page, ["u3"]);
  await expect(title(page)).toHaveText("Settings › Your keys");
  await expect(mactive(page)).toHaveAttribute("data-id", "u3:primary");
  expect(await entryValue(page)).toBe("");
  await tap(page, ["esc"]); // (R704, once merged, closes the sheet here: it was opened at a level)
  await expect(title(page)).toHaveText("Settings");
  await expect(mactive(page)).toHaveAttribute("data-id", "keys");
});

test("(b) Shift + an empty U5 opens the same level on U5's Shift row", async ({ page }) => {
  await tap(page, ["shift", "u5"]);
  await expect(title(page)).toHaveText("Settings › Your keys");
  await expect(mactive(page)).toHaveAttribute("data-id", "u5:shift");
  await expect(page.locator('[data-key="shift"]')).not.toHaveAttribute("aria-pressed", "true"); // the one-shot Shift is used up
});

test("(b) a flick up on an empty U6 opens its Shift row too", async ({ page }) => {
  await flick(page, "u6", "up");
  await expect(title(page)).toHaveText("Settings › Your keys");
  await expect(mactive(page)).toHaveAttribute("data-id", "u6:shift");
});

test("(c) a set key is untouched: U1 set to sin from Find types sin( on a tap; Alpha + U1 (no Alpha slot) is the tap", async ({ page }) => {
  await tap(page, ["u1"]); // R705: straight to U1's row
  await expect(mactive(page)).toHaveAttribute("data-id", "u1:primary");
  await tap(page, ["enter", "d1"]); // U1's level, Find…
  await expect(find(page)).toBeVisible();
  await flick(page, "d9", "down"); // s
  await tap(page, ["tan", "paren"]); // i n
  await expect(find(page).getByTestId("sheet-filter")).toHaveText("sin");
  await expect(factive(page)).toHaveAttribute("data-id", "fn:sin");
  await tap(page, ["enter"]);
  await expect(find(page)).toBeHidden();
  await tap(page, ["esc", "esc", "esc"]); // (the Find pick closed the sheets, R4b: these reach the empty line)
  await expect(menu(page)).toHaveCount(0);
  await expect(page.locator('[data-key="u1"]')).toHaveAttribute("data-user", "set");
  await tap(page, ["u1"]);
  await expect(menu(page)).toHaveCount(0);
  expect(await entryValue(page)).toMatch(/^\\sin\\left\(/);
  await tap(page, ["esc"]); // (Esc clears the line)
  await tap(page, ["alpha", "u1"]); // docs/04 5.1: an empty Alpha slot is the tap
  await expect(menu(page)).toHaveCount(0);
  expect(await entryValue(page)).toMatch(/^\\sin\\left\(/);
});

test("(d) the press is counted under its key and layer, as before (R127)", async ({ page }) => {
  // (a fresh profile: no press counted yet; the counter's chunk names each press once it is in, R320)
  await tap(page, ["u3"]);
  await expect.poll(() => count(page, "u3:primary")).toBe(1);
  await tap(page, ["esc", "esc", "esc"]);
  await tap(page, ["shift", "u5"]);
  await expect.poll(() => count(page, "u5:shift")).toBe(1);
  await expect.poll(() => count(page, "u3:primary")).toBe(1); // the Esc presses are not U3's
});

test("Alpha + an empty key is its tap (docs/04 5.1): U4's tap row", async ({ page }) => {
  await tap(page, ["alpha", "u4"]);
  await expect(title(page)).toHaveText("Settings › Your keys");
  await expect(mactive(page)).toHaveAttribute("data-id", "u4:primary");
});

test("a set tap with an empty Shift slot: Shift + the key opens its Shift row", async ({ page }) => {
  await page.evaluate(() => window.n62.userKeys.set("u2", "primary", { label: "Home", action: { special: "home" } }));
  await tap(page, ["shift", "u2"]);
  await expect(title(page)).toHaveText("Settings › Your keys");
  await expect(mactive(page)).toHaveAttribute("data-id", "u2:shift");
});

test.describe("controls", () => {
  test("inside Your keys a free key still goes to its own row (set or empty)", async ({ page }) => {
    await page.evaluate(() => window.n62.userKeys.set("u1", "primary", { label: "Home", action: { special: "home" } }));
    await tap(page, ["help", "d5"]); // Mode, Settings, Your keys
    await expect(title(page)).toHaveText("Settings › Your keys");
    await tap(page, ["u3"]);
    await expect(mactive(page)).toHaveAttribute("data-id", "u3:primary");
    await tap(page, ["u1"]);
    await expect(mactive(page)).toHaveAttribute("data-id", "u1:primary");
    await tap(page, ["shift", "u4"]);
    await expect(mactive(page)).toHaveAttribute("data-id", "u4:shift");
    await expect(title(page)).toHaveText("Settings › Your keys"); // no level pushed, nothing reached the line
    expect(await entryValue(page)).toBe("");
  });

  test("a set key that holds Settings opens Settings on its first row", async ({ page }) => {
    await page.evaluate(() => window.n62.userKeys.set("u2", "primary", { label: "Settings", action: { special: "settings" } }));
    await tap(page, ["u2"]);
    await expect(title(page)).toHaveText("Settings");
    await expect(mactive(page)).toHaveAttribute("data-id", "mode"); // R927: Mode is row 1
  });
});

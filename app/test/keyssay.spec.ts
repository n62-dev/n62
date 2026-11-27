// SPDX-License-Identifier: GPL-3.0-or-later
// R728 (owner, 2026-11-17): the keys say what they do. The letter line draws the letter Alpha and a flick down type in the
// view (CAS: lower case, R58); under Alpha, armed or locked, a key with no letter keeps the tap's colour, since Alpha
// there is its tap; its flick-down bubble is in the key pop's colour, not Alpha's.
import { expect, test, type Page } from "@playwright/test";
import { open, tap, touch } from "./helpers.ts";

const letter = (page: Page, id: string) => page.locator(`.pad [data-key="${id}"] .alphalegend`);
const face = (page: Page, id: string) => page.locator(`.pad [data-key="${id}"] .main`);
const bubble = (page: Page) => page.getByTestId("flick-bubble");

/** The computed colour of a token, as a probe inside the pad draws it (rgb(…), comparable with getComputedStyle). */
const tokenColour = (page: Page, token: string): Promise<string> =>
  page.evaluate((token) => {
    const pad = document.querySelector(".pad");
    const probe = document.createElement("span");
    probe.style.color = `var(${token})`;
    pad?.appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  }, token);
const colourOf = (page: Page, id: string): Promise<string> => face(page, id).evaluate((e) => getComputedStyle(e).color);

const LETTERLESS = ["esc", "undo", "bksp", "fmt", "dot", "space"];
const LETTERED = ["sin", "d7"];

test.beforeEach(async ({ page }) => open(page));

test("the letter line draws the letter in the case Alpha types in the view: Home G D #, CAS g d #", async ({ page }) => {
  await expect(letter(page, "sin")).toHaveText("G");
  await expect(letter(page, "x")).toHaveText("D");
  await expect(letter(page, "d3")).toHaveText("#");
  await tap(page, ["@cas"]);
  await page.waitForFunction(() => window.n62.session.view === "cas");
  await expect(letter(page, "sin")).toHaveText("g");
  await expect(letter(page, "x")).toHaveText("d");
  await expect(letter(page, "d3")).toHaveText("#");
  // Shift then Alpha in the CAS view: the capital, as now
  await tap(page, ["shift", "alpha"]);
  await expect(face(page, "sin")).toHaveText("G");
});

for (const how of ["armed", "locked"] as const)
  test(`under Alpha ${how}, a key with no letter keeps the tap's colour; a letter key takes Alpha's`, async ({ page }) => {
    const text = await tokenColour(page, "--key-text");
    const alpha = await tokenColour(page, "--key-alpha");
    expect(text).not.toBe(alpha);
    await tap(page, how === "armed" ? ["alpha"] : ["alpha", "alpha"]);
    expect(await page.evaluate(() => [window.n62.session.alpha, window.n62.session.alphaLock])).toEqual([true, how === "locked"]);
    for (const id of LETTERLESS) expect(await colourOf(page, id), id).toBe(text);
    for (const id of LETTERED) expect(await colourOf(page, id), id).toBe(alpha);
    expect(await colourOf(page, "enter"), "Enter keeps its own colour").toBe(await tokenColour(page, "--on-enter"));
    expect(await page.locator(".pad .arrows").evaluate((e) => getComputedStyle(e).color), "the round pad's arrows").toBe(text);
  });

test("a flick down on a key with no letter shows its tap in the key pop's colour; on sin the letter in Alpha's", async ({ page }) => {
  const text = await tokenColour(page, "--key-text");
  const alpha = await tokenColour(page, "--alpha");
  const f = await touch(page, "esc");
  await f.move(0, 35);
  await expect(bubble(page)).toHaveText("Esc");
  await expect(bubble(page)).toHaveAttribute("data-tap", "true");
  expect(await bubble(page).evaluate((e) => getComputedStyle(e).color)).toBe(text);
  await f.cancel();
  await expect(bubble(page)).toHaveCount(0);
  const g = await touch(page, "sin");
  await g.move(0, 35);
  await expect(bubble(page)).toHaveText("G");
  await expect(bubble(page)).not.toHaveAttribute("data-tap", "true");
  expect(await bubble(page).evaluate((e) => getComputedStyle(e).color)).toBe(alpha);
  await g.cancel();
});

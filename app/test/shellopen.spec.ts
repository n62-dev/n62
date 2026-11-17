// SPDX-License-Identifier: GPL-3.0-or-later
// R362 (S58 cuts 1 and 4): the shell's app-opening part (apps/shellOpen.ts) and the view tabs' icons are a lazy chunk that
// the first app key loads. Before it: every key, tap and the status line work with the shell's start part alone. With it:
// the app opens with its view tabs and their icons, Esc and Home bring you back, and an app open at the last exit comes
// back at start with its icons. The fake engine: no result here needs Giac.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, lastResult, open, tap } from "./helpers.ts";

/** The app-opening part is in (AppShell.code). */
const partIn = (page: Page): Promise<boolean> => page.evaluate(() => window.n62.shell.code !== null);
/** What each view tab draws: its icon's markup (an svg, or the math glyph). */
/** The app's view tabs (R722: the bar's Home and CAS tabs are tabs too, in their own list). */
const views = (page: Page) => page.getByRole("tablist", { name: "Views" }).getByRole("tab");
const tabIcons = (page: Page): Promise<Record<string, string>> =>
  page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.seg [role="tab"]')].map((t) => [t.getAttribute("data-testid") ?? "", t.querySelector("svg") ? "svg" : (t.querySelector(".math")?.textContent ?? "")])));

test("before any app opens, keys, taps and the status line work on the shell's start part, and its app-opening part is not loaded", async ({ page }) => {
  await open(page);
  await tap(page, ["d1", "add", "d2", "enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "1+2"); // the fake engine echoes
  await tap(page, ["@place"]); // the Apps sheet, then Esc
  await expect(page.getByTestId("apps")).toBeVisible();
  await tap(page, ["esc"]);
  await expect(page.getByTestId("apps")).toHaveCount(0);
  await tap(page, ["@menu"]); // Home's ☰ (the clipboard code, not the app part)
  await expect(page.getByTestId("menu")).toBeVisible();
  await tap(page, ["esc"]);
  await expect(views(page)).toHaveCount(0);
  expect(await partIn(page)).toBe(false);
});

test("the first app key on a cold start opens Function with its view tabs and their icons; Esc and Home bring you back", async ({ page }) => {
  await open(page);
  expect(await partIn(page)).toBe(false);
  await tap(page, ["d7"]); // Home's unentered line, set aside by the app and given back
  await tap(page, ["@symb"]);
  await page.waitForFunction(() => window.n62.shell.app === "function" && window.n62.shell.loading === null);
  expect(await partIn(page)).toBe(true);
  await expect(views(page)).toHaveCount(3);
  expect(await tabIcons(page)).toEqual({ "tab-symb": "ƒ=", "tab-plot": "svg", "tab-num": "svg" });
  await expect(page.getByTestId("tab-symb")).toHaveAttribute("aria-selected", "true");
  await page.getByTestId("tab-num").tap(); // a tab switches the view (setView, shown by the part)
  await expect(page.getByTestId("place")).toHaveAttribute("data-view", "num");
  await tap(page, ["@symb"]);
  await expect(page.getByTestId("place")).toHaveAttribute("data-view", "symb");
  await tap(page, ["d5"]);
  await tap(page, ["esc"]); // Esc puts back what the app last put on the line: nothing
  expect(await entryValue(page)).toBe("");
  await tap(page, ["@home"]);
  await expect(page.getByTestId("place")).toHaveAttribute("data-view", "home");
  await expect(views(page)).toHaveCount(0);
  expect(await entryValue(page)).toBe("7");
  await tap(page, ["add", "d1", "enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "7+1"); // the fake engine echoes
});

test("keys pressed while the first app opens wait for it and go to the app (R362: the part loads behind the same wait)", async ({ page }) => {
  await open(page);
  await page.route("**/shellOpen*", async (r) => {
    await new Promise((res) => setTimeout(res, 400)); // the part arrives late
    await r.continue();
  });
  await tap(page, ["@symb", "d3"]);
  await page.waitForFunction(() => window.n62.shell.app === "function" && window.n62.shell.loading === null);
  await expect.poll(() => entryValue(page)).toBe("3");
  await tap(page, ["enter"]); // typed in Function's Symb, not on Home's line: it is F1
  await expect(page.locator('[data-name="F1"] .math')).toHaveAttribute("data-latex", "3");
});

test("an app open at the last exit comes back at start with its view tabs and icons", async ({ page }) => {
  await open(page);
  await tap(page, ["@plot"]);
  await page.waitForFunction(() => window.n62.shell.app === "function" && window.n62.shell.view === "plot" && window.n62.shell.loading === null);
  await page.waitForTimeout(300); // the place is stored
  await page.reload();
  await page.waitForFunction(() => window.n62?.shell.app === "function" && window.n62.shell.loading === null && window.n62.shell.code !== null);
  await expect(page.getByTestId("tab-plot")).toHaveAttribute("aria-selected", "true");
  expect(await tabIcons(page)).toEqual({ "tab-symb": "ƒ=", "tab-plot": "svg", "tab-num": "svg" });
});

test("the update line shows on Home before any app opened, and beside the view tabs and their icons once an app is open", async ({ page }) => {
  await open(page);
  await page.evaluate(async () => {
    const url = "/src/state/updateOffer.svelte.ts"; // pwa.ts sets it in a real build (A49)
    const m = (await import(/* @vite-ignore */ url)) as typeof import("../src/state/updateOffer.svelte.ts");
    m.updateOffer.restart = () => {};
  });
  await expect(page.getByTestId("update-note")).toBeVisible(); // read at start: an update can wait before any app opens
  expect(await partIn(page)).toBe(false);
  await tap(page, ["@num"]);
  await page.waitForFunction(() => window.n62.shell.app === "function" && window.n62.shell.loading === null);
  await expect(page.getByTestId("update-note")).toBeVisible();
  expect(await tabIcons(page)).toEqual({ "tab-symb": "ƒ=", "tab-plot": "svg", "tab-num": "svg" });
  await expect(page.getByTestId("tab-num")).toHaveAttribute("aria-selected", "true");
});

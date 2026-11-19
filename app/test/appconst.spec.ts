// SPDX-License-Identifier: GPL-3.0-or-later
// R747: a constant from Find (or a free key) goes on an app's line as its value, never as a `\const` chip: the apps parse
// their lines without the chip table. Expected values are derived: c = 299792458 m/s exactly, G = 6.67430ᴇ-11 (CODATA 2022, the index keeps the trailing zero).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";
import type * as Finder from "../src/find/finder.ts";

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

/** The Find index's constant `id` on the entry line, as a pick puts it. */
async function pick(page: Page, id: string): Promise<void> {
  await page.evaluate(async (cid) => {
    const url = "/src/find/finder.ts";
    const f = (await import(/* @vite-ignore */ url)) as typeof Finder;
    const it = (await f.loadIndex(true)).byId.get(`const:${cid}`);
    if (!it) throw new Error(`no constant ${cid} in the index`);
    f.putOnLine(window.n62.entry, it);
  }, id);
}

/** The constant `id` on the free key U1 (Settings › Your keys, R4b), as Find's slot pick sets it. */
async function onU1(page: Page, id: string): Promise<void> {
  await page.evaluate(async (cid) => {
    const url = "/src/find/finder.ts";
    const f = (await import(/* @vite-ignore */ url)) as typeof Finder;
    const it = (await f.loadIndex(true)).byId.get(`const:${cid}`);
    if (!it) throw new Error(`no constant ${cid} in the index`);
    window.n62.userKeys.set("u1", "primary", f.bindingOf(it));
  }, id);
}

async function openSolve(page: Page): Promise<void> {
  await tap(page, ["@place", "d4"]);
  await expect(page.locator('[data-app="solve"]')).toBeVisible();
  await tap(page, ["@symb"]);
  await expect(page.getByTestId("entry-label")).toHaveText("E1:");
}

const solveValue = (page: Page, name: string) => page.locator(`[data-testid="solve-table"] tr[data-name="${name}"] td`);

test("Solve › Symb: x = c, c from Find, is the digits; Num solves it to 299792458", async ({ page }) => {
  await openSolve(page);
  await tap(page, ["x", "shift", "dot"]);
  await pick(page, "c");
  expect(await entryValue(page)).toBe("x=299792458");
  expect(await page.evaluate(() => window.n62.entry.chips)).toEqual({});
  await expect(page.getByTestId("notice")).toHaveText("In an app a constant goes in as its value");
  await tap(page, ["enter"]);
  await expect(page.locator('[data-name="E1"] .math')).toHaveAttribute("data-latex", "x=299792458");
  await expect(page.locator('[data-name="E1"]')).not.toContainText("missing");
  await tap(page, ["@num"]);
  await expect(solveValue(page, "x")).toBeVisible();
  await tap(page, ["@menu", "d1"]); // Solve
  await expect(solveValue(page, "x")).toHaveText("299792458");
});

test("control: the same Solve line with the digits typed by hand solves the same", async ({ page }) => {
  await openSolve(page);
  await tap(page, ["x", "shift", "dot", "d2", "d9", "d9", "d7", "d9", "d2", "d4", "d5", "d8", "enter", "@num"]);
  await expect(solveValue(page, "x")).toBeVisible();
  await tap(page, ["@menu", "d1"]);
  await expect(solveValue(page, "x")).toHaveText("299792458");
});

test("Function › F1: x × G, G from Find, is one bracketed term; Plot draws, Num gives 6.6743E-11 at x = 1", async ({ page }) => {
  await tap(page, ["@symb"]);
  await expect(page.getByTestId("entry-label")).toHaveText("F1(x)=");
  await tap(page, ["x", "mul"]);
  await pick(page, "G");
  expect(await entryValue(page)).toBe("x\\times\\left(6.67430\\times10^{-11}\\right)");
  await tap(page, ["enter"]);
  await expect(page.locator('[data-name="F1"]')).not.toContainText("missing");
  await tap(page, ["@plot"]);
  await expect(page.locator(".board canvas")).toBeVisible();
  await page.waitForFunction(() => window.n62.plot.board !== undefined);
  expect(await page.evaluate(() => window.n62.plot.curves)).toBe(1);
  await tap(page, ["@num"]);
  await tap(page, ["@menu", "d2", "d1", "enter"]); // step 1
  const cell = page.locator('[data-testid="num-table"] tr:has(td[data-x="1"]) td').nth(1);
  await expect(cell).toHaveAttribute("data-text", "6.6743E-11");
});

test("Solve › Num: a constant on a value line is the number (digits with the exponent key), not a chip", async ({ page }) => {
  await openSolve(page);
  await tap(page, ["x", "shift", "dot", "d1", "enter", "@num"]);
  await expect(solveValue(page, "x")).toBeVisible();
  await tap(page, ["shift", "esc"]);
  await pick(page, "G");
  expect(await entryValue(page)).toBe("6.67430\\emark-11");
});

test("Function › F1: a constant beside a digit is its own term (2 then c is 2×299792458), and the refused line keeps the note", async ({ page }) => {
  await tap(page, ["@symb"]);
  await expect(page.getByTestId("entry-label")).toHaveText("F1(x)=");
  await tap(page, ["d2"]);
  await pick(page, "c");
  expect(await entryValue(page)).toBe("2\\times299792458");
  await tap(page, ["esc"]);
  await tap(page, ["d2"]);
  await pick(page, "G");
  expect(await entryValue(page)).toBe("2\\times\\left(6.67430\\times10^{-11}\\right)");
});

test("a refused line puts nothing in the table and says no note", async ({ page }) => {
  await openSolve(page);
  await page.evaluate(() => window.n62.entry.insert("\\const{c}{c}+\\ans"));
  expect(await entryValue(page)).toBe("");
  await expect(page.getByTestId("notice")).toHaveCount(0);
});

test("a free key holding c: in Solve it types the value, in Home it types the chip", async ({ page }) => {
  await onU1(page, "c");
  await tap(page, ["u1"]);
  expect(await entryValue(page)).toBe("\\const{c}{c}");
  await tap(page, ["esc"]);
  await openSolve(page);
  await tap(page, ["x", "shift", "dot", "u1"]);
  expect(await entryValue(page)).toBe("x=299792458");
  expect(await page.evaluate(() => window.n62.entry.chips)).toEqual({});
});

test("control: in Home a constant from Find is a chip that carries its σ", async ({ page }) => {
  await pick(page, "G");
  expect(await entryValue(page)).toBe("\\const{G}{G}");
  const chips = await page.evaluate(() => window.n62.entry.chips);
  expect(chips["const:G"]?.unc).toBeTruthy();
});

test("control: Ans is refused in an app; a chip put in by any path is refused too", async ({ page }) => {
  await tap(page, ["d1", "add", "d1", "enter"]);
  await openSolve(page);
  await tap(page, ["x", "shift", "dot", "shift", "add"]); // Shift + Ans
  expect(await entryValue(page)).toBe("x=");
  await page.evaluate(() => {
    window.n62.entry.insert("\\ans");
    window.n62.entry.insert("\\res{1}{3}");
    window.n62.entry.insert("\\const{c}{c}");
  });
  expect(await entryValue(page)).toBe("x=");
});

// SPDX-License-Identifier: GPL-3.0-or-later
// R585 (F365), on the real engine: ∥ (Shift + `( )`, R323) pressed right after a value takes the value in as par()'s first
// argument, the cursor in a second box: 5 ∥ 20 is par(5, 20) = 4, where the plain insert made 5·par(20) = 100 with an =
// mark. The operand is the term before the cursor (entry/term.ts): a number, a name, a chip, a closing bracket's group, a
// template. After an operator, on an empty line and with a selection the key inserts par(□) as before (R323).
// Expected values derived: par(a, b) = 1/(1/a + 1/b); par(5, 20) = 100/25 = 4; par(3, 6) = 18/9 = 2, 2·2 = 4.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, lastResult, open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

/** par() on the line. MathLive wraps an \operatorname's name in \mathrm or not, by how the insert met the line
 *  (parpercent.spec.ts): `line` reads the name bare. */
const par = (body: string): string => `\\operatorname{par}\\left(${body}\\right)`;
const line = async (page: Page): Promise<string> => (await entryValue(page)).replaceAll("\\operatorname{\\mathrm{par}}", "\\operatorname{par}");
const PAR_KEY = ["shift", "paren"];
const D20 = ["d2", "d0"];

test("5 ∥ 20: the line is par(5,□), filled par(5,20); Enter gives = 4", async ({ page }) => {
  await tap(page, ["d5", ...PAR_KEY]);
  expect(await line(page)).toBe(par("5,\\placeholder{}"));
  await tap(page, D20);
  expect(await line(page)).toBe(par("5,20"));
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "4");
  await expect(page.getByTestId("mark").last()).toHaveAttribute("data-mark", "=");
});

test("a stored name: R holds 5, R ∥ 20 gives 4", async ({ page }) => {
  await tap(page, ["d5", "shift", "emark", "alpha", "d8", "enter"]);
  await tap(page, ["alpha", "d8", ...PAR_KEY, ...D20]);
  expect(await line(page)).toBe(par("R,20"));
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "4");
});

test("a closing bracket's group is the operand: (2+3) ∥ 20 gives 4", async ({ page }) => {
  await tap(page, ["paren", "d2", "add", "d3", "right", ...PAR_KEY, ...D20]);
  expect(await line(page)).toBe(par("\\left(2+3\\right),20"));
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "4");
});

test("a template and a chip are operands: 10/2 ∥ 20 and Ans ∥ 20 give 4", async ({ page }) => {
  await tap(page, ["d1", "d0", "div", "d2", "right", ...PAR_KEY, ...D20]);
  expect(await line(page)).toBe(par("\\frac{10}{2},20"));
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "4");
  await tap(page, ["d5", "enter", "shift", "add", ...PAR_KEY, ...D20]);
  expect(await line(page)).toBe(par("\\ans,20"));
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "4");
});

test("a power with its base, and a number with its ᴇ part, are one operand: 2² ∥ 4ᴇ0 gives 2", async ({ page }) => {
  // par(4, 4) = 2 (derived); 2², x² after a digit, raises the 2 alone
  await tap(page, ["d2", "sq", "right", ...PAR_KEY, "d4"]);
  expect(await line(page)).toBe(par("2^2,4"));
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "2");
  await tap(page, ["d1", "emark", "d1", ...PAR_KEY, "d5"]);
  expect(await line(page)).toMatch(/^\\operatorname\{par\}\\left\(1\\emark1,5\\right\)$/);
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "3.33333333333"); // par(10, 5) = 50/15 = 10/3
});

test("a % goes with its term: 50 % ∥ 1 is par(0.5, 1) = 1/3", async ({ page }) => {
  // derived: 1/(2 + 1) = 1/3
  await tap(page, ["d5", "d0", "shift", "d0", ...PAR_KEY, "d1"]);
  expect(await line(page)).toBe(par("50\\%,1"));
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "0.333333333333");
});

test("with the decimal comma (R57) the separator is the , key's own ;: 2,5 ∥ 10 is par(2.5, 10) = 2", async ({ page }) => {
  // derived: 1/(0.4 + 0.1) = 2
  await page.evaluate(() => window.n62.session.setDecimalMark("comma"));
  await tap(page, ["d2", "dot", "d5", ...PAR_KEY, "d1", "d0"]);
  expect(await line(page)).toBe(par("2{,}5;10"));
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "2");
});

// ---- Controls: these passed before R585 and must pass after it

test("control: after an operator ∥ is a prefix, 2 × ∥ 3 , 6 is 2·par(3,6) = 4", async ({ page }) => {
  await tap(page, ["d2", "mul", ...PAR_KEY, "d3", "comma", "d6"]);
  expect(await line(page)).toBe(`2\\times${par("3,6")}`);
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "4");
});

test("control: ∥ on an empty line is par(□), cursor inside", async ({ page }) => {
  await tap(page, PAR_KEY);
  expect(await line(page)).toBe(par("\\placeholder{}"));
  await tap(page, ["d5", "comma", ...D20]);
  expect(await line(page)).toBe(par("5,20"));
});

test("control: with a selection ∥ wraps it (#0): 2+3 selected gives par(2+3)", async ({ page }) => {
  await tap(page, ["d2", "add", "d3", "select", "select", ...PAR_KEY]);
  expect(await line(page)).toBe(par("2+3"));
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "5");
});

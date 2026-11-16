// SPDX-License-Identifier: GPL-3.0-or-later
// R334 (F184): x², xʸ and x⁻¹ (and ÷) right after Shift + 2's i, or a bare e, take it as their base or numerator, as after
// a letter. MathLive's #@ takes only the atom types of its isImplicitArg (0.111.1); `\imaginaryI` and `\exponentialE`
// are macro atoms of its default macro table, not among them, so the template opened on an empty base after them
// (`\imaginaryI` then xʸ 2 was `\imaginaryI 2^{□}`). Values derived by hand (i² = −1, i⁻¹ = −i, 2·i³ = −2i, i/2), iⁱ =
// e^(−π/2) = 0.207879576351 (source: oracle, mpmath), e² = 7.38905609893 (source: oracle). The controls after a digit, a
// letter, π and a chip held before R334 too; the bracket group and the matrix are tmpl.spec.ts's R75 cases.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, lastResult, open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

const mark = (page: Page) => page.locator('[data-testid="result"]').last().locator('[data-testid="mark"]');
const I = ["shift", "d2"];

/** Enter, then the result's text and mark. */
async function result(page: Page, text: string, m: string): Promise<void> {
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", text);
  await expect(mark(page)).toHaveAttribute("data-mark", m);
}

const CASES: [string, string[], string, string, string][] = [
  ["i, xʸ 2", [...I, "pow", "d2", "right"], "\\imaginaryI^{2}", "-1", "="],
  ["i, x²", [...I, "sq"], "\\imaginaryI^2", "-1", "="],
  ["i, x⁻¹", [...I, "shift", "div"], "\\imaginaryI^{-1}", "-i", "="],
  ["i, ÷ 2", [...I, "div", "d2", "right"], "\\frac{\\imaginaryI}{2}", "i/2", "="],
  // the control: after a number the key raises the i alone, as it raises a letter alone (2x³)
  ["2 i, xʸ 3", ["d2", ...I, "pow", "d3", "right"], "2\\imaginaryI^{3}", "-2*i", "="],
];
for (const [name, keys, line, text, m] of CASES)
  test(`R334: ${name} takes the i as its base: ${line} = ${text}`, async ({ page }) => {
    await tap(page, keys);
    expect(await entryValue(page)).toBe(line);
    await result(page, text, m);
  });

test("R334: i, xʸ, i gives iⁱ = 0.207879576351 with the mark a typed e^(−π/2) gets", async ({ page }) => {
  await tap(page, ["shift", "ln", "neg", "shift", "d3", "div", "d2", "enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "0.207879576351");
  const want = await mark(page).getAttribute("data-mark");
  expect(want).not.toBeNull();
  await tap(page, [...I, "pow", ...I]);
  expect(await entryValue(page)).toBe("\\imaginaryI^{\\imaginaryI}");
  await result(page, "0.207879576351", want as string);
});

test("R334: a bare e (a result's e put on the line), xʸ 2 gives e² = 7.38905609893", async ({ page }) => {
  await page.evaluate(() => window.n62.entry.set("\\exponentialE"));
  await tap(page, ["pow", "d2", "right"]);
  expect(await entryValue(page)).toBe("\\exponentialE^{2}");
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "7.38905609893");
});

// Controls (pass before R334 too): x² after a digit, a letter, π and a chip is unchanged
const CONTROLS: [string, string[], string][] = [
  ["a digit", ["d3", "sq"], "3^2"],
  ["a letter", ["d2", "x", "sq"], "2x^2"],
  ["π", ["shift", "d3", "sq"], "\\pi^2"],
  ["a letter after i", [...I, "x", "sq"], "\\imaginaryI x^2"],
];
for (const [name, keys, line] of CONTROLS)
  test(`R334 control: x² after ${name} is ${line}`, async ({ page }) => {
    await tap(page, keys);
    expect(await entryValue(page)).toBe(line);
  });

test("R334 control: x² after a chip takes the chip whole", async ({ page }) => {
  await page.evaluate(() => window.n62.entry.insertConst("c", "c", { value: "299792458", exact: true }));
  const chip = await entryValue(page);
  await tap(page, ["sq"]);
  expect(await entryValue(page)).toBe(`${chip}^2`);
});

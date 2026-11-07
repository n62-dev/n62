// SPDX-License-Identifier: GPL-3.0-or-later
// R158 (F190): a plain number too wide for its row (mark, sign, grouped mantissa, optional exponent) wraps at a group gap onto a
// second line, full size, right-aligned: nothing scrolls, nothing fades. Every other result keeps the sideways scroll and
// its fade. Expected digits: mpmath at 30 digits, e^(π√163) = 262537412640768743.999999999999 (the 30 significant digits),
// √2 = 1.41421356237309504880168872421; 30 digits shown, the engine's own rounding.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { lastResult, open, tapTwice } from "./helpers.ts";

test.describe.configure({ mode: "serial" });

const done = (page: Page, n: number) => expect(page.locator('[data-status="done"]')).toHaveCount(n);
async function run(page: Page, latex: string, rows: number): Promise<void> {
  await page.evaluate((l) => window.n62.session.submit(l), latex);
  await done(page, rows);
}
const out = (page: Page): Locator => page.locator('[data-testid="result"]').last();

/** The y of every piece's top, grouped to lines: the pieces' text per drawn line, left to right. */
const lines = (page: Page): Promise<string[]> =>
  out(page).evaluate((o) => {
    const rows: { y: number; x: number; t: string }[] = [...o.querySelectorAll(".piece")].map((p) => {
      const b = p.getBoundingClientRect();
      return { y: Math.round(b.top), x: b.left, t: (p.textContent ?? "").replace(/\s+/g, "") };
    });
    const ys = [...new Set(rows.map((r) => r.y))].sort((a, b) => a - b);
    return ys.map((y) => rows.filter((r) => r.y === y).sort((a, b) => a.x - b.x).map((r) => r.t).join("|"));
  });

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  await page.evaluate(() => window.n62.session.setDigits(30));
});

for (const width of [360, 412] as const) {
  test.describe(`${width} px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.waitForTimeout(100);
    });

    for (const [name, latex, digits] of [
      ["e^(π√163)", "\\exponentialE^{\\pi\\sqrt{163}}", "262537412640768743999999999999"],
      ["√2", "\\sqrt{2}+0.5", "191421356237309504880168872421"],
    ] as const) {
      test(`${name} at 30 digits wraps at a group gap, nothing scrolls or fades`, async ({ page }) => {
        await run(page, latex, 1);
        const o = out(page);
        await expect(o.locator(".piece").first()).toBeVisible();
        await expect(o).not.toHaveAttribute("data-cut", /.*/);
        const box = await o.evaluate((e) => ({ sw: e.scrollWidth, cw: e.clientWidth, h: e.getBoundingClientRect().height, line: parseFloat(getComputedStyle(e).lineHeight) || 0, right: e.getBoundingClientRect().right }));
        expect(box.sw).toBeLessThanOrEqual(box.cw + 1);
        const ls = await lines(page);
        expect(ls).toHaveLength(2);
        // the mark stays with the first group; the pieces together hold every digit, each group whole
        const all = ls.join("|").replace(/^[=≈]/, "");
        expect(all.replace(/[|.]/g, "")).toBe(digits.slice(0, all.replace(/[|.]/g, "").length));
        const groups = all.split("|");
        for (const g of groups) expect(g).toMatch(/^\d{1,3}(\.\d{1,3})?$/); // a whole group, never cut inside
        expect(ls[0]).toMatch(/^[=≈]/);
        // every digit inside the row's box; the second line ends at the row's right edge (right-aligned)
        const edges = await out(page).locator(".piece").evaluateAll((ps, r) => ps.map((p) => ({ l: p.getBoundingClientRect().left, r: p.getBoundingClientRect().right, top: p.getBoundingClientRect().top })).map((b) => ({ ...b, rr: r })), box.right);
        const rowBox = await o.boundingBox();
        for (const e of edges) {
          expect(e.l).toBeGreaterThanOrEqual(rowBox!.x - 1);
          expect(e.r).toBeLessThanOrEqual(rowBox!.x + rowBox!.width + 1);
        }
        const lastTop = Math.max(...edges.map((e) => e.top));
        const lastRight = Math.max(...edges.filter((e) => e.top === lastTop).map((e) => e.r));
        const firstRight = Math.max(...edges.filter((e) => e.top !== lastTop).map((e) => e.r));
        expect(Math.abs(lastRight - firstRight)).toBeLessThanOrEqual(2); // both lines end at the same right edge
      });
    }

    test("a tap picks the row, a second tap inserts the whole value (a piece on either line)", async ({ page }) => {
      await run(page, "\\exponentialE^{\\pi\\sqrt{163}}", 1);
      const pieces = out(page).locator(".piece");
      await expect(pieces.first()).toBeVisible();
      await pieces.last().tap(); // the second line
      await expect(page.locator('[data-selected="true"]')).toHaveCount(1);
      await pieces.first().tap(); // the first
      const v = await page.evaluate(() => window.n62.entry.value);
      expect(v).toContain("\\res");
      expect(v).not.toMatch(/\\,/);
    });

    test("a short number is one line and a number with a unit, an expression, a list and a matrix scroll with the fade", async ({ page }) => {
      await page.evaluate(() => window.n62.session.setDigits(12));
      await run(page, "1/3", 1);
      await expect(out(page).locator(".piece")).toHaveCount(0);
      await expect(out(page)).not.toHaveAttribute("data-cut", /.*/);
      await page.evaluate(() => window.n62.session.setDigits(30));

      // a unit row keeps the line (its unit is drawn after the number)
      await run(page, "\\sqrt{3}", 2);
      await expect(out(page).locator(".piece").first()).toBeVisible(); // 30 digits: a plain number wraps
      await page.evaluate(() => {
        const it = window.n62.session.items.at(-1)!;
        it.units = { text: " m", latex: "\\,\\mathrm{m}" } as never;
      });
      await expect(out(page).locator(".piece")).toHaveCount(0);

      const scrolls = async (n: number): Promise<void> => {
        await done(page, n);
        await expect(out(page).locator(".piece")).toHaveCount(0);
        await expect(out(page)).toHaveAttribute("data-cut", "end");
        const m = await out(page).evaluate((e) => ({ s: e.scrollWidth, c: e.clientWidth, h: e.getBoundingClientRect().height }));
        expect(m.s).toBeGreaterThan(m.c);
      };
      await run(page, "x_{1}+x_{2}+x_{3}+x_{4}+x_{5}+x_{6}+x_{7}+x_{8}+x_{9}+x_{10}+x_{11}+x_{12}", 3);
      await scrolls(3);
      await run(page, "\\left\\{" + Array.from({ length: 14 }, (_, i) => `${1000000 + i}`).join(",") + "\\right\\}", 4);
      await scrolls(4);
      await run(page, "\\begin{bmatrix}100000000001&200000000002&300000000003\\\\400000000004&500000000005&600000000006\\end{bmatrix}", 5);
      await scrolls(5);
    });
  });
}

test("with the apostrophe or the comma as the separator, the digits before the point wrap at their gaps", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.evaluate(() => (window.n62.session.settings.groupSep = "apos"));
  await run(page, "\\exponentialE^{\\pi\\sqrt{163}}", 1);
  await expect(out(page).locator(".piece").first()).toBeVisible();
  await expect(out(page)).not.toHaveAttribute("data-cut", /.*/);
  const ls = await lines(page);
  expect(ls.join("|")).toMatch(/^[=≈]262’\|537’/);
  await page.evaluate(() => (window.n62.session.settings.groupSep = "comma"));
  await expect(out(page).locator(".piece").first()).toContainText("262,");
});

test("the exponent stays with the last group of a number in scientific form", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.evaluate(() => window.n62.session.setFormat("sci"));
  await run(page, "\\exponentialE^{\\pi\\sqrt{163}}", 1);
  const last = out(page).locator(".piece").last();
  await expect(last).toContainText("10");
  await expect(last).toContainText("17");
  await expect(lastResult(page)).toHaveAttribute("data-text", /E17$/);
  await tapTwice(last);
});

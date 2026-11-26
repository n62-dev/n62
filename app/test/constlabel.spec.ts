// SPDX-License-Identifier: GPL-3.0-or-later
// R929 (owner, 2026-11-23, bug list 4 point 3): in the unit view a constant shows its own unit after its chip, muted and
// read-only, before any key (h J·s, k_B J/K; α none). The label is in the field's LaTeX only: never a slot (◀ ▶ and a tap
// skip it), never in the line nor the request, so Enter's result is G801's. On the engine.
import { expect, test, type Page } from "@playwright/test";
import { flick, open, tap } from "./helpers.ts";

const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const activeId = (page: Page): Promise<string | undefined> => page.evaluate(() => window.n62.unitView?.view.activeId);
/** The muted texts the field draws (unitLatex's `\htmlStyle{color:var(--muted)…}` spans), in order. */
const labels = (page: Page): Promise<string[]> =>
  page.evaluate(() => [...(window.n62.unitView?.field.shadowRoot?.querySelectorAll('[style*="--muted"]') ?? [])].map((e) => (e.textContent ?? "").trim()));
const value = (page: Page): Promise<string> => page.evaluate(() => window.n62.unitView?.field.value ?? "");
const result = (page: Page) => page.getByTestId("unit-result");

/** Home's line set to `latex`, then the units key. */
async function unitsOn(page: Page, latex: string): Promise<void> {
  await page.evaluate((l) => window.n62.entry.set(l), latex);
  await flick(page, "tmpl", "up"); // the units key
  await up(page);
}

test.describe("R929: a constant's own unit after its chip in the unit view", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await open(page, "");
    await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  });

  test("h: J·s after it before any key; Enter gives G801's result; the line and the request hold no label", async ({ page }) => {
    await unitsOn(page, "\\const{planck}{h}");
    await expect.poll(() => labels(page)).toEqual(["J·s"]);
    expect(await value(page)).toMatch(/\\const\{planck\}\{h\}\\htmlStyle\{color:var\(--muted\);font-size:smaller\}\{\\,\\text\{J·s\}\}/);
    expect(await page.evaluate(() => window.n62.unitView?.view.line)).toBe("\\const{planck}{h}");
    expect(await page.evaluate(() => window.n62.unitView?.view.request().formula)).not.toMatch(/J|htmlStyle/);
    await tap(page, ["enter"]);
    await expect(result(page)).toHaveAttribute("data-unit", "J·s");
    await expect(result(page)).toHaveAttribute("data-text", "6.62607015E-34"); // derived: the exact 2019 SI value
  });

  test("2h: 2[ ] h J·s; k_B: J/K; α: none", async ({ page }) => {
    await unitsOn(page, "2\\const{planck}{h}");
    await expect.poll(() => labels(page)).toEqual(["J·s"]);
    expect(await value(page)).toMatch(/^2\\placeholder\[u1\](?:\[locked\])?\{.*\}\\const\{planck\}\{h\}\\htmlStyle/);
    await tap(page, ["esc"]);
    await unitsOn(page, "\\const{k_B}{k_{\\mathrm{B}}}");
    await expect.poll(() => labels(page)).toEqual(["J/K"]);
    await tap(page, ["esc"]);
    await unitsOn(page, "2\\const{alpha}{\\alpha}");
    await expect.poll(() => page.evaluate(() => window.n62.unitView?.view.line)).toBe("2\\const{alpha}{\\alpha}");
    expect(await labels(page)).toEqual([]);
  });

  test("a power stays on the constant: m·c² shows c² then m/s (never c m/s²), h² shows h² then J·s", async ({ page }) => {
    /** The superscripts' left edges and the label's, in px: every ² must sit left of the label, none after it. */
    const boxes = (): Promise<{ sups: number[]; label: number }> =>
      page.evaluate(() => {
        const root = window.n62.unitView?.field.shadowRoot;
        const label = root?.querySelector('[style*="--muted"]')?.getBoundingClientRect().left ?? Number.NaN;
        return { sups: [...(root?.querySelectorAll(".ML__msubsup") ?? [])].map((e) => e.getBoundingClientRect().left), label };
      });
    for (const [line, unit, power] of [["m\\const{c}{c}^{2}", "m/s", "\\^\\{?2\\}?"], ["\\const{planck}{h}^2", "J·s", "\\^\\{?2\\}?"]] as const) {
      await unitsOn(page, line);
      await expect.poll(() => labels(page)).toEqual([unit]);
      expect(await value(page)).toMatch(new RegExp(`${power}\\\\htmlStyle\\{color:var\\(--muted\\)`));
      const b = await boxes();
      expect(b.sups.length).toBeGreaterThan(0);
      for (const x of b.sups) expect(x).toBeLessThan(b.label);
      await tap(page, ["esc"]);
    }
  });

  test("◀ ▶ and a tap skip the label: 2h·3 goes u1 → u2, a tap on J·s changes no slot", async ({ page }) => {
    await unitsOn(page, "2\\const{planck}{h}\\times3");
    await expect.poll(() => labels(page)).toEqual(["J·s"]);
    expect(await page.evaluate(() => window.n62.unitView?.view.ids)).toEqual(["u1", "u2"]);
    expect(await activeId(page)).toBe("u1");
    await tap(page, ["right"]);
    expect(await activeId(page)).toBe("u2");
    await tap(page, ["left"]);
    expect(await activeId(page)).toBe("u1");
    const box = await page.evaluate(() => {
      const r = window.n62.unitView?.field.shadowRoot?.querySelector('[style*="--muted"]')?.getBoundingClientRect();
      return r && { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (!box) throw new Error("no label box");
    await page.touchscreen.tap(box.x, box.y);
    await page.waitForTimeout(200);
    expect(await activeId(page)).toBe("u1");
  });
});

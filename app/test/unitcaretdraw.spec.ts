// SPDX-License-Identifier: GPL-3.0-or-later
// R807 (the owner's walk, point C2): the unit view's active slot draws its caret, a thin bar (class `pas-caret`) before the factor at the
// caret or after the last one; no other slot, the history row, Copy or Share holds it (it is drawn only by view.ts `#draw`, never in
// SlotModel.latex). The slot model's marks (`pas-armed`, `pas-rare`, `pas-empty`) are drawn in the field's shadow root, where no
// stylesheet of the page reaches: an armed prefix is not in the plain text colour. Shots at 412 × 915 in N62 Dark and Light.
import { expect, test, type Page } from "@playwright/test";
import { flick, open, tap } from "./helpers.ts";

test.use({ viewport: { width: 412, height: 915 }, permissions: ["clipboard-read", "clipboard-write"] });

const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const setLook = (page: Page, brightness: string): Promise<void> =>
  page.evaluate(async (brightness) => {
    const url = "/src/theme/apply.ts";
    const m = (await import(/* @vite-ignore */ url)) as typeof import("../src/theme/apply.ts");
    await m.applyTheme({ family: "n62", brightness, contrast: "normal", keys: "colour" } as never, document.documentElement);
  }, brightness);
/** How many elements of `cls` the unit field's shadow root holds. */
const count = (page: Page, cls: string): Promise<number> =>
  page.evaluate((c) => window.n62.unitView?.field.shadowRoot?.querySelectorAll(`.${c}`).length ?? -1, cls);

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  await tap(page, ["d5", "add", "d6"]); // 5 + 6: two slots
  await flick(page, "tmpl", "up");
  await up(page);
});

test("with 5 km typed the active slot has one caret and the other none; Enter moves it; the row and Copy hold none", async ({ page }) => {
  await expect.poll(() => count(page, "pas-caret"), { message: "an empty active slot" }).toBe(1);
  await tap(page, ["d4", "d9"]); // k, m
  await expect.poll(() => page.evaluate(() => window.n62.unitView?.field.shadowRoot?.textContent?.includes("km") ?? false)).toBe(true);
  await expect.poll(() => count(page, "pas-caret")).toBe(1);
  const order = await page.evaluate(() => {
    const root = window.n62.unitView?.field.shadowRoot;
    const caret = root?.querySelector(".pas-caret")?.getBoundingClientRect();
    const slots = [...(root?.querySelectorAll(".ML__prompt") ?? [])].map((p) => p.getBoundingClientRect());
    return { caret: caret?.left ?? -1, first: slots[0], second: slots[1] };
  });
  const bar = await page.evaluate(() => {
    const el = window.n62.unitView?.field.shadowRoot?.querySelector(".pas-caret");
    const r = el?.getBoundingClientRect();
    return { w: r?.width ?? -1, h: r?.height ?? -1, border: el ? getComputedStyle(el).borderLeftWidth : "", colour: el ? getComputedStyle(el).borderLeftColor : "", text: getComputedStyle(window.n62.unitView?.field as Element).color };
  });
  expect(parseFloat(bar.border), "a bar of a px or two").toBeGreaterThanOrEqual(1);
  expect(bar.h, "as high as a letter").toBeGreaterThan(8);
  expect(bar.colour, "in the text colour").toBe(bar.text);
  expect(order.caret, "inside the first slot").toBeGreaterThan(order.first?.left ?? 1e9);
  expect(order.caret).toBeLessThan(order.first?.right ?? -1);
  await tap(page, ["enter"]); // to the second slot
  await expect.poll(() => count(page, "pas-caret")).toBe(1);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const root = window.n62.unitView?.field.shadowRoot;
        const caret = root?.querySelector(".pas-caret")?.getBoundingClientRect().left ?? -1;
        const slots = [...(root?.querySelectorAll(".ML__prompt") ?? [])].map((p) => p.getBoundingClientRect());
        return caret >= (slots[1]?.left ?? 1e9) - 1;
      }),
      { message: "the caret is in the second slot now" },
    )
    .toBe(true);
  await tap(page, ["d4", "d9"]); // km again
  await flick(page, "enter", "up"); // evaluate at once: 5 km + 6 km
  await expect(page.getByTestId("unit-result")).toBeVisible({ timeout: 30_000 });
  const row = await page.evaluate(() => JSON.stringify(window.n62.session.home.at(-1) ?? null));
  expect(row).not.toBe("null");
  expect(row).not.toContain("pas-caret");
  expect(row).not.toContain("border-left"); // (the caret's style)
  await tap(page, ["shift", "select"]);
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("km");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).not.toContain("pas-caret");
  expect(await page.locator("article.item").evaluateAll((els) => els.map((e) => e.innerHTML).join(""))).not.toContain("pas-caret");
});

test("the marks are drawn: an armed prefix is not in the plain text colour; Dark and Light shots", async ({ page }, info) => {
  const colours = (): Promise<{ armed: string; text: string; bg: string } | null> =>
    page.evaluate(() => {
      const root = window.n62.unitView?.field.shadowRoot;
      const el = root?.querySelector(".pas-armed");
      const field = window.n62.unitView?.field;
      if (!el || !field) return null;
      return { armed: getComputedStyle(el).color, text: getComputedStyle(field).color, bg: getComputedStyle(el).backgroundColor };
    });
  for (const brightness of ["dark", "light"]) {
    await setLook(page, brightness);
    await tap(page, ["d4"]); // the prefix k armed
    await expect.poll(() => count(page, "pas-armed"), { message: `${brightness}: the armed prefix is marked` }).toBe(1);
    const c = await colours();
    expect(c?.armed, `${brightness}: armed colour`).not.toBe(c?.text);
    expect(c?.bg, `${brightness}: armed ground`).not.toBe("rgba(0, 0, 0, 0)");
    await page.screenshot({ path: info.outputPath(`r807-armed-${brightness}.png`) });
    await tap(page, ["d9"]); // km
    await page.screenshot({ path: info.outputPath(`r807-caret-${brightness}.png`) });
    await tap(page, ["bksp", "bksp"]);
  }
});

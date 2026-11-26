// SPDX-License-Identifier: GPL-3.0-or-later
// R870 (owner, 2026-11-22, S3 point 11): Help in the unit view (Shift + the ⚙ key, R863) opens a sheet "Help: <the slot>" over
// the view: a row per factor with its exact size from the index (R869's value line), then the whole slot in SI; an armed prefix
// alone gives its own row; an empty slot the units tip. Esc, Back, × or a second Help close it onto the view as it was, the focus on
// the view (R838's path); Help in the unit view's Find stays R869's card. At 412 × 915 and 360 × 740, the fake engine. Expected values
// are the index's (find/units.yaml, the generator's `si`: km 1000, h 3600, so km/h = 1000/3600 = 5/18 m/s). N62_SHOTS=<dir>: the
// km/h and the empty slot's help at 360 × 740 are saved there for the report.
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { flick, open, tap } from "./helpers.ts";

const HELP = ["shift", "help"];
const sheet = (page: Page) => page.getByTestId("menu");
const title = (page: Page) => sheet(page).getByTestId("sheet-title");
const row = (page: Page, id: string) => sheet(page).locator(`[role="menuitem"][data-id="${id}"]`);
/** A row's label (the row's text starts with its pick number). */
const label = (page: Page, id: string) => row(page, id).locator(".label");
const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
/** The view's slot as text: `k:m / h`, `` (empty). */
const slotOf = (page: Page, id: string): Promise<string> =>
  page.evaluate((id) => {
    const s = window.n62.unitView?.view.model(id)?.slot;
    return (s?.tokens ?? []).map((t, i) => `${i === s?.per ? "/ " : ""}${t.prefix ? `${t.prefix}:` : ""}${t.unit}${t.power ? `^${t.power}` : ""}`).join(" ");
  }, id);
const activeId = (page: Page): Promise<string | undefined> => page.evaluate(() => window.n62.unitView?.view.activeId);
const armed = (page: Page, id: string): Promise<string | undefined> => page.evaluate((id) => window.n62.unitView?.view.model(id)?.armed.prefix, id);
/** The sheet is closed and the focus is on the unit view's element (the hardware keys reach it at once). */
const backOnView = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.shell.sheet === null && window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element);
async function shot(page: Page, name: string): Promise<void> {
  const dir = process.env["N62_SHOTS"];
  if (dir && page.viewportSize()?.width === 360) await page.screenshot({ path: join(dir, `${name}.png`) });
}

/** 72, the units key: the view with u1 empty and active. */
async function view72(page: Page): Promise<void> {
  await open(page);
  await tap(page, ["d7", "d2"]);
  await flick(page, "tmpl", "up");
  await up(page);
  expect(await activeId(page)).toBe("u1");
}
/** k m ÷ h in u1. */
async function kmPerH(page: Page): Promise<void> {
  await tap(page, ["d4", "d9", "div"]);
  await flick(page, "d3", "up");
  expect(await slotOf(page, "u1")).toBe("k:m / h");
}
/** The km/h sheet's rows. */
async function kmhSheet(page: Page): Promise<void> {
  await expect(title(page)).toHaveText("Help: km/h");
  await expect(label(page, "f0")).toHaveText(/^km · \S+: 1 km = 1000 m/);
  await expect(row(page, "f0").getByTestId("row-hint")).toHaveText("exact");
  await expect(label(page, "f1")).toHaveText(/^h · \S+: 1 h = 3600 s/);
  await expect(label(page, "total")).toHaveText("1 km/h = 5/18 m/s");
  await expect(row(page, "total").getByTestId("row-hint")).toHaveText("≈ 0.277777777778 m/s");
}

for (const [width, height] of [[412, 915], [360, 740]] as const) {
  test.describe(`R870: Help in the unit view, ${width} × ${height}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: "reduce" });
    });

    test("72, units, k m ÷ h, Help: the sheet Help: km/h with the rows; Esc: the view as it was, the focus on it", async ({ page }) => {
      await view72(page);
      await kmPerH(page);
      await tap(page, HELP);
      await expect(sheet(page)).toBeVisible();
      await kmhSheet(page);
      await shot(page, "unithelp-kmh");
      await tap(page, ["esc"]);
      await backOnView(page);
      expect(await slotOf(page, "u1")).toBe("k:m / h");
      expect(await activeId(page)).toBe("u1");
      await page.keyboard.press("s"); // R313: a hardware letter types into the slot
      await expect.poll(() => slotOf(page, "u1")).toBe("k:m / h s");
    });

    test("a second Help, ×, and Back (R700) each close the sheet onto the view", async ({ page }) => {
      await view72(page);
      await kmPerH(page);
      await tap(page, HELP);
      await kmhSheet(page);
      await tap(page, HELP);
      await backOnView(page);
      expect(await page.evaluate(() => window.n62.session.shift)).toBe(false); // (Shift + ⚙ used its one-shot Shift up)
      await tap(page, HELP);
      await kmhSheet(page);
      await sheet(page).getByRole("button", { name: "Close" }).tap();
      await backOnView(page);
      await tap(page, HELP);
      await kmhSheet(page);
      await page.goBack(); // (Android back: the WebView's goBack())
      await backOnView(page);
      expect(await slotOf(page, "u1")).toBe("k:m / h");
      expect(await activeId(page)).toBe("u1");
    });

    test("an empty slot: Help shows the units tip", async ({ page }) => {
      await view72(page);
      await tap(page, HELP);
      await expect(title(page)).toHaveText("Help: unit slot");
      await expect(sheet(page).getByTestId("sheet-text")).toContainText("Units: type the numbers, then Shift + Units (Tmpl)");
      await shot(page, "unithelp-empty");
      await tap(page, ["esc"]);
      await backOnView(page);
      expect(await slotOf(page, "u1")).toBe("");
    });

    test("k armed, Help: kilo's row; after Esc k is still armed", async ({ page }) => {
      await view72(page);
      await tap(page, ["d4"]);
      expect(await armed(page, "u1")).toBe("k");
      await tap(page, HELP);
      await expect(title(page)).toHaveText("Help: k");
      await expect(label(page, "armed")).toHaveText(/^k · kilo: × 1000 = 10³/);
      await tap(page, ["esc"]);
      await backOnView(page);
      expect(await armed(page, "u1")).toBe("k");
      await tap(page, ["d9"]); // m after it: km
      expect(await slotOf(page, "u1")).toBe("k:m");
    });

    test("control: Help in the unit view's Find is R869's card", async ({ page }) => {
      await view72(page);
      await tap(page, ["math"]);
      const find = page.getByTestId("find");
      await expect(find).toBeVisible();
      await flick(page, "d9", "down"); // s
      for (let i = 0; i < 12 && (await find.locator('[role="menuitem"][data-active="true"]').getAttribute("data-id")) !== "unit:s"; i++) await tap(page, ["down"]);
      await expect(find.locator('[role="menuitem"][data-active="true"]')).toHaveAttribute("data-id", "unit:s");
      await tap(page, HELP);
      await expect(find.getByTestId("sheet-title")).toHaveText(/Help: Second$/);
      await expect(find.locator('[role="menuitem"][data-id="value"]')).toContainText("1 s = 1 s");
    });
  });
}

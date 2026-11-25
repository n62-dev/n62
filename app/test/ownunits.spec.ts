// SPDX-License-Identifier: GPL-3.0-or-later
// G234: your own units (G233) are kept: a definition in the stamped store (`units.own`) is still there after a relaunch
// (5 myfurlong → m, picked through the unit view's Find, is 5 × 201.168 m = 1005.84 m on the real engine; 201.168 m = 25146/125 m, derived), a backup holds it
// and a restore into an empty store brings it back, and a definition that is gone leaves the slot refused in words. There is
// no screen to make a unit yet (R201), so the record is seeded in the store the way a first run leaves it; the unit
// evaluator is the unit view's own (Calc.units). Find already has `furlong`, so the example's name is myfurlong.
import { devices, expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { flick, open, savePicker, tap } from "./helpers.ts";

const DEF = { name: "myfurlong", factor: "201.168", of: { tokens: [{ unit: "m" }] } };
const REQ = { formula: "5*pasu1", slots: [{ tokens: [{ unit: "@myfurlong" }] }], end: { tokens: [{ unit: "m" }] } };
const ready = (page: Page): Promise<unknown> => page.waitForFunction(() => window.n62?.session.engineState === "ready", undefined, { timeout: 30_000 });

/** Write a record into the store the way the app does (stamped), from the page. */
const seed = (page: Page, key: string, value: unknown): Promise<void> =>
  page.evaluate(
    ([k, v]) =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open("n62");
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const tx = r.result.transaction("kv", "readwrite");
          tx.objectStore("kv").put({ "@n62": 4, value: v }, k as string);
          tx.oncomplete = () => (r.result.close(), resolve());
          tx.onerror = () => reject(tx.error);
        };
      }),
    [key, value] as const,
  );

/** 5 of the unit in m, as the unit view's evaluator answers it. */
const five = (page: Page): Promise<{ unit?: string; display?: string; error?: string }> =>
  page.evaluate(async (req) => {
    const q = (await window.n62.calc.units(req, { digits: 12, angle: "rad", format: "std" })) as { unit?: string; value?: { display?: string }; error?: string };
    return { ...(q.unit !== undefined ? { unit: q.unit } : {}), ...(q.value?.display !== undefined ? { display: q.value.display } : {}), ...(q.error !== undefined ? { error: q.error } : {}) };
  }, REQ);

async function dataSection(page: Page): Promise<void> {
  await tap(page, ["help"]);
  await page.getByTestId("menu").locator('[data-id="data"]').tap();
  await expect(page.getByTestId("sheet-title")).toHaveText("Settings › Data");
}

/** The key whose Alpha layer is a letter: Find types it on a flick down, on any key (docs/04 3.7), as unitfind.spec.ts. */
const LETTER = new Map<string, string>();
for (const k of (parse(readFileSync(fileURLToPath(new URL("../../spec/keyboard.yaml", import.meta.url)), "utf8")) as { keys: { id: string; alpha?: { type?: string } }[] }).keys) {
  const t = k.alpha?.type;
  if (t !== undefined && /^[A-Za-z]$/.test(t) && !LETTER.has(t.toLowerCase())) LETTER.set(t.toLowerCase(), k.id);
}
async function typeFind(page: Page, text: string): Promise<void> {
  for (const ch of text.toLowerCase()) {
    const id = LETTER.get(ch);
    if (!id) throw new Error(`no key types ${ch}`);
    if (/^d\d$/.test(id)) await flick(page, id, "down");
    else await tap(page, [id]);
  }
}
const find = (page: Page) => page.getByTestId("find");
/** Math opens Find on units; the letters are searched and the first hit (`id`) is picked. */
async function pickUnit(page: Page, letters: string, id: string): Promise<void> {
  await tap(page, ["math"]);
  await expect(find(page)).toBeVisible();
  await typeFind(page, letters);
  await expect(find(page).getByRole("menuitem").first()).toHaveAttribute("data-id", id);
  await tap(page, ["enter"]);
  await expect(find(page)).toBeHidden();
}

test("5 myfurlong → m in the unit view after a relaunch: picked through Find, the stored definition gives 1005.84 m; without it Find has no such unit and the slot is refused in words", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page, "");
  await ready(page);
  expect(await five(page)).toEqual({ error: "own" }); // nothing stored: refused, no crash
  await seed(page, "units.own", { units: [DEF] });
  await page.reload(); // the relaunch
  await page.waitForFunction(() => window.n62 !== undefined && customElements.get("math-field") !== undefined);
  await ready(page);
  await page.evaluate(() => window.n62.entry.ready);
  await tap(page, ["d5"]);
  await flick(page, "tmpl", "up"); // the unit view
  await page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
  await pickUnit(page, "myfurlong", "unit:@myfurlong");
  await page.getByTestId("unit-check").tap(); // R349: → Check brings the end slot
  await pickUnit(page, "m", "unit:m");
  await flick(page, "enter", "up"); // evaluate
  const result = page.getByTestId("unit-result");
  await expect(result).toHaveAttribute("data-text", "1005.84");
  await expect(result).toHaveAttribute("data-unit", "m");
  expect(await five(page)).toEqual({ unit: "m", display: "1005.84" });
  // the definition deleted: the unit view's Find has no myfurlong, and the evaluator refuses a slot that names it
  await tap(page, ["esc"]);
  await seed(page, "units.own", { units: [] });
  await page.reload();
  await page.waitForFunction(() => window.n62 !== undefined && customElements.get("math-field") !== undefined);
  await ready(page);
  await page.evaluate(() => window.n62.entry.ready);
  expect(await five(page)).toEqual({ error: "own" });
  await tap(page, ["d5"]);
  await flick(page, "tmpl", "up");
  await page.waitForFunction(() => window.n62.unitView !== undefined && document.querySelector('[data-pad="unit"]') !== null);
  await tap(page, ["math"]);
  await expect(find(page)).toBeVisible();
  await typeFind(page, "myfurlong");
  await expect(find(page).locator('[data-id="unit:@myfurlong"]')).toHaveCount(0);
});

test("a backup holds your units and a restore into an empty store brings them back", async ({ page, browser }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 412, height: 915 });
  await savePicker(page, "none"); // the file comes back as a download
  await open(page, "");
  await ready(page);
  await seed(page, "units.own", { units: [DEF] });
  await dataSection(page);
  const download = page.waitForEvent("download");
  await page.getByTestId("menu").locator('[data-id="backup"]').tap();
  const path = (await (await download).path()) as string;
  const file = JSON.parse((await import("node:fs")).readFileSync(path, "utf8")) as { parts: Record<string, { value: unknown }> };
  expect(file.parts["units.own"]?.value).toEqual({ units: [DEF] });

  const ctx = await browser.newContext({ ...devices["Pixel 7"], baseURL: new URL(page.url()).origin });
  const other = await ctx.newPage();
  await open(other, "");
  await ready(other);
  expect(await five(other)).toEqual({ error: "own" });
  await dataSection(other);
  const chooser = other.waitForEvent("filechooser");
  await other.getByTestId("menu").locator('[data-id="restore"]').tap();
  await (await chooser).setFiles(path);
  await expect(other.getByTestId("sheet-title")).toHaveText("Restore from a file");
  await expect(other.getByTestId("menu").locator('[data-id="units.own"]')).toBeVisible();
  const load = other.waitForEvent("load");
  await other.getByTestId("menu").locator('[data-id="restore"]').tap();
  await load;
  await other.waitForFunction(() => window.n62 !== undefined);
  await ready(other);
  expect(await five(other)).toEqual({ unit: "m", display: "1005.84" });
  await ctx.close();
});

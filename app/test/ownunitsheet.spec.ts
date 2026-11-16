// SPDX-License-Identifier: GPL-3.0-or-later
// R201: Settings › Your keys › Your units: a sheet to make your own unit (G233's model, G234's store). New opens a form
// (Name, Factor, Made of, Save): each of the three is typed in the entry line under its label, as a preset's name is, and
// the form comes back with the value. Save checks the definition (G233: validateDef) and says why not in the Save row; a
// good one is stored, listed by its name with `factor unit`, and found by the unit view's Find. A unit's row opens the same
// form to change it (Delete asks once: a first tap arms it, a second removes). `furlong` is Find's, so the example's name
// is myfurlong (G233 refuses the other). The fake engine: nothing here evaluates (ownunits.spec.ts does, on the real one).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, flick, open, sheet, tap } from "./helpers.ts";

const title = (page: Page) => page.getByTestId("sheet-title");
const row = (page: Page, id: string) => sheet(page).locator(`[role="menuitem"][data-id="${id}"]`);
const rowIds = (page: Page) => sheet(page).getByRole("menuitem").evaluateAll((els) => els.map((e) => e.getAttribute("data-id")));
const label = (page: Page) => page.getByTestId("entry-label");
const notice = (page: Page) => page.getByTestId("notice");

/** Settings › Your keys › Your units. */
async function yourUnits(page: Page): Promise<void> {
  await tap(page, ["@mode", "d6", "d4"]);
  await expect(title(page)).toHaveText("Mode › Settings › Your keys");
  await row(page, "units").tap();
  await expect(title(page)).toHaveText("Mode › Settings › Your keys › Your units");
}

/** A form row is tapped, its value typed on the keyboard under the label, Enter: the form is back. */
async function fill(page: Page, id: string, entryLabel: string, text: string, formTitle: string): Promise<void> {
  await row(page, id).tap();
  await expect(label(page)).toHaveText(entryLabel);
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
  await expect(label(page)).toHaveCount(0);
  await expect(title(page)).toHaveText(formTitle);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
});

test("Your units: New makes myfurlong (201.168 m), a name Find has is refused with its reason, the unit view's Find lists it, an edit changes the factor, Delete asks once", async ({ page }) => {
  test.setTimeout(120_000);
  await yourUnits(page);
  await expect.poll(() => rowIds(page)).toEqual(["new"]);
  await row(page, "new").tap();
  await expect(title(page)).toHaveText("New unit");
  expect(await rowIds(page)).toEqual(["name", "factor", "of", "save"]);

  // a name Find has: Save says so, in the Save row, and stores nothing
  await fill(page, "name", "Unit name", "furlong", "New unit");
  await expect(row(page, "name").getByTestId("sheet-value")).toHaveText("furlong");
  await fill(page, "factor", "Factor", "201.168", "New unit");
  await fill(page, "of", "Made of", "m", "New unit");
  await row(page, "save").tap();
  await expect(row(page, "save").getByTestId("row-hint")).toContainText("Find already has furlong");
  await expect(title(page)).toHaveText("New unit"); // the form stays

  // the name of its own: stored, and the list says what it is
  await fill(page, "name", "Unit name", "myfurlong", "New unit");
  await row(page, "save").tap();
  await expect(notice(page)).toHaveText("Saved myfurlong");
  await expect(sheet(page)).toHaveCount(0);
  await yourUnits(page);
  expect(await rowIds(page)).toEqual(["new", "u:myfurlong"]);
  await expect(row(page, "u:myfurlong").getByTestId("sheet-value")).toHaveText("201.168 m");

  // it is in the unit view's Find (the pad's pick list)
  await tap(page, ["esc"]);
  await tap(page, ["d5"]);
  await flick(page, "tmpl", "up");
  await page.waitForFunction(() => window.n62.unitView !== undefined && document.querySelector('[data-pad="unit"]') !== null);
  await tap(page, ["math"]);
  await expect(page.getByTestId("find")).toBeVisible();
  await page.keyboard.type("myfurlong");
  await expect(page.getByTestId("find").locator('[data-id="unit:@myfurlong"]')).toHaveCount(1);
  await tap(page, ["esc", "esc"]);

  // an edit: the factor changes (and a factor that is no number is refused in words)
  await tap(page, ["@mode", "d6", "d4"]);
  await row(page, "units").tap();
  await row(page, "u:myfurlong").tap();
  await expect(title(page)).toHaveText("myfurlong");
  expect(await rowIds(page)).toEqual(["name", "factor", "of", "save", "delete"]);
  await expect(row(page, "factor").getByTestId("sheet-value")).toHaveText("201.168");
  await fill(page, "factor", "Factor", "1,5", "myfurlong");
  await row(page, "save").tap();
  await expect(row(page, "save").getByTestId("row-hint")).toContainText("is not a number");
  await fill(page, "factor", "Factor", "200", "myfurlong");
  await row(page, "save").tap();
  await expect(notice(page)).toHaveText("Saved myfurlong");
  await yourUnits(page);
  await expect(row(page, "u:myfurlong").getByTestId("sheet-value")).toHaveText("200 m");

  // Delete asks once: the first tap arms it and the unit stays, the second removes it
  await row(page, "u:myfurlong").tap();
  await row(page, "delete").tap();
  await expect(sheet(page)).toBeVisible();
  await expect(page.getByTestId("find-preview")).toHaveText("Tap Delete again to remove myfurlong");
  await row(page, "delete").tap();
  await expect(notice(page)).toHaveText("Deleted myfurlong");
  await yourUnits(page);
  expect(await rowIds(page)).toEqual(["new"]);
  expect(await entryValue(page)).toBe("");
});

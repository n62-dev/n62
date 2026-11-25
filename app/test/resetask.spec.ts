// SPDX-License-Identifier: GPL-3.0-or-later
// R857 (owner, 2026-11-22): the bulk resets in Settings ask once before they wipe. Reset all your keys, Reset the unit pad
// cells and the three Reset the counter rows (Counters, Removal tests › Results mode, › Angle chip) arm on the first pick
// (R281's `confirm`): the label turns to its armed text, the row to --error, the note under the list says what goes; the
// second pick clears; any other press disarms. "Empty this slot" still clears on one tap. The fake engine.
import { expect, test, type Page } from "@playwright/test";
import { open, sheet, sheetKey, tap } from "./helpers.ts";

const title = (page: Page) => page.getByTestId("sheet-title");
const row = (page: Page, id: string) => sheet(page).locator(`[role="menuitem"][data-id="${id}"]`);
const label = (page: Page, id: string) => row(page, id).locator(".label");
const value = (page: Page, id: string) => row(page, id).getByTestId("sheet-value");
const note = (page: Page) => page.getByTestId("find-preview");
/** The place a free key's slot holds; null for an empty slot (its action is the special `none`). */
const placeOf = (page: Page, id: string) =>
  page.evaluate((id) => {
    const p = window.n62.userKeys.placeOf(id, "primary");
    return p === undefined || p === "none" ? null : p;
  }, id);
/** The armed row draws in --error (one rule in Sheet.svelte). */
const armedColour = (page: Page, id: string) =>
  row(page, id).evaluate((el) => {
    const probe = document.createElement("span");
    probe.style.color = "var(--error)";
    el.appendChild(probe);
    const want = getComputedStyle(probe).color;
    probe.remove();
    return getComputedStyle(el.querySelector(".label") ?? el).color === want;
  });

async function yourKeys(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.n62.userKeys.set("u1", "primary", { label: "Home", action: { special: "home" } });
    window.n62.userKeys.set("u3", "primary", { label: "CAS", action: { special: "cas" } });
  });
  await tap(page, ["help", "d5"]);
  await expect(title(page)).toHaveText("Settings › Your keys");
}

for (const [w, h] of [[412, 915], [360, 740]] as const)
  test.describe(`at ${w} × ${h}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await open(page);
    });

    test("Reset all your keys: one tap arms (label, colour, note), a second clears; the sheet stays", async ({ page }) => {
      await yourKeys(page);
      await expect(label(page, "reset")).toHaveText("Reset all your keys");
      await row(page, "reset").tap();
      expect([await placeOf(page, "u1"), await placeOf(page, "u3")]).toEqual(["home", "cas"]);
      await expect(label(page, "reset")).toHaveText("Reset all your keys?");
      await expect(row(page, "reset")).toHaveAttribute("data-armed", "true");
      expect(await armedColour(page, "reset")).toBe(true);
      await expect(note(page)).toHaveText("Clears 2 keys: U1, U3. Tap again.");
      await row(page, "reset").tap();
      expect([await placeOf(page, "u1"), await placeOf(page, "u3")]).toEqual([null, null]);
      await expect(label(page, "reset")).toHaveText("Reset all your keys");
      await expect(row(page, "reset")).not.toHaveAttribute("data-armed", "true");
      await expect(title(page)).toHaveText("Settings › Your keys");
    });

    test("armed, then another row, ‹, ◀ or a key disarms: nothing cleared, the label is back", async ({ page }) => {
      await yourKeys(page);
      // another row (it opens its level; ‹ comes back)
      await row(page, "reset").tap();
      await row(page, "u2:primary").tap();
      await expect(title(page)).toHaveText("Settings › Your keys › U2");
      await sheet(page).getByRole("button", { name: "Back" }).tap();
      await expect(label(page, "reset")).toHaveText("Reset all your keys");
      // ‹ itself: armed, out to Settings and back in
      await row(page, "reset").tap();
      await sheet(page).getByRole("button", { name: "Back" }).tap();
      await expect(title(page)).toHaveText("Settings");
      await tap(page, ["d4"]);
      await expect(label(page, "reset")).toHaveText("Reset all your keys");
      // ◀ as a key
      await row(page, "reset").tap();
      await tap(page, ["left"]);
      await expect(title(page)).toHaveText("Settings");
      await tap(page, ["d4"]);
      await expect(label(page, "reset")).toHaveText("Reset all your keys");
      // a key (▲)
      await row(page, "reset").tap();
      await expect(label(page, "reset")).toHaveText("Reset all your keys?");
      await tap(page, ["up"]);
      await expect(label(page, "reset")).toHaveText("Reset all your keys");
      await expect(note(page).filter({ hasText: /Tap again/ })).toHaveCount(0); // (no note at all, or the row's own)
      // each time the next tap only armed: nothing was cleared
      await row(page, "reset").tap();
      expect([await placeOf(page, "u1"), await placeOf(page, "u3")]).toEqual(["home", "cas"]);
    });

    test("by keys: the row highlighted, Enter arms, Enter again clears", async ({ page }) => {
      await yourKeys(page);
      await sheetKey(page, ["up"]); // round the top: the last row, Reset all
      await expect(sheet(page).locator('[data-active="true"]')).toHaveAttribute("data-id", "reset");
      await tap(page, ["enter"]);
      await expect(label(page, "reset")).toHaveText("Reset all your keys?");
      expect(await placeOf(page, "u1")).toBe("home");
      await tap(page, ["enter"]);
      expect([await placeOf(page, "u1"), await placeOf(page, "u3")]).toEqual([null, null]);
      await expect(title(page)).toHaveText("Settings › Your keys");
    });

    test("Empty this slot still clears on one tap (control)", async ({ page }) => {
      await yourKeys(page);
      await row(page, "u1:primary").tap();
      await row(page, "empty").tap();
      expect(await placeOf(page, "u1")).toBe(null);
      expect(await placeOf(page, "u3")).toBe("cas");
    });

    test("Reset the unit pad cells: one tap arms and names the cells, a second gives the defaults back", async ({ page }) => {
      await tap(page, ["help", "d5"]);
      await row(page, "unitcells").tap();
      await expect(title(page)).toHaveText("Settings › Your keys › Unit pad cells");
      const first = (await value(page, "u1:primary").textContent()) ?? "";
      expect(first).not.toBe("Empty");
      for (const id of ["u1:primary", "u2:shift"]) {
        await row(page, id).tap();
        await row(page, "empty").tap(); // one tap: emptied (control)
        await sheet(page).getByRole("button", { name: "Back" }).tap();
      }
      await expect(value(page, "u1:primary")).toHaveText("Empty");
      await row(page, "reset").tap();
      await expect(value(page, "u1:primary")).toHaveText("Empty");
      await expect(label(page, "reset")).toHaveText("Reset the unit pad cells?");
      await expect(note(page)).toHaveText("Gives 2 cells back their default: U1, U2 ⇧. Tap again.");
      await row(page, "reset").tap();
      await expect(value(page, "u1:primary")).toHaveText(first);
      await expect(label(page, "reset")).toHaveText("Reset the unit pad cells");
    });

    test("Counters' Reset the counter asks once: the counts stay after one tap, read 0 after two", async ({ page }) => {
      await tap(page, ["shift", "shift", "alpha", "alpha"]);
      await tap(page, ["help", "d7"]);
      await expect(title(page)).toHaveText("Settings › Counters");
      await expect(value(page, "taps")).toHaveText("2 / 2");
      await row(page, "reset").tap();
      await expect(value(page, "taps")).toHaveText("2 / 2");
      await expect(label(page, "reset")).toHaveText("Reset the counter?");
      await expect(note(page)).toHaveText(/^Clears the counts since \d{4}-\d\d-\d\d\. Tap again\.$/);
      await row(page, "reset").tap();
      await expect(value(page, "taps")).toHaveText("0 / 0");
      await expect(label(page, "reset")).toHaveText("Reset the counter");
    });

    test("Removal tests › Results mode and › Angle chip: each Reset asks once", async ({ page }) => {
      await page.evaluate(async () => {
        const c = await window.n62.session.uses();
        c.count("fold.swipe");
        c.count("fold.swipe");
        const b = await window.n62.session.uses("bar-uses");
        b.countTap("bar.angle", Date.now());
      });
      await tap(page, ["help", "d7"]);
      await row(page, "uses").tap();
      await row(page, "results").tap();
      await expect(value(page, "swipe")).toHaveText("2");
      await row(page, "reset").tap();
      await expect(value(page, "swipe")).toHaveText("2");
      await expect(label(page, "reset")).toHaveText("Reset the counter?");
      await expect(note(page)).toHaveText(/^Clears the counts since \d{4}-\d\d-\d\d\. Tap again\.$/);
      await row(page, "reset").tap();
      await expect(value(page, "swipe")).toHaveText("0");
      await sheet(page).getByRole("button", { name: "Back" }).tap();
      await row(page, "bar").tap();
      await expect(value(page, "angle")).toHaveText("1");
      await expect(label(page, "reset")).toHaveText("Reset the counter"); // the Results mode's arm did not follow
      await row(page, "reset").tap();
      await expect(value(page, "angle")).toHaveText("1");
      await row(page, "reset").tap();
      await expect(value(page, "angle")).toHaveText("0");
    });
  });

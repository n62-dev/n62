// SPDX-License-Identifier: GPL-3.0-or-later
// R272: the Enter that makes Home drop its oldest row (the 201st) adds one note that points to the backup; the next
// Enters add none, and a reload does not say it again (the flag is stored per install).
import { expect, test } from "@playwright/test";
import { tap } from "./helpers.ts";

const NOTE = "Older rows are dropped after 200. Save a backup: Settings › Data.";

test("the first dropped row says it once, and a relaunch does not say it again", async ({ page }) => {
  await page.goto("/?engine=fake&tips=off");
  await page.waitForFunction(() => window.n62 !== undefined);
  // Seed the store (the shape Session writes) with 199 rows, so the second Enter makes the 201st.
  await page.evaluate(async (n) => {
    const items = Array.from({ length: n }, (_, k) => ({
      id: k + 1, view: "home", latex: `${k}+1`, status: "done", resultLatex: String(k + 1), text: String(k + 1), approximate: false, startedAt: 0,
    }));
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("n62", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("kv");
      req.onsuccess = () => {
        const tx = req.result.transaction("kv", "readwrite");
        tx.objectStore("kv").put({ home: items, cas: [] }, "history");
        tx.objectStore("kv").put("home", "view");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }, 199);
  await page.reload();
  await page.waitForFunction(() => window.n62?.entry.field !== undefined);
  await page.waitForFunction(() => window.n62.session.home.length === 199);
  const note = page.locator('[data-status="note"]', { hasText: NOTE });

  await tap(page, ["d7", "enter"]); // the 200th: nothing dropped
  await expect(page.locator('[data-status="done"]').last()).toContainText("7");
  await expect(note).toHaveCount(0);

  await tap(page, ["d8", "enter"]); // the 201st: the oldest goes, the note comes
  await expect(note).toHaveCount(1);
  await tap(page, ["d9", "enter"]);
  await expect(page.locator('[data-status="done"]').last()).toContainText("9");
  await expect(note).toHaveCount(1);

  await page.reload(); // a relaunch: the flag is stored, so the next drop says nothing
  await page.waitForFunction(() => window.n62?.entry.field !== undefined);
  await tap(page, ["d6", "enter"]);
  await expect(page.locator('[data-status="done"]').last()).toContainText("6");
  await expect(note).toHaveCount(0); // (notes are not stored; none is added)
});

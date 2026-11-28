// SPDX-License-Identifier: GPL-3.0-or-later
// R816 (owner, 2026-11-20 walk point C6): in Memory the Paste key (Shift + Deselect, R723) on a highlighted name arms a replace: the
// row asks "Replace A = 5 with 2.5?" and the line says a second Paste replaces it; the second Paste stores the pasted number through
// the store path (`2.5 ▶ A`, a history row) and the sheet offers Undo (R314's copy of A's old entry). Any other key disarms; a text
// Paste refuses is refused as Paste on the line refuses it, and nothing changes. The real engine; expected values derived (A = 5,
// the clipboard 2.5).
import { expect, test, type Page } from "@playwright/test";
import { KEYPASTE, open, setClipboard, tap } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

const find = (page: Page) => page.getByTestId("find");
const row = (page: Page, id: string) => find(page).locator(`[role="menuitem"][data-id="${id}"]`);
const valueOfA = (page: Page): Promise<string | undefined> => page.evaluate(() => window.n62.session.userNames.find((u) => u.name === "A")?.preview);
const inputs = (page: Page): Promise<string[]> => page.evaluate(() => window.n62.session.items.map((i) => i.latex));
const done = (page: Page, n: number) => expect(page.locator('[data-status="done"]')).toHaveCount(n);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  await tap(page, ["d5", "shift", "emark", "alpha", "vars", "enter"]); // 5 ▶ A
  await done(page, 1);
  await expect.poll(() => valueOfA(page)).toBe("5");
});

/** Memory open on A, the clipboard holding `clip`. */
async function memory(page: Page, clip: string): Promise<void> {
  await setClipboard(page, clip);
  await tap(page, ["shift", "math"]);
  await expect(row(page, "var:A")).toBeVisible();
  await expect(row(page, "var:A")).toHaveAttribute("data-active", "true");
}

test.describe("Memory's Paste replaces a name", () => {
  test("Paste asks, a second Paste stores 2.5 ▶ A as a history row, Undo brings 5 back", async ({ page }) => {
    await memory(page, "2.5");
    await tap(page, KEYPASTE);
    await expect(row(page, "var:A")).toContainText("Replace A = 5 with 2.5?");
    await expect(find(page)).toContainText("Paste again to replace A");
    expect(await valueOfA(page)).toBe("5");
    expect(await inputs(page)).toHaveLength(1);

    await tap(page, KEYPASTE);
    await expect.poll(() => valueOfA(page)).toBe("2.5");
    await done(page, 2);
    expect((await inputs(page))[1]).toBe("2.5\\blacktriangleright A");
    await expect(row(page, "var:A")).toContainText("2.5");
    await expect(row(page, "var:A")).not.toContainText("Replace");
    await expect(find(page)).toBeVisible();

    await expect(row(page, "undo")).toContainText("A replaced · Undo");
    await row(page, "undo").tap();
    await expect.poll(() => valueOfA(page)).toBe("5");
    await expect(row(page, "undo")).toHaveCount(0);
  });

  test("text Paste refuses is refused as on the line, and A stays 5", async ({ page }) => {
    await memory(page, "abc");
    await tap(page, KEYPASTE);
    await expect(page.getByTestId("notice")).toBeVisible();
    await expect(row(page, "var:A")).not.toContainText("Replace");
    expect(await valueOfA(page)).toBe("5");
    await tap(page, KEYPASTE);
    expect(await valueOfA(page)).toBe("5");
    expect(await inputs(page)).toHaveLength(1);
  });

  test("any other key disarms: Paste then ◀, then Paste again asks afresh and replaces nothing", async ({ page }) => {
    await memory(page, "2.5");
    await tap(page, KEYPASTE);
    await expect(row(page, "var:A")).toContainText("Replace A = 5 with 2.5?");
    await tap(page, ["left"]);
    await expect(row(page, "var:A")).not.toContainText("Replace");
    await expect(find(page)).not.toContainText("Paste again to replace");
    expect(await valueOfA(page)).toBe("5");
    await tap(page, KEYPASTE); // armed again, not stored
    await expect(row(page, "var:A")).toContainText("Replace A = 5 with 2.5?");
    expect(await valueOfA(page)).toBe("5");
  });

  test("controls: Memory's tap still copies, the Copy key too; Paste on the line (Find closed) still pastes", async ({ page }) => {
    await memory(page, "sentinel");
    await row(page, "var:A").tap();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("5");
    await tap(page, ["esc"]);
    await setClipboard(page, "7");
    await tap(page, KEYPASTE);
    await expect.poll(() => page.evaluate(() => window.n62.entry.value)).toBe("7");
  });
});

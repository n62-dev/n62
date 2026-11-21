// SPDX-License-Identifier: GPL-3.0-or-later
// R723 (the owner, 2026-11-17): Shift + Deselect is Paste (R329 had it on Shift + Vars, now Chars, R725). It
// takes Paste's own path (clipboard/actions.svelte.ts paste: the clipboard as one number onto the entry line), so a hold on
// a result then a flick up on Deselect puts that result on the line, in Home and in Solve Symb; the keys pressed meanwhile
// wait for the paste (holdKeys), and where no entry line shows (Plot) it is a dead press. Controls: Vars' tap still opens
// Find on the user's names, Shift + Deselect pastes (the core list's cases), and Shift + a b/c, 7, Fmt and Vars are reserved. Key
// sequences on the real engine; the expected values are derived (9 + 1 = 10, 12 ÷ 4 = 3).
import { expect, test, type Page } from "@playwright/test";
import { finger } from "./core-lib.ts";
import { entryValue, flick, lastResult, open, PASTE, recordVibrations, setClipboard, tap, useClipboardLock, vibrations } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
// The system clipboard is one for the whole browser: these tests run one after another.
test.describe.configure({ mode: "serial" });

useClipboardLock();

test.beforeEach(async ({ page }) => {
  await recordVibrations(page);
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

const resultIs = async (page: Page, text: string, rows: number): Promise<void> => {
  await expect(page.locator('[data-status="done"]')).toHaveCount(rows, { timeout: 15_000 });
  await expect(lastResult(page)).toHaveAttribute("data-text", text);
};

test("Home: a hold on a result copies it, a flick up on Deselect puts it on the line (9, then a second result 5: 9 + 1 = 10)", async ({ page }) => {
  await tap(page, ["d9", "enter"]);
  await resultIs(page, "9", 1);
  await finger(page, "result:last", { ms: 700 }); // a hold copies the result (R276)
  await expect(page.getByTestId("notice")).toHaveText("Copied: 9");
  await tap(page, ["d5", "enter"]);
  await resultIs(page, "5", 2);
  await flick(page, "deselect", "up");
  await expect.poll(() => entryValue(page)).toBe("9");
  await tap(page, ["add", "d1", "enter"]);
  await resultIs(page, "10", 3);
});

test("Home: Shift, Deselect pastes too, and ÷ pressed at once waits for the paste: the line is 12 then ÷ (12 ÷ 4 = 3)", async ({ page }) => {
  await setClipboard(page, "12");
  await tap(page, ["shift", "deselect", "div"]);
  await expect.poll(() => entryValue(page)).toMatch(/^\\frac\{12\}\{/);
  await tap(page, ["d4", "right", "enter"]);
  await resultIs(page, "3", 1);
});

test("Solve Symb: the copied result goes on the equation's line, as its ☰ Paste row puts it", async ({ page }) => {
  await tap(page, ["d7", "enter"]);
  await resultIs(page, "7", 1);
  await finger(page, "result:last", { ms: 700 });
  await expect(page.getByTestId("notice")).toHaveText("Copied: 7");
  await tap(page, ["@place", "d4"]);
  await expect(page.locator('[data-app="solve"]')).toBeVisible();
  await tap(page, ["@symb"]);
  await expect(page.getByTestId("entry-label")).toHaveText("E1:");
  await flick(page, "deselect", "up");
  await expect.poll(() => entryValue(page)).toBe("7");
});

test("Function Plot (no entry line): Shift + Deselect is a dead press (the double pulse) and puts nothing anywhere", async ({ page }) => {
  await page.evaluate(() => window.n62.session.setHaptics({ on: true, ms: 10 }));
  await setClipboard(page, "5");
  await tap(page, ["@place", "d3"]);
  await expect(page.locator('[data-app="function"]')).toBeVisible();
  await tap(page, ["@plot"]);
  await expect(page.getByTestId("entry")).toBeHidden();
  await tap(page, ["shift"]);
  const v1 = (await vibrations(page)).length;
  await tap(page, ["deselect"]);
  await expect.poll(async () => (await vibrations(page)).length - v1).toBe(2); // drawn live but dead here (R777): the dead key's double pulse alone
  await expect(page.getByTestId("notice")).toHaveCount(0);
  expect(await entryValue(page)).toBe("");
});

test("Deselect's Shift legend reads Paste and fits its face, no ▾ (it opens no sheet); in the Shift layer it is live, not dimmed", async ({ page }) => {
  const legend = await page.locator('[data-key="deselect"]').evaluate((key) => {
    const l = key.querySelector<HTMLElement>(".shiftlegend");
    return { text: l?.textContent?.trim() ?? "", fits: l ? l.scrollWidth <= key.clientWidth : true };
  });
  expect(legend).toEqual({ text: "Paste", fits: true });
  await tap(page, ["shift"]);
  await expect(page.locator('[data-key="deselect"]')).not.toHaveAttribute("data-dead", "true");
});

test("controls: Vars' tap opens Find on your names; Shift + Deselect pastes; Shift + a b/c, 7 and Fmt are reserved (dimmed), Vars is Chars (R725)", async ({ page }) => {
  await tap(page, ["vars"]);
  await expect(page.getByTestId("find")).toBeVisible();
  await tap(page, ["esc"]);
  await expect(page.getByTestId("find")).toHaveCount(0);
  await setClipboard(page, "6");
  await tap(page, PASTE);
  await expect.poll(() => entryValue(page)).toBe("6");
  await tap(page, ["shift"]);
  for (const id of ["frac", "d7", "fmt"]) await expect(page.locator(`[data-key="${id}"]`), id).toHaveAttribute("data-dead", "true");
  await expect(page.locator('[data-key="vars"]')).not.toHaveAttribute("data-dead", "true");
});

// SPDX-License-Identifier: GPL-3.0-or-later
// R222: replaying a sequence of steps on the real engine and reading its result, for benchmark.spec.ts. The same steps
// and reads as tasks.spec.ts (which keeps its own copy: it is not changed by R222), plus the reads the published ten need.
import { expect, type Page } from "@playwright/test";
import { flick, open, tap } from "./helpers.ts";
import type { BenchTask } from "./benchmark-lib.ts";
import type { Step } from "./tasks-lib.ts";

/** Press the steps in order. Steps that need a later feature throw. */
export async function play(page: Page, steps: readonly Step[]): Promise<void> {
  for (const s of steps) {
    if (typeof s === "string") {
      await tap(page, [s]); // a key id, or `@place`, `@symb`, `@num`, `@menu` (the status line's controls, helpers.ts)
    } else if ("up" in s || "down" in s) {
      await ("up" in s ? flick(page, s.up, "up") : flick(page, s.down, "down"));
    } else if ("tap" in s && s.tap === "result:last") {
      await page.locator('[data-testid="result"]').last().locator(".result").tap();
    } else if ("tap" in s && s.tap === "input:last") {
      await page.locator('[data-status="done"] .in').last().tap(); // a first tap picks the row, a second recalls it (R147)
    } else if ("tap" in s && s.tap.startsWith("cell:")) {
      await page.getByTestId("menu").locator(`[data-id="${s.tap.slice(5)}"]`).tap(); // a cell of the open Tmpl palette
    } else if ("tap" in s && s.tap.startsWith("alt:")) {
      // a chip of the unit view's alternatives row: `alt:si` is the first, `alt:<unit>` the chip with that text
      const want = s.tap.slice(4);
      const chips = page.getByTestId("unit-alt");
      await expect(chips.first()).toBeVisible();
      const chip = want === "si" ? chips.first() : chips.filter({ hasText: new RegExp(`^${want.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}$`) });
      const text = (await chip.textContent()) ?? "";
      await chip.tap();
      await expect(page.getByTestId("unit-result")).toHaveAttribute("data-unit", text);
    } else {
      throw new Error(`cannot replay ${JSON.stringify(s)} yet: the feature it taps does not exist`);
    }
  }
}

/** The app is open and the engine ready. */
export async function start(page: Page): Promise<void> {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
}

/** The last `n` Home results once every row is done. */
async function homeRows(page: Page, n: number): Promise<string[]> {
  const rowCount = (): Promise<number> => page.locator('[data-testid="result"]').count();
  await expect.poll(async () => (await page.locator('[data-status="done"]').count()) === (await rowCount()) && (await rowCount()) >= n).toBe(true);
  const all = await page.locator('[data-testid="result"] .result').evaluateAll((els) => els.map((e) => e.getAttribute("data-text") ?? ""));
  return all.slice(-n);
}

/** Replay a task: the angle is set through the session before the first press (not counted), the keys are pressed, and the
 *  result is read as the task says. A failure is thrown with the task's id first. */
export async function replayTask(page: Page, t: BenchTask): Promise<void> {
  try {
    if (t.angle !== "none") await page.evaluate((a) => window.n62.session.setAngle(a), t.angle);
    await play(page, t.keys);
    const want = t.expect.text;
    if (t.read === "solve") {
      await expect(page.getByTestId("solve-info")).not.toHaveText("Working…"); // the answers are in
      const got: string[] = [];
      for (const name of t.names ?? []) got.push(((await page.locator(`[data-testid="solve-table"] tr[data-name="${name}"] td`).textContent()) ?? "").trim());
      expect(got).toEqual(want);
    } else if (t.read === "rows") {
      expect(await homeRows(page, Array.isArray(want) ? want.length : 1)).toEqual(want);
    } else if ((await page.getByTestId("unit-view").count()) > 0) {
      const unit = page.getByTestId("unit-result");
      await expect(unit).toHaveCount(1);
      expect(`${(await unit.getAttribute("data-text")) ?? ""} ${(await unit.getAttribute("data-unit")) ?? ""}`).toBe(`${String(want)} ${t.expect.unit ?? ""}`);
      if (t.expect.shown !== undefined) await expect(unit.locator(".value")).toHaveText(t.expect.shown);
    } else {
      await expect(page.locator('[data-status="done"]')).toHaveCount(1);
      expect(await page.locator('[data-testid="result"]').last().locator(".result").getAttribute("data-text")).toBe(want);
    }
  } catch (e) {
    throw new Error(`${t.id}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

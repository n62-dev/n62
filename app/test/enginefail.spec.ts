// SPDX-License-Identifier: GPL-3.0-or-later
// R284: when the engine does not start, the note says why (a load, memory or crash failure, from G318's error class) and
// offers Reload; Enter adds no row that nothing would answer. The real engine, so the failure comes through the worker.
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

const note = (page: Page) => page.getByTestId("engine-note");
const state = (page: Page) => page.evaluate(() => window.n62.session.engineState);

/** The engine worker answers its `init` with a memory failure, as a browser that cannot give the heap does (not an
 *  invalid wasm, which is a load failure). Other workers are left alone. */
async function memoryFailure(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const Real = window.Worker;
    class Dying {
      onmessage: ((ev: { data: unknown }) => void) | null = null;
      onerror: unknown = null;
      constructor(url: string | URL, opts?: WorkerOptions) {
        if (!String(url).includes("giac.worker")) return new Real(url, opts) as unknown as Dying;
      }
      postMessage(m: { id: number; type: string }): void {
        if (m.type === "init") setTimeout(() => this.onmessage?.({ data: { id: m.id, type: "fatal", dead: "memory", message: "out of memory" } }), 0);
      }
      terminate(): void {}
      addEventListener(): void {}
    }
    window.Worker = Dying as unknown as typeof Worker;
  });
}

test("the wasm does not load: the note says so, with Reload, and a tap on it starts the engine again", async ({ page }) => {
  let hits = 0;
  await page.route("**/engine/giac*.wasm", (route) => {
    hits++;
    return route.abort();
  });
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "failed", undefined, { timeout: 30_000 });
  expect(hits, "the route saw the wasm request made in the worker").toBeGreaterThan(0);
  await expect(note(page)).toContainText("The engine could not be loaded. Check the connection and reload.");
  await page.unroute("**/engine/giac*.wasm");
  await note(page).getByTestId("engine-reload").tap();
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 60_000 });
  await expect(note(page)).toHaveCount(0);
});

test("the wasm and the note's own chunk both fail to load: Reload still shows, with the generic line", async ({ page }) => {
  let chunk = 0;
  await page.route("**/engine/giac*.wasm", (route) => route.abort());
  await page.route("**/EngineFailed*", (route) => {
    chunk++;
    return route.abort();
  });
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "failed", undefined, { timeout: 30_000 });
  await expect.poll(() => chunk, { message: "the note's chunk was asked for" }).toBeGreaterThan(0);
  await expect(note(page).getByTestId("engine-reload")).toHaveText("Reload");
  await expect(note(page)).toContainText("The engine failed to start.");
  await page.unroute("**/engine/giac*.wasm");
  await page.unroute("**/EngineFailed*");
  await note(page).getByTestId("engine-reload").tap();
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 60_000 });
});

test("the browser gives no memory: the note says so, with Reload", async ({ page }) => {
  await memoryFailure(page);
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "failed", undefined, { timeout: 30_000 });
  await expect(note(page)).toContainText("This browser could not give the engine enough memory.");
  await expect(note(page).getByTestId("engine-reload")).toHaveText("Reload");
});

test("while the engine has failed, Enter adds no row", async ({ page }) => {
  await memoryFailure(page);
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "failed", undefined, { timeout: 30_000 });
  await tap(page, ["d1", "enter"]);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.n62.session.items.length)).toBe(0);
  expect(await page.evaluate(() => window.n62.entry.value)).not.toBe("");
});

test("a normal start shows no note once ready", async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 60_000 });
  expect(await state(page)).toBe("ready");
  await expect(note(page)).toHaveCount(0);
});

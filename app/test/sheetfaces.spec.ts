// SPDX-License-Identifier: GPL-3.0-or-later
// R820: while a sheet takes letters, the key faces and the pop show the character the key types there (sheetKeys.ts sheetFace), in
// the case it types; the keys that do nothing there are dimmed, Find under Shift included; the letter is not drawn twice and nothing
// overflows its key; Esc brings the faces back. The fake engine; 412 and 360 px wide.
import { expect, test, type Page } from "@playwright/test";
import { open, tap, touch } from "./helpers.ts";

const main = (page: Page, id: string) => page.locator(`.pad [data-key="${id}"] .main`);
const letterLine = (page: Page, id: string) => page.locator(`.pad [data-key="${id}"] .alphalegend`);
const key = (page: Page, id: string) => page.locator(`.pad [data-key="${id}"]`);

/** Every face and legend stays inside its key (the check fontscale.spec.ts makes). */
const overflows = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const out: string[] = [];
    for (const k of document.querySelectorAll<HTMLElement>(".pad .key")) {
      const kb = k.getBoundingClientRect();
      for (const el of k.querySelectorAll<HTMLElement>(".main, .shiftlegend, .alphalegend")) {
        if ((el.textContent ?? "").trim() === "") continue;
        const range = document.createRange();
        range.selectNodeContents(el);
        const r = range.getBoundingClientRect();
        if (r.left < kb.x - 0.5 || r.right > kb.x + kb.width + 0.5) out.push(`${k.dataset["key"]}: "${el.textContent}" is cut by the key edge`);
      }
    }
    return out;
  });

/** The pop above `id` while a finger is down on it. */
async function popOf(page: Page, id: string): Promise<string | null> {
  const t = await touch(page, id);
  await page.waitForTimeout(120);
  const pop = page.getByTestId("key-pop");
  const text = (await pop.count()) > 0 ? await pop.first().textContent() : null;
  await t.end();
  return text;
}

for (const width of [412, 360]) {
  test.describe(`${width} px wide`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 815 });
      await open(page);
    });

    test("Vars: the faces are the letters typed (lower case, the one sheet of Vars, Find and Memory), d7 Enter and ▲ keep theirs; Esc brings them back", async ({ page }) => {
      const before = { vars: await main(page, "vars").textContent(), sin: await main(page, "sin").textContent() };
      await tap(page, ["vars"]);
      await expect(main(page, "vars")).toHaveText("a");
      await expect(main(page, "sin")).toHaveText("g");
      await expect(main(page, "x")).toHaveText("d");
      await expect(main(page, "d7")).toHaveText("7");
      await expect(main(page, "enter")).not.toHaveText("");
      // R794: ▲ is the round pad's drawing (the inline SVG in Keypad.svelte); the zone keeps its face, transparent (R794f1: it names the zone)
      await expect(main(page, "up")).not.toHaveText("");
      await expect(main(page, "up")).toHaveCSS("opacity", "0");
      await expect(page.locator(".pad .trackpad svg.arrows path")).toHaveCount(4);
      await expect(letterLine(page, "vars")).toHaveText("");
      expect(await popOf(page, "sin")).toBe("g");
      expect(await overflows(page)).toEqual([]);
      await tap(page, ["esc"]);
      await expect(main(page, "vars")).toHaveText(before.vars ?? "");
      await expect(main(page, "sin")).toHaveText(before.sin ?? "");
      await expect(letterLine(page, "vars")).toHaveText("A");
    });

    test("Find: Shift armed dims Vars and lights - and ., which type; the faces follow", async ({ page }) => {
      await tap(page, ["math"]);
      await expect(main(page, "vars")).toHaveText("a");
      await expect(key(page, "vars")).not.toHaveAttribute("data-dead", "true");
      await tap(page, ["shift"]);
      await expect(key(page, "vars")).toHaveAttribute("data-dead", "true");
      await expect(key(page, "sub")).not.toHaveAttribute("data-dead", "true");
      await expect(key(page, "dot")).not.toHaveAttribute("data-dead", "true");
      await expect(main(page, "sub")).toHaveText("-");
      await expect(main(page, "dot")).toHaveText(".");
      expect(await overflows(page)).toEqual([]);
    });

    test("Store: Vars shows A, x shows x, a digit is dimmed before a letter and shows itself after one; the pop reads the letter", async ({ page }) => {
      await tap(page, ["d7", "shift", "emark"]);
      await expect(main(page, "vars")).toHaveText("A");
      await expect(main(page, "x")).toHaveText("x");
      await expect(key(page, "d7")).toHaveAttribute("data-dead", "true");
      expect(await popOf(page, "sin")).toBe("G");
      expect(await overflows(page)).toEqual([]);
      await tap(page, ["vars"]); // types A into the name
      await expect(main(page, "d7")).toHaveText("7");
      await expect(key(page, "d7")).not.toHaveAttribute("data-dead", "true");
      await tap(page, ["esc"]);
      await tap(page, ["esc"]);
      await expect(main(page, "vars")).not.toHaveText("A");
    });
  });
}

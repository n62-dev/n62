// SPDX-License-Identifier: GPL-3.0-or-later
// R163 (docs/05 3.10, section 2): Key pop-ups, a switch in Settings › Appearance after Key shadows, on at a first start. It
// rules every bubble over the keypad: the key pop (R162) and the flick bubble (P7 point 2). Off, a tap shows no pop and an
// armed flick no bubble, and the flick still fires its layer; on again, both show. The value survives a relaunch and is
// held by a preset's Look group. Synthetic touches through CDP (helpers.ts touch); a MutationObserver counts every bubble
// the pad ever drew, so "none" means none, not "gone by the time we looked". The fake engine.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, sheet, tap, touch } from "./helpers.ts";

const row = (page: Page, id: string) => sheet(page).locator(`[role="menuitem"][data-id="${id}"]`);
const pop = (page: Page) => page.getByTestId("key-pop");
const bubble = (page: Page) => page.getByTestId("flick-bubble");
const pops = (page: Page) => page.evaluate(() => window.n62.session.settings.look.pops);

/** Counts the pops and flick bubbles the pad draws from now on. */
const watch = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const w = window as unknown as { __drawn: { pop: number; bubble: number } };
    w.__drawn = { pop: 0, bubble: 0 };
    const pad = document.querySelector(".pad");
    if (!pad) throw new Error("no pad");
    new MutationObserver((records) => {
      for (const r of records)
        for (const n of r.addedNodes)
          if (n instanceof HTMLElement) {
            if (n.dataset["testid"] === "key-pop") w.__drawn.pop++;
            if (n.dataset["testid"] === "flick-bubble") w.__drawn.bubble++;
          }
    }).observe(pad, { childList: true });
  });
const drawn = (page: Page) => page.evaluate(() => (window as unknown as { __drawn: { pop: number; bubble: number } }).__drawn);

/** Mode › Settings › Appearance, the switch toggled by its digit (row 6), and the sheet closed again. */
async function toggle(page: Page): Promise<void> {
  await tap(page, ["@mode", "d6", "d1", "d6"]);
  for (let i = 0; i < 4 && (await sheet(page).count()) > 0; i++) await tap(page, ["esc"]);
  await expect(sheet(page)).toHaveCount(0);
}

/** A tap on 7 held down, then a flick up on the point (`=`), each looked at while the finger is down. */
async function tapAndFlick(page: Page): Promise<{ pop: number; bubble: number }> {
  const t = await touch(page, "d7");
  await page.waitForTimeout(120);
  const seenPop = await pop(page).count();
  await t.end();
  const f = await touch(page, "dot");
  await f.move(0, -35, 3);
  await page.waitForTimeout(120);
  const seenBubble = await bubble(page).count();
  await f.end();
  return { pop: seenPop, bubble: seenBubble };
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 372, height: 767 });
  await open(page);
});

test("Appearance: Key pop-ups is a switch after Key shadows with its line, on at a first start; six rows", async ({ page }) => {
  expect(await pops(page)).toBe(true);
  await tap(page, ["@mode", "d6", "d1"]);
  const ids = await sheet(page).getByRole("menuitem").evaluateAll((els) => els.map((e) => e.getAttribute("data-id")));
  expect(ids).toEqual(["theme", "brightness", "contrast", "plain", "shadow", "pops"]);
  await expect(row(page, "pops").locator(".label")).toHaveText("Key pop-ups");
  await expect(row(page, "pops").getByTestId("row-hint")).toHaveText("A bubble over the key you press or flick");
  await expect(row(page, "pops")).toHaveAttribute("data-selected", "true");
  await expect(row(page, "theme")).toHaveAttribute("data-active", "true"); // it still opens on Theme
});

test("off: a tap shows no pop and an armed flick no bubble, and the flick still fires; on again: both show", async ({ page }) => {
  const on = await tapAndFlick(page);
  expect(on).toEqual({ pop: 1, bubble: 1 }); // on (the default): both show
  expect(await entryValue(page)).toBe("7=");
  await tap(page, ["esc"]); // (Esc clears the line)
  await toggle(page);
  expect(await pops(page)).toBe(false);
  await watch(page);
  const off = await tapAndFlick(page);
  expect(off).toEqual({ pop: 0, bubble: 0 });
  expect(await drawn(page)).toEqual({ pop: 0, bubble: 0 }); // never drawn, not only gone
  expect(await entryValue(page)).toBe("7="); // the tap and the flick up still fire their layers
  const d = await touch(page, "d5");
  await d.move(0, 35, 3); // a flick down: the letter
  await d.end();
  expect(await entryValue(page)).toBe("7=V");
  expect(await drawn(page)).toEqual({ pop: 0, bubble: 0 });
  await tap(page, ["esc"]); // (Esc clears the line)
  await toggle(page);
  expect(await pops(page)).toBe(true);
  await watch(page);
  expect(await tapAndFlick(page)).toEqual({ pop: 1, bubble: 1 });
  const again = await drawn(page); // (each drawn at least once: the observer, which counted none while off, sees them)
  expect(again.pop).toBeGreaterThan(0);
  expect(again.bubble).toBeGreaterThan(0);
});

test("off survives a relaunch, and a preset's Look group holds it and sets it back", async ({ page }) => {
  await toggle(page);
  await page.waitForTimeout(600); // the store writes behind the change
  await page.reload();
  await page.waitForFunction(() => window.n62 !== undefined);
  await page.evaluate(() => window.n62.entry.ready);
  expect(await pops(page)).toBe(false);
  await watch(page);
  expect(await tapAndFlick(page)).toEqual({ pop: 0, bubble: 0 });
  expect(await drawn(page)).toEqual({ pop: 0, bubble: 0 });
  const after = await page.evaluate(async (path) => {
    const { session, userKeys } = window.n62;
    const presets = await ((await import(/* @vite-ignore */ path)) as typeof import("../src/views/modeSheet.ts")).presetsFor(session, userKeys);
    const id = presets.capture("Quiet keys", ["look"]);
    session.settings.look = { ...session.settings.look, pops: true };
    await presets.apply(id);
    return { held: presets.list[0]?.groups.look?.["pops"], now: session.settings.look.pops };
  }, "/src/views/modeSheet.ts");
  expect(after).toEqual({ held: false, now: false });
  expect(await tapAndFlick(page)).toEqual({ pop: 0, bubble: 0 });
});

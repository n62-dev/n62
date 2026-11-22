// SPDX-License-Identifier: GPL-3.0-or-later
// R774 (owner, 2026-11-19): press looks. No blue tap boxes (Android's default tap highlight, a rectangle on rounded controls),
// a pressed d-pad zone shows a dot behind its arrow, a locked Shift's ring stays inside its key, and a notice ("Copied")
// draws over the history's foot instead of moving the rows. Computed style and pixels, the fake engine.
import { expect, test, type Page } from "@playwright/test";
import { COPY, flick, lastResult, open, tap, useClipboardLock } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
useClipboardLock(); // (the "Copied" test writes the system clipboard)

const highlights = (page: Page, root: string): Promise<{ n: number; bad: string[] }> =>
  page.evaluate((root) => {
    const bad: string[] = [];
    const all = document.querySelectorAll<HTMLElement>(`${root} button`);
    for (const el of all) {
      const c = getComputedStyle(el).getPropertyValue("-webkit-tap-highlight-color");
      if (c !== "rgba(0, 0, 0, 0)") bad.push(`${el.className || el.tagName} ${c}`);
    }
    return { n: all.length, bad };
  }, root);

test("no blue tap box: every button in the bar and in an open sheet has a transparent tap highlight", async ({ page }) => {
  await open(page);
  const bar = await highlights(page, ".bar");
  expect(bar.n).toBeGreaterThan(3);
  expect(bar.bad).toEqual([]);
  await page.getByTestId("chip-format").tap();
  await expect(page.getByTestId("menu")).toBeVisible();
  const sheet = await highlights(page, '[data-testid="menu"]');
  expect(sheet.n).toBeGreaterThan(3);
  expect(sheet.bad).toEqual([]);
});

/** One pixel of the page (CSS px) from a screenshot clip, decoded in the page. */
const pixel = async (page: Page, x: number, y: number): Promise<number[]> => {
  const png = await page.screenshot({ clip: { x: Math.floor(x), y: Math.floor(y), width: 1, height: 1 } });
  return page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const cv = document.createElement("canvas");
    cv.width = cv.height = 1;
    const g = cv.getContext("2d", { willReadFrequently: true });
    if (!g) throw new Error("no canvas");
    g.drawImage(bmp, 0, 0);
    return [...g.getImageData(0, 0, 1, 1).data];
  }, png.toString("base64"));
};

/** R794: an arrow's centre (CSS px): the round pad draws the four, on its axes at 33 % of its diameter from its centre. */
const arrowAt = async (page: Page, id: string): Promise<{ x: number; y: number }> => {
  const t = await page.locator(".pad .trackpad").boundingBox();
  if (!t) throw new Error("no trackpad");
  const [ux, uy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[id] ?? [0, 0];
  return { x: t.x + t.width * (0.5 + 0.33 * (ux ?? 0)), y: t.y + t.height * (0.5 + 0.33 * (uy ?? 0)) };
};

for (const id of ["up", "down", "left", "right"])
  test(`a held ${id} arrow shows a dot behind it: the pixel beside the arrow differs from rest`, async ({ page }) => {
    await open(page);
    // the dot's code comes with the key names, after the first paint (keyNames.ts placeDot): wait for them (sin's description is theirs)
    await expect(page.locator('.pad [data-key="sin"]')).toHaveAttribute("aria-description", /Shift/);
    const at = await arrowAt(page, id);
    // 14 px from the arrow's centre, along the circle's tangent: off the ink, inside a 40 px dot
    const [dx, dy] = id === "up" || id === "down" ? [14, 0] : [0, 14];
    const [x, y] = [at.x + dx, at.y + dy];
    const rest = await pixel(page, x, y);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await expect(page.locator(`.pad [data-key="${id}"][data-down]`)).toHaveCount(1);
    const held = await pixel(page, x, y);
    await page.mouse.up();
    const delta = Math.max(...rest.slice(0, 3).map((v, i) => Math.abs(v - (held[i] ?? v))));
    expect(delta, `rest ${rest} held ${held}`).toBeGreaterThanOrEqual(16);
  });

test("an arrow pressed before the key names are in draws no dot (none on the hub)", async ({ page }) => {
  await page.addInitScript(() => {
    const idle = window.requestIdleCallback.bind(window); // hold the key names' idle load back
    window.requestIdleCallback = (cb, o) => setTimeout(() => idle(cb, o), 4000) as unknown as number;
  });
  await page.goto("/?engine=fake&tips=off");
  await page.locator('.pad [data-key="up"]').waitFor();
  expect(await page.locator('.pad [data-key="sin"]').getAttribute("aria-description")).toBeNull(); // (the names are not in)
  const at = await arrowAt(page, "up");
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await expect(page.locator('.pad [data-key="up"][data-down]')).toHaveCount(1);
  const dot = await page.locator(".pad .trackpad").evaluate((el) => getComputedStyle(el, "::after").visibility);
  await page.mouse.up();
  expect(dot).toBe("hidden");
});

test("a locked Shift's ring lies within its key and the screen, in N62 High contrast", async ({ page }) => {
  await open(page);
  await page.evaluate(async () => {
    const url = "/src/theme/apply.ts";
    const m = (await import(/* @vite-ignore */ url)) as typeof import("../src/theme/apply.ts");
    await m.applyTheme({ family: "n62", brightness: "dark", contrast: "high", keys: "colour" } as never, document.documentElement);
  });
  await flick(page, "shift", "up");
  await expect(page.locator('[data-key="shift"][data-locked="true"]')).toHaveCount(1);
  const r = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-key="shift"]');
    if (!el) throw new Error("no key");
    const cs = getComputedStyle(el);
    const b = el.getBoundingClientRect();
    const grow = parseFloat(cs.outlineOffset) + parseFloat(cs.outlineWidth); // how far the ring's outer edge lies beyond the key's box
    return { style: cs.outlineStyle, grow, left: b.left - grow, right: b.right + grow, width: innerWidth };
  });
  expect(r.style).toBe("solid");
  expect(r.grow, "the ring's outer edge is not outside the key's box").toBeLessThanOrEqual(0);
  expect(r.left).toBeGreaterThanOrEqual(0);
  expect(r.right).toBeLessThanOrEqual(r.width);
});

test('a "Copied" notice moves no history row', async ({ page }) => {
  await open(page);
  for (let i = 0; i < 3; i++) await tap(page, ["d1", "add", `d${(i % 9) + 1}`, "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(3);
  const tops = (): Promise<number[]> => page.locator('[data-testid="result"]').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  await expect(lastResult(page)).toBeVisible();
  await page.waitForTimeout(500);
  const before = await tops();
  await tap(page, COPY);
  await expect(page.getByTestId("notice")).toHaveText(/^Copied/); // (R832: it names the copy, "Copied: …")
  expect(await tops()).toEqual(before);
  const n = await page.getByTestId("notice").boundingBox();
  const h = await page.getByTestId("entry").boundingBox();
  if (!n || !h) throw new Error("no boxes");
  expect(n.y + n.height, "the notice lies over the history's foot, above the entry line").toBeLessThanOrEqual(h.y + 0.5);
});

test("the name prompt's hint covers no row: the last result's box and the hint's do not intersect", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page);
  await tap(page, ["d2", "add", "d3", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await tap(page, ["d4", "add", "d5"]);
  await tap(page, ["@mode", "d5", "d1"]); // Presets › Save: the name prompt
  await expect(page.getByTestId("prompt-hint")).toBeVisible();
  const hint = await page.getByTestId("prompt-hint").boundingBox();
  const result = await lastResult(page).boundingBox();
  if (!hint || !result) throw new Error("no boxes");
  expect(result.y + result.height, "the hint lies below the history's last row").toBeLessThanOrEqual(hint.y + 0.5);
});

test("a pressed view tab inside an app shows its own fill, inside the track (data-down and a changed pixel)", async ({ page }) => {
  await open(page);
  await tap(page, ["@place", "d4"]); // Apps → Solve
  await expect(page.locator('[data-app="solve"]')).toBeVisible();
  await tap(page, ["@symb"]);
  await expect(page.getByTestId("entry-label")).toHaveText("E1:"); // (the bar settles once the app is in)
  const tab = page.getByTestId("tab-num");
  await expect(tab).toBeVisible();
  await page.waitForTimeout(300);
  const box = await tab.boundingBox();
  if (!box) throw new Error("no tab");
  const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2];
  const [x, y] = [cx - 12, cy]; // inside the face (its icon is 16 px wide), off the glyph
  const ex = box.x + 0.5; // the button's own edge, outside the face (R856: the face is inset by 1 px): not filled
  const [rest, restEdge] = [await pixel(page, x, y), await pixel(page, ex, cy)];
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await expect(page.locator('.bar [data-testid="tab-num"][data-down]')).toHaveCount(1);
  const [held, heldEdge] = [await pixel(page, x, y), await pixel(page, ex, cy)];
  await page.mouse.up();
  const diff = (a: number[], b: number[]): number => Math.max(...a.slice(0, 3).map((v, i) => Math.abs(v - (b[i] ?? v))));
  expect(diff(rest, held), `rest ${rest} held ${held}`).toBeGreaterThanOrEqual(6);
  expect(diff(restEdge, heldEdge), "the button itself is not filled, only its face").toBeLessThan(3);
});

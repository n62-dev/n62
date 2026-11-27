// SPDX-License-Identifier: GPL-3.0-or-later
// R11: the actions of a history row (Home and CAS), from keys and from touch. One list of four on ☰ (S2 rules M1, M2; R830: Store, Copy and Paste left it), acting on the picked row, else the last result (Delete: the last row); the picked row's
// buttons are Store ▶ and Copy › (R276: a hold copies, a swipe deletes, rowgestures.spec.ts); ◀ on a pick recalls it. Expected values are derived: 1/3 and 2/3 as 12 shown digits.
import { expect, test, type Page } from "@playwright/test";
import { COPY, entryValue, open, tap } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

const clipboard = (page: Page): Promise<string> => page.evaluate(() => navigator.clipboard.readText());
const done = (page: Page, n: number) => expect(page.locator('[data-status="done"]')).toHaveCount(n);
const bar = (page: Page) => page.getByTestId("row-actions");
const item = (page: Page, name: RegExp) => page.getByTestId("menu").getByRole("menuitem", { name });

/** 1÷3, 2÷3 and 1÷4, each finished. */
async function three(page: Page): Promise<void> {
  for (const keys of [["d1", "div", "d3"], ["d2", "div", "d3"], ["d1", "div", "d4"]]) {
    await tap(page, [...keys, "enter"]);
  }
  await done(page, 3);
}

test("Up on an empty line shows the row buttons; typing hides them", async ({ page }) => {
  await three(page);
  await expect(bar(page)).toHaveCount(0);
  await tap(page, ["up"]);
  await expect(bar(page).getByRole("button")).toHaveText(["Store ▶", "Copy ›"]);
  await tap(page, ["d5"]);
  await expect(bar(page)).toHaveCount(0);
  expect(await entryValue(page)).toBe("5");
});

test("the row buttons and ☰ act on the picked row (touch)", async ({ page }) => {
  await three(page);
  await tap(page, ["up", "up"]); // 2/3
  await bar(page).getByRole("button", { name: "Copy ›" }).tap();
  await item(page, /Exact/).tap();
  await expect.poll(() => clipboard(page)).toBe("2/3");
  await expect(bar(page)).toHaveCount(0); // an action ends the pick
  await tap(page, ["up", "up", ...COPY]); // Shift + Select: what a hold copies, of the pick (R723)
  await expect.poll(() => clipboard(page)).toBe("0." + "6".repeat(39) + "7");
  await tap(page, ["up", "up", "enter"]); // Enter on the pick inserts the result (R720: ☰ has no Insert)
  expect(await entryValue(page)).toContain("\\res");
});

test("◀ on a pick with an empty line puts its entry back on the line and drops the pick (R720)", async ({ page }) => {
  await tap(page, ["d1", "add", "d2", "enter", "d3", "mul", "d4", "enter"]);
  await done(page, 2);
  await tap(page, ["up", "up", "left"]);
  expect(await entryValue(page)).toBe("1+2");
  await expect(bar(page)).toHaveCount(0);
});

test("the hardware ArrowLeft does the same (R720)", async ({ page }) => {
  await tap(page, ["d1", "add", "d2", "enter", "d3", "mul", "d4", "enter"]);
  await done(page, 2);
  await tap(page, ["up", "up"]);
  await page.keyboard.press("ArrowLeft");
  expect(await entryValue(page)).toBe("1+2");
  await expect(bar(page)).toHaveCount(0);
});

test("◀ on a picked error row gives its input back (R720)", async ({ page }) => {
  await tap(page, ["d1", "emark", "d2", "dot", "d5", "enter"]); // 1ᴇ2.5
  await expect(page.locator('[data-status="error"]')).toHaveCount(1);
  await tap(page, ["up", "left"]);
  expect(await entryValue(page)).not.toBe("");
  await expect(bar(page)).toHaveCount(0);
});

test("controls: tap a row, type 5, ◀ moves the caret and the line stays 5", async ({ page }) => {
  await three(page);
  await tap(page, ["up", "d5", "left"]);
  expect(await entryValue(page)).toBe("5");
  await expect(bar(page)).toHaveCount(0);
});

test("controls: ▲ Enter inserts the result chip, two taps on the input recall it and two on the result insert it", async ({ page }) => {
  await three(page);
  await tap(page, ["up", "enter"]);
  expect(await entryValue(page)).toContain("\\res");
  await tap(page, ["esc"]);
  await page.locator('[data-testid="result"] .result').last().tap();
  await page.locator('[data-testid="result"] .result').last().tap();
  expect(await entryValue(page)).toContain("\\res");
  await tap(page, ["esc"]);
  await page.locator("article.item button.in").last().tap();
  await page.locator("article.item button.in").last().tap();
  expect(await entryValue(page)).toBe("\\frac14");
});

test("controls: Shift + ᴇ on a pick opens Store in; Shift + Esc clears the history of the line", async ({ page }) => {
  await three(page);
  await tap(page, ["up", "shift", "emark"]);
  await expect(page.getByTestId("sheet-title")).toContainText("Store");
  await tap(page, ["esc", "esc"]);
  await tap(page, ["d5", "shift", "esc"]);
  expect(await entryValue(page)).toBe("");
});

test("Store ▶ puts the result and the store arrow on the line, ready for the name", async ({ page }) => {
  await three(page);
  await tap(page, ["up"]);
  await bar(page).getByRole("button", { name: "Store ▶" }).tap();
  const v = await entryValue(page);
  expect(v).toContain("\\res");
  expect(v.endsWith("\\blacktriangleright")).toBe(true);
  await tap(page, ["alpha", "vars", "enter"]); // 1/4 ▶ A
  await done(page, 4);
  await tap(page, ["alpha", "vars", "enter"]);
  await expect(page.locator('[data-testid="result"] .result').last()).toHaveAttribute("data-text", "0.25");
});

test("Menu is one list of four, Export › the fourth (R145: Settings is the ⚙, not a row; R830), the same with or without a picked row", async ({ page }) => {
  await three(page);
  const names = ["Delete", "Share session", "Clear history", "Export›"];
  await tap(page, ["@menu"]);
  await expect(page.getByTestId("menu").getByRole("menuitem")).toHaveText(names.map((n, i) => `${i + 1}${n}`));
  await tap(page, ["esc", "up", "@menu"]);
  await expect(page.getByTestId("menu").getByRole("menuitem")).toHaveText(names.map((n, i) => `${i + 1}${n}`));
  // 5 to 9 and 0 are blank: the sheet stays open and nothing runs
  await tap(page, ["d5", "d8", "d9", "d0"]);
  await expect(page.getByTestId("menu")).toBeVisible();
  await expect(page.getByTestId("menu").getByRole("menuitem")).toHaveCount(4);
  expect(await entryValue(page)).toBe("");
  await done(page, 3);
});

test("Menu 1 deletes the last row when none is picked", async ({ page }) => {
  await three(page);
  await tap(page, ["@menu", "d1"]);
  await done(page, 2);
});

test("Menu 1 on a picked row deletes that row, not the last", async ({ page }) => {
  await three(page);
  // the middle of three: the keys' Delete on a pick (R276: the bar has none; TalkBack cannot swipe)
  await tap(page, ["up", "up", "@menu", "d1"]);
  await done(page, 2);
  const texts = await page.locator('[data-testid="result"] .result').evaluateAll((els) => els.map((e) => e.getAttribute("data-text")));
  expect(texts).toEqual(["0.333333333333", "0.25"]);
});

test("The picked row's Copy › opens full value, as shown, exact, LaTeX, Python; its first writes what a hold does (R830: not on ☰)", async ({ page }) => {
  await tap(page, ["d1", "div", "d3", "enter"]);
  await done(page, 1);
  await tap(page, ["up"]);
  await bar(page).getByRole("button", { name: /Copy/ }).tap({ timeout: 5000 });
  await expect(page.getByTestId("sheet-title")).toHaveText(/Copy$/);
  await expect(page.getByTestId("menu").getByRole("menuitem")).toHaveText(["1Full value", "2As shown", "3Exact", "4LaTeX", "5Python"]);
  await tap(page, ["d3"]);
  await expect.poll(() => clipboard(page)).toBe("1/3");
  await tap(page, ["up"]); // the pick ended with the button: pick the row again
  await bar(page).getByRole("button", { name: /Copy/ }).tap({ timeout: 5000 });
  await tap(page, ["d1"]);
  await expect.poll(() => clipboard(page)).toBe("0." + "3".repeat(40));
  const held = page.locator('[data-testid="result"] .result').first();
  const box = await held.boundingBox();
  if (!box) throw new Error("no result row");
  await page.evaluate(() => navigator.clipboard.writeText("x"));
  await page.mouse.move(box.x + 4, box.y + 4);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect.poll(() => clipboard(page)).toBe("0." + "3".repeat(40));
});

test("a long press (a mouse held) copies that row's result and opens no menu (R276)", async ({ page }) => {
  await three(page);
  const first = page.locator('[data-testid="result"] .result').first();
  const box = await first.boundingBox();
  if (!box) throw new Error("no result row");
  await page.mouse.move(box.x + 4, box.y + 4);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect.poll(() => clipboard(page)).toBe("0." + "3".repeat(40));
  await page.waitForTimeout(200);
  await expect(page.getByTestId("menu")).toHaveCount(0);
  await expect(bar(page)).toHaveCount(0); // the click after the lift picks nothing
  await done(page, 3);
});

test("with an empty history the actions are disabled; with only an error row they say why", async ({ page }) => {
  await tap(page, ["@menu"]);
  await expect(item(page, /^1 ?Delete/)).toBeDisabled();
  await expect(item(page, /^3 ?Clear history/)).toBeDisabled();
  await tap(page, ["esc", "d1", "emark", "d2", "dot", "d5", "enter"]); // 1ᴇ2.5: an error row: there are rows, but no result
  await expect(page.locator('[data-status="error"]')).toHaveCount(1);
  await tap(page, ["up"]); // the error row is picked: the bar's Store ▶ and Copy › have no result to act on
  await expect(bar(page).getByRole("button")).toHaveText(["Store ▶", "Copy ›"]);
  for (const b of await bar(page).getByRole("button").all()) await expect(b).toBeDisabled();
  await tap(page, ["@menu"]); // R830: the finished rows include the error row, so Share and Export › are on
  await expect(item(page, /^1 ?Delete/)).toBeEnabled();
  await expect(item(page, /^2 ?Share session/)).toBeEnabled();
});

test("the row buttons cost no viewport: on an empty line no history pixel and no key moves (R3, R147)", async ({ page }) => {
  await three(page);
  const top = () => page.locator('[data-key="d5"]').evaluate((e) => e.getBoundingClientRect().top);
  const rows = () => page.locator("article.item").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
  const scroll = () => page.locator("section.history").evaluate((e) => [e.scrollTop, e.getBoundingClientRect().height]);
  const [before, rowsBefore, scrollBefore] = [await top(), await rows(), await scroll()];
  await tap(page, ["up"]);
  await expect(bar(page)).toBeVisible();
  expect(await top()).toBe(before);
  expect(await rows()).toEqual(rowsBefore);
  expect(await scroll()).toEqual(scrollBefore);
  await tap(page, ["up"]); // walking the rows moves nothing either
  expect(await rows()).toEqual(rowsBefore);
});

test("CAS has the same buttons and its own rows", async ({ page }) => {
  await tap(page, ["d1", "d2", "enter"]);
  await done(page, 1);
  await tap(page, ["@cas", "d3", "d4", "enter"]);
  await done(page, 1); // the CAS history is separate
  await tap(page, ["up"]);
  await expect(bar(page).getByRole("button")).toHaveText(["Store ▶", "Copy ›"]);
  await tap(page, ["@menu", "d1"]); // ☰ 1 Delete on the pick
  await expect(page.locator('[data-status="done"]')).toHaveCount(0);
  await tap(page, ["@home"]);
  await done(page, 1); // Home still has its row
  await tap(page, ["@menu"]);
  await expect(page.getByTestId("menu").getByRole("menuitem")).toHaveCount(4); // the four (R830)
});

// R742: zebra rows. Every second row counted from the oldest is --row-alt; the rows run to the history's edges; the picked row is
// --pick with a 2 px --focus edge inside it and a start bar, its glyphs clear of the edge; the pitch and the rows seen are phase-1's.
const css = (page: Page, role: string): Promise<string> =>
  page.evaluate((r) => {
    const probe = document.createElement("div");
    probe.style.background = `var(--${r})`;
    document.body.append(probe);
    const v = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return v;
  }, role);
/** The colour a row shows: its own background, else the first opaque one of its ancestors. */
const ground = (page: Page): Promise<string[]> =>
  page.locator("article.item").evaluateAll((els) =>
    els.map((e) => {
      for (let n: Element | null = e; n; n = n.parentElement) {
        const b = getComputedStyle(n).backgroundColor;
        if (b !== "rgba(0, 0, 0, 0)" && b !== "transparent") return b;
      }
      return "none";
    }),
  );

test("zebra: rows 1 and 3 of four are --row-alt, 0 and 2 --bg; one more row recolours none (R742)", async ({ page }) => {
  await three(page);
  await tap(page, ["d2", "div", "d5", "enter"]);
  await done(page, 4);
  const [alt, bg] = [await css(page, "row-alt"), await css(page, "bg")];
  expect(alt).not.toBe(bg);
  const alts = () => page.locator("article.item").evaluateAll((els) => els.map((e) => e.getAttribute("data-alt")));
  expect(await alts()).toEqual([null, "true", null, "true"]);
  expect(await ground(page)).toEqual([bg, alt, bg, alt]);
  await tap(page, ["d3", "div", "d5", "enter"]);
  await done(page, 5);
  expect(await alts()).toEqual([null, "true", null, "true", null]);
  expect(await ground(page)).toEqual([bg, alt, bg, alt, bg]);
});

test("zebra: each row spans the history; no divider; the picked row's 2 px --focus edge and start bar, glyphs 4 px inside (R742)", async ({ page }) => {
  await three(page);
  const spans = await page.evaluate(() => {
    const h = document.querySelector("section.history") as HTMLElement;
    const hb = h.getBoundingClientRect();
    return [...document.querySelectorAll("article.item")].map((e) => {
      const b = e.getBoundingClientRect();
      return [b.left - hb.left, b.width - h.clientWidth, getComputedStyle(e, "::before").content];
    });
  });
  for (const [dx, dw, before] of spans) {
    expect(Math.abs(dx as number)).toBeLessThanOrEqual(1);
    expect(Math.abs(dw as number)).toBeLessThanOrEqual(1);
    expect(before).toBe("none");
  }
  await tap(page, ["up", "up"]); // the middle row, a zebra row: the whole-row pick
  const row = page.locator('article.item[data-selected="true"]');
  await expect(row).toHaveAttribute("data-part", "row");
  const focus = await css(page, "focus");
  const look = await row.evaluate((e) => {
    const s = getComputedStyle(e);
    return [s.outlineWidth, s.outlineStyle, s.outlineColor, s.outlineOffset, s.boxShadow, s.backgroundColor];
  });
  expect(look.slice(0, 4)).toEqual(["2px", "solid", focus, "-2px"]);
  expect(look[4]).toBe(`${focus} 6px 0px 0px 0px inset`);
  expect(look[5]).toBe(await css(page, "pick"));
  const r = await row.boundingBox();
  if (!r) throw new Error("no picked row");
  for (const part of [row.locator("button.in"), row.locator(".result")]) {
    const g = await part.boundingBox();
    if (!g) throw new Error("no glyph box");
    expect(g.x - r.x, "left").toBeGreaterThanOrEqual(4);
    expect(g.y - r.y, "top").toBeGreaterThanOrEqual(4);
    expect(r.x + r.width - (g.x + g.width), "right").toBeGreaterThanOrEqual(4);
    expect(r.y + r.height - (g.y + g.height), "bottom").toBeGreaterThanOrEqual(4);
  }
  await tap(page, ["esc"]);
  const alt = page.locator('article.item[data-alt="true"]');
  await alt.locator(".result").tap(); // a lit result keeps R832's look, its row the zebra ground
  await expect(alt).toHaveAttribute("data-part", "result");
  expect(await alt.evaluate((e) => [getComputedStyle(e).backgroundColor, getComputedStyle(e).outlineStyle])).toEqual([await css(page, "row-alt"), "none"]);
});

// The pitch, the last input's place and the rows seen whole, measured on phase-1 ae9f7974 (12 rows of 1÷n, Pixel 7 emulation).
for (const [w, h, last, seen] of [[412, 839, 201.6, 3], [360, 740, 102.6, 2]] as const)
  test(`zebra at ${w} × ${h}: the rows' pitch, the last input's place and the rows seen are phase-1's (R742)`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    for (const d of ["d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8", "d9", "d1", "d2", "d3"]) await tap(page, ["d1", "div", d, "enter"]);
    await done(page, 12);
    await expect.poll(() => page.locator("section.history").evaluate((e) => e.scrollHeight - e.clientHeight - e.scrollTop)).toBeLessThanOrEqual(1);
    const m = await page.evaluate(() => {
      const hb = (document.querySelector("section.history") as HTMLElement).getBoundingClientRect();
      const rows = [...document.querySelectorAll("article.item")].map((e) => e.getBoundingClientRect());
      const ins = [...document.querySelectorAll("article.item .in")].map((e) => e.getBoundingClientRect().top);
      return { pitch: ins.slice(1).map((v, i) => v - (ins[i] as number)), last: ins.at(-1) as number, seen: rows.filter((r) => r.top >= hb.top - 0.5 && r.bottom <= hb.bottom + 0.5).length };
    });
    for (const p of m.pitch) expect(Math.abs(p - 86.88)).toBeLessThanOrEqual(1);
    expect(Math.abs(m.last - last)).toBeLessThanOrEqual(1);
    expect(m.seen).toBe(seen);
  });

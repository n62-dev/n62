// SPDX-License-Identifier: GPL-3.0-or-later
// R156 (docs/05 3.10): Key shadows, a switch in Settings › Appearance after Plain keys, on at a first start. On, every key
// and the round pad has a solid 2 px line under it in --key-edge (a shadow: no box moves); off, none has; an empty user
// key (an outlined slot) and the pad's arrow zones never have one. The first frame follows the stored value. The fake engine.
import { expect, test, type Page } from "@playwright/test";
import { open, sheet, tap } from "./helpers.ts";

interface Look {
  family: "n62" | "bw" | "solarized";
  brightness: "light" | "dark";
  contrast: boolean;
  plain: boolean;
  shadow: boolean;
}
const row = (page: Page, id: string) => sheet(page).locator(`[role="menuitem"][data-id="${id}"]`);

/** Put a look on the page as Appearance does (theme/lookApply.ts), its files loaded. */
const show = (page: Page, look: Look): Promise<void> =>
  page.evaluate(async (l) => {
    const url = "/src/theme/lookApply.ts";
    const m = (await import(/* @vite-ignore */ url)) as typeof import("../src/theme/lookApply.ts");
    await m.applyLook(l);
  }, look);

interface Drawn {
  edge: string;
  keys: { id: string; skip: boolean; empty: boolean; drops: string[]; box: number[] }[];
  pad: string[];
}
/** Each key's and the round pad's outer (not inset) shadows that draw something, its box, and --key-edge as rgb. */
const drawn = (page: Page): Promise<Drawn> =>
  page.evaluate(() => {
    const drops = (el: Element): string[] =>
      getComputedStyle(el)
        .boxShadow.split(/,(?![^(]*\))/)
        .map((s) => s.trim())
        .filter((s) => s !== "none" && !s.includes("inset") && !s.startsWith("rgba(0, 0, 0, 0)"));
    const probe = document.createElement("i");
    probe.style.color = "var(--key-edge)";
    document.body.append(probe);
    const edge = getComputedStyle(probe).color;
    probe.remove();
    const keys = [...document.querySelectorAll<HTMLElement>(".pad .key[data-key]")].map((k) => {
      const r = k.getBoundingClientRect();
      return {
        id: k.dataset["key"] ?? "",
        skip: k.dataset["zone"] === "true",
        empty: k.dataset["user"] === "empty" || k.dataset["pad"] === "empty",
        drops: drops(k),
        box: [r.x, r.y, r.width, r.height],
      };
    });
    const pad = document.querySelector(".trackpad");
    return { edge, keys, pad: pad ? drops(pad) : ["no pad"] };
  });

const COMBOS: (Omit<Look, "shadow"> & { edge?: string })[] = [
  { family: "n62", brightness: "dark", contrast: false, plain: false, edge: "rgb(0, 0, 0)" },
  { family: "n62", brightness: "light", contrast: false, plain: false, edge: "rgb(141, 161, 160)" }, // #8da1a0
  { family: "bw", brightness: "light", contrast: false, plain: false },
  { family: "solarized", brightness: "dark", contrast: false, plain: false, edge: "rgb(0, 0, 0)" },
  { family: "n62", brightness: "dark", contrast: true, plain: false, edge: "rgb(0, 0, 0)" },
  { family: "n62", brightness: "light", contrast: false, plain: true },
];

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 372, height: 767 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
});

test("Appearance: Key shadows is a switch after Plain keys with its line, on at a first start; it toggles the page and survives a reload", async ({ page }) => {
  await open(page);
  await expect(page.locator("html")).toHaveAttribute("data-shadow", "on");
  expect(await page.evaluate(() => window.n62.session.settings.look.shadow)).toBe(true);
  await tap(page, ["@mode", "d6", "d1"]);
  const ids = await sheet(page).getByRole("menuitem").evaluateAll((els) => els.map((e) => e.getAttribute("data-id")));
  expect(ids).toEqual(["theme", "brightness", "contrast", "plain", "shadow", "pops"]); // (Key pop-ups: R163)
  await expect(row(page, "shadow").locator(".label")).toHaveText("Key shadows");
  await expect(row(page, "shadow").getByTestId("row-hint")).toHaveText("A dark line under each key");
  await expect(row(page, "shadow")).toHaveAttribute("data-selected", "true");
  await expect(row(page, "theme")).toHaveAttribute("data-active", "true"); // it opens on Theme, not on the ticked switch
  await tap(page, ["d5"]);
  await expect(page.locator("html")).not.toHaveAttribute("data-shadow", /.*/);
  await expect(row(page, "shadow")).toHaveAttribute("data-selected", "false");
  await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem("n62.look") ?? "{}") as { shadow?: unknown }).shadow)).toBe(false);
  await page.waitForTimeout(300); // the store writes behind the change
  await page.reload();
  await page.waitForFunction(() => window.n62 !== undefined);
  await expect(page.locator("html")).not.toHaveAttribute("data-shadow", /.*/);
  expect(await page.evaluate(() => window.n62.session.settings.look.shadow)).toBe(false);
  expect((await drawn(page)).keys.filter((k) => k.drops.length > 0).map((k) => k.id)).toEqual([]);
});

for (const c of COMBOS) {
  const name = `${c.family} ${c.brightness}${c.contrast ? " high contrast" : ""}${c.plain ? " plain keys" : ""}`;
  test(`${name}: on, a line under every key and the round pad; off, none; an empty slot never; no box moves`, async ({ page }) => {
    await open(page);
    await show(page, { ...c, shadow: true });
    const on = await drawn(page);
    if (c.edge !== undefined) expect(on.edge).toBe(c.edge);
    const line = `${on.edge} 0px 2px 0px 0px`;
    const keys = on.keys.filter((k) => !k.skip && !k.empty);
    expect(keys.length).toBeGreaterThan(40);
    expect(on.keys.some((k) => k.empty), "an empty user key on the pad").toBe(true);
    for (const k of keys) expect(k.drops, k.id).toEqual([line]);
    for (const k of on.keys.filter((k) => k.skip || k.empty)) expect(k.drops, k.id).toEqual([]);
    expect(on.pad).toEqual([line]);
    await show(page, { ...c, shadow: false });
    const off = await drawn(page);
    expect(off.keys.filter((k) => k.drops.length > 0).map((k) => k.id)).toEqual([]);
    expect(off.pad).toEqual([]);
    expect(off.keys.map((k) => [k.id, ...k.box])).toEqual(on.keys.map((k) => [k.id, ...k.box])); // no key's box or touch area moves
    await page.screenshot({ path: `test-results/keyshadow-${name.replace(/ /g, "-")}.png` });
  });
}

test.describe("the first frame", () => {
  /** The root's data-shadow of a start with `mirror` as index.html's stored look, main.ts held (the app has not started). */
  async function firstShadow(page: Page, mirror: Record<string, unknown>): Promise<string | null> {
    await page.addInitScript((m) => localStorage.setItem("n62.look", JSON.stringify(m)), mirror);
    let release: () => void = () => {};
    const held = new Promise<void>((res) => (release = res));
    await page.route(/\/src\/main\.ts/, async (route) => {
      await held;
      await route.abort();
    });
    await page.goto("/?engine=fake&tips=off", { waitUntil: "commit" });
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-family"));
    const out = await page.evaluate(() => document.documentElement.getAttribute("data-shadow"));
    expect(await page.evaluate(() => window.n62)).toBeUndefined();
    release();
    return out;
  }
  test("a stored off: no line from the first frame (index.html leaves data-shadow off)", async ({ page }) => {
    expect(await firstShadow(page, { family: "n62", brightness: "dark", contrast: false, plain: false, shadow: false })).toBeNull();
  });
  test("a look stored before Key shadows (no field): on from the first frame", async ({ page }) => {
    expect(await firstShadow(page, { family: "n62", brightness: "light", contrast: false, plain: false })).toBe("on");
  });
});

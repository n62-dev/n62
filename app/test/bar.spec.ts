// SPDX-License-Identifier: GPL-3.0-or-later
// R722: the bar on the keypad's top edge (docs/05 3.2): Apps ▾ · Home | CAS · ⇧/α · RAD · STD ▾ · 12 ▾ · ☰, 28 px, flush
// on the keys; the short key rows a notch taller (43 / 33 px under 1000 px tall). The fake engine.
import { expect, test, type Page } from "@playwright/test";
import { BAR_ITEMS } from "../src/views/barItems.ts";
import { hwOn, open, sheet, tap, touch } from "./helpers.ts";

const box = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const r = document.querySelector(s)?.getBoundingClientRect();
    return r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, width: r.width } : null;
  }, sel);
const BAR = '[data-testid="bar"]';
const angle = (page: Page) => page.evaluate(() => window.n62.session.settings.angle);
const toApp = async (page: Page, app: "function" | "solve", view: "symb" | "plot" | "num"): Promise<void> => {
  await page.evaluate(([a, v]) => window.n62.shell.open(a, v), [app, view] as const);
  await page.waitForFunction(() => window.n62.shell.loading === null && window.n62.shell.current !== null);
};

test("the order at 412 × 815: the entry line, the bar and the pad touch, and the screen is 343 px (R722)", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 815 });
  await open(page);
  const entry = await box(page, '[data-testid="entry"]');
  const bar = await box(page, BAR);
  const keys = await box(page, '[data-testid="keys"]');
  const screen = await box(page, ".screen");
  expect(bar?.height).toBe(28);
  expect(Math.abs((entry?.bottom ?? 0) - (bar?.top ?? -9))).toBeLessThanOrEqual(0.5);
  expect(Math.abs((bar?.bottom ?? 0) - (keys?.top ?? -9))).toBeLessThanOrEqual(0.5);
  expect(screen?.top).toBe(0);
  console.log(`412 × 815: screen ${screen?.height} px, keys ${keys?.height} px, history ${(screen?.height ?? 0) - (entry?.height ?? 0)} px`);
  expect(Math.abs((screen?.height ?? 0) - 343)).toBeLessThanOrEqual(1);
});

test("Home shows the Home tab selected and the CAS tab; one tap switches; Home from Function › Plot is one tap (R722)", async ({ page }) => {
  await open(page);
  const home = page.getByTestId("tab-home");
  const cas = page.getByTestId("tab-slot");
  await expect(home).toHaveAttribute("role", "tab");
  await expect(home).toHaveAttribute("aria-selected", "true");
  await expect(cas).toHaveAttribute("aria-selected", "false");
  await cas.tap();
  expect(await page.evaluate(() => window.n62.session.view)).toBe("cas");
  await expect(cas).toHaveAttribute("aria-selected", "true");
  await expect(home).toHaveAttribute("aria-selected", "false");
  await toApp(page, "function", "plot");
  await expect(home).toHaveAttribute("aria-selected", "false");
  await expect(cas).toHaveAttribute("aria-selected", "false");
  await home.tap();
  expect(await page.evaluate(() => [window.n62.shell.app, window.n62.session.view])).toEqual([null, "home"]);
});

test("the bar's controls stand in the lock's order, left to right (spec/layout-lock.yaml bar:, R722, R786: ⌄ first)", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("keys")).toHaveAttribute("data-fold-ready", "true"); // ⌄ comes with the fold's chunk
  const items = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-testid="bar"] [data-item]')].map((e) => ({ n: e.dataset["item"], x: e.getBoundingClientRect().left })),
  );
  expect(items.map((i) => i.n)).toEqual([...BAR_ITEMS]);
  expect(items.every((it, i) => i === 0 || it.x > (items[i - 1]?.x ?? 0))).toBe(true);
});

test("the place opens Apps; in Function it shows the app's glyph and, after the tabs, its views (R722, R785)", async ({ page }) => {
  await open(page);
  await page.getByTestId("place").tap();
  await expect(page.getByTestId("apps")).toBeVisible();
  await page.getByTestId("place").tap();
  await toApp(page, "function", "symb");
  await expect(page.getByTestId("place")).toContainText("ƒ");
  for (const v of ["symb", "plot", "num"]) await expect(page.getByTestId(`tab-${v}`)).toBeVisible();
  const place = (await box(page, '[data-testid="place"]'))!;
  const symb = (await box(page, '[data-testid="tab-symb"]'))!;
  const home = (await box(page, '[data-testid="tab-home"]'))!;
  expect(place.right <= home.left + 0.5 && home.right <= symb.left + 0.5).toBe(true); // glyph ▾, the tabs, the hairline, then the views (the bay)
});

test("the STD|12 chip is one target with no ▾ and opens Mode on Format (R722, R785)", async ({ page }) => {
  await open(page);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="chip-format"]')!, "::after").content)).toBe("none");
  await page.getByTestId("chip-format").tap();
  await expect(sheet(page).locator('[role="menuitem"][data-active="true"]')).toHaveAttribute("data-id", "format");
  await tap(page, ["esc"]);
  await expect(sheet(page)).toBeHidden();
});

/** A finger goes down on a key and the browser's click lands on a bar button (a tap whose up is over the bar). */
async function downOnKeyClickOn(page: Page, key: string, target: string): Promise<void> {
  const f = await touch(page, key);
  await page.evaluate((t) => document.querySelector(`[data-testid="${t}"]`)?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 })), target);
  await f.cancel();
}

test("the guard: a press that went down on a key never acts on the bar (R722)", async ({ page }) => {
  await open(page);
  await downOnKeyClickOn(page, "esc", "chip-angle");
  expect(await angle(page)).toBe("rad");
  await downOnKeyClickOn(page, "help", "chip-format"); // a press that went down on a key
  await expect(sheet(page)).toHaveCount(0);
  await page.getByTestId("chip-angle").tap(); // a press that went down on the chip acts
  expect(await angle(page)).toBe("deg");
});

for (const [width, height, key, nav] of [[412, 839, 43, 33], [360, 740, 43, 33], [800, 1148, 48, 36]] as const)
  test(`a digit key is ${key} px and a cluster key ${nav} px at ${width} × ${height} (R722)`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    expect((await box(page, '[data-key="d5"]'))?.height).toBe(key);
    expect((await box(page, '[data-key="esc"]'))?.height).toBe(nav);
  });

test("the states: the ring on the current tile, the busy line read, the lock underline, a or α in CAS, the update pill at the stage's top (R722)", async ({ page }) => {
  await open(page, "engine=fake&delay=800");
  const tile = (id: string) => page.getByTestId(id).locator(".tile");
  await tap(page, ["d2", "add", "d3", "enter"]);
  await expect(page.getByTestId("busy-status")).toHaveText("Working");
  await expect(tile("tab-home")).toHaveAttribute("data-ring", "true");
  await expect(page.locator(BAR)).toHaveAttribute("data-busy", "true");
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await expect(tile("tab-home")).toHaveAttribute("data-ring", "false");
  await page.getByTestId("tab-slot").tap();
  await tap(page, ["alpha", "alpha"]);
  await hwOn(page); // R783: the badge with a hardware keyboard in use
  await expect(page.getByTestId("mod-alpha")).toHaveText("a");
  await expect(page.getByTestId("mod-alpha")).toHaveAttribute("data-lock", "true");
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="mod-alpha"]')!).boxShadow)).not.toBe("none");
  await tap(page, ["alpha"]);
  await page.evaluate(async () => {
    const url = "/src/state/updateOffer.svelte.ts";
    const m = (await import(/* @vite-ignore */ url)) as typeof import("../src/state/updateOffer.svelte.ts");
    m.updateOffer.restart = () => {};
  });
  const note = page.getByTestId("update-note");
  await expect(note).toBeVisible();
  const n = (await note.boundingBox())!;
  const stage = (await box(page, ".stage"))!;
  expect(n.y - stage.top).toBeLessThanOrEqual(12);
  expect(await page.locator(BAR).getByTestId("update-note").count()).toBe(0);
});

test("wide: at 1280 × 716 the bar heads the keypad column and the stage starts at the top (R722)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 716 });
  await open(page);
  const bar = (await box(page, BAR))!;
  const keys = (await box(page, '[data-testid="keys"]'))!;
  const stage = (await box(page, ".stage"))!;
  expect(Math.abs(bar.left - keys.left)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(bar.right - keys.right)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(bar.bottom - keys.top)).toBeLessThanOrEqual(0.5);
  expect(bar.top).toBe(0);
  expect(stage.top).toBe(0);
});

// R856 (owner, 2026-11-22, the mock-up bar-final.html): Home and slot 2 one track of segments, one width and x in every place and
// folded; Home's glyph is a house; the modes one outlined group `STD 12 ▾ │ RAD`, the word last, never filled; in an app the word alone.
type Look = { family: "n62"; brightness: "dark" | "light"; contrast: false; plain: false };
const look = (page: Page, brightness: "dark" | "light"): Promise<void> =>
  page.evaluate(async (l) => {
    const url = "/src/theme/lookApply.ts";
    const m = (await import(/* @vite-ignore */ url)) as typeof import("../src/theme/lookApply.ts");
    await m.applyLook({ ...l, shadow: true, pops: true });
  }, { family: "n62", brightness, contrast: false, plain: false } satisfies Look);
const PLACES = ["home", "cas", "function:symb", "function:plot", "function:num"] as const;
async function goTo(page: Page, place: (typeof PLACES)[number]): Promise<void> {
  await page.evaluate(async (p) => {
    const { session, shell } = window.n62;
    if (p === "home" || p === "cas") {
      shell.close();
      session.view = p;
      return;
    }
    const [app, view] = p.split(":") as ["function", "symb" | "plot" | "num"];
    await shell.open(app, view);
  }, place);
  await page.waitForFunction(() => window.n62.shell.loading === null && (window.n62.shell.app === null || window.n62.shell.current !== null));
  await page.waitForFunction(() => window.n62.shell.app === null || document.querySelector('[data-testid="tab-symb"]') !== null);
}
/** x and width of each control, rounded to 0.1 px ("missing" when not drawn). */
const xw = (page: Page, ids: readonly string[]): Promise<string[]> =>
  page.evaluate((list) => list.map((i) => {
    const e = document.querySelector<HTMLElement>(`[data-testid="${i}"]`);
    if (!e || !e.checkVisibility({ visibilityProperty: true })) return `${i} missing`;
    const r = e.getBoundingClientRect();
    return `${i} ${r.left.toFixed(1)},${r.width.toFixed(1)}`;
  }), ids);
/** Every bar control whose text runs past its box, and the bar's own overflow (the folded row's when folded). */
const overflow = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const out: string[] = [];
    const bar = document.querySelector<HTMLElement>('[data-testid="folded-bar"]') ?? document.querySelector<HTMLElement>('[data-testid="bar"]')!;
    for (const b of bar.querySelectorAll<HTMLElement>("button")) {
      if (!b.checkVisibility({ visibilityProperty: true })) continue;
      if (b.scrollWidth > b.clientWidth) out.push(`${b.dataset["testid"] ?? b.textContent}: ${b.scrollWidth} > ${b.clientWidth}`);
    }
    if (bar.scrollWidth > bar.clientWidth) out.push(`bar: ${bar.scrollWidth} > ${bar.clientWidth}`);
    const right = bar.getBoundingClientRect().right;
    for (const e of bar.querySelectorAll<HTMLElement>("*")) {
      const r = e.getBoundingClientRect();
      if (r.width > 0 && e.checkVisibility({ visibilityProperty: true }) && r.right > right + 0.5) out.push(`${e.dataset["testid"] ?? e.className} ends at ${r.right} > ${right}`);
    }
    return out;
  });

for (const [width, height] of [[360, 740], [412, 915]] as const) {
  test(`one size, one place: APP▾, Home, slot 2, the angle word and ☰ keep x and width in Home, CAS, Function's views and folded; nothing overflows at ${width} × ${height} (R856)`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    await expect(page.getByTestId("keys")).toHaveAttribute("data-fold-ready", "true");
    const IDS = ["place", "tab-home", "tab-slot", "chip-angle", "menu-button"] as const;
    let base: string[] | undefined;
    for (const p of PLACES) {
      await goTo(page, p);
      const now = await xw(page, IDS);
      expect(now.join(" "), p).not.toContain("missing");
      if (base === undefined) base = now;
      else expect(now, `${p}: a control moved or changed width`).toEqual(base);
      expect(await overflow(page), p).toEqual([]);
    }
    await goTo(page, "home");
    await page.getByTestId("fold-chevron").tap();
    await expect(page.getByTestId("folded-bar")).toBeVisible();
    const FOLDED = ["tab-home", "tab-slot", "chip-angle", "menu-button"] as const;
    expect(await xw(page, FOLDED), "folded").toEqual(base!.filter((s) => FOLDED.some((id) => s.startsWith(`${id} `))));
    expect(await overflow(page), "folded").toEqual([]);
  });
}

test("Home's glyph is a house drawn in currentColor, on the bar's tab and in the Apps sheet's Home row; ⊞▾ stays the Apps button (R856)", async ({ page }) => {
  await open(page);
  const house = (sel: string) =>
    page.evaluate((s) => {
      const host = document.querySelector<HTMLElement>(s);
      const svg = host?.querySelector("svg");
      const path = svg?.querySelector("path");
      if (!host || !svg || !path) return null;
      return { img: host.querySelectorAll("img").length, d: path.getAttribute("d"), stroke: getComputedStyle(path).stroke, color: getComputedStyle(host).color };
    }, sel);
  const tab = await house('[data-testid="tab-home"] .tile');
  expect(tab, "the tab's house").not.toBeNull();
  expect(tab!.img).toBe(0); // not the logo
  expect(tab!.stroke).toBe(tab!.color); // currentColor
  await expect(page.getByTestId("place").locator(".tile.grid i")).toHaveCount(4); // ⊞▾: the four boxes
  await page.getByTestId("place").tap();
  const row = await house('[data-testid="apps"] [role="menuitem"][data-id="home"] [data-testid="row-glyph"]');
  expect(row, "the Apps row's house").not.toBeNull();
  expect(row!.img).toBe(0);
  expect(row!.d).toBe(tab!.d); // one house
  expect(row!.stroke).toBe(row!.color);
});

const bg = (page: Page, sel: string): Promise<string> => page.evaluate((s) => getComputedStyle(document.querySelector(s)!).backgroundColor, sel);
/** The background the eye sees under an element: the first ancestor (or its ::before, the tracks') that paints one. */
const under = (page: Page, sel: string): Promise<string> =>
  page.evaluate((s) => {
    const clear = (c: string): boolean => c === "transparent" || /rgba\(.*,\s*0\)$/.test(c);
    for (let e: Element | null = document.querySelector(s); e; e = e.parentElement) {
      const own = getComputedStyle(e).backgroundColor;
      if (!clear(own)) return own;
      const b = getComputedStyle(e, "::before");
      if (b.content !== "none" && !clear(b.backgroundColor)) return b.backgroundColor;
    }
    return getComputedStyle(document.body).backgroundColor;
  }, sel);

test("the modes are one outlined group: STD 12 ▾, a divider, the word RAD or DEG; neither half ever filled; in an app the word alone, nothing between it and ☰ (R856)", async ({ page }) => {
  await open(page);
  const fmt = page.getByTestId("chip-format");
  const word = page.getByTestId("chip-angle");
  const group = page.getByTestId("bar-modes");
  for (const p of ["home", "cas"] as const) {
    await goTo(page, p);
    await expect(group.getByTestId("chip-format")).toHaveCount(1);
    await expect(group.getByTestId("chip-angle")).toHaveCount(1);
    expect((await fmt.innerText()).replace(/\s+/g, " ").trim()).toBe("STD 12 ▾");
    await expect(word).toHaveText("RAD");
    await expect(word.locator("svg")).toHaveCount(0); // a word, not an icon
    const f = (await fmt.boundingBox())!;
    const w = (await word.boundingBox())!;
    expect(f.x + f.width).toBeLessThanOrEqual(w.x + 0.5); // the word last
    expect(await fmt.evaluate((e) => getComputedStyle(e).borderRightWidth)).toBe("1px"); // the divider
    expect(await group.evaluate((e) => getComputedStyle(e).boxShadow)).not.toBe("none"); // outlined
  }
  const barBg = await bg(page, BAR);
  for (const a of ["rad", "deg"] as const) {
    if ((await angle(page)) !== a) await word.tap();
    await expect(word).toHaveText(a.toUpperCase());
    for (const sel of ['[data-testid="chip-angle"]', '[data-testid="chip-format"]']) expect(await under(page, sel), `${sel} in ${a}`).toBe(barBg);
  }
  await word.tap(); // back to RAD
  await goTo(page, "function:symb");
  await expect(fmt).toHaveCount(0);
  await expect(group.getByTestId("chip-angle")).toHaveText("RAD");
  const gap = await page.evaluate(() => {
    const a = document.querySelector('[data-testid="chip-angle"]')!.getBoundingClientRect();
    const m = document.querySelector('[data-testid="menu-button"]')!.getBoundingClientRect();
    const between = [...document.querySelectorAll<HTMLElement>('[data-testid="bar"] *')].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.left >= a.right - 0.5 && r.right <= m.left + 0.5;
    });
    const cs = getComputedStyle(document.querySelector('[data-testid="chip-angle"]')!);
    const ms = getComputedStyle(document.querySelector('[data-testid="menu-button"]')!);
    return { between: between.length, borders: [cs.borderLeftWidth, cs.borderRightWidth, ms.borderLeftWidth] };
  });
  expect(gap).toEqual({ between: 0, borders: ["0px", "0px", "0px"] });
});

test("taps: the word switches RAD ↔ DEG in one tap and counts bar.angle; STD 12 opens Mode on Format; the spoken names stay (R856)", async ({ page }) => {
  await open(page);
  const word = page.getByTestId("chip-angle");
  await expect(word).toHaveAccessibleName("Angle: radians");
  await expect(page.getByTestId("chip-format")).toHaveAccessibleName(/STD|Standard/i);
  await word.tap();
  await expect(word).toHaveText("DEG");
  await expect(word).toHaveAccessibleName("Angle: degrees");
  expect(await angle(page)).toBe("deg");
  await expect.poll(() => page.evaluate(() => window.n62.session.useCounters["bar-uses"]?.get("bar.angle") ?? 0)).toBe(1);
  await page.getByTestId("chip-format").tap();
  await expect(sheet(page).locator('[role="menuitem"][data-active="true"]')).toHaveAttribute("data-id", "format");
});

/** WCAG contrast of two rgb() colours. */
const contrast = (a: string, b: string): number => {
  const lum = (c: string): number => {
    const [r, g, bl] = (c.match(/[\d.]+/g) ?? []).slice(0, 3).map((v) => {
      const s = Number(v) / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};
/** Every drawn text of the bar (a leaf with text) and the colour it is drawn in. */
const texts = (page: Page): Promise<{ sel: string; text: string }[]> =>
  page.evaluate(() => {
    const out: { sel: string; text: string }[] = [];
    let n = 0;
    for (const e of document.querySelectorAll<HTMLElement>('[data-testid="bar"] *')) {
      const own = [...e.childNodes].some((c) => c.nodeType === Node.TEXT_NODE && (c.textContent ?? "").trim() !== "");
      if (!own || !e.checkVisibility({ visibilityProperty: true, opacityProperty: true }) || e.closest(".sr")) continue;
      e.dataset["ctext"] = String(n);
      out.push({ sel: `[data-ctext="${n++}"]`, text: (e.textContent ?? "").trim() });
    }
    return out;
  });

for (const brightness of ["dark", "light"] as const)
  test(`contrast in N62 ${brightness === "dark" ? "Dark" : "Light"}: the current place's and the current view's fill ≥ 3:1 on the bar, every text ≥ 4.5:1 (R856)`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await open(page);
    await look(page, brightness);
    const barBg = await bg(page, BAR);
    for (const p of ["home", "cas", "function:plot"] as const) {
      await goTo(page, p);
      const cur = p === "home" ? '[data-testid="tab-home"] .pface' : p === "cas" ? '[data-testid="tab-slot"] .pface' : '[data-testid="tab-plot"] .face';
      expect(contrast(await bg(page, cur), barBg), `${p}: the current fill`).toBeGreaterThanOrEqual(3);
      if (p === "function:plot") expect(contrast(await bg(page, '[data-testid="place"] .tile'), barBg), "the app's glyph tile").toBeGreaterThanOrEqual(3);
      for (const t of await texts(page)) {
        const color = await page.evaluate((s) => getComputedStyle(document.querySelector(s)!).color, t.sel);
        expect(contrast(color, await under(page, t.sel)), `${p}: "${t.text}"`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

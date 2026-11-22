// SPDX-License-Identifier: GPL-3.0-or-later
// R703: the font-scale walk and its checks, shared by the device test (fontscale.device.ts, the gate) and the e2e control
// (test/fontscale.spec.ts: the same checks pass in the browser at scale 1.0, so they raise no false alarm).
import type { Page } from "@playwright/test";

export type Look = (screen: string) => Promise<void>;

/** What does not fit on the screen as it is: one line per problem (empty: it fits). Also the zoom and the smallest sizes drawn. */
export const measure = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    const W = innerWidth;
    const H = innerHeight;
    const name = (el: Element): string => `${el.closest("[data-key]")?.getAttribute("data-key") ?? el.closest("[data-testid]")?.getAttribute("data-testid") ?? el.className}: "${(el.textContent ?? "").trim().slice(0, 24)}"`;
    const textBox = (el: Element): DOMRect => {
      const r = document.createRange();
      r.selectNodeContents(el);
      return r.getBoundingClientRect();
    };
    const visible = (el: Element): boolean => {
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== "hidden";
    };
    const inside = (a: DOMRect, b: DOMRect, what: string, el: Element, vertical = true): void => {
      if (a.width === 0) return;
      if (a.left < b.left - 0.5 || a.right > b.right + 0.5) out.push(`${name(el)} is wider than its ${what} (${a.left.toFixed(1)}..${a.right.toFixed(1)} in ${b.left.toFixed(1)}..${b.right.toFixed(1)})`);
      else if (vertical && (a.top < b.top - 0.5 || a.bottom > b.bottom + 0.5)) out.push(`${name(el)} is taller than its ${what}`);
    };
    let cut = 0;
    let smallest = Infinity;
    // the keypad: each face and legend inside its key (no face over a neighbour), the key on the screen
    for (const key of document.querySelectorAll<HTMLElement>(".pad .key")) {
      const kb = key.getBoundingClientRect();
      if (kb.left < -0.5 || kb.right > W + 0.5) out.push(`${name(key)}: the key lies outside 0..${W}`);
      for (const el of key.querySelectorAll<HTMLElement>("[data-fit]")) {
        if ((el.textContent ?? "").trim() === "") continue;
        if (el.hasAttribute("data-cut")) cut++;
        else inside(textBox(el), kb, "key", el, false);
        smallest = Math.min(smallest, parseFloat(getComputedStyle(el).fontSize));
      }
    }
    // the bar: inside the screen, its height kept; each control inside it, each control's text inside the control
    const bar = document.querySelector<HTMLElement>("[data-testid='bar']");
    if (bar && visible(bar)) {
      const bb = bar.getBoundingClientRect();
      if (bb.left < -0.5 || bb.right > W + 0.5) out.push(`the bar lies outside 0..${W}`);
      for (const c of bar.querySelectorAll<HTMLElement>("button")) {
        if (!visible(c)) continue;
        const cb = c.getBoundingClientRect();
        inside(cb, bb, "bar", c);
        if (!c.querySelector("[data-cut]")) inside(textBox(c), cb, "control", c);
      }
    }
    // an open sheet: each row label whole or ellipsed below the floor (data-cut), each row and value button on the screen
    for (const el of document.querySelectorAll<HTMLElement>("[role='menu'] .row .label, [role='menu'] .opt")) {
      if (!visible(el)) continue;
      if (el.hasAttribute("data-cut")) cut++;
      else if (el.scrollWidth > el.clientWidth + 1) out.push(`${name(el)} is cut (${el.scrollWidth} in ${el.clientWidth})`);
      const b = el.getBoundingClientRect();
      if (b.left < -0.5 || b.right > W + 0.5) out.push(`${name(el)} lies outside 0..${W}`);
    }
    // the tips: "Got it" on the screen, and a list that scrolls marked so
    const got = document.querySelector<HTMLElement>("[data-testid='tips-got-it']");
    if (got) {
      const g = got.getBoundingClientRect();
      if (g.top < 0 || g.bottom > H + 0.5 || g.left < 0 || g.right > W + 0.5) out.push(`"Got it" lies off the screen (${g.top.toFixed(0)}..${g.bottom.toFixed(0)} of ${H})`);
      const list = got.closest<HTMLElement>(".cards");
      if (list && list.scrollHeight > list.clientHeight + 1 && !list.hasAttribute("data-more") && list.scrollTop + list.clientHeight < list.scrollHeight - 1)
        out.push(`the tips scroll (${list.scrollHeight} px in ${list.clientHeight}) with no sign that they do`);
      for (const l of document.querySelectorAll<HTMLElement>(".tips .cards")) {
        const b = l.getBoundingClientRect();
        if (b.bottom > H + 0.5 && l.scrollHeight <= l.clientHeight) out.push(`a tips list runs past the screen's foot`);
      }
    }
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;font-size:100px";
    document.body.append(probe);
    const zoom = parseFloat(getComputedStyle(probe).fontSize) / 100;
    probe.remove();
    return { out, zoom, cut, smallest: smallest === Infinity ? 0 : smallest };
  });

export const closeSheet = async (page: Page): Promise<void> => {
  await page.locator('[role="menu"]').first().getByRole("button", { name: "Close" }).tap();
  await page.locator('[role="menu"]').first().waitFor({ state: "detached", timeout: 5000 });
};

/** The screens, from the first-start tips on a fresh profile: tips, Home, Shift armed, Alpha armed, Mode, ☰, Settings, Apps, CAS. */
export async function walk(page: Page, look: Look): Promise<void> {
  // the first-start tips come up on a fresh profile
  await page.getByTestId("tips").waitFor({ state: "visible", timeout: 15_000 });
  await look("tips");
  await page.getByTestId("tips-got-it").tap();
  await page.getByTestId("tips").waitFor({ state: "detached", timeout: 10_000 });
  await look("home");
  await page.locator('[data-key="shift"]').tap();
  await look("shift");
  await page.evaluate(() => window.n62.session.clearModifiers());
  await page.locator('[data-key="alpha"]').tap();
  await look("alpha");
  await page.evaluate(() => window.n62.session.clearModifiers());
  await page.getByTestId("chip-format").tap();
  await look("mode");
  await closeSheet(page);
  await page.getByTestId("menu-button").tap();
  await look("menu");
  await page.getByTestId("sheet-gear").tap();
  await look("settings");
  await closeSheet(page);
  await page.getByTestId("place").tap();
  await look("apps");
  await closeSheet(page);
  await page.getByTestId("tab-slot").tap();
  await look("cas");
}

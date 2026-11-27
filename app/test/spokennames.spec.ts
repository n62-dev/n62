// SPDX-License-Identifier: GPL-3.0-or-later
// R709 (F384): every control a screen reader reaches has a name that says what it is. The T5 walk (docs/research/t5-ui/checks.md,
// "Names") heard the bar's format chip as "STD" and "12" and the unit pad's keys as "÷", "×", "⌫" and "°". Here, in each state
// below, the accessibility tree as Chrome builds it (CDP Accessibility.getFullAXTree, as the walk reads it): every button, menu
// item, tab and switch has a name with a letter, and none is a bare abbreviation (two to four capitals) or a bare number.
import { expect, test, type Page } from "@playwright/test";
import { flick, open, tap } from "./helpers.ts";

const ROLES = new Set(["button", "menuitem", "menuitemradio", "menuitemcheckbox", "tab", "switch"]);

/**
 * Names that may stay short, each with its reason. A digit key is its digit, a letter (an Alpha layer, a unit or a prefix
 * cell, a list's shortcut letter) is its letter: a screen reader says it as it is, and it is what the key types or picks.
 */
const SHORT_OK: readonly { name: RegExp; why: string }[] = [
  { name: /^\d$/, why: "a digit key types its digit" },
  { name: /^\d \d+$/, why: "a numbered list's row whose item is a count (Mode's digits list: '5 12' is shortcut 5, 12 digits)" },
];

interface Ax {
  role?: { value?: string };
  name?: { value?: string };
  ignored?: boolean;
}

/** Every named control of the page's accessibility tree, as role and name. */
async function controls(page: Page): Promise<{ role: string; name: string }[]> {
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = (await cdp.send("Accessibility.getFullAXTree")) as { nodes: Ax[] };
  await cdp.detach();
  return nodes
    .filter((n) => !n.ignored && ROLES.has(n.role?.value ?? ""))
    .map((n) => ({ role: n.role?.value ?? "", name: (n.name?.value ?? "").trim() }));
}

/** What is wrong with a name, or undefined when it says what the control is. */
function fault(name: string): string | undefined {
  if (SHORT_OK.some((s) => s.name.test(name))) return undefined;
  if (!/\p{L}/u.test(name)) return "no letter";
  if (/^[A-Z]{2,4}$/.test(name)) return "a bare abbreviation";
  if (/^\d{2,}$/.test(name)) return "a bare number";
  return undefined;
}

const faults = async (page: Page): Promise<string[]> =>
  (await controls(page)).flatMap((c) => {
    const f = fault(c.name);
    return f === undefined ? [] : [`${c.role} "${c.name}": ${f}`];
  });

/** The unit view is up: its pad on the keys and its field focused (unitpad.spec.ts). */
const unitUp = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const named = (page: Page) => expect(page.locator('.pad [data-key="sin"]')).toHaveAttribute("aria-label", "sine");

const STATES: [string, (p: Page) => Promise<void>][] = [
  ["Home", async () => {}],
  ["CAS", (p) => tap(p, ["@cas"])],
  ["Shift armed", (p) => tap(p, ["shift"])],
  ["Alpha armed", (p) => tap(p, ["alpha"])],
  ["the unit view", async (p) => {
    await flick(p, "tmpl", "up");
    await unitUp(p);
  }],
  ["Mode", (p) => tap(p, ["@mode"])],
  // (row 4 of Mode, Digits: a digit key opens its list of counts)
  ["Mode's digits list", (p) => tap(p, ["@mode", "d4"])],
  ["Settings", (p) => tap(p, ["help"])],
  ["☰", (p) => tap(p, ["@menu"])],
  ["Apps", (p) => tap(p, ["@place"])],
  // (the decimal comma changes two faces, `.` to `,` and `,` to `;`: the walk heard them as "," and ";")
  ["Home with the decimal comma", (p) => p.evaluate(() => window.n62.session.setDecimalMark("comma"))],
];

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page);
  await named(page);
});

for (const [state, go] of STATES)
  test(`${state}: every control's name says what it is`, async ({ page }) => {
    await go(page);
    await page.waitForTimeout(200); // (the names follow the layer in an effect)
    const all = await controls(page);
    expect(all.length).toBeGreaterThan(20);
    expect(await faults(page)).toEqual([]);
  });

test("the bar's format chip is named in words, in each format and digits; the angle chip as before", async ({ page }) => {
  const chip = page.getByTestId("chip-format");
  await expect(chip).toHaveAccessibleName("Number format: Standard. Significant digits: 12. Tap to choose.");
  await page.evaluate(() => {
    window.n62.session.setFormat("eng");
    window.n62.session.setDigits(5);
  });
  await expect(chip).toHaveAccessibleName("Number format: Engineering. Significant digits: 5. Tap to choose.");
  await expect(page.getByTestId("chip-angle")).toHaveAccessibleName("Angle: radians");
});

test("the unit pad's operator and control keys take the main pad's names; ° is the degree sign", async ({ page }) => {
  await flick(page, "tmpl", "up");
  await unitUp(page);
  const key = (id: string) => page.locator(`.pad [data-key="${id}"]`);
  await expect(key("div")).toHaveAccessibleName("Divide");
  await expect(key("mul")).toHaveAccessibleName("Multiply");
  await expect(key("bksp")).toHaveAccessibleName("Backspace");
  await expect(key("frac")).toHaveAccessibleName("Degree sign");
  // (the cells with letters keep their faces: a unit is read as it is written)
  await expect(key("d9")).toHaveAccessibleName("m");
});

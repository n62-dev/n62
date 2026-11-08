// SPDX-License-Identifier: GPL-3.0-or-later
// R154: the entry field's outline says what the keypad will do: --ring at rest, --shift after Shift, --alpha after Alpha
// (and in the Alpha lock), --error after an Enter whose row is an error (1ᴇ2.5; `1/0` is the result ∞) until the next key. Flat colour; the field's box and its text do
// not move by a pixel between the states.
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

const LOOKS = [["n62", "dark"], ["n62", "light"], ["bw", "light"], ["solarized", "dark"]] as const;

async function setLook(page: Page, family: string, brightness: "dark" | "light"): Promise<void> {
  await page.evaluate(
    ([f, b]) => {
      const s = window.n62.session;
      s.settings.look = { ...s.settings.look, family: f as typeof s.settings.look.family, brightness: b as "dark" | "light" };
      s.onLook?.({ ...s.settings.look });
    },
    [family, brightness],
  );
  await page.waitForFunction(([f, b]) => document.documentElement.dataset["family"] === f && document.documentElement.dataset["brightness"] === b, [family, brightness]);
  await page.waitForTimeout(300); // the lazy family file is in
}

/** The outline as drawn, the four tokens as the browser computes them, and the boxes of the field and of its text. */
function outline(page: Page) {
  return page.evaluate(() => {
    const mf = window.n62.entry.field;
    if (!mf) throw new Error("no field");
    const resolve = (v: string): string => {
      const d = document.createElement("div");
      d.style.color = `var(${v})`;
      document.body.append(d);
      const c = getComputedStyle(d).color;
      d.remove();
      return c;
    };
    /** A width token as the browser draws it (outlines snap to whole device pixels, so 2.5px computes as 2px at 1x). */
    const drawn = (v: string): string => {
      const d = document.createElement("div");
      d.style.outline = `var(${v}) solid`;
      document.body.append(d);
      const w = getComputedStyle(d).outlineWidth;
      d.remove();
      return w;
    };
    const cs = getComputedStyle(mf);
    const box = mf.getBoundingClientRect();
    const text = mf.shadowRoot?.querySelector(".ML__content")?.getBoundingClientRect();
    const root = getComputedStyle(document.documentElement);
    return {
      colour: cs.outlineColor,
      style: cs.outlineStyle,
      width: cs.outlineWidth,
      offset: cs.outlineOffset,
      transition: cs.transitionDuration,
      tokens: { ring: resolve("--ring"), shift: resolve("--shift"), alpha: resolve("--alpha"), error: resolve("--error") },
      tokenRest: root.getPropertyValue("--ring-rest").trim(),
      tokenOn: root.getPropertyValue("--ring-on").trim(),
      rest: drawn("--ring-rest"),
      on: drawn("--ring-on"),
      box: [box.x, box.y, box.width, box.height],
      text: text ? [text.x, text.y, text.width, text.height] : null,
    };
  });
}

for (const [family, brightness] of LOOKS)
  test(`${family} ${brightness}: the outline is --ring at rest, --shift, --alpha (armed and locked), --error until the next key`, async ({ page }) => {
    await open(page, "");
    // the real engine: while it starts the outline is --ring-on wide with the dash (R155); under load that outlasts open()
    // (run 763: 3px at rest), so the states are measured once it has started
    await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 30_000 });
    await expect(page.locator(".entry")).not.toHaveAttribute("data-running", "true");
    await setLook(page, family, brightness);
    await tap(page, ["d1", "d2"]);
    await tap(page, ["esc"]); // an empty line, nothing armed
    // the page lays out once more after the look and the first keys (a pixel in Solarized): measure when the field has settled
    for (let last = ""; last !== (last = JSON.stringify((await outline(page)).box)); ) await page.waitForTimeout(150);
    const at = async (state: "ring" | "shift" | "alpha" | "error", width: "rest" | "on") => {
      const o = await outline(page);
      expect(o.colour, `${state}: colour`).toBe(o.tokens[state]);
      expect(o.style).toBe("solid");
      expect(o.width, `${state}: width`).toBe(o[width]);
      expect(o.offset, `${state}: drawn inside`).toBe(`-${o[width]}`);
      expect(o.transition, "no transition").toBe("0s");
      return o;
    };
    const rest = await at("ring", "rest");
    expect([rest.tokenRest, rest.tokenOn]).toEqual(["2.5px", "3.5px"]);
    expect(parseFloat(rest.on)).toBeGreaterThan(parseFloat(rest.rest));
    await tap(page, ["shift"]);
    const shift = await at("shift", "on");
    await tap(page, ["shift"]);
    const back = await at("ring", "rest");
    expect(back.box, "back at rest: the same box").toEqual(rest.box);
    await tap(page, ["alpha"]);
    const alpha = await at("alpha", "on");
    await tap(page, ["alpha"]); // the Alpha lock: the outline stays through the next key
    await at("alpha", "on");
    await tap(page, ["d1"]);
    await at("alpha", "on");
    await tap(page, ["alpha"]); // off
    await tap(page, ["esc"]);
    await at("ring", "rest");
    await tap(page, ["d1", "emark", "d2", "dot", "d5", "enter"]); // 1ᴇ2.5: an error row (1/0 is a result, ∞)
    await expect(page.locator('[data-status="error"]')).toHaveCount(1);
    const error = await at("error", "on");
    await tap(page, ["d1"]);
    await at("ring", "rest");
    // nothing moves: the box and its text are where they were
    for (const [name, o] of [["shift", shift], ["alpha", alpha], ["error", error]] as const) {
      expect(o.box, `${name}: the field's box`).toEqual(rest.box);
      expect(o.text, `${name}: the text`).toEqual(rest.text);
    }
  });

// A character MathLive types itself (hwkeys.ts leaves é, µ and π to it) edits the line too: the error outline goes.
test("the error outline goes when MathLive types a native-only character", async ({ page }) => {
  await open(page, "");
  await tap(page, ["d1", "emark", "d2", "dot", "d5", "enter"]); // 1ᴇ2.5: an error row
  await expect(page.locator('[data-status="error"]')).toHaveCount(1);
  const colour = () => page.evaluate(() => {
    const mf = window.n62.entry.field;
    const d = document.createElement("div");
    d.style.color = "var(--error)";
    document.body.append(d);
    const err = getComputedStyle(d).color;
    d.remove();
    return { now: mf ? getComputedStyle(mf).outlineColor : "", err };
  });
  const before = await colour();
  expect(before.now, "error outline after Enter").toBe(before.err);
  await page.locator(".entry math-field").click();
  await page.keyboard.type("π");
  await expect.poll(async () => (await colour()).now).not.toBe(before.err);
  expect(await page.evaluate(() => window.n62.entry.value)).toBe("π");
});

// SPDX-License-Identifier: GPL-3.0-or-later
// R15c2: the top cluster R3 (docs/mockups/top-cluster-r15c.html; decisions.md "R15c"), one test per path of its press
// table, by touch and by keys; the place name and its hit area; the free keys U1–U6. The editing wing's own jobs are in
// editwing.spec.ts. Fake engine.
import { expect, test, type Page } from "@playwright/test";
import { PASTE, entryValue, flick, open, recordVibrations, setClipboard, sheet, sheetKey, tap, touch, useClipboardLock, vibrations } from "./helpers.ts";

const place = (page: Page) => page.getByTestId("place");
const view = (page: Page) => page.evaluate(() => window.n62.session.view);
const app = (page: Page) => page.evaluate(() => window.n62.shell.app);
const appsSheet = (page: Page) => page.getByTestId("apps");
const angle = (page: Page) => page.evaluate(() => window.n62.session.settings.angle);
const sinh = { label: "sinh", action: { insert: "\\sinh\\left(#0\\right)" } };

test.beforeEach(async ({ page }) => {
  await recordVibrations(page);
  await open(page);
});

test("the cluster is R3: U1-U6 empty in columns 1-2, the round pad, ☰ | Esc, Undo | Redo, Select | Deselect; Shift + Select dimmed (R146, R278)", async ({ page }) => {
  const ids = ["u1", "u2", "up", "menu", "esc", "u3", "u4", "left", "right", "undo", "redo", "u5", "u6", "down", "select", "deselect"];
  const boxes = await page.evaluate(
    (ids) =>
      Object.fromEntries(
        ids.map((id) => {
          const r = document.querySelector(`[data-key="${id}"]`)?.getBoundingClientRect();
          return [id, r ? { x: Math.round(r.x), y: Math.round(r.y) } : null];
        }),
      ),
    ids,
  );
  const rowOf = (ids: string[]) => new Set(ids.map((id) => boxes[id]?.y)).size;
  const colOf = (ids: string[]) => new Set(ids.map((id) => boxes[id]?.x)).size;
  expect(rowOf(["u1", "u2", "up", "menu", "esc"])).toBe(1);
  expect(rowOf(["u3", "u4", "left", "right", "undo", "redo"])).toBe(1);
  expect(rowOf(["u5", "u6", "down", "select", "deselect"])).toBe(1);
  expect(colOf(["u1", "u3", "u5"])).toBe(1);
  expect(colOf(["u2", "u4", "u6"])).toBe(1);
  expect(colOf(["menu", "undo", "select"])).toBe(1);
  expect(colOf(["esc", "redo", "deselect"])).toBe(1);
  for (const u of ["u1", "u2", "u3", "u4", "u5", "u6"]) await expect(page.locator(`[data-key="${u}"]`)).toHaveAttribute("data-user", "empty");
  for (const id of ["menu", "select", "deselect"]) await expect(page.locator(`[data-key="${id}"]`)).not.toHaveAttribute("data-dead", "true"); // (the taps are live)
  const faces = { menu: "☰", esc: "Esc", undo: "Undo", redo: "Redo", select: "Select", deselect: "Deselect" };
  for (const [id, l] of Object.entries(faces)) await expect(page.locator(`[data-key="${id}"] .main`), id).toHaveText(l);
  const legends = { menu: "Settings", esc: "Clear", undo: "⇤", redo: "⇥", select: "Help", deselect: "" };
  for (const [id, l] of Object.entries(legends)) await expect(page.locator(`[data-key="${id}"] .shiftlegend`), id).toHaveText(l);
  // no letter line in the cluster (vertical space)
  await expect(page.locator('[data-key="esc"] .alphalegend, [data-key="u1"] .alphalegend')).toHaveCount(0);
  const gone = ["apps", "symb", "plot", "num", "cancel", "app", "cas", "view", "lstart", "lend", "help", "copy", "paste"];
  await expect(page.locator(gone.map((id) => `[data-key="${id}"]`).join(", "))).toHaveCount(0);
  // Shift on: the reserved Shift + Deselect is drawn dimmed, in that layer only (R278); Help (Select's layer) is live (R197)
  await tap(page, ["shift"]);
  await expect(page.locator('[data-key="select"]')).not.toHaveAttribute("data-dead", "true");
  await expect(page.locator('[data-key="deselect"]')).toHaveAttribute("data-dead", "true");
  await expect(page.locator('[data-key="menu"]')).not.toHaveAttribute("data-dead", "true");
});

test("R146, R278: one press for Redo; Shift + ☰ opens Settings, and so does a flick up on ☰", async ({ page }) => {
  await tap(page, ["d7", "mul", "d8", "undo"]);
  expect(await entryValue(page)).toBe("7\\times");
  await tap(page, ["redo"]);
  expect(await entryValue(page)).toBe("7\\times8");
  await tap(page, ["shift", "menu"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Settings");
  await tap(page, ["esc", "esc"]); // back to Mode, then closed (R49)
  await expect(sheet(page)).toBeHidden();
  await flick(page, "menu", "up");
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Settings");
});

test.describe("R278: ☰ → Paste is how a number comes in from another app", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });
  useClipboardLock();
  test("☰ → Paste puts the clipboard's number on the line", async ({ page }) => {
    await setClipboard(page, "42");
    await tap(page, PASTE);
    await expect.poll(() => entryValue(page)).toBe("42");
  });
});

/** The ☰ key opens and closes the view's menu, as the status line's ☰ does; Shift + ☰ is Settings (R278). */
test("the ☰ key: the Home menu opens and a second tap closes it; Shift + ☰ is Settings", async ({ page }) => {
  await tap(page, ["menu"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Home menu");
  await tap(page, ["menu"]);
  await expect(sheet(page)).toBeHidden();
  await tap(page, ["shift", "menu"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Settings");
});

test("the ☰ key opens the sheet the status line's ☰ opens, in CAS and in each view of Function and Solve", async ({ page }) => {
  const title = async (how: "key" | "status"): Promise<string> => {
    await tap(page, [how === "key" ? "menu" : "@menu"]);
    await expect(sheet(page)).toBeVisible();
    const t = (await page.getByTestId("sheet-title").textContent()) ?? "";
    await tap(page, ["esc"]);
    await expect(sheet(page)).toBeHidden();
    return t;
  };
  const same = async (where: string): Promise<void> => {
    const status = await title("status");
    expect(await title("key"), where).toBe(status);
  };
  await same("Home");
  await tap(page, ["@cas"]);
  await same("CAS");
  await tap(page, ["@place", "d4"]); // Solve
  for (const v of ["@symb", "@num"]) {
    await tap(page, [v]);
    await same(`Solve ${v}`);
  }
  await tap(page, ["@place", "d3"]); // Function
  for (const v of ["@symb", "@plot", "@num"]) {
    await tap(page, [v]);
    await same(`Function ${v}`);
  }
});

test("Shift + Deselect is dead, a tap or a flick up: nothing changes, and each press is counted under its layer", async ({ page }) => {
  await page.evaluate(() => window.n62.session.setHaptics({ on: true, ms: 10 }));
  await tap(page, ["d1", "add", "d2"]);
  const keys = (): Promise<Record<string, number>> => page.evaluate(() => ({ ...window.n62.session.taps.counts.keys }));
  const base = await keys();
  await tap(page, ["shift"]);
  const v1 = (await vibrations(page)).length;
  await tap(page, ["deselect"]); // Shift + Deselect: reserved
  await expect.poll(async () => (await vibrations(page)).length - v1).toBe(3);
  await flick(page, "deselect", "up");
  await expect.poll(async () => (await keys())["deselect:up"] ?? 0).toBe(1);
  const now = await keys();
  expect(now["deselect:shift"]).toBe(1);
  expect(now["deselect:up"]).toBe(1);
  expect(base["deselect:shift"]).toBeUndefined();
  expect(await entryValue(page)).toBe("1+2");
  expect(await page.evaluate(() => window.n62.session.items.length)).toBe(0);
});

test("Home ↔ CAS: the place name and its sheet, by touch and by keys (the sheet's rows 1 and 2)", async ({ page }) => {
  await place(page).tap();
  await appsSheet(page).getByRole("menuitem").nth(1).tap();
  expect(await view(page)).toBe("cas");
  await place(page).tap();
  await appsSheet(page).getByRole("menuitem").first().tap();
  expect(await view(page)).toBe("home");
  await place(page).tap(); // R15c1: the name opens the sheet, it does not switch
  await expect(appsSheet(page)).toBeVisible();
  await tap(page, ["esc"]);
  await expect(appsSheet(page)).toHaveCount(0);
  // the Apps sheet lists Home and CAS first (S2 point 4)
  await place(page).tap();
  await expect(appsSheet(page).getByRole("menuitem")).toHaveText([/^1\s*Home$/, /^2\s*∫\s*CAS$/, /^3\s*ƒ\s*Function$/, /^4\s*x=\?\s*Solve$/]);
  await tap(page, ["d2"]);
  expect(await view(page)).toBe("cas");
  await tap(page, ["@place", "d1"]);
  expect(await view(page)).toBe("home");
});

test("from an app: the place name opens Apps, whose rows 1 and 2 go to Home and CAS", async ({ page }) => {
  await tap(page, ["@cas", "@plot"]);
  await expect(place(page)).toHaveAttribute("data-view", "plot");
  await place(page).tap();
  await expect(appsSheet(page)).toBeVisible();
  await appsSheet(page).getByRole("menuitem").nth(1).tap();
  await expect(place(page)).toHaveAccessibleName(/^Place: CAS\./);
  expect(await app(page)).toBeNull();
  await tap(page, ["@place", "d4"]);
  await expect(page.locator('[data-app="solve"]')).toBeVisible();
  await tap(page, ["@place", "d1"]);
  await expect(place(page)).toHaveAccessibleName(/^Place: Home\./);
  expect(await app(page)).toBeNull();
});

test("Symb, Plot and Num: one tab each inside the app", async ({ page }) => {
  await tap(page, ["@place", "d3"]);
  for (const v of ["symb", "plot", "num"] as const) {
    await page.getByTestId(`tab-${v}`).tap();
    await expect(place(page)).toHaveAttribute("data-view", v);
  }
});

test("the angle: one tap on its chip; Mode from the format chip, then the hardware ▲ to Angle, ▶, Enter (R144)", async ({ page }) => {
  await page.getByTestId("chip-angle").tap();
  expect(await angle(page)).toBe("deg");
  await page.getByTestId("chip-format").tap();
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode");
  await sheetKey(page, ["up", "right", "enter"]);
  expect(await angle(page)).toBe("rad");
  await expect(sheet(page)).toBeHidden();
});

test("Settings: two taps (a chip, then Mode's last row); Esc goes back to Mode (R49)", async ({ page }) => {
  await page.getByTestId("chip-format").tap();
  await sheet(page).locator('[data-id="settings"]').tap();
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Settings");
  await tap(page, ["esc"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode");
});

test("Esc closes ☰'s menu, and clears the line; Undo brings it back", async ({ page }) => {
  await tap(page, ["d1", "add", "d2", "enter", "@menu"]);
  await expect(sheet(page)).toBeVisible();
  await tap(page, ["esc"]);
  await expect(sheet(page)).toBeHidden();
  await tap(page, ["d7", "esc"]);
  expect(await entryValue(page)).toBe("");
  await tap(page, ["undo"]);
  expect(await entryValue(page)).toBe("7");
});

test("your own function: one press on a free key, one flick for its Shift slot; it survives a reload", async ({ page }) => {
  await page.evaluate((b) => {
    window.n62.userKeys.set("u1", "primary", b);
    window.n62.userKeys.set("u1", "shift", { label: "π", action: { insert: "\\pi" } });
  }, sinh);
  await expect(page.locator('[data-key="u1"] .main')).toHaveText("sinh");
  await expect(page.locator('[data-key="u1"]')).toHaveAttribute("data-user", "set");
  await expect(page.locator('[data-key="u1"] .shiftlegend')).toHaveText("π");
  await tap(page, ["u1", "d2"]);
  expect(await entryValue(page)).toBe("\\sinh\\left(2\\right)");
  await page.evaluate(() => window.n62.entry.clear());
  await flick(page, "u1", "up");
  expect(await entryValue(page)).toBe("\\pi");
  // stored with the stamp: back after a relaunch
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForFunction(() => window.n62 !== undefined && customElements.get("math-field") !== undefined);
  await page.evaluate(() => window.n62.entry.ready);
  await expect(page.locator('[data-key="u1"] .main')).toHaveText("sinh");
  await tap(page, ["u1"]);
  expect(await entryValue(page)).toBe("\\sinh\\left(\\placeholder{}\\right)");
  // reset gives every slot its default back: empty
  await page.evaluate(() => window.n62.userKeys.reset());
  await expect(page.locator('[data-key="u1"]')).toHaveAttribute("data-user", "empty");
});

// R15c3: the third slot. No letter line in the cluster: the face shows the Alpha binding while Alpha is on, the bubble
// while a flick down is armed; an empty Alpha slot is the tap.
test("a free key's Alpha slot: a flick down and Alpha + tap fire it, the face and the bubble show it; it survives a reload", async ({ page }) => {
  const cosh = { label: "cosh", action: { insert: "\\cosh\\left(#0\\right)" } };
  const wanted = "\\cosh\\left(\\placeholder{}\\right)";
  await page.evaluate(([a, b]) => {
    window.n62.userKeys.set("u1", "primary", a!);
    window.n62.userKeys.set("u1", "alpha", b!);
    window.n62.userKeys.set("u2", "primary", a!); // no Alpha slot: its Alpha is the tap
  }, [sinh, cosh] as const);
  const main = page.locator('[data-key="u1"] .main');
  await expect(main).toHaveText("sinh");
  await expect(page.locator('[data-key="u1"] .alphalegend')).toHaveCount(0); // the cluster keeps no letter line
  // Alpha + the key; the face shows the binding while Alpha is on
  await tap(page, ["alpha"]);
  await expect(main).toHaveText("cosh");
  await expect(page.locator('[data-key="u2"] .main')).toHaveText("sinh");
  await tap(page, ["u1"]);
  expect(await entryValue(page)).toBe(wanted);
  await expect(main).toHaveText("sinh");
  await page.evaluate(() => window.n62.entry.clear());
  // a flick down: the bubble names the binding while armed, the lift fires it
  const f = await touch(page, "u1");
  await f.move(0, 35);
  await expect(page.getByTestId("flick-bubble")).toHaveText("cosh");
  await f.end();
  expect(await entryValue(page)).toBe(wanted);
  await page.evaluate(() => window.n62.entry.clear());
  // the empty slot falls back to the tap, by Alpha and by flick
  await tap(page, ["alpha", "u2"]);
  expect(await entryValue(page)).toBe("\\sinh\\left(\\placeholder{}\\right)");
  await page.evaluate(() => window.n62.entry.clear());
  await flick(page, "u2", "down");
  expect(await entryValue(page)).toBe("\\sinh\\left(\\placeholder{}\\right)");
  await page.evaluate(() => window.n62.entry.clear());
  // stored with the stamp: back after a relaunch
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForFunction(() => window.n62 !== undefined && customElements.get("math-field") !== undefined);
  await page.evaluate(() => window.n62.entry.ready);
  await flick(page, "u1", "down");
  expect(await entryValue(page)).toBe(wanted);
  await page.evaluate(() => window.n62.entry.clear());
  await tap(page, ["alpha", "u1"]);
  expect(await entryValue(page)).toBe(wanted);
});

test("an empty free key gives the dead-key haptic and types nothing", async ({ page }) => {
  await page.evaluate(() => window.n62.session.setHaptics({ on: true, ms: 10 }));
  for (const id of ["u1", "u6"]) {
    const before = (await vibrations(page)).length;
    await tap(page, [id]);
    await expect.poll(async () => (await vibrations(page)).length - before, id).toBe(3); // key down + the double
  }
  await flick(page, "u2", "up"); // U2's Shift slot ships empty
  expect(await entryValue(page)).toBe("");
  expect(await view(page)).toBe("home");
});

test("the place name's target is the line's full height and at least 96 px from the left edge; below the line the history keeps its taps", async ({ page }) => {
  const box = await place(page).boundingBox();
  expect(box?.x).toBe(0);
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(96);
  expect(box?.height).toBe(28);
  await page.touchscreen.tap(93, 14);
  await expect(appsSheet(page)).toBeVisible();
  await page.touchscreen.tap(93, 14);
  await expect(appsSheet(page)).toHaveCount(0);
  // a full history: the top row's formula lies right under the line, and a tap on it is the row's, not the switch's
  for (let i = 0; i < 12; i++) await tap(page, ["d1", "add", "d2", "enter"]);
  await page.waitForTimeout(300);
  // scrolled so that one row's formula starts right under the line (R148: the history's height moved with the keypad's gaps)
  await page.evaluate(() => {
    const h = document.querySelector(".history") as HTMLElement;
    const row = document.querySelectorAll("article.item")[4] as HTMLElement;
    h.scrollTop += row.getBoundingClientRect().top - 23;
  });
  const hit = await page.evaluate(() => (document.elementFromPoint(50, 38)?.closest("article") ? "row" : "other"));
  expect(hit).toBe("row");
  await page.touchscreen.tap(50, 38);
  expect(await view(page)).toBe("home");
  await expect(page.locator('article.item[data-selected="true"]')).toHaveCount(1); // the row's tap picked it (R147)
});

test("a status tap while an app's code loads runs at once (decisions.md R8)", async ({ page }) => {
  let release = (): void => {};
  const gate = new Promise<void>((r) => (release = r));
  await page.route(/\/src\/apps\/function\/index\.ts/, async (route) => {
    await gate;
    await route.continue();
  });
  await place(page).tap();
  await appsSheet(page).locator('[data-id="function"]').tap();
  expect(await page.evaluate(() => window.n62.shell.loading)).toBe("function");
  await place(page).tap(); // the Apps sheet opens at once, and Home is its first row
  await appsSheet(page).getByRole("menuitem").first().tap();
  expect(await app(page)).toBeNull();
  await expect(place(page)).toHaveAccessibleName(/^Place: Home\./);
  await page.getByTestId("chip-format").tap(); // a chip opens Mode at once too
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode");
  release();
  await page.waitForTimeout(500);
  expect(await app(page)).toBeNull(); // the late load does not take the place back
  await expect(place(page)).toHaveAccessibleName(/^Place: Home\./);
});

test("over an open sheet: the place name, and a free key that holds CAS or Home, close it and go there; a free key that holds no place does nothing", async ({ page }) => {
  await page.evaluate(() => {
    window.n62.userKeys.set("u3", "primary", { label: "CAS", action: { special: "cas" } });
    window.n62.userKeys.set("u2", "primary", { label: "Home", action: { special: "home" } });
  });
  await tap(page, ["tmpl"]);
  await expect(sheet(page)).toBeVisible();
  await place(page).tap();
  await expect(sheet(page)).toBeHidden();
  await expect(appsSheet(page)).toBeVisible();
  // (the key path: an on-screen free key closes the sheet and does nothing else, R144)
  await tap(page, ["esc", "tmpl"]);
  await sheetKey(page, ["u3"]);
  await tap(page, ["tmpl"]);
  await sheetKey(page, ["u2"]);
  await expect(sheet(page)).toBeHidden();
  expect(await view(page)).toBe("home");
  await page.evaluate((b) => window.n62.userKeys.set("u1", "primary", b), sinh);
  await tap(page, ["tmpl"]);
  await sheetKey(page, ["u1"]);
  await expect(sheet(page)).toBeVisible();
  await expect(page.locator('[data-key="u1"]')).toHaveAttribute("data-dead", "true");
  expect(await entryValue(page)).toBe("");
});

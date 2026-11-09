// SPDX-License-Identifier: GPL-3.0-or-later
// R173: Settings › Help and about › Report a problem copies the report (version, device, the session) and opens the issue
// form (clipboard/report.ts: issueUrl). `window.open` is a stand-in here: it records its calls and returns an object with an
// `opener` field, as a real window does; the real call must clear `opener` and must not pass `noopener` (with it the
// browser returns null even when the form opened, so the fallback would always show).
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { open, tap, useClipboardLock } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
test.describe.configure({ mode: "serial" });

useClipboardLock();

const version = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;

type Opened = { calls: { url: unknown; target: unknown; features: unknown }[]; win: { opener: unknown } | null };
declare global {
  interface Window {
    __open: Opened;
  }
}

/** Replace window.open before the page loads; `returns` is what it gives back (a window-like object, or null). */
async function stubOpen(page: Page, returns: "window" | "null"): Promise<void> {
  await page.addInitScript((r) => {
    const win = r === "window" ? { opener: window } : null;
    const o: Opened = { calls: [], win };
    window.__open = o;
    window.open = ((url?: string | URL, target?: string, features?: string) => {
      o.calls.push({ url, target, features });
      return win;
    }) as typeof window.open;
  }, returns);
}

async function reportRow(page: Page): Promise<void> {
  await tap(page, ["d2", "add", "d3", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await tap(page, ["@mode", "d6"]);
  const menu = page.getByTestId("menu");
  await menu.locator('[data-id="help"]').tap();
  await menu.locator('[data-id="report"]').tap();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
});

test("Report a problem copies version, device and the session, opens the form once and clears opener", async ({ page }) => {
  await stubOpen(page, "window");
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  await reportRow(page);
  const notice = page.getByTestId("notice");
  await expect(notice).toContainText("Copied");
  await expect(notice).not.toContainText("github.com");
  const text = await page.evaluate(() => navigator.clipboard.readText());
  const ua = await page.evaluate(() => navigator.userAgent);
  expect(text).toContain(`Version: ${version}`);
  expect(text).toContain(`Device: ${ua}`);
  expect(text).toContain("2+3");
  const o = await page.evaluate(() => window.__open);
  expect(o.calls).toHaveLength(1);
  const url = new URL(String(o.calls[0]?.url));
  expect(url.origin + url.pathname).toBe("https://github.com/n62-dev/n62/issues/new");
  expect(url.searchParams.get("template")).toBe("bug.yml");
  expect(url.searchParams.get("version")).toBe(version);
  expect(String(o.calls[0]?.features ?? "")).not.toContain("noopener");
  expect(await page.evaluate(() => window.__open.win?.opener)).toBeNull();
});

test("when the browser refuses the window, the message names the address to open by hand", async ({ page }) => {
  await stubOpen(page, "null");
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  await reportRow(page);
  await expect(page.getByTestId("notice")).toContainText("github.com/n62-dev/n62/issues/new");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("2+3");
  expect(await page.evaluate(() => window.__open.calls.length)).toBe(1);
});

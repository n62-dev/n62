// SPDX-License-Identifier: GPL-3.0-or-later
// R74f1: the clipboard lock excludes other workers. Headless Chromium may give each context its own clipboard, so the
// shared thing here is a file: every worker writes its own value, waits, and reads back its own; without the lock
// (useClipboardLock) a neighbour's write lands in between. The page clipboard is checked the same way.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { acquireClipboardLock, CLIPBOARD_TICKETS, clipboardBudget, open, useClipboardLock } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
test.describe.configure({ mode: "parallel" });

const SHARED = resolve("test-results", "clipboard-lock-shared.txt");

test("a second acquire stays pending while the first holds the lock, and succeeds after the release", async () => {
  test.setTimeout(clipboardBudget(test.info().project.timeout)); // the wait for the lock (held by the suite's clipboard tests) must not eat the test's own budget, as in useClipboardLock
  const release = await acquireClipboardLock();
  try {
    await expect(acquireClipboardLock(300)).rejects.toThrow("clipboard lock not free");
  } finally {
    release();
  }
  (await acquireClipboardLock())();
});

// F202: the waiters are served in the order they came (a numbered ticket), not by whose poll lands first.
test("six waiters that start in order acquire in that order", async () => {
  test.setTimeout(clipboardBudget(test.info().project.timeout));
  const release = await acquireClipboardLock();
  const order: number[] = [];
  const waiters: Promise<void>[] = [];
  for (let i = 0; i < 6; i++) {
    waiters.push(
      acquireClipboardLock().then((rel) => {
        order.push(i);
        rel();
      }),
    );
    await new Promise((r) => setTimeout(r, 120)); // each one has asked before the next starts
  }
  release();
  await Promise.all(waiters);
  expect(order).toEqual([0, 1, 2, 3, 4, 5]);
});

test("a waiter that gives up leaves no ticket behind and does not block the next one", async () => {
  test.setTimeout(clipboardBudget(test.info().project.timeout));
  const release = await acquireClipboardLock();
  await expect(acquireClipboardLock(300)).rejects.toThrow("clipboard lock not free");
  const mine = (): string[] => {
    try {
      return readdirSync(CLIPBOARD_TICKETS).filter((n) => /^\d+$/.test(n) && readFileSync(`${CLIPBOARD_TICKETS}/${n}`, "utf8").startsWith(`${process.pid} `));
    } catch {
      return [];
    }
  };
  expect(mine()).toEqual([]); // this process is the only one of mine in the queue, and it is not there
  const next = acquireClipboardLock();
  release();
  (await next)();
});

test("a ticket whose process is dead is skipped", async () => {
  test.setTimeout(clipboardBudget(test.info().project.timeout));
  const dead = spawnSync(process.execPath, ["-e", "0"]).pid; // a pid that has ended
  mkdirSync(CLIPBOARD_TICKETS, { recursive: true });
  const ticket = `${CLIPBOARD_TICKETS}/000000000`; // lower than any live ticket
  writeFileSync(ticket, `${dead} gone`);
  (await acquireClipboardLock())();
  expect(existsSync(ticket)).toBe(false);
});

test.describe("workers", () => {
  useClipboardLock();
for (const v of ["alpha-1", "beta-2", "gamma-3", "delta-4"]) {
  test(`the shared clipboard holds ${v} until this test reads it`, async ({ page }) => {
    await open(page);
    mkdirSync(resolve("test-results"), { recursive: true });
    writeFileSync(SHARED, v);
    await page.evaluate((s) => navigator.clipboard.writeText(s), v);
    await page.waitForTimeout(600); // long enough for any unlocked neighbour to write
    expect(readFileSync(SHARED, "utf8")).toBe(v);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(v);
  });
}
});

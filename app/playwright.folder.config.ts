// SPDX-License-Identifier: GPL-3.0-or-later
// A65: the sync folder's device check (test-device/folder.rec.ts) on the test build over adb. A config of its own, so
// tools/core-device.sh (playwright.device.config.ts) never runs it. Run by hand under the device lock (annabell).
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test-device",
  testMatch: "folder.rec.ts",
  timeout: 300_000,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
});

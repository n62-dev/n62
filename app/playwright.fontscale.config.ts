// SPDX-License-Identifier: GPL-3.0-or-later
// R703: the font-scale check on a WebView over adb (tools/fontscale-device.sh runs it). No web server: the test build is installed.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test-device",
  testMatch: "fontscale.device.ts",
  timeout: 180_000,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
});

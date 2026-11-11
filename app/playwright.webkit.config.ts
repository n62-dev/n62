// SPDX-License-Identifier: GPL-3.0-or-later
// A144: the same tests in WebKit, coverage only (Linux WebKit is not iOS Safari): the core list on the dev server,
// or with WEBKIT_SUITE=pwa the offline test (test-pwa/offline.spec.ts) on the production build.
//   GIAC_OUT=<abs dir> npx playwright test test/core.spec.ts -c playwright.webkit.config.ts
//   WEBKIT_SUITE=pwa GIAC_OUT=<abs dir> npx playwright test -c playwright.webkit.config.ts test-pwa/offline.spec.ts
import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config.ts";
import pwa from "./playwright.pwa.config.ts";

process.env["N62_BROWSER"] = "webkit"; // test/core.spec.ts: no clipboard permissions (the context rejects them)

export default defineConfig({
  ...(process.env["WEBKIT_SUITE"] === "pwa" ? pwa : base),
  projects: [{ name: "webkit-phone", use: { ...devices["iPhone 13"] } }],
});

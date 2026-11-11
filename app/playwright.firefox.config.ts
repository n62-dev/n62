// SPDX-License-Identifier: GPL-3.0-or-later
// A144: the same tests in Firefox, coverage only (nothing else runs it): `GIAC_OUT=<abs dir> npm run test:core:firefox`.
// Firefox takes no `isMobile`, so the Pixel 7 preset is not spread whole: its viewport and touch, Firefox's own browser.
import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config.ts";

process.env["N62_BROWSER"] = "firefox"; // test/core.spec.ts: no clipboard permissions (Firefox's newContext rejects them)

const { viewport, deviceScaleFactor, hasTouch } = devices["Pixel 7"];

export default defineConfig({
  ...base,
  projects: [{ name: "firefox-phone", use: { browserName: "firefox", viewport, deviceScaleFactor, hasTouch } }],
});

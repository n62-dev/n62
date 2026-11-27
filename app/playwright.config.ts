// SPDX-License-Identifier: GPL-3.0-or-later
import { defineConfig, devices } from "@playwright/test";
import { E2E_TIMING_GREP } from "./scripts/pipeline-logs.ts";

// PW_PORT: use a different port per checkout, so parallel runs never reuse each other's dev server.
const port = Number(process.env["PW_PORT"] ?? 5181);

// PW_WORKERS (A126): the worker count when set (a measurement: 16 against 8); otherwise Playwright's default, half the logical CPUs.
const workers = process.env["PW_WORKERS"] ? Number(process.env["PW_WORKERS"]) : undefined;

export default defineConfig({
  testDir: "test",
  timeout: 30_000,
  ...(workers !== undefined && Number.isInteger(workers) && workers > 0 ? { workers } : {}),
  webServer: {
    // GIAC_OUT=<dir with giac.mjs/giac.wasm> when the engine is not built in this checkout
    command: `npm run engine:copy && npx vite --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false, // a server on this port is another checkout's code: fail at once ("port in use")
    timeout: 120_000,
  },
  reporter: [["list"], ["./test/core-reporter.ts"]],
  use: { baseURL: `http://localhost:${port}` },
  // A281f1: the wall-clock tests (pipeline-logs.ts E2E_TIMING, the list isTiming reads) run in a project of their own, alone
  // (one worker) once the main one is done, so the parallel files never load the host under them. It is the main project's
  // `teardown`, not a dependant: it runs when the main project failed too, and a run of some files (the pipeline's rerun)
  // does not run the whole main project. A file run (`playwright test x.spec.ts`) runs every quiet test; `--no-deps` does not.
  projects: [
    { name: "chromium-phone", use: { ...devices["Pixel 7"] }, grepInvert: E2E_TIMING_GREP, teardown: "chromium-phone-quiet" },
    { name: "chromium-phone-quiet", use: { ...devices["Pixel 7"] }, grep: E2E_TIMING_GREP, workers: 1 },
  ],
});

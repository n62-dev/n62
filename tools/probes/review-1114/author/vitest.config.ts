// SPDX-License-Identifier: GPL-3.0-or-later
// author probes (night review 2026-11-14): run a probe test that lives outside app/src against the checkout's app,
// with the app's own plugins. Run: env -C <checkout>/app npx vitest run -c <this file>
import base from "../../../../app/vite.config.ts";
export default (env: { command: "build" | "serve"; mode: string }) => {
  const c = (base as unknown as (e: typeof env) => Record<string, unknown>)(env);
  return { ...c, server: { fs: { strict: false } }, test: { globals: true, environment: "node", include: ["../tools/probes/review-1114/author/*.probe.test.ts"], maxWorkers: 1, minWorkers: 1 } };
};

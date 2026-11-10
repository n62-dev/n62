// SPDX-License-Identifier: GPL-3.0-or-later
// bu probes: run a probe test that lives outside app/src against the review worktree's app, with the app's own plugins.
import base from "../../../../app/vite.config.ts";
export default (env: { command: "build" | "serve"; mode: string }) => {
  const c = (base as unknown as (e: typeof env) => Record<string, unknown>)(env);
  return { ...c, server: { fs: { strict: false } }, test: { globals: true, environment: "node", include: ["../tools/probes/review-1109/bu/*.probe.test.ts"], maxWorkers: 1, minWorkers: 1 } };
};

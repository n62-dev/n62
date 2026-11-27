// SPDX-License-Identifier: GPL-3.0-or-later
// G640: the app's Vite config for ans-frozen.engine.test.ts, which lives outside app/src (as review-1116/bu/vitest.config.mts).
// Run from the checkout: env -C app npx vitest run -c ../tools/probes/ans-frozen.vitest.config.mts
import base from "../../app/vite.config.ts";
export default (env: { command: "build" | "serve"; mode: string }) => {
  const c = (base as unknown as (e: typeof env) => Record<string, unknown>)(env);
  return { ...c, server: { fs: { strict: false } }, test: { environment: "node", include: ["../tools/probes/ans-frozen.engine.test.ts"] } };
};

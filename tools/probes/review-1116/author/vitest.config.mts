// SPDX-License-Identifier: GPL-3.0-or-later
// author, for rerun.sh nr1116-bu-1 (night review 2026-11-16): the app's Vite config (its YAML and Svelte plugins) for the review's probe tests,
// which live outside app/src. Run from the checkout: env -C app npx vitest run -c ../tools/probes/review-1116/author/vitest.config.mts --silent=false [name]
import base from "../../../../app/vite.config.ts";
export default (env: { command: "build" | "serve"; mode: string }) => {
  const c = (base as unknown as (e: typeof env) => Record<string, unknown>)(env);
  return { ...c, server: { fs: { strict: false } }, test: { globals: true, environment: "node", include: ["../tools/probes/review-1116/bu/*.probe.ts"] } };
};

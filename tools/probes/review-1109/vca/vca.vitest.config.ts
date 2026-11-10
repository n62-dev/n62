// SPDX-License-Identifier: GPL-3.0-or-later
// vca: run one probe test from the probes folder with the app's plugins, without writing into the review worktree.
import base from "../../../../app/vite.config.ts";
export default (env: { command: "build" | "serve"; mode: string }) => {
  const c = (base as unknown as (e: typeof env) => Record<string, unknown>)(env);
  return { ...c, test: { dir: new URL(".", import.meta.url).pathname, include: ["*.test.ts"], environment: "node", globals: true } };
};

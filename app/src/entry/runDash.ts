// SPDX-License-Identifier: GPL-3.0-or-later
// R155: when the running dash round the entry outline shows. A job that ends sooner never shows it (the same 150 ms as
// "Working…", style.css `.late`); it goes at once when the job ends. The dash itself is drawn by App.svelte.

/** How long a job (or the engine's start) must have lasted before the dash shows. */
export const RUN_DASH_AFTER_MS = 150;

/** Call `show(true)` once `working` has held for the delay and `show(false)` as soon as it ends; returns the stop. */
export function runDash(working: boolean, show: (on: boolean) => void, after = RUN_DASH_AFTER_MS): () => void {
  if (!working) {
    show(false);
    return () => {};
  }
  const id = setTimeout(() => show(true), after);
  return () => clearTimeout(id);
}

// SPDX-License-Identifier: GPL-3.0-or-later
// Run `f` when the browser is idle (at the latest after `timeout` ms, if given), or after `fallback` ms where there is no
// requestIdleCallback. One place for the start chunk's idle loads (size-check.ts START_PIN_GZIP).
export const idle = (f: () => void, timeout?: number, fallback = 200): void => {
  if (typeof requestIdleCallback === "function") requestIdleCallback(f, { timeout });
  else setTimeout(f, fallback);
};

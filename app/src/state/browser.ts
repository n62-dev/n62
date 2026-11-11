// SPDX-License-Identifier: GPL-3.0-or-later
// R285 (arch review 2026-11-10, M2): which browser engine runs the app, and whether N62 was tested on it. The site is
// announced for every browser; only Chromium's core list runs in CI. A browser that has not passed says so once at the
// start (views/browserNote.ts) and in Settings › Help and about › About. No words here: the i18n tables have them.

export type Engine = "blink" | "gecko" | "webkit" | "other";

/** The engines whose core list passed: Chromium (every night, on a Pixel viewport and on the Tab One) and, from A144,
 *  nothing else: A144 (commit fa06b2d1, Playwright 1.64.0) FIREFOX failed (65 of 72, helper failures and one layout
 *  defect), WEBKIT failed (41 of 72; Linux WebKit, not iOS Safari). WebKit joins only after the owner's iPhone check
 *  (R225). Add an engine only with the A144 line `passed` (or R225's result) and its commit. */
export const TESTED: readonly Engine[] = ["blink"];

/** What the part of navigator.userAgentData this reads looks like (Chromium only; Firefox and Safari have none). */
export interface UaData {
  brands?: readonly { brand: string }[];
}

/** The engine from the Client Hints brands (a Chromium brand is Blink) and the user agent string: every browser on iOS
 *  is WebKit whatever it calls itself (CriOS, FxiOS, EdgiOS), Firefox elsewhere is Gecko, Chrome, Edge, Opera and
 *  Samsung Internet are Blink, the rest of AppleWebKit is Safari's. */
export function engineOf(ua: string, data?: UaData): Engine {
  if (data?.brands?.some((b) => b.brand === "Chromium")) return "blink";
  if (/\b(CriOS|FxiOS|EdgiOS|OPiOS)\//.test(ua)) return "webkit";
  if (/\bFirefox\//.test(ua)) return "gecko";
  if (/\b(Chrome|Chromium|Edg|OPR|SamsungBrowser)\//.test(ua)) return "blink";
  if (/\bAppleWebKit\//.test(ua)) return "webkit";
  return "other";
}

/** The engine of the browser running now. */
export function currentEngine(): Engine {
  return engineOf(navigator.userAgent, (navigator as Navigator & { userAgentData?: UaData }).userAgentData);
}

export const isTested = (engine: Engine): boolean => TESTED.includes(engine);

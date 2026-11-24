// SPDX-License-Identifier: GPL-3.0-or-later
// R930 (a start-chunk cut): what the Calc port (calc/engine.ts) passes of an engine result. EngineCalc.home and cas read it only
// once a result is in, and they wait for the word store's chunk (state/cycleForms.ts, which re-exports this) before the engine
// is sent anything, so it rides there and nothing waits longer than before.
import type { CasResult, HomeResult } from "../engine/types.ts";
import type { CasOutcome, HomeOutcome } from "./port.ts";

/**
 * What the port does with each key of an engine result (G76): "pass" gives it to the view as it is (`facts` whole, so
 * every fact the engine adds reaches the views); "held" keeps it back, the reason in a comment beside it (R255: the
 * reasons were texts in the start chunk). A key added to HomeResult or CasResult fails to compile here until it is listed.
 */
export type PortKeys<T> = { readonly [K in keyof Required<T>]: "pass" | "held" };

export const HOME_KEYS = {
  ok: "pass",
  display: "pass",
  value: "pass",
  facts: "pass",
  approximate: "pass",
  error: "pass",
  full: "pass",
  defined: "pass",
  items: "pass",
  shape: "pass",
  braces: "pass",
  digits: "pass",
  latex: "pass",
  settingReset: "pass",
  reads: "pass",
  uses: "pass",
  unitNames: "pass",
  uncTerms: "pass",
  exact: "held", // given only when `rational` says it is a plain integer or p/q: the Format key's fraction modes read it
  rational: "held", // read for `exact`
  path: "held", // the engine's route, for its tests and probes; no view reads it
  exactMs: "held", // a timing (measurement builds read the engine's own)
  totalMs: "held", // a timing (measurement builds read the engine's own)
} as const satisfies PortKeys<HomeResult>;

export const CAS_KEYS = {
  ok: "pass",
  text: "pass",
  full: "pass",
  latex: "pass",
  error: "pass",
  uses: "pass",
  reads: "pass",
  numeric: "pass",
  approximate: "pass",
  facts: "pass",
  settingReset: "pass",
  timedOut: "held", // `error` is "timeout" then
  engineMs: "held", // a timing (measurement builds read the engine's own)
} as const satisfies PortKeys<CasResult>;

/** The keys of T that `M` passes. */
export type Passed<T, M extends PortKeys<T>> = { [K in keyof M]: M[K] extends "pass" ? K : never }[keyof M] & keyof T;

/** The keys of `r` that `keys` passes, each as it is (absent ones stay absent). */
function passed<T extends object, M extends PortKeys<T>>(r: T, keys: M): Pick<T, Passed<T, M>> {
  const out: Partial<T> = {};
  for (const k of Object.keys(keys) as (keyof T & keyof M)[]) if (keys[k] === "pass" && r[k] !== undefined) out[k] = r[k];
  return out as Pick<T, Passed<T, M>>;
}

/** True when A and B are the same set of keys (both ways, so neither a passed key nor an outcome key goes unmapped). */
export type SameKeys<A extends PropertyKey, B extends PropertyKey> = [Exclude<A, B>, Exclude<B, A>] extends [never, never] ? true : false;
type Check<T extends true> = T;
/** Every passed key is an outcome key and every outcome key is passed (or, for `exact`, given by the port itself). */
export type PortChecks = [
  Check<SameKeys<Passed<HomeResult, typeof HOME_KEYS> | "exact" | "word", keyof HomeOutcome>>,
  Check<SameKeys<Passed<CasResult, typeof CAS_KEYS> | "word", keyof CasOutcome>>,
];

/** Home's result as the port gives it: the passed keys, and `exact` when `rational` says it is a plain integer or p/q. */
export const passHome = (r: HomeResult): Omit<HomeOutcome, "word"> => ({ ...passed(r, HOME_KEYS), ...(r.rational && r.exact !== undefined ? { exact: r.exact } : {}) });
/** CAS's result as the port gives it. */
export const passCas = (r: CasResult): Omit<CasOutcome, "word"> => passed(r, CAS_KEYS);

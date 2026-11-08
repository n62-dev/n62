// SPDX-License-Identifier: GPL-3.0-or-later
// The item chunk's load for the session (R155f2): state/resultItem.ts builds what a history item keeps of a result, so it
// is needed only once a result is in. Loaded beside the first job, as the tidy chunk is (state/tidyLoad.ts).
type Items = typeof import("./resultItem.ts");
let chunk: Promise<Items> | undefined;
const load = (): Promise<Items> =>
  (chunk ??= import("./resultItem.ts").then(
    (m) => m,
    (e: unknown) => {
      chunk = undefined;
      throw e;
    },
  ));
/** Start the load beside a job; a failure here is dealt with where the result is read (itemsOr). */
export const prefetchItems = (): Promise<Items> => {
  const p = load();
  p.catch(() => {});
  return p;
};
/** The chunk, with one more try if the first load failed (a tab open across a redeploy: the old hashed file is gone). */
export const itemsOr = (p: Promise<Items>): Promise<Items> => p.catch(load);

// SPDX-License-Identifier: GPL-3.0-or-later
// The item chunk's load for the session (R155f2): state/resultItem.ts builds what a history item keeps of a result, and (R930)
// state/jobRun.ts sends the job and writes its answer on the row, so both are needed only once a job runs. Loaded beside the
// first job, as the tidy chunk is (state/tidyLoad.ts).
import { lazyOnce } from "../lazyOnce.ts";

type Items = typeof import("./jobRun.ts");
const load = lazyOnce((): Promise<Items> => import("./jobRun.ts"));
/** Start the load beside a job; a failure here is dealt with where the result is read (itemsOr). */
export const prefetchItems = (): Promise<Items> => {
  const p = load();
  p.catch(() => {});
  return p;
};
/** The chunk, with one more try if the first load failed (a tab open across a redeploy: the old hashed file is gone). */
export const itemsOr = (p: Promise<Items>): Promise<Items> => p.catch(load);

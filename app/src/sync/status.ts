// SPDX-License-Identifier: GPL-3.0-or-later
// R183: the sync queue's last answer (sync/queue.ts onStatus), kept for Settings › Data › Sync folder's Status row.
// The feed reports each change; the page reads the last one when its level opens and is told of the next. Status shows
// only there: no nag (R128). Tiny and lazy, on no start path.
import type { SyncStatus } from "./queue.ts";

let last: SyncStatus | undefined;
let listener: ((s: SyncStatus) => void) | undefined;

/** The queue's answer, as it happened. */
export function reportStatus(s: SyncStatus): void {
  last = s;
  listener?.(s);
}

/** The last answer, or undefined while the queue has said nothing (no row has finished with a folder chosen). */
export const lastStatus = (): SyncStatus | undefined => last;

/** The one listener of the open level (a later one replaces it: a level opened again). */
export function watchStatus(l: (s: SyncStatus) => void): void {
  listener = l;
}

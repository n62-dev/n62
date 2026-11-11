// SPDX-License-Identifier: GPL-3.0-or-later
// R285: the `tipsSeen` record says what the first start has already told this install: `true` (the tips; as R15c4 wrote
// it) or `{ tips?: true, browser?: true }` once the browser note (views/browserNote.ts) was shown too. Both writers are
// lazy chunks and share this one queue, so one never overwrites the other's flag. Like the flag it extends, it stays
// out of the backup (state/backup.ts LEFT_OUT). A record that cannot be read is not written (it may hold the flags).
import { kvGet, kvSet } from "./storage.ts";
import { says, TIPS_SEEN, type Said } from "./tips.ts";

let queue: Promise<void> = Promise.resolve();

/** Record that the tips (`tips`) or the browser note (`browser`) were shown; every flag already there stays. */
export function markSeen(what: Said): Promise<void> {
  queue = queue.then(async () => {
    const r = await kvGet<unknown>(TIPS_SEEN);
    if (r.kind === "failed") return;
    const had = r.kind === "value";
    const tips = what === "tips" || (had && says(r.value, "tips"));
    const browser = what === "browser" || (had && says(r.value, "browser"));
    await kvSet(TIPS_SEEN, browser ? { ...(tips && { tips: true }), browser: true } : true);
  });
  return queue;
}

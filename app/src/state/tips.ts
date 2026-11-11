// SPDX-License-Identifier: GPL-3.0-or-later
// R15c4: the first-start tips are shown once. The flag is in the kv store; the overlay itself (views/tipsHost.ts) is a
// lazy chunk that only this decision loads. A store that cannot be read shows nothing (it may hold the flag).
// R285: the same record holds the browser note's flag (state/seenWrite.ts writes both).
import { kvGet, type KvRead } from "./storage.ts";

export const TIPS_SEEN = "tipsSeen";

export type Said = "tips" | "browser";

/** Whether a stored `tipsSeen` value says that `what` was shown (`true` is the tips, as R15c4 wrote it). */
export const says = (value: unknown, what: Said): boolean =>
  value === true ? what === "tips" : typeof value === "object" && value !== null && (value as Partial<Record<Said, unknown>>)[what] === true;

/** True on a profile that has never shown the tips and was not asked to hide them (`?tips=off`: the e2e tests, a deep link). */
export async function tipsDue(search: string, read: (key: string) => Promise<KvRead<unknown>> = kvGet): Promise<boolean> {
  if (/[?&]tips=off(&|$)/.test(search)) return false;
  const r = await read(TIPS_SEEN);
  return r.kind === "none" || (r.kind === "value" && !says(r.value, "tips"));
}

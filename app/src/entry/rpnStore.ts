// SPDX-License-Identifier: GPL-3.0-or-later
// R252 (mh-D1): the RPN stack survives a relaunch and goes in the backup. The levels are chips (docs/04 2.8), so each
// one comes back through validChips, which drops a malformed chip and keeps a result chip's unc, uncFacts and unit (mh-D3);
// a σ level comes back only with the `inputs` that keep its σ honest (R250). Undo stays in the session. A lazy part,
// never in the start chunk; R254 wires it to the keys.
import { validChips } from "../input/chips.ts";
import type { Kv } from "../state/storage.ts";
import { RPN_DEPTH, type RpnLevel } from "./rpn.ts";

/** The store key (stamped like every other key, state/storage.ts; a part of the backup, state/backup.ts). */
export const RPN_KEY = "rpn";

/** A σ input, as inputsOf names it: `row:<uid>`, `const:<ID>` or `pasl_<leaf>`. */
const INPUT = /^(row:.+|const:[A-Za-z0-9_]+|pasl_[A-Za-z0-9_]+)$/;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** One stored level, or null when it is not ours: a non-empty string uid, a string `shown`, a chip validChips keeps (read
 *  as a result chip: the level's identity is its uid), and `inputs` an array of input keys, which a level with a σ must
 *  have (without it the σ would not be honest); a level with no σ may leave it out. */
function level(x: unknown): RpnLevel | null {
  if (!isObject(x) || typeof x["uid"] !== "string" || x["uid"] === "" || typeof x["shown"] !== "string") return null;
  const chip = validChips({ "res:1": x["chip"] })?.["res:1"];
  if (chip === undefined) return null;
  const inputs = x["inputs"];
  if (inputs === undefined && chip.unc === undefined) return { uid: x["uid"], chip, shown: x["shown"], inputs: [] };
  if (!Array.isArray(inputs) || !inputs.every((i) => typeof i === "string" && INPUT.test(i))) return null;
  return { uid: x["uid"], chip, shown: x["shown"], inputs: [...(inputs as string[])] };
}

/** The stored stack, level 1 first: the levels that are well formed, at most RPN_DEPTH; an empty stack when nothing is
 *  stored, the value is not ours, or the read failed (idbKv then writes nothing under the key this session, R93). */
export async function readStack(kv: Kv): Promise<RpnLevel[]> {
  const stored = await kv.get<unknown>(RPN_KEY);
  if (!isObject(stored) || !Array.isArray(stored["levels"])) return [];
  const out: RpnLevel[] = [];
  for (const x of stored["levels"] as unknown[]) {
    const l = level(x);
    if (l !== null) out.push(l);
  }
  return out.slice(0, RPN_DEPTH);
}

/** Store the stack (level 1 first); the stack is empty: `{ levels: [] }`, so a cleared stack stays cleared. */
export function saveStack(kv: Kv, levels: readonly RpnLevel[]): Promise<void> {
  return kv.set(RPN_KEY, { levels: levels.map(({ uid, chip, shown, inputs }) => ({ uid, chip, shown, inputs })) });
}

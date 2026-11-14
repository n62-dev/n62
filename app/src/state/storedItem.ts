// SPDX-License-Identifier: GPL-3.0-or-later
// A history row read back from IndexedDB (split out of session.svelte.ts by R98): its fields are kept when they have
// their shape, else dropped. The history's start read and the stored Undo copy of Clear and Delete (removedRows.ts) use it.
import { readValueFacts } from "../engine/types.ts";
import type { ComplexValue, PrecisionFacts } from "../engine/format.ts";
import { validChips } from "../input/chips.ts";
import { isFormStep, type ResultFacts } from "./displayMode.ts";
import { FULL_LIMIT, HISTORY_LIMIT, ITEMS_LIMIT, rowUid } from "./results.ts";
import type { HistoryItem, UsedValue } from "./session.svelte.ts";

/** A stored `word` (G211) when whole: the rule of wordSetting.ts validWord, repeated so this chunk does not import that
 *  module (the shared import hoisted it into the start chunk, +40 B gzip); word.test.ts runs both on one table. */
function storedWord(x: unknown): HistoryItem["word"] {
  const w = x as { bits?: unknown; signed?: unknown } | null;
  const ok = typeof w === "object" && w !== null && !Array.isArray(w) && Object.keys(w).length === 2;
  return ok && typeof w.signed === "boolean" && [8, 16, 32, 64].includes(w.bits as number) ? { bits: w.bits as 8, signed: w.signed } : undefined;
}

/** A stored `uses` read back from IndexedDB: the well-formed entries only. */
function validUses(x: unknown): UsedValue[] | undefined {
  const ok = (Array.isArray(x) ? (x as Partial<UsedValue>[]) : []).filter(
    (u): u is UsedValue => typeof u?.name === "string" && typeof u.preview === "string" && (u.view === "home" || u.view === "cas"),
  );
  return ok.length ? ok : undefined;
}

/** Stored facts read back from IndexedDB, through the one mapping for stored facts (readValueFacts: an item stored
 *  before G76 says `exactRational`): kept when they have the shape, else dropped (the item then shows no mark). */
function validFacts(x: unknown): ResultFacts | undefined {
  if (!x || typeof x !== "object") return undefined;
  const f = x as Record<string, unknown>;
  const exactKey = (o: Record<string, unknown>): boolean => typeof (o["exact"] ?? o["exactRational"]) === "boolean";
  const facts = readValueFacts(f);
  if (!facts || !exactKey(f) || f["reliableDigits"] === undefined) return undefined;
  const d = f["digits"];
  if (d !== undefined && !(typeof d === "number" && Number.isInteger(d) && d >= 1 && d <= 1000)) return undefined;
  const items = f["items"];
  if (items !== undefined && (!Array.isArray(items) || items.length > ITEMS_LIMIT)) return undefined;
  const els: PrecisionFacts[] = [];
  for (const it of Array.isArray(items) ? (items as unknown[]) : []) {
    const e = it && typeof it === "object" ? (it as Record<string, unknown>) : null;
    const ef = e && exactKey(e) ? readValueFacts(e) : null;
    if (!e || !ef) return undefined;
    els.push({ ...ef, ...(e["value"] ? { value: e["value"] as ComplexValue } : {}) });
  }
  return {
    ...facts,
    ...(d !== undefined ? { digits: d } : {}),
    ...(Array.isArray(items) ? { items: els } : {}),
    ...(f["shape"] !== undefined ? { shape: f["shape"] as [number, number] } : {}),
  };
}

/** A stored history item with a fresh id; chip fields that do not have their shape are dropped. G211: so are the job's
 *  (`giac` as `full`, `angle`, `digits` as the setting allows, `word` as R194's record, `at`); the uid is kept, and a row
 *  stored without one (before G211) is given one here (the session writes it back). */
export function restoredItem(i: HistoryItem, id: number): HistoryItem {
  const { chips, full, fullExact, drawn, facts, uses, settingReset, uid, giac, angle, digits, word, at, ...rest } = i as HistoryItem & { form?: unknown };
  const { form, ...base } = rest;
  const out: HistoryItem = { ...base, id, uid: typeof uid === "string" && uid !== "" ? uid : rowUid(id) };
  if (typeof giac === "string" && giac.length <= FULL_LIMIT) out.giac = giac;
  if (angle === "rad" || angle === "deg") out.angle = angle;
  if (typeof digits === "number" && Number.isInteger(digits) && digits >= 1 && digits <= 30) out.digits = digits; // (MAX_DIGITS)
  const w = storedWord(word);
  if (w) out.word = w;
  if (typeof at === "number" && Number.isFinite(at)) out.at = at;
  if (isFormStep(form)) out.form = form;
  const f = validFacts(facts);
  if (f) out.facts = f;
  const c = validChips(chips);
  if (c) out.chips = c;
  const u = validUses(uses);
  if (u) out.uses = u;
  if (settingReset === true) out.settingReset = true;
  if (typeof full === "string" && full.length <= FULL_LIMIT) {
    out.full = full;
    out.fullExact = fullExact === true;
  }
  if (typeof drawn === "string" && drawn.length <= FULL_LIMIT) out.drawn = drawn;
  return out;
}

/** The stored history's rows read back (Session.restoreHistory): per view the finished ones with their entry, the last
 *  HISTORY_LIMIT, each by restoredItem with the next id (`id`; Home's first). `gained`: a row had no uid and got one
 *  here (G211), so the session writes the history back and the row keeps it. Here, not in the session: the start chunk. */
export function restoredLists(hist: { home?: HistoryItem[]; cas?: HistoryItem[] }, id: () => number): { home: HistoryItem[]; cas: HistoryItem[]; gained: boolean } {
  let gained = false;
  const keep = (xs: HistoryItem[] | undefined): HistoryItem[] =>
    (xs ?? [])
      .filter((i) => (i.status === "done" || i.status === "error") && typeof i.latex === "string")
      .slice(-HISTORY_LIMIT)
      .map((i) => {
        const out = restoredItem(i, id());
        gained ||= out.uid !== i.uid;
        return out;
      });
  const home = keep(hist.home);
  return { home, cas: keep(hist.cas), gained };
}

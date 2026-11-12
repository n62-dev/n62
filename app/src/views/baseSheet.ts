// SPDX-License-Identifier: GPL-3.0-or-later
// R193 (docs/04 5.4): Shift + − opens the Base menu for the last result: HEX, BIN, OCT, DEC. Part of the sheet's
// code (tmplSheet.ts re-exports showBase), so the start chunk carries only the key's routing. The menu shows the result in a base and never acts on what is being typed, so the key
// is dead while the line holds text. A pick sets the result's display form (R192: `fmt`), that result only.
import type { MenuItem } from "../apps/types.ts";
import { dataText } from "../i18n/enData.ts";
import type { RouteCtx } from "../keyboard/route.ts";
import { baseDrawn, isApplicable } from "../state/cycleForms.ts";
import { factsOf } from "../state/displayMode.ts";
import type { HistoryItem, Session } from "../state/session.svelte.ts";

const BASES = ["hex", "bin", "oct"] as const;
/** The rows, in the order of docs/04 5.4. */
const ROWS: readonly { id: (typeof BASES)[number] | "dec"; label: string }[] = [
  { id: "hex", label: "HEX" },
  { id: "bin", label: "BIN" },
  { id: "oct", label: "OCT" },
  { id: "dec", label: "DEC" },
];

/** The four rows for `item`. Dimmed, with the reason, when the result is no integer (or, for a base, outside the word). */
export function baseItems(s: Session, item: HistoryItem): MenuItem[] {
  const integer = isApplicable("hex", factsOf(item));
  const base = BASES.find((b) => b === item.fmt && item.form === undefined);
  return ROWS.map(({ id, label }) => {
    const fits = id === "dec" || baseDrawn(item, id) !== undefined;
    return {
      id,
      label,
      selected: id === "dec" ? integer && base === undefined : base === id,
      ...(integer && fits ? {} : { disabled: true, reason: dataText(integer ? "base.noFit" : "base.notInteger") }),
      run: () => {
        if (id === "dec") delete item.fmt; // back to the global notation (Home) or the exact form (CAS)
        else item.fmt = id;
        delete item.form; // a form chosen with a b/c would be drawn instead
        s.saveHistory();
      },
    };
  });
}

/** Shift + −: the Base menu on the open view's last finished result; a dead key (the double haptic) with text on the
 *  line, in an app, with no result or on an error. Called with the sheet's code in (keyboard/route.ts). */
export function showBase(c: RouteCtx): void {
  const item = c.session.items.at(-1);
  if (!c.entry.empty || c.shell.app !== null || !item || item.status !== "done") return c.dead();
  c.picked = null;
  c.shell.showMenu(dataText("base.title"), baseItems(c.session, item), { remember: false });
}

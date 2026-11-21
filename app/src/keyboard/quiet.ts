// SPDX-License-Identifier: GPL-3.0-or-later
// R777 (docs/05 3.7): a tap that the route will turn into nothing gets no press look, no pop and no click at finger-down, only the
// dead key's double pulse. Keypad.svelte draws a key dead from its layer alone (`dead()`); these are the presses that depend on
// the state where they land: the same conditions route.ts checks, asked without acting. It says true only when the route is sure
// to call c.dead() for a tap now (nothing waits for a load, no grid or free key takes it); false leaves the key its feedback.
import { ANS_CHIP } from "../entry/macros.ts";
import { canPick, targetRow } from "../state/pickRows.ts";
import { sheetChunk } from "../views/sheetView.svelte.ts";
import { actionFor, type Key } from "./keyboard.ts";
import type { RouteCtx } from "./route.ts";

const STORE_ARROW = "\\blacktriangleright";
/** The find and store sheets' ids (route.ts; those modules are lazy chunks). */
const FIND = "find";
const STORE = "store";

/** Does the open sheet take a tap on `key` for a job of its own, before its usual key reading (route.ts sheetPress)? Without
 *  acting: a free key whose slot the level lists (R4b), a key at a grid cell's place (R18: pickKey), the matrix grid's cells. */
function takes(c: RouteCtx, key: Key): boolean {
  const level = c.shell.sheet?.level;
  if (!level) return false;
  if (level.grid) return true;
  const layer = c.session.alpha ? "alpha" : c.session.shift ? "shift" : "primary";
  if (key.user && level.items.some((x) => x.slot?.key === key.id && x.slot.layer === layer)) return true;
  return level.columns !== undefined && !level.digits && level.items.some((x) => x.pick?.key === key.id);
}

/** Would a tap on `key` now be a dead press (route.ts calls c.dead())? `drawnDead`: Keypad draws the key dead (its layer, or the
 *  sheet's reading), which the route still acts on when the sheet takes the key. */
export function quiet(c: RouteCtx, key: Key, drawnDead: boolean): boolean {
  const { session, shell, entry } = c;
  if (drawnDead) return !(shell.sheet && takes(c, key));
  if (c.sheetLoad !== null || shell.loading !== null || entry.fieldPending || c.waiting.length > 0) return false;
  const p = key.actions.primary;
  if (p?.kind === "special" && (p.name === "shift" || p.name === "alpha")) return false;
  const sheet = shell.sheet;
  if (sheet) {
    // ⌫ with nothing typed into the filter of a list that is not Find's (sheetPress: Find goes back a level, the store sheet
    // hands the key to the line); a free key, a grid and a key that picks a cell have their own jobs
    const keys = sheetChunk.keys;
    const level = sheet.level;
    if (!keys || level.loading() || sheet.id === FIND || sheet.id === STORE || takes(c, key)) return false;
    return level.filter === "" && keys.sheetKey(key, level.filterable).kind === "backspace";
  }
  const action = actionFor(key, session.shift, session.alpha, session.settings.entry === "line", c.casKeys);
  if (!action) return false;
  const app = shell.app !== null;
  const noLine = app && !shell.showsEntry; // Plot: no entry line
  if (action.kind === "special") {
    switch (action.name) {
      case "fmt": // the last result in the next mode: no row to take (Session.formKey), and no result at all in an app
        return app || !targetRow(session.items, session.items[c.picked ?? -1]);
      case "selectGrow":
      case "selectShrink":
      case "paste":
      case "find": // (a tap: no free-key slot) these open a sheet that inserts into the line, and Plot has none (App.svelte)
      case "help":
      case "matrix":
      case "vars":
      case "tmpl":
      case "relations":
      case "symbols":
      case "chars":
        return noLine;
      default:
        return false;
    }
  }
  if (noLine) return action.kind === "insert" || action.kind === "type";
  if (app) return action.kind === "insert" && action.latex === ANS_CHIP; // Ans belongs to Home and CAS
  // Home and CAS: ◀ on a running row picked with an empty line has nothing to give back (historyKey); Store ▶ with no value on the
  // line and no result to store (R702)
  const items = session.items;
  const at = c.picked;
  if (at !== null) return at < items.length && canPick(items, at) && items[at]?.status === "pending" && entry.empty && action.kind === "cmd" && action.name === "moveToPreviousChar";
  return action.kind === "insert" && action.latex === STORE_ARROW && entry.empty && !session.hasResult();
}

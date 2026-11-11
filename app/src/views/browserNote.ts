// SPDX-License-Identifier: GPL-3.0-or-later
// R285: a browser whose engine has not passed (state/browser.ts TESTED) says so once, in one line under the status
// line, with OK. This module and its css are one lazy chunk; the start chunk only asks for it when the browser is idle.
// The flag is in localStorage (the look's mirror is there too: read at once, no store), set when the line is shown, as
// the tips' is, so a reload does not show it again whether OK was pressed or not. It is no kv record, so no backup
// holds it: a restore on a new install says it once more. Plain DOM, as the tips: no Svelte runtime.
import "./browserNote.css";
import { browserText as tr } from "../i18n/enBrowser.ts";
import { currentEngine, isTested } from "../state/browser.ts";

export const BROWSER_NOTED = "n62.browserNoted";

/** Show the line if this browser has not passed and the note was never shown on this install. A storage that cannot be
 *  read or written shows it once per page load. */
export function browserNote(): void {
  if (isTested(currentEngine())) return;
  try {
    if (localStorage.getItem(BROWSER_NOTED) !== null) return;
  } catch {
    // no storage: say it now
  }
  const status = document.querySelector('[data-testid="status"]');
  if (!status || document.querySelector('[data-testid="browser-note"]')) return;
  try {
    localStorage.setItem(BROWSER_NOTED, "1");
  } catch {
    // the next start says it again
  }
  const note = document.createElement("div");
  note.className = "browser-note";
  note.dataset["testid"] = "browser-note";
  note.setAttribute("role", "note");
  const text = document.createElement("p");
  text.textContent = tr("note");
  const ok = document.createElement("button");
  ok.type = "button";
  ok.dataset["testid"] = "browser-note-ok";
  ok.textContent = tr("ok");
  ok.addEventListener("click", () => note.remove());
  note.append(text, ok);
  status.after(note);
}

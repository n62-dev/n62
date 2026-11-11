// SPDX-License-Identifier: GPL-3.0-or-later
// R285: a browser whose engine has not passed (state/browser.ts TESTED) says so once, in one line under the status
// line, with OK. This module and its css are one lazy chunk; the start chunk only asks for it when the browser is idle.
// The flag is in the `tipsSeen` record (state/seenWrite.ts; not backed up) and is set when the line is shown, as the
// tips' is, so a reload does not show it again whether OK was pressed or not. Plain DOM, as the tips: no Svelte runtime.
import "./browserNote.css";
import { browserText as tr } from "../i18n/enBrowser.ts";
import { currentEngine, isTested } from "../state/browser.ts";
import { markSeen } from "../state/seenWrite.ts";
import { kvGet } from "../state/storage.ts";
import { says, TIPS_SEEN } from "../state/tips.ts";

/** Show the line if this browser has not passed and the note was never shown on this install. */
export async function browserNote(): Promise<void> {
  if (isTested(currentEngine())) return;
  const seen = await kvGet<unknown>(TIPS_SEEN);
  if (seen.kind === "failed" || (seen.kind === "value" && says(seen.value, "browser"))) return;
  const status = document.querySelector('[data-testid="status"]');
  if (!status || document.querySelector('[data-testid="browser-note"]')) return;
  void markSeen("browser");
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

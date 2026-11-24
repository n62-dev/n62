// SPDX-License-Identifier: GPL-3.0-or-later
// R930 (a start-chunk cut): a job's engine call and its result on the row, split from Session.finish. It runs only once the
// item chunk is in, which finish awaits before the engine is sent anything (R155f2), so it rides in that load (state/itemLoad.ts)
// and nothing waits longer than before.
import { CalcCancelled, type CalcError, type CalcSettings, type ConstTable } from "../calc/port.ts";
import { EngineCrashError, EngineMemoryError } from "../engine/types.ts";
import { hasMessage, t, type MessageKey } from "../i18n/index.ts";
import type { ChipTable } from "../input/chips.ts";
import { homeResultToLatex } from "../render/home.ts";
import { casItem, chipFactsOf, homeItem } from "./resultItem.ts";
import type { HistoryItem, Session, View } from "./session.svelte.ts";
import { prefetchTidy, tidyOr } from "./tidyLoad.ts";

const errorText = (code: CalcError | undefined, fallback: string): string => // G223: words only the worker has (enEngine.ts): its text
  code && hasMessage(`error.${code}`) ? t(`error.${code}` as MessageKey) : fallback;

/** The parsed line `giac` to the engine, its answer on the pending row `live`; a Cancel meanwhile stands (the row is no longer
 *  pending). `defines`: the function the line defines, noted for the next parse at once (R56; refreshNames then reads the log's). */
export async function runJob(session: Session, live: HistoryItem, view: View, giac: string, defines?: string, named?: ChipTable, consts?: ConstTable): Promise<void> {
  const st = session.settings;
  const s: CalcSettings = { digits: st.digits, angle: st.angle, format: st.format };
  try {
    const tidy = prefetchTidy();
    if (view === "home") {
      const r = await session.calc.home(giac, s, named && chipFactsOf(named), consts); // an absent table is not sent (EngineCalc.home)
      if (live.status !== "pending") return;
      const latex = !r.ok ? "" : r.latex !== undefined ? await tidyOr(tidy, r.latex, homeResultToLatex(r.display)) : homeResultToLatex(r.display);
      if (live.status !== "pending") return; // a Cancel while the tidy chunk loaded stands
      live.status = r.ok ? "done" : "error";
      live.text = r.ok ? r.display : errorText(r.error, r.display);
      if (r.settingReset) live.settingReset = true;
      if (r.ok && r.unitNames?.length) live.unitDropped = true; // G392: a stored name with a unit read, as a chip (R63)
      // The value, its facts and the chip text, by the one rule (results.ts, G86)
      Object.assign(live, homeItem(r, live.inexactInput === true, giac, s)); // (G211: with the text sent and the job's settings)
      // A result that is not a number is drawn from Giac's latex(), as in CAS (R18f3); numbers from our formatter.
      if (r.ok) live.resultLatex = latex;
    } else {
      const r = await session.calc.cas(giac, s);
      if (live.status !== "pending") return;
      const latex = r.ok ? await tidyOr(tidy, r.latex, r.latex) : "";
      if (live.status !== "pending") return;
      live.status = r.ok ? "done" : "error";
      live.text = r.ok ? r.text : errorText(r.error, r.text);
      if (r.settingReset) live.settingReset = true;
      if (r.ok) live.resultLatex = latex;
      if (r.ok && r.uses?.length) live.uses = r.uses;
      Object.assign(live, casItem(r, live.inexactInput === true, giac, s));
    }
    if (defines && live.status === "done")
      session.userNames = [...session.userNames.filter((u) => u.name !== defines), { name: defines, kind: "fn", preview: live.text, view, time: Date.now() }];
  } catch (e) {
    if (live.status !== "pending") return;
    if (e instanceof CalcCancelled) {
      live.status = "cancelled";
    } else {
      live.status = "error";
      // G183: our own line, never a JS error's text
      live.text = t(e instanceof EngineMemoryError ? "error.memory" : e instanceof EngineCrashError ? "error.crashed" : "error.engine");
    }
  }
}

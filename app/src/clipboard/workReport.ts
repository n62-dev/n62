// SPDX-License-Identifier: GPL-3.0-or-later
// R130: the work as a readable report (owner brief 2026-11-02 sections 1.3 and 5; S25 part 1): the open view's history as
// Markdown a colleague reads and an AI parses. One block per step (a history row, R53), the marks as words (R36's line,
// whyLine), the value as the screen shows it in the user's decimal mark without digit groups, its unit and σ named as the
// standard uncertainty (must-have C decision 8: never `k = 1`). A header with the version (a preview, owner 2026-11-12),
// the date and the settings that change a value; one paragraph says the format (also in the format for your AI, R59).
// Saved through the save port (files.ts). Loaded on the press only (ClipActions.exportWork), never at start.
import type { MarkInfo } from "../engine/format.ts";
import { t } from "../i18n/index.ts";
import { typedName } from "../render/home.ts";
import { commaResult, modeOf } from "../state/displayMode.ts";
import type { HistoryItem, Settings } from "../state/session.svelte.ts";
import { sigmaText } from "../state/sigmaLine.ts";
import type { SaveResult } from "./files.ts";
import { entryText } from "./plaintext.ts";
import { tc } from "./strings.ts";
import { withoutMark } from "./text.ts";
import { whyLine } from "./whyLine.ts";

/** What the report reads of the session (Session has all of it): the row as drawn, its mark, the settings. */
export interface ReportLook {
  settings: Pick<Settings, "digits" | "angle" | "format" | "decimalMark">;
  readonly decimalComma: boolean;
  display(item: HistoryItem): { text: string };
  mark(item: HistoryItem): MarkInfo | null;
  /** A row's input as drawn (the comma rule of R100). */
  input(item: HistoryItem): string;
}

const pad = (n: number): string => String(n).padStart(2, "0");
const day = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** `n62-work-YYYY-MM-DD.md`, by the local date. */
export const reportName = (now: Date): string => `n62-work-${day(now)}.md`;

/** The format paragraph: in the report's header and in the format for your AI (views/aiFormat.md, part 3). */
export const reportAbout = (): string => tc("report.about");

/** `s` as a Markdown code span: a fence longer than any run of backticks in it, so `*`, `_` and `\` stay as typed. */
function code(s: string): string {
  const longest = Math.max(0, ...[...s.matchAll(/`+/g)].map((m) => m[0].length));
  const fence = "`".repeat(longest + 1);
  const space = s.startsWith("`") || s.endsWith("`") ? " " : "";
  return `${fence}${space}${s}${space}${fence}`;
}

/** One line of text: a line break inside (an error message) becomes a space. */
const line = (s: string): string => s.replace(/\s*[\r\n]+\s*/g, " ").trim();

/** A unit row's fields, read back unchecked (state/session.svelte.ts UnitRow): strings only. `input` is the request as
 *  drawn (LaTeX, units/row.ts). */
function unitOf(item: HistoryItem): { input?: string; unit?: string; sigma?: string } {
  const u = item.units as { input?: unknown; unit?: unknown; unc?: { text?: unknown } } | undefined;
  if (!u) return {};
  const str = (x: unknown): string | undefined => (typeof x === "string" && x !== "" ? x : undefined);
  const input = str(u.input);
  const unit = str(u.unit);
  const sigma = str(u.unc?.text);
  return { ...(input ? { input } : {}), ...(unit ? { unit } : {}), ...(sigma ? { sigma } : {}) };
}

/** A row's input as the history draws it (History.svelte drawnInput: a unit row's request, R100's comma rule), as text. */
function inputOf(item: HistoryItem, look: ReportLook): string {
  const u = item.status === "done" ? unitOf(item).input : undefined;
  return entryText(look.input(u ? { ...item, latex: u } : item));
}

/** σ of a row as `± σ unit`: a unit row's (the unit view's σ), else the σ a constant's uncertainty leaves (R40). The
 *  exponent as the Value line writes it (`E`, Copy's text), not the σ line's `ᴇ`: one notation in the file. */
function sigmaOf(item: HistoryItem, look: ReportLook): string | null {
  const u = unitOf(item);
  const comma = look.decimalComma;
  const unit = u.unit ? ` ${u.unit}` : "";
  const s = u.sigma ? (comma ? commaResult(u.sigma, false) : u.sigma) : sigmaText(item.facts, modeOf(item, look.settings) ?? look.settings.format, comma);
  return s === null ? null : `± ${s.replace(/ᴇ/g, "E")}${unit}`;
}

/** The notes the history draws under a row (History.svelte), as words. */
function notesOf(item: HistoryItem): string[] {
  const out: string[] = [];
  if (item.settingReset) out.push(t("history.settingReset"));
  const names = (item.units as { names?: unknown } | undefined)?.names;
  if (typeof names === "string" && names !== "") out.push(names);
  if (item.unitDropped) out.push(t("history.unitDropped"));
  return out;
}

const field = (name: string, text: string): string => `- ${name}: ${text}`;

/** The block of one step; null for a row that is no step (running, cancelled, a note). */
function step(item: HistoryItem, n: number, look: ReportLook): string[] | null {
  if (item.status !== "done" && item.status !== "error") return null;
  const out = [`## ${tc("report.step")} ${n}`, "", field(tc("report.input"), code(line(inputOf(item, look))))];
  if (item.status === "error") {
    out.push(field(tc("report.error"), line(item.text)));
    return out;
  }
  const why = whyLine(item, look.mark(item), look.settings.digits);
  if (why !== null) out.push(field(tc("report.mark"), line(why)));
  out.push(field(tc("report.value"), code(line(withoutMark(look.display(item).text)))));
  const sigma = sigmaOf(item, look);
  if (sigma !== null) out.push(field(tc("report.uncertainty"), `${sigma}, ${tc("report.sigma")}`));
  if (item.uses?.length) {
    // the preview is Giac's text (a point): in the user's mark, as Session.display draws engine text
    const value = (v: string): string => (look.decimalComma ? commaResult(v, false) : v);
    const used = item.uses.map((v) => `${code(`${typedName(v.name)} = ${value(v.preview)}`)} (${t(v.view === "home" ? "history.usesHome" : "history.usesCas")})`);
    out.push(field(tc("report.uses"), used.join(", ")));
  }
  for (const note of notesOf(item)) out.push(field(tc("report.note"), line(note)));
  return out;
}

/** The report of `items` (the open view's rows, oldest first) as Markdown; "" when no row is a step. */
export function workReport(items: readonly HistoryItem[], look: ReportLook, head: { version: string; now: Date; view: "home" | "cas" }): string {
  const blocks: string[][] = [];
  for (const item of items) {
    const b = step(item, blocks.length + 1, look);
    if (b) blocks.push(b);
  }
  if (blocks.length === 0) return "";
  const s = look.settings;
  const time = `${day(head.now)} ${pad(head.now.getHours())}:${pad(head.now.getMinutes())}`;
  const header = [
    `N62 ${head.version} · ${tc("report.preview")}`,
    "",
    `# ${tc("report.title")}, ${time}`,
    "",
    field(tc("report.view"), t(head.view === "home" ? "view.home" : "view.cas")),
    field(tc("report.angle"), t(s.angle === "deg" ? "angle.deg" : "angle.rad")),
    field(tc("report.digits"), String(s.digits)),
    field(tc("report.format"), t(`format.${s.format}`)),
    field(tc("report.decimalMark"), tc(s.decimalMark === "comma" ? "report.comma" : "report.point")),
    "",
    reportAbout(),
  ];
  return [header, ...blocks].map((b) => b.join("\n")).join("\n\n") + "\n";
}

const NOTICE = { saved: "export.saved", offered: "export.offered", cancelled: "export.cancelled", failed: "export.failed" } as const;

/** Saves the report of `items` through the save port and returns the notice; nothing to export says so. Never throws. */
export async function saveWork(
  items: readonly HistoryItem[],
  look: ReportLook,
  head: { version: string; now: Date; view: "home" | "cas" },
  save: (name: string, mime: string, text: string) => Promise<SaveResult> = async (n, m, x) => (await import("./files.ts")).saveFile(n, m, x),
): Promise<string> {
  try {
    const text = workReport(items, look, head);
    if (text === "") return tc("export.nothing");
    return tc(NOTICE[await save(reportName(head.now), "text/markdown", text)]);
  } catch {
    return tc("export.failed");
  }
}

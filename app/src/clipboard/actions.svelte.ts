// SPDX-License-Identifier: GPL-3.0-or-later
// Copy, paste and share as the menus and gestures use them (docs/04 section 2.6): the Home/CAS ☰ menu (four rows, R830; Copy and Paste
// have Shift + Select and Shift + Deselect since R723), the picked row's buttons, a hold on a history row's input or result (R276), and the Num table. The texts come from text.ts and paste.ts; the delivery is the
// ClipboardPort. Every action ends in a short notice, so a refusal is never silent.
import type { EntryController } from "../entry/controller.ts";
import { tc } from "./strings.ts";
import type { AppShell } from "../apps/shell.svelte.ts";
import type { MenuItem } from "../apps/types.ts";
import { loadForms, type HistoryItem, type Session } from "../state/session.svelte.ts";
import type { TapCounts } from "../state/taps.svelte.ts";
import { drawnInput, targetRow, type PickPart } from "../state/pickRows.ts";
import { noDigit } from "../state/displayMode.ts";
import { groupMarked } from "../render/groupText.ts";
import { groupSepFor } from "../render/home.ts";
import { tooLongToInsert, tooLongToInsertNote } from "../render/longInsert.ts";
import { copyExact } from "./exact.ts";
import { whyLine } from "./whyLine.ts";
import { entryText } from "./plaintext.ts";
import type { ClipboardPort } from "./port.ts";
import type { CopySource, TextOptions } from "./text.ts";
import type { LibrarySource } from "../views/libraryJobs.ts";
/** The picked row's buttons draw the row actions below, so they come in this chunk, not the start chunk (R147). */
export { default as RowBar } from "../views/RowBar.svelte";

/** A history item as the copy texts read it: the engine's facts (R3 keeps them in `facts`) on the item itself. */
const source = (i: HistoryItem): CopySource => i;

// The text, paste and port code loads on first use (it is not needed to start).
const impl = () => import("./impl.ts");
/** R325: the reader of a unit row's Copy text, with the unit catalogue: only when the clipboard holds no number. */
const pasteUnit = () => import("./pasteUnit.ts");

const NOTICE_MS = 2200;
/** R832: the most characters of a copied text the notice names ("Copied: 0.333 333 333 333"); the whole is on the clipboard. */
const NAMED_MAX = 24;

/** What the row actions do on the entry line; App owns these (a tap on a row uses them before this code has loaded). */
export interface RowOps {
  /** Put the result on the line as a chip (a tap on it); `whole`: a linreg or stats1 list too, with no value sheet (R301);
   *  `stay`: a folded keypad stays down (Store ▶, R740: its sheet takes the name). */
  insert(item: HistoryItem, whole?: boolean, stay?: boolean): void;
  /** R832: a row's input goes on the line: on an empty one it is the recall (chips and all), else at the caret; `stay`: a folded keypad
   *  stays down (Store ▶: its sheet takes the name). */
  putInput?(item: HistoryItem, stay?: boolean): void;
  /** One of the Menu's row actions (store, copy, delete) runs, by a button, a list, a hold or a swipe (R53's count). */
  acted?(id: string): void;
  /** ☰ → Paste reads the clipboard: the keys pressed meanwhile wait for it (route.ts holdKeys), so Paste then ÷ divides the pasted number. */
  hold?(job: Promise<unknown>): void;
  /** Store ▶ put this row's result and ▶ on the line: the store sheet opens (R281); no item: the line had text, so the line is stored (R301). */
  stored?(item?: HistoryItem): void;
}

export class ClipActions {
  /** The short message on screen ("Copied"), or null. */
  notice = $state<string | null>(null);
  /** R832: the notice names a copy and stays on one line (App draws it ellipsed). */
  noticeOne = $state(false);
  private timer: ReturnType<typeof setTimeout> | undefined;

  private readonly session: Session;
  private readonly shell: AppShell;
  private readonly entry: EntryController;
  private readonly ops: RowOps;
  private readonly givenPort: ClipboardPort | undefined;
  private chosen: Promise<ClipboardPort> | undefined;
  private readonly decimalComma: () => boolean;

  /** `decimalComma`: the decimal mark setting (docs/04 section 6.2, R57); by default the session's. */
  constructor(session: Session, shell: AppShell, entry: EntryController, ops: RowOps, port?: ClipboardPort, decimalComma: () => boolean = () => session.decimalComma) {
    this.session = session;
    this.shell = shell;
    this.entry = entry;
    this.ops = ops;
    this.givenPort = port;
    this.decimalComma = decimalComma;
  }

  private get opts(): TextOptions {
    return this.decimalComma() ? { decimalComma: true } : {};
  }

  /** The tail of the chain: every clipboard operation starts when the one before it has finished, ok or not, so a quick
   *  Copy then Paste (both fire-and-forget) cannot read the clipboard before the Copy has written it (F100). */
  private tail: Promise<unknown> = Promise.resolve();
  private serial<T>(run: () => Promise<T>): Promise<T> {
    const next = this.tail.then(run, run);
    this.tail = next.catch(() => {});
    return next;
  }

  private async port(): Promise<ClipboardPort> {
    return this.givenPort ?? (this.chosen ??= (await impl()).choosePort());
  }

  say(message: string, ms = NOTICE_MS, one = false): void {
    this.notice = message;
    this.noticeOne = one;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = setTimeout(() => (this.notice = null), ms);
  }

  /** Settings › Data › Save a backup (R38a): the backup code loads on the press; the result is the notice in the stage
   *  (the status line has no room). */
  async saveBackup(): Promise<void> {
    this.say(await (await import("../state/backup.ts")).saveBackup());
  }

  /** Settings › Data › Sync folder (R128): a row's job on the sync code (sync/live.ts), loaded on the press; the job
   *  says its notice through `shell.clip` (this), before a picked folder's offer (R855). */
  async syncJob(job: "pick" | "now" | "stop"): Promise<void> {
    await (await import("../sync/live.ts")).syncJob(job, this.session, this.shell);
  }

  /** Settings › Counters › Export the counts (R127): the counts as they stand; the result is the notice. */
  async saveCounts(counts: TapCounts): Promise<void> {
    const m = await import("../state/countsFile.ts");
    this.say(await m.saveCounts(m.countsText(counts)));
  }

  /** Settings › Data › Restore from a file, with the picked file, or Undo the restore (R38b): the restore code loads on
   *  the press; a refusal or a failure is the notice, a good file opens the restore sheet. */
  async restoreBackup(file: File | "undo"): Promise<void> {
    const m = await import("../views/restoreSheet.svelte.ts");
    const say = (s: string): void => this.say(s);
    await (file === "undo" ? m.offerUndo(say) : m.offerRestore(file, this.shell, say));
  }

  /** Settings › Data › Library (R59): import a picked file or the clipboard's text, export, copy the format for your
   *  AI. The library code loads on the press; every outcome is the notice (views/libraryJobs.ts). */
  async library(job: "file" | "clipboard" | "export" | "format", file?: File): Promise<void> {
    const m = await import("../views/libraryJobs.ts");
    const src: LibrarySource = { shell: this.shell, session: this.session, say: (s, ms) => this.say(s, ms), clip: (run) => this.serial(async () => run(await this.port())) };
    return m.runJob(m.hostOf(src), job, file);
  }

  /** The row an action means: the given one, else the newest finished result of the open view. */
  target(item?: HistoryItem): HistoryItem | undefined {
    return targetRow(this.session.items, item);
  }

  /** Put text on the clipboard and say so. */
  copyRaw(text: string | undefined, done: string = tc("clip.copied"), one = false): Promise<boolean> {
    return this.serial(() => this.put(text, done, one));
  }
  /** R832: "Copied: <what>", the text on one line (a long one cut with …). */
  private named(what: string): string {
    const chars = [...what.replace(/[ \t\r\n]+/g, " ").trim()]; // (not \s: the thin space of the digit groups stays)
    return tc("clip.copiedWhat").replace("{what}", chars.length > NAMED_MAX ? `${chars.slice(0, NAMED_MAX).join("")}…` : chars.join(""));
  }
  /** R832: a shown result as the row draws it, the digits in groups (R55, R125: the setting's separator), for a notice. */
  private grouped(text: string): string {
    const ctx = this.session.displayContext();
    return groupMarked(text, groupSepFor(ctx.groupSep, ctx.decimalComma), ctx.decimalComma === true);
  }
  private async put(text: string | undefined, done: string = tc("clip.copied"), one = false): Promise<boolean> {
    if (text === undefined || text === "") {
      this.say(tc("clip.nothing"));
      return false;
    }
    const ok = await (await this.port()).writeText(text);
    this.say(ok ? done : tc("clip.unavailable"), NOTICE_MS, ok && one);
    return ok;
  }

  /** R832f2: a finished row with no confirmed digit (mark ⚠ n 0) shows no number, so what shows a number (Full value, As shown, LaTeX,
   *  a hold on the result, Shift + Select) writes nothing: the notice says why, the clipboard stays as it was, the copy is not counted. */
  private noNumber(i: HistoryItem | undefined): boolean {
    return i !== undefined && i.status === "done" && noDigit(this.session.mark(i));
  }
  private refuseNoDigit(): false {
    this.say(tc("clip.noDigit"));
    return false;
  }

  /** R276: a hold on a history row's input (`latex`, as drawn: its plain text) or result (Copy's full value) copies
   *  it; a row action (counted as Menu's Copy is). */
  holdCopy(item: HistoryItem, part: "input" | "result", latex: string): Promise<boolean> {
    if (part === "result") {
      if (item.status === "done" && !this.noNumber(item)) this.ops.acted?.("copy");
      return this.copy(item, true);
    }
    this.ops.acted?.("copy");
    const text = entryText(latex, this.opts);
    return this.copyRaw(text, text ? this.named(text) : undefined, true);
  }
  /** What a hold on the row's input copies: its plain text, the units in it (R63); the row's own, not Home's recall. */
  private inputLatex(item: HistoryItem): string {
    return drawnInput(item, (i) => this.session.input(i));
  }
  /** Shift + Select (R723): the entry line's selection (R727) as plain text, else what a hold on the row's result copies, of `row` (the picked one), else of the last finished
   *  row; `dead` (the dead press), and nothing written, when there is no such row or an app is open (its rows are not Home's). */
  keyCopy(dead: () => void, row?: HistoryItem, letGo?: () => void, lit: PickPart = "row"): void {
    const mf = this.shell.app === null || this.shell.showsEntry ? this.entry.field : null;
    const selection = mf && !mf.selectionIsCollapsed ? mf.getValue(mf.selection, "latex") : "";
    if (selection) {
      this.ops.acted?.("copy"); // as a hold on an input counts, and copies its plain text
      const text = entryText(selection, this.opts);
      void this.copyRaw(text, text ? this.named(text) : undefined, true); // R832: the notice names it
      return;
    }
    letGo?.(); // no selection: the picked row is let go (R723)
    if (lit === "input" && row && row.status !== "pending" && this.shell.app === null) return void this.holdCopy(row, "input", this.inputLatex(row)); // R832: the lit input, as a hold on it
    const i = this.shell.app === null ? this.target(row) : undefined;
    if (i) void this.holdCopy(i, "result", "");
    else dead();
  }
  /** `named` (R832): the notice says what was copied, as a hold's does. */
  copy(item?: HistoryItem, named = false): Promise<boolean> {
    return this.serial(() => this.copyNow(item, named));
  }
  private async copyNow(item: HistoryItem | undefined, named: boolean): Promise<boolean> {
    const i = this.target(item);
    const m = i ? await impl() : undefined;
    if (this.noNumber(i)) return this.refuseNoDigit();
    const shown = i && m ? m.copyShownText(this.session.display(i).text) : "";
    return this.put(i && m ? m.copyFull(source(i), this.opts) : undefined, named && i && m ? this.named(this.grouped(shown)) : undefined, named);
  }
  /** `named` (R832): the notice names the copy (the bar's rows, Shift + Select, a hold). */
  copyShown(item?: HistoryItem, named = false): Promise<boolean> {
    return this.serial(async () => {
      const i = this.target(item);
      if (this.noNumber(i)) return this.refuseNoDigit();
      const text = i ? (await impl()).copyShownText(this.session.display(i).text) : undefined; // G784: the letters, not i_
      return this.put(text, named && text ? this.named(this.grouped(text)) : undefined, named);
    });
  }
  copyExact(item?: HistoryItem, named = false): Promise<boolean> {
    return this.serial(async () => {
      const i = this.target(item);
      if (i && copyExact(i) === undefined) {
        this.say(tc("clip.noExact"));
        return false;
      }
      // G784: the stand-ins as their letters; R100: an exact list ({3/2,2}) with the decimal comma separates its elements by `;`, as Copy does
      const text = i ? (await impl()).copyExactText(source(i), this.opts) : undefined;
      return this.put(text, named && text ? this.named(text) : undefined, named);
    });
  }
  /** R181: Copy › Python: the row (else the last result) as a sympy script, from its session line (pyExport.ts). */
  copyPython(item?: HistoryItem): Promise<boolean> {
    return this.serial(async () => {
      const i = this.target(item);
      try {
        const [m, about] = i ? await Promise.all([import("./pyExport.ts"), import("virtual:about")]) : [];
        return this.put(i && m && about ? m.pythonText([i], about.default.version, new Date()) : undefined);
      } catch {
        this.say(tc("export.fileFailed").replace("{what}", tc("export.python")));
        return false;
      }
    });
  }
  copyLatex(item?: HistoryItem): Promise<boolean> {
    return this.serial(async () => {
      const i = this.target(item);
      if (this.noNumber(i)) return this.refuseNoDigit();
      return this.put(i ? this.session.display(i).latex : undefined);
    });
  }

  /** ☰ → Paste: the clipboard as one number, onto the entry line. `text`: a system paste's own text
   *  (Ctrl+V, Shift+Insert, the context menu; R114), which takes the same path without reading the clipboard. */
  paste(text?: string): Promise<boolean> {
    return this.serial(() => this.pasteNow(text));
  }
  /** ☰ → Paste, Home's and the apps' (R278f1): the paste, and the keys pressed meanwhile wait for it. */
  pasteHeld(): void {
    this.ops.hold?.(this.paste());
  }
  private async pasteNow(text?: string): Promise<boolean> {
    const clip = text ?? (await (await this.port()).readText());
    if (clip === null) {
      this.say(tc("clip.unavailable"));
      return false;
    }
    const n = (await impl()).parsePastedNumber(clip, this.opts);
    if (!n) return this.pasteQuantity(clip);
    if (this.shell.showsEntry) this.entry.insert(n.latex);
    else {
      this.say(tc("clip.nothing"));
      return false;
    }
    return true;
  }
  /** R325: a unit row's Copy text (`39.488 ± 1.2 m²`) as R61's result chip, its unit read against the Find index, which
   *  Paste then waits for (hurried, as Help does); a unit the index does not hold is refused, named. */
  private async pasteQuantity(clip: string): Promise<boolean> {
    const u = await pasteUnit();
    const q = u.quantityText(clip, this.opts);
    if (!q) {
      this.say(tc("clip.notNumber"));
      return false;
    }
    // (an index that does not load holds no unit: refused as one it lacks)
    const r = await u.unitCatalogue().then((c) => u.readQuantity(q, ...c), () => ({ unknown: q.unit }));
    if ("unknown" in r) {
      this.say(tc("clip.unknownUnit").replace("{unit}", r.unknown));
      return false;
    }
    if (!this.shell.showsEntry) {
      this.say(tc("clip.nothing"));
      return false;
    }
    this.entry.insertResult(r.shown, r.chip);
    return true;
  }

  /** Menu → Share session: the system share sheet, else the clipboard. */
  shareSession(): Promise<boolean> {
    return this.serial(() => this.shareNow());
  }
  private async shareNow(): Promise<boolean> {
    const text = (await impl()).sessionText(this.session.items.map(source), this.opts, this.session.displayContext());
    if (text === "") {
      this.say(tc("clip.nothing"));
      return false;
    }
    if (await (await this.port()).share(tc("clip.sessionTitle"), text)) {
      this.say(tc("clip.shared"));
      return true;
    }
    return this.put(text, tc("clip.sharedAsCopy"));
  }

  /** ☰ › Export › Work report (R130): the open view's rows as a Markdown report through the save port; the result is the
   *  notice. The report code loads on the press. */
  exportWork(): Promise<void> {
    // in the chain, so a second press waits for the first save; a chunk that does not load (offline after an update) says so
    return this.serial(async () => {
      try {
        const [m, about, forms] = await Promise.all([import("./workReport.ts"), import("virtual:about"), loadForms()]);
        const s = this.session;
        const word = forms?.wordStore.value; // R305: the word the base forms are drawn in, named in the header
        this.say(await m.saveWork(s.items, s, { version: about.default.version, now: new Date(), view: s.view, ...(word ? { word } : {}) }));
      } catch {
        this.say(tc("export.failed"));
      }
    });
  }

  /** ☰ › Export › CSV or LaTeX (R200): the open session's finished rows as a file through the save port; the result is the
   *  notice. In the chain, and a chunk that does not load says so, as the work report does. */
  private exportRows(kind: "csv" | "latex"): Promise<void> {
    return this.serial(async () => {
      try {
        const [m, about] = await Promise.all([import("./exportRows.ts"), import("virtual:about")]);
        const s = this.session;
        this.say(await m.saveRows(kind, s.items.map(source), this.opts, s.displayContext(), { version: about.default.version, now: new Date() }));
      } catch {
        this.say(tc("export.fileFailed").replace("{what}", tc(kind === "csv" ? "export.csv" : "export.latex")));
      }
    });
  }
  /** ☰ › Export › Python (R181): the open session's finished rows as `n62-<date>.py`; the result is the notice. */
  savePython(): Promise<void> {
    return this.serial(async () => {
      try {
        const [m, about] = await Promise.all([import("./pyExport.ts"), import("virtual:about")]);
        this.say(await m.savePython(this.session.items, { version: about.default.version, now: new Date() }));
      } catch {
        this.say(tc("export.fileFailed").replace("{what}", tc("export.python")));
      }
    });
  }
  exportCsv(): Promise<void> {
    return this.exportRows("csv");
  }
  exportLatex(): Promise<void> {
    return this.exportRows("latex");
  }

  /** Settings › Help and about › Report a problem (R173): the report (version, device, the session) on the clipboard, then
   *  the issue form in a new tab (on Android in the browser, A95). The session travels on the clipboard, only the short fields in the link (report.ts). */
  reportProblem(): Promise<void> {
    return this.serial(() => this.reportNow());
  }
  private async reportNow(): Promise<void> {
    const m = await impl();
    const { reportText, issueUrl, openIssueForm } = await import("./report.ts");
    const { aboutText } = await import("../i18n/enAbout.ts");
    const version = (await import("virtual:about")).default.version;
    const device = navigator.userAgent;
    const session = m.sessionText(this.session.items.map(source), this.opts, this.session.displayContext());
    const text = reportText(version, device, session);
    const { Capacitor } = await import("@capacitor/core");
    if (!(await this.put(text, aboutText("report.copied")))) return;
    const url = issueUrl({ version, device });
    const opened = openIssueForm(url, {
      native: Capacitor.isNativePlatform(),
      navigate: (u) => location.assign(u),
      open: (u) => window.open(u, "_blank"),
    });
    if (!opened) this.say(aboutText("report.openBy"));
  }

  /** R184: the labelled sheet of a linreg or stats1 row (views/statSheet.ts, a lazy module), which inserts a value as a chip;
   *  false: the row has none, so the caller inserts its result whole. */
  async showStats(row: HistoryItem): Promise<boolean> {
    return (await import("../views/statSheet.ts")).showStats(this.shell, this.session, row, this.entry);
  }
  /** Store ▶: the result and the store arrow on the line, the cursor ready for the variable's name (value ▶ name).
   *  R301: a linreg or stats1 row goes in whole (its value sheet would open beside "Store in"); onto a line with text,
   *  the line is what is stored, so "Store in" opens on the typed path (its title the line before ▶, `2+5`). */
  storeRow(row?: HistoryItem, lit: PickPart = "row"): boolean {
    if (lit === "input" && row) return this.storeInput(row);
    const i = this.target(row);
    if (!i || !this.shell.showsEntry) return false;
    const typed = !this.entry.empty;
    this.ops.insert(i, true, true); // (R740: folded, the keys stay down)
    this.entry.insert("\\blacktriangleright");
    this.ops.stored?.(typed ? undefined : i); // R281: "Store in" opens
    return true;
  }
  /** R832: Store ▶ with the input lit: the input on the line (an empty line: the recall) and ▶, "Store in" open on that line (`2+3▶`);
   *  a running row has no input to store yet. */
  private storeInput(row: HistoryItem): boolean {
    if (row.status === "pending" || !this.shell.showsEntry) return false;
    this.ops.putInput?.(row, true); // (folded, the keys stay down, R740)
    this.entry.insert("\\blacktriangleright");
    this.ops.stored?.(); // the line is what is stored
    return true;
  }
  /** L5 and docs/04 2.8: a tapped or picked result goes on the line as a chip that carries its full value; R746: an exact
   *  result drawn as its exact value (`=`, or CAS's own unmarked maths) with a fraction, root, power or matrix goes as that
   *  maths, editable, one term (render/exactMaths.ts, entry/oneTerm.ts; decided as it goes on the field). It lives here, not in
   *  App, since a row is picked (and this code loaded) before its result is tapped (the start chunk is pinned). */
  insertResult(item: HistoryItem, whole = false): void {
    // R184: linreg and stats1 ask which value (showStats); an answer with no such list goes in whole
    if (!whole && /linreg|stats1/.test(item.latex)) return void this.showStats(item).catch(() => false).then((ok) => void (ok || this.insertResult(item, true)));
    // a result with no confirmed digit goes on the line as the bare warning mark, never as its unconfirmed number
    const { session, entry } = this;
    const chip = session.chipFor(item);
    // a unit row with no chip (R63f1): Home's number alone, never its σ or unit (Home has no units); its chip shows both
    const { units, ...number } = item;
    const mark = session.mark(item);
    const shown = noDigit(mark) ? "⚠" : session.display(units && !chip ? number : item).latex;
    if (chip) entry.insertResult(shown, chip, !!chip.exact && !chip.unc && !units && (mark ? mark.mark === "=" : item.view === "cas"));
    else if (tooLongToInsert(shown, false)) this.say(tooLongToInsertNote()); // R135f2: too long to draw, so to insert
    else entry.insert(shown, true); // too long for a chip: as drawn (render/insertable.ts), one term
  }
  /** R832: Enter on a lit input: it goes at the caret (an empty line: the recall, with its chips); the pick is let go. */
  enterInput(row: HistoryItem): void {
    this.ops.putInput?.(row);
  }
  /** Delete: the picked row, else the last row of the view. A running row is not deleted; when the Undo code does not
   *  load, nothing is deleted and the history says so (R98). */
  deleteRow(row?: HistoryItem): Promise<boolean> {
    const i = row ?? this.session.items.at(-1);
    if (!i) return Promise.resolve(false);
    if (i.status === "pending") {
      this.say(tc("clip.working"));
      return Promise.resolve(false);
    }
    return this.session.removeItem(i);
  }

  /** A row action: told to the app first, while the keypad is as the user left it (the row buttons share these items). */
  private act(id: string, run: () => unknown): () => void {
    return () => {
      this.ops.acted?.(id);
      void run();
    };
  }
  /** A disabled item says why on its second line (docs/05 3.1). With an empty history it says nothing: the screen says
   *  "Type a calculation" already, and the rows with a reason line do not fit over the keypad (fit.spec.ts). */
  private why(): string | undefined {
    return this.session.items.length === 0 ? undefined : tc("clip.noResult");
  }

  /** The picked row's Store ▶ button (R276; not in ☰ since R830). */
  storeItem(row?: HistoryItem, lit: PickPart = "row"): MenuItem {
    const none = lit === "input" && row ? row.status === "pending" : this.target(row) === undefined; // (the input of a finished row is there even when it has no result)
    return { id: "store", label: tc("clip.store"), disabled: none || !this.shell.showsEntry, reason: this.why(), run: this.act("store", () => this.storeRow(row, lit)) };
  }
  /** Copy › Full value: a row action (R53's count), unless the row has no digit to copy (R832f2: not counted). */
  private copyFullRow(row?: HistoryItem): void {
    if (!this.noNumber(this.target(row))) this.ops.acted?.("copy");
    void this.copy(row, true);
  }
  /** The picked row's Copy › button, with the five rows it opens (the first is what a hold copies). */
  copyItem(row?: HistoryItem): MenuItem {
    const i = this.target(row);
    const none = i === undefined;
    const why = this.why();
    const copies: MenuItem[] = [
      { id: "full", label: tc("clip.subFull"), disabled: none, reason: why, run: () => this.copyFullRow(row) },
      { id: "shown", label: tc("clip.subShown"), disabled: none, reason: why, run: () => void this.copyShown(row, true) },
      {
        id: "exact",
        label: tc("clip.subExact"),
        disabled: none || copyExact(i) === undefined,
        reason: none ? why : tc("clip.noExact"),
        run: () => void this.copyExact(row, true),
      },
      { id: "latex", label: tc("clip.subLatex"), disabled: none, reason: why, run: () => void this.copyLatex(row) },
      { id: "python", label: tc("clip.subPython"), disabled: none, reason: why, run: () => void this.copyPython(row) },
    ];
    return { id: "copy", label: tc("clip.copy"), disabled: none, reason: why, submenu: { title: tc("clip.copy"), items: copies } };
  }

  /** The Home/CAS Menu (docs/05 3.3, S2 rule M2; R830, which cut R720's seven): four rows, the same numbers with or without a
   *  picked row, acting on that row, else on the last result: 1 Delete (what a swipe does, kept for TalkBack), 2 Share session,
   *  3 Clear history, 4 Export ›, whose submenu R130, R181 and R200 share. Store ▶ and Copy › are the picked row's buttons
   *  (`rowButtons`), Paste is Shift + Deselect; 5 to 9 and 0 are blank, and a new row takes the next digit (the layout lock). */
  menu(row?: HistoryItem): MenuItem[] {
    const why = this.why();
    const empty = this.session.items.length === 0;
    const last = row ?? this.session.items.at(-1);
    const finished = this.session.items.some((x) => x.status === "done" || x.status === "error");
    return [
      {
        id: "delete",
        label: tc("clip.delete"),
        disabled: last === undefined || last.status === "pending",
        reason: last === undefined ? undefined : tc("clip.working"),
        run: this.act("delete", () => this.deleteRow(row)),
      },
      { id: "share", label: tc("clip.share"), disabled: !finished, reason: why, run: () => void this.shareSession() },
      { id: "clear", label: tc("clip.clear"), disabled: empty, run: () => void this.session.clearHistory() },
      {
        id: "export",
        label: tc("clip.export"),
        disabled: !finished,
        reason: why,
        submenu: {
          title: tc("clip.export"),
          items: [
            { id: "work", label: tc("export.work"), disabled: !finished, reason: why, run: () => void this.exportWork() },
            { id: "csv", label: tc("export.csv"), disabled: !finished, reason: why, run: () => void this.exportCsv() },
            { id: "latex", label: tc("export.latex"), disabled: !finished, reason: why, run: () => void this.exportLatex() },
            { id: "python", label: tc("export.python"), disabled: !finished, reason: why, run: () => void this.savePython() },
          ],
        },
      },
    ];
  }

  /** The row buttons above the entry line (R276): Store ▶ and Copy › for the picked row; Copy › opens its five on the
   *  sheet. The second tap inserts or recalls, a hold copies, a swipe deletes (History.svelte). */
  rowButtons(row: HistoryItem, lit: PickPart = "row"): MenuItem[] {
    if (lit === "input") {
      // R832: the lit input: Store ▶ puts it on the line with ▶; Copy (no ›: it has one form) copies its plain text, as a hold does
      const run = (): void => void this.holdCopy(row, "input", this.inputLatex(row));
      return [this.storeItem(row, lit), { id: "copy", label: tc("clip.copy"), disabled: row.status === "pending", reason: this.why(), run }];
    }
    const buttons: MenuItem[] = [this.storeItem(row)];
    const { submenu: sub, ...button } = this.copyItem(row);
    if (sub) buttons.push({ ...button, label: `${button.label} ›`, run: () => this.shell.showMenu(sub.title, sub.items, { remember: false }) });
    return buttons;
  }

  /** R36: the picked row's reason for its mark, one line; null when it has no mark. R40f1: a row with a σ (Settings ›
   *  Numbers › Uncertainty: σ on tap) adds its σ line after a dot, so the keys reach it as a tap does. Session.reason
   *  (R124's line under a ⚠ row) stays R36's words only. */
  rowWhy(row: HistoryItem): string | null {
    const s = this.session;
    const why = whyLine(row, s.mark(row), s.settings.digits);
    if (why === null) return null;
    const sigma = s.sigma(row);
    return sigma ? `${why} · ${sigma}` : why;
  }

  /** Menu with a picked row (R13): the whole list, acting on that row; ☰ and Menu add the ⚙ for Settings to its title row
   *  (R145). */
  openMenu(item: HistoryItem): void {
    this.shell.showMenu(tc("clip.title"), this.menu(item), { remember: false, settings: true });
  }
}

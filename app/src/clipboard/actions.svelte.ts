// SPDX-License-Identifier: GPL-3.0-or-later
// Copy, paste and share as the menus and gestures use them (docs/04 section 2.6): the Home/CAS ☰ menu (Copy and Paste
// are items of it since R278 took their keys away), the picked row's buttons, a hold on a history row's input or result (R276), and the Num table. The texts come from text.ts and paste.ts; the delivery is the
// ClipboardPort. Every action ends in a short notice, so a refusal is never silent.
import type { EntryController } from "../entry/controller.ts";
import { tc } from "./strings.ts";
import type { AppShell } from "../apps/shell.svelte.ts";
import type { MenuItem } from "../apps/types.ts";
import { loadForms, type HistoryItem, type Session } from "../state/session.svelte.ts";
import type { TapCounts } from "../state/taps.svelte.ts";
import { commaResult } from "../state/displayMode.ts";
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

/** What the row actions do on the entry line; App owns these (a tap on a row uses them before this code has loaded). */
export interface RowOps {
  /** Put the result on the line as a chip (a tap on it); `whole`: a linreg or stats1 list too, with no value sheet (R301). */
  insert(item: HistoryItem, whole?: boolean): void;
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

  say(message: string, ms = NOTICE_MS): void {
    this.notice = message;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = setTimeout(() => (this.notice = null), ms);
  }

  /** Settings › Data › Save a backup (R38a): the backup code loads on the press; the result is the notice in the stage
   *  (the status line has no room). */
  async saveBackup(): Promise<void> {
    this.say(await (await import("../state/backup.ts")).saveBackup());
  }

  /** Settings › Data › Sync folder (R128): a row's job on the sync code (sync/live.ts), loaded on the press; its result is the notice. */
  async syncJob(job: "pick" | "now" | "stop"): Promise<void> {
    this.say(await (await import("../sync/live.ts")).syncJob(job, this.session, this.shell));
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
    if (item) return item.status === "done" ? item : undefined;
    const items = this.session.items;
    for (let i = items.length - 1; i >= 0; i--) if (items[i]?.status === "done") return items[i];
    return undefined;
  }

  /** Put text on the clipboard and say so. */
  copyRaw(text: string | undefined, done: string = tc("clip.copied")): Promise<boolean> {
    return this.serial(() => this.put(text, done));
  }
  private async put(text: string | undefined, done: string = tc("clip.copied")): Promise<boolean> {
    if (text === undefined || text === "") {
      this.say(tc("clip.nothing"));
      return false;
    }
    const ok = await (await this.port()).writeText(text);
    this.say(ok ? done : tc("clip.unavailable"));
    return ok;
  }

  /** R276: a hold on a history row's input (`latex`, as drawn: its plain text) or result (Copy's full value) copies
   *  it; a row action (counted as Menu's Copy is). */
  holdCopy(item: HistoryItem, part: "input" | "result", latex: string): Promise<boolean> {
    if (part === "result") {
      if (item.status === "done") this.ops.acted?.("copy");
      return this.copy(item);
    }
    this.ops.acted?.("copy");
    return this.copyRaw(entryText(latex, this.opts));
  }
  copy(item?: HistoryItem): Promise<boolean> {
    return this.serial(() => this.copyNow(item));
  }
  private async copyNow(item?: HistoryItem): Promise<boolean> {
    const i = this.target(item);
    return this.put(i ? (await impl()).copyFull(source(i), this.opts) : undefined);
  }
  copyShown(item?: HistoryItem): Promise<boolean> {
    return this.serial(async () => {
      const i = this.target(item);
      return this.put(i ? (await impl()).withoutMark(this.session.display(i).text) : undefined);
    });
  }
  copyExact(item?: HistoryItem): Promise<boolean> {
    return this.serial(async () => {
      const i = this.target(item);
      const exact = i ? copyExact(i) : undefined;
      if (i && exact === undefined) {
        this.say(tc("clip.noExact"));
        return false;
      }
      // R100: an exact list ({3/2,2}) with the decimal comma separates its elements by `;`, as Copy does
      return this.put(exact !== undefined && this.opts.decimalComma ? commaResult(exact, false) : exact);
    });
  }
  /** R181: Copy as › Python: the row (else the last result) as a sympy script, from its session line (pyExport.ts). */
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
  storeRow(row?: HistoryItem): boolean {
    const i = this.target(row);
    if (!i || !this.shell.showsEntry) return false;
    const typed = !this.entry.empty;
    this.ops.insert(i, true);
    this.entry.insert("\\blacktriangleright");
    this.ops.stored?.(typed ? undefined : i); // R281: "Store in" opens
    return true;
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

  /** The Home/CAS Menu (docs/05 3.3, S2 rule M2; R720): seven rows, the same numbers with or without a picked row, acting
   *  on that row, else on the last result. The picked row's buttons are items 1 and 2 (R276). Item 2 is Copy ›, whose first
   *  item is what a hold copies; item 7 is Export ›, whose submenu R130, R181 and R200 share. Insert and Recall are gone (Enter
   *  and ◀ on the pick do their jobs, route.ts); 8, 9 and 0 are blank, and a new row takes the next digit (the layout lock). */
  menu(row?: HistoryItem): MenuItem[] {
    const i = this.target(row);
    const none = i === undefined;
    // A disabled item says why on its second line (docs/05 3.1). With an empty history it says nothing: the screen says
    // "Type a calculation" already, and the rows with a reason line do not fit over the keypad (fit.spec.ts).
    const empty = this.session.items.length === 0;
    const why = empty ? undefined : tc("clip.noResult");
    const last = row ?? this.session.items.at(-1);
    const noLine = !this.shell.showsEntry;
    /** A row action: told to the app first, while the keypad is as the user left it (the row buttons share these items). */
    const act = (id: string, run: () => unknown) => (): void => {
      this.ops.acted?.(id);
      void run();
    };
    const copies: MenuItem[] = [
      { id: "full", label: tc("clip.subFull"), disabled: none, reason: why, run: act("copy", () => this.copy(row)) },
      { id: "shown", label: tc("clip.subShown"), disabled: none, reason: why, run: () => void this.copyShown(row) },
      {
        id: "exact",
        label: tc("clip.subExact"),
        disabled: none || copyExact(i) === undefined,
        reason: none ? why : tc("clip.noExact"),
        run: () => void this.copyExact(row),
      },
      { id: "latex", label: tc("clip.subLatex"), disabled: none, reason: why, run: () => void this.copyLatex(row) },
      { id: "python", label: tc("clip.subPython"), disabled: none, reason: why, run: () => void this.copyPython(row) },
    ];
    const finished = this.session.items.some((x) => x.status === "done" || x.status === "error");
    return [
      { id: "store", label: tc("clip.store"), disabled: none || noLine, reason: why, run: act("store", () => this.storeRow(row)) },
      { id: "copy", label: tc("clip.copy"), disabled: none, reason: why, submenu: { title: tc("clip.copy"), items: copies } },
      {
        id: "delete",
        label: tc("clip.delete"),
        disabled: last === undefined || last.status === "pending",
        reason: last === undefined ? undefined : tc("clip.working"),
        run: act("delete", () => this.deleteRow(row)),
      },
      { id: "paste", label: tc("clip.paste"), run: () => this.pasteHeld() },
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

  /** The row buttons above the entry line (R276): Store ▶ and Copy › of the list, for the picked row; Copy › opens
   *  its five on the sheet. The second tap inserts or recalls, a hold copies, a swipe deletes (History.svelte). */
  rowButtons(row: HistoryItem): MenuItem[] {
    const all = this.menu(row);
    const store = all.find((b) => b.id === "store");
    const as = all.find((b) => b.id === "copy");
    const buttons: MenuItem[] = store ? [store] : [];
    if (as?.submenu) {
      const { submenu: sub, ...button } = as;
      buttons.push({ ...button, label: `${as.label} ›`, run: () => this.shell.showMenu(sub.title, sub.items, { remember: false }) });
    }
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

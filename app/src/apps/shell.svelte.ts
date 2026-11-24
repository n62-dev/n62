// SPDX-License-Identifier: GPL-3.0-or-later
// Which app and view is on screen, and the apps loaded so far. Home and CAS stay in Session; this adds the
// apps beside them. App code loads on first use (registry.ts); the open app and view are stored like the
// settings, so the calculator comes back where it was.
import type { Calc, UserName } from "../calc/port.ts";
import type { Chip, ChipTable } from "../input/chips.ts";
import { t } from "../i18n/index.ts";
import type { ActionBody } from "../keyboard/keyboard.ts";
import type { Kv } from "../state/storage.ts";
import type { CreditBlock, Picked, Sheet, UncHead } from "../views/sheet.svelte.ts";
import { loadSheetModel, sheetChunk } from "../views/sheetView.svelte.ts";
import type * as ShellOpenCode from "./shellOpen.ts";
import { isAppId, type BarSlot } from "./registry.ts";
import { VIEW_IDS, type AppHost, type AppId, type AppInstance, type LoadedApp, type MenuItem, type NavDir, type SubMenu, type ViewId } from "./types.ts";

type ShellOpen = typeof ShellOpenCode;
type SheetModel = typeof import("../views/sheet.svelte.ts");

/** R782: the Apps sheet of a second tap on the bar's slot 2 (a sheet id of its own, so APP▾'s and the slot's toggle apart). */
const SLOT_SHEET = "apps:slot";

/** The entry line as the shell sees it (EntryController in the app, a stub in tests). */
export interface EntryLine {
  readonly value: string;
  /** The chips on the line (the real controller; a test stub may leave it out: no chips). */
  readonly chips?: ChipTable;
  set(latex: string, chips?: ChipTable): void;
  clear(): void;
  /** A result as a chip at the cursor (R262: an app's answer taken to Home; a test stub may leave it out). */
  insertResult?(shown: string, chip: Chip): void;
}

interface Place {
  app: AppId | null;
  view: ViewId;
}

/** The palettes' sheet ids: Tmpl (R10), Shift + 6 and Shift + 9 (R18). Also their i18n prefix (`<id>.title`). */
export type PaletteId = "tmpl" | "rel" | "sym" | "chars";
const PALETTE_IDS: readonly string[] = ["tmpl", "rel", "sym", "chars"] satisfies PaletteId[];

/** The entry line asks for a name (R89, views/presetsView.svelte.ts): its label stands over the line, and every key's
 *  action goes to `key` first (true: taken). The asker clears `prompt` when done; `cancel` ends it as Esc does (the line
 *  comes back), run by the asker itself when a sheet opens or the app or view changes (a tap goes elsewhere). `aside` is
 *  the line it set aside, the one a hide keeps (R34, R123): the name on the line is never kept. */
export interface EntryPrompt {
  readonly label: string;
  /** R776: a line under the entry, shown for as long as the prompt is open (App.svelte). */
  readonly hint?: string;
  readonly aside: { readonly latex: string; readonly chips: ChipTable };
  key(action: ActionBody): boolean;
  cancel(): void;
}

export class AppShell {
  /** The open app, or null for Home/CAS. */
  app = $state<AppId | null>(null);
  view = $state<ViewId>("symb");
  /** Loaded apps (raw: instances keep their own reactive state). */
  loaded = $state.raw<Partial<Record<AppId, LoadedApp>>>({});
  /** The open sheet (docs/05 3.1): the Apps list, a view's Menu, or a list such as a history row's actions. Setting it
   *  (a sheet or null) drops a sheet still waiting for its model (R151, openSheet). */
  get sheet(): Sheet | null {
    return this.#sheet;
  }
  set sheet(s: Sheet | null) {
    this.sheetPending = null;
    this.#sheet = s;
  }
  #sheet = $state.raw<Sheet | null>(null);
  /** R151: a sheet asked for before its model (sheet.svelte.ts, a lazy chunk) is in: settles when it is open (or
   *  dropped). Keys pressed meanwhile wait for it (route.ts), as for a sheet whose view is not in yet (F42). */
  sheetPending: Promise<void> | null = null;
  /** Set while an app's code is loading (the view shows a short note). */
  loading = $state<AppId | null>(null);
  /** R270: Home's unentered line while an app is open (the shared Home/CAS line): put back on the line by `close`, stored by
   *  main.ts as the kept line (R34). Null: nothing set aside. */
  aside: { readonly latex: string; readonly chips: ChipTable } | null = null;
  /** R302: the line an edit on the entry line set aside (a matrix cell's, views/matrixGrid.svelte.ts), while it runs: in
   *  Home and CAS the one a hide keeps and a clear leaves (R34), as the name prompt's `aside` (R123). Null: no such edit. */
  editAside: { readonly latex: string; readonly chips: ChipTable } | null = null;
  /** A name typed in the entry line under its label (R89, a preset's name): route.ts gives it each key's action first. */
  prompt = $state.raw<EntryPrompt | null>(null);

  /** Copy, paste and share (set by App.svelte); apps reach it through AppHost.copy. */
  clip: { copyRaw(text: string | undefined, notice?: string): Promise<boolean>; say(message: string): void; pasteHeld(): void } | undefined;
  /** The Menu of Home and CAS (set by App.svelte); the apps bring their own. */
  homeMenu: (() => MenuItem[]) | undefined;
  /** Settings as a level of the sheet (set by App.svelte once the Mode code is in; R49): the ⚙ in every Menu's title
   *  row (R145) opens it as the next level. Undefined until then: the ⚙ then opens Mode › Settings (openSettings). */
  settingsMenu: (() => SubMenu | undefined) | undefined;
  /** Opens Mode › Settings (set by App.svelte): a user key that holds Settings, or the ⚙ before the Mode code is in. */
  openSettings: (() => void) | undefined;
  /** R785: an app's ☰ › Mode: the Mode sheet on Format, as the bar's chip opens it in Home and CAS (set by App.svelte). */
  openMode: (() => void) | undefined;
  /** R887: runs `then` once the Mode code (and the sheet's view) is in, loading it first when it is not (set by App.svelte). */
  withModeCode: ((then: () => void) => void) | undefined;
  /** R361: counts an app's event that is no press (set by main.ts: the press counts' event). */
  declare onEvent: ((name: string) => void) | undefined;
  /** Which of Home and CAS is under the keys (set by App.svelte); names the Menu there (R83). */
  homeView: (() => "home" | "cas") | undefined;

  readonly calc: Calc;
  readonly kv: Kv;
  readonly entry: EntryLine;
  /** The settings and the user's names (R188: the matrix sheet reads them, finder.ts showMatrix). */
  readonly settings: () => AppHost["settings"];
  readonly userNames: () => readonly UserName[];
  /** What the app last put on the entry line (to tell "edited" from "as loaded"). */
  entryBase = "";
  /** The entry line still holds Home's line (no app view has taken it yet): `showView` sets it aside, `close` gives it back. */
  homeLine = true;
  pending = new Map<AppId, Promise<LoadedApp>>();

  constructor(calc: Calc, kv: Kv, entry: EntryLine, settings: () => AppHost["settings"], userNames: () => readonly UserName[] = () => []) {
    this.calc = calc;
    this.kv = kv;
    this.entry = entry;
    this.settings = settings;
    this.userNames = userNames;
  }

  get current(): LoadedApp | undefined {
    return this.app ? this.loaded[this.app] : undefined;
  }
  get instance(): AppInstance | undefined {
    return this.current?.instance;
  }
  /** The views the open app has (the status line's tabs); all three while its code is still loading. */
  get views(): readonly ViewId[] {
    return this.instance?.views ?? VIEW_IDS;
  }
  /** The entry line belongs to the open view (undefined label = no entry line, e.g. Plot). */
  get entryLabel(): string | undefined {
    if (this.prompt) return this.prompt.label;
    const a = this.instance;
    return a ? a.entryLabel(this.view) : undefined;
  }
  get showsEntry(): boolean {
    // While an app's code loads its views are unknown: the line stays (hiding it would blur the field, and keys typed
    // meanwhile would find no focus once the app is warm and shows at once); Plot, once known, hides it.
    if (this.app !== null && !this.instance && this.loading !== null) return this.view !== "plot";
    return this.app === null || this.entryLabel !== undefined;
  }
  get entryEdited(): boolean {
    return this.entry.value !== this.entryBase;
  }

  /** R362: the app-opening part (shellOpen.ts, with the view tabs' icons), loaded by the first `open`; null until it is in. */
  code = $state.raw<ShellOpen | null>(null);
  /** Open an app at a view (default: the view it was left in, else Symb). Its part and the app's code load first. */
  open(id: AppId, view?: ViewId): Promise<void> {
    this.sheet = null;
    this.loading = id;
    this.app = id;
    return (this.opening = import("./shellOpen.ts")
      .then((m) => (this.code = m).open(this, id, view))
      .finally(() => {
        if (this.loading === id) this.loading = null;
      }));
  }
  /** Settles when the app being opened is on screen (keys pressed meanwhile wait for it). */
  opening: Promise<void> = Promise.resolve();

  /** Symb / Plot / Num key. From Home or CAS it opens the last app (Function by default). */
  async setView(v: ViewId): Promise<void> {
    this.sheet = null;
    if (this.app === null || this.loading !== null) return this.open(this.app ?? this.lastApp ?? "function", v);
    const a = this.instance;
    if (a?.views.includes(v)) this.code?.showView(this, a, v); // an instance came through the part, so it is in
  }

  /** Back to Home/CAS (the place name, U2, U3, the Apps sheet from inside an app, or Android back: R926). */
  close(): void {
    this.code?.shut(); // R926: the app's back layer
    if (this.app !== null) this.lastApp = this.app;
    this.app = null;
    this.sheet = null;
    const back = this.aside;
    this.aside = null;
    if (back) this.entry.set(back.latex, back.chips); // R270: Home's line comes back (what the app had on the line is not carried)
    // What the app put on the line (a value, a root, an equation) stays with the app; only the user's typing follows (R34, R76).
    else if (!this.entryEdited) this.entry.clear();
    this.homeLine = true;
    this.entryBase = "";
    this.save();
  }
  lastApp: AppId | null = null;

  // ---- keys routed to the app
  enter(latex: string): void {
    const a = this.instance;
    if (a) a.enter(this.view, latex);
  }
  nav(dir: NavDir): boolean {
    const a = this.instance;
    return a?.nav?.(this.view, dir, this.entryEdited) ?? false;
  }
  /** R261: Esc in an app view puts back what the app last put on the line (a slot's stored text, an unknown's value),
   *  so nothing counts as edited and ▲▼ move again. False in Home and CAS, and while the app's code loads. */
  restoreEntry(): boolean {
    if (!this.instance) return false;
    if (this.entryBase === "") this.entry.clear();
    else if (this.entry.value !== this.entryBase) this.entry.set(this.entryBase);
    return true;
  }
  /** R261: Undo on a line as the app put it goes to the app first (Symb: what Menu › Clear took). */
  undo(): boolean {
    const a = this.instance;
    return !this.entryEdited && (a?.undo?.(this.view) ?? false);
  }
  /** R145: where a ☰ sheet's ⚙ goes (and the ⚙ key over any sheet, R887): Settings as a level of the sheet (R49), else, before the
   *  Mode code is in, Mode › Settings. */
  readonly toSettings = (): SubMenu | (() => void) => this.settingsMenu?.() ?? (() => this.openSettings?.());

  // ---- sheets (docs/05 3.1)
  get switcherOpen(): boolean {
    return this.sheet?.id === "apps" || this.slotOpen;
  }
  /** R782: the Apps sheet titled "Slot 2" (a second tap on the bar's current slot-2 place) is open. */
  get slotOpen(): boolean {
    return this.sheet?.id === SLOT_SHEET;
  }
  get menuOpen(): boolean {
    return this.sheet !== null && !this.switcherOpen && !this.paletteOpen;
  }
  /** One of the palettes is open: Tmpl, or the Shift palettes `rel` and `sym` (R18). */
  get paletteOpen(): boolean {
    return this.sheet !== null && PALETTE_IDS.includes(this.sheet.id);
  }
  /** Home and CAS, the first two rows of the Apps sheet (S2 point 4, R15b): set by the app shell (App.svelte). */
  goTo: ((view: "home" | "cas") => void) | undefined;
  /** The bar's second place (R782): read from the settings and written to them by App.svelte. */
  barSlot: (() => BarSlot) | undefined;
  setBarSlot: ((slot: BarSlot) => void) | undefined;
  /** Apps key: the Apps sheet (1 Home, 2 CAS, then the apps), or close it when it is open. `slot` (R782, a second tap on the
   *  current slot-2 place): the same sheet titled "Slot 2" (shellSheets.ts appsSheet); a tap on the slot again closes it. */
  toggleApps(slot = false): void {
    const id = slot ? SLOT_SHEET : "apps";
    if (this.sheet?.id === id) this.sheet = null;
    else this.openSheet((m) => m.appsSheet(this, id, slot));
  }
  /** Menu key: the open view's menu (shellSheets.ts menuSheet), or close the open sheet. False when the view has no menu (a dead key). */
  toggleMenu(opts?: { at?: string }): boolean {
    if (this.menuOpen) {
      this.sheet = null;
      return true;
    }
    this.openSheet(
      (m) => m.menuSheet(this, opts?.at),
      // a view whose ☰ has no rows and no pointer opens Settings directly (R145)
      (sheet, m) => m.menuItems(this).length === 0 && this.picked(sheet.openSettings()),
    );
    return true;
  }
  /** Open a list of items over the view (a long press on a history row): same sheet and keys as the Menu key.
   *  `settings`: the ⚙ in its title row opens Settings (R145). */
  showMenu(title: string, items: readonly MenuItem[], opts?: { remember?: boolean; filterable?: boolean; at?: string; settings?: boolean; credits?: readonly CreditBlock[]; unc?: UncHead; loading?: () => Promise<void> | null }): void {
    this.openSheet((m) => new m.Sheet(`list:${title}`, title, () => items, { ...opts, settings: opts?.settings ? this.toSettings : undefined }));
  }
  /** Find (R4a): its categories, searched by the letters typed (Sheet id "find"; route.ts gives it docs/04 3.7's keys). */
  showFind(title: string, categories: readonly MenuItem[], search: (q: string) => readonly MenuItem[]): void {
    this.openSheet((m) => new m.Sheet("find", title, () => categories, { search, remember: false }));
  }
  /** A palette on the grid sheet: Tmpl (R10; its key closes it again), Shift + 6 `rel`, Shift + 9 `sym` (R18; the
   *  digits pick inside those, so only Esc and Cancel close them) and Shift + Vars `chars` (R725: over the view, its digits pick a cell of the focused row; Sheet reads that from the id). Each opens on its last pick. */
  togglePalette(id: PaletteId, title: string, items: () => readonly MenuItem[], columns: number): void {
    if (this.sheet?.id === id) this.sheet = null;
    else this.openSheet((m) => new m.Sheet(id, title, items, { columns }));
  }
  /** Opens the sheet `make` builds, and then runs `then` on it. Before the sheet's model is in (R151: a long press on a
   *  history row before the idle load), it loads first and `sheetPending` holds the open; a sheet set meanwhile (or
   *  none, Esc) wins. If the model does not load, nothing opens. */
  private openSheet(make: (m: SheetModel) => Sheet, then?: (sheet: Sheet, m: SheetModel) => void): void {
    const open = (m: SheetModel): void => {
      const sheet = make(m);
      this.sheet = sheet;
      then?.(sheet, m);
    };
    if (sheetChunk.model) return open(sheetChunk.model);
    const pending: Promise<void> = loadSheetModel().then(
      (m) => void (this.sheetPending === pending && open(m)),
      () => void (this.sheetPending === pending && (this.sheetPending = null)),
    );
    this.sheetPending = pending;
  }
  closeSheet(): void {
    this.sheet = null;
  }
  /** Carry out a pick of the open sheet: a chosen item closes the sheet, then runs. */
  picked(p: Picked): void {
    if (p.kind !== "run") return;
    this.sheet = null;
    p.item.run?.();
  }
  /** Pick the item numbered n (1…10) of the open sheet; false when there is no such item or it is disabled. */
  pick(n: number): boolean {
    const s = this.sheet;
    if (!s) return false;
    const depth = s.depth;
    const p = s.pickNumber(n);
    this.picked(p);
    return p.kind === "run" || s.depth !== depth;
  }
  get busy(): boolean {
    return Object.values(this.loaded).some((l) => l.instance.busy);
  }
  /** Cancel key: close an open list, else stop a running app job. False when there was nothing to stop. */
  async cancel(): Promise<boolean> {
    if (this.sheet) {
      this.sheet = null;
      return true;
    }
    if (!this.busy) return false;
    const own = Object.values(this.loaded).find((l) => l.instance.busy && l.instance.cancel);
    await (own?.instance.cancel ? own.instance.cancel() : this.calc.cancel());
    return true;
  }
  flush(): void {
    for (const l of Object.values(this.loaded)) l.instance.flush?.();
  }

  // ---- persistence
  save(): void {
    void this.kv.set("place", { app: this.app, view: this.view } satisfies Place);
  }
  /** The stored place; the app itself loads later (after the keypad), see main.ts. */
  async restorePlace(): Promise<AppId | null> {
    const p = await this.kv.get<Partial<Place>>("place");
    if (p && VIEW_IDS.includes(p.view as ViewId)) this.view = p.view as ViewId;
    if (p && isAppId(p.app)) return p.app;
    return null;
  }
}

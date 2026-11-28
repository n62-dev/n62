// SPDX-License-Identifier: GPL-3.0-or-later
// R24c: the units key (Shift + Tmpl, a flick up on Tmpl) opens the unit view in the entry line's place (docs/04 4.3,
// docs/archive/r9-unit-pad.md 2.1): the line (or a picked row's input) read-only with its slots, the pad up on the
// keys (R24b). Key owners while it is up (docs/04 5.5): an open sheet (Find on units), then the pad's cells
// (UnitPad.route), then this view for the keys that are no cell (◀ ▶ between slots, Esc leaves and the line keeps its
// slots, a key that changes place leaves first, Settings and Mode open over the view and close back onto it, R838, Store ▶
// stores the result with its unit, R353, ☰ opens its tools and Constants over it, R862, Help the active slot's units with their exact
// sizes or the units tip on an empty slot, R870 (units/slotHelp.ts); any other key is dead). A hardware key on the field takes the keypad's
// path through the entry line's own map (entry/hwkeys.ts, `onKey`), so it reaches the pad's actions or does nothing, and
// does on the field what it does on the line; R313: letters first go into the slot as a unit's symbol (units/typed.ts).
// The view writes a slot only with setPromptValue. What it takes from the start chunk is the route context `c` alone,
// so the start chunk holds only the units key's import (R24c).
// A lazy chunk: route.ts imports it on the first press of the units key. units/pad.ts is in it (a static import). R303
// (r21 item 4, tools/probes/chunk-groups.mjs restore:pad): pad.ts behind import() no longer splits the start chunk (one
// file, −19 B gzip) but costs the first open +0.4 kB gzip and a fetch more, so it stays static.
import type { MathfieldElement } from "mathlive";
import type { Key } from "../keyboard/keyboard.ts";
import { lazy, type Mods, type RouteCtx } from "../keyboard/route.ts";
import type { HistoryItem } from "../state/session.svelte.ts";
import type { FindItem } from "../find/types.ts";
import { engineFormat } from "../calc/port.ts";
import { ANS_KEY, type ChipTable } from "../input/chips.ts";
import { END } from "../input/unitFormula.ts";
import { openLayer } from "../input/backLayer.ts";
import { userValuesOf } from "../input/latex-to-giac.ts";
import { unitText } from "../i18n/enUnits.ts";
import { idbKv } from "../state/storage.ts";
import { loadSheetView } from "../views/sheetView.svelte.ts";
import { guardTaps } from "../input/tapGuard.ts";
import { alternatives, readTargets, writeTarget } from "./alternatives.ts";
import { storeChip } from "./chip.ts";
import { constUnits, slotText } from "./build.ts";
import { factorTable } from "./factors.ts";
import { userUnitCells } from "./padCells.ts";
import { UnitPad, padUnitList } from "./pad.ts";
import { unitPad, watchSheet } from "./padView.svelte.ts";
import { slotCatalogue } from "./slot.ts";
import { makePanel, type PanelCopy } from "./panel.ts";
import { ownUnits } from "./ownUnits.ts";
import { unitCells } from "./userCells.svelte.ts";
import { putRow, rowSlots, unitRow, type RowIn } from "./row.ts";
import type { ConstPick } from "./menu.ts";
import { unitTools, type UnitTool } from "./tools.ts";
import { HwTyping } from "./typed.ts";
import { SLOT_MARKS, UnitView, carry, type Shown, type ViewHost } from "./view.ts";

/** The open unit view (window.n62.unitView in the e2e). */
export interface OpenUnitView {
  readonly view: UnitView;
  readonly field: MathfieldElement;
  /** The view's own element: it holds the focus and takes the hardware keys (not editable: no system keyboard). */
  readonly element: HTMLElement;
  /** Leave; the line keeps its slots. */
  close(): void;
}

let current: OpenUnitView | null = null;
/** R917 (F371): the visit, open or still opening. It is set before the open's first wait and cleared only by its `close`, so a
 *  second units key in the open's window is a dead press, and an open that fails leaves nothing behind. */
let visit: object | null = null;

/** R917: the e2e's hooks, read on the dev server only (test/unitopen.spec.ts): `hold` holds the open at its first wait (a tap in
 *  that window), `fault` throws once the field is hidden. */
export interface UnitHooks {
  hold?: () => Promise<void>;
  fault?: () => void;
}
const hooks = (): UnitHooks | undefined => (import.meta.env.DEV ? window.n62.unitHooks : undefined);

/** The chunk of Find on units (Math in a slot, More…) with the sheet's view that draws it (R46): both loads start when
 *  the view opens, so a tap waits on no module fetch (R121 fix round 2: More… under load showed no Find within 5 s; R125
 *  fix round 1: the sheet's view, fetched only when the browser is idle, was not in yet, so the open Find was not drawn).
 *  A failed import is tried again. */
let findChunk: Promise<typeof import("./find.ts")> | null = null;
const unitFind = (): Promise<typeof import("./find.ts")> =>
  (findChunk ??= Promise.all([import("./find.ts"), loadSheetView()]).then(([m]) => m).catch((e: unknown) => {
    findChunk = null;
    throw e;
  }));

/** Store ▶'s LaTeX (Shift + ᴇ, spec/keyboard.yaml). */
const STORE_ARROW = "\\blacktriangleright";

/** Keys that change place: the unit view closes first, then they do their job. Settings and Mode are none (R838): their
 *  sheet opens over the view, which stays as it is (`unitPad.other`). */
const PLACES: readonly string[] = ["home", "cas", "switch", "apps", "slot", "symb", "plot", "num"];

/** R918: the line's writes a history row reaches (App.svelte tapped: the recall, the input at the caret, the result's chip
 *  or its drawn text). */
const ROW_WRITES = ["set", "insert", "insertRecalled", "insertResult"] as const;

/** R918: the line is lent to the view: a row put on it while the view is up is the dead press. A tap made while the view's code
 *  loaded waits for the load (R917), so it comes after the view is up as no click the view could refuse. Shadows the writes on
 *  the instance (the start chunk's EntryController stays as it is); the returned function gives them back. */
function lend(entry: RouteCtx["entry"], dead: () => void): () => void {
  const own = entry as unknown as Record<string, unknown>;
  for (const k of ROW_WRITES) own[k] = (): void => dead();
  return () => {
    for (const k of ROW_WRITES) delete own[k];
  };
}

/** Open the unit view on the line, or on a picked history row's input (it becomes the line). Dead in an app. `unit`: a unit
 *  picked from Find in Home or CAS (R893), put in the active slot as Find on units puts it, through the view's own apply. */
export async function openUnits(c: RouteCtx, row?: HistoryItem, unit?: FindItem): Promise<void> {
  const session = c.session; // (read once: the chunk is at its size pin)
  const entryEl = document.querySelector<HTMLElement>(".entry");
  const fieldEl = entryEl?.querySelector<HTMLElement>(".field");
  if (visit || c.shell.app !== null || !entryEl || !fieldEl) return c.dead();
  if (row) c.entry.set(session.input(row), row.chips); // R100: in comma mode its argument commas as `;`
  const line = c.entry.value;
  const chips = c.entry.chips;
  // R259: Ans is the view's last result (Home's or CAS's, as Enter there reads it, session.submit), read once here: the
  // view's own rows never feed it. Only the parse gets it (unread unless the line holds \ans); the Home row keeps the
  // line's chips (Ans is never stored)
  const ans = session.lastChip();
  const parseChips: ChipTable = ans ? { ...chips, [ANS_KEY]: ans } : chips;
  // R894: the result is one Home row (docs/04 4.3), so from CAS the view opens in Home, where the row shows under it and
  // after Esc. As the place key does outside an app (route.ts "switch"): the pick goes (it names a CAS row), then
  // session.setView; not App's goTo, whose shell.close clears a line not typed (a picked row's input) and is for apps
  if (session.view !== "home") {
    c.picked = null;
    session.setView("home");
  }
  const me = {};
  visit = me;
  let made: UnitView | undefined;
  let shown: HTMLElement | undefined;
  let unlayer = (): void => {};
  let untap = (): void => {};
  let unwatch = (): void => {};
  /** Leave: the one place a visit ends (R917), whether the view came up or not. The line is lent: one that changed under the
   *  view (F370: a tap while it opened) is given back as it was taken, with a warning, and the focus goes to it. */
  const close = (): void => {
    if (visit !== me) return;
    visit = null;
    current = null;
    unlayer();
    untap();
    unwatch();
    made?.keep();
    unitPad.model = null;
    unitPad.on = () => {};
    unitPad.other = undefined;
    shown?.remove();
    fieldEl.style.display = "";
    window.n62.unitView = undefined;
    if (c.entry.value !== line) {
      console.warn("R917: the line given back", c.entry.value);
      c.entry.set(line, chips);
    }
    c.entry.focus();
    // M4: a field written while hidden (a tap's text under the view) keeps MathLive's focus flag with no focus, so its focus()
    // does nothing: its own keyboard sink takes the focus
    const lineField = c.entry.field;
    if (document.activeElement !== lineField) lineField?.shadowRoot?.querySelector<HTMLElement>("[part=keyboard-sink]")?.focus();
  };
  let up = false;
  try {
    void unitFind().catch(() => undefined);
    // MathLive comes with the entry line (its field is up once `ready`): the class is taken from the element registry
    // G234: your units are Find's items in the slot too (the store is read first: the list is as it was left)
    const [, { finder, index }, hw, , , pf] = await Promise.all([
      c.entry.ready,
      Promise.all([import("../find/finder.ts"), ownUnits.restore()]).then(async ([m]) => ({ finder: m, index: m.withOwnUnits(await m.loadIndex(true), ownUnits.list()) })),
      import("../entry/hwkeys.ts"),
      unitCells.restore(),
      hooks()?.hold?.(),
      unit && unitFind(),
    ]);
    const Field = customElements.get("math-field") as typeof MathfieldElement | undefined;
    if (!Field) return c.dead();
    // R63: a picked unit row shows its slots again. Only the picked row: a line typed again (after a relaunch too) is a
    // new request, so its slots start empty and the keys typed into them are the whole unit (72 km/h, not km/h km/h)
    const seed = row ? rowSlots(row) : undefined;
    /** The Home row of this visit's result (R63): a later result takes its place. */
    let rowId: number | undefined;
    /** R838: the angle unit and the digits as one text ("rad12"), those of the last request in `was` (the engine's facts, σ's
     *  text and the Home row take the digits, units/evaluate.ts): a change of either asks again. R915: `job` is that request's
     *  angle and Giac text, for its row (the angle tag, units/row.ts); only the last request's result is shown (view.ts). */
    const asked = (): string => session.settings.angle + session.settings.digits;
    let was = asked();
    let job: RowIn["job"];
    const mf = new Field();
    mf.dataset["testid"] = "unit-field";
    const host: ViewHost = {
      write: (id, latex) => mf.setPromptValue(id, latex, {}),
      evaluate: (req) => {
        was = asked();
        job = { angle: session.settings.angle, formula: req.formula };
        return c.shell.calc.units(req, session.settings);
      },
      find: (into, dim) =>
        void unitFind().then((m) => {
          if (current?.view !== view) return;
          const more = dim === undefined ? { constant, tools: tools() } : {};
          m.showUnitFind({ shell: c.shell, index, cat, apply: dim === undefined ? (a) => view.apply(a) : (a) => view.pickMore(a), refresh: () => (unitPad.model = new UnitPad(unitCells.userSet())), ...more }, into, dim);
        }),
      format: () => {
        const s = session.settings;
        return { format: engineFormat(s.format), digits: s.digits, decimalComma: session.decimalComma, grouped: true, groupSep: s.groupSep, round: s.uncertainty === "round" };
      },
      alternatives: async (q, req) => {
        const target = q.dimension ? (await readTargets(idbKv))[q.dimension] : undefined;
        return alternatives(q, { table, pad: padUnitList(), user: userUnitCells(unitCells.userSet()), req, ...(target ? { target } : {}) });
      },
      remember: (dim, slot) => writeTarget(idbKv, dim, slot).then(() => undefined),
      dead: () => c.dead(),
      values: () => userValuesOf(session.userNames),
      changed: () => panel.draw(),
      reset: (latex, ids) => lockedValue(mf, latex, ids),
      constUnit: (id) => constUnits({ formula: "", slots: [], consts: [id] }, table)[0]?.text, // R929
      result: (q) => void (rowId = putRow(session, unitRow({ line, chips, q, slots: view.filled(), input: view.drawn(), digits: session.settings.digits, job }), rowId)),
    };
    /** R92: a constant from the units menu goes on Home's line at its cursor (Find's own pick path); the view leaves
     *  keeping its slots, they go with the new line text, and the view opens again on it. */
    const constant = (k: ConstPick): void => {
      if (current?.view !== view) return;
      close();
      if ("item" in k) finder.putOnLine(c.entry, k.item);
      else c.entry.run({ kind: "insert", latex: k.latex });
      carry(view.line, c.entry.value);
      lazy(c, openUnits(c)); // (the keys pressed while it opens wait for it, R8)
    };
    /** R92: Tools › the number into Home: the view leaves, the result goes on the line as Home's chip (the way back). */
    const home = (): void => {
      const item = rowId === undefined ? undefined : session.home.find((r) => r.id === rowId);
      if (!item || current?.view !== view) return c.dead();
      close();
      c.insertResult(item);
    };
    /** R92: the Tools rows as the view stands, for Find on units and ☰ (R862). */
    const tools = (): UnitTool[] => unitTools(view.shown, { end: () => view.toEnd(), alt: (a) => void view.pickAlt(a), alts: () => view.down(), home, store, storeRefused });
    /** R353: the result's row (this visit's, while a result is shown) and the reason a store of it is refused. */
    const resultRow = (): HistoryItem | undefined =>
      rowId === undefined || view.shown.kind !== "result" ? undefined : session.home.find((r) => r.id === rowId && r.status === "done");
    const storeRefused = (): string | undefined => {
      const item = resultRow();
      // R915 (F376): a result is shown but its Home row was deleted (a swipe, Delete): say so, not "Eval first"
      if (!item) return unitText(rowId !== undefined && view.shown.kind === "result" ? "units.store.rowGone" : "units.store.first");
      return storeChip(session.chipFor(item), item.units?.unit ?? "", item.units?.unc) ? undefined : unitText("units.store.noUnit");
    };
    /** R353: the refusal of the last Store ▶, shown while what it was pressed on stands. */
    let said: { on: Shown; text: string } | undefined;
    /** R353: Store ▶ (Shift + ᴇ, the button beside the result, Tools › Store in a name): the view leaves, the result's chip
     *  goes on Home's line alone (the line was the request, which the row keeps) and "Store in" opens on its row, the row
     *  bar's Store ▶ path (clipboard/actions.svelte.ts storeRow, App openStore): the one store path, which keeps the unit
     *  and σ in the name (G371). No result, or a chip without the unit or σ shown: dead, with the reason. */
    const store = (): void => {
      if (current?.view !== view) return c.dead();
      const why = storeRefused();
      const item = resultRow();
      if (why !== undefined || !item) {
        said = { on: view.shown, text: why ?? unitText("units.store.first") };
        panel.draw();
        return c.dead();
      }
      close();
      c.entry.clear();
      c.withClip((x) => void (x.storeRow(item) || c.dead()));
    };
    /** R797: a hold on the result, and the Copy key (Shift + Select) in the view: what a hold on its Home row copies
     *  (clipboard/actions.svelte.ts holdCopy); no result shown, or its row deleted: the dead press. */
    const copyResult = (): void => {
      const item = current?.view === view ? resultRow() : undefined;
      if (!item) return c.dead();
      c.withClip((x) => void x.holdCopy(item, "result", ""));
    };
    /** R797: a slot's unit as the app writes it (slotText: `km/h`, `kg·m/s²`, what Copy writes and Paste reads, R325);
     *  none for an empty slot or one that is not complete (a prefix or √ armed alone, a ÷ with nothing after it). */
    const unitOf = (id: string | undefined): string | undefined => {
      const m = id === undefined ? undefined : view.model(id);
      if (!m || m.empty || !m.check().ok || !m.slot.tokens.length) return undefined;
      return slotText(m.slot, table) || undefined;
    };
    /** R797: a hold in the panel copies, named in the notice: the reading the active slot's unit, a slot's box that slot's
     *  (found as a tap finds it, R801; the active slot stays), a message its text, the result its Home row's string. */
    const copy = (w: PanelCopy): void => {
      if (current?.view !== view) return;
      if (w.on === "result") return copyResult();
      const text = w.on === "message" ? w.text : unitOf(w.on === "reading" ? view.activeId : slotAt(mf, view.ids, w.x, w.y));
      if (!text) return c.dead();
      c.withClip((x) => void x.copyText(text));
    };
    const panel = makePanel(() => made, () => session.settings.marks, { run: store, said: () => (said && made?.shown === said.on ? said.text : undefined) }, copy);
    const cat = slotCatalogue(index.items);
    const table = factorTable(index.items);
    const view = new UnitView(cat, line, parseChips, host, seed);
    made = view;
    entryEl.insertBefore((shown = panel.element), fieldEl);
    fieldEl.style.display = "none";
    hooks()?.fault?.();
    panel.draw();
    // MathLive takes options only once the field is mounted (as the entry line's, entry/controller.ts)
    const mounted = new Promise<void>((resolve) => {
      mf.addEventListener("mount", () => resolve(), { once: true });
      setTimeout(resolve, 1000);
    });
    const element = panel.element;
    panel.formula.append(mf);
    await mounted;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    mf.shadowRoot?.append(Object.assign(document.createElement("style"), { textContent: SLOT_MARKS })); // R807
    setUp(mf, element, c, hw, new HwTyping(view));
    lockedValue(mf, view.fieldLatex, view.ids);
    view.start();
    if (unit && pf) for (const a of pf.pickActions(cat, unit)) view.apply(a);

    /** R700: Android back is Esc for the view (docs/05 3.7): out of the alternatives row, else it leaves; each back takes a new entry for what is left. */
    const layer = (): void => {
      unlayer = openLayer(() => {
        unlayer = () => {};
        if (view.escape()) layer();
        else close();
      });
    };
    current = { view, field: mf, element, close };
    layer();
    window.n62.unitView = current;
    // every press keeps the focus on the view (as the entry line's keys keep it on the line), for the hardware keys
    const keep = (): void => element.focus({ preventScroll: true });
    /** R801: a tap on the screen while the view is up (no sheet over it): on a slot's box it makes that slot the active one
     *  (refused as ◀ ▶ is, view.goTo); wherever it lands the focus comes back to the view, so the next hardware key goes
     *  to the view. A hold copies (R797, `copy`) and makes no slot active. R918: outside the view's box (the entry's) a tap is the dead
     *  press (input/tapGuard.ts, shared with a name prompt, R921f1): no pick, no row bar, nothing on the lent line. */
    const unguard = guardTaps(entryEl, () => c.dead(), () => current?.view === view && c.shell.sheet === null, (ev, refused, wasHeld) => {
      if (!refused && !wasHeld && ev.composedPath().includes(mf)) {
        const id = slotAt(mf, view.ids, ev.clientX, ev.clientY);
        if (id !== undefined) view.goTo(id);
      }
      keep();
      setTimeout(() => current?.view === view && c.shell.sheet === null && keep(), 0); // (MathLive moves the focus on its own pointer events)
    });
    const unlend = lend(c.entry, () => c.dead());
    c.picked = null; // R918: a row picked while the view's code loaded (a pick waits for no load) does not stay under it
    untap = () => {
      unguard();
      unlend();
    };
    /** R838: a sheet over the view (Settings, Mode, Find on units) took the keys; once it is gone the focus is the view's again
     *  and a setting changed there shows. R915: the angle unit or the digits changed, whoever changed them (the bar's angle word
     *  too, at once, a sheet still open or not): a result shown or being asked for is asked for again as the line would be (the
     *  digits are in the engine's answer, σ's text and the Home row too); a setting the result is only drawn with (the format,
     *  the decimal mark, the digit groups, the marks) draws it again with no request. The focus comes back once no sheet is up. */
    unwatch = watchSheet(c.shell, asked, () => {
      if (current?.view !== view) return;
      if (was !== asked() && (view.shown.kind === "result" || view.shown.kind === "working")) void view.evaluate();
      else view.redraw();
      panel.draw();
      if (c.shell.sheet === null) keep();
    });
    unitPad.on = (e) => {
      view.apply(e);
      if (current?.view === view && e.do !== "find") keep();
    };
    unitPad.other = (c2, key, mods) => {
      const a = layerAction(key, mods);
      // a sheet over the view takes the keys, as over the cells (UnitPad.route); R838: Settings and Mode do their job, over the view
      if (c2.shell.sheet || (a?.kind === "special" && (a.name === "settings" || a.name === "mode"))) return false;
      if (a?.kind === "special" && PLACES.includes(a.name)) {
        close();
        return false; // the key does its job
      }
      c2.session.clearModifiers();
      const cmd = a?.kind === "cmd" ? a.name : undefined;
      const sp = a?.kind === "special" ? a.name : undefined;
      if (cmd === "moveToPreviousChar") view.move(-1);
      else if (cmd === "moveToNextChar") view.move(1);
      else if (cmd === "moveDown") view.arrowDown();
      else if (cmd === "moveUp") view.arrowUp();
      else if (sp === "esc") {
        if (!view.escape()) close();
      }
      else if (sp === "clear") view.clear(); // R896
      else if (cmd === "undo") view.undoBy(-1);
      else if (cmd === "redo") view.undoBy(1);
      else if (a?.kind === "insert" && a.latex === STORE_ARROW) store();
      else if (sp === "paste") refusePaste(c2);
      else if (sp === "copy") copyResult(); // R797: Shift + Select, as a hold on the result
      else if (sp === "menu") {
        // R862: the view's tools and Constants over it (a second ☰, Esc or Back closes the sheet: sheetKeys.ts, watchSheet)
        void unitFind().then((m) => current?.view === view && c2.shell.sheet === null && m.showUnitMenu(c2.shell, index, tools(), constant), () => c2.dead());
      }
      else if (sp === "help") {
        // R870: the active slot's units with their exact sizes, or the units tip, as a sheet over the view (R838's path; Esc, Back, ×
        // or a second Help close it: sheetKeys.ts, watchSheet). A chunk of its own, and for an empty slot the tip from the tips' chunk
        // (views/tipsHost.ts); the keys pressed while they load wait for them
        const id = view.activeId;
        lazy(c2, import("./slotHelp.ts").then(async (h) => {
          const m = view.model(id);
          const tip = m && h.wantsTip(m) ? (await import("../views/tipsHost.ts")).tipsText("tips.units") : undefined;
          if (m && current?.view === view && c2.shell.sheet === null) h.showSlotHelp(c2.shell, h.slotHelp(m, id === END, { byId: index.byId, cat, table, tip }));
          else c2.dead();
        }));
      }
      else if (sp === "uncertainty") {
        const row = rowId === undefined ? undefined : c2.session.home.find((r) => r.id === rowId); // R327: the result's row
        lazy(c2, import("../views/uncSheet.ts").then((m) => m.showUncertainty(c2, row)));
      }
      else c2.dead();
      if (current?.view === view) keep();
      return true;
    };
    unitPad.model = new UnitPad(unitCells.userSet());
    element.focus();
    up = true;
  } finally {
    if (!up) close(); // (an open that failed or ended early leaves nothing behind: lazy makes it a dead press)
  }
}

/** R801: the slot whose box holds the point, or none. The box is found by geometry (MathLive draws one `.ML__prompt` box per
 *  prompt) but its slot by the model, never by the order of the boxes in the shadow DOM: a stacked layout (a fraction)
 *  draws its boxes bottom to top. The offset MathLive gives at the box's centre lies in the prompt's range or just after
 *  its atom (probe, R801: [start, end + 1]); the slot whose window is nearest to it is the box's. */
function slotAt(mf: MathfieldElement, ids: readonly string[], x: number, y: number): string | undefined {
  const box = [...(mf.shadowRoot?.querySelectorAll(".ML__prompt") ?? [])]
    .map((b) => b.getBoundingClientRect())
    .find((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
  const at = box ? mf.getOffsetFromPoint(box.left + box.width / 2, box.top + box.height / 2) : -1;
  const gap = (id: string): number => {
    const r = mf.getPromptRange(id);
    return r ? Math.max(r[0] - at, at - r[1] - 1, 0) : Infinity;
  };
  return at < 0 ? undefined : ids.reduce((a, b) => (gap(b) < gap(a) ? b : a));
}

/** The field's value with its prompts locked: MathLive edits no prompt itself (a tap on it still moves the focus onto the
 *  field, and a tap makes a slot the active one through `slotAt`, R801); setPromptValue still writes. Set once at the start and again when the end slot goes on or off (R349). */
function lockedValue(mf: MathfieldElement, latex: string, ids: readonly string[]): void {
  mf.value = latex;
  for (const id of ids) mf.setPromptState(id, "undefined", true);
}

/** The action of a key that is no cell, in the layer it was pressed in (keyboard.ts actionFor, for the keys the view
 *  reads: ◀ ▶, Esc and the place keys; Alpha falls back to the tap). */
function layerAction(key: Key, mods: Mods): Key["actions"]["primary"] {
  return mods.alpha ? (key.actions.alpha ?? key.actions.primary) : mods.shift ? key.actions.shift : key.actions.primary;
}

/** R895: Paste (the key, a system paste) has no place in the view: the notice says why, the view stays. */
const refusePaste = (c: RouteCtx): void => c.withClip((x) => x.refusePaste());

/** The field: read-only, never MathLive's keyboard nor the system keyboard (inputmode none, as the entry line), with
 *  the entry line's macros (chips, ᴇ). The view's element holds the focus (tabindex -1, nothing editable in it, so no system
 *  keyboard) and its capture keydown gives a hardware key to the view's typing (R313, units/typed.ts: letters into the
 *  slot) and else down the keypad's path (entry/hwkeys.ts unitViewKey), from the field too; a paste (with the notice why, R895), a drop,
 *  a cut and the browser's own text input (an IME) are stopped. MathLive's own beforeinput for setPromptValue is not
 *  trusted and goes through (cancelling it would cancel the write). */
function setUp(mf: MathfieldElement, element: HTMLElement, c: RouteCtx, hw: Hw, typing: HwTyping): void {
  mf.mathVirtualKeyboardPolicy = "manual";
  mf.menuItems = [];
  mf.inlineShortcuts = {};
  mf.macros = c.entry.field?.macros ?? mf.macros; // the entry line's, with ENTRY_MACROS (it is up: entry.ready)
  mf.readOnly = true;
  const enforce = (): void => {
    for (const el of mf.shadowRoot?.querySelectorAll("[inputmode], textarea") ?? []) {
      el.setAttribute("inputmode", "none");
      el.setAttribute("virtualkeyboardpolicy", "manual");
    }
  };
  enforce();
  mf.addEventListener("focusin", enforce);
  element.addEventListener("keydown", (ev) => {
    // R313: with no sheet open the view's own typing looks first (letters into the slot, `^2`), then the keypad's path
    if (c.shell.sheet === null && typing.key(ev)) {
      ev.preventDefault();
      ev.stopPropagation();
    } else hw.unitViewKey(ev, c.entry, c.shell.sheet !== null, (paste) => (paste ? refusePaste(c) : c.dead())); // (R303: in hwkeys.ts)
  }, { capture: true });
  const stop = (ev: Event): void => {
    if (ev.type === "beforeinput" && !ev.isTrusted) return;
    if (ev.type === "paste") refusePaste(c); // R895: stopped with its reason
    ev.preventDefault();
    ev.stopPropagation();
  };
  for (const type of ["paste", "drop", "cut", "beforeinput"]) element.addEventListener(type, stop, { capture: true });
}

type Hw = typeof import("../entry/hwkeys.ts");

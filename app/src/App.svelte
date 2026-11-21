<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import { onMount } from "svelte";
  import { idle } from "./idle.ts";
  import type { AppShell, PaletteId } from "./apps/shell.svelte.ts";
  import type { SubMenu } from "./apps/types.ts";
  import type { ClipActions } from "./clipboard/actions.svelte.ts";
  import type { RowBarView } from "./appLoaders.ts";
  import type { EntryController } from "./entry/controller.ts";
  import { t } from "./i18n/index.ts";
  import { openLayer } from "./input/backLayerFront.ts";
  import { loadClick, vibrate } from "./input/haptics.ts";
  import Keypad from "./keyboard/Keypad.svelte";
  import { loadShiftPalettes, shiftPalettes } from "./keyboard/palettes.ts";
  import { keyboard, type Key, type Layer } from "./keyboard/keyboard.ts";
  import * as route from "./keyboard/route.ts";
  import type { RouteCtx } from "./keyboard/route.ts";
  import { creditsAsked } from "./entry/credits.ts";
  import { ringState } from "./entry/ringState.ts";
  import { tooLongToInsert, tooLongToInsertNote } from "./render/longResult.ts";
  import type { UserKeys } from "./keyboard/userKeys.svelte.ts";
  import { noDigit } from "./state/displayMode.ts";
  import type { HistoryItem, Session, View } from "./state/session.svelte.ts";
  import { counted } from "./state/tapsFront.svelte.ts";
  import { createLoaders, type FindCode, type ModeSheetCode } from "./appLoaders.ts";
  import { tipsDue } from "./state/tips.ts";
  import { updateOffer } from "./state/updateOffer.svelte.ts";
  import History from "./views/History.svelte";
  import StatusLine from "./views/StatusLine.svelte";
  import { hw, watchHw } from "./input/hwSeen.svelte.ts";
  import { WIDE_QUERY } from "./views/wide.ts";
  /** Set while the first Mode or Settings open waits for that code. */
  let sheetLoad: Promise<void> | null = null;
  // The sheet's view (Sheet.svelte with sheetFit.ts) is its own chunk, fetched when idle after the keypad is drawn (R46);
  // the model and the keys stay here. A key that opens a sheet before it is in waits in the queue.
  import { loadSheetView, sheetChunk } from "./views/sheetView.svelte.ts";

  let { session, entry, shell, userKeys }: { session: Session; entry: EntryController; shell: AppShell; userKeys: UserKeys } = $props();

  // The lazy code (appLoaders.ts, R97): the Mode lists, Find with its index, and copy, paste and share. None is in the start chunk.
  let clip = $state.raw<ClipActions | undefined>();
  /** The picked row's buttons (views/RowBar.svelte), loaded with the clipboard code (R147: not in the start chunk). */
  let rowBar = $state.raw<RowBarView | undefined>();
  // svelte-ignore state_referenced_locally (main.ts mounts App once with these three objects; none is ever replaced)
  const loaders = createLoaders({
    session,
    shell,
    entry,
    busy: () => busy,
    insertResult: (item, whole, stay) => onLine(item, false, false, whole, stay), // (the Menu's list counts its own)
    acted: (id) => void (folded && countUse(id)), // R53: each row action while folded (P16's removal test), before it runs
    hold: (job) => void route.holdKeys(ctx, job),
    stored: (item) => openStore(item),
    onClip: (c, bar) => {
      rowBar = bar;
      clip = c;
    },
  });
  const { loadModeSheet, loadFind, loadClip } = loaders;

  // R15c4: the first-start tips, a lazy chunk (views/tipsHost.ts) shown once on a fresh profile and again from Settings › Help and about.
  const showTips = (): void => void import("./views/tipsHost.ts").then((m) => m.showTips(), () => {});
  // R266: the first start's tips wait for no press in this start (R8: a typed key is never taken by the overlay); asked once the counter is in (R320), again once the chunk is
  const firstTips = (): void => void session.taps.load().then((c) => void (c && !c.pressedThisStart && import("./views/tipsHost.ts").then((m) => session.taps.pressedThisStart || m.showTips(), () => {})), () => {});

  const sheetOpen = $derived(shell.sheet !== null);
  $effect(() => entry.setNames(session.userNames)); // R33: the stored names are drawn in their colour on the line
  $effect(() => void (userKeys.decimalComma = entry.decimalComma = session.decimalComma)); // R57: the `.` and `,` keys' faces (keypad, tap, hardware key)

  // The shell paints first; main.ts then loads MathLive, which puts the field into this element.
  onMount(() => {
    if (host) entry.setHost(host);
    const mq = matchMedia(WIDE_QUERY); // R224: a rotation or a resized window turns the wide layout on or off
    wide = mq.matches;
    mq.onchange = (e) => (wide = e.matches);
    // R70, R107: a hardware key (`<` `>` `!` and a dead one too) and a tap are presses (docs/04 5.2)
    const hwOther = (kind: Parameters<typeof session.taps.hw>[0]) => (): void => session.taps.hw(kind); // a hardware key that runs no keypad key: the counter's chunk names it "hw:<kind>" (state/pressCount.ts hwKind)
    // R31 (F27): a hardware keyboard's printable keys are taps of the keypad key with that character, counted
    // "<key id>:hw" (R127); Enter and Escape too (R45: Enter is the Enter key, a picked row's or an open sheet's, not a
    // bare submit; R15c2: Escape is the Esc key; R131: both through this hook, entry/controller.ts)
    entry.onKey = counted((...[id]: [string, Layer]) => session.taps.press(`${id}:hw`), (id: string, layer: Layer) => {
      const key = keyboard.byId.get(id);
      if (key) press(userKeys.resolve(key), layer);
    });
    // R131: a desktop key the table adds (hwkeys.ts resolves it): its key, else the fold (a dead press in an app or a sheet)
    entry.onDesk = counted((...[as]: [string, Key?, Layer?]) => session.taps.press(as), (_: string, key?: Key, layer?: Layer) =>
      key ? press(userKeys.resolve(key), layer) : unfold() || (canFold && !shell.sheet ? fold("fold.hw") : dead()));
    entry.onLetter = counted(hwOther("letter"), typeLetter);
    shell.goTo = goTo; // the Apps sheet's Home and CAS rows
    shell.barSlot = () => session.settings.barSlot; // R782: slot 2's sheet marks the place it holds
    shell.setBarSlot = (slot) => {
      session.settings.barSlot = slot;
      session.save();
    };
    shell.openSettings = openSettings;
    shell.openMode = () => openMode("format"); // R785: an app's ☰ › Mode opens as the chip does
    shell.settingsMenu = () => (loaders.modeSheet ? (settingsMenu ??= loaders.modeSheet.settingsMenu(session, settingsEnv)) : undefined); // (R49)
    shell.homeView = () => (session.view === "cas" ? "cas" : "home"); // the last row of every Menu
    entry.onSymbol = counted(hwOther("symbol"), (ch) => {
      edited = true;
      picked = null; // a key that types drops the pick (R147: its buttons may lie over the line)
      entry.run({ kind: "insert", latex: ch });
    });
    entry.onEdit = () => (edited = true); // R154: MathLive's own typing (é, µ, π), a row menu's recall or insert
    entry.onDead = counted(hwOther("dead"), dead);
    entry.onPress = counted(hwOther("other"), () => {}); // R107f1: a leaving ) or | is a press that needs nothing more
    entry.onPaste = (text) => {
      edited = true;
      picked = null; // a paste types too: it drops the pick (R147), so its buttons never cover the pasted text
      route.pasteText(ctx, text); // R114: Ctrl+V and every system paste take ☰ → Paste's path
    };
    const loadFold = (): void => {
      void import("./keyboard/Fold.svelte").then((m) => (Fold = m.default), () => {}), session.taps.load(); // R53, R724; R320: the press counters (presses wait in the session's front)
      void import("./views/browserNote.ts").then((m) => m.browserNote(), () => {}); // R285: a browser that has not passed says so once (the chunk decides)
    };
    idle(loadFold, 1500, 300);
    // the first start (R15c4): once the keypad is drawn and the browser is idle, so the tips never compete with the start
    void tipsDue(location.search).then((due) => due && idle(firstTips, 2000, 500));
    const stopTaps = session.taps.listen(), stopHw = watchHw(); // R783: a hardware keyboard in use brings the ⇧ α badge back
    return () => (stopTaps(), stopHw());
  });
  /** R284: the failure note's words (views/EngineFailed.svelte), fetched once the engine has failed. The Reload button is
   *  not in it: the chunk goes over the network that may be the cause, and the way on must not depend on it. */
  let EngineFailed = $state.raw<typeof import("./views/EngineFailed.svelte").default | undefined>();
  let UpdateNote = $state.raw<typeof import("./views/UpdateNote.svelte").default | null>(null); // A49: Restart, a lazy chunk (R97), in the stage (R722)
  $effect(() => void (updateOffer.restart && !UpdateNote && import("./views/UpdateNote.svelte").then((m) => (UpdateNote = m.default), () => {})));
  $effect(() => void (session.engineState === "failed" && import("./views/EngineFailed.svelte").then((m) => (EngineFailed = m.default), () => {})));
  let host: HTMLElement | undefined = $state();
  let entryHeight = $state(0);

  /** Run now when loaded, else as soon as the code has arrived (a key pressed before the idle load), with the keys
   *  meanwhile in the queue (decisions.md R8). The Mode code comes too: every Menu's last row is Settings, its submenu (R49). */
  function withClip(run: (c: ClipActions) => void | Promise<void>): void {
    if (clip && loaders.modeSheet) return void run(clip);
    const load = Promise.all([loadClip(), loadModeSheet().catch(() => null)]).then(([c]) => run(c));
    if (sheetLoad === null) sheetLoad = load.catch(() => {}).finally(() => (sheetLoad = null));
  }
  $effect(() => {
    // (a browser without requestIdleCallback loads it on the first use)
    if (session.engineState === "ready" && "requestIdleCallback" in window) requestIdleCallback(() => void loadClip(), { timeout: 3000 });
  });
  $effect(() => {
    if (session.engineState !== "ready" || !("requestIdleCallback" in window) || loaders.findLoading) return;
    // not while a job runs (its Working… timing, working.spec.ts); this runs again when it ends
    if (!busy) requestIdleCallback(() => void loadFind().catch(() => {}), { timeout: 5000 }); // the first Math press tries again
  });

  /** Home/CAS: the entry line is cleared as soon as the job starts; the result arrives in the history. Apps decide themselves. */
  function enter(): void {
    if (shell.app !== null) {
      shell.enter(entry.value);
      return;
    }
    const credits = creditsAsked(entry.value, session.userNames, entry.chips); // R149: N62 then Enter shows the credits sheet (a lazy chunk with the About data, reached through the Find chunk), submits nothing
    const typedIn = entry.recalledIn !== null && entry.recalledIn !== session.settings.angle ? entry.recalledIn : undefined; // R265: an unchanged recall of a row typed in the other mode
    if (credits || session.submit(entry.value, undefined, entry.chips, typedIn)) {
      entry.clear();
      edited = false; // the line is empty again: an error outline (ringState) stays until the next key
      if (credits) openCredits();
    }
  }
  /** The credits sheet (a lazy chunk with the About data, reached through the Find chunk): N62 then Enter, and a tap on the empty history's faint mark (R157). */
  function openCredits(): void {
    onFind(finder().then((f) => f.loadCredits()), (m) => { picked = null; m.showCredits(shell); });
  }

  /** R154: a key was pressed or the line edited since the last Enter (an error outline lasts until then). Enter itself
   *  counts, and enter() above takes it back when the line was submitted. */
  let edited = $state(true); // (true at the start: only an Enter that sent a line clears it)
  /** What the entry field's outline says (entry/ringState.ts): the layer armed, or the error of the last Enter. */
  const ring = $derived(
    ringState({
      shift: session.shift,
      alpha: session.alpha,
      view: shell.app === null ? session.view : "app",
      newest: session.items.at(-1)?.status,
      editedSinceEnter: edited,
    }),
  );

  /** L5 and docs/04 2.8: a tapped or picked result goes on the line as a chip that carries its full value; R746: an exact
   *  result drawn as its exact value (`=`, or CAS's own unmarked maths) with a fraction, root, power or matrix goes as that
   *  maths, editable, one term (render/exactMaths.ts, entry/oneTerm.ts; decided as it goes on the field). */
  function insertResult(item: HistoryItem, whole = false): void {
    // R184: linreg and stats1 ask which value (clipboard/actions.svelte.ts, lazy); an answer with no such list goes in whole
    if (!whole && /linreg|stats1/.test(item.latex)) return withClip((c) => c.showStats(item).catch(() => false).then((ok) => void (ok || insertResult(item, true))));
    // a result with no confirmed digit goes on the line as the bare warning mark, never as its unconfirmed number
    const chip = session.chipFor(item);
    // a unit row with no chip (R63f1): Home's number alone, never its σ or unit (Home has no units); its chip shows both
    const { units, ...number } = item;
    const mark = session.mark(item);
    const shown = noDigit(mark) ? "⚠" : session.display(units && !chip ? number : item).latex;
    if (chip) entry.insertResult(shown, chip, !!chip.exact && !chip.unc && !units && (mark ? mark.mark === "=" : item.view === "cas"));
    else if (tooLongToInsert(shown, false)) withClip((c) => c.say(tooLongToInsertNote())); // R135f2: too long to draw, so to insert
    else entry.insert(shown, true); // too long for a chip: as drawn (render/insertable.ts), one term
  }

  /** Home or CAS, from anywhere (an app too). */
  function goTo(view: View): void {
    picked = null;
    shell.close();
    session.setView(view);
  }

  function clearKey(): void {
    if (shell.app === null && entry.empty) void session.clearHistory(); // R255: a queued line or a kept one still to come is not empty
    else entry.clear();
  }

  /** Run `open` with the palettes' chunk (loaded with MathLive): at once when it is in, else after the load, with every key
   *  meanwhile in the queue (decisions.md R8). If the chunk does not load, the queued keys run without the sheet. */
  function withPalettes(open: (m: NonNullable<typeof shiftPalettes>) => void): void {
    if (shiftPalettes) return open(shiftPalettes);
    sheetLoad = loadShiftPalettes().then(open, () => {}).finally(() => (sheetLoad = null));
  }
  /** Tmpl (R10), Shift + 6 (relations and logic), Shift + 9 (symbols and Greek, R18) and Shift + Vars (Chars, R725): a palette on
   *  the grid sheet; a pick inserts its cell as its key would. A view without an entry line (Plot) has nothing to insert into. The palettes (Tmpl too, R91) come in their own chunk, loaded with MathLive, and the sheet's view in its own
   *  (R91: its `palette` code opens the palette, R725: the pick too); until then the key waits for them in the queue. */
  function openShiftPalette(id: PaletteId): void {
    withPalettes((m) => {
      const cells = sheetChunk.palette;
      if (!cells) return void loadSheetView().then(() => openShiftPalette(id), dead);
      cells.openPalette({ shell, entry, session, dead, say: (t) => withClip((c) => c.say(t)), reset: () => (picked = null) }, id, m);
    });
  }
  /** Math (R4a): Find (find/finder.ts). Until its code and the index are in, every key waits in the queue (decisions.md
   *  R8). No entry line, nothing to insert into. `slot` (R4b, Settings › Your keys): a pick sets that free key's slot. */
  function openFind(slot?: FindSlot): void {
    if (!slot && !shell.showsEntry) return dead();
    if (loaders.findCode && sheetChunk.C) return showFind(loaders.findCode, slot);
    onFind(findNow(), (f) => showFind(f, slot));
  }
  /** Find's code and index now (Math, Help): an idle load under way is hurried. */
  function findNow(): Promise<FindCode> {
    if (loaders.findLoading) void finder().then((m) => m.loadIndex(true)).catch(() => {}); // hurry the idle load
    return loadFind(true);
  }
  /** Help (R197; the Help key since R723): the help sheet of the function at the cursor (views/helpSheet.ts); none there: Find. */
  function openHelp(): void {
    if (!shell.showsEntry) return dead();
    onFind(findNow().then(async (f) => ((await f.m.showHelpAt(shell, entry, f.index.byId)) ? null : f)), (f) => f && showFind(f)); // (the route dropped a pick)
  }
  /** Shift + 4 (R187): the matrix sheet; its rows are Find's items, so it waits for the index as Help does. */
  function openMatrix(): void {
    if (!shell.showsEntry) return dead();
    onFind(findNow(), (f) => { picked = null; f.m.showMatrix(ctx, f.index); });
  }
  type FindSlot = { id: string; layer: Layer };
  const showFind = (f: FindCode, slot?: FindSlot): void => { picked = null; f.m.showFind(shell, entry, f.index, slot && { ...slot, userKeys }); };
  /** Vars and Shift + Math (R4b): Find on the user's variables and functions, or Memory (the code only, not the index). */
  function openNames(memory: boolean): void {
    if (!memory && !shell.showsEntry) return dead();
    onFind(finder(), (m) => { picked = null; m.showNames(shell, entry, session, memory); });
  }
  /** Store ▶ in Home or CAS (R281): "Store in" (views/storeSheet.svelte.ts, in Vars' chunk); `row`: the result on the line (none: the line, R301). */
  function openStore(row?: HistoryItem): void {
    if (shell.app !== null) return;
    const store = (latex: string): void => { entry.insert(latex); route.enterLine(ctx); }; // the name after ▶, then Enter: the one store path (R298: before the field, Enter waits for it)
    onFind(finder(), (m) => { picked = null; m.showStore({ shell, session, store, folded: () => folded, newName: () => { countUse("store.new"); unfold(); } }, m.storedText(session, row, entry.value)); });
  }
  const finder = (): Promise<typeof import("./find/finder.ts")> => import("./find/finder.ts"); // (one import() site: each carries its own preload list)
  function onFind<T>(load: Promise<T>, show: (t: T) => void): void {
    sheetLoad = Promise.all([load, loadSheetView()]).then(([t]) => { sheetLoad = null; show(t); }, () => { sheetLoad = null; dead(); }); // (a load that fails: the queued keys run without the sheet)
  }
  /** What Settings › Your keys needs (R4b): the slots, and Find to pick a slot's content from. */
  // svelte-ignore state_referenced_locally (main.ts mounts App once; shell and entry are never replaced)
  const settingsEnv = { get userKeys() { return userKeys; }, shell, entry,
    alpha: (on: boolean): void => { session.releaseModifiers(); if (on) session.flickAlphaLock(!casKeys); }, // R776: a name prompt types lower case (CAS: Alpha alone, Home: Shift + Alpha, R58)
    tips: showTips, chooseFor: (id: string, layer: Layer): void => openFind({ id, layer }), data: withClip }; // data: Settings › Data (R38a, R38b; as a hold on a history row: waits for the clipboard and Mode code if the sheet opened before they came; no import of its own in the start chunk)
  /** Settings as the ☰ menus' last row opens it (R49): one per session, its rows read the settings on every draw. */
  let settingsMenu: SubMenu | undefined;
  /** A user key that holds Settings, or a ☰ menu's last row before the Mode code is in: Mode › Settings, on its first
   *  row (R49, docs/05 3.4). */
  function openSettings(): void {
    onModeSheet((m) => {
      picked = null;
      shell.showMenu(t("mode.title"), m.modeItems(session, settingsEnv), { remember: false, at: "settings" });
      shell.sheet?.enter(); // its submenu: a level on top
    });
  }
  // Android back is Esc for the open sheet (R21b, R49): it goes back one level, and the root closes. Each level it goes
  // back takes a new history entry for the level now on top.
  let backs = $state(0);
  $effect(() => {
    void backs;
    if (!sheetOpen) return;
    return openLayer(() => {
      if (shell.sheet?.back()) backs++;
      else shell.closeSheet();
    });
  });
  /** A tap on the bar's format and digits chip (`at`: the row to start on), an app's ☰ › Mode, or a user key that holds
   *  Mode: the Mode sheet. Without `at` it starts on Angle, so Mode, ▶, Enter always switches the angle unit. */
  function openMode(at?: string): void {
    onModeSheet((m) => {
      picked = null;
      shell.showMenu(t("mode.title"), m.modeItems(session, settingsEnv), { remember: false, at });
    });
  }
  /** Run `open` at once when the lists are loaded; else after the load, with every key meanwhile waiting in the queue
   *  (decisions.md R8), so none of them lands on the line before the sheet is there. */
  function onModeSheet(open: (m: ModeSheetCode) => void): void {
    if (loaders.modeSheet && sheetChunk.C) return open(loaders.modeSheet);
    sheetLoad = Promise.all([loadModeSheet(), loadSheetView()]).then(
      ([m]) => {
        sheetLoad = null;
        open(m);
      },
      () => {
        sheetLoad = null; // the chunk did not load: the queued keys run without the sheet
      },
    );
  }

  /** A66f1: the click's code is a lazy chunk; fetch it at start when the setting is on (and after a restore or preset). */
  let click: (() => void) | undefined;
  $effect(() => void (session.settings.haptics.click && loadClick().then((f) => (click = f))));

  /** A finger went down on the keypad: vibrate and click when switched on in Settings (one pulse and one click per touch,
   *  R112, A66). */
  function touched(): void {
    const h = session.settings.haptics;
    if (h.on) vibrate(h.strength / 100, h.ms);
    if (h.click) click?.();
  }

  /** A key that does nothing here (docs/05 3.7): a short double haptic and no other effect. */
  function dead(): void {
    const h = session.settings.haptics;
    if (!h.on) return;
    vibrate(h.strength / 100, h.ms);
    setTimeout(() => vibrate(h.strength / 100, h.ms), h.ms + 70);
  }

  /** The picked history row (P4: Up on an empty line; route.ts walks it; R147: a first tap on a row). */
  let picked = $state<number | null>(null);
  /** R147: a tap picks a row (History draws no note row as one, so every index it gives can be picked; null drops
   *  the pick); its buttons come with the clipboard code, as after ▲. */
  function pick(i: number | null): void {
    if ((picked = i) !== null) void loadClip();
    if (i !== null && folded) countUse("pick"); // R53
  }
  // R700 (F381): Android back drops a picked row as Esc does. One layer for as long as some row is picked (a move to another row
  // keeps it); it opens after the fold's when the pick came later, so the pick closes first.
  const hasPick = $derived(picked !== null);
  $effect(() => {
    if (hasPick) return openLayer(() => (picked = null));
  });
  // R700: ...and an armed or locked Shift or Alpha, as the key that disarms it (session.releaseModifiers); one layer while either holds.
  const armed = $derived(session.shift || session.alpha); // (a lock keeps its own layer on)
  $effect(() => {
    if (armed) return openLayer(() => session.releaseModifiers());
  });
  /** Results mode (R53, decisions.md P16): the keypad folded to its 44 px slice, the history over the screen. Home and
   *  CAS only; never stored, so a reload has the keys up. */
  let folded = $state(false);
  /** R224: the wide layout (stage and keypad side by side, the `@media` block below) is on; it has no results mode. */
  let wide = $state(false);
  const canFold = $derived(shell.app === null && !wide);
  $effect(() => {
    if (!canFold) folded = false; // an app opened, or the screen turned wide: no results mode there
  });
  /** The counter of P16's removal test (state/uses.svelte.ts, its own chunk, fetched on the first fold). */
  const countUse = (name: string): void => void session.uses().then((c) => c.count(name));
  /** Fold the keypad: by the line's swipe, (R131) the desktop key or (R724, R786) ⌄ on the bar, counted apart (`fold.swipe`, `fold.hw`, `fold.tap`). */
  function fold(as: "fold.swipe" | "fold.hw" | "fold.tap" = "fold.swipe"): void {
    if (folded || !canFold) return;
    folded = true;
    countUse(as);
  }
  /** The keys come back; false when they were up. */
  function unfold(): boolean {
    if (!folded) return false;
    folded = false;
    return true;
  }
  /** A row's value, or with `recall` its entry, goes on the line and the keys come back for it. `count`: false for the
   *  Menu's list, which counts its own; a second tap on a row and Enter on a pick are counted here. `whole`: R301. */
  function onLine(item: HistoryItem, recall: boolean, count = true, whole = false, stay = false): void {
    if (count && folded) countUse(recall ? "recall" : "insert");
    if (!stay) folded = false; // (Store ▶ stays: R740)
    if (recall) {
      entry.set(session.input(item), item.chips, item.readsAngle && item.angle ? item.angle : null);
    }
    else insertResult(item, whole);
  }
  // Android back brings the keys back (a sheet opened over the fold is a later layer: back closes it first)
  $effect(() => {
    if (folded) return openLayer(() => (folded = false));
  });
  /** The folded bar and the line's swipe (keyboard/Fold.svelte; ⌄ is the bar's, views/StatusLine.svelte): their own chunk, fetched when idle after the start. */
  let Fold = $state.raw<typeof import("./keyboard/Fold.svelte").default | undefined>();
  let entryBox: HTMLDivElement | undefined = $state();
  /** The CAS view is under the keys (no app on top): Alpha types lower case there (R58). */
  const casKeys = $derived(session.view === "cas" && shell.app === null);
  /** A second tap on a picked input row (R147): its entry goes on an empty line; text on the line stays and the pick is
   *  dropped (R273, owner 2026-11-09), as for Enter on a pick (keyboard/route.ts). */
  function recallTapped(item: HistoryItem): void {
    edited = true;
    picked = null;
    shell.prompt?.cancel();
    if (entry.empty) onLine(item, true); // R298: before the field the queued keys are text too (entry.value is not the line yet)
  }
  /** R276: a row swiped out is deleted (R98's path: the Undo note row comes); the pick drops, as for Delete. Counted
   *  as Delete while folded (R53). */
  function swiped(item: HistoryItem): Promise<boolean> {
    picked = null;
    if (folded) countUse("delete");
    return session.removeItem(item);
  }
  /** The key routing (keyboard/route.ts, R15c2) works on this: the models, this component's state and its actions. */
  const ctx: RouteCtx = {
    get session() { return session; },
    get shell() { return shell; },
    get entry() { return entry; },
    get picked() { return picked; },
    set picked(v) { picked = v; },
    get sheetLoad() { return sheetLoad; },
    set sheetLoad(v) { sheetLoad = v; },
    waiting: [],
    get casKeys() { return casKeys; },
    enter,
    insertResult: (item) => onLine(item, false),
    recallRow: (item) => onLine(item, true),
    goTo,
    clearKey,
    openSettings,
    openMode,
    openShiftPalette,
    openFind,
    openHelp,
    openMatrix,
    openNames,
    openStore,
    withClip,
    loadClip: () => void loadClip(),
    dead,
    unfold,
  };
  const press = (key: Key, layer?: Layer): void => {
    edited = true;
    route.press(ctx, key, layer);
  };
  const typeLetter = (ch: string): void => {
    edited = true;
    route.typeLetter(ctx, ch);
  };
  const cancel = (): Promise<void> => route.escape(ctx);

  const busy = $derived(session.busy || shell.busy);
  /** R155: a job runs or the engine starts; the dash round the entry outline shows once that has lasted 150 ms. */
  const working = $derived(busy || session.engineState === "starting");
  let dash = $state(false);
  $effect(() => {
    if (!working) return void (dash = false);
    const id = setTimeout(() => (dash = true), 150); // as Working… (style.css .late): a job that ends sooner never shows it
    return () => clearTimeout(id);
  });
</script>

<main class="app">
  <div class="screen">
    <div class="stage">
      {#if session.engineState !== "ready"}
        <p class="enginenote" role="status" data-testid="engine-note">
          {#if EngineFailed}<EngineFailed kind={session.engineFailure} />{:else}{t(session.engineState === "failed" ? "engine.error" : "engine.starting")}{/if}
          {#if session.engineState === "failed"}<button type="button" class="reload" data-testid="engine-reload" onclick={() => location.reload()}>{t("engine.reload")}</button>{/if}
        </p>
      {/if}
      {#if updateOffer.restart && UpdateNote}<UpdateNote restart={updateOffer.restart} />{/if}
      {#if shell.app === null}
        <History
          items={session.items}
          selected={picked}
          engineState={session.engineState}
          oncredits={openCredits}
          display={(item) => session.display(item, true)}
          input={(item) => session.input(item)}
          mark={(item) => session.mark(item)}
          sigma={(item) => session.sigma(item)}
          reason={(item) => session.reason(item)}
          marks={session.settings.marks}
          angle={session.settings.angle}
          onpick={pick}
          onrecall={recallTapped}
          oninsert={(item) => { edited = true; picked = null; shell.prompt?.cancel(); onLine(item, false); }}
          oncancel={() => void cancel()}
          onhold={(item, part, latex) => withClip((c) => void c.holdCopy(item, part, latex))}
          onswipe={swiped}
          undo={session.undoCopy?.kind ?? null}
          onundo={() => { picked = null; session.undoRemoved(); }}
        />
      {:else if shell.current}
        {@const C = shell.current.Root}
        <C app={shell.current.instance} view={shell.view} />
      {:else}
        <p class="loading">{t("apps.loading")}</p>
      {/if}
    </div>

    {#if clip?.notice}<div class="notice" role="status" data-testid="notice">{clip.notice}</div>
    {:else if shell.prompt?.hint}<div class="notice" role="status" data-testid="prompt-hint">{shell.prompt.hint}</div>{/if}

    <!-- R11, R276: the picked row's actions, Store ▶ and Copy › (docs/05 3.3); shown only while a row is picked (RowBar.svelte, with the clipboard code); folded, its why line alone (R724: the buttons are in the folded bar) -->
    {#if clip && rowBar && shell.app === null && picked !== null && session.items[picked]}
      {@const Bar = rowBar}
      <Bar {clip} {entry} row={session.items[picked]!} height={entryHeight} {folded} onaction={() => (picked = null)} />
    {/if}

    <div class="entry" class:hidden={!shell.showsEntry} data-testid="entry" data-ring={ring} data-running={dash} aria-label={t("entry.label")} bind:clientHeight={entryHeight} bind:this={entryBox}>
      {#if shell.entryLabel}<span class="entrylabel" class:asking={!!shell.prompt} data-testid="entry-label">{shell.entryLabel}</span>{/if}
      <!-- R155: one flat dash on the outline's path while a job runs (aria-hidden: the hidden status line names the job); in the
           field's box, where the unit view (units/open.ts) hides it with the field -->
      <div class="field" bind:this={host}>
        {#if dash}<svg class="rundash" data-testid="entry-dash" aria-hidden="true"><rect pathLength="100" /></svg>{/if}
      </div>
    </div>

    <!-- R770: every sheet rises from just above the entry line, over the history or view, and takes the entry line's room only
         when its rows need it; the keys stay live below it (docs/05 3.1). R53: folded, a sheet that takes no letters rises from the
         slice's top edge over the history, the line covered -->
    {#if shell.sheet}{@render sheetView(shell.sheet, folded && !shell.sheet.letters ? 0 : entryHeight)}{/if}
  </div>

  {#if !folded || !Fold}<StatusLine {session} {shell} {busy} cas={casKeys} hw={hw.keys} onpress={press} onmode={openMode} onfold={Fold && canFold && !shell.sheet ? () => fold("fold.tap") : undefined} />{/if}<!-- R722: on the keys; R724: folded, it is the folded bar; R786: ⌄ is its first control (an empty cell where the keys cannot fold, or a sheet is open) -->
  <div class="keys" class:folded data-testid="keys" data-folded={folded} data-fold-ready={Fold !== undefined}>
    <!-- R53, R724: folded, the 44 px folded bar over the keypad, drawn as it was (no key reflows) and hidden (keyboard/Fold.svelte) -->
    {#if Fold}<Fold {folded} line={entryBox} {entry} swipes={() => canFold && (folded || !shell.sheet)} onfold={fold} onunfold={unfold}
      {ctx} {busy} onpress={press} />{/if}
    <div class="pad-wrap" inert={folded} aria-hidden={folded}>
    <Keypad
      {userKeys}
      shift={session.shift}
      alpha={session.alpha}
      alphaLock={session.alphaLock}
      capsLock={session.capsLock}
      shiftLock={session.shiftLock}
      cas={casKeys} app={shell.app !== null}
      sheet={shell.sheet ? { filter: shell.sheet.level.filterable, store: shell.sheet.id === "store" } : undefined}
      pops={session.settings.look.pops}
      onpress={press}
      oncount={session.taps.touch}
      ontouch={touched}
    />
    </div>
  </div>
</main>

{#snippet sheetView(sheet: NonNullable<typeof shell.sheet>, below: number)}
  {#if sheetChunk.C}
  <sheetChunk.C
    {sheet}
    testid={shell.switcherOpen ? "apps" : sheet.id === "find" || sheet.id === "store" ? sheet.id : "menu"}
    {below}
    ontap={(i) => shell.picked(sheet.activate(i))}
    onoption={(i, o) => shell.picked(sheet.pickOption(i, o))}
    onback={() => sheet.back()}
    ongear={() => shell.picked(sheet.openSettings())}
    onclose={() => shell.closeSheet()}
  />
  {/if}
{/snippet}

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-width: var(--app-max);
    margin: 0 auto;
  }
  /* R224 (docs/05 3.9): the wide layout, on a landscape screen at least 1000 × 600 (views/wide.ts too; change both): the
     stage with the entry line on the left at full height, the keypad in its own column on the right, the bar at its head
     (R722), its rows (the phone's grid, docs/03 rule 8) sharing the rest. No results mode (canFold): it covers no history. */
  @media (min-width: 1000px) and (min-height: 600px) and (orientation: landscape) {
    .app {
      --app-max: var(--app-max-wide);
      display: grid;
      grid-template-columns: minmax(0, 1fr) var(--keys-wide);
      grid-template-rows: auto minmax(0, 1fr);
    }
    .app > :global(.bar) {
      grid-area: 1 / 2;
    }
    .screen {
      grid-area: 1 / 1 / -1 / 2;
    }
    .keys {
      grid-area: 2 / 2;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .pad-wrap {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .pad-wrap > :global(.pad) {
      flex: 1;
    }
  }
  /* the engine's start and failure notes, in the stage (R82f2: not on the bar) */
  .enginenote {
    position: absolute;
    top: var(--sp-2);
    left: 50%;
    transform: translateX(-50%);
    z-index: 1;
    margin: 0;
    padding: var(--sp-15) var(--sp-35);
    border-radius: var(--radius-pill);
    background: var(--panel);
    border: var(--stroke-thin) solid var(--line);
    color: var(--muted);
    font-size: var(--fs-note);
    white-space: nowrap;
    pointer-events: none;
  }
  .reload {
    pointer-events: auto; /* the one part of the note that takes a touch (the note lets them through); its look is in the note's chunk */
  }
  .screen {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .stage {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  /* R82 (F110): a view whose root carries data-floor (the Plot view: its readout) is never squeezed below its own
     minimum. Without it a short screen above the keypad (a phone with less height) shrank the stage under the readout and
     the keypad, drawn after it, covered the Root answer. Lists keep min-height 0 and scroll inside themselves. */
  .screen:has(> .stage > :global([data-floor])),
  .stage:has(> :global([data-floor])) {
    min-height: auto;
  }
  .keys {
    position: relative;
  }
  /* R53: folded to the slice; the pad keeps its size under it, so no key reflows, and is hidden */
  .keys.folded {
    height: var(--fold-h);
    overflow: hidden;
  }
  .keys.folded .pad-wrap {
    visibility: hidden;
  }
  .loading {
    margin: auto;
    color: var(--muted);
  }
  .notice {
    position: relative;
    align-self: center;
    margin: 0 var(--sp-3) var(--sp-1);
    padding: var(--sp-15) var(--sp-35);
    border-radius: var(--radius-pill);
    background: var(--panel);
    border: var(--stroke-thin) solid var(--line);
    color: var(--text);
    font-size: var(--fs-note);
  }
  .entry {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-3);
    /* room for the field before MathLive has loaded, so nothing jumps */
    min-height: var(--entry-h);
    /* R53: a vertical swipe on the line folds or unfolds the keypad; the browser pans nothing vertically here */
    touch-action: pan-x;
  }
  /* (R786: ⌄ is on the bar, so the field keeps no room for it; the row stays the containing block of what sits on it) */
  .entry {
    position: relative;
  }
  .entry.hidden {
    display: none;
  }
  .entrylabel {
    color: var(--muted);
    white-space: nowrap;
  }
  .entrylabel.asking {
    color: var(--text); /* R776: a name prompt's label is the question, not a hint */
  }
  .field {
    position: relative;
    flex: 1;
    min-width: 0;
    /* R155f1: the box has the mounted field's height (--field-h) before MathLive has put the field in: an empty box was
       0 px high, and the dash, which fills it, with it. After the mount the field's own height is within a pixel of it. */
    min-height: var(--field-h);
  }
  /* R155: over the field's outline (R154), which is --ring-on wide while a job runs, with the dash on the same path:
     a rounded rectangle through the outline's middle, the field's radius less half its width. Flat --text, no gradient. */
  .rundash {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
  }
  .rundash rect {
    x: calc(var(--ring-on) / 2);
    y: calc(var(--ring-on) / 2);
    width: calc(100% - var(--ring-on));
    height: calc(100% - var(--ring-on));
    rx: calc(var(--radius) - var(--ring-on) / 2);
    ry: calc(var(--radius) - var(--ring-on) / 2);
    fill: none;
    stroke: var(--text);
    stroke-width: var(--ring-on);
    stroke-dasharray: var(--run-dash) var(--run-gap);
    stroke-linecap: round;
    animation: rundash var(--run-lap) linear infinite;
  }
  @keyframes rundash {
    to {
      stroke-dashoffset: -100;
    }
  }
  .entry[data-running="true"] :global(math-field) {
    --ring-w: var(--ring-on);
  }

  .entry :global(math-field) {
    display: block;
    width: 100%;
    font-size: var(--fs-entry);
    padding: var(--sp-2) var(--sp-25);
    border-radius: var(--radius);
    background: var(--panel);
    color: var(--text);
    /* R154: the outline says what the keypad will do: --ring at rest, --shift, --alpha or --error otherwise (data-ring,
       entry/ringState.ts). Flat colour, no transition; drawn inside the box with a negative offset, so neither the box
       nor its text moves between the states. The border keeps the box's size. */
    --ring-c: var(--ring);
    --ring-w: var(--ring-rest);
    border: var(--stroke-thin) solid transparent;
    outline: var(--ring-w) solid var(--ring-c);
    outline-offset: calc(-1 * var(--ring-w));
    /* R116: MathLive's highlights as theme tokens, so they follow our look and never the system's scheme (the unit
       view's field is in .entry too): the caret in the Alpha hue; the box of the bracket that holds the cursor on
       --pick with --text on it, the selection on its own --sel with --on-sel (R274: it must not look like the box) */
    --caret-color: var(--alpha);
    --contains-highlight-background-color: var(--pick);
    --contains-highlight-color: var(--text);
    --selection-background-color: var(--sel);
    --selection-color: var(--on-sel);
  }
  .entry[data-ring="shift"] :global(math-field),
  .entry[data-ring="alpha"] :global(math-field),
  .entry[data-ring="error"] :global(math-field) {
    --ring-w: var(--ring-on);
  }
  .entry[data-ring="shift"] :global(math-field) {
    --ring-c: var(--shift);
  }
  .entry[data-ring="alpha"] :global(math-field) {
    --ring-c: var(--alpha);
  }
  .entry[data-ring="error"] :global(math-field) {
    --ring-c: var(--error);
  }
  /* reduced motion: nothing moves, so no dash; the whole outline stands in --text while the job runs */
  @media (prefers-reduced-motion: reduce) {
    .rundash rect {
      display: none;
    }
    .entry[data-running="true"] :global(math-field) {
      --ring-c: var(--text);
    }
  }
  .entry :global(math-field::part(virtual-keyboard-toggle)),
  .entry :global(math-field::part(menu-toggle)) {
    display: none;
  }
</style>

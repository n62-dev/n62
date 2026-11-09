<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import { onMount } from "svelte";
  import type { AppShell, PaletteId } from "./apps/shell.svelte.ts";
  import type { SubMenu } from "./apps/types.ts";
  import type { ClipActions } from "./clipboard/actions.svelte.ts";
  import type { RowBarView } from "./appLoaders.ts";
  import type { EntryController } from "./entry/controller.ts";
  import { t } from "./i18n/index.ts";
  import { openLayer } from "./input/backLayer.ts";
  import { loadClick, vibrate } from "./input/haptics.ts";
  import Keypad from "./keyboard/Keypad.svelte";
  import { loadShiftPalettes, shiftPalettes } from "./keyboard/palettes.ts";
  import { keyboard, MATHS_ROW, type Key, type Layer, type Palette, type PaletteItem } from "./keyboard/keyboard.ts";
  import * as route from "./keyboard/route.ts";
  import type { RouteCtx } from "./keyboard/route.ts";
  import { creditsAsked } from "./entry/credits.ts";
  import { ringState } from "./entry/ringState.ts";
  import { resultToEntry } from "./render/insertable.ts";
  import { tooLongToInsert, tooLongToInsertNote } from "./render/longResult.ts";
  import type { UserKeys } from "./keyboard/userKeys.svelte.ts";
  import { noDigit } from "./state/displayMode.ts";
  import type { HistoryItem, Session, View } from "./state/session.svelte.ts";
  import { counted, countScreenTaps, hwKind } from "./state/pressCount.ts";
  import { createLoaders, type FindCode, type ModeSheetCode } from "./appLoaders.ts";
  import { tipsDue } from "./state/tips.ts";
  import History from "./views/History.svelte";
  import StatusLine from "./views/StatusLine.svelte";
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
    insertResult: (item) => onLine(item, false, false), // (the Menu's list counts its own)
    recall: (item) => onLine(item, true, false),
    acted: (id) => void (folded && countUse(id)), // R53: each row action while folded (P16's removal test), before it runs
    onClip: (c, bar) => {
      rowBar = bar;
      clip = c;
    },
  });
  const { loadModeSheet, loadFind, loadClip } = loaders;

  // R15c4: the first-start tips, a lazy chunk (views/tipsHost.ts) shown once on a fresh profile and again from Settings › Help and about.
  const showTips = (): void => void import("./views/tipsHost.ts").then((m) => m.showTips(), () => {});

  const sheetOpen = $derived(shell.sheet !== null);
  $effect(() => entry.setNames(session.userNames)); // R33: the stored names are drawn in their colour on the line
  $effect(() => void (userKeys.decimalComma = entry.decimalComma = session.decimalComma)); // R57: the `.` and `,` keys' faces (keypad, tap, hardware key)

  // The shell paints first; main.ts then loads MathLive, which puts the field into this element.
  onMount(() => {
    if (host) entry.setHost(host);
    // R70, R107: a hardware key (`<` `>` `!` and a dead one too) and a tap are presses (docs/04 5.2)
    const hw = (name: string) => (): void => session.taps.press(`${name}:hw`); // R127: a hardware key that runs a keypad key is "<key id>:hw"
    const hwOther = (kind: Parameters<typeof hwKind>[0]) => (): void => session.taps.press(hwKind(kind)); // ... else "hw:<kind>" (state/pressCount.ts)
    // R45: a hardware Enter is the Enter key (a picked row, an open sheet), not a bare submit
    entry.onEnter = counted(hw("enter"), () => {
      const key = keyboard.byId.get("enter");
      if (key) press(key, "primary");
      else enter();
    });
    // R15c2: a hardware Escape is the Esc key (an open sheet or pick takes it first)
    entry.onEscape = counted(hw("esc"), () => {
      const key = keyboard.byId.get("esc");
      if (key) press(key, "primary");
    });
    // R31 (F27): a hardware keyboard's printable keys are taps of the keypad key with that character
    entry.onKey = counted((...[id]: [string, Layer]) => session.taps.press(`${id}:hw`), (id: string, layer: Layer) => {
      const key = keyboard.byId.get(id);
      if (key) press(userKeys.resolve(key), layer);
    });
    entry.onLetter = counted(hwOther("letter"), typeLetter);
    shell.goTo = goTo; // the Apps sheet's Home and CAS rows
    shell.openSettings = openSettings;
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
      route.pasteText(ctx, text); // R114: Ctrl+V and every system paste take the Paste key's path
    };
    const loadFold = (): void => void import("./keyboard/Fold.svelte").then((m) => (Fold = m.default), () => {}); // R53
    if ("requestIdleCallback" in window) requestIdleCallback(loadFold, { timeout: 1500 });
    else setTimeout(loadFold, 300);
    // the first start (R15c4): once the keypad is drawn and the browser is idle, so the tips never compete with the start
    void tipsDue(location.search).then((due) => due && ("requestIdleCallback" in window ? requestIdleCallback(showTips, { timeout: 2000 }) : setTimeout(showTips, 500)));
    return countScreenTaps((kind) => session.taps.press(kind));
  });
  let host: HTMLElement | undefined = $state();
  let entryHeight = $state(0);

  // The pick sheets' layer (R21a): from the gap above the first maths row to the keypad's bottom edge, measured once per
  // resize of the keypad.
  let keysEl: HTMLDivElement | undefined = $state();
  let mathsTop = $state(0);
  /** A tap in the viewport closes a pick sheet; a click left over from the press that opened it does not. */
  let catchPressed = false;
  $effect(() => {
    void shell.sheet;
    catchPressed = false;
  });
  const firstMaths = keyboard.keys.find((k) => k.row === MATHS_ROW);
  const keyBox = (id: string): DOMRect | undefined => keysEl?.querySelector(`[data-key="${id}"]`)?.getBoundingClientRect();
  $effect(() => {
    const el = keysEl;
    if (!el || !firstMaths) return;
    const place = (): void => {
      const k = keyBox(firstMaths.id);
      // R148: from the gap above the first maths row (the keypad's 4 px gap covers no key): the Home menu's nine rows at the
      // floor still fit at 412 × 915 with the tighter keypad
      const gap = parseFloat(getComputedStyle(el.querySelector(".pad") ?? el).rowGap) || 0;
      if (k) mathsTop = k.top - gap - el.getBoundingClientRect().top;
    };
    place();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  });

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
    if (creditsAsked(entry.value, session.view, session.userNames, entry.chips)) return openCredits(); // R149
    if (session.submit(entry.value, undefined, entry.chips)) {
      entry.clear();
      edited = false; // the line is empty again: an error outline (ringState) stays until the next key
    }
  }

  /** R149: N62 then Enter: the credits sheet (a lazy chunk with the About data), the line cleared, nothing submitted. */
  function openCredits(): void {
    entry.clear();
    edited = false;
    picked = null;
    onFind(import("./views/creditsSheet.ts"), (m) => m.showCredits(shell));
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

  /** L5 and docs/04 2.8: a tapped or picked result goes on the line as a chip that carries its full value. */
  function insertResult(item: HistoryItem): void {
    // a result with no confirmed digit goes on the line as the bare warning mark, never as its unconfirmed number
    const chip = session.chipFor(item);
    // a unit row with no chip (R63f1): Home's number alone, never its σ or unit (Home has no units); its chip shows both
    const { units, ...number } = item;
    const shown = noDigit(session.mark(item)) ? "⚠" : session.display(units && !chip ? number : item).latex;
    if (chip) entry.insertResult(shown, chip);
    else if (tooLongToInsert(shown, false)) withClip((c) => c.say(tooLongToInsertNote())); // R135f2: too long to draw, so to insert
    else entry.insert(resultToEntry(shown)); // too long for a chip: as drawn
  }

  /** Home or CAS, from anywhere (an app too). */
  function goTo(view: View): void {
    picked = null;
    shell.close();
    session.setView(view);
  }

  function clearKey(): void {
    if (shell.app === null && entry.value === "") void session.clearHistory();
    else entry.clear();
  }

  /** Tmpl: the template palette (R10), a grid on the sheet; a pick inserts its template as its key would. A view
   *  without an entry line (Plot) has nothing to insert into. */
  function openTemplates(): void {
    withPalettes((m) => openPalette("tmpl", m.paletteText("tmpl.title"), m.tmpl, (cell) => m.paletteText(`tmpl.${cell}`)));
  }
  /** Run `open` with the palettes' chunk (loaded with MathLive): at once when it is in, else after the load, with every key
   *  meanwhile in the queue (decisions.md R8). If the chunk does not load, the queued keys run without the sheet. */
  function withPalettes(open: (m: NonNullable<typeof shiftPalettes>) => void): void {
    if (shiftPalettes) return open(shiftPalettes);
    sheetLoad = loadShiftPalettes().then(open, () => {}).finally(() => (sheetLoad = null));
  }
  /** Tmpl, Shift + 6 (relations and logic) and Shift + 9 (symbols and Greek, R18): a palette on the grid sheet. */
  function openPalette(id: PaletteId, title: string, p: Palette, name: (id: string) => string): void {
    if (!shell.showsEntry) return dead();
    const cells = sheetChunk.palette; // (R91: with the sheet's view; the palette keys wait for it in the queue)
    if (!cells) return void loadSheetView().then(() => openPalette(id, title, p, name), dead);
    picked = null;
    shell.togglePalette(id, title, () => cells.paletteItems(p.items, insertTemplate, name), p.columns);
  }
  /** The palettes (Tmpl too, R91) come in their own chunk, loaded with MathLive; until then the key waits for it. */
  function openShiftPalette(id: "rel" | "sym"): void {
    withPalettes((m) => openPalette(id, m.paletteText(`${id}.title`), id === "rel" ? m.relations : m.symbols, (cell) => m.paletteText(`${id}.${cell}`)));
  }
  /** Math (R4a): Find (find/finder.ts). Until its code and the index are in, every key waits in the queue (decisions.md
   *  R8). No entry line, nothing to insert into. `slot` (R4b, Settings › Your keys): a pick sets that free key's slot. */
  function openFind(slot?: FindSlot): void {
    if (!slot && !shell.showsEntry) return dead();
    if (loaders.findCode && sheetChunk.C) return showFind(loaders.findCode, slot);
    if (loaders.findLoading) void import("./find/finder.ts").then((m) => m.loadIndex(true)).catch(() => {}); // hurry the idle load
    onFind(loadFind(true), (f) => showFind(f, slot));
  }
  type FindSlot = { id: string; layer: Layer };
  const showFind = (f: FindCode, slot?: FindSlot): void => { picked = null; f.m.showFind(shell, entry, f.index, slot && { ...slot, userKeys }); };
  /** Vars and Shift + Math (R4b): Find on the user's variables and functions, or Memory (the code only, not the index). */
  function openNames(memory: boolean): void {
    if (!memory && !shell.showsEntry) return dead();
    onFind(import("./find/finder.ts"), (m) => { picked = null; m.showNames(shell, entry, session, memory); });
  }
  function onFind<T>(load: Promise<T>, show: (t: T) => void): void {
    sheetLoad = Promise.all([load, loadSheetView()]).then(([t]) => { sheetLoad = null; show(t); }, () => { sheetLoad = null; dead(); }); // (a load that fails: the queued keys run without the sheet)
  }
  function insertTemplate(p: PaletteItem): void {
    const cells = sheetChunk.palette;
    if (cells) entry.run(cells.paletteAction(p, session.settings.entry === "line")); // (a pick is of an open palette, so it is loaded)
  }

  /** What Settings › Your keys needs (R4b): the slots, and Find to pick a slot's content from. */
  // svelte-ignore state_referenced_locally (main.ts mounts App once; shell and entry are never replaced)
  const settingsEnv = { get userKeys() { return userKeys; }, shell, entry, tips: showTips, chooseFor: (id: string, layer: Layer): void => openFind({ id, layer }), data: withClip }; // data: Settings › Data (R38a, R38b; as a long press on a history row: waits for the clipboard and Mode code if the sheet opened before they came; no import of its own in the start chunk)
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
  /** A tap on a status chip (`at`: the row to start on; "digits": its list, one level down), or a user key that holds
   *  Mode: the Mode sheet. Without `at` it starts on Angle, so Mode, ▶, Enter always switches the angle unit. */
  function openMode(at?: string): void {
    onModeSheet((m) => {
      picked = null;
      shell.showMenu(t("mode.title"), m.modeItems(session, settingsEnv), { remember: false, at });
      if (at === "digits") shell.sheet?.enter(); // R86: the digits chip opens the list itself, Mode under it
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
  /** Results mode (R53, decisions.md P16): the keypad folded to its 44 px slice, the history over the screen. Home and
   *  CAS only; never stored, so a reload has the keys up. */
  let folded = $state(false);
  const canFold = $derived(shell.app === null);
  $effect(() => {
    if (!canFold) folded = false; // an app opened: it has no results mode
  });
  /** The counter of P16's removal test (state/uses.svelte.ts, its own chunk, fetched on the first fold). */
  const countUse = (name: string): void => void session.uses().then((c) => c.count(name));
  function fold(how: "handle" | "swipe"): void {
    if (folded || !canFold) return;
    folded = true;
    countUse(`fold.${how}`);
  }
  /** The keys come back; false when they were up. */
  function unfold(): boolean {
    if (!folded) return false;
    folded = false;
    return true;
  }
  /** A row's value, or with `recall` its entry, goes on the line and the keys come back for it. `count`: false for the
   *  Menu's list, which counts its own; a second tap on a row and Enter on a pick are counted here. */
  function onLine(item: HistoryItem, recall: boolean, count = true): void {
    if (count && folded) countUse(recall ? "recall" : "insert");
    folded = false;
    if (recall) entry.set(session.input(item), item.chips);
    else insertResult(item);
  }
  // Android back brings the keys back (a sheet opened over the fold is a later layer: back closes it first)
  $effect(() => {
    if (folded) return openLayer(() => (folded = false));
  });
  /** The handle, the slice and the line's swipe (keyboard/Fold.svelte): their own chunk, fetched when idle after the start. */
  let Fold = $state.raw<typeof import("./keyboard/Fold.svelte").default | undefined>();
  let entryBox: HTMLDivElement | undefined = $state();
  /** The CAS view is under the keys (no app on top): Alpha types lower case there (R58). */
  const casKeys = $derived(session.view === "cas" && shell.app === null);
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
    openTemplates,
    openShiftPalette,
    openFind,
    openNames,
    withClip,
    loadClip: () => void loadClip(),
    dead,
    unfold,
  };
  const press = (key: Key, layer?: Layer, screen?: boolean): void => {
    edited = true;
    route.press(ctx, key, layer, screen);
  };
  const typeLetter = (ch: string): void => {
    edited = true;
    route.typeLetter(ctx, ch);
  };
  const cancel = (): Promise<void> => route.escape(ctx);

  /** A tap on the status line's strip is not a place for typing: it must not take the caret out of the entry line. */
  const noFocus = (e: Event): void => e.preventDefault();

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
  <StatusLine {session} {shell} {busy} cas={casKeys} onpress={press} onmode={openMode} />

  <div class="screen">
    <div class="stage">
      {#if session.engineState !== "ready"}<p class="enginenote" role="status" data-testid="engine-note">{t(session.engineState === "failed" ? "engine.error" : "engine.starting")}</p>{/if}
      {#if shell.app === null}
        <History
          items={session.items}
          selected={picked}
          engineState={session.engineState}
          display={(item) => session.display(item, true)}
          input={(item) => session.input(item)}
          mark={(item) => session.mark(item)}
          sigma={(item) => session.sigma(item)}
          reason={(item) => session.reason(item)}
          marks={session.settings.marks}
          onpick={pick}
          onrecall={(item) => { edited = true; picked = null; shell.prompt?.cancel(); onLine(item, true); }}
          oninsert={(item) => { edited = true; picked = null; shell.prompt?.cancel(); onLine(item, false); }}
          oncancel={() => void cancel()}
          onlongpress={(item) => withClip((c) => c.openRowMenu(item))}
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

    {#if clip?.notice}<div class="notice" role="status" data-testid="notice">{clip.notice}</div>{/if}

    <!-- R11: the picked row's actions, items 1-5 of the Menu (docs/05 3.3); shown only while a row is picked (RowBar.svelte, with the clipboard code) -->
    {#if clip && rowBar && shell.app === null && picked !== null && session.items[picked]}
      {@const Bar = rowBar}
      <Bar {clip} {entry} row={session.items[picked]!} height={entryHeight} {folded} onaction={() => (picked = null)} />
    {/if}

    <div class="entry" class:hidden={!shell.showsEntry} data-testid="entry" data-ring={ring} data-running={dash} aria-label={t("entry.label")} bind:clientHeight={entryHeight} bind:this={entryBox}>
      {#if shell.entryLabel}<span class="entrylabel" data-testid="entry-label">{shell.entryLabel}</span>{/if}
      <!-- R155: one flat dash on the outline's path while a job runs (aria-hidden: the hidden status line names the job); in the
           field's box, where the unit view (units/open.ts) hides it with the field -->
      <div class="field" bind:this={host}>
        {#if dash}<svg class="rundash" data-testid="entry-dash" aria-hidden="true"><rect pathLength="100" /></svg>{/if}
      </div>
    </div>

    <!-- a list that takes letters rises from just above the entry line, over the history or view, and takes the entry
         line's room only when its rows need it; while a pick sheet is over the keypad, a tap in the viewport closes it
         (docs/05 3.1) -->
    {#if shell.sheet && (shell.sheet.letters || folded)}
      <!-- R53: folded, every sheet rises from the slice's top edge over the history (a list that takes letters keeps the line) -->
      {@render sheetView(shell.sheet, "view", shell.sheet.letters ? entryHeight : 0)}
    {:else if shell.sheet}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (the Esc and Cancel keys close it too) -->
      <div class="catch" data-testid="sheet-catch" onpointerdown={(e) => { noFocus(e); catchPressed = true; }} onclick={() => {
        if (catchPressed) shell.closeSheet();
        catchPressed = false;
      }}></div>
    {/if}
  </div>

  <div class="keys" class:folded data-testid="keys" data-folded={folded} bind:this={keysEl}>
    <!-- R53: the handle on the keypad's top edge, and folded the 44 px slice over the keypad, drawn as it was (no key
         reflows) and hidden (keyboard/Fold.svelte) -->
    {#if Fold}<Fold {folded} handle={canFold && !shell.sheet} line={entryBox} {entry} swipes={() => canFold && (folded || !shell.sheet)} onfold={fold} onunfold={unfold} />{/if}
    <div class="pad-wrap" inert={folded} aria-hidden={folded}>
    <Keypad
      {userKeys}
      shift={session.shift}
      alpha={session.alpha}
      alphaLock={session.alphaLock}
      capsLock={session.capsLock}
      shiftLock={session.shiftLock}
      cas={casKeys} app={shell.app !== null}
      sheet={shell.sheet ? { filter: shell.sheet.level.filterable } : undefined}
      pops={session.settings.look.pops}
      onpress={(key, layer) => press(key, layer, true)}
      oncount={(key) => session.taps.press(key)}
      ontouch={touched}
    />
    </div>
    <!-- a pick sheet rises over the maths rows (3–9), anchored at the keypad's bottom edge; the top cluster stays
         uncovered, a tap on it closes the sheet (R144), and no key moves (decisions.md "R21") -->
    {#if shell.sheet && !shell.sheet.letters && !folded}
      <div class="layer" style:top="{mathsTop}px">{@render sheetView(shell.sheet, "keypad")}</div>
    {/if}
  </div>
</main>


{#snippet sheetView(sheet: NonNullable<typeof shell.sheet>, over: "keypad" | "view", below = entryHeight)}
  {#if sheetChunk.C}
  <sheetChunk.C
    {sheet}
    {over}
    testid={shell.switcherOpen ? "apps" : sheet.id === "find" ? "find" : "menu"}
    {below}
    {keyBox}
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
  /* the engine's start and failure notes, in the stage (R82f2: not in the status line) */
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
  .layer {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 5;
    pointer-events: none; /* the keys a short sheet leaves visible stay live (a tap closes it, R144); the sheet itself takes its taps */
  }
  .catch {
    position: absolute;
    inset: 0;
    z-index: 5;
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
  .entry.hidden {
    display: none;
  }
  .entrylabel {
    color: var(--muted);
    white-space: nowrap;
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
       view's field is in .entry too): the caret in the Alpha hue; the box of the bracket that holds the cursor and
       the selection (never both at once) on --pick, with --text on them */
    --caret-color: var(--alpha);
    --contains-highlight-background-color: var(--pick);
    --contains-highlight-color: var(--text);
    --selection-background-color: var(--pick);
    --selection-color: var(--text);
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

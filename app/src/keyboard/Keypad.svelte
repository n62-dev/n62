<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import { legend } from "../i18n/index.ts";
  import { t } from "../i18n/index.ts";
  import { FlickTracker, PAD_KEYS, REPEAT_KEYS, Repeat, Stepper, type Flick, type PadDir } from "./gestures.ts";
  import { fitLegends } from "./fit.ts";
  import { keyNames, loadKeyNames } from "./keyNamesLoader.svelte.ts";
  import { actionFor, gridPlace, keyboard, labelFor, type Key, type Layer } from "./keyboard.ts";
  import { opensSheet } from "./opens.ts";
  import { typesVariable, varLayers } from "./variable.ts";
  import { createPressFlag } from "../input/pressFlag.ts";
  import type { FinishedTouch } from "../state/pressCount.ts";
  import { sheetChunk } from "../views/sheetView.svelte.ts";
  import type { SheetCtx } from "../views/sheetKeys.ts";
  import type { UserKeys } from "./userKeys.svelte.ts";

  let {
    userKeys,
    shift,
    alpha,
    alphaLock,
    capsLock,
    shiftLock,
    cas,
    app,
    sheet,
    pops,
    onpress,
    oncount,
    ontouch,
    quiet,
  }: {
    /** The free keys' slots (U1–U6, R15b, R15c): drawn and fired with the user's actions over the defaults. */
    userKeys: UserKeys;
    shift: boolean;
    alpha: boolean;
    alphaLock: boolean;
    /** The alpha lock is the lower-case one. */
    capsLock: boolean;
    shiftLock: boolean;
    /** The CAS view is under the keys: the letter layer's case is swapped (R58). */
    cas: boolean;
    /** An app is under the keys (R71): ±, which only the unit view's line reads, is dimmed. */
    app: boolean;
    /** A sheet is open (docs/05 3.1): keys are read by sheetKeys.ts (R820 sheetFace): a key that types a character there shows it, the
     *  ones that do nothing look dead. `kind`: Find (with Vars and Memory), the store sheet or another list; `filter`: the open list
     *  takes letters; `numbered`: its numbered rows; `empty`: its query is empty. */
    sheet?: Omit<SheetCtx, "cas"> | undefined;
    /** Key pop-ups (R163, Appearance): false draws no bubble over the pad, neither the key pop nor the flick bubble; the
     *  flicks still fire. */
    pops: boolean;
    /** A key fires; `layer` overrides the Shift/Alpha state: "primary" for a trackpad step, "shift" for a flick up,
     *  "alpha" for a flick down (on Shift and Alpha themselves: the lock flicks). A press that closes an open sheet
     *  (R144) is the gesture's last: a drag steps nothing more and a held ⌫ does not repeat until the finger lifts. */
    onpress: (key: Key, layer?: Layer) => void;
    /** A touch ended (a held ⌫: went down, as a tap), with the layer the pad showed: the counter (R70, R127) counts and
     *  names it (R320: in its lazy chunk, state/pressCount.ts; a touch that is no press counts nothing). */
    oncount: (touch: FinishedTouch, layer: { shift: boolean; alpha: boolean }) => void;
    /** A finger went down on the pad: the key vibration, one pulse per touch (R112). A drag step or an armed flick makes none. */
    ontouch: () => void;
    /** A tap on this key would be a dead press where it lands (route.ts deadPress, R777): it gets no look, pop or click, as a key drawn
     *  dead. `drawnDead` keys the sheet takes for a job of its own answer false. */
    quiet: (key: Key, drawnDead: boolean) => boolean;
  } = $props();

  // The face shows what a tap gives (the active layer). The legends show what the flicks give (P7 point 2): the shift
  // function at the top left (flick up), the letter at the bottom left (flick down). A legend the face already shows
  // is left out; the Shift layer's legend stays under the alpha lock, where a flick up still gives it (`=` in a name).
  /** The keys as drawn and fired: the free keys with the user's slots. */
  /** The unit pad is up (R24b): a key that is one of its cells is the cell, in the same face and legends. */
  const keys = $derived(keyboard.keys.map((k) => sheetChunk.pad?.key(k, sheet) ?? userKeys.resolve(k)));
  /** R820: a key as the open sheet reads it (sheetKeys.ts sheetFace), in the keypad's own layer or, for a flick, the one it fires; none
   *  while no sheet is open or its code is not in yet (the faces stay as they are till then). */
  const sheetOf = (k: Key, layer?: Layer): { text?: string; dead: boolean } | undefined =>
    sheet && sheetChunk.keys?.sheetFace(k, { ...sheet, cas }, layer ? { shift: layer === "shift", alpha: layer === "alpha" } : { shift, alpha }, layer);
  /** The character a tap on the key types in the open sheet, as drawn (the space bar's is a blank: ␣). */
  const typed = (k: Key): string | undefined => {
    const t = sheetOf(k)?.text;
    return t === " " ? "␣" : t;
  };
  const face = (k: Key): string =>
    typed(k) ?? legend(labelFor(k, shift, alpha, cas) || k.label.primary || "");
  const hint = (k: Key): string => (shift && !alpha) || !k.label.shift ? "" : legend(k.label.shift);
  // (R820: while the face shows the key's letter, its letter line is empty: the letter is not drawn twice)
  const alphaHint = (k: Key): string => (alpha || !k.label.alpha || typed(k)?.toLowerCase() === k.label.alpha.toLowerCase() ? "" : k.label.alpha);
  // R820: a letter typed into a query is upright (R142 is for a variable on the line): the data-v layers it would italicise are left out
  const varsOf = (k: Key): string | undefined => {
    const v = varLayers(k);
    return v !== undefined && typed(k) !== undefined ? v.replace(shift ? /[pas]/g : /[pa]/g, "") || undefined : v;
  };
  // R143: a legend whose layer opens a sheet carries the mark ▾ (CSS, on data-opens); the letter line never does
  // R142: a legend is italic, in every mode, exactly when its action types one letter (a variable, ISO 80000-2; variable.ts):
  // the key says which layers type one (data-v), the CSS picks the face or legend that shows that layer
  /** Rows with a letter on some key reserve the letter line on every key, so the faces of a row stay level. The upper
   *  cluster has no letters, and no line for them (vertical space, docs/03 rule 9). */
  const letterRows = new Set(keyboard.keys.filter((k) => k.label.alpha).map((k) => k.row));
  const locked = (k: Key): boolean => (k.id === "alpha" && alphaLock) || (k.id === "shift" && shiftLock);

  /** What a tap on the key does in the current layer. */
  const act = (k: Key) => actionFor(k, shift, alpha, false, cas);
  /** A key that does nothing in the current layer (a key we don't have yet, or a layer it has no function in). */
  const dead = (k: Key): boolean => {
    // (not drawn dead before the sheet's code is in; R820: the keys that do nothing there, from the function that routes the tap)
    if (sheet) return sheetOf(k)?.dead === true;
    const p = k.actions.primary;
    if (p?.kind === "special" && (p.name === "shift" || p.name === "alpha")) return false; // the modifiers work in every layer
    const a = act(k);
    return !a || (a.kind === "special" && a.name === "none") ? !k.user : app && a.kind === "insert" && a.units === true; // R705: an empty free key opens its row in Your keys
  };

  let padEl: HTMLDivElement | undefined = $state();
  // R41: the names a screen reader says, from their own chunk after the first paint (a button is named by its face till then)
  $effect(loadKeyNames);
  $effect(() => keyNames()?.noFling(padEl)); // R838f1: a flick starts no fling (noFling.ts; with the key names, after the first paint)
  $effect(() => {
    const m = keyNames();
    if (m && padEl) m.labelKeys(padEl, keys, shift, alpha, cas);
  });

  // Every face and legend is shrunk until it fits its key: never cut, never overlapping (U0, docs/05 3.7).
  $effect(() => {
    // re-fit when the layer changes (the faces change with it) and when the pad's width does
    void [shift, alpha, cas];
    // R820: and when a sheet opens or closes, its code comes in or its query empties or fills (the faces change with them)
    void [sheet?.kind, sheet?.empty, sheet?.filter, sheetChunk.keys];
    if (!padEl) return;
    const pad = padEl;
    fitLegends(pad);
    if (typeof ResizeObserver === "undefined") return;
    let width = pad.clientWidth;
    const ro = new ResizeObserver(() => {
      if (pad.clientWidth !== width) {
        width = pad.clientWidth;
        fitLegends(pad);
      }
    });
    ro.observe(pad);
    return () => ro.disconnect();
  });

  // ---- gestures (docs/decisions.md P7). One pointer handler on the whole pad, one gesture per finger.
  // The trackpad (K1): the four arrow keys are its tap zones; a drag steps in 2D (gestures.ts), a tap is one step. The
  // hub at its centre (R15c) is the surface too: a drag from it steps, a tap on it is no zone and does nothing.
  const isPadKey = (k: Key): boolean => (PAD_KEYS as readonly string[]).includes(k.id);
  /** The round pad's cells; `span` is its width in columns, for the circle's diameter (R141). */
  const padArea = ((): { rows: string; cols: string; span: number } | undefined => {
    const keys = keyboard.keys.filter(isPadKey);
    if (keys.length === 0) return undefined;
    const rows = keys.map((k) => k.row);
    const places = keys.map((k) => gridPlace(keyboard, k));
    const starts = places.map((p) => p.start);
    const ends = places.map((p) => p.start + p.span);
    const [from, to] = [Math.min(...starts), Math.max(...ends)];
    return { rows: `${Math.min(...rows) + 1} / ${Math.max(...rows) + 2}`, cols: `${from} / ${to}`, span: to - from };
  })();

  // Any other key fires when the finger lifts: a tap is the key in the current layer, a flick up or down its shift or
  // letter layer (FlickTracker: distance only, no hold time), a flick slid back to the middle nothing. A sideways slip
  // or a long hold is still a tap. ⌫ fires on touch and repeats while held instead; the trackpad has no flicks.
  type Gesture =
    | { kind: "pad"; key: Key | undefined; el: HTMLElement | undefined; x0: number; y0: number; steps: Stepper; open: unknown }
    | { kind: "key"; key: Key | undefined; el: HTMLElement | undefined; x0: number; y0: number; flick: FlickTracker }
    | { kind: "repeat"; el: HTMLElement | undefined; repeat: Repeat };

  // The press look (R161, F191): the app's own flag `data-down` on the touched key, never CSS :active (input/pressFlag.ts: set
  // at finger-down, out at the later of the lift and 80 ms after the down; a cancel or the app going away clears every flag
  // at once). A key's pop goes with its flag.
  const flag = createPressFlag((el) => {
    if (popEl === el) hidePop(); // (only its own key's: a newer key's pop stays)
  });
  function unlightAll(): void {
    flag.clearAll();
    hidePop();
  }

  /** The key pop (R162): the pressed key's face above the finger, in the flick bubble's box and offset. One at a time, set in
   *  down(), gone with the key's press look (the later of the lift and 80 ms) or at once for a flick bubble or a cancel. */
  let pop = $state<{ x: number; y: number; text: string; variable: boolean } | null>(null);
  let popEl: HTMLElement | undefined;
  let popNode: HTMLDivElement | undefined = $state();
  function hidePop(): void {
    pop = null;
    popEl = undefined;
  }
  function showPop(target: Key | "pad" | undefined, el: HTMLElement | undefined): void {
    // (a key that does nothing is never shown a pop: down() skips it, R777)
    const text = pops && typeof target === "object" && el && !isPadKey(target) ? face(target) : "";
    if (!el || text === "") return hidePop();
    popEl = el;
    pop = { x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop, text, variable: typed(target as Key) === undefined && typesVariable(act(target as Key)) };
  }
  // the pop and the flick bubble stay inside the pad's width (a key at the edge; R905: one clamp for both), measured once drawn, before it is painted
  const clampLeft = (node: HTMLElement | undefined, x: number | undefined): void => {
    const half = Math.ceil(node?.getBoundingClientRect().width ?? 0) / 2; // (the real width rounded up, on the layout grid: offsetWidth let a bubble out by a fraction of a px)
    if (node && x !== undefined && padEl) node.style.left = `${Math.min(Math.max(x, half), padEl.clientWidth - half)}px`;
  };
  $effect(() => clampLeft(popNode, pop?.x));
  $effect(() => clampLeft(bubbleNode, bubble?.x));

  /** The bubble above a key while a flick is armed (P7 point 2): what the lift will fire, or ✕ for nothing. None while
   *  Key pop-ups is off (R163): the flick still fires. */
  let bubble = $state<{ x: number; y: number; dir: Flick; text: string; none: boolean; variable: boolean } | null>(null);
  let bubbleOwner: number | undefined;
  let bubbleNode: HTMLDivElement | undefined = $state();

  /** What a flick on this key fires, as the bubble shows it (empty text: nothing). Mirrors App.svelte's press(). */
  function flickText(k: Key, dir: Flick): string {
    const p = k.actions.primary;
    if (p?.kind === "special" && p.name === "shift") {
      if (dir === "down") return "";
      return shiftLock ? t("flick.unlock") : t("flick.shiftLock");
    }
    if (p?.kind === "special" && p.name === "alpha") {
      const lower = dir === "up";
      // the lock state is the same in both views (down: no shift); the CAS view types lower case there (R58)
      const named = lower !== cas;
      return alphaLock && capsLock === lower ? t("flick.unlock") : t(named ? "flick.lowerLock" : "flick.capsLock");
    }
    if (sheet) {
      // R820: what the flick types in the sheet (Find: a, the store sheet in Home: A), the key's own character up in Find
      const t = sheetOf(k, dir === "down" ? "alpha" : "shift")?.text;
      return t === " " ? "␣" : (t ?? "");
    }
    const [sh, al] = dir === "up" ? [true, false] : [false, true];
    const a = actionFor(k, sh, al, false, cas);
    if (!a || (a.kind === "special" && a.name === "none")) return "";
    return legend(labelFor(k, sh, al, cas));
  }

  function showBubble(id: number, g: Extract<Gesture, { kind: "key" }>): void {
    const st = g.flick.state;
    if (!pops || !g.key || !g.el || (st !== "up" && st !== "down")) {
      if (bubbleOwner === id) bubble = null;
      return;
    }
    const text = flickText(g.key, st);
    bubbleOwner = id;
    hidePop(); // (the flick bubble shows alone)
    // (the bubble's letter follows the same flag as the legend it shows; ✕ is none)
    const variable = !sheet && text !== "" && typesVariable(actionFor(g.key, st === "up", st === "down", false, cas));
    bubble = { x: g.el.offsetLeft + g.el.offsetWidth / 2, y: g.el.offsetTop, dir: st, text: text || "✕", none: text === "", variable };
  }
  const gestures = new Map<number, Gesture>();
  /** The app goes away (home, app switcher, a lost pointerup): every gesture ends and nothing fires. */
  function cancelAll(): void {
    for (const g of gestures.values()) cancel(g);
    gestures.clear();
    hideBubble();
    unlightAll();
  }
  $effect(() => {
    const onHide = (): void => {
      if (document.hidden) cancelAll();
    };
    const onBlur = (): void => {
      if (matchMedia("(pointer: coarse)").matches) cancelAll();
    };
    document.addEventListener("visibilitychange", onHide);
    addEventListener("pagehide", cancelAll);
    addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      removeEventListener("pagehide", cancelAll);
      removeEventListener("blur", onBlur);
      cancelAll();
    };
  });

  /** The touched key and its element (no element for the trackpad's surface or hub: they show no press). */
  function targetOf(ev: PointerEvent): { target: Key | "pad" | undefined; el: HTMLElement | undefined } {
    const el = ev.target instanceof Element ? ev.target.closest<HTMLElement>("[data-key],[data-trackpad]") : null;
    if (!el) return { target: undefined, el: undefined };
    if (el.dataset["trackpad"] !== undefined) return { target: "pad", el: undefined };
    const target = keys.find((k) => k.id === el.dataset["key"]);
    return { target, el: target ? el : undefined };
  }

  function down(ev: PointerEvent): void {
    // the keys never take focus, so the caret stays in the entry line
    ev.preventDefault();
    if (ev.pointerType === "mouse" && ev.button !== 0) return;
    // a second finger finishes the first one's gesture, so fast two-thumb typing keeps its order
    for (const g of gestures.values()) finish(g);
    gestures.clear();
    const { target, el } = targetOf(ev);
    // R777 (docs/05 3.7): a key drawn dead, or one the route will turn into nothing (quiet), has no press look, no pop and no click
    // at finger-down; its tap gives the dead key's double pulse (route.ts c.dead()). A flick that arms on it and types something
    // is felt then (move()).
    const inert = typeof target === "object" && quiet(target, dead(target));
    if (inert) hidePop(); // (the next key's down still replaces the last key's pop at once)
    else {
      flag.light(el);
      if (typeof target === "object" && isPadKey(target)) keyNames()?.placeDot(padEl, el); // R774 (the code comes with the key names: after the first paint)
      showPop(target, el);
      if (target) ontouch();
    }
    // a mouse has no implicit capture (a touch has): without it the release outside the pad is never seen
    try {
      padEl?.setPointerCapture(ev.pointerId);
    } catch {
      // a synthetic event without an active pointer: the gesture still works while the finger stays on the pad
    }

    if (target && target !== "pad" && REPEAT_KEYS.includes(target.id)) {
      // the repeats keep the layer of the first press (Shift ⌫ = Del), which used up a one-shot Shift
      oncount({ kind: "key", key: target, flick: { state: "tap" } }, { shift, alpha });
      const open = sheet;
      onpress(target);
      if (open && !sheet) return flag.unlight(el); // (R144: the tap closed a sheet; nothing repeats)
      const layer: Layer = alpha ? "alpha" : shift ? "shift" : "primary";
      gestures.set(ev.pointerId, { kind: "repeat", el, repeat: new Repeat(() => onpress(target, layer)) });
      return;
    }
    const [x0, y0] = [ev.clientX, ev.clientY];
    if (target === "pad" || (target && isPadKey(target)))
      gestures.set(ev.pointerId, { kind: "pad", key: target === "pad" ? undefined : target, el, x0, y0, steps: new Stepper(), open: sheet });
    else gestures.set(ev.pointerId, { kind: "key", key: target, el, x0, y0, flick: new FlickTracker() });
  }

  function move(ev: PointerEvent): void {
    const g = gestures.get(ev.pointerId);
    if (!g) return;
    if (g.kind === "pad") {
      // (R144: a drag that began over a sheet steps nothing more once a step has closed it)
      for (const dir of g.steps.move(ev.clientX - g.x0, ev.clientY - g.y0)) if (!g.open || sheet) step(dir);
    } else if (g.kind === "key" && g.key) {
      const before = g.flick.state;
      g.flick.move(ev.clientX - g.x0, ev.clientY - g.y0);
      const st = g.flick.state;
      if (st !== before) {
        showBubble(ev.pointerId, g);
        // a drawn-dead key that was given no feedback at finger-down: a flick that arms with a function is felt as a key press
        if (g.el && !g.el.hasAttribute("data-down") && st !== "tap" && st !== "cancelled" && flickText(g.key, st)) {
          flag.light(g.el);
          ontouch();
        }
      }
    }
  }

  /** A drag step presses its arrow with a copy of the action marked `drag`, so the line tells it from a tap: a drag never
   *  grows Shift + 5's matrix (R185, entry/matgrow.ts). */
  function step(dir: PadDir): void {
    const key = keyboard.byId.get(dir);
    if (key) onpress({ ...key, actions: { primary: Object.assign({ drag: true }, key.actions.primary) } }, "primary");
  }

  function up(ev: PointerEvent): void {
    const g = gestures.get(ev.pointerId);
    if (!g) return;
    move(ev);
    gestures.delete(ev.pointerId);
    finish(g);
  }

  function hideBubble(): void {
    bubble = null;
    bubbleOwner = undefined;
  }

  /**
   * The finger lifts (or another one comes down): a trackpad touch without a step was a tap on its zone, a key
   * touch is the key, ⌫ stops repeating.
   */
  function finish(g: Gesture): void {
    flag.unlight(g.el);
    oncount(g, { shift, alpha });
    if (g.kind === "pad") {
      if (g.steps.count === 0 && g.key) onpress(g.key);
    } else if (g.kind === "key") {
      hideBubble();
      const st = g.flick.state;
      if (!g.key || st === "cancelled") return;
      if (st === "tap") onpress(g.key);
      else onpress(g.key, st === "up" ? "shift" : "alpha");
    } else g.repeat.stop();
  }

  /** The browser took the touch (a scroll, a system gesture): nothing fires. */
  function cancel(g: Gesture): void {
    if (g.kind === "repeat") g.repeat.stop();
    if (g.kind === "key") hideBubble();
  }

  function cancelled(ev: PointerEvent): void {
    const g = gestures.get(ev.pointerId);
    if (!g) return;
    gestures.delete(ev.pointerId);
    cancel(g);
    unlightAll();
  }
</script>

<div
  class="pad"
  class:shifted={shift}
  class:alphaed={alpha}
  style:grid-template-columns={`repeat(${keyboard.units}, 1fr)`}
  style:--pad-units={keyboard.units}
  style:--pad-span={padArea?.span ?? 0}
  bind:this={padEl}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={cancelled}
  onlostpointercapture={cancelled}
  onclick={(ev) => ev.preventDefault()}
  role="presentation"
>
  {#if padArea}<div class="trackpad" data-trackpad style:grid-row={padArea.rows} style:grid-column={padArea.cols}>
      <svg class="arrows" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true"><path data-arrow="up" d="M50 12l5 10H45z" /><path data-arrow="down" d="M50 88l5-10H45z" />
        <path data-arrow="left" d="M12 50l10-5v10z" /><path data-arrow="right" d="M88 50l-10-5v10z" /></svg>
    </div>{/if}
  {#each keys as key (key.id)}
    <!-- the letter line: the row's, or a pad cell's own flick down (the cluster has none otherwise) -->
    {@const lettered = letterRows.has(key.row) || (key.pad && key.label.alpha)}
    {@const place = gridPlace(keyboard, key)}
    <button
      type="button"
      class={`key ${key.cls}`}
      data-key={key.id}
      tabindex="-1"
      aria-pressed={key.id === "shift" ? shift : key.id === "alpha" ? alpha : undefined}
      data-locked={locked(key) ? "true" : undefined}
      style:grid-row={key.row + 1}
      style:grid-column={`${place.start} / span ${place.span}`}
      data-dead={dead(key) ? "true" : undefined}
      data-zone={isPadKey(key) ? "true" : undefined}
      data-letters={lettered ? "true" : undefined}
      data-user={key.user ? (userKeys.isEmpty(key) ? "empty" : "set") : undefined}
      data-lift={(key.user && userKeys.isEmpty(key) && hint(key) === "") || undefined}
      data-pad={key.pad}
      data-v={varsOf(key)}
    >
      <span class="shiftlegend" data-fit="legend" data-opens={opensSheet(key.actions.shift) || undefined}>{hint(key)}</span>
      <span class="main" data-fit="face" data-opens={(typed(key) === undefined && opensSheet(act(key))) || undefined}>{face(key)}</span>
      {#if lettered}<span class="alphalegend" data-fit="legend">{alphaHint(key)}</span>{/if}
    </button>
  {/each}
  {#if padArea}<div class="hub" data-trackpad data-testid="pad-hub" style:grid-row={padArea.rows} style:grid-column={padArea.cols}></div>{/if}
  {#if pop}
    <div class="bubble pop" data-testid="key-pop" data-var={pop.variable} style:left={`${pop.x}px`} style:top={`${pop.y}px`} bind:this={popNode} aria-hidden="true">{pop.text}</div>
  {/if}
  {#if bubble}
    <div
      class="bubble"
      data-testid="flick-bubble"
      data-dir={bubble.dir}
      data-none={bubble.none ? "true" : undefined}
      data-var={bubble.variable}
      style:left={`${bubble.x}px`}
      style:top={`${bubble.y}px`}
      bind:this={bubbleNode}
      aria-hidden="true"
    >{bubble.text}</div>
  {/if}
</div>

<style>
  .pad {
    position: relative;
    display: grid;
    gap: var(--sp-1);
    padding: var(--sp-1);
    background: var(--panel);
    user-select: none;
    -webkit-user-select: none;
    /* no scrolling or zooming from the pad: every touch is a key, a flick or a trackpad drag (noFling.ts: nor a fling) */
    touch-action: none;
    -webkit-touch-callout: none;
    /* Key shadows off (R156): an empty shadow, so a rule that adds it to an inset edge stays valid */
    --key-drop: 0 0 transparent;
  }
  /* Key shadows (R156, Appearance): a solid line under each key and the round pad, in the row gap, drawn as a shadow so
     no key's box or touch area moves; an empty slot (outlined) and the pad's arrow zones have none */
  :global(:root[data-shadow="on"]) .pad {
    --key-drop: 0 var(--key-shadow) 0 var(--key-edge);
  }
  /* Each key has a legend line above the face (the shift function, top left) and one below it (the letter, bottom
     left), never overlapping it (P7 point 2); fit.ts shrinks what is too wide. */
  .key {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: var(--legend-h) 1fr;
    min-height: var(--key-h);
    min-width: 0;
    padding: 0 var(--key-pad) var(--sp-05);
    border: 0;
    border-radius: var(--radius);
    color: var(--key-text);
    font: inherit;
    font-size: var(--fs-key);
    background: var(--key-num);
    box-shadow: var(--key-drop);
    -webkit-tap-highlight-color: transparent;
  }
  .key[data-letters="true"] {
    grid-template-rows: var(--legend-h) 1fr var(--legend-h);
  }
  .shiftlegend,
  .alphalegend {
    justify-self: start;
    height: var(--legend-h);
    line-height: var(--legend-h);
    font-size: var(--fs-legend);
    white-space: nowrap;
  }
  .main {
    align-self: center;
    justify-self: center;
    white-space: nowrap;
    line-height: 1.1;
  }
  /* R142: a legend that types a variable is italic in every mode (ISO 80000-2; the Alpha letters, x, y, Greek letters a layer
     types), in the face the entry line draws a typed letter in (MathLive's math italic, from mathlive/static.css, loaded
     for the entry line) and a real italic serif behind it, never a synthesised slant. Functions, units, numbers and
     constants stay upright. No bold anywhere: the meaning is the position and the colour. */
  .bubble[data-var="true"],
  .key[data-v*="s"] .shiftlegend,
  .key[data-v*="a"] .alphalegend,
  .pad:not(.shifted, .alphaed) .key[data-v*="p"] .main,
  .shifted:not(.alphaed) .key[data-v*="s"] .main,
  .alphaed .key[data-v*="a"] .main {
    font-style: italic;
    font-family: KaTeX_Math, "STIX Two Text", "Times New Roman", "Times", serif;
    font-weight: 400;
  }
  /* R143 (owner, 2026-11-06): a legend whose layer opens a menu or grid instead of typing ends in ▾, the sign the status
     line's place name uses for "opens a list". In the legend's own colour (so Plain keys and every family keep it), the
     same everywhere. It hangs after the text out of the flow (absolute, at its static position, in the key's side padding),
     so the text keeps its place: fit.ts counts it, and a face is shifted left by half of it to stay centred as one unit. */
  .main[data-opens="true"] {
    translate: var(--mark-shift) 0;
  }
  [data-opens="true"]:not(:empty)::after {
    content: "▾";
    position: absolute;
    margin-left: var(--mark-gap);
    font-size: var(--mark-size);
  }
  /* The press (R12c): the key's own text colour laid over it at once, no fade, a layer of its own so it shows over every
     background, Plain keys' and High contrast's too. It is the only motion in the app. */
  .key:global([data-down])::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: color-mix(in srgb, var(--key-text) 32%, transparent);
    pointer-events: none;
  }
  .key.enter:global([data-down])::after {
    background: color-mix(in srgb, var(--on-enter) 28%, transparent);
  }
  .key.op {
    background: var(--key-op);
  }
  .key.fn {
    background: var(--key-fn);
    font-size: var(--fs-key-fn);
  }
  .key.ctl {
    background: var(--key-ctl);
    font-size: var(--fs-body);
  }
  .key.nav {
    min-height: var(--nav-h);
    background: var(--key-nav);
    font-size: var(--fs-ui);
  }
  /* a free key (U1–U6, R15b, R15c): an empty one is an outlined slot, a set one has a thin edge (the user's own key) */
  .key[data-user="empty"] {
    background: transparent;
    box-shadow: inset 0 0 0 var(--stroke-thin) var(--line);
  }
  /* R793 (owner's K10): its ＋ sits in the face row under the legend line, so when that line is empty (data-lift: no Shift
     legend shown) it is lifted by half the difference of that line and the bottom padding, into the key's centre; a Shift
     legend keeps the face below it (P7 point 2) */
  .key[data-lift="true"] .main {
    translate: 0 calc((var(--sp-05) - var(--legend-h)) / 2);
  }
  .key[data-user="set"] {
    box-shadow: inset 0 0 0 var(--stroke-thin) var(--key-muted), var(--key-drop);
  }
  /* the unit pad's prefix cells (R24b): their own colour and a slot line after the letter (R866): the colour alone differed by 1.1:1 */
  .key[data-pad="prefix"] {
    background: var(--key-pfx);
  }
  /* R866: the slot line (G_), drawn, never typed: text and spoken name stay the letter. An empty inline block sits on the baseline in
     any font; its negative margin hangs it out of the flow as ▾ hangs (fit.ts counts it), the face shifted left by half to stay
     centred. In the face's colour at 80 %, Plain keys too. σ (Shift + 1, a sheet) is no prefix: ▾ only. */
  .key[data-pad="prefix"] .main:not([data-opens="true"], :empty) {
    translate: var(--slot-shift) 0;
  }
  .key[data-pad="prefix"] .main:not([data-opens="true"], :empty)::after {
    content: "";
    display: inline-block;
    vertical-align: baseline;
    width: var(--slot-w);
    height: var(--stroke);
    margin-left: var(--slot-gap);
    margin-right: calc(-1 * (var(--slot-w) + var(--slot-gap)));
    background: currentColor;
    opacity: 0.8;
  }
  /* High contrast leaves the key colours little room to differ: the prefix cells keep an outline there too */
  :global(:root[data-contrast="high"]) .key[data-pad="prefix"] {
    box-shadow: inset 0 0 0 var(--stroke-thin) var(--line), var(--key-drop);
  }
  .key[data-pad="user"] {
    box-shadow: inset 0 0 0 var(--stroke-thin) var(--key-muted), var(--key-drop);
  }
  /* a user cell with a flick down has the letter line in the cluster too: the face's track may shrink to what is left of
     the key's 36 px less its 2 px padding (a fixed track, the face overflows it evenly), so the keys below do not move (docs/03 rule 8) */
  .key[data-pad="user"][data-letters="true"] {
    grid-template-rows: var(--legend-h) calc(var(--nav-h) - var(--sp-05) - 2 * var(--legend-h)) var(--legend-h);
  }
  .key[data-pad="empty"] {
    background: transparent;
    box-shadow: inset 0 0 0 var(--stroke-thin) var(--line);
  }
  /* the trackpad in the upper cluster: as low as the keys beside it */
  .key[data-zone="true"] {
    min-height: var(--nav-h);
  }
  /* R82: a short screen (bars, a larger font scale) lowers the rows, so the bar, the keypad and the Plot readout still
     fit the column without a scroll; a taller screen keeps the full rows. R148: from 760 px tall (was 700), because
     360 × 740 reaches the viewport floor of docs/03 rule 9 only with them (S25, r19 §3; owner, 2026-11-06). R722: under
     1000 px tall, a notch taller (43 and 33 px; owner, 2026-11-17), so a phone gives the history the room the bar left. This query decides the breakpoint: Sheet.svelte's
     short-row padding follows it (R722f1) */
  @media (max-height: 999px) {
    .key {
      --legend-h: var(--sp-25);
      min-height: var(--key-h-short);
    }
    .key[data-letters="true"] .main {
      line-height: 1; /* a letter row holds two legend lines: 10 + 20 + 10 + 2 = 42 px, in a 43 px key */
    }
    .key.nav,
    .key[data-zone="true"] {
      min-height: var(--nav-h-short);
    }
    /* the user cell's letter line at the short height: the same track, from the short nav height */
    .key[data-pad="user"][data-letters="true"] {
      grid-template-rows: var(--legend-h) calc(var(--nav-h-short) - var(--sp-05) - 2 * var(--legend-h)) var(--legend-h);
    }
  }
  /* the trackpad (K1): one surface under the four arrow keys, which stay as its tap zones; drawn as a true circle (R15c, R3,
     R141) whose diameter is the smaller side of its grid area, centred in it. The area's width is two columns, worked out
     from the pad's own width (a container, so cqw is the pad's content box); its height is the rows'. The hub at the centre
     is the same-sized invisible drag surface: a drag may start there, a tap on it does nothing. */
  .pad {
    container-type: inline-size;
  }
  .trackpad {
    --area-w: calc(
      (100cqw - (var(--pad-units) - 1) * var(--sp-1)) / var(--pad-units) * var(--pad-span) + (var(--pad-span) - 1) * var(--sp-1)
    );
    place-self: center;
    height: min(100%, var(--area-w));
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--key-disc); /* R873: its own fill, 1.25:1 from the keypad (theme-gen.ts withKeyDisc) */
    box-shadow: var(--key-drop);
  }
  .hub {
    position: relative;
    z-index: 2;
    place-self: center;
    width: 28%;
    height: 30%;
    border-radius: 50%;
  }
  .key[data-zone="true"] {
    background: transparent;
    box-shadow: none;
  }
  /* R794: a zone draws no glyph (the round pad draws the four arrows); its face stays, transparent: the zone keeps its rows'
     height, the keys beside the pad do not move, and its arrow still names it till keyNames.ts labels it (R794f1) */
  .key[data-zone="true"] .main {
    opacity: 0;
  }
  /* a zone is a transparent rectangle over the round trackpad: no press layer (its corners would spill past the circle) */
  .key[data-zone="true"]:global([data-down])::after {
    content: none;
  }
  /* R794 (owner's K9): the arrows are the round pad's drawing, not the zones' glyphs (those sat off centre): an inline SVG of
     four equal triangles in the layer's colour (currentColor), 10 % of the diameter, on the axes at 33 % from the centre (placeDot in
     keyNames.ts puts the press dot there); 0.7 opacity, full while a zone is held, a dead zone's arrow dimmed. Not a CSS
     mask: Chromium reads the bare mask only from 120 (WebView floor 111), and it moved the user keys' faces 1.2 px. */
  .trackpad {
    position: relative;
    overflow: hidden;
    isolation: isolate;
  }
  .arrows {
    position: absolute;
    inset: 0;
    z-index: 1;
    width: 100%;
    height: 100%;
    color: var(--key-text);
    opacity: 0.7;
    pointer-events: none;
  }
  .pad:has(.key[data-zone="true"]:global([data-down])) .arrows {
    opacity: 1;
  }
  /* R774: and a round dot behind the arrow (40 px, the key's text colour at 32 %), drawn by the round pad itself so its edge clips
     it: placeDot (keyNames.ts) sets --dot-x and --dot-y, the arrow's centre in the pad */
  .pad:has(.key[data-zone="true"]:global([data-down])) .trackpad::after {
    content: "";
    position: absolute;
    inset: var(--dot-y, 50%) auto auto var(--dot-x, 50%);
    width: var(--pad-dot);
    height: var(--pad-dot);
    margin: calc(var(--pad-dot) / -2);
    visibility: var(--dot-on, hidden); /* placeDot sets both: before it has run (an arrow pressed before the key names are in) no dot, not one on the hub */
    border-radius: 50%;
    background: color-mix(in srgb, var(--key-text) 32%, transparent);
  }
  /* a key that does nothing in this layer (and only in this layer) is dimmed, still readable; so is a dead zone's arrow */
  .key[data-dead="true"] .main,
  .pad:has(.key[data-key="up"][data-dead="true"]) .arrows [data-arrow="up"],
  .pad:has(.key[data-key="down"][data-dead="true"]) .arrows [data-arrow="down"],
  .pad:has(.key[data-key="left"][data-dead="true"]) .arrows [data-arrow="left"],
  .pad:has(.key[data-key="right"][data-dead="true"]) .arrows [data-arrow="right"] {
    color: var(--key-text-dead);
  }
  .key.enter {
    background: var(--key-enter);
    color: var(--on-enter);
    font-size: var(--fs-body);
  }
  .shiftlegend {
    color: var(--key-shift);
  }
  .alphalegend {
    color: var(--key-alpha);
  }
  .shifted .main,
  .shifted .arrows {
    color: var(--key-shift);
  }
  .alphaed .main,
  .alphaed .arrows {
    color: var(--key-alpha);
  }
  /* Enter keeps one colour in every layer: the coloured text would not read on its green */
  .key.enter .main,
  .key.enter .shiftlegend,
  .key.enter .alphalegend {
    color: var(--on-enter);
  }
  .shifted .key[data-dead="true"] .main,
  .alphaed .key[data-dead="true"] .main {
    color: var(--key-text-dead);
  }
  /* Shift and Alpha wear the other keys' colour (R140); only the label carries the layer colour. Armed, the key fills
     with it (--on-shift / --on-alpha are black or white at 4.5:1); locked adds the 3 px outline round the fill. */
  .key[data-key="shift"] .main {
    color: var(--key-shift);
  }
  .key[data-key="alpha"] .main {
    color: var(--key-alpha);
  }
  .key[data-key="shift"][aria-pressed="true"] {
    background: var(--key-shift);
    outline: none;
  }
  .key[data-key="alpha"][aria-pressed="true"] {
    background: var(--key-alpha);
    outline: none;
  }
  .key[data-key="shift"][aria-pressed="true"] .main {
    color: var(--on-key-shift);
  }
  .key[data-key="alpha"][aria-pressed="true"] .main {
    color: var(--on-key-alpha);
  }
  .key[data-key="shift"][data-locked="true"],
  .key[data-key="alpha"][data-locked="true"] {
    outline: var(--stroke-thick) solid var(--alpha);
    outline-offset: calc(-1 * var(--stroke-thick)); /* R774: inside the key (it crossed the 4 px gap and left the screen); R729 replaces it with a fill */
  }
  .key[data-key="shift"][data-locked="true"] {
    outline-color: var(--shift);
  }
  /* the flick bubble (P7 point 2): above the key, in the colour of the layer it fires; ✕ dimmed when nothing fires */
  .bubble {
    position: absolute;
    z-index: 5;
    transform: translate(-50%, calc(-100% - var(--sp-15)));
    min-width: var(--touch);
    padding: var(--sp-15) var(--sp-25);
    border-radius: var(--radius-m);
    background: var(--panel);
    border: var(--stroke) solid var(--shift);
    color: var(--shift);
    font-size: var(--fs-input);
    line-height: 1.1;
    text-align: center;
    white-space: nowrap;
    pointer-events: none;
  }
  /* the key pop (R162): the same box in the key's own text colour; no fade, no motion */
  .bubble.pop {
    border-color: var(--key-text);
    color: var(--key-text);
  }
  .bubble[data-dir="down"] {
    border-color: var(--alpha);
    color: var(--alpha);
  }
  .bubble[data-none="true"] {
    border-color: var(--text-dead);
    color: var(--text-dead);
  }
</style>

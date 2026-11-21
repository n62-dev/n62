<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- R53 (decisions.md P16), R283, R724: results mode's controls, in the keypad's box (App.svelte `.keys`). The swipe on the
     entry line (foldSwipe.ts) folds and unfolds; ⌄ at the bar's left end (views/StatusLine.svelte, R786) folds by a tap. Folded: the folded
     bar, one 44 px row over the hidden keypad: ⌃, the bar's tabs (views/StatusLine.svelte with `folded`), a free stretch,
     the bar's ⇧ α slot, the picked row's Store ▶ · Copy › (views/RowBar.svelte moves them in), the bar's ☰. ⌃ or a tap on
     the free stretch unfolds, and so does a drag up of FOLD_PX begun anywhere on the row (it drops the click of the button
     it began on). Its own chunk, loaded when the browser is idle after the start, so the start chunk carries only the fold's state. -->
<script lang="ts">
  import { tick } from "svelte";
  import type { Key, Layer } from "./keyboard.ts";
  import type { EntryController } from "../entry/controller.ts";
  import type { RouteCtx } from "./route.ts";
  import { keyFeelText as t } from "../i18n/enKeyFeel.ts";
  import StatusLine from "../views/StatusLine.svelte";
  import { FOLD_PX, foldSwipe } from "./foldSwipe.ts";

  let { folded, line, entry, swipes, onfold, onunfold, ctx, busy, onpress }: {
    folded: boolean;
    /** The entry line's box, where the swipe starts. */
    line: HTMLElement | undefined;
    entry: EntryController;
    /** The line's swipes are taken now (Home and CAS, not wide, no sheet over the keys while unfolded). */
    swipes: () => boolean;
    onfold: (as?: "fold.tap") => void;
    onunfold: () => void;
    /** The folded bar's StatusLine: the models and the Mode sheet (App.svelte's key routing), a job running, a control's tap. */
    ctx: RouteCtx;
    busy: boolean;
    onpress: (key: Key, layer: Layer) => void;
  } = $props();

  /** A drag up anywhere on the row unfolds at once; the click of the button it began on is dropped. */
  let from: { id: number; y: number } | undefined;
  let dragged = false;
  const start = (e: PointerEvent): void => {
    e.preventDefault(); // the caret stays in the line
    from = { id: e.pointerId, y: e.clientY };
    dragged = false;
  };
  const drag = (e: PointerEvent): void => {
    if (!from || from.id !== e.pointerId || e.clientY - from.y > -FOLD_PX) return;
    from = undefined;
    dragged = true;
    // the flag lives only for the click this gesture may still send: a moved touch sends none, and the row is gone by its
    // lift, so it is cleared on the window after the lift's click task (else a keyboard or screen-reader click, which has
    // no pointerdown, would be eaten the next time the keys are down)
    const lift = (): void => {
      removeEventListener("pointerup", lift, true);
      removeEventListener("pointercancel", lift, true);
      setTimeout(() => (dragged = false));
    };
    addEventListener("pointerup", lift, true);
    addEventListener("pointercancel", lift, true);
    onunfold();
  };
  const eat = (e: MouseEvent): void => {
    if (dragged) e.stopPropagation();
    dragged = false;
  };
  /** ⌃: a keyboard activation removes the focused button, and focus would fall to <body>, where no hardware key is heard:
   *  hand it back to the line (a touch never takes it: `start` prevents the pointerdown's focus). */
  const show = (e: MouseEvent): void => {
    const was = e.currentTarget === document.activeElement;
    onunfold();
    if (was) void tick().then(() => entry.focus());
  };

  /** The row buttons' slot goes just before the bar's ☰, so the page order (Tab, TalkBack) is the row's: ⌃, Home, CAS,
   *  Store ▶, Copy ›, ☰ (the lock's `folded-bar:`). Done here, not in StatusLine, which is in the start chunk. */
  const beforeMenu = (node: HTMLElement): void => {
    node.parentElement?.querySelector('[data-testid="menu-button"]')?.before(node);
  };

  // a new fold starts clean
  $effect(() => {
    if (folded) dragged = false;
  });

  // The swipe on the entry line: down folds, up unfolds; any other pointer is MathLive's
  $effect(() => {
    if (!line) return;
    return foldSwipe(line, {
      on: swipes,
      snapshot: () => entry.field?.selection,
      restore: (s) => {
        const f = entry.field;
        if (f && s) f.selection = s as typeof f.selection;
      },
      fire: (dir) => (dir === "down" ? onfold() : onunfold()),
    });
  });
</script>

{#if folded}
  <div class="folded" data-testid="folded-bar" onpointerdowncapture={start} onpointermovecapture={drag} onclickcapture={eat} role="presentation">
    <button type="button" class="unfold" data-testid="fold-slice" data-item="unfold" aria-label={t("keys.unfold")} onclick={show}>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 10.5 8 5.5l5 5" /></svg>
    </button>
    <StatusLine session={ctx.session} shell={ctx.shell} {busy} cas={ctx.casKeys} {onpress} onmode={(at) => ctx.openMode(at)} folded />
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (⌃ is the control; this is room a tap may land on) -->
    <span class="free" data-testid="fold-free" aria-hidden="true" onclick={() => onunfold()}></span>
    <!-- the picked row's Store ▶ · Copy ›: views/RowBar.svelte moves its buttons in here while folded -->
    <span class="acts" data-fold-acts use:beforeMenu></span>
  </div>
{/if}

<style>
  .folded {
    position: absolute;
    z-index: 3; /* under the sheets (z 5) */
    inset: 0;
    display: flex;
    align-items: stretch;
    --unfold-w: calc(2 * var(--sp-3) + var(--icon-w)); /* ⌃'s width; views/StatusLine.svelte keeps APP▾'s room less its difference from ⌄'s cell */
    background: var(--panel);
    box-shadow: inset 0 var(--stroke-thin) 0 var(--line);
    touch-action: none;
    -webkit-tap-highlight-color: transparent;
  }
  /* in ⌄'s spot (R786): the bar's left end, its icon centred where ⌄'s is (the middle of the 28 px cell) */
  .unfold {
    flex: none;
    width: var(--unfold-w);
    padding: 0 0 0 calc((var(--bar-h) - var(--icon-w)) / 2);
    border: 0;
    background: none;
    color: var(--muted);
    display: flex;
    align-items: center;
    justify-content: flex-start;
    font: inherit;
  }
  /* the row's order (views/StatusLine.svelte places the tabs 1, the slot 3 and ☰ 5; `beforeMenu` puts the row buttons'
     slot just before ☰, so the page order is the row's but for the free stretch, which no focus reaches) */
  .unfold {
    order: 0;
  }
  .free {
    order: 2;
    flex: 1;
    min-width: 0;
  }
  .acts {
    order: 4;
    display: flex;
  }
  svg {
    width: var(--icon-w);
    height: var(--icon-w);
    fill: none;
    stroke: currentColor;
    stroke-width: var(--chev-stroke);
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>

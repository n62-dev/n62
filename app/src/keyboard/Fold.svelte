<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- R53 (decisions.md P16), R283, R724: results mode's controls, in the keypad's box (App.svelte `.keys`). The swipe on the
     entry line (foldSwipe.ts) folds and unfolds; ⌄ on the field's corner (FoldChevron.svelte) folds by a tap. Folded: the
     folded bar, one 44 px row over the hidden keypad: ⌃, then the bar's folded part (`bar`: views/StatusLine.svelte with
     `folded`: the tabs, a free stretch, the slot, the picked row's Store ▶ · Copy › (views/RowBar.svelte `inbar`), ☰). ⌃ or a tap on the free stretch unfolds,
     and so does a drag up of FOLD_PX begun anywhere on the row (it cancels the click of the button it began on). Its own
     chunk (foldParts.ts), loaded when the browser is idle after the start, so the start chunk carries only the fold's state. -->
<script lang="ts">
  import { mount, tick, unmount, type ComponentProps } from "svelte";
  import FoldChevron from "./FoldChevron.svelte";
  import type { RowBarView } from "../appLoaders.ts";
  import type { ClipActions } from "../clipboard/actions.svelte.ts";
  import type { EntryController } from "../entry/controller.ts";
  import type { HistoryItem } from "../state/session.svelte.ts";
  import StatusLine from "../views/StatusLine.svelte";
  import { keyFeelText as t } from "../i18n/enKeyFeel.ts";
  import { FOLD_PX, foldSwipe } from "./foldSwipe.ts";

  let { folded, line, entry, swipes, onfold, onunfold, bar, pick }: {
    folded: boolean;
    /** The entry line's box, where the swipe starts. */
    line: HTMLElement | undefined;
    entry: EntryController;
    /** The line's swipes are taken now. */
    swipes: () => boolean;
    onfold: (as?: "fold.tap") => void;
    onunfold: () => void;
    /** The bar's props (App.svelte's bar on the keys): the folded bar draws its folded part after ⌃. */
    bar: Omit<ComponentProps<typeof StatusLine>, "folded">;
    /** The picked row, its buttons in the folded bar (the clipboard chunk's RowBar), and the pick's end. */
    pick: { clip: ClipActions; Bar: RowBarView; row: HistoryItem | undefined; drop: () => void } | undefined;
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
    onunfold();
  };
  const eat = (e: MouseEvent): void => {
    if (dragged) e.stopPropagation();
    dragged = false;
  };
  /** A keyboard activation that unfolds removes the focused button, and focus would fall to <body>, where no hardware key
   *  is heard: hand it back to the line (a touch never takes it: `start` prevents the pointerdown's focus). */
  let row: HTMLElement | undefined = $state();
  $effect.pre(() => {
    if (!folded && row?.contains(document.activeElement)) void tick().then(() => entry.focus());
  });

  // ⌄ (R724) in the entry line's box, where the swipes are taken (Home and CAS, not wide, no sheet over the keys), unfolded
  $effect(() => {
    if (!line || folded || !swipes()) return;
    const c = mount(FoldChevron, { target: line, props: { onfold: () => onfold("fold.tap") } });
    return () => void unmount(c);
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
  <div class="folded" data-testid="folded-bar" bind:this={row} onpointerdowncapture={start} onpointermovecapture={drag} onclickcapture={eat} role="presentation">
    <button type="button" class="unfold" data-testid="fold-slice" data-item="unfold" aria-label={t("keys.unfold")} onclick={() => onunfold()}>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 10.5 8 5.5l5 5" /></svg>
    </button>
    <StatusLine session={bar.session} shell={bar.shell} busy={bar.busy} cas={bar.cas} onpress={bar.onpress} onmode={bar.onmode} folded />
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (⌃ is the control; this is room a tap may land on) -->
    <span class="free" data-testid="fold-free" aria-hidden="true" onclick={() => onunfold()}></span>
    {#if pick?.row}<span class="acts"><pick.Bar clip={pick.clip} {entry} row={pick.row} height={0} folded inbar onaction={pick.drop} /></span>{/if}
  </div>
{/if}

<style>
  .folded {
    position: absolute;
    z-index: 3; /* under the sheets (z 5) */
    inset: 0;
    display: flex;
    align-items: stretch;
    background: var(--panel);
    box-shadow: inset 0 var(--stroke-thin) 0 var(--line);
    touch-action: none;
    -webkit-tap-highlight-color: transparent;
  }
  /* in ⌄'s spot: its icon over the field's left edge */
  .unfold {
    flex: none;
    width: calc(2 * var(--sp-3) + var(--icon-w));
    padding: 0;
    border: 0;
    background: none;
    color: var(--muted);
    display: flex;
    align-items: center;
    justify-content: center;
    font: inherit;
  }
  /* the row's order (views/StatusLine.svelte places the tabs 1, the slot 3 and ☰ 5) */
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

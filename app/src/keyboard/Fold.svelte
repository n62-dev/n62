<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- R53 (decisions.md P16), R283, R724: results mode's controls, in the keypad's box (App.svelte `.keys`). The swipe on the
     entry line (foldSwipe.ts) folds and unfolds; ⌄ on the field's corner (FoldChevron.svelte) folds by a tap. Folded: the
     folded bar, one 44 px row over the hidden keypad: ⌃, then the bar's folded part (`bar`: views/StatusLine.svelte with
     `folded`: the tabs, a free stretch, the slot, Store ▶ · Copy › with a pick, ☰). ⌃ or a tap on the free stretch unfolds,
     and so does a drag up of FOLD_PX begun anywhere on the row (it cancels the click of the button it began on). Its own
     chunk (foldParts.ts), loaded when the browser is idle after the start, so the start chunk carries only the fold's state. -->
<script lang="ts">
  import { tick, type Snippet } from "svelte";
  import type { EntryController } from "../entry/controller.ts";
  import { keyFeelText as t } from "../i18n/enKeyFeel.ts";
  import { FOLD_PX, foldSwipe } from "./foldSwipe.ts";

  let { folded, line, entry, swipes, onfold, onunfold, bar }: {
    folded: boolean;
    /** The entry line's box, where the swipe starts. */
    line: HTMLElement | undefined;
    entry: EntryController;
    /** The line's swipes are taken now. */
    swipes: () => boolean;
    onfold: () => void;
    onunfold: () => void;
    /** The bar's folded part, after ⌃. */
    bar: Snippet;
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
    {@render bar()}
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

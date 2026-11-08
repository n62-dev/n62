<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- R53 (decisions.md P16): results mode's controls, in the keypad's box (App.svelte `.keys`). Up: the handle, a grabber
     (32 × 4 px, --muted) on the keypad's top edge; its 48 × 24 px target lies in the keypad's top padding and the gap above
     it (the line's bottom padding and the field's), over no key. Folded: the 44 px slice over the hidden keypad, with the
     grabber and "Keys". A tap or a 24 px drag (down on the handle, up on the slice) folds or unfolds; the swipe on the entry
     line is attached here too (foldSwipe.ts). Its own chunk, loaded when the browser is idle after the start, so the start
     chunk carries only the fold's state. -->
<script lang="ts">
  import type { EntryController } from "../entry/controller.ts";
  import { keyFeelText as t } from "../i18n/enKeyFeel.ts";
  import { FOLD_PX, foldSwipe } from "./foldSwipe.ts";

  let { folded, handle, line, entry, swipes, onfold, onunfold }: {
    folded: boolean;
    /** The handle is drawn (Home or CAS, no sheet over the keys). */
    handle: boolean;
    /** The entry line's box, where the swipe starts. */
    line: HTMLElement | undefined;
    entry: EntryController;
    /** The line's swipes are taken now. */
    swipes: () => boolean;
    onfold: (how: "handle" | "swipe") => void;
    onunfold: () => void;
  } = $props();

  /** A drag down on the handle folds as its tap does; up on the slice unfolds as its tap does. */
  let from: { id: number; y: number } | undefined;
  const start = (e: PointerEvent): void => {
    e.preventDefault(); // the caret stays in the line
    from = { id: e.pointerId, y: e.clientY };
  };
  const drag = (e: PointerEvent, down: boolean): void => {
    if (!from || from.id !== e.pointerId) return;
    const dy = e.clientY - from.y;
    if (down ? dy < FOLD_PX : dy > -FOLD_PX) return;
    from = undefined;
    if (down) onfold("handle");
    else onunfold();
  };

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
      fire: (dir) => (dir === "down" ? onfold("swipe") : onunfold()),
    });
  });
</script>

{#if folded}
  <button type="button" class="slice" data-testid="fold-slice" aria-label={t("keys.unfold")} onpointerdown={start} onpointermove={(e) => drag(e, false)} onclick={onunfold}>
    <span class="grip"></span>{t("keys.slice")}
  </button>
{:else if handle}
  <button type="button" class="handle" data-testid="fold-handle" aria-label={t("keys.fold")} onpointerdown={start} onpointermove={(e) => drag(e, true)} onclick={() => onfold("handle")}>
    <span class="grip"></span>
  </button>
{/if}

<style>
  .handle,
  .slice {
    position: absolute;
    z-index: 3; /* under the picked row's buttons (z 4) and the sheets (z 5) */
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0;
    border: 0;
    font: inherit;
    color: var(--muted);
    touch-action: none;
    -webkit-tap-highlight-color: transparent;
  }
  /* 48 × 24: the gap above the keypad (the line's bottom padding and the field's) and the pad's top padding */
  .handle {
    top: calc(-2 * var(--sp-2));
    left: calc(50% - var(--touch-big) / 2);
    width: var(--touch-big);
    height: calc(3 * var(--sp-2));
    justify-content: flex-end;
    background: transparent;
  }
  .handle .grip {
    margin-bottom: var(--sp-05);
  }
  .slice {
    inset: 0;
    justify-content: center;
    gap: var(--sp-1);
    background: var(--panel);
    font-size: var(--fs-note);
  }
  .grip {
    width: var(--grip-w);
    height: var(--grip-h);
    border-radius: calc(var(--grip-h) / 2);
    background: var(--muted);
  }
</style>

<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- R53 (decisions.md P16), R283: results mode's controls, in the keypad's box (App.svelte `.keys`). The swipe on the entry
     line (foldSwipe.ts) is the only way to fold: down folds, up unfolds. Folded: the 44 px slice over the hidden keypad, with
     a grabber and "Keys"; a tap or a 24 px drag up on it unfolds. Its own chunk, loaded when the browser is idle after the
     start, so the start chunk carries only the fold's state. -->
<script lang="ts">
  import { tick } from "svelte";
  import type { EntryController } from "../entry/controller.ts";
  import { keyFeelText as t } from "../i18n/enKeyFeel.ts";
  import { FOLD_PX, foldSwipe } from "./foldSwipe.ts";

  let { folded, line, entry, swipes, onfold, onunfold }: {
    folded: boolean;
    /** The entry line's box, where the swipe starts. */
    line: HTMLElement | undefined;
    entry: EntryController;
    /** The line's swipes are taken now. */
    swipes: () => boolean;
    onfold: () => void;
    onunfold: () => void;
  } = $props();

  /** A drag up on the slice unfolds as its tap does. */
  let from: { id: number; y: number } | undefined;
  const start = (e: PointerEvent): void => {
    e.preventDefault(); // the caret stays in the line
    from = { id: e.pointerId, y: e.clientY };
  };
  /** A keyboard activation removes the focused button, and focus would fall to <body>, where no hardware key is heard:
   *  hand it back to the line (a touch never takes it: `start` prevents the pointerdown's focus). */
  const activate = (e: MouseEvent, go: () => void): void => {
    const was = e.currentTarget === document.activeElement;
    go();
    // after Svelte has removed the button: its removal would otherwise drop the focus the call just gave
    if (was) void tick().then(() => entry.focus());
  };
  const drag = (e: PointerEvent): void => {
    if (!from || from.id !== e.pointerId || e.clientY - from.y > -FOLD_PX) return;
    from = undefined;
    onunfold();
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
      fire: (dir) => (dir === "down" ? onfold() : onunfold()),
    });
  });
</script>

{#if folded}
  <button type="button" class="slice" data-testid="fold-slice" aria-label={t("keys.unfold")} onpointerdown={start} onpointermove={drag} onclick={(e) => activate(e, onunfold)}>
    <span class="grip"></span>{t("keys.slice")}
  </button>
{/if}

<style>
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

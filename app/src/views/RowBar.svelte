<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- R11, R276: the picked history row's actions, Store ▶ and Copy › of the Menu (docs/05 3.3), with R36's why line above them. It is
     drawn only while a row is picked, so it loads with the clipboard code (appLoaders.ts), not in the start chunk (R147).
     R3 (r19 section 3, R147): on an empty line it lies over the entry line's box, with that box's bottom edge and height,
     so neither the history nor the keypad moves; with text on the line it stands above the line in the flow. R724: folded,
     the buttons move into the folded bar (keyboard/Fold.svelte's `[data-fold-acts]`), and the why line alone lies on the
     line's bottom edge. -->
<script lang="ts">
  import type { ClipActions } from "../clipboard/actions.svelte.ts";
  import type { EntryController } from "../entry/controller.ts";
  import { rowBarText } from "../i18n/enRowBar.ts";
  import type { PickPart } from "../state/pickRows.ts";
  import type { HistoryItem } from "../state/session.svelte.ts";

  let { clip, entry, row, part = "row", height, folded = false, onaction }: {
    clip: ClipActions;
    entry: EntryController;
    row: HistoryItem;
    /** R832: what the pick has lit: the input shows Store ▶ and Copy (no ›), the result or the whole row Store ▶ and Copy ›. */
    part?: PickPart;
    /** The entry line's height (px): the slot it covers when `over`. */
    height: number;
    /** The keypad is folded (R53): the why line alone, over the line's bottom edge; the buttons in the folded bar (R724). */
    folded?: boolean;
    /** A button was pressed (its id: store, copy): the pick ends before the action runs. */
    onaction: (id: string) => void;
  } = $props();

  const why = $derived(clip.rowWhy(row));
  /** Over the empty entry line (R3), else above it (a tap can pick a row while the line has text; ▲ cannot). Read when
   *  the pick starts or moves (entry.value is not reactive): a key that types drops the pick, so the line cannot
   *  change under the buttons. */
  const over = $derived((void row, folded || entry.empty));
  /** A tap on a button must not take the caret out of the entry line. */
  const noFocus = (e: Event): void => e.preventDefault();
  /** R724: folded, the buttons go into the folded bar (its slot `[data-fold-acts]`, drawn in the same update: looked for
   *  again on the next frames until it is there), and back here when the keys come up; the bar's removal takes them with it. */
  function bar(node: HTMLElement, on: boolean): { update: (on: boolean) => void; destroy: () => void } {
    const home = node.parentElement;
    const place = (on: boolean, tries = 10): void => {
      const to = on ? document.querySelector("[data-fold-acts]") : home;
      if (to && node.parentElement !== to) to.append(node);
      else if (!to && tries > 0) requestAnimationFrame(() => place(folded, tries - 1));
    };
    place(on);
    return { update: (on) => place(on), destroy: () => node.remove() };
  }
</script>

<div class="rowslot" class:over style:min-height={over && !folded ? `${height}px` : undefined}>
  {#if why}<div class="rowwhy" data-testid="row-why">{why}</div>{/if}
  <div class="rowbar" class:inbar={folded} role="toolbar" aria-label={rowBarText("history.actions")} data-testid="row-actions" use:bar={folded}>
    {#each clip.rowButtons(row, part) as b (b.id)}
      <button type="button" data-item={b.id} disabled={b.disabled} onpointerdown={noFocus} onclick={() => { onaction(b.id); b.run?.(); }}>{b.label}</button>
    {/each}
  </div>
</div>

<style>
  /* the entry line is the screen's last row in the flow, so bottom 0 is its bottom edge; a long why line rises over the
     history's foot */
  .rowslot.over {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 4;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    background: var(--bg);
  }
  .rowbar {
    display: flex;
    gap: var(--sp-15);
    padding: var(--sp-1) var(--sp-3);
  }
  /* in the folded bar (R724): the row's full 44 px */
  .rowbar.inbar {
    flex: none;
    height: 100%;
    gap: var(--sp-05);
    padding: 0;
  }
  .rowbar.inbar button {
    flex: none;
    min-height: 0;
    min-width: var(--view-w);
    padding: 0 var(--sp-2);
  }
  .rowwhy {
    padding: var(--sp-05) var(--sp-3) 0;
    font-size: var(--fs-note);
    color: var(--muted);
    /* wraps: the σ part (R40f1) comes last and must not be cut off at phone width */
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .rowbar button {
    flex: 1;
    min-height: var(--touch);
    font: inherit;
    font-size: var(--fs-note);
    border-radius: var(--radius);
    border: var(--stroke-thin) solid var(--line);
    background: var(--panel);
    color: var(--text);
    padding: 0 var(--sp-1);
  }
  .rowbar button:disabled {
    color: var(--muted);
  }
</style>

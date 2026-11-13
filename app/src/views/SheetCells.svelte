<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  // R281: the letter grid above a list (the store sheet, views/storeSheet.svelte.ts): each cell its letter and, when the name
  // holds something, its value with its mark on a small line under it (cut with …; the line under the list shows it in
  // full). A free letter is dim. An armed cell (Sheet.armed: the first tap on a filled one) shows its question there.
  // Drawn by Sheet.svelte inside its list, so it scrolls with the names below it.
  import type { Row } from "./sheet.svelte.ts";

  let { rows, columns, highlight, armed, ontap }: { rows: readonly Row[]; columns: number; highlight: number; armed: string | null; ontap: (index: number) => void } = $props();
</script>

<div class="cells" data-testid="sheet-cells" style:grid-template-columns="repeat({columns}, minmax(0, 1fr))">
  {#each rows as r (r.index)}
    {@const on = armed === r.item.id}
    {@const line = on ? r.item.confirm?.cell : r.item.value}
    <button
      type="button"
      role="menuitem"
      class="lcell"
      class:filled={r.item.value !== undefined}
      aria-label={line ? `${r.item.label} ${line}` : r.item.label}
      data-active={r.index === highlight}
      data-armed={on}
      data-id={r.item.id}
      data-count={r.item.count ?? "row"}
      onclick={() => ontap(r.index)}
    ><span class="l">{r.item.label}</span>{#if line}<span class="v" data-testid="cell-value">{line}</span>{/if}</button>
  {/each}
</div>

<style>
  .cells {
    display: grid;
    gap: var(--sp-05);
    padding: var(--sp-05) 0 var(--sp-1);
    flex-shrink: 0;
  }
  .lcell {
    all: unset;
    box-sizing: border-box;
    height: var(--key-h-short);
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    line-height: 1.1;
    border-radius: var(--radius);
    border: var(--stroke-thin) solid var(--line);
    cursor: pointer;
  }
  .l {
    font-style: italic;
    font-size: var(--fs-ui);
    color: var(--text-dead);
  }
  .filled {
    background: var(--key-num);
  }
  .filled .l {
    color: var(--text);
  }
  .v {
    max-width: 100%;
    padding: 0 var(--sp-05);
    box-sizing: border-box;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: var(--fs-legend);
    color: var(--muted);
  }
  /* the highlighted cell (R12b): the picked-row roles, as the palettes' cells */
  .lcell[data-active="true"] {
    background: var(--pick);
    border-color: var(--focus);
    box-shadow: inset 0 calc(-1 * var(--stroke-thick)) 0 var(--focus);
  }
  .lcell[data-active="true"] .l {
    color: var(--text);
  }
  /* armed: asks before its value is replaced (the selection roles) */
  .lcell[data-armed="true"] {
    background: var(--sel);
  }
  .lcell[data-armed="true"] :is(.l, .v) {
    color: var(--on-sel);
  }
</style>

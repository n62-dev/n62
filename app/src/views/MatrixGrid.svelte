<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  // R188: a stored matrix in rows and columns (matrixGrid.svelte.ts), drawn as the Num view's table (FunctionNum.svelte:
  // the same row height, lines, right-aligned tabular digits and muted headers): the column numbers on top, the row
  // numbers on the left, each element through the Home formatter, the highlighted cell marked. A chunk of its own. The
  // thin space of a digit group is drawn as a gap (as apps/Grouped.svelte does; not imported: it would split a chunk
  // shared with the apps, whose preload lists are in the start chunk).
  import { t } from "../i18n/index.ts";
  import { findText } from "../i18n/enFind.ts";
  import type { MatrixGrid } from "./matrixGrid.svelte.ts";

  let { grid }: { grid: MatrixGrid } = $props();
  const cells = $derived(grid.cells);
  const cols = $derived(Array.from({ length: grid.cols }, (_, c) => c));
  const rows = $derived(Array.from({ length: grid.rows }, (_, r) => r));
</script>

<div class="grid" data-testid="matrix-grid" role="grid" aria-label={grid.name}>
  {#if cells === "failed"}
    <p class="empty">{findText("matrix.unread")}</p>
  {:else if cells === null}
    <p class="empty">…</p>
  {:else}
    <table>
      <thead>
        <tr>
          <th class="r"></th>
          {#each cols as c (c)}<th>{c + 1}</th>{/each}
        </tr>
      </thead>
      <tbody>
        {#each rows as r (r)}
          <tr>
            <th class="r">{r + 1}</th>
            {#each cols as c (c)}
              {@const cell = cells[r * grid.cols + c]}
              {@const text = cell ? grid.text(cell) : ""}
              <td data-cell="{r + 1},{c + 1}" data-text={text} data-active={r === grid.row && c === grid.col}>{#each grid.drawn(text).split("\u2009") as p, i (i)}{#if i > 0}<span class="gsep" aria-hidden="true"></span>{/if}{p}{/each}{#if cell && grid.warned(cell)}<span class="warn" data-testid="mark" title={t("mark.warn")}> ⚠</span>{/if}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .grid {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 0 var(--sp-2);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
    table-layout: fixed;
  }
  th,
  td {
    height: var(--line-h);
    padding: 0 var(--sp-15);
    text-align: right;
    border-bottom: var(--stroke-thin) solid var(--line);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: var(--fs-ui);
  }
  th {
    color: var(--muted);
    font-weight: 600;
    background: var(--bg);
  }
  th.r {
    width: var(--row-tile-w);
  }
  td[data-active="true"] {
    background: var(--pick);
    box-shadow: inset 0 calc(-1 * var(--stroke-thick)) 0 var(--focus);
  }
  .gsep {
    display: inline-block;
    width: var(--group-gap);
  }
  td > .warn {
    color: var(--warn);
  }
  .empty {
    margin: var(--sp-10) auto;
    text-align: center;
    color: var(--muted);
  }
</style>

<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  // R327: the uncertainty sheet's head (views/uncSheet.ts builds it; docs/mockups/uncertainty-sheet.html sections 3 and 4):
  // the result it explains with its mark, the short form, σ, U and relative σ as a list of terms, and the ⚠ line. No rows
  // under it until R328. Plain text: a screen reader reads the terms in order.
  import type { UncHead } from "./sheet.svelte.ts";

  let { head }: { head: UncHead } = $props();
</script>

<div class="head" data-testid="unc-head">
  <div class="of" data-testid="unc-of">{head.of}</div>
  {#if head.short !== null}<div class="short" data-testid="unc-short">{#if head.mark}<em class:w={head.mark === "⚠"}>{head.mark}</em>{" "}{/if}{head.short}</div>{/if}
  <dl>
    {#each head.rows as r (r.id)}<div class="term" data-id={r.id}><dt>{r.label}</dt><dd>{r.value}</dd></div>{/each}
  </dl>
  {#if head.warn}<div class="why" data-testid="unc-why">{head.warn}</div>{/if}
</div>

<style>
  .head {
    padding: var(--sp-1) var(--sp-2) var(--sp-2);
    overflow-wrap: anywhere;
  }
  .of {
    color: var(--muted);
    font-size: var(--fs-small);
    text-align: right;
  }
  .short {
    font-size: var(--fs-input);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .short em {
    font-style: normal;
    color: var(--approx);
  }
  .short em.w,
  .why {
    color: var(--warn);
  }
  dl {
    margin: var(--sp-1) 0 0;
    font-size: var(--fs-small);
  }
  .term {
    display: flex;
    justify-content: space-between;
    gap: var(--sp-2);
  }
  dt {
    color: var(--muted);
  }
  dd {
    margin: 0;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .why {
    font-size: var(--fs-note);
    margin-top: var(--sp-1);
  }
</style>

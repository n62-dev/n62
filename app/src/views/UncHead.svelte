<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  // R327: the uncertainty sheet's head (views/uncSheet.ts builds it; docs/mockups/uncertainty-sheet.html sections 3 and 4):
  // the result it explains with its mark, the short form, σ, U and relative σ as a list of terms, and the ⚠ line. R328:
  // under it the inputs' rows (budget/rows.ts), the level's items, so ▲ ▼ move the highlight; a row's bar ends in a stripe
  // above 100 %; then the muted lines. No words of its own (the start chunk draws it). Plain text: a screen reader reads the terms, then each row as label, uᵢ, share.
  import type { Level, UncHead } from "./sheet.svelte.ts";

  let { head, level, ontap }: { head: UncHead; level: Level; ontap: (index: number) => void } = $props();
  let box: HTMLDivElement | undefined = $state();
  // the highlighted row stays in sight as ▲ ▼ move it
  $effect(() => {
    void level.highlight;
    box?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  });
</script>

<div class="unc" bind:this={box}>

<div class="head" data-testid="unc-head">
  <div class="of" data-testid="unc-of">{head.of}</div>
  {#if head.short !== null}<div class="short" data-testid="unc-short">{#if head.mark}<em class:w={head.mark === "⚠"}>{head.mark}</em>{" "}{/if}{head.short}</div>{/if}
  <dl>
    {#each head.rows as r (r.id)}<div class="term" data-id={r.id}><dt>{r.label}</dt><dd>{r.value}</dd></div>{/each}
  </dl>
  {#if head.warn}<div class="why" data-testid="unc-why">{head.warn}</div>{/if}
</div>
{#if head.table}
  {#if head.table.rows.length}
    <div class="rows" data-testid="unc-rows">
      <div class="th" aria-hidden="true"><span>{head.table.columns[0]}</span><span class="n">{head.table.columns[1]}</span><span class="n">{head.table.columns[2]}</span></div>
      {#each head.table.rows as r, i (r.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus (the keypad drives the rows; nothing in a sheet takes focus) -->
        <div role="menuitem" class="r" class:second={r.second} aria-label={[r.label, r.uy, r.share, r.note].filter(Boolean).join(", ")} data-id={r.id} data-active={i === level.highlight} onclick={() => ontap(i)}>
          <span class="in"><span class="i">{i + 1}</span><span data-testid="unc-label">{r.label}</span>{#if r.sub}<span class="sub">{r.sub}</span>{/if}</span>
          <span class="n" data-testid="unc-uy">{r.uy}</span>
          <span class="n share"><span data-testid="unc-share">{r.share}</span><span class="meter"><i class:over={r.bar.over} class:neg={r.bar.neg} style:width="{r.bar.width}%" data-testid="unc-bar"></i></span></span>
          {#if r.note}<span class="note" data-testid="unc-note">{r.note}</span>{/if}
        </div>
      {/each}
    </div>
  {/if}
  {#if head.table.lines.length}<div class="lines" data-testid="unc-lines">{#each head.table.lines as l}<p>{l}</p>{/each}</div>{/if}
{/if}
</div>

<style>
  .unc {
    overflow-y: auto;
    min-height: 0;
  }
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
  /* R328: the rows, as the mockup's section 2 draws them (input, uᵢ, % of σ², a bar under the share) */
  .rows {
    font-size: var(--fs-small);
    font-variant-numeric: tabular-nums;
    border-top: var(--stroke-thin) solid var(--line);
  }
  .th,
  .r {
    display: grid;
    grid-template-columns: 1fr auto 6.5em;
    column-gap: var(--sp-2);
    padding: var(--sp-1) var(--sp-2);
  }
  .th {
    color: var(--muted);
    font-size: var(--fs-note);
    padding-bottom: 0;
  }
  .r {
    border-top: var(--stroke-thin) solid var(--line);
    min-height: 36px;
    box-sizing: border-box;
    overflow-wrap: anywhere;
  }
  .r[data-active="true"] {
    background: var(--pick);
    box-shadow: inset 3px 0 0 var(--focus);
  }
  .n {
    text-align: right;
    white-space: nowrap;
  }
  .i {
    color: var(--text-dead);
    font-size: var(--fs-note);
    margin-right: var(--sp-1);
  }
  .sub {
    display: block;
    color: var(--muted);
    font-size: var(--fs-note);
  }
  .second .in {
    color: var(--muted);
  }
  .meter {
    display: block;
    position: relative;
    height: 3px;
    margin-top: 3px;
    background: color-mix(in srgb, var(--line) 60%, transparent);
  }
  .meter i {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    background: var(--focus);
  }
  /* above 100 %: the bar is full and ends in a stripe */
  .meter i.over {
    background: repeating-linear-gradient(90deg, var(--focus) 0 6px, var(--warn) 6px 8px);
  }
  .meter i.neg {
    left: auto;
    right: 0;
    background: var(--warn);
  }
  .note {
    grid-column: 1 / -1;
    color: var(--warn);
    font-size: var(--fs-note);
  }
  .lines {
    padding: var(--sp-1) var(--sp-2) var(--sp-2);
    border-top: var(--stroke-thin) solid var(--line);
    color: var(--muted);
    font-size: var(--fs-note);
  }
  .lines p {
    margin: 2px 0;
  }
</style>

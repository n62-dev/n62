<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  // R149: the credits (views/creditsSheet.ts) as a list that rolls up at about 20 px/s, once to the end, then stays. The
  // owner's one exception to docs/05 rule 6 (sheets appear at once): only the text inside the sheet moves. A touch, a wheel
  // turn or ▲ ▼ stops the roll and leaves the text where it was, to scroll by hand; under reduced motion nothing rolls, and
  // a screen reader reads a plain list with headings.
  import type { CreditBlock, Level } from "./sheet.svelte.ts";

  let { blocks, level }: { blocks: readonly CreditBlock[]; level: Level } = $props();

  /** The speed the text rolls at (px/s). */
  const SPEED = 20;
  let list: HTMLDivElement | undefined = $state();
  let inner: HTMLDivElement | undefined = $state();
  /** The empty lead the text starts below (the view's height) and the distance it rolls, in px. */
  let lead = $state(0);
  let roll = $state(0);
  let rolling = $state(false);

  $effect(() => {
    if (!list || !inner || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    lead = list.clientHeight;
    const id = requestAnimationFrame(() => {
      if (!list || !inner) return;
      roll = inner.offsetHeight - list.clientHeight;
      rolling = roll > 0;
    });
    return () => cancelAnimationFrame(id);
  });

  /** Stop where it is: the text stays there, and the finger (or a key) scrolls from that place. */
  function halt(): void {
    if (!rolling || !list || !inner) return;
    const y = -new DOMMatrixReadOnly(getComputedStyle(inner).transform).m42;
    rolling = false;
    list.scrollTop = y;
  }
  // ▲ ▼ page through it (Level.nudge counts the pages asked for)
  $effect(() => {
    const n = level.nudge;
    if (n === 0 || !list) return;
    halt();
    list.scrollBy({ top: n * list.clientHeight * 0.8 });
    level.nudge = 0;
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions (a touch only stops the roll; the text is a plain list with headings) -->
<div class="credits" data-testid="credits" data-rolling={rolling} bind:this={list} onpointerdown={halt} onwheel={halt} ontouchstart={halt}>
  <div class="roll" class:on={rolling} style:--lead="{lead}px" style:--roll={roll} style:--dur="{roll / SPEED}s" bind:this={inner}>
    {#each blocks as b, i (i)}
      {#if "heading" in b}<h3>{b.heading}</h3>{:else}<p class:story={i === 0}>{b.text}</p>{/if}
    {/each}
  </div>
</div>

<style>
  .credits {
    overflow-y: auto;
    min-height: 0;
    overscroll-behavior: contain;
    padding: 0 var(--sp-2);
    text-align: center;
    overflow-wrap: anywhere;
    line-height: 1.4;
  }
  .roll {
    padding-top: var(--lead, 0);
    padding-bottom: var(--sp-2);
  }
  .roll.on {
    animation: credits-roll var(--dur) linear forwards;
  }
  @keyframes credits-roll {
    to {
      transform: translateY(calc(-1px * var(--roll)));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .roll.on {
      animation: none;
    }
  }
  h3 {
    margin: var(--sp-3) 0 0;
    font-size: var(--fs-small);
    font-weight: 600;
    color: var(--text);
  }
  p {
    margin: 0;
    font-size: var(--fs-note);
    color: var(--muted);
  }
  p.story {
    font-size: var(--fs-input);
    color: var(--text);
    margin: var(--sp-2) 0;
  }
</style>

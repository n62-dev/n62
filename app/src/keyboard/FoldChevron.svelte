<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- R724 (decisions.md P16): ⌄ on the entry field's lower-left corner, half on its outline; a tap folds the keypad as the
     line's swipe does (App.svelte counts it `fold.tap`). A 16 px stroke icon in a 48 × 48 touch box that stays inside the
     entry row (its bottom is the row's), so it never reaches the bar; the field's left padding is --chev-pad, so no text
     lies under it. The box takes no tap on the field's text: over the field it is 32 px wide (clip-path), below it 48, so a
     tap on the line's first term still places the caret. Drawn in Home and CAS only (no app, not the wide layout), never while folded; in the fold's chunk. -->
<script lang="ts">
  import { keyFeelText as t } from "../i18n/enKeyFeel.ts";

  let { onfold }: { onfold: () => void } = $props();
  /** A tap must not take the caret out of the entry line. */
  const noFocus = (e: Event): void => e.preventDefault();
</script>

<button type="button" class="chev" data-testid="fold-chevron" aria-label={t("keys.fold")} onpointerdown={noFocus} onclick={onfold}>
  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5.5 8 10.5l5-5" /></svg>
</button>

<style>
  .chev {
    position: absolute;
    z-index: 1;
    left: 0;
    bottom: 0;
    width: var(--chev-hit);
    height: var(--chev-hit);
    padding: 0;
    border: 0;
    background: none;
    color: var(--muted);
    -webkit-tap-highlight-color: transparent;
    clip-path: polygon(0 0, var(--chev-take) 0, var(--chev-take) calc(100% - var(--sp-2)), 100% calc(100% - var(--sp-2)), 100% 100%, 0 100%);
  }
  /* centred on the field's corner: the entry row's padding from the box's left and bottom edges */
  svg {
    position: absolute;
    left: calc(var(--sp-3) - var(--icon-w) / 2);
    bottom: calc(var(--sp-2) - var(--icon-w) / 2);
    width: var(--icon-w);
    height: var(--icon-w);
    border-radius: 50%;
    background: var(--bg);
    fill: none;
    stroke: currentColor;
    stroke-width: var(--chev-stroke);
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>

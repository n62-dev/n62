<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  // R284: the inside of the engine-failed note (App.svelte draws the note itself): why the engine did not start,
  // from the failure's kind (state/session.svelte.ts engineFailure), and Reload. A lazy chunk, fetched on a failure.
  import { enFail } from "../i18n/enFail.ts";

  let { kind }: { kind: "load" | "memory" | "crash" | undefined } = $props();
</script>

{enFail[kind ?? "crash"]}
<button type="button" class="reload" data-testid="engine-reload" onclick={() => location.reload()}>{enFail.reload}</button>

<style>
  /* the note says why, so it wraps inside the stage (360 px) and is centred; these rules come with the note's chunk (the selector outweighs App's scoped one) */
  :global(.enginenote[role][data-testid]) {
    white-space: normal;
    text-align: center;
    width: max-content;
    max-width: calc(100% - 2 * var(--sp-4));
    border-radius: var(--radius-l);
  }
  /* the only part of the note that takes a touch (the note itself lets touches through) */
  .reload {
    pointer-events: auto;
    display: block;
    margin: var(--sp-15) auto 0;
    min-height: 36px;
    padding: var(--sp-1) var(--sp-4);
    border: var(--stroke-thin) solid var(--line);
    border-radius: var(--radius-pill);
    background: var(--panel);
    color: var(--text);
    font: inherit;
    cursor: pointer;
  }
</style>

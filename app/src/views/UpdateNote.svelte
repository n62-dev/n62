<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A49, R97, R722: the Restart button of a waiting update, a pill at the stage's top beside the engine's notes (App.svelte
     loads this chunk only when state/updateOffer.svelte.ts holds a restart function). -->
<script lang="ts">
  import { t } from "../i18n/index.ts";
  import { pressFlag } from "../input/pressFlag.ts";

  let { restart }: { restart: () => void } = $props();
</script>

<button type="button" class="update" use:pressFlag data-testid="update-note" title={t("update.ready")} onclick={restart}>{t("update.restart")}</button>

<style>
  /* at the stage's top right, so it never covers the engine's note in the middle */
  .update {
    all: unset;
    box-sizing: border-box;
    cursor: pointer;
    position: absolute;
    top: var(--sp-2);
    right: var(--sp-2);
    z-index: 1;
    min-height: var(--bar-h);
    padding: 0 var(--sp-35);
    display: flex;
    align-items: center;
    border-radius: var(--radius-pill);
    background: var(--panel);
    border: var(--stroke-thin) solid var(--line);
    font-size: var(--fs-note);
    font-weight: 700;
    white-space: nowrap;
    color: var(--shift);
  }
  .update:global([data-down]) {
    background: var(--key-nav);
    color: var(--key-shift);
  }
</style>

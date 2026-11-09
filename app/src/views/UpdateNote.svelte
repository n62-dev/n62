<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- A49, R97: the Restart button of a waiting update, in the status line (views/StatusLine.svelte loads this chunk only
     when state/updateOffer.svelte.ts holds a restart function). -->
<script lang="ts">
  import { t } from "../i18n/index.ts";
  import { pressFlag } from "../input/pressFlag.ts";

  let { restart }: { restart: () => void } = $props();
</script>

<button type="button" class="update" use:pressFlag data-testid="update-note" title={t("update.ready")} onclick={restart}>{t("update.restart")}</button>

<style>
  /* (the status line's `header button` reset does not reach into this component, so it is repeated here) */
  .update {
    all: unset;
    box-sizing: border-box;
    cursor: pointer;
    flex: none;
    margin-left: auto;
    padding: 0 var(--sp-15);
    display: flex;
    align-items: center;
    font-size: var(--fs-caption);
    font-weight: 700;
    white-space: nowrap;
    color: var(--shift);
  }
  .update:global([data-down]) {
    background: var(--key-nav);
    color: var(--key-shift);
  }
</style>

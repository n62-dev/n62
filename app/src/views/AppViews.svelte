<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import type { Key, Layer } from "../keyboard/keyboard.ts";
  import type { AppShell } from "../apps/shell.svelte.ts";
  import { t } from "../i18n/index.ts";
  import { ICONS } from "./icons.ts";
  import { pressFlag } from "../input/pressFlag.ts";

  // R782 (a start-chunk cut): the bay's view icons in an open app, out of views/StatusLine.svelte (which is in the start chunk);
  // this part comes in with the shell's app-opening chunk (apps/shellOpen.ts), so the bay is drawn once an app is opening.
  let { shell, onpress }: { shell: AppShell; onpress: (key: Key, layer: Layer) => void } = $props();

  const TABS = (["symb", "plot", "num"] as const).map((view) => ({
    view,
    name: t(`view.${view}`),
    key: { id: `tab-${view}`, row: 0, col: 0, span: 1, cls: "nav", label: { primary: "" }, actions: { primary: { kind: "special", name: view } } } satisfies Key,
  }));
</script>

<!-- the icons are our own markup (ICONS, views/icons.ts), never user text -->
<span class="seg" role="tablist" aria-label={t("status.views")}>
  {#each TABS.filter((tb) => shell.views.includes(tb.view)) as tab (tab.view)}
    <button
      type="button"
      class="tab"
      role="tab"
      use:pressFlag
      data-testid="tab-{tab.view}"
      aria-selected={shell.view === tab.view}
      aria-label={tab.name}
      title={tab.name}
      onclick={() => onpress(tab.key, "primary")}>
      <span class="face">{@html ICONS[tab.view]}</span>
    </button>
  {/each}
</span>

<style>
  /* the bar's button reset (views/StatusLine.svelte `:where(.bar) button`), for this part's buttons */
  :where(:global(.bar)) button {
    all: unset;
    box-sizing: border-box;
    cursor: pointer;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: var(--bar-h);
  }
  /* R856: the views as icons, one track of segments drawn inside the bar's height, as Home and slot 2's (StatusLine.svelte):
     the recessed track, the current view filled in --key-on (3:1 on the bar; the old --chip-bg fill was 1.1:1) */
  .seg {
    flex: none;
    position: relative;
    display: flex;
    gap: var(--sp-05);
    padding: 0 var(--sp-05);
  }
  .seg::before {
    content: "";
    position: absolute;
    inset: var(--sp-05) 0;
    background: var(--bar-track);
    box-shadow: inset 0 0 0 var(--stroke-thin) color-mix(in srgb, var(--line) 55%, transparent);
    border-radius: calc(var(--radius-s) + var(--stroke-thin));
    pointer-events: none;
  }
  .tab {
    position: relative;
    width: var(--bay-view-w);
    color: var(--muted);
    font-size: var(--fs-ui);
  }
  .face {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: var(--tab-h);
    border-radius: calc(var(--radius-s) - var(--stroke-thin));
  }
  /* R774: a pressed view fills its face, inside the track (the bar's [data-down] rule, StatusLine.svelte, would fill the whole button) */
  :global(.bar) .tab:global([data-down]) {
    background: none;
  }
  :global(.bar) .tab:not([aria-selected="true"]):global([data-down]) .face {
    background: var(--key-nav);
  }
  .tab[aria-selected="true"] {
    color: var(--on-key-on);
  }
  .tab[aria-selected="true"] .face {
    background: var(--key-on);
  }
</style>

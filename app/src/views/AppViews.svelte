<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import type { Key, Layer } from "../keyboard/keyboard.ts";
  import type { AppShell } from "../apps/shell.svelte.ts";
  import { t } from "../i18n/index.ts";
  import { shellText } from "../i18n/enShell.ts";
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
<span class="seg" role="tablist" aria-label={shellText("status.views")}>
  {#each TABS.filter((tb) => shell.views.includes(tb.view)) as tab (tab.view)}
    <button
      type="button"
      class="tab"
      role="tab"
      use:pressFlag
      data-testid="tab-{tab.view}"
      data-item={tab.view}
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
     the recessed track, the current view filled in --key-on (3:1 on the bar; the old --chip-bg fill was 1.1:1). Each button is
     its face and 1 px on each side, so the faces stand 2 px apart and from the track's edge (the mock-up's 30 px segments) and a
     tap between two faces still lands on one of them */
  .seg {
    flex: none;
    position: relative;
    display: flex;
    padding: 0 var(--stroke-thin);
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
  /* R928: in the folded bar (keyboard/Fold.svelte, Plot only), after the track (its order) at the open bar's distance (its gaps
     and the divider, hidden there), so each view stands where it does open; the track is drawn the open bar's height */
  :global(.bar.folded) .seg {
    order: 1;
    margin-left: var(--sp-1);
  }
  /* R781: Hand = Left mirrors the folded row, so the room is on the other side */
  :global(:root[data-hand="left"] .bar.folded) .seg {
    margin-left: 0;
    margin-right: var(--sp-1);
  }
  :global(.bar.folded) .seg::before {
    inset: calc((100% - var(--bar-h)) / 2 + var(--sp-05)) 0;
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
    width: calc(100% - 2 * var(--stroke-thin));
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

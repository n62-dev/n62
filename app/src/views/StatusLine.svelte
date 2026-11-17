<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import { APPS, placeGlyph } from "../apps/registry.ts";
  import type { AppShell } from "../apps/shell.svelte.ts";
  import { t, type MessageKey } from "../i18n/index.ts";
  import { alphaLower, type Key, type Layer } from "../keyboard/keyboard.ts";
  import type { Session } from "../state/session.svelte.ts";
  import { pressFlag } from "../input/pressFlag.ts";

  // R97, R722: the bar on the keypad's top edge, out of App.svelte. Props in, events out; no store of its own.
  let { session, shell, busy, cas, onpress, onmode }: {
    session: Session;
    shell: AppShell;
    /** A job runs (session or app). */
    busy: boolean;
    /** The CAS view is under the keys, where Alpha alone types lower case (R58). */
    cas: boolean;
    /** A tap on a control, as the press of a key (the same path as a key press). */
    onpress: (key: Key, layer: Layer) => void;
    /** A tap on a mode chip: the Mode sheet, on that row. */
    onmode: (at: string) => void;
  } = $props();

  /** A bar control as a key (R15b, R15c1, R722): its tap takes the same path as a key press (an open sheet gives way, it runs at once while an app loads, and waits while a sheet's code loads). */
  const barKey = (id: string, name: "apps" | "home" | "cas" | "symb" | "plot" | "num" | "menu"): Key => ({ id, row: 0, col: 0, span: 1, cls: "nav", label: { primary: "" }, actions: { primary: { kind: "special", name } } });
  const PLACE_KEY = barKey("place", "apps"), MENU_KEY = barKey("menu-status", "menu");
  const TABS = (["symb", "plot", "num"] as const).map((v) => ({ view: v, name: t(`view.${v}`), key: barKey(`tab-${v}`, v) }));
  const PLACES = (["home", "cas"] as const).map((v) => ({ view: v, name: t(`view.${v}`), glyph: placeGlyph(v), key: barKey(`tab-${v}`, v) }));

  const appName = $derived(shell.app ? t(APPS.find((a) => a.id === shell.app)?.name as MessageKey) : "");
  /** Where you are (docs/05 3.2): Home, CAS, or an app and its view. */
  const place = $derived(shell.app === null ? t(`view.${session.view}`) : appName);
  const angle = $derived(session.settings.angle);
  const glyph = $derived(shell.app === null ? null : placeGlyph(shell.app));
  /** The current tile's ring: a job running, or the engine starting (R82f2: the ⟳ went). */
  const ring = $derived(busy || session.engineState === "starting");
  /** The ⇧ α slot: one sign, underlined when locked; `a` when Alpha types lower case here, `α` when it types capitals (R101). */
  const mod = $derived(
    session.alpha
      ? { alpha: true, lock: session.alphaLock, text: alphaLower(session.shift, true, cas) ? "a" : "α" }
      : session.shift
        ? { alpha: false, lock: session.shiftLock, text: "⇧" }
        : null,
  );
  /** The bar is not a place for typing: a tap on it must not take the caret out of the entry line. */
  const noFocus = (e: Event): void => e.preventDefault();

  // The guard (R722): the bar sits on the keys, so a touch that began on a key may end over it. A control acts only on a
  // pointer that went down on it: every down anywhere disarms (the window's capture listener runs first), a down in the
  // bar arms the control under it, and a click on any other control is stopped in the capture phase, before the
  // controls' own (delegated) handlers. A click with no pointer (Enter or Space on a focused control, a screen reader's
  // activation: detail 0) acts as it always did.
  let armed: Element | null = null;
  $effect(() => {
    const disarm = (): void => void (armed = null);
    window.addEventListener("pointerdown", disarm, true);
    return () => window.removeEventListener("pointerdown", disarm, true);
  });
  const down = (e: PointerEvent): void => {
    noFocus(e);
    armed = (e.target as Element | null)?.closest("button") ?? null;
  };
  const guard = (e: MouseEvent): void => {
    const ok = e.detail === 0 || armed === (e.target as Element | null)?.closest("button");
    armed = null;
    if (!ok) e.stopPropagation();
  };

  /** R722: `bar.angle` counts each angle-chip tap, `bar.angle.undo` a tap within 3 s of the one before, which takes it back
   *  (uses.svelte.ts countTap, under its own key; decisions.md "The bar on the keypad"). */
  const switchAngle = (): void => {
    const at = Date.now();
    void session.uses("bar-uses").then((c) => c.countTap("bar.angle", at), () => {});
    session.setAngle(angle === "rad" ? "deg" : "rad");
  };
</script>

  <!-- the bar (docs/05 3.2, R722): on the keypad's top edge, 28 px, its targets its full height. Apps ▾ (in an app its
       glyph ▾ and the views), the Home and CAS tabs, the fixed ⇧ α slot, the angle, format and digits chips, ☰; the order
       is the lock's `bar:` list (barItems.ts). Nothing in it changes width with Shift, Alpha or the engine's state, so a
       press never moves a control from under the finger; the engine's and the update's notes show in the stage. -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions (only keeps the caret in the entry line and arms the guard; the buttons inside are the controls) -->
  <nav class="bar" class:inapp={shell.app !== null} data-testid="bar" data-engine={session.engineState} data-busy={busy} aria-label={t("status.bar")} onpointerdown={down} onclickcapture={guard}>
    <button
      type="button"
      class="place"
      use:pressFlag
      data-testid="place"
      data-item="apps"
      data-tip="place"
      data-app={shell.app ?? ""}
      data-view={shell.app === null ? session.view : shell.view}
      aria-label={t("status.place", { place })}
      onclick={() => onpress(PLACE_KEY, "primary")}>
      {#if glyph}
        <!-- the glyph is our own table's text (registry.ts), never user text -->
        <span class="tile math" class:small={"text" in glyph && glyph.text.length > 1} data-ring={ring} aria-hidden="true">{"text" in glyph ? glyph.text : ""}</span>
      {:else}
        <span class="tile grid" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      {/if}
      <span class="caret" aria-hidden="true">▾</span>
    </button>
    {#if shell.app !== null}
      <span class="seg" role="tablist" aria-label={t("status.views")}>
        {#each TABS.filter((tb) => shell.views.includes(tb.view)) as tab (tab.view)}
          <!-- the icons are our own markup (ICONS, views/icons.ts), never user text; they ride in the shell's app-opening chunk (R362), so a tab is drawn empty until it is in -->
          <button
            type="button"
            class="tab"
            role="tab"
            data-testid="tab-{tab.view}"
            aria-selected={shell.view === tab.view}
            aria-label={tab.name}
            title={tab.name}
            onclick={() => onpress(tab.key, "primary")}>
            <span class="face">{@html shell.code?.ICONS[tab.view] ?? ""}</span>
          </button>
        {/each}
      </span>
    {/if}
    <span class="sep" aria-hidden="true"></span>
    <span class="places" role="tablist" aria-label={t("status.places")}>
      {#each PLACES as p (p.view)}
        {@const cur = shell.app === null && session.view === p.view}
        <!-- Home's tile is the app icon's (R157): the black mark on the logo teal, the same in every theme -->
        <button
          type="button"
          class="ptab"
          class:cur
          role="tab"
          use:pressFlag
          data-testid="tab-{p.view}"
          data-item={p.view}
          aria-selected={cur}
          aria-label={p.name}
          onclick={() => onpress(p.key, "primary")}>
          <span class="tile" class:logo={"icon" in p.glyph} class:math={"text" in p.glyph} data-ring={cur && ring} aria-hidden="true">{#if "icon" in p.glyph}<span class="logomark"></span>{:else}{p.glyph.text}{/if}</span>
          <span class="nm" aria-hidden="true">{p.name}</span>
        </button>
      {/each}
    </span>
    <span class="slot" data-testid="mod-slot">
      <span
        class="mod"
        data-testid={mod ? `mod-${mod.alpha ? "alpha" : "shift"}` : undefined}
        data-lock={mod?.lock}
        aria-label={mod && t(mod.alpha ? "key.alpha" : "key.shift")}>{mod?.text}</span>
    </span>
    <button
      type="button"
      class="chip"
      data-testid="chip-angle"
      data-item="angle"
      data-angle={angle}
      data-changed={angle !== "rad"}
      aria-label={t("status.angle", { angle: t(`angle.${angle}`) })}
      onclick={switchAngle}>{angle === "rad" ? "RAD" : "DEG"}</button>
    <span class="pair" aria-label={t("status.format", { format: t(`format.${session.settings.format}`) })}>
      <button type="button" class="chip more format" data-testid="chip-format" data-item="format" onclick={() => onmode("format")}>{session.settings.format.toUpperCase()}</button>
      <button type="button" class="chip more digits" data-testid="chip-digits" data-item="digits" onclick={() => onmode("digits")}>{session.settings.digits}</button>
    </span>
    <button type="button" class="menubtn" use:pressFlag data-testid="menu-button" data-item="menu" data-tip="menu" aria-label={t("status.menu")} onclick={() => onpress(MENU_KEY, "primary")}>☰</button>
    <!-- the busy ring is drawn on an aria-hidden tile: a screen reader hears the job from this hidden line (R102) -->
    {#if busy}<span class="sr" role="status" data-testid="busy-status">{t("status.busy")}</span>{/if}
  </nav>

<style>
  /* the bar (R722): on the keypad's top edge, the keypad's ground; its line on top as an inset shadow, so the targets keep
     the full 28 px, and every target is the bar's full height */
  .bar {
    flex: none;
    display: flex;
    align-items: stretch;
    gap: var(--sp-05);
    box-sizing: border-box;
    height: var(--bar-h);
    background: var(--panel);
    box-shadow: inset 0 var(--stroke-thin) 0 var(--line);
    font-size: var(--fs-note);
    line-height: 1;
  }
  .sr {
    position: absolute;
    width: var(--stroke-thin);
    height: var(--stroke-thin);
    margin: calc(-1 * var(--stroke-thin));
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  /* (in :where, so each control's own class sets its size over this reset) */
  :where(.bar) button {
    all: unset;
    box-sizing: border-box;
    cursor: pointer;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: var(--bar-h);
  }
  /* the icons come from ICONS through {@html}, outside the component's scope */
  .bar :global(svg) {
    display: block;
    width: var(--icon-w);
    height: var(--icon-h);
  }
  .bar :global(.math) {
    font-family: "STIX Two Math", "Cambria Math", "Times New Roman", serif;
    font-style: italic;
  }
  .bar :global([data-down]) {
    background: var(--key-nav);
    color: var(--key-text);
  }
  /* the place (R15b, R82f2, R722): Apps (a grid tile) or the app's glyph tile, and ▾; it opens Apps. From the screen's
     left edge. */
  .place {
    gap: var(--sp-05);
    padding: 0 var(--sp-05) 0 var(--sp-15);
    color: var(--text);
  }
  .tile {
    position: relative;
    flex: none;
    box-sizing: border-box;
    width: var(--tile-w);
    height: var(--tile-h);
    border-radius: var(--radius-s);
    background: var(--chip-bg);
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--fs-glyph);
    font-weight: 400;
  }
  .tile.grid {
    display: grid;
    grid-template-columns: var(--grid-dot) var(--grid-dot);
    gap: var(--sp-05);
    place-content: center;
  }
  .tile.grid i {
    width: var(--grid-dot);
    height: var(--grid-dot);
    border-radius: var(--sp-05);
    background: var(--muted);
  }
  .tile.logo {
    background: var(--logo-ground);
  }
  /* the mark as a mask of the one file (public/n62-mark.svg) in --logo-ink */
  .tile :global(.logomark) {
    width: var(--tile-mark);
    height: var(--tile-mark);
    background: var(--logo-ink);
    -webkit-mask: url("/n62-mark.svg") center / contain no-repeat;
    mask: url("/n62-mark.svg") center / contain no-repeat;
  }
  .tile.small {
    font-size: var(--fs-small);
  }
  /* busy or starting: a 2 px ring over the current tile, its size unchanged */
  .tile[data-ring="true"]::after {
    content: "";
    position: absolute;
    inset: 0;
    border: var(--stroke) solid var(--alpha);
    border-radius: var(--radius-s);
    box-sizing: border-box;
  }
  .caret {
    font-size: var(--fs-caption);
    color: var(--muted);
  }
  /* the views as icons, one segmented control drawn inside the bar's height; the selected one filled */
  .seg {
    flex: none;
    position: relative;
    display: flex;
  }
  .seg::before {
    content: "";
    position: absolute;
    inset: var(--sp-05) 0;
    border: var(--stroke-thin) solid var(--line);
    border-radius: calc(var(--radius-s) + var(--stroke-thin));
    pointer-events: none;
  }
  .tab {
    width: var(--view-w);
    color: var(--muted);
    font-size: var(--fs-ui);
  }
  .face {
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(100% - 2 * var(--sp-05));
    height: var(--tab-h);
    border-radius: calc(var(--radius-s) - var(--stroke-thin));
  }
  .tab[aria-selected="true"] {
    color: var(--text);
  }
  .tab[aria-selected="true"] .face {
    background: var(--chip-bg);
  }
  .sep {
    flex: none;
    width: var(--stroke-thin);
    margin: var(--sp-2) var(--sp-05);
    background: var(--line);
  }
  /* Home and CAS: a tile and the name; the current one on the nav ground, underlined in --key-on */
  .places {
    display: flex;
    gap: var(--sp-05);
    min-width: 0;
  }
  /* at a large font scale the name is what gives way (R41: the chips stay whole), down to the tile */
  .ptab {
    flex-shrink: 1;
    min-width: calc(var(--tile-w) + 2 * var(--sp-1));
    gap: var(--sp-1);
    padding: 0 var(--sp-1);
    color: var(--muted);
    font-weight: 700;
    white-space: nowrap;
  }
  .nm {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ptab .tile {
    opacity: 0.75;
  }
  .ptab.cur {
    color: var(--text);
    background: var(--key-nav);
    box-shadow: inset 0 calc(-1 * var(--stroke-thick)) 0 var(--key-on);
  }
  .ptab.cur .tile {
    opacity: 1;
  }
  /* in an app neither is current: the glyphs only */
  .inapp .nm {
    display: none;
  }
  .inapp .ptab {
    min-width: var(--tile-w);
    padding: 0;
  }
  /* the fixed ⇧ α slot: always 16 px, so Shift or Alpha moves nothing; it takes the room left over */
  .slot {
    flex: none;
    width: var(--icon-w);
    margin-left: auto;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .mod {
    color: var(--shift);
    font-weight: 700;
    line-height: var(--lh-small);
  }
  .mod[data-testid="mod-alpha"] {
    color: var(--alpha);
  }
  .mod[data-lock="true"] {
    box-shadow: inset 0 calc(-1 * var(--stroke)) 0 currentColor;
  }
  /* the chips: the bar's height, outlined; the format and digits ones with a small ▾ (they open Mode) */
  .chip {
    padding: 0 var(--sp-1);
    border-radius: calc(var(--radius-s) + var(--stroke-thin));
    box-shadow: inset 0 0 0 var(--stroke-thin) var(--line);
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .chip.more::after {
    content: "▾";
    margin-left: var(--stroke-thin);
    font-size: var(--mark-size);
    color: var(--muted);
  }
  /* a changed angle: filled in --key-on (R722; not --shift, which is the Shift key's) */
  .chip[data-changed="true"] {
    background: var(--key-on);
    color: var(--on-enter);
    box-shadow: none;
    font-weight: 700;
  }
  .pair {
    display: flex;
    gap: var(--sp-05);
  }
  .menubtn {
    width: var(--menu-w);
    font-size: var(--fs-key-fn);
    color: var(--text);
  }
  /* narrow (a phone under 400 px wide): the tab that is not current shows its glyph only; in an app the views keep their
     32 px, the room is won from the gaps, the separator's margins and ☰, and STD and 12 share one chip with one ▾ */
  @media (max-width: 400px) {
    .ptab:not(.cur) .nm {
      display: none;
    }
    .ptab:not(.cur) {
      min-width: var(--tile-w);
      padding: 0;
    }
    .inapp .sep {
      margin: var(--sp-2) 0;
    }
    .inapp,
    .inapp .places {
      gap: var(--stroke-thin);
    }
    .inapp .menubtn {
      width: var(--bar-h);
    }
    .inapp .pair {
      gap: 0;
      border-radius: calc(var(--radius-s) + var(--stroke-thin));
      box-shadow: inset 0 0 0 var(--stroke-thin) var(--line);
    }
    .inapp .pair .chip {
      box-shadow: none;
    }
    .inapp .chip.format {
      padding-right: var(--sp-05);
    }
    .inapp .chip.format::after {
      content: none;
    }
  }
</style>

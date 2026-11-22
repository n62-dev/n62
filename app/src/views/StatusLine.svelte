<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import { appEntry, placeGlyph } from "../apps/registry.ts";
  import type { AppId } from "../apps/types.ts";
  import type { AppShell } from "../apps/shell.svelte.ts";
  import { t } from "../i18n/index.ts";
  import { alphaLower, type Key, type Layer } from "../keyboard/keyboard.ts";
  import type { Session } from "../state/session.svelte.ts";
  import { pressFlag } from "../input/pressFlag.ts";
  import { HOUSE } from "./house.ts";

  // R97, R722: the bar on the keypad's top edge, out of App.svelte. Props in, events out; no store of its own.
  let { session, shell, busy, cas, onpress, onmode, onfold, hw = false, folded = false }: {
    session: Session;
    shell: AppShell;
    /** A job runs (session or app). */
    busy: boolean;
    /** The CAS view is under the keys, where Alpha alone types lower case (R58). */
    cas: boolean;
    /** A tap on a control, as the press of a key (the same path as a key press). */
    onpress: (key: Key, layer: Layer) => void;
    /** A tap on `STD 12 ▾`: the Mode sheet, on that row. */
    onmode: (at: string) => void;
    /** R786: ⌄ at the bar's left end folds the keypad (Home and CAS, not wide, the fold's code in). Not given: the 28 px cell stays empty, so nothing to its right moves. */
    onfold?: () => void;
    /** R783: a hardware keyboard is in use (input/hwSeen.svelte.ts): the ⇧ α badge shows with the keys up too. */
    hw?: boolean;
    /** R724: in the folded bar (keyboard/Fold.svelte): the nav lays out as Fold's row (display: contents), and only the
     *  tabs, the slot, the modes group (R856; hidden while a row is picked) and ☰ show, each at its place in the row (`order`)
     *  among Fold's ⌃, free stretch and row buttons. */
    folded?: boolean;
  } = $props();

  /** A bar control as a key (R15b, R15c1, R722): its tap takes the same path as a key press (an open sheet gives way, it runs at once while an app loads, and waits while a sheet's code loads). */
  const barKey = (id: string, name: "apps" | "home" | "slot" | "menu"): Key => ({ id, row: 0, col: 0, span: 1, cls: "nav", label: { primary: "" }, actions: { primary: { kind: "special", name } } });
  const PLACE_KEY = barKey("place", "apps"), MENU_KEY = barKey("menu-status", "menu");
  const HOME_KEY = barKey("tab-home", "home"), SLOT_KEY = barKey("tab-slot", "slot");

  /** A place's name: Home, CAS or an app's. */
  const nameOf = (p: string): string => (p === "home" || p === "cas" ? t(`view.${p}`) : t(appEntry(p as AppId).name));
  /** Where you are (docs/05 3.2): Home, CAS, or an app and its view. */
  const place = $derived(nameOf(shell.app ?? session.view));
  const angle = $derived(session.settings.angle);
  /** R782: slot 2 holds CAS or an app (Settings.barSlot); Home is fixed. Each pill is its glyph and a short name, one width everywhere. */
  const barSlot = $derived(session.settings.barSlot);
  const slotCur = $derived(shell.app === null ? barSlot === "cas" && session.view === "cas" : shell.app === barSlot);
  /** APP▾ shows a place's glyph, highlighted and with the ring, when that place is current and not in a pill: an app that is not in slot 2, or CAS once slot 2 holds an app. */
  const appCur = $derived(shell.app !== null ? shell.app !== barSlot : session.view === "cas" && barSlot !== "cas");
  const glyph = $derived(appCur ? placeGlyph(shell.app ?? "cas") : null);
  const PILLS = $derived([
    { id: "home", key: HOME_KEY, cur: shell.app === null && session.view === "home", place: "home", name: t("view.home"), label: t("view.home") },
    { id: "slot", key: SLOT_KEY, cur: slotCur, place: barSlot, name: barSlot === "cas" ? t("view.cas") : t(appEntry(barSlot).short), label: t("status.slot", { place: nameOf(barSlot) }) },
  ] as const);
  /** The current tile's ring: a job running, or the engine starting (R82f2: the ⟳ went). */
  const ring = $derived(busy || session.engineState === "starting");
  /** The ⇧ α slot: one sign, underlined when locked; `a` when Alpha types lower case here, `α` when it types capitals (R101). */
  const mod = $derived(
    session.alpha
      ? { id: "alpha" as const, lock: session.alphaLock, text: alphaLower(session.shift, true, cas) ? "a" : "α" }
      : session.shift
        ? { id: "shift" as const, lock: session.shiftLock, text: "⇧" }
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

  /** R722: `bar.angle` counts each tap on the angle word, `bar.angle.undo` a tap within 3 s of the one before, which takes it back
   *  (uses.svelte.ts countTap, under its own key; decisions.md "The bar on the keypad"). */
  const switchAngle = (): void => {
    const at = Date.now();
    void session.uses("bar-uses").then((c) => c.countTap("bar.angle", at), () => {});
    session.setAngle(angle === "rad" ? "deg" : "rad");
  };
</script>

  <!-- the bar (docs/05 3.2, R722): on the keypad's top edge, 28 px, its targets its full height. ⌄, APP▾ (⊞▾; an app opened
       through it shows its glyph, highlighted), the track of Home and slot 2 (R782), an app's views (the bay), the ⇧ α slot, the modes
       group (R856: `STD 12 ▾ │ RAD`, the word alone in an app), ☰; the order is the lock's `bar:` list (barItems.ts). Nothing in it
       changes width with Shift, Alpha, the engine's state or the place, so a
       press never moves a control from under the finger; the engine's and the update's notes show in the stage. -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions (only keeps the caret in the entry line and arms the guard; the buttons inside are the controls) -->
  <nav class="bar" class:inapp={shell.app !== null} class:folded data-testid="bar" data-engine={session.engineState} data-busy={busy} aria-label={t("status.bar")} onpointerdown={down} onclickcapture={guard}>
    <!-- R786: ⌄ is the bar's first control, in a 28 px cell that is empty where folding does not exist -->
    <span class="foldcell">
      {#if onfold}<button type="button" class="fold" use:pressFlag data-testid="fold-chevron" data-item="fold" aria-label={t("status.fold")} onclick={onfold}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5.5 8 10.5l5-5" /></svg></button>{/if}
    </span>
    <button
      type="button"
      class="place"
      use:pressFlag
      data-testid="place"
      data-item="apps"
      data-tip="place"
      data-app={shell.app ?? ""}
      data-cur={appCur}
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
    <!-- R782: the recessed track: Home (fixed) and slot 2 (CAS until a second tap on it chooses another place); ◢ marks the current slot 2 -->
    <span class="track" role="tablist" aria-label={t("status.places")}>
      {#each PILLS as p (p.id)}
        {@const g = placeGlyph(p.place)}
        <!-- R856: Home's glyph is a house in currentColor (views/house.ts), not the logo -->
        <button
          type="button"
          class="ptab"
          class:cur={p.cur}
          role="tab"
          use:pressFlag
          data-testid="tab-{p.id}"
          data-item={p.id}
          data-place={p.place}
          aria-selected={p.cur}
          aria-label={p.label}
          onclick={() => onpress(p.key, "primary")}>
          <span class="pface">
            <span class="tile math" class:small={"text" in g && g.text.length > 1} data-ring={p.cur && ring} aria-hidden="true">{#if "icon" in g}{@html HOUSE}{:else}{g.text}{/if}</span>
            <span class="nm" aria-hidden="true">{p.name}</span>
            {#if p.id === "slot" && p.cur}<span class="mark" data-testid="slot-mark" aria-hidden="true">◢</span>{/if}
          </span>
        </button>
      {/each}
    </span>
    <span class="sep" aria-hidden="true"></span>
    <!-- the bay's view icons in an app (R362, R782): a part of the shell's app-opening chunk, drawn once it is in -->
    {#if shell.app !== null && shell.code}<shell.code.AppViews {shell} {onpress} />{/if}
    {#if folded || hw}
      <!-- R783: the ⇧ α badge is on the folded bar and with a hardware keyboard in use; with the keys up the Shift and Alpha keys show the state -->
      <span class="slot" data-testid="mod-slot">
        {#if mod}
          <!-- R726: while Shift or Alpha is on, the sign is a button: a tap ends it, armed or locked (the bar's guard applies) -->
          <button type="button" class="mod" use:pressFlag
            data-testid="mod-{mod.id}"
            data-lock={mod.lock}
            aria-label={t("status.modOff", { mod: t(`key.${mod.id}`) })}
            onclick={() => session.releaseModifiers()}>{mod.text}</button>
        {/if}
      </span>
    {/if}
    <!-- R856: the modes, one outlined group before ☰: `STD 12 ▾` (Home and CAS; it opens Mode on Format, R785), a divider, and the
         angle as a word, RAD or DEG, last, so it stands at the same x in every place and folded; a tap on it switches. Never filled. -->
    <span class="modes" data-testid="bar-modes">
      {#if shell.app === null}
        <button type="button" class="mode" use:pressFlag data-testid="chip-format" data-item="mode" aria-label={t("status.format", { format: t(`format.${session.settings.format}`), digits: String(session.settings.digits) })} onclick={() => onmode("format")}><span>{session.settings.format.toUpperCase()}</span> <span>{session.settings.digits}</span> <span class="cv" aria-hidden="true">▾</span></button>
      {/if}
      <button type="button" class="angle" use:pressFlag data-testid="chip-angle" data-item="angle" data-angle={angle} aria-label={t(`status.angle.${angle}`)} onclick={switchAngle}>{angle.toUpperCase()}</button>
    </span>
    <button type="button" class="menubtn" use:pressFlag data-testid="menu-button" data-item="menu" data-tip="menu" aria-label={t("status.menu")} onclick={() => onpress(MENU_KEY, "primary")}>☰</button>
    <!-- the busy ring is drawn on an aria-hidden tile: a screen reader hears the job from this hidden line (R102) -->
    {#if busy}<span class="sr" role="status" data-testid="busy-status">{t("status.busy")}</span>{/if}
  </nav>

<style>
  /* the bar (R722): on the keypad's top edge, the keypad's ground; its line on top as an inset shadow, so the targets keep
     the full 28 px, and every target is the bar's full height. R856: every control has one width and x in every place and
     folded (muscle memory); the sizes are per screen width only (the narrow rule at the end), never per place. */
  .bar {
    flex: none;
    display: flex;
    align-items: stretch;
    --bar-gap: var(--sp-05);
    gap: var(--bar-gap);
    box-sizing: border-box;
    height: var(--bar-h);
    background: var(--panel);
    box-shadow: inset 0 var(--stroke-thin) 0 var(--line);
    font-size: var(--fs-note);
    line-height: 1;
  }
  /* R724, R782, R856: folded, the row is Fold.svelte's (44 px): ⌃ 0, the track 1, the free stretch 2, the slot and the modes 3,
     the row buttons 4, ☰ 5; every target the row's height, at least 32 px wide; no views. APP▾ is not drawn but keeps its room
     (and ⌃ is as wide as ⌄'s cell and APP▾ made up, less the 4 px ⌃ is wider: Fold.svelte's --unfold-w), so Home and slot 2
     stand where they do open; the modes keep the open bar's gap before ☰, so the word stands where it does open. */
  .bar.folded {
    display: contents;
  }
  .folded .foldcell,
  .folded .sep {
    display: none;
  }
  .folded .place {
    order: 0;
    visibility: hidden;
    margin-left: calc(var(--bar-h) - var(--unfold-w, var(--bar-h)) + 2 * var(--bar-gap)); /* (the open bar's two gaps: ⌄ | APP▾ | track) */
  }
  .folded .track {
    order: 1;
  }
  .folded .track::before,
  .folded .modes::before,
  .folded .modes button::before {
    inset: calc((100% - var(--bar-h)) / 2 + var(--sp-05)) 0;
  }
  .folded .slot,
  .folded .modes {
    order: 3;
  }
  .folded .slot {
    margin-left: 0;
  }
  .folded .modes {
    margin-right: var(--bar-gap);
  }
  .folded .menubtn {
    order: 5;
  }
  .folded button {
    min-width: var(--view-w);
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
  /* R774: a pressed control fills with its own shape (the Android tap box is off, style.css): the others get the small radius,
     a segment fills its face inside the track and a half of the modes its part of the outline, not the 28 px button */
  .bar :global([data-down]) {
    background: var(--key-nav);
    color: var(--key-text);
    border-radius: var(--radius-s);
  }
  .bar .ptab:global([data-down]),
  .bar .modes button:global([data-down]) {
    background: none;
  }
  .bar .ptab:not(.cur):global([data-down]) .pface,
  .bar .modes button:global([data-down])::before {
    background: var(--key-nav);
  }
  /* ⌄ (R786): a 28 × 28 target at the bar's left end; its cell keeps the width where there is no button */
  .foldcell {
    flex: none;
    display: flex;
    width: var(--bar-h);
  }
  .fold {
    width: var(--bar-h);
    height: var(--bar-h);
    color: var(--muted);
  }
  .fold svg {
    fill: none;
    stroke: currentColor;
    stroke-width: var(--chev-stroke);
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  /* the place (R15b, R82f2, R722): Apps (⊞, four boxes) or the app's glyph tile, and ▾; it opens Apps. After ⌄'s cell (R786:
     28 px; empty in an app), from the screen's left edge; R856: 32 px in every place. */
  .place {
    width: var(--app-w);
    gap: var(--sp-05);
    padding: 0;
    color: var(--text);
  }
  /* R782: in an app opened through APP▾ (not slot 2's) its glyph tile is highlighted, as the current segment is */
  .place[data-cur="true"] .tile {
    background: var(--key-on);
    color: var(--on-key-on);
  }
  .tile {
    position: relative;
    flex: none;
    box-sizing: border-box;
    width: var(--app-tile-w);
    height: var(--app-tile-w);
    border-radius: var(--radius-s);
    background: var(--chip-bg);
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--fs-ui);
    font-weight: 400;
  }
  .tile.grid {
    display: grid;
    grid-template-columns: var(--grid-dot) var(--grid-dot);
    gap: var(--sp-05);
    place-content: center;
    background: none;
  }
  .tile.grid i {
    width: var(--grid-dot);
    height: var(--grid-dot);
    border-radius: var(--sp-05);
    background: var(--muted);
  }
  .tile.small {
    font-size: var(--fs-cell);
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
    font-size: var(--fs-cell);
    color: var(--muted);
  }
  /* R856: no hairline after the track; the gap from the track to what follows is 4 px in every place (the bar's two gaps and this) */
  .sep {
    flex: none;
    width: calc(var(--sp-1) - 2 * var(--bar-gap));
  }
  /* R782, R856: the recessed track (--bar-track) of Home and slot 2, two segments of one width in every place: a glyph and a
     short name, 12 px semibold, the current one filled in --key-on; the buttons keep the bar's full height, the track and the
     fill are drawn inside it */
  .track {
    position: relative;
    flex: none;
    display: flex;
    gap: var(--sp-05);
    padding: 0 var(--sp-05);
  }
  .track::before,
  .modes::before {
    content: "";
    position: absolute;
    inset: var(--sp-05) 0;
    border-radius: calc(var(--radius-s) + var(--stroke-thin));
    pointer-events: none;
  }
  .track::before {
    background: var(--bar-track);
    box-shadow: inset 0 0 0 var(--stroke-thin) color-mix(in srgb, var(--line) 55%, transparent);
  }
  .ptab {
    position: relative;
    width: var(--pill-w);
    color: var(--muted);
    white-space: nowrap;
  }
  .pface {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-05);
    box-sizing: border-box;
    width: 100%;
    height: var(--tab-h);
    border-radius: calc(var(--radius-s) - var(--stroke-thin));
    font-size: var(--fs-caption);
    font-weight: 600;
  }
  .nm {
    min-width: 0;
    overflow: hidden;
  }
  .ptab .tile {
    width: var(--pill-tile-w);
    height: var(--pill-tile-h);
    background: none;
    color: inherit;
  }
  .ptab .tile :global(svg) {
    width: var(--pill-tile-w);
    height: var(--pill-tile-h);
  }
  .ptab.cur {
    color: var(--on-key-on);
  }
  .ptab.cur .pface {
    background: var(--key-on);
  }
  /* ◢ on the current slot 2: the corner of its segment, over the room it already has (the width never changes); R703: the
     segment's own rule */
  .pface .mark {
    position: absolute;
    right: var(--stroke-thin);
    bottom: var(--stroke-thin);
    font-size: var(--fs-cell);
    line-height: 1;
    opacity: 0.8;
  }
  /* the fixed ⇧ α slot (the folded bar, a hardware keyboard in use): 16 px in every place, so Shift or Alpha moves nothing and its
     sign is never covered; it takes the room left over before the modes (R783, R856: the word and ☰ stand at the same x in every
     place; the narrow rule at the end makes the room for it in an app at 360) */
  .slot {
    flex: none;
    width: var(--icon-w);
    margin-left: auto;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /* R726: the sign is a button while one is on: the bar's 28 × 28 target over the 16 px slot (the slot keeps its width, so
     nothing moves; the group after it is drawn over the overlap); a lock's underline sits on the bar's lower edge */
  .mod {
    color: var(--shift);
    font-weight: 700;
    line-height: var(--lh-small);
  }
  .slot button.mod {
    width: var(--bar-h);
    height: var(--bar-h);
    min-width: 0;
  }
  .mod[data-testid="mod-alpha"] {
    color: var(--alpha);
  }
  .mod[data-lock="true"] {
    box-shadow: inset 0 calc(-1 * var(--stroke)) 0 currentColor;
  }
  /* R856: the modes, one outlined group (owner, 2026-11-22: no on/off look, never filled): `STD 12 ▾`, a divider, the word RAD or
     DEG at a fixed width, last; in an app the word alone. It takes the room left over (the slot before it, when drawn, does). */
  .modes {
    position: relative;
    flex: none;
    display: flex;
    margin-left: auto;
    font-size: var(--fs-caption);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .slot + .modes {
    margin-left: 0;
  }
  .modes::before {
    box-shadow: inset 0 0 0 var(--stroke-thin) var(--line);
  }
  .modes button {
    position: relative;
    color: var(--text);
  }
  .modes button::before {
    content: "";
    position: absolute;
    inset: var(--sp-05) 0;
    border-radius: calc(var(--radius-s) + var(--stroke-thin));
    pointer-events: none;
  }
  .modes button > :global(*) {
    position: relative;
  }
  .mode {
    gap: var(--sp-1);
    padding: 0 var(--sp-2);
  }
  /* the divider between the halves, inside the outline's height */
  .mode::after {
    content: "";
    position: absolute;
    right: 0;
    top: calc(50% - var(--bar-h) / 2 + var(--sp-05));
    bottom: calc(50% - var(--bar-h) / 2 + var(--sp-05));
    width: var(--stroke-thin);
    background: var(--line);
  }
  .mode .cv {
    color: var(--muted);
    font-size: var(--fs-cell);
  }
  .angle {
    width: var(--angle-w);
  }
  .menubtn {
    width: var(--menu-w);
    font-size: var(--fs-key-fn);
    color: var(--text);
  }
  /* narrow (a phone under 400 px wide): one gap of 1 px, the track's inset and gap 1 px, the word 33 px and ☰ 32 px, the same in
     every place, so an app's views and the 16 px ⇧ α slot fit at 360 (R856: 359 px in Function with a hardware keyboard) */
  @media (max-width: 400px) {
    .bar {
      --bar-gap: var(--stroke-thin);
      --angle-w: var(--angle-w-narrow);
    }
    .track {
      gap: var(--stroke-thin);
      padding: 0 var(--stroke-thin);
    }
    .menubtn {
      width: var(--view-w);
    }
  }
</style>

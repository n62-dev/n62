<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import { tick } from "svelte";
  import { t } from "../i18n/index.ts";
  import { CAS_SOFT_BUDGET_MS } from "../calc/port.ts";
  import Math from "../render/Math.svelte";
  import { mathlive } from "../render/mathlive.svelte.ts";
  import { MAX_DRAWN_LATEX } from "../render/longResult.ts";
  import { typedName } from "../render/home.ts";
  import { markText, noDigit as hasNoDigit } from "../state/displayMode.ts";
  import { drawnInput, rowTap, type PickPart } from "../state/pickRows.ts";
  import { edgeFade } from "./edgeFade.ts";
  import { rowHold, rowSwipe } from "./rowGestures.ts";
  import type { MarkInfo } from "../engine/format.ts";
  import type { Drawn } from "../state/displayMode.ts";
  import type { AngleUnit } from "../calc/port.ts";
  import type { HistoryItem, MarkStyle, UsedValue } from "../state/session.svelte.ts";

  let {
    items,
    display,
    input = (item) => item.latex,
    mark,
    sigma = () => null,
    reason = () => null,
    marks = "reason",
    angle = "rad",
    onrecall,
    oninsert,
    onpick,
    oncancel,
    onhold,
    onswipe,
    undo = null,
    onundo,
    selected = null,
    part = "row",
    engineState,
    historyRead,
  }: {
    /** R860: the view's stored history is read; the mark and the hint of an empty view wait for it (no flash before the rows). */
    historyRead?: boolean;
    /** R133: while the engine starts only the newest FIRST_PAINT rows are drawn (their cost is on the main thread the
     *  start needs); a frame after it is ready or failed the page grows to PAGE. */
    engineState: "starting" | "ready" | "failed";
    items: HistoryItem[];
    /** P4: the row picked with Up from an empty entry line (index into items), or null. */
    selected?: number | null;
    /** R832: what the picked row has lit: the whole row, its input or its result. */
    part?: PickPart;
    display: (item: HistoryItem) => Drawn;
    /** The input as drawn (R100: `;` for its argument commas in comma mode); by default as stored. */
    input?: (item: HistoryItem) => string;
    /** The `=` / `≈` / `⚠ n` before a number result (docs/04 2.4); null for a non-number. */
    mark: (item: HistoryItem) => MarkInfo | null;
    /** R40: the σ line a tap on the row shows (a constant's σ limits its digits); null or undefined: a tap shows
     *  nothing (its code rides in the tidy chunk, Session.sigma). */
    sigma?: (item: HistoryItem) => string | null | undefined;
    /** R124: the reason line under a ⚠ row (Settings › Numbers › Marks); null: none; "": its text is not in yet (the
     *  line's place is kept, Session.reason). */
    reason?: (item: HistoryItem) => string | null;
    /** R124: how the marks are drawn: Muted, ⚠ coloured, ⚠ + reason. */
    marks?: MarkStyle;
    /** R265: the angle mode on show: a row that reads the angle and ran in the other carries its mode as a small tag. */
    angle?: AngleUnit;
    /** A second tap on the picked row's entry puts it back on the line, with the values of its chips (R147). */
    onrecall: (item: HistoryItem) => void;
    /** L5: a second tap on the picked row's result puts it on the entry line at the cursor, as a chip (docs/04 2.8, R147). */
    oninsert: (item: HistoryItem) => void;
    /** R147 (the G2's way), R832: a first tap on a row picks it (its index into items), lighting its input, its result or, anywhere
     *  else on it, the whole row (`part`), as ▲ does for the whole row; a tap that drops the pick, or on the history's empty part,
     *  gives null. */
    onpick: (index: number | null, part?: PickPart) => void;
    oncancel: () => void;
    /** R276: a hold (500 ms) on a finished row's input (`latex`: as drawn) or result copies that part (docs/04 2.6). */
    onhold?: (item: HistoryItem, part: "input" | "result", latex: string) => void;
    /** R276: a swipe left or right slid the row out: delete it (R98's path, so the Undo note row comes); false: nothing
     *  was deleted, the row comes back. */
    onswipe?: (item: HistoryItem) => Promise<boolean>;
    /** R98: what the last Clear history or Delete took, while Undo can bring it back: one note row, a tap on it undoes. */
    undo?: "clear" | "delete" | null;
    onundo?: () => void;
  } = $props();

  // R276: a hold on the input or the result copies it (apps/longpress.ts swallows the click after the lift, so a hold
  // never picks); a swipe deletes the row (rowSwipe.ts, which swallows a drag's click too). Both come lazily (rowGestures.ts).
  /** The input's hold: a finished row's (a running one has nothing to copy yet). */
  const holdInput = (item: HistoryItem): (() => void) | undefined =>
    onhold && item.status !== "pending" ? () => onhold(item, "input", drawn(item)) : undefined;
  // R832: the whole row takes the tap and reads where it landed (its `.in`, its `.result`, else the row): the first tap lights that
  // part, the next acts on it, moves the light or drops the pick (rowTap). A scroll drag never reaches here: the browser cancels the
  // pointer and sends no click. A hold on the rest of the row picks nothing (rowSwipe.ts swallows its click).
  function tapRowBody(e: MouseEvent, item: HistoryItem, at: number): void {
    const target = e.target as Element;
    if (target.closest(".reason")) {
      reasonOpen = reasonOpen === item.id ? null : item.id; // R124: the line's text opens, nothing is picked
      return;
    }
    if (target.closest("button.cancel")) return; // Cancel keeps its own tap (D3)
    const tapped: PickPart = target.closest(".in") ? "input" : target.closest("button.result") ? "result" : "row";
    const next = rowTap(selected, part, at, tapped);
    if (next === "act") {
      sigmaOpen = null;
      (tapped === "input" ? onrecall : oninsert)(item);
    } else if (next === "drop") {
      sigmaOpen = null; // R40: the tap that drops the pick hides the σ line
      onpick(null);
    } else {
      if (at !== selected) sigmaOpen = sigma(item) ? item.id : null; // R40: the picking tap shows the σ line (a move of the light keeps it as it is)
      onpick(at, tapped);
    }
  }
  /** R147: a tap on the history outside every row (its empty part) drops the pick. */
  function tapHistory(e: MouseEvent): void {
    if (!(e.target as Element).closest(".item")) onpick(null);
  }

  // R40, R832: the tap that picks a row with a σ line shows it, the tap that drops the pick hides it (tapRowBody)
  let sigmaOpen = $state<number | null>(null);
  // R124: a tap on a ⚠ row's reason line shows its full text (it wraps); a second tap ellipses it again
  let reasonOpen = $state<number | null>(null);

  /** R63: a unit row draws its request with the units in it (the line itself, recalled, has none: Home has no units). */
  const drawn = (item: HistoryItem): string => drawnInput(item, input);
  // F28: the stored values a CAS result read, in one muted line: at most three names, then "+n". When all come from
  // one view it is said once at the end; otherwise after each name. Each name as typed (R260: β, not beta_).
  const USES_SHOWN = 3;
  const viewText = (v: UsedValue["view"]): string => t(v === "home" ? "history.usesHome" : "history.usesCas");
  function usesLine(uses: UsedValue[]): string {
    const shown = uses.slice(0, USES_SHOWN);
    const once = uses.every((u) => u.view === uses[0]?.view);
    const names = shown.map((u) => `${typedName(u.name)} = ${u.preview}${once ? "" : ` (${viewText(u.view)})`}`).join(", ");
    const more = uses.length > shown.length ? ` +${uses.length - shown.length}` : "";
    return `${names}${more}${once ? ` · ${viewText(uses[0]!.view)}` : ""}`;
  }

  let scroller: HTMLElement | undefined = $state();

  // Only the newest entries are drawn (layout and MathLive markup cost grow with every drawn item, which
  // slowed both the engine start and Enter with a full history). Scrolling to the top draws earlier ones.
  const PAGE = 20;
  /** R133 (F172): the rows drawn while the engine starts (the start pays for the rows drawn, by their content). */
  const FIRST_PAINT = 5;
  // Mounted with the engine already up (back from an app): the full page at once.
  // svelte-ignore state_referenced_locally (the start state only; the effect below moves it on)
  let shownCount = $state(engineState === "starting" ? FIRST_PAINT : PAGE);
  const full = $derived(shownCount >= PAGE);
  $effect(() => {
    if (engineState === "starting" || full) return;
    const frame = requestAnimationFrame(() => (shownCount = PAGE));
    return () => cancelAnimationFrame(frame);
  });
  const shown = $derived(items.length > shownCount ? items.slice(items.length - shownCount) : items);
  let sentinel: HTMLElement | undefined = $state();
  $effect(() => {
    if (!sentinel || !scroller || !full) return; // the first rows only: the sentinel waits for the page (R133)
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void showEarlier();
      },
      { root: scroller },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  });
  async function showEarlier(): Promise<void> {
    if (!scroller || shownCount >= items.length) return;
    const before = scroller.scrollHeight - scroller.scrollTop;
    shownCount += PAGE;
    await tick();
    scroller.scrollTop = scroller.scrollHeight - before; // keep what the user was looking at in place
  }

  // Keep the newest entry in view.
  $effect(() => {
    void items.length;
    void items.at(-1)?.status;
    void undo; // the note (R98) is the last row
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  });

  // Keep the picked row in view (drawing earlier rows first if it is above the drawn page).
  $effect(() => {
    if (selected === null || !scroller) return;
    if (selected < items.length - shownCount) shownCount = items.length - selected;
    void tick().then(() => scroller?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: "nearest" }));
  });

  // A running row is as high as a one-line result: an invisible "0" drawn as a result is (MathLive's line box is
  // 0.4 px higher than a text line, so no CSS number would match). Made once, not per Enter (renderStats).
  const strut = $derived(mathlive.mod?.convertLatexToMarkup("0") ?? "0");

  // After CAS_SOFT_BUDGET_MS a running job gets a prominent Cancel (D3).
  let now = $state(performance.now());
  $effect(() => {
    if (items.at(-1)?.status !== "pending") return; // only the newest entry can be running
    const timer = setInterval(() => (now = performance.now()), 500);
    return () => clearInterval(timer);
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions (R147: a tap on the empty part drops a pick; Esc does it by keys) -->
<section class="history" aria-label={t("history.label")} data-marks={marks} bind:this={scroller} onclick={tapHistory}>
  {#if items.length === 0 && historyRead}
    <!-- R157: the faint N62 mark, decoration only; R924 (owner, 2026-11-23): it takes no tap (the credits are N62 then Enter).
         R860: also above an Undo note, which stays the last row; .empty is its room, the space left up to --mark-h -->
    <div class="empty">
      <div class="faint" aria-hidden="true"></div>
    </div>
    <p>{t("history.empty")}</p>
  {/if}
  {#if items.length > shown.length}
    <div class="earlier" bind:this={sentinel} aria-hidden="true"></div>
  {/if}
  {#each shown as item, k (item.id)}
    {#if item.status === "note"}
      <div class="item note" data-status="note" data-testid="safe-start" role="status">{item.text}</div>
    {:else}
    {@const r = reason(item)}
    {@const at = k + items.length - shown.length}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions (R40: the σ line is a touch extra; a picked row's why-line, R36, serves the keys) -->
    <article class="item" data-status={item.status}
      use:rowSwipe={{ enabled: onswipe !== undefined && item.status !== "pending", onswipe: () => onswipe?.(item) ?? false }}
      onclick={(e) => tapRowBody(e, item, at)}
      oncontextmenu={(e) => e.preventDefault()}
      data-alt={at % 2 === 1 ? "true" : undefined}
      data-selected={at === selected ? "true" : undefined}
      data-part={at === selected ? part : undefined}>
      <button type="button" class="in" title={t("history.recall")} use:edgeFade use:rowHold={holdInput(item)} onpointerdown={(e) => e.preventDefault()}>
        <Math latex={drawn(item)} />
      </button>
      <div class="out" data-testid="result" use:edgeFade={item.status}>
        {#if item.status === "pending"}
          <span class="strut" aria-hidden="true">{@html strut}</span>
          <span class="working late">{t("history.working")}</span>
          <button type="button" class="cancel late" class:prominent={now - item.startedAt > CAS_SOFT_BUDGET_MS} onclick={oncancel}>
            {t("history.cancel")}
          </button>
        {:else if item.status === "cancelled"}
          <span class="note">{t("history.cancelled")}</span>
        {:else if item.status === "error"}
          <span class="error" role="alert">{item.text}</span>
        {:else}
          {@const d = display(item)}
          {@const m = mark(item)}
          {@const noDigit = hasNoDigit(m)}
          {#if item.readsAngle && item.angle && item.angle !== angle}<span class="angle" data-testid="row-angle">{item.angle.toUpperCase()}</span>{/if}
          {#if m}<span class="mark" data-mark={m.mark} data-testid="mark" title={t(`mark.${m.mark === "=" ? "exact" : m.mark === "≈" ? "approx" : "warn"}`)}>{noDigit ? t("mark.noDigit") : markText(m)}</span>{/if}
          {#if d.wrap && !noDigit && d.latex.length <= MAX_DRAWN_LATEX}
            <!-- R158: a plain number: its groups, each unbreakable, wrap at a gap when the row is too narrow for the whole; the mark stays beside the first line -->
            <button type="button" class="result wrapped" data-text={d.text} title={t("history.insert")}
              use:rowHold={onhold && (() => onhold(item, "result", d.latex))} onpointerdown={(e) => e.preventDefault()}>
              <Math latex={d.latex} pieces={d.wrap} gap={d.gap === true} size={d.text.length} />
            </button>
          {:else}
            <button type="button" class="result" data-text={d.latex.length > MAX_DRAWN_LATEX ? "" : d.text} title={t("history.insert")}
              use:rowHold={onhold && (() => onhold(item, "result", d.latex))} onpointerdown={(e) => e.preventDefault()}>
              {#if !noDigit}<Math latex={d.latex} size={d.text.length} />{/if}
            </button>
          {/if}
        {/if}
      </div>
      {#if r !== null}<div class="reason" data-testid="mark-reason" data-open={reasonOpen === item.id}>{r || "\u00a0"}</div>{/if}
      {#if sigmaOpen === item.id && sigma(item)}<div class="uses" data-testid="sigma">{sigma(item)}</div>{/if}
      {#if item.status === "done" && item.uses?.length}
        <div class="uses" data-testid="uses">{usesLine(item.uses)}</div>
      {/if}
      {#if item.settingReset}
        <div class="uses" data-testid="setting-reset">{t("history.settingReset")}</div>
      {/if}
      {#if item.status === "done" && typeof item.units?.names === "string"}
        <div class="uses" data-testid="unit-names">{item.units.names}</div>
      {/if}
      {#if item.unitDropped}
        <div class="uses" data-testid="unit-dropped">{t("history.unitDropped")}</div>
      {/if}
      {#if item.typedIn}
        <div class="uses" data-testid="row-angle-note">{t("history.angleNote", { now: (item.angle ?? angle).toUpperCase(), was: item.typedIn.toUpperCase() })}</div>
      {/if}
    </article>
    {/if}
  {/each}
  {#if undo}
    <button type="button" class="undone" data-testid="undo-note" onpointerdown={(e) => e.preventDefault()} onclick={onundo}>
      {t(undo === "clear" ? "history.cleared" : "history.deleted")}
    </button>
  {/if}
</section>

<style>
  .history {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    /* R742: the rows carry the space between them as their own padding (--row-pad above and below, so the pitch is the
       10 px gap's of before); the history's 8 px above and below gives back the first and last row's, so no row moves */
    --row-pad: 5px;
    padding: calc(var(--sp-2) - var(--row-pad)) var(--sp-3);
    display: flex;
    flex-direction: column;
  }
  .earlier {
    min-height: var(--stroke-thin);
  }
  /* R860: an empty view: the mark's room, then the hint, centred in the space (above an Undo note: it stays the last row).
     The room is the space left, up to the mark and its gap to the hint (--sp-4), so
     the mark is never cropped; the hint never shrinks. Under 40 px the mark is left out */
  .empty {
    flex: 0 1 calc(var(--mark-h) + var(--sp-4));
    min-height: 0;
    margin-top: auto;
    container-type: size;
  }
  .empty + p {
    margin: 0 0 auto;
    color: var(--muted);
    text-align: center;
  }
  .empty + p + .undone {
    margin-top: 0;
  }
  @container (height < 40px) {
    .faint {
      display: none;
    }
  }
  /* R157: the mark as a mask of the one file (public/n62-mark.svg), in --mark-faint, so one file serves every theme */
  .faint {
    height: min(var(--mark-h), 100cqh);
    margin: 0 auto;
    aspect-ratio: 48.4 / 47;
    background: var(--mark-faint);
    -webkit-mask: url("/n62-mark.svg") center / contain no-repeat;
    mask: url("/n62-mark.svg") center / contain no-repeat;
    pointer-events: none; /* R924: a tap on it is a tap on the empty history */
  }
  .item {
    display: flex;
    flex-direction: column;
    gap: var(--sp-05);
    margin-top: auto;
    /* a hold copies (R276), not the system's text selection */
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
    /* R276: a drag across is the row's swipe (rowSwipe.ts), a drag down or up the history's scroll */
    touch-action: pan-y;
  }
  .item + .item {
    margin-top: 0;
  }
  /* a running row does not slide (R276): its long input scrolls by touch as the browser does it */
  .item[data-status="pending"],
  .item[data-status="pending"] .in,
  .item[data-status="pending"] .out {
    touch-action: auto;
  }
  .item {
    position: relative;
  }
  /* docs/05 3.5 (R742): the rows run to the history's edges and every second one, counted from the oldest, is --row-alt (a new
     row recolours none; a delete recolours the rows after it), so the eye follows an input to its result across a wide row */
  .item {
    margin-inline: calc(-1 * var(--sp-3));
    padding: var(--row-pad) var(--sp-3);
  }
  .item[data-alt="true"] {
    background: var(--row-alt);
  }
  /* the picked row (R832's whole-row pick): --pick with a --focus edge inside it and a bar at its start, no radius (a full band) */
  .item[data-selected="true"]:not([data-part="input"], [data-part="result"]) {
    background: var(--pick);
    outline: var(--stroke) solid var(--focus);
    outline-offset: calc(-1 * var(--stroke));
    box-shadow: inset var(--sp-15) 0 0 var(--focus);
  }
  /* R832: a tap on the input or the result lights that half alone: the whole row's ground and outline move to its box (inside it, so the
     data-cut fade, which masks to the box, never cuts the line); the row keeps its zebra ground */
  .item[data-part="input"] .in,
  .item[data-part="result"] .result {
    border-radius: var(--radius);
    background: var(--pick);
    outline: var(--stroke) solid var(--focus);
    outline-offset: calc(-1 * var(--stroke));
  }
  .in {
    all: unset;
    cursor: pointer;
    font-size: var(--fs-input);
    color: var(--muted);
    align-self: flex-start;
    max-width: 100%;
    overflow-x: auto;
    touch-action: pan-y; /* (a scroller: its sideways scroll by touch is the swipe's, rowSwipe.ts) */
  }
  .out {
    align-self: flex-end;
    font-size: var(--fs-result);
    display: flex;
    gap: var(--sp-25);
    align-items: baseline;
    max-width: 100%;
    overflow-x: auto;
    touch-action: pan-y;
  }
  /* a long input or result scrolls sideways; the edge with more behind it fades (edgeFade.ts), never cut without a sign */
  .in:global([data-cut="end"]),
  .out:global([data-cut="end"]) {
    mask-image: linear-gradient(to left, transparent, var(--mask-on) var(--fade));
  }
  .in:global([data-cut="start"]),
  .out:global([data-cut="start"]) {
    mask-image: linear-gradient(to right, transparent, var(--mask-on) var(--fade));
  }
  .in:global([data-cut="both"]),
  .out:global([data-cut="both"]) {
    mask-image: linear-gradient(to right, transparent, var(--mask-on) var(--fade), var(--mask-on) calc(100% - var(--fade)), transparent);
  }
  .result {
    all: unset;
    cursor: pointer;
    color: var(--text);
  }
  /* R158: the wrapped number is a box that may shrink to the row; the pieces wrap inside (render/Math.svelte) */
  .result.wrapped {
    display: block;
    min-width: 0;
    max-width: 100%;
  }
  .mark {
    font-size: var(--fs-key);
    color: var(--muted);
    white-space: nowrap;
  }
  .angle {
    font-size: var(--fs-note);
    color: var(--muted);
    white-space: nowrap;
  }
  .uses {
    align-self: flex-end;
    max-width: 100%;
    font-size: var(--fs-note);
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mark[data-mark="≈"] {
    color: var(--approx);
  }
  .mark[data-mark="⚠"] {
    color: var(--warn);
  }
  /* R124: the reason line, one line ellipsed in the mark's colour; its place is there from the row's first frame */
  .reason {
    cursor: pointer;
    align-self: flex-end;
    max-width: 100%;
    font-size: var(--fs-note);
    color: var(--warn);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .reason[data-open="true"] {
    white-space: normal;
  }
  .history[data-marks="muted"] .mark {
    color: var(--muted);
  }
  .note,
  .working {
    font-size: var(--fs-note);
    color: var(--muted);
  }
  .undone {
    all: unset;
    cursor: pointer;
    margin-top: auto;
    align-self: center;
    font-size: var(--fs-note);
    padding: var(--sp-15) var(--sp-3);
    color: var(--muted);
  }
  .item + .undone {
    margin-top: 0;
  }
  .strut {
    visibility: hidden;
    width: 0;
  }
  .working,
  .cancel {
    align-self: center;
  }
  .error {
    font-size: var(--fs-body);
    white-space: nowrap; /* one line (docs/05 3.5); a long message scrolls with the row */
    color: var(--error);
  }
  .cancel {
    font: inherit;
    font-size: var(--fs-note);
    padding: var(--sp-1) var(--sp-3);
    border-radius: var(--radius-s);
    border: var(--stroke-thin) solid var(--line);
    background: var(--panel);
    color: var(--text);
  }
  .cancel.prominent {
    background: var(--error);
    color: var(--on-error);
    border-color: var(--error);
    font-weight: 700;
  }
</style>

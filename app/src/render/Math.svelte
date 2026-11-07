<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  // Static 2D rendering of a LaTeX string with MathLive's renderer (the same one the entry line uses).
  // Until MathLive has loaded the LaTeX is shown as plain text. A LaTeX over MAX_DRAWN_LATEX, or one MathLive refuses,
  // is a note instead (R135): LaTeX source is never shown for a result, and a too long one never reaches MathLive.
  import { MAX_DRAWN_LATEX, tooLongNote } from "./longResult.ts";
  import { renderOptions } from "./macros.ts";
  import { mathlive, renderStats } from "./mathlive.svelte.ts";

  /** `size`: the length of the result's text, for the note (default: the LaTeX's own). R158: `pieces` are `latex` cut at
   *  its group gaps; each is drawn on its own and the row wraps between them (`gap`: the thin space between). */
  let { latex, label = "", size, pieces, gap = false }: { latex: string; label?: string; size?: number; pieces?: string[]; gap?: boolean } = $props();

  /** The markup of one LaTeX; "" before MathLive is up (the plain text shows); null: not drawn, the note shows. */
  function draw(l: string): string | null {
    const lib = mathlive.mod;
    if (!lib) return "";
    try {
      renderStats.count++;
      // chips in a history entry (\res, \ans, \const) and the exponent mark ᴇ draw as on the entry line, MathLive's own
      // macros (\exponentialE, \imaginaryI) beside them (R152)
      return lib.convertLatexToMarkup(l, renderOptions(lib));
    } catch {
      return null;
    }
  }
  const markups = $derived.by((): (string | null)[] | null => {
    if (latex.length > MAX_DRAWN_LATEX) return null;
    const out = (pieces ?? [latex]).map(draw);
    return out.includes(null) ? null : out;
  });
  const note = $derived(markups === null ? tooLongNote(size ?? latex.length) : "");
</script>

<span class="math" class:wrap={pieces && !note} class:gap data-latex={note ? undefined : latex} role="math" aria-label={note || label || latex}>
  {#if note}{note}{:else if pieces}{#each pieces as piece, i}<span class="piece">{#if markups?.[i]}{@html markups[i]}{:else}{piece}{/if}</span>{/each}{:else if markups?.[0]}{@html markups[0]}{:else}{latex}{/if}
</span>

<style>
  /* R158: a plain number too long for the row wraps at a group gap, full size, right-aligned (each piece whole) */
  .math.wrap {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: baseline;
    max-width: 100%;
  }
  .piece {
    white-space: nowrap;
  }
  .gap .piece + .piece {
    margin-inline-start: var(--group-gap);
  }
  /* the SI prefix of the PFX format (render/home.ts) */
  .math :global(.pfx) {
    color: var(--shift);
  }
  /* R40: the digits past what a constant's σ leaves (render/uncMute.ts mutedTail); --muted keeps the text floor */
  .math :global(.unc) {
    color: var(--muted);
  }
  /* R135: the note for a result too long to draw */
  .math:not([data-latex]) {
    color: var(--muted);
    font-size: var(--fs-note);
    white-space: nowrap;
  }
</style>

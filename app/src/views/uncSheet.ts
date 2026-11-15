// SPDX-License-Identifier: GPL-3.0-or-later
// R327 (the owner, 2026-11-15): the uncertainty sheet, opened by Shift + 1 (keyboard/route.ts) on a row with σ (state/
// hasSigma.ts): its head as the mockup draws it (docs/mockups/uncertainty-sheet.html sections 3 and 4): the result it
// explains with its mark, the short form "39.5(12)", the standard uncertainty σ, U = 2σ (k = 2) and relative σ, and the
// ⚠ line of a σ first order does not hold for. A unit row reads G273's fields (U from the unrounded σ, never 2 × the shown
// σ); a Home row its σ facts as the σ line does (state/sigmaLine.ts) and its value for relative σ and the short form
// (units/uncertainty.ts). Under the head nothing yet: R328 adds the inputs' rows. A chunk of its own, loaded by the key.
import type { HistoryItem } from "../state/session.svelte.ts";
import type { RouteCtx } from "../keyboard/route.ts";
import { decimalToString, isZero } from "../engine/format.ts";
import { uncText } from "../i18n/enUnc.ts";
import { unitText } from "../i18n/enUnits.ts";
import { commaResult, modeOf, type FmtMode } from "../state/displayMode.ts";
import { hasSigma } from "../state/hasSigma.ts";
import { expandedSigmaText, sigmaText } from "../state/sigmaLine.ts";
import { relativeSigma, shortForm } from "../units/uncertainty.ts";
import type { UncWhy } from "../units/types.ts";

export { hasSigma };

/** What the head reads besides the row: its mark and number as the history draws them, its notation and digits. */
export interface HeadCtx {
  /** The row's mark (≈, ⚠; "" for none). */
  mark: string;
  /** The number as the row draws it, without ± σ and the unit. */
  shown: string;
  mode: FmtMode;
  comma: boolean;
  /** The digits the result was worked out at: the short form never shows more. */
  digits: number;
}

/** One line of the head: σ, U or relative σ. */
export interface HeadRow {
  id: "sigma" | "expanded" | "relative";
  label: string;
  value: string;
}

/** The sheet's head (views/UncHead.svelte draws it). */
export interface UncHead {
  title: string;
  /** The result it explains, with its mark: "≈ 39.488 m²". */
  of: string;
  mark: string;
  /** The short form with the unit, "39.5(12) m²"; null where the value's digits do not reach σ's last place. */
  short: string | null;
  rows: HeadRow[];
  /** "⚠ the interval reaches a jump" (G41's reason), or null. */
  warn: string | null;
}

const WHY: Readonly<Record<UncWhy, "units.why.order2" | "units.why.singular" | "units.why.jump">> = {
  order2: "units.why.order2",
  singular: "units.why.singular",
  jump: "units.why.jump",
};

/** The head of a row with σ; null for a row without (the key is then a dead press). */
export function uncHead(item: HistoryItem, ctx: HeadCtx): UncHead | null {
  if (!hasSigma(item)) return null;
  const num = (s: string): string => (ctx.comma ? commaResult(s, false) : s).replace("E", "ᴇ");
  const re = item.value?.re;
  const real = item.value !== undefined && isZero(item.value.im);
  const zero = real && re !== undefined && isZero(re);
  const unc = item.units?.unc;
  let sigma: string | null, u: string | null, rel: string | null, short: string | null;
  let unit = "";
  if (unc) {
    unit = item.units?.unit ? ` ${item.units.unit}` : "";
    [sigma, u, rel, short] = [num(unc.text), unc.expanded === undefined ? null : num(unc.expanded), unc.relative ?? null, unc.short === undefined ? null : num(unc.short)];
  } else {
    const s = item.facts?.uncSigma as string; // (hasSigma)
    const v = real && re ? decimalToString(re) : null;
    [sigma, u] = [sigmaText(item.facts, ctx.mode, ctx.comma), expandedSigmaText(item.facts, ctx.mode, ctx.comma)];
    rel = v === null ? null : relativeSigma(v, s);
    const sf = v === null ? null : shortForm(v, s, ctx.digits);
    short = sf === null ? null : num(sf);
  }
  const rows: HeadRow[] = [];
  if (sigma !== null) rows.push({ id: "sigma", label: uncText("unc.sheet.sigma"), value: sigma + unit });
  if (u !== null) rows.push({ id: "expanded", label: uncText("unc.sheet.expanded"), value: uncText("unc.sheet.u", { u: u + unit }) });
  const relText = rel !== null ? uncText("unc.sheet.percent", { p: ctx.comma ? commaResult(rel, false) : rel }) : zero ? uncText("unc.sheet.zero") : null;
  if (relText !== null) rows.push({ id: "relative", label: uncText("unc.sheet.relative"), value: relText });
  const why = unc?.why;
  return {
    title: uncText("unc.sheet"),
    of: [ctx.mark, ctx.shown + unit].filter(Boolean).join(" "),
    mark: ctx.mark,
    short: short === null ? null : short + unit,
    rows,
    warn: why ? `⚠ ${unitText(WHY[why])}` : null,
  };
}

/** Open the sheet of `item` over the view (Esc closes it); a row without σ is a dead press. */
export function showUncertainty(c: RouteCtx, item: HistoryItem): void {
  const s = c.session;
  const { units: _, ...bare } = item; // (the number alone: the head puts the unit after it)
  const head = uncHead(item, {
    mark: s.mark(item)?.mark ?? "",
    shown: s.display(bare).text,
    mode: modeOf(item, s.settings) ?? s.settings.format,
    comma: s.decimalComma,
    digits: item.digits ?? s.settings.digits,
  });
  if (!head) return c.dead();
  c.shell.showMenu(head.title, [], { remember: false, unc: head });
}

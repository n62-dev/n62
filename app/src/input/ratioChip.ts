// SPDX-License-Identifier: GPL-3.0-or-later
// G782: a result chip in one ratio unit (%, ‰, ppm, ppb: find/units.yaml `ratio: true`, G369) is its pure number in
// Home and CAS: the unit is an exact factor, so dropping it (R61's rule for every other unit) would change the value.
// The chip on the line still shows its unit; only the value the parser puts in changes. Pure; only erasable TypeScript;
// no Find index (the parser never waits for it): ratio.test.ts checks the factors against find/units.yaml.
import type { Chip } from "./chips.ts";

/** The ratio units by Find id, each the power of ten below 1 its factor is (percent 1/100, … ppb 1/10⁹). */
export const RATIO_POWERS: Readonly<Record<string, number>> = { percent: 2, permille: 3, ppm: 6, ppb: 9 };

/** The power of ten of a slot that is exactly one ratio unit (one token, no prefix, power 1, no ÷), else undefined. A
 *  stored chip's unit is unchecked (chips.ts validChips), so each field read is checked here. */
export function ratioSlotPower(x: unknown): number | undefined {
  const slot = (x && typeof x === "object" ? x : {}) as { tokens?: unknown; per?: unknown };
  const t = Array.isArray(slot.tokens) && slot.tokens.length === 1 && slot.per === undefined ? (slot.tokens[0] as Record<string, unknown> | null) : null;
  if (!t || typeof t.unit !== "string" || t.prefix !== undefined || (t.power !== undefined && t.power !== "1")) return undefined;
  return Object.hasOwn(RATIO_POWERS, t.unit) ? RATIO_POWERS[t.unit] : undefined;
}

/** The power of ten of a chip's unit when it is one ratio unit (ratioSlotPower), else undefined. */
export const ratioPower = (c: Chip | undefined): number | undefined => ratioSlotPower(c?.unit?.slot);

const DECIMAL = /^([+-]?)(\d*)(?:\.(\d*))?([eE][+-]?\d+)?$/;

/** A value's text over 10^n, as exact as it was: a decimal keeps its digits with the point moved (`0.42` → `0.0042`; one
 *  with an exponent gets it lowered, `4.2E-1` → `4.2E-3`), any other text is divided (`(21/50)/10^2`). */
export function overPowerOfTen(text: string, n: number): string {
  const v = text.trim();
  const m = DECIMAL.exec(v);
  if (!m || ((m[2] ?? "") === "" && (m[3] ?? "") === "")) return `(${v})/10^${n}`;
  const [, sign = "", int = "", frac = "", exp] = m;
  if (exp !== undefined) return `${sign}${int}${m[3] !== undefined ? `.${frac}` : ""}${exp[0]}${Number(exp.slice(1)) - n}`;
  const point = int.length - n;
  const all = int + frac;
  return point > 0 ? `${sign}${all.slice(0, point)}.${all.slice(point)}` : `${sign}0.${"0".repeat(-point)}${all}`;
}

/** The chip Home and CAS take: one in a ratio unit as its pure number (value and σ over its power of ten, the unit gone,
 *  every other fact kept: a power of ten moves no confirmed digit); any other chip as it is. */
export function pureChip(c: Chip): Chip {
  const n = ratioPower(c);
  if (n === undefined) return c;
  const { unit: _u, ...rest } = c;
  return { ...rest, value: overPowerOfTen(c.value, n), ...(c.unc !== undefined ? { unc: overPowerOfTen(c.unc, n) } : {}) };
}

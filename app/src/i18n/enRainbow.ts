// SPDX-License-Identifier: GPL-3.0-or-later
// R881: the words of the rainbow egg (views/rainbow.ts), a table of its own in that lazy chunk. English only so far.
export const enRainbow = {
  "on": "Rainbow on. Type rainbow and Enter again to end it.",
} as const;

export type RainbowKey = keyof typeof enRainbow;

export function rainbowText(key: RainbowKey): string {
  return enRainbow[key];
}

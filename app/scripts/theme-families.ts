// SPDX-License-Identifier: GPL-3.0-or-later
// The three theme families' own colour values (R50c, R150, R153), moved from tools/probes/themes-audit.mjs. Each gives a value for
// every role except --on-error and the derived ones, which theme-gen.ts adds (--ring too when a family gives none: R154; Black & White's must differ from its Alpha, the logo's teal, so it is a lighter or deeper teal); credit and licence in `src`
// (THIRD_PARTY.md "Theme colours"). Edit here, then `npm run themes` rewrites the generated CSS.

export type Palette = Record<string, string>;
export interface Family {
  id: string;
  name: string;
  src: string;
  idea: string;
  dark: Palette;
  light: Palette;
}

export const FAMILIES: readonly Family[] = [
  { id: 'n62', name: 'N62', src: 'Ours (owner, 2026-11-07, docs/mockups/n62-teal-2026-11-07.html): every colour the logo\'s teal #529997 (OKLCH hue 193°) at another lightness; only Shift\'s orange, the warning and the error outside it.',
    idea: 'One colour family: deep teal (Dark) or pale teal (Light) screen and keys, the number keys a step lighter, Enter the logo\'s teal in both; Shift is orange, Alpha a bright (Dark) or deep (Light) teal.',
    dark: { bg: '#092726', panel: '#0e2f2e', line: '#335b59', 'key-num': '#194241', 'key-op': '#123736', 'key-fn': '#123736', 'key-ctl': '#123736', 'key-nav': '#123736', 'key-enter': '#529997', 'on-enter': '#000000',
      text: '#ebf6f6', 'text-dead': '#749392', muted: '#abccca', shift: '#ffa800', alpha: '#6ae5e2', error: '#ff8a7a', 'chip-bg': '#123736', approx: '#6ae5e2', warn: '#f2c94c', pick: '#134948', focus: '#529997', ring: '#529997', 'key-on': '#529997', 'on-key-on': '#000000' },
    light: { bg: '#cae6e5', panel: '#e0f3f2', line: '#88adab', 'key-num': '#eefaf9', 'key-op': '#d7efee', 'key-fn': '#d7efee', 'key-ctl': '#d7efee', 'key-nav': '#d7efee', 'key-enter': '#529997', 'on-enter': '#000000',
      text: '#062424', 'text-dead': '#587271', muted: '#314e4d', shift: '#a03f00', alpha: '#005b5a', error: '#a8231b', 'chip-bg': '#d7efee', approx: '#005b5a', warn: '#755600', pick: '#a9d9d7', focus: '#368281', ring: '#368281', 'key-on': '#005b5a', 'on-key-on': '#ffffff' } },
  { id: 'bw', name: 'Black & White', src: 'Ours: the N62 family before R153 (black and white with the logo\'s teal #529997 and an orange accent), kept under its own name (owner, 2026-11-07).',
    idea: 'A black (Dark) or white (Light) screen with grey keys; the logo\'s teal only on Enter and Alpha, Shift orange.',
    dark: { bg: '#000000', panel: '#0c1011', line: '#2a3536', 'key-num': '#1b2122', 'key-op': '#121718', 'key-fn': '#121718', 'key-ctl': '#121718', 'key-nav': '#121718', 'key-enter': '#529997', 'on-enter': '#000000',
      text: '#eef2f2', 'text-dead': '#6f7d7e', muted: '#a7b4b4', shift: '#ff9a33', alpha: '#529997', error: '#ff7b72', 'chip-bg': '#163231', approx: '#529997', warn: '#f2c94c', pick: '#1c2b2b', focus: '#529997', ring: '#86bebd', 'key-on': '#529997', 'on-key-on': '#000000' },
    light: { bg: '#f4f6f6', panel: '#e8eded', line: '#b9c6c6', 'key-num': '#ffffff', 'key-op': '#e6ecec', 'key-fn': '#e6ecec', 'key-ctl': '#e6ecec', 'key-nav': '#e6ecec', 'key-enter': '#529997', 'on-enter': '#000000',
      text: '#0b1213', 'text-dead': '#687474', muted: '#44504f', shift: '#a14600', alpha: '#2e706e', error: '#b3261e', 'chip-bg': '#d6e8e6', approx: '#2e706e', warn: '#755600', pick: '#d3e5e3', focus: '#2e706e', ring: '#1b4342', 'key-on': '#2e706e', 'on-key-on': '#ffffff' } },
  { id: 'solarized', name: 'Solarized', src: 'Solarized by Ethan Schoonover (MIT); the owner\'s grounds #2d4056 and #ffffd6 (2026-11-06), the other colours matched to them, accents lifted or deepened to 4.5:1.',
    idea: 'The well-known accents on the owner\'s own grounds: a slate blue dark and a pale yellow paper light. Low glare, a little lower contrast by design.',
    dark: { bg: '#2d4056', panel: '#354a61', line: '#566d86', 'key-num': '#3d556f', 'key-op': '#34495f', 'key-fn': '#34495f', 'key-ctl': '#34495f', 'key-nav': '#30445a', 'key-enter': '#1f6fae', 'on-enter': '#fdf6e3',
      text: '#eef0e6', 'text-dead': '#8b9aab', muted: '#c3ccce', shift: '#f0c040', alpha: '#95cdf7', error: '#ff9f9a', 'chip-bg': '#3f5a77', approx: '#5fd4c8', warn: '#f7a27a', pick: '#22344a', focus: '#f0c040', 'key-on': '#f0c040', 'on-key-on': '#2d4056' },
    light: { bg: '#ffffd6', panel: '#f4f0c2', line: '#cbc394', 'key-num': '#fffff4', 'key-op': '#f2eec4', 'key-fn': '#f2eec4', 'key-ctl': '#f2eec4', 'key-nav': '#f7f3cc', 'key-enter': '#1a6aa6', 'on-enter': '#fffff4',
      text: '#073642', 'text-dead': '#717d7c', muted: '#475c63', shift: '#765800', alpha: '#1a62a0', error: '#b1221e', 'chip-bg': '#ebe5b4', approx: '#166d66', warn: '#a1390b', pick: '#ece6b6', focus: '#1a62a0', 'key-on': '#073642', 'on-key-on': '#ffffd6' } },
];

// SPDX-License-Identifier: GPL-3.0-or-later
// R881: the rainbow egg's colours (views/rainbow.ts), pure so a test reads them. Each key face keeps its token's OKLCH lightness
// and takes a hue of its own with as much chroma (up to CHROMA) as keeps every text on it at its floor (4.5:1, a dimmed face 3:1)
// at every turn of the keypad's hue-rotate animation. The texts on the keys turn grey at their own lightness: a grey is the one
// colour hue-rotate leaves as it is (a turned orange Shift legend fell to 3.8:1 on the theme's own key). The history's wash
// keeps the history's texts, as they are, at their floor on --bg.

export type Tokens = Readonly<Record<string, string>>;
type Floors = readonly (readonly [text: string, floor: number])[];

const KEY_TEXTS: Floors = [["key-text", 4.5], ["key-shift", 4.5], ["key-alpha", 4.5], ["key-text-dead", 3]];
/** The key faces (Keypad.svelte's backgrounds) and the texts drawn on each, with their floors. */
export const FACES: Readonly<Record<string, Floors>> = {
  "key-num": KEY_TEXTS, "key-op": KEY_TEXTS, "key-fn": KEY_TEXTS, "key-ctl": KEY_TEXTS, "key-nav": KEY_TEXTS, "key-pfx": KEY_TEXTS,
  "key-enter": [["on-enter", 4.5]],
};
/** The history's texts on its ground: they keep their colours, and the wash keeps them at their floor (7:1 where they had it). */
export const WASH_TEXTS = ["text", "muted", "approx", "warn", "error"] as const;
/** The key texts, grey under the rainbow (keyTexts). */
const TEXTS = [...new Set(Object.values(FACES).flat().map(([t]) => t))];
/** Every token the palette reads. */
export const TOKENS = [...new Set([...Object.keys(FACES), ...Object.values(FACES).flat().map(([t]) => t), ...WASH_TEXTS, "bg"])];

/** The most chroma a key face takes, and the wash (soft). */
const CHROMA = 0.13;
const WASH_CHROMA = 0.05;
/** Above each floor: the turn is sampled every TURN degrees, the animation runs through every angle between. */
const MARGIN = 0.1;
const TURN = 15;
/** The most a key text's lightness moves (keyTexts). */
const NUDGE = 0.1;

type Rgb = [number, number, number];
const hexRgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as Rgb;
const hex = (c: Rgb): string => `#${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("")}`;
const lin = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const gam = (v: number): number => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

/** WCAG 2 contrast of two colours. */
export function ratio(a: string, b: string): number {
  const y = (h: string): number => {
    const [r, g, bl] = hexRgb(h).map(lin) as Rgb;
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [p, q] = [y(a), y(b)].sort((m, n) => n - m) as [number, number];
  return (p + 0.05) / (q + 0.05);
}

/** OKLCH (Ottosson's OKLab, hue in degrees) of an sRGB colour. */
export function oklch(c: string): [l: number, c: number, h: number] {
  const [r, g, b] = hexRgb(c).map(lin) as Rgb;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}

/** The sRGB colour of an OKLCH one, or undefined when it lies outside sRGB. */
function fromOklch(L: number, C: number, h: number): string | undefined {
  const A = C * Math.cos((h * Math.PI) / 180);
  const B = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return rgb.every((v) => v > -1e-4 && v < 1 + 1e-4) ? hex(rgb.map(gam) as Rgb) : undefined;
}

/** A colour under CSS `filter: hue-rotate(deg)` (Filter Effects 1's matrix, on the sRGB values, clamped). */
export function turned(c: string, deg: number): string {
  const [r, g, b] = hexRgb(c);
  const k = Math.cos((deg * Math.PI) / 180);
  const s = Math.sin((deg * Math.PI) / 180);
  return hex([
    (0.213 + k * 0.787 - s * 0.213) * r + (0.715 - k * 0.715 - s * 0.715) * g + (0.072 - k * 0.072 + s * 0.928) * b,
    (0.213 - k * 0.213 + s * 0.143) * r + (0.715 + k * 0.285 + s * 0.14) * g + (0.072 - k * 0.072 - s * 0.283) * b,
    (0.213 - k * 0.213 - s * 0.787) * r + (0.715 - k * 0.715 + s * 0.715) * g + (0.072 + k * 0.928 + s * 0.072) * b,
  ]);
}

/** Luminance order: is `a` lighter than `b`? */
const lighter = (a: string, b: string): boolean => ratio(a, "#000000") > ratio(b, "#000000");
/** The grey of lightness `L` moved by `dir` 0.005 at a time (NUDGE at most) until `ok` holds; the last one tried when none does. */
function greyFrom(L: number, dir: number, ok: (g: string) => boolean): string {
  let g = "";
  for (let k = 0; k <= NUDGE / 0.005; k++) if (ok((g = fromOklch(Math.min(1, Math.max(0, L + dir * k * 0.005)), 0, 0) as string))) break;
  return g;
}

/** `ground` at hue `h`: its own OKLCH lightness, the most chroma up to `max` (in 0.01 steps) for which every text keeps its
 *  floor (plus MARGIN) at every turn in `turns`. When none does: with `grey`, a grey (hue-rotate leaves it as it is) of that
 *  lightness, moved away from the texts as far as the floor needs (a grey reads lighter than an orange of the same OKLCH
 *  lightness: Solarized Light's Enter); else the token itself. */
function tinted(t: Tokens, ground: string, h: number, max: number, texts: Floors, turns: readonly number[], grey = false): string {
  const own = t[ground] ?? "#000000";
  const [L] = oklch(own);
  const keeps = (c: string): boolean => texts.every(([x, floor]) => turns.every((d) => ratio(turned(t[x] ?? own, d), turned(c, d)) >= floor + MARGIN));
  for (let C = Math.round(max * 100); C >= 0; C--) {
    const c = fromOklch(L, C / 100, h);
    if (c && keeps(c)) return c;
  }
  return grey ? greyFrom(L, texts.every(([x]) => lighter(t[x] ?? own, own)) ? -1 : 1, keeps) : own;
}

/** The key texts under the rainbow: grey, at the token's own OKLCH lightness moved away from its faces' (NUDGE at most)
 *  until it keeps its floor on each face's grey: so nearly every face has a grey, at its own lightness, that keeps its texts. */
export function keyTexts(t: Tokens): Record<string, string> {
  return Object.fromEntries(
    TEXTS.filter((x) => t[x]).map((x) => {
      const on = Object.entries(FACES).flatMap(([f, texts]) => texts.filter(([y]) => y === x).map(([, floor]) => [fromOklch(oklch(t[f] ?? "#000000")[0], 0, 0) as string, floor] as const));
      const dir = on.every(([f]) => lighter(t[x] as string, f)) ? 1 : -1;
      return [x, greyFrom(oklch(t[x] as string)[0], dir, (g) => on.every(([f, floor]) => ratio(g, f) >= floor + MARGIN))];
    }),
  );
}

const TURNS = Array.from({ length: 360 / TURN }, (_, i) => i * TURN);
const memo = new Map<string, string>();
/** Every key face's colour at hue `h` (whole degrees), for the theme `t`. */
export function keyColours(t: Tokens, h: number): Record<string, string> {
  h = Math.round(h) % 360;
  const grey = { ...t, ...keyTexts(t) };
  return Object.fromEntries(
    Object.entries(FACES).map(([face, texts]) => {
      const id = `${face}${t[face]}${texts.map(([x]) => t[x]).join("")}${h}`;
      let c = memo.get(id);
      if (c === undefined) memo.set(id, (c = tinted(grey, face, h, CHROMA, texts, TURNS, true)));
      return [face, c];
    }),
  );
}

/** Each key's hue from its grid row and column (1-based, as the keypad places it): a diagonal over the keypad from `start`
 *  through 330° of the wheel, so the two far corners never meet in one colour. */
export function keyHues(cells: readonly (readonly [row: number, col: number])[], start: number): number[] {
  const sums = cells.map(([r, c]) => r + c);
  const lo = Math.min(...sums);
  const span = Math.max(...sums) - lo || 1;
  return sums.map((s) => Math.round(start + ((s - lo) * 330) / span) % 360);
}

/** The history's wash: seven stops round the wheel from `start`, each --bg's lightness with the chroma its texts allow. */
export function washOf(t: Tokens, start: number): string[] {
  const bg = t["bg"] ?? "#000000";
  const texts: Floors = WASH_TEXTS.filter((x) => t[x]).map((x) => [x, ratio(t[x] as string, bg) >= 7 ? 7 : 4.5]);
  return Array.from({ length: 7 }, (_, i) => tinted(t, "bg", Math.round(start + i * 55) % 360, WASH_CHROMA, texts, [0]));
}

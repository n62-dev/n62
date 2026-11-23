// SPDX-License-Identifier: GPL-3.0-or-later
// A266: the page's side of Android's system bars. The native shell's plugin `N62Bars` (N62BarsPlugin.java) puts the window behind
// the bars (and, below Android 15, the bars themselves) in the look's screen colour and sets the icons to match. A lazy chunk's
// helper (theme/lookApply.ts): `@capacitor/core` is imported here, once, and only the native build has the plugin.

/** What the plugin takes: `color` a #rrggbb, `light` true for a light colour (dark icons). */
export interface BarsOptions {
  color: string;
  light: boolean;
}
interface N62BarsPlugin {
  set(options: BarsOptions): Promise<void>;
}

/** WCAG relative luminance of a #rrggbb. */
function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => {
    const s = parseInt(hex.slice(i, i + 2), 16) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (c[0] as number) + 0.7152 * (c[1] as number) + 0.0722 * (c[2] as number);
}
const contrast = (a: string, b: string): number => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return ((x as number) + 0.05) / ((y as number) + 0.05);
};

/** Dark icons belong on this colour: black has more contrast to it than white. */
export const isLightBg = (bg: string): boolean => contrast(bg, "#000000") > contrast(bg, "#ffffff");

let plugin: Promise<N62BarsPlugin | null> | null = null;

/** Set the bars. Outside the native shell, or without the plugin (an older shell), nothing happens; never throws: a missing
 *  plugin must never stop a look. */
export async function setBars(options: BarsOptions): Promise<void> {
  try {
    plugin ??= import("@capacitor/core").then(({ Capacitor, registerPlugin }) =>
      Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("N62Bars") ? registerPlugin<N62BarsPlugin>("N62Bars") : null,
    );
    await (await plugin)?.set(options);
  } catch {
    // no Capacitor, no plugin, or the call failed: the bars stay as they were
    plugin = null;
  }
}

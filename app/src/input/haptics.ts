// SPDX-License-Identifier: GPL-3.0-or-later
// Key vibration. The web/PWA build can only set the duration (navigator.vibrate); the native Android build
// has a Capacitor plugin, `N62Haptics`, that also takes an amplitude (the strength slider). If the plugin
// is not there (an older shell, iOS, desktop) we fall back to navigator.vibrate.
/** The native side (Android, written separately): vibrate for `ms` milliseconds at `amplitude` 1..255. */
export interface N62HapticsPlugin {
  vibrate(options: { ms: number; amplitude: number }): Promise<void>;
  /** The optional key click (A66): the system's key-click sound, else a click made in code. */
  click(): Promise<void>;
}

// @capacitor/core (7.8 kB raw) is not in the start chunk (R35): `loadNative()` imports it once the keypad is drawn.
// Until then, and on the web, every pulse goes through navigator.vibrate (duration only), so the first tap of a
// cold start may vibrate without its strength.
let native: N62HapticsPlugin | null = null;

/** Load the native plugin (once, idle, after the keypad is drawn). On the web it finds no plugin and changes nothing. */
export async function loadNative(): Promise<void> {
  try {
    const { Capacitor, registerPlugin } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("N62Haptics"))
      native = registerPlugin<N62HapticsPlugin>("N62Haptics");
  } catch {
    // no Capacitor: the web call stays
  }
}

/** True when strength can be set (the native build with the plugin, once loaded); the web build ignores it. */
export function hasStrength(): boolean {
  return native !== null;
}

/** Fire one key-down pulse. `strength01` is 0..1, `ms` the duration. Never throws, never waits. */
export function vibrate(strength01: number, ms: number): void {
  const duration = Math.max(1, Math.round(ms));
  const web = (): void => {
    try {
      navigator.vibrate(duration);
    } catch {
      // no navigator or vibrator, or the browser forbids it before a user gesture: nothing to do
    }
  };
  try {
    if (!native) return web();
    const amplitude = Math.min(255, Math.max(1, Math.round(strength01 * 255)));
    native.vibrate({ ms: duration, amplitude }).catch(web);
  } catch {
    web(); // the plugin threw at once: the web call
  }
}

// A66: the key click is off by default, so its code (input/click.ts) is a lazy chunk, fetched when the setting is on.
/** Fetch the click code (at start when the setting is on, and when the switch turns on): resolves with the function that
 *  makes one key click (never throws, never waits). Never rejects; a failed fetch gives a function that does nothing, and
 *  the next call tries again. */
export const loadClick = (): Promise<() => void> =>
  import("./click.ts").then(
    (m) => () => m.click(native),
    () => () => {},
  );

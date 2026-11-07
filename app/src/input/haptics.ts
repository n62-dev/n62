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

/** Load the native plugin (idle, after the keypad is drawn). On the web it finds no plugin and changes nothing. */
export async function loadNative(): Promise<void> {
  if (native !== null) return;
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

const webVibrate = (ms: number): void => {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(ms);
  } catch {
    // no vibrator, or the browser forbids it before a user gesture: nothing to do
  }
};

/** Fire one key-down pulse. `strength01` is 0..1, `ms` the duration. Never throws, never waits. */
export function vibrate(strength01: number, ms: number): void {
  const duration = Math.max(1, Math.round(ms));
  if (native !== null) {
    const amplitude = Math.min(255, Math.max(1, Math.round(strength01 * 255)));
    try {
      native.vibrate({ ms: duration, amplitude }).catch(() => webVibrate(duration));
      return;
    } catch {
      // fall through to the web call
    }
  }
  webVibrate(duration);
}

let audio: AudioContext | undefined;
/** A66, the web build: one short click made with Web Audio (no file), at the press. The context is made at the first one,
 *  which is a touch (a user gesture, so the browser lets it sound). */
const webClick = (): void => {
  try {
    if (typeof AudioContext === "undefined") return;
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume().catch(() => {});
    const t0 = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = 2400;
    gain.gain.setValueAtTime(0.2, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.015);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(t0);
    osc.stop(t0 + 0.02);
  } catch {
    // no Web Audio, or the browser forbids it: no click
  }
};

/** Make one key click (A66). Never throws, never waits. */
export function click(): void {
  if (native !== null) {
    try {
      native.click().catch(webClick);
      return;
    } catch {
      // an older shell without click(): fall through to the web click
    }
  }
  webClick();
}

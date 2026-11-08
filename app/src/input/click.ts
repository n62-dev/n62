// SPDX-License-Identifier: GPL-3.0-or-later
// The optional key click (A66), a lazy chunk of its own: the setting is off by default, so haptics.ts fetches this only
// when it is on (loadClick). Android plays the system's key-click effect through the plugin; the web makes one short
// click with Web Audio at the press.
/** The native side's click, as haptics.ts passes it (the plugin once loaded, else null on the web). */
export interface NativeClick {
  click(): Promise<void>;
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
export function click(native: NativeClick | null): void {
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

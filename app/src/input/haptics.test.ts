// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from "vitest";
import { vibrate } from "./haptics.ts";

describe("vibrate (web build)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("calls navigator.vibrate with the duration only; strength is ignored", () => {
    const spy = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate: spy });
    vibrate(0.5, 15);
    expect(spy).toHaveBeenCalledWith(15);
    vibrate(1, 40.4);
    expect(spy).toHaveBeenLastCalledWith(40);
  });

  it("does nothing, and does not throw, without a vibrator", () => {
    vi.stubGlobal("navigator", {});
    expect(() => vibrate(0.5, 15)).not.toThrow();
    vi.stubGlobal("navigator", {
      vibrate: () => {
        throw new Error("blocked");
      },
    });
    expect(() => vibrate(0.5, 15)).not.toThrow();
  });
});

describe("vibrate (native build, R35)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock("@capacitor/core");
    vi.resetModules();
  });

  it("uses navigator.vibrate and reports no strength until loadNative has run, then the plugin with an amplitude", async () => {
    const plugin = { vibrate: vi.fn(() => Promise.resolve()) };
    vi.doMock("@capacitor/core", () => ({
      Capacitor: { isNativePlatform: () => true, isPluginAvailable: () => true },
      registerPlugin: () => plugin,
    }));
    const web = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate: web });
    vi.resetModules();
    const h = await import("./haptics.ts");
    expect(h.hasStrength()).toBe(false);
    h.vibrate(0.5, 15);
    expect(web).toHaveBeenCalledWith(15);
    expect(plugin.vibrate).not.toHaveBeenCalled();
    await h.loadNative();
    expect(h.hasStrength()).toBe(true);
    h.vibrate(0.5, 15);
    expect(plugin.vibrate).toHaveBeenCalledWith({ ms: 15, amplitude: 128 });
  });

  it("stays on the web call when the plugin is not there", async () => {
    vi.doMock("@capacitor/core", () => ({
      Capacitor: { isNativePlatform: () => false, isPluginAvailable: () => false },
      registerPlugin: () => ({}),
    }));
    vi.resetModules();
    const h = await import("./haptics.ts");
    await h.loadNative();
    expect(h.hasStrength()).toBe(false);
  });
});

// A66: the optional key click. Android plays the system's key-click effect through the plugin; the web makes one short
// click with Web Audio at the press. Never throws, never waits.
describe("click (web build)", () => {
  afterEach(() => vi.unstubAllGlobals());

  /** An AudioContext double: counts the oscillators started (one per click). */
  function audio(): { starts: ReturnType<typeof vi.fn>; contexts: ReturnType<typeof vi.fn> } {
    const starts = vi.fn();
    const param = { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() };
    const node = { connect: vi.fn(), disconnect: vi.fn() };
    const contexts = vi.fn();
    class Ctx {
      currentTime = 0;
      state = "running";
      destination = {};
      constructor() {
        contexts();
      }
      resume = vi.fn(() => Promise.resolve());
      createOscillator = () => ({ ...node, type: "square", frequency: { ...param }, start: starts, stop: vi.fn(), onended: null });
      createGain = () => ({ ...node, gain: { ...param } });
    }
    vi.stubGlobal("AudioContext", Ctx);
    return { starts, contexts };
  }

  it("makes one short sound per click, on one shared audio context", async () => {
    const a = audio();
    vi.resetModules();
    const h = await import("./haptics.ts");
    h.click();
    h.click();
    expect(a.starts).toHaveBeenCalledTimes(2);
    expect(a.contexts).toHaveBeenCalledTimes(1);
  });

  it("does nothing, and does not throw, without Web Audio or when it throws", async () => {
    vi.stubGlobal("AudioContext", undefined);
    vi.resetModules();
    let h = await import("./haptics.ts");
    expect(() => h.click()).not.toThrow();
    vi.stubGlobal("AudioContext", class { constructor() { throw new Error("blocked"); } });
    vi.resetModules();
    h = await import("./haptics.ts");
    expect(() => h.click()).not.toThrow();
  });
});

describe("click (native build)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock("@capacitor/core");
    vi.resetModules();
  });

  it("asks the plugin for the system's key click once it is loaded, and falls back to Web Audio when that fails", async () => {
    const plugin = { vibrate: vi.fn(() => Promise.resolve()), click: vi.fn(() => Promise.resolve()) };
    vi.doMock("@capacitor/core", () => ({
      Capacitor: { isNativePlatform: () => true, isPluginAvailable: () => true },
      registerPlugin: () => plugin,
    }));
    const starts = vi.fn();
    const node = { connect: vi.fn() };
    const param = { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() };
    vi.stubGlobal("AudioContext", class {
      currentTime = 0;
      state = "running";
      destination = {};
      resume = vi.fn(() => Promise.resolve());
      createOscillator = () => ({ ...node, frequency: { ...param }, start: starts, stop: vi.fn() });
      createGain = () => ({ ...node, gain: { ...param } });
    });
    vi.resetModules();
    const h = await import("./haptics.ts");
    await h.loadNative();
    h.click();
    expect(plugin.click).toHaveBeenCalledTimes(1);
    expect(starts).not.toHaveBeenCalled();
    plugin.click.mockImplementationOnce(() => Promise.reject(new Error("no audio")));
    h.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(starts).toHaveBeenCalledTimes(1);
  });
});

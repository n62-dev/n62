// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { engineOf, isTested, TESTED } from "./browser.ts";
import { says } from "./tips.ts";

const CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const WEBVIEW = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/90.0.0.0 Mobile Safari/537.36";
const FIREFOX = "Mozilla/5.0 (Android 14; Mobile; rv:128.0) Gecko/128.0 Firefox/128.0";
const FIREFOX_DESKTOP = "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/109.0";
const SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Safari/605.1.15";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1";
const IPHONE_FIREFOX = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/128.0 Mobile/15E148 Safari/605.1.15";
const EDGE = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0";

describe("engineOf (R285)", () => {
  it("reads a Chromium brand as Blink, whatever the string says", () => {
    expect(engineOf(FIREFOX, { brands: [{ brand: "Chromium" }] })).toBe("blink");
  });
  it("reads the string when there is no userAgentData", () => {
    expect(engineOf(CHROME)).toBe("blink");
    expect(engineOf(WEBVIEW)).toBe("blink");
    expect(engineOf(EDGE)).toBe("blink");
    expect(engineOf(FIREFOX)).toBe("gecko");
    expect(engineOf(FIREFOX_DESKTOP)).toBe("gecko");
    expect(engineOf(SAFARI)).toBe("webkit");
  });
  it("counts every iOS browser as WebKit", () => {
    expect(engineOf(IPHONE_CHROME)).toBe("webkit");
    expect(engineOf(IPHONE_FIREFOX)).toBe("webkit");
  });
  it("knows no engine for a string it cannot place", () => {
    expect(engineOf("")).toBe("other");
    expect(engineOf("curl/8.0")).toBe("other");
  });
  it("tests Blink only (A144: Firefox and WebKit failed)", () => {
    expect(TESTED).toEqual(["blink"]);
    expect(isTested("gecko") || isTested("webkit") || isTested("other")).toBe(false);
  });
});

describe("says (the tipsSeen record, R285)", () => {
  it("takes the old `true` as the tips and nothing else", () => {
    expect(says(true, "tips")).toBe(true);
    expect(says(true, "browser")).toBe(false);
  });
  it("reads the object's flags apart", () => {
    expect(says({ browser: true }, "tips")).toBe(false);
    expect(says({ browser: true }, "browser")).toBe(true);
    expect(says({ tips: true, browser: true }, "tips")).toBe(true);
    expect(says(null, "tips")).toBe(false);
    expect(says(undefined, "browser")).toBe(false);
  });
});

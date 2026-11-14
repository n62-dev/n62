// SPDX-License-Identifier: GPL-3.0-or-later
// R312 (vr-10; the owner, 2026-11-14): the desktop keys' help says which layouts its chords are for. Alt+L (@) and
// Alt+N (~) type their character on a German Mac (R131f1), AZERTY's Alt+1 types & (decisions archive): the chords are
// the US and UK layouts' keys.
import { describe, expect, it } from "vitest";
import { desktop } from "./desktopKeys.ts";
import { desktopHelpText } from "./desktopHelp.ts";

describe("desktopHelpText", () => {
  const text = desktopHelpText(desktop);
  const intro = text.split("\n")[0] ?? "";
  it("R312: the intro names the US and UK layouts, and says other layouts type some chords' characters instead", () => {
    expect(intro).toMatch(/\bUS\b/);
    expect(intro).toMatch(/\bUK\b/);
    expect(intro).toMatch(/layout/);
  });
  it("lists a line per desktop key after the intro (Alt+S presses sin)", () => {
    expect(text.split("\n")[1]).toBe("");
    expect(text).toMatch(/Alt\+S\b.*sin/);
  });
});

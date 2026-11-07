// SPDX-License-Identifier: GPL-3.0-or-later
// R154: the role `ring`, the entry field's outline at rest. In every one of the 24 combinations it reads at least 3:1 on
// --bg and on --panel (4.5:1 in High contrast) and stands at least RING_APART from --shift, --alpha and --error.
import { describe, expect, it } from "vitest";
import { apart, CVD } from "./cvd.ts";
import { RING_APART, combos, cr, selector, theme } from "./theme-gen.ts";

const VISION = [null, ...Object.values(CVD)];
const away = (a: string, b: string, all: boolean): number => Math.min(...(all ? VISION : [null]).map((m) => apart(a, b, m)));

describe("R154: --ring", () => {
  it("is at least 0.12 apart (the measure of scripts/cvd.ts)", () => expect(RING_APART).toBe(0.12));
  for (const c of combos())
    it(`${selector(c)}: ${c.high ? "4.5" : "3"}:1 on --bg and --panel, apart from --shift, --alpha and --error`, () => {
      const { t } = theme(c);
      const ring = t["ring"] as string;
      expect(ring, "--ring").toMatch(/^#[0-9a-f]{6}$/);
      const floor = c.high ? 4.5 : 3;
      expect(cr(ring, t["bg"] as string), "on --bg").toBeGreaterThanOrEqual(floor);
      expect(cr(ring, t["panel"] as string), "on --panel").toBeGreaterThanOrEqual(floor);
      // Shift and Alpha: for normal vision and the three deficiencies (R140's rule); the error colour: normal vision (like ⚠ against Shift)
      for (const role of ["shift", "alpha"]) expect(away(ring, t[role] as string, true), `--ring from --${role}`).toBeGreaterThanOrEqual(RING_APART);
      expect(away(ring, t["error"] as string, false), "--ring from --error").toBeGreaterThanOrEqual(RING_APART);
    });
});

// SPDX-License-Identifier: GPL-3.0-or-later
// R821: Settings › Your keys › Third layer (Alpha). Off (the default) the section has 16 rows, U1–U6 on tap and Shift; on, 22. The
// row is a tick that keeps the sheet open, the section's count and Reset's names count an Alpha slot only while it is on, and a
// free key's Alpha press goes to its tap row while it is off.
import { beforeEach, describe, expect, it } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import { UserKeys } from "../keyboard/userKeys.svelte.ts";
import { fakeKv } from "../state/fakeKv.ts";
import { Session } from "../state/session.svelte.ts";
import { Sheet } from "./sheet.svelte.ts";
import { settingsSections } from "./modeSheet.ts";
import { slotsSet, yourKeysItems, yourKeysValue } from "./yourKeys.ts";

let session: Session;
beforeEach(() => {
  session = new Session(new FakeCalc(), fakeKv());
});

const alphaB = { label: "x₀", action: { type: "x0" } };
const withKeys = () => {
  const userKeys = new UserKeys(fakeKv());
  const s = new Sheet("settings", "Settings", () => settingsSections(session, { userKeys }), { remember: false });
  s.pickNumber(5); // Your keys (Mode, Appearance, Numbers, Key vibration, Your keys)
  return { s, userKeys };
};
const byId = (s: Sheet, id: string) => s.level.items.find((x) => x.id === id);

describe("Settings › Your keys › Third layer (Alpha) (R821)", () => {
  it("off: 16 rows, u1:primary … u6:shift, unitcells, units, alphalayer, reset; on: 22 with the Alpha rows", () => {
    const { s, userKeys } = withKeys();
    expect(s.path).toBe("Settings › Your keys");
    const off = s.level.items.map((x) => x.id);
    expect(off).toHaveLength(16);
    expect(off.slice(0, 2)).toEqual(["u1:primary", "u1:shift"]);
    expect(off[11]).toBe("u6:shift");
    expect(off.slice(12)).toEqual(["unitcells", "units", "alphalayer", "reset"]);
    expect(byId(s, "alphalayer")?.selected).toBe(false);
    expect(byId(s, "alphalayer")?.label).toBe("Third layer (Alpha)");
    expect(byId(s, "alphalayer")?.hint).toBe("A flick down on U1–U6, its legend bottom left");
    userKeys.setAlphaLayer(true);
    const on = s.level.items.map((x) => x.id);
    expect(on).toHaveLength(22);
    expect(on.slice(0, 4)).toEqual(["u1:primary", "u1:shift", "u1:alpha", "u2:primary"]);
    expect(on.slice(-3)).toEqual(["units", "alphalayer", "reset"]);
    expect(byId(s, "u1:alpha")?.label).toBe("U1 α");
    expect(byId(s, "alphalayer")?.selected).toBe(true);
  });

  it("the row toggles the switch and the sheet stays", () => {
    const { s, userKeys } = withKeys();
    const row = (): number => s.level.items.findIndex((x) => x.id === "alphalayer"); // (past the digits: a tap or Enter picks it)
    expect(s.activate(row())).toEqual({ kind: "stay" });
    expect(userKeys.alphaLayer).toBe(true);
    expect(s.path).toBe("Settings › Your keys");
    expect(s.activate(row())).toEqual({ kind: "stay" });
    expect(userKeys.alphaLayer).toBe(false);
  });

  it("the section's count and Reset's names count an Alpha slot only while the switch is on", () => {
    const userKeys = new UserKeys(fakeKv());
    userKeys.set("u1", "alpha", alphaB);
    expect(slotsSet(userKeys)).toBe(0);
    expect(yourKeysValue({ userKeys })).toBe("None set");
    userKeys.setAlphaLayer(true);
    expect(slotsSet(userKeys)).toBe(1);
    expect(yourKeysValue({ userKeys })).toBe("1 set");
    userKeys.set("u2", "primary", { label: "sinh", action: { insert: "\\sinh\\left(#0\\right)" } });
    expect(slotsSet(userKeys)).toBe(2);
    const reset = yourKeysItems({ userKeys }).find((x) => x.id === "reset");
    expect(reset?.confirm?.note).toContain("U1 α");
  });

  it("off, a free key's Alpha press goes to its tap row; on, to its Alpha row", () => {
    const { s, userKeys } = withKeys();
    expect(s.goKey("u6", "alpha")).toBe(true);
    expect(s.level.current?.id).toBe("u6:primary");
    expect(s.takes({ id: "u6", user: true } as never, "alpha")).toBe(true);
    userKeys.setAlphaLayer(true);
    expect(s.goKey("u6", "alpha")).toBe(true);
    expect(s.level.current?.id).toBe("u6:alpha");
  });

  it("the unit pad cells keep three legs while the switch is off", async () => {
    const { s } = withKeys();
    s.activate(s.level.items.findIndex((x) => x.id === "unitcells"));
    await s.level.loading();
    expect(s.level.items.slice(0, 3).map((x) => x.label)).toEqual(["U1", "U1 ⇧", "U1 α"]);
    expect(s.goKey("u2", "alpha")).toBe(true);
    expect(s.level.current?.id).toBe("u2:alpha");
  });

  it("Reset all with the switch off names and clears only the shown layers: a stored Alpha slot is kept (R821 fix)", () => {
    const { s, userKeys } = withKeys();
    userKeys.set("u1", "alpha", alphaB);
    expect(byId(s, "reset")?.confirm?.note).toBe("No key is set: nothing to clear.");
    const reset = (): number => s.level.items.findIndex((x) => x.id === "reset");
    s.activate(reset()); // the first pick arms (R857), the second clears
    s.activate(reset());
    userKeys.setAlphaLayer(true);
    expect(userKeys.labelOf("u1", "alpha")).toBe("x₀");
  });
});

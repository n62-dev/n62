// SPDX-License-Identifier: GPL-3.0-or-later
// R857: Settings › Your keys' bulk resets ask once (R281's `confirm`): Reset all your keys and Reset the unit pad cells arm
// on the first pick, name what goes under the list and clear on the second; a slot's "Empty this slot" and a cell's "Back
// to the default" clear one slot at once.
import { afterEach, describe, expect, it } from "vitest";
import type { MenuItem } from "../apps/types.ts";
import { UserKeys } from "../keyboard/userKeys.svelte.ts";
import { fakeKv } from "../state/fakeKv.ts";
import { unitCells } from "../units/userCells.svelte.ts";
import { Sheet } from "./sheet.svelte.ts";
import { yourKeysItems } from "./yourKeys.ts";

const byId = (items: readonly MenuItem[], id: string): MenuItem | undefined => items.find((x) => x.id === id);
const sub = (items: readonly MenuItem[], id: string): readonly MenuItem[] => byId(items, id)?.submenu?.items ?? [];

afterEach(() => unitCells.reset());

describe("Your keys' resets (R857)", () => {
  it("Reset all your keys and Reset the unit pad cells carry confirm; Empty this slot and Back to the default do not", () => {
    const items = yourKeysItems({ userKeys: new UserKeys(fakeKv()) });
    expect(byId(items, "reset")?.confirm).toBeDefined();
    expect(byId(sub(items, "unitcells"), "reset")?.confirm).toBeDefined();
    expect(byId(sub(items, "u1:primary"), "empty")?.confirm).toBeUndefined();
    const leg = sub(sub(items, "unitcells"), "u1:primary");
    expect(byId(leg, "empty")?.confirm).toBeUndefined();
    expect(byId(leg, "default")?.confirm).toBeUndefined();
  });

  it("the note names the keys that go; the label turns to its armed text; the first pick arms, the second clears", () => {
    const userKeys = new UserKeys(fakeKv());
    userKeys.set("u1", "primary", { label: "Home", action: { special: "home" } });
    userKeys.set("u3", "primary", { label: "CAS", action: { special: "cas" } });
    const s = new Sheet("keys", "Your keys", () => yourKeysItems({ userKeys }), { remember: false });
    const reset = () => byId(s.level.items, "reset");
    expect(reset()?.label).toBe("Reset all your keys");
    expect(reset()?.confirm).toMatchObject({ label: "Reset all your keys?", note: "Clears 2 keys: U1, U3. Tap again." });
    const i = s.level.items.findIndex((x) => x.id === "reset");
    expect(s.activate(i)).toEqual({ kind: "stay" });
    expect(s.armed).toBe("reset");
    expect(userKeys.placeOf("u1", "primary")).toBe("home");
    expect(s.activate(i)).toEqual({ kind: "stay" });
    expect(s.armed).toBe(null);
    expect([userKeys.labelOf("u1", "primary"), userKeys.labelOf("u3", "primary")]).toEqual([undefined, undefined]); // empty slots
  });

  it("by keys: Enter arms, Enter again clears; a level change disarms", () => {
    const userKeys = new UserKeys(fakeKv());
    userKeys.set("u2", "shift", { label: "Home", action: { special: "home" } });
    const s = new Sheet("keys", "Your keys", () => yourKeysItems({ userKeys }), { remember: false });
    expect(byId(s.level.items, "reset")?.confirm?.note).toBe("Clears 1 key: U2 ⇧. Tap again.");
    s.level.highlight = s.level.items.findIndex((x) => x.id === "reset");
    s.enter();
    expect(s.armed).toBe("reset");
    s.activate(s.level.items.findIndex((x) => x.id === "u1:primary")); // another row: its level opens
    expect(s.armed).toBe(null);
    s.back();
    s.level.highlight = s.level.items.findIndex((x) => x.id === "reset");
    s.enter();
    s.back(); // ‹ out of the level
    expect(s.armed).toBe(null);
    expect(userKeys.placeOf("u2", "shift")).toBe("home");
  });

  it("the unit pad cells' note names the cells set; the second pick gives the defaults back", async () => {
    await unitCells.restore();
    unitCells.set("u1", "tap", null);
    unitCells.set("u2", "up", null);
    const s = new Sheet("keys", "Your keys", () => yourKeysItems({ userKeys: new UserKeys(fakeKv()) }), { remember: false });
    s.activate(s.level.items.findIndex((x) => x.id === "unitcells"));
    const reset = () => byId(s.level.items, "reset");
    expect(reset()?.confirm).toMatchObject({ label: "Reset the unit pad cells?", note: "Gives 2 cells back their default: U1, U2 ⇧. Tap again." });
    const i = s.level.items.findIndex((x) => x.id === "reset");
    s.activate(i);
    expect(unitCells.isSet("u1", "tap")).toBe(true);
    s.activate(i);
    expect(unitCells.isSet("u1", "tap")).toBe(false);
    expect(unitCells.isSet("u2", "up")).toBe(false);
  });
});

// SPDX-License-Identifier: GPL-3.0-or-later
// R896: Clear, Undo and Redo in the unit view's slots (UnitView.clear, undoBy): one step per edit, a press that changes nothing is dead.
import { describe, expect, it } from "vitest";
import type { IndexItem } from "../find/types.ts";
import { slotCatalogue, type PadAction } from "./slot.ts";
import { UnitView, type ViewHost } from "./view.ts";

const unit = (id: string, title: string, si: string, dim: string): IndexItem =>
  ({ id: `unit:${id}`, kind: "unit" as const, names: [id], title, tier: 0, insert: `\\unit{${id}}{\\mathrm{${id}}}`, si, dim });
const CAT = slotCatalogue([unit("km", "Kilometer", "1000", "m1"), unit("s", "Second", "1", "s1")]);
const U = (id: string): PadAction => ({ do: "unit", id });

function host(): { host: ViewHost; dead: () => number } {
  let dead = 0;
  return {
    dead: () => dead,
    host: {
      write: () => {},
      evaluate: () => new Promise(() => {}),
      find: () => {},
      format: () => ({ format: "STD", digits: 12 }),
      alternatives: () => Promise.resolve([]),
      remember: () => Promise.resolve(),
      dead: () => void dead++,
      changed: () => {},
    },
  };
}

describe("UnitView: Clear, Undo and Redo (R896)", () => {
  const two = (): { view: UnitView; dead: () => number } => {
    const h = host();
    const view = new UnitView(CAT, "7*3", {}, h.host);
    view.start();
    return { view, dead: h.dead };
  };
  const text = (view: UnitView, id: string): unknown => view.model(id)?.slot.tokens.map((t) => `${t.prefix ?? ""}${t.unit}`);

  it("Clear empties the active slot, then every slot; Undo brings them back one Clear at a time", () => {
    const { view } = two();
    view.apply(U("km"));
    view.next();
    view.apply(U("s"));
    view.clear();
    expect([text(view, "u1"), text(view, "u2")]).toEqual([["km"], []]);
    view.clear();
    expect([text(view, "u1"), text(view, "u2")]).toEqual([[], []]);
    view.undoBy(-1);
    expect([text(view, "u1"), text(view, "u2")]).toEqual([["km"], []]);
    view.undoBy(-1);
    expect(text(view, "u2")).toEqual(["s"]);
    view.undoBy(1);
    expect(text(view, "u2")).toEqual([]);
  });

  it("Clear with every slot empty, Undo and Redo with nothing to step to, are dead presses; a refused press is no edit", () => {
    const { view, dead } = two();
    view.clear();
    view.undoBy(-1);
    view.undoBy(1);
    expect(dead()).toBe(3);
    view.apply({ do: "per" });
    view.apply({ do: "per" }); // the second ÷ is refused: nothing to undo for it
    view.undoBy(-1);
    expect(view.model("u1")?.empty).toBe(true);
  });

  it("an edit after an Undo drops the Redo; ⌫ and a letter run are undone", () => {
    const { view, dead } = two();
    view.apply(U("km"));
    view.apply({ do: "delete" });
    expect(text(view, "u1")).toEqual([]);
    view.undoBy(-1);
    expect(text(view, "u1")).toEqual(["km"]);
    view.apply(U("s"));
    view.undoBy(1);
    expect(dead()).toBe(1);
    view.undoBy(-1);
    expect(text(view, "u1")).toEqual(["km"]);
  });
});

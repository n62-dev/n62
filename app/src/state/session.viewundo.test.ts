// SPDX-License-Identifier: GPL-3.0-or-later
// R898: Home ↔ CAS is an undo boundary of the shared line: `onView` (main.ts: the line's undo starts afresh) is called on a
// switch, before the view changes, and not when the view asked for is the one already shown.
import { describe, expect, it } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import { Session } from "./session.svelte.ts";
import { fakeKv } from "./fakeKv.ts";

describe("Session.onView", () => {
  it("is called once per real switch, by setView and toggleView, while the old view still shows", () => {
    const s = new Session(new FakeCalc(), fakeKv());
    const seen: string[] = [];
    s.onView = () => seen.push(s.view);
    s.setView("home"); // (already there)
    s.setView("cas");
    s.setView("cas");
    s.toggleView();
    expect(seen).toEqual(["home", "cas"]);
    expect(s.view).toBe("home");
  });
});

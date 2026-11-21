// SPDX-License-Identifier: GPL-3.0-or-later
// R782: the bar's second place (`Settings.barSlot`): "cas" or an app's id, stored (schema 5, data version 6), checked in a
// backup, and a stored id this build's registry does not know (an older or newer build) loads as CAS.
import { describe, expect, it } from "vitest";
import { APPS } from "../apps/registry.ts";
import { hasMessage, t } from "../i18n/index.ts";
import { SETTING_RULES, VALIDATORS } from "./backup.ts";
import { defaultSettings, migrateSettings, SETTINGS_SCHEMA } from "./session.svelte.ts";
import { DATA_VERSION, SETTINGS_SINCE } from "./storage.ts";

describe("Settings.barSlot (R782)", () => {
  it("defaults to CAS, and a stored app id is kept", () => {
    expect(defaultSettings.barSlot).toBe("cas");
    expect(migrateSettings({ schema: SETTINGS_SCHEMA }).settings.barSlot).toBe("cas");
    for (const a of APPS) expect(migrateSettings({ schema: SETTINGS_SCHEMA, barSlot: a.id }).settings.barSlot).toBe(a.id);
  });
  it("a stored id the registry does not know loads as CAS (an older or newer build), and so does a non-string", () => {
    for (const bad of ["nosuchapp", "", "home", 5, null, true, {}]) expect(migrateSettings({ schema: SETTINGS_SCHEMA, barSlot: bad }).settings.barSlot, String(bad)).toBe("cas");
  });
  it("is schema 5, which has its data version, and a record without it is migrated (written back)", () => {
    expect(SETTINGS_SCHEMA).toBe(5);
    expect(SETTINGS_SINCE[5]).toBe(DATA_VERSION);
    expect(migrateSettings({ schema: 4, barSlot: "solve" })).toMatchObject({ migrated: true, newer: false });
  });
  it("a backup's settings part checks it: CAS or a known app", () => {
    for (const ok of ["cas", ...APPS.map((a) => a.id)]) expect(SETTING_RULES["barSlot"]?.(ok), ok).toBe(true);
    for (const bad of ["nosuchapp", "home", 3, null]) expect(SETTING_RULES["barSlot"]?.(bad), String(bad)).toBe(false);
    expect(VALIDATORS["settings"]?.({ schema: SETTINGS_SCHEMA, ...migrateSettings({ barSlot: "solve" }).settings })).toBe(true);
    expect(VALIDATORS["settings"]?.({ schema: SETTINGS_SCHEMA, barSlot: "nosuchapp" })).toBe(false);
  });
  it("every app has a short name of at most 4 letters (the bar's pill)", () => {
    for (const a of APPS) {
      expect(hasMessage(a.short), a.id).toBe(true);
      expect(t(a.short).length, a.id).toBeLessThanOrEqual(4);
      expect(t(a.short).length, a.id).toBeGreaterThan(0);
    }
    expect(APPS.map((a) => t(a.short))).toEqual(["Func", "Solv"]);
  });
});

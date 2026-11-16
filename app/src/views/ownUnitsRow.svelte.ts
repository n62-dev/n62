// SPDX-License-Identifier: GPL-3.0-or-later
// R201: the row Settings › Your keys › Your units. Only this row is in the Settings chunk; the level it opens (the list,
// the form that makes or changes a unit, the check against Find) is ownUnitsSheet.svelte.ts, loaded when the row opens
// (the level's first draw starts it; SubMenu.loading: keys pressed meanwhile wait for it) and drawn as soon as it is in (`code` is reactive).
import type { MenuItem } from "../apps/types.ts";
import { findText as t } from "../i18n/enFind.ts";
import type { DecimalMark } from "../state/session.svelte.ts";
import type { SettingsEnv } from "./yourKeys.ts";

type Code = typeof import("./ownUnitsSheet.svelte.ts");
let code = $state.raw<Code | null>(null);
let loading: Promise<void> | undefined;

function load(): Promise<void> | null {
  if (code) return null;
  return (loading ??= import("./ownUnitsSheet.svelte.ts").then(
    async (m) => {
      await m.ready();
      code = m;
    },
    () => void (loading = undefined), // (the next opening tries again)
  ));
}

export function ownUnitsItem(env: SettingsEnv, mark: () => DecimalMark): MenuItem {
  return {
    id: "units",
    label: t("keys.units"),
    get value() {
      const n = code?.count();
      return n === undefined ? undefined : n === 0 ? t("keys.none") : t("keys.some", { n: String(n) });
    },
    submenu: {
      title: t("keys.units"),
      remember: false,
      loading: load,
      get items(): MenuItem[] {
        void load(); // (the level's first draw starts the read; `loading` holds the keys pressed before it is in)
        return code ? code.ownUnitsRows(env, mark) : [{ id: "loading", label: t("keys.loading"), disabled: true }];
      },
    },
  };
}

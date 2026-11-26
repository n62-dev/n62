// SPDX-License-Identifier: GPL-3.0-or-later
// R930 (a start-chunk cut): the Apps sheet's and the ☰ Menu's rows and titles, out of AppShell (apps/shell.svelte.ts). The shell
// builds a sheet only once the sheet's model is in (openSheet waits for it, R151), so these ride in the model's chunk
// (views/sheet.svelte.ts re-exports them) and nothing waits longer than before.
import { t } from "../i18n/index.ts";
import { shellText } from "../i18n/enShell.ts";
import { Sheet } from "../views/sheet.svelte.ts";
import { APPS, appEntry, placeGlyph, type BarSlot } from "./registry.ts";
import type { AppShell } from "./shell.svelte.ts";
import type { MenuItem } from "./types.ts";

/** Apps key: the Apps sheet (1 Home, 2 CAS, then the apps). `slot` (R782, a second tap on the current slot-2 place): the same
 *  sheet titled "Slot 2", where a pick puts that place in slot 2 and opens it, Home's row is dead and the CAS row puts CAS back. */
export const appsSheet = (shell: AppShell, id: string, slot: boolean): Sheet =>
  new Sheet(id, shellText(slot ? "apps.slot" : "apps.title"), () =>
    (["home", "cas", ...APPS.map((a) => a.id)] as const).map((p) => ({
      id: p,
      label: t(p === "home" || p === "cas" ? `view.${p}` : appEntry(p).name),
      glyph: placeGlyph(p),
      disabled: slot && p === "home",
      selected: slot && shell.barSlot?.() === p,
      run: () => {
        if (slot) shell.setBarSlot?.(p as BarSlot);
        if (p === "home" || p === "cas") shell.goTo?.(p);
        else void shell.open(p);
      },
    })),
  );

/** The open view's own Menu items (Home/CAS: the copy actions), or the pointer row (R83). Settings is the ⚙ in the
 *  title row (R145), not a row. */
export function menuItems(shell: AppShell): readonly MenuItem[] {
  const own = shell.app === null ? shell.homeMenu?.() : shell.instance?.menu?.(shell.view);
  if (!own || own.length === 0) return shell.code?.pointer(shell) ?? [];
  return own.every((r) => r.slotRow) ? [...own, ...(shell.code?.pointer(shell) ?? [])] : own; // R261: Symb's Clear keeps the pointer
}

/** Menu key: the open view's menu, titled with the view whose Menu it is and that view's icon. */
export function menuSheet(shell: AppShell, at?: string): Sheet {
  const v = shell.app === null ? (shell.homeView?.() ?? "home") : shell.view;
  return new Sheet(`menu:${shell.app === null ? "home" : `${shell.app}:${shell.view}`}`, shellText("menu.title", { view: t(`view.${v}`) }), () => menuItems(shell), { icon: v, at, settings: shell.toSettings });
}

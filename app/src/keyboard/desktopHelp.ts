// SPDX-License-Identifier: GPL-3.0-or-later
// R131: Settings › Help and about › Desktop keys, a text built from spec/keyboard.yaml `desktop:` (desktopKeys.ts), so the
// list is the map hwkeys.ts acts on. One line per key and layer: its desktop keys, then what it presses (the key's
// legend in that layer). A character that types its own legend (7, x, A) is not listed: the intro says so.
import { legend } from "../i18n/index.ts";
import { aboutText as t, type AboutKey } from "../i18n/enAbout.ts";
import { desktop, type DeskTarget } from "./desktopKeys.ts";
import { keyboard } from "./keyboard.ts";

/** What a desktop key presses, in the keypad's words. */
function pressed(target: DeskTarget): string {
  if ("action" in target) return t(`keys.action.${target.action}` as AboutKey);
  const key = keyboard.byId.get(target.key);
  if (!key) return target.key;
  if (key.user) return `${t("keys.user")} ${key.id.toUpperCase()}${target.layer === "shift" ? `, ${t("keys.shift")}` : ""}`;
  const label = key.label[target.layer] ?? key.label.primary ?? key.id;
  return legend(label);
}

/** The help text: the intro, then a line per key and layer that has a desktop key of its own. */
export function desktopHelpText(): string {
  const lines = desktop.entries.flatMap((e) => {
    const what = pressed(e.target);
    if (e.names.length === 0 || e.names.every((n) => n === what || n.toUpperCase() === what)) return [];
    return [`${e.names.join(` ${t("keys.or")} `)}   ${what}`];
  });
  return [t("keys.intro"), "", ...lines].join("\n");
}

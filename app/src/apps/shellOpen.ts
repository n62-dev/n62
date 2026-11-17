// SPDX-License-Identifier: GPL-3.0-or-later
// R362 (S58 cuts 1 and 4): the shell's app-opening part, out of the start chunk. The start keeps the state every key and
// the status line read (shell.svelte.ts); this chunk loads with the first app key (AppShell.open, which also restores the
// app open at the last exit), and carries the view tabs' icons, which the status line draws only while an app is open.
// It imports the shell as a type only: a value import of a start module's class would make Rolldown cut shared modules
// out of the entry (R294).
import type { Chip } from "../input/chips.ts";
import { t } from "../i18n/index.ts";
import type { AppShell } from "./shell.svelte.ts";
import { appEntry } from "./registry.ts";
import type { AppHost, AppId, AppInstance, LoadedApp, MenuItem, ViewId } from "./types.ts";

export { ICONS } from "../views/icons.ts";

/** What an app reaches of the shell. */
function host(s: AppShell): AppHost {
  return {
    calc: s.calc,
    kv: s.kv,
    get settings() {
      return s.settings();
    },
    get userNames() {
      return s.userNames();
    },
    setEntry: (latex: string) => {
      s.entryBase = latex;
      s.entry.set(latex);
    },
    copy: (text: string, notice?: string) => void s.clip?.copyRaw(text, notice),
    notice: (text: string) => s.clip?.say(text),
    toHome: (shown: string, chip: Chip) => toHome(s, shown, chip),
    paste: () => s.clip?.pasteHeld(),
  };
}

/** Load (once) and restore an app. */
export function load(s: AppShell, id: AppId): Promise<LoadedApp> {
  const have = s.loaded[id];
  if (have) return Promise.resolve(have);
  let p = s.pending.get(id);
  if (!p) {
    p = appEntry(id)
      .load(host(s))
      .then(async (l) => {
        await l.instance.restore();
        s.loaded = { ...s.loaded, [id]: l };
        return l;
      });
    s.pending.set(id, p);
  }
  return p;
}

/** The rest of AppShell.open, which has already set the app and its loading state: load it, then show the view asked
 *  for (default: the view it was left in, else its first). */
export async function open(s: AppShell, id: AppId, view?: ViewId): Promise<void> {
  const l = await load(s, id);
  if (s.app !== id) return;
  const v = view ?? (l.instance.views.includes(s.view) ? s.view : (l.instance.views[0] as ViewId));
  showView(s, l.instance, v);
}

export function showView(s: AppShell, a: AppInstance, v: ViewId): void {
  if (s.homeLine) setAside(s);
  if (s.view !== v || s.entryBase !== "" || s.entry.value !== "") {
    s.entryBase = "";
    s.entry.clear();
  }
  s.view = v;
  s.save();
  a.show?.(v);
}

/** R270: leaving Home for an app view sets Home's unentered line (text and chips) aside; a name being typed (R89) ends
 *  first, so the line it set aside is the one taken. An empty line sets nothing aside (a stored one stays). */
function setAside(s: AppShell): void {
  s.homeLine = false;
  s.prompt?.cancel();
  const latex = s.entry.value;
  if (latex !== "") s.aside = { latex, chips: s.entry.chips ?? {} };
}

/** R262: Menu › To Home: Home comes back as the place keys bring it (Home's set-aside line too), and the answer goes on
 *  its line as a chip, as a tapped history result does. The explicit carry R76 allows: what the app had on its line
 *  (a value, a half-typed one too) stays with the app. */
export function toHome(s: AppShell, shown: string, chip: Chip): void {
  s.entryBase = s.entry.value; // the app's line is not carried: close() clears it
  if (s.goTo) s.goTo("home");
  else s.close();
  s.entry.insertResult?.(shown, chip);
}

/** R83: a view whose Menu has no rows of its own (or only slot rows, R261) gets one row naming the view that has them; it
 *  switches there and opens that Menu on its first row. Nothing when the view has rows, or no view has. */
export function pointer(s: AppShell): MenuItem[] {
  const a = s.instance;
  if (s.app === null || !a?.menu) return [];
  for (const v of a.views) {
    const rows = v === s.view ? [] : a.menu(v);
    if (rows.length === 0) continue;
    const [x, y] = rows;
    const low = (w: string): string => (/^\p{Lu}\p{Ll}/u.test(w) ? w.charAt(0).toLowerCase() + w.slice(1) : w);
    const labels = `${x?.label ?? ""}${y ? `, ${low(y.label)}` : ""} …`;
    return [
      {
        id: `in-${v}`,
        label: t("menu.inView", { labels, view: t(`view.${v}`) }),
        run: () => void s.setView(v).then(() => s.toggleMenu({ at: x?.id })),
      },
    ];
  }
  return [];
}

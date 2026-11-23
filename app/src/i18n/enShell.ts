// SPDX-License-Identifier: GPL-3.0-or-later
// The words only the shell's app-opening chunk reads (apps/shellOpen.ts with views/AppViews.svelte, R362): a table of its
// own, so the start chunk does not carry them (it is pinned, size-check.ts; R862, G399). English only so far.
export const enShell = {
  /** The Menu's row that opens another view's menu (R83): its first two labels, then the view. */
  "menu.inView": "{labels} in {view}",
  /** The view tabs' group in an open app's bay. */
  "status.views": "Views",
} as const;

/** A shell message; `{name}` placeholders are filled from `vars`, as `t` does. */
export const shellText = (key: keyof typeof enShell, vars?: Readonly<Record<string, string>>): string =>
  vars ? enShell[key].replace(/\{(\w+)\}/g, (all, k: string) => vars[k] ?? all) : enShell[key];

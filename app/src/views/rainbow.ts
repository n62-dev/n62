// SPDX-License-Identifier: GPL-3.0-or-later
// R881: the rainbow egg. "rainbow" then Enter (entry/credits.ts eggOf) turns a funky colour mode on for the session, and again
// off; a theme pick or a restart ends it too (theme/lookApply.ts clears the mark). A lazy chunk reached through the Find chunk,
// as the credits are. The mark `data-rainbow` on :root is never stored and never in a backup. Each key gets a hue along a
// diagonal over the keypad from a start hue new each time; the colours (views/rainbowPalette.ts) keep each token's OKLCH
// lightness, and the history's texts, marks and results keep theirs. rainbow.css turns the keypad and washes the history.
import "./rainbow.css";
import type { AppShell } from "../apps/shell.svelte.ts";
import type { ClipActions } from "../clipboard/actions.svelte.ts";
import { rainbowText as t } from "../i18n/enRainbow.ts";
import { keyColours, keyHues, keyTexts, TOKENS, washOf } from "./rainbowPalette.ts";

const MARK = "data-rainbow";
/** The key colours: one rule per key, rewritten at each start. */
let sheet: HTMLStyleElement | undefined;

/** Turn the rainbow on (with its notice, through the clipboard code's notice) or off. The shell is the credits' argument. */
export function toggle(_shell: AppShell, withClip: (run: (c: ClipActions) => void) => void): void {
  const root = document.documentElement;
  if (root.hasAttribute(MARK)) return root.removeAttribute(MARK);
  paint(root, Math.random() * 360);
  root.setAttribute(MARK, "");
  withClip((c) => c.say(t("on")));
}

/** Write the rules: each key's face tokens at its hue, the key texts in grey on the keypad, the wash's stops on :root. */
function paint(root: HTMLElement, start: number): void {
  const css = getComputedStyle(root);
  const tokens = Object.fromEntries(TOKENS.map((n) => [n, css.getPropertyValue(`--${n}`).trim().toLowerCase()]).filter(([, v]) => /^#[0-9a-f]{6}$/.test(v as string)));
  const keys = [...document.querySelectorAll<HTMLElement>(".pad .key[data-key]")];
  const hues = keyHues(keys.map((k) => [parseInt(k.style.gridRowStart) || 1, parseInt(k.style.gridColumnStart) || 1]), start);
  const decl = (c: Record<string, string>): string => Object.entries(c).map(([n, v]) => `--${n}:${v}`).join(";");
  const rules = keys.map((k, i) => `:root[${MARK}] .pad .key[data-key="${CSS.escape(k.dataset["key"] ?? "")}"]{${decl(keyColours(tokens, hues[i] ?? start))}}`);
  rules.push(`:root[${MARK}] .pad{${decl(keyTexts(tokens))}}`, `:root[${MARK}]{--rb-wash:${washOf(tokens, start).join(",")}}`);
  (sheet ??= document.head.appendChild(document.createElement("style"))).textContent = rules.join("\n");
}

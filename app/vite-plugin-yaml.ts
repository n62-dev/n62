// SPDX-License-Identifier: GPL-3.0-or-later
// Turns `import data from "x.yaml"` into a JSON module at build time, so the shipped app carries no YAML parser.
// In `vite build`, spec/keyboard.yaml loses its test-only fields (src/keyboard/shipped.ts); dev and tests see it whole.
import { parse } from "yaml";
import type { Plugin } from "vite";
import { shippedDesktop, shippedKeyboard, shippedPalettes } from "./src/keyboard/shipped.ts";

export function yamlPlugin(): Plugin {
  let build = false;
  return {
    name: "n62-yaml",
    configResolved(c) {
      build = c.command === "build";
    },
    transform(code, id) {
      const [path = "", query] = id.split("?");
      if (!path.endsWith(".yaml")) return null;
      const data: unknown = parse(code);
      const keyboard = build && path.endsWith("/spec/keyboard.yaml");
      // `keyboard.yaml?palettes`: the Shift palettes' lazy chunk (R18, src/keyboard/shiftPalettes.ts)
      // `keyboard.yaml?desktop`: the desktop keys, in hwkeys.ts's chunk (R131)
      const out = !keyboard ? data : query === "palettes" ? shippedPalettes(data) : query === "desktop" ? shippedDesktop(data) : shippedKeyboard(data);
      return { code: `export default ${JSON.stringify(out)};`, map: null };
    },
  };
}

// SPDX-License-Identifier: GPL-3.0-or-later
/// <reference types="svelte" />
/// <reference types="vite/client" />
declare module "*.yaml" {
  const data: unknown;
  export default data;
}
/** spec/keyboard.yaml's Shift palettes alone, for their lazy chunk (vite-plugin-yaml.ts). */
declare module "*.yaml?palettes" {
  const data: unknown;
  export default data;
}
/** The About screen's data, built from package.json, THIRD_PARTY.md, LICENSES/ and the trust facts of tools/trust/facts.mts (vite-plugin-about.ts). */
declare module "virtual:about" {
  interface AboutPart {
    readonly name: string;
    readonly version: string;
    readonly licence: string;
    /** The first word of the Source column: its URL. */
    readonly source: string;
    readonly copyright: string;
    /** The licence ids the Licence column names ("A OR B": two). */
    readonly ids: readonly string[];
  }
  /** One of the five traps of the "Why trust it" page (A94): the golden row's input (LaTeX where the row has no `input`), the value N62 shows
   *  and its mark, the true value and what an ordinary IEEE double gives. */
  interface AboutTrap {
    readonly id: string;
    readonly label: string;
    readonly input: string;
    readonly expect: string;
    readonly mark: string;
    readonly truth: string;
    readonly double: string;
  }
  /** The counts behind the page's sentences (tools/trust/facts.mts: the golden files, oracle-counts.json, the Giac patches' README). */
  interface AboutTrust {
    readonly golden: {
      readonly answers: number;
      readonly open: number;
      readonly computed: number;
      readonly exact: number;
      readonly mpmath: number;
      readonly crossChecked: number;
      readonly handOrGuard: number;
    };
    readonly patches: {
      readonly total: number;
      readonly sent: number;
      readonly reported: number;
      readonly applied: number;
      readonly waiting: number;
      readonly notSent: number;
    };
    readonly traps: readonly AboutTrap[];
  }
  const data: {
    readonly version: string;
    readonly parts: readonly AboutPart[];
    readonly licences: Readonly<Record<string, string>>;
    readonly trust: AboutTrust;
  };
  export default data;
}
/** The engine's file name under engine/: `giac.mjs` in dev and tests, `giac.<hash>.mjs` in a production build (vite.config.ts, A49). */
declare const __GIAC_MJS__: string;

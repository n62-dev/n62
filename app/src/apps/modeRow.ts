// SPDX-License-Identifier: GPL-3.0-or-later
// R785: the last row of every app view's ☰ (Function's and Solve's Symb, Plot and Num): Mode. In an app the bar's bay holds the
// view icons, so the format and digits chip that opens Mode in Home and CAS is not there; this row opens the same sheet, on
// Format. A slot row (R261): it acts on no slot, so a view whose other rows are all slot rows still gets the pointer row (R83).
import { t } from "../i18n/index.ts";
import type { AppHost, MenuItem } from "./types.ts";

export function modeRow(host: AppHost): MenuItem {
  return { id: "mode", label: t("mode.title"), slotRow: true, run: () => host.mode() };
}

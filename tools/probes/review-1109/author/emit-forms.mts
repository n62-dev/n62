// SPDX-License-Identifier: GPL-3.0-or-later
// author probe: the Giac text of forms the packages depend on
import { latexToGiac } from "../../../../app/src/input/latex-to-giac.ts";
for (const t of ["\\left(1+\\exponentialE^{-200}\\right)^{\\exponentialE^{200}}", "\\left(1+\\pi^{-200}\\right)^{\\pi^{200}}", "\\exp\\left(-200\\right)", "\\left(1+\\exp\\left(-200\\right)\\right)^{\\exp\\left(200\\right)}", "\\sqrt[3]{\\sin\\left(10^{70}\\right)}", "\\ln\\left(\\sin\\left(10^{70}\\right)^2\\right)", "\\log\\left(\\sin\\left(10^{70}\\right)^2\\right)", "\\log_{2}\\left(\\sin\\left(10^{70}\\right)^2\\right)", "\\operatorname{atan2}\\left(1,2\\right)", "\\operatorname{sort}\\left(\\left\\lbrace3,1\\right\\rbrace\\right)", "\\operatorname{SortA}\\left(\\left\\lbrace3,1\\right\\rbrace\\right)"]) {
  try { console.log(t, "=>", latexToGiac(t)); } catch (e) { console.log(t, "=> ERR", (e as Error).message); }
}

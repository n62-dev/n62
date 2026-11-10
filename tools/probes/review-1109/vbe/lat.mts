// SPDX-License-Identifier: GPL-3.0-or-later
import { latexToGiac } from "../../../../app/src/input/latex-to-giac.ts";
for (const t of ["\\left(1+1ᴇ-15\\imaginaryI \\right)^{\\frac{1}{3}}", "\\lim_{x\\to 1.5}\\left(\\operatorname{round}\\left(x\\right)\\right)", "\\lim_{x\\to1.0}\\left(\\operatorname{floor}\\left(x\\right)\\right)"]) console.log(t, "=>", latexToGiac(t));

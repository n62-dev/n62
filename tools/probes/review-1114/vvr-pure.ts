// SPDX-License-Identifier: GPL-3.0-or-later
// vvr (verifier of vr, night review 2026-11-14): pure-code rechecks of vr-1, vr-2, vr-4, vr-6, vr-9. No engine.
import { latexToGiac } from "../../../app/src/input/latex-to-giac.ts";
import { formatBase } from "../../../app/src/engine/formatBase.ts";
import { decimalLatex } from "../../../app/src/engine/decimalLatex.ts";
import { tidyGiacLatex } from "../../../app/src/render/tidy.ts";
const p = (l: string, o: object = {}): string => { try { return latexToGiac(l, o as never); } catch (e) { return "ERROR " + (e as Error).message; } };
const chips = { "res:0": { value: "5", exact: true } };
console.log("vr-1 typed  ", p("2\\cdot\\res{0}{5}-1", { chips }));
console.log("vr-1 inverted", p("\\res{0}{5}2\\cdot-1", { chips }));
console.log("vr-1 paste  ", p("32"));
for (const n of ["mean", "size", "factor", "trace", "sin", "rate"]) console.log("vr-2", n, p(`5\\blacktriangleright\\operatorname{${n}}`));
for (const [v, b] of [["-1", 8], ["-128", 8], ["-2", 64]] as const) { const s = formatBase(v, "hex", b, true); console.log("vr-4", v, b, s, typeof s === "string" ? p(s) : "-"); }
console.log("vr-6", JSON.stringify(formatBase("300", "hex", 8, false)), JSON.stringify(formatBase("255", "hex", 8, true)));
const t = tidyGiacLatex("1.5e-20+2.0\\cdot i");
console.log("vr-9 tidy", t);
console.log("vr-9 parse", p(`T:=\\begin{pmatrix}\\operatorname{approx}\\left(${t}\\right)&9\\end{pmatrix}`));
console.log("vr-9 real", p(`T:=\\begin{pmatrix}\\operatorname{approx}\\left(${decimalLatex("1.5e-20")}\\right)&9\\end{pmatrix}`));

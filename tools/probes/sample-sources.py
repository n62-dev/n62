#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Probe (S36): the 16 values of app/public/samples/materials.txt against what their sources say.

Exact arithmetic (fractions). For each name it checks that the definition, the number its `// source:` line
states, its `// test:` line and the value found in the public source (docs/shifts/2026-11-sandra-sample-sources.md)
agree. Exit 1 when one differs. Tests that call the file's functions are left to `tools/probes/library.ts check`.

  python3 tools/probes/sample-sources.py                 # from the repo root
  python3 tools/probes/sample-sources.py --sheet FILE    # also print the sheet's rows (needs pypdf in a scratch venv)

The sheet: https://kupfer.de/wp-content/uploads/2019/11/Cu-ETP.pdf
"""
import ast
import operator
import re
import sys
from fractions import Fraction as F
from pathlib import Path

SAMPLE = Path("app/public/samples/materials.txt")
T = F(20)  # the temperature of the file's conductivities, in °C

# name: (text its source line must contain, the value that line states in SI, the value found in the public source)
SOURCES = {
    "E_steel": ("210 000 N/mm²", F(210000) * 10**6, F(210000) * 10**6),
    "rho_steel": ("7850 kg/m³", F(7850), F(7850)),
    "alpha_steel": ("12×10⁻⁶", F(12, 10**6), F(12, 10**6)),
    "lambda_steel": ("54 − 3.33×10⁻² θ", 54 - F(333, 10000) * T, 54 - F(333, 10000) * T),
    "E_alu": ("70 000 N/mm²", F(70000) * 10**6, F(70000) * 10**6),
    "rho_alu": ("2700 kg/m³", F(2700), F(2700)),
    "alpha_alu": ("23×10⁻⁶", F(23, 10**6), F(23, 10**6)),
    "lambda_alu": ("0.07 θ + 190", F(7, 100) * T + 190, F(7, 100) * T + 190),
    "E_copper": ("127 kN/mm²", F(127) * 10**9, F(110) * 10**9),  # sheet 3.9: 110 annealed, 130 cold-worked (20 °C)
    "rho_copper": ("8.93 g/cm³", F(8930), F(8930)),  # sheet 3.1, 20 °C
    "alpha_copper": ("17×10⁻⁶", F(17, 10**6), F(168, 10**7)),  # sheet 3.3, 20 to 100 °C: 16.8
    "lambda_copper": ("394 W/(m·K)", F(394), F(394)),  # sheet 3.5, 20 °C
    "E_C30": ("33 GPa", F(33) * 10**9, F(33) * 10**9),
    "gamma_C30": ("24 kN/m³", F(24000), F(24000)),
    "alpha_C30": ("10×10⁻⁶", F(10, 10**6), F(10, 10**6)),
    "lambda_C30": ("upper limit", 2 - F(2451, 10000) * (T / 100) + F(107, 10000) * (T / 100) ** 2,
                   2 - F(2451, 10000) * (T / 100) + F(107, 10000) * (T / 100) ** 2),
}

OPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv,
       ast.Pow: operator.pow}


def value(node, names):
    """An arithmetic expression of integers and the file's names, in exact fractions."""
    if isinstance(node, ast.Expression):
        return value(node.body, names)
    if isinstance(node, ast.Constant) and isinstance(node.value, int):
        return F(node.value)
    if isinstance(node, ast.Name):
        return names[node.id]
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
        return -value(node.operand, names)
    if isinstance(node, ast.BinOp) and type(node.op) in OPS:
        return OPS[type(node.op)](value(node.left, names), value(node.right, names))
    raise ValueError(ast.dump(node))


def expr(text, names):
    return value(ast.parse(text.replace("^", "**"), mode="eval"), names)


def main():
    lines = SAMPLE.read_text(encoding="utf8").splitlines()
    names, where, source_line, bad = {}, {}, None, 0
    for n, line in enumerate(lines, 1):
        if line.startswith("// source:"):
            source_line = (n, line)
        m = re.fullmatch(r"([A-Za-z_]\w*):=([-0-9*^]+)", line)
        if m:
            names[m[1]] = expr(m[2], {})
            where[m[1]] = (n, source_line)
    missing = set(SOURCES) ^ set(names)
    if missing:
        print("names differ from the probe's table:", sorted(missing))
        return 1
    for name, (text, stated, found) in SOURCES.items():
        n, (sn, sline) = where[name]
        notes = []
        if text not in sline:
            notes.append(f"source line lacks {text!r}")
        if names[name] != stated:
            notes.append(f"definition {names[name]} != source line {stated}")
        if stated != found:
            notes.append(f"public source says {float(found):g}, file has {float(stated):g}")
        bad += bool(notes)
        print(f"{'ok      ' if not notes else 'DIFFERS '} {name:14} line {n:3} (source {sn:3}) = {float(names[name]):g}"
              + (": " + "; ".join(notes) if notes else ""))
    tests = run = 0
    for n, line in enumerate(lines, 1):
        m = re.fullmatch(r"// test: (.*) == (.*)", line)
        if m:
            tests += 1
            if "(" in m[1].split("/")[0]:  # a call of one of the file's functions: the engine's job
                continue
            run += 1
            if expr(m[1], names) != expr(m[2], names):
                bad += 1
                print(f"DIFFERS  test line {n}: {line}")
    print(f"{len(SOURCES)} values, {run} of {tests} tests in exact arithmetic, {bad} differ")
    if len(sys.argv) == 3 and sys.argv[1] == "--sheet":
        import pypdf  # scratch venv only; not a dependency of the repo
        pages = pypdf.PdfReader(sys.argv[2]).pages
        print("page 1:", [x for x in pages[0].extract_text().splitlines() if x.startswith("Stand")])
        for page, title in ((1, "3.1 Dichte"), (1, "3.3 Längen"), (2, "3.5 Wärme"), (3, "3.9 Elast")):
            text = [x.strip() for x in pages[page].extract_text().splitlines() if x.strip()]
            at = next(i for i, x in enumerate(text) if x.startswith(title))
            print(f"page {page + 1}:", " | ".join(text[at:at + 11]))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

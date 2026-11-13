#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Probe (S50): the expected values of the published ten benchmark tasks (docs/research/benchmark-protocol.md).

Every value is computed twice, at 50 and at 80 digits, and printed to 30 significant digits only when both agree
there; exact ones (fractions) are printed as fractions too. Exit 1 when a pair disagrees.

  tests/golden/.venv/bin/python tools/probes/benchmark-values.py          # from the repo root
  tests/golden/.venv/bin/python tools/probes/benchmark-values.py --qalc libqalculate-5.13.1.tar.gz

--qalc reads the pinned libqalculate tarball (engine/qalc/_downloads/, never unpacked to disk) and prints the source
lines that make `±` and `+/-` an input of a number with an uncertainty, and the default propagation mode.
"""
import sys
import tarfile
from fractions import Fraction as F

import mpmath


def values(dps):
    mpmath.mp.dps = dps
    pi = mpmath.pi
    deg = pi / 180
    readings = [F(s) for s in ["9.81", "9.79", "9.83", "9.80", "9.82", "9.78", "9.84", "9.81", "9.80", "9.82"]]
    mean = sum(readings) / len(readings)
    ss = sum((r - mean) ** 2 for r in readings)
    a, sa, b, sb = F("12.34"), F("0.05"), F("3.2"), F("0.1")
    var1 = (b * sa) ** 2 + (a * sb) ** 2  # first order (GUM 5.1.2)
    var2 = var1 + (sa * sb) ** 2  # with the second-order term of a product of independent inputs (GUM 5.1.2 note)
    integral = mpmath.quad(lambda x: mpmath.sin(x) ** 2, [0, pi])
    return {
        "1 t01 4.7k || 10k (exact 470000/147)": (F(4700 * 10000, 4700 + 10000), None),
        "2 t02 72 km/h in m/s (exact)": (F(72) * F(1000, 3600), None),
        "3 t04 2*pi*25 mm in m": (None, 2 * pi * mpmath.mpf("0.025")),
        "4 t08 3x3 system x": (F(1), None),
        "5a t09 mean": (mean, None),
        "5b t09 sample std dev (n-1)": (None, mpmath.sqrt(mpmath.mpf(ss.numerator) / ss.denominator / 9)),
        "5c t09 population std dev (n)": (None, mpmath.sqrt(mpmath.mpf(ss.numerator) / ss.denominator / 10)),
        "6a t10 value (exact)": (a * b, None),
        "6b t10 sigma, first order": (None, mpmath.sqrt(mpmath.mpf(var1.numerator) / var1.denominator)),
        "6c t10 sigma, with second order (N62, G41)": (None, mpmath.sqrt(mpmath.mpf(var2.numerator) / var2.denominator)),
        "8a t11 int_0^pi sin^2 x dx = pi/2": (None, pi / 2),
        "8b t11 the same by quadrature (check)": (None, integral),
        "9 t12 root of cos x = x": (None, mpmath.findroot(lambda x: mpmath.cos(x) - x, 0.7)),
        "10a t13 3.2*sin(25 deg)/4.7": (None, mpmath.mpf("3.2") * mpmath.sin(25 * deg) / mpmath.mpf("4.7")),
        "10b t13 3.2*sin(27 deg)/4.7": (None, mpmath.mpf("3.2") * mpmath.sin(27 * deg) / mpmath.mpf("4.7")),
    }


def qalc(path):
    wanted = [
        ("libqalculate/Calculator-parse.cc", ["internal_signs[]"]),
        ("libqalculate/Number.cc", ["look for +/-", "number.find(SIGN_PLUSMINUS)", 'number.find("+/-")', "setUncertainty(pm_nr)"]),
        ("libqalculate/includes.h", ['SIGN_PLUSMINUS\t', "Default: INTERVAL_CALCULATION_VARIANCE_FORMULA"]),
    ]
    with tarfile.open(path) as t:
        for name, needles in wanted:
            member = next(m for m in t.getmembers() if m.name.endswith(name))
            text = t.extractfile(member).read().decode("utf8", "replace").split("\n")
            for i, line in enumerate(text, 1):
                if any(n in line for n in needles):
                    print(f"{name}:{i}: {line.strip()[:160]}")


def main():
    if "--qalc" in sys.argv:
        qalc(sys.argv[sys.argv.index("--qalc") + 1])
        return 0
    lo, hi = values(50), values(80)
    bad = 0
    mpmath.mp.dps = 80
    for key, (exact, _) in hi.items():
        if exact is not None:
            print(f"{key}: = {exact} = {mpmath.nstr(mpmath.mpf(exact.numerator) / exact.denominator, 30)}  [derived]")
            continue
        a, b = lo[key][1], hi[key][1]
        sa, sb = mpmath.nstr(a, 30, strip_zeros=False), mpmath.nstr(b, 30, strip_zeros=False)
        ok = sa == sb
        bad += not ok
        print(f"{key}: {sb}  [{'oracle, 50 and 80 digits agree' if ok else 'DISAGREE: ' + sa}]")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

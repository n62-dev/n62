# SPDX-License-Identifier: GPL-3.0-or-later
# Night review 2026-11-16, fh: oracle values (mpmath, 40 digits) for the two fits fh-run.sh asks Giac for.
# exponential: y = b*a^x by least squares of ln y on x; power: y = b*x^a by least squares of ln y on ln x.
# Run: tests/golden/.venv/bin/python -I <this>
from mpmath import mp, mpf, log, exp

mp.dps = 40


def linfit(xs, ys):
    n = len(xs)
    sx = sum(xs); sy = sum(ys)
    sxx = sum(x * x for x in xs); sxy = sum(x * y for x, y in zip(xs, ys))
    slope = (n * sxy - sx * sy) / (n * sxx - sx * sx)
    return slope, (sy - slope * sx) / n


X = [mpf(1), mpf(2), mpf(3), mpf(4)]
Y = [mpf("2.7"), mpf("7.4"), mpf("20.1"), mpf("54.6")]
m, c = linfit(X, [log(y) for y in Y])
print("exponential y=b*a^x: a =", mp.nstr(exp(m), 15), " b =", mp.nstr(exp(c), 15))
Y2 = [mpf(1), mpf("4.1"), mpf("8.9"), mpf("16.2")]
m, c = linfit([log(x) for x in X], [log(y) for y in Y2])
print("power y=b*x^a: a =", mp.nstr(m, 15), " b =", mp.nstr(exp(c), 15))

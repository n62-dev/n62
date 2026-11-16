# SPDX-License-Identifier: GPL-3.0-or-later
# Night review 2026-11-16, verifier of fh: oracle values, computed independently of fh-fit-oracle.py (normal equations
# solved with mpmath's lu_solve, 50 digits) and the psi conversion of fh-9.
from mpmath import mp, mpf, log, exp, matrix, lu_solve
mp.dps = 50
def fit(xs, ys):
    A = matrix([[1, x] for x in xs]); At = A.T
    c = lu_solve(At * A, At * matrix(ys))
    return c[0], c[1]
X = [mpf(i) for i in (1, 2, 3, 4)]
c0, c1 = fit(X, [log(mpf(y)) for y in ("2.7", "7.4", "20.1", "54.6")])
print("exp fit y=b*a^x: a =", mp.nstr(exp(c1), 15), "b =", mp.nstr(exp(c0), 15))
c0, c1 = fit([log(x) for x in X], [log(mpf(y)) for y in ("1", "4.1", "8.9", "16.2")])
print("power fit y=b*x^a: a =", mp.nstr(c1, 15), "b =", mp.nstr(exp(c0), 15))
lbf = mpf("0.45359237") * mpf("9.80665"); inch = mpf("0.0254")
p = 500 * lbf / (mpf("0.25") * inch**2)
print("500 lbf / 0.25 in^2 =", mp.nstr(p / 1e6, 15), "MPa =", mp.nstr(p / (lbf / inch**2), 15), "psi")

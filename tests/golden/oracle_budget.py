# SPDX-License-Identifier: GPL-3.0-or-later
# G272: the oracle of app/src/budget/model.test.ts rows a to c: each input's term t = (df/dx_i u_i)^2, the second-order
# part b of GUM 5.1.2's note (sum over i, j of [1/2 (d2f/dx_i dx_j)^2 + df/dx_i d3f/dx_i dx_j^2] u_i^2 u_j^2), and each
# share 100 t_i / (a + b) with a = sum t, the second order 100 b / (a + b); mpmath at 50 digits.
# Run: tests/golden/.venv/bin/python tests/golden/oracle_budget.py
from mpmath import mp, mpf, sin, diff, nstr
mp.dps = 50

def budget(f, x, u):
    n = len(x)
    d = lambda orders: diff(f, x, orders)
    t = [(d(tuple(1 if j == i else 0 for j in range(n))) * u[i])**2 for i in range(n)]
    b = mpf(0)
    for i in range(n):
        for j in range(n):
            dij = [0]*n; dij[i] += 1; dij[j] += 1
            dijj = [0]*n; dijj[i] += 1; dijj[j] += 2
            di = [0]*n; di[i] += 1
            b += (d(tuple(dij))**2 / 2 + d(tuple(di)) * d(tuple(dijj))) * u[i]**2 * u[j]**2
    D = sum(t) + b
    return t, b, [100*ti/D for ti in t], 100*b/D

for name, f, x, u in [
    ("a t10 (12.34 +- 0.05)(3.2 +- 0.1)", lambda p, q: p*q, [mpf("12.34"), mpf("3.2")], [mpf("0.05"), mpf("0.1")]),
    ("b sin(0 +- 0.2)", lambda p: sin(p), [mpf(0)], [mpf("0.2")]),
    ("c sin(0 +- 0.5)", lambda p: sin(p), [mpf(0)], [mpf("0.5")]),
]:
    t, b, s, s2 = budget(f, x, u)
    print(name, "t", [nstr(v, 12) for v in t], "b", nstr(b, 12), "shares", [nstr(v, 8) for v in s], "second", nstr(s2, 8))

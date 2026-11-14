# SPDX-License-Identifier: GPL-3.0-or-later
# vfh (verifier of fh, night review 2026-11-14): independent recomputation of fh-1 and fh-4's expected values.
# fh-1: Lagrange by solving the Vandermonde system in mpmath at 50 digits (not fh's product formula); linear by hand.
# fh-4: gauge conversions from the exact definitions (lb = 0.45359237 kg, g0 = 9.80665 m/s^2, in = 0.0254 m, atm = 101325 Pa).
#   tests/golden/.venv/bin/python -I tools/probes/review-1114/vfh-oracle.py
import mpmath as m

m.mp.dps = 50


def lagrange_vdm(xs, ys, x):
    n = len(xs)
    A = m.matrix(n, n)
    for i in range(n):
        for j in range(n):
            A[i, j] = xs[i] ** j
    c = m.lu_solve(A, m.matrix(ys))
    return sum(c[j] * x ** j for j in range(n))


xs = [m.mpf(k - 5) / 5 for k in range(11)]
ys = [m.mpf(s) for s in ["0.0385", "0.0588", "0.1", "0.2", "0.5", "1", "0.5", "0.2", "0.1", "0.0588", "0.0385"]]
x = m.mpf(9) / 10
print("runge lagrange(0.9)", m.nstr(lagrange_vdm(xs, ys, x), 15))
print("  413842411/262144000 =", m.nstr(m.mpf(413842411) / 262144000, 15))
print("  linear 0.8..1      ", m.nstr(ys[9] + (ys[10] - ys[9]) * (x - xs[9]) / (xs[10] - xs[9]), 15))
print("  1/(1+25*0.81)      ", m.nstr(1 / (1 + 25 * x ** 2), 15))
xs2 = [m.mpf(k) for k in range(6)]
ys2 = [abs(v - 2) for v in xs2]
print("kink lagrange(2.5)", m.nstr(lagrange_vdm(xs2, ys2, m.mpf("2.5")), 15), " 45/128 =", m.nstr(m.mpf(45) / 128, 15))

psi = m.mpf("0.45359237") * m.mpf("9.80665") / m.mpf("0.0254") ** 2
print("psi Pa", m.nstr(psi, 20))
print("10 bar -> psi", m.nstr(10 * 100000 / psi, 15))
print("10 barg -> psia", m.nstr((10 * 100000 + 101325) / psi, 15))
print("share of absolute", m.nstr(101325 / (10 * 100000 + m.mpf(101325)) * 100, 6), "%")

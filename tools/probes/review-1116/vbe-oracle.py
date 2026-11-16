# SPDX-License-Identifier: GPL-3.0-or-later
# Verifier of be (night review 2026-11-16): independent mpmath values for be-1..be-4.
from mpmath import mp, mpf, mpc, arg, log, log10, sqrt, acos, erfc, cosh, exp, pi, e, polyroots, nstr

mp.dps = 60
print("be-1 arg((i*pi)^2)", nstr(arg(mpc(0, pi) ** 2), 15))
print("be-1 arg(acos(5/4)^2)", nstr(arg(acos(mpf(5) / 4) ** 2), 15), "acos(5/4)=", nstr(acos(mpf(5) / 4), 15))
print("be-1 arg(i*ln(i))", nstr(arg(mpc(0, 1) * log(mpc(0, 1))), 15))
print("be-1 arg(acos(3)^2)", nstr(arg(acos(mpf(3)) ** 2), 15))

mp.dps = 1500
for name, x in [("erfc(12)", erfc(12)), ("erfc(30)", erfc(30)), ("1/cosh(1000)", 1 / cosh(1000)), ("exp(-exp(7))", exp(-exp(7)))]:
    v = (1 + x) ** (1 / x)
    print("be-2", name, "x=", nstr(x, 5), "(1+x)^(1/x)=", nstr(v, 15))
mp.dps = 60
x = erfc(20)
print("be-2 (1-cos(erfc(20)))/erfc(20)^2 via series", nstr(mpf(1) / 2 - x ** 2 / 24, 15))

mp.dps = 120
for coeffs, label in [([1, 0, -3, 2 - mpf(10) ** -80], "x^3-3x+2-1e-80"), ([1, 0, -3, -2 + mpf(10) ** -80], "x^3-3x-2+1e-80"),
                      ([1, -5, 7, -3 + mpf(10) ** -60], "x^3-5x^2+7x-3+1e-60")]:
    r = polyroots(coeffs, maxsteps=500, extraprec=2000)
    print("be-3", label, [nstr(z, 50) for z in r])

mp.dps = 50
print("be-4 ln(1/(1-sqrt2))", nstr(log(1 / (1 - sqrt(2)) + mpc(0, 0)), 15))
print("be-4 ln(1/(pi-4))", nstr(log(1 / (pi - 4) + mpc(0, 0)), 15))
print("be-4 ln(1/(1-e))", nstr(log(1 / (1 - e) + mpc(0, 0)), 15))
print("be-4 log10(1/(1-sqrt2))", nstr(log10(1 / (1 - sqrt(2)) + mpc(0, 0)), 15))
print("be-4 sqrt(1/(pi-4))", nstr(sqrt(1 / (pi - 4) + mpc(0, 0)), 15))
print("be-4 sqrt(1/(1-sqrt2))", nstr(sqrt(1 / (1 - sqrt(2)) + mpc(0, 0)), 15))
print("be-4 1/sqrt(pi-4)", nstr(1 / sqrt(pi - 4 + mpc(0, 0)), 15))

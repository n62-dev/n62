# SPDX-License-Identifier: GPL-3.0-or-later
# be hunt (night review 2026-11-16), second set: ln and log10 of 1/x for a negative real x (principal branch, mpmath).
#   tests/golden/.venv/bin/python -I oracle2.py
from mpmath import mp, mpf, mpc, log, log10, sqrt, pi, e, nstr

mp.dps = 50
for label, x in [("1/(pi-4)", 1 / (pi - 4)), ("1/(1-sqrt(2))", 1 / (1 - sqrt(2))), ("1/(1-e)", 1 / (1 - e)),
                 ("1/ln(1/2)", 1 / log(mpf(1) / 2))]:
    z = mpc(x, 0)  # a negative real, imaginary part exactly 0
    print(f"ln({label:14s}) = {nstr(log(z), 15)}    log10 = {nstr(log10(z), 15)}")
from mpmath import cbrt, power, asin, atan
for label, x in [("1/(pi-4)", 1 / (pi - 4)), ("1/(1-sqrt(2))", 1 / (1 - sqrt(2))), ("1/ln(1/2)", 1 / log(mpf(1) / 2))]:
    z = mpc(x, 0)
    print(f"sqrt({label:14s}) = {nstr(sqrt(z), 15)}    ^(1/3) = {nstr(power(z, mpf(1) / 3), 15)}")
print("1/sqrt(pi-4) =", nstr(1 / sqrt(mpc(pi - 4, 0)), 15))
print("atan(1/(sqrt(2)*i)) =", nstr(atan(1 / (sqrt(2) * mpc(0, 1))), 15))
print("asin(3/(1-sqrt(2))) =", nstr(asin(mpc(3 / (1 - sqrt(2)), 0)), 15))

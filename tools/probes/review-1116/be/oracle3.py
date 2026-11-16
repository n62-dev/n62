# SPDX-License-Identifier: GPL-3.0-or-later
# be hunt (night review 2026-11-16), third set: products and quotients of two negative reals under sqrt, ln, cube root.
#   tests/golden/.venv/bin/python -I oracle3.py
from mpmath import mp, mpc, mpf, sqrt, log, pi, e, power, nstr

mp.dps = 50
a, b, c, d = 1 - sqrt(2), 1 - sqrt(3), pi - 4, e - 3
for label, v in [("sqrt(a*b)", sqrt(mpc(a * b))), ("sqrt(c*d)", sqrt(mpc(c * d))), ("ln(a*b)", log(mpc(a * b))),
                 ("ln(c*d)", log(mpc(c * d))), ("(a*b)^(1/3)", power(mpc(a * b), mpf(1) / 3)), ("sqrt(a/b)", sqrt(mpc(a / b))),
                 ("ln(a/b)", log(mpc(a / b))), ("sqrt(a^3)", sqrt(mpc(a ** 3))), ("ln(-a)", log(mpc(-a))), ("sqrt(-c)", sqrt(mpc(-c)))]:
    print(f"{label:12s} {nstr(v, 15)}")

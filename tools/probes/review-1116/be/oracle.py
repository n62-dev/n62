# SPDX-License-Identifier: GPL-3.0-or-later
# be hunt (night review 2026-11-16): mpmath oracle values for the findings (tests/golden/.venv).
#   tests/golden/.venv/bin/python -I oracle.py
from mpmath import mp, mpf, mpc, sqrt, acosh, acos, asin, atanh, asinh, ln, log, sin, cos, tan, exp, pi, e, nstr, power

mp.dps = 60
def show(label, v, n=15):
    print(f"{label:45s} {nstr(v, n)}")

# principal square roots of z^2 for z on the imaginary axis (sqrt's cut)
for name, z in [("acosh(1/2)", acosh(mpf(1)/2)), ("acosh(-1/2)", acosh(mpf(-1)/2)), ("acos(5/4)", acos(mpf(5)/4)),
                ("acos(2)", acos(mpf(2))), ("ln(i)", log(mpc(0, 1))), ("asinh(i/2)", asinh(mpc(0, 0.5))),
                ("atanh(2)", atanh(mpf(2))), ("acosh(-2)", acosh(mpf(-2))), ("asin(2)", asin(mpf(2)))]:
    show(f"z = {name}", z)
    show(f"  sqrt(z^2)", sqrt(z * z))

# linterp near-tie: x = sqrt(2) just above the row r = 1.41421356237309504
r = mpf("1.41421356237309504")
x = sqrt(2)
show("sqrt(2) - r", x - r)
show("linterp([0,r,3],[0,0,1E30],sqrt(2))", (x - r) * mpf(10) ** 30 / (3 - r))

# G363's family: a power of a constant base near 1 with a huge exponent
s1 = sin(1)
mp.dps = 12000
show("(1-sin(1)^5000)^(sin(1)^-5000)", power(1 - s1 ** 5000, s1 ** -5000))
show("(1+tan(1)^-5000)^(tan(1)^5000)", power(1 + tan(1) ** -5000, tan(1) ** 5000))
show("(1+cos(1)^4000)^(cos(1)^-4000)", power(1 + cos(1) ** 4000, cos(1) ** -4000))
show("(1+sqrt(sin(1)^5000))^(sin(1)^-2500)", power(1 + sqrt(s1 ** 5000), s1 ** -2500))
show("(1+exp(-1000))^exp(1000)", power(1 + exp(-1000), exp(1000)))
show("(1+sin(1)^5000*pi)^(1/(pi*sin(1)^5000))", power(1 + s1 ** 5000 * pi, 1 / (pi * s1 ** 5000)))
show("1/(1-cos(sin(1)^200))", 1 / (1 - cos(s1 ** 200)))
show("(sin(1)^5000+1)-1", (s1 ** 5000 + 1) - 1)
show("sin(1)^5000", s1 ** 5000)
mp.dps = 60

# cubic and quartic near-double roots (G359, G364's family): every root, at 50 digits
from mpmath import polyroots
mp.dps = 120
for label, coeffs in [
    ("x^3-3x+2+1e-80", [1, 0, -3, 2 + mpf(10) ** -80]),
    ("x^3-3x+2-1e-80", [1, 0, -3, 2 - mpf(10) ** -80]),
    ("x^3-3x-2+1e-80", [1, 0, -3, -2 + mpf(10) ** -80]),
    ("x^3-3x+2+1e-30", [1, 0, -3, 2 + mpf(10) ** -30]),
    ("(x-1)^2(x-3)+1e-60 = x^3-5x^2+7x-3+1e-60", [1, -5, 7, -3 + mpf(10) ** -60]),
    ("x^4-2x^2+1+1e-80", [1, 0, -2, 0, 1 + mpf(10) ** -80]),
    ("x^4-2x^2+1-1e-80", [1, 0, -2, 0, 1 - mpf(10) ** -80]),
]:
    rts = polyroots(coeffs, maxsteps=500, extraprec=2000)
    print(label, [nstr(r, 15) for r in rts])

# functions of z^2 on a branch cut, z = acosh(-1/2) = 2*pi*i/3 (z^2 = -4*pi^2/9, a negative real, imaginary part exactly 0)
mp.dps = 60
from mpmath import acosh as Acosh, atanh as Atanh, cbrt, root, arg as Arg, degrees, log10 as Log10
for zname, z in [("acosh(-1/2)", 2j * pi / 3), ("acosh(1/2)", 1j * pi / 3), ("acos(5/4)", acos(mpf(5) / 4))]:
    w = (z * z).real  # exactly real: z is on the imaginary axis
    w = mpc(w, 0)
    show(f"z={zname}: z^2", w)
    show(f"  ln(z^2)", log(w))
    show(f"  log10(z^2)", Log10(w))
    show(f"  arg(z^2) rad", Arg(w))
    show(f"  arg(z^2) deg", degrees(Arg(w)))
    show(f"  sqrt(z^2)", sqrt(w))
    show(f"  (z^2)^(1/3)", power(w, mpf(1) / 3))
    show(f"  asin(z^2)", asin(w))
    show(f"  acos(z^2)", acos(w))
    show(f"  acosh(z^2)", Acosh(w))

# a tiny term no literal shows (G141/G363's family): constant expressions with no integer-literal power
from mpmath import erfc, cosh
mp.dps = 1500
show("(1+erfc(30))^(1/erfc(30))", power(1 + erfc(30), 1 / erfc(30)))
show("(1+exp(-exp(7)))^exp(exp(7))", power(1 + exp(-exp(7)), exp(exp(7))))
show("(1+1/cosh(1000))^cosh(1000)", power(1 + 1 / cosh(1000), cosh(1000)))
show("(1-cos(erfc(20)))/erfc(20)^2", (1 - cos(erfc(20))) / erfc(20) ** 2)
show("erfc(20)", erfc(20))

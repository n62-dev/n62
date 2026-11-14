# SPDX-License-Identifier: GPL-3.0-or-later
# vbe: mpmath oracle values for the be findings (source: oracle).
from mpmath import mp, mpf, sin, tanh, log, power, nstr, ceil, floor, euler
mp.dps = 3000
s1 = sin(mpf(1))
print("sin(1)^5000", nstr(s1**5000, 6))
print("(1+sin(1)^5000)^(sin(1)^-5000)", nstr(power(1 + s1**5000, s1**-5000), 15))
l2 = log(2)
print("ln2^500", nstr(l2**500, 6), "(1+ln2^500)^(ln2^-500)", nstr(power(1 + l2**500, l2**-500), 15))
print("(1+euler^5000)^(euler^-5000)", nstr(power(1 + euler**5000, euler**-5000), 15))
t50 = tanh(mpf(50)); t100 = tanh(mpf(100))
print("1/(1-tanh(50))", nstr(1 / (1 - t50), 15))
print("ln(1-tanh(50))", nstr(log(1 - t50), 15))
print("ln((tanh(100)-1)^2)", nstr(log((t100 - 1)**2), 15))
print("tanh(100)-1", nstr(t100 - 1, 15))
x = sin(mpf(10)**70) * mpf(10)**12
print("sin(10^70)*10^12", nstr(x, 20), "ceil", ceil(x), "floor", floor(x))

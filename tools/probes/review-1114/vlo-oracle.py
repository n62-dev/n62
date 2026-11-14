# SPDX-License-Identifier: GPL-3.0-or-later
# Verifier of lo-1: mpmath oracle for G*5.972e24*70/6371000^2 and twice it, with first-order sigma from G's CODATA u.
from mpmath import mp, mpf
mp.dps = 40
G = mpf('6.67430e-11'); u = mpf('0.00015e-11')
k = mpf('5.972e24') * 70 / mpf(6371000) ** 2
print('F    ', mp.nstr(G * k, 20), 'sigma', mp.nstr(u * k, 8))
print('2F   ', mp.nstr(2 * G * k, 20), 'sigma', mp.nstr(2 * u * k, 8))

# SPDX-License-Identifier: GPL-3.0-or-later
from mpmath import mp, mpf, mpc, pi, e, sin, cos, atan2, cbrt, log, exp, nstr, degrees, power, sign
mp.dps=800
a=mpf('3.1415926535897932384626433832795028841971693993751')
d=pi-a
print('pi-a',nstr(d,12), 'cbrt',nstr(cbrt(d),12))
s=sin(mpf(10)**70); c=cos(mpf(10)**70)
print('sin1e70',nstr(s,15),'cos',nstr(c,15))
print('cbrt s real', nstr(-cbrt(-s),12) if s<0 else nstr(cbrt(s),12))
print('5th', nstr(-((-s)**(mpf(1)/5)),12))
print('atan2',nstr(atan2(s,-1),12),'deg',nstr(degrees(atan2(s,-1)),12))
print('ln s^2',nstr(log(s**2),12),'log10',nstr(log(s**2)/log(10),12))
print('ln s^3',nstr(log(mpc(s**3)),12))
z=mpc(1,mpf(10)**-15)
print('z^(1/3)',nstr(z**(mpf(1)/3),15)); print('z^pi',nstr(z**pi,15))
z=mpc(1,mpf(10)**-12); print('1e-12',nstr(z**(mpf(1)/3),15))
z=mpc(1,mpf(10)**-20); print('1e-20',nstr(z**(mpf(1)/3),15))
print('pi^200 digs',nstr(log(pi**200)/log(10),8))
mp.dps=1500
print('(1+pi^-200)^(pi^200)',nstr((1+pi**-200)**(pi**200),15)); print('e',nstr((1+e**-200)**(e**200),15))

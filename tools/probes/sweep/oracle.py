# SPDX-License-Identifier: GPL-3.0-or-later
# G61: the sweep's oracle. Reads a JSON list of {"mp": <python expr from gen.ts>, "deg": bool} on stdin and prints a JSON list of
#   {"kind": "value", "re": "...", "im": "..."}  at 100 digits, when 60 and 100 digits agree to 1e-45 (else 150 and 250 digits, else skip);
#     G162: an input whose exact literals hold a power 10^±k (1ᴇ-300, 10^{300}, a typed 1.000…01) starts both rungs 2k digits higher
#     (60+2k and 100+2k, then 150+2k and 250+2k): (1-cos 10^-k)·10^(2k) cancels 2k digits, and below that every rung gives the same wrong
#     value, so the agreement test would pass it. Past DPS_CAP digits the case is skipped with its reason, never judged at fewer.
#     G307: a power of π or e with a negative integer exponent (POW(PI,mpf('-400')), exp(mpf('-400'))) counts as 10^-d, d its digit
#     count: the tiny term a rung rounds away (a huge one alone loses nothing, and exp of an int leaf such as 2^31 stays judged).
#     G363: so does the tiny b^n in 1 ± b^n of edges.ts's fourth form of family 0 (b = ln 2, ln 3, tanh 1).
#   {"kind": "matrix", "rows": r, "cols": c, "cells": [{"re", "im"}, …]}   G797: a matrix (rows flattened; cols null for linsolve's list),
#     each cell agreeing to 1e-45 of itself between the rungs, or below 10^-(hi-10) of the matrix at the higher rung (round-off of an exact 0: 0)
#   {"kind": "novalue"}   a pole, a non-finite result; G797: inv of a singular matrix, linsolve of a singular system (no unique solution)
#   {"kind": "skip", "reason": "..."}   unstable, an infinite intermediate under a finite value (G345), a convention (negative base to a non-integer power, 0^0), complex in DEG, too slow
# Run: tests/golden/.venv/bin/python -I tools/probes/sweep/oracle.py < requests.json   (mpmath 1.3.0)
import json, math, re as _re, signal, sys
from decimal import Decimal, InvalidOperation
from mpmath import matrix, inverse, det as mdet, lu_solve, expm, sinm, cosm, svd_r, svd_c, mp, mpf, mpc, sqrt, exp, sinh, cosh, tanh, asinh, acosh, atanh, cbrt, sign, log, pi, e, factorial, fabs, sin, cos, tan, asin, acos, atan, isfinite


class Skip(Exception):
    pass


class Slow(Exception):
    pass


def _alarm(*_):
    raise Slow()


DEG = False


def _real_deg(x):
    if isinstance(x, mpc):
        if x.imag != 0:
            raise Skip("complex in DEG")
        return x.real
    return x


def _wrap_in(f):
    def g(x):
        if DEG:
            x = _real_deg(x) * pi / 180
        return f(x)
    return g


def _wrap_inv(f):
    def g(x):
        r = f(x)
        if DEG:
            if isinstance(x, mpc) or isinstance(r, mpc):
                raise Skip("complex in DEG")
            r = r * 180 / pi
        return r
    return g


SIN, COS, TAN = _wrap_in(sin), _wrap_in(cos), _wrap_in(tan)
ASIN, ATAN = _wrap_inv(asin), _wrap_inv(atan)
ACOS = _wrap_inv(acos)


def LN(x):
    return log(x)


def LOG10(x):
    return log(x, 10)


def ABS(x):
    return fabs(x)


def ACOSH(x):
    return acosh(x)


def ATANH(x):
    # G116: on the cut (a real |x| > 1) mpmath takes the lower side (atanh(3) = 0.35 - 1.57i); the oracle takes the textbook
    # 1/2 ln((1+x)/(1-x)) with the principal ln, which is Giac's (+1.57i). A convention, written down in the G116 report.
    if not isinstance(x, mpc) and abs(x) > 1:
        return log((1 + x) / (1 - x)) / 2
    return atanh(x)


def CBRT(x):
    # G116: the cube root key is Giac's surd(x,3), the real root of a negative real (realOddRoots); of a complex it is a convention
    if isinstance(x, mpc):
        if x.imag != 0:
            raise Skip("cube root of a complex")
        x = x.real
    return sign(x) * cbrt(fabs(x))


def DIV(a, b):
    return a / b


def FACT(n):
    return factorial(mpf(n))


def POW(a, b):
    if isinstance(b, mpc) is False and isinstance(a, mpc) is False:
        if a < 0 and b != int(b):
            raise Skip("negative base to a non-integer power")
        if a == 0 and b == 0:
            raise Skip("0^0")
        if a == 0 and b < 0:
            raise ZeroDivisionError
    return a ** b


def _cut(lo_on_cut):
    """G116: a function with a branch cut on the real axis. An argument on the cut whose imaginary part is only working-precision noise
    (at most 10^-(dps-10) of |x|) has no decidable side: cosh(ln(-1/2)) is -5/4 in exact maths, but mpmath carries an imaginary part of
    about 1E-100 whose sign then picks a side of acos. The oracle skips such an input rather than guess."""
    def wrap(f):
        def g(*a):
            x = a[0]
            if isinstance(x, mpc) and x.imag == 0:  # a signed zero (cos of a pure imaginary gives -0.0) must not pick the lower side
                x = x.real
                a = (x, *a[1:])
            if isinstance(x, mpc) and x.imag != 0 and abs(x.imag) <= abs(x) * mpf(10) ** (10 - mp.dps) and lo_on_cut(x.real):
                raise Skip("on a branch cut within the noise")
            return f(*a)
        return g
    return wrap


NS = dict(mpf=mpf, sqrt=sqrt, exp=exp, sinh=sinh, cosh=cosh, tanh=tanh, asinh=asinh, SIN=SIN, COS=COS, TAN=TAN, ASIN=ASIN, ACOS=ACOS,
          ATAN=ATAN, ACOSH=ACOSH, ATANH=ATANH, CBRT=CBRT, LN=LN, LOG10=LOG10, ABS=ABS, DIV=DIV, FACT=FACT, POW=POW)
for _k, _on in (("sqrt", lambda r: r < 0), ("LN", lambda r: r < 0), ("LOG10", lambda r: r < 0), ("POW", lambda r: r < 0),
                ("ASIN", lambda r: abs(r) > 1), ("ACOS", lambda r: abs(r) > 1), ("ATANH", lambda r: abs(r) > 1), ("ACOSH", lambda r: r < 1)):
    NS[_k] = _cut(_on)(NS[_k])


# G345: a function of the namespace whose result is infinite or nan sets this flag. A finite final value built on such a step (mpmath's
# tanh(10^50) is exactly 1, so atanh is infinite and x/inf is 0) is no value, the true one lies past what a rung shows: a skip. A final
# value that is itself non-finite stays a pole (novalue), as before.
INF_STEP = [False]


def _finite_or_flag(f):
    def g(*a):
        r = f(*a)
        if isinstance(r, (mpf, mpc)) and not isfinite(r):
            INF_STEP[0] = True
        return r
    return g


for _k in [k for k, v in NS.items() if callable(v) and k != "mpf"]:
    NS[_k] = _finite_or_flag(NS[_k])


# G797: the matrix nodes of gen.ts. Rank by SVD at the rung's digits: a singular value below 10^-(dps-15) of the largest is round-off of
# an exact 0 (the rungs must agree on the rank, as on a value). det of a matrix of lower rank is 0; inv and linsolve of one have no value.
class Vec(list):
    """linsolve's answer, a list (Giac shows a list, not a column)."""


def MAT(rows):
    return matrix(rows)


def APPROX(a):
    return a


def MADD(a, b):
    return a + b


def MMUL(a, b):
    return a * b


def SMUL(s, a):
    return a * s


def MDIV(a, s):
    return a * (1 / s)


def MSQ(a):
    return a * a


def TRN(a):
    return a.T


def _deg(a):
    return a * (pi / 180) if DEG else a


def EXPM(a):
    return expm(a)


def SINM(a):
    return sinm(_deg(a))


def COSM(a):
    return cosm(_deg(a))


def RANK(a):
    cplx = any(isinstance(a[i, j], mpc) for i in range(a.rows) for j in range(a.cols))
    sv = svd_c(a, compute_uv=False) if cplx else svd_r(a, compute_uv=False)
    top = max(fabs(x) for x in sv)
    if top == 0:
        return mpf(0)
    return mpf(sum(1 for x in sv if fabs(x) > top * mpf(10) ** (15 - mp.dps)))


def DET(a):
    return mpf(0) if RANK(a) < a.rows else mdet(a)


def INV(a):
    if RANK(a) < a.rows:
        raise ZeroDivisionError
    return inverse(a)


def LINSOLVE(a, b):
    if RANK(a) < a.rows:
        raise ZeroDivisionError
    x = lu_solve(a, b)
    return Vec(x[i, 0] for i in range(x.rows))


NS.update(MAT=MAT, APPROX=APPROX, MADD=MADD, MMUL=MMUL, SMUL=SMUL, MDIV=MDIV, MSQ=MSQ, TRN=TRN, EXPM=EXPM, SINM=SINM, COSM=COSM, RANK=RANK,
          DET=DET, INV=INV, LINSOLVE=LINSOLVE)


def _parts(v):
    if isinstance(v, mpc):
        re, im = v.real, v.imag
    else:
        re, im = mpf(v), mpf(0)
    if not (isfinite(re) and isfinite(im)):
        raise ZeroDivisionError
    if DEG and im != 0:
        raise Skip("complex in DEG")
    return re, im


def at_cells(expr, dps):
    """G797: a matrix or list value as (rows, cols or None, [(re, im), …]); a scalar as (None, None, [(re, im)])."""
    mp.dps = dps
    INF_STEP[0] = False
    ns = dict(NS, PI=+pi, E=+e)
    v = eval(expr, {"__builtins__": {}}, ns)
    if isinstance(v, Vec):
        shape, vals = (len(v), None), list(v)
    elif isinstance(v, matrix):
        shape, vals = (v.rows, v.cols), [v[i, j] for i in range(v.rows) for j in range(v.cols)]
    else:
        shape, vals = (None, None), [v]
    cells = [_parts(x) for x in vals]
    if INF_STEP[0]:
        raise Skip("an infinite intermediate")
    return shape[0], shape[1], cells


def agree_cells(a, b, hi):
    """G797: the cells of the higher rung when every part agrees with itself to 1e-45, or is below 10^-(hi-10) of the matrix at the
    higher rung (round-off of an exact 0, which then reads 0); None when a part is unstable."""
    scale = max([abs(x) for c in a + b for x in c] + [mpf(0)])
    if scale == 0:
        return b
    noise = scale * mpf(10) ** (10 - hi)
    out = []
    for ca, cb in zip(a, b):
        parts = []
        for x, y in zip(ca, cb):
            if abs(x - y) <= max(abs(x), abs(y)) * mpf(10) ** -45:
                parts.append(y)
            elif abs(y) <= noise:
                parts.append(mpf(0))
            else:
                return None
        out.append(tuple(parts))
    return out


_NOVALUE = (ZeroDivisionError, ValueError)


def rungs(f, expr, lo, hi):
    """G797: the value at both rungs of a pair, or None for a rung with no value (a division by zero, a singular matrix). Raises
    ZeroDivisionError (main's novalue) only when both rungs have none: a rank or a cancellation that only the lower rung loses (a
    matrix with a condition number past 10^(lo-15), as [[1,1],[1,tanh 60]] at 60 digits) has a value, and the next pair decides."""
    out = []
    for dps in (lo, hi):
        try:
            out.append(f(expr, dps))
        except _NOVALUE:
            out.append(None)
    if out[0] is None and out[1] is None:
        raise ZeroDivisionError
    return out


def _unstable(up):
    return {"kind": "skip", "reason": f"unstable at {60 + up}/{100 + up} and {150 + up}/{250 + up} digits (or a value at one rung only)"}


def one_matrix(expr, up):
    for lo, hi in ((60 + up, 100 + up), (150 + up, 250 + up)):
        pa, pb = rungs(at_cells, expr, lo, hi)
        if pa is None or pb is None:
            continue
        (ra, ca, a), (rb, cb, b) = pa, pb
        if (ra, ca) != (rb, cb):
            continue
        got = agree_cells(a, b, hi)
        if got is not None:
            mp.dps = hi
            return {"kind": "matrix", "rows": rb, "cols": cb, "cells": [{"re": mp.nstr(c[0], 100), "im": mp.nstr(c[1], 100)} for c in got]}
    return _unstable(up)


_MATRIX_TOP = _re.compile(r"^(MAT|APPROX|MADD|MMUL|SMUL|MDIV|MSQ|TRN|INV|EXPM|SINM|COSM|DET|RANK|LINSOLVE)\(")


def at(expr, dps):
    mp.dps = dps
    INF_STEP[0] = False
    ns = dict(NS, PI=+pi, E=+e)
    v = eval(expr, {"__builtins__": {}}, ns)
    if isinstance(v, mpc):
        re, im = v.real, v.imag
    else:
        re, im = mpf(v), mpf(0)
    if not (isfinite(re) and isfinite(im)):
        raise ZeroDivisionError
    if INF_STEP[0]:
        raise Skip("an infinite intermediate")
    if DEG and im != 0:
        raise Skip("complex in DEG")
    return re, im


def agree(a, b):
    scale = max(abs(a[0]), abs(a[1]), abs(b[0]), abs(b[1]))
    if scale == 0:
        return True
    tol = scale * mpf(10) ** -45
    return abs(a[0] - b[0]) <= tol and abs(a[1] - b[1]) <= tol


# G162: the highest rung (250+2k) a case may need; k up to 1000 (the edge generator's 1ᴇ±1000) stays under the 3 s limit per case
DPS_CAP = 2250
_POW10 = _re.compile(r"POW\(mpf\('10'\),mpf\('(-?\d+)'\)\)")
_LIT = _re.compile(r"mpf\('([^']*)'\)")
_POWC = _re.compile(r"(POW\(PI,|exp\()mpf\('-(\d+)'\)\)")
_LOG10 = {"POW(PI,": math.log10(math.pi), "exp(": math.log10(math.e)}
# G363: edges.ts's fourth form of family 0, 1 ± b^n with b = ln 2, ln 3 or tanh 1: the power next to the 1 is the tiny term
_ONEPOW = _re.compile(r"\(mpf\('1'\)\)[+-]\(POW\((LN\(mpf\('2'\)\)|LN\(mpf\('3'\)\)|tanh\(mpf\('1'\)\)),mpf\('(-?\d+)'\)\)\)")
_LOG10B = {"LN(mpf('2'))": math.log10(math.log(2)), "LN(mpf('3'))": math.log10(math.log(3)), "tanh(mpf('1'))": math.log10(math.tanh(1))}


def tens(expr):
    """G162: the largest k such that an exact literal of the input holds 10^±k: 10^{k} typed as a power, the exponent of 1ᴇ-k, or the
    first and last digit of a typed decimal (1.000…01 holds 10^-k, 100…001 holds 10^k); G307: π^-n and e^-n with an integer n hold
    10^-k for k their digit count, ceil(n·log10 π) and ceil(n·log10 e); G363: so does 1 ± b^n for edges.ts's constant bases b,
    k = ceil(|n·log10 b|) when b^n is below 1."""
    k = 0
    for m in _ONEPOW.finditer(expr):
        d = int(m.group(2)) * _LOG10B[m.group(1)]
        if d < 0:
            k = max(k, math.ceil(-d))
    for m in _POWC.finditer(expr):
        k = max(k, math.ceil(abs(int(m.group(2))) * _LOG10[m.group(1)]))
    for m in _POW10.finditer(expr):
        k = max(k, abs(int(m.group(1))))
    for m in _LIT.finditer(expr):
        try:
            t = Decimal(m.group(1)).as_tuple()
        except InvalidOperation:
            continue
        if not isinstance(t.exponent, int):
            continue
        k = max(k, abs(t.exponent), abs(t.exponent + len(t.digits) - 1))
    return k


def one(expr):
    up = 2 * tens(expr)
    if 250 + up > DPS_CAP:
        return {"kind": "skip", "reason": f"needs {250 + up} digits (10^±{up // 2}), past the oracle's cap of {DPS_CAP}"}
    if _MATRIX_TOP.match(expr) and not expr.startswith(("DET(", "RANK(")):
        return one_matrix(expr, up)
    for lo, hi in ((60 + up, 100 + up), (150 + up, 250 + up)):
        a, b = rungs(at, expr, lo, hi)
        if a is not None and b is not None and agree(a, b):
            mp.dps = hi
            return {"kind": "value", "re": mp.nstr(b[0], 100), "im": mp.nstr(b[1], 100)}
    return _unstable(up)


def main():
    global DEG
    out = []
    signal.signal(signal.SIGALRM, _alarm)
    for q in json.load(sys.stdin):
        DEG = bool(q.get("deg"))
        signal.setitimer(signal.ITIMER_REAL, 3.0)
        try:
            out.append(one(q["mp"]))
        except Skip as s:
            out.append({"kind": "skip", "reason": str(s)})
        except (ZeroDivisionError, ValueError):
            out.append({"kind": "novalue"})
        except Slow:
            out.append({"kind": "skip", "reason": "oracle too slow (3 s)"})
        except (OverflowError, MemoryError, RecursionError):  # G307: mpmath recurses on exp(1ᴇ300 - …) at 1000 digits, an overflow
            out.append({"kind": "skip", "reason": "oracle overflow"})
        except Exception as x:  # G116: an edge input mpmath cannot take (NoConvergence, …) is a skip, never the end of the run
            out.append({"kind": "skip", "reason": f"oracle error: {type(x).__name__}"})
        finally:
            signal.setitimer(signal.ITIMER_REAL, 0)
    json.dump(out, sys.stdout)


main()

# SPDX-License-Identifier: GPL-3.0-or-later
"""S20: the oracle side of tools/probes/mpfi.ts. Reads JSON lines on stdin, one per case:
  {"id", "oracle" (an oracle.py expression), "P" (decimal digits), "P0" (max(40, digits+10)), "re": [lo, hi] | null,
   "im": [lo, hi] | null}
where lo and hi are the bounds Giac printed for an MPFI interval (decimal text). Writes one JSON line per case:
  {"id", "value": the oracle value to 40 digits, "contains": "yes" | "no" | "n/a", "digits": n | null}
Each bound is first moved outward by one unit of its last printed digit: Giac prints the binary bound rounded to
decimal (gen.cc real_object::print), so the printed text may sit up to half a unit inside the true bound.
contains: "yes" when lo <= v <= hi (widened); "no" otherwise (a Giac bug, or a form that is not the value).
digits: the largest n (at most 60) for which the widened lo and hi round alike to n significant digits, half away from
zero, the agreement rule of docs/04 2.4; the smaller of the two parts for a complex value (a part whose interval holds
0 and is 10^(P0-5) times smaller than the other, P0 the unraised working precision, is zero and not counted).
Run by mpfi.ts with tests/golden/.venv/bin/python -I; values come from tests/golden/oracle.py (source: oracle)."""
import json
import sys
import decimal
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tests/golden"))
import oracle  # noqa: E402

# Bounds of 1200 digits and exponents past 10^±999999 (exp(-10^30)): one wide context for everything here.
decimal.setcontext(decimal.Context(prec=4000, Emax=decimal.MAX_EMAX, Emin=decimal.MIN_EMIN, rounding=ROUND_HALF_UP))
from mpmath import mp  # noqa: E402


def _at_least(f):
    """oracle.py's D200 at 1200 digits or more (tan(10^1000) needs its argument to 1000 digits; an interval raised to
    2500 digits is judged at its own precision + 40)."""
    with mp.workdps(max(1200, mp.dps)):
        return f()


oracle.at200 = _at_least


def dec(t: str) -> Decimal:
    return Decimal(t.replace("E", "e"))


def last_unit(t: str) -> Decimal:
    """One unit of the last digit printed in t (mantissa digits only)."""
    d = dec(t)
    return Decimal(1).scaleb(d.as_tuple().exponent)


def round_sig(d: Decimal, n: int) -> Decimal:
    if d == 0:
        return d
    e = d.adjusted() - n + 1
    return d.scaleb(-e).quantize(Decimal(1), rounding=ROUND_HALF_UP).scaleb(e)


def agree(lo: Decimal, hi: Decimal) -> int:
    if not (lo.is_finite() and hi.is_finite()):
        return 0
    n = 0
    for k in range(1, 61):
        if round_sig(lo, k) != round_sig(hi, k):
            break
        n = k
    return n


def to_dec(x) -> Decimal:
    return Decimal(mp.nstr(x, mp.dps, min_fixed=1, max_fixed=0).replace("e", "E")) if x != 0 else Decimal(0)


def widened(b):
    lo, hi = dec(b[0]), dec(b[1])
    if lo.is_finite():
        lo -= last_unit(b[0])
    if hi.is_finite():
        hi += last_unit(b[1])
    return lo, hi


def part_contains(v, b):
    lo, hi = widened(b)
    return "yes" if lo <= v <= hi else "no"


def judge(rec):
    out = {"id": rec["id"], "value": None, "contains": "n/a", "digits": None}
    try:
        v = oracle.raw(rec["oracle"], int(rec["P"]) + 40)
    except Exception as e:  # an oracle expression the namespace cannot take: say so, never guess
        out["error"] = f"oracle: {type(e).__name__}: {e}"[:160]
        return out
    try:
        vc = mp.mpc(oracle.M(v))
    except Exception as e:
        out["error"] = f"oracle value not a number: {type(e).__name__}"[:160]
        return out
    out["value"] = mp.nstr(vc.real if vc.imag == 0 else vc, 40)
    if rec.get("re") is None:
        return out
    re_v, im_v = to_dec(vc.real), to_dec(vc.imag)
    parts = [(re_v, rec["re"]), (im_v, rec.get("im") or ["0", "0"])]
    verdicts = [part_contains(x, b) if not (x == 0 and dec(b[0]) == 0 and dec(b[1]) == 0) else "yes" for x, b in parts]
    out["contains"] = "no" if "no" in verdicts else "yes"
    # A part whose interval holds 0 and is below 10^-(P0-5) of the other part's size counts as zero (P0 = max(40, digits
    # + 10), the working precision before any raise), as markOf skips a
    # zero part (format.ts isZero): acosh(1/2) = i*pi/3 has a real interval around 0, not a real part to confirm.
    mags = [max(abs(x) for x in widened(b)) for _, b in parts]
    def zero(k):
        if dec(parts[k][1][0]) == 0 and dec(parts[k][1][1]) == 0:
            return True
        lo, hi = widened(parts[k][1])
        other = mags[1 - k]
        return lo <= 0 <= hi and (mags[k] == 0 or (other.is_finite() and other > 0 and mags[k] < other * Decimal(10) ** (5 - int(rec.get("P0", rec["P"])))))
    ns = [agree(*widened(b)) for k, (_, b) in enumerate(parts) if not zero(k)]
    out["digits"] = min(ns) if ns else 60
    return out


for line in sys.stdin:
    line = line.strip()
    if line:
        print(json.dumps(judge(json.loads(line))), flush=True)

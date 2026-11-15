# SPDX-License-Identifier: GPL-3.0-or-later
"""S20: the oracle side of tools/probes/mpfi.ts. Reads JSON lines on stdin, one per case:
  {"id", "oracle" (an oracle.py expression), "P" (decimal digits), "re": [lo, hi] | null, "im": [lo, hi] | null}
where lo and hi are the bounds Giac printed for an MPFI interval (decimal text). Writes one JSON line per case:
  {"id", "value": the oracle value to 40 digits, "contains": "yes" | "edge" | "no" | "n/a", "digits": n | null}
contains: "yes" when lo <= v <= hi; "edge" when v is outside by less than one unit of the bound's last printed digit
(the bound is a binary number printed in decimal, so its text may be off by that much); "no" otherwise (a Giac bug).
digits: the largest n (at most 60) for which lo and hi round alike to n significant digits, half away from zero, the
agreement rule of docs/04 2.4; the smaller of the two parts for a complex value (an all-zero part is not counted).
Run by mpfi.ts with tests/golden/.venv/bin/python -I; values come from tests/golden/oracle.py (source: oracle)."""
import json
import sys
from decimal import Decimal, ROUND_HALF_UP, ROUND_FLOOR, ROUND_CEILING, localcontext
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tests/golden"))
import oracle  # noqa: E402
from mpmath import mp  # noqa: E402


def _at_least(f):
    """oracle.py's D200 at 200 digits or more: an interval raised to 1200 digits is judged at its own precision + 40."""
    with mp.workdps(max(200, mp.dps)):
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
    with localcontext() as c:
        c.prec = 4000
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


def part_contains(v, b):
    lo, hi = dec(b[0]), dec(b[1])
    if not (lo.is_finite() and hi.is_finite()):
        return "yes" if lo <= v <= hi else "no"
    with localcontext() as c:
        c.prec = 4000
        if lo <= v <= hi:
            return "yes"
        if lo - last_unit(b[0]) <= v <= hi + last_unit(b[1]):
            return "edge"
        return "no"


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
    verdicts = [part_contains(x, b) for x, b in parts]
    out["contains"] = "no" if "no" in verdicts else ("edge" if "edge" in verdicts else "yes")
    ns = [agree(dec(b[0]), dec(b[1])) for _, b in parts if not (dec(b[0]) == 0 and dec(b[1]) == 0)]
    out["digits"] = min(ns) if ns else 60
    return out


for line in sys.stdin:
    line = line.strip()
    if line:
        print(json.dumps(judge(json.loads(line))), flush=True)

# SPDX-License-Identifier: GPL-3.0-or-later
# Probe (sandra, 2026-11-16, for G518's owner questions 8 and 9): the worst case of a formula over its inputs' typed ±,
# seven cases. For each: the true range (derived: corners where the formula is monotone in each input, plus the
# turning point's value where one lies inside, both at 50 digits), a dense float grid as a cross-check (inner bound),
# the naive interval (natural interval extension, mpmath.iv standing in for MPFI), the corners alone (the classic
# "vertex" method, which misses a turning point), value ± k·σ (first order, GUM 5.1.2), and the proposed method:
# prove each input's direction with the interval of ∂f/∂xᵢ over the box, evaluate the two proven corners exactly,
# bisect an input whose direction is not proven, and past a budget keep the leftover boxes' interval enclosure, so the
# answer is an outer bound [lo_out, hi_out] and an inner bound [lo_in, hi_in] (values reached), equal when exact.
#   tests/golden/.venv/bin/python -I tools/probes/worst-case.py      (0.1 s; G518's method and test values)
from itertools import product
from mpmath import mp, iv, mpf

mp.dps = 50
iv.dps = 50


class Case:
    def __init__(self, name, f, grads, nominal, u, exact_note, extra_points=()):
        self.name, self.f, self.grads, self.nominal, self.u = name, f, grads, nominal, u
        self.exact_note, self.extra = exact_note, extra_points


def deg(ctx, x):
    return x * ctx.pi / 180


CASES = [
    Case("area 12.34±0.05 m · 3.2±0.1 m (G518 row 1)",
         lambda c, a, b: a * b, [lambda c, a, b: b, lambda c, a, b: a],
         ["12.34", "3.2"], ["0.05", "0.1"], "monotone: corners"),
    Case("divider 10 V·R2/(R1+R2), R1=R2=10 kΩ ± 100 Ω, R2 one input used twice (a chip)",
         lambda c, r1, r2: 10 * r2 / (r1 + r2),
         [lambda c, r1, r2: -10 * r2 / (r1 + r2) ** 2, lambda c, r1, r2: 10 * r1 / (r1 + r2) ** 2],
         ["10000", "10000"], ["100", "100"], "monotone: corners"),
    Case("divider typed with three ± (three independent resistors, as the unit view reads it today)",
         lambda c, r1, r2, r3: 10 * r2 / (r1 + r3),
         [lambda c, r1, r2, r3: -10 * r2 / (r1 + r3) ** 2, lambda c, r1, r2, r3: 10 / (r1 + r3),
          lambda c, r1, r2, r3: -10 * r2 / (r1 + r3) ** 2],
         ["10000", "10000", "10000"], ["100", "100", "100"], "monotone: corners"),
    Case("R·I/(R+r), R=100±1 Ω, r=10±0.5 Ω, I=1±0.01 A (R used twice)",
         lambda c, R, r, I: R * I / (R + r),
         [lambda c, R, r, I: I * r / (R + r) ** 2, lambda c, R, r, I: -R * I / (R + r) ** 2,
          lambda c, R, r, I: R / (R + r)],
         ["100", "10", "1"], ["1", "0.5", "0.01"], "monotone: corners"),
    Case("cos θ, θ = 80° ± 15°",
         lambda c, t: c.cos(deg(c, t)), [lambda c, t: -c.sin(deg(c, t)) * c.pi / 180],
         ["80"], ["15"], "monotone on [65°, 95°]: corners"),
    Case("cos θ, θ = 0° ± 10° (turning point inside, input used once)",
         lambda c, t: c.cos(deg(c, t)), [lambda c, t: -c.sin(deg(c, t)) * c.pi / 180],
         ["0"], ["10"], "turning point θ=0: max 1", extra_points=[["0"]]),
    Case("load power V²·R/(R+r)², V=10 V, r=47 Ω exact, R=50±10 Ω (R twice, turning point R=47)",
         lambda c, R: 100 * R / (R + 47) ** 2, [lambda c, R: 100 * (47 - R) / (R + 47) ** 3],
         ["50"], ["10"], "turning point R=r: max V²/(4r)", extra_points=[["47"]]),
]


def box_of(case):
    return [(mpf(x) - mpf(u), mpf(x) + mpf(u)) for x, u in zip(case.nominal, case.u)]


def true_range(case):
    """Derived: f at every corner and at the turning point given by hand (exact_note); 50 digits."""
    pts = [list(p) for p in product(*box_of(case))] + [[mpf(v) for v in e] for e in case.extra]
    vals = [case.f(mp, *p) for p in pts]
    return min(vals), max(vals)


def grid_range(case, n=60):
    """A dense float grid: values reached, so an inner bound; a cross-check of true_range."""
    b = box_of(case)
    axes = [[float(lo) + (float(hi) - float(lo)) * k / n for k in range(n + 1)] for lo, hi in b]
    fl =lambda *p: float(case.f(mp, *[mpf(x) for x in p]))
    mp.dps = 20
    vals = [fl(*p) for p in product(*axes)] if len(b) <= 2 else [fl(*p) for p in product(*[a[::6] for a in axes])]
    mp.dps = 50
    return min(vals), max(vals)


def naive(case, b=None):
    b = b or box_of(case)
    r = case.f(iv, *[iv.mpf([lo, hi]) for lo, hi in b])
    return mpf(r.a), mpf(r.b)


def corners_only(case):
    vals = [case.f(mp, *p) for p in product(*box_of(case))]
    return min(vals), max(vals)


def k_sigma(case, k):
    x = [mpf(v) for v in case.nominal]
    s = mp.sqrt(sum((g(mp, *x) * mpf(u)) ** 2 for g, u in zip(case.grads, case.u)))
    y = case.f(mp, *x)
    return y - k * s, y + k * s, s


def proposed(case, budget=64):
    """Prove each input's direction over a box (interval of ∂f/∂xᵢ ≥ 0 or ≤ 0), take the two corners exactly; else
    bisect the unproven input; past `budget` boxes keep the box's interval enclosure (outer) and its midpoint (inner)."""
    stack, done = [box_of(case)], 0
    lo_out = lo_in = mpf("inf")
    hi_out = hi_in = mpf("-inf")
    exact = True
    while stack:
        b = stack.pop()
        done += 1
        ivb = [iv.mpf([lo, hi]) for lo, hi in b]
        signs = []
        for g in case.grads:
            d = g(iv, *ivb)
            signs.append(1 if d.a >= 0 else -1 if d.b <= 0 else 0)
        if all(signs):
            low = [lo if s > 0 else hi for (lo, hi), s in zip(b, signs)]
            high = [hi if s > 0 else lo for (lo, hi), s in zip(b, signs)]
            vlo, vhi = case.f(mp, *low), case.f(mp, *high)
            lo_out, lo_in, hi_out, hi_in = min(lo_out, vlo), min(lo_in, vlo), max(hi_out, vhi), max(hi_in, vhi)
            continue
        if done + len(stack) >= budget:
            exact = False
            a, z = naive(case, b)
            mid = case.f(mp, *[(lo + hi) / 2 for lo, hi in b])
            lo_out, hi_out = min(lo_out, a), max(hi_out, z)
            lo_in, hi_in = min(lo_in, mid), max(hi_in, mid)
            continue
        i = max((k for k, s in enumerate(signs) if s == 0), key=lambda k: b[k][1] - b[k][0])
        lo, hi = b[i]
        m = (lo + hi) / 2
        stack += [b[:i] + [(lo, m)] + b[i + 1:], b[:i] + [(m, hi)] + b[i + 1:]]
    return (lo_out, hi_out), (lo_in, hi_in), exact, done


def proven_digits(out, inn):
    """Significant digits on which the outer and inner end agree (the true end lies between them)."""
    if out == inn:
        return "all (exact)"
    w = abs(out - inn)
    scale = max(abs(out), abs(inn))
    return f"{int(mp.floor(-mp.log10(w / scale)))} (gap {mp.nstr(w, 3)})" if scale else "?"


def s(x, n=12):
    return mp.nstr(x, n)


for c in CASES:
    print(f"\n== {c.name}")
    t = true_range(c)
    g = grid_range(c)
    print(f"  true range ({c.exact_note}):  {s(t[0])} … {s(t[1])}   width {s(t[1] - t[0], 6)}")
    print(f"  dense grid (inner check):   {g[0]:.12g} … {g[1]:.12g}")
    n = naive(c)
    print(f"  naive interval (outer):     {s(n[0])} … {s(n[1])}   width {s(n[1] - n[0], 6)} = {s((n[1] - n[0]) / (t[1] - t[0]), 4)}× true")
    co = corners_only(c)
    miss = "" if co[0] <= t[0] and co[1] >= t[1] else "   MISSES the true range"
    print(f"  corners only:               {s(co[0])} … {s(co[1])}{miss}")
    for k in (1, 2, 3):
        a, z, sg = k_sigma(c, k)
        print(f"  value ± {k}σ (σ={s(sg, 4)}):     {s(a)} … {s(z)}   width {s(z - a, 6)} = {s((z - a) / (t[1] - t[0]), 4)}× true")
    for budget in (8, 64):
        (lo, hi), (li, hin), ex, nb = proposed(c, budget)
        print(f"  proposed, budget {budget:>2}:       outer {s(lo)} … {s(hi)}  inner {s(li)} … {s(hin)}  "
              f"exact={ex} boxes={nb}  digits lo {proven_digits(lo, li)}, hi {proven_digits(hi, hin)}")

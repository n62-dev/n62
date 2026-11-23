# SPDX-License-Identifier: GPL-3.0-or-later
# G551: the expected values of bitand, bitor and bitxor on all pairs of 24 integers from 0 to +-2^100 (T2 bug hunt
# 2026-11-16, probes/bases/bitoracle.py), from Python's int, whose &, | and ^ read two's complement, unbounded.
# export.mjs writes them as patch 0062's sweep lines in n62-patched.cas.
#   python3 tools/giac-regress/bits-table.py      # writes tools/giac-regress/bits-table.json
import json
import operator
from pathlib import Path

VALUES = [0, 1, 5, -1, -2, -5, 2**31 - 1, 2**31, -(2**31), 2**32, 2**32 - 1, -(2**32), 2**40, -(2**40), 2**63, 2**64 - 1,
          -(2**63), 2**64, 2**70, -(2**70), 2**70 + 5, -(2**70) - 5, 2**100 + 3, -(2**100) - 7]
OPS = {"bitand": operator.and_, "bitor": operator.or_, "bitxor": operator.xor}

table = {"values": [str(v) for v in VALUES]}
for name, f in OPS.items():
    table[name] = [str(f(a, b)) for a in VALUES for b in VALUES]  # row a, column b
Path(__file__).with_name("bits-table.json").write_text(json.dumps(table, separators=(",", ":")) + "\n")

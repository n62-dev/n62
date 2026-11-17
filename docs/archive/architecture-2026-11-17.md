<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# docs/04's finished detail, 2026-11-17 (archived to make room)

Moved here as it stood when docs/04 reached its 70 kB budget, before the fix lane's layout rows (R720, R722 to R725) edit it. History only: what binds is in [../04-architecture.md](../04-architecture.md).

## 1. Section 8.1, the component diagram (milestone 5)

```
Capacitor shell (Android) / PWA (service worker precaches everything after the engine is up)
└─ Main thread (TypeScript)
   ├─ Keypad + key layers (spec/keyboard.yaml)       ─┐
   ├─ Entry line: MathLive + macros (\const \res \ans) │ key → action
   │                                                   │
   ├─ Parser P1 (LaTeX → Giac text | unit tokens)     ─┤
   ├─ Formatter + marks (format.ts, pure)              │
   ├─ Views: Home, CAS, Function, Solve,               │
   │  Units (m5), Find palette (lazy), Matrix editor   │
   ├─ Find: index (lazy asset) + ranking (rank.ts)     │
   ├─ Clipboard / share port                           │
   └─ Session state ── Kv (IndexedDB: settings, history, defs, units.*)
        │ Calc port (views)
        ▼
   Worker 1: Giac + GSL + GMP + MPFR
   (launch; Home, CAS, Solve, analysis, table, units (m5); defs replay)
Build: build.sh → engines (container) → Find index generator (Node: Giac's help, qalc's XML, `find/factors.yaml`) → Vite (size test) → Capacitor → Gradle
```

## 2. Section 3.3, the index generator's first two sources
1. Giac `doc/aide_cas` from the pinned tarball: names, the English line (`2 …`) only, never French (R5), syntax (its examples are not shown: tier 0's are ours, G231); entries starting with `_` dropped.
2. libqalculate 5.13.1 `units.xml.in`, `variables.xml.in`, `prefixes.xml.in` from the pinned tarball; `currencies.xml.in`, `elements`, `planets`, `datasets` skipped.

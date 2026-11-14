# Who holds the rights an App Store build would need (S51)

**Status: reference.** Behind `docs/must-have.md` item 7 (iOS v1: the web app). Nothing went out; no author was asked.

**Recommendation:** keep iOS on the web app. An exception from Giac's authors alone covers part of the engine: GSL has many holders, the Find index carries libqalculate's names. Check: `node tools/probes/ios-rights-rows.ts` (a row per shipped row of `THIRD_PARTY.md`).

## The shipped parts

Licences and holders from `THIRD_PARTY.md` unless marked. "One holder?": could one holder grant the exception; MIT, Apache-2.0 and OFL-1.1 need none (opinion).

| Part | Licence | Holders | One holder? |
|---|---|---|---|
| Giac | GPL-3.0-or-later | B. Parisse, R. De Graeve and, for parts our build compiles, L. Marohnic and GiNaC's authors (list below) | No. Our `engine/giac/patches/` are the owner's (`git log --format=%an -- engine/giac/patches/`): he can grant that part himself |
| GMP | LGPL-3.0-or-later OR GPL-2.0-or-later | Free Software Foundation | Yes, the FSF |
| MPFR | LGPL-3.0-or-later | Free Software Foundation | Yes, the FSF |
| GSL | GPL-3.0-or-later | the GSL authors (Jungman, Gough, Galassi, Theiler and others) | No: many (to verify, sandra: no FSF assignment, file headers) |
| Emscripten runtime (in the engine) | MIT (its MIT side) | Emscripten authors | none needed |
| libqalculate (data in the Find index) | GPL-2.0-or-later | H. Knutsson and the Qalculate! contributors | No: many; names and titles only |
| Giac `doc/aide_cas`, English lines | GPL-3.0-or-later | R. De Graeve, B. Parisse (R5) | Two |
| `find/*.yaml`, N62's own code | GPL-3.0-or-later | the owner (every commit's author, `git log --format=%an`) | Yes |
| MathLive | MIT | A. Gourdol | none needed |
| Svelte | MIT | contributors | none needed |
| Vite | MIT | VoidZero Inc., contributors | none needed |
| @capacitor/core | MIT | Drifty Co. | none needed |
| @capacitor/android | MIT | Drifty Co. | Android |
| @capacitor/clipboard | MIT | Ionic | none needed |
| @capacitor/share | MIT | Ionic | none needed |
| KaTeX fonts | OFL-1.1 | Design Science, Khan Academy | none needed |
| JSXGraph | MIT OR LGPL-3.0-or-later | M. Ehmann and others | none (MIT side) |
| AndroidX appcompat | Apache-2.0 | AOSP | Android |
| AndroidX coordinatorlayout | Apache-2.0 | AOSP | Android |
| AndroidX core-splashscreen | Apache-2.0 | AOSP | Android |
| Apache Cordova framework | Apache-2.0 | Apache Software Foundation | Android |
| AndroidX libraries the above pull in | Apache-2.0 | AOSP | Android |
| Kotlin standard library | Apache-2.0 | JetBrains, contributors | Android |
| kotlinx.coroutines | Apache-2.0 | JetBrains, contributors | Android |
| JetBrains annotations | Apache-2.0 | JetBrains | Android |
| JSpecify | Apache-2.0 | JSpecify Authors | Android |
| Guava listenablefuture | Apache-2.0 | Guava Authors (Google) | Android |
| Solarized | MIT | E. Schoonover | none needed |

**Giac's other authors** (README list a/–k/, R5: `docs/archive/giac-help-licence.md:9`; our sources `engine/giac/build-wasm.sh:189-195`, options off `:177-184`, linked only GSL, MPFR, GMP `:256-257`):
- Compiled: L. Marohnic's optimisation, signal and graph code, `optimization.cc signalprocessing.cc graphe.cc graphtheory.cc` and the nauty wrapper `nautywrapper.c` (`:194-195`; nauty not linked). The GiNaC-derived parser, `input_lexer.cc input_parser.cc` (`:189-190`); holders (Mainz university; C. Bauer, A. Frink, R. Kreckel) **from memory**.
- Not compiled: gl2ps, FLTK (`:182`), QuickJS, MicroPython (`:183`), NumWorks Delta (R5 j/, `doc/` only).
- Holders unread: `TmpLESystemSolver.C TmpFGLM.C lpsolve.cc` (`:194`), `tinymt32.cc` (`:193`; TinyMT, BSD-3-Clause, **from memory**). (to verify, sandra: the headers, `tar -xzOf giac_2.1.0-1.tar.gz giac-2.1.0/src/<file> | head -40`)

**What a store build would need:** every GPL holder above, plus the FSF for GMP and MPFR unless LGPL can be met (below). Smallest set: drop GSL (`WITH_GSL=0`; `fsolve` keeps only Newton and bisection, docs/02 section 4) and libqalculate's names; left are Giac's holders, the FSF and the owner.

## Legal opinion, not advice

- **From memory:** the FSF reads Apple's usage rules as further restrictions every GPL version forbids.
- **From memory:** GNU Go was removed from the App Store in 2010 after the FSF's complaint; VLC followed in 2011 (docs/02 11.4).
- **Opinion:** an FSF exception for GMP and MPFR is unlikely; it would contradict that position.
- **Opinion:** LGPL alone likely blocks the store too: LGPL-3.0 lets the user replace the library, which a static wasm engine in a signed app does not allow.
- **Not read:** Apple's current terms; the EU routes (other marketplaces, web distribution).

## The Capacitor iOS route, if it ever opened

`@capacitor/ios` 8.5.3 beside `@capacitor/android`, a Mac with Xcode to build and sign, a paid Apple developer account; the plugins' iOS sides (to verify). Not packaged.

# Who holds the rights an App Store build would need (S51)

**Status: open.** The owner decides; iOS v1 is the web app only (owner, 2026-11-10, `docs/must-have.md` item 7). Nothing here went out: no author was asked, no request is drafted.

**Recommendation:** keep iOS on the web app. An App Store exception from Giac's authors alone covers only part of the engine: GSL has many holders, and the Find index carries libqalculate's names. Check: `node tools/probes/ios-rights-rows.ts` (every shipped row of `THIRD_PARTY.md` has a row below).

## The shipped parts

Licences are `THIRD_PARTY.md`'s; holders are its Copyright column unless marked. "One holder?" asks whether one holder could grant the exception; permissive licences (MIT, Apache-2.0, OFL-1.1) need none (opinion).

| Part | Licence | Holders | One holder? |
|---|---|---|---|
| Giac | GPL-3.0-or-later | B. Parisse, R. De Graeve (Institut Fourier) and others: the README's list a/ to k/ (the GiNaC-derived parser, Mainz and R. Kreckel) | No: two authors plus others. Our patches in `engine/giac/patches/` are the owner's (every commit there is his, `git log --format=%an -- engine/giac/patches/`; P24 covers them unless the mail sending one says otherwise). (to verify, sandra: which a/–k/ parts our compiled sources hold, `engine/giac/build-wasm.sh:188`, and `tinymt32.cc`'s header, `:193`) |
| GMP | LGPL-3.0-or-later OR GPL-2.0-or-later | Free Software Foundation | Yes, the FSF |
| MPFR | LGPL-3.0-or-later | Free Software Foundation | Yes, the FSF |
| GSL | GPL-3.0-or-later | the GSL authors (Jungman, Gough, Galassi, Theiler and others) | No: many. (to verify, sandra: no FSF assignment, from file headers) |
| Emscripten runtime (in the engine) | MIT (its MIT side) | Emscripten authors | none needed |
| libqalculate (data in the Find index) | GPL-2.0-or-later | H. Knutsson and the Qalculate! contributors | No: many; names and titles only, `find/factors.yaml` is ours |
| Giac `doc/aide_cas`, English lines | GPL-3.0-or-later | R. De Graeve, B. Parisse (R5) | Two |
| `find/*.yaml`, N62's own code | GPL-3.0-or-later | the owner (every commit's author, `git log --format=%an`) | Yes |
| MathLive | MIT | A. Gourdol | none needed |
| Svelte | MIT | Svelte contributors | none needed |
| Vite | MIT | VoidZero Inc., contributors | none needed |
| @capacitor/core | MIT | Drifty Co. | none needed |
| @capacitor/android | MIT | Drifty Co. | Android only |
| @capacitor/clipboard | MIT | Ionic | none needed |
| @capacitor/share | MIT | Ionic | none needed |
| KaTeX fonts | OFL-1.1 | Design Science, Khan Academy | none needed |
| JSXGraph | MIT OR LGPL-3.0-or-later | M. Ehmann and others | none (MIT side) |
| AndroidX appcompat | Apache-2.0 | Android Open Source Project | Android only |
| AndroidX coordinatorlayout | Apache-2.0 | Android Open Source Project | Android only |
| AndroidX core-splashscreen | Apache-2.0 | Android Open Source Project | Android only |
| Apache Cordova framework | Apache-2.0 | Apache Software Foundation | Android only |
| AndroidX libraries the above pull in | Apache-2.0 | Android Open Source Project | Android only |
| Kotlin standard library | Apache-2.0 | JetBrains, contributors | Android only |
| kotlinx.coroutines | Apache-2.0 | JetBrains, contributors | Android only |
| JetBrains annotations | Apache-2.0 | JetBrains | Android only |
| JSpecify | Apache-2.0 | JSpecify Authors | Android only |
| Guava listenablefuture | Apache-2.0 | Guava Authors (Google) | Android only |
| Solarized | MIT | E. Schoonover | none needed |

**What a store build would need:** the GPL holders above, all of them, plus the FSF for GMP and MPFR unless LGPL can be met (below). The smallest set: drop GSL (`WITH_GSL=0`, the `base` engine; `fsolve` then has only Newton and bisection, docs/02 section 4) and libqalculate's names; left are Giac's holders, the FSF and the owner.

## Legal opinion, not advice

- **From memory:** the FSF reads Apple's App Store terms (its usage rules) as further restrictions that every GPL version forbids.
- **From memory:** GNU Go was removed from the App Store in 2010 after the FSF's complaint; VLC followed in 2011 (docs/02 11.4).
- **Opinion:** an FSF exception for GMP and MPFR is unlikely; it would contradict that position. GSL's holders are individuals (to verify, above).
- **Opinion:** LGPL alone likely blocks the store too: LGPL-3.0 lets the user replace the library in the app, which a static wasm engine in a signed store app does not allow.
- **Not read:** Apple's current terms and review guidelines; the EU routes (alternative marketplaces, web distribution).

## The Capacitor iOS route, if it ever opened

`@capacitor/ios` at the core's version (8.5.3, `THIRD_PARTY.md`) beside `@capacitor/android`, a Mac with Xcode to build and sign, and a paid Apple developer account; the clipboard and share plugins need their iOS sides (to verify). Not packaged; the web app needs none of it.

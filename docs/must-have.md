# N62 must-have list

The owner's list of 2026-11-08, checked against the code and the engine, and turned into work packages. Package texts are in [shifts/packages/](shifts/packages/); this file holds the status of each item, the order, the open bugs found and the decisions still open. A status in brackets is what the check found, where it differs from the first list. Decision numbers are per section.

A package starts only through `scripts/pipeline.sh`, and only when a lane row or a day's plan names it (brief section 0c); none has a row yet except by the days in [release-0.1.0.md](release-0.1.0.md). An item marked "stub" has no package: it says what must exist before it can be split. Line numbers in packages for v0.3 and later are as of de659c02; recheck at start.

Not planned (decided): Python on the device (P11), direct Wi-Fi link or cloud sync (they need the network permission, against the F-Droid promise), accounts.

## A. Before you tell anyone (v0.1.0, tag Sun 11-15, freeze Thu 11-12 evening)

- **No known silent wrong number** [have, with one exception]. No open bug line shows a wrong value unmarked, except F192 (phasor entry, R180), which must land. The bar still counts the night review of 11-09. No package; F198 is a named limit.
- **Units and ± in the core list** [miss]. 66 cases, none with a unit or ±; the harness has no unit check. R170.
- **Release notes** [part]. The release body holds only hashes; no notes file, no `changelogs/`. A90, then A91 after the freeze.
- **First-run tips** [part, was miss]. The overlay is built with 2 cards; flicks, the round pad, Find and the marks are missing. R171.
- **Report a problem** [part, was miss]. The form is merged (A81) with no session field; nothing in the app opens it. A92, R172, R173, A95.
- **Why trust it** [miss]. "2,700" is not true: see the figures below. G200, G201, A93, A94, R174.
- **Showcase video** [part]. The v6 cut opens on d/dx; units are blocks 12–16. Owner's act, Sat 11-14; no package. Decision 4.
- **F-Droid and IzzyOnDroid** [miss]. The recipe is a draft, never built. A96, A97, then the owner's acts after the tag: the fdroiddata merge request and the IzzyOnDroid request. Acceptance takes weeks.
- **APK and site** [not yet; the list's "have" is early]. Releases hold only `deps-giac-2.1.0-1d9536e0`; Pages has one test deployment from 11-05. The tag produces both. Owner's act, no package. Do not publicise n62.dev before the tag.

**The figures "Why trust it" prints** (counted at de659c02; A93 reads them from the files):
- Golden: 1,966 recorded answers, 5 of them open cases. 892 expected values are computed independently of Giac (790 by mpmath, 102 by exact arithmetic); 422 more are hand-derived or reference values cross-checked by machine; the other 652 are hand-derived expected results or behaviour guards. Parser (648) and bench (57) rows are not answers.
- Patches: 37 Giac patches. 12 sent to the author: he wrote that 2 "should be integrated" and applied 10 in his 7 Nov source, with differences being resolved; 25 not sent.
- Traps: Rump ≈ -0.827396059947 (ordinary IEEE double: about ±1.18E21, the sign depends on evaluation order); `1-cos(10⁻⁸)` RAD ≈ 5E-17 (double 0); `(1+10⁻¹⁶)^(10¹⁶)` ≈ 2.71828182846 (double 1); `e^(π√163)` at 30 digits ≈ 262537412640768743.999999999999 (double 2.6253741264076826E17); `∫1/x` from -1 to 1 refused (Giac alone gives 0).
- The page may say values are re-checked only once G200 is merged: `oracle.py` crashes today and the gate does not run it (F197).

Order (all v0.1.0):
- Lane A, after R53 and R148: R170, R171, R172, R173, R174 (after A94).
- Lane B: G200, G201, A90, A92, A93, A94, A95 (the device, after R173), A96, A97.
- By day after the freeze: A91, refreshed Sun morning.
- Must land before the freeze: R180 (the phasor fix, section B). Should land: G300 and G301 (section D); if G301 misses it, F196 joins the known limits.
- If it gets tight, drop in this order (in `docs/release-0.1.0.md`): R174 and A94; A96 and A97 to Mon 11-16; if A95 fails, Android stays copy-only.
- Capacity: 17 open rows in lane A (6 ron, 11 gorge; R53 is on its branch, unmerged) plus these 14 before the freeze and four nights left; 31 merges landed on 11-07. The unknowns are the 11-09 review's output and fix rounds.

Open bugs:
- F197: `oracle.py` exits 1 with a TypeError at `precision.yaml:1166` (since eba26abf), so no full check of the oracle values has finished since; past it, 248 PROBLEM lines, none about a value. Reach: no user; it undercuts the "re-checked" claim. G200.
- F198: `1/0`, `tan(pi/2)` and DEG `tan(90)` show `infinity` with no mark (a deliberate pin since G78, `app/src/engine/novalue.test.ts:144`); once G168 lands, `0/0` is refused "Division by zero" while `1/0` stays `infinity`. No finite digits appear, so it is not a silent wrong number. Reach: everyday. No package unless the owner says; a named limit in A91.

Decisions for the owner:
1. Core cases c67–c69: add them, `hand: false`. The core list changes only with the owner; these are the flows you named.
2. Patches claim: add 0037 to email 5 (its links are pinned at 8f398cca, which lacks it), then send. The README then says more than 12 of 37, truthfully.
3. Trust page location: in the app under Help and about, plus a README section. n62.dev is the app, with no separate pages.
4. Video: keep the v6 cut and record the Qalculate side-by-side as a separate 10 s clip. Opening on it would re-cut the owner's 11-07 chapter order.
5. "HP Prime key layout" in the video: the owner's choice, since `rules-core.md:21` does not list a video caption. Reword it without the name, which costs nothing; the other way is the disclaimer on screen.
6. F-Droid without a local build: submit right after the tag and let the merge request's CI be the first real build. No build VM exists here.
7. Tips layout: one screen, no steps. No new ring logic to get wrong.
8. `infinity` for `1/0` and `tan(90°)`, beside G168's refused `0/0` (F198): ship as is and name it in the known limits; settle it with G2 item 70 after v0.1.0. It shows no wrong digits, and it stays neither exact, marked nor flagged under principle 3.
9. v0.1.0 as a pre-release: make a plain tag a normal release (A90 step 3), reversing the 2026-10-29 choice. A pre-release can be invisible to a "latest" link and to IzzyOnDroid (from memory); `-test` tags stay pre-releases.

Not verified:
- Capacitor's route to `ACTION_VIEW`: seen on upstream `main`, not at 8.5.3 and not on a device. A95's first check.
- GitHub's issue-body limit (65,536) is from memory; prefill of dropdowns is not in its docs, so they are left to the user.
- `releases/latest` skipping a pre-release, and IzzyOnDroid's handling of one: from memory.
- The F-Droid build VM's Debian release (A96's first check) and the scanner's view of `prebuild` output (A97; inference).
- The trap marks were probed on the main checkout's built engine, whose patch level against de659c02 was not checked; G201 settles them through the gate.
- n62.dev's content, IzzyOnDroid's APK size limit, Qalculate on Android.

## B. For daily use by engineers (v0.2 to v0.4)

The v0.1.0 bar is not met until the phasor fix lands: `10∡30+5` from the keys is a silent wrong number at everyday reach (F192). R180 goes before the 11-12 freeze.

**Hand-off to the laptop**
- `[miss]` Session format v1. `HistoryItem` holds no Giac text, angle or digits per row; `uses` is CAS only. G210, G211, G212.
- `[miss]` Copy as Python. Allow-list on our parser's tree; anything else says NOT TRANSLATED. G213, G214, G215, G216, G217, R181.
- `[part]` Sync folder. Folder grant works on the Tab One (A65); append is missing, and `"wa"` is untested. A100, A101, G218, G219, then R128 (existing), R182, R183. No rewrite mode: a folder that cannot append says so and keeps the queue.

**Maths**
- `[part]` Matrices and vectors. `tran`, `dot`, `cross`, `norm`, `rref`, `eigenvals`, `egv` all work; keys and editor are not built. G225, G227, R185, R186, R187, R188, R189, R190.
- `[miss]` Number bases. `0xFF` is refused on purpose; AND, OR, XOR are right on big integers; `shift` is wrong on negative counts and big integers (F193). G226, R191, G228, G229, R192, R193, R194.
- `[part]` Statistics basics. Each statistic exists; no single call gives the pair with r², and unequal lengths show the generic `error.engine`. G223, R184.
- `[part]` Distributions. Inverses are polished (38+ digits); forward tails and the alias `normal_icdf` are not (F195). G220, G221, G222.
- `[part]` SI-prefix display. Works but pads: `4.70000000000 k` at 12 digits. G224.
- `[check: FAIL]` Phasor entry. `10∡30+5` is 10∠35, and the owner's `10∡30+5∡-45` is refused. R180.

**Units and uncertainty**
- `[have]` Units: 5 kg → lb, 20 °C → °F = 68, `5 m + 1 s` refused. "400+" not counted. No package.
- `[have]` The unit pad. By code only. No package.
- `[check: FAIL]` Units inside Solve. Parser refuses `X=3 m`; no unit code in Solve. S45, then stubs: mh-B12b (job builder over dimension symbols), split when S45 lands; mh-B12c (unit slots on knowns), split when S45 lands.
- `[miss]` Your own units. G233, G234, R201.
- `[have]` ± through the result, correlated inputs counted once. No package.
- `[have]` A mark when first order is unreliable: G41 covers every ± entry path (`1/(0.1±0.06)` ⚠ singular point, `(1±0.5)²` ⚠ first order). The list's `[miss]` was wrong. No package; the only gap, Home's constants-only σ line near a pole, is marginal, and B15a is dropped.

**Finding things and help**
- `[part]` Help for the function at the cursor. Help key dead; no examples in tier 0. G231, R196, R197.
- `[check: FAIL]` Find shows where a function sits. Preview has no key field. G230, R195.

**Everywhere**
- `[check: FAIL]` Desktop browser with a keyboard: typed `sin(1)` is `s*i_*n*(1)`. R131 (existing, keys only), then R198.
- `[part]` Export: plain text only, and F180 half-reads templates. G232, R199, R200.
- `[have]` Exact / ≈ / ⚠ marks, 30 digits, full precision on reuse, copy and paste. No package.
- `[have]` Solve, Function, CAS. No package.
- `[have]` History, variables, functions survive a relaunch; Esc cancels. No package.
- `[have]` Complex numbers, DEG/RAD, Sci/Eng/Std, fractions. No package.
- `[have]` User keys, flicks, trackpad, themes, TalkBack, font scale, offline. R41's TalkBack check is still open. No package.

**Existing packages.** R128: depended on, not changed; R183 adds two rows to its level. R130: not amended and not waited for; its pick follows R129, which has no package, so G232 stands alone and R130 reuses it when built. R131: depended on by R198, not changed.

**Order**
- v0.1.0: R180.
- v0.2: G220, G221, G210, G211, G212, G213, G214, G215, G216, G217, R181, A100, A101, G218, G219, R128, R182, R183, G222, G223, R184, G224.
- v0.3: G225, G226, G227, R185, R186, R187, R188, R189, R190, R191, G228, G229, R192, R193, R194, G230, R195, G231, R196, R197, R131, R198, G232, R199, R200.
- v0.4: G233, G234, R201, S45, then the two stubs.

**Open bugs**
- F192, Home and CAS: `10∡30+5` gives 10∠35 with ≈ and no ⚠, `3+4∡30` gives 7∠30, `10∡30*2` gives 10∠60. Keypad reach, everyday AC work. R180 (v0.1.0).
- F193, Home and CAS: integer `shift` is wrong on negative counts and big integers, exact and no ⚠: `shift(1,-70)` = 64, `shift(1,-31)` = -2147483648, `shift(2^70,1)` unchanged. Giac's convention (n > 0 is a right shift) is not the bug. Reach: Find only; the parser refuses `<<`. G226.
- F194, Home and CAS: `dot([1,2],[3,4,5])` = 11 and `cross([1,2,3],[4,5])` = `[-15,12,-3]`, exact, no ⚠. Reach: a Find typo, not everyday, not a bar item. G225.
- F195, Home: far tails. `student_cdf(5,-100)` = 9.48002565337E-10 ⚠ (right 9.48000711231E-10); `student_cdf(30,-8)` wrong from the 6th digit, ⚠; `normald_cdf(0,1,-20)` = 0 ⚠ (right 2.75362411861E-89). All marked, so not a bar item. G220, G221.

**Decisions for the owner**
1. The ∡ rule (R180): recommend Giac's binding, ∡ tighter than + × ÷, with a bare `/` beside the angle and a factor directly after it refused. Why: a flat `2∡π/6` would otherwise be silently -1/3; `10∡2π` then needs brackets, which is honest.
2. Rewrite mode (A101): recommend none. Why: it truncates per result, so a crash loses confirmed lines, and it contradicts "appended, never edited".
3. `shift` direction (G226): recommend keeping Giac's, n > 0 right. Why: the patch then changes only what is wrong.
4. A NOT TRANSLATED line (G213): recommend it binds no value, with later lines that read it also comment-only. Why: the `.py` always runs and never guesses.
5. PFX trims zeros (G224): recommend PFX only, keep ENG. Why: `4.7 k` is what the list asks for; it reverses docs/04 2.7 for PFX.
6. Device name in the file name (R183): recommend `Build.MODEL` plus 4 random hex digits, editable, not in backups. Why: two phones of one model stay apart.
7. Typed names on a hardware keyboard (R198): recommend yes, hardware only. Why: it is the list's "every function reachable by typing"; it reverses R31 on that path.
8. F180's plain forms (R199): recommend `sum(k=1..10) k`, `root(3, 8)`, `lim(x→0) x`. Why: readable, and F180 says the form is a design question.
9. "Jupyter opens the .py": recommend keeping `# %%` cells and saying on the page that a notebook view needs jupytext. Why: Jupyter opens a `.py` as a script otherwise.

**Not verified**
- `"wa"` on any provider: memory only; A100 tests it first. No cloud provider has been run.
- No device or Playwright run in this review; the engine used is main's build at 8f398cca.
- The start chunk's room was not measured; every package keeps the pin or takes a cut.
- The Python semantics: sympy, pint and uncertainties are not installed; G215 exists to check them. Their licences are from memory; G215's first step.
- "400+ units" and tier-1 membership: the Find index was denied.
- The seam for R182's hook: its first step, with `start-chunk.mjs`.
- B10, B11, B13, B14, B19 to B24: by code and tests only; G233's "no definition route" is its first check.

## C. What makes them want it, not just use it (v0.5 to v1)

- **mh-C1 Uncertainty budget** [miss]. `pasuu` computes each term and throws it away (`evaluate.ts:110`). The model has no cross terms; eq. 10 holds for its inputs only. Correlation is modelled by shared leaves where a basis exists; R61 chips, basis-less constants and CODATA leaf correlations are treated as independent. Packages G271, G272, G274, R220 (mockup). Stub: the sheet, split when R220 is picked (outside `src/units/`; no shares in `ValueFacts`; names the leaves, which `basisLeaves` does not hold).
- **mh-C2 Expanded uncertainty, relative σ, short form** [part: Home rows have `U = 2σ (k = 2)`; unit rows, relative σ and `12.34(5)` are missing]. Packages G270, G273. Stub: sheet rows and Copy (C2c), split when R220 is picked; they say "standard uncertainty (σ)", no "k = 1".
- **mh-C3 Formula sets** [part: Solve holds ten equations and systems, no units]. A step is one closed expression over the inputs, since chained chips ignore a shared input and σ can be wrong in either direction. Packages G275, G276. Stubs: the app view (C3c), split when the pick on `docs/mockups/results-mode.html` and decision 6 land; storage and laptop import (C3d), split when the view lands. °C, °F and level inputs work only alone (`build.ts:428-434`).
- **mh-C4 Library from a laptop** [have]. Import, export, "copy the format for your AI", tested (`libraryJobs.engine.test.ts:71`). No package.
- **mh-C5 Published benchmark** [part: harness exists, `compare` empty, no `qalculate` column; only t07 is truly unbuilt; t08 and t09 work today]. Packages S50, R221, R222, R223. Hand-measuring is the owner's act, not a package. A task N62 loses triggers rework or removal (docs/03 rule 13).
- **mh-C6 Tablet / landscape** [miss; deferred 10-13]. Package R224 (tablet and desktop). Stubs: phone landscape (C6b), split when decision 5 reopens it; the PWA manifest to `any` (C6c), split when phone landscape lands, because one manifest cannot differ by device: until then the installed PWA stays portrait.
- **mh-C7 iOS** [miss; web app on iPhone unverified, Chromium only]. Packages S51, A110 (time-boxed; "could not run here" is a valid result), R225. No Capacitor iOS work. The legal lines are opinion.

**Order:** all v0.5–v1.
G270, G271, G272, G273, G274 → R220 (owner picks) → the sheet (stub) → S50, R221, R222, owner measures, R223 → S51, A110, R225 → R224 → G275, G276 → stubs of C3.

**Open bugs:** none.

**Decisions for the owner:**
1. Share base: rows as % of σ² with one signed second-order row (mockup variant A). Recommended: the rows then add up to the σ² that is shown; the alternative, B, is first-order rows over a with second order on its own line, which never exceeds 100 % but no longer adds to σ². A design judgement: R220 shows both.
2. `12.34(5)` or `12.340(50)`: GUM allows both; two digits always. Recommended for consistency with the ± line and NIST's practice.
3. The published ten: S50's table (seven kept, three new; t03, t05, t06 out). Recommended: N62 can lose some of them.
4. The HP name: the README only, with the disclaimer, no new exception. Recommended: it is the existing rule.
5. Reopen the deferred layout for tablet and desktop only (R224); phone landscape waits. Recommended: one column wastes a tablet, and phone landscape has no design.
6. Formula sets live in a lazy Symb/Num app, after the pick on `results-mode.html`, sharing R130's step idea. Recommended: no second worksheet.
7. iOS for v1: confirm web app only, and reword the list item to "iPhone web app, checked". Recommended: the FSF reads the App Store as a further restriction (legal opinion); S51 lists the holders, and no Capacitor work is needed for the web app.
8. R130 writes `± σ (k = 1)`. Change it to "standard uncertainty (σ)". Recommended: GUM 7.2.2 NOTE warns that "k = 1" misreads.

**Not verified:**
- Which constants have no basis (the index is build output).
- Whether CSS alone resizes the Plot (R224 checks first).
- Phone-landscape overflow, and whether WebKit runs on this host (A110).
- The ± path in Qalculate! (S50), and the Virtual Calculator's licence for publishing timings.
- Current Apple terms and EU routes; whether LGPL alone blocks the store (opinion, S51).
- Whether the owner has an iPhone (R225 waits on the owner's check).
- Whether `namesIn` keeps a multi-letter name whole (G275 checks first).
- The size effect of G271 and G273 on the unit-view pin: no build was run.

## D. What the HP crowd will ask for first

- **RPN entry: [miss], confirmed.** Entry is textbook or one-line; the stack is written as packages, nothing is built. After v0.1.0, on the owner's yes. R250, R251, R252, R253, R254, G302. Stack view: stub.
- **Programs: [part], confirmed.** Library file from a laptop, or a one-line definition typed; no editor, no PPL (feedback #40, the owner's list). No package.
- **The forensics chain: [have], unpublished (the list said miss).** Home DEG gives 9, mark `=`, at 12, 15, 30 digits; it cancels symbolically, branches picked by Giac's numeric reduction. No case guards it. G300; CAS DEG shows it badly, G301.
- **Same CAS as the Prime: [have] overstated.** "Also built on Giac" holds, "same" does not; the Prime's Giac version is unknown. Wording below. No package.

**Stub (mh-D1e, stack view):** split when the owner's look and decisions 2 and 4 land. It holds the view, the Mode row with `entry.rpn`, the swap key, ▲/▼ and `frac` in RPN mode.

### The post (the owner's text; refresh every count on the day)
- **RPN** (only after decision 1 is yes): "N62 has no RPN today: entry is textbook or one-line. It is planned for after 0.1.0, with no date; the stack design is written, nothing is built. If you want it, tell me what you would need from it (stack depth, how the keys behave), since the view and part of the key behaviour are still open."
- **Programs:** "No program editor on the device and no PPL: programs are Giac definitions, written on a laptop or typed one line at a time."
- **The chain:** "N62 gives 9 for arcsin(arccos(arctan(tan(cos(sin(9)))))) in DEG, exactly, at 12, 15 and 30 digits. It cancels symbolically, with branches picked by Giac's numeric reduction, so this is not a float chain that lands on 9." (`approx()` of it shows 9 with ≈; its 40-digit working value 8.999… is internal, never shown or copied.)
- **Giac:** "N62 uses Giac, the open-source CAS by Bernard Parisse and Renée De Graeve, which the HP Prime's CAS is also built on. It is not the same build: N62 is pinned to Giac 2.1.0 with 37 local patches, I don't know which Giac a given Prime firmware contains, and so results can differ. Twelve have gone to its author: he wrote that the first two 'should be integrated', and he applied ten more in his own source of 7 Nov, not all identically. The other 25 are not sent yet. Not affiliated with HP Inc. or Moravia; HP and HP Prime are trademarks of HP Inc."

Counts (must match section A): 37 patches; 12 sent (0001-0002, 0003-0012); 25 not sent (0013-0036 drafted in email 5, 0037 no email). Attach a primary source for "also built on" when posting; the repo has a Wikipedia citation only.

**Order:**
- v0.1.0, before the 11-12 freeze: G300, G301. If G301 misses it: F196 joins the known limits and G301 runs in the 11-16/17 room, before the post.
- After the tag and the owner's yes (the list says v1; decision 1 sets when): R250, R251, R252, R253, the owner's Virtual Calculator session, R254, G302; then the stub.

**Open bugs:** F196: CAS in DEG leaves a `pi/180` quotient (`arcsin(0.5)` draws π/(6·π/180), the chain `180/20*pi/pi`); value right, form wrong. Reach: every exact inverse trig constant in CAS DEG. G301; a free name (`…+x`) and Home's same display stay open.

**Decisions for the owner:**
1. RPN after v0.1.0, Home only, a third Entry value: yes; it is the first thing this forum asks, and the design adds no evaluation path.
2. A Virtual Calculator session on RPN before R254, about 20 minutes, behaviour in our own words: yes; the reference's flow is the backbone and its RPN was never exercised.
3. Units and ± on the stack: refuse. One chip used twice is one input, but across rows the result is a new independent chip, so σ would be wrong.
4. The swap key (▶ is also a trackpad step, each 12 px of drag fires it), ▲/▼ and `frac` on an empty line: decide after the session, with the view.
5. No program editor on the device: confirm, no package.
6. The chain in the golden set, not in the core list: yes; the golden gate re-runs it whenever engine or parser code changes; the core list is everyday tasks.
7. Email 5 (0013-0036, adding 0037) before the post: send it first, then refresh the counts (the same act as section A, decision 2).
8. Replace "Same CAS as the Prime" with the wording above, here and in `../outreach/reddit-post.md:23`: yes; the repo cannot prove "same".

**Not verified:**
- The Prime's Giac version, and whether the Virtual Calculator reports one.
- Whether email 5 was sent; his answer to email 4 exists only as our note, with no reply file after 10-29.
- The chain on stock Giac (patches 0014 and 0032 touch this path).
- The CAS forms in a real WebView (probes use EngineHost).
- What R254 adds to the start chunk (unmeasured).

## E. Later, only if users ask

Parked: no packages, no ids; days are rough. docs/02:68-69 and backlog:101 list most of these items (not sync step 3, QR, DMS or the second keypad), but P8 deferred them; docs/03:19 (rule 5) decides. The app has no analytics (rules-core:29), so "3 reports" means 3 GitHub issues from different people.

**mh-E1 Sync step 3.** Android port `clipboard/folder.ts` has no caller, answers "unavailable" on the web; no session format. 4-6 d (web port, read-only view with marks, merging device files). Needs B session format and sync folder. No blocker. Trigger: 3 reports wanting results on a laptop without Jupyter.

**mh-E2 QR.** Nothing built. Source manifest has only VIBRATE. Show a code 1 d; `n62:` deep link 2 d, tight (no `@capacitor/app`; needs a plugin or N62Files work); camera 3-4 d; multi-code 3+ d. Needs B session format, C library. Camera breaks no written rule but ends VIBRATE-only; ML Kit barred (rules-core:25, 28, 29). Build display and deep link only. Trigger: 3 reports where folder sync and USB are forbidden.

**mh-E3 Inference.** `normalt`, `studentt` return only 0/1. 6-9 d (tests and intervals on the CDFs, form, oracle cases); forward t and chi-square from `pasicdft` 0.5-1 more if B has not. Needs B statistics and distributions. No precision blocker on the inverses: Newton at Digits, checked at P and P+20 (icdf.ts:16-24, numeric.ts:878-885, precision.yaml:47-53; 40-digit probe matches mpmath); raw Giac is a 14-digit double. Forward `student_cdf`, `chisquare_cdf` are doubles and show ⚠ (numeric.ts:887-902). Alias `normal_icdf` is unpolished (⚠). Trigger: 3 reports from QA or metrology.

**mh-E4 Regressions.** Giac gives x-parameter first, then the constant; polynomial a list, highest power first (x 0..3, y 3,3,4,6: [1/2,-1/2,3]); no r². Linear, exponential, power, polynomial, correlation are MPFR at 40 digits; logarithmic on float data is a double. 3-4 d; custom fit 3-5 d more (docs/02:34). Needs B statistics. r² must say its space. Trigger: 3 reports for one model.

**mh-E5 Parametric, polar, sequence plots.** Plot is y(x) only (compile.ts:14). Giac's `plotparam` crashes the engine in a smoke probe (F90 group; findcensus-known.yaml:917); JSXGraph would draw instead. 8-12 d, about 6 without sequences; shown numbers from the engine (D7, docs/archive/phase-0-decisions.md:49-50). Needs plots of user functions (backlog:87). Rule 13 (docs/03:27) blocks until a task wins. Trigger: a won benchmark task plus 3 reports.

**mh-E6 Spreadsheet.** No grid; FunctionNum is a read-only table. 15-25 d. Needs B lists, B export. Trigger: 5 reports of a job CSV plus a laptop cannot do. Decision 3.

**mh-E7 Finance.** Nothing in the app or under Giac's names. 4-5 d as a library set with amortisation; a form 2 d more. `fsolve(1000*(1+x)^10=2000,x)` also returns -2.07 (a rate below -100%, meaningless financially): select and substitute back. Needs C formula sets. Rule 5: off-goal. Trigger: 3 reports from cost or project engineers.

**mh-E8 Triangle solver.** Nothing; plain trigonometry. 1-2 d as a library set. Needs C formula sets. SSA shows both solutions, an impossible triangle is refused. Trigger: 3 reports or the first surveyor.

**mh-E9 DMS.** Entry built (boxes.ts:438, parse.ts:344; parser.yaml:594-598, 646-648); a b/c has no DMS form. 2-3 d, for a user toggle only, with the 59.9999″ carry. No dependency. Open: what a DMS form means for a RAD result, since entry compiles to radians (parser.yaml:594); auto-showing sums needs an angle fact results lack. G2 item 29 records decimal, fraction and mixed number, no DMS (g2.yaml:36). Trigger: 2 reports or one surveyor.

**mh-E10 3D.** `plotfunc` gives `gl3d_not_supported` (host.ts:111). 8-12 d. Soft dependency on E5. Trigger: a won benchmark task plus 5 reports. Decision 4.

**mh-E11 Geometry.** Giac's `distance`, `area` work, `inter_unique` returns raw `pnt(...)`; Find hides the family (F90). 20-30 d. No trigger plausible. Decision 1.

**mh-E12 Second keypad.** One layout, keyboard.yaml; 66 core cases and tasks.yaml are key sequences on it. 12-20 d, then every key change costs double. U1-U6 cover part. Trigger: owner only. Decision 2.

**Revive order**
1. E9: half built.
2. E4: cheap after B.
3. E1: extends the laptop hand-off.
4. E8: pairs with DMS.
5. E7: library first, off-goal.
6. E3: needs B statistics and distributions.
7. E2 (no camera): few users.
8. E5: must win a task first.
9. E10: same gate, more cost.
10. E6: second interaction model.

**Decisions for the owner**
1. Geometry to NOT PLANNED: recommended. Largest item; rule 7 (docs/03:21), rules 4, 5 (docs/03:13, 19), the reasoning of rule 13 (GeoGebra is better).
2. Second keypad to NOT PLANNED: recommended. Against rule 8 (docs/03:22) and rules-core:6-8; returns only if the owner rewrites them. rules-core:20-22 name HP only, the same clean-room method would apply. "fx-991", "TI-36X" are, from memory, product marks; by analogy with rules-core:21 keep them out of the app (no written rule covers Casio or TI).
3. Spreadsheet: candidate for NOT PLANNED, the owner's call. Rule 7, rules 4, 5. No sheet engine to reuse: `cell(1,1)` gives `$B$1`, `spreadsheet(2,2)` gives `2,2`, `current_sheet()` 0. Cost per cell unmeasured: raw repeat Giac calls 0.1-13 ms on desktop; Home makes several, and the phone is slower.
4. 3D: candidate for NOT PLANNED, the owner's call. Rule 13, rule 7 (rotate competes with Plot's drag); no hard conflict.

**Not verified**
- Merged Android manifest; `home()` itself (smoke.mjs only); whether golden cases pass.
- Logarithmic regression through Home.
- `normalt`'s print text; `plotparam`'s error message.
- Giac names tried, none works: tvm, npv, irr (either case), pmt, fv; hms, dms, HMS, HMS_to, hms2dec, deg2dms, dms2deg, degtodms, dmstodeg, convert(1.5,hms).
- Folder API browsers; JSXGraph parametric, polar, 3D.
- From memory: F-Droid on CAMERA; ML Kit as Play Services.
- Regressions in Find on a device; any real G2.

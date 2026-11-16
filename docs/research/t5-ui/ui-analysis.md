<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# T5: the UI analysis (friendliness, speed, how a new user learns it)

**Status (2026-11-16): open**, until the owner has answered "Needs the owner" in [SUMMARY.md](SUMMARY.md).

**What this weighs:**
- **The evidence:**
  - the map and the walk ([ui-map.md](ui-map.md), [checks.md](checks.md));
  - the findings ([findings.md](findings.md));
  - the probes with real input on the emulator.
- **What it is measured against:**
  - the owner's design: docs/05, docs/06 3b, decisions.md "Feel, keys and screen", the mockups;
  - Material 3: 48 dp targets, Back closes the top layer first, text that scales;
  - Nielsen's ten heuristics;
  - the G2's flow, which guides and is not copied.
- **The ranking:** how many users a problem hits, times how often. Each problem gets one recommendation. A recommendation that reverses an owner decision says so in its first line.
- **Timing:** wherever this page gives one, it is real input (`adb shell input tap`) on an emulator that ran three other emulators beside it. That makes it a ceiling, not a phone's number.

## The verdict in three lines
1. **Friendly to the user it was built for.** It is the G2's keys and flow, made faster:
   - one sheet model, the state on the status line, dead keys dimmed per layer, an Undo for every removal;
   - DEG/RAD in 1 tap and 20 digits in 2;
   - every sheet opens in 30–270 ms.
2. **Friction where Android's own platform meets it:** Back, the canvas, the system font. The top three problems (Back, Plot's invisible axes, large text) are all here. All three are fixes, not redesigns, and no test that runs today catches any of them.
3. **A new user's first minute is the weakest part.** They meet seven tip cards at once and six "+" keys that do nothing. The keys say little to someone who has not held a G2, and the tips are the only teacher.

## The problems, ranked

### 1. Android Back is not "go back" (every Android user, many times a day)
- **Evidence:**
  - F381: Back leaves the app with a row picked, in the unit view, and with Shift or Alpha armed. Esc undoes each of these in place.
  - Back from Settings opened by Shift + ☰ lands in the Mode sheet, a level the user never saw. The same happens from the digits chip's list (`App.svelte:300-305`, `:325`; R86 "Mode under it").
  - [checks.md](checks.md), "Back does not return": 125 phone edges lead somewhere other than docs/05 says.
    - 27 leave the app (F381).
    - 81 show Mode under a sheet that was opened deeper (R86).
    - 15 are a pick dropped, under an armed Shift or Alpha, when a sheet opens, consistent with R147, or a new matrix that changes the Matrix sheet.
    - 2 are Symb's ☰ rows "Root, extremum … in Plot" and "Solve, polynomial roots … in Num". They switch the view, so Back closes the menu in the new view, not in Symb. That is acceptable, since the user asked for the jump.
- **Who and how often:** on Android, Back (the edge swipe) is the most used way out of anything. A user who picks a row by mistake and swipes back loses the app.
- **Recommendation: R700.** Back closes the top layer first: a pick, the unit view, an armed modifier. Separately, a sheet opened straight at a deep level (Settings from Shift + ☰ or a user key, the digits list from its chip) closes on Back and Esc. Its ‹ in the title still goes up to Mode.
  - **This reverses R86's "Mode under it" for Back and Esc only:** the path in the title and the ‹ stay.
  - **Before:** Shift + ☰, Back → Mode, Back → Home (2 Backs).
  - **After:** Shift + ☰, Back → Home (1).
  - **Package:** R704, kept apart from R700 so the owner can say no to it alone.

### 2. Plot's axes and numbers are black on the dark board (every Plot user on Android's default theme, every plot)
- **Evidence:** F385, from the canvas's own pixels.
  - The axes, tick numbers and trace dot are drawn black on rgb(9, 39, 38), a contrast of about 1.3 : 1. They should be `--muted`, about 9 : 1 ([probe/plot-dark-axes.jpg](../../../tests/ui-walk/probe/plot-dark-axes.jpg)).
  - The phone shows the same ([probe/plot-dark-axes-phone.jpg](../../../tests/ui-walk/probe/plot-dark-axes-phone.jpg)).
- **Recommendation: R710.** Resolve the colour tokens to literal colours before they reach the canvas, and test the contrast in all six themes. Fix before the tag.

### 3. Large system text breaks the keypad (low-vision and older users, every use)
- **Evidence:** F383.
  - At 1.5, faces are cut and Deselect runs off the screen.
  - At 2.0, faces overlap, the status line is cut and Mode's labels are cut.
  - The e2e test that promises it passes, because it emulates the scale differently from the WebView.
- **Who:** Android's "Font size" and "Display size" are among its most used accessibility settings. The users most likely to raise them (engineers past 50) are the G2's own crowd.
- **Recommendation: R703.** The fit pass measures what the WebView draws, and a device test at 1.5 and 2.0 becomes the gate.
  - **This is R41's own "would change if"** (the device clips Mode: it does), so nothing is reversed.
  - Do not turn the system scale off with `setTextZoom(100)`: that takes the setting away from the people who need it.

### 4. Targets under 48 dp (every user, every session; mis-taps unmeasured)
- **Evidence:** [checks.md](checks.md) "Tap targets".
  - The status line's chips are 24 px high and 20–39 px wide.
  - The place and ☰ are 28 px high.
  - The Function app's view tabs are 30 × 20, a slot's show or hide toggle 22 × 22, and a sheet's × and ‹ 23 × 26.
  - The cluster rows are 36 px, and sheet rows shrink to 36 px.
  - Material's floor is 48 × 48 dp.
- **The owner's decisions:** R15b (36 px rows; would change "if 36 px keys are mis-tapped on the phone") and R21 (the 36 px floor of sheet rows, same clause). Nothing counts mis-taps today, so the clause can never fire.
- **Recommendation: A241.** Count the likely mis-taps: a key press undone within 1.5 s by ⌫, Undo or Esc, and a sheet closed within 1 s with nothing picked. Count them per key and per target in Settings › Counters, and let R15b's clause read them after four weeks.
  - **For the status line alone, R708:** each chip's touch box grows to the line's full 28 px height and to at least 48 px wide, by padding inside the 28 px line. Nothing moves or looks different. This keeps docs/03 rule 9, and it reverses no decision.
  - **This does not reverse R15b or R21.**

### 5. A tap on a blank "+" key does nothing (every new user, on the first day)
- **Evidence:** from Home's resting state (p003), the map's edges key:u1 … key:u6 change nothing: no notice, no pulse that says why. The face is "＋" (`app/src/i18n/en.ts:15`), which reads as "add". Inside Settings the same keys jump to their rows in Your keys (docs/05 3.4), so the app already knows what a tap on them should mean.
- **Who:** six of the cluster's 18 cells, at the top left where a first glance lands. It hits everyone who has not set a key, which is nearly every new user.
- **Recommendation: R705.** A tap on an empty user key opens Settings › Your keys on that key's row (the same place the key goes to from inside Settings). Once a key is set, its tap is the user's, as today.
  - **This is growth into a dead tap,** not a move: docs/06 3b rule 5, "the places a user key can hold: always free to grow". User keys are not in `spec/layout-lock.yaml`'s layers.

### 6. The first start is a wall of seven cards (every new user, once, and it sets their picture of the app)
- **Evidence:**
  - The tips overlay (`p001`, [probe/first-start-tips.jpg](../../../tests/ui-walk/probe/first-start-tips.jpg)) shows seven cards and about 90 words at once. Two point at the status line; five describe gestures in words.
  - At font 2.0, "Got it" is off the screen.
  - The tips teach the fold, the line's drag and the row's hold before the user has typed a number.
- **Against Material and Nielsen:** onboarding works best in context (Nielsen 10, help in context; Material's "feature discovery"). One card at the moment it applies is remembered; seven at once are dismissed.
- **Recommendation: R706.** The first start keeps cards 1 and 2 (the place and ☰, which the user needs at once). The other five each show once, at their moment:
  - the row's hold and swipe on the first finished row;
  - the fold on the third Enter;
  - the line's drag when a line first runs past the field;
  - the marks on the first ≈ or ⚠;
  - the units key on the first unit typed by name.

  Settings › Help and about › Tips still shows all seven. **This changes R15c4/R290/R352's one overlay;** the cards' texts stay.

### 7. The unit view does not say it is one (engineers who use units, often)
- **Evidence:** in the unit view ([probe/unit-view.jpg](../../../tests/ui-walk/probe/unit-view.jpg)) the place still reads "Home". No title names the view, and the keypad's faces change to units. The only ways out are Esc and Enter, and Back leaves the app (F381).
- **Against:** docs/05 rule 3, "the current place is always on screen"; Nielsen 1.
- **Recommendation: R707.** While the unit view is open, the status line's place shows "Units" beside Home's tile, as an app's views do. A tap on it closes the view, as Esc does. Back is R700. No key moves.

### 8. Screen reader names (TalkBack users, all the time)
- **Evidence:** [checks.md](checks.md) "Names".
  - The format chip is read "STD" and the digits chip "12". The angle chip, by contrast, reads "Angle unit: Radians. Tap to switch."
  - In the unit view, the unit pad's keys are read by their symbols ("÷", "×", "⌫", "°"). With the decimal comma, the `,` and `;` keys are read "," and ";".
  - The other 550-odd names are good, and key names follow the active layer.
- **Recommendation: R709.** Every status chip gets a name like the angle chip's ("Number format: Standard. Tap for Mode."; "Significant digits: 12. Tap to choose."). A test fails on any control named by symbols alone, an abbreviation ("STD") or a bare number ("12").

### 9. Sync folder is dead in the APK (the users who sync, every time)
- **Evidence:** F380. The feature fails silently: no picker, no error on screen, only the console.
- **Who:** few users today (it is opt-in, R128's removal test). For them it is a data-safety promise that is not kept.
- **Recommendation: R701**, before the tag. Because it ships in v0.1.0, it is placed above its reach in the queue.

### 10. A dead end and a raw message at Store ▶ (new users exploring, rarely)
- **Evidence:** F382. With nothing to store, "Store in" opens. A pick then makes "unsupported command \blacktriangleright".
- **Recommendation: R702** (a dead press, and a message that names what is missing).

### 11. Home ↔ CAS takes two taps (G2 users who switch often)
- **Evidence:** the place, then 2: 2 taps (docs/06 4 B, open; the map).
- **Recommendation: wait.** Do nothing until the counts show the switch is frequent. docs/06 4 B already names the flick on the place name as growth rule 4 after the tag. The press counter (R70) has the numbers. No package.

### An addition from the owner: menus above the keys (R711, after the tag)
- **The idea (the owner, 2026-11-16):** a setting that draws the pick sheets above the keypad instead of over it, so the keypad stays free and the digit keys pick the numbered rows.
- **Evidence for it:**
  - On a phone the sheet covers the digits (R21), so "☰, 3" works only on a hardware keyboard.
  - A row's height differs per sheet; the 3 key never moves.
  - In the wide layout the ☰ menu covers the keypad while the stage beside it is empty.
- **The cost:** on a phone about 7 rows fit above the keypad, so ☰'s ten rows scroll, but 1–0 still pick items 1–10.
- **Recommendation: R711.** The setting "Menus: over the keys | above the keys":
  - over is the phone's default; above is the wide layout's;
  - it carries a removal test;
  - it changes R144 in "above" only (a digit's tap picks).

## Speed: actions to the common tasks (phone, from the map; real input)

The fewest actions from a resting view: a breadth-first search over the map's edges ([ui-map.md](ui-map.md), "actions to reach each state"). A flick counts as one action, as in docs/04 5.2. docs/05 rule 5 asks for at most 2 presses or 1 tap for anything done several times a day.

| Task | Actions | The shortest way | Rule 5 |
|---|---|---|---|
| DEG ↔ RAD | 1 | the angle chip | met |
| Digits to 20 | 2 | the digits chip, 20 | met |
| Number format to SCI | 2 | the format chip, Scientific | met |
| Settings | 1 | a flick up on ☰ (2 with Shift, ☰) | met |
| A Settings section (Appearance, Data, …) | 2 | a flick up on ☰, its digit | met |
| The theme | 3, then the pick | a flick up on ☰, 1 Appearance, 1 Theme | not frequent |
| Home → CAS, Function or Solve | 2 | the place, its digit | met (docs/06 4 B, open) |
| Function Symb → Plot | 1 | the Plot tab | met |
| Home → Function Plot | 3 | the place, 3, the Plot tab | over, but not a several-times-a-day task |
| Root or extremum in Plot | 2 | ☰, its digit (from Symb: ☰, 3 opens Plot's menu) | met |
| Find, everything | 1 | Math | met |
| The unit view | 1 | a flick up on Tmpl (2 with Shift) | met |
| Store ▶ | 1, then the name | a flick up on ᴇ | met |
| Pick a history row | 1 | a tap on it (or ▲) | met |
| Copy a result | 1 | a hold on it | met |
| Copy as LaTeX | 3 | the row, Copy as ›, LaTeX | not frequent |
| Fold the keypad | 1 | a swipe down on the line | met |
| Sync folder | 3 | a flick up on ☰, 5 Data, 4 Sync folder | not frequent |

**Speed is the app's strong side.**
- Every frequent task meets rule 5, and most need one action.
- The flicks carry it: Settings, Store, Memory, the unit view and the palettes are each one flick.
- The time per transition matches: on the phone, keys and gestures settle in a median of 6 ms (p90 83 ms, n 675, [checks.md](checks.md)). With real input, a sheet opens in 26–144 ms, and the first time in 221–266 ms, while its chunk loads.
- The cost of the flicks is discovery: nothing on screen says a key can be flicked except the legends and the tips (problem 6).

## How a new user meets it (organic understanding)
- **What works:**
  - The status line names the place, and a ▾ marks every control that opens a list.
  - Dimmed keys say "not here".
  - The sheets are numbered, so a G2 user's digit habit works on the first day.
  - Find's empty query is the G2's Math menu.
- **What does not:**
  - Nothing on the keypad says what Shift + Deselect, Fmt or a b/c do to a new user, beyond G2 abbreviations ("Tmpl", "Fmt", "a b/c").
  - Help (Shift + Select) is the right fix, but it is two presses away and itself unnamed on the key face ("Select").
- **Recommendation:** none beyond 3–5 above. The keys are the G2's on purpose (P11, docs/06), and the tips at their moment (4) carry the rest.

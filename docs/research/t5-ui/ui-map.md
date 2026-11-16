<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# N62 UI map (T5)

Made by `app/test-device/uiwalk.ts` on emulators (the test build of phase-1), turned into this page by `uiwalk-report.ts`. Each state is named by its id; its screenshot is `tests/ui-walk/shots/<profile>/<id>.jpg`, made by each run of the walk and not kept in git; `→` is where an action leads, `Back → pNNN` and `× → pNNN` say where Android Back and the sheet's × lead after the action (checks.md lists the ones that do not lead where docs/05 says), and the time is from the finger's lift to the last change on screen. Typing keys are in the key tables, not the trees.

## phone (412 × 815 CSS px; 387 states, 2333 edges)

### tips: p001 home +dialog:First-start tips +tips

- tap “Got it” → p002 home · 283 ms
- Android Back → p002 home

### home: p003 home

- tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 83 ms
  - tap “Place: Home. Tap to open the apps list.” → p003 home · 286 ms
  - tap “Angle unit: Radians. Tap to switch.” → p026 home › apps:Apps (a setting changed) · 282 ms
  - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003
    - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 58 ms
    - tap “Angle unit: Radians. Tap to switch.” → p030 home › menu:Mode (a setting changed) · 277 ms
    - tap “STD” · stays
    - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003
      - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 56 ms
      - tap “Angle unit: Radians. Tap to switch.” → p040 home › menu:Mode › Significant digits (a setting changed) · 7 ms
      - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003
      - tap “12” · stays
      - tap “Menu” → p003 home · 302 ms
      - key u1 → p003 home · 3 ms
      - key u2 → p003 home · 2 ms
      - key up → p003 home · 3 ms
      - key menu → p003 home · 18 ms
      - key esc → p006 home › menu:Mode · Back → p003 · × → p003
      - key u3 → p003 home · 2 ms
      - key u4 → p003 home · 2 ms
      - key left → p003 home · 2 ms
      - key right → p003 home · 2 ms
      - key undo → p003 home · 6 ms
      - key redo → p003 home · 3 ms
      - key u5 → p003 home · 19 ms
      - key u6 → p003 home · 2 ms
      - key down → p003 home · 2 ms
      - key select → p003 home · 6 ms
      - key deselect → p003 home · 3 ms
      - tap “Back” → p006 home › menu:Mode · Back → p003 · × → p003
      - tap “Close” → p003 home · 288 ms
      - row “1 4” → p041 home (a setting changed) · 226 ms
      - row “2 6” → p042 home (a setting changed) · 291 ms
      - row “3 8” → p043 home (a setting changed) · 293 ms
      - row “4 10” → p044 home (a setting changed) · 283 ms
      - row “5 12” → p003 home · 284 ms
      - row “6 15” → p045 home (a setting changed) · 282 ms
      - row “7 20” → p046 home (a setting changed) · 271 ms
      - row “8 25” → p047 home (a setting changed) · 292 ms
      - row “9 30” → p048 home (a setting changed) · 309 ms
      - Android Back → p006 home › menu:Mode · 342 ms
      - tap outside → p003 home · 286 ms
    - tap “Menu” → p003 home · 266 ms
    - key u1 → p003 home · 4 ms
    - key u2 → p003 home · 4 ms
    - key up → p003 home · 2 ms
    - key menu → p003 home · 3 ms
    - key esc → p003 home · 2 ms
    - key u3 → p003 home · 2 ms
    - key u4 → p003 home · 6 ms
    - key left → p003 home · 2 ms
    - key right → p003 home · 5 ms
    - key undo → p003 home · 5 ms
    - key redo → p003 home · 2 ms
    - key u5 → p003 home · 3 ms
    - key u6 → p003 home · 3 ms
    - key down → p003 home · 2 ms
    - key select → p003 home · 2 ms
    - key deselect → p003 home · 2 ms
    - key vars → p003 home · 2 ms
    - key math → p003 home · 3 ms
    - key tmpl → p003 home · 4 ms
    - key x → p003 home · 1 ms
    - key frac → p003 home · 2 ms
    - key bksp → p003 home
    - tap “Close” → p003 home · 286 ms
    - row “1 Angle” → p030 home › menu:Mode (a setting changed) · 296 ms
    - tap “Radians” → p003 home · 272 ms
    - tap “Degrees” → p005 home (a setting changed) · 37 ms
    - row “2 Number format” → p031 home › menu:Mode (a setting changed) · 318 ms
    - tap “Standard” → p003 home · 291 ms
    - tap “Scientific” → p032 home (a setting changed) · 253 ms
    - tap “Engineering” → p033 home (a setting changed) · 368 ms
    - tap “Prefixes (k, M, µ …)” → p034 home (a setting changed) · 270 ms
    - row “3 Significant digits” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003
    - tap “Previous value” → p035 home › menu:Mode (a setting changed) · 279 ms
    - tap “Next value” → p036 home › menu:Mode (a setting changed) · 224 ms
    - row “4 Entry” → p037 home › menu:Mode (a setting changed)
    - tap “Textbook” → p003 home · 294 ms
    - tap “One line” → p038 home (a setting changed) · 287 ms
    - row “5 Preset” → p039 home › menu:Mode › Presets · Back → p006 · × → p003
      - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 0 ms
      - tap “Angle unit: Radians. Tap to switch.” → p086 home › menu:Mode › Presets (a setting changed) · 94 ms
      - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003
      - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003
      - tap “Menu” → p003 home · 345 ms
      - key up → p003 home · 4 ms
      - key menu → p003 home · 1 ms
      - key esc → p006 home › menu:Mode · Back → p003 · × → p003
      - tap “Back” → p006 home › menu:Mode · Back → p003 · × → p003
      - tap “Close” → p003 home · 297 ms
      - row “1 Save the current setup as a preset” → p003 home · 309 ms
      - row “2 Edit the presets” · stays
      - Android Back → p006 home › menu:Mode
      - tap outside → p003 home · 308 ms
    - tap “Previous value” · stays
    - tap “Next value” · stays
    - row “6 Settings” → p025 home › menu:Mode › Settings · Back → p006 · × → p003
      - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 0 ms
      - tap “Angle unit: Radians. Tap to switch.” → p078 home › menu:Mode › Settings (a setting changed) · 107 ms
      - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003
      - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003
      - tap “Menu” → p003 home · 272 ms
      - key u1 → p003 home · 2 ms
      - key u2 → p003 home · 14 ms
      - key up → p003 home · 3 ms
      - key menu → p003 home · 6 ms
      - key esc → p006 home › menu:Mode · Back → p003 · × → p003
      - key u3 → p003 home · 2 ms
      - key u4 → p003 home · 2 ms
      - key left → p003 home · 8 ms
      - key right → p003 home · 2 ms
      - key undo → p003 home · 2 ms
      - key redo → p003 home · 2 ms
      - key u5 → p003 home · 2 ms
      - key u6 → p003 home · 4 ms
      - key down → p003 home · 2 ms
      - key select → p003 home · 3 ms
      - key deselect → p003 home · 8 ms
      - key vars → p003 home · 2 ms
      - key math → p003 home · 9 ms
      - key tmpl → p003 home · 3 ms
      - key x → p003 home · 2 ms
      - key frac → p003 home · 2 ms
      - key bksp → p003 home
      - tap “Back” → p006 home › menu:Mode · Back → p003 · × → p003
      - tap “Close” → p003 home · 317 ms
      - row “1 Appearance” → p079 home › menu:Mode › Settings › Appearance · Back → p025 · × → p003
        - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 62 ms
        - tap “Angle unit: Radians. Tap to switch.” → p131 home › menu:Mode › Settings › Appearance (a setting changed) · 318 ms
        - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003
        - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003
        - tap “Menu” → p003 home · 294 ms
        - key up → p003 home · 3 ms
        - key menu → p003 home · 3 ms
        - key esc → p025 home › menu:Mode › Settings · Back → p006 · × → p003
        - tap “Back” → p025 home › menu:Mode › Settings · Back → p006 · × → p003
        - tap “Close” → p003 home · 273 ms
        - row “1 Theme” → p132 home › menu:Settings › Appearance › Theme · Back → p079 · × → p003
        - tap “Previous value” → p133 home › menu:Mode › Settings › Appearance (a setting changed) · 91 ms
        - tap “Next value” → p134 home › menu:Mode › Settings › Appearance (a setting changed) · 463 ms
        - row “2 Brightness” → p135 home › menu:Mode › Settings › Appearance (a setting changed) · 323 ms
        - tap “Previous value” → p136 home › menu:Mode › Settings › Appearance (a setting changed) · 428 ms
        - tap “Next value” → p135 home › menu:Mode › Settings › Appearance (a setting changed) · 402 ms
        - row “3 High contrast” → p137 home › menu:Mode › Settings › Appearance (a setting changed) · 528 ms
        - row “4 Plain keys” → p138 home › menu:Mode › Settings › Appearance (a setting changed) · 481 ms
        - row “5 Key shadows” → p139 home › menu:Mode › Settings › Appearance (a setting changed) · 450 ms
        - row “6 Key pop-ups” → p140 home › menu:Mode › Settings › Appearance (a setting changed) · 314 ms
        - Android Back → p025 home › menu:Mode › Settings
        - tap outside → p003 home · 285 ms
      - row “2 Numbers” → p080 home › menu:Mode › Settings › Numbers · Back → p025 · × → p003
        - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 67 ms
        - tap “Angle unit: Radians. Tap to switch.” → p141 home › menu:Mode › Settings › Numbers (a setting changed) · 287 ms
        - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003
        - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003
        - tap “Menu” → p003 home · 326 ms
        - key up → p003 home · 5 ms
        - key menu → p003 home · 3 ms
        - key esc → p025 home › menu:Mode › Settings · Back → p006 · × → p003
        - tap “Back” → p025 home › menu:Mode › Settings · Back → p006 · × → p003
        - tap “Close” → p003 home · 295 ms
        - row “1 Decimal mark” → p142 home › menu:Mode › Settings › Numbers (a setting changed)
        - tap “Previous value” → p142 home › menu:Mode › Settings › Numbers (a setting changed)
        - tap “Next value” → p142 home › menu:Mode › Settings › Numbers (a setting changed)
        - row “2 Fmt key cycle” → p143 home › menu:Settings › Numbers › Fmt key cycle · Back → p080 · × → p003
        - row “3 Decimals in Fixed” → p144 home › menu:Mode › Settings › Numbers (a setting changed)
        - tap “Previous value” → p145 home › menu:Mode › Settings › Numbers (a setting changed)
        - tap “Next value” → p144 home › menu:Mode › Settings › Numbers (a setting changed)
        - row “4 Uncertainty” → p146 home › menu:Mode › Settings › Numbers (a setting changed)
        - tap “Previous value” → p146 home › menu:Mode › Settings › Numbers (a setting changed)
        - tap “Next value” → p146 home › menu:Mode › Settings › Numbers (a setting changed)
        - row “5 Marks” → p147 home (a setting changed) · 281 ms
        - tap “Marks muted” → p147 home (a setting changed) · 89 ms
        - tap “Warning marks in colour” → p148 home (a setting changed) · 299 ms
        - tap “Warning marks in colour, with their reason under the result” → p003 home · 318 ms
        - row “6 Digit groups” → p149 home › menu:Mode › Settings › Numbers (a setting changed)
        - tap “Digit groups: thin space” → p003 home · 292 ms
        - tap “Digit groups: apostrophe” → p150 home (a setting changed) · 242 ms
        - tap “Digit groups: comma” → p151 home (a setting changed) · 237 ms
        - row “7 Word” → p152 home › menu:Settings › Numbers › Word · Back → p080 · × → p003
        - Android Back → p025 home › menu:Mode › Settings
        - tap outside → p003 home · 293 ms
      - row “3 Key vibration” → p081 home › menu:Mode › Settings › Key vibration · Back → p025 · × → p003
        - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 42 ms
        - tap “Angle unit: Radians. Tap to switch.” → p153 home › menu:Mode › Settings › Key vibration (a setting changed) · 276 ms
        - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003
        - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003
        - tap “Menu” → p003 home · 245 ms
        - key up → p003 home · 6 ms
        - key menu → p003 home · 2 ms
        - key esc → p025 home › menu:Mode › Settings · Back → p006 · × → p003
        - tap “Back” → p025 home › menu:Mode › Settings · Back → p006 · × → p003
        - tap “Close” → p003 home · 286 ms
        - row “1 Key vibration” → p154 home › menu:Mode › Settings › Key vibration (a setting changed)
        - row “2 Strength” · stays
        - tap “Previous value” · stays
        - tap “Next value” · stays
        - row “3 Length” · stays
        - tap “Previous value” · stays
        - tap “Next value” · stays
        - row “4 Try it” · stays
        - row “5 Key click” → p155 home › menu:Mode › Settings › Key vibration (a setting changed)
        - Android Back → p025 home › menu:Mode › Settings
        - tap outside → p003 home · 289 ms
      - row “4 Your keys” → p082 home › menu:Mode › Settings › Your keys · Back → p025 · × → p003
        - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 286 ms
        - tap “Angle unit: Radians. Tap to switch.” → p156 home › menu:Mode › Settings › Your keys (a setting changed) · 290 ms
        - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003 · 354 ms
        - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003 · 307 ms
        - tap “Menu” → p003 home · 446 ms
        - key up → p003 home · 15 ms
        - key menu → p003 home · 6 ms
        - key esc → p025 home › menu:Mode › Settings · Back → p006 · × → p003 · 49 ms
        - tap “Back” → p025 home › menu:Mode › Settings · Back → p006 · × → p003 · 373 ms
        - tap “Close” → p003 home · 296 ms
        - row “1 U1” → p157 home › menu:Settings › Your keys › U1 · Back → p082 · × → p003 · 343 ms
        - row “2 U1 ⇧” → p158 home › menu:Settings › Your keys › U1 ⇧ · Back → p082 · × → p003 · 30 ms
        - row “3 U1 α” → p159 home › menu:Settings › Your keys › U1 α · Back → p082 · × → p003 · 40 ms
        - row “4 U2” → p160 home › menu:Settings › Your keys › U2 · Back → p082 · × → p003 · 41 ms
        - row “5 U2 ⇧” → p161 home › menu:Settings › Your keys › U2 ⇧ · Back → p082 · × → p003 · 15 ms
        - row “6 U2 α” → p162 home › menu:Settings › Your keys › U2 α · Back → p082 · × → p003 · 13 ms
        - row “7 U3” → p163 home › menu:Settings › Your keys › U3 · Back → p082 · × → p003 · 7 ms
        - row “8 U3 ⇧” → p164 home › menu:Settings › Your keys › U3 ⇧ · Back → p082 · × → p003 · 16 ms
        - row “9 U3 α” → p165 home › menu:Settings › Your keys › U3 α · Back → p082 · × → p003 · 19 ms
        - row “0 U4” → p166 home › menu:Settings › Your keys › U4 · Back → p082 · × → p003 · 14 ms
        - row “Unit pad cells” → p167 home › menu:Settings › Your keys › Unit pad cells · Back → p082 · × → p003
        - row “Reset all your keys” · stays
        - Android Back → p025 home › menu:Mode › Settings · 2039 ms
        - tap outside → p003 home · 304 ms
      - row “5 Data” → p083 home › menu:Mode › Settings › Data · Back → p025 · × → p003
        - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 19 ms
        - tap “Angle unit: Radians. Tap to switch.” → p168 home › menu:Mode › Settings › Data (a setting changed) · 314 ms
        - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003
        - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003
        - tap “Menu” → p003 home · 395 ms
        - key up → p003 home · 24 ms
        - key menu → p003 home · 8 ms
        - key esc → p025 home › menu:Mode › Settings · Back → p006 · × → p003
        - tap “Back” → p025 home › menu:Mode › Settings · Back → p006 · × → p003
        - tap “Close” → p003 home · 380 ms
        - row “1 Save a backup” → p003 home · 492 ms
        - row “2 Restore from a file” → p003 home · 252 ms
        - row “3 Library” → p169 home › menu:Settings › Data › Library · Back → p083 · × → p003
        - row “4 Sync folder” → p170 home › menu:Settings › Data › Sync folder · Back → p083 · × → p003 · ⚠ 1 console error(s)
        - row “5 Kept, but the browser may delete it: save a backup” · stays
        - Android Back → p025 home › menu:Mode › Settings
        - tap outside → p003 home · 288 ms
      - row “6 Counters” → p084 home › menu:Mode › Settings › Counters · Back → p025 · × → p003
        - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 55 ms
        - tap “Angle unit: Radians. Tap to switch.” → p171 home › menu:Mode › Settings › Counters (a setting changed) · 294 ms
        - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003
        - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003
        - tap “Menu” → p003 home · 310 ms
        - key up → p003 home · 2 ms
        - key menu → p003 home · 9 ms
        - key esc → p025 home › menu:Mode › Settings · Back → p006 · × → p003
        - tap “Back” → p025 home › menu:Mode › Settings · Back → p006 · × → p003
        - tap “Close” → p003 home · 305 ms
        - row “1 Key presses” · stays
        - row “2 Shift / Alpha taps” · stays
        - row “3 Presets switched” · stays
        - row “4 Results mode” → p172 home › menu:Settings › Counters › Results mode · Back → p084 · × → p003
        - row “5 Counted on this device since” · stays
        - row “6 Export the counts” → p003 home · 9 ms
        - row “7 Reset the counter” · stays
        - Android Back → p025 home › menu:Mode › Settings
        - tap outside → p003 home · 287 ms
      - row “7 Help and about” → p085 home › menu:Mode › Settings › Help and about · Back → p025 · × → p003
        - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 60 ms
        - tap “Angle unit: Radians. Tap to switch.” → p173 home › menu:Mode › Settings › Help and about (a setting changed) · 290 ms
        - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003
        - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003
        - tap “Menu” → p003 home · 287 ms
        - key up → p003 home · 2 ms
        - key menu → p003 home · 2 ms
        - key esc → p025 home › menu:Mode › Settings · Back → p006 · × → p003
        - tap “Back” → p025 home › menu:Mode › Settings · Back → p006 · × → p003
        - tap “Close” → p003 home · 281 ms
        - row “1 Show the first-start tips” → p174 home +dialog:First-start tips +tips · Back → p003 · 303 ms
        - row “2 Report a problem” → p003 home · 372 ms
      - Android Back → p006 home › menu:Mode · 21 ms
      - tap outside → p003 home · 302 ms
    - Android Back → p003 home · 1619 ms
    - tap outside → p003 home · 12 ms
  - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003
  - tap “Menu” → p008 home › menu:Home menu · Back → p003 · × → p003 · 68 ms
    - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 333 ms
    - tap “Angle unit: Radians. Tap to switch.” → p049 home › menu:Home menu (a setting changed) · 311 ms
    - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003 · 386 ms
    - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003 · 346 ms
    - tap “Menu” → p003 home · 156 ms
    - key u1 → p003 home · 10 ms
    - key u2 → p003 home · 3 ms
    - key up → p003 home · 4 ms
    - key menu → p003 home · 2 ms
    - key esc → p003 home · 4 ms
    - key u3 → p003 home · 4 ms
    - key u4 → p003 home · 17 ms
    - key left → p003 home · 15 ms
    - key right → p003 home · 2 ms
    - key undo → p003 home · 20 ms
    - key redo → p003 home · 11 ms
    - key u5 → p003 home · 2 ms
    - key u6 → p003 home · 3 ms
    - key down → p003 home · 2 ms
    - key select → p003 home · 4 ms
    - key deselect → p003 home · 3 ms
    - tap “Settings” → p050 home › menu:Home menu › Settings · Back → p008 · × → p003 · 311 ms
      - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 68 ms
      - tap “Angle unit: Radians. Tap to switch.” → p087 home › menu:Home menu › Settings (a setting changed) · 424 ms
      - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003
      - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003
      - tap “Menu” → p003 home · 236 ms
      - key up → p003 home · 13 ms
      - key menu → p003 home · 9 ms
      - key esc → p008 home › menu:Home menu · Back → p003 · × → p003
      - tap “Back” → p008 home › menu:Home menu · Back → p003 · × → p003
      - tap “Close” → p003 home · 384 ms
      - row “1 Appearance” → p088 home › menu:Home menu › Settings › Appearance · Back → p050 · × → p003
      - row “2 Numbers” → p089 home › menu:Home menu › Settings › Numbers · Back → p050 · × → p003
      - row “3 Key vibration” → p090 home › menu:Home menu › Settings › Key vibration · Back → p050 · × → p003
      - row “4 Your keys” → p091 home › menu:Home menu › Settings › Your keys · Back → p050 · × → p003
      - row “5 Data” → p092 home › menu:Home menu › Settings › Data · Back → p050 · × → p003
      - row “6 Counters” → p093 home › menu:Home menu › Settings › Counters · Back → p050 · × → p003
      - row “7 Help and about” → p094 home › menu:Home menu › Settings › Help and about · Back → p050 · × → p003
      - Android Back → p008 home › menu:Home menu · 165 ms
      - tap outside → p003 home · 287 ms
    - tap “Close” → p003 home · 6 ms
    - row “1 Insert” · stays
    - row “2 Recall” · stays
    - row “3 Copy” · stays
    - row “4 Store ▶” · stays
    - row “5 Delete” · stays
    - row “6 Copy as” · stays
    - row “7 Paste” → p003 home · 175 ms
    - row “8 Share session” · stays · 8 ms
    - row “9 Clear history” · stays
    - row “0 Export” · stays
    - Android Back → p003 home · 1653 ms
    - tap outside → p003 home · 6 ms
  - key u1 → p003 home · 12 ms
  - key u2 → p003 home · 2 ms
  - key up → p003 home · 3 ms
  - key menu → p003 home · 2 ms
  - key esc → p003 home · 2 ms
  - key u3 → p003 home · 2 ms
  - key u4 → p003 home · 6 ms
  - key left → p003 home · 1 ms
  - key right → p003 home · 6 ms
  - key undo → p003 home · 12 ms
  - key redo → p003 home · 1 ms
  - key u5 → p003 home · 2 ms
  - key u6 → p003 home · 3 ms
  - key down → p003 home · 2 ms
  - key select → p003 home · 2 ms
  - key deselect → p003 home · 1 ms
  - key vars → p003 home · 2 ms
  - key math → p003 home · 2 ms
  - key tmpl → p003 home · 1 ms
  - key x → p003 home · 1 ms
  - key frac → p003 home · 2 ms
  - key bksp → p003 home
  - key pow → p003 home · 2 ms
  - key sin → p003 home · 1 ms
  - key cos → p003 home · 2 ms
  - key tan → p003 home · 2 ms
  - key ln → p003 home · 2 ms
  - key log → p003 home · 1 ms
  - key sq → p003 home · 2 ms
  - key neg → p003 home · 2 ms
  - key paren → p003 home · 2 ms
  - key comma → p003 home · 2 ms
  - key enter → p003 home · 2 ms
  - tap “Close” → p003 home · 287 ms
  - row “1 Home” → p003 home · 271 ms
  - row “2 CAS” → p027 cas · 282 ms
  - row “3 Function” → p028 function/symb · 361 ms
  - row “4 Solve” → p029 solve/symb · 275 ms
  - Android Back → p003 home · 1129 ms
  - tap outside → p003 home · 162 ms
- tap “Angle unit: Radians. Tap to switch.” → p005 home (a setting changed) · 4 ms
- tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003 · 321 ms
- tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003 · 28 ms
- tap “Menu” → p008 home › menu:Home menu · Back → p003 · × → p003 · 313 ms
- key menu → p008 home › menu:Home menu · Back → p003 · × → p003 · 20 ms
- key vars → p009 home › find:Vars · Back → p003 · × → p003 · 28 ms
  - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 66 ms
  - tap “Angle unit: Radians. Tap to switch.” → p051 home › find:Vars (a setting changed) · 15 ms
  - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003 · 389 ms
  - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003 · 305 ms
  - tap “Menu” → p003 home · 298 ms
  - tap “Close” → p003 home · 288 ms
  - row “A” → p003 home · 311 ms
  - row “B” → p003 home · 319 ms
  - row “C” → p003 home · 304 ms
  - row “D” → p003 home · 355 ms
  - row “E” → p003 home · 297 ms
  - row “F” → p003 home · 298 ms
  - row “G” → p003 home · 286 ms
  - row “H” → p003 home · 238 ms
  - row “I” → p003 home · 293 ms
  - row “J” → p003 home · 291 ms
  - row “Y” → p003 home · 302 ms
  - row “Z” → p003 home · 269 ms
  - key menu → p003 home · 5 ms
  - key esc → p003 home · 3 ms
  - key vars → p052 home › find:Vars · 16 ms
    - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 322 ms
    - tap “Angle unit: Radians. Tap to switch.” → p095 home › find:Vars (a setting changed) · 353 ms
    - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003 · 203 ms
    - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003 · 334 ms
    - tap “Menu” → p003 home · 260 ms
    - tap “Close” → p003 home · 268 ms
    - key menu → p003 home · 2 ms
    - key esc → p003 home · 2 ms
    - Android Back → p003 home · 2409 ms
    - tap outside → p003 home · 286 ms
  - key math → p052 home › find:Vars · 6 ms
  - key tmpl → p052 home › find:Vars · 38 ms
  - key x → p052 home › find:Vars · 15 ms
  - key sin → p052 home › find:Vars · 7 ms
  - key enter → p003 home · 25 ms
  - key alpha → p053 home [alpha] › find:Vars · Back → p012 · × → p012 · 62 ms
    - tap “Place: Home. Tap to open the apps list.” → p096 home [alpha] › apps:Apps · Back → p012 · × → p012 · 257 ms
    - tap “Angle unit: Radians. Tap to switch.” → p097 home [alpha] › find:Vars (a setting changed) · 282 ms
    - tap “STD” → p098 home [alpha] › menu:Mode · Back → p012 · × → p012 · 329 ms
    - tap “12” → p099 home [alpha] › menu:Mode › Significant digits · Back → p098 · × → p012 · 389 ms
    - tap “Menu” → p012 home [alpha] · 306 ms
    - tap “Close” → p012 home [alpha] · 291 ms
    - row “A” → p012 home [alpha] · 308 ms
    - row “B” → p012 home [alpha] · 315 ms
    - row “C” → p012 home [alpha] · 315 ms
    - row “D” → p012 home [alpha] · 307 ms
    - row “E” → p012 home [alpha] · 305 ms
    - row “F” → p012 home [alpha] · 318 ms
    - row “G” → p012 home [alpha] · 310 ms
    - row “H” → p012 home [alpha] · 306 ms
    - row “I” → p012 home [alpha] · 302 ms
    - row “J” → p012 home [alpha] · 303 ms
    - row “Y” → p012 home [alpha] · 330 ms
    - row “Z” → p012 home [alpha] · 312 ms
    - key menu → p012 home [alpha] · 25 ms
    - key esc → p012 home [alpha] · 16 ms
    - Android Back → p012 home [alpha] · 1713 ms
    - tap outside · stays
  - key shift → p054 home [shift] › find:Vars · Back → p014 · × → p014 · 49 ms
    - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 459 ms
    - tap “Angle unit: Radians. Tap to switch.” → p100 home [shift] › find:Vars (a setting changed) · 280 ms
    - tap “STD” → p101 home [shift] › menu:Mode · Back → p014 · × → p014 · 313 ms
    - tap “12” → p102 home [shift] › menu:Mode › Significant digits · Back → p101 · × → p014 · 409 ms
    - tap “Menu” → p003 home · 591 ms
    - tap “Close” → p014 home [shift] · 242 ms
    - row “A” → p014 home [shift] · 364 ms
    - row “B” → p014 home [shift] · 348 ms
    - row “C” → p014 home [shift] · 382 ms
    - row “D” → p014 home [shift] · 270 ms
    - row “E” → p014 home [shift] · 463 ms
    - row “F” → p014 home [shift] · 301 ms
    - row “G” → p014 home [shift] · 369 ms
    - row “H” → p014 home [shift] · 309 ms
    - row “I” → p014 home [shift] · 300 ms
    - row “J” → p014 home [shift] · 338 ms
    - row “Y” → p014 home [shift] · 312 ms
    - row “Z” → p014 home [shift] · 323 ms
    - key up → p009 home › find:Vars · 70 ms
    - key menu → p003 home · 85 ms
    - key esc → p003 home · 63 ms
    - Android Back → p014 home [shift] · 1692 ms
    - tap outside · stays
  - Android Back → p003 home · 2775 ms
  - tap outside · stays
- key math → p010 home › find:Find · Back → p003 · × → p003 · 18 ms
  - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 322 ms
  - tap “Angle unit: Radians. Tap to switch.” → p055 home › find:Find (a setting changed) · 303 ms
  - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003 · 231 ms
  - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003 · 307 ms
  - tap “Menu” → p003 home · 353 ms
  - tap “Close” → p003 home · 285 ms
  - row “1 Arithmetic” → p056 home › find:Find › Arithmetic · Back → p010 · × → p003 · 298 ms
    - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 140 ms
    - tap “Angle unit: Radians. Tap to switch.” → p103 home › find:Find › Arithmetic (a setting changed) · 293 ms
    - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003 · 385 ms
    - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003 · 343 ms
    - tap “Menu” → p003 home · 345 ms
    - tap “Back” → p010 home › find:Find · Back → p003 · × → p003 · 295 ms
    - tap “Close” → p003 home · 243 ms
    - key menu → p003 home · 2 ms
    - key esc → p010 home › find:Find · Back → p003 · × → p003 · 9 ms
    - Android Back → p010 home › find:Find · 2235 ms
    - tap outside · stays
  - row “2 Powers and logarithms” → p057 home › find:Find › Powers and logarithms · Back → p010 · × → p003 · 46 ms
    - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 307 ms
    - tap “Angle unit: Radians. Tap to switch.” → p104 home › find:Find › Powers and logarithms (a setting changed) · 307 ms
    - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003 · 313 ms
    - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003 · 177 ms
    - tap “Menu” → p003 home · 217 ms
    - tap “Back” → p010 home › find:Find · Back → p003 · × → p003 · 183 ms
    - tap “Close” → p003 home · 219 ms
    - key menu → p003 home · 4 ms
    - key esc → p010 home › find:Find · Back → p003 · × → p003 · 56 ms
    - Android Back → p010 home › find:Find · 1675 ms
    - tap outside · stays
  - row “3 Trigonometry” → p058 home › find:Find › Trigonometry · Back → p010 · × → p003 · 32 ms
    - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 469 ms
    - tap “Angle unit: Radians. Tap to switch.” → p105 home › find:Find › Trigonometry (a setting changed) · 222 ms
    - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003 · 287 ms
    - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003 · 449 ms
    - tap “Menu” → p003 home · 143 ms
    - tap “Back” → p010 home › find:Find · Back → p003 · × → p003 · 238 ms
    - tap “Close” → p003 home · 288 ms
    - key menu → p003 home · 3 ms
    - key esc → p010 home › find:Find · Back → p003 · × → p003 · 42 ms
    - Android Back → p010 home › find:Find · 4071 ms
    - tap outside · stays
  - row “4 Calculus” → p059 home › find:Find › Calculus · Back → p010 · × → p003 · 26 ms
    - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 259 ms
    - tap “Angle unit: Radians. Tap to switch.” → p106 home › find:Find › Calculus (a setting changed) · 269 ms
    - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003 · 93 ms
    - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003 · 423 ms
    - tap “Menu” → p003 home · 387 ms
    - tap “Back” → p010 home › find:Find · Back → p003 · × → p003 · 393 ms
    - tap “Close” → p003 home · 317 ms
    - key menu → p003 home · 18 ms
    - key esc → p010 home › find:Find · Back → p003 · × → p003 · 132 ms
    - Android Back → p010 home › find:Find · 3210 ms
    - tap outside → p003 home · 275 ms
  - row “5 Algebra and solving” → p060 home › find:Find › Algebra and solving · Back → p010 · × → p003 · 17 ms
    - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 298 ms
    - tap “Angle unit: Radians. Tap to switch.” → p107 home › find:Find › Algebra and solving (a setting changed) · 230 ms
    - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003 · 140 ms
    - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003 · 221 ms
    - tap “Menu” → p003 home · 155 ms
    - tap “Back” → p010 home › find:Find · Back → p003 · × → p003 · 241 ms
    - tap “Close” → p003 home · 17 ms
    - key menu → p003 home · 2 ms
    - key esc → p010 home › find:Find · Back → p003 · × → p003 · 133 ms
    - Android Back → p010 home › find:Find · 2926 ms
    - tap outside → p003 home · 261 ms
  - row “6 Matrices and vectors” → p061 home › find:Find › Matrices and vectors · Back → p010 · × → p003 · 22 ms
    - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 444 ms
    - tap “Angle unit: Radians. Tap to switch.” → p108 home › find:Find › Matrices and vectors (a setting changed) · 172 ms
    - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003 · 616 ms
    - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003 · 207 ms
    - tap “Menu” → p003 home · 167 ms
    - tap “Back” → p010 home › find:Find · Back → p003 · × → p003 · 265 ms
    - tap “Close” → p003 home · 230 ms
    - key menu → p003 home · 9 ms
    - key esc → p010 home › find:Find · Back → p003 · × → p003 · 67 ms
    - Android Back → p010 home › find:Find · 1890 ms
    - tap outside · stays
  - key menu → p003 home · 2 ms
  - key esc → p003 home · 7 ms
  - key left → p003 home · 3 ms
  - key right → p056 home › find:Find › Arithmetic · Back → p010 · × → p003 · 9 ms
  - key vars → p062 home › find:Find · Back → p003 · × → p003 · 50 ms
    - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 51 ms
    - tap “Angle unit: Radians. Tap to switch.” → p109 home › find:Find (a setting changed) · 381 ms
    - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003 · 351 ms
    - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003 · 330 ms
    - tap “Menu” → p003 home · 361 ms
    - tap “Close” → p003 home · 47 ms
    - row “Atto (10^-18)” → p003 home · 537 ms
    - row “Are” → p003 home · 300 ms
    - row “Ampere” → p003 home · 234 ms
    - row “Ampere hour” → p003 home · 316 ms
    - row “Abcoulomb” → p003 home · 368 ms
    - key menu → p003 home · 14 ms
    - key esc → p003 home · 13 ms
    - Android Back → p003 home · 3356 ms
    - tap outside · stays
  - key math → p062 home › find:Find · Back → p003 · × → p003 · 47 ms
  - key tmpl → p062 home › find:Find · Back → p003 · × → p003 · 11 ms
  - key x → p062 home › find:Find · Back → p003 · × → p003 · 15 ms
  - key sin → p062 home › find:Find · Back → p003 · × → p003 · 18 ms
  - key enter → p056 home › find:Find › Arithmetic · Back → p010 · × → p003 · 12 ms
  - key alpha → p063 home [alpha] › find:Find · Back → p012 · × → p012 · 116 ms
    - tap “Place: Home. Tap to open the apps list.” → p096 home [alpha] › apps:Apps · Back → p012 · × → p012 · 471 ms
    - tap “Angle unit: Radians. Tap to switch.” → p110 home [alpha] › find:Find (a setting changed) · 373 ms
    - tap “STD” → p098 home [alpha] › menu:Mode · Back → p012 · × → p012 · 306 ms
    - tap “12” → p099 home [alpha] › menu:Mode › Significant digits · Back → p098 · × → p012 · 300 ms
    - tap “Menu” → p012 home [alpha] · 430 ms
    - tap “Close” → p012 home [alpha] · 458 ms
    - row “1 Arithmetic” → p111 home [alpha] › find:Find › Arithmetic · Back → p063 · × → p012 · 78 ms
    - row “2 Powers and logarithms” → p112 home [alpha] › find:Find › Powers and logarithms · Back → p063 · × → p012 · 69 ms
    - row “3 Trigonometry” → p113 home [alpha] › find:Find › Trigonometry · Back → p063 · × → p012 · 206 ms
    - row “4 Calculus” → p114 home [alpha] › find:Find › Calculus · Back → p063 · × → p012 · 30 ms
    - row “5 Algebra and solving” → p115 home [alpha] › find:Find › Algebra and solving · Back → p063 · × → p012 · 402 ms
    - row “6 Matrices and vectors” → p116 home [alpha] › find:Find › Matrices and vectors · Back → p063 · × → p012 · 68 ms
    - key menu → p012 home [alpha] · 63 ms
    - key esc → p012 home [alpha] · 5 ms
    - Android Back → p012 home [alpha] · 1737 ms
    - tap outside · stays
  - key shift → p064 home [shift] › find:Find · Back → p014 · × → p014 · 80 ms
    - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 389 ms
    - tap “Angle unit: Radians. Tap to switch.” → p117 home [shift] › find:Find (a setting changed) · 404 ms
    - tap “STD” → p101 home [shift] › menu:Mode · Back → p014 · × → p014 · 156 ms
    - tap “12” → p102 home [shift] › menu:Mode › Significant digits · Back → p101 · × → p014 · 367 ms
    - tap “Menu” → p003 home · 496 ms
    - tap “Close” → p014 home [shift] · 292 ms
    - row “1 Arithmetic” → p118 home [shift] › find:Find › Arithmetic · Back → p064 · × → p014 · 310 ms
    - row “2 Powers and logarithms” → p119 home [shift] › find:Find › Powers and logarithms · Back → p064 · × → p014 · 331 ms
    - row “3 Trigonometry” → p120 home [shift] › find:Find › Trigonometry · Back → p064 · × → p014 · 195 ms
    - row “4 Calculus” → p121 home [shift] › find:Find › Calculus · Back → p064 · × → p014 · 67 ms
    - row “5 Algebra and solving” → p122 home [shift] › find:Find › Algebra and solving · Back → p064 · × → p014 · 465 ms
    - row “6 Matrices and vectors” → p123 home [shift] › find:Find › Matrices and vectors · Back → p064 · × → p014 · 48 ms
    - key up → p010 home › find:Find · 95 ms
    - key menu → p003 home · 130 ms
    - key esc → p003 home · 82 ms
    - Android Back → p014 home [shift] · 2079 ms
    - tap outside · stays
  - key d1 → p056 home › find:Find › Arithmetic · Back → p010 · × → p003 · 59 ms
  - Android Back → p003 home · 1608 ms
  - tap outside · stays
- key tmpl → p011 home › menu:Templates · Back → p003 · × → p003 · 168 ms
  - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 50 ms
  - tap “Angle unit: Radians. Tap to switch.” → p065 home › menu:Templates (a setting changed) · 303 ms
  - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003
  - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003
  - tap “Menu” → p008 home › menu:Home menu · Back → p003 · × → p003 · 1 ms
  - key u1 → p003 home · 5 ms
  - key u2 → p003 home · 7 ms
  - key up → p003 home · 17 ms
  - key menu → p003 home · 6 ms
  - key esc → p003 home · 6 ms
  - key u3 → p003 home · 8 ms
  - key u4 → p003 home · 9 ms
  - key left → p003 home · 11 ms
  - key right → p003 home · 20 ms
  - key undo → p003 home · 4 ms
  - key redo → p003 home · 5 ms
  - key u5 → p003 home · 16 ms
  - key u6 → p003 home · 40 ms
  - key down → p003 home · 6 ms
  - key select → p003 home · 8 ms
  - key deselect → p003 home · 12 ms
  - key vars → p003 home · 80 ms
  - key math → p003 home · 45 ms
  - key tmpl → p003 home · 14 ms
  - key x → p003 home · 9 ms
  - key frac → p003 home · 8 ms
  - key bksp → p003 home
  - key pow → p003 home · 33 ms
  - key sin → p003 home · 12 ms
  - key cos → p003 home · 6 ms
  - key tan → p003 home · 9 ms
  - key ln → p003 home · 4 ms
  - key log → p003 home · 6 ms
  - key sq → p003 home · 12 ms
  - key neg → p003 home · 4 ms
  - key paren → p003 home · 4 ms
  - key comma → p003 home · 15 ms
  - key enter → p003 home · 4 ms
  - tap “Close” → p003 home · 293 ms
  - row “Fraction” → p003 home · 334 ms
  - row “Power” → p003 home · 307 ms
  - row “Evaluate at” → p003 home · 311 ms
  - row “Derivative” → p003 home · 314 ms
  - row “Piecewise” → p003 home · 364 ms
  - row “2×2 matrix” → p003 home · 329 ms
  - row “Square root” → p003 home · 318 ms
  - row “nth root” → p003 home · 597 ms
  - row “Limit” → p003 home · 392 ms
  - row “Definite integral” → p003 home · 388 ms
  - row “Logarithm with base” → p003 home · 335 ms
  - row “Degrees, minutes, seconds” → p003 home · 300 ms
  - Android Back → p003 home · 1782 ms
  - tap outside → p003 home · 295 ms
- key alpha → p012 home [alpha] · Back → p013 · 61 ms
- key shift → p014 home [shift] · Back → p013 · 100 ms
- Android Back → p013 Android: com.android.launcher3/.uioverrides.QuickstepLauncher
- mark-tap → p015 home +credits › menu:N62 · Back → p003 · × → p003 · 333 ms
  - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 0 ms
  - tap “Angle unit: Radians. Tap to switch.” → p066 home +credits › menu:N62 (a setting changed) · 142 ms
  - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003
  - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003
  - tap “Menu” → p003 home · 256 ms
  - key u1 → p003 home · 26 ms
  - key u2 → p003 home · 25 ms
  - key up → p003 home · 12 ms
  - key menu → p003 home · 10 ms
  - key esc → p003 home · 9 ms
  - key u3 → p003 home · 2 ms
  - key u4 → p003 home · 5 ms
  - key left → p003 home · 11 ms
  - key right → p003 home · 8 ms
  - key undo → p003 home · 4 ms
  - key redo → p003 home · 10 ms
  - key u5 → p003 home · 3 ms
  - key u6 → p003 home · 3 ms
  - key down → p003 home · 3 ms
  - key select → p003 home · 6 ms
  - key deselect → p003 home · 3 ms
  - tap “Close” → p003 home · 166 ms
  - Android Back → p003 home · 3011 ms
  - tap outside → p003 home · 274 ms
- line-swipe-down → p016 home [folded] · Back → p003
- pad-drag-right · stays
- pad-drag-up · stays
- flick-up:vars · stays · notice “The clipboard is not available” · 115 ms
- flick-down:vars · stays · line A · 1504 ms
- flick-up:math → p017 home › find:Memory · Back → p003 · × → p003 · 14 ms
  - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 341 ms
  - tap “Angle unit: Radians. Tap to switch.” → p067 home › find:Memory (a setting changed) · 195 ms
  - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003 · 350 ms
  - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003 · 365 ms
  - tap “Menu” → p003 home · 330 ms
  - tap “Close” → p003 home · 303 ms
  - key menu → p003 home · 6 ms
  - key esc → p003 home · 6 ms
  - key left → p003 home · 2 ms
  - key alpha → p068 home [alpha] › find:Memory · Back → p012 · × → p012 · 88 ms
    - tap “Place: Home. Tap to open the apps list.” → p096 home [alpha] › apps:Apps · Back → p012 · × → p012 · 410 ms
    - tap “Angle unit: Radians. Tap to switch.” → p124 home [alpha] › find:Memory (a setting changed) · 314 ms
    - tap “STD” → p098 home [alpha] › menu:Mode · Back → p012 · × → p012 · 346 ms
    - tap “12” → p099 home [alpha] › menu:Mode › Significant digits · Back → p098 · × → p012 · 133 ms
    - tap “Menu” → p012 home [alpha] · 374 ms
    - tap “Close” → p012 home [alpha] · 301 ms
    - key menu → p012 home [alpha] · 22 ms
    - key esc → p012 home [alpha] · 2 ms
    - Android Back → p012 home [alpha] · 1631 ms
    - tap outside → p012 home [alpha] · 292 ms
  - key shift → p069 home [shift] › find:Memory · Back → p014 · × → p014 · 116 ms
    - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 474 ms
    - tap “Angle unit: Radians. Tap to switch.” → p125 home [shift] › find:Memory (a setting changed) · 207 ms
    - tap “STD” → p101 home [shift] › menu:Mode · Back → p014 · × → p014 · 419 ms
    - tap “12” → p102 home [shift] › menu:Mode › Significant digits · Back → p101 · × → p014 · 263 ms
    - tap “Menu” → p003 home · 442 ms
    - tap “Close” → p014 home [shift] · 306 ms
    - key up → p017 home › find:Memory · 89 ms
    - key menu → p003 home · 70 ms
    - key esc → p003 home · 60 ms
    - Android Back → p014 home [shift] · 1802 ms
    - tap outside → p014 home [shift] · 289 ms
  - Android Back → p003 home · 2664 ms
  - tap outside → p003 home · 84 ms
- flick-down:math · stays · line B
- flick-up:tmpl → p018 home [unit view] · Back → p013 · 227 ms
- flick-down:tmpl · stays · line C
- flick-up:x · stays · line y
- flick-down:x · stays · line D
- flick-up:frac · stays
- flick-down:frac · stays · line E
- flick-up:pow · stays · line \sqrt[\placeholder{}]{\placeholder{}}
- flick-down:pow · stays · line F
- flick-up:sin · stays · line \arcsin\left(\placeholder{}\right)
- flick-down:sin · stays · line G
- flick-up:cos · stays · line \arccos\left(\placeholder{}\right)
- flick-down:cos · stays · line H
- flick-up:tan · stays · line \arctan\left(\placeholder{}\right)
- flick-down:tan · stays · line I
- flick-up:ln · stays · line \exponentialE^{\placeholder{}}
- flick-down:ln · stays · line J
- flick-up:log · stays · line 10^{\placeholder{}}
- flick-down:log · stays · line K
- flick-up:sq · stays · line \sqrt{\placeholder{}}
- flick-down:sq · stays · line L
- flick-up:neg · stays · line \left\|\placeholder{}\right\|
- flick-down:neg · stays · line M
- flick-up:paren · stays · line \operatorname{\mathrm{par}}\left(\placeh
- flick-down:paren · stays · line N
- flick-up:comma · stays · line \pm
- flick-down:comma · stays · line O
- flick-up:emark → p019 home › store:Store in · Back → p003 · × → p003 · 87 ms
  - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 197 ms
  - tap “Angle unit: Radians. Tap to switch.” → p070 home › store:Store in (a setting changed) · 287 ms
  - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003 · 264 ms
  - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003 · 209 ms
  - tap “Menu” → p003 home · 291 ms
  - tap “Close” → p003 home · 286 ms
  - row “A” → p003 home · 880 ms
  - row “B” → p003 home · 394 ms
  - row “C” → p003 home · 409 ms
  - row “D” → p003 home · 347 ms
  - row “E” → p003 home · 354 ms
  - row “F” → p003 home · 413 ms
  - row “G” → p003 home · 430 ms
  - row “H” → p003 home · 371 ms
  - row “I” → p003 home · 521 ms
  - row “J” → p003 home · 328 ms
  - row “Y” → p003 home · 117 ms
  - row “Z” → p003 home · 427 ms
  - key menu → p003 home · 5 ms
  - key esc → p003 home · 2 ms
  - key tmpl → p011 home › menu:Templates · Back → p003 · × → p003 · 330 ms
  - key enter → p003 home · 172 ms
  - key alpha → p071 home [alpha] › store:Store in · Back → p012 · × → p012 · 88 ms
    - tap “Place: Home. Tap to open the apps list.” → p096 home [alpha] › apps:Apps · Back → p012 · × → p012 · 166 ms
    - tap “Angle unit: Radians. Tap to switch.” → p126 home [alpha] › store:Store in (a setting changed) · 291 ms
    - tap “STD” → p098 home [alpha] › menu:Mode · Back → p012 · × → p012 · 500 ms
    - tap “12” → p099 home [alpha] › menu:Mode › Significant digits · Back → p098 · × → p012 · 367 ms
    - tap “Menu” → p012 home [alpha] · 97 ms
    - tap “Close” → p012 home [alpha] · 302 ms
    - row “A” → p012 home [alpha] · 908 ms
    - row “B” → p012 home [alpha] · 1078 ms
    - row “C” → p012 home [alpha] · 751 ms
    - row “D” → p012 home [alpha] · 856 ms
    - row “E” → p012 home [alpha] · 762 ms
    - row “F” → p012 home [alpha] · 1060 ms
    - row “G” → p012 home [alpha] · 960 ms
    - row “H” → p012 home [alpha] · 1000 ms
    - row “I” → p012 home [alpha] · 466 ms
    - row “J” → p012 home [alpha] · 803 ms
    - row “Y” → p012 home [alpha] · 627 ms
    - row “Z” → p012 home [alpha] · 1151 ms
    - key up → p019 home › store:Store in · 115 ms
    - key menu → p008 home › menu:Home menu · Back → p003 · × → p003 · 140 ms
    - key esc → p003 home · 97 ms
    - Android Back → p012 home [alpha] · 2191 ms
    - tap outside · stays · line \blacktriangleright
  - key shift → p072 home [shift] › store:Store in · Back → p014 · × → p014 · 116 ms
    - tap “Place: Home. Tap to open the apps list.” → p127 home [shift] › apps:Apps · Back → p014 · × → p014 · 328 ms
    - tap “Angle unit: Radians. Tap to switch.” → p128 home [shift] › store:Store in (a setting changed) · 297 ms
    - tap “STD” → p101 home [shift] › menu:Mode · Back → p014 · × → p014 · 271 ms
    - tap “12” → p102 home [shift] › menu:Mode › Significant digits · Back → p101 · × → p014 · 309 ms
    - tap “Menu” → p014 home [shift] · 358 ms
    - tap “Close” → p014 home [shift] · 294 ms
    - row “A” → p014 home [shift] · 475 ms
    - row “B” → p014 home [shift] · 568 ms
    - row “C” → p014 home [shift] · 491 ms
    - row “D” → p014 home [shift] · 562 ms
    - row “E” → p014 home [shift] · 622 ms
    - row “F” → p014 home [shift] · 473 ms
    - row “G” → p014 home [shift] · 509 ms
    - row “H” → p014 home [shift] · 620 ms
    - row “I” → p014 home [shift] · 384 ms
    - row “J” → p014 home [shift] · 691 ms
    - row “Y” → p014 home [shift] · 390 ms
    - row “Z” → p014 home [shift] · 376 ms
    - key up → p019 home › store:Store in · 73 ms
    - key menu → p025 home › menu:Mode › Settings · Back → p006 · × → p003 · 189 ms
    - key esc → p003 home · 63 ms
    - Android Back → p014 home [shift] · 1780 ms
    - tap outside · stays · line \blacktriangleright
  - Android Back → p003 home · 2194 ms
  - tap outside · stays · line \blacktriangleright
- flick-down:emark · stays · line P
- flick-up:d7 · stays
- flick-down:d7 · stays · line Q
- flick-up:d8 · stays · line \left\{\placeholder{}\right\}
- flick-down:d8 · stays · line R
- flick-up:d9 → p020 home › menu:Symbols and Greek · Back → p003 · × → p003 · 88 ms
  - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 0 ms
  - tap “Angle unit: Radians. Tap to switch.” → p073 home › menu:Symbols and Greek (a setting changed) · 288 ms
  - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003
  - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003
  - tap “Menu” → p008 home › menu:Home menu · Back → p003 · × → p003 · 65 ms
  - key u1 → p003 home · 8 ms
  - key u2 → p003 home · 3 ms
  - key up → p003 home · 3 ms
  - key menu → p003 home · 20 ms
  - key esc → p003 home · 6 ms
  - key u3 → p003 home · 12 ms
  - key u4 → p003 home · 11 ms
  - key left → p003 home · 19 ms
  - key right → p003 home · 3 ms
  - key undo → p003 home · 10 ms
  - key redo → p003 home · 3 ms
  - key u5 → p003 home · 13 ms
  - key u6 → p003 home · 5 ms
  - key down → p003 home · 9 ms
  - key select → p003 home · 4 ms
  - key deselect → p003 home · 28 ms
  - key vars → p003 home · 7 ms
  - key math → p003 home · 10 ms
  - key tmpl → p003 home · 15 ms
  - key x → p003 home · 7 ms
  - key frac → p003 home · 10 ms
  - key bksp → p003 home
  - key pow → p003 home · 18 ms
  - key sin → p003 home · 14 ms
  - key cos → p003 home · 3 ms
  - key tan → p003 home · 3 ms
  - key ln → p003 home · 4 ms
  - key log → p003 home · 23 ms
  - key sq → p003 home · 15 ms
  - key neg → p003 home · 39 ms
  - key paren → p003 home · 4 ms
  - key comma → p003 home · 3 ms
  - key enter → p003 home · 7 ms
  - tap “Close” → p003 home · 263 ms
  - row “Factorial !” → p003 home · 320 ms
  - row “Function arrow, x → …” → p003 home · 406 ms
  - row “Infinity” → p003 home · 279 ms
  - row “Degree °” → p003 home · 297 ms
  - row “Minutes ′ (after °)” → p003 home · 290 ms
  - row “Seconds ″ (after °)” → p003 home · 306 ms
  - row “Ampersand & (not used yet)” → p003 home · 308 ms
  - row “Ångström Å (a unit: not in Home)” → p003 home · 289 ms
  - row “alpha” → p003 home · 278 ms
  - row “beta” → p003 home · 288 ms
  - row “Omega” → p003 home · 296 ms
  - row “Percent %” → p003 home · 298 ms
  - Android Back → p003 home · 1738 ms
  - tap outside → p003 home · 267 ms
- flick-down:d9 · stays · line S
- flick-up:div · stays · line \placeholder{}^{-1}
- flick-down:div · stays · line T
- flick-up:d4 → p021 home › menu:Matrix · Back → p003 · × → p003 · 25 ms
  - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 396 ms
  - tap “Angle unit: Radians. Tap to switch.” → p074 home › menu:Matrix (a setting changed) · 286 ms
  - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003 · 337 ms
  - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003
  - tap “Menu” → p003 home · 307 ms
  - key u1 → p003 home · 23 ms
  - key u2 → p003 home · 16 ms
  - key up → p003 home · 12 ms
  - key menu → p003 home · 22 ms
  - key esc → p003 home · 17 ms
  - key u3 → p003 home · 6 ms
  - key u4 → p003 home · 34 ms
  - key left → p003 home · 26 ms
  - key right → p003 home · 16 ms
  - key undo → p003 home · 26 ms
  - key redo → p003 home · 2 ms
  - key u5 → p003 home · 15 ms
  - key u6 → p003 home · 12 ms
  - key down → p003 home · 2 ms
  - key select → p003 home · 12 ms
  - key deselect → p003 home · 2 ms
  - tap “Close” → p003 home · 294 ms
  - row “1 Transpose” → p003 home · 666 ms
  - row “2 Dot” → p003 home · 240 ms
  - row “3 Cross” → p003 home · 46 ms
  - row “4 Norm” → p003 home · 266 ms
  - row “5 Reduced row echelon” → p003 home · 352 ms
  - row “6 Eigenvalues” → p003 home · 254 ms
  - row “7 Determinant” → p003 home · 374 ms
  - row “8 Inverse” → p003 home · 383 ms
  - row “9 New” → p075 home +matrix-grid › menu:Matrix › A · Back → p076 · × → p003 · 2310 ms
    - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 303 ms
    - tap “Angle unit: Radians. Tap to switch.” → p129 home +matrix-grid › menu:Matrix › A (a setting changed) · 292 ms
    - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003 · 443 ms
    - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003 · 398 ms
    - tap “Menu” → p130 home +matrix-grid +matrix-menu › menu:Matrix › A › matrix-menu:Matrix menu · Back → p076 · 390 ms
    - tap “Back” → p076 home › menu:Matrix · Back → p003 · × → p003 · 279 ms
    - tap “Close” → p003 home · 306 ms
    - key menu → p130 home +matrix-grid +matrix-menu › menu:Matrix › A › matrix-menu:Matrix menu · Back → p076 · 2 ms
    - key esc → p076 home › menu:Matrix · Back → p003 · × → p003 · 25 ms
    - Android Back → p076 home › menu:Matrix · 2419 ms
    - tap outside → p003 home · 288 ms
  - Android Back → p003 home · 1662 ms
  - tap outside → p003 home · 290 ms
- flick-down:d4 · stays · line U
- flick-up:d5 · stays · line \begin{pmatrix}\placeholder{}\end{pmatri
- flick-down:d5 · stays · line V
- flick-up:d6 → p022 home › menu:Relations and logic · Back → p003 · × → p003 · 67 ms
  - tap “Place: Home. Tap to open the apps list.” → p004 home › apps:Apps · Back → p003 · × → p003 · 48 ms
  - tap “Angle unit: Radians. Tap to switch.” → p077 home › menu:Relations and logic (a setting changed) · 316 ms
  - tap “STD” → p006 home › menu:Mode · Back → p003 · × → p003
  - tap “12” → p007 home › menu:Mode › Significant digits · Back → p006 · × → p003
  - tap “Menu” → p008 home › menu:Home menu · Back → p003 · × → p003 · 0 ms
  - key u1 → p003 home · 7 ms
  - key u2 → p003 home · 3 ms
  - key up → p003 home · 18 ms
  - key menu → p003 home · 18 ms
  - key esc → p003 home · 48 ms
  - key u3 → p003 home · 4 ms
  - key u4 → p003 home · 3 ms
  - key left → p003 home · 2 ms
  - key right → p003 home · 2 ms
  - key undo → p003 home · 11 ms
  - key redo → p003 home · 3 ms
  - key u5 → p003 home · 11 ms
  - key u6 → p003 home · 11 ms
  - key down → p003 home · 3 ms
  - key select → p003 home · 3 ms
  - key deselect → p003 home · 2 ms
  - key vars → p003 home · 3 ms
  - key math → p003 home · 3 ms
  - key tmpl → p003 home · 2 ms
  - key x → p003 home · 5 ms
  - key frac → p003 home · 10 ms
  - key bksp → p003 home
  - key pow → p003 home · 5 ms
  - key sin → p003 home · 3 ms
  - key cos → p003 home · 13 ms
  - key tan → p003 home · 2 ms
  - key ln → p003 home · 3 ms
  - key log → p003 home · 2 ms
  - tap “Close” → p003 home · 327 ms
  - row “7 Less than” → p003 home · 175 ms
  - row “8 Less than or equal” → p003 home · 403 ms
  - row “9 Greater than” → p003 home · 288 ms
  - row “÷ Greater than or equal” → p003 home · 302 ms
  - row “4 Equal? (a test: true or false)” → p003 home · 37 ms
  - row “5 Not equal” → p003 home · 284 ms
  - row “6 And” → p003 home · 165 ms
  - row “× Or” → p003 home · 304 ms
  - row “1 Not” → p003 home · 507 ms
  - row “2 Exclusive or” → p003 home · 304 ms
  - row “3 EQ: are two objects equal?” → p003 home · 502 ms
  - Android Back → p003 home · 2500 ms
  - tap outside → p003 home · 317 ms
- flick-down:d6 · stays · line W
- flick-up:mul · stays · line \mathbin{\measuredangle}
- flick-down:mul · stays · line X
- flick-up:d1 · stays · 13 ms
- flick-down:d1 · stays · line Y
- flick-up:d2 · stays · line \imaginaryI
- flick-down:d2 · stays · line Z
- flick-up:d3 · stays · line \pi
- flick-down:d3 · stays · line \#
- flick-up:sub · stays
- flick-down:sub · stays · line :
- flick-up:d0 · stays · line \%
- flick-down:d0 · stays
- flick-up:dot · stays · line =
- flick-down:dot · stays · line .
- flick-up:space · stays · line _{}
- flick-down:space · stays
- flick-up:add · stays · line \ans
- flick-down:add · stays · line ;
- flick-up:alpha → p023 home [alpha-lock] · Back → p013 · 83 ms
- flick-down:alpha → p023 home [alpha-lock] · Back → p013 · 58 ms
- flick-up:shift → p024 home [shift-lock] · Back → p013 · 39 ms
- flick-down:shift · stays
- flick-up:menu → p025 home › menu:Mode › Settings · Back → p006 · × → p003 · 45 ms
- flick-down:menu → p008 home › menu:Home menu · Back → p003 · × → p003 · 23 ms
- flick-up:esc · stays
- flick-down:esc · stays
- flick-up:undo · stays
- flick-down:undo · stays
- flick-up:redo · stays
- flick-down:redo · stays
- flick-up:select → p010 home › find:Find · Back → p003 · × → p003 · 53 ms
- flick-down:select · stays
- flick-up:deselect → p006 home › menu:Mode · Back → p003 · × → p003 · 19 ms
- flick-down:deselect · stays
- flick-up:fmt · stays
- flick-down:fmt · stays
- flick-up:enter · stays · line \operatorname{\mathrm{approx}}\left(\pla
- flick-down:enter · stays
- flick-up:bksp · stays
- flick-down:bksp · stays

### home-rows: p175 home

- tap “Place: Home. Tap to open the apps list.” → p176 home › apps:Apps · Back → p175 · × → p175 · 62 ms
- tap “Angle unit: Radians. Tap to switch.” → p177 home (a setting changed) · 30 ms
- tap “STD” → p178 home › menu:Mode · Back → p175 · × → p175 · 418 ms
- tap “12” → p179 home › menu:Mode › Significant digits · Back → p178 · × → p175 · 48 ms
- tap “Menu” → p180 home › menu:Home menu · Back → p175 · × → p175 · 231 ms
  - tap “Place: Home. Tap to open the apps list.” → p176 home › apps:Apps · Back → p175 · × → p175 · 49 ms
  - tap “Angle unit: Radians. Tap to switch.” → p189 home › menu:Home menu (a setting changed) · 170 ms
  - tap “STD” → p178 home › menu:Mode · Back → p175 · × → p175 · 374 ms
  - tap “12” → p179 home › menu:Mode › Significant digits · Back → p178 · × → p175 · 373 ms
  - tap “Menu” → p175 home · 50 ms
  - key up → p175 home · 3 ms
  - key menu → p175 home · 8 ms
  - key esc → p175 home · 15 ms
  - key left → p175 home · 28 ms
  - key right → p175 home · 7 ms
  - key undo → p175 home · 3 ms
  - key redo → p175 home · 18 ms
  - key down → p175 home · 11 ms
  - key select → p175 home · 4 ms
  - key deselect → p175 home · 2 ms
  - tap “Settings” → p190 home › menu:Home menu › Settings · Back → p180 · × → p175 · 498 ms
  - tap “Close” → p175 home · 97 ms
  - row “1 Insert” → p175 home · 77 ms
  - row “2 Recall” → p175 home · 96 ms
  - row “3 Copy” → p175 home · 841 ms
  - row “4 Store ▶” → p191 home › store:Store ≈ 0.333333333333 in · Back → p175 · × → p175 · 186 ms
  - row “5 Delete” → p175 home · 12 ms
  - row “6 Copy as” → p192 home › menu:Home menu › Copy as · Back → p180 · × → p175 · 168 ms
    - tap “Place: Home. Tap to open the apps list.” → p176 home › apps:Apps · Back → p175 · × → p175 · 54 ms
    - tap “Angle unit: Radians. Tap to switch.” → p198 home › menu:Home menu › Copy as (a setting changed) · 290 ms
    - tap “STD” → p178 home › menu:Mode · Back → p175 · × → p175
    - tap “12” → p179 home › menu:Mode › Significant digits · Back → p178 · × → p175
    - tap “Menu” → p175 home · 294 ms
    - key up → p175 home · 2 ms
    - key menu → p175 home · 3 ms
    - key esc → p180 home › menu:Home menu · Back → p175 · × → p175
    - tap “Back” → p180 home › menu:Home menu · Back → p175 · × → p175
    - tap “Close” → p175 home · 254 ms
    - row “1 As shown” → p175 home · 2994 ms
    - row “2 Exact” → p175 home · 401 ms
    - row “3 LaTeX” → p175 home · 2534 ms
    - row “4 Python” → p175 home · 2710 ms
    - Android Back → p180 home › menu:Home menu · 284 ms
    - tap outside → p175 home · 273 ms
  - row “7 Paste” → p175 home · 19 ms
  - row “8 Share session” → p175 home · 34 ms
  - row “9 Clear history” → p175 home · 136 ms
  - row “0 Export” · stays
  - Android Back · stays · notice “Shared” · 6253 ms
  - tap outside → p175 home · 7 ms
- tap “31​” → p181 home +row-actions · Back → p182 · 32 ms
  - tap “Place: Home. Tap to open the apps list.” → p176 home › apps:Apps · Back → p175 · × → p175 · 249 ms
  - tap “Angle unit: Radians. Tap to switch.” → p193 home +row-actions (a setting changed) · 298 ms
  - tap “STD” → p178 home › menu:Mode · Back → p175 · × → p175 · 383 ms
  - tap “12” → p179 home › menu:Mode › Significant digits · Back → p178 · × → p175 · 309 ms
  - tap “Menu” → p194 home › menu:Menu · Back → p175 · × → p175 · 331 ms
    - tap “Place: Home. Tap to open the apps list.” → p176 home › apps:Apps · Back → p175 · × → p175 · 317 ms
    - tap “Angle unit: Radians. Tap to switch.” → p199 home › menu:Menu (a setting changed) · 311 ms
    - tap “STD” → p178 home › menu:Mode · Back → p175 · × → p175 · 341 ms
    - tap “12” → p179 home › menu:Mode › Significant digits · Back → p178 · × → p175 · 288 ms
    - tap “Menu” → p175 home · 331 ms
    - key up → p175 home · 6 ms
    - key menu → p175 home · 6 ms
    - key esc → p175 home · 4 ms
    - tap “Settings” → p200 home › menu:Menu › Settings · Back → p194 · × → p175 · 302 ms
    - tap “Close” → p175 home · 71 ms
    - row “1 Insert” → p175 home · 80 ms
    - row “2 Recall” → p175 home · 45 ms
    - row “3 Copy” → p175 home · 194 ms
    - row “4 Store ▶” → p191 home › store:Store ≈ 0.333333333333 in · Back → p175 · × → p175 · 174 ms
    - row “5 Delete” → p175 home · 14 ms
    - row “6 Copy as” → p201 home › menu:Menu › Copy as · Back → p194 · × → p175 · 283 ms
      - tap “Place: Home. Tap to open the apps list.” → p176 home › apps:Apps · Back → p175 · × → p175 · 0 ms
      - tap “Angle unit: Radians. Tap to switch.” → p218 home › menu:Menu › Copy as (a setting changed) · 324 ms
      - tap “STD” → p178 home › menu:Mode · Back → p175 · × → p175
      - tap “12” → p179 home › menu:Mode › Significant digits · Back → p178 · × → p175
      - tap “Menu” → p175 home · 68 ms
      - key up → p175 home · 5 ms
      - key menu → p175 home · 10 ms
      - key esc → p194 home › menu:Menu · Back → p175 · × → p175
      - tap “Back” → p194 home › menu:Menu · Back → p175 · × → p175
      - tap “Close” → p175 home · 287 ms
      - row “1 As shown” → p175 home · 353 ms
      - row “2 Exact” → p175 home · 286 ms
      - row “3 LaTeX” → p175 home · 307 ms
      - row “4 Python” → p175 home · 456 ms
      - Android Back → p194 home › menu:Menu · 166 ms
      - tap outside → p175 home · 295 ms
    - row “7 Paste” → p175 home · 107 ms
    - row “8 Share session” → p175 home · 14 ms
    - row “9 Clear history” → p175 home · 316 ms
    - row “0 Export” → p202 home › menu:Menu › Export · Back → p194 · × → p175 · 283 ms
      - tap “Place: Home. Tap to open the apps list.” → p176 home › apps:Apps · Back → p175 · × → p175 · 31 ms
      - tap “Angle unit: Radians. Tap to switch.” → p219 home › menu:Menu › Export (a setting changed) · 298 ms
      - tap “STD” → p178 home › menu:Mode · Back → p175 · × → p175
      - tap “12” → p179 home › menu:Mode › Significant digits · Back → p178 · × → p175
      - tap “Menu” → p175 home · 309 ms
      - key up → p175 home · 2 ms
      - key menu → p175 home · 2 ms
      - key esc → p194 home › menu:Menu · Back → p175 · × → p175
      - tap “Back” → p194 home › menu:Menu · Back → p175 · × → p175
      - tap “Close” → p175 home · 284 ms
      - row “1 Work report” → p175 home · 315 ms
      - row “2 CSV” → p175 home · 281 ms
      - row “3 LaTeX” → p175 home · 293 ms
      - row “4 Python” → p175 home · 289 ms
      - Android Back → p194 home › menu:Menu · 252 ms
      - tap outside → p175 home · 288 ms
    - Android Back → p175 home · 1770 ms
    - tap outside → p175 home · 16 ms
  - tap “31​” → p175 home · 38 ms
  - tap “≈ 0.333333333333” → p175 home · 30 ms
  - tap “0.333333333333” → p175 home · 12 ms
  - tap “Store ▶” → p191 home › store:Store ≈ 0.333333333333 in · Back → p175 · × → p175 · 87 ms
  - tap “Copy as ›” → p195 home › menu:Copy as · Back → p175 · × → p175 · 21 ms
    - tap “Place: Home. Tap to open the apps list.” → p176 home › apps:Apps · Back → p175 · × → p175 · 37 ms
    - tap “Angle unit: Radians. Tap to switch.” → p203 home › menu:Copy as (a setting changed) · 76 ms
    - tap “STD” → p178 home › menu:Mode · Back → p175 · × → p175
    - tap “12” → p179 home › menu:Mode › Significant digits · Back → p178 · × → p175
    - tap “Menu” → p175 home · 261 ms
    - key up → p175 home · 9 ms
    - key menu → p175 home · 3 ms
    - key esc → p175 home · 2 ms
    - tap “Close” → p175 home · 282 ms
    - row “1 As shown” → p175 home · 625 ms
    - row “2 Exact” → p175 home · 531 ms
    - row “3 LaTeX” → p175 home · 467 ms
    - row “4 Python” → p175 home · 2752 ms
    - Android Back → p175 home · 1024 ms
    - tap outside → p175 home · 278 ms
  - key menu → p194 home › menu:Menu · Back → p175 · × → p175 · 28 ms
  - key esc → p175 home · 1 ms
  - key left → p175 home · 28 ms
  - key right → p175 home · 5 ms
  - key undo → p175 home · 15 ms
  - key redo → p175 home · 9 ms
  - key down → p175 home · 2 ms
  - key vars → p183 home › find:Vars · Back → p175 · × → p175 · 41 ms
  - key math → p184 home › find:Find · Back → p175 · × → p175 · 74 ms
  - key tmpl → p185 home › menu:Templates · Back → p175 · × → p175 · 169 ms
  - key frac → p175 home · 14 ms
  - key bksp → p175 home
  - key enter → p175 home · 18 ms
  - key emark → p175 home · 25 ms
  - key alpha → p196 home [alpha] +row-actions · Back → p182 · 46 ms
    - tap “Place: Home. Tap to open the apps list.” → p176 home › apps:Apps · Back → p175 · × → p175 · 455 ms
    - tap “Angle unit: Radians. Tap to switch.” → p204 home [alpha] +row-actions (a setting changed) · 305 ms
    - tap “STD” → p205 home [alpha] › menu:Mode · Back → p186 · × → p186 · 267 ms
    - tap “12” → p206 home [alpha] › menu:Mode › Significant digits · Back → p205 · × → p186 · 383 ms
    - tap “Menu” → p194 home › menu:Menu · Back → p175 · × → p175 · 389 ms
    - tap “31​” → p186 home [alpha] · 75 ms
    - tap “≈ 0.333333333333” → p186 home [alpha] · 61 ms
    - tap “0.333333333333” → p186 home [alpha] · 13 ms
    - tap “Store ▶” → p207 home [alpha] › store:Store ≈ 0.333333333333 in · Back → p186 · × → p186 · 397 ms
    - tap “Copy as ›” → p208 home [alpha] › menu:Copy as · Back → p186 · × → p186 · 322 ms
    - key up → p181 home +row-actions · 80 ms
    - key menu → p194 home › menu:Menu · Back → p175 · × → p175 · 122 ms
    - key esc → p175 home · 71 ms
    - key left → p175 home · 63 ms
    - key right → p175 home · 93 ms
    - key undo → p175 home · 86 ms
    - key redo → p175 home · 91 ms
    - key down → p175 home · 50 ms
    - key select → p181 home +row-actions · 110 ms
    - key deselect → p181 home +row-actions · 66 ms
    - key vars → p175 home · 52 ms
    - key math → p175 home · 116 ms
    - key tmpl → p175 home · 174 ms
    - key frac → p175 home · 98 ms
    - key bksp → p175 home
    - key enter → p175 home · 69 ms
    - key emark → p175 home · 50 ms
    - key alpha → p209 home [alpha-lock] +row-actions · 1 ms
      - tap “Place: Home. Tap to open the apps list.” → p220 home [alpha-lock] › apps:Apps · Back → p221 · × → p221 · 307 ms
      - tap “Angle unit: Radians. Tap to switch.” → p222 home [alpha-lock] +row-actions (a setting changed) · 296 ms
      - tap “STD” → p223 home [alpha-lock] › menu:Mode · Back → p221 · × → p221 · 323 ms
      - tap “12” → p224 home [alpha-lock] › menu:Mode › Significant digits · Back → p223 · × → p221 · 344 ms
      - tap “Menu” → p225 home [alpha-lock] › menu:Menu · Back → p221 · × → p221 · 394 ms
      - tap “31​” → p221 home [alpha-lock] · 9 ms
      - tap “≈ 0.333333333333” → p221 home [alpha-lock] · 33 ms
      - tap “0.333333333333” → p221 home [alpha-lock] · 17 ms
      - tap “Store ▶” → p226 home [alpha-lock] › store:Store ≈ 0.333333333333 in · Back → p221 · × → p221 · 344 ms
      - tap “Copy as ›” → p227 home [alpha-lock] › menu:Copy as · Back → p221 · × → p221 · 320 ms
      - key menu → p225 home [alpha-lock] › menu:Menu · Back → p221 · × → p221 · 25 ms
      - key esc → p221 home [alpha-lock] · 2 ms
      - key left → p221 home [alpha-lock] · 4 ms
      - key right → p221 home [alpha-lock] · 9 ms
      - key undo → p221 home [alpha-lock] · 5 ms
      - key redo → p221 home [alpha-lock] · 4 ms
      - key down → p221 home [alpha-lock] · 1 ms
      - key vars → p221 home [alpha-lock] · 12 ms
      - key math → p221 home [alpha-lock] · 9 ms
      - key tmpl → p221 home [alpha-lock] · 11 ms
      - key frac → p221 home [alpha-lock] · 5 ms
      - key bksp → p221 home [alpha-lock]
      - key enter → p221 home [alpha-lock] · 9 ms
      - key emark → p221 home [alpha-lock] · 5 ms
      - key alpha → p181 home +row-actions · 17 ms
      - key fmt → p221 home [alpha-lock] · 45 ms
      - Android Back → p182 Android: com.android.launcher3/.uioverrides.QuickstepLauncher
    - key fmt → p175 home · 38 ms
    - Android Back → p182 Android: com.android.launcher3/.uioverrides.QuickstepLauncher
  - key shift → p197 home [shift] +row-actions · Back → p182 · 126 ms
    - tap “Place: Home. Tap to open the apps list.” → p176 home › apps:Apps · Back → p175 · × → p175 · 361 ms
    - tap “Angle unit: Radians. Tap to switch.” → p210 home [shift] +row-actions (a setting changed) · 354 ms
    - tap “STD” → p211 home [shift] › menu:Mode · Back → p187 · × → p187 · 360 ms
    - tap “12” → p212 home [shift] › menu:Mode › Significant digits · Back → p211 · × → p187 · 328 ms
    - tap “Menu” → p194 home › menu:Menu · Back → p175 · × → p175 · 500 ms
    - tap “31​” → p187 home [shift] · 24 ms
    - tap “≈ 0.333333333333” → p187 home [shift] · 12 ms
    - tap “0.333333333333” → p187 home [shift] · 15 ms
    - tap “Store ▶” → p213 home [shift] › store:Store ≈ 0.333333333333 in · Back → p187 · × → p187 · 410 ms
    - tap “Copy as ›” → p214 home [shift] › menu:Copy as · Back → p187 · × → p187 · 309 ms
    - key up → p181 home +row-actions · 23 ms
    - key menu → p215 home › menu:Mode › Settings · Back → p178 · × → p175 · 251 ms
    - key esc → p175 home · 63 ms
    - key left → p181 home +row-actions · 99 ms
    - key right → p181 home +row-actions · 62 ms
    - key undo → p175 home · 77 ms
    - key redo → p175 home · 45 ms
    - key down → p181 home +row-actions · 94 ms
    - key select → p184 home › find:Find · Back → p175 · × → p175 · 215 ms
    - key deselect → p178 home › menu:Mode · Back → p175 · × → p175 · 136 ms
    - key vars → p175 home · 277 ms
    - key math → p216 home › find:Memory · Back → p175 · × → p175 · 138 ms
    - key tmpl → p217 home [unit view] · Back → p182 · 350 ms
    - key frac → p181 home +row-actions · 82 ms
    - key bksp → p175 home
    - key enter → p175 home · 123 ms
    - key emark → p191 home › store:Store ≈ 0.333333333333 in · Back → p175 · × → p175 · 795 ms
    - key alpha → p196 home [alpha] +row-actions · 101 ms
    - key shift → p181 home +row-actions · 83 ms
    - key fmt → p181 home +row-actions · 49 ms
    - Android Back → p182 Android: com.android.launcher3/.uioverrides.QuickstepLauncher
  - key fmt → p175 home · 18 ms
  - Android Back → p182 Android: com.android.launcher3/.uioverrides.QuickstepLauncher
- tap “≈ 0.333333333333” → p181 home +row-actions · Back → p182 · 84 ms
- tap “0.333333333333” → p181 home +row-actions · Back → p182 · 44 ms
- key up → p181 home +row-actions · Back → p182 · 29 ms
- key menu → p180 home › menu:Home menu · Back → p175 · × → p175 · 141 ms
- key vars → p183 home › find:Vars · Back → p175 · × → p175 · 73 ms
- key math → p184 home › find:Find · Back → p175 · × → p175 · 69 ms
- key tmpl → p185 home › menu:Templates · Back → p175 · × → p175 · 295 ms
- key alpha → p186 home [alpha] · Back → p182 · 130 ms
- key shift → p187 home [shift] · Back → p182 · 47 ms
- Android Back → p182 Android: com.android.launcher3/.uioverrides.QuickstepLauncher
- row-hold-result · stays · notice “Copied” · 2271 ms
- row-hold-input · stays · 1848 ms
- row-swipe-left · stays · 184 ms
- row-swipe-right · stays · 173 ms
- row-tap-twice · stays · 173 ms
- line-swipe-down → p188 home [folded] · Back → p175
- line-hold · stays
- line-drag-side · stays
- bksp-hold · stays
- sheet-scroll · stays

### home-line: p228 home

- tap “Place: Home. Tap to open the apps list.” → p229 home › apps:Apps · Back → p228 · × → p228 · 63 ms
- tap “Angle unit: Radians. Tap to switch.” → p230 home (a setting changed) · 12 ms
- tap “STD” → p231 home › menu:Mode · Back → p228 · × → p228 · 328 ms
- tap “12” → p232 home › menu:Mode › Significant digits · Back → p231 · × → p228 · 12 ms
- tap “Menu” → p233 home › menu:Home menu · Back → p228 · × → p228 · 310 ms
  - tap “Place: Home. Tap to open the apps list.” → p229 home › apps:Apps · Back → p228 · × → p228 · 49 ms
  - tap “Angle unit: Radians. Tap to switch.” → p241 home › menu:Home menu (a setting changed) · 3 ms
  - tap “STD” → p231 home › menu:Mode · Back → p228 · × → p228 · 324 ms
  - tap “12” → p232 home › menu:Mode › Significant digits · Back → p231 · × → p228 · 299 ms
  - tap “Menu” → p228 home · 286 ms
  - key up → p228 home · 8 ms
  - key menu → p228 home · 2 ms
  - key esc → p228 home · 3 ms
  - key left → p228 home · 2 ms
  - key right → p228 home · 3 ms
  - key undo → p228 home · 3 ms
  - key redo → p228 home · 2 ms
  - key down → p228 home · 1 ms
  - key select → p228 home · 1 ms
  - key deselect → p228 home · 2 ms
  - tap “Settings” → p242 home › menu:Home menu › Settings · Back → p233 · × → p228 · 296 ms
  - tap “Close” → p228 home · 4 ms
  - row “1 Insert” · stays
  - row “2 Recall” · stays
  - row “3 Copy” · stays
  - row “4 Store ▶” · stays
  - row “5 Delete” · stays
  - row “6 Copy as” · stays
  - row “7 Paste” → p228 home · 71 ms
  - row “8 Share session” · stays · notice “Paste: not a number” · 238 ms
  - row “9 Clear history” · stays
  - row “0 Export” · stays
  - Android Back → p228 home · 1636 ms
  - tap outside → p228 home · 6 ms
- key menu → p233 home › menu:Home menu · Back → p228 · × → p228 · 13 ms
- key vars → p234 home › find:Vars · Back → p228 · × → p228 · 27 ms
- key math → p235 home › find:Find · Back → p228 · × → p228 · 12 ms
- key tmpl → p236 home › menu:Templates · Back → p228 · × → p228 · 137 ms
- key alpha → p237 home [alpha] · Back → p238 · 27 ms
- key shift → p239 home [shift] · Back → p238 · 29 ms
- Android Back → p238 Android: com.android.launcher3/.uioverrides.QuickstepLauncher
- line-hold · stays · line 1+2\times3+4\times5+6
- line-drag-side · stays
- pad-drag-right · stays
- bksp-hold · stays
- line-swipe-down → p240 home [folded] · Back → p228

### cas: p243 cas

- tap “Place: CAS. Tap to open the apps list.” → p244 cas › apps:Apps · Back → p243 · × → p243 · 44 ms
- tap “Angle unit: Radians. Tap to switch.” → p245 cas (a setting changed) · 19 ms
- tap “STD” → p246 cas › menu:Mode · Back → p243 · × → p243 · 287 ms
- tap “12” → p247 cas › menu:Mode › Significant digits · Back → p246 · × → p243 · 24 ms
- tap “Menu” → p248 cas › menu:CAS menu · Back → p243 · × → p243 · 327 ms
  - tap “Place: CAS. Tap to open the apps list.” → p244 cas › apps:Apps · Back → p243 · × → p243 · 66 ms
  - tap “Angle unit: Radians. Tap to switch.” → p257 cas › menu:CAS menu (a setting changed) · 4 ms
  - tap “STD” → p246 cas › menu:Mode · Back → p243 · × → p243 · 303 ms
  - tap “12” → p247 cas › menu:Mode › Significant digits · Back → p246 · × → p243 · 272 ms
  - tap “Menu” → p243 cas · 304 ms
  - key u1 → p243 cas · 6 ms
  - key u2 → p243 cas · 16 ms
  - key up → p243 cas · 7 ms
  - key menu → p243 cas · 12 ms
  - key esc → p243 cas · 3 ms
  - key u3 → p243 cas · 10 ms
  - key u4 → p243 cas · 2 ms
  - key left → p243 cas · 5 ms
  - key right → p243 cas · 2 ms
  - key undo → p243 cas · 4 ms
  - key redo → p243 cas · 2 ms
  - key u5 → p243 cas · 2 ms
  - key u6 → p243 cas · 10 ms
  - key down → p243 cas · 5 ms
  - key select → p243 cas · 2 ms
  - key deselect → p243 cas · 7 ms
  - tap “Settings” → p258 cas › menu:CAS menu › Settings · Back → p248 · × → p243 · 284 ms
  - tap “Close” → p243 cas · 7 ms
  - row “1 Insert” · stays
  - row “2 Recall” · stays
  - row “3 Copy” · stays
  - row “4 Store ▶” · stays
  - row “5 Delete” · stays
  - row “6 Copy as” · stays
  - row “7 Paste” → p243 cas · 114 ms
  - row “8 Share session” · stays · notice “Paste: not a number” · 230 ms
  - row “9 Clear history” · stays
  - row “0 Export” · stays
  - Android Back → p243 cas · 1615 ms
  - tap outside → p243 cas · 6 ms
- key menu → p248 cas › menu:CAS menu · Back → p243 · × → p243 · 37 ms
- key vars → p249 cas › find:Vars · Back → p243 · × → p243 · 41 ms
- key math → p250 cas › find:Find · Back → p243 · × → p243 · 43 ms
- key tmpl → p251 cas › menu:Templates · Back → p243 · × → p243 · 110 ms
- key alpha → p252 cas [alpha] · Back → p253 · 65 ms
- key shift → p254 cas [shift] · Back → p253 · 24 ms
- Android Back → p253 Android: com.android.launcher3/.uioverrides.QuickstepLauncher
- line-swipe-down → p255 cas [folded] · Back → p243
- mark-tap → p256 cas +credits › menu:N62 · Back → p243 · × → p243 · 126 ms

### function: p259 function/symb

- tap “Place: Function. Tap to open the apps list.” → p260 function/symb › apps:Apps · Back → p259 · × → p259 · 61 ms
- tap “Symb” · stays · line x^2-2
- tap “Plot” → p261 function/plot · 1413 ms
- tap “Num” → p262 function/num · 379 ms
- tap “Angle unit: Radians. Tap to switch.” → p263 function/symb (a setting changed) · 92 ms
- tap “STD” → p264 function/symb › menu:Mode · Back → p259 · × → p259 · 382 ms
- tap “12” → p265 function/symb › menu:Mode › Significant digits · Back → p264 · × → p259 · 36 ms
- tap “Menu” → p266 function/symb › menu:Symb menu · Back → p259 · × → p259 · 285 ms
  - tap “Place: Function. Tap to open the apps list.” → p260 function/symb › apps:Apps · Back → p259 · × → p259 · 0 ms
  - tap “Symb” → p259 function/symb · 67 ms
  - tap “Plot” → p261 function/plot · 2019 ms
  - tap “Num” → p262 function/num · 384 ms
  - tap “Angle unit: Radians. Tap to switch.” → p273 function/symb › menu:Symb menu (a setting changed) · 301 ms
  - tap “STD” → p264 function/symb › menu:Mode · Back → p259 · × → p259
  - tap “12” → p265 function/symb › menu:Mode › Significant digits · Back → p264 · × → p259
  - tap “Menu” → p259 function/symb · 411 ms
  - key u1 → p259 function/symb · 4 ms
  - key u2 → p259 function/symb · 2 ms
  - key up → p259 function/symb · 10 ms
  - key menu → p259 function/symb · 3 ms
  - key esc → p259 function/symb · 10 ms
  - key u3 → p259 function/symb · 15 ms
  - key u4 → p259 function/symb · 15 ms
  - key left → p259 function/symb · 2 ms
  - key right → p259 function/symb · 2 ms
  - key undo → p259 function/symb · 2 ms
  - key redo → p259 function/symb · 2 ms
  - key u5 → p259 function/symb · 5 ms
  - key u6 → p259 function/symb · 10 ms
  - key down → p259 function/symb · 21 ms
  - key select → p259 function/symb · 16 ms
  - key deselect → p259 function/symb · 4 ms
  - key vars → p259 function/symb · 2 ms
  - key math → p259 function/symb · 4 ms
  - key tmpl → p259 function/symb · 50 ms
  - key x → p259 function/symb · 2 ms
  - key frac → p259 function/symb · 5 ms
  - key bksp → p259 function/symb
  - key pow → p259 function/symb · 2 ms
  - key sin → p259 function/symb · 11 ms
  - key cos → p259 function/symb · 3 ms
  - key tan → p259 function/symb · 6 ms
  - key ln → p259 function/symb · 2 ms
  - key log → p259 function/symb · 12 ms
  - key sq → p259 function/symb · 2 ms
  - key neg → p259 function/symb · 2 ms
  - key paren → p259 function/symb · 4 ms
  - key comma → p259 function/symb · 2 ms
  - key enter → p259 function/symb · 3 ms
  - key emark → p259 function/symb · 12 ms
  - key d7 → p259 function/symb · 9 ms
  - key d8 → p259 function/symb · 2 ms
  - key d9 → p259 function/symb · 3 ms
  - key div → p259 function/symb · 1 ms
  - tap “Settings” → p274 function/symb › menu:Symb menu › Settings · Back → p266 · × → p259
  - tap “Close” → p259 function/symb · 9 ms
  - row “1 Clear” → p259 function/symb · 13 ms
  - row “2 Paste” → p259 function/symb · 373 ms
  - row “3 Root, extremum … in Plot” → p275 function/plot › menu:Plot menu · Back → p261 · × → p261 · 814 ms
    - tap “Place: Function. Tap to open the apps list.” → p276 function/plot › apps:Apps · Back → p261 · × → p261 · 38 ms
    - tap “Symb” → p259 function/symb · 267 ms
    - tap “Plot” → p261 function/plot · 257 ms
    - tap “Num” → p262 function/num · 424 ms
    - tap “Angle unit: Radians. Tap to switch.” → p277 function/plot › menu:Plot menu (a setting changed) · 350 ms
    - tap “STD” → p278 function/plot › menu:Mode · Back → p261 · × → p261
    - tap “12” → p279 function/plot › menu:Mode › Significant digits · Back → p278 · × → p261
    - tap “Menu” → p261 function/plot · 288 ms
    - key up → p261 function/plot · 4 ms
    - key menu → p261 function/plot · 6 ms
    - key esc → p261 function/plot · 4 ms
    - tap “Settings” → p280 function/plot › menu:Plot menu › Settings · Back → p275 · × → p261
    - tap “Close” → p261 function/plot · 280 ms
    - row “1 Root” → p261 function/plot · 779 ms
    - row “2 Extremum” → p261 function/plot · 841 ms
    - row “3 Intersection” → p281 function/plot › menu:Plot menu › Intersection of F1(x) and · Back → p275 · × → p261
      - tap “Place: Function. Tap to open the apps list.” → p276 function/plot › apps:Apps · Back → p261 · × → p261 · 64 ms
      - tap “Symb” → p259 function/symb · 324 ms
      - tap “Plot” → p261 function/plot · 281 ms
      - tap “Num” → p262 function/num · 340 ms
      - tap “Angle unit: Radians. Tap to switch.” → p282 function/plot › menu:Plot menu › Intersection of F1(x) and (a setting changed) · 360 ms
      - tap “STD” → p278 function/plot › menu:Mode · Back → p261 · × → p261
      - tap “12” → p279 function/plot › menu:Mode › Significant digits · Back → p278 · × → p261
      - tap “Menu” → p261 function/plot · 282 ms
      - key up → p261 function/plot · 3 ms
      - key menu → p261 function/plot · 3 ms
      - key esc → p275 function/plot › menu:Plot menu · Back → p261 · × → p261
      - tap “Back” → p275 function/plot › menu:Plot menu · Back → p261 · × → p261
      - tap “Close” → p261 function/plot · 280 ms
      - row “1 x-axis” → p261 function/plot · 622 ms
      - Android Back → p275 function/plot › menu:Plot menu
      - tap outside → p261 function/plot · 285 ms
    - row “4 Slope” → p261 function/plot · 603 ms
    - row “5 Signed area” → p261 function/plot · 315 ms
    - row “6 Default window” → p261 function/plot · 322 ms
    - row “7 Copy” · stays
    - row “8 Copy as shown” · stays
    - Android Back → p261 function/plot · 1740 ms
    - tap outside → p261 function/plot · 301 ms
  - Android Back → p259 function/symb · 1109 ms
  - tap outside → p259 function/symb · 280 ms
- tap “Show or hide” · stays · 5 ms
- tap “F1(x)= x2−2” · stays · line x^2-2
- tap “Show or hide” · stays · 7 ms
- tap “F2(x)=” · stays · 22 ms
- tap “Show or hide” · stays · 6 ms
- tap “F3(x)=” · stays · 19 ms
- tap “Show or hide” · stays · 12 ms
- tap “F4(x)=” · stays · 9 ms
- key menu → p266 function/symb › menu:Symb menu · Back → p259 · × → p259 · 59 ms
- key vars → p267 function/symb › find:Vars · Back → p259 · × → p259 · 66 ms
- key math → p268 function/symb › find:Find · Back → p259 · × → p259 · 73 ms
- key tmpl → p269 function/symb › menu:Templates · Back → p259 · × → p259 · 344 ms
- key alpha → p270 function/symb [alpha] · Back → p271 · 82 ms
- key shift → p272 function/symb [shift] · Back → p271 · 70 ms
- Android Back → p271 Android: com.android.launcher3/.uioverrides.QuickstepLauncher

### function-plot: p283 function/plot

- tap “Place: Function. Tap to open the apps list.” → p284 function/plot › apps:Apps · Back → p283 · × → p283 · 54 ms
- tap “Symb” → p285 function/symb · 38 ms
- tap “Plot” · stays
- tap “Num” → p286 function/num · 403 ms
- tap “Angle unit: Radians. Tap to switch.” → p287 function/plot (a setting changed) · 430 ms
- tap “STD” → p288 function/plot › menu:Mode · Back → p283 · × → p283 · 261 ms
- tap “12” → p289 function/plot › menu:Mode › Significant digits · Back → p288 · × → p283 · 23 ms
- tap “Menu” → p290 function/plot › menu:Plot menu · Back → p283 · × → p283 · 304 ms
  - tap “Place: Function. Tap to open the apps list.” → p284 function/plot › apps:Apps · Back → p283 · × → p283 · 65 ms
  - tap “Symb” → p285 function/symb · 352 ms
  - tap “Plot” → p283 function/plot · 286 ms
  - tap “Num” → p286 function/num · 449 ms
  - tap “Angle unit: Radians. Tap to switch.” → p294 function/plot › menu:Plot menu (a setting changed) · 314 ms
  - tap “STD” → p288 function/plot › menu:Mode · Back → p283 · × → p283
  - tap “12” → p289 function/plot › menu:Mode › Significant digits · Back → p288 · × → p283
  - tap “Menu” → p283 function/plot · 286 ms
  - key u1 → p283 function/plot · 20 ms
  - key u2 → p283 function/plot · 13 ms
  - key up → p283 function/plot · 6 ms
  - key menu → p283 function/plot · 3 ms
  - key esc → p283 function/plot · 3 ms
  - key u3 → p283 function/plot · 13 ms
  - key u4 → p283 function/plot · 3 ms
  - key left → p283 function/plot · 2 ms
  - key right → p283 function/plot · 2 ms
  - key undo → p283 function/plot · 2 ms
  - key redo → p283 function/plot · 2 ms
  - key u5 → p283 function/plot · 2 ms
  - key u6 → p283 function/plot · 2 ms
  - key down → p283 function/plot · 6 ms
  - key select → p283 function/plot · 9 ms
  - key deselect → p283 function/plot · 7 ms
  - tap “Settings” → p295 function/plot › menu:Plot menu › Settings · Back → p290 · × → p283
  - tap “Close” → p283 function/plot · 6 ms
  - row “1 Root” → p283 function/plot · 359 ms
  - row “2 Extremum” → p283 function/plot · 208 ms
  - row “3 Intersection” → p296 function/plot › menu:Plot menu › Intersection of F1(x) and · Back → p290 · × → p283
    - tap “Place: Function. Tap to open the apps list.” → p284 function/plot › apps:Apps · Back → p283 · × → p283 · 65 ms
    - tap “Symb” → p285 function/symb · 52 ms
    - tap “Plot” → p283 function/plot · 286 ms
    - tap “Num” → p286 function/num · 391 ms
    - tap “Angle unit: Radians. Tap to switch.” → p297 function/plot › menu:Plot menu › Intersection of F1(x) and (a setting changed) · 411 ms
    - tap “STD” → p288 function/plot › menu:Mode · Back → p283 · × → p283
    - tap “12” → p289 function/plot › menu:Mode › Significant digits · Back → p288 · × → p283
    - tap “Menu” → p283 function/plot · 300 ms
    - key up → p283 function/plot · 2 ms
    - key menu → p283 function/plot · 2 ms
    - key esc → p290 function/plot › menu:Plot menu · Back → p283 · × → p283
    - tap “Back” → p290 function/plot › menu:Plot menu · Back → p283 · × → p283
    - tap “Close” → p283 function/plot · 288 ms
    - row “1 x-axis” → p283 function/plot · 453 ms
    - Android Back → p290 function/plot › menu:Plot menu
    - tap outside → p283 function/plot · 246 ms
  - row “4 Slope” → p283 function/plot · 213 ms
  - row “5 Signed area” → p283 function/plot · 24 ms
  - row “6 Default window” → p283 function/plot · 45 ms
  - row “7 Copy” · stays
  - row “8 Copy as shown” · stays
  - Android Back → p283 function/plot · 1594 ms
  - tap outside → p283 function/plot · 5 ms
- key menu → p290 function/plot › menu:Plot menu · Back → p283 · × → p283 · 86 ms
- key alpha → p291 function/plot [alpha] · Back → p292 · 90 ms
- key shift → p293 function/plot [shift] · Back → p292 · 74 ms
- Android Back → p292 Android: com.android.launcher3/.uioverrides.QuickstepLauncher
- plot-pan · stays
- plot-tap · stays · 145 ms
- plot-pinch-out · stays

### function-num: p298 function/num

- tap “Place: Function. Tap to open the apps list.” → p299 function/num › apps:Apps · Back → p298 · × → p298 · 79 ms
- tap “Symb” → p300 function/symb · 77 ms
- tap “Plot” → p301 function/plot · 1017 ms
- tap “Num” · stays
- tap “Angle unit: Radians. Tap to switch.” → p302 function/num (a setting changed) · 291 ms
- tap “STD” → p303 function/num › menu:Mode · Back → p298 · × → p298 · 333 ms
- tap “12” → p304 function/num › menu:Mode › Significant digits · Back → p303 · × → p298 · 69 ms
- tap “Menu” → p305 function/num › menu:Num menu · Back → p298 · × → p298 · 326 ms
  - tap “Place: Function. Tap to open the apps list.” → p299 function/num › apps:Apps · Back → p298 · × → p298 · 0 ms
  - tap “Symb” → p300 function/symb · 377 ms
  - tap “Plot” → p301 function/plot · 1387 ms
  - tap “Num” → p298 function/num · 293 ms
  - tap “Angle unit: Radians. Tap to switch.” → p312 function/num › menu:Num menu (a setting changed) · 356 ms
  - tap “STD” → p303 function/num › menu:Mode · Back → p298 · × → p298
  - tap “12” → p304 function/num › menu:Mode › Significant digits · Back → p303 · × → p298
  - tap “Menu” → p298 function/num · 148 ms
  - key u1 → p298 function/num · 10 ms
  - key u2 → p298 function/num · 7 ms
  - key up → p298 function/num · 6 ms
  - key menu → p298 function/num · 4 ms
  - key esc → p298 function/num · 6 ms
  - key u3 → p298 function/num · 32 ms
  - key u4 → p298 function/num · 3 ms
  - key left → p298 function/num · 3 ms
  - key right → p298 function/num · 4 ms
  - key undo → p298 function/num · 1 ms
  - key redo → p298 function/num · 2 ms
  - key u5 → p298 function/num · 2 ms
  - key u6 → p298 function/num · 2 ms
  - key down → p298 function/num · 2 ms
  - key select → p298 function/num · 2 ms
  - key deselect → p298 function/num · 3 ms
  - key vars → p298 function/num · 2 ms
  - key math → p298 function/num · 1 ms
  - key tmpl → p298 function/num · 1 ms
  - key x → p298 function/num · 2 ms
  - key frac → p298 function/num · 2 ms
  - key bksp → p298 function/num
  - key pow → p298 function/num · 6 ms
  - key sin → p298 function/num · 2 ms
  - key cos → p298 function/num · 2 ms
  - key tan → p298 function/num · 3 ms
  - key ln → p298 function/num · 2 ms
  - key log → p298 function/num · 2 ms
  - key sq → p298 function/num · 9 ms
  - key neg → p298 function/num · 3 ms
  - key paren → p298 function/num · 2 ms
  - key comma → p298 function/num · 3 ms
  - key enter → p298 function/num · 9 ms
  - tap “Settings” → p313 function/num › menu:Num menu › Settings · Back → p305 · × → p298
  - tap “Close” → p298 function/num · 7 ms
  - row “1 Start value” → p298 function/num · 14 ms
  - row “2 Step” → p298 function/num · 29 ms
  - row “3 Copy table as CSV” → p298 function/num · 104 ms
  - row “4 Paste” → p298 function/num · 1164 ms
  - Android Back → p298 function/num · 2232 ms
  - tap outside → p298 function/num · 14 ms
- key menu → p305 function/num › menu:Num menu · Back → p298 · × → p298 · 24 ms
- key vars → p306 function/num › find:Vars · Back → p298 · × → p298 · 82 ms
- key math → p307 function/num › find:Find · Back → p298 · × → p298 · 13 ms
- key tmpl → p308 function/num › menu:Templates · Back → p298 · × → p298 · 311 ms
- key alpha → p309 function/num [alpha] · Back → p310 · 71 ms
- key shift → p311 function/num [shift] · Back → p310 · 268 ms
- Android Back → p310 Android: com.android.launcher3/.uioverrides.QuickstepLauncher

### solve: p314 solve/symb

- tap “Place: Solve. Tap to open the apps list.” → p315 solve/symb › apps:Apps · Back → p314 · × → p314 · 69 ms
- tap “Symb” · stays
- tap “Num” → p316 solve/num · 9 ms
- tap “Angle unit: Radians. Tap to switch.” → p317 solve/symb (a setting changed) · 283 ms
- tap “STD” → p318 solve/symb › menu:Mode · Back → p314 · × → p314 · 291 ms
- tap “12” → p319 solve/symb › menu:Mode › Significant digits · Back → p318 · × → p314 · 24 ms
- tap “Menu” → p320 solve/symb › menu:Symb menu · Back → p314 · × → p314 · 311 ms
  - tap “Place: Solve. Tap to open the apps list.” → p315 solve/symb › apps:Apps · Back → p314 · × → p314 · 64 ms
  - tap “Symb” → p314 solve/symb · 294 ms
  - tap “Num” → p316 solve/num · 291 ms
  - tap “Angle unit: Radians. Tap to switch.” → p327 solve/symb › menu:Symb menu (a setting changed) · 287 ms
  - tap “STD” → p318 solve/symb › menu:Mode · Back → p314 · × → p314
  - tap “12” → p319 solve/symb › menu:Mode › Significant digits · Back → p318 · × → p314
  - tap “Menu” → p314 solve/symb · 281 ms
  - key u1 → p314 solve/symb · 2 ms
  - key u2 → p314 solve/symb · 1 ms
  - key up → p314 solve/symb · 2 ms
  - key menu → p314 solve/symb · 2 ms
  - key esc → p314 solve/symb · 1 ms
  - key u3 → p314 solve/symb · 2 ms
  - key u4 → p314 solve/symb · 2 ms
  - key left → p314 solve/symb · 3 ms
  - key right → p314 solve/symb · 2 ms
  - key undo → p314 solve/symb · 2 ms
  - key redo → p314 solve/symb · 1 ms
  - key u5 → p314 solve/symb · 2 ms
  - key u6 → p314 solve/symb · 4 ms
  - key down → p314 solve/symb · 1 ms
  - key select → p314 solve/symb · 2 ms
  - key deselect → p314 solve/symb · 1 ms
  - key vars → p314 solve/symb · 1 ms
  - key math → p314 solve/symb · 1 ms
  - key tmpl → p314 solve/symb · 2 ms
  - key x → p314 solve/symb · 1 ms
  - key frac → p314 solve/symb · 1 ms
  - key bksp → p314 solve/symb
  - key pow → p314 solve/symb · 1 ms
  - key sin → p314 solve/symb · 1 ms
  - key cos → p314 solve/symb · 1 ms
  - key tan → p314 solve/symb · 1 ms
  - key ln → p314 solve/symb · 1 ms
  - key log → p314 solve/symb · 1 ms
  - key sq → p314 solve/symb · 1 ms
  - key neg → p314 solve/symb · 1 ms
  - key paren → p314 solve/symb · 2 ms
  - key comma → p314 solve/symb · 2 ms
  - key enter → p314 solve/symb · 2 ms
  - tap “Settings” → p328 solve/symb › menu:Symb menu › Settings · Back → p320 · × → p314
  - tap “Close” → p314 solve/symb · 6 ms
  - row “1 Clear” · stays
  - row “2 Paste” → p314 solve/symb · 181 ms
  - row “3 Solve, polynomial roots … in Num” → p329 solve/num › menu:Num menu · Back → p316 · × → p316 · 237 ms
    - tap “Place: Solve. Tap to open the apps list.” → p330 solve/num › apps:Apps · Back → p316 · × → p316 · 60 ms
    - tap “Symb” → p314 solve/symb · 304 ms
    - tap “Num” → p316 solve/num · 289 ms
    - tap “Angle unit: Radians. Tap to switch.” → p331 solve/num › menu:Num menu (a setting changed) · 287 ms
    - tap “STD” → p332 solve/num › menu:Mode · Back → p316 · × → p316
    - tap “12” → p333 solve/num › menu:Mode › Significant digits · Back → p332 · × → p316
    - tap “Menu” → p316 solve/num · 288 ms
    - key up → p316 solve/num · 4 ms
    - key menu → p316 solve/num · 4 ms
    - key esc → p316 solve/num · 7 ms
    - tap “Settings” → p334 solve/num › menu:Num menu › Settings · Back → p329 · × → p316
    - tap “Close” → p316 solve/num · 288 ms
    - row “1 Solve” · stays
    - row “2 Polynomial roots” · stays
    - row “3 Copy” · stays
    - row “4 Copy as shown” · stays
    - row “5 To Home” · stays
    - Android Back → p316 solve/num · 1626 ms
    - tap outside → p316 solve/num · 287 ms
  - Android Back → p314 solve/symb · 703 ms
  - tap outside → p314 solve/symb · 279 ms
- tap “Show or hide” · stays · 5 ms
- tap “E1:” · stays
- tap “Show or hide” · stays · 6 ms
- tap “E2:” · stays · 24 ms
- tap “Show or hide” · stays · 5 ms
- tap “E3:” · stays · 11 ms
- tap “Show or hide” · stays · 4 ms
- tap “E4:” · stays · 8 ms
- key menu → p320 solve/symb › menu:Symb menu · Back → p314 · × → p314 · 22 ms
- key vars → p321 solve/symb › find:Vars · Back → p314 · × → p314 · 16 ms
- key math → p322 solve/symb › find:Find · Back → p314 · × → p314 · 21 ms
- key tmpl → p323 solve/symb › menu:Templates · Back → p314 · × → p314 · 106 ms
- key alpha → p324 solve/symb [alpha] · Back → p325 · 46 ms
- key shift → p326 solve/symb [shift] · Back → p325 · 42 ms
- Android Back → p325 Android: com.android.launcher3/.uioverrides.QuickstepLauncher

### units: p335 home [unit view]

- tap “Place: Home. Tap to open the apps list.” → p336 home › apps:Apps · Back → p337 · × → p337 · 187 ms
- tap “Angle unit: Radians. Tap to switch.” → p338 home [unit view] (a setting changed) · 286 ms
- tap “STD” → p339 home [unit view] › menu:Mode · Back → p335 · × → p335 · 321 ms
- tap “12” → p340 home [unit view] › menu:Mode › Significant digits · Back → p339 · × → p335 · 38 ms
- tap “Menu” · stays · 59 ms
- key esc → p337 home · 20 ms
- key math → p341 home [unit view] › find:Find · Back → p335 · × → p335 · 125 ms
- key alpha → p342 home [alpha] [unit view] · Back → p343 · 31 ms
- key shift → p344 home [shift] [unit view] · Back → p343 · 25 ms
- Android Back → p343 Android: com.android.launcher3/.uioverrides.QuickstepLauncher

### folded: p345 home [folded]

- tap “Place: Home. Tap to open the apps list.” → p346 home [folded] › apps:Apps · Back → p345 · × → p345 · 58 ms
- tap “Angle unit: Radians. Tap to switch.” → p347 home [folded] (a setting changed) · 15 ms
- tap “STD” → p348 home [folded] › menu:Mode · Back → p345 · × → p345 · 333 ms
- tap “12” → p349 home [folded] › menu:Mode › Significant digits · Back → p348 · × → p345 · 21 ms
- tap “Menu” → p350 home [folded] › menu:Home menu · Back → p345 · × → p345 · 288 ms
  - tap “Place: Home. Tap to open the apps list.” → p346 home [folded] › apps:Apps · Back → p345 · × → p345 · 298 ms
  - tap “Angle unit: Radians. Tap to switch.” → p354 home [folded] › menu:Home menu (a setting changed) · 290 ms
  - tap “STD” → p348 home [folded] › menu:Mode · Back → p345 · × → p345 · 297 ms
  - tap “12” → p349 home [folded] › menu:Mode › Significant digits · Back → p348 · × → p345 · 345 ms
  - tap “Menu” → p345 home [folded] · 330 ms
  - tap “Settings” → p355 home [folded] › menu:Home menu › Settings · Back → p350 · × → p345 · 297 ms
  - tap “Close” → p345 home [folded] · 10 ms
  - row “1 Insert” → p353 home · 21 ms
  - row “2 Recall” → p353 home · 380 ms
  - row “3 Copy” → p345 home [folded] · 216 ms
  - row “4 Store ▶” → p356 home › store:Store ≈ 0.333333333333 in · Back → p353 · × → p353 · 403 ms
  - row “5 Delete” → p345 home [folded] · 277 ms
  - row “6 Copy as” → p357 home [folded] › menu:Home menu › Copy as · Back → p350 · × → p345 · 294 ms
    - tap “Place: Home. Tap to open the apps list.” → p346 home [folded] › apps:Apps · Back → p345 · × → p345 · 286 ms
    - tap “Angle unit: Radians. Tap to switch.” → p362 home [folded] › menu:Home menu › Copy as (a setting changed) · 295 ms
    - tap “STD” → p348 home [folded] › menu:Mode · Back → p345 · × → p345 · 306 ms
    - tap “12” → p349 home [folded] › menu:Mode › Significant digits · Back → p348 · × → p345 · 291 ms
    - tap “Menu” → p345 home [folded] · 286 ms
    - tap “Back” → p350 home [folded] › menu:Home menu · Back → p345 · × → p345 · 303 ms
    - tap “Close” → p345 home [folded] · 286 ms
    - row “1 As shown” → p345 home [folded] · 403 ms
    - row “2 Exact” → p345 home [folded] · 502 ms
    - row “3 LaTeX” → p345 home [folded] · 205 ms
    - row “4 Python” → p345 home [folded] · 396 ms
    - tap “Show keypad” → p363 home › menu:Home menu › Copy as · 33 ms
      - tap “Place: Home. Tap to open the apps list.” → p364 home › apps:Apps · Back → p353 · × → p353 · 60 ms
      - tap “Angle unit: Radians. Tap to switch.” → p379 home › menu:Home menu › Copy as (a setting changed) · 298 ms
      - tap “STD” → p366 home › menu:Mode · Back → p353 · × → p353
      - tap “12” → p367 home › menu:Mode › Significant digits · Back → p366 · × → p353
      - tap “Menu” → p353 home · 292 ms
      - tap “Back” → p358 home › menu:Home menu · Back → p353 · × → p353
        - tap “Place: Home. Tap to open the apps list.” → p364 home › apps:Apps · Back → p353 · × → p353 · 294 ms
        - tap “Angle unit: Radians. Tap to switch.” → p365 home › menu:Home menu (a setting changed) · 290 ms
        - tap “STD” → p366 home › menu:Mode · Back → p353 · × → p353 · 311 ms
        - tap “12” → p367 home › menu:Mode › Significant digits · Back → p366 · × → p353 · 302 ms
        - tap “Menu” → p353 home · 298 ms
        - tap “Settings” → p368 home › menu:Home menu › Settings · Back → p358 · × → p353 · 299 ms
        - tap “Close” → p353 home · 297 ms
        - row “1 Insert” → p353 home · 270 ms
        - row “2 Recall” → p353 home · 306 ms
        - row “3 Copy” → p353 home · 319 ms
        - row “4 Store ▶” → p356 home › store:Store ≈ 0.333333333333 in · Back → p353 · × → p353 · 317 ms
        - row “5 Delete” → p353 home · 292 ms
        - row “6 Copy as” → p363 home › menu:Home menu › Copy as · Back → p358 · × → p353 · 294 ms
        - row “7 Paste” → p353 home · 298 ms
        - row “8 Share session” → p353 home · 276 ms
        - row “9 Clear history” → p353 home · 299 ms
        - row “0 Export” → p369 home › menu:Home menu › Export · Back → p358 · × → p353 · 289 ms
          - tap “Place: Home. Tap to open the apps list.” → p364 home › apps:Apps · Back → p353 · × → p353 · 64 ms
          - tap “Angle unit: Radians. Tap to switch.” → p380 home › menu:Home menu › Export (a setting changed) · 300 ms
          - tap “STD” → p366 home › menu:Mode · Back → p353 · × → p353
          - tap “12” → p367 home › menu:Mode › Significant digits · Back → p366 · × → p353
          - tap “Menu” → p353 home · 308 ms
          - tap “Back” → p358 home › menu:Home menu · Back → p353 · × → p353
          - tap “Close” → p353 home · 283 ms
          - row “1 Work report” → p353 home · 352 ms
          - row “2 CSV” → p353 home · 393 ms
          - row “3 LaTeX” → p353 home · 200 ms
          - row “4 Python” → p353 home · 330 ms
          - Android Back → p358 home › menu:Home menu · 186 ms
          - tap outside → p353 home · 248 ms
        - Android Back → p353 home · 1600 ms
        - tap outside → p353 home · 287 ms
      - tap “Close” → p353 home · 288 ms
      - row “1 As shown” → p353 home · 401 ms
      - row “2 Exact” → p353 home · 359 ms
      - row “3 LaTeX” → p353 home · 347 ms
      - row “4 Python” → p353 home · 355 ms
      - Android Back → p358 home › menu:Home menu · 26 ms
      - tap outside → p353 home · 289 ms
    - Android Back → p350 home [folded] › menu:Home menu · 565 ms
    - tap outside → p345 home [folded] · 288 ms
  - row “7 Paste” → p345 home [folded] · 43 ms
  - row “8 Share session” → p345 home [folded] · 6 ms
  - row “9 Clear history” → p345 home [folded] · 1349 ms
  - row “0 Export” · stays · notice “Shared” · 133 ms
  - tap “Show keypad” → p358 home › menu:Home menu · 35 ms
  - Android Back → p345 home [folded] · 753 ms
  - tap outside → p345 home [folded] · 286 ms
- tap “31​” → p351 home [folded] +row-actions · Back → p352 · 8 ms
  - tap “Place: Home. Tap to open the apps list.” → p346 home [folded] › apps:Apps · Back → p345 · × → p345 · 300 ms
  - tap “Angle unit: Radians. Tap to switch.” → p359 home [folded] +row-actions (a setting changed) · 304 ms
  - tap “STD” → p348 home [folded] › menu:Mode · Back → p345 · × → p345 · 320 ms
  - tap “12” → p349 home [folded] › menu:Mode › Significant digits · Back → p348 · × → p345 · 308 ms
  - tap “Menu” → p360 home [folded] › menu:Menu · Back → p345 · × → p345 · 290 ms
    - tap “Place: Home. Tap to open the apps list.” → p346 home [folded] › apps:Apps · Back → p345 · × → p345 · 278 ms
    - tap “Angle unit: Radians. Tap to switch.” → p370 home [folded] › menu:Menu (a setting changed) · 293 ms
    - tap “STD” → p348 home [folded] › menu:Mode · Back → p345 · × → p345 · 304 ms
    - tap “12” → p349 home [folded] › menu:Mode › Significant digits · Back → p348 · × → p345 · 296 ms
    - tap “Menu” → p345 home [folded] · 307 ms
    - tap “Settings” → p371 home [folded] › menu:Menu › Settings · Back → p360 · × → p345 · 295 ms
    - tap “Close” → p345 home [folded] · 3 ms
    - row “1 Insert” → p353 home · 19 ms
    - row “2 Recall” → p353 home · 300 ms
    - row “3 Copy” → p345 home [folded] · 351 ms
    - row “4 Store ▶” → p356 home › store:Store ≈ 0.333333333333 in · Back → p353 · × → p353 · 513 ms
    - row “5 Delete” → p345 home [folded] · 301 ms
    - row “6 Copy as” → p372 home [folded] › menu:Menu › Copy as · Back → p360 · × → p345 · 289 ms
      - tap “Place: Home. Tap to open the apps list.” → p346 home [folded] › apps:Apps · Back → p345 · × → p345 · 240 ms
      - tap “Angle unit: Radians. Tap to switch.” → p381 home [folded] › menu:Menu › Copy as (a setting changed) · 340 ms
      - tap “STD” → p348 home [folded] › menu:Mode · Back → p345 · × → p345 · 328 ms
      - tap “12” → p349 home [folded] › menu:Mode › Significant digits · Back → p348 · 306 ms
    - row “7 Paste” → p345 home [folded] · 28 ms
    - row “8 Share session” → p345 home [folded] · 12 ms
    - row “9 Clear history” → p345 home [folded] · 541 ms
    - row “0 Export” → p373 home [folded] › menu:Menu › Export · Back → p360 · × → p345 · 291 ms
      - tap “Place: Home. Tap to open the apps list.” → p346 home [folded] › apps:Apps · Back → p345 · × → p345 · 297 ms
      - tap “Angle unit: Radians. Tap to switch.” → p382 home [folded] › menu:Menu › Export (a setting changed) · 296 ms
      - tap “STD” → p348 home [folded] › menu:Mode · Back → p345 · × → p345 · 310 ms
      - tap “12” → p349 home [folded] › menu:Mode › Significant digits · Back → p348 · × → p345 · 292 ms
      - tap “Menu” → p345 home [folded] · 283 ms
      - tap “Back” → p360 home [folded] › menu:Menu · Back → p345 · × → p345 · 301 ms
      - tap “Close” → p345 home [folded] · 283 ms
      - row “1 Work report” → p345 home [folded] · 322 ms
      - row “2 CSV” → p345 home [folded] · 289 ms
      - row “3 LaTeX” → p345 home [folded] · 287 ms
      - row “4 Python” → p345 home [folded] · 306 ms
      - tap “Show keypad” → p383 home › menu:Menu › Export · 32 ms
      - Android Back → p360 home [folded] › menu:Menu · 521 ms
      - tap outside → p345 home [folded] · 293 ms
    - tap “Show keypad” → p374 home › menu:Menu · 26 ms
      - tap “Place: Home. Tap to open the apps list.” → p364 home › apps:Apps · Back → p353 · × → p353 · 360 ms
      - tap “Angle unit: Radians. Tap to switch.” → p384 home › menu:Menu (a setting changed) · 343 ms
      - tap “STD” → p366 home › menu:Mode · Back → p353 · × → p353 · 466 ms
      - tap “12” → p367 home › menu:Mode › Significant digits · Back → p366 · × → p353 · 312 ms
      - tap “Menu” → p353 home · 286 ms
      - tap “Settings” → p385 home › menu:Menu › Settings · Back → p374 · × → p353 · 370 ms
      - tap “Close” → p353 home · 298 ms
      - row “1 Insert” → p353 home · 436 ms
      - row “2 Recall” → p353 home · 35 ms
      - row “3 Copy” → p353 home · 804 ms
      - row “4 Store ▶” → p356 home › store:Store ≈ 0.333333333333 in · Back → p353 · × → p353 · 678 ms
      - row “5 Delete” → p353 home · 77 ms
      - row “6 Copy as” → p386 home › menu:Menu › Copy as · Back → p374 · × → p353 · 354 ms
      - row “7 Paste” → p353 home · 363 ms
      - row “8 Share session” → p353 home · 422 ms
      - row “9 Clear history” → p353 home · 270 ms
      - row “0 Export” → p383 home › menu:Menu › Export · Back → p374 · × → p353 · 130 ms
      - Android Back → p353 home · 1585 ms
      - tap outside → p353 home · 393 ms
    - Android Back → p345 home [folded] · 885 ms
    - tap outside → p345 home [folded] · 285 ms
  - tap “31​” → p353 home · 9 ms
  - tap “≈ 0.333333333333” → p353 home · 18 ms
  - tap “0.333333333333” → p353 home · 19 ms
  - tap “Store ▶” → p356 home › store:Store ≈ 0.333333333333 in · Back → p353 · × → p353 · 369 ms
  - tap “Copy as ›” → p361 home [folded] › menu:Copy as · Back → p345 · × → p345 · 315 ms
    - tap “Place: Home. Tap to open the apps list.” → p346 home [folded] › apps:Apps · Back → p345 · × → p345 · 285 ms
    - tap “Angle unit: Radians. Tap to switch.” → p375 home [folded] › menu:Copy as (a setting changed) · 297 ms
    - tap “STD” → p348 home [folded] › menu:Mode · Back → p345 · × → p345 · 306 ms
    - tap “12” → p349 home [folded] › menu:Mode › Significant digits · Back → p348 · × → p345 · 285 ms
    - tap “Menu” → p345 home [folded] · 290 ms
    - tap “Close” → p345 home [folded] · 287 ms
    - row “1 As shown” → p345 home [folded] · 346 ms
    - row “2 Exact” → p345 home [folded] · 28 ms
    - row “3 LaTeX” → p345 home [folded] · 659 ms
    - row “4 Python” → p345 home [folded] · 607 ms
    - tap “Show keypad” → p376 home › menu:Copy as · 51 ms
      - tap “Place: Home. Tap to open the apps list.” → p364 home › apps:Apps · Back → p353 · × → p353 · 69 ms
      - tap “Angle unit: Radians. Tap to switch.” → p387 home › menu:Copy as (a setting changed) · 326 ms
      - tap “STD” → p366 home › menu:Mode · Back → p353 · × → p353
      - tap “12” → p367 home › menu:Mode › Significant digits · Back → p366 · × → p353
      - tap “Menu” → p353 home · 294 ms
    - Android Back → p345 home [folded] · 563 ms
    - tap outside → p345 home [folded] · 290 ms
  - tap “Show keypad” → p352 home +row-actions
    - tap “Place: Home. Tap to open the apps list.” → p364 home › apps:Apps · Back → p353 · × → p353 · 296 ms
    - tap “Angle unit: Radians. Tap to switch.” → p377 home +row-actions (a setting changed) · 298 ms
    - tap “STD” → p366 home › menu:Mode · Back → p353 · × → p353 · 319 ms
    - tap “12” → p367 home › menu:Mode › Significant digits · Back → p366 · × → p353 · 322 ms
    - tap “Menu” → p374 home › menu:Menu · Back → p353 · × → p353 · 315 ms
    - tap “31​” → p353 home · 10 ms
    - tap “≈ 0.333333333333” → p353 home · 24 ms
    - tap “0.333333333333” → p353 home · 12 ms
    - tap “Store ▶” → p356 home › store:Store ≈ 0.333333333333 in · Back → p353 · × → p353 · 338 ms
    - tap “Copy as ›” → p376 home › menu:Copy as · Back → p353 · × → p353 · 309 ms
    - Android Back → p378 Android: com.android.launcher3/.uioverrides.QuickstepLauncher
  - Android Back → p352 home +row-actions · 11 ms
- tap “≈ 0.333333333333” → p351 home [folded] +row-actions · Back → p352 · 11 ms
- tap “0.333333333333” → p351 home [folded] +row-actions · Back → p352 · 21 ms
- tap “Show keypad” → p353 home
- Android Back → p353 home
- slice-swipe-up → p353 home
- row-tap-twice → p353 home · 20 ms
- row-hold-result · stays · notice “Copied”
- row-swipe-left · stays · 172 ms

### phone: the keys in each view

#### home

| key | spec tap | tap | flick ↑ (the Shift layer) | flick ↓ (the Alpha layer) |
|---|---|---|---|---|
| u1 (＋) | special none | · |  |  |
| u2 (＋) | special none | · |  |  |
| up (▲) | cmd moveUp | · |  |  |
| menu (☰) | special menu | → p008 Home menu | → p025 Mode › Settings | → p008 Home menu |
| esc (Esc) | special esc | · | · | · |
| u3 (＋) | special none | · |  |  |
| u4 (＋) | special none | · |  |  |
| left (◀) | cmd moveToPreviousChar | · |  |  |
| right (▶) | cmd moveToNextChar | · |  |  |
| undo (Undo) | cmd undo | · | · | · |
| redo (Redo) | cmd redo | · | · | · |
| u5 (＋) | special none | · |  |  |
| u6 (＋) | special none | · |  |  |
| down (▼) | cmd moveDown | · |  |  |
| select (Select) | special selectGrow | · | → p010 Find | · |
| deselect (Deselect) | special selectShrink | · | → p006 Mode | · |
| vars (Vars) | special vars | → p009 Vars | “The clipboard is not availab” | `A` |
| math (Math) | special find | → p010 Find | → p017 Memory | `B` |
| tmpl (Tmpl) | special tmpl | → p011 Templates | → p018 [unit view] | `C` |
| x (x) | type x | `x` | `y` | `D` |
| frac (a b/c) | insert \frac{#@}{#?} | · | · | `E` |
| bksp (⌫) | cmd deleteBackward | · | · | · |
| pow (xʸ) | insert #@^{#?} | `\placeholder{}^{\placeholder` | `\sqrt[\placeholder{}]{\place` | `F` |
| sin (sin) | insert \sin\left(#0\right) | `\sin\left(\placeholder{}\rig` | `\arcsin\left(\placeholder{}\` | `G` |
| cos (cos) | insert \cos\left(#0\right) | `\cos\left(\placeholder{}\rig` | `\arccos\left(\placeholder{}\` | `H` |
| tan (tan) | insert \tan\left(#0\right) | `\tan\left(\placeholder{}\rig` | `\arctan\left(\placeholder{}\` | `I` |
| ln (ln) | insert \ln\left(#0\right) | `\ln\left(\placeholder{}\righ` | `\exponentialE^{\placeholder{` | `J` |
| log (log) | insert \log\left(#0\right) | `\log\left(\placeholder{}\rig` | `10^{\placeholder{}}` | `K` |
| sq (x²) | insert #@^{2} | `\placeholder{}^2` | `\sqrt{\placeholder{}}` | `L` |
| neg ((−)) | type - | `-` | `\left\|\placeholder{}\right\|` | `M` |
| paren (( )) | insert \left(#0\right) | `\left(\placeholder{}\right)` | `\operatorname{\mathrm{par}}\` | `N` |
| comma (,) | type , | `,` | `\pm` | `O` |
| enter (Enter) | special enter | · | `\operatorname{\mathrm{approx` | · |
| emark (ᴇ) | insert \emark | `1\emark` | → p019 Store in | `P` |
| d7 (7) | type 7 | `7` | · | `Q` |
| d8 (8) | type 8 | `8` | `\left\{\placeholder{}\right\` | `R` |
| d9 (9) | type 9 | `9` | → p020 Symbols and Greek | `S` |
| div (÷) | insert \frac{#@}{#?} | `\frac{\placeholder{}}{\place` | `\placeholder{}^{-1}` | `T` |
| alpha (alpha) | special alpha | → p012 [alpha] | → p023 [alpha-lock] | → p023 [alpha-lock] |
| d4 (4) | type 4 | `4` | → p021 Matrix | `U` |
| d5 (5) | type 5 | `5` | `\begin{pmatrix}\placeholder{` | `V` |
| d6 (6) | type 6 | `6` | → p022 Relations and logic | `W` |
| mul (×) | insert \times | `\times` | `\mathbin{\measuredangle}` | `X` |
| shift (shift) | special shift | → p014 [shift] | → p024 [shift-lock] | · |
| d1 (1) | type 1 | `1` | · | `Y` |
| d2 (2) | type 2 | `2` | `\imaginaryI` | `Z` |
| d3 (3) | type 3 | `3` | `\pi` | `\#` |
| sub (−) | type - | `-` | · | `:` |
| fmt (Fmt) | special fmt | · | · | · |
| d0 (0) | type 0 | `0` | `\%` | · |
| dot (.) | type . | `.` | `=` | `.` |
| space (␣) | type   | · | `_{}` | · |
| add (+) | type + | `+` | `\ans` | `;` |

`·` = nothing changed on screen (a cursor move on an empty line, or a dead key); `→ pNNN` = a new state; a code span is what the line holds after the key.

#### home-rows

| key | spec tap | tap |
|---|---|---|
| u1 (＋) | special none |  |
| u2 (＋) | special none |  |
| up (▲) | cmd moveUp | → p181 +row-actions |
| menu (☰) | special menu | → p180 Home menu |
| esc (Esc) | special esc | · |
| u3 (＋) | special none |  |
| u4 (＋) | special none |  |
| left (◀) | cmd moveToPreviousChar | · |
| right (▶) | cmd moveToNextChar | · |
| undo (Undo) | cmd undo | `\frac13` |
| redo (Redo) | cmd redo | · |
| u5 (＋) | special none |  |
| u6 (＋) | special none |  |
| down (▼) | cmd moveDown | · |
| select (Select) | special selectGrow | · |
| deselect (Deselect) | special selectShrink | · |
| vars (Vars) | special vars | → p183 Vars |
| math (Math) | special find | → p184 Find |
| tmpl (Tmpl) | special tmpl | → p185 Templates |
| x (x) | type x |  |
| frac (a b/c) | insert \frac{#@}{#?} | · |
| bksp (⌫) | cmd deleteBackward | · |
| pow (xʸ) | insert #@^{#?} |  |
| sin (sin) | insert \sin\left(#0\right) |  |
| cos (cos) | insert \cos\left(#0\right) |  |
| tan (tan) | insert \tan\left(#0\right) |  |
| ln (ln) | insert \ln\left(#0\right) |  |
| log (log) | insert \log\left(#0\right) |  |
| sq (x²) | insert #@^{2} |  |
| neg ((−)) | type - |  |
| paren (( )) | insert \left(#0\right) |  |
| comma (,) | type , |  |
| enter (Enter) | special enter | · |
| emark (ᴇ) | insert \emark | `1\emark` |
| d7 (7) | type 7 |  |
| d8 (8) | type 8 |  |
| d9 (9) | type 9 |  |
| div (÷) | insert \frac{#@}{#?} |  |
| alpha (alpha) | special alpha | → p186 [alpha] |
| d4 (4) | type 4 |  |
| d5 (5) | type 5 |  |
| d6 (6) | type 6 |  |
| mul (×) | insert \times |  |
| shift (shift) | special shift | → p187 [shift] |
| d1 (1) | type 1 |  |
| d2 (2) | type 2 |  |
| d3 (3) | type 3 |  |
| sub (−) | type - |  |
| fmt (Fmt) | special fmt | · |
| d0 (0) | type 0 |  |
| dot (.) | type . |  |
| space (␣) | type   |  |
| add (+) | type + |  |

`·` = nothing changed on screen (a cursor move on an empty line, or a dead key); `→ pNNN` = a new state; a code span is what the line holds after the key.

#### home-line

| key | spec tap | tap |
|---|---|---|
| u1 (＋) | special none |  |
| u2 (＋) | special none |  |
| up (▲) | cmd moveUp | · |
| menu (☰) | special menu | → p233 Home menu |
| esc (Esc) | special esc | · |
| u3 (＋) | special none |  |
| u4 (＋) | special none |  |
| left (◀) | cmd moveToPreviousChar | · |
| right (▶) | cmd moveToNextChar | · |
| undo (Undo) | cmd undo | `1+2\times3+4\times5+6` |
| redo (Redo) | cmd redo | · |
| u5 (＋) | special none |  |
| u6 (＋) | special none |  |
| down (▼) | cmd moveDown | · |
| select (Select) | special selectGrow | · |
| deselect (Deselect) | special selectShrink | · |
| vars (Vars) | special vars | → p234 Vars |
| math (Math) | special find | → p235 Find |
| tmpl (Tmpl) | special tmpl | → p236 Templates |
| x (x) | type x |  |
| frac (a b/c) | insert \frac{#@}{#?} | · |
| bksp (⌫) | cmd deleteBackward | · |
| pow (xʸ) | insert #@^{#?} |  |
| sin (sin) | insert \sin\left(#0\right) |  |
| cos (cos) | insert \cos\left(#0\right) |  |
| tan (tan) | insert \tan\left(#0\right) |  |
| ln (ln) | insert \ln\left(#0\right) |  |
| log (log) | insert \log\left(#0\right) |  |
| sq (x²) | insert #@^{2} |  |
| neg ((−)) | type - |  |
| paren (( )) | insert \left(#0\right) |  |
| comma (,) | type , |  |
| enter (Enter) | special enter | · |
| emark (ᴇ) | insert \emark | `1\emark` |
| d7 (7) | type 7 |  |
| d8 (8) | type 8 |  |
| d9 (9) | type 9 |  |
| div (÷) | insert \frac{#@}{#?} |  |
| alpha (alpha) | special alpha | → p237 [alpha] |
| d4 (4) | type 4 |  |
| d5 (5) | type 5 |  |
| d6 (6) | type 6 |  |
| mul (×) | insert \times |  |
| shift (shift) | special shift | → p239 [shift] |
| d1 (1) | type 1 |  |
| d2 (2) | type 2 |  |
| d3 (3) | type 3 |  |
| sub (−) | type - |  |
| fmt (Fmt) | special fmt | `1+2\times3+4\times5+6` |
| d0 (0) | type 0 |  |
| dot (.) | type . |  |
| space (␣) | type   |  |
| add (+) | type + |  |

`·` = nothing changed on screen (a cursor move on an empty line, or a dead key); `→ pNNN` = a new state; a code span is what the line holds after the key.

#### cas

| key | spec tap | tap |
|---|---|---|
| u1 (＋) | special none | · |
| u2 (＋) | special none | · |
| up (▲) | cmd moveUp | · |
| menu (☰) | special menu | → p248 CAS menu |
| esc (Esc) | special esc | · |
| u3 (＋) | special none | · |
| u4 (＋) | special none | · |
| left (◀) | cmd moveToPreviousChar | · |
| right (▶) | cmd moveToNextChar | · |
| undo (Undo) | cmd undo | · |
| redo (Redo) | cmd redo | · |
| u5 (＋) | special none | · |
| u6 (＋) | special none | · |
| down (▼) | cmd moveDown | · |
| select (Select) | special selectGrow | · |
| deselect (Deselect) | special selectShrink | · |
| vars (Vars) | special vars | → p249 Vars |
| math (Math) | special find | → p250 Find |
| tmpl (Tmpl) | special tmpl | → p251 Templates |
| x (x) | type x | `x` |
| frac (a b/c) | insert \frac{#@}{#?} | · |
| bksp (⌫) | cmd deleteBackward | · |
| pow (xʸ) | insert #@^{#?} | `\placeholder{}^{\placeholder` |
| sin (sin) | insert \sin\left(#0\right) | `\sin\left(\placeholder{}\rig` |
| cos (cos) | insert \cos\left(#0\right) | `\cos\left(\placeholder{}\rig` |
| tan (tan) | insert \tan\left(#0\right) | `\tan\left(\placeholder{}\rig` |
| ln (ln) | insert \ln\left(#0\right) | `\ln\left(\placeholder{}\righ` |
| log (log) | insert \log\left(#0\right) | `\log\left(\placeholder{}\rig` |
| sq (x²) | insert #@^{2} | `\placeholder{}^2` |
| neg ((−)) | type - | `-` |
| paren (( )) | insert \left(#0\right) | `\left(\placeholder{}\right)` |
| comma (,) | type , | `,` |
| enter (Enter) | special enter | · |
| emark (ᴇ) | insert \emark | `1\emark` |
| d7 (7) | type 7 | `7` |
| d8 (8) | type 8 | `8` |
| d9 (9) | type 9 | `9` |
| div (÷) | insert \frac{#@}{#?} | `\frac{\placeholder{}}{\place` |
| alpha (alpha) | special alpha | → p252 [alpha] |
| d4 (4) | type 4 | `4` |
| d5 (5) | type 5 | `5` |
| d6 (6) | type 6 | `6` |
| mul (×) | insert \times | `\times` |
| shift (shift) | special shift | → p254 [shift] |
| d1 (1) | type 1 | `1` |
| d2 (2) | type 2 | `2` |
| d3 (3) | type 3 | `3` |
| sub (−) | type - | `-` |
| fmt (Fmt) | special fmt | · |
| d0 (0) | type 0 | `0` |
| dot (.) | type . | `.` |
| space (␣) | type   | · |
| add (+) | type + | `+` |

`·` = nothing changed on screen (a cursor move on an empty line, or a dead key); `→ pNNN` = a new state; a code span is what the line holds after the key.

#### function

| key | spec tap | tap |
|---|---|---|
| u1 (＋) | special none | · |
| u2 (＋) | special none | · |
| up (▲) | cmd moveUp | · |
| menu (☰) | special menu | → p266 Symb menu |
| esc (Esc) | special esc | · |
| u3 (＋) | special none | · |
| u4 (＋) | special none | · |
| left (◀) | cmd moveToPreviousChar | · |
| right (▶) | cmd moveToNextChar | · |
| undo (Undo) | cmd undo | `x^2-2` |
| redo (Redo) | cmd redo | · |
| u5 (＋) | special none | · |
| u6 (＋) | special none | · |
| down (▼) | cmd moveDown | · |
| select (Select) | special selectGrow | · |
| deselect (Deselect) | special selectShrink | · |
| vars (Vars) | special vars | → p267 Vars |
| math (Math) | special find | → p268 Find |
| tmpl (Tmpl) | special tmpl | → p269 Templates |
| x (x) | type x | `x` |
| frac (a b/c) | insert \frac{#@}{#?} | `\frac{\placeholder{}}{\place` |
| bksp (⌫) | cmd deleteBackward | · |
| pow (xʸ) | insert #@^{#?} | `\placeholder{}^{\placeholder` |
| sin (sin) | insert \sin\left(#0\right) | `\sin\left(\placeholder{}\rig` |
| cos (cos) | insert \cos\left(#0\right) | `\cos\left(\placeholder{}\rig` |
| tan (tan) | insert \tan\left(#0\right) | `\tan\left(\placeholder{}\rig` |
| ln (ln) | insert \ln\left(#0\right) | `\ln\left(\placeholder{}\righ` |
| log (log) | insert \log\left(#0\right) | `\log\left(\placeholder{}\rig` |
| sq (x²) | insert #@^{2} | `\placeholder{}^2` |
| neg ((−)) | type - | `-` |
| paren (( )) | insert \left(#0\right) | `\left(\placeholder{}\right)` |
| comma (,) | type , | `,` |
| enter (Enter) | special enter | · |
| emark (ᴇ) | insert \emark | `1\emark` |
| d7 (7) | type 7 | `7` |
| d8 (8) | type 8 | `8` |
| d9 (9) | type 9 | `9` |
| div (÷) | insert \frac{#@}{#?} | `\frac{\placeholder{}}{\place` |
| alpha (alpha) | special alpha | → p270 [alpha] |
| d4 (4) | type 4 | `x^2-24` |
| d5 (5) | type 5 | `5` |
| d6 (6) | type 6 | `6` |
| mul (×) | insert \times | `\times` |
| shift (shift) | special shift | → p272 [shift] |
| d1 (1) | type 1 | `x^2-21` |
| d2 (2) | type 2 | `2` |
| d3 (3) | type 3 | `3` |
| sub (−) | type - | `-` |
| fmt (Fmt) | special fmt | · |
| d0 (0) | type 0 | `0` |
| dot (.) | type . | `.` |
| space (␣) | type   | · |
| add (+) | type + | `+` |

`·` = nothing changed on screen (a cursor move on an empty line, or a dead key); `→ pNNN` = a new state; a code span is what the line holds after the key.

#### function-plot

| key | spec tap | tap |
|---|---|---|
| u1 (＋) | special none | · |
| u2 (＋) | special none | · |
| up (▲) | cmd moveUp | · |
| menu (☰) | special menu | → p290 Plot menu |
| esc (Esc) | special esc | · |
| u3 (＋) | special none | · |
| u4 (＋) | special none | · |
| left (◀) | cmd moveToPreviousChar | · |
| right (▶) | cmd moveToNextChar | · |
| undo (Undo) | cmd undo | · |
| redo (Redo) | cmd redo | · |
| u5 (＋) | special none | · |
| u6 (＋) | special none | · |
| down (▼) | cmd moveDown | · |
| select (Select) | special selectGrow | · |
| deselect (Deselect) | special selectShrink | · |
| vars (Vars) | special vars | · |
| math (Math) | special find | · |
| tmpl (Tmpl) | special tmpl | · |
| x (x) | type x | · |
| frac (a b/c) | insert \frac{#@}{#?} | · |
| bksp (⌫) | cmd deleteBackward | · |
| pow (xʸ) | insert #@^{#?} | · |
| sin (sin) | insert \sin\left(#0\right) | · |
| cos (cos) | insert \cos\left(#0\right) | · |
| tan (tan) | insert \tan\left(#0\right) | · |
| ln (ln) | insert \ln\left(#0\right) | · |
| log (log) | insert \log\left(#0\right) | · |
| sq (x²) | insert #@^{2} | · |
| neg ((−)) | type - | · |
| paren (( )) | insert \left(#0\right) | · |
| comma (,) | type , | · |
| enter (Enter) | special enter | · |
| emark (ᴇ) | insert \emark | · |
| d7 (7) | type 7 | · |
| d8 (8) | type 8 | · |
| d9 (9) | type 9 | · |
| div (÷) | insert \frac{#@}{#?} | · |
| alpha (alpha) | special alpha | → p291 [alpha] |
| d4 (4) | type 4 | · |
| d5 (5) | type 5 | · |
| d6 (6) | type 6 | · |
| mul (×) | insert \times | · |
| shift (shift) | special shift | → p293 [shift] |
| d1 (1) | type 1 | · |
| d2 (2) | type 2 | · |
| d3 (3) | type 3 | · |
| sub (−) | type - | · |
| fmt (Fmt) | special fmt | · |
| d0 (0) | type 0 | · |
| dot (.) | type . | · |
| space (␣) | type   | · |
| add (+) | type + | · |

`·` = nothing changed on screen (a cursor move on an empty line, or a dead key); `→ pNNN` = a new state; a code span is what the line holds after the key.

#### function-num

| key | spec tap | tap |
|---|---|---|
| u1 (＋) | special none | · |
| u2 (＋) | special none | · |
| up (▲) | cmd moveUp | · |
| menu (☰) | special menu | → p305 Num menu |
| esc (Esc) | special esc | · |
| u3 (＋) | special none | · |
| u4 (＋) | special none | · |
| left (◀) | cmd moveToPreviousChar | · |
| right (▶) | cmd moveToNextChar | · |
| undo (Undo) | cmd undo | `x^2-2` |
| redo (Redo) | cmd redo | · |
| u5 (＋) | special none | · |
| u6 (＋) | special none | · |
| down (▼) | cmd moveDown | · |
| select (Select) | special selectGrow | · |
| deselect (Deselect) | special selectShrink | · |
| vars (Vars) | special vars | → p306 Vars |
| math (Math) | special find | → p307 Find |
| tmpl (Tmpl) | special tmpl | → p308 Templates |
| x (x) | type x | `x` |
| frac (a b/c) | insert \frac{#@}{#?} | `\frac{\placeholder{}}{\place` |
| bksp (⌫) | cmd deleteBackward | · |
| pow (xʸ) | insert #@^{#?} | `\placeholder{}^{\placeholder` |
| sin (sin) | insert \sin\left(#0\right) | `\sin\left(\placeholder{}\rig` |
| cos (cos) | insert \cos\left(#0\right) | `\cos\left(\placeholder{}\rig` |
| tan (tan) | insert \tan\left(#0\right) | `\tan\left(\placeholder{}\rig` |
| ln (ln) | insert \ln\left(#0\right) | `\ln\left(\placeholder{}\righ` |
| log (log) | insert \log\left(#0\right) | `\log\left(\placeholder{}\rig` |
| sq (x²) | insert #@^{2} | `\placeholder{}^2` |
| neg ((−)) | type - | `-` |
| paren (( )) | insert \left(#0\right) | `\left(\placeholder{}\right)` |
| comma (,) | type , | `,` |
| enter (Enter) | special enter | · |
| emark (ᴇ) | insert \emark | `1\emark` |
| d7 (7) | type 7 | `7` |
| d8 (8) | type 8 | `8` |
| d9 (9) | type 9 | `9` |
| div (÷) | insert \frac{#@}{#?} | `\frac{\placeholder{}}{\place` |
| alpha (alpha) | special alpha | → p309 [alpha] |
| d4 (4) | type 4 | `4` |
| d5 (5) | type 5 | `5` |
| d6 (6) | type 6 | `6` |
| mul (×) | insert \times | `\times` |
| shift (shift) | special shift | → p311 [shift] |
| d1 (1) | type 1 | `1` |
| d2 (2) | type 2 | `2` |
| d3 (3) | type 3 | `3` |
| sub (−) | type - | `-` |
| fmt (Fmt) | special fmt | · |
| d0 (0) | type 0 | `0` |
| dot (.) | type . | `.` |
| space (␣) | type   | · |
| add (+) | type + | `+` |

`·` = nothing changed on screen (a cursor move on an empty line, or a dead key); `→ pNNN` = a new state; a code span is what the line holds after the key.

#### solve

| key | spec tap | tap |
|---|---|---|
| u1 (＋) | special none | · |
| u2 (＋) | special none | · |
| up (▲) | cmd moveUp | · |
| menu (☰) | special menu | → p320 Symb menu |
| esc (Esc) | special esc | · |
| u3 (＋) | special none | · |
| u4 (＋) | special none | · |
| left (◀) | cmd moveToPreviousChar | · |
| right (▶) | cmd moveToNextChar | · |
| undo (Undo) | cmd undo | · |
| redo (Redo) | cmd redo | · |
| u5 (＋) | special none | · |
| u6 (＋) | special none | · |
| down (▼) | cmd moveDown | · |
| select (Select) | special selectGrow | · |
| deselect (Deselect) | special selectShrink | · |
| vars (Vars) | special vars | → p321 Vars |
| math (Math) | special find | → p322 Find |
| tmpl (Tmpl) | special tmpl | → p323 Templates |
| x (x) | type x | `x` |
| frac (a b/c) | insert \frac{#@}{#?} | `\frac{\placeholder{}}{\place` |
| bksp (⌫) | cmd deleteBackward | · |
| pow (xʸ) | insert #@^{#?} | `\placeholder{}^{\placeholder` |
| sin (sin) | insert \sin\left(#0\right) | `\sin\left(\placeholder{}\rig` |
| cos (cos) | insert \cos\left(#0\right) | `\cos\left(\placeholder{}\rig` |
| tan (tan) | insert \tan\left(#0\right) | `\tan\left(\placeholder{}\rig` |
| ln (ln) | insert \ln\left(#0\right) | `\ln\left(\placeholder{}\righ` |
| log (log) | insert \log\left(#0\right) | `\log\left(\placeholder{}\rig` |
| sq (x²) | insert #@^{2} | `\placeholder{}^2` |
| neg ((−)) | type - | `-` |
| paren (( )) | insert \left(#0\right) | `\left(\placeholder{}\right)` |
| comma (,) | type , | `,` |
| enter (Enter) | special enter | · |
| emark (ᴇ) | insert \emark | `1\emark` |
| d7 (7) | type 7 | `7` |
| d8 (8) | type 8 | `8` |
| d9 (9) | type 9 | `9` |
| div (÷) | insert \frac{#@}{#?} | `\frac{\placeholder{}}{\place` |
| alpha (alpha) | special alpha | → p324 [alpha] |
| d4 (4) | type 4 | `4` |
| d5 (5) | type 5 | `5` |
| d6 (6) | type 6 | `6` |
| mul (×) | insert \times | `\times` |
| shift (shift) | special shift | → p326 [shift] |
| d1 (1) | type 1 | `1` |
| d2 (2) | type 2 | `2` |
| d3 (3) | type 3 | `3` |
| sub (−) | type - | `-` |
| fmt (Fmt) | special fmt | · |
| d0 (0) | type 0 | `0` |
| dot (.) | type . | `.` |
| space (␣) | type   | · |
| add (+) | type + | `+` |

`·` = nothing changed on screen (a cursor move on an empty line, or a dead key); `→ pNNN` = a new state; a code span is what the line holds after the key.

#### units

| key | spec tap | tap |
|---|---|---|
| u1 (＋) | special none | · |
| u2 (＋) | special none | · |
| up (▲) | cmd moveUp | · |
| menu (☰) | special menu | · |
| esc (Esc) | special esc | → p337 |
| u3 (＋) | special none | `72` |
| u4 (＋) | special none | · |
| left (◀) | cmd moveToPreviousChar | · |
| right (▶) | cmd moveToNextChar | · |
| undo (Undo) | cmd undo | · |
| redo (Redo) | cmd redo | · |
| u5 (＋) | special none | · |
| u6 (＋) | special none | · |
| down (▼) | cmd moveDown | · |
| select (Select) | special selectGrow | · |
| deselect (Deselect) | special selectShrink | · |
| vars (Vars) | special vars | · |
| math (Math) | special find | → p341 Find |
| tmpl (Tmpl) | special tmpl | · |
| x (x) | type x | · |
| frac (a b/c) | insert \frac{#@}{#?} | · |
| bksp (⌫) | cmd deleteBackward | · |
| pow (xʸ) | insert #@^{#?} | · |
| sin (sin) | insert \sin\left(#0\right) | · |
| cos (cos) | insert \cos\left(#0\right) | · |
| tan (tan) | insert \tan\left(#0\right) | · |
| ln (ln) | insert \ln\left(#0\right) | · |
| log (log) | insert \log\left(#0\right) | · |
| sq (x²) | insert #@^{2} | · |
| neg ((−)) | type - | · |
| paren (( )) | insert \left(#0\right) | · |
| comma (,) | type , | · |
| enter (Enter) | special enter | · |
| emark (ᴇ) | insert \emark | · |
| d7 (7) | type 7 | · |
| d8 (8) | type 8 | · |
| d9 (9) | type 9 | · |
| div (÷) | insert \frac{#@}{#?} | · |
| alpha (alpha) | special alpha | → p342 [alpha] [unit view] |
| d4 (4) | type 4 | `72` |
| d5 (5) | type 5 | · |
| d6 (6) | type 6 | · |
| mul (×) | insert \times | · |
| shift (shift) | special shift | → p344 [shift] [unit view] |
| d1 (1) | type 1 | `72` |
| d2 (2) | type 2 | · |
| d3 (3) | type 3 | · |
| sub (−) | type - | · |
| fmt (Fmt) | special fmt | · |
| d0 (0) | type 0 | · |
| dot (.) | type . | · |
| space (␣) | type   | · |
| add (+) | type + | · |

In the unit view a key fills the slot (a unit cell, P14), which this table's reader (the entry line's value) does not see. So `·` here means only that the line and the state did not change; the unit pad's faces are in the screenshot of the root state.

`·` = nothing changed on screen (a cursor move on an empty line, or a dead key); `→ pNNN` = a new state; a code span is what the line holds after the key.

### phone: actions to reach each state from its root

| root | state | actions | the shortest way |
|---|---|---|---|
| tips | p002 home | 1 | tap “Got it” |
| home | p004 home › apps:Apps | 1 | tap “Place: Home. Tap to open the apps list.” |
| home | p005 home | 1 | tap “Angle unit: Radians. Tap to switch.” |
| home | p006 home › menu:Mode | 1 | tap “STD” |
| home | p007 home › menu:Mode › Significant digits | 1 | tap “12” |
| home | p008 home › menu:Home menu | 1 | tap “Menu” |
| home | p009 home › find:Vars | 1 | key vars |
| home | p010 home › find:Find | 1 | key math |
| home | p011 home › menu:Templates | 1 | key tmpl |
| home | p012 home [alpha] | 1 | key alpha |
| home | p014 home [shift] | 1 | key shift |
| home | p015 home +credits › menu:N62 | 1 | mark-tap |
| home | p016 home [folded] | 1 | line-swipe-down |
| home | p017 home › find:Memory | 1 | flick-up:math |
| home | p018 home [unit view] | 1 | flick-up:tmpl |
| home | p019 home › store:Store in | 1 | flick-up:emark |
| home | p020 home › menu:Symbols and Greek | 1 | flick-up:d9 |
| home | p021 home › menu:Matrix | 1 | flick-up:d4 |
| home | p022 home › menu:Relations and logic | 1 | flick-up:d6 |
| home | p023 home [alpha-lock] | 1 | flick-up:alpha |
| home | p024 home [shift-lock] | 1 | flick-up:shift |
| home | p025 home › menu:Mode › Settings | 1 | flick-up:menu |
| home | p026 home › apps:Apps | 2 | tap “Place: Home. Tap to open the apps list.”, tap “Angle unit: Radians. Tap to switch.” |
| home | p027 cas | 2 | tap “Place: Home. Tap to open the apps list.”, row “2 CAS” |
| home | p028 function/symb | 2 | tap “Place: Home. Tap to open the apps list.”, row “3 Function” |
| home | p029 solve/symb | 2 | tap “Place: Home. Tap to open the apps list.”, row “4 Solve” |
| home | p030 home › menu:Mode | 2 | tap “STD”, tap “Angle unit: Radians. Tap to switch.” |
| home | p031 home › menu:Mode | 2 | tap “STD”, row “2 Number format” |
| home | p032 home | 2 | tap “STD”, tap “Scientific” |
| home | p033 home | 2 | tap “STD”, tap “Engineering” |
| home | p034 home | 2 | tap “STD”, tap “Prefixes (k, M, µ …)” |
| home | p035 home › menu:Mode | 2 | tap “STD”, tap “Previous value” |
| home | p036 home › menu:Mode | 2 | tap “STD”, tap “Next value” |
| home | p037 home › menu:Mode | 2 | tap “STD”, row “4 Entry” |
| home | p038 home | 2 | tap “STD”, tap “One line” |
| home | p039 home › menu:Mode › Presets | 2 | tap “STD”, row “5 Preset” |
| home | p040 home › menu:Mode › Significant digits | 2 | tap “12”, tap “Angle unit: Radians. Tap to switch.” |
| home | p041 home | 2 | tap “12”, row “1 4” |
| home | p042 home | 2 | tap “12”, row “2 6” |
| home | p043 home | 2 | tap “12”, row “3 8” |
| home | p044 home | 2 | tap “12”, row “4 10” |
| home | p045 home | 2 | tap “12”, row “6 15” |
| home | p046 home | 2 | tap “12”, row “7 20” |
| home | p047 home | 2 | tap “12”, row “8 25” |
| home | p048 home | 2 | tap “12”, row “9 30” |
| home | p049 home › menu:Home menu | 2 | tap “Menu”, tap “Angle unit: Radians. Tap to switch.” |
| home | p050 home › menu:Home menu › Settings | 2 | tap “Menu”, tap “Settings” |
| home | p051 home › find:Vars | 2 | key vars, tap “Angle unit: Radians. Tap to switch.” |
| home | p052 home › find:Vars | 2 | key vars, key vars |
| home | p053 home [alpha] › find:Vars | 2 | key vars, key alpha |
| home | p054 home [shift] › find:Vars | 2 | key vars, key shift |
| home | p055 home › find:Find | 2 | key math, tap “Angle unit: Radians. Tap to switch.” |
| home | p056 home › find:Find › Arithmetic | 2 | key math, row “1 Arithmetic” |
| home | p057 home › find:Find › Powers and logarithms | 2 | key math, row “2 Powers and logarithms” |
| home | p058 home › find:Find › Trigonometry | 2 | key math, row “3 Trigonometry” |
| home | p059 home › find:Find › Calculus | 2 | key math, row “4 Calculus” |
| home | p060 home › find:Find › Algebra and solving | 2 | key math, row “5 Algebra and solving” |
| home | p061 home › find:Find › Matrices and vectors | 2 | key math, row “6 Matrices and vectors” |
| home | p062 home › find:Find | 2 | key math, key vars |
| home | p063 home [alpha] › find:Find | 2 | key math, key alpha |
| home | p064 home [shift] › find:Find | 2 | key math, key shift |
| home | p065 home › menu:Templates | 2 | key tmpl, tap “Angle unit: Radians. Tap to switch.” |
| home | p066 home +credits › menu:N62 | 2 | mark-tap, tap “Angle unit: Radians. Tap to switch.” |
| home | p067 home › find:Memory | 2 | flick-up:math, tap “Angle unit: Radians. Tap to switch.” |
| home | p068 home [alpha] › find:Memory | 2 | flick-up:math, key alpha |
| home | p069 home [shift] › find:Memory | 2 | flick-up:math, key shift |
| home | p070 home › store:Store in | 2 | flick-up:emark, tap “Angle unit: Radians. Tap to switch.” |
| home | p071 home [alpha] › store:Store in | 2 | flick-up:emark, key alpha |
| home | p072 home [shift] › store:Store in | 2 | flick-up:emark, key shift |
| home | p073 home › menu:Symbols and Greek | 2 | flick-up:d9, tap “Angle unit: Radians. Tap to switch.” |
| home | p074 home › menu:Matrix | 2 | flick-up:d4, tap “Angle unit: Radians. Tap to switch.” |
| home | p075 home +matrix-grid › menu:Matrix › A | 2 | flick-up:d4, row “9 New” |
| home | p077 home › menu:Relations and logic | 2 | flick-up:d6, tap “Angle unit: Radians. Tap to switch.” |
| home | p078 home › menu:Mode › Settings | 2 | flick-up:menu, tap “Angle unit: Radians. Tap to switch.” |
| home | p079 home › menu:Mode › Settings › Appearance | 2 | flick-up:menu, row “1 Appearance” |
| home | p080 home › menu:Mode › Settings › Numbers | 2 | flick-up:menu, row “2 Numbers” |
| home | p081 home › menu:Mode › Settings › Key vibration | 2 | flick-up:menu, row “3 Key vibration” |
| home | p082 home › menu:Mode › Settings › Your keys | 2 | flick-up:menu, row “4 Your keys” |
| home | p083 home › menu:Mode › Settings › Data | 2 | flick-up:menu, row “5 Data” |
| home | p084 home › menu:Mode › Settings › Counters | 2 | flick-up:menu, row “6 Counters” |
| home | p085 home › menu:Mode › Settings › Help and about | 2 | flick-up:menu, row “7 Help and about” |
| home | p086 home › menu:Mode › Presets | 3 | tap “STD”, row “5 Preset”, tap “Angle unit: Radians. Tap to switch.” |
| home | p087 home › menu:Home menu › Settings | 3 | tap “Menu”, tap “Settings”, tap “Angle unit: Radians. Tap to switch.” |
| home | p088 home › menu:Home menu › Settings › Appearance | 3 | tap “Menu”, tap “Settings”, row “1 Appearance” |
| home | p089 home › menu:Home menu › Settings › Numbers | 3 | tap “Menu”, tap “Settings”, row “2 Numbers” |
| home | p090 home › menu:Home menu › Settings › Key vibration | 3 | tap “Menu”, tap “Settings”, row “3 Key vibration” |
| home | p091 home › menu:Home menu › Settings › Your keys | 3 | tap “Menu”, tap “Settings”, row “4 Your keys” |
| home | p092 home › menu:Home menu › Settings › Data | 3 | tap “Menu”, tap “Settings”, row “5 Data” |
| home | p093 home › menu:Home menu › Settings › Counters | 3 | tap “Menu”, tap “Settings”, row “6 Counters” |
| home | p094 home › menu:Home menu › Settings › Help and about | 3 | tap “Menu”, tap “Settings”, row “7 Help and about” |
| home | p095 home › find:Vars | 3 | key vars, key vars, tap “Angle unit: Radians. Tap to switch.” |
| home | p096 home [alpha] › apps:Apps | 3 | key vars, key alpha, tap “Place: Home. Tap to open the apps list.” |
| home | p097 home [alpha] › find:Vars | 3 | key vars, key alpha, tap “Angle unit: Radians. Tap to switch.” |
| home | p098 home [alpha] › menu:Mode | 3 | key vars, key alpha, tap “STD” |
| home | p099 home [alpha] › menu:Mode › Significant digits | 3 | key vars, key alpha, tap “12” |
| home | p100 home [shift] › find:Vars | 3 | key vars, key shift, tap “Angle unit: Radians. Tap to switch.” |
| home | p101 home [shift] › menu:Mode | 3 | key vars, key shift, tap “STD” |
| home | p102 home [shift] › menu:Mode › Significant digits | 3 | key vars, key shift, tap “12” |
| home | p103 home › find:Find › Arithmetic | 3 | key math, row “1 Arithmetic”, tap “Angle unit: Radians. Tap to switch.” |
| home | p104 home › find:Find › Powers and logarithms | 3 | key math, row “2 Powers and logarithms”, tap “Angle unit: Radians. Tap to switch.” |
| home | p105 home › find:Find › Trigonometry | 3 | key math, row “3 Trigonometry”, tap “Angle unit: Radians. Tap to switch.” |
| home | p106 home › find:Find › Calculus | 3 | key math, row “4 Calculus”, tap “Angle unit: Radians. Tap to switch.” |
| home | p107 home › find:Find › Algebra and solving | 3 | key math, row “5 Algebra and solving”, tap “Angle unit: Radians. Tap to switch.” |
| home | p108 home › find:Find › Matrices and vectors | 3 | key math, row “6 Matrices and vectors”, tap “Angle unit: Radians. Tap to switch.” |
| home | p109 home › find:Find | 3 | key math, key vars, tap “Angle unit: Radians. Tap to switch.” |
| home | p110 home [alpha] › find:Find | 3 | key math, key alpha, tap “Angle unit: Radians. Tap to switch.” |
| home | p111 home [alpha] › find:Find › Arithmetic | 3 | key math, key alpha, row “1 Arithmetic” |
| home | p112 home [alpha] › find:Find › Powers and logarithms | 3 | key math, key alpha, row “2 Powers and logarithms” |
| home | p113 home [alpha] › find:Find › Trigonometry | 3 | key math, key alpha, row “3 Trigonometry” |
| home | p114 home [alpha] › find:Find › Calculus | 3 | key math, key alpha, row “4 Calculus” |
| home | p115 home [alpha] › find:Find › Algebra and solving | 3 | key math, key alpha, row “5 Algebra and solving” |
| home | p116 home [alpha] › find:Find › Matrices and vectors | 3 | key math, key alpha, row “6 Matrices and vectors” |
| home | p117 home [shift] › find:Find | 3 | key math, key shift, tap “Angle unit: Radians. Tap to switch.” |
| home | p118 home [shift] › find:Find › Arithmetic | 3 | key math, key shift, row “1 Arithmetic” |
| home | p119 home [shift] › find:Find › Powers and logarithms | 3 | key math, key shift, row “2 Powers and logarithms” |
| home | p120 home [shift] › find:Find › Trigonometry | 3 | key math, key shift, row “3 Trigonometry” |
| home | p121 home [shift] › find:Find › Calculus | 3 | key math, key shift, row “4 Calculus” |
| home | p122 home [shift] › find:Find › Algebra and solving | 3 | key math, key shift, row “5 Algebra and solving” |
| home | p123 home [shift] › find:Find › Matrices and vectors | 3 | key math, key shift, row “6 Matrices and vectors” |
| home | p124 home [alpha] › find:Memory | 3 | flick-up:math, key alpha, tap “Angle unit: Radians. Tap to switch.” |
| home | p125 home [shift] › find:Memory | 3 | flick-up:math, key shift, tap “Angle unit: Radians. Tap to switch.” |
| home | p126 home [alpha] › store:Store in | 3 | flick-up:emark, key alpha, tap “Angle unit: Radians. Tap to switch.” |
| home | p127 home [shift] › apps:Apps | 3 | flick-up:emark, key shift, tap “Place: Home. Tap to open the apps list.” |
| home | p128 home [shift] › store:Store in | 3 | flick-up:emark, key shift, tap “Angle unit: Radians. Tap to switch.” |
| home | p129 home +matrix-grid › menu:Matrix › A | 3 | flick-up:d4, row “9 New”, tap “Angle unit: Radians. Tap to switch.” |
| home | p130 home +matrix-grid +matrix-menu › menu:Matrix › A › matrix-menu:Matrix menu | 3 | flick-up:d4, row “9 New”, tap “Menu” |
| home | p076 home › menu:Matrix | 3 | flick-up:d4, row “9 New”, tap “Back” |
| home | p131 home › menu:Mode › Settings › Appearance | 3 | flick-up:menu, row “1 Appearance”, tap “Angle unit: Radians. Tap to switch.” |
| home | p132 home › menu:Settings › Appearance › Theme | 3 | flick-up:menu, row “1 Appearance”, row “1 Theme” |
| home | p133 home › menu:Mode › Settings › Appearance | 3 | flick-up:menu, row “1 Appearance”, tap “Previous value” |
| home | p134 home › menu:Mode › Settings › Appearance | 3 | flick-up:menu, row “1 Appearance”, tap “Next value” |
| home | p135 home › menu:Mode › Settings › Appearance | 3 | flick-up:menu, row “1 Appearance”, row “2 Brightness” |
| home | p136 home › menu:Mode › Settings › Appearance | 3 | flick-up:menu, row “1 Appearance”, tap “Previous value” |
| home | p137 home › menu:Mode › Settings › Appearance | 3 | flick-up:menu, row “1 Appearance”, row “3 High contrast” |
| home | p138 home › menu:Mode › Settings › Appearance | 3 | flick-up:menu, row “1 Appearance”, row “4 Plain keys” |
| home | p139 home › menu:Mode › Settings › Appearance | 3 | flick-up:menu, row “1 Appearance”, row “5 Key shadows” |
| home | p140 home › menu:Mode › Settings › Appearance | 3 | flick-up:menu, row “1 Appearance”, row “6 Key pop-ups” |
| home | p141 home › menu:Mode › Settings › Numbers | 3 | flick-up:menu, row “2 Numbers”, tap “Angle unit: Radians. Tap to switch.” |
| home | p142 home › menu:Mode › Settings › Numbers | 3 | flick-up:menu, row “2 Numbers”, row “1 Decimal mark” |
| home | p143 home › menu:Settings › Numbers › Fmt key cycle | 3 | flick-up:menu, row “2 Numbers”, row “2 Fmt key cycle” |
| home | p144 home › menu:Mode › Settings › Numbers | 3 | flick-up:menu, row “2 Numbers”, row “3 Decimals in Fixed” |
| home | p145 home › menu:Mode › Settings › Numbers | 3 | flick-up:menu, row “2 Numbers”, tap “Previous value” |
| home | p146 home › menu:Mode › Settings › Numbers | 3 | flick-up:menu, row “2 Numbers”, row “4 Uncertainty” |
| home | p147 home | 3 | flick-up:menu, row “2 Numbers”, row “5 Marks” |
| home | p148 home | 3 | flick-up:menu, row “2 Numbers”, tap “Warning marks in colour” |
| home | p149 home › menu:Mode › Settings › Numbers | 3 | flick-up:menu, row “2 Numbers”, row “6 Digit groups” |
| home | p150 home | 3 | flick-up:menu, row “2 Numbers”, tap “Digit groups: apostrophe” |
| home | p151 home | 3 | flick-up:menu, row “2 Numbers”, tap “Digit groups: comma” |
| home | p152 home › menu:Settings › Numbers › Word | 3 | flick-up:menu, row “2 Numbers”, row “7 Word” |
| home | p153 home › menu:Mode › Settings › Key vibration | 3 | flick-up:menu, row “3 Key vibration”, tap “Angle unit: Radians. Tap to switch.” |
| home | p154 home › menu:Mode › Settings › Key vibration | 3 | flick-up:menu, row “3 Key vibration”, row “1 Key vibration” |
| home | p155 home › menu:Mode › Settings › Key vibration | 3 | flick-up:menu, row “3 Key vibration”, row “5 Key click” |
| home | p156 home › menu:Mode › Settings › Your keys | 3 | flick-up:menu, row “4 Your keys”, tap “Angle unit: Radians. Tap to switch.” |
| home | p157 home › menu:Settings › Your keys › U1 | 3 | flick-up:menu, row “4 Your keys”, row “1 U1” |
| home | p158 home › menu:Settings › Your keys › U1 ⇧ | 3 | flick-up:menu, row “4 Your keys”, row “2 U1 ⇧” |
| home | p159 home › menu:Settings › Your keys › U1 α | 3 | flick-up:menu, row “4 Your keys”, row “3 U1 α” |
| home | p160 home › menu:Settings › Your keys › U2 | 3 | flick-up:menu, row “4 Your keys”, row “4 U2” |
| home | p161 home › menu:Settings › Your keys › U2 ⇧ | 3 | flick-up:menu, row “4 Your keys”, row “5 U2 ⇧” |
| home | p162 home › menu:Settings › Your keys › U2 α | 3 | flick-up:menu, row “4 Your keys”, row “6 U2 α” |
| home | p163 home › menu:Settings › Your keys › U3 | 3 | flick-up:menu, row “4 Your keys”, row “7 U3” |
| home | p164 home › menu:Settings › Your keys › U3 ⇧ | 3 | flick-up:menu, row “4 Your keys”, row “8 U3 ⇧” |
| home | p165 home › menu:Settings › Your keys › U3 α | 3 | flick-up:menu, row “4 Your keys”, row “9 U3 α” |
| home | p166 home › menu:Settings › Your keys › U4 | 3 | flick-up:menu, row “4 Your keys”, row “0 U4” |
| home | p167 home › menu:Settings › Your keys › Unit pad cells | 3 | flick-up:menu, row “4 Your keys”, row “Unit pad cells” |
| home | p168 home › menu:Mode › Settings › Data | 3 | flick-up:menu, row “5 Data”, tap “Angle unit: Radians. Tap to switch.” |
| home | p169 home › menu:Settings › Data › Library | 3 | flick-up:menu, row “5 Data”, row “3 Library” |
| home | p170 home › menu:Settings › Data › Sync folder | 3 | flick-up:menu, row “5 Data”, row “4 Sync folder” |
| home | p171 home › menu:Mode › Settings › Counters | 3 | flick-up:menu, row “6 Counters”, tap “Angle unit: Radians. Tap to switch.” |
| home | p172 home › menu:Settings › Counters › Results mode | 3 | flick-up:menu, row “6 Counters”, row “4 Results mode” |
| home | p173 home › menu:Mode › Settings › Help and about | 3 | flick-up:menu, row “7 Help and about”, tap “Angle unit: Radians. Tap to switch.” |
| home | p174 home +dialog:First-start tips +tips | 3 | flick-up:menu, row “7 Help and about”, row “1 Show the first-start tips” |
| home-rows | p176 home › apps:Apps | 1 | tap “Place: Home. Tap to open the apps list.” |
| home-rows | p177 home | 1 | tap “Angle unit: Radians. Tap to switch.” |
| home-rows | p178 home › menu:Mode | 1 | tap “STD” |
| home-rows | p179 home › menu:Mode › Significant digits | 1 | tap “12” |
| home-rows | p180 home › menu:Home menu | 1 | tap “Menu” |
| home-rows | p181 home +row-actions | 1 | tap “31​” |
| home-rows | p183 home › find:Vars | 1 | key vars |
| home-rows | p184 home › find:Find | 1 | key math |
| home-rows | p185 home › menu:Templates | 1 | key tmpl |
| home-rows | p186 home [alpha] | 1 | key alpha |
| home-rows | p187 home [shift] | 1 | key shift |
| home-rows | p188 home [folded] | 1 | line-swipe-down |
| home-rows | p189 home › menu:Home menu | 2 | tap “Menu”, tap “Angle unit: Radians. Tap to switch.” |
| home-rows | p190 home › menu:Home menu › Settings | 2 | tap “Menu”, tap “Settings” |
| home-rows | p191 home › store:Store ≈ 0.333333333333 in | 2 | tap “Menu”, row “4 Store ▶” |
| home-rows | p192 home › menu:Home menu › Copy as | 2 | tap “Menu”, row “6 Copy as” |
| home-rows | p193 home +row-actions | 2 | tap “31​”, tap “Angle unit: Radians. Tap to switch.” |
| home-rows | p194 home › menu:Menu | 2 | tap “31​”, tap “Menu” |
| home-rows | p195 home › menu:Copy as | 2 | tap “31​”, tap “Copy as ›” |
| home-rows | p196 home [alpha] +row-actions | 2 | tap “31​”, key alpha |
| home-rows | p197 home [shift] +row-actions | 2 | tap “31​”, key shift |
| home-rows | p198 home › menu:Home menu › Copy as | 3 | tap “Menu”, row “6 Copy as”, tap “Angle unit: Radians. Tap to switch.” |
| home-rows | p199 home › menu:Menu | 3 | tap “31​”, tap “Menu”, tap “Angle unit: Radians. Tap to switch.” |
| home-rows | p200 home › menu:Menu › Settings | 3 | tap “31​”, tap “Menu”, tap “Settings” |
| home-rows | p201 home › menu:Menu › Copy as | 3 | tap “31​”, tap “Menu”, row “6 Copy as” |
| home-rows | p202 home › menu:Menu › Export | 3 | tap “31​”, tap “Menu”, row “0 Export” |
| home-rows | p203 home › menu:Copy as | 3 | tap “31​”, tap “Copy as ›”, tap “Angle unit: Radians. Tap to switch.” |
| home-rows | p204 home [alpha] +row-actions | 3 | tap “31​”, key alpha, tap “Angle unit: Radians. Tap to switch.” |
| home-rows | p205 home [alpha] › menu:Mode | 3 | tap “31​”, key alpha, tap “STD” |
| home-rows | p206 home [alpha] › menu:Mode › Significant digits | 3 | tap “31​”, key alpha, tap “12” |
| home-rows | p207 home [alpha] › store:Store ≈ 0.333333333333 in | 3 | tap “31​”, key alpha, tap “Store ▶” |
| home-rows | p208 home [alpha] › menu:Copy as | 3 | tap “31​”, key alpha, tap “Copy as ›” |
| home-rows | p209 home [alpha-lock] +row-actions | 3 | tap “31​”, key alpha, key alpha |
| home-rows | p210 home [shift] +row-actions | 3 | tap “31​”, key shift, tap “Angle unit: Radians. Tap to switch.” |
| home-rows | p211 home [shift] › menu:Mode | 3 | tap “31​”, key shift, tap “STD” |
| home-rows | p212 home [shift] › menu:Mode › Significant digits | 3 | tap “31​”, key shift, tap “12” |
| home-rows | p213 home [shift] › store:Store ≈ 0.333333333333 in | 3 | tap “31​”, key shift, tap “Store ▶” |
| home-rows | p214 home [shift] › menu:Copy as | 3 | tap “31​”, key shift, tap “Copy as ›” |
| home-rows | p215 home › menu:Mode › Settings | 3 | tap “31​”, key shift, key menu |
| home-rows | p216 home › find:Memory | 3 | tap “31​”, key shift, key math |
| home-rows | p217 home [unit view] | 3 | tap “31​”, key shift, key tmpl |
| home-rows | p218 home › menu:Menu › Copy as | 4 | tap “31​”, tap “Menu”, row “6 Copy as”, tap “Angle unit: Radians. Tap to switch.” |
| home-rows | p219 home › menu:Menu › Export | 4 | tap “31​”, tap “Menu”, row “0 Export”, tap “Angle unit: Radians. Tap to switch.” |
| home-rows | p220 home [alpha-lock] › apps:Apps | 4 | tap “31​”, key alpha, key alpha, tap “Place: Home. Tap to open the apps list.” |
| home-rows | p222 home [alpha-lock] +row-actions | 4 | tap “31​”, key alpha, key alpha, tap “Angle unit: Radians. Tap to switch.” |
| home-rows | p223 home [alpha-lock] › menu:Mode | 4 | tap “31​”, key alpha, key alpha, tap “STD” |
| home-rows | p224 home [alpha-lock] › menu:Mode › Significant digits | 4 | tap “31​”, key alpha, key alpha, tap “12” |
| home-rows | p225 home [alpha-lock] › menu:Menu | 4 | tap “31​”, key alpha, key alpha, tap “Menu” |
| home-rows | p221 home [alpha-lock] | 4 | tap “31​”, key alpha, key alpha, tap “31​” |
| home-rows | p226 home [alpha-lock] › store:Store ≈ 0.333333333333 in | 4 | tap “31​”, key alpha, key alpha, tap “Store ▶” |
| home-rows | p227 home [alpha-lock] › menu:Copy as | 4 | tap “31​”, key alpha, key alpha, tap “Copy as ›” |
| home-line | p229 home › apps:Apps | 1 | tap “Place: Home. Tap to open the apps list.” |
| home-line | p230 home | 1 | tap “Angle unit: Radians. Tap to switch.” |
| home-line | p231 home › menu:Mode | 1 | tap “STD” |
| home-line | p232 home › menu:Mode › Significant digits | 1 | tap “12” |
| home-line | p233 home › menu:Home menu | 1 | tap “Menu” |
| home-line | p234 home › find:Vars | 1 | key vars |
| home-line | p235 home › find:Find | 1 | key math |
| home-line | p236 home › menu:Templates | 1 | key tmpl |
| home-line | p237 home [alpha] | 1 | key alpha |
| home-line | p239 home [shift] | 1 | key shift |
| home-line | p240 home [folded] | 1 | line-swipe-down |
| home-line | p241 home › menu:Home menu | 2 | tap “Menu”, tap “Angle unit: Radians. Tap to switch.” |
| home-line | p242 home › menu:Home menu › Settings | 2 | tap “Menu”, tap “Settings” |
| cas | p244 cas › apps:Apps | 1 | tap “Place: CAS. Tap to open the apps list.” |
| cas | p245 cas | 1 | tap “Angle unit: Radians. Tap to switch.” |
| cas | p246 cas › menu:Mode | 1 | tap “STD” |
| cas | p247 cas › menu:Mode › Significant digits | 1 | tap “12” |
| cas | p248 cas › menu:CAS menu | 1 | tap “Menu” |
| cas | p249 cas › find:Vars | 1 | key vars |
| cas | p250 cas › find:Find | 1 | key math |
| cas | p251 cas › menu:Templates | 1 | key tmpl |
| cas | p252 cas [alpha] | 1 | key alpha |
| cas | p254 cas [shift] | 1 | key shift |
| cas | p255 cas [folded] | 1 | line-swipe-down |
| cas | p256 cas +credits › menu:N62 | 1 | mark-tap |
| cas | p257 cas › menu:CAS menu | 2 | tap “Menu”, tap “Angle unit: Radians. Tap to switch.” |
| cas | p258 cas › menu:CAS menu › Settings | 2 | tap “Menu”, tap “Settings” |
| function | p260 function/symb › apps:Apps | 1 | tap “Place: Function. Tap to open the apps list.” |
| function | p261 function/plot | 1 | tap “Plot” |
| function | p262 function/num | 1 | tap “Num” |
| function | p263 function/symb | 1 | tap “Angle unit: Radians. Tap to switch.” |
| function | p264 function/symb › menu:Mode | 1 | tap “STD” |
| function | p265 function/symb › menu:Mode › Significant digits | 1 | tap “12” |
| function | p266 function/symb › menu:Symb menu | 1 | tap “Menu” |
| function | p267 function/symb › find:Vars | 1 | key vars |
| function | p268 function/symb › find:Find | 1 | key math |
| function | p269 function/symb › menu:Templates | 1 | key tmpl |
| function | p270 function/symb [alpha] | 1 | key alpha |
| function | p272 function/symb [shift] | 1 | key shift |
| function | p273 function/symb › menu:Symb menu | 2 | tap “Menu”, tap “Angle unit: Radians. Tap to switch.” |
| function | p274 function/symb › menu:Symb menu › Settings | 2 | tap “Menu”, tap “Settings” |
| function | p275 function/plot › menu:Plot menu | 2 | tap “Menu”, row “3 Root, extremum … in Plot” |
| function | p276 function/plot › apps:Apps | 3 | tap “Menu”, row “3 Root, extremum … in Plot”, tap “Place: Function. Tap to open the apps list.” |
| function | p277 function/plot › menu:Plot menu | 3 | tap “Menu”, row “3 Root, extremum … in Plot”, tap “Angle unit: Radians. Tap to switch.” |
| function | p278 function/plot › menu:Mode | 3 | tap “Menu”, row “3 Root, extremum … in Plot”, tap “STD” |
| function | p279 function/plot › menu:Mode › Significant digits | 3 | tap “Menu”, row “3 Root, extremum … in Plot”, tap “12” |
| function | p280 function/plot › menu:Plot menu › Settings | 3 | tap “Menu”, row “3 Root, extremum … in Plot”, tap “Settings” |
| function | p281 function/plot › menu:Plot menu › Intersection of F1(x) and | 3 | tap “Menu”, row “3 Root, extremum … in Plot”, row “3 Intersection” |
| function | p282 function/plot › menu:Plot menu › Intersection of F1(x) and | 4 | tap “Menu”, row “3 Root, extremum … in Plot”, row “3 Intersection”, tap “Angle unit: Radians. Tap to switch.” |
| function-plot | p284 function/plot › apps:Apps | 1 | tap “Place: Function. Tap to open the apps list.” |
| function-plot | p285 function/symb | 1 | tap “Symb” |
| function-plot | p286 function/num | 1 | tap “Num” |
| function-plot | p287 function/plot | 1 | tap “Angle unit: Radians. Tap to switch.” |
| function-plot | p288 function/plot › menu:Mode | 1 | tap “STD” |
| function-plot | p289 function/plot › menu:Mode › Significant digits | 1 | tap “12” |
| function-plot | p290 function/plot › menu:Plot menu | 1 | tap “Menu” |
| function-plot | p291 function/plot [alpha] | 1 | key alpha |
| function-plot | p293 function/plot [shift] | 1 | key shift |
| function-plot | p294 function/plot › menu:Plot menu | 2 | tap “Menu”, tap “Angle unit: Radians. Tap to switch.” |
| function-plot | p295 function/plot › menu:Plot menu › Settings | 2 | tap “Menu”, tap “Settings” |
| function-plot | p296 function/plot › menu:Plot menu › Intersection of F1(x) and | 2 | tap “Menu”, row “3 Intersection” |
| function-plot | p297 function/plot › menu:Plot menu › Intersection of F1(x) and | 3 | tap “Menu”, row “3 Intersection”, tap “Angle unit: Radians. Tap to switch.” |
| function-num | p299 function/num › apps:Apps | 1 | tap “Place: Function. Tap to open the apps list.” |
| function-num | p300 function/symb | 1 | tap “Symb” |
| function-num | p301 function/plot | 1 | tap “Plot” |
| function-num | p302 function/num | 1 | tap “Angle unit: Radians. Tap to switch.” |
| function-num | p303 function/num › menu:Mode | 1 | tap “STD” |
| function-num | p304 function/num › menu:Mode › Significant digits | 1 | tap “12” |
| function-num | p305 function/num › menu:Num menu | 1 | tap “Menu” |
| function-num | p306 function/num › find:Vars | 1 | key vars |
| function-num | p307 function/num › find:Find | 1 | key math |
| function-num | p308 function/num › menu:Templates | 1 | key tmpl |
| function-num | p309 function/num [alpha] | 1 | key alpha |
| function-num | p311 function/num [shift] | 1 | key shift |
| function-num | p312 function/num › menu:Num menu | 2 | tap “Menu”, tap “Angle unit: Radians. Tap to switch.” |
| function-num | p313 function/num › menu:Num menu › Settings | 2 | tap “Menu”, tap “Settings” |
| solve | p315 solve/symb › apps:Apps | 1 | tap “Place: Solve. Tap to open the apps list.” |
| solve | p316 solve/num | 1 | tap “Num” |
| solve | p317 solve/symb | 1 | tap “Angle unit: Radians. Tap to switch.” |
| solve | p318 solve/symb › menu:Mode | 1 | tap “STD” |
| solve | p319 solve/symb › menu:Mode › Significant digits | 1 | tap “12” |
| solve | p320 solve/symb › menu:Symb menu | 1 | tap “Menu” |
| solve | p321 solve/symb › find:Vars | 1 | key vars |
| solve | p322 solve/symb › find:Find | 1 | key math |
| solve | p323 solve/symb › menu:Templates | 1 | key tmpl |
| solve | p324 solve/symb [alpha] | 1 | key alpha |
| solve | p326 solve/symb [shift] | 1 | key shift |
| solve | p327 solve/symb › menu:Symb menu | 2 | tap “Menu”, tap “Angle unit: Radians. Tap to switch.” |
| solve | p328 solve/symb › menu:Symb menu › Settings | 2 | tap “Menu”, tap “Settings” |
| solve | p329 solve/num › menu:Num menu | 2 | tap “Menu”, row “3 Solve, polynomial roots … in Num” |
| solve | p330 solve/num › apps:Apps | 3 | tap “Menu”, row “3 Solve, polynomial roots … in Num”, tap “Place: Solve. Tap to open the apps list.” |
| solve | p331 solve/num › menu:Num menu | 3 | tap “Menu”, row “3 Solve, polynomial roots … in Num”, tap “Angle unit: Radians. Tap to switch.” |
| solve | p332 solve/num › menu:Mode | 3 | tap “Menu”, row “3 Solve, polynomial roots … in Num”, tap “STD” |
| solve | p333 solve/num › menu:Mode › Significant digits | 3 | tap “Menu”, row “3 Solve, polynomial roots … in Num”, tap “12” |
| solve | p334 solve/num › menu:Num menu › Settings | 3 | tap “Menu”, row “3 Solve, polynomial roots … in Num”, tap “Settings” |
| units | p336 home › apps:Apps | 1 | tap “Place: Home. Tap to open the apps list.” |
| units | p338 home [unit view] | 1 | tap “Angle unit: Radians. Tap to switch.” |
| units | p339 home [unit view] › menu:Mode | 1 | tap “STD” |
| units | p340 home [unit view] › menu:Mode › Significant digits | 1 | tap “12” |
| units | p337 home | 1 | key esc |
| units | p341 home [unit view] › find:Find | 1 | key math |
| units | p342 home [alpha] [unit view] | 1 | key alpha |
| units | p344 home [shift] [unit view] | 1 | key shift |
| folded | p346 home [folded] › apps:Apps | 1 | tap “Place: Home. Tap to open the apps list.” |
| folded | p347 home [folded] | 1 | tap “Angle unit: Radians. Tap to switch.” |
| folded | p348 home [folded] › menu:Mode | 1 | tap “STD” |
| folded | p349 home [folded] › menu:Mode › Significant digits | 1 | tap “12” |
| folded | p350 home [folded] › menu:Home menu | 1 | tap “Menu” |
| folded | p351 home [folded] +row-actions | 1 | tap “31​” |
| folded | p353 home | 1 | tap “Show keypad” |
| folded | p354 home [folded] › menu:Home menu | 2 | tap “Menu”, tap “Angle unit: Radians. Tap to switch.” |
| folded | p355 home [folded] › menu:Home menu › Settings | 2 | tap “Menu”, tap “Settings” |
| folded | p356 home › store:Store ≈ 0.333333333333 in | 2 | tap “Menu”, row “4 Store ▶” |
| folded | p357 home [folded] › menu:Home menu › Copy as | 2 | tap “Menu”, row “6 Copy as” |
| folded | p358 home › menu:Home menu | 2 | tap “Menu”, tap “Show keypad” |
| folded | p359 home [folded] +row-actions | 2 | tap “31​”, tap “Angle unit: Radians. Tap to switch.” |
| folded | p360 home [folded] › menu:Menu | 2 | tap “31​”, tap “Menu” |
| folded | p361 home [folded] › menu:Copy as | 2 | tap “31​”, tap “Copy as ›” |
| folded | p352 home +row-actions | 2 | tap “31​”, tap “Show keypad” |
| folded | p362 home [folded] › menu:Home menu › Copy as | 3 | tap “Menu”, row “6 Copy as”, tap “Angle unit: Radians. Tap to switch.” |
| folded | p363 home › menu:Home menu › Copy as | 3 | tap “Menu”, row “6 Copy as”, tap “Show keypad” |
| folded | p364 home › apps:Apps | 3 | tap “Menu”, tap “Show keypad”, tap “Place: Home. Tap to open the apps list.” |
| folded | p365 home › menu:Home menu | 3 | tap “Menu”, tap “Show keypad”, tap “Angle unit: Radians. Tap to switch.” |
| folded | p366 home › menu:Mode | 3 | tap “Menu”, tap “Show keypad”, tap “STD” |
| folded | p367 home › menu:Mode › Significant digits | 3 | tap “Menu”, tap “Show keypad”, tap “12” |
| folded | p368 home › menu:Home menu › Settings | 3 | tap “Menu”, tap “Show keypad”, tap “Settings” |
| folded | p369 home › menu:Home menu › Export | 3 | tap “Menu”, tap “Show keypad”, row “0 Export” |
| folded | p370 home [folded] › menu:Menu | 3 | tap “31​”, tap “Menu”, tap “Angle unit: Radians. Tap to switch.” |
| folded | p371 home [folded] › menu:Menu › Settings | 3 | tap “31​”, tap “Menu”, tap “Settings” |
| folded | p372 home [folded] › menu:Menu › Copy as | 3 | tap “31​”, tap “Menu”, row “6 Copy as” |
| folded | p373 home [folded] › menu:Menu › Export | 3 | tap “31​”, tap “Menu”, row “0 Export” |
| folded | p374 home › menu:Menu | 3 | tap “31​”, tap “Menu”, tap “Show keypad” |
| folded | p375 home [folded] › menu:Copy as | 3 | tap “31​”, tap “Copy as ›”, tap “Angle unit: Radians. Tap to switch.” |
| folded | p376 home › menu:Copy as | 3 | tap “31​”, tap “Copy as ›”, tap “Show keypad” |
| folded | p377 home +row-actions | 3 | tap “31​”, tap “Show keypad”, tap “Angle unit: Radians. Tap to switch.” |
| folded | p379 home › menu:Home menu › Copy as | 4 | tap “Menu”, row “6 Copy as”, tap “Show keypad”, tap “Angle unit: Radians. Tap to switch.” |
| folded | p380 home › menu:Home menu › Export | 4 | tap “Menu”, tap “Show keypad”, row “0 Export”, tap “Angle unit: Radians. Tap to switch.” |
| folded | p381 home [folded] › menu:Menu › Copy as | 4 | tap “31​”, tap “Menu”, row “6 Copy as”, tap “Angle unit: Radians. Tap to switch.” |
| folded | p382 home [folded] › menu:Menu › Export | 4 | tap “31​”, tap “Menu”, row “0 Export”, tap “Angle unit: Radians. Tap to switch.” |
| folded | p383 home › menu:Menu › Export | 4 | tap “31​”, tap “Menu”, row “0 Export”, tap “Show keypad” |
| folded | p384 home › menu:Menu | 4 | tap “31​”, tap “Menu”, tap “Show keypad”, tap “Angle unit: Radians. Tap to switch.” |
| folded | p385 home › menu:Menu › Settings | 4 | tap “31​”, tap “Menu”, tap “Show keypad”, tap “Settings” |
| folded | p386 home › menu:Menu › Copy as | 4 | tap “31​”, tap “Menu”, tap “Show keypad”, row “6 Copy as” |
| folded | p387 home › menu:Copy as | 4 | tap “31​”, tap “Copy as ›”, tap “Show keypad”, tap “Angle unit: Radians. Tap to switch.” |

## tablet (1280 × 716 CSS px; 95 states, 650 edges)

### tips: t073 home +dialog:First-start tips +tips

- tap “Got it” → t074 home · 297 ms
- Android Back → t074 home

### home: t075 home

- tap “Place: Home. Tap to open the apps list.” → t076 home › apps:Apps · Back → t075 · × → t075 · 331 ms
  - tap “Place: Home. Tap to open the apps list.” → t075 home · 288 ms
  - tap “Angle unit: Radians. Tap to switch.” → t097 home › apps:Apps (a setting changed) · 277 ms
  - tap “STD” → t078 home › menu:Mode · Back → t075 · × → t075
    - tap “Place: Home. Tap to open the apps list.” → t076 home › apps:Apps · Back → t075 · × → t075 · 52 ms
    - tap “Angle unit: Radians. Tap to switch.” → t101 home › menu:Mode (a setting changed) · 289 ms
    - tap “STD” · stays
    - tap “12” → t079 home › menu:Mode › Significant digits · Back → t078 · × → t075
      - tap “Place: Home. Tap to open the apps list.” → t076 home › apps:Apps · Back → t075 · × → t075 · 71 ms
      - tap “Angle unit: Radians. Tap to switch.” → t111 home › menu:Mode › Significant digits (a setting changed) · 275 ms
      - tap “STD” → t078 home › menu:Mode · Back → t075 · × → t075
      - tap “12” · stays
      - tap “Menu” → t075 home · 284 ms
      - key u1 → t075 home · 7 ms
      - key u2 → t075 home · 3 ms
      - key up → t075 home · 3 ms
      - key menu → t075 home · 3 ms
      - key esc → t078 home › menu:Mode · Back → t075 · × → t075
      - key u3 → t075 home · 3 ms
      - key u4 → t075 home · 3 ms
      - key left → t075 home · 2 ms
      - key right → t075 home · 2 ms
      - key undo → t075 home · 2 ms
      - key redo → t075 home · 2 ms
      - key u5 → t075 home · 5 ms
      - key u6 → t075 home · 3 ms
      - key down → t075 home · 6 ms
      - key select → t075 home · 2 ms
      - key deselect → t075 home · 2 ms
      - key vars → t075 home · 2 ms
      - key math → t075 home · 6 ms
      - key tmpl → t075 home · 2 ms
      - key x → t075 home · 2 ms
      - key frac → t075 home · 7 ms
      - key bksp → t075 home
      - tap “Back” → t078 home › menu:Mode · Back → t075 · × → t075
      - tap “Close” → t075 home · 287 ms
      - row “1 4” → t112 home (a setting changed) · 417 ms
      - row “2 6” → t113 home (a setting changed) · 312 ms
      - row “3 8” → t114 home (a setting changed) · 286 ms
      - row “4 10” → t115 home (a setting changed) · 321 ms
      - row “5 12” → t075 home · 293 ms
      - row “6 15” → t116 home (a setting changed) · 294 ms
      - row “7 20” → t117 home (a setting changed) · 259 ms
      - row “8 25” → t118 home (a setting changed) · 291 ms
      - row “9 30” → t119 home (a setting changed) · 283 ms
      - Android Back → t078 home › menu:Mode · 336 ms
      - tap outside → t075 home · 317 ms
    - tap “Menu” → t075 home · 362 ms
    - key u1 → t075 home · 6 ms
    - key u2 → t075 home · 1 ms
    - key up → t075 home · 2 ms
    - key menu → t075 home · 5 ms
    - key esc → t075 home · 3 ms
    - key u3 → t075 home · 3 ms
    - key u4 → t075 home · 12 ms
    - key left → t075 home · 3 ms
    - key right → t075 home · 2 ms
    - key undo → t075 home · 3 ms
    - key redo → t075 home · 3 ms
    - key u5 → t075 home · 6 ms
    - key u6 → t075 home · 3 ms
    - key down → t075 home · 3 ms
    - key select → t075 home · 2 ms
    - key deselect → t075 home · 2 ms
    - key vars → t075 home · 2 ms
    - key math → t075 home · 2 ms
    - key tmpl → t075 home · 18 ms
    - key x → t075 home · 6 ms
    - key frac → t075 home · 2 ms
    - key bksp → t075 home
    - key pow → t075 home · 2 ms
    - key sin → t075 home · 2 ms
    - key cos → t075 home · 3 ms
    - key tan → t075 home · 2 ms
    - key ln → t075 home · 2 ms
    - key log → t075 home · 2 ms
    - tap “Close” → t075 home · 295 ms
    - row “1 Angle” → t101 home › menu:Mode (a setting changed) · 276 ms
    - tap “Radians” → t075 home · 280 ms
    - tap “Degrees” → t077 home (a setting changed) · 370 ms
    - row “2 Number format” → t102 home › menu:Mode (a setting changed) · 348 ms
    - tap “Standard” → t075 home · 288 ms
    - tap “Scientific” → t103 home (a setting changed) · 284 ms
    - tap “Engineering” → t104 home (a setting changed) · 303 ms
    - tap “Prefixes (k, M, µ …)” → t105 home (a setting changed) · 324 ms
    - row “3 Significant digits” → t079 home › menu:Mode › Significant digits · Back → t078 · × → t075
    - tap “Previous value” → t106 home › menu:Mode (a setting changed) · 334 ms
    - tap “Next value” → t107 home › menu:Mode (a setting changed) · 335 ms
    - row “4 Entry” → t108 home › menu:Mode (a setting changed)
    - tap “Textbook” → t075 home · 275 ms
    - tap “One line” → t109 home (a setting changed) · 472 ms
    - row “5 Preset” → t110 home › menu:Mode › Presets · Back → t078 · × → t075
    - tap “Previous value” · stays
    - tap “Next value” · stays
    - row “6 Settings” → t096 home › menu:Mode › Settings · Back → t078 · × → t075
    - Android Back → t075 home · 1053 ms
    - tap outside → t075 home · 283 ms
  - tap “12” → t079 home › menu:Mode › Significant digits · Back → t078 · × → t075
  - tap “Menu” → t080 home › menu:Home menu · Back → t075 · × → t075
    - tap “Place: Home. Tap to open the apps list.” → t076 home › apps:Apps · Back → t075 · × → t075 · 0 ms
    - tap “Angle unit: Radians. Tap to switch.” → t120 home › menu:Home menu (a setting changed) · 353 ms
    - tap “STD” → t078 home › menu:Mode · Back → t075 · × → t075
    - tap “12” → t079 home › menu:Mode › Significant digits · Back → t078 · × → t075
    - tap “Menu” → t075 home · 290 ms
    - key u1 → t075 home · 8 ms
    - key u2 → t075 home · 12 ms
    - key up → t075 home · 3 ms
    - key menu → t075 home · 2 ms
    - key esc → t075 home · 4 ms
    - key u3 → t075 home · 4 ms
    - key u4 → t075 home · 19 ms
    - key left → t075 home · 2 ms
    - key right → t075 home · 4 ms
    - key undo → t075 home · 3 ms
    - key redo → t075 home · 2 ms
    - key u5 → t075 home · 2 ms
    - key u6 → t075 home · 2 ms
    - key down → t075 home · 4 ms
    - key select → t075 home · 5 ms
    - key deselect → t075 home · 5 ms
    - key vars → t075 home · 4 ms
    - key math → t075 home · 2 ms
    - key tmpl → t075 home · 5 ms
    - key x → t075 home · 4 ms
    - key frac → t075 home · 4 ms
    - key bksp → t075 home
    - tap “Settings” → t121 home › menu:Home menu › Settings · Back → t080 · × → t075
    - tap “Close” → t075 home · 111 ms
    - row “1 Insert” · stays
    - row “2 Recall” · stays
    - row “3 Copy” · stays
    - row “4 Store ▶” · stays
    - row “5 Delete” · stays
    - row “6 Copy as” · stays
    - row “7 Paste” → t075 home · 1993 ms
    - row “8 Share session” · stays
    - row “9 Clear history” · stays
    - row “0 Export” · stays
    - Android Back → t075 home · 2050 ms
    - tap outside → t075 home · 418 ms
  - key u1 → t075 home · 4 ms
  - key u2 → t075 home · 2 ms
  - key up → t075 home · 2 ms
  - key menu → t075 home · 2 ms
  - key esc → t075 home · 2 ms
  - key u3 → t075 home · 2 ms
  - key u4 → t075 home · 2 ms
  - key left → t075 home · 1 ms
  - key right → t075 home · 2 ms
  - key undo → t075 home · 2 ms
  - key redo → t075 home · 2 ms
  - key u5 → t075 home · 2 ms
  - key u6 → t075 home · 8 ms
  - key down → t075 home · 1 ms
  - key select → t075 home · 22 ms
  - key deselect → t075 home · 2 ms
  - key vars → t075 home · 2 ms
  - key math → t075 home · 2 ms
  - key tmpl → t075 home · 2 ms
  - key x → t075 home · 2 ms
  - key frac → t075 home · 2 ms
  - key bksp → t075 home
  - key pow → t075 home · 2 ms
  - key sin → t075 home · 2 ms
  - key cos → t075 home · 2 ms
  - key tan → t075 home · 1 ms
  - key ln → t075 home · 2 ms
  - key log → t075 home · 1 ms
  - key sq → t075 home · 5 ms
  - key neg → t075 home · 2 ms
  - key paren → t075 home · 3 ms
  - key comma → t075 home · 3 ms
  - key enter → t075 home · 2 ms
  - key emark → t075 home · 2 ms
  - key d7 → t075 home · 2 ms
  - key d8 → t075 home · 2 ms
  - key d9 → t075 home · 2 ms
  - key div → t075 home · 3 ms
  - tap “Close” → t075 home · 279 ms
  - row “1 Home” → t075 home · 288 ms
  - row “2 CAS” → t098 cas · 372 ms
  - row “3 Function” → t099 function/symb · 348 ms
  - row “4 Solve” → t100 solve/symb · 469 ms
  - Android Back → t075 home · 1369 ms
  - tap outside → t075 home · 301 ms
- tap “Angle unit: Radians. Tap to switch.” → t077 home (a setting changed) · 299 ms
- tap “STD” → t078 home › menu:Mode · Back → t075 · × → t075 · 338 ms
- tap “12” → t079 home › menu:Mode › Significant digits · Back → t078 · × → t075 · 297 ms
- tap “Menu” → t080 home › menu:Home menu · Back → t075 · × → t075 · 298 ms
- key menu → t080 home › menu:Home menu · Back → t075 · × → t075 · 19 ms
- key vars → t081 home › find:Vars · Back → t075 · × → t075 · 51 ms
  - tap “Place: Home. Tap to open the apps list.” → t076 home › apps:Apps · Back → t075 · × → t075 · 174 ms
  - tap “Angle unit: Radians. Tap to switch.” → t122 home › find:Vars (a setting changed) · 309 ms
  - tap “STD” → t078 home › menu:Mode · Back → t075 · × → t075 · 380 ms
  - tap “12” → t079 home › menu:Mode › Significant digits · Back → t078 · × → t075 · 344 ms
  - tap “Menu” → t075 home · 282 ms
  - tap “Close” → t075 home · 347 ms
  - row “A” → t075 home · 444 ms
  - row “B” → t075 home · 53 ms
  - row “C” → t075 home · 129 ms
  - row “D” → t075 home · 35 ms
  - row “E” → t075 home · 291 ms
  - row “F” → t075 home · 299 ms
  - row “G” → t075 home · 419 ms
  - row “H” → t075 home · 231 ms
  - row “I” → t075 home · 303 ms
  - row “J” → t075 home · 283 ms
  - row “Y” → t075 home · 309 ms
  - row “Z” → t075 home · 289 ms
  - key menu → t075 home · 2 ms
  - key esc → t075 home · 2 ms
  - key vars → t123 home › find:Vars · 39 ms
  - key math → t123 home › find:Vars · 7 ms
  - key tmpl → t123 home › find:Vars · 9 ms
  - key x → t123 home › find:Vars · 24 ms
  - key sin → t123 home › find:Vars · 4 ms
  - key enter → t075 home · 21 ms
  - key alpha → t124 home [alpha] › find:Vars · Back → t084 · × → t084 · 101 ms
  - key shift → t125 home [shift] › find:Vars · Back → t086 · × → t086 · 74 ms
  - Android Back → t075 home · 1808 ms
  - tap outside → t075 home · 294 ms
- key math → t082 home › find:Find · Back → t075 · × → t075 · 20 ms
  - tap “Place: Home. Tap to open the apps list.” → t076 home › apps:Apps · Back → t075 · × → t075 · 292 ms
  - tap “Angle unit: Radians. Tap to switch.” → t126 home › find:Find (a setting changed) · 291 ms
  - tap “STD” → t078 home › menu:Mode · Back → t075 · × → t075 · 370 ms
  - tap “12” → t079 home › menu:Mode › Significant digits · Back → t078 · × → t075 · 481 ms
  - tap “Menu” → t075 home · 335 ms
  - tap “Close” → t075 home · 315 ms
  - row “1 Arithmetic” → t127 home › find:Find › Arithmetic · Back → t082 · × → t075 · 303 ms
  - row “2 Powers and logarithms” → t128 home › find:Find › Powers and logarithms · Back → t082 · × → t075 · 305 ms
  - row “3 Trigonometry” → t129 home › find:Find › Trigonometry · Back → t082 · × → t075 · 346 ms
  - row “4 Calculus” → t130 home › find:Find › Calculus · Back → t082 · × → t075 · 319 ms
  - row “5 Algebra and solving” → t131 home › find:Find › Algebra and solving · Back → t082 · × → t075 · 308 ms
  - row “6 Matrices and vectors” → t132 home › find:Find › Matrices and vectors · Back → t082 · × → t075 · 274 ms
  - row “7 Probability and statistics” → t133 home › find:Find › Probability and statistics · Back → t082 · × → t075 · 391 ms
  - row “8 Engineering” → t134 home › find:Find › Engineering · Back → t082 · × → t075 · 293 ms
  - row “9 Constants” → t135 home › find:Find › Constants · Back → t082 · × → t075 · 411 ms
  - row “0 Units and prefixes” → t136 home › find:Find › Units and prefixes · Back → t082 · × → t075 · 946 ms
  - row “Bits and words” → t137 home › find:Find › Bits and words · Back → t082 · × → t075 · 287 ms
  - row “Complex numbers” → t138 home › find:Find › Complex numbers · Back → t082 · × → t075 · 28 ms
  - key menu → t075 home · 2 ms
  - key esc → t075 home · 4 ms
  - key left → t075 home · 12 ms
  - key right → t127 home › find:Find › Arithmetic · Back → t082 · × → t075 · 16 ms
  - key vars → t139 home › find:Find · Back → t075 · × → t075 · 36 ms
  - key math → t139 home › find:Find · Back → t075 · × → t075 · 105 ms
  - key tmpl → t139 home › find:Find · Back → t075 · × → t075 · 56 ms
  - key x → t139 home › find:Find · Back → t075 · × → t075 · 34 ms
  - key sin → t139 home › find:Find · Back → t075 · × → t075 · 19 ms
  - key enter → t127 home › find:Find › Arithmetic · Back → t082 · × → t075 · 16 ms
  - key alpha → t140 home [alpha] › find:Find · Back → t084 · × → t084 · 48 ms
  - key shift → t141 home [shift] › find:Find · Back → t086 · × → t086 · 121 ms
  - key d1 → t127 home › find:Find › Arithmetic · Back → t082 · × → t075 · 31 ms
  - Android Back → t075 home · 1692 ms
  - tap outside → t075 home · 422 ms
- key tmpl → t083 home › menu:Templates · Back → t075 · × → t075 · 150 ms
  - tap “Place: Home. Tap to open the apps list.” → t076 home › apps:Apps · Back → t075 · × → t075 · 22 ms
  - tap “Angle unit: Radians. Tap to switch.” → t142 home › menu:Templates (a setting changed) · 254 ms
  - tap “STD” → t078 home › menu:Mode · Back → t075 · × → t075
  - tap “12” → t079 home › menu:Mode › Significant digits · Back → t078 · × → t075
  - tap “Menu” → t080 home › menu:Home menu · Back → t075 · × → t075 · 0 ms
  - key u1 → t075 home · 15 ms
  - key u2 → t075 home · 7 ms
  - key up → t075 home · 5 ms
  - key menu → t075 home · 6 ms
  - key esc → t075 home · 32 ms
  - key u3 → t075 home · 13 ms
  - key u4 → t075 home · 16 ms
  - key left → t075 home · 34 ms
  - key right → t075 home · 13 ms
  - key undo → t075 home · 49 ms
  - key redo → t075 home · 13 ms
  - key u5 → t075 home · 52 ms
  - key u6 → t075 home · 14 ms
  - key down → t075 home · 5 ms
  - key select → t075 home · 13 ms
  - key deselect → t075 home · 18 ms
  - key vars → t075 home · 7 ms
  - key math → t075 home · 14 ms
  - key tmpl → t075 home · 9 ms
  - key x → t075 home · 7 ms
  - key frac → t075 home · 8 ms
  - key bksp → t075 home
  - key pow → t075 home · 9 ms
  - key sin → t075 home · 6 ms
  - key cos → t075 home · 8 ms
  - key tan → t075 home · 4 ms
  - key ln → t075 home · 5 ms
  - key log → t075 home · 21 ms
  - key sq → t075 home · 11 ms
  - key neg → t075 home · 5 ms
  - key paren → t075 home · 14 ms
  - key comma → t075 home · 13 ms
  - key enter → t075 home · 5 ms
  - key emark → t075 home · 12 ms
  - key d7 → t075 home · 9 ms
  - key d8 → t075 home · 14 ms
  - key d9 → t075 home · 12 ms
  - key div → t075 home · 28 ms
  - tap “Close” → t075 home · 154 ms
  - row “Fraction” → t075 home · 289 ms
  - row “Power” → t075 home · 51 ms
  - row “Evaluate at” → t075 home · 361 ms
  - row “Derivative” → t075 home · 219 ms
  - row “Piecewise” → t075 home · 282 ms
  - row “2×2 matrix” → t075 home · 519 ms
  - row “Square root” → t075 home · 371 ms
  - row “nth root” → t075 home · 401 ms
  - row “Limit” → t075 home · 433 ms
  - row “Definite integral” → t075 home · 334 ms
  - row “Logarithm with base” → t075 home · 69 ms
  - row “Degrees, minutes, seconds” → t075 home · 507 ms
  - Android Back → t075 home · 4319 ms
  - tap outside → t075 home · 16 ms
- key alpha → t084 home [alpha] · Back → t085 · 30 ms
- key shift → t086 home [shift] · Back → t085 · 41 ms
- Android Back → t085 Android: com.android.launcher3/.uioverrides.QuickstepLauncher
- mark-tap → t087 home +credits › menu:N62 · Back → t075 · × → t075 · 338 ms
  - tap “Place: Home. Tap to open the apps list.” → t076 home › apps:Apps · Back → t075 · × → t075 · 0 ms
  - tap “Angle unit: Radians. Tap to switch.” → t143 home +credits › menu:N62 (a setting changed) · 172 ms
  - tap “STD” → t078 home › menu:Mode · Back → t075 · × → t075
  - tap “12” → t079 home › menu:Mode › Significant digits · Back → t078 · × → t075
  - tap “Menu” → t075 home · 391 ms
  - key u1 → t075 home · 6 ms
  - key u2 → t075 home · 15 ms
  - key up → t075 home · 4 ms
  - key menu → t075 home · 4 ms
  - key esc → t075 home · 19 ms
  - key u3 → t075 home · 7 ms
  - key u4 → t075 home · 5 ms
  - key left → t075 home · 3 ms
  - key right → t075 home · 3 ms
  - key undo → t075 home · 11 ms
  - key redo → t075 home · 7 ms
  - key u5 → t075 home · 4 ms
  - key u6 → t075 home · 9 ms
  - key down → t075 home · 9 ms
  - key select → t075 home · 26 ms
  - key deselect → t075 home · 9 ms
  - tap “Close” → t075 home · 102 ms
  - Android Back → t075 home · 3174 ms
  - tap outside → t075 home · 118 ms
- line-swipe-down · stays
- pad-drag-right · stays
- pad-drag-up · stays
- flick-up:vars · stays · notice “Paste: not a number” · 156 ms
- flick-down:vars · stays · line A · 1190 ms
- flick-up:math → t088 home › find:Memory · Back → t075 · × → t075 · 32 ms
  - tap “Place: Home. Tap to open the apps list.” → t076 home › apps:Apps · Back → t075 · × → t075 · 326 ms
  - tap “Angle unit: Radians. Tap to switch.” → t144 home › find:Memory (a setting changed) · 285 ms
  - tap “STD” → t078 home › menu:Mode · Back → t075 · × → t075 · 75 ms
  - tap “12” → t079 home › menu:Mode › Significant digits · Back → t078 · × → t075 · 591 ms
  - tap “Menu” → t075 home · 273 ms
  - tap “Close” → t075 home · 105 ms
  - key menu → t075 home · 10 ms
  - key esc → t075 home · 3 ms
  - key left → t075 home · 5 ms
- flick-down:math · stays · line B
- flick-up:tmpl → t089 home [unit view] · Back → t085 · 106 ms
- flick-down:tmpl · stays · line C
- flick-up:x · stays · line y
- flick-down:x · stays · line D
- flick-up:frac · stays
- flick-down:frac · stays · line E
- flick-up:pow · stays · line \sqrt[\placeholder{}]{\placeholder{}}
- flick-down:pow · stays · line F
- flick-up:sin · stays · line \arcsin\left(\placeholder{}\right)
- flick-down:sin · stays · line G
- flick-up:cos · stays · line \arccos\left(\placeholder{}\right)
- flick-down:cos · stays · line H
- flick-up:tan · stays · line \arctan\left(\placeholder{}\right)
- flick-down:tan · stays · line I
- flick-up:ln · stays · line \exponentialE^{\placeholder{}}
- flick-down:ln · stays · line J
- flick-up:log · stays · line 10^{\placeholder{}}
- flick-down:log · stays · line K
- flick-up:sq · stays · line \sqrt{\placeholder{}}
- flick-down:sq · stays · line L
- flick-up:neg · stays · line \left\|\placeholder{}\right\|
- flick-down:neg · stays · line M
- flick-up:paren · stays · line \operatorname{\mathrm{par}}\left(\placeh
- flick-down:paren · stays · line N
- flick-up:comma · stays · line \pm
- flick-down:comma · stays · line O
- flick-up:emark → t090 home › store:Store in · Back → t075 · × → t075 · 53 ms
- flick-down:emark · stays · line P
- flick-up:d7 · stays
- flick-down:d7 · stays · line Q
- flick-up:d8 · stays · line \left\{\placeholder{}\right\}
- flick-down:d8 · stays · line R
- flick-up:d9 → t091 home › menu:Symbols and Greek · Back → t075 · × → t075 · 76 ms
- flick-down:d9 · stays · line S
- flick-up:div · stays · line \placeholder{}^{-1}
- flick-down:div · stays · line T
- flick-up:d4 → t092 home › menu:Matrix · Back → t075 · × → t075 · 19 ms
- flick-down:d4 · stays · line U
- flick-up:d5 · stays · line \begin{pmatrix}\placeholder{}\end{pmatri
- flick-down:d5 · stays · line V
- flick-up:d6 → t093 home › menu:Relations and logic · Back → t075 · × → t075 · 112 ms
- flick-down:d6 · stays · line W
- flick-up:mul · stays · line \mathbin{\measuredangle}
- flick-down:mul · stays · line X
- flick-up:d1 · stays · 25 ms
- flick-down:d1 · stays · line Y
- flick-up:d2 · stays · line \imaginaryI
- flick-down:d2 · stays · line Z
- flick-up:d3 · stays · line \pi
- flick-down:d3 · stays · line \#
- flick-up:sub · stays
- flick-down:sub · stays · line :
- flick-up:d0 · stays · line \%
- flick-down:d0 · stays
- flick-up:dot · stays · line =
- flick-down:dot · stays · line .
- flick-up:space · stays · line _{}
- flick-down:space · stays
- flick-up:add · stays · line \ans
- flick-down:add · stays · line ;
- flick-up:alpha → t094 home [alpha-lock] · Back → t085 · 37 ms
- flick-down:alpha → t094 home [alpha-lock] · Back → t085 · 118 ms
- flick-up:shift → t095 home [shift-lock] · Back → t085 · 47 ms
- flick-down:shift · stays
- flick-up:menu → t096 home › menu:Mode › Settings · Back → t078 · × → t075 · 45 ms
- flick-down:menu → t080 home › menu:Home menu · Back → t075 · × → t075 · 34 ms
- flick-up:esc · stays
- flick-down:esc · stays
- flick-up:undo · stays
- flick-down:undo · stays
- flick-up:redo · stays
- flick-down:redo · stays
- flick-up:select → t082 home › find:Find · Back → t075 · × → t075 · 96 ms
- flick-down:select · stays
- flick-up:deselect → t078 home › menu:Mode · Back → t075 · × → t075 · 30 ms
- flick-down:deselect · stays
- flick-up:fmt · stays
- flick-down:fmt · stays
- flick-up:enter · stays · line \operatorname{\mathrm{approx}}\left(\pla
- flick-down:enter · stays
- flick-up:bksp · stays
- flick-down:bksp · stays

### function-plot: t145 function/plot

- tap “Place: Function. Tap to open the apps list.” → t146 function/plot › apps:Apps · Back → t145 · × → t145 · 364 ms
- tap “Symb” → t147 function/symb · 381 ms
- tap “Plot” · stays
- tap “Num” → t148 function/num · 610 ms
- tap “Angle unit: Radians. Tap to switch.” → t149 function/plot (a setting changed) · 454 ms
- tap “STD” → t150 function/plot › menu:Mode · Back → t145 · × → t145 · 275 ms
- tap “12” → t151 function/plot › menu:Mode › Significant digits · Back → t150 · × → t145 · 291 ms
- tap “Menu” → t152 function/plot › menu:Plot menu · Back → t145 · × → t145 · 339 ms
  - tap “Place: Function. Tap to open the apps list.” → t146 function/plot › apps:Apps · Back → t145 · × → t145 · 42 ms
  - tap “Symb” → t147 function/symb · 376 ms
  - tap “Plot” → t145 function/plot · 280 ms
  - tap “Num” → t148 function/num · 776 ms
  - tap “Angle unit: Radians. Tap to switch.” → t156 function/plot › menu:Plot menu (a setting changed) · 441 ms
  - tap “STD” → t150 function/plot › menu:Mode · Back → t145 · × → t145
  - tap “12” → t151 function/plot › menu:Mode › Significant digits · Back → t150 · × → t145
  - tap “Menu” → t145 function/plot · 251 ms
  - key u1 → t145 function/plot · 43 ms
  - key u2 → t145 function/plot · 36 ms
  - key up → t145 function/plot · 14 ms
  - key menu → t145 function/plot · 3 ms
  - key esc → t145 function/plot · 8 ms
  - key u3 → t145 function/plot · 16 ms
  - key u4 → t145 function/plot · 41 ms
  - key left → t145 function/plot · 4 ms
  - key right → t145 function/plot · 24 ms
  - key undo → t145 function/plot · 2 ms
  - key redo → t145 function/plot · 29 ms
  - key u5 → t145 function/plot · 2 ms
  - key u6 → t145 function/plot · 43 ms
  - key down → t145 function/plot · 3 ms
  - key select → t145 function/plot · 5 ms
  - key deselect → t145 function/plot · 12 ms
  - key vars → t145 function/plot · 9 ms
  - key math → t145 function/plot · 15 ms
  - key tmpl → t145 function/plot · 17 ms
  - key x → t145 function/plot · 3 ms
  - key frac → t145 function/plot · 2 ms
  - key bksp → t145 function/plot
  - key pow → t145 function/plot · 20 ms
  - key sin → t145 function/plot · 2 ms
  - key cos → t145 function/plot · 2 ms
  - key tan → t145 function/plot · 2 ms
  - key ln → t145 function/plot · 12 ms
  - tap “Settings” → t157 function/plot › menu:Plot menu › Settings · Back → t152 · × → t145
    - tap “Place: Function. Tap to open the apps list.” → t146 function/plot › apps:Apps · Back → t145 · × → t145 · 14 ms
    - tap “Symb” → t147 function/symb · 330 ms
    - tap “Plot” → t145 function/plot · 294 ms
    - tap “Num” → t148 function/num · 1121 ms
    - tap “Angle unit: Radians. Tap to switch.” → t159 function/plot › menu:Plot menu › Settings (a setting changed) · 561 ms
    - tap “STD” → t150 function/plot › menu:Mode · Back → t145 · × → t145
    - tap “12” → t151 function/plot › menu:Mode › Significant digits · Back → t150 · × → t145
    - tap “Menu” → t145 function/plot · 375 ms
    - key up → t145 function/plot · 10 ms
    - key menu → t145 function/plot · 5 ms
    - key esc → t152 function/plot › menu:Plot menu · Back → t145 · × → t145
    - tap “Back” → t152 function/plot › menu:Plot menu · Back → t145 · × → t145
    - tap “Close” → t145 function/plot · 297 ms
    - row “1 Appearance” → t160 function/plot › menu:Plot menu › Settings › Appearance · Back → t157 · × → t145
    - row “2 Numbers” → t161 function/plot › menu:Plot menu › Settings › Numbers · Back → t157 · × → t145
    - row “3 Key vibration” → t162 function/plot › menu:Plot menu › Settings › Key vibration · Back → t157 · × → t145
    - row “4 Your keys” → t163 function/plot › menu:Plot menu › Settings › Your keys · Back → t157 · × → t145
    - row “5 Data” → t164 function/plot › menu:Plot menu › Settings › Data · Back → t157 · × → t145
    - row “6 Counters” → t165 function/plot › menu:Plot menu › Settings › Counters · Back → t157 · × → t145
    - row “7 Help and about” → t166 function/plot › menu:Plot menu › Settings › Help and about · Back → t157 · × → t145
    - Android Back → t152 function/plot › menu:Plot menu
    - tap outside → t145 function/plot · 271 ms
  - tap “Close” → t145 function/plot · 264 ms
  - row “1 Root” → t145 function/plot · 1394 ms
  - row “2 Extremum” → t145 function/plot · 1139 ms
  - row “3 Intersection” → t158 function/plot › menu:Plot menu › Intersection of F1(x) and · Back → t152 · × → t145
    - tap “Place: Function. Tap to open the apps list.” → t146 function/plot › apps:Apps · Back → t145 · × → t145 · 66 ms
    - tap “Symb” → t147 function/symb · 385 ms
    - tap “Plot” → t145 function/plot · 263 ms
    - tap “Num” → t148 function/num · 649 ms
    - tap “Angle unit: Radians. Tap to switch.” → t167 function/plot › menu:Plot menu › Intersection of F1(x) and (a setting changed) · 436 ms
    - tap “STD” → t150 function/plot › menu:Mode · Back → t145 · × → t145
    - tap “12” → t151 function/plot › menu:Mode › Significant digits · Back → t150 · × → t145
    - tap “Menu” → t145 function/plot · 276 ms
    - key up → t145 function/plot · 7 ms
    - key menu → t145 function/plot · 9 ms
    - key esc → t152 function/plot › menu:Plot menu · Back → t145 · × → t145
    - tap “Back” → t152 function/plot › menu:Plot menu · Back → t145 · × → t145
    - tap “Close” → t145 function/plot · 253 ms
    - row “1 x-axis” → t145 function/plot · 1037 ms
    - Android Back → t152 function/plot › menu:Plot menu
    - tap outside → t145 function/plot · 287 ms
  - row “4 Slope” → t145 function/plot · 663 ms
  - row “5 Signed area” → t145 function/plot · 254 ms
  - row “6 Default window” → t145 function/plot · 365 ms
  - row “7 Copy” · stays
  - row “8 Copy as shown” · stays
  - Android Back → t145 function/plot · 1848 ms
  - tap outside → t145 function/plot · 274 ms
- key menu → t152 function/plot › menu:Plot menu · Back → t145 · × → t145 · 102 ms
- key alpha → t153 function/plot [alpha] · Back → t154 · 133 ms
- key shift → t155 function/plot [shift] · Back → t154 · 87 ms
- Android Back → t154 Android: com.android.launcher3/.uioverrides.QuickstepLauncher
- plot-pan · stays
- plot-tap · stays · 226 ms
- plot-pinch-out · stays

### tablet: the keys in each view

#### home

| key | spec tap | tap | flick ↑ (the Shift layer) | flick ↓ (the Alpha layer) |
|---|---|---|---|---|
| u1 (＋) | special none | · |  |  |
| u2 (＋) | special none | · |  |  |
| up (▲) | cmd moveUp | · |  |  |
| menu (☰) | special menu | → t080 Home menu | → t096 Mode › Settings | → t080 Home menu |
| esc (Esc) | special esc | · | · | · |
| u3 (＋) | special none | · |  |  |
| u4 (＋) | special none | · |  |  |
| left (◀) | cmd moveToPreviousChar | · |  |  |
| right (▶) | cmd moveToNextChar | · |  |  |
| undo (Undo) | cmd undo | · | · | · |
| redo (Redo) | cmd redo | · | · | · |
| u5 (＋) | special none | · |  |  |
| u6 (＋) | special none | · |  |  |
| down (▼) | cmd moveDown | · |  |  |
| select (Select) | special selectGrow | · | → t082 Find | · |
| deselect (Deselect) | special selectShrink | · | → t078 Mode | · |
| vars (Vars) | special vars | → t081 Vars | “Paste: not a number” | `A` |
| math (Math) | special find | → t082 Find | → t088 Memory | `B` |
| tmpl (Tmpl) | special tmpl | → t083 Templates | → t089 [unit view] | `C` |
| x (x) | type x | `x` | `y` | `D` |
| frac (a b/c) | insert \frac{#@}{#?} | · | · | `E` |
| bksp (⌫) | cmd deleteBackward | · | · | · |
| pow (xʸ) | insert #@^{#?} | `\placeholder{}^{\placeholder` | `\sqrt[\placeholder{}]{\place` | `F` |
| sin (sin) | insert \sin\left(#0\right) | `\sin\left(\placeholder{}\rig` | `\arcsin\left(\placeholder{}\` | `G` |
| cos (cos) | insert \cos\left(#0\right) | `\cos\left(\placeholder{}\rig` | `\arccos\left(\placeholder{}\` | `H` |
| tan (tan) | insert \tan\left(#0\right) | `\tan\left(\placeholder{}\rig` | `\arctan\left(\placeholder{}\` | `I` |
| ln (ln) | insert \ln\left(#0\right) | `\ln\left(\placeholder{}\righ` | `\exponentialE^{\placeholder{` | `J` |
| log (log) | insert \log\left(#0\right) | `\log\left(\placeholder{}\rig` | `10^{\placeholder{}}` | `K` |
| sq (x²) | insert #@^{2} | `\placeholder{}^2` | `\sqrt{\placeholder{}}` | `L` |
| neg ((−)) | type - | `-` | `\left\|\placeholder{}\right\|` | `M` |
| paren (( )) | insert \left(#0\right) | `\left(\placeholder{}\right)` | `\operatorname{\mathrm{par}}\` | `N` |
| comma (,) | type , | `,` | `\pm` | `O` |
| enter (Enter) | special enter | · | `\operatorname{\mathrm{approx` | · |
| emark (ᴇ) | insert \emark | `1\emark` | → t090 Store in | `P` |
| d7 (7) | type 7 | `7` | · | `Q` |
| d8 (8) | type 8 | `8` | `\left\{\placeholder{}\right\` | `R` |
| d9 (9) | type 9 | `9` | → t091 Symbols and Greek | `S` |
| div (÷) | insert \frac{#@}{#?} | `\frac{\placeholder{}}{\place` | `\placeholder{}^{-1}` | `T` |
| alpha (alpha) | special alpha | → t084 [alpha] | → t094 [alpha-lock] | → t094 [alpha-lock] |
| d4 (4) | type 4 | `4` | → t092 Matrix | `U` |
| d5 (5) | type 5 | `5` | `\begin{pmatrix}\placeholder{` | `V` |
| d6 (6) | type 6 | `6` | → t093 Relations and logic | `W` |
| mul (×) | insert \times | `\times` | `\mathbin{\measuredangle}` | `X` |
| shift (shift) | special shift | → t086 [shift] | → t095 [shift-lock] | · |
| d1 (1) | type 1 | `1` | · | `Y` |
| d2 (2) | type 2 | `2` | `\imaginaryI` | `Z` |
| d3 (3) | type 3 | `3` | `\pi` | `\#` |
| sub (−) | type - | `-` | · | `:` |
| fmt (Fmt) | special fmt | · | · | · |
| d0 (0) | type 0 | `0` | `\%` | · |
| dot (.) | type . | `.` | `=` | `.` |
| space (␣) | type   | · | `_{}` | · |
| add (+) | type + | `+` | `\ans` | `;` |

`·` = nothing changed on screen (a cursor move on an empty line, or a dead key); `→ pNNN` = a new state; a code span is what the line holds after the key.

#### function-plot

| key | spec tap | tap |
|---|---|---|
| u1 (＋) | special none | · |
| u2 (＋) | special none | · |
| up (▲) | cmd moveUp | · |
| menu (☰) | special menu | → t152 Plot menu |
| esc (Esc) | special esc | · |
| u3 (＋) | special none | · |
| u4 (＋) | special none | · |
| left (◀) | cmd moveToPreviousChar | · |
| right (▶) | cmd moveToNextChar | · |
| undo (Undo) | cmd undo | · |
| redo (Redo) | cmd redo | · |
| u5 (＋) | special none | · |
| u6 (＋) | special none | · |
| down (▼) | cmd moveDown | · |
| select (Select) | special selectGrow | · |
| deselect (Deselect) | special selectShrink | · |
| vars (Vars) | special vars | · |
| math (Math) | special find | · |
| tmpl (Tmpl) | special tmpl | · |
| x (x) | type x | · |
| frac (a b/c) | insert \frac{#@}{#?} | · |
| bksp (⌫) | cmd deleteBackward | · |
| pow (xʸ) | insert #@^{#?} | · |
| sin (sin) | insert \sin\left(#0\right) | · |
| cos (cos) | insert \cos\left(#0\right) | · |
| tan (tan) | insert \tan\left(#0\right) | · |
| ln (ln) | insert \ln\left(#0\right) | · |
| log (log) | insert \log\left(#0\right) | · |
| sq (x²) | insert #@^{2} | · |
| neg ((−)) | type - | · |
| paren (( )) | insert \left(#0\right) | · |
| comma (,) | type , | · |
| enter (Enter) | special enter | · |
| emark (ᴇ) | insert \emark | · |
| d7 (7) | type 7 | · |
| d8 (8) | type 8 | · |
| d9 (9) | type 9 | · |
| div (÷) | insert \frac{#@}{#?} | · |
| alpha (alpha) | special alpha | → t153 [alpha] |
| d4 (4) | type 4 | · |
| d5 (5) | type 5 | · |
| d6 (6) | type 6 | · |
| mul (×) | insert \times | · |
| shift (shift) | special shift | → t155 [shift] |
| d1 (1) | type 1 | · |
| d2 (2) | type 2 | · |
| d3 (3) | type 3 | · |
| sub (−) | type - | · |
| fmt (Fmt) | special fmt | · |
| d0 (0) | type 0 | · |
| dot (.) | type . | · |
| space (␣) | type   | · |
| add (+) | type + | · |

`·` = nothing changed on screen (a cursor move on an empty line, or a dead key); `→ pNNN` = a new state; a code span is what the line holds after the key.

### tablet: actions to reach each state from its root

| root | state | actions | the shortest way |
|---|---|---|---|
| tips | t074 home | 1 | tap “Got it” |
| home | t076 home › apps:Apps | 1 | tap “Place: Home. Tap to open the apps list.” |
| home | t077 home | 1 | tap “Angle unit: Radians. Tap to switch.” |
| home | t078 home › menu:Mode | 1 | tap “STD” |
| home | t079 home › menu:Mode › Significant digits | 1 | tap “12” |
| home | t080 home › menu:Home menu | 1 | tap “Menu” |
| home | t081 home › find:Vars | 1 | key vars |
| home | t082 home › find:Find | 1 | key math |
| home | t083 home › menu:Templates | 1 | key tmpl |
| home | t084 home [alpha] | 1 | key alpha |
| home | t086 home [shift] | 1 | key shift |
| home | t087 home +credits › menu:N62 | 1 | mark-tap |
| home | t088 home › find:Memory | 1 | flick-up:math |
| home | t089 home [unit view] | 1 | flick-up:tmpl |
| home | t090 home › store:Store in | 1 | flick-up:emark |
| home | t091 home › menu:Symbols and Greek | 1 | flick-up:d9 |
| home | t092 home › menu:Matrix | 1 | flick-up:d4 |
| home | t093 home › menu:Relations and logic | 1 | flick-up:d6 |
| home | t094 home [alpha-lock] | 1 | flick-up:alpha |
| home | t095 home [shift-lock] | 1 | flick-up:shift |
| home | t096 home › menu:Mode › Settings | 1 | flick-up:menu |
| home | t097 home › apps:Apps | 2 | tap “Place: Home. Tap to open the apps list.”, tap “Angle unit: Radians. Tap to switch.” |
| home | t098 cas | 2 | tap “Place: Home. Tap to open the apps list.”, row “2 CAS” |
| home | t099 function/symb | 2 | tap “Place: Home. Tap to open the apps list.”, row “3 Function” |
| home | t100 solve/symb | 2 | tap “Place: Home. Tap to open the apps list.”, row “4 Solve” |
| home | t101 home › menu:Mode | 2 | tap “STD”, tap “Angle unit: Radians. Tap to switch.” |
| home | t102 home › menu:Mode | 2 | tap “STD”, row “2 Number format” |
| home | t103 home | 2 | tap “STD”, tap “Scientific” |
| home | t104 home | 2 | tap “STD”, tap “Engineering” |
| home | t105 home | 2 | tap “STD”, tap “Prefixes (k, M, µ …)” |
| home | t106 home › menu:Mode | 2 | tap “STD”, tap “Previous value” |
| home | t107 home › menu:Mode | 2 | tap “STD”, tap “Next value” |
| home | t108 home › menu:Mode | 2 | tap “STD”, row “4 Entry” |
| home | t109 home | 2 | tap “STD”, tap “One line” |
| home | t110 home › menu:Mode › Presets | 2 | tap “STD”, row “5 Preset” |
| home | t111 home › menu:Mode › Significant digits | 2 | tap “12”, tap “Angle unit: Radians. Tap to switch.” |
| home | t112 home | 2 | tap “12”, row “1 4” |
| home | t113 home | 2 | tap “12”, row “2 6” |
| home | t114 home | 2 | tap “12”, row “3 8” |
| home | t115 home | 2 | tap “12”, row “4 10” |
| home | t116 home | 2 | tap “12”, row “6 15” |
| home | t117 home | 2 | tap “12”, row “7 20” |
| home | t118 home | 2 | tap “12”, row “8 25” |
| home | t119 home | 2 | tap “12”, row “9 30” |
| home | t120 home › menu:Home menu | 2 | tap “Menu”, tap “Angle unit: Radians. Tap to switch.” |
| home | t121 home › menu:Home menu › Settings | 2 | tap “Menu”, tap “Settings” |
| home | t122 home › find:Vars | 2 | key vars, tap “Angle unit: Radians. Tap to switch.” |
| home | t123 home › find:Vars | 2 | key vars, key vars |
| home | t124 home [alpha] › find:Vars | 2 | key vars, key alpha |
| home | t125 home [shift] › find:Vars | 2 | key vars, key shift |
| home | t126 home › find:Find | 2 | key math, tap “Angle unit: Radians. Tap to switch.” |
| home | t127 home › find:Find › Arithmetic | 2 | key math, row “1 Arithmetic” |
| home | t128 home › find:Find › Powers and logarithms | 2 | key math, row “2 Powers and logarithms” |
| home | t129 home › find:Find › Trigonometry | 2 | key math, row “3 Trigonometry” |
| home | t130 home › find:Find › Calculus | 2 | key math, row “4 Calculus” |
| home | t131 home › find:Find › Algebra and solving | 2 | key math, row “5 Algebra and solving” |
| home | t132 home › find:Find › Matrices and vectors | 2 | key math, row “6 Matrices and vectors” |
| home | t133 home › find:Find › Probability and statistics | 2 | key math, row “7 Probability and statistics” |
| home | t134 home › find:Find › Engineering | 2 | key math, row “8 Engineering” |
| home | t135 home › find:Find › Constants | 2 | key math, row “9 Constants” |
| home | t136 home › find:Find › Units and prefixes | 2 | key math, row “0 Units and prefixes” |
| home | t137 home › find:Find › Bits and words | 2 | key math, row “Bits and words” |
| home | t138 home › find:Find › Complex numbers | 2 | key math, row “Complex numbers” |
| home | t139 home › find:Find | 2 | key math, key vars |
| home | t140 home [alpha] › find:Find | 2 | key math, key alpha |
| home | t141 home [shift] › find:Find | 2 | key math, key shift |
| home | t142 home › menu:Templates | 2 | key tmpl, tap “Angle unit: Radians. Tap to switch.” |
| home | t143 home +credits › menu:N62 | 2 | mark-tap, tap “Angle unit: Radians. Tap to switch.” |
| home | t144 home › find:Memory | 2 | flick-up:math, tap “Angle unit: Radians. Tap to switch.” |
| function-plot | t146 function/plot › apps:Apps | 1 | tap “Place: Function. Tap to open the apps list.” |
| function-plot | t147 function/symb | 1 | tap “Symb” |
| function-plot | t148 function/num | 1 | tap “Num” |
| function-plot | t149 function/plot | 1 | tap “Angle unit: Radians. Tap to switch.” |
| function-plot | t150 function/plot › menu:Mode | 1 | tap “STD” |
| function-plot | t151 function/plot › menu:Mode › Significant digits | 1 | tap “12” |
| function-plot | t152 function/plot › menu:Plot menu | 1 | tap “Menu” |
| function-plot | t153 function/plot [alpha] | 1 | key alpha |
| function-plot | t155 function/plot [shift] | 1 | key shift |
| function-plot | t156 function/plot › menu:Plot menu | 2 | tap “Menu”, tap “Angle unit: Radians. Tap to switch.” |
| function-plot | t157 function/plot › menu:Plot menu › Settings | 2 | tap “Menu”, tap “Settings” |
| function-plot | t158 function/plot › menu:Plot menu › Intersection of F1(x) and | 2 | tap “Menu”, row “3 Intersection” |
| function-plot | t159 function/plot › menu:Plot menu › Settings | 3 | tap “Menu”, tap “Settings”, tap “Angle unit: Radians. Tap to switch.” |
| function-plot | t160 function/plot › menu:Plot menu › Settings › Appearance | 3 | tap “Menu”, tap “Settings”, row “1 Appearance” |
| function-plot | t161 function/plot › menu:Plot menu › Settings › Numbers | 3 | tap “Menu”, tap “Settings”, row “2 Numbers” |
| function-plot | t162 function/plot › menu:Plot menu › Settings › Key vibration | 3 | tap “Menu”, tap “Settings”, row “3 Key vibration” |
| function-plot | t163 function/plot › menu:Plot menu › Settings › Your keys | 3 | tap “Menu”, tap “Settings”, row “4 Your keys” |
| function-plot | t164 function/plot › menu:Plot menu › Settings › Data | 3 | tap “Menu”, tap “Settings”, row “5 Data” |
| function-plot | t165 function/plot › menu:Plot menu › Settings › Counters | 3 | tap “Menu”, tap “Settings”, row “6 Counters” |
| function-plot | t166 function/plot › menu:Plot menu › Settings › Help and about | 3 | tap “Menu”, tap “Settings”, row “7 Help and about” |
| function-plot | t167 function/plot › menu:Plot menu › Intersection of F1(x) and | 3 | tap “Menu”, row “3 Intersection”, tap “Angle unit: Radians. Tap to switch.” |


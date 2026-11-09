<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# The 16 sources of the materials sample (S36)

**Status: open.** The owner signs the table and reads the short list below, by the freeze on Thu 11-12. The two copper edits go in with S36f1: Opus pass 103 read sections 3.3 and 3.9 of the sheet [D1] again and found 16.8 and 110 (annealed) there; the lines keep "(to verify: owner)".

**Recommendation: read the seven short-list clauses before signing.** Two of the 16 values are wrong against the sheet they cite, and no line was found wrong against a Eurocode. Only four lines reach "confirmed at the clause", because the Eurocodes are paywalled and free texts rarely name a clause.

Checked on `phase-1` at 26390e12, 2026-11-08, on `app/public/samples/materials.txt` (not edited). Rerun: `python3 tools/probes/sample-sources.py` (exit 1, the two copper lines). All 16 definitions agree with their source lines, and the 7 `// test:` lines on values agree in exact arithmetic. `node tools/probes/library.ts check` passed all 11 tests on import, the 4 function tests among them.

## What the verdicts mean

| Verdict | Test |
|---|---|
| **confirmed at the clause** | A publisher, government or university text ties this value to this clause or sheet section. |
| **value confirmed, clause not** | Such a text gives the value, but only a software vendor names the clause. |
| **only secondary** | Only vendor, consultancy or trade pages give the value. |
| **wrong** | The cited document says something else. |

A clause heading in a publisher's table of contents proves the clause exists, not what it says. Paragraph numbers such as "(1)" were mostly not confirmable and are noted where it matters. The edition years match the contents pages and catalogue listings found, except EN 1992-1-1:2004, whose year I did not see in a listing: the owner sees it on the title page. I did not check whether amendments (EN 1999-1-1 has A1:2009 and A2:2013) touch these clauses.

## The table

Line is the `// source:` line, then the definition line, of `materials.txt`. All sources were read on 2026-11-08. Links are listed under "Sources".

| Line | Name | Value in the file | Source line says | Verdict | Sources | Read |
|---|---|---|---|---|---|---|
| 10, 12 | `E_steel` | 2.1×10¹¹ Pa | EN 1993-1-1:2005, 3.2.6(1) | value confirmed, clause not | value [J3] p. 255; clause [V1] p. 12, [V3]; heading [T1] | 11-08 |
| 15, 17 | `rho_steel` | 7850 kg/m³ | EN 1993-1-2:2005, 3.2.2(1) | value confirmed, clause not | value [U3] p. 13; clause [V6]; heading [T2], [T7] | 11-08 |
| 19, 21 | `alpha_steel` | 12×10⁻⁶ /K | EN 1993-1-1:2005, 3.2.6(1) | only secondary | [V1] p. 12, [V3], [V8] (no clause) | 11-08 |
| 23, 25 | `lambda_steel` | 53.334 W/(m·K) | EN 1993-1-2:2005, 3.4.1.3(1) | only secondary | formula [V7]; ratio check [U2] p. 32 (see note 1) | 11-08 |
| 28, 30 | `E_alu` | 7×10¹⁰ Pa | EN 1999-1-1:2007, 3.2.5(1) | value confirmed, clause not | value [U3] p. 67; clause [V2] p. 12; heading [T3] | 11-08 |
| 33, 35 | `rho_alu` | 2700 kg/m³ | EN 1999-1-1:2007, 3.2.5(1) | value confirmed, clause not | value [U3] p. 67; clause [V2] p. 12; heading [T3] | 11-08 |
| 37, 39 | `alpha_alu` | 23×10⁻⁶ /K | EN 1999-1-1:2007, 3.2.5(1) | value confirmed, clause not | value [U3] p. 67; clause [V2] p. 12; heading [T3] | 11-08 |
| 41, 43 | `lambda_alu` | 191.4 W/(m·K) | EN 1999-1-2:2007, 3.3.1.3 | only secondary | ratio check [U2] p. 32 (see note 1); heading of 3.3.1 only [T4] p. 8 | 11-08 |
| 46, 48 | `E_copper` | 1.27×10¹¹ Pa | DKI sheet 2005, annealed: 127 kN/mm² | **wrong:** the sheet gives 110 annealed | [D1] section 3.9, p. 4 | 11-08 |
| 51, 53 | `rho_copper` | 8930 kg/m³ | DKI sheet 2005: 8.93 g/cm³ | confirmed at the clause | [D1] section 3.1, p. 2 (at 20 °C) | 11-08 |
| 55, 57 | `alpha_copper` | 17×10⁻⁶ /K | DKI sheet 2005, 20 to 100 °C: 17×10⁻⁶ | **wrong:** the sheet gives 16.8×10⁻⁶ | [D1] section 3.3, p. 2 | 11-08 |
| 59, 61 | `lambda_copper` | 394 W/(m·K) | DKI sheet 2005: 394 at 20 °C | confirmed at the clause | [D1] section 3.5, p. 3 | 11-08 |
| 63, 65 | `E_C30` | 3.3×10¹⁰ Pa | EN 1992-1-1:2004, Table 3.1 | only secondary, **sources disagree** | 33: [V5]; 32: [J1] slide 10 (see note 2) | 11-08 |
| 68, 70 | `gamma_C30` | 24000 N/m³ | EN 1991-1-1:2002, Table A.1 | only secondary | [V9]; Annex A heading, informative [T6] | 11-08 |
| 72, 74 | `alpha_C30` | 10×10⁻⁶ /K | EN 1992-1-1:2004, 3.1.3(5) | confirmed at the clause (3.1.3) | [J1] slide 13; paragraph (5) only [V4] | 11-08 |
| 76, 78 | `lambda_C30` | 1.951408 W/(m·K) | EN 1992-1-2:2004, 3.3.3(2), upper limit | confirmed at the clause (3.3.3) | formula [U1] p. 5, eq. 17; clause [J2] p. 53, [G1] p. 2; heading [T5] | 11-08 |

Count: 2 wrong, 4 confirmed at the clause, 5 value confirmed with the clause open, 5 only secondary. "Not found" applies to no line.

**Note 1, the two conductivities.** The TU Eindhoven report [U2] gives no formula, but says the aluminium curves of EN 1999-1-2 are 2.7 to 3.6 times those of EN 1993-1-2 at 20 °C, and 5.0 to 6.0 times at 500 °C. From the file's formulas and the second aluminium curve (0.1 θ + 140) the ratios are 2.66 and 3.59 at 20 °C, then 5.09 and 6.02 at 500 °C (`source: oracle`, mpmath). That fits at 20 °C and roughly at 500 °C, so it supports the numbers but cannot pin a coefficient. The same report's Figure 3.6 labels the curve "1xxx, 3xxx and 6xxx", while the sample says "3xxx and 6xxx". A 6082 falls under both, so the value stands, but the owner should read the series list.

**Note 2, `E_C30`.** The Eurocode 2 symposium slide hosted by the JRC [J1] shows 32 GPa in the C30/37 column; the others found show 33. The formula used for this row, 22·(fcm/10)^0.3 with fcm = 38 MPa, gives 32.8366 GPa (`source: oracle`), which rounds to 33, so the slide is probably a misprint. That is an inference, so the table's row has to be read.

**Copper's other numbers.** The sheet is dated "Stand 2005" on p. 1, and DIN Media lists it as DKI Cu-ETP:2005 [D2], so the edition holds. DIN Media counts 11 pages, the kupfer.de PDF has 12 (created 2006-06), so they may not be the identical print. 127 is not in the sheet at all; one dealer sheet found by search gives 127 000 N/mm² with no state of the metal, and three others give 110 for the annealed state (search summaries only: [C1]). The cold-worked value is 130 at 20 °C. 17 is not in the sheet either: its three ranges from 20 °C give 16.8, 17.3 and 17.7.

## Short list for the owner

The 12 Eurocode lines come down to seven passages. Copper needs no standard: the sheet is free [D1].

1. **EN 1992-1-1:2004, Table 3.1, column C30/37:** is Ecm 33 GPa? This is the only line where sources disagree. Also 3.1.3: is the 10×10⁻⁶ in paragraph (5)? One deck was reported to cite (4).
2. **EN 1999-1-2:2007, 3.3.1.3:** the coefficients 0.07 and 190, and which alloy series they cover. This is the weakest line.
3. **EN 1993-1-2:2005, 3.4.1.3 and 3.2.2:** the coefficient 3.33×10⁻² and the 7850.
4. **EN 1993-1-1:2005, 3.2.6:** E and α, and the limit on T.
5. **EN 1999-1-1:2007, 3.2.5:** E, ρ, α.
6. **EN 1991-1-1:2002, Table A.1:** 24 kN/m³ for plain concrete (25 applies with normal reinforcement; Annex A is informative).
7. **EN 1992-1-2:2004, 3.3.3:** that the upper limit is in paragraph (2).

## Exact edits for the follow-up package

Both keep "(to verify: owner)" until the owner has signed. Nothing else reads these two values: `git grep` finds the names only in the sample.

`materials.txt` lines 46, 48 and 49 become:

```
// source: Deutsches Kupferinstitut, Werkstoff-Datenblatt Cu-ETP (CW004A), edition 2005, section 3.9, annealed, 20 °C: E = 110 kN/mm² (to verify: owner)
E_copper:=110*10^9
// test: E_copper/10^6 == 110000
```

`materials.txt` lines 55 and 57 become:

```
// source: Deutsches Kupferinstitut, Werkstoff-Datenblatt Cu-ETP (CW004A), edition 2005, section 3.3: 16.8×10⁻⁶ per K, 20 to 100 °C (to verify: owner)
alpha_copper:=168*10^-7
```

After the edits, update the two copper rows of `SOURCES` in `tools/probes/sample-sources.py` so its exit is 0.

## What this check cannot say, and the risks

- **No Eurocode text was read.** Free full copies turned up on Scribd, phd.eng.br, dnaop.com and a university library page. I opened none of them and counted none, though some search summaries quoted them; a paywalled text copied without licence is not a source this project should lean on.
- **Search summaries are weaker than reading.** Everything labelled [C1] came from search summaries only. The PDFs were read from their extracted text; [D2] and the web pages [V3] to [V9] were read through a page-summary tool, so their numbers are one step removed. I could not render the sheet's page 4 (no PDF renderer here); the extracted rows are unambiguous and the probe's `--sheet` prints them.
- **National annexes can change a value** (the conductivity of concrete is one such choice per [G1] and [U1]). The sample's general warning covers this.
- **These editions are ending.** The cited Eurocodes are the first generation; national bodies withdraw them on 30 March 2028 [E1], and the new ones (for example EN 1999-1-1:2023) number clauses differently. I did not compare values with the new editions.
- **A wrong sample value reaches few users today:** the app has no link to the file, which ships at `samples/materials.txt` and is reached by importing it. It is in backlog "Open bugs" all the same.

## Sources

Read 2026-11-08. Standards and text the publisher sells are cited for numbers and clauses only.

- **Data sheet:** [D1] <https://kupfer.de/wp-content/uploads/2019/11/Cu-ETP.pdf> (Deutsches Kupferinstitut); [D2] <https://www.dinmedia.de/en/technical-rule/dki-cu-etp/109984124>.
- **Publishers' contents pages:** [T1] <https://www.din.de/de/mitwirken/normenausschuesse/nabau/veroeffentlichungen/wdc-beuth:din21:134861439/toc-1737382/download> (EN 1993-1-1); [T2] <https://www.din.de/de/mitwirken/normenausschuesse/nabau/veroeffentlichungen/wdc-beuth:din21:134156739/toc-1738555/download> (EN 1993-1-2); [T3] <https://www.din.de/de/mitwirken/normenausschuesse/nabau/veroeffentlichungen/wdc-beuth:din21:97158233/toc-1635382/download> (EN 1999-1-1); [T4] <https://www.intertekinform.com/preview/98697073185.pdf?sku=868162_saig_nsai_nsai_2064613> (I.S. EN 1999-1-2:2007, sample pages); [T5] <https://www.din.de/de/mitwirken/normenausschuesse/nabau/veroeffentlichungen/wdc-beuth:din21:134277778/toc-1738815/download> (EN 1992-1-2); [T6] <https://www.din.de/de/mitwirken/normenausschuesse/nabau/veroeffentlichungen/wdc-beuth:din21:134234392/toc-1736951/download> (EN 1991-1-1); [T7] <https://cdn.standards.iteh.ai/samples/12447/dad3fe87ea334846ac0d75892f19556d/SIST-EN-1993-1-2-2005.pdf> (sample pages).
- **Government and JRC:** [J1] <https://eurocodes.jrc.ec.europa.eu/doc/WS2008/EN1992_1_Walraven.pdf> (Walraven, 2008); [J2] <https://eurocodes.jrc.ec.europa.eu/sites/default/files/2022-06/06-ROBERT-EC-FireDesign-WS.pdf> (Robert, 2012); [J3] <https://orbi.uliege.be/bitstream/2268/194798/1/Eurocodes%20Background%26applications%20design%20of%20steel%20buildings.pdf> (JRC report, university copy); [G1] <https://www.bygningsreglementet.dk/media/naycoazj/ds-en-1992-1-2-dk-na-2011-english_2024-07-01-a.pdf> (Danish National Annex); [E1] <https://www.nsai.ie/images/uploads/general/2nd_Gen_Eurocodes_leaflet.pdf> (NSAI, Ireland's standards body).
- **Universities:** [U1] <https://d-nb.info/1260890422/34> (Zehfuß et al. 2020, TU Braunschweig); [U2] <https://pure.tue.nl/ws/files/2310557/633114.pdf> (Maljaars 2005, TU Eindhoven); [U3] <https://indico.cern.ch/event/1351898/contributions/5692316/attachments/2765225/4819441/CERN%20Alluminium_Intro.pdf> (University of Naples course at CERN).
- **Vendors, consultants, trade press:** [V1] <https://downloads.scia.net/support/sciaengineer/manuals/15/eurocode/%5Beng%5Deurocode%20training%20-%20en%201993%202011.0%20v4.pdf>; [V2] <https://downloads.scia.net/support/sciaengineer/manuals/15/eurocode/%5Beng%5Deurocode%20training%20-%20en1999-1-1%202011.0.1172.pdf>; [V3] <https://cdn.eurocodeapplied.com/design/en1993/steel-design-properties>; [V4] <https://eurocodeapplied.com/design/en1992/concrete-design-properties>; [V5] <https://www.structuralbasics.com/concrete-and-reinforcement-properties>; [V6] <https://www.dlubal.com/en/support-and-learning/support/knowledge-base/001583>; [V7] <https://www.heissbemessung.net/Infothek/Materialien_im_Brandfall/Steel-in-fire.html>; [V8] <https://www.steelconstruction.info/Steel_material_properties>; [V9] <https://www.newsteelconstruction.com/wp/wp-json/wp/v2/posts/6057> (SCI, 2009).
- **Search summaries only:** [C1] <https://batz-burgel.com/wp-content/uploads/data-de/BB_CW004A.pdf> (127 000, no state); <https://www.alcumet.de/daten/Datenblatt_E-Cu_CW004A.pdf>, <https://rosen-metall.de/fileadmin/Werkstoffdatenblaetter/Kupfer/Werkstoffdatenblatt_ECU.pdf>, <https://de.schlenk.com/fileadmin/editorsCMS/Medien/02_Maerkte_und_Produkte/SMF/TDS_und_Produktinformation/Deutsch/Cu-ETP.pdf> (110).

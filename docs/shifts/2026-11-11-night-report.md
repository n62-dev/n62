<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Night report 2026-11-11, the night of 2026-11-10 (09:33 to 07:09)

The shift ran from 09:33 on 11-10 (`night.sh --lane A` and `--lane B`, `--until 05:00`). Pipeline runs 903 to 970: 42 package runs, 15 Opus passes (127 to 141), 15 device runs (all ran, none skipped). **37 runs merged** (A: 19, B: 18); **5 runs ended NOT MERGED** (four after two fix rounds, one stopped by hand), and each package they carried merged later under a follow-up run, so no branch is open. 30 fix rounds were used. Lane A closed at 05:14 (G170 merged, pass 140) and waited for lane B; lane B's last package, G322, merged at 06:43, then pass 141 and device 141 (07:09). Nothing from this night was pushed (the owner pushed 81f5e663 and 66f04f9e by day).

**Core list:** desktop CORE 70/70 (known 0, needs 0) at pass 141 (69/69 in passes 127 to 133; S53f1 added c70, counted from pass 134). **CORE DEVICE 69/69 (known 0, new none) at bf663b19 (device 141, 07:09)**; devices 127 to 133 were 68/68, 134 to 141 were 69/69. Gates at pass 141 (844ea903): typecheck 0; `FIND_INDEX=required npm test` 4356/4356; GOLDEN GATE PASSED; e2e 1881 passed, 12 skipped, 6 failed under load (page-load timing in hwkeys, keys, longresult, markstyle, menumark, namemarks; alone they pass 106/106). At pass 140: e2e 1887 passed, golden passed (ilaplace-vars-test, patched 304/0, precision 1306/1306).

## Merged into phase-1
Lane A (ron, gorge, sandra):
- R269 abcdfafe (Copy on a unit row writes value ± σ unit; Paste refuses it). R255 6644df9a (keys typed before the field is up are not an empty line) and R255f1 7231dd0d (the Units key and the presets name prompt wait for the field). R274f1 2ccc4392 (selection colours for every theme). R275 2b5f0ff8 (box jumps off Shift + Copy and Paste).
- R257 47e71713 (trace value keyed on the angle unit). R256 e7ad9b04 and R256f1 bc527dcd (decimal comma in the power base, Del and DMS degrees). R258 bd2ff785 (stored names of more than one letter). R261 4e0b523d (Esc and Enter on an empty line, Clear undoable). R270 35bbb64f (Home's line set aside while an app is open; start pin 61,100 B).
- S53 ac5081bd (store design note, mockup, probe; found store-bu-1) and S53f2 51c8f167 (Vars takes its mark from the same rule as History; c70). R272 7dd1075f and R272f1 09582fef (history drop note, Settings › Data). R273 13f5a8d5 (pick dropped, line kept). R271f1 1247852a (a σ chip's ⚠ stored with the result).
- G187 414675c8 (patch 0041: a power past the range is Underflow by its size; engine key 7beec61d849d1f05). G170 cacd12fc (patch 0042: ilaplace leaves no assumption under freed memory; engine key d0300b6347a802c4).

Lane B (gorge, annabell):
- G304 6f835c09 (one angle alias table, DEG values). G305 babfab56 (unidirectional-limit error becomes noLimit). G310f1 b1f8a06a (the unit check: refusals z18 to z31 and controls in `units.yaml`). G230 6c01912a (the `where` field in Find). G317 bce0c968 (a name set as a side effect shows its own preview and mark). G318 e7e116ef (an engine that fails to start stops after its second or third try). G322 844ea903 (patch 0043: cubic roots decided from the exact discriminant; engine key bedf1255832ad92a, now current; start pin 61,300 B).
- A138 510a098b (F-Droid `Binaries` and signing key). A128 6a83cf97 (start budget 180 kB raw, 63 kB gzip). A124 865b7f7f (a docs or size only fix round is free). A127 5c54e8a2 (a row whose After is not merged stops with WAITS). A129 155207dd (one rerun of 1 to 5 e2e failures; FLAKE lines). A130 41eea8cf (the failed-check line names every failing test). A131 32586cc4 (the "Not done," rule). A125 3514fecc (fair queue for the clipboard lock). R255f2 cb63799f (test-only: wait for both done rows before the last Enter). A132 b5621144 (pipeline-stats tool). A126 c6849f8a (`PW_WORKERS`; default stays).

Opus pass merges: 2a52e014 (127), e641d128 (128), fb37e2c6 (129), 673b3ec5 (130), 2e04ec84 (131), 10be8d91 (132), 89732bdd (133), d555926f (134), 5ce86572 (135), 96431368 (136), db49d10d (137), e5da5c73 (138), aed6300b (139), a7b802ec (140), bf663b19 (141). Their doc commits include c4f739b6, 7defbb32, 6c7c88cc, d75faf4d, dba87bd1, 4217885a, be4e69df, d8634378, 4760e871, d274a656, bc77913f, 5c5a27e7 and a19f2195. The owner's day session added 3c6834f5 (queue top-up, rows 633 to 642), 81f5e663 (brief budget 40 kB) and 66f04f9e (pipeline plan A140 to A143).

## Unmerged
Nothing is open. The NOT MERGED runs and what closed each:
- R274 #907 (round 2: the diff raised the timeout of R255's test) closed by R274f1 #914. G310 #909 (same raised timeout; its three red checks were not the package) closed by G310f1 #915.
- S53f1 #929 (vitest wanted `storedMark.ts` named in the engine README) closed by S53f2 #937 on the same branch. R271 #949 (audit round 3: the σ chip's ⚠ lost in the history row and the chip) closed by R271f1 #956.
- A126 #951 (stopped by hand at 23:25, rc=143, 27 of 30 shards measured and clean) closed by the rerun #959.
- Branches of these runs can go once their merges are checked.

## What went wrong
- **One R255 test raced.** `persist.spec.ts` "2 Enter + 4 before the field" failed in runs 907, 909 and 942: the last Enter landed while row 2 was pending and was dropped. Two packages (R274, G310) raised its timeout and were sent back; R255f1 fixed another cause; R255f2 fixed the test. Its neighbour "a kept 5, then + 3 Enter" gave 3 in about 1 of 64 runs at 16 workers (backlog Flaky line, not seen in a check).
- **Size limits decided five runs:** the start chunk at 61.03 kB (G310), unit view + shared 67.35 kB (S53f1) and 69.21 kB (R271), the pin 61,200 B (G322, the engine name in the chunk follows the engine build), the text baseline (G318). A124 made docs-or-size fix rounds free; it was used by R271, G187 and G322.
- **Load flakes:** `showcase.spec.ts:64` failed in R274 round 1, G310 round 1 and A138 round 0 (the log named a skipped "×" title; A130 now drops skipped lines). Golden timing: invariants 87.9 s against 60 and the interrupt stage 417 ms against 400 in G310 round 2 (a backlog Flaky line). One vitest (`failedRead`) timed out at load average 43 and passed alone.
- **G318 round 1: 496 e2e failures** from a copy-engine fault in the branch, fixed in round 2 with a regression test; the run sat 2,654 s in the queue.
- **Four rounds:** R271 (σ chip, three audit findings) and G187 (stack overflow left without a patch, `powerPastRange` read at one point, backlog over budget).
- **Waits:** merge-queue waits of 6 to 17 minutes were normal; host-cpu waits ran to 976 s (G170) and integ to 1,005 s (G187); pass 135 waited 736 s for the pass lock.
- gc ran 14 times (report `.tasks/gc-2026-11-11.md`).

## Opus passes (NOTES)
- 127 (R269, R255, R274): R269 ok, R255 ok with a gap (R255f1), R274 fix (timeout raise; R274f1). CORE 69/69; e2e 1854.
- 128 (G304, G305, G310): G304, G305 ok; G310 fix (restore the test file; none of its three failures was the package's). Golden invariants 55.7 s.
- 129 (R255f1, R274f1, R275): all ok. CORE 69/69; vitest 4256.
- 130 (G310f1, A138, A128): all ok; units 239/239. Bit-identity of F-Droid's build is tested by the merge request's first CI build.
- 131 (S53, R257, R256): S53 ok and found store-bu-1 (Vars shows `=` for a stored 1/3; S53f1); R257 ok; R256 ok with two leftover comma spots (R256f1).
- 132 (S53f1, R256f1, R258): S53f1 fix (README must name storedMark.ts; S53f2), the others ok. Decided: an old saved name shows no mark; a bracket after a stored value multiplies.
- 133 (A124, A127, A129): all ok. Watch: a lane whose next rows wait on the other lane can WAIT twice and mark rows SKIPPED.
- 134 (A130, A131, A125): all ok; the R255 race got the id R255f2. CORE 70/70.
- 135 (S53f2, R261, R270): all ok; found a name stored as a side effect, `(A:=1/3)*0`, listed as A = 0 (G317).
- 136 (R271, R272, R273): R271 fix (R271f1); R272 ok but the note said Settings › Backup (R272f1: Data); R273 ok.
- 137 (R255f2, A132, A126): R255f2, A132 ok; A126 fix (rerun; branch usable). A132's 11-10 lock figures reproduce from the log.
- 138 (A126, G317, G230): all ok; F215 (`(A:=5)*approx(1)` gives the exact A a ⚠). backlog.md 19,984 of 20,000 bytes and decisions.md 40.0 of 40 kB.
- 139 (R271f1, R272f1, G187): all ok; F216 to F218 filed (F218: σ's confirmed digits also cut the value's digits, `1000.5 ± chip` times 2 shows ⚠ 3 2E3 in Home against 2001.00 ± 0.14 in the unit view). The decompose recursion F214 has no patch. Patch 0041 not sent.
- 140 (G170): ok. Patch 0042 not sent; backlog Giac line reads 0037 to 0042.
- 141 (G318, G322): both ok; one duplicate of the memory rule left on purpose, with a test comparing both. F219 to F222 filed (F219 proot epsilon, F220 rootof evalf imaginary part, F221 inequality bound as rootof text, F222 the G19 count of failed loads). Patch 0043 not sent; README and golden counts refreshed (43 patches, 7 not sent).

## What the owner must do
1. **R269 round trip** (decisions.md "Needs the user"): Paste reading value ± σ unit, about a day, Opus; decide whether to queue it.
2. **Look at Black & White and Solarized selections** (R274: every theme got the new selection colours; pass 127 kept them) in the v0.1.0 UI check.
3. **Parisse:** patches 0037 to 0043 are marked not sent (0041 gen.cc `pow`, 0042 `ilaplace2`, 0043 `solve.cc` cubic); F214's decompose recursion has no patch yet. They go in the next batch.
4. **Checklist items 72 and 73** (S53's two G2 questions; the checklist point 2 now reads 63 to 73).
5. **Docs room:** backlog.md and decisions.md are full; the next pass that must add to either trims first.
6. **Push phase-1** when content: this night's merges and doc commits are local after 66f04f9e. Still open from the 11-10 report and not rechecked here: sign G164's sample sources by Thu 11-12, the F-Droid Reproducible Builds box, R173's report form look. A136 is a day package for Thu 11-12; A140 by day before it. v0.1.0 stays on Sun 11-15, the video on Sat 11-14.

## Queue left for the next night
The tables of brief 0c at the end of this night:
- **Lane A:** 649 R284 (After G318, now merged), 650 R285 (After A144), 508 G174, 590 G223, 591 G229, 592 G235 (After G229), 633 R264, 634 R259, 635 R263, 636 R262, 637 R266, 638 R260 (After G311), then the rows behind the v0.1.0 tag or each other: 624 R276, 625 R277, 628 R279, 626 R278, 629 R283, 627 A139, 630 R280, 631 R281, 632 R282.
- **Lane B:** 646 G319, 647 G320 and 648 G321 (After G319), 585 G231, 586 G222, 587 G227, 639 G316, 640 G311, 641 G312, 642 G313, 559 A73f2 (After the tag), then 610 G306 to 613 G309 (After the weekly night).
- **No package yet:** F214 (decompose recursion), F215, F216, F217, F218, F219 to F222.

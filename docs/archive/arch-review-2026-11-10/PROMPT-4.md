# Fourth pass, short: is H2 a class?

H2 is the best find of the review. A rule that decides again at higher precision kept a wrong answer that Giac gave at high `Digits`. N62 was wrong where stock Giac is right. Your section 6 names the follow-up that exposed it, and says it takes minutes. Do exactly that, and nothing else.

The same ground rules apply: read-only, a frozen worktree at `5d91e0c4`, the same engine, `host-cpu` for any batch longer than a minute, and the mpmath oracle. Do not touch the drafts in `packages/`, because the coordinator is processing them now. Write a new file only.

1. For every function on the decision list (`app/src/engine/decisions.ts`) and every function that `decideTwice` reaches, take about ten everyday inputs each. Lean on the shapes H2 had: odd-degree polynomials with irrational roots, integrals and sums with closed forms, limits, and piecewise expressions.
2. Run each one raw at `Digits` 12, 40, 60 and 80, and through Home and CAS at 12 and 30 digits.
3. Report every input where the answer at 60 or 80 differs from the answer at 12 or 40 in meaning: fewer solutions, a different value, or an empty result or an error where there was an answer. Say for each whether N62 shows the wrong one.
4. Also test the two rules you proposed for X14 and the check-back:
   - "a second decision never replaces an answer by one with fewer solutions";
   - "a real polynomial of odd degree never solves to `[]`".
   
   Would they have caught every case you found? Do they misfire on any case that is right today?
5. If you can locate the cause inside Giac's `solve` for the cubic in 30 minutes from Giac's GPL source (unpack a copy of the tarball into your scratchpad; the download cache itself is read-only), give the function and line. Its fix goes to Bernard Parisse as a patch with a canary (rules-core, "Fix Giac bugs at their cause").

Write `<main checkout>/.tasks/arch-review-2026-11-10/HUNT-2.md`. It should hold:
- a table of input, then Digits 12, 40, 60 and 80, then what N62 shows, then right or wrong;
- the verdict on the two rules;
- the Giac cause if you found it;
- golden rows for every new wrong answer, in the same format as HUNT.md.

If nothing beyond H2's cubics shows up, say so in one line. Post a 5-line summary, then remove the frozen worktree. That ends the review.

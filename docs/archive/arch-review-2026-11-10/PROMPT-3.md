# Third pass: hunt for wrong answers inside the promise

Everything so far has come from reading code, history and tests. Nobody has yet tried to make N62 give a wrong answer on the work that launch users will actually do. That is this pass. You now know where marks are decided and where the boundary is weak (Part A of REPORT-2), so aim there instead of searching at random.

The same ground rules as before apply: read-only on tracked files, no commits, no devices, no gate, no e2e. Each probe is short. Hold `tools/devlock.sh acquire host-cpu arch-hunt 1800 || exit 1` around any batch that runs longer than a minute (the lanes may be running), and release the lock afterwards.

## The promise you are testing (owner, 2026-11-10)

- `=` means the decimal shown is the exact value.
- `≈` means every digit shown is right, **for inputs inside the stated range**. Use the range that Part A of REPORT-2 proposed. If Part A did not pin it down, state the range you assume in one paragraph before you start, and keep to it.
- `⚠` must appear when the promise cannot be kept. A `⚠` on a correct result is a much smaller fault than a missing one.
- **What counts as a wrong answer:** a wrong digit under `=` or `≈`; a result with no mark or the wrong mark; a copied, pasted or reused value (chip, Ans, history row) that differs from the one shown; a wrong unit or dimension; a Solve root that does not substitute back; or an answer that changes with the decimal comma or the digits setting when it should not.
- **What does not count:** results outside the range (unless they lack a `⚠`), extreme inputs, cosmetic layout, speed, and anything already listed in `tests/golden/*-known.yaml`, `docs/backlog.md` or `docs/must-have.md`. Check those before you report a find. A known item counts only if you show it is worse than its entry says.

## Setup

- Recreate the frozen worktree at `5d91e0c4`, as in PROMPT-2, if you removed it. Link the main checkout's `app/node_modules` into it (`ln -s <main checkout>/app/node_modules app/node_modules`; the path is gitignored).
- Engine: `GIAC_OUT=<main checkout>/engine/giac/_out/gsl`. That build is from 2026-11-10 05:18, and the patch set last changed at `1e05b9ed`. Confirm that `git log -1 5d91e0c4 -- engine/giac/patches` also shows `1e05b9ed`. If it does not, say which patches differ.
- Tools: `tools/probes/README.md` lists them. The main ones are:
  - `tools/probes/engine.ts`, which shows what Home or CAS shows for an input (`FACTS=1` for the mark facts, `DIGITS=`, `MODE=cas`);
  - `tools/probes/unit-result.ts`, for the unit view;
  - the oracle venv, `tests/golden/.venv/bin/python` with mpmath;
  - the Vitest suites for state, chips and the clipboard.

  If a probe needs the Find index, run `npm run index` in the frozen worktree's `app/` with the `N62_*` download-cache variables from CLAUDE.md. Write scratch scripts to your scratchpad, never into the repo.
- Each expected value comes from mpmath at 50 digits or more, or from a provable derivation. It never comes from memory of a calculator.

## What to hunt

The existing sweeps (oracle, sequence, view, check-back, census) already throw random expression trees at single inputs. Do not repeat them. Your edge is **realistic tasks and multi-step flows**, which the sweeps do not cover. Write about 50 tasks, about five in each group, the way a practising engineer would type them with the keys:

1. **Everyday Home numbers.** Resistor networks, RC and RL time constants, dB conversions, a percentage error, compound growth, and trig in DEG on angles a surveyor or a mechanic would use.
2. **Units.** Pressure, energy, power, flow, torque, and imperial to SI and back. Weight the tasks toward the libqalculate-only factors that are not a plain power of ten (B2), and toward any bare unit name that breaks the owner's SI/metric rule.
3. **Reuse.** A result as a chip, then Ans, then a history row recalled, then copy and paste. At every step, check that the value carried is the value shown, and that the mark survives (M1's weak paths).
4. **Settings.** The same task at 12, 20 and 30 digits, with the decimal comma on, in DEG and in RAD. Change a setting between two steps of one task.
5. **Solve.** Engineering equations (a beam deflection for a length, the Colebrook friction factor, a loan or NPV rate, a pipe or RC design value), the nearest root to a guess, and systems. Substitute every root back yourself.
6. **Function.** A root, an extremum, an intersection and an area on a curve an engineer would plot, checked against mpmath.
7. **Uncertainty.** A ± value carried through a formula and a unit conversion, checked against first-order propagation done by hand in mpmath.
8. **CAS to number.** A symbolic result (an integral, a solve, a series) that is then evaluated, plus what is drawn for it. Is the drawn form the same expression (B1)?
9. **Stored definitions.** Define `f(x)` and some variables, use them, redefine one, and check that every dependent value either updates or says that it did not.
10. **The weak paths from Part A.** For each place where Part A found a mark decided or changed outside `markOf`, write at least one task that goes through it.

Run the cheap tasks first. When a group yields nothing after its five tasks, move on. When a group yields a find, spend up to five more tasks on it to find its edge, and then stop. Use about 40% of this pass on groups 3, 4 and 10, because the code is weakest there.

## For each find

- The minimal repro: the key sequence or input, the settings, and the steps.
- What N62 shows (value, mark, and the copied text if it differs) next to the oracle's value, with the oracle's expression.
- The path through the code (`file:line`) and the cause if you can find it in fifteen minutes; otherwise "cause not found".
- The severity:
  - **S1:** a wrong digit under `=` or `≈`, or a wrong unit, inside the range.
  - **S2:** a missing `⚠`, or a reuse that changes the value.
  - **S3:** a `⚠` on a correct result, or an inconsistency between views.
- The golden case that would catch it, written in the YAML format of the right `tests/golden/*.yaml` file, with `source: oracle` and the oracle expression. Do not add it to the file; put it in the report.

## Output

1. **`<main checkout>/.tasks/arch-review-2026-11-10/HUNT.md`:**
   - The range you tested against.
   - A table of all the tasks you ran: group, task, result (pass, a find id, or known with its id).
   - The finds, ranked by severity, each with the fields above.
   - What the hunt says about M1. Do the finds cluster in the paths Part A named? Does a clean result in a group change any ranking in REPORT-2?
   - **Before the tag:** which finds must be fixed before 11-15 (every S1, and every S2 on an everyday task) and which can wait.
2. **Package drafts** for the finds that must be fixed before the tag, in the same format as Part C. Write them to `packages/`, numbered after the last `X` id already there. A package can group finds that share a cause. Each package is red-first, with the golden case from the find as the red test.
3. **A 10-line summary in the chat:** the number of tasks, the number of finds per severity, the top three, and the path to HUNT.md.

If you find nothing at S1 or S2 after all ten groups, that is a real and useful result. Say so plainly, and list the groups you would test next with more time. Remove the frozen worktree when you finish.

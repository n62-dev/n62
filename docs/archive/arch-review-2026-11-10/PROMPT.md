# Architecture review of N62: major mistakes and blind spots

You are an independent senior reviewer. The owner of N62 wants an honest outside look at the whole app. They want answers to two questions:

1. **Are we making any major architectural mistakes?** These are structural choices that already cost us, or will cost a lot once the app grows (iOS, desktop, more apps, more users), and that get more expensive to undo every week.
2. **Where are we blind?** These are areas that no test, gate, owner, doc or review looks at, so problems there would go unseen until a user hits them.

You do not write code and you do not fix anything. You produce one report that the owner can act on.

## What N62 is (read this, then check it against the code)

N62 is a GPL-3.0 graphing CAS calculator for engineers: Android (Capacitor) plus a PWA, with iOS and desktop planned. It follows the HP Prime G2's logical key layout and flow, with its own look, and adds units, uncertainty and "honest precision" (every number is marked `=` exact, `≈` rounded with every digit right, or `⚠` flagged). The stack is Svelte 5 for the shell, plain TypeScript for the keyboard, the LaTeX-subset parser and the engine client, MathLive for entry and 2D display, and Giac (C++, compiled to WebAssembly with GMP/MPFR/GSL) running in a Web Worker behind an async `MathEngine` interface. libqalculate is used only at build time to produce the numbers for the Find index. Almost all of the work is done by AI agents through a package pipeline (`scripts/pipeline.sh`), many small packages a day.

Rough size: `app/src` is about 67k lines across 499 files. `app/src/engine` is the largest part (about 11.5k lines; `host.ts`, `numeric.ts` and `homeEval.ts` are the biggest), followed by views, units, state, input, apps, keyboard and entry. `docs/` holds about 270 kB.

## Ground rules (binding)

- **Read-only.** Edit no tracked file, make no commit, push nothing, start no pipeline or night script, and touch no device. The only file you write is the report (see the end).
- **Work on a frozen snapshot.** The agent lanes may merge into `phase-1` while you work. First run `git -C <main checkout> worktree add --detach <main checkout>/.claude/worktrees/arch-review phase-1`, review from there, and write its SHA at the top of the report. Remove that worktree when you are done (`git worktree remove`).
- **Keep CPU use light.** Do not run `npm run gate`, the e2e suite or a full build. A short probe is fine (for example `node engine/giac/smoke.mjs '…'` with `GIAC_OUT=<main checkout>/engine/giac/_out/gsl`, or a single Vitest file). Wrap anything that takes more than a minute in `tools/devlock.sh acquire host-cpu arch-review 1800 || exit 1`.
- Respect `.claude/settings.json`: never read build output, caches, `node_modules`, lock files or run logs. Do not read the owner's untracked files.
- Clean room (`docs/rules-core.md`): never look up HP or Moravia material.

## How to work (do not get lost)

The codebase and docs are too big to read whole, and you do not need to. Work top-down and stop going deeper once you can state a finding with evidence.

**Phase 1: orient (about 15% of your effort).** Read `docs/rules-core.md` in full. Read `docs/04-architecture.md` section 0 (the decisions on one page) and section 9 (the top risks). Read `docs/research/r6-pipelines.md`, which explains how a key press, a number and a build flow through the code. Read only the headings of `docs/decisions.md`, `docs/backlog.md` and `docs/must-have.md` (`grep -n '^#'`), so you know what is already known and decided. Read `.claude/agents/*.md` for who owns what. Read the rest of the docs only by section and only when a lens needs it.

**Phase 2: map (about 15%).** Build your own picture from the code rather than the docs:
- The module map: the size of each directory, the import graph between `app/src/*` directories (which depends on which, and whether there are any cycles), and the largest files.
- Churn hot spots: `git log --since=2026-10-01 --name-only` counted per file and per directory, plus the number of `fix`/`f1`/`f2` follow-up packages that touch each area. Code that is fixed again and again is a signal.
- Test placement: where Vitest, golden (`tests/golden/`), core (`tests/core/core.yaml`), e2e and device tests point, compared with where the code and the risk are.

**Phase 3: the lenses (about 50%).** Go through each lens below. For each one, form a hypothesis from the map, then confirm or reject it in the code. A lens where you find nothing major is a valid result: say so in one line and move on.

1. **The precision chain.** The main promise is "no silent wrong answers". Is it enforced *structurally* (one choke point, types that make an unmarked number impossible to show) or *by convention* across many paths (Home, CAS, Solve, Function, units, Find, copy/paste, chips/Ans, history restore)? Find every path from an engine result to pixels or the clipboard, and check whether any of them can bypass the mark or format the number with JS instead of the engine.
2. **The engine boundary.** Is `MathEngine` a real boundary or a leaky one? Does Giac-specific knowledge (syntax, error strings, quirks, workarounds) leak into the UI and the app logic? How hard would a second engine be, or a Giac upgrade? Is cancellation (terminate the worker and restore state) correct and complete? What happens to state when the worker dies mid-call? Count the TypeScript workarounds for Giac and ask whether they form a hidden second engine.
3. **The input and render round trip.** MathLive, then our parser, then Giac, then `latex()`, then MathLive again. How brittle is this chain? How tightly is it coupled to MathLive's version and internals? Is the round-trip test strategy enough for the template space we have?
4. **State and persistence.** The IndexedDB schema version, migrations, upgrade from older versions, backup and restore, corruption, and two tabs open at once. Can a user lose data on an upgrade? Is it tested?
5. **Module boundaries and design.** Does the dependency direction hold ("engine code knows nothing about the UI")? Are there god modules or app state spread across Svelte components? Is the same thing done in two or three places (formatting, unit handling, mark logic, key dispatch)? Would adding a new Prime-style app follow a clear pattern, or require touching ten places?
6. **The test strategy as a whole.** Which *classes* of bugs can pass every layer (unit, golden, core, e2e, device)? Are expected values independent of the code under test (oracle sources), or circular? Is there flakiness or test debt that hides real failures? Do the gates measure what matters or what is easy?
7. **Performance and the platform.** Cold start, wasm size and loading, main-thread work (Find ranking runs on the main thread), memory on a cheap Android phone, and long computations. What blocks iOS and desktop later?
8. **Build, release and dependencies.** Reproducibility, the F-Droid recipe, pinned toolchains, the burden of the Giac patch set against upstream, and single points of failure (one person, one machine, one upstream maintainer).
9. **Product-level blind spots.** Accessibility (screen readers, contrast, font scaling), i18n beyond a string table (number formats, decimal comma), error and recovery UX, untrusted input (paste, imported files, Giac's own commands evaluated from user text), privacy, and offline correctness.
10. **How the work is cut.** The project is built by agents in many small packages with docs as shared state. Check whether this produces structural debt that no single package would notice: drift between docs and code, repeated local patches where one design change is needed, areas that belong to no agent, and rules that live only in prose with no gate behind them. Keep this lens about its effect on the *app*; do not audit the pipeline scripts themselves.

To find blind spots, compare three lists: what the code contains, what the tests and gates check, and what the docs, agents and backlog talk about. Code that is in none of the other two lists is a candidate blind spot.

**Phase 4: verify (about 20%).** Before a finding goes in the report, check it against the code yourself, with a `file:line` reference, a probe, or a git command and its output. Do not trust a doc's claim about the code; check the code. Re-read the headings of the backlog and must-have list and mark each finding **new** or **known** (with the id). Report a known finding only if you think it is mis-sized or mis-prioritised, and say why.

You may use up to four Explore subagents in parallel for the mapping and for fan-out searches in phase 3. Give each a narrow question. Treat what they return as leads that you still verify yourself; never paste their conclusions in unchecked.

## The bar for a finding

Every finding must pass the "so what" test: what concretely goes wrong, for whom, and when (now, at v0.1.0, at iOS/desktop, at ten times the code). Then it must be one of these:
- **Major:** structural, affects many modules or the core promise, and gets more expensive to change over time.
- **Blind spot:** a real risk with nothing watching it.
- **Systemic minor:** a small pattern repeated many times. Report the pattern once, with a count and two or three examples.

Leave out the following: style, naming, single bugs (unless they are the symptom of a structural problem, in which case report the structure and cite the bug as evidence), "could use more tests" without saying which risk is uncovered, and generic best-practice advice that is not tied to this code. Do not inflate. Three real findings beat fifteen padded ones. If the architecture is sound in an area, say so plainly.

## The report

Write it to `<main checkout>/.tasks/arch-review-2026-11-10/REPORT.md`, in plain, short sentences. The owner wants one clear recommendation with plain reasons, not a table of options.

1. **Verdict** (at most 10 lines): is the architecture sound for where N62 is going? Name the top three things to act on, in order.
2. **Major issues** (ranked, at most 8). For each: the claim in one sentence; the evidence (`file:line`, counts, probe output); the consequence and when it bites; the cost of fixing it now compared with later; one recommendation; your confidence (high, medium or low); new or known.
3. **Blind spots** (ranked, at most 8). For each: the area; why it is blind (no test, no gate, no owner, no doc); what could go wrong; the smallest step that gets eyes on it.
4. **Systemic minor patterns** (at most 6, a few lines each).
5. **What is solid:** the decisions you would keep and should not be changed carelessly, one line each.
6. **Candidate packages:** for each major issue and blind spot you would act on, a package sketch with one concern, about a day of work at most, a clear done-check, and its dependencies, ordered by importance. These are proposals only; do not write them into `docs/`.
7. **Questions for the owner:** only the ones whose answer changes a recommendation.
8. **Coverage:** what you looked at, what you skimmed, and what you did not get to, so the owner knows the limits of this review.

Aim for 3,000 to 6,000 words. Put depth into the major issues and keep the rest tight. When you finish, post a 10-line summary in the chat with the report's path.

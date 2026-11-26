# TypeScript course authoring brief for Astra

Design the first premade course for Practice Range, the Herdr learning mod. Start with an outline and two complete sample modules. We will validate those samples against the real checker before authoring the rest. Do not generate the entire course yet or change product code.

Read `LEARNING_SCOPE.md` beside this brief. Practice Range is the destination. Tutor supplies teaching features to migrate. The course must work without a repo and without runtime AI.

## Authoring rules

| Code | Rule |
| --- | --- |
| A1 | Teach a learner who may be new to programming. Provide a second entry path for someone who knows another language. Do not assume JavaScript knowledge in the beginner path. |
| A2 | Define observable outcomes and prerequisites before lesson prose. Every required concept must be introduced before use or explicitly supplied without asking the learner to understand it yet. |
| A3 | Explain in plain language. Introduce the correct technical term alongside its explanation. Explain runtime JavaScript behavior separately from TypeScript checks. |
| A4 | Use reviewed default examples and a small task tracker for continuity. Do not require a repo, server, framework, browser UI, network request, or external package in an answer. |
| A5 | Progress through explanation, prediction, walkthrough, guided modification, and independent work. Include debugging and later review. Do not pad the course to match a topic count. |
| A6 | Use hints that reveal progressively more. Keep the full solution separate. Correctness checks should allow equivalent solutions unless practicing a particular syntax form is the stated objective. |
| A7 | Separate core language competence from optional advanced types. Do not imply completion makes a learner a professional developer. |
| A8 | Follow repository instructions. If `GRAPHIFY_OUT` is set or `graphify-out/graph.json` exists, run `graphify query` before code searches and use text search only where graph results are insufficient. Do not modify unrelated work, commit, or push. |

## Existing implementation to inspect

Read the current files rather than relying on old implementation prompts:

- `practice-range/mods/practice-range/languages/typescript/types.js`
- `practice-range/mods/practice-range/languages/typescript/index.js`
- `practice-range/mods/practice-range/languages/typescript/{runner,compiler,source}.mjs`
- `practice-range/mods/practice-range/languages/typescript/content/functions.js` and examples from other relevant topic files.
- `practice-range/mods/practice-range/languages/typescript/catalog.js`
- `practice-range/mods/practice-range/languages/typescript/package.json`
- `tutor/mods/tutor/{learner,prompts,build,validate}.js`

The current pack pins TypeScript 6.0.3. Verify the repository version before authoring. Do not assume a global compiler, silently upgrade dependencies, or depend on cached packages. Identify authoritative language references for technical claims and verify version-sensitive behavior with the pinned compiler.

Existing TypeScript exercises support `id`, `title`, `prompt`, `starter`, `solution`, `hints`, `rules`, `checks`, `typeChecks`, `rejects`, `declarations`, local `modules`, and script/module modes. Confirm the exact types. Runtime `checks` are boolean expressions, `typeChecks` must resolve to true, and `rejects` statements must fail type checking. Syntax rules inspect the learner's code. No course loader or new course schema is implemented yet.

## S1 Complete curriculum design

Return an ordered module table with stable proposed IDs, prerequisites, measurable outcomes, planned assessment, and beginner versus experienced entry paths. Aim for roughly 16 to 22 core modules, adjusting for pacing rather than enforcing that count.

Cover these learning areas in a sensible prerequisite order. These are coverage requirements, not a prescribed module sequence:

| Code | Learning area |
| --- | --- |
| T1 | Running and saving code, values, variables, primitive types, expressions, and reading diagnostics. |
| T2 | Boolean decisions, loops, functions, parameters, returns, and scope. |
| T3 | Arrays, objects, collections, optional values, and data transformations. |
| T4 | Inference, annotations, object shapes, aliases, interfaces, unions, narrowing, and discriminated unions. |
| T5 | Runtime values versus erased types, `unknown` versus `any`, null handling, and runtime input validation. |
| T6 | Modules, exports, basic project/compiler configuration, debugging, tests, and interpreting failed checks. |
| T7 | Errors, promises, async/await, and deterministic local asynchronous fixtures. |
| T8 | Practical generics, common utility types, composition, and reading class-based code. |
| T9 | A small cumulative project and a final unfamiliar task requiring independent application. |

Put elaborate conditional/mapped types and other specialist material in optional extensions where appropriate. Include a concept map, a proposed project sequence, readiness checks for experienced learners, and explicit scope limits.

## S2 Proposed content format

Provide a small concrete manifest and module format compatible with C1 through C7 in the scope. Use JSON for structured content and referenced UTF-8 files for code. Markdown may be used inside explanation fields. Do not claim this proposed format is already supported.

Separate course content from mutable enrollment and attempt records. Use stable IDs and a declared schema/content version. Distinguish bundled example references from optional repo references. Identify which existing runner fields can be reused and which need an adapter. Identify any sample requirements the current runner cannot support rather than disguising them as executable exercises.

## S3 Two complete sample modules

Provide an early module on values, variables, and inference, and a later module on discriminated unions and narrowing. List the later module's prerequisites explicitly. Supply the following for each:

| Code | Deliverable |
| --- | --- |
| M1 | Short introduction, explicit outcomes, prerequisite concepts, and lesson steps. Explain why the feature is useful through concrete code. |
| M2 | Runnable example files with expected output. Mark intentional compile errors and their expected diagnostic codes separately. |
| M3 | At least two prediction questions with answers, plausible distractors, and explanations of common mistakes. |
| M4 | A guided modification, two independent exercises with different cases, and a debugging task. Include starters, reference answers, three hints, fixtures, and executable checks. |
| M5 | For each assessed exercise, at least two plausible wrong answers that the checks must reject. Name the misconception and expected failure. Include a valid alternative solution where reasonable. |
| M6 | One later review variation that changes the problem enough to test application rather than recall. Explain how success would count as independent evidence. |
| M7 | Exact links to reusable drill IDs after inspecting the existing catalog. Mark gaps explicitly instead of inventing existing IDs. |

Do not use hidden material that the prompt has not specified. Type-only exercises must verify types, not pass solely because a runtime value happens to match. Behavioral exercises need cases that reject obvious hardcoded answers. Explain the failure in terms the learner can act on.

## S4 Project sample

Outline a small task tracker built over several modules. Provide one early runnable checkpoint and the final task specification. Identify the minimal bounded workspace support needed. Keep editable learner files separate from trusted checks. The final assessment should introduce a new requirement, such as validating imported task data or reporting task summaries, without giving a sequence of implementation steps.

The project should exercise functions, collections, data modeling, input validation, errors, modules, tests, and local async behavior. Do not introduce a framework or network service to make the project appear realistic.

## S5 Verification and critique

Validate sample content using the existing pack where possible. Report each runnable check as executed with its result or pending with the exact missing capability. Do not mark code tested because it appears correct.

Review the samples for missing prerequisites, ambiguous questions, type/runtime confusion, overly strict syntax checks, shallow tests, and hints that disclose the full answer. Identify issues concretely and revise before delivery. State what still needs learner observation.

Return an outcome-to-assessment map, compiler/checker results, and a short list of unresolved teaching or integration questions. Course quality depends on this evidence, not a self-assigned quality score.

## Output and handoff

When working in this repository, place proposed content under `practice-range/course-drafts/typescript/` with an outline, manifest, modules, code fixtures, and validation notes. Keep it outside the runtime course registry until reviewed. A chat-only handoff should return the same relative file tree and complete file contents. Do not write to learner data or install configuration.

After the sample passes editorial review and real execution, author the remaining course in batches using the approved format. Full authoring is the next assignment, not part of this sample request. Implementation remains in Practice Range.

# TypeScript course pilot

This guide runs the P7 pilot in `LEARNING_SCOPE.md`. It answers the open questions Q1–Q4 in `VALIDATION.md`. Local notes are enough. No analytics service is used.

## Who

Run at least two people from each group. More is better, but four sessions already show the blocking problems.

| Code | Group | Entry path |
| --- | --- | --- |
| L1 | New to programming | Start or resume (beginner) |
| L2 | Knows another language, new to TypeScript | I know another language (experienced) |

## Before the first session

1. Install Practice Range and the TypeScript pack on the learner's machine. Confirm Setup shows TypeScript ready.
2. Leave AI help off for the first session. Teaching must work without it. Turn it on in a later session only if you want to observe AI help as well.
3. Copy `NOTES_TEMPLATE.md` once per learner. Use a code such as `L1-a` instead of a name.
4. Do not explain TypeScript or the course before they start.

## While observing

- Say "think out loud" once at the start. After that, stay quiet unless they are stuck for five minutes.
- If they are stuck, ask "what are you looking at?" before giving any help. Write down any help you give. It counts as assistance.
- Write down the exact line, word or message that confused them, not a summary.
- Note every hint, every Show solution, and every time they leave the course to search the web.

## Session 1 (about 60 minutes)

| Step | L1 | L2 |
| --- | --- | --- |
| 1 | Save, then Values. Record whether they can explain why the quoted-number example fails before fixing it (Q1). | Readiness checks R1 and R2. Then ask which module they would start with and why (Q1). |
| 2 | Decisions, Functions and Lists, as far as time allows. | Their chosen module and the one after it. |
| 3 | Pilot task `new-task` without hints, once Lists is done. | Pilot task `new-task` without hints. |

## Session 2 (two to seven days later)

| Step | Both groups |
| --- | --- |
| 1 | Open Review in the course and do whatever is due without looking at earlier answers. Record seat-snapshot and sensor-display results if they come up (Q2). |
| 2 | Pilot task `type-error`, once Shapes is done. Ask them to explain the compiler message before editing. Write their explanation word for word. |
| 3 | Pilot task `debug`, once Tagged is done. Ask them to name the failing cases and why before fixing. |
| 4 | If they reach it, start a project checkpoint from the module list and note where the project list helps or confuses them (Q4). |

## Pilot tasks

The pilot tasks are not in the course. Give them out with the checker script from the repository root.

```bash
node practice-range/scripts/pilot-check.mjs list
```

```bash
node practice-range/scripts/pilot-check.mjs start new-task ~/pilot-L1-a
```

```bash
node practice-range/scripts/pilot-check.mjs check new-task ~/pilot-L1-a/new-task.ts
```

`start` writes the starter with the prompt as a comment, the supplied types and a `tsconfig.json`, so the editor shows the same errors as the checker. It never overwrites an existing answer. `check` prints the result and never shows a reference answer. Each task has three hints in its `task.json`. Give one only when asked, and record it.

| Task | After | What it shows |
| --- | --- | --- |
| `new-task` | Lists | A new problem solved without hints: index versus value, tie handling, empty input. |
| `type-error` | Shapes | Reading a compiler error. The starter fails with TS2322 on the return line because `total` started as text. |
| `debug` | Tagged | Finding a bug in code that compiles. Zero percent and an empty reason are treated as missing. |

## After each session

1. Copy the learner's course progress so their attempts and assistance are recorded exactly. It is `enrollment.json` under `~/.config/herdr-app/data/practice-range/courses/course%3Ats-foundations/<version>/`.
2. Finish the notes the same day.
3. Add each problem to the findings table below with a code. Fix content before adding more learners if the same problem blocks two people.

## Findings

| Code | Learner | Module or task | Exact confusing text or step | Blocking? | Fix | Fixed in version |
| --- | --- | --- | --- | --- | --- | --- |

## Done when

- Every L1 learner explains the quoted-number error in their own words and fixes it from a fresh starter.
- Every L2 learner picks a starting module from the readiness results without guessing syntax.
- Most learners pass `new-task` without hints and explain the `type-error` message correctly.
- Delayed review shows at least some independent passes on earlier tasks.
- No finding marked blocking is still open.

Then rerun the checks in `practice-range/RELEASE.md` and update the P7 row in `LEARNING_SCOPE.md`.

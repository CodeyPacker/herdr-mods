# Reading course format

A reading course is a course pack with no code to run. This file describes how its draft differs from a language course. The rules were read from `courses/loader.mjs`, `courses/service.mjs`, `courses/panel.js` and `scripts/build-course.mjs`.

## Manifest

| Field | Rule |
| --- | --- |
| `kind` | `"reading"`. This is what marks the pack. |
| `languageId`, `runner` | Absent. The loader rejects a reading course that names either. |
| `entryPaths` | One path, `beginner`. The catalog shows a single Start button for a reading course. |
| `readiness`, `project` | Absent. Both hold exercises. |
| `modules` | As in any course: ID, title, prerequisites, concepts taught, and the path of the module file. |

Build with `node practice-range/scripts/build-course.mjs api-design`. The pack is written to `courses/packs/api-design.json`, named after the draft folder. Once that pack is in a commit, any content change needs a new `runtimeContentVersion`.

## Module

A module file has `intro`, `steps`, `questions` and `examples`, as in a language course. `tasks` and `drills` are empty lists.

- **Step text** is Markdown. Paragraphs, lists, tables, bold and inline code are used. Keep one idea per step.
- **A question** has a prompt, choices, the index of the right answer, and feedback for every choice. Every question must be shown by some step. `example` on a question is optional.
- **An example** is a text file shown below a step. It must have `"readOnly": true`, because nothing can run it, and a `fence` that says how to show it: `text` for diagrams, `http` for requests and responses, `json` or `yaml` for documents.

## Diagrams

Diagrams are plain text in a `text` example. Use ordinary characters, keep every line to 76 characters or fewer so that it does not wrap, and put the labels inside the diagram so that it can be read without the surrounding text. `tests/course-api-design.test.mjs` fails on a wider line.

## What the app does differently

- The catalog hides the "I know another language" button.
- The module list hides the repo section, since there is no source code to match.
- A lesson hides "Explain this topic using my repo" and "Write extra practice".
- A module's status can reach "started" and "read" only.

## Checks

There is no verifier run, because there is nothing to execute. `tests/course-api-design.test.mjs` checks the built pack: 15 available modules, no exercises, every example read-only with a known fence, every diagram narrow enough, every question shown and with distinct answers, each module with an exercise and a worked answer, and no text that looks like a live credential. It also drives an enrollment through the course service. Three native panel fixtures render the module list, a lesson with a diagram and an answered question.

## Not verified

Nobody has looked at the rendered lessons in the app. The fixtures prove that the panels build. They do not show whether Markdown tables and the diagrams look right at the pane's real width. The accuracy of the text was reviewed by its author only.

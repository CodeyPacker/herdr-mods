# Data structures and algorithms

A coding course about choosing how to store data and how to work on it. Every module explains an idea, runs two examples that the reader predicts first, and sets three exercises that the app checks. It is written in TypeScript and uses the app's existing TypeScript checker.

Status: all 14 modules and 3 readiness tasks are written, verified, built and registered as `course:dsa`, content version 0.1.0-preview.1. Nothing is committed yet. Nobody has worked through it as a learner.

## Who it is for

Someone who can already write functions, loops, arrays and objects in TypeScript, and wants to choose data structures and algorithms deliberately. It is the second TypeScript course in the app, after `course:ts-foundations`. It teaches no TypeScript syntax and makes no comparison with any other language.

## Modules

The manifest expands each key with `course:dsa/module/`.

| Module | What the reader can do afterwards | Exercises |
| --- | --- | --- |
| 1. **cost** · Count the work | Count the steps of a loop and name how they grow. | largest, count-above, has-pair-sum |
| 2. **arrays** · Arrays and two pointers | Say what each array operation costs, and solve a problem with two indexes in one pass. | reverse-in-place, is-palindrome, merge-sorted |
| 3. **search** · Binary search | Find a position in sorted data by halving the range. | index-of-sorted, first-at-least, sqrt-floor |
| 4. **hashing** · Maps and sets | Replace a search through a list with one lookup. | has-duplicate, count-words, two-sum |
| 5. **stacks** · Stacks and queues | Choose last-in-first-out or first-in-first-out, and build each on an array. | is-balanced, evaluate-rpn, task-queue |
| 6. **linked** · Linked lists | Walk, change and reverse a chain of nodes without losing part of it. | count-nodes, reverse-list, remove-value |
| 7. **recursion** · Recursion | Solve a problem by calling the same function on a smaller one. | sum-nested, power, subsets |
| 8. **sorting** · Sorting | Sort with a simple method and with merge sort, and order records with a comparator. | insertion-sort, merge-sort, sort-tasks |
| 9. **trees** · Trees | Walk a binary tree, and search a binary search tree along one path. | height, inorder, bst-contains |
| 10. **heaps** · Heaps | Keep the smallest item at hand with a heap stored in an array. | heap-push, heap-pop, k-smallest |
| 11. **graphs** · Graphs and breadth-first search | Store a graph and explore it level by level to find the fewest steps. | reachable, shortest-steps, count-groups |
| 12. **depth** · Depth-first search and ordering | Explore depth first, detect a cycle, and order items by what they need. | has-path, has-cycle, build-order |
| 13. **dynamic** · Dynamic programming | Speed up a recursive solution by remembering answers to smaller problems. | climb-ways, min-coins, longest-common |
| 14. **choose** · Choose the structure | Pick a structure and an algorithm for a new problem. | merge-intervals, group-anagrams, shortest-grid-path |

Readiness tasks for the experienced entry path: R1 values in both sorted arrays (modules 1 to 4), R2 merge two sorted linked lists (modules 5 to 8), R3 sum each level of a tree (modules 9 to 13).

The course has 126 steps, 28 questions, 28 runnable examples, 42 exercises with 219 checks, and 3 readiness tasks with 13 more checks.

## How a module is built

Each module has nine steps: an explanation, a prediction about a running example, a trace of that example, a second explanation, a second prediction and trace, and three exercises. The file layout and the task format are those of the TypeScript course, described in `../typescript/FORMAT.md`.

## Decisions

- D1: **A coding course, in TypeScript.** Data structures are learned by writing them, so this is not a reading course. TypeScript was chosen because its checker is already in the app, starts quickly and needs only Node. This is an assumption. See `QUESTIONS.md` at the repo root.
- D2: **The checks measure work, not only answers.** Where the point of an exercise is speed, a check counts something and fails a correct answer that does too much. Arrays are wrapped in a `Proxy` that counts element reads, so the learner writes ordinary code. Sorting counts calls to a supplied `before(a, b)`. Fast exponentiation counts calls to a supplied `times(a, b)`. The large search tree counts reads of a node's value. All of these are exact, so they give the same result on any machine.
- D3: **One exercise uses the time limit.** `dynamic-climb-ways` starts from a correct recursion that cannot finish for 60 steps. Nothing can be counted inside a learner's own recursion, so the check relies on the checker's 5 second limit. The learner sees "The code exceeded the time limit". The prompt says to expect it.
- D4: **Syntax rules stop shortcuts.** Exercises that ask the learner to write a method themselves forbid the built-in one, for example `sort`, `reverse`, `shift`, `Math.sqrt` and `Math.max`. A forbidden call fails with a sentence that says what to do.
- D5: **Flawed starters for the guided exercises.** In the first 13 modules, the first exercise starts from code with one realistic mistake, or from code that is correct and too slow (`hashing-has-duplicate` and `dynamic-climb-ways`). The last module has three independent exercises and no guided one.
- D6: **No project and no drills.** The course has no running project, and the practice catalog has no drills on these topics, so every module's `drills` list is empty and says why.
- D7: **A second course in one language.** `verify-course.mjs` and `build-course.mjs` now accept a draft folder that is not named after its language. The pack is written as `dsa.json`.

## Checks

`node practice-range/scripts/verify-course.mjs dsa` runs every example and every exercise through the product's checker: 28 examples print their recorded output, 45 reference answers and 45 alternative answers pass, all 45 starters fail, and 90 wrong answers each fail on the check and for the reason recorded for them. `tests/course-dsa.test.mjs` checks the built pack and drives an enrollment, including a correct-but-slow answer that fails only its work-counting check.

## Not verified

- Nobody has worked through the course as a learner, so the difficulty curve and the wording of the hints are untested.
- The exercises were not opened in the app with a real editor. The supplied counting code appears to the learner in `supplied.ts`, and how that reads there has not been looked at.
- The catalog's button for the experienced path reads "I know another language", which does not fit this course. The label is shared by all language courses and was left alone.
- The thresholds of the work-counting checks were chosen with room to spare and tested against one correct iterative and one correct recursive answer each. An unusual correct answer could still exceed one.

## Scope

Outside this course: balanced trees, tries, union-find, weighted shortest paths, string searching, bit manipulation, and proofs of correctness.

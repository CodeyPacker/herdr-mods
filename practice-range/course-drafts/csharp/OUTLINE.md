# Learn C#

Status: 0.2.0-preview.1 in progress (COURSE_REDESIGN.md, Phase C). Replaces the 0.1.0 "Build a task tracker with C#" outline.

The course teaches C#, one concept per module. There is no project and no capstone (D11). Each module uses its own everyday examples, so no module depends on code from another (D12). It teaches C# on its own terms and never compares it with another language (D9).

Module keys stay the same as 0.1.0, so files, task IDs and progress stay put. Only titles and content change.

## Modules

Each module: an intro, 6 to 10 steps, at least one prediction question, 2 to 4 tasks and a review task. The last task in each module is its review task. "Examples" lists the settings to use instead of the old task tracker. Pick one per step or task, and keep each one short.

| # | Key | Title | Teaches | Examples | Skip-ahead test |
| --- | --- | --- | --- | --- | --- |
| 1 | save | Run a program, read errors | Save and run, read output, find the line a compiler error names | greeting, a receipt line | none |
| 2 | values | Types and values | `int`, `double`, `string`, `bool`, `var`, arithmetic, `int` vs `double` division, interpolation, type errors | temperatures, a bill split, a name badge | R1 |
| 3 | decisions | Control flow | `if`/`else`, comparisons, `&&`/`||`/`!`, edge values | ticket prices by age, a thermostat, a password rule | R1 |
| 4 | methods | Methods | parameters, return values, `void`, scope, expression bodies, static methods | unit conversion, a tip calculator | R1 |
| 5 | collections | Arrays and lists | arrays, `List<T>`, `for`/`foreach`, running totals, index bounds | step counts, a playlist, test scores | R1 |
| 6 | classes | Classes and properties | fields, properties, constructors, methods, two names for one object | a bank account, a book, a thermostat object | R2 |
| 7 | records | Structs, records, copies | value vs reference, `struct`, `record`, `with`, `==` on each | 2D points, a colour, an address | R2 |
| 8 | nulls | Nullable types | `?`, null checks, `??`, `?.`, keeping 0 and "" | an optional middle name, a missing reading | R2 |
| 9 | lookups | Dictionaries and sets | `Dictionary<K,V>`, `TryGetValue`, counting, `HashSet<T>` | word counts, a phone book, unique visitors | R2 |
| 10 | linq | LINQ | `Where`, `Select`, `OrderBy`, `Count`, `Sum`, `GroupBy`, deferred execution | a shopping cart, movie ratings | R3 |
| 11 | interfaces | Interfaces and inheritance | declaring and implementing an interface, base classes, `virtual`/`override` | shapes and areas, notifications | R3 |
| 12 | patterns | Pattern matching | `switch` expressions, type and property patterns, arm order | shipping cost by parcel, payment types | R3 |
| 13 | exceptions | Exceptions | `throw`, `try`/`catch`/`finally`, specific exceptions, `TryParse` vs exceptions | parsing user input, a withdrawal limit | R3 |
| 14 | generics | Generics | generic methods and types, constraints | a pair, a cache, the largest item | R4 |
| 15 | async | async and await | `Task`, `async`/`await`, order of awaits, a failed task | downloading (simulated), reading files (simulated) | R4 |
| 16 | checks | Writing unit tests | expected vs actual, off-by-one bugs, a check that catches a bug | a discount rule, a word counter | R4 |

Removed from 0.1.0: the `tracker` and `report` modules and the four project checkpoints in `project/`.

## Skip-ahead tests

R1 to R4 each cover four modules (R4 covers generics, async and checks). Each is a new problem that uses only what its modules teach. Rewritten in C17.

## Rules for every module

- Write it as `modules/<key>/module.md` (format: COURSE_REDESIGN.md). Run `node scripts/course-markdown.mjs modules/<key>/module.json` first to start from the current content, then delete `module.json` and the example `.cs` files, and point the manifest at `module.md`.
- Replace every task tracker word (task, board, owner, open, done, tracker, arrivals) with the module's own examples.
- Keep task folders, IDs and file names. Rewrite prompts, starters, solutions, alternatives, fixtures, wrong answers and checks to match.
- Check with `node scripts/verify-course.mjs csharp <key>` before ticking the box.

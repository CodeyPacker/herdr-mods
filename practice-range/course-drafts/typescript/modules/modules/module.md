---
id: course:ts-foundations/module/modules
title: Modules
requires: ["function","object-shape","annotation"]
outcomes: [{"id":"predict","can":"Explain a local export and distinguish strict null checking from the emission target.","assessment":["predict","explain"]},{"id":"named","can":"Repair a named import","assessment":["course:ts-foundations/task/modules-named"]},{"id":"export-task","can":"Export a typed song constructor","assessment":["course:ts-foundations/task/modules-export-task"]},{"id":"config","can":"Read a project configuration","assessment":["course:ts-foundations/task/modules-config"]}]
tasks: [{"id":"course:ts-foundations/task/modules-named","path":"tasks/named/task.json"},{"id":"course:ts-foundations/task/modules-export-task","path":"tasks/export-task/task.json"},{"id":"course:ts-foundations/task/modules-config","path":"tasks/config/task.json"}]
review: {"task":"course:ts-foundations/task/modules-config","afterModule":"course:ts-foundations/module/async","evidence":"Use a fresh answer on a later visit. An unaided pass on the changed case adds independent evidence. Preserve hint use and solution reveals with their attempts."}
drills: ["modules/import-named","modules/export-function"]
drillGap: The linked drills isolate syntax. This module checks the combined behavior on varied inputs.
---

Each file is a module. A module shares names with `export`, and other files bring them in with `import`.

## Connect two local files

- `export function double(n: number)` makes `double` available to other files.
- `import { double } from "./numbers.js"` brings it into another file. The name must match the export.
- The path is relative and ends in `.js`, even though you write `.ts`. The compiler turns each `.ts` file into a `.js` file, and the import points at that output.

## Predict before running {prediction}

Read the example and predict what it prints before you run it.

```typescript example trace
export function double(n: number): number {
  return n * 2;
}
console.log(double(3));

```

```output
6
```

:::question predict example=trace
What does the call print?
- [x] 6 :: `export` makes the name available to other files. This file can still use it.
- [ ] Nothing, because the function is exported. :: The local call still runs.
:::

## Compiler settings {walkthrough}

`tsconfig.json` holds the compiler's settings. Two settings are easy to mix up:

- `strict` turns on a group of stricter checks. One of them, `strictNullChecks`, reports code that might read a field of `null` or `undefined`.
- `target` picks which JavaScript version the compiler outputs, such as `"ES2022"`. It does not change what gets checked.

@example trace

## Check your explanation {prediction}

Read the example again and choose the explanation that fits.

@example trace

:::question explain example=trace
Which setting makes the compiler flag a possible `null` access?
- [ ] `target` :: `target` only picks the output JavaScript version.
- [x] `strict`, through `strictNullChecks` :: `strict` turns this check on unless you turn it off separately.
:::

## Ways to import

The same export can be imported in a few ways.

```typescript
import { add, starting } from "./numbers.js";   // named imports
import { add as plus } from "./numbers.js";      // renamed
import * as numbers from "./numbers.js";         // all exports, used as numbers.add
import type { Song } from "./model.js";          // a type only
```

`import type` brings in a type for checking only. It is removed from the output JavaScript, because types do not exist at runtime.

## Repair a named import {modification}

The starter imports a name that `numbers.ts` does not export. Fix the import and return `add(starting, delta)`.

@task modules-named

## Export a typed song constructor {independent}

Import the `Song` type from `model.ts` and export a function that builds one.

@task modules-export-task

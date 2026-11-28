---
id: course:ts-foundations/module/shapes
title: Object types and interfaces
requires: ["function","array"]
outcomes: [{"id":"predict","can":"Trace an object copy and identify a missing required field.","assessment":["predict","explain"]},{"id":"structural","can":"Explain that a value fits a shape by its fields, not its name.","assessment":["fits"]},{"id":"rename","can":"Retitle a book without changing it","assessment":["course:ts-foundations/task/shapes-rename"]},{"id":"ticket","can":"Describe a seat with a type","assessment":["course:ts-foundations/task/shapes-ticket"]},{"id":"move","can":"Move a point","assessment":["course:ts-foundations/task/shapes-move"]}]
tasks: [{"id":"course:ts-foundations/task/shapes-rename","path":"tasks/rename/task.json"},{"id":"course:ts-foundations/task/shapes-ticket","path":"tasks/ticket/task.json"},{"id":"course:ts-foundations/task/shapes-move","path":"tasks/move/task.json"}]
review: {"task":"course:ts-foundations/task/shapes-move","afterModule":"course:ts-foundations/module/tagged","evidence":"Use a fresh answer on a later visit. An unaided pass on the changed case adds independent evidence. Preserve hint use and solution reveals with their attempts."}
drills: ["objects/object-type","interfaces/interface","objects/spread-override"]
drillGap: The linked drills isolate syntax. This module checks the combined behavior on varied inputs.
---

An object groups named fields. An object type lists which fields a value must have and the type of each one.

## Describe an object with fields

An object type names each field and its type.

- `{ id: number; title: string }` is an object type with two required fields.
- `type Book = { id: number; title: string }` gives that shape a name you can reuse.
- `book.title` reads a field.
- `{ ...book, title: "Emma" }` makes a new object: it copies every field of `book`, then sets `title` on the copy.

## Copy with a change {prediction}

Read the example and predict what it prints.

```typescript example trace
type Book = { id: number; title: string };
const original: Book = { id: 4, title: "Dune" };
const retitled = { ...original, title: "Emma" };
console.log(original.title);
console.log(retitled.title);

```

```output
Dune
Emma
```

:::question predict example=trace
Which titles print?
- [x] Dune then Emma :: The spread copies `id` and `title` from `original` into a new object, and then `title: "Emma"` replaces the copied title. `original` is never changed. This is a **shallow copy**: it copies each field's value, which for numbers and strings is all you need.
- [ ] Emma then Emma :: Nothing assigns to `original.title`. The spread makes a separate object.
:::

## Leave out a required field {prediction}

Every field of `Book` is required.

@example trace

:::question explain example=trace
Would `{ title: "Emma" }` on its own fit `Book`?
- [ ] Yes. It has a title. :: One matching field is not enough.
- [x] No. `id` is required too. :: Every field in the type must be present, so `id` is missing. The type checker reports that before the code runs.
:::

## Type alias or interface

An interface is another way to name an object shape.

```typescript
interface Point {
  x: number;
  y: number;
}
```

For plain object shapes, `type Point = { x: number; y: number }` and the interface above mean the same thing. Pick one style and stay consistent.

TypeScript checks shapes by their fields, not by their names (structural typing). Any value with a numeric `x` and `y` fits `Point`, even if it was never declared as one.

## Shapes match by fields {prediction}

Read the example and predict whether it compiles.

```typescript example fits
interface Point { x: number; y: number }
function show(p: Point): string {
  return `${p.x},${p.y}`;
}
const corner = { x: 3, y: 5 };
console.log(show(corner));

```

```output
3,5
```

:::question fits example=fits
`corner` was never declared as a `Point`. Does `show(corner)` compile?
- [x] Yes, it prints 3,5 :: `corner` has a numeric `x` and `y`, so it fits `Point`.
- [ ] No. `corner` needs `: Point` :: Shapes match by their fields. The annotation is optional.
:::

## Retitle a book without changing it {modification}

Return a new `Book` with the new title. The starter changes the caller's book instead.

@task shapes-rename

## Describe a seat with a type {independent}

Write a type with two required fields. The checks try objects that should and should not fit.

@task shapes-ticket

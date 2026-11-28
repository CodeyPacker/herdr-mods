---
id: course:ts-foundations/module/tagged
title: Discriminated unions
requires: ["binding","text-expression","numeric-expression","diagnostic","branch","function","object-shape","type-alias","interface","literal-union","narrowing","truthiness"]
outcomes: [{"id":"trace","can":"Trace a tag check and identify which fields exist on the remaining path.","assessment":["predict-output","predict-property","course:ts-foundations/task/describe-update"]},{"id":"model","can":"Describe two object shapes that require different payloads and reject invalid tag/payload pairs.","assessment":["course:ts-foundations/task/model-delivery"]},{"id":"branch","can":"Compute the correct result for each of three variants, including zero.","assessment":["course:ts-foundations/task/apply-edit"]},{"id":"debug","can":"Move a payload read to a path where the field exists.","assessment":["course:ts-foundations/task/repair-caption"]},{"id":"transfer","can":"Use a boolean tag to handle a fresh pair of shapes and preserve zero and empty text.","assessment":["course:ts-foundations/task/sensor-display"]}]
tasks: [{"id":"course:ts-foundations/task/describe-update","path":"tasks/describe-update/task.json"},{"id":"course:ts-foundations/task/model-delivery","path":"tasks/model-delivery/task.json"},{"id":"course:ts-foundations/task/apply-edit","path":"tasks/apply-edit/task.json"},{"id":"course:ts-foundations/task/repair-caption","path":"tasks/repair-caption/task.json"},{"id":"course:ts-foundations/task/sensor-display","path":"tasks/sensor-display/task.json"}]
review: {"task":"course:ts-foundations/task/sensor-display","afterModule":"course:ts-foundations/module/errors","evidence":"Use a fresh sensor task after Errors. Record an unaided first pass as evidence that tag-based branching transfers to boolean tags and new payloads. Record hint use or a shown solution separately."}
drills: ["guards/discriminant-if","guards/three-variants","narrowing/boolean-discriminant"]
drillGap: The linked drills practice prescribed forms. This sample accepts equivalent branches and tests invalid delivery shapes and zero-valued payloads.
---

Some values come in a few shapes, and each shape has different fields. A coffee order can be waiting in line, with a place number, or ready, with a counter to collect it from. One shared field says which shape you have.

## One field identifies the shape

`Pickup` below is a union of two object types.

- Each shape has a `kind` field whose type is one exact string. This field is the **tag** (discriminant).
- A waiting pickup has a `place`. A ready pickup has a `counter`.
- A union of shapes that share a tag like this is a **discriminated union**.
- Types disappear when the code runs, but the `kind` field is still on each object, so a check on it works at runtime.

Why not one shape with two optional fields? `{ kind: string; place?: number; counter?: string }` would allow a waiting pickup with no place. The union requires the right field for each tag.


## Follow one pickup {prediction}

Read the function and both calls before running it. Choose the two output lines in order.

```typescript example board
type Pickup = { kind: "waiting"; place: number } | { kind: "ready"; counter: string };

function line(p: Pickup): string {
  if (p.kind === "waiting") return "Place " + String(p.place);
  return p.counter;
}

console.log(line({ kind: "waiting", place: 0 }));
console.log(line({ kind: "ready", counter: "Counter B" }));

```

```output
Place 0
Counter B
```

:::question predict-output example=board
What does the example print?
- [ ] waiting then ready :: The function returns field values, not the tags.
- [x] Place 0 then Counter B :: Inside `if (p.kind === "waiting")`, TypeScript narrows `p` to the waiting shape, so `p.place` is allowed, and a place of 0 is just a number. `return` ends the call, so any pickup that reaches the last line must be ready, and `p.counter` is allowed there.
- [ ] Counter B then Place 0 :: The calls run in the order they are written.
:::

## Read a field too soon {prediction}

Which line will the type checker flag? Read the code before checking it.

```typescript example bad-field diagnostics=[{"code":2339,"line":4}]
type Pickup = { kind: "waiting"; place: number } | { kind: "ready"; counter: string };

function placeOf(p: Pickup): number {
  return p.place;
}

```

:::question predict-property example=bad-field
What happens when this code is checked?
- [ ] It compiles because one shape has `place`. :: At this line `p` could still be either shape.
- [ ] It fails on the type alias because the shapes have different fields. :: A union can combine shapes with different fields.
- [x] It fails on the return line because ready pickups have no `place`. :: This is TS2339: property `place` does not exist on the ready shape. Before a tag check, a field read must work for every shape. Check `p.kind` first and read `place` inside that branch. A truthiness check such as `if (p.place)` would be wrong too: it treats a valid place of 0 as missing.
:::

## Finish the second branch {modification}

Change the starter so done workouts show their actual minutes.

@task describe-update

## Model messages and apply edits {independent}

First write a type that allows only valid delivery messages. Only the type is checked. Then write a function that applies counter edits.

@tasks model-delivery apply-edit

## Fix an unsafe read {debugging}

Use the type error and the expected results to repair `caption`.

@task repair-caption

---
id: course:ts-foundations/module/mapped
title: Mapped and conditional types
requires: ["generic","utility-types","literal-union"]
outcomes: [{"id":"keyof","can":"Name the type keyof produces and read a field with T[K].","assessment":["keyof"]},{"id":"mapped","can":"Predict the shape a mapped type produces.","assessment":["mapped"]},{"id":"conditional","can":"Predict which branch a conditional type takes.","assessment":["conditional"]},{"id":"get-field","can":"Read a field with its real type","assessment":["course:ts-foundations/task/mapped-get-field"]},{"id":"flags","can":"Turn every field into a flag","assessment":["course:ts-foundations/task/mapped-flags"]},{"id":"item-of","can":"Find the item type of an array","assessment":["course:ts-foundations/task/mapped-item-of"]}]
tasks: [{"id":"course:ts-foundations/task/mapped-get-field","path":"tasks/get-field/task.json"},{"id":"course:ts-foundations/task/mapped-flags","path":"tasks/flags/task.json"},{"id":"course:ts-foundations/task/mapped-item-of","path":"tasks/item-of/task.json"}]
review: {"task":"course:ts-foundations/task/mapped-item-of","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted.","afterCompletion":true}
drills: ["utility/partial"]
drillGap: The linked drill shows a built-in mapped type. This module writes your own with keyof, mapped and conditional types.
---

`Partial`, `Pick` and `Record` are not magic. They are written in TypeScript with three tools: `keyof`, mapped types and conditional types. This module shows how to write your own.

## Keys as a type

- `keyof T` is a union of `T`'s keys. For `type Point = { x: number; y: number }`, `keyof Point` is `"x" | "y"`.
- `T[K]` is the type of field `K` (an indexed access type). `Point["x"]` is `number`.
- Together they type a function that reads any field: `function get<T, K extends keyof T>(obj: T, key: K): T[K]`.

## Read a field by key {prediction}

Read the example and predict the answer.

```typescript example keyof
type Point = { x: number; y: number };
type Axis = keyof Point;
const axis: Axis = "y";
const p: Point = { x: 1, y: 2 };
console.log(p[axis]);

```

```output
2
```

:::question keyof example=keyof
What is the type `Axis`?
- [x] `"x" | "y"` :: `keyof` gives a union of the key names.
- [ ] `number` :: That is the type of the values, `Point[Axis]`. `keyof` gives the keys.
- [ ] `string` :: Only the two key names fit, not any string.
:::

## Make a type for every key

A mapped type builds an object type by going through a set of keys:

```typescript
type Optional<T> = { [K in keyof T]?: T[K] };
```

Read it as: for each key `K` of `T`, make an optional field with the same type as before. That is exactly how `Partial` is written. You can change the field type too: `{ [K in keyof T]: string }` makes every field a `string`.

## Predict a mapped type {prediction}

Read the example and predict the answer.

```typescript example mapped
type Point = { x: number; y: number };
type AsText<T> = { [K in keyof T]: string };
const label: AsText<Point> = { x: "left", y: "top" };
console.log(Object.keys(label).join(","));

```

```output
x,y
```

:::question mapped example=mapped
What is `AsText<Point>`?
- [x] `{ x: string; y: string }` :: Same keys as `Point`, and every field becomes `string`.
- [ ] `{ x: number; y: number }` :: The mapped type sets each field to `string`.
- [ ] `string[]` :: A mapped type over `keyof` makes an object, not an array.
:::

## Choose a type with a condition

A conditional type picks one of two types, like `? :` for values:

```typescript
type Kind<T> = T extends string ? "text" : "other";
```

- `T extends string` asks: does `T` fit `string`?
- `infer` names part of a type inside the check. `T extends (infer U)[] ? U : T` means "if `T` is an array, give its item type `U`, else `T`".

## Predict a conditional type {prediction}

Read the example and predict the answer.

```typescript example conditional
type Kind<T> = T extends string ? "text" : T extends number ? "number" : "other";
const a: Kind<"hi"> = "text";
const b: Kind<42> = "number";
const c: Kind<boolean> = "other";
console.log(a, b, c);

```

```output
text number other
```

:::question conditional example=conditional
What is `Kind<string[]>`?
- [ ] `"text"` :: `string[]` is an array, so it does not fit `string`.
- [x] `"other"` :: An array of strings fits neither `string` nor `number`.
- [ ] `"text"[]` :: A conditional type does not look inside arrays unless you use `infer`.
:::

## Read a field with its real type {modification}

The starter returns `unknown`. Use `keyof` and `T[K]` so the caller gets the field's real type.

@task mapped-get-field

## Turn every field into a flag {independent}

Write a mapped type, then a function that returns a value of it.

@task mapped-flags

---
id: course:ts-foundations/module/unions
title: Union and literal types
requires: ["literal-union","narrowing","array"]
outcomes: [{"id":"widen","can":"Predict when TypeScript infers a literal type and when it widens to string.","assessment":["widen"]},{"id":"narrow","can":"Narrow a union with Array.isArray and predict each branch.","assessment":["narrow","narrow-explain"]},{"id":"join-tags","can":"Accept one tag or many","assessment":["course:ts-foundations/task/unions-join-tags"]},{"id":"sizes","can":"Limit sizes to three choices","assessment":["course:ts-foundations/task/unions-sizes"]},{"id":"lights","can":"Step a traffic light","assessment":["course:ts-foundations/task/unions-lights"]}]
tasks: [{"id":"course:ts-foundations/task/unions-join-tags","path":"tasks/join-tags/task.json"},{"id":"course:ts-foundations/task/unions-sizes","path":"tasks/sizes/task.json"},{"id":"course:ts-foundations/task/unions-lights","path":"tasks/lights/task.json"}]
review: {"task":"course:ts-foundations/task/unions-lights","afterModule":"course:ts-foundations/module/tagged","evidence":"Use a fresh answer on a later visit. An unaided pass on the changed case adds independent evidence. Preserve hint use and solution reveals with their attempts."}
drills: ["narrowing/typeof-narrowing"]
drillGap: The linked drill practises typeof. This module adds literal types, widening and Array.isArray.
---

A union type lists the kinds of value something can be. A literal type allows one exact value. Together they let the type checker reject values your code does not handle.

## One of several types

A union is written with `|`.

- `string | string[]` is either one string or an array of strings.
- `"S" | "M" | "L"` is a union of literal types. Only those three strings fit.
- `type Size = "S" | "M" | "L"` gives the union a name.

Before you use a union value, check which kind it is (narrowing). After the check, TypeScript knows the narrower type inside that branch.

- `typeof x === "string"` checks for a string.
- `Array.isArray(x)` checks for an array.
- `x === "S"` checks for one literal.

## When a literal stays a literal {prediction}

Read the example and predict the answer before you run it.

```typescript example widen
const fixed = "M";
let changing = "M";
changing = "XL";
console.log(fixed, changing);

```

```output
M XL
```

:::question widen example=widen
TypeScript infers a type for each variable. What type does `changing` get?
- [ ] "M" :: A `let` can be reassigned, so TypeScript widens it to `string`.
- [x] string :: A `const` can never change, so `fixed` keeps the literal type `"M"`. A `let` might change, so TypeScript widens `changing` to `string`, which is why `changing = "XL"` is allowed. To keep a `let` limited to certain values, write the union yourself: `let size: Size = "M"`. Then `size = "XL"` is a type error.
:::

## Narrow before you use it {prediction}

Read the example and predict what it prints.

```typescript example narrow
function count(items: string | string[]): number {
  if (Array.isArray(items)) return items.length;
  return 1;
}
console.log(count("abc"));
console.log(count(["a", "b"]));

```

```output
1
2
```

:::question narrow example=narrow
What does `count("abc")` print?
- [ ] 3 :: `"abc"` is not an array, so the `length` branch never runs.
- [x] 1 :: A single string counts as one item.
:::

## Why the length read is allowed {prediction}

`count` reads `items.length` only inside the `if`.

@example narrow

:::question narrow-explain example=narrow
Why can `return items.length` call `.length` on an array without an error?
- [x] Inside the `if`, TypeScript knows `items` is `string[]`. :: `Array.isArray` narrows the union for that branch.
- [ ] Every value has a `length`. :: Numbers do not. The check is what makes this safe.
:::

## Accept one tag or many {modification}

Repair `joinTags`. It takes one string or an array of strings. The starter turns the array into text without the space after each comma.

@task unions-join-tags

## Limit sizes to three choices {independent}

Write a literal union so that wrong sizes fail before the code runs.

@task unions-sizes

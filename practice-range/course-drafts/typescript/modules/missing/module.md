---
id: course:ts-foundations/module/missing
title: null, undefined and optional
requires: ["object-shape","branch"]
outcomes: [{"id":"predict","can":"Explain how zero and null behave under ??.","assessment":["predict","explain"]},{"id":"optional","can":"Read an optional nested field with ?. and ??.","assessment":["chain"]},{"id":"owner","can":"Keep an empty nickname","assessment":["course:ts-foundations/task/missing-owner"]},{"id":"ticket-id","can":"Format two kinds of order number","assessment":["course:ts-foundations/task/missing-ticket-id"]},{"id":"status","can":"Describe a missing delivery state","assessment":["course:ts-foundations/task/missing-status"]}]
tasks: [{"id":"course:ts-foundations/task/missing-owner","path":"tasks/owner/task.json"},{"id":"course:ts-foundations/task/missing-ticket-id","path":"tasks/ticket-id/task.json"},{"id":"course:ts-foundations/task/missing-status","path":"tasks/status/task.json"}]
review: {"task":"course:ts-foundations/task/missing-status","afterModule":"course:ts-foundations/module/boundary","evidence":"Use a fresh answer on a later visit. An unaided pass on the changed case adds independent evidence. Preserve hint use and solution reveals with their attempts."}
drills: ["narrowing/typeof-narrowing","objects/optional-property"]
drillGap: The linked drills isolate syntax. This module checks the combined behavior on varied inputs.
---

A value can be missing. TypeScript makes you say where that can happen, then makes you check before you use it.

## Keep missing values distinct

TypeScript has two "missing" values.

- `undefined` means nothing was set. Reading a field that is not there gives `undefined`.
- `null` means "deliberately empty". You write it yourself.
- `nickname?: string` marks a field as optional. Its type becomes `string | undefined`.
- `number | null` (a union) allows either a number or `null`.

Missing is not the same as empty. `0` and `""` are real values, and your code should keep them.

## Predict before running {prediction}

Read the example and predict what it prints before you run it.

```typescript example trace
function due(days: number | null): number {
  return days ?? 7;
}
console.log(due(0));
console.log(due(null));

```

```output
0
7
```

:::question predict example=trace
What prints for the two calls?
- [x] 0 then 7 :: `0` is a real value. Only `null` is missing.
- [ ] 7 then 7 :: `??` only replaces `null` and `undefined`, not `0`.
:::

## Trace the example {walkthrough}

`a ?? b` gives `b` only when `a` is `null` or `undefined` (nullish). Otherwise it gives `a`.

- `due(0)`: `0` is not nullish, so it returns `0`.
- `due(null)`: `null` is nullish, so it returns `7`.
- `a || b` is different. It gives `b` for any falsy `a`, which includes `0` and `""`.

@example trace

## Check your explanation {prediction}

Read the example again and choose the explanation that fits.

@example trace

:::question explain example=trace
What would change if `??` were replaced by `||`?
- [ ] `null` would stay `null`. :: Both operators use the fallback for `null`.
- [x] `0` would also become 7. :: `0` is falsy, so `||` replaces it.
:::

## Reach into optional fields

When a field is optional, reading past it can fail. `user.address.city` throws if `address` is `undefined`, and TypeScript reports it before you run the code.

- `user.address?.city` stops and gives `undefined` when `address` is missing (optional chaining).
- Pair it with `??` to supply a default: `user.address?.city ?? "Unknown"`.
- A check such as `if (user.address)` also works. Inside the `if`, TypeScript knows `address` is set (narrowing).

## Follow an optional chain {prediction}

Read the example and predict what it prints.

```typescript example chain
type User = { name: string; address?: { city: string } };
const ana: User = { name: "Ana", address: { city: "Lima" } };
const ben: User = { name: "Ben" };
console.log(ana.address?.city ?? "Unknown");
console.log(ben.address?.city ?? "Unknown");

```

```output
Lima
Unknown
```

:::question chain example=chain
What does `ben.address?.city` give before `??` runs?
- [x] undefined :: `?.` stops at the missing `address` and gives `undefined`.
- [ ] An error :: Without `?.` it would throw. With `?.` it gives `undefined`.
- [ ] "" :: Nothing produces empty text here. A missing field reads as `undefined`.
:::

## Keep an empty nickname {modification}

Return the nickname, even when it is empty text. The starter uses `||`, which loses `""`.

@task missing-owner

## Format two kinds of order number {independent}

The input is a `string` or a `number`. Use `typeof` to tell them apart.

@task missing-ticket-id

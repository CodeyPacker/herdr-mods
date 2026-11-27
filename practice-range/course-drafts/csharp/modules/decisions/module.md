---
id: course:cs-foundations/module/decisions
title: Control flow
requires: ["variable","number-types","text","interpolation"]
outcomes: [{"id":"branch","can":"Predict which branch of an if, else if, else chain runs.","assessment":["predict-branch","course:cs-foundations/task/decisions-status"]},{"id":"logic","can":"Combine conditions with &&, || and !.","assessment":["predict-logic","course:cs-foundations/task/decisions-can-start"]},{"id":"compare","can":"Tell = from == and read the error when they are mixed up.","assessment":["predict-assign"]},{"id":"transfer","can":"Handle two separate conditions, including empty text and zero.","assessment":["course:cs-foundations/task/decisions-owner-line"]}]
tasks: [{"id":"course:cs-foundations/task/decisions-status","path":"tasks/status/task.json"},{"id":"course:cs-foundations/task/decisions-can-start","path":"tasks/can-start/task.json"},{"id":"course:cs-foundations/task/decisions-owner-line","path":"tasks/owner-line/task.json"}]
review: {"task":"course:cs-foundations/task/decisions-owner-line","afterModule":"course:cs-foundations/module/collections","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["conditionals/if","conditionals/else-if","operators/and","operators/not","operators/equal"]
drillGap: These drills practise one statement or operator each. They do not check an answer against several supplied cases.
---

A program becomes useful when it can choose. This module covers `if` and `else`, the comparison operators, and combining true/false values with **and**, **or** and **not**.

## Compare, then choose

A comparison produces a `bool`. `cars > spaces` is true when `cars` is larger.

| Operator | Means |
| --- | --- |
| `==` | equal |
| `!=` | not equal |
| `<`, `<=` | less than, less than or equal |
| `>`, `>=` | greater than, greater than or equal |

An `if` statement runs its block only when the condition in the brackets is true. `else if` tries another condition when the ones above were false. `else` runs when none matched. Only one block in the chain runs.

Two strings are equal with `==` when they hold the same characters, and `""` is a real string with no characters in it.

```csharp example gate
int cars = 3;
int spaces = 3;
if (cars > spaces)
{
    Console.WriteLine("over");
}
else if (cars == spaces)
{
    Console.WriteLine("full");
}
else
{
    Console.WriteLine("room");
}

bool sunny = true;
bool windy = false;
Console.WriteLine(sunny && !windy);
Console.WriteLine(cars >= 5 || sunny);
```

```output
full
True
True
```

## Which branch runs? {prediction}

Read the `if` chain and predict the first line of output.

@example gate

:::question predict-branch example=gate
What is the first line of output?
- [ ] over :: 3 is not greater than 3, so the first condition is false.
- [x] full :: The first test is false and the second is true, so its block runs.
- [ ] room :: `else` runs only when every condition above it was false.
:::

## Follow the chain {walkthrough}

`cars` is 3 and `spaces` is 3.

1. `cars > spaces` is false, so the first block is skipped.
2. `cars == spaces` is true, so `full` prints.
3. The `else` block is skipped.

The order of the tests matters: the chain stops at the first true condition.

@example gate

## Combine conditions {prediction}

- `&&` means **and**: true only when both sides are true.
- `||` means **or**: true when at least one side is true.
- `!` means **not**: it flips true and false.

Predict the last two lines.

@example gate

:::question predict-logic example=gate
What are the last two lines of output?
- [x] True, True :: `sunny` is true and `windy` is false. In the second line one true side is enough for `||`.
- [ ] True, False :: `cars >= 5` is false, but `||` needs only one true side, and `sunny` is true.
- [ ] False, True :: `!windy` flips false to true, so both sides of the `&&` are true.
:::

## Work out each side {walkthrough}

- `sunny` is true and `windy` is false, so `!windy` is true and `sunny && !windy` is true.
- `cars >= 5` is false, but `sunny` is true, so the `||` is true.

Work out each side first, then combine them.

@example gate

## Predict a comparison error {prediction}

One character is missing from this condition. Read it before checking.

```csharp example bad-assign diagnostics=[{"code":29,"line":2}]
int cars = 3;
if (cars = 3)
{
    Console.WriteLine("three");
}
```

:::question predict-assign example=bad-assign
What happens when you check this example?
- [ ] It prints three. :: `cars = 3` is an assignment, not a comparison, and the compiler rejects it as a condition.
- [ ] It prints nothing, because the condition is false. :: The file never runs. The condition is not a `bool` at all.
- [x] The compiler reports an error on line 2. :: A single `=` assigns and produces an `int`. An `if` needs a `bool`, so this is CS0029.
:::

## Read the compiler error {walkthrough}

Check the example. A single `=` assigns. `cars = 3` stores 3 and produces an `int`, and an `if` needs a `bool`, so the compiler reports **CS0029**. To compare, write `==`.

@example bad-assign

## Report the parking status {modification}

Each case supplies different values for `cars` and `spaces`. The starter handles one rule and has the edge wrong. Change it so every case gets the right status.

@task decisions-status

## Decide whether the ride can start {independent}

Work from the prompt. Every case supplies a different mix of values.

@task decisions-can-start

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


## Which branch runs? {prediction}

Read the `if` chain and predict the first line of output.

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

:::question predict-branch example=gate
What is the first line of output?
- [ ] over :: 3 is not greater than 3, so the first condition is false.
- [x] full :: `cars > spaces` is false, so that block is skipped. `cars == spaces` is true, so `full` prints and the `else` is skipped. The chain stops at the first true condition, so the order of the tests matters.
- [ ] room :: `else` runs only when every condition above it was false.
:::

## Combine conditions {prediction}

- `&&` means **and**: true only when both sides are true.
- `||` means **or**: true when at least one side is true.
- `!` means **not**: it flips true and false.

`&&` skips its right side when the left is false. `||` skips it when the left is true. This is **short-circuit evaluation**. `count != 0 && total / count > 2` avoids dividing by zero. Use parentheses to make mixed conditions clear.

Predict the last two lines.

@example gate

:::question predict-logic example=gate
What are the last two lines of output?
- [x] True, True :: `!windy` flips false to true, so `sunny && !windy` has two true sides. `cars >= 5` is false, but `sunny` is true, and one true side is enough for `||`. Work out each side first, then combine them.
- [ ] True, False :: `cars >= 5` is false, but `||` needs only one true side, and `sunny` is true.
- [ ] False, True :: `!windy` flips false to true, so both sides of the `&&` are true.
:::

## Find the error {prediction}

This example does not compile. Find the line the compiler stops at, and why.

```csharp example bad-assign diagnostics=[{"code":29,"line":2}]
int cars = 3;
if (cars = 3)
{
    Console.WriteLine("three");
}
```

:::question predict-assign example=bad-assign
Which error does the compiler report?
- [ ] Line 1: `cars` was never given a type. :: `int cars = 3;` declares an `int` and gives it 3. Line 1 is fine.
- [x] Line 2, CS0029: the condition is an `int`, and an `if` needs a `bool`. :: A single `=` assigns: `cars = 3` stores 3 and produces that `int`. To compare, write `==`, which produces a `bool`.
- [ ] Line 4: text cannot be printed inside an `if`. :: A block can hold any statements. The compiler stops at the condition on line 2.
:::

## Report the parking status {modification}

Each case supplies different values for `cars` and `spaces`. The starter handles one rule and has the edge wrong. Change it so every case gets the right status.

@task decisions-status

## Decide whether the ride can start {independent}

Work from the prompt. Every case supplies a different mix of values.

@task decisions-can-start

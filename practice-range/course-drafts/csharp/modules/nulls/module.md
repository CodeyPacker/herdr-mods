---
id: course:cs-foundations/module/nulls
title: Nullable types
requires: ["method","parameter-return","branch","comparison","text","interpolation","class","property","constructor"]
outcomes: [{"id":"fallback","can":"Supply a fallback for a missing value with ??.","assessment":["predict-fallback","course:cs-foundations/task/nulls-owner-label"]},{"id":"distinct","can":"Keep empty text and zero separate from a missing value.","assessment":["predict-empty","course:cs-foundations/task/nulls-due-text"]},{"id":"numbers","can":"Say why an int cannot be null and how int? differs.","assessment":["predict-int-null"]},{"id":"transfer","can":"Read through two levels that may each be missing.","assessment":["course:cs-foundations/task/nulls-text-length"]}]
tasks: [{"id":"course:cs-foundations/task/nulls-owner-label","path":"tasks/owner-label/task.json"},{"id":"course:cs-foundations/task/nulls-due-text","path":"tasks/due-text/task.json"},{"id":"course:cs-foundations/task/nulls-text-length","path":"tasks/text-length/task.json"}]
review: {"task":"course:cs-foundations/task/nulls-text-length","afterModule":"course:cs-foundations/module/interfaces","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["operators/coalesce","operators/null-conditional","conditionals/null","conditionals/not-null","variables/nullable"]
drillGap: These drills practise one operator each. They do not separate null from empty text and zero.
---

Sometimes there is no value: a person with no nickname, a library book with no due date. C# calls that `null`. This module covers marking a value that may be missing, checking it before use, and supplying a fallback.

## null means no value

`null` means a variable refers to nothing. `string? nickname = null;` declares a string that may be missing. The `?` after a reference type, as in `string?`, enables compiler analysis about possible missing values. It is the same runtime type as `string` and does not guard a dereference. The postfix `!` suppresses that analysis warning but adds no runtime safety. The checker used here ignores compiler warnings, while editors can show them. Runtime tasks still check what happens when a value is actually null.

- Using a member of `null`, such as `nickname.Length`, stops the program with a `NullReferenceException`. Test first with `nickname == null` or `nickname != null`.
- `??` supplies a fallback: `nickname ?? "Guest"` is `nickname` when it has a value and `"Guest"` when it is `null`.
- `?.` reads a member only when there is a value: `nickname?.Length` is `null` when `nickname` is `null`, and nothing is thrown.


## Predict a fallback {prediction}

`nickname` is `null`. Predict the first two lines of output.

```csharp example nickname
string? nickname = null;
Console.WriteLine(nickname ?? "Guest");
Console.WriteLine(nickname?.Length ?? 0);

string? blank = "";
Console.WriteLine((blank ?? "Guest") == "");

int? due = null;
Console.WriteLine(due.HasValue);
due = 0;
Console.WriteLine(due ?? -1);

```

```output
Guest
0
True
False
0
```

:::question predict-fallback example=nickname
What are the first two lines of output?
- [x] Guest, 0 :: `nickname ?? "Guest"` gives the fallback. On the next line `nickname?.Length` is `null`, because there is no string to measure, and `?? 0` turns that into 0. No member of `null` was used, so nothing was thrown.
- [ ] Guest, then the program stops with an error :: `?.` reads `Length` only when there is a value, so nothing is thrown.
- [ ] An empty line, 0 :: `null` is not empty text. `??` replaces it with the fallback.
:::

## Empty is not missing {prediction}

`blank` holds a string with no characters. Predict the third line of output.

@example nickname

:::question predict-empty example=nickname
What is the third line of output?
- [ ] False :: `""` is a real value, so `??` keeps it and the result equals `""`.
- [x] True :: `??` replaces only `null`. `""` is a real string with no characters, so it is kept and the comparison is True. Empty text is a value. Only `null` means missing.
- [ ] Guest :: The line prints the result of a comparison, which is True or False.
:::

## Numbers that can be missing

An `int` always holds a number and can never be `null`. When a number may be missing, use `int?`, which is `Nullable<int>`, a distinct value type that holds either an `int` or `null`.

```csharp
int? due = null;
Console.WriteLine(due.HasValue);   // False
due = 0;
Console.WriteLine(due ?? -1);      // 0
```

- `HasValue` is false while the value is `null`.
- After `due = 0;` it holds a real 0, so `??` keeps it. Like empty text, zero is a value.

## Find the error {prediction}

This example does not compile. Find the line the compiler stops at, and why.

```csharp example bad-null diagnostics=[{"code":37,"line":1}]
int count = null;
Console.WriteLine(count);

```

:::question predict-int-null example=bad-null
Which error does the compiler report?
- [ ] Line 1: `null` must be written in quotes. :: `"null"` in quotes would be text, which an `int` cannot hold either. `null` is a keyword.
- [x] Line 1, CS0037: `null` cannot be stored in a plain `int`. :: An `int` always holds a number. If the number can be missing, declare `int? count = null;`
- [ ] Line 2: a variable that holds `null` cannot be printed. :: Printing `null` is allowed and prints an empty line. The compiler stops at line 1.
:::

## Show a display name {modification}

The starter stops with an exception for a missing nickname and gives the wrong label for an empty one. Repair it.

@task nulls-owner-label

## Describe a due date {independent}

Work from the prompt. A missing number and the number 0 mean different things here.

@task nulls-due-text

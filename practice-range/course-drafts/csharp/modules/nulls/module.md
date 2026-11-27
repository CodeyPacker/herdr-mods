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

Sometimes there is no value: a person with no nickname, a library book with no due date. C# calls that null. This module covers marking a value that may be missing, checking it before use, and supplying a fallback.

## null means no value

null means a variable refers to nothing. string? nickname = null; declares a string that may be missing. The ? after the type is a promise to readers and tools that null is allowed here, and editors use it to warn you when you use such a value without a check. Using a member of null, such as nickname.Length, stops the program with a NullReferenceException. Test first with nickname == null or nickname != null. The ?? operator supplies a fallback: nickname ?? "Guest" is nickname when it has a value and "Guest" when it is null. The ?. operator reads a member only when there is a value. nickname?.Length is null when nickname is null, and no exception is thrown.

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

## Predict a fallback {prediction}

nickname is null. Predict the first two lines of output.

@example nickname

:::question predict-fallback example=nickname
What are the first two lines of output?
- [x] Guest, 0 :: nickname is null, so both fallbacks are used.
- [ ] Guest, then the program stops with an error :: ?. reads Length only when there is a value, so nothing is thrown.
- [ ] An empty line, 0 :: null is not empty text. ?? replaces it with the fallback.
:::

## Follow the operators {walkthrough}

nickname is null, so nickname ?? "Guest" gives the fallback. On the next line nickname?.Length is null because there is no string to measure, and ?? 0 turns that into 0. No member of null was ever used, so nothing was thrown.

@example nickname

## Empty is not missing {prediction}

blank holds a string with no characters. Predict the third line of output.

@example nickname

:::question predict-empty example=nickname
What is the third line of output?
- [ ] False :: "" is a real value, so ?? keeps it and the result equals "".
- [x] True :: ?? replaces only null. An empty string is kept.
- [ ] Guest :: The line prints the result of a comparison, which is True or False.
:::

## Keep real values {walkthrough}

"" is a real string, so ?? leaves it alone and the comparison prints True. The same holds for numbers. An int always has a value and can never be null. int? is a different type that holds either an int or null. due.HasValue is False while due is null. After due = 0; it holds a real 0, and due ?? -1 gives 0, not the fallback. Zero and empty text are values. Only null means missing.

@example nickname

## Give an int no value {prediction}

Line 1 assigns null to a plain int. Read the example before checking.

```csharp example bad-null diagnostics=[{"code":37,"line":1}]
int count = null;
Console.WriteLine(count);

```

:::question predict-int-null example=bad-null
What happens when you check this example?
- [ ] It prints 0. :: null is not turned into 0. An int cannot be given null at all.
- [ ] It prints an empty line. :: The file does not compile, so nothing prints.
- [x] The compiler reports an error on line 1. :: int always holds a number. Assigning null to it is CS0037.
:::

## Read the compiler error {walkthrough}

Check the example. CS0037 says null cannot be converted to int because int is a non-nullable value type. If a number can be missing, declare it as int?.

@example bad-null

## Show a display name {modification}

The starter stops with an exception for a missing nickname and gives the wrong label for an empty one. Repair it.

@task nulls-owner-label

## Describe a due date {independent}

Work from the prompt. A missing number and the number 0 mean different things here.

@task nulls-due-text

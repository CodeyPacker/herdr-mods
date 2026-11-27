---
id: course:cs-foundations/module/checks
title: Writing unit tests
requires: ["method","parameter-return","lambda","comparison","list","linq-query","boolean-logic"]
outcomes: [{"id":"read","can":"Use expected and actual values to find the input that exposes a bug.","assessment":["predict-boundary","course:cs-foundations/task/checks-at-limit"]},{"id":"write","can":"Write a check that passes correct code and fails faulty code.","assessment":["predict-check","course:cs-foundations/task/checks-count-check"]},{"id":"transfer","can":"Choose inputs that tell two orders apart.","assessment":["course:cs-foundations/task/checks-order-check"]}]
tasks: [{"id":"course:cs-foundations/task/checks-at-limit","path":"tasks/at-limit/task.json"},{"id":"course:cs-foundations/task/checks-count-check","path":"tasks/count-check/task.json"},{"id":"course:cs-foundations/task/checks-order-check","path":"tasks/order-check/task.json"}]
review: {"task":"course:cs-foundations/task/checks-order-check","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted.","afterCompletion":true}
drills: ["delegates/func","delegates/two-inputs","delegates/predicate"]
drillGap: These drills practise declaring a Func. They do not ask for inputs that tell correct code from faulty code.
---

A check calls code with a known input and compares what comes back with what should come back. This module covers reading a failed check, choosing the input that exposes a bug, and writing a check of your own.

## Expected and actual

Every check has an input, an expected result and an actual result. The expected result comes from the rule the code is meant to follow. The actual result is what the code returned. When they differ, the check has failed, and the input tells you which call to trace. The most useful inputs sit at an edge, where the rule changes its answer. For `"three or more"`, the edge is exactly 3. A bug at an edge is easy to miss with inputs far away from it.

```csharp example trace
bool AtLimit(int count, int limit)
{
    return count > limit;
}

Console.WriteLine(AtLimit(4, 3));
Console.WriteLine(AtLimit(3, 3));
Console.WriteLine(AtLimit(2, 3));

```

```output
True
False
False
```

## Find the failing input {prediction}

AtLimit should return true when count has reached the limit or passed it. Predict the three lines, then decide which call shows the bug.

@example trace

:::question predict-boundary example=trace
Which call shows the bug?
- [ ] `AtLimit(4, 3)` :: It prints True, and the rule also expects true for 4.
- [x] `AtLimit(3, 3)` :: The rule expects true once the limit is reached, and the code prints False.
- [ ] `AtLimit(2, 3)` :: It prints False, and the rule also expects false below the limit.
:::

## Compare with the rule {walkthrough}

The rule expects True, True, False. The code prints True, False, False. Only the second call disagrees, and it is the one at the edge: 3 has reached a limit of 3, but the code uses >, which is false for equal values. The calls with 4 and 2 give the right answer with either operator, so they cannot tell the faulty code from the fixed code.

@example trace

## A check is code too

A method can receive another method as a parameter. `Func<int, int, bool>` is the type of a method that takes two ints and returns a `bool`. The last type in the list is the return type. A lambda such as (count, limit) => count >= limit fits it. A check written this way takes a candidate, calls it with chosen inputs, and returns true only when every result matches what is expected. A good check returns true for correct code and false for the faulty versions you know about. A check kept to make sure a fixed bug stays fixed is called a regression check.

```csharp example check
bool Check(Func<int, int, bool> candidate)
{
    return candidate(3, 3) == true && candidate(2, 3) == false;
}

Console.WriteLine(Check((count, limit) => count >= limit));
Console.WriteLine(Check((count, limit) => count > limit));

```

```output
True
False
```

## Run the check on two candidates {prediction}

Check is given a correct candidate, then a faulty one. Predict the two lines of output.

@example check

:::question predict-check example=check
What are the two lines of output?
- [x] True, then False :: The first candidate matches both expected results. The second fails at (3, 3).
- [ ] True, then True :: The second candidate returns false for (3, 3), where true is expected.
- [ ] False, then False :: The first candidate returns true for (3, 3) and false for (2, 3), which is what is expected.
:::

## Why the check catches the bug {walkthrough}

The check includes the edge input (3, 3) with the expected result true. The first candidate returns true there, and false for (2, 3), so the check returns True. The second candidate returns false at the edge, so the check returns False. Without the (3, 3) case both candidates would pass, and the check would be worthless for this bug.

@example check

## Repair a threshold {modification}

Save the starter and read which check fails. Use its input to find the bug.

@task checks-at-limit

## Write a check that finds a faulty count {independent}

This time you write the check. It is run against a correct candidate and against faulty ones.

@task checks-count-check

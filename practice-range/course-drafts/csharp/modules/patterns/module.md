---
id: course:cs-foundations/module/patterns
title: Pattern matching
requires: ["method","parameter-return","branch","comparison","interpolation","record","property","inheritance"]
outcomes: [{"id":"trace","can":"Trace which arm of a switch expression matches a value.","assessment":["predict-output","predict-arm","course:cs-foundations/task/patterns-describe-update"]},{"id":"order","can":"Order property and relational patterns so the specific case wins.","assessment":["course:cs-foundations/task/patterns-lane"]},{"id":"compute","can":"Compute a result for each record type, including zero and negative values.","assessment":["course:cs-foundations/task/patterns-apply-edit"]},{"id":"debug","can":"Repair an arm that can never run and add a missing case.","assessment":["predict-unreachable","course:cs-foundations/task/patterns-repair-caption"]},{"id":"transfer","can":"Apply property patterns to fresh data and keep zero as a real value.","assessment":["course:cs-foundations/task/patterns-sensor-display"]}]
tasks: [{"id":"course:cs-foundations/task/patterns-describe-update","path":"tasks/describe-update/task.json"},{"id":"course:cs-foundations/task/patterns-lane","path":"tasks/lane/task.json"},{"id":"course:cs-foundations/task/patterns-apply-edit","path":"tasks/apply-edit/task.json"},{"id":"course:cs-foundations/task/patterns-repair-caption","path":"tasks/repair-caption/task.json"},{"id":"course:cs-foundations/task/patterns-sensor-display","path":"tasks/sensor-display/task.json"}]
review: {"task":"course:cs-foundations/task/patterns-sensor-display","afterModule":"course:cs-foundations/module/exceptions","evidence":"Open a fresh starter after Exceptions, with the earlier answer closed. A first unaided pass on every reading is later evidence of ordering patterns. A hinted pass stays recorded as assisted."}
drills: ["conditionals/switch-expression","conditionals/type-binding","conditionals/property-pattern","conditionals/relational","patterns/property-relational"]
drillGap: These drills practise one pattern form each. They do not check arm order across several record types.
---

Code often has to ask two questions at once: what kind of value is this, and what is inside it? Pattern matching answers both in one step. This module covers the is test, switch expressions, type patterns and property patterns, using kitchen orders as data.

## Test a type and name the result

A **pattern** is a test that a value either matches or does not. The simplest is a type pattern: `update is Finished f` asks whether `update` is a `Finished` record. When it is, `f` is that same object seen as a `Finished`, so `f.Title` is available.

A **switch expression** tries several patterns in order and produces a value:

```csharp
string text = update switch
{
    Waiting w => $"Place {w.Place}",
    Finished f => f.Title,
    _ => "Unknown"
};
```

- Each arm is `pattern => result`, with a comma between arms. The first arm that matches wins.
- The discard `_` matches anything, so it goes last.
- Without a last arm that catches the rest, the compiler warns that the switch does not handle every input (CS8509). A value that then matches no arm throws `SwitchExpressionException` when the program runs.


## Follow two notices {prediction}

Read the method and both calls before running. Choose the two output lines in order.

```csharp example board
string Describe(Notice notice) => notice switch
{
    Waiting w => $"Place {w.Place}",
    Finished f => f.Title,
    _ => "Unknown"
};

Console.WriteLine(Describe(new Waiting(0)));
Console.WriteLine(Describe(new Finished("Soup")));

abstract record Notice;
record Waiting(int Place) : Notice;
record Finished(string Title) : Notice;

```

```output
Place 0
Soup
```

:::question predict-output example=board
What does the kitchen screen example print?
- [ ] Waiting then Finished :: Each arm returns a value built from the record's data, not the name of its type.
- [x] Place 0 then Soup :: `new Waiting(0)` matches the first arm. The arm tests the type, so a `Place` of 0 is handled like any other number. `new Finished("Soup")` fails the first arm, matches the second and returns its `Title`.
- [ ] Unknown then Soup :: A place of 0 is still a Waiting record. The type pattern does not look at the number.
:::

## Test what is inside

A **property pattern** tests values inside an object.

- `{ Minutes: 0 }` matches when the `Minutes` property equals 0.
- A **relational pattern** compares: `{ Minutes: < 30 }` matches any value below 30.
- One pattern can test several properties: `{ Urgent: true, Minutes: > 60 }`.
- A property pattern can follow a type: `Finished { Minutes: 0 } f`.

Order matters, because the first match wins. Put the most specific arm first.


## Which arm wins? {prediction}

More than one arm can match the same order. Read the arms from the top for each call, and predict all four lines.

```csharp example sizes
string Size(Order order) => order switch
{
    { Minutes: 0 } => "empty",
    { Minutes: < 30 } => "short",
    { Urgent: true } => "long and urgent",
    _ => "long"
};

Console.WriteLine(Size(new Order(0, true)));
Console.WriteLine(Size(new Order(10, true)));
Console.WriteLine(Size(new Order(45, true)));
Console.WriteLine(Size(new Order(45, false)));

record Order(int Minutes, bool Urgent);

```

```output
empty
short
long and urgent
long
```

:::question predict-arm example=sizes
What are the four lines of output?
- [x] empty, short, long and urgent, long :: `Order(0, true)` matches the first arm, so it is empty even though it is urgent. 10 is not 0 but is below 30. `Order(45, true)` fails both `Minutes` tests and reaches the `Urgent` arm, and `Order(45, false)` falls through to the discard.
- [ ] long and urgent, short, long and urgent, long :: The `Urgent` arm is third. For `Order(0, true)` the first arm already matched `Minutes: 0`, and no later arm is tried.
- [ ] empty, short, long, long :: `Order(45, true)` fails both `Minutes` tests, and the next arm is `{ Urgent: true }`, which it matches.
:::

## Find the error {prediction}

This example does not compile. Find the line the compiler stops at, and why.

```csharp example bad-arm diagnostics=[{"code":8510,"line":4}]
string Size(int minutes) => minutes switch
{
    _ => "long",
    < 30 => "short"
};

Console.WriteLine(Size(10));

```

:::question predict-unreachable example=bad-arm
Which error does the compiler report?
- [ ] Line 1: a switch expression cannot test an `int`. :: A switch expression can test a value of any type, and `< 30` is a relational pattern on that number.
- [ ] Line 3: `_` is not a valid pattern. :: `_` is the discard, and it matches anything. That is the problem with where it is.
- [x] Line 4, CS8510: the `< 30` arm can never run, because `_` above it matches every number. :: C# treats an arm that can never run as an error, not a warning. Move the general arm below the specific one.
:::

## Finish two arms {modification}

The case box above the editor supplies the record types. Change the starter so each update shows its own details.

@task patterns-describe-update

## Sort orders and apply edits {independent}

Work from each prompt. The first order depends on the order of property patterns. The second computes a number for each record type. Both run against several inputs.

@tasks patterns-lane patterns-apply-edit

## Repair the caption {debugging}

Read the compiler error first, then compare the arms with the promised behavior.

@task patterns-repair-caption

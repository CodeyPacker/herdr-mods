---
id: course:cs-foundations/module/values
title: Types and values
requires: ["save-run","read-output","compiler-error"]
outcomes: [{"id":"trace","can":"Predict the order and values printed after an update.","assessment":["predict-count","course:cs-foundations/task/values-arrival-log"]},{"id":"divide","can":"Choose between whole-number and fractional division.","assessment":["predict-divide","predict-numeric-choice","course:cs-foundations/task/values-share-hours"]},{"id":"label","can":"Build text from supplied values.","assessment":["course:cs-foundations/task/values-shelf-label"]},{"id":"repair","can":"Read a type mismatch error and repair the variable's type.","assessment":["predict-error","course:cs-foundations/task/values-repair-count"]},{"id":"transfer","can":"Use an inferred variable and keep a count correct across an update in a new setting.","assessment":["course:cs-foundations/task/values-seat-snapshot"]}]
tasks: [{"id":"course:cs-foundations/task/values-arrival-log","path":"tasks/arrival-log/task.json"},{"id":"course:cs-foundations/task/values-share-hours","path":"tasks/share-hours/task.json"},{"id":"course:cs-foundations/task/values-shelf-label","path":"tasks/shelf-label/task.json"},{"id":"course:cs-foundations/task/values-repair-count","path":"tasks/repair-count/task.json"},{"id":"course:cs-foundations/task/values-seat-snapshot","path":"tasks/seat-snapshot/task.json"}]
review: {"task":"course:cs-foundations/task/values-seat-snapshot","afterModule":"course:cs-foundations/module/methods","evidence":"Open a fresh starter after Methods, with the earlier answer closed. A first unaided pass on both printed lines is later evidence of tracing and arithmetic. A hinted pass stays recorded as assisted."}
drills: ["variables/integer","variables/inferred-int","variables/reassign","operators/divide","strings/interpolate"]
drillGap: These drills practise one declaration or operator each. They do not check an answer against several supplied inputs.
---

A program keeps its data in named **variables**. In C# every variable has a **type** that says what kind of value it can hold. This module covers whole numbers, numbers with a fraction, text and true/false values, and the arithmetic and text building every later module uses.

## Give a value a name and a type

A variable is a name for a value. In C# the type comes first:

```csharp
int temp = 4;          // a whole number
double price = 2.5;    // a number with a fraction
string city = "Oslo";  // text, in double quotes
bool raining = true;   // true or false
```

- Read `=` as "gets". `int temp = 4;` makes a variable named `temp` that holds whole numbers and gives it 4.
- A semicolon ends each statement, and statements run from top to bottom.
- A variable can get a new value later. `temp = temp + 1;` works out the right side first, then stores the result in `temp`.

## Choose a numeric type

Use `int` for whole-number counts, `double` for approximate fractional measurements, and `decimal` for decimal arithmetic such as money: `decimal price = 4.50m;`. The `m` suffix makes a decimal literal. Decimal cannot represent every fraction exactly, but values such as 0.1 have an exact decimal representation. Avoid mixing decimal and double without an explicit conversion. The `L` suffix marks a `long` literal. Underscores in numbers, as in `2_147_483_648`, separate digits for readability.

An int has a finite range, from -2,147,483,648 to 2,147,483,647. Use `long` for larger whole numbers. The `checked` keyword can detect integer overflow. Throwing and catching the resulting exception is covered in Exceptions.

## Choose between numeric types {prediction}

Predict the two lines. The `m` suffix marks decimal literals, and `L` marks a long literal.

```csharp example numeric-choice
decimal total = 3 * 0.10m;
Console.WriteLine(total == 0.30m);
long population = 2_147_483_648L;
Console.WriteLine(population > 2_147_483_647);
```

```output
True
True
```

:::question predict-numeric-choice example=numeric-choice
What does the example print?
- [x] `True`, then `True` :: The `m` suffix makes the decimal calculations use `decimal`, so three tenths equals `0.30m`. The `L` suffix makes `population` a `long`, which can hold a value above the largest `int`. In the comparison, the `int` value is converted to `long`.
- [ ] `False`, then `False` :: `m` marks decimal and `L` marks long. These values fit those types and the comparisons are true.
- [ ] The program does not compile :: Both comparisons have matching numeric types: decimal with decimal, and long with long.
:::

## Trace the temperature {prediction}

Read the example before running it. `Console.WriteLine(value)` prints the value on its own line. Predict all three lines.

```csharp example board
int morning = 4;
int now = morning;
Console.WriteLine(now);
now = now + 1;
Console.WriteLine(now);
Console.WriteLine(morning);
```

```output
4
5
4
```

:::question predict-count example=board
What are the three output lines, in order?
- [x] 4, 5, 4 :: The first print runs before the assignment, so it sees 4. Then `now` becomes 5. `int now = morning;` copied the number, so `morning` still holds 4: the two names share nothing afterwards.
- [ ] 4, 5, 5 :: `morning` and `now` are separate variables. Changing `now` leaves `morning` at 4.
- [ ] 5, 5, 4 :: A line that already printed cannot change. The first print ran before the assignment.
:::

## Divide two whole numbers {prediction}

`+`, `-` and `*` work as in arithmetic. Division depends on the types. When both sides are `int`, `/` gives a whole number and drops the fraction, and `%` gives the remainder. Predict the three lines before running.

```csharp example divide
int slices = 7;
int people = 2;
Console.WriteLine(slices / people);
Console.WriteLine(slices % people);
double exact = slices;
Console.WriteLine(exact / people > 3);
```

```output
3
1
True
```

:::question predict-divide example=divide
What are the three output lines, in order?
- [ ] 3.5, 1, True :: `slices` and `people` are both `int`, so `/` drops the fraction and gives 3.
- [x] 3, 1, True :: `7 / 2` drops the fraction and gives 3, and `7 % 2` is the 1 left over. Storing `slices` in a `double` keeps the fraction, so `exact / people` is 3.5, which is greater than 3. A `bool` prints as `True` or `False`.
- [ ] 3, 1, False :: `exact` is a `double`, so `exact / people` is 3.5, which is greater than 3.
:::

## Convert before you divide

An `int` fits in a `double` with no extra code, as `double exact = slices;` showed. You can also convert in place with a **cast**: put the type in brackets before the value.

```csharp
double share = (double)slices / people;    // 3.5
double late = (double)(slices / people);   // 3
```

The order matters. The first line converts `slices`, then divides, so the fraction is kept. The second divides two ints first, which drops the fraction, and only then converts 3 to a `double`.

## Let the compiler pick the type, and build text

`var` asks the compiler to work out the type from the first value (**inference**). `var city = "Oslo";` means exactly the same as `string city = "Oslo";`. The type is still fixed.

A `$` before the opening quote makes an **interpolated string**: each `{name}` inside it is replaced by that value. Without the `$`, the braces are ordinary text. You can also join text with `+`.

```csharp example label
string city = "Oslo";
int temp = 3;
var label = $"{city}: {temp} degrees";
Console.WriteLine(label);
```

```output
Oslo: 3 degrees
```

## Find the error {prediction}

This example does not compile. Read it and find the line the compiler stops at, and why.

```csharp example bad-count diagnostics=[{"code":29,"line":2}]
int count = 4;
count = "5";
Console.WriteLine(count);
```

:::question predict-error example=bad-count
Which error does the compiler report?
- [ ] Line 1: `count` cannot start at 4. :: 4 is a whole number, which is exactly what an `int` holds. Line 1 is fine.
- [x] Line 2, CS0029: `"5"` is a `string`, and `count` holds an `int`. :: Quoted digits are text, and C# never turns text into a number when you assign it. To store the number, write `count = 5;`. When the compiler stops, nothing runs, not even line 1.
- [ ] Line 3: `Console.WriteLine` cannot print an `int`. :: `WriteLine` has an overload for `int`. Line 2 has the type mismatch, so this program cannot run.
:::

## Add a walk to your steps {modification}

Each exercise is checked against several **cases**. A case supplies different starting values, and your answer must work for all of them. You can see them under "Show test inputs". Read only the lines that set a value. The `using static` line and the class around them are wrapping that the Classes module explains.

Edit the starter, save, and compare both printed lines.

@task values-arrival-log

## Write two small answers {independent}

Work from each prompt, then save. One answer needs a division that keeps its fraction. The other builds a line of text.

@tasks values-share-hours values-shelf-label

## Repair the money left {debugging}

Read the compiler message before editing. Trace the variable back to the line that gave it its type.

@task values-repair-count

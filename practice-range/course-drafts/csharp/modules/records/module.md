---
id: course:cs-foundations/module/records
title: Structs, records, copies
requires: ["class","property","constructor","method","list","loop","comparison"]
outcomes: [{"id":"copy","can":"Make a changed copy of a record and predict what the original holds.","assessment":["predict-with","course:cs-foundations/task/records-rename"]},{"id":"equality","can":"Predict == for records, structs and classes.","assessment":["predict-equal","course:cs-foundations/task/records-slot"]},{"id":"immutable","can":"Read the error from assigning to a record's property.","assessment":["predict-init"]},{"id":"transfer","can":"Return a new list of changed records and leave the input list unchanged.","assessment":["course:cs-foundations/task/records-complete-all"]}]
tasks: [{"id":"course:cs-foundations/task/records-rename","path":"tasks/rename/task.json"},{"id":"course:cs-foundations/task/records-slot","path":"tasks/slot/task.json"},{"id":"course:cs-foundations/task/records-complete-all","path":"tasks/complete-all/task.json"}]
review: {"task":"course:cs-foundations/task/records-complete-all","afterModule":"course:cs-foundations/module/linq","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["classes/record","classes/struct","constructors/with","operators/equal"]
drillGap: These drills practise one declaration each. They do not compare the behavior of records, structs and classes.
---

Some types exist to carry data. This module covers records, which compare by value and are copied with with, and structs, which are copied on every assignment. It also shows how both differ from a class.

## A record carries data

record Movie(string Title, int Minutes); declares a record in one line. It has a constructor with those two parameters and a property for each. The properties can be set only when the record is created. To change something you make a copy: first with { Minutes = 45 } is a new Movie with the same Title and a different Minutes. Two records are equal with == when all their values are equal. Printing a record shows its type name and values.

```csharp example copies
Movie first = new Movie("Dune", 30);
Movie second = first with { Minutes = 45 };
Console.WriteLine(first.Minutes);
Console.WriteLine(second);
Console.WriteLine(first == new Movie("Dune", 30));

Size a = new Size();
a.Width = 2;
Size b = a;
b.Width = 9;
Console.WriteLine(a.Width);

Box boxA = new Box();
Box boxB = new Box();
Console.WriteLine(boxA == boxB);

record Movie(string Title, int Minutes);

struct Size
{
    public int Width { get; set; }
}

class Box
{
    public int Width { get; set; }
}

```

```output
30
Movie { Title = Dune, Minutes = 45 }
True
2
False
```

## Copy with a change {prediction}

second is made from first with one value changed. Predict the first line of output.

@example copies

:::question predict-with example=copies
What is the first line of output?
- [x] 30 :: with makes a new record. first keeps its own Minutes.
- [ ] 45 :: The change went into the copy, second. first was not touched.
- [ ] The program stops with an error :: with is allowed on records. It never changes the original.
:::

## Follow the copy {walkthrough}

with created a second Movie and left first alone, so first.Minutes is still 30. The second line shows the copy: the same Title and the new Minutes. Nothing can change a Movie after it is created, so code that holds one can rely on it.

@example copies

## Value or reference

A struct is a value type, like int. Assigning it copies the whole value, so Size b = a; gives b its own Width. A class is a reference type: assignment copies the reference and both names refer to one object. For == the rule also depends on the type. Records compare their values. Classes compare references, so two separate objects are not equal even when they hold the same data.

@example copies

## Predict three comparisons {prediction}

Predict the last three lines of output.

@example copies

:::question predict-equal example=copies
What are the last three lines of output?
- [ ] True, 9, False :: Size is a struct, so b is a separate copy. Changing b leaves a.Width at 2.
- [ ] False, 2, False :: Records compare by value, and both have Dune and 30.
- [x] True, 2, False :: Records compare values, the struct was copied, and the two Box objects are different objects.
:::

## Check each type {walkthrough}

first == new Movie("Dune", 30) is True because records compare values. a.Width is 2 because b is a separate copy, so setting b.Width to 9 changed only b. boxA == boxB is False because they are two different objects, and a class compares references.

@example copies

## Assign to a record's property {prediction}

Line 2 tries to change a record after it was created. Read the example before checking.

```csharp example bad-init diagnostics=[{"code":8852,"line":2}]
Movie first = new Movie("Dune", 30);
first.Minutes = 45;
Console.WriteLine(first.Minutes);

record Movie(string Title, int Minutes);

```

:::question predict-init example=bad-init
What happens when you check this example?
- [ ] It prints 45. :: A record's properties cannot be assigned after it is created.
- [x] The compiler reports an error on line 2. :: Minutes is init-only, so it can be set only during creation (CS8852).
- [ ] It prints 30, because the assignment is ignored. :: The assignment is a compile error, so nothing runs.
:::

## Read the compiler error {walkthrough}

Check the example. CS8852 says an init-only property can be assigned only while the object is being created. Write first with { Minutes = 45 } and use the copy it produces.

@example bad-init

## Rename a song {modification}

The case box supplies the record type. The starter returns the song unchanged.

@task records-rename

## Model a time slot {independent}

Work from the prompt. Whether two slots count as equal depends on what kind of type Slot is.

@task records-slot

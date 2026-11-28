---
id: course:cs-foundations/module/records
title: Structs, records, copies
requires: ["class","property","constructor","method","list","loop","comparison"]
outcomes: [{"id":"copy","can":"Make a changed copy of a record and predict what the original holds.","assessment":["predict-with","course:cs-foundations/task/records-rename"]},{"id":"equality","can":"Predict == for records, structs and classes.","assessment":["predict-equal","course:cs-foundations/task/records-slot"]},{"id":"immutable","can":"Read the error from assigning to a record's property.","assessment":["predict-init"]},{"id":"transfer","can":"Return a new list of changed records and leave the input list unchanged.","assessment":["course:cs-foundations/task/records-complete-all"]},{"id":"shallow","can":"Predict shared nested data and member equality after a record copy.","assessment":["predict-shallow"]}]
tasks: [{"id":"course:cs-foundations/task/records-rename","path":"tasks/rename/task.json"},{"id":"course:cs-foundations/task/records-slot","path":"tasks/slot/task.json"},{"id":"course:cs-foundations/task/records-complete-all","path":"tasks/complete-all/task.json"}]
review: {"task":"course:cs-foundations/task/records-complete-all","afterModule":"course:cs-foundations/module/linq","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["classes/record","classes/struct","constructors/with","operators/equal"]
drillGap: These drills practise one declaration each. They do not compare the behavior of records, structs and classes.
---

Some types exist to carry data. This module compares ordinary classes, structs and record classes, including what assignment and `with` copy, and how equality works.

## A record carries data

`record Movie(string Title, int Minutes);` declares a record in one line. It gets a constructor with those two parameters and a property for each.

- This positional record class gets **init-only** properties: their values can be assigned during initialization, but not afterwards. A record can also declare properties with `set`, so records are not always immutable.
- To change something, make a copy with `with`: `first with { Minutes = 45 }` is a new `Movie` with the same `Title` and a different `Minutes`.
- Two records compare equal with `==` when their runtime types and stored members compare equal. A list member compares by reference, not by its contents.
- Printing a record shows its type name and its values.


## Copy with a change {prediction}

`second` is made from `first` with one value changed. Predict the first line of output.

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

:::question predict-with example=copies
What is the first line of output?
- [x] 30 :: This `with` expression changes only the new `Movie`; members holding mutable objects can still be shared, covered below.
- [ ] 45 :: This `with` expression changes only the new `Movie`; members holding mutable objects can still be shared, covered below.
- [ ] The program stops with an error :: `with` is allowed on records. It never changes the original.
:::

## Value or reference

C# has value types and reference types. The table shows their default behavior. Classes can overload `==`, as `string` does, so the declared type matters.

| Kind | Assignment copies | `==` compares |
| --- | --- | --- |
| user-defined `struct` (a **value type**) | the whole value | usually has no built-in `==`; built-in numeric value types such as `int` supply equality |
| `class` (a **reference type**) | the reference: both names refer to one object | the references: two separate objects are not equal, even with the same data |
| `record` (a record class) | the reference | the stored members |

So `Size b = a;` gives `b` its own copy when `Size` is a `struct`, and two `new Box()` objects are not equal when `Box` is a class.

## Predict three comparisons {prediction}

Predict the last three lines of output.

@example copies

:::question predict-equal example=copies
What are the last three lines of output?
- [ ] True, 9, False :: `Size` is a `struct`, so `b` is a separate copy. Changing `b` leaves `a.Width` at 2.
- [ ] False, 2, False :: Records compare by value, and both hold Dune and 30.
- [x] True, 2, False :: The two `Movie` records hold the same values, so `==` is True. `b` was a copy of the `struct`, so setting `b.Width` left `a.Width` at 2. `boxA` and `boxB` are two different objects, and a class compares references, so False.
:::

## A copy can still share data {prediction}

`with` makes a **shallow copy**: it copies each member. A member holding a reference still points at the same object. A struct with a list member has this same issue on assignment. `record struct` is a value type with generated record equality, unlike the record classes above.

```csharp example shallow
var first = new Playlist("Morning", new List<string> { "Intro" });
var second = first with { Name = "Evening" };
second.Songs.Add("Finale");
Console.WriteLine(first.Name);
Console.WriteLine(first.Songs.Count);
Console.WriteLine(first == new Playlist("Morning", new List<string> { "Intro", "Finale" }));

record Playlist(string Name, List<string> Songs);
```

```output
Morning
2
False
```

:::question predict-shallow example=shallow
Why does first have two songs, but compare unequal to the last playlist?
- [x] The copy shares first's list, while the last playlist has a different list. :: with copies the list reference. Changing the shared list is visible through either record. Record equality compares the list members by reference, not by their elements.
- [ ] with changes the original name and copies every song. :: first keeps its own Name, but both records refer to one Songs list.
- [ ] Records compare lists by their contents. :: List does not define equality by its contents. These two separate lists compare unequal.
:::

## Find the error {prediction}

This example does not compile. Find the line the compiler stops at, and why.

```csharp example bad-init diagnostics=[{"code":8852,"line":2}]
Movie first = new Movie("Dune", 30);
first.Minutes = 45;
Console.WriteLine(first.Minutes);

record Movie(string Title, int Minutes);

```

:::question predict-init example=bad-init
Which error does the compiler report?
- [ ] Line 1: a record must be created with `with`. :: `with` copies an existing record. A new one is created with `new`, so line 1 is fine.
- [x] Line 2, CS8852: `Minutes` can be set only while the record is being created. :: This positional record class's generated properties are init-only. To change one, make a copy: `Movie longer = first with { Minutes = 45 };`
- [ ] Line 5: a record needs a body in braces. :: The one-line form with a semicolon declares a full record. The compiler stops at line 2.
:::

## Rename a song {modification}

The case box supplies the record type. The starter returns the song unchanged.

@task records-rename

## Model a time slot {independent}

Declare the types and methods from the prompt. Whether two slots count as equal depends on what kind of type Slot is.

@task records-slot

---
id: course:cs-foundations/module/collections
title: Arrays and lists
requires: ["method","parameter-return","variable","number-types","branch","comparison"]
outcomes: [{"id":"trace","can":"Trace a loop that builds a running total.","assessment":["predict-total","course:cs-foundations/task/collections-total-minutes"]},{"id":"build","can":"Build a new list from the items that pass a test, keeping their order.","assessment":["predict-loop","course:cs-foundations/task/collections-over"]},{"id":"transfer","can":"Combine a loop with a division that keeps its fraction, and handle an empty list.","assessment":["course:cs-foundations/task/collections-average"]}]
tasks: [{"id":"course:cs-foundations/task/collections-total-minutes","path":"tasks/total-minutes/task.json"},{"id":"course:cs-foundations/task/collections-over","path":"tasks/over/task.json"},{"id":"course:cs-foundations/task/collections-average","path":"tasks/average/task.json"}]
review: {"task":"course:cs-foundations/task/collections-average","afterModule":"course:cs-foundations/module/records","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["arrays/initializer","arrays/read","arrays/length","collections/new-list","collections/add","loops/foreach","loops/for"]
drillGap: These drills practise one array, list or loop form each. They do not check a method against empty, single and repeated inputs.
---

Most programs work on many values at once. This module covers **arrays**, which have a fixed length, `List<T>`, which can grow, and the **loops** that visit each item.

## Arrays and loops

An array holds a fixed number of values of one type.

```csharp
int[] minutes = { 30, 15, 45 };
```

- Positions (**indexes**) start at 0, so `minutes[0]` is 30 and `minutes[2]` is 45.
- `minutes.Length` is the number of items.
- Reading a position that does not exist, such as `minutes[3]`, stops the program with an `IndexOutOfRangeException`.

A `foreach` loop runs its block once for each item, in order. A variable declared before the loop can collect a result across the runs.

```csharp example totals
int[] minutes = { 30, 15, 45 };
int total = 0;
foreach (int value in minutes)
{
    total = total + value;
}
Console.WriteLine(total);
Console.WriteLine(minutes.Length);
Console.WriteLine(minutes[0]);
```

```output
90
3
30
```

## Trace a running total {prediction}

Follow `total` through each run of the loop, then predict the three lines.

@example totals

:::question predict-total example=totals
What are the three output lines?
- [ ] 45, 3, 30 :: The loop adds all three items: 30, then 15, then 45.
- [x] 90, 3, 30 :: The total of all three items is 90, the array has 3 items, and position 0 holds 30.
- [ ] 90, 3, 15 :: Positions start at 0, so `minutes[0]` is the first item, 30.
:::

## Follow the loop {walkthrough}

`total` starts at 0, before the loop. The loop runs three times: `total` becomes 30, then 45, then 90.

If `total` were declared inside the loop it would start again on every run. `Length` is 3, and position 0 holds the first item.

@example totals

## Lists that grow

A `List<T>` holds items of type `T` and can change size.

- `new List<string>()` creates an empty list of strings. `new List<int> { 4, 9 }` creates one with two items.
- `Add` appends an item. `Count` is the number of items (an array uses `Length`).

A `for` loop counts with a variable:

```csharp
for (int i = 0; i < songs.Count; i++) { ... }
```

It runs with `i` equal to 0, 1 and so on, and stops when `i` reaches `Count`. `i++` adds 1 to `i`. Use `for` when you need the position, and `foreach` when you only need the item.

```csharp example grow
List<string> songs = new List<string>();
songs.Add("Intro");
songs.Add("Finale");
Console.WriteLine(songs.Count);
for (int i = 0; i < songs.Count; i++)
{
    Console.WriteLine($"{i}: {songs[i]}");
}
```

```output
2
0: Intro
1: Finale
```

## Predict a counted loop {prediction}

Read the loop condition carefully, then predict the last line.

@example grow

:::question predict-loop example=grow
What is the last line of output?
- [x] 1: Finale :: `i` stops before `Count`, so the last run has `i` equal to 1.
- [ ] 2: Finale :: Positions start at 0. The second item is at position 1.
- [ ] The program stops with an error :: The condition is `i < songs.Count`, so position 2 is never read.
:::

## Follow the counter {walkthrough}

After two `Add` calls, `Count` is 2. The loop runs with `i` as 0 and then 1. When `i` reaches 2 the condition `i < songs.Count` is false and the loop ends, so position 2, which does not exist, is never read.

Writing `<=` there would read one position too far and stop the program.

@example grow

## Total the workout minutes {modification}

The starter visits every item but ends with the wrong total. Repair the loop.

@task collections-total-minutes

## Collect the long workouts {independent}

Work from the prompt. Build a new list and keep the order of the input.

@task collections-over

---
id: course:cs-foundations/module/linq
title: LINQ
requires: ["list","loop","method","parameter-return","record","dictionary","comparison","boolean-logic"]
outcomes: [{"id":"query","can":"Filter and transform a list with Where and Select.","assessment":["predict-query","predict-sorting","course:cs-foundations/task/linq-open-titles"]},{"id":"group","can":"Group items and total a value for each group.","assessment":["course:cs-foundations/task/linq-minutes-by-owner"]},{"id":"deferred","can":"Predict when a query runs and save its results at the right time.","assessment":["predict-deferred","course:cs-foundations/task/linq-long-titles"]}]
tasks: [{"id":"course:cs-foundations/task/linq-open-titles","path":"tasks/open-titles/task.json"},{"id":"course:cs-foundations/task/linq-minutes-by-owner","path":"tasks/minutes-by-owner/task.json"},{"id":"course:cs-foundations/task/linq-long-titles","path":"tasks/long-titles/task.json"}]
review: {"task":"course:cs-foundations/task/linq-long-titles","afterModule":"course:cs-foundations/module/exceptions","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["linq/where","linq/select","linq/group","linq/any","methods/lambda"]
drillGap: These drills practise one LINQ method each. They do not check a chain against sample data or test when a query runs.
---

Filtering, transforming and counting come up so often that C# has a set of methods for them, called LINQ. This module covers lambdas, the most used LINQ methods, and the fact that a query does not run until its results are read.

## A lambda is a small method

A **lambda** is an anonymous function written in place, without a name. It can be converted to a delegate such as `Func<Movie, bool>`. `movie => !movie.Watched` takes one movie and returns whether it is still unwatched. The part before `=>` is the parameter, and the part after it is the result.

LINQ methods take lambdas:

| Method | Does |
| --- | --- |
| `Where` | keeps the items for which the lambda returns true |
| `Select` | replaces each item with the lambda's result |
| `Count()`, `Any()` | counts the items, or says whether there is at least one |
| `Sum` | adds up a number taken from each item |

The methods chain: the result of one is the input of the next. `OrderBy` starts a sort by its key, and `ThenBy` adds a tie breaker to that sort. LINQ sorting is stable: when both keys tie, items keep their source order. A second `OrderBy` starts a new primary sort.


## Sort by two keys {prediction}

Predict the names. `OrderBy` sorts by points first. `ThenBy` sorts ties by position. If both numeric keys tie, the stable sort keeps their source order.

```csharp example sorting
var entries = new[]
{
    new Entry("Beta", 8, 1),
    new Entry("Jo", 5, 9),
    new Entry("Alpha", 8, 1),
    new Entry("Mina", 8, 2),
};

foreach (var entry in entries.OrderBy(entry => entry.Points).ThenBy(entry => entry.Position))
{
    Console.WriteLine(entry.Name);
}

record Entry(string Name, int Points, int Position);
```

```output
Jo
Beta
Alpha
Mina
```

:::question predict-sorting example=sorting
What are the names in order?
- [x] Jo, Beta, Alpha, Mina :: Points sort first, then position. Beta and Alpha tie on both numeric keys, so stable ordering keeps Beta first as it was in the source.
- [ ] Jo, Alpha, Beta, Mina :: Beta and Alpha tie on both numeric keys, so their original source order is kept.
- [ ] Beta, Alpha, Mina, Jo :: Points are the primary key, so Jo with 5 points comes first.
:::

## Empty sequence results

For an empty sequence, `Any()` is `false`, `Count()` is 0, and `Sum` of `int` values is 0. `First()` throws when there is no item. `FirstOrDefault()` returns the type's default value, which for `int` is 0 and may be a real result. Use an explicit check when absence must stay distinct from a real zero.

## Filter, then transform {prediction}

`unwatched` keeps the movies that are not watched. Predict the first two lines of output.

```csharp example query
List<Movie> movies = new List<Movie>
{
    new Movie("Up", "Drama", true),
    new Movie("Jaws", "Comedy", false),
    new Movie("Heat", "Drama", false),
};

var unwatched = movies.Where(movie => !movie.Watched);
Console.WriteLine(unwatched.Count());
Console.WriteLine(string.Join(", ", unwatched.Select(movie => movie.Title)));

foreach (var group in movies.GroupBy(movie => movie.Genre))
{
    Console.WriteLine($"{group.Key}: {group.Count()}");
}

record Movie(string Title, string Genre, bool Watched);

```

```output
2
Jaws, Heat
Drama: 2
Comedy: 1
```

:::question predict-query example=query
What are the first two lines of output?
- [ ] 3, then Up, Jaws, Heat :: `Where` keeps only the movies that are not watched. Up is watched.
- [x] 2, then Jaws, Heat :: `Where` keeps Jaws and Heat, because Up is watched, so `Count()` is 2. `Select` then replaces each kept movie with its `Title`, and `string.Join` puts a comma and a space between them. The original order is kept.
- [ ] 2, then Heat, Jaws :: LINQ keeps the order of the source list unless you sort it.
:::

## Group by a key {prediction}

`GroupBy` collects the items that share a key, here the genre. Each group has a `Key` and holds its items, so it can be counted or summed like a list. The last loop in the example prints one line per group. Predict them.

@example query

:::question predict-group example=query
What are the last two lines of output?
- [x] Drama: 2, then Comedy: 1 :: Up and Heat share the genre Drama, and Jaws is the only Comedy. Groups come in the order their key first appears, and `GroupBy` sees every movie, watched or not.
- [ ] Drama: 1, then Comedy: 1 :: `GroupBy` works on `movies`, not on `unwatched`, so Up counts too: Drama has Up and Heat.
- [ ] Comedy: 1, then Drama: 2 :: Groups are not sorted. They come in the order their key first appears, and Drama comes first with Up.
:::

## A query runs when it is read

`Where` and `Select` do not do their work when you call them. They return a description of the work, called a **query**. Its type is `IEnumerable<T>`, which means something you can loop over. Lists and arrays fit that type too.

- The query runs each time something reads it: a `foreach`, `Count()` or `ToList()`. This is called **deferred execution**.
- `ToList()` runs the query now and stores its results in a new, mutable list. Adding items to the source later does not add them to this list. Reference-type items can still be shared between the two lists.
- `ToDictionary` does the same into a dictionary, from one lambda for the key and one for the value.


## Change the list after the query {prediction}

50 is added after both queries are written. Predict the two lines of output.

```csharp example deferred
List<int> minutes = new List<int> { 10, 40 };
var longOnes = minutes.Where(value => value > 30);
var saved = minutes.Where(value => value > 30).ToList();
minutes.Add(50);
Console.WriteLine(longOnes.Count());
Console.WriteLine(saved.Count);

```

```output
2
1
```

:::question predict-deferred example=deferred
What are the two lines of output?
- [x] 2, then 1 :: `longOnes` is only a description. It runs when `Count()` reads it, after 50 was added, so it finds 40 and 50. `saved` called `ToList()` straight away, when the list held 10 and 40, so it keeps one item. Use `ToList()` to capture which items the query returns now. It does not freeze the new list or copy objects inside it.
- [ ] 1, then 1 :: `longOnes` has not run yet when 50 is added. It runs at `Count()` and sees the new item.
- [ ] 2, then 2 :: `ToList()` already ran its query and stored the results. Later changes to `minutes` do not reach it.
:::

## List the unwatched titles {modification}

The case box supplies the record type and sample movies. The starter returns every title.

@task linq-open-titles

## Total the minutes per genre {independent}

Work from the prompt. Use LINQ to group the filtered movies. You can build the final dictionary with ToDictionary or by walking the groups.

@task linq-minutes-by-owner

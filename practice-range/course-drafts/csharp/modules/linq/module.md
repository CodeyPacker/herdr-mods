---
id: course:cs-foundations/module/linq
title: LINQ
requires: ["list","loop","method","parameter-return","record","dictionary","comparison","boolean-logic"]
outcomes: [{"id":"query","can":"Filter and transform a list with Where and Select.","assessment":["predict-query","course:cs-foundations/task/linq-open-titles"]},{"id":"group","can":"Group items and total a value for each group.","assessment":["course:cs-foundations/task/linq-minutes-by-owner"]},{"id":"deferred","can":"Predict when a query runs and save its results at the right time.","assessment":["predict-deferred","course:cs-foundations/task/linq-long-titles"]}]
tasks: [{"id":"course:cs-foundations/task/linq-open-titles","path":"tasks/open-titles/task.json"},{"id":"course:cs-foundations/task/linq-minutes-by-owner","path":"tasks/minutes-by-owner/task.json"},{"id":"course:cs-foundations/task/linq-long-titles","path":"tasks/long-titles/task.json"}]
review: {"task":"course:cs-foundations/task/linq-long-titles","afterModule":"course:cs-foundations/module/exceptions","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["linq/where","linq/select","linq/group","linq/any","methods/lambda"]
drillGap: These drills practise one LINQ method each. They do not check a chain against sample data or test when a query runs.
---

Filtering, transforming and counting come up so often that C# has a set of methods for them, called LINQ. This module covers lambdas, the most used LINQ methods, and the fact that a query does not run until its results are read.

## A lambda is a small method

A lambda is a method written in place, without a name. movie => !movie.Watched takes one movie and returns whether it is still unwatched. The part before => is the parameter and the part after it is the result. LINQ methods take lambdas. Where keeps the items for which the lambda returns true. Select replaces each item with the lambda's result. Count() counts the items, Any() says whether there is at least one, and Sum adds up a number taken from each item. The methods chain: the result of one is the input of the next.

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

## Filter, then transform {prediction}

unwatched keeps the movies that are not watched. Predict the first two lines of output.

@example query

:::question predict-query example=query
What are the first two lines of output?
- [ ] 3, then Up, Jaws, Heat :: Where keeps only the movies that are not watched. Up is watched.
- [x] 2, then Jaws, Heat :: Two movies are unwatched, and Select turns each into its title, in the original order.
- [ ] 2, then Heat, Jaws :: LINQ keeps the order of the source list unless you sort it.
:::

## Follow the query {walkthrough}

Where keeps Jaws and Heat, because Up is watched, so Count() is 2. Select then replaces each kept movie with its Title, and string.Join puts a comma and a space between them. The order of the original list is preserved. GroupBy collects the items that share a key. Each group has a Key, here the genre, and can itself be counted or summed. Drama has two movies and Comedy has one.

@example query

## A query runs when it is read

Where and Select do not do their work when you call them. They return a description of the work, called a query. Its type is IEnumerable<T>, which means something you can loop over. Lists and arrays fit that type too. The query runs each time something reads it: a foreach, Count(), or ToList(). This is called deferred execution. ToList() runs the query once and stores the results in a new list, which does not change afterwards. ToDictionary does the same into a dictionary, from one lambda for the key and one for the value.

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

## Change the list after the query {prediction}

50 is added after both queries are written. Predict the two lines of output.

@example deferred

:::question predict-deferred example=deferred
What are the two lines of output?
- [x] 2, then 1 :: longOnes runs when it is counted, after 50 was added. saved was captured earlier by ToList().
- [ ] 1, then 1 :: longOnes has not run yet when 50 is added. It runs at Count() and sees the new item.
- [ ] 2, then 2 :: ToList() already ran its query and stored the results. Later changes to minutes do not reach it.
:::

## Follow the timing {walkthrough}

longOnes is only a description. It runs when Count() reads it, after 50 was added, so it finds 40 and 50 and prints 2. saved called ToList() straight away, when the list held only 10 and 40, so it captured one item and stays at 1. When a result must not change later, end the query with ToList().

@example deferred

## List the unwatched titles {modification}

The case box supplies the record type and sample movies. The starter returns every title.

@task linq-open-titles

## Total the minutes per genre {independent}

Work from the prompt. A loop with a dictionary and a LINQ chain are both accepted.

@task linq-minutes-by-owner

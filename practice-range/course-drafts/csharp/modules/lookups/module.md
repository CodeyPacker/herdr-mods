---
id: course:cs-foundations/module/lookups
title: Dictionaries and sets
requires: ["list","loop","method","parameter-return","branch","comparison","null-check"]
outcomes: [{"id":"count","can":"Build and update counts in a Dictionary.","assessment":["predict-count","course:cs-foundations/task/lookups-count-by-owner"]},{"id":"missing","can":"Read a key that may be missing without stopping the program.","assessment":["course:cs-foundations/task/lookups-minutes-for"]},{"id":"unique","can":"Collect unique values with a HashSet.","assessment":["predict-set","course:cs-foundations/task/lookups-unique-owners"]}]
tasks: [{"id":"course:cs-foundations/task/lookups-count-by-owner","path":"tasks/count-by-owner/task.json"},{"id":"course:cs-foundations/task/lookups-minutes-for","path":"tasks/minutes-for/task.json"},{"id":"course:cs-foundations/task/lookups-unique-owners","path":"tasks/unique-owners/task.json"}]
review: {"task":"course:cs-foundations/task/lookups-unique-owners","afterModule":"course:cs-foundations/module/patterns","evidence":"Open a fresh starter on a later visit, with the earlier answer closed. A first unaided pass on every case is later evidence of the skill. A hinted pass stays recorded as assisted."}
drills: ["collections/dictionary","collections/dictionary-update","collections/contains-key","collections/try-get"]
drillGap: These drills practise one dictionary call each. They do not check repeated keys, missing keys and stored zeros together.
---

A list finds items by position. A Dictionary finds a value by its key, and a HashSet keeps each value only once. This module covers both, including what happens when a key is missing.

## Find a value by its key

A `Dictionary<string, int>` stores pairs: a string key and an `int` value for it. `votes["Ana"]` = 2; stores 2 under the key `"Ana"`, adding the key if it is new and replacing the value if it exists. `votes["Ana"]` reads the value. Reading a key that is not there stops the program with a `KeyNotFoundException`. To be safe, ask first with ContainsKey, or use TryGetValue. `votes.TryGetValue`(`"Cy"`, out `int` found) returns true and puts the value in found when the key exists, and returns false when it does not. The word out marks a variable that the method fills in. Count is the number of keys.

```csharp example counts
Dictionary<string, int> votes = new Dictionary<string, int>();
votes["Ana"] = 2;
votes["Ben"] = 1;
votes["Ana"] = votes["Ana"] + 1;
Console.WriteLine(votes["Ana"]);
Console.WriteLine(votes.Count);
Console.WriteLine(votes.ContainsKey("Cy"));
if (votes.TryGetValue("Cy", out int found))
{
    Console.WriteLine(found);
}
else
{
    Console.WriteLine("no entry");
}

HashSet<string> visitors = new HashSet<string>();
visitors.Add("Ana");
visitors.Add("Ben");
Console.WriteLine(visitors.Add("Ana"));
Console.WriteLine(visitors.Count);

```

```output
3
2
False
no entry
False
2
```

## Update a count {prediction}

Follow the value stored under `"Ana"`. Predict the first two lines of output.

@example counts

:::question predict-count example=counts
What are the first two lines of output?
- [ ] 2, 2 :: The fourth line stores a new value for Ana: the old 2 plus 1.
- [x] 3, 2 :: Ana is updated to 3. Storing under an existing key replaces its value and adds no key.
- [ ] 3, 3 :: Storing under a key that exists replaces the value. The dictionary still has two keys.
:::

## Follow the dictionary {walkthrough}

Ana starts at 2. The fourth line reads 2, adds 1 and stores 3 back under the same key, so Ana is 3 and there are still only two keys. `"Cy"` was never added. ContainsKey returns False, and TryGetValue returns false, so the else block prints `"no entry"`. Reading `votes["Cy"]` directly would have stopped the program.

@example counts

## Keep each value once

A `HashSet<string>` holds values with no repeats. Add returns true when the value was new and false when the set already had it. Contains tests for a value, and Count is the number of different values.

@example counts

## Add a repeat {prediction}

`"Ana"` is added to the set twice. Predict the last two lines of output.

@example counts

:::question predict-set example=counts
What are the last two lines of output?
- [x] False, 2 :: The set already had Ana, so Add returns False and the count stays at 2.
- [ ] True, 3 :: A set keeps each value once. Adding Ana again changes nothing.
- [ ] False, 3 :: Add returned False because nothing was added, so the count is still 2.
:::

## Follow the set {walkthrough}

The first two Add calls return true, and their results are not used. The third adds `"Ana"` again. The set already has it, so Add returns False and the set does not grow. Count is 2.

@example counts

## Count the votes {modification}

The starter records every name but never counts above 1. Repair the update.

@task lookups-count-by-owner

## Look up the stock {independent}

Work from the prompt. The case box supplies a dictionary to read from.

@task lookups-minutes-for

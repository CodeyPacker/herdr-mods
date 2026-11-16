/** @type {import("../types.js").Topic} */
export const linq = {
  id: "linq",
  title: "LINQ & query expressions",
  description: "Filtering, projection, grouping, joins, and query syntax.",
  level: "advanced",
  exercises: [
    {
      id: "where",
      title: "Filter with Where",
      prompt: "Declare int[] values = { 1, 2, 3, 4 }. Use Where and ToArray to create result containing the even values.",
      solution: "int[] values = { 1, 2, 3, 4 };\nvar result = values.Where(item => item % 2 == 0).ToArray();",
      checks: ["result.SequenceEqual(new[] { 2, 4 })"],
      rules: [
        {"kind":"InvocationExpression","token":"Where","message":"Call Where with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "Where takes a predicate: item => item % 2 == 0.",
        "Complete this form:\n\n```csharp\nint[] values = { 1, 2, 3, 4 };\nvar result = values.Where(___).ToArray();\n```",
      ],
    },
    {
      id: "select",
      title: "Project with Select",
      prompt: "Declare int[] values = { 1, 2, 3 }. Use Select and ToArray to create result with each value doubled.",
      solution: "int[] values = { 1, 2, 3 };\nvar result = values.Select(item => item * 2).ToArray();",
      checks: ["result.SequenceEqual(new[] { 2, 4, 6 })"],
      rules: [
        {"kind":"InvocationExpression","token":"Select","message":"Call Select with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "Select maps each input element to a result.",
        "Complete this form:\n\n```csharp\nint[] values = { 1, 2, 3 };\nvar result = values.Select(item => ___).ToArray();\n```",
      ],
    },
    {
      id: "select-many",
      title: "Flatten with SelectMany",
      prompt: "Declare int[][] rows = { new[] { 1, 2 }, new[] { 3 } }. Use SelectMany and ToArray to create flat result.",
      solution: "int[][] rows = { new[] { 1, 2 }, new[] { 3 } };\nvar result = rows.SelectMany(row => row).ToArray();",
      checks: ["result.SequenceEqual(new[] { 1, 2, 3 })"],
      rules: [
        {"kind":"InvocationExpression","token":"SelectMany","message":"Call SelectMany with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "SelectMany flattens the collections returned by its selector.",
        "Complete this form:\n\n```csharp\nint[][] rows = { new[] { 1, 2 }, new[] { 3 } };\nvar result = rows.SelectMany(row => ___).ToArray();\n```",
      ],
    },
    {
      id: "order",
      title: "Order descending",
      prompt: "Declare int[] values = { 2, 1, 3 }. Use OrderByDescending and ToArray to create result.",
      solution: "int[] values = { 2, 1, 3 };\nvar result = values.OrderByDescending(item => item).ToArray();",
      checks: ["result.SequenceEqual(new[] { 3, 2, 1 })"],
      rules: [
        {"kind":"InvocationExpression","token":"OrderByDescending","message":"Call OrderByDescending with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "OrderByDescending takes a key selector, even when the key is the element itself.",
        "Complete this form:\n\n```csharp\nint[] values = { 2, 1, 3 };\nvar result = values.OrderByDescending(item => ___).ToArray();\n```",
      ],
    },
    {
      id: "then-by",
      title: "Add a secondary ordering",
      prompt: "Declare string[] words = { \"bb\", \"aa\", \"c\" }. OrderBy length, ThenBy the word using StringComparer.Ordinal, and ToArray into result.",
      solution: "string[] words = { \"bb\", \"aa\", \"c\" };\nvar result = words.OrderBy(word => word.Length).ThenBy(word => word, StringComparer.Ordinal).ToArray();",
      checks: ["result.SequenceEqual(new[] { \"c\", \"aa\", \"bb\" })"],
      rules: [
        {"kind":"InvocationExpression","token":"ThenBy","message":"Call ThenBy with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "ThenBy adds an ordering after OrderBy rather than replacing it.",
        "Complete this form:\n\n```csharp\nstring[] words = { \"bb\", \"aa\", \"c\" };\nvar result = words.OrderBy(word => word.Length).ThenBy(word => ___, StringComparer.Ordinal).ToArray();\n```",
      ],
    },
    {
      id: "group",
      title: "Group by a key",
      prompt: "Declare int[] values = { 1, 2, 3, 4 }. Use GroupBy(item => item % 2), then ToDictionary from group.Key to group.Count(), naming it result.",
      solution: "int[] values = { 1, 2, 3, 4 };\nvar result = values.GroupBy(item => item % 2).ToDictionary(group => group.Key, group => group.Count());",
      checks: ["result[0] == 2 && result[1] == 2"],
      rules: [
        {"kind":"InvocationExpression","token":"GroupBy","message":"Call GroupBy with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "Each grouping exposes Key and can be enumerated.",
        "Complete this form:\n\n```csharp\nint[] values = { 1, 2, 3, 4 };\nvar result = values.GroupBy(item => ___).ToDictionary(group => group.Key, group => group.Count());\n```",
      ],
    },
    {
      id: "join",
      title: "Join two sequences",
      prompt: "Declare int[] ids = { 1, 2 } and tuples names = new[] { (Id: 2, Name: \"Ada\") }. Use Join by ID to create result containing the matching names as an array.",
      solution: "int[] ids = { 1, 2 };\nvar names = new[] { (Id: 2, Name: \"Ada\") };\nvar result = ids.Join(names, id => id, entry => entry.Id, (id, entry) => entry.Name).ToArray();",
      checks: ["result.SequenceEqual(new[] { \"Ada\" })"],
      rules: [
        {"kind":"InvocationExpression","token":"Join","message":"Call Join with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "Join takes inner sequence, outer key selector, inner key selector, then result selector.",
        "Complete this form:\n\n```csharp\nint[] ids = { 1, 2 };\nvar names = new[] { (Id: 2, Name: \"Ada\") };\nvar result = ids.Join(names, id => id, entry => entry.___, (id, entry) => entry.Name).ToArray();\n```",
      ],
    },
    {
      id: "group-join",
      title: "Create a grouped join",
      prompt: "Declare int[] keys = { 1, 2 } and int[] values = { 2, 2 }. Use GroupJoin by element identity, projecting matches.Count(), then ToArray into result.",
      solution: "int[] keys = { 1, 2 };\nint[] values = { 2, 2 };\nvar result = keys.GroupJoin(values, key => key, item => item, (key, matches) => matches.Count()).ToArray();",
      checks: ["result.SequenceEqual(new[] { 0, 2 })"],
      rules: [
        {"kind":"InvocationExpression","token":"GroupJoin","message":"Call GroupJoin with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "The result selector receives a collection of matching inner elements.",
        "Complete this form:\n\n```csharp\nint[] keys = { 1, 2 };\nint[] values = { 2, 2 };\nvar result = keys.GroupJoin(values, key => key, item => item, (key, matches) => matches.___()).ToArray();\n```",
      ],
    },
    {
      id: "dictionary",
      title: "Project into a dictionary",
      prompt: "Declare string[] words = { \"a\", \"bbb\" }. Use ToDictionary with word as key and Length as value, naming it result.",
      solution: "string[] words = { \"a\", \"bbb\" };\nvar result = words.ToDictionary(word => word, word => word.Length);",
      checks: ["result[\"a\"] == 1 && result[\"bbb\"] == 3"],
      rules: [
        {"kind":"InvocationExpression","token":"ToDictionary","message":"Call ToDictionary with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "Pass a key selector and then a value selector.",
        "Complete this form:\n\n```csharp\nstring[] words = { \"a\", \"bbb\" };\nvar result = words.ToDictionary(word => word, word => ___);\n```",
      ],
    },
    {
      id: "distinct",
      title: "Remove duplicates",
      prompt: "Declare int[] values = { 1, 2, 1 }. Use Distinct and ToArray to create result.",
      solution: "int[] values = { 1, 2, 1 };\nvar result = values.Distinct().ToArray();",
      checks: ["result.SequenceEqual(new[] { 1, 2 })"],
      rules: [
        {"kind":"InvocationExpression","token":"Distinct","message":"Call Distinct with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "Distinct returns unique elements using the default equality comparer.",
        "Complete this form:\n\n```csharp\nint[] values = { 1, 2, 1 };\nvar result = values.___().ToArray();\n```",
      ],
    },
    {
      id: "any",
      title: "Test whether any element matches",
      prompt: "Declare int[] values = { -1, 2, -3 }. Use Any to declare bool result when an element is positive.",
      solution: "int[] values = { -1, 2, -3 };\nbool result = values.Any(item => item > 0);",
      checks: ["result"],
      rules: [
        {"kind":"InvocationExpression","token":"Any","message":"Call Any with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "Any takes a predicate and stops at the first match.",
        "Complete this form:\n\n```csharp\nint[] values = { -1, 2, -3 };\nbool result = values.Any(item => ___);\n```",
      ],
    },
    {
      id: "all",
      title: "Test whether every element matches",
      prompt: "Declare int[] values = { 2, 4, 6 }. Use All to declare bool result when every element is even.",
      solution: "int[] values = { 2, 4, 6 };\nbool result = values.All(item => item % 2 == 0);",
      checks: ["result"],
      rules: [
        {"kind":"InvocationExpression","token":"All","message":"Call All with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "All takes a predicate that must hold for every element.",
        "Complete this form:\n\n```csharp\nint[] values = { 2, 4, 6 };\nbool result = values.All(item => ___);\n```",
      ],
    },
    {
      id: "aggregate",
      title: "Fold with Aggregate",
      prompt: "Declare int[] values = { 2, 3, 4 }. Use Aggregate with seed 1 and multiplication to declare int result.",
      solution: "int[] values = { 2, 3, 4 };\nint result = values.Aggregate(1, (product, item) => product * item);",
      checks: ["result == 24"],
      rules: [
        {"kind":"InvocationExpression","token":"Aggregate","message":"Call Aggregate with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "The accumulator lambda receives the running product and next element.",
        "Complete this form:\n\n```csharp\nint[] values = { 2, 3, 4 };\nint result = values.Aggregate(1, (product, item) => ___);\n```",
      ],
    },
    {
      id: "zip",
      title: "Combine paired elements",
      prompt: "Declare int[] left = { 1, 2 } and right = { 10, 20 }. Use Zip with addition and ToArray to create result.",
      solution: "int[] left = { 1, 2 }, right = { 10, 20 };\nvar result = left.Zip(right, (a, b) => a + b).ToArray();",
      checks: ["result.SequenceEqual(new[] { 11, 22 })"],
      rules: [
        {"kind":"InvocationExpression","token":"Zip","message":"Call Zip with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "Zip passes one element from each sequence to the selector.",
        "Complete this form:\n\n```csharp\nint[] left = { 1, 2 }, right = { 10, 20 };\nvar result = left.Zip(right, (a, b) => ___).ToArray();\n```",
      ],
    },
    {
      id: "partition",
      title: "Skip and take elements",
      prompt: "Declare int[] values = { 1, 2, 3, 4, 5 }. Chain Skip(1), Take(3), and ToArray into result.",
      solution: "int[] values = { 1, 2, 3, 4, 5 };\nvar result = values.Skip(1).Take(3).ToArray();",
      checks: ["result.SequenceEqual(new[] { 2, 3, 4 })"],
      rules: [
        {"kind":"InvocationExpression","token":"Skip","message":"Call Skip with the required arguments."},
        {"kind":"InvocationExpression","token":"Take","message":"Call Take with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "Skip removes a prefix; Take limits how many remaining elements are returned.",
        "Complete this form:\n\n```csharp\nint[] values = { 1, 2, 3, 4, 5 };\nvar result = values.Skip(___).Take(___).ToArray();\n```",
      ],
    },
    {
      id: "of-type",
      title: "Select elements by runtime type",
      prompt: "Declare object[] values = { 1, \"a\", 2 }. Use OfType<int>() and ToArray into result.",
      solution: "object[] values = { 1, \"a\", 2 };\nvar result = values.OfType<int>().ToArray();",
      checks: ["result.SequenceEqual(new[] { 1, 2 })"],
      rules: [
        {"kind":"InvocationExpression","token":"OfType","message":"Call OfType with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "OfType supplies the desired runtime type as a generic argument.",
        "Complete this form:\n\n```csharp\nobject[] values = { 1, \"a\", 2 };\nvar result = values.OfType<___>().ToArray();\n```",
      ],
    },
    {
      id: "query-select",
      title: "Write a query expression",
      prompt: "Declare int[] values = { 1, 2, 3 }. Use from, where item > 1, and select item * 2 in a query named result.",
      solution: "int[] values = { 1, 2, 3 };\nvar result = from item in values where item > 1 select item * 2;",
      checks: ["result.SequenceEqual(new[] { 4, 6 })"],
      rules: [
        {"kind":"QueryExpression","message":"A query begins with from and ends with select or group."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "A query begins with from and ends with select or group.",
        "Complete this form:\n\n```csharp\nint[] values = { 1, 2, 3 };\nvar result = from item in values where ___ select item * 2;\n```",
      ],
    },
    {
      id: "query-let",
      title: "Introduce a query value",
      prompt: "Declare int[] values = { 1, 2, 3 }. Query from item in values, let doubled = item * 2, where doubled > 2, select doubled, naming it result.",
      solution: "int[] values = { 1, 2, 3 };\nvar result = from item in values let doubled = item * 2 where doubled > 2 select doubled;",
      checks: ["result.SequenceEqual(new[] { 4, 6 })"],
      rules: [
        {"kind":"LetClause","message":"Let introduces a named expression used by later query clauses."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "Let introduces a named expression used by later query clauses.",
        "Complete this form:\n\n```csharp\nint[] values = { 1, 2, 3 };\nvar result = from item in values let doubled = ___ where doubled > 2 select doubled;\n```",
      ],
    },
    {
      id: "query-join",
      title: "Join using query syntax",
      prompt: "Declare int[] left = { 1, 2 }, right = { 2, 3 }. Query from a in left join b in right on a equals b select a + b, naming it result.",
      solution: "int[] left = { 1, 2 }, right = { 2, 3 };\nvar result = from a in left join b in right on a equals b select a + b;",
      checks: ["result.SequenceEqual(new[] { 4 })"],
      rules: [
        {"kind":"JoinClause","message":"A query join uses equals between its two key expressions."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "A query join uses equals between its two key expressions.",
        "Complete this form:\n\n```csharp\nint[] left = { 1, 2 }, right = { 2, 3 };\nvar result = from a in left join b in right on a ___ b select a + b;\n```",
      ],
    },
    {
      id: "query-group",
      title: "Group using query syntax",
      prompt: "Declare int[] values = { 1, 2, 3, 4 }. Query from item in values group item by item % 2, naming it result.",
      solution: "int[] values = { 1, 2, 3, 4 };\nvar result = from item in values group item by item % 2;",
      checks: ["result.Count() == 2 && result.All(group => group.Count() == 2)"],
      rules: [
        {"kind":"GroupClause","message":"The element expression follows group and the key follows by."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "The element expression follows group and the key follows by.",
        "Complete this form:\n\n```csharp\nint[] values = { 1, 2, 3, 4 };\nvar result = from item in values group item by ___;\n```",
      ],
    },
    {
      id: "where-practice",
      title: "Filter with Where: another example",
      prompt: "Declare int[] samples = { 1, 2, 3, 4 }. Use Where and ToArray to create result containing the even samples.",
      solution: "int[] samples = { 1, 2, 3, 4 };\nvar result = samples.Where(item => item % 2 == 0).ToArray();",
      checks: ["result.SequenceEqual(new[] { 2, 4 })"],
      rules: [
        {"kind":"InvocationExpression","token":"Where","message":"Call Where with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "Where takes a predicate: item => item % 2 == 0.",
        "Complete this form:\n\n```csharp\nint[] samples = { 1, 2, 3, 4 };\nvar result = samples.Where(___).ToArray();\n```",
      ],
    },
    {
      id: "select-practice",
      title: "Project with Select: another example",
      prompt: "Declare int[] samples = { 1, 2, 3 }. Use Select and ToArray to create result with each value doubled.",
      solution: "int[] samples = { 1, 2, 3 };\nvar result = samples.Select(item => item * 2).ToArray();",
      checks: ["result.SequenceEqual(new[] { 2, 4, 6 })"],
      rules: [
        {"kind":"InvocationExpression","token":"Select","message":"Call Select with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "Select maps each input element to a result.",
        "Complete this form:\n\n```csharp\nint[] samples = { 1, 2, 3 };\nvar result = samples.Select(item => ___).ToArray();\n```",
      ],
    },
    {
      id: "select-many-practice",
      title: "Flatten with SelectMany: another example",
      prompt: "Declare int[][] rowsSample = { new[] { 1, 2 }, new[] { 3 } }. Use SelectMany and ToArray to create flat result.",
      solution: "int[][] rowsSample = { new[] { 1, 2 }, new[] { 3 } };\nvar result = rowsSample.SelectMany(row => row).ToArray();",
      checks: ["result.SequenceEqual(new[] { 1, 2, 3 })"],
      rules: [
        {"kind":"InvocationExpression","token":"SelectMany","message":"Call SelectMany with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "SelectMany flattens the collections returned by its selector.",
        "Complete this form:\n\n```csharp\nint[][] rowsSample = { new[] { 1, 2 }, new[] { 3 } };\nvar result = rowsSample.SelectMany(row => ___).ToArray();\n```",
      ],
    },
    {
      id: "order-practice",
      title: "Order descending: another example",
      prompt: "Declare int[] samples = { 2, 1, 3 }. Use OrderByDescending and ToArray to create result.",
      solution: "int[] samples = { 2, 1, 3 };\nvar result = samples.OrderByDescending(item => item).ToArray();",
      checks: ["result.SequenceEqual(new[] { 3, 2, 1 })"],
      rules: [
        {"kind":"InvocationExpression","token":"OrderByDescending","message":"Call OrderByDescending with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "OrderByDescending takes a key selector, even when the key is the element itself.",
        "Complete this form:\n\n```csharp\nint[] samples = { 2, 1, 3 };\nvar result = samples.OrderByDescending(item => ___).ToArray();\n```",
      ],
    },
    {
      id: "then-by-practice",
      title: "Add a secondary ordering: another example",
      prompt: "Declare string[] labels = { \"bb\", \"aa\", \"c\" }. OrderBy length, ThenBy the word using StringComparer.Ordinal, and ToArray into result.",
      solution: "string[] labels = { \"bb\", \"aa\", \"c\" };\nvar result = labels.OrderBy(word => word.Length).ThenBy(word => word, StringComparer.Ordinal).ToArray();",
      checks: ["result.SequenceEqual(new[] { \"c\", \"aa\", \"bb\" })"],
      rules: [
        {"kind":"InvocationExpression","token":"ThenBy","message":"Call ThenBy with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "ThenBy adds an ordering after OrderBy rather than replacing it.",
        "Complete this form:\n\n```csharp\nstring[] labels = { \"bb\", \"aa\", \"c\" };\nvar result = labels.OrderBy(word => word.Length).ThenBy(word => ___, StringComparer.Ordinal).ToArray();\n```",
      ],
    },
    {
      id: "group-practice",
      title: "Group by a key: another example",
      prompt: "Declare int[] samples = { 1, 2, 3, 4 }. Use GroupBy(item => item % 2), then ToDictionary from group.Key to group.Count(), naming it result.",
      solution: "int[] samples = { 1, 2, 3, 4 };\nvar result = samples.GroupBy(item => item % 2).ToDictionary(group => group.Key, group => group.Count());",
      checks: ["result[0] == 2 && result[1] == 2"],
      rules: [
        {"kind":"InvocationExpression","token":"GroupBy","message":"Call GroupBy with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "Each grouping exposes Key and can be enumerated.",
        "Complete this form:\n\n```csharp\nint[] samples = { 1, 2, 3, 4 };\nvar result = samples.GroupBy(item => ___).ToDictionary(group => group.Key, group => group.Count());\n```",
      ],
    },
    {
      id: "join-practice",
      title: "Join two sequences: another example",
      prompt: "Declare int[] idsSample = { 1, 2 } and tuples names = new[] { (Id: 2, Name: \"Ada\") }. Use Join by ID to create result containing the matching names as an array.",
      solution: "int[] idsSample = { 1, 2 };\nvar names = new[] { (Id: 2, Name: \"Ada\") };\nvar result = idsSample.Join(names, id => id, entry => entry.Id, (id, entry) => entry.Name).ToArray();",
      checks: ["result.SequenceEqual(new[] { \"Ada\" })"],
      rules: [
        {"kind":"InvocationExpression","token":"Join","message":"Call Join with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "Join takes inner sequence, outer key selector, inner key selector, then result selector.",
        "Complete this form:\n\n```csharp\nint[] idsSample = { 1, 2 };\nvar names = new[] { (Id: 2, Name: \"Ada\") };\nvar result = idsSample.Join(names, id => id, entry => entry.___, (id, entry) => entry.Name).ToArray();\n```",
      ],
    },
    {
      id: "group-join-practice",
      title: "Create a grouped join: another example",
      prompt: "Declare int[] keysSample = { 1, 2 } and int[] values = { 2, 2 }. Use GroupJoin by element identity, projecting matches.Count(), then ToArray into result.",
      solution: "int[] keysSample = { 1, 2 };\nint[] values = { 2, 2 };\nvar result = keysSample.GroupJoin(values, key => key, item => item, (key, matches) => matches.Count()).ToArray();",
      checks: ["result.SequenceEqual(new[] { 0, 2 })"],
      rules: [
        {"kind":"InvocationExpression","token":"GroupJoin","message":"Call GroupJoin with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "The result selector receives a collection of matching inner elements.",
        "Complete this form:\n\n```csharp\nint[] keysSample = { 1, 2 };\nint[] values = { 2, 2 };\nvar result = keysSample.GroupJoin(values, key => key, item => item, (key, matches) => matches.___()).ToArray();\n```",
      ],
    },
    {
      id: "dictionary-practice",
      title: "Project into a dictionary: another example",
      prompt: "Declare string[] labels = { \"a\", \"bbb\" }. Use ToDictionary with word as key and Length as value, naming it result.",
      solution: "string[] labels = { \"a\", \"bbb\" };\nvar result = labels.ToDictionary(word => word, word => word.Length);",
      checks: ["result[\"a\"] == 1 && result[\"bbb\"] == 3"],
      rules: [
        {"kind":"InvocationExpression","token":"ToDictionary","message":"Call ToDictionary with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "Pass a key selector and then a value selector.",
        "Complete this form:\n\n```csharp\nstring[] labels = { \"a\", \"bbb\" };\nvar result = labels.ToDictionary(word => word, word => ___);\n```",
      ],
    },
    {
      id: "distinct-practice",
      title: "Remove duplicates: another example",
      prompt: "Declare int[] samples = { 1, 2, 1 }. Use Distinct and ToArray to create result.",
      solution: "int[] samples = { 1, 2, 1 };\nvar result = samples.Distinct().ToArray();",
      checks: ["result.SequenceEqual(new[] { 1, 2 })"],
      rules: [
        {"kind":"InvocationExpression","token":"Distinct","message":"Call Distinct with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "Distinct returns unique elements using the default equality comparer.",
        "Complete this form:\n\n```csharp\nint[] samples = { 1, 2, 1 };\nvar result = samples.___().ToArray();\n```",
      ],
    },
    {
      id: "any-practice",
      title: "Test whether any element matches: another example",
      prompt: "Declare int[] samples = { -1, 2, -3 }. Use Any to declare bool result when an element is positive.",
      solution: "int[] samples = { -1, 2, -3 };\nbool result = samples.Any(item => item > 0);",
      checks: ["result"],
      rules: [
        {"kind":"InvocationExpression","token":"Any","message":"Call Any with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "Any takes a predicate and stops at the first match.",
        "Complete this form:\n\n```csharp\nint[] samples = { -1, 2, -3 };\nbool result = samples.Any(item => ___);\n```",
      ],
    },
    {
      id: "all-practice",
      title: "Test whether every element matches: another example",
      prompt: "Declare int[] samples = { 2, 4, 6 }. Use All to declare bool result when every element is even.",
      solution: "int[] samples = { 2, 4, 6 };\nbool result = samples.All(item => item % 2 == 0);",
      checks: ["result"],
      rules: [
        {"kind":"InvocationExpression","token":"All","message":"Call All with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "All takes a predicate that must hold for every element.",
        "Complete this form:\n\n```csharp\nint[] samples = { 2, 4, 6 };\nbool result = samples.All(item => ___);\n```",
      ],
    },
    {
      id: "aggregate-practice",
      title: "Fold with Aggregate: another example",
      prompt: "Declare int[] samples = { 2, 3, 4 }. Use Aggregate with seed 1 and multiplication to declare int result.",
      solution: "int[] samples = { 2, 3, 4 };\nint result = samples.Aggregate(1, (product, item) => product * item);",
      checks: ["result == 24"],
      rules: [
        {"kind":"InvocationExpression","token":"Aggregate","message":"Call Aggregate with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "The accumulator lambda receives the running product and next element.",
        "Complete this form:\n\n```csharp\nint[] samples = { 2, 3, 4 };\nint result = samples.Aggregate(1, (product, item) => ___);\n```",
      ],
    },
    {
      id: "zip-practice",
      title: "Combine paired elements: another example",
      prompt: "Declare int[] firstInput = { 1, 2 } and right = { 10, 20 }. Use Zip with addition and ToArray to create result.",
      solution: "int[] firstInput = { 1, 2 }, right = { 10, 20 };\nvar result = firstInput.Zip(right, (a, b) => a + b).ToArray();",
      checks: ["result.SequenceEqual(new[] { 11, 22 })"],
      rules: [
        {"kind":"InvocationExpression","token":"Zip","message":"Call Zip with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "Zip passes one element from each sequence to the selector.",
        "Complete this form:\n\n```csharp\nint[] firstInput = { 1, 2 }, right = { 10, 20 };\nvar result = firstInput.Zip(right, (a, b) => ___).ToArray();\n```",
      ],
    },
    {
      id: "partition-practice",
      title: "Skip and take elements: another example",
      prompt: "Declare int[] samples = { 1, 2, 3, 4, 5 }. Chain Skip(1), Take(3), and ToArray into result.",
      solution: "int[] samples = { 1, 2, 3, 4, 5 };\nvar result = samples.Skip(1).Take(3).ToArray();",
      checks: ["result.SequenceEqual(new[] { 2, 3, 4 })"],
      rules: [
        {"kind":"InvocationExpression","token":"Skip","message":"Call Skip with the required arguments."},
        {"kind":"InvocationExpression","token":"Take","message":"Call Take with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "Skip removes a prefix; Take limits how many remaining elements are returned.",
        "Complete this form:\n\n```csharp\nint[] samples = { 1, 2, 3, 4, 5 };\nvar result = samples.Skip(___).Take(___).ToArray();\n```",
      ],
    },
    {
      id: "of-type-practice",
      title: "Select elements by runtime type: another example",
      prompt: "Declare object[] samples = { 1, \"a\", 2 }. Use OfType<int>() and ToArray into result.",
      solution: "object[] samples = { 1, \"a\", 2 };\nvar result = samples.OfType<int>().ToArray();",
      checks: ["result.SequenceEqual(new[] { 1, 2 })"],
      rules: [
        {"kind":"InvocationExpression","token":"OfType","message":"Call OfType with the required arguments."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "OfType supplies the desired runtime type as a generic argument.",
        "Complete this form:\n\n```csharp\nobject[] samples = { 1, \"a\", 2 };\nvar result = samples.OfType<___>().ToArray();\n```",
      ],
    },
    {
      id: "query-select-practice",
      title: "Write a query expression: another example",
      prompt: "Declare int[] samples = { 1, 2, 3 }. Use from, where item > 1, and select item * 2 in a query named result.",
      solution: "int[] samples = { 1, 2, 3 };\nvar result = from item in samples where item > 1 select item * 2;",
      checks: ["result.SequenceEqual(new[] { 4, 6 })"],
      rules: [
        {"kind":"QueryExpression","message":"A query begins with from and ends with select or group."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "A query begins with from and ends with select or group.",
        "Complete this form:\n\n```csharp\nint[] samples = { 1, 2, 3 };\nvar result = from item in samples where ___ select item * 2;\n```",
      ],
    },
    {
      id: "query-let-practice",
      title: "Introduce a query value: another example",
      prompt: "Declare int[] samples = { 1, 2, 3 }. Query from item in samples, let doubled = item * 2, where doubled > 2, select doubled, naming it result.",
      solution: "int[] samples = { 1, 2, 3 };\nvar result = from item in samples let doubled = item * 2 where doubled > 2 select doubled;",
      checks: ["result.SequenceEqual(new[] { 4, 6 })"],
      rules: [
        {"kind":"LetClause","message":"Let introduces a named expression used by later query clauses."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "Let introduces a named expression used by later query clauses.",
        "Complete this form:\n\n```csharp\nint[] samples = { 1, 2, 3 };\nvar result = from item in samples let doubled = ___ where doubled > 2 select doubled;\n```",
      ],
    },
    {
      id: "query-join-practice",
      title: "Join using query syntax: another example",
      prompt: "Declare int[] firstInput = { 1, 2 }, right = { 2, 3 }. Query from a in firstInput join b in right on a equals b select a + b, naming it result.",
      solution: "int[] firstInput = { 1, 2 }, right = { 2, 3 };\nvar result = from a in firstInput join b in right on a equals b select a + b;",
      checks: ["result.SequenceEqual(new[] { 4 })"],
      rules: [
        {"kind":"JoinClause","message":"A query join uses equals between its two key expressions."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "A query join uses equals between its two key expressions.",
        "Complete this form:\n\n```csharp\nint[] firstInput = { 1, 2 }, right = { 2, 3 };\nvar result = from a in firstInput join b in right on a ___ b select a + b;\n```",
      ],
    },
    {
      id: "query-group-practice",
      title: "Group using query syntax: another example",
      prompt: "Declare int[] samples = { 1, 2, 3, 4 }. Query from item in samples group item by item % 2, naming it result.",
      solution: "int[] samples = { 1, 2, 3, 4 };\nvar result = from item in samples group item by item % 2;",
      checks: ["result.Count() == 2 && result.All(group => group.Count() == 2)"],
      rules: [
        {"kind":"GroupClause","message":"The element expression follows group and the key follows by."},
      ],
      hints: [
        "LINQ operators take functions that describe an element's test, key, or projected result.",
        "The element expression follows group and the key follows by.",
        "Complete this form:\n\n```csharp\nint[] samples = { 1, 2, 3, 4 };\nvar result = from item in samples group item by ___;\n```",
      ],
    },
  ],
};

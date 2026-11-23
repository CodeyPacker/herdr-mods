/** @type {import("../types.js").Topic} */
export const collections = {
  id: "collections",
  title: "Lists & dictionaries",
  description: "Generic collections, initializers, and common operations.",
  exercises: [
    {
      id: "new-list",
      title: "Create a list",
      prompt: "Declare List<int> numbers initialized to a new empty List<int>.",
      solution: "List<int> numbers = new List<int>();",
      checks: ["numbers.Count == 0"],
      rules: [
        {"kind":"VariableDeclarator","message":"Declare numbers using List<int>.","name":"numbers","type":"List<int>"},
      ],
      hints: [
        "The element type goes inside angle brackets.",
        "Declare numbers using List<int>.",
        "Complete this form:\n\n```csharp\nList<int> numbers = new List<___>();\n```",
      ],
    },
    {
      id: "list-initializer",
      title: "Initialize a list",
      prompt: "Declare a List<string> named names initialized with \"Ada\" and \"Lin\" using braces.",
      solution: "List<string> names = new List<string> { \"Ada\", \"Lin\" };",
      checks: ["names.SequenceEqual(new[] { \"Ada\", \"Lin\" })"],
      rules: [
        {"kind":"CollectionInitializerExpression","message":"Put the initial elements in braces after new List<string>."},
      ],
      hints: [
        "A collection initializer calls Add for each item.",
        "Put the initial elements in braces after new List<string>.",
        "Complete this form:\n\n```csharp\nList<string> names = new List<string> { \"___\", \"___\" };\n```",
      ],
    },
    {
      id: "target-new",
      title: "Use target-typed new",
      prompt: "Declare List<int> numbers using new() and an initializer containing 1 and 2.",
      solution: "List<int> numbers = new() { 1, 2 };",
      checks: ["numbers.SequenceEqual(new[] { 1, 2 })"],
      rules: [
        {"kind":"ImplicitObjectCreationExpression","message":"Use new() without repeating List<int>."},
      ],
      hints: [
        "The declared type supplies the constructed type.",
        "Use new() without repeating List<int>.",
        "Complete this form:\n\n```csharp\nList<int> numbers = new() { ___, ___ };\n```",
      ],
    },
    {
      id: "add",
      title: "Add to a list",
      prompt: "Declare a new List<int> named numbers. Add 7 using Add.",
      solution: "var numbers = new List<int>();\nnumbers.Add(7);",
      checks: ["numbers.SequenceEqual(new[] { 7 })"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Add with the required arguments.","token":"Add"},
      ],
      hints: [
        "Add appends one element.",
        "Call Add with the required arguments.",
        "Complete this form:\n\n```csharp\nvar numbers = new List<int>();\nnumbers.___(7);\n```",
      ],
    },
    {
      id: "add-range",
      title: "Add several elements",
      prompt: "Declare a new List<int> named numbers. Use AddRange with new[] { 1, 2, 3 }.",
      solution: "var numbers = new List<int>();\nnumbers.AddRange(new[] { 1, 2, 3 });",
      checks: ["numbers.SequenceEqual(new[] { 1, 2, 3 })"],
      rules: [
        {"kind":"InvocationExpression","message":"Call AddRange with the required arguments.","token":"AddRange"},
      ],
      hints: [
        "AddRange takes a collection rather than separate items.",
        "Call AddRange with the required arguments.",
        "Complete this form:\n\n```csharp\nvar numbers = new List<int>();\nnumbers.___(new[] { 1, 2, 3 });\n```",
      ],
    },
    {
      id: "insert",
      title: "Insert at an index",
      prompt: "Declare a List<int> named numbers containing 1 and 3. Insert 2 at index 1.",
      solution: "var numbers = new List<int> { 1, 3 };\nnumbers.Insert(1, 2);",
      checks: ["numbers.SequenceEqual(new[] { 1, 2, 3 })"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Insert with the required arguments.","token":"Insert"},
      ],
      hints: [
        "Insert takes the index before the new value.",
        "Call Insert with the required arguments.",
        "Complete this form:\n\n```csharp\nvar numbers = new List<int> { 1, 3 };\nnumbers.Insert(___, ___);\n```",
      ],
    },
    {
      id: "remove",
      title: "Remove a value",
      prompt: "Declare a List<int> named numbers containing 1, 2, 3. Remove the value 2 using Remove.",
      solution: "var numbers = new List<int> { 1, 2, 3 };\nnumbers.Remove(2);",
      checks: ["numbers.SequenceEqual(new[] { 1, 3 })"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Remove with the required arguments.","token":"Remove"},
      ],
      hints: [
        "Remove takes a value rather than an index.",
        "Call Remove with the required arguments.",
        "Complete this form:\n\n```csharp\nvar numbers = new List<int> { 1, 2, 3 };\nnumbers.___(2);\n```",
      ],
    },
    {
      id: "remove-at",
      title: "Remove by index",
      prompt: "Declare a List<int> named numbers containing 10, 20, 30. Remove its first element using RemoveAt.",
      solution: "var numbers = new List<int> { 10, 20, 30 };\nnumbers.RemoveAt(0);",
      checks: ["numbers.SequenceEqual(new[] { 20, 30 })"],
      rules: [
        {"kind":"InvocationExpression","message":"Call RemoveAt with the required arguments.","token":"RemoveAt"},
      ],
      hints: [
        "The first element has index zero.",
        "Call RemoveAt with the required arguments.",
        "Complete this form:\n\n```csharp\nvar numbers = new List<int> { 10, 20, 30 };\nnumbers.RemoveAt(___);\n```",
      ],
    },
    {
      id: "count",
      title: "Read a list count",
      prompt: "Declare a List<int> named numbers containing 1, 2, 3. Read its Count into int result.",
      solution: "var numbers = new List<int> { 1, 2, 3 };\nint result = numbers.Count;",
      checks: ["result == 3"],
      rules: [
        {"kind":"SimpleMemberAccessExpression","message":"Use the Count property without parentheses.","token":"Count"},
      ],
      hints: [
        "List uses Count rather than Length.",
        "Use the Count property without parentheses.",
        "Complete this form:\n\n```csharp\nvar numbers = new List<int> { 1, 2, 3 };\nint result = numbers.___;\n```",
      ],
    },
    {
      id: "contains",
      title: "Check list membership",
      prompt: "Declare a List<int> named numbers containing 2, 4, 6. Use Contains to check for 4 in bool result.",
      solution: "var numbers = new List<int> { 2, 4, 6 };\nbool result = numbers.Contains(4);",
      checks: ["result"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Contains with the required arguments.","token":"Contains"},
      ],
      hints: [
        "Contains returns whether an equal element exists.",
        "Call Contains with the required arguments.",
        "Complete this form:\n\n```csharp\nvar numbers = new List<int> { 2, 4, 6 };\nbool result = numbers.___(4);\n```",
      ],
    },
    {
      id: "clear",
      title: "Clear a list",
      prompt: "Declare a List<int> named numbers containing 1 and 2. Remove all elements using Clear.",
      solution: "var numbers = new List<int> { 1, 2 };\nnumbers.Clear();",
      checks: ["numbers.Count == 0"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Clear with the required arguments.","token":"Clear"},
      ],
      hints: [
        "Clear takes no arguments.",
        "Call Clear with the required arguments.",
        "Complete this form:\n\n```csharp\nvar numbers = new List<int> { 1, 2 };\nnumbers.___();\n```",
      ],
    },
    {
      id: "to-array",
      title: "Convert a list to an array",
      prompt: "Declare a List<int> named numbers containing 1 and 2. Call ToArray to create int[] result.",
      solution: "var numbers = new List<int> { 1, 2 };\nint[] result = numbers.ToArray();",
      checks: ["result.SequenceEqual(new[] { 1, 2 })"],
      rules: [
        {"kind":"InvocationExpression","message":"Call ToArray with the required arguments.","token":"ToArray"},
      ],
      hints: [
        "ToArray copies list elements to an array.",
        "Call ToArray with the required arguments.",
        "Complete this form:\n\n```csharp\nvar numbers = new List<int> { 1, 2 };\nint[] result = numbers.___();\n```",
      ],
    },
    {
      id: "dictionary",
      title: "Create a dictionary",
      prompt: "Declare Dictionary<string, int> scores initialized to a new empty dictionary.",
      solution: "Dictionary<string, int> scores = new Dictionary<string, int>();",
      checks: ["scores.Count == 0"],
      rules: [
        {"kind":"VariableDeclarator","message":"Declare scores using Dictionary<string,int>.","name":"scores","type":"Dictionary<string,int>"},
      ],
      hints: [
        "The key type comes before the value type.",
        "Declare scores using Dictionary<string,int>.",
        "Complete this form:\n\n```csharp\nDictionary<string, int> scores = new Dictionary<___, ___>();\n```",
      ],
    },
    {
      id: "dictionary-add",
      title: "Add a dictionary entry",
      prompt: "Declare a new Dictionary<string, int> named scores. Add key \"Ada\" with value 10 using Add.",
      solution: "var scores = new Dictionary<string, int>();\nscores.Add(\"Ada\", 10);",
      checks: ["scores.Count == 1 && scores[\"Ada\"] == 10"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Add with the required arguments.","token":"Add"},
      ],
      hints: [
        "Dictionary.Add takes a key and a value.",
        "Call Add with the required arguments.",
        "Complete this form:\n\n```csharp\nvar scores = new Dictionary<string, int>();\nscores.Add(\"___\", ___);\n```",
      ],
    },
    {
      id: "dictionary-initializer",
      title: "Initialize dictionary entries",
      prompt: "Declare a Dictionary<string, int> named scores using an initializer with { \"Ada\", 10 } and { \"Lin\", 20 }.",
      solution: "var scores = new Dictionary<string, int> { { \"Ada\", 10 }, { \"Lin\", 20 } };",
      checks: ["scores.Count == 2 && scores[\"Ada\"] == 10 && scores[\"Lin\"] == 20"],
      rules: [
        {"kind":"ComplexElementInitializerExpression","message":"Use nested braces for each key/value pair."},
      ],
      hints: [
        "Each inner initializer contains a key and a value.",
        "Use nested braces for each key/value pair.",
        "Complete this form:\n\n```csharp\nvar scores = new Dictionary<string, int> { { \"___\", ___ }, { \"___\", ___ } };\n```",
      ],
    },
    {
      id: "index-initializer",
      title: "Use dictionary index initializers",
      prompt: "Declare a Dictionary<string, int> named scores initialized using [\"Ada\"] = 10.",
      solution: "var scores = new Dictionary<string, int> { [\"Ada\"] = 10 };",
      checks: ["scores.Count == 1 && scores[\"Ada\"] == 10"],
      rules: [
        {"kind":"ImplicitElementAccess","message":"Use [key] = value inside the initializer."},
      ],
      hints: [
        "Index initializers use assignment syntax.",
        "Use [key] = value inside the initializer.",
        "Complete this form:\n\n```csharp\nvar scores = new Dictionary<string, int> { [\"___\"] = ___ };\n```",
      ],
    },
    {
      id: "dictionary-update",
      title: "Update a dictionary value",
      prompt: "Declare scores as a Dictionary<string, int> with \"Ada\" equal to 1. Use the indexer to change it to 5.",
      solution: "var scores = new Dictionary<string, int> { { \"Ada\", 1 } };\nscores[\"Ada\"] = 5;",
      checks: ["scores[\"Ada\"] == 5"],
      rules: [
        {"kind":"SimpleAssignmentExpression","message":"Assign to scores[\"Ada\"]."},
      ],
      hints: [
        "The indexer can overwrite an existing value.",
        "Assign to scores[\"Ada\"].",
        "Complete this form:\n\n```csharp\nvar scores = new Dictionary<string, int> { { \"Ada\", 1 } };\nscores[\"___\"] = ___;\n```",
      ],
    },
    {
      id: "contains-key",
      title: "Check a dictionary key",
      prompt: "Declare scores with \"Ada\" equal to 10. Use ContainsKey(\"Ada\") to declare bool found.",
      solution: "var scores = new Dictionary<string, int> { { \"Ada\", 10 } };\nbool found = scores.ContainsKey(\"Ada\");",
      checks: ["found"],
      rules: [
        {"kind":"InvocationExpression","message":"Call ContainsKey with the required arguments.","token":"ContainsKey"},
      ],
      hints: [
        "ContainsKey checks keys rather than values.",
        "Call ContainsKey with the required arguments.",
        "Complete this form:\n\n```csharp\nvar scores = new Dictionary<string, int> { { \"Ada\", 10 } };\nbool found = scores.___(\"Ada\");\n```",
      ],
    },
    {
      id: "try-get",
      title: "Read a dictionary safely",
      prompt: "Declare scores with \"Ada\" equal to 10. Call TryGetValue(\"Ada\", out int value), storing its bool in found.",
      solution: "var scores = new Dictionary<string, int> { { \"Ada\", 10 } };\nbool found = scores.TryGetValue(\"Ada\", out int value);",
      checks: ["found && value == 10"],
      rules: [
        {"kind":"InvocationExpression","message":"Call TryGetValue with the required arguments.","token":"TryGetValue"},
        {"kind":"DeclarationExpression","message":"Declare value inline with out int value."},
      ],
      hints: [
        "TryGetValue returns success and writes the value through out.",
        "Call TryGetValue with the required arguments. Declare value inline with out int value.",
        "Complete this form:\n\n```csharp\nvar scores = new Dictionary<string, int> { { \"Ada\", 10 } };\nbool found = scores.TryGetValue(\"Ada\", out int ___);\n```",
      ],
    },
    {
      id: "dictionary-remove",
      title: "Remove a dictionary key",
      prompt: "Declare scores with \"Ada\" equal to 10. Use Remove(\"Ada\") and store its bool in removed.",
      solution: "var scores = new Dictionary<string, int> { { \"Ada\", 10 } };\nbool removed = scores.Remove(\"Ada\");",
      checks: ["removed && scores.Count == 0"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Remove with the required arguments.","token":"Remove"},
      ],
      hints: [
        "Dictionary.Remove takes the key.",
        "Call Remove with the required arguments.",
        "Complete this form:\n\n```csharp\nvar scores = new Dictionary<string, int> { { \"Ada\", 10 } };\nbool removed = scores.___(\"Ada\");\n```",
      ],
    },
    {
      id: "new-list-practice",
      title: "Create a list: another example",
      prompt: "Declare List<int> readings initialized to a new empty List<int>.",
      solution: "List<int> readings = new List<int>();",
      checks: ["readings.Count == 0"],
      rules: [
        {"kind":"VariableDeclarator","message":"Declare readings using List<int>.","name":"readings","type":"List<int>"},
      ],
      hints: [
        "The element type goes inside angle brackets.",
        "Declare readings using List<int>.",
        "Complete this form:\n\n```csharp\nList<int> readings = new List<___>();\n```",
      ],
    },
    {
      id: "list-initializer-practice",
      title: "Initialize a list: another example",
      prompt: "Declare a List<string> named namesSample initialized with \"Ada\" and \"Lin\" using braces.",
      solution: "List<string> namesSample = new List<string> { \"Ada\", \"Lin\" };",
      checks: ["namesSample.SequenceEqual(new[] { \"Ada\", \"Lin\" })"],
      rules: [
        {"kind":"CollectionInitializerExpression","message":"Put the initial elements in braces after new List<string>."},
      ],
      hints: [
        "A collection initializer calls Add for each item.",
        "Put the initial elements in braces after new List<string>.",
        "Complete this form:\n\n```csharp\nList<string> namesSample = new List<string> { \"___\", \"___\" };\n```",
      ],
    },
    {
      id: "target-new-practice",
      title: "Use target-typed new: another example",
      prompt: "Declare List<int> readings using new() and an initializer containing 1 and 2.",
      solution: "List<int> readings = new() { 1, 2 };",
      checks: ["readings.SequenceEqual(new[] { 1, 2 })"],
      rules: [
        {"kind":"ImplicitObjectCreationExpression","message":"Use new() without repeating List<int>."},
      ],
      hints: [
        "The declared type supplies the constructed type.",
        "Use new() without repeating List<int>.",
        "Complete this form:\n\n```csharp\nList<int> readings = new() { ___, ___ };\n```",
      ],
    },
    {
      id: "add-practice",
      title: "Add to a list: another example",
      prompt: "Declare a new List<int> named readings. Add 7 using Add.",
      solution: "var readings = new List<int>();\nreadings.Add(7);",
      checks: ["readings.SequenceEqual(new[] { 7 })"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Add with the required arguments.","token":"Add"},
      ],
      hints: [
        "Add appends one element.",
        "Call Add with the required arguments.",
        "Complete this form:\n\n```csharp\nvar readings = new List<int>();\nreadings.___(7);\n```",
      ],
    },
    {
      id: "add-range-practice",
      title: "Add several elements: another example",
      prompt: "Declare a new List<int> named readings. Use AddRange with new[] { 1, 2, 3 }.",
      solution: "var readings = new List<int>();\nreadings.AddRange(new[] { 1, 2, 3 });",
      checks: ["readings.SequenceEqual(new[] { 1, 2, 3 })"],
      rules: [
        {"kind":"InvocationExpression","message":"Call AddRange with the required arguments.","token":"AddRange"},
      ],
      hints: [
        "AddRange takes a collection rather than separate items.",
        "Call AddRange with the required arguments.",
        "Complete this form:\n\n```csharp\nvar readings = new List<int>();\nreadings.___(new[] { 1, 2, 3 });\n```",
      ],
    },
    {
      id: "insert-practice",
      title: "Insert at an index: another example",
      prompt: "Declare a List<int> named readings containing 1 and 3. Insert 2 at index 1.",
      solution: "var readings = new List<int> { 1, 3 };\nreadings.Insert(1, 2);",
      checks: ["readings.SequenceEqual(new[] { 1, 2, 3 })"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Insert with the required arguments.","token":"Insert"},
      ],
      hints: [
        "Insert takes the index before the new value.",
        "Call Insert with the required arguments.",
        "Complete this form:\n\n```csharp\nvar readings = new List<int> { 1, 3 };\nreadings.Insert(___, ___);\n```",
      ],
    },
    {
      id: "remove-practice",
      title: "Remove a value: another example",
      prompt: "Declare a List<int> named readings containing 1, 2, 3. Remove the value 2 using Remove.",
      solution: "var readings = new List<int> { 1, 2, 3 };\nreadings.Remove(2);",
      checks: ["readings.SequenceEqual(new[] { 1, 3 })"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Remove with the required arguments.","token":"Remove"},
      ],
      hints: [
        "Remove takes a value rather than an index.",
        "Call Remove with the required arguments.",
        "Complete this form:\n\n```csharp\nvar readings = new List<int> { 1, 2, 3 };\nreadings.___(2);\n```",
      ],
    },
    {
      id: "remove-at-practice",
      title: "Remove by index: another example",
      prompt: "Declare a List<int> named readings containing 10, 20, 30. Remove its first element using RemoveAt.",
      solution: "var readings = new List<int> { 10, 20, 30 };\nreadings.RemoveAt(0);",
      checks: ["readings.SequenceEqual(new[] { 20, 30 })"],
      rules: [
        {"kind":"InvocationExpression","message":"Call RemoveAt with the required arguments.","token":"RemoveAt"},
      ],
      hints: [
        "The first element has index zero.",
        "Call RemoveAt with the required arguments.",
        "Complete this form:\n\n```csharp\nvar readings = new List<int> { 10, 20, 30 };\nreadings.RemoveAt(___);\n```",
      ],
    },
    {
      id: "count-practice",
      title: "Read a list count: another example",
      prompt: "Declare a List<int> named readings containing 1, 2, 3. Read its Count into int result.",
      solution: "var readings = new List<int> { 1, 2, 3 };\nint result = readings.Count;",
      checks: ["result == 3"],
      rules: [
        {"kind":"SimpleMemberAccessExpression","message":"Use the Count property without parentheses.","token":"Count"},
      ],
      hints: [
        "List uses Count rather than Length.",
        "Use the Count property without parentheses.",
        "Complete this form:\n\n```csharp\nvar readings = new List<int> { 1, 2, 3 };\nint result = readings.___;\n```",
      ],
    },
    {
      id: "contains-practice",
      title: "Check list membership: another example",
      prompt: "Declare a List<int> named readings containing 2, 4, 6. Use Contains to check for 4 in bool result.",
      solution: "var readings = new List<int> { 2, 4, 6 };\nbool result = readings.Contains(4);",
      checks: ["result"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Contains with the required arguments.","token":"Contains"},
      ],
      hints: [
        "Contains returns whether an equal element exists.",
        "Call Contains with the required arguments.",
        "Complete this form:\n\n```csharp\nvar readings = new List<int> { 2, 4, 6 };\nbool result = readings.___(4);\n```",
      ],
    },
    {
      id: "clear-practice",
      title: "Clear a list: another example",
      prompt: "Declare a List<int> named readings containing 1 and 2. Remove all elements using Clear.",
      solution: "var readings = new List<int> { 1, 2 };\nreadings.Clear();",
      checks: ["readings.Count == 0"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Clear with the required arguments.","token":"Clear"},
      ],
      hints: [
        "Clear takes no arguments.",
        "Call Clear with the required arguments.",
        "Complete this form:\n\n```csharp\nvar readings = new List<int> { 1, 2 };\nreadings.___();\n```",
      ],
    },
    {
      id: "to-array-practice",
      title: "Convert a list to an array: another example",
      prompt: "Declare a List<int> named readings containing 1 and 2. Call ToArray to create int[] result.",
      solution: "var readings = new List<int> { 1, 2 };\nint[] result = readings.ToArray();",
      checks: ["result.SequenceEqual(new[] { 1, 2 })"],
      rules: [
        {"kind":"InvocationExpression","message":"Call ToArray with the required arguments.","token":"ToArray"},
      ],
      hints: [
        "ToArray copies list elements to an array.",
        "Call ToArray with the required arguments.",
        "Complete this form:\n\n```csharp\nvar readings = new List<int> { 1, 2 };\nint[] result = readings.___();\n```",
      ],
    },
    {
      id: "dictionary-practice",
      title: "Create a dictionary: another example",
      prompt: "Declare Dictionary<string, int> points initialized to a new empty dictionary.",
      solution: "Dictionary<string, int> points = new Dictionary<string, int>();",
      checks: ["points.Count == 0"],
      rules: [
        {"kind":"VariableDeclarator","message":"Declare points using Dictionary<string,int>.","name":"points","type":"Dictionary<string,int>"},
      ],
      hints: [
        "The key type comes before the value type.",
        "Declare points using Dictionary<string,int>.",
        "Complete this form:\n\n```csharp\nDictionary<string, int> points = new Dictionary<___, ___>();\n```",
      ],
    },
    {
      id: "dictionary-add-practice",
      title: "Add a dictionary entry: another example",
      prompt: "Declare a new Dictionary<string, int> named points. Add key \"Ada\" with value 10 using Add.",
      solution: "var points = new Dictionary<string, int>();\npoints.Add(\"Ada\", 10);",
      checks: ["points.Count == 1 && points[\"Ada\"] == 10"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Add with the required arguments.","token":"Add"},
      ],
      hints: [
        "Dictionary.Add takes a key and a value.",
        "Call Add with the required arguments.",
        "Complete this form:\n\n```csharp\nvar points = new Dictionary<string, int>();\npoints.Add(\"___\", ___);\n```",
      ],
    },
    {
      id: "dictionary-initializer-practice",
      title: "Initialize dictionary entries: another example",
      prompt: "Declare a Dictionary<string, int> named points using an initializer with { \"Ada\", 10 } and { \"Lin\", 20 }.",
      solution: "var points = new Dictionary<string, int> { { \"Ada\", 10 }, { \"Lin\", 20 } };",
      checks: ["points.Count == 2 && points[\"Ada\"] == 10 && points[\"Lin\"] == 20"],
      rules: [
        {"kind":"ComplexElementInitializerExpression","message":"Use nested braces for each key/value pair."},
      ],
      hints: [
        "Each inner initializer contains a key and a value.",
        "Use nested braces for each key/value pair.",
        "Complete this form:\n\n```csharp\nvar points = new Dictionary<string, int> { { \"___\", ___ }, { \"___\", ___ } };\n```",
      ],
    },
    {
      id: "index-initializer-practice",
      title: "Use dictionary index initializers: another example",
      prompt: "Declare a Dictionary<string, int> named points initialized using [\"Ada\"] = 10.",
      solution: "var points = new Dictionary<string, int> { [\"Ada\"] = 10 };",
      checks: ["points.Count == 1 && points[\"Ada\"] == 10"],
      rules: [
        {"kind":"ImplicitElementAccess","message":"Use [key] = value inside the initializer."},
      ],
      hints: [
        "Index initializers use assignment syntax.",
        "Use [key] = value inside the initializer.",
        "Complete this form:\n\n```csharp\nvar points = new Dictionary<string, int> { [\"___\"] = ___ };\n```",
      ],
    },
    {
      id: "dictionary-update-practice",
      title: "Update a dictionary value: another example",
      prompt: "Declare points as a Dictionary<string, int> with \"Ada\" equal to 1. Use the indexer to change it to 5.",
      solution: "var points = new Dictionary<string, int> { { \"Ada\", 1 } };\npoints[\"Ada\"] = 5;",
      checks: ["points[\"Ada\"] == 5"],
      rules: [
        {"kind":"SimpleAssignmentExpression","message":"Assign to points[\"Ada\"]."},
      ],
      hints: [
        "The indexer can overwrite an existing value.",
        "Assign to points[\"Ada\"].",
        "Complete this form:\n\n```csharp\nvar points = new Dictionary<string, int> { { \"Ada\", 1 } };\npoints[\"___\"] = ___;\n```",
      ],
    },
    {
      id: "contains-key-practice",
      title: "Check a dictionary key: another example",
      prompt: "Declare points with \"Ada\" equal to 10. Use ContainsKey(\"Ada\") to declare bool found.",
      solution: "var points = new Dictionary<string, int> { { \"Ada\", 10 } };\nbool found = points.ContainsKey(\"Ada\");",
      checks: ["found"],
      rules: [
        {"kind":"InvocationExpression","message":"Call ContainsKey with the required arguments.","token":"ContainsKey"},
      ],
      hints: [
        "ContainsKey checks keys rather than values.",
        "Call ContainsKey with the required arguments.",
        "Complete this form:\n\n```csharp\nvar points = new Dictionary<string, int> { { \"Ada\", 10 } };\nbool found = points.___(\"Ada\");\n```",
      ],
    },
    {
      id: "try-get-practice",
      title: "Read a dictionary safely: another example",
      prompt: "Declare points with \"Ada\" equal to 10. Call TryGetValue(\"Ada\", out int value), storing its bool in found.",
      solution: "var points = new Dictionary<string, int> { { \"Ada\", 10 } };\nbool found = points.TryGetValue(\"Ada\", out int value);",
      checks: ["found && value == 10"],
      rules: [
        {"kind":"InvocationExpression","message":"Call TryGetValue with the required arguments.","token":"TryGetValue"},
        {"kind":"DeclarationExpression","message":"Declare value inline with out int value."},
      ],
      hints: [
        "TryGetValue returns success and writes the value through out.",
        "Call TryGetValue with the required arguments. Declare value inline with out int value.",
        "Complete this form:\n\n```csharp\nvar points = new Dictionary<string, int> { { \"Ada\", 10 } };\nbool found = points.TryGetValue(\"Ada\", out int ___);\n```",
      ],
    },
    {
      id: "dictionary-remove-practice",
      title: "Remove a dictionary key: another example",
      prompt: "Declare points with \"Ada\" equal to 10. Use Remove(\"Ada\") and store its bool in removed.",
      solution: "var points = new Dictionary<string, int> { { \"Ada\", 10 } };\nbool removed = points.Remove(\"Ada\");",
      checks: ["removed && points.Count == 0"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Remove with the required arguments.","token":"Remove"},
      ],
      hints: [
        "Dictionary.Remove takes the key.",
        "Call Remove with the required arguments.",
        "Complete this form:\n\n```csharp\nvar points = new Dictionary<string, int> { { \"Ada\", 10 } };\nbool removed = points.___(\"Ada\");\n```",
      ],
    },
  ],
};

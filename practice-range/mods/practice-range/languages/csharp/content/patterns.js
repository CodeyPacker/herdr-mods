/** @type {import("../types.js").Topic} */
export const patterns = {
  id: "patterns",
  title: "Advanced patterns",
  description: "Recursive, positional, list, and compound pattern syntax.",
  level: "advanced",
  exercises: [
    {
      id: "property-relational",
      title: "Combine property and relational patterns",
      prompt: "Declare string text = \"hello\". Declare bool matches using text is { Length: >= 3 and <= 8 }.",
      solution: "string text = \"hello\";\nbool matches = text is { Length: >= 3 and <= 8 };",
      checks: ["matches"],
      rules: [
        {"kind":"AndPattern","message":"Place the combined relational pattern after the property's colon."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "Place the combined relational pattern after the property's colon.",
        "Complete this form:\n\n```csharp\nstring text = \"hello\";\nbool matches = text is { Length: >= 3 and ___ };\n```",
      ],
    },
    {
      id: "extended-property",
      title: "Use an extended property pattern",
      prompt: "Using supplied Person and Address, declare person = new Person(new Address(\"Denver\")). Match person is { Address.City: \"Denver\" } into bool matches.",
      solution: "var person = new Person(new Address(\"Denver\"));\nbool matches = person is { Address.City: \"Denver\" };",
      checks: ["matches"],
      rules: [
        {"kind":"PropertyPatternClause","message":"An extended property pattern uses a dotted path before the colon."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "An extended property pattern uses a dotted path before the colon.",
        "Complete this form:\n\n```csharp\nvar person = new Person(new Address(\"Denver\"));\nbool matches = person is { Address.___: \"Denver\" };\n```",
      ],
      declarations: "public record Address(string City);\npublic record Person(Address Address);",
    },
    {
      id: "recursive",
      title: "Nest property patterns",
      prompt: "Using supplied Person and Address, declare person = new Person(new Address(\"Denver\")). Match person is { Address: { City: \"Denver\" } } into bool matches.",
      solution: "var person = new Person(new Address(\"Denver\"));\nbool matches = person is { Address: { City: \"Denver\" } };",
      checks: ["matches"],
      rules: [
        {"kind":"PropertyPatternClause","min":2,"message":"Put a second property pattern inside the Address property pattern."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "Each pair of braces matches properties of the value at that level.",
        "Complete this form:\n\n```csharp\nvar person = new Person(new Address(\"Denver\"));\nbool matches = person is { Address: { ___: \"Denver\" } };\n```",
      ],
      declarations: "public record Address(string City);\npublic record Person(Address Address);",
    },
    {
      id: "positional",
      title: "Match a positional record",
      prompt: "Using the supplied Point record, declare object item = new Point(2, 3). Declare bool matches using item is Point(2, 3).",
      solution: "object item = new Point(2, 3);\nbool matches = item is Point(2, 3);",
      checks: ["matches"],
      rules: [
        {"kind":"PositionalPatternClause","message":"Put positional patterns after Point in parentheses, in constructor parameter order."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "Put positional patterns after Point in parentheses, in constructor parameter order.",
        "Complete this form:\n\n```csharp\nobject item = new Point(2, 3);\nbool matches = item is Point(___, ___);\n```",
      ],
      declarations: "public record Point(int X, int Y);",
    },
    {
      id: "positional-discard",
      title: "Discard a positional element",
      prompt: "Using supplied Point, declare object item = new Point(2, 9). Declare bool matches using item is Point(2, _).",
      solution: "object item = new Point(2, 9);\nbool matches = item is Point(2, _);",
      checks: ["matches"],
      rules: [
        {"kind":"DiscardPattern","message":"Use _ for the positional element whose value you do not need."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "Use _ for the positional element whose value you do not need.",
        "Complete this form:\n\n```csharp\nobject item = new Point(2, 9);\nbool matches = item is Point(2, ___);\n```",
      ],
      declarations: "public record Point(int X, int Y);",
    },
    {
      id: "tuple",
      title: "Match tuple components",
      prompt: "Declare var point = (2, 3). Declare bool matches using point is (> 0, > 0).",
      solution: "var point = (2, 3);\nbool matches = point is (> 0, > 0);",
      checks: ["matches"],
      rules: [
        {"kind":"PositionalPatternClause","message":"Put one pattern for each tuple component inside parentheses."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "Put one pattern for each tuple component inside parentheses.",
        "Complete this form:\n\n```csharp\nvar point = (2, 3);\nbool matches = point is (___, ___);\n```",
      ],
    },
    {
      id: "list-binding",
      title: "Capture a list element",
      prompt: "Declare int[] values = { 4, 5 }. Declare int result = 0. Use if (values is [var first, _]) to assign first to result.",
      solution: "int[] values = { 4, 5 };\nint result = 0;\nif (values is [var first, _]) result = first;",
      checks: ["result == 4"],
      rules: [
        {"kind":"VarPattern","message":"A var pattern names the element matched at that list position."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "A var pattern names the element matched at that list position.",
        "Complete this form:\n\n```csharp\nint[] values = { 4, 5 };\nint result = 0;\nif (values is [var first, _]) result = ___;\n```",
      ],
    },
    {
      id: "slice-binding",
      title: "Capture a list slice",
      prompt: "Declare int[] values = { 1, 2, 3 }, int[] tail = Array.Empty<int>(). Match [1, .. var rest] in an if and assign rest to tail.",
      solution: "int[] values = { 1, 2, 3 };\nint[] tail = Array.Empty<int>();\nif (values is [1, .. var rest]) tail = rest;",
      checks: ["tail.SequenceEqual(new[] { 2, 3 })"],
      rules: [
        {"kind":"SlicePattern","message":"Put var rest immediately after .. to capture the remaining slice."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "Put var rest immediately after .. to capture the remaining slice.",
        "Complete this form:\n\n```csharp\nint[] values = { 1, 2, 3 };\nint[] tail = Array.Empty<int>();\nif (values is [1, .. var rest]) tail = ___;\n```",
      ],
    },
    {
      id: "not-parenthesized",
      title: "Negate a compound pattern",
      prompt: "Declare int item = 5. Declare bool matches using item is not (1 or 2).",
      solution: "int item = 5;\nbool matches = item is not (1 or 2);",
      checks: ["matches"],
      rules: [
        {"kind":"ParenthesizedPattern","message":"Parentheses group the or pattern before not is applied."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "Parentheses group the or pattern before not is applied.",
        "Complete this form:\n\n```csharp\nint item = 5;\nbool matches = item is not (___ or ___);\n```",
      ],
    },
    {
      id: "and-binding",
      title: "Combine a type and relational pattern",
      prompt: "Declare object item = 7. Declare bool matches using item is int and > 0.",
      solution: "object item = 7;\nbool matches = item is int and > 0;",
      checks: ["matches"],
      rules: [
        {"kind":"AndPattern","message":"The int type pattern narrows the input for the relational pattern."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "The int type pattern narrows the input for the relational pattern.",
        "Complete this form:\n\n```csharp\nobject item = 7;\nbool matches = item is int and ___;\n```",
      ],
    },
    {
      id: "or-types",
      title: "Match either of two types",
      prompt: "Declare object item = \"Ada\". Declare bool matches using item is string or int.",
      solution: "object item = \"Ada\";\nbool matches = item is string or int;",
      checks: ["matches"],
      rules: [
        {"kind":"OrPattern","message":"Use the pattern keyword or rather than the boolean operator ||."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "Use the pattern keyword or rather than the boolean operator ||.",
        "Complete this form:\n\n```csharp\nobject item = \"Ada\";\nbool matches = item is string or ___;\n```",
      ],
    },
    {
      id: "var",
      title: "Bind any value",
      prompt: "Declare int item = 6 and int result = 0. Use if (item is var captured) to assign captured to result.",
      solution: "int item = 6, result = 0;\nif (item is var captured) result = captured;",
      checks: ["result == 6"],
      rules: [
        {"kind":"VarPattern","message":"A var pattern always matches and introduces a variable."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "A var pattern always matches and introduces a variable.",
        "Complete this form:\n\n```csharp\nint item = 6, result = 0;\nif (item is var captured) result = ___;\n```",
      ],
    },
    {
      id: "switch-constant",
      title: "Use constant switch patterns",
      prompt: "Declare string command = \"go\". Use a switch expression with \"go\" => 1, \"stop\" => 0, and _ => -1 into int result.",
      solution: "string command = \"go\";\nint result = command switch { \"go\" => 1, \"stop\" => 0, _ => -1 };",
      checks: ["result == 1"],
      rules: [
        {"kind":"SwitchExpression","message":"Each arm has a constant pattern, =>, and result expression."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "Each arm has a constant pattern, =>, and result expression.",
        "Complete this form:\n\n```csharp\nstring command = \"go\";\nint result = command switch { \"go\" => ___, \"stop\" => 0, _ => -1 };\n```",
      ],
    },
    {
      id: "switch-guard",
      title: "Guard a switch expression arm",
      prompt: "Declare object item = 7. Declare string result using item switch { int number when number > 0 => \"positive\", _ => \"other\" }.",
      solution: "object item = 7;\nstring result = item switch { int number when number > 0 => \"positive\", _ => \"other\" };",
      checks: ["result == \"positive\""],
      rules: [
        {"kind":"WhenClause","message":"Add when after the declaration pattern and before =>."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "Add when after the declaration pattern and before =>.",
        "Complete this form:\n\n```csharp\nobject item = 7;\nstring result = item switch { int number when ___ => \"positive\", _ => \"other\" };\n```",
      ],
    },
    {
      id: "capture-property",
      title: "Capture a property value",
      prompt: "Declare string text = \"hello\" and int result = 0. Match text is { Length: var size } and assign size to result.",
      solution: "string text = \"hello\";\nint result = 0;\nif (text is { Length: var size }) result = size;",
      checks: ["result == 5"],
      rules: [
        {"kind":"VarPattern","message":"Use var size as the pattern for the Length property."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "Use var size as the pattern for the Length property.",
        "Complete this form:\n\n```csharp\nstring text = \"hello\";\nint result = 0;\nif (text is { Length: var size }) result = ___;\n```",
      ],
    },
    {
      id: "nullable",
      title: "Match a nullable value",
      prompt: "Declare int? item = 8 and int result = 0. Use if (item is int number) to assign number to result.",
      solution: "int? item = 8;\nint result = 0;\nif (item is int number) result = number;",
      checks: ["result == 8"],
      rules: [
        {"kind":"DeclarationPattern","message":"An int declaration pattern matches and unwraps a non-null int?."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "An int declaration pattern matches and unwraps a non-null int?.",
        "Complete this form:\n\n```csharp\nint? item = 8;\nint result = 0;\nif (item is int number) result = ___;\n```",
      ],
    },
    {
      id: "empty-property",
      title: "Match any non-null object",
      prompt: "Declare object? item = \"Ada\". Declare bool present using item is { }.",
      solution: "object? item = \"Ada\";\nbool present = item is { };",
      checks: ["present"],
      rules: [
        {"kind":"PropertyPatternClause","message":"An empty property pattern matches a non-null value."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "An empty property pattern matches a non-null value.",
        "Complete this form:\n\n```csharp\nobject? item = \"Ada\";\nbool present = item is { ___ };\n```",
      ],
    },
    {
      id: "var-fallback",
      title: "Name a switch fallback value",
      prompt: "Declare int item = 5. Declare int result using item switch { 0 => 0, var other => other * 2 }.",
      solution: "int item = 5;\nint result = item switch { 0 => 0, var other => other * 2 };",
      checks: ["result == 10"],
      rules: [
        {"kind":"VarPattern","message":"A var pattern can both match the fallback and name its value."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "A var pattern can both match the fallback and name its value.",
        "Complete this form:\n\n```csharp\nint item = 5;\nint result = item switch { 0 => 0, var other => ___ };\n```",
      ],
    },
    {
      id: "list-ends",
      title: "Match both ends of a list",
      prompt: "Declare int[] values = { 1, 4, 5, 9 }. Declare bool matches using values is [1, .., 9].",
      solution: "int[] values = { 1, 4, 5, 9 };\nbool matches = values is [1, .., 9];",
      checks: ["matches"],
      rules: [
        {"kind":"SlicePattern","message":"Place .. between the first and final element patterns."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "Place .. between the first and final element patterns.",
        "Complete this form:\n\n```csharp\nint[] values = { 1, 4, 5, 9 };\nbool matches = values is [1, ___, 9];\n```",
      ],
    },
    {
      id: "enum",
      title: "Match enum values",
      prompt: "Using supplied enum Status, declare Status item = Status.Active. Use a switch expression mapping Pending to \"wait\", Active to \"run\", and _ to \"unknown\" into string result.",
      solution: "Status item = Status.Active;\nstring result = item switch { Status.Pending => \"wait\", Status.Active => \"run\", _ => \"unknown\" };",
      checks: ["result == \"run\""],
      rules: [
        {"kind":"SwitchExpression","message":"Qualify each enum constant with its type in the switch arm."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "Qualify each enum constant with its type in the switch arm.",
        "Complete this form:\n\n```csharp\nStatus item = Status.Active;\nstring result = item switch { Status.Pending => \"wait\", Status.Active => \"___\", _ => \"unknown\" };\n```",
      ],
      declarations: "public enum Status { Pending, Active }",
    },
    {
      id: "property-relational-practice",
      title: "Combine property and relational patterns: another example",
      prompt: "Declare string message = \"hello\". Declare bool matches using message is { Length: >= 3 and <= 8 }.",
      solution: "string message = \"hello\";\nbool matches = message is { Length: >= 3 and <= 8 };",
      checks: ["matches"],
      rules: [
        {"kind":"AndPattern","message":"Place the combined relational pattern after the property's colon."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "Place the combined relational pattern after the property's colon.",
        "Complete this form:\n\n```csharp\nstring message = \"hello\";\nbool matches = message is { Length: >= 3 and ___ };\n```",
      ],
    },
    {
      id: "extended-property-practice",
      title: "Use an extended property pattern: another example",
      prompt: "Using supplied Person and Address, declare member = new Person(new Address(\"Denver\")). Match member is { Address.City: \"Denver\" } into bool matches.",
      solution: "var member = new Person(new Address(\"Denver\"));\nbool matches = member is { Address.City: \"Denver\" };",
      checks: ["matches"],
      rules: [
        {"kind":"PropertyPatternClause","message":"An extended property pattern uses a dotted path before the colon."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "An extended property pattern uses a dotted path before the colon.",
        "Complete this form:\n\n```csharp\nvar member = new Person(new Address(\"Denver\"));\nbool matches = member is { Address.___: \"Denver\" };\n```",
      ],
      declarations: "public record Address(string City);\npublic record Person(Address Address);",
    },
    {
      id: "recursive-practice",
      title: "Nest property patterns: another example",
      prompt: "Using supplied Person and Address, declare member = new Person(new Address(\"Denver\")). Match member is { Address: { City: \"Denver\" } } into bool matches.",
      solution: "var member = new Person(new Address(\"Denver\"));\nbool matches = member is { Address: { City: \"Denver\" } };",
      checks: ["matches"],
      rules: [
        {"kind":"PropertyPatternClause","min":2,"message":"Put a second property pattern inside the Address property pattern."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "Each pair of braces matches properties of the value at that level.",
        "Complete this form:\n\n```csharp\nvar member = new Person(new Address(\"Denver\"));\nbool matches = member is { Address: { ___: \"Denver\" } };\n```",
      ],
      declarations: "public record Address(string City);\npublic record Person(Address Address);",
    },
    {
      id: "positional-practice",
      title: "Match a positional record: another example",
      prompt: "Using the supplied Point record, declare object element = new Point(2, 3). Declare bool matches using element is Point(2, 3).",
      solution: "object element = new Point(2, 3);\nbool matches = element is Point(2, 3);",
      checks: ["matches"],
      rules: [
        {"kind":"PositionalPatternClause","message":"Put positional patterns after Point in parentheses, in constructor parameter order."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "Put positional patterns after Point in parentheses, in constructor parameter order.",
        "Complete this form:\n\n```csharp\nobject element = new Point(2, 3);\nbool matches = element is Point(___, ___);\n```",
      ],
      declarations: "public record Point(int X, int Y);",
    },
    {
      id: "positional-discard-practice",
      title: "Discard a positional element: another example",
      prompt: "Using supplied Point, declare object element = new Point(2, 9). Declare bool matches using element is Point(2, _).",
      solution: "object element = new Point(2, 9);\nbool matches = element is Point(2, _);",
      checks: ["matches"],
      rules: [
        {"kind":"DiscardPattern","message":"Use _ for the positional element whose value you do not need."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "Use _ for the positional element whose value you do not need.",
        "Complete this form:\n\n```csharp\nobject element = new Point(2, 9);\nbool matches = element is Point(2, ___);\n```",
      ],
      declarations: "public record Point(int X, int Y);",
    },
    {
      id: "tuple-practice",
      title: "Match tuple components: another example",
      prompt: "Declare var location = (2, 3). Declare bool matches using location is (> 0, > 0).",
      solution: "var location = (2, 3);\nbool matches = location is (> 0, > 0);",
      checks: ["matches"],
      rules: [
        {"kind":"PositionalPatternClause","message":"Put one pattern for each tuple component inside parentheses."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "Put one pattern for each tuple component inside parentheses.",
        "Complete this form:\n\n```csharp\nvar location = (2, 3);\nbool matches = location is (___, ___);\n```",
      ],
    },
    {
      id: "list-binding-practice",
      title: "Capture a list element: another example",
      prompt: "Declare int[] samples = { 4, 5 }. Declare int result = 0. Use if (samples is [var first, _]) to assign first to result.",
      solution: "int[] samples = { 4, 5 };\nint result = 0;\nif (samples is [var first, _]) result = first;",
      checks: ["result == 4"],
      rules: [
        {"kind":"VarPattern","message":"A var pattern names the element matched at that list position."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "A var pattern names the element matched at that list position.",
        "Complete this form:\n\n```csharp\nint[] samples = { 4, 5 };\nint result = 0;\nif (samples is [var first, _]) result = ___;\n```",
      ],
    },
    {
      id: "slice-binding-practice",
      title: "Capture a list slice: another example",
      prompt: "Declare int[] samples = { 1, 2, 3 }, int[] tail = Array.Empty<int>(). Match [1, .. var rest] in an if and assign rest to tail.",
      solution: "int[] samples = { 1, 2, 3 };\nint[] tail = Array.Empty<int>();\nif (samples is [1, .. var rest]) tail = rest;",
      checks: ["tail.SequenceEqual(new[] { 2, 3 })"],
      rules: [
        {"kind":"SlicePattern","message":"Put var rest immediately after .. to capture the remaining slice."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "Put var rest immediately after .. to capture the remaining slice.",
        "Complete this form:\n\n```csharp\nint[] samples = { 1, 2, 3 };\nint[] tail = Array.Empty<int>();\nif (samples is [1, .. var rest]) tail = ___;\n```",
      ],
    },
    {
      id: "not-parenthesized-practice",
      title: "Negate a compound pattern: another example",
      prompt: "Declare int element = 5. Declare bool matches using element is not (1 or 2).",
      solution: "int element = 5;\nbool matches = element is not (1 or 2);",
      checks: ["matches"],
      rules: [
        {"kind":"ParenthesizedPattern","message":"Parentheses group the or pattern before not is applied."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "Parentheses group the or pattern before not is applied.",
        "Complete this form:\n\n```csharp\nint element = 5;\nbool matches = element is not (___ or ___);\n```",
      ],
    },
    {
      id: "and-binding-practice",
      title: "Combine a type and relational pattern: another example",
      prompt: "Declare object element = 7. Declare bool matches using element is int and > 0.",
      solution: "object element = 7;\nbool matches = element is int and > 0;",
      checks: ["matches"],
      rules: [
        {"kind":"AndPattern","message":"The int type pattern narrows the input for the relational pattern."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "The int type pattern narrows the input for the relational pattern.",
        "Complete this form:\n\n```csharp\nobject element = 7;\nbool matches = element is int and ___;\n```",
      ],
    },
    {
      id: "or-types-practice",
      title: "Match either of two types: another example",
      prompt: "Declare object element = \"Ada\". Declare bool matches using element is string or int.",
      solution: "object element = \"Ada\";\nbool matches = element is string or int;",
      checks: ["matches"],
      rules: [
        {"kind":"OrPattern","message":"Use the pattern keyword or rather than the boolean operator ||."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "Use the pattern keyword or rather than the boolean operator ||.",
        "Complete this form:\n\n```csharp\nobject element = \"Ada\";\nbool matches = element is string or ___;\n```",
      ],
    },
    {
      id: "var-practice",
      title: "Bind any value: another example",
      prompt: "Declare int element = 6 and int result = 0. Use if (element is var captured) to assign captured to result.",
      solution: "int element = 6, result = 0;\nif (element is var captured) result = captured;",
      checks: ["result == 6"],
      rules: [
        {"kind":"VarPattern","message":"A var pattern always matches and introduces a variable."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "A var pattern always matches and introduces a variable.",
        "Complete this form:\n\n```csharp\nint element = 6, result = 0;\nif (element is var captured) result = ___;\n```",
      ],
    },
    {
      id: "switch-constant-practice",
      title: "Use constant switch patterns: another example",
      prompt: "Declare string commandSample = \"go\". Use a switch expression with \"go\" => 1, \"stop\" => 0, and _ => -1 into int result.",
      solution: "string commandSample = \"go\";\nint result = commandSample switch { \"go\" => 1, \"stop\" => 0, _ => -1 };",
      checks: ["result == 1"],
      rules: [
        {"kind":"SwitchExpression","message":"Each arm has a constant pattern, =>, and result expression."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "Each arm has a constant pattern, =>, and result expression.",
        "Complete this form:\n\n```csharp\nstring commandSample = \"go\";\nint result = commandSample switch { \"go\" => ___, \"stop\" => 0, _ => -1 };\n```",
      ],
    },
    {
      id: "switch-guard-practice",
      title: "Guard a switch expression arm: another example",
      prompt: "Declare object element = 7. Declare string result using element switch { int number when number > 0 => \"positive\", _ => \"other\" }.",
      solution: "object element = 7;\nstring result = element switch { int number when number > 0 => \"positive\", _ => \"other\" };",
      checks: ["result == \"positive\""],
      rules: [
        {"kind":"WhenClause","message":"Add when after the declaration pattern and before =>."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "Add when after the declaration pattern and before =>.",
        "Complete this form:\n\n```csharp\nobject element = 7;\nstring result = element switch { int number when ___ => \"positive\", _ => \"other\" };\n```",
      ],
    },
    {
      id: "capture-property-practice",
      title: "Capture a property value: another example",
      prompt: "Declare string message = \"hello\" and int result = 0. Match message is { Length: var size } and assign size to result.",
      solution: "string message = \"hello\";\nint result = 0;\nif (message is { Length: var size }) result = size;",
      checks: ["result == 5"],
      rules: [
        {"kind":"VarPattern","message":"Use var size as the pattern for the Length property."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "Use var size as the pattern for the Length property.",
        "Complete this form:\n\n```csharp\nstring message = \"hello\";\nint result = 0;\nif (message is { Length: var size }) result = ___;\n```",
      ],
    },
    {
      id: "nullable-practice",
      title: "Match a nullable value: another example",
      prompt: "Declare int? element = 8 and int result = 0. Use if (element is int number) to assign number to result.",
      solution: "int? element = 8;\nint result = 0;\nif (element is int number) result = number;",
      checks: ["result == 8"],
      rules: [
        {"kind":"DeclarationPattern","message":"An int declaration pattern matches and unwraps a non-null int?."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "An int declaration pattern matches and unwraps a non-null int?.",
        "Complete this form:\n\n```csharp\nint? element = 8;\nint result = 0;\nif (element is int number) result = ___;\n```",
      ],
    },
    {
      id: "empty-property-practice",
      title: "Match any non-null object: another example",
      prompt: "Declare object? element = \"Ada\". Declare bool present using element is { }.",
      solution: "object? element = \"Ada\";\nbool present = element is { };",
      checks: ["present"],
      rules: [
        {"kind":"PropertyPatternClause","message":"An empty property pattern matches a non-null value."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "An empty property pattern matches a non-null value.",
        "Complete this form:\n\n```csharp\nobject? element = \"Ada\";\nbool present = element is { ___ };\n```",
      ],
    },
    {
      id: "var-fallback-practice",
      title: "Name a switch fallback value: another example",
      prompt: "Declare int element = 5. Declare int result using element switch { 0 => 0, var other => other * 2 }.",
      solution: "int element = 5;\nint result = element switch { 0 => 0, var other => other * 2 };",
      checks: ["result == 10"],
      rules: [
        {"kind":"VarPattern","message":"A var pattern can both match the fallback and name its value."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "A var pattern can both match the fallback and name its value.",
        "Complete this form:\n\n```csharp\nint element = 5;\nint result = element switch { 0 => 0, var other => ___ };\n```",
      ],
    },
    {
      id: "list-ends-practice",
      title: "Match both ends of a list: another example",
      prompt: "Declare int[] samples = { 1, 4, 5, 9 }. Declare bool matches using samples is [1, .., 9].",
      solution: "int[] samples = { 1, 4, 5, 9 };\nbool matches = samples is [1, .., 9];",
      checks: ["matches"],
      rules: [
        {"kind":"SlicePattern","message":"Place .. between the first and final element patterns."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "Place .. between the first and final element patterns.",
        "Complete this form:\n\n```csharp\nint[] samples = { 1, 4, 5, 9 };\nbool matches = samples is [1, ___, 9];\n```",
      ],
    },
    {
      id: "enum-practice",
      title: "Match enum values: another example",
      prompt: "Using supplied enum Status, declare Status item = Status.Active. Use a switch expression mapping Pending to \"wait\", Active to \"run\", and _ to \"unknown\" into string answer.",
      solution: "Status item = Status.Active;\nstring answer = item switch { Status.Pending => \"wait\", Status.Active => \"run\", _ => \"unknown\" };",
      checks: ["answer == \"run\""],
      rules: [
        {"kind":"SwitchExpression","message":"Qualify each enum constant with its type in the switch arm."},
      ],
      hints: [
        "A pattern describes the shape or value that must match, and may bind parts to local names.",
        "Qualify each enum constant with its type in the switch arm.",
        "Complete this form:\n\n```csharp\nStatus item = Status.Active;\nstring answer = item switch { Status.Pending => \"wait\", Status.Active => \"___\", _ => \"unknown\" };\n```",
      ],
      declarations: "public enum Status { Pending, Active }",
    },
  ],
};

/** @type {import("../types.js").Topic} */
export const conditionals = {
  id: "conditionals",
  title: "Conditionals & patterns",
  description: "If statements, switches, and pattern syntax.",
  exercises: [
    {
      id: "if",
      title: "Write an if statement",
      prompt: "Declare int count = 3 and bool positive = false. Set positive to true inside an if that tests count > 0.",
      solution: "int count = 3;\nbool positive = false;\nif (count > 0) { positive = true; }",
      checks: ["positive"],
      rules: [
        {"kind":"IfStatement","message":"Put the condition in parentheses after if."},
      ],
      hints: [
        "The body runs when the condition is true.",
        "Put the condition in parentheses after if.",
        "Complete this form:\n\n```csharp\nint count = 3;\nbool positive = false;\nif (___) { positive = ___; }\n```",
      ],
    },
    {
      id: "else",
      title: "Add an else branch",
      prompt: "Declare int count = 0 and string result. Use if/else to assign \"positive\" when count > 0, otherwise \"zero\".",
      solution: "int count = 0;\nstring result;\nif (count > 0) { result = \"positive\"; } else { result = \"zero\"; }",
      checks: ["result == \"zero\""],
      rules: [
        {"kind":"ElseClause","message":"Add else after the closing brace of if."},
      ],
      hints: [
        "Both branches must assign result.",
        "Add else after the closing brace of if.",
        "Complete this form:\n\n```csharp\nint count = 0;\nstring result;\nif (___) { result = \"positive\"; } else { result = \"___\"; }\n```",
      ],
    },
    {
      id: "else-if",
      title: "Chain else if",
      prompt: "Declare int value = -2 and string result. Use if, else if, and else for \"positive\", \"negative\", and \"zero\".",
      solution: "int value = -2;\nstring result;\nif (value > 0) result = \"positive\";\nelse if (value < 0) result = \"negative\";\nelse result = \"zero\";",
      checks: ["result == \"negative\""],
      rules: [
        {"kind":"IfStatement","message":"Use a second if immediately after else.","min":2},
      ],
      hints: [
        "Test positive, then negative, then handle zero.",
        "Use a second if immediately after else.",
        "Complete this form:\n\n```csharp\nint value = -2;\nstring result;\nif (___) result = \"positive\";\nelse if (___) result = \"negative\";\nelse result = \"zero\";\n```",
      ],
    },
    {
      id: "nested",
      title: "Nest conditions",
      prompt: "Declare bool signedIn = true, bool admin = true, bool allowed = false. Use two nested if statements to set allowed only when both are true.",
      solution: "bool signedIn = true, admin = true, allowed = false;\nif (signedIn) { if (admin) { allowed = true; } }",
      checks: ["allowed"],
      rules: [
        {"kind":"IfStatement","message":"Write an if inside another if body.","min":2},
      ],
      hints: [
        "The inner condition is checked inside the outer body.",
        "Write an if inside another if body.",
        "Complete this form:\n\n```csharp\nbool signedIn = true, admin = true, allowed = false;\nif (___) { if (___) { allowed = true; } }\n```",
      ],
    },
    {
      id: "and",
      title: "Combine conditions",
      prompt: "Declare int age = 20 and bool allowed = false. Use if with && to set allowed when age is at least 18 and less than 65.",
      solution: "int age = 20;\nbool allowed = false;\nif (age >= 18 && age < 65) allowed = true;",
      checks: ["allowed"],
      rules: [
        {"kind":"IfStatement","message":"Write an if statement."},
        {"kind":"LogicalAndExpression","message":"Join the comparisons with &&."},
      ],
      hints: [
        "Both comparisons must be true.",
        "Write an if statement. Join the comparisons with &&.",
        "Complete this form:\n\n```csharp\nint age = 20;\nbool allowed = false;\nif (age >= ___ && age < ___) allowed = true;\n```",
      ],
    },
    {
      id: "or",
      title: "Accept either condition",
      prompt: "Declare int day = 6 and bool weekend = false. Use if with || to set weekend when day is 6 or 7.",
      solution: "int day = 6;\nbool weekend = false;\nif (day == 6 || day == 7) weekend = true;",
      checks: ["weekend"],
      rules: [
        {"kind":"IfStatement","message":"Write an if statement."},
        {"kind":"LogicalOrExpression","message":"Join the comparisons with ||."},
      ],
      hints: [
        "Either comparison can make the condition true.",
        "Write an if statement. Join the comparisons with ||.",
        "Complete this form:\n\n```csharp\nint day = 6;\nbool weekend = false;\nif (day == ___ || day == ___) weekend = true;\n```",
      ],
    },
    {
      id: "null",
      title: "Match null",
      prompt: "Declare string? text = null and bool missing = false. Use if (text is null) to set missing to true.",
      solution: "string? text = null;\nbool missing = false;\nif (text is null) missing = true;",
      checks: ["missing"],
      rules: [
        {"kind":"IsPatternExpression","message":"Use is null inside the condition."},
      ],
      hints: [
        "Null can be matched as a constant pattern.",
        "Use is null inside the condition.",
        "Complete this form:\n\n```csharp\nstring? text = null;\nbool missing = false;\nif (text is ___) missing = true;\n```",
      ],
    },
    {
      id: "not-null",
      title: "Match a non-null value",
      prompt: "Declare string? text = \"hello\" and bool present = false. Use is not null in an if to set present.",
      solution: "string? text = \"hello\";\nbool present = false;\nif (text is not null) present = true;",
      checks: ["present"],
      rules: [
        {"kind":"NotPattern","message":"Put not before the null pattern."},
      ],
      hints: [
        "A not pattern reverses the match.",
        "Put not before the null pattern.",
        "Complete this form:\n\n```csharp\nstring? text = \"hello\";\nbool present = false;\nif (text is not ___) present = true;\n```",
      ],
    },
    {
      id: "switch",
      title: "Write a switch statement",
      prompt: "Declare int day = 1 and string result = \"\". Switch on day, assigning \"Monday\" for case 1 and \"Other\" by default. End both sections with break.",
      solution: "int day = 1;\nstring result = \"\";\nswitch (day) { case 1: result = \"Monday\"; break; default: result = \"Other\"; break; }",
      checks: ["result == \"Monday\""],
      rules: [
        {"kind":"SwitchStatement","message":"Put the switched value in parentheses."},
        {"kind":"DefaultSwitchLabel","message":"Include a default section."},
        {"kind":"BreakStatement","message":"End each section with break.","min":2},
      ],
      hints: [
        "Each switch section begins with a label and colon.",
        "Put the switched value in parentheses. Include a default section. End each section with break.",
        "Complete this form:\n\n```csharp\nint day = 1;\nstring result = \"\";\nswitch (___) { case 1: result = \"Monday\"; break; default: result = \"___\"; break; }\n```",
      ],
    },
    {
      id: "switch-expression",
      title: "Write a switch expression",
      prompt: "Declare int day = 2. Create string result using a switch expression with 1 => \"Mon\", 2 => \"Tue\", and _ => \"Other\".",
      solution: "int day = 2;\nstring result = day switch { 1 => \"Mon\", 2 => \"Tue\", _ => \"Other\" };",
      checks: ["result == \"Tue\""],
      rules: [
        {"kind":"SwitchExpression","message":"Put switch after day, with comma-separated => arms."},
      ],
      hints: [
        "A switch expression produces a value.",
        "Put switch after day, with comma-separated => arms.",
        "Complete this form:\n\n```csharp\nint day = 2;\nstring result = day switch { 1 => \"Mon\", 2 => \"___\", _ => \"Other\" };\n```",
      ],
    },
    {
      id: "relational",
      title: "Match a relational pattern",
      prompt: "Declare int age = 21. Declare bool adult using age is >= 18.",
      solution: "int age = 21;\nbool adult = age is >= 18;",
      checks: ["adult"],
      rules: [
        {"kind":"RelationalPattern","message":"Put >= 18 after is."},
      ],
      hints: [
        "Relational patterns compare to a constant.",
        "Put >= 18 after is.",
        "Complete this form:\n\n```csharp\nint age = 21;\nbool adult = age is ___ 18;\n```",
      ],
    },
    {
      id: "and-pattern",
      title: "Combine patterns with and",
      prompt: "Declare int age = 25. Declare bool workingAge using age is >= 18 and < 65.",
      solution: "int age = 25;\nbool workingAge = age is >= 18 and < 65;",
      checks: ["workingAge"],
      rules: [
        {"kind":"AndPattern","message":"Use the word and between relational patterns."},
      ],
      hints: [
        "Pattern combinators use words rather than &&.",
        "Use the word and between relational patterns.",
        "Complete this form:\n\n```csharp\nint age = 25;\nbool workingAge = age is >= 18 ___ < 65;\n```",
      ],
    },
    {
      id: "or-pattern",
      title: "Combine patterns with or",
      prompt: "Declare int day = 7. Declare bool weekend using day is 6 or 7.",
      solution: "int day = 7;\nbool weekend = day is 6 or 7;",
      checks: ["weekend"],
      rules: [
        {"kind":"OrPattern","message":"Use the word or between constant patterns."},
      ],
      hints: [
        "Either constant pattern can match.",
        "Use the word or between constant patterns.",
        "Complete this form:\n\n```csharp\nint day = 7;\nbool weekend = day is 6 ___ 7;\n```",
      ],
    },
    {
      id: "property-pattern",
      title: "Match a property",
      prompt: "Declare string text = \"hello\". Declare bool fiveLetters using text is { Length: 5 }.",
      solution: "string text = \"hello\";\nbool fiveLetters = text is { Length: 5 };",
      checks: ["fiveLetters"],
      rules: [
        {"kind":"PropertyPatternClause","message":"Put the property name and expected value inside braces."},
      ],
      hints: [
        "A property pattern inspects a property of the value.",
        "Put the property name and expected value inside braces.",
        "Complete this form:\n\n```csharp\nstring text = \"hello\";\nbool fiveLetters = text is { ___: 5 };\n```",
      ],
    },
    {
      id: "list-pattern",
      title: "Match a list",
      prompt: "Declare int[] values = { 1, 2, 3 }. Declare bool matches using values is [1, 2, 3].",
      solution: "int[] values = { 1, 2, 3 };\nbool matches = values is [1, 2, 3];",
      checks: ["matches"],
      rules: [
        {"kind":"ListPattern","message":"Put the element patterns inside square brackets after is."},
      ],
      hints: [
        "A list pattern matches elements and length.",
        "Put the element patterns inside square brackets after is.",
        "Complete this form:\n\n```csharp\nint[] values = { 1, 2, 3 };\nbool matches = values is [___, ___, ___];\n```",
      ],
    },
    {
      id: "slice-pattern",
      title: "Match a list prefix",
      prompt: "Declare int[] values = { 1, 2, 3 }. Use a list pattern with .. to declare bool startsWithOne when the first element is 1.",
      solution: "int[] values = { 1, 2, 3 };\nbool startsWithOne = values is [1, ..];",
      checks: ["startsWithOne"],
      rules: [
        {"kind":"SlicePattern","message":"Use .. to match the remaining elements."},
      ],
      hints: [
        "A slice pattern can ignore any remaining elements.",
        "Use .. to match the remaining elements.",
        "Complete this form:\n\n```csharp\nint[] values = { 1, 2, 3 };\nbool startsWithOne = values is [1, ___];\n```",
      ],
    },
    {
      id: "when",
      title: "Guard a switch case",
      prompt: "Declare int value = 12 and string result = \"\". Switch on value using case int n when n > 10 to assign \"large\", with default \"small\".",
      solution: "int value = 12;\nstring result = \"\";\nswitch (value) { case int n when n > 10: result = \"large\"; break; default: result = \"small\"; break; }",
      checks: ["result == \"large\""],
      rules: [
        {"kind":"WhenClause","message":"Add when n > 10 after the case pattern."},
      ],
      hints: [
        "A when guard adds a boolean condition to a match.",
        "Add when n > 10 after the case pattern.",
        "Complete this form:\n\n```csharp\nint value = 12;\nstring result = \"\";\nswitch (value) { case int n when ___: result = \"large\"; break; default: result = \"small\"; break; }\n```",
      ],
    },
    {
      id: "discard",
      title: "Use a switch fallback",
      prompt: "Declare int value = 99. Use a switch expression mapping 1 to \"one\" and a discard pattern to \"unknown\" in string result.",
      solution: "int value = 99;\nstring result = value switch { 1 => \"one\", _ => \"unknown\" };",
      checks: ["result == \"unknown\""],
      rules: [
        {"kind":"DiscardPattern","message":"Use _ as the fallback arm pattern."},
      ],
      hints: [
        "A discard matches anything left over.",
        "Use _ as the fallback arm pattern.",
        "Complete this form:\n\n```csharp\nint value = 99;\nstring result = value switch { 1 => \"one\", ___ => \"unknown\" };\n```",
      ],
    },
    {
      id: "type-binding",
      title: "Bind a matched integer",
      prompt: "Declare object value = 42 and int result = 0. Use if (value is int number) to copy number into result.",
      solution: "object value = 42;\nint result = 0;\nif (value is int number) result = number;",
      checks: ["result == 42"],
      rules: [
        {"kind":"DeclarationPattern","message":"Declare number after the int type in the pattern."},
      ],
      hints: [
        "The matched variable is available in the if body.",
        "Declare number after the int type in the pattern.",
        "Complete this form:\n\n```csharp\nobject value = 42;\nint result = 0;\nif (value is int ___) result = ___;\n```",
      ],
    },
    {
      id: "negate",
      title: "Negate a condition",
      prompt: "Declare bool ready = false and bool waiting = false. Use if (!ready) to set waiting to true.",
      solution: "bool ready = false, waiting = false;\nif (!ready) waiting = true;",
      checks: ["waiting"],
      rules: [
        {"kind":"IfStatement","message":"Write an if statement."},
        {"kind":"LogicalNotExpression","message":"Prefix ready with !."},
      ],
      hints: [
        "Negation flips the boolean condition.",
        "Write an if statement. Prefix ready with !.",
        "Complete this form:\n\n```csharp\nbool ready = false, waiting = false;\nif (___ready) waiting = true;\n```",
      ],
    },
    {
      id: "if-practice",
      title: "Write an if statement: another example",
      prompt: "Declare int itemCount = 3 and bool positive = false. Set positive to true inside an if that tests itemCount > 0.",
      solution: "int itemCount = 3;\nbool positive = false;\nif (itemCount > 0) { positive = true; }",
      checks: ["positive"],
      rules: [
        {"kind":"IfStatement","message":"Put the condition in parentheses after if."},
      ],
      hints: [
        "The body runs when the condition is true.",
        "Put the condition in parentheses after if.",
        "Complete this form:\n\n```csharp\nint itemCount = 3;\nbool positive = false;\nif (___) { positive = ___; }\n```",
      ],
    },
    {
      id: "else-practice",
      title: "Add an else branch: another example",
      prompt: "Declare int itemCount = 0 and string result. Use if/else to assign \"positive\" when itemCount > 0, otherwise \"zero\".",
      solution: "int itemCount = 0;\nstring result;\nif (itemCount > 0) { result = \"positive\"; } else { result = \"zero\"; }",
      checks: ["result == \"zero\""],
      rules: [
        {"kind":"ElseClause","message":"Add else after the closing brace of if."},
      ],
      hints: [
        "Both branches must assign result.",
        "Add else after the closing brace of if.",
        "Complete this form:\n\n```csharp\nint itemCount = 0;\nstring result;\nif (___) { result = \"positive\"; } else { result = \"___\"; }\n```",
      ],
    },
    {
      id: "else-if-practice",
      title: "Chain else if: another example",
      prompt: "Declare int input = -2 and string result. Use if, else if, and else for \"positive\", \"negative\", and \"zero\".",
      solution: "int input = -2;\nstring result;\nif (input > 0) result = \"positive\";\nelse if (input < 0) result = \"negative\";\nelse result = \"zero\";",
      checks: ["result == \"negative\""],
      rules: [
        {"kind":"IfStatement","message":"Use a second if immediately after else.","min":2},
      ],
      hints: [
        "Test positive, then negative, then handle zero.",
        "Use a second if immediately after else.",
        "Complete this form:\n\n```csharp\nint input = -2;\nstring result;\nif (___) result = \"positive\";\nelse if (___) result = \"negative\";\nelse result = \"zero\";\n```",
      ],
    },
    {
      id: "nested-practice",
      title: "Nest conditions: another example",
      prompt: "Declare bool signedInSample = true, bool admin = true, bool allowed = false. Use two nested if statements to set allowed only when both are true.",
      solution: "bool signedInSample = true, admin = true, allowed = false;\nif (signedInSample) { if (admin) { allowed = true; } }",
      checks: ["allowed"],
      rules: [
        {"kind":"IfStatement","message":"Write an if inside another if body.","min":2},
      ],
      hints: [
        "The inner condition is checked inside the outer body.",
        "Write an if inside another if body.",
        "Complete this form:\n\n```csharp\nbool signedInSample = true, admin = true, allowed = false;\nif (___) { if (___) { allowed = true; } }\n```",
      ],
    },
    {
      id: "and-practice",
      title: "Combine conditions: another example",
      prompt: "Declare int ageSample = 20 and bool allowed = false. Use if with && to set allowed when ageSample is at least 18 and less than 65.",
      solution: "int ageSample = 20;\nbool allowed = false;\nif (ageSample >= 18 && ageSample < 65) allowed = true;",
      checks: ["allowed"],
      rules: [
        {"kind":"IfStatement","message":"Write an if statement."},
        {"kind":"LogicalAndExpression","message":"Join the comparisons with &&."},
      ],
      hints: [
        "Both comparisons must be true.",
        "Write an if statement. Join the comparisons with &&.",
        "Complete this form:\n\n```csharp\nint ageSample = 20;\nbool allowed = false;\nif (ageSample >= ___ && ageSample < ___) allowed = true;\n```",
      ],
    },
    {
      id: "or-practice",
      title: "Accept either condition: another example",
      prompt: "Declare int daySample = 6 and bool weekend = false. Use if with || to set weekend when daySample is 6 or 7.",
      solution: "int daySample = 6;\nbool weekend = false;\nif (daySample == 6 || daySample == 7) weekend = true;",
      checks: ["weekend"],
      rules: [
        {"kind":"IfStatement","message":"Write an if statement."},
        {"kind":"LogicalOrExpression","message":"Join the comparisons with ||."},
      ],
      hints: [
        "Either comparison can make the condition true.",
        "Write an if statement. Join the comparisons with ||.",
        "Complete this form:\n\n```csharp\nint daySample = 6;\nbool weekend = false;\nif (daySample == ___ || daySample == ___) weekend = true;\n```",
      ],
    },
    {
      id: "null-practice",
      title: "Match null: another example",
      prompt: "Declare string? message = null and bool missing = false. Use if (message is null) to set missing to true.",
      solution: "string? message = null;\nbool missing = false;\nif (message is null) missing = true;",
      checks: ["missing"],
      rules: [
        {"kind":"IsPatternExpression","message":"Use is null inside the condition."},
      ],
      hints: [
        "Null can be matched as a constant pattern.",
        "Use is null inside the condition.",
        "Complete this form:\n\n```csharp\nstring? message = null;\nbool missing = false;\nif (message is ___) missing = true;\n```",
      ],
    },
    {
      id: "not-null-practice",
      title: "Match a non-null value: another example",
      prompt: "Declare string? message = \"hello\" and bool present = false. Use is not null in an if to set present.",
      solution: "string? message = \"hello\";\nbool present = false;\nif (message is not null) present = true;",
      checks: ["present"],
      rules: [
        {"kind":"NotPattern","message":"Put not before the null pattern."},
      ],
      hints: [
        "A not pattern reverses the match.",
        "Put not before the null pattern.",
        "Complete this form:\n\n```csharp\nstring? message = \"hello\";\nbool present = false;\nif (message is not ___) present = true;\n```",
      ],
    },
    {
      id: "switch-practice",
      title: "Write a switch statement: another example",
      prompt: "Declare int daySample = 1 and string result = \"\". Switch on daySample, assigning \"Monday\" for case 1 and \"Other\" by default. End both sections with break.",
      solution: "int daySample = 1;\nstring result = \"\";\nswitch (daySample) { case 1: result = \"Monday\"; break; default: result = \"Other\"; break; }",
      checks: ["result == \"Monday\""],
      rules: [
        {"kind":"SwitchStatement","message":"Put the switched value in parentheses."},
        {"kind":"DefaultSwitchLabel","message":"Include a default section."},
        {"kind":"BreakStatement","message":"End each section with break.","min":2},
      ],
      hints: [
        "Each switch section begins with a label and colon.",
        "Put the switched value in parentheses. Include a default section. End each section with break.",
        "Complete this form:\n\n```csharp\nint daySample = 1;\nstring result = \"\";\nswitch (___) { case 1: result = \"Monday\"; break; default: result = \"___\"; break; }\n```",
      ],
    },
    {
      id: "switch-expression-practice",
      title: "Write a switch expression: another example",
      prompt: "Declare int daySample = 2. Create string result using a switch expression with 1 => \"Mon\", 2 => \"Tue\", and _ => \"Other\".",
      solution: "int daySample = 2;\nstring result = daySample switch { 1 => \"Mon\", 2 => \"Tue\", _ => \"Other\" };",
      checks: ["result == \"Tue\""],
      rules: [
        {"kind":"SwitchExpression","message":"Put switch after daySample, with comma-separated => arms."},
      ],
      hints: [
        "A switch expression produces a value.",
        "Put switch after daySample, with comma-separated => arms.",
        "Complete this form:\n\n```csharp\nint daySample = 2;\nstring result = daySample switch { 1 => \"Mon\", 2 => \"___\", _ => \"Other\" };\n```",
      ],
    },
    {
      id: "relational-practice",
      title: "Match a relational pattern: another example",
      prompt: "Declare int ageSample = 21. Declare bool adult using ageSample is >= 18.",
      solution: "int ageSample = 21;\nbool adult = ageSample is >= 18;",
      checks: ["adult"],
      rules: [
        {"kind":"RelationalPattern","message":"Put >= 18 after is."},
      ],
      hints: [
        "Relational patterns compare to a constant.",
        "Put >= 18 after is.",
        "Complete this form:\n\n```csharp\nint ageSample = 21;\nbool adult = ageSample is ___ 18;\n```",
      ],
    },
    {
      id: "and-pattern-practice",
      title: "Combine patterns with and: another example",
      prompt: "Declare int ageSample = 25. Declare bool workingAge using ageSample is >= 18 and < 65.",
      solution: "int ageSample = 25;\nbool workingAge = ageSample is >= 18 and < 65;",
      checks: ["workingAge"],
      rules: [
        {"kind":"AndPattern","message":"Use the word and between relational patterns."},
      ],
      hints: [
        "Pattern combinators use words rather than &&.",
        "Use the word and between relational patterns.",
        "Complete this form:\n\n```csharp\nint ageSample = 25;\nbool workingAge = ageSample is >= 18 ___ < 65;\n```",
      ],
    },
    {
      id: "or-pattern-practice",
      title: "Combine patterns with or: another example",
      prompt: "Declare int daySample = 7. Declare bool weekend using daySample is 6 or 7.",
      solution: "int daySample = 7;\nbool weekend = daySample is 6 or 7;",
      checks: ["weekend"],
      rules: [
        {"kind":"OrPattern","message":"Use the word or between constant patterns."},
      ],
      hints: [
        "Either constant pattern can match.",
        "Use the word or between constant patterns.",
        "Complete this form:\n\n```csharp\nint daySample = 7;\nbool weekend = daySample is 6 ___ 7;\n```",
      ],
    },
    {
      id: "property-pattern-practice",
      title: "Match a property: another example",
      prompt: "Declare string message = \"hello\". Declare bool fiveLetters using message is { Length: 5 }.",
      solution: "string message = \"hello\";\nbool fiveLetters = message is { Length: 5 };",
      checks: ["fiveLetters"],
      rules: [
        {"kind":"PropertyPatternClause","message":"Put the property name and expected value inside braces."},
      ],
      hints: [
        "A property pattern inspects a property of the value.",
        "Put the property name and expected value inside braces.",
        "Complete this form:\n\n```csharp\nstring message = \"hello\";\nbool fiveLetters = message is { ___: 5 };\n```",
      ],
    },
    {
      id: "list-pattern-practice",
      title: "Match a list: another example",
      prompt: "Declare int[] samples = { 1, 2, 3 }. Declare bool matches using samples is [1, 2, 3].",
      solution: "int[] samples = { 1, 2, 3 };\nbool matches = samples is [1, 2, 3];",
      checks: ["matches"],
      rules: [
        {"kind":"ListPattern","message":"Put the element patterns inside square brackets after is."},
      ],
      hints: [
        "A list pattern matches elements and length.",
        "Put the element patterns inside square brackets after is.",
        "Complete this form:\n\n```csharp\nint[] samples = { 1, 2, 3 };\nbool matches = samples is [___, ___, ___];\n```",
      ],
    },
    {
      id: "slice-pattern-practice",
      title: "Match a list prefix: another example",
      prompt: "Declare int[] samples = { 1, 2, 3 }. Use a list pattern with .. to declare bool startsWithOne when the first element is 1.",
      solution: "int[] samples = { 1, 2, 3 };\nbool startsWithOne = samples is [1, ..];",
      checks: ["startsWithOne"],
      rules: [
        {"kind":"SlicePattern","message":"Use .. to match the remaining elements."},
      ],
      hints: [
        "A slice pattern can ignore any remaining elements.",
        "Use .. to match the remaining elements.",
        "Complete this form:\n\n```csharp\nint[] samples = { 1, 2, 3 };\nbool startsWithOne = samples is [1, ___];\n```",
      ],
    },
    {
      id: "when-practice",
      title: "Guard a switch case: another example",
      prompt: "Declare int input = 12 and string result = \"\". Switch on input using case int n when n > 10 to assign \"large\", with default \"small\".",
      solution: "int input = 12;\nstring result = \"\";\nswitch (input) { case int n when n > 10: result = \"large\"; break; default: result = \"small\"; break; }",
      checks: ["result == \"large\""],
      rules: [
        {"kind":"WhenClause","message":"Add when n > 10 after the case pattern."},
      ],
      hints: [
        "A when guard adds a boolean condition to a match.",
        "Add when n > 10 after the case pattern.",
        "Complete this form:\n\n```csharp\nint input = 12;\nstring result = \"\";\nswitch (input) { case int n when ___: result = \"large\"; break; default: result = \"small\"; break; }\n```",
      ],
    },
    {
      id: "discard-practice",
      title: "Use a switch fallback: another example",
      prompt: "Declare int input = 99. Use a switch expression mapping 1 to \"one\" and a discard pattern to \"unknown\" in string result.",
      solution: "int input = 99;\nstring result = input switch { 1 => \"one\", _ => \"unknown\" };",
      checks: ["result == \"unknown\""],
      rules: [
        {"kind":"DiscardPattern","message":"Use _ as the fallback arm pattern."},
      ],
      hints: [
        "A discard matches anything left over.",
        "Use _ as the fallback arm pattern.",
        "Complete this form:\n\n```csharp\nint input = 99;\nstring result = input switch { 1 => \"one\", ___ => \"unknown\" };\n```",
      ],
    },
    {
      id: "type-binding-practice",
      title: "Bind a matched integer: another example",
      prompt: "Declare object input = 42 and int result = 0. Use if (input is int number) to copy number into result.",
      solution: "object input = 42;\nint result = 0;\nif (input is int number) result = number;",
      checks: ["result == 42"],
      rules: [
        {"kind":"DeclarationPattern","message":"Declare number after the int type in the pattern."},
      ],
      hints: [
        "The matched variable is available in the if body.",
        "Declare number after the int type in the pattern.",
        "Complete this form:\n\n```csharp\nobject input = 42;\nint result = 0;\nif (input is int ___) result = ___;\n```",
      ],
    },
    {
      id: "negate-practice",
      title: "Negate a condition: another example",
      prompt: "Declare bool readySample = false and bool waiting = false. Use if (!readySample) to set waiting to true.",
      solution: "bool readySample = false, waiting = false;\nif (!readySample) waiting = true;",
      checks: ["waiting"],
      rules: [
        {"kind":"IfStatement","message":"Write an if statement."},
        {"kind":"LogicalNotExpression","message":"Prefix readySample with !."},
      ],
      hints: [
        "Negation flips the boolean condition.",
        "Write an if statement. Prefix readySample with !.",
        "Complete this form:\n\n```csharp\nbool readySample = false, waiting = false;\nif (___ready) waiting = true;\n```",
      ],
    },
  ],
};

/** @type {import("../types.js").Topic} */
export const strings = {
  id: "strings",
  title: "Strings & interpolation",
  description: "Literals, formatting, escaping, and common string methods.",
  exercises: [
    {
      id: "interpolate",
      title: "Interpolate a value",
      prompt: "Declare string name = \"Ada\". Use interpolation to create string result equal to \"Hello, Ada!\".",
      solution: "string name = \"Ada\";\nstring result = $\"Hello, {name}!\";",
      checks: ["result == \"Hello, Ada!\""],
      rules: [
        {"kind":"InterpolatedStringExpression","message":"Prefix the string with $ and put name in braces."},
      ],
      hints: [
        "Interpolation inserts expressions into a string.",
        "Prefix the string with $ and put name in braces.",
        "Complete this form:\n\n```csharp\nstring name = \"Ada\";\nstring result = $\"Hello, {___}!\";\n```",
      ],
    },
    {
      id: "interpolate-expression",
      title: "Interpolate an expression",
      prompt: "Declare int a = 3 and int b = 4. Interpolate their sum into string result equal to \"Total: 7\".",
      solution: "int a = 3, b = 4;\nstring result = $\"Total: {a + b}\";",
      checks: ["result == \"Total: 7\""],
      rules: [
        {"kind":"Interpolation","message":"Put a + b inside the interpolation braces."},
      ],
      hints: [
        "Braces can contain an expression.",
        "Put a + b inside the interpolation braces.",
        "Complete this form:\n\n```csharp\nint a = 3, b = 4;\nstring result = $\"Total: {___}\";\n```",
      ],
    },
    {
      id: "format",
      title: "Format a number",
      prompt: "Declare decimal price = 12.5m. Use interpolation with :F2 to create result equal to \"12.50\". Use FormattableString.Invariant around the interpolated string.",
      solution: "decimal price = 12.5m;\nstring result = FormattableString.Invariant($\"{price:F2}\");",
      checks: ["result == \"12.50\""],
      rules: [
        {"kind":"InterpolationFormatClause","message":"Add :F2 after price inside the braces."},
      ],
      hints: [
        "A colon introduces an interpolation format.",
        "Add :F2 after price inside the braces.",
        "Complete this form:\n\n```csharp\ndecimal price = 12.5m;\nstring result = FormattableString.Invariant($\"{price:___}\");\n```",
      ],
    },
    {
      id: "concatenate",
      title: "Concatenate strings",
      prompt: "Declare first = \"Hello\" and second = \"world\" as strings. Use + to create string result equal to \"Hello world\".",
      solution: "string first = \"Hello\", second = \"world\";\nstring result = first + \" \" + second;",
      checks: ["result == \"Hello world\""],
      rules: [
        {"kind":"AddExpression","message":"Join strings using +."},
      ],
      hints: [
        "Include a space between the words.",
        "Join strings using +.",
        "Complete this form:\n\n```csharp\nstring first = \"Hello\", second = \"world\";\nstring result = first + ___ + second;\n```",
      ],
    },
    {
      id: "newline",
      title: "Escape a newline",
      prompt: "Create string result containing \"one\", a newline, then \"two\", using a regular string with an escape sequence.",
      solution: "string result = \"one\\ntwo\";",
      checks: ["result == \"one\\ntwo\""],
      rules: [
        {"kind":"StringLiteralExpression","message":"Use \\n inside a regular string.","token":"\"one\\ntwo\""},
      ],
      hints: [
        "Backslash introduces an escape sequence.",
        "Use \\n inside a regular string.",
        "Complete this form:\n\n```csharp\nstring result = \"one\\___two\";\n```",
      ],
    },
    {
      id: "quotes",
      title: "Escape quotation marks",
      prompt: "Create string result equal to She said \"hi\" using a regular quoted string.",
      solution: "string result = \"She said \\\"hi\\\"\";",
      checks: ["result == \"She said \\\"hi\\\"\""],
      rules: [
        {"kind":"StringLiteralExpression","message":"Escape each inner quote with a backslash."},
      ],
      hints: [
        "Inner quotes must not end the string.",
        "Escape each inner quote with a backslash.",
        "Complete this form:\n\n```csharp\nstring result = \"She said \\\"___\\\"\";\n```",
      ],
    },
    {
      id: "verbatim",
      title: "Write a verbatim path",
      prompt: "Use a verbatim string literal to set string result to C:\\practice\\notes.",
      solution: "string result = @\"C:\\practice\\notes\";",
      checks: ["result == @\"C:\\practice\\notes\""],
      rules: [
        {"kind":"StringLiteralExpression","message":"Put @ before the opening quote.","token":"@\"C:\\practice\\notes\""},
      ],
      hints: [
        "Verbatim strings keep backslashes literal.",
        "Put @ before the opening quote.",
        "Complete this form:\n\n```csharp\nstring result = @\"C:\\___\\___\";\n```",
      ],
    },
    {
      id: "empty",
      title: "Use string.Empty",
      prompt: "Declare string result initialized using string.Empty.",
      solution: "string result = string.Empty;",
      checks: ["result.Length == 0"],
      rules: [
        {"kind":"SimpleMemberAccessExpression","message":"Access string.Empty.","token":"Empty"},
      ],
      hints: [
        "Empty is a static field on string.",
        "Access string.Empty.",
        "Complete this form:\n\n```csharp\nstring result = string.___;\n```",
      ],
    },
    {
      id: "length",
      title: "Read string length",
      prompt: "Declare string text = \"syntax\" and int result using its Length property.",
      solution: "string text = \"syntax\";\nint result = text.Length;",
      checks: ["result == 6"],
      rules: [
        {"kind":"SimpleMemberAccessExpression","message":"Read the Length property without parentheses.","token":"Length"},
      ],
      hints: [
        "Length is a property rather than a method.",
        "Read the Length property without parentheses.",
        "Complete this form:\n\n```csharp\nstring text = \"syntax\";\nint result = text.___;\n```",
      ],
    },
    {
      id: "index",
      title: "Index a character",
      prompt: "Declare string text = \"syntax\" and char result containing its first character using an index.",
      solution: "string text = \"syntax\";\nchar result = text[0];",
      checks: ["result == 's'"],
      rules: [
        {"kind":"ElementAccessExpression","message":"Use square brackets with index zero."},
      ],
      hints: [
        "String indexes start at zero.",
        "Use square brackets with index zero.",
        "Complete this form:\n\n```csharp\nstring text = \"syntax\";\nchar result = text[___];\n```",
      ],
    },
    {
      id: "upper",
      title: "Convert to uppercase",
      prompt: "Use ToUpperInvariant to convert \"hello\" into string result.",
      solution: "string result = \"hello\".ToUpperInvariant();",
      checks: ["result == \"HELLO\""],
      rules: [
        {"kind":"InvocationExpression","message":"Call ToUpperInvariant on the string.","token":"ToUpperInvariant"},
      ],
      hints: [
        "Call the invariant case conversion method.",
        "Call ToUpperInvariant on the string.",
        "Complete this form:\n\n```csharp\nstring result = \"hello\".___();\n```",
      ],
    },
    {
      id: "lower",
      title: "Convert to lowercase",
      prompt: "Use ToLowerInvariant to convert \"HELLO\" into string result.",
      solution: "string result = \"HELLO\".ToLowerInvariant();",
      checks: ["result == \"hello\""],
      rules: [
        {"kind":"InvocationExpression","message":"Call ToLowerInvariant on the string.","token":"ToLowerInvariant"},
      ],
      hints: [
        "Methods need parentheses even without arguments.",
        "Call ToLowerInvariant on the string.",
        "Complete this form:\n\n```csharp\nstring result = \"HELLO\".___();\n```",
      ],
    },
    {
      id: "trim",
      title: "Trim whitespace",
      prompt: "Call Trim on \"  hello  \" to create string result.",
      solution: "string result = \"  hello  \".Trim();",
      checks: ["result == \"hello\""],
      rules: [
        {"kind":"InvocationExpression","message":"Call Trim on the string.","token":"Trim"},
      ],
      hints: [
        "Trim removes whitespace at both ends.",
        "Call Trim on the string.",
        "Complete this form:\n\n```csharp\nstring result = \"  hello  \".___();\n```",
      ],
    },
    {
      id: "replace",
      title: "Replace text",
      prompt: "Call Replace to turn \"red boat\" into \"blue boat\" and store it in string result.",
      solution: "string result = \"red boat\".Replace(\"red\", \"blue\");",
      checks: ["result == \"blue boat\""],
      rules: [
        {"kind":"InvocationExpression","message":"Call Replace on the string.","token":"Replace"},
      ],
      hints: [
        "Pass the old text, then the replacement.",
        "Call Replace on the string.",
        "Complete this form:\n\n```csharp\nstring result = \"red boat\".Replace(\"___\", \"___\");\n```",
      ],
    },
    {
      id: "contains",
      title: "Check for a substring",
      prompt: "Call Contains on \"typescript\" to check for \"script\" and store the bool in result.",
      solution: "bool result = \"typescript\".Contains(\"script\");",
      checks: ["result"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Contains on the string.","token":"Contains"},
      ],
      hints: [
        "Contains returns a boolean.",
        "Call Contains on the string.",
        "Complete this form:\n\n```csharp\nbool result = \"typescript\".___(\"script\");\n```",
      ],
    },
    {
      id: "starts",
      title: "Check a prefix",
      prompt: "Use StartsWith to test whether \"practice.cs\" starts with \"practice\". Store the bool in result.",
      solution: "bool result = \"practice.cs\".StartsWith(\"practice\");",
      checks: ["result"],
      rules: [
        {"kind":"InvocationExpression","message":"Call StartsWith on the string.","token":"StartsWith"},
      ],
      hints: [
        "A prefix is text at the beginning.",
        "Call StartsWith on the string.",
        "Complete this form:\n\n```csharp\nbool result = \"practice.cs\".___(\"practice\");\n```",
      ],
    },
    {
      id: "split",
      title: "Split a string",
      prompt: "Split \"a,b,c\" on the comma character into string[] parts.",
      solution: "string[] parts = \"a,b,c\".Split(',');",
      checks: ["parts.SequenceEqual(new[] { \"a\", \"b\", \"c\" })"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Split on the string.","token":"Split"},
      ],
      hints: [
        "Split can take a character delimiter.",
        "Call Split on the string.",
        "Complete this form:\n\n```csharp\nstring[] parts = \"a,b,c\".Split('___');\n```",
      ],
    },
    {
      id: "join",
      title: "Join strings",
      prompt: "Declare string[] words containing \"a\", \"b\", and \"c\". Use string.Join with \"-\" to create string result.",
      solution: "string[] words = { \"a\", \"b\", \"c\" };\nstring result = string.Join(\"-\", words);",
      checks: ["result == \"a-b-c\""],
      rules: [
        {"kind":"InvocationExpression","message":"Call Join on the string.","token":"Join"},
      ],
      hints: [
        "Join takes the separator before the collection.",
        "Call Join on the string.",
        "Complete this form:\n\n```csharp\nstring[] words = { \"a\", \"b\", \"c\" };\nstring result = string.Join(\"___\", ___);\n```",
      ],
    },
    {
      id: "substring",
      title: "Extract a substring",
      prompt: "Use Substring on \"practice\" to take the first four characters into string result.",
      solution: "string result = \"practice\".Substring(0, 4);",
      checks: ["result == \"prac\""],
      rules: [
        {"kind":"InvocationExpression","message":"Call Substring on the string.","token":"Substring"},
      ],
      hints: [
        "Pass a starting index and a length.",
        "Call Substring on the string.",
        "Complete this form:\n\n```csharp\nstring result = \"practice\".Substring(___, ___);\n```",
      ],
    },
    {
      id: "range",
      title: "Slice with a range",
      prompt: "Declare string text = \"practice\". Use [..4] to create string result containing \"prac\".",
      solution: "string text = \"practice\";\nstring result = text[..4];",
      checks: ["result == \"prac\""],
      rules: [
        {"kind":"RangeExpression","message":"Use .. followed by the exclusive end index."},
      ],
      hints: [
        "An omitted start means the beginning.",
        "Use .. followed by the exclusive end index.",
        "Complete this form:\n\n```csharp\nstring text = \"practice\";\nstring result = text[..___];\n```",
      ],
    },
    {
      id: "interpolate-practice",
      title: "Interpolate a value: another example",
      prompt: "Declare string displayName = \"Lin\". Use interpolation to create string result equal to \"Hello, Lin!\".",
      solution: "string displayName = \"Lin\";\nstring result = $\"Hello, {displayName}!\";",
      checks: ["result == \"Hello, Lin!\""],
      rules: [
        {"kind":"InterpolatedStringExpression","message":"Prefix the string with $ and put displayName in braces."},
      ],
      hints: [
        "Interpolation inserts expressions into a string.",
        "Prefix the string with $ and put displayName in braces.",
        "Complete this form:\n\n```csharp\nstring displayName = \"Lin\";\nstring result = $\"Hello, {___}!\";\n```",
      ],
    },
    {
      id: "interpolate-expression-practice",
      title: "Interpolate an expression: another example",
      prompt: "Declare int aSample = 3 and int b = 4. Interpolate their sum into string result equal to \"Total: 7\".",
      solution: "int aSample = 3, b = 4;\nstring result = $\"Total: {aSample + b}\";",
      checks: ["result == \"Total: 7\""],
      rules: [
        {"kind":"Interpolation","message":"Put aSample + b inside the interpolation braces."},
      ],
      hints: [
        "Braces can contain an expression.",
        "Put aSample + b inside the interpolation braces.",
        "Complete this form:\n\n```csharp\nint aSample = 3, b = 4;\nstring result = $\"Total: {___}\";\n```",
      ],
    },
    {
      id: "format-practice",
      title: "Format a number: another example",
      prompt: "Declare decimal cost = 12.5m. Use interpolation with :F2 to create result equal to \"12.50\". Use FormattableString.Invariant around the interpolated string.",
      solution: "decimal cost = 12.5m;\nstring result = FormattableString.Invariant($\"{cost:F2}\");",
      checks: ["result == \"12.50\""],
      rules: [
        {"kind":"InterpolationFormatClause","message":"Add :F2 after cost inside the braces."},
      ],
      hints: [
        "A colon introduces an interpolation format.",
        "Add :F2 after cost inside the braces.",
        "Complete this form:\n\n```csharp\ndecimal cost = 12.5m;\nstring result = FormattableString.Invariant($\"{cost:___}\");\n```",
      ],
    },
    {
      id: "concatenate-practice",
      title: "Concatenate strings: another example",
      prompt: "Declare primary = \"Hello\" and second = \"world\" as strings. Use + to create string result equal to \"Hello world\".",
      solution: "string primary = \"Hello\", second = \"world\";\nstring result = primary + \" \" + second;",
      checks: ["result == \"Hello world\""],
      rules: [
        {"kind":"AddExpression","message":"Join strings using +."},
      ],
      hints: [
        "Include a space between the words.",
        "Join strings using +.",
        "Complete this form:\n\n```csharp\nstring primary = \"Hello\", second = \"world\";\nstring result = primary + ___ + second;\n```",
      ],
    },
    {
      id: "newline-practice",
      title: "Escape a newline: another example",
      prompt: "Create string answer containing \"one\", a newline, then \"two\", using a regular string with an escape sequence.",
      solution: "string answer = \"one\\ntwo\";",
      checks: ["answer == \"one\\ntwo\""],
      rules: [
        {"kind":"StringLiteralExpression","message":"Use \\n inside a regular string.","token":"\"one\\ntwo\""},
      ],
      hints: [
        "Backslash introduces an escape sequence.",
        "Use \\n inside a regular string.",
        "Complete this form:\n\n```csharp\nstring answer = \"one\\___two\";\n```",
      ],
    },
    {
      id: "quotes-practice",
      title: "Escape quotation marks: another example",
      prompt: "Create string answer equal to She said \"hi\" using a regular quoted string.",
      solution: "string answer = \"She said \\\"hi\\\"\";",
      checks: ["answer == \"She said \\\"hi\\\"\""],
      rules: [
        {"kind":"StringLiteralExpression","message":"Escape each inner quote with a backslash."},
      ],
      hints: [
        "Inner quotes must not end the string.",
        "Escape each inner quote with a backslash.",
        "Complete this form:\n\n```csharp\nstring answer = \"She said \\\"___\\\"\";\n```",
      ],
    },
    {
      id: "verbatim-practice",
      title: "Write a verbatim path: another example",
      prompt: "Use a verbatim string literal to set string answer to C:\\practice\\notes.",
      solution: "string answer = @\"C:\\practice\\notes\";",
      checks: ["answer == @\"C:\\practice\\notes\""],
      rules: [
        {"kind":"StringLiteralExpression","message":"Put @ before the opening quote.","token":"@\"C:\\practice\\notes\""},
      ],
      hints: [
        "Verbatim strings keep backslashes literal.",
        "Put @ before the opening quote.",
        "Complete this form:\n\n```csharp\nstring answer = @\"C:\\___\\___\";\n```",
      ],
    },
    {
      id: "empty-practice",
      title: "Use string.Empty: another example",
      prompt: "Declare string answer initialized using string.Empty.",
      solution: "string answer = string.Empty;",
      checks: ["answer.Length == 0"],
      rules: [
        {"kind":"SimpleMemberAccessExpression","message":"Access string.Empty.","token":"Empty"},
      ],
      hints: [
        "Empty is a static field on string.",
        "Access string.Empty.",
        "Complete this form:\n\n```csharp\nstring answer = string.___;\n```",
      ],
    },
    {
      id: "length-practice",
      title: "Read string length: another example",
      prompt: "Declare string message = \"syntax\" and int result using its Length property.",
      solution: "string message = \"syntax\";\nint result = message.Length;",
      checks: ["result == 6"],
      rules: [
        {"kind":"SimpleMemberAccessExpression","message":"Read the Length property without parentheses.","token":"Length"},
      ],
      hints: [
        "Length is a property rather than a method.",
        "Read the Length property without parentheses.",
        "Complete this form:\n\n```csharp\nstring message = \"syntax\";\nint result = message.___;\n```",
      ],
    },
    {
      id: "index-practice",
      title: "Index a character: another example",
      prompt: "Declare string message = \"syntax\" and char result containing its first character using an index.",
      solution: "string message = \"syntax\";\nchar result = message[0];",
      checks: ["result == 's'"],
      rules: [
        {"kind":"ElementAccessExpression","message":"Use square brackets with index zero."},
      ],
      hints: [
        "String indexes start at zero.",
        "Use square brackets with index zero.",
        "Complete this form:\n\n```csharp\nstring message = \"syntax\";\nchar result = message[___];\n```",
      ],
    },
    {
      id: "upper-practice",
      title: "Convert to uppercase: another example",
      prompt: "Use ToUpperInvariant to convert \"world\" into string answer.",
      solution: "string answer = \"world\".ToUpperInvariant();",
      checks: ["answer == \"WORLD\""],
      rules: [
        {"kind":"InvocationExpression","message":"Call ToUpperInvariant on the string.","token":"ToUpperInvariant"},
      ],
      hints: [
        "Call the invariant case conversion method.",
        "Call ToUpperInvariant on the string.",
        "Complete this form:\n\n```csharp\nstring answer = \"world\".___();\n```",
      ],
    },
    {
      id: "lower-practice",
      title: "Convert to lowercase: another example",
      prompt: "Use ToLowerInvariant to convert \"WORLD\" into string answer.",
      solution: "string answer = \"WORLD\".ToLowerInvariant();",
      checks: ["answer == \"world\""],
      rules: [
        {"kind":"InvocationExpression","message":"Call ToLowerInvariant on the string.","token":"ToLowerInvariant"},
      ],
      hints: [
        "Methods need parentheses even without arguments.",
        "Call ToLowerInvariant on the string.",
        "Complete this form:\n\n```csharp\nstring answer = \"WORLD\".___();\n```",
      ],
    },
    {
      id: "trim-practice",
      title: "Trim whitespace: another example",
      prompt: "Call Trim on \"  hello  \" to create string answer.",
      solution: "string answer = \"  hello  \".Trim();",
      checks: ["answer == \"hello\""],
      rules: [
        {"kind":"InvocationExpression","message":"Call Trim on the string.","token":"Trim"},
      ],
      hints: [
        "Trim removes whitespace at both ends.",
        "Call Trim on the string.",
        "Complete this form:\n\n```csharp\nstring answer = \"  hello  \".___();\n```",
      ],
    },
    {
      id: "replace-practice",
      title: "Replace text: another example",
      prompt: "Call Replace to turn \"red boat\" into \"blue boat\" and store it in string answer.",
      solution: "string answer = \"red boat\".Replace(\"red\", \"blue\");",
      checks: ["answer == \"blue boat\""],
      rules: [
        {"kind":"InvocationExpression","message":"Call Replace on the string.","token":"Replace"},
      ],
      hints: [
        "Pass the old text, then the replacement.",
        "Call Replace on the string.",
        "Complete this form:\n\n```csharp\nstring answer = \"red boat\".Replace(\"___\", \"___\");\n```",
      ],
    },
    {
      id: "contains-practice",
      title: "Check for a substring: another example",
      prompt: "Call Contains on \"typescript\" to check for \"script\" and store the bool in answer.",
      solution: "bool answer = \"typescript\".Contains(\"script\");",
      checks: ["answer"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Contains on the string.","token":"Contains"},
      ],
      hints: [
        "Contains returns a boolean.",
        "Call Contains on the string.",
        "Complete this form:\n\n```csharp\nbool answer = \"typescript\".___(\"script\");\n```",
      ],
    },
    {
      id: "starts-practice",
      title: "Check a prefix: another example",
      prompt: "Use StartsWith to test whether \"practice.cs\" starts with \"practice\". Store the bool in answer.",
      solution: "bool answer = \"practice.cs\".StartsWith(\"practice\");",
      checks: ["answer"],
      rules: [
        {"kind":"InvocationExpression","message":"Call StartsWith on the string.","token":"StartsWith"},
      ],
      hints: [
        "A prefix is text at the beginning.",
        "Call StartsWith on the string.",
        "Complete this form:\n\n```csharp\nbool answer = \"practice.cs\".___(\"practice\");\n```",
      ],
    },
    {
      id: "split-practice",
      title: "Split a string: another example",
      prompt: "Split \"a,b,c\" on the comma character into string[] partsSample.",
      solution: "string[] partsSample = \"a,b,c\".Split(',');",
      checks: ["partsSample.SequenceEqual(new[] { \"a\", \"b\", \"c\" })"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Split on the string.","token":"Split"},
      ],
      hints: [
        "Split can take a character delimiter.",
        "Call Split on the string.",
        "Complete this form:\n\n```csharp\nstring[] partsSample = \"a,b,c\".Split('___');\n```",
      ],
    },
    {
      id: "join-practice",
      title: "Join strings: another example",
      prompt: "Declare string[] labels containing \"a\", \"b\", and \"c\". Use string.Join with \"-\" to create string result.",
      solution: "string[] labels = { \"a\", \"b\", \"c\" };\nstring result = string.Join(\"-\", labels);",
      checks: ["result == \"a-b-c\""],
      rules: [
        {"kind":"InvocationExpression","message":"Call Join on the string.","token":"Join"},
      ],
      hints: [
        "Join takes the separator before the collection.",
        "Call Join on the string.",
        "Complete this form:\n\n```csharp\nstring[] labels = { \"a\", \"b\", \"c\" };\nstring result = string.Join(\"___\", ___);\n```",
      ],
    },
    {
      id: "substring-practice",
      title: "Extract a substring: another example",
      prompt: "Use Substring on \"practice\" to take the first four characters into string answer.",
      solution: "string answer = \"practice\".Substring(0, 4);",
      checks: ["answer == \"prac\""],
      rules: [
        {"kind":"InvocationExpression","message":"Call Substring on the string.","token":"Substring"},
      ],
      hints: [
        "Pass a starting index and a length.",
        "Call Substring on the string.",
        "Complete this form:\n\n```csharp\nstring answer = \"practice\".Substring(___, ___);\n```",
      ],
    },
    {
      id: "range-practice",
      title: "Slice with a range: another example",
      prompt: "Declare string message = \"practice\". Use [..4] to create string result containing \"prac\".",
      solution: "string message = \"practice\";\nstring result = message[..4];",
      checks: ["result == \"prac\""],
      rules: [
        {"kind":"RangeExpression","message":"Use .. followed by the exclusive end index."},
      ],
      hints: [
        "An omitted start means the beginning.",
        "Use .. followed by the exclusive end index.",
        "Complete this form:\n\n```csharp\nstring message = \"practice\";\nstring result = message[..___];\n```",
      ],
    },
  ],
};

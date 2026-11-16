/** @type {import("../types.js").Topic} */
export const conversions = {
  id: "conversions",
  title: "Types & conversions",
  description: "Casts, parsing, nullable values, and type checks.",
  exercises: [
    {
      id: "widen",
      title: "Widen an integer",
      prompt: "Declare int count = 12, then assign count to a double named result without a cast.",
      solution: "int count = 12;\ndouble result = count;",
      checks: ["result == 12d"],
      rules: [
        {"kind":"VariableDeclarator","message":"Declare result using double.","name":"result","type":"double"},
      ],
      hints: [
        "An int converts to double implicitly.",
        "Declare result using double.",
        "Complete this form:\n\n```csharp\nint count = 12;\ndouble result = ___;\n```",
      ],
    },
    {
      id: "cast-int",
      title: "Cast to integer",
      prompt: "Declare double value = 8.75, then explicitly cast it to int result.",
      solution: "double value = 8.75;\nint result = (int)value;",
      checks: ["result == 8"],
      rules: [
        {"kind":"CastExpression","message":"Put the target type in parentheses before the value."},
      ],
      hints: [
        "An integer cast discards the fractional part.",
        "Put the target type in parentheses before the value.",
        "Complete this form:\n\n```csharp\ndouble value = 8.75;\nint result = (___)value;\n```",
      ],
    },
    {
      id: "parse-int",
      title: "Parse an integer",
      prompt: "Use int.Parse to convert \"42\" into int result.",
      solution: "int result = int.Parse(\"42\");",
      checks: ["result == 42"],
      rules: [
        {"kind":"InvocationExpression","message":"Call int.Parse with the string.","token":"Parse"},
      ],
      hints: [
        "Parse is a static method on the target type.",
        "Call int.Parse with the string.",
        "Complete this form:\n\n```csharp\nint result = int.Parse(\"___\");\n```",
      ],
    },
    {
      id: "try-parse",
      title: "Try parsing",
      prompt: "Use int.TryParse on \"27\", declare int result inline with out, and store the returned bool in success.",
      solution: "bool success = int.TryParse(\"27\", out int result);",
      checks: ["success && result == 27"],
      rules: [
        {"kind":"InvocationExpression","message":"Call int.TryParse with an out int result argument.","token":"TryParse"},
        {"kind":"DeclarationExpression","message":"Declare result inside the out argument."},
      ],
      hints: [
        "TryParse returns whether parsing succeeded.",
        "Call int.TryParse with an out int result argument. Declare result inside the out argument.",
        "Complete this form:\n\n```csharp\nbool success = int.TryParse(\"27\", out int ___);\n```",
      ],
    },
    {
      id: "parse-bool",
      title: "Parse a boolean",
      prompt: "Use bool.Parse to convert \"true\" into bool result.",
      solution: "bool result = bool.Parse(\"true\");",
      checks: ["result"],
      rules: [
        {"kind":"InvocationExpression","message":"Call bool.Parse with the string.","token":"Parse"},
      ],
      hints: [
        "The bool type also provides Parse.",
        "Call bool.Parse with the string.",
        "Complete this form:\n\n```csharp\nbool result = bool.Parse(\"___\");\n```",
      ],
    },
    {
      id: "to-string",
      title: "Convert to text",
      prompt: "Declare int value = 123, then call ToString on it to create string result.",
      solution: "int value = 123;\nstring result = value.ToString();",
      checks: ["result == \"123\""],
      rules: [
        {"kind":"InvocationExpression","message":"Call ToString() on value.","token":"ToString"},
      ],
      hints: [
        "Instance methods follow a dot after the value.",
        "Call ToString() on value.",
        "Complete this form:\n\n```csharp\nint value = 123;\nstring result = value.___();\n```",
      ],
    },
    {
      id: "convert",
      title: "Use Convert",
      prompt: "Use Convert.ToInt32 to convert \"18\" into int result.",
      solution: "int result = Convert.ToInt32(\"18\");",
      checks: ["result == 18"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Convert.ToInt32 with the string.","token":"ToInt32"},
      ],
      hints: [
        "Convert supplies static conversion methods.",
        "Call Convert.ToInt32 with the string.",
        "Complete this form:\n\n```csharp\nint result = Convert.___(\"18\");\n```",
      ],
    },
    {
      id: "decimal-double",
      title: "Convert decimal to double",
      prompt: "Declare decimal amount = 2.5m, then explicitly cast it to double result.",
      solution: "decimal amount = 2.5m;\ndouble result = (double)amount;",
      checks: ["result == 2.5"],
      rules: [
        {"kind":"CastExpression","message":"Use an explicit (double) cast."},
      ],
      hints: [
        "Decimal and double need explicit conversion.",
        "Use an explicit (double) cast.",
        "Complete this form:\n\n```csharp\ndecimal amount = 2.5m;\ndouble result = (___)amount;\n```",
      ],
    },
    {
      id: "checked",
      title: "Use checked arithmetic",
      prompt: "Declare int value = 20 and int result using checked(value * 2).",
      solution: "int value = 20;\nint result = checked(value * 2);",
      checks: ["result == 40"],
      rules: [
        {"kind":"CheckedExpression","message":"Wrap the multiplication in checked(...)."},
      ],
      hints: [
        "Checked detects integer overflow.",
        "Wrap the multiplication in checked(...).",
        "Complete this form:\n\n```csharp\nint value = 20;\nint result = checked(___);\n```",
      ],
    },
    {
      id: "unchecked",
      title: "Use unchecked arithmetic",
      prompt: "Declare int value = int.MaxValue and int result using unchecked(value + 1).",
      solution: "int value = int.MaxValue;\nint result = unchecked(value + 1);",
      checks: ["result == int.MinValue"],
      rules: [
        {"kind":"UncheckedExpression","message":"Wrap the addition in unchecked(...)."},
      ],
      hints: [
        "Unchecked permits integer wraparound.",
        "Wrap the addition in unchecked(...).",
        "Complete this form:\n\n```csharp\nint value = int.MaxValue;\nint result = unchecked(___);\n```",
      ],
    },
    {
      id: "is-type",
      title: "Check a runtime type",
      prompt: "Declare object value = \"hello\", then bool result using the is string type check.",
      solution: "object value = \"hello\";\nbool result = value is string;",
      checks: ["result"],
      rules: [
        {"kind":"IsExpression","message":"Use value is string."},
      ],
      hints: [
        "The is operator checks a compatible type.",
        "Use value is string.",
        "Complete this form:\n\n```csharp\nobject value = \"hello\";\nbool result = value is ___;\n```",
      ],
    },
    {
      id: "is-pattern",
      title: "Bind a type pattern",
      prompt: "Declare object value = \"hello\" and int length = 0. In an if, match value as string text and assign text.Length to length.",
      solution: "object value = \"hello\";\nint length = 0;\nif (value is string text) length = text.Length;",
      checks: ["length == 5"],
      rules: [
        {"kind":"DeclarationPattern","message":"Use is string text to declare the matched value."},
      ],
      hints: [
        "A type pattern can name the converted value.",
        "Use is string text to declare the matched value.",
        "Complete this form:\n\n```csharp\nobject value = \"hello\";\nint length = 0;\nif (value is string ___) length = ___.Length;\n```",
      ],
    },
    {
      id: "as",
      title: "Use a safe cast",
      prompt: "Declare object value = \"hello\" and string? result using value as string.",
      solution: "object value = \"hello\";\nstring? result = value as string;",
      checks: ["result == \"hello\""],
      rules: [
        {"kind":"AsExpression","message":"Use the as operator followed by string."},
      ],
      hints: [
        "As returns null if a reference conversion fails.",
        "Use the as operator followed by string.",
        "Complete this form:\n\n```csharp\nobject value = \"hello\";\nstring? result = value as ___;\n```",
      ],
    },
    {
      id: "typeof",
      title: "Get a type object",
      prompt: "Declare Type result using typeof(int).",
      solution: "Type result = typeof(int);",
      checks: ["result == typeof(int)"],
      rules: [
        {"kind":"TypeOfExpression","message":"Pass a type to typeof(...)."},
      ],
      hints: [
        "Type names can be inspected without creating a value.",
        "Pass a type to typeof(...).",
        "Complete this form:\n\n```csharp\nType result = typeof(___);\n```",
      ],
    },
    {
      id: "nameof",
      title: "Get a symbol name",
      prompt: "Declare int count = 3 and string result using nameof(count).",
      solution: "int count = 3;\nstring result = nameof(count);",
      checks: ["result == \"count\""],
      rules: [
        {"kind":"InvocationExpression","message":"Pass count to nameof(...).","token":"nameof"},
      ],
      hints: [
        "Nameof produces the symbol's name as text.",
        "Pass count to nameof(...).",
        "Complete this form:\n\n```csharp\nint count = 3;\nstring result = nameof(___);\n```",
      ],
    },
    {
      id: "nullable-value",
      title: "Read a nullable value",
      prompt: "Declare int? count = 7 and int result using count.Value.",
      solution: "int? count = 7;\nint result = count.Value;",
      checks: ["result == 7"],
      rules: [
        {"kind":"SimpleMemberAccessExpression","message":"Access the Value property.","token":"Value"},
      ],
      hints: [
        "Only read Value when the nullable has a value.",
        "Access the Value property.",
        "Complete this form:\n\n```csharp\nint? count = 7;\nint result = count.___;\n```",
      ],
    },
    {
      id: "nullable-default",
      title: "Use GetValueOrDefault",
      prompt: "Declare int? count = null. Call GetValueOrDefault(9) to create int result.",
      solution: "int? count = null;\nint result = count.GetValueOrDefault(9);",
      checks: ["result == 9"],
      rules: [
        {"kind":"InvocationExpression","message":"Call GetValueOrDefault with the fallback.","token":"GetValueOrDefault"},
      ],
      hints: [
        "The method supplies a fallback for null.",
        "Call GetValueOrDefault with the fallback.",
        "Complete this form:\n\n```csharp\nint? count = null;\nint result = count.___(9);\n```",
      ],
    },
    {
      id: "box",
      title: "Box a value",
      prompt: "Declare int count = 5, then object boxed initialized from count.",
      solution: "int count = 5;\nobject boxed = count;",
      checks: ["boxed is int && (int)boxed == 5"],
      rules: [
        {"kind":"VariableDeclarator","message":"Declare boxed using object.","name":"boxed","type":"object"},
      ],
      hints: [
        "Assigning a value type to object boxes it.",
        "Declare boxed using object.",
        "Complete this form:\n\n```csharp\nint count = 5;\nobject boxed = ___;\n```",
      ],
    },
    {
      id: "unbox",
      title: "Unbox a value",
      prompt: "Declare object boxed = 5, then explicitly cast boxed into int result.",
      solution: "object boxed = 5;\nint result = (int)boxed;",
      checks: ["result == 5"],
      rules: [
        {"kind":"CastExpression","message":"Use an explicit (int) cast on boxed."},
      ],
      hints: [
        "Unboxing uses the original value type.",
        "Use an explicit (int) cast on boxed.",
        "Complete this form:\n\n```csharp\nobject boxed = 5;\nint result = (___)boxed;\n```",
      ],
    },
    {
      id: "parse-decimal",
      title: "Parse with a culture",
      prompt: "Parse \"12.50\" into decimal result using decimal.Parse and CultureInfo.InvariantCulture.",
      solution: "decimal result = decimal.Parse(\"12.50\", CultureInfo.InvariantCulture);",
      checks: ["result == 12.50m"],
      rules: [
        {"kind":"InvocationExpression","message":"Pass CultureInfo.InvariantCulture as the second Parse argument.","token":"InvariantCulture"},
      ],
      hints: [
        "An explicit culture makes decimal parsing consistent.",
        "Pass CultureInfo.InvariantCulture as the second Parse argument.",
        "Complete this form:\n\n```csharp\ndecimal result = decimal.Parse(\"12.50\", CultureInfo.___);\n```",
      ],
    },
    {
      id: "widen-practice",
      title: "Widen an integer: another example",
      prompt: "Declare int itemCount = 12, then assign itemCount to a double named result without a cast.",
      solution: "int itemCount = 12;\ndouble result = itemCount;",
      checks: ["result == 12d"],
      rules: [
        {"kind":"VariableDeclarator","message":"Declare result using double.","name":"result","type":"double"},
      ],
      hints: [
        "An int converts to double implicitly.",
        "Declare result using double.",
        "Complete this form:\n\n```csharp\nint itemCount = 12;\ndouble result = ___;\n```",
      ],
    },
    {
      id: "cast-int-practice",
      title: "Cast to integer: another example",
      prompt: "Declare double input = 8.75, then explicitly cast it to int result.",
      solution: "double input = 8.75;\nint result = (int)input;",
      checks: ["result == 8"],
      rules: [
        {"kind":"CastExpression","message":"Put the target type in parentheses before the input."},
      ],
      hints: [
        "An integer cast discards the fractional part.",
        "Put the target type in parentheses before the input.",
        "Complete this form:\n\n```csharp\ndouble input = 8.75;\nint result = (___)input;\n```",
      ],
    },
    {
      id: "parse-int-practice",
      title: "Parse an integer: another example",
      prompt: "Use int.Parse to convert \"63\" into int answer.",
      solution: "int answer = int.Parse(\"63\");",
      checks: ["answer == 63"],
      rules: [
        {"kind":"InvocationExpression","message":"Call int.Parse with the string.","token":"Parse"},
      ],
      hints: [
        "Parse is a static method on the target type.",
        "Call int.Parse with the string.",
        "Complete this form:\n\n```csharp\nint answer = int.Parse(\"___\");\n```",
      ],
    },
    {
      id: "try-parse-practice",
      title: "Try parsing: another example",
      prompt: "Use int.TryParse on \"38\", declare int result inline with out, and store the returned bool in successSample.",
      solution: "bool successSample = int.TryParse(\"38\", out int result);",
      checks: ["successSample && result == 38"],
      rules: [
        {"kind":"InvocationExpression","message":"Call int.TryParse with an out int result argument.","token":"TryParse"},
        {"kind":"DeclarationExpression","message":"Declare result inside the out argument."},
      ],
      hints: [
        "TryParse returns whether parsing succeeded.",
        "Call int.TryParse with an out int result argument. Declare result inside the out argument.",
        "Complete this form:\n\n```csharp\nbool successSample = int.TryParse(\"38\", out int ___);\n```",
      ],
    },
    {
      id: "parse-bool-practice",
      title: "Parse a boolean: another example",
      prompt: "Use bool.Parse to convert \"true\" into bool answer.",
      solution: "bool answer = bool.Parse(\"true\");",
      checks: ["answer"],
      rules: [
        {"kind":"InvocationExpression","message":"Call bool.Parse with the string.","token":"Parse"},
      ],
      hints: [
        "The bool type also provides Parse.",
        "Call bool.Parse with the string.",
        "Complete this form:\n\n```csharp\nbool answer = bool.Parse(\"___\");\n```",
      ],
    },
    {
      id: "to-string-practice",
      title: "Convert to text: another example",
      prompt: "Declare int input = 123, then call ToString on it to create string result.",
      solution: "int input = 123;\nstring result = input.ToString();",
      checks: ["result == \"123\""],
      rules: [
        {"kind":"InvocationExpression","message":"Call ToString() on input.","token":"ToString"},
      ],
      hints: [
        "Instance methods follow a dot after the input.",
        "Call ToString() on input.",
        "Complete this form:\n\n```csharp\nint input = 123;\nstring result = input.___();\n```",
      ],
    },
    {
      id: "convert-practice",
      title: "Use Convert: another example",
      prompt: "Use Convert.ToInt32 to convert \"18\" into int answer.",
      solution: "int answer = Convert.ToInt32(\"18\");",
      checks: ["answer == 18"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Convert.ToInt32 with the string.","token":"ToInt32"},
      ],
      hints: [
        "Convert supplies static conversion methods.",
        "Call Convert.ToInt32 with the string.",
        "Complete this form:\n\n```csharp\nint answer = Convert.___(\"18\");\n```",
      ],
    },
    {
      id: "decimal-double-practice",
      title: "Convert decimal to double: another example",
      prompt: "Declare decimal amountSample = 2.5m, then explicitly cast it to double result.",
      solution: "decimal amountSample = 2.5m;\ndouble result = (double)amountSample;",
      checks: ["result == 2.5"],
      rules: [
        {"kind":"CastExpression","message":"Use an explicit (double) cast."},
      ],
      hints: [
        "Decimal and double need explicit conversion.",
        "Use an explicit (double) cast.",
        "Complete this form:\n\n```csharp\ndecimal amountSample = 2.5m;\ndouble result = (___)amountSample;\n```",
      ],
    },
    {
      id: "checked-practice",
      title: "Use checked arithmetic: another example",
      prompt: "Declare int input = 20 and int result using checked(input * 2).",
      solution: "int input = 20;\nint result = checked(input * 2);",
      checks: ["result == 40"],
      rules: [
        {"kind":"CheckedExpression","message":"Wrap the multiplication in checked(...)."},
      ],
      hints: [
        "Checked detects integer overflow.",
        "Wrap the multiplication in checked(...).",
        "Complete this form:\n\n```csharp\nint input = 20;\nint result = checked(___);\n```",
      ],
    },
    {
      id: "unchecked-practice",
      title: "Use unchecked arithmetic: another example",
      prompt: "Declare int input = int.MaxValue and int result using unchecked(input + 1).",
      solution: "int input = int.MaxValue;\nint result = unchecked(input + 1);",
      checks: ["result == int.MinValue"],
      rules: [
        {"kind":"UncheckedExpression","message":"Wrap the addition in unchecked(...)."},
      ],
      hints: [
        "Unchecked permits integer wraparound.",
        "Wrap the addition in unchecked(...).",
        "Complete this form:\n\n```csharp\nint input = int.MaxValue;\nint result = unchecked(___);\n```",
      ],
    },
    {
      id: "is-type-practice",
      title: "Check a runtime type: another example",
      prompt: "Declare object input = \"hello\", then bool result using the is string type check.",
      solution: "object input = \"hello\";\nbool result = input is string;",
      checks: ["result"],
      rules: [
        {"kind":"IsExpression","message":"Use input is string."},
      ],
      hints: [
        "The is operator checks a compatible type.",
        "Use input is string.",
        "Complete this form:\n\n```csharp\nobject input = \"hello\";\nbool result = input is ___;\n```",
      ],
    },
    {
      id: "is-pattern-practice",
      title: "Bind a type pattern: another example",
      prompt: "Declare object input = \"hello\" and int length = 0. In an if, match input as string text and assign text.Length to length.",
      solution: "object input = \"hello\";\nint length = 0;\nif (input is string text) length = text.Length;",
      checks: ["length == 5"],
      rules: [
        {"kind":"DeclarationPattern","message":"Use is string text to declare the matched input."},
      ],
      hints: [
        "A type pattern can name the converted input.",
        "Use is string text to declare the matched input.",
        "Complete this form:\n\n```csharp\nobject input = \"hello\";\nint length = 0;\nif (input is string ___) length = ___.Length;\n```",
      ],
    },
    {
      id: "as-practice",
      title: "Use a safe cast: another example",
      prompt: "Declare object input = \"hello\" and string? result using input as string.",
      solution: "object input = \"hello\";\nstring? result = input as string;",
      checks: ["result == \"hello\""],
      rules: [
        {"kind":"AsExpression","message":"Use the as operator followed by string."},
      ],
      hints: [
        "As returns null if a reference conversion fails.",
        "Use the as operator followed by string.",
        "Complete this form:\n\n```csharp\nobject input = \"hello\";\nstring? result = input as ___;\n```",
      ],
    },
    {
      id: "typeof-practice",
      title: "Get a type object: another example",
      prompt: "Declare Type answer using typeof(int).",
      solution: "Type answer = typeof(int);",
      checks: ["answer == typeof(int)"],
      rules: [
        {"kind":"TypeOfExpression","message":"Pass a type to typeof(...)."},
      ],
      hints: [
        "Type names can be inspected without creating a value.",
        "Pass a type to typeof(...).",
        "Complete this form:\n\n```csharp\nType answer = typeof(___);\n```",
      ],
    },
    {
      id: "nameof-practice",
      title: "Get a symbol name: another example",
      prompt: "Declare int itemCount = 3 and string result using nameof(itemCount).",
      solution: "int itemCount = 3;\nstring result = nameof(itemCount);",
      checks: ["result == \"itemCount\""],
      rules: [
        {"kind":"InvocationExpression","message":"Pass itemCount to nameof(...).","token":"nameof"},
      ],
      hints: [
        "Nameof produces the symbol's name as text.",
        "Pass itemCount to nameof(...).",
        "Complete this form:\n\n```csharp\nint itemCount = 3;\nstring result = nameof(___);\n```",
      ],
    },
    {
      id: "nullable-value-practice",
      title: "Read a nullable value: another example",
      prompt: "Declare int? itemCount = 7 and int result using itemCount.Value.",
      solution: "int? itemCount = 7;\nint result = itemCount.Value;",
      checks: ["result == 7"],
      rules: [
        {"kind":"SimpleMemberAccessExpression","message":"Access the Value property.","token":"Value"},
      ],
      hints: [
        "Only read Value when the nullable has a value.",
        "Access the Value property.",
        "Complete this form:\n\n```csharp\nint? itemCount = 7;\nint result = itemCount.___;\n```",
      ],
    },
    {
      id: "nullable-default-practice",
      title: "Use GetValueOrDefault: another example",
      prompt: "Declare int? itemCount = null. Call GetValueOrDefault(9) to create int result.",
      solution: "int? itemCount = null;\nint result = itemCount.GetValueOrDefault(9);",
      checks: ["result == 9"],
      rules: [
        {"kind":"InvocationExpression","message":"Call GetValueOrDefault with the fallback.","token":"GetValueOrDefault"},
      ],
      hints: [
        "The method supplies a fallback for null.",
        "Call GetValueOrDefault with the fallback.",
        "Complete this form:\n\n```csharp\nint? itemCount = null;\nint result = itemCount.___(9);\n```",
      ],
    },
    {
      id: "box-practice",
      title: "Box a value: another example",
      prompt: "Declare int itemCount = 5, then object boxed initialized from itemCount.",
      solution: "int itemCount = 5;\nobject boxed = itemCount;",
      checks: ["boxed is int && (int)boxed == 5"],
      rules: [
        {"kind":"VariableDeclarator","message":"Declare boxed using object.","name":"boxed","type":"object"},
      ],
      hints: [
        "Assigning a value type to object boxes it.",
        "Declare boxed using object.",
        "Complete this form:\n\n```csharp\nint itemCount = 5;\nobject boxed = ___;\n```",
      ],
    },
    {
      id: "unbox-practice",
      title: "Unbox a value: another example",
      prompt: "Declare object boxedSample = 5, then explicitly cast boxedSample into int result.",
      solution: "object boxedSample = 5;\nint result = (int)boxedSample;",
      checks: ["result == 5"],
      rules: [
        {"kind":"CastExpression","message":"Use an explicit (int) cast on boxedSample."},
      ],
      hints: [
        "Unboxing uses the original value type.",
        "Use an explicit (int) cast on boxedSample.",
        "Complete this form:\n\n```csharp\nobject boxedSample = 5;\nint result = (___)boxedSample;\n```",
      ],
    },
    {
      id: "parse-decimal-practice",
      title: "Parse with a culture: another example",
      prompt: "Parse \"12.50\" into decimal answer using decimal.Parse and CultureInfo.InvariantCulture.",
      solution: "decimal answer = decimal.Parse(\"12.50\", CultureInfo.InvariantCulture);",
      checks: ["answer == 12.50m"],
      rules: [
        {"kind":"InvocationExpression","message":"Pass CultureInfo.InvariantCulture as the second Parse argument.","token":"InvariantCulture"},
      ],
      hints: [
        "An explicit culture makes decimal parsing consistent.",
        "Pass CultureInfo.InvariantCulture as the second Parse argument.",
        "Complete this form:\n\n```csharp\ndecimal answer = decimal.Parse(\"12.50\", CultureInfo.___);\n```",
      ],
    },
  ],
};

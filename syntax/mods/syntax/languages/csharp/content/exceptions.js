/** @type {import("../types.js").Topic} */
export const exceptions = {
  id: "exceptions",
  title: "Exceptions & cleanup",
  description: "Try, catch, finally, throw, filters, and disposal.",
  exercises: [
    {
      id: "catch",
      title: "Catch an exception",
      prompt: "Declare bool caught = false. Call int.Parse(\"bad\") inside try and catch FormatException to set caught = true.",
      solution: "bool caught = false;\ntry { int.Parse(\"bad\"); } catch (FormatException) { caught = true; }",
      checks: ["caught"],
      rules: [
        {"kind":"CatchClause","message":"Write catch (FormatException) after the try body."},
      ],
      hints: [
        "Catch handles a matching exception from the try body.",
        "Write catch (FormatException) after the try body.",
        "Complete this form:\n\n```csharp\nbool caught = false;\ntry { int.Parse(\"bad\"); } catch (___) { caught = true; }\n```",
      ],
    },
    {
      id: "catch-variable",
      title: "Name a caught exception",
      prompt: "Declare string message = \"\". Throw new InvalidOperationException(\"oops\") inside try. Catch it as error and assign error.Message to message.",
      solution: "string message = \"\";\ntry { throw new InvalidOperationException(\"oops\"); } catch (InvalidOperationException error) { message = error.Message; }",
      checks: ["message == \"oops\""],
      rules: [
        {"kind":"CatchDeclaration","message":"Put error after the exception type in catch.","token":"error"},
      ],
      hints: [
        "The named catch variable gives access to the exception.",
        "Put error after the exception type in catch.",
        "Complete this form:\n\n```csharp\nstring message = \"\";\ntry { throw new InvalidOperationException(\"oops\"); } catch (InvalidOperationException error) { message = error.___; }\n```",
      ],
    },
    {
      id: "finally",
      title: "Run finally",
      prompt: "Declare bool cleaned = false. Write try with an empty body and finally setting cleaned = true.",
      solution: "bool cleaned = false;\ntry { } finally { cleaned = true; }",
      checks: ["cleaned"],
      rules: [
        {"kind":"FinallyClause","message":"Put finally after the try block."},
      ],
      hints: [
        "Finally runs when control leaves the try block.",
        "Put finally after the try block.",
        "Complete this form:\n\n```csharp\nbool cleaned = false;\ntry { } finally { cleaned = ___; }\n```",
      ],
    },
    {
      id: "catch-finally",
      title: "Combine catch and finally",
      prompt: "Declare bool caught = false and bool cleaned = false. Parse \"bad\" in try, catch FormatException to set caught, then finally to set cleaned.",
      solution: "bool caught = false, cleaned = false;\ntry { int.Parse(\"bad\"); } catch (FormatException) { caught = true; } finally { cleaned = true; }",
      checks: ["caught && cleaned"],
      rules: [
        {"kind":"CatchClause","message":"Place catch immediately after try."},
        {"kind":"FinallyClause","message":"Place finally after catch."},
      ],
      hints: [
        "Finally follows all catch clauses.",
        "Place catch immediately after try. Place finally after catch.",
        "Complete this form:\n\n```csharp\nbool caught = false, cleaned = false;\ntry { int.Parse(\"bad\"); } catch (FormatException) { caught = true; } finally { ___; }\n```",
      ],
    },
    {
      id: "throw",
      title: "Throw an exception",
      prompt: "Declare bool caught = false. Inside try, use a throw statement for new ArgumentException(\"bad\"). Catch ArgumentException to set caught.",
      solution: "bool caught = false;\ntry { throw new ArgumentException(\"bad\"); } catch (ArgumentException) { caught = true; }",
      checks: ["caught"],
      rules: [
        {"kind":"ThrowStatement","message":"Put throw before new ArgumentException(...)."},
      ],
      hints: [
        "Throw transfers control to a matching handler.",
        "Put throw before new ArgumentException(...).",
        "Complete this form:\n\n```csharp\nbool caught = false;\ntry { throw new ArgumentException(\"___\"); } catch (ArgumentException) { caught = true; }\n```",
      ],
    },
    {
      id: "parameter-name",
      title: "Name an invalid parameter",
      prompt: "Declare string parameter = \"\". Throw ArgumentOutOfRangeException(nameof(parameter)) in try. Catch it as error and store error.ParamName in parameter.",
      solution: "string parameter = \"\";\ntry { throw new ArgumentOutOfRangeException(nameof(parameter)); } catch (ArgumentOutOfRangeException error) { parameter = error.ParamName!; }",
      checks: ["parameter == \"parameter\""],
      rules: [
        {"kind":"InvocationExpression","message":"Use nameof(parameter) as the constructor argument.","token":"nameof"},
      ],
      hints: [
        "Nameof keeps parameter names tied to the symbol.",
        "Use nameof(parameter) as the constructor argument.",
        "Complete this form:\n\n```csharp\nstring parameter = \"\";\ntry { throw new ArgumentOutOfRangeException(nameof(___)); } catch (ArgumentOutOfRangeException error) { parameter = error.ParamName!; }\n```",
      ],
    },
    {
      id: "filter",
      title: "Filter a catch",
      prompt: "Declare bool caught = false. Throw InvalidOperationException(\"retry\") inside try. Catch it as error only when error.Message == \"retry\", setting caught.",
      solution: "bool caught = false;\ntry { throw new InvalidOperationException(\"retry\"); } catch (InvalidOperationException error) when (error.Message == \"retry\") { caught = true; }",
      checks: ["caught"],
      rules: [
        {"kind":"CatchFilterClause","message":"Add when (error.Message == \"retry\") after the catch declaration."},
      ],
      hints: [
        "A filter decides whether the handler applies.",
        "Add when (error.Message == \"retry\") after the catch declaration.",
        "Complete this form:\n\n```csharp\nbool caught = false;\ntry { throw new InvalidOperationException(\"retry\"); } catch (InvalidOperationException error) when (___) { caught = true; }\n```",
      ],
    },
    {
      id: "multiple",
      title: "Write multiple catches",
      prompt: "Declare string result = \"\". Parse \"bad\" in try, then catch FormatException assigning \"format\" and OverflowException assigning \"overflow\".",
      solution: "string result = \"\";\ntry { int.Parse(\"bad\"); } catch (FormatException) { result = \"format\"; } catch (OverflowException) { result = \"overflow\"; }",
      checks: ["result == \"format\""],
      rules: [
        {"kind":"CatchClause","message":"Write separate catch clauses for the two exception types.","min":2},
      ],
      hints: [
        "Each catch handles a different failure type.",
        "Write separate catch clauses for the two exception types.",
        "Complete this form:\n\n```csharp\nstring result = \"\";\ntry { int.Parse(\"bad\"); } catch (FormatException) { result = \"format\"; } catch (OverflowException) { result = \"___\"; }\n```",
      ],
    },
    {
      id: "catch-all",
      title: "Write a catch-all",
      prompt: "Declare bool caught = false. Throw new Exception() in try and handle it with a bare catch that sets caught.",
      solution: "bool caught = false;\ntry { throw new Exception(); } catch { caught = true; }",
      checks: ["caught"],
      rules: [
        {"kind":"CatchClause","message":"Write catch without an exception declaration."},
      ],
      hints: [
        "A bare catch has no parentheses.",
        "Write catch without an exception declaration.",
        "Complete this form:\n\n```csharp\nbool caught = false;\ntry { throw new Exception(); } catch { caught = ___; }\n```",
      ],
    },
    {
      id: "rethrow",
      title: "Rethrow an exception",
      prompt: "Declare bool caught = false. Use nested try/catch: the inner try throws InvalidOperationException, the inner catch rethrows using throw;, and the outer catch sets caught.",
      solution: "bool caught = false;\ntry { try { throw new InvalidOperationException(); } catch { throw; } } catch (InvalidOperationException) { caught = true; }",
      checks: ["caught"],
      rules: [
        {"kind":"ThrowStatement","message":"Use a bare throw; inside the inner catch.","token":";","min":2},
      ],
      hints: [
        "A bare rethrow preserves the current exception.",
        "Use a bare throw; inside the inner catch.",
        "Complete this form:\n\n```csharp\nbool caught = false;\ntry { try { throw new InvalidOperationException(); } catch { ___; } } catch (InvalidOperationException) { caught = true; }\n```",
      ],
    },
    {
      id: "throw-expression",
      title: "Use a throw expression",
      prompt: "Declare string? name = null and bool caught = false. In try declare string value = name ?? throw new ArgumentNullException(nameof(name)); catch ArgumentNullException to set caught.",
      solution: "string? name = null;\nbool caught = false;\ntry { string value = name ?? throw new ArgumentNullException(nameof(name)); } catch (ArgumentNullException) { caught = true; }",
      checks: ["caught"],
      rules: [
        {"kind":"ThrowExpression","message":"Put throw after ?? as the fallback expression."},
      ],
      hints: [
        "Throw can appear where an expression is expected.",
        "Put throw after ?? as the fallback expression.",
        "Complete this form:\n\n```csharp\nstring? name = null;\nbool caught = false;\ntry { string value = name ?? throw new ArgumentNullException(nameof(name)); } catch (ArgumentNullException) { ___; }\n```",
      ],
    },
    {
      id: "overflow",
      title: "Catch checked overflow",
      prompt: "Declare int value = int.MaxValue and bool caught = false. In try, increment value inside a checked block. Catch OverflowException to set caught.",
      solution: "int value = int.MaxValue;\nbool caught = false;\ntry { checked { value++; } } catch (OverflowException) { caught = true; }",
      checks: ["caught"],
      rules: [
        {"kind":"CheckedStatement","message":"Use checked { ... } around the increment."},
      ],
      hints: [
        "A checked block turns integer overflow into an exception.",
        "Use checked { ... } around the increment.",
        "Complete this form:\n\n```csharp\nint value = int.MaxValue;\nbool caught = false;\ntry { checked { ___; } } catch (OverflowException) { caught = true; }\n```",
      ],
    },
    {
      id: "using-statement",
      title: "Dispose with using",
      prompt: "Declare bool closed. Use a using statement around new System.IO.MemoryStream(), naming it stream. Set closed = stream.CanWrite inside the body.",
      solution: "bool closed;\nusing (var stream = new System.IO.MemoryStream()) { closed = stream.CanWrite; }",
      checks: ["closed"],
      rules: [
        {"kind":"UsingStatement","message":"Put the resource declaration in using parentheses."},
      ],
      hints: [
        "Using disposes the resource when its body ends.",
        "Put the resource declaration in using parentheses.",
        "Complete this form:\n\n```csharp\nbool closed;\nusing (var stream = new System.IO.MemoryStream()) { closed = stream.___; }\n```",
      ],
    },
    {
      id: "using-declaration",
      title: "Declare a using resource",
      prompt: "Use a using declaration named stream for new System.IO.MemoryStream(). Then declare bool writable = stream.CanWrite.",
      solution: "using var stream = new System.IO.MemoryStream();\nbool writable = stream.CanWrite;",
      checks: ["writable"],
      rules: [
        {"kind":"LocalDeclarationStatement","message":"Put using before var stream.","token":"using"},
      ],
      hints: [
        "A using declaration lasts until the enclosing scope ends.",
        "Put using before var stream.",
        "Complete this form:\n\n```csharp\nusing var stream = new System.IO.MemoryStream();\nbool writable = stream.___;\n```",
      ],
    },
    {
      id: "nested-using",
      title: "Nest resource scopes",
      prompt: "Declare bool writable = false. Write two nested using statements, each constructing a MemoryStream named first and second. Assign first.CanWrite && second.CanWrite to writable.",
      solution: "bool writable = false;\nusing (var first = new System.IO.MemoryStream()) { using (var second = new System.IO.MemoryStream()) { writable = first.CanWrite && second.CanWrite; } }",
      checks: ["writable"],
      rules: [
        {"kind":"UsingStatement","message":"Write one using statement inside the other.","min":2},
      ],
      hints: [
        "Each resource gets its own disposal scope.",
        "Write one using statement inside the other.",
        "Complete this form:\n\n```csharp\nbool writable = false;\nusing (var first = new System.IO.MemoryStream()) { using (var second = new System.IO.MemoryStream()) { writable = ___; } }\n```",
      ],
    },
    {
      id: "finally-after-error",
      title: "Clean up after an exception",
      prompt: "Declare int stage = 0. In try throw an Exception. In catch set stage = 1, and in finally increment stage.",
      solution: "int stage = 0;\ntry { throw new Exception(); } catch { stage = 1; } finally { stage++; }",
      checks: ["stage == 2"],
      rules: [
        {"kind":"FinallyClause","message":"Increment stage inside finally."},
      ],
      hints: [
        "Finally still runs after the catch handles the exception.",
        "Increment stage inside finally.",
        "Complete this form:\n\n```csharp\nint stage = 0;\ntry { throw new Exception(); } catch { stage = 1; } finally { ___; }\n```",
      ],
    },
    {
      id: "nested-try",
      title: "Nest try blocks",
      prompt: "Declare bool caught = false and bool cleaned = false. Inside an outer try, use an inner try that throws and an inner finally that sets cleaned. The outer catch sets caught.",
      solution: "bool caught = false, cleaned = false;\ntry { try { throw new Exception(); } finally { cleaned = true; } } catch { caught = true; }",
      checks: ["caught && cleaned"],
      rules: [
        {"kind":"TryStatement","message":"Put the inner try/finally inside the outer try body.","min":2},
      ],
      hints: [
        "An exception passes through finally before reaching an outer handler.",
        "Put the inner try/finally inside the outer try body.",
        "Complete this form:\n\n```csharp\nbool caught = false, cleaned = false;\ntry { try { throw new Exception(); } finally { ___; } } catch { caught = true; }\n```",
      ],
    },
    {
      id: "filter-type",
      title: "Filter by exception type",
      prompt: "Declare bool caught = false. Throw a FormatException inside try. Catch Exception error with a when filter testing error is FormatException, setting caught.",
      solution: "bool caught = false;\ntry { throw new FormatException(); } catch (Exception error) when (error is FormatException) { caught = true; }",
      checks: ["caught"],
      rules: [
        {"kind":"CatchFilterClause","message":"Use a when filter after catch."},
        {"kind":"IsExpression","message":"Test error is FormatException."},
      ],
      hints: [
        "A catch filter can inspect the runtime type.",
        "Use a when filter after catch. Test error is FormatException.",
        "Complete this form:\n\n```csharp\nbool caught = false;\ntry { throw new FormatException(); } catch (Exception error) when (error is ___) { caught = true; }\n```",
      ],
    },
    {
      id: "inner",
      title: "Wrap an inner exception",
      prompt: "Declare Exception? saved = null. In try throw new InvalidOperationException(\"outer\", new Exception(\"inner\")); catch it as error and assign saved = error.InnerException.",
      solution: "Exception? saved = null;\ntry { throw new InvalidOperationException(\"outer\", new Exception(\"inner\")); } catch (InvalidOperationException error) { saved = error.InnerException; }",
      checks: ["saved?.Message == \"inner\""],
      rules: [
        {"kind":"ObjectCreationExpression","message":"Pass the inner exception as the second constructor argument.","token":"InvalidOperationException"},
      ],
      hints: [
        "An inner exception preserves the underlying cause.",
        "Pass the inner exception as the second constructor argument.",
        "Complete this form:\n\n```csharp\nException? saved = null;\ntry { throw new InvalidOperationException(\"outer\", new Exception(\"___\")); } catch (InvalidOperationException error) { saved = error.___; }\n```",
      ],
    },
    {
      id: "custom",
      title: "Declare a custom exception",
      prompt: "Declare public class PracticeException : Exception with public PracticeException(string message) : base(message).",
      solution: "public class PracticeException : Exception { public PracticeException(string message) : base(message) { } }",
      checks: ["new PracticeException(\"hello\").Message == \"hello\""],
      rules: [
        {"kind":"ClassDeclaration","message":"Inherit from Exception.","name":"PracticeException"},
        {"kind":"BaseConstructorInitializer","message":"Forward message to base(message)."},
      ],
      hints: [
        "Custom exceptions can reuse Exception's message storage.",
        "Inherit from Exception. Forward message to base(message).",
        "Complete this form:\n\n```csharp\npublic class PracticeException : Exception { public PracticeException(string message) : base(___) { } }\n```",
      ],
      mode: "types",
    },
    {
      id: "catch-practice",
      title: "Catch an exception: another example",
      prompt: "Declare bool caughtSample = false. Call int.Parse(\"bad\") inside try and catch FormatException to set caughtSample = true.",
      solution: "bool caughtSample = false;\ntry { int.Parse(\"bad\"); } catch (FormatException) { caughtSample = true; }",
      checks: ["caughtSample"],
      rules: [
        {"kind":"CatchClause","message":"Write catch (FormatException) after the try body."},
      ],
      hints: [
        "Catch handles a matching exception from the try body.",
        "Write catch (FormatException) after the try body.",
        "Complete this form:\n\n```csharp\nbool caughtSample = false;\ntry { int.Parse(\"bad\"); } catch (___) { caughtSample = true; }\n```",
      ],
    },
    {
      id: "catch-variable-practice",
      title: "Name a caught exception: another example",
      prompt: "Declare string messageSample = \"\". Throw new InvalidOperationException(\"oops\") inside try. Catch it as error and assign error.Message to messageSample.",
      solution: "string messageSample = \"\";\ntry { throw new InvalidOperationException(\"oops\"); } catch (InvalidOperationException error) { messageSample = error.Message; }",
      checks: ["messageSample == \"oops\""],
      rules: [
        {"kind":"CatchDeclaration","message":"Put error after the exception type in catch.","token":"error"},
      ],
      hints: [
        "The named catch variable gives access to the exception.",
        "Put error after the exception type in catch.",
        "Complete this form:\n\n```csharp\nstring messageSample = \"\";\ntry { throw new InvalidOperationException(\"oops\"); } catch (InvalidOperationException error) { messageSample = error.___; }\n```",
      ],
    },
    {
      id: "finally-practice",
      title: "Run finally: another example",
      prompt: "Declare bool cleanedSample = false. Write try with an empty body and finally setting cleanedSample = true.",
      solution: "bool cleanedSample = false;\ntry { } finally { cleanedSample = true; }",
      checks: ["cleanedSample"],
      rules: [
        {"kind":"FinallyClause","message":"Put finally after the try block."},
      ],
      hints: [
        "Finally runs when control leaves the try block.",
        "Put finally after the try block.",
        "Complete this form:\n\n```csharp\nbool cleanedSample = false;\ntry { } finally { cleanedSample = ___; }\n```",
      ],
    },
    {
      id: "catch-finally-practice",
      title: "Combine catch and finally: another example",
      prompt: "Declare bool caughtSample = false and bool cleaned = false. Parse \"bad\" in try, catch FormatException to set caughtSample, then finally to set cleaned.",
      solution: "bool caughtSample = false, cleaned = false;\ntry { int.Parse(\"bad\"); } catch (FormatException) { caughtSample = true; } finally { cleaned = true; }",
      checks: ["caughtSample && cleaned"],
      rules: [
        {"kind":"CatchClause","message":"Place catch immediately after try."},
        {"kind":"FinallyClause","message":"Place finally after catch."},
      ],
      hints: [
        "Finally follows all catch clauses.",
        "Place catch immediately after try. Place finally after catch.",
        "Complete this form:\n\n```csharp\nbool caughtSample = false, cleaned = false;\ntry { int.Parse(\"bad\"); } catch (FormatException) { caughtSample = true; } finally { ___; }\n```",
      ],
    },
    {
      id: "throw-practice",
      title: "Throw an exception: another example",
      prompt: "Declare bool caughtSample = false. Inside try, use a throw statement for new ArgumentException(\"bad\"). Catch ArgumentException to set caughtSample.",
      solution: "bool caughtSample = false;\ntry { throw new ArgumentException(\"bad\"); } catch (ArgumentException) { caughtSample = true; }",
      checks: ["caughtSample"],
      rules: [
        {"kind":"ThrowStatement","message":"Put throw before new ArgumentException(...)."},
      ],
      hints: [
        "Throw transfers control to a matching handler.",
        "Put throw before new ArgumentException(...).",
        "Complete this form:\n\n```csharp\nbool caughtSample = false;\ntry { throw new ArgumentException(\"___\"); } catch (ArgumentException) { caughtSample = true; }\n```",
      ],
    },
    {
      id: "parameter-name-practice",
      title: "Name an invalid parameter: another example",
      prompt: "Declare string parameterName = \"\". Throw ArgumentOutOfRangeException(nameof(parameterName)) in try. Catch it as error and store error.ParamName in parameterName.",
      solution: "string parameterName = \"\";\ntry { throw new ArgumentOutOfRangeException(nameof(parameterName)); } catch (ArgumentOutOfRangeException error) { parameterName = error.ParamName!; }",
      checks: ["parameterName == \"parameterName\""],
      rules: [
        {"kind":"InvocationExpression","message":"Use nameof(parameterName) as the constructor argument.","token":"nameof"},
      ],
      hints: [
        "Nameof keeps parameterName names tied to the symbol.",
        "Use nameof(parameterName) as the constructor argument.",
        "Complete this form:\n\n```csharp\nstring parameterName = \"\";\ntry { throw new ArgumentOutOfRangeException(nameof(___)); } catch (ArgumentOutOfRangeException error) { parameterName = error.ParamName!; }\n```",
      ],
    },
    {
      id: "filter-practice",
      title: "Filter a catch: another example",
      prompt: "Declare bool caughtSample = false. Throw InvalidOperationException(\"retry\") inside try. Catch it as error only when error.Message == \"retry\", setting caughtSample.",
      solution: "bool caughtSample = false;\ntry { throw new InvalidOperationException(\"retry\"); } catch (InvalidOperationException error) when (error.Message == \"retry\") { caughtSample = true; }",
      checks: ["caughtSample"],
      rules: [
        {"kind":"CatchFilterClause","message":"Add when (error.Message == \"retry\") after the catch declaration."},
      ],
      hints: [
        "A filter decides whether the handler applies.",
        "Add when (error.Message == \"retry\") after the catch declaration.",
        "Complete this form:\n\n```csharp\nbool caughtSample = false;\ntry { throw new InvalidOperationException(\"retry\"); } catch (InvalidOperationException error) when (___) { caughtSample = true; }\n```",
      ],
    },
    {
      id: "multiple-practice",
      title: "Write multiple catches: another example",
      prompt: "Declare string answer = \"\". Parse \"bad\" in try, then catch FormatException assigning \"format\" and OverflowException assigning \"overflow\".",
      solution: "string answer = \"\";\ntry { int.Parse(\"bad\"); } catch (FormatException) { answer = \"format\"; } catch (OverflowException) { answer = \"overflow\"; }",
      checks: ["answer == \"format\""],
      rules: [
        {"kind":"CatchClause","message":"Write separate catch clauses for the two exception types.","min":2},
      ],
      hints: [
        "Each catch handles a different failure type.",
        "Write separate catch clauses for the two exception types.",
        "Complete this form:\n\n```csharp\nstring answer = \"\";\ntry { int.Parse(\"bad\"); } catch (FormatException) { answer = \"format\"; } catch (OverflowException) { answer = \"___\"; }\n```",
      ],
    },
    {
      id: "catch-all-practice",
      title: "Write a catch-all: another example",
      prompt: "Declare bool caughtSample = false. Throw new Exception() in try and handle it with a bare catch that sets caughtSample.",
      solution: "bool caughtSample = false;\ntry { throw new Exception(); } catch { caughtSample = true; }",
      checks: ["caughtSample"],
      rules: [
        {"kind":"CatchClause","message":"Write catch without an exception declaration."},
      ],
      hints: [
        "A bare catch has no parentheses.",
        "Write catch without an exception declaration.",
        "Complete this form:\n\n```csharp\nbool caughtSample = false;\ntry { throw new Exception(); } catch { caughtSample = ___; }\n```",
      ],
    },
    {
      id: "rethrow-practice",
      title: "Rethrow an exception: another example",
      prompt: "Declare bool caughtSample = false. Use nested try/catch: the inner try throws InvalidOperationException, the inner catch rethrows using throw;, and the outer catch sets caughtSample.",
      solution: "bool caughtSample = false;\ntry { try { throw new InvalidOperationException(); } catch { throw; } } catch (InvalidOperationException) { caughtSample = true; }",
      checks: ["caughtSample"],
      rules: [
        {"kind":"ThrowStatement","message":"Use a bare throw; inside the inner catch.","token":";","min":2},
      ],
      hints: [
        "A bare rethrow preserves the current exception.",
        "Use a bare throw; inside the inner catch.",
        "Complete this form:\n\n```csharp\nbool caughtSample = false;\ntry { try { throw new InvalidOperationException(); } catch { ___; } } catch (InvalidOperationException) { caughtSample = true; }\n```",
      ],
    },
    {
      id: "throw-expression-practice",
      title: "Use a throw expression: another example",
      prompt: "Declare string? displayName = null and bool caught = false. In try declare string value = displayName ?? throw new ArgumentNullException(nameof(displayName)); catch ArgumentNullException to set caught.",
      solution: "string? displayName = null;\nbool caught = false;\ntry { string value = displayName ?? throw new ArgumentNullException(nameof(displayName)); } catch (ArgumentNullException) { caught = true; }",
      checks: ["caught"],
      rules: [
        {"kind":"ThrowExpression","message":"Put throw after ?? as the fallback expression."},
      ],
      hints: [
        "Throw can appear where an expression is expected.",
        "Put throw after ?? as the fallback expression.",
        "Complete this form:\n\n```csharp\nstring? displayName = null;\nbool caught = false;\ntry { string value = displayName ?? throw new ArgumentNullException(nameof(displayName)); } catch (ArgumentNullException) { ___; }\n```",
      ],
    },
    {
      id: "overflow-practice",
      title: "Catch checked overflow: another example",
      prompt: "Declare int input = int.MaxValue and bool caught = false. In try, increment input inside a checked block. Catch OverflowException to set caught.",
      solution: "int input = int.MaxValue;\nbool caught = false;\ntry { checked { input++; } } catch (OverflowException) { caught = true; }",
      checks: ["caught"],
      rules: [
        {"kind":"CheckedStatement","message":"Use checked { ... } around the increment."},
      ],
      hints: [
        "A checked block turns integer overflow into an exception.",
        "Use checked { ... } around the increment.",
        "Complete this form:\n\n```csharp\nint input = int.MaxValue;\nbool caught = false;\ntry { checked { ___; } } catch (OverflowException) { caught = true; }\n```",
      ],
    },
    {
      id: "using-statement-practice",
      title: "Dispose with using: another example",
      prompt: "Declare bool closedSample. Use a using statement around new System.IO.MemoryStream(), naming it stream. Set closedSample = stream.CanWrite inside the body.",
      solution: "bool closedSample;\nusing (var stream = new System.IO.MemoryStream()) { closedSample = stream.CanWrite; }",
      checks: ["closedSample"],
      rules: [
        {"kind":"UsingStatement","message":"Put the resource declaration in using parentheses."},
      ],
      hints: [
        "Using disposes the resource when its body ends.",
        "Put the resource declaration in using parentheses.",
        "Complete this form:\n\n```csharp\nbool closedSample;\nusing (var stream = new System.IO.MemoryStream()) { closedSample = stream.___; }\n```",
      ],
    },
    {
      id: "using-declaration-practice",
      title: "Declare a using resource: another example",
      prompt: "Use a using declaration named streamSample for new System.IO.MemoryStream(). Then declare bool writable = streamSample.CanWrite.",
      solution: "using var streamSample = new System.IO.MemoryStream();\nbool writable = streamSample.CanWrite;",
      checks: ["writable"],
      rules: [
        {"kind":"LocalDeclarationStatement","message":"Put using before var streamSample.","token":"using"},
      ],
      hints: [
        "A using declaration lasts until the enclosing scope ends.",
        "Put using before var streamSample.",
        "Complete this form:\n\n```csharp\nusing var streamSample = new System.IO.MemoryStream();\nbool writable = streamSample.___;\n```",
      ],
    },
    {
      id: "nested-using-practice",
      title: "Nest resource scopes: another example",
      prompt: "Declare bool writableSample = false. Write two nested using statements, each constructing a MemoryStream named first and second. Assign first.CanWrite && second.CanWrite to writableSample.",
      solution: "bool writableSample = false;\nusing (var first = new System.IO.MemoryStream()) { using (var second = new System.IO.MemoryStream()) { writableSample = first.CanWrite && second.CanWrite; } }",
      checks: ["writableSample"],
      rules: [
        {"kind":"UsingStatement","message":"Write one using statement inside the other.","min":2},
      ],
      hints: [
        "Each resource gets its own disposal scope.",
        "Write one using statement inside the other.",
        "Complete this form:\n\n```csharp\nbool writableSample = false;\nusing (var first = new System.IO.MemoryStream()) { using (var second = new System.IO.MemoryStream()) { writableSample = ___; } }\n```",
      ],
    },
    {
      id: "finally-after-error-practice",
      title: "Clean up after an exception: another example",
      prompt: "Declare int stageSample = 0. In try throw an Exception. In catch set stageSample = 1, and in finally increment stageSample.",
      solution: "int stageSample = 0;\ntry { throw new Exception(); } catch { stageSample = 1; } finally { stageSample++; }",
      checks: ["stageSample == 2"],
      rules: [
        {"kind":"FinallyClause","message":"Increment stageSample inside finally."},
      ],
      hints: [
        "Finally still runs after the catch handles the exception.",
        "Increment stageSample inside finally.",
        "Complete this form:\n\n```csharp\nint stageSample = 0;\ntry { throw new Exception(); } catch { stageSample = 1; } finally { ___; }\n```",
      ],
    },
    {
      id: "nested-try-practice",
      title: "Nest try blocks: another example",
      prompt: "Declare bool caughtSample = false and bool cleaned = false. Inside an outer try, use an inner try that throws and an inner finally that sets cleaned. The outer catch sets caughtSample.",
      solution: "bool caughtSample = false, cleaned = false;\ntry { try { throw new Exception(); } finally { cleaned = true; } } catch { caughtSample = true; }",
      checks: ["caughtSample && cleaned"],
      rules: [
        {"kind":"TryStatement","message":"Put the inner try/finally inside the outer try body.","min":2},
      ],
      hints: [
        "An exception passes through finally before reaching an outer handler.",
        "Put the inner try/finally inside the outer try body.",
        "Complete this form:\n\n```csharp\nbool caughtSample = false, cleaned = false;\ntry { try { throw new Exception(); } finally { ___; } } catch { caughtSample = true; }\n```",
      ],
    },
    {
      id: "filter-type-practice",
      title: "Filter by exception type: another example",
      prompt: "Declare bool caughtSample = false. Throw a FormatException inside try. Catch Exception error with a when filter testing error is FormatException, setting caughtSample.",
      solution: "bool caughtSample = false;\ntry { throw new FormatException(); } catch (Exception error) when (error is FormatException) { caughtSample = true; }",
      checks: ["caughtSample"],
      rules: [
        {"kind":"CatchFilterClause","message":"Use a when filter after catch."},
        {"kind":"IsExpression","message":"Test error is FormatException."},
      ],
      hints: [
        "A catch filter can inspect the runtime type.",
        "Use a when filter after catch. Test error is FormatException.",
        "Complete this form:\n\n```csharp\nbool caughtSample = false;\ntry { throw new FormatException(); } catch (Exception error) when (error is ___) { caughtSample = true; }\n```",
      ],
    },
    {
      id: "inner-practice",
      title: "Wrap an inner exception: another example",
      prompt: "Declare Exception? savedSample = null. In try throw new InvalidOperationException(\"outer\", new Exception(\"inner\")); catch it as error and assign savedSample = error.InnerException.",
      solution: "Exception? savedSample = null;\ntry { throw new InvalidOperationException(\"outer\", new Exception(\"inner\")); } catch (InvalidOperationException error) { savedSample = error.InnerException; }",
      checks: ["savedSample?.Message == \"inner\""],
      rules: [
        {"kind":"ObjectCreationExpression","message":"Pass the inner exception as the second constructor argument.","token":"InvalidOperationException"},
      ],
      hints: [
        "An inner exception preserves the underlying cause.",
        "Pass the inner exception as the second constructor argument.",
        "Complete this form:\n\n```csharp\nException? savedSample = null;\ntry { throw new InvalidOperationException(\"outer\", new Exception(\"___\")); } catch (InvalidOperationException error) { savedSample = error.___; }\n```",
      ],
    },
    {
      id: "custom-practice",
      title: "Declare a custom exception: another example",
      prompt: "Declare public class PracticeException : Exception with public PracticeException(string messageSample) : base(messageSample).",
      solution: "public class PracticeException : Exception { public PracticeException(string messageSample) : base(messageSample) { } }",
      checks: ["new PracticeException(\"hello\").Message == \"hello\""],
      rules: [
        {"kind":"ClassDeclaration","message":"Inherit from Exception.","name":"PracticeException"},
        {"kind":"BaseConstructorInitializer","message":"Forward messageSample to base(messageSample)."},
      ],
      hints: [
        "Custom exceptions can reuse Exception's messageSample storage.",
        "Inherit from Exception. Forward messageSample to base(messageSample).",
        "Complete this form:\n\n```csharp\npublic class PracticeException : Exception { public PracticeException(string messageSample) : base(___) { } }\n```",
      ],
      mode: "types",
    },
  ],
};

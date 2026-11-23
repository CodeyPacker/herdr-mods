/** @type {import("../types.js").Topic} */
export const loops = {
  id: "loops",
  title: "Loops",
  description: "For, foreach, while, do, and loop control.",
  exercises: [
    {
      id: "for",
      title: "Count with for",
      prompt: "Declare int total = 0. Use a for loop to add 0 through 4 to total.",
      solution: "int total = 0;\nfor (int i = 0; i < 5; i++) { total += i; }",
      checks: ["total == 10"],
      rules: [
        {"kind":"ForStatement","message":"Use initialization; condition; increment inside for parentheses."},
      ],
      hints: [
        "The loop condition is checked before each iteration.",
        "Use initialization; condition; increment inside for parentheses.",
        "Complete this form:\n\n```csharp\nint total = 0;\nfor (int i = ___; i < ___; i++) { total += i; }\n```",
      ],
    },
    {
      id: "inclusive",
      title: "Use an inclusive bound",
      prompt: "Declare int total = 0. Use for with <= to add 1 through 5 to total.",
      solution: "int total = 0;\nfor (int i = 1; i <= 5; i++) total += i;",
      checks: ["total == 15"],
      rules: [
        {"kind":"ForStatement","message":"Write a for loop."},
        {"kind":"LessThanOrEqualExpression","message":"Use <= for the inclusive upper bound."},
      ],
      hints: [
        "An inclusive bound includes the final number.",
        "Write a for loop. Use <= for the inclusive upper bound.",
        "Complete this form:\n\n```csharp\nint total = 0;\nfor (int i = 1; i ___ 5; i++) total += i;\n```",
      ],
    },
    {
      id: "count-down",
      title: "Count down",
      prompt: "Declare int total = 0. Use for with i-- to add 5 down through 1 to total.",
      solution: "int total = 0;\nfor (int i = 5; i > 0; i--) total += i;",
      checks: ["total == 15"],
      rules: [
        {"kind":"ForStatement","message":"Write a for loop."},
        {"kind":"PostDecrementExpression","message":"Decrement i using i--."},
      ],
      hints: [
        "Initialize at the upper end and decrease the counter.",
        "Write a for loop. Decrement i using i--.",
        "Complete this form:\n\n```csharp\nint total = 0;\nfor (int i = 5; i > ___; i--) total += i;\n```",
      ],
    },
    {
      id: "step",
      title: "Change the step size",
      prompt: "Declare int total = 0. Use for with i += 2 to add 0, 2, 4, 6, and 8.",
      solution: "int total = 0;\nfor (int i = 0; i < 10; i += 2) total += i;",
      checks: ["total == 20"],
      rules: [
        {"kind":"ForStatement","message":"Write a for loop."},
        {"kind":"AddAssignmentExpression","message":"Use i += 2 as the increment."},
      ],
      hints: [
        "The increment may be a compound assignment.",
        "Write a for loop. Use i += 2 as the increment.",
        "Complete this form:\n\n```csharp\nint total = 0;\nfor (int i = 0; i < 10; i += ___) total += i;\n```",
      ],
    },
    {
      id: "foreach",
      title: "Iterate an array",
      prompt: "Declare int[] values = { 2, 4, 6 } and int total = 0. Add each value using foreach with an explicit int element type.",
      solution: "int[] values = { 2, 4, 6 };\nint total = 0;\nforeach (int value in values) total += value;",
      checks: ["total == 12"],
      rules: [
        {"kind":"ForEachStatement","message":"Use foreach (int value in values).","token":"int"},
      ],
      hints: [
        "Foreach names one element at a time.",
        "Use foreach (int value in values).",
        "Complete this form:\n\n```csharp\nint[] values = { 2, 4, 6 };\nint total = 0;\nforeach (int value in ___) total += value;\n```",
      ],
    },
    {
      id: "foreach-var",
      title: "Infer a foreach element type",
      prompt: "Declare string[] words = { \"a\", \"bb\" } and int total = 0. Use foreach with var to add their lengths.",
      solution: "string[] words = { \"a\", \"bb\" };\nint total = 0;\nforeach (var word in words) total += word.Length;",
      checks: ["total == 3"],
      rules: [
        {"kind":"ForEachStatement","message":"Use var for the foreach element type.","token":"var"},
      ],
      hints: [
        "The collection supplies the element type.",
        "Use var for the foreach element type.",
        "Complete this form:\n\n```csharp\nstring[] words = { \"a\", \"bb\" };\nint total = 0;\nforeach (var word in ___) total += word.Length;\n```",
      ],
    },
    {
      id: "while",
      title: "Write a while loop",
      prompt: "Declare int count = 0. Increment it in a while loop until it reaches 4.",
      solution: "int count = 0;\nwhile (count < 4) count++;",
      checks: ["count == 4"],
      rules: [
        {"kind":"WhileStatement","message":"Put the condition in parentheses after while."},
      ],
      hints: [
        "Update the variable so the condition eventually becomes false.",
        "Put the condition in parentheses after while.",
        "Complete this form:\n\n```csharp\nint count = 0;\nwhile (count < ___) { count++; }\n```",
      ],
    },
    {
      id: "do",
      title: "Write a do/while loop",
      prompt: "Declare int count = 0. Increment it using do/while until it reaches 3.",
      solution: "int count = 0;\ndo { count++; } while (count < 3);",
      checks: ["count == 3"],
      rules: [
        {"kind":"DoStatement","message":"Put do before the body and while(condition); after it."},
      ],
      hints: [
        "Do/while checks the condition after the body.",
        "Put do before the body and while(condition); after it.",
        "Complete this form:\n\n```csharp\nint count = 0;\ndo { count++; } while (count < ___);\n```",
      ],
    },
    {
      id: "do-once",
      title: "Run the body once",
      prompt: "Declare int count = 0. Use do/while(false) to increment count exactly once.",
      solution: "int count = 0;\ndo { count++; } while (false);",
      checks: ["count == 1"],
      rules: [
        {"kind":"DoStatement","message":"Use false as the do/while condition."},
      ],
      hints: [
        "The first iteration happens before checking the condition.",
        "Use false as the do/while condition.",
        "Complete this form:\n\n```csharp\nint count = 0;\ndo { ___; } while (false);\n```",
      ],
    },
    {
      id: "break",
      title: "Break out of a loop",
      prompt: "Declare int count = 0. Use while(true), increment count, and break when count reaches 3.",
      solution: "int count = 0;\nwhile (true) { count++; if (count == 3) break; }",
      checks: ["count == 3"],
      rules: [
        {"kind":"WhileStatement","message":"Write a while loop."},
        {"kind":"BreakStatement","message":"Use break inside the condition that stops the loop."},
      ],
      hints: [
        "Break immediately exits the nearest loop.",
        "Write a while loop. Use break inside the condition that stops the loop.",
        "Complete this form:\n\n```csharp\nint count = 0;\nwhile (true) { count++; if (count == ___) break; }\n```",
      ],
    },
    {
      id: "continue",
      title: "Skip an iteration",
      prompt: "Declare int total = 0. For 1 through 5, use continue to skip 3 and add the other values.",
      solution: "int total = 0;\nfor (int i = 1; i <= 5; i++) { if (i == 3) continue; total += i; }",
      checks: ["total == 12"],
      rules: [
        {"kind":"ContinueStatement","message":"Use continue when i equals 3."},
      ],
      hints: [
        "Continue skips the rest of the current iteration.",
        "Use continue when i equals 3.",
        "Complete this form:\n\n```csharp\nint total = 0;\nfor (int i = 1; i <= 5; i++) { if (i == 3) ___; total += i; }\n```",
      ],
    },
    {
      id: "nested",
      title: "Nest for loops",
      prompt: "Declare int count = 0. Use two nested for loops with 2 outer iterations and 3 inner iterations, incrementing count in the inner body.",
      solution: "int count = 0;\nfor (int row = 0; row < 2; row++) { for (int col = 0; col < 3; col++) count++; }",
      checks: ["count == 6"],
      rules: [
        {"kind":"ForStatement","message":"Put a for loop inside another for loop.","min":2},
      ],
      hints: [
        "The inner loop runs completely for each outer iteration.",
        "Put a for loop inside another for loop.",
        "Complete this form:\n\n```csharp\nint count = 0;\nfor (int row = 0; row < ___; row++) { for (int col = 0; col < ___; col++) count++; }\n```",
      ],
    },
    {
      id: "index-array",
      title: "Index an array in a loop",
      prompt: "Declare int[] values = { 3, 5, 7 } and int total = 0. Use for and values.Length to sum elements by index.",
      solution: "int[] values = { 3, 5, 7 };\nint total = 0;\nfor (int i = 0; i < values.Length; i++) total += values[i];",
      checks: ["total == 15"],
      rules: [
        {"kind":"ForStatement","message":"Use a for loop bounded by values.Length.","token":"Length"},
        {"kind":"ElementAccessExpression","message":"Access values[i] inside the loop."},
      ],
      hints: [
        "Length gives the exclusive upper index bound.",
        "Use a for loop bounded by values.Length. Access values[i] inside the loop.",
        "Complete this form:\n\n```csharp\nint[] values = { 3, 5, 7 };\nint total = 0;\nfor (int i = 0; i < values.___; i++) total += values[___];\n```",
      ],
    },
    {
      id: "reverse-index",
      title: "Iterate indexes backward",
      prompt: "Declare int[] values = { 1, 2, 3 } and string result = string.Empty. Use a descending for loop to append the elements in reverse order.",
      solution: "int[] values = { 1, 2, 3 };\nstring result = string.Empty;\nfor (int i = values.Length - 1; i >= 0; i--) result += values[i];",
      checks: ["result == \"321\""],
      rules: [
        {"kind":"ForStatement","message":"Start at values.Length - 1 and decrement through zero."},
      ],
      hints: [
        "The final valid index is one less than Length.",
        "Start at values.Length - 1 and decrement through zero.",
        "Complete this form:\n\n```csharp\nint[] values = { 1, 2, 3 };\nstring result = string.Empty;\nfor (int i = values.Length - ___; i >= 0; i--) result += values[i];\n```",
      ],
    },
    {
      id: "characters",
      title: "Iterate string characters",
      prompt: "Declare string text = \"abc\" and int count = 0. Use foreach with char to count its characters.",
      solution: "string text = \"abc\";\nint count = 0;\nforeach (char letter in text) count++;",
      checks: ["count == 3"],
      rules: [
        {"kind":"ForEachStatement","message":"Use char as the foreach element type.","token":"char"},
      ],
      hints: [
        "A string can be iterated as characters.",
        "Use char as the foreach element type.",
        "Complete this form:\n\n```csharp\nstring text = \"abc\";\nint count = 0;\nforeach (char letter in ___) count++;\n```",
      ],
    },
    {
      id: "dictionary",
      title: "Iterate dictionary entries",
      prompt: "Declare a Dictionary<string, int> named scores with { \"Ada\", 2 } and { \"Lin\", 3 }. Use foreach to add entry.Value into int total = 0.",
      solution: "var scores = new Dictionary<string, int> { { \"Ada\", 2 }, { \"Lin\", 3 } };\nint total = 0;\nforeach (var entry in scores) total += entry.Value;",
      checks: ["total == 5"],
      rules: [
        {"kind":"ForEachStatement","message":"Iterate scores and read entry.Value.","token":"Value"},
      ],
      hints: [
        "Dictionary enumeration yields key/value pairs.",
        "Iterate scores and read entry.Value.",
        "Complete this form:\n\n```csharp\nvar scores = new Dictionary<string, int> { { \"Ada\", 2 }, { \"Lin\", 3 } };\nint total = 0;\nforeach (var entry in scores) total += entry.___;\n```",
      ],
    },
    {
      id: "deconstruct",
      title: "Deconstruct in foreach",
      prompt: "Declare an array of tuples named pairs containing (1, 2) and (3, 4). Use foreach (var (a, b) in pairs) to add a + b into int total = 0.",
      solution: "var pairs = new[] { (1, 2), (3, 4) };\nint total = 0;\nforeach (var (a, b) in pairs) total += a + b;",
      checks: ["total == 10"],
      rules: [
        {"kind":"ForEachVariableStatement","message":"Declare (a, b) together in the foreach header."},
      ],
      hints: [
        "Foreach can deconstruct each element.",
        "Declare (a, b) together in the foreach header.",
        "Complete this form:\n\n```csharp\nvar pairs = new[] { (1, 2), (3, 4) };\nint total = 0;\nforeach (var (___, ___) in pairs) total += a + b;\n```",
      ],
    },
    {
      id: "multiple-counters",
      title: "Use two for counters",
      prompt: "Declare int total = 0. Use one for loop declaring i = 0 and j = 3, increasing i and decreasing j while i < 3. Add i + j each iteration.",
      solution: "int total = 0;\nfor (int i = 0, j = 3; i < 3; i++, j--) total += i + j;",
      checks: ["total == 9"],
      rules: [
        {"kind":"ForStatement","message":"Separate counters and increment expressions with commas.","token":","},
      ],
      hints: [
        "A for header can update more than one variable.",
        "Separate counters and increment expressions with commas.",
        "Complete this form:\n\n```csharp\nint total = 0;\nfor (int i = 0, j = 3; i < 3; i++, ___) total += i + j;\n```",
      ],
    },
    {
      id: "external-counter",
      title: "Declare a counter outside for",
      prompt: "Declare int count = 0. Use for with an empty initializer to increase count until it reaches 4.",
      solution: "int count = 0;\nfor (; count < 4; count++) { }",
      checks: ["count == 4"],
      rules: [
        {"kind":"ForStatement","message":"Leave the first for header section empty."},
      ],
      hints: [
        "A for initializer is optional.",
        "Leave the first for header section empty.",
        "Complete this form:\n\n```csharp\nint count = 0;\nfor (; count < ___; count++) { }\n```",
      ],
    },
    {
      id: "while-array",
      title: "Iterate an array with while",
      prompt: "Declare int[] values = { 2, 3, 4 }, int index = 0, and int total = 0. Use while to sum the array by index.",
      solution: "int[] values = { 2, 3, 4 };\nint index = 0, total = 0;\nwhile (index < values.Length) { total += values[index]; index++; }",
      checks: ["total == 9 && index == 3"],
      rules: [
        {"kind":"WhileStatement","message":"Use index < values.Length and increment index in the body."},
      ],
      hints: [
        "Keep the index update inside the while body.",
        "Use index < values.Length and increment index in the body.",
        "Complete this form:\n\n```csharp\nint[] values = { 2, 3, 4 };\nint index = 0, total = 0;\nwhile (___) { total += values[index]; index++; }\n```",
      ],
    },
    {
      id: "for-practice",
      title: "Count with for: another example",
      prompt: "Declare int sum = 0. Use a for loop to add 0 through 4 to sum.",
      solution: "int sum = 0;\nfor (int i = 0; i < 5; i++) { sum += i; }",
      checks: ["sum == 10"],
      rules: [
        {"kind":"ForStatement","message":"Use initialization; condition; increment inside for parentheses."},
      ],
      hints: [
        "The loop condition is checked before each iteration.",
        "Use initialization; condition; increment inside for parentheses.",
        "Complete this form:\n\n```csharp\nint sum = 0;\nfor (int i = ___; i < ___; i++) { sum += i; }\n```",
      ],
    },
    {
      id: "inclusive-practice",
      title: "Use an inclusive bound: another example",
      prompt: "Declare int sum = 0. Use for with <= to add 1 through 5 to sum.",
      solution: "int sum = 0;\nfor (int i = 1; i <= 5; i++) sum += i;",
      checks: ["sum == 15"],
      rules: [
        {"kind":"ForStatement","message":"Write a for loop."},
        {"kind":"LessThanOrEqualExpression","message":"Use <= for the inclusive upper bound."},
      ],
      hints: [
        "An inclusive bound includes the final number.",
        "Write a for loop. Use <= for the inclusive upper bound.",
        "Complete this form:\n\n```csharp\nint sum = 0;\nfor (int i = 1; i ___ 5; i++) sum += i;\n```",
      ],
    },
    {
      id: "count-down-practice",
      title: "Count down: another example",
      prompt: "Declare int sum = 0. Use for with i-- to add 5 down through 1 to sum.",
      solution: "int sum = 0;\nfor (int i = 5; i > 0; i--) sum += i;",
      checks: ["sum == 15"],
      rules: [
        {"kind":"ForStatement","message":"Write a for loop."},
        {"kind":"PostDecrementExpression","message":"Decrement i using i--."},
      ],
      hints: [
        "Initialize at the upper end and decrease the counter.",
        "Write a for loop. Decrement i using i--.",
        "Complete this form:\n\n```csharp\nint sum = 0;\nfor (int i = 5; i > ___; i--) sum += i;\n```",
      ],
    },
    {
      id: "step-practice",
      title: "Change the step size: another example",
      prompt: "Declare int sum = 0. Use for with i += 2 to add 0, 2, 4, 6, and 8.",
      solution: "int sum = 0;\nfor (int i = 0; i < 10; i += 2) sum += i;",
      checks: ["sum == 20"],
      rules: [
        {"kind":"ForStatement","message":"Write a for loop."},
        {"kind":"AddAssignmentExpression","message":"Use i += 2 as the increment."},
      ],
      hints: [
        "The increment may be a compound assignment.",
        "Write a for loop. Use i += 2 as the increment.",
        "Complete this form:\n\n```csharp\nint sum = 0;\nfor (int i = 0; i < 10; i += ___) sum += i;\n```",
      ],
    },
    {
      id: "foreach-practice",
      title: "Iterate an array: another example",
      prompt: "Declare int[] samples = { 2, 4, 6 } and int total = 0. Add each value using foreach with an explicit int element type.",
      solution: "int[] samples = { 2, 4, 6 };\nint total = 0;\nforeach (int value in samples) total += value;",
      checks: ["total == 12"],
      rules: [
        {"kind":"ForEachStatement","message":"Use foreach (int value in samples).","token":"int"},
      ],
      hints: [
        "Foreach names one element at a time.",
        "Use foreach (int value in samples).",
        "Complete this form:\n\n```csharp\nint[] samples = { 2, 4, 6 };\nint total = 0;\nforeach (int value in ___) total += value;\n```",
      ],
    },
    {
      id: "foreach-var-practice",
      title: "Infer a foreach element type: another example",
      prompt: "Declare string[] labels = { \"a\", \"bb\" } and int total = 0. Use foreach with var to add their lengths.",
      solution: "string[] labels = { \"a\", \"bb\" };\nint total = 0;\nforeach (var word in labels) total += word.Length;",
      checks: ["total == 3"],
      rules: [
        {"kind":"ForEachStatement","message":"Use var for the foreach element type.","token":"var"},
      ],
      hints: [
        "The collection supplies the element type.",
        "Use var for the foreach element type.",
        "Complete this form:\n\n```csharp\nstring[] labels = { \"a\", \"bb\" };\nint total = 0;\nforeach (var word in ___) total += word.Length;\n```",
      ],
    },
    {
      id: "while-practice",
      title: "Write a while loop: another example",
      prompt: "Declare int itemCount = 0. Increment it in a while loop until it reaches 4.",
      solution: "int itemCount = 0;\nwhile (itemCount < 4) itemCount++;",
      checks: ["itemCount == 4"],
      rules: [
        {"kind":"WhileStatement","message":"Put the condition in parentheses after while."},
      ],
      hints: [
        "Update the variable so the condition eventually becomes false.",
        "Put the condition in parentheses after while.",
        "Complete this form:\n\n```csharp\nint itemCount = 0;\nwhile (itemCount < ___) { itemCount++; }\n```",
      ],
    },
    {
      id: "do-practice",
      title: "Write a do/while loop: another example",
      prompt: "Declare int itemCount = 0. Increment it using do/while until it reaches 3.",
      solution: "int itemCount = 0;\ndo { itemCount++; } while (itemCount < 3);",
      checks: ["itemCount == 3"],
      rules: [
        {"kind":"DoStatement","message":"Put do before the body and while(condition); after it."},
      ],
      hints: [
        "Do/while checks the condition after the body.",
        "Put do before the body and while(condition); after it.",
        "Complete this form:\n\n```csharp\nint itemCount = 0;\ndo { itemCount++; } while (itemCount < ___);\n```",
      ],
    },
    {
      id: "do-once-practice",
      title: "Run the body once: another example",
      prompt: "Declare int itemCount = 0. Use do/while(false) to increment itemCount exactly once.",
      solution: "int itemCount = 0;\ndo { itemCount++; } while (false);",
      checks: ["itemCount == 1"],
      rules: [
        {"kind":"DoStatement","message":"Use false as the do/while condition."},
      ],
      hints: [
        "The first iteration happens before checking the condition.",
        "Use false as the do/while condition.",
        "Complete this form:\n\n```csharp\nint itemCount = 0;\ndo { ___; } while (false);\n```",
      ],
    },
    {
      id: "break-practice",
      title: "Break out of a loop: another example",
      prompt: "Declare int itemCount = 0. Use while(true), increment itemCount, and break when itemCount reaches 3.",
      solution: "int itemCount = 0;\nwhile (true) { itemCount++; if (itemCount == 3) break; }",
      checks: ["itemCount == 3"],
      rules: [
        {"kind":"WhileStatement","message":"Write a while loop."},
        {"kind":"BreakStatement","message":"Use break inside the condition that stops the loop."},
      ],
      hints: [
        "Break immediately exits the nearest loop.",
        "Write a while loop. Use break inside the condition that stops the loop.",
        "Complete this form:\n\n```csharp\nint itemCount = 0;\nwhile (true) { itemCount++; if (itemCount == ___) break; }\n```",
      ],
    },
    {
      id: "continue-practice",
      title: "Skip an iteration: another example",
      prompt: "Declare int sum = 0. For 1 through 5, use continue to skip 3 and add the other values.",
      solution: "int sum = 0;\nfor (int i = 1; i <= 5; i++) { if (i == 3) continue; sum += i; }",
      checks: ["sum == 12"],
      rules: [
        {"kind":"ContinueStatement","message":"Use continue when i equals 3."},
      ],
      hints: [
        "Continue skips the rest of the current iteration.",
        "Use continue when i equals 3.",
        "Complete this form:\n\n```csharp\nint sum = 0;\nfor (int i = 1; i <= 5; i++) { if (i == 3) ___; sum += i; }\n```",
      ],
    },
    {
      id: "nested-practice",
      title: "Nest for loops: another example",
      prompt: "Declare int itemCount = 0. Use two nested for loops with 2 outer iterations and 3 inner iterations, incrementing itemCount in the inner body.",
      solution: "int itemCount = 0;\nfor (int row = 0; row < 2; row++) { for (int col = 0; col < 3; col++) itemCount++; }",
      checks: ["itemCount == 6"],
      rules: [
        {"kind":"ForStatement","message":"Put a for loop inside another for loop.","min":2},
      ],
      hints: [
        "The inner loop runs completely for each outer iteration.",
        "Put a for loop inside another for loop.",
        "Complete this form:\n\n```csharp\nint itemCount = 0;\nfor (int row = 0; row < ___; row++) { for (int col = 0; col < ___; col++) itemCount++; }\n```",
      ],
    },
    {
      id: "index-array-practice",
      title: "Index an array in a loop: another example",
      prompt: "Declare int[] samples = { 3, 5, 7 } and int total = 0. Use for and samples.Length to sum elements by index.",
      solution: "int[] samples = { 3, 5, 7 };\nint total = 0;\nfor (int i = 0; i < samples.Length; i++) total += samples[i];",
      checks: ["total == 15"],
      rules: [
        {"kind":"ForStatement","message":"Use a for loop bounded by samples.Length.","token":"Length"},
        {"kind":"ElementAccessExpression","message":"Access samples[i] inside the loop."},
      ],
      hints: [
        "Length gives the exclusive upper index bound.",
        "Use a for loop bounded by samples.Length. Access samples[i] inside the loop.",
        "Complete this form:\n\n```csharp\nint[] samples = { 3, 5, 7 };\nint total = 0;\nfor (int i = 0; i < samples.___; i++) total += samples[___];\n```",
      ],
    },
    {
      id: "reverse-index-practice",
      title: "Iterate indexes backward: another example",
      prompt: "Declare int[] samples = { 1, 2, 3 } and string result = string.Empty. Use a descending for loop to append the elements in reverse order.",
      solution: "int[] samples = { 1, 2, 3 };\nstring result = string.Empty;\nfor (int i = samples.Length - 1; i >= 0; i--) result += samples[i];",
      checks: ["result == \"321\""],
      rules: [
        {"kind":"ForStatement","message":"Start at samples.Length - 1 and decrement through zero."},
      ],
      hints: [
        "The final valid index is one less than Length.",
        "Start at samples.Length - 1 and decrement through zero.",
        "Complete this form:\n\n```csharp\nint[] samples = { 1, 2, 3 };\nstring result = string.Empty;\nfor (int i = samples.Length - ___; i >= 0; i--) result += samples[i];\n```",
      ],
    },
    {
      id: "characters-practice",
      title: "Iterate string characters: another example",
      prompt: "Declare string message = \"abc\" and int count = 0. Use foreach with char to count its characters.",
      solution: "string message = \"abc\";\nint count = 0;\nforeach (char letter in message) count++;",
      checks: ["count == 3"],
      rules: [
        {"kind":"ForEachStatement","message":"Use char as the foreach element type.","token":"char"},
      ],
      hints: [
        "A string can be iterated as characters.",
        "Use char as the foreach element type.",
        "Complete this form:\n\n```csharp\nstring message = \"abc\";\nint count = 0;\nforeach (char letter in ___) count++;\n```",
      ],
    },
    {
      id: "dictionary-practice",
      title: "Iterate dictionary entries: another example",
      prompt: "Declare a Dictionary<string, int> named points with { \"Ada\", 2 } and { \"Lin\", 3 }. Use foreach to add entry.Value into int total = 0.",
      solution: "var points = new Dictionary<string, int> { { \"Ada\", 2 }, { \"Lin\", 3 } };\nint total = 0;\nforeach (var entry in points) total += entry.Value;",
      checks: ["total == 5"],
      rules: [
        {"kind":"ForEachStatement","message":"Iterate points and read entry.Value.","token":"Value"},
      ],
      hints: [
        "Dictionary enumeration yields key/value pairs.",
        "Iterate points and read entry.Value.",
        "Complete this form:\n\n```csharp\nvar points = new Dictionary<string, int> { { \"Ada\", 2 }, { \"Lin\", 3 } };\nint total = 0;\nforeach (var entry in points) total += entry.___;\n```",
      ],
    },
    {
      id: "deconstruct-practice",
      title: "Deconstruct in foreach: another example",
      prompt: "Declare an array of tuples named pairsSample containing (1, 2) and (3, 4). Use foreach (var (a, b) in pairsSample) to add a + b into int total = 0.",
      solution: "var pairsSample = new[] { (1, 2), (3, 4) };\nint total = 0;\nforeach (var (a, b) in pairsSample) total += a + b;",
      checks: ["total == 10"],
      rules: [
        {"kind":"ForEachVariableStatement","message":"Declare (a, b) together in the foreach header."},
      ],
      hints: [
        "Foreach can deconstruct each element.",
        "Declare (a, b) together in the foreach header.",
        "Complete this form:\n\n```csharp\nvar pairsSample = new[] { (1, 2), (3, 4) };\nint total = 0;\nforeach (var (___, ___) in pairsSample) total += a + b;\n```",
      ],
    },
    {
      id: "multiple-counters-practice",
      title: "Use two for counters: another example",
      prompt: "Declare int sum = 0. Use one for loop declaring i = 0 and j = 3, increasing i and decreasing j while i < 3. Add i + j each iteration.",
      solution: "int sum = 0;\nfor (int i = 0, j = 3; i < 3; i++, j--) sum += i + j;",
      checks: ["sum == 9"],
      rules: [
        {"kind":"ForStatement","message":"Separate counters and increment expressions with commas.","token":","},
      ],
      hints: [
        "A for header can update more than one variable.",
        "Separate counters and increment expressions with commas.",
        "Complete this form:\n\n```csharp\nint sum = 0;\nfor (int i = 0, j = 3; i < 3; i++, ___) sum += i + j;\n```",
      ],
    },
    {
      id: "external-counter-practice",
      title: "Declare a counter outside for: another example",
      prompt: "Declare int itemCount = 0. Use for with an empty initializer to increase itemCount until it reaches 4.",
      solution: "int itemCount = 0;\nfor (; itemCount < 4; itemCount++) { }",
      checks: ["itemCount == 4"],
      rules: [
        {"kind":"ForStatement","message":"Leave the first for header section empty."},
      ],
      hints: [
        "A for initializer is optional.",
        "Leave the first for header section empty.",
        "Complete this form:\n\n```csharp\nint itemCount = 0;\nfor (; itemCount < ___; itemCount++) { }\n```",
      ],
    },
    {
      id: "while-array-practice",
      title: "Iterate an array with while: another example",
      prompt: "Declare int[] samples = { 2, 3, 4 }, int index = 0, and int total = 0. Use while to sum the array by index.",
      solution: "int[] samples = { 2, 3, 4 };\nint index = 0, total = 0;\nwhile (index < samples.Length) { total += samples[index]; index++; }",
      checks: ["total == 9 && index == 3"],
      rules: [
        {"kind":"WhileStatement","message":"Use index < samples.Length and increment index in the body."},
      ],
      hints: [
        "Keep the index update inside the while body.",
        "Use index < samples.Length and increment index in the body.",
        "Complete this form:\n\n```csharp\nint[] samples = { 2, 3, 4 };\nint index = 0, total = 0;\nwhile (___) { total += samples[index]; index++; }\n```",
      ],
    },
  ],
};

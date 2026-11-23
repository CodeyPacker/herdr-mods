/** @type {import("../types.js").Topic} */
export const operators = {
  id: "operators",
  title: "Operators",
  description: "Arithmetic, comparison, assignment, and null operators.",
  exercises: [
    {
      id: "add",
      title: "Addition",
      prompt: "Declare int result as 7 plus 5 using +.",
      solution: "int result = 7 + 5;",
      checks: ["result == 12"],
      rules: [
        {"kind":"AddExpression","message":"Use the addition syntax requested in the prompt."},
      ],
      hints: [
        "Put the operator between the operands.",
        "Use the addition syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nint result = 7 ___ 5;\n```",
      ],
    },
    {
      id: "subtract",
      title: "Subtraction",
      prompt: "Declare int result as 20 minus 8 using -.",
      solution: "int result = 20 - 8;",
      checks: ["result == 12"],
      rules: [
        {"kind":"SubtractExpression","message":"Use the subtraction syntax requested in the prompt."},
      ],
      hints: [
        "Subtraction uses a single minus sign.",
        "Use the subtraction syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nint result = 20 ___ 8;\n```",
      ],
    },
    {
      id: "multiply",
      title: "Multiplication",
      prompt: "Declare int result as 6 times 7 using *.",
      solution: "int result = 6 * 7;",
      checks: ["result == 42"],
      rules: [
        {"kind":"MultiplyExpression","message":"Use the multiplication syntax requested in the prompt."},
      ],
      hints: [
        "Multiplication uses an asterisk.",
        "Use the multiplication syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nint result = 6 ___ 7;\n```",
      ],
    },
    {
      id: "divide",
      title: "Integer division",
      prompt: "Declare int result as 17 divided by 5 using integer division.",
      solution: "int result = 17 / 5;",
      checks: ["result == 3"],
      rules: [
        {"kind":"DivideExpression","message":"Use the integer division syntax requested in the prompt."},
      ],
      hints: [
        "Two integer operands produce an integer quotient.",
        "Use the integer division syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nint result = 17 ___ 5;\n```",
      ],
    },
    {
      id: "remainder",
      title: "Remainder",
      prompt: "Declare int result as the remainder of 17 divided by 5.",
      solution: "int result = 17 % 5;",
      checks: ["result == 2"],
      rules: [
        {"kind":"ModuloExpression","message":"Use the remainder syntax requested in the prompt."},
      ],
      hints: [
        "The remainder operator is %.",
        "Use the remainder syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nint result = 17 ___ 5;\n```",
      ],
    },
    {
      id: "increment",
      title: "Postfix increment",
      prompt: "Declare int count = 4, then increment it using postfix ++.",
      solution: "int count = 4;\ncount++;",
      checks: ["count == 5"],
      rules: [
        {"kind":"PostIncrementExpression","message":"Use the postfix increment syntax requested in the prompt."},
      ],
      hints: [
        "Postfix means the operator comes after the variable.",
        "Use the postfix increment syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nint count = 4;\ncount___;\n```",
      ],
    },
    {
      id: "decrement",
      title: "Prefix decrement",
      prompt: "Declare int count = 4, then decrement it using prefix --.",
      solution: "int count = 4;\n--count;",
      checks: ["count == 3"],
      rules: [
        {"kind":"PreDecrementExpression","message":"Use the prefix decrement syntax requested in the prompt."},
      ],
      hints: [
        "Prefix means the operator comes before the variable.",
        "Use the prefix decrement syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nint count = 4;\n___count;\n```",
      ],
    },
    {
      id: "add-assign",
      title: "Addition assignment",
      prompt: "Declare int total = 10, then add 5 using +=.",
      solution: "int total = 10;\ntotal += 5;",
      checks: ["total == 15"],
      rules: [
        {"kind":"AddAssignmentExpression","message":"Use the addition assignment syntax requested in the prompt."},
      ],
      hints: [
        "Compound assignment updates the existing variable.",
        "Use the addition assignment syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nint total = 10;\ntotal ___ 5;\n```",
      ],
    },
    {
      id: "multiply-assign",
      title: "Multiplication assignment",
      prompt: "Declare int total = 3, then multiply it by 4 using *=.",
      solution: "int total = 3;\ntotal *= 4;",
      checks: ["total == 12"],
      rules: [
        {"kind":"MultiplyAssignmentExpression","message":"Use the multiplication assignment syntax requested in the prompt."},
      ],
      hints: [
        "Combine the multiplication and assignment operators.",
        "Use the multiplication assignment syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nint total = 3;\ntotal ___ 4;\n```",
      ],
    },
    {
      id: "equal",
      title: "Equality comparison",
      prompt: "Declare bool result by checking whether 7 equals 7 using ==.",
      solution: "bool result = 7 == 7;",
      checks: ["result"],
      rules: [
        {"kind":"EqualsExpression","message":"Use the equality comparison syntax requested in the prompt."},
      ],
      hints: [
        "Equality uses two equals signs.",
        "Use the equality comparison syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nbool result = 7 ___ 7;\n```",
      ],
    },
    {
      id: "not-equal",
      title: "Inequality comparison",
      prompt: "Declare bool result by checking whether 3 differs from 4 using !=.",
      solution: "bool result = 3 != 4;",
      checks: ["result"],
      rules: [
        {"kind":"NotEqualsExpression","message":"Use the inequality comparison syntax requested in the prompt."},
      ],
      hints: [
        "An exclamation mark negates equality.",
        "Use the inequality comparison syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nbool result = 3 ___ 4;\n```",
      ],
    },
    {
      id: "greater",
      title: "Greater-than comparison",
      prompt: "Declare bool result by checking whether 9 is greater than 4.",
      solution: "bool result = 9 > 4;",
      checks: ["result"],
      rules: [
        {"kind":"GreaterThanExpression","message":"Use the greater-than comparison syntax requested in the prompt."},
      ],
      hints: [
        "Use a single greater-than sign.",
        "Use the greater-than comparison syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nbool result = 9 ___ 4;\n```",
      ],
    },
    {
      id: "less-equal",
      title: "Less-than-or-equal comparison",
      prompt: "Declare bool result by checking whether 4 is less than or equal to 4.",
      solution: "bool result = 4 <= 4;",
      checks: ["result"],
      rules: [
        {"kind":"LessThanOrEqualExpression","message":"Use the less-than-or-equal comparison syntax requested in the prompt."},
      ],
      hints: [
        "Put the comparison sign before the equals sign.",
        "Use the less-than-or-equal comparison syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nbool result = 4 ___ 4;\n```",
      ],
    },
    {
      id: "and",
      title: "Logical AND",
      prompt: "Declare bool result using && on true and false.",
      solution: "bool result = true && false;",
      checks: ["!result"],
      rules: [
        {"kind":"LogicalAndExpression","message":"Use the logical and syntax requested in the prompt."},
      ],
      hints: [
        "Both operands must be true for AND to be true.",
        "Use the logical and syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nbool result = true ___ false;\n```",
      ],
    },
    {
      id: "or",
      title: "Logical OR",
      prompt: "Declare bool result using || on false and true.",
      solution: "bool result = false || true;",
      checks: ["result"],
      rules: [
        {"kind":"LogicalOrExpression","message":"Use the logical or syntax requested in the prompt."},
      ],
      hints: [
        "Logical OR uses two vertical bars.",
        "Use the logical or syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nbool result = false ___ true;\n```",
      ],
    },
    {
      id: "not",
      title: "Logical negation",
      prompt: "Declare bool enabled = false, then bool result using !enabled.",
      solution: "bool enabled = false;\nbool result = !enabled;",
      checks: ["result"],
      rules: [
        {"kind":"LogicalNotExpression","message":"Use the logical negation syntax requested in the prompt."},
      ],
      hints: [
        "Put an exclamation mark before the operand.",
        "Use the logical negation syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nbool enabled = false;\nbool result = ___enabled;\n```",
      ],
    },
    {
      id: "ternary",
      title: "Conditional expression",
      prompt: "Declare bool ready = true. Use ?: to set string result to \"yes\" when ready, otherwise \"no\".",
      solution: "bool ready = true;\nstring result = ready ? \"yes\" : \"no\";",
      checks: ["result == \"yes\""],
      rules: [
        {"kind":"ConditionalExpression","message":"Use the conditional expression syntax requested in the prompt."},
      ],
      hints: [
        "The true branch follows ?, and the false branch follows :.",
        "Use the conditional expression syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nbool ready = true;\nstring result = ready ? \"___\" : \"___\";\n```",
      ],
    },
    {
      id: "coalesce",
      title: "Null coalescing",
      prompt: "Declare int? count = null, then int result using count ?? 5.",
      solution: "int? count = null;\nint result = count ?? 5;",
      checks: ["result == 5"],
      rules: [
        {"kind":"CoalesceExpression","message":"Use the null coalescing syntax requested in the prompt."},
      ],
      hints: [
        "Two question marks choose a fallback for null.",
        "Use the null coalescing syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nint? count = null;\nint result = count ___ 5;\n```",
      ],
    },
    {
      id: "coalesce-assign",
      title: "Null-coalescing assignment",
      prompt: "Declare string? name = null. Use ??= to assign \"Ada\" when name is null.",
      solution: "string? name = null;\nname ??= \"Ada\";",
      checks: ["name == \"Ada\""],
      rules: [
        {"kind":"CoalesceAssignmentExpression","message":"Use the null-coalescing assignment syntax requested in the prompt."},
      ],
      hints: [
        "Combine null coalescing with assignment.",
        "Use the null-coalescing assignment syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nstring? name = null;\nname ___ \"Ada\";\n```",
      ],
    },
    {
      id: "null-conditional",
      title: "Null-conditional access",
      prompt: "Declare string? name = null. Use ?.Length to create int? length.",
      solution: "string? name = null;\nint? length = name?.Length;",
      checks: ["length is null"],
      rules: [
        {"kind":"ConditionalAccessExpression","message":"Use the null-conditional access syntax requested in the prompt."},
      ],
      hints: [
        "Place ? before the member-access dot.",
        "Use the null-conditional access syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nstring? name = null;\nint? length = name___.Length;\n```",
      ],
    },
    {
      id: "add-practice",
      title: "Addition: another example",
      prompt: "Declare int answer as 7 plus 5 using +.",
      solution: "int answer = 7 + 5;",
      checks: ["answer == 12"],
      rules: [
        {"kind":"AddExpression","message":"Use the addition syntax requested in the prompt."},
      ],
      hints: [
        "Put the operator between the operands.",
        "Use the addition syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nint answer = 7 ___ 5;\n```",
      ],
    },
    {
      id: "subtract-practice",
      title: "Subtraction: another example",
      prompt: "Declare int answer as 20 minus 8 using -.",
      solution: "int answer = 20 - 8;",
      checks: ["answer == 12"],
      rules: [
        {"kind":"SubtractExpression","message":"Use the subtraction syntax requested in the prompt."},
      ],
      hints: [
        "Subtraction uses a single minus sign.",
        "Use the subtraction syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nint answer = 20 ___ 8;\n```",
      ],
    },
    {
      id: "multiply-practice",
      title: "Multiplication: another example",
      prompt: "Declare int answer as 6 times 7 using *.",
      solution: "int answer = 6 * 7;",
      checks: ["answer == 42"],
      rules: [
        {"kind":"MultiplyExpression","message":"Use the multiplication syntax requested in the prompt."},
      ],
      hints: [
        "Multiplication uses an asterisk.",
        "Use the multiplication syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nint answer = 6 ___ 7;\n```",
      ],
    },
    {
      id: "divide-practice",
      title: "Integer division: another example",
      prompt: "Declare int answer as 17 divided by 5 using integer division.",
      solution: "int answer = 17 / 5;",
      checks: ["answer == 3"],
      rules: [
        {"kind":"DivideExpression","message":"Use the integer division syntax requested in the prompt."},
      ],
      hints: [
        "Two integer operands produce an integer quotient.",
        "Use the integer division syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nint answer = 17 ___ 5;\n```",
      ],
    },
    {
      id: "remainder-practice",
      title: "Remainder: another example",
      prompt: "Declare int answer as the remainder of 17 divided by 5.",
      solution: "int answer = 17 % 5;",
      checks: ["answer == 2"],
      rules: [
        {"kind":"ModuloExpression","message":"Use the remainder syntax requested in the prompt."},
      ],
      hints: [
        "The remainder operator is %.",
        "Use the remainder syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nint answer = 17 ___ 5;\n```",
      ],
    },
    {
      id: "increment-practice",
      title: "Postfix increment: another example",
      prompt: "Declare int itemCount = 4, then increment it using postfix ++.",
      solution: "int itemCount = 4;\nitemCount++;",
      checks: ["itemCount == 5"],
      rules: [
        {"kind":"PostIncrementExpression","message":"Use the postfix increment syntax requested in the prompt."},
      ],
      hints: [
        "Postfix means the operator comes after the variable.",
        "Use the postfix increment syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nint itemCount = 4;\ncount___;\n```",
      ],
    },
    {
      id: "decrement-practice",
      title: "Prefix decrement: another example",
      prompt: "Declare int itemCount = 4, then decrement it using prefix --.",
      solution: "int itemCount = 4;\n--itemCount;",
      checks: ["itemCount == 3"],
      rules: [
        {"kind":"PreDecrementExpression","message":"Use the prefix decrement syntax requested in the prompt."},
      ],
      hints: [
        "Prefix means the operator comes before the variable.",
        "Use the prefix decrement syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nint itemCount = 4;\n___count;\n```",
      ],
    },
    {
      id: "add-assign-practice",
      title: "Addition assignment: another example",
      prompt: "Declare int sum = 10, then add 5 using +=.",
      solution: "int sum = 10;\nsum += 5;",
      checks: ["sum == 15"],
      rules: [
        {"kind":"AddAssignmentExpression","message":"Use the addition assignment syntax requested in the prompt."},
      ],
      hints: [
        "Compound assignment updates the existing variable.",
        "Use the addition assignment syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nint sum = 10;\nsum ___ 5;\n```",
      ],
    },
    {
      id: "multiply-assign-practice",
      title: "Multiplication assignment: another example",
      prompt: "Declare int sum = 3, then multiply it by 4 using *=.",
      solution: "int sum = 3;\nsum *= 4;",
      checks: ["sum == 12"],
      rules: [
        {"kind":"MultiplyAssignmentExpression","message":"Use the multiplication assignment syntax requested in the prompt."},
      ],
      hints: [
        "Combine the multiplication and assignment operators.",
        "Use the multiplication assignment syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nint sum = 3;\nsum ___ 4;\n```",
      ],
    },
    {
      id: "equal-practice",
      title: "Equality comparison: another example",
      prompt: "Declare bool answer by checking whether 7 equals 7 using ==.",
      solution: "bool answer = 7 == 7;",
      checks: ["answer"],
      rules: [
        {"kind":"EqualsExpression","message":"Use the equality comparison syntax requested in the prompt."},
      ],
      hints: [
        "Equality uses two equals signs.",
        "Use the equality comparison syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nbool answer = 7 ___ 7;\n```",
      ],
    },
    {
      id: "not-equal-practice",
      title: "Inequality comparison: another example",
      prompt: "Declare bool answer by checking whether 3 differs from 4 using !=.",
      solution: "bool answer = 3 != 4;",
      checks: ["answer"],
      rules: [
        {"kind":"NotEqualsExpression","message":"Use the inequality comparison syntax requested in the prompt."},
      ],
      hints: [
        "An exclamation mark negates equality.",
        "Use the inequality comparison syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nbool answer = 3 ___ 4;\n```",
      ],
    },
    {
      id: "greater-practice",
      title: "Greater-than comparison: another example",
      prompt: "Declare bool answer by checking whether 9 is greater than 4.",
      solution: "bool answer = 9 > 4;",
      checks: ["answer"],
      rules: [
        {"kind":"GreaterThanExpression","message":"Use the greater-than comparison syntax requested in the prompt."},
      ],
      hints: [
        "Use a single greater-than sign.",
        "Use the greater-than comparison syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nbool answer = 9 ___ 4;\n```",
      ],
    },
    {
      id: "less-equal-practice",
      title: "Less-than-or-equal comparison: another example",
      prompt: "Declare bool answer by checking whether 4 is less than or equal to 4.",
      solution: "bool answer = 4 <= 4;",
      checks: ["answer"],
      rules: [
        {"kind":"LessThanOrEqualExpression","message":"Use the less-than-or-equal comparison syntax requested in the prompt."},
      ],
      hints: [
        "Put the comparison sign before the equals sign.",
        "Use the less-than-or-equal comparison syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nbool answer = 4 ___ 4;\n```",
      ],
    },
    {
      id: "and-practice",
      title: "Logical AND: another example",
      prompt: "Declare bool answer using && on true and false.",
      solution: "bool answer = true && false;",
      checks: ["!answer"],
      rules: [
        {"kind":"LogicalAndExpression","message":"Use the logical and syntax requested in the prompt."},
      ],
      hints: [
        "Both operands must be true for AND to be true.",
        "Use the logical and syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nbool answer = true ___ false;\n```",
      ],
    },
    {
      id: "or-practice",
      title: "Logical OR: another example",
      prompt: "Declare bool answer using || on false and true.",
      solution: "bool answer = false || true;",
      checks: ["answer"],
      rules: [
        {"kind":"LogicalOrExpression","message":"Use the logical or syntax requested in the prompt."},
      ],
      hints: [
        "Logical OR uses two vertical bars.",
        "Use the logical or syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nbool answer = false ___ true;\n```",
      ],
    },
    {
      id: "not-practice",
      title: "Logical negation: another example",
      prompt: "Declare bool active = false, then bool result using !active.",
      solution: "bool active = false;\nbool result = !active;",
      checks: ["result"],
      rules: [
        {"kind":"LogicalNotExpression","message":"Use the logical negation syntax requested in the prompt."},
      ],
      hints: [
        "Put an exclamation mark before the operand.",
        "Use the logical negation syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nbool active = false;\nbool result = ___enabled;\n```",
      ],
    },
    {
      id: "ternary-practice",
      title: "Conditional expression: another example",
      prompt: "Declare bool readySample = true. Use ?: to set string result to \"yes\" when readySample, otherwise \"no\".",
      solution: "bool readySample = true;\nstring result = readySample ? \"yes\" : \"no\";",
      checks: ["result == \"yes\""],
      rules: [
        {"kind":"ConditionalExpression","message":"Use the conditional expression syntax requested in the prompt."},
      ],
      hints: [
        "The true branch follows ?, and the false branch follows :.",
        "Use the conditional expression syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nbool readySample = true;\nstring result = readySample ? \"___\" : \"___\";\n```",
      ],
    },
    {
      id: "coalesce-practice",
      title: "Null coalescing: another example",
      prompt: "Declare int? itemCount = null, then int result using itemCount ?? 5.",
      solution: "int? itemCount = null;\nint result = itemCount ?? 5;",
      checks: ["result == 5"],
      rules: [
        {"kind":"CoalesceExpression","message":"Use the null coalescing syntax requested in the prompt."},
      ],
      hints: [
        "Two question marks choose a fallback for null.",
        "Use the null coalescing syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nint? itemCount = null;\nint result = itemCount ___ 5;\n```",
      ],
    },
    {
      id: "coalesce-assign-practice",
      title: "Null-coalescing assignment: another example",
      prompt: "Declare string? displayName = null. Use ??= to assign \"Ada\" when displayName is null.",
      solution: "string? displayName = null;\ndisplayName ??= \"Ada\";",
      checks: ["displayName == \"Ada\""],
      rules: [
        {"kind":"CoalesceAssignmentExpression","message":"Use the null-coalescing assignment syntax requested in the prompt."},
      ],
      hints: [
        "Combine null coalescing with assignment.",
        "Use the null-coalescing assignment syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nstring? displayName = null;\ndisplayName ___ \"Ada\";\n```",
      ],
    },
    {
      id: "null-conditional-practice",
      title: "Null-conditional access: another example",
      prompt: "Declare string? displayName = null. Use ?.Length to create int? length.",
      solution: "string? displayName = null;\nint? length = displayName?.Length;",
      checks: ["length is null"],
      rules: [
        {"kind":"ConditionalAccessExpression","message":"Use the null-conditional access syntax requested in the prompt."},
      ],
      hints: [
        "Place ? before the member-access dot.",
        "Use the null-conditional access syntax requested in the prompt.",
        "Complete this form:\n\n```csharp\nstring? displayName = null;\nint? length = name___.Length;\n```",
      ],
    },
  ],
};

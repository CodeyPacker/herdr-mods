/** @type {import("../types.js").Topic} */
export const arrays = {
  id: "arrays",
  title: "Arrays",
  description: "Creation, indexing, ranges, and array methods.",
  exercises: [
    {
      id: "allocate",
      title: "Allocate an array",
      prompt: "Declare int[] values as a new array with length 4.",
      solution: "int[] values = new int[4];",
      checks: ["values.Length == 4 && values.All(x => x == 0)"],
      rules: [
        {"kind":"ArrayCreationExpression","message":"Use new int[4]."},
      ],
      hints: [
        "The size goes in square brackets.",
        "Use new int[4].",
        "Complete this form:\n\n```csharp\nint[] values = new int[___];\n```",
      ],
    },
    {
      id: "initializer",
      title: "Use an array initializer",
      prompt: "Declare int[] values using an initializer containing 2, 4, and 6 without new.",
      solution: "int[] values = { 2, 4, 6 };",
      checks: ["values.SequenceEqual(new[] { 2, 4, 6 })"],
      rules: [
        {"kind":"VariableDeclarator","message":"Declare values using int[].","name":"values","type":"int[]"},
        {"kind":"ArrayInitializerExpression","message":"Put the initial values inside braces."},
      ],
      hints: [
        "An explicitly typed array declaration can omit new.",
        "Declare values using int[]. Put the initial values inside braces.",
        "Complete this form:\n\n```csharp\nint[] values = { ___, ___, ___ };\n```",
      ],
    },
    {
      id: "explicit-new",
      title: "Create with an explicit type",
      prompt: "Use new string[] to declare string[] names containing \"Ada\" and \"Lin\".",
      solution: "string[] names = new string[] { \"Ada\", \"Lin\" };",
      checks: ["names.SequenceEqual(new[] { \"Ada\", \"Lin\" })"],
      rules: [
        {"kind":"ArrayCreationExpression","message":"Put string[] after new and the values in braces."},
      ],
      hints: [
        "Explicit array creation specifies the element type.",
        "Put string[] after new and the values in braces.",
        "Complete this form:\n\n```csharp\nstring[] names = new string[] { \"___\", \"___\" };\n```",
      ],
    },
    {
      id: "inferred",
      title: "Infer the array type",
      prompt: "Use var values = new[] with elements 1, 2, and 3.",
      solution: "var values = new[] { 1, 2, 3 };",
      checks: ["values.SequenceEqual(new[] { 1, 2, 3 })"],
      rules: [
        {"kind":"ImplicitArrayCreationExpression","message":"Use new[] without an element type."},
      ],
      hints: [
        "The compiler infers the element type from the values.",
        "Use new[] without an element type.",
        "Complete this form:\n\n```csharp\nvar values = new[] { ___, ___, ___ };\n```",
      ],
    },
    {
      id: "collection-expression",
      title: "Use a collection expression",
      prompt: "Declare int[] values with the collection expression [1, 2, 3].",
      solution: "int[] values = [1, 2, 3];",
      checks: ["values.SequenceEqual(new[] { 1, 2, 3 })"],
      rules: [
        {"kind":"CollectionExpression","message":"Put the elements directly inside square brackets."},
      ],
      hints: [
        "A collection expression needs a target collection type.",
        "Put the elements directly inside square brackets.",
        "Complete this form:\n\n```csharp\nint[] values = [___, ___, ___];\n```",
      ],
    },
    {
      id: "read",
      title: "Read an array element",
      prompt: "Declare int[] values = { 10, 20, 30 }. Read the second element into int result using an index.",
      solution: "int[] values = { 10, 20, 30 };\nint result = values[1];",
      checks: ["result == 20"],
      rules: [
        {"kind":"ElementAccessExpression","message":"Use index 1 for the second element."},
      ],
      hints: [
        "Array indexes begin at zero.",
        "Use index 1 for the second element.",
        "Complete this form:\n\n```csharp\nint[] values = { 10, 20, 30 };\nint result = values[___];\n```",
      ],
    },
    {
      id: "write",
      title: "Assign an array element",
      prompt: "Declare int[] values = { 1, 2, 3 }. Assign 9 to its last element using an index.",
      solution: "int[] values = { 1, 2, 3 };\nvalues[2] = 9;",
      checks: ["values.SequenceEqual(new[] { 1, 2, 9 })"],
      rules: [
        {"kind":"SimpleAssignmentExpression","message":"Assign the new value to values[2]."},
      ],
      hints: [
        "Indexed elements can appear on the left of =.",
        "Assign the new value to values[2].",
        "Complete this form:\n\n```csharp\nint[] values = { 1, 2, 3 };\nvalues[___] = ___;\n```",
      ],
    },
    {
      id: "length",
      title: "Read array length",
      prompt: "Declare int[] values = { 1, 2, 3 }. Read its Length into int count.",
      solution: "int[] values = { 1, 2, 3 };\nint count = values.Length;",
      checks: ["count == 3"],
      rules: [
        {"kind":"SimpleMemberAccessExpression","message":"Use the Length property.","token":"Length"},
      ],
      hints: [
        "Arrays have Length rather than Count.",
        "Use the Length property.",
        "Complete this form:\n\n```csharp\nint[] values = { 1, 2, 3 };\nint count = values.___;\n```",
      ],
    },
    {
      id: "from-end",
      title: "Index from the end",
      prompt: "Declare int[] values = { 10, 20, 30 }. Use ^1 to read the last element into int result.",
      solution: "int[] values = { 10, 20, 30 };\nint result = values[^1];",
      checks: ["result == 30"],
      rules: [
        {"kind":"IndexExpression","message":"Put ^1 inside the indexing brackets."},
      ],
      hints: [
        "^1 means one position from the end.",
        "Put ^1 inside the indexing brackets.",
        "Complete this form:\n\n```csharp\nint[] values = { 10, 20, 30 };\nint result = values[^___];\n```",
      ],
    },
    {
      id: "slice",
      title: "Slice an array",
      prompt: "Declare int[] values = { 1, 2, 3, 4 }. Use [1..3] to create int[] middle containing 2 and 3.",
      solution: "int[] values = { 1, 2, 3, 4 };\nint[] middle = values[1..3];",
      checks: ["middle.SequenceEqual(new[] { 2, 3 })"],
      rules: [
        {"kind":"RangeExpression","message":"Separate the start and exclusive end with .. ."},
      ],
      hints: [
        "A range excludes its end index.",
        "Separate the start and exclusive end with .. .",
        "Complete this form:\n\n```csharp\nint[] values = { 1, 2, 3, 4 };\nint[] middle = values[___..___];\n```",
      ],
    },
    {
      id: "empty",
      title: "Create an empty array",
      prompt: "Use Array.Empty<int>() to declare int[] values.",
      solution: "int[] values = Array.Empty<int>();",
      checks: ["values.Length == 0"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Empty with the required arguments.","token":"Empty"},
      ],
      hints: [
        "The element type is a generic type argument.",
        "Call Empty with the required arguments.",
        "Complete this form:\n\n```csharp\nint[] values = Array.Empty<___>();\n```",
      ],
    },
    {
      id: "sort",
      title: "Sort an array",
      prompt: "Declare int[] values = { 3, 1, 2 }. Sort it in place using Array.Sort.",
      solution: "int[] values = { 3, 1, 2 };\nArray.Sort(values);",
      checks: ["values.SequenceEqual(new[] { 1, 2, 3 })"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Sort with the required arguments.","token":"Sort"},
      ],
      hints: [
        "Array.Sort changes the existing array.",
        "Call Sort with the required arguments.",
        "Complete this form:\n\n```csharp\nint[] values = { 3, 1, 2 };\nArray.___(values);\n```",
      ],
    },
    {
      id: "reverse",
      title: "Reverse an array",
      prompt: "Declare int[] values = { 1, 2, 3 }. Reverse it in place using Array.Reverse.",
      solution: "int[] values = { 1, 2, 3 };\nArray.Reverse(values);",
      checks: ["values.SequenceEqual(new[] { 3, 2, 1 })"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Reverse with the required arguments.","token":"Reverse"},
      ],
      hints: [
        "Use the static method on Array.",
        "Call Reverse with the required arguments.",
        "Complete this form:\n\n```csharp\nint[] values = { 1, 2, 3 };\nArray.___(values);\n```",
      ],
    },
    {
      id: "index-of",
      title: "Find an element index",
      prompt: "Declare int[] values = { 10, 20, 30 }. Use Array.IndexOf to store the index of 20 in int result.",
      solution: "int[] values = { 10, 20, 30 };\nint result = Array.IndexOf(values, 20);",
      checks: ["result == 1"],
      rules: [
        {"kind":"InvocationExpression","message":"Call IndexOf with the required arguments.","token":"IndexOf"},
      ],
      hints: [
        "Pass the array before the value to find.",
        "Call IndexOf with the required arguments.",
        "Complete this form:\n\n```csharp\nint[] values = { 10, 20, 30 };\nint result = Array.IndexOf(___, ___);\n```",
      ],
    },
    {
      id: "fill",
      title: "Fill an array",
      prompt: "Declare int[] values = new int[3]. Use Array.Fill to set every element to 7.",
      solution: "int[] values = new int[3];\nArray.Fill(values, 7);",
      checks: ["values.SequenceEqual(new[] { 7, 7, 7 })"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Fill with the required arguments.","token":"Fill"},
      ],
      hints: [
        "Fill receives the array and the repeated value.",
        "Call Fill with the required arguments.",
        "Complete this form:\n\n```csharp\nint[] values = new int[3];\nArray.Fill(values, ___);\n```",
      ],
    },
    {
      id: "copy",
      title: "Copy array elements",
      prompt: "Declare int[] source = { 4, 5 } and int[] target = new int[2]. Copy both elements using Array.Copy.",
      solution: "int[] source = { 4, 5 };\nint[] target = new int[2];\nArray.Copy(source, target, 2);",
      checks: ["target.SequenceEqual(source) && !ReferenceEquals(source, target)"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Copy with the required arguments.","token":"Copy"},
      ],
      hints: [
        "Pass source, destination, then element count.",
        "Call Copy with the required arguments.",
        "Complete this form:\n\n```csharp\nint[] source = { 4, 5 };\nint[] target = new int[2];\nArray.Copy(___, ___, ___);\n```",
      ],
    },
    {
      id: "resize",
      title: "Resize an array",
      prompt: "Declare int[] values = { 1, 2 }. Use Array.Resize with ref to make its length 4.",
      solution: "int[] values = { 1, 2 };\nArray.Resize(ref values, 4);",
      checks: ["values.SequenceEqual(new[] { 1, 2, 0, 0 })"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Resize with the required arguments.","token":"Resize"},
      ],
      hints: [
        "Resize needs ref because it replaces the array reference.",
        "Call Resize with the required arguments.",
        "Complete this form:\n\n```csharp\nint[] values = { 1, 2 };\nArray.Resize(ref ___, ___);\n```",
      ],
    },
    {
      id: "matrix",
      title: "Create a rectangular array",
      prompt: "Declare int[,] grid as new int[2, 3]. Set the element at row 1, column 2 to 9.",
      solution: "int[,] grid = new int[2, 3];\ngrid[1, 2] = 9;",
      checks: ["grid.GetLength(0) == 2 && grid.GetLength(1) == 3 && grid[1, 2] == 9"],
      rules: [
        {"kind":"ArrayRankSpecifier","message":"Separate dimensions with a comma inside brackets.","token":","},
      ],
      hints: [
        "A rectangular array uses one bracket pair for all dimensions.",
        "Separate dimensions with a comma inside brackets.",
        "Complete this form:\n\n```csharp\nint[,] grid = new int[___, ___];\ngrid[1, 2] = ___;\n```",
      ],
    },
    {
      id: "jagged",
      title: "Create a jagged array",
      prompt: "Declare int[][] rows containing new[] { 1, 2 } and new[] { 3 }. Access the value 3 through two indexes into int result.",
      solution: "int[][] rows = { new[] { 1, 2 }, new[] { 3 } };\nint result = rows[1][0];",
      checks: ["result == 3 && rows[0].Length == 2 && rows[1].Length == 1"],
      rules: [
        {"kind":"VariableDeclarator","message":"Declare rows using int[][].","name":"rows","type":"int[][]"},
      ],
      hints: [
        "A jagged array is an array whose elements are arrays.",
        "Declare rows using int[][].",
        "Complete this form:\n\n```csharp\nint[][] rows = { new[] { 1, 2 }, new[] { 3 } };\nint result = rows[___][___];\n```",
      ],
    },
    {
      id: "spread",
      title: "Spread into a new array",
      prompt: "Declare int[] first = { 1, 2 }. Use a collection expression with ..first to create int[] combined containing 1, 2, 3.",
      solution: "int[] first = { 1, 2 };\nint[] combined = [..first, 3];",
      checks: ["combined.SequenceEqual(new[] { 1, 2, 3 })"],
      rules: [
        {"kind":"SpreadElement","message":"Put .. before first inside the collection expression."},
      ],
      hints: [
        "Spread inserts the elements of another collection.",
        "Put .. before first inside the collection expression.",
        "Complete this form:\n\n```csharp\nint[] first = { 1, 2 };\nint[] combined = [..___, ___];\n```",
      ],
    },
    {
      id: "allocate-practice",
      title: "Allocate an array: another example",
      prompt: "Declare int[] samples as a new array with length 4.",
      solution: "int[] samples = new int[4];",
      checks: ["samples.Length == 4 && samples.All(x => x == 0)"],
      rules: [
        {"kind":"ArrayCreationExpression","message":"Use new int[4]."},
      ],
      hints: [
        "The size goes in square brackets.",
        "Use new int[4].",
        "Complete this form:\n\n```csharp\nint[] samples = new int[___];\n```",
      ],
    },
    {
      id: "initializer-practice",
      title: "Use an array initializer: another example",
      prompt: "Declare int[] samples using an initializer containing 2, 4, and 6 without new.",
      solution: "int[] samples = { 2, 4, 6 };",
      checks: ["samples.SequenceEqual(new[] { 2, 4, 6 })"],
      rules: [
        {"kind":"VariableDeclarator","message":"Declare samples using int[].","name":"samples","type":"int[]"},
        {"kind":"ArrayInitializerExpression","message":"Put the initial samples inside braces."},
      ],
      hints: [
        "An explicitly typed array declaration can omit new.",
        "Declare samples using int[]. Put the initial samples inside braces.",
        "Complete this form:\n\n```csharp\nint[] samples = { ___, ___, ___ };\n```",
      ],
    },
    {
      id: "explicit-new-practice",
      title: "Create with an explicit type: another example",
      prompt: "Use new string[] to declare string[] namesSample containing \"Ada\" and \"Lin\".",
      solution: "string[] namesSample = new string[] { \"Ada\", \"Lin\" };",
      checks: ["namesSample.SequenceEqual(new[] { \"Ada\", \"Lin\" })"],
      rules: [
        {"kind":"ArrayCreationExpression","message":"Put string[] after new and the values in braces."},
      ],
      hints: [
        "Explicit array creation specifies the element type.",
        "Put string[] after new and the values in braces.",
        "Complete this form:\n\n```csharp\nstring[] namesSample = new string[] { \"___\", \"___\" };\n```",
      ],
    },
    {
      id: "inferred-practice",
      title: "Infer the array type: another example",
      prompt: "Use var samples = new[] with elements 1, 2, and 3.",
      solution: "var samples = new[] { 1, 2, 3 };",
      checks: ["samples.SequenceEqual(new[] { 1, 2, 3 })"],
      rules: [
        {"kind":"ImplicitArrayCreationExpression","message":"Use new[] without an element type."},
      ],
      hints: [
        "The compiler infers the element type from the samples.",
        "Use new[] without an element type.",
        "Complete this form:\n\n```csharp\nvar samples = new[] { ___, ___, ___ };\n```",
      ],
    },
    {
      id: "collection-expression-practice",
      title: "Use a collection expression: another example",
      prompt: "Declare int[] samples with the collection expression [1, 2, 3].",
      solution: "int[] samples = [1, 2, 3];",
      checks: ["samples.SequenceEqual(new[] { 1, 2, 3 })"],
      rules: [
        {"kind":"CollectionExpression","message":"Put the elements directly inside square brackets."},
      ],
      hints: [
        "A collection expression needs a target collection type.",
        "Put the elements directly inside square brackets.",
        "Complete this form:\n\n```csharp\nint[] samples = [___, ___, ___];\n```",
      ],
    },
    {
      id: "read-practice",
      title: "Read an array element: another example",
      prompt: "Declare int[] samples = { 10, 20, 30 }. Read the second element into int result using an index.",
      solution: "int[] samples = { 10, 20, 30 };\nint result = samples[1];",
      checks: ["result == 20"],
      rules: [
        {"kind":"ElementAccessExpression","message":"Use index 1 for the second element."},
      ],
      hints: [
        "Array indexes begin at zero.",
        "Use index 1 for the second element.",
        "Complete this form:\n\n```csharp\nint[] samples = { 10, 20, 30 };\nint result = samples[___];\n```",
      ],
    },
    {
      id: "write-practice",
      title: "Assign an array element: another example",
      prompt: "Declare int[] samples = { 1, 2, 3 }. Assign 9 to its last element using an index.",
      solution: "int[] samples = { 1, 2, 3 };\nsamples[2] = 9;",
      checks: ["samples.SequenceEqual(new[] { 1, 2, 9 })"],
      rules: [
        {"kind":"SimpleAssignmentExpression","message":"Assign the new value to samples[2]."},
      ],
      hints: [
        "Indexed elements can appear on the left of =.",
        "Assign the new value to samples[2].",
        "Complete this form:\n\n```csharp\nint[] samples = { 1, 2, 3 };\nsamples[___] = ___;\n```",
      ],
    },
    {
      id: "length-practice",
      title: "Read array length: another example",
      prompt: "Declare int[] samples = { 1, 2, 3 }. Read its Length into int count.",
      solution: "int[] samples = { 1, 2, 3 };\nint count = samples.Length;",
      checks: ["count == 3"],
      rules: [
        {"kind":"SimpleMemberAccessExpression","message":"Use the Length property.","token":"Length"},
      ],
      hints: [
        "Arrays have Length rather than Count.",
        "Use the Length property.",
        "Complete this form:\n\n```csharp\nint[] samples = { 1, 2, 3 };\nint count = samples.___;\n```",
      ],
    },
    {
      id: "from-end-practice",
      title: "Index from the end: another example",
      prompt: "Declare int[] samples = { 10, 20, 30 }. Use ^1 to read the last element into int result.",
      solution: "int[] samples = { 10, 20, 30 };\nint result = samples[^1];",
      checks: ["result == 30"],
      rules: [
        {"kind":"IndexExpression","message":"Put ^1 inside the indexing brackets."},
      ],
      hints: [
        "^1 means one position from the end.",
        "Put ^1 inside the indexing brackets.",
        "Complete this form:\n\n```csharp\nint[] samples = { 10, 20, 30 };\nint result = samples[^___];\n```",
      ],
    },
    {
      id: "slice-practice",
      title: "Slice an array: another example",
      prompt: "Declare int[] samples = { 1, 2, 3, 4 }. Use [1..3] to create int[] middle containing 2 and 3.",
      solution: "int[] samples = { 1, 2, 3, 4 };\nint[] middle = samples[1..3];",
      checks: ["middle.SequenceEqual(new[] { 2, 3 })"],
      rules: [
        {"kind":"RangeExpression","message":"Separate the start and exclusive end with .. ."},
      ],
      hints: [
        "A range excludes its end index.",
        "Separate the start and exclusive end with .. .",
        "Complete this form:\n\n```csharp\nint[] samples = { 1, 2, 3, 4 };\nint[] middle = samples[___..___];\n```",
      ],
    },
    {
      id: "empty-practice",
      title: "Create an empty array: another example",
      prompt: "Use Array.Empty<int>() to declare int[] samples.",
      solution: "int[] samples = Array.Empty<int>();",
      checks: ["samples.Length == 0"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Empty with the required arguments.","token":"Empty"},
      ],
      hints: [
        "The element type is a generic type argument.",
        "Call Empty with the required arguments.",
        "Complete this form:\n\n```csharp\nint[] samples = Array.Empty<___>();\n```",
      ],
    },
    {
      id: "sort-practice",
      title: "Sort an array: another example",
      prompt: "Declare int[] samples = { 3, 1, 2 }. Sort it in place using Array.Sort.",
      solution: "int[] samples = { 3, 1, 2 };\nArray.Sort(samples);",
      checks: ["samples.SequenceEqual(new[] { 1, 2, 3 })"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Sort with the required arguments.","token":"Sort"},
      ],
      hints: [
        "Array.Sort changes the existing array.",
        "Call Sort with the required arguments.",
        "Complete this form:\n\n```csharp\nint[] samples = { 3, 1, 2 };\nArray.___(samples);\n```",
      ],
    },
    {
      id: "reverse-practice",
      title: "Reverse an array: another example",
      prompt: "Declare int[] samples = { 1, 2, 3 }. Reverse it in place using Array.Reverse.",
      solution: "int[] samples = { 1, 2, 3 };\nArray.Reverse(samples);",
      checks: ["samples.SequenceEqual(new[] { 3, 2, 1 })"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Reverse with the required arguments.","token":"Reverse"},
      ],
      hints: [
        "Use the static method on Array.",
        "Call Reverse with the required arguments.",
        "Complete this form:\n\n```csharp\nint[] samples = { 1, 2, 3 };\nArray.___(samples);\n```",
      ],
    },
    {
      id: "index-of-practice",
      title: "Find an element index: another example",
      prompt: "Declare int[] samples = { 10, 20, 30 }. Use Array.IndexOf to store the index of 20 in int result.",
      solution: "int[] samples = { 10, 20, 30 };\nint result = Array.IndexOf(samples, 20);",
      checks: ["result == 1"],
      rules: [
        {"kind":"InvocationExpression","message":"Call IndexOf with the required arguments.","token":"IndexOf"},
      ],
      hints: [
        "Pass the array before the value to find.",
        "Call IndexOf with the required arguments.",
        "Complete this form:\n\n```csharp\nint[] samples = { 10, 20, 30 };\nint result = Array.IndexOf(___, ___);\n```",
      ],
    },
    {
      id: "fill-practice",
      title: "Fill an array: another example",
      prompt: "Declare int[] samples = new int[3]. Use Array.Fill to set every element to 7.",
      solution: "int[] samples = new int[3];\nArray.Fill(samples, 7);",
      checks: ["samples.SequenceEqual(new[] { 7, 7, 7 })"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Fill with the required arguments.","token":"Fill"},
      ],
      hints: [
        "Fill receives the array and the repeated value.",
        "Call Fill with the required arguments.",
        "Complete this form:\n\n```csharp\nint[] samples = new int[3];\nArray.Fill(samples, ___);\n```",
      ],
    },
    {
      id: "copy-practice",
      title: "Copy array elements: another example",
      prompt: "Declare int[] origin = { 4, 5 } and int[] target = new int[2]. Copy both elements using Array.Copy.",
      solution: "int[] origin = { 4, 5 };\nint[] target = new int[2];\nArray.Copy(origin, target, 2);",
      checks: ["target.SequenceEqual(origin) && !ReferenceEquals(origin, target)"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Copy with the required arguments.","token":"Copy"},
      ],
      hints: [
        "Pass origin, destination, then element count.",
        "Call Copy with the required arguments.",
        "Complete this form:\n\n```csharp\nint[] origin = { 4, 5 };\nint[] target = new int[2];\nArray.Copy(___, ___, ___);\n```",
      ],
    },
    {
      id: "resize-practice",
      title: "Resize an array: another example",
      prompt: "Declare int[] samples = { 1, 2 }. Use Array.Resize with ref to make its length 4.",
      solution: "int[] samples = { 1, 2 };\nArray.Resize(ref samples, 4);",
      checks: ["samples.SequenceEqual(new[] { 1, 2, 0, 0 })"],
      rules: [
        {"kind":"InvocationExpression","message":"Call Resize with the required arguments.","token":"Resize"},
      ],
      hints: [
        "Resize needs ref because it replaces the array reference.",
        "Call Resize with the required arguments.",
        "Complete this form:\n\n```csharp\nint[] samples = { 1, 2 };\nArray.Resize(ref ___, ___);\n```",
      ],
    },
    {
      id: "matrix-practice",
      title: "Create a rectangular array: another example",
      prompt: "Declare int[,] gridSample as new int[2, 3]. Set the element at row 1, column 2 to 9.",
      solution: "int[,] gridSample = new int[2, 3];\ngridSample[1, 2] = 9;",
      checks: ["gridSample.GetLength(0) == 2 && gridSample.GetLength(1) == 3 && gridSample[1, 2] == 9"],
      rules: [
        {"kind":"ArrayRankSpecifier","message":"Separate dimensions with a comma inside brackets.","token":","},
      ],
      hints: [
        "A rectangular array uses one bracket pair for all dimensions.",
        "Separate dimensions with a comma inside brackets.",
        "Complete this form:\n\n```csharp\nint[,] gridSample = new int[___, ___];\ngridSample[1, 2] = ___;\n```",
      ],
    },
    {
      id: "jagged-practice",
      title: "Create a jagged array: another example",
      prompt: "Declare int[][] rowsSample containing new[] { 1, 2 } and new[] { 3 }. Access the value 3 through two indexes into int result.",
      solution: "int[][] rowsSample = { new[] { 1, 2 }, new[] { 3 } };\nint result = rowsSample[1][0];",
      checks: ["result == 3 && rowsSample[0].Length == 2 && rowsSample[1].Length == 1"],
      rules: [
        {"kind":"VariableDeclarator","message":"Declare rowsSample using int[][].","name":"rowsSample","type":"int[][]"},
      ],
      hints: [
        "A jagged array is an array whose elements are arrays.",
        "Declare rowsSample using int[][].",
        "Complete this form:\n\n```csharp\nint[][] rowsSample = { new[] { 1, 2 }, new[] { 3 } };\nint result = rowsSample[___][___];\n```",
      ],
    },
    {
      id: "spread-practice",
      title: "Spread into a new array: another example",
      prompt: "Declare int[] primary = { 1, 2 }. Use a collection expression with ..primary to create int[] combined containing 1, 2, 3.",
      solution: "int[] primary = { 1, 2 };\nint[] combined = [..primary, 3];",
      checks: ["combined.SequenceEqual(new[] { 1, 2, 3 })"],
      rules: [
        {"kind":"SpreadElement","message":"Put .. before primary inside the collection expression."},
      ],
      hints: [
        "Spread inserts the elements of another collection.",
        "Put .. before primary inside the collection expression.",
        "Complete this form:\n\n```csharp\nint[] primary = { 1, 2 };\nint[] combined = [..___, ___];\n```",
      ],
    },
  ],
};

/** @type {import("../types.js").Topic} */
export const spans = {
  id: "spans",
  title: "Spans & references",
  description: "Span, memory slices, stackalloc, ref locals, and ref returns.",
  level: "advanced",
  exercises: [
    {
      id: "array-span",
      title: "Create a span over an array",
      prompt: "Declare int[] values = { 1, 2, 3 }. Use values.AsSpan() to declare Span<int> window, then set window[0] = 9.",
      solution: "int[] values = { 1, 2, 3 };\nSpan<int> window = values.AsSpan();\nwindow[0] = 9;",
      checks: ["values[0] == 9 && window.Length == 3"],
      rules: [
        {"kind":"InvocationExpression","token":"AsSpan","message":"Call AsSpan with the required arguments."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "A span views existing array storage instead of copying it.",
        "Complete this form:\n\n```csharp\nint[] values = { 1, 2, 3 };\nSpan<int> window = values.AsSpan();\nwindow[0] = ___;\n```",
      ],
    },
    {
      id: "stackalloc",
      title: "Allocate a stack span",
      prompt: "Declare Span<int> values = stackalloc int[3], then set values[1] = 7.",
      solution: "Span<int> values = stackalloc int[3];\nvalues[1] = 7;",
      checks: ["values.Length == 3 && values[1] == 7"],
      rules: [
        {"kind":"StackAllocArrayCreationExpression","message":"The target Span<int> makes stackalloc usable without unsafe code."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "The target Span<int> makes stackalloc usable without unsafe code.",
        "Complete this form:\n\n```csharp\nSpan<int> values = stackalloc int[___];\nvalues[1] = 7;\n```",
      ],
    },
    {
      id: "stack-initializer",
      title: "Initialize stack storage",
      prompt: "Declare Span<int> values = stackalloc[] { 2, 4, 6 }.",
      solution: "Span<int> values = stackalloc[] { 2, 4, 6 };",
      checks: ["values.SequenceEqual(new[] { 2, 4, 6 })"],
      rules: [
        {"kind":"ImplicitStackAllocArrayCreationExpression","message":"Put [] after stackalloc, then the initializer in braces."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "Put [] after stackalloc, then the initializer in braces.",
        "Complete this form:\n\n```csharp\nSpan<int> values = stackalloc[] { ___, ___, ___ };\n```",
      ],
    },
    {
      id: "read-only",
      title: "View a string as a readonly span",
      prompt: "Declare string text = \"hello\". Declare ReadOnlySpan<char> characters = text.AsSpan().",
      solution: "string text = \"hello\";\nReadOnlySpan<char> characters = text.AsSpan();",
      checks: ["characters.Length == 5 && characters[0] == 'h'"],
      rules: [
        {"kind":"VariableDeclarator","name":"characters","type":"ReadOnlySpan<char>","message":"Use ReadOnlySpan<char> for the string view."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "Strings expose readonly character storage.",
        "Complete this form:\n\n```csharp\nstring text = \"hello\";\nReadOnlySpan<char> characters = text.___();\n```",
      ],
    },
    {
      id: "slice",
      title: "Slice a span",
      prompt: "Declare int[] values = { 1, 2, 3, 4 }. Use values.AsSpan().Slice(1, 2) to declare Span<int> middle.",
      solution: "int[] values = { 1, 2, 3, 4 };\nSpan<int> middle = values.AsSpan().Slice(1, 2);",
      checks: ["middle.SequenceEqual(new[] { 2, 3 })"],
      rules: [
        {"kind":"InvocationExpression","token":"Slice","message":"Call Slice with the required arguments."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "Slice takes a start index and a length.",
        "Complete this form:\n\n```csharp\nint[] values = { 1, 2, 3, 4 };\nSpan<int> middle = values.AsSpan().Slice(___, ___);\n```",
      ],
    },
    {
      id: "range",
      title: "Slice using a range",
      prompt: "Declare Span<int> values = stackalloc[] { 1, 2, 3, 4 }. Declare Span<int> middle using values[1..3].",
      solution: "Span<int> values = stackalloc[] { 1, 2, 3, 4 };\nSpan<int> middle = values[1..3];",
      checks: ["middle.SequenceEqual(new[] { 2, 3 })"],
      rules: [
        {"kind":"RangeExpression","message":"A range uses an exclusive end, unlike Slice's length argument."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "A range uses an exclusive end, unlike Slice's length argument.",
        "Complete this form:\n\n```csharp\nSpan<int> values = stackalloc[] { 1, 2, 3, 4 };\nSpan<int> middle = values[___..___];\n```",
      ],
    },
    {
      id: "copy",
      title: "Copy a span",
      prompt: "Declare ReadOnlySpan<int> source = new[] { 2, 4 } and Span<int> target = stackalloc int[2]. Call source.CopyTo(target).",
      solution: "ReadOnlySpan<int> source = new[] { 2, 4 };\nSpan<int> target = stackalloc int[2];\nsource.CopyTo(target);",
      checks: ["target.SequenceEqual(new[] { 2, 4 })"],
      rules: [
        {"kind":"InvocationExpression","token":"CopyTo","message":"Call CopyTo with the required arguments."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "CopyTo writes into the destination span's existing storage.",
        "Complete this form:\n\n```csharp\nReadOnlySpan<int> source = new[] { 2, 4 };\nSpan<int> target = stackalloc int[2];\nsource.CopyTo(___);\n```",
      ],
    },
    {
      id: "try-copy",
      title: "Try copying into a smaller span",
      prompt: "Declare ReadOnlySpan<int> source = new[] { 1, 2, 3 } and Span<int> target = stackalloc int[2]. Store source.TryCopyTo(target) in bool copied.",
      solution: "ReadOnlySpan<int> source = new[] { 1, 2, 3 };\nSpan<int> target = stackalloc int[2];\nbool copied = source.TryCopyTo(target);",
      checks: ["!copied"],
      rules: [
        {"kind":"InvocationExpression","token":"TryCopyTo","message":"Call TryCopyTo with the required arguments."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "TryCopyTo reports insufficient destination length without throwing.",
        "Complete this form:\n\n```csharp\nReadOnlySpan<int> source = new[] { 1, 2, 3 };\nSpan<int> target = stackalloc int[2];\nbool copied = source.___(target);\n```",
      ],
    },
    {
      id: "fill",
      title: "Fill a span",
      prompt: "Declare Span<int> values = stackalloc int[3], then call values.Fill(8).",
      solution: "Span<int> values = stackalloc int[3];\nvalues.Fill(8);",
      checks: ["values.SequenceEqual(new[] { 8, 8, 8 })"],
      rules: [
        {"kind":"InvocationExpression","token":"Fill","message":"Call Fill with the required arguments."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "Fill changes every element in the viewed storage.",
        "Complete this form:\n\n```csharp\nSpan<int> values = stackalloc int[3];\nvalues.Fill(___);\n```",
      ],
    },
    {
      id: "clear",
      title: "Clear a span",
      prompt: "Declare Span<int> values = stackalloc[] { 1, 2, 3 }, then call values.Clear().",
      solution: "Span<int> values = stackalloc[] { 1, 2, 3 };\nvalues.Clear();",
      checks: ["values.SequenceEqual(new[] { 0, 0, 0 })"],
      rules: [
        {"kind":"InvocationExpression","token":"Clear","message":"Call Clear with the required arguments."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "Clear assigns the element type's default value throughout the span.",
        "Complete this form:\n\n```csharp\nSpan<int> values = stackalloc[] { 1, 2, 3 };\nvalues.___();\n```",
      ],
    },
    {
      id: "equal",
      title: "Compare span contents",
      prompt: "Declare ReadOnlySpan<int> left = new[] { 1, 2 } and right = new[] { 1, 2 }. Use left.SequenceEqual(right) to declare bool result.",
      solution: "ReadOnlySpan<int> left = new[] { 1, 2 }, right = new[] { 1, 2 };\nbool result = left.SequenceEqual(right);",
      checks: ["result"],
      rules: [
        {"kind":"InvocationExpression","token":"SequenceEqual","message":"Call SequenceEqual with the required arguments."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "SequenceEqual compares elements rather than backing storage identity.",
        "Complete this form:\n\n```csharp\nReadOnlySpan<int> left = new[] { 1, 2 }, right = new[] { 1, 2 };\nbool result = left.___(right);\n```",
      ],
    },
    {
      id: "compare",
      title: "Compare spans lexicographically",
      prompt: "Declare ReadOnlySpan<char> left = \"abc\".AsSpan(), right = \"abd\".AsSpan(). Use left.SequenceCompareTo(right) to declare int result.",
      solution: "ReadOnlySpan<char> left = \"abc\".AsSpan(), right = \"abd\".AsSpan();\nint result = left.SequenceCompareTo(right);",
      checks: ["result < 0"],
      rules: [
        {"kind":"InvocationExpression","token":"SequenceCompareTo","message":"Call SequenceCompareTo with the required arguments."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "SequenceCompareTo returns a comparison integer rather than a boolean.",
        "Complete this form:\n\n```csharp\nReadOnlySpan<char> left = \"abc\".AsSpan(), right = \"abd\".AsSpan();\nint result = left.___(right);\n```",
      ],
    },
    {
      id: "ref-foreach",
      title: "Mutate through ref foreach",
      prompt: "Declare Span<int> values = stackalloc[] { 1, 2, 3 }. Use foreach (ref int item in values) to double each element in place.",
      solution: "Span<int> values = stackalloc[] { 1, 2, 3 };\nforeach (ref int item in values) item *= 2;",
      checks: ["values.SequenceEqual(new[] { 2, 4, 6 })"],
      rules: [
        {"kind":"ForEachStatement","token":"ref","message":"Put ref before the foreach element type."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "Ref iteration binds each variable directly to its span element.",
        "Complete this form:\n\n```csharp\nSpan<int> values = stackalloc[] { 1, 2, 3 };\nforeach (ref int item in values) item *= ___;\n```",
      ],
    },
    {
      id: "ref-local",
      title: "Bind a ref local",
      prompt: "Declare int[] values = { 3, 4 }. Declare ref int current = ref values[0], then assign current = 9.",
      solution: "int[] values = { 3, 4 };\nref int current = ref values[0];\ncurrent = 9;",
      checks: ["values[0] == 9"],
      rules: [
        {"kind":"RefExpression","message":"Use ref on both the local type and its initializer."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "Use ref on both the local type and its initializer.",
        "Complete this form:\n\n```csharp\nint[] values = { 3, 4 };\nref int current = ref values[___];\ncurrent = 9;\n```",
      ],
    },
    {
      id: "readonly-local",
      title: "Bind a readonly ref local",
      prompt: "Declare int[] values = { 7, 8 }. Declare ref readonly int current = ref values[0].",
      solution: "int[] values = { 7, 8 };\nref readonly int current = ref values[0];",
      checks: ["current == 7"],
      rules: [
        {"kind":"RefType","token":"readonly","message":"Put readonly after ref in the local's type."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "The reference can read the original element without allowing assignment through current.",
        "Complete this form:\n\n```csharp\nint[] values = { 7, 8 };\nref readonly int current = ref values[___];\n```",
      ],
    },
    {
      id: "ref-return",
      title: "Return a reference",
      prompt: "Declare public static ref int First(int[] values) returning ref values[0].",
      solution: "public static ref int First(int[] values) => ref values[0];",
      checks: ["CheckRef()"],
      rules: [
        {"kind":"RefExpression","message":"Use ref in both the return type and the returned expression."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "Use ref in both the return type and the returned expression.",
        "Complete this form:\n\n```csharp\npublic static ref int First(int[] values) => ref values[___];\n```",
      ],
      mode: "members",
      support: "static bool CheckRef() { int[] items = { 1, 2 }; Practice.First(items) = 9; return items[0] == 9; }",
    },
    {
      id: "readonly-return",
      title: "Return a readonly reference",
      prompt: "Declare public static ref readonly int First(int[] values) returning ref values[0].",
      solution: "public static ref readonly int First(int[] values) => ref values[0];",
      checks: ["Practice.First(new[] { 7, 8 }) == 7"],
      rules: [
        {"kind":"RefType","token":"readonly","message":"Use ref readonly int as the return type."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "The readonly restriction belongs to the returned reference type.",
        "Complete this form:\n\n```csharp\npublic static ref readonly int First(int[] values) => ref values[___];\n```",
      ],
      mode: "members",
    },
    {
      id: "memory",
      title: "Slice a Memory value",
      prompt: "Declare int[] values = { 1, 2, 3 }. Declare Memory<int> segment = values.AsMemory(1, 2), then set segment.Span[0] = 9.",
      solution: "int[] values = { 1, 2, 3 };\nMemory<int> segment = values.AsMemory(1, 2);\nsegment.Span[0] = 9;",
      checks: ["values[1] == 9 && segment.Length == 2"],
      rules: [
        {"kind":"InvocationExpression","token":"AsMemory","message":"Call AsMemory with the required arguments."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "Memory<T> exposes its element view through Span.",
        "Complete this form:\n\n```csharp\nint[] values = { 1, 2, 3 };\nMemory<int> segment = values.AsMemory(___, ___);\nsegment.Span[0] = 9;\n```",
      ],
    },
    {
      id: "readonly-memory",
      title: "Create ReadOnlyMemory",
      prompt: "Declare string text = \"hello\". Declare ReadOnlyMemory<char> memory = text.AsMemory(1, 3).",
      solution: "string text = \"hello\";\nReadOnlyMemory<char> memory = text.AsMemory(1, 3);",
      checks: ["memory.Span.SequenceEqual(\"ell\".AsSpan())"],
      rules: [
        {"kind":"VariableDeclarator","name":"memory","type":"ReadOnlyMemory<char>","message":"Use ReadOnlyMemory<char> for the readonly character memory."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "ReadOnlyMemory can retain a slice and expose it as a readonly span.",
        "Complete this form:\n\n```csharp\nstring text = \"hello\";\nReadOnlyMemory<char> memory = text.AsMemory(___, ___);\n```",
      ],
    },
    {
      id: "scoped",
      title: "Declare a scoped span parameter",
      prompt: "Declare public static int First(scoped ReadOnlySpan<int> values) returning values[0].",
      solution: "public static int First(scoped ReadOnlySpan<int> values) => values[0];",
      checks: ["Practice.First(new[] { 5, 6 }) == 5"],
      rules: [
        {"kind":"Parameter","token":"scoped","message":"Put scoped before ReadOnlySpan<int> values."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "Scoped restricts how the parameter's reference can escape the method.",
        "Complete this form:\n\n```csharp\npublic static int First(scoped ReadOnlySpan<int> values) => values[___];\n```",
      ],
      mode: "members",
    },
    {
      id: "array-span-practice",
      title: "Create a span over an array: another example",
      prompt: "Declare int[] samples = { 1, 2, 3 }. Use samples.AsSpan() to declare Span<int> window, then set window[0] = 9.",
      solution: "int[] samples = { 1, 2, 3 };\nSpan<int> window = samples.AsSpan();\nwindow[0] = 9;",
      checks: ["samples[0] == 9 && window.Length == 3"],
      rules: [
        {"kind":"InvocationExpression","token":"AsSpan","message":"Call AsSpan with the required arguments."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "A span views existing array storage instead of copying it.",
        "Complete this form:\n\n```csharp\nint[] samples = { 1, 2, 3 };\nSpan<int> window = samples.AsSpan();\nwindow[0] = ___;\n```",
      ],
    },
    {
      id: "stackalloc-practice",
      title: "Allocate a stack span: another example",
      prompt: "Declare Span<int> samples = stackalloc int[3], then set samples[1] = 7.",
      solution: "Span<int> samples = stackalloc int[3];\nsamples[1] = 7;",
      checks: ["samples.Length == 3 && samples[1] == 7"],
      rules: [
        {"kind":"StackAllocArrayCreationExpression","message":"The target Span<int> makes stackalloc usable without unsafe code."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "The target Span<int> makes stackalloc usable without unsafe code.",
        "Complete this form:\n\n```csharp\nSpan<int> samples = stackalloc int[___];\nsamples[1] = 7;\n```",
      ],
    },
    {
      id: "stack-initializer-practice",
      title: "Initialize stack storage: another example",
      prompt: "Declare Span<int> samples = stackalloc[] { 2, 4, 6 }.",
      solution: "Span<int> samples = stackalloc[] { 2, 4, 6 };",
      checks: ["samples.SequenceEqual(new[] { 2, 4, 6 })"],
      rules: [
        {"kind":"ImplicitStackAllocArrayCreationExpression","message":"Put [] after stackalloc, then the initializer in braces."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "Put [] after stackalloc, then the initializer in braces.",
        "Complete this form:\n\n```csharp\nSpan<int> samples = stackalloc[] { ___, ___, ___ };\n```",
      ],
    },
    {
      id: "read-only-practice",
      title: "View a string as a readonly span: another example",
      prompt: "Declare string message = \"hello\". Declare ReadOnlySpan<char> characters = message.AsSpan().",
      solution: "string message = \"hello\";\nReadOnlySpan<char> characters = message.AsSpan();",
      checks: ["characters.Length == 5 && characters[0] == 'h'"],
      rules: [
        {"kind":"VariableDeclarator","name":"characters","type":"ReadOnlySpan<char>","message":"Use ReadOnlySpan<char> for the string view."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "Strings expose readonly character storage.",
        "Complete this form:\n\n```csharp\nstring message = \"hello\";\nReadOnlySpan<char> characters = message.___();\n```",
      ],
    },
    {
      id: "slice-practice",
      title: "Slice a span: another example",
      prompt: "Declare int[] samples = { 1, 2, 3, 4 }. Use samples.AsSpan().Slice(1, 2) to declare Span<int> middle.",
      solution: "int[] samples = { 1, 2, 3, 4 };\nSpan<int> middle = samples.AsSpan().Slice(1, 2);",
      checks: ["middle.SequenceEqual(new[] { 2, 3 })"],
      rules: [
        {"kind":"InvocationExpression","token":"Slice","message":"Call Slice with the required arguments."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "Slice takes a start index and a length.",
        "Complete this form:\n\n```csharp\nint[] samples = { 1, 2, 3, 4 };\nSpan<int> middle = samples.AsSpan().Slice(___, ___);\n```",
      ],
    },
    {
      id: "range-practice",
      title: "Slice using a range: another example",
      prompt: "Declare Span<int> samples = stackalloc[] { 1, 2, 3, 4 }. Declare Span<int> middle using samples[1..3].",
      solution: "Span<int> samples = stackalloc[] { 1, 2, 3, 4 };\nSpan<int> middle = samples[1..3];",
      checks: ["middle.SequenceEqual(new[] { 2, 3 })"],
      rules: [
        {"kind":"RangeExpression","message":"A range uses an exclusive end, unlike Slice's length argument."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "A range uses an exclusive end, unlike Slice's length argument.",
        "Complete this form:\n\n```csharp\nSpan<int> samples = stackalloc[] { 1, 2, 3, 4 };\nSpan<int> middle = samples[___..___];\n```",
      ],
    },
    {
      id: "copy-practice",
      title: "Copy a span: another example",
      prompt: "Declare ReadOnlySpan<int> origin = new[] { 2, 4 } and Span<int> target = stackalloc int[2]. Call origin.CopyTo(target).",
      solution: "ReadOnlySpan<int> origin = new[] { 2, 4 };\nSpan<int> target = stackalloc int[2];\norigin.CopyTo(target);",
      checks: ["target.SequenceEqual(new[] { 2, 4 })"],
      rules: [
        {"kind":"InvocationExpression","token":"CopyTo","message":"Call CopyTo with the required arguments."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "CopyTo writes into the destination span's existing storage.",
        "Complete this form:\n\n```csharp\nReadOnlySpan<int> origin = new[] { 2, 4 };\nSpan<int> target = stackalloc int[2];\norigin.CopyTo(___);\n```",
      ],
    },
    {
      id: "try-copy-practice",
      title: "Try copying into a smaller span: another example",
      prompt: "Declare ReadOnlySpan<int> origin = new[] { 1, 2, 3 } and Span<int> target = stackalloc int[2]. Store origin.TryCopyTo(target) in bool copied.",
      solution: "ReadOnlySpan<int> origin = new[] { 1, 2, 3 };\nSpan<int> target = stackalloc int[2];\nbool copied = origin.TryCopyTo(target);",
      checks: ["!copied"],
      rules: [
        {"kind":"InvocationExpression","token":"TryCopyTo","message":"Call TryCopyTo with the required arguments."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "TryCopyTo reports insufficient destination length without throwing.",
        "Complete this form:\n\n```csharp\nReadOnlySpan<int> origin = new[] { 1, 2, 3 };\nSpan<int> target = stackalloc int[2];\nbool copied = origin.___(target);\n```",
      ],
    },
    {
      id: "fill-practice",
      title: "Fill a span: another example",
      prompt: "Declare Span<int> samples = stackalloc int[3], then call samples.Fill(8).",
      solution: "Span<int> samples = stackalloc int[3];\nsamples.Fill(8);",
      checks: ["samples.SequenceEqual(new[] { 8, 8, 8 })"],
      rules: [
        {"kind":"InvocationExpression","token":"Fill","message":"Call Fill with the required arguments."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "Fill changes every element in the viewed storage.",
        "Complete this form:\n\n```csharp\nSpan<int> samples = stackalloc int[3];\nsamples.Fill(___);\n```",
      ],
    },
    {
      id: "clear-practice",
      title: "Clear a span: another example",
      prompt: "Declare Span<int> samples = stackalloc[] { 1, 2, 3 }, then call samples.Clear().",
      solution: "Span<int> samples = stackalloc[] { 1, 2, 3 };\nsamples.Clear();",
      checks: ["samples.SequenceEqual(new[] { 0, 0, 0 })"],
      rules: [
        {"kind":"InvocationExpression","token":"Clear","message":"Call Clear with the required arguments."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "Clear assigns the element type's default value throughout the span.",
        "Complete this form:\n\n```csharp\nSpan<int> samples = stackalloc[] { 1, 2, 3 };\nsamples.___();\n```",
      ],
    },
    {
      id: "equal-practice",
      title: "Compare span contents: another example",
      prompt: "Declare ReadOnlySpan<int> firstInput = new[] { 1, 2 } and right = new[] { 1, 2 }. Use firstInput.SequenceEqual(right) to declare bool result.",
      solution: "ReadOnlySpan<int> firstInput = new[] { 1, 2 }, right = new[] { 1, 2 };\nbool result = firstInput.SequenceEqual(right);",
      checks: ["result"],
      rules: [
        {"kind":"InvocationExpression","token":"SequenceEqual","message":"Call SequenceEqual with the required arguments."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "SequenceEqual compares elements rather than backing storage identity.",
        "Complete this form:\n\n```csharp\nReadOnlySpan<int> firstInput = new[] { 1, 2 }, right = new[] { 1, 2 };\nbool result = firstInput.___(right);\n```",
      ],
    },
    {
      id: "compare-practice",
      title: "Compare spans lexicographically: another example",
      prompt: "Declare ReadOnlySpan<char> firstInput = \"abc\".AsSpan(), right = \"abd\".AsSpan(). Use firstInput.SequenceCompareTo(right) to declare int result.",
      solution: "ReadOnlySpan<char> firstInput = \"abc\".AsSpan(), right = \"abd\".AsSpan();\nint result = firstInput.SequenceCompareTo(right);",
      checks: ["result < 0"],
      rules: [
        {"kind":"InvocationExpression","token":"SequenceCompareTo","message":"Call SequenceCompareTo with the required arguments."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "SequenceCompareTo returns a comparison integer rather than a boolean.",
        "Complete this form:\n\n```csharp\nReadOnlySpan<char> firstInput = \"abc\".AsSpan(), right = \"abd\".AsSpan();\nint result = firstInput.___(right);\n```",
      ],
    },
    {
      id: "ref-foreach-practice",
      title: "Mutate through ref foreach: another example",
      prompt: "Declare Span<int> samples = stackalloc[] { 1, 2, 3 }. Use foreach (ref int item in samples) to double each element in place.",
      solution: "Span<int> samples = stackalloc[] { 1, 2, 3 };\nforeach (ref int item in samples) item *= 2;",
      checks: ["samples.SequenceEqual(new[] { 2, 4, 6 })"],
      rules: [
        {"kind":"ForEachStatement","token":"ref","message":"Put ref before the foreach element type."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "Ref iteration binds each variable directly to its span element.",
        "Complete this form:\n\n```csharp\nSpan<int> samples = stackalloc[] { 1, 2, 3 };\nforeach (ref int item in samples) item *= ___;\n```",
      ],
    },
    {
      id: "ref-local-practice",
      title: "Bind a ref local: another example",
      prompt: "Declare int[] samples = { 3, 4 }. Declare ref int current = ref samples[0], then assign current = 9.",
      solution: "int[] samples = { 3, 4 };\nref int current = ref samples[0];\ncurrent = 9;",
      checks: ["samples[0] == 9"],
      rules: [
        {"kind":"RefExpression","message":"Use ref on both the local type and its initializer."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "Use ref on both the local type and its initializer.",
        "Complete this form:\n\n```csharp\nint[] samples = { 3, 4 };\nref int current = ref samples[___];\ncurrent = 9;\n```",
      ],
    },
    {
      id: "readonly-local-practice",
      title: "Bind a readonly ref local: another example",
      prompt: "Declare int[] samples = { 7, 8 }. Declare ref readonly int current = ref samples[0].",
      solution: "int[] samples = { 7, 8 };\nref readonly int current = ref samples[0];",
      checks: ["current == 7"],
      rules: [
        {"kind":"RefType","token":"readonly","message":"Put readonly after ref in the local's type."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "The reference can read the original element without allowing assignment through current.",
        "Complete this form:\n\n```csharp\nint[] samples = { 7, 8 };\nref readonly int current = ref samples[___];\n```",
      ],
    },
    {
      id: "ref-return-practice",
      title: "Return a reference: another example",
      prompt: "Declare public static ref int First(int[] samples) returning ref samples[0].",
      solution: "public static ref int First(int[] samples) => ref samples[0];",
      checks: ["CheckRef()"],
      rules: [
        {"kind":"RefExpression","message":"Use ref in both the return type and the returned expression."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "Use ref in both the return type and the returned expression.",
        "Complete this form:\n\n```csharp\npublic static ref int First(int[] samples) => ref samples[___];\n```",
      ],
      mode: "members",
      support: "static bool CheckRef() { int[] items = { 1, 2 }; Practice.First(items) = 9; return items[0] == 9; }",
    },
    {
      id: "readonly-return-practice",
      title: "Return a readonly reference: another example",
      prompt: "Declare public static ref readonly int First(int[] samples) returning ref samples[0].",
      solution: "public static ref readonly int First(int[] samples) => ref samples[0];",
      checks: ["Practice.First(new[] { 7, 8 }) == 7"],
      rules: [
        {"kind":"RefType","token":"readonly","message":"Use ref readonly int as the return type."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "The readonly restriction belongs to the returned reference type.",
        "Complete this form:\n\n```csharp\npublic static ref readonly int First(int[] samples) => ref samples[___];\n```",
      ],
      mode: "members",
    },
    {
      id: "memory-practice",
      title: "Slice a Memory value: another example",
      prompt: "Declare int[] samples = { 1, 2, 3 }. Declare Memory<int> segment = samples.AsMemory(1, 2), then set segment.Span[0] = 9.",
      solution: "int[] samples = { 1, 2, 3 };\nMemory<int> segment = samples.AsMemory(1, 2);\nsegment.Span[0] = 9;",
      checks: ["samples[1] == 9 && segment.Length == 2"],
      rules: [
        {"kind":"InvocationExpression","token":"AsMemory","message":"Call AsMemory with the required arguments."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "Memory<T> exposes its element view through Span.",
        "Complete this form:\n\n```csharp\nint[] samples = { 1, 2, 3 };\nMemory<int> segment = samples.AsMemory(___, ___);\nsegment.Span[0] = 9;\n```",
      ],
    },
    {
      id: "readonly-memory-practice",
      title: "Create ReadOnlyMemory: another example",
      prompt: "Declare string message = \"hello\". Declare ReadOnlyMemory<char> memory = message.AsMemory(1, 3).",
      solution: "string message = \"hello\";\nReadOnlyMemory<char> memory = message.AsMemory(1, 3);",
      checks: ["memory.Span.SequenceEqual(\"ell\".AsSpan())"],
      rules: [
        {"kind":"VariableDeclarator","name":"memory","type":"ReadOnlyMemory<char>","message":"Use ReadOnlyMemory<char> for the readonly character memory."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "ReadOnlyMemory can retain a slice and expose it as a readonly span.",
        "Complete this form:\n\n```csharp\nstring message = \"hello\";\nReadOnlyMemory<char> memory = message.AsMemory(___, ___);\n```",
      ],
    },
    {
      id: "scoped-practice",
      title: "Declare a scoped span parameter: another example",
      prompt: "Declare public static int First(scoped ReadOnlySpan<int> samples) returning samples[0].",
      solution: "public static int First(scoped ReadOnlySpan<int> samples) => samples[0];",
      checks: ["Practice.First(new[] { 5, 6 }) == 5"],
      rules: [
        {"kind":"Parameter","token":"scoped","message":"Put scoped before ReadOnlySpan<int> samples."},
      ],
      hints: [
        "A span views existing contiguous storage; writing through a writable view changes that storage.",
        "Scoped restricts how the parameter's reference can escape the method.",
        "Complete this form:\n\n```csharp\npublic static int First(scoped ReadOnlySpan<int> samples) => samples[___];\n```",
      ],
      mode: "members",
    },
  ],
};

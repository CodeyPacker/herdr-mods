// C#: the syllabus a course starts from, how code is highlighted, and how practice runs.
// Plain JavaScript with no Herdr imports, so scripts can use it too.
import { compose, parseRun, checkLines, checkName } from "./csharp-compose.js";

// The starting plan for the outline. Claude keeps what the repo shows and adds part 3 from the repo.
const SYLLABUS = `Part "basics", The language:
- How a project is put together: .csproj, .sln or .slnx, Directory.Build.props, namespaces, implicit usings, Program.cs and top-level statements. Compare to package.json and tsconfig.json.
- Types, var and null: value and reference types, var, string?, ?., ??, !, required.
- Classes, constructors and properties: primary constructors, readonly fields, get-only and init properties, static, expression bodies, access modifiers.
- Records, structs and enums: positional records, with, value equality, record struct, enums.
- Collections: List<T>, Dictionary, HashSet, IReadOnlyList<T>, arrays, collection expressions, out parameters.
- LINQ: Where, Select, GroupBy, ToDictionary, FirstOrDefault, lazy evaluation. Compare to filter, map and reduce.

Part "core", Working code:
- Pattern matching and switch: is, is not, or, relational and property patterns, switch expressions.
- Lambdas, delegates and extension methods: Func, Action, delegate, captured locals, this parameters.
- Interfaces, inheritance and generics: interface, base classes, override, sealed, abstract, <T>, where constraints.
- async, Task and CancellationToken: async Task<T>, await, Task.WhenAll, await foreach, ValueTask. Compare to Promise and AbortSignal.
- Errors: try, catch, when, custom exceptions, result types.
- using and cleanup: IDisposable, IAsyncDisposable, using var, await using, who owns a resource.

Part "repo", How this repo is built: 3 to 6 modules on this repo's own architecture, such as startup and dependency injection, configuration, web endpoints, data access, one feature end to end, and tests. Only what is really there.`;

// What an exercise is, for the prompt that writes them.
const PRACTICE_RULES = `Each exercise is one C# file the learner edits, named exercise.cs, run with \`dotnet run exercise.cs\` (a .NET 10 file-based app, no project file, no NuGet packages). Nullable is on and warnings are errors. Implicit usings are on (System, System.Linq, System.Collections.Generic, System.Threading.Tasks and others).

Two kinds:
- "program": the learner writes top-level statements. Pass means what it prints equals "expected", ignoring trailing spaces and blank lines at the end. Fields: id, title, kind, prompt, starter, expected, solution, concept, source.
- "types": the learner writes types only (records, classes, enums, interfaces, static classes, extension methods), no top-level statements. "checks" is C# statements, one per line, each holding exactly one call \`Check("name", condition);\` with a name no other check uses. The checks run before the learner's code. Pass means every check passes. Fields: id, title, kind, prompt, starter, checks, solution, concept, source.

prompt: markdown, two to four sentences: what to write, naming the types and members the checks expect.
starter: what the learner starts from, usually a comment saying what to write and any setup code. It must not pass as it is.
solution: a full exercise.cs that passes.
concept: a short phrase naming the feature, read as "Here is how the repo writes <concept>."`;

/** Problems with one exercise's own fields, as short sentences. Empty when it is fine. */
function checkExercise(ex) {
  const out = [];
  for (const k of ["title", "prompt", "starter", "solution", "concept"]) if (!String(ex[k] ?? "").trim()) out.push(`has no ${k}`);
  if (ex.kind === "program") {
    if (typeof ex.expected !== "string" || !ex.expected.trim()) out.push(`a "program" exercise needs "expected"`);
  } else if (ex.kind === "types") {
    const lines = checkLines(ex);
    if (lines.length < 2) out.push(`has ${lines.length} checks, wants at least 2`);
    lines.forEach((l, i) => {
      if (!checkName(l)) out.push(`check ${i + 1} does not start with Check("name", ...)`);
      if ((l.match(/\bCheck\(/g) ?? []).length !== 1) out.push(`check ${i + 1} must hold exactly one Check( call`);
    });
    const names = lines.map(l => checkName(l)?.text);
    if (new Set(names).size !== names.length) out.push("two checks have the same name");
  } else out.push(`kind "${ex.kind}" is not "program" or "types"`);
  return out;
}

export const csharp = {
  id: "csharp",
  name: "C#",
  // git pathspecs for its source files. A repo with none cannot hold a course.
  sources: ["*.cs"],
  // Editor grammar by file extension. Project and solution files are XML.
  grammar: { cs: "cs", csproj: "xml", props: "xml", targets: "xml", slnx: "xml", json: "json" },
  syllabus: SYLLABUS,
  practice: {
    file: "exercise.cs",
    tool: "dotnet",
    // Shown when the tool is missing.
    needs: "Practice needs the .NET 10 SDK: `dotnet` on PATH.",
    rules: PRACTICE_RULES,
    check: checkExercise,
    compose,
    parseRun,
    /** The command that runs a composed file. */
    command: path => ({ exe: "dotnet", args: ["run", path] }),
    /** The command that kills a run's program if it hangs. `name` is the run file's name without .cs. */
    stop: (name, windows) => windows ? { exe: "taskkill", args: ["/F", "/T", "/IM", `${name}.exe`] } : { exe: "pkill", args: ["-f", `/${name}`] },
  },
};

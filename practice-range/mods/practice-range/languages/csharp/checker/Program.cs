using System.Text.Json;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

// This process compiles but never executes a learner's answer. The Node runner executes
// the emitted assembly separately, with a time limit and a bounded output buffer.
internal static class Program
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public static int Main(string[] args)
    {
        try
        {
            var request = JsonSerializer.Deserialize<Request>(File.ReadAllText(args[0]), JsonOptions)!;
            var source = File.ReadAllText(request.File);
            var tree = CSharpSyntaxTree.ParseText(source, path: "Exercise.cs");
            var root = tree.GetRoot();
            // Only inspect the answer region. Generated assertions cannot satisfy syntax rules.
            var answerNodes = root.DescendantNodes().Where(node =>
                node.SpanStart >= request.Start && node.Span.End <= request.End).ToArray();
            var failures = request.Rules.Where(rule =>
                answerNodes.Count(node => Matches(node, rule)) < rule.Min).Select(rule => rule.Message).ToArray();

            var trustedAssemblies = (string)AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES")!;
            var references = trustedAssemblies.Split(Path.PathSeparator).Select(path => MetadataReference.CreateFromFile(path));
            // Tutor used SDK implicit usings in their own generated file. Keep them separate
            // so an explicit using in a learner file does not become a duplicate directive.
            SyntaxTree[] trees = request.Strict
                ? [tree, CSharpSyntaxTree.ParseText("global using System;\nglobal using System.Collections.Generic;\nglobal using System.IO;\nglobal using System.Linq;\nglobal using System.Net.Http;\nglobal using System.Threading;\nglobal using System.Threading.Tasks;", path: "GlobalUsings.g.cs")]
                : [tree];
            var compilation = CSharpCompilation.Create("Attempt", trees, references,
                new CSharpCompilationOptions(OutputKind.ConsoleApplication, optimizationLevel: OptimizationLevel.Debug,
                    nullableContextOptions: request.Strict ? NullableContextOptions.Enable : NullableContextOptions.Disable,
                    generalDiagnosticOption: request.Strict ? ReportDiagnostic.Error : ReportDiagnostic.Default));
            using var output = File.Create(request.Output);
            var result = compilation.Emit(output);
            var errors = result.Diagnostics.Where(d => d.Severity == DiagnosticSeverity.Error).Take(12)
                .Select(d => d.ToString()).ToArray();
            Console.WriteLine(JsonSerializer.Serialize(new { compiled = result.Success, errors, failures }));
            return 0;
        }
        catch (Exception error)
        {
            Console.WriteLine(JsonSerializer.Serialize(new { error = error.Message }));
            return 1;
        }
    }

    private static bool Matches(SyntaxNode node, Rule rule)
    {
        if (node.Kind().ToString() != rule.Kind) return false;
        if (rule.Name is not null && Name(node) != rule.Name) return false;
        if (rule.Type is not null && string.Concat(Type(node)?.DescendantTokens().Select(token => token.Text) ?? []) != rule.Type) return false;
        if (rule.Token is not null && !node.DescendantTokens().Any(token => token.Text == rule.Token)) return false;
        if (rule.Modifier is not null)
        {
            var modifiers = node switch
            {
                MemberDeclarationSyntax member => member.Modifiers,
                LocalDeclarationStatementSyntax local => local.Modifiers,
                _ => default
            };
            if (!modifiers.Any(token => token.Text == rule.Modifier)) return false;
        }
        return true;
    }

    private static string? Name(SyntaxNode node) => node switch
    {
        VariableDeclaratorSyntax variable => variable.Identifier.ValueText,
        MethodDeclarationSyntax method => method.Identifier.ValueText,
        LocalFunctionStatementSyntax method => method.Identifier.ValueText,
        BaseTypeDeclarationSyntax type => type.Identifier.ValueText,
        PropertyDeclarationSyntax property => property.Identifier.ValueText,
        ConstructorDeclarationSyntax constructor => constructor.Identifier.ValueText,
        ParameterSyntax parameter => parameter.Identifier.ValueText,
        _ => null
    };

    private static TypeSyntax? Type(SyntaxNode node) => node switch
    {
        VariableDeclaratorSyntax variable => (variable.Parent as VariableDeclarationSyntax)?.Type,
        MethodDeclarationSyntax method => method.ReturnType,
        PropertyDeclarationSyntax property => property.Type,
        ParameterSyntax parameter => parameter.Type,
        _ => null
    };

    private sealed record Request(string File, string Output, int Start, int End, Rule[] Rules, bool Strict = false);
    private sealed record Rule(string Kind, string Message, string? Name = null, string? Type = null,
        string? Token = null, string? Modifier = null, int Min = 1);
}

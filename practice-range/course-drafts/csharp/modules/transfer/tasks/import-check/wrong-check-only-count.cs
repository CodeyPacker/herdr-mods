public static bool CheckImport(Func<List<string>, ImportReport> candidate)
{
    var lines = new List<string> { "Ada,2", "ada,3", "Bob,0" };
    return candidate(lines).Totals.Count == 2;
}

public static bool CheckImport(Func<List<string>, ImportReport> candidate)
{
    bool Matches(List<string> input, int rejected, int total, int ada, int bob)
    {
        var original = new List<string>(input);
        ImportReport report = candidate(input);
        if (!input.SequenceEqual(original) || report.Rejected != rejected || report.Totals.Count != total)
            return false;
        if (total == 0) return true;
        return report.Totals.TryGetValue("aDa", out int adaTotal) && adaTotal == ada &&
            report.Totals.TryGetValue("bOb", out int bobTotal) && bobTotal == bob;
    }

    return Matches(new List<string>
    {
        " Ada , +2 ", "ada,3", "Bob,0", "broken", " ,7", "Cara,-1",
        "Dan,999999999999999999999", "Eve,1,extra", "Fox,word"
    }, 6, 2, 5, 0) && Matches(new List<string>(), 0, 0, 0, 0);
}

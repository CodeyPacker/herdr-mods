public static bool CheckImport(Func<List<string>, ImportReport> candidate)
{
    var lines = new List<string>
    {
        " Ada , +2 ",
        "ada,3",
        "Bob,0",
        "broken",
        " ,7",
        "Cara,-1",
        "Dan,999999999999999999999",
        "Eve,1,extra",
        "Fox,word"
    };
    var before = new List<string>(lines);
    ImportReport report = candidate(lines);
    if (!lines.SequenceEqual(before)) return false;
    if (report.Rejected != 6) return false;
    if (report.Totals.Count != 2) return false;
    if (!report.Totals.TryGetValue("ADA", out int ada) || ada != 5) return false;
    if (!report.Totals.TryGetValue("bOb", out int zero) || zero != 0) return false;

    var empty = new List<string>();
    ImportReport emptyReport = candidate(empty);
    return empty.Count == 0 && emptyReport.Rejected == 0 && emptyReport.Totals.Count == 0;
}

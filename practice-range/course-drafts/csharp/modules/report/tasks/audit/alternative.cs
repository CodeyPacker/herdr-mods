public static AuditReport Summarize(List<Row> rows)
{
    List<Row> valid = rows.Where(row => row.Id != "" && row.Title != "").ToList();
    int accepted = valid.Select(row => row.Id).Distinct().Count();
    int duplicates = valid.Count - accepted;
    int invalid = rows.Count - valid.Count;
    string status = rows.Count == 0 ? "empty" : duplicates + invalid == 0 ? "clean" : "review";
    return new AuditReport(status, accepted, duplicates, invalid);
}

public static async Task<AuditReport> AuditAsync(IRowReader reader)
{
    List<Row> rows;
    try
    {
        rows = await reader.ReadAsync();
    }
    catch (InvalidOperationException)
    {
        return new AuditReport("unavailable", 0, 0, 0);
    }
    return Summarize(rows);
}

public static bool SummarizeCheck(Func<List<Row>, AuditReport> candidate)
{
    AuditReport report = candidate(new List<Row> { new Row("A", "Pack"), new Row("A", "Again") });
    return report.Accepted == 1 && report.Duplicates == 1 && report.Status == "review";
}

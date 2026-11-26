public static AuditReport Summarize(List<Row> rows)
{
    HashSet<string> seen = new HashSet<string>();
    int accepted = 0;
    int duplicates = 0;
    int invalid = 0;
    foreach (Row row in rows)
    {
        if (!seen.Add(row.Id))
        {
            duplicates = duplicates + 1;
        }
        else if (row.Id == "" || row.Title == "")
        {
            invalid = invalid + 1;
        }
        else
        {
            accepted = accepted + 1;
        }
    }
    string status = rows.Count == 0 ? "empty" : accepted == rows.Count ? "clean" : "review";
    return new AuditReport(status, accepted, duplicates, invalid);
}

public static async Task<AuditReport> AuditAsync(IRowReader reader)
{
    try
    {
        return Summarize(await reader.ReadAsync());
    }
    catch (InvalidOperationException)
    {
        return new AuditReport("unavailable", 0, 0, 0);
    }
}

public static bool SummarizeCheck(Func<List<Row>, AuditReport> candidate)
{
    List<Row> rows = new List<Row> { new Row("A", "Pack"), new Row("A", "Again"), new Row("B", "Ship") };
    return candidate(rows) == new AuditReport("review", 2, 1, 0);
}

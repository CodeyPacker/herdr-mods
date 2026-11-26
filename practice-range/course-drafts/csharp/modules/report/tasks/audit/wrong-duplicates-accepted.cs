public static AuditReport Summarize(List<Row> rows)
{
    int accepted = 0;
    int invalid = 0;
    foreach (Row row in rows)
    {
        if (row.Id == "" || row.Title == "")
        {
            invalid = invalid + 1;
        }
        else
        {
            accepted = accepted + 1;
        }
    }
    string status = rows.Count == 0 ? "empty" : invalid == 0 ? "clean" : "review";
    return new AuditReport(status, accepted, 0, invalid);
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

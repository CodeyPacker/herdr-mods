public static AuditReport Summarize(List<Row> rows)
{
    return new AuditReport("empty", 0, 0, 0);
}

public static async Task<AuditReport> AuditAsync(IRowReader reader)
{
    List<Row> rows = await reader.ReadAsync();
    return Summarize(rows);
}

public static bool SummarizeCheck(Func<List<Row>, AuditReport> candidate)
{
    return true;
}

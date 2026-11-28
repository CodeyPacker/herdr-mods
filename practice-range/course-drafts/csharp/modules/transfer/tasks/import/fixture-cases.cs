public record ImportReport(Dictionary<string, int> Totals, int Rejected);

public static class Given
{
    public static List<string> Rows()
    {
        return new List<string> { " Oak,2 ", "oak,+3", "Birch,0", "bad", "Elm,-1", "Pine,999999999999999999999999", "Ash,1,2", " ,4" };
    }

    public static bool ValidTotals(Func<List<string>, ImportReport> candidate)
    {
        ImportReport report = candidate(Rows());
        return report.Totals.TryGetValue("OAK", out int oak) && oak == 5
            && report.Totals.TryGetValue("birch", out int birch) && birch == 0;
    }

    public static bool RejectedCount(Func<List<string>, ImportReport> candidate)
    {
        return candidate(Rows()).Rejected == 5;
    }

    public static bool ExactKeys(Func<List<string>, ImportReport> candidate)
    {
        Dictionary<string, int> totals = candidate(Rows()).Totals;
        return totals.Count == 2 && totals.ContainsKey("oak") && totals.ContainsKey("BIRCH");
    }

    public static bool EmptyInput(Func<List<string>, ImportReport> candidate)
    {
        ImportReport report = candidate(new List<string>());
        return report.Totals.Count == 0 && report.Rejected == 0;
    }

    public static bool InputUnchanged(Func<List<string>, ImportReport> candidate)
    {
        List<string> rows = Rows();
        candidate(rows);
        return rows.Count == 8 && rows[0] == " Oak,2 " && rows[7] == " ,4";
    }
}
